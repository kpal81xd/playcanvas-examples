import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XRSPACE_VIEWER } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

/**
 * Callback used by {@link XrHitTest#start} and {@link XrHitTest#startForInputSource}.
 *
 * @callback XrHitTestStartCallback
 * @param {Error|null} err - The Error object if failed to create hit test source or null.
 * @param {XrHitTestSource|null} hitTestSource - Object that provides access to hit results against
 * real world geometry.
 */

/**
 * The Hit Test interface allows initiating hit testing against real-world geometry from various
 * sources: the view, input sources, or an arbitrary ray in space. Results reflect the underlying
 * AR system's understanding of the real world.
 *
 * @augments EventHandler
 * @category XR
 */
class XrHitTest extends EventHandler {
  /**
   * Create a new XrHitTest instance.
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
    this.manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * List of active {@link XrHitTestSource}.
     *
     * @type {XrHitTestSource[]}
     */
    this.sources = [];
    this.manager = manager;
    if (this._supported) {
      this.manager.on('start', this._onSessionStart, this);
      this.manager.on('end', this._onSessionEnd, this);
    }
  }

  /** @private */
  _onSessionStart() {
    const available = this.manager.session.enabledFeatures.indexOf('hit-test') !== -1;
    if (!available) return;
    this._available = available;
    this.fire('available');
  }

  /** @private */
  _onSessionEnd() {
    if (!this._available) return;
    this._available = false;
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].onStop();
    }
    this.sources = [];
    this.fire('unavailable');
  }

  /**
   * Attempts to start hit test with provided reference space.
   *
   * @param {object} [options] - Optional object for passing arguments.
   * @param {string} [options.spaceType] - Reference space type. Defaults to
   * {@link XRSPACE_VIEWER}. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - hit test will be facing relative to viewers space.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {string} [options.profile] - if hit test source meant to match input source instead
   * of reference space, then name of profile of the {@link XrInputSource} should be provided.
   * @param {string[]} [options.entityTypes] - Optional list of underlying entity types against
   * which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ]. Can be any
   * combination of the following:
   *
   * - {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed
   * based on the feature points detected by the underlying Augmented Reality system.
   * - {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed
   * based on the planes detected by the underlying Augmented Reality system.
   * - {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed
   * based on the meshes detected by the underlying Augmented Reality system.
   *
   * @param {import('../../core/shape/ray.js').Ray} [options.offsetRay] - Optional ray by which
   * hit test ray can be offset.
   * @param {XrHitTestStartCallback} [options.callback] - Optional callback function called once
   * hit test source is created or failed.
   * @example
   * // start hit testing from viewer position facing forwards
   * app.xr.hitTest.start({
   *     spaceType: pc.XRSPACE_VIEWER,
   *     callback: function (err, hitTestSource) {
   *         if (err) return;
   *         hitTestSource.on('result', function (position, rotation) {
   *             // position and rotation of hit test result
   *         });
   *     }
   * });
   * @example
   * // start hit testing using an arbitrary ray
   * const ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
   * app.xr.hitTest.start({
   *     spaceType: pc.XRSPACE_LOCAL,
   *     offsetRay: ray,
   *     callback: function (err, hitTestSource) {
   *         // hit test source that will sample real world geometry straight down
   *         // from the position where AR session started
   *     }
   * });
   * @example
   * // start hit testing for touch screen taps
   * app.xr.hitTest.start({
   *     profile: 'generic-touchscreen',
   *     callback: function (err, hitTestSource) {
   *         if (err) return;
   *         hitTestSource.on('result', function (position, rotation, inputSource) {
   *             // position and rotation of hit test result
   *             // that will be created from touch on mobile devices
   *         });
   *     }
   * });
   */
  start(options = {}) {
    if (!this._supported) {
      options.callback == null || options.callback(new Error('XR HitTest is not supported'), null);
      return;
    }
    if (!this._available) {
      options.callback == null || options.callback(new Error('XR HitTest is not available'), null);
      return;
    }
    if (!options.profile && !options.spaceType) options.spaceType = XRSPACE_VIEWER;
    let xrRay;
    const offsetRay = options.offsetRay;
    if (offsetRay) {
      const origin = new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z, 1.0);
      const direction = new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z, 0.0);
      xrRay = new XRRay(origin, direction);
    }
    const callback = options.callback;
    if (options.spaceType) {
      this.manager.session.requestReferenceSpace(options.spaceType).then(referenceSpace => {
        if (!this.manager.session) {
          const err = new Error('XR Session is not started (2)');
          if (callback) callback(err);
          this.fire('error', err);
          return;
        }
        this.manager.session.requestHitTestSource({
          space: referenceSpace,
          entityTypes: options.entityTypes || undefined,
          offsetRay: xrRay
        }).then(xrHitTestSource => {
          this._onHitTestSource(xrHitTestSource, false, options.inputSource, callback);
        }).catch(ex => {
          if (callback) callback(ex);
          this.fire('error', ex);
        });
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    } else {
      this.manager.session.requestHitTestSourceForTransientInput({
        profile: options.profile,
        entityTypes: options.entityTypes || undefined,
        offsetRay: xrRay
      }).then(xrHitTestSource => {
        this._onHitTestSource(xrHitTestSource, true, options.inputSource, callback);
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    }
  }

  /**
   * @param {XRHitTestSource} xrHitTestSource - Hit test source.
   * @param {boolean} transient - True if hit test source is created from transient input source.
   * @param {import('./xr-input-source.js').XrInputSource|null} inputSource - Input Source with which hit test source is associated with.
   * @param {Function} callback - Callback called once hit test source is created.
   * @private
   */
  _onHitTestSource(xrHitTestSource, transient, inputSource, callback) {
    if (!this.manager.session) {
      xrHitTestSource.cancel();
      const err = new Error('XR Session is not started (3)');
      if (callback) callback(err);
      this.fire('error', err);
      return;
    }
    const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient, inputSource != null ? inputSource : null);
    this.sources.push(hitTestSource);
    if (callback) callback(null, hitTestSource);
    this.fire('add', hitTestSource);
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].update(frame);
    }
  }

  /**
   * True if AR Hit Test is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if Hit Test is available. This information is available only when the session has started.
   *
   * @type {boolean}
   */
  get available() {
    return this._available;
  }
}
/**
 * Fired when hit test becomes available.
 *
 * @event
 * @example
 * app.xr.hitTest.on('available', () => {
 *     console.log('Hit Testing is available');
 * });
 */
XrHitTest.EVENT_AVAILABLE = 'available';
/**
 * Fired when hit test becomes unavailable.
 *
 * @event
 * @example
 * app.xr.hitTest.on('unavailable', () => {
 *     console.log('Hit Testing is unavailable');
 * });
 */
XrHitTest.EVENT_UNAVAILABLE = 'unavailable';
/**
 * Fired when new {@link XrHitTestSource} is added to the list. The handler is passed the
 * {@link XrHitTestSource} object that has been added.
 *
 * @event
 * @example
 * app.xr.hitTest.on('add', (hitTestSource) => {
 *     // new hit test source is added
 * });
 */
XrHitTest.EVENT_ADD = 'add';
/**
 * Fired when {@link XrHitTestSource} is removed to the list. The handler is passed the
 * {@link XrHitTestSource} object that has been removed.
 *
 * @event
 * @example
 * app.xr.hitTest.on('remove', (hitTestSource) => {
 *     // hit test source is removed
 * });
 */
XrHitTest.EVENT_REMOVE = 'remove';
/**
 * Fired when hit test source receives new results. It provides transform information that
 * tries to match real world picked geometry. The handler is passed the {@link XrHitTestSource}
 * that produced the hit result, the {@link Vec3} position, the {@link Quat} rotation and the
 * {@link XrInputSource} (if it is a transient hit test source).
 *
 * @event
 * @example
 * app.xr.hitTest.on('result', (hitTestSource, position, rotation, inputSource) => {
 *     target.setPosition(position);
 *     target.setRotation(rotation);
 * });
 */
XrHitTest.EVENT_RESULT = 'result';
/**
 * Fired when failed create hit test source. The handler is passed the Error object.
 *
 * @event
 * @example
 * app.xr.hitTest.on('error', (err) => {
 *     console.error(err.message);
 * });
 */
XrHitTest.EVENT_ERROR = 'error';

export { XrHitTest };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaGl0LXRlc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItaGl0LXRlc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbmltcG9ydCB7IFhSU1BBQ0VfVklFV0VSIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWHJIaXRUZXN0U291cmNlIH0gZnJvbSAnLi94ci1oaXQtdGVzdC1zb3VyY2UuanMnO1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFhySGl0VGVzdCNzdGFydH0gYW5kIHtAbGluayBYckhpdFRlc3Qjc3RhcnRGb3JJbnB1dFNvdXJjZX0uXG4gKlxuICogQGNhbGxiYWNrIFhySGl0VGVzdFN0YXJ0Q2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBpZiBmYWlsZWQgdG8gY3JlYXRlIGhpdCB0ZXN0IHNvdXJjZSBvciBudWxsLlxuICogQHBhcmFtIHtYckhpdFRlc3RTb3VyY2V8bnVsbH0gaGl0VGVzdFNvdXJjZSAtIE9iamVjdCB0aGF0IHByb3ZpZGVzIGFjY2VzcyB0byBoaXQgcmVzdWx0cyBhZ2FpbnN0XG4gKiByZWFsIHdvcmxkIGdlb21ldHJ5LlxuICovXG5cbi8qKlxuICogVGhlIEhpdCBUZXN0IGludGVyZmFjZSBhbGxvd3MgaW5pdGlhdGluZyBoaXQgdGVzdGluZyBhZ2FpbnN0IHJlYWwtd29ybGQgZ2VvbWV0cnkgZnJvbSB2YXJpb3VzXG4gKiBzb3VyY2VzOiB0aGUgdmlldywgaW5wdXQgc291cmNlcywgb3IgYW4gYXJiaXRyYXJ5IHJheSBpbiBzcGFjZS4gUmVzdWx0cyByZWZsZWN0IHRoZSB1bmRlcmx5aW5nXG4gKiBBUiBzeXN0ZW0ncyB1bmRlcnN0YW5kaW5nIG9mIHRoZSByZWFsIHdvcmxkLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqIEBjYXRlZ29yeSBYUlxuICovXG5jbGFzcyBYckhpdFRlc3QgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaGl0IHRlc3QgYmVjb21lcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdhdmFpbGFibGUnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdIaXQgVGVzdGluZyBpcyBhdmFpbGFibGUnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQVZBSUxBQkxFID0gJ2F2YWlsYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGhpdCB0ZXN0IGJlY29tZXMgdW5hdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCd1bmF2YWlsYWJsZScsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0hpdCBUZXN0aW5nIGlzIHVuYXZhaWxhYmxlJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1VOQVZBSUxBQkxFID0gJ3VuYXZhaWxhYmxlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gbmV3IHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIGFkZGVkIHRvIHRoZSBsaXN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gb2JqZWN0IHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdhZGQnLCAoaGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAqICAgICAvLyBuZXcgaGl0IHRlc3Qgc291cmNlIGlzIGFkZGVkXG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FERCA9ICdhZGQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBpcyByZW1vdmVkIHRvIHRoZSBsaXN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gb2JqZWN0IHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmhpdFRlc3Qub24oJ3JlbW92ZScsIChoaXRUZXN0U291cmNlKSA9PiB7XG4gICAgICogICAgIC8vIGhpdCB0ZXN0IHNvdXJjZSBpcyByZW1vdmVkXG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1JFTU9WRSA9ICdyZW1vdmUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBoaXQgdGVzdCBzb3VyY2UgcmVjZWl2ZXMgbmV3IHJlc3VsdHMuIEl0IHByb3ZpZGVzIHRyYW5zZm9ybSBpbmZvcm1hdGlvbiB0aGF0XG4gICAgICogdHJpZXMgdG8gbWF0Y2ggcmVhbCB3b3JsZCBwaWNrZWQgZ2VvbWV0cnkuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUge0BsaW5rIFhySGl0VGVzdFNvdXJjZX1cbiAgICAgKiB0aGF0IHByb2R1Y2VkIHRoZSBoaXQgcmVzdWx0LCB0aGUge0BsaW5rIFZlYzN9IHBvc2l0aW9uLCB0aGUge0BsaW5rIFF1YXR9IHJvdGF0aW9uIGFuZCB0aGVcbiAgICAgKiB7QGxpbmsgWHJJbnB1dFNvdXJjZX0gKGlmIGl0IGlzIGEgdHJhbnNpZW50IGhpdCB0ZXN0IHNvdXJjZSkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdyZXN1bHQnLCAoaGl0VGVzdFNvdXJjZSwgcG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSkgPT4ge1xuICAgICAqICAgICB0YXJnZXQuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqICAgICB0YXJnZXQuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRVNVTFQgPSAncmVzdWx0JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gZmFpbGVkIGNyZWF0ZSBoaXQgdGVzdCBzb3VyY2UuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUgRXJyb3Igb2JqZWN0LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9FUlJPUiA9ICdlcnJvcic7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhISh3aW5kb3cuWFJTZXNzaW9uICYmIHdpbmRvdy5YUlNlc3Npb24ucHJvdG90eXBlLnJlcXVlc3RIaXRUZXN0U291cmNlKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2F2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBhY3RpdmUge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJIaXRUZXN0U291cmNlW119XG4gICAgICovXG4gICAgc291cmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhySGl0VGVzdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICBpZiAodGhpcy5fc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ3N0YXJ0JywgdGhpcy5fb25TZXNzaW9uU3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLm9uKCdlbmQnLCB0aGlzLl9vblNlc3Npb25FbmQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KCkge1xuICAgICAgICBjb25zdCBhdmFpbGFibGUgPSB0aGlzLm1hbmFnZXIuc2Vzc2lvbi5lbmFibGVkRmVhdHVyZXMuaW5kZXhPZignaGl0LXRlc3QnKSAhPT0gLTE7XG4gICAgICAgIGlmICghYXZhaWxhYmxlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IGF2YWlsYWJsZTtcbiAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2VzW2ldLm9uU3RvcCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlcyA9IFtdO1xuXG4gICAgICAgIHRoaXMuZmlyZSgndW5hdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0cyB0byBzdGFydCBoaXQgdGVzdCB3aXRoIHByb3ZpZGVkIHJlZmVyZW5jZSBzcGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvYmplY3QgZm9yIHBhc3NpbmcgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zcGFjZVR5cGVdIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIFhSU1BBQ0VfVklFV0VSfS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBoaXQgdGVzdCB3aWxsIGJlIGZhY2luZyByZWxhdGl2ZSB0byB2aWV3ZXJzIHNwYWNlLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUx9OiBMb2NhbCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpbiBuZWFyIHRoZVxuICAgICAqIHZpZXdlciBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMRkxPT1J9OiBMb2NhbCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpblxuICAgICAqIGF0IHRoZSBmbG9vciBpbiBhIHNhZmUgcG9zaXRpb24gZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeSBheGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLlxuICAgICAqIEZsb29yIGxldmVsIHZhbHVlIG1pZ2h0IGJlIGVzdGltYXRlZCBieSB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5wcm9maWxlXSAtIGlmIGhpdCB0ZXN0IHNvdXJjZSBtZWFudCB0byBtYXRjaCBpbnB1dCBzb3VyY2UgaW5zdGVhZFxuICAgICAqIG9mIHJlZmVyZW5jZSBzcGFjZSwgdGhlbiBuYW1lIG9mIHByb2ZpbGUgb2YgdGhlIHtAbGluayBYcklucHV0U291cmNlfSBzaG91bGQgYmUgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuZW50aXR5VHlwZXNdIC0gT3B0aW9uYWwgbGlzdCBvZiB1bmRlcmx5aW5nIGVudGl0eSB0eXBlcyBhZ2FpbnN0XG4gICAgICogd2hpY2ggaGl0IHRlc3RzIHdpbGwgYmUgcGVyZm9ybWVkLiBEZWZhdWx0cyB0byBbIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX0gXS4gQ2FuIGJlIGFueVxuICAgICAqIGNvbWJpbmF0aW9uIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QT0lOVH06IFBvaW50IC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBmZWF0dXJlIHBvaW50cyBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gICAgICogLSB7QGxpbmsgWFJUUkFDS0FCTEVfUExBTkV9OiBQbGFuZSAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgcGxhbmVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9NRVNIfTogTWVzaCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgbWVzaGVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL3NoYXBlL3JheS5qcycpLlJheX0gW29wdGlvbnMub2Zmc2V0UmF5XSAtIE9wdGlvbmFsIHJheSBieSB3aGljaFxuICAgICAqIGhpdCB0ZXN0IHJheSBjYW4gYmUgb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U3RhcnRDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2VcbiAgICAgKiBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBvciBmYWlsZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBzdGFydCBoaXQgdGVzdGluZyBmcm9tIHZpZXdlciBwb3NpdGlvbiBmYWNpbmcgZm9yd2FyZHNcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5zdGFydCh7XG4gICAgICogICAgIHNwYWNlVHlwZTogcGMuWFJTUEFDRV9WSUVXRVIsXG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyLCBoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgICogICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uKSB7XG4gICAgICogICAgICAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIGhpdCB0ZXN0IHJlc3VsdFxuICAgICAqICAgICAgICAgfSk7XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHN0YXJ0IGhpdCB0ZXN0aW5nIHVzaW5nIGFuIGFyYml0cmFyeSByYXlcbiAgICAgKiBjb25zdCByYXkgPSBuZXcgcGMuUmF5KG5ldyBwYy5WZWMzKDAsIDAsIDApLCBuZXcgcGMuVmVjMygwLCAtMSwgMCkpO1xuICAgICAqIGFwcC54ci5oaXRUZXN0LnN0YXJ0KHtcbiAgICAgKiAgICAgc3BhY2VUeXBlOiBwYy5YUlNQQUNFX0xPQ0FMLFxuICAgICAqICAgICBvZmZzZXRSYXk6IHJheSxcbiAgICAgKiAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIsIGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgICAgIC8vIGhpdCB0ZXN0IHNvdXJjZSB0aGF0IHdpbGwgc2FtcGxlIHJlYWwgd29ybGQgZ2VvbWV0cnkgc3RyYWlnaHQgZG93blxuICAgICAqICAgICAgICAgLy8gZnJvbSB0aGUgcG9zaXRpb24gd2hlcmUgQVIgc2Vzc2lvbiBzdGFydGVkXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHN0YXJ0IGhpdCB0ZXN0aW5nIGZvciB0b3VjaCBzY3JlZW4gdGFwc1xuICAgICAqIGFwcC54ci5oaXRUZXN0LnN0YXJ0KHtcbiAgICAgKiAgICAgcHJvZmlsZTogJ2dlbmVyaWMtdG91Y2hzY3JlZW4nLFxuICAgICAqICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgaWYgKGVycikgcmV0dXJuO1xuICAgICAqICAgICAgICAgaGl0VGVzdFNvdXJjZS5vbigncmVzdWx0JywgZnVuY3Rpb24gKHBvc2l0aW9uLCByb3RhdGlvbiwgaW5wdXRTb3VyY2UpIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgaGl0IHRlc3QgcmVzdWx0XG4gICAgICogICAgICAgICAgICAgLy8gdGhhdCB3aWxsIGJlIGNyZWF0ZWQgZnJvbSB0b3VjaCBvbiBtb2JpbGUgZGV2aWNlc1xuICAgICAqICAgICAgICAgfSk7XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGFydChvcHRpb25zID0ge30pIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2s/LihuZXcgRXJyb3IoJ1hSIEhpdFRlc3QgaXMgbm90IHN1cHBvcnRlZCcpLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICBvcHRpb25zLmNhbGxiYWNrPy4obmV3IEVycm9yKCdYUiBIaXRUZXN0IGlzIG5vdCBhdmFpbGFibGUnKSwgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdGlvbnMucHJvZmlsZSAmJiAhb3B0aW9ucy5zcGFjZVR5cGUpXG4gICAgICAgICAgICBvcHRpb25zLnNwYWNlVHlwZSA9IFhSU1BBQ0VfVklFV0VSO1xuXG4gICAgICAgIGxldCB4clJheTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0UmF5ID0gb3B0aW9ucy5vZmZzZXRSYXk7XG4gICAgICAgIGlmIChvZmZzZXRSYXkpIHtcbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbiA9IG5ldyBET01Qb2ludChvZmZzZXRSYXkub3JpZ2luLngsIG9mZnNldFJheS5vcmlnaW4ueSwgb2Zmc2V0UmF5Lm9yaWdpbi56LCAxLjApO1xuICAgICAgICAgICAgY29uc3QgZGlyZWN0aW9uID0gbmV3IERPTVBvaW50KG9mZnNldFJheS5kaXJlY3Rpb24ueCwgb2Zmc2V0UmF5LmRpcmVjdGlvbi55LCBvZmZzZXRSYXkuZGlyZWN0aW9uLnosIDAuMCk7XG4gICAgICAgICAgICB4clJheSA9IG5ldyBYUlJheShvcmlnaW4sIGRpcmVjdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3BhY2VUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuc2Vzc2lvbi5yZXF1ZXN0UmVmZXJlbmNlU3BhY2Uob3B0aW9ucy5zcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1hbmFnZXIuc2Vzc2lvbikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ1hSIFNlc3Npb24gaXMgbm90IHN0YXJ0ZWQgKDIpJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLm1hbmFnZXIuc2Vzc2lvbi5yZXF1ZXN0SGl0VGVzdFNvdXJjZSh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNlOiByZWZlcmVuY2VTcGFjZSxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5VHlwZXM6IG9wdGlvbnMuZW50aXR5VHlwZXMgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBvZmZzZXRSYXk6IHhyUmF5XG4gICAgICAgICAgICAgICAgfSkudGhlbigoeHJIaXRUZXN0U291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uSGl0VGVzdFNvdXJjZSh4ckhpdFRlc3RTb3VyY2UsIGZhbHNlLCBvcHRpb25zLmlucHV0U291cmNlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhleCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLnNlc3Npb24ucmVxdWVzdEhpdFRlc3RTb3VyY2VGb3JUcmFuc2llbnRJbnB1dCh7XG4gICAgICAgICAgICAgICAgcHJvZmlsZTogb3B0aW9ucy5wcm9maWxlLFxuICAgICAgICAgICAgICAgIGVudGl0eVR5cGVzOiBvcHRpb25zLmVudGl0eVR5cGVzIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBvZmZzZXRSYXk6IHhyUmF5XG4gICAgICAgICAgICB9KS50aGVuKCh4ckhpdFRlc3RTb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cnVlLCBvcHRpb25zLmlucHV0U291cmNlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSSGl0VGVzdFNvdXJjZX0geHJIaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdHJhbnNpZW50IC0gVHJ1ZSBpZiBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBmcm9tIHRyYW5zaWVudCBpbnB1dCBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaW5wdXQtc291cmNlLmpzJykuWHJJbnB1dFNvdXJjZXxudWxsfSBpbnB1dFNvdXJjZSAtIElucHV0IFNvdXJjZSB3aXRoIHdoaWNoIGhpdCB0ZXN0IHNvdXJjZSBpcyBhc3NvY2lhdGVkIHdpdGguXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBjYWxsZWQgb25jZSBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cmFuc2llbnQsIGlucHV0U291cmNlLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMubWFuYWdlci5zZXNzaW9uKSB7XG4gICAgICAgICAgICB4ckhpdFRlc3RTb3VyY2UuY2FuY2VsKCk7XG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ1hSIFNlc3Npb24gaXMgbm90IHN0YXJ0ZWQgKDMpJyk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhpdFRlc3RTb3VyY2UgPSBuZXcgWHJIaXRUZXN0U291cmNlKHRoaXMubWFuYWdlciwgeHJIaXRUZXN0U291cmNlLCB0cmFuc2llbnQsIGlucHV0U291cmNlID8/IG51bGwpO1xuICAgICAgICB0aGlzLnNvdXJjZXMucHVzaChoaXRUZXN0U291cmNlKTtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGhpdFRlc3RTb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlc1tpXS51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBBUiBIaXQgVGVzdCBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgSGl0IFRlc3QgaXMgYXZhaWxhYmxlLiBUaGlzIGluZm9ybWF0aW9uIGlzIGF2YWlsYWJsZSBvbmx5IHdoZW4gdGhlIHNlc3Npb24gaGFzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJIaXRUZXN0IH07XG4iXSwibmFtZXMiOlsiWHJIaXRUZXN0IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSU2Vzc2lvbiIsInByb3RvdHlwZSIsInJlcXVlc3RIaXRUZXN0U291cmNlIiwiX2F2YWlsYWJsZSIsInNvdXJjZXMiLCJvbiIsIl9vblNlc3Npb25TdGFydCIsIl9vblNlc3Npb25FbmQiLCJhdmFpbGFibGUiLCJzZXNzaW9uIiwiZW5hYmxlZEZlYXR1cmVzIiwiaW5kZXhPZiIsImZpcmUiLCJpIiwibGVuZ3RoIiwib25TdG9wIiwic3RhcnQiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJFcnJvciIsInByb2ZpbGUiLCJzcGFjZVR5cGUiLCJYUlNQQUNFX1ZJRVdFUiIsInhyUmF5Iiwib2Zmc2V0UmF5Iiwib3JpZ2luIiwiRE9NUG9pbnQiLCJ4IiwieSIsInoiLCJkaXJlY3Rpb24iLCJYUlJheSIsInJlcXVlc3RSZWZlcmVuY2VTcGFjZSIsInRoZW4iLCJyZWZlcmVuY2VTcGFjZSIsImVyciIsInNwYWNlIiwiZW50aXR5VHlwZXMiLCJ1bmRlZmluZWQiLCJ4ckhpdFRlc3RTb3VyY2UiLCJfb25IaXRUZXN0U291cmNlIiwiaW5wdXRTb3VyY2UiLCJjYXRjaCIsImV4IiwicmVxdWVzdEhpdFRlc3RTb3VyY2VGb3JUcmFuc2llbnRJbnB1dCIsInRyYW5zaWVudCIsImNhbmNlbCIsImhpdFRlc3RTb3VyY2UiLCJYckhpdFRlc3RTb3VyY2UiLCJwdXNoIiwidXBkYXRlIiwiZnJhbWUiLCJzdXBwb3J0ZWQiLCJFVkVOVF9BVkFJTEFCTEUiLCJFVkVOVF9VTkFWQUlMQUJM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
