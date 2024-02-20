import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * Detected Mesh instance that provides its transform (position, rotation),
 * triangles (vertices, indices) and its semantic label. Any of its properties can
 * change during its lifetime.
 *
 * @category XR
 */
class XrMesh extends EventHandler {
  /**
   * Create a new XrMesh instance.
   *
   * @param {import('./xr-mesh-detection.js').XrMeshDetection} meshDetection - Mesh Detection
   * interface.
   * @param {XRMesh} xrMesh - XRMesh that is instantiated by WebXR system.
   * @hideconstructor
   */
  constructor(meshDetection, xrMesh) {
    super();
    /**
     * @type {import('./xr-mesh-detection.js').XrMeshDetection}
     * @private
     */
    this._meshDetection = void 0;
    /**
     * @type {XRMesh}
     * @private
     */
    this._xrMesh = void 0;
    /**
     * @type {number}
     * @private
     */
    this._lastChanged = 0;
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
    this._meshDetection = meshDetection;
    this._xrMesh = xrMesh;
    this._lastChanged = this._xrMesh.lastChangedTime;
  }

  /**
   * @type {XRMesh}
   * @ignore
   */
  get xrMesh() {
    return this._xrMesh;
  }

  /**
   * Semantic Label of a mesh that is provided by underlying system.
   * Current list includes (but not limited to): https://github.com/immersive-web/semantic-labels/blob/master/labels.json
   *
   * @type {string}
   */
  get label() {
    return this._xrMesh.semanticLabel || '';
  }

  /**
   * Float 32 array of mesh vertices. This array contains 3 components per vertex: x,y,z coordinates.
   *
   * @type {Float32Array}
   */
  get vertices() {
    return this._xrMesh.vertices;
  }

  /**
   * Uint 32 array of mesh indices.
   *
   * @type {Uint32Array}
   */
  get indices() {
    return this._xrMesh.indices;
  }

  /** @ignore */
  destroy() {
    if (!this._xrMesh) return;
    this._xrMesh = null;
    this.fire('remove');
  }

  /**
   * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    const manager = this._meshDetection._manager;
    const pose = frame.getPose(this._xrMesh.meshSpace, manager._referenceSpace);
    if (pose) {
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
    }

    // attributes have been changed
    if (this._lastChanged !== this._xrMesh.lastChangedTime) {
      this._lastChanged = this._xrMesh.lastChangedTime;
      this.fire('change');
    }
  }

  /**
   * Get the world space position of a mesh.
   *
   * @returns {Vec3} The world space position of a mesh.
   */
  getPosition() {
    return this._position;
  }

  /**
   * Get the world space rotation of a mesh.
   *
   * @returns {Quat} The world space rotation of a mesh.
   */
  getRotation() {
    return this._rotation;
  }
}
/**
 * Fired when an {@link XrMesh} is removed.
 *
 * @event
 * @example
 * mesh.once('remove', () => {
 *     // mesh is no longer available
 * });
 */
XrMesh.EVENT_REMOVE = 'remove';
/**
 * Fired when {@link XrMesh} attributes such as vertices, indices and/or label have been
 * changed. Position and rotation can change at any time without triggering a `change` event.
 *
 * @event
 * @example
 * mesh.on('change', () => {
 *     // mesh attributes have been changed
 * });
 */
XrMesh.EVENT_CHANGE = 'change';

export { XrMesh };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tZXNoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gXCIuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanNcIjtcbmltcG9ydCB7IFZlYzMgfSBmcm9tIFwiLi4vLi4vY29yZS9tYXRoL3ZlYzMuanNcIjtcbmltcG9ydCB7IFF1YXQgfSBmcm9tIFwiLi4vLi4vY29yZS9tYXRoL3F1YXQuanNcIjtcblxuLyoqXG4gKiBEZXRlY3RlZCBNZXNoIGluc3RhbmNlIHRoYXQgcHJvdmlkZXMgaXRzIHRyYW5zZm9ybSAocG9zaXRpb24sIHJvdGF0aW9uKSxcbiAqIHRyaWFuZ2xlcyAodmVydGljZXMsIGluZGljZXMpIGFuZCBpdHMgc2VtYW50aWMgbGFiZWwuIEFueSBvZiBpdHMgcHJvcGVydGllcyBjYW5cbiAqIGNoYW5nZSBkdXJpbmcgaXRzIGxpZmV0aW1lLlxuICpcbiAqIEBjYXRlZ29yeSBYUlxuICovXG5jbGFzcyBYck1lc2ggZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4ge0BsaW5rIFhyTWVzaH0gaXMgcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogbWVzaC5vbmNlKCdyZW1vdmUnLCAoKSA9PiB7XG4gICAgICogICAgIC8vIG1lc2ggaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRU1PVkUgPSAncmVtb3ZlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhyTWVzaH0gYXR0cmlidXRlcyBzdWNoIGFzIHZlcnRpY2VzLCBpbmRpY2VzIGFuZC9vciBsYWJlbCBoYXZlIGJlZW5cbiAgICAgKiBjaGFuZ2VkLiBQb3NpdGlvbiBhbmQgcm90YXRpb24gY2FuIGNoYW5nZSBhdCBhbnkgdGltZSB3aXRob3V0IHRyaWdnZXJpbmcgYSBgY2hhbmdlYCBldmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogbWVzaC5vbignY2hhbmdlJywgKCkgPT4ge1xuICAgICAqICAgICAvLyBtZXNoIGF0dHJpYnV0ZXMgaGF2ZSBiZWVuIGNoYW5nZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ0hBTkdFID0gJ2NoYW5nZSc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1lc2gtZGV0ZWN0aW9uLmpzJykuWHJNZXNoRGV0ZWN0aW9ufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21lc2hEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJNZXNofVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3hyTWVzaDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGFzdENoYW5nZWQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyTWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1lc2gtZGV0ZWN0aW9uLmpzJykuWHJNZXNoRGV0ZWN0aW9ufSBtZXNoRGV0ZWN0aW9uIC0gTWVzaCBEZXRlY3Rpb25cbiAgICAgKiBpbnRlcmZhY2UuXG4gICAgICogQHBhcmFtIHtYUk1lc2h9IHhyTWVzaCAtIFhSTWVzaCB0aGF0IGlzIGluc3RhbnRpYXRlZCBieSBXZWJYUiBzeXN0ZW0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1lc2hEZXRlY3Rpb24sIHhyTWVzaCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX21lc2hEZXRlY3Rpb24gPSBtZXNoRGV0ZWN0aW9uO1xuICAgICAgICB0aGlzLl94ck1lc2ggPSB4ck1lc2g7XG4gICAgICAgIHRoaXMuX2xhc3RDaGFuZ2VkID0gdGhpcy5feHJNZXNoLmxhc3RDaGFuZ2VkVGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJNZXNofVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgeHJNZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJNZXNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlbWFudGljIExhYmVsIG9mIGEgbWVzaCB0aGF0IGlzIHByb3ZpZGVkIGJ5IHVuZGVybHlpbmcgc3lzdGVtLlxuICAgICAqIEN1cnJlbnQgbGlzdCBpbmNsdWRlcyAoYnV0IG5vdCBsaW1pdGVkIHRvKTogaHR0cHM6Ly9naXRodWIuY29tL2ltbWVyc2l2ZS13ZWIvc2VtYW50aWMtbGFiZWxzL2Jsb2IvbWFzdGVyL2xhYmVscy5qc29uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBsYWJlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hyTWVzaC5zZW1hbnRpY0xhYmVsIHx8ICcnO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsb2F0IDMyIGFycmF5IG9mIG1lc2ggdmVydGljZXMuIFRoaXMgYXJyYXkgY29udGFpbnMgMyBjb21wb25lbnRzIHBlciB2ZXJ0ZXg6IHgseSx6IGNvb3JkaW5hdGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgKi9cbiAgICBnZXQgdmVydGljZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94ck1lc2gudmVydGljZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVWludCAzMiBhcnJheSBvZiBtZXNoIGluZGljZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VWludDMyQXJyYXl9XG4gICAgICovXG4gICAgZ2V0IGluZGljZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94ck1lc2guaW5kaWNlcztcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICghdGhpcy5feHJNZXNoKSByZXR1cm47XG4gICAgICAgIHRoaXMuX3hyTWVzaCA9IG51bGw7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUkZyYW1lfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBjb25zdCBtYW5hZ2VyID0gdGhpcy5fbWVzaERldGVjdGlvbi5fbWFuYWdlcjtcbiAgICAgICAgY29uc3QgcG9zZSA9IGZyYW1lLmdldFBvc2UodGhpcy5feHJNZXNoLm1lc2hTcGFjZSwgbWFuYWdlci5fcmVmZXJlbmNlU3BhY2UpO1xuICAgICAgICBpZiAocG9zZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb24uY29weShwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9yb3RhdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMgaGF2ZSBiZWVuIGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuX2xhc3RDaGFuZ2VkICE9PSB0aGlzLl94ck1lc2gubGFzdENoYW5nZWRUaW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXN0Q2hhbmdlZCA9IHRoaXMuX3hyTWVzaC5sYXN0Q2hhbmdlZFRpbWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2NoYW5nZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhIG1lc2guXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGEgbWVzaC5cbiAgICAgKi9cbiAgICBnZXRQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgYSBtZXNoLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBhIG1lc2guXG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb3RhdGlvbjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyTWVzaCB9O1xuIl0sIm5hbWVzIjpbIlhyTWVzaCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWVzaERldGVjdGlvbiIsInhyTWVzaCIsIl9tZXNoRGV0ZWN0aW9uIiwiX3hyTWVzaCIsIl9sYXN0Q2hhbmdlZCIsIl9wb3NpdGlvbiIsIlZlYzMiLCJfcm90YXRpb24iLCJRdWF0IiwibGFzdENoYW5nZWRUaW1lIiwibGFiZWwiLCJzZW1hbnRpY0xhYmVsIiwidmVydGljZXMiLCJpbmRpY2VzIiwiZGVzdHJveSIsImZpcmUiLCJ1cGRhdGUiLCJmcmFtZSIsIm1hbmFnZXIiLCJfbWFuYWdlciIsInBvc2UiLCJnZXRQb3NlIiwibWVzaFNwYWNlIiwiX3JlZmVyZW5jZVNwYWNlIiwiY29weSIsInRyYW5zZm9ybSIsInBvc2l0aW9uIiwib3JpZW50YXRpb24iLCJnZXRQb3NpdGlvbiIsImdldFJvdGF0aW9uIiwiRVZFTlRfUkVNT1ZFIiwiRVZFTlRfQ0hBTkdFIl0sIm1hcHBpbmdzIjoiOzs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxNQUFNLFNBQVNDLFlBQVksQ0FBQztBQXNEOUI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxhQUFhLEVBQUVDLE1BQU0sRUFBRTtBQUMvQixJQUFBLEtBQUssRUFBRSxDQUFBO0FBdkNYO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVkO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLE9BQU8sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVQO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUVoQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFFdEI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsU0FBUyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0lBYWxCLElBQUksQ0FBQ04sY0FBYyxHQUFHRixhQUFhLENBQUE7SUFDbkMsSUFBSSxDQUFDRyxPQUFPLEdBQUdGLE1BQU0sQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ0csWUFBWSxHQUFHLElBQUksQ0FBQ0QsT0FBTyxDQUFDTSxlQUFlLENBQUE7QUFDcEQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtFQUNJLElBQUlSLE1BQU1BLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQ0UsT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSU8sS0FBS0EsR0FBRztBQUNSLElBQUEsT0FBTyxJQUFJLENBQUNQLE9BQU8sQ0FBQ1EsYUFBYSxJQUFJLEVBQUUsQ0FBQTtBQUMzQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJQyxRQUFRQSxHQUFHO0FBQ1gsSUFBQSxPQUFPLElBQUksQ0FBQ1QsT0FBTyxDQUFDUyxRQUFRLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsT0FBT0EsR0FBRztBQUNWLElBQUEsT0FBTyxJQUFJLENBQUNWLE9BQU8sQ0FBQ1UsT0FBTyxDQUFBO0FBQy9CLEdBQUE7O0FBRUE7QUFDQUMsRUFBQUEsT0FBT0EsR0FBRztBQUNOLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ1gsT0FBTyxFQUFFLE9BQUE7SUFDbkIsSUFBSSxDQUFDQSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ25CLElBQUEsSUFBSSxDQUFDWSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDdkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtFQUNJQyxNQUFNQSxDQUFDQyxLQUFLLEVBQUU7QUFDVixJQUFBLE1BQU1DLE9BQU8sR0FBRyxJQUFJLENBQUNoQixjQUFjLENBQUNpQixRQUFRLENBQUE7QUFDNUMsSUFBQSxNQUFNQyxJQUFJLEdBQUdILEtBQUssQ0FBQ0ksT0FBTyxDQUFDLElBQUksQ0FBQ2xCLE9BQU8sQ0FBQ21CLFNBQVMsRUFBRUosT0FBTyxDQUFDSyxlQUFlLENBQUMsQ0FBQTtBQUMzRSxJQUFBLElBQUlILElBQUksRUFBRTtNQUNOLElBQUksQ0FBQ2YsU0FBUyxDQUFDbUIsSUFBSSxDQUFDSixJQUFJLENBQUNLLFNBQVMsQ0FBQ0MsUUFBUSxDQUFDLENBQUE7TUFDNUMsSUFBSSxDQUFDbkIsU0FBUyxDQUFDaUIsSUFBSSxDQUFDSixJQUFJLENBQUNLLFNBQVMsQ0FBQ0UsV0FBVyxDQUFDLENBQUE7QUFDbkQsS0FBQTs7QUFFQTtJQUNBLElBQUksSUFBSSxDQUFDdkIsWUFBWSxLQUFLLElBQUksQ0FBQ0QsT0FBTyxDQUFDTSxlQUFlLEVBQUU7QUFDcEQsTUFBQSxJQUFJLENBQUNMLFlBQVksR0FBRyxJQUFJLENBQUNELE9BQU8sQ0FBQ00sZUFBZSxDQUFBO0FBQ2hELE1BQUEsSUFBSSxDQUFDTSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDdkIsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJYSxFQUFBQSxXQUFXQSxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUN2QixTQUFTLENBQUE7QUFDekIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0l3QixFQUFBQSxXQUFXQSxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUN0QixTQUFTLENBQUE7QUFDekIsR0FBQTtBQUNKLENBQUE7QUFwSkk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBVE1WLE1BQU0sQ0FVRGlDLFlBQVksR0FBRyxRQUFRLENBQUE7QUFFOUI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFyQk1qQyxNQUFNLENBc0JEa0MsWUFBWSxHQUFHLFFBQVE7Ozs7In0=
