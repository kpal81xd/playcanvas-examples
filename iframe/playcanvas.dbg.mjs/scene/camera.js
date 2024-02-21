import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';
import { Frustum } from '../core/shape/frustum.js';
import { ASPECT_AUTO, LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE, PROJECTION_PERSPECTIVE } from './constants.js';
import { RenderPassColorGrab } from './graphics/render-pass-color-grab.js';
import { RenderPassDepthGrab } from './graphics/render-pass-depth-grab.js';
import { RenderPassDepth } from './graphics/render-pass-depth.js';

// pre-allocated temp variables
const _deviceCoord = new Vec3();
const _halfSize = new Vec3();
const _point = new Vec3();
const _invViewProjMat = new Mat4();
const _frustumPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

/**
 * A camera.
 *
 * @ignore
 */
class Camera {
  constructor() {
    /**
     * @type {import('./shader-pass.js').ShaderPassInfo|null}
     */
    this.shaderPassInfo = null;
    /**
     * @type {RenderPassColorGrab|null}
     */
    this.renderPassColorGrab = null;
    /**
     * @type {import('../platform/graphics/render-pass.js').RenderPass|null}
     */
    this.renderPassDepthGrab = null;
    /**
     * Render passes used to render this camera. If empty, the camera will render using the default
     * render passes.
     *
     * @type {import('../platform/graphics/render-pass.js').RenderPass[]}
     */
    this.renderPasses = [];
    /** @type {number} */
    this.jitter = 0;
    this._aspectRatio = 16 / 9;
    this._aspectRatioMode = ASPECT_AUTO;
    this._calculateProjection = null;
    this._calculateTransform = null;
    this._clearColor = new Color(0.75, 0.75, 0.75, 1);
    this._clearColorBuffer = true;
    this._clearDepth = 1;
    this._clearDepthBuffer = true;
    this._clearStencil = 0;
    this._clearStencilBuffer = true;
    this._cullFaces = true;
    this._farClip = 1000;
    this._flipFaces = false;
    this._fov = 45;
    this._frustumCulling = true;
    this._horizontalFov = false;
    this._layers = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE];
    this._layersSet = new Set(this._layers);
    this._nearClip = 0.1;
    this._node = null;
    this._orthoHeight = 10;
    this._projection = PROJECTION_PERSPECTIVE;
    this._rect = new Vec4(0, 0, 1, 1);
    this._renderTarget = null;
    this._scissorRect = new Vec4(0, 0, 1, 1);
    this._scissorRectClear = false; // by default rect is used when clearing. this allows scissorRect to be used when clearing.
    this._aperture = 16.0;
    this._shutter = 1.0 / 1000.0;
    this._sensitivity = 1000;
    this._projMat = new Mat4();
    this._projMatDirty = true;
    this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
    this._viewMat = new Mat4();
    this._viewMatDirty = true;
    this._viewProjMat = new Mat4();
    this._viewProjMatDirty = true;
    this.frustum = new Frustum();

    // Set by XrManager
    this._xr = null;
    this._xrProperties = {
      horizontalFov: this._horizontalFov,
      fov: this._fov,
      aspectRatio: this._aspectRatio,
      farClip: this._farClip,
      nearClip: this._nearClip
    };
  }
  destroy() {
    var _this$renderPassColor, _this$renderPassDepth;
    (_this$renderPassColor = this.renderPassColorGrab) == null || _this$renderPassColor.destroy();
    this.renderPassColorGrab = null;
    (_this$renderPassDepth = this.renderPassDepthGrab) == null || _this$renderPassDepth.destroy();
    this.renderPassDepthGrab = null;
    this.renderPasses.length = 0;
  }

  /**
   * True if the camera clears the full render target. (viewport / scissor are full size)
   */
  get fullSizeClearRect() {
    const rect = this._scissorRectClear ? this.scissorRect : this._rect;
    return rect.x === 0 && rect.y === 0 && rect.z === 1 && rect.w === 1;
  }
  set aspectRatio(newValue) {
    if (this._aspectRatio !== newValue) {
      this._aspectRatio = newValue;
      this._projMatDirty = true;
    }
  }
  get aspectRatio() {
    var _this$xr;
    return (_this$xr = this.xr) != null && _this$xr.active ? this._xrProperties.aspectRatio : this._aspectRatio;
  }
  set aspectRatioMode(newValue) {
    if (this._aspectRatioMode !== newValue) {
      this._aspectRatioMode = newValue;
      this._projMatDirty = true;
    }
  }
  get aspectRatioMode() {
    return this._aspectRatioMode;
  }
  set calculateProjection(newValue) {
    this._calculateProjection = newValue;
    this._projMatDirty = true;
  }
  get calculateProjection() {
    return this._calculateProjection;
  }
  set calculateTransform(newValue) {
    this._calculateTransform = newValue;
  }
  get calculateTransform() {
    return this._calculateTransform;
  }
  set clearColor(newValue) {
    this._clearColor.copy(newValue);
  }
  get clearColor() {
    return this._clearColor;
  }
  set clearColorBuffer(newValue) {
    this._clearColorBuffer = newValue;
  }
  get clearColorBuffer() {
    return this._clearColorBuffer;
  }
  set clearDepth(newValue) {
    this._clearDepth = newValue;
  }
  get clearDepth() {
    return this._clearDepth;
  }
  set clearDepthBuffer(newValue) {
    this._clearDepthBuffer = newValue;
  }
  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }
  set clearStencil(newValue) {
    this._clearStencil = newValue;
  }
  get clearStencil() {
    return this._clearStencil;
  }
  set clearStencilBuffer(newValue) {
    this._clearStencilBuffer = newValue;
  }
  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }
  set cullFaces(newValue) {
    this._cullFaces = newValue;
  }
  get cullFaces() {
    return this._cullFaces;
  }
  set farClip(newValue) {
    if (this._farClip !== newValue) {
      this._farClip = newValue;
      this._projMatDirty = true;
    }
  }
  get farClip() {
    var _this$xr2;
    return (_this$xr2 = this.xr) != null && _this$xr2.active ? this._xrProperties.farClip : this._farClip;
  }
  set flipFaces(newValue) {
    this._flipFaces = newValue;
  }
  get flipFaces() {
    return this._flipFaces;
  }
  set fov(newValue) {
    if (this._fov !== newValue) {
      this._fov = newValue;
      this._projMatDirty = true;
    }
  }
  get fov() {
    var _this$xr3;
    return (_this$xr3 = this.xr) != null && _this$xr3.active ? this._xrProperties.fov : this._fov;
  }
  set frustumCulling(newValue) {
    this._frustumCulling = newValue;
  }
  get frustumCulling() {
    return this._frustumCulling;
  }
  set horizontalFov(newValue) {
    if (this._horizontalFov !== newValue) {
      this._horizontalFov = newValue;
      this._projMatDirty = true;
    }
  }
  get horizontalFov() {
    var _this$xr4;
    return (_this$xr4 = this.xr) != null && _this$xr4.active ? this._xrProperties.horizontalFov : this._horizontalFov;
  }
  set layers(newValue) {
    this._layers = newValue.slice(0);
    this._layersSet = new Set(this._layers);
  }
  get layers() {
    return this._layers;
  }
  get layersSet() {
    return this._layersSet;
  }
  set nearClip(newValue) {
    if (this._nearClip !== newValue) {
      this._nearClip = newValue;
      this._projMatDirty = true;
    }
  }
  get nearClip() {
    var _this$xr5;
    return (_this$xr5 = this.xr) != null && _this$xr5.active ? this._xrProperties.nearClip : this._nearClip;
  }
  set node(newValue) {
    this._node = newValue;
  }
  get node() {
    return this._node;
  }
  set orthoHeight(newValue) {
    if (this._orthoHeight !== newValue) {
      this._orthoHeight = newValue;
      this._projMatDirty = true;
    }
  }
  get orthoHeight() {
    return this._orthoHeight;
  }
  set projection(newValue) {
    if (this._projection !== newValue) {
      this._projection = newValue;
      this._projMatDirty = true;
    }
  }
  get projection() {
    return this._projection;
  }
  get projectionMatrix() {
    this._evaluateProjectionMatrix();
    return this._projMat;
  }
  set rect(newValue) {
    this._rect.copy(newValue);
  }
  get rect() {
    return this._rect;
  }
  set renderTarget(newValue) {
    this._renderTarget = newValue;
  }
  get renderTarget() {
    return this._renderTarget;
  }
  set scissorRect(newValue) {
    this._scissorRect.copy(newValue);
  }
  get scissorRect() {
    return this._scissorRect;
  }
  get viewMatrix() {
    if (this._viewMatDirty) {
      const wtm = this._node.getWorldTransform();
      this._viewMat.copy(wtm).invert();
      this._viewMatDirty = false;
    }
    return this._viewMat;
  }
  set aperture(newValue) {
    this._aperture = newValue;
  }
  get aperture() {
    return this._aperture;
  }
  set sensitivity(newValue) {
    this._sensitivity = newValue;
  }
  get sensitivity() {
    return this._sensitivity;
  }
  set shutter(newValue) {
    this._shutter = newValue;
  }
  get shutter() {
    return this._shutter;
  }
  set xr(newValue) {
    if (this._xr !== newValue) {
      this._xr = newValue;
      this._projMatDirty = true;
    }
  }
  get xr() {
    return this._xr;
  }

  /**
   * Creates a duplicate of the camera.
   *
   * @returns {Camera} A cloned Camera.
   */
  clone() {
    return new Camera().copy(this);
  }

  /**
   * Copies one camera to another.
   *
   * @param {Camera} other - Camera to copy.
   * @returns {Camera} Self for chaining.
   */
  copy(other) {
    // We aren't using the getters and setters because there is additional logic
    // around using WebXR in the getters for these properties so that functions
    // like screenToWorld work correctly with other systems like the UI input
    // system
    this._aspectRatio = other._aspectRatio;
    this._farClip = other._farClip;
    this._fov = other._fov;
    this._horizontalFov = other._horizontalFov;
    this._nearClip = other._nearClip;
    this._xrProperties.aspectRatio = other._xrProperties.aspectRatio;
    this._xrProperties.farClip = other._xrProperties.farClip;
    this._xrProperties.fov = other._xrProperties.fov;
    this._xrProperties.horizontalFov = other._xrProperties.horizontalFov;
    this._xrProperties.nearClip = other._xrProperties.nearClip;
    this.aspectRatioMode = other.aspectRatioMode;
    this.calculateProjection = other.calculateProjection;
    this.calculateTransform = other.calculateTransform;
    this.clearColor = other.clearColor;
    this.clearColorBuffer = other.clearColorBuffer;
    this.clearDepth = other.clearDepth;
    this.clearDepthBuffer = other.clearDepthBuffer;
    this.clearStencil = other.clearStencil;
    this.clearStencilBuffer = other.clearStencilBuffer;
    this.cullFaces = other.cullFaces;
    this.flipFaces = other.flipFaces;
    this.frustumCulling = other.frustumCulling;
    this.layers = other.layers;
    this.orthoHeight = other.orthoHeight;
    this.projection = other.projection;
    this.rect = other.rect;
    this.renderTarget = other.renderTarget;
    this.scissorRect = other.scissorRect;
    this.aperture = other.aperture;
    this.shutter = other.shutter;
    this.sensitivity = other.sensitivity;
    this.shaderPassInfo = other.shaderPassInfo;
    this.jitter = other.jitter;
    this._projMatDirty = true;
    return this;
  }
  _enableRenderPassColorGrab(device, enable) {
    if (enable) {
      if (!this.renderPassColorGrab) {
        this.renderPassColorGrab = new RenderPassColorGrab(device);
      }
    } else {
      var _this$renderPassColor2;
      (_this$renderPassColor2 = this.renderPassColorGrab) == null || _this$renderPassColor2.destroy();
      this.renderPassColorGrab = null;
    }
  }
  _enableRenderPassDepthGrab(device, renderer, enable) {
    if (enable) {
      if (!this.renderPassDepthGrab) {
        this.renderPassDepthGrab = device.isWebGL1 ? new RenderPassDepth(device, renderer, this) : new RenderPassDepthGrab(device, this);
      }
    } else {
      var _this$renderPassDepth2;
      (_this$renderPassDepth2 = this.renderPassDepthGrab) == null || _this$renderPassDepth2.destroy();
      this.renderPassDepthGrab = null;
    }
  }
  _updateViewProjMat() {
    if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
      this._viewProjMat.mul2(this.projectionMatrix, this.viewMatrix);
      this._viewProjMatDirty = false;
    }
  }

  /**
   * Convert a point from 3D world space to 2D canvas pixel space.
   *
   * @param {Vec3} worldCoord - The world space coordinate to transform.
   * @param {number} cw - The width of PlayCanvas' canvas element.
   * @param {number} ch - The height of PlayCanvas' canvas element.
   * @param {Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
   * @returns {Vec3} The screen space coordinate.
   */
  worldToScreen(worldCoord, cw, ch, screenCoord = new Vec3()) {
    this._updateViewProjMat();
    this._viewProjMat.transformPoint(worldCoord, screenCoord);

    // calculate w co-coord
    const vpm = this._viewProjMat.data;
    const w = worldCoord.x * vpm[3] + worldCoord.y * vpm[7] + worldCoord.z * vpm[11] + 1 * vpm[15];
    screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
    screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;
    return screenCoord;
  }

  /**
   * Convert a point from 2D canvas pixel space to 3D world space.
   *
   * @param {number} x - X coordinate on PlayCanvas' canvas element.
   * @param {number} y - Y coordinate on PlayCanvas' canvas element.
   * @param {number} z - The distance from the camera in world space to create the new point.
   * @param {number} cw - The width of PlayCanvas' canvas element.
   * @param {number} ch - The height of PlayCanvas' canvas element.
   * @param {Vec3} [worldCoord] - 3D vector to receive world coordinate result.
   * @returns {Vec3} The world space coordinate.
   */
  screenToWorld(x, y, z, cw, ch, worldCoord = new Vec3()) {
    // Calculate the screen click as a point on the far plane of the normalized device coordinate 'box' (z=1)
    const range = this.farClip - this.nearClip;
    _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
    _deviceCoord.mulScalar(2);
    _deviceCoord.sub(Vec3.ONE);
    if (this._projection === PROJECTION_PERSPECTIVE) {
      // calculate half width and height at the near clip plane
      Mat4._getPerspectiveHalfSize(_halfSize, this.fov, this.aspectRatio, this.nearClip, this.horizontalFov);

      // scale by normalized screen coordinates
      _halfSize.x *= _deviceCoord.x;
      _halfSize.y *= _deviceCoord.y;

      // transform to world space
      const invView = this._node.getWorldTransform();
      _halfSize.z = -this.nearClip;
      invView.transformPoint(_halfSize, _point);

      // point along camera->_point ray at distance z from the camera
      const cameraPos = this._node.getPosition();
      worldCoord.sub2(_point, cameraPos);
      worldCoord.normalize();
      worldCoord.mulScalar(z);
      worldCoord.add(cameraPos);
    } else {
      this._updateViewProjMat();
      _invViewProjMat.copy(this._viewProjMat).invert();

      // Transform to world space
      _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
    }
    return worldCoord;
  }
  _evaluateProjectionMatrix() {
    if (this._projMatDirty) {
      if (this._projection === PROJECTION_PERSPECTIVE) {
        this._projMat.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip, this.horizontalFov);
        this._projMatSkybox.copy(this._projMat);
      } else {
        const y = this._orthoHeight;
        const x = y * this.aspectRatio;
        this._projMat.setOrtho(-x, x, -y, y, this.nearClip, this.farClip);
        this._projMatSkybox.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip);
      }
      this._projMatDirty = false;
    }
  }
  getProjectionMatrixSkybox() {
    this._evaluateProjectionMatrix();
    return this._projMatSkybox;
  }
  getExposure() {
    const ev100 = Math.log2(this._aperture * this._aperture / this._shutter * 100.0 / this._sensitivity);
    return 1.0 / (Math.pow(2.0, ev100) * 1.2);
  }

  // returns estimated size of the sphere on the screen in range of [0..1]
  // 0 - infinitely small, 1 - full screen or larger
  getScreenSize(sphere) {
    if (this._projection === PROJECTION_PERSPECTIVE) {
      // camera to sphere distance
      const distance = this._node.getPosition().distance(sphere.center);

      // if we're inside the sphere
      if (distance < sphere.radius) {
        return 1;
      }

      // The view-angle of the bounding sphere rendered on screen
      const viewAngle = Math.asin(sphere.radius / distance);

      // This assumes the near clipping plane is at a distance of 1
      const sphereViewHeight = Math.tan(viewAngle);

      // The size of (half) the screen if the near clipping plane is at a distance of 1
      const screenViewHeight = Math.tan(this.fov / 2 * math.DEG_TO_RAD);

      // The ratio of the geometry's screen size compared to the actual size of the screen
      return Math.min(sphereViewHeight / screenViewHeight, 1);
    }

    // ortho
    return math.clamp(sphere.radius / this._orthoHeight, 0, 1);
  }

  /**
   * Returns an array of corners of the frustum of the camera in the local coordinate system of the camera.
   *
   * @param {number} [near] - Near distance for the frustum points. Defaults to the near clip distance of the camera.
   * @param {number} [far] - Far distance for the frustum points. Defaults to the far clip distance of the camera.
   * @returns {Vec3[]} - An array of corners, using a global storage space.
   */
  getFrustumCorners(near = this.nearClip, far = this.farClip) {
    const fov = this.fov * Math.PI / 180.0;
    let y = this._projection === PROJECTION_PERSPECTIVE ? Math.tan(fov / 2.0) * near : this._orthoHeight;
    let x = y * this.aspectRatio;
    const points = _frustumPoints;
    points[0].x = x;
    points[0].y = -y;
    points[0].z = -near;
    points[1].x = x;
    points[1].y = y;
    points[1].z = -near;
    points[2].x = -x;
    points[2].y = y;
    points[2].z = -near;
    points[3].x = -x;
    points[3].y = -y;
    points[3].z = -near;
    if (this._projection === PROJECTION_PERSPECTIVE) {
      y = Math.tan(fov / 2.0) * far;
      x = y * this.aspectRatio;
    }
    points[4].x = x;
    points[4].y = -y;
    points[4].z = -far;
    points[5].x = x;
    points[5].y = y;
    points[5].z = -far;
    points[6].x = -x;
    points[6].y = y;
    points[6].z = -far;
    points[7].x = -x;
    points[7].y = -y;
    points[7].z = -far;
    return points;
  }

  /**
   * Sets XR camera properties that should be derived physical camera in {@link XrManager}.
   *
   * @param {object} [properties] - Properties object.
   * @param {number} [properties.aspectRatio] - Aspect ratio.
   * @param {number} [properties.farClip] - Far clip.
   * @param {number} [properties.fov] - Field of view.
   * @param {boolean} [properties.horizontalFov] - Enable horizontal field of view.
   * @param {number} [properties.nearClip] - Near clip.
   */
  setXrProperties(properties) {
    Object.assign(this._xrProperties, properties);
    this._projMatDirty = true;
  }
}

export { Camera };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FtZXJhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvY2FtZXJhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEZydXN0dW0gfSBmcm9tICcuLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnO1xuXG5pbXBvcnQge1xuICAgIEFTUEVDVF9BVVRPLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIExBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJQYXNzQ29sb3JHcmFiIH0gZnJvbSAnLi9ncmFwaGljcy9yZW5kZXItcGFzcy1jb2xvci1ncmFiLmpzJztcbmltcG9ydCB7IFJlbmRlclBhc3NEZXB0aEdyYWIgfSBmcm9tICcuL2dyYXBoaWNzL3JlbmRlci1wYXNzLWRlcHRoLWdyYWIuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzc0RlcHRoIH0gZnJvbSAnLi9ncmFwaGljcy9yZW5kZXItcGFzcy1kZXB0aC5qcyc7XG5cbi8vIHByZS1hbGxvY2F0ZWQgdGVtcCB2YXJpYWJsZXNcbmNvbnN0IF9kZXZpY2VDb29yZCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BvaW50ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9pbnZWaWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfZnJ1c3R1bVBvaW50cyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuLyoqXG4gKiBBIGNhbWVyYS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIENhbWVyYSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9zaGFkZXItcGFzcy5qcycpLlNoYWRlclBhc3NJbmZvfG51bGx9XG4gICAgICovXG4gICAgc2hhZGVyUGFzc0luZm8gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlbmRlclBhc3NDb2xvckdyYWJ8bnVsbH1cbiAgICAgKi9cbiAgICByZW5kZXJQYXNzQ29sb3JHcmFiID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc3xudWxsfVxuICAgICAqL1xuICAgIHJlbmRlclBhc3NEZXB0aEdyYWIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3NlcyB1c2VkIHRvIHJlbmRlciB0aGlzIGNhbWVyYS4gSWYgZW1wdHksIHRoZSBjYW1lcmEgd2lsbCByZW5kZXIgdXNpbmcgdGhlIGRlZmF1bHRcbiAgICAgKiByZW5kZXIgcGFzc2VzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzW119XG4gICAgICovXG4gICAgcmVuZGVyUGFzc2VzID0gW107XG5cbiAgICAvKiogQHR5cGUge251bWJlcn0gKi9cbiAgICBqaXR0ZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvID0gMTYgLyA5O1xuICAgICAgICB0aGlzLl9hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfQVVUTztcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlUHJvamVjdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMC43NSwgMC43NSwgMC43NSwgMSk7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoID0gMTtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbCA9IDA7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2N1bGxGYWNlcyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2ZhckNsaXAgPSAxMDAwO1xuICAgICAgICB0aGlzLl9mbGlwRmFjZXMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZm92ID0gNDU7XG4gICAgICAgIHRoaXMuX2ZydXN0dW1DdWxsaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5faG9yaXpvbnRhbEZvdiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRCwgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9TS1lCT1gsIExBWUVSSURfVUksIExBWUVSSURfSU1NRURJQVRFXTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzU2V0ID0gbmV3IFNldCh0aGlzLl9sYXllcnMpO1xuICAgICAgICB0aGlzLl9uZWFyQ2xpcCA9IDAuMTtcbiAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX29ydGhvSGVpZ2h0ID0gMTA7XG4gICAgICAgIHRoaXMuX3Byb2plY3Rpb24gPSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgICAgICB0aGlzLl9yZWN0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NjaXNzb3JSZWN0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG4gICAgICAgIHRoaXMuX3NjaXNzb3JSZWN0Q2xlYXIgPSBmYWxzZTsgLy8gYnkgZGVmYXVsdCByZWN0IGlzIHVzZWQgd2hlbiBjbGVhcmluZy4gdGhpcyBhbGxvd3Mgc2Npc3NvclJlY3QgdG8gYmUgdXNlZCB3aGVuIGNsZWFyaW5nLlxuICAgICAgICB0aGlzLl9hcGVydHVyZSA9IDE2LjA7XG4gICAgICAgIHRoaXMuX3NodXR0ZXIgPSAxLjAgLyAxMDAwLjA7XG4gICAgICAgIHRoaXMuX3NlbnNpdGl2aXR5ID0gMTAwMDtcblxuICAgICAgICB0aGlzLl9wcm9qTWF0ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fcHJvak1hdFNreWJveCA9IG5ldyBNYXQ0KCk7IC8vIHByb2plY3Rpb24gbWF0cml4IHVzZWQgYnkgc2t5Ym94IHJlbmRlcmluZyBzaGFkZXIgaXMgYWx3YXlzIHBlcnNwZWN0aXZlXG4gICAgICAgIHRoaXMuX3ZpZXdNYXQgPSBuZXcgTWF0NCgpO1xuICAgICAgICB0aGlzLl92aWV3TWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl92aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0RGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuZnJ1c3R1bSA9IG5ldyBGcnVzdHVtKCk7XG5cbiAgICAgICAgLy8gU2V0IGJ5IFhyTWFuYWdlclxuICAgICAgICB0aGlzLl94ciA9IG51bGw7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcyA9IHtcbiAgICAgICAgICAgIGhvcml6b250YWxGb3Y6IHRoaXMuX2hvcml6b250YWxGb3YsXG4gICAgICAgICAgICBmb3Y6IHRoaXMuX2ZvdixcbiAgICAgICAgICAgIGFzcGVjdFJhdGlvOiB0aGlzLl9hc3BlY3RSYXRpbyxcbiAgICAgICAgICAgIGZhckNsaXA6IHRoaXMuX2ZhckNsaXAsXG4gICAgICAgICAgICBuZWFyQ2xpcDogdGhpcy5fbmVhckNsaXBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIHRoaXMucmVuZGVyUGFzc0NvbG9yR3JhYj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NDb2xvckdyYWIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVuZGVyUGFzc0RlcHRoR3JhYj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NEZXB0aEdyYWIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVuZGVyUGFzc2VzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgY2FtZXJhIGNsZWFycyB0aGUgZnVsbCByZW5kZXIgdGFyZ2V0LiAodmlld3BvcnQgLyBzY2lzc29yIGFyZSBmdWxsIHNpemUpXG4gICAgICovXG4gICAgZ2V0IGZ1bGxTaXplQ2xlYXJSZWN0KCkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5fc2Npc3NvclJlY3RDbGVhciA/IHRoaXMuc2Npc3NvclJlY3QgOiB0aGlzLl9yZWN0O1xuICAgICAgICByZXR1cm4gcmVjdC54ID09PSAwICYmIHJlY3QueSA9PT0gMCAmJiByZWN0LnogPT09IDEgJiYgcmVjdC53ID09PSAxO1xuICAgIH1cblxuICAgIHNldCBhc3BlY3RSYXRpbyhuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYXNwZWN0UmF0aW8gIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3BlY3RSYXRpbyA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpbygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvIDogdGhpcy5fYXNwZWN0UmF0aW87XG4gICAgfVxuXG4gICAgc2V0IGFzcGVjdFJhdGlvTW9kZShuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYXNwZWN0UmF0aW9Nb2RlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNwZWN0UmF0aW9Nb2RlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzcGVjdFJhdGlvTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FzcGVjdFJhdGlvTW9kZTtcbiAgICB9XG5cbiAgICBzZXQgY2FsY3VsYXRlUHJvamVjdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVQcm9qZWN0aW9uID0gbmV3VmFsdWU7XG4gICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVQcm9qZWN0aW9uO1xuICAgIH1cblxuICAgIHNldCBjYWxjdWxhdGVUcmFuc2Zvcm0obmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlVHJhbnNmb3JtID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJDb2xvcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yLmNvcHkobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJDb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJDb2xvckJ1ZmZlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yQnVmZmVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckNvbG9yQnVmZmVyO1xuICAgIH1cblxuICAgIHNldCBjbGVhckRlcHRoKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGggPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJEZXB0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyRGVwdGg7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJTdGVuY2lsKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbCA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhclN0ZW5jaWw7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXIgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJTdGVuY2lsQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIHNldCBjdWxsRmFjZXMobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VsbEZhY2VzID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGN1bGxGYWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1bGxGYWNlcztcbiAgICB9XG5cbiAgICBzZXQgZmFyQ2xpcChuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmFyQ2xpcCAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZhckNsaXAgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZmFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmZhckNsaXAgOiB0aGlzLl9mYXJDbGlwO1xuICAgIH1cblxuICAgIHNldCBmbGlwRmFjZXMobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZmxpcEZhY2VzID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBGYWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBGYWNlcztcbiAgICB9XG5cbiAgICBzZXQgZm92KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mb3YgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9mb3YgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZm92KCkge1xuICAgICAgICByZXR1cm4gKHRoaXMueHI/LmFjdGl2ZSkgPyB0aGlzLl94clByb3BlcnRpZXMuZm92IDogdGhpcy5fZm92O1xuICAgIH1cblxuICAgIHNldCBmcnVzdHVtQ3VsbGluZyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9mcnVzdHVtQ3VsbGluZyA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcnVzdHVtQ3VsbGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZydXN0dW1DdWxsaW5nO1xuICAgIH1cblxuICAgIHNldCBob3Jpem9udGFsRm92KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9ob3Jpem9udGFsRm92ICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5faG9yaXpvbnRhbEZvdiA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBob3Jpem9udGFsRm92KCkge1xuICAgICAgICByZXR1cm4gKHRoaXMueHI/LmFjdGl2ZSkgPyB0aGlzLl94clByb3BlcnRpZXMuaG9yaXpvbnRhbEZvdiA6IHRoaXMuX2hvcml6b250YWxGb3Y7XG4gICAgfVxuXG4gICAgc2V0IGxheWVycyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBuZXdWYWx1ZS5zbGljZSgwKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzU2V0ID0gbmV3IFNldCh0aGlzLl9sYXllcnMpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyc1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1NldDtcbiAgICB9XG5cbiAgICBzZXQgbmVhckNsaXAobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25lYXJDbGlwICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbmVhckNsaXAgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbmVhckNsaXAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy54cj8uYWN0aXZlKSA/IHRoaXMuX3hyUHJvcGVydGllcy5uZWFyQ2xpcCA6IHRoaXMuX25lYXJDbGlwO1xuICAgIH1cblxuICAgIHNldCBub2RlKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX25vZGUgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbm9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25vZGU7XG4gICAgfVxuXG4gICAgc2V0IG9ydGhvSGVpZ2h0KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9vcnRob0hlaWdodCAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX29ydGhvSGVpZ2h0ID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9ydGhvSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3J0aG9IZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0IHByb2plY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9qZWN0aW9uID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9qZWN0aW9uO1xuICAgIH1cblxuICAgIGdldCBwcm9qZWN0aW9uTWF0cml4KCkge1xuICAgICAgICB0aGlzLl9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2pNYXQ7XG4gICAgfVxuXG4gICAgc2V0IHJlY3QobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVjdC5jb3B5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgcmVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY3Q7XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclRhcmdldChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9yZW5kZXJUYXJnZXQgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyVGFyZ2V0O1xuICAgIH1cblxuICAgIHNldCBzY2lzc29yUmVjdChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9zY2lzc29yUmVjdC5jb3B5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgc2Npc3NvclJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY2lzc29yUmVjdDtcbiAgICB9XG5cbiAgICBnZXQgdmlld01hdHJpeCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdNYXREaXJ0eSkge1xuICAgICAgICAgICAgY29uc3Qgd3RtID0gdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgdGhpcy5fdmlld01hdC5jb3B5KHd0bSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLl92aWV3TWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdmlld01hdDtcbiAgICB9XG5cbiAgICBzZXQgYXBlcnR1cmUobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXBlcnR1cmUgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBlcnR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hcGVydHVyZTtcbiAgICB9XG5cbiAgICBzZXQgc2Vuc2l0aXZpdHkobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2Vuc2l0aXZpdHkgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc2Vuc2l0aXZpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZW5zaXRpdml0eTtcbiAgICB9XG5cbiAgICBzZXQgc2h1dHRlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9zaHV0dGVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNodXR0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaHV0dGVyO1xuICAgIH1cblxuICAgIHNldCB4cihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5feHIgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl94ciA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB4cigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBkdXBsaWNhdGUgb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtDYW1lcmF9IEEgY2xvbmVkIENhbWVyYS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDYW1lcmEoKS5jb3B5KHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBvbmUgY2FtZXJhIHRvIGFub3RoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYX0gb3RoZXIgLSBDYW1lcmEgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7Q2FtZXJhfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjb3B5KG90aGVyKSB7XG4gICAgICAgIC8vIFdlIGFyZW4ndCB1c2luZyB0aGUgZ2V0dGVycyBhbmQgc2V0dGVycyBiZWNhdXNlIHRoZXJlIGlzIGFkZGl0aW9uYWwgbG9naWNcbiAgICAgICAgLy8gYXJvdW5kIHVzaW5nIFdlYlhSIGluIHRoZSBnZXR0ZXJzIGZvciB0aGVzZSBwcm9wZXJ0aWVzIHNvIHRoYXQgZnVuY3Rpb25zXG4gICAgICAgIC8vIGxpa2Ugc2NyZWVuVG9Xb3JsZCB3b3JrIGNvcnJlY3RseSB3aXRoIG90aGVyIHN5c3RlbXMgbGlrZSB0aGUgVUkgaW5wdXRcbiAgICAgICAgLy8gc3lzdGVtXG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvID0gb3RoZXIuX2FzcGVjdFJhdGlvO1xuICAgICAgICB0aGlzLl9mYXJDbGlwID0gb3RoZXIuX2ZhckNsaXA7XG4gICAgICAgIHRoaXMuX2ZvdiA9IG90aGVyLl9mb3Y7XG4gICAgICAgIHRoaXMuX2hvcml6b250YWxGb3YgPSBvdGhlci5faG9yaXpvbnRhbEZvdjtcbiAgICAgICAgdGhpcy5fbmVhckNsaXAgPSBvdGhlci5fbmVhckNsaXA7XG5cbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvID0gb3RoZXIuX3hyUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmZhckNsaXAgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmZhckNsaXA7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5mb3YgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmZvdjtcbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmhvcml6b250YWxGb3YgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmhvcml6b250YWxGb3Y7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5uZWFyQ2xpcCA9IG90aGVyLl94clByb3BlcnRpZXMubmVhckNsaXA7XG5cbiAgICAgICAgdGhpcy5hc3BlY3RSYXRpb01vZGUgPSBvdGhlci5hc3BlY3RSYXRpb01vZGU7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlUHJvamVjdGlvbiA9IG90aGVyLmNhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlVHJhbnNmb3JtID0gb3RoZXIuY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBvdGhlci5jbGVhckNvbG9yO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3JCdWZmZXIgPSBvdGhlci5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSBvdGhlci5jbGVhckRlcHRoO1xuICAgICAgICB0aGlzLmNsZWFyRGVwdGhCdWZmZXIgPSBvdGhlci5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IG90aGVyLmNsZWFyU3RlbmNpbDtcbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWxCdWZmZXIgPSBvdGhlci5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgICAgIHRoaXMuY3VsbEZhY2VzID0gb3RoZXIuY3VsbEZhY2VzO1xuICAgICAgICB0aGlzLmZsaXBGYWNlcyA9IG90aGVyLmZsaXBGYWNlcztcbiAgICAgICAgdGhpcy5mcnVzdHVtQ3VsbGluZyA9IG90aGVyLmZydXN0dW1DdWxsaW5nO1xuICAgICAgICB0aGlzLmxheWVycyA9IG90aGVyLmxheWVycztcbiAgICAgICAgdGhpcy5vcnRob0hlaWdodCA9IG90aGVyLm9ydGhvSGVpZ2h0O1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBvdGhlci5wcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLnJlY3QgPSBvdGhlci5yZWN0O1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG90aGVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgdGhpcy5zY2lzc29yUmVjdCA9IG90aGVyLnNjaXNzb3JSZWN0O1xuICAgICAgICB0aGlzLmFwZXJ0dXJlID0gb3RoZXIuYXBlcnR1cmU7XG4gICAgICAgIHRoaXMuc2h1dHRlciA9IG90aGVyLnNodXR0ZXI7XG4gICAgICAgIHRoaXMuc2Vuc2l0aXZpdHkgPSBvdGhlci5zZW5zaXRpdml0eTtcblxuICAgICAgICB0aGlzLnNoYWRlclBhc3NJbmZvID0gb3RoZXIuc2hhZGVyUGFzc0luZm87XG4gICAgICAgIHRoaXMuaml0dGVyID0gb3RoZXIuaml0dGVyO1xuXG4gICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgX2VuYWJsZVJlbmRlclBhc3NDb2xvckdyYWIoZGV2aWNlLCBlbmFibGUpIHtcbiAgICAgICAgaWYgKGVuYWJsZSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlbmRlclBhc3NDb2xvckdyYWIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NDb2xvckdyYWIgPSBuZXcgUmVuZGVyUGFzc0NvbG9yR3JhYihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzQ29sb3JHcmFiPy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NDb2xvckdyYWIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2VuYWJsZVJlbmRlclBhc3NEZXB0aEdyYWIoZGV2aWNlLCByZW5kZXJlciwgZW5hYmxlKSB7XG4gICAgICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJQYXNzRGVwdGhHcmFiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzRGVwdGhHcmFiID0gZGV2aWNlLmlzV2ViR0wxID9cbiAgICAgICAgICAgICAgICAgICAgbmV3IFJlbmRlclBhc3NEZXB0aChkZXZpY2UsIHJlbmRlcmVyLCB0aGlzKSA6XG4gICAgICAgICAgICAgICAgICAgIG5ldyBSZW5kZXJQYXNzRGVwdGhHcmFiKGRldmljZSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NEZXB0aEdyYWI/LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc0RlcHRoR3JhYiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVmlld1Byb2pNYXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qTWF0RGlydHkgfHwgdGhpcy5fdmlld01hdERpcnR5IHx8IHRoaXMuX3ZpZXdQcm9qTWF0RGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0Lm11bDIodGhpcy5wcm9qZWN0aW9uTWF0cml4LCB0aGlzLnZpZXdNYXRyaXgpO1xuICAgICAgICAgICAgdGhpcy5fdmlld1Byb2pNYXREaXJ0eSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gM0Qgd29ybGQgc3BhY2UgdG8gMkQgY2FudmFzIHBpeGVsIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSB3b3JsZENvb3JkIC0gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUgdG8gdHJhbnNmb3JtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdyAtIFRoZSB3aWR0aCBvZiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2ggLSBUaGUgaGVpZ2h0IG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3NjcmVlbkNvb3JkXSAtIDNEIHZlY3RvciB0byByZWNlaXZlIHNjcmVlbiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHNjcmVlbiBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqL1xuICAgIHdvcmxkVG9TY3JlZW4od29ybGRDb29yZCwgY3csIGNoLCBzY3JlZW5Db29yZCA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlVmlld1Byb2pNYXQoKTtcbiAgICAgICAgdGhpcy5fdmlld1Byb2pNYXQudHJhbnNmb3JtUG9pbnQod29ybGRDb29yZCwgc2NyZWVuQ29vcmQpO1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSB3IGNvLWNvb3JkXG4gICAgICAgIGNvbnN0IHZwbSA9IHRoaXMuX3ZpZXdQcm9qTWF0LmRhdGE7XG4gICAgICAgIGNvbnN0IHcgPSB3b3JsZENvb3JkLnggKiB2cG1bM10gK1xuICAgICAgICAgICAgICAgIHdvcmxkQ29vcmQueSAqIHZwbVs3XSArXG4gICAgICAgICAgICAgICAgd29ybGRDb29yZC56ICogdnBtWzExXSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAxICogdnBtWzE1XTtcblxuICAgICAgICBzY3JlZW5Db29yZC54ID0gKHNjcmVlbkNvb3JkLnggLyB3ICsgMSkgKiAwLjUgKiBjdztcbiAgICAgICAgc2NyZWVuQ29vcmQueSA9ICgxIC0gc2NyZWVuQ29vcmQueSAvIHcpICogMC41ICogY2g7XG5cbiAgICAgICAgcmV0dXJuIHNjcmVlbkNvb3JkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYSBwb2ludCBmcm9tIDJEIGNhbnZhcyBwaXhlbCBzcGFjZSB0byAzRCB3b3JsZCBzcGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gWCBjb29yZGluYXRlIG9uIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gWSBjb29yZGluYXRlIG9uIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIGNhbWVyYSBpbiB3b3JsZCBzcGFjZSB0byBjcmVhdGUgdGhlIG5ldyBwb2ludC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3cgLSBUaGUgd2lkdGggb2YgUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNoIC0gVGhlIGhlaWdodCBvZiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt3b3JsZENvb3JkXSAtIDNEIHZlY3RvciB0byByZWNlaXZlIHdvcmxkIGNvb3JkaW5hdGUgcmVzdWx0LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICBzY3JlZW5Ub1dvcmxkKHgsIHksIHosIGN3LCBjaCwgd29ybGRDb29yZCA9IG5ldyBWZWMzKCkpIHtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgdGhlIHNjcmVlbiBjbGljayBhcyBhIHBvaW50IG9uIHRoZSBmYXIgcGxhbmUgb2YgdGhlIG5vcm1hbGl6ZWQgZGV2aWNlIGNvb3JkaW5hdGUgJ2JveCcgKHo9MSlcbiAgICAgICAgY29uc3QgcmFuZ2UgPSB0aGlzLmZhckNsaXAgLSB0aGlzLm5lYXJDbGlwO1xuICAgICAgICBfZGV2aWNlQ29vcmQuc2V0KHggLyBjdywgKGNoIC0geSkgLyBjaCwgeiAvIHJhbmdlKTtcbiAgICAgICAgX2RldmljZUNvb3JkLm11bFNjYWxhcigyKTtcbiAgICAgICAgX2RldmljZUNvb3JkLnN1YihWZWMzLk9ORSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGhhbGYgd2lkdGggYW5kIGhlaWdodCBhdCB0aGUgbmVhciBjbGlwIHBsYW5lXG4gICAgICAgICAgICBNYXQ0Ll9nZXRQZXJzcGVjdGl2ZUhhbGZTaXplKF9oYWxmU2l6ZSwgdGhpcy5mb3YsIHRoaXMuYXNwZWN0UmF0aW8sIHRoaXMubmVhckNsaXAsIHRoaXMuaG9yaXpvbnRhbEZvdik7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlIGJ5IG5vcm1hbGl6ZWQgc2NyZWVuIGNvb3JkaW5hdGVzXG4gICAgICAgICAgICBfaGFsZlNpemUueCAqPSBfZGV2aWNlQ29vcmQueDtcbiAgICAgICAgICAgIF9oYWxmU2l6ZS55ICo9IF9kZXZpY2VDb29yZC55O1xuXG4gICAgICAgICAgICAvLyB0cmFuc2Zvcm0gdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgIGNvbnN0IGludlZpZXcgPSB0aGlzLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBfaGFsZlNpemUueiA9IC10aGlzLm5lYXJDbGlwO1xuICAgICAgICAgICAgaW52Vmlldy50cmFuc2Zvcm1Qb2ludChfaGFsZlNpemUsIF9wb2ludCk7XG5cbiAgICAgICAgICAgIC8vIHBvaW50IGFsb25nIGNhbWVyYS0+X3BvaW50IHJheSBhdCBkaXN0YW5jZSB6IGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgY29uc3QgY2FtZXJhUG9zID0gdGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgd29ybGRDb29yZC5zdWIyKF9wb2ludCwgY2FtZXJhUG9zKTtcbiAgICAgICAgICAgIHdvcmxkQ29vcmQubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB3b3JsZENvb3JkLm11bFNjYWxhcih6KTtcbiAgICAgICAgICAgIHdvcmxkQ29vcmQuYWRkKGNhbWVyYVBvcyk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVmlld1Byb2pNYXQoKTtcbiAgICAgICAgICAgIF9pbnZWaWV3UHJvak1hdC5jb3B5KHRoaXMuX3ZpZXdQcm9qTWF0KS5pbnZlcnQoKTtcblxuICAgICAgICAgICAgICAgIC8vIFRyYW5zZm9ybSB0byB3b3JsZCBzcGFjZVxuICAgICAgICAgICAgX2ludlZpZXdQcm9qTWF0LnRyYW5zZm9ybVBvaW50KF9kZXZpY2VDb29yZCwgd29ybGRDb29yZCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gd29ybGRDb29yZDtcbiAgICB9XG5cbiAgICBfZXZhbHVhdGVQcm9qZWN0aW9uTWF0cml4KCkge1xuICAgICAgICBpZiAodGhpcy5fcHJvak1hdERpcnR5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9QRVJTUEVDVElWRSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Byb2pNYXQuc2V0UGVyc3BlY3RpdmUodGhpcy5mb3YsIHRoaXMuYXNwZWN0UmF0aW8sIHRoaXMubmVhckNsaXAsIHRoaXMuZmFyQ2xpcCwgdGhpcy5ob3Jpem9udGFsRm92KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0U2t5Ym94LmNvcHkodGhpcy5fcHJvak1hdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSB0aGlzLl9vcnRob0hlaWdodDtcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0geSAqIHRoaXMuYXNwZWN0UmF0aW87XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdC5zZXRPcnRobygteCwgeCwgLXksIHksIHRoaXMubmVhckNsaXAsIHRoaXMuZmFyQ2xpcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdFNreWJveC5zZXRQZXJzcGVjdGl2ZSh0aGlzLmZvdiwgdGhpcy5hc3BlY3RSYXRpbywgdGhpcy5uZWFyQ2xpcCwgdGhpcy5mYXJDbGlwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRQcm9qZWN0aW9uTWF0cml4U2t5Ym94KCkge1xuICAgICAgICB0aGlzLl9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2pNYXRTa3lib3g7XG4gICAgfVxuXG4gICAgZ2V0RXhwb3N1cmUoKSB7XG4gICAgICAgIGNvbnN0IGV2MTAwID0gTWF0aC5sb2cyKCh0aGlzLl9hcGVydHVyZSAqIHRoaXMuX2FwZXJ0dXJlKSAvIHRoaXMuX3NodXR0ZXIgKiAxMDAuMCAvIHRoaXMuX3NlbnNpdGl2aXR5KTtcbiAgICAgICAgcmV0dXJuIDEuMCAvIChNYXRoLnBvdygyLjAsIGV2MTAwKSAqIDEuMik7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBlc3RpbWF0ZWQgc2l6ZSBvZiB0aGUgc3BoZXJlIG9uIHRoZSBzY3JlZW4gaW4gcmFuZ2Ugb2YgWzAuLjFdXG4gICAgLy8gMCAtIGluZmluaXRlbHkgc21hbGwsIDEgLSBmdWxsIHNjcmVlbiBvciBsYXJnZXJcbiAgICBnZXRTY3JlZW5TaXplKHNwaGVyZSkge1xuXG4gICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFKSB7XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSB0byBzcGhlcmUgZGlzdGFuY2VcbiAgICAgICAgICAgIGNvbnN0IGRpc3RhbmNlID0gdGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpLmRpc3RhbmNlKHNwaGVyZS5jZW50ZXIpO1xuXG4gICAgICAgICAgICAvLyBpZiB3ZSdyZSBpbnNpZGUgdGhlIHNwaGVyZVxuICAgICAgICAgICAgaWYgKGRpc3RhbmNlIDwgc3BoZXJlLnJhZGl1cykge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUaGUgdmlldy1hbmdsZSBvZiB0aGUgYm91bmRpbmcgc3BoZXJlIHJlbmRlcmVkIG9uIHNjcmVlblxuICAgICAgICAgICAgY29uc3Qgdmlld0FuZ2xlID0gTWF0aC5hc2luKHNwaGVyZS5yYWRpdXMgLyBkaXN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIFRoaXMgYXNzdW1lcyB0aGUgbmVhciBjbGlwcGluZyBwbGFuZSBpcyBhdCBhIGRpc3RhbmNlIG9mIDFcbiAgICAgICAgICAgIGNvbnN0IHNwaGVyZVZpZXdIZWlnaHQgPSBNYXRoLnRhbih2aWV3QW5nbGUpO1xuXG4gICAgICAgICAgICAvLyBUaGUgc2l6ZSBvZiAoaGFsZikgdGhlIHNjcmVlbiBpZiB0aGUgbmVhciBjbGlwcGluZyBwbGFuZSBpcyBhdCBhIGRpc3RhbmNlIG9mIDFcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlblZpZXdIZWlnaHQgPSBNYXRoLnRhbigodGhpcy5mb3YgLyAyKSAqIG1hdGguREVHX1RPX1JBRCk7XG5cbiAgICAgICAgICAgIC8vIFRoZSByYXRpbyBvZiB0aGUgZ2VvbWV0cnkncyBzY3JlZW4gc2l6ZSBjb21wYXJlZCB0byB0aGUgYWN0dWFsIHNpemUgb2YgdGhlIHNjcmVlblxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWluKHNwaGVyZVZpZXdIZWlnaHQgLyBzY3JlZW5WaWV3SGVpZ2h0LCAxKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3J0aG9cbiAgICAgICAgcmV0dXJuIG1hdGguY2xhbXAoc3BoZXJlLnJhZGl1cyAvIHRoaXMuX29ydGhvSGVpZ2h0LCAwLCAxKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGNvcm5lcnMgb2YgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSBpbiB0aGUgbG9jYWwgY29vcmRpbmF0ZSBzeXN0ZW0gb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbmVhcl0gLSBOZWFyIGRpc3RhbmNlIGZvciB0aGUgZnJ1c3R1bSBwb2ludHMuIERlZmF1bHRzIHRvIHRoZSBuZWFyIGNsaXAgZGlzdGFuY2Ugb2YgdGhlIGNhbWVyYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Zhcl0gLSBGYXIgZGlzdGFuY2UgZm9yIHRoZSBmcnVzdHVtIHBvaW50cy4gRGVmYXVsdHMgdG8gdGhlIGZhciBjbGlwIGRpc3RhbmNlIG9mIHRoZSBjYW1lcmEuXG4gICAgICogQHJldHVybnMge1ZlYzNbXX0gLSBBbiBhcnJheSBvZiBjb3JuZXJzLCB1c2luZyBhIGdsb2JhbCBzdG9yYWdlIHNwYWNlLlxuICAgICAqL1xuICAgIGdldEZydXN0dW1Db3JuZXJzKG5lYXIgPSB0aGlzLm5lYXJDbGlwLCBmYXIgPSB0aGlzLmZhckNsaXApIHtcblxuICAgICAgICBjb25zdCBmb3YgPSB0aGlzLmZvdiAqIE1hdGguUEkgLyAxODAuMDtcbiAgICAgICAgbGV0IHkgPSB0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFID8gTWF0aC50YW4oZm92IC8gMi4wKSAqIG5lYXIgOiB0aGlzLl9vcnRob0hlaWdodDtcbiAgICAgICAgbGV0IHggPSB5ICogdGhpcy5hc3BlY3RSYXRpbztcblxuICAgICAgICBjb25zdCBwb2ludHMgPSBfZnJ1c3R1bVBvaW50cztcbiAgICAgICAgcG9pbnRzWzBdLnggPSB4O1xuICAgICAgICBwb2ludHNbMF0ueSA9IC15O1xuICAgICAgICBwb2ludHNbMF0ueiA9IC1uZWFyO1xuICAgICAgICBwb2ludHNbMV0ueCA9IHg7XG4gICAgICAgIHBvaW50c1sxXS55ID0geTtcbiAgICAgICAgcG9pbnRzWzFdLnogPSAtbmVhcjtcbiAgICAgICAgcG9pbnRzWzJdLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzJdLnkgPSB5O1xuICAgICAgICBwb2ludHNbMl0ueiA9IC1uZWFyO1xuICAgICAgICBwb2ludHNbM10ueCA9IC14O1xuICAgICAgICBwb2ludHNbM10ueSA9IC15O1xuICAgICAgICBwb2ludHNbM10ueiA9IC1uZWFyO1xuXG4gICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFKSB7XG4gICAgICAgICAgICB5ID0gTWF0aC50YW4oZm92IC8gMi4wKSAqIGZhcjtcbiAgICAgICAgICAgIHggPSB5ICogdGhpcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfVxuICAgICAgICBwb2ludHNbNF0ueCA9IHg7XG4gICAgICAgIHBvaW50c1s0XS55ID0gLXk7XG4gICAgICAgIHBvaW50c1s0XS56ID0gLWZhcjtcbiAgICAgICAgcG9pbnRzWzVdLnggPSB4O1xuICAgICAgICBwb2ludHNbNV0ueSA9IHk7XG4gICAgICAgIHBvaW50c1s1XS56ID0gLWZhcjtcbiAgICAgICAgcG9pbnRzWzZdLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzZdLnkgPSB5O1xuICAgICAgICBwb2ludHNbNl0ueiA9IC1mYXI7XG4gICAgICAgIHBvaW50c1s3XS54ID0gLXg7XG4gICAgICAgIHBvaW50c1s3XS55ID0gLXk7XG4gICAgICAgIHBvaW50c1s3XS56ID0gLWZhcjtcblxuICAgICAgICByZXR1cm4gcG9pbnRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgWFIgY2FtZXJhIHByb3BlcnRpZXMgdGhhdCBzaG91bGQgYmUgZGVyaXZlZCBwaHlzaWNhbCBjYW1lcmEgaW4ge0BsaW5rIFhyTWFuYWdlcn0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Byb3BlcnRpZXNdIC0gUHJvcGVydGllcyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwcm9wZXJ0aWVzLmFzcGVjdFJhdGlvXSAtIEFzcGVjdCByYXRpby5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMuZmFyQ2xpcF0gLSBGYXIgY2xpcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMuZm92XSAtIEZpZWxkIG9mIHZpZXcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcHJvcGVydGllcy5ob3Jpem9udGFsRm92XSAtIEVuYWJsZSBob3Jpem9udGFsIGZpZWxkIG9mIHZpZXcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwcm9wZXJ0aWVzLm5lYXJDbGlwXSAtIE5lYXIgY2xpcC5cbiAgICAgKi9cbiAgICBzZXRYclByb3BlcnRpZXMocHJvcGVydGllcykge1xuICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3hyUHJvcGVydGllcywgcHJvcGVydGllcyk7XG4gICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBDYW1lcmEgfTtcbiJdLCJuYW1lcyI6WyJfZGV2aWNlQ29vcmQiLCJWZWMzIiwiX2hhbGZTaXplIiwiX3BvaW50IiwiX2ludlZpZXdQcm9qTWF0IiwiTWF0NCIsIl9mcnVzdHVtUG9pbnRzIiwiQ2FtZXJhIiwiY29uc3RydWN0b3IiLCJzaGFkZXJQYXNzSW5mbyIsInJlbmRlclBhc3NDb2xvckdyYWIiLCJyZW5kZXJQYXNzRGVwdGhHcmFiIiwicmVuZGVyUGFzc2VzIiwiaml0dGVyIiwiX2FzcGVjdFJhdGlvIiwiX2FzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiX2NhbGN1bGF0ZVByb2plY3Rpb24iLCJfY2FsY3VsYXRlVHJhbnNmb3JtIiwiX2NsZWFyQ29sb3IiLCJDb2xvciIsIl9jbGVhckNvbG9yQnVmZmVyIiwiX2NsZWFyRGVwdGgiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIl9jbGVhclN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiX2N1bGxGYWNlcyIsIl9mYXJDbGlwIiwiX2ZsaXBGYWNlcyIsIl9mb3YiLCJfZnJ1c3R1bUN1bGxpbmciLCJfaG9yaXpvbnRhbEZvdiIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiTEFZRVJJRF9ERVBUSCIsIkxBWUVSSURfU0tZQk9YIiwiTEFZRVJJRF9VSSIsIkxBWUVSSURfSU1NRURJQVRFIiwiX2xheWVyc1NldCIsIlNldCIsIl9uZWFyQ2xpcCIsIl9ub2RlIiwiX29ydGhvSGVpZ2h0IiwiX3Byb2plY3Rpb24iLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiX3JlY3QiLCJWZWM0IiwiX3JlbmRlclRhcmdldCIsIl9zY2lzc29yUmVjdCIsIl9zY2lzc29yUmVjdENsZWFyIiwiX2FwZXJ0dXJlIiwiX3NodXR0ZXIiLCJfc2Vuc2l0aXZpdHkiLCJfcHJvak1hdCIsIl9wcm9qTWF0RGlydHkiLCJfcHJvak1hdFNreWJveCIsIl92aWV3TWF0IiwiX3ZpZXdNYXREaXJ0eSIsIl92aWV3UHJvak1hdCIsIl92aWV3UHJvak1hdERpcnR5IiwiZnJ1c3R1bSIsIkZydXN0dW0iLCJfeHIiLCJfeHJQcm9wZXJ0aWVzIiwiaG9yaXpvbnRhbEZvdiIsImZvdiIsImFzcGVjdFJhdGlvIiwiZmFyQ2xpcCIsIm5lYXJDbGlwIiwiZGVzdHJveSIsIl90aGlzJHJlbmRlclBhc3NDb2xvciIsIl90aGlzJHJlbmRlclBhc3NEZXB0aCIsImxlbmd0aCIsImZ1bGxTaXplQ2xlYXJSZWN0IiwicmVjdCIsInNjaXNzb3JSZWN0IiwieCIsInkiLCJ6IiwidyIsIm5ld1ZhbHVlIiwiX3RoaXMkeHIiLCJ4ciIsImFjdGl2ZSIsImFzcGVjdFJhdGlvTW9kZSIsImNhbGN1bGF0ZVByb2plY3Rpb24iLCJjYWxjdWxhdGVUcmFuc2Zvcm0iLCJjbGVhckNvbG9yIiwiY29weSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbCIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsImN1bGxGYWNlcyIsIl90aGlzJHhyMiIsImZsaXBGYWNlcyIsIl90aGlzJHhyMyIsImZydXN0dW1DdWxsaW5nIiwiX3RoaXMkeHI0IiwibGF5ZXJzIiwic2xpY2UiLCJsYXllcnNTZXQiLCJfdGhpcyR4cjUiLCJub2RlIiwib3J0aG9IZWlnaHQiLCJwcm9qZWN0aW9uIiwicHJvamVjdGlvbk1hdHJpeCIsIl9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgiLCJyZW5kZXJUYXJnZXQiLCJ2aWV3TWF0cml4Iiwid3RtIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJpbnZlcnQiLCJhcGVydHVyZSIsInNlbnNpdGl2aXR5Iiwic2h1dHRlciIsImNsb25lIiwib3RoZXIiLCJfZW5hYmxlUmVuZGVyUGFzc0NvbG9yR3JhYiIsImRldmljZSIsImVuYWJsZSIsIlJlbmRlclBhc3NDb2xvckdyYWIiLCJfdGhpcyRyZW5kZXJQYXNzQ29sb3IyIiwiX2VuYWJsZVJlbmRlclBhc3NEZXB0aEdyYWIiLCJyZW5kZXJlciIsImlzV2ViR0wxIiwiUmVuZGVyUGFzc0RlcHRoIiwiUmVuZGVyUGFzc0RlcHRoR3JhYiIsIl90aGlzJHJlbmRlclBhc3NEZXB0aDIiLCJfdXBkYXRlVmlld1Byb2pNYXQiLCJtdWwyIiwid29ybGRUb1NjcmVlbiIsIndvcmxkQ29vcmQiLCJjdyIsImNoIiwic2NyZWVuQ29vcmQiLCJ0cmFuc2Zvcm1Qb2ludCIsInZwbSIsImRhdGEiLCJzY3JlZW5Ub1dvcmxkIiwicmFuZ2UiLCJzZXQiLCJtdWxTY2FsYXIiLCJzdWIiLCJPTkUiLCJfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZSIsImludlZpZXciLCJjYW1lcmFQb3MiLCJnZXRQb3NpdGlvbiIsInN1YjIiLCJub3JtYWxpemUiLCJhZGQiLCJzZXRQZXJzcGVjdGl2ZSIsInNldE9ydGhvIiwiZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCIsImdldEV4cG9zdXJlIiwiZXYxMDAiLCJNYXRoIiwibG9nMiIsInBvdyIsImdldFNjcmVlblNpemUiLCJzcGhlcmUiLCJkaXN0YW5jZSIsImNlbnRlciIsInJhZGl1cyIsInZpZXdBbmdsZSIsImFzaW4iLCJzcGhlcmVWaWV3SGVpZ2h0IiwidGFuIiwic2NyZWVuVmlld0hlaWdodCIsIm1hdGgiLCJERUdfVE9fUkFEIiwibWluIiwiY2xhbXAiLCJnZXRGcnVzdHVtQ29ybmVycyIsIm5lYXIiLCJmYXIiLCJQSSIsInBvaW50cyIsInNldFhyUHJvcGVydGllcyIsInByb3BlcnRpZXMiLCJPYmplY3QiLCJhc3NpZ24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBZ0JBO0FBQ0EsTUFBTUEsWUFBWSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQy9CLE1BQU1DLFNBQVMsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUM1QixNQUFNRSxNQUFNLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDekIsTUFBTUcsZUFBZSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGNBQWMsR0FBRyxDQUFDLElBQUlMLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxDQUFDLENBQUE7O0FBRXZIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNTSxNQUFNLENBQUM7QUEyQlRDLEVBQUFBLFdBQVdBLEdBQUc7QUExQmQ7QUFDSjtBQUNBO0lBRkksSUFHQUMsQ0FBQUEsY0FBYyxHQUFHLElBQUksQ0FBQTtBQUVyQjtBQUNKO0FBQ0E7SUFGSSxJQUdBQyxDQUFBQSxt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
