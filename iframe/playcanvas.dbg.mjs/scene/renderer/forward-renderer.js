import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, LAYERID_DEPTH } from '../constants.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';
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

/**
 * The forward renderer renders {@link Scene}s.
 *
 * @ignore
 */
class ForwardRenderer extends Renderer {
  /**
   * Create a new ForwardRenderer instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device used by the renderer.
   */
  constructor(graphicsDevice) {
    super(graphicsDevice);
    const device = this.device;
    this._forwardDrawCalls = 0;
    this._materialSwitches = 0;
    this._depthMapTime = 0;
    this._forwardTime = 0;
    this._sortTime = 0;

    // Uniforms
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

    // shadow cascades
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

  // Static properties used by the Profiler in the Editor's Launch Page

  /**
   * @param {import('../scene.js').Scene} scene - The scene.
   */
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

    // shadow cascades
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

      // Directional lights shine down the negative Y axis
      wtm.getY(directional._direction).mulScalar(-1);
      directional._direction.normalize();
      this.lightDir[cnt][0] = directional._direction.x;
      this.lightDir[cnt][1] = directional._direction.y;
      this.lightDir[cnt][2] = directional._direction.z;
      this.lightDirId[cnt].setValue(this.lightDir[cnt]);
      if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
        // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
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
        params[0] = directional._shadowResolution; // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
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
      // non-punctual shape
      this.setLTCPositionalLight(wtm, cnt);
    }
    if (omni.castShadows) {
      // shadow map
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
      // non-punctual shape
      this.setLTCPositionalLight(wtm, cnt);
    }

    // Spots shine down the negative Y axis
    wtm.getY(spot._direction).mulScalar(-1);
    spot._direction.normalize();
    this.lightDir[cnt][0] = spot._direction.x;
    this.lightDir[cnt][1] = spot._direction.y;
    this.lightDir[cnt][2] = spot._direction.z;
    this.lightDirId[cnt].setValue(this.lightDir[cnt]);
    if (spot.castShadows) {
      // shadow map
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
      // if shadow is not rendered, we need to evaluate light projection matrix
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

  // execute first pass over draw calls, in order to update materials / shaders
  renderForwardPrepareMaterials(camera, drawCalls, sortedLights, layer, pass) {
    var _layer$getLightHash;
    const addCall = (drawCall, shaderInstance, isNewMaterial, lightMaskChanged) => {
      _drawCallList.drawCalls.push(drawCall);
      _drawCallList.shaderInstances.push(shaderInstance);
      _drawCallList.isNewMaterial.push(isNewMaterial);
      _drawCallList.lightMaskChanged.push(lightMaskChanged);
    };

    // start with empty arrays
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
      /** @type {import('../mesh-instance.js').MeshInstance} */
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
        prevMaterial = null; // force change shader if the object uses a different variant of the same material
      }

      if (material !== prevMaterial) {
        this._materialSwitches++;
        material._scene = scene;
        if (material.dirty) {
          material.updateUniforms(device, scene);
          material.dirty = false;
        }
      }

      // marker to allow us to see the source node for shader alloc
      DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);
      const shaderInstance = drawCall.getShaderInstance(pass, lightHash, scene, this.viewUniformFormat, this.viewBindGroupFormat, sortedLights);
      DebugGraphics.popGpuMarker(device);
      addCall(drawCall, shaderInstance, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
      prevMaterial = material;
      prevObjDefs = objDefs;
      prevLightMask = lightMask;
    }

    // process the batch of shaders created here
    device.endShaderBatch == null || device.endShaderBatch();
    return _drawCallList;
  }
  renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
    const device = this.device;
    const scene = this.scene;
    const passFlag = 1 << pass;
    const flipFactor = flipFaces ? -1 : 1;
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

    // Render the scene
    let skipMaterial = false;
    const preparedCallsCount = preparedCalls.drawCalls.length;
    for (let i = 0; i < preparedCallsCount; i++) {
      var _drawCall$stencilFron, _drawCall$stencilBack;
      const drawCall = preparedCalls.drawCalls[i];

      // We have a mesh instance
      const newMaterial = preparedCalls.isNewMaterial[i];
      const lightMaskChanged = preparedCalls.lightMaskChanged[i];
      const shaderInstance = preparedCalls.shaderInstances[i];
      const material = drawCall.material;
      const objDefs = drawCall._shaderDefs;
      const lightMask = drawCall.mask;
      if (newMaterial) {
        const shader = shaderInstance.shader;
        if (!shader.failed && !device.setShader(shader)) {
          Debug.error(`Error compiling shader [${shader.label}] for material=${material.name} pass=${pass} objDefs=${objDefs}`, material);
        }

        // skip rendering with the material if shader failed
        skipMaterial = shader.failed;
        if (skipMaterial) break;
        DebugGraphics.pushGpuMarker(device, `Material: ${material.name}`);

        // Uniforms I: material
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
        DebugGraphics.popGpuMarker(device);
      }
      DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);
      this.setupCullMode(camera._cullFaces, flipFactor, drawCall);
      const stencilFront = (_drawCall$stencilFron = drawCall.stencilFront) != null ? _drawCall$stencilFron : material.stencilFront;
      const stencilBack = (_drawCall$stencilBack = drawCall.stencilBack) != null ? _drawCall$stencilBack : material.stencilBack;
      device.setStencilState(stencilFront, stencilBack);
      const mesh = drawCall.mesh;

      // Uniforms II: meshInstance overrides
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

      // Unset meshInstance overrides back to material values if next draw call will use the same material
      if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
        material.setParameters(device, drawCall.parameters);
      }
      DebugGraphics.popGpuMarker(device);
    }
  }
  renderForward(camera, allDrawCalls, sortedLights, pass, drawCallback, layer, flipFaces) {
    const forwardStartTime = now();

    // run first pass over draw calls and handle material / shader updates
    const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, sortedLights, layer, pass);

    // render mesh instances
    this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
    _drawCallList.clear();
    this._forwardTime += now() - forwardStartTime;
  }

  /**
   * Forward render mesh instances on a specified layer, using a camera and a render target.
   * Shaders used are based on the shaderPass provided, with optional clustered lighting support.
   *
   * @param {import('../camera.js').Camera} camera - The
   * camera.
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} renderTarget - The
   * render target.
   * @param {import('../layer.js').Layer} layer - The layer.
   * @param {boolean} transparent - True if transparent sublayer should be rendered, opaque
   * otherwise.
   * @param {number} shaderPass - A type of shader to use during rendering.
   * @param {import('../../platform/graphics/bind-group.js').BindGroup[]} viewBindGroups - An array
   * storing the view level bing groups (can be empty array, and this function populates if per
   * view).
   * @param {object} [options] - Object for passing optional arguments.
   * @param {boolean} [options.clearColors] - True if the color buffer should be cleared.
   * @param {boolean} [options.clearDepth] - True if the depth buffer should be cleared.
   * @param {boolean} [options.clearStencil] - True if the stencil buffer should be cleared.
   * @param {import('../lighting/world-clusters.js').WorldClusters} [options.lightClusters] - The
   * world clusters object to be used for clustered lighting.
   * @param {import('../mesh-instance.js').MeshInstance[]} [options.meshInstances] - The mesh
   * instances to be rendered. Use when layer is not provided.
   * @param {object} [options.splitLights] - The split lights to be used for clustered lighting.
   */
  renderForwardLayer(camera, renderTarget, layer, transparent, shaderPass, viewBindGroups, options = {}) {
    var _options$clearColors, _options$clearDepth, _options$clearStencil;
    const {
      scene,
      device
    } = this;
    const clusteredLightingEnabled = scene.clusteredLightingEnabled;
    this.setupViewport(camera, renderTarget);

    // clearing
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

      // add debug mesh instances to visible list
      scene.immediate.onPreRenderLayer(layer, visible, transparent);

      // set up layer uniforms
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
    Debug.assert(visible, 'Either layer or options.meshInstances must be provided');

    // upload clustered lights uniforms
    if (clusteredLightingEnabled) {
      var _options$lightCluster;
      const lightClusters = (_options$lightCluster = options.lightClusters) != null ? _options$lightCluster : this.worldClustersAllocator.empty;
      lightClusters.activate();

      // debug rendering of clusters
      if (layer) {
        if (!this.clustersDebugRendered && scene.lighting.debugLayer === layer.id) {
          this.clustersDebugRendered = true;
          WorldClustersDebug.render(lightClusters, this.scene);
        }
      }
    }

    // Set the not very clever global variable which is only useful when there's just one camera
    scene._activeCamera = camera;
    const viewCount = this.setCameraUniforms(camera, renderTarget);
    if (device.supportsUniformBuffers) {
      this.setupViewUniformBuffers(viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
    }

    // enable flip faces if either the camera has _flipFaces enabled or the render target has flipY enabled
    const flipFaces = !!(camera._flipFaces ^ (renderTarget == null ? void 0 : renderTarget.flipY));
    const forwardDrawCalls = this._forwardDrawCalls;
    this.renderForward(camera, visible, splitLights, shaderPass, layer == null ? void 0 : layer.onDrawCall, layer, flipFaces);
    if (layer) layer._forwardDrawCalls += this._forwardDrawCalls - forwardDrawCalls;
  }
  setSceneConstants() {
    const scene = this.scene;

    // Set up ambient/exposure
    this.dispatchGlobalLights(scene);

    // Set up the fog
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

    // Set up screen size // should be RT size?
    const device = this.device;
    this._screenSize[0] = device.width;
    this._screenSize[1] = device.height;
    this._screenSize[2] = 1 / device.width;
    this._screenSize[3] = 1 / device.height;
    this.screenSizeId.setValue(this._screenSize);
    this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
    this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
  }

  /**
   * Builds a frame graph for the rendering of the whole frame.
   *
   * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame-graph that is built.
   * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
   * layer composition used to build the frame graph.
   * @ignore
   */
  buildFrameGraph(frameGraph, layerComposition) {
    const scene = this.scene;
    const webgl1 = this.device.isWebGL1;
    frameGraph.reset();

    // update composition, cull everything, assign atlas slots for clustered lighting
    this.update(layerComposition);
    if (scene.clusteredLightingEnabled) {
      // clustered lighting passes
      const {
        shadowsEnabled,
        cookiesEnabled
      } = scene.lighting;
      this._renderPassUpdateClustered.update(frameGraph, shadowsEnabled, cookiesEnabled, this.lights, this.localLights);
      frameGraph.addRenderPass(this._renderPassUpdateClustered);
    } else {
      // non-clustered local shadows - these are shared by all cameras (not entirely correctly)
      this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, this.localLights);
    }

    // main passes
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
        // schedule render passes from the camera
        camera.camera.renderPasses.forEach(renderPass => {
          frameGraph.addRenderPass(renderPass);
        });
      } else {
        // on webgl1, depth pass renders ahead of the main camera instead of the middle of the frame
        const depthPass = camera.camera.renderPassDepthGrab;
        if (depthPass && webgl1 && renderAction.firstCameraUse) {
          depthPass.options.resizeSource = camera.camera.renderTarget;
          depthPass.update(this.scene);
          frameGraph.addRenderPass(depthPass);
        }
        const isDepthLayer = layer.id === LAYERID_DEPTH;

        // skip depth layer on webgl1 if color grab pass is not enabled, as depth pass renders ahead of the main camera
        if (webgl1 && isDepthLayer && !camera.renderSceneColorMap) continue;
        const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

        // start of block of render actions rendering to the same render target
        if (newStart) {
          newStart = false;
          startIndex = i;
          renderTarget = renderAction.renderTarget;
        }

        // info about the next render action
        const nextRenderAction = renderActions[i + 1];
        const isNextLayerDepth = nextRenderAction ? nextRenderAction.layer.id === LAYERID_DEPTH : false;
        const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap) && !webgl1;
        const nextNeedDirShadows = nextRenderAction ? nextRenderAction.firstCameraUse && this.cameraDirShadowLights.has(nextRenderAction.camera.camera) : false;

        // end of the block using the same render target if the next render action uses a different render target, or needs directional shadows
        // rendered before it or similar or needs other pass before it.
        if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextNeedDirShadows || isNextLayerGrabPass || isGrabPass) {
          // render the render actions in the range
          const isDepthOnly = isDepthLayer && startIndex === i;
          if (!isDepthOnly) {
            this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i);
          }

          // depth layer triggers grab passes if enabled
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

          // postprocessing
          if (renderAction.triggerPostprocess && camera != null && camera.onPostprocessing) {
            const renderPass = new RenderPassPostprocessing(this.device, this, renderAction);
            frameGraph.addRenderPass(renderPass);
          }
          newStart = true;
        }
      }
    }
  }

  /**
   * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame graph.
   * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
   * layer composition.
   */
  addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex) {
    const renderPass = new RenderPassForward(this.device, layerComposition, this.scene, this);
    renderPass.init(renderTarget);
    const renderActions = layerComposition._renderActions;
    for (let i = startIndex; i <= endIndex; i++) {
      renderPass.addRenderAction(renderActions[i]);
    }
    frameGraph.addRenderPass(renderPass);
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  update(comp) {
    this.frameUpdate();
    this.shadowRenderer.frameUpdate();

    // update the skybox, since this might change _meshInstances
    this.scene._updateSkyMesh();

    // update layer composition
    this.updateLayerComposition(comp);
    this.collectLights(comp);

    // Single per-frame calculations
    this.beginFrame(comp);
    this.setSceneConstants();

    // visibility culling of lights, meshInstances, shadows casters
    // after this the scene culling is done and script callbacks can be called to report which objects are visible
    this.cullComposition(comp);

    // GPU update for visible objects requiring one
    this.gpuUpdate(this.processingMeshInstances);
  }
}
ForwardRenderer.skipRenderCamera = null;
ForwardRenderer._skipRenderCounter = 0;
ForwardRenderer.skipRenderAfter = 0;

export { ForwardRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmltcG9ydCB7XG4gICAgRk9HX05PTkUsIEZPR19MSU5FQVIsXG4gICAgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCxcbiAgICBMQVlFUklEX0RFUFRIXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFJlbmRlcmVyIH0gZnJvbSAnLi9yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4vbGlnaHQtY2FtZXJhLmpzJztcbmltcG9ydCB7IFJlbmRlclBhc3NGb3J3YXJkIH0gZnJvbSAnLi9yZW5kZXItcGFzcy1mb3J3YXJkLmpzJztcbmltcG9ydCB7IFJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyB9IGZyb20gJy4vcmVuZGVyLXBhc3MtcG9zdHByb2Nlc3NpbmcuanMnO1xuXG5jb25zdCBfbm9MaWdodHMgPSBbW10sIFtdLCBbXV07XG5cbmNvbnN0IF9kcmF3Q2FsbExpc3QgPSB7XG4gICAgZHJhd0NhbGxzOiBbXSxcbiAgICBzaGFkZXJJbnN0YW5jZXM6IFtdLFxuICAgIGlzTmV3TWF0ZXJpYWw6IFtdLFxuICAgIGxpZ2h0TWFza0NoYW5nZWQ6IFtdLFxuXG4gICAgY2xlYXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5kcmF3Q2FsbHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5zaGFkZXJJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5pc05ld01hdGVyaWFsLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMubGlnaHRNYXNrQ2hhbmdlZC5sZW5ndGggPSAwO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHZvZ2VsRGlza1ByZWNhbGN1bGF0aW9uU2FtcGxlcyhudW1TYW1wbGVzKSB7XG4gICAgY29uc3Qgc2FtcGxlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGNvbnN0IHIgPSBNYXRoLnNxcnQoaSArIDAuNSkgLyBNYXRoLnNxcnQobnVtU2FtcGxlcyk7XG4gICAgICAgIHNhbXBsZXMucHVzaChyKTtcbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZXM7XG59XG5cbmZ1bmN0aW9uIHZvZ2VsU3BoZXJlUHJlY2FsY3VsYXRpb25TYW1wbGVzKG51bVNhbXBsZXMpIHtcbiAgICBjb25zdCBzYW1wbGVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyBpKyspIHtcbiAgICAgICAgY29uc3Qgd2VpZ2h0ID0gaSAvIG51bVNhbXBsZXM7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IE1hdGguc3FydCgxLjAgLSB3ZWlnaHQgKiB3ZWlnaHQpO1xuICAgICAgICBzYW1wbGVzLnB1c2gocmFkaXVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZXM7XG59XG5cbi8qKlxuICogVGhlIGZvcndhcmQgcmVuZGVyZXIgcmVuZGVycyB7QGxpbmsgU2NlbmV9cy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEZvcndhcmRSZW5kZXJlciBleHRlbmRzIFJlbmRlcmVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRm9yd2FyZFJlbmRlcmVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSByZW5kZXJlci5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICBzdXBlcihncmFwaGljc0RldmljZSk7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsU3dpdGNoZXMgPSAwO1xuICAgICAgICB0aGlzLl9kZXB0aE1hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3NvcnRUaW1lID0gMDtcblxuICAgICAgICAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzY29wZSA9IGRldmljZS5zY29wZTtcblxuICAgICAgICB0aGlzLmZvZ0NvbG9ySWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfY29sb3InKTtcbiAgICAgICAgdGhpcy5mb2dTdGFydElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX3N0YXJ0Jyk7XG4gICAgICAgIHRoaXMuZm9nRW5kSWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfZW5kJyk7XG4gICAgICAgIHRoaXMuZm9nRGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2RlbnNpdHknKTtcblxuICAgICAgICB0aGlzLmFtYmllbnRJZCA9IHNjb3BlLnJlc29sdmUoJ2xpZ2h0X2dsb2JhbEFtYmllbnQnKTtcbiAgICAgICAgdGhpcy5za3lib3hJbnRlbnNpdHlJZCA9IHNjb3BlLnJlc29sdmUoJ3NreWJveEludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmN1YmVNYXBSb3RhdGlvbk1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnY3ViZU1hcFJvdGF0aW9uTWF0cml4Jyk7XG4gICAgICAgIHRoaXMucGNzc0Rpc2tTYW1wbGVzSWQgPSBzY29wZS5yZXNvbHZlKCdwY3NzRGlza1NhbXBsZXNbMF0nKTtcbiAgICAgICAgdGhpcy5wY3NzU3BoZXJlU2FtcGxlc0lkID0gc2NvcGUucmVzb2x2ZSgncGNzc1NwaGVyZVNhbXBsZXNbMF0nKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodERpciA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eSA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFBvcyA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoID0gW107XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dTZWFyY2hBcmVhSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENhbWVyYVBhcmFtc0lkID0gW107XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWQgPSBbXTtcblxuICAgICAgICB0aGlzLnNjcmVlblNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3VTY3JlZW5TaXplJyk7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemUgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIHRoaXMuZm9nQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5wY3NzRGlza1NhbXBsZXMgPSB2b2dlbERpc2tQcmVjYWxjdWxhdGlvblNhbXBsZXMoMTYpO1xuICAgICAgICB0aGlzLnBjc3NTcGhlcmVTYW1wbGVzID0gdm9nZWxTcGhlcmVQcmVjYWxjdWxhdGlvblNhbXBsZXMoMTYpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgLy8gU3RhdGljIHByb3BlcnRpZXMgdXNlZCBieSB0aGUgUHJvZmlsZXIgaW4gdGhlIEVkaXRvcidzIExhdW5jaCBQYWdlXG4gICAgc3RhdGljIHNraXBSZW5kZXJDYW1lcmEgPSBudWxsO1xuXG4gICAgc3RhdGljIF9za2lwUmVuZGVyQ291bnRlciA9IDA7XG5cbiAgICBzdGF0aWMgc2tpcFJlbmRlckFmdGVyID0gMDtcbiAgICAvLyAjZW5kaWZcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKi9cbiAgICBkaXNwYXRjaEdsb2JhbExpZ2h0cyhzY2VuZSkge1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclswXSA9IHNjZW5lLmFtYmllbnRMaWdodC5yO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsxXSA9IHNjZW5lLmFtYmllbnRMaWdodC5nO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsyXSA9IHNjZW5lLmFtYmllbnRMaWdodC5iO1xuICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldID0gTWF0aC5wb3codGhpcy5hbWJpZW50Q29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNjZW5lLnBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbaV0gKj0gc2NlbmUuYW1iaWVudEx1bWluYW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFtYmllbnRJZC5zZXRWYWx1ZSh0aGlzLmFtYmllbnRDb2xvcik7XG5cbiAgICAgICAgdGhpcy5za3lib3hJbnRlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5waHlzaWNhbFVuaXRzID8gc2NlbmUuc2t5Ym94THVtaW5hbmNlIDogc2NlbmUuc2t5Ym94SW50ZW5zaXR5KTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZC5zZXRWYWx1ZShzY2VuZS5fc2t5Ym94Um90YXRpb25NYXQzLmRhdGEpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlTGlnaHQoc2NvcGUsIGkpIHtcbiAgICAgICAgY29uc3QgbGlnaHQgPSAnbGlnaHQnICsgaTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb2xvcicpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodERpcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfZGlyZWN0aW9uJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hcCcpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93UGFyYW1zJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1NlYXJjaEFyZWFJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd1NlYXJjaEFyZWEnKTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcmFkaXVzJyk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZXaWR0aCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaGFsZkhlaWdodCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaW5uZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19vdXRlckNvbmVBbmdsZScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llSW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZU1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVPZmZzZXQnKTtcbiAgICAgICAgdGhpcy5saWdodENhbWVyYVBhcmFtc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY2FtZXJhUGFyYW1zJyk7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4UGFsZXR0ZVswXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVDb3VudCcpO1xuICAgIH1cblxuICAgIHNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpciwgY2FtcG9zLCBmYXIpIHtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gY2FtcG9zLnggLSBkaXIueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gY2FtcG9zLnkgLSBkaXIueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gY2FtcG9zLnogLSBkaXIueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGgueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0LnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hEaXJlY3RMaWdodHMoZGlycywgc2NlbmUsIG1hc2ssIGNhbWVyYSkge1xuICAgICAgICBsZXQgY250ID0gMDtcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCEoZGlyc1tpXS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBkaXJlY3Rpb25hbCA9IGRpcnNbaV07XG4gICAgICAgICAgICBjb25zdCB3dG0gPSBkaXJlY3Rpb25hbC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gZGlyZWN0aW9uYWwuX2xpbmVhckZpbmFsQ29sb3IgOiBkaXJlY3Rpb25hbC5fZmluYWxDb2xvcik7XG5cbiAgICAgICAgICAgIC8vIERpcmVjdGlvbmFsIGxpZ2h0cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgICAgIHd0bS5nZXRZKGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi54O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi55O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi56O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlIC0gTkIgZGlyZWN0aW9uYWwgYXJlYSBsaWdodCBzcGVjdWxhciBpcyBhcHByb3hpbWF0ZWQgYnkgcHV0dGluZyB0aGUgYXJlYSBsaWdodCBhdCB0aGUgZmFyIGNsaXBcbiAgICAgICAgICAgICAgICB0aGlzLnNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24sIGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpLCBjYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gZGlyZWN0aW9uYWwuZ2V0UmVuZGVyRGF0YShjYW1lcmEsIDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IGRpcmVjdGlvbmFsLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd01hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5udW1DYXNjYWRlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0aW9uQ29tcGVuc2F0aW9uID0gKDUwLjAgLyBsaWdodFJlbmRlckRhdGEucHJvamVjdGlvbkNvbXBlbnNhdGlvbik7XG4gICAgICAgICAgICAgICAgY29uc3QgcGl4ZWxzUGVyTWV0ZXIgPSBkaXJlY3Rpb25hbC5wZW51bWJyYVNpemUgLyBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLnJlbmRlclRhcmdldC53aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93U2VhcmNoQXJlYUlkW2NudF0uc2V0VmFsdWUocGl4ZWxzUGVyTWV0ZXIgKiBwcm9qZWN0aW9uQ29tcGVuc2F0aW9uKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhcmFtcyA9IGRpcmVjdGlvbmFsLl9zaGFkb3dDYW1lcmFQYXJhbXM7XG4gICAgICAgICAgICAgICAgY2FtZXJhUGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzBdID0gbGlnaHRSZW5kZXJEYXRhLmRlcHRoUmFuZ2VDb21wZW5zYXRpb247XG4gICAgICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzFdID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5fZmFyQ2xpcDtcbiAgICAgICAgICAgICAgICBjYW1lcmFQYXJhbXNbMl0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgICAgICAgICBjYW1lcmFQYXJhbXNbM10gPSAxO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDYW1lcmFQYXJhbXNJZFtjbnRdLnNldFZhbHVlKGNhbWVyYVBhcmFtcyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgICAgIHBhcmFtc1swXSA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZXNvbHV0aW9uOyAgLy8gTm90ZTogdGhpcyBuZWVkcyB0byBjaGFuZ2UgZm9yIG5vbi1zcXVhcmUgc2hhZG93IG1hcHMgKDIgY2FzY2FkZXMpLiBDdXJyZW50bHkgc3F1YXJlIGlzIHVzZWRcbiAgICAgICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgICAgICBwYXJhbXNbM10gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY250O1xuICAgIH1cblxuICAgIHNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCkge1xuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueDtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGguejtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueDtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0Lno7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gb21uaS5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2NudF0uc2V0VmFsdWUob21uaS5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gb21uaS5fbGluZWFyRmluYWxDb2xvciA6IG9tbmkuX2ZpbmFsQ29sb3IpO1xuICAgICAgICB3dG0uZ2V0VHJhbnNsYXRpb24ob21uaS5fcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBvbW5pLl9wb3NpdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBvbW5pLl9wb3NpdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBvbW5pLl9wb3NpdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGlmIChvbW5pLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGVcbiAgICAgICAgICAgIHRoaXMuc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvbW5pLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IG9tbmkuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBvbW5pLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gb21uaS5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBvbW5pLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIG9tbmkuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKG9tbmkuc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAgICAgY29uc3QgcGl4ZWxzUGVyTWV0ZXIgPSBvbW5pLnBlbnVtYnJhU2l6ZSAvIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0LndpZHRoO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1NlYXJjaEFyZWFJZFtjbnRdLnNldFZhbHVlKHBpeGVsc1Blck1ldGVyKTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhcmFtcyA9IG9tbmkuX3NoYWRvd0NhbWVyYVBhcmFtcztcblxuICAgICAgICAgICAgY2FtZXJhUGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMF0gPSBsaWdodFJlbmRlckRhdGEuZGVwdGhSYW5nZUNvbXBlbnNhdGlvbjtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1sxXSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMl0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1szXSA9IDA7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q2FtZXJhUGFyYW1zSWRbY250XS5zZXRWYWx1ZShjYW1lcmFQYXJhbXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvbW5pLl9jb29raWUpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKG9tbmkuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZSh3dG0uZGF0YSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShvbW5pLmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFNwb3RMaWdodChzY2VuZSwgc2NvcGUsIHNwb3QsIGNudCkge1xuICAgICAgICBjb25zdCB3dG0gPSBzcG90Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5faW5uZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX291dGVyQ29uZUFuZ2xlQ29zKTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2NudF0uc2V0VmFsdWUoc3BvdC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gc3BvdC5fbGluZWFyRmluYWxDb2xvciA6IHNwb3QuX2ZpbmFsQ29sb3IpO1xuICAgICAgICB3dG0uZ2V0VHJhbnNsYXRpb24oc3BvdC5fcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBzcG90Ll9wb3NpdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBzcG90Ll9wb3NpdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBzcG90Ll9wb3NpdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGVcbiAgICAgICAgICAgIHRoaXMuc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwb3RzIHNoaW5lIGRvd24gdGhlIG5lZ2F0aXZlIFkgYXhpc1xuICAgICAgICB3dG0uZ2V0WShzcG90Ll9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgIHNwb3QuX2RpcmVjdGlvbi5ub3JtYWxpemUoKTtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gc3BvdC5fZGlyZWN0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsxXSA9IHNwb3QuX2RpcmVjdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMl0gPSBzcG90Ll9kaXJlY3Rpb24uejtcbiAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICBpZiAoc3BvdC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBzcG90LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gc3BvdC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHNwb3QuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gc3BvdC5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBzcG90LmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShzcG90LnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHBpeGVsc1Blck1ldGVyID0gc3BvdC5wZW51bWJyYVNpemUgLyBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLnJlbmRlclRhcmdldC53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGZvdiA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZvdiAqIE1hdGguUEkgLyAxODAuMDtcbiAgICAgICAgICAgIGNvbnN0IGZvdlJhdGlvID0gMS4wIC8gTWF0aC50YW4oZm92IC8gMi4wKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dTZWFyY2hBcmVhSWRbY250XS5zZXRWYWx1ZShwaXhlbHNQZXJNZXRlciAqIGZvdlJhdGlvKTtcblxuICAgICAgICAgICAgY29uc3QgY2FtZXJhUGFyYW1zID0gc3BvdC5fc2hhZG93Q2FtZXJhUGFyYW1zO1xuICAgICAgICAgICAgY2FtZXJhUGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMF0gPSBsaWdodFJlbmRlckRhdGEuZGVwdGhSYW5nZUNvbXBlbnNhdGlvbjtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1sxXSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMl0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1szXSA9IDA7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q2FtZXJhUGFyYW1zSWRbY250XS5zZXRWYWx1ZShjYW1lcmFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZSkge1xuXG4gICAgICAgICAgICAvLyBpZiBzaGFkb3cgaXMgbm90IHJlbmRlcmVkLCB3ZSBuZWVkIHRvIGV2YWx1YXRlIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAoIXNwb3QuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29raWVNYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChzcG90KTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShjb29raWVNYXRyaXguZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShzcG90LmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgICAgICBpZiAoc3BvdC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVswXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS54O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMV0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzJdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLno7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVszXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS53O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVPZmZzZXQueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzFdID0gc3BvdC5fY29va2llT2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIG1hc2ssIHVzZWREaXJMaWdodHMpIHtcblxuICAgICAgICBsZXQgY250ID0gdXNlZERpckxpZ2h0cztcbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBjb25zdCBvbW5pcyA9IHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfT01OSV07XG4gICAgICAgIGNvbnN0IG51bU9tbmlzID0gb21uaXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU9tbmlzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9tbmkgPSBvbW5pc1tpXTtcbiAgICAgICAgICAgIGlmICghKG9tbmkubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcHRzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9TUE9UXTtcbiAgICAgICAgY29uc3QgbnVtU3B0cyA9IHNwdHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNwdHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3BvdCA9IHNwdHNbaV07XG4gICAgICAgICAgICBpZiAoIShzcG90Lm1hc2sgJiBtYXNrKSkgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZSBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscywgaW4gb3JkZXIgdG8gdXBkYXRlIG1hdGVyaWFscyAvIHNoYWRlcnNcbiAgICByZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGRyYXdDYWxscywgc29ydGVkTGlnaHRzLCBsYXllciwgcGFzcykge1xuXG4gICAgICAgIGNvbnN0IGFkZENhbGwgPSAoZHJhd0NhbGwsIHNoYWRlckluc3RhbmNlLCBpc05ld01hdGVyaWFsLCBsaWdodE1hc2tDaGFuZ2VkKSA9PiB7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmRyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3Quc2hhZGVySW5zdGFuY2VzLnB1c2goc2hhZGVySW5zdGFuY2UpO1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5pc05ld01hdGVyaWFsLnB1c2goaXNOZXdNYXRlcmlhbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQucHVzaChsaWdodE1hc2tDaGFuZ2VkKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzdGFydCB3aXRoIGVtcHR5IGFycmF5c1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmNsZWFyKCk7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBsaWdodEhhc2ggPSBsYXllcj8uZ2V0TGlnaHRIYXNoKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkgPz8gMDtcbiAgICAgICAgbGV0IHByZXZNYXRlcmlhbCA9IG51bGwsIHByZXZPYmpEZWZzLCBwcmV2TGlnaHRNYXNrO1xuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSAqL1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGlmIChjYW1lcmEgPT09IEZvcndhcmRSZW5kZXJlci5za2lwUmVuZGVyQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgaWYgKEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9za2lwUmVuZGVyQ291bnRlciA+PSBsYXllci5za2lwUmVuZGVyQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9za2lwUmVuZGVyQ291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGRyYXdDYWxsLmVuc3VyZU1hdGVyaWFsKGRldmljZSk7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICBjb25zdCBsaWdodE1hc2sgPSBkcmF3Q2FsbC5tYXNrO1xuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwgJiYgbWF0ZXJpYWwgPT09IHByZXZNYXRlcmlhbCAmJiBvYmpEZWZzICE9PSBwcmV2T2JqRGVmcykge1xuICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7IC8vIGZvcmNlIGNoYW5nZSBzaGFkZXIgaWYgdGhlIG9iamVjdCB1c2VzIGEgZGlmZmVyZW50IHZhcmlhbnQgb2YgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1hdGVyaWFsICE9PSBwcmV2TWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzKys7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuX3NjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlVW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBtYXJrZXIgdG8gYWxsb3cgdXMgdG8gc2VlIHRoZSBzb3VyY2Ugbm9kZSBmb3Igc2hhZGVyIGFsbG9jXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgTm9kZTogJHtkcmF3Q2FsbC5ub2RlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlckluc3RhbmNlID0gZHJhd0NhbGwuZ2V0U2hhZGVySW5zdGFuY2UocGFzcywgbGlnaHRIYXNoLCBzY2VuZSwgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0LCBzb3J0ZWRMaWdodHMpO1xuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuXG4gICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBzaGFkZXJJbnN0YW5jZSwgbWF0ZXJpYWwgIT09IHByZXZNYXRlcmlhbCwgIXByZXZNYXRlcmlhbCB8fCBsaWdodE1hc2sgIT09IHByZXZMaWdodE1hc2spO1xuXG4gICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgIHByZXZPYmpEZWZzID0gb2JqRGVmcztcbiAgICAgICAgICAgIHByZXZMaWdodE1hc2sgPSBsaWdodE1hc2s7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9jZXNzIHRoZSBiYXRjaCBvZiBzaGFkZXJzIGNyZWF0ZWQgaGVyZVxuICAgICAgICBkZXZpY2UuZW5kU2hhZGVyQmF0Y2g/LigpO1xuXG4gICAgICAgIHJldHVybiBfZHJhd0NhbGxMaXN0O1xuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWcgPSAxIDw8IHBhc3M7XG4gICAgICAgIGNvbnN0IGZsaXBGYWN0b3IgPSBmbGlwRmFjZXMgPyAtMSA6IDE7XG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIFJlbmRlciB0aGUgc2NlbmVcbiAgICAgICAgbGV0IHNraXBNYXRlcmlhbCA9IGZhbHNlO1xuICAgICAgICBjb25zdCBwcmVwYXJlZENhbGxzQ291bnQgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlcGFyZWRDYWxsc0NvdW50OyBpKyspIHtcblxuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxsc1tpXTtcblxuICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIGNvbnN0IG5ld01hdGVyaWFsID0gcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2ldO1xuICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrQ2hhbmdlZCA9IHByZXBhcmVkQ2FsbHMubGlnaHRNYXNrQ2hhbmdlZFtpXTtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlckluc3RhbmNlID0gcHJlcGFyZWRDYWxscy5zaGFkZXJJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuICAgICAgICAgICAgY29uc3Qgb2JqRGVmcyA9IGRyYXdDYWxsLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgaWYgKG5ld01hdGVyaWFsKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBzaGFkZXJJbnN0YW5jZS5zaGFkZXI7XG4gICAgICAgICAgICAgICAgaWYgKCFzaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEVycm9yIGNvbXBpbGluZyBzaGFkZXIgWyR7c2hhZGVyLmxhYmVsfV0gZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3Bhc3N9IG9iakRlZnM9JHtvYmpEZWZzfWAsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHJlbmRlcmluZyB3aXRoIHRoZSBtYXRlcmlhbCBpZiBzaGFkZXIgZmFpbGVkXG4gICAgICAgICAgICAgICAgc2tpcE1hdGVyaWFsID0gc2hhZGVyLmZhaWxlZDtcbiAgICAgICAgICAgICAgICBpZiAoc2tpcE1hdGVyaWFsKVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBNYXRlcmlhbDogJHttYXRlcmlhbC5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRNYXNrQ2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkRGlyTGlnaHRzID0gdGhpcy5kaXNwYXRjaERpcmVjdExpZ2h0cyhzb3J0ZWRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgc2NlbmUsIGxpZ2h0TWFzaywgY2FtZXJhKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIGxpZ2h0TWFzaywgdXNlZERpckxpZ2h0cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG5cbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShtYXRlcmlhbC5ibGVuZFN0YXRlKTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShtYXRlcmlhbC5kZXB0aFN0YXRlKTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZSk7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgTm9kZTogJHtkcmF3Q2FsbC5ub2RlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBDdWxsTW9kZShjYW1lcmEuX2N1bGxGYWNlcywgZmxpcEZhY3RvciwgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICBjb25zdCBzdGVuY2lsRnJvbnQgPSBkcmF3Q2FsbC5zdGVuY2lsRnJvbnQgPz8gbWF0ZXJpYWwuc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgY29uc3Qgc3RlbmNpbEJhY2sgPSBkcmF3Q2FsbC5zdGVuY2lsQmFjayA/PyBtYXRlcmlhbC5zdGVuY2lsQmFjaztcbiAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjayk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBkcmF3Q2FsbC5tZXNoO1xuXG4gICAgICAgICAgICAvLyBVbmlmb3JtcyBJSTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgZHJhd0NhbGwuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFnKTtcblxuICAgICAgICAgICAgdGhpcy5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICB0aGlzLnNldE1vcnBoaW5nKGRldmljZSwgZHJhd0NhbGwubW9ycGhJbnN0YW5jZSk7XG4gICAgICAgICAgICB0aGlzLnNldFNraW5uaW5nKGRldmljZSwgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICB0aGlzLnNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKHNoYWRlckluc3RhbmNlLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gZHJhd0NhbGwucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICBkcmF3Q2FsbGJhY2s/LihkcmF3Q2FsbCwgaSk7XG5cbiAgICAgICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24gJiYgY2FtZXJhLnhyLnZpZXdzLmxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdzLmxpc3QubGVuZ3RoOyB2KyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzLmxpc3Rbdl07XG5cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZpZXdwb3J0KHZpZXcudmlld3BvcnQueCwgdmlldy52aWV3cG9ydC55LCB2aWV3LnZpZXdwb3J0LnosIHZpZXcudmlld3BvcnQudyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXcudmlld09mZk1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlldy52aWV3SW52T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZDMuc2V0VmFsdWUodmlldy52aWV3TWF0My5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXcucHJvalZpZXdPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZpZXcucG9zaXRpb25EYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW5kZXhJZC5zZXRWYWx1ZSh2KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UyKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZHJhd0luc3RhbmNlKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFVuc2V0IG1lc2hJbnN0YW5jZSBvdmVycmlkZXMgYmFjayB0byBtYXRlcmlhbCB2YWx1ZXMgaWYgbmV4dCBkcmF3IGNhbGwgd2lsbCB1c2UgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgIGlmIChpIDwgcHJlcGFyZWRDYWxsc0NvdW50IC0gMSAmJiAhcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2kgKyAxXSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBkcmF3Q2FsbC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmQoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBsYXllciwgZmxpcEZhY2VzKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBmb3J3YXJkU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJ1biBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscyBhbmQgaGFuZGxlIG1hdGVyaWFsIC8gc2hhZGVyIHVwZGF0ZXNcbiAgICAgICAgY29uc3QgcHJlcGFyZWRDYWxscyA9IHRoaXMucmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIHNvcnRlZExpZ2h0cywgbGF5ZXIsIHBhc3MpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpO1xuXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuY2xlYXIoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2ZvcndhcmRUaW1lICs9IG5vdygpIC0gZm9yd2FyZFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yd2FyZCByZW5kZXIgbWVzaCBpbnN0YW5jZXMgb24gYSBzcGVjaWZpZWQgbGF5ZXIsIHVzaW5nIGEgY2FtZXJhIGFuZCBhIHJlbmRlciB0YXJnZXQuXG4gICAgICogU2hhZGVycyB1c2VkIGFyZSBiYXNlZCBvbiB0aGUgc2hhZGVyUGFzcyBwcm92aWRlZCwgd2l0aCBvcHRpb25hbCBjbHVzdGVyZWQgbGlnaHRpbmcgc3VwcG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZVxuICAgICAqIGNhbWVyYS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcmVuZGVyVGFyZ2V0IC0gVGhlXG4gICAgICogcmVuZGVyIHRhcmdldC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc3BhcmVudCAtIFRydWUgaWYgdHJhbnNwYXJlbnQgc3VibGF5ZXIgc2hvdWxkIGJlIHJlbmRlcmVkLCBvcGFxdWVcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNoYWRlclBhc3MgLSBBIHR5cGUgb2Ygc2hhZGVyIHRvIHVzZSBkdXJpbmcgcmVuZGVyaW5nLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLmpzJykuQmluZEdyb3VwW119IHZpZXdCaW5kR3JvdXBzIC0gQW4gYXJyYXlcbiAgICAgKiBzdG9yaW5nIHRoZSB2aWV3IGxldmVsIGJpbmcgZ3JvdXBzIChjYW4gYmUgZW1wdHkgYXJyYXksIGFuZCB0aGlzIGZ1bmN0aW9uIHBvcHVsYXRlcyBpZiBwZXJcbiAgICAgKiB2aWV3KS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNsZWFyQ29sb3JzXSAtIFRydWUgaWYgdGhlIGNvbG9yIGJ1ZmZlciBzaG91bGQgYmUgY2xlYXJlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNsZWFyRGVwdGhdIC0gVHJ1ZSBpZiB0aGUgZGVwdGggYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2xlYXJTdGVuY2lsXSAtIFRydWUgaWYgdGhlIHN0ZW5jaWwgYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcycpLldvcmxkQ2x1c3RlcnN9IFtvcHRpb25zLmxpZ2h0Q2x1c3RlcnNdIC0gVGhlXG4gICAgICogd29ybGQgY2x1c3RlcnMgb2JqZWN0IHRvIGJlIHVzZWQgZm9yIGNsdXN0ZXJlZCBsaWdodGluZy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBbb3B0aW9ucy5tZXNoSW5zdGFuY2VzXSAtIFRoZSBtZXNoXG4gICAgICogaW5zdGFuY2VzIHRvIGJlIHJlbmRlcmVkLiBVc2Ugd2hlbiBsYXllciBpcyBub3QgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLnNwbGl0TGlnaHRzXSAtIFRoZSBzcGxpdCBsaWdodHMgdG8gYmUgdXNlZCBmb3IgY2x1c3RlcmVkIGxpZ2h0aW5nLlxuICAgICAqL1xuICAgIHJlbmRlckZvcndhcmRMYXllcihjYW1lcmEsIHJlbmRlclRhcmdldCwgbGF5ZXIsIHRyYW5zcGFyZW50LCBzaGFkZXJQYXNzLCB2aWV3QmluZEdyb3Vwcywgb3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgICAgY29uc3QgeyBzY2VuZSwgZGV2aWNlIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSBzY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYSwgcmVuZGVyVGFyZ2V0KTtcblxuICAgICAgICAvLyBjbGVhcmluZ1xuICAgICAgICBjb25zdCBjbGVhckNvbG9yID0gb3B0aW9ucy5jbGVhckNvbG9ycyA/PyBmYWxzZTtcbiAgICAgICAgY29uc3QgY2xlYXJEZXB0aCA9IG9wdGlvbnMuY2xlYXJEZXB0aCA/PyBmYWxzZTtcbiAgICAgICAgY29uc3QgY2xlYXJTdGVuY2lsID0gb3B0aW9ucy5jbGVhclN0ZW5jaWwgPz8gZmFsc2U7XG4gICAgICAgIGlmIChjbGVhckNvbG9yIHx8IGNsZWFyRGVwdGggfHwgY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyKGNhbWVyYSwgY2xlYXJDb2xvciwgY2xlYXJEZXB0aCwgY2xlYXJTdGVuY2lsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB2aXNpYmxlLCBzcGxpdExpZ2h0cztcbiAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzb3J0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLnNvcnRWaXNpYmxlKGNhbWVyYSwgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLl9zb3J0VGltZSArPSBub3coKSAtIHNvcnRUaW1lO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGNvbnN0IGN1bGxlZEluc3RhbmNlcyA9IGxheWVyLmdldEN1bGxlZEluc3RhbmNlcyhjYW1lcmEpO1xuICAgICAgICAgICAgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gY3VsbGVkSW5zdGFuY2VzLnRyYW5zcGFyZW50IDogY3VsbGVkSW5zdGFuY2VzLm9wYXF1ZTtcblxuICAgICAgICAgICAgLy8gYWRkIGRlYnVnIG1lc2ggaW5zdGFuY2VzIHRvIHZpc2libGUgbGlzdFxuICAgICAgICAgICAgc2NlbmUuaW1tZWRpYXRlLm9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGUsIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gc2V0IHVwIGxheWVyIHVuaWZvcm1zXG4gICAgICAgICAgICBpZiAobGF5ZXIucmVxdWlyZXNMaWdodEN1YmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q3ViZS51cGRhdGUoc2NlbmUuYW1iaWVudExpZ2h0LCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50TGlnaHRDdWJlLnNldFZhbHVlKHRoaXMubGlnaHRDdWJlLmNvbG9ycyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNwbGl0TGlnaHRzID0gbGF5ZXIuc3BsaXRMaWdodHM7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZpc2libGUgPSBvcHRpb25zLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBzcGxpdExpZ2h0cyA9IG9wdGlvbnMuc3BsaXRMaWdodHMgPz8gX25vTGlnaHRzO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHZpc2libGUsICdFaXRoZXIgbGF5ZXIgb3Igb3B0aW9ucy5tZXNoSW5zdGFuY2VzIG11c3QgYmUgcHJvdmlkZWQnKTtcblxuICAgICAgICAvLyB1cGxvYWQgY2x1c3RlcmVkIGxpZ2h0cyB1bmlmb3Jtc1xuICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodENsdXN0ZXJzID0gb3B0aW9ucy5saWdodENsdXN0ZXJzID8/IHRoaXMud29ybGRDbHVzdGVyc0FsbG9jYXRvci5lbXB0eTtcbiAgICAgICAgICAgIGxpZ2h0Q2x1c3RlcnMuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgLy8gZGVidWcgcmVuZGVyaW5nIG9mIGNsdXN0ZXJzXG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkICYmIHNjZW5lLmxpZ2h0aW5nLmRlYnVnTGF5ZXIgPT09IGxheWVyLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgV29ybGRDbHVzdGVyc0RlYnVnLnJlbmRlcihsaWdodENsdXN0ZXJzLCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdGhlIG5vdCB2ZXJ5IGNsZXZlciBnbG9iYWwgdmFyaWFibGUgd2hpY2ggaXMgb25seSB1c2VmdWwgd2hlbiB0aGVyZSdzIGp1c3Qgb25lIGNhbWVyYVxuICAgICAgICBzY2VuZS5fYWN0aXZlQ2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIGNvbnN0IHZpZXdDb3VudCA9IHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCByZW5kZXJUYXJnZXQpO1xuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnModmlld0JpbmRHcm91cHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCwgdmlld0NvdW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuYWJsZSBmbGlwIGZhY2VzIGlmIGVpdGhlciB0aGUgY2FtZXJhIGhhcyBfZmxpcEZhY2VzIGVuYWJsZWQgb3IgdGhlIHJlbmRlciB0YXJnZXQgaGFzIGZsaXBZIGVuYWJsZWRcbiAgICAgICAgY29uc3QgZmxpcEZhY2VzID0gISEoY2FtZXJhLl9mbGlwRmFjZXMgXiByZW5kZXJUYXJnZXQ/LmZsaXBZKTtcblxuICAgICAgICBjb25zdCBmb3J3YXJkRHJhd0NhbGxzID0gdGhpcy5fZm9yd2FyZERyYXdDYWxscztcbiAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkKGNhbWVyYSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpdExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlclBhc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllcj8ub25EcmF3Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzKTtcblxuICAgICAgICBpZiAobGF5ZXIpXG4gICAgICAgICAgICBsYXllci5fZm9yd2FyZERyYXdDYWxscyArPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzIC0gZm9yd2FyZERyYXdDYWxscztcbiAgICB9XG5cbiAgICBzZXRTY2VuZUNvbnN0YW50cygpIHtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuXG4gICAgICAgIC8vIFNldCB1cCBhbWJpZW50L2V4cG9zdXJlXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpO1xuXG4gICAgICAgIC8vIFNldCB1cCB0aGUgZm9nXG4gICAgICAgIGlmIChzY2VuZS5mb2cgIT09IEZPR19OT05FKSB7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzBdID0gc2NlbmUuZm9nQ29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMV0gPSBzY2VuZS5mb2dDb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclsyXSA9IHNjZW5lLmZvZ0NvbG9yLmI7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2dDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuZm9nQ29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5mb2dDb2xvcklkLnNldFZhbHVlKHRoaXMuZm9nQ29sb3IpO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmZvZyA9PT0gRk9HX0xJTkVBUikge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nU3RhcnRJZC5zZXRWYWx1ZShzY2VuZS5mb2dTdGFydCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dFbmRJZC5zZXRWYWx1ZShzY2VuZS5mb2dFbmQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5mb2dEZW5zaXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB1cCBzY3JlZW4gc2l6ZSAvLyBzaG91bGQgYmUgUlQgc2l6ZT9cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMF0gPSBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMV0gPSBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzJdID0gMSAvIGRldmljZS53aWR0aDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVszXSA9IDEgLyBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLnNjcmVlblNpemVJZC5zZXRWYWx1ZSh0aGlzLl9zY3JlZW5TaXplKTtcblxuICAgICAgICB0aGlzLnBjc3NEaXNrU2FtcGxlc0lkLnNldFZhbHVlKHRoaXMucGNzc0Rpc2tTYW1wbGVzKTtcbiAgICAgICAgdGhpcy5wY3NzU3BoZXJlU2FtcGxlc0lkLnNldFZhbHVlKHRoaXMucGNzc1NwaGVyZVNhbXBsZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJ1aWxkcyBhIGZyYW1lIGdyYXBoIGZvciB0aGUgcmVuZGVyaW5nIG9mIHRoZSB3aG9sZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZS1ncmFwaC5qcycpLkZyYW1lR3JhcGh9IGZyYW1lR3JhcGggLSBUaGUgZnJhbWUtZ3JhcGggdGhhdCBpcyBidWlsdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlXG4gICAgICogbGF5ZXIgY29tcG9zaXRpb24gdXNlZCB0byBidWlsZCB0aGUgZnJhbWUgZ3JhcGguXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJ1aWxkRnJhbWVHcmFwaChmcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCB3ZWJnbDEgPSB0aGlzLmRldmljZS5pc1dlYkdMMTtcbiAgICAgICAgZnJhbWVHcmFwaC5yZXNldCgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBjb21wb3NpdGlvbiwgY3VsbCBldmVyeXRoaW5nLCBhc3NpZ24gYXRsYXMgc2xvdHMgZm9yIGNsdXN0ZXJlZCBsaWdodGluZ1xuICAgICAgICB0aGlzLnVwZGF0ZShsYXllckNvbXBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZyBwYXNzZXNcbiAgICAgICAgICAgIGNvbnN0IHsgc2hhZG93c0VuYWJsZWQsIGNvb2tpZXNFbmFibGVkIH0gPSBzY2VuZS5saWdodGluZztcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlclBhc3NVcGRhdGVDbHVzdGVyZWQudXBkYXRlKGZyYW1lR3JhcGgsIHNoYWRvd3NFbmFibGVkLCBjb29raWVzRW5hYmxlZCwgdGhpcy5saWdodHMsIHRoaXMubG9jYWxMaWdodHMpO1xuICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHRoaXMuX3JlbmRlclBhc3NVcGRhdGVDbHVzdGVyZWQpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIG5vbi1jbHVzdGVyZWQgbG9jYWwgc2hhZG93cyAtIHRoZXNlIGFyZSBzaGFyZWQgYnkgYWxsIGNhbWVyYXMgKG5vdCBlbnRpcmVseSBjb3JyZWN0bHkpXG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsLmJ1aWxkTm9uQ2x1c3RlcmVkUmVuZGVyUGFzc2VzKGZyYW1lR3JhcGgsIHRoaXMubG9jYWxMaWdodHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFpbiBwYXNzZXNcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICBsZXQgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCB7IGxheWVyLCBjYW1lcmEgfSA9IHJlbmRlckFjdGlvbjtcblxuICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi51c2VDYW1lcmFQYXNzZXMpICB7XG5cbiAgICAgICAgICAgICAgICAvLyBzY2hlZHVsZSByZW5kZXIgcGFzc2VzIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGNhbWVyYS5jYW1lcmEucmVuZGVyUGFzc2VzLmZvckVhY2goKHJlbmRlclBhc3MpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gb24gd2ViZ2wxLCBkZXB0aCBwYXNzIHJlbmRlcnMgYWhlYWQgb2YgdGhlIG1haW4gY2FtZXJhIGluc3RlYWQgb2YgdGhlIG1pZGRsZSBvZiB0aGUgZnJhbWVcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aFBhc3MgPSBjYW1lcmEuY2FtZXJhLnJlbmRlclBhc3NEZXB0aEdyYWI7XG4gICAgICAgICAgICAgICAgaWYgKGRlcHRoUGFzcyAmJiB3ZWJnbDEgJiYgcmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlcHRoUGFzcy5vcHRpb25zLnJlc2l6ZVNvdXJjZSA9IGNhbWVyYS5jYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgICAgICAgICBkZXB0aFBhc3MudXBkYXRlKHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MoZGVwdGhQYXNzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpc0RlcHRoTGF5ZXIgPSBsYXllci5pZCA9PT0gTEFZRVJJRF9ERVBUSDtcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgZGVwdGggbGF5ZXIgb24gd2ViZ2wxIGlmIGNvbG9yIGdyYWIgcGFzcyBpcyBub3QgZW5hYmxlZCwgYXMgZGVwdGggcGFzcyByZW5kZXJzIGFoZWFkIG9mIHRoZSBtYWluIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmICh3ZWJnbDEgJiYgaXNEZXB0aExheWVyICYmICFjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcClcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpc0dyYWJQYXNzID0gaXNEZXB0aExheWVyICYmIChjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcCB8fCBjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCk7XG5cbiAgICAgICAgICAgICAgICAvLyBzdGFydCBvZiBibG9jayBvZiByZW5kZXIgYWN0aW9ucyByZW5kZXJpbmcgdG8gdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgICAgIGlmIChuZXdTdGFydCkge1xuICAgICAgICAgICAgICAgICAgICBuZXdTdGFydCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0ID0gcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpbmZvIGFib3V0IHRoZSBuZXh0IHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgICAgICBjb25zdCBuZXh0UmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpICsgMV07XG4gICAgICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJEZXB0aCA9IG5leHRSZW5kZXJBY3Rpb24gPyBuZXh0UmVuZGVyQWN0aW9uLmxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJHcmFiUGFzcyA9IGlzTmV4dExheWVyRGVwdGggJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKSAmJiAhd2ViZ2wxO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5leHROZWVkRGlyU2hhZG93cyA9IG5leHRSZW5kZXJBY3Rpb24gPyAobmV4dFJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSAmJiB0aGlzLmNhbWVyYURpclNoYWRvd0xpZ2h0cy5oYXMobmV4dFJlbmRlckFjdGlvbi5jYW1lcmEuY2FtZXJhKSkgOiBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIGVuZCBvZiB0aGUgYmxvY2sgdXNpbmcgdGhlIHNhbWUgcmVuZGVyIHRhcmdldCBpZiB0aGUgbmV4dCByZW5kZXIgYWN0aW9uIHVzZXMgYSBkaWZmZXJlbnQgcmVuZGVyIHRhcmdldCwgb3IgbmVlZHMgZGlyZWN0aW9uYWwgc2hhZG93c1xuICAgICAgICAgICAgICAgIC8vIHJlbmRlcmVkIGJlZm9yZSBpdCBvciBzaW1pbGFyIG9yIG5lZWRzIG90aGVyIHBhc3MgYmVmb3JlIGl0LlxuICAgICAgICAgICAgICAgIGlmICghbmV4dFJlbmRlckFjdGlvbiB8fCBuZXh0UmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCAhPT0gcmVuZGVyVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICAgIG5leHROZWVkRGlyU2hhZG93cyB8fCBpc05leHRMYXllckdyYWJQYXNzIHx8IGlzR3JhYlBhc3MpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0RlcHRoT25seSA9IGlzRGVwdGhMYXllciAmJiBzdGFydEluZGV4ID09PSBpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzRGVwdGhPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBkZXB0aCBsYXllciB0cmlnZ2VycyBncmFiIHBhc3NlcyBpZiBlbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0RlcHRoTGF5ZXIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JHcmFiUGFzcyA9IGNhbWVyYS5jYW1lcmEucmVuZGVyUGFzc0NvbG9yR3JhYjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvckdyYWJQYXNzLnNvdXJjZSA9IGNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKGNvbG9yR3JhYlBhc3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXAgJiYgIXdlYmdsMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhjYW1lcmEuY2FtZXJhLnJlbmRlclBhc3NEZXB0aEdyYWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcG9zdHByb2Nlc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhPy5vblBvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyh0aGlzLmRldmljZSwgdGhpcywgcmVuZGVyQWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWUtZ3JhcGguanMnKS5GcmFtZUdyYXBofSBmcmFtZUdyYXBoIC0gVGhlIGZyYW1lIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGVcbiAgICAgKiBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBhZGRNYWluUmVuZGVyUGFzcyhmcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uLCByZW5kZXJUYXJnZXQsIHN0YXJ0SW5kZXgsIGVuZEluZGV4KSB7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzRm9yd2FyZCh0aGlzLmRldmljZSwgbGF5ZXJDb21wb3NpdGlvbiwgdGhpcy5zY2VuZSwgdGhpcyk7XG4gICAgICAgIHJlbmRlclBhc3MuaW5pdChyZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBsYXllckNvbXBvc2l0aW9uLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAgICAgICByZW5kZXJQYXNzLmFkZFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25zW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlKGNvbXApIHtcblxuICAgICAgICB0aGlzLmZyYW1lVXBkYXRlKCk7XG4gICAgICAgIHRoaXMuc2hhZG93UmVuZGVyZXIuZnJhbWVVcGRhdGUoKTtcblxuICAgICAgICAvLyB1cGRhdGUgdGhlIHNreWJveCwgc2luY2UgdGhpcyBtaWdodCBjaGFuZ2UgX21lc2hJbnN0YW5jZXNcbiAgICAgICAgdGhpcy5zY2VuZS5fdXBkYXRlU2t5TWVzaCgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvblxuICAgICAgICB0aGlzLnVwZGF0ZUxheWVyQ29tcG9zaXRpb24oY29tcCk7XG5cbiAgICAgICAgdGhpcy5jb2xsZWN0TGlnaHRzKGNvbXApO1xuXG4gICAgICAgIC8vIFNpbmdsZSBwZXItZnJhbWUgY2FsY3VsYXRpb25zXG4gICAgICAgIHRoaXMuYmVnaW5GcmFtZShjb21wKTtcbiAgICAgICAgdGhpcy5zZXRTY2VuZUNvbnN0YW50cygpO1xuXG4gICAgICAgIC8vIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAgICAvLyBhZnRlciB0aGlzIHRoZSBzY2VuZSBjdWxsaW5nIGlzIGRvbmUgYW5kIHNjcmlwdCBjYWxsYmFja3MgY2FuIGJlIGNhbGxlZCB0byByZXBvcnQgd2hpY2ggb2JqZWN0cyBhcmUgdmlzaWJsZVxuICAgICAgICB0aGlzLmN1bGxDb21wb3NpdGlvbihjb21wKTtcblxuICAgICAgICAvLyBHUFUgdXBkYXRlIGZvciB2aXNpYmxlIG9iamVjdHMgcmVxdWlyaW5nIG9uZVxuICAgICAgICB0aGlzLmdwdVVwZGF0ZSh0aGlzLnByb2Nlc3NpbmdNZXNoSW5zdGFuY2VzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEZvcndhcmRSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbIl9ub0xpZ2h0cyIsIl9kcmF3Q2FsbExpc3QiLCJkcmF3Q2FsbHMiLCJzaGFkZXJJbnN0YW5jZXMiLCJpc05ld01hdGVyaWFsIiwibGlnaHRNYXNrQ2hhbmdlZCIsImNsZWFyIiwibGVuZ3RoIiwidm9nZWxEaXNrUHJlY2FsY3VsYXRpb25TYW1wbGVzIiwibnVtU2FtcGxlcyIsInNhbXBsZXMiLCJpIiwiciIsIk1hdGgiLCJzcXJ0IiwicHVzaCIsInZvZ2VsU3BoZXJlUHJlY2FsY3VsYXRpb25TYW1wbGVzIiwid2VpZ2h0IiwicmFkaXVzIiwiRm9yd2FyZFJlbmRlcmVyIiwiUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiZGV2aWNlIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJfbWF0ZXJpYWxTd2l0Y2hlcyIsIl9kZXB0aE1hcFRpbWUiLCJfZm9yd2FyZFRpbWUiLCJfc29ydFRpbWUiLCJzY29wZSIsImZvZ0NvbG9ySWQiLCJyZXNvbHZlIiwiZm9nU3RhcnRJZCIsImZvZ0VuZElkIiwiZm9nRGVuc2l0eUlkIiwiYW1iaWVudElkIiwic2t5Ym94SW50ZW5zaXR5SWQiLCJjdWJlTWFwUm90YXRpb25NYXRyaXhJZCIsInBjc3NEaXNrU2FtcGxlc0lkIiwicGNzc1NwaGVyZVNhbXBsZXNJZCIsImxpZ2h0Q29sb3JJZCIsImxpZ2h0RGlyIiwibGlnaHREaXJJZCIsImxpZ2h0U2hhZG93TWFwSWQiLCJsaWdodFNoYWRvd01hdHJpeElkIiwibGlnaHRTaGFkb3dQYXJhbXNJZCIsImxpZ2h0U2hhZG93SW50ZW5zaXR5IiwibGlnaHRSYWRpdXNJZCIsImxpZ2h0UG9zIiwibGlnaHRQb3NJZCIsImxpZ2h0V2lkdGgiLCJsaWdodFdpZHRoSWQiLCJsaWdodEhlaWdodCIsImxpZ2h0SGVpZ2h0SWQiLCJsaWdodEluQW5nbGVJZCIsImxpZ2h0T3V0QW5nbGVJZCIsImxpZ2h0Q29va2llSWQiLCJsaWdodENvb2tpZUludElkIiwibGlnaHRDb29raWVNYXRyaXhJZCIsImxpZ2h0Q29va2llT2Zmc2V0SWQiLCJsaWdodFNoYWRvd1NlYXJjaEFyZWFJZCIsImxpZ2h0Q2FtZXJhUGFyYW1zSWQiLCJzaGFkb3dNYXRyaXhQYWxldHRlSWQiLCJzaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWQiLCJzaGFkb3dDYXNjYWRlQ291bnRJZCIsInNjcmVlblNpemVJZCIsIl9zY3JlZW5TaXplIiwiRmxvYXQzMkFycmF5IiwiZm9nQ29sb3IiLCJhbWJpZW50Q29sb3IiLCJwY3NzRGlza1NhbXBsZXMiLCJwY3NzU3BoZXJlU2FtcGxlcyIsImRlc3Ryb3kiLCJkaXNwYXRjaEdsb2JhbExpZ2h0cyIsInNjZW5lIiwiYW1iaWVudExpZ2h0IiwiZyIsImIiLCJnYW1tYUNvcnJlY3Rpb24iLCJwb3ciLCJwaHlzaWNhbFVuaXRzIiwiYW1iaWVudEx1bWluYW5jZSIsInNldFZhbHVlIiwic2t5Ym94THVtaW5hbmNlIiwic2t5Ym94SW50ZW5zaXR5IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsImRhdGEiLCJfcmVzb2x2ZUxpZ2h0IiwibGlnaHQiLCJzZXRMVENEaXJlY3Rpb25hbExpZ2h0Iiwid3RtIiwiY250IiwiZGlyIiwiY2FtcG9zIiwiZmFyIiwieCIsInkiLCJ6IiwiaFdpZHRoIiwidHJhbnNmb3JtVmVjdG9yIiwiVmVjMyIsImhIZWlnaHQiLCJkaXNwYXRjaERpcmVjdExpZ2h0cyIsImRpcnMiLCJtYXNrIiwiY2FtZXJhIiwiZGlyZWN0aW9uYWwiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsImdldFkiLCJfZGlyZWN0aW9uIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZ2V0UG9zaXRpb24iLCJmYXJDbGlwIiwiY2FzdFNoYWRvd3MiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwic2hhZG93QnVmZmVyIiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwic2hhZG93SW50ZW5zaXR5IiwicHJvamVjdGlvbkNvbXBlbnNhdGlvbiIsInBpeGVsc1Blck1ldGVyIiwicGVudW1icmFTaXplIiwic2hhZG93Q2FtZXJhIiwicmVuZGVyVGFyZ2V0Iiwid2lkdGgiLCJjYW1lcmFQYXJhbXMiLCJfc2hhZG93Q2FtZXJhUGFyYW1zIiwiZGVwdGhSYW5nZUNvbXBlbnNhdGlvbiIsIl9mYXJDbGlwIiwiX25lYXJDbGlwIiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImZvdiIsIl9mb3YiLCJQSSIsImZvdlJhdGlvIiwidGFuIiwiY29va2llTWF0cml4IiwiTGlnaHRDYW1lcmEiLCJldmFsU3BvdENvb2tpZU1hdHJpeCIsIl9jb29raWVUcmFuc2Zvcm0iLCJfY29va2llVHJhbnNmb3JtVW5pZm9ybSIsInciLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVPZmZzZXQiLCJkaXNwYXRjaExvY2FsTGlnaHRzIiwic29ydGVkTGlnaHRzIiwidXNlZERpckxpZ2h0cyIsIm9tbmlzIiwiTElHSFRUWVBFX09NTkkiLCJudW1PbW5pcyIsInNwdHMiLCJMSUdIVFRZUEVfU1BPVCIsIm51bVNwdHMiLCJyZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyIsImxheWVyIiwicGFzcyIsIl9sYXllciRnZXRMaWdodEhhc2giLCJhZGRDYWxsIiwiZHJhd0NhbGwiLCJzaGFkZXJJbnN0YW5jZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0SGFzaCIsImdldExpZ2h0SGFzaCIsInByZXZNYXRlcmlhbCIsInByZXZPYmpEZWZzIiwicHJldkxpZ2h0TWFzayIsImRyYXdDYWxsc0NvdW50Iiwic2tpcFJlbmRlckNhbWVyYSIsIl9za2lwUmVuZGVyQ291bnRlciIsInNraXBSZW5kZXJBZnRlciIsImVuc3VyZU1hdGVyaWFsIiwibWF0ZXJpYWwiLCJvYmpEZWZzIiwiX3NoYWRlckRlZnMiLCJsaWdodE1hc2siLCJfc2NlbmUiLCJkaXJ0eSIsInVwZGF0ZVVuaWZvcm1zIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJub2RlIiwibmFtZSIsImdldFNoYWRlckluc3RhbmNlIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwicG9wR3B1TWFya2VyIiwiZW5kU2hhZGVyQmF0Y2giLCJyZW5kZXJGb3J3YXJkSW50ZXJuYWwiLCJwcmVwYXJlZENhbGxzIiwiZHJhd0NhbGxiYWNrIiwiZmxpcEZhY2VzIiwicGFzc0ZsYWciLCJmbGlwRmFjdG9yIiwic2tpcE1hdGVyaWFsIiwicHJlcGFyZWRDYWxsc0NvdW50IiwiX2RyYXdDYWxsJHN0ZW5jaWxGcm9uIiwiX2RyYXdDYWxsJHN0ZW5jaWxCYWNrIiwibmV3TWF0ZXJpYWwiLCJzaGFkZXIiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJEZWJ1ZyIsImVycm9yIiwibGFiZWwiLCJzZXRQYXJhbWV0ZXJzIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiYWxwaGFUZXN0SWQiLCJhbHBoYVRlc3QiLCJzZXRCbGVuZFN0YXRlIiwiYmxlbmRTdGF0ZSIsInNldERlcHRoU3RhdGUiLCJkZXB0aFN0YXRlIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUb0NvdmVyYWdlIiwic2V0dXBDdWxsTW9kZSIsIl9jdWxsRmFjZXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInNldFN0ZW5jaWxTdGF0ZSIsIm1lc2giLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0TW9ycGhpbmciLCJtb3JwaEluc3RhbmNlIiwic2V0U2tpbm5pbmciLCJzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwieHIiLCJzZXNzaW9uIiwidmlld3MiLCJsaXN0IiwidiIsInZpZXciLCJzZXRWaWV3cG9ydCIsInZpZXdwb3J0IiwicHJvaklkIiwicHJvak1hdCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdPZmZNYXQiLCJ2aWV3SW52SWQiLCJ2aWV3SW52T2ZmTWF0Iiwidmlld0lkMyIsInZpZXdNYXQzIiwidmlld1Byb2pJZCIsInByb2pWaWV3T2ZmTWF0Iiwidmlld1Bvc0lkIiwicG9zaXRpb25EYXRhIiwidmlld0luZGV4SWQiLCJkcmF3SW5zdGFuY2UiLCJkcmF3SW5zdGFuY2UyIiwicGFyYW1ldGVycyIsInJlbmRlckZvcndhcmQiLCJhbGxEcmF3Q2FsbHMiLCJmb3J3YXJkU3RhcnRUaW1lIiwibm93IiwicmVuZGVyRm9yd2FyZExheWVyIiwidHJhbnNwYXJlbnQiLCJzaGFkZXJQYXNzIiwidmlld0JpbmRHcm91cHMiLCJvcHRpb25zIiwiX29wdGlvbnMkY2xlYXJDb2xvcnMiLCJfb3B0aW9ucyRjbGVhckRlcHRoIiwiX29wdGlvbnMkY2xlYXJTdGVuY2lsIiwic2V0dXBWaWV3cG9ydCIsImNsZWFyQ29sb3IiLCJjbGVhckNvbG9ycyIsImNsZWFyRGVwdGgiLCJjbGVhclN0ZW5jaWwiLCJ2aXNpYmxlIiwic3BsaXRMaWdodHMiLCJzb3J0VGltZSIsInNvcnRWaXNpYmxlIiwiY3VsbGVkSW5zdGFuY2VzIiwiZ2V0Q3VsbGVkSW5zdGFuY2VzIiwib3BhcXVlIiwiaW1tZWRpYXRlIiwib25QcmVSZW5kZXJMYXllciIsInJlcXVpcmVzTGlnaHRDdWJlIiwibGlnaHRDdWJlIiwidXBkYXRlIiwiX2xpZ2h0cyIsImNvbnN0YW50TGlnaHRDdWJlIiwiY29sb3JzIiwiX29wdGlvbnMkc3BsaXRMaWdodHMiLCJtZXNoSW5zdGFuY2VzIiwiYXNzZXJ0IiwiX29wdGlvbnMkbGlnaHRDbHVzdGVyIiwibGlnaHRDbHVzdGVycyIsIndvcmxkQ2x1c3RlcnNBbGxvY2F0b3IiLCJlbXB0eSIsImFjdGl2YXRlIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwibGlnaHRpbmciLCJkZWJ1Z0xheWVyIiwiaWQiLCJXb3JsZENsdXN0ZXJzRGVidWciLCJyZW5kZXIiLCJfYWN0aXZlQ2FtZXJhIiwidmlld0NvdW50Iiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJfZmxpcEZhY2VzIiwiZmxpcFkiLCJmb3J3YXJkRHJhd0NhbGxzIiwib25EcmF3Q2FsbCIsInNldFNjZW5lQ29uc3RhbnRzIiwiZm9nIiwiRk9HX05PTkUiLCJGT0dfTElORUFSIiwiZm9nU3RhcnQiLCJmb2dFbmQiLCJmb2dEZW5zaXR5IiwiaGVpZ2h0IiwiYnVpbGRGcmFtZUdyYXBoIiwiZnJhbWVHcmFwaCIsImxheWVyQ29tcG9zaXRpb24iLCJ3ZWJnbDEiLCJpc1dlYkdMMSIsInJlc2V0Iiwic2hhZG93c0VuYWJsZWQiLCJjb29raWVzRW5hYmxlZCIsIl9yZW5kZXJQYXNzVXBkYXRlQ2x1c3RlcmVkIiwibGlnaHRzIiwibG9jYWxMaWdodHMiLCJhZGRSZW5kZXJQYXNzIiwiX3NoYWRvd1JlbmRlcmVyTG9jYWwiLCJidWlsZE5vbkNsdXN0ZXJlZFJlbmRlclBhc3NlcyIsInN0YXJ0SW5kZXgiLCJuZXdTdGFydCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsInJlbmRlckFjdGlvbiIsInVzZUNhbWVyYVBhc3NlcyIsInJlbmRlclBhc3NlcyIsImZvckVhY2giLCJyZW5kZXJQYXNzIiwiZGVwdGhQYXNzIiwicmVuZGVyUGFzc0RlcHRoR3JhYiIsImZpcnN0Q2FtZXJhVXNlIiwicmVzaXplU291cmNlIiwiaXNEZXB0aExheWVyIiwiTEFZRVJJRF9ERVBUSCIsInJlbmRlclNjZW5lQ29sb3JNYXAiLCJpc0dyYWJQYXNzIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsIm5leHRSZW5kZXJBY3Rpb24iLCJpc05leHRMYXllckRlcHRoIiwiaXNOZXh0TGF5ZXJHcmFiUGFzcyIsIm5leHROZWVkRGlyU2hhZG93cyIsImNhbWVyYURpclNoYWRvd0xpZ2h0cyIsImhhcyIsImlzRGVwdGhPbmx5IiwiYWRkTWFpblJlbmRlclBhc3MiLCJjb2xvckdyYWJQYXNzIiwicmVuZGVyUGFzc0NvbG9yR3JhYiIsInNvdXJjZSIsInRyaWdnZXJQb3N0cHJvY2VzcyIsIm9uUG9zdHByb2Nlc3NpbmciLCJSZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJlbmRJbmRleCIsIlJlbmRlclBhc3NGb3J3YXJkIiwiaW5pdCIsImFkZFJlbmRlckFjdGlvbiIsImNvbXAiLCJmcmFtZVVwZGF0ZSIsInNoYWRvd1JlbmRlcmVyIiwiX3VwZGF0ZVNreU1lc2giLCJ1cGRhdGVMYXllckNvbXBvc2l0aW9uIiwiY29sbGVjdExpZ2h0cyIsImJlZ2luRnJhbWUiLCJjdWxsQ29tcG9zaXRpb24iLCJncHVVcGRhdGUiLCJwcm9jZXNzaW5nTWVzaEluc3RhbmNlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFvQkEsTUFBTUEsU0FBUyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQTtBQUU5QixNQUFNQyxhQUFhLEdBQUc7QUFDbEJDLEVBQUFBLFNBQVMsRUFBRSxFQUFFO0FBQ2JDLEVBQUFBLGVBQWUsRUFBRSxFQUFFO0FBQ25CQyxFQUFBQSxhQUFhLEVBQUUsRUFBRTtBQUNqQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBRTtFQUVwQkMsS0FBSyxFQUFFLFlBQVk7QUFDZixJQUFBLElBQUksQ0FBQ0osU0FBUyxDQUFDSyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ3pCLElBQUEsSUFBSSxDQUFDSixlQUFlLENBQUNJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDL0IsSUFBQSxJQUFJLENBQUNILGFBQWEsQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUM3QixJQUFBLElBQUksQ0FBQ0YsZ0JBQWdCLENBQUNFLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDcEMsR0FBQTtBQUNKLENBQUMsQ0FBQTtBQUVELFNBQVNDLDhCQUE4QkEsQ0FBQ0MsVUFBVSxFQUFFO0VBQ2hELE1BQU1DLE9BQU8sR0FBRyxFQUFFLENBQUE7RUFDbEIsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLFVBQVUsRUFBRSxFQUFFRSxDQUFDLEVBQUU7QUFDakMsSUFBQSxNQUFNQyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsSUFBSSxDQUFDSCxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUdFLElBQUksQ0FBQ0MsSUFBSSxDQUFDTCxVQUFVLENBQUMsQ0FBQTtBQUNwREMsSUFBQUEsT0FBTyxDQUFDSyxJQUFJLENBQUNILENBQUMsQ0FBQyxDQUFBO0FBQ25CLEdBQUE7QUFDQSxFQUFBLE9BQU9GLE9BQU8sQ0FBQTtBQUNsQixDQUFBO0FBRUEsU0FBU00sZ0NBQWdDQSxDQUFDUCxVQUFVLEVBQUU7RUFDbEQsTUFBTUMsT0FBTyxHQUFHLEVBQUUsQ0FBQTtFQUNsQixLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsVUFBVSxFQUFFRSxDQUFDLEVBQUUsRUFBRTtBQUNqQyxJQUFBLE1BQU1NLE1BQU0sR0FBR04sQ0FBQyxHQUFHRixVQUFVLENBQUE7SUFDN0IsTUFBTVMsTUFBTSxHQUFHTCxJQUFJLENBQUNDLElBQUksQ0FBQyxHQUFHLEdBQUdHLE1BQU0sR0FBR0EsTUFBTSxDQUFDLENBQUE7QUFDL0NQLElBQUFBLE9BQU8sQ0FBQ0ssSUFBSSxDQUFDRyxNQUFNLENBQUMsQ0FBQTtBQUN4QixHQUFBO0FBQ0EsRUFBQSxPQUFPUixPQUFPLENBQUE7QUFDbEIsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTVMsZUFBZSxTQUFTQyxRQUFRLENBQUM7QUFDbkM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLGNBQWMsRUFBRTtJQUN4QixLQUFLLENBQUNBLGNBQWMsQ0FBQyxDQUFBO0FBRXJCLElBQUEsTUFBTUMsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0lBRTFCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLENBQUMsQ0FBQTtJQUN0QixJQUFJLENBQUNDLFlBQVksR0FBRyxDQUFDLENBQUE7SUFDckIsSUFBSSxDQUFDQyxTQUFTLEdBQUcsQ0FBQyxDQUFBOztBQUVsQjtBQUNBLElBQUEsTUFBTUMsS0FBSyxHQUFHTixNQUFNLENBQUNNLEtBQUssQ0FBQTtJQUUxQixJQUFJLENBQUNDLFVBQVUsR0FBR0QsS0FBSyxDQUFDRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUE7SUFDNUMsSUFBSSxDQUFDQyxVQUFVLEdBQUdILEtBQUssQ0FBQ0UsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFBO0lBQzVDLElBQUksQ0FBQ0UsUUFBUSxHQUFHSixLQUFLLENBQUNFLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQTtJQUN4QyxJQUFJLENBQUNHLFlBQVksR0FBR0wsS0FBSyxDQUFDRSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUE7SUFFaEQsSUFBSSxDQUFDSSxTQUFTLEdBQUdOLEtBQUssQ0FBQ0UsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUE7SUFDckQsSUFBSSxDQUFDSyxpQkFBaUIsR0FBR1AsS0FBSyxDQUFDRSxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtJQUN6RCxJQUFJLENBQUNNLHVCQUF1QixHQUFHUixLQUFLLENBQUNFLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFBO0lBQ3JFLElBQUksQ0FBQ08saUJBQWlCLEdBQUdULEtBQUssQ0FBQ0UsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUE7SUFDNUQsSUFBSSxDQUFDUSxtQkFBbUIsR0FBR1YsS0FBSyxDQUFDRSxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQTtJQUNoRSxJQUFJLENBQUNTLFlBQVksR0FBRyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUNwQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtJQUMxQixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLEVBQUUsQ0FBQTtJQUM5QixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUNwQixJQUFJLENBQUNDLFVBQVUsR0FBRyxFQUFFLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEVBQUUsQ0FBQTtJQUNyQixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLEVBQUUsQ0FBQTtJQUN6QixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7SUFDN0IsSUFBSSxDQUFDQyx1QkFBdUIsR0FBRyxFQUFFLENBQUE7SUFDakMsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7O0FBRTdCO0lBQ0EsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRyxFQUFFLENBQUE7SUFDL0IsSUFBSSxDQUFDQyx3QkFBd0IsR0FBRyxFQUFFLENBQUE7SUFDbEMsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxFQUFFLENBQUE7SUFFOUIsSUFBSSxDQUFDQyxZQUFZLEdBQUdwQyxLQUFLLENBQUNFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQTtBQUNoRCxJQUFBLElBQUksQ0FBQ21DLFdBQVcsR0FBRyxJQUFJQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFdEMsSUFBQSxJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJRCxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbkMsSUFBQSxJQUFJLENBQUNFLFlBQVksR0FBRyxJQUFJRixZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFdkMsSUFBQSxJQUFJLENBQUNHLGVBQWUsR0FBRzlELDhCQUE4QixDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3pELElBQUEsSUFBSSxDQUFDK0QsaUJBQWlCLEdBQUd2RCxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqRSxHQUFBO0FBRUF3RCxFQUFBQSxPQUFPQSxHQUFHO0lBQ04sS0FBSyxDQUFDQSxPQUFPLEVBQUUsQ0FBQTtBQUNuQixHQUFBOztBQUdBOztBQVFBO0FBQ0o7QUFDQTtFQUNJQyxvQkFBb0JBLENBQUNDLEtBQUssRUFBRTtJQUN4QixJQUFJLENBQUNMLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0ssS0FBSyxDQUFDQyxZQUFZLENBQUMvRCxDQUFDLENBQUE7SUFDM0MsSUFBSSxDQUFDeUQsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSyxLQUFLLENBQUNDLFlBQVksQ0FBQ0MsQ0FBQyxDQUFBO0lBQzNDLElBQUksQ0FBQ1AsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSyxLQUFLLENBQUNDLFlBQVksQ0FBQ0UsQ0FBQyxDQUFBO0lBQzNDLElBQUlILEtBQUssQ0FBQ0ksZUFBZSxFQUFFO01BQ3ZCLEtBQUssSUFBSW5FLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsRUFBRSxFQUFFO0FBQ3hCLFFBQUEsSUFBSSxDQUFDMEQsWUFBWSxDQUFDMUQsQ0FBQyxDQUFDLEdBQUdFLElBQUksQ0FBQ2tFLEdBQUcsQ0FBQyxJQUFJLENBQUNWLFlBQVksQ0FBQzFELENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQzlELE9BQUE7QUFDSixLQUFBO0lBQ0EsSUFBSStELEtBQUssQ0FBQ00sYUFBYSxFQUFFO01BQ3JCLEtBQUssSUFBSXJFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsRUFBRSxFQUFFO1FBQ3hCLElBQUksQ0FBQzBELFlBQVksQ0FBQzFELENBQUMsQ0FBQyxJQUFJK0QsS0FBSyxDQUFDTyxnQkFBZ0IsQ0FBQTtBQUNsRCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUksQ0FBQzlDLFNBQVMsQ0FBQytDLFFBQVEsQ0FBQyxJQUFJLENBQUNiLFlBQVksQ0FBQyxDQUFBO0FBRTFDLElBQUEsSUFBSSxDQUFDakMsaUJBQWlCLENBQUM4QyxRQUFRLENBQUNSLEtBQUssQ0FBQ00sYUFBYSxHQUFHTixLQUFLLENBQUNTLGVBQWUsR0FBR1QsS0FBSyxDQUFDVSxlQUFlLENBQUMsQ0FBQTtJQUNwRyxJQUFJLENBQUMvQyx1QkFBdUIsQ0FBQzZDLFFBQVEsQ0FBQ1IsS0FBSyxDQUFDVyxtQkFBbUIsQ0FBQ0MsSUFBSSxDQUFDLENBQUE7QUFDekUsR0FBQTtBQUVBQyxFQUFBQSxhQUFhQSxDQUFDMUQsS0FBSyxFQUFFbEIsQ0FBQyxFQUFFO0FBQ3BCLElBQUEsTUFBTTZFLEtBQUssR0FBRyxPQUFPLEdBQUc3RSxDQUFDLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUM2QixZQUFZLENBQUM3QixDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFBO0lBQ3RELElBQUksQ0FBQy9DLFFBQVEsQ0FBQzlCLENBQUMsQ0FBQyxHQUFHLElBQUl3RCxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdEMsSUFBQSxJQUFJLENBQUN6QixVQUFVLENBQUMvQixDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLFlBQVksQ0FBQyxDQUFBO0FBQ3hELElBQUEsSUFBSSxDQUFDN0MsZ0JBQWdCLENBQUNoQyxDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLFlBQVksQ0FBQyxDQUFBO0FBQzlELElBQUEsSUFBSSxDQUFDNUMsbUJBQW1CLENBQUNqQyxDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLGVBQWUsQ0FBQyxDQUFBO0FBQ3BFLElBQUEsSUFBSSxDQUFDM0MsbUJBQW1CLENBQUNsQyxDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLGVBQWUsQ0FBQyxDQUFBO0FBQ3BFLElBQUEsSUFBSSxDQUFDMUMsb0JBQW9CLENBQUNuQyxDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLGtCQUFrQixDQUFDLENBQUE7QUFDeEUsSUFBQSxJQUFJLENBQUM1Qix1QkFBdUIsQ0FBQ2pELENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsbUJBQW1CLENBQUMsQ0FBQTtBQUM1RSxJQUFBLElBQUksQ0FBQ3pDLGFBQWEsQ0FBQ3BDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUE7SUFDeEQsSUFBSSxDQUFDeEMsUUFBUSxDQUFDckMsQ0FBQyxDQUFDLEdBQUcsSUFBSXdELFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN0QyxJQUFBLElBQUksQ0FBQ2xCLFVBQVUsQ0FBQ3RDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUE7SUFDdkQsSUFBSSxDQUFDdEMsVUFBVSxDQUFDdkMsQ0FBQyxDQUFDLEdBQUcsSUFBSXdELFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQ2hCLFlBQVksQ0FBQ3hDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsWUFBWSxDQUFDLENBQUE7SUFDMUQsSUFBSSxDQUFDcEMsV0FBVyxDQUFDekMsQ0FBQyxDQUFDLEdBQUcsSUFBSXdELFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN6QyxJQUFBLElBQUksQ0FBQ2QsYUFBYSxDQUFDMUMsQ0FBQyxDQUFDLEdBQUdrQixLQUFLLENBQUNFLE9BQU8sQ0FBQ3lELEtBQUssR0FBRyxhQUFhLENBQUMsQ0FBQTtBQUM1RCxJQUFBLElBQUksQ0FBQ2xDLGNBQWMsQ0FBQzNDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsaUJBQWlCLENBQUMsQ0FBQTtBQUNqRSxJQUFBLElBQUksQ0FBQ2pDLGVBQWUsQ0FBQzVDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsaUJBQWlCLENBQUMsQ0FBQTtBQUNsRSxJQUFBLElBQUksQ0FBQ2hDLGFBQWEsQ0FBQzdDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUE7QUFDeEQsSUFBQSxJQUFJLENBQUMvQixnQkFBZ0IsQ0FBQzlDLENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcsa0JBQWtCLENBQUMsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQzlCLG1CQUFtQixDQUFDL0MsQ0FBQyxDQUFDLEdBQUdrQixLQUFLLENBQUNFLE9BQU8sQ0FBQ3lELEtBQUssR0FBRyxlQUFlLENBQUMsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQzdCLG1CQUFtQixDQUFDaEQsQ0FBQyxDQUFDLEdBQUdrQixLQUFLLENBQUNFLE9BQU8sQ0FBQ3lELEtBQUssR0FBRyxlQUFlLENBQUMsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQzNCLG1CQUFtQixDQUFDbEQsQ0FBQyxDQUFDLEdBQUdrQixLQUFLLENBQUNFLE9BQU8sQ0FBQ3lELEtBQUssR0FBRyxlQUFlLENBQUMsQ0FBQTs7QUFFcEU7QUFDQSxJQUFBLElBQUksQ0FBQzFCLHFCQUFxQixDQUFDbkQsQ0FBQyxDQUFDLEdBQUdrQixLQUFLLENBQUNFLE9BQU8sQ0FBQ3lELEtBQUssR0FBRyx5QkFBeUIsQ0FBQyxDQUFBO0FBQ2hGLElBQUEsSUFBSSxDQUFDekIsd0JBQXdCLENBQUNwRCxDQUFDLENBQUMsR0FBR2tCLEtBQUssQ0FBQ0UsT0FBTyxDQUFDeUQsS0FBSyxHQUFHLDRCQUE0QixDQUFDLENBQUE7QUFDdEYsSUFBQSxJQUFJLENBQUN4QixvQkFBb0IsQ0FBQ3JELENBQUMsQ0FBQyxHQUFHa0IsS0FBSyxDQUFDRSxPQUFPLENBQUN5RCxLQUFLLEdBQUcscUJBQXFCLENBQUMsQ0FBQTtBQUMvRSxHQUFBO0VBRUFDLHNCQUFzQkEsQ0FBQ0MsR0FBRyxFQUFFQyxHQUFHLEVBQUVDLEdBQUcsRUFBRUMsTUFBTSxFQUFFQyxHQUFHLEVBQUU7QUFDL0MsSUFBQSxJQUFJLENBQUM5QyxRQUFRLENBQUMyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0UsTUFBTSxDQUFDRSxDQUFDLEdBQUdILEdBQUcsQ0FBQ0csQ0FBQyxHQUFHRCxHQUFHLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUM5QyxRQUFRLENBQUMyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0UsTUFBTSxDQUFDRyxDQUFDLEdBQUdKLEdBQUcsQ0FBQ0ksQ0FBQyxHQUFHRixHQUFHLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUM5QyxRQUFRLENBQUMyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0UsTUFBTSxDQUFDSSxDQUFDLEdBQUdMLEdBQUcsQ0FBQ0ssQ0FBQyxHQUFHSCxHQUFHLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUM3QyxVQUFVLENBQUMwQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQ2xDLFFBQVEsQ0FBQzJDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFakQsSUFBQSxNQUFNTyxNQUFNLEdBQUdSLEdBQUcsQ0FBQ1MsZUFBZSxDQUFDLElBQUlDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4RCxJQUFBLElBQUksQ0FBQ2xELFVBQVUsQ0FBQ3lDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHTyxNQUFNLENBQUNILENBQUMsR0FBR0QsR0FBRyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDNUMsVUFBVSxDQUFDeUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdPLE1BQU0sQ0FBQ0YsQ0FBQyxHQUFHRixHQUFHLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUM1QyxVQUFVLENBQUN5QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR08sTUFBTSxDQUFDRCxDQUFDLEdBQUdILEdBQUcsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQzNDLFlBQVksQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDaEMsVUFBVSxDQUFDeUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVyRCxJQUFBLE1BQU1VLE9BQU8sR0FBR1gsR0FBRyxDQUFDUyxlQUFlLENBQUMsSUFBSUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN4RCxJQUFBLElBQUksQ0FBQ2hELFdBQVcsQ0FBQ3VDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHVSxPQUFPLENBQUNOLENBQUMsR0FBR0QsR0FBRyxDQUFBO0FBQzFDLElBQUEsSUFBSSxDQUFDMUMsV0FBVyxDQUFDdUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdVLE9BQU8sQ0FBQ0wsQ0FBQyxHQUFHRixHQUFHLENBQUE7QUFDMUMsSUFBQSxJQUFJLENBQUMxQyxXQUFXLENBQUN1QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR1UsT0FBTyxDQUFDSixDQUFDLEdBQUdILEdBQUcsQ0FBQTtBQUMxQyxJQUFBLElBQUksQ0FBQ3pDLGFBQWEsQ0FBQ3NDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDOUIsV0FBVyxDQUFDdUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUMzRCxHQUFBO0VBRUFXLG9CQUFvQkEsQ0FBQ0MsSUFBSSxFQUFFN0IsS0FBSyxFQUFFOEIsSUFBSSxFQUFFQyxNQUFNLEVBQUU7SUFDNUMsSUFBSWQsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUVYLElBQUEsTUFBTTlELEtBQUssR0FBRyxJQUFJLENBQUNOLE1BQU0sQ0FBQ00sS0FBSyxDQUFBO0FBRS9CLElBQUEsS0FBSyxJQUFJbEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNEYsSUFBSSxDQUFDaEcsTUFBTSxFQUFFSSxDQUFDLEVBQUUsRUFBRTtNQUNsQyxJQUFJLEVBQUU0RixJQUFJLENBQUM1RixDQUFDLENBQUMsQ0FBQzZGLElBQUksR0FBR0EsSUFBSSxDQUFDLEVBQUUsU0FBQTtBQUU1QixNQUFBLE1BQU1FLFdBQVcsR0FBR0gsSUFBSSxDQUFDNUYsQ0FBQyxDQUFDLENBQUE7TUFDM0IsTUFBTStFLEdBQUcsR0FBR2dCLFdBQVcsQ0FBQ0MsS0FBSyxDQUFDQyxpQkFBaUIsRUFBRSxDQUFBO0FBRWpELE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3BFLFlBQVksQ0FBQ21ELEdBQUcsQ0FBQyxFQUFFO0FBQ3pCLFFBQUEsSUFBSSxDQUFDSixhQUFhLENBQUMxRCxLQUFLLEVBQUU4RCxHQUFHLENBQUMsQ0FBQTtBQUNsQyxPQUFBO0FBRUEsTUFBQSxJQUFJLENBQUNuRCxZQUFZLENBQUNtRCxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDUixLQUFLLENBQUNJLGVBQWUsR0FBRzRCLFdBQVcsQ0FBQ0csaUJBQWlCLEdBQUdILFdBQVcsQ0FBQ0ksV0FBVyxDQUFDLENBQUE7O0FBRWhIO0FBQ0FwQixNQUFBQSxHQUFHLENBQUNxQixJQUFJLENBQUNMLFdBQVcsQ0FBQ00sVUFBVSxDQUFDLENBQUNDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlDUCxNQUFBQSxXQUFXLENBQUNNLFVBQVUsQ0FBQ0UsU0FBUyxFQUFFLENBQUE7QUFDbEMsTUFBQSxJQUFJLENBQUN6RSxRQUFRLENBQUNrRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2UsV0FBVyxDQUFDTSxVQUFVLENBQUNqQixDQUFDLENBQUE7QUFDaEQsTUFBQSxJQUFJLENBQUN0RCxRQUFRLENBQUNrRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2UsV0FBVyxDQUFDTSxVQUFVLENBQUNoQixDQUFDLENBQUE7QUFDaEQsTUFBQSxJQUFJLENBQUN2RCxRQUFRLENBQUNrRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2UsV0FBVyxDQUFDTSxVQUFVLENBQUNmLENBQUMsQ0FBQTtBQUNoRCxNQUFBLElBQUksQ0FBQ3ZELFVBQVUsQ0FBQ2lELEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDekMsUUFBUSxDQUFDa0QsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRCxNQUFBLElBQUllLFdBQVcsQ0FBQ1MsS0FBSyxLQUFLQyxtQkFBbUIsRUFBRTtBQUMzQztRQUNBLElBQUksQ0FBQzNCLHNCQUFzQixDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRWUsV0FBVyxDQUFDTSxVQUFVLEVBQUVQLE1BQU0sQ0FBQ0UsS0FBSyxDQUFDVSxXQUFXLEVBQUUsRUFBRVosTUFBTSxDQUFDYSxPQUFPLENBQUMsQ0FBQTtBQUM3RyxPQUFBO01BRUEsSUFBSVosV0FBVyxDQUFDYSxXQUFXLEVBQUU7UUFFekIsTUFBTUMsZUFBZSxHQUFHZCxXQUFXLENBQUNlLGFBQWEsQ0FBQ2hCLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUM1RCxRQUFBLE1BQU1pQixNQUFNLEdBQUdoQixXQUFXLENBQUNpQixxQkFBcUIsQ0FBQ0gsZUFBZSxDQUFDLENBQUE7UUFFakUsSUFBSSxDQUFDN0UsZ0JBQWdCLENBQUNnRCxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDc0MsZUFBZSxDQUFDSSxZQUFZLENBQUMsQ0FBQTtBQUNqRSxRQUFBLElBQUksQ0FBQ2hGLG1CQUFtQixDQUFDK0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3NDLGVBQWUsQ0FBQ0ssWUFBWSxDQUFDdkMsSUFBSSxDQUFDLENBQUE7UUFFekUsSUFBSSxDQUFDeEIscUJBQXFCLENBQUM2QixHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDd0IsV0FBVyxDQUFDb0Isb0JBQW9CLENBQUMsQ0FBQTtRQUMxRSxJQUFJLENBQUMvRCx3QkFBd0IsQ0FBQzRCLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN3QixXQUFXLENBQUNxQix1QkFBdUIsQ0FBQyxDQUFBO1FBQ2hGLElBQUksQ0FBQy9ELG9CQUFvQixDQUFDMkIsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3dCLFdBQVcsQ0FBQ3NCLFdBQVcsQ0FBQyxDQUFBO1FBQ2hFLElBQUksQ0FBQ2xGLG9CQUFvQixDQUFDNkMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3dCLFdBQVcsQ0FBQ3VCLGVBQWUsQ0FBQyxDQUFBO0FBRXBFLFFBQUEsTUFBTUMsc0JBQXNCLEdBQUksSUFBSSxHQUFHVixlQUFlLENBQUNVLHNCQUF1QixDQUFBO0FBQzlFLFFBQUEsTUFBTUMsY0FBYyxHQUFHekIsV0FBVyxDQUFDMEIsWUFBWSxHQUFHWixlQUFlLENBQUNhLFlBQVksQ0FBQ0MsWUFBWSxDQUFDQyxLQUFLLENBQUE7UUFDakcsSUFBSSxDQUFDM0UsdUJBQXVCLENBQUMrQixHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDaUQsY0FBYyxHQUFHRCxzQkFBc0IsQ0FBQyxDQUFBO0FBRW5GLFFBQUEsTUFBTU0sWUFBWSxHQUFHOUIsV0FBVyxDQUFDK0IsbUJBQW1CLENBQUE7UUFDcERELFlBQVksQ0FBQ2pJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdkJpSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdoQixlQUFlLENBQUNrQixzQkFBc0IsQ0FBQTtRQUN4REYsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHaEIsZUFBZSxDQUFDYSxZQUFZLENBQUNNLFFBQVEsQ0FBQTtRQUN2REgsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHaEIsZUFBZSxDQUFDYSxZQUFZLENBQUNPLFNBQVMsQ0FBQTtBQUN4REosUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUNuQixJQUFJLENBQUMzRSxtQkFBbUIsQ0FBQzhCLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNzRCxZQUFZLENBQUMsQ0FBQTtBQUVwRCxRQUFBLE1BQU1LLE1BQU0sR0FBR25DLFdBQVcsQ0FBQ29DLG1CQUFtQixDQUFBO1FBQzlDRCxNQUFNLENBQUN0SSxNQUFNLEdBQUcsQ0FBQyxDQUFBO1FBQ2pCc0ksTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHbkMsV0FBVyxDQUFDcUMsaUJBQWlCLENBQUM7QUFDMUNGLFFBQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR25CLE1BQU0sQ0FBQ3NCLFVBQVUsQ0FBQTtBQUM3QkgsUUFBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHbkIsTUFBTSxDQUFDdUIsSUFBSSxDQUFBO0FBQ3ZCSixRQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQ2IsSUFBSSxDQUFDaEcsbUJBQW1CLENBQUM4QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDMkQsTUFBTSxDQUFDLENBQUE7QUFDbEQsT0FBQTtBQUNBbEQsTUFBQUEsR0FBRyxFQUFFLENBQUE7QUFDVCxLQUFBO0FBQ0EsSUFBQSxPQUFPQSxHQUFHLENBQUE7QUFDZCxHQUFBO0FBRUF1RCxFQUFBQSxxQkFBcUJBLENBQUN4RCxHQUFHLEVBQUVDLEdBQUcsRUFBRTtBQUM1QixJQUFBLE1BQU1PLE1BQU0sR0FBR1IsR0FBRyxDQUFDUyxlQUFlLENBQUMsSUFBSUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ3hELElBQUksQ0FBQ2xELFVBQVUsQ0FBQ3lDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHTyxNQUFNLENBQUNILENBQUMsQ0FBQTtJQUNsQyxJQUFJLENBQUM3QyxVQUFVLENBQUN5QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR08sTUFBTSxDQUFDRixDQUFDLENBQUE7SUFDbEMsSUFBSSxDQUFDOUMsVUFBVSxDQUFDeUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdPLE1BQU0sQ0FBQ0QsQ0FBQyxDQUFBO0FBQ2xDLElBQUEsSUFBSSxDQUFDOUMsWUFBWSxDQUFDd0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUNoQyxVQUFVLENBQUN5QyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBRXJELElBQUEsTUFBTVUsT0FBTyxHQUFHWCxHQUFHLENBQUNTLGVBQWUsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBQ3hELElBQUksQ0FBQ2hELFdBQVcsQ0FBQ3VDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHVSxPQUFPLENBQUNOLENBQUMsQ0FBQTtJQUNwQyxJQUFJLENBQUMzQyxXQUFXLENBQUN1QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR1UsT0FBTyxDQUFDTCxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDNUMsV0FBVyxDQUFDdUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdVLE9BQU8sQ0FBQ0osQ0FBQyxDQUFBO0FBQ3BDLElBQUEsSUFBSSxDQUFDNUMsYUFBYSxDQUFDc0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUM5QixXQUFXLENBQUN1QyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQzNELEdBQUE7RUFFQXdELGlCQUFpQkEsQ0FBQ3pFLEtBQUssRUFBRTdDLEtBQUssRUFBRXVILElBQUksRUFBRXpELEdBQUcsRUFBRTtJQUN2QyxNQUFNRCxHQUFHLEdBQUcwRCxJQUFJLENBQUN6QyxLQUFLLENBQUNDLGlCQUFpQixFQUFFLENBQUE7QUFFMUMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDcEUsWUFBWSxDQUFDbUQsR0FBRyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNKLGFBQWEsQ0FBQzFELEtBQUssRUFBRThELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7SUFFQSxJQUFJLENBQUM1QyxhQUFhLENBQUM0QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDa0UsSUFBSSxDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUNyRCxJQUFBLElBQUksQ0FBQzdHLFlBQVksQ0FBQ21ELEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNSLEtBQUssQ0FBQ0ksZUFBZSxHQUFHc0UsSUFBSSxDQUFDdkMsaUJBQWlCLEdBQUd1QyxJQUFJLENBQUN0QyxXQUFXLENBQUMsQ0FBQTtBQUNsR3BCLElBQUFBLEdBQUcsQ0FBQzRELGNBQWMsQ0FBQ0YsSUFBSSxDQUFDRyxTQUFTLENBQUMsQ0FBQTtBQUNsQyxJQUFBLElBQUksQ0FBQ3ZHLFFBQVEsQ0FBQzJDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHeUQsSUFBSSxDQUFDRyxTQUFTLENBQUN4RCxDQUFDLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUMvQyxRQUFRLENBQUMyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR3lELElBQUksQ0FBQ0csU0FBUyxDQUFDdkQsQ0FBQyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDaEQsUUFBUSxDQUFDMkMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUd5RCxJQUFJLENBQUNHLFNBQVMsQ0FBQ3RELENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQ2hELFVBQVUsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDbEMsUUFBUSxDQUFDMkMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRCxJQUFBLElBQUl5RCxJQUFJLENBQUNqQyxLQUFLLEtBQUtDLG1CQUFtQixFQUFFO0FBQ3BDO0FBQ0EsTUFBQSxJQUFJLENBQUM4QixxQkFBcUIsQ0FBQ3hELEdBQUcsRUFBRUMsR0FBRyxDQUFDLENBQUE7QUFDeEMsS0FBQTtJQUVBLElBQUl5RCxJQUFJLENBQUM3QixXQUFXLEVBQUU7QUFFbEI7TUFDQSxNQUFNQyxlQUFlLEdBQUc0QixJQUFJLENBQUMzQixhQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFBO01BQ25ELElBQUksQ0FBQzlFLGdCQUFnQixDQUFDZ0QsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3NDLGVBQWUsQ0FBQ0ksWUFBWSxDQUFDLENBQUE7QUFFakUsTUFBQSxNQUFNRixNQUFNLEdBQUcwQixJQUFJLENBQUN6QixxQkFBcUIsQ0FBQ0gsZUFBZSxDQUFDLENBQUE7QUFDMUQsTUFBQSxNQUFNcUIsTUFBTSxHQUFHTyxJQUFJLENBQUNOLG1CQUFtQixDQUFBO01BQ3ZDRCxNQUFNLENBQUN0SSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCc0ksTUFBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHTyxJQUFJLENBQUNMLGlCQUFpQixDQUFBO0FBQ2xDRixNQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUduQixNQUFNLENBQUNzQixVQUFVLENBQUE7QUFDN0JILE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR25CLE1BQU0sQ0FBQ3VCLElBQUksQ0FBQTtNQUN2QkosTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBR08sSUFBSSxDQUFDQyxjQUFjLENBQUE7TUFDckMsSUFBSSxDQUFDeEcsbUJBQW1CLENBQUM4QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDMkQsTUFBTSxDQUFDLENBQUE7TUFDOUMsSUFBSSxDQUFDL0Ysb0JBQW9CLENBQUM2QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDa0UsSUFBSSxDQUFDbkIsZUFBZSxDQUFDLENBQUE7QUFFN0QsTUFBQSxNQUFNRSxjQUFjLEdBQUdpQixJQUFJLENBQUNoQixZQUFZLEdBQUdaLGVBQWUsQ0FBQ2EsWUFBWSxDQUFDQyxZQUFZLENBQUNDLEtBQUssQ0FBQTtNQUMxRixJQUFJLENBQUMzRSx1QkFBdUIsQ0FBQytCLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNpRCxjQUFjLENBQUMsQ0FBQTtBQUMxRCxNQUFBLE1BQU1LLFlBQVksR0FBR1ksSUFBSSxDQUFDWCxtQkFBbUIsQ0FBQTtNQUU3Q0QsWUFBWSxDQUFDakksTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN2QmlJLE1BQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR2hCLGVBQWUsQ0FBQ2tCLHNCQUFzQixDQUFBO01BQ3hERixZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdoQixlQUFlLENBQUNhLFlBQVksQ0FBQ00sUUFBUSxDQUFBO01BQ3ZESCxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdoQixlQUFlLENBQUNhLFlBQVksQ0FBQ08sU0FBUyxDQUFBO0FBQ3hESixNQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO01BQ25CLElBQUksQ0FBQzNFLG1CQUFtQixDQUFDOEIsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3NELFlBQVksQ0FBQyxDQUFBO0FBQ3hELEtBQUE7SUFDQSxJQUFJWSxJQUFJLENBQUNJLE9BQU8sRUFBRTtNQUNkLElBQUksQ0FBQ2hHLGFBQWEsQ0FBQ21DLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNrRSxJQUFJLENBQUNJLE9BQU8sQ0FBQyxDQUFBO01BQzlDLElBQUksQ0FBQzVHLG1CQUFtQixDQUFDK0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ1EsR0FBRyxDQUFDSixJQUFJLENBQUMsQ0FBQTtNQUNoRCxJQUFJLENBQUM3QixnQkFBZ0IsQ0FBQ2tDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNrRSxJQUFJLENBQUNLLGVBQWUsQ0FBQyxDQUFBO0FBQzdELEtBQUE7QUFDSixHQUFBO0VBRUFDLGlCQUFpQkEsQ0FBQ2hGLEtBQUssRUFBRTdDLEtBQUssRUFBRThILElBQUksRUFBRWhFLEdBQUcsRUFBRTtJQUN2QyxNQUFNRCxHQUFHLEdBQUdpRSxJQUFJLENBQUNoRCxLQUFLLENBQUNDLGlCQUFpQixFQUFFLENBQUE7QUFFMUMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDcEUsWUFBWSxDQUFDbUQsR0FBRyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNKLGFBQWEsQ0FBQzFELEtBQUssRUFBRThELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7SUFFQSxJQUFJLENBQUNyQyxjQUFjLENBQUNxQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDeUUsSUFBSSxDQUFDQyxrQkFBa0IsQ0FBQyxDQUFBO0lBQzFELElBQUksQ0FBQ3JHLGVBQWUsQ0FBQ29DLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5RSxJQUFJLENBQUNFLGtCQUFrQixDQUFDLENBQUE7SUFDM0QsSUFBSSxDQUFDOUcsYUFBYSxDQUFDNEMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3lFLElBQUksQ0FBQ04sY0FBYyxDQUFDLENBQUE7QUFDckQsSUFBQSxJQUFJLENBQUM3RyxZQUFZLENBQUNtRCxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDUixLQUFLLENBQUNJLGVBQWUsR0FBRzZFLElBQUksQ0FBQzlDLGlCQUFpQixHQUFHOEMsSUFBSSxDQUFDN0MsV0FBVyxDQUFDLENBQUE7QUFDbEdwQixJQUFBQSxHQUFHLENBQUM0RCxjQUFjLENBQUNLLElBQUksQ0FBQ0osU0FBUyxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJLENBQUN2RyxRQUFRLENBQUMyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2dFLElBQUksQ0FBQ0osU0FBUyxDQUFDeEQsQ0FBQyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDL0MsUUFBUSxDQUFDMkMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdnRSxJQUFJLENBQUNKLFNBQVMsQ0FBQ3ZELENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQ2hELFFBQVEsQ0FBQzJDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHZ0UsSUFBSSxDQUFDSixTQUFTLENBQUN0RCxDQUFDLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUNoRCxVQUFVLENBQUMwQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQ2xDLFFBQVEsQ0FBQzJDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFakQsSUFBQSxJQUFJZ0UsSUFBSSxDQUFDeEMsS0FBSyxLQUFLQyxtQkFBbUIsRUFBRTtBQUNwQztBQUNBLE1BQUEsSUFBSSxDQUFDOEIscUJBQXFCLENBQUN4RCxHQUFHLEVBQUVDLEdBQUcsQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7O0FBRUE7QUFDQUQsSUFBQUEsR0FBRyxDQUFDcUIsSUFBSSxDQUFDNEMsSUFBSSxDQUFDM0MsVUFBVSxDQUFDLENBQUNDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3ZDMEMsSUFBQUEsSUFBSSxDQUFDM0MsVUFBVSxDQUFDRSxTQUFTLEVBQUUsQ0FBQTtBQUMzQixJQUFBLElBQUksQ0FBQ3pFLFFBQVEsQ0FBQ2tELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHZ0UsSUFBSSxDQUFDM0MsVUFBVSxDQUFDakIsQ0FBQyxDQUFBO0FBQ3pDLElBQUEsSUFBSSxDQUFDdEQsUUFBUSxDQUFDa0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdnRSxJQUFJLENBQUMzQyxVQUFVLENBQUNoQixDQUFDLENBQUE7QUFDekMsSUFBQSxJQUFJLENBQUN2RCxRQUFRLENBQUNrRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2dFLElBQUksQ0FBQzNDLFVBQVUsQ0FBQ2YsQ0FBQyxDQUFBO0FBQ3pDLElBQUEsSUFBSSxDQUFDdkQsVUFBVSxDQUFDaUQsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUN6QyxRQUFRLENBQUNrRCxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBRWpELElBQUlnRSxJQUFJLENBQUNwQyxXQUFXLEVBQUU7QUFFbEI7TUFDQSxNQUFNQyxlQUFlLEdBQUdtQyxJQUFJLENBQUNsQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFBO01BQ25ELElBQUksQ0FBQzlFLGdCQUFnQixDQUFDZ0QsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3NDLGVBQWUsQ0FBQ0ksWUFBWSxDQUFDLENBQUE7QUFFakUsTUFBQSxJQUFJLENBQUNoRixtQkFBbUIsQ0FBQytDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNzQyxlQUFlLENBQUNLLFlBQVksQ0FBQ3ZDLElBQUksQ0FBQyxDQUFBO0FBRXpFLE1BQUEsTUFBTW9DLE1BQU0sR0FBR2lDLElBQUksQ0FBQ2hDLHFCQUFxQixDQUFDSCxlQUFlLENBQUMsQ0FBQTtBQUMxRCxNQUFBLE1BQU1xQixNQUFNLEdBQUdjLElBQUksQ0FBQ2IsbUJBQW1CLENBQUE7TUFDdkNELE1BQU0sQ0FBQ3RJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDakJzSSxNQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUdjLElBQUksQ0FBQ1osaUJBQWlCLENBQUE7QUFDbENGLE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR25CLE1BQU0sQ0FBQ3NCLFVBQVUsQ0FBQTtBQUM3QkgsTUFBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHbkIsTUFBTSxDQUFDdUIsSUFBSSxDQUFBO01BQ3ZCSixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHYyxJQUFJLENBQUNOLGNBQWMsQ0FBQTtNQUNyQyxJQUFJLENBQUN4RyxtQkFBbUIsQ0FBQzhDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMyRCxNQUFNLENBQUMsQ0FBQTtNQUM5QyxJQUFJLENBQUMvRixvQkFBb0IsQ0FBQzZDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5RSxJQUFJLENBQUMxQixlQUFlLENBQUMsQ0FBQTtBQUU3RCxNQUFBLE1BQU1FLGNBQWMsR0FBR3dCLElBQUksQ0FBQ3ZCLFlBQVksR0FBR1osZUFBZSxDQUFDYSxZQUFZLENBQUNDLFlBQVksQ0FBQ0MsS0FBSyxDQUFBO0FBQzFGLE1BQUEsTUFBTXVCLEdBQUcsR0FBR3RDLGVBQWUsQ0FBQ2EsWUFBWSxDQUFDMEIsSUFBSSxHQUFHbEosSUFBSSxDQUFDbUosRUFBRSxHQUFHLEtBQUssQ0FBQTtNQUMvRCxNQUFNQyxRQUFRLEdBQUcsR0FBRyxHQUFHcEosSUFBSSxDQUFDcUosR0FBRyxDQUFDSixHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUE7TUFDMUMsSUFBSSxDQUFDbEcsdUJBQXVCLENBQUMrQixHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDaUQsY0FBYyxHQUFHOEIsUUFBUSxDQUFDLENBQUE7QUFFckUsTUFBQSxNQUFNekIsWUFBWSxHQUFHbUIsSUFBSSxDQUFDbEIsbUJBQW1CLENBQUE7TUFDN0NELFlBQVksQ0FBQ2pJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdkJpSSxNQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdoQixlQUFlLENBQUNrQixzQkFBc0IsQ0FBQTtNQUN4REYsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHaEIsZUFBZSxDQUFDYSxZQUFZLENBQUNNLFFBQVEsQ0FBQTtNQUN2REgsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHaEIsZUFBZSxDQUFDYSxZQUFZLENBQUNPLFNBQVMsQ0FBQTtBQUN4REosTUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtNQUNuQixJQUFJLENBQUMzRSxtQkFBbUIsQ0FBQzhCLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNzRCxZQUFZLENBQUMsQ0FBQTtBQUN4RCxLQUFBO0lBRUEsSUFBSW1CLElBQUksQ0FBQ0gsT0FBTyxFQUFFO0FBRWQ7QUFDQSxNQUFBLElBQUksQ0FBQ0csSUFBSSxDQUFDcEMsV0FBVyxFQUFFO0FBQ25CLFFBQUEsTUFBTTRDLFlBQVksR0FBR0MsV0FBVyxDQUFDQyxvQkFBb0IsQ0FBQ1YsSUFBSSxDQUFDLENBQUE7UUFDM0QsSUFBSSxDQUFDL0csbUJBQW1CLENBQUMrQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDaUYsWUFBWSxDQUFDN0UsSUFBSSxDQUFDLENBQUE7QUFDN0QsT0FBQTtNQUVBLElBQUksQ0FBQzlCLGFBQWEsQ0FBQ21DLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5RSxJQUFJLENBQUNILE9BQU8sQ0FBQyxDQUFBO01BQzlDLElBQUksQ0FBQy9GLGdCQUFnQixDQUFDa0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3lFLElBQUksQ0FBQ0YsZUFBZSxDQUFDLENBQUE7TUFDekQsSUFBSUUsSUFBSSxDQUFDVyxnQkFBZ0IsRUFBRTtRQUN2QlgsSUFBSSxDQUFDWSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBR1osSUFBSSxDQUFDVyxnQkFBZ0IsQ0FBQ3ZFLENBQUMsQ0FBQTtRQUN6RDRELElBQUksQ0FBQ1ksdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEdBQUdaLElBQUksQ0FBQ1csZ0JBQWdCLENBQUN0RSxDQUFDLENBQUE7UUFDekQyRCxJQUFJLENBQUNZLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxHQUFHWixJQUFJLENBQUNXLGdCQUFnQixDQUFDckUsQ0FBQyxDQUFBO1FBQ3pEMEQsSUFBSSxDQUFDWSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBR1osSUFBSSxDQUFDVyxnQkFBZ0IsQ0FBQ0UsQ0FBQyxDQUFBO1FBQ3pELElBQUksQ0FBQzlHLG1CQUFtQixDQUFDaUMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3lFLElBQUksQ0FBQ1ksdUJBQXVCLENBQUMsQ0FBQTtRQUNwRVosSUFBSSxDQUFDYyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsR0FBR2QsSUFBSSxDQUFDZSxhQUFhLENBQUMzRSxDQUFDLENBQUE7UUFDbkQ0RCxJQUFJLENBQUNjLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxHQUFHZCxJQUFJLENBQUNlLGFBQWEsQ0FBQzFFLENBQUMsQ0FBQTtRQUNuRCxJQUFJLENBQUNyQyxtQkFBbUIsQ0FBQ2dDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5RSxJQUFJLENBQUNjLG9CQUFvQixDQUFDLENBQUE7QUFDckUsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUFFLG1CQUFtQkEsQ0FBQ0MsWUFBWSxFQUFFbEcsS0FBSyxFQUFFOEIsSUFBSSxFQUFFcUUsYUFBYSxFQUFFO0lBRTFELElBQUlsRixHQUFHLEdBQUdrRixhQUFhLENBQUE7QUFDdkIsSUFBQSxNQUFNaEosS0FBSyxHQUFHLElBQUksQ0FBQ04sTUFBTSxDQUFDTSxLQUFLLENBQUE7QUFFL0IsSUFBQSxNQUFNaUosS0FBSyxHQUFHRixZQUFZLENBQUNHLGNBQWMsQ0FBQyxDQUFBO0FBQzFDLElBQUEsTUFBTUMsUUFBUSxHQUFHRixLQUFLLENBQUN2SyxNQUFNLENBQUE7SUFDN0IsS0FBSyxJQUFJSSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdxSyxRQUFRLEVBQUVySyxDQUFDLEVBQUUsRUFBRTtBQUMvQixNQUFBLE1BQU15SSxJQUFJLEdBQUcwQixLQUFLLENBQUNuSyxDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLElBQUksRUFBRXlJLElBQUksQ0FBQzVDLElBQUksR0FBR0EsSUFBSSxDQUFDLEVBQUUsU0FBQTtNQUN6QixJQUFJLENBQUMyQyxpQkFBaUIsQ0FBQ3pFLEtBQUssRUFBRTdDLEtBQUssRUFBRXVILElBQUksRUFBRXpELEdBQUcsQ0FBQyxDQUFBO0FBQy9DQSxNQUFBQSxHQUFHLEVBQUUsQ0FBQTtBQUNULEtBQUE7QUFFQSxJQUFBLE1BQU1zRixJQUFJLEdBQUdMLFlBQVksQ0FBQ00sY0FBYyxDQUFDLENBQUE7QUFDekMsSUFBQSxNQUFNQyxPQUFPLEdBQUdGLElBQUksQ0FBQzFLLE1BQU0sQ0FBQTtJQUMzQixLQUFLLElBQUlJLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3dLLE9BQU8sRUFBRXhLLENBQUMsRUFBRSxFQUFFO0FBQzlCLE1BQUEsTUFBTWdKLElBQUksR0FBR3NCLElBQUksQ0FBQ3RLLENBQUMsQ0FBQyxDQUFBO0FBQ3BCLE1BQUEsSUFBSSxFQUFFZ0osSUFBSSxDQUFDbkQsSUFBSSxHQUFHQSxJQUFJLENBQUMsRUFBRSxTQUFBO01BQ3pCLElBQUksQ0FBQ2tELGlCQUFpQixDQUFDaEYsS0FBSyxFQUFFN0MsS0FBSyxFQUFFOEgsSUFBSSxFQUFFaEUsR0FBRyxDQUFDLENBQUE7QUFDL0NBLE1BQUFBLEdBQUcsRUFBRSxDQUFBO0FBQ1QsS0FBQTtBQUNKLEdBQUE7O0FBRUE7RUFDQXlGLDZCQUE2QkEsQ0FBQzNFLE1BQU0sRUFBRXZHLFNBQVMsRUFBRTBLLFlBQVksRUFBRVMsS0FBSyxFQUFFQyxJQUFJLEVBQUU7QUFBQSxJQUFBLElBQUFDLG1CQUFBLENBQUE7SUFFeEUsTUFBTUMsT0FBTyxHQUFHQSxDQUFDQyxRQUFRLEVBQUVDLGNBQWMsRUFBRXRMLGFBQWEsRUFBRUMsZ0JBQWdCLEtBQUs7QUFDM0VKLE1BQUFBLGFBQWEsQ0FBQ0MsU0FBUyxDQUFDYSxJQUFJLENBQUMwSyxRQUFRLENBQUMsQ0FBQTtBQUN0Q3hMLE1BQUFBLGFBQWEsQ0FBQ0UsZUFBZSxDQUFDWSxJQUFJLENBQUMySyxjQUFjLENBQUMsQ0FBQTtBQUNsRHpMLE1BQUFBLGFBQWEsQ0FBQ0csYUFBYSxDQUFDVyxJQUFJLENBQUNYLGFBQWEsQ0FBQyxDQUFBO0FBQy9DSCxNQUFBQSxhQUFhLENBQUNJLGdCQUFnQixDQUFDVSxJQUFJLENBQUNWLGdCQUFnQixDQUFDLENBQUE7S0FDeEQsQ0FBQTs7QUFFRDtJQUNBSixhQUFhLENBQUNLLEtBQUssRUFBRSxDQUFBO0FBRXJCLElBQUEsTUFBTWlCLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtBQUMxQixJQUFBLE1BQU1tRCxLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUE7QUFDeEIsSUFBQSxNQUFNaUgsd0JBQXdCLEdBQUdqSCxLQUFLLENBQUNpSCx3QkFBd0IsQ0FBQTtBQUMvRCxJQUFBLE1BQU1DLFNBQVMsR0FBQSxDQUFBTCxtQkFBQSxHQUFHRixLQUFLLElBQUxBLElBQUFBLEdBQUFBLEtBQUFBLENBQUFBLEdBQUFBLEtBQUssQ0FBRVEsWUFBWSxDQUFDRix3QkFBd0IsQ0FBQyxLQUFBSixJQUFBQSxHQUFBQSxtQkFBQSxHQUFJLENBQUMsQ0FBQTtJQUNwRSxJQUFJTyxZQUFZLEdBQUcsSUFBSTtNQUFFQyxXQUFXO01BQUVDLGFBQWEsQ0FBQTtBQUVuRCxJQUFBLE1BQU1DLGNBQWMsR0FBRy9MLFNBQVMsQ0FBQ0ssTUFBTSxDQUFBO0lBQ3ZDLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHc0wsY0FBYyxFQUFFdEwsQ0FBQyxFQUFFLEVBQUU7QUFFckM7QUFDQSxNQUFBLE1BQU04SyxRQUFRLEdBQUd2TCxTQUFTLENBQUNTLENBQUMsQ0FBQyxDQUFBO0FBRzdCLE1BQUEsSUFBSThGLE1BQU0sS0FBS3RGLGVBQWUsQ0FBQytLLGdCQUFnQixFQUFFO0FBQzdDLFFBQUEsSUFBSS9LLGVBQWUsQ0FBQ2dMLGtCQUFrQixJQUFJaEwsZUFBZSxDQUFDaUwsZUFBZSxFQUNyRSxTQUFBO1FBQ0pqTCxlQUFlLENBQUNnTCxrQkFBa0IsRUFBRSxDQUFBO0FBQ3hDLE9BQUE7QUFDQSxNQUFBLElBQUlkLEtBQUssRUFBRTtBQUNQLFFBQUEsSUFBSUEsS0FBSyxDQUFDYyxrQkFBa0IsSUFBSWQsS0FBSyxDQUFDZSxlQUFlLEVBQ2pELFNBQUE7UUFDSmYsS0FBSyxDQUFDYyxrQkFBa0IsRUFBRSxDQUFBO0FBQzlCLE9BQUE7QUFHQVYsTUFBQUEsUUFBUSxDQUFDWSxjQUFjLENBQUM5SyxNQUFNLENBQUMsQ0FBQTtBQUMvQixNQUFBLE1BQU0rSyxRQUFRLEdBQUdiLFFBQVEsQ0FBQ2EsUUFBUSxDQUFBO0FBRWxDLE1BQUEsTUFBTUMsT0FBTyxHQUFHZCxRQUFRLENBQUNlLFdBQVcsQ0FBQTtBQUNwQyxNQUFBLE1BQU1DLFNBQVMsR0FBR2hCLFFBQVEsQ0FBQ2pGLElBQUksQ0FBQTtNQUUvQixJQUFJOEYsUUFBUSxJQUFJQSxRQUFRLEtBQUtSLFlBQVksSUFBSVMsT0FBTyxLQUFLUixXQUFXLEVBQUU7UUFDbEVELFlBQVksR0FBRyxJQUFJLENBQUM7QUFDeEIsT0FBQTs7TUFFQSxJQUFJUSxRQUFRLEtBQUtSLFlBQVksRUFBRTtRQUMzQixJQUFJLENBQUNySyxpQkFBaUIsRUFBRSxDQUFBO1FBQ3hCNkssUUFBUSxDQUFDSSxNQUFNLEdBQUdoSSxLQUFLLENBQUE7UUFFdkIsSUFBSTRILFFBQVEsQ0FBQ0ssS0FBSyxFQUFFO0FBQ2hCTCxVQUFBQSxRQUFRLENBQUNNLGNBQWMsQ0FBQ3JMLE1BQU0sRUFBRW1ELEtBQUssQ0FBQyxDQUFBO1VBQ3RDNEgsUUFBUSxDQUFDSyxLQUFLLEdBQUcsS0FBSyxDQUFBO0FBQzFCLFNBQUE7QUFDSixPQUFBOztBQUVBO0FBQ0FFLE1BQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDdkwsTUFBTSxFQUFHLENBQUEsTUFBQSxFQUFRa0ssUUFBUSxDQUFDc0IsSUFBSSxDQUFDQyxJQUFLLENBQUEsQ0FBQyxDQUFDLENBQUE7TUFFbEUsTUFBTXRCLGNBQWMsR0FBR0QsUUFBUSxDQUFDd0IsaUJBQWlCLENBQUMzQixJQUFJLEVBQUVNLFNBQVMsRUFBRWxILEtBQUssRUFBRSxJQUFJLENBQUN3SSxpQkFBaUIsRUFBRSxJQUFJLENBQUNDLG1CQUFtQixFQUFFdkMsWUFBWSxDQUFDLENBQUE7QUFFeklpQyxNQUFBQSxhQUFhLENBQUNPLFlBQVksQ0FBQzdMLE1BQU0sQ0FBQyxDQUFBO0FBRWxDaUssTUFBQUEsT0FBTyxDQUFDQyxRQUFRLEVBQUVDLGNBQWMsRUFBRVksUUFBUSxLQUFLUixZQUFZLEVBQUUsQ0FBQ0EsWUFBWSxJQUFJVyxTQUFTLEtBQUtULGFBQWEsQ0FBQyxDQUFBO0FBRTFHRixNQUFBQSxZQUFZLEdBQUdRLFFBQVEsQ0FBQTtBQUN2QlAsTUFBQUEsV0FBVyxHQUFHUSxPQUFPLENBQUE7QUFDckJQLE1BQUFBLGFBQWEsR0FBR1MsU0FBUyxDQUFBO0FBQzdCLEtBQUE7O0FBRUE7QUFDQWxMLElBQUFBLE1BQU0sQ0FBQzhMLGNBQWMsSUFBQSxJQUFBLElBQXJCOUwsTUFBTSxDQUFDOEwsY0FBYyxFQUFJLENBQUE7QUFFekIsSUFBQSxPQUFPcE4sYUFBYSxDQUFBO0FBQ3hCLEdBQUE7QUFFQXFOLEVBQUFBLHFCQUFxQkEsQ0FBQzdHLE1BQU0sRUFBRThHLGFBQWEsRUFBRTNDLFlBQVksRUFBRVUsSUFBSSxFQUFFa0MsWUFBWSxFQUFFQyxTQUFTLEVBQUU7QUFDdEYsSUFBQSxNQUFNbE0sTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0FBQzFCLElBQUEsTUFBTW1ELEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTtBQUN4QixJQUFBLE1BQU1nSixRQUFRLEdBQUcsQ0FBQyxJQUFJcEMsSUFBSSxDQUFBO0FBQzFCLElBQUEsTUFBTXFDLFVBQVUsR0FBR0YsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQyxJQUFBLE1BQU05Qix3QkFBd0IsR0FBRyxJQUFJLENBQUNqSCxLQUFLLENBQUNpSCx3QkFBd0IsQ0FBQTs7QUFFcEU7SUFDQSxJQUFJaUMsWUFBWSxHQUFHLEtBQUssQ0FBQTtBQUN4QixJQUFBLE1BQU1DLGtCQUFrQixHQUFHTixhQUFhLENBQUNyTixTQUFTLENBQUNLLE1BQU0sQ0FBQTtJQUN6RCxLQUFLLElBQUlJLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2tOLGtCQUFrQixFQUFFbE4sQ0FBQyxFQUFFLEVBQUU7TUFBQSxJQUFBbU4scUJBQUEsRUFBQUMscUJBQUEsQ0FBQTtBQUV6QyxNQUFBLE1BQU10QyxRQUFRLEdBQUc4QixhQUFhLENBQUNyTixTQUFTLENBQUNTLENBQUMsQ0FBQyxDQUFBOztBQUUzQztBQUNBLE1BQUEsTUFBTXFOLFdBQVcsR0FBR1QsYUFBYSxDQUFDbk4sYUFBYSxDQUFDTyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxNQUFBLE1BQU1OLGdCQUFnQixHQUFHa04sYUFBYSxDQUFDbE4sZ0JBQWdCLENBQUNNLENBQUMsQ0FBQyxDQUFBO0FBQzFELE1BQUEsTUFBTStLLGNBQWMsR0FBRzZCLGFBQWEsQ0FBQ3BOLGVBQWUsQ0FBQ1EsQ0FBQyxDQUFDLENBQUE7QUFDdkQsTUFBQSxNQUFNMkwsUUFBUSxHQUFHYixRQUFRLENBQUNhLFFBQVEsQ0FBQTtBQUNsQyxNQUFBLE1BQU1DLE9BQU8sR0FBR2QsUUFBUSxDQUFDZSxXQUFXLENBQUE7QUFDcEMsTUFBQSxNQUFNQyxTQUFTLEdBQUdoQixRQUFRLENBQUNqRixJQUFJLENBQUE7QUFFL0IsTUFBQSxJQUFJd0gsV0FBVyxFQUFFO0FBRWIsUUFBQSxNQUFNQyxNQUFNLEdBQUd2QyxjQUFjLENBQUN1QyxNQUFNLENBQUE7QUFDcEMsUUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0MsTUFBTSxJQUFJLENBQUMzTSxNQUFNLENBQUM0TSxTQUFTLENBQUNGLE1BQU0sQ0FBQyxFQUFFO0FBQzdDRyxVQUFBQSxLQUFLLENBQUNDLEtBQUssQ0FBRSwyQkFBMEJKLE1BQU0sQ0FBQ0ssS0FBTSxDQUFpQmhDLGVBQUFBLEVBQUFBLFFBQVEsQ0FBQ1UsSUFBSyxTQUFRMUIsSUFBSyxDQUFBLFNBQUEsRUFBV2lCLE9BQVEsQ0FBQyxDQUFBLEVBQUVELFFBQVEsQ0FBQyxDQUFBO0FBQ25JLFNBQUE7O0FBRUE7UUFDQXNCLFlBQVksR0FBR0ssTUFBTSxDQUFDQyxNQUFNLENBQUE7QUFDNUIsUUFBQSxJQUFJTixZQUFZLEVBQ1osTUFBQTtRQUVKZixhQUFhLENBQUNDLGFBQWEsQ0FBQ3ZMLE1BQU0sRUFBRyxhQUFZK0ssUUFBUSxDQUFDVSxJQUFLLENBQUEsQ0FBQyxDQUFDLENBQUE7O0FBRWpFO0FBQ0FWLFFBQUFBLFFBQVEsQ0FBQ2lDLGFBQWEsQ0FBQ2hOLE1BQU0sQ0FBQyxDQUFBO0FBRTlCLFFBQUEsSUFBSWxCLGdCQUFnQixFQUFFO0FBQ2xCLFVBQUEsTUFBTXdLLGFBQWEsR0FBRyxJQUFJLENBQUN2RSxvQkFBb0IsQ0FBQ3NFLFlBQVksQ0FBQzRELHFCQUFxQixDQUFDLEVBQUU5SixLQUFLLEVBQUUrSCxTQUFTLEVBQUVoRyxNQUFNLENBQUMsQ0FBQTtVQUU5RyxJQUFJLENBQUNrRix3QkFBd0IsRUFBRTtZQUMzQixJQUFJLENBQUNoQixtQkFBbUIsQ0FBQ0MsWUFBWSxFQUFFbEcsS0FBSyxFQUFFK0gsU0FBUyxFQUFFNUIsYUFBYSxDQUFDLENBQUE7QUFDM0UsV0FBQTtBQUNKLFNBQUE7UUFFQSxJQUFJLENBQUM0RCxXQUFXLENBQUN2SixRQUFRLENBQUNvSCxRQUFRLENBQUNvQyxTQUFTLENBQUMsQ0FBQTtBQUU3Q25OLFFBQUFBLE1BQU0sQ0FBQ29OLGFBQWEsQ0FBQ3JDLFFBQVEsQ0FBQ3NDLFVBQVUsQ0FBQyxDQUFBO0FBQ3pDck4sUUFBQUEsTUFBTSxDQUFDc04sYUFBYSxDQUFDdkMsUUFBUSxDQUFDd0MsVUFBVSxDQUFDLENBQUE7QUFDekN2TixRQUFBQSxNQUFNLENBQUN3TixrQkFBa0IsQ0FBQ3pDLFFBQVEsQ0FBQzBDLGVBQWUsQ0FBQyxDQUFBO0FBRW5EbkMsUUFBQUEsYUFBYSxDQUFDTyxZQUFZLENBQUM3TCxNQUFNLENBQUMsQ0FBQTtBQUN0QyxPQUFBO0FBRUFzTCxNQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQ3ZMLE1BQU0sRUFBRyxDQUFBLE1BQUEsRUFBUWtLLFFBQVEsQ0FBQ3NCLElBQUksQ0FBQ0MsSUFBSyxDQUFBLENBQUMsQ0FBQyxDQUFBO01BRWxFLElBQUksQ0FBQ2lDLGFBQWEsQ0FBQ3hJLE1BQU0sQ0FBQ3lJLFVBQVUsRUFBRXZCLFVBQVUsRUFBRWxDLFFBQVEsQ0FBQyxDQUFBO0FBRTNELE1BQUEsTUFBTTBELFlBQVksR0FBQSxDQUFBckIscUJBQUEsR0FBR3JDLFFBQVEsQ0FBQzBELFlBQVksS0FBQSxJQUFBLEdBQUFyQixxQkFBQSxHQUFJeEIsUUFBUSxDQUFDNkMsWUFBWSxDQUFBO0FBQ25FLE1BQUEsTUFBTUMsV0FBVyxHQUFBLENBQUFyQixxQkFBQSxHQUFHdEMsUUFBUSxDQUFDMkQsV0FBVyxLQUFBLElBQUEsR0FBQXJCLHFCQUFBLEdBQUl6QixRQUFRLENBQUM4QyxXQUFXLENBQUE7QUFDaEU3TixNQUFBQSxNQUFNLENBQUM4TixlQUFlLENBQUNGLFlBQVksRUFBRUMsV0FBVyxDQUFDLENBQUE7QUFFakQsTUFBQSxNQUFNRSxJQUFJLEdBQUc3RCxRQUFRLENBQUM2RCxJQUFJLENBQUE7O0FBRTFCO0FBQ0E3RCxNQUFBQSxRQUFRLENBQUM4QyxhQUFhLENBQUNoTixNQUFNLEVBQUVtTSxRQUFRLENBQUMsQ0FBQTtBQUV4QyxNQUFBLElBQUksQ0FBQzZCLGdCQUFnQixDQUFDaE8sTUFBTSxFQUFFK04sSUFBSSxDQUFDLENBQUE7TUFDbkMsSUFBSSxDQUFDRSxXQUFXLENBQUNqTyxNQUFNLEVBQUVrSyxRQUFRLENBQUNnRSxhQUFhLENBQUMsQ0FBQTtBQUNoRCxNQUFBLElBQUksQ0FBQ0MsV0FBVyxDQUFDbk8sTUFBTSxFQUFFa0ssUUFBUSxDQUFDLENBQUE7QUFFbEMsTUFBQSxJQUFJLENBQUNrRSx1QkFBdUIsQ0FBQ2pFLGNBQWMsRUFBRUQsUUFBUSxDQUFDLENBQUE7QUFFdEQsTUFBQSxNQUFNbUUsS0FBSyxHQUFHbkUsUUFBUSxDQUFDb0UsV0FBVyxDQUFBO01BQ2xDdE8sTUFBTSxDQUFDdU8sY0FBYyxDQUFDUixJQUFJLENBQUNTLFdBQVcsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUU5Q3BDLE1BQUFBLFlBQVksWUFBWkEsWUFBWSxDQUFHL0IsUUFBUSxFQUFFOUssQ0FBQyxDQUFDLENBQUE7QUFFM0IsTUFBQSxJQUFJOEYsTUFBTSxDQUFDdUosRUFBRSxJQUFJdkosTUFBTSxDQUFDdUosRUFBRSxDQUFDQyxPQUFPLElBQUl4SixNQUFNLENBQUN1SixFQUFFLENBQUNFLEtBQUssQ0FBQ0MsSUFBSSxDQUFDNVAsTUFBTSxFQUFFO0FBQy9ELFFBQUEsTUFBTTJQLEtBQUssR0FBR3pKLE1BQU0sQ0FBQ3VKLEVBQUUsQ0FBQ0UsS0FBSyxDQUFBO0FBRTdCLFFBQUEsS0FBSyxJQUFJRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLEtBQUssQ0FBQ0MsSUFBSSxDQUFDNVAsTUFBTSxFQUFFNlAsQ0FBQyxFQUFFLEVBQUU7QUFDeEMsVUFBQSxNQUFNQyxJQUFJLEdBQUdILEtBQUssQ0FBQ0MsSUFBSSxDQUFDQyxDQUFDLENBQUMsQ0FBQTtVQUUxQjdPLE1BQU0sQ0FBQytPLFdBQVcsQ0FBQ0QsSUFBSSxDQUFDRSxRQUFRLENBQUN4SyxDQUFDLEVBQUVzSyxJQUFJLENBQUNFLFFBQVEsQ0FBQ3ZLLENBQUMsRUFBRXFLLElBQUksQ0FBQ0UsUUFBUSxDQUFDdEssQ0FBQyxFQUFFb0ssSUFBSSxDQUFDRSxRQUFRLENBQUMvRixDQUFDLENBQUMsQ0FBQTtVQUV0RixJQUFJLENBQUNnRyxNQUFNLENBQUN0TCxRQUFRLENBQUNtTCxJQUFJLENBQUNJLE9BQU8sQ0FBQ25MLElBQUksQ0FBQyxDQUFBO1VBQ3ZDLElBQUksQ0FBQ29MLFlBQVksQ0FBQ3hMLFFBQVEsQ0FBQ21MLElBQUksQ0FBQ0ksT0FBTyxDQUFDbkwsSUFBSSxDQUFDLENBQUE7VUFDN0MsSUFBSSxDQUFDcUwsTUFBTSxDQUFDekwsUUFBUSxDQUFDbUwsSUFBSSxDQUFDTyxVQUFVLENBQUN0TCxJQUFJLENBQUMsQ0FBQTtVQUMxQyxJQUFJLENBQUN1TCxTQUFTLENBQUMzTCxRQUFRLENBQUNtTCxJQUFJLENBQUNTLGFBQWEsQ0FBQ3hMLElBQUksQ0FBQyxDQUFBO1VBQ2hELElBQUksQ0FBQ3lMLE9BQU8sQ0FBQzdMLFFBQVEsQ0FBQ21MLElBQUksQ0FBQ1csUUFBUSxDQUFDMUwsSUFBSSxDQUFDLENBQUE7VUFDekMsSUFBSSxDQUFDMkwsVUFBVSxDQUFDL0wsUUFBUSxDQUFDbUwsSUFBSSxDQUFDYSxjQUFjLENBQUM1TCxJQUFJLENBQUMsQ0FBQTtVQUNsRCxJQUFJLENBQUM2TCxTQUFTLENBQUNqTSxRQUFRLENBQUNtTCxJQUFJLENBQUNlLFlBQVksQ0FBQyxDQUFBO0FBQzFDLFVBQUEsSUFBSSxDQUFDQyxXQUFXLENBQUNuTSxRQUFRLENBQUNrTCxDQUFDLENBQUMsQ0FBQTtVQUU1QixJQUFJQSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQ1QsWUFBQSxJQUFJLENBQUNrQixZQUFZLENBQUMvUCxNQUFNLEVBQUVrSyxRQUFRLEVBQUU2RCxJQUFJLEVBQUVNLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMxRCxXQUFDLE1BQU07WUFDSCxJQUFJLENBQUMyQixhQUFhLENBQUNoUSxNQUFNLEVBQUVrSyxRQUFRLEVBQUU2RCxJQUFJLEVBQUVNLEtBQUssQ0FBQyxDQUFBO0FBQ3JELFdBQUE7VUFFQSxJQUFJLENBQUNwTyxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLFNBQUE7QUFDSixPQUFDLE1BQU07QUFDSCxRQUFBLElBQUksQ0FBQzhQLFlBQVksQ0FBQy9QLE1BQU0sRUFBRWtLLFFBQVEsRUFBRTZELElBQUksRUFBRU0sS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFBO1FBQ3RELElBQUksQ0FBQ3BPLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSWIsQ0FBQyxHQUFHa04sa0JBQWtCLEdBQUcsQ0FBQyxJQUFJLENBQUNOLGFBQWEsQ0FBQ25OLGFBQWEsQ0FBQ08sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO1FBQ25FMkwsUUFBUSxDQUFDaUMsYUFBYSxDQUFDaE4sTUFBTSxFQUFFa0ssUUFBUSxDQUFDK0YsVUFBVSxDQUFDLENBQUE7QUFDdkQsT0FBQTtBQUVBM0UsTUFBQUEsYUFBYSxDQUFDTyxZQUFZLENBQUM3TCxNQUFNLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBQ0osR0FBQTtBQUVBa1EsRUFBQUEsYUFBYUEsQ0FBQ2hMLE1BQU0sRUFBRWlMLFlBQVksRUFBRTlHLFlBQVksRUFBRVUsSUFBSSxFQUFFa0MsWUFBWSxFQUFFbkMsS0FBSyxFQUFFb0MsU0FBUyxFQUFFO0FBR3BGLElBQUEsTUFBTWtFLGdCQUFnQixHQUFHQyxHQUFHLEVBQUUsQ0FBQTs7QUFHOUI7QUFDQSxJQUFBLE1BQU1yRSxhQUFhLEdBQUcsSUFBSSxDQUFDbkMsNkJBQTZCLENBQUMzRSxNQUFNLEVBQUVpTCxZQUFZLEVBQUU5RyxZQUFZLEVBQUVTLEtBQUssRUFBRUMsSUFBSSxDQUFDLENBQUE7O0FBRXpHO0FBQ0EsSUFBQSxJQUFJLENBQUNnQyxxQkFBcUIsQ0FBQzdHLE1BQU0sRUFBRThHLGFBQWEsRUFBRTNDLFlBQVksRUFBRVUsSUFBSSxFQUFFa0MsWUFBWSxFQUFFQyxTQUFTLENBQUMsQ0FBQTtJQUU5RnhOLGFBQWEsQ0FBQ0ssS0FBSyxFQUFFLENBQUE7QUFHckIsSUFBQSxJQUFJLENBQUNxQixZQUFZLElBQUlpUSxHQUFHLEVBQUUsR0FBR0QsZ0JBQWdCLENBQUE7QUFFakQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRSxFQUFBQSxrQkFBa0JBLENBQUNwTCxNQUFNLEVBQUU2QixZQUFZLEVBQUUrQyxLQUFLLEVBQUV5RyxXQUFXLEVBQUVDLFVBQVUsRUFBRUMsY0FBYyxFQUFFQyxPQUFPLEdBQUcsRUFBRSxFQUFFO0FBQUEsSUFBQSxJQUFBQyxvQkFBQSxFQUFBQyxtQkFBQSxFQUFBQyxxQkFBQSxDQUFBO0lBRW5HLE1BQU07TUFBRTFOLEtBQUs7QUFBRW5ELE1BQUFBLE1BQUFBO0FBQU8sS0FBQyxHQUFHLElBQUksQ0FBQTtBQUM5QixJQUFBLE1BQU1vSyx3QkFBd0IsR0FBR2pILEtBQUssQ0FBQ2lILHdCQUF3QixDQUFBO0FBRS9ELElBQUEsSUFBSSxDQUFDMEcsYUFBYSxDQUFDNUwsTUFBTSxFQUFFNkIsWUFBWSxDQUFDLENBQUE7O0FBRXhDO0lBQ0EsTUFBTWdLLFVBQVUsR0FBQUosQ0FBQUEsb0JBQUEsR0FBR0QsT0FBTyxDQUFDTSxXQUFXLEtBQUEsSUFBQSxHQUFBTCxvQkFBQSxHQUFJLEtBQUssQ0FBQTtJQUMvQyxNQUFNTSxVQUFVLEdBQUFMLENBQUFBLG1CQUFBLEdBQUdGLE9BQU8sQ0FBQ08sVUFBVSxLQUFBLElBQUEsR0FBQUwsbUJBQUEsR0FBSSxLQUFLLENBQUE7SUFDOUMsTUFBTU0sWUFBWSxHQUFBTCxDQUFBQSxxQkFBQSxHQUFHSCxPQUFPLENBQUNRLFlBQVksS0FBQSxJQUFBLEdBQUFMLHFCQUFBLEdBQUksS0FBSyxDQUFBO0FBQ2xELElBQUEsSUFBSUUsVUFBVSxJQUFJRSxVQUFVLElBQUlDLFlBQVksRUFBRTtNQUMxQyxJQUFJLENBQUNuUyxLQUFLLENBQUNtRyxNQUFNLEVBQUU2TCxVQUFVLEVBQUVFLFVBQVUsRUFBRUMsWUFBWSxDQUFDLENBQUE7QUFDNUQsS0FBQTtJQUVBLElBQUlDLE9BQU8sRUFBRUMsV0FBVyxDQUFBO0FBQ3hCLElBQUEsSUFBSXRILEtBQUssRUFBRTtBQUVQLE1BQUEsTUFBTXVILFFBQVEsR0FBR2hCLEdBQUcsRUFBRSxDQUFBO0FBR3RCdkcsTUFBQUEsS0FBSyxDQUFDd0gsV0FBVyxDQUFDcE0sTUFBTSxFQUFFcUwsV0FBVyxDQUFDLENBQUE7QUFHdEMsTUFBQSxJQUFJLENBQUNsUSxTQUFTLElBQUlnUSxHQUFHLEVBQUUsR0FBR2dCLFFBQVEsQ0FBQTtBQUdsQyxNQUFBLE1BQU1FLGVBQWUsR0FBR3pILEtBQUssQ0FBQzBILGtCQUFrQixDQUFDdE0sTUFBTSxDQUFDLENBQUE7TUFDeERpTSxPQUFPLEdBQUdaLFdBQVcsR0FBR2dCLGVBQWUsQ0FBQ2hCLFdBQVcsR0FBR2dCLGVBQWUsQ0FBQ0UsTUFBTSxDQUFBOztBQUU1RTtNQUNBdE8sS0FBSyxDQUFDdU8sU0FBUyxDQUFDQyxnQkFBZ0IsQ0FBQzdILEtBQUssRUFBRXFILE9BQU8sRUFBRVosV0FBVyxDQUFDLENBQUE7O0FBRTdEO01BQ0EsSUFBSXpHLEtBQUssQ0FBQzhILGlCQUFpQixFQUFFO0FBQ3pCLFFBQUEsSUFBSSxDQUFDQyxTQUFTLENBQUNDLE1BQU0sQ0FBQzNPLEtBQUssQ0FBQ0MsWUFBWSxFQUFFMEcsS0FBSyxDQUFDaUksT0FBTyxDQUFDLENBQUE7UUFDeEQsSUFBSSxDQUFDQyxpQkFBaUIsQ0FBQ3JPLFFBQVEsQ0FBQyxJQUFJLENBQUNrTyxTQUFTLENBQUNJLE1BQU0sQ0FBQyxDQUFBO0FBQzFELE9BQUE7TUFFQWIsV0FBVyxHQUFHdEgsS0FBSyxDQUFDc0gsV0FBVyxDQUFBO0FBRW5DLEtBQUMsTUFBTTtBQUFBLE1BQUEsSUFBQWMsb0JBQUEsQ0FBQTtNQUNIZixPQUFPLEdBQUdULE9BQU8sQ0FBQ3lCLGFBQWEsQ0FBQTtNQUMvQmYsV0FBVyxHQUFBLENBQUFjLG9CQUFBLEdBQUd4QixPQUFPLENBQUNVLFdBQVcsS0FBQSxJQUFBLEdBQUFjLG9CQUFBLEdBQUl6VCxTQUFTLENBQUE7QUFDbEQsS0FBQTtBQUVBb08sSUFBQUEsS0FBSyxDQUFDdUYsTUFBTSxDQUFDakIsT0FBTyxFQUFFLHdEQUF3RCxDQUFDLENBQUE7O0FBRS9FO0FBQ0EsSUFBQSxJQUFJL0csd0JBQXdCLEVBQUU7QUFBQSxNQUFBLElBQUFpSSxxQkFBQSxDQUFBO0FBQzFCLE1BQUEsTUFBTUMsYUFBYSxHQUFBLENBQUFELHFCQUFBLEdBQUczQixPQUFPLENBQUM0QixhQUFhLEtBQUFELElBQUFBLEdBQUFBLHFCQUFBLEdBQUksSUFBSSxDQUFDRSxzQkFBc0IsQ0FBQ0MsS0FBSyxDQUFBO01BQ2hGRixhQUFhLENBQUNHLFFBQVEsRUFBRSxDQUFBOztBQUV4QjtBQUNBLE1BQUEsSUFBSTNJLEtBQUssRUFBRTtBQUNQLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQzRJLHFCQUFxQixJQUFJdlAsS0FBSyxDQUFDd1AsUUFBUSxDQUFDQyxVQUFVLEtBQUs5SSxLQUFLLENBQUMrSSxFQUFFLEVBQUU7VUFDdkUsSUFBSSxDQUFDSCxxQkFBcUIsR0FBRyxJQUFJLENBQUE7VUFDakNJLGtCQUFrQixDQUFDQyxNQUFNLENBQUNULGFBQWEsRUFBRSxJQUFJLENBQUNuUCxLQUFLLENBQUMsQ0FBQTtBQUN4RCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRUE7SUFDQUEsS0FBSyxDQUFDNlAsYUFBYSxHQUFHOU4sTUFBTSxDQUFBO0lBRTVCLE1BQU0rTixTQUFTLEdBQUcsSUFBSSxDQUFDQyxpQkFBaUIsQ0FBQ2hPLE1BQU0sRUFBRTZCLFlBQVksQ0FBQyxDQUFBO0lBQzlELElBQUkvRyxNQUFNLENBQUNtVCxzQkFBc0IsRUFBRTtBQUMvQixNQUFBLElBQUksQ0FBQ0MsdUJBQXVCLENBQUMzQyxjQUFjLEVBQUUsSUFBSSxDQUFDOUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDQyxtQkFBbUIsRUFBRXFILFNBQVMsQ0FBQyxDQUFBO0FBQzdHLEtBQUE7O0FBRUE7QUFDQSxJQUFBLE1BQU0vRyxTQUFTLEdBQUcsQ0FBQyxFQUFFaEgsTUFBTSxDQUFDbU8sVUFBVSxJQUFHdE0sWUFBWSxJQUFBLElBQUEsR0FBQSxLQUFBLENBQUEsR0FBWkEsWUFBWSxDQUFFdU0sS0FBSyxDQUFDLENBQUEsQ0FBQTtBQUU3RCxJQUFBLE1BQU1DLGdCQUFnQixHQUFHLElBQUksQ0FBQ3RULGlCQUFpQixDQUFBO0lBQy9DLElBQUksQ0FBQ2lRLGFBQWEsQ0FBQ2hMLE1BQU0sRUFDTmlNLE9BQU8sRUFDUEMsV0FBVyxFQUNYWixVQUFVLEVBQ1YxRyxLQUFLLElBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFMQSxLQUFLLENBQUUwSixVQUFVLEVBQ2pCMUosS0FBSyxFQUNMb0MsU0FBUyxDQUFDLENBQUE7SUFFN0IsSUFBSXBDLEtBQUssRUFDTEEsS0FBSyxDQUFDN0osaUJBQWlCLElBQUksSUFBSSxDQUFDQSxpQkFBaUIsR0FBR3NULGdCQUFnQixDQUFBO0FBQzVFLEdBQUE7QUFFQUUsRUFBQUEsaUJBQWlCQSxHQUFHO0FBQ2hCLElBQUEsTUFBTXRRLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTs7QUFFeEI7QUFDQSxJQUFBLElBQUksQ0FBQ0Qsb0JBQW9CLENBQUNDLEtBQUssQ0FBQyxDQUFBOztBQUVoQztBQUNBLElBQUEsSUFBSUEsS0FBSyxDQUFDdVEsR0FBRyxLQUFLQyxRQUFRLEVBQUU7TUFDeEIsSUFBSSxDQUFDOVEsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHTSxLQUFLLENBQUNOLFFBQVEsQ0FBQ3hELENBQUMsQ0FBQTtNQUNuQyxJQUFJLENBQUN3RCxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUdNLEtBQUssQ0FBQ04sUUFBUSxDQUFDUSxDQUFDLENBQUE7TUFDbkMsSUFBSSxDQUFDUixRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUdNLEtBQUssQ0FBQ04sUUFBUSxDQUFDUyxDQUFDLENBQUE7TUFDbkMsSUFBSUgsS0FBSyxDQUFDSSxlQUFlLEVBQUU7UUFDdkIsS0FBSyxJQUFJbkUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxFQUFFLEVBQUU7QUFDeEIsVUFBQSxJQUFJLENBQUN5RCxRQUFRLENBQUN6RCxDQUFDLENBQUMsR0FBR0UsSUFBSSxDQUFDa0UsR0FBRyxDQUFDLElBQUksQ0FBQ1gsUUFBUSxDQUFDekQsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDdEQsU0FBQTtBQUNKLE9BQUE7TUFDQSxJQUFJLENBQUNtQixVQUFVLENBQUNvRCxRQUFRLENBQUMsSUFBSSxDQUFDZCxRQUFRLENBQUMsQ0FBQTtBQUN2QyxNQUFBLElBQUlNLEtBQUssQ0FBQ3VRLEdBQUcsS0FBS0UsVUFBVSxFQUFFO1FBQzFCLElBQUksQ0FBQ25ULFVBQVUsQ0FBQ2tELFFBQVEsQ0FBQ1IsS0FBSyxDQUFDMFEsUUFBUSxDQUFDLENBQUE7UUFDeEMsSUFBSSxDQUFDblQsUUFBUSxDQUFDaUQsUUFBUSxDQUFDUixLQUFLLENBQUMyUSxNQUFNLENBQUMsQ0FBQTtBQUN4QyxPQUFDLE1BQU07UUFDSCxJQUFJLENBQUNuVCxZQUFZLENBQUNnRCxRQUFRLENBQUNSLEtBQUssQ0FBQzRRLFVBQVUsQ0FBQyxDQUFBO0FBQ2hELE9BQUE7QUFDSixLQUFBOztBQUVBO0FBQ0EsSUFBQSxNQUFNL1QsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0lBQzFCLElBQUksQ0FBQzJDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRzNDLE1BQU0sQ0FBQ2dILEtBQUssQ0FBQTtJQUNsQyxJQUFJLENBQUNyRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUczQyxNQUFNLENBQUNnVSxNQUFNLENBQUE7SUFDbkMsSUFBSSxDQUFDclIsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRzNDLE1BQU0sQ0FBQ2dILEtBQUssQ0FBQTtJQUN0QyxJQUFJLENBQUNyRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHM0MsTUFBTSxDQUFDZ1UsTUFBTSxDQUFBO0lBQ3ZDLElBQUksQ0FBQ3RSLFlBQVksQ0FBQ2lCLFFBQVEsQ0FBQyxJQUFJLENBQUNoQixXQUFXLENBQUMsQ0FBQTtJQUU1QyxJQUFJLENBQUM1QixpQkFBaUIsQ0FBQzRDLFFBQVEsQ0FBQyxJQUFJLENBQUNaLGVBQWUsQ0FBQyxDQUFBO0lBQ3JELElBQUksQ0FBQy9CLG1CQUFtQixDQUFDMkMsUUFBUSxDQUFDLElBQUksQ0FBQ1gsaUJBQWlCLENBQUMsQ0FBQTtBQUM3RCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWlSLEVBQUFBLGVBQWVBLENBQUNDLFVBQVUsRUFBRUMsZ0JBQWdCLEVBQUU7QUFFMUMsSUFBQSxNQUFNaFIsS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0FBQ3hCLElBQUEsTUFBTWlSLE1BQU0sR0FBRyxJQUFJLENBQUNwVSxNQUFNLENBQUNxVSxRQUFRLENBQUE7SUFDbkNILFVBQVUsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7O0FBRWxCO0FBQ0EsSUFBQSxJQUFJLENBQUN4QyxNQUFNLENBQUNxQyxnQkFBZ0IsQ0FBQyxDQUFBO0lBRTdCLElBQUloUixLQUFLLENBQUNpSCx3QkFBd0IsRUFBRTtBQUVoQztNQUNBLE1BQU07UUFBRW1LLGNBQWM7QUFBRUMsUUFBQUEsY0FBQUE7T0FBZ0IsR0FBR3JSLEtBQUssQ0FBQ3dQLFFBQVEsQ0FBQTtBQUN6RCxNQUFBLElBQUksQ0FBQzhCLDBCQUEwQixDQUFDM0MsTUFBTSxDQUFDb0MsVUFBVSxFQUFFSyxjQUFjLEVBQUVDLGNBQWMsRUFBRSxJQUFJLENBQUNFLE1BQU0sRUFBRSxJQUFJLENBQUNDLFdBQVcsQ0FBQyxDQUFBO0FBQ2pIVCxNQUFBQSxVQUFVLENBQUNVLGFBQWEsQ0FBQyxJQUFJLENBQUNILDBCQUEwQixDQUFDLENBQUE7QUFFN0QsS0FBQyxNQUFNO0FBRUg7TUFDQSxJQUFJLENBQUNJLG9CQUFvQixDQUFDQyw2QkFBNkIsQ0FBQ1osVUFBVSxFQUFFLElBQUksQ0FBQ1MsV0FBVyxDQUFDLENBQUE7QUFDekYsS0FBQTs7QUFFQTtJQUNBLElBQUlJLFVBQVUsR0FBRyxDQUFDLENBQUE7SUFDbEIsSUFBSUMsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNuQixJQUFJak8sWUFBWSxHQUFHLElBQUksQ0FBQTtBQUN2QixJQUFBLE1BQU1rTyxhQUFhLEdBQUdkLGdCQUFnQixDQUFDZSxjQUFjLENBQUE7QUFFckQsSUFBQSxLQUFLLElBQUk5VixDQUFDLEdBQUcyVixVQUFVLEVBQUUzVixDQUFDLEdBQUc2VixhQUFhLENBQUNqVyxNQUFNLEVBQUVJLENBQUMsRUFBRSxFQUFFO0FBRXBELE1BQUEsTUFBTStWLFlBQVksR0FBR0YsYUFBYSxDQUFDN1YsQ0FBQyxDQUFDLENBQUE7TUFDckMsTUFBTTtRQUFFMEssS0FBSztBQUFFNUUsUUFBQUEsTUFBQUE7QUFBTyxPQUFDLEdBQUdpUSxZQUFZLENBQUE7TUFFdEMsSUFBSUEsWUFBWSxDQUFDQyxlQUFlLEVBQUc7QUFFL0I7UUFDQWxRLE1BQU0sQ0FBQ0EsTUFBTSxDQUFDbVEsWUFBWSxDQUFDQyxPQUFPLENBQUVDLFVBQVUsSUFBSztBQUMvQ3JCLFVBQUFBLFVBQVUsQ0FBQ1UsYUFBYSxDQUFDVyxVQUFVLENBQUMsQ0FBQTtBQUN4QyxTQUFDLENBQUMsQ0FBQTtBQUVOLE9BQUMsTUFBTTtBQUVIO0FBQ0EsUUFBQSxNQUFNQyxTQUFTLEdBQUd0USxNQUFNLENBQUNBLE1BQU0sQ0FBQ3VRLG1CQUFtQixDQUFBO0FBQ25ELFFBQUEsSUFBSUQsU0FBUyxJQUFJcEIsTUFBTSxJQUFJZSxZQUFZLENBQUNPLGNBQWMsRUFBRTtVQUNwREYsU0FBUyxDQUFDOUUsT0FBTyxDQUFDaUYsWUFBWSxHQUFHelEsTUFBTSxDQUFDQSxNQUFNLENBQUM2QixZQUFZLENBQUE7QUFDM0R5TyxVQUFBQSxTQUFTLENBQUMxRCxNQUFNLENBQUMsSUFBSSxDQUFDM08sS0FBSyxDQUFDLENBQUE7QUFDNUIrUSxVQUFBQSxVQUFVLENBQUNVLGFBQWEsQ0FBQ1ksU0FBUyxDQUFDLENBQUE7QUFDdkMsU0FBQTtBQUVBLFFBQUEsTUFBTUksWUFBWSxHQUFHOUwsS0FBSyxDQUFDK0ksRUFBRSxLQUFLZ0QsYUFBYSxDQUFBOztBQUUvQztRQUNBLElBQUl6QixNQUFNLElBQUl3QixZQUFZLElBQUksQ0FBQzFRLE1BQU0sQ0FBQzRRLG1CQUFtQixFQUNyRCxTQUFBO1FBRUosTUFBTUMsVUFBVSxHQUFHSCxZQUFZLEtBQUsxUSxNQUFNLENBQUM0USxtQkFBbUIsSUFBSTVRLE1BQU0sQ0FBQzhRLG1CQUFtQixDQUFDLENBQUE7O0FBRTdGO0FBQ0EsUUFBQSxJQUFJaEIsUUFBUSxFQUFFO0FBQ1ZBLFVBQUFBLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFDaEJELFVBQUFBLFVBQVUsR0FBRzNWLENBQUMsQ0FBQTtVQUNkMkgsWUFBWSxHQUFHb08sWUFBWSxDQUFDcE8sWUFBWSxDQUFBO0FBQzVDLFNBQUE7O0FBRUE7QUFDQSxRQUFBLE1BQU1rUCxnQkFBZ0IsR0FBR2hCLGFBQWEsQ0FBQzdWLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM3QyxRQUFBLE1BQU04VyxnQkFBZ0IsR0FBR0QsZ0JBQWdCLEdBQUdBLGdCQUFnQixDQUFDbk0sS0FBSyxDQUFDK0ksRUFBRSxLQUFLZ0QsYUFBYSxHQUFHLEtBQUssQ0FBQTtBQUMvRixRQUFBLE1BQU1NLG1CQUFtQixHQUFHRCxnQkFBZ0IsS0FBS2hSLE1BQU0sQ0FBQzRRLG1CQUFtQixJQUFJNVEsTUFBTSxDQUFDOFEsbUJBQW1CLENBQUMsSUFBSSxDQUFDNUIsTUFBTSxDQUFBO1FBQ3JILE1BQU1nQyxrQkFBa0IsR0FBR0gsZ0JBQWdCLEdBQUlBLGdCQUFnQixDQUFDUCxjQUFjLElBQUksSUFBSSxDQUFDVyxxQkFBcUIsQ0FBQ0MsR0FBRyxDQUFDTCxnQkFBZ0IsQ0FBQy9RLE1BQU0sQ0FBQ0EsTUFBTSxDQUFDLEdBQUksS0FBSyxDQUFBOztBQUV6SjtBQUNBO0FBQ0EsUUFBQSxJQUFJLENBQUMrUSxnQkFBZ0IsSUFBSUEsZ0JBQWdCLENBQUNsUCxZQUFZLEtBQUtBLFlBQVksSUFDbkVxUCxrQkFBa0IsSUFBSUQsbUJBQW1CLElBQUlKLFVBQVUsRUFBRTtBQUV6RDtBQUNBLFVBQUEsTUFBTVEsV0FBVyxHQUFHWCxZQUFZLElBQUliLFVBQVUsS0FBSzNWLENBQUMsQ0FBQTtVQUNwRCxJQUFJLENBQUNtWCxXQUFXLEVBQUU7QUFDZCxZQUFBLElBQUksQ0FBQ0MsaUJBQWlCLENBQUN0QyxVQUFVLEVBQUVDLGdCQUFnQixFQUFFcE4sWUFBWSxFQUFFZ08sVUFBVSxFQUFFM1YsQ0FBQyxDQUFDLENBQUE7QUFDckYsV0FBQTs7QUFFQTtBQUNBLFVBQUEsSUFBSXdXLFlBQVksRUFBRTtZQUVkLElBQUkxUSxNQUFNLENBQUM0USxtQkFBbUIsRUFBRTtBQUM1QixjQUFBLE1BQU1XLGFBQWEsR0FBR3ZSLE1BQU0sQ0FBQ0EsTUFBTSxDQUFDd1IsbUJBQW1CLENBQUE7QUFDdkRELGNBQUFBLGFBQWEsQ0FBQ0UsTUFBTSxHQUFHelIsTUFBTSxDQUFDNkIsWUFBWSxDQUFBO0FBQzFDbU4sY0FBQUEsVUFBVSxDQUFDVSxhQUFhLENBQUM2QixhQUFhLENBQUMsQ0FBQTtBQUMzQyxhQUFBO0FBRUEsWUFBQSxJQUFJdlIsTUFBTSxDQUFDOFEsbUJBQW1CLElBQUksQ0FBQzVCLE1BQU0sRUFBRTtjQUN2Q0YsVUFBVSxDQUFDVSxhQUFhLENBQUMxUCxNQUFNLENBQUNBLE1BQU0sQ0FBQ3VRLG1CQUFtQixDQUFDLENBQUE7QUFDL0QsYUFBQTtBQUNKLFdBQUE7O0FBRUE7VUFDQSxJQUFJTixZQUFZLENBQUN5QixrQkFBa0IsSUFBSTFSLE1BQU0sSUFBTkEsSUFBQUEsSUFBQUEsTUFBTSxDQUFFMlIsZ0JBQWdCLEVBQUU7QUFDN0QsWUFBQSxNQUFNdEIsVUFBVSxHQUFHLElBQUl1Qix3QkFBd0IsQ0FBQyxJQUFJLENBQUM5VyxNQUFNLEVBQUUsSUFBSSxFQUFFbVYsWUFBWSxDQUFDLENBQUE7QUFDaEZqQixZQUFBQSxVQUFVLENBQUNVLGFBQWEsQ0FBQ1csVUFBVSxDQUFDLENBQUE7QUFDeEMsV0FBQTtBQUVBUCxVQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0FBQ25CLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJd0IsaUJBQWlCQSxDQUFDdEMsVUFBVSxFQUFFQyxnQkFBZ0IsRUFBRXBOLFlBQVksRUFBRWdPLFVBQVUsRUFBRWdDLFFBQVEsRUFBRTtBQUVoRixJQUFBLE1BQU14QixVQUFVLEdBQUcsSUFBSXlCLGlCQUFpQixDQUFDLElBQUksQ0FBQ2hYLE1BQU0sRUFBRW1VLGdCQUFnQixFQUFFLElBQUksQ0FBQ2hSLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6Rm9TLElBQUFBLFVBQVUsQ0FBQzBCLElBQUksQ0FBQ2xRLFlBQVksQ0FBQyxDQUFBO0FBRTdCLElBQUEsTUFBTWtPLGFBQWEsR0FBR2QsZ0JBQWdCLENBQUNlLGNBQWMsQ0FBQTtJQUNyRCxLQUFLLElBQUk5VixDQUFDLEdBQUcyVixVQUFVLEVBQUUzVixDQUFDLElBQUkyWCxRQUFRLEVBQUUzWCxDQUFDLEVBQUUsRUFBRTtBQUN6Q21XLE1BQUFBLFVBQVUsQ0FBQzJCLGVBQWUsQ0FBQ2pDLGFBQWEsQ0FBQzdWLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaEQsS0FBQTtBQUVBOFUsSUFBQUEsVUFBVSxDQUFDVSxhQUFhLENBQUNXLFVBQVUsQ0FBQyxDQUFBO0FBQ3hDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSXpELE1BQU1BLENBQUNxRixJQUFJLEVBQUU7SUFFVCxJQUFJLENBQUNDLFdBQVcsRUFBRSxDQUFBO0FBQ2xCLElBQUEsSUFBSSxDQUFDQyxjQUFjLENBQUNELFdBQVcsRUFBRSxDQUFBOztBQUVqQztBQUNBLElBQUEsSUFBSSxDQUFDalUsS0FBSyxDQUFDbVUsY0FBYyxFQUFFLENBQUE7O0FBRTNCO0FBQ0EsSUFBQSxJQUFJLENBQUNDLHNCQUFzQixDQUFDSixJQUFJLENBQUMsQ0FBQTtBQUVqQyxJQUFBLElBQUksQ0FBQ0ssYUFBYSxDQUFDTCxJQUFJLENBQUMsQ0FBQTs7QUFFeEI7QUFDQSxJQUFBLElBQUksQ0FBQ00sVUFBVSxDQUFDTixJQUFJLENBQUMsQ0FBQTtJQUNyQixJQUFJLENBQUMxRCxpQkFBaUIsRUFBRSxDQUFBOztBQUV4QjtBQUNBO0FBQ0EsSUFBQSxJQUFJLENBQUNpRSxlQUFlLENBQUNQLElBQUksQ0FBQyxDQUFBOztBQUUxQjtBQUNBLElBQUEsSUFBSSxDQUFDUSxTQUFTLENBQUMsSUFBSSxDQUFDQyx1QkFBdUIsQ0FBQyxDQUFBO0FBQ2hELEdBQUE7QUFDSixDQUFBO0FBOTVCTWhZLGVBQWUsQ0EyRVYrSyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUEzRTVCL0ssZUFBZSxDQTZFVmdMLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtBQTdFM0JoTCxlQUFlLENBK0VWaUwsZUFBZSxHQUFHLENBQUM7Ozs7In0=
