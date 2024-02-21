import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * Callback used by {@link XrAnchor#persist}.
 *
 * @callback XrAnchorPersistCallback
 * @param {Error|null} err - The Error object if failed to persist an anchor or null.
 * @param {string|null} uuid - unique string that can be used to restore {@link XRAnchor}
 * in another session.
 */

/**
 * Callback used by {@link XrAnchor#forget}.
 *
 * @callback XrAnchorForgetCallback
 * @param {Error|null} err - The Error object if failed to forget an anchor or null if succeeded.
 */

/**
 * An anchor keeps track of a position and rotation that is fixed relative to the real world.
 * This allows the application to adjust the location of the virtual objects placed in the
 * scene in a way that helps with maintaining the illusion that the placed objects are really
 * present in the user’s environment.
 *
 * @augments EventHandler
 * @category XR
 */
class XrAnchor extends EventHandler {
  /**
   * @param {import('./xr-anchors.js').XrAnchors} anchors - Anchor manager.
   * @param {object} xrAnchor - native XRAnchor object that is provided by WebXR API
   * @param {string|null} uuid - ID string associated with a persistent anchor
   * @hideconstructor
   */
  constructor(anchors, xrAnchor, uuid = null) {
    super();
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
    /**
     * @type {string|null}
     * @private
     */
    this._uuid = null;
    /**
     * @type {string[]|null}
     * @private
     */
    this._uuidRequests = null;
    this._anchors = anchors;
    this._xrAnchor = xrAnchor;
    this._uuid = uuid;
  }

  /**
   * Destroy an anchor.
   */
  destroy() {
    if (!this._xrAnchor) return;
    const xrAnchor = this._xrAnchor;
    this._xrAnchor.delete();
    this._xrAnchor = null;
    this.fire('destroy', xrAnchor, this);
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    if (!this._xrAnchor) return;
    const pose = frame.getPose(this._xrAnchor.anchorSpace, this._anchors.manager._referenceSpace);
    if (pose) {
      if (this._position.equals(pose.transform.position) && this._rotation.equals(pose.transform.orientation)) return;
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
      this.fire('change');
    }
  }

  /**
   * Get the world space position of an anchor.
   *
   * @returns {Vec3} The world space position of an anchor.
   */
  getPosition() {
    return this._position;
  }

  /**
   * Get the world space rotation of an anchor.
   *
   * @returns {Quat} The world space rotation of an anchor.
   */
  getRotation() {
    return this._rotation;
  }

  /**
   * This method provides a way to persist anchor between WebXR sessions by
   * providing a unique UUID of an anchor, that can be used later for restoring
   * an anchor from underlying system.
   * Bear in mind that underlying systems might have a limit on number of anchors
   * allowed to be persisted per origin.
   *
   * @param {XrAnchorPersistCallback} [callback] - Callback to fire when anchor
   * persistent UUID has been generated or error if failed.
   */
  persist(callback) {
    if (!this._anchors.persistence) {
      callback == null || callback(new Error('Persistent Anchors are not supported'), null);
      return;
    }
    if (this._uuid) {
      callback == null || callback(null, this._uuid);
      return;
    }
    if (this._uuidRequests) {
      if (callback) this._uuidRequests.push(callback);
      return;
    }
    this._uuidRequests = [];
    this._xrAnchor.requestPersistentHandle().then(uuid => {
      this._uuid = uuid;
      this._anchors._indexByUuid.set(this._uuid, this);
      callback == null || callback(null, uuid);
      for (let i = 0; i < this._uuidRequests.length; i++) {
        this._uuidRequests[i](null, uuid);
      }
      this._uuidRequests = null;
      this.fire('persist', uuid);
    }).catch(ex => {
      callback == null || callback(ex, null);
      for (let i = 0; i < this._uuidRequests.length; i++) {
        this._uuidRequests[i](ex);
      }
      this._uuidRequests = null;
    });
  }

  /**
   * Remove persistent UUID of an anchor from an underlying system.
   *
   * @param {XrAnchorForgetCallback} [callback] - Callback to fire when anchor has been
   * forgotten or error if failed.
   */
  forget(callback) {
    if (!this._uuid) {
      callback == null || callback(new Error('Anchor is not persistent'));
      return;
    }
    this._anchors.forget(this._uuid, ex => {
      this._uuid = null;
      callback == null || callback(ex);
      this.fire('forget');
    });
  }

  /**
   * UUID string of a persistent anchor or null if not persisted.
   *
   * @type {null|string}
   */
  get uuid() {
    return this._uuid;
  }

  /**
   * True if an anchor is persistent.
   *
   * @type {boolean}
   */
  get persistent() {
    return !!this._uuid;
  }
}
/**
 * Fired when an anchor is destroyed.
 *
 * @event
 * @example
 * // once anchor is destroyed
 * anchor.once('destroy', () => {
 *     // destroy its related entity
 *     entity.destroy();
 * });
 */
XrAnchor.EVENT_DESTROY = 'destroy';
/**
 * Fired when an anchor's position and/or rotation is changed.
 *
 * @event
 * @example
 * anchor.on('change', () => {
 *     // anchor has been updated
 *     entity.setPosition(anchor.getPosition());
 *     entity.setRotation(anchor.getRotation());
 * });
 */
XrAnchor.EVENT_CHANGE = 'change';
/**
 * Fired when an anchor has has been persisted. The handler is passed the UUID string that can
 * be used to restore this anchor.
 *
 * @event
 * @example
 * anchor.on('persist', (uuid) => {
 *     // anchor has been persisted
 * });
 */
XrAnchor.EVENT_PERSIST = 'persist';
/**
 * Fired when an anchor has been forgotten.
 *
 * @event
 * @example
 * anchor.on('forget', () => {
 *     // anchor has been forgotten
 * });
 */
XrAnchor.EVENT_FORGET = 'forget';

export { XrAnchor };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItYW5jaG9yLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLWFuY2hvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYckFuY2hvciNwZXJzaXN0fS5cbiAqXG4gKiBAY2FsbGJhY2sgWHJBbmNob3JQZXJzaXN0Q2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBpZiBmYWlsZWQgdG8gcGVyc2lzdCBhbiBhbmNob3Igb3IgbnVsbC5cbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IHV1aWQgLSB1bmlxdWUgc3RyaW5nIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzdG9yZSB7QGxpbmsgWFJBbmNob3J9XG4gKiBpbiBhbm90aGVyIHNlc3Npb24uXG4gKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYckFuY2hvciNmb3JnZXR9LlxuICpcbiAqIEBjYWxsYmFjayBYckFuY2hvckZvcmdldENhbGxiYWNrXG4gKiBAcGFyYW0ge0Vycm9yfG51bGx9IGVyciAtIFRoZSBFcnJvciBvYmplY3QgaWYgZmFpbGVkIHRvIGZvcmdldCBhbiBhbmNob3Igb3IgbnVsbCBpZiBzdWNjZWVkZWQuXG4gKi9cblxuLyoqXG4gKiBBbiBhbmNob3Iga2VlcHMgdHJhY2sgb2YgYSBwb3NpdGlvbiBhbmQgcm90YXRpb24gdGhhdCBpcyBmaXhlZCByZWxhdGl2ZSB0byB0aGUgcmVhbCB3b3JsZC5cbiAqIFRoaXMgYWxsb3dzIHRoZSBhcHBsaWNhdGlvbiB0byBhZGp1c3QgdGhlIGxvY2F0aW9uIG9mIHRoZSB2aXJ0dWFsIG9iamVjdHMgcGxhY2VkIGluIHRoZVxuICogc2NlbmUgaW4gYSB3YXkgdGhhdCBoZWxwcyB3aXRoIG1haW50YWluaW5nIHRoZSBpbGx1c2lvbiB0aGF0IHRoZSBwbGFjZWQgb2JqZWN0cyBhcmUgcmVhbGx5XG4gKiBwcmVzZW50IGluIHRoZSB1c2Vy4oCZcyBlbnZpcm9ubWVudC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgWFJcbiAqL1xuY2xhc3MgWHJBbmNob3IgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5jaG9yIGlzIGRlc3Ryb3llZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gb25jZSBhbmNob3IgaXMgZGVzdHJveWVkXG4gICAgICogYW5jaG9yLm9uY2UoJ2Rlc3Ryb3knLCAoKSA9PiB7XG4gICAgICogICAgIC8vIGRlc3Ryb3kgaXRzIHJlbGF0ZWQgZW50aXR5XG4gICAgICogICAgIGVudGl0eS5kZXN0cm95KCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0RFU1RST1kgPSAnZGVzdHJveSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuY2hvcidzIHBvc2l0aW9uIGFuZC9vciByb3RhdGlvbiBpcyBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhbmNob3Iub24oJ2NoYW5nZScsICgpID0+IHtcbiAgICAgKiAgICAgLy8gYW5jaG9yIGhhcyBiZWVuIHVwZGF0ZWRcbiAgICAgKiAgICAgZW50aXR5LnNldFBvc2l0aW9uKGFuY2hvci5nZXRQb3NpdGlvbigpKTtcbiAgICAgKiAgICAgZW50aXR5LnNldFJvdGF0aW9uKGFuY2hvci5nZXRSb3RhdGlvbigpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ0hBTkdFID0gJ2NoYW5nZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuY2hvciBoYXMgaGFzIGJlZW4gcGVyc2lzdGVkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIFVVSUQgc3RyaW5nIHRoYXQgY2FuXG4gICAgICogYmUgdXNlZCB0byByZXN0b3JlIHRoaXMgYW5jaG9yLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhbmNob3Iub24oJ3BlcnNpc3QnLCAodXVpZCkgPT4ge1xuICAgICAqICAgICAvLyBhbmNob3IgaGFzIGJlZW4gcGVyc2lzdGVkXG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1BFUlNJU1QgPSAncGVyc2lzdCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuY2hvciBoYXMgYmVlbiBmb3Jnb3R0ZW4uXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFuY2hvci5vbignZm9yZ2V0JywgKCkgPT4ge1xuICAgICAqICAgICAvLyBhbmNob3IgaGFzIGJlZW4gZm9yZ290dGVuXG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0ZPUkdFVCA9ICdmb3JnZXQnO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3V1aWQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXVpZFJlcXVlc3RzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWFuY2hvcnMuanMnKS5YckFuY2hvcnN9IGFuY2hvcnMgLSBBbmNob3IgbWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0geHJBbmNob3IgLSBuYXRpdmUgWFJBbmNob3Igb2JqZWN0IHRoYXQgaXMgcHJvdmlkZWQgYnkgV2ViWFIgQVBJXG4gICAgICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gdXVpZCAtIElEIHN0cmluZyBhc3NvY2lhdGVkIHdpdGggYSBwZXJzaXN0ZW50IGFuY2hvclxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhbmNob3JzLCB4ckFuY2hvciwgdXVpZCA9IG51bGwpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9hbmNob3JzID0gYW5jaG9ycztcbiAgICAgICAgdGhpcy5feHJBbmNob3IgPSB4ckFuY2hvcjtcbiAgICAgICAgdGhpcy5fdXVpZCA9IHV1aWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSBhbiBhbmNob3IuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl94ckFuY2hvcikgcmV0dXJuO1xuICAgICAgICBjb25zdCB4ckFuY2hvciA9IHRoaXMuX3hyQW5jaG9yO1xuICAgICAgICB0aGlzLl94ckFuY2hvci5kZWxldGUoKTtcbiAgICAgICAgdGhpcy5feHJBbmNob3IgPSBudWxsO1xuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knLCB4ckFuY2hvciwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3hyQW5jaG9yKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hyQW5jaG9yLmFuY2hvclNwYWNlLCB0aGlzLl9hbmNob3JzLm1hbmFnZXIuX3JlZmVyZW5jZVNwYWNlKTtcbiAgICAgICAgaWYgKHBvc2UpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wb3NpdGlvbi5lcXVhbHMocG9zZS50cmFuc2Zvcm0ucG9zaXRpb24pICYmIHRoaXMuX3JvdGF0aW9uLmVxdWFscyhwb3NlLnRyYW5zZm9ybS5vcmllbnRhdGlvbikpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3JvdGF0aW9uLmNvcHkocG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb24pO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgYW4gYW5jaG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhbiBhbmNob3IuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGFuIGFuY2hvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgYW4gYW5jaG9yLlxuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgcHJvdmlkZXMgYSB3YXkgdG8gcGVyc2lzdCBhbmNob3IgYmV0d2VlbiBXZWJYUiBzZXNzaW9ucyBieVxuICAgICAqIHByb3ZpZGluZyBhIHVuaXF1ZSBVVUlEIG9mIGFuIGFuY2hvciwgdGhhdCBjYW4gYmUgdXNlZCBsYXRlciBmb3IgcmVzdG9yaW5nXG4gICAgICogYW4gYW5jaG9yIGZyb20gdW5kZXJseWluZyBzeXN0ZW0uXG4gICAgICogQmVhciBpbiBtaW5kIHRoYXQgdW5kZXJseWluZyBzeXN0ZW1zIG1pZ2h0IGhhdmUgYSBsaW1pdCBvbiBudW1iZXIgb2YgYW5jaG9yc1xuICAgICAqIGFsbG93ZWQgdG8gYmUgcGVyc2lzdGVkIHBlciBvcmlnaW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1hyQW5jaG9yUGVyc2lzdENhbGxiYWNrfSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgdG8gZmlyZSB3aGVuIGFuY2hvclxuICAgICAqIHBlcnNpc3RlbnQgVVVJRCBoYXMgYmVlbiBnZW5lcmF0ZWQgb3IgZXJyb3IgaWYgZmFpbGVkLlxuICAgICAqL1xuICAgIHBlcnNpc3QoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmNob3JzLnBlcnNpc3RlbmNlKSB7XG4gICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBFcnJvcignUGVyc2lzdGVudCBBbmNob3JzIGFyZSBub3Qgc3VwcG9ydGVkJyksIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3V1aWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwgdGhpcy5fdXVpZCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdXVpZFJlcXVlc3RzKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHRoaXMuX3V1aWRSZXF1ZXN0cy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3V1aWRSZXF1ZXN0cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3hyQW5jaG9yLnJlcXVlc3RQZXJzaXN0ZW50SGFuZGxlKClcbiAgICAgICAgICAgIC50aGVuKCh1dWlkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXVpZCA9IHV1aWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fYW5jaG9ycy5faW5kZXhCeVV1aWQuc2V0KHRoaXMuX3V1aWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwgdXVpZCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl91dWlkUmVxdWVzdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdXVpZFJlcXVlc3RzW2ldKG51bGwsIHV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl91dWlkUmVxdWVzdHMgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncGVyc2lzdCcsIHV1aWQpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKGV4LCBudWxsKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3V1aWRSZXF1ZXN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91dWlkUmVxdWVzdHNbaV0oZXgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl91dWlkUmVxdWVzdHMgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHBlcnNpc3RlbnQgVVVJRCBvZiBhbiBhbmNob3IgZnJvbSBhbiB1bmRlcmx5aW5nIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJBbmNob3JGb3JnZXRDYWxsYmFja30gW2NhbGxiYWNrXSAtIENhbGxiYWNrIHRvIGZpcmUgd2hlbiBhbmNob3IgaGFzIGJlZW5cbiAgICAgKiBmb3Jnb3R0ZW4gb3IgZXJyb3IgaWYgZmFpbGVkLlxuICAgICAqL1xuICAgIGZvcmdldChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3V1aWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IEVycm9yKCdBbmNob3IgaXMgbm90IHBlcnNpc3RlbnQnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hbmNob3JzLmZvcmdldCh0aGlzLl91dWlkLCAoZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3V1aWQgPSBudWxsO1xuICAgICAgICAgICAgY2FsbGJhY2s/LihleCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2ZvcmdldCcpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVVUlEIHN0cmluZyBvZiBhIHBlcnNpc3RlbnQgYW5jaG9yIG9yIG51bGwgaWYgbm90IHBlcnNpc3RlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudWxsfHN0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgdXVpZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3V1aWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBhbiBhbmNob3IgaXMgcGVyc2lzdGVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBwZXJzaXN0ZW50KCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl91dWlkO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJBbmNob3IgfTtcbiJdLCJuYW1lcyI6WyJYckFuY2hvciIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYW5jaG9ycyIsInhyQW5jaG9yIiwidXVpZCIsIl9wb3NpdGlvbiIsIlZlYzMiLCJfcm90YXRpb24iLCJRdWF0IiwiX3V1aWQiLCJfdXVpZFJlcXVlc3RzIiwiX2FuY2hvcnMiLCJfeHJBbmNob3IiLCJkZXN0cm95IiwiZGVsZXRlIiwiZmlyZSIsInVwZGF0ZSIsImZyYW1lIiwicG9zZSIsImdldFBvc2UiLCJhbmNob3JTcGFjZSIsIm1hbmFnZXIiLCJfcmVmZXJlbmNlU3BhY2UiLCJlcXVhbHMiLCJ0cmFuc2Zvcm0iLCJwb3NpdGlvbiIsIm9yaWVudGF0aW9uIiwiY29weSIsImdldFBvc2l0aW9uIiwiZ2V0Um90YXRpb24iLCJwZXJzaXN0IiwiY2FsbGJhY2siLCJwZXJzaXN0ZW5jZSIsIkVycm9yIiwicHVzaCIsInJlcXVlc3RQZXJzaXN0ZW50SGFuZGxlIiwidGhlbiIsIl9pbmRleEJ5VXVpZCIsInNldCIsImkiLCJsZW5ndGgiLCJjYXRjaCIsImV4IiwiZm9yZ2V0IiwicGVyc2lzdGVudCIsIkVWRU5UX0RFU1RST1kiLCJFVkVOVF9DSEFOR0UiLCJFVkVOVF9QRVJTSVNUIiwiRVZFTlRfRk9SR0VUIl0sIm1hcHBpbmdzIjoiOzs7O0FBS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsUUFBUSxTQUFTQyxZQUFZLENBQUM7QUEwRWhDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUVDLFFBQVEsRUFBRUMsSUFBSSxHQUFHLElBQUksRUFBRTtBQUN4QyxJQUFBLEtBQUssRUFBRSxDQUFBO0FBL0JYO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLFNBQVMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUV0QjtBQUNKO0FBQ0E7QUFDQTtB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
