import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { DebugGraphics } from '../../../platform/graphics/debug-graphics.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { LAYERID_DEPTH } from '../../../scene/constants.js';

class PostEffect {
  constructor(effect, inputTarget) {
    this.effect = effect;
    this.inputTarget = inputTarget;
    this.outputTarget = null;
    this.name = effect.constructor.name;
  }
}

/**
 * Used to manage multiple post effects for a camera.
 *
 * @category Graphics
 */
class PostEffectQueue {
  /**
   * Create a new PostEffectQueue instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @param {import('./component.js').CameraComponent} camera - The camera component.
   */
  constructor(app, camera) {
    this.app = app;
    this.camera = camera;

    /**
     * Render target where the postprocessed image needs to be rendered to. Defaults to null
     * which is main framebuffer.
     *
     * @type {RenderTarget}
     * @ignore
     */
    this.destinationRenderTarget = null;

    /**
     * All of the post effects in the queue.
     *
     * @type {PostEffect[]}
     * @ignore
     */
    this.effects = [];

    /**
     * If the queue is enabled it will render all of its effects, otherwise it will not render
     * anything.
     *
     * @type {boolean}
     * @ignore
     */
    this.enabled = false;

    // legacy
    this.depthTarget = null;
    camera.on('set:rect', this.onCameraRectChanged, this);
  }

  /**
   * Allocate a color buffer texture.
   *
   * @param {number} format - The format of the color buffer.
   * @param {string} name - The name of the color buffer.
   * @returns {Texture} The color buffer texture.
   * @private
   */
  _allocateColorBuffer(format, name) {
    var _renderTarget$width, _renderTarget$height;
    const rect = this.camera.rect;
    const renderTarget = this.destinationRenderTarget;
    const device = this.app.graphicsDevice;
    const width = Math.floor(rect.z * ((_renderTarget$width = renderTarget == null ? void 0 : renderTarget.width) != null ? _renderTarget$width : device.width));
    const height = Math.floor(rect.w * ((_renderTarget$height = renderTarget == null ? void 0 : renderTarget.height) != null ? _renderTarget$height : device.height));
    const colorBuffer = new Texture(device, {
      name: name,
      format: format,
      width: width,
      height: height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    return colorBuffer;
  }

  /**
   * Creates a render target with the dimensions of the canvas, with an optional depth buffer.
   *
   * @param {boolean} useDepth - Set to true to create a render target with a depth buffer.
   * @param {boolean} hdr - Use HDR render target format.
   * @returns {RenderTarget} The render target.
   * @private
   */
  _createOffscreenTarget(useDepth, hdr) {
    const device = this.app.graphicsDevice;
    const format = hdr && device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true) || PIXELFORMAT_RGBA8;
    const name = this.camera.entity.name + '-posteffect-' + this.effects.length;
    const colorBuffer = this._allocateColorBuffer(format, name);
    return new RenderTarget({
      colorBuffer: colorBuffer,
      depth: useDepth,
      stencil: useDepth && this.app.graphicsDevice.supportsStencil,
      samples: useDepth ? device.samples : 1
    });
  }
  _resizeOffscreenTarget(rt) {
    const format = rt.colorBuffer.format;
    const name = rt.colorBuffer.name;
    rt.destroyFrameBuffers();
    rt.destroyTextureBuffers();
    rt._colorBuffer = this._allocateColorBuffer(format, name);
    rt._colorBuffers = [rt._colorBuffer];
  }
  _destroyOffscreenTarget(rt) {
    rt.destroyTextureBuffers();
    rt.destroy();
  }

  /**
   * Adds a post effect to the queue. If the queue is disabled adding a post effect will
   * automatically enable the queue.
   *
   * @param {PostEffect} effect - The post effect to add to the queue.
   */
  addEffect(effect) {
    // first rendering of the scene requires depth buffer
    const effects = this.effects;
    const isFirstEffect = effects.length === 0;
    const inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
    const newEntry = new PostEffect(effect, inputTarget);
    effects.push(newEntry);
    this._sourceTarget = newEntry.inputTarget;

    // connect the effect with the previous effect if one exists
    if (effects.length > 1) {
      effects[effects.length - 2].outputTarget = newEntry.inputTarget;
    }

    // Request depthmap if needed
    this._newPostEffect = effect;
    if (effect.needsDepthBuffer) {
      this._requestDepthMap();
    }
    this.enable();
    this._newPostEffect = undefined;
  }

  /**
   * Removes a post effect from the queue. If the queue becomes empty it will be disabled
   * automatically.
   *
   * @param {PostEffect} effect - The post effect to remove.
   */
  removeEffect(effect) {
    // find index of effect
    let index = -1;
    for (let i = 0, len = this.effects.length; i < len; i++) {
      if (this.effects[i].effect === effect) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      if (index > 0) {
        // connect the previous effect with the effect after the one we're about to remove
        this.effects[index - 1].outputTarget = index + 1 < this.effects.length ? this.effects[index + 1].inputTarget : null;
      } else {
        if (this.effects.length > 1) {
          // if we removed the first effect then make sure that
          // the input render target of the effect that will now become the first one
          // has a depth buffer
          if (!this.effects[1].inputTarget._depth) {
            this._destroyOffscreenTarget(this.effects[1].inputTarget);
            this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
            this._sourceTarget = this.effects[1].inputTarget;
          }
          this.camera.renderTarget = this.effects[1].inputTarget;
        }
      }

      // release memory for removed effect
      this._destroyOffscreenTarget(this.effects[index].inputTarget);
      this.effects.splice(index, 1);
    }
    if (this.enabled) {
      if (effect.needsDepthBuffer) {
        this._releaseDepthMap();
      }
    }
    if (this.effects.length === 0) {
      this.disable();
    }
  }
  _requestDepthMaps() {
    for (let i = 0, len = this.effects.length; i < len; i++) {
      const effect = this.effects[i].effect;
      if (this._newPostEffect === effect) continue;
      if (effect.needsDepthBuffer) {
        this._requestDepthMap();
      }
    }
  }
  _releaseDepthMaps() {
    for (let i = 0, len = this.effects.length; i < len; i++) {
      const effect = this.effects[i].effect;
      if (effect.needsDepthBuffer) {
        this._releaseDepthMap();
      }
    }
  }
  _requestDepthMap() {
    const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.incrementCounter();
      this.camera.requestSceneDepthMap(true);
    }
  }
  _releaseDepthMap() {
    const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.decrementCounter();
      this.camera.requestSceneDepthMap(false);
    }
  }

  /**
   * Removes all the effects from the queue and disables it.
   */
  destroy() {
    // release memory for all effects
    for (let i = 0, len = this.effects.length; i < len; i++) {
      this.effects[i].inputTarget.destroy();
    }
    this.effects.length = 0;
    this.disable();
  }

  /**
   * Enables the queue and all of its effects. If there are no effects then the queue will not be
   * enabled.
   */
  enable() {
    if (!this.enabled && this.effects.length) {
      this.enabled = true;
      this._requestDepthMaps();
      this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

      // original camera's render target is where the final output needs to go
      this.destinationRenderTarget = this.camera.renderTarget;

      // camera renders to the first effect's render target
      this.camera.renderTarget = this.effects[0].inputTarget;

      // callback when postprocessing takes place
      this.camera.onPostprocessing = () => {
        if (this.enabled) {
          let rect = null;
          const len = this.effects.length;
          if (len) {
            for (let i = 0; i < len; i++) {
              const fx = this.effects[i];
              let destTarget = fx.outputTarget;

              // last effect
              if (i === len - 1) {
                rect = this.camera.rect;

                // if camera originally rendered to a render target, render last effect to it
                if (this.destinationRenderTarget) {
                  destTarget = this.destinationRenderTarget;
                }
              }
              DebugGraphics.pushGpuMarker(this.app.graphicsDevice, fx.name);
              fx.effect.render(fx.inputTarget, destTarget, rect);
              DebugGraphics.popGpuMarker(this.app.graphicsDevice);
            }
          }
        }
      };
    }
  }

  /**
   * Disables the queue and all of its effects.
   */
  disable() {
    if (this.enabled) {
      this.enabled = false;
      this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);
      this._releaseDepthMaps();
      this._destroyOffscreenTarget(this._sourceTarget);
      this.camera.renderTarget = null;
      this.camera.onPostprocessing = null;
    }
  }

  /**
   * Handler called when the application's canvas element is resized.
   *
   * @param {number} width - The new width of the canvas.
   * @param {number} height - The new height of the canvas.
   * @private
   */
  _onCanvasResized(width, height) {
    var _renderTarget$width2, _renderTarget$height2;
    const rect = this.camera.rect;
    const renderTarget = this.destinationRenderTarget;
    width = (_renderTarget$width2 = renderTarget == null ? void 0 : renderTarget.width) != null ? _renderTarget$width2 : width;
    height = (_renderTarget$height2 = renderTarget == null ? void 0 : renderTarget.height) != null ? _renderTarget$height2 : height;
    this.camera.camera.aspectRatio = width * rect.z / (height * rect.w);
    this.resizeRenderTargets();
  }
  resizeRenderTargets() {
    var _renderTarget$width3, _renderTarget$height3;
    const device = this.app.graphicsDevice;
    const renderTarget = this.destinationRenderTarget;
    const width = (_renderTarget$width3 = renderTarget == null ? void 0 : renderTarget.width) != null ? _renderTarget$width3 : device.width;
    const height = (_renderTarget$height3 = renderTarget == null ? void 0 : renderTarget.height) != null ? _renderTarget$height3 : device.height;
    const rect = this.camera.rect;
    const desiredWidth = Math.floor(rect.z * width);
    const desiredHeight = Math.floor(rect.w * height);
    const effects = this.effects;
    for (let i = 0, len = effects.length; i < len; i++) {
      const fx = effects[i];
      if (fx.inputTarget.width !== desiredWidth || fx.inputTarget.height !== desiredHeight) {
        this._resizeOffscreenTarget(fx.inputTarget);
      }
    }
  }
  onCameraRectChanged(name, oldValue, newValue) {
    if (this.enabled) {
      this.resizeRenderTargets();
    }
  }
}

export { PostEffectQueue };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdC1lZmZlY3QtcXVldWUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvcG9zdC1lZmZlY3QtcXVldWUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQUREUkVTU19DTEFNUF9UT19FREdFLCBGSUxURVJfTkVBUkVTVCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRiwgUElYRUxGT1JNQVRfUkdCQTggfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuY2xhc3MgUG9zdEVmZmVjdCB7XG4gICAgY29uc3RydWN0b3IoZWZmZWN0LCBpbnB1dFRhcmdldCkge1xuICAgICAgICB0aGlzLmVmZmVjdCA9IGVmZmVjdDtcbiAgICAgICAgdGhpcy5pbnB1dFRhcmdldCA9IGlucHV0VGFyZ2V0O1xuICAgICAgICB0aGlzLm91dHB1dFRhcmdldCA9IG51bGw7XG4gICAgICAgIHRoaXMubmFtZSA9IGVmZmVjdC5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbn1cblxuLyoqXG4gKiBVc2VkIHRvIG1hbmFnZSBtdWx0aXBsZSBwb3N0IGVmZmVjdHMgZm9yIGEgY2FtZXJhLlxuICpcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5jbGFzcyBQb3N0RWZmZWN0UXVldWUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBQb3N0RWZmZWN0UXVldWUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgY2FtZXJhIGNvbXBvbmVudC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHAsIGNhbWVyYSkge1xuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbmRlciB0YXJnZXQgd2hlcmUgdGhlIHBvc3Rwcm9jZXNzZWQgaW1hZ2UgbmVlZHMgdG8gYmUgcmVuZGVyZWQgdG8uIERlZmF1bHRzIHRvIG51bGxcbiAgICAgICAgICogd2hpY2ggaXMgbWFpbiBmcmFtZWJ1ZmZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1JlbmRlclRhcmdldH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kZXN0aW5hdGlvblJlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFsbCBvZiB0aGUgcG9zdCBlZmZlY3RzIGluIHRoZSBxdWV1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1Bvc3RFZmZlY3RbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lZmZlY3RzID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIHRoZSBxdWV1ZSBpcyBlbmFibGVkIGl0IHdpbGwgcmVuZGVyIGFsbCBvZiBpdHMgZWZmZWN0cywgb3RoZXJ3aXNlIGl0IHdpbGwgbm90IHJlbmRlclxuICAgICAgICAgKiBhbnl0aGluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGxlZ2FjeVxuICAgICAgICB0aGlzLmRlcHRoVGFyZ2V0ID0gbnVsbDtcblxuICAgICAgICBjYW1lcmEub24oJ3NldDpyZWN0JywgdGhpcy5vbkNhbWVyYVJlY3RDaGFuZ2VkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbGxvY2F0ZSBhIGNvbG9yIGJ1ZmZlciB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvcm1hdCAtIFRoZSBmb3JtYXQgb2YgdGhlIGNvbG9yIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjb2xvciBidWZmZXIuXG4gICAgICogQHJldHVybnMge1RleHR1cmV9IFRoZSBjb2xvciBidWZmZXIgdGV4dHVyZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hbGxvY2F0ZUNvbG9yQnVmZmVyKGZvcm1hdCwgbmFtZSkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5jYW1lcmEucmVjdDtcbiAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0ID0gdGhpcy5kZXN0aW5hdGlvblJlbmRlclRhcmdldDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgY29uc3Qgd2lkdGggPSBNYXRoLmZsb29yKHJlY3QueiAqIChyZW5kZXJUYXJnZXQ/LndpZHRoID8/IGRldmljZS53aWR0aCkpO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLmZsb29yKHJlY3QudyAqIChyZW5kZXJUYXJnZXQ/LmhlaWdodCA/PyBkZXZpY2UuaGVpZ2h0KSk7XG5cbiAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBmb3JtYXQ6IGZvcm1hdCxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgcmVuZGVyIHRhcmdldCB3aXRoIHRoZSBkaW1lbnNpb25zIG9mIHRoZSBjYW52YXMsIHdpdGggYW4gb3B0aW9uYWwgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1c2VEZXB0aCAtIFNldCB0byB0cnVlIHRvIGNyZWF0ZSBhIHJlbmRlciB0YXJnZXQgd2l0aCBhIGRlcHRoIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGhkciAtIFVzZSBIRFIgcmVuZGVyIHRhcmdldCBmb3JtYXQuXG4gICAgICogQHJldHVybnMge1JlbmRlclRhcmdldH0gVGhlIHJlbmRlciB0YXJnZXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3JlYXRlT2Zmc2NyZWVuVGFyZ2V0KHVzZURlcHRoLCBoZHIpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgZm9ybWF0ID0gaGRyICYmIGRldmljZS5nZXRSZW5kZXJhYmxlSGRyRm9ybWF0KFtQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0JBMzJGXSwgdHJ1ZSkgfHwgUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmNhbWVyYS5lbnRpdHkubmFtZSArICctcG9zdGVmZmVjdC0nICsgdGhpcy5lZmZlY3RzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRoaXMuX2FsbG9jYXRlQ29sb3JCdWZmZXIoZm9ybWF0LCBuYW1lKTtcblxuICAgICAgICByZXR1cm4gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICBjb2xvckJ1ZmZlcjogY29sb3JCdWZmZXIsXG4gICAgICAgICAgICBkZXB0aDogdXNlRGVwdGgsXG4gICAgICAgICAgICBzdGVuY2lsOiB1c2VEZXB0aCAmJiB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5zdXBwb3J0c1N0ZW5jaWwsXG4gICAgICAgICAgICBzYW1wbGVzOiB1c2VEZXB0aCA/IGRldmljZS5zYW1wbGVzIDogMVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfcmVzaXplT2Zmc2NyZWVuVGFyZ2V0KHJ0KSB7XG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IHJ0LmNvbG9yQnVmZmVyLmZvcm1hdDtcbiAgICAgICAgY29uc3QgbmFtZSA9IHJ0LmNvbG9yQnVmZmVyLm5hbWU7XG5cbiAgICAgICAgcnQuZGVzdHJveUZyYW1lQnVmZmVycygpO1xuICAgICAgICBydC5kZXN0cm95VGV4dHVyZUJ1ZmZlcnMoKTtcbiAgICAgICAgcnQuX2NvbG9yQnVmZmVyID0gdGhpcy5fYWxsb2NhdGVDb2xvckJ1ZmZlcihmb3JtYXQsIG5hbWUpO1xuICAgICAgICBydC5fY29sb3JCdWZmZXJzID0gW3J0Ll9jb2xvckJ1ZmZlcl07XG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lPZmZzY3JlZW5UYXJnZXQocnQpIHtcbiAgICAgICAgcnQuZGVzdHJveVRleHR1cmVCdWZmZXJzKCk7XG4gICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcG9zdCBlZmZlY3QgdG8gdGhlIHF1ZXVlLiBJZiB0aGUgcXVldWUgaXMgZGlzYWJsZWQgYWRkaW5nIGEgcG9zdCBlZmZlY3Qgd2lsbFxuICAgICAqIGF1dG9tYXRpY2FsbHkgZW5hYmxlIHRoZSBxdWV1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UG9zdEVmZmVjdH0gZWZmZWN0IC0gVGhlIHBvc3QgZWZmZWN0IHRvIGFkZCB0byB0aGUgcXVldWUuXG4gICAgICovXG4gICAgYWRkRWZmZWN0KGVmZmVjdCkge1xuICAgICAgICAvLyBmaXJzdCByZW5kZXJpbmcgb2YgdGhlIHNjZW5lIHJlcXVpcmVzIGRlcHRoIGJ1ZmZlclxuICAgICAgICBjb25zdCBlZmZlY3RzID0gdGhpcy5lZmZlY3RzO1xuICAgICAgICBjb25zdCBpc0ZpcnN0RWZmZWN0ID0gZWZmZWN0cy5sZW5ndGggPT09IDA7XG5cbiAgICAgICAgY29uc3QgaW5wdXRUYXJnZXQgPSB0aGlzLl9jcmVhdGVPZmZzY3JlZW5UYXJnZXQoaXNGaXJzdEVmZmVjdCwgZWZmZWN0Lmhkcik7XG4gICAgICAgIGNvbnN0IG5ld0VudHJ5ID0gbmV3IFBvc3RFZmZlY3QoZWZmZWN0LCBpbnB1dFRhcmdldCk7XG4gICAgICAgIGVmZmVjdHMucHVzaChuZXdFbnRyeSk7XG5cbiAgICAgICAgdGhpcy5fc291cmNlVGFyZ2V0ID0gbmV3RW50cnkuaW5wdXRUYXJnZXQ7XG5cbiAgICAgICAgLy8gY29ubmVjdCB0aGUgZWZmZWN0IHdpdGggdGhlIHByZXZpb3VzIGVmZmVjdCBpZiBvbmUgZXhpc3RzXG4gICAgICAgIGlmIChlZmZlY3RzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGVmZmVjdHNbZWZmZWN0cy5sZW5ndGggLSAyXS5vdXRwdXRUYXJnZXQgPSBuZXdFbnRyeS5pbnB1dFRhcmdldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlcXVlc3QgZGVwdGhtYXAgaWYgbmVlZGVkXG4gICAgICAgIHRoaXMuX25ld1Bvc3RFZmZlY3QgPSBlZmZlY3Q7XG4gICAgICAgIGlmIChlZmZlY3QubmVlZHNEZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdERlcHRoTWFwKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVuYWJsZSgpO1xuICAgICAgICB0aGlzLl9uZXdQb3N0RWZmZWN0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBwb3N0IGVmZmVjdCBmcm9tIHRoZSBxdWV1ZS4gSWYgdGhlIHF1ZXVlIGJlY29tZXMgZW1wdHkgaXQgd2lsbCBiZSBkaXNhYmxlZFxuICAgICAqIGF1dG9tYXRpY2FsbHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1Bvc3RFZmZlY3R9IGVmZmVjdCAtIFRoZSBwb3N0IGVmZmVjdCB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlRWZmZWN0KGVmZmVjdCkge1xuXG4gICAgICAgIC8vIGZpbmQgaW5kZXggb2YgZWZmZWN0XG4gICAgICAgIGxldCBpbmRleCA9IC0xO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5lZmZlY3RzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lZmZlY3RzW2ldLmVmZmVjdCA9PT0gZWZmZWN0KSB7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IDApICB7XG4gICAgICAgICAgICAgICAgLy8gY29ubmVjdCB0aGUgcHJldmlvdXMgZWZmZWN0IHdpdGggdGhlIGVmZmVjdCBhZnRlciB0aGUgb25lIHdlJ3JlIGFib3V0IHRvIHJlbW92ZVxuICAgICAgICAgICAgICAgIHRoaXMuZWZmZWN0c1tpbmRleCAtIDFdLm91dHB1dFRhcmdldCA9IChpbmRleCArIDEpIDwgdGhpcy5lZmZlY3RzLmxlbmd0aCA/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZWZmZWN0c1tpbmRleCArIDFdLmlucHV0VGFyZ2V0IDpcbiAgICAgICAgICAgICAgICAgICAgbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZWZmZWN0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIHJlbW92ZWQgdGhlIGZpcnN0IGVmZmVjdCB0aGVuIG1ha2Ugc3VyZSB0aGF0XG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBpbnB1dCByZW5kZXIgdGFyZ2V0IG9mIHRoZSBlZmZlY3QgdGhhdCB3aWxsIG5vdyBiZWNvbWUgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgYSBkZXB0aCBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmVmZmVjdHNbMV0uaW5wdXRUYXJnZXQuX2RlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZXN0cm95T2Zmc2NyZWVuVGFyZ2V0KHRoaXMuZWZmZWN0c1sxXS5pbnB1dFRhcmdldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVmZmVjdHNbMV0uaW5wdXRUYXJnZXQgPSB0aGlzLl9jcmVhdGVPZmZzY3JlZW5UYXJnZXQodHJ1ZSwgdGhpcy5lZmZlY3RzWzFdLmhkcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zb3VyY2VUYXJnZXQgPSB0aGlzLmVmZmVjdHNbMV0uaW5wdXRUYXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbWVyYS5yZW5kZXJUYXJnZXQgPSB0aGlzLmVmZmVjdHNbMV0uaW5wdXRUYXJnZXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWxlYXNlIG1lbW9yeSBmb3IgcmVtb3ZlZCBlZmZlY3RcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lPZmZzY3JlZW5UYXJnZXQodGhpcy5lZmZlY3RzW2luZGV4XS5pbnB1dFRhcmdldCk7XG5cbiAgICAgICAgICAgIHRoaXMuZWZmZWN0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKGVmZmVjdC5uZWVkc0RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVsZWFzZURlcHRoTWFwKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lZmZlY3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5kaXNhYmxlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVxdWVzdERlcHRoTWFwcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZWZmZWN0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZWZmZWN0ID0gdGhpcy5lZmZlY3RzW2ldLmVmZmVjdDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9uZXdQb3N0RWZmZWN0ID09PSBlZmZlY3QpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGlmIChlZmZlY3QubmVlZHNEZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlcXVlc3REZXB0aE1hcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbGVhc2VEZXB0aE1hcHMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmVmZmVjdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGVmZmVjdCA9IHRoaXMuZWZmZWN0c1tpXS5lZmZlY3Q7XG4gICAgICAgICAgICBpZiAoZWZmZWN0Lm5lZWRzRGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWxlYXNlRGVwdGhNYXAoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXF1ZXN0RGVwdGhNYXAoKSB7XG4gICAgICAgIGNvbnN0IGRlcHRoTGF5ZXIgPSB0aGlzLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfREVQVEgpO1xuICAgICAgICBpZiAoZGVwdGhMYXllcikge1xuICAgICAgICAgICAgZGVwdGhMYXllci5pbmNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5yZXF1ZXN0U2NlbmVEZXB0aE1hcCh0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWxlYXNlRGVwdGhNYXAoKSB7XG4gICAgICAgIGNvbnN0IGRlcHRoTGF5ZXIgPSB0aGlzLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfREVQVEgpO1xuICAgICAgICBpZiAoZGVwdGhMYXllcikge1xuICAgICAgICAgICAgZGVwdGhMYXllci5kZWNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5yZXF1ZXN0U2NlbmVEZXB0aE1hcChmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCB0aGUgZWZmZWN0cyBmcm9tIHRoZSBxdWV1ZSBhbmQgZGlzYWJsZXMgaXQuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVsZWFzZSBtZW1vcnkgZm9yIGFsbCBlZmZlY3RzXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmVmZmVjdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuZWZmZWN0c1tpXS5pbnB1dFRhcmdldC5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVmZmVjdHMubGVuZ3RoID0gMDtcblxuICAgICAgICB0aGlzLmRpc2FibGUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIHRoZSBxdWV1ZSBhbmQgYWxsIG9mIGl0cyBlZmZlY3RzLiBJZiB0aGVyZSBhcmUgbm8gZWZmZWN0cyB0aGVuIHRoZSBxdWV1ZSB3aWxsIG5vdCBiZVxuICAgICAqIGVuYWJsZWQuXG4gICAgICovXG4gICAgZW5hYmxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCAmJiB0aGlzLmVmZmVjdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RGVwdGhNYXBzKCk7XG5cbiAgICAgICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLm9uKCdyZXNpemVjYW52YXMnLCB0aGlzLl9vbkNhbnZhc1Jlc2l6ZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICAvLyBvcmlnaW5hbCBjYW1lcmEncyByZW5kZXIgdGFyZ2V0IGlzIHdoZXJlIHRoZSBmaW5hbCBvdXRwdXQgbmVlZHMgdG8gZ29cbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25SZW5kZXJUYXJnZXQgPSB0aGlzLmNhbWVyYS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSByZW5kZXJzIHRvIHRoZSBmaXJzdCBlZmZlY3QncyByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5yZW5kZXJUYXJnZXQgPSB0aGlzLmVmZmVjdHNbMF0uaW5wdXRUYXJnZXQ7XG5cbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIHdoZW4gcG9zdHByb2Nlc3NpbmcgdGFrZXMgcGxhY2VcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcgPSAoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZWN0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuID0gdGhpcy5lZmZlY3RzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxlbikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZnggPSB0aGlzLmVmZmVjdHNbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGVzdFRhcmdldCA9IGZ4Lm91dHB1dFRhcmdldDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxhc3QgZWZmZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbiAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVjdCA9IHRoaXMuY2FtZXJhLnJlY3Q7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgY2FtZXJhIG9yaWdpbmFsbHkgcmVuZGVyZWQgdG8gYSByZW5kZXIgdGFyZ2V0LCByZW5kZXIgbGFzdCBlZmZlY3QgdG8gaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGVzdGluYXRpb25SZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RUYXJnZXQgPSB0aGlzLmRlc3RpbmF0aW9uUmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLCBmeC5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmeC5lZmZlY3QucmVuZGVyKGZ4LmlucHV0VGFyZ2V0LCBkZXN0VGFyZ2V0LCByZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmFwcC5ncmFwaGljc0RldmljZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgdGhlIHF1ZXVlIGFuZCBhbGwgb2YgaXRzIGVmZmVjdHMuXG4gICAgICovXG4gICAgZGlzYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLm9mZigncmVzaXplY2FudmFzJywgdGhpcy5fb25DYW52YXNSZXNpemVkLCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fcmVsZWFzZURlcHRoTWFwcygpO1xuXG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95T2Zmc2NyZWVuVGFyZ2V0KHRoaXMuX3NvdXJjZVRhcmdldCk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLnJlbmRlclRhcmdldCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5vblBvc3Rwcm9jZXNzaW5nID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZXIgY2FsbGVkIHdoZW4gdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSBuZXcgd2lkdGggb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIG5ldyBoZWlnaHQgb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkNhbnZhc1Jlc2l6ZWQod2lkdGgsIGhlaWdodCkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5jYW1lcmEucmVjdDtcbiAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0ID0gdGhpcy5kZXN0aW5hdGlvblJlbmRlclRhcmdldDtcblxuICAgICAgICB3aWR0aCA9IHJlbmRlclRhcmdldD8ud2lkdGggPz8gd2lkdGg7XG4gICAgICAgIGhlaWdodCA9IHJlbmRlclRhcmdldD8uaGVpZ2h0ID8/IGhlaWdodDtcblxuICAgICAgICB0aGlzLmNhbWVyYS5jYW1lcmEuYXNwZWN0UmF0aW8gPSAod2lkdGggKiByZWN0LnopIC8gKGhlaWdodCAqIHJlY3Qudyk7XG5cbiAgICAgICAgdGhpcy5yZXNpemVSZW5kZXJUYXJnZXRzKCk7XG4gICAgfVxuXG4gICAgcmVzaXplUmVuZGVyVGFyZ2V0cygpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHJlbmRlclRhcmdldCA9IHRoaXMuZGVzdGluYXRpb25SZW5kZXJUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gcmVuZGVyVGFyZ2V0Py53aWR0aCA/PyBkZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHJlbmRlclRhcmdldD8uaGVpZ2h0ID8/IGRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuY2FtZXJhLnJlY3Q7XG4gICAgICAgIGNvbnN0IGRlc2lyZWRXaWR0aCA9IE1hdGguZmxvb3IocmVjdC56ICogd2lkdGgpO1xuICAgICAgICBjb25zdCBkZXNpcmVkSGVpZ2h0ID0gTWF0aC5mbG9vcihyZWN0LncgKiBoZWlnaHQpO1xuXG4gICAgICAgIGNvbnN0IGVmZmVjdHMgPSB0aGlzLmVmZmVjdHM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGVmZmVjdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGZ4ID0gZWZmZWN0c1tpXTtcbiAgICAgICAgICAgIGlmIChmeC5pbnB1dFRhcmdldC53aWR0aCAhPT0gZGVzaXJlZFdpZHRoIHx8XG4gICAgICAgICAgICAgICAgZnguaW5wdXRUYXJnZXQuaGVpZ2h0ICE9PSBkZXNpcmVkSGVpZ2h0KSAge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Jlc2l6ZU9mZnNjcmVlblRhcmdldChmeC5pbnB1dFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkNhbWVyYVJlY3RDaGFuZ2VkKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlc2l6ZVJlbmRlclRhcmdldHMoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH07XG4iXSwibmFtZXMiOlsiUG9zdEVmZmVjdCIsImNvbnN0cnVjdG9yIiwiZWZmZWN0IiwiaW5wdXRUYXJnZXQiLCJvdXRwdXRUYXJnZXQiLCJuYW1lIiwiUG9zdEVmZmVjdFF1ZXVlIiwiYXBwIiwiY2FtZXJhIiwiZGVzdGluYXRpb25SZW5kZXJUYXJnZXQiLCJlZmZlY3RzIiwiZW5hYmxlZCIsImRlcHRoVGFyZ2V0Iiwib24iLCJvbkNhbWVyYVJlY3RDaGFuZ2VkIiwiX2FsbG9jYXRlQ29sb3JCdWZmZXIiLCJmb3JtYXQiLCJfcmVuZGVyVGFyZ2V0JHdpZHRoIiwiX3JlbmRlclRhcmdldCRoZWlnaHQiLCJyZWN0IiwicmVuZGVyVGFyZ2V0IiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJ3aWR0aCIsIk1hdGgiLCJmbG9vciIsInoiLCJoZWlnaHQiLCJ3IiwiY29sb3JCdWZmZXIiLCJUZXh0dXJlIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsIl9jcmVhdGVPZmZzY3JlZW5UYXJnZXQiLCJ1c2VEZXB0aCIsImhkciIsImdldFJlbmRlcmFibGVIZHJGb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1JHQkE4IiwiZW50aXR5IiwibGVuZ3RoIiwiUmVuZGVyVGFyZ2V0IiwiZGVwdGgiLCJzdGVuY2lsIiwic3VwcG9ydHNTdGVuY2lsIiwic2FtcGxlcyIsIl9yZXNpemVPZmZzY3JlZW5UYXJnZXQiLCJydCIsImRlc3Ryb3lGcmFtZUJ1ZmZlcnMiLCJkZXN0cm95VGV4dHVyZUJ1ZmZlcnMiLCJfY29sb3JCdWZmZXIiLCJfY29sb3JCdWZmZXJzIiwiX2Rlc3Ryb3lPZmZzY3JlZW5UYXJnZXQiLCJkZXN0cm95IiwiYWRkRWZmZWN0IiwiaXNGaXJzdEVmZmVjdCIsIm5ld0VudHJ5IiwicHVzaCIsIl9zb3VyY2VUYXJnZXQiLCJfbmV3UG9zdEVmZmVjdCIsIm5lZWRzRGVwdGhCdWZmZXIiLCJfcmVxdWVzdERlcHRoTWFwIiwiZW5hYmxlIiwidW5kZWZpbmVkIiwicmVtb3ZlRWZmZWN0IiwiaW5kZXgiLCJpIiwibGVuIiwiX2RlcHRoIiwic3BsaWNlIiwiX3JlbGVhc2VEZXB0aE1hcCIsImRpc2FibGUiLCJfcmVxdWVzdERlcHRoTWFwcyIsIl9yZWxlYXNlRGVwdGhNYXBzIiwiZGVwdGhMYXllciIsInNjZW5lIiwibGF5ZXJzIiwiZ2V0TGF5ZXJCeUlkIiwiTEFZRVJJRF9ERVBUSCIsImluY3JlbWVudENvdW50ZXIiLCJyZXF1ZXN0U2NlbmVEZXB0aE1hcCIsImRlY3JlbWVudENvdW50ZXIiLCJfb25DYW52YXNSZXNpemVkIiwib25Qb3N0cHJvY2Vzc2luZyIsImZ4IiwiZGVzdFRhcmdldCIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicmVuZGVyIiwicG9wR3B1TWFya2VyIiwib2ZmIiwiX3JlbmRlclRhcmdldCR3aWR0aDIiLCJfcmVuZGVyVGFyZ2V0JGhlaWdodDIiLCJhc3BlY3RSYXRpbyIsInJlc2l6ZVJlbmRlclRhcmdldHMiLCJfcmVuZGVyVGFyZ2V0JHdpZHRoMyIsIl9yZW5kZXJUYXJnZXQkaGVpZ2h0MyIsImRlc2lyZWRXaWR0aCIsImRlc2lyZWRIZWlnaHQiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFPQSxNQUFNQSxVQUFVLENBQUM7QUFDYkMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxXQUFXLEVBQUU7SUFDN0IsSUFBSSxDQUFDRCxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNDLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0lBQzlCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUN4QixJQUFBLElBQUksQ0FBQ0MsSUFBSSxHQUFHSCxNQUFNLENBQUNELFdBQVcsQ0FBQ0ksSUFBSSxDQUFBO0FBQ3ZDLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxlQUFlLENBQUM7QUFDbEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lMLEVBQUFBLFdBQVdBLENBQUNNLEdBQUcsRUFBRUMsTUFBTSxFQUFFO0lBQ3JCLElBQUksQ0FBQ0QsR0FBRyxHQUFHQSxHQUFHLENBQUE7SUFDZCxJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBOztBQUVwQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsdUJBQXVCLEdBQUcsSUFBSSxDQUFBOztBQUVuQztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLE9BQU8sR0FBRyxFQUFFLENBQUE7O0FBRWpCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxPQUFPLEdBQUcsS0FB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
