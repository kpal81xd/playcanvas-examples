import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

/**
 * Plane Detection provides the ability to detect real world surfaces based on estimations of the
 * underlying AR system.
 *
 * ```javascript
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
 *     planeDetection: true
 * });
 * ```
 *
 * ```javascript
 * app.xr.planeDetection.on('add', (plane) => {
 *     // new plane been added
 * });
 * ```
 *
 * @category XR
 */
class XrPlaneDetection extends EventHandler {
  /**
   * Create a new XrPlaneDetection instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    super();
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!window.XRPlane;
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * @type {Map<XRPlane, XrPlane>}
     * @private
     */
    this._planesIndex = new Map();
    /**
     * @type {XrPlane[]}
     * @private
     */
    this._planes = [];
    this._manager = manager;
    if (this._supported) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }

  /** @private */
  _onSessionStart() {
    const available = this._supported && this._manager.session.enabledFeatures.indexOf('plane-detection') !== -1;
    if (available) {
      this._available = true;
      this.fire('available');
    }
  }

  /** @private */
  _onSessionEnd() {
    for (let i = 0; i < this._planes.length; i++) {
      this._planes[i].destroy();
      this.fire('remove', this._planes[i]);
    }
    this._planesIndex.clear();
    this._planes.length = 0;
    if (this._available) {
      this._available = false;
      this.fire('unavailable');
    }
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    if (!this._supported || !this._available) return;
    const detectedPlanes = frame.detectedPlanes;

    // iterate through indexed planes
    for (const [xrPlane, plane] of this._planesIndex) {
      if (detectedPlanes.has(xrPlane)) continue;

      // if indexed plane is not listed in detectedPlanes anymore
      // then remove it
      this._planesIndex.delete(xrPlane);
      this._planes.splice(this._planes.indexOf(plane), 1);
      plane.destroy();
      this.fire('remove', plane);
    }

    // iterate through detected planes
    for (const xrPlane of detectedPlanes) {
      let plane = this._planesIndex.get(xrPlane);
      if (!plane) {
        // detected plane is not indexed
        // then create new XrPlane
        plane = new XrPlane(this, xrPlane);
        this._planesIndex.set(xrPlane, plane);
        this._planes.push(plane);
        plane.update(frame);
        this.fire('add', plane);
      } else {
        // if already indexed, just update
        plane.update(frame);
      }
    }
  }

  /**
   * True if Plane Detection is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if Plane Detection is available. This information is available only when the session has started.
   *
   * @type {boolean}
   */
  get available() {
    return this._available;
  }

  /**
   * Array of {@link XrPlane} instances that contain individual plane information.
   *
   * @type {XrPlane[]}
   */
  get planes() {
    return this._planes;
  }
}
/**
 * Fired when plane detection becomes available.
 *
 * @event
 * @example
 * app.xr.planeDetection.on('available', () => {
 *     console.log('Plane detection is available');
 * });
 */
XrPlaneDetection.EVENT_AVAILABLE = 'available';
/**
 * Fired when plane detection becomes unavailable.
 *
 * @event
 * @example
 * app.xr.planeDetection.on('unavailable', () => {
 *     console.log('Plane detection is unavailable');
 * });
 */
XrPlaneDetection.EVENT_UNAVAILABLE = 'unavailable';
/**
 * Fired when new {@link XrPlane} is added to the list. The handler is passed the
 * {@link XrPlane} instance that has been added.
 *
 * @event
 * @example
 * app.xr.planeDetection.on('add', (plane) => {
 *     // new plane is added
 * });
 */
XrPlaneDetection.EVENT_ADD = 'add';
/**
 * Fired when a {@link XrPlane} is removed from the list. The handler is passed the
 * {@link XrPlane} instance that has been removed.
 *
 * @event
 * @example
 * app.xr.planeDetection.on('remove', (plane) => {
 *     // new plane is removed
 * });
 */
XrPlaneDetection.EVENT_REMOVE = 'remove';

export { XrPlaneDetection };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItcGxhbmUtZGV0ZWN0aW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLXBsYW5lLWRldGVjdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFhyUGxhbmUgfSBmcm9tICcuL3hyLXBsYW5lLmpzJztcblxuLyoqXG4gKiBQbGFuZSBEZXRlY3Rpb24gcHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gZGV0ZWN0IHJlYWwgd29ybGQgc3VyZmFjZXMgYmFzZWQgb24gZXN0aW1hdGlvbnMgb2YgdGhlXG4gKiB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBzdGFydCBzZXNzaW9uIHdpdGggcGxhbmUgZGV0ZWN0aW9uIGVuYWJsZWRcbiAqIGFwcC54ci5zdGFydChjYW1lcmEsIHBjLlhSVFlQRV9WUiwgcGMuWFJTUEFDRV9MT0NBTEZMT09SLCB7XG4gKiAgICAgcGxhbmVEZXRlY3Rpb246IHRydWVcbiAqIH0pO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogYXBwLnhyLnBsYW5lRGV0ZWN0aW9uLm9uKCdhZGQnLCAocGxhbmUpID0+IHtcbiAqICAgICAvLyBuZXcgcGxhbmUgYmVlbiBhZGRlZFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAY2F0ZWdvcnkgWFJcbiAqL1xuY2xhc3MgWHJQbGFuZURldGVjdGlvbiBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBwbGFuZSBkZXRlY3Rpb24gYmVjb21lcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5wbGFuZURldGVjdGlvbi5vbignYXZhaWxhYmxlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnUGxhbmUgZGV0ZWN0aW9uIGlzIGF2YWlsYWJsZScpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9BVkFJTEFCTEUgPSAnYXZhaWxhYmxlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gcGxhbmUgZGV0ZWN0aW9uIGJlY29tZXMgdW5hdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5wbGFuZURldGVjdGlvbi5vbigndW5hdmFpbGFibGUnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdQbGFuZSBkZXRlY3Rpb24gaXMgdW5hdmFpbGFibGUnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVU5BVkFJTEFCTEUgPSAndW5hdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBuZXcge0BsaW5rIFhyUGxhbmV9IGlzIGFkZGVkIHRvIHRoZSBsaXN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFhyUGxhbmV9IGluc3RhbmNlIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5wbGFuZURldGVjdGlvbi5vbignYWRkJywgKHBsYW5lKSA9PiB7XG4gICAgICogICAgIC8vIG5ldyBwbGFuZSBpcyBhZGRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9BREQgPSAnYWRkJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgWHJQbGFuZX0gaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFhyUGxhbmV9IGluc3RhbmNlIHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLnBsYW5lRGV0ZWN0aW9uLm9uKCdyZW1vdmUnLCAocGxhbmUpID0+IHtcbiAgICAgKiAgICAgLy8gbmV3IHBsYW5lIGlzIHJlbW92ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N1cHBvcnRlZCA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuWFJQbGFuZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2F2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hcDxYUlBsYW5lLCBYclBsYW5lPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wbGFuZXNJbmRleCA9IG5ldyBNYXAoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYclBsYW5lW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGxhbmVzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJQbGFuZURldGVjdGlvbiBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignc3RhcnQnLCB0aGlzLl9vblNlc3Npb25TdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdlbmQnLCB0aGlzLl9vblNlc3Npb25FbmQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KCkge1xuICAgICAgICBjb25zdCBhdmFpbGFibGUgPSB0aGlzLl9zdXBwb3J0ZWQgJiYgdGhpcy5fbWFuYWdlci5zZXNzaW9uLmVuYWJsZWRGZWF0dXJlcy5pbmRleE9mKCdwbGFuZS1kZXRlY3Rpb24nKSAhPT0gLTE7XG4gICAgICAgIGlmIChhdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2F2YWlsYWJsZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvbkVuZCgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9wbGFuZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3BsYW5lc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIHRoaXMuX3BsYW5lc1tpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wbGFuZXNJbmRleC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9wbGFuZXMubGVuZ3RoID0gMDtcblxuICAgICAgICBpZiAodGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgndW5hdmFpbGFibGUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQgfHwgIXRoaXMuX2F2YWlsYWJsZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBkZXRlY3RlZFBsYW5lcyA9IGZyYW1lLmRldGVjdGVkUGxhbmVzO1xuXG4gICAgICAgIC8vIGl0ZXJhdGUgdGhyb3VnaCBpbmRleGVkIHBsYW5lc1xuICAgICAgICBmb3IgKGNvbnN0IFt4clBsYW5lLCBwbGFuZV0gb2YgdGhpcy5fcGxhbmVzSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChkZXRlY3RlZFBsYW5lcy5oYXMoeHJQbGFuZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIGlmIGluZGV4ZWQgcGxhbmUgaXMgbm90IGxpc3RlZCBpbiBkZXRlY3RlZFBsYW5lcyBhbnltb3JlXG4gICAgICAgICAgICAvLyB0aGVuIHJlbW92ZSBpdFxuICAgICAgICAgICAgdGhpcy5fcGxhbmVzSW5kZXguZGVsZXRlKHhyUGxhbmUpO1xuICAgICAgICAgICAgdGhpcy5fcGxhbmVzLnNwbGljZSh0aGlzLl9wbGFuZXMuaW5kZXhPZihwbGFuZSksIDEpO1xuICAgICAgICAgICAgcGxhbmUuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBwbGFuZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpdGVyYXRlIHRocm91Z2ggZGV0ZWN0ZWQgcGxhbmVzXG4gICAgICAgIGZvciAoY29uc3QgeHJQbGFuZSBvZiBkZXRlY3RlZFBsYW5lcykge1xuICAgICAgICAgICAgbGV0IHBsYW5lID0gdGhpcy5fcGxhbmVzSW5kZXguZ2V0KHhyUGxhbmUpO1xuXG4gICAgICAgICAgICBpZiAoIXBsYW5lKSB7XG4gICAgICAgICAgICAgICAgLy8gZGV0ZWN0ZWQgcGxhbmUgaXMgbm90IGluZGV4ZWRcbiAgICAgICAgICAgICAgICAvLyB0aGVuIGNyZWF0ZSBuZXcgWHJQbGFuZVxuICAgICAgICAgICAgICAgIHBsYW5lID0gbmV3IFhyUGxhbmUodGhpcywgeHJQbGFuZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGxhbmVzSW5kZXguc2V0KHhyUGxhbmUsIHBsYW5lKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wbGFuZXMucHVzaChwbGFuZSk7XG4gICAgICAgICAgICAgICAgcGxhbmUudXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIHBsYW5lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgYWxyZWFkeSBpbmRleGVkLCBqdXN0IHVwZGF0ZVxuICAgICAgICAgICAgICAgIHBsYW5lLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFBsYW5lIERldGVjdGlvbiBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgUGxhbmUgRGV0ZWN0aW9uIGlzIGF2YWlsYWJsZS4gVGhpcyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUgb25seSB3aGVuIHRoZSBzZXNzaW9uIGhhcyBzdGFydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGF2YWlsYWJsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F2YWlsYWJsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiB7QGxpbmsgWHJQbGFuZX0gaW5zdGFuY2VzIHRoYXQgY29udGFpbiBpbmRpdmlkdWFsIHBsYW5lIGluZm9ybWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyUGxhbmVbXX1cbiAgICAgKi9cbiAgICBnZXQgcGxhbmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxhbmVzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9O1xuIl0sIm5hbWVzIjpbIlhyUGxhbmVEZXRlY3Rpb24iLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJfbWFuYWdlciIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJYUlBsYW5lIiwiX2F2YWlsYWJsZSIsIl9wbGFuZXNJbmRleCIsIk1hcCIsIl9wbGFuZXMiLCJvbiIsIl9vblNlc3Npb25TdGFydCIsIl9vblNlc3Npb25FbmQiLCJhdmFpbGFibGUiLCJzZXNzaW9uIiwiZW5hYmxlZEZlYXR1cmVzIiwiaW5kZXhPZiIsImZpcmUiLCJpIiwibGVuZ3RoIiwiZGVzdHJveSIsImNsZWFyIiwidXBkYXRlIiwiZnJhbWUiLCJkZXRlY3RlZFBsYW5lcyIsInhyUGxhbmUiLCJwbGFuZSIsImhhcyIsImRlbGV0ZSIsInNwbGljZSIsImdldCIsIlhyUGxhbmUiLCJzZXQiLCJwdXNoIiwic3VwcG9ydGVkIiwicGxhbmVzIiwiRVZFTlRfQVZBSUxBQkxFIiwiRVZFTlRfVU5BVkFJTEFCTEUiLCJFVkVOVF9BREQiLCJFVkVOVF9SRU1PVkUiXSwibWFwcGluZ3MiOiI7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGdC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
