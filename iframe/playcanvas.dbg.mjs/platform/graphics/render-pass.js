import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { Color } from '../../core/math/color.js';
import { TRACEID_RENDER_PASS, TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { DebugGraphics } from './debug-graphics.js';

class ColorAttachmentOps {
  constructor() {
    /**
     * A color used to clear the color attachment when the clear is enabled.
     */
    this.clearValue = new Color(0, 0, 0, 1);
    /**
     * True if the attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    this.clear = false;
    /**
     * True if the attachment needs to be stored after the render pass. False
     * if it can be discarded.
     * Note: This relates to the surface that is getting rendered to, and can be either
     * single or multi-sampled. Further, if a multi-sampled surface is used, the resolve
     * flag further specifies if this gets resolved to a single-sampled surface. This
     * behavior matches the WebGPU specification.
     *
     * @type {boolean}
     */
    this.store = false;
    /**
     * True if the attachment needs to be resolved.
     *
     * @type {boolean}
     */
    this.resolve = true;
    /**
     * True if the attachment needs to have mipmaps generated.
     *
     * @type {boolean}
     */
    this.mipmaps = false;
  }
}
class DepthStencilAttachmentOps {
  constructor() {
    /**
     * A depth value used to clear the depth attachment when the clear is enabled.
     */
    this.clearDepthValue = 1;
    /**
     * A stencil value used to clear the stencil attachment when the clear is enabled.
     */
    this.clearStencilValue = 0;
    /**
     * True if the depth attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    this.clearDepth = false;
    /**
     * True if the stencil attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    this.clearStencil = false;
    /**
     * True if the depth attachment needs to be stored after the render pass. False
     * if it can be discarded.
     *
     * @type {boolean}
     */
    this.storeDepth = false;
    /**
     * True if the stencil attachment needs to be stored after the render pass. False
     * if it can be discarded.
     *
     * @type {boolean}
     */
    this.storeStencil = false;
  }
}

/**
 * A render pass represents a node in the frame graph, and encapsulates a system which
 * renders to a render target using an execution callback.
 *
 * @ignore
 */
class RenderPass {
  /**
   * Color attachment operations for the first color attachment.
   *
   * @type {ColorAttachmentOps}
   */
  get colorOps() {
    return this.colorArrayOps[0];
  }

  /** @type {DepthStencilAttachmentOps} */

  /**
   * Creates an instance of the RenderPass.
   *
   * @param {import('../graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device.
   */
  constructor(graphicsDevice) {
    /** @type {string} */
    this._name = void 0;
    /**
     * The graphics device.
     *
     * @type {import('../graphics/graphics-device.js').GraphicsDevice}
     */
    this.device = void 0;
    /**
     * True if the render pass is enabled.
     *
     * @type {boolean}
     * @private
     */
    this._enabled = true;
    /**
     * True if the render pass is enabled and execute function will be called. Note that before and
     * after functions are called regardless of this flag.
     */
    this.executeEnabled = true;
    /**
     * The render target for this render pass:
     *  - `undefined`: render pass does not render to any render target
     *  - `null`: render pass renders to the backbuffer
     *  - Otherwise, renders to the provided RT.
     * @type {import('../graphics/render-target.js').RenderTarget|null|undefined}
     */
    this.renderTarget = void 0;
    /**
     * The options specified when the render target was initialized.
     */
    this._options = void 0;
    /**
     * Number of samples. 0 if no render target, otherwise number of samples from the render target,
     * or the main framebuffer if render target is null.
     *
     * @type {number}
     */
    this.samples = 0;
    /**
     * Array of color attachment operations. The first element corresponds to the color attachment
     * 0, and so on.
     *
     * @type {Array<ColorAttachmentOps>}
     */
    this.colorArrayOps = [];
    this.depthStencilOps = void 0;
    /**
     * If true, this pass might use dynamically rendered cubemaps. Use for a case where rendering to cubemap
     * faces is interleaved with rendering to shadows, to avoid generating cubemap mipmaps. This will likely
     * be retired when render target dependency tracking gets implemented.
     *
     * @type {boolean}
     */
    this.requiresCubemaps = true;
    /**
     * True if the render pass uses the full viewport / scissor for rendering into the render target.
     *
     * @type {boolean}
     */
    this.fullSizeClearRect = true;
    /**
     * Render passes which need to be executed before this pass.
     *
     * @type {RenderPass[]}
     */
    this.beforePasses = [];
    /**
     * Render passes which need to be executed after this pass.
     *
     * @type {RenderPass[]}
     */
    this.afterPasses = [];
    Debug.assert(graphicsDevice);
    this.device = graphicsDevice;
  }
  set name(value) {
    this._name = value;
  }
  get name() {
    if (!this._name) this._name = this.constructor.name;
    return this._name;
  }
  set options(value) {
    this._options = value;

    // sanitize options
    if (value) {
      var _this$_options$scaleX, _this$_options$scaleY;
      this._options.scaleX = (_this$_options$scaleX = this._options.scaleX) != null ? _this$_options$scaleX : 1;
      this._options.scaleY = (_this$_options$scaleY = this._options.scaleY) != null ? _this$_options$scaleY : 1;
    }
  }
  get options() {
    return this._options;
  }

  /**
   * @param {import('../graphics/render-target.js').RenderTarget|null} [renderTarget] - The render
   * target to render into (output). This function should be called only for render passes which
   * use render target, or passes which render directly into the default framebuffer, in which
   * case a null or undefined render target is expected.
   */
  init(renderTarget = null, options = null) {
    var _renderTarget$_colorB;
    this.options = options;

    // null represents the default framebuffer
    this.renderTarget = renderTarget;

    // defaults depend on multisampling
    this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

    // allocate ops only when render target is used
    this.depthStencilOps = new DepthStencilAttachmentOps();
    const numColorOps = renderTarget ? (_renderTarget$_colorB = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB.length : 1;
    this.colorArrayOps.length = 0;
    for (let i = 0; i < numColorOps; i++) {
      var _this$renderTarget;
      const colorOps = new ColorAttachmentOps();
      this.colorArrayOps[i] = colorOps;

      // if rendering to single-sampled buffer, this buffer needs to be stored
      if (this.samples === 1) {
        colorOps.store = true;
        colorOps.resolve = false;
      }

      // if render target needs mipmaps
      if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget = _this$renderTarget._colorBuffers) != null && _this$renderTarget[i].mipmaps) {
        colorOps.mipmaps = true;
      }
    }
    this.postInit();
  }
  destroy() {}
  postInit() {}
  frameUpdate() {
    // resize the render target if needed
    if (this._options && this.renderTarget) {
      var _this$_options$resize;
      const resizeSource = (_this$_options$resize = this._options.resizeSource) != null ? _this$_options$resize : this.device.backBuffer;
      const width = Math.floor(resizeSource.width * this._options.scaleX);
      const height = Math.floor(resizeSource.height * this._options.scaleY);
      this.renderTarget.resize(width, height);
    }
  }
  before() {}
  execute() {}
  after() {}
  onEnable() {}
  onDisable() {}
  set enabled(value) {
    if (this._enabled !== value) {
      this._enabled = value;
      if (value) {
        this.onEnable();
      } else {
        this.onDisable();
      }
    }
  }
  get enabled() {
    return this._enabled;
  }

  /**
   * Mark render pass as clearing the full color buffer.
   *
   * @param {Color|undefined} color - The color to clear to, or undefined to preserve the existing
   * content.
   */
  setClearColor(color) {
    // in case of MRT, we clear all color buffers.
    // TODO: expose per color buffer clear parameters on the camera, and copy them here.
    const count = this.colorArrayOps.length;
    for (let i = 0; i < count; i++) {
      const colorOps = this.colorArrayOps[i];
      if (color) colorOps.clearValue.copy(color);
      colorOps.clear = !!color;
    }
  }

  /**
   * Mark render pass as clearing the full depth buffer.
   *
   * @param {number|undefined} depthValue - The depth value to clear to, or undefined to preserve
   * the existing content.
   */
  setClearDepth(depthValue) {
    if (depthValue) this.depthStencilOps.clearDepthValue = depthValue;
    this.depthStencilOps.clearDepth = depthValue !== undefined;
  }

  /**
   * Mark render pass as clearing the full stencil buffer.
   *
   * @param {number|undefined} stencilValue - The stencil value to clear to, or undefined to preserve the
   * existing content.
   */
  setClearStencil(stencilValue) {
    if (stencilValue) this.depthStencilOps.clearStencilValue = stencilValue;
    this.depthStencilOps.clearStencil = stencilValue !== undefined;
  }

  /**
   * Render the render pass
   */
  render() {
    if (this.enabled) {
      const device = this.device;
      const realPass = this.renderTarget !== undefined;
      DebugGraphics.pushGpuMarker(device, `Pass:${this.name}`);
      Debug.call(() => {
        this.log(device, device.renderPassIndex);
      });
      this.before();
      if (this.executeEnabled) {
        if (realPass) {
          device.startRenderPass(this);
        }
        this.execute();
        if (realPass) {
          device.endRenderPass(this);
        }
      }
      this.after();
      device.renderPassIndex++;
      DebugGraphics.popGpuMarker(device);
    }
  }
  log(device, index) {
    if (Tracing.get(TRACEID_RENDER_PASS) || Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {
      var _this$renderTarget2, _rt$_colorBuffers$len, _rt$_colorBuffers;
      const rt = (_this$renderTarget2 = this.renderTarget) != null ? _this$renderTarget2 : this.renderTarget === null ? device.backBuffer : null;
      const isBackBuffer = !!(rt != null && rt.impl.assignedColorTexture) || (rt == null ? void 0 : rt.impl.suppliedColorFramebuffer) !== undefined;
      const numColor = (_rt$_colorBuffers$len = rt == null || (_rt$_colorBuffers = rt._colorBuffers) == null ? void 0 : _rt$_colorBuffers.length) != null ? _rt$_colorBuffers$len : isBackBuffer ? 1 : 0;
      const hasDepth = rt == null ? void 0 : rt.depth;
      const hasStencil = rt == null ? void 0 : rt.stencil;
      const rtInfo = !rt ? '' : ` RT: ${rt ? rt.name : 'NULL'} ` + `${numColor > 0 ? `[Color${numColor > 1 ? ` x ${numColor}` : ''}]` : ''}` + `${hasDepth ? '[Depth]' : ''}` + `${hasStencil ? '[Stencil]' : ''}` + ` ${rt.width} x ${rt.height}` + `${this.samples > 0 ? ' samples: ' + this.samples : ''}`;
      Debug.trace(TRACEID_RENDER_PASS, `${index.toString().padEnd(2, ' ')}: ${this.name.padEnd(20, ' ')}` + `${this.executeEnabled ? '' : ' DISABLED '}` + rtInfo.padEnd(30));
      for (let i = 0; i < numColor; i++) {
        const colorOps = this.colorArrayOps[i];
        Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    color[${i}]: ` + `${colorOps.clear ? 'clear' : 'load'}->` + `${colorOps.store ? 'store' : 'discard'} ` + `${colorOps.resolve ? 'resolve ' : ''}` + `${colorOps.mipmaps ? 'mipmaps ' : ''}`);
      }
      if (this.depthStencilOps) {
        if (hasDepth) {
          Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    depthOps: ` + `${this.depthStencilOps.clearDepth ? 'clear' : 'load'}->` + `${this.depthStencilOps.storeDepth ? 'store' : 'discard'}`);
        }
        if (hasStencil) {
          Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    stencOps: ` + `${this.depthStencilOps.clearStencil ? 'clear' : 'load'}->` + `${this.depthStencilOps.storeStencil ? 'store' : 'discard'}`);
        }
      }
    }
  }
}

export { ColorAttachmentOps, DepthStencilAttachmentOps, RenderPass };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItcGFzcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9QQVNTLCBUUkFDRUlEX1JFTkRFUl9QQVNTX0RFVEFJTCB9IGZyb20gJy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmNsYXNzIENvbG9yQXR0YWNobWVudE9wcyB7XG4gICAgLyoqXG4gICAgICogQSBjb2xvciB1c2VkIHRvIGNsZWFyIHRoZSBjb2xvciBhdHRhY2htZW50IHdoZW4gdGhlIGNsZWFyIGlzIGVuYWJsZWQuXG4gICAgICovXG4gICAgY2xlYXJWYWx1ZSA9IG5ldyBDb2xvcigwLCAwLCAwLCAxKTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGF0dGFjaG1lbnQgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJlbmRlcmluZywgZmFsc2UgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBjbGVhciA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYXR0YWNobWVudCBuZWVkcyB0byBiZSBzdG9yZWQgYWZ0ZXIgdGhlIHJlbmRlciBwYXNzLiBGYWxzZVxuICAgICAqIGlmIGl0IGNhbiBiZSBkaXNjYXJkZWQuXG4gICAgICogTm90ZTogVGhpcyByZWxhdGVzIHRvIHRoZSBzdXJmYWNlIHRoYXQgaXMgZ2V0dGluZyByZW5kZXJlZCB0bywgYW5kIGNhbiBiZSBlaXRoZXJcbiAgICAgKiBzaW5nbGUgb3IgbXVsdGktc2FtcGxlZC4gRnVydGhlciwgaWYgYSBtdWx0aS1zYW1wbGVkIHN1cmZhY2UgaXMgdXNlZCwgdGhlIHJlc29sdmVcbiAgICAgKiBmbGFnIGZ1cnRoZXIgc3BlY2lmaWVzIGlmIHRoaXMgZ2V0cyByZXNvbHZlZCB0byBhIHNpbmdsZS1zYW1wbGVkIHN1cmZhY2UuIFRoaXNcbiAgICAgKiBiZWhhdmlvciBtYXRjaGVzIHRoZSBXZWJHUFUgc3BlY2lmaWNhdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN0b3JlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBhdHRhY2htZW50IG5lZWRzIHRvIGJlIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgcmVzb2x2ZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBhdHRhY2htZW50IG5lZWRzIHRvIGhhdmUgbWlwbWFwcyBnZW5lcmF0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBtaXBtYXBzID0gZmFsc2U7XG59XG5cbmNsYXNzIERlcHRoU3RlbmNpbEF0dGFjaG1lbnRPcHMge1xuICAgIC8qKlxuICAgICAqIEEgZGVwdGggdmFsdWUgdXNlZCB0byBjbGVhciB0aGUgZGVwdGggYXR0YWNobWVudCB3aGVuIHRoZSBjbGVhciBpcyBlbmFibGVkLlxuICAgICAqL1xuICAgIGNsZWFyRGVwdGhWYWx1ZSA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBBIHN0ZW5jaWwgdmFsdWUgdXNlZCB0byBjbGVhciB0aGUgc3RlbmNpbCBhdHRhY2htZW50IHdoZW4gdGhlIGNsZWFyIGlzIGVuYWJsZWQuXG4gICAgICovXG4gICAgY2xlYXJTdGVuY2lsVmFsdWUgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgZGVwdGggYXR0YWNobWVudCBzaG91bGQgYmUgY2xlYXJlZCBiZWZvcmUgcmVuZGVyaW5nLCBmYWxzZSB0byBwcmVzZXJ2ZVxuICAgICAqIHRoZSBleGlzdGluZyBjb250ZW50LlxuICAgICAqL1xuICAgIGNsZWFyRGVwdGggPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHN0ZW5jaWwgYXR0YWNobWVudCBzaG91bGQgYmUgY2xlYXJlZCBiZWZvcmUgcmVuZGVyaW5nLCBmYWxzZSB0byBwcmVzZXJ2ZVxuICAgICAqIHRoZSBleGlzdGluZyBjb250ZW50LlxuICAgICAqL1xuICAgIGNsZWFyU3RlbmNpbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgZGVwdGggYXR0YWNobWVudCBuZWVkcyB0byBiZSBzdG9yZWQgYWZ0ZXIgdGhlIHJlbmRlciBwYXNzLiBGYWxzZVxuICAgICAqIGlmIGl0IGNhbiBiZSBkaXNjYXJkZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdG9yZURlcHRoID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBzdGVuY2lsIGF0dGFjaG1lbnQgbmVlZHMgdG8gYmUgc3RvcmVkIGFmdGVyIHRoZSByZW5kZXIgcGFzcy4gRmFsc2VcbiAgICAgKiBpZiBpdCBjYW4gYmUgZGlzY2FyZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3RvcmVTdGVuY2lsID0gZmFsc2U7XG59XG5cbi8qKlxuICogQSByZW5kZXIgcGFzcyByZXByZXNlbnRzIGEgbm9kZSBpbiB0aGUgZnJhbWUgZ3JhcGgsIGFuZCBlbmNhcHN1bGF0ZXMgYSBzeXN0ZW0gd2hpY2hcbiAqIHJlbmRlcnMgdG8gYSByZW5kZXIgdGFyZ2V0IHVzaW5nIGFuIGV4ZWN1dGlvbiBjYWxsYmFjay5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFJlbmRlclBhc3Mge1xuICAgIC8qKiBAdHlwZSB7c3RyaW5nfSAqL1xuICAgIF9uYW1lO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAqL1xuICAgIGRldmljZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciBwYXNzIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciBwYXNzIGlzIGVuYWJsZWQgYW5kIGV4ZWN1dGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQuIE5vdGUgdGhhdCBiZWZvcmUgYW5kXG4gICAgICogYWZ0ZXIgZnVuY3Rpb25zIGFyZSBjYWxsZWQgcmVnYXJkbGVzcyBvZiB0aGlzIGZsYWcuXG4gICAgICovXG4gICAgZXhlY3V0ZUVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciB0YXJnZXQgZm9yIHRoaXMgcmVuZGVyIHBhc3M6XG4gICAgICogIC0gYHVuZGVmaW5lZGA6IHJlbmRlciBwYXNzIGRvZXMgbm90IHJlbmRlciB0byBhbnkgcmVuZGVyIHRhcmdldFxuICAgICAqICAtIGBudWxsYDogcmVuZGVyIHBhc3MgcmVuZGVycyB0byB0aGUgYmFja2J1ZmZlclxuICAgICAqICAtIE90aGVyd2lzZSwgcmVuZGVycyB0byB0aGUgcHJvdmlkZWQgUlQuXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldHxudWxsfHVuZGVmaW5lZH1cbiAgICAgKi9cbiAgICByZW5kZXJUYXJnZXQ7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb3B0aW9ucyBzcGVjaWZpZWQgd2hlbiB0aGUgcmVuZGVyIHRhcmdldCB3YXMgaW5pdGlhbGl6ZWQuXG4gICAgICovXG4gICAgX29wdGlvbnM7XG5cbiAgICAvKipcbiAgICAgKiBOdW1iZXIgb2Ygc2FtcGxlcy4gMCBpZiBubyByZW5kZXIgdGFyZ2V0LCBvdGhlcndpc2UgbnVtYmVyIG9mIHNhbXBsZXMgZnJvbSB0aGUgcmVuZGVyIHRhcmdldCxcbiAgICAgKiBvciB0aGUgbWFpbiBmcmFtZWJ1ZmZlciBpZiByZW5kZXIgdGFyZ2V0IGlzIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNhbXBsZXMgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgY29sb3IgYXR0YWNobWVudCBvcGVyYXRpb25zLiBUaGUgZmlyc3QgZWxlbWVudCBjb3JyZXNwb25kcyB0byB0aGUgY29sb3IgYXR0YWNobWVudFxuICAgICAqIDAsIGFuZCBzbyBvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxDb2xvckF0dGFjaG1lbnRPcHM+fVxuICAgICAqL1xuICAgIGNvbG9yQXJyYXlPcHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENvbG9yIGF0dGFjaG1lbnQgb3BlcmF0aW9ucyBmb3IgdGhlIGZpcnN0IGNvbG9yIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q29sb3JBdHRhY2htZW50T3BzfVxuICAgICAqL1xuICAgIGdldCBjb2xvck9wcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sb3JBcnJheU9wc1swXTtcbiAgICB9XG5cbiAgICAvKiogQHR5cGUge0RlcHRoU3RlbmNpbEF0dGFjaG1lbnRPcHN9ICovXG4gICAgZGVwdGhTdGVuY2lsT3BzO1xuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBwYXNzIG1pZ2h0IHVzZSBkeW5hbWljYWxseSByZW5kZXJlZCBjdWJlbWFwcy4gVXNlIGZvciBhIGNhc2Ugd2hlcmUgcmVuZGVyaW5nIHRvIGN1YmVtYXBcbiAgICAgKiBmYWNlcyBpcyBpbnRlcmxlYXZlZCB3aXRoIHJlbmRlcmluZyB0byBzaGFkb3dzLCB0byBhdm9pZCBnZW5lcmF0aW5nIGN1YmVtYXAgbWlwbWFwcy4gVGhpcyB3aWxsIGxpa2VseVxuICAgICAqIGJlIHJldGlyZWQgd2hlbiByZW5kZXIgdGFyZ2V0IGRlcGVuZGVuY3kgdHJhY2tpbmcgZ2V0cyBpbXBsZW1lbnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHJlcXVpcmVzQ3ViZW1hcHMgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgcmVuZGVyIHBhc3MgdXNlcyB0aGUgZnVsbCB2aWV3cG9ydCAvIHNjaXNzb3IgZm9yIHJlbmRlcmluZyBpbnRvIHRoZSByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVsbFNpemVDbGVhclJlY3QgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3NlcyB3aGljaCBuZWVkIHRvIGJlIGV4ZWN1dGVkIGJlZm9yZSB0aGlzIHBhc3MuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UmVuZGVyUGFzc1tdfVxuICAgICAqL1xuICAgIGJlZm9yZVBhc3NlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3NlcyB3aGljaCBuZWVkIHRvIGJlIGV4ZWN1dGVkIGFmdGVyIHRoaXMgcGFzcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtSZW5kZXJQYXNzW119XG4gICAgICovXG4gICAgYWZ0ZXJQYXNzZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgdGhlIFJlbmRlclBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIERlYnVnLmFzc2VydChncmFwaGljc0RldmljZSk7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgfVxuXG4gICAgc2V0IG5hbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbmFtZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBuYW1lKCkge1xuICAgICAgICBpZiAoIXRoaXMuX25hbWUpXG4gICAgICAgICAgICB0aGlzLl9uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgICB9XG5cbiAgICBzZXQgb3B0aW9ucyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9vcHRpb25zID0gdmFsdWU7XG5cbiAgICAgICAgLy8gc2FuaXRpemUgb3B0aW9uc1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX29wdGlvbnMuc2NhbGVYID0gdGhpcy5fb3B0aW9ucy5zY2FsZVggPz8gMTtcbiAgICAgICAgICAgIHRoaXMuX29wdGlvbnMuc2NhbGVZID0gdGhpcy5fb3B0aW9ucy5zY2FsZVkgPz8gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3B0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldHxudWxsfSBbcmVuZGVyVGFyZ2V0XSAtIFRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgdG8gcmVuZGVyIGludG8gKG91dHB1dCkuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBvbmx5IGZvciByZW5kZXIgcGFzc2VzIHdoaWNoXG4gICAgICogdXNlIHJlbmRlciB0YXJnZXQsIG9yIHBhc3NlcyB3aGljaCByZW5kZXIgZGlyZWN0bHkgaW50byB0aGUgZGVmYXVsdCBmcmFtZWJ1ZmZlciwgaW4gd2hpY2hcbiAgICAgKiBjYXNlIGEgbnVsbCBvciB1bmRlZmluZWQgcmVuZGVyIHRhcmdldCBpcyBleHBlY3RlZC5cbiAgICAgKi9cbiAgICBpbml0KHJlbmRlclRhcmdldCA9IG51bGwsIG9wdGlvbnMgPSBudWxsKSB7XG5cbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgICAgICAvLyBudWxsIHJlcHJlc2VudHMgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXJcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gZGVmYXVsdHMgZGVwZW5kIG9uIG11bHRpc2FtcGxpbmdcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gTWF0aC5tYXgodGhpcy5yZW5kZXJUYXJnZXQgPyB0aGlzLnJlbmRlclRhcmdldC5zYW1wbGVzIDogdGhpcy5kZXZpY2Uuc2FtcGxlcywgMSk7XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgb3BzIG9ubHkgd2hlbiByZW5kZXIgdGFyZ2V0IGlzIHVzZWRcbiAgICAgICAgdGhpcy5kZXB0aFN0ZW5jaWxPcHMgPSBuZXcgRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcygpO1xuXG4gICAgICAgIGNvbnN0IG51bUNvbG9yT3BzID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlcnM/Lmxlbmd0aCA6IDE7XG5cbiAgICAgICAgdGhpcy5jb2xvckFycmF5T3BzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQ29sb3JPcHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSBuZXcgQ29sb3JBdHRhY2htZW50T3BzKCk7XG4gICAgICAgICAgICB0aGlzLmNvbG9yQXJyYXlPcHNbaV0gPSBjb2xvck9wcztcblxuICAgICAgICAgICAgLy8gaWYgcmVuZGVyaW5nIHRvIHNpbmdsZS1zYW1wbGVkIGJ1ZmZlciwgdGhpcyBidWZmZXIgbmVlZHMgdG8gYmUgc3RvcmVkXG4gICAgICAgICAgICBpZiAodGhpcy5zYW1wbGVzID09PSAxKSB7XG4gICAgICAgICAgICAgICAgY29sb3JPcHMuc3RvcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbG9yT3BzLnJlc29sdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgcmVuZGVyIHRhcmdldCBuZWVkcyBtaXBtYXBzXG4gICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQ/Ll9jb2xvckJ1ZmZlcnM/LltpXS5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgY29sb3JPcHMubWlwbWFwcyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICB9XG5cbiAgICBwb3N0SW5pdCgpIHtcbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgLy8gcmVzaXplIHRoZSByZW5kZXIgdGFyZ2V0IGlmIG5lZWRlZFxuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucyAmJiB0aGlzLnJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgY29uc3QgcmVzaXplU291cmNlID0gdGhpcy5fb3B0aW9ucy5yZXNpemVTb3VyY2UgPz8gdGhpcy5kZXZpY2UuYmFja0J1ZmZlcjtcbiAgICAgICAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5mbG9vcihyZXNpemVTb3VyY2Uud2lkdGggKiB0aGlzLl9vcHRpb25zLnNjYWxlWCk7XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLmZsb29yKHJlc2l6ZVNvdXJjZS5oZWlnaHQgKiB0aGlzLl9vcHRpb25zLnNjYWxlWSk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldC5yZXNpemUod2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBiZWZvcmUoKSB7XG4gICAgfVxuXG4gICAgZXhlY3V0ZSgpIHtcbiAgICB9XG5cbiAgICBhZnRlcigpIHtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMub25EaXNhYmxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayByZW5kZXIgcGFzcyBhcyBjbGVhcmluZyB0aGUgZnVsbCBjb2xvciBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NvbG9yfHVuZGVmaW5lZH0gY29sb3IgLSBUaGUgY29sb3IgdG8gY2xlYXIgdG8sIG9yIHVuZGVmaW5lZCB0byBwcmVzZXJ2ZSB0aGUgZXhpc3RpbmdcbiAgICAgKiBjb250ZW50LlxuICAgICAqL1xuICAgIHNldENsZWFyQ29sb3IoY29sb3IpIHtcblxuICAgICAgICAvLyBpbiBjYXNlIG9mIE1SVCwgd2UgY2xlYXIgYWxsIGNvbG9yIGJ1ZmZlcnMuXG4gICAgICAgIC8vIFRPRE86IGV4cG9zZSBwZXIgY29sb3IgYnVmZmVyIGNsZWFyIHBhcmFtZXRlcnMgb24gdGhlIGNhbWVyYSwgYW5kIGNvcHkgdGhlbSBoZXJlLlxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuY29sb3JBcnJheU9wcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSB0aGlzLmNvbG9yQXJyYXlPcHNbaV07XG4gICAgICAgICAgICBpZiAoY29sb3IpXG4gICAgICAgICAgICAgICAgY29sb3JPcHMuY2xlYXJWYWx1ZS5jb3B5KGNvbG9yKTtcbiAgICAgICAgICAgIGNvbG9yT3BzLmNsZWFyID0gISFjb2xvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgcmVuZGVyIHBhc3MgYXMgY2xlYXJpbmcgdGhlIGZ1bGwgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8dW5kZWZpbmVkfSBkZXB0aFZhbHVlIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRvLCBvciB1bmRlZmluZWQgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBzZXRDbGVhckRlcHRoKGRlcHRoVmFsdWUpIHtcbiAgICAgICAgaWYgKGRlcHRoVmFsdWUpXG4gICAgICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWUgPSBkZXB0aFZhbHVlO1xuICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID0gZGVwdGhWYWx1ZSAhPT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgcmVuZGVyIHBhc3MgYXMgY2xlYXJpbmcgdGhlIGZ1bGwgc3RlbmNpbCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnx1bmRlZmluZWR9IHN0ZW5jaWxWYWx1ZSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRvLCBvciB1bmRlZmluZWQgdG8gcHJlc2VydmUgdGhlXG4gICAgICogZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBzZXRDbGVhclN0ZW5jaWwoc3RlbmNpbFZhbHVlKSB7XG4gICAgICAgIGlmIChzdGVuY2lsVmFsdWUpXG4gICAgICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZSA9IHN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgdGhpcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsID0gc3RlbmNpbFZhbHVlICE9PSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSByZW5kZXIgcGFzc1xuICAgICAqL1xuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICAgICAgY29uc3QgcmVhbFBhc3MgPSB0aGlzLnJlbmRlclRhcmdldCAhPT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFBhc3M6JHt0aGlzLm5hbWV9YCk7XG5cbiAgICAgICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nKGRldmljZSwgZGV2aWNlLnJlbmRlclBhc3NJbmRleCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5iZWZvcmUoKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZXhlY3V0ZUVuYWJsZWQpIHtcblxuICAgICAgICAgICAgICAgIGlmIChyZWFsUGFzcykge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc3RhcnRSZW5kZXJQYXNzKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZXhlY3V0ZSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlYWxQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5lbmRSZW5kZXJQYXNzKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5hZnRlcigpO1xuXG4gICAgICAgICAgICBkZXZpY2UucmVuZGVyUGFzc0luZGV4Kys7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgbG9nKGRldmljZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKFRyYWNpbmcuZ2V0KFRSQUNFSURfUkVOREVSX1BBU1MpIHx8IFRyYWNpbmcuZ2V0KFRSQUNFSURfUkVOREVSX1BBU1NfREVUQUlMKSkge1xuXG4gICAgICAgICAgICBjb25zdCBydCA9IHRoaXMucmVuZGVyVGFyZ2V0ID8/ICh0aGlzLnJlbmRlclRhcmdldCA9PT0gbnVsbCA/IGRldmljZS5iYWNrQnVmZmVyIDogbnVsbCk7XG4gICAgICAgICAgICBjb25zdCBpc0JhY2tCdWZmZXIgPSAhIXJ0Py5pbXBsLmFzc2lnbmVkQ29sb3JUZXh0dXJlIHx8IHJ0Py5pbXBsLnN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlciAhPT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgbnVtQ29sb3IgPSBydD8uX2NvbG9yQnVmZmVycz8ubGVuZ3RoID8/IChpc0JhY2tCdWZmZXIgPyAxIDogMCk7XG4gICAgICAgICAgICBjb25zdCBoYXNEZXB0aCA9IHJ0Py5kZXB0aDtcbiAgICAgICAgICAgIGNvbnN0IGhhc1N0ZW5jaWwgPSBydD8uc3RlbmNpbDtcbiAgICAgICAgICAgIGNvbnN0IHJ0SW5mbyA9ICFydCA/ICcnIDogYCBSVDogJHsocnQgPyBydC5uYW1lIDogJ05VTEwnKX0gYCArXG4gICAgICAgICAgICAgICAgYCR7bnVtQ29sb3IgPiAwID8gYFtDb2xvciR7bnVtQ29sb3IgPiAxID8gYCB4ICR7bnVtQ29sb3J9YCA6ICcnfV1gIDogJyd9YCArXG4gICAgICAgICAgICAgICAgYCR7aGFzRGVwdGggPyAnW0RlcHRoXScgOiAnJ31gICtcbiAgICAgICAgICAgICAgICBgJHtoYXNTdGVuY2lsID8gJ1tTdGVuY2lsXScgOiAnJ31gICtcbiAgICAgICAgICAgICAgICBgICR7cnQud2lkdGh9IHggJHtydC5oZWlnaHR9YCArXG4gICAgICAgICAgICAgICAgYCR7KHRoaXMuc2FtcGxlcyA+IDAgPyAnIHNhbXBsZXM6ICcgKyB0aGlzLnNhbXBsZXMgOiAnJyl9YDtcblxuICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfUEFTUyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke2luZGV4LnRvU3RyaW5nKCkucGFkRW5kKDIsICcgJyl9OiAke3RoaXMubmFtZS5wYWRFbmQoMjAsICcgJyl9YCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLmV4ZWN1dGVFbmFibGVkID8gJycgOiAnIERJU0FCTEVEICd9YCArXG4gICAgICAgICAgICAgICAgICAgICAgICBydEluZm8ucGFkRW5kKDMwKSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQ29sb3I7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yT3BzID0gdGhpcy5jb2xvckFycmF5T3BzW2ldO1xuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX1BBU1NfREVUQUlMLCBgICAgIGNvbG9yWyR7aX1dOiBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtjb2xvck9wcy5jbGVhciA/ICdjbGVhcicgOiAnbG9hZCd9LT5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtjb2xvck9wcy5zdG9yZSA/ICdzdG9yZScgOiAnZGlzY2FyZCd9IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke2NvbG9yT3BzLnJlc29sdmUgPyAncmVzb2x2ZSAnIDogJyd9YCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7Y29sb3JPcHMubWlwbWFwcyA/ICdtaXBtYXBzICcgOiAnJ31gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuZGVwdGhTdGVuY2lsT3BzKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoaGFzRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfUEFTU19ERVRBSUwsIGAgICAgZGVwdGhPcHM6IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID8gJ2NsZWFyJyA6ICdsb2FkJ30tPmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID8gJ3N0b3JlJyA6ICdkaXNjYXJkJ31gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaGFzU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9QQVNTX0RFVEFJTCwgYCAgICBzdGVuY09wczogYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke3RoaXMuZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCA/ICdjbGVhcicgOiAnbG9hZCd9LT5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsID8gJ3N0b3JlJyA6ICdkaXNjYXJkJ31gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gI2VuZGlmXG59XG5cbmV4cG9ydCB7IFJlbmRlclBhc3MsIENvbG9yQXR0YWNobWVudE9wcywgRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcyB9O1xuIl0sIm5hbWVzIjpbIkNvbG9yQXR0YWNobWVudE9wcyIsImNvbnN0cnVjdG9yIiwiY2xlYXJWYWx1ZSIsIkNvbG9yIiwiY2xlYXIiLCJzdG9yZSIsInJlc29sdmUiLCJtaXBtYXBzIiwiRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImNsZWFyU3RlbmNpbFZhbHVlIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInN0b3JlRGVwdGgiLCJzdG9yZVN0ZW5jaWwiLCJSZW5kZXJQYXNzIiwiY29sb3JPcHMiLCJjb2xvckFycmF5T3BzIiwiZ3JhcGhpY3NEZXZpY2UiLCJfbmFtZSIsImRldmljZSIsIl9lbmFibGVkIiwiZXhlY3V0ZUVuYWJsZWQiLCJyZW5kZXJUYXJnZXQiLCJfb3B0aW9ucyIsInNhbXBsZXMiLCJkZXB0aFN0ZW5jaWxPcHMiLCJyZXF1aXJlc0N1YmVtYXBzIiwiZnVsbFNpemVDbGVhclJlY3QiLCJiZWZvcmVQYXNzZXMiLCJhZnRlclBhc3NlcyIsIkRlYnVnIiwiYXNzZXJ0IiwibmFtZSIsInZhbHVlIiwib3B0aW9ucyIsIl90aGlzJF9vcHRpb25zJHNjYWxlWCIsIl90aGlzJF9vcHRpb25zJHNjYWxlWSIsInNjYWxlWCIsInNjYWxlWSIsImluaXQiLCJfcmVuZGVyVGFyZ2V0JF9jb2xvckIiLCJNYXRoIiwibWF4IiwibnVtQ29sb3JPcHMiLCJfY29sb3JCdWZmZXJzIiwibGVuZ3RoIiwiaSIsIl90aGlzJHJlbmRlclRhcmdldCIsInBvc3RJbml0IiwiZGVzdHJveSIsImZyYW1lVXBkYXRlIiwiX3RoaXMkX29wdGlvbnMkcmVzaXplIiwicmVzaXplU291cmNlIiwiYmFja0J1ZmZlciIsIndpZHRoIiwiZmxvb3IiLCJoZWlnaHQiLCJyZXNpemUiLCJiZWZvcmUiLCJleGVjdXRlIiwiYWZ0ZXIiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsImVuYWJsZWQiLCJzZXRDbGVhckNvbG9yIiwiY29sb3IiLCJjb3VudCIsImNvcHkiLCJzZXRDbGVhckRlcHRoIiwiZGVwdGhWYWx1ZSIsInVuZGVmaW5lZCIsInNldENsZWFyU3RlbmNpbCIsInN0ZW5jaWxWYWx1ZSIsInJlbmRlciIsInJlYWxQYXNzIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjYWxsIiwibG9nIiwicmVuZGVyUGFzc0luZGV4Iiwic3RhcnRSZW5kZXJQYXNzIiwiZW5kUmVuZGVyUGFzcyIsInBvcEdwdU1hcmtlciIsImluZGV4IiwiVHJhY2luZyIsImdldCIsIlRSQUNFSURfUkVOREVSX1BBU1MiLCJUUkFDRUlEX1JFTkRFUl9QQVNTX0RFVEFJTCIsIl90aGlzJHJlbmRlclRhcmdldDIiLCJfcnQkX2NvbG9yQnVmZmVycyRsZW4iLCJfcnQkX2NvbG9yQnVmZmVycyIsInJ0IiwiaXNCYWNrQnVmZmVyIiwiaW1wbCIsImFzc2lnbmVkQ29sb3JUZXh0dXJlIiwic3VwcGxpZWRDb2xvckZyYW1lYnVmZmVyIiwibnVtQ29sb3IiLCJoYXNEZXB0aCIsImRlcHRoIiwiaGFzU3RlbmNpbCIsInN0ZW5jaWwiLCJydEluZm8iLCJ0cmFjZSIsInRvU3RyaW5nIiwicGFkRW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFNQSxNQUFNQSxrQkFBa0IsQ0FBQztFQUFBQyxXQUFBLEdBQUE7QUFDckI7QUFDSjtBQUNBO0FBRkksSUFBQSxJQUFBLENBR0FDLFVBQVUsR0FBRyxJQUFJQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFFbEM7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxLQUFLLEdBQUcsS0FBSyxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFUSSxJQVVBQyxDQUFBQSxLQUFLLEdBQUcsS0FBSyxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFFZDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMs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
