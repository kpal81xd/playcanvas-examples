import { EventHandler } from '../../core/event-handler.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { PIXELFORMAT_RGB8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';

/**
 * Represents an XR View which represents a screen (monoscopic scenario such as a mobile phone) or an eye
 * (stereoscopic scenario such as an HMD context). It provides access to the view's color and depth information
 * based on the capabilities of underlying AR system.
 *
 * @category XR
 */
class XrView extends EventHandler {
  /**
   * Create a new XrView instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @param {XRView} xrView - [XRView](https://developer.mozilla.org/en-US/docs/Web/API/XRView)
   * object that is created by WebXR API.
   * @param {number} viewsCount - Number of views available for the session.
   * @hideconstructor
   */
  constructor(manager, xrView, viewsCount) {
    super();
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {XRView}
     * @private
     */
    this._xrView = void 0;
    /**
     * @type {Float32Array}
     * @private
     */
    this._positionData = new Float32Array(3);
    /**
     * @type {Vec4}
     * @private
     */
    this._viewport = new Vec4();
    /**
     * @type {Mat4}
     * @private
     */
    this._projMat = new Mat4();
    /**
     * @type {Mat4}
     * @private
     */
    this._projViewOffMat = new Mat4();
    /**
     * @type {Mat4}
     * @private
     */
    this._viewMat = new Mat4();
    /**
     * @type {Mat4}
     * @private
     */
    this._viewOffMat = new Mat4();
    /**
     * @type {Mat3}
     * @private
     */
    this._viewMat3 = new Mat3();
    /**
     * @type {Mat4}
     * @private
     */
    this._viewInvMat = new Mat4();
    /**
     * @type {Mat4}
     * @private
     */
    this._viewInvOffMat = new Mat4();
    /**
     * @type {XRCamera}
     * @private
     */
    this._xrCamera = null;
    /**
     * @type {Texture|null}
     * @private
     */
    this._textureColor = null;
    /**
     * @type {Texture|null}
     * @private
     */
    this._textureDepth = null;
    /**
     * @type {XRDepthInformation|null}
     * @private
     */
    this._depthInfo = null;
    /**
     * @type {Uint8Array}
     * @private
     */
    this._emptyDepthBuffer = new Uint8Array(32);
    /**
     * @type {Mat4}
     * @private
     */
    this._depthMatrix = new Mat4();
    this._manager = manager;
    this._xrView = xrView;
    const device = this._manager.app.graphicsDevice;
    if (this._manager.views.supportedColor) {
      this._xrCamera = this._xrView.camera;

      // color texture
      if (this._manager.views.availableColor && this._xrCamera) {
        this._textureColor = new Texture(device, {
          format: PIXELFORMAT_RGB8,
          mipmaps: false,
          addressU: ADDRESS_CLAMP_TO_EDGE,
          addressV: ADDRESS_CLAMP_TO_EDGE,
          minFilter: FILTER_LINEAR,
          magFilter: FILTER_LINEAR,
          width: this._xrCamera.width,
          height: this._xrCamera.height,
          name: `XrView-${this._xrView.eye}-Color`
        });
      }
    }
    if (this._manager.views.supportedDepth && this._manager.views.availableDepth) {
      this._textureDepth = new Texture(device, {
        format: this._manager.views.depthPixelFormat,
        arrayLength: viewsCount === 1 ? 0 : viewsCount,
        mipmaps: false,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        width: 4,
        height: 4,
        name: `XrView-${this._xrView.eye}-Depth`
      });
      for (let i = 0; i < this._textureDepth._levels.length; i++) {
        this._textureDepth._levels[i] = this._emptyDepthBuffer;
      }
    }
    if (this._textureColor || this._textureDepth) device.on('devicelost', this._onDeviceLost, this);
  }

  /**
   * Texture associated with this view's camera color. Equals to null if camera color is
   * not available or is not supported.
   *
   * @type {Texture|null}
   */
  get textureColor() {
    return this._textureColor;
  }

  /* eslint-disable jsdoc/check-examples */
  /**
   * Texture that contains packed depth information which is reconstructed using the underlying
   * AR system. This texture can be used (not limited to) for reconstructing real world
   * geometry, virtual object placement, occlusion of virtual object by the real world geometry,
   * and more.
   * The format of this texture is {@link PIXELFORMAT_LA8} or {@link PIXELFORMAT_R32F}
   * based on {@link XrViews#depthFormat}. It is UV transformed based on the underlying AR
   * system which can be normalized using {@link XrView#depthUvMatrix}. Equals to null if camera
   * depth is not supported.
   *
   * @type {Texture|null}
   * @example
   * // GPU path, attaching texture to material
   * material.setParameter('texture_depthSensingMap', view.textureDepth);
   * material.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
   * material.setParameter('depth_to_meters', view.depthValueToMeters);
   * @example
   * // GLSL shader to unpack depth texture
   * varying vec2 vUv0;
   *
   * uniform sampler2D texture_depthSensingMap;
   * uniform mat4 matrix_depth_uv;
   * uniform float depth_to_meters;
   *
   * void main(void) {
   *     // transform UVs using depth matrix
   *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
   *
   *     // get luminance alpha components from depth texture
   *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
   *
   *     // unpack into single value in millimeters
   *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_to_meters; // m
   *
   *     // normalize: 0m to 8m distance
   *     depth = min(depth / 8.0, 1.0); // 0..1 = 0m..8m
   *
   *     // paint scene from black to white based on distance
   *     gl_FragColor = vec4(depth, depth, depth, 1.0);
   * }
   */
  get textureDepth() {
    return this._textureDepth;
  }
  /* eslint-enable jsdoc/check-examples */

  /**
   * 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader.
   * It is updated when the depth texture is resized. Refer to {@link XrView#depthResize}.
   *
   * @type {Mat4}
   * @example
   * material.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
   */
  get depthUvMatrix() {
    return this._depthMatrix;
  }

  /**
   * Multiply this coefficient number by raw depth value to get depth in meters.
   *
   * @type {number}
   * @example
   * material.setParameter('depth_to_meters', view.depthValueToMeters);
   */
  get depthValueToMeters() {
    var _this$_depthInfo;
    return ((_this$_depthInfo = this._depthInfo) == null ? void 0 : _this$_depthInfo.rawValueToMeters) || 0;
  }

  /**
   * An eye with which this view is associated. Can be any of:
   *
   * - {@link XREYE_NONE}: None - inidcates a monoscopic view (likely mobile phone screen).
   * - {@link XREYE_LEFT}: Left - indicates left eye view.
   * - {@link XREYE_RIGHT}: Right - indicates a right eye view.
   *
   * @type {string}
   */
  get eye() {
    return this._xrView.eye;
  }

  /**
   * A Vec4 (x, y, width, height) that represents a view's viewport. For monoscopic screen
   * it will define fullscreen view, but for stereoscopic views (left/right eye) it will define
   * a part of a whole screen that view is occupying.
   *
   * @type {Vec4}
   */
  get viewport() {
    return this._viewport;
  }

  /**
   * @type {Mat4}
   * @ignore
   */
  get projMat() {
    return this._projMat;
  }

  /**
   * @type {Mat4}
   * @ignore
   */
  get projViewOffMat() {
    return this._projViewOffMat;
  }

  /**
   * @type {Mat4}
   * @ignore
   */
  get viewOffMat() {
    return this._viewOffMat;
  }

  /**
   * @type {Mat4}
   * @ignore
   */
  get viewInvOffMat() {
    return this._viewInvOffMat;
  }

  /**
   * @type {Mat3}
   * @ignore
   */
  get viewMat3() {
    return this._viewMat3;
  }

  /**
   * @type {Float32Array}
   * @ignore
   */
  get positionData() {
    return this._positionData;
  }

  /**
   * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
   * @param {XRView} xrView - XRView from WebXR API.
   * @ignore
   */
  update(frame, xrView) {
    this._xrView = xrView;
    if (this._manager.views.availableColor) this._xrCamera = this._xrView.camera;
    const layer = frame.session.renderState.baseLayer;

    // viewport
    const viewport = layer.getViewport(this._xrView);
    this._viewport.x = viewport.x;
    this._viewport.y = viewport.y;
    this._viewport.z = viewport.width;
    this._viewport.w = viewport.height;

    // matrices
    this._projMat.set(this._xrView.projectionMatrix);
    this._viewMat.set(this._xrView.transform.inverse.matrix);
    this._viewInvMat.set(this._xrView.transform.matrix);
    this._updateTextureColor();
    this._updateDepth(frame);
  }

  /**
   * @private
   */
  _updateTextureColor() {
    if (!this._manager.views.availableColor || !this._xrCamera || !this._textureColor) return;
    const binding = this._manager.webglBinding;
    if (!binding) return;
    const texture = binding.getCameraImage(this._xrCamera);
    if (!texture) return;
    const device = this._manager.app.graphicsDevice;
    const gl = device.gl;
    if (!this._frameBufferSource) {
      // create frame buffer to read from
      this._frameBufferSource = gl.createFramebuffer();

      // create frame buffer to write to
      this._frameBuffer = gl.createFramebuffer();
    } else {
      var _device$extDrawBuffer, _device$extDrawBuffer2;
      const attachmentBaseConstant = device.isWebGL2 ? gl.COLOR_ATTACHMENT0 : (_device$extDrawBuffer = (_device$extDrawBuffer2 = device.extDrawBuffers) == null ? void 0 : _device$extDrawBuffer2.COLOR_ATTACHMENT0_WEBGL) != null ? _device$extDrawBuffer : gl.COLOR_ATTACHMENT0;
      const width = this._xrCamera.width;
      const height = this._xrCamera.height;

      // set frame buffer to read from
      device.setFramebuffer(this._frameBufferSource);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant, gl.TEXTURE_2D, texture, 0);

      // set frame buffer to write to
      device.setFramebuffer(this._frameBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant, gl.TEXTURE_2D, this._textureColor.impl._glTexture, 0);

      // bind buffers
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._frameBufferSource);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._frameBuffer);

      // copy buffers with flip Y
      gl.blitFramebuffer(0, height, width, 0, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
  }

  /**
   * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
   * @private
   */
  _updateDepth(frame) {
    var _this$_depthInfo2, _this$_depthInfo3;
    if (!this._manager.views.availableDepth || !this._textureDepth) return;
    const gpu = this._manager.views.depthGpuOptimized;
    const infoSource = gpu ? this._manager.webglBinding : frame;
    if (!infoSource) {
      this._depthInfo = null;
      return;
    }
    const depthInfo = infoSource.getDepthInformation(this._xrView);
    if (!depthInfo) {
      this._depthInfo = null;
      return;
    }
    let matrixDirty = !this._depthInfo !== !depthInfo;
    this._depthInfo = depthInfo;
    const width = ((_this$_depthInfo2 = this._depthInfo) == null ? void 0 : _this$_depthInfo2.width) || 4;
    const height = ((_this$_depthInfo3 = this._depthInfo) == null ? void 0 : _this$_depthInfo3.height) || 4;
    let resized = false;

    // resizing
    if (this._textureDepth.width !== width || this._textureDepth.height !== height) {
      this._textureDepth._width = width;
      this._textureDepth._height = height;
      matrixDirty = true;
      resized = true;
    }

    // update depth matrix
    if (matrixDirty) {
      if (this._depthInfo) {
        this._depthMatrix.data.set(this._depthInfo.normDepthBufferFromNormView.matrix);
      } else {
        this._depthMatrix.setIdentity();
      }
    }

    // update texture
    if (this._depthInfo) {
      if (gpu) {
        // gpu
        if (this._depthInfo.texture) {
          this._textureDepth.impl._glTexture = this._depthInfo.texture;
        }
      } else {
        // cpu
        this._textureDepth._levels[0] = new Uint8Array(this._depthInfo.data);
        this._textureDepth.upload();
      }
    } else {
      // clear
      this._textureDepth._levels[0] = this._emptyDepthBuffer;
      this._textureDepth.upload();
    }
    if (resized) this.fire('depth:resize', width, height);
  }

  /**
   * @param {Mat4|null} transform - World Transform of a parents GraphNode.
   * @ignore
   */
  updateTransforms(transform) {
    if (transform) {
      this._viewInvOffMat.mul2(transform, this._viewInvMat);
      this.viewOffMat.copy(this._viewInvOffMat).invert();
    } else {
      this._viewInvOffMat.copy(this._viewInvMat);
      this.viewOffMat.copy(this._viewMat);
    }
    this._viewMat3.setFromMat4(this._viewOffMat);
    this._projViewOffMat.mul2(this._projMat, this._viewOffMat);
    this._positionData[0] = this._viewInvOffMat.data[12];
    this._positionData[1] = this._viewInvOffMat.data[13];
    this._positionData[2] = this._viewInvOffMat.data[14];
  }
  _onDeviceLost() {
    this._frameBufferSource = null;
    this._frameBuffer = null;
    this._depthInfo = null;
  }

  /**
   * Get depth value from depth information in meters. UV is in range of 0..1, with origin in
   * top-left corner of a texture.
   *
   * @param {number} u - U coordinate of pixel in depth texture, which is in range from 0.0 to
   * 1.0 (left to right).
   * @param {number} v - V coordinate of pixel in depth texture, which is in range from 0.0 to
   * 1.0 (top to bottom).
   * @returns {number|null} Depth in meters or null if depth information is currently not
   * available.
   * @example
   * const depth = view.getDepth(u, v);
   * if (depth !== null) {
   *     // depth in meters
   * }
   */
  getDepth(u, v) {
    var _this$_depthInfo$getD, _this$_depthInfo4;
    if (this._manager.views.depthGpuOptimized) return null;
    return (_this$_depthInfo$getD = (_this$_depthInfo4 = this._depthInfo) == null ? void 0 : _this$_depthInfo4.getDepthInMeters(u, v)) != null ? _this$_depthInfo$getD : null;
  }

  /** @ignore */
  destroy() {
    this._depthInfo = null;
    if (this._textureColor) {
      this._textureColor.destroy();
      this._textureColor = null;
    }
    if (this._textureDepth) {
      this._textureDepth.destroy();
      this._textureDepth = null;
    }
    if (this._frameBufferSource) {
      const gl = this._manager.app.graphicsDevice.gl;
      gl.deleteFramebuffer(this._frameBufferSource);
      this._frameBufferSource = null;
      gl.deleteFramebuffer(this._frameBuffer);
      this._frameBuffer = null;
    }
  }
}
/**
 * Fired when the depth sensing texture been resized. The {@link XrView#depthUvMatrix} needs
 * to be updated for relevant shaders. The handler is passed the new width and height of the
 * depth texture in pixels.
 *
 * @event
 * @example
 * view.on('depth:resize', () => {
 *     material.setParameter('matrix_depth_uv', view.depthUvMatrix);
 * });
 */
XrView.EVENT_DEPTHRESIZE = 'depth:resize';

export { XrView };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItdmlldy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci12aWV3LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzXCI7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzXCI7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzXCI7XG5cbmltcG9ydCB7IEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgRklMVEVSX0xJTkVBUiwgUElYRUxGT1JNQVRfUkdCOCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBYUiBWaWV3IHdoaWNoIHJlcHJlc2VudHMgYSBzY3JlZW4gKG1vbm9zY29waWMgc2NlbmFyaW8gc3VjaCBhcyBhIG1vYmlsZSBwaG9uZSkgb3IgYW4gZXllXG4gKiAoc3RlcmVvc2NvcGljIHNjZW5hcmlvIHN1Y2ggYXMgYW4gSE1EIGNvbnRleHQpLiBJdCBwcm92aWRlcyBhY2Nlc3MgdG8gdGhlIHZpZXcncyBjb2xvciBhbmQgZGVwdGggaW5mb3JtYXRpb25cbiAqIGJhc2VkIG9uIHRoZSBjYXBhYmlsaXRpZXMgb2YgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gKlxuICogQGNhdGVnb3J5IFhSXG4gKi9cbmNsYXNzIFhyVmlldyBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgZGVwdGggc2Vuc2luZyB0ZXh0dXJlIGJlZW4gcmVzaXplZC4gVGhlIHtAbGluayBYclZpZXcjZGVwdGhVdk1hdHJpeH0gbmVlZHNcbiAgICAgKiB0byBiZSB1cGRhdGVkIGZvciByZWxldmFudCBzaGFkZXJzLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIG5ldyB3aWR0aCBhbmQgaGVpZ2h0IG9mIHRoZVxuICAgICAqIGRlcHRoIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2aWV3Lm9uKCdkZXB0aDpyZXNpemUnLCAoKSA9PiB7XG4gICAgICogICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF0cml4X2RlcHRoX3V2Jywgdmlldy5kZXB0aFV2TWF0cml4KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfREVQVEhSRVNJWkUgPSAnZGVwdGg6cmVzaXplJztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSVmlld31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF94clZpZXc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RmxvYXQzMkFycmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjNH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF92aWV3cG9ydCA9IG5ldyBWZWM0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcm9qTWF0ID0gbmV3IE1hdDQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Byb2pWaWV3T2ZmTWF0ID0gbmV3IE1hdDQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ZpZXdNYXQgPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdmlld09mZk1hdCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0M31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF92aWV3TWF0MyA9IG5ldyBNYXQzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF92aWV3SW52TWF0ID0gbmV3IE1hdDQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ZpZXdJbnZPZmZNYXQgPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSQ2FtZXJhfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3hyQ2FtZXJhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtUZXh0dXJlfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdGV4dHVyZUNvbG9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtUZXh0dXJlfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdGV4dHVyZURlcHRoID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUkRlcHRoSW5mb3JtYXRpb258bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEluZm8gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1VpbnQ4QXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZW1wdHlEZXB0aEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KDMyKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoTWF0cml4ID0gbmV3IE1hdDQoKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYclZpZXcgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfSBtYW5hZ2VyIC0gV2ViWFIgTWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge1hSVmlld30geHJWaWV3IC0gW1hSVmlld10oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hSVmlldylcbiAgICAgKiBvYmplY3QgdGhhdCBpcyBjcmVhdGVkIGJ5IFdlYlhSIEFQSS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmlld3NDb3VudCAtIE51bWJlciBvZiB2aWV3cyBhdmFpbGFibGUgZm9yIHRoZSBzZXNzaW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCB4clZpZXcsIHZpZXdzQ291bnQpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICAgICAgdGhpcy5feHJWaWV3ID0geHJWaWV3O1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuX21hbmFnZXIuYXBwLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnZpZXdzLnN1cHBvcnRlZENvbG9yKSB7XG4gICAgICAgICAgICB0aGlzLl94ckNhbWVyYSA9IHRoaXMuX3hyVmlldy5jYW1lcmE7XG5cbiAgICAgICAgICAgIC8vIGNvbG9yIHRleHR1cmVcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnZpZXdzLmF2YWlsYWJsZUNvbG9yICYmIHRoaXMuX3hyQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUNvbG9yID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCOCxcbiAgICAgICAgICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICAgICAgICAgIGFkZHJlc3NWOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICAgICAgICAgIG1pbkZpbHRlcjogRklMVEVSX0xJTkVBUixcbiAgICAgICAgICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTElORUFSLFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5feHJDYW1lcmEud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5feHJDYW1lcmEuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBgWHJWaWV3LSR7dGhpcy5feHJWaWV3LmV5ZX0tQ29sb3JgXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWFuYWdlci52aWV3cy5zdXBwb3J0ZWREZXB0aCAmJiB0aGlzLl9tYW5hZ2VyLnZpZXdzLmF2YWlsYWJsZURlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlRGVwdGggPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IHRoaXMuX21hbmFnZXIudmlld3MuZGVwdGhQaXhlbEZvcm1hdCxcbiAgICAgICAgICAgICAgICBhcnJheUxlbmd0aDogKHZpZXdzQ291bnQgPT09IDEpID8gMCA6IHZpZXdzQ291bnQsXG4gICAgICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgICAgIG1pbkZpbHRlcjogRklMVEVSX0xJTkVBUixcbiAgICAgICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICAgICAgd2lkdGg6IDQsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiA0LFxuICAgICAgICAgICAgICAgIG5hbWU6IGBYclZpZXctJHt0aGlzLl94clZpZXcuZXllfS1EZXB0aGBcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3RleHR1cmVEZXB0aC5fbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZURlcHRoLl9sZXZlbHNbaV0gPSB0aGlzLl9lbXB0eURlcHRoQnVmZmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVDb2xvciB8fCB0aGlzLl90ZXh0dXJlRGVwdGgpXG4gICAgICAgICAgICBkZXZpY2Uub24oJ2RldmljZWxvc3QnLCB0aGlzLl9vbkRldmljZUxvc3QsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRleHR1cmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdmlldydzIGNhbWVyYSBjb2xvci4gRXF1YWxzIHRvIG51bGwgaWYgY2FtZXJhIGNvbG9yIGlzXG4gICAgICogbm90IGF2YWlsYWJsZSBvciBpcyBub3Qgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge1RleHR1cmV8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgdGV4dHVyZUNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUNvbG9yO1xuICAgIH1cblxuICAgIC8qIGVzbGludC1kaXNhYmxlIGpzZG9jL2NoZWNrLWV4YW1wbGVzICovXG4gICAgLyoqXG4gICAgICogVGV4dHVyZSB0aGF0IGNvbnRhaW5zIHBhY2tlZCBkZXB0aCBpbmZvcm1hdGlvbiB3aGljaCBpcyByZWNvbnN0cnVjdGVkIHVzaW5nIHRoZSB1bmRlcmx5aW5nXG4gICAgICogQVIgc3lzdGVtLiBUaGlzIHRleHR1cmUgY2FuIGJlIHVzZWQgKG5vdCBsaW1pdGVkIHRvKSBmb3IgcmVjb25zdHJ1Y3RpbmcgcmVhbCB3b3JsZFxuICAgICAqIGdlb21ldHJ5LCB2aXJ0dWFsIG9iamVjdCBwbGFjZW1lbnQsIG9jY2x1c2lvbiBvZiB2aXJ0dWFsIG9iamVjdCBieSB0aGUgcmVhbCB3b3JsZCBnZW9tZXRyeSxcbiAgICAgKiBhbmQgbW9yZS5cbiAgICAgKiBUaGUgZm9ybWF0IG9mIHRoaXMgdGV4dHVyZSBpcyB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fSBvciB7QGxpbmsgUElYRUxGT1JNQVRfUjMyRn1cbiAgICAgKiBiYXNlZCBvbiB7QGxpbmsgWHJWaWV3cyNkZXB0aEZvcm1hdH0uIEl0IGlzIFVWIHRyYW5zZm9ybWVkIGJhc2VkIG9uIHRoZSB1bmRlcmx5aW5nIEFSXG4gICAgICogc3lzdGVtIHdoaWNoIGNhbiBiZSBub3JtYWxpemVkIHVzaW5nIHtAbGluayBYclZpZXcjZGVwdGhVdk1hdHJpeH0uIEVxdWFscyB0byBudWxsIGlmIGNhbWVyYVxuICAgICAqIGRlcHRoIGlzIG5vdCBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VGV4dHVyZXxudWxsfVxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gR1BVIHBhdGgsIGF0dGFjaGluZyB0ZXh0dXJlIHRvIG1hdGVyaWFsXG4gICAgICogbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2RlcHRoU2Vuc2luZ01hcCcsIHZpZXcudGV4dHVyZURlcHRoKTtcbiAgICAgKiBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21hdHJpeF9kZXB0aF91dicsIHZpZXcuZGVwdGhVdk1hdHJpeC5kYXRhKTtcbiAgICAgKiBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2RlcHRoX3RvX21ldGVycycsIHZpZXcuZGVwdGhWYWx1ZVRvTWV0ZXJzKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdMU0wgc2hhZGVyIHRvIHVucGFjayBkZXB0aCB0ZXh0dXJlXG4gICAgICogdmFyeWluZyB2ZWMyIHZVdjA7XG4gICAgICpcbiAgICAgKiB1bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2RlcHRoU2Vuc2luZ01hcDtcbiAgICAgKiB1bmlmb3JtIG1hdDQgbWF0cml4X2RlcHRoX3V2O1xuICAgICAqIHVuaWZvcm0gZmxvYXQgZGVwdGhfdG9fbWV0ZXJzO1xuICAgICAqXG4gICAgICogdm9pZCBtYWluKHZvaWQpIHtcbiAgICAgKiAgICAgLy8gdHJhbnNmb3JtIFVWcyB1c2luZyBkZXB0aCBtYXRyaXhcbiAgICAgKiAgICAgdmVjMiB0ZXhDb29yZCA9IChtYXRyaXhfZGVwdGhfdXYgKiB2ZWM0KHZVdjAueHksIDAuMCwgMS4wKSkueHk7XG4gICAgICpcbiAgICAgKiAgICAgLy8gZ2V0IGx1bWluYW5jZSBhbHBoYSBjb21wb25lbnRzIGZyb20gZGVwdGggdGV4dHVyZVxuICAgICAqICAgICB2ZWMyIHBhY2tlZERlcHRoID0gdGV4dHVyZTJEKHRleHR1cmVfZGVwdGhTZW5zaW5nTWFwLCB0ZXhDb29yZCkucmE7XG4gICAgICpcbiAgICAgKiAgICAgLy8gdW5wYWNrIGludG8gc2luZ2xlIHZhbHVlIGluIG1pbGxpbWV0ZXJzXG4gICAgICogICAgIGZsb2F0IGRlcHRoID0gZG90KHBhY2tlZERlcHRoLCB2ZWMyKDI1NS4wLCAyNTYuMCAqIDI1NS4wKSkgKiBkZXB0aF90b19tZXRlcnM7IC8vIG1cbiAgICAgKlxuICAgICAqICAgICAvLyBub3JtYWxpemU6IDBtIHRvIDhtIGRpc3RhbmNlXG4gICAgICogICAgIGRlcHRoID0gbWluKGRlcHRoIC8gOC4wLCAxLjApOyAvLyAwLi4xID0gMG0uLjhtXG4gICAgICpcbiAgICAgKiAgICAgLy8gcGFpbnQgc2NlbmUgZnJvbSBibGFjayB0byB3aGl0ZSBiYXNlZCBvbiBkaXN0YW5jZVxuICAgICAqICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGRlcHRoLCBkZXB0aCwgZGVwdGgsIDEuMCk7XG4gICAgICogfVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlRGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlRGVwdGg7XG4gICAgfVxuICAgIC8qIGVzbGludC1lbmFibGUganNkb2MvY2hlY2stZXhhbXBsZXMgKi9cblxuICAgIC8qKlxuICAgICAqIDR4NCBtYXRyaXggdGhhdCBzaG91bGQgYmUgdXNlZCB0byB0cmFuc2Zvcm0gZGVwdGggdGV4dHVyZSBVVnMgdG8gbm9ybWFsaXplZCBVVnMgaW4gYSBzaGFkZXIuXG4gICAgICogSXQgaXMgdXBkYXRlZCB3aGVuIHRoZSBkZXB0aCB0ZXh0dXJlIGlzIHJlc2l6ZWQuIFJlZmVyIHRvIHtAbGluayBYclZpZXcjZGVwdGhSZXNpemV9LlxuICAgICAqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21hdHJpeF9kZXB0aF91dicsIHZpZXcuZGVwdGhVdk1hdHJpeC5kYXRhKTtcbiAgICAgKi9cbiAgICBnZXQgZGVwdGhVdk1hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoTWF0cml4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGx5IHRoaXMgY29lZmZpY2llbnQgbnVtYmVyIGJ5IHJhdyBkZXB0aCB2YWx1ZSB0byBnZXQgZGVwdGggaW4gbWV0ZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZGVwdGhfdG9fbWV0ZXJzJywgdmlldy5kZXB0aFZhbHVlVG9NZXRlcnMpO1xuICAgICAqL1xuICAgIGdldCBkZXB0aFZhbHVlVG9NZXRlcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEluZm8/LnJhd1ZhbHVlVG9NZXRlcnMgfHwgMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBleWUgd2l0aCB3aGljaCB0aGlzIHZpZXcgaXMgYXNzb2NpYXRlZC4gQ2FuIGJlIGFueSBvZjpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSRVlFX05PTkV9OiBOb25lIC0gaW5pZGNhdGVzIGEgbW9ub3Njb3BpYyB2aWV3IChsaWtlbHkgbW9iaWxlIHBob25lIHNjcmVlbikuXG4gICAgICogLSB7QGxpbmsgWFJFWUVfTEVGVH06IExlZnQgLSBpbmRpY2F0ZXMgbGVmdCBleWUgdmlldy5cbiAgICAgKiAtIHtAbGluayBYUkVZRV9SSUdIVH06IFJpZ2h0IC0gaW5kaWNhdGVzIGEgcmlnaHQgZXllIHZpZXcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBleWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94clZpZXcuZXllO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgVmVjNCAoeCwgeSwgd2lkdGgsIGhlaWdodCkgdGhhdCByZXByZXNlbnRzIGEgdmlldydzIHZpZXdwb3J0LiBGb3IgbW9ub3Njb3BpYyBzY3JlZW5cbiAgICAgKiBpdCB3aWxsIGRlZmluZSBmdWxsc2NyZWVuIHZpZXcsIGJ1dCBmb3Igc3RlcmVvc2NvcGljIHZpZXdzIChsZWZ0L3JpZ2h0IGV5ZSkgaXQgd2lsbCBkZWZpbmVcbiAgICAgKiBhIHBhcnQgb2YgYSB3aG9sZSBzY3JlZW4gdGhhdCB2aWV3IGlzIG9jY3VweWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWM0fVxuICAgICAqL1xuICAgIGdldCB2aWV3cG9ydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZpZXdwb3J0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgcHJvak1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2pNYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBwcm9qVmlld09mZk1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2pWaWV3T2ZmTWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdmlld09mZk1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZpZXdPZmZNYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB2aWV3SW52T2ZmTWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmlld0ludk9mZk1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0M31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHZpZXdNYXQzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmlld01hdDM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHBvc2l0aW9uRGF0YSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uRGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSRnJhbWV9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge1hSVmlld30geHJWaWV3IC0gWFJWaWV3IGZyb20gV2ViWFIgQVBJLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUsIHhyVmlldykge1xuICAgICAgICB0aGlzLl94clZpZXcgPSB4clZpZXc7XG4gICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnZpZXdzLmF2YWlsYWJsZUNvbG9yKVxuICAgICAgICAgICAgdGhpcy5feHJDYW1lcmEgPSB0aGlzLl94clZpZXcuY2FtZXJhO1xuXG4gICAgICAgIGNvbnN0IGxheWVyID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXI7XG5cbiAgICAgICAgLy8gdmlld3BvcnRcbiAgICAgICAgY29uc3Qgdmlld3BvcnQgPSBsYXllci5nZXRWaWV3cG9ydCh0aGlzLl94clZpZXcpO1xuICAgICAgICB0aGlzLl92aWV3cG9ydC54ID0gdmlld3BvcnQueDtcbiAgICAgICAgdGhpcy5fdmlld3BvcnQueSA9IHZpZXdwb3J0Lnk7XG4gICAgICAgIHRoaXMuX3ZpZXdwb3J0LnogPSB2aWV3cG9ydC53aWR0aDtcbiAgICAgICAgdGhpcy5fdmlld3BvcnQudyA9IHZpZXdwb3J0LmhlaWdodDtcblxuICAgICAgICAvLyBtYXRyaWNlc1xuICAgICAgICB0aGlzLl9wcm9qTWF0LnNldCh0aGlzLl94clZpZXcucHJvamVjdGlvbk1hdHJpeCk7XG4gICAgICAgIHRoaXMuX3ZpZXdNYXQuc2V0KHRoaXMuX3hyVmlldy50cmFuc2Zvcm0uaW52ZXJzZS5tYXRyaXgpO1xuICAgICAgICB0aGlzLl92aWV3SW52TWF0LnNldCh0aGlzLl94clZpZXcudHJhbnNmb3JtLm1hdHJpeCk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVGV4dHVyZUNvbG9yKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZURlcHRoKGZyYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVUZXh0dXJlQ29sb3IoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbWFuYWdlci52aWV3cy5hdmFpbGFibGVDb2xvciB8fCAhdGhpcy5feHJDYW1lcmEgfHwgIXRoaXMuX3RleHR1cmVDb2xvcilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBiaW5kaW5nID0gdGhpcy5fbWFuYWdlci53ZWJnbEJpbmRpbmc7XG4gICAgICAgIGlmICghYmluZGluZylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gYmluZGluZy5nZXRDYW1lcmFJbWFnZSh0aGlzLl94ckNhbWVyYSk7XG4gICAgICAgIGlmICghdGV4dHVyZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9tYW5hZ2VyLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9mcmFtZUJ1ZmZlclNvdXJjZSkge1xuICAgICAgICAgICAgLy8gY3JlYXRlIGZyYW1lIGJ1ZmZlciB0byByZWFkIGZyb21cbiAgICAgICAgICAgIHRoaXMuX2ZyYW1lQnVmZmVyU291cmNlID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIGZyYW1lIGJ1ZmZlciB0byB3cml0ZSB0b1xuICAgICAgICAgICAgdGhpcy5fZnJhbWVCdWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgYXR0YWNobWVudEJhc2VDb25zdGFudCA9IGRldmljZS5pc1dlYkdMMiA/IGdsLkNPTE9SX0FUVEFDSE1FTlQwIDogKGRldmljZS5leHREcmF3QnVmZmVycz8uQ09MT1JfQVRUQUNITUVOVDBfV0VCR0wgPz8gZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggPSB0aGlzLl94ckNhbWVyYS53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IHRoaXMuX3hyQ2FtZXJhLmhlaWdodDtcblxuICAgICAgICAgICAgLy8gc2V0IGZyYW1lIGJ1ZmZlciB0byByZWFkIGZyb21cbiAgICAgICAgICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcih0aGlzLl9mcmFtZUJ1ZmZlclNvdXJjZSk7XG4gICAgICAgICAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChcbiAgICAgICAgICAgICAgICBnbC5GUkFNRUJVRkZFUixcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50QmFzZUNvbnN0YW50LFxuICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgdGV4dHVyZSxcbiAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBzZXQgZnJhbWUgYnVmZmVyIHRvIHdyaXRlIHRvXG4gICAgICAgICAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIodGhpcy5fZnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoXG4gICAgICAgICAgICAgICAgZ2wuRlJBTUVCVUZGRVIsXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudEJhc2VDb25zdGFudCxcbiAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVDb2xvci5pbXBsLl9nbFRleHR1cmUsXG4gICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gYmluZCBidWZmZXJzXG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgdGhpcy5fZnJhbWVCdWZmZXJTb3VyY2UpO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIHRoaXMuX2ZyYW1lQnVmZmVyKTtcblxuICAgICAgICAgICAgLy8gY29weSBidWZmZXJzIHdpdGggZmxpcCBZXG4gICAgICAgICAgICBnbC5ibGl0RnJhbWVidWZmZXIoMCwgaGVpZ2h0LCB3aWR0aCwgMCwgMCwgMCwgd2lkdGgsIGhlaWdodCwgZ2wuQ09MT1JfQlVGRkVSX0JJVCwgZ2wuTkVBUkVTVCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSRnJhbWV9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVEZXB0aChmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX21hbmFnZXIudmlld3MuYXZhaWxhYmxlRGVwdGggfHwgIXRoaXMuX3RleHR1cmVEZXB0aClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBncHUgPSB0aGlzLl9tYW5hZ2VyLnZpZXdzLmRlcHRoR3B1T3B0aW1pemVkO1xuXG4gICAgICAgIGNvbnN0IGluZm9Tb3VyY2UgPSBncHUgPyB0aGlzLl9tYW5hZ2VyLndlYmdsQmluZGluZyA6IGZyYW1lO1xuICAgICAgICBpZiAoIWluZm9Tb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoSW5mbyA9IG51bGw7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZXB0aEluZm8gPSBpbmZvU291cmNlLmdldERlcHRoSW5mb3JtYXRpb24odGhpcy5feHJWaWV3KTtcbiAgICAgICAgaWYgKCFkZXB0aEluZm8pIHtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoSW5mbyA9IG51bGw7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWF0cml4RGlydHkgPSAhdGhpcy5fZGVwdGhJbmZvICE9PSAhZGVwdGhJbmZvO1xuICAgICAgICB0aGlzLl9kZXB0aEluZm8gPSBkZXB0aEluZm87XG5cbiAgICAgICAgY29uc3Qgd2lkdGggPSB0aGlzLl9kZXB0aEluZm8/LndpZHRoIHx8IDQ7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHRoaXMuX2RlcHRoSW5mbz8uaGVpZ2h0IHx8IDQ7XG5cbiAgICAgICAgbGV0IHJlc2l6ZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyByZXNpemluZ1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZURlcHRoLndpZHRoICE9PSB3aWR0aCB8fCB0aGlzLl90ZXh0dXJlRGVwdGguaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVEZXB0aC5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVEZXB0aC5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgbWF0cml4RGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgcmVzaXplZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgZGVwdGggbWF0cml4XG4gICAgICAgIGlmIChtYXRyaXhEaXJ0eSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2RlcHRoSW5mbykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlcHRoTWF0cml4LmRhdGEuc2V0KHRoaXMuX2RlcHRoSW5mby5ub3JtRGVwdGhCdWZmZXJGcm9tTm9ybVZpZXcubWF0cml4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGVwdGhNYXRyaXguc2V0SWRlbnRpdHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB0ZXh0dXJlXG4gICAgICAgIGlmICh0aGlzLl9kZXB0aEluZm8pIHtcbiAgICAgICAgICAgIGlmIChncHUpIHtcbiAgICAgICAgICAgICAgICAvLyBncHVcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZGVwdGhJbmZvLnRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZURlcHRoLmltcGwuX2dsVGV4dHVyZSA9IHRoaXMuX2RlcHRoSW5mby50ZXh0dXJlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY3B1XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZURlcHRoLl9sZXZlbHNbMF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl9kZXB0aEluZm8uZGF0YSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZURlcHRoLnVwbG9hZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xlYXJcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVEZXB0aC5fbGV2ZWxzWzBdID0gdGhpcy5fZW1wdHlEZXB0aEJ1ZmZlcjtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVEZXB0aC51cGxvYWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXNpemVkKSB0aGlzLmZpcmUoJ2RlcHRoOnJlc2l6ZScsIHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWF0NHxudWxsfSB0cmFuc2Zvcm0gLSBXb3JsZCBUcmFuc2Zvcm0gb2YgYSBwYXJlbnRzIEdyYXBoTm9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlVHJhbnNmb3Jtcyh0cmFuc2Zvcm0pIHtcbiAgICAgICAgaWYgKHRyYW5zZm9ybSkge1xuICAgICAgICAgICAgdGhpcy5fdmlld0ludk9mZk1hdC5tdWwyKHRyYW5zZm9ybSwgdGhpcy5fdmlld0ludk1hdCk7XG4gICAgICAgICAgICB0aGlzLnZpZXdPZmZNYXQuY29weSh0aGlzLl92aWV3SW52T2ZmTWF0KS5pbnZlcnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZpZXdJbnZPZmZNYXQuY29weSh0aGlzLl92aWV3SW52TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld09mZk1hdC5jb3B5KHRoaXMuX3ZpZXdNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdmlld01hdDMuc2V0RnJvbU1hdDQodGhpcy5fdmlld09mZk1hdCk7XG4gICAgICAgIHRoaXMuX3Byb2pWaWV3T2ZmTWF0Lm11bDIodGhpcy5fcHJvak1hdCwgdGhpcy5fdmlld09mZk1hdCk7XG5cbiAgICAgICAgdGhpcy5fcG9zaXRpb25EYXRhWzBdID0gdGhpcy5fdmlld0ludk9mZk1hdC5kYXRhWzEyXTtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25EYXRhWzFdID0gdGhpcy5fdmlld0ludk9mZk1hdC5kYXRhWzEzXTtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25EYXRhWzJdID0gdGhpcy5fdmlld0ludk9mZk1hdC5kYXRhWzE0XTtcbiAgICB9XG5cbiAgICBfb25EZXZpY2VMb3N0KCkge1xuICAgICAgICB0aGlzLl9mcmFtZUJ1ZmZlclNvdXJjZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2ZyYW1lQnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZGVwdGhJbmZvID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgZGVwdGggdmFsdWUgZnJvbSBkZXB0aCBpbmZvcm1hdGlvbiBpbiBtZXRlcnMuIFVWIGlzIGluIHJhbmdlIG9mIDAuLjEsIHdpdGggb3JpZ2luIGluXG4gICAgICogdG9wLWxlZnQgY29ybmVyIG9mIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB1IC0gVSBjb29yZGluYXRlIG9mIHBpeGVsIGluIGRlcHRoIHRleHR1cmUsIHdoaWNoIGlzIGluIHJhbmdlIGZyb20gMC4wIHRvXG4gICAgICogMS4wIChsZWZ0IHRvIHJpZ2h0KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdiAtIFYgY29vcmRpbmF0ZSBvZiBwaXhlbCBpbiBkZXB0aCB0ZXh0dXJlLCB3aGljaCBpcyBpbiByYW5nZSBmcm9tIDAuMCB0b1xuICAgICAqIDEuMCAodG9wIHRvIGJvdHRvbSkuXG4gICAgICogQHJldHVybnMge251bWJlcnxudWxsfSBEZXB0aCBpbiBtZXRlcnMgb3IgbnVsbCBpZiBkZXB0aCBpbmZvcm1hdGlvbiBpcyBjdXJyZW50bHkgbm90XG4gICAgICogYXZhaWxhYmxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZGVwdGggPSB2aWV3LmdldERlcHRoKHUsIHYpO1xuICAgICAqIGlmIChkZXB0aCAhPT0gbnVsbCkge1xuICAgICAqICAgICAvLyBkZXB0aCBpbiBtZXRlcnNcbiAgICAgKiB9XG4gICAgICovXG4gICAgZ2V0RGVwdGgodSwgdikge1xuICAgICAgICBpZiAodGhpcy5fbWFuYWdlci52aWV3cy5kZXB0aEdwdU9wdGltaXplZClcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEluZm8/LmdldERlcHRoSW5NZXRlcnModSwgdikgPz8gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2RlcHRoSW5mbyA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVDb2xvcikge1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUNvbG9yLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVDb2xvciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZURlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlRGVwdGguZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZURlcHRoID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9mcmFtZUJ1ZmZlclNvdXJjZSkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLl9tYW5hZ2VyLmFwcC5ncmFwaGljc0RldmljZS5nbDtcblxuICAgICAgICAgICAgZ2wuZGVsZXRlRnJhbWVidWZmZXIodGhpcy5fZnJhbWVCdWZmZXJTb3VyY2UpO1xuICAgICAgICAgICAgdGhpcy5fZnJhbWVCdWZmZXJTb3VyY2UgPSBudWxsO1xuXG4gICAgICAgICAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLl9mcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB0aGlzLl9mcmFtZUJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyVmlldyB9O1xuIl0sIm5hbWVzIjpbIlhyVmlldyIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsInhyVmlldyIsInZpZXdzQ291bnQiLCJfbWFuYWdlciIsIl94clZpZXciLCJfcG9zaXRpb25EYXRhIiwiRmxvYXQzMkFycmF5IiwiX3ZpZXdwb3J0IiwiVmVjNCIsIl9wcm9qTWF0IiwiTWF0NCIsIl9wcm9qVmlld09mZk1hdCIsIl92aWV3TWF0IiwiX3ZpZXdPZmZNYXQiLCJfdmlld01hdDMiLCJNYXQzIiwiX3ZpZXdJbnZNYXQiLCJfdmlld0ludk9mZk1hdCIsIl94ckNhbWVyYSIsIl90ZXh0dXJlQ29sb3IiLCJfdGV4dHVyZURlcHRoIiwiX2RlcHRoSW5mbyIsIl9lbXB0eURlcHRoQnVmZmVyIiwiVWludDhBcnJheSIsIl9kZXB0aE1hdHJpeCIsImRldmljZSIsImFwcCIsImdyYXBoaWNzRGV2aWNlIiwidmlld3MiLCJzdXBwb3J0ZWRDb2xvciIsImNhbWVyYSIsImF2YWlsYWJsZUNvbG9yIiwiVGV4dHVyZSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQjgiLCJtaXBtYXBzIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsIm1pbkZpbHRlciIsIkZJTFRFUl9MSU5FQVIiLCJtYWdGaWx0ZXIiLCJ3aWR0aCIsImhlaWdodCIsIm5hbWUiLCJleWUiLCJzdXBwb3J0ZWREZXB0aCIsImF2YWlsYWJsZURlcHRoIiwiZGVwdGhQaXhlbEZvcm1hdCIsImFycmF5TGVuZ3RoIiwiaSIsIl9sZXZlbHMiLCJsZW5ndGgiLCJvbiIsIl9vbkRldmljZUxvc3QiLCJ0ZXh0dXJlQ29sb3IiLCJ0ZXh0dXJlRGVwdGgiLCJkZXB0aFV2TWF0cml4IiwiZGVwdGhWYWx1ZVRvTWV0ZXJzIiwiX3RoaXMkX2RlcHRoSW5mbyIsInJhd1ZhbHVlVG9NZXRlcnMiLCJ2aWV3cG9ydCIsInByb2pNYXQiLCJwcm9qVmlld09mZk1hdCIsInZpZXdPZmZNYXQiLCJ2aWV3SW52T2ZmTWF0Iiwidmlld01hdDMiLCJwb3NpdGlvbkRhdGEiLCJ1cGRhdGUiLCJmcmFtZSIsImxheWVyIiwic2Vzc2lvbiIsInJlbmRlclN0YXRlIiwiYmFzZUxheWVyIiwiZ2V0Vmlld3BvcnQiLCJ4IiwieSIsInoiLCJ3Iiwic2V0IiwicHJvamVjdGlvbk1hdHJpeCIsInRyYW5zZm9ybSIsImludmVyc2UiLCJtYXRyaXgiLCJfdXBkYXRlVGV4dHVyZUNvbG9yIiwiX3VwZGF0ZURlcHRoIiwiYmluZGluZyIsIndlYmdsQmluZGluZyIsInRleHR1cmUiLCJnZXRDYW1lcmFJbWFnZSIsImdsIiwiX2ZyYW1lQnVmZmVyU291cmNlIiwiY3JlYXRlRnJhbWVidWZmZXIiLCJfZnJhbWVCdWZmZXIiLCJfZGV2aWNlJGV4dERyYXdCdWZmZXIiLCJfZGV2aWNlJGV4dERyYXdCdWZmZXIyIiwiYXR0YWNobWVudEJhc2VDb25zdGFudCIsImlzV2ViR0wyIiwiQ09MT1JfQVRUQUNITUVOVDAiLCJleHREcmF3QnVmZmVycyIsIkNPTE9SX0FUVEFDSE1FTlQwX1dFQkdMIiwic2V0RnJhbWVidWZmZXIiLCJmcmFtZWJ1ZmZlclRleHR1cmUyRCIsIkZSQU1FQlVGRkVSIiwiVEVYVFVSRV8yRCIsImltcGwiLCJfZ2xUZXh0dXJlIiwiYmluZEZyYW1lYnVmZmVyIiwiUkVBRF9GUkFNRUJVRkZFUiIsIkRSQVdfRlJBTUVCVUZGRVIiLCJibGl0RnJhbWVidWZmZXIiLCJDT0xPUl9CVUZGRVJfQklUIiwiTkVBUkVTVCIsIl90aGlzJF9kZXB0aEluZm8yIiwiX3RoaXMkX2RlcHRoSW5mbzMiLCJncHUiLCJkZXB0aEdwdU9wdGltaXplZCIsImluZm9Tb3VyY2UiLCJkZXB0aEluZm8iLCJnZXREZXB0aEluZm9ybWF0aW9uIiwibWF0cml4RGlydHkiLCJyZXNpemVkIiwiX3dpZHRoIiwiX2hlaWdodCIsImRhdGEiLCJub3JtRGVwdGhCdWZmZXJGcm9tTm9ybVZpZXciLCJzZXRJZGVudGl0eSIsInVwbG9hZCIsImZpcmUiLCJ1cGRhdGVUcmFuc2Zvcm1zIiwibXVsMiIsImNvcHkiLCJpbnZlcnQiLCJzZXRGcm9tTWF0NCIsImdldERlcHRoIiwidSIsInYiLCJfdGhpcyRfZGVwdGhJbmZvJGdldEQiLCJfdGhpcyRfZGVwdGhJbmZvNCIsImdldERlcHRoSW5NZXRlcnMiLCJkZXN0cm95IiwiZGVsZXRlRnJhbWVidWZmZXIiLCJFVkVOVF9ERVBUSFJFU0laRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsTUFBTSxTQUFTQyxZQUFZLENBQUM7QUFvSDlCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxPQUFPLEVBQUVDLE1BQU0sRUFBRUMsVUFBVSxFQUFFO0FBQ3JDLElBQUEsS0FBSyxFQUFFLENBQUE7QUFoSFg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVA7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsYUFBYSxHQUFHLElBQUlDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUVuQztBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFFdEI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsUUFBUSxHQUFH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
