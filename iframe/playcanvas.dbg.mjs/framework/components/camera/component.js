import { Debug } from '../../../core/debug.js';
import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';

/**
 * Callback used by {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}.
 *
 * @callback CalculateMatrixCallback
 * @param {import('../../../core/math/mat4.js').Mat4} transformMatrix - Output of the function.
 * @param {number} view - Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}. Left and right are only used in stereo rendering.
 */

/**
 * The Camera Component enables an Entity to render the scene. A scene requires at least one
 * enabled camera component to be rendered. Note that multiple camera components can be enabled
 * simultaneously (for split-screen or offscreen rendering, for example).
 *
 * ```javascript
 * // Add a pc.CameraComponent to an entity
 * const entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 *
 * // Get the pc.CameraComponent on an entity
 * const cameraComponent = entity.camera;
 *
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * ```
 *
 * @augments Component
 * @category Graphics
 */
class CameraComponent extends Component {
  /**
   * Create a new CameraComponent instance.
   *
   * @param {import('./system.js').CameraComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    /**
     * Custom function that is called when postprocessing should execute.
     *
     * @type {Function}
     * @ignore
     */
    this.onPostprocessing = null;
    /**
     * Custom function that is called before the camera renders the scene.
     *
     * @type {Function}
     */
    this.onPreRender = null;
    /**
     * Custom function that is called after the camera renders the scene.
     *
     * @type {Function}
     */
    this.onPostRender = null;
    /**
     * A counter of requests of depth map rendering.
     *
     * @type {number}
     * @private
     */
    this._renderSceneDepthMap = 0;
    /**
     * A counter of requests of color map rendering.
     *
     * @type {number}
     * @private
     */
    this._renderSceneColorMap = 0;
    /** @private */
    this._sceneDepthMapRequested = false;
    /** @private */
    this._sceneColorMapRequested = false;
    /** @private */
    this._priority = 0;
    /**
     * Layer id at which the postprocessing stops for the camera.
     *
     * @type {number}
     * @private
     */
    this._disablePostEffectsLayer = LAYERID_UI;
    /** @private */
    this._camera = new Camera();
    this._camera.node = entity;

    // postprocessing management
    this._postEffects = new PostEffectQueue(system.app, this);
  }

  /**
   * Sets the name of the shader pass the camera will use when rendering.
   *
   * In addition to existing names (see the parameter description), a new name can be specified,
   * which creates a new shader pass with the given name. The name provided can only use
   * alphanumeric characters and underscores. When a shader is compiled for the new pass, a define
   * is added to the shader. For example, if the name is 'custom_rendering', the define
   * 'CUSTOM_RENDERING_PASS' is added to the shader, allowing the shader code to conditionally
   * execute code only when that shader pass is active.
   *
   * Another instance where this approach may prove useful is when a camera needs to render a more
   * cost-effective version of shaders, such as when creating a reflection texture. To accomplish
   * this, a callback on the material that triggers during shader compilation can be used. This
   * callback can modify the shader generation options specifically for this shader pass.
   *
   * ```javascript
   * const shaderPassId = camera.setShaderPass('custom_rendering');
   *
   * material.onUpdateShader = function (options) {
   *     if (options.pass === shaderPassId) {
   *         options.litOptions.normalMapEnabled = false;
   *         options.litOptions.useSpecular = false;
   *     }
   *     return options;
   * };
   * ```
   *
   * @param {string} name - The name of the shader pass. Defaults to undefined, which is
   * equivalent to {@link SHADERPASS_FORWARD}. Can be:
   *
   * - {@link SHADERPASS_FORWARD}
   * - {@link SHADERPASS_ALBEDO}
   * - {@link SHADERPASS_OPACITY}
   * - {@link SHADERPASS_WORLDNORMAL}
   * - {@link SHADERPASS_SPECULARITY}
   * - {@link SHADERPASS_GLOSS}
   * - {@link SHADERPASS_METALNESS}
   * - {@link SHADERPASS_AO}
   * - {@link SHADERPASS_EMISSION}
   * - {@link SHADERPASS_LIGHTING}
   * - {@link SHADERPASS_UV0}
   *
   * @returns {number} The id of the shader pass.
   */
  setShaderPass(name) {
    const shaderPass = ShaderPass.get(this.system.app.graphicsDevice);
    const shaderPassInfo = name ? shaderPass.allocate(name, {
      isForward: true
    }) : null;
    this._camera.shaderPassInfo = shaderPassInfo;
    return shaderPassInfo.index;
  }

  /**
   * Shader pass name.
   *
   * @returns {string} The name of the shader pass, or undefined if no shader pass is set.
   */
  getShaderPass() {
    var _this$_camera$shaderP;
    return (_this$_camera$shaderP = this._camera.shaderPassInfo) == null ? void 0 : _this$_camera$shaderP.name;
  }

  /**
   * Sets the render passes the camera will use for rendering, instead of its default rendering.
   * Set this to an empty array to return to the default behavior.
   *
   * @type {import('../../../platform/graphics/render-pass.js').RenderPass[]}
   * @ignore
   */
  set renderPasses(passes) {
    this._camera.renderPasses = passes;
  }
  get renderPasses() {
    return this._camera.renderPasses;
  }

  /**
   * Set camera aperture in f-stops, the default value is 16.0. Higher value means less exposure.
   *
   * @type {number}
   */
  set aperture(value) {
    this._camera.aperture = value;
  }
  get aperture() {
    return this._camera.aperture;
  }

  /**
   * The aspect ratio (width divided by height) of the camera. If aspectRatioMode is
   * {@link ASPECT_AUTO}, then this value will be automatically calculated every frame, and you
   * can only read it. If it's ASPECT_MANUAL, you can set the value.
   *
   * @type {number}
   */
  set aspectRatio(value) {
    this._camera.aspectRatio = value;
  }
  get aspectRatio() {
    return this._camera.aspectRatio;
  }

  /**
   * The aspect ratio mode of the camera. Can be:
   *
   * - {@link ASPECT_AUTO}: aspect ratio will be calculated from the current render
   * target's width divided by height.
   * - {@link ASPECT_MANUAL}: use the aspectRatio value.
   *
   * Defaults to {@link ASPECT_AUTO}.
   *
   * @type {number}
   */
  set aspectRatioMode(value) {
    this._camera.aspectRatioMode = value;
  }
  get aspectRatioMode() {
    return this._camera.aspectRatioMode;
  }

  /**
   * Custom function you can provide to calculate the camera projection matrix manually. Can be
   * used for complex effects like doing oblique projection. Function is called using component's
   * scope. Arguments:
   *
   * - {@link Mat4} transformMatrix: output of the function
   * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
   *
   * Left and right are only used in stereo rendering.
   *
   * @type {CalculateMatrixCallback}
   */
  set calculateProjection(value) {
    this._camera.calculateProjection = value;
  }
  get calculateProjection() {
    return this._camera.calculateProjection;
  }

  /**
   * Custom function you can provide to calculate the camera transformation matrix manually. Can
   * be used for complex effects like reflections. Function is called using component's scope.
   * Arguments:
   *
   * - {@link Mat4} transformMatrix: output of the function.
   * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
   *
   * Left and right are only used in stereo rendering.
   *
   * @type {CalculateMatrixCallback}
   */
  set calculateTransform(value) {
    this._camera.calculateTransform = value;
  }
  get calculateTransform() {
    return this._camera.calculateTransform;
  }

  /**
   * Queries the camera component's underlying Camera instance.
   *
   * @type {Camera}
   * @ignore
   */
  get camera() {
    return this._camera;
  }

  /**
   * The color used to clear the canvas to before the camera starts to render. Defaults to
   * [0.75, 0.75, 0.75, 1].
   *
   * @type {import('../../../core/math/color.js').Color}
   */
  set clearColor(value) {
    this._camera.clearColor = value;
  }
  get clearColor() {
    return this._camera.clearColor;
  }

  /**
   * If true the camera will clear the color buffer to the color set in clearColor. Defaults to true.
   *
   * @type {boolean}
   */
  set clearColorBuffer(value) {
    this._camera.clearColorBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearColorBuffer() {
    return this._camera.clearColorBuffer;
  }

  /**
   * If true the camera will clear the depth buffer. Defaults to true.
   *
   * @type {boolean}
   */
  set clearDepthBuffer(value) {
    this._camera.clearDepthBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearDepthBuffer() {
    return this._camera.clearDepthBuffer;
  }

  /**
   * If true the camera will clear the stencil buffer. Defaults to true.
   *
   * @type {boolean}
   */
  set clearStencilBuffer(value) {
    this._camera.clearStencilBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearStencilBuffer() {
    return this._camera.clearStencilBuffer;
  }

  /**
   * If true the camera will take material.cull into account. Otherwise both front and back faces
   * will be rendered. Defaults to true.
   *
   * @type {boolean}
   */
  set cullFaces(value) {
    this._camera.cullFaces = value;
  }
  get cullFaces() {
    return this._camera.cullFaces;
  }

  /**
   * Layer ID of a layer on which the postprocessing of the camera stops being applied to.
   * Defaults to LAYERID_UI, which causes post processing to not be applied to UI layer and any
   * following layers for the camera. Set to undefined for post-processing to be applied to all
   * layers of the camera.
   *
   * @type {number}
   */
  set disablePostEffectsLayer(layer) {
    this._disablePostEffectsLayer = layer;
    this.dirtyLayerCompositionCameras();
  }
  get disablePostEffectsLayer() {
    return this._disablePostEffectsLayer;
  }

  /**
   * The distance from the camera after which no rendering will take place. Defaults to 1000.
   *
   * @type {number}
   */
  set farClip(value) {
    this._camera.farClip = value;
  }
  get farClip() {
    return this._camera.farClip;
  }

  /**
   * If true the camera will invert front and back faces. Can be useful for reflection rendering.
   * Defaults to false.
   *
   * @type {boolean}
   */
  set flipFaces(value) {
    this._camera.flipFaces = value;
  }
  get flipFaces() {
    return this._camera.flipFaces;
  }

  /**
   * The field of view of the camera in degrees. Usually this is the Y-axis field of view, see
   * {@link CameraComponent#horizontalFov}. Used for {@link PROJECTION_PERSPECTIVE} cameras only.
   * Defaults to 45.
   *
   * @type {number}
   */
  set fov(value) {
    this._camera.fov = value;
  }
  get fov() {
    return this._camera.fov;
  }

  /**
   * Queries the camera's frustum shape.
   *
   * @type {import('../../../core/shape/frustum.js').Frustum}
   */
  get frustum() {
    return this._camera.frustum;
  }

  /**
   * Controls the culling of mesh instances against the camera frustum, i.e. if objects outside
   * of camera should be omitted from rendering. If false, all mesh instances in the scene are
   * rendered by the camera, regardless of visibility. Defaults to false.
   *
   * @type {boolean}
   */
  set frustumCulling(value) {
    this._camera.frustumCulling = value;
  }
  get frustumCulling() {
    return this._camera.frustumCulling;
  }

  /**
   * Set which axis to use for the Field of View calculation. Defaults to false.
   *
   * @type {boolean}
   */
  set horizontalFov(value) {
    this._camera.horizontalFov = value;
  }
  get horizontalFov() {
    return this._camera.horizontalFov;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which this camera should belong. Don't push,
   * pop, splice or modify this array, if you want to change it, set a new one instead. Defaults
   * to [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE].
   *
   * @type {number[]}
   */
  set layers(newValue) {
    const layers = this._camera.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (!layer) continue;
      layer.removeCamera(this);
    }
    this._camera.layers = newValue;
    if (!this.enabled || !this.entity.enabled) return;
    for (let i = 0; i < newValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
      if (!layer) continue;
      layer.addCamera(this);
    }
  }
  get layers() {
    return this._camera.layers;
  }
  get layersSet() {
    return this._camera.layersSet;
  }

  /**
   * A jitter intensity applied in the projection matrix. Used for jittered sampling by TAA.
   * A value of 1 represents a jitter in the range of [-1 to 1] of a pixel. Smaller values result
   * in a crisper yet more aliased outcome, whereas increased values produce smoother but blurred
   * result. Defaults to 0, representing no jitter.
   *
   * @type {number}
   */
  set jitter(value) {
    this._camera.jitter = value;
  }
  get jitter() {
    return this._camera.jitter;
  }

  /**
   * The distance from the camera before which no rendering will take place. Defaults to 0.1.
   *
   * @type {number}
   */
  set nearClip(value) {
    this._camera.nearClip = value;
  }
  get nearClip() {
    return this._camera.nearClip;
  }

  /**
   * The half-height of the orthographic view window (in the Y-axis). Used for
   * {@link PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
   *
   * @type {number}
   */
  set orthoHeight(value) {
    this._camera.orthoHeight = value;
  }
  get orthoHeight() {
    return this._camera.orthoHeight;
  }
  get postEffects() {
    return this._postEffects;
  }

  /**
   * The post effects queue for this camera. Use this to add or remove post effects from the camera.
   *
   * @type {PostEffectQueue}
   */
  get postEffectsEnabled() {
    return this._postEffects.enabled;
  }

  /**
   * Controls the order in which cameras are rendered. Cameras with smaller values for priority
   * are rendered first. Defaults to 0.
   *
   * @type {number}
   */
  set priority(newValue) {
    this._priority = newValue;
    this.dirtyLayerCompositionCameras();
  }
  get priority() {
    return this._priority;
  }

  /**
   * The type of projection used to render the camera. Can be:
   *
   * - {@link PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
   * resembles a truncated pyramid.
   * - {@link PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
   * frustum is a cuboid.
   *
   * Defaults to {@link PROJECTION_PERSPECTIVE}.
   *
   * @type {number}
   */
  set projection(value) {
    this._camera.projection = value;
  }
  get projection() {
    return this._camera.projection;
  }

  /**
   * Queries the camera's projection matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get projectionMatrix() {
    return this._camera.projectionMatrix;
  }

  /**
   * Controls where on the screen the camera will be rendered in normalized screen coordinates.
   * Defaults to [0, 0, 1, 1].
   *
   * @type {import('../../../core/math/vec4.js').Vec4}
   */
  set rect(value) {
    this._camera.rect = value;
    this.fire('set:rect', this._camera.rect);
  }
  get rect() {
    return this._camera.rect;
  }
  set renderSceneColorMap(value) {
    if (value && !this._sceneColorMapRequested) {
      this.requestSceneColorMap(true);
      this._sceneColorMapRequested = true;
    } else if (this._sceneColorMapRequested) {
      this.requestSceneColorMap(false);
      this._sceneColorMapRequested = false;
    }
  }
  get renderSceneColorMap() {
    return this._renderSceneColorMap > 0;
  }
  set renderSceneDepthMap(value) {
    if (value && !this._sceneDepthMapRequested) {
      this.requestSceneDepthMap(true);
      this._sceneDepthMapRequested = true;
    } else if (this._sceneDepthMapRequested) {
      this.requestSceneDepthMap(false);
      this._sceneDepthMapRequested = false;
    }
  }
  get renderSceneDepthMap() {
    return this._renderSceneDepthMap > 0;
  }

  /**
   * Render target to which rendering of the cameras is performed. If not set, it will render
   * simply to the screen.
   *
   * @type {import('../../../platform/graphics/render-target.js').RenderTarget}
   */
  set renderTarget(value) {
    this._camera.renderTarget = value;
    this.dirtyLayerCompositionCameras();
  }
  get renderTarget() {
    return this._camera.renderTarget;
  }

  /**
   * Clips all pixels which are not in the rectangle. The order of the values is
   * [x, y, width, height]. Defaults to [0, 0, 1, 1].
   *
   * @type {import('../../../core/math/vec4.js').Vec4}
   */
  set scissorRect(value) {
    this._camera.scissorRect = value;
  }
  get scissorRect() {
    return this._camera.scissorRect;
  }

  /**
   * Set camera sensitivity in ISO, the default value is 1000. Higher value means more exposure.
   *
   * @type {number}
   */
  set sensitivity(value) {
    this._camera.sensitivity = value;
  }
  get sensitivity() {
    return this._camera.sensitivity;
  }

  /**
   * Set camera shutter speed in seconds, the default value is 1/1000s. Longer shutter means more exposure.
   *
   * @type {number}
   */
  set shutter(value) {
    this._camera.shutter = value;
  }
  get shutter() {
    return this._camera.shutter;
  }

  /**
   * Queries the camera's view matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get viewMatrix() {
    return this._camera.viewMatrix;
  }

  /**
   * Based on the value, the depth layer's enable counter is incremented or decremented.
   *
   * @param {boolean} value - True to increment the counter, false to decrement it.
   * @returns {boolean} True if the counter was incremented or decremented, false if the depth
   * layer is not present.
   * @private
   */
  _enableDepthLayer(value) {
    const hasDepthLayer = this.layers.find(layerId => layerId === LAYERID_DEPTH);
    if (hasDepthLayer) {
      /** @type {import('../../../scene/layer.js').Layer} */
      const depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
      if (value) {
        depthLayer == null || depthLayer.incrementCounter();
      } else {
        depthLayer == null || depthLayer.decrementCounter();
      }
    } else if (value) {
      return false;
    }
    return true;
  }

  /**
   * Request the scene to generate a texture containing the scene color map. Note that this call
   * is accumulative, and for each enable request, a disable request need to be called.
   *
   * @param {boolean} enabled - True to request the generation, false to disable it.
   */
  requestSceneColorMap(enabled) {
    this._renderSceneColorMap += enabled ? 1 : -1;
    Debug.assert(this._renderSceneColorMap >= 0);
    const ok = this._enableDepthLayer(enabled);
    if (!ok) {
      Debug.warnOnce('CameraComponent.requestSceneColorMap was called, but the camera does not have a Depth layer, ignoring.');
    }
    this.camera._enableRenderPassColorGrab(this.system.app.graphicsDevice, this.renderSceneColorMap);
  }

  /**
   * Request the scene to generate a texture containing the scene depth map. Note that this call
   * is accumulative, and for each enable request, a disable request need to be called.
   *
   * @param {boolean} enabled - True to request the generation, false to disable it.
   */
  requestSceneDepthMap(enabled) {
    this._renderSceneDepthMap += enabled ? 1 : -1;
    Debug.assert(this._renderSceneDepthMap >= 0);
    const ok = this._enableDepthLayer(enabled);
    if (!ok) {
      Debug.warnOnce('CameraComponent.requestSceneDepthMap was called, but the camera does not have a Depth layer, ignoring.');
    }
    this.camera._enableRenderPassDepthGrab(this.system.app.graphicsDevice, this.system.app.renderer, this.renderSceneDepthMap);
  }
  dirtyLayerCompositionCameras() {
    // layer composition needs to update order
    const layerComp = this.system.app.scene.layers;
    layerComp._dirty = true;
  }

  /**
   * Convert a point from 2D screen space to 3D world space.
   *
   * @param {number} screenx - X coordinate on PlayCanvas' canvas element. Should be in the range
   * 0 to `canvas.offsetWidth` of the application's canvas element.
   * @param {number} screeny - Y coordinate on PlayCanvas' canvas element. Should be in the range
   * 0 to `canvas.offsetHeight` of the application's canvas element.
   * @param {number} cameraz - The distance from the camera in world space to create the new
   * point.
   * @param {import('../../../core/math/vec3.js').Vec3} [worldCoord] - 3D vector to receive world
   * coordinate result.
   * @example
   * // Get the start and end points of a 3D ray fired from a screen click position
   * const start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
   * const end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
   *
   * // Use the ray coordinates to perform a raycast
   * app.systems.rigidbody.raycastFirst(start, end, function (result) {
   *     console.log("Entity " + result.entity.name + " was selected");
   * });
   * @returns {import('../../../core/math/vec3.js').Vec3} The world space coordinate.
   */
  screenToWorld(screenx, screeny, cameraz, worldCoord) {
    const device = this.system.app.graphicsDevice;
    const w = device.clientRect.width;
    const h = device.clientRect.height;
    return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
  }

  /**
   * Convert a point from 3D world space to 2D screen space.
   *
   * @param {import('../../../core/math/vec3.js').Vec3} worldCoord - The world space coordinate.
   * @param {import('../../../core/math/vec3.js').Vec3} [screenCoord] - 3D vector to receive
   * screen coordinate result.
   * @returns {import('../../../core/math/vec3.js').Vec3} The screen space coordinate.
   */
  worldToScreen(worldCoord, screenCoord) {
    const device = this.system.app.graphicsDevice;
    const w = device.clientRect.width;
    const h = device.clientRect.height;
    return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
  }

  /**
   * Called before application renders the scene.
   *
   * @ignore
   */
  onAppPrerender() {
    this._camera._viewMatDirty = true;
    this._camera._viewProjMatDirty = true;
  }

  /** @private */
  addCameraToLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.addCamera(this);
      }
    }
  }

  /** @private */
  removeCameraFromLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.removeCamera(this);
      }
    }
  }

  /**
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} oldComp - Old layer composition.
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} newComp - New layer composition.
   * @private
   */
  onLayersChanged(oldComp, newComp) {
    this.addCameraToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }

  /**
   * @param {import('../../../scene/layer.js').Layer} layer - The layer to add the camera to.
   * @private
   */
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addCamera(this);
  }

  /**
   * @param {import('../../../scene/layer.js').Layer} layer - The layer to remove the camera from.
   * @private
   */
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeCamera(this);
  }
  onEnable() {
    const system = this.system;
    const scene = system.app.scene;
    const layers = scene.layers;
    system.addCamera(this);
    scene.on('set:layers', this.onLayersChanged, this);
    if (layers) {
      layers.on('add', this.onLayerAdded, this);
      layers.on('remove', this.onLayerRemoved, this);
    }
    if (this.enabled && this.entity.enabled) {
      this.addCameraToLayers();
    }
    this.postEffects.enable();
  }
  onDisable() {
    const system = this.system;
    const scene = system.app.scene;
    const layers = scene.layers;
    this.postEffects.disable();
    this.removeCameraFromLayers();
    scene.off('set:layers', this.onLayersChanged, this);
    if (layers) {
      layers.off('add', this.onLayerAdded, this);
      layers.off('remove', this.onLayerRemoved, this);
    }
    system.removeCamera(this);
  }
  onRemove() {
    this.onDisable();
    this.off();
    this.camera.destroy();
  }

  /**
   * Calculates aspect ratio value for a given render target.
   *
   * @param {import('../../../platform/graphics/render-target.js').RenderTarget|null} [rt] - Optional
   * render target. If unspecified, the backbuffer is used.
   * @returns {number} The aspect ratio of the render target (or backbuffer).
   */
  calculateAspectRatio(rt) {
    const device = this.system.app.graphicsDevice;
    const width = rt ? rt.width : device.width;
    const height = rt ? rt.height : device.height;
    return width * this.rect.z / (height * this.rect.w);
  }

  /**
   * Prepare the camera for frame rendering.
   *
   * @param {import('../../../platform/graphics/render-target.js').RenderTarget|null} rt - Render
   * target to which rendering will be performed. Will affect camera's aspect ratio, if
   * aspectRatioMode is {@link ASPECT_AUTO}.
   * @ignore
   */
  frameUpdate(rt) {
    if (this.aspectRatioMode === ASPECT_AUTO) {
      this.aspectRatio = this.calculateAspectRatio(rt);
    }
  }

  /**
   * Attempt to start XR session with this camera.
   *
   * @param {string} type - The type of session. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited feature
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to the VR device
   * with the best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to the VR/AR
   * device that is intended to be blended with the real-world environment.
   *
   * @param {string} spaceType - Reference space type. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
   * capabilities.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation. It is meant for seated or basic local XR sessions.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y-axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform. It is meant for seated or
   * basic local XR sessions.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {object} [options] - Object with options for XR session initialization.
   * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
   * used for getting access to additional WebXR spec extensions.
   * @param {boolean} [options.imageTracking] - Set to true to attempt to enable {@link XrImageTracking}.
   * @param {boolean} [options.planeDetection] - Set to true to attempt to enable {@link XrPlaneDetection}.
   * @param {import('../../xr/xr-manager.js').XrErrorCallback} [options.callback] - Optional
   * callback function called once the session is started. The callback has one argument Error -
   * it is null if the XR session started successfully.
   * @param {boolean} [options.anchors] - Optional boolean to attempt to enable {@link XrAnchors}.
   * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
   * attempt to enable {@link XrDepthSensing}.
   * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
   * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
   * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
   * system.
   * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
   * preference for depth sensing. Can be 'luminance-alpha' or 'float32' (XRDEPTHSENSINGFORMAT_*),
   * defaults to 'luminance-alpha'. Most preferred and supported will be chosen by the underlying
   * depth sensing system.
   * @example
   * // On an entity with a camera component
   * this.entity.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
   *     callback: function (err) {
   *         if (err) {
   *             // failed to start XR session
   *         } else {
   *             // in XR
   *         }
   *     }
   * });
   */
  startXr(type, spaceType, options) {
    this.system.app.xr.start(this, type, spaceType, options);
  }

  /**
   * Attempt to end XR session of this camera.
   *
   * @param {import('../../xr/xr-manager.js').XrErrorCallback} [callback] - Optional callback
   * function called once session is ended. The callback has one argument Error - it is null if
   * successfully ended XR session.
   * @example
   * // On an entity with a camera component
   * this.entity.camera.endXr(function (err) {
   *     // not anymore in XR
   * });
   */
  endXr(callback) {
    if (!this._camera.xr) {
      if (callback) callback(new Error('Camera is not in XR'));
      return;
    }
    this._camera.xr.end(callback);
  }

  /**
   * Function to copy properties from the source CameraComponent.
   * Properties not copied: postEffects.
   * Inherited properties not copied (all): system, entity, enabled.
   *
   * @param {CameraComponent} source - The source component.
   * @ignore
   */
  copy(source) {
    this.aperture = source.aperture;
    this.aspectRatio = source.aspectRatio;
    this.aspectRatioMode = source.aspectRatioMode;
    this.calculateProjection = source.calculateProjection;
    this.calculateTransform = source.calculateTransform;
    this.clearColor = source.clearColor;
    this.clearColorBuffer = source.clearColorBuffer;
    this.clearDepthBuffer = source.clearDepthBuffer;
    this.clearStencilBuffer = source.clearStencilBuffer;
    this.cullFaces = source.cullFaces;
    this.disablePostEffectsLayer = source.disablePostEffectsLayer;
    this.farClip = source.farClip;
    this.flipFaces = source.flipFaces;
    this.fov = source.fov;
    this.frustumCulling = source.frustumCulling;
    this.horizontalFov = source.horizontalFov;
    this.layers = source.layers;
    this.nearClip = source.nearClip;
    this.orthoHeight = source.orthoHeight;
    this.priority = source.priority;
    this.projection = source.projection;
    this.rect = source.rect;
    this.renderTarget = source.renderTarget;
    this.scissorRect = source.scissorRect;
    this.sensitivity = source.sensitivity;
    this.shutter = source.shutter;
  }
}

export { CameraComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBU1BFQ1RfQVVUTywgTEFZRVJJRF9VSSwgTEFZRVJJRF9ERVBUSCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDYW1lcmEgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jYW1lcmEuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3NoYWRlci1wYXNzLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi9wb3N0LWVmZmVjdC1xdWV1ZS5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0uXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZU1hdHJpeENhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fSB0cmFuc2Zvcm1NYXRyaXggLSBPdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IHZpZXcgLSBUeXBlIG9mIHZpZXcuIENhbiBiZSB7QGxpbmsgVklFV19DRU5URVJ9LCB7QGxpbmsgVklFV19MRUZUfSBvciB7QGxpbmsgVklFV19SSUdIVH0uIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSBDYW1lcmEgQ29tcG9uZW50IGVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciB0aGUgc2NlbmUuIEEgc2NlbmUgcmVxdWlyZXMgYXQgbGVhc3Qgb25lXG4gKiBlbmFibGVkIGNhbWVyYSBjb21wb25lbnQgdG8gYmUgcmVuZGVyZWQuIE5vdGUgdGhhdCBtdWx0aXBsZSBjYW1lcmEgY29tcG9uZW50cyBjYW4gYmUgZW5hYmxlZFxuICogc2ltdWx0YW5lb3VzbHkgKGZvciBzcGxpdC1zY3JlZW4gb3Igb2Zmc2NyZWVuIHJlbmRlcmluZywgZm9yIGV4YW1wbGUpLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEFkZCBhIHBjLkNhbWVyYUNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIHtcbiAqICAgICBuZWFyQ2xpcDogMSxcbiAqICAgICBmYXJDbGlwOiAxMDAsXG4gKiAgICAgZm92OiA1NVxuICogfSk7XG4gKlxuICogLy8gR2V0IHRoZSBwYy5DYW1lcmFDb21wb25lbnQgb24gYW4gZW50aXR5XG4gKiBjb25zdCBjYW1lcmFDb21wb25lbnQgPSBlbnRpdHkuY2FtZXJhO1xuICpcbiAqIC8vIFVwZGF0ZSBhIHByb3BlcnR5IG9uIGEgY2FtZXJhIGNvbXBvbmVudFxuICogZW50aXR5LmNhbWVyYS5uZWFyQ2xpcCA9IDI7XG4gKiBgYGBcbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgQ2FtZXJhQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBwb3N0cHJvY2Vzc2luZyBzaG91bGQgZXhlY3V0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25Qb3N0cHJvY2Vzc2luZyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHRoZSBjYW1lcmEgcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICovXG4gICAgb25QcmVSZW5kZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBjYW1lcmEgcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICovXG4gICAgb25Qb3N0UmVuZGVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEEgY291bnRlciBvZiByZXF1ZXN0cyBvZiBkZXB0aCBtYXAgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZW5kZXJTY2VuZURlcHRoTWFwID0gMDtcblxuICAgIC8qKlxuICAgICAqIEEgY291bnRlciBvZiByZXF1ZXN0cyBvZiBjb2xvciBtYXAgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZW5kZXJTY2VuZUNvbG9yTWFwID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9zY2VuZURlcHRoTWFwUmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2NlbmVDb2xvck1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3ByaW9yaXR5ID0gMDtcblxuICAgIC8qKlxuICAgICAqIExheWVyIGlkIGF0IHdoaWNoIHRoZSBwb3N0cHJvY2Vzc2luZyBzdG9wcyBmb3IgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIgPSBMQVlFUklEX1VJO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2NhbWVyYSA9IG5ldyBDYW1lcmEoKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDYW1lcmFDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5DYW1lcmFDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX2NhbWVyYS5ub2RlID0gZW50aXR5O1xuXG4gICAgICAgIC8vIHBvc3Rwcm9jZXNzaW5nIG1hbmFnZW1lbnRcbiAgICAgICAgdGhpcy5fcG9zdEVmZmVjdHMgPSBuZXcgUG9zdEVmZmVjdFF1ZXVlKHN5c3RlbS5hcHAsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIG5hbWUgb2YgdGhlIHNoYWRlciBwYXNzIHRoZSBjYW1lcmEgd2lsbCB1c2Ugd2hlbiByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBJbiBhZGRpdGlvbiB0byBleGlzdGluZyBuYW1lcyAoc2VlIHRoZSBwYXJhbWV0ZXIgZGVzY3JpcHRpb24pLCBhIG5ldyBuYW1lIGNhbiBiZSBzcGVjaWZpZWQsXG4gICAgICogd2hpY2ggY3JlYXRlcyBhIG5ldyBzaGFkZXIgcGFzcyB3aXRoIHRoZSBnaXZlbiBuYW1lLiBUaGUgbmFtZSBwcm92aWRlZCBjYW4gb25seSB1c2VcbiAgICAgKiBhbHBoYW51bWVyaWMgY2hhcmFjdGVycyBhbmQgdW5kZXJzY29yZXMuIFdoZW4gYSBzaGFkZXIgaXMgY29tcGlsZWQgZm9yIHRoZSBuZXcgcGFzcywgYSBkZWZpbmVcbiAgICAgKiBpcyBhZGRlZCB0byB0aGUgc2hhZGVyLiBGb3IgZXhhbXBsZSwgaWYgdGhlIG5hbWUgaXMgJ2N1c3RvbV9yZW5kZXJpbmcnLCB0aGUgZGVmaW5lXG4gICAgICogJ0NVU1RPTV9SRU5ERVJJTkdfUEFTUycgaXMgYWRkZWQgdG8gdGhlIHNoYWRlciwgYWxsb3dpbmcgdGhlIHNoYWRlciBjb2RlIHRvIGNvbmRpdGlvbmFsbHlcbiAgICAgKiBleGVjdXRlIGNvZGUgb25seSB3aGVuIHRoYXQgc2hhZGVyIHBhc3MgaXMgYWN0aXZlLlxuICAgICAqXG4gICAgICogQW5vdGhlciBpbnN0YW5jZSB3aGVyZSB0aGlzIGFwcHJvYWNoIG1heSBwcm92ZSB1c2VmdWwgaXMgd2hlbiBhIGNhbWVyYSBuZWVkcyB0byByZW5kZXIgYSBtb3JlXG4gICAgICogY29zdC1lZmZlY3RpdmUgdmVyc2lvbiBvZiBzaGFkZXJzLCBzdWNoIGFzIHdoZW4gY3JlYXRpbmcgYSByZWZsZWN0aW9uIHRleHR1cmUuIFRvIGFjY29tcGxpc2hcbiAgICAgKiB0aGlzLCBhIGNhbGxiYWNrIG9uIHRoZSBtYXRlcmlhbCB0aGF0IHRyaWdnZXJzIGR1cmluZyBzaGFkZXIgY29tcGlsYXRpb24gY2FuIGJlIHVzZWQuIFRoaXNcbiAgICAgKiBjYWxsYmFjayBjYW4gbW9kaWZ5IHRoZSBzaGFkZXIgZ2VuZXJhdGlvbiBvcHRpb25zIHNwZWNpZmljYWxseSBmb3IgdGhpcyBzaGFkZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIGBgYGphdmFzY3JpcHRcbiAgICAgKiBjb25zdCBzaGFkZXJQYXNzSWQgPSBjYW1lcmEuc2V0U2hhZGVyUGFzcygnY3VzdG9tX3JlbmRlcmluZycpO1xuICAgICAqXG4gICAgICogbWF0ZXJpYWwub25VcGRhdGVTaGFkZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAqICAgICBpZiAob3B0aW9ucy5wYXNzID09PSBzaGFkZXJQYXNzSWQpIHtcbiAgICAgKiAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5ub3JtYWxNYXBFbmFibGVkID0gZmFsc2U7XG4gICAgICogICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXIgPSBmYWxzZTtcbiAgICAgKiAgICAgfVxuICAgICAqICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgKiB9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyIHBhc3MuIERlZmF1bHRzIHRvIHVuZGVmaW5lZCwgd2hpY2ggaXNcbiAgICAgKiBlcXVpdmFsZW50IHRvIHtAbGluayBTSEFERVJQQVNTX0ZPUldBUkR9LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0ZPUldBUkR9XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19BTEJFRE99XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19PUEFDSVRZfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfV09STEROT1JNQUx9XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19TUEVDVUxBUklUWX1cbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0dMT1NTfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfTUVUQUxORVNTfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfQU99XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19FTUlTU0lPTn1cbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0xJR0hUSU5HfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfVVYwfVxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGlkIG9mIHRoZSBzaGFkZXIgcGFzcy5cbiAgICAgKi9cbiAgICBzZXRTaGFkZXJQYXNzKG5hbWUpIHtcbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzcyA9ICBTaGFkZXJQYXNzLmdldCh0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAgICBjb25zdCBzaGFkZXJQYXNzSW5mbyA9IG5hbWUgPyBzaGFkZXJQYXNzLmFsbG9jYXRlKG5hbWUsIHtcbiAgICAgICAgICAgIGlzRm9yd2FyZDogdHJ1ZVxuICAgICAgICB9KSA6IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5zaGFkZXJQYXNzSW5mbyA9IHNoYWRlclBhc3NJbmZvO1xuXG4gICAgICAgIHJldHVybiBzaGFkZXJQYXNzSW5mby5pbmRleDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaGFkZXIgcGFzcyBuYW1lLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIG5hbWUgb2YgdGhlIHNoYWRlciBwYXNzLCBvciB1bmRlZmluZWQgaWYgbm8gc2hhZGVyIHBhc3MgaXMgc2V0LlxuICAgICAqL1xuICAgIGdldFNoYWRlclBhc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuc2hhZGVyUGFzc0luZm8/Lm5hbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgcmVuZGVyIHBhc3NlcyB0aGUgY2FtZXJhIHdpbGwgdXNlIGZvciByZW5kZXJpbmcsIGluc3RlYWQgb2YgaXRzIGRlZmF1bHQgcmVuZGVyaW5nLlxuICAgICAqIFNldCB0aGlzIHRvIGFuIGVtcHR5IGFycmF5IHRvIHJldHVybiB0byB0aGUgZGVmYXVsdCBiZWhhdmlvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc1tdfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXQgcmVuZGVyUGFzc2VzKHBhc3Nlcykge1xuICAgICAgICB0aGlzLl9jYW1lcmEucmVuZGVyUGFzc2VzID0gcGFzc2VzO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJQYXNzZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucmVuZGVyUGFzc2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgYXBlcnR1cmUgaW4gZi1zdG9wcywgdGhlIGRlZmF1bHQgdmFsdWUgaXMgMTYuMC4gSGlnaGVyIHZhbHVlIG1lYW5zIGxlc3MgZXhwb3N1cmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhcGVydHVyZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuYXBlcnR1cmUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBlcnR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuYXBlcnR1cmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzcGVjdCByYXRpbyAod2lkdGggZGl2aWRlZCBieSBoZWlnaHQpIG9mIHRoZSBjYW1lcmEuIElmIGFzcGVjdFJhdGlvTW9kZSBpc1xuICAgICAqIHtAbGluayBBU1BFQ1RfQVVUT30sIHRoZW4gdGhpcyB2YWx1ZSB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgY2FsY3VsYXRlZCBldmVyeSBmcmFtZSwgYW5kIHlvdVxuICAgICAqIGNhbiBvbmx5IHJlYWQgaXQuIElmIGl0J3MgQVNQRUNUX01BTlVBTCwgeW91IGNhbiBzZXQgdGhlIHZhbHVlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXNwZWN0UmF0aW8odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmFzcGVjdFJhdGlvID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFzcGVjdFJhdGlvKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmFzcGVjdFJhdGlvO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3BlY3QgcmF0aW8gbW9kZSBvZiB0aGUgY2FtZXJhLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBU1BFQ1RfQVVUT306IGFzcGVjdCByYXRpbyB3aWxsIGJlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgY3VycmVudCByZW5kZXJcbiAgICAgKiB0YXJnZXQncyB3aWR0aCBkaXZpZGVkIGJ5IGhlaWdodC5cbiAgICAgKiAtIHtAbGluayBBU1BFQ1RfTUFOVUFMfTogdXNlIHRoZSBhc3BlY3RSYXRpbyB2YWx1ZS5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBBU1BFQ1RfQVVUT30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhc3BlY3RSYXRpb01vZGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmFzcGVjdFJhdGlvTW9kZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpb01vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuYXNwZWN0UmF0aW9Nb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmdW5jdGlvbiB5b3UgY2FuIHByb3ZpZGUgdG8gY2FsY3VsYXRlIHRoZSBjYW1lcmEgcHJvamVjdGlvbiBtYXRyaXggbWFudWFsbHkuIENhbiBiZVxuICAgICAqIHVzZWQgZm9yIGNvbXBsZXggZWZmZWN0cyBsaWtlIGRvaW5nIG9ibGlxdWUgcHJvamVjdGlvbi4gRnVuY3Rpb24gaXMgY2FsbGVkIHVzaW5nIGNvbXBvbmVudCdzXG4gICAgICogc2NvcGUuIEFyZ3VtZW50czpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIE1hdDR9IHRyYW5zZm9ybU1hdHJpeDogb3V0cHV0IG9mIHRoZSBmdW5jdGlvblxuICAgICAqIC0gdmlldzogVHlwZSBvZiB2aWV3LiBDYW4gYmUge0BsaW5rIFZJRVdfQ0VOVEVSfSwge0BsaW5rIFZJRVdfTEVGVH0gb3Ige0BsaW5rIFZJRVdfUklHSFR9LlxuICAgICAqXG4gICAgICogTGVmdCBhbmQgcmlnaHQgYXJlIG9ubHkgdXNlZCBpbiBzdGVyZW8gcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbGN1bGF0ZU1hdHJpeENhbGxiYWNrfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVQcm9qZWN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24geW91IGNhbiBwcm92aWRlIHRvIGNhbGN1bGF0ZSB0aGUgY2FtZXJhIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBtYW51YWxseS4gQ2FuXG4gICAgICogYmUgdXNlZCBmb3IgY29tcGxleCBlZmZlY3RzIGxpa2UgcmVmbGVjdGlvbnMuIEZ1bmN0aW9uIGlzIGNhbGxlZCB1c2luZyBjb21wb25lbnQncyBzY29wZS5cbiAgICAgKiBBcmd1bWVudHM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBNYXQ0fSB0cmFuc2Zvcm1NYXRyaXg6IG91dHB1dCBvZiB0aGUgZnVuY3Rpb24uXG4gICAgICogLSB2aWV3OiBUeXBlIG9mIHZpZXcuIENhbiBiZSB7QGxpbmsgVklFV19DRU5URVJ9LCB7QGxpbmsgVklFV19MRUZUfSBvciB7QGxpbmsgVklFV19SSUdIVH0uXG4gICAgICpcbiAgICAgKiBMZWZ0IGFuZCByaWdodCBhcmUgb25seSB1c2VkIGluIHN0ZXJlbyByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q2FsY3VsYXRlTWF0cml4Q2FsbGJhY2t9XG4gICAgICovXG4gICAgc2V0IGNhbGN1bGF0ZVRyYW5zZm9ybSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY2FtZXJhIGNvbXBvbmVudCdzIHVuZGVybHlpbmcgQ2FtZXJhIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbWVyYX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IGNhbWVyYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3IgdXNlZCB0byBjbGVhciB0aGUgY2FudmFzIHRvIGJlZm9yZSB0aGUgY2FtZXJhIHN0YXJ0cyB0byByZW5kZXIuIERlZmF1bHRzIHRvXG4gICAgICogWzAuNzUsIDAuNzUsIDAuNzUsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9XG4gICAgICovXG4gICAgc2V0IGNsZWFyQ29sb3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNsZWFyQ29sb3IgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJDb2xvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5jbGVhckNvbG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgdG8gdGhlIGNvbG9yIHNldCBpbiBjbGVhckNvbG9yLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyQ29sb3JCdWZmZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyRGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJTdGVuY2lsQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgdGFrZSBtYXRlcmlhbC5jdWxsIGludG8gYWNjb3VudC4gT3RoZXJ3aXNlIGJvdGggZnJvbnQgYW5kIGJhY2sgZmFjZXNcbiAgICAgKiB3aWxsIGJlIHJlbmRlcmVkLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGN1bGxGYWNlcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY3VsbEZhY2VzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGN1bGxGYWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5jdWxsRmFjZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGF5ZXIgSUQgb2YgYSBsYXllciBvbiB3aGljaCB0aGUgcG9zdHByb2Nlc3Npbmcgb2YgdGhlIGNhbWVyYSBzdG9wcyBiZWluZyBhcHBsaWVkIHRvLlxuICAgICAqIERlZmF1bHRzIHRvIExBWUVSSURfVUksIHdoaWNoIGNhdXNlcyBwb3N0IHByb2Nlc3NpbmcgdG8gbm90IGJlIGFwcGxpZWQgdG8gVUkgbGF5ZXIgYW5kIGFueVxuICAgICAqIGZvbGxvd2luZyBsYXllcnMgZm9yIHRoZSBjYW1lcmEuIFNldCB0byB1bmRlZmluZWQgZm9yIHBvc3QtcHJvY2Vzc2luZyB0byBiZSBhcHBsaWVkIHRvIGFsbFxuICAgICAqIGxheWVycyBvZiB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGRpc2FibGVQb3N0RWZmZWN0c0xheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIGNhbWVyYSBhZnRlciB3aGljaCBubyByZW5kZXJpbmcgd2lsbCB0YWtlIHBsYWNlLiBEZWZhdWx0cyB0byAxMDAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZmFyQ2xpcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuZmFyQ2xpcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmYXJDbGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZhckNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgaW52ZXJ0IGZyb250IGFuZCBiYWNrIGZhY2VzLiBDYW4gYmUgdXNlZnVsIGZvciByZWZsZWN0aW9uIHJlbmRlcmluZy5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwRmFjZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZsaXBGYWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmbGlwRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuZmxpcEZhY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmaWVsZCBvZiB2aWV3IG9mIHRoZSBjYW1lcmEgaW4gZGVncmVlcy4gVXN1YWxseSB0aGlzIGlzIHRoZSBZLWF4aXMgZmllbGQgb2Ygdmlldywgc2VlXG4gICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudCNob3Jpem9udGFsRm92fS4gVXNlZCBmb3Ige0BsaW5rIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkV9IGNhbWVyYXMgb25seS5cbiAgICAgKiBEZWZhdWx0cyB0byA0NS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZvdih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuZm92ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZvdigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5mb3Y7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY2FtZXJhJ3MgZnJ1c3R1bSBzaGFwZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvc2hhcGUvZnJ1c3R1bS5qcycpLkZydXN0dW19XG4gICAgICovXG4gICAgZ2V0IGZydXN0dW0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuZnJ1c3R1bTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgY3VsbGluZyBvZiBtZXNoIGluc3RhbmNlcyBhZ2FpbnN0IHRoZSBjYW1lcmEgZnJ1c3R1bSwgaS5lLiBpZiBvYmplY3RzIG91dHNpZGVcbiAgICAgKiBvZiBjYW1lcmEgc2hvdWxkIGJlIG9taXR0ZWQgZnJvbSByZW5kZXJpbmcuIElmIGZhbHNlLCBhbGwgbWVzaCBpbnN0YW5jZXMgaW4gdGhlIHNjZW5lIGFyZVxuICAgICAqIHJlbmRlcmVkIGJ5IHRoZSBjYW1lcmEsIHJlZ2FyZGxlc3Mgb2YgdmlzaWJpbGl0eS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZnJ1c3R1bUN1bGxpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZydXN0dW1DdWxsaW5nID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZydXN0dW1DdWxsaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZydXN0dW1DdWxsaW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB3aGljaCBheGlzIHRvIHVzZSBmb3IgdGhlIEZpZWxkIG9mIFZpZXcgY2FsY3VsYXRpb24uIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGhvcml6b250YWxGb3YodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmhvcml6b250YWxGb3YgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgaG9yaXpvbnRhbEZvdigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5ob3Jpem9udGFsRm92O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBjYW1lcmEgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCxcbiAgICAgKiBwb3AsIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0LCBzZXQgYSBuZXcgb25lIGluc3RlYWQuIERlZmF1bHRzXG4gICAgICogdG8gW0xBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyhuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLl9jYW1lcmEubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChsYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVDYW1lcmEodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jYW1lcmEubGF5ZXJzID0gbmV3VmFsdWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld1ZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKG5ld1ZhbHVlW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIuYWRkQ2FtZXJhKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyc1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5sYXllcnNTZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBqaXR0ZXIgaW50ZW5zaXR5IGFwcGxpZWQgaW4gdGhlIHByb2plY3Rpb24gbWF0cml4LiBVc2VkIGZvciBqaXR0ZXJlZCBzYW1wbGluZyBieSBUQUEuXG4gICAgICogQSB2YWx1ZSBvZiAxIHJlcHJlc2VudHMgYSBqaXR0ZXIgaW4gdGhlIHJhbmdlIG9mIFstMSB0byAxXSBvZiBhIHBpeGVsLiBTbWFsbGVyIHZhbHVlcyByZXN1bHRcbiAgICAgKiBpbiBhIGNyaXNwZXIgeWV0IG1vcmUgYWxpYXNlZCBvdXRjb21lLCB3aGVyZWFzIGluY3JlYXNlZCB2YWx1ZXMgcHJvZHVjZSBzbW9vdGhlciBidXQgYmx1cnJlZFxuICAgICAqIHJlc3VsdC4gRGVmYXVsdHMgdG8gMCwgcmVwcmVzZW50aW5nIG5vIGppdHRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGppdHRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuaml0dGVyID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGppdHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5qaXR0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIGNhbWVyYSBiZWZvcmUgd2hpY2ggbm8gcmVuZGVyaW5nIHdpbGwgdGFrZSBwbGFjZS4gRGVmYXVsdHMgdG8gMC4xLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbmVhckNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLm5lYXJDbGlwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG5lYXJDbGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLm5lYXJDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoYWxmLWhlaWdodCBvZiB0aGUgb3J0aG9ncmFwaGljIHZpZXcgd2luZG93IChpbiB0aGUgWS1heGlzKS4gVXNlZCBmb3JcbiAgICAgKiB7QGxpbmsgUFJPSkVDVElPTl9PUlRIT0dSQVBISUN9IGNhbWVyYXMgb25seS4gRGVmYXVsdHMgdG8gMTAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBvcnRob0hlaWdodCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEub3J0aG9IZWlnaHQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgb3J0aG9IZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEub3J0aG9IZWlnaHQ7XG4gICAgfVxuXG4gICAgZ2V0IHBvc3RFZmZlY3RzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9zdEVmZmVjdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBvc3QgZWZmZWN0cyBxdWV1ZSBmb3IgdGhpcyBjYW1lcmEuIFVzZSB0aGlzIHRvIGFkZCBvciByZW1vdmUgcG9zdCBlZmZlY3RzIGZyb20gdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtQb3N0RWZmZWN0UXVldWV9XG4gICAgICovXG4gICAgZ2V0IHBvc3RFZmZlY3RzRW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc3RFZmZlY3RzLmVuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIG9yZGVyIGluIHdoaWNoIGNhbWVyYXMgYXJlIHJlbmRlcmVkLiBDYW1lcmFzIHdpdGggc21hbGxlciB2YWx1ZXMgZm9yIHByaW9yaXR5XG4gICAgICogYXJlIHJlbmRlcmVkIGZpcnN0LiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcHJpb3JpdHkobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJpb3JpdHkgPSBuZXdWYWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IHByaW9yaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJpb3JpdHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgcHJvamVjdGlvbiB1c2VkIHRvIHJlbmRlciB0aGUgY2FtZXJhLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFfTogQSBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uLiBUaGUgY2FtZXJhIGZydXN0dW1cbiAgICAgKiByZXNlbWJsZXMgYSB0cnVuY2F0ZWQgcHlyYW1pZC5cbiAgICAgKiAtIHtAbGluayBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQ306IEFuIG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uLiBUaGUgY2FtZXJhXG4gICAgICogZnJ1c3R1bSBpcyBhIGN1Ym9pZC5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHByb2plY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnByb2plY3Rpb24gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcHJvamVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fVxuICAgICAqL1xuICAgIGdldCBwcm9qZWN0aW9uTWF0cml4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnByb2plY3Rpb25NYXRyaXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgd2hlcmUgb24gdGhlIHNjcmVlbiB0aGUgY2FtZXJhIHdpbGwgYmUgcmVuZGVyZWQgaW4gbm9ybWFsaXplZCBzY3JlZW4gY29vcmRpbmF0ZXMuXG4gICAgICogRGVmYXVsdHMgdG8gWzAsIDAsIDEsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fVxuICAgICAqL1xuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5yZWN0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnJlY3QnLCB0aGlzLl9jYW1lcmEucmVjdCk7XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucmVjdDtcbiAgICB9XG5cbiAgICBzZXQgcmVuZGVyU2NlbmVDb2xvck1hcCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgJiYgIXRoaXMuX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdFNjZW5lQ29sb3JNYXAodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RTY2VuZUNvbG9yTWFwKGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZW5kZXJTY2VuZUNvbG9yTWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyU2NlbmVDb2xvck1hcCA+IDA7XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclNjZW5lRGVwdGhNYXAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RTY2VuZURlcHRoTWFwKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVEZXB0aE1hcChmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU2NlbmVEZXB0aE1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclNjZW5lRGVwdGhNYXAgPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0YXJnZXQgdG8gd2hpY2ggcmVuZGVyaW5nIG9mIHRoZSBjYW1lcmFzIGlzIHBlcmZvcm1lZC4gSWYgbm90IHNldCwgaXQgd2lsbCByZW5kZXJcbiAgICAgKiBzaW1wbHkgdG8gdGhlIHNjcmVlbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclRhcmdldCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEucmVuZGVyVGFyZ2V0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJUYXJnZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsaXBzIGFsbCBwaXhlbHMgd2hpY2ggYXJlIG5vdCBpbiB0aGUgcmVjdGFuZ2xlLiBUaGUgb3JkZXIgb2YgdGhlIHZhbHVlcyBpc1xuICAgICAqIFt4LCB5LCB3aWR0aCwgaGVpZ2h0XS4gRGVmYXVsdHMgdG8gWzAsIDAsIDEsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fVxuICAgICAqL1xuICAgIHNldCBzY2lzc29yUmVjdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuc2Npc3NvclJlY3QgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc2Npc3NvclJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuc2Npc3NvclJlY3Q7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IGNhbWVyYSBzZW5zaXRpdml0eSBpbiBJU08sIHRoZSBkZWZhdWx0IHZhbHVlIGlzIDEwMDAuIEhpZ2hlciB2YWx1ZSBtZWFucyBtb3JlIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2Vuc2l0aXZpdHkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNlbnNpdGl2aXR5ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNlbnNpdGl2aXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNlbnNpdGl2aXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgc2h1dHRlciBzcGVlZCBpbiBzZWNvbmRzLCB0aGUgZGVmYXVsdCB2YWx1ZSBpcyAxLzEwMDBzLiBMb25nZXIgc2h1dHRlciBtZWFucyBtb3JlIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2h1dHRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuc2h1dHRlciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzaHV0dGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNodXR0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY2FtZXJhJ3MgdmlldyBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvbWF0NC5qcycpLk1hdDR9XG4gICAgICovXG4gICAgZ2V0IHZpZXdNYXRyaXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEudmlld01hdHJpeDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCYXNlZCBvbiB0aGUgdmFsdWUsIHRoZSBkZXB0aCBsYXllcidzIGVuYWJsZSBjb3VudGVyIGlzIGluY3JlbWVudGVkIG9yIGRlY3JlbWVudGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSAtIFRydWUgdG8gaW5jcmVtZW50IHRoZSBjb3VudGVyLCBmYWxzZSB0byBkZWNyZW1lbnQgaXQuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvdW50ZXIgd2FzIGluY3JlbWVudGVkIG9yIGRlY3JlbWVudGVkLCBmYWxzZSBpZiB0aGUgZGVwdGhcbiAgICAgKiBsYXllciBpcyBub3QgcHJlc2VudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbmFibGVEZXB0aExheWVyKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGhhc0RlcHRoTGF5ZXIgPSB0aGlzLmxheWVycy5maW5kKGxheWVySWQgPT4gbGF5ZXJJZCA9PT0gTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChoYXNEZXB0aExheWVyKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9sYXllci5qcycpLkxheWVyfSAqL1xuICAgICAgICAgICAgY29uc3QgZGVwdGhMYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfREVQVEgpO1xuXG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBkZXB0aExheWVyPy5pbmNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlcHRoTGF5ZXI/LmRlY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVxdWVzdCB0aGUgc2NlbmUgdG8gZ2VuZXJhdGUgYSB0ZXh0dXJlIGNvbnRhaW5pbmcgdGhlIHNjZW5lIGNvbG9yIG1hcC4gTm90ZSB0aGF0IHRoaXMgY2FsbFxuICAgICAqIGlzIGFjY3VtdWxhdGl2ZSwgYW5kIGZvciBlYWNoIGVuYWJsZSByZXF1ZXN0LCBhIGRpc2FibGUgcmVxdWVzdCBuZWVkIHRvIGJlIGNhbGxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgdG8gcmVxdWVzdCB0aGUgZ2VuZXJhdGlvbiwgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKi9cbiAgICByZXF1ZXN0U2NlbmVDb2xvck1hcChlbmFibGVkKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclNjZW5lQ29sb3JNYXAgKz0gZW5hYmxlZCA/IDEgOiAtMTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX3JlbmRlclNjZW5lQ29sb3JNYXAgPj0gMCk7XG4gICAgICAgIGNvbnN0IG9rID0gdGhpcy5fZW5hYmxlRGVwdGhMYXllcihlbmFibGVkKTtcbiAgICAgICAgaWYgKCFvaykge1xuICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoJ0NhbWVyYUNvbXBvbmVudC5yZXF1ZXN0U2NlbmVDb2xvck1hcCB3YXMgY2FsbGVkLCBidXQgdGhlIGNhbWVyYSBkb2VzIG5vdCBoYXZlIGEgRGVwdGggbGF5ZXIsIGlnbm9yaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jYW1lcmEuX2VuYWJsZVJlbmRlclBhc3NDb2xvckdyYWIodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB0aGlzLnJlbmRlclNjZW5lQ29sb3JNYXApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdGhlIHNjZW5lIHRvIGdlbmVyYXRlIGEgdGV4dHVyZSBjb250YWluaW5nIHRoZSBzY2VuZSBkZXB0aCBtYXAuIE5vdGUgdGhhdCB0aGlzIGNhbGxcbiAgICAgKiBpcyBhY2N1bXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lRGVwdGhNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lRGVwdGhNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2FtZXJhLl9lbmFibGVSZW5kZXJQYXNzRGVwdGhHcmFiKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwgdGhpcy5zeXN0ZW0uYXBwLnJlbmRlcmVyLCB0aGlzLnJlbmRlclNjZW5lRGVwdGhNYXApO1xuICAgIH1cblxuICAgIGRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKSB7XG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uIG5lZWRzIHRvIHVwZGF0ZSBvcmRlclxuICAgICAgICBjb25zdCBsYXllckNvbXAgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsYXllckNvbXAuX2RpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGEgcG9pbnQgZnJvbSAyRCBzY3JlZW4gc3BhY2UgdG8gM0Qgd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NyZWVueCAtIFggY29vcmRpbmF0ZSBvbiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC4gU2hvdWxkIGJlIGluIHRoZSByYW5nZVxuICAgICAqIDAgdG8gYGNhbnZhcy5vZmZzZXRXaWR0aGAgb2YgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjcmVlbnkgLSBZIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2VcbiAgICAgKiAwIHRvIGBjYW52YXMub2Zmc2V0SGVpZ2h0YCBvZiB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2FtZXJheiAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgaW4gd29ybGQgc3BhY2UgdG8gY3JlYXRlIHRoZSBuZXdcbiAgICAgKiBwb2ludC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBbd29ybGRDb29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZSB3b3JsZFxuICAgICAqIGNvb3JkaW5hdGUgcmVzdWx0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gR2V0IHRoZSBzdGFydCBhbmQgZW5kIHBvaW50cyBvZiBhIDNEIHJheSBmaXJlZCBmcm9tIGEgc2NyZWVuIGNsaWNrIHBvc2l0aW9uXG4gICAgICogY29uc3Qgc3RhcnQgPSBlbnRpdHkuY2FtZXJhLnNjcmVlblRvV29ybGQoY2xpY2tYLCBjbGlja1ksIGVudGl0eS5jYW1lcmEubmVhckNsaXApO1xuICAgICAqIGNvbnN0IGVuZCA9IGVudGl0eS5jYW1lcmEuc2NyZWVuVG9Xb3JsZChjbGlja1gsIGNsaWNrWSwgZW50aXR5LmNhbWVyYS5mYXJDbGlwKTtcbiAgICAgKlxuICAgICAqIC8vIFVzZSB0aGUgcmF5IGNvb3JkaW5hdGVzIHRvIHBlcmZvcm0gYSByYXljYXN0XG4gICAgICogYXBwLnN5c3RlbXMucmlnaWRib2R5LnJheWNhc3RGaXJzdChzdGFydCwgZW5kLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiRW50aXR5IFwiICsgcmVzdWx0LmVudGl0eS5uYW1lICsgXCIgd2FzIHNlbGVjdGVkXCIpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgc2NyZWVuVG9Xb3JsZChzY3JlZW54LCBzY3JlZW55LCBjYW1lcmF6LCB3b3JsZENvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNjcmVlblRvV29ybGQoc2NyZWVueCwgc2NyZWVueSwgY2FtZXJheiwgdywgaCwgd29ybGRDb29yZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gM0Qgd29ybGQgc3BhY2UgdG8gMkQgc2NyZWVuIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gd29ybGRDb29yZCAtIFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFtzY3JlZW5Db29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZVxuICAgICAqIHNjcmVlbiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFRoZSBzY3JlZW4gc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICB3b3JsZFRvU2NyZWVuKHdvcmxkQ29vcmQsIHNjcmVlbkNvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLndvcmxkVG9TY3JlZW4od29ybGRDb29yZCwgdywgaCwgc2NyZWVuQ29vcmQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBiZWZvcmUgYXBwbGljYXRpb24gcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25BcHBQcmVyZW5kZXIoKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5fdmlld01hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLl92aWV3UHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBhZGRDYW1lcmFUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRDYW1lcmEodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICByZW1vdmVDYW1lcmFGcm9tTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZUNhbWVyYSh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBPbGQgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIE5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkQ2FtZXJhVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9sYXllci5qcycpLkxheWVyfSBsYXllciAtIFRoZSBsYXllciB0byBhZGQgdGhlIGNhbWVyYSB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZENhbWVyYSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdG8gcmVtb3ZlIHRoZSBjYW1lcmEgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBzeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICBjb25zdCBsYXllcnMgPSBzY2VuZS5sYXllcnM7XG5cbiAgICAgICAgc3lzdGVtLmFkZENhbWVyYSh0aGlzKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBsYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmFkZENhbWVyYVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RFZmZlY3RzLmVuYWJsZSgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5zeXN0ZW07XG4gICAgICAgIGNvbnN0IHNjZW5lID0gc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gc2NlbmUubGF5ZXJzO1xuXG4gICAgICAgIHRoaXMucG9zdEVmZmVjdHMuZGlzYWJsZSgpO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlQ2FtZXJhRnJvbUxheWVycygpO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgbGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBzeXN0ZW0ucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSgpO1xuICAgICAgICB0aGlzLm9mZigpO1xuXG4gICAgICAgIHRoaXMuY2FtZXJhLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGVzIGFzcGVjdCByYXRpbyB2YWx1ZSBmb3IgYSBnaXZlbiByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR8bnVsbH0gW3J0XSAtIE9wdGlvbmFsXG4gICAgICogcmVuZGVyIHRhcmdldC4gSWYgdW5zcGVjaWZpZWQsIHRoZSBiYWNrYnVmZmVyIGlzIHVzZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgcmVuZGVyIHRhcmdldCAob3IgYmFja2J1ZmZlcikuXG4gICAgICovXG4gICAgY2FsY3VsYXRlQXNwZWN0UmF0aW8ocnQpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHJ0ID8gcnQud2lkdGggOiBkZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcbiAgICAgICAgcmV0dXJuICh3aWR0aCAqIHRoaXMucmVjdC56KSAvIChoZWlnaHQgKiB0aGlzLnJlY3Qudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJlcGFyZSB0aGUgY2FtZXJhIGZvciBmcmFtZSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldHxudWxsfSBydCAtIFJlbmRlclxuICAgICAqIHRhcmdldCB0byB3aGljaCByZW5kZXJpbmcgd2lsbCBiZSBwZXJmb3JtZWQuIFdpbGwgYWZmZWN0IGNhbWVyYSdzIGFzcGVjdCByYXRpbywgaWZcbiAgICAgKiBhc3BlY3RSYXRpb01vZGUgaXMge0BsaW5rIEFTUEVDVF9BVVRPfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJhbWVVcGRhdGUocnQpIHtcbiAgICAgICAgaWYgKHRoaXMuYXNwZWN0UmF0aW9Nb2RlID09PSBBU1BFQ1RfQVVUTykge1xuICAgICAgICAgICAgdGhpcy5hc3BlY3RSYXRpbyA9IHRoaXMuY2FsY3VsYXRlQXNwZWN0UmF0aW8ocnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBzdGFydCBYUiBzZXNzaW9uIHdpdGggdGhpcyBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIHNlc3Npb24uIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZVxuICAgICAqIGF2YWlsYWJpbGl0eSBhbmQgaXMgcmVuZGVyZWQgaW50byBIVE1MIGVsZW1lbnQuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX1ZSfTogSW1tZXJzaXZlIFZSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gdGhlIFZSIGRldmljZVxuICAgICAqIHdpdGggdGhlIGJlc3QgYXZhaWxhYmxlIHRyYWNraW5nIGZlYXR1cmVzLlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9BUn06IEltbWVyc2l2ZSBBUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIHRoZSBWUi9BUlxuICAgICAqIGRldmljZSB0aGF0IGlzIGludGVuZGVkIHRvIGJlIGJsZW5kZWQgd2l0aCB0aGUgcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZ1xuICAgICAqIGNhcGFiaWxpdGllcy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3IgYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHktYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3JcbiAgICAgKiBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBvcHRpb25zIGZvciBYUiBzZXNzaW9uIGluaXRpYWxpemF0aW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFtvcHRpb25zLm9wdGlvbmFsRmVhdHVyZXNdIC0gT3B0aW9uYWwgZmVhdHVyZXMgZm9yIFhSU2Vzc2lvbiBzdGFydC4gSXQgaXNcbiAgICAgKiB1c2VkIGZvciBnZXR0aW5nIGFjY2VzcyB0byBhZGRpdGlvbmFsIFdlYlhSIHNwZWMgZXh0ZW5zaW9ucy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmltYWdlVHJhY2tpbmddIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhySW1hZ2VUcmFja2luZ30uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wbGFuZURldGVjdGlvbl0gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZSB7QGxpbmsgWHJQbGFuZURldGVjdGlvbn0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3hyL3hyLW1hbmFnZXIuanMnKS5YckVycm9yQ2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsXG4gICAgICogY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2UgdGhlIHNlc3Npb24gaXMgc3RhcnRlZC4gVGhlIGNhbGxiYWNrIGhhcyBvbmUgYXJndW1lbnQgRXJyb3IgLVxuICAgICAqIGl0IGlzIG51bGwgaWYgdGhlIFhSIHNlc3Npb24gc3RhcnRlZCBzdWNjZXNzZnVsbHkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbmNob3JzXSAtIE9wdGlvbmFsIGJvb2xlYW4gdG8gYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyQW5jaG9yc30uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmRlcHRoU2Vuc2luZ10gLSBPcHRpb25hbCBvYmplY3Qgd2l0aCBkZXB0aCBzZW5zaW5nIHBhcmFtZXRlcnMgdG9cbiAgICAgKiBhdHRlbXB0IHRvIGVuYWJsZSB7QGxpbmsgWHJEZXB0aFNlbnNpbmd9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlXSAtIE9wdGlvbmFsIHVzYWdlIHByZWZlcmVuY2UgZm9yIGRlcHRoXG4gICAgICogc2Vuc2luZywgY2FuIGJlICdjcHUtb3B0aW1pemVkJyBvciAnZ3B1LW9wdGltaXplZCcgKFhSREVQVEhTRU5TSU5HVVNBR0VfKiksIGRlZmF1bHRzIHRvXG4gICAgICogJ2NwdS1vcHRpbWl6ZWQnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGwgYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmdcbiAgICAgKiBzeXN0ZW0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZV0gLSBPcHRpb25hbCBkYXRhIGZvcm1hdFxuICAgICAqIHByZWZlcmVuY2UgZm9yIGRlcHRoIHNlbnNpbmcuIENhbiBiZSAnbHVtaW5hbmNlLWFscGhhJyBvciAnZmxvYXQzMicgKFhSREVQVEhTRU5TSU5HRk9STUFUXyopLFxuICAgICAqIGRlZmF1bHRzIHRvICdsdW1pbmFuY2UtYWxwaGEnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGwgYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nXG4gICAgICogZGVwdGggc2Vuc2luZyBzeXN0ZW0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBPbiBhbiBlbnRpdHkgd2l0aCBhIGNhbWVyYSBjb21wb25lbnRcbiAgICAgKiB0aGlzLmVudGl0eS5jYW1lcmEuc3RhcnRYcihwYy5YUlRZUEVfVlIsIHBjLlhSU1BBQ0VfTE9DQUwsIHtcbiAgICAgKiAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgKiAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBmYWlsZWQgdG8gc3RhcnQgWFIgc2Vzc2lvblxuICAgICAqICAgICAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBpbiBYUlxuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhcnRYcih0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnhyLnN0YXJ0KHRoaXMsIHR5cGUsIHNwYWNlVHlwZSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBlbmQgWFIgc2Vzc2lvbiBvZiB0aGlzIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi94ci94ci1tYW5hZ2VyLmpzJykuWHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2tcbiAgICAgKiBmdW5jdGlvbiBjYWxsZWQgb25jZSBzZXNzaW9uIGlzIGVuZGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWZcbiAgICAgKiBzdWNjZXNzZnVsbHkgZW5kZWQgWFIgc2Vzc2lvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIE9uIGFuIGVudGl0eSB3aXRoIGEgY2FtZXJhIGNvbXBvbmVudFxuICAgICAqIHRoaXMuZW50aXR5LmNhbWVyYS5lbmRYcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICogICAgIC8vIG5vdCBhbnltb3JlIGluIFhSXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZW5kWHIoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jYW1lcmEueHIpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdDYW1lcmEgaXMgbm90IGluIFhSJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLnhyLmVuZChjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gdG8gY29weSBwcm9wZXJ0aWVzIGZyb20gdGhlIHNvdXJjZSBDYW1lcmFDb21wb25lbnQuXG4gICAgICogUHJvcGVydGllcyBub3QgY29waWVkOiBwb3N0RWZmZWN0cy5cbiAgICAgKiBJbmhlcml0ZWQgcHJvcGVydGllcyBub3QgY29waWVkIChhbGwpOiBzeXN0ZW0sIGVudGl0eSwgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhQ29tcG9uZW50fSBzb3VyY2UgLSBUaGUgc291cmNlIGNvbXBvbmVudC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgdGhpcy5hcGVydHVyZSA9IHNvdXJjZS5hcGVydHVyZTtcbiAgICAgICAgdGhpcy5hc3BlY3RSYXRpbyA9IHNvdXJjZS5hc3BlY3RSYXRpbztcbiAgICAgICAgdGhpcy5hc3BlY3RSYXRpb01vZGUgPSBzb3VyY2UuYXNwZWN0UmF0aW9Nb2RlO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVByb2plY3Rpb24gPSBzb3VyY2UuY2FsY3VsYXRlUHJvamVjdGlvbjtcbiAgICAgICAgdGhpcy5jYWxjdWxhdGVUcmFuc2Zvcm0gPSBzb3VyY2UuY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBzb3VyY2UuY2xlYXJDb2xvcjtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yQnVmZmVyID0gc291cmNlLmNsZWFyQ29sb3JCdWZmZXI7XG4gICAgICAgIHRoaXMuY2xlYXJEZXB0aEJ1ZmZlciA9IHNvdXJjZS5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IHNvdXJjZS5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgICAgIHRoaXMuY3VsbEZhY2VzID0gc291cmNlLmN1bGxGYWNlcztcbiAgICAgICAgdGhpcy5kaXNhYmxlUG9zdEVmZmVjdHNMYXllciA9IHNvdXJjZS5kaXNhYmxlUG9zdEVmZmVjdHNMYXllcjtcbiAgICAgICAgdGhpcy5mYXJDbGlwID0gc291cmNlLmZhckNsaXA7XG4gICAgICAgIHRoaXMuZmxpcEZhY2VzID0gc291cmNlLmZsaXBGYWNlcztcbiAgICAgICAgdGhpcy5mb3YgPSBzb3VyY2UuZm92O1xuICAgICAgICB0aGlzLmZydXN0dW1DdWxsaW5nID0gc291cmNlLmZydXN0dW1DdWxsaW5nO1xuICAgICAgICB0aGlzLmhvcml6b250YWxGb3YgPSBzb3VyY2UuaG9yaXpvbnRhbEZvdjtcbiAgICAgICAgdGhpcy5sYXllcnMgPSBzb3VyY2UubGF5ZXJzO1xuICAgICAgICB0aGlzLm5lYXJDbGlwID0gc291cmNlLm5lYXJDbGlwO1xuICAgICAgICB0aGlzLm9ydGhvSGVpZ2h0ID0gc291cmNlLm9ydGhvSGVpZ2h0O1xuICAgICAgICB0aGlzLnByaW9yaXR5ID0gc291cmNlLnByaW9yaXR5O1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBzb3VyY2UucHJvamVjdGlvbjtcbiAgICAgICAgdGhpcy5yZWN0ID0gc291cmNlLnJlY3Q7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gc291cmNlLnJlbmRlclRhcmdldDtcbiAgICAgICAgdGhpcy5zY2lzc29yUmVjdCA9IHNvdXJjZS5zY2lzc29yUmVjdDtcbiAgICAgICAgdGhpcy5zZW5zaXRpdml0eSA9IHNvdXJjZS5zZW5zaXRpdml0eTtcbiAgICAgICAgdGhpcy5zaHV0dGVyID0gc291cmNlLnNodXR0ZXI7XG4gICAgfVxufVxuXG5leHBvcnQgeyBDYW1lcmFDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJDYW1lcmFDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIm9uUG9zdHByb2Nlc3NpbmciLCJvblByZVJlbmRlciIsIm9uUG9zdFJlbmRlciIsIl9yZW5kZXJTY2VuZURlcHRoTWFwIiwiX3JlbmRlclNjZW5lQ29sb3JNYXAiLCJfc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCIsIl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkIiwiX3ByaW9yaXR5IiwiX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyIiwiTEFZRVJJRF9VSSIsIl9jYW1lcmEiLCJDYW1lcmEiLCJub2RlIiwiX3Bvc3RFZmZlY3RzIiwiUG9zdEVmZmVjdFF1ZXVlIiwiYXBwIiwic2V0U2hhZGVyUGFzcyIsIm5hbWUiLCJzaGFkZXJQYXNzIiwiU2hhZGVyUGFzcyIsImdldCIsImdyYXBoaWNzRGV2aWNlIiwic2hhZGVyUGFzc0luZm8iLCJhbGxvY2F0ZSIsImlzRm9yd2FyZCIsImluZGV4IiwiZ2V0U2hhZGVyUGFzcyIsIl90aGlzJF9jYW1lcmEkc2hhZGVyUCIsInJlbmRlclBhc3NlcyIsInBhc3NlcyIsImFwZXJ0dXJlIiwidmFsdWUiLCJhc3BlY3RSYXRpbyIsImFzcGVjdFJhdGlvTW9kZSIsImNhbGN1bGF0ZVByb2plY3Rpb24iLCJjYWxjdWxhdGVUcmFuc2Zvcm0iLCJjYW1lcmEiLCJjbGVhckNvbG9yIiwiY2xlYXJDb2xvckJ1ZmZlciIsImRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiY3VsbEZhY2VzIiwiZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIiLCJsYXllciIsImZhckNsaXAiLCJmbGlwRmFjZXMiLCJmb3YiLCJmcnVzdHVtIiwiZnJ1c3R1bUN1bGxpbmciLCJob3Jpem9udGFsRm92IiwibGF5ZXJzIiwibmV3VmFsdWUiLCJpIiwibGVuZ3RoIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJyZW1vdmVDYW1lcmEiLCJlbmFibGVkIiwiYWRkQ2FtZXJhIiwibGF5ZXJzU2V0Iiwiaml0dGVyIiwibmVhckNsaXAiLCJvcnRob0hlaWdodCIsInBvc3RFZmZlY3RzIiwicG9zdEVmZmVjdHNFbmFibGVkIiwicHJpb3JpdHkiLCJwcm9qZWN0aW9uIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3QiLCJmaXJlIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsInJlcXVlc3RTY2VuZUNvbG9yTWFwIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsInJlcXVlc3RTY2VuZURlcHRoTWFwIiwicmVuZGVyVGFyZ2V0Iiwic2Npc3NvclJlY3QiLCJzZW5zaXRpdml0eSIsInNodXR0ZXIiLCJ2aWV3TWF0cml4IiwiX2VuYWJsZURlcHRoTGF5ZXIiLCJoYXNEZXB0aExheWVyIiwiZmluZCIsImxheWVySWQiLCJMQVlFUklEX0RFUFRIIiwiZGVwdGhMYXllciIsImluY3JlbWVudENvdW50ZXIiLCJkZWNyZW1lbnRDb3VudGVyIiwiRGVidWciLCJhc3NlcnQiLCJvayIsIndhcm5PbmNlIiwiX2VuYWJsZVJlbmRlclBhc3NDb2xvckdyYWIiLCJfZW5hYmxlUmVuZGVyUGFzc0RlcHRoR3JhYiIsInJlbmRlcmVyIiwibGF5ZXJDb21wIiwiX2RpcnR5Iiwic2NyZWVuVG9Xb3JsZCIsInNjcmVlbngiLCJzY3JlZW55IiwiY2FtZXJheiIsIndvcmxkQ29vcmQiLCJkZXZpY2UiLCJ3IiwiY2xpZW50UmVjdCIsIndpZHRoIiwiaCIsImhlaWdodCIsIndvcmxkVG9TY3JlZW4iLCJzY3JlZW5Db29yZCIsIm9uQXBwUHJlcmVuZGVyIiwiX3ZpZXdNYXREaXJ0eSIsIl92aWV3UHJvak1hdERpcnR5IiwiYWRkQ2FtZXJhVG9MYXllcnMiLCJyZW1vdmVDYW1lcmFGcm9tTGF5ZXJzIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsIm9uIiwiaW5kZXhPZiIsImlkIiwib25FbmFibGUiLCJlbmFibGUiLCJvbkRpc2FibGUiLCJkaXNhYmxlIiwib25SZW1vdmUiLCJkZXN0cm95IiwiY2FsY3VsYXRlQXNwZWN0UmF0aW8iLCJydCIsInoiLCJmcmFtZVVwZGF0ZSIsIkFTUEVDVF9BVVRPIiwic3RhcnRYciIsInR5cGUiLCJzcGFjZVR5cGUiLCJvcHRpb25zIiwieHIiLCJzdGFydCIsImVuZFhyIiwiY2FsbGJhY2siLCJFcnJvciIsImVuZCIsImNvcHkiLCJzb3VyY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQTJEcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtBQW5FekI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO0FBRXZCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBRWxCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFDLENBQUFBLG9CQUFvQixHQUFHLENBQUMsQ0FBQTtBQUV4QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFMSSxJQU1BQyxDQUFBQSxvQkFBb0IsR0FBRyxDQUFDLENBQUE7QUFFeEI7SUFBQSxJQUNBQyxDQUFBQSx1QkFBdUIsR0FBRyxLQUFLLENBQUE7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
