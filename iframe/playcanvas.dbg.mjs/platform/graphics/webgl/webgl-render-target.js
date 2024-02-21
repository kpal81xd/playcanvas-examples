import { Debug } from '../../../core/debug.js';
import { PIXELFORMAT_RGBA8 } from '../constants.js';
import { DebugGraphics } from '../debug-graphics.js';

/**
 * A private class representing a pair of framebuffers, when MSAA is used.
 *
 * @ignore
 */
class FramebufferPair {
  constructor(msaaFB, resolveFB) {
    /** Multi-sampled rendering framebuffer */
    this.msaaFB = void 0;
    /** Single-sampled resolve framebuffer */
    this.resolveFB = void 0;
    this.msaaFB = msaaFB;
    this.resolveFB = resolveFB;
  }
  destroy(gl) {
    if (this.msaaFB) {
      gl.deleteRenderbuffer(this.msaaFB);
      this.msaaFB = null;
    }
    if (this.resolveFB) {
      gl.deleteRenderbuffer(this.resolveFB);
      this.resolveFB = null;
    }
  }
}

/**
 * A WebGL implementation of the RenderTarget.
 *
 * @ignore
 */
class WebglRenderTarget {
  constructor() {
    this._glFrameBuffer = null;
    this._glDepthBuffer = null;
    this._glResolveFrameBuffer = null;
    /**
     * A list of framebuffers created When MSAA and MRT are used together, one for each color buffer.
     * This allows color buffers to be resolved separately.
     *
     * @type {FramebufferPair[]}
     */
    this.colorMrtFramebuffers = null;
    this._glMsaaColorBuffers = [];
    this._glMsaaDepthBuffer = null;
    /**
     * The supplied single-sampled framebuffer for rendering. Undefined represents no supplied
     * framebuffer. Null represents the default framebuffer. A value represents a user-supplied
     * framebuffer.
     */
    this.suppliedColorFramebuffer = void 0;
    this._isInitialized = false;
  }
  destroy(device) {
    var _this$colorMrtFramebu;
    const gl = device.gl;
    this._isInitialized = false;
    if (this._glFrameBuffer) {
      if (this._glFrameBuffer !== this.suppliedColorFramebuffer) gl.deleteFramebuffer(this._glFrameBuffer);
      this._glFrameBuffer = null;
    }
    if (this._glDepthBuffer) {
      gl.deleteRenderbuffer(this._glDepthBuffer);
      this._glDepthBuffer = null;
    }
    if (this._glResolveFrameBuffer) {
      if (this._glResolveFrameBuffer !== this.suppliedColorFramebuffer) gl.deleteFramebuffer(this._glResolveFrameBuffer);
      this._glResolveFrameBuffer = null;
    }
    this._glMsaaColorBuffers.forEach(buffer => {
      gl.deleteRenderbuffer(buffer);
    });
    this._glMsaaColorBuffers.length = 0;
    (_this$colorMrtFramebu = this.colorMrtFramebuffers) == null || _this$colorMrtFramebu.forEach(framebuffer => {
      framebuffer.destroy(gl);
    });
    this.colorMrtFramebuffers = null;
    if (this._glMsaaDepthBuffer) {
      gl.deleteRenderbuffer(this._glMsaaDepthBuffer);
      this._glMsaaDepthBuffer = null;
    }
    this.suppliedColorFramebuffer = undefined;
  }
  get initialized() {
    return this._isInitialized;
  }
  init(device, target) {
    const gl = device.gl;
    this._isInitialized = true;
    const buffers = [];
    if (this.suppliedColorFramebuffer !== undefined) {
      this._glFrameBuffer = this.suppliedColorFramebuffer;
    } else {
      var _target$_colorBuffers, _target$_colorBuffers2, _device$extDrawBuffer, _device$extDrawBuffer2;
      // ##### Create main FBO #####
      this._glFrameBuffer = gl.createFramebuffer();
      device.setFramebuffer(this._glFrameBuffer);

      // --- Init the provided color buffer (optional) ---
      const colorBufferCount = (_target$_colorBuffers = (_target$_colorBuffers2 = target._colorBuffers) == null ? void 0 : _target$_colorBuffers2.length) != null ? _target$_colorBuffers : 0;
      const attachmentBaseConstant = device.isWebGL2 ? gl.COLOR_ATTACHMENT0 : (_device$extDrawBuffer = (_device$extDrawBuffer2 = device.extDrawBuffers) == null ? void 0 : _device$extDrawBuffer2.COLOR_ATTACHMENT0_WEBGL) != null ? _device$extDrawBuffer : gl.COLOR_ATTACHMENT0;
      for (let i = 0; i < colorBufferCount; ++i) {
        const colorBuffer = target.getColorBuffer(i);
        if (colorBuffer) {
          if (!colorBuffer.impl._glTexture) {
            // Clamp the render buffer size to the maximum supported by the device
            colorBuffer._width = Math.min(colorBuffer.width, device.maxRenderBufferSize);
            colorBuffer._height = Math.min(colorBuffer.height, device.maxRenderBufferSize);
            device.setTexture(colorBuffer, 0);
          }
          // Attach the color buffer
          gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant + i, colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, colorBuffer.impl._glTexture, 0);
          buffers.push(attachmentBaseConstant + i);
        }
      }
      if (device.drawBuffers) {
        device.drawBuffers(buffers);
      }
      const depthBuffer = target._depthBuffer;
      if (depthBuffer) {
        // --- Init the provided depth/stencil buffer (optional, WebGL2 only) ---
        if (!depthBuffer.impl._glTexture) {
          // Clamp the render buffer size to the maximum supported by the device
          depthBuffer._width = Math.min(depthBuffer.width, device.maxRenderBufferSize);
          depthBuffer._height = Math.min(depthBuffer.height, device.maxRenderBufferSize);
          device.setTexture(depthBuffer, 0);
        }
        // Attach
        if (target._stencil) {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._depthBuffer.impl._glTexture, 0);
        } else {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._depthBuffer.impl._glTexture, 0);
        }
      } else if (target._depth) {
        // --- Init a new depth/stencil buffer (optional) ---
        // if device is a MSAA RT, and no buffer to resolve to, skip creating non-MSAA depth
        const willRenderMsaa = target._samples > 1 && device.isWebGL2;
        if (!willRenderMsaa) {
          if (!this._glDepthBuffer) {
            this._glDepthBuffer = gl.createRenderbuffer();
          }
          gl.bindRenderbuffer(gl.RENDERBUFFER, this._glDepthBuffer);
          if (target._stencil) {
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, target.width, target.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
          } else {
            const depthFormat = device.isWebGL2 ? gl.DEPTH_COMPONENT32F : gl.DEPTH_COMPONENT16;
            gl.renderbufferStorage(gl.RENDERBUFFER, depthFormat, target.width, target.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
          }
          gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        }
      }
      Debug.call(() => this._checkFbo(device, target));
    }

    // ##### Create MSAA FBO (WebGL2 only) #####
    if (device.isWebGL2 && target._samples > 1) {
      var _target$_colorBuffers3, _target$_colorBuffers4;
      Debug.call(() => {
        if (target.width <= 0 || target.height <= 0) {
          Debug.warnOnce(`Invalid render target size: ${target.width} x ${target.height}`, target);
        }
      });

      // Use previous FBO for resolves
      this._glResolveFrameBuffer = this._glFrameBuffer;

      // Actual FBO will be MSAA
      this._glFrameBuffer = gl.createFramebuffer();
      device.setFramebuffer(this._glFrameBuffer);

      // Create an optional MSAA color buffers
      const colorBufferCount = (_target$_colorBuffers3 = (_target$_colorBuffers4 = target._colorBuffers) == null ? void 0 : _target$_colorBuffers4.length) != null ? _target$_colorBuffers3 : 0;
      if (this.suppliedColorFramebuffer !== undefined) {
        const buffer = gl.createRenderbuffer();
        this._glMsaaColorBuffers.push(buffer);
        const internalFormat = device.backBufferFormat === PIXELFORMAT_RGBA8 ? gl.RGBA8 : gl.RGB8;
        gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, internalFormat, target.width, target.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);
      } else {
        for (let i = 0; i < colorBufferCount; ++i) {
          const colorBuffer = target.getColorBuffer(i);
          if (colorBuffer) {
            const buffer = gl.createRenderbuffer();
            this._glMsaaColorBuffers.push(buffer);
            gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, buffer);
          }
        }
      }

      // Optionally add a MSAA depth/stencil buffer
      if (target._depth) {
        if (!this._glMsaaDepthBuffer) {
          this._glMsaaDepthBuffer = gl.createRenderbuffer();
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        if (target._stencil) {
          gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH24_STENCIL8, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        } else {
          gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH_COMPONENT32F, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        }
      }
      Debug.call(() => this._checkFbo(device, target, 'MSAA'));
      if (colorBufferCount > 1) {
        // create framebuffers allowing us to individually resolve each color buffer
        this._createMsaaMrtFramebuffers(device, target, colorBufferCount);

        // restore rendering back to the main framebuffer
        device.setFramebuffer(this._glFrameBuffer);
        device.drawBuffers(buffers);
      }
    }
  }
  _createMsaaMrtFramebuffers(device, target, colorBufferCount) {
    const gl = device.gl;
    this.colorMrtFramebuffers = [];
    for (let i = 0; i < colorBufferCount; ++i) {
      const colorBuffer = target.getColorBuffer(i);

      // src
      const srcFramebuffer = gl.createFramebuffer();
      device.setFramebuffer(srcFramebuffer);
      const buffer = this._glMsaaColorBuffers[i];
      gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);
      device.drawBuffers([gl.COLOR_ATTACHMENT0]);
      Debug.call(() => this._checkFbo(device, target, `MSAA-MRT-src${i}`));

      // dst
      const dstFramebuffer = gl.createFramebuffer();
      device.setFramebuffer(dstFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, colorBuffer.impl._glTexture, 0);
      this.colorMrtFramebuffers[i] = new FramebufferPair(srcFramebuffer, dstFramebuffer);
      Debug.call(() => this._checkFbo(device, target, `MSAA-MRT-dst${i}`));
    }
  }

  /**
   * Checks the completeness status of the currently bound WebGLFramebuffer object.
   *
   * @private
   */
  _checkFbo(device, target, type = '') {
    const gl = device.gl;
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    let errorCode;
    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        errorCode = 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        errorCode = 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        errorCode = 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
        break;
      case gl.FRAMEBUFFER_UNSUPPORTED:
        errorCode = 'FRAMEBUFFER_UNSUPPORTED';
        break;
    }
    Debug.assert(!errorCode, `Framebuffer creation failed with error code ${errorCode}, render target: ${target.name} ${type}`, target);
  }
  loseContext() {
    this._glFrameBuffer = null;
    this._glDepthBuffer = null;
    this._glResolveFrameBuffer = null;
    this._glMsaaColorBuffers.length = 0;
    this._glMsaaDepthBuffer = null;
    this.colorMrtFramebuffers = null;
    this.suppliedColorFramebuffer = undefined;
    this._isInitialized = false;
  }
  internalResolve(device, src, dst, target, mask) {
    Debug.assert(src !== dst, 'Source and destination framebuffers must be different when blitting.');

    // blit is affected by scissor test, so make it full size
    device.setScissor(0, 0, target.width, target.height);
    const gl = device.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, mask, gl.NEAREST);
  }
  resolve(device, target, color, depth) {
    if (device.isWebGL2) {
      const gl = device.gl;

      // if MRT is used, we need to resolve each buffer individually
      if (this.colorMrtFramebuffers) {
        // color
        if (color) {
          for (let i = 0; i < this.colorMrtFramebuffers.length; i++) {
            const fbPair = this.colorMrtFramebuffers[i];
            DebugGraphics.pushGpuMarker(device, `RESOLVE-MRT${i}`);
            this.internalResolve(device, fbPair.msaaFB, fbPair.resolveFB, target, gl.COLOR_BUFFER_BIT);
            DebugGraphics.popGpuMarker(device);
          }
        }

        // depth
        if (depth) {
          DebugGraphics.pushGpuMarker(device, `RESOLVE-MRT-DEPTH`);
          this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target, gl.DEPTH_BUFFER_BIT);
          DebugGraphics.popGpuMarker(device);
        }
      } else {
        DebugGraphics.pushGpuMarker(device, `RESOLVE`);
        this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0));
        DebugGraphics.popGpuMarker(device);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
    }
  }
}

export { WebglRenderTarget };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtcmVuZGVyLXRhcmdldC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXJlbmRlci10YXJnZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS9kZWJ1Zy5qc1wiO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfUkdCQTggfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSBcIi4uL2RlYnVnLWdyYXBoaWNzLmpzXCI7XG5cbi8qKlxuICogQSBwcml2YXRlIGNsYXNzIHJlcHJlc2VudGluZyBhIHBhaXIgb2YgZnJhbWVidWZmZXJzLCB3aGVuIE1TQUEgaXMgdXNlZC5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEZyYW1lYnVmZmVyUGFpciB7XG4gICAgLyoqIE11bHRpLXNhbXBsZWQgcmVuZGVyaW5nIGZyYW1lYnVmZmVyICovXG4gICAgbXNhYUZCO1xuXG4gICAgLyoqIFNpbmdsZS1zYW1wbGVkIHJlc29sdmUgZnJhbWVidWZmZXIgKi9cbiAgICByZXNvbHZlRkI7XG5cbiAgICBjb25zdHJ1Y3Rvcihtc2FhRkIsIHJlc29sdmVGQikge1xuICAgICAgICB0aGlzLm1zYWFGQiA9IG1zYWFGQjtcbiAgICAgICAgdGhpcy5yZXNvbHZlRkIgPSByZXNvbHZlRkI7XG4gICAgfVxuXG4gICAgZGVzdHJveShnbCkge1xuICAgICAgICBpZiAodGhpcy5tc2FhRkIpIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcih0aGlzLm1zYWFGQik7XG4gICAgICAgICAgICB0aGlzLm1zYWFGQiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZXNvbHZlRkIpIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcih0aGlzLnJlc29sdmVGQik7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGQiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgUmVuZGVyVGFyZ2V0LlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ2xSZW5kZXJUYXJnZXQge1xuICAgIF9nbEZyYW1lQnVmZmVyID0gbnVsbDtcblxuICAgIF9nbERlcHRoQnVmZmVyID0gbnVsbDtcblxuICAgIF9nbFJlc29sdmVGcmFtZUJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBIGxpc3Qgb2YgZnJhbWVidWZmZXJzIGNyZWF0ZWQgV2hlbiBNU0FBIGFuZCBNUlQgYXJlIHVzZWQgdG9nZXRoZXIsIG9uZSBmb3IgZWFjaCBjb2xvciBidWZmZXIuXG4gICAgICogVGhpcyBhbGxvd3MgY29sb3IgYnVmZmVycyB0byBiZSByZXNvbHZlZCBzZXBhcmF0ZWx5LlxuICAgICAqXG4gICAgICogQHR5cGUge0ZyYW1lYnVmZmVyUGFpcltdfVxuICAgICAqL1xuICAgIGNvbG9yTXJ0RnJhbWVidWZmZXJzID0gbnVsbDtcblxuICAgIF9nbE1zYWFDb2xvckJ1ZmZlcnMgPSBbXTtcblxuICAgIF9nbE1zYWFEZXB0aEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3VwcGxpZWQgc2luZ2xlLXNhbXBsZWQgZnJhbWVidWZmZXIgZm9yIHJlbmRlcmluZy4gVW5kZWZpbmVkIHJlcHJlc2VudHMgbm8gc3VwcGxpZWRcbiAgICAgKiBmcmFtZWJ1ZmZlci4gTnVsbCByZXByZXNlbnRzIHRoZSBkZWZhdWx0IGZyYW1lYnVmZmVyLiBBIHZhbHVlIHJlcHJlc2VudHMgYSB1c2VyLXN1cHBsaWVkXG4gICAgICogZnJhbWVidWZmZXIuXG4gICAgICovXG4gICAgc3VwcGxpZWRDb2xvckZyYW1lYnVmZmVyO1xuXG4gICAgX2lzSW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX2dsRnJhbWVCdWZmZXIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9nbEZyYW1lQnVmZmVyICE9PSB0aGlzLnN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlcilcbiAgICAgICAgICAgICAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIHRoaXMuX2dsRnJhbWVCdWZmZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2dsRGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcih0aGlzLl9nbERlcHRoQnVmZmVyKTtcbiAgICAgICAgICAgIHRoaXMuX2dsRGVwdGhCdWZmZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2dsUmVzb2x2ZUZyYW1lQnVmZmVyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZ2xSZXNvbHZlRnJhbWVCdWZmZXIgIT09IHRoaXMuc3VwcGxpZWRDb2xvckZyYW1lYnVmZmVyKVxuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuX2dsUmVzb2x2ZUZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIHRoaXMuX2dsUmVzb2x2ZUZyYW1lQnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2dsTXNhYUNvbG9yQnVmZmVycy5mb3JFYWNoKChidWZmZXIpID0+IHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcihidWZmZXIpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZ2xNc2FhQ29sb3JCdWZmZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgdGhpcy5jb2xvck1ydEZyYW1lYnVmZmVycz8uZm9yRWFjaCgoZnJhbWVidWZmZXIpID0+IHtcbiAgICAgICAgICAgIGZyYW1lYnVmZmVyLmRlc3Ryb3koZ2wpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb2xvck1ydEZyYW1lYnVmZmVycyA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2dsTXNhYURlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVSZW5kZXJidWZmZXIodGhpcy5fZ2xNc2FhRGVwdGhCdWZmZXIpO1xuICAgICAgICAgICAgdGhpcy5fZ2xNc2FhRGVwdGhCdWZmZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3VwcGxpZWRDb2xvckZyYW1lYnVmZmVyID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGdldCBpbml0aWFsaXplZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzSW5pdGlhbGl6ZWQ7XG4gICAgfVxuXG4gICAgaW5pdChkZXZpY2UsIHRhcmdldCkge1xuICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcblxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgYnVmZmVycyA9IFtdO1xuXG4gICAgICAgIGlmICh0aGlzLnN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlciAhPT0gdW5kZWZpbmVkKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2dsRnJhbWVCdWZmZXIgPSB0aGlzLnN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlcjtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyAjIyMjIyBDcmVhdGUgbWFpbiBGQk8gIyMjIyNcbiAgICAgICAgICAgIHRoaXMuX2dsRnJhbWVCdWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgICAgICAgICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHRoaXMuX2dsRnJhbWVCdWZmZXIpO1xuXG4gICAgICAgICAgICAvLyAtLS0gSW5pdCB0aGUgcHJvdmlkZWQgY29sb3IgYnVmZmVyIChvcHRpb25hbCkgLS0tXG4gICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlckNvdW50ID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcnM/Lmxlbmd0aCA/PyAwO1xuICAgICAgICAgICAgY29uc3QgYXR0YWNobWVudEJhc2VDb25zdGFudCA9IGRldmljZS5pc1dlYkdMMiA/IGdsLkNPTE9SX0FUVEFDSE1FTlQwIDogKGRldmljZS5leHREcmF3QnVmZmVycz8uQ09MT1JfQVRUQUNITUVOVDBfV0VCR0wgPz8gZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2xvckJ1ZmZlckNvdW50OyArK2kpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRhcmdldC5nZXRDb2xvckJ1ZmZlcihpKTtcbiAgICAgICAgICAgICAgICBpZiAoY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENsYW1wIHRoZSByZW5kZXIgYnVmZmVyIHNpemUgdG8gdGhlIG1heGltdW0gc3VwcG9ydGVkIGJ5IHRoZSBkZXZpY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLl93aWR0aCA9IE1hdGgubWluKGNvbG9yQnVmZmVyLndpZHRoLCBkZXZpY2UubWF4UmVuZGVyQnVmZmVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlci5faGVpZ2h0ID0gTWF0aC5taW4oY29sb3JCdWZmZXIuaGVpZ2h0LCBkZXZpY2UubWF4UmVuZGVyQnVmZmVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VGV4dHVyZShjb2xvckJ1ZmZlciwgMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gQXR0YWNoIHRoZSBjb2xvciBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5GUkFNRUJVRkZFUixcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRCYXNlQ29uc3RhbnQgKyBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXIuX2N1YmVtYXAgPyBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyB0YXJnZXQuX2ZhY2UgOiBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXIuaW1wbC5fZ2xUZXh0dXJlLFxuICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlcnMucHVzaChhdHRhY2htZW50QmFzZUNvbnN0YW50ICsgaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGV2aWNlLmRyYXdCdWZmZXJzKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXdCdWZmZXJzKGJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkZXB0aEJ1ZmZlciA9IHRhcmdldC5fZGVwdGhCdWZmZXI7XG4gICAgICAgICAgICBpZiAoZGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAvLyAtLS0gSW5pdCB0aGUgcHJvdmlkZWQgZGVwdGgvc3RlbmNpbCBidWZmZXIgKG9wdGlvbmFsLCBXZWJHTDIgb25seSkgLS0tXG4gICAgICAgICAgICAgICAgaWYgKCFkZXB0aEJ1ZmZlci5pbXBsLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2xhbXAgdGhlIHJlbmRlciBidWZmZXIgc2l6ZSB0byB0aGUgbWF4aW11bSBzdXBwb3J0ZWQgYnkgdGhlIGRldmljZVxuICAgICAgICAgICAgICAgICAgICBkZXB0aEJ1ZmZlci5fd2lkdGggPSBNYXRoLm1pbihkZXB0aEJ1ZmZlci53aWR0aCwgZGV2aWNlLm1heFJlbmRlckJ1ZmZlclNpemUpO1xuICAgICAgICAgICAgICAgICAgICBkZXB0aEJ1ZmZlci5faGVpZ2h0ID0gTWF0aC5taW4oZGVwdGhCdWZmZXIuaGVpZ2h0LCBkZXZpY2UubWF4UmVuZGVyQnVmZmVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRUZXh0dXJlKGRlcHRoQnVmZmVyLCAwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldC5fc3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuREVQVEhfU1RFTkNJTF9BVFRBQ0hNRU5ULFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXB0aEJ1ZmZlci5fY3ViZW1hcCA/IGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIHRhcmdldC5fZmFjZSA6IGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5fZGVwdGhCdWZmZXIuaW1wbC5fZ2xUZXh0dXJlLCAwKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuREVQVEhfQVRUQUNITUVOVCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVwdGhCdWZmZXIuX2N1YmVtYXAgPyBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyB0YXJnZXQuX2ZhY2UgOiBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQuX2RlcHRoQnVmZmVyLmltcGwuX2dsVGV4dHVyZSwgMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXQuX2RlcHRoKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tIEluaXQgYSBuZXcgZGVwdGgvc3RlbmNpbCBidWZmZXIgKG9wdGlvbmFsKSAtLS1cbiAgICAgICAgICAgICAgICAvLyBpZiBkZXZpY2UgaXMgYSBNU0FBIFJULCBhbmQgbm8gYnVmZmVyIHRvIHJlc29sdmUgdG8sIHNraXAgY3JlYXRpbmcgbm9uLU1TQUEgZGVwdGhcbiAgICAgICAgICAgICAgICBjb25zdCB3aWxsUmVuZGVyTXNhYSA9IHRhcmdldC5fc2FtcGxlcyA+IDEgJiYgZGV2aWNlLmlzV2ViR0wyO1xuICAgICAgICAgICAgICAgIGlmICghd2lsbFJlbmRlck1zYWEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9nbERlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbERlcHRoQnVmZmVyID0gZ2wuY3JlYXRlUmVuZGVyYnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZ2wuYmluZFJlbmRlcmJ1ZmZlcihnbC5SRU5ERVJCVUZGRVIsIHRoaXMuX2dsRGVwdGhCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Ll9zdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5yZW5kZXJidWZmZXJTdG9yYWdlKGdsLlJFTkRFUkJVRkZFUiwgZ2wuREVQVEhfU1RFTkNJTCwgdGFyZ2V0LndpZHRoLCB0YXJnZXQuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLmZyYW1lYnVmZmVyUmVuZGVyYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBnbC5ERVBUSF9TVEVOQ0lMX0FUVEFDSE1FTlQsIGdsLlJFTkRFUkJVRkZFUiwgdGhpcy5fZ2xEZXB0aEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXB0aEZvcm1hdCA9IGRldmljZS5pc1dlYkdMMiA/IGdsLkRFUFRIX0NPTVBPTkVOVDMyRiA6IGdsLkRFUFRIX0NPTVBPTkVOVDE2O1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wucmVuZGVyYnVmZmVyU3RvcmFnZShnbC5SRU5ERVJCVUZGRVIsIGRlcHRoRm9ybWF0LCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuZnJhbWVidWZmZXJSZW5kZXJidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGdsLkRFUFRIX0FUVEFDSE1FTlQsIGdsLlJFTkRFUkJVRkZFUiwgdGhpcy5fZ2xEZXB0aEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZ2wuYmluZFJlbmRlcmJ1ZmZlcihnbC5SRU5ERVJCVUZGRVIsIG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB0aGlzLl9jaGVja0ZibyhkZXZpY2UsIHRhcmdldCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIyMjIyMgQ3JlYXRlIE1TQUEgRkJPIChXZWJHTDIgb25seSkgIyMjIyNcbiAgICAgICAgaWYgKGRldmljZS5pc1dlYkdMMiAmJiB0YXJnZXQuX3NhbXBsZXMgPiAxKSB7XG5cbiAgICAgICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQud2lkdGggPD0gMCB8fCB0YXJnZXQuaGVpZ2h0IDw9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEludmFsaWQgcmVuZGVyIHRhcmdldCBzaXplOiAke3RhcmdldC53aWR0aH0geCAke3RhcmdldC5oZWlnaHR9YCwgdGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gVXNlIHByZXZpb3VzIEZCTyBmb3IgcmVzb2x2ZXNcbiAgICAgICAgICAgIHRoaXMuX2dsUmVzb2x2ZUZyYW1lQnVmZmVyID0gdGhpcy5fZ2xGcmFtZUJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gQWN0dWFsIEZCTyB3aWxsIGJlIE1TQUFcbiAgICAgICAgICAgIHRoaXMuX2dsRnJhbWVCdWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgICAgICAgICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHRoaXMuX2dsRnJhbWVCdWZmZXIpO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYW4gb3B0aW9uYWwgTVNBQSBjb2xvciBidWZmZXJzXG4gICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlckNvdW50ID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcnM/Lmxlbmd0aCA/PyAwO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5zdXBwbGllZENvbG9yRnJhbWVidWZmZXIgIT09IHVuZGVmaW5lZCkge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZ2wuY3JlYXRlUmVuZGVyYnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xNc2FhQ29sb3JCdWZmZXJzLnB1c2goYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGludGVybmFsRm9ybWF0ID0gZGV2aWNlLmJhY2tCdWZmZXJGb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE4ID8gZ2wuUkdCQTggOiBnbC5SR0I4O1xuXG4gICAgICAgICAgICAgICAgZ2wuYmluZFJlbmRlcmJ1ZmZlcihnbC5SRU5ERVJCVUZGRVIsIGJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgZ2wucmVuZGVyYnVmZmVyU3RvcmFnZU11bHRpc2FtcGxlKGdsLlJFTkRFUkJVRkZFUiwgdGFyZ2V0Ll9zYW1wbGVzLCBpbnRlcm5hbEZvcm1hdCwgdGFyZ2V0LndpZHRoLCB0YXJnZXQuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlJFTkRFUkJVRkZFUiwgYnVmZmVyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JCdWZmZXJDb3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0LmdldENvbG9yQnVmZmVyKGkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGdsLmNyZWF0ZVJlbmRlcmJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xNc2FhQ29sb3JCdWZmZXJzLnB1c2goYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuYmluZFJlbmRlcmJ1ZmZlcihnbC5SRU5ERVJCVUZGRVIsIGJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5yZW5kZXJidWZmZXJTdG9yYWdlTXVsdGlzYW1wbGUoZ2wuUkVOREVSQlVGRkVSLCB0YXJnZXQuX3NhbXBsZXMsIGNvbG9yQnVmZmVyLmltcGwuX2dsSW50ZXJuYWxGb3JtYXQsIHRhcmdldC53aWR0aCwgdGFyZ2V0LmhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAgKyBpLCBnbC5SRU5ERVJCVUZGRVIsIGJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHkgYWRkIGEgTVNBQSBkZXB0aC9zdGVuY2lsIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKHRhcmdldC5fZGVwdGgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2dsTXNhYURlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsTXNhYURlcHRoQnVmZmVyID0gZ2wuY3JlYXRlUmVuZGVyYnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCB0aGlzLl9nbE1zYWFEZXB0aEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldC5fc3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5yZW5kZXJidWZmZXJTdG9yYWdlTXVsdGlzYW1wbGUoZ2wuUkVOREVSQlVGRkVSLCB0YXJnZXQuX3NhbXBsZXMsIGdsLkRFUFRIMjRfU1RFTkNJTDgsIHRhcmdldC53aWR0aCwgdGFyZ2V0LmhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGdsLmZyYW1lYnVmZmVyUmVuZGVyYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBnbC5ERVBUSF9TVEVOQ0lMX0FUVEFDSE1FTlQsIGdsLlJFTkRFUkJVRkZFUiwgdGhpcy5fZ2xNc2FhRGVwdGhCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLnJlbmRlcmJ1ZmZlclN0b3JhZ2VNdWx0aXNhbXBsZShnbC5SRU5ERVJCVUZGRVIsIHRhcmdldC5fc2FtcGxlcywgZ2wuREVQVEhfQ09NUE9ORU5UMzJGLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuREVQVEhfQVRUQUNITUVOVCwgZ2wuUkVOREVSQlVGRkVSLCB0aGlzLl9nbE1zYWFEZXB0aEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHRoaXMuX2NoZWNrRmJvKGRldmljZSwgdGFyZ2V0LCAnTVNBQScpKTtcblxuICAgICAgICAgICAgaWYgKGNvbG9yQnVmZmVyQ291bnQgPiAxKSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIGZyYW1lYnVmZmVycyBhbGxvd2luZyB1cyB0byBpbmRpdmlkdWFsbHkgcmVzb2x2ZSBlYWNoIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZU1zYWFNcnRGcmFtZWJ1ZmZlcnMoZGV2aWNlLCB0YXJnZXQsIGNvbG9yQnVmZmVyQ291bnQpO1xuXG4gICAgICAgICAgICAgICAgLy8gcmVzdG9yZSByZW5kZXJpbmcgYmFjayB0byB0aGUgbWFpbiBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcih0aGlzLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhd0J1ZmZlcnMoYnVmZmVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY3JlYXRlTXNhYU1ydEZyYW1lYnVmZmVycyhkZXZpY2UsIHRhcmdldCwgY29sb3JCdWZmZXJDb3VudCkge1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICB0aGlzLmNvbG9yTXJ0RnJhbWVidWZmZXJzID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2xvckJ1ZmZlckNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0LmdldENvbG9yQnVmZmVyKGkpO1xuXG4gICAgICAgICAgICAvLyBzcmNcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihzcmNGcmFtZWJ1ZmZlcik7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSB0aGlzLl9nbE1zYWFDb2xvckJ1ZmZlcnNbaV07XG5cbiAgICAgICAgICAgIGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCBidWZmZXIpO1xuICAgICAgICAgICAgZ2wucmVuZGVyYnVmZmVyU3RvcmFnZU11bHRpc2FtcGxlKGdsLlJFTkRFUkJVRkZFUiwgdGFyZ2V0Ll9zYW1wbGVzLCBjb2xvckJ1ZmZlci5pbXBsLl9nbEludGVybmFsRm9ybWF0LCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQpO1xuICAgICAgICAgICAgZ2wuZnJhbWVidWZmZXJSZW5kZXJidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5SRU5ERVJCVUZGRVIsIGJ1ZmZlcik7XG5cbiAgICAgICAgICAgIGRldmljZS5kcmF3QnVmZmVycyhbZ2wuQ09MT1JfQVRUQUNITUVOVDBdKTtcblxuICAgICAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB0aGlzLl9jaGVja0ZibyhkZXZpY2UsIHRhcmdldCwgYE1TQUEtTVJULXNyYyR7aX1gKSk7XG5cbiAgICAgICAgICAgIC8vIGRzdFxuICAgICAgICAgICAgY29uc3QgZHN0RnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgICAgICAgICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKGRzdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLl9jdWJlbWFwID8gZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgdGFyZ2V0Ll9mYWNlIDogZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDBcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHRoaXMuY29sb3JNcnRGcmFtZWJ1ZmZlcnNbaV0gPSBuZXcgRnJhbWVidWZmZXJQYWlyKHNyY0ZyYW1lYnVmZmVyLCBkc3RGcmFtZWJ1ZmZlcik7XG5cbiAgICAgICAgICAgIERlYnVnLmNhbGwoKCkgPT4gdGhpcy5fY2hlY2tGYm8oZGV2aWNlLCB0YXJnZXQsIGBNU0FBLU1SVC1kc3Qke2l9YCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHRoZSBjb21wbGV0ZW5lc3Mgc3RhdHVzIG9mIHRoZSBjdXJyZW50bHkgYm91bmQgV2ViR0xGcmFtZWJ1ZmZlciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jaGVja0ZibyhkZXZpY2UsIHRhcmdldCwgdHlwZSA9ICcnKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKTtcbiAgICAgICAgbGV0IGVycm9yQ29kZTtcbiAgICAgICAgc3dpdGNoIChzdGF0dXMpIHtcbiAgICAgICAgICAgIGNhc2UgZ2wuRlJBTUVCVUZGRVJfSU5DT01QTEVURV9BVFRBQ0hNRU5UOlxuICAgICAgICAgICAgICAgIGVycm9yQ29kZSA9ICdGUkFNRUJVRkZFUl9JTkNPTVBMRVRFX0FUVEFDSE1FTlQnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBnbC5GUkFNRUJVRkZFUl9JTkNPTVBMRVRFX01JU1NJTkdfQVRUQUNITUVOVDpcbiAgICAgICAgICAgICAgICBlcnJvckNvZGUgPSAnRlJBTUVCVUZGRVJfSU5DT01QTEVURV9NSVNTSU5HX0FUVEFDSE1FTlQnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBnbC5GUkFNRUJVRkZFUl9JTkNPTVBMRVRFX0RJTUVOU0lPTlM6XG4gICAgICAgICAgICAgICAgZXJyb3JDb2RlID0gJ0ZSQU1FQlVGRkVSX0lOQ09NUExFVEVfRElNRU5TSU9OUyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIGdsLkZSQU1FQlVGRkVSX1VOU1VQUE9SVEVEOlxuICAgICAgICAgICAgICAgIGVycm9yQ29kZSA9ICdGUkFNRUJVRkZFUl9VTlNVUFBPUlRFRCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoIWVycm9yQ29kZSwgYEZyYW1lYnVmZmVyIGNyZWF0aW9uIGZhaWxlZCB3aXRoIGVycm9yIGNvZGUgJHtlcnJvckNvZGV9LCByZW5kZXIgdGFyZ2V0OiAke3RhcmdldC5uYW1lfSAke3R5cGV9YCwgdGFyZ2V0KTtcbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5fZ2xGcmFtZUJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX2dsRGVwdGhCdWZmZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9nbFJlc29sdmVGcmFtZUJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX2dsTXNhYUNvbG9yQnVmZmVycy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9nbE1zYWFEZXB0aEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMuY29sb3JNcnRGcmFtZWJ1ZmZlcnMgPSBudWxsO1xuICAgICAgICB0aGlzLnN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIGludGVybmFsUmVzb2x2ZShkZXZpY2UsIHNyYywgZHN0LCB0YXJnZXQsIG1hc2spIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoc3JjICE9PSBkc3QsICdTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYW1lYnVmZmVycyBtdXN0IGJlIGRpZmZlcmVudCB3aGVuIGJsaXR0aW5nLicpO1xuXG4gICAgICAgIC8vIGJsaXQgaXMgYWZmZWN0ZWQgYnkgc2Npc3NvciB0ZXN0LCBzbyBtYWtlIGl0IGZ1bGwgc2l6ZVxuICAgICAgICBkZXZpY2Uuc2V0U2Npc3NvcigwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgc3JjKTtcbiAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGRzdCk7XG4gICAgICAgIGdsLmJsaXRGcmFtZWJ1ZmZlcigwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBtYXNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuTkVBUkVTVCk7XG4gICAgfVxuXG4gICAgcmVzb2x2ZShkZXZpY2UsIHRhcmdldCwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDIpIHtcblxuICAgICAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgICAgIC8vIGlmIE1SVCBpcyB1c2VkLCB3ZSBuZWVkIHRvIHJlc29sdmUgZWFjaCBidWZmZXIgaW5kaXZpZHVhbGx5XG4gICAgICAgICAgICBpZiAodGhpcy5jb2xvck1ydEZyYW1lYnVmZmVycykge1xuXG4gICAgICAgICAgICAgICAgLy8gY29sb3JcbiAgICAgICAgICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbG9yTXJ0RnJhbWVidWZmZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmYlBhaXIgPSB0aGlzLmNvbG9yTXJ0RnJhbWVidWZmZXJzW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgUkVTT0xWRS1NUlQke2l9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmludGVybmFsUmVzb2x2ZShkZXZpY2UsIGZiUGFpci5tc2FhRkIsIGZiUGFpci5yZXNvbHZlRkIsIHRhcmdldCwgZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZGVwdGhcbiAgICAgICAgICAgICAgICBpZiAoZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFJFU09MVkUtTVJULURFUFRIYCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxSZXNvbHZlKGRldmljZSwgdGhpcy5fZ2xGcmFtZUJ1ZmZlciwgdGhpcy5fZ2xSZXNvbHZlRnJhbWVCdWZmZXIsIHRhcmdldCwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBSRVNPTFZFYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFJlc29sdmUoZGV2aWNlLCB0aGlzLl9nbEZyYW1lQnVmZmVyLCB0aGlzLl9nbFJlc29sdmVGcmFtZUJ1ZmZlciwgdGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjb2xvciA/IGdsLkNPTE9SX0JVRkZFUl9CSVQgOiAwKSB8IChkZXB0aCA/IGdsLkRFUFRIX0JVRkZFUl9CSVQgOiAwKSk7XG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfTtcbiJdLCJuYW1lcyI6WyJGcmFtZWJ1ZmZlclBhaXIiLCJjb25zdHJ1Y3RvciIsIm1zYWFGQiIsInJlc29sdmVGQiIsImRlc3Ryb3kiLCJnbCIsImRlbGV0ZVJlbmRlcmJ1ZmZlciIsIldlYmdsUmVuZGVyVGFyZ2V0IiwiX2dsRnJhbWVCdWZmZXIiLCJfZ2xEZXB0aEJ1ZmZlciIsIl9nbFJlc29sdmVGcmFtZUJ1ZmZlciIsImNvbG9yTXJ0RnJhbWVidWZmZXJzIiwiX2dsTXNhYUNvbG9yQnVmZmVycyIsIl9nbE1zYWFEZXB0aEJ1ZmZlciIsInN1cHBsaWVkQ29sb3JGcmFtZWJ1ZmZlciIsIl9pc0luaXRpYWxpemVkIiwiZGV2aWNlIiwiX3RoaXMkY29sb3JNcnRGcmFtZWJ1IiwiZGVsZXRlRnJhbWVidWZmZXIiLCJmb3JFYWNoIiwiYnVmZmVyIiwibGVuZ3RoIiwiZnJhbWVidWZmZXIiLCJ1bmRlZmluZWQiLCJpbml0aWFsaXplZCIsImluaXQiLCJ0YXJnZXQiLCJidWZmZXJzIiwiX3RhcmdldCRfY29sb3JCdWZmZXJzIiwiX3RhcmdldCRfY29sb3JCdWZmZXJzMiIsIl9kZXZpY2UkZXh0RHJhd0J1ZmZlciIsIl9kZXZpY2UkZXh0RHJhd0J1ZmZlcjIiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsInNldEZyYW1lYnVmZmVyIiwiY29sb3JCdWZmZXJDb3VudCIsIl9jb2xvckJ1ZmZlcnMiLCJhdHRhY2htZW50QmFzZUNvbnN0YW50IiwiaXNXZWJHTDIiLCJDT0xPUl9BVFRBQ0hNRU5UMCIsImV4dERyYXdCdWZmZXJzIiwiQ09MT1JfQVRUQUNITUVOVDBfV0VCR0wiLCJpIiwiY29sb3JCdWZmZXIiLCJnZXRDb2xvckJ1ZmZlciIsImltcGwiLCJfZ2xUZXh0dXJlIiwiX3dpZHRoIiwiTWF0aCIsIm1pbiIsIndpZHRoIiwibWF4UmVuZGVyQnVmZmVyU2l6ZSIsIl9oZWlnaHQiLCJoZWlnaHQiLCJzZXRUZXh0dXJlIiwiZnJhbWVidWZmZXJUZXh0dXJlMkQiLCJGUkFNRUJVRkZFUiIsIl9jdWJlbWFwIiwiVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YIiwiX2ZhY2UiLCJURVhUVVJFXzJEIiwicHVzaCIsImRyYXdCdWZmZXJzIiwiZGVwdGhCdWZmZXIiLCJfZGVwdGhCdWZmZXIiLCJfc3RlbmNpbCIsIkRFUFRIX1NURU5DSUxfQVRUQUNITUVOVCIsIkRFUFRIX0FUVEFDSE1FTlQiLCJfZGVwdGgiLCJ3aWxsUmVuZGVyTXNhYSIsIl9zYW1wbGVzIiwiY3JlYXRlUmVuZGVyYnVmZmVyIiwiYmluZFJlbmRlcmJ1ZmZlciIsIlJFTkRFUkJVRkZFUiIsInJlbmRlcmJ1ZmZlclN0b3JhZ2UiLCJERVBUSF9TVEVOQ0lMIiwiZnJhbWVidWZmZXJSZW5kZXJidWZmZXIiLCJkZXB0aEZvcm1hdCIsIkRFUFRIX0NPTVBPTkVOVDMyRiIsIkRFUFRIX0NPTVBPTkVOVDE2IiwiRGVidWciLCJjYWxsIiwiX2NoZWNrRmJvIiwiX3RhcmdldCRfY29sb3JCdWZmZXJzMyIsIl90YXJnZXQkX2NvbG9yQnVmZmVyczQiLCJ3YXJuT25jZSIsImludGVybmFsRm9ybWF0IiwiYmFja0J1ZmZlckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUkdCQTgiLCJSR0I4IiwicmVuZGVyYnVmZmVyU3RvcmFnZU11bHRpc2FtcGxlIiwiX2dsSW50ZXJuYWxGb3JtYXQiLCJERVBUSDI0X1NURU5DSUw4IiwiX2NyZWF0ZU1zYWFNcnRGcmFtZWJ1ZmZlcnMiLCJzcmNGcmFtZWJ1ZmZlciIsImRzdEZyYW1lYnVmZmVyIiwidHlwZSIsInN0YXR1cyIsImNoZWNrRnJhbWVidWZmZXJTdGF0dXMiLCJlcnJvckNvZGUiLCJGUkFNRUJVRkZFUl9JTkNPTVBMRVRFX0FUVEFDSE1FTlQiLCJGUkFNRUJVRkZFUl9JTkNPTVBMRVRFX01JU1NJTkdfQVRUQUNITUVOVCIsIkZSQU1FQlVGRkVSX0lOQ09NUExFVEVfRElNRU5TSU9OUyIsIkZSQU1FQlVGRkVSX1VOU1VQUE9SVEVEIiwiYXNzZXJ0IiwibmFtZSIsImxvc2VDb250ZXh0IiwiaW50ZXJuYWxSZXNvbHZlIiwic3JjIiwiZHN0IiwibWFzayIsInNldFNjaXNzb3IiLCJiaW5kRnJhbWVidWZmZXIiLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsIk5FQVJFU1QiLCJyZXNvbHZlIiwiY29sb3IiLCJkZXB0aCIsImZiUGFpciIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiQ09MT1JfQlVGRkVSX0JJVCIsInBvcEdwdU1hcmtlciIsIkRFUFRIX0JVRkZFUl9CSVQiXSwibWFwcGluZ3MiOiI7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0FBT2xCQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLFNBQVMsRUFBRTtBQU4vQjtBQUFBLElBQUEsSUFBQSxDQUNBRCxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTjtBQUFBLElBQUEsSUFBQSxDQUNBQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFHTCxJQUFJLENBQUNELE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsU0FBUyxHQUFHQSxTQUFTLENB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
