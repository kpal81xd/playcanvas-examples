import { Debug } from '../../core/debug.js';
import { TRACEID_RENDER_TARGET_ALLOC } from '../../core/constants.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { GraphicsDevice } from './graphics-device.js';

let id = 0;

/**
 * A render target is a rectangular rendering surface.
 *
 * @category Graphics
 */
class RenderTarget {
  /**
   * Creates a new RenderTarget instance. A color buffer or a depth buffer must be set.
   *
   * @param {object} [options] - Object for passing optional arguments.
   * @param {boolean} [options.autoResolve] - If samples > 1, enables or disables automatic MSAA
   * resolve after rendering to this RT (see {@link RenderTarget#resolve}). Defaults to true.
   * @param {import('./texture.js').Texture} [options.colorBuffer] - The texture that this render
   * target will treat as a rendering surface.
   * @param {import('./texture.js').Texture[]} [options.colorBuffers] - The textures that this
   * render target will treat as a rendering surfaces. If this option is set, the colorBuffer
   * option is ignored. This option can be used only when {@link GraphicsDevice#supportsMrt} is
   * true.
   * @param {boolean} [options.depth] - If set to true, depth buffer will be created. Defaults to
   * true. Ignored if depthBuffer is defined.
   * @param {import('./texture.js').Texture} [options.depthBuffer] - The texture that this render
   * target will treat as a depth/stencil surface (WebGL2 only). If set, the 'depth' and
   * 'stencil' properties are ignored. Texture must have {@link PIXELFORMAT_DEPTH} or
   * {@link PIXELFORMAT_DEPTHSTENCIL} format.
   * @param {number} [options.face] - If the colorBuffer parameter is a cubemap, use this option
   * to specify the face of the cubemap to render to. Can be:
   *
   * - {@link CUBEFACE_POSX}
   * - {@link CUBEFACE_NEGX}
   * - {@link CUBEFACE_POSY}
   * - {@link CUBEFACE_NEGY}
   * - {@link CUBEFACE_POSZ}
   * - {@link CUBEFACE_NEGZ}
   *
   * Defaults to {@link CUBEFACE_POSX}.
   * @param {boolean} [options.flipY] - When set to true the image will be flipped in Y. Default
   * is false.
   * @param {string} [options.name] - The name of the render target.
   * @param {number} [options.samples] - Number of hardware anti-aliasing samples (not supported
   * on WebGL1). Default is 1.
   * @param {boolean} [options.stencil] - If set to true, depth buffer will include stencil.
   * Defaults to false. Ignored if depthBuffer is defined or depth is false.
   * @example
   * // Create a 512x512x24-bit render target with a depth buffer
   * const colorBuffer = new pc.Texture(graphicsDevice, {
   *     width: 512,
   *     height: 512,
   *     format: pc.PIXELFORMAT_RGB8
   * });
   * const renderTarget = new pc.RenderTarget({
   *     colorBuffer: colorBuffer,
   *     depth: true
   * });
   *
   * // Set the render target on a camera component
   * camera.renderTarget = renderTarget;
   *
   * // Destroy render target at a later stage. Note that the color buffer needs
   * // to be destroyed separately.
   * renderTarget.colorBuffer.destroy();
   * renderTarget.destroy();
   * camera.renderTarget = null;
   */
  constructor(options = {}) {
    var _options$face, _this$_colorBuffer, _this$_depthBuffer, _options$samples, _options$autoResolve, _options$flipY, _this$_colorBuffers;
    /**
     * The name of the render target.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * @type {import('./graphics-device.js').GraphicsDevice}
     * @private
     */
    this._device = void 0;
    /**
     * @type {import('./texture.js').Texture}
     * @private
     */
    this._colorBuffer = void 0;
    /**
     * @type {import('./texture.js').Texture[]}
     * @private
     */
    this._colorBuffers = void 0;
    /**
     * @type {import('./texture.js').Texture}
     * @private
     */
    this._depthBuffer = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._depth = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._stencil = void 0;
    /**
     * @type {number}
     * @private
     */
    this._samples = void 0;
    /** @type {boolean} */
    this.autoResolve = void 0;
    /**
     * @type {number}
     * @private
     */
    this._face = void 0;
    /** @type {boolean} */
    this.flipY = void 0;
    this.id = id++;
    const _arg2 = arguments[1];
    const _arg3 = arguments[2];
    if (options instanceof GraphicsDevice) {
      // old constructor
      this._colorBuffer = _arg2;
      options = _arg3;
      Debug.deprecated('pc.RenderTarget constructor no longer accepts GraphicsDevice parameter.');
    } else {
      // new constructor
      this._colorBuffer = options.colorBuffer;
    }

    // Use the single colorBuffer in the colorBuffers array. This allows us to always just use the array internally.
    if (this._colorBuffer) {
      this._colorBuffers = [this._colorBuffer];
    }

    // Process optional arguments
    this._depthBuffer = options.depthBuffer;
    this._face = (_options$face = options.face) != null ? _options$face : 0;
    if (this._depthBuffer) {
      const format = this._depthBuffer._format;
      if (format === PIXELFORMAT_DEPTH) {
        this._depth = true;
        this._stencil = false;
      } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
        this._depth = true;
        this._stencil = true;
      } else {
        Debug.warn('Incorrect depthBuffer format. Must be pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL');
        this._depth = false;
        this._stencil = false;
      }
    } else {
      var _options$depth, _options$stencil;
      this._depth = (_options$depth = options.depth) != null ? _options$depth : true;
      this._stencil = (_options$stencil = options.stencil) != null ? _options$stencil : false;
    }

    // MRT
    if (options.colorBuffers) {
      Debug.assert(!this._colorBuffers, 'When constructing RenderTarget and options.colorBuffers is used, options.colorBuffer must not be used.');
      if (!this._colorBuffers) {
        this._colorBuffers = [...options.colorBuffers];

        // set the main color buffer to point to 0 index
        this._colorBuffer = options.colorBuffers[0];
      }
    }

    // device, from one of the buffers
    const device = ((_this$_colorBuffer = this._colorBuffer) == null ? void 0 : _this$_colorBuffer.device) || ((_this$_depthBuffer = this._depthBuffer) == null ? void 0 : _this$_depthBuffer.device) || options.graphicsDevice;
    Debug.assert(device, "Failed to obtain the device, colorBuffer nor depthBuffer store it.");
    this._device = device;
    Debug.call(() => {
      if (this._colorBuffers) {
        Debug.assert(this._colorBuffers.length <= 1 || device.supportsMrt, 'Multiple render targets are not supported on this device');
      }
    });
    const {
      maxSamples
    } = this._device;
    this._samples = Math.min((_options$samples = options.samples) != null ? _options$samples : 1, maxSamples);

    // WebGPU only supports values of 1 or 4 for samples
    if (device.isWebGPU) {
      this._samples = this._samples > 1 ? maxSamples : 1;
    }
    this.autoResolve = (_options$autoResolve = options.autoResolve) != null ? _options$autoResolve : true;

    // use specified name, otherwise get one from color or depth buffer
    this.name = options.name;
    if (!this.name) {
      var _this$_colorBuffer2;
      this.name = (_this$_colorBuffer2 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer2.name;
    }
    if (!this.name) {
      var _this$_depthBuffer2;
      this.name = (_this$_depthBuffer2 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer2.name;
    }
    if (!this.name) {
      this.name = "Untitled";
    }

    // render image flipped in Y
    this.flipY = (_options$flipY = options.flipY) != null ? _options$flipY : false;
    this.validateMrt();

    // device specific implementation
    this.impl = device.createRenderTargetImpl(this);
    Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` + `[samples: ${this.samples}]` + `${(_this$_colorBuffers = this._colorBuffers) != null && _this$_colorBuffers.length ? `[MRT: ${this._colorBuffers.length}]` : ''}` + `${this.colorBuffer ? '[Color]' : ''}` + `${this.depth ? '[Depth]' : ''}` + `${this.stencil ? '[Stencil]' : ''}` + `[Face:${this.face}]`);
  }

  /**
   * Frees resources associated with this render target.
   */
  destroy() {
    Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    const device = this._device;
    if (device) {
      device.targets.delete(this);
      if (device.renderTarget === this) {
        device.setRenderTarget(null);
      }
      this.destroyFrameBuffers();
    }
  }

  /**
   * Free device resources associated with this render target.
   *
   * @ignore
   */
  destroyFrameBuffers() {
    const device = this._device;
    if (device) {
      this.impl.destroy(device);
    }
  }

  /**
   * Free textures associated with this render target.
   *
   * @ignore
   */
  destroyTextureBuffers() {
    var _this$_depthBuffer3, _this$_colorBuffers2;
    (_this$_depthBuffer3 = this._depthBuffer) == null || _this$_depthBuffer3.destroy();
    this._depthBuffer = null;
    (_this$_colorBuffers2 = this._colorBuffers) == null || _this$_colorBuffers2.forEach(colorBuffer => {
      colorBuffer.destroy();
    });
    this._colorBuffers = null;
    this._colorBuffer = null;
  }

  /**
   * Resizes the render target to the specified width and height. Internally this resizes all the
   * assigned texture color and depth buffers.
   *
   * @param {number} width - The width of the render target in pixels.
   * @param {number} height - The height of the render target in pixels.
   */
  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      var _this$_depthBuffer4, _this$_colorBuffers3;
      // release existing
      const device = this._device;
      this.destroyFrameBuffers();
      if (device.renderTarget === this) {
        device.setRenderTarget(null);
      }

      // resize textures
      (_this$_depthBuffer4 = this._depthBuffer) == null || _this$_depthBuffer4.resize(width, height);
      (_this$_colorBuffers3 = this._colorBuffers) == null || _this$_colorBuffers3.forEach(colorBuffer => {
        colorBuffer.resize(width, height);
      });

      // initialize again
      this.validateMrt();
      this.impl = device.createRenderTargetImpl(this);
    }
  }
  validateMrt() {
    Debug.call(() => {
      if (this._colorBuffers) {
        const {
          width,
          height,
          cubemap,
          volume
        } = this._colorBuffers[0];
        for (let i = 1; i < this._colorBuffers.length; i++) {
          const colorBuffer = this._colorBuffers[i];
          Debug.assert(colorBuffer.width === width, 'All render target color buffers must have the same width', this);
          Debug.assert(colorBuffer.height === height, 'All render target color buffers must have the same height', this);
          Debug.assert(colorBuffer.cubemap === cubemap, 'All render target color buffers must have the same cubemap setting', this);
          Debug.assert(colorBuffer.volume === volume, 'All render target color buffers must have the same volume setting', this);
        }
      }
    });
  }

  /**
   * Initializes the resources associated with this render target.
   *
   * @ignore
   */
  init() {
    this.impl.init(this._device, this);
  }

  /** @ignore */
  get initialized() {
    return this.impl.initialized;
  }

  /** @ignore */
  get device() {
    return this._device;
  }

  /**
   * Called when the device context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.impl.loseContext();
  }

  /**
   * If samples > 1, resolves the anti-aliased render target (WebGL2 only). When you're rendering
   * to an anti-aliased render target, pixels aren't written directly to the readable texture.
   * Instead, they're first written to a MSAA buffer, where each sample for each pixel is stored
   * independently. In order to read the results, you first need to 'resolve' the buffer - to
   * average all samples and create a simple texture with one color per pixel. This function
   * performs this averaging and updates the colorBuffer and the depthBuffer. If autoResolve is
   * set to true, the resolve will happen after every rendering to this render target, otherwise
   * you can do it manually, during the app update or inside a {@link Command}.
   *
   * @param {boolean} [color] - Resolve color buffer. Defaults to true.
   * @param {boolean} [depth] - Resolve depth buffer. Defaults to true if the render target has a
   * depth buffer.
   */
  resolve(color = true, depth = !!this._depthBuffer) {
    // TODO: consider adding support for MRT to this function.

    if (this._device && this._samples > 1) {
      DebugGraphics.pushGpuMarker(this._device, `RESOLVE-RT:${this.name}`);
      this.impl.resolve(this._device, this, color, depth);
      DebugGraphics.popGpuMarker(this._device);
    }
  }

  /**
   * Copies color and/or depth contents of source render target to this one. Formats, sizes and
   * anti-aliasing samples must match. Depth buffer can only be copied on WebGL 2.0.
   *
   * @param {RenderTarget} source - Source render target to copy from.
   * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
   * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
   * @returns {boolean} True if the copy was successful, false otherwise.
   */
  copy(source, color, depth) {
    // TODO: consider adding support for MRT to this function.

    if (!this._device) {
      if (source._device) {
        this._device = source._device;
      } else {
        Debug.error("Render targets are not initialized");
        return false;
      }
    }
    DebugGraphics.pushGpuMarker(this._device, `COPY-RT:${source.name}->${this.name}`);
    const success = this._device.copyRenderTarget(source, this, color, depth);
    DebugGraphics.popGpuMarker(this._device);
    return success;
  }

  /**
   * Number of antialiasing samples the render target uses.
   *
   * @type {number}
   */
  get samples() {
    return this._samples;
  }

  /**
   * True if the render target contains the depth attachment.
   *
   * @type {boolean}
   */
  get depth() {
    return this._depth;
  }

  /**
   * True if the render target contains the stencil attachment.
   *
   * @type {boolean}
   */
  get stencil() {
    return this._stencil;
  }

  /**
   * Color buffer set up on the render target.
   *
   * @type {import('./texture.js').Texture}
   */
  get colorBuffer() {
    return this._colorBuffer;
  }

  /**
   * Accessor for multiple render target color buffers.
   *
   * @param {*} index - Index of the color buffer to get.
   * @returns {import('./texture.js').Texture} - Color buffer at the specified index.
   */
  getColorBuffer(index) {
    var _this$_colorBuffers4;
    return (_this$_colorBuffers4 = this._colorBuffers) == null ? void 0 : _this$_colorBuffers4[index];
  }

  /**
   * Depth buffer set up on the render target. Only available, if depthBuffer was set in
   * constructor. Not available if depth property was used instead.
   *
   * @type {import('./texture.js').Texture}
   */
  get depthBuffer() {
    return this._depthBuffer;
  }

  /**
   * If the render target is bound to a cubemap, this property specifies which face of the
   * cubemap is rendered to. Can be:
   *
   * - {@link CUBEFACE_POSX}
   * - {@link CUBEFACE_NEGX}
   * - {@link CUBEFACE_POSY}
   * - {@link CUBEFACE_NEGY}
   * - {@link CUBEFACE_POSZ}
   * - {@link CUBEFACE_NEGZ}
   *
   * @type {number}
   */
  get face() {
    return this._face;
  }

  /**
   * Width of the render target in pixels.
   *
   * @type {number}
   */
  get width() {
    var _this$_colorBuffer3, _this$_depthBuffer5;
    return ((_this$_colorBuffer3 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer3.width) || ((_this$_depthBuffer5 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer5.width) || this._device.width;
  }

  /**
   * Height of the render target in pixels.
   *
   * @type {number}
   */
  get height() {
    var _this$_colorBuffer4, _this$_depthBuffer6;
    return ((_this$_colorBuffer4 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer4.height) || ((_this$_depthBuffer6 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer6.height) || this._device.height;
  }
}

export { RenderTarget };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXRhcmdldC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfUkVOREVSX1RBUkdFVF9BTExPQyB9IGZyb20gJy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX0RFUFRILCBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHJlbmRlciB0YXJnZXQgaXMgYSByZWN0YW5ndWxhciByZW5kZXJpbmcgc3VyZmFjZS5cbiAqXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgUmVuZGVyVGFyZ2V0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgbmFtZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGV2aWNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb2xvckJ1ZmZlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb2xvckJ1ZmZlcnM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoQnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGg7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zdGVuY2lsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zYW1wbGVzO1xuXG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGF1dG9SZXNvbHZlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9mYWNlO1xuXG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGZsaXBZO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBSZW5kZXJUYXJnZXQgaW5zdGFuY2UuIEEgY29sb3IgYnVmZmVyIG9yIGEgZGVwdGggYnVmZmVyIG11c3QgYmUgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCBmb3IgcGFzc2luZyBvcHRpb25hbCBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hdXRvUmVzb2x2ZV0gLSBJZiBzYW1wbGVzID4gMSwgZW5hYmxlcyBvciBkaXNhYmxlcyBhdXRvbWF0aWMgTVNBQVxuICAgICAqIHJlc29sdmUgYWZ0ZXIgcmVuZGVyaW5nIHRvIHRoaXMgUlQgKHNlZSB7QGxpbmsgUmVuZGVyVGFyZ2V0I3Jlc29sdmV9KS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gW29wdGlvbnMuY29sb3JCdWZmZXJdIC0gVGhlIHRleHR1cmUgdGhhdCB0aGlzIHJlbmRlclxuICAgICAqIHRhcmdldCB3aWxsIHRyZWF0IGFzIGEgcmVuZGVyaW5nIHN1cmZhY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vdGV4dHVyZS5qcycpLlRleHR1cmVbXX0gW29wdGlvbnMuY29sb3JCdWZmZXJzXSAtIFRoZSB0ZXh0dXJlcyB0aGF0IHRoaXNcbiAgICAgKiByZW5kZXIgdGFyZ2V0IHdpbGwgdHJlYXQgYXMgYSByZW5kZXJpbmcgc3VyZmFjZXMuIElmIHRoaXMgb3B0aW9uIGlzIHNldCwgdGhlIGNvbG9yQnVmZmVyXG4gICAgICogb3B0aW9uIGlzIGlnbm9yZWQuIFRoaXMgb3B0aW9uIGNhbiBiZSB1c2VkIG9ubHkgd2hlbiB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc3VwcG9ydHNNcnR9IGlzXG4gICAgICogdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlcHRoXSAtIElmIHNldCB0byB0cnVlLCBkZXB0aCBidWZmZXIgd2lsbCBiZSBjcmVhdGVkLiBEZWZhdWx0cyB0b1xuICAgICAqIHRydWUuIElnbm9yZWQgaWYgZGVwdGhCdWZmZXIgaXMgZGVmaW5lZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gW29wdGlvbnMuZGVwdGhCdWZmZXJdIC0gVGhlIHRleHR1cmUgdGhhdCB0aGlzIHJlbmRlclxuICAgICAqIHRhcmdldCB3aWxsIHRyZWF0IGFzIGEgZGVwdGgvc3RlbmNpbCBzdXJmYWNlIChXZWJHTDIgb25seSkuIElmIHNldCwgdGhlICdkZXB0aCcgYW5kXG4gICAgICogJ3N0ZW5jaWwnIHByb3BlcnRpZXMgYXJlIGlnbm9yZWQuIFRleHR1cmUgbXVzdCBoYXZlIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3JcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSBmb3JtYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gSWYgdGhlIGNvbG9yQnVmZmVyIHBhcmFtZXRlciBpcyBhIGN1YmVtYXAsIHVzZSB0aGlzIG9wdGlvblxuICAgICAqIHRvIHNwZWNpZnkgdGhlIGZhY2Ugb2YgdGhlIGN1YmVtYXAgdG8gcmVuZGVyIHRvLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9QT1NYfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX05FR1h9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfUE9TWX1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9ORUdZfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX1BPU1p9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfTkVHWn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBDVUJFRkFDRV9QT1NYfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZsaXBZXSAtIFdoZW4gc2V0IHRvIHRydWUgdGhlIGltYWdlIHdpbGwgYmUgZmxpcHBlZCBpbiBZLiBEZWZhdWx0XG4gICAgICogaXMgZmFsc2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHJlbmRlciB0YXJnZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNhbXBsZXNdIC0gTnVtYmVyIG9mIGhhcmR3YXJlIGFudGktYWxpYXNpbmcgc2FtcGxlcyAobm90IHN1cHBvcnRlZFxuICAgICAqIG9uIFdlYkdMMSkuIERlZmF1bHQgaXMgMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWxdIC0gSWYgc2V0IHRvIHRydWUsIGRlcHRoIGJ1ZmZlciB3aWxsIGluY2x1ZGUgc3RlbmNpbC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS4gSWdub3JlZCBpZiBkZXB0aEJ1ZmZlciBpcyBkZWZpbmVkIG9yIGRlcHRoIGlzIGZhbHNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNTEyeDUxMngyNC1iaXQgcmVuZGVyIHRhcmdldCB3aXRoIGEgZGVwdGggYnVmZmVyXG4gICAgICogY29uc3QgY29sb3JCdWZmZXIgPSBuZXcgcGMuVGV4dHVyZShncmFwaGljc0RldmljZSwge1xuICAgICAqICAgICB3aWR0aDogNTEyLFxuICAgICAqICAgICBoZWlnaHQ6IDUxMixcbiAgICAgKiAgICAgZm9ybWF0OiBwYy5QSVhFTEZPUk1BVF9SR0I4XG4gICAgICogfSk7XG4gICAgICogY29uc3QgcmVuZGVyVGFyZ2V0ID0gbmV3IHBjLlJlbmRlclRhcmdldCh7XG4gICAgICogICAgIGNvbG9yQnVmZmVyOiBjb2xvckJ1ZmZlcixcbiAgICAgKiAgICAgZGVwdGg6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldCBvbiBhIGNhbWVyYSBjb21wb25lbnRcbiAgICAgKiBjYW1lcmEucmVuZGVyVGFyZ2V0ID0gcmVuZGVyVGFyZ2V0O1xuICAgICAqXG4gICAgICogLy8gRGVzdHJveSByZW5kZXIgdGFyZ2V0IGF0IGEgbGF0ZXIgc3RhZ2UuIE5vdGUgdGhhdCB0aGUgY29sb3IgYnVmZmVyIG5lZWRzXG4gICAgICogLy8gdG8gYmUgZGVzdHJveWVkIHNlcGFyYXRlbHkuXG4gICAgICogcmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgKiByZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAqIGNhbWVyYS5yZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcblxuICAgICAgICBjb25zdCBfYXJnMiA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgY29uc3QgX2FyZzMgPSBhcmd1bWVudHNbMl07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICAgICAgLy8gb2xkIGNvbnN0cnVjdG9yXG4gICAgICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlciA9IF9hcmcyO1xuICAgICAgICAgICAgb3B0aW9ucyA9IF9hcmczO1xuXG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQgY29uc3RydWN0b3Igbm8gbG9uZ2VyIGFjY2VwdHMgR3JhcGhpY3NEZXZpY2UgcGFyYW1ldGVyLicpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBuZXcgY29uc3RydWN0b3JcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yQnVmZmVyID0gb3B0aW9ucy5jb2xvckJ1ZmZlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZSB0aGUgc2luZ2xlIGNvbG9yQnVmZmVyIGluIHRoZSBjb2xvckJ1ZmZlcnMgYXJyYXkuIFRoaXMgYWxsb3dzIHVzIHRvIGFsd2F5cyBqdXN0IHVzZSB0aGUgYXJyYXkgaW50ZXJuYWxseS5cbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlcnMgPSBbdGhpcy5fY29sb3JCdWZmZXJdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUHJvY2VzcyBvcHRpb25hbCBhcmd1bWVudHNcbiAgICAgICAgdGhpcy5fZGVwdGhCdWZmZXIgPSBvcHRpb25zLmRlcHRoQnVmZmVyO1xuICAgICAgICB0aGlzLl9mYWNlID0gb3B0aW9ucy5mYWNlID8/IDA7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSB0aGlzLl9kZXB0aEJ1ZmZlci5fZm9ybWF0O1xuICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfREVQVEgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXB0aCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RlbmNpbCA9IGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQgPT09IFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGVuY2lsID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignSW5jb3JyZWN0IGRlcHRoQnVmZmVyIGZvcm1hdC4gTXVzdCBiZSBwYy5QSVhFTEZPUk1BVF9ERVBUSCBvciBwYy5QSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwnKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXB0aCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gb3B0aW9ucy5kZXB0aCA/PyB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc3RlbmNpbCA9IG9wdGlvbnMuc3RlbmNpbCA/PyBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1SVFxuICAgICAgICBpZiAob3B0aW9ucy5jb2xvckJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCghdGhpcy5fY29sb3JCdWZmZXJzLCAnV2hlbiBjb25zdHJ1Y3RpbmcgUmVuZGVyVGFyZ2V0IGFuZCBvcHRpb25zLmNvbG9yQnVmZmVycyBpcyB1c2VkLCBvcHRpb25zLmNvbG9yQnVmZmVyIG11c3Qgbm90IGJlIHVzZWQuJyk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fY29sb3JCdWZmZXJzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JCdWZmZXJzID0gWy4uLm9wdGlvbnMuY29sb3JCdWZmZXJzXTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgbWFpbiBjb2xvciBidWZmZXIgdG8gcG9pbnQgdG8gMCBpbmRleFxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yQnVmZmVyID0gb3B0aW9ucy5jb2xvckJ1ZmZlcnNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXZpY2UsIGZyb20gb25lIG9mIHRoZSBidWZmZXJzXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuX2NvbG9yQnVmZmVyPy5kZXZpY2UgfHwgdGhpcy5fZGVwdGhCdWZmZXI/LmRldmljZSB8fCBvcHRpb25zLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGV2aWNlLCBcIkZhaWxlZCB0byBvYnRhaW4gdGhlIGRldmljZSwgY29sb3JCdWZmZXIgbm9yIGRlcHRoQnVmZmVyIHN0b3JlIGl0LlwiKTtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gZGV2aWNlO1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbG9yQnVmZmVycykge1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9jb2xvckJ1ZmZlcnMubGVuZ3RoIDw9IDEgfHwgZGV2aWNlLnN1cHBvcnRzTXJ0LCAnTXVsdGlwbGUgcmVuZGVyIHRhcmdldHMgYXJlIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBkZXZpY2UnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgeyBtYXhTYW1wbGVzIH0gPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgIHRoaXMuX3NhbXBsZXMgPSBNYXRoLm1pbihvcHRpb25zLnNhbXBsZXMgPz8gMSwgbWF4U2FtcGxlcyk7XG5cbiAgICAgICAgLy8gV2ViR1BVIG9ubHkgc3VwcG9ydHMgdmFsdWVzIG9mIDEgb3IgNCBmb3Igc2FtcGxlc1xuICAgICAgICBpZiAoZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICB0aGlzLl9zYW1wbGVzID0gdGhpcy5fc2FtcGxlcyA+IDEgPyBtYXhTYW1wbGVzIDogMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXV0b1Jlc29sdmUgPSBvcHRpb25zLmF1dG9SZXNvbHZlID8/IHRydWU7XG5cbiAgICAgICAgLy8gdXNlIHNwZWNpZmllZCBuYW1lLCBvdGhlcndpc2UgZ2V0IG9uZSBmcm9tIGNvbG9yIG9yIGRlcHRoIGJ1ZmZlclxuICAgICAgICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgICAgIGlmICghdGhpcy5uYW1lKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB0aGlzLl9jb2xvckJ1ZmZlcj8ubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMubmFtZSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gdGhpcy5fZGVwdGhCdWZmZXI/Lm5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLm5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IFwiVW50aXRsZWRcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbmRlciBpbWFnZSBmbGlwcGVkIGluIFlcbiAgICAgICAgdGhpcy5mbGlwWSA9IG9wdGlvbnMuZmxpcFkgPz8gZmFsc2U7XG5cbiAgICAgICAgdGhpcy52YWxpZGF0ZU1ydCgpO1xuXG4gICAgICAgIC8vIGRldmljZSBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvblxuICAgICAgICB0aGlzLmltcGwgPSBkZXZpY2UuY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCh0aGlzKTtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9UQVJHRVRfQUxMT0MsIGBBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX06ICR7dGhpcy53aWR0aH14JHt0aGlzLmhlaWdodH0gYCArXG4gICAgICAgICAgICBgW3NhbXBsZXM6ICR7dGhpcy5zYW1wbGVzfV1gICtcbiAgICAgICAgICAgIGAke3RoaXMuX2NvbG9yQnVmZmVycz8ubGVuZ3RoID8gYFtNUlQ6ICR7dGhpcy5fY29sb3JCdWZmZXJzLmxlbmd0aH1dYCA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5jb2xvckJ1ZmZlciA/ICdbQ29sb3JdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5kZXB0aCA/ICdbRGVwdGhdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5zdGVuY2lsID8gJ1tTdGVuY2lsXScgOiAnJ31gICtcbiAgICAgICAgICAgIGBbRmFjZToke3RoaXMuZmFjZX1dYCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9UQVJHRVRfQUxMT0MsIGBEZUFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuX2RldmljZTtcbiAgICAgICAgaWYgKGRldmljZSkge1xuICAgICAgICAgICAgZGV2aWNlLnRhcmdldHMuZGVsZXRlKHRoaXMpO1xuXG4gICAgICAgICAgICBpZiAoZGV2aWNlLnJlbmRlclRhcmdldCA9PT0gdGhpcykge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQobnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUZyYW1lQnVmZmVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZSBkZXZpY2UgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveUZyYW1lQnVmZmVycygpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRleHR1cmVzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveVRleHR1cmVCdWZmZXJzKCkge1xuXG4gICAgICAgIHRoaXMuX2RlcHRoQnVmZmVyPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2RlcHRoQnVmZmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlcnM/LmZvckVhY2goKGNvbG9yQnVmZmVyKSA9PiB7XG4gICAgICAgICAgICBjb2xvckJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlcnMgPSBudWxsO1xuICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlciA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzaXplcyB0aGUgcmVuZGVyIHRhcmdldCB0byB0aGUgc3BlY2lmaWVkIHdpZHRoIGFuZCBoZWlnaHQuIEludGVybmFsbHkgdGhpcyByZXNpemVzIGFsbCB0aGVcbiAgICAgKiBhc3NpZ25lZCB0ZXh0dXJlIGNvbG9yIGFuZCBkZXB0aCBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSByZW5kZXIgdGFyZ2V0IGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVuZGVyIHRhcmdldCBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgcmVzaXplKHdpZHRoLCBoZWlnaHQpIHtcblxuICAgICAgICBpZiAodGhpcy53aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5oZWlnaHQgIT09IGhlaWdodCkge1xuXG4gICAgICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nXG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lGcmFtZUJ1ZmZlcnMoKTtcbiAgICAgICAgICAgIGlmIChkZXZpY2UucmVuZGVyVGFyZ2V0ID09PSB0aGlzKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldFJlbmRlclRhcmdldChudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVzaXplIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLl9kZXB0aEJ1ZmZlcj8ucmVzaXplKHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JCdWZmZXJzPy5mb3JFYWNoKChjb2xvckJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLnJlc2l6ZSh3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGFnYWluXG4gICAgICAgICAgICB0aGlzLnZhbGlkYXRlTXJ0KCk7XG4gICAgICAgICAgICB0aGlzLmltcGwgPSBkZXZpY2UuY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhbGlkYXRlTXJ0KCkge1xuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jb2xvckJ1ZmZlcnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQsIGN1YmVtYXAsIHZvbHVtZSB9ID0gdGhpcy5fY29sb3JCdWZmZXJzWzBdO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdGhpcy5fY29sb3JCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGhpcy5fY29sb3JCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoY29sb3JCdWZmZXIud2lkdGggPT09IHdpZHRoLCAnQWxsIHJlbmRlciB0YXJnZXQgY29sb3IgYnVmZmVycyBtdXN0IGhhdmUgdGhlIHNhbWUgd2lkdGgnLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGNvbG9yQnVmZmVyLmhlaWdodCA9PT0gaGVpZ2h0LCAnQWxsIHJlbmRlciB0YXJnZXQgY29sb3IgYnVmZmVycyBtdXN0IGhhdmUgdGhlIHNhbWUgaGVpZ2h0JywgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChjb2xvckJ1ZmZlci5jdWJlbWFwID09PSBjdWJlbWFwLCAnQWxsIHJlbmRlciB0YXJnZXQgY29sb3IgYnVmZmVycyBtdXN0IGhhdmUgdGhlIHNhbWUgY3ViZW1hcCBzZXR0aW5nJywgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChjb2xvckJ1ZmZlci52b2x1bWUgPT09IHZvbHVtZSwgJ0FsbCByZW5kZXIgdGFyZ2V0IGNvbG9yIGJ1ZmZlcnMgbXVzdCBoYXZlIHRoZSBzYW1lIHZvbHVtZSBzZXR0aW5nJywgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmluaXQodGhpcy5fZGV2aWNlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGdldCBpbml0aWFsaXplZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5pbml0aWFsaXplZDtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGdldCBkZXZpY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXZpY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIGRldmljZSBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgc2FtcGxlcyA+IDEsIHJlc29sdmVzIHRoZSBhbnRpLWFsaWFzZWQgcmVuZGVyIHRhcmdldCAoV2ViR0wyIG9ubHkpLiBXaGVuIHlvdSdyZSByZW5kZXJpbmdcbiAgICAgKiB0byBhbiBhbnRpLWFsaWFzZWQgcmVuZGVyIHRhcmdldCwgcGl4ZWxzIGFyZW4ndCB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSByZWFkYWJsZSB0ZXh0dXJlLlxuICAgICAqIEluc3RlYWQsIHRoZXkncmUgZmlyc3Qgd3JpdHRlbiB0byBhIE1TQUEgYnVmZmVyLCB3aGVyZSBlYWNoIHNhbXBsZSBmb3IgZWFjaCBwaXhlbCBpcyBzdG9yZWRcbiAgICAgKiBpbmRlcGVuZGVudGx5LiBJbiBvcmRlciB0byByZWFkIHRoZSByZXN1bHRzLCB5b3UgZmlyc3QgbmVlZCB0byAncmVzb2x2ZScgdGhlIGJ1ZmZlciAtIHRvXG4gICAgICogYXZlcmFnZSBhbGwgc2FtcGxlcyBhbmQgY3JlYXRlIGEgc2ltcGxlIHRleHR1cmUgd2l0aCBvbmUgY29sb3IgcGVyIHBpeGVsLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogcGVyZm9ybXMgdGhpcyBhdmVyYWdpbmcgYW5kIHVwZGF0ZXMgdGhlIGNvbG9yQnVmZmVyIGFuZCB0aGUgZGVwdGhCdWZmZXIuIElmIGF1dG9SZXNvbHZlIGlzXG4gICAgICogc2V0IHRvIHRydWUsIHRoZSByZXNvbHZlIHdpbGwgaGFwcGVuIGFmdGVyIGV2ZXJ5IHJlbmRlcmluZyB0byB0aGlzIHJlbmRlciB0YXJnZXQsIG90aGVyd2lzZVxuICAgICAqIHlvdSBjYW4gZG8gaXQgbWFudWFsbHksIGR1cmluZyB0aGUgYXBwIHVwZGF0ZSBvciBpbnNpZGUgYSB7QGxpbmsgQ29tbWFuZH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBSZXNvbHZlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBSZXNvbHZlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZSBpZiB0aGUgcmVuZGVyIHRhcmdldCBoYXMgYVxuICAgICAqIGRlcHRoIGJ1ZmZlci5cbiAgICAgKi9cbiAgICByZXNvbHZlKGNvbG9yID0gdHJ1ZSwgZGVwdGggPSAhIXRoaXMuX2RlcHRoQnVmZmVyKSB7XG5cbiAgICAgICAgLy8gVE9ETzogY29uc2lkZXIgYWRkaW5nIHN1cHBvcnQgZm9yIE1SVCB0byB0aGlzIGZ1bmN0aW9uLlxuXG4gICAgICAgIGlmICh0aGlzLl9kZXZpY2UgJiYgdGhpcy5fc2FtcGxlcyA+IDEpIHtcbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLl9kZXZpY2UsIGBSRVNPTFZFLVJUOiR7dGhpcy5uYW1lfWApO1xuICAgICAgICAgICAgdGhpcy5pbXBsLnJlc29sdmUodGhpcy5fZGV2aWNlLCB0aGlzLCBjb2xvciwgZGVwdGgpO1xuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5fZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBjb2xvciBhbmQvb3IgZGVwdGggY29udGVudHMgb2Ygc291cmNlIHJlbmRlciB0YXJnZXQgdG8gdGhpcyBvbmUuIEZvcm1hdHMsIHNpemVzIGFuZFxuICAgICAqIGFudGktYWxpYXNpbmcgc2FtcGxlcyBtdXN0IG1hdGNoLiBEZXB0aCBidWZmZXIgY2FuIG9ubHkgYmUgY29waWVkIG9uIFdlYkdMIDIuMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBzb3VyY2UgLSBTb3VyY2UgcmVuZGVyIHRhcmdldCB0byBjb3B5IGZyb20uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSwgY29sb3IsIGRlcHRoKSB7XG5cbiAgICAgICAgLy8gVE9ETzogY29uc2lkZXIgYWRkaW5nIHN1cHBvcnQgZm9yIE1SVCB0byB0aGlzIGZ1bmN0aW9uLlxuXG4gICAgICAgIGlmICghdGhpcy5fZGV2aWNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLl9kZXZpY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2UgPSBzb3VyY2UuX2RldmljZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJSZW5kZXIgdGFyZ2V0cyBhcmUgbm90IGluaXRpYWxpemVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLl9kZXZpY2UsIGBDT1BZLVJUOiR7c291cmNlLm5hbWV9LT4ke3RoaXMubmFtZX1gKTtcbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IHRoaXMuX2RldmljZS5jb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgdGhpcywgY29sb3IsIGRlcHRoKTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5fZGV2aWNlKTtcblxuICAgICAgICByZXR1cm4gc3VjY2VzcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBOdW1iZXIgb2YgYW50aWFsaWFzaW5nIHNhbXBsZXMgdGhlIHJlbmRlciB0YXJnZXQgdXNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHNhbXBsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zYW1wbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciB0YXJnZXQgY29udGFpbnMgdGhlIGRlcHRoIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHRoZSBzdGVuY2lsIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3RlbmNpbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0ZW5jaWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29sb3IgYnVmZmVyIHNldCB1cCBvbiB0aGUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgZ2V0IGNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWNjZXNzb3IgZm9yIG11bHRpcGxlIHJlbmRlciB0YXJnZXQgY29sb3IgYnVmZmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gaW5kZXggLSBJbmRleCBvZiB0aGUgY29sb3IgYnVmZmVyIHRvIGdldC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlfSAtIENvbG9yIGJ1ZmZlciBhdCB0aGUgc3BlY2lmaWVkIGluZGV4LlxuICAgICAqL1xuICAgIGdldENvbG9yQnVmZmVyKGluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvckJ1ZmZlcnM/LltpbmRleF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVwdGggYnVmZmVyIHNldCB1cCBvbiB0aGUgcmVuZGVyIHRhcmdldC4gT25seSBhdmFpbGFibGUsIGlmIGRlcHRoQnVmZmVyIHdhcyBzZXQgaW5cbiAgICAgKiBjb25zdHJ1Y3Rvci4gTm90IGF2YWlsYWJsZSBpZiBkZXB0aCBwcm9wZXJ0eSB3YXMgdXNlZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgcmVuZGVyIHRhcmdldCBpcyBib3VuZCB0byBhIGN1YmVtYXAsIHRoaXMgcHJvcGVydHkgc3BlY2lmaWVzIHdoaWNoIGZhY2Ugb2YgdGhlXG4gICAgICogY3ViZW1hcCBpcyByZW5kZXJlZCB0by4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfUE9TWH1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9ORUdYfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX1BPU1l9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfTkVHWX1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9QT1NafVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX05FR1p9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBmYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmFjZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgcmVuZGVyIHRhcmdldCBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yQnVmZmVyPy53aWR0aCB8fCB0aGlzLl9kZXB0aEJ1ZmZlcj8ud2lkdGggfHwgdGhpcy5fZGV2aWNlLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgcmVuZGVyIHRhcmdldCBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvckJ1ZmZlcj8uaGVpZ2h0IHx8IHRoaXMuX2RlcHRoQnVmZmVyPy5oZWlnaHQgfHwgdGhpcy5fZGV2aWNlLmhlaWdodDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlbmRlclRhcmdldCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiUmVuZGVyVGFyZ2V0IiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX29wdGlvbnMkZmFjZSIsIl90aGlzJF9jb2xvckJ1ZmZlciIsIl90aGlzJF9kZXB0aEJ1ZmZlciIsIl9vcHRpb25zJHNhbXBsZXMiLCJfb3B0aW9ucyRhdXRvUmVzb2x2ZSIsIl9vcHRpb25zJGZsaXBZIiwiX3RoaXMkX2NvbG9yQnVmZmVycyIsIm5hbWUiLCJfZGV2aWNlIiwiX2NvbG9yQnVmZmVyIiwiX2NvbG9yQnVmZmVycyIsIl9kZXB0aEJ1ZmZlciIsIl9kZXB0aCIsIl9zdGVuY2lsIiwiX3NhbXBsZXMiLCJhdXRvUmVzb2x2ZSIsIl9mYWNlIiwiZmxpcFkiLCJfYXJnMiIsImFyZ3VtZW50cyIsIl9hcmczIiwiR3JhcGhpY3NEZXZpY2UiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJjb2xvckJ1ZmZlciIsImRlcHRoQnVmZmVyIiwiZmFjZSIsImZvcm1hdCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIndhcm4iLCJfb3B0aW9ucyRkZXB0aCIsIl9vcHRpb25zJHN0ZW5jaWwiLCJkZXB0aCIsInN0ZW5jaWwiLCJjb2xvckJ1ZmZlcnMiLCJhc3NlcnQiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImNhbGwiLCJsZW5ndGgiLCJzdXBwb3J0c01ydCIsIm1heFNhbXBsZXMiLCJNYXRoIiwibWluIiwic2FtcGxlcyIsImlzV2ViR1BVIiwiX3RoaXMkX2NvbG9yQnVmZmVyMiIsIl90aGlzJF9kZXB0aEJ1ZmZlcjIiLCJ2YWxpZGF0ZU1ydCIsImltcGwiLCJjcmVhdGVSZW5kZXJUYXJnZXRJbXBsIiwidHJhY2UiLCJUUkFDRUlEX1JFTkRFUl9UQVJHRVRfQUxMT0MiLCJ3aWR0aCIsImhlaWdodCIsImRlc3Ryb3kiLCJ0YXJnZXRzIiwiZGVsZXRlIiwicmVuZGVyVGFyZ2V0Iiwic2V0UmVuZGVyVGFyZ2V0IiwiZGVzdHJveUZyYW1lQnVmZmVycyIsImRlc3Ryb3lUZXh0dXJlQnVmZmVycyIsIl90aGlzJF9kZXB0aEJ1ZmZlcjMiLCJfdGhpcyRfY29sb3JCdWZmZXJzMiIsImZvckVhY2giLCJyZXNpemUiLCJfdGhpcyRfZGVwdGhCdWZmZXI0IiwiX3RoaXMkX2NvbG9yQnVmZmVyczMiLCJjdWJlbWFwIiwidm9sdW1lIiwiaSIsImluaXQiLCJpbml0aWFsaXplZCIsImxvc2VDb250ZXh0IiwicmVzb2x2ZSIsImNvbG9yIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwb3BHcHVNYXJrZXIiLCJjb3B5Iiwic291cmNlIiwiZXJyb3IiLCJzdWNjZXNzIiwiY29weVJlbmRlclRhcmdldCIsImdldENvbG9yQnVmZmVyIiwiaW5kZXgiLCJfdGhpcyRfY29sb3JCdWZmZXJzNCIsIl90aGlzJF9jb2xvckJ1ZmZlcjMiLCJfdGhpcyRfZGVwdGhCdWZmZXI1IiwiX3RoaXMkX2NvbG9yQnVmZmVyNCIsIl90aGlzJF9kZXB0aEJ1ZmZlcjYiXSwibWFwcGluZ3MiOiI7Ozs7OztBQU1BLElBQUlBLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFlBQVksQ0FBQztBQThEZjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUFBLElBQUEsSUFBQUMsYUFBQSxFQUFBQyxrQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxnQkFBQSxFQUFBQyxvQkFBQSxFQUFBQyxjQUFBLEVBQUFDLG1CQUFBLENBQUE7QUF0SDFCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsSUFBSSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUo7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVA7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElB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
