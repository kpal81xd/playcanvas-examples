import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrAnchor } from './xr-anchor.js';

/**
 * Callback used by {@link XrAnchors#create}.
 *
 * @callback XrAnchorCreateCallback
 * @param {Error|null} err - The Error object if failed to create an anchor or null.
 * @param {XrAnchor|null} anchor - The anchor that is tracked against real world geometry.
 */

/**
 * Anchors provide an ability to specify a point in the world that needs to be updated to
 * correctly reflect the evolving understanding of the world by the underlying AR system,
 * such that the anchor remains aligned with the same place in the physical world.
 * Anchors tend to persist better relative to the real world, especially during a longer
 * session with lots of movement.
 *
 * ```javascript
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
 *     anchors: true
 * });
 * ```
 * @augments EventHandler
 * @category XR
 */
class XrAnchors extends EventHandler {
  /**
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    var _window;
    super();
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @ignore
     */
    this.manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!window.XRAnchor;
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * @type {boolean}
     * @private
     */
    this._persistence = platform.browser && !!((_window = window) != null && (_window = _window.XRSession) != null && _window.prototype.restorePersistentAnchor);
    /**
     * List of anchor creation requests.
     *
     * @type {object[]}
     * @private
     */
    this._creationQueue = [];
    /**
     * Index of XrAnchors, with XRAnchor (native handle) used as a key.
     *
     * @type {Map<XRAnchor,XrAnchor>}
     * @private
     */
    this._index = new Map();
    /**
     * Index of XrAnchors, with UUID (persistent string) used as a key.
     *
     * @type {Map<string,XrAnchor>}
     * @private
     */
    this._indexByUuid = new Map();
    /**
     * @type {XrAnchor[]}
     * @private
     */
    this._list = [];
    /**
     * Map of callbacks to XRAnchors so that we can call its callback once
     * an anchor is updated with a pose for the first time.
     *
     * @type {Map<XrAnchor, XrAnchorCreateCallback>}
     * @private
     */
    this._callbacksAnchors = new Map();
    this.manager = manager;
    if (this._supported) {
      this.manager.on('start', this._onSessionStart, this);
      this.manager.on('end', this._onSessionEnd, this);
    }
  }

  /** @private */
  _onSessionStart() {
    const available = this.manager.session.enabledFeatures.indexOf('anchors') !== -1;
    if (!available) return;
    this._available = available;
    this.fire('available');
  }

  /** @private */
  _onSessionEnd() {
    if (!this._available) return;
    this._available = false;

    // clear anchor creation queue
    for (let _i = 0; _i < this._creationQueue.length; _i++) {
      if (!this._creationQueue[_i].callback) continue;
      this._creationQueue[_i].callback(new Error('session ended'), null);
    }
    this._creationQueue.length = 0;
    this._index.clear();
    this._indexByUuid.clear();

    // destroy all anchors
    let i = this._list.length;
    while (i--) {
      this._list[i].destroy();
    }
    this._list.length = 0;
    this.fire('unavailable');
  }

  /**
   * @param {XRAnchor} xrAnchor - XRAnchor that has been added.
   * @param {string|null} [uuid] - UUID string associated with persistent anchor.
   * @returns {XrAnchor} new instance of XrAnchor.
   * @private
   */
  _createAnchor(xrAnchor, uuid = null) {
    const anchor = new XrAnchor(this, xrAnchor, uuid);
    this._index.set(xrAnchor, anchor);
    if (uuid) this._indexByUuid.set(uuid, anchor);
    this._list.push(anchor);
    anchor.once('destroy', this._onAnchorDestroy, this);
    return anchor;
  }

  /**
   * @param {XRAnchor} xrAnchor - XRAnchor that has been destroyed.
   * @param {XrAnchor} anchor - Anchor that has been destroyed.
   * @private
   */
  _onAnchorDestroy(xrAnchor, anchor) {
    this._index.delete(xrAnchor);
    if (anchor.uuid) this._indexByUuid.delete(anchor.uuid);
    const ind = this._list.indexOf(anchor);
    if (ind !== -1) this._list.splice(ind, 1);
    this.fire('destroy', anchor);
  }

  /**
   * Create an anchor using position and rotation, or from hit test result.
   *
   * @param {import('../../core/math/vec3.js').Vec3|XRHitTestResult} position - Position for an anchor or
   * a hit test result.
   * @param {import('../../core/math/quat.js').Quat|XrAnchorCreateCallback} [rotation] - Rotation for an
   * anchor or a callback if creating from a hit test result.
   * @param {XrAnchorCreateCallback} [callback] - Callback to fire when anchor was created or failed to be
   * created.
   * @example
   * // create an anchor using a position and rotation
   * app.xr.anchors.create(position, rotation, function (err, anchor) {
   *     if (!err) {
   *         // new anchor has been created
   *     }
   * });
   * @example
   * // create an anchor from a hit test result
   * hitTestSource.on('result', (position, rotation, inputSource, hitTestResult) => {
   *     app.xr.anchors.create(hitTestResult, function (err, anchor) {
   *         if (!err) {
   *             // new anchor has been created
   *         }
   *     });
   * });
   */
  create(position, rotation, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'), null);
      return;
    }

    // eslint-disable-next-line no-undef
    if (window.XRHitTestResult && position instanceof XRHitTestResult) {
      const hitResult = position;
      callback = rotation;
      if (!this._supported) {
        callback == null || callback(new Error('Anchors API is not supported'), null);
        return;
      }
      if (!hitResult.createAnchor) {
        callback == null || callback(new Error('Creating Anchor from Hit Test is not supported'), null);
        return;
      }
      hitResult.createAnchor().then(xrAnchor => {
        const anchor = this._createAnchor(xrAnchor);
        callback == null || callback(null, anchor);
        this.fire('add', anchor);
      }).catch(ex => {
        callback == null || callback(ex, null);
        this.fire('error', ex);
      });
    } else {
      this._creationQueue.push({
        transform: new XRRigidTransform(position, rotation),
        // eslint-disable-line no-undef
        callback: callback
      });
    }
  }

  /**
   * Restore anchor using persistent UUID.
   *
   * @param {string} uuid - UUID string associated with persistent anchor.
   * @param {XrAnchorCreateCallback} [callback] - Callback to fire when anchor was created or failed to be created.
   * @example
   * // restore an anchor using uuid string
   * app.xr.anchors.restore(uuid, function (err, anchor) {
   *     if (!err) {
   *         // new anchor has been created
   *     }
   * });
   * @example
   * // restore all available persistent anchors
   * const uuids = app.xr.anchors.uuids;
   * for(let i = 0; i < uuids.length; i++) {
   *     app.xr.anchors.restore(uuids[i]);
   * }
   */
  restore(uuid, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'), null);
      return;
    }
    if (!this._persistence) {
      callback == null || callback(new Error('Anchor Persistence is not supported'), null);
      return;
    }
    if (!this.manager.active) {
      callback == null || callback(new Error('WebXR session is not active'), null);
      return;
    }
    this.manager.session.restorePersistentAnchor(uuid).then(xrAnchor => {
      const anchor = this._createAnchor(xrAnchor, uuid);
      callback == null || callback(null, anchor);
      this.fire('add', anchor);
    }).catch(ex => {
      callback == null || callback(ex, null);
      this.fire('error', ex);
    });
  }

  /**
   * Forget an anchor by removing its UUID from underlying systems.
   *
   * @param {string} uuid - UUID string associated with persistent anchor.
   * @param {import('./xr-anchor.js').XrAnchorForgetCallback} [callback] - Callback to
   * fire when anchor persistent data was removed or error if failed.
   * @example
   * // forget all available anchors
   * const uuids = app.xr.anchors.uuids;
   * for(let i = 0; i < uuids.length; i++) {
   *     app.xr.anchors.forget(uuids[i]);
   * }
   */
  forget(uuid, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'));
      return;
    }
    if (!this._persistence) {
      callback == null || callback(new Error('Anchor Persistence is not supported'));
      return;
    }
    if (!this.manager.active) {
      callback == null || callback(new Error('WebXR session is not active'));
      return;
    }
    this.manager.session.deletePersistentAnchor(uuid).then(() => {
      callback == null || callback(null);
    }).catch(ex => {
      callback == null || callback(ex);
      this.fire('error', ex);
    });
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    if (!this._available) return;

    // check if need to create anchors
    if (this._creationQueue.length) {
      for (let i = 0; i < this._creationQueue.length; i++) {
        const request = this._creationQueue[i];
        frame.createAnchor(request.transform, this.manager._referenceSpace).then(xrAnchor => {
          if (request.callback) this._callbacksAnchors.set(xrAnchor, request.callback);
        }).catch(ex => {
          if (request.callback) request.callback(ex, null);
          this.fire('error', ex);
        });
      }
      this._creationQueue.length = 0;
    }

    // check if destroyed
    for (const [xrAnchor, anchor] of this._index) {
      if (frame.trackedAnchors.has(xrAnchor)) continue;
      this._index.delete(xrAnchor);
      anchor.destroy();
    }

    // update existing anchors
    for (let i = 0; i < this._list.length; i++) {
      this._list[i].update(frame);
    }

    // check if added
    for (const xrAnchor of frame.trackedAnchors) {
      if (this._index.has(xrAnchor)) continue;
      try {
        const tmp = xrAnchor.anchorSpace; // eslint-disable-line no-unused-vars
      } catch (ex) {
        // if anchorSpace is not available, then anchor is invalid
        // and should not be created
        continue;
      }
      const anchor = this._createAnchor(xrAnchor);
      anchor.update(frame);
      const callback = this._callbacksAnchors.get(xrAnchor);
      if (callback) {
        this._callbacksAnchors.delete(xrAnchor);
        callback(null, anchor);
      }
      this.fire('add', anchor);
    }
  }

  /**
   * True if Anchors are supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if Anchors are available. This information is available only when session has started.
   *
   * @type {boolean}
   */
  get available() {
    return this._available;
  }

  /**
   * True if Anchors support persistence.
   *
   * @type {boolean}
   */
  get persistence() {
    return this._persistence;
  }

  /**
   * Array of UUID strings of persistent anchors, or null if not available.
   *
   * @type {null|string[]}
   */
  get uuids() {
    if (!this._available) return null;
    if (!this._persistence) return null;
    if (!this.manager.active) return null;
    return this.manager.session.persistentAnchors;
  }

  /**
   * List of available {@link XrAnchor}s.
   *
   * @type {XrAnchor[]}
   */
  get list() {
    return this._list;
  }
}
/**
 * Fired when anchors become available.
 *
 * @event
 * @example
 * app.xr.anchors.on('available', () => {
 *     console.log('Anchors are available');
 * });
 */
XrAnchors.EVENT_AVAILABLE = 'available';
/**
 * Fired when anchors become unavailable.
 *
 * @event
 * @example
 * app.xr.anchors.on('unavailable', () => {
 *     console.log('Anchors are unavailable');
 * });
 */
XrAnchors.EVENT_UNAVAILABLE = 'unavailable';
/**
 * Fired when an anchor failed to be created. The handler is passed an Error object.
 *
 * @event
 * @example
 * app.xr.anchors.on('error', (err) => {
 *     console.error(err.message);
 * });
 */
XrAnchors.EVENT_ERROR = 'error';
/**
 * Fired when a new {@link XrAnchor} is added. The handler is passed the {@link XrAnchor} that
 * was added.
 *
 * @event
 * @example
 * app.xr.anchors.on('add', (anchor) => {
 *     console.log('Anchor added');
 * });
 */
XrAnchors.EVENT_ADD = 'add';
/**
 * Fired when an {@link XrAnchor} is destroyed. The handler is passed the {@link XrAnchor} that
 * was destroyed.
 *
 * @event
 * @example
 * app.xr.anchors.on('destroy', (anchor) => {
 *     console.log('Anchor destroyed');
 * });
 */
XrAnchors.EVENT_DESTROY = 'destroy';

export { XrAnchors };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItYW5jaG9ycy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1hbmNob3JzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgWHJBbmNob3IgfSBmcm9tICcuL3hyLWFuY2hvci5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgWHJBbmNob3JzI2NyZWF0ZX0uXG4gKlxuICogQGNhbGxiYWNrIFhyQW5jaG9yQ3JlYXRlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBpZiBmYWlsZWQgdG8gY3JlYXRlIGFuIGFuY2hvciBvciBudWxsLlxuICogQHBhcmFtIHtYckFuY2hvcnxudWxsfSBhbmNob3IgLSBUaGUgYW5jaG9yIHRoYXQgaXMgdHJhY2tlZCBhZ2FpbnN0IHJlYWwgd29ybGQgZ2VvbWV0cnkuXG4gKi9cblxuLyoqXG4gKiBBbmNob3JzIHByb3ZpZGUgYW4gYWJpbGl0eSB0byBzcGVjaWZ5IGEgcG9pbnQgaW4gdGhlIHdvcmxkIHRoYXQgbmVlZHMgdG8gYmUgdXBkYXRlZCB0b1xuICogY29ycmVjdGx5IHJlZmxlY3QgdGhlIGV2b2x2aW5nIHVuZGVyc3RhbmRpbmcgb2YgdGhlIHdvcmxkIGJ5IHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbSxcbiAqIHN1Y2ggdGhhdCB0aGUgYW5jaG9yIHJlbWFpbnMgYWxpZ25lZCB3aXRoIHRoZSBzYW1lIHBsYWNlIGluIHRoZSBwaHlzaWNhbCB3b3JsZC5cbiAqIEFuY2hvcnMgdGVuZCB0byBwZXJzaXN0IGJldHRlciByZWxhdGl2ZSB0byB0aGUgcmVhbCB3b3JsZCwgZXNwZWNpYWxseSBkdXJpbmcgYSBsb25nZXJcbiAqIHNlc3Npb24gd2l0aCBsb3RzIG9mIG1vdmVtZW50LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGFwcC54ci5zdGFydChjYW1lcmEsIHBjLlhSVFlQRV9BUiwgcGMuWFJTUEFDRV9MT0NBTEZMT09SLCB7XG4gKiAgICAgYW5jaG9yczogdHJ1ZVxuICogfSk7XG4gKiBgYGBcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqIEBjYXRlZ29yeSBYUlxuICovXG5jbGFzcyBYckFuY2hvcnMgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW5jaG9ycyBiZWNvbWUgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuYW5jaG9ycy5vbignYXZhaWxhYmxlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnQW5jaG9ycyBhcmUgYXZhaWxhYmxlJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FWQUlMQUJMRSA9ICdhdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbmNob3JzIGJlY29tZSB1bmF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmFuY2hvcnMub24oJ3VuYXZhaWxhYmxlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnQW5jaG9ycyBhcmUgdW5hdmFpbGFibGUnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVU5BVkFJTEFCTEUgPSAndW5hdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmNob3IgZmFpbGVkIHRvIGJlIGNyZWF0ZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhbiBFcnJvciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5hbmNob3JzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VSUk9SID0gJ2Vycm9yJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBuZXcge0BsaW5rIFhyQW5jaG9yfSBpcyBhZGRlZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSB7QGxpbmsgWHJBbmNob3J9IHRoYXRcbiAgICAgKiB3YXMgYWRkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5hbmNob3JzLm9uKCdhZGQnLCAoYW5jaG9yKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdBbmNob3IgYWRkZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQUREID0gJ2FkZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIHtAbGluayBYckFuY2hvcn0gaXMgZGVzdHJveWVkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIHtAbGluayBYckFuY2hvcn0gdGhhdFxuICAgICAqIHdhcyBkZXN0cm95ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5hbmNob3JzLm9uKCdkZXN0cm95JywgKGFuY2hvcikgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnQW5jaG9yIGRlc3Ryb3llZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ERVNUUk9ZID0gJ2Rlc3Ryb3knO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5YUkFuY2hvcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2F2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGVyc2lzdGVuY2UgPSBwbGF0Zm9ybS5icm93c2VyICYmICEhd2luZG93Py5YUlNlc3Npb24/LnByb3RvdHlwZS5yZXN0b3JlUGVyc2lzdGVudEFuY2hvcjtcblxuICAgIC8qKlxuICAgICAqIExpc3Qgb2YgYW5jaG9yIGNyZWF0aW9uIHJlcXVlc3RzLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0aW9uUXVldWUgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEluZGV4IG9mIFhyQW5jaG9ycywgd2l0aCBYUkFuY2hvciAobmF0aXZlIGhhbmRsZSkgdXNlZCBhcyBhIGtleS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8WFJBbmNob3IsWHJBbmNob3I+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luZGV4ID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogSW5kZXggb2YgWHJBbmNob3JzLCB3aXRoIFVVSUQgKHBlcnNpc3RlbnQgc3RyaW5nKSB1c2VkIGFzIGEga2V5LlxuICAgICAqXG4gICAgICogQHR5cGUge01hcDxzdHJpbmcsWHJBbmNob3I+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luZGV4QnlVdWlkID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hyQW5jaG9yW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlzdCA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogTWFwIG9mIGNhbGxiYWNrcyB0byBYUkFuY2hvcnMgc28gdGhhdCB3ZSBjYW4gY2FsbCBpdHMgY2FsbGJhY2sgb25jZVxuICAgICAqIGFuIGFuY2hvciBpcyB1cGRhdGVkIHdpdGggYSBwb3NlIGZvciB0aGUgZmlyc3QgdGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8WHJBbmNob3IsIFhyQW5jaG9yQ3JlYXRlQ2FsbGJhY2s+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGxiYWNrc0FuY2hvcnMgPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfSBtYW5hZ2VyIC0gV2ViWFIgTWFuYWdlci5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobWFuYWdlcikge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLm9uKCdzdGFydCcsIHRoaXMuX29uU2Vzc2lvblN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5vbignZW5kJywgdGhpcy5fb25TZXNzaW9uRW5kLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25TdGFydCgpIHtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gdGhpcy5tYW5hZ2VyLnNlc3Npb24uZW5hYmxlZEZlYXR1cmVzLmluZGV4T2YoJ2FuY2hvcnMnKSAhPT0gLTE7XG4gICAgICAgIGlmICghYXZhaWxhYmxlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IGF2YWlsYWJsZTtcbiAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcblxuICAgICAgICAvLyBjbGVhciBhbmNob3IgY3JlYXRpb24gcXVldWVcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jcmVhdGlvblF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2NyZWF0aW9uUXVldWVbaV0uY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2NyZWF0aW9uUXVldWVbaV0uY2FsbGJhY2sobmV3IEVycm9yKCdzZXNzaW9uIGVuZGVkJyksIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NyZWF0aW9uUXVldWUubGVuZ3RoID0gMDtcblxuICAgICAgICB0aGlzLl9pbmRleC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9pbmRleEJ5VXVpZC5jbGVhcigpO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgYWxsIGFuY2hvcnNcbiAgICAgICAgbGV0IGkgPSB0aGlzLl9saXN0Lmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgdGhpcy5fbGlzdFtpXS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbGlzdC5sZW5ndGggPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZSgndW5hdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSQW5jaG9yfSB4ckFuY2hvciAtIFhSQW5jaG9yIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gW3V1aWRdIC0gVVVJRCBzdHJpbmcgYXNzb2NpYXRlZCB3aXRoIHBlcnNpc3RlbnQgYW5jaG9yLlxuICAgICAqIEByZXR1cm5zIHtYckFuY2hvcn0gbmV3IGluc3RhbmNlIG9mIFhyQW5jaG9yLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZUFuY2hvcih4ckFuY2hvciwgdXVpZCA9IG51bGwpIHtcbiAgICAgICAgY29uc3QgYW5jaG9yID0gbmV3IFhyQW5jaG9yKHRoaXMsIHhyQW5jaG9yLCB1dWlkKTtcbiAgICAgICAgdGhpcy5faW5kZXguc2V0KHhyQW5jaG9yLCBhbmNob3IpO1xuICAgICAgICBpZiAodXVpZCkgdGhpcy5faW5kZXhCeVV1aWQuc2V0KHV1aWQsIGFuY2hvcik7XG4gICAgICAgIHRoaXMuX2xpc3QucHVzaChhbmNob3IpO1xuICAgICAgICBhbmNob3Iub25jZSgnZGVzdHJveScsIHRoaXMuX29uQW5jaG9yRGVzdHJveSwgdGhpcyk7XG4gICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUkFuY2hvcn0geHJBbmNob3IgLSBYUkFuY2hvciB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cbiAgICAgKiBAcGFyYW0ge1hyQW5jaG9yfSBhbmNob3IgLSBBbmNob3IgdGhhdCBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25BbmNob3JEZXN0cm95KHhyQW5jaG9yLCBhbmNob3IpIHtcbiAgICAgICAgdGhpcy5faW5kZXguZGVsZXRlKHhyQW5jaG9yKTtcbiAgICAgICAgaWYgKGFuY2hvci51dWlkKSB0aGlzLl9pbmRleEJ5VXVpZC5kZWxldGUoYW5jaG9yLnV1aWQpO1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9saXN0LmluZGV4T2YoYW5jaG9yKTtcbiAgICAgICAgaWYgKGluZCAhPT0gLTEpIHRoaXMuX2xpc3Quc3BsaWNlKGluZCwgMSk7XG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScsIGFuY2hvcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGFuY2hvciB1c2luZyBwb3NpdGlvbiBhbmQgcm90YXRpb24sIG9yIGZyb20gaGl0IHRlc3QgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM3xYUkhpdFRlc3RSZXN1bHR9IHBvc2l0aW9uIC0gUG9zaXRpb24gZm9yIGFuIGFuY2hvciBvclxuICAgICAqIGEgaGl0IHRlc3QgcmVzdWx0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcycpLlF1YXR8WHJBbmNob3JDcmVhdGVDYWxsYmFja30gW3JvdGF0aW9uXSAtIFJvdGF0aW9uIGZvciBhblxuICAgICAqIGFuY2hvciBvciBhIGNhbGxiYWNrIGlmIGNyZWF0aW5nIGZyb20gYSBoaXQgdGVzdCByZXN1bHQuXG4gICAgICogQHBhcmFtIHtYckFuY2hvckNyZWF0ZUNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgdG8gZmlyZSB3aGVuIGFuY2hvciB3YXMgY3JlYXRlZCBvciBmYWlsZWQgdG8gYmVcbiAgICAgKiBjcmVhdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gY3JlYXRlIGFuIGFuY2hvciB1c2luZyBhIHBvc2l0aW9uIGFuZCByb3RhdGlvblxuICAgICAqIGFwcC54ci5hbmNob3JzLmNyZWF0ZShwb3NpdGlvbiwgcm90YXRpb24sIGZ1bmN0aW9uIChlcnIsIGFuY2hvcikge1xuICAgICAqICAgICBpZiAoIWVycikge1xuICAgICAqICAgICAgICAgLy8gbmV3IGFuY2hvciBoYXMgYmVlbiBjcmVhdGVkXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGNyZWF0ZSBhbiBhbmNob3IgZnJvbSBhIGhpdCB0ZXN0IHJlc3VsdFxuICAgICAqIGhpdFRlc3RTb3VyY2Uub24oJ3Jlc3VsdCcsIChwb3NpdGlvbiwgcm90YXRpb24sIGlucHV0U291cmNlLCBoaXRUZXN0UmVzdWx0KSA9PiB7XG4gICAgICogICAgIGFwcC54ci5hbmNob3JzLmNyZWF0ZShoaXRUZXN0UmVzdWx0LCBmdW5jdGlvbiAoZXJyLCBhbmNob3IpIHtcbiAgICAgKiAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICogICAgICAgICAgICAgLy8gbmV3IGFuY2hvciBoYXMgYmVlbiBjcmVhdGVkXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNyZWF0ZShwb3NpdGlvbiwgcm90YXRpb24sIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBFcnJvcignQW5jaG9ycyBBUEkgaXMgbm90IGF2YWlsYWJsZScpLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bmRlZlxuICAgICAgICBpZiAod2luZG93LlhSSGl0VGVzdFJlc3VsdCAmJiBwb3NpdGlvbiBpbnN0YW5jZW9mIFhSSGl0VGVzdFJlc3VsdCkge1xuICAgICAgICAgICAgY29uc3QgaGl0UmVzdWx0ID0gcG9zaXRpb247XG4gICAgICAgICAgICBjYWxsYmFjayA9IHJvdGF0aW9uO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IEVycm9yKCdBbmNob3JzIEFQSSBpcyBub3Qgc3VwcG9ydGVkJyksIG51bGwpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFoaXRSZXN1bHQuY3JlYXRlQW5jaG9yKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2s/LihuZXcgRXJyb3IoJ0NyZWF0aW5nIEFuY2hvciBmcm9tIEhpdCBUZXN0IGlzIG5vdCBzdXBwb3J0ZWQnKSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBoaXRSZXN1bHQuY3JlYXRlQW5jaG9yKClcbiAgICAgICAgICAgICAgICAudGhlbigoeHJBbmNob3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5jaG9yID0gdGhpcy5fY3JlYXRlQW5jaG9yKHhyQW5jaG9yKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCBhbmNob3IpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGFuY2hvcik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4oZXgsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRpb25RdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IG5ldyBYUlJpZ2lkVHJhbnNmb3JtKHBvc2l0aW9uLCByb3RhdGlvbiksIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogY2FsbGJhY2tcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdG9yZSBhbmNob3IgdXNpbmcgcGVyc2lzdGVudCBVVUlELlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHV1aWQgLSBVVUlEIHN0cmluZyBhc3NvY2lhdGVkIHdpdGggcGVyc2lzdGVudCBhbmNob3IuXG4gICAgICogQHBhcmFtIHtYckFuY2hvckNyZWF0ZUNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgdG8gZmlyZSB3aGVuIGFuY2hvciB3YXMgY3JlYXRlZCBvciBmYWlsZWQgdG8gYmUgY3JlYXRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHJlc3RvcmUgYW4gYW5jaG9yIHVzaW5nIHV1aWQgc3RyaW5nXG4gICAgICogYXBwLnhyLmFuY2hvcnMucmVzdG9yZSh1dWlkLCBmdW5jdGlvbiAoZXJyLCBhbmNob3IpIHtcbiAgICAgKiAgICAgaWYgKCFlcnIpIHtcbiAgICAgKiAgICAgICAgIC8vIG5ldyBhbmNob3IgaGFzIGJlZW4gY3JlYXRlZFxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyByZXN0b3JlIGFsbCBhdmFpbGFibGUgcGVyc2lzdGVudCBhbmNob3JzXG4gICAgICogY29uc3QgdXVpZHMgPSBhcHAueHIuYW5jaG9ycy51dWlkcztcbiAgICAgKiBmb3IobGV0IGkgPSAwOyBpIDwgdXVpZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgKiAgICAgYXBwLnhyLmFuY2hvcnMucmVzdG9yZSh1dWlkc1tpXSk7XG4gICAgICogfVxuICAgICAqL1xuICAgIHJlc3RvcmUodXVpZCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IEVycm9yKCdBbmNob3JzIEFQSSBpcyBub3QgYXZhaWxhYmxlJyksIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9wZXJzaXN0ZW5jZSkge1xuICAgICAgICAgICAgY2FsbGJhY2s/LihuZXcgRXJyb3IoJ0FuY2hvciBQZXJzaXN0ZW5jZSBpcyBub3Qgc3VwcG9ydGVkJyksIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLm1hbmFnZXIuYWN0aXZlKSB7XG4gICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBFcnJvcignV2ViWFIgc2Vzc2lvbiBpcyBub3QgYWN0aXZlJyksIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNlc3Npb24ucmVzdG9yZVBlcnNpc3RlbnRBbmNob3IodXVpZClcbiAgICAgICAgICAgIC50aGVuKCh4ckFuY2hvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuY2hvciA9IHRoaXMuX2NyZWF0ZUFuY2hvcih4ckFuY2hvciwgdXVpZCk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCBhbmNob3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnYWRkJywgYW5jaG9yKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2s/LihleCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcmdldCBhbiBhbmNob3IgYnkgcmVtb3ZpbmcgaXRzIFVVSUQgZnJvbSB1bmRlcmx5aW5nIHN5c3RlbXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXVpZCAtIFVVSUQgc3RyaW5nIGFzc29jaWF0ZWQgd2l0aCBwZXJzaXN0ZW50IGFuY2hvci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1hbmNob3IuanMnKS5YckFuY2hvckZvcmdldENhbGxiYWNrfSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgdG9cbiAgICAgKiBmaXJlIHdoZW4gYW5jaG9yIHBlcnNpc3RlbnQgZGF0YSB3YXMgcmVtb3ZlZCBvciBlcnJvciBpZiBmYWlsZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBmb3JnZXQgYWxsIGF2YWlsYWJsZSBhbmNob3JzXG4gICAgICogY29uc3QgdXVpZHMgPSBhcHAueHIuYW5jaG9ycy51dWlkcztcbiAgICAgKiBmb3IobGV0IGkgPSAwOyBpIDwgdXVpZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgKiAgICAgYXBwLnhyLmFuY2hvcnMuZm9yZ2V0KHV1aWRzW2ldKTtcbiAgICAgKiB9XG4gICAgICovXG4gICAgZm9yZ2V0KHV1aWQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBFcnJvcignQW5jaG9ycyBBUEkgaXMgbm90IGF2YWlsYWJsZScpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fcGVyc2lzdGVuY2UpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IEVycm9yKCdBbmNob3IgUGVyc2lzdGVuY2UgaXMgbm90IHN1cHBvcnRlZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5tYW5hZ2VyLmFjdGl2ZSkge1xuICAgICAgICAgICAgY2FsbGJhY2s/LihuZXcgRXJyb3IoJ1dlYlhSIHNlc3Npb24gaXMgbm90IGFjdGl2ZScpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFuYWdlci5zZXNzaW9uLmRlbGV0ZVBlcnNpc3RlbnRBbmNob3IodXVpZClcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBjaGVjayBpZiBuZWVkIHRvIGNyZWF0ZSBhbmNob3JzXG4gICAgICAgIGlmICh0aGlzLl9jcmVhdGlvblF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jcmVhdGlvblF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMuX2NyZWF0aW9uUXVldWVbaV07XG5cbiAgICAgICAgICAgICAgICBmcmFtZS5jcmVhdGVBbmNob3IocmVxdWVzdC50cmFuc2Zvcm0sIHRoaXMubWFuYWdlci5fcmVmZXJlbmNlU3BhY2UpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCh4ckFuY2hvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QuY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzQW5jaG9ycy5zZXQoeHJBbmNob3IsIHJlcXVlc3QuY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVxdWVzdC5jYWxsYmFjaylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKGV4LCBudWxsKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2NyZWF0aW9uUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIGRlc3Ryb3llZFxuICAgICAgICBmb3IgKGNvbnN0IFt4ckFuY2hvciwgYW5jaG9yXSBvZiB0aGlzLl9pbmRleCkge1xuICAgICAgICAgICAgaWYgKGZyYW1lLnRyYWNrZWRBbmNob3JzLmhhcyh4ckFuY2hvcikpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2luZGV4LmRlbGV0ZSh4ckFuY2hvcik7XG4gICAgICAgICAgICBhbmNob3IuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nIGFuY2hvcnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9saXN0W2ldLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaGVjayBpZiBhZGRlZFxuICAgICAgICBmb3IgKGNvbnN0IHhyQW5jaG9yIG9mIGZyYW1lLnRyYWNrZWRBbmNob3JzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5faW5kZXguaGFzKHhyQW5jaG9yKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0bXAgPSB4ckFuY2hvci5hbmNob3JTcGFjZTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBhbmNob3JTcGFjZSBpcyBub3QgYXZhaWxhYmxlLCB0aGVuIGFuY2hvciBpcyBpbnZhbGlkXG4gICAgICAgICAgICAgICAgLy8gYW5kIHNob3VsZCBub3QgYmUgY3JlYXRlZFxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhbmNob3IgPSB0aGlzLl9jcmVhdGVBbmNob3IoeHJBbmNob3IpO1xuICAgICAgICAgICAgYW5jaG9yLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gdGhpcy5fY2FsbGJhY2tzQW5jaG9ycy5nZXQoeHJBbmNob3IpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzQW5jaG9ycy5kZWxldGUoeHJBbmNob3IpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGFuY2hvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYWRkJywgYW5jaG9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgQW5jaG9ycyBhcmUgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIEFuY2hvcnMgYXJlIGF2YWlsYWJsZS4gVGhpcyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUgb25seSB3aGVuIHNlc3Npb24gaGFzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgQW5jaG9ycyBzdXBwb3J0IHBlcnNpc3RlbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBlcnNpc3RlbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGVyc2lzdGVuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgVVVJRCBzdHJpbmdzIG9mIHBlcnNpc3RlbnQgYW5jaG9ycywgb3IgbnVsbCBpZiBub3QgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bGx8c3RyaW5nW119XG4gICAgICovXG4gICAgZ2V0IHV1aWRzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIGlmICghdGhpcy5fcGVyc2lzdGVuY2UpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICBpZiAoIXRoaXMubWFuYWdlci5hY3RpdmUpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5tYW5hZ2VyLnNlc3Npb24ucGVyc2lzdGVudEFuY2hvcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBhdmFpbGFibGUge0BsaW5rIFhyQW5jaG9yfXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJBbmNob3JbXX1cbiAgICAgKi9cbiAgICBnZXQgbGlzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpc3Q7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYckFuY2hvcnMgfTtcbiJdLCJuYW1lcyI6WyJYckFuY2hvcnMiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJfd2luZG93IiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSQW5jaG9yIiwiX2F2YWlsYWJsZSIsIl9wZXJzaXN0ZW5jZSIsIlhSU2Vzc2lvbiIsInByb3RvdHlwZSIsInJlc3RvcmVQZXJzaXN0ZW50QW5jaG9yIiwiX2NyZWF0aW9uUXVldWUiLCJfaW5kZXgiLCJNYXAiLCJfaW5kZXhCeVV1aWQiLCJfbGlzdCIsIl9jYWxsYmFja3NBbmNob3JzIiwib24iLCJfb25TZXNzaW9uU3RhcnQiLCJfb25TZXNzaW9uRW5kIiwiYXZhaWxhYmxlIiwic2Vzc2lvbiIsImVuYWJsZWRGZWF0dXJlcyIsImluZGV4T2YiLCJmaXJlIiwiaSIsImxlbmd0aCIsImNhbGxiYWNrIiwiRXJyb3IiLCJjbGVhciIsImRlc3Ryb3kiLCJfY3JlYXRlQW5jaG9yIiwieHJBbmNob3IiLCJ1dWlkIiwiYW5jaG9yIiwiWHJBbmNob3IiLCJzZXQiLCJwdXNoIiwib25jZSIsIl9vbkFuY2hvckRlc3Ryb3kiLCJkZWxldGUiLCJpbmQiLCJzcGxpY2UiLCJjcmVhdGUiLCJwb3NpdGlvbiIsInJvdGF0aW9uIiwiWFJIaXRUZXN0UmVzdWx0IiwiaGl0UmVzdWx0IiwiY3JlYXRlQW5jaG9yIiwidGhlbiIsImNhdGNoIiwiZXgiLCJ0cmFuc2Zvcm0iLCJYUlJpZ2lkVHJhbnNmb3JtIiwicmVzdG9yZSIsImFjdGl2ZSIsImZvcmdldCIsImRlbGV0ZVBlcnNpc3RlbnRBbmNob3IiLCJ1cGRhdGUiLCJmcmFtZSIsInJlcXVlc3QiLCJfcmVmZXJlbmNlU3BhY2UiLCJ0cmFja2VkQW5jaG9ycyIsImhhcyIsInRtcCIsImFuY2hvclNwYWNlIiwiZ2V0Iiwic3VwcG9ydGVkIiwicGVyc2lzdGVuY2UiLCJ1dWlkcyIsInBlcnNpc3RlbnRBbmNob3JzIiwibGlzdCIsIkVWRU5UX0FWQUlMQUJMRSIsIkVWRU5UX1VOQVZBSUxBQkxFIiwiRVZFTlRfRVJST1IiLCJFVkVOVF9BREQiLCJFVkVOVF9ERVNUUk9ZIl0sIm1hcHBpbmdzIjoiOzs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxTQUFTQyxZQUFZLENBQUM7QUF5SGpDO0FBQ0o7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtBQUFBLElBQUEsSUFBQUMsT0FBQSxDQUFBO0FBQ2pCLElBQUEsS0FBSyxFQUFFLENB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
