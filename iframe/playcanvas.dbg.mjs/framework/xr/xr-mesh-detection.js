import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrMesh } from './xr-mesh.js';

/**
 * Mesh Detection provides the ability to detect real world meshes based on the
 * scanning and reconstruction by the underlying AR system.
 *
 * ```javascript
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
 *     meshDetection: true
 * });
 * ```
 *
 * ```javascript
 * app.xr.meshDetection.on('add', function (mesh) {
 *     // new mesh been added
 * });
 * ```
 *
 * @category XR
 */
class XrMeshDetection extends EventHandler {
  /**
   * Create a new XrMeshDetection instance.
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
    this._supported = platform.browser && !!window.XRMesh;
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * @type {Map<XRMesh, XrMesh>}
     * @private
     */
    this._index = new Map();
    /**
     * @type {XrMesh[]}
     * @private
     */
    this._list = [];
    this._manager = manager;
    if (this._supported) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }

  /**
   * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    if (!this._supported || !this._available) return;

    // add meshes
    for (const xrMesh of frame.detectedMeshes) {
      let mesh = this._index.get(xrMesh);
      if (!mesh) {
        mesh = new XrMesh(this, xrMesh);
        this._index.set(xrMesh, mesh);
        this._list.push(mesh);
        mesh.update(frame);
        this.fire('add', mesh);
      } else {
        mesh.update(frame);
      }
    }

    // remove meshes
    for (const mesh of this._index.values()) {
      if (frame.detectedMeshes.has(mesh.xrMesh)) continue;
      this._removeMesh(mesh);
    }
  }

  /**
   * @param {XrMesh} mesh - XrMesh to remove.
   * @private
   */
  _removeMesh(mesh) {
    this._index.delete(mesh.xrMesh);
    this._list.splice(this._list.indexOf(mesh), 1);
    mesh.destroy();
    this.fire('remove', mesh);
  }

  /** @private */
  _onSessionStart() {
    const available = this._manager.session.enabledFeatures.indexOf('mesh-detection') !== -1;
    if (!available) return;
    this._available = available;
    this.fire('available');
  }

  /** @private */
  _onSessionEnd() {
    if (!this._available) return;
    this._available = false;
    for (const mesh of this._index.values()) this._removeMesh(mesh);
    this.fire('unavailable');
  }

  /**
   * True if Mesh Detection is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if Mesh Detection is available. This information is available only when session has started.
   *
   * @type {boolean}
   */
  get available() {
    return this._available;
  }

  /**
   * Array of {@link XrMesh} instances that contain transform, vertices and label information.
   *
   * @type {XrMesh[]}
   */
  get meshes() {
    return this._list;
  }
}
/**
 * Fired when mesh detection becomes available.
 *
 * @event
 * @example
 * app.xr.meshDetection.on('available', () => {
 *     console.log('Mesh detection is available');
 * });
 */
XrMeshDetection.EVENT_AVAILABLE = 'available';
/**
 * Fired when mesh detection becomes unavailable.
 *
 * @event
 * @example
 * app.xr.meshDetection.on('unavailable', () => {
 *     console.log('Mesh detection is unavailable');
 * });
 */
XrMeshDetection.EVENT_UNAVAILABLE = 'unavailable';
/**
 * Fired when new {@link XrMesh} is added to the list. The handler is passed the {@link XrMesh}
 * instance that has been added.
 *
 * @event
 * @example
 * app.xr.meshDetection.on('add', (mesh) => {
 *     // a new XrMesh has been added
 * });
 */
XrMeshDetection.EVENT_ADD = 'add';
/**
 * Fired when a {@link XrMesh} is removed from the list. The handler is passed the
 * {@link XrMesh} instance that has been removed.
 *
 * @event
 * @example
 * app.xr.meshDetection.on('remove', (mesh) => {
 *     // XrMesh has been removed
 * });
 */
XrMeshDetection.EVENT_REMOVE = 'remove';

export { XrMeshDetection };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWVzaC1kZXRlY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItbWVzaC1kZXRlY3Rpb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tIFwiLi4vLi4vY29yZS9wbGF0Zm9ybS5qc1wiO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSBcIi4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qc1wiO1xuaW1wb3J0IHsgWHJNZXNoIH0gZnJvbSBcIi4veHItbWVzaC5qc1wiO1xuXG4vKipcbiAqIE1lc2ggRGV0ZWN0aW9uIHByb3ZpZGVzIHRoZSBhYmlsaXR5IHRvIGRldGVjdCByZWFsIHdvcmxkIG1lc2hlcyBiYXNlZCBvbiB0aGVcbiAqIHNjYW5uaW5nIGFuZCByZWNvbnN0cnVjdGlvbiBieSB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gc3RhcnQgc2Vzc2lvbiB3aXRoIHBsYW5lIGRldGVjdGlvbiBlbmFibGVkXG4gKiBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfQVIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUiwge1xuICogICAgIG1lc2hEZXRlY3Rpb246IHRydWVcbiAqIH0pO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogYXBwLnhyLm1lc2hEZXRlY3Rpb24ub24oJ2FkZCcsIGZ1bmN0aW9uIChtZXNoKSB7XG4gKiAgICAgLy8gbmV3IG1lc2ggYmVlbiBhZGRlZFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAY2F0ZWdvcnkgWFJcbiAqL1xuY2xhc3MgWHJNZXNoRGV0ZWN0aW9uIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIG1lc2ggZGV0ZWN0aW9uIGJlY29tZXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIubWVzaERldGVjdGlvbi5vbignYXZhaWxhYmxlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnTWVzaCBkZXRlY3Rpb24gaXMgYXZhaWxhYmxlJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FWQUlMQUJMRSA9ICdhdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBtZXNoIGRldGVjdGlvbiBiZWNvbWVzIHVuYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIubWVzaERldGVjdGlvbi5vbigndW5hdmFpbGFibGUnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdNZXNoIGRldGVjdGlvbiBpcyB1bmF2YWlsYWJsZScpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9VTkFWQUlMQUJMRSA9ICd1bmF2YWlsYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIG5ldyB7QGxpbmsgWHJNZXNofSBpcyBhZGRlZCB0byB0aGUgbGlzdC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSB7QGxpbmsgWHJNZXNofVxuICAgICAqIGluc3RhbmNlIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5tZXNoRGV0ZWN0aW9uLm9uKCdhZGQnLCAobWVzaCkgPT4ge1xuICAgICAqICAgICAvLyBhIG5ldyBYck1lc2ggaGFzIGJlZW4gYWRkZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQUREID0gJ2FkZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEge0BsaW5rIFhyTWVzaH0gaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFhyTWVzaH0gaW5zdGFuY2UgdGhhdCBoYXMgYmVlbiByZW1vdmVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIubWVzaERldGVjdGlvbi5vbigncmVtb3ZlJywgKG1lc2gpID0+IHtcbiAgICAgKiAgICAgLy8gWHJNZXNoIGhhcyBiZWVuIHJlbW92ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N1cHBvcnRlZCA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuWFJNZXNoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWFwPFhSTWVzaCwgWHJNZXNoPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbmRleCA9IG5ldyBNYXAoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYck1lc2hbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9saXN0ID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJNZXNoRGV0ZWN0aW9uIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICBpZiAodGhpcy5fc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdzdGFydCcsIHRoaXMuX29uU2Vzc2lvblN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ2VuZCcsIHRoaXMuX29uU2Vzc2lvbkVuZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSRnJhbWV9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5fc3VwcG9ydGVkIHx8ICF0aGlzLl9hdmFpbGFibGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gYWRkIG1lc2hlc1xuICAgICAgICBmb3IgKGNvbnN0IHhyTWVzaCBvZiBmcmFtZS5kZXRlY3RlZE1lc2hlcykge1xuICAgICAgICAgICAgbGV0IG1lc2ggPSB0aGlzLl9pbmRleC5nZXQoeHJNZXNoKTtcbiAgICAgICAgICAgIGlmICghbWVzaCkge1xuICAgICAgICAgICAgICAgIG1lc2ggPSBuZXcgWHJNZXNoKHRoaXMsIHhyTWVzaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5kZXguc2V0KHhyTWVzaCwgbWVzaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGlzdC5wdXNoKG1lc2gpO1xuICAgICAgICAgICAgICAgIG1lc2gudXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIG1lc2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgbWVzaGVzXG4gICAgICAgIGZvciAoY29uc3QgbWVzaCBvZiB0aGlzLl9pbmRleC52YWx1ZXMoKSkge1xuICAgICAgICAgICAgaWYgKGZyYW1lLmRldGVjdGVkTWVzaGVzLmhhcyhtZXNoLnhyTWVzaCkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1lc2gobWVzaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hyTWVzaH0gbWVzaCAtIFhyTWVzaCB0byByZW1vdmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVtb3ZlTWVzaChtZXNoKSB7XG4gICAgICAgIHRoaXMuX2luZGV4LmRlbGV0ZShtZXNoLnhyTWVzaCk7XG4gICAgICAgIHRoaXMuX2xpc3Quc3BsaWNlKHRoaXMuX2xpc3QuaW5kZXhPZihtZXNoKSwgMSk7XG4gICAgICAgIG1lc2guZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIG1lc2gpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25TdGFydCgpIHtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gdGhpcy5fbWFuYWdlci5zZXNzaW9uLmVuYWJsZWRGZWF0dXJlcy5pbmRleE9mKCdtZXNoLWRldGVjdGlvbicpICE9PSAtMTtcbiAgICAgICAgaWYgKCFhdmFpbGFibGUpIHJldHVybjtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gYXZhaWxhYmxlO1xuICAgICAgICB0aGlzLmZpcmUoJ2F2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25FbmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXZhaWxhYmxlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgICAgIGZvciAoY29uc3QgbWVzaCBvZiB0aGlzLl9pbmRleC52YWx1ZXMoKSlcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1lc2gobWVzaCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCd1bmF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgTWVzaCBEZXRlY3Rpb24gaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIE1lc2ggRGV0ZWN0aW9uIGlzIGF2YWlsYWJsZS4gVGhpcyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUgb25seSB3aGVuIHNlc3Npb24gaGFzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIHtAbGluayBYck1lc2h9IGluc3RhbmNlcyB0aGF0IGNvbnRhaW4gdHJhbnNmb3JtLCB2ZXJ0aWNlcyBhbmQgbGFiZWwgaW5mb3JtYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJNZXNoW119XG4gICAgICovXG4gICAgZ2V0IG1lc2hlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpc3Q7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYck1lc2hEZXRlY3Rpb24gfTtcbiJdLCJuYW1lcyI6WyJYck1lc2hEZXRlY3Rpb24iLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJfbWFuYWdlciIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJYUk1lc2giLCJfYXZhaWxhYmxlIiwiX2luZGV4IiwiTWFwIiwiX2xpc3QiLCJvbiIsIl9vblNlc3Npb25TdGFydCIsIl9vblNlc3Npb25FbmQiLCJ1cGRhdGUiLCJmcmFtZSIsInhyTWVzaCIsImRldGVjdGVkTWVzaGVzIiwibWVzaCIsImdldCIsIlhyTWVzaCIsInNldCIsInB1c2giLCJmaXJlIiwidmFsdWVzIiwiaGFzIiwiX3JlbW92ZU1lc2giLCJkZWxldGUiLCJzcGxpY2UiLCJpbmRleE9mIiwiZGVzdHJveSIsImF2YWlsYWJsZSIsInNlc3Npb24iLCJlbmFibGVkRmVhdHVyZXMiLCJzdXBwb3J0ZWQiLCJtZXNoZXMiLCJFVkVOVF9BVkFJTEFCTEUiLCJFVkVOVF9VTkFWQUlMQUJMRSIsIkVWRU5UX0FERCIsIkVWRU5UX1JFTU9WRSJdLCJtYXBwaW5ncyI6Ijs7OztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxTQUFTQyxZQUFZLENBQUM7QUE2RXZDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUU7QUFDakIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQXJDWDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFVBQVUsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxDQUFDQyxNQUFNLENBQUNDLE1BQU0sQ0FBQTtBQUVoRDtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFFbEI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsTUFBTSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBRWxCO0FBQ0o7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