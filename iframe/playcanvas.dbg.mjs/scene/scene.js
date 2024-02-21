import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../platform/graphics/constants.js';
import { BAKE_COLORDIR, FOG_NONE, GAMMA_SRGB, LAYERID_IMMEDIATE } from './constants.js';
import { LightingParams } from './lighting/lighting-params.js';
import { Sky } from './skybox/sky.js';
import { Immediate } from './immediate/immediate.js';
import { EnvLighting } from './graphics/env-lighting.js';

/**
 * A scene is graphical representation of an environment. It manages the scene hierarchy, all
 * graphical objects, lights, and scene-wide properties.
 *
 * @augments EventHandler
 * @category Graphics
 */
class Scene extends EventHandler {
  /**
   * Create a new Scene instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device used to manage this scene.
   * @hideconstructor
   */
  constructor(graphicsDevice) {
    super();
    /**
     * If enabled, the ambient lighting will be baked into lightmaps. This will be either the
     * {@link Scene#skybox} if set up, otherwise {@link Scene#ambientLight}. Defaults to false.
     *
     * @type {boolean}
     */
    this.ambientBake = false;
    /**
     * If {@link Scene#ambientBake} is true, this specifies the brightness of ambient occlusion.
     * Typical range is -1 to 1. Defaults to 0, representing no change to brightness.
     *
     * @type {number}
     */
    this.ambientBakeOcclusionBrightness = 0;
    /**
     * If {@link Scene#ambientBake} is true, this specifies the contrast of ambient occlusion.
     * Typical range is -1 to 1. Defaults to 0, representing no change to contrast.
     *
     * @type {number}
     */
    this.ambientBakeOcclusionContrast = 0;
    /**
     * The color of the scene's ambient light. Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    this.ambientLight = new Color(0, 0, 0);
    /**
     * The luminosity of the scene's ambient light in lux (lm/m^2). Used if physicalUnits is true. Defaults to 0.
     *
     * @type {number}
     */
    this.ambientLuminance = 0;
    /**
     * The exposure value tweaks the overall brightness of the scene. Ignored if physicalUnits is true. Defaults to 1.
     *
     * @type {number}
     */
    this.exposure = 1;
    /**
     * The color of the fog (if enabled). Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    this.fogColor = new Color(0, 0, 0);
    /**
     * The density of the fog (if enabled). This property is only valid if the fog property is set
     * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
     *
     * @type {number}
     */
    this.fogDensity = 0;
    /**
     * The distance from the viewpoint where linear fog reaches its maximum. This property is only
     * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
     *
     * @type {number}
     */
    this.fogEnd = 1000;
    /**
     * The distance from the viewpoint where linear fog begins. This property is only valid if the
     * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
     *
     * @type {number}
     */
    this.fogStart = 1;
    /**
     * The lightmap resolution multiplier. Defaults to 1.
     *
     * @type {number}
     */
    this.lightmapSizeMultiplier = 1;
    /**
     * The maximum lightmap resolution. Defaults to 2048.
     *
     * @type {number}
     */
    this.lightmapMaxResolution = 2048;
    /**
     * The lightmap baking mode. Can be:
     *
     * - {@link BAKE_COLOR}: single color lightmap
     * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump or
     * specular). Only lights with bakeDir=true will be used for generating the dominant light
     * direction.
     *
     * Defaults to {@link BAKE_COLORDIR}.
     *
     * @type {number}
     */
    this.lightmapMode = BAKE_COLORDIR;
    /**
     * Enables bilateral filter on runtime baked color lightmaps, which removes the noise and
     * banding while preserving the edges. Defaults to false. Note that the filtering takes place
     * in the image space of the lightmap, and it does not filter across lightmap UV space seams,
     * often making the seams more visible. It's important to balance the strength of the filter
     * with number of samples used for lightmap baking to limit the visible artifacts.
     *
     * @type {boolean}
     */
    this.lightmapFilterEnabled = false;
    /**
     * Enables HDR lightmaps. This can result in smoother lightmaps especially when many samples
     * are used. Defaults to false.
     *
     * @type {boolean}
     */
    this.lightmapHDR = false;
    /**
     * The root entity of the scene, which is usually the only child to the {@link Application}
     * root entity.
     *
     * @type {import('../framework/entity.js').Entity}
     */
    this.root = null;
    /**
     * Use physically based units for cameras and lights. When used, the exposure value is ignored.
     *
     * @type {boolean}
     */
    this.physicalUnits = false;
    /**
     * Environment lighting atlas
     *
     * @type {import('../platform/graphics/texture.js').Texture|null}
     * @private
     */
    this._envAtlas = null;
    /**
     * The skybox cubemap as set by user (gets used when skyboxMip === 0)
     *
     * @type {import('../platform/graphics/texture.js').Texture|null}
     * @private
     */
    this._skyboxCubeMap = null;
    Debug.assert(graphicsDevice, "Scene constructor takes a GraphicsDevice as a parameter, and it was not provided.");
    this.device = graphicsDevice;
    this._gravity = new Vec3(0, -9.8, 0);

    /**
     * @type {import('./composition/layer-composition.js').LayerComposition}
     * @private
     */
    this._layers = null;
    this._fog = FOG_NONE;
    this._gammaCorrection = GAMMA_SRGB;
    this._toneMapping = 0;

    /**
     * Array of 6 prefiltered lighting data cubemaps.
     *
     * @type {import('../platform/graphics/texture.js').Texture[]}
     * @private
     */
    this._prefilteredCubemaps = [];

    // internally generated envAtlas owned by the scene
    this._internalEnvAtlas = null;
    this._skyboxIntensity = 1;
    this._skyboxLuminance = 0;
    this._skyboxMip = 0;
    this._skyboxRotationShaderInclude = false;
    this._skyboxRotation = new Quat();
    this._skyboxRotationMat3 = new Mat3();
    this._skyboxRotationMat4 = new Mat4();

    // ambient light lightmapping properties
    this._ambientBakeNumSamples = 1;
    this._ambientBakeSpherePart = 0.4;
    this._lightmapFilterRange = 10;
    this._lightmapFilterSmoothness = 0.2;

    // clustered lighting
    this._clusteredLightingEnabled = true;
    this._lightingParams = new LightingParams(this.device.supportsAreaLights, this.device.maxTextureSize, () => {
      this.updateShaders = true;
    });

    // skybox
    this._sky = new Sky(this);
    this._stats = {
      meshInstances: 0,
      lights: 0,
      dynamicLights: 0,
      bakedLights: 0,
      updateShadersTime: 0 // deprecated
    };

    /**
     * This flag indicates changes were made to the scene which may require recompilation of
     * shaders that reference global settings.
     *
     * @type {boolean}
     * @ignore
     */
    this.updateShaders = true;
    this._shaderVersion = 0;

    // immediate rendering
    this.immediate = new Immediate(this.device);
  }

  /**
   * Returns the default layer used by the immediate drawing functions.
   *
   * @type {import('./layer.js').Layer}
   * @private
   */
  get defaultDrawLayer() {
    return this.layers.getLayerById(LAYERID_IMMEDIATE);
  }

  /**
   * If {@link Scene#ambientBake} is true, this specifies the number of samples used to bake the
   * ambient light into the lightmap. Defaults to 1. Maximum value is 255.
   *
   * @type {number}
   */
  set ambientBakeNumSamples(value) {
    this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
  }
  get ambientBakeNumSamples() {
    return this._ambientBakeNumSamples;
  }

  /**
   * If {@link Scene#ambientBake} is true, this specifies a part of the sphere which represents
   * the source of ambient light. The valid range is 0..1, representing a part of the sphere from
   * top to the bottom. A value of 0.5 represents the upper hemisphere. A value of 1 represents a
   * full sphere. Defaults to 0.4, which is a smaller upper hemisphere as this requires fewer
   * samples to bake.
   *
   * @type {number}
   */
  set ambientBakeSpherePart(value) {
    this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
  }
  get ambientBakeSpherePart() {
    return this._ambientBakeSpherePart;
  }

  /**
   * True if the clustered lighting is enabled. Set to false before the first frame is rendered
   * to use non-clustered lighting. Defaults to true.
   *
   * @type {boolean}
   */
  set clusteredLightingEnabled(value) {
    if (this.device.isWebGPU && !value) {
      Debug.warnOnce('WebGPU currently only supports clustered lighting, and this cannot be disabled.');
      return;
    }
    if (!this._clusteredLightingEnabled && value) {
      console.error('Turning on disabled clustered lighting is not currently supported');
      return;
    }
    this._clusteredLightingEnabled = value;
  }
  get clusteredLightingEnabled() {
    return this._clusteredLightingEnabled;
  }

  /**
   * The environment lighting atlas.
   *
   * @type {import('../platform/graphics/texture.js').Texture}
   */
  set envAtlas(value) {
    if (value !== this._envAtlas) {
      this._envAtlas = value;

      // make sure required options are set up on the texture
      if (value) {
        value.addressU = ADDRESS_CLAMP_TO_EDGE;
        value.addressV = ADDRESS_CLAMP_TO_EDGE;
        value.minFilter = FILTER_LINEAR;
        value.magFilter = FILTER_LINEAR;
        value.mipmaps = false;
      }
      this._prefilteredCubemaps = [];
      if (this._internalEnvAtlas) {
        this._internalEnvAtlas.destroy();
        this._internalEnvAtlas = null;
      }
      this._resetSkyMesh();
    }
  }
  get envAtlas() {
    return this._envAtlas;
  }

  /**
   * The type of fog used by the scene. Can be:
   *
   * - {@link FOG_NONE}
   * - {@link FOG_LINEAR}
   * - {@link FOG_EXP}
   * - {@link FOG_EXP2}
   *
   * Defaults to {@link FOG_NONE}.
   *
   * @type {string}
   */
  set fog(type) {
    if (type !== this._fog) {
      this._fog = type;
      this.updateShaders = true;
    }
  }
  get fog() {
    return this._fog;
  }

  /**
   * The gamma correction to apply when rendering the scene. Can be:
   *
   * - {@link GAMMA_NONE}
   * - {@link GAMMA_SRGB}
   *
   * Defaults to {@link GAMMA_SRGB}.
   *
   * @type {number}
   */
  set gammaCorrection(value) {
    if (value !== this._gammaCorrection) {
      this._gammaCorrection = value;
      this.updateShaders = true;
    }
  }
  get gammaCorrection() {
    return this._gammaCorrection;
  }

  /**
   * A {@link LayerComposition} that defines rendering order of this scene.
   *
   * @type {import('./composition/layer-composition.js').LayerComposition}
   */
  set layers(layers) {
    const prev = this._layers;
    this._layers = layers;
    this.fire('set:layers', prev, layers);
  }
  get layers() {
    return this._layers;
  }
  get sky() {
    return this._sky;
  }

  /**
   * A {@link LightingParams} that defines lighting parameters.
   *
   * @type {LightingParams}
   */
  get lighting() {
    return this._lightingParams;
  }

  /**
   * A range parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
   * is enabled. Larger value applies more widespread blur. This needs to be a positive non-zero
   * value. Defaults to 10.
   *
   * @type {number}
   */
  set lightmapFilterRange(value) {
    this._lightmapFilterRange = Math.max(value, 0.001);
  }
  get lightmapFilterRange() {
    return this._lightmapFilterRange;
  }

  /**
   * A spatial parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
   * is enabled. Larger value blurs less similar colors. This needs to be a positive non-zero
   * value. Defaults to 0.2.
   *
   * @type {number}
   */
  set lightmapFilterSmoothness(value) {
    this._lightmapFilterSmoothness = Math.max(value, 0.001);
  }
  get lightmapFilterSmoothness() {
    return this._lightmapFilterSmoothness;
  }

  /**
   * Set of 6 prefiltered cubemaps.
   *
   * @type {import('../platform/graphics/texture.js').Texture[]}
   */
  set prefilteredCubemaps(value) {
    value = value || [];
    const cubemaps = this._prefilteredCubemaps;
    const changed = cubemaps.length !== value.length || cubemaps.some((c, i) => c !== value[i]);
    if (changed) {
      const complete = value.length === 6 && value.every(c => !!c);
      if (complete) {
        // update env atlas
        this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(value, {
          target: this._internalEnvAtlas
        });
        this._envAtlas = this._internalEnvAtlas;
      } else {
        if (this._internalEnvAtlas) {
          this._internalEnvAtlas.destroy();
          this._internalEnvAtlas = null;
        }
        this._envAtlas = null;
      }
      this._prefilteredCubemaps = value.slice();
      this._resetSkyMesh();
    }
  }
  get prefilteredCubemaps() {
    return this._prefilteredCubemaps;
  }

  /**
   * The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
   *
   * @type {import('../platform/graphics/texture.js').Texture}
   */
  set skybox(value) {
    if (value !== this._skyboxCubeMap) {
      this._skyboxCubeMap = value;
      this._resetSkyMesh();
    }
  }
  get skybox() {
    return this._skyboxCubeMap;
  }

  /**
   * Multiplier for skybox intensity. Defaults to 1. Unused if physical units are used.
   *
   * @type {number}
   */
  set skyboxIntensity(value) {
    if (value !== this._skyboxIntensity) {
      this._skyboxIntensity = value;
      this._resetSkyMesh();
    }
  }
  get skyboxIntensity() {
    return this._skyboxIntensity;
  }

  /**
   * Luminance (in lm/m^2) of skybox. Defaults to 0. Only used if physical units are used.
   *
   * @type {number}
   */
  set skyboxLuminance(value) {
    if (value !== this._skyboxLuminance) {
      this._skyboxLuminance = value;
      this._resetSkyMesh();
    }
  }
  get skyboxLuminance() {
    return this._skyboxLuminance;
  }

  /**
   * The mip level of the skybox to be displayed. Only valid for prefiltered cubemap skyboxes.
   * Defaults to 0 (base level).
   *
   * @type {number}
   */
  set skyboxMip(value) {
    if (value !== this._skyboxMip) {
      this._skyboxMip = value;
      this._resetSkyMesh();
    }
  }
  get skyboxMip() {
    return this._skyboxMip;
  }

  /**
   * The rotation of the skybox to be displayed. Defaults to {@link Quat.IDENTITY}.
   *
   * @type {Quat}
   */
  set skyboxRotation(value) {
    if (!this._skyboxRotation.equals(value)) {
      const isIdentity = value.equals(Quat.IDENTITY);
      this._skyboxRotation.copy(value);
      if (isIdentity) {
        this._skyboxRotationMat3.setIdentity();
      } else {
        this._skyboxRotationMat4.setTRS(Vec3.ZERO, value, Vec3.ONE);
        this._skyboxRotationMat3.invertMat4(this._skyboxRotationMat4);
      }

      // only reset sky / rebuild scene shaders if rotation changed away from identity for the first time
      if (!this._skyboxRotationShaderInclude && !isIdentity) {
        this._skyboxRotationShaderInclude = true;
        this._resetSkyMesh();
      }
    }
  }
  get skyboxRotation() {
    return this._skyboxRotation;
  }

  /**
   * The tonemapping transform to apply when writing fragments to the frame buffer. Can be:
   *
   * - {@link TONEMAP_LINEAR}
   * - {@link TONEMAP_FILMIC}
   * - {@link TONEMAP_HEJL}
   * - {@link TONEMAP_ACES}
   * - {@link TONEMAP_ACES2}
   *
   * Defaults to {@link TONEMAP_LINEAR}.
   *
   * @type {number}
   */
  set toneMapping(value) {
    if (value !== this._toneMapping) {
      this._toneMapping = value;
      this.updateShaders = true;
    }
  }
  get toneMapping() {
    return this._toneMapping;
  }
  destroy() {
    this._resetSkyMesh();
    this.root = null;
    this.off();
  }
  drawLine(start, end, color = Color.WHITE, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLines([start, end], [color, color]);
  }
  drawLines(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLines(positions, colors);
  }
  drawLineArrays(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLinesArrays(positions, colors);
  }
  applySettings(settings) {
    var _render$skyboxIntensi, _render$skyboxLuminan, _render$skyboxMip, _render$clusteredLigh;
    const physics = settings.physics;
    const render = settings.render;

    // settings
    this._gravity.set(physics.gravity[0], physics.gravity[1], physics.gravity[2]);
    this.ambientLight.set(render.global_ambient[0], render.global_ambient[1], render.global_ambient[2]);
    this.ambientLuminance = render.ambientLuminance;
    this._fog = render.fog;
    this.fogColor.set(render.fog_color[0], render.fog_color[1], render.fog_color[2]);
    this.fogStart = render.fog_start;
    this.fogEnd = render.fog_end;
    this.fogDensity = render.fog_density;
    this._gammaCorrection = render.gamma_correction;
    this._toneMapping = render.tonemapping;
    this.lightmapSizeMultiplier = render.lightmapSizeMultiplier;
    this.lightmapMaxResolution = render.lightmapMaxResolution;
    this.lightmapMode = render.lightmapMode;
    this.exposure = render.exposure;
    this._skyboxIntensity = (_render$skyboxIntensi = render.skyboxIntensity) != null ? _render$skyboxIntensi : 1;
    this._skyboxLuminance = (_render$skyboxLuminan = render.skyboxLuminance) != null ? _render$skyboxLuminan : 20000;
    this._skyboxMip = (_render$skyboxMip = render.skyboxMip) != null ? _render$skyboxMip : 0;
    if (render.skyboxRotation) {
      this.skyboxRotation = new Quat().setFromEulerAngles(render.skyboxRotation[0], render.skyboxRotation[1], render.skyboxRotation[2]);
    }
    this.sky.applySettings(render);
    this.clusteredLightingEnabled = (_render$clusteredLigh = render.clusteredLightingEnabled) != null ? _render$clusteredLigh : false;
    this.lighting.applySettings(render);

    // bake settings
    ['lightmapFilterEnabled', 'lightmapFilterRange', 'lightmapFilterSmoothness', 'ambientBake', 'ambientBakeNumSamples', 'ambientBakeSpherePart', 'ambientBakeOcclusionBrightness', 'ambientBakeOcclusionContrast'].forEach(setting => {
      if (render.hasOwnProperty(setting)) {
        this[setting] = render[setting];
      }
    });
    this._resetSkyMesh();
  }

  // get the actual texture to use for skybox rendering
  _getSkyboxTex() {
    const cubemaps = this._prefilteredCubemaps;
    if (this._skyboxMip) {
      // skybox selection for some reason has always skipped the 32x32 prefiltered mipmap, presumably a bug.
      // we can't simply fix this and map 3 to the correct level, since doing so has the potential
      // to change the look of existing scenes dramatically.
      // NOTE: the table skips the 32x32 mipmap
      const skyboxMapping = [0, 1, /* 2 */3, 4, 5, 6];

      // select blurry texture for use on the skybox
      return cubemaps[skyboxMapping[this._skyboxMip]] || this._envAtlas || cubemaps[0] || this._skyboxCubeMap;
    }
    return this._skyboxCubeMap || cubemaps[0] || this._envAtlas;
  }
  _updateSkyMesh() {
    if (!this.sky.skyMesh) {
      this.sky.updateSkyMesh();
    }
    this.sky.update();
  }
  _resetSkyMesh() {
    this.sky.resetSkyMesh();
    this.updateShaders = true;
  }

  /**
   * Sets the cubemap for the scene skybox.
   *
   * @param {import('../platform/graphics/texture.js').Texture[]} [cubemaps] - An array of
   * cubemaps corresponding to the skybox at different mip levels. If undefined, scene will
   * remove skybox. Cubemap array should be of size 7, with the first element (index 0)
   * corresponding to the base cubemap (mip level 0) with original resolution. Each remaining
   * element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32,
   * 16x16, 8x8, 4x4).
   */
  setSkybox(cubemaps) {
    if (!cubemaps) {
      this.skybox = null;
      this.envAtlas = null;
    } else {
      this.skybox = cubemaps[0] || null;
      if (cubemaps[1] && !cubemaps[1].cubemap) {
        // prefiltered data is an env atlas
        this.envAtlas = cubemaps[1];
      } else {
        // prefiltered data is a set of cubemaps
        this.prefilteredCubemaps = cubemaps.slice(1);
      }
    }
  }

  /**
   * The lightmap pixel format.
   *
   * @type {number}
   */
  get lightmapPixelFormat() {
    return this.lightmapHDR && this.device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;
  }
}
/**
 * Fired when the layer composition is set. Use this event to add callbacks or advanced
 * properties to your layers. The handler is passed the old and the new
 * {@link LayerComposition}.
 *
 * @event
 * @example
 * app.scene.on('set:layers', (oldComp, newComp) => {
 *     const list = newComp.layerList;
 *     for (let i = 0; i < list.length; i++) {
 *         const layer = list[i];
 *         switch (layer.name) {
 *             case 'MyLayer':
 *                 layer.onEnable = myOnEnableFunction;
 *                 layer.onDisable = myOnDisableFunction;
 *                 break;
 *             case 'MyOtherLayer':
 *                 layer.shaderPass = myShaderPass;
 *                 break;
 *         }
 *     }
 * });
 */
Scene.EVENT_SETLAYERS = 'set:layers';
/**
 * Fired when the skybox is set. The handler is passed the {@link Texture} that is the
 * previously used skybox cubemap texture. The new skybox cubemap texture is in the
 * {@link Scene#skybox} property.
 *
 * @event
 * @example
 * app.scene.on('set:skybox', (oldSkybox) => {
 *     console.log(`Skybox changed from ${oldSkybox.name} to ${app.scene.skybox.name}`);
 * });
 */
Scene.EVENT_SETSKYBOX = 'set:skybox';

export { Scene };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zY2VuZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDMgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0My5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBQSVhFTEZPUk1BVF9SR0JBOCwgQUREUkVTU19DTEFNUF9UT19FREdFLCBGSUxURVJfTElORUFSIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQkFLRV9DT0xPUkRJUiwgRk9HX05PTkUsIEdBTU1BX1NSR0IsIExBWUVSSURfSU1NRURJQVRFIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRpbmdQYXJhbXMgfSBmcm9tICcuL2xpZ2h0aW5nL2xpZ2h0aW5nLXBhcmFtcy5qcyc7XG5pbXBvcnQgeyBTa3kgfSBmcm9tICcuL3NreWJveC9za3kuanMnO1xuaW1wb3J0IHsgSW1tZWRpYXRlIH0gZnJvbSAnLi9pbW1lZGlhdGUvaW1tZWRpYXRlLmpzJztcbmltcG9ydCB7IEVudkxpZ2h0aW5nIH0gZnJvbSAnLi9ncmFwaGljcy9lbnYtbGlnaHRpbmcuanMnO1xuXG4vKipcbiAqIEEgc2NlbmUgaXMgZ3JhcGhpY2FsIHJlcHJlc2VudGF0aW9uIG9mIGFuIGVudmlyb25tZW50LiBJdCBtYW5hZ2VzIHRoZSBzY2VuZSBoaWVyYXJjaHksIGFsbFxuICogZ3JhcGhpY2FsIG9iamVjdHMsIGxpZ2h0cywgYW5kIHNjZW5lLXdpZGUgcHJvcGVydGllcy5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgU2NlbmUgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGxheWVyIGNvbXBvc2l0aW9uIGlzIHNldC4gVXNlIHRoaXMgZXZlbnQgdG8gYWRkIGNhbGxiYWNrcyBvciBhZHZhbmNlZFxuICAgICAqIHByb3BlcnRpZXMgdG8geW91ciBsYXllcnMuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUgb2xkIGFuZCB0aGUgbmV3XG4gICAgICoge0BsaW5rIExheWVyQ29tcG9zaXRpb259LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCAob2xkQ29tcCwgbmV3Q29tcCkgPT4ge1xuICAgICAqICAgICBjb25zdCBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICogICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICAgICAgY29uc3QgbGF5ZXIgPSBsaXN0W2ldO1xuICAgICAqICAgICAgICAgc3dpdGNoIChsYXllci5uYW1lKSB7XG4gICAgICogICAgICAgICAgICAgY2FzZSAnTXlMYXllcic6XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLm9uRW5hYmxlID0gbXlPbkVuYWJsZUZ1bmN0aW9uO1xuICAgICAqICAgICAgICAgICAgICAgICBsYXllci5vbkRpc2FibGUgPSBteU9uRGlzYWJsZUZ1bmN0aW9uO1xuICAgICAqICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICBjYXNlICdNeU90aGVyTGF5ZXInOlxuICAgICAqICAgICAgICAgICAgICAgICBsYXllci5zaGFkZXJQYXNzID0gbXlTaGFkZXJQYXNzO1xuICAgICAqICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9TRVRMQVlFUlMgPSAnc2V0OmxheWVycyc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBza3lib3ggaXMgc2V0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIHtAbGluayBUZXh0dXJlfSB0aGF0IGlzIHRoZVxuICAgICAqIHByZXZpb3VzbHkgdXNlZCBza3lib3ggY3ViZW1hcCB0ZXh0dXJlLiBUaGUgbmV3IHNreWJveCBjdWJlbWFwIHRleHR1cmUgaXMgaW4gdGhlXG4gICAgICoge0BsaW5rIFNjZW5lI3NreWJveH0gcHJvcGVydHkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zY2VuZS5vbignc2V0OnNreWJveCcsIChvbGRTa3lib3gpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFNreWJveCBjaGFuZ2VkIGZyb20gJHtvbGRTa3lib3gubmFtZX0gdG8gJHthcHAuc2NlbmUuc2t5Ym94Lm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1NFVFNLWUJPWCA9ICdzZXQ6c2t5Ym94JztcblxuICAgIC8qKlxuICAgICAqIElmIGVuYWJsZWQsIHRoZSBhbWJpZW50IGxpZ2h0aW5nIHdpbGwgYmUgYmFrZWQgaW50byBsaWdodG1hcHMuIFRoaXMgd2lsbCBiZSBlaXRoZXIgdGhlXG4gICAgICoge0BsaW5rIFNjZW5lI3NreWJveH0gaWYgc2V0IHVwLCBvdGhlcndpc2Uge0BsaW5rIFNjZW5lI2FtYmllbnRMaWdodH0uIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgYW1iaWVudEJha2UgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIElmIHtAbGluayBTY2VuZSNhbWJpZW50QmFrZX0gaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgdGhlIGJyaWdodG5lc3Mgb2YgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogVHlwaWNhbCByYW5nZSBpcyAtMSB0byAxLiBEZWZhdWx0cyB0byAwLCByZXByZXNlbnRpbmcgbm8gY2hhbmdlIHRvIGJyaWdodG5lc3MuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyA9IDA7XG5cbiAgICAgLyoqXG4gICAgICAqIElmIHtAbGluayBTY2VuZSNhbWJpZW50QmFrZX0gaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgdGhlIGNvbnRyYXN0IG9mIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAgKiBUeXBpY2FsIHJhbmdlIGlzIC0xIHRvIDEuIERlZmF1bHRzIHRvIDAsIHJlcHJlc2VudGluZyBubyBjaGFuZ2UgdG8gY29udHJhc3QuXG4gICAgICAqXG4gICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAqL1xuICAgIGFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIG9mIHRoZSBzY2VuZSdzIGFtYmllbnQgbGlnaHQuIERlZmF1bHRzIHRvIGJsYWNrICgwLCAwLCAwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBhbWJpZW50TGlnaHQgPSBuZXcgQ29sb3IoMCwgMCwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbHVtaW5vc2l0eSBvZiB0aGUgc2NlbmUncyBhbWJpZW50IGxpZ2h0IGluIGx1eCAobG0vbV4yKS4gVXNlZCBpZiBwaHlzaWNhbFVuaXRzIGlzIHRydWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGFtYmllbnRMdW1pbmFuY2UgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGV4cG9zdXJlIHZhbHVlIHR3ZWFrcyB0aGUgb3ZlcmFsbCBicmlnaHRuZXNzIG9mIHRoZSBzY2VuZS4gSWdub3JlZCBpZiBwaHlzaWNhbFVuaXRzIGlzIHRydWUuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGV4cG9zdXJlID0gMTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xvciBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gRGVmYXVsdHMgdG8gYmxhY2sgKDAsIDAsIDApLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfVxuICAgICAqL1xuICAgIGZvZ0NvbG9yID0gbmV3IENvbG9yKDAsIDAsIDApO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGRlbnNpdHkgb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldFxuICAgICAqIHRvIHtAbGluayBGT0dfRVhQfSBvciB7QGxpbmsgRk9HX0VYUDJ9LiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmb2dEZW5zaXR5ID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZyByZWFjaGVzIGl0cyBtYXhpbXVtLiBUaGlzIHByb3BlcnR5IGlzIG9ubHlcbiAgICAgKiB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uIERlZmF1bHRzIHRvIDEwMDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGZvZ0VuZCA9IDEwMDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2cgYmVnaW5zLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlXG4gICAgICogZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGZvZ1N0YXJ0ID0gMTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBsaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gbGlnaHRtYXAgcmVzb2x1dGlvbi4gRGVmYXVsdHMgdG8gMjA0OC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBNYXhSZXNvbHV0aW9uID0gMjA0ODtcblxuICAgIC8qKlxuICAgICAqIFRoZSBsaWdodG1hcCBiYWtpbmcgbW9kZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcFxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1JESVJ9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXAgKyBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24gKHVzZWQgZm9yIGJ1bXAgb3JcbiAgICAgKiBzcGVjdWxhcikuIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHRcbiAgICAgKiBkaXJlY3Rpb24uXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQkFLRV9DT0xPUkRJUn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGxpZ2h0bWFwTW9kZSA9IEJBS0VfQ09MT1JESVI7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIGJpbGF0ZXJhbCBmaWx0ZXIgb24gcnVudGltZSBiYWtlZCBjb2xvciBsaWdodG1hcHMsIHdoaWNoIHJlbW92ZXMgdGhlIG5vaXNlIGFuZFxuICAgICAqIGJhbmRpbmcgd2hpbGUgcHJlc2VydmluZyB0aGUgZWRnZXMuIERlZmF1bHRzIHRvIGZhbHNlLiBOb3RlIHRoYXQgdGhlIGZpbHRlcmluZyB0YWtlcyBwbGFjZVxuICAgICAqIGluIHRoZSBpbWFnZSBzcGFjZSBvZiB0aGUgbGlnaHRtYXAsIGFuZCBpdCBkb2VzIG5vdCBmaWx0ZXIgYWNyb3NzIGxpZ2h0bWFwIFVWIHNwYWNlIHNlYW1zLFxuICAgICAqIG9mdGVuIG1ha2luZyB0aGUgc2VhbXMgbW9yZSB2aXNpYmxlLiBJdCdzIGltcG9ydGFudCB0byBiYWxhbmNlIHRoZSBzdHJlbmd0aCBvZiB0aGUgZmlsdGVyXG4gICAgICogd2l0aCBudW1iZXIgb2Ygc2FtcGxlcyB1c2VkIGZvciBsaWdodG1hcCBiYWtpbmcgdG8gbGltaXQgdGhlIHZpc2libGUgYXJ0aWZhY3RzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbGlnaHRtYXBGaWx0ZXJFbmFibGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIEhEUiBsaWdodG1hcHMuIFRoaXMgY2FuIHJlc3VsdCBpbiBzbW9vdGhlciBsaWdodG1hcHMgZXNwZWNpYWxseSB3aGVuIG1hbnkgc2FtcGxlc1xuICAgICAqIGFyZSB1c2VkLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGxpZ2h0bWFwSERSID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcm9vdCBlbnRpdHkgb2YgdGhlIHNjZW5lLCB3aGljaCBpcyB1c3VhbGx5IHRoZSBvbmx5IGNoaWxkIHRvIHRoZSB7QGxpbmsgQXBwbGljYXRpb259XG4gICAgICogcm9vdCBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAqL1xuICAgIHJvb3QgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVXNlIHBoeXNpY2FsbHkgYmFzZWQgdW5pdHMgZm9yIGNhbWVyYXMgYW5kIGxpZ2h0cy4gV2hlbiB1c2VkLCB0aGUgZXhwb3N1cmUgdmFsdWUgaXMgaWdub3JlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHBoeXNpY2FsVW5pdHMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VudkF0bGFzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBza3lib3ggY3ViZW1hcCBhcyBzZXQgYnkgdXNlciAoZ2V0cyB1c2VkIHdoZW4gc2t5Ym94TWlwID09PSAwKVxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9za3lib3hDdWJlTWFwID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTY2VuZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLVxuICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhpcyBzY2VuZS5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3JhcGhpY3NEZXZpY2UsIFwiU2NlbmUgY29uc3RydWN0b3IgdGFrZXMgYSBHcmFwaGljc0RldmljZSBhcyBhIHBhcmFtZXRlciwgYW5kIGl0IHdhcyBub3QgcHJvdmlkZWQuXCIpO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2dyYXZpdHkgPSBuZXcgVmVjMygwLCAtOS44LCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2ZvZyA9IEZPR19OT05FO1xuXG4gICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IEdBTU1BX1NSR0I7XG4gICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgb2YgNiBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhIGN1YmVtYXBzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZVtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcyA9IFtdO1xuXG4gICAgICAgIC8vIGludGVybmFsbHkgZ2VuZXJhdGVkIGVudkF0bGFzIG93bmVkIGJ5IHRoZSBzY2VuZVxuICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9za3lib3hMdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSAwO1xuXG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uU2hhZGVySW5jbHVkZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0MyA9IG5ldyBNYXQzKCk7XG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gYW1iaWVudCBsaWdodCBsaWdodG1hcHBpbmcgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZU51bVNhbXBsZXMgPSAxO1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZVNwaGVyZVBhcnQgPSAwLjQ7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZSA9IDEwO1xuICAgICAgICB0aGlzLl9saWdodG1hcEZpbHRlclNtb290aG5lc3MgPSAwLjI7XG5cbiAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2xpZ2h0aW5nUGFyYW1zID0gbmV3IExpZ2h0aW5nUGFyYW1zKHRoaXMuZGV2aWNlLnN1cHBvcnRzQXJlYUxpZ2h0cywgdGhpcy5kZXZpY2UubWF4VGV4dHVyZVNpemUsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHNreWJveFxuICAgICAgICB0aGlzLl9za3kgPSBuZXcgU2t5KHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3N0YXRzID0ge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlczogMCxcbiAgICAgICAgICAgIGxpZ2h0czogMCxcbiAgICAgICAgICAgIGR5bmFtaWNMaWdodHM6IDAsXG4gICAgICAgICAgICBiYWtlZExpZ2h0czogMCxcbiAgICAgICAgICAgIHVwZGF0ZVNoYWRlcnNUaW1lOiAwIC8vIGRlcHJlY2F0ZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhpcyBmbGFnIGluZGljYXRlcyBjaGFuZ2VzIHdlcmUgbWFkZSB0byB0aGUgc2NlbmUgd2hpY2ggbWF5IHJlcXVpcmUgcmVjb21waWxhdGlvbiBvZlxuICAgICAgICAgKiBzaGFkZXJzIHRoYXQgcmVmZXJlbmNlIGdsb2JhbCBzZXR0aW5ncy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fc2hhZGVyVmVyc2lvbiA9IDA7XG5cbiAgICAgICAgLy8gaW1tZWRpYXRlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLmltbWVkaWF0ZSA9IG5ldyBJbW1lZGlhdGUodGhpcy5kZXZpY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGRlZmF1bHQgbGF5ZXIgdXNlZCBieSB0aGUgaW1tZWRpYXRlIGRyYXdpbmcgZnVuY3Rpb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9sYXllci5qcycpLkxheWVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZ2V0IGRlZmF1bHREcmF3TGF5ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHtAbGluayBTY2VuZSNhbWJpZW50QmFrZX0gaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBzYW1wbGVzIHVzZWQgdG8gYmFrZSB0aGVcbiAgICAgKiBhbWJpZW50IGxpZ2h0IGludG8gdGhlIGxpZ2h0bWFwLiBEZWZhdWx0cyB0byAxLiBNYXhpbXVtIHZhbHVlIGlzIDI1NS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFtYmllbnRCYWtlTnVtU2FtcGxlcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZU51bVNhbXBsZXMgPSBtYXRoLmNsYW1wKE1hdGguZmxvb3IodmFsdWUpLCAxLCAyNTUpO1xuICAgIH1cblxuICAgIGdldCBhbWJpZW50QmFrZU51bVNhbXBsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbWJpZW50QmFrZU51bVNhbXBsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyBhIHBhcnQgb2YgdGhlIHNwaGVyZSB3aGljaCByZXByZXNlbnRzXG4gICAgICogdGhlIHNvdXJjZSBvZiBhbWJpZW50IGxpZ2h0LiBUaGUgdmFsaWQgcmFuZ2UgaXMgMC4uMSwgcmVwcmVzZW50aW5nIGEgcGFydCBvZiB0aGUgc3BoZXJlIGZyb21cbiAgICAgKiB0b3AgdG8gdGhlIGJvdHRvbS4gQSB2YWx1ZSBvZiAwLjUgcmVwcmVzZW50cyB0aGUgdXBwZXIgaGVtaXNwaGVyZS4gQSB2YWx1ZSBvZiAxIHJlcHJlc2VudHMgYVxuICAgICAqIGZ1bGwgc3BoZXJlLiBEZWZhdWx0cyB0byAwLjQsIHdoaWNoIGlzIGEgc21hbGxlciB1cHBlciBoZW1pc3BoZXJlIGFzIHRoaXMgcmVxdWlyZXMgZmV3ZXJcbiAgICAgKiBzYW1wbGVzIHRvIGJha2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbWJpZW50QmFrZVNwaGVyZVBhcnQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYW1iaWVudEJha2VTcGhlcmVQYXJ0ID0gbWF0aC5jbGFtcCh2YWx1ZSwgMC4wMDEsIDEpO1xuICAgIH1cblxuICAgIGdldCBhbWJpZW50QmFrZVNwaGVyZVBhcnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbWJpZW50QmFrZVNwaGVyZVBhcnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIGVuYWJsZWQuIFNldCB0byBmYWxzZSBiZWZvcmUgdGhlIGZpcnN0IGZyYW1lIGlzIHJlbmRlcmVkXG4gICAgICogdG8gdXNlIG5vbi1jbHVzdGVyZWQgbGlnaHRpbmcuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKHZhbHVlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoJ1dlYkdQVSBjdXJyZW50bHkgb25seSBzdXBwb3J0cyBjbHVzdGVyZWQgbGlnaHRpbmcsIGFuZCB0aGlzIGNhbm5vdCBiZSBkaXNhYmxlZC4nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUdXJuaW5nIG9uIGRpc2FibGVkIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZW52aXJvbm1lbnQgbGlnaHRpbmcgYXRsYXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBzZXQgZW52QXRsYXModmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9lbnZBdGxhcykge1xuICAgICAgICAgICAgdGhpcy5fZW52QXRsYXMgPSB2YWx1ZTtcblxuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHJlcXVpcmVkIG9wdGlvbnMgYXJlIHNldCB1cCBvbiB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUuYWRkcmVzc1UgPSBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICAgICAgdmFsdWUuYWRkcmVzc1YgPSBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICAgICAgdmFsdWUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB2YWx1ZS5tYWdGaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgIHZhbHVlLm1pcG1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ludGVybmFsRW52QXRsYXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3lNZXNoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW52QXRsYXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbnZBdGxhcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiBmb2cgdXNlZCBieSB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZPR19OT05FfVxuICAgICAqIC0ge0BsaW5rIEZPR19MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUH1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQMn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGT0dfTk9ORX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBmb2codHlwZSkge1xuICAgICAgICBpZiAodHlwZSAhPT0gdGhpcy5fZm9nKSB7XG4gICAgICAgICAgICB0aGlzLl9mb2cgPSB0eXBlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmb2coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb2c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGdhbW1hIGNvcnJlY3Rpb24gdG8gYXBwbHkgd2hlbiByZW5kZXJpbmcgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBHQU1NQV9OT05FfVxuICAgICAqIC0ge0BsaW5rIEdBTU1BX1NSR0J9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgR0FNTUFfU1JHQn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBnYW1tYUNvcnJlY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9nYW1tYUNvcnJlY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBnYW1tYUNvcnJlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nYW1tYUNvcnJlY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gdGhhdCBkZWZpbmVzIHJlbmRlcmluZyBvcmRlciBvZiB0aGlzIHNjZW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259XG4gICAgICovXG4gICAgc2V0IGxheWVycyhsYXllcnMpIHtcbiAgICAgICAgY29uc3QgcHJldiA9IHRoaXMuX2xheWVycztcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gbGF5ZXJzO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpsYXllcnMnLCBwcmV2LCBsYXllcnMpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IHNreSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBMaWdodGluZ1BhcmFtc30gdGhhdCBkZWZpbmVzIGxpZ2h0aW5nIHBhcmFtZXRlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TGlnaHRpbmdQYXJhbXN9XG4gICAgICovXG4gICAgZ2V0IGxpZ2h0aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRpbmdQYXJhbXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByYW5nZSBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGFwcGxpZXMgbW9yZSB3aWRlc3ByZWFkIGJsdXIuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAxMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZSA9IE1hdGgubWF4KHZhbHVlLCAwLjAwMSk7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcEZpbHRlclJhbmdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgc3BhdGlhbCBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGJsdXJzIGxlc3Mgc2ltaWxhciBjb2xvcnMuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAwLjIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcEZpbHRlclNtb290aG5lc3ModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzID0gTWF0aC5tYXgodmFsdWUsIDAuMDAxKTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBvZiA2IHByZWZpbHRlcmVkIGN1YmVtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgKi9cbiAgICBzZXQgcHJlZmlsdGVyZWRDdWJlbWFwcyh2YWx1ZSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlIHx8IFtdO1xuICAgICAgICBjb25zdCBjdWJlbWFwcyA9IHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG4gICAgICAgIGNvbnN0IGNoYW5nZWQgPSBjdWJlbWFwcy5sZW5ndGggIT09IHZhbHVlLmxlbmd0aCB8fCBjdWJlbWFwcy5zb21lKChjLCBpKSA9PiBjICE9PSB2YWx1ZVtpXSk7XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBsZXRlID0gdmFsdWUubGVuZ3RoID09PSA2ICYmIHZhbHVlLmV2ZXJ5KGMgPT4gISFjKTtcblxuICAgICAgICAgICAgaWYgKGNvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGVudiBhdGxhc1xuICAgICAgICAgICAgICAgIHRoaXMuX2ludGVybmFsRW52QXRsYXMgPSBFbnZMaWdodGluZy5nZW5lcmF0ZVByZWZpbHRlcmVkQXRsYXModmFsdWUsIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLl9pbnRlcm5hbEVudkF0bGFzXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9lbnZBdGxhcyA9IHRoaXMuX2ludGVybmFsRW52QXRsYXM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pbnRlcm5hbEVudkF0bGFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ludGVybmFsRW52QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fZW52QXRsYXMgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzID0gdmFsdWUuc2xpY2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5TWVzaCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByZWZpbHRlcmVkQ3ViZW1hcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGN1YmVtYXAgdGV4dHVyZSB1c2VkIGFzIHRoZSBzY2VuZSdzIHNreWJveCwgaWYgbWlwIGxldmVsIGlzIDAuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94Q3ViZU1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94Q3ViZU1hcCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3lNZXNoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94Q3ViZU1hcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVyIGZvciBza3lib3ggaW50ZW5zaXR5LiBEZWZhdWx0cyB0byAxLiBVbnVzZWQgaWYgcGh5c2ljYWwgdW5pdHMgYXJlIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBza3lib3hJbnRlbnNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9za3lib3hJbnRlbnNpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3NreWJveEludGVuc2l0eSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3lNZXNoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94SW50ZW5zaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94SW50ZW5zaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEx1bWluYW5jZSAoaW4gbG0vbV4yKSBvZiBza3lib3guIERlZmF1bHRzIHRvIDAuIE9ubHkgdXNlZCBpZiBwaHlzaWNhbCB1bml0cyBhcmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveEx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveEx1bWluYW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94THVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreU1lc2goKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3hMdW1pbmFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hMdW1pbmFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1pcCBsZXZlbCBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC4gT25seSB2YWxpZCBmb3IgcHJlZmlsdGVyZWQgY3ViZW1hcCBza3lib3hlcy5cbiAgICAgKiBEZWZhdWx0cyB0byAwIChiYXNlIGxldmVsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveE1pcCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveE1pcCkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94TWlwID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreU1lc2goKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3hNaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hNaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJvdGF0aW9uIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLiBEZWZhdWx0cyB0byB7QGxpbmsgUXVhdC5JREVOVElUWX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94Um90YXRpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9za3lib3hSb3RhdGlvbi5lcXVhbHModmFsdWUpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGlzSWRlbnRpdHkgPSB2YWx1ZS5lcXVhbHMoUXVhdC5JREVOVElUWSk7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbi5jb3B5KHZhbHVlKTtcblxuICAgICAgICAgICAgaWYgKGlzSWRlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbk1hdDMuc2V0SWRlbnRpdHkoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQ0LnNldFRSUyhWZWMzLlpFUk8sIHZhbHVlLCBWZWMzLk9ORSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQzLmludmVydE1hdDQodGhpcy5fc2t5Ym94Um90YXRpb25NYXQ0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSByZXNldCBza3kgLyByZWJ1aWxkIHNjZW5lIHNoYWRlcnMgaWYgcm90YXRpb24gY2hhbmdlZCBhd2F5IGZyb20gaWRlbnRpdHkgZm9yIHRoZSBmaXJzdCB0aW1lXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3NreWJveFJvdGF0aW9uU2hhZGVySW5jbHVkZSAmJiAhaXNJZGVudGl0eSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uU2hhZGVySW5jbHVkZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3lNZXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94Um90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hSb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdG9uZW1hcHBpbmcgdHJhbnNmb3JtIHRvIGFwcGx5IHdoZW4gd3JpdGluZyBmcmFnbWVudHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9GSUxNSUN9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9IRUpMfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfQUNFU31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0FDRVMyfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRPTkVNQVBfTElORUFSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvbmVNYXBwaW5nKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fdG9uZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRvbmVNYXBwaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdG9uZU1hcHBpbmc7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fcmVzZXRTa3lNZXNoKCk7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgICAgIHRoaXMub2ZmKCk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IgPSBDb2xvci5XSElURSwgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICAgICAgYmF0Y2guYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGNvbG9yXSk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5pbW1lZGlhdGUuZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCk7XG4gICAgICAgIGJhdGNoLmFkZExpbmVzQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzKTtcbiAgICB9XG5cbiAgICBhcHBseVNldHRpbmdzKHNldHRpbmdzKSB7XG4gICAgICAgIGNvbnN0IHBoeXNpY3MgPSBzZXR0aW5ncy5waHlzaWNzO1xuICAgICAgICBjb25zdCByZW5kZXIgPSBzZXR0aW5ncy5yZW5kZXI7XG5cbiAgICAgICAgLy8gc2V0dGluZ3NcbiAgICAgICAgdGhpcy5fZ3Jhdml0eS5zZXQocGh5c2ljcy5ncmF2aXR5WzBdLCBwaHlzaWNzLmdyYXZpdHlbMV0sIHBoeXNpY3MuZ3Jhdml0eVsyXSk7XG4gICAgICAgIHRoaXMuYW1iaWVudExpZ2h0LnNldChyZW5kZXIuZ2xvYmFsX2FtYmllbnRbMF0sIHJlbmRlci5nbG9iYWxfYW1iaWVudFsxXSwgcmVuZGVyLmdsb2JhbF9hbWJpZW50WzJdKTtcbiAgICAgICAgdGhpcy5hbWJpZW50THVtaW5hbmNlID0gcmVuZGVyLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgIHRoaXMuX2ZvZyA9IHJlbmRlci5mb2c7XG4gICAgICAgIHRoaXMuZm9nQ29sb3Iuc2V0KHJlbmRlci5mb2dfY29sb3JbMF0sIHJlbmRlci5mb2dfY29sb3JbMV0sIHJlbmRlci5mb2dfY29sb3JbMl0pO1xuICAgICAgICB0aGlzLmZvZ1N0YXJ0ID0gcmVuZGVyLmZvZ19zdGFydDtcbiAgICAgICAgdGhpcy5mb2dFbmQgPSByZW5kZXIuZm9nX2VuZDtcbiAgICAgICAgdGhpcy5mb2dEZW5zaXR5ID0gcmVuZGVyLmZvZ19kZW5zaXR5O1xuICAgICAgICB0aGlzLl9nYW1tYUNvcnJlY3Rpb24gPSByZW5kZXIuZ2FtbWFfY29ycmVjdGlvbjtcbiAgICAgICAgdGhpcy5fdG9uZU1hcHBpbmcgPSByZW5kZXIudG9uZW1hcHBpbmc7XG4gICAgICAgIHRoaXMubGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICB0aGlzLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiA9IHJlbmRlci5saWdodG1hcE1heFJlc29sdXRpb247XG4gICAgICAgIHRoaXMubGlnaHRtYXBNb2RlID0gcmVuZGVyLmxpZ2h0bWFwTW9kZTtcbiAgICAgICAgdGhpcy5leHBvc3VyZSA9IHJlbmRlci5leHBvc3VyZTtcbiAgICAgICAgdGhpcy5fc2t5Ym94SW50ZW5zaXR5ID0gcmVuZGVyLnNreWJveEludGVuc2l0eSA/PyAxO1xuICAgICAgICB0aGlzLl9za3lib3hMdW1pbmFuY2UgPSByZW5kZXIuc2t5Ym94THVtaW5hbmNlID8/IDIwMDAwO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSByZW5kZXIuc2t5Ym94TWlwID8/IDA7XG5cbiAgICAgICAgaWYgKHJlbmRlci5za3lib3hSb3RhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5za3lib3hSb3RhdGlvbiA9IChuZXcgUXVhdCgpKS5zZXRGcm9tRXVsZXJBbmdsZXMocmVuZGVyLnNreWJveFJvdGF0aW9uWzBdLCByZW5kZXIuc2t5Ym94Um90YXRpb25bMV0sIHJlbmRlci5za3lib3hSb3RhdGlvblsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNreS5hcHBseVNldHRpbmdzKHJlbmRlcik7XG5cbiAgICAgICAgdGhpcy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSByZW5kZXIuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID8/IGZhbHNlO1xuICAgICAgICB0aGlzLmxpZ2h0aW5nLmFwcGx5U2V0dGluZ3MocmVuZGVyKTtcblxuICAgICAgICAvLyBiYWtlIHNldHRpbmdzXG4gICAgICAgIFtcbiAgICAgICAgICAgICdsaWdodG1hcEZpbHRlckVuYWJsZWQnLFxuICAgICAgICAgICAgJ2xpZ2h0bWFwRmlsdGVyUmFuZ2UnLFxuICAgICAgICAgICAgJ2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcycsXG4gICAgICAgICAgICAnYW1iaWVudEJha2UnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlTnVtU2FtcGxlcycsXG4gICAgICAgICAgICAnYW1iaWVudEJha2VTcGhlcmVQYXJ0JyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QnXG4gICAgICAgIF0uZm9yRWFjaCgoc2V0dGluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHJlbmRlci5oYXNPd25Qcm9wZXJ0eShzZXR0aW5nKSkge1xuICAgICAgICAgICAgICAgIHRoaXNbc2V0dGluZ10gPSByZW5kZXJbc2V0dGluZ107XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3Jlc2V0U2t5TWVzaCgpO1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgYWN0dWFsIHRleHR1cmUgdG8gdXNlIGZvciBza3lib3ggcmVuZGVyaW5nXG4gICAgX2dldFNreWJveFRleCgpIHtcbiAgICAgICAgY29uc3QgY3ViZW1hcHMgPSB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuXG4gICAgICAgIGlmICh0aGlzLl9za3lib3hNaXApIHtcbiAgICAgICAgICAgIC8vIHNreWJveCBzZWxlY3Rpb24gZm9yIHNvbWUgcmVhc29uIGhhcyBhbHdheXMgc2tpcHBlZCB0aGUgMzJ4MzIgcHJlZmlsdGVyZWQgbWlwbWFwLCBwcmVzdW1hYmx5IGEgYnVnLlxuICAgICAgICAgICAgLy8gd2UgY2FuJ3Qgc2ltcGx5IGZpeCB0aGlzIGFuZCBtYXAgMyB0byB0aGUgY29ycmVjdCBsZXZlbCwgc2luY2UgZG9pbmcgc28gaGFzIHRoZSBwb3RlbnRpYWxcbiAgICAgICAgICAgIC8vIHRvIGNoYW5nZSB0aGUgbG9vayBvZiBleGlzdGluZyBzY2VuZXMgZHJhbWF0aWNhbGx5LlxuICAgICAgICAgICAgLy8gTk9URTogdGhlIHRhYmxlIHNraXBzIHRoZSAzMngzMiBtaXBtYXBcbiAgICAgICAgICAgIGNvbnN0IHNreWJveE1hcHBpbmcgPSBbMCwgMSwgLyogMiAqLyAzLCA0LCA1LCA2XTtcblxuICAgICAgICAgICAgLy8gc2VsZWN0IGJsdXJyeSB0ZXh0dXJlIGZvciB1c2Ugb24gdGhlIHNreWJveFxuICAgICAgICAgICAgcmV0dXJuIGN1YmVtYXBzW3NreWJveE1hcHBpbmdbdGhpcy5fc2t5Ym94TWlwXV0gfHwgdGhpcy5fZW52QXRsYXMgfHwgY3ViZW1hcHNbMF0gfHwgdGhpcy5fc2t5Ym94Q3ViZU1hcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hDdWJlTWFwIHx8IGN1YmVtYXBzWzBdIHx8IHRoaXMuX2VudkF0bGFzO1xuICAgIH1cblxuICAgIF91cGRhdGVTa3lNZXNoKCkge1xuICAgICAgICBpZiAoIXRoaXMuc2t5LnNreU1lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuc2t5LnVwZGF0ZVNreU1lc2goKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNreS51cGRhdGUoKTtcbiAgICB9XG5cbiAgICBfcmVzZXRTa3lNZXNoKCkge1xuICAgICAgICB0aGlzLnNreS5yZXNldFNreU1lc2goKTtcbiAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdWJlbWFwIGZvciB0aGUgc2NlbmUgc2t5Ym94LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlW119IFtjdWJlbWFwc10gLSBBbiBhcnJheSBvZlxuICAgICAqIGN1YmVtYXBzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNreWJveCBhdCBkaWZmZXJlbnQgbWlwIGxldmVscy4gSWYgdW5kZWZpbmVkLCBzY2VuZSB3aWxsXG4gICAgICogcmVtb3ZlIHNreWJveC4gQ3ViZW1hcCBhcnJheSBzaG91bGQgYmUgb2Ygc2l6ZSA3LCB3aXRoIHRoZSBmaXJzdCBlbGVtZW50IChpbmRleCAwKVxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2UgY3ViZW1hcCAobWlwIGxldmVsIDApIHdpdGggb3JpZ2luYWwgcmVzb2x1dGlvbi4gRWFjaCByZW1haW5pbmdcbiAgICAgKiBlbGVtZW50IChpbmRleCAxLTYpIGNvcnJlc3BvbmRzIHRvIGEgZml4ZWQgcHJlZmlsdGVyZWQgcmVzb2x1dGlvbiAoMTI4eDEyOCwgNjR4NjQsIDMyeDMyLFxuICAgICAqIDE2eDE2LCA4eDgsIDR4NCkuXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGN1YmVtYXBzKSB7XG4gICAgICAgIGlmICghY3ViZW1hcHMpIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5za3lib3ggPSBjdWJlbWFwc1swXSB8fCBudWxsO1xuICAgICAgICAgICAgaWYgKGN1YmVtYXBzWzFdICYmICFjdWJlbWFwc1sxXS5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gcHJlZmlsdGVyZWQgZGF0YSBpcyBhbiBlbnYgYXRsYXNcbiAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gY3ViZW1hcHNbMV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHByZWZpbHRlcmVkIGRhdGEgaXMgYSBzZXQgb2YgY3ViZW1hcHNcbiAgICAgICAgICAgICAgICB0aGlzLnByZWZpbHRlcmVkQ3ViZW1hcHMgPSBjdWJlbWFwcy5zbGljZSgxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBsaWdodG1hcCBwaXhlbCBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBsaWdodG1hcFBpeGVsRm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5saWdodG1hcEhEUiAmJiB0aGlzLmRldmljZS5nZXRSZW5kZXJhYmxlSGRyRm9ybWF0KCkgfHwgUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY2VuZSB9O1xuIl0sIm5hbWVzIjpbIlNjZW5lIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImFtYmllbnRCYWtlIiwiYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIiwiYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCIsImFtYmllbnRMaWdodCIsIkNvbG9yIiwiYW1iaWVudEx1bWluYW5jZSIsImV4cG9zdXJlIiwiZm9nQ29sb3IiLCJmb2dEZW5zaXR5IiwiZm9nRW5kIiwiZm9nU3RhcnQiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwibGlnaHRtYXBNYXhSZXNvbHV0aW9uIiwibGlnaHRtYXBNb2RlIiwiQkFLRV9DT0xPUkRJUiIsImxpZ2h0bWFwRmlsdGVyRW5hYmxlZCIsImxpZ2h0bWFwSERSIiwicm9vdCIsInBoeXNpY2FsVW5pdHMiLCJfZW52QXRsYXMiLCJfc2t5Ym94Q3ViZU1hcCIsIkRlYnVnIiwiYXNzZXJ0IiwiZGV2aWNlIiwiX2dyYXZpdHkiLCJWZWMzIiwiX2xheWVycyIsIl9mb2ciLCJGT0dfTk9ORSIsIl9nYW1tYUNvcnJlY3Rpb24iLCJHQU1NQV9TUkdCIiwiX3RvbmVNYXBwaW5nIiwiX3ByZWZpbHRlcmVkQ3ViZW1hcHMiLCJfaW50ZXJuYWxFbnZBdGxhcyIsIl9za3lib3hJbnRlbnNpdHkiLCJfc2t5Ym94THVtaW5hbmNlIiwiX3NreWJveE1pcCIsIl9za3lib3hSb3RhdGlvblNoYWRlckluY2x1ZGUiLCJfc2t5Ym94Um90YXRpb24iLCJRdWF0IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsIk1hdDMiLCJfc2t5Ym94Um90YXRpb25NYXQ0IiwiTWF0NCIsIl9hbWJpZW50QmFrZU51bVNhbXBsZXMiLCJfYW1iaWVudEJha2VTcGhlcmVQYXJ0IiwiX2xpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJfbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzIiwiX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsIl9saWdodGluZ1BhcmFtcyIsIkxpZ2h0aW5nUGFyYW1zIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwibWF4VGV4dHVyZVNpemUiLCJ1cGRhdGVTaGFkZXJzIiwiX3NreSIsIlNreSIsIl9zdGF0cyIsIm1lc2hJbnN0YW5jZXMiLCJsaWdodHMiLCJkeW5hbWljTGlnaHRzIiwiYmFrZWRMaWdodHMiLCJ1cGRhdGVTaGFkZXJzVGltZSIsIl9zaGFkZXJWZXJzaW9uIiwiaW1tZWRpYXRlIiwiSW1tZWRpYXRlIiwiZGVmYXVsdERyYXdMYXllciIsImxheWVycyIsImdldExheWVyQnlJZCIsIkxBWUVSSURfSU1NRURJQVRFIiwiYW1iaWVudEJha2VOdW1TYW1wbGVzIiwidmFsdWUiLCJtYXRoIiwiY2xhbXAiLCJNYXRoIiwiZmxvb3IiLCJhbWJpZW50QmFrZVNwaGVyZVBhcnQiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJpc1dlYkdQVSIsIndhcm5PbmNlIiwiY29uc29sZSIsImVycm9yIiwiZW52QXRsYXMiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIm1hZ0ZpbHRlciIsIm1pcG1hcHMiLCJkZXN0cm95IiwiX3Jlc2V0U2t5TWVzaCIsImZvZyIsInR5cGUiLCJnYW1tYUNvcnJlY3Rpb24iLCJwcmV2IiwiZmlyZSIsInNreSIsImxpZ2h0aW5nIiwibGlnaHRtYXBGaWx0ZXJSYW5nZSIsIm1heCIsImxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyIsInByZWZpbHRlcmVkQ3ViZW1hcHMiLCJjdWJlbWFwcyIsImNoYW5nZWQiLCJsZW5ndGgiLCJzb21lIiwiYyIsImkiLCJjb21wbGV0ZSIsImV2ZXJ5IiwiRW52TGlnaHRpbmciLCJnZW5lcmF0ZVByZWZpbHRlcmVkQXRsYXMiLCJ0YXJnZXQiLCJzbGljZSIsInNreWJveCIsInNreWJveEludGVuc2l0eSIsInNreWJveEx1bWluYW5jZSIsInNreWJveE1pcCIsInNreWJveFJvdGF0aW9uIiwiZXF1YWxzIiwiaXNJZGVudGl0eSIsIklERU5USVRZIiwiY29weSIsInNldElkZW50aXR5Iiwic2V0VFJTIiwiWkVSTyIsIk9ORSIsImludmVydE1hdDQiLCJ0b25lTWFwcGluZyIsIm9mZiIsImRyYXdMaW5lIiwic3RhcnQiLCJlbmQiLCJjb2xvciIsIldISVRFIiwiZGVwdGhUZXN0IiwibGF5ZXIiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkcmF3TGluZUFycmF5cyIsImFkZExpbmVzQXJyYXlzIiwiYXBwbHlTZXR0aW5ncyIsInNldHRpbmdzIiwiX3JlbmRlciRza3lib3hJbnRlbnNpIiwiX3JlbmRlciRza3lib3hMdW1pbmFuIiwiX3JlbmRlciRza3lib3hNaXAiLCJfcmVuZGVyJGNsdXN0ZXJlZExpZ2giLCJwaHlzaWNzIiwicmVuZGVyIiwic2V0IiwiZ3Jhdml0eSIsImdsb2JhbF9hbWJpZW50IiwiZm9nX2NvbG9yIiwiZm9nX3N0YXJ0IiwiZm9nX2VuZCIsImZvZ19kZW5zaXR5IiwiZ2FtbWFfY29ycmVjdGlvbiIsInRvbmVtYXBwaW5nIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZm9yRWFjaCIsInNldHRpbmciLCJoYXNPd25Qcm9wZXJ0eSIsIl9nZXRTa3lib3hUZXgiLCJza3lib3hNYXBwaW5nIiwiX3VwZGF0ZVNreU1lc2giLCJza3lNZXNoIiwidXBkYXRlU2t5TWVzaCIsInVwZGF0ZSIsInJlc2V0U2t5TWVzaCIsInNldFNreWJveCIsImN1YmVtYXAiLCJsaWdodG1hcFBpeGVsRm9ybWF0IiwiZ2V0UmVuZGVyYWJsZUhkckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiRVZFTlRfU0VUTEFZRVJTIiwiRVZFTlRfU0VUU0tZQk9YIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxLQUFLLFNBQVNDLFlBQVksQ0FBQztBQWlNN0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsY0FBYyxFQUFFO0FBQ3hCLElBQUEsS0FBSyxFQUFFLENBQUE7QUFsS1g7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsV0FBVyxHQUFHLEtBQUssQ0FBQTtBQUVuQjtBQUNK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
