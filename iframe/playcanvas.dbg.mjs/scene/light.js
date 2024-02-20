import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, LIGHTSHAPE_PUNCTUAL, SHADOWUPDATE_REALTIME, LIGHTTYPE_OMNI, SHADOW_PCSS, SHADOW_PCF5, SHADOW_VSM32, SHADOW_VSM16, SHADOW_VSM8, SHADOW_PCF1, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT } from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';
import { DepthState } from '../platform/graphics/depth-state.js';

const tmpVec = new Vec3();
const tmpBiases = {
  bias: 0,
  normalBias: 0
};
const chanId = {
  r: 0,
  g: 1,
  b: 2,
  a: 3
};
const lightTypes = {
  'directional': LIGHTTYPE_DIRECTIONAL,
  'omni': LIGHTTYPE_OMNI,
  'point': LIGHTTYPE_OMNI,
  'spot': LIGHTTYPE_SPOT
};

// viewport in shadows map for cascades for directional light
const directionalCascades = [[new Vec4(0, 0, 1, 1)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]];
let id = 0;

/**
 * Class storing shadow rendering related private information
 *
 * @ignore
 */
class LightRenderData {
  constructor(device, camera, face, light) {
    // light this data belongs to
    this.light = light;

    // camera this applies to. Only used by directional light, as directional shadow map
    // is culled and rendered for each camera. Local lights' shadow is culled and rendered one time
    // and shared between cameras (even though it's not strictly correct and we can get shadows
    // from a mesh that is not visible by the camera)
    this.camera = camera;

    // camera used to cull / render the shadow map
    this.shadowCamera = ShadowRenderer.createShadowCamera(device, light._shadowType, light._type, face);

    // shadow view-projection matrix
    this.shadowMatrix = new Mat4();

    // viewport for the shadow rendering to the texture (x, y, width, height)
    this.shadowViewport = new Vec4(0, 0, 1, 1);

    // scissor rectangle for the shadow rendering to the texture (x, y, width, height)
    this.shadowScissor = new Vec4(0, 0, 1, 1);

    // depth range compensation for PCSS with directional lights
    this.depthRangeCompensation = 0;
    this.projectionCompensation = 0;

    // face index, value is based on light type:
    // - spot: always 0
    // - omni: cubemap face, 0..5
    // - directional: 0 for simple shadows, cascade index for cascaded shadow map
    this.face = face;

    // visible shadow casters
    this.visibleCasters = [];

    // an array of view bind groups, single entry is used for shadows
    /** @type {import('../platform/graphics/bind-group.js').BindGroup[]} */
    this.viewBindGroups = [];
  }

  // releases GPU resources
  destroy() {
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }

  // returns shadow buffer currently attached to the shadow camera
  get shadowBuffer() {
    const rt = this.shadowCamera.renderTarget;
    if (rt) {
      const light = this.light;
      if (light._type === LIGHTTYPE_OMNI) {
        return rt.colorBuffer;
      }
      return light._isPcf && light.device.supportsDepthShadow ? rt.depthBuffer : rt.colorBuffer;
    }
    return null;
  }
}

/**
 * A light.
 *
 * @ignore
 */
class Light {
  constructor(graphicsDevice, clusteredLighting) {
    /**
     * The Layers the light is on.
     *
     * @type {Set<import('./layer.js').Layer>}
     */
    this.layers = new Set();
    /**
     * True if the clustered lighting is enabled.
     *
     * @type {boolean}
     */
    this.clusteredLighting = void 0;
    /**
     * The depth state used when rendering the shadow map.
     *
     * @type {DepthState}
     */
    this.shadowDepthState = DepthState.DEFAULT.clone();
    this.device = graphicsDevice;
    this.clusteredLighting = clusteredLighting;
    this.id = id++;

    // Light properties (defaults)
    this._type = LIGHTTYPE_DIRECTIONAL;
    this._color = new Color(0.8, 0.8, 0.8);
    this._intensity = 1;
    this._affectSpecularity = true;
    this._luminance = 0;
    this._castShadows = false;
    this._enabled = false;
    this._mask = MASK_AFFECT_DYNAMIC;
    this.isStatic = false;
    this.key = 0;
    this.bakeDir = true;
    this.bakeNumSamples = 1;
    this.bakeArea = 0;

    // Omni and spot properties
    this.attenuationStart = 10;
    this.attenuationEnd = 10;
    this._falloffMode = LIGHTFALLOFF_LINEAR;
    this._shadowType = SHADOW_PCF3;
    this._vsmBlurSize = 11;
    this.vsmBlurMode = BLUR_GAUSSIAN;
    this.vsmBias = 0.01 * 0.25;
    this._cookie = null; // light cookie texture (2D for spot, cubemap for omni)
    this.cookieIntensity = 1;
    this._cookieFalloff = true;
    this._cookieChannel = 'rgb';
    this._cookieTransform = null; // 2d rotation/scale matrix (spot only)
    this._cookieTransformUniform = new Float32Array(4);
    this._cookieOffset = null; // 2d position offset (spot only)
    this._cookieOffsetUniform = new Float32Array(2);
    this._cookieTransformSet = false;
    this._cookieOffsetSet = false;

    // Spot properties
    this._innerConeAngle = 40;
    this._outerConeAngle = 45;

    // Directional properties
    this.cascades = null; // an array of Vec4 viewports per cascade
    this._shadowMatrixPalette = null; // a float array, 16 floats per cascade
    this._shadowCascadeDistances = null;
    this.numCascades = 1;
    this.cascadeDistribution = 0.5;

    // Light source shape properties
    this._shape = LIGHTSHAPE_PUNCTUAL;

    // Cache of light property data in a format more friendly for shader uniforms
    this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
    const c = Math.pow(this._finalColor[0], 2.2);
    this._linearFinalColor = new Float32Array([c, c, c]);
    this._position = new Vec3(0, 0, 0);
    this._direction = new Vec3(0, 0, 0);
    this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
    this._updateOuterAngle(this._outerConeAngle);
    this._usePhysicalUnits = undefined;

    // Shadow mapping resources
    this._shadowMap = null;
    this._shadowRenderParams = [];
    this._shadowCameraParams = [];

    // Shadow mapping properties
    this.shadowDistance = 40;
    this._shadowResolution = 1024;
    this._shadowBias = -0.0005;
    this.shadowIntensity = 1.0;
    this._normalOffsetBias = 0.0;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
    this.shadowUpdateOverrides = null;
    this._penumbraSize = 1.0;
    this._isVsm = false;
    this._isPcf = true;

    // cookie matrix (used in case the shadow mapping is disabled and so the shadow matrix cannot be used)
    this._cookieMatrix = null;

    // viewport of the cookie texture / shadow in the atlas
    this._atlasViewport = null;
    this.atlasViewportAllocated = false; // if true, atlas slot is allocated for the current frame
    this.atlasVersion = 0; // version of the atlas for the allocated slot, allows invalidation when atlas recreates slots
    this.atlasSlotIndex = 0; // allocated slot index, used for more persistent slot allocation
    this.atlasSlotUpdated = false; // true if the atlas slot was reassigned this frame (and content needs to be updated)

    this._node = null;

    // private rendering data
    this._renderData = [];

    // true if the light is visible by any camera within a frame
    this.visibleThisFrame = false;

    // maximum size of the light bounding sphere on the screen by any camera within a frame
    // (used to estimate shadow resolution), range [0..1]
    this.maxScreenSize = 0;
    this._updateShadowBias();
  }
  destroy() {
    this._destroyShadowMap();
    this.releaseRenderData();
    this._renderData = null;
  }
  releaseRenderData() {
    if (this._renderData) {
      for (let i = 0; i < this._renderData.length; i++) {
        this._renderData[i].destroy();
      }
      this._renderData.length = 0;
    }
  }
  addLayer(layer) {
    this.layers.add(layer);
  }
  removeLayer(layer) {
    this.layers.delete(layer);
  }
  set shadowBias(value) {
    if (this._shadowBias !== value) {
      this._shadowBias = value;
      this._updateShadowBias();
    }
  }
  get shadowBias() {
    return this._shadowBias;
  }
  set numCascades(value) {
    if (!this.cascades || this.numCascades !== value) {
      this.cascades = directionalCascades[value - 1];
      this._shadowMatrixPalette = new Float32Array(4 * 16); // always 4
      this._shadowCascadeDistances = new Float32Array(4); // always 4
      this._destroyShadowMap();
      this.updateKey();
    }
  }
  get numCascades() {
    return this.cascades.length;
  }
  set shadowMap(shadowMap) {
    if (this._shadowMap !== shadowMap) {
      this._destroyShadowMap();
      this._shadowMap = shadowMap;
    }
  }
  get shadowMap() {
    return this._shadowMap;
  }
  set mask(value) {
    if (this._mask !== value) {
      this._mask = value;
      this.updateKey();
    }
  }
  get mask() {
    return this._mask;
  }

  // returns number of render targets to render the shadow map
  get numShadowFaces() {
    const type = this._type;
    if (type === LIGHTTYPE_DIRECTIONAL) {
      return this.numCascades;
    } else if (type === LIGHTTYPE_OMNI) {
      return 6;
    }
    return 1;
  }
  set type(value) {
    if (this._type === value) return;
    this._type = value;
    this._destroyShadowMap();
    this._updateShadowBias();
    this.updateKey();
    const stype = this._shadowType;
    this._shadowType = null;
    this.shadowUpdateOverrides = null;
    this.shadowType = stype; // refresh shadow type; switching from direct/spot to omni and back may change it
  }

  get type() {
    return this._type;
  }
  set shape(value) {
    if (this._shape === value) return;
    this._shape = value;
    this._destroyShadowMap();
    this.updateKey();
    const stype = this._shadowType;
    this._shadowType = null;
    this.shadowType = stype; // refresh shadow type; switching shape and back may change it
  }

  get shape() {
    return this._shape;
  }
  set usePhysicalUnits(value) {
    if (this._usePhysicalUnits !== value) {
      this._usePhysicalUnits = value;
      this._updateFinalColor();
    }
  }
  get usePhysicalUnits() {
    return this._usePhysicalUnits;
  }
  set shadowType(value) {
    if (this._shadowType === value) return;
    const device = this.device;
    if (this._type === LIGHTTYPE_OMNI && value !== SHADOW_PCF3 && value !== SHADOW_PCSS) value = SHADOW_PCF3; // VSM or HW PCF for omni lights is not supported yet

    const supportsDepthShadow = device.supportsDepthShadow;
    if (value === SHADOW_PCF5 && !supportsDepthShadow) {
      value = SHADOW_PCF3; // fallback from HW PCF to old PCF
    }

    // fallback from vsm32 to vsm16
    if (value === SHADOW_VSM32 && (!device.textureFloatRenderable || !device.textureFloatFilterable)) value = SHADOW_VSM16;

    // fallback from vsm16 to vsm8
    if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable) value = SHADOW_VSM8;
    this._isVsm = value >= SHADOW_VSM8 && value <= SHADOW_VSM32;
    this._isPcf = value === SHADOW_PCF1 || value === SHADOW_PCF3 || value === SHADOW_PCF5;
    this._shadowType = value;
    this._destroyShadowMap();
    this.updateKey();
  }
  get shadowType() {
    return this._shadowType;
  }
  set enabled(value) {
    if (this._enabled !== value) {
      this._enabled = value;
      this.layersDirty();
    }
  }
  get enabled() {
    return this._enabled;
  }
  set castShadows(value) {
    if (this._castShadows !== value) {
      this._castShadows = value;
      this._destroyShadowMap();
      this.layersDirty();
      this.updateKey();
    }
  }
  get castShadows() {
    return this._castShadows && this._mask !== MASK_BAKE && this._mask !== 0;
  }
  set shadowResolution(value) {
    if (this._shadowResolution !== value) {
      if (this._type === LIGHTTYPE_OMNI) {
        value = Math.min(value, this.device.maxCubeMapSize);
      } else {
        value = Math.min(value, this.device.maxTextureSize);
      }
      this._shadowResolution = value;
      this._destroyShadowMap();
    }
  }
  get shadowResolution() {
    return this._shadowResolution;
  }
  set vsmBlurSize(value) {
    if (this._vsmBlurSize === value) return;
    if (value % 2 === 0) value++; // don't allow even size
    this._vsmBlurSize = value;
  }
  get vsmBlurSize() {
    return this._vsmBlurSize;
  }
  set normalOffsetBias(value) {
    if (this._normalOffsetBias === value) return;
    if (!this._normalOffsetBias && value || this._normalOffsetBias && !value) {
      this.updateKey();
    }
    this._normalOffsetBias = value;
  }
  get normalOffsetBias() {
    return this._normalOffsetBias;
  }
  set falloffMode(value) {
    if (this._falloffMode === value) return;
    this._falloffMode = value;
    this.updateKey();
  }
  get falloffMode() {
    return this._falloffMode;
  }
  set innerConeAngle(value) {
    if (this._innerConeAngle === value) return;
    this._innerConeAngle = value;
    this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
    if (this._usePhysicalUnits) {
      this._updateFinalColor();
    }
  }
  get innerConeAngle() {
    return this._innerConeAngle;
  }
  set outerConeAngle(value) {
    if (this._outerConeAngle === value) return;
    this._outerConeAngle = value;
    this._updateOuterAngle(value);
    if (this._usePhysicalUnits) {
      this._updateFinalColor();
    }
  }
  get outerConeAngle() {
    return this._outerConeAngle;
  }
  set penumbraSize(value) {
    this._penumbraSize = value;
  }
  get penumbraSize() {
    return this._penumbraSize;
  }
  _updateOuterAngle(angle) {
    const radAngle = angle * Math.PI / 180;
    this._outerConeAngleCos = Math.cos(radAngle);
    this._outerConeAngleSin = Math.sin(radAngle);
  }
  set intensity(value) {
    if (this._intensity !== value) {
      this._intensity = value;
      this._updateFinalColor();
    }
  }
  get intensity() {
    return this._intensity;
  }
  set affectSpecularity(value) {
    if (this._type === LIGHTTYPE_DIRECTIONAL) {
      this._affectSpecularity = value;
      this.updateKey();
    }
  }
  get affectSpecularity() {
    return this._affectSpecularity;
  }
  set luminance(value) {
    if (this._luminance !== value) {
      this._luminance = value;
      this._updateFinalColor();
    }
  }
  get luminance() {
    return this._luminance;
  }
  get cookieMatrix() {
    if (!this._cookieMatrix) {
      this._cookieMatrix = new Mat4();
    }
    return this._cookieMatrix;
  }
  get atlasViewport() {
    if (!this._atlasViewport) {
      this._atlasViewport = new Vec4(0, 0, 1, 1);
    }
    return this._atlasViewport;
  }
  set cookie(value) {
    if (this._cookie === value) return;
    this._cookie = value;
    this.updateKey();
  }
  get cookie() {
    return this._cookie;
  }
  set cookieFalloff(value) {
    if (this._cookieFalloff === value) return;
    this._cookieFalloff = value;
    this.updateKey();
  }
  get cookieFalloff() {
    return this._cookieFalloff;
  }
  set cookieChannel(value) {
    if (this._cookieChannel === value) return;
    if (value.length < 3) {
      const chr = value.charAt(value.length - 1);
      const addLen = 3 - value.length;
      for (let i = 0; i < addLen; i++) value += chr;
    }
    this._cookieChannel = value;
    this.updateKey();
  }
  get cookieChannel() {
    return this._cookieChannel;
  }
  set cookieTransform(value) {
    if (this._cookieTransform === value) return;
    this._cookieTransform = value;
    this._cookieTransformSet = !!value;
    if (value && !this._cookieOffset) {
      this.cookieOffset = new Vec2(); // using transform forces using offset code
      this._cookieOffsetSet = false;
    }
    this.updateKey();
  }
  get cookieTransform() {
    return this._cookieTransform;
  }
  set cookieOffset(value) {
    if (this._cookieOffset === value) return;
    const xformNew = !!(this._cookieTransformSet || value);
    if (xformNew && !value && this._cookieOffset) {
      this._cookieOffset.set(0, 0);
    } else {
      this._cookieOffset = value;
    }
    this._cookieOffsetSet = !!value;
    if (value && !this._cookieTransform) {
      this.cookieTransform = new Vec4(1, 1, 0, 0); // using offset forces using matrix code
      this._cookieTransformSet = false;
    }
    this.updateKey();
  }
  get cookieOffset() {
    return this._cookieOffset;
  }

  // prepares light for the frame rendering
  beginFrame() {
    this.visibleThisFrame = this._type === LIGHTTYPE_DIRECTIONAL && this._enabled;
    this.maxScreenSize = 0;
    this.atlasViewportAllocated = false;
    this.atlasSlotUpdated = false;
  }

  // destroys shadow map related resources, called when shadow properties change and resources
  // need to be recreated
  _destroyShadowMap() {
    this.releaseRenderData();
    if (this._shadowMap) {
      if (!this._shadowMap.cached) {
        this._shadowMap.destroy();
      }
      this._shadowMap = null;
    }
    if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
      this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
    }
    if (this.shadowUpdateOverrides) {
      for (let i = 0; i < this.shadowUpdateOverrides.length; i++) {
        if (this.shadowUpdateOverrides[i] === SHADOWUPDATE_NONE) {
          this.shadowUpdateOverrides[i] = SHADOWUPDATE_THISFRAME;
        }
      }
    }
  }

  // returns LightRenderData with matching camera and face
  getRenderData(camera, face) {
    // returns existing
    for (let i = 0; i < this._renderData.length; i++) {
      const current = this._renderData[i];
      if (current.camera === camera && current.face === face) {
        return current;
      }
    }

    // create new one
    const rd = new LightRenderData(this.device, camera, face, this);
    this._renderData.push(rd);
    return rd;
  }

  /**
   * Duplicates a light node but does not 'deep copy' the hierarchy.
   *
   * @returns {Light} A cloned Light.
   */
  clone() {
    const clone = new Light(this.device, this.clusteredLighting);

    // Clone Light properties
    clone.type = this._type;
    clone.setColor(this._color);
    clone.intensity = this._intensity;
    clone.affectSpecularity = this._affectSpecularity;
    clone.luminance = this._luminance;
    clone.castShadows = this.castShadows;
    clone._enabled = this._enabled;

    // Omni and spot properties
    clone.attenuationStart = this.attenuationStart;
    clone.attenuationEnd = this.attenuationEnd;
    clone.falloffMode = this._falloffMode;
    clone.shadowType = this._shadowType;
    clone.vsmBlurSize = this._vsmBlurSize;
    clone.vsmBlurMode = this.vsmBlurMode;
    clone.vsmBias = this.vsmBias;
    clone.penumbraSize = this.penumbraSize;
    clone.shadowUpdateMode = this.shadowUpdateMode;
    clone.mask = this.mask;
    if (this.shadowUpdateOverrides) {
      clone.shadowUpdateOverrides = this.shadowUpdateOverrides.slice();
    }

    // Spot properties
    clone.innerConeAngle = this._innerConeAngle;
    clone.outerConeAngle = this._outerConeAngle;

    // Directional properties
    clone.numCascades = this.numCascades;
    clone.cascadeDistribution = this.cascadeDistribution;

    // shape properties
    clone.shape = this._shape;

    // Shadow properties
    clone.shadowDepthState.copy(this.shadowDepthState);
    clone.shadowBias = this.shadowBias;
    clone.normalOffsetBias = this._normalOffsetBias;
    clone.shadowResolution = this._shadowResolution;
    clone.shadowDistance = this.shadowDistance;
    clone.shadowIntensity = this.shadowIntensity;

    // Cookies properties
    // clone.cookie = this._cookie;
    // clone.cookieIntensity = this.cookieIntensity;
    // clone.cookieFalloff = this._cookieFalloff;
    // clone.cookieChannel = this._cookieChannel;
    // clone.cookieTransform = this._cookieTransform;
    // clone.cookieOffset = this._cookieOffset;

    return clone;
  }

  /**
   * Get conversion factor for luminance -> light specific light unit.
   *
   * @param {number} type - The type of light.
   * @param {number} [outerAngle] - The outer angle of a spot light.
   * @param {number} [innerAngle] - The inner angle of a spot light.
   * @returns {number} The scaling factor to multiply with the luminance value.
   */
  static getLightUnitConversion(type, outerAngle = Math.PI / 4, innerAngle = 0) {
    switch (type) {
      case LIGHTTYPE_SPOT:
        {
          const falloffEnd = Math.cos(outerAngle);
          const falloffStart = Math.cos(innerAngle);

          // https://github.com/mmp/pbrt-v4/blob/faac34d1a0ebd24928828fe9fa65b65f7efc5937/src/pbrt/lights.cpp#L1463
          return 2 * Math.PI * (1 - falloffStart + (falloffStart - falloffEnd) / 2.0);
        }
      case LIGHTTYPE_OMNI:
        // https://google.github.io/filament/Filament.md.html#lighting/directlighting/punctuallights/pointlights
        return 4 * Math.PI;
      case LIGHTTYPE_DIRECTIONAL:
        // https://google.github.io/filament/Filament.md.html#lighting/directlighting/directionallights
        return 1;
    }
  }

  // returns the bias (.x) and normalBias (.y) value for lights as passed to shaders by uniforms
  // Note: this needs to be revisited and simplified
  // Note: vsmBias is not used at all for omni light, even though it is editable in the Editor
  _getUniformBiasValues(lightRenderData) {
    const farClip = lightRenderData.shadowCamera._farClip;
    switch (this._type) {
      case LIGHTTYPE_OMNI:
        tmpBiases.bias = this.shadowBias;
        tmpBiases.normalBias = this._normalOffsetBias;
        break;
      case LIGHTTYPE_SPOT:
        if (this._isVsm) {
          tmpBiases.bias = -0.00001 * 20;
        } else {
          tmpBiases.bias = this.shadowBias * 20; // approx remap from old bias values
          if (this.device.isWebGL1 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
        }
        tmpBiases.normalBias = this._isVsm ? this.vsmBias / (this.attenuationEnd / 7.0) : this._normalOffsetBias;
        break;
      case LIGHTTYPE_DIRECTIONAL:
        // make bias dependent on far plane because it's not constant for direct light
        // clip distance used is based on the nearest shadow cascade
        if (this._isVsm) {
          tmpBiases.bias = -0.00001 * 20;
        } else {
          tmpBiases.bias = this.shadowBias / farClip * 100;
          if (this.device.isWebGL1 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
        }
        tmpBiases.normalBias = this._isVsm ? this.vsmBias / (farClip / 7.0) : this._normalOffsetBias;
        break;
    }
    return tmpBiases;
  }
  getColor() {
    return this._color;
  }
  getBoundingSphere(sphere) {
    if (this._type === LIGHTTYPE_SPOT) {
      // based on https://bartwronski.com/2017/04/13/cull-that-cone/
      const size = this.attenuationEnd;
      const angle = this._outerConeAngle;
      const cosAngle = this._outerConeAngleCos;
      const node = this._node;
      tmpVec.copy(node.up);
      if (angle > 45) {
        sphere.radius = size * this._outerConeAngleSin;
        tmpVec.mulScalar(-size * cosAngle);
      } else {
        sphere.radius = size / (2 * cosAngle);
        tmpVec.mulScalar(-sphere.radius);
      }
      sphere.center.add2(node.getPosition(), tmpVec);
    } else if (this._type === LIGHTTYPE_OMNI) {
      sphere.center = this._node.getPosition();
      sphere.radius = this.attenuationEnd;
    }
  }
  getBoundingBox(box) {
    if (this._type === LIGHTTYPE_SPOT) {
      const range = this.attenuationEnd;
      const angle = this._outerConeAngle;
      const node = this._node;
      const scl = Math.abs(Math.sin(angle * math.DEG_TO_RAD) * range);
      box.center.set(0, -range * 0.5, 0);
      box.halfExtents.set(scl, range * 0.5, scl);
      box.setFromTransformedAabb(box, node.getWorldTransform(), true);
    } else if (this._type === LIGHTTYPE_OMNI) {
      box.center.copy(this._node.getPosition());
      box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
    }
  }
  _updateShadowBias() {
    const device = this.device;
    if (device.isWebGL2 || device.isWebGPU) {
      if (this._type === LIGHTTYPE_OMNI && !this.clusteredLighting) {
        this.shadowDepthState.depthBias = 0;
        this.shadowDepthState.depthBiasSlope = 0;
      } else {
        const bias = this.shadowBias * -1000.0;
        this.shadowDepthState.depthBias = bias;
        this.shadowDepthState.depthBiasSlope = bias;
      }
    }
  }
  _updateFinalColor() {
    const color = this._color;
    const r = color.r;
    const g = color.g;
    const b = color.b;
    let i = this._intensity;

    // To calculate the lux, which is lm/m^2, we need to convert from luminous power
    if (this._usePhysicalUnits) {
      i = this._luminance / Light.getLightUnitConversion(this._type, this._outerConeAngle * math.DEG_TO_RAD, this._innerConeAngle * math.DEG_TO_RAD);
    }
    const finalColor = this._finalColor;
    const linearFinalColor = this._linearFinalColor;
    finalColor[0] = r * i;
    finalColor[1] = g * i;
    finalColor[2] = b * i;
    if (i >= 1) {
      linearFinalColor[0] = Math.pow(r, 2.2) * i;
      linearFinalColor[1] = Math.pow(g, 2.2) * i;
      linearFinalColor[2] = Math.pow(b, 2.2) * i;
    } else {
      linearFinalColor[0] = Math.pow(finalColor[0], 2.2);
      linearFinalColor[1] = Math.pow(finalColor[1], 2.2);
      linearFinalColor[2] = Math.pow(finalColor[2], 2.2);
    }
  }
  setColor() {
    if (arguments.length === 1) {
      this._color.set(arguments[0].r, arguments[0].g, arguments[0].b);
    } else if (arguments.length === 3) {
      this._color.set(arguments[0], arguments[1], arguments[2]);
    }
    this._updateFinalColor();
  }
  layersDirty() {
    this.layers.forEach(layer => {
      layer.markLightsDirty();
    });
  }

  /**
   * Updates a integer key for the light. The key is used to identify all shader related features
   * of the light, and so needs to have all properties that modify the generated shader encoded.
   * Properties without an effect on the shader (color, shadow intensity) should not be encoded.
   */
  updateKey() {
    // Key definition:
    // Bit
    // 31      : sign bit (leave)
    // 29 - 30 : type
    // 28      : cast shadows
    // 25 - 27 : shadow type
    // 23 - 24 : falloff mode
    // 22      : normal offset bias
    // 21      : cookie
    // 20      : cookie falloff
    // 18 - 19 : cookie channel R
    // 16 - 17 : cookie channel G
    // 14 - 15 : cookie channel B
    // 12      : cookie transform
    // 10 - 11 : light source shape
    //  8 -  9 : light num cascades
    //  7      : disable specular
    //  6 -  4 : mask
    let key = this._type << 29 | (this._castShadows ? 1 : 0) << 28 | this._shadowType << 25 | this._falloffMode << 23 | (this._normalOffsetBias !== 0.0 ? 1 : 0) << 22 | (this._cookie ? 1 : 0) << 21 | (this._cookieFalloff ? 1 : 0) << 20 | chanId[this._cookieChannel.charAt(0)] << 18 | (this._cookieTransform ? 1 : 0) << 12 | this._shape << 10 | this.numCascades - 1 << 8 | (this.affectSpecularity ? 1 : 0) << 7 | this.mask << 6;
    if (this._cookieChannel.length === 3) {
      key |= chanId[this._cookieChannel.charAt(1)] << 16;
      key |= chanId[this._cookieChannel.charAt(2)] << 14;
    }
    if (key !== this.key) {
      // The layer maintains lights split and sorted by the key, notify it when the key changes
      this.layersDirty();
    }
    this.key = key;
  }
}

export { Light, lightTypes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfRFlOQU1JQyxcbiAgICBTSEFET1dfUENGMSwgU0hBRE9XX1BDRjMsIFNIQURPV19QQ0Y1LCBTSEFET1dfVlNNOCwgU0hBRE9XX1ZTTTE2LCBTSEFET1dfVlNNMzIsIFNIQURPV19QQ1NTLFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfUkVBTFRJTUUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRGQUxMT0ZGX0xJTkVBUlxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmNvbnN0IHRtcFZlYyA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBCaWFzZXMgPSB7XG4gICAgYmlhczogMCxcbiAgICBub3JtYWxCaWFzOiAwXG59O1xuXG5jb25zdCBjaGFuSWQgPSB7IHI6IDAsIGc6IDEsIGI6IDIsIGE6IDMgfTtcblxuY29uc3QgbGlnaHRUeXBlcyA9IHtcbiAgICAnZGlyZWN0aW9uYWwnOiBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgJ29tbmknOiBMSUdIVFRZUEVfT01OSSxcbiAgICAncG9pbnQnOiBMSUdIVFRZUEVfT01OSSxcbiAgICAnc3BvdCc6IExJR0hUVFlQRV9TUE9UXG59O1xuXG4vLyB2aWV3cG9ydCBpbiBzaGFkb3dzIG1hcCBmb3IgY2FzY2FkZXMgZm9yIGRpcmVjdGlvbmFsIGxpZ2h0XG5jb25zdCBkaXJlY3Rpb25hbENhc2NhZGVzID0gW1xuICAgIFtuZXcgVmVjNCgwLCAwLCAxLCAxKV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSldLFxuICAgIFtuZXcgVmVjNCgwLCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAsIDAuNSwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAsIDAuNSwgMC41KV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAuNSwgMC41LCAwLjUpXVxuXTtcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBDbGFzcyBzdG9yaW5nIHNoYWRvdyByZW5kZXJpbmcgcmVsYXRlZCBwcml2YXRlIGluZm9ybWF0aW9uXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBMaWdodFJlbmRlckRhdGEge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgY2FtZXJhLCBmYWNlLCBsaWdodCkge1xuXG4gICAgICAgIC8vIGxpZ2h0IHRoaXMgZGF0YSBiZWxvbmdzIHRvXG4gICAgICAgIHRoaXMubGlnaHQgPSBsaWdodDtcblxuICAgICAgICAvLyBjYW1lcmEgdGhpcyBhcHBsaWVzIHRvLiBPbmx5IHVzZWQgYnkgZGlyZWN0aW9uYWwgbGlnaHQsIGFzIGRpcmVjdGlvbmFsIHNoYWRvdyBtYXBcbiAgICAgICAgLy8gaXMgY3VsbGVkIGFuZCByZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmEuIExvY2FsIGxpZ2h0cycgc2hhZG93IGlzIGN1bGxlZCBhbmQgcmVuZGVyZWQgb25lIHRpbWVcbiAgICAgICAgLy8gYW5kIHNoYXJlZCBiZXR3ZWVuIGNhbWVyYXMgKGV2ZW4gdGhvdWdoIGl0J3Mgbm90IHN0cmljdGx5IGNvcnJlY3QgYW5kIHdlIGNhbiBnZXQgc2hhZG93c1xuICAgICAgICAvLyBmcm9tIGEgbWVzaCB0aGF0IGlzIG5vdCB2aXNpYmxlIGJ5IHRoZSBjYW1lcmEpXG4gICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSB1c2VkIHRvIGN1bGwgLyByZW5kZXIgdGhlIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5zaGFkb3dDYW1lcmEgPSBTaGFkb3dSZW5kZXJlci5jcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBsaWdodC5fc2hhZG93VHlwZSwgbGlnaHQuX3R5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvdyB2aWV3LXByb2plY3Rpb24gbWF0cml4XG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4ID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93Vmlld3BvcnQgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcblxuICAgICAgICAvLyBzY2lzc29yIHJlY3RhbmdsZSBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93U2Npc3NvciA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuXG4gICAgICAgIC8vIGRlcHRoIHJhbmdlIGNvbXBlbnNhdGlvbiBmb3IgUENTUyB3aXRoIGRpcmVjdGlvbmFsIGxpZ2h0c1xuICAgICAgICB0aGlzLmRlcHRoUmFuZ2VDb21wZW5zYXRpb24gPSAwO1xuICAgICAgICB0aGlzLnByb2plY3Rpb25Db21wZW5zYXRpb24gPSAwO1xuXG4gICAgICAgIC8vIGZhY2UgaW5kZXgsIHZhbHVlIGlzIGJhc2VkIG9uIGxpZ2h0IHR5cGU6XG4gICAgICAgIC8vIC0gc3BvdDogYWx3YXlzIDBcbiAgICAgICAgLy8gLSBvbW5pOiBjdWJlbWFwIGZhY2UsIDAuLjVcbiAgICAgICAgLy8gLSBkaXJlY3Rpb25hbDogMCBmb3Igc2ltcGxlIHNoYWRvd3MsIGNhc2NhZGUgaW5kZXggZm9yIGNhc2NhZGVkIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5mYWNlID0gZmFjZTtcblxuICAgICAgICAvLyB2aXNpYmxlIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIHRoaXMudmlzaWJsZUNhc3RlcnMgPSBbXTtcblxuICAgICAgICAvLyBhbiBhcnJheSBvZiB2aWV3IGJpbmQgZ3JvdXBzLCBzaW5nbGUgZW50cnkgaXMgdXNlZCBmb3Igc2hhZG93c1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcycpLkJpbmRHcm91cFtdfSAqL1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBzID0gW107XG4gICAgfVxuXG4gICAgLy8gcmVsZWFzZXMgR1BVIHJlc291cmNlc1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cHMuZm9yRWFjaCgoYmcpID0+IHtcbiAgICAgICAgICAgIGJnLmRlZmF1bHRVbmlmb3JtQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIGJnLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIHNoYWRvdyBidWZmZXIgY3VycmVudGx5IGF0dGFjaGVkIHRvIHRoZSBzaGFkb3cgY2FtZXJhXG4gICAgZ2V0IHNoYWRvd0J1ZmZlcigpIHtcbiAgICAgICAgY29uc3QgcnQgPSB0aGlzLnNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmIChydCkge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSB0aGlzLmxpZ2h0O1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBydC5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGxpZ2h0Ll9pc1BjZiAmJiBsaWdodC5kZXZpY2Uuc3VwcG9ydHNEZXB0aFNoYWRvdyA/IHJ0LmRlcHRoQnVmZmVyIDogcnQuY29sb3JCdWZmZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogQSBsaWdodC5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIExpZ2h0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgTGF5ZXJzIHRoZSBsaWdodCBpcyBvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL2xheWVyLmpzJykuTGF5ZXI+fVxuICAgICAqL1xuICAgIGxheWVycyA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgY2x1c3RlcmVkTGlnaHRpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGVwdGggc3RhdGUgdXNlZCB3aGVuIHJlbmRlcmluZyB0aGUgc2hhZG93IG1hcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtEZXB0aFN0YXRlfVxuICAgICAqL1xuICAgIHNoYWRvd0RlcHRoU3RhdGUgPSBEZXB0aFN0YXRlLkRFRkFVTFQuY2xvbmUoKTtcblxuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBjbHVzdGVyZWRMaWdodGluZykge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmNsdXN0ZXJlZExpZ2h0aW5nID0gY2x1c3RlcmVkTGlnaHRpbmc7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuXG4gICAgICAgIC8vIExpZ2h0IHByb3BlcnRpZXMgKGRlZmF1bHRzKVxuICAgICAgICB0aGlzLl90eXBlID0gTElHSFRUWVBFX0RJUkVDVElPTkFMO1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigwLjgsIDAuOCwgMC44KTtcbiAgICAgICAgdGhpcy5faW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fYWZmZWN0U3BlY3VsYXJpdHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9sdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX21hc2sgPSBNQVNLX0FGRkVDVF9EWU5BTUlDO1xuICAgICAgICB0aGlzLmlzU3RhdGljID0gZmFsc2U7XG4gICAgICAgIHRoaXMua2V5ID0gMDtcbiAgICAgICAgdGhpcy5iYWtlRGlyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5iYWtlTnVtU2FtcGxlcyA9IDE7XG4gICAgICAgIHRoaXMuYmFrZUFyZWEgPSAwO1xuXG4gICAgICAgIC8vIE9tbmkgYW5kIHNwb3QgcHJvcGVydGllc1xuICAgICAgICB0aGlzLmF0dGVudWF0aW9uU3RhcnQgPSAxMDtcbiAgICAgICAgdGhpcy5hdHRlbnVhdGlvbkVuZCA9IDEwO1xuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IExJR0hURkFMTE9GRl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBTSEFET1dfUENGMztcbiAgICAgICAgdGhpcy5fdnNtQmx1clNpemUgPSAxMTtcbiAgICAgICAgdGhpcy52c21CbHVyTW9kZSA9IEJMVVJfR0FVU1NJQU47XG4gICAgICAgIHRoaXMudnNtQmlhcyA9IDAuMDEgKiAwLjI1O1xuICAgICAgICB0aGlzLl9jb29raWUgPSBudWxsOyAvLyBsaWdodCBjb29raWUgdGV4dHVyZSAoMkQgZm9yIHNwb3QsIGN1YmVtYXAgZm9yIG9tbmkpXG4gICAgICAgIHRoaXMuY29va2llSW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUNoYW5uZWwgPSAncmdiJztcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gbnVsbDsgLy8gMmQgcm90YXRpb24vc2NhbGUgbWF0cml4IChzcG90IG9ubHkpXG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSBudWxsOyAvLyAyZCBwb3NpdGlvbiBvZmZzZXQgKHNwb3Qgb25seSlcbiAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSBmYWxzZTtcblxuICAgICAgICAvLyBTcG90IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5faW5uZXJDb25lQW5nbGUgPSA0MDtcbiAgICAgICAgdGhpcy5fb3V0ZXJDb25lQW5nbGUgPSA0NTtcblxuICAgICAgICAvLyBEaXJlY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuY2FzY2FkZXMgPSBudWxsOyAgICAgICAgICAgICAgIC8vIGFuIGFycmF5IG9mIFZlYzQgdmlld3BvcnRzIHBlciBjYXNjYWRlXG4gICAgICAgIHRoaXMuX3NoYWRvd01hdHJpeFBhbGV0dGUgPSBudWxsOyAgIC8vIGEgZmxvYXQgYXJyYXksIDE2IGZsb2F0cyBwZXIgY2FzY2FkZVxuICAgICAgICB0aGlzLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzID0gbnVsbDtcbiAgICAgICAgdGhpcy5udW1DYXNjYWRlcyA9IDE7XG4gICAgICAgIHRoaXMuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IDAuNTtcblxuICAgICAgICAvLyBMaWdodCBzb3VyY2Ugc2hhcGUgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9zaGFwZSA9IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG5cbiAgICAgICAgLy8gQ2FjaGUgb2YgbGlnaHQgcHJvcGVydHkgZGF0YSBpbiBhIGZvcm1hdCBtb3JlIGZyaWVuZGx5IGZvciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5fZmluYWxDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuOCwgMC44LCAwLjhdKTtcbiAgICAgICAgY29uc3QgYyA9IE1hdGgucG93KHRoaXMuX2ZpbmFsQ29sb3JbMF0sIDIuMik7XG4gICAgICAgIHRoaXMuX2xpbmVhckZpbmFsQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KFtjLCBjLCBjXSk7XG5cbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBuZXcgVmVjMygwLCAwLCAwKTtcbiAgICAgICAgdGhpcy5fZGlyZWN0aW9uID0gbmV3IFZlYzMoMCwgMCwgMCk7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModGhpcy5faW5uZXJDb25lQW5nbGUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3V0ZXJBbmdsZSh0aGlzLl9vdXRlckNvbmVBbmdsZSk7XG5cbiAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBTaGFkb3cgbWFwcGluZyByZXNvdXJjZXNcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyUGFyYW1zID0gW107XG4gICAgICAgIHRoaXMuX3NoYWRvd0NhbWVyYVBhcmFtcyA9IFtdO1xuXG4gICAgICAgIC8vIFNoYWRvdyBtYXBwaW5nIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5zaGFkb3dEaXN0YW5jZSA9IDQwO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gMTAyNDtcbiAgICAgICAgdGhpcy5fc2hhZG93QmlhcyA9IC0wLjAwMDU7XG4gICAgICAgIHRoaXMuc2hhZG93SW50ZW5zaXR5ID0gMS4wO1xuICAgICAgICB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzID0gMC4wO1xuICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfUkVBTFRJTUU7XG4gICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcGVudW1icmFTaXplID0gMS4wO1xuICAgICAgICB0aGlzLl9pc1ZzbSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1BjZiA9IHRydWU7XG5cbiAgICAgICAgLy8gY29va2llIG1hdHJpeCAodXNlZCBpbiBjYXNlIHRoZSBzaGFkb3cgbWFwcGluZyBpcyBkaXNhYmxlZCBhbmQgc28gdGhlIHNoYWRvdyBtYXRyaXggY2Fubm90IGJlIHVzZWQpXG4gICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG51bGw7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgb2YgdGhlIGNvb2tpZSB0ZXh0dXJlIC8gc2hhZG93IGluIHRoZSBhdGxhc1xuICAgICAgICB0aGlzLl9hdGxhc1ZpZXdwb3J0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkID0gZmFsc2U7ICAgIC8vIGlmIHRydWUsIGF0bGFzIHNsb3QgaXMgYWxsb2NhdGVkIGZvciB0aGUgY3VycmVudCBmcmFtZVxuICAgICAgICB0aGlzLmF0bGFzVmVyc2lvbiA9IDA7ICAgICAgLy8gdmVyc2lvbiBvZiB0aGUgYXRsYXMgZm9yIHRoZSBhbGxvY2F0ZWQgc2xvdCwgYWxsb3dzIGludmFsaWRhdGlvbiB3aGVuIGF0bGFzIHJlY3JlYXRlcyBzbG90c1xuICAgICAgICB0aGlzLmF0bGFzU2xvdEluZGV4ID0gMDsgICAgLy8gYWxsb2NhdGVkIHNsb3QgaW5kZXgsIHVzZWQgZm9yIG1vcmUgcGVyc2lzdGVudCBzbG90IGFsbG9jYXRpb25cbiAgICAgICAgdGhpcy5hdGxhc1Nsb3RVcGRhdGVkID0gZmFsc2U7ICAvLyB0cnVlIGlmIHRoZSBhdGxhcyBzbG90IHdhcyByZWFzc2lnbmVkIHRoaXMgZnJhbWUgKGFuZCBjb250ZW50IG5lZWRzIHRvIGJlIHVwZGF0ZWQpXG5cbiAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG5cbiAgICAgICAgLy8gcHJpdmF0ZSByZW5kZXJpbmcgZGF0YVxuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gW107XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGUgbGlnaHQgaXMgdmlzaWJsZSBieSBhbnkgY2FtZXJhIHdpdGhpbiBhIGZyYW1lXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIG1heGltdW0gc2l6ZSBvZiB0aGUgbGlnaHQgYm91bmRpbmcgc3BoZXJlIG9uIHRoZSBzY3JlZW4gYnkgYW55IGNhbWVyYSB3aXRoaW4gYSBmcmFtZVxuICAgICAgICAvLyAodXNlZCB0byBlc3RpbWF0ZSBzaGFkb3cgcmVzb2x1dGlvbiksIHJhbmdlIFswLi4xXVxuICAgICAgICB0aGlzLm1heFNjcmVlblNpemUgPSAwO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNoYWRvd0JpYXMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG5cbiAgICAgICAgdGhpcy5yZWxlYXNlUmVuZGVyRGF0YSgpO1xuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICByZWxlYXNlUmVuZGVyRGF0YSgpIHtcblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyRGF0YSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyRGF0YVtpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZExheWVyKGxheWVyKSB7XG4gICAgICAgIHRoaXMubGF5ZXJzLmFkZChsYXllcik7XG4gICAgfVxuXG4gICAgcmVtb3ZlTGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5sYXllcnMuZGVsZXRlKGxheWVyKTtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93Qmlhcyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93QmlhcyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0JpYXMgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNoYWRvd0JpYXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaGFkb3dCaWFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93QmlhcztcbiAgICB9XG5cbiAgICBzZXQgbnVtQ2FzY2FkZXModmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhc2NhZGVzIHx8IHRoaXMubnVtQ2FzY2FkZXMgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLmNhc2NhZGVzID0gZGlyZWN0aW9uYWxDYXNjYWRlc1t2YWx1ZSAtIDFdO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93TWF0cml4UGFsZXR0ZSA9IG5ldyBGbG9hdDMyQXJyYXkoNCAqIDE2KTsgICAvLyBhbHdheXMgNFxuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7ICAgICAvLyBhbHdheXMgNFxuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBudW1DYXNjYWRlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FzY2FkZXMubGVuZ3RoO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dNYXAoc2hhZG93TWFwKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXAgIT09IHNoYWRvd01hcCkge1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gc2hhZG93TWFwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd01hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd01hcDtcbiAgICB9XG5cbiAgICBzZXQgbWFzayh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2sgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBudW1iZXIgb2YgcmVuZGVyIHRhcmdldHMgdG8gcmVuZGVyIHRoZSBzaGFkb3cgbWFwXG4gICAgZ2V0IG51bVNoYWRvd0ZhY2VzKCkge1xuICAgICAgICBjb25zdCB0eXBlID0gdGhpcy5fdHlwZTtcbiAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubnVtQ2FzY2FkZXM7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIHJldHVybiA2O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLl91cGRhdGVTaGFkb3dCaWFzKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgY29uc3Qgc3R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMgPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1R5cGUgPSBzdHlwZTsgLy8gcmVmcmVzaCBzaGFkb3cgdHlwZTsgc3dpdGNoaW5nIGZyb20gZGlyZWN0L3Nwb3QgdG8gb21uaSBhbmQgYmFjayBtYXkgY2hhbmdlIGl0XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIHNldCBzaGFwZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc2hhcGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3NoYXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICBjb25zdCBzdHlwZSA9IHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1R5cGUgPSBzdHlwZTsgLy8gcmVmcmVzaCBzaGFkb3cgdHlwZTsgc3dpdGNoaW5nIHNoYXBlIGFuZCBiYWNrIG1heSBjaGFuZ2UgaXRcbiAgICB9XG5cbiAgICBnZXQgc2hhcGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFwZTtcbiAgICB9XG5cbiAgICBzZXQgdXNlUGh5c2ljYWxVbml0cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB1c2VQaHlzaWNhbFVuaXRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXNlUGh5c2ljYWxVbml0cztcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93VHlwZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93VHlwZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIHZhbHVlICE9PSBTSEFET1dfUENGMyAmJiB2YWx1ZSAhPT0gU0hBRE9XX1BDU1MpXG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19QQ0YzOyAvLyBWU00gb3IgSFcgUENGIGZvciBvbW5pIGxpZ2h0cyBpcyBub3Qgc3VwcG9ydGVkIHlldFxuXG4gICAgICAgIGNvbnN0IHN1cHBvcnRzRGVwdGhTaGFkb3cgPSBkZXZpY2Uuc3VwcG9ydHNEZXB0aFNoYWRvdztcbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfUENGNSAmJiAhc3VwcG9ydHNEZXB0aFNoYWRvdykge1xuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfUENGMzsgLy8gZmFsbGJhY2sgZnJvbSBIVyBQQ0YgdG8gb2xkIFBDRlxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmFsbGJhY2sgZnJvbSB2c20zMiB0byB2c20xNlxuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19WU00zMiAmJiAoIWRldmljZS50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIHx8ICFkZXZpY2UudGV4dHVyZUZsb2F0RmlsdGVyYWJsZSkpXG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19WU00xNjtcblxuICAgICAgICAvLyBmYWxsYmFjayBmcm9tIHZzbTE2IHRvIHZzbThcbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfVlNNMTYgJiYgIWRldmljZS50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSlcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1ZTTTg7XG5cbiAgICAgICAgdGhpcy5faXNWc20gPSB2YWx1ZSA+PSBTSEFET1dfVlNNOCAmJiB2YWx1ZSA8PSBTSEFET1dfVlNNMzI7XG4gICAgICAgIHRoaXMuX2lzUGNmID0gdmFsdWUgPT09IFNIQURPV19QQ0YxIHx8IHZhbHVlID09PSBTSEFET1dfUENGMyB8fCB2YWx1ZSA9PT0gU0hBRE9XX1BDRjU7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1R5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dUeXBlO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIHNldCBjYXN0U2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzICYmIHRoaXMuX21hc2sgIT09IE1BU0tfQkFLRSAmJiB0aGlzLl9tYXNrICE9PSAwO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dSZXNvbHV0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dSZXNvbHV0aW9uICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4Q3ViZU1hcFNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKHZhbHVlLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93UmVzb2x1dGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgfVxuXG4gICAgc2V0IHZzbUJsdXJTaXplKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl92c21CbHVyU2l6ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlICUgMiA9PT0gMCkgdmFsdWUrKzsgLy8gZG9uJ3QgYWxsb3cgZXZlbiBzaXplXG4gICAgICAgIHRoaXMuX3ZzbUJsdXJTaXplID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHZzbUJsdXJTaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdnNtQmx1clNpemU7XG4gICAgfVxuXG4gICAgc2V0IG5vcm1hbE9mZnNldEJpYXModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICgoIXRoaXMuX25vcm1hbE9mZnNldEJpYXMgJiYgdmFsdWUpIHx8ICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmICF2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxPZmZzZXRCaWFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICB9XG5cbiAgICBzZXQgZmFsbG9mZk1vZGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZhbGxvZmZNb2RlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBmYWxsb2ZmTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgIH1cblxuICAgIHNldCBpbm5lckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faW5uZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModmFsdWUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbm5lckNvbmVBbmdsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgIH1cblxuICAgIHNldCBvdXRlckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3V0ZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU91dGVyQW5nbGUodmFsdWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3V0ZXJDb25lQW5nbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICB9XG5cbiAgICBzZXQgcGVudW1icmFTaXplKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BlbnVtYnJhU2l6ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwZW51bWJyYVNpemUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wZW51bWJyYVNpemU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU91dGVyQW5nbGUoYW5nbGUpIHtcbiAgICAgICAgY29uc3QgcmFkQW5nbGUgPSBhbmdsZSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3MocmFkQW5nbGUpO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbiA9IE1hdGguc2luKHJhZEFuZ2xlKTtcbiAgICB9XG5cbiAgICBzZXQgaW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnRlbnNpdHkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbnRlbnNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnRlbnNpdHk7XG4gICAgfVxuXG4gICAgc2V0IGFmZmVjdFNwZWN1bGFyaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FmZmVjdFNwZWN1bGFyaXR5ID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFmZmVjdFNwZWN1bGFyaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWZmZWN0U3BlY3VsYXJpdHk7XG4gICAgfVxuXG4gICAgc2V0IGx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbHVtaW5hbmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbHVtaW5hbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbHVtaW5hbmNlO1xuICAgIH1cblxuICAgIGdldCBjb29raWVNYXRyaXgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgfVxuXG4gICAgZ2V0IGF0bGFzVmlld3BvcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hdGxhc1ZpZXdwb3J0O1xuICAgIH1cblxuICAgIHNldCBjb29raWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llRmFsbG9mZih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llRmFsbG9mZiA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVGYWxsb2ZmKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llRmFsbG9mZjtcbiAgICB9XG5cbiAgICBzZXQgY29va2llQ2hhbm5lbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IDMgLSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKVxuICAgICAgICAgICAgICAgIHZhbHVlICs9IGNocjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVDaGFubmVsID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUNoYW5uZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgIH1cblxuICAgIHNldCBjb29raWVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llT2Zmc2V0KSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZU9mZnNldCA9IG5ldyBWZWMyKCk7IC8vIHVzaW5nIHRyYW5zZm9ybSBmb3JjZXMgdXNpbmcgb2Zmc2V0IGNvZGVcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llT2Zmc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVPZmZzZXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHhmb3JtTmV3ID0gISEodGhpcy5fY29va2llVHJhbnNmb3JtU2V0IHx8IHZhbHVlKTtcbiAgICAgICAgaWYgKHhmb3JtTmV3ICYmICF2YWx1ZSAmJiB0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldC5zZXQoMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgJiYgIXRoaXMuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVUcmFuc2Zvcm0gPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTsgLy8gdXNpbmcgb2Zmc2V0IGZvcmNlcyB1c2luZyBtYXRyaXggY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llT2Zmc2V0O1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGxpZ2h0IGZvciB0aGUgZnJhbWUgcmVuZGVyaW5nXG4gICAgYmVnaW5GcmFtZSgpIHtcbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gdGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIHRoaXMuX2VuYWJsZWQ7XG4gICAgICAgIHRoaXMubWF4U2NyZWVuU2l6ZSA9IDA7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBkZXN0cm95cyBzaGFkb3cgbWFwIHJlbGF0ZWQgcmVzb3VyY2VzLCBjYWxsZWQgd2hlbiBzaGFkb3cgcHJvcGVydGllcyBjaGFuZ2UgYW5kIHJlc291cmNlc1xuICAgIC8vIG5lZWQgdG8gYmUgcmVjcmVhdGVkXG4gICAgX2Rlc3Ryb3lTaGFkb3dNYXAoKSB7XG5cbiAgICAgICAgdGhpcy5yZWxlYXNlUmVuZGVyRGF0YSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXApIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2hhZG93TWFwLmNhY2hlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXNbaV0gPT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzW2ldID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIExpZ2h0UmVuZGVyRGF0YSB3aXRoIG1hdGNoaW5nIGNhbWVyYSBhbmQgZmFjZVxuICAgIGdldFJlbmRlckRhdGEoY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgLy8gcmV0dXJucyBleGlzdGluZ1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZW5kZXJEYXRhW2ldO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQuY2FtZXJhID09PSBjYW1lcmEgJiYgY3VycmVudC5mYWNlID09PSBmYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbmV3IG9uZVxuICAgICAgICBjb25zdCByZCA9IG5ldyBMaWdodFJlbmRlckRhdGEodGhpcy5kZXZpY2UsIGNhbWVyYSwgZmFjZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEucHVzaChyZCk7XG4gICAgICAgIHJldHVybiByZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEdXBsaWNhdGVzIGEgbGlnaHQgbm9kZSBidXQgZG9lcyBub3QgJ2RlZXAgY29weScgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtMaWdodH0gQSBjbG9uZWQgTGlnaHQuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IExpZ2h0KHRoaXMuZGV2aWNlLCB0aGlzLmNsdXN0ZXJlZExpZ2h0aW5nKTtcblxuICAgICAgICAvLyBDbG9uZSBMaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnR5cGUgPSB0aGlzLl90eXBlO1xuICAgICAgICBjbG9uZS5zZXRDb2xvcih0aGlzLl9jb2xvcik7XG4gICAgICAgIGNsb25lLmludGVuc2l0eSA9IHRoaXMuX2ludGVuc2l0eTtcbiAgICAgICAgY2xvbmUuYWZmZWN0U3BlY3VsYXJpdHkgPSB0aGlzLl9hZmZlY3RTcGVjdWxhcml0eTtcbiAgICAgICAgY2xvbmUubHVtaW5hbmNlID0gdGhpcy5fbHVtaW5hbmNlO1xuICAgICAgICBjbG9uZS5jYXN0U2hhZG93cyA9IHRoaXMuY2FzdFNoYWRvd3M7XG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICAvLyBPbW5pIGFuZCBzcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25TdGFydCA9IHRoaXMuYXR0ZW51YXRpb25TdGFydDtcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25FbmQgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICBjbG9uZS5mYWxsb2ZmTW9kZSA9IHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgICAgICBjbG9uZS5zaGFkb3dUeXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgY2xvbmUudnNtQmx1clNpemUgPSB0aGlzLl92c21CbHVyU2l6ZTtcbiAgICAgICAgY2xvbmUudnNtQmx1ck1vZGUgPSB0aGlzLnZzbUJsdXJNb2RlO1xuICAgICAgICBjbG9uZS52c21CaWFzID0gdGhpcy52c21CaWFzO1xuICAgICAgICBjbG9uZS5wZW51bWJyYVNpemUgPSB0aGlzLnBlbnVtYnJhU2l6ZTtcbiAgICAgICAgY2xvbmUuc2hhZG93VXBkYXRlTW9kZSA9IHRoaXMuc2hhZG93VXBkYXRlTW9kZTtcbiAgICAgICAgY2xvbmUubWFzayA9IHRoaXMubWFzaztcblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGNsb25lLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcyA9IHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzLnNsaWNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuaW5uZXJDb25lQW5nbGUgPSB0aGlzLl9pbm5lckNvbmVBbmdsZTtcbiAgICAgICAgY2xvbmUub3V0ZXJDb25lQW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcblxuICAgICAgICAvLyBEaXJlY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLm51bUNhc2NhZGVzID0gdGhpcy5udW1DYXNjYWRlcztcbiAgICAgICAgY2xvbmUuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IHRoaXMuY2FzY2FkZURpc3RyaWJ1dGlvbjtcblxuICAgICAgICAvLyBzaGFwZSBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnNoYXBlID0gdGhpcy5fc2hhcGU7XG5cbiAgICAgICAgLy8gU2hhZG93IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuc2hhZG93RGVwdGhTdGF0ZS5jb3B5KHRoaXMuc2hhZG93RGVwdGhTdGF0ZSk7XG4gICAgICAgIGNsb25lLnNoYWRvd0JpYXMgPSB0aGlzLnNoYWRvd0JpYXM7XG4gICAgICAgIGNsb25lLm5vcm1hbE9mZnNldEJpYXMgPSB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICBjbG9uZS5zaGFkb3dSZXNvbHV0aW9uID0gdGhpcy5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgY2xvbmUuc2hhZG93RGlzdGFuY2UgPSB0aGlzLnNoYWRvd0Rpc3RhbmNlO1xuICAgICAgICBjbG9uZS5zaGFkb3dJbnRlbnNpdHkgPSB0aGlzLnNoYWRvd0ludGVuc2l0eTtcblxuICAgICAgICAvLyBDb29raWVzIHByb3BlcnRpZXNcbiAgICAgICAgLy8gY2xvbmUuY29va2llID0gdGhpcy5fY29va2llO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVJbnRlbnNpdHkgPSB0aGlzLmNvb2tpZUludGVuc2l0eTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llRmFsbG9mZiA9IHRoaXMuX2Nvb2tpZUZhbGxvZmY7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUNoYW5uZWwgPSB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVUcmFuc2Zvcm0gPSB0aGlzLl9jb29raWVUcmFuc2Zvcm07XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZU9mZnNldCA9IHRoaXMuX2Nvb2tpZU9mZnNldDtcblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvbnZlcnNpb24gZmFjdG9yIGZvciBsdW1pbmFuY2UgLT4gbGlnaHQgc3BlY2lmaWMgbGlnaHQgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0eXBlIC0gVGhlIHR5cGUgb2YgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvdXRlckFuZ2xlXSAtIFRoZSBvdXRlciBhbmdsZSBvZiBhIHNwb3QgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbm5lckFuZ2xlXSAtIFRoZSBpbm5lciBhbmdsZSBvZiBhIHNwb3QgbGlnaHQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHNjYWxpbmcgZmFjdG9yIHRvIG11bHRpcGx5IHdpdGggdGhlIGx1bWluYW5jZSB2YWx1ZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0TGlnaHRVbml0Q29udmVyc2lvbih0eXBlLCBvdXRlckFuZ2xlID0gTWF0aC5QSSAvIDQsIGlubmVyQW5nbGUgPSAwKSB7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfU1BPVDoge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhbGxvZmZFbmQgPSBNYXRoLmNvcyhvdXRlckFuZ2xlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmU3RhcnQgPSBNYXRoLmNvcyhpbm5lckFuZ2xlKTtcblxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tbXAvcGJydC12NC9ibG9iL2ZhYWMzNGQxYTBlYmQyNDkyODgyOGZlOWZhNjViNjVmN2VmYzU5Mzcvc3JjL3BicnQvbGlnaHRzLmNwcCNMMTQ2M1xuICAgICAgICAgICAgICAgIHJldHVybiAoMiAqIE1hdGguUEkgKiAoKDEgLSBmYWxsb2ZmU3RhcnQpICsgKGZhbGxvZmZTdGFydCAtIGZhbGxvZmZFbmQpIC8gMi4wKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9maWxhbWVudC9GaWxhbWVudC5tZC5odG1sI2xpZ2h0aW5nL2RpcmVjdGxpZ2h0aW5nL3B1bmN0dWFsbGlnaHRzL3BvaW50bGlnaHRzXG4gICAgICAgICAgICAgICAgcmV0dXJuICg0ICogTWF0aC5QSSk7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9ESVJFQ1RJT05BTDpcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dvb2dsZS5naXRodWIuaW8vZmlsYW1lbnQvRmlsYW1lbnQubWQuaHRtbCNsaWdodGluZy9kaXJlY3RsaWdodGluZy9kaXJlY3Rpb25hbGxpZ2h0c1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyB0aGUgYmlhcyAoLngpIGFuZCBub3JtYWxCaWFzICgueSkgdmFsdWUgZm9yIGxpZ2h0cyBhcyBwYXNzZWQgdG8gc2hhZGVycyBieSB1bmlmb3Jtc1xuICAgIC8vIE5vdGU6IHRoaXMgbmVlZHMgdG8gYmUgcmV2aXNpdGVkIGFuZCBzaW1wbGlmaWVkXG4gICAgLy8gTm90ZTogdnNtQmlhcyBpcyBub3QgdXNlZCBhdCBhbGwgZm9yIG9tbmkgbGlnaHQsIGV2ZW4gdGhvdWdoIGl0IGlzIGVkaXRhYmxlIGluIHRoZSBFZGl0b3JcbiAgICBfZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKSB7XG5cbiAgICAgICAgY29uc3QgZmFyQ2xpcCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gdGhpcy5zaGFkb3dCaWFzO1xuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX1NQT1Q6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IHRoaXMuc2hhZG93QmlhcyAqIDIwOyAvLyBhcHByb3ggcmVtYXAgZnJvbSBvbGQgYmlhcyB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR0wxICYmIHRoaXMuZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHRtcEJpYXNlcy5iaWFzICo9IC0xMDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5faXNWc20gPyB0aGlzLnZzbUJpYXMgLyAodGhpcy5hdHRlbnVhdGlvbkVuZCAvIDcuMCkgOiB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgLy8gbWFrZSBiaWFzIGRlcGVuZGVudCBvbiBmYXIgcGxhbmUgYmVjYXVzZSBpdCdzIG5vdCBjb25zdGFudCBmb3IgZGlyZWN0IGxpZ2h0XG4gICAgICAgICAgICAgICAgLy8gY2xpcCBkaXN0YW5jZSB1c2VkIGlzIGJhc2VkIG9uIHRoZSBuZWFyZXN0IHNoYWRvdyBjYXNjYWRlXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9ICh0aGlzLnNoYWRvd0JpYXMgLyBmYXJDbGlwKSAqIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR0wxICYmIHRoaXMuZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHRtcEJpYXNlcy5iaWFzICo9IC0xMDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5faXNWc20gPyB0aGlzLnZzbUJpYXMgLyAoZmFyQ2xpcCAvIDcuMCkgOiB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRtcEJpYXNlcztcbiAgICB9XG5cbiAgICBnZXRDb2xvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cblxuICAgIGdldEJvdW5kaW5nU3BoZXJlKHNwaGVyZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcblxuICAgICAgICAgICAgLy8gYmFzZWQgb24gaHR0cHM6Ly9iYXJ0d3JvbnNraS5jb20vMjAxNy8wNC8xMy9jdWxsLXRoYXQtY29uZS9cbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgY29uc3QgYW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICAgICAgICAgIGNvbnN0IGNvc0FuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGVDb3M7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gdGhpcy5fbm9kZTtcbiAgICAgICAgICAgIHRtcFZlYy5jb3B5KG5vZGUudXApO1xuXG4gICAgICAgICAgICBpZiAoYW5nbGUgPiA0NSkge1xuICAgICAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSBzaXplICogdGhpcy5fb3V0ZXJDb25lQW5nbGVTaW47XG4gICAgICAgICAgICAgICAgdG1wVmVjLm11bFNjYWxhcigtc2l6ZSAqIGNvc0FuZ2xlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHNpemUgLyAoMiAqIGNvc0FuZ2xlKTtcbiAgICAgICAgICAgICAgICB0bXBWZWMubXVsU2NhbGFyKC1zcGhlcmUucmFkaXVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3BoZXJlLmNlbnRlci5hZGQyKG5vZGUuZ2V0UG9zaXRpb24oKSwgdG1wVmVjKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICBzcGhlcmUuY2VudGVyID0gdGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRCb3VuZGluZ0JveChib3gpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuX25vZGU7XG5cbiAgICAgICAgICAgIGNvbnN0IHNjbCA9IE1hdGguYWJzKE1hdGguc2luKGFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKSAqIHJhbmdlKTtcblxuICAgICAgICAgICAgYm94LmNlbnRlci5zZXQoMCwgLXJhbmdlICogMC41LCAwKTtcbiAgICAgICAgICAgIGJveC5oYWxmRXh0ZW50cy5zZXQoc2NsLCByYW5nZSAqIDAuNSwgc2NsKTtcblxuICAgICAgICAgICAgYm94LnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYm94LCBub2RlLmdldFdvcmxkVHJhbnNmb3JtKCksIHRydWUpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIGJveC5jZW50ZXIuY29weSh0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgYm94LmhhbGZFeHRlbnRzLnNldCh0aGlzLmF0dGVudWF0aW9uRW5kLCB0aGlzLmF0dGVudWF0aW9uRW5kLCB0aGlzLmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVTaGFkb3dCaWFzKCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgaWYgKGRldmljZS5pc1dlYkdMMiB8fCBkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhdGhpcy5jbHVzdGVyZWRMaWdodGluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93RGVwdGhTdGF0ZS5kZXB0aEJpYXMgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93RGVwdGhTdGF0ZS5kZXB0aEJpYXNTbG9wZSA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpYXMgPSB0aGlzLnNoYWRvd0JpYXMgKiAtMTAwMC4wO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93RGVwdGhTdGF0ZS5kZXB0aEJpYXMgPSBiaWFzO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93RGVwdGhTdGF0ZS5kZXB0aEJpYXNTbG9wZSA9IGJpYXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlRmluYWxDb2xvcigpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLl9jb2xvcjtcbiAgICAgICAgY29uc3QgciA9IGNvbG9yLnI7XG4gICAgICAgIGNvbnN0IGcgPSBjb2xvci5nO1xuICAgICAgICBjb25zdCBiID0gY29sb3IuYjtcblxuICAgICAgICBsZXQgaSA9IHRoaXMuX2ludGVuc2l0eTtcblxuICAgICAgICAvLyBUbyBjYWxjdWxhdGUgdGhlIGx1eCwgd2hpY2ggaXMgbG0vbV4yLCB3ZSBuZWVkIHRvIGNvbnZlcnQgZnJvbSBsdW1pbm91cyBwb3dlclxuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgaSA9IHRoaXMuX2x1bWluYW5jZSAvIExpZ2h0LmdldExpZ2h0VW5pdENvbnZlcnNpb24odGhpcy5fdHlwZSwgdGhpcy5fb3V0ZXJDb25lQW5nbGUgKiBtYXRoLkRFR19UT19SQUQsIHRoaXMuX2lubmVyQ29uZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbmFsQ29sb3IgPSB0aGlzLl9maW5hbENvbG9yO1xuICAgICAgICBjb25zdCBsaW5lYXJGaW5hbENvbG9yID0gdGhpcy5fbGluZWFyRmluYWxDb2xvcjtcblxuICAgICAgICBmaW5hbENvbG9yWzBdID0gciAqIGk7XG4gICAgICAgIGZpbmFsQ29sb3JbMV0gPSBnICogaTtcbiAgICAgICAgZmluYWxDb2xvclsyXSA9IGIgKiBpO1xuICAgICAgICBpZiAoaSA+PSAxKSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3cociwgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzFdID0gTWF0aC5wb3coZywgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzJdID0gTWF0aC5wb3coYiwgMi4yKSAqIGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3coZmluYWxDb2xvclswXSwgMi4yKTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMV0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzFdLCAyLjIpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsyXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMl0sIDIuMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDb2xvcigpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLnNldChhcmd1bWVudHNbMF0uciwgYXJndW1lbnRzWzBdLmcsIGFyZ3VtZW50c1swXS5iKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5zZXQoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgfVxuXG4gICAgbGF5ZXJzRGlydHkoKSB7XG4gICAgICAgIHRoaXMubGF5ZXJzLmZvckVhY2goKGxheWVyKSA9PiB7XG4gICAgICAgICAgICBsYXllci5tYXJrTGlnaHRzRGlydHkoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyBhIGludGVnZXIga2V5IGZvciB0aGUgbGlnaHQuIFRoZSBrZXkgaXMgdXNlZCB0byBpZGVudGlmeSBhbGwgc2hhZGVyIHJlbGF0ZWQgZmVhdHVyZXNcbiAgICAgKiBvZiB0aGUgbGlnaHQsIGFuZCBzbyBuZWVkcyB0byBoYXZlIGFsbCBwcm9wZXJ0aWVzIHRoYXQgbW9kaWZ5IHRoZSBnZW5lcmF0ZWQgc2hhZGVyIGVuY29kZWQuXG4gICAgICogUHJvcGVydGllcyB3aXRob3V0IGFuIGVmZmVjdCBvbiB0aGUgc2hhZGVyIChjb2xvciwgc2hhZG93IGludGVuc2l0eSkgc2hvdWxkIG5vdCBiZSBlbmNvZGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgICAgIC8vIEJpdFxuICAgICAgICAvLyAzMSAgICAgIDogc2lnbiBiaXQgKGxlYXZlKVxuICAgICAgICAvLyAyOSAtIDMwIDogdHlwZVxuICAgICAgICAvLyAyOCAgICAgIDogY2FzdCBzaGFkb3dzXG4gICAgICAgIC8vIDI1IC0gMjcgOiBzaGFkb3cgdHlwZVxuICAgICAgICAvLyAyMyAtIDI0IDogZmFsbG9mZiBtb2RlXG4gICAgICAgIC8vIDIyICAgICAgOiBub3JtYWwgb2Zmc2V0IGJpYXNcbiAgICAgICAgLy8gMjEgICAgICA6IGNvb2tpZVxuICAgICAgICAvLyAyMCAgICAgIDogY29va2llIGZhbGxvZmZcbiAgICAgICAgLy8gMTggLSAxOSA6IGNvb2tpZSBjaGFubmVsIFJcbiAgICAgICAgLy8gMTYgLSAxNyA6IGNvb2tpZSBjaGFubmVsIEdcbiAgICAgICAgLy8gMTQgLSAxNSA6IGNvb2tpZSBjaGFubmVsIEJcbiAgICAgICAgLy8gMTIgICAgICA6IGNvb2tpZSB0cmFuc2Zvcm1cbiAgICAgICAgLy8gMTAgLSAxMSA6IGxpZ2h0IHNvdXJjZSBzaGFwZVxuICAgICAgICAvLyAgOCAtICA5IDogbGlnaHQgbnVtIGNhc2NhZGVzXG4gICAgICAgIC8vICA3ICAgICAgOiBkaXNhYmxlIHNwZWN1bGFyXG4gICAgICAgIC8vICA2IC0gIDQgOiBtYXNrXG4gICAgICAgIGxldCBrZXkgPVxuICAgICAgICAgICAgICAgKHRoaXMuX3R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDI5KSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nhc3RTaGFkb3dzID8gMSA6IDApICAgICAgICAgICAgICAgPDwgMjgpIHxcbiAgICAgICAgICAgICAgICh0aGlzLl9zaGFkb3dUeXBlICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyNSkgfFxuICAgICAgICAgICAgICAgKHRoaXMuX2ZhbGxvZmZNb2RlICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDIzKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgIT09IDAuMCA/IDEgOiAwKSAgPDwgMjIpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llID8gMSA6IDApICAgICAgICAgICAgICAgICAgICA8PCAyMSkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWVGYWxsb2ZmID8gMSA6IDApICAgICAgICAgICAgIDw8IDIwKSB8XG4gICAgICAgICAgICAgICAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDApXSAgICAgPDwgMTgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llVHJhbnNmb3JtID8gMSA6IDApICAgICAgICAgICA8PCAxMikgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9zaGFwZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDEwKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMubnVtQ2FzY2FkZXMgLSAxKSAgICAgICAgICAgICAgICAgICAgPDwgIDgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5hZmZlY3RTcGVjdWxhcml0eSA/IDEgOiAwKSAgICAgICAgICA8PCAgNykgfFxuICAgICAgICAgICAgICAgKCh0aGlzLm1hc2spICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8ICA2KTtcblxuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgICAgIGtleSB8PSAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDEpXSA8PCAxNik7XG4gICAgICAgICAgICBrZXkgfD0gKGNoYW5JZFt0aGlzLl9jb29raWVDaGFubmVsLmNoYXJBdCgyKV0gPDwgMTQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleSAhPT0gdGhpcy5rZXkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBsYXllciBtYWludGFpbnMgbGlnaHRzIHNwbGl0IGFuZCBzb3J0ZWQgYnkgdGhlIGtleSwgbm90aWZ5IGl0IHdoZW4gdGhlIGtleSBjaGFuZ2VzXG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmtleSA9IGtleTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH07XG4iXSwibmFtZXMiOlsidG1wVmVjIiwiVmVjMyIsInRtcEJpYXNlcyIsImJpYXMiLCJub3JtYWxCaWFzIiwiY2hhbklkIiwiciIsImciLCJiIiwiYSIsImxpZ2h0VHlwZXMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJMSUdIVFRZUEVfT01OSSIsIkxJR0hUVFlQRV9TUE9UIiwiZGlyZWN0aW9uYWxDYXNjYWRlcyIsIlZlYzQiLCJpZCIsIkxpZ2h0UmVuZGVyRGF0YSIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwiY2FtZXJhIiwiZmFjZSIsImxpZ2h0Iiwic2hhZG93Q2FtZXJhIiwiU2hhZG93UmVuZGVyZXIiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJfc2hhZG93VHlwZSIsIl90eXBlIiwic2hhZG93TWF0cml4IiwiTWF0NCIsInNoYWRvd1ZpZXdwb3J0Iiwic2hhZG93U2Npc3NvciIsImRlcHRoUmFuZ2VDb21wZW5zYXRpb24iLCJwcm9qZWN0aW9uQ29tcGVuc2F0aW9uIiwidmlzaWJsZUNhc3RlcnMiLCJ2aWV3QmluZEdyb3VwcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwiYmciLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsImxlbmd0aCIsInNoYWRvd0J1ZmZlciIsInJ0IiwicmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJfaXNQY2YiLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiZGVwdGhCdWZmZXIiLCJMaWdodCIsImdyYXBoaWNzRGV2aWNlIiwiY2x1c3RlcmVkTGlnaHRpbmciLCJsYXllcnMiLCJTZXQiLCJzaGFkb3dEZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIkRFRkFVTFQiLCJjbG9uZSIsIl9jb2xvciIsIkNvbG9yIiwiX2ludGVuc2l0eSIsIl9hZmZlY3RTcGVjdWxhcml0eSIsIl9sdW1pbmFuY2UiLCJfY2FzdFNoYWRvd3MiLCJfZW5hYmxlZCIsIl9tYXNrIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsImlzU3RhdGljIiwia2V5IiwiYmFrZURpciIsImJha2VOdW1TYW1wbGVzIiwiYmFrZUFyZWEiLCJhdHRlbnVhdGlvblN0YXJ0IiwiYXR0ZW51YXRpb25FbmQiLCJfZmFsbG9mZk1vZGUiLCJMSUdIVEZBTExPRkZfTElORUFSIiwiU0hBRE9XX1BDRjMiLCJfdnNtQmx1clNpemUiLCJ2c21CbHVyTW9kZSIsIkJMVVJfR0FVU1NJQU4iLCJ2c21CaWFzIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsIl9jb29raWVGYWxsb2ZmIiwiX2Nvb2tpZUNoYW5uZWwiLCJfY29va2llVHJhbnNmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfY29va2llT2Zmc2V0IiwiX2Nvb2tpZU9mZnNldFVuaWZvcm0iLCJfY29va2llVHJhbnNmb3JtU2V0IiwiX2Nvb2tpZU9mZnNldFNldCIsIl9pbm5lckNvbmVBbmdsZSIsIl9vdXRlckNvbmVBbmdsZSIsImNhc2NhZGVzIiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwiY2FzY2FkZURpc3RyaWJ1dGlvbiIsIl9zaGFwZSIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJfZmluYWxDb2xvciIsImMiLCJNYXRoIiwicG93IiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfcG9zaXRpb24iLCJfZGlyZWN0aW9uIiwiX2lubmVyQ29uZUFuZ2xlQ29zIiwiY29zIiwiUEkiLCJfdXBkYXRlT3V0ZXJBbmdsZSIsIl91c2VQaHlzaWNhbFVuaXRzIiwidW5kZWZpbmVkIiwiX3NoYWRvd01hcCIsIl9zaGFkb3dSZW5kZXJQYXJhbXMiLCJfc2hhZG93Q2FtZXJhUGFyYW1zIiwic2hhZG93RGlzdGFuY2UiLCJfc2hhZG93UmVzb2x1dGlvbiIsIl9zaGFkb3dCaWFzIiwic2hhZG93SW50ZW5zaXR5IiwiX25vcm1hbE9mZnNldEJpYXMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwic2hhZG93VXBkYXRlT3ZlcnJpZGVzIiwiX3BlbnVtYnJhU2l6ZSIsIl9pc1ZzbSIsIl9jb29raWVNYXRyaXgiLCJfYXRsYXNWaWV3cG9ydCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJhdGxhc1ZlcnNpb24iLCJhdGxhc1Nsb3RJbmRleCIsImF0bGFzU2xvdFVwZGF0ZWQiLCJfbm9kZSIsIl9yZW5kZXJEYXRhIiwidmlzaWJsZVRoaXNGcmFtZSIsIm1heFNjcmVlblNpemUiLCJfdXBkYXRlU2hhZG93QmlhcyIsIl9kZXN0cm95U2hhZG93TWFwIiwicmVsZWFzZVJlbmRlckRhdGEiLCJpIiwiYWRkTGF5ZXIiLCJsYXllciIsImFkZCIsInJlbW92ZUxheWVyIiwiZGVsZXRlIiwic2hhZG93QmlhcyIsInZhbHVlIiwidXBkYXRlS2V5Iiwic2hhZG93TWFwIiwibWFzayIsIm51bVNoYWRvd0ZhY2VzIiwidHlwZSIsInN0eXBlIiwic2hhZG93VHlwZSIsInNoYXBlIiwidXNlUGh5c2ljYWxVbml0cyIsIl91cGRhdGVGaW5hbENvbG9yIiwiU0hBRE9XX1BDU1MiLCJTSEFET1dfUENGNSIsIlNIQURPV19WU00zMiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJ0ZXh0dXJlRmxvYXRGaWx0ZXJhYmxlIiwiU0hBRE9XX1ZTTTE2IiwidGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUiLCJTSEFET1dfVlNNOCIsIlNIQURPV19QQ0YxIiwiZW5hYmxlZCIsImxheWVyc0RpcnR5IiwiY2FzdFNoYWRvd3MiLCJNQVNLX0JBS0UiLCJzaGFkb3dSZXNvbHV0aW9uIiwibWluIiwibWF4Q3ViZU1hcFNpemUiLCJtYXhUZXh0dXJlU2l6ZSIsInZzbUJsdXJTaXplIiwibm9ybWFsT2Zmc2V0QmlhcyIsImZhbGxvZmZNb2RlIiwiaW5uZXJDb25lQW5nbGUiLCJvdXRlckNvbmVBbmdsZSIsInBlbnVtYnJhU2l6ZSIsImFuZ2xlIiwicmFkQW5nbGUiLCJfb3V0ZXJDb25lQW5nbGVDb3MiLCJfb3V0ZXJDb25lQW5nbGVTaW4iLCJzaW4iLCJpbnRlbnNpdHkiLCJhZmZlY3RTcGVjdWxhcml0eSIsImx1bWluYW5jZSIsImNvb2tpZU1hdHJpeCIsImF0bGFzVmlld3BvcnQiLCJjb29raWUiLCJjb29raWVGYWxsb2ZmIiwiY29va2llQ2hhbm5lbCIsImNociIsImNoYXJBdCIsImFkZExlbiIsImNvb2tpZVRyYW5zZm9ybSIsImNvb2tpZU9mZnNldCIsIlZlYzIiLCJ4Zm9ybU5ldyIsInNldCIsImJlZ2luRnJhbWUiLCJjYWNoZWQiLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJnZXRSZW5kZXJEYXRhIiwiY3VycmVudCIsInJkIiwicHVzaCIsInNldENvbG9yIiwic2xpY2UiLCJjb3B5IiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsIm91dGVyQW5nbGUiLCJpbm5lckFuZ2xlIiwiZmFsbG9mZkVuZCIsImZhbGxvZmZTdGFydCIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImxpZ2h0UmVuZGVyRGF0YSIsImZhckNsaXAiLCJfZmFyQ2xpcCIsImlzV2ViR0wxIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImdldENvbG9yIiwiZ2V0Qm91bmRpbmdTcGhlcmUiLCJzcGhlcmUiLCJzaXplIiwiY29zQW5nbGUiLCJub2RlIiwidXAiLCJyYWRpdXMiLCJtdWxTY2FsYXIiLCJjZW50ZXIiLCJhZGQyIiwiZ2V0UG9zaXRpb24iLCJnZXRCb3VuZGluZ0JveCIsImJveCIsInJhbmdlIiwic2NsIiwiYWJzIiwibWF0aCIsIkRFR19UT19SQUQiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImlzV2ViR0wyIiwiaXNXZWJHUFUiLCJkZXB0aEJpYXMiLCJkZXB0aEJpYXNTbG9wZSIsImNvbG9yIiwiZmluYWxDb2xvciIsImxpbmVhckZpbmFsQ29sb3IiLCJhcmd1bWVudHMiLCJtYXJrTGlnaHRzRGlydHkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFrQkEsTUFBTUEsTUFBTSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3pCLE1BQU1DLFNBQVMsR0FBRztBQUNkQyxFQUFBQSxJQUFJLEVBQUUsQ0FBQztBQUNQQyxFQUFBQSxVQUFVLEVBQUUsQ0FBQTtBQUNoQixDQUFDLENBQUE7QUFFRCxNQUFNQyxNQUFNLEdBQUc7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUE7QUFBRSxDQUFDLENBQUE7QUFFekMsTUFBTUMsVUFBVSxHQUFHO0FBQ2YsRUFBQSxhQUFhLEVBQUVDLHFCQUFxQjtBQUNwQyxFQUFBLE1BQU0sRUFBRUMsY0FBYztBQUN0QixFQUFBLE9BQU8sRUFBRUEsY0FBYztBQUN2QixFQUFBLE1BQU0sRUFBRUMsY0FBQUE7QUFDWixFQUFDOztBQUVEO0FBQ0EsTUFBTUMsbUJBQW1CLEdBQUcsQ0FDeEIsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDdEIsQ0FBQyxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQ3RELENBQUMsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUlBLElBQUksQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJQSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFDbEYsQ0FBQyxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUlBLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJQSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FDbkgsQ0FBQTtBQUVELElBQUlDLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGVBQWUsQ0FBQztFQUNsQkMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFO0FBRXJDO0lBQ0EsSUFBSSxDQUFDQSxLQUFLLEdBQUdBLEtBQUssQ0FBQTs7QUFFbEI7QUFDQTtBQUNBO0FBQ0E7SUFDQSxJQUFJLENBQUNGLE1BQU0sR0FBR0EsTUFBTSxDQUFBOztBQUVwQjtBQUNBLElBQUEsSUFBSSxDQUFDRyxZQUFZLEdBQUdDLGNBQWMsQ0FBQ0Msa0JBQWtCLENBQUNOLE1BQU0sRUFBRUcsS0FBSyxDQUFDSSxXQUFXLEVBQUVKLEtBQUssQ0FBQ0ssS0FBSyxFQUFFTixJQUFJLENBQUMsQ0FBQTs7QUFFbkc7QUFDQSxJQUFBLElBQUksQ0FBQ08sWUFBWSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUU5QjtBQUNBLElBQUEsSUFBSSxDQUFDQyxjQUFjLEdBQUcsSUFBSWYsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBOztBQUUxQztBQUNBLElBQUEsSUFBSSxDQUFDZ0IsYUFBYSxHQUFHLElBQUloQixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7O0FBRXpDO0lBQ0EsSUFBSSxDQUFDaUIsc0JBQXNCLEdBQUcsQ0FBQyxDQUFBO0lBQy9CLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsQ0FBQyxDQUFBOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtJQUNBLElBQUksQ0FBQ1osSUFBSSxHQUFHQSxJQUFJLENBQUE7O0FBRWhCO0lBQ0EsSUFBSSxDQUFDYSxjQUFjLEdBQUcsRUFBRSxDQUFBOztBQUV4QjtBQUNBO0lBQ0EsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDQUMsRUFBQUEsT0FBT0EsR0FBRztBQUNOLElBQUEsSUFBSSxDQUFDRCxjQUFjLENBQUNFLE9BQU8sQ0FBRUMsRUFBRSxJQUFLO0FBQ2hDQSxNQUFBQSxFQUFFLENBQUNDLG9CQUFvQixDQUFDSCxPQUFPLEVBQUUsQ0FBQTtNQUNqQ0UsRUFBRSxDQUFDRixPQUFPLEVBQUUsQ0FBQTtBQUNoQixLQUFDLENBQUMsQ0FBQTtBQUNGLElBQUEsSUFBSSxDQUFDRCxjQUFjLENBQUNLLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbEMsR0FBQTs7QUFFQTtFQUNBLElBQUlDLFlBQVlBLEdBQUc7QUFDZixJQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJLENBQUNuQixZQUFZLENBQUNvQixZQUFZLENBQUE7QUFDekMsSUFBQSxJQUFJRCxFQUFFLEVBQUU7QUFDSixNQUFBLE1BQU1wQixLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUE7QUFDeEIsTUFBQSxJQUFJQSxLQUFLLENBQUNLLEtBQUssS0FBS2YsY0FBYyxFQUFFO1FBQ2hDLE9BQU84QixFQUFFLENBQUNFLFdBQVcsQ0FBQTtBQUN6QixPQUFBO0FBRUEsTUFBQSxPQUFPdEIsS0FBSyxDQUFDdUIsTUFBTSxJQUFJdkIsS0FBSyxDQUFDSCxNQUFNLENBQUMyQixtQkFBbUIsR0FBR0osRUFBRSxDQUFDSyxXQUFXLEdBQUdMLEVBQUUsQ0FBQ0UsV0FBVyxDQUFBO0FBQzdGLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1JLEtBQUssQ0FBQztBQXNCUjlCLEVBQUFBLFdBQVdBLENBQUMrQixjQUFjLEVBQUVDLGlCQUFpQixFQUFFO0FBckIvQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLE1BQU0sR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTtBQUVsQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FGLGlCQUFpQixHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWpCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBRyxDQUFBQSxnQkFBZ0IsR0FBR0MsVUFBVSxDQUFDQyxPQUFPLENBQUNDLEtBQUssRUFBRSxDQUFBO0lBR3pDLElBQUksQ0FBQ3JDLE1BQU0sR0FBRzhCLGNBQWMsQ0FBQTtJQUM1QixJQUFJLENBQUNDLGlCQUFpQixHQUFHQSxpQkFBaUIsQ0FBQTtBQUMxQyxJQUFBLElBQUksQ0FBQ2xDLEVBQUUsR0FBR0EsRUFBRSxFQUFFLENBQUE7O0FBRWQ7SUFDQSxJQUFJLENBQUNXLEtBQUssR0FBR2hCLHFCQUFxQixDQUFBO0lBQ2xDLElBQUksQ0FBQzhDLE1BQU0sR0FBRyxJQUFJQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQTtJQUN0QyxJQUFJLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUE7SUFDbkIsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxJQUFJLENBQUE7SUFDOUIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUN6QixJQUFJLENBQUNDLFFBQVEsR0FBRyxLQUFLLENBQUE7SUFDckIsSUFBSSxDQUFDQyxLQUFLLEdBQUdDLG1CQUFtQixDQUFBO0lBQ2hDLElBQUksQ0FBQ0MsUUFBUSxHQUFHLEtBQUssQ0FBQTtJQUNyQixJQUFJLENBQUNDLEdBQUcsR0FBRyxDQUFDLENBQUE7SUFDWixJQUFJLENBQUNDLE9BQU8sR0FBRyxJQUFJLENBQUE7SUFDbkIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsQ0FBQyxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLENBQUMsQ0FBQTs7QUFFakI7SUFDQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtJQUMxQixJQUFJLENBQUNDLGNBQWMsR0FBRyxFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxZQUFZLEdBQUdDLG1CQUFtQixDQUFBO0lBQ3ZDLElBQUksQ0FBQ2hELFdBQVcsR0FBR2lELFdBQVcsQ0FBQTtJQUM5QixJQUFJLENBQUNDLFlBQVksR0FBRyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxXQUFXLEdBQUdDLGFBQWEsQ0FBQTtBQUNoQyxJQUFBLElBQUksQ0FBQ0MsT0FBTyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUE7QUFDMUIsSUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDcEIsSUFBSSxDQUFDQyxlQUFlLEdBQUcsQ0FBQyxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQTtJQUMxQixJQUFJLENBQUNDLGNBQWMsR0FBRyxLQUFLLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUM3QixJQUFBLElBQUksQ0FBQ0MsdUJBQXVCLEdBQUcsSUFBSUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xELElBQUEsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzFCLElBQUEsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJRixZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDL0MsSUFBSSxDQUFDRyxtQkFBbUIsR0FBRyxLQUFLLENBQUE7SUFDaEMsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7O0FBRTdCO0lBQ0EsSUFBSSxDQUFDQyxlQUFlLEdBQUcsRUFBRSxDQUFBO0lBQ3pCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLEVBQUUsQ0FBQTs7QUFFekI7QUFDQSxJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQztBQUNyQixJQUFBLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsSUFBSSxDQUFDO0lBQ2pDLElBQUksQ0FBQ0MsdUJBQXVCLEdBQUcsSUFBSSxDQUFBO0lBQ25DLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQUMsQ0FBQTtJQUNwQixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEdBQUcsQ0FBQTs7QUFFOUI7SUFDQSxJQUFJLENBQUNDLE1BQU0sR0FBR0MsbUJBQW1CLENBQUE7O0FBRWpDO0FBQ0EsSUFBQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJZCxZQUFZLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDcEQsSUFBQSxNQUFNZSxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ0gsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQzVDLElBQUEsSUFBSSxDQUFDSSxpQkFBaUIsR0FBRyxJQUFJbEIsWUFBWSxDQUFDLENBQUNlLENBQUMsRUFBRUEsQ0FBQyxFQUFFQSxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBRXBELElBQUksQ0FBQ0ksU0FBUyxHQUFHLElBQUl4RyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUNsQyxJQUFJLENBQUN5RyxVQUFVLEdBQUcsSUFBSXpHLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ25DLElBQUEsSUFBSSxDQUFDMEcsa0JBQWtCLEdBQUdMLElBQUksQ0FBQ00sR0FBRyxDQUFDLElBQUksQ0FBQ2pCLGVBQWUsR0FBR1csSUFBSSxDQUFDTyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFDeEUsSUFBQSxJQUFJLENBQUNDLGlCQUFpQixDQUFDLElBQUksQ0FBQ2xCLGVBQWUsQ0FBQyxDQUFBO0lBRTVDLElBQUksQ0FBQ21CLGlCQUFpQixHQUFHQyxTQUFTLENBQUE7O0FBRWxDO0lBQ0EsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsRUFBRSxDQUFBO0lBQzdCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsRUFBRSxDQUFBOztBQUU3QjtJQUNBLElBQUksQ0FBQ0MsY0FBYyxHQUFHLEVBQUUsQ0FBQTtJQUN4QixJQUFJLENBQUNDLGlCQUFpQixHQUFHLElBQUksQ0FBQTtBQUM3QixJQUFBLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQUMsTUFBTSxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLEdBQUcsQ0FBQTtJQUMxQixJQUFJLENBQUNDLGlCQUFpQixHQUFHLEdBQUcsQ0FBQTtJQUM1QixJQUFJLENBQUNDLGdCQUFnQixHQUFHQyxxQkFBcUIsQ0FBQTtJQUM3QyxJQUFJLENBQUNDLHFCQUFxQixHQUFHLElBQUksQ0FBQTtJQUNqQyxJQUFJLENBQUNDLGFBQWEsR0FBRyxHQUFHLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsS0FBSyxDQUFBO0lBQ25CLElBQUksQ0FBQ2hGLE1BQU0sR0FBRyxJQUFJLENBQUE7O0FBRWxCO0lBQ0EsSUFBSSxDQUFDaUYsYUFBYSxHQUFHLElBQUksQ0FBQTs7QUFFekI7SUFDQSxJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7QUFDMUIsSUFBQSxJQUFJLENBQUNDLHNCQUFzQixHQUFHLEtBQUssQ0FBQztBQUNwQyxJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLENBQUMsQ0FBQztBQUN0QixJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN4QixJQUFBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDOztJQUU5QixJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJLENBQUE7O0FBRWpCO0lBQ0EsSUFBSSxDQUFDQyxXQUFXLEdBQUcsRUFBRSxDQUFBOztBQUVyQjtJQUNBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBOztBQUU3QjtBQUNBO0lBQ0EsSUFBSSxDQUFDQyxhQUFhLEdBQUcsQ0FBQyxDQUFBO0lBRXRCLElBQUksQ0FBQ0MsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QixHQUFBO0FBRUFwRyxFQUFBQSxPQUFPQSxHQUFHO0lBQ04sSUFBSSxDQUFDcUcsaUJBQWlCLEVBQUUsQ0FBQTtJQUV4QixJQUFJLENBQUNDLGlCQUFpQixFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDTCxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQzNCLEdBQUE7QUFFQUssRUFBQUEsaUJBQWlCQSxHQUFHO0lBRWhCLElBQUksSUFBSSxDQUFDTCxXQUFXLEVBQUU7QUFDbEIsTUFBQSxLQUFLLElBQUlNLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNOLFdBQVcsQ0FBQzdGLE1BQU0sRUFBRW1HLENBQUMsRUFBRSxFQUFFO1FBQzlDLElBQUksQ0FBQ04sV0FBVyxDQUFDTSxDQUFDLENBQUMsQ0FBQ3ZHLE9BQU8sRUFBRSxDQUFBO0FBQ2pDLE9BQUE7QUFFQSxNQUFBLElBQUksQ0FBQ2lHLFdBQVcsQ0FBQzdGLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDL0IsS0FBQTtBQUNKLEdBQUE7RUFFQW9HLFFBQVFBLENBQUNDLEtBQUssRUFBRTtBQUNaLElBQUEsSUFBSSxDQUFDMUYsTUFBTSxDQUFDMkYsR0FBRyxDQUFDRCxLQUFLLENBQUMsQ0FBQTtBQUMxQixHQUFBO0VBRUFFLFdBQVdBLENBQUNGLEtBQUssRUFBRTtBQUNmLElBQUEsSUFBSSxDQUFDMUYsTUFBTSxDQUFDNkYsTUFBTSxDQUFDSCxLQUFLLENBQUMsQ0FBQTtBQUM3QixHQUFBO0VBRUEsSUFBSUksVUFBVUEsQ0FBQ0MsS0FBSyxFQUFFO0FBQ2xCLElBQUEsSUFBSSxJQUFJLENBQUM1QixXQUFXLEtBQUs0QixLQUFLLEVBQUU7TUFDNUIsSUFBSSxDQUFDNUIsV0FBVyxHQUFHNEIsS0FBSyxDQUFBO01BQ3hCLElBQUksQ0FBQ1YsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlTLFVBQVVBLEdBQUc7SUFDYixPQUFPLElBQUksQ0FBQzNCLFdBQVcsQ0FBQTtBQUMzQixHQUFBO0VBRUEsSUFBSXRCLFdBQVdBLENBQUNrRCxLQUFLLEVBQUU7SUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQ3JELFFBQVEsSUFBSSxJQUFJLENBQUNHLFdBQVcsS0FBS2tELEtBQUssRUFBRTtNQUM5QyxJQUFJLENBQUNyRCxRQUFRLEdBQUcvRSxtQkFBbUIsQ0FBQ29JLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQTtNQUM5QyxJQUFJLENBQUNwRCxvQkFBb0IsR0FBRyxJQUFJUixZQUFZLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO01BQ3JELElBQUksQ0FBQ1MsdUJBQXVCLEdBQUcsSUFBSVQsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO01BQ25ELElBQUksQ0FBQ21ELGlCQUFpQixFQUFFLENBQUE7TUFDeEIsSUFBSSxDQUFDVSxTQUFTLEVBQUUsQ0FBQTtBQUNwQixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUluRCxXQUFXQSxHQUFHO0FBQ2QsSUFBQSxPQUFPLElBQUksQ0FBQ0gsUUFBUSxDQUFDckQsTUFBTSxDQUFBO0FBQy9CLEdBQUE7RUFFQSxJQUFJNEcsU0FBU0EsQ0FBQ0EsU0FBUyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxJQUFJLENBQUNuQyxVQUFVLEtBQUttQyxTQUFTLEVBQUU7TUFDL0IsSUFBSSxDQUFDWCxpQkFBaUIsRUFBRSxDQUFBO01BQ3hCLElBQUksQ0FBQ3hCLFVBQVUsR0FBR21DLFNBQVMsQ0FBQTtBQUMvQixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlBLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQ25DLFVBQVUsQ0FBQTtBQUMxQixHQUFBO0VBRUEsSUFBSW9DLElBQUlBLENBQUNILEtBQUssRUFBRTtBQUNaLElBQUEsSUFBSSxJQUFJLENBQUNsRixLQUFLLEtBQUtrRixLQUFLLEVBQUU7TUFDdEIsSUFBSSxDQUFDbEYsS0FBSyxHQUFHa0YsS0FBSyxDQUFBO01BQ2xCLElBQUksQ0FBQ0MsU0FBUyxFQUFFLENBQUE7QUFDcEIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJRSxJQUFJQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNyRixLQUFLLENBQUE7QUFDckIsR0FBQTs7QUFFQTtFQUNBLElBQUlzRixjQUFjQSxHQUFHO0FBQ2pCLElBQUEsTUFBTUMsSUFBSSxHQUFHLElBQUksQ0FBQzVILEtBQUssQ0FBQTtJQUN2QixJQUFJNEgsSUFBSSxLQUFLNUkscUJBQXFCLEVBQUU7TUFDaEMsT0FBTyxJQUFJLENBQUNxRixXQUFXLENBQUE7QUFDM0IsS0FBQyxNQUFNLElBQUl1RCxJQUFJLEtBQUszSSxjQUFjLEVBQUU7QUFDaEMsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUNaLEtBQUE7QUFFQSxJQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ1osR0FBQTtFQUVBLElBQUkySSxJQUFJQSxDQUFDTCxLQUFLLEVBQUU7QUFDWixJQUFBLElBQUksSUFBSSxDQUFDdkgsS0FBSyxLQUFLdUgsS0FBSyxFQUNwQixPQUFBO0lBRUosSUFBSSxDQUFDdkgsS0FBSyxHQUFHdUgsS0FBSyxDQUFBO0lBQ2xCLElBQUksQ0FBQ1QsaUJBQWlCLEVBQUUsQ0FBQTtJQUN4QixJQUFJLENBQUNELGlCQUFpQixFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDVyxTQUFTLEVBQUUsQ0FBQTtBQUVoQixJQUFBLE1BQU1LLEtBQUssR0FBRyxJQUFJLENBQUM5SCxXQUFXLENBQUE7SUFDOUIsSUFBSSxDQUFDQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ2lHLHFCQUFxQixHQUFHLElBQUksQ0FBQTtBQUNqQyxJQUFBLElBQUksQ0FBQzhCLFVBQVUsR0FBR0QsS0FBSyxDQUFDO0FBQzVCLEdBQUE7O0VBRUEsSUFBSUQsSUFBSUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDNUgsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7RUFFQSxJQUFJK0gsS0FBS0EsQ0FBQ1IsS0FBSyxFQUFFO0FBQ2IsSUFBQSxJQUFJLElBQUksQ0FBQ2hELE1BQU0sS0FBS2dELEtBQUssRUFDckIsT0FBQTtJQUVKLElBQUksQ0FBQ2hELE1BQU0sR0FBR2dELEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNULGlCQUFpQixFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDVSxTQUFTLEVBQUUsQ0FBQTtBQUVoQixJQUFBLE1BQU1LLEtBQUssR0FBRyxJQUFJLENBQUM5SCxXQUFXLENBQUE7SUFDOUIsSUFBSSxDQUFDQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLElBQUEsSUFBSSxDQUFDK0gsVUFBVSxHQUFHRCxLQUFLLENBQUM7QUFDNUIsR0FBQTs7RUFFQSxJQUFJRSxLQUFLQSxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUN4RCxNQUFNLENBQUE7QUFDdEIsR0FBQTtFQUVBLElBQUl5RCxnQkFBZ0JBLENBQUNULEtBQUssRUFBRTtBQUN4QixJQUFBLElBQUksSUFBSSxDQUFDbkMsaUJBQWlCLEtBQUttQyxLQUFLLEVBQUU7TUFDbEMsSUFBSSxDQUFDbkMsaUJBQWlCLEdBQUdtQyxLQUFLLENBQUE7TUFDOUIsSUFBSSxDQUFDVSxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUQsZ0JBQWdCQSxHQUFHO0lBQ25CLE9BQU8sSUFBSSxDQUFDNUMsaUJBQWlCLENBQUE7QUFDakMsR0FBQTtFQUVBLElBQUkwQyxVQUFVQSxDQUFDUCxLQUFLLEVBQUU7QUFDbEIsSUFBQSxJQUFJLElBQUksQ0FBQ3hILFdBQVcsS0FBS3dILEtBQUssRUFDMUIsT0FBQTtBQUVKLElBQUEsTUFBTS9ILE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtBQUUxQixJQUFBLElBQUksSUFBSSxDQUFDUSxLQUFLLEtBQUtmLGNBQWMsSUFBSXNJLEtBQUssS0FBS3ZFLFdBQVcsSUFBSXVFLEtBQUssS0FBS1csV0FBVyxFQUMvRVgsS0FBSyxHQUFHdkUsV0FBVyxDQUFDOztBQUV4QixJQUFBLE1BQU03QixtQkFBbUIsR0FBRzNCLE1BQU0sQ0FBQzJCLG1CQUFtQixDQUFBO0FBQ3RELElBQUEsSUFBSW9HLEtBQUssS0FBS1ksV0FBVyxJQUFJLENBQUNoSCxtQkFBbUIsRUFBRTtNQUMvQ29HLEtBQUssR0FBR3ZFLFdBQVcsQ0FBQztBQUN4QixLQUFBOztBQUVBO0FBQ0EsSUFBQSxJQUFJdUUsS0FBSyxLQUFLYSxZQUFZLEtBQUssQ0FBQzVJLE1BQU0sQ0FBQzZJLHNCQUFzQixJQUFJLENBQUM3SSxNQUFNLENBQUM4SSxzQkFBc0IsQ0FBQyxFQUM1RmYsS0FBSyxHQUFHZ0IsWUFBWSxDQUFBOztBQUV4QjtJQUNBLElBQUloQixLQUFLLEtBQUtnQixZQUFZLElBQUksQ0FBQy9JLE1BQU0sQ0FBQ2dKLDBCQUEwQixFQUM1RGpCLEtBQUssR0FBR2tCLFdBQVcsQ0FBQTtJQUV2QixJQUFJLENBQUN2QyxNQUFNLEdBQUdxQixLQUFLLElBQUlrQixXQUFXLElBQUlsQixLQUFLLElBQUlhLFlBQVksQ0FBQTtBQUMzRCxJQUFBLElBQUksQ0FBQ2xILE1BQU0sR0FBR3FHLEtBQUssS0FBS21CLFdBQVcsSUFBSW5CLEtBQUssS0FBS3ZFLFdBQVcsSUFBSXVFLEtBQUssS0FBS1ksV0FBVyxDQUFBO0lBRXJGLElBQUksQ0FBQ3BJLFdBQVcsR0FBR3dILEtBQUssQ0FBQTtJQUN4QixJQUFJLENBQUNULGlCQUFpQixFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDVSxTQUFTLEVBQUUsQ0FBQTtBQUNwQixHQUFBO0VBRUEsSUFBSU0sVUFBVUEsR0FBRztJQUNiLE9BQU8sSUFBSSxDQUFDL0gsV0FBVyxDQUFBO0FBQzNCLEdBQUE7RUFFQSxJQUFJNEksT0FBT0EsQ0FBQ3BCLEtBQUssRUFBRTtBQUNmLElBQUEsSUFBSSxJQUFJLENBQUNuRixRQUFRLEtBQUttRixLQUFLLEVBQUU7TUFDekIsSUFBSSxDQUFDbkYsUUFBUSxHQUFHbUYsS0FBSyxDQUFBO01BQ3JCLElBQUksQ0FBQ3FCLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUQsT0FBT0EsR0FBRztJQUNWLE9BQU8sSUFBSSxDQUFDdkcsUUFBUSxDQUFBO0FBQ3hCLEdBQUE7RUFFQSxJQUFJeUcsV0FBV0EsQ0FBQ3RCLEtBQUssRUFBRTtBQUNuQixJQUFBLElBQUksSUFBSSxDQUFDcEYsWUFBWSxLQUFLb0YsS0FBSyxFQUFFO01BQzdCLElBQUksQ0FBQ3BGLFlBQVksR0FBR29GLEtBQUssQ0FBQTtNQUN6QixJQUFJLENBQUNULGlCQUFpQixFQUFFLENBQUE7TUFDeEIsSUFBSSxDQUFDOEIsV0FBVyxFQUFFLENBQUE7TUFDbEIsSUFBSSxDQUFDcEIsU0FBUyxFQUFFLENBQUE7QUFDcEIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJcUIsV0FBV0EsR0FBRztBQUNkLElBQUEsT0FBTyxJQUFJLENBQUMxRyxZQUFZLElBQUksSUFBSSxDQUFDRSxLQUFLLEtBQUt5RyxTQUFTLElBQUksSUFBSSxDQUFDekcsS0FBSyxLQUFLLENBQUMsQ0FBQTtBQUM1RSxHQUFBO0VBRUEsSUFBSTBHLGdCQUFnQkEsQ0FBQ3hCLEtBQUssRUFBRTtBQUN4QixJQUFBLElBQUksSUFBSSxDQUFDN0IsaUJBQWlCLEtBQUs2QixLQUFLLEVBQUU7QUFDbEMsTUFBQSxJQUFJLElBQUksQ0FBQ3ZILEtBQUssS0FBS2YsY0FBYyxFQUFFO0FBQy9Cc0ksUUFBQUEsS0FBSyxHQUFHNUMsSUFBSSxDQUFDcUUsR0FBRyxDQUFDekIsS0FBSyxFQUFFLElBQUksQ0FBQy9ILE1BQU0sQ0FBQ3lKLGNBQWMsQ0FBQyxDQUFBO0FBQ3ZELE9BQUMsTUFBTTtBQUNIMUIsUUFBQUEsS0FBSyxHQUFHNUMsSUFBSSxDQUFDcUUsR0FBRyxDQUFDekIsS0FBSyxFQUFFLElBQUksQ0FBQy9ILE1BQU0sQ0FBQzBKLGNBQWMsQ0FBQyxDQUFBO0FBQ3ZELE9BQUE7TUFDQSxJQUFJLENBQUN4RCxpQkFBaUIsR0FBRzZCLEtBQUssQ0FBQTtNQUM5QixJQUFJLENBQUNULGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJaUMsZ0JBQWdCQSxHQUFHO0lBQ25CLE9BQU8sSUFBSSxDQUFDckQsaUJBQWlCLENBQUE7QUFDakMsR0FBQTtFQUVBLElBQUl5RCxXQUFXQSxDQUFDNUIsS0FBSyxFQUFFO0FBQ25CLElBQUEsSUFBSSxJQUFJLENBQUN0RSxZQUFZLEtBQUtzRSxLQUFLLEVBQzNCLE9BQUE7SUFFSixJQUFJQSxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRUEsS0FBSyxFQUFFLENBQUM7SUFDN0IsSUFBSSxDQUFDdEUsWUFBWSxHQUFHc0UsS0FBSyxDQUFBO0FBQzdCLEdBQUE7RUFFQSxJQUFJNEIsV0FBV0EsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDbEcsWUFBWSxDQUFBO0FBQzVCLEdBQUE7RUFFQSxJQUFJbUcsZ0JBQWdCQSxDQUFDN0IsS0FBSyxFQUFFO0FBQ3hCLElBQUEsSUFBSSxJQUFJLENBQUMxQixpQkFBaUIsS0FBSzBCLEtBQUssRUFDaEMsT0FBQTtBQUVKLElBQUEsSUFBSyxDQUFDLElBQUksQ0FBQzFCLGlCQUFpQixJQUFJMEIsS0FBSyxJQUFNLElBQUksQ0FBQzFCLGlCQUFpQixJQUFJLENBQUMwQixLQUFNLEVBQUU7TUFDMUUsSUFBSSxDQUFDQyxTQUFTLEVBQUUsQ0FBQTtBQUNwQixLQUFBO0lBQ0EsSUFBSSxDQUFDM0IsaUJBQWlCLEdBQUcwQixLQUFLLENBQUE7QUFDbEMsR0FBQTtFQUVBLElBQUk2QixnQkFBZ0JBLEdBQUc7SUFDbkIsT0FBTyxJQUFJLENBQUN2RCxpQkFBaUIsQ0FBQTtBQUNqQyxHQUFBO0VBRUEsSUFBSXdELFdBQVdBLENBQUM5QixLQUFLLEVBQUU7QUFDbkIsSUFBQSxJQUFJLElBQUksQ0FBQ3pFLFlBQVksS0FBS3lFLEtBQUssRUFDM0IsT0FBQTtJQUVKLElBQUksQ0FBQ3pFLFlBQVksR0FBR3lFLEtBQUssQ0FBQTtJQUN6QixJQUFJLENBQUNDLFNBQVMsRUFBRSxDQUFBO0FBQ3BCLEdBQUE7RUFFQSxJQUFJNkIsV0FBV0EsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDdkcsWUFBWSxDQUFBO0FBQzVCLEdBQUE7RUFFQSxJQUFJd0csY0FBY0EsQ0FBQy9CLEtBQUssRUFBRTtBQUN0QixJQUFBLElBQUksSUFBSSxDQUFDdkQsZUFBZSxLQUFLdUQsS0FBSyxFQUM5QixPQUFBO0lBRUosSUFBSSxDQUFDdkQsZUFBZSxHQUFHdUQsS0FBSyxDQUFBO0FBQzVCLElBQUEsSUFBSSxDQUFDdkMsa0JBQWtCLEdBQUdMLElBQUksQ0FBQ00sR0FBRyxDQUFDc0MsS0FBSyxHQUFHNUMsSUFBSSxDQUFDTyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUE7SUFDekQsSUFBSSxJQUFJLENBQUNFLGlCQUFpQixFQUFFO01BQ3hCLElBQUksQ0FBQzZDLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJcUIsY0FBY0EsR0FBRztJQUNqQixPQUFPLElBQUksQ0FBQ3RGLGVBQWUsQ0FBQTtBQUMvQixHQUFBO0VBRUEsSUFBSXVGLGNBQWNBLENBQUNoQyxLQUFLLEVBQUU7QUFDdEIsSUFBQSxJQUFJLElBQUksQ0FBQ3RELGVBQWUsS0FBS3NELEtBQUssRUFDOUIsT0FBQTtJQUVKLElBQUksQ0FBQ3RELGVBQWUsR0FBR3NELEtBQUssQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ3BDLGlCQUFpQixDQUFDb0MsS0FBSyxDQUFDLENBQUE7SUFFN0IsSUFBSSxJQUFJLENBQUNuQyxpQkFBaUIsRUFBRTtNQUN4QixJQUFJLENBQUM2QyxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSXNCLGNBQWNBLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUN0RixlQUFlLENBQUE7QUFDL0IsR0FBQTtFQUVBLElBQUl1RixZQUFZQSxDQUFDakMsS0FBSyxFQUFFO0lBQ3BCLElBQUksQ0FBQ3RCLGFBQWEsR0FBR3NCLEtBQUssQ0FBQTtBQUM5QixHQUFBO0VBRUEsSUFBSWlDLFlBQVlBLEdBQUc7SUFDZixPQUFPLElBQUksQ0FBQ3ZELGFBQWEsQ0FBQTtBQUM3QixHQUFBO0VBRUFkLGlCQUFpQkEsQ0FBQ3NFLEtBQUssRUFBRTtJQUNyQixNQUFNQyxRQUFRLEdBQUdELEtBQUssR0FBRzlFLElBQUksQ0FBQ08sRUFBRSxHQUFHLEdBQUcsQ0FBQTtJQUN0QyxJQUFJLENBQUN5RSxrQkFBa0IsR0FBR2hGLElBQUksQ0FBQ00sR0FBRyxDQUFDeUUsUUFBUSxDQUFDLENBQUE7SUFDNUMsSUFBSSxDQUFDRSxrQkFBa0IsR0FBR2pGLElBQUksQ0FBQ2tGLEdBQUcsQ0FBQ0gsUUFBUSxDQUFDLENBQUE7QUFDaEQsR0FBQTtFQUVBLElBQUlJLFNBQVNBLENBQUN2QyxLQUFLLEVBQUU7QUFDakIsSUFBQSxJQUFJLElBQUksQ0FBQ3ZGLFVBQVUsS0FBS3VGLEtBQUssRUFBRTtNQUMzQixJQUFJLENBQUN2RixVQUFVLEdBQUd1RixLQUFLLENBQUE7TUFDdkIsSUFBSSxDQUFDVSxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSTZCLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQzlILFVBQVUsQ0FBQTtBQUMxQixHQUFBO0VBRUEsSUFBSStILGlCQUFpQkEsQ0FBQ3hDLEtBQUssRUFBRTtBQUN6QixJQUFBLElBQUksSUFBSSxDQUFDdkgsS0FBSyxLQUFLaEIscUJBQXFCLEVBQUU7TUFDdEMsSUFBSSxDQUFDaUQsa0JBQWtCLEdBQUdzRixLQUFLLENBQUE7TUFDL0IsSUFBSSxDQUFDQyxTQUFTLEVBQUUsQ0FBQTtBQUNwQixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUl1QyxpQkFBaUJBLEdBQUc7SUFDcEIsT0FBTyxJQUFJLENBQUM5SCxrQkFBa0IsQ0FBQTtBQUNsQyxHQUFBO0VBRUEsSUFBSStILFNBQVNBLENBQUN6QyxLQUFLLEVBQUU7QUFDakIsSUFBQSxJQUFJLElBQUksQ0FBQ3JGLFVBQVUsS0FBS3FGLEtBQUssRUFBRTtNQUMzQixJQUFJLENBQUNyRixVQUFVLEdBQUdxRixLQUFLLENBQUE7TUFDdkIsSUFBSSxDQUFDVSxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSStCLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQzlILFVBQVUsQ0FBQTtBQUMxQixHQUFBO0VBRUEsSUFBSStILFlBQVlBLEdBQUc7QUFDZixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUM5RCxhQUFhLEVBQUU7QUFDckIsTUFBQSxJQUFJLENBQUNBLGFBQWEsR0FBRyxJQUFJakcsSUFBSSxFQUFFLENBQUE7QUFDbkMsS0FBQTtJQUNBLE9BQU8sSUFBSSxDQUFDaUcsYUFBYSxDQUFBO0FBQzdCLEdBQUE7RUFFQSxJQUFJK0QsYUFBYUEsR0FBRztBQUNoQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUM5RCxjQUFjLEVBQUU7QUFDdEIsTUFBQSxJQUFJLENBQUNBLGNBQWMsR0FBRyxJQUFJaEgsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQzlDLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ2dILGNBQWMsQ0FBQTtBQUM5QixHQUFBO0VBRUEsSUFBSStELE1BQU1BLENBQUM1QyxLQUFLLEVBQUU7QUFDZCxJQUFBLElBQUksSUFBSSxDQUFDbEUsT0FBTyxLQUFLa0UsS0FBSyxFQUN0QixPQUFBO0lBRUosSUFBSSxDQUFDbEUsT0FBTyxHQUFHa0UsS0FBSyxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsU0FBUyxFQUFFLENBQUE7QUFDcEIsR0FBQTtFQUVBLElBQUkyQyxNQUFNQSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUM5RyxPQUFPLENBQUE7QUFDdkIsR0FBQTtFQUVBLElBQUkrRyxhQUFhQSxDQUFDN0MsS0FBSyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxJQUFJLENBQUNoRSxjQUFjLEtBQUtnRSxLQUFLLEVBQzdCLE9BQUE7SUFFSixJQUFJLENBQUNoRSxjQUFjLEdBQUdnRSxLQUFLLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxTQUFTLEVBQUUsQ0FBQTtBQUNwQixHQUFBO0VBRUEsSUFBSTRDLGFBQWFBLEdBQUc7SUFDaEIsT0FBTyxJQUFJLENBQUM3RyxjQUFjLENBQUE7QUFDOUIsR0FBQTtFQUVBLElBQUk4RyxhQUFhQSxDQUFDOUMsS0FBSyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxJQUFJLENBQUMvRCxjQUFjLEtBQUsrRCxLQUFLLEVBQzdCLE9BQUE7QUFFSixJQUFBLElBQUlBLEtBQUssQ0FBQzFHLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDbEIsTUFBTXlKLEdBQUcsR0FBRy9DLEtBQUssQ0FBQ2dELE1BQU0sQ0FBQ2hELEtBQUssQ0FBQzFHLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUMxQyxNQUFBLE1BQU0ySixNQUFNLEdBQUcsQ0FBQyxHQUFHakQsS0FBSyxDQUFDMUcsTUFBTSxDQUFBO0FBQy9CLE1BQUEsS0FBSyxJQUFJbUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHd0QsTUFBTSxFQUFFeEQsQ0FBQyxFQUFFLEVBQzNCTyxLQUFLLElBQUkrQyxHQUFHLENBQUE7QUFDcEIsS0FBQTtJQUNBLElBQUksQ0FBQzlHLGNBQWMsR0FBRytELEtBQUssQ0FBQTtJQUMzQixJQUFJLENBQUNDLFNBQVMsRUFBRSxDQUFBO0FBQ3BCLEdBQUE7RUFFQSxJQUFJNkMsYUFBYUEsR0FBRztJQUNoQixPQUFPLElBQUksQ0FBQzdHLGNBQWMsQ0FBQTtBQUM5QixHQUFBO0VBRUEsSUFBSWlILGVBQWVBLENBQUNsRCxLQUFLLEVBQUU7QUFDdkIsSUFBQSxJQUFJLElBQUksQ0FBQzlELGdCQUFnQixLQUFLOEQsS0FBSyxFQUMvQixPQUFBO0lBRUosSUFBSSxDQUFDOUQsZ0JBQWdCLEdBQUc4RCxLQUFLLENBQUE7QUFDN0IsSUFBQSxJQUFJLENBQUN6RCxtQkFBbUIsR0FBRyxDQUFDLENBQUN5RCxLQUFLLENBQUE7QUFDbEMsSUFBQSxJQUFJQSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMzRCxhQUFhLEVBQUU7TUFDOUIsSUFBSSxDQUFDOEcsWUFBWSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFDO01BQy9CLElBQUksQ0FBQzVHLGdCQUFnQixHQUFHLEtBQUssQ0FBQTtBQUNqQyxLQUFBO0lBQ0EsSUFBSSxDQUFDeUQsU0FBUyxFQUFFLENBQUE7QUFDcEIsR0FBQTtFQUVBLElBQUlpRCxlQUFlQSxHQUFHO0lBQ2xCLE9BQU8sSUFBSSxDQUFDaEgsZ0JBQWdCLENBQUE7QUFDaEMsR0FBQTtFQUVBLElBQUlpSCxZQUFZQSxDQUFDbkQsS0FBSyxFQUFFO0FBQ3BCLElBQUEsSUFBSSxJQUFJLENBQUMzRCxhQUFhLEtBQUsyRCxLQUFLLEVBQzVCLE9BQUE7SUFFSixNQUFNcUQsUUFBUSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUM5RyxtQkFBbUIsSUFBSXlELEtBQUssQ0FBQyxDQUFBO0lBQ3RELElBQUlxRCxRQUFRLElBQUksQ0FBQ3JELEtBQUssSUFBSSxJQUFJLENBQUMzRCxhQUFhLEVBQUU7TUFDMUMsSUFBSSxDQUFDQSxhQUFhLENBQUNpSCxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQ2pILGFBQWEsR0FBRzJELEtBQUssQ0FBQTtBQUM5QixLQUFBO0FBQ0EsSUFBQSxJQUFJLENBQUN4RCxnQkFBZ0IsR0FBRyxDQUFDLENBQUN3RCxLQUFLLENBQUE7QUFDL0IsSUFBQSxJQUFJQSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUM5RCxnQkFBZ0IsRUFBRTtBQUNqQyxNQUFBLElBQUksQ0FBQ2dILGVBQWUsR0FBRyxJQUFJckwsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO01BQzVDLElBQUksQ0FBQzBFLG1CQUFtQixHQUFHLEtBQUssQ0FBQTtBQUNwQyxLQUFBO0lBQ0EsSUFBSSxDQUFDMEQsU0FBUyxFQUFFLENBQUE7QUFDcEIsR0FBQTtFQUVBLElBQUlrRCxZQUFZQSxHQUFHO0lBQ2YsT0FBTyxJQUFJLENBQUM5RyxhQUFhLENBQUE7QUFDN0IsR0FBQTs7QUFFQTtBQUNBa0gsRUFBQUEsVUFBVUEsR0FBRztJQUNULElBQUksQ0FBQ25FLGdCQUFnQixHQUFHLElBQUksQ0FBQzNHLEtBQUssS0FBS2hCLHFCQUFxQixJQUFJLElBQUksQ0FBQ29ELFFBQVEsQ0FBQTtJQUM3RSxJQUFJLENBQUN3RSxhQUFhLEdBQUcsQ0FBQyxDQUFBO0lBQ3RCLElBQUksQ0FBQ1Asc0JBQXNCLEdBQUcsS0FBSyxDQUFBO0lBQ25DLElBQUksQ0FBQ0csZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLEdBQUE7O0FBRUE7QUFDQTtBQUNBTSxFQUFBQSxpQkFBaUJBLEdBQUc7SUFFaEIsSUFBSSxDQUFDQyxpQkFBaUIsRUFBRSxDQUFBO0lBRXhCLElBQUksSUFBSSxDQUFDekIsVUFBVSxFQUFFO0FBQ2pCLE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0EsVUFBVSxDQUFDeUYsTUFBTSxFQUFFO0FBQ3pCLFFBQUEsSUFBSSxDQUFDekYsVUFBVSxDQUFDN0UsT0FBTyxFQUFFLENBQUE7QUFDN0IsT0FBQTtNQUNBLElBQUksQ0FBQzZFLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFDMUIsS0FBQTtBQUVBLElBQUEsSUFBSSxJQUFJLENBQUNRLGdCQUFnQixLQUFLa0YsaUJBQWlCLEVBQUU7TUFDN0MsSUFBSSxDQUFDbEYsZ0JBQWdCLEdBQUdtRixzQkFBc0IsQ0FBQTtBQUNsRCxLQUFBO0lBRUEsSUFBSSxJQUFJLENBQUNqRixxQkFBcUIsRUFBRTtBQUM1QixNQUFBLEtBQUssSUFBSWdCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNoQixxQkFBcUIsQ0FBQ25GLE1BQU0sRUFBRW1HLENBQUMsRUFBRSxFQUFFO1FBQ3hELElBQUksSUFBSSxDQUFDaEIscUJBQXFCLENBQUNnQixDQUFDLENBQUMsS0FBS2dFLGlCQUFpQixFQUFFO0FBQ3JELFVBQUEsSUFBSSxDQUFDaEYscUJBQXFCLENBQUNnQixDQUFDLENBQUMsR0FBR2lFLHNCQUFzQixDQUFBO0FBQzFELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQUMsRUFBQUEsYUFBYUEsQ0FBQ3pMLE1BQU0sRUFBRUMsSUFBSSxFQUFFO0FBRXhCO0FBQ0EsSUFBQSxLQUFLLElBQUlzSCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDTixXQUFXLENBQUM3RixNQUFNLEVBQUVtRyxDQUFDLEVBQUUsRUFBRTtBQUM5QyxNQUFBLE1BQU1tRSxPQUFPLEdBQUcsSUFBSSxDQUFDekUsV0FBVyxDQUFDTSxDQUFDLENBQUMsQ0FBQTtNQUNuQyxJQUFJbUUsT0FBTyxDQUFDMUwsTUFBTSxLQUFLQSxNQUFNLElBQUkwTCxPQUFPLENBQUN6TCxJQUFJLEtBQUtBLElBQUksRUFBRTtBQUNwRCxRQUFBLE9BQU95TCxPQUFPLENBQUE7QUFDbEIsT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJOUwsZUFBZSxDQUFDLElBQUksQ0FBQ0UsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMvRCxJQUFBLElBQUksQ0FBQ2dILFdBQVcsQ0FBQzJFLElBQUksQ0FBQ0QsRUFBRSxDQUFDLENBQUE7QUFDekIsSUFBQSxPQUFPQSxFQUFFLENBQUE7QUFDYixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSXZKLEVBQUFBLEtBQUtBLEdBQUc7QUFDSixJQUFBLE1BQU1BLEtBQUssR0FBRyxJQUFJUixLQUFLLENBQUMsSUFBSSxDQUFDN0IsTUFBTSxFQUFFLElBQUksQ0FBQytCLGlCQUFpQixDQUFDLENBQUE7O0FBRTVEO0FBQ0FNLElBQUFBLEtBQUssQ0FBQytGLElBQUksR0FBRyxJQUFJLENBQUM1SCxLQUFLLENBQUE7QUFDdkI2QixJQUFBQSxLQUFLLENBQUN5SixRQUFRLENBQUMsSUFBSSxDQUFDeEosTUFBTSxDQUFDLENBQUE7QUFDM0JELElBQUFBLEtBQUssQ0FBQ2lJLFNBQVMsR0FBRyxJQUFJLENBQUM5SCxVQUFVLENBQUE7QUFDakNILElBQUFBLEtBQUssQ0FBQ2tJLGlCQUFpQixHQUFHLElBQUksQ0FBQzlILGtCQUFrQixDQUFBO0FBQ2pESixJQUFBQSxLQUFLLENBQUNtSSxTQUFTLEdBQUcsSUFBSSxDQUFDOUgsVUFBVSxDQUFBO0FBQ2pDTCxJQUFBQSxLQUFLLENBQUNnSCxXQUFXLEdBQUcsSUFBSSxDQUFDQSxXQUFXLENBQUE7QUFDcENoSCxJQUFBQSxLQUFLLENBQUNPLFFBQVEsR0FBRyxJQUFJLENBQUNBLFFBQVEsQ0FBQTs7QUFFOUI7QUFDQVAsSUFBQUEsS0FBSyxDQUFDZSxnQkFBZ0IsR0FBRyxJQUFJLENBQUNBLGdCQUFnQixDQUFBO0FBQzlDZixJQUFBQSxLQUFLLENBQUNnQixjQUFjLEdBQUcsSUFBSSxDQUFDQSxjQUFjLENBQUE7QUFDMUNoQixJQUFBQSxLQUFLLENBQUN3SCxXQUFXLEdBQUcsSUFBSSxDQUFDdkcsWUFBWSxDQUFBO0FBQ3JDakIsSUFBQUEsS0FBSyxDQUFDaUcsVUFBVSxHQUFHLElBQUksQ0FBQy9ILFdBQVcsQ0FBQTtBQUNuQzhCLElBQUFBLEtBQUssQ0FBQ3NILFdBQVcsR0FBRyxJQUFJLENBQUNsRyxZQUFZLENBQUE7QUFDckNwQixJQUFBQSxLQUFLLENBQUNxQixXQUFXLEdBQUcsSUFBSSxDQUFDQSxXQUFXLENBQUE7QUFDcENyQixJQUFBQSxLQUFLLENBQUN1QixPQUFPLEdBQUcsSUFBSSxDQUFDQSxPQUFPLENBQUE7QUFDNUJ2QixJQUFBQSxLQUFLLENBQUMySCxZQUFZLEdBQUcsSUFBSSxDQUFDQSxZQUFZLENBQUE7QUFDdEMzSCxJQUFBQSxLQUFLLENBQUNpRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUNBLGdCQUFnQixDQUFBO0FBQzlDakUsSUFBQUEsS0FBSyxDQUFDNkYsSUFBSSxHQUFHLElBQUksQ0FBQ0EsSUFBSSxDQUFBO0lBRXRCLElBQUksSUFBSSxDQUFDMUIscUJBQXFCLEVBQUU7TUFDNUJuRSxLQUFLLENBQUNtRSxxQkFBcUIsR0FBRyxJQUFJLENBQUNBLHFCQUFxQixDQUFDdUYsS0FBSyxFQUFFLENBQUE7QUFDcEUsS0FBQTs7QUFFQTtBQUNBMUosSUFBQUEsS0FBSyxDQUFDeUgsY0FBYyxHQUFHLElBQUksQ0FBQ3RGLGVBQWUsQ0FBQTtBQUMzQ25DLElBQUFBLEtBQUssQ0FBQzBILGNBQWMsR0FBRyxJQUFJLENBQUN0RixlQUFlLENBQUE7O0FBRTNDO0FBQ0FwQyxJQUFBQSxLQUFLLENBQUN3QyxXQUFXLEdBQUcsSUFBSSxDQUFDQSxXQUFXLENBQUE7QUFDcEN4QyxJQUFBQSxLQUFLLENBQUN5QyxtQkFBbUIsR0FBRyxJQUFJLENBQUNBLG1CQUFtQixDQUFBOztBQUVwRDtBQUNBekMsSUFBQUEsS0FBSyxDQUFDa0csS0FBSyxHQUFHLElBQUksQ0FBQ3hELE1BQU0sQ0FBQTs7QUFFekI7SUFDQTFDLEtBQUssQ0FBQ0gsZ0JBQWdCLENBQUM4SixJQUFJLENBQUMsSUFBSSxDQUFDOUosZ0JBQWdCLENBQUMsQ0FBQTtBQUNsREcsSUFBQUEsS0FBSyxDQUFDeUYsVUFBVSxHQUFHLElBQUksQ0FBQ0EsVUFBVSxDQUFBO0FBQ2xDekYsSUFBQUEsS0FBSyxDQUFDdUgsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDdkQsaUJBQWlCLENBQUE7QUFDL0NoRSxJQUFBQSxLQUFLLENBQUNrSCxnQkFBZ0IsR0FBRyxJQUFJLENBQUNyRCxpQkFBaUIsQ0FBQTtBQUMvQzdELElBQUFBLEtBQUssQ0FBQzRELGNBQWMsR0FBRyxJQUFJLENBQUNBLGNBQWMsQ0FBQTtBQUMxQzVELElBQUFBLEtBQUssQ0FBQytELGVBQWUsR0FBRyxJQUFJLENBQUNBLGVBQWUsQ0FBQTs7QUFFNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsSUFBQSxPQUFPL0QsS0FBSyxDQUFBO0FBQ2hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsT0FBTzRKLHNCQUFzQkEsQ0FBQzdELElBQUksRUFBRThELFVBQVUsR0FBRy9HLElBQUksQ0FBQ08sRUFBRSxHQUFHLENBQUMsRUFBRXlHLFVBQVUsR0FBRyxDQUFDLEVBQUU7QUFDMUUsSUFBQSxRQUFRL0QsSUFBSTtBQUNSLE1BQUEsS0FBSzFJLGNBQWM7QUFBRSxRQUFBO0FBQ2pCLFVBQUEsTUFBTTBNLFVBQVUsR0FBR2pILElBQUksQ0FBQ00sR0FBRyxDQUFDeUcsVUFBVSxDQUFDLENBQUE7QUFDdkMsVUFBQSxNQUFNRyxZQUFZLEdBQUdsSCxJQUFJLENBQUNNLEdBQUcsQ0FBQzBHLFVBQVUsQ0FBQyxDQUFBOztBQUV6QztBQUNBLFVBQUEsT0FBUSxDQUFDLEdBQUdoSCxJQUFJLENBQUNPLEVBQUUsSUFBSyxDQUFDLEdBQUcyRyxZQUFZLEdBQUksQ0FBQ0EsWUFBWSxHQUFHRCxVQUFVLElBQUksR0FBRyxDQUFDLENBQUE7QUFDbEYsU0FBQTtBQUNBLE1BQUEsS0FBSzNNLGNBQWM7QUFDZjtBQUNBLFFBQUEsT0FBUSxDQUFDLEdBQUcwRixJQUFJLENBQUNPLEVBQUUsQ0FBQTtBQUN2QixNQUFBLEtBQUtsRyxxQkFBcUI7QUFDdEI7QUFDQSxRQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ2hCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0E7QUFDQTtFQUNBOE0scUJBQXFCQSxDQUFDQyxlQUFlLEVBQUU7QUFFbkMsSUFBQSxNQUFNQyxPQUFPLEdBQUdELGVBQWUsQ0FBQ25NLFlBQVksQ0FBQ3FNLFFBQVEsQ0FBQTtJQUVyRCxRQUFRLElBQUksQ0FBQ2pNLEtBQUs7QUFDZCxNQUFBLEtBQUtmLGNBQWM7QUFDZlYsUUFBQUEsU0FBUyxDQUFDQyxJQUFJLEdBQUcsSUFBSSxDQUFDOEksVUFBVSxDQUFBO0FBQ2hDL0ksUUFBQUEsU0FBUyxDQUFDRSxVQUFVLEdBQUcsSUFBSSxDQUFDb0gsaUJBQWlCLENBQUE7QUFDN0MsUUFBQSxNQUFBO0FBQ0osTUFBQSxLQUFLM0csY0FBYztRQUNmLElBQUksSUFBSSxDQUFDZ0gsTUFBTSxFQUFFO0FBQ2IzSCxVQUFBQSxTQUFTLENBQUNDLElBQUksR0FBRyxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDbEMsU0FBQyxNQUFNO1VBQ0hELFNBQVMsQ0FBQ0MsSUFBSSxHQUFHLElBQUksQ0FBQzhJLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDdEMsVUFBQSxJQUFJLElBQUksQ0FBQzlILE1BQU0sQ0FBQzBNLFFBQVEsSUFBSSxJQUFJLENBQUMxTSxNQUFNLENBQUMyTSxzQkFBc0IsRUFBRTVOLFNBQVMsQ0FBQ0MsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFBO0FBQzFGLFNBQUE7UUFDQUQsU0FBUyxDQUFDRSxVQUFVLEdBQUcsSUFBSSxDQUFDeUgsTUFBTSxHQUFHLElBQUksQ0FBQzlDLE9BQU8sSUFBSSxJQUFJLENBQUNQLGNBQWMsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUNnRCxpQkFBaUIsQ0FBQTtBQUN4RyxRQUFBLE1BQUE7QUFDSixNQUFBLEtBQUs3RyxxQkFBcUI7QUFDdEI7QUFDQTtRQUNBLElBQUksSUFBSSxDQUFDa0gsTUFBTSxFQUFFO0FBQ2IzSCxVQUFBQSxTQUFTLENBQUNDLElBQUksR0FBRyxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDbEMsU0FBQyxNQUFNO1VBQ0hELFNBQVMsQ0FBQ0MsSUFBSSxHQUFJLElBQUksQ0FBQzhJLFVBQVUsR0FBRzBFLE9BQU8sR0FBSSxHQUFHLENBQUE7QUFDbEQsVUFBQSxJQUFJLElBQUksQ0FBQ3hNLE1BQU0sQ0FBQzBNLFFBQVEsSUFBSSxJQUFJLENBQUMxTSxNQUFNLENBQUMyTSxzQkFBc0IsRUFBRTVOLFNBQVMsQ0FBQ0MsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFBO0FBQzFGLFNBQUE7QUFDQUQsUUFBQUEsU0FBUyxDQUFDRSxVQUFVLEdBQUcsSUFBSSxDQUFDeUgsTUFBTSxHQUFHLElBQUksQ0FBQzlDLE9BQU8sSUFBSTRJLE9BQU8sR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUNuRyxpQkFBaUIsQ0FBQTtBQUM1RixRQUFBLE1BQUE7QUFDUixLQUFBO0FBRUEsSUFBQSxPQUFPdEgsU0FBUyxDQUFBO0FBQ3BCLEdBQUE7QUFFQTZOLEVBQUFBLFFBQVFBLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQ3RLLE1BQU0sQ0FBQTtBQUN0QixHQUFBO0VBRUF1SyxpQkFBaUJBLENBQUNDLE1BQU0sRUFBRTtBQUN0QixJQUFBLElBQUksSUFBSSxDQUFDdE0sS0FBSyxLQUFLZCxjQUFjLEVBQUU7QUFFL0I7QUFDQSxNQUFBLE1BQU1xTixJQUFJLEdBQUcsSUFBSSxDQUFDMUosY0FBYyxDQUFBO0FBQ2hDLE1BQUEsTUFBTTRHLEtBQUssR0FBRyxJQUFJLENBQUN4RixlQUFlLENBQUE7QUFDbEMsTUFBQSxNQUFNdUksUUFBUSxHQUFHLElBQUksQ0FBQzdDLGtCQUFrQixDQUFBO0FBQ3hDLE1BQUEsTUFBTThDLElBQUksR0FBRyxJQUFJLENBQUNoRyxLQUFLLENBQUE7QUFDdkJwSSxNQUFBQSxNQUFNLENBQUNtTixJQUFJLENBQUNpQixJQUFJLENBQUNDLEVBQUUsQ0FBQyxDQUFBO01BRXBCLElBQUlqRCxLQUFLLEdBQUcsRUFBRSxFQUFFO0FBQ1o2QyxRQUFBQSxNQUFNLENBQUNLLE1BQU0sR0FBR0osSUFBSSxHQUFHLElBQUksQ0FBQzNDLGtCQUFrQixDQUFBO0FBQzlDdkwsUUFBQUEsTUFBTSxDQUFDdU8sU0FBUyxDQUFDLENBQUNMLElBQUksR0FBR0MsUUFBUSxDQUFDLENBQUE7QUFDdEMsT0FBQyxNQUFNO1FBQ0hGLE1BQU0sQ0FBQ0ssTUFBTSxHQUFHSixJQUFJLElBQUksQ0FBQyxHQUFHQyxRQUFRLENBQUMsQ0FBQTtBQUNyQ25PLFFBQUFBLE1BQU0sQ0FBQ3VPLFNBQVMsQ0FBQyxDQUFDTixNQUFNLENBQUNLLE1BQU0sQ0FBQyxDQUFBO0FBQ3BDLE9BQUE7QUFFQUwsTUFBQUEsTUFBTSxDQUFDTyxNQUFNLENBQUNDLElBQUksQ0FBQ0wsSUFBSSxDQUFDTSxXQUFXLEVBQUUsRUFBRTFPLE1BQU0sQ0FBQyxDQUFBO0FBRWxELEtBQUMsTUFBTSxJQUFJLElBQUksQ0FBQzJCLEtBQUssS0FBS2YsY0FBYyxFQUFFO01BQ3RDcU4sTUFBTSxDQUFDTyxNQUFNLEdBQUcsSUFBSSxDQUFDcEcsS0FBSyxDQUFDc0csV0FBVyxFQUFFLENBQUE7QUFDeENULE1BQUFBLE1BQU0sQ0FBQ0ssTUFBTSxHQUFHLElBQUksQ0FBQzlKLGNBQWMsQ0FBQTtBQUN2QyxLQUFBO0FBQ0osR0FBQTtFQUVBbUssY0FBY0EsQ0FBQ0MsR0FBRyxFQUFFO0FBQ2hCLElBQUEsSUFBSSxJQUFJLENBQUNqTixLQUFLLEtBQUtkLGNBQWMsRUFBRTtBQUMvQixNQUFBLE1BQU1nTyxLQUFLLEdBQUcsSUFBSSxDQUFDckssY0FBYyxDQUFBO0FBQ2pDLE1BQUEsTUFBTTRHLEtBQUssR0FBRyxJQUFJLENBQUN4RixlQUFlLENBQUE7QUFDbEMsTUFBQSxNQUFNd0ksSUFBSSxHQUFHLElBQUksQ0FBQ2hHLEtBQUssQ0FBQTtBQUV2QixNQUFBLE1BQU0wRyxHQUFHLEdBQUd4SSxJQUFJLENBQUN5SSxHQUFHLENBQUN6SSxJQUFJLENBQUNrRixHQUFHLENBQUNKLEtBQUssR0FBRzRELElBQUksQ0FBQ0MsVUFBVSxDQUFDLEdBQUdKLEtBQUssQ0FBQyxDQUFBO0FBRS9ERCxNQUFBQSxHQUFHLENBQUNKLE1BQU0sQ0FBQ2hDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQ3FDLEtBQUssR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDbENELE1BQUFBLEdBQUcsQ0FBQ00sV0FBVyxDQUFDMUMsR0FBRyxDQUFDc0MsR0FBRyxFQUFFRCxLQUFLLEdBQUcsR0FBRyxFQUFFQyxHQUFHLENBQUMsQ0FBQTtBQUUxQ0YsTUFBQUEsR0FBRyxDQUFDTyxzQkFBc0IsQ0FBQ1AsR0FBRyxFQUFFUixJQUFJLENBQUNnQixpQkFBaUIsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBRW5FLEtBQUMsTUFBTSxJQUFJLElBQUksQ0FBQ3pOLEtBQUssS0FBS2YsY0FBYyxFQUFFO0FBQ3RDZ08sTUFBQUEsR0FBRyxDQUFDSixNQUFNLENBQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDL0UsS0FBSyxDQUFDc0csV0FBVyxFQUFFLENBQUMsQ0FBQTtBQUN6Q0UsTUFBQUEsR0FBRyxDQUFDTSxXQUFXLENBQUMxQyxHQUFHLENBQUMsSUFBSSxDQUFDaEksY0FBYyxFQUFFLElBQUksQ0FBQ0EsY0FBYyxFQUFFLElBQUksQ0FBQ0EsY0FBYyxDQUFDLENBQUE7QUFDdEYsS0FBQTtBQUNKLEdBQUE7QUFFQWdFLEVBQUFBLGlCQUFpQkEsR0FBRztBQUNoQixJQUFBLE1BQU1ySCxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7QUFDMUIsSUFBQSxJQUFJQSxNQUFNLENBQUNrTyxRQUFRLElBQUlsTyxNQUFNLENBQUNtTyxRQUFRLEVBQUU7TUFDcEMsSUFBSSxJQUFJLENBQUMzTixLQUFLLEtBQUtmLGNBQWMsSUFBSSxDQUFDLElBQUksQ0FBQ3NDLGlCQUFpQixFQUFFO0FBQzFELFFBQUEsSUFBSSxDQUFDRyxnQkFBZ0IsQ0FBQ2tNLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDbkMsUUFBQSxJQUFJLENBQUNsTSxnQkFBZ0IsQ0FBQ21NLGNBQWMsR0FBRyxDQUFDLENBQUE7QUFDNUMsT0FBQyxNQUFNO0FBQ0gsUUFBQSxNQUFNclAsSUFBSSxHQUFHLElBQUksQ0FBQzhJLFVBQVUsR0FBRyxDQUFDLE1BQU0sQ0FBQTtBQUN0QyxRQUFBLElBQUksQ0FBQzVGLGdCQUFnQixDQUFDa00sU0FBUyxHQUFHcFAsSUFBSSxDQUFBO0FBQ3RDLFFBQUEsSUFBSSxDQUFDa0QsZ0JBQWdCLENBQUNtTSxjQUFjLEdBQUdyUCxJQUFJLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUF5SixFQUFBQSxpQkFBaUJBLEdBQUc7QUFDaEIsSUFBQSxNQUFNNkYsS0FBSyxHQUFHLElBQUksQ0FBQ2hNLE1BQU0sQ0FBQTtBQUN6QixJQUFBLE1BQU1uRCxDQUFDLEdBQUdtUCxLQUFLLENBQUNuUCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNQyxDQUFDLEdBQUdrUCxLQUFLLENBQUNsUCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNQyxDQUFDLEdBQUdpUCxLQUFLLENBQUNqUCxDQUFDLENBQUE7QUFFakIsSUFBQSxJQUFJbUksQ0FBQyxHQUFHLElBQUksQ0FBQ2hGLFVBQVUsQ0FBQTs7QUFFdkI7SUFDQSxJQUFJLElBQUksQ0FBQ29ELGlCQUFpQixFQUFFO0FBQ3hCNEIsTUFBQUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlFLFVBQVUsR0FBR2IsS0FBSyxDQUFDb0ssc0JBQXNCLENBQUMsSUFBSSxDQUFDekwsS0FBSyxFQUFFLElBQUksQ0FBQ2lFLGVBQWUsR0FBR29KLElBQUksQ0FBQ0MsVUFBVSxFQUFFLElBQUksQ0FBQ3RKLGVBQWUsR0FBR3FKLElBQUksQ0FBQ0MsVUFBVSxDQUFDLENBQUE7QUFDbEosS0FBQTtBQUVBLElBQUEsTUFBTVMsVUFBVSxHQUFHLElBQUksQ0FBQ3RKLFdBQVcsQ0FBQTtBQUNuQyxJQUFBLE1BQU11SixnQkFBZ0IsR0FBRyxJQUFJLENBQUNuSixpQkFBaUIsQ0FBQTtBQUUvQ2tKLElBQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBR3BQLENBQUMsR0FBR3FJLENBQUMsQ0FBQTtBQUNyQitHLElBQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBR25QLENBQUMsR0FBR29JLENBQUMsQ0FBQTtBQUNyQitHLElBQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBR2xQLENBQUMsR0FBR21JLENBQUMsQ0FBQTtJQUNyQixJQUFJQSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ1JnSCxNQUFBQSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBR3JKLElBQUksQ0FBQ0MsR0FBRyxDQUFDakcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHcUksQ0FBQyxDQUFBO0FBQzFDZ0gsTUFBQUEsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEdBQUdySixJQUFJLENBQUNDLEdBQUcsQ0FBQ2hHLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBR29JLENBQUMsQ0FBQTtBQUMxQ2dILE1BQUFBLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxHQUFHckosSUFBSSxDQUFDQyxHQUFHLENBQUMvRixDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUdtSSxDQUFDLENBQUE7QUFDOUMsS0FBQyxNQUFNO0FBQ0hnSCxNQUFBQSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBR3JKLElBQUksQ0FBQ0MsR0FBRyxDQUFDbUosVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2xEQyxNQUFBQSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBR3JKLElBQUksQ0FBQ0MsR0FBRyxDQUFDbUosVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2xEQyxNQUFBQSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBR3JKLElBQUksQ0FBQ0MsR0FBRyxDQUFDbUosVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ3RELEtBQUE7QUFDSixHQUFBO0FBRUF6QyxFQUFBQSxRQUFRQSxHQUFHO0FBQ1AsSUFBQSxJQUFJMkMsU0FBUyxDQUFDcE4sTUFBTSxLQUFLLENBQUMsRUFBRTtNQUN4QixJQUFJLENBQUNpQixNQUFNLENBQUMrSSxHQUFHLENBQUNvRCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUN0UCxDQUFDLEVBQUVzUCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNyUCxDQUFDLEVBQUVxUCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNwUCxDQUFDLENBQUMsQ0FBQTtBQUNuRSxLQUFDLE1BQU0sSUFBSW9QLFNBQVMsQ0FBQ3BOLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDL0IsTUFBQSxJQUFJLENBQUNpQixNQUFNLENBQUMrSSxHQUFHLENBQUNvRCxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRUEsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0QsS0FBQTtJQUVBLElBQUksQ0FBQ2hHLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsR0FBQTtBQUVBVyxFQUFBQSxXQUFXQSxHQUFHO0FBQ1YsSUFBQSxJQUFJLENBQUNwSCxNQUFNLENBQUNkLE9BQU8sQ0FBRXdHLEtBQUssSUFBSztNQUMzQkEsS0FBSyxDQUFDZ0gsZUFBZSxFQUFFLENBQUE7QUFDM0IsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTFHLEVBQUFBLFNBQVNBLEdBQUc7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDQSxJQUFJaEYsR0FBRyxHQUNDLElBQUksQ0FBQ3hDLEtBQUssSUFBbUMsRUFBRSxHQUMvQyxDQUFDLElBQUksQ0FBQ21DLFlBQVksR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFtQixFQUFHLEdBQ2hELElBQUksQ0FBQ3BDLFdBQVcsSUFBNkIsRUFBRyxHQUNoRCxJQUFJLENBQUMrQyxZQUFZLElBQTRCLEVBQUcsR0FDaEQsQ0FBQyxJQUFJLENBQUMrQyxpQkFBaUIsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBTSxFQUFHLEdBQ2hELENBQUMsSUFBSSxDQUFDeEMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQXdCLEVBQUcsR0FDaEQsQ0FBQyxJQUFJLENBQUNFLGNBQWMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFpQixFQUFHLEdBQ2hEN0UsTUFBTSxDQUFDLElBQUksQ0FBQzhFLGNBQWMsQ0FBQytHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFRLEVBQUcsR0FDaEQsQ0FBQyxJQUFJLENBQUM5RyxnQkFBZ0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFlLEVBQUcsR0FDL0MsSUFBSSxDQUFDYyxNQUFNLElBQWlDLEVBQUcsR0FDL0MsSUFBSSxDQUFDRixXQUFXLEdBQUcsQ0FBQyxJQUF5QixDQUFFLEdBQ2hELENBQUMsSUFBSSxDQUFDMEYsaUJBQWlCLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBZSxDQUFFLEdBQy9DLElBQUksQ0FBQ3JDLElBQUksSUFBb0MsQ0FBRSxDQUFBO0FBRXhELElBQUEsSUFBSSxJQUFJLENBQUNsRSxjQUFjLENBQUMzQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ2xDMkIsTUFBQUEsR0FBRyxJQUFLOUQsTUFBTSxDQUFDLElBQUksQ0FBQzhFLGNBQWMsQ0FBQytHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUcsQ0FBQTtBQUNwRC9ILE1BQUFBLEdBQUcsSUFBSzlELE1BQU0sQ0FBQyxJQUFJLENBQUM4RSxjQUFjLENBQUMrRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFHLENBQUE7QUFDeEQsS0FBQTtBQUVBLElBQUEsSUFBSS9ILEdBQUcsS0FBSyxJQUFJLENBQUNBLEdBQUcsRUFBRTtBQUNsQjtNQUNBLElBQUksQ0FBQ29HLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLEtBQUE7SUFFQSxJQUFJLENBQUNwRyxHQUFHLEdBQUdBLEdBQUcsQ0FBQTtBQUNsQixHQUFBO0FBQ0o7Ozs7In0=
