import { extends as _extends } from '../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Tracing } from '../../core/tracing.js';
import { Color } from '../../core/math/color.js';
import { TRACEID_TEXTURES } from '../../core/constants.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC, CULLFACE_BACK, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_111110F, PRIMITIVE_POINTS } from './constants.js';
import { BlendState } from './blend-state.js';
import { DepthState } from './depth-state.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { StencilParameters } from './stencil-parameters.js';

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments EventHandler
 * @category Graphics
 */
class GraphicsDevice extends EventHandler {
  constructor(canvas, options) {
    var _this$initOptions, _this$initOptions$dep, _this$initOptions2, _this$initOptions2$st, _this$initOptions3, _this$initOptions3$an, _this$initOptions4, _this$initOptions4$po;
    super();
    /**
     * Fired when the canvas is resized. The handler is passed the new width and height as number
     * parameters.
     *
     * @event
     * @example
     * graphicsDevice.on('resizecanvas', (width, height) => {
     *     console.log(`The canvas was resized to ${width}x${height}`);
     * });
     */
    /**
     * The canvas DOM element that provides the underlying WebGL context used by the graphics device.
     *
     * @type {HTMLCanvasElement}
     * @readonly
     */
    this.canvas = void 0;
    /**
     * The render target representing the main back-buffer.
     *
     * @type {import('./render-target.js').RenderTarget|null}
     * @ignore
     */
    this.backBuffer = null;
    /**
     * The dimensions of the back buffer.
     *
     * @ignore
     */
    this.backBufferSize = new Vec2();
    /**
     * The pixel format of the back buffer. Typically PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8 or
     * PIXELFORMAT_RGB8.
     *
     * @ignore
     */
    this.backBufferFormat = void 0;
    /**
     * True if the back buffer should use anti-aliasing.
     *
     * @type {boolean}
     */
    this.backBufferAntialias = false;
    /**
     * True if the deviceType is WebGPU
     *
     * @type {boolean}
     * @readonly
     */
    this.isWebGPU = false;
    /**
     * True if the deviceType is WebGL1
     *
     * @type {boolean}
     * @readonly
     */
    this.isWebGL1 = false;
    /**
     * True if the deviceType is WebGL2
     *
     * @type {boolean}
     * @readonly
     */
    this.isWebGL2 = false;
    /**
     * The scope namespace for shader attributes and variables.
     *
     * @type {ScopeSpace}
     * @readonly
     */
    this.scope = void 0;
    /**
     * The maximum number of supported bones using uniform buffers.
     *
     * @type {number}
     * @readonly
     */
    this.boneLimit = void 0;
    /**
     * The maximum supported texture anisotropy setting.
     *
     * @type {number}
     * @readonly
     */
    this.maxAnisotropy = void 0;
    /**
     * The maximum supported dimension of a cube map.
     *
     * @type {number}
     * @readonly
     */
    this.maxCubeMapSize = void 0;
    /**
     * The maximum supported dimension of a texture.
     *
     * @type {number}
     * @readonly
     */
    this.maxTextureSize = void 0;
    /**
     * The maximum supported dimension of a 3D texture (any axis).
     *
     * @type {number}
     * @readonly
     */
    this.maxVolumeSize = void 0;
    /**
     * The maximum supported number of color buffers attached to a render target.
     *
     * @type {number}
     * @readonly
     */
    this.maxColorAttachments = 1;
    /**
     * The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or
     * 'lowp'.
     *
     * @type {string}
     * @readonly
     */
    this.precision = void 0;
    /**
     * The number of hardware anti-aliasing samples used by the frame buffer.
     *
     * @readonly
     * @type {number}
     */
    this.samples = void 0;
    /**
     * True if the main framebuffer contains stencil attachment.
     *
     * @ignore
     * @type {boolean}
     */
    this.supportsStencil = void 0;
    /**
     * True if Multiple Render Targets feature is supported. This refers to the ability to render to
     * multiple color textures with a single draw call.
     *
     * @readonly
     * @type {boolean}
     */
    this.supportsMrt = false;
    /**
     * True if the device supports volume textures.
     *
     * @readonly
     * @type {boolean}
     */
    this.supportsVolumeTextures = false;
    /**
     * True if the device supports compute shaders.
     *
     * @readonly
     * @type {boolean}
     */
    this.supportsCompute = false;
    /**
     * Currently active render target.
     *
     * @type {import('./render-target.js').RenderTarget|null}
     * @ignore
     */
    this.renderTarget = null;
    /**
     * Array of objects that need to be re-initialized after a context restore event
     *
     * @type {import('./shader.js').Shader[]}
     * @ignore
     */
    this.shaders = [];
    /**
     * An array of currently created textures.
     *
     * @type {import('./texture.js').Texture[]}
     * @ignore
     */
    this.textures = [];
    /**
     * A set of currently created render targets.
     *
     * @type {Set<import('./render-target.js').RenderTarget>}
     * @ignore
     */
    this.targets = new Set();
    /**
     * A version number that is incremented every frame. This is used to detect if some object were
     * invalidated.
     *
     * @type {number}
     * @ignore
     */
    this.renderVersion = 0;
    /**
     * Index of the currently active render pass.
     *
     * @type {number}
     * @ignore
     */
    this.renderPassIndex = void 0;
    /** @type {boolean} */
    this.insideRenderPass = false;
    /**
     * True if hardware instancing is supported.
     *
     * @type {boolean}
     * @readonly
     */
    this.supportsInstancing = void 0;
    /**
     * True if the device supports uniform buffers.
     *
     * @type {boolean}
     * @ignore
     */
    this.supportsUniformBuffers = false;
    /**
     * True if 32-bit floating-point textures can be used as a frame buffer.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureFloatRenderable = void 0;
    /**
     * True if 16-bit floating-point textures can be used as a frame buffer.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureHalfFloatRenderable = void 0;
    /**
     * True if filtering can be applied when sampling float textures.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureFloatFilterable = false;
    /**
     * True if filtering can be applied when sampling 16-bit float textures.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureHalfFloatFilterable = false;
    /**
     * A vertex buffer representing a quad.
     *
     * @type {VertexBuffer}
     * @ignore
     */
    this.quadVertexBuffer = void 0;
    /**
     * An object representing current blend state
     *
     * @ignore
     */
    this.blendState = new BlendState();
    /**
     * The current depth state.
     *
     * @ignore
     */
    this.depthState = new DepthState();
    /**
     * True if stencil is enabled and stencilFront and stencilBack are used
     *
     * @ignore
     */
    this.stencilEnabled = false;
    /**
     * The current front stencil parameters.
     *
     * @ignore
     */
    this.stencilFront = new StencilParameters();
    /**
     * The current back stencil parameters.
     *
     * @ignore
     */
    this.stencilBack = new StencilParameters();
    /**
     * The dynamic buffer manager.
     *
     * @type {import('./dynamic-buffers.js').DynamicBuffers}
     * @ignore
     */
    this.dynamicBuffers = void 0;
    /**
     * The GPU profiler.
     *
     * @type {import('./gpu-profiler.js').GpuProfiler}
     */
    this.gpuProfiler = void 0;
    this.defaultClearOptions = {
      color: [0, 0, 0, 1],
      depth: 1,
      stencil: 0,
      flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };
    this.canvas = canvas;

    // copy options and handle defaults
    this.initOptions = _extends({}, options);
    (_this$initOptions$dep = (_this$initOptions = this.initOptions).depth) != null ? _this$initOptions$dep : _this$initOptions.depth = true;
    (_this$initOptions2$st = (_this$initOptions2 = this.initOptions).stencil) != null ? _this$initOptions2$st : _this$initOptions2.stencil = true;
    (_this$initOptions3$an = (_this$initOptions3 = this.initOptions).antialias) != null ? _this$initOptions3$an : _this$initOptions3.antialias = true;
    (_this$initOptions4$po = (_this$initOptions4 = this.initOptions).powerPreference) != null ? _this$initOptions4$po : _this$initOptions4.powerPreference = 'high-performance';

    // Some devices window.devicePixelRatio can be less than one
    // eg Oculus Quest 1 which returns a window.devicePixelRatio of 0.8
    this._maxPixelRatio = platform.browser ? Math.min(1, window.devicePixelRatio) : 1;
    this.buffers = [];
    this._vram = {
      texShadow: 0,
      texAsset: 0,
      texLightmap: 0,
      tex: 0,
      vb: 0,
      ib: 0,
      ub: 0
    };
    this._shaderStats = {
      vsCompiled: 0,
      fsCompiled: 0,
      linked: 0,
      materialShaders: 0,
      compileTime: 0
    };
    this.initializeContextCaches();

    // Profiler stats
    this._drawCallsPerFrame = 0;
    this._shaderSwitchesPerFrame = 0;
    this._primsPerFrame = [];
    for (let i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
      this._primsPerFrame[i] = 0;
    }
    this._renderTargetCreationTime = 0;

    // Create the ScopeNamespace for shader attributes and variables
    this.scope = new ScopeSpace("Device");
    this.textureBias = this.scope.resolve("textureBias");
    this.textureBias.setValue(0.0);
  }

  /**
   * Function that executes after the device has been created.
   */
  postInit() {
    // create quad vertex buffer
    const vertexFormat = new VertexFormat(this, [{
      semantic: SEMANTIC_POSITION,
      components: 2,
      type: TYPE_FLOAT32
    }]);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadVertexBuffer = new VertexBuffer(this, vertexFormat, 4, BUFFER_STATIC, positions);
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    var _this$quadVertexBuffe, _this$dynamicBuffers, _this$gpuProfiler;
    // fire the destroy event.
    // textures and other device resources may destroy themselves in response.
    this.fire('destroy');
    (_this$quadVertexBuffe = this.quadVertexBuffer) == null || _this$quadVertexBuffe.destroy();
    this.quadVertexBuffer = null;
    (_this$dynamicBuffers = this.dynamicBuffers) == null || _this$dynamicBuffers.destroy();
    this.dynamicBuffers = null;
    (_this$gpuProfiler = this.gpuProfiler) == null || _this$gpuProfiler.destroy();
    this.gpuProfiler = null;
  }
  onDestroyShader(shader) {
    this.fire('destroy:shader', shader);
    const idx = this.shaders.indexOf(shader);
    if (idx !== -1) {
      this.shaders.splice(idx, 1);
    }
  }

  // executes after the extended classes have executed their destroy function
  postDestroy() {
    this.scope = null;
    this.canvas = null;
  }

  // don't stringify GraphicsDevice to JSON by JSON.stringify
  toJSON(key) {
    return undefined;
  }
  initializeContextCaches() {
    this.indexBuffer = null;
    this.vertexBuffers = [];
    this.shader = null;
    this.renderTarget = null;
  }
  initializeRenderState() {
    this.blendState = new BlendState();
    this.depthState = new DepthState();
    this.cullMode = CULLFACE_BACK;

    // Cached viewport and scissor dimensions
    this.vx = this.vy = this.vw = this.vh = 0;
    this.sx = this.sy = this.sw = this.sh = 0;
    this.blendColor = new Color(0, 0, 0, 0);
  }

  /**
   * Sets the specified stencil state. If both stencilFront and stencilBack are null, stencil
   * operation is disabled.
   *
   * @param {StencilParameters} [stencilFront] - The front stencil parameters. Defaults to
   * {@link StencilParameters.DEFAULT} if not specified.
   * @param {StencilParameters} [stencilBack] - The back stencil parameters. Defaults to
   * {@link StencilParameters.DEFAULT} if not specified.
   */
  setStencilState(stencilFront, stencilBack) {
    Debug.assert(false);
  }

  /**
   * Sets the specified blend state.
   *
   * @param {BlendState} blendState - New blend state.
   */
  setBlendState(blendState) {
    Debug.assert(false);
  }

  /**
   * Sets the constant blend color and alpha values used with {@link BLENDMODE_CONSTANT} and
   * {@link BLENDMODE_ONE_MINUS_CONSTANT} factors specified in {@link BlendState}. Defaults to
   * [0, 0, 0, 0].
   *
   * @param {number} r - The value for red.
   * @param {number} g - The value for green.
   * @param {number} b - The value for blue.
   * @param {number} a - The value for alpha.
   */
  setBlendColor(r, g, b, a) {
    Debug.assert(false);
  }

  /**
   * Sets the specified depth state.
   *
   * @param {DepthState} depthState - New depth state.
   */
  setDepthState(depthState) {
    Debug.assert(false);
  }

  /**
   * Controls how triangles are culled based on their face direction. The default cull mode is
   * {@link CULLFACE_BACK}.
   *
   * @param {number} cullMode - The cull mode to set. Can be:
   *
   * - {@link CULLFACE_NONE}
   * - {@link CULLFACE_BACK}
   * - {@link CULLFACE_FRONT}
   */
  setCullMode(cullMode) {
    Debug.assert(false);
  }

  /**
   * Sets the specified render target on the device. If null is passed as a parameter, the back
   * buffer becomes the current target for all rendering operations.
   *
   * @param {import('./render-target.js').RenderTarget|null} renderTarget - The render target to
   * activate.
   * @example
   * // Set a render target to receive all rendering output
   * device.setRenderTarget(renderTarget);
   *
   * // Set the back buffer to receive all rendering output
   * device.setRenderTarget(null);
   */
  setRenderTarget(renderTarget) {
    this.renderTarget = renderTarget;
  }

  /**
   * Sets the current index buffer on the graphics device. On subsequent calls to
   * {@link GraphicsDevice#draw}, the specified index buffer will be used to provide index data
   * for any indexed primitives.
   *
   * @param {import('./index-buffer.js').IndexBuffer} indexBuffer - The index buffer to assign to
   * the device.
   */
  setIndexBuffer(indexBuffer) {
    // Store the index buffer
    this.indexBuffer = indexBuffer;
  }

  /**
   * Sets the current vertex buffer on the graphics device. On subsequent calls to
   * {@link GraphicsDevice#draw}, the specified vertex buffer(s) will be used to provide vertex
   * data for any primitives.
   *
   * @param {import('./vertex-buffer.js').VertexBuffer} vertexBuffer - The vertex buffer to
   * assign to the device.
   */
  setVertexBuffer(vertexBuffer) {
    if (vertexBuffer) {
      this.vertexBuffers.push(vertexBuffer);
    }
  }

  /**
   * Queries the currently set render target on the device.
   *
   * @returns {import('./render-target.js').RenderTarget} The current render target.
   * @example
   * // Get the current render target
   * const renderTarget = device.getRenderTarget();
   */
  getRenderTarget() {
    return this.renderTarget;
  }

  /**
   * Initialize render target before it can be used.
   *
   * @param {import('./render-target.js').RenderTarget} target - The render target to be
   * initialized.
   * @ignore
   */
  initRenderTarget(target) {
    if (target.initialized) return;
    const startTime = now();
    this.fire('fbo:create', {
      timestamp: startTime,
      target: this
    });
    target.init();
    this.targets.add(target);
    this._renderTargetCreationTime += now() - startTime;
  }

  /**
   * Reports whether a texture source is a canvas, image, video or ImageBitmap.
   *
   * @param {*} texture - Texture source data.
   * @returns {boolean} True if the texture is a canvas, image, video or ImageBitmap and false
   * otherwise.
   * @ignore
   */
  _isBrowserInterface(texture) {
    return this._isImageBrowserInterface(texture) || this._isImageCanvasInterface(texture) || this._isImageVideoInterface(texture);
  }
  _isImageBrowserInterface(texture) {
    return typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement;
  }
  _isImageCanvasInterface(texture) {
    return typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement;
  }
  _isImageVideoInterface(texture) {
    return typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement;
  }

  /**
   * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
   * specified width and height values will be multiplied by the value of
   * {@link GraphicsDevice#maxPixelRatio} to give the final resultant width and height for the
   * canvas.
   *
   * @param {number} width - The new width of the canvas.
   * @param {number} height - The new height of the canvas.
   * @ignore
   */
  resizeCanvas(width, height) {
    const pixelRatio = Math.min(this._maxPixelRatio, platform.browser ? window.devicePixelRatio : 1);
    const w = Math.floor(width * pixelRatio);
    const h = Math.floor(height * pixelRatio);
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.setResolution(w, h);
    }
  }

  /**
   * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
   * value of {@link GraphicsDevice#maxPixelRatio} is ignored.
   *
   * @param {number} width - The new width of the canvas.
   * @param {number} height - The new height of the canvas.
   * @ignore
   */
  setResolution(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
  }
  updateClientRect() {
    this.clientRect = this.canvas.getBoundingClientRect();
  }

  /**
   * Width of the back buffer in pixels.
   *
   * @type {number}
   */
  get width() {
    return this.canvas.width;
  }

  /**
   * Height of the back buffer in pixels.
   *
   * @type {number}
   */
  get height() {
    return this.canvas.height;
  }

  /**
   * Fullscreen mode.
   *
   * @type {boolean}
   */
  set fullscreen(fullscreen) {
    Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
  }
  get fullscreen() {
    Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
    return false;
  }

  /**
   * Maximum pixel ratio.
   *
   * @type {number}
   */
  set maxPixelRatio(ratio) {
    this._maxPixelRatio = ratio;
  }
  get maxPixelRatio() {
    return this._maxPixelRatio;
  }

  /**
   * The type of the device. Can be one of pc.DEVICETYPE_WEBGL1, pc.DEVICETYPE_WEBGL2 or pc.DEVICETYPE_WEBGPU.
   *
   * @type {import('./constants.js').DEVICETYPE_WEBGL1 | import('./constants.js').DEVICETYPE_WEBGL2 | import('./constants.js').DEVICETYPE_WEBGPU}
   */
  get deviceType() {
    return this._deviceType;
  }

  /**
   * Queries the maximum number of bones that can be referenced by a shader. The shader
   * generators (programlib) use this number to specify the matrix array size of the uniform
   * 'matrix_pose[0]'. The value is calculated based on the number of available uniform vectors
   * available after subtracting the number taken by a typical heavyweight shader. If a different
   * number is required, it can be tuned via {@link GraphicsDevice#setBoneLimit}.
   *
   * @returns {number} The maximum number of bones that can be supported by the host hardware.
   * @ignore
   */
  getBoneLimit() {
    return this.boneLimit;
  }

  /**
   * Specifies the maximum number of bones that the device can support on the current hardware.
   * This function allows the default calculated value based on available vector uniforms to be
   * overridden.
   *
   * @param {number} maxBones - The maximum number of bones supported by the host hardware.
   * @ignore
   */
  setBoneLimit(maxBones) {
    this.boneLimit = maxBones;
  }
  startRenderPass(renderPass) {}
  endRenderPass(renderPass) {}
  startComputePass() {}
  endComputePass() {}

  /**
   * Function which executes at the start of the frame. This should not be called manually, as
   * it is handled by the AppBase instance.
   *
   * @ignore
   */
  frameStart() {
    this.renderPassIndex = 0;
    this.renderVersion++;
    Debug.call(() => {
      // log out all loaded textures, sorted by gpu memory size
      if (Tracing.get(TRACEID_TEXTURES)) {
        const textures = this.textures.slice();
        textures.sort((a, b) => b.gpuSize - a.gpuSize);
        Debug.log(`Textures: ${textures.length}`);
        let textureTotal = 0;
        textures.forEach((texture, index) => {
          const textureSize = texture.gpuSize;
          textureTotal += textureSize;
          Debug.log(`${index}. ${texture.name} ${texture.width}x${texture.height} VRAM: ${(textureSize / 1024 / 1024).toFixed(2)} MB`);
        });
        Debug.log(`Total: ${(textureTotal / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  }

  /**
   * Function which executes at the end of the frame. This should not be called manually, as it is
   * handled by the AppBase instance.
   *
   * @ignore
   */
  frameEnd() {}

  /**
   * Get a renderable HDR pixel format supported by the graphics device.
   *
   * @param {number[]} [formats] - An array of pixel formats to check for support. Can contain:
   *
   * - {@link PIXELFORMAT_111110F}
   * - {@link PIXELFORMAT_RGBA16F}
   * - {@link PIXELFORMAT_RGBA32F}
   *
   * @param {boolean} [filterable] - If true, the format also needs to be filterable. Defaults to
   * true.
   * @returns {number|undefined} The first supported renderable HDR format or undefined if none is
   * supported.
   */
  getRenderableHdrFormat(formats = [PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], filterable = true) {
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      switch (format) {
        case PIXELFORMAT_111110F:
          {
            if (this.textureRG11B10Renderable) return format;
            break;
          }
        case PIXELFORMAT_RGBA16F:
          if (this.textureHalfFloatRenderable && (!filterable || this.textureHalfFloatFilterable)) {
            return format;
          }
          break;
        case PIXELFORMAT_RGBA32F:
          if (this.textureFloatRenderable && (!filterable || this.textureFloatFilterable)) {
            return format;
          }
          break;
      }
    }
    return undefined;
  }
}
GraphicsDevice.EVENT_RESIZE = 'resizecanvas';

export { GraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBUUkFDRUlEX1RFWFRVUkVTIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgQ1VMTEZBQ0VfQkFDSyxcbiAgICBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfVFJJRkFOLCBTRU1BTlRJQ19QT1NJVElPTiwgVFlQRV9GTE9BVDMyLCBQSVhFTEZPUk1BVF8xMTExMTBGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0JBMzJGXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuL2RlcHRoLXN0YXRlLmpzJztcbmltcG9ydCB7IFNjb3BlU3BhY2UgfSBmcm9tICcuL3Njb3BlLXNwYWNlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuL3N0ZW5jaWwtcGFyYW1ldGVycy5qcyc7XG5cbi8qKlxuICogVGhlIGdyYXBoaWNzIGRldmljZSBtYW5hZ2VzIHRoZSB1bmRlcmx5aW5nIGdyYXBoaWNzIGNvbnRleHQuIEl0IGlzIHJlc3BvbnNpYmxlIGZvciBzdWJtaXR0aW5nXG4gKiByZW5kZXIgc3RhdGUgY2hhbmdlcyBhbmQgZ3JhcGhpY3MgcHJpbWl0aXZlcyB0byB0aGUgaGFyZHdhcmUuIEEgZ3JhcGhpY3MgZGV2aWNlIGlzIHRpZWQgdG8gYVxuICogc3BlY2lmaWMgY2FudmFzIEhUTUwgZWxlbWVudC4gSXQgaXMgdmFsaWQgdG8gaGF2ZSBtb3JlIHRoYW4gb25lIGNhbnZhcyBlbGVtZW50IHBlciBwYWdlIGFuZFxuICogY3JlYXRlIGEgbmV3IGdyYXBoaWNzIGRldmljZSBhZ2FpbnN0IGVhY2guXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIEdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjYW52YXMgaXMgcmVzaXplZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSBuZXcgd2lkdGggYW5kIGhlaWdodCBhcyBudW1iZXJcbiAgICAgKiBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBncmFwaGljc0RldmljZS5vbigncmVzaXplY2FudmFzJywgKHdpZHRoLCBoZWlnaHQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFRoZSBjYW52YXMgd2FzIHJlc2l6ZWQgdG8gJHt3aWR0aH14JHtoZWlnaHR9YCk7XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FudmFzIERPTSBlbGVtZW50IHRoYXQgcHJvdmlkZXMgdGhlIHVuZGVybHlpbmcgV2ViR0wgY29udGV4dCB1c2VkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7SFRNTENhbnZhc0VsZW1lbnR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY2FudmFzO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciB0YXJnZXQgcmVwcmVzZW50aW5nIHRoZSBtYWluIGJhY2stYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGRpbWVuc2lvbnMgb2YgdGhlIGJhY2sgYnVmZmVyLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJhY2tCdWZmZXJTaXplID0gbmV3IFZlYzIoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXhlbCBmb3JtYXQgb2YgdGhlIGJhY2sgYnVmZmVyLiBUeXBpY2FsbHkgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0JHUkE4IG9yXG4gICAgICogUElYRUxGT1JNQVRfUkdCOC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiYWNrQnVmZmVyRm9ybWF0O1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYmFjayBidWZmZXIgc2hvdWxkIHVzZSBhbnRpLWFsaWFzaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgYmFja0J1ZmZlckFudGlhbGlhcyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgZGV2aWNlVHlwZSBpcyBXZWJHUFVcbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGlzV2ViR1BVID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBkZXZpY2VUeXBlIGlzIFdlYkdMMVxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgaXNXZWJHTDEgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRldmljZVR5cGUgaXMgV2ViR0wyXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBpc1dlYkdMMiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNjb3BlIG5hbWVzcGFjZSBmb3Igc2hhZGVyIGF0dHJpYnV0ZXMgYW5kIHZhcmlhYmxlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTY29wZVNwYWNlfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjb3BlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gbnVtYmVyIG9mIHN1cHBvcnRlZCBib25lcyB1c2luZyB1bmlmb3JtIGJ1ZmZlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGJvbmVMaW1pdDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIHN1cHBvcnRlZCB0ZXh0dXJlIGFuaXNvdHJvcHkgc2V0dGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4QW5pc290cm9weTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIHN1cHBvcnRlZCBkaW1lbnNpb24gb2YgYSBjdWJlIG1hcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4Q3ViZU1hcFNpemU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4VGV4dHVyZVNpemU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgM0QgdGV4dHVyZSAoYW55IGF4aXMpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBtYXhWb2x1bWVTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gc3VwcG9ydGVkIG51bWJlciBvZiBjb2xvciBidWZmZXJzIGF0dGFjaGVkIHRvIGEgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4Q29sb3JBdHRhY2htZW50cyA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGlnaGVzdCBzaGFkZXIgcHJlY2lzaW9uIHN1cHBvcnRlZCBieSB0aGlzIGdyYXBoaWNzIGRldmljZS4gQ2FuIGJlICdoaXBocCcsICdtZWRpdW1wJyBvclxuICAgICAqICdsb3dwJy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcHJlY2lzaW9uO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG51bWJlciBvZiBoYXJkd2FyZSBhbnRpLWFsaWFzaW5nIHNhbXBsZXMgdXNlZCBieSB0aGUgZnJhbWUgYnVmZmVyLlxuICAgICAqXG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzYW1wbGVzO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgbWFpbiBmcmFtZWJ1ZmZlciBjb250YWlucyBzdGVuY2lsIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3VwcG9ydHNTdGVuY2lsO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBNdWx0aXBsZSBSZW5kZXIgVGFyZ2V0cyBmZWF0dXJlIGlzIHN1cHBvcnRlZC4gVGhpcyByZWZlcnMgdG8gdGhlIGFiaWxpdHkgdG8gcmVuZGVyIHRvXG4gICAgICogbXVsdGlwbGUgY29sb3IgdGV4dHVyZXMgd2l0aCBhIHNpbmdsZSBkcmF3IGNhbGwuXG4gICAgICpcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdXBwb3J0c01ydCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgZGV2aWNlIHN1cHBvcnRzIHZvbHVtZSB0ZXh0dXJlcy5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN1cHBvcnRzVm9sdW1lVGV4dHVyZXMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRldmljZSBzdXBwb3J0cyBjb21wdXRlIHNoYWRlcnMuXG4gICAgICpcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdXBwb3J0c0NvbXB1dGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldHxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2Ygb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgcmUtaW5pdGlhbGl6ZWQgYWZ0ZXIgYSBjb250ZXh0IHJlc3RvcmUgZXZlbnRcbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyW119XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNoYWRlcnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGN1cnJlbnRseSBjcmVhdGVkIHRleHR1cmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZVtdfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB0ZXh0dXJlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQSBzZXQgb2YgY3VycmVudGx5IGNyZWF0ZWQgcmVuZGVyIHRhcmdldHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0Pn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdGFyZ2V0cyA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIEEgdmVyc2lvbiBudW1iZXIgdGhhdCBpcyBpbmNyZW1lbnRlZCBldmVyeSBmcmFtZS4gVGhpcyBpcyB1c2VkIHRvIGRldGVjdCBpZiBzb21lIG9iamVjdCB3ZXJlXG4gICAgICogaW52YWxpZGF0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJWZXJzaW9uID0gMDtcblxuICAgIC8qKlxuICAgICAqIEluZGV4IG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc0luZGV4O1xuXG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaGFyZHdhcmUgaW5zdGFuY2luZyBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdXBwb3J0c0luc3RhbmNpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBkZXZpY2Ugc3VwcG9ydHMgdW5pZm9ybSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgMzItYml0IGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGNhbiBiZSB1c2VkIGFzIGEgZnJhbWUgYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgdGV4dHVyZUZsb2F0UmVuZGVyYWJsZTtcblxuICAgICAvKipcbiAgICAgICogVHJ1ZSBpZiAxNi1iaXQgZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgY2FuIGJlIHVzZWQgYXMgYSBmcmFtZSBidWZmZXIuXG4gICAgICAqXG4gICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgKiBAcmVhZG9ubHlcbiAgICAgICovXG4gICAgdGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGU7XG5cbiAgICAgLyoqXG4gICAgICAqIFRydWUgaWYgZmlsdGVyaW5nIGNhbiBiZSBhcHBsaWVkIHdoZW4gc2FtcGxpbmcgZmxvYXQgdGV4dHVyZXMuXG4gICAgICAqXG4gICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgKiBAcmVhZG9ubHlcbiAgICAgICovXG4gICAgdGV4dHVyZUZsb2F0RmlsdGVyYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBmaWx0ZXJpbmcgY2FuIGJlIGFwcGxpZWQgd2hlbiBzYW1wbGluZyAxNi1iaXQgZmxvYXQgdGV4dHVyZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICB0ZXh0dXJlSGFsZkZsb2F0RmlsdGVyYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQSB2ZXJ0ZXggYnVmZmVyIHJlcHJlc2VudGluZyBhIHF1YWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVydGV4QnVmZmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBxdWFkVmVydGV4QnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogQW4gb2JqZWN0IHJlcHJlc2VudGluZyBjdXJyZW50IGJsZW5kIHN0YXRlXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBkZXB0aCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXB0aFN0YXRlID0gbmV3IERlcHRoU3RhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgc3RlbmNpbCBpcyBlbmFibGVkIGFuZCBzdGVuY2lsRnJvbnQgYW5kIHN0ZW5jaWxCYWNrIGFyZSB1c2VkXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RlbmNpbEVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGZyb250IHN0ZW5jaWwgcGFyYW1ldGVycy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGVuY2lsRnJvbnQgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGJhY2sgc3RlbmNpbCBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0ZW5jaWxCYWNrID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHluYW1pYyBidWZmZXIgbWFuYWdlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZHluYW1pYy1idWZmZXJzLmpzJykuRHluYW1pY0J1ZmZlcnN9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGR5bmFtaWNCdWZmZXJzO1xuXG4gICAgLyoqXG4gICAgICogVGhlIEdQVSBwcm9maWxlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZ3B1LXByb2ZpbGVyLmpzJykuR3B1UHJvZmlsZXJ9XG4gICAgICovXG4gICAgZ3B1UHJvZmlsZXI7XG5cbiAgICBkZWZhdWx0Q2xlYXJPcHRpb25zID0ge1xuICAgICAgICBjb2xvcjogWzAsIDAsIDAsIDFdLFxuICAgICAgICBkZXB0aDogMSxcbiAgICAgICAgc3RlbmNpbDogMCxcbiAgICAgICAgZmxhZ3M6IENMRUFSRkxBR19DT0xPUiB8IENMRUFSRkxBR19ERVBUSFxuICAgIH07XG5cbiAgICBzdGF0aWMgRVZFTlRfUkVTSVpFID0gJ3Jlc2l6ZWNhbnZhcyc7XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmNhbnZhcyA9IGNhbnZhcztcblxuICAgICAgICAvLyBjb3B5IG9wdGlvbnMgYW5kIGhhbmRsZSBkZWZhdWx0c1xuICAgICAgICB0aGlzLmluaXRPcHRpb25zID0geyAuLi5vcHRpb25zIH07XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMuZGVwdGggPz89IHRydWU7XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMuc3RlbmNpbCA/Pz0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pbml0T3B0aW9ucy5hbnRpYWxpYXMgPz89IHRydWU7XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMucG93ZXJQcmVmZXJlbmNlID8/PSAnaGlnaC1wZXJmb3JtYW5jZSc7XG5cbiAgICAgICAgLy8gU29tZSBkZXZpY2VzIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIGNhbiBiZSBsZXNzIHRoYW4gb25lXG4gICAgICAgIC8vIGVnIE9jdWx1cyBRdWVzdCAxIHdoaWNoIHJldHVybnMgYSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyBvZiAwLjhcbiAgICAgICAgdGhpcy5fbWF4UGl4ZWxSYXRpbyA9IHBsYXRmb3JtLmJyb3dzZXIgPyBNYXRoLm1pbigxLCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbykgOiAxO1xuXG4gICAgICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3ZyYW0gPSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0ZXhTaGFkb3c6IDAsXG4gICAgICAgICAgICB0ZXhBc3NldDogMCxcbiAgICAgICAgICAgIHRleExpZ2h0bWFwOiAwLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB0ZXg6IDAsXG4gICAgICAgICAgICB2YjogMCxcbiAgICAgICAgICAgIGliOiAwLFxuICAgICAgICAgICAgdWI6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJTdGF0cyA9IHtcbiAgICAgICAgICAgIHZzQ29tcGlsZWQ6IDAsXG4gICAgICAgICAgICBmc0NvbXBpbGVkOiAwLFxuICAgICAgICAgICAgbGlua2VkOiAwLFxuICAgICAgICAgICAgbWF0ZXJpYWxTaGFkZXJzOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gUHJvZmlsZXIgc3RhdHNcbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSBQUklNSVRJVkVfUE9JTlRTOyBpIDw9IFBSSU1JVElWRV9UUklGQU47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gMDtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIFNjb3BlTmFtZXNwYWNlIGZvciBzaGFkZXIgYXR0cmlidXRlcyBhbmQgdmFyaWFibGVzXG4gICAgICAgIHRoaXMuc2NvcGUgPSBuZXcgU2NvcGVTcGFjZShcIkRldmljZVwiKTtcblxuICAgICAgICB0aGlzLnRleHR1cmVCaWFzID0gdGhpcy5zY29wZS5yZXNvbHZlKFwidGV4dHVyZUJpYXNcIik7XG4gICAgICAgIHRoaXMudGV4dHVyZUJpYXMuc2V0VmFsdWUoMC4wKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGFmdGVyIHRoZSBkZXZpY2UgaGFzIGJlZW4gY3JlYXRlZC5cbiAgICAgKi9cbiAgICBwb3N0SW5pdCgpIHtcblxuICAgICAgICAvLyBjcmVhdGUgcXVhZCB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcywgW1xuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFstMSwgLTEsIDEsIC0xLCAtMSwgMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMsIHZlcnRleEZvcm1hdCwgNCwgQlVGRkVSX1NUQVRJQywgcG9zaXRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gZmlyZSB0aGUgZGVzdHJveSBldmVudC5cbiAgICAgICAgLy8gdGV4dHVyZXMgYW5kIG90aGVyIGRldmljZSByZXNvdXJjZXMgbWF5IGRlc3Ryb3kgdGhlbXNlbHZlcyBpbiByZXNwb25zZS5cbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95Jyk7XG5cbiAgICAgICAgdGhpcy5xdWFkVmVydGV4QnVmZmVyPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucXVhZFZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5keW5hbWljQnVmZmVycz8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmR5bmFtaWNCdWZmZXJzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdwdVByb2ZpbGVyPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXIgPSBudWxsO1xuICAgIH1cblxuICAgIG9uRGVzdHJveVNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95OnNoYWRlcicsIHNoYWRlcik7XG5cbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5zaGFkZXJzLmluZGV4T2Yoc2hhZGVyKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZGVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIGFmdGVyIHRoZSBleHRlbmRlZCBjbGFzc2VzIGhhdmUgZXhlY3V0ZWQgdGhlaXIgZGVzdHJveSBmdW5jdGlvblxuICAgIHBvc3REZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNjb3BlID0gbnVsbDtcbiAgICAgICAgdGhpcy5jYW52YXMgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIGRvbid0IHN0cmluZ2lmeSBHcmFwaGljc0RldmljZSB0byBKU09OIGJ5IEpTT04uc3RyaW5naWZ5XG4gICAgdG9KU09OKGtleSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXJzID0gW107XG4gICAgICAgIHRoaXMuc2hhZGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVSZW5kZXJTdGF0ZSgpIHtcblxuICAgICAgICB0aGlzLmJsZW5kU3RhdGUgPSBuZXcgQmxlbmRTdGF0ZSgpO1xuICAgICAgICB0aGlzLmRlcHRoU3RhdGUgPSBuZXcgRGVwdGhTdGF0ZSgpO1xuICAgICAgICB0aGlzLmN1bGxNb2RlID0gQ1VMTEZBQ0VfQkFDSztcblxuICAgICAgICAvLyBDYWNoZWQgdmlld3BvcnQgYW5kIHNjaXNzb3IgZGltZW5zaW9uc1xuICAgICAgICB0aGlzLnZ4ID0gdGhpcy52eSA9IHRoaXMudncgPSB0aGlzLnZoID0gMDtcbiAgICAgICAgdGhpcy5zeCA9IHRoaXMuc3kgPSB0aGlzLnN3ID0gdGhpcy5zaCA9IDA7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBzdGVuY2lsIHN0YXRlLiBJZiBib3RoIHN0ZW5jaWxGcm9udCBhbmQgc3RlbmNpbEJhY2sgYXJlIG51bGwsIHN0ZW5jaWxcbiAgICAgKiBvcGVyYXRpb24gaXMgZGlzYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0ZW5jaWxQYXJhbWV0ZXJzfSBbc3RlbmNpbEZyb250XSAtIFRoZSBmcm9udCBzdGVuY2lsIHBhcmFtZXRlcnMuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFR9IGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtTdGVuY2lsUGFyYW1ldGVyc30gW3N0ZW5jaWxCYWNrXSAtIFRoZSBiYWNrIHN0ZW5jaWwgcGFyYW1ldGVycy4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgU3RlbmNpbFBhcmFtZXRlcnMuREVGQVVMVH0gaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBibGVuZCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmxlbmRTdGF0ZX0gYmxlbmRTdGF0ZSAtIE5ldyBibGVuZCBzdGF0ZS5cbiAgICAgKi9cbiAgICBzZXRCbGVuZFN0YXRlKGJsZW5kU3RhdGUpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjb25zdGFudCBibGVuZCBjb2xvciBhbmQgYWxwaGEgdmFsdWVzIHVzZWQgd2l0aCB7QGxpbmsgQkxFTkRNT0RFX0NPTlNUQU5UfSBhbmRcbiAgICAgKiB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVH0gZmFjdG9ycyBzcGVjaWZpZWQgaW4ge0BsaW5rIEJsZW5kU3RhdGV9LiBEZWZhdWx0cyB0b1xuICAgICAqIFswLCAwLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByIC0gVGhlIHZhbHVlIGZvciByZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgdmFsdWUgZm9yIGdyZWVuLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIHZhbHVlIGZvciBibHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gVGhlIHZhbHVlIGZvciBhbHBoYS5cbiAgICAgKi9cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgZGVwdGggc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0RlcHRoU3RhdGV9IGRlcHRoU3RhdGUgLSBOZXcgZGVwdGggc3RhdGUuXG4gICAgICovXG4gICAgc2V0RGVwdGhTdGF0ZShkZXB0aFN0YXRlKSB7XG4gICAgICAgIERlYnVnLmFzc2VydChmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRyaWFuZ2xlcyBhcmUgY3VsbGVkIGJhc2VkIG9uIHRoZWlyIGZhY2UgZGlyZWN0aW9uLiBUaGUgZGVmYXVsdCBjdWxsIG1vZGUgaXNcbiAgICAgKiB7QGxpbmsgQ1VMTEZBQ0VfQkFDS30uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3VsbE1vZGUgLSBUaGUgY3VsbCBtb2RlIHRvIHNldC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfTk9ORX1cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9CQUNLfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UfVxuICAgICAqL1xuICAgIHNldEN1bGxNb2RlKGN1bGxNb2RlKSB7XG4gICAgICAgIERlYnVnLmFzc2VydChmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIHJlbmRlciB0YXJnZXQgb24gdGhlIGRldmljZS4gSWYgbnVsbCBpcyBwYXNzZWQgYXMgYSBwYXJhbWV0ZXIsIHRoZSBiYWNrXG4gICAgICogYnVmZmVyIGJlY29tZXMgdGhlIGN1cnJlbnQgdGFyZ2V0IGZvciBhbGwgcmVuZGVyaW5nIG9wZXJhdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fG51bGx9IHJlbmRlclRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IHRvXG4gICAgICogYWN0aXZhdGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYSByZW5kZXIgdGFyZ2V0IHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgdGhlIGJhY2sgYnVmZmVyIHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KG51bGwpO1xuICAgICAqL1xuICAgIHNldFJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCBpbmRleCBidWZmZXIgb24gdGhlIGdyYXBoaWNzIGRldmljZS4gT24gc3Vic2VxdWVudCBjYWxscyB0b1xuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSNkcmF3fSwgdGhlIHNwZWNpZmllZCBpbmRleCBidWZmZXIgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgaW5kZXggZGF0YVxuICAgICAqIGZvciBhbnkgaW5kZXhlZCBwcmltaXRpdmVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vaW5kZXgtYnVmZmVyLmpzJykuSW5kZXhCdWZmZXJ9IGluZGV4QnVmZmVyIC0gVGhlIGluZGV4IGJ1ZmZlciB0byBhc3NpZ24gdG9cbiAgICAgKiB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBpbmRleCBidWZmZXJcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IGluZGV4QnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdmVydGV4IGJ1ZmZlciBvbiB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBPbiBzdWJzZXF1ZW50IGNhbGxzIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI2RyYXd9LCB0aGUgc3BlY2lmaWVkIHZlcnRleCBidWZmZXIocykgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgdmVydGV4XG4gICAgICogZGF0YSBmb3IgYW55IHByaW1pdGl2ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfSB2ZXJ0ZXhCdWZmZXIgLSBUaGUgdmVydGV4IGJ1ZmZlciB0b1xuICAgICAqIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldFZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIpIHtcblxuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMucHVzaCh2ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0IG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBHZXQgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldFxuICAgICAqIGNvbnN0IHJlbmRlclRhcmdldCA9IGRldmljZS5nZXRSZW5kZXJUYXJnZXQoKTtcbiAgICAgKi9cbiAgICBnZXRSZW5kZXJUYXJnZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHJlbmRlciB0YXJnZXQgYmVmb3JlIGl0IGNhbiBiZSB1c2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gdGFyZ2V0IC0gVGhlIHJlbmRlciB0YXJnZXQgdG8gYmVcbiAgICAgKiBpbml0aWFsaXplZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdFJlbmRlclRhcmdldCh0YXJnZXQpIHtcblxuICAgICAgICBpZiAodGFyZ2V0LmluaXRpYWxpemVkKSByZXR1cm47XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgdGhpcy5maXJlKCdmYm86Y3JlYXRlJywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBzdGFydFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRhcmdldC5pbml0KCk7XG4gICAgICAgIHRoaXMudGFyZ2V0cy5hZGQodGFyZ2V0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIGEgdGV4dHVyZSBzb3VyY2UgaXMgYSBjYW52YXMsIGltYWdlLCB2aWRlbyBvciBJbWFnZUJpdG1hcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdGV4dHVyZSAtIFRleHR1cmUgc291cmNlIGRhdGEuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHRleHR1cmUgaXMgYSBjYW52YXMsIGltYWdlLCB2aWRlbyBvciBJbWFnZUJpdG1hcCBhbmQgZmFsc2VcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9pc0Jyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkgfHxcbiAgICAgICAgICAgICAgICB0aGlzLl9pc0ltYWdlQ2FudmFzSW50ZXJmYWNlKHRleHR1cmUpIHx8XG4gICAgICAgICAgICAgICAgdGhpcy5faXNJbWFnZVZpZGVvSW50ZXJmYWNlKHRleHR1cmUpO1xuICAgIH1cblxuICAgIF9pc0ltYWdlQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiAodHlwZW9mIEltYWdlQml0bWFwICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSW1hZ2VCaXRtYXApIHx8XG4gICAgICAgICAgICAgICAodHlwZW9mIEhUTUxJbWFnZUVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MSW1hZ2VFbGVtZW50KTtcbiAgICB9XG5cbiAgICBfaXNJbWFnZUNhbnZhc0ludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiAodHlwZW9mIEhUTUxDYW52YXNFbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQpO1xuICAgIH1cblxuICAgIF9pc0ltYWdlVmlkZW9JbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBIVE1MVmlkZW9FbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTFZpZGVvRWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0IHZhbHVlcyB3aWxsIGJlIG11bHRpcGxpZWQgYnkgdGhlIHZhbHVlIG9mXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI21heFBpeGVsUmF0aW99IHRvIGdpdmUgdGhlIGZpbmFsIHJlc3VsdGFudCB3aWR0aCBhbmQgaGVpZ2h0IGZvciB0aGVcbiAgICAgKiBjYW52YXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBjYW52YXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGNvbnN0IHBpeGVsUmF0aW8gPSBNYXRoLm1pbih0aGlzLl9tYXhQaXhlbFJhdGlvLCBwbGF0Zm9ybS5icm93c2VyID8gd2luZG93LmRldmljZVBpeGVsUmF0aW8gOiAxKTtcbiAgICAgICAgY29uc3QgdyA9IE1hdGguZmxvb3Iod2lkdGggKiBwaXhlbFJhdGlvKTtcbiAgICAgICAgY29uc3QgaCA9IE1hdGguZmxvb3IoaGVpZ2h0ICogcGl4ZWxSYXRpbyk7XG4gICAgICAgIGlmICh3ICE9PSB0aGlzLmNhbnZhcy53aWR0aCB8fCBoICE9PSB0aGlzLmNhbnZhcy5oZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVzb2x1dGlvbih3LCBoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhlIGNhbnZhcywgdGhlbiBmaXJlcyB0aGUgYHJlc2l6ZWNhbnZhc2AgZXZlbnQuIE5vdGUgdGhhdCB0aGVcbiAgICAgKiB2YWx1ZSBvZiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjbWF4UGl4ZWxSYXRpb30gaXMgaWdub3JlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSBuZXcgd2lkdGggb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIG5ldyBoZWlnaHQgb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0UmVzb2x1dGlvbih3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgdGhpcy5maXJlKEdyYXBoaWNzRGV2aWNlLkVWRU5UX1JFU0laRSwgd2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ2xpZW50UmVjdCgpIHtcbiAgICAgICAgdGhpcy5jbGllbnRSZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2lkdGggb2YgdGhlIGJhY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYW52YXMud2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVpZ2h0IG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBEZWJ1Zy5lcnJvcihcIkdyYXBoaWNzRGV2aWNlLmZ1bGxzY3JlZW4gaXMgbm90IGltcGxlbWVudGVkIG9uIGN1cnJlbnQgZGV2aWNlLlwiKTtcbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS5mdWxsc2NyZWVuIGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXhpbXVtIHBpeGVsIHJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWF4UGl4ZWxSYXRpbyhyYXRpbykge1xuICAgICAgICB0aGlzLl9tYXhQaXhlbFJhdGlvID0gcmF0aW87XG4gICAgfVxuXG4gICAgZ2V0IG1heFBpeGVsUmF0aW8oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhQaXhlbFJhdGlvO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSBkZXZpY2UuIENhbiBiZSBvbmUgb2YgcGMuREVWSUNFVFlQRV9XRUJHTDEsIHBjLkRFVklDRVRZUEVfV0VCR0wyIG9yIHBjLkRFVklDRVRZUEVfV0VCR1BVLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMSB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMiB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdQVX1cbiAgICAgKi9cbiAgICBnZXQgZGV2aWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RldmljZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgcmVmZXJlbmNlZCBieSBhIHNoYWRlci4gVGhlIHNoYWRlclxuICAgICAqIGdlbmVyYXRvcnMgKHByb2dyYW1saWIpIHVzZSB0aGlzIG51bWJlciB0byBzcGVjaWZ5IHRoZSBtYXRyaXggYXJyYXkgc2l6ZSBvZiB0aGUgdW5pZm9ybVxuICAgICAqICdtYXRyaXhfcG9zZVswXScuIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm0gdmVjdG9yc1xuICAgICAqIGF2YWlsYWJsZSBhZnRlciBzdWJ0cmFjdGluZyB0aGUgbnVtYmVyIHRha2VuIGJ5IGEgdHlwaWNhbCBoZWF2eXdlaWdodCBzaGFkZXIuIElmIGEgZGlmZmVyZW50XG4gICAgICogbnVtYmVyIGlzIHJlcXVpcmVkLCBpdCBjYW4gYmUgdHVuZWQgdmlhIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRCb25lTGltaXR9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1heGltdW0gbnVtYmVyIG9mIGJvbmVzIHRoYXQgY2FuIGJlIHN1cHBvcnRlZCBieSB0aGUgaG9zdCBoYXJkd2FyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Qm9uZUxpbWl0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib25lTGltaXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IHRoZSBkZXZpY2UgY2FuIHN1cHBvcnQgb24gdGhlIGN1cnJlbnQgaGFyZHdhcmUuXG4gICAgICogVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGRlZmF1bHQgY2FsY3VsYXRlZCB2YWx1ZSBiYXNlZCBvbiBhdmFpbGFibGUgdmVjdG9yIHVuaWZvcm1zIHRvIGJlXG4gICAgICogb3ZlcnJpZGRlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhCb25lcyAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyBzdXBwb3J0ZWQgYnkgdGhlIGhvc3QgaGFyZHdhcmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEJvbmVMaW1pdChtYXhCb25lcykge1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IG1heEJvbmVzO1xuICAgIH1cblxuICAgIHN0YXJ0UmVuZGVyUGFzcyhyZW5kZXJQYXNzKSB7XG4gICAgfVxuXG4gICAgZW5kUmVuZGVyUGFzcyhyZW5kZXJQYXNzKSB7XG4gICAgfVxuXG4gICAgc3RhcnRDb21wdXRlUGFzcygpIHtcbiAgICB9XG5cbiAgICBlbmRDb21wdXRlUGFzcygpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB3aGljaCBleGVjdXRlcyBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lLiBUaGlzIHNob3VsZCBub3QgYmUgY2FsbGVkIG1hbnVhbGx5LCBhc1xuICAgICAqIGl0IGlzIGhhbmRsZWQgYnkgdGhlIEFwcEJhc2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJhbWVTdGFydCgpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJQYXNzSW5kZXggPSAwO1xuICAgICAgICB0aGlzLnJlbmRlclZlcnNpb24rKztcblxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcblxuICAgICAgICAgICAgLy8gbG9nIG91dCBhbGwgbG9hZGVkIHRleHR1cmVzLCBzb3J0ZWQgYnkgZ3B1IG1lbW9yeSBzaXplXG4gICAgICAgICAgICBpZiAoVHJhY2luZy5nZXQoVFJBQ0VJRF9URVhUVVJFUykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlcyA9IHRoaXMudGV4dHVyZXMuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlcy5zb3J0KChhLCBiKSA9PiBiLmdwdVNpemUgLSBhLmdwdVNpemUpO1xuICAgICAgICAgICAgICAgIERlYnVnLmxvZyhgVGV4dHVyZXM6ICR7dGV4dHVyZXMubGVuZ3RofWApO1xuICAgICAgICAgICAgICAgIGxldCB0ZXh0dXJlVG90YWwgPSAwO1xuICAgICAgICAgICAgICAgIHRleHR1cmVzLmZvckVhY2goKHRleHR1cmUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVTaXplICA9IHRleHR1cmUuZ3B1U2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZVRvdGFsICs9IHRleHR1cmVTaXplO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5sb2coYCR7aW5kZXh9LiAke3RleHR1cmUubmFtZX0gJHt0ZXh0dXJlLndpZHRofXgke3RleHR1cmUuaGVpZ2h0fSBWUkFNOiAkeyh0ZXh0dXJlU2l6ZSAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDIpfSBNQmApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIERlYnVnLmxvZyhgVG90YWw6ICR7KHRleHR1cmVUb3RhbCAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDIpfU1CYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHdoaWNoIGV4ZWN1dGVzIGF0IHRoZSBlbmQgb2YgdGhlIGZyYW1lLiBUaGlzIHNob3VsZCBub3QgYmUgY2FsbGVkIG1hbnVhbGx5LCBhcyBpdCBpc1xuICAgICAqIGhhbmRsZWQgYnkgdGhlIEFwcEJhc2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJhbWVFbmQoKSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgcmVuZGVyYWJsZSBIRFIgcGl4ZWwgZm9ybWF0IHN1cHBvcnRlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2Zvcm1hdHNdIC0gQW4gYXJyYXkgb2YgcGl4ZWwgZm9ybWF0cyB0byBjaGVjayBmb3Igc3VwcG9ydC4gQ2FuIGNvbnRhaW46XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF8xMTExMTBGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTMyRn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2ZpbHRlcmFibGVdIC0gSWYgdHJ1ZSwgdGhlIGZvcm1hdCBhbHNvIG5lZWRzIHRvIGJlIGZpbHRlcmFibGUuIERlZmF1bHRzIHRvXG4gICAgICogdHJ1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfHVuZGVmaW5lZH0gVGhlIGZpcnN0IHN1cHBvcnRlZCByZW5kZXJhYmxlIEhEUiBmb3JtYXQgb3IgdW5kZWZpbmVkIGlmIG5vbmUgaXNcbiAgICAgKiBzdXBwb3J0ZWQuXG4gICAgICovXG4gICAgZ2V0UmVuZGVyYWJsZUhkckZvcm1hdChmb3JtYXRzID0gW1BJWEVMRk9STUFUXzExMTExMEYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQkEzMkZdLCBmaWx0ZXJhYmxlID0gdHJ1ZSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZvcm1hdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IGZvcm1hdHNbaV07XG4gICAgICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuXG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF8xMTExMTBGOiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnRleHR1cmVSRzExQjEwUmVuZGVyYWJsZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTE2RjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgJiYgKCFmaWx0ZXJhYmxlIHx8IHRoaXMudGV4dHVyZUhhbGZGbG9hdEZpbHRlcmFibGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm9ybWF0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJGOlxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlICYmICghZmlsdGVyYWJsZSB8fCB0aGlzLnRleHR1cmVGbG9hdEZpbHRlcmFibGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm9ybWF0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHcmFwaGljc0RldmljZSB9O1xuIl0sIm5hbWVzIjpbIkdyYXBoaWNzRGV2aWNlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwiX3RoaXMkaW5pdE9wdGlvbnMiLCJfdGhpcyRpbml0T3B0aW9ucyRkZXAiLCJfdGhpcyRpbml0T3B0aW9uczIiLCJfdGhpcyRpbml0T3B0aW9uczIkc3QiLCJfdGhpcyRpbml0T3B0aW9uczMiLCJfdGhpcyRpbml0T3B0aW9uczMkYW4iLCJfdGhpcyRpbml0T3B0aW9uczQiLCJfdGhpcyRpbml0T3B0aW9uczQkcG8iLCJiYWNrQnVmZmVyIiwiYmFja0J1ZmZlclNpemUiLCJWZWMyIiwiYmFja0J1ZmZlckZvcm1hdCIsImJhY2tCdWZmZXJBbnRpYWxpYXMiLCJpc1dlYkdQVSIsImlzV2ViR0wxIiwiaXNXZWJHTDIiLCJzY29wZSIsImJvbmVMaW1pdCIsIm1heEFuaXNvdHJvcHkiLCJtYXhDdWJlTWFwU2l6ZSIsIm1heFRleHR1cmVTaXplIiwibWF4Vm9sdW1lU2l6ZSIsIm1heENvbG9yQXR0YWNobWVudHMiLCJwcmVjaXNpb24iLCJzYW1wbGVzIiwic3VwcG9ydHNTdGVuY2lsIiwic3VwcG9ydHNNcnQiLCJzdXBwb3J0c1ZvbHVtZVRleHR1cmVzIiwic3VwcG9ydHNDb21wdXRlIiwicmVuZGVyVGFyZ2V0Iiwic2hhZGVycyIsInRleHR1cmVzIiwidGFyZ2V0cyIsIlNldCIsInJlbmRlclZlcnNpb24iLCJyZW5kZXJQYXNzSW5kZXgiLCJpbnNpZGVSZW5kZXJQYXNzIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsInRleHR1cmVGbG9hdEZpbHRlcmFibGUiLCJ0ZXh0dXJlSGFsZkZsb2F0RmlsdGVyYWJsZSIsInF1YWRWZXJ0ZXhCdWZmZXIiLCJibGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsImRlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwic3RlbmNpbEVuYWJsZWQiLCJzdGVuY2lsRnJvbnQiLCJTdGVuY2lsUGFyYW1ldGVycyIsInN0ZW5jaWxCYWNrIiwiZHluYW1pY0J1ZmZlcnMiLCJncHVQcm9maWxlciIsImRlZmF1bHRDbGVhck9wdGlvbnMiLCJjb2xvciIsImRlcHRoIiwic3RlbmNpbCIsImZsYWdzIiwiQ0xFQVJGTEFHX0NPTE9SIiwiQ0xFQVJGTEFHX0RFUFRIIiwiaW5pdE9wdGlvbnMiLCJfZXh0ZW5kcyIsImFudGlhbGlhcyIsInBvd2VyUHJlZmVyZW5jZSIsIl9tYXhQaXhlbFJhdGlvIiwicGxhdGZvcm0iLCJicm93c2VyIiwiTWF0aCIsIm1pbiIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJidWZmZXJzIiwiX3ZyYW0iLCJ0ZXhTaGFkb3ciLCJ0ZXhBc3NldCIsInRleExpZ2h0bWFwIiwidGV4IiwidmIiLCJpYiIsInViIiwiX3NoYWRlclN0YXRzIiwidnNDb21waWxlZCIsImZzQ29tcGlsZWQiLCJsaW5rZWQiLCJtYXRlcmlhbFNoYWRlcnMiLCJjb21waWxlVGltZSIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsImkiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX1RSSUZBTiIsIl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUiLCJTY29wZVNwYWNlIiwidGV4dHVyZUJpYXMiLCJyZXNvbHZlIiwic2V0VmFsdWUiLCJwb3N0SW5pdCIsInZlcnRleEZvcm1hdCIsIlZlcnRleEZvcm1hdCIsInNlbWFudGljIiwiU0VNQU5USUNfUE9TSVRJT04iLCJjb21wb25lbnRzIiwidHlwZSIsIlRZUEVfRkxPQVQzMiIsInBvc2l0aW9ucyIsIkZsb2F0MzJBcnJheSIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9TVEFUSUMiLCJkZXN0cm95IiwiX3RoaXMkcXVhZFZlcnRleEJ1ZmZlIiwiX3RoaXMkZHluYW1pY0J1ZmZlcnMiLCJfdGhpcyRncHVQcm9maWxlciIsImZpcmUiLCJvbkRlc3Ryb3lTaGFkZXIiLCJzaGFkZXIiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwicG9zdERlc3Ryb3kiLCJ0b0pTT04iLCJrZXkiLCJ1bmRlZmluZWQiLCJpbmRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlcnMiLCJpbml0aWFsaXplUmVuZGVyU3RhdGUiLCJjdWxsTW9kZSIsIkNVTExGQUNFX0JBQ0siLCJ2eCIsInZ5IiwidnciLCJ2aCIsInN4Iiwic3kiLCJzdyIsInNoIiwiYmxlbmRDb2xvciIsIkNvbG9yIiwic2V0U3RlbmNpbFN0YXRlIiwiRGVidWciLCJhc3NlcnQiLCJzZXRCbGVuZFN0YXRlIiwic2V0QmxlbmRDb2xvciIsInIiLCJnIiwiYiIsImEiLCJzZXREZXB0aFN0YXRlIiwic2V0Q3VsbE1vZGUiLCJzZXRSZW5kZXJUYXJnZXQiLCJzZXRJbmRleEJ1ZmZlciIsInNldFZlcnRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlciIsInB1c2giLCJnZXRSZW5kZXJUYXJnZXQiLCJpbml0UmVuZGVyVGFyZ2V0IiwidGFyZ2V0IiwiaW5pdGlhbGl6ZWQiLCJzdGFydFRpbWUiLCJub3ciLCJ0aW1lc3RhbXAiLCJpbml0IiwiYWRkIiwiX2lzQnJvd3NlckludGVyZmFjZSIsInRleHR1cmUiLCJfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UiLCJfaXNJbWFnZUNhbnZhc0ludGVyZmFjZSIsIl9pc0ltYWdlVmlkZW9JbnRlcmZhY2UiLCJJbWFnZUJpdG1hcCIsIkhUTUxJbWFnZUVsZW1lbnQiLCJIVE1MQ2FudmFzRWxlbWVudCIsIkhUTUxWaWRlb0VsZW1lbnQiLCJyZXNpemVDYW52YXMiLCJ3aWR0aCIsImhlaWdodCIsInBpeGVsUmF0aW8iLCJ3IiwiZmxvb3IiLCJoIiwic2V0UmVzb2x1dGlvbiIsIkVWRU5UX1JFU0laRSIsInVwZGF0ZUNsaWVudFJlY3QiLCJjbGllbnRSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZnVsbHNjcmVlbiIsImVycm9yIiwibWF4UGl4ZWxSYXRpbyIsInJhdGlvIiwiZGV2aWNlVHlwZSIsIl9kZXZpY2VUeXBlIiwiZ2V0Qm9uZUxpbWl0Iiwic2V0Qm9uZUxpbWl0IiwibWF4Qm9uZXMiLCJzdGFydFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwiZW5kUmVuZGVyUGFzcyIsInN0YXJ0Q29tcHV0ZVBhc3MiLCJlbmRDb21wdXRlUGFzcyIsImZyYW1lU3RhcnQiLCJjYWxsIiwiVHJhY2luZyIsImdldCIsIlRSQUNFSURfVEVYVFVSRVMiLCJzbGljZSIsInNvcnQiLCJncHVTaXplIiwibG9nIiwibGVuZ3RoIiwidGV4dHVyZVRvdGFsIiwiZm9yRWFjaCIsImluZGV4IiwidGV4dHVyZVNpemUiLCJuYW1lIiwidG9GaXhlZCIsImZyYW1lRW5kIiwiZ2V0UmVuZGVyYWJsZUhkckZvcm1hdCIsImZvcm1hdHMiLCJQSVhFTEZPUk1BVF8xMTExMTBGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJmaWx0ZXJhYmxlIiwiZm9ybWF0IiwidGV4dHVyZVJHMTFCMTBSZW5kZXJhYmxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLFNBQVNDLFlBQVksQ0FBQztBQTJWdENDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxFQUFFO0FBQUEsSUFBQSxJQUFBQyxpQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxDQUFBO0FBQ3pCLElBQUEsS0FBSyxFQUFFLENBQUE7QUEzVlg7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQVQsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQVUsQ0FBQUEsVUFBVSxHQUFHLElBQUksQ0FBQTtBQUVqQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLGNBQWMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUUzQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsZ0JBQWdCLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLG1CQUFtQixHQUFHLEtBQUssQ0FBQTtBQUUzQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFMSSxJQU1B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
