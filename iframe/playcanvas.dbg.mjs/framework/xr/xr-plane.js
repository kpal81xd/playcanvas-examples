import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

let ids = 0;

/**
 * Detected Plane instance that provides position, rotation, polygon points and its semantic label.
 * Plane data is subject to change during its lifetime.
 *
 * @category XR
 */
class XrPlane extends EventHandler {
  /**
   * Create a new XrPlane instance.
   *
   * @param {import('./xr-plane-detection.js').XrPlaneDetection} planeDetection - Plane detection
   * system.
   * @param {*} xrPlane - XRPlane that is instantiated by WebXR system.
   * @hideconstructor
   */
  constructor(planeDetection, xrPlane) {
    super();
    /**
     * @type {number}
     * @private
     */
    this._id = void 0;
    /**
     * @type {import('./xr-plane-detection.js').XrPlaneDetection}
     * @private
     */
    this._planeDetection = void 0;
    /**
     * @type {XRPlane}
     * @private
     */
    this._xrPlane = void 0;
    /**
     * @type {number}
     * @private
     */
    this._lastChangedTime = void 0;
    /**
     * @type {string}
     * @private
     */
    this._orientation = void 0;
    /**
     * @type {Vec3}
     * @private
     */
    this._position = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._rotation = new Quat();
    this._id = ++ids;
    this._planeDetection = planeDetection;
    this._xrPlane = xrPlane;
    this._lastChangedTime = xrPlane.lastChangedTime;
    this._orientation = xrPlane.orientation;
  }

  /** @ignore */
  destroy() {
    if (!this._xrPlane) return;
    this._xrPlane = null;
    this.fire('remove');
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    const manager = this._planeDetection._manager;
    const pose = frame.getPose(this._xrPlane.planeSpace, manager._referenceSpace);
    if (pose) {
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
    }

    // has not changed
    if (this._lastChangedTime !== this._xrPlane.lastChangedTime) {
      this._lastChangedTime = this._xrPlane.lastChangedTime;

      // attributes have been changed
      this.fire('change');
    }
  }

  /**
   * Get the world space position of a plane.
   *
   * @returns {Vec3} The world space position of a plane.
   */
  getPosition() {
    return this._position;
  }

  /**
   * Get the world space rotation of a plane.
   *
   * @returns {Quat} The world space rotation of a plane.
   */
  getRotation() {
    return this._rotation;
  }

  /**
   * Unique identifier of a plane.
   *
   * @type {number}
   */
  get id() {
    return this._id;
  }

  /**
   * Plane's specific orientation (horizontal or vertical) or null if orientation is anything else.
   *
   * @type {string|null}
   */
  get orientation() {
    return this._orientation;
  }

  /**
   * Array of DOMPointReadOnly objects. DOMPointReadOnly is an object with `x y z` properties
   * that defines a local point of a plane's polygon.
   *
   * @type {object[]}
   * @example
   * // prepare reusable objects
   * const vecA = new pc.Vec3();
   * const vecB = new pc.Vec3();
   * const color = new pc.Color(1, 1, 1);
   *
   * // update Mat4 to plane position and rotation
   * transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
   *
   * // draw lines between points
   * for (let i = 0; i < plane.points.length; i++) {
   *     vecA.copy(plane.points[i]);
   *     vecB.copy(plane.points[(i + 1) % plane.points.length]);
   *
   *     // transform from planes local to world coords
   *     transform.transformPoint(vecA, vecA);
   *     transform.transformPoint(vecB, vecB);
   *
   *     // render line
   *     app.drawLine(vecA, vecB, color);
   * }
   */
  get points() {
    return this._xrPlane.polygon;
  }

  /**
   * Semantic Label of a plane that is provided by underlying system.
   * Current list includes (but not limited to): https://github.com/immersive-web/semantic-labels/blob/master/labels.json
   *
   * @type {string}
   */
  get label() {
    return this._xrPlane.semanticLabel || '';
  }
}
/**
 * Fired when an {@link XrPlane} is removed.
 *
 * @event
 * @example
 * plane.once('remove', () => {
 *     // plane is not available anymore
 * });
 */
XrPlane.EVENT_REMOVE = 'remove';
/**
 * Fired when {@link XrPlane} attributes such as: orientation and/or points have been changed.
 * Position and rotation can change at any time without triggering a `change` event.
 *
 * @event
 * @example
 * plane.on('change', () -> {
 *     // plane has been changed
 * });
 */
XrPlane.EVENT_CHANGE = 'change';

export { XrPlane };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItcGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItcGxhbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5sZXQgaWRzID0gMDtcblxuLyoqXG4gKiBEZXRlY3RlZCBQbGFuZSBpbnN0YW5jZSB0aGF0IHByb3ZpZGVzIHBvc2l0aW9uLCByb3RhdGlvbiwgcG9seWdvbiBwb2ludHMgYW5kIGl0cyBzZW1hbnRpYyBsYWJlbC5cbiAqIFBsYW5lIGRhdGEgaXMgc3ViamVjdCB0byBjaGFuZ2UgZHVyaW5nIGl0cyBsaWZldGltZS5cbiAqXG4gKiBAY2F0ZWdvcnkgWFJcbiAqL1xuY2xhc3MgWHJQbGFuZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiB7QGxpbmsgWHJQbGFuZX0gaXMgcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGxhbmUub25jZSgncmVtb3ZlJywgKCkgPT4ge1xuICAgICAqICAgICAvLyBwbGFuZSBpcyBub3QgYXZhaWxhYmxlIGFueW1vcmVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYclBsYW5lfSBhdHRyaWJ1dGVzIHN1Y2ggYXM6IG9yaWVudGF0aW9uIGFuZC9vciBwb2ludHMgaGF2ZSBiZWVuIGNoYW5nZWQuXG4gICAgICogUG9zaXRpb24gYW5kIHJvdGF0aW9uIGNhbiBjaGFuZ2UgYXQgYW55IHRpbWUgd2l0aG91dCB0cmlnZ2VyaW5nIGEgYGNoYW5nZWAgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBsYW5lLm9uKCdjaGFuZ2UnLCAoKSAtPiB7XG4gICAgICogICAgIC8vIHBsYW5lIGhhcyBiZWVuIGNoYW5nZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ0hBTkdFID0gJ2NoYW5nZSc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2lkO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1wbGFuZS1kZXRlY3Rpb24uanMnKS5YclBsYW5lRGV0ZWN0aW9ufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BsYW5lRGV0ZWN0aW9uO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSUGxhbmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfeHJQbGFuZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGFzdENoYW5nZWRUaW1lO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vcmllbnRhdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYclBsYW5lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItcGxhbmUtZGV0ZWN0aW9uLmpzJykuWHJQbGFuZURldGVjdGlvbn0gcGxhbmVEZXRlY3Rpb24gLSBQbGFuZSBkZXRlY3Rpb25cbiAgICAgKiBzeXN0ZW0uXG4gICAgICogQHBhcmFtIHsqfSB4clBsYW5lIC0gWFJQbGFuZSB0aGF0IGlzIGluc3RhbnRpYXRlZCBieSBXZWJYUiBzeXN0ZW0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHBsYW5lRGV0ZWN0aW9uLCB4clBsYW5lKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSArK2lkcztcbiAgICAgICAgdGhpcy5fcGxhbmVEZXRlY3Rpb24gPSBwbGFuZURldGVjdGlvbjtcbiAgICAgICAgdGhpcy5feHJQbGFuZSA9IHhyUGxhbmU7XG4gICAgICAgIHRoaXMuX2xhc3RDaGFuZ2VkVGltZSA9IHhyUGxhbmUubGFzdENoYW5nZWRUaW1lO1xuICAgICAgICB0aGlzLl9vcmllbnRhdGlvbiA9IHhyUGxhbmUub3JpZW50YXRpb247XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3hyUGxhbmUpIHJldHVybjtcbiAgICAgICAgdGhpcy5feHJQbGFuZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBjb25zdCBtYW5hZ2VyID0gdGhpcy5fcGxhbmVEZXRlY3Rpb24uX21hbmFnZXI7XG4gICAgICAgIGNvbnN0IHBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hyUGxhbmUucGxhbmVTcGFjZSwgbWFuYWdlci5fcmVmZXJlbmNlU3BhY2UpO1xuICAgICAgICBpZiAocG9zZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb24uY29weShwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9yb3RhdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhhcyBub3QgY2hhbmdlZFxuICAgICAgICBpZiAodGhpcy5fbGFzdENoYW5nZWRUaW1lICE9PSB0aGlzLl94clBsYW5lLmxhc3RDaGFuZ2VkVGltZSkge1xuICAgICAgICAgICAgdGhpcy5fbGFzdENoYW5nZWRUaW1lID0gdGhpcy5feHJQbGFuZS5sYXN0Q2hhbmdlZFRpbWU7XG5cbiAgICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaGF2ZSBiZWVuIGNoYW5nZWRcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGEgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGEgcGxhbmUuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGEgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGEgcGxhbmUuXG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmlxdWUgaWRlbnRpZmllciBvZiBhIHBsYW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQbGFuZSdzIHNwZWNpZmljIG9yaWVudGF0aW9uIChob3Jpem9udGFsIG9yIHZlcnRpY2FsKSBvciBudWxsIGlmIG9yaWVudGF0aW9uIGlzIGFueXRoaW5nIGVsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IG9yaWVudGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3JpZW50YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgRE9NUG9pbnRSZWFkT25seSBvYmplY3RzLiBET01Qb2ludFJlYWRPbmx5IGlzIGFuIG9iamVjdCB3aXRoIGB4IHkgemAgcHJvcGVydGllc1xuICAgICAqIHRoYXQgZGVmaW5lcyBhIGxvY2FsIHBvaW50IG9mIGEgcGxhbmUncyBwb2x5Z29uLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdFtdfVxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gcHJlcGFyZSByZXVzYWJsZSBvYmplY3RzXG4gICAgICogY29uc3QgdmVjQSA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogY29uc3QgdmVjQiA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogY29uc3QgY29sb3IgPSBuZXcgcGMuQ29sb3IoMSwgMSwgMSk7XG4gICAgICpcbiAgICAgKiAvLyB1cGRhdGUgTWF0NCB0byBwbGFuZSBwb3NpdGlvbiBhbmQgcm90YXRpb25cbiAgICAgKiB0cmFuc2Zvcm0uc2V0VFJTKHBsYW5lLmdldFBvc2l0aW9uKCksIHBsYW5lLmdldFJvdGF0aW9uKCksIHBjLlZlYzMuT05FKTtcbiAgICAgKlxuICAgICAqIC8vIGRyYXcgbGluZXMgYmV0d2VlbiBwb2ludHNcbiAgICAgKiBmb3IgKGxldCBpID0gMDsgaSA8IHBsYW5lLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICB2ZWNBLmNvcHkocGxhbmUucG9pbnRzW2ldKTtcbiAgICAgKiAgICAgdmVjQi5jb3B5KHBsYW5lLnBvaW50c1soaSArIDEpICUgcGxhbmUucG9pbnRzLmxlbmd0aF0pO1xuICAgICAqXG4gICAgICogICAgIC8vIHRyYW5zZm9ybSBmcm9tIHBsYW5lcyBsb2NhbCB0byB3b3JsZCBjb29yZHNcbiAgICAgKiAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlY0EsIHZlY0EpO1xuICAgICAqICAgICB0cmFuc2Zvcm0udHJhbnNmb3JtUG9pbnQodmVjQiwgdmVjQik7XG4gICAgICpcbiAgICAgKiAgICAgLy8gcmVuZGVyIGxpbmVcbiAgICAgKiAgICAgYXBwLmRyYXdMaW5lKHZlY0EsIHZlY0IsIGNvbG9yKTtcbiAgICAgKiB9XG4gICAgICovXG4gICAgZ2V0IHBvaW50cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hyUGxhbmUucG9seWdvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZW1hbnRpYyBMYWJlbCBvZiBhIHBsYW5lIHRoYXQgaXMgcHJvdmlkZWQgYnkgdW5kZXJseWluZyBzeXN0ZW0uXG4gICAgICogQ3VycmVudCBsaXN0IGluY2x1ZGVzIChidXQgbm90IGxpbWl0ZWQgdG8pOiBodHRwczovL2dpdGh1Yi5jb20vaW1tZXJzaXZlLXdlYi9zZW1hbnRpYy1sYWJlbHMvYmxvYi9tYXN0ZXIvbGFiZWxzLmpzb25cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGxhYmVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJQbGFuZS5zZW1hbnRpY0xhYmVsIHx8ICcnO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJQbGFuZSB9O1xuIl0sIm5hbWVzIjpbImlkcyIsIlhyUGxhbmUiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsInBsYW5lRGV0ZWN0aW9uIiwieHJQbGFuZSIsIl9pZCIsIl9wbGFuZURldGVjdGlvbiIsIl94clBsYW5lIiwiX2xhc3RDaGFuZ2VkVGltZSIsIl9vcmllbnRhdGlvbiIsIl9wb3NpdGlvbiIsIlZlYzMiLCJfcm90YXRpb24iLCJRdWF0IiwibGFzdENoYW5nZWRUaW1lIiwib3JpZW50YXRpb24iLCJkZXN0cm95IiwiZmlyZSIsInVwZGF0ZSIsImZyYW1lIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwicG9zZSIsImdldFBvc2UiLCJwbGFuZVNwYWNlIiwiX3JlZmVyZW5jZVNwYWNlIiwiY29weSIsInRyYW5zZm9ybSIsInBvc2l0aW9uIiwiZ2V0UG9zaXRpb24iLCJnZXRSb3RhdGlvbiIsImlkIiwicG9pbnRzIiwicG9seWdvbiIsImxhYmVsIiwic2VtYW50aWNMYWJlbCIsIkVWRU5UX1JFTU9WRSIsIkVWRU5UX0NIQU5HRSJdLCJtYXBwaW5ncyI6Ijs7OztBQUlBLElBQUlBLEdBQUcsR0FBRyxDQUFDLENBQUE7O0FBRVg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsT0FBTyxTQUFTQyxZQUFZLENBQUM7QUFrRS9CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsY0FBYyxFQUFFQyxPQUFPLEVBQUU7QUFDakMsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQW5EWDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxHQUFHLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFSDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxlQUFlLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFZjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxnQkFBZ0IsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVoQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFB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
