import { Debug, DebugHelper } from '../../../core/debug.js';
import { StringIds } from '../../../core/string-ids.js';
import { WebgpuDebug } from './webgpu-debug.js';

const stringIds = new StringIds();

/**
 * Private class storing info about color buffer.
 *
 * @ignore
 */
class ColorAttachment {
  constructor() {
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    this.format = void 0;
    /**
     * @type {GPUTexture}
     * @private
     */
    this.multisampledBuffer = void 0;
  }
  destroy() {
    var _this$multisampledBuf;
    (_this$multisampledBuf = this.multisampledBuffer) == null || _this$multisampledBuf.destroy();
    this.multisampledBuffer = null;
  }
}

/**
 * A WebGPU implementation of the RenderTarget.
 *
 * @ignore
 */
class WebgpuRenderTarget {
  /**
   * @param {import('../render-target.js').RenderTarget} renderTarget - The render target owning
   * this implementation.
   */
  constructor(renderTarget) {
    /** @type {boolean} */
    this.initialized = false;
    /**
     * Unique key used by render pipeline creation
     *
     * @type {number}
     */
    this.key = void 0;
    /** @type {ColorAttachment[]} */
    this.colorAttachments = [];
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    this.depthFormat = void 0;
    /** @type {boolean} */
    this.hasStencil = void 0;
    /**
     * @type {GPUTexture}
     * @private
     */
    this.depthTexture = null;
    /**
     * True if the depthTexture is internally allocated / owned
     *
     * @type {boolean}
     */
    this.depthTextureInternal = false;
    /**
     * Texture assigned each frame, and not owned by this render target. This is used on the
     * framebuffer to assign per frame texture obtained from the context.
     *
     * @type {GPUTexture}
     * @private
     */
    this.assignedColorTexture = null;
    /**
     * Render pass descriptor used when starting a render pass for this render target.
     *
     * @type {GPURenderPassDescriptor}
     * @private
     */
    this.renderPassDescriptor = {};
    this.renderTarget = renderTarget;

    // color formats are based on the textures
    if (renderTarget._colorBuffers) {
      renderTarget._colorBuffers.forEach((colorBuffer, index) => {
        this.setColorAttachment(index, undefined, colorBuffer.impl.format);
      });
    }
    this.updateKey();
  }

  /**
   * Release associated resources. Note that this needs to leave this instance in a state where
   * it can be re-initialized again, which is used by render target resizing.
   *
   * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
   * graphics device.
   */
  destroy(device) {
    this.initialized = false;
    if (this.depthTextureInternal) {
      var _this$depthTexture;
      (_this$depthTexture = this.depthTexture) == null || _this$depthTexture.destroy();
      this.depthTexture = null;
    }
    this.assignedColorTexture = null;
    this.colorAttachments.forEach(colorAttachment => {
      colorAttachment.destroy();
    });
    this.colorAttachments.length = 0;
  }
  updateKey() {
    const rt = this.renderTarget;

    // key used by render pipeline creation
    let key = `${rt.samples}:${rt.depth ? this.depthFormat : 'nodepth'}`;
    this.colorAttachments.forEach(colorAttachment => {
      key += `:${colorAttachment.format}`;
    });

    // convert string to a unique number
    this.key = stringIds.get(key);
  }
  setDepthFormat(depthFormat) {
    Debug.assert(depthFormat);
    this.depthFormat = depthFormat;
    this.hasStencil = depthFormat === 'depth24plus-stencil8';
  }

  /**
   * Assign a color buffer. This allows the color buffer of the main framebuffer
   * to be swapped each frame to a buffer provided by the context.
   *
   * @param {any} gpuTexture - The color buffer.
   */
  assignColorTexture(gpuTexture) {
    Debug.assert(gpuTexture);
    this.assignedColorTexture = gpuTexture;
    const view = gpuTexture.createView();
    DebugHelper.setLabel(view, 'Framebuffer.assignedColor');

    // use it as render buffer or resolve target
    const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
    const samples = this.renderTarget.samples;
    if (samples > 1) {
      colorAttachment.resolveTarget = view;
    } else {
      colorAttachment.view = view;
    }

    // for main framebuffer, this is how the format is obtained
    this.setColorAttachment(0, undefined, gpuTexture.format);
    this.updateKey();
  }
  setColorAttachment(index, multisampledBuffer, format) {
    if (!this.colorAttachments[index]) {
      this.colorAttachments[index] = new ColorAttachment();
    }
    if (multisampledBuffer) {
      this.colorAttachments[index].multisampledBuffer = multisampledBuffer;
    }
    if (format) {
      this.colorAttachments[index].format = format;
    }
  }

  /**
   * Initialize render target for rendering one time.
   *
   * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
   * graphics device.
   * @param {import('../render-target.js').RenderTarget} renderTarget - The render target.
   */
  init(device, renderTarget) {
    var _renderTarget$_colorB, _renderTarget$_colorB2;
    const wgpu = device.wgpu;
    Debug.assert(!this.initialized);
    WebgpuDebug.memory(device);
    WebgpuDebug.validate(device);

    // initialize depth/stencil
    this.initDepthStencil(wgpu, renderTarget);

    // initialize color attachments
    this.renderPassDescriptor.colorAttachments = [];
    const count = (_renderTarget$_colorB = (_renderTarget$_colorB2 = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB2.length) != null ? _renderTarget$_colorB : 1;
    for (let i = 0; i < count; ++i) {
      var _this$colorAttachment;
      const colorAttachment = this.initColor(wgpu, renderTarget, i);

      // default framebuffer, buffer gets assigned later
      const isDefaultFramebuffer = i === 0 && ((_this$colorAttachment = this.colorAttachments[0]) == null ? void 0 : _this$colorAttachment.format);

      // if we have a color buffer, or is the default framebuffer
      if (colorAttachment.view || isDefaultFramebuffer) {
        this.renderPassDescriptor.colorAttachments.push(colorAttachment);
      }
    }
    this.initialized = true;
    WebgpuDebug.end(device, {
      renderTarget
    });
    WebgpuDebug.end(device, {
      renderTarget
    });
  }
  initDepthStencil(wgpu, renderTarget) {
    const {
      samples,
      width,
      height,
      depth,
      depthBuffer
    } = renderTarget;

    // depth buffer that we render to (single or multi-sampled). We don't create resolve
    // depth buffer as we don't currently resolve it. This might need to change in the future.
    if (depth || depthBuffer) {
      // allocate depth buffer if not provided
      if (!depthBuffer) {
        // TODO: support rendering to 32bit depth without a stencil as well
        this.setDepthFormat('depth24plus-stencil8');

        /** @type {GPUTextureDescriptor} */
        const depthTextureDesc = {
          size: [width, height, 1],
          dimension: '2d',
          sampleCount: samples,
          format: this.depthFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        };
        if (samples > 1) {
          // enable multi-sampled depth texture to be a source of our shader based resolver in WebgpuResolver
          // TODO: we do not always need to resolve it, and so might consider this flag to be optional
          depthTextureDesc.usage |= GPUTextureUsage.TEXTURE_BINDING;
        } else {
          // single sampled depth buffer can be copied out (grab pass)
          // TODO: we should not enable this for shadow maps, as it is not needed
          depthTextureDesc.usage |= GPUTextureUsage.COPY_SRC;
        }

        // allocate depth buffer
        this.depthTexture = wgpu.createTexture(depthTextureDesc);
        this.depthTextureInternal = true;
      } else {
        // use provided depth buffer
        this.depthTexture = depthBuffer.impl.gpuTexture;
        this.setDepthFormat(depthBuffer.impl.format);
      }
      Debug.assert(this.depthTexture);
      DebugHelper.setLabel(this.depthTexture, `${renderTarget.name}.depthTexture`);

      // @type {GPURenderPassDepthStencilAttachment}
      this.renderPassDescriptor.depthStencilAttachment = {
        view: this.depthTexture.createView()
      };
    }
  }

  /**
   * @private
   */
  initColor(wgpu, renderTarget, index) {
    // Single-sampled color buffer gets passed in:
    // - for normal render target, constructor takes the color buffer as an option
    // - for the main framebuffer, the device supplies the buffer each frame
    // And so we only need to create multi-sampled color buffer if needed here.
    /** @type {GPURenderPassColorAttachment} */
    const colorAttachment = {};
    const {
      samples,
      width,
      height
    } = renderTarget;
    const colorBuffer = renderTarget.getColorBuffer(index);

    // view used to write to the color buffer (either by rendering to it, or resolving to it)
    let colorView = null;
    if (colorBuffer) {
      // render to top mip level in case of mip-mapped buffer
      const mipLevelCount = 1;

      // cubemap face view - face is a single 2d array layer in order [+X, -X, +Y, -Y, +Z, -Z]
      if (colorBuffer.cubemap) {
        colorView = colorBuffer.impl.createView({
          dimension: '2d',
          baseArrayLayer: renderTarget.face,
          arrayLayerCount: 1,
          mipLevelCount
        });
      } else {
        colorView = colorBuffer.impl.createView({
          mipLevelCount
        });
      }
    }

    // multi-sampled color buffer
    if (samples > 1) {
      var _this$colorAttachment2, _this$colorAttachment3;
      /** @type {GPUTextureDescriptor} */
      const multisampledTextureDesc = {
        size: [width, height, 1],
        dimension: '2d',
        sampleCount: samples,
        format: (_this$colorAttachment2 = (_this$colorAttachment3 = this.colorAttachments[index]) == null ? void 0 : _this$colorAttachment3.format) != null ? _this$colorAttachment2 : colorBuffer.impl.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      };

      // allocate multi-sampled color buffer
      const multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
      DebugHelper.setLabel(multisampledColorBuffer, `${renderTarget.name}.multisampledColor`);
      this.setColorAttachment(index, multisampledColorBuffer, multisampledTextureDesc.format);
      colorAttachment.view = multisampledColorBuffer.createView();
      DebugHelper.setLabel(colorAttachment.view, `${renderTarget.name}.multisampledColorView`);
      colorAttachment.resolveTarget = colorView;
    } else {
      colorAttachment.view = colorView;
    }
    return colorAttachment;
  }

  /**
   * Update WebGPU render pass descriptor by RenderPass settings.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   */
  setupForRenderPass(renderPass) {
    var _this$renderPassDescr, _this$renderPassDescr2;
    Debug.assert(this.renderPassDescriptor);
    const count = (_this$renderPassDescr = (_this$renderPassDescr2 = this.renderPassDescriptor.colorAttachments) == null ? void 0 : _this$renderPassDescr2.length) != null ? _this$renderPassDescr : 0;
    for (let i = 0; i < count; ++i) {
      const colorAttachment = this.renderPassDescriptor.colorAttachments[i];
      const colorOps = renderPass.colorArrayOps[i];
      colorAttachment.clearValue = colorOps.clearValue;
      colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
      colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
    }
    const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
    if (depthAttachment) {
      depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
      depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
      depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
      depthAttachment.depthReadOnly = false;
      if (this.hasStencil) {
        depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
        depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'load';
        depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
        depthAttachment.stencilReadOnly = false;
      }
    }
  }
  loseContext() {
    this.initialized = false;
  }
  resolve(device, target, color, depth) {}
}

export { WebgpuRenderTarget };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXJlbmRlci10YXJnZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LXJlbmRlci10YXJnZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTdHJpbmdJZHMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3N0cmluZy1pZHMuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RGVidWcgfSBmcm9tICcuL3dlYmdwdS1kZWJ1Zy5qcyc7XG5cbmNvbnN0IHN0cmluZ0lkcyA9IG5ldyBTdHJpbmdJZHMoKTtcblxuLyoqXG4gKiBQcml2YXRlIGNsYXNzIHN0b3JpbmcgaW5mbyBhYm91dCBjb2xvciBidWZmZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBDb2xvckF0dGFjaG1lbnQge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZm9ybWF0O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtdWx0aXNhbXBsZWRCdWZmZXI7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLm11bHRpc2FtcGxlZEJ1ZmZlcj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLm11bHRpc2FtcGxlZEJ1ZmZlciA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEEgV2ViR1BVIGltcGxlbWVudGF0aW9uIG9mIHRoZSBSZW5kZXJUYXJnZXQuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVSZW5kZXJUYXJnZXQge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBpbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVW5pcXVlIGtleSB1c2VkIGJ5IHJlbmRlciBwaXBlbGluZSBjcmVhdGlvblxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBrZXk7XG5cbiAgICAvKiogQHR5cGUge0NvbG9yQXR0YWNobWVudFtdfSAqL1xuICAgIGNvbG9yQXR0YWNobWVudHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZGVwdGhGb3JtYXQ7XG5cbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgaGFzU3RlbmNpbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZGVwdGhUZXh0dXJlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoVGV4dHVyZSBpcyBpbnRlcm5hbGx5IGFsbG9jYXRlZCAvIG93bmVkXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBkZXB0aFRleHR1cmVJbnRlcm5hbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGV4dHVyZSBhc3NpZ25lZCBlYWNoIGZyYW1lLCBhbmQgbm90IG93bmVkIGJ5IHRoaXMgcmVuZGVyIHRhcmdldC4gVGhpcyBpcyB1c2VkIG9uIHRoZVxuICAgICAqIGZyYW1lYnVmZmVyIHRvIGFzc2lnbiBwZXIgZnJhbWUgdGV4dHVyZSBvYnRhaW5lZCBmcm9tIHRoZSBjb250ZXh0LlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBhc3NpZ25lZENvbG9yVGV4dHVyZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgcGFzcyBkZXNjcmlwdG9yIHVzZWQgd2hlbiBzdGFydGluZyBhIHJlbmRlciBwYXNzIGZvciB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVUmVuZGVyUGFzc0Rlc2NyaXB0b3J9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZW5kZXJQYXNzRGVzY3JpcHRvciA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHJlbmRlclRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IG93bmluZ1xuICAgICAqIHRoaXMgaW1wbGVtZW50YXRpb24uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGNvbG9yIGZvcm1hdHMgYXJlIGJhc2VkIG9uIHRoZSB0ZXh0dXJlc1xuICAgICAgICBpZiAocmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHJlbmRlclRhcmdldC5fY29sb3JCdWZmZXJzLmZvckVhY2goKGNvbG9yQnVmZmVyLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29sb3JBdHRhY2htZW50KGluZGV4LCB1bmRlZmluZWQsIGNvbG9yQnVmZmVyLmltcGwuZm9ybWF0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWxlYXNlIGFzc29jaWF0ZWQgcmVzb3VyY2VzLiBOb3RlIHRoYXQgdGhpcyBuZWVkcyB0byBsZWF2ZSB0aGlzIGluc3RhbmNlIGluIGEgc3RhdGUgd2hlcmVcbiAgICAgKiBpdCBjYW4gYmUgcmUtaW5pdGlhbGl6ZWQgYWdhaW4sIHdoaWNoIGlzIHVzZWQgYnkgcmVuZGVyIHRhcmdldCByZXNpemluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi93ZWJncHUvd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLmRlcHRoVGV4dHVyZUludGVybmFsKSB7XG4gICAgICAgICAgICB0aGlzLmRlcHRoVGV4dHVyZT8uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hc3NpZ25lZENvbG9yVGV4dHVyZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jb2xvckF0dGFjaG1lbnRzLmZvckVhY2goKGNvbG9yQXR0YWNobWVudCkgPT4ge1xuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29sb3JBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgcnQgPSB0aGlzLnJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyBrZXkgdXNlZCBieSByZW5kZXIgcGlwZWxpbmUgY3JlYXRpb25cbiAgICAgICAgbGV0IGtleSA9IGAke3J0LnNhbXBsZXN9OiR7cnQuZGVwdGggPyB0aGlzLmRlcHRoRm9ybWF0IDogJ25vZGVwdGgnfWA7XG4gICAgICAgIHRoaXMuY29sb3JBdHRhY2htZW50cy5mb3JFYWNoKChjb2xvckF0dGFjaG1lbnQpID0+IHtcbiAgICAgICAgICAgIGtleSArPSBgOiR7Y29sb3JBdHRhY2htZW50LmZvcm1hdH1gO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBjb252ZXJ0IHN0cmluZyB0byBhIHVuaXF1ZSBudW1iZXJcbiAgICAgICAgdGhpcy5rZXkgPSBzdHJpbmdJZHMuZ2V0KGtleSk7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhGb3JtYXQoZGVwdGhGb3JtYXQpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlcHRoRm9ybWF0KTtcbiAgICAgICAgdGhpcy5kZXB0aEZvcm1hdCA9IGRlcHRoRm9ybWF0O1xuICAgICAgICB0aGlzLmhhc1N0ZW5jaWwgPSBkZXB0aEZvcm1hdCA9PT0gJ2RlcHRoMjRwbHVzLXN0ZW5jaWw4JztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gYSBjb2xvciBidWZmZXIuIFRoaXMgYWxsb3dzIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIG1haW4gZnJhbWVidWZmZXJcbiAgICAgKiB0byBiZSBzd2FwcGVkIGVhY2ggZnJhbWUgdG8gYSBidWZmZXIgcHJvdmlkZWQgYnkgdGhlIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2FueX0gZ3B1VGV4dHVyZSAtIFRoZSBjb2xvciBidWZmZXIuXG4gICAgICovXG4gICAgYXNzaWduQ29sb3JUZXh0dXJlKGdwdVRleHR1cmUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3B1VGV4dHVyZSk7XG4gICAgICAgIHRoaXMuYXNzaWduZWRDb2xvclRleHR1cmUgPSBncHVUZXh0dXJlO1xuXG4gICAgICAgIGNvbnN0IHZpZXcgPSBncHVUZXh0dXJlLmNyZWF0ZVZpZXcoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodmlldywgJ0ZyYW1lYnVmZmVyLmFzc2lnbmVkQ29sb3InKTtcblxuICAgICAgICAvLyB1c2UgaXQgYXMgcmVuZGVyIGJ1ZmZlciBvciByZXNvbHZlIHRhcmdldFxuICAgICAgICBjb25zdCBjb2xvckF0dGFjaG1lbnQgPSB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmNvbG9yQXR0YWNobWVudHNbMF07XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSB0aGlzLnJlbmRlclRhcmdldC5zYW1wbGVzO1xuICAgICAgICBpZiAoc2FtcGxlcyA+IDEpIHtcbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC5yZXNvbHZlVGFyZ2V0ID0gdmlldztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC52aWV3ID0gdmlldztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciBtYWluIGZyYW1lYnVmZmVyLCB0aGlzIGlzIGhvdyB0aGUgZm9ybWF0IGlzIG9idGFpbmVkXG4gICAgICAgIHRoaXMuc2V0Q29sb3JBdHRhY2htZW50KDAsIHVuZGVmaW5lZCwgZ3B1VGV4dHVyZS5mb3JtYXQpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIHNldENvbG9yQXR0YWNobWVudChpbmRleCwgbXVsdGlzYW1wbGVkQnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdID0gbmV3IENvbG9yQXR0YWNobWVudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG11bHRpc2FtcGxlZEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5jb2xvckF0dGFjaG1lbnRzW2luZGV4XS5tdWx0aXNhbXBsZWRCdWZmZXIgPSBtdWx0aXNhbXBsZWRCdWZmZXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdLmZvcm1hdCA9IGZvcm1hdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgcmVuZGVyIHRhcmdldCBmb3IgcmVuZGVyaW5nIG9uZSB0aW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcmVuZGVyVGFyZ2V0IC0gVGhlIHJlbmRlciB0YXJnZXQuXG4gICAgICovXG4gICAgaW5pdChkZXZpY2UsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluaXRpYWxpemVkKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5tZW1vcnkoZGV2aWNlKTtcbiAgICAgICAgV2ViZ3B1RGVidWcudmFsaWRhdGUoZGV2aWNlKTtcblxuICAgICAgICAvLyBpbml0aWFsaXplIGRlcHRoL3N0ZW5jaWxcbiAgICAgICAgdGhpcy5pbml0RGVwdGhTdGVuY2lsKHdncHUsIHJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBjb2xvciBhdHRhY2htZW50c1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmNvbG9yQXR0YWNobWVudHMgPSBbXTtcbiAgICAgICAgY29uc3QgY291bnQgPSByZW5kZXJUYXJnZXQuX2NvbG9yQnVmZmVycz8ubGVuZ3RoID8/IDE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY29sb3JBdHRhY2htZW50ID0gdGhpcy5pbml0Q29sb3Iod2dwdSwgcmVuZGVyVGFyZ2V0LCBpKTtcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBmcmFtZWJ1ZmZlciwgYnVmZmVyIGdldHMgYXNzaWduZWQgbGF0ZXJcbiAgICAgICAgICAgIGNvbnN0IGlzRGVmYXVsdEZyYW1lYnVmZmVyID0gaSA9PT0gMCAmJiB0aGlzLmNvbG9yQXR0YWNobWVudHNbMF0/LmZvcm1hdDtcblxuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBhIGNvbG9yIGJ1ZmZlciwgb3IgaXMgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIGlmIChjb2xvckF0dGFjaG1lbnQudmlldyB8fCBpc0RlZmF1bHRGcmFtZWJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc0Rlc2NyaXB0b3IuY29sb3JBdHRhY2htZW50cy5wdXNoKGNvbG9yQXR0YWNobWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7IHJlbmRlclRhcmdldCB9KTtcbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKGRldmljZSwgeyByZW5kZXJUYXJnZXQgfSk7XG4gICAgfVxuXG4gICAgaW5pdERlcHRoU3RlbmNpbCh3Z3B1LCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCB7IHNhbXBsZXMsIHdpZHRoLCBoZWlnaHQsIGRlcHRoLCBkZXB0aEJ1ZmZlciB9ID0gcmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGRlcHRoIGJ1ZmZlciB0aGF0IHdlIHJlbmRlciB0byAoc2luZ2xlIG9yIG11bHRpLXNhbXBsZWQpLiBXZSBkb24ndCBjcmVhdGUgcmVzb2x2ZVxuICAgICAgICAvLyBkZXB0aCBidWZmZXIgYXMgd2UgZG9uJ3QgY3VycmVudGx5IHJlc29sdmUgaXQuIFRoaXMgbWlnaHQgbmVlZCB0byBjaGFuZ2UgaW4gdGhlIGZ1dHVyZS5cbiAgICAgICAgaWYgKGRlcHRoIHx8IGRlcHRoQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIGRlcHRoIGJ1ZmZlciBpZiBub3QgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmICghZGVwdGhCdWZmZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgcmVuZGVyaW5nIHRvIDMyYml0IGRlcHRoIHdpdGhvdXQgYSBzdGVuY2lsIGFzIHdlbGxcbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoRm9ybWF0KCdkZXB0aDI0cGx1cy1zdGVuY2lsOCcpO1xuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVUZXh0dXJlRGVzY3JpcHRvcn0gKi9cbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aFRleHR1cmVEZXNjID0ge1xuICAgICAgICAgICAgICAgICAgICBzaXplOiBbd2lkdGgsIGhlaWdodCwgMV0sXG4gICAgICAgICAgICAgICAgICAgIGRpbWVuc2lvbjogJzJkJyxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlQ291bnQ6IHNhbXBsZXMsXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogdGhpcy5kZXB0aEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2U6IEdQVVRleHR1cmVVc2FnZS5SRU5ERVJfQVRUQUNITUVOVFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoc2FtcGxlcyA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZW5hYmxlIG11bHRpLXNhbXBsZWQgZGVwdGggdGV4dHVyZSB0byBiZSBhIHNvdXJjZSBvZiBvdXIgc2hhZGVyIGJhc2VkIHJlc29sdmVyIGluIFdlYmdwdVJlc29sdmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGRvIG5vdCBhbHdheXMgbmVlZCB0byByZXNvbHZlIGl0LCBhbmQgc28gbWlnaHQgY29uc2lkZXIgdGhpcyBmbGFnIHRvIGJlIG9wdGlvbmFsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoVGV4dHVyZURlc2MudXNhZ2UgfD0gR1BVVGV4dHVyZVVzYWdlLlRFWFRVUkVfQklORElORztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBzaW5nbGUgc2FtcGxlZCBkZXB0aCBidWZmZXIgY2FuIGJlIGNvcGllZCBvdXQgKGdyYWIgcGFzcylcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIG5vdCBlbmFibGUgdGhpcyBmb3Igc2hhZG93IG1hcHMsIGFzIGl0IGlzIG5vdCBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXh0dXJlRGVzYy51c2FnZSB8PSBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9TUkM7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYWxsb2NhdGUgZGVwdGggYnVmZmVyXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmUgPSB3Z3B1LmNyZWF0ZVRleHR1cmUoZGVwdGhUZXh0dXJlRGVzYyk7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmVJbnRlcm5hbCA9IHRydWU7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyB1c2UgcHJvdmlkZWQgZGVwdGggYnVmZmVyXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmUgPSBkZXB0aEJ1ZmZlci5pbXBsLmdwdVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXREZXB0aEZvcm1hdChkZXB0aEJ1ZmZlci5pbXBsLmZvcm1hdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmRlcHRoVGV4dHVyZSk7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh0aGlzLmRlcHRoVGV4dHVyZSwgYCR7cmVuZGVyVGFyZ2V0Lm5hbWV9LmRlcHRoVGV4dHVyZWApO1xuXG4gICAgICAgICAgICAvLyBAdHlwZSB7R1BVUmVuZGVyUGFzc0RlcHRoU3RlbmNpbEF0dGFjaG1lbnR9XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmRlcHRoU3RlbmNpbEF0dGFjaG1lbnQgPSB7XG4gICAgICAgICAgICAgICAgdmlldzogdGhpcy5kZXB0aFRleHR1cmUuY3JlYXRlVmlldygpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbml0Q29sb3Iod2dwdSwgcmVuZGVyVGFyZ2V0LCBpbmRleCkge1xuICAgICAgICAvLyBTaW5nbGUtc2FtcGxlZCBjb2xvciBidWZmZXIgZ2V0cyBwYXNzZWQgaW46XG4gICAgICAgIC8vIC0gZm9yIG5vcm1hbCByZW5kZXIgdGFyZ2V0LCBjb25zdHJ1Y3RvciB0YWtlcyB0aGUgY29sb3IgYnVmZmVyIGFzIGFuIG9wdGlvblxuICAgICAgICAvLyAtIGZvciB0aGUgbWFpbiBmcmFtZWJ1ZmZlciwgdGhlIGRldmljZSBzdXBwbGllcyB0aGUgYnVmZmVyIGVhY2ggZnJhbWVcbiAgICAgICAgLy8gQW5kIHNvIHdlIG9ubHkgbmVlZCB0byBjcmVhdGUgbXVsdGktc2FtcGxlZCBjb2xvciBidWZmZXIgaWYgbmVlZGVkIGhlcmUuXG4gICAgICAgIC8qKiBAdHlwZSB7R1BVUmVuZGVyUGFzc0NvbG9yQXR0YWNobWVudH0gKi9cbiAgICAgICAgY29uc3QgY29sb3JBdHRhY2htZW50ID0ge307XG5cbiAgICAgICAgY29uc3QgeyBzYW1wbGVzLCB3aWR0aCwgaGVpZ2h0IH0gPSByZW5kZXJUYXJnZXQ7XG4gICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gcmVuZGVyVGFyZ2V0LmdldENvbG9yQnVmZmVyKGluZGV4KTtcblxuICAgICAgICAvLyB2aWV3IHVzZWQgdG8gd3JpdGUgdG8gdGhlIGNvbG9yIGJ1ZmZlciAoZWl0aGVyIGJ5IHJlbmRlcmluZyB0byBpdCwgb3IgcmVzb2x2aW5nIHRvIGl0KVxuICAgICAgICBsZXQgY29sb3JWaWV3ID0gbnVsbDtcbiAgICAgICAgaWYgKGNvbG9yQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciB0byB0b3AgbWlwIGxldmVsIGluIGNhc2Ugb2YgbWlwLW1hcHBlZCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG1pcExldmVsQ291bnQgPSAxO1xuXG4gICAgICAgICAgICAvLyBjdWJlbWFwIGZhY2UgdmlldyAtIGZhY2UgaXMgYSBzaW5nbGUgMmQgYXJyYXkgbGF5ZXIgaW4gb3JkZXIgWytYLCAtWCwgK1ksIC1ZLCArWiwgLVpdXG4gICAgICAgICAgICBpZiAoY29sb3JCdWZmZXIuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGNvbG9yVmlldyA9IGNvbG9yQnVmZmVyLmltcGwuY3JlYXRlVmlldyh7XG4gICAgICAgICAgICAgICAgICAgIGRpbWVuc2lvbjogJzJkJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFycmF5TGF5ZXI6IHJlbmRlclRhcmdldC5mYWNlLFxuICAgICAgICAgICAgICAgICAgICBhcnJheUxheWVyQ291bnQ6IDEsXG4gICAgICAgICAgICAgICAgICAgIG1pcExldmVsQ291bnRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29sb3JWaWV3ID0gY29sb3JCdWZmZXIuaW1wbC5jcmVhdGVWaWV3KHtcbiAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWxDb3VudFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbXVsdGktc2FtcGxlZCBjb2xvciBidWZmZXJcbiAgICAgICAgaWYgKHNhbXBsZXMgPiAxKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVVGV4dHVyZURlc2NyaXB0b3J9ICovXG4gICAgICAgICAgICBjb25zdCBtdWx0aXNhbXBsZWRUZXh0dXJlRGVzYyA9IHtcbiAgICAgICAgICAgICAgICBzaXplOiBbd2lkdGgsIGhlaWdodCwgMV0sXG4gICAgICAgICAgICAgICAgZGltZW5zaW9uOiAnMmQnLFxuICAgICAgICAgICAgICAgIHNhbXBsZUNvdW50OiBzYW1wbGVzLFxuICAgICAgICAgICAgICAgIGZvcm1hdDogdGhpcy5jb2xvckF0dGFjaG1lbnRzW2luZGV4XT8uZm9ybWF0ID8/IGNvbG9yQnVmZmVyLmltcGwuZm9ybWF0LFxuICAgICAgICAgICAgICAgIHVzYWdlOiBHUFVUZXh0dXJlVXNhZ2UuUkVOREVSX0FUVEFDSE1FTlRcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIG11bHRpLXNhbXBsZWQgY29sb3IgYnVmZmVyXG4gICAgICAgICAgICBjb25zdCBtdWx0aXNhbXBsZWRDb2xvckJ1ZmZlciA9IHdncHUuY3JlYXRlVGV4dHVyZShtdWx0aXNhbXBsZWRUZXh0dXJlRGVzYyk7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChtdWx0aXNhbXBsZWRDb2xvckJ1ZmZlciwgYCR7cmVuZGVyVGFyZ2V0Lm5hbWV9Lm11bHRpc2FtcGxlZENvbG9yYCk7XG4gICAgICAgICAgICB0aGlzLnNldENvbG9yQXR0YWNobWVudChpbmRleCwgbXVsdGlzYW1wbGVkQ29sb3JCdWZmZXIsIG11bHRpc2FtcGxlZFRleHR1cmVEZXNjLmZvcm1hdCk7XG5cbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC52aWV3ID0gbXVsdGlzYW1wbGVkQ29sb3JCdWZmZXIuY3JlYXRlVmlldygpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY29sb3JBdHRhY2htZW50LnZpZXcsIGAke3JlbmRlclRhcmdldC5uYW1lfS5tdWx0aXNhbXBsZWRDb2xvclZpZXdgKTtcblxuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnJlc29sdmVUYXJnZXQgPSBjb2xvclZpZXc7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnZpZXcgPSBjb2xvclZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29sb3JBdHRhY2htZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBXZWJHUFUgcmVuZGVyIHBhc3MgZGVzY3JpcHRvciBieSBSZW5kZXJQYXNzIHNldHRpbmdzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBzdGFydC5cbiAgICAgKi9cbiAgICBzZXR1cEZvclJlbmRlclBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMucmVuZGVyUGFzc0Rlc2NyaXB0b3IuY29sb3JBdHRhY2htZW50cz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY29sb3JBdHRhY2htZW50ID0gdGhpcy5yZW5kZXJQYXNzRGVzY3JpcHRvci5jb2xvckF0dGFjaG1lbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yQXJyYXlPcHNbaV07XG4gICAgICAgICAgICBjb2xvckF0dGFjaG1lbnQuY2xlYXJWYWx1ZSA9IGNvbG9yT3BzLmNsZWFyVmFsdWU7XG4gICAgICAgICAgICBjb2xvckF0dGFjaG1lbnQubG9hZE9wID0gY29sb3JPcHMuY2xlYXIgPyAnY2xlYXInIDogJ2xvYWQnO1xuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnN0b3JlT3AgPSBjb2xvck9wcy5zdG9yZSA/ICdzdG9yZScgOiAnZGlzY2FyZCc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZXB0aEF0dGFjaG1lbnQgPSB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmRlcHRoU3RlbmNpbEF0dGFjaG1lbnQ7XG4gICAgICAgIGlmIChkZXB0aEF0dGFjaG1lbnQpIHtcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aENsZWFyVmFsdWUgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWU7XG4gICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuZGVwdGhMb2FkT3AgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID8gJ2NsZWFyJyA6ICdsb2FkJztcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aFN0b3JlT3AgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID8gJ3N0b3JlJyA6ICdkaXNjYXJkJztcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aFJlYWRPbmx5ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmhhc1N0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbENsZWFyVmFsdWUgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbExvYWRPcCA9IHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCA/ICdjbGVhcicgOiAnbG9hZCc7XG4gICAgICAgICAgICAgICAgZGVwdGhBdHRhY2htZW50LnN0ZW5jaWxTdG9yZU9wID0gcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsID8gJ3N0b3JlJyA6ICdkaXNjYXJkJztcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbFJlYWRPbmx5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlc29sdmUoZGV2aWNlLCB0YXJnZXQsIGNvbG9yLCBkZXB0aCkge1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ3B1UmVuZGVyVGFyZ2V0IH07XG4iXSwibmFtZXMiOlsic3RyaW5nSWRzIiwiU3RyaW5nSWRzIiwiQ29sb3JBdHRhY2htZW50IiwiY29uc3RydWN0b3IiLCJmb3JtYXQiLCJtdWx0aXNhbXBsZWRCdWZmZXIiLCJkZXN0cm95IiwiX3RoaXMkbXVsdGlzYW1wbGVkQnVmIiwiV2ViZ3B1UmVuZGVyVGFyZ2V0IiwicmVuZGVyVGFyZ2V0IiwiaW5pdGlhbGl6ZWQiLCJrZXkiLCJjb2xvckF0dGFjaG1lbnRzIiwiZGVwdGhGb3JtYXQiLCJoYXNTdGVuY2lsIiwiZGVwdGhUZXh0dXJlIiwiZGVwdGhUZXh0dXJlSW50ZXJuYWwiLCJhc3NpZ25lZENvbG9yVGV4dHVyZSIsInJlbmRlclBhc3NEZXNjcmlwdG9yIiwiX2NvbG9yQnVmZmVycyIsImZvckVhY2giLCJjb2xvckJ1ZmZlciIsImluZGV4Iiwic2V0Q29sb3JBdHRhY2htZW50IiwidW5kZWZpbmVkIiwiaW1wbCIsInVwZGF0ZUtleSIsImRldmljZSIsIl90aGlzJGRlcHRoVGV4dHVyZSIsImNvbG9yQXR0YWNobWVudCIsImxlbmd0aCIsInJ0Iiwic2FtcGxlcyIsImRlcHRoIiwiZ2V0Iiwic2V0RGVwdGhGb3JtYXQiLCJEZWJ1ZyIsImFzc2VydCIsImFzc2lnbkNvbG9yVGV4dHVyZSIsImdwdVRleHR1cmUiLCJ2aWV3IiwiY3JlYXRlVmlldyIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJyZXNvbHZlVGFyZ2V0IiwiaW5pdCIsIl9yZW5kZXJUYXJnZXQkX2NvbG9yQiIsIl9yZW5kZXJUYXJnZXQkX2NvbG9yQjIiLCJ3Z3B1IiwiV2ViZ3B1RGVidWciLCJtZW1vcnkiLCJ2YWxpZGF0ZSIsImluaXREZXB0aFN0ZW5jaWwiLCJjb3VudCIsImkiLCJfdGhpcyRjb2xvckF0dGFjaG1lbnQiLCJpbml0Q29sb3IiLCJpc0RlZmF1bHRGcmFtZWJ1ZmZlciIsInB1c2giLCJlbmQiLCJ3aWR0aCIsImhlaWdodCIsImRlcHRoQnVmZmVyIiwiZGVwdGhUZXh0dXJlRGVzYyIsInNpemUiLCJkaW1lbnNpb24iLCJzYW1wbGVDb3VudCIsInVzYWdlIiwiR1BVVGV4dHVyZVVzYWdlIiwiUkVOREVSX0FUVEFDSE1FTlQiLCJURVhUVVJFX0JJTkRJTkciLCJDT1BZX1NSQyIsImNyZWF0ZVRleHR1cmUiLCJuYW1lIiwiZGVwdGhTdGVuY2lsQXR0YWNobWVudCIsImdldENvbG9yQnVmZmVyIiwiY29sb3JWaWV3IiwibWlwTGV2ZWxDb3VudCIsImN1YmVtYXAiLCJiYXNlQXJyYXlMYXllciIsImZhY2UiLCJhcnJheUxheWVyQ291bnQiLCJfdGhpcyRjb2xvckF0dGFjaG1lbnQyIiwiX3RoaXMkY29sb3JBdHRhY2htZW50MyIsIm11bHRpc2FtcGxlZFRleHR1cmVEZXNjIiwibXVsdGlzYW1wbGVkQ29sb3JCdWZmZXIiLCJzZXR1cEZvclJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwiX3RoaXMkcmVuZGVyUGFzc0Rlc2NyIiwiX3RoaXMkcmVuZGVyUGFzc0Rlc2NyMiIsImNvbG9yT3BzIiwiY29sb3JBcnJheU9wcyIsImNsZWFyVmFsdWUiLCJsb2FkT3AiLCJjbGVhciIsInN0b3JlT3AiLCJzdG9yZSIsImRlcHRoQXR0YWNobWVudCIsImRlcHRoQ2xlYXJWYWx1ZSIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImRlcHRoTG9hZE9wIiwiY2xlYXJEZXB0aCIsImRlcHRoU3RvcmVPcCIsInN0b3JlRGVwdGgiLCJkZXB0aFJlYWRPbmx5Iiwic3RlbmNpbENsZWFyVmFsdWUiLCJjbGVhclN0ZW5jaWxWYWx1ZSIsInN0ZW5jaWxMb2FkT3AiLCJjbGVhclN0ZW5jaWwiLCJzdGVuY2lsU3RvcmVPcCIsInN0b3JlU3RlbmNpbCIsInN0ZW5jaWxSZWFkT25seSIsImxvc2VDb250ZXh0IiwicmVzb2x2ZSIsInRhcmdldCIsImNvbG9yIl0sIm1hcHBpbmdzIjoiOzs7O0FBSUEsTUFBTUEsU0FBUyxHQUFHLElBQUlDLFNBQVMsRUFBRSxDQUFBOztBQUVqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsZUFBZSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUNsQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxNQUFNLEdBQUEsS0FB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
