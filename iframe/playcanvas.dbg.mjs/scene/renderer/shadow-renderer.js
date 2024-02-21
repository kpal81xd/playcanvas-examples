import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF1, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

function gauss(x, sigma) {
  return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}
function gaussWeights(kernelSize) {
  const sigma = (kernelSize - 1) / (2 * 3);
  const halfWidth = (kernelSize - 1) * 0.5;
  const values = new Array(kernelSize);
  let sum = 0.0;
  for (let i = 0; i < kernelSize; ++i) {
    values[i] = gauss(i - halfWidth, sigma);
    sum += values[i];
  }
  for (let i = 0; i < kernelSize; ++i) {
    values[i] /= sum;
  }
  return values;
}
const tempSet = new Set();
const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = new Vec4(1, 1, 0, 0);
const viewportMatrix = new Mat4();

/**
 * @ignore
 */
class ShadowRenderer {
  /**
   * @param {import('./renderer.js').Renderer} renderer - The renderer.
   * @param {import('../lighting/light-texture-atlas.js').LightTextureAtlas} lightTextureAtlas - The
   * shadow map atlas.
   */
  constructor(renderer, lightTextureAtlas) {
    /**
     * A cache of shadow passes. First index is looked up by light type, second by shadow type.
     *
     * @type {import('../shader-pass.js').ShaderPassInfo[][]}
     * @private
     */
    this.shadowPassCache = [];
    this.device = renderer.device;

    /** @type {import('./renderer.js').Renderer} */
    this.renderer = renderer;

    /** @type {import('../lighting/light-texture-atlas.js').LightTextureAtlas} */
    this.lightTextureAtlas = lightTextureAtlas;
    const scope = this.device.scope;
    this.polygonOffsetId = scope.resolve('polygonOffset');
    this.polygonOffset = new Float32Array(2);

    // VSM
    this.sourceId = scope.resolve('source');
    this.pixelOffsetId = scope.resolve('pixelOffset');
    this.weightId = scope.resolve('weight[0]');
    this.blurVsmShaderCode = [shaderChunks.blurVSMPS, '#define GAUSS\n' + shaderChunks.blurVSMPS];
    const packed = '#define PACKED\n';
    this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];

    // cache for vsm blur shaders
    this.blurVsmShader = [{}, {}];
    this.blurPackedVsmShader = [{}, {}];
    this.blurVsmWeights = {};

    // uniforms
    this.shadowMapLightRadiusId = scope.resolve('light_radius');

    // view bind group format with its uniform buffer format
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;

    // blend states
    this.blendStateWrite = new BlendState();
    this.blendStateNoWrite = new BlendState();
    this.blendStateNoWrite.setColorWrite(false, false, false, false);
  }

  // creates shadow camera for a light and sets up its constant properties
  static createShadowCamera(device, shadowType, type, face) {
    const shadowCam = LightCamera.create('ShadowCamera', type, face);

    // don't clear the color buffer if rendering a depth map
    if (shadowType >= SHADOW_VSM8 && shadowType <= SHADOW_VSM32) {
      shadowCam.clearColor = new Color(0, 0, 0, 0);
    } else {
      shadowCam.clearColor = new Color(1, 1, 1, 1);
    }
    shadowCam.clearDepthBuffer = true;
    shadowCam.clearStencilBuffer = false;
    return shadowCam;
  }
  static setShadowCameraSettings(shadowCam, device, shadowType, type, isClustered) {
    // normal omni shadows on webgl2 encode depth in RGBA8 and do manual PCF sampling
    // clustered omni shadows on webgl2 use depth format and hardware PCF sampling
    let hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3) && device.supportsDepthShadow;
    if (type === LIGHTTYPE_OMNI && !isClustered) {
      hwPcf = false;
    }
    shadowCam.clearColorBuffer = !hwPcf;
  }
  _cullShadowCastersInternal(meshInstances, visible, camera) {
    const numInstances = meshInstances.length;
    for (let i = 0; i < numInstances; i++) {
      const meshInstance = meshInstances[i];
      if (meshInstance.castShadow) {
        if (!meshInstance.cull || meshInstance._isVisible(camera)) {
          meshInstance.visibleThisFrame = true;
          visible.push(meshInstance);
        }
      }
    }
  }

  /**
   * Culls the list of shadow casters used by the light by the camera, storing visible mesh
   * instances in the specified array.
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition used as a source of shadow casters, if those are not provided directly.
   * @param {import('../light.js').Light} light - The light.
   * @param {import('../mesh-instance.js').MeshInstance[]} visible - The array to store visible
   * mesh instances in.
   * @param {import('../camera.js').Camera} camera - The camera.
   * @param {import('../mesh-instance.js').MeshInstance[]} [casters] - Optional array of mesh
   * instances to use as casters.
   * @ignore
   */
  cullShadowCasters(comp, light, visible, camera, casters) {
    visible.length = 0;

    // if the casters are supplied, use them
    if (casters) {
      this._cullShadowCastersInternal(casters, visible, camera);
    } else {
      // otherwise, get them from the layer composition

      // for each layer
      const layers = comp.layerList;
      const len = layers.length;
      for (let i = 0; i < len; i++) {
        const layer = layers[i];
        if (layer._lightsSet.has(light)) {
          // layer can be in the list two times (opaque, transp), add casters only one time
          if (!tempSet.has(layer)) {
            tempSet.add(layer);
            this._cullShadowCastersInternal(layer.shadowCasters, visible, camera);
          }
        }
      }
      tempSet.clear();
    }

    // this sorts the shadow casters by the shader id
    visible.sort(this.renderer.sortCompareDepth);
  }
  setupRenderState(device, light) {
    // webgl1 depth bias (not rendering to a shadow map, so cannot use hardware depth bias)
    if (device.isWebGL1 && device.extStandardDerivatives) {
      if (light._type === LIGHTTYPE_OMNI) {
        this.polygonOffset[0] = 0;
        this.polygonOffset[1] = 0;
        this.polygonOffsetId.setValue(this.polygonOffset);
      } else {
        this.polygonOffset[0] = light.shadowBias * -1000.0;
        this.polygonOffset[1] = light.shadowBias * -1000.0;
        this.polygonOffsetId.setValue(this.polygonOffset);
      }
    }

    // Set standard shadowmap states
    const isClustered = this.renderer.scene.clusteredLightingEnabled;
    const gpuOrGl2 = device.isWebGL2 || device.isWebGPU;
    const useShadowSampler = isClustered ? light._isPcf && gpuOrGl2 :
    // both spot and omni light are using shadow sampler on webgl2 when clustered
    light._isPcf && gpuOrGl2 && light._type !== LIGHTTYPE_OMNI; // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)

    device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
    device.setDepthState(light.shadowDepthState);
    device.setStencilState(null, null);
  }
  dispatchUniforms(light, shadowCam, lightRenderData, face) {
    const shadowCamNode = shadowCam._node;

    // position / range
    if (light._type !== LIGHTTYPE_DIRECTIONAL) {
      this.renderer.dispatchViewPos(shadowCamNode.getPosition());
      this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
    }

    // view-projection shadow matrix
    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
    shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);

    // viewport handling
    const rectViewport = lightRenderData.shadowViewport;
    shadowCam.rect = rectViewport;
    shadowCam.scissorRect = lightRenderData.shadowScissor;
    viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
    lightRenderData.shadowMatrix.mul2(viewportMatrix, shadowCamViewProj);
    if (light._type === LIGHTTYPE_DIRECTIONAL) {
      // copy matrix to shadow cascade palette
      light._shadowMatrixPalette.set(lightRenderData.shadowMatrix.data, face * 16);
    }
  }

  /**
   * @param {import('../light.js').Light} light - The light.
   * @returns {number} Index of shadow pass info.
   */
  getShadowPass(light) {
    var _this$shadowPassCache;
    // get shader pass from cache for this light type and shadow type
    const lightType = light._type;
    const shadowType = light._shadowType;
    let shadowPassInfo = (_this$shadowPassCache = this.shadowPassCache[lightType]) == null ? void 0 : _this$shadowPassCache[shadowType];
    if (!shadowPassInfo) {
      // new shader pass if not in cache
      const shadowPassName = `ShadowPass_${lightType}_${shadowType}`;
      shadowPassInfo = ShaderPass.get(this.device).allocate(shadowPassName, {
        isShadow: true,
        lightType: lightType,
        shadowType: shadowType
      });

      // add it to the cache
      if (!this.shadowPassCache[lightType]) this.shadowPassCache[lightType] = [];
      this.shadowPassCache[lightType][shadowType] = shadowPassInfo;
    }
    return shadowPassInfo.index;
  }

  /**
   * @param {import('../mesh-instance.js').MeshInstance[]} visibleCasters - Visible mesh
   * instances.
   * @param {import('../light.js').Light} light - The light.
   */
  submitCasters(visibleCasters, light) {
    const device = this.device;
    const renderer = this.renderer;
    const scene = renderer.scene;
    const passFlags = 1 << SHADER_SHADOW;
    const shadowPass = this.getShadowPass(light);

    // TODO: Similarly to forward renderer, a shader creation part of this loop should be split into a separate loop,
    // and endShaderBatch should be called at its end

    // Render
    const count = visibleCasters.length;
    for (let i = 0; i < count; i++) {
      const meshInstance = visibleCasters[i];
      const mesh = meshInstance.mesh;
      meshInstance.ensureMaterial(device);
      const material = meshInstance.material;

      // set basic material states/parameters
      renderer.setBaseConstants(device, material);
      renderer.setSkinning(device, meshInstance);
      if (material.dirty) {
        material.updateUniforms(device, scene);
        material.dirty = false;
      }
      if (material.chunks) {
        renderer.setupCullMode(true, 1, meshInstance);

        // Uniforms I (shadow): material
        material.setParameters(device);

        // Uniforms II (shadow): meshInstance overrides
        meshInstance.setParameters(device, passFlags);
      }
      const shaderInstance = meshInstance.getShaderInstance(shadowPass, 0, scene, this.viewUniformFormat, this.viewBindGroupFormat);
      const shadowShader = shaderInstance.shader;
      Debug.assert(shadowShader, `no shader for pass ${shadowPass}`, material);

      // sort shadow casters by shader
      meshInstance._key[SORTKEY_DEPTH] = shadowShader.id;
      if (!shadowShader.failed && !device.setShader(shadowShader)) {
        Debug.error(`Error compiling shadow shader for material=${material.name} pass=${shadowPass}`, material);
      }

      // set buffers
      renderer.setVertexBuffers(device, mesh);
      renderer.setMorphing(device, meshInstance.morphInstance);
      this.renderer.setupMeshUniformBuffers(shaderInstance, meshInstance);
      const style = meshInstance.renderStyle;
      device.setIndexBuffer(mesh.indexBuffer[style]);

      // draw
      renderer.drawInstance(device, meshInstance, mesh, style);
      renderer._shadowDrawCalls++;
    }
  }
  needsShadowRendering(light) {
    const needs = light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame;
    if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
      light.shadowUpdateMode = SHADOWUPDATE_NONE;
    }
    if (needs) {
      this.renderer._shadowMapUpdates += light.numShadowFaces;
    }
    return needs;
  }
  getLightRenderData(light, camera, face) {
    // directional shadows are per camera, so get appropriate render data
    return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
  }
  setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {
    const rt = shadowCamera.renderTarget;
    renderPass.init(rt);
    renderPass.depthStencilOps.clearDepthValue = 1;
    renderPass.depthStencilOps.clearDepth = clearRenderTarget;

    // if rendering to depth buffer
    if (rt.depthBuffer) {
      renderPass.depthStencilOps.storeDepth = true;
    } else {
      // rendering to color buffer

      renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);
      renderPass.colorOps.clear = clearRenderTarget;
      renderPass.depthStencilOps.storeDepth = false;
    }

    // not sampling dynamically generated cubemaps
    renderPass.requiresCubemaps = false;
  }

  // prepares render target / render target settings to allow render pass to be set up
  prepareFace(light, camera, face) {
    const type = light._type;
    const shadowType = light._shadowType;
    const isClustered = this.renderer.scene.clusteredLightingEnabled;
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;

    // camera clear setting
    // Note: when clustered lighting is the only lighting type, this code can be moved to createShadowCamera function
    ShadowRenderer.setShadowCameraSettings(shadowCam, this.device, shadowType, type, isClustered);

    // assign render target for the face
    const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
    shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
    return shadowCam;
  }
  renderFace(light, camera, face, clear, insideRenderPass = true) {
    const device = this.device;
    const shadowMapStartTime = now();
    DebugGraphics.pushGpuMarker(device, `SHADOW ${light._node.name} FACE ${face}`);
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;
    this.dispatchUniforms(light, shadowCam, lightRenderData, face);
    const rt = shadowCam.renderTarget;
    const renderer = this.renderer;
    renderer.setCameraUniforms(shadowCam, rt);
    if (device.supportsUniformBuffers) {
      renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, 1);
    }
    if (insideRenderPass) {
      renderer.setupViewport(shadowCam, rt);

      // clear here is used to clear a viewport inside render target.
      if (clear) {
        renderer.clear(shadowCam);
      }
    } else {
      // this is only used by lightmapper, till it's converted to render passes
      renderer.clearView(shadowCam, rt, true, false);
    }
    this.setupRenderState(device, light);

    // render mesh instances
    this.submitCasters(lightRenderData.visibleCasters, light);
    DebugGraphics.popGpuMarker(device);
    renderer._shadowMapTime += now() - shadowMapStartTime;
  }
  render(light, camera, insideRenderPass = true) {
    if (this.needsShadowRendering(light)) {
      const faceCount = light.numShadowFaces;

      // render faces
      for (let face = 0; face < faceCount; face++) {
        this.prepareFace(light, camera, face);
        this.renderFace(light, camera, face, true, insideRenderPass);
      }

      // apply vsm
      this.renderVsm(light, camera);
    }
  }
  renderVsm(light, camera) {
    // VSM blur if light supports vsm (directional and spot in general)
    if (light._isVsm && light._vsmBlurSize > 1) {
      // in clustered mode, only directional light can be vms
      const isClustered = this.renderer.scene.clusteredLightingEnabled;
      if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
        this.applyVsmBlur(light, camera);
      }
    }
  }
  getVsmBlurShader(isVsm8, blurMode, filterSize) {
    let blurShader = (isVsm8 ? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
    if (!blurShader) {
      this.blurVsmWeights[filterSize] = gaussWeights(filterSize);
      const blurVS = shaderChunks.fullscreenQuadVS;
      let blurFS = '#define SAMPLES ' + filterSize + '\n';
      if (isVsm8) {
        blurFS += this.blurPackedVsmShaderCode[blurMode];
      } else {
        blurFS += this.blurVsmShaderCode[blurMode];
      }
      const blurShaderName = 'blurVsm' + blurMode + '' + filterSize + '' + isVsm8;
      blurShader = createShaderFromCode(this.device, blurVS, blurFS, blurShaderName);
      if (isVsm8) {
        this.blurPackedVsmShader[blurMode][filterSize] = blurShader;
      } else {
        this.blurVsmShader[blurMode][filterSize] = blurShader;
      }
    }
    return blurShader;
  }
  applyVsmBlur(light, camera) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, `VSM ${light._node.name}`);

    // render state
    device.setBlendState(BlendState.NOBLEND);
    const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
    const shadowCam = lightRenderData.shadowCamera;
    const origShadowMap = shadowCam.renderTarget;

    // temporary render target for blurring
    // TODO: this is probably not optimal and shadow map could have depth buffer on in addition to color buffer,
    // and for blurring only one buffer is needed.
    const tempShadowMap = this.renderer.shadowMapCache.get(device, light);
    const tempRt = tempShadowMap.renderTargets[0];
    const isVsm8 = light._shadowType === SHADOW_VSM8;
    const blurMode = light.vsmBlurMode;
    const filterSize = light._vsmBlurSize;
    const blurShader = this.getVsmBlurShader(isVsm8, blurMode, filterSize);
    blurScissorRect.z = light._shadowResolution - 2;
    blurScissorRect.w = blurScissorRect.z;

    // Blur horizontal
    this.sourceId.setValue(origShadowMap.colorBuffer);
    pixelOffset[0] = 1 / light._shadowResolution;
    pixelOffset[1] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
    drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

    // Blur vertical
    this.sourceId.setValue(tempRt.colorBuffer);
    pixelOffset[1] = pixelOffset[0];
    pixelOffset[0] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);

    // return the temporary shadow map back to the cache
    this.renderer.shadowMapCache.add(light, tempShadowMap);
    DebugGraphics.popGpuMarker(device);
  }
  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      // format of the view uniform buffer
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);

      // format of the view bind group - contains single uniform buffer, and no textures
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], []);
    }
  }
  frameUpdate() {
    this.initViewBindGroupFormat();
  }
}

export { ShadowRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBTSEFERVJTVEFHRV9GUkFHTUVOVCwgU0hBREVSU1RBR0VfVkVSVEVYLCBVTklGT1JNVFlQRV9NQVQ0LCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSxcbiAgICBTSEFERVJfU0hBRE9XLFxuICAgIFNIQURPV19QQ0YxLCBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMzIsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgU09SVEtFWV9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyRm9ybWF0LCBVbmlmb3JtRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRHcm91cEZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuZnVuY3Rpb24gZ2F1c3NXZWlnaHRzKGtlcm5lbFNpemUpIHtcbiAgICBjb25zdCBzaWdtYSA9IChrZXJuZWxTaXplIC0gMSkgLyAoMiAqIDMpO1xuXG4gICAgY29uc3QgaGFsZldpZHRoID0gKGtlcm5lbFNpemUgLSAxKSAqIDAuNTtcbiAgICBjb25zdCB2YWx1ZXMgPSBuZXcgQXJyYXkoa2VybmVsU2l6ZSk7XG4gICAgbGV0IHN1bSA9IDAuMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gPSBnYXVzcyhpIC0gaGFsZldpZHRoLCBzaWdtYSk7XG4gICAgICAgIHN1bSArPSB2YWx1ZXNbaV07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldIC89IHN1bTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cblxuY29uc3QgdGVtcFNldCA9IG5ldyBTZXQoKTtcbmNvbnN0IHNoYWRvd0NhbVZpZXcgPSBuZXcgTWF0NCgpO1xuY29uc3Qgc2hhZG93Q2FtVmlld1Byb2ogPSBuZXcgTWF0NCgpO1xuY29uc3QgcGl4ZWxPZmZzZXQgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuY29uc3QgYmx1clNjaXNzb3JSZWN0ID0gbmV3IFZlYzQoMSwgMSwgMCwgMCk7XG5jb25zdCB2aWV3cG9ydE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbi8qKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkb3dSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQSBjYWNoZSBvZiBzaGFkb3cgcGFzc2VzLiBGaXJzdCBpbmRleCBpcyBsb29rZWQgdXAgYnkgbGlnaHQgdHlwZSwgc2Vjb25kIGJ5IHNoYWRvdyB0eXBlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2hhZGVyLXBhc3MuanMnKS5TaGFkZXJQYXNzSW5mb1tdW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzaGFkb3dQYXNzQ2FjaGUgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlcmVyLmpzJykuUmVuZGVyZXJ9IHJlbmRlcmVyIC0gVGhlIHJlbmRlcmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9IGxpZ2h0VGV4dHVyZUF0bGFzIC0gVGhlXG4gICAgICogc2hhZG93IG1hcCBhdGxhcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihyZW5kZXJlciwgbGlnaHRUZXh0dXJlQXRsYXMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSByZW5kZXJlci5kZXZpY2U7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9ICovXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBsaWdodFRleHR1cmVBdGxhcztcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncG9seWdvbk9mZnNldCcpO1xuICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXQgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIC8vIFZTTVxuICAgICAgICB0aGlzLnNvdXJjZUlkID0gc2NvcGUucmVzb2x2ZSgnc291cmNlJyk7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZCA9IHNjb3BlLnJlc29sdmUoJ3BpeGVsT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMud2VpZ2h0SWQgPSBzY29wZS5yZXNvbHZlKCd3ZWlnaHRbMF0nKTtcbiAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZSA9IFtzaGFkZXJDaHVua3MuYmx1clZTTVBTLCAnI2RlZmluZSBHQVVTU1xcbicgKyBzaGFkZXJDaHVua3MuYmx1clZTTVBTXTtcbiAgICAgICAgY29uc3QgcGFja2VkID0gJyNkZWZpbmUgUEFDS0VEXFxuJztcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyQ29kZSA9IFtwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzBdLCBwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzFdXTtcblxuICAgICAgICAvLyBjYWNoZSBmb3IgdnNtIGJsdXIgc2hhZGVyc1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXIgPSBbe30sIHt9XTtcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyID0gW3t9LCB7fV07XG5cbiAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0cyA9IHt9O1xuXG4gICAgICAgIC8vIHVuaWZvcm1zXG4gICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZCA9IHNjb3BlLnJlc29sdmUoJ2xpZ2h0X3JhZGl1cycpO1xuXG4gICAgICAgIC8vIHZpZXcgYmluZCBncm91cCBmb3JtYXQgd2l0aCBpdHMgdW5pZm9ybSBidWZmZXIgZm9ybWF0XG4gICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBudWxsO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGJsZW5kIHN0YXRlc1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVXcml0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZU5vV3JpdGUgPSBuZXcgQmxlbmRTdGF0ZSgpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZXMgc2hhZG93IGNhbWVyYSBmb3IgYSBsaWdodCBhbmQgc2V0cyB1cCBpdHMgY29uc3RhbnQgcHJvcGVydGllc1xuICAgIHN0YXRpYyBjcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gTGlnaHRDYW1lcmEuY3JlYXRlKCdTaGFkb3dDYW1lcmEnLCB0eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBkb24ndCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIGlmIHJlbmRlcmluZyBhIGRlcHRoIG1hcFxuICAgICAgICBpZiAoc2hhZG93VHlwZSA+PSBTSEFET1dfVlNNOCAmJiBzaGFkb3dUeXBlIDw9IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgc3RhdGljIHNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCkge1xuXG4gICAgICAgIC8vIG5vcm1hbCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIGVuY29kZSBkZXB0aCBpbiBSR0JBOCBhbmQgZG8gbWFudWFsIFBDRiBzYW1wbGluZ1xuICAgICAgICAvLyBjbHVzdGVyZWQgb21uaSBzaGFkb3dzIG9uIHdlYmdsMiB1c2UgZGVwdGggZm9ybWF0IGFuZCBoYXJkd2FyZSBQQ0Ygc2FtcGxpbmdcbiAgICAgICAgbGV0IGh3UGNmID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUgfHwgKChzaGFkb3dUeXBlID09PSBTSEFET1dfUENGMSB8fCBzaGFkb3dUeXBlID09PSBTSEFET1dfUENGMykgJiYgZGV2aWNlLnN1cHBvcnRzRGVwdGhTaGFkb3cpO1xuICAgICAgICBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICBod1BjZiA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3JCdWZmZXIgPSAhaHdQY2Y7XG4gICAgfVxuXG4gICAgX2N1bGxTaGFkb3dDYXN0ZXJzSW50ZXJuYWwobWVzaEluc3RhbmNlcywgdmlzaWJsZSwgY2FtZXJhKSB7XG5cbiAgICAgICAgY29uc3QgbnVtSW5zdGFuY2VzID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSW5zdGFuY2VzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2UuY2FzdFNoYWRvdykge1xuICAgICAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlLmN1bGwgfHwgbWVzaEluc3RhbmNlLl9pc1Zpc2libGUoY2FtZXJhKSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUucHVzaChtZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEN1bGxzIHRoZSBsaXN0IG9mIHNoYWRvdyBjYXN0ZXJzIHVzZWQgYnkgdGhlIGxpZ2h0IGJ5IHRoZSBjYW1lcmEsIHN0b3JpbmcgdmlzaWJsZSBtZXNoXG4gICAgICogaW5zdGFuY2VzIGluIHRoZSBzcGVjaWZpZWQgYXJyYXkuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHVzZWQgYXMgYSBzb3VyY2Ugb2Ygc2hhZG93IGNhc3RlcnMsIGlmIHRob3NlIGFyZSBub3QgcHJvdmlkZWQgZGlyZWN0bHkuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IHZpc2libGUgLSBUaGUgYXJyYXkgdG8gc3RvcmUgdmlzaWJsZVxuICAgICAqIG1lc2ggaW5zdGFuY2VzIGluLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gW2Nhc3RlcnNdIC0gT3B0aW9uYWwgYXJyYXkgb2YgbWVzaFxuICAgICAqIGluc3RhbmNlcyB0byB1c2UgYXMgY2FzdGVycy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY3VsbFNoYWRvd0Nhc3RlcnMoY29tcCwgbGlnaHQsIHZpc2libGUsIGNhbWVyYSwgY2FzdGVycykge1xuXG4gICAgICAgIHZpc2libGUubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBpZiB0aGUgY2FzdGVycyBhcmUgc3VwcGxpZWQsIHVzZSB0aGVtXG4gICAgICAgIGlmIChjYXN0ZXJzKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2N1bGxTaGFkb3dDYXN0ZXJzSW50ZXJuYWwoY2FzdGVycywgdmlzaWJsZSwgY2FtZXJhKTtcblxuICAgICAgICB9IGVsc2UgeyAgICAvLyBvdGhlcndpc2UsIGdldCB0aGVtIGZyb20gdGhlIGxheWVyIGNvbXBvc2l0aW9uXG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGxheWVyXG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSBjb21wLmxheWVyTGlzdDtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IGxheWVycy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9saWdodHNTZXQuaGFzKGxpZ2h0KSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGxheWVyIGNhbiBiZSBpbiB0aGUgbGlzdCB0d28gdGltZXMgKG9wYXF1ZSwgdHJhbnNwKSwgYWRkIGNhc3RlcnMgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRlbXBTZXQuaGFzKGxheWVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdWxsU2hhZG93Q2FzdGVyc0ludGVybmFsKGxheWVyLnNoYWRvd0Nhc3RlcnMsIHZpc2libGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRlbXBTZXQuY2xlYXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoaXMgc29ydHMgdGhlIHNoYWRvdyBjYXN0ZXJzIGJ5IHRoZSBzaGFkZXIgaWRcbiAgICAgICAgdmlzaWJsZS5zb3J0KHRoaXMucmVuZGVyZXIuc29ydENvbXBhcmVEZXB0aCk7XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KSB7XG5cbiAgICAgICAgLy8gd2ViZ2wxIGRlcHRoIGJpYXMgKG5vdCByZW5kZXJpbmcgdG8gYSBzaGFkb3cgbWFwLCBzbyBjYW5ub3QgdXNlIGhhcmR3YXJlIGRlcHRoIGJpYXMpXG4gICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDEgJiYgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBzdGFuZGFyZCBzaGFkb3dtYXAgc3RhdGVzXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IGdwdU9yR2wyID0gZGV2aWNlLmlzV2ViR0wyIHx8IGRldmljZS5pc1dlYkdQVTtcbiAgICAgICAgY29uc3QgdXNlU2hhZG93U2FtcGxlciA9IGlzQ2x1c3RlcmVkID9cbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBncHVPckdsMiA6ICAgICAvLyBib3RoIHNwb3QgYW5kIG9tbmkgbGlnaHQgYXJlIHVzaW5nIHNoYWRvdyBzYW1wbGVyIG9uIHdlYmdsMiB3aGVuIGNsdXN0ZXJlZFxuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGdwdU9yR2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuXG4gICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKHVzZVNoYWRvd1NhbXBsZXIgPyB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlIDogdGhpcy5ibGVuZFN0YXRlV3JpdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShsaWdodC5zaGFkb3dEZXB0aFN0YXRlKTtcbiAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShudWxsLCBudWxsKTtcbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kaXNwYXRjaFZpZXdQb3Moc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZC5zZXRWYWx1ZShsaWdodC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2aWV3LXByb2plY3Rpb24gc2hhZG93IG1hdHJpeFxuICAgICAgICBzaGFkb3dDYW1WaWV3LnNldFRSUyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCksIHNoYWRvd0NhbU5vZGUuZ2V0Um90YXRpb24oKSwgVmVjMy5PTkUpLmludmVydCgpO1xuICAgICAgICBzaGFkb3dDYW1WaWV3UHJvai5tdWwyKHNoYWRvd0NhbS5wcm9qZWN0aW9uTWF0cml4LCBzaGFkb3dDYW1WaWV3KTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBoYW5kbGluZ1xuICAgICAgICBjb25zdCByZWN0Vmlld3BvcnQgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5yZWN0ID0gcmVjdFZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0uc2Npc3NvclJlY3QgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93U2Npc3NvcjtcblxuICAgICAgICB2aWV3cG9ydE1hdHJpeC5zZXRWaWV3cG9ydChyZWN0Vmlld3BvcnQueCwgcmVjdFZpZXdwb3J0LnksIHJlY3RWaWV3cG9ydC56LCByZWN0Vmlld3BvcnQudyk7XG4gICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXgubXVsMih2aWV3cG9ydE1hdHJpeCwgc2hhZG93Q2FtVmlld1Byb2opO1xuXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAvLyBjb3B5IG1hdHJpeCB0byBzaGFkb3cgY2FzY2FkZSBwYWxldHRlXG4gICAgICAgICAgICBsaWdodC5fc2hhZG93TWF0cml4UGFsZXR0ZS5zZXQobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhLCBmYWNlICogMTYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEluZGV4IG9mIHNoYWRvdyBwYXNzIGluZm8uXG4gICAgICovXG4gICAgZ2V0U2hhZG93UGFzcyhsaWdodCkge1xuXG4gICAgICAgIC8vIGdldCBzaGFkZXIgcGFzcyBmcm9tIGNhY2hlIGZvciB0aGlzIGxpZ2h0IHR5cGUgYW5kIHNoYWRvdyB0eXBlXG4gICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGxldCBzaGFkb3dQYXNzSW5mbyA9IHRoaXMuc2hhZG93UGFzc0NhY2hlW2xpZ2h0VHlwZV0/LltzaGFkb3dUeXBlXTtcbiAgICAgICAgaWYgKCFzaGFkb3dQYXNzSW5mbykge1xuXG4gICAgICAgICAgICAvLyBuZXcgc2hhZGVyIHBhc3MgaWYgbm90IGluIGNhY2hlXG4gICAgICAgICAgICBjb25zdCBzaGFkb3dQYXNzTmFtZSA9IGBTaGFkb3dQYXNzXyR7bGlnaHRUeXBlfV8ke3NoYWRvd1R5cGV9YDtcbiAgICAgICAgICAgIHNoYWRvd1Bhc3NJbmZvID0gU2hhZGVyUGFzcy5nZXQodGhpcy5kZXZpY2UpLmFsbG9jYXRlKHNoYWRvd1Bhc3NOYW1lLCB7XG4gICAgICAgICAgICAgICAgaXNTaGFkb3c6IHRydWUsXG4gICAgICAgICAgICAgICAgbGlnaHRUeXBlOiBsaWdodFR5cGUsXG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZTogc2hhZG93VHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byB0aGUgY2FjaGVcbiAgICAgICAgICAgIGlmICghdGhpcy5zaGFkb3dQYXNzQ2FjaGVbbGlnaHRUeXBlXSlcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdID0gW107XG4gICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdW3NoYWRvd1R5cGVdID0gc2hhZG93UGFzc0luZm87XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhZG93UGFzc0luZm8uaW5kZXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gdmlzaWJsZUNhc3RlcnMgLSBWaXNpYmxlIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqL1xuICAgIHN1Ym1pdENhc3RlcnModmlzaWJsZUNhc3RlcnMsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSByZW5kZXJlci5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWdzID0gMSA8PCBTSEFERVJfU0hBRE9XO1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gdGhpcy5nZXRTaGFkb3dQYXNzKGxpZ2h0KTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwQ3VsbE1vZGUodHJ1ZSwgMSwgbWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEkgKHNoYWRvdyk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUkgKHNoYWRvdyk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFncyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlckluc3RhbmNlID0gbWVzaEluc3RhbmNlLmdldFNoYWRlckluc3RhbmNlKHNoYWRvd1Bhc3MsIDAsIHNjZW5lLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93U2hhZGVyID0gc2hhZGVySW5zdGFuY2Uuc2hhZGVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHNoYWRvd1NoYWRlciwgYG5vIHNoYWRlciBmb3IgcGFzcyAke3NoYWRvd1Bhc3N9YCwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHNoYWRvdyBjYXN0ZXJzIGJ5IHNoYWRlclxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9rZXlbU09SVEtFWV9ERVBUSF0gPSBzaGFkb3dTaGFkZXIuaWQ7XG5cbiAgICAgICAgICAgIGlmICghc2hhZG93U2hhZGVyLmZhaWxlZCAmJiAhZGV2aWNlLnNldFNoYWRlcihzaGFkb3dTaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEVycm9yIGNvbXBpbGluZyBzaGFkb3cgc2hhZGVyIGZvciBtYXRlcmlhbD0ke21hdGVyaWFsLm5hbWV9IHBhc3M9JHtzaGFkb3dQYXNzfWAsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGJ1ZmZlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKTtcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldE1vcnBoaW5nKGRldmljZSwgbWVzaEluc3RhbmNlLm1vcnBoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKHNoYWRlckluc3RhbmNlLCBtZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IG1lc2hJbnN0YW5jZS5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIHJlbmRlcmVyLmRyYXdJbnN0YW5jZShkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgcmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscysrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbmVlZHNTaGFkb3dSZW5kZXJpbmcobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBuZWVkcyA9IGxpZ2h0LmVuYWJsZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUgJiYgbGlnaHQudmlzaWJsZVRoaXNGcmFtZTtcblxuICAgICAgICBpZiAobGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRSkge1xuICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9OT05FO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5lZWRzO1xuICAgIH1cblxuICAgIGdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG4gICAgICAgIC8vIGRpcmVjdGlvbmFsIHNoYWRvd3MgYXJlIHBlciBjYW1lcmEsIHNvIGdldCBhcHByb3ByaWF0ZSByZW5kZXIgZGF0YVxuICAgICAgICByZXR1cm4gbGlnaHQuZ2V0UmVuZGVyRGF0YShsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gY2FtZXJhIDogbnVsbCwgZmFjZSk7XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJQYXNzKHJlbmRlclBhc3MsIHNoYWRvd0NhbWVyYSwgY2xlYXJSZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIHJlbmRlclBhc3MuaW5pdChydCk7XG5cbiAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aFZhbHVlID0gMTtcbiAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCA9IGNsZWFyUmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGlmIHJlbmRlcmluZyB0byBkZXB0aCBidWZmZXJcbiAgICAgICAgaWYgKHJ0LmRlcHRoQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSB0cnVlO1xuXG4gICAgICAgIH0gZWxzZSB7IC8vIHJlbmRlcmluZyB0byBjb2xvciBidWZmZXJcblxuICAgICAgICAgICAgcmVuZGVyUGFzcy5jb2xvck9wcy5jbGVhclZhbHVlLmNvcHkoc2hhZG93Q2FtZXJhLmNsZWFyQ29sb3IpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5jb2xvck9wcy5jbGVhciA9IGNsZWFyUmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVEZXB0aCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm90IHNhbXBsaW5nIGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjdWJlbWFwc1xuICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyByZW5kZXIgdGFyZ2V0IC8gcmVuZGVyIHRhcmdldCBzZXR0aW5ncyB0byBhbGxvdyByZW5kZXIgcGFzcyB0byBiZSBzZXQgdXBcbiAgICBwcmVwYXJlRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gdGhpcy5nZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgLy8gY2FtZXJhIGNsZWFyIHNldHRpbmdcbiAgICAgICAgLy8gTm90ZTogd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgdGhlIG9ubHkgbGlnaHRpbmcgdHlwZSwgdGhpcyBjb2RlIGNhbiBiZSBtb3ZlZCB0byBjcmVhdGVTaGFkb3dDYW1lcmEgZnVuY3Rpb25cbiAgICAgICAgU2hhZG93UmVuZGVyZXIuc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCB0aGlzLmRldmljZSwgc2hhZG93VHlwZSwgdHlwZSwgaXNDbHVzdGVyZWQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiByZW5kZXIgdGFyZ2V0IGZvciB0aGUgZmFjZVxuICAgICAgICBjb25zdCByZW5kZXJUYXJnZXRJbmRleCA9IHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IDAgOiBmYWNlO1xuICAgICAgICBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0ID0gbGlnaHQuX3NoYWRvd01hcC5yZW5kZXJUYXJnZXRzW3JlbmRlclRhcmdldEluZGV4XTtcblxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIHJlbmRlckZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSwgY2xlYXIsIGluc2lkZVJlbmRlclBhc3MgPSB0cnVlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzaGFkb3dNYXBTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFNIQURPVyAke2xpZ2h0Ll9ub2RlLm5hbWV9IEZBQ0UgJHtmYWNlfWApO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hVbmlmb3JtcyhsaWdodCwgc2hhZG93Q2FtLCBsaWdodFJlbmRlckRhdGEsIGZhY2UpO1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gc2hhZG93Q2FtLnJlbmRlclRhcmdldDtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVyO1xuICAgICAgICByZW5kZXJlci5zZXRDYW1lcmFVbmlmb3JtcyhzaGFkb3dDYW0sIHJ0KTtcbiAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG4gICAgICAgICAgICByZW5kZXJlci5zZXR1cFZpZXdVbmlmb3JtQnVmZmVycyhsaWdodFJlbmRlckRhdGEudmlld0JpbmRHcm91cHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5zaWRlUmVuZGVyUGFzcykge1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0dXBWaWV3cG9ydChzaGFkb3dDYW0sIHJ0KTtcblxuICAgICAgICAgICAgLy8gY2xlYXIgaGVyZSBpcyB1c2VkIHRvIGNsZWFyIGEgdmlld3BvcnQgaW5zaWRlIHJlbmRlciB0YXJnZXQuXG4gICAgICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJlci5jbGVhcihzaGFkb3dDYW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGlzIG9ubHkgdXNlZCBieSBsaWdodG1hcHBlciwgdGlsbCBpdCdzIGNvbnZlcnRlZCB0byByZW5kZXIgcGFzc2VzXG4gICAgICAgICAgICByZW5kZXJlci5jbGVhclZpZXcoc2hhZG93Q2FtLCBydCwgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnN1Ym1pdENhc3RlcnMobGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBsaWdodCk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lICs9IG5vdygpIC0gc2hhZG93TWFwU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSwgaW5zaWRlUmVuZGVyUGFzcyA9IHRydWUpIHtcblxuICAgICAgICBpZiAodGhpcy5uZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZhY2VDb3VudCA9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgZmFjZXNcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCB0cnVlLCBpbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXBwbHkgdnNtXG4gICAgICAgICAgICB0aGlzLnJlbmRlclZzbShsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlclZzbShsaWdodCwgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gVlNNIGJsdXIgaWYgbGlnaHQgc3VwcG9ydHMgdnNtIChkaXJlY3Rpb25hbCBhbmQgc3BvdCBpbiBnZW5lcmFsKVxuICAgICAgICBpZiAobGlnaHQuX2lzVnNtICYmIGxpZ2h0Ll92c21CbHVyU2l6ZSA+IDEpIHtcblxuICAgICAgICAgICAgLy8gaW4gY2x1c3RlcmVkIG1vZGUsIG9ubHkgZGlyZWN0aW9uYWwgbGlnaHQgY2FuIGJlIHZtc1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgIGlmICghaXNDbHVzdGVyZWQgfHwgbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgVlNNICR7bGlnaHQuX25vZGUubmFtZX1gKTtcblxuICAgICAgICAvLyByZW5kZXIgc3RhdGVcbiAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCAwKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcbiAgICAgICAgY29uc3Qgb3JpZ1NoYWRvd01hcCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgZm9yIGJsdXJyaW5nXG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG9wdGltYWwgYW5kIHNoYWRvdyBtYXAgY291bGQgaGF2ZSBkZXB0aCBidWZmZXIgb24gaW4gYWRkaXRpb24gdG8gY29sb3IgYnVmZmVyLFxuICAgICAgICAvLyBhbmQgZm9yIGJsdXJyaW5nIG9ubHkgb25lIGJ1ZmZlciBpcyBuZWVkZWQuXG4gICAgICAgIGNvbnN0IHRlbXBTaGFkb3dNYXAgPSB0aGlzLnJlbmRlcmVyLnNoYWRvd01hcENhY2hlLmdldChkZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgY29uc3QgdGVtcFJ0ID0gdGVtcFNoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtOCA9IGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNODtcbiAgICAgICAgY29uc3QgYmx1ck1vZGUgPSBsaWdodC52c21CbHVyTW9kZTtcbiAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IGxpZ2h0Ll92c21CbHVyU2l6ZTtcbiAgICAgICAgY29uc3QgYmx1clNoYWRlciA9IHRoaXMuZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKTtcblxuICAgICAgICBibHVyU2Npc3NvclJlY3QueiA9IGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uIC0gMjtcbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LncgPSBibHVyU2Npc3NvclJlY3QuejtcblxuICAgICAgICAvLyBCbHVyIGhvcml6b250YWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZShvcmlnU2hhZG93TWFwLmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAxIC8gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJsdXJNb2RlID09PSBCTFVSX0dBVVNTSUFOKSB0aGlzLndlaWdodElkLnNldFZhbHVlKHRoaXMuYmx1clZzbVdlaWdodHNbZmlsdGVyU2l6ZV0pO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUnQsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gQmx1ciB2ZXJ0aWNhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKHRlbXBSdC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gcGl4ZWxPZmZzZXRbMF07XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgb3JpZ1NoYWRvd01hcCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIHRlbXBvcmFyeSBzaGFkb3cgbWFwIGJhY2sgdG8gdGhlIGNhY2hlXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuYWRkKGxpZ2h0LCB0ZW1wU2hhZG93TWFwKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIG5vIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZG93UmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJnYXVzcyIsIngiLCJzaWdtYSIsIk1hdGgiLCJleHAiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJpIiwidGVtcFNldCIsIlNldCIsInNoYWRvd0NhbVZpZXciLCJNYXQ0Iiwic2hhZG93Q2FtVmlld1Byb2oiLCJwaXhlbE9mZnNldCIsIkZsb2F0MzJBcnJheSIsImJsdXJTY2lzc29yUmVjdCIsIlZlYzQiLCJ2aWV3cG9ydE1hdHJpeCIsIlNoYWRvd1JlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJyZW5kZXJlciIsImxpZ2h0VGV4dHVyZUF0bGFzIiwic2hhZG93UGFzc0NhY2hlIiwiZGV2aWNlIiwic2NvcGUiLCJwb2x5Z29uT2Zmc2V0SWQiLCJyZXNvbHZlIiwicG9seWdvbk9mZnNldCIsInNvdXJjZUlkIiwicGl4ZWxPZmZzZXRJZCIsIndlaWdodElkIiwiYmx1clZzbVNoYWRlckNvZGUiLCJzaGFkZXJDaHVua3MiLCJibHVyVlNNUFMiLCJwYWNrZWQiLCJibHVyUGFja2VkVnNtU2hhZGVyQ29kZSIsImJsdXJWc21TaGFkZXIiLCJibHVyUGFja2VkVnNtU2hhZGVyIiwiYmx1clZzbVdlaWdodHMiLCJzaGFkb3dNYXBMaWdodFJhZGl1c0lkIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiYmxlbmRTdGF0ZVdyaXRlIiwiQmxlbmRTdGF0ZSIsImJsZW5kU3RhdGVOb1dyaXRlIiwic2V0Q29sb3JXcml0ZSIsImNyZWF0ZVNoYWRvd0NhbWVyYSIsInNoYWRvd1R5cGUiLCJ0eXBlIiwiZmFjZSIsInNoYWRvd0NhbSIsIkxpZ2h0Q2FtZXJhIiwiY3JlYXRlIiwiU0hBRE9XX1ZTTTgiLCJTSEFET1dfVlNNMzIiLCJjbGVhckNvbG9yIiwiQ29sb3IiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwic2V0U2hhZG93Q2FtZXJhU2V0dGluZ3MiLCJpc0NsdXN0ZXJlZCIsImh3UGNmIiwiU0hBRE9XX1BDRjUiLCJTSEFET1dfUENGMSIsIlNIQURPV19QQ0YzIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsIkxJR0hUVFlQRV9PTU5JIiwiY2xlYXJDb2xvckJ1ZmZlciIsIl9jdWxsU2hhZG93Q2FzdGVyc0ludGVybmFsIiwibWVzaEluc3RhbmNlcyIsInZpc2libGUiLCJjYW1lcmEiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJtZXNoSW5zdGFuY2UiLCJjYXN0U2hhZG93IiwiY3VsbCIsIl9pc1Zpc2libGUiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwicHVzaCIsImN1bGxTaGFkb3dDYXN0ZXJzIiwiY29tcCIsImxpZ2h0IiwiY2FzdGVycyIsImxheWVycyIsImxheWVyTGlzdCIsImxlbiIsImxheWVyIiwiX2xpZ2h0c1NldCIsImhhcyIsImFkZCIsInNoYWRvd0Nhc3RlcnMiLCJjbGVhciIsInNvcnQiLCJzb3J0Q29tcGFyZURlcHRoIiwic2V0dXBSZW5kZXJTdGF0ZSIsImlzV2ViR0wxIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsIl90eXBlIiwic2V0VmFsdWUiLCJzaGFkb3dCaWFzIiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJncHVPckdsMiIsImlzV2ViR0wyIiwiaXNXZWJHUFUiLCJ1c2VTaGFkb3dTYW1wbGVyIiwiX2lzUGNmIiwic2V0QmxlbmRTdGF0ZSIsInNldERlcHRoU3RhdGUiLCJzaGFkb3dEZXB0aFN0YXRlIiwic2V0U3RlbmNpbFN0YXRlIiwiZGlzcGF0Y2hVbmlmb3JtcyIsImxpZ2h0UmVuZGVyRGF0YSIsInNoYWRvd0NhbU5vZGUiLCJfbm9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImRpc3BhdGNoVmlld1BvcyIsImdldFBvc2l0aW9uIiwiYXR0ZW51YXRpb25FbmQiLCJzZXRUUlMiLCJnZXRSb3RhdGlvbiIsIlZlYzMiLCJPTkUiLCJpbnZlcnQiLCJtdWwyIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3RWaWV3cG9ydCIsInNoYWRvd1ZpZXdwb3J0IiwicmVjdCIsInNjaXNzb3JSZWN0Iiwic2hhZG93U2Npc3NvciIsInNldFZpZXdwb3J0IiwieSIsInoiLCJ3Iiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJzZXQiLCJkYXRhIiwiZ2V0U2hhZG93UGFzcyIsIl90aGlzJHNoYWRvd1Bhc3NDYWNoZSIsImxpZ2h0VHlwZSIsIl9zaGFkb3dUeXBlIiwic2hhZG93UGFzc0luZm8iLCJzaGFkb3dQYXNzTmFtZSIsIlNoYWRlclBhc3MiLCJnZXQiLCJhbGxvY2F0ZSIsImlzU2hhZG93IiwiaW5kZXgiLCJzdWJtaXRDYXN0ZXJzIiwidmlzaWJsZUNhc3RlcnMiLCJwYXNzRmxhZ3MiLCJTSEFERVJfU0hBRE9XIiwic2hhZG93UGFzcyIsImNvdW50IiwibWVzaCIsImVuc3VyZU1hdGVyaWFsIiwibWF0ZXJpYWwiLCJzZXRCYXNlQ29uc3RhbnRzIiwic2V0U2tpbm5pbmciLCJkaXJ0eSIsInVwZGF0ZVVuaWZvcm1zIiwiY2h1bmtzIiwic2V0dXBDdWxsTW9kZSIsInNldFBhcmFtZXRlcnMiLCJzaGFkZXJJbnN0YW5jZSIsImdldFNoYWRlckluc3RhbmNlIiwic2hhZG93U2hhZGVyIiwic2hhZGVyIiwiRGVidWciLCJhc3NlcnQiLCJfa2V5IiwiU09SVEtFWV9ERVBUSCIsImlkIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJuYW1lIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGhJbnN0YW5jZSIsInNldHVwTWVzaFVuaWZvcm1CdWZmZXJzIiwic3R5bGUiLCJyZW5kZXJTdHlsZSIsInNldEluZGV4QnVmZmVyIiwiaW5kZXhCdWZmZXIiLCJkcmF3SW5zdGFuY2UiLCJfc2hhZG93RHJhd0NhbGxzIiwibmVlZHNTaGFkb3dSZW5kZXJpbmciLCJuZWVkcyIsImVuYWJsZWQiLCJjYXN0U2hhZG93cyIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJfc2hhZG93TWFwVXBkYXRlcyIsIm51bVNoYWRvd0ZhY2VzIiwiZ2V0TGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNldHVwUmVuZGVyUGFzcyIsInJlbmRlclBhc3MiLCJzaGFkb3dDYW1lcmEiLCJjbGVhclJlbmRlclRhcmdldCIsInJ0IiwicmVuZGVyVGFyZ2V0IiwiaW5pdCIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImNsZWFyRGVwdGgiLCJkZXB0aEJ1ZmZlciIsInN0b3JlRGVwdGgiLCJjb2xvck9wcyIsImNsZWFyVmFsdWUiLCJjb3B5IiwicmVxdWlyZXNDdWJlbWFwcyIsInByZXBhcmVGYWNlIiwicmVuZGVyVGFyZ2V0SW5kZXgiLCJfc2hhZG93TWFwIiwicmVuZGVyVGFyZ2V0cyIsInJlbmRlckZhY2UiLCJpbnNpZGVSZW5kZXJQYXNzIiwic2hhZG93TWFwU3RhcnRUaW1lIiwibm93IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwic2V0dXBWaWV3cG9ydCIsImNsZWFyVmlldyIsInBvcEdwdU1hcmtlciIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyIiwiZmFjZUNvdW50IiwicmVuZGVyVnNtIiwiX2lzVnNtIiwiX3ZzbUJsdXJTaXplIiwiYXBwbHlWc21CbHVyIiwiZ2V0VnNtQmx1clNoYWRlciIsImlzVnNtOCIsImJsdXJNb2RlIiwiZmlsdGVyU2l6ZSIsImJsdXJTaGFkZXIiLCJibHVyVlMiLCJmdWxsc2NyZWVuUXVhZFZTIiwiYmx1ckZTIiwiYmx1clNoYWRlck5hbWUiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsIk5PQkxFTkQiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsInNoYWRvd01hcENhY2hlIiwidGVtcFJ0IiwidnNtQmx1ck1vZGUiLCJfc2hhZG93UmVzb2x1dGlvbiIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJmcmFtZVVwZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMkJBLFNBQVNBLEtBQUtBLENBQUNDLENBQUMsRUFBRUMsS0FBSyxFQUFF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
