import { now } from '../../core/time.js';
import '../../core/tracing.js';
import { Vec3 } from '../../core/math/vec3.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, LAYERID_DEPTH } from '../constants.js';
import '../lighting/world-clusters-debug.js';
import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import { RenderPassForward } from './render-pass-forward.js';
import { RenderPassPostprocessing } from './render-pass-postprocessing.js';

const _noLights = [[], [], []];
const _drawCallList = {
  drawCalls: [],
  shaderInstances: [],
  isNewMaterial: [],
  lightMaskChanged: [],
  clear: function () {
    this.drawCalls.length = 0;
    this.shaderInstances.length = 0;
    this.isNewMaterial.length = 0;
    this.lightMaskChanged.length = 0;
  }
};
function vogelDiskPrecalculationSamples(numSamples) {
  const samples = [];
  for (let i = 0; i < numSamples; ++i) {
    const r = Math.sqrt(i + 0.5) / Math.sqrt(numSamples);
    samples.push(r);
  }
  return samples;
}
function vogelSpherePrecalculationSamples(numSamples) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const weight = i / numSamples;
    const radius = Math.sqrt(1.0 - weight * weight);
    samples.push(radius);
  }
  return samples;
}
class ForwardRenderer extends Renderer {
  constructor(graphicsDevice) {
    super(graphicsDevice);
    const device = this.device;
    this._forwardDrawCalls = 0;
    this._materialSwitches = 0;
    this._depthMapTime = 0;
    this._forwardTime = 0;
    this._sortTime = 0;
    const scope = device.scope;
    this.fogColorId = scope.resolve('fog_color');
    this.fogStartId = scope.resolve('fog_start');
    this.fogEndId = scope.resolve('fog_end');
    this.fogDensityId = scope.resolve('fog_density');
    this.ambientId = scope.resolve('light_globalAmbient');
    this.skyboxIntensityId = scope.resolve('skyboxIntensity');
    this.cubeMapRotationMatrixId = scope.resolve('cubeMapRotationMatrix');
    this.pcssDiskSamplesId = scope.resolve('pcssDiskSamples[0]');
    this.pcssSphereSamplesId = scope.resolve('pcssSphereSamples[0]');
    this.lightColorId = [];
    this.lightDir = [];
    this.lightDirId = [];
    this.lightShadowMapId = [];
    this.lightShadowMatrixId = [];
    this.lightShadowParamsId = [];
    this.lightShadowIntensity = [];
    this.lightRadiusId = [];
    this.lightPos = [];
    this.lightPosId = [];
    this.lightWidth = [];
    this.lightWidthId = [];
    this.lightHeight = [];
    this.lightHeightId = [];
    this.lightInAngleId = [];
    this.lightOutAngleId = [];
    this.lightCookieId = [];
    this.lightCookieIntId = [];
    this.lightCookieMatrixId = [];
    this.lightCookieOffsetId = [];
    this.lightShadowSearchAreaId = [];
    this.lightCameraParamsId = [];
    this.shadowMatrixPaletteId = [];
    this.shadowCascadeDistancesId = [];
    this.shadowCascadeCountId = [];
    this.screenSizeId = scope.resolve('uScreenSize');
    this._screenSize = new Float32Array(4);
    this.fogColor = new Float32Array(3);
    this.ambientColor = new Float32Array(3);
    this.pcssDiskSamples = vogelDiskPrecalculationSamples(16);
    this.pcssSphereSamples = vogelSpherePrecalculationSamples(16);
  }
  destroy() {
    super.destroy();
  }
  dispatchGlobalLights(scene) {
    this.ambientColor[0] = scene.ambientLight.r;
    this.ambientColor[1] = scene.ambientLight.g;
    this.ambientColor[2] = scene.ambientLight.b;
    if (scene.gammaCorrection) {
      for (let i = 0; i < 3; i++) {
        this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
      }
    }
    if (scene.physicalUnits) {
      for (let i = 0; i < 3; i++) {
        this.ambientColor[i] *= scene.ambientLuminance;
      }
    }
    this.ambientId.setValue(this.ambientColor);
    this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
    this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);
  }
  _resolveLight(scope, i) {
    const light = 'light' + i;
    this.lightColorId[i] = scope.resolve(light + '_color');
    this.lightDir[i] = new Float32Array(3);
    this.lightDirId[i] = scope.resolve(light + '_direction');
    this.lightShadowMapId[i] = scope.resolve(light + '_shadowMap');
    this.lightShadowMatrixId[i] = scope.resolve(light + '_shadowMatrix');
    this.lightShadowParamsId[i] = scope.resolve(light + '_shadowParams');
    this.lightShadowIntensity[i] = scope.resolve(light + '_shadowIntensity');
    this.lightShadowSearchAreaId[i] = scope.resolve(light + '_shadowSearchArea');
    this.lightRadiusId[i] = scope.resolve(light + '_radius');
    this.lightPos[i] = new Float32Array(3);
    this.lightPosId[i] = scope.resolve(light + '_position');
    this.lightWidth[i] = new Float32Array(3);
    this.lightWidthId[i] = scope.resolve(light + '_halfWidth');
    this.lightHeight[i] = new Float32Array(3);
    this.lightHeightId[i] = scope.resolve(light + '_halfHeight');
    this.lightInAngleId[i] = scope.resolve(light + '_innerConeAngle');
    this.lightOutAngleId[i] = scope.resolve(light + '_outerConeAngle');
    this.lightCookieId[i] = scope.resolve(light + '_cookie');
    this.lightCookieIntId[i] = scope.resolve(light + '_cookieIntensity');
    this.lightCookieMatrixId[i] = scope.resolve(light + '_cookieMatrix');
    this.lightCookieOffsetId[i] = scope.resolve(light + '_cookieOffset');
    this.lightCameraParamsId[i] = scope.resolve(light + '_cameraParams');
    this.shadowMatrixPaletteId[i] = scope.resolve(light + '_shadowMatrixPalette[0]');
    this.shadowCascadeDistancesId[i] = scope.resolve(light + '_shadowCascadeDistances[0]');
    this.shadowCascadeCountId[i] = scope.resolve(light + '_shadowCascadeCount');
  }
  setLTCDirectionalLight(wtm, cnt, dir, campos, far) {
    this.lightPos[cnt][0] = campos.x - dir.x * far;
    this.lightPos[cnt][1] = campos.y - dir.y * far;
    this.lightPos[cnt][2] = campos.z - dir.z * far;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
    this.lightWidth[cnt][0] = hWidth.x * far;
    this.lightWidth[cnt][1] = hWidth.y * far;
    this.lightWidth[cnt][2] = hWidth.z * far;
    this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
    const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
    this.lightHeight[cnt][0] = hHeight.x * far;
    this.lightHeight[cnt][1] = hHeight.y * far;
    this.lightHeight[cnt][2] = hHeight.z * far;
    this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
  }
  dispatchDirectLights(dirs, scene, mask, camera) {
    let cnt = 0;
    const scope = this.device.scope;
    for (let i = 0; i < dirs.length; i++) {
      if (!(dirs[i].mask & mask)) continue;
      const directional = dirs[i];
      const wtm = directional._node.getWorldTransform();
      if (!this.lightColorId[cnt]) {
        this._resolveLight(scope, cnt);
      }
      this.lightColorId[cnt].setValue(scene.gammaCorrection ? directional._linearFinalColor : directional._finalColor);
      wtm.getY(directional._direction).mulScalar(-1);
      directional._direction.normalize();
      this.lightDir[cnt][0] = directional._direction.x;
      this.lightDir[cnt][1] = directional._direction.y;
      this.lightDir[cnt][2] = directional._direction.z;
      this.lightDirId[cnt].setValue(this.lightDir[cnt]);
      if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
        this.setLTCDirectionalLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
      }
      if (directional.castShadows) {
        const lightRenderData = directional.getRenderData(camera, 0);
        const biases = directional._getUniformBiasValues(lightRenderData);
        this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
        this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
        this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
        this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
        this.shadowCascadeCountId[cnt].setValue(directional.numCascades);
        this.lightShadowIntensity[cnt].setValue(directional.shadowIntensity);
        const projectionCompensation = 50.0 / lightRenderData.projectionCompensation;
        const pixelsPerMeter = directional.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
        this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * projectionCompensation);
        const cameraParams = directional._shadowCameraParams;
        cameraParams.length = 4;
        cameraParams[0] = lightRenderData.depthRangeCompensation;
        cameraParams[1] = lightRenderData.shadowCamera._farClip;
        cameraParams[2] = lightRenderData.shadowCamera._nearClip;
        cameraParams[3] = 1;
        this.lightCameraParamsId[cnt].setValue(cameraParams);
        const params = directional._shadowRenderParams;
        params.length = 4;
        params[0] = directional._shadowResolution;
        params[1] = biases.normalBias;
        params[2] = biases.bias;
        params[3] = 0;
        this.lightShadowParamsId[cnt].setValue(params);
      }
      cnt++;
    }
    return cnt;
  }
  setLTCPositionalLight(wtm, cnt) {
    const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
    this.lightWidth[cnt][0] = hWidth.x;
    this.lightWidth[cnt][1] = hWidth.y;
    this.lightWidth[cnt][2] = hWidth.z;
    this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
    const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
    this.lightHeight[cnt][0] = hHeight.x;
    this.lightHeight[cnt][1] = hHeight.y;
    this.lightHeight[cnt][2] = hHeight.z;
    this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
  }
  dispatchOmniLight(scene, scope, omni, cnt) {
    const wtm = omni._node.getWorldTransform();
    if (!this.lightColorId[cnt]) {
      this._resolveLight(scope, cnt);
    }
    this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
    this.lightColorId[cnt].setValue(scene.gammaCorrection ? omni._linearFinalColor : omni._finalColor);
    wtm.getTranslation(omni._position);
    this.lightPos[cnt][0] = omni._position.x;
    this.lightPos[cnt][1] = omni._position.y;
    this.lightPos[cnt][2] = omni._position.z;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
      this.setLTCPositionalLight(wtm, cnt);
    }
    if (omni.castShadows) {
      const lightRenderData = omni.getRenderData(null, 0);
      this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
      const biases = omni._getUniformBiasValues(lightRenderData);
      const params = omni._shadowRenderParams;
      params.length = 4;
      params[0] = omni._shadowResolution;
      params[1] = biases.normalBias;
      params[2] = biases.bias;
      params[3] = 1.0 / omni.attenuationEnd;
      this.lightShadowParamsId[cnt].setValue(params);
      this.lightShadowIntensity[cnt].setValue(omni.shadowIntensity);
      const pixelsPerMeter = omni.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
      this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter);
      const cameraParams = omni._shadowCameraParams;
      cameraParams.length = 4;
      cameraParams[0] = lightRenderData.depthRangeCompensation;
      cameraParams[1] = lightRenderData.shadowCamera._farClip;
      cameraParams[2] = lightRenderData.shadowCamera._nearClip;
      cameraParams[3] = 0;
      this.lightCameraParamsId[cnt].setValue(cameraParams);
    }
    if (omni._cookie) {
      this.lightCookieId[cnt].setValue(omni._cookie);
      this.lightShadowMatrixId[cnt].setValue(wtm.data);
      this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
    }
  }
  dispatchSpotLight(scene, scope, spot, cnt) {
    const wtm = spot._node.getWorldTransform();
    if (!this.lightColorId[cnt]) {
      this._resolveLight(scope, cnt);
    }
    this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
    this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
    this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
    this.lightColorId[cnt].setValue(scene.gammaCorrection ? spot._linearFinalColor : spot._finalColor);
    wtm.getTranslation(spot._position);
    this.lightPos[cnt][0] = spot._position.x;
    this.lightPos[cnt][1] = spot._position.y;
    this.lightPos[cnt][2] = spot._position.z;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
      this.setLTCPositionalLight(wtm, cnt);
    }
    wtm.getY(spot._direction).mulScalar(-1);
    spot._direction.normalize();
    this.lightDir[cnt][0] = spot._direction.x;
    this.lightDir[cnt][1] = spot._direction.y;
    this.lightDir[cnt][2] = spot._direction.z;
    this.lightDirId[cnt].setValue(this.lightDir[cnt]);
    if (spot.castShadows) {
      const lightRenderData = spot.getRenderData(null, 0);
      this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
      this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
      const biases = spot._getUniformBiasValues(lightRenderData);
      const params = spot._shadowRenderParams;
      params.length = 4;
      params[0] = spot._shadowResolution;
      params[1] = biases.normalBias;
      params[2] = biases.bias;
      params[3] = 1.0 / spot.attenuationEnd;
      this.lightShadowParamsId[cnt].setValue(params);
      this.lightShadowIntensity[cnt].setValue(spot.shadowIntensity);
      const pixelsPerMeter = spot.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
      const fov = lightRenderData.shadowCamera._fov * Math.PI / 180.0;
      const fovRatio = 1.0 / Math.tan(fov / 2.0);
      this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * fovRatio);
      const cameraParams = spot._shadowCameraParams;
      cameraParams.length = 4;
      cameraParams[0] = lightRenderData.depthRangeCompensation;
      cameraParams[1] = lightRenderData.shadowCamera._farClip;
      cameraParams[2] = lightRenderData.shadowCamera._nearClip;
      cameraParams[3] = 0;
      this.lightCameraParamsId[cnt].setValue(cameraParams);
    }
    if (spot._cookie) {
      if (!spot.castShadows) {
        const cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
        this.lightShadowMatrixId[cnt].setValue(cookieMatrix.data);
      }
      this.lightCookieId[cnt].setValue(spot._cookie);
      this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
      if (spot._cookieTransform) {
        spot._cookieTransformUniform[0] = spot._cookieTransform.x;
        spot._cookieTransformUniform[1] = spot._cookieTransform.y;
        spot._cookieTransformUniform[2] = spot._cookieTransform.z;
        spot._cookieTransformUniform[3] = spot._cookieTransform.w;
        this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
        spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
        spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
        this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
      }
    }
  }
  dispatchLocalLights(sortedLights, scene, mask, usedDirLights) {
    let cnt = usedDirLights;
    const scope = this.device.scope;
    const omnis = sortedLights[LIGHTTYPE_OMNI];
    const numOmnis = omnis.length;
    for (let i = 0; i < numOmnis; i++) {
      const omni = omnis[i];
      if (!(omni.mask & mask)) continue;
      this.dispatchOmniLight(scene, scope, omni, cnt);
      cnt++;
    }
    const spts = sortedLights[LIGHTTYPE_SPOT];
    const numSpts = spts.length;
    for (let i = 0; i < numSpts; i++) {
      const spot = spts[i];
      if (!(spot.mask & mask)) continue;
      this.dispatchSpotLight(scene, scope, spot, cnt);
      cnt++;
    }
  }
  renderForwardPrepareMaterials(camera, drawCalls, sortedLights, layer, pass) {
    var _layer$getLightHash;
    const addCall = (drawCall, shaderInstance, isNewMaterial, lightMaskChanged) => {
      _drawCallList.drawCalls.push(drawCall);
      _drawCallList.shaderInstances.push(shaderInstance);
      _drawCallList.isNewMaterial.push(isNewMaterial);
      _drawCallList.lightMaskChanged.push(lightMaskChanged);
    };
    _drawCallList.clear();
    const device = this.device;
    const scene = this.scene;
    const clusteredLightingEnabled = scene.clusteredLightingEnabled;
    const lightHash = (_layer$getLightHash = layer == null ? void 0 : layer.getLightHash(clusteredLightingEnabled)) != null ? _layer$getLightHash : 0;
    let prevMaterial = null,
      prevObjDefs,
      prevLightMask;
    const drawCallsCount = drawCalls.length;
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (camera === ForwardRenderer.skipRenderCamera) {
        if (ForwardRenderer._skipRenderCounter >= ForwardRenderer.skipRenderAfter) continue;
        ForwardRenderer._skipRenderCounter++;
      }
      if (layer) {
        if (layer._skipRenderCounter >= layer.skipRenderAfter) continue;
        layer._skipRenderCounter++;
      }
      drawCall.ensureMaterial(device);
      const material = drawCall.material;
      const objDefs = drawCall._shaderDefs;
      const lightMask = drawCall.mask;
      if (material && material === prevMaterial && objDefs !== prevObjDefs) {
        prevMaterial = null;
      }
      if (material !== prevMaterial) {
        this._materialSwitches++;
        material._scene = scene;
        if (material.dirty) {
          material.updateUniforms(device, scene);
          material.dirty = false;
        }
      }
      const shaderInstance = drawCall.getShaderInstance(pass, lightHash, scene, this.viewUniformFormat, this.viewBindGroupFormat, sortedLights);
      addCall(drawCall, shaderInstance, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
      prevMaterial = material;
      prevObjDefs = objDefs;
      prevLightMask = lightMask;
    }
    device.endShaderBatch == null || device.endShaderBatch();
    return _drawCallList;
  }
  renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
    const device = this.device;
    const scene = this.scene;
    const passFlag = 1 << pass;
    const flipFactor = flipFaces ? -1 : 1;
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    let skipMaterial = false;
    const preparedCallsCount = preparedCalls.drawCalls.length;
    for (let i = 0; i < preparedCallsCount; i++) {
      var _drawCall$stencilFron, _drawCall$stencilBack;
      const drawCall = preparedCalls.drawCalls[i];
      const newMaterial = preparedCalls.isNewMaterial[i];
      const lightMaskChanged = preparedCalls.lightMaskChanged[i];
      const shaderInstance = preparedCalls.shaderInstances[i];
      const material = drawCall.material;
      drawCall._shaderDefs;
      const lightMask = drawCall.mask;
      if (newMaterial) {
        const shader = shaderInstance.shader;
        if (!shader.failed && !device.setShader(shader)) ;
        skipMaterial = shader.failed;
        if (skipMaterial) break;
        material.setParameters(device);
        if (lightMaskChanged) {
          const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
          if (!clusteredLightingEnabled) {
            this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights);
          }
        }
        this.alphaTestId.setValue(material.alphaTest);
        device.setBlendState(material.blendState);
        device.setDepthState(material.depthState);
        device.setAlphaToCoverage(material.alphaToCoverage);
      }
      this.setupCullMode(camera._cullFaces, flipFactor, drawCall);
      const stencilFront = (_drawCall$stencilFron = drawCall.stencilFront) != null ? _drawCall$stencilFron : material.stencilFront;
      const stencilBack = (_drawCall$stencilBack = drawCall.stencilBack) != null ? _drawCall$stencilBack : material.stencilBack;
      device.setStencilState(stencilFront, stencilBack);
      const mesh = drawCall.mesh;
      drawCall.setParameters(device, passFlag);
      this.setVertexBuffers(device, mesh);
      this.setMorphing(device, drawCall.morphInstance);
      this.setSkinning(device, drawCall);
      this.setupMeshUniformBuffers(shaderInstance, drawCall);
      const style = drawCall.renderStyle;
      device.setIndexBuffer(mesh.indexBuffer[style]);
      drawCallback == null || drawCallback(drawCall, i);
      if (camera.xr && camera.xr.session && camera.xr.views.list.length) {
        const views = camera.xr.views;
        for (let v = 0; v < views.list.length; v++) {
          const view = views.list[v];
          device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);
          this.projId.setValue(view.projMat.data);
          this.projSkyboxId.setValue(view.projMat.data);
          this.viewId.setValue(view.viewOffMat.data);
          this.viewInvId.setValue(view.viewInvOffMat.data);
          this.viewId3.setValue(view.viewMat3.data);
          this.viewProjId.setValue(view.projViewOffMat.data);
          this.viewPosId.setValue(view.positionData);
          this.viewIndexId.setValue(v);
          if (v === 0) {
            this.drawInstance(device, drawCall, mesh, style, true);
          } else {
            this.drawInstance2(device, drawCall, mesh, style);
          }
          this._forwardDrawCalls++;
        }
      } else {
        this.drawInstance(device, drawCall, mesh, style, true);
        this._forwardDrawCalls++;
      }
      if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
        material.setParameters(device, drawCall.parameters);
      }
    }
  }
  renderForward(camera, allDrawCalls, sortedLights, pass, drawCallback, layer, flipFaces) {
    const forwardStartTime = now();
    const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, sortedLights, layer, pass);
    this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
    _drawCallList.clear();
    this._forwardTime += now() - forwardStartTime;
  }
  renderForwardLayer(camera, renderTarget, layer, transparent, shaderPass, viewBindGroups, options = {}) {
    var _options$clearColors, _options$clearDepth, _options$clearStencil;
    const {
      scene,
      device
    } = this;
    const clusteredLightingEnabled = scene.clusteredLightingEnabled;
    this.setupViewport(camera, renderTarget);
    const clearColor = (_options$clearColors = options.clearColors) != null ? _options$clearColors : false;
    const clearDepth = (_options$clearDepth = options.clearDepth) != null ? _options$clearDepth : false;
    const clearStencil = (_options$clearStencil = options.clearStencil) != null ? _options$clearStencil : false;
    if (clearColor || clearDepth || clearStencil) {
      this.clear(camera, clearColor, clearDepth, clearStencil);
    }
    let visible, splitLights;
    if (layer) {
      const sortTime = now();
      layer.sortVisible(camera, transparent);
      this._sortTime += now() - sortTime;
      const culledInstances = layer.getCulledInstances(camera);
      visible = transparent ? culledInstances.transparent : culledInstances.opaque;
      scene.immediate.onPreRenderLayer(layer, visible, transparent);
      if (layer.requiresLightCube) {
        this.lightCube.update(scene.ambientLight, layer._lights);
        this.constantLightCube.setValue(this.lightCube.colors);
      }
      splitLights = layer.splitLights;
    } else {
      var _options$splitLights;
      visible = options.meshInstances;
      splitLights = (_options$splitLights = options.splitLights) != null ? _options$splitLights : _noLights;
    }
    if (clusteredLightingEnabled) {
      var _options$lightCluster;
      const lightClusters = (_options$lightCluster = options.lightClusters) != null ? _options$lightCluster : this.worldClustersAllocator.empty;
      lightClusters.activate();
      if (layer) {
        if (!this.clustersDebugRendered && scene.lighting.debugLayer === layer.id) {
          this.clustersDebugRendered = true;
        }
      }
    }
    scene._activeCamera = camera;
    const viewCount = this.setCameraUniforms(camera, renderTarget);
    if (device.supportsUniformBuffers) {
      this.setupViewUniformBuffers(viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
    }
    const flipFaces = !!(camera._flipFaces ^ (renderTarget == null ? void 0 : renderTarget.flipY));
    const forwardDrawCalls = this._forwardDrawCalls;
    this.renderForward(camera, visible, splitLights, shaderPass, layer == null ? void 0 : layer.onDrawCall, layer, flipFaces);
    if (layer) layer._forwardDrawCalls += this._forwardDrawCalls - forwardDrawCalls;
  }
  setSceneConstants() {
    const scene = this.scene;
    this.dispatchGlobalLights(scene);
    if (scene.fog !== FOG_NONE) {
      this.fogColor[0] = scene.fogColor.r;
      this.fogColor[1] = scene.fogColor.g;
      this.fogColor[2] = scene.fogColor.b;
      if (scene.gammaCorrection) {
        for (let i = 0; i < 3; i++) {
          this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
        }
      }
      this.fogColorId.setValue(this.fogColor);
      if (scene.fog === FOG_LINEAR) {
        this.fogStartId.setValue(scene.fogStart);
        this.fogEndId.setValue(scene.fogEnd);
      } else {
        this.fogDensityId.setValue(scene.fogDensity);
      }
    }
    const device = this.device;
    this._screenSize[0] = device.width;
    this._screenSize[1] = device.height;
    this._screenSize[2] = 1 / device.width;
    this._screenSize[3] = 1 / device.height;
    this.screenSizeId.setValue(this._screenSize);
    this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
    this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
  }
  buildFrameGraph(frameGraph, layerComposition) {
    const scene = this.scene;
    const webgl1 = this.device.isWebGL1;
    frameGraph.reset();
    this.update(layerComposition);
    if (scene.clusteredLightingEnabled) {
      const {
        shadowsEnabled,
        cookiesEnabled
      } = scene.lighting;
      this._renderPassUpdateClustered.update(frameGraph, shadowsEnabled, cookiesEnabled, this.lights, this.localLights);
      frameGraph.addRenderPass(this._renderPassUpdateClustered);
    } else {
      this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, this.localLights);
    }
    let startIndex = 0;
    let newStart = true;
    let renderTarget = null;
    const renderActions = layerComposition._renderActions;
    for (let i = startIndex; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const {
        layer,
        camera
      } = renderAction;
      if (renderAction.useCameraPasses) {
        camera.camera.renderPasses.forEach(renderPass => {
          frameGraph.addRenderPass(renderPass);
        });
      } else {
        const depthPass = camera.camera.renderPassDepthGrab;
        if (depthPass && webgl1 && renderAction.firstCameraUse) {
          depthPass.options.resizeSource = camera.camera.renderTarget;
          depthPass.update(this.scene);
          frameGraph.addRenderPass(depthPass);
        }
        const isDepthLayer = layer.id === LAYERID_DEPTH;
        if (webgl1 && isDepthLayer && !camera.renderSceneColorMap) continue;
        const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
        if (newStart) {
          newStart = false;
          startIndex = i;
          renderTarget = renderAction.renderTarget;
        }
        const nextRenderAction = renderActions[i + 1];
        const isNextLayerDepth = nextRenderAction ? nextRenderAction.layer.id === LAYERID_DEPTH : false;
        const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap) && !webgl1;
        const nextNeedDirShadows = nextRenderAction ? nextRenderAction.firstCameraUse && this.cameraDirShadowLights.has(nextRenderAction.camera.camera) : false;
        if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextNeedDirShadows || isNextLayerGrabPass || isGrabPass) {
          const isDepthOnly = isDepthLayer && startIndex === i;
          if (!isDepthOnly) {
            this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i);
          }
          if (isDepthLayer) {
            if (camera.renderSceneColorMap) {
              const colorGrabPass = camera.camera.renderPassColorGrab;
              colorGrabPass.source = camera.renderTarget;
              frameGraph.addRenderPass(colorGrabPass);
            }
            if (camera.renderSceneDepthMap && !webgl1) {
              frameGraph.addRenderPass(camera.camera.renderPassDepthGrab);
            }
          }
          if (renderAction.triggerPostprocess && camera != null && camera.onPostprocessing) {
            const renderPass = new RenderPassPostprocessing(this.device, this, renderAction);
            frameGraph.addRenderPass(renderPass);
          }
          newStart = true;
        }
      }
    }
  }
  addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex) {
    const renderPass = new RenderPassForward(this.device, layerComposition, this.scene, this);
    renderPass.init(renderTarget);
    const renderActions = layerComposition._renderActions;
    for (let i = startIndex; i <= endIndex; i++) {
      renderPass.addRenderAction(renderActions[i]);
    }
    frameGraph.addRenderPass(renderPass);
  }
  update(comp) {
    this.frameUpdate();
    this.shadowRenderer.frameUpdate();
    this.scene._updateSkyMesh();
    this.updateLayerComposition(comp);
    this.collectLights(comp);
    this.beginFrame(comp);
    this.setSceneConstants();
    this.cullComposition(comp);
    this.gpuUpdate(this.processingMeshInstances);
  }
}
ForwardRenderer.skipRenderCamera = null;
ForwardRenderer._skipRenderCounter = 0;
ForwardRenderer.skipRenderAfter = 0;

export { ForwardRenderer };