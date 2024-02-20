import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * The tracked image interface that is created by the Image Tracking system and is provided as a
 * list from {@link XrImageTracking#images}. It contains information about the tracking state as
 * well as the position and rotation of the tracked image.
 *
 * @augments EventHandler
 * @category XR
 */
class XrTrackedImage extends EventHandler {
  /**
   * The tracked image interface that is created by the Image Tracking system and is provided as
   * a list from {@link XrImageTracking#images}. It contains information about the tracking state
   * as well as the position and rotation of the tracked image.
   *
   * @param {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap} image - Image
   * that is matching the real world image as closely as possible. Resolution of images should be
   * at least 300x300. High resolution does NOT improve tracking performance. Color of image is
   * irrelevant, so grayscale images can be used. Images with too many geometric features or
   * repeating patterns will reduce tracking stability.
   * @param {number} width - Width (in meters) of image in real world. Providing this value as
   * close to the real value will improve tracking quality.
   * @hideconstructor
   */
  constructor(image, width) {
    super();
    /**
     * @type {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap}
     * @private
     */
    this._image = void 0;
    /**
     * @type {number}
     * @private
     */
    this._width = void 0;
    /**
     * @type {ImageBitmap|null}
     * @private
     */
    this._bitmap = null;
    /**
     * @type {number}
     * @ignore
     */
    this._measuredWidth = 0;
    /**
     * @type {boolean}
     * @private
     */
    this._trackable = false;
    /**
     * @type {boolean}
     * @private
     */
    this._tracking = false;
    /**
     * @type {boolean}
     * @private
     */
    this._emulated = false;
    /**
     * @type {*}
     * @ignore
     */
    this._pose = null;
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
    this._image = image;
    this._width = width;
  }

  /**
   * Image that is used for tracking.
   *
   * @type {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap}
   */
  get image() {
    return this._image;
  }

  /**
   * Width that is provided to assist tracking performance. This property can be updated only
   * when the AR session is not running.
   *
   * @type {number}
   */
  set width(value) {
    this._width = value;
  }
  get width() {
    return this._width;
  }

  /**
   * True if image is trackable. A too small resolution or invalid images can be untrackable by
   * the underlying AR system.
   *
   * @type {boolean}
   */
  get trackable() {
    return this._trackable;
  }

  /**
   * True if image is in tracking state and being tracked in real world by the underlying AR
   * system.
   *
   * @type {boolean}
   */
  get tracking() {
    return this._tracking;
  }

  /**
   * True if image was recently tracked but currently is not actively tracked due to inability of
   * identifying the image by the underlying AR system. Position and rotation will be based on
   * the previously known transformation assuming the tracked image has not moved.
   *
   * @type {boolean}
   */
  get emulated() {
    return this._emulated;
  }

  /**
   * @returns {Promise<ImageBitmap>} Promise that resolves to an image bitmap.
   * @ignore
   */
  prepare() {
    if (this._bitmap) {
      return {
        image: this._bitmap,
        widthInMeters: this._width
      };
    }
    return createImageBitmap(this._image).then(bitmap => {
      this._bitmap = bitmap;
      return {
        image: this._bitmap,
        widthInMeters: this._width
      };
    });
  }

  /**
   * Destroys the tracked image.
   *
   * @ignore
   */
  destroy() {
    this._image = null;
    this._pose = null;
    if (this._bitmap) {
      this._bitmap.close();
      this._bitmap = null;
    }
  }

  /**
   * Get the world position of the tracked image.
   *
   * @returns {Vec3} Position in world space.
   * @example
   * // update entity position to match tracked image position
   * entity.setPosition(trackedImage.getPosition());
   */
  getPosition() {
    if (this._pose) this._position.copy(this._pose.transform.position);
    return this._position;
  }

  /**
   * Get the world rotation of the tracked image.
   *
   * @returns {Quat} Rotation in world space.
   * @example
   * // update entity rotation to match tracked image rotation
   * entity.setRotation(trackedImage.getRotation());
   */
  getRotation() {
    if (this._pose) this._rotation.copy(this._pose.transform.orientation);
    return this._rotation;
  }
}
/**
 * Fired when image becomes actively tracked.
 *
 * @event
 * @example
 * trackedImage.on('tracked', () => {
 *     console.log('Image is now tracked');
 * });
 */
XrTrackedImage.EVENT_TRACKED = 'tracked';
/**
 * Fired when image is no longer actively tracked.
 *
 * @event
 * @example
 * trackedImage.on('untracked', () => {
 *     console.log('Image is no longer tracked');
 * });
 */
XrTrackedImage.EVENT_UNTRACKED = 'untracked';

export { XrTrackedImage };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItdHJhY2tlZC1pbWFnZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci10cmFja2VkLWltYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcblxuLyoqXG4gKiBUaGUgdHJhY2tlZCBpbWFnZSBpbnRlcmZhY2UgdGhhdCBpcyBjcmVhdGVkIGJ5IHRoZSBJbWFnZSBUcmFja2luZyBzeXN0ZW0gYW5kIGlzIHByb3ZpZGVkIGFzIGFcbiAqIGxpc3QgZnJvbSB7QGxpbmsgWHJJbWFnZVRyYWNraW5nI2ltYWdlc30uIEl0IGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSB0cmFja2luZyBzdGF0ZSBhc1xuICogd2VsbCBhcyB0aGUgcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIHRoZSB0cmFja2VkIGltYWdlLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqIEBjYXRlZ29yeSBYUlxuICovXG5jbGFzcyBYclRyYWNrZWRJbWFnZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbWFnZSBiZWNvbWVzIGFjdGl2ZWx5IHRyYWNrZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRyYWNrZWRJbWFnZS5vbigndHJhY2tlZCcsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0ltYWdlIGlzIG5vdyB0cmFja2VkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1RSQUNLRUQgPSAndHJhY2tlZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGltYWdlIGlzIG5vIGxvbmdlciBhY3RpdmVseSB0cmFja2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0cmFja2VkSW1hZ2Uub24oJ3VudHJhY2tlZCcsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0ltYWdlIGlzIG5vIGxvbmdlciB0cmFja2VkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1VOVFJBQ0tFRCA9ICd1bnRyYWNrZWQnO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0hUTUxDYW52YXNFbGVtZW50fEhUTUxJbWFnZUVsZW1lbnR8U1ZHSW1hZ2VFbGVtZW50fEhUTUxWaWRlb0VsZW1lbnR8QmxvYnxJbWFnZURhdGF8SW1hZ2VCaXRtYXB9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1hZ2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dpZHRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0ltYWdlQml0bWFwfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYml0bWFwID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9tZWFzdXJlZFdpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RyYWNrYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdHJhY2tpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VtdWxhdGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Kn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3Bvc2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRyYWNrZWQgaW1hZ2UgaW50ZXJmYWNlIHRoYXQgaXMgY3JlYXRlZCBieSB0aGUgSW1hZ2UgVHJhY2tpbmcgc3lzdGVtIGFuZCBpcyBwcm92aWRlZCBhc1xuICAgICAqIGEgbGlzdCBmcm9tIHtAbGluayBYckltYWdlVHJhY2tpbmcjaW1hZ2VzfS4gSXQgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHRyYWNraW5nIHN0YXRlXG4gICAgICogYXMgd2VsbCBhcyB0aGUgcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIHRoZSB0cmFja2VkIGltYWdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fFNWR0ltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEJsb2J8SW1hZ2VEYXRhfEltYWdlQml0bWFwfSBpbWFnZSAtIEltYWdlXG4gICAgICogdGhhdCBpcyBtYXRjaGluZyB0aGUgcmVhbCB3b3JsZCBpbWFnZSBhcyBjbG9zZWx5IGFzIHBvc3NpYmxlLiBSZXNvbHV0aW9uIG9mIGltYWdlcyBzaG91bGQgYmVcbiAgICAgKiBhdCBsZWFzdCAzMDB4MzAwLiBIaWdoIHJlc29sdXRpb24gZG9lcyBOT1QgaW1wcm92ZSB0cmFja2luZyBwZXJmb3JtYW5jZS4gQ29sb3Igb2YgaW1hZ2UgaXNcbiAgICAgKiBpcnJlbGV2YW50LCBzbyBncmF5c2NhbGUgaW1hZ2VzIGNhbiBiZSB1c2VkLiBJbWFnZXMgd2l0aCB0b28gbWFueSBnZW9tZXRyaWMgZmVhdHVyZXMgb3JcbiAgICAgKiByZXBlYXRpbmcgcGF0dGVybnMgd2lsbCByZWR1Y2UgdHJhY2tpbmcgc3RhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFdpZHRoIChpbiBtZXRlcnMpIG9mIGltYWdlIGluIHJlYWwgd29ybGQuIFByb3ZpZGluZyB0aGlzIHZhbHVlIGFzXG4gICAgICogY2xvc2UgdG8gdGhlIHJlYWwgdmFsdWUgd2lsbCBpbXByb3ZlIHRyYWNraW5nIHF1YWxpdHkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGltYWdlLCB3aWR0aCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2ltYWdlID0gaW1hZ2U7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1hZ2UgdGhhdCBpcyB1c2VkIGZvciB0cmFja2luZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fFNWR0ltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEJsb2J8SW1hZ2VEYXRhfEltYWdlQml0bWFwfVxuICAgICAqL1xuICAgIGdldCBpbWFnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIHRoYXQgaXMgcHJvdmlkZWQgdG8gYXNzaXN0IHRyYWNraW5nIHBlcmZvcm1hbmNlLiBUaGlzIHByb3BlcnR5IGNhbiBiZSB1cGRhdGVkIG9ubHlcbiAgICAgKiB3aGVuIHRoZSBBUiBzZXNzaW9uIGlzIG5vdCBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGltYWdlIGlzIHRyYWNrYWJsZS4gQSB0b28gc21hbGwgcmVzb2x1dGlvbiBvciBpbnZhbGlkIGltYWdlcyBjYW4gYmUgdW50cmFja2FibGUgYnlcbiAgICAgKiB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdHJhY2thYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHJhY2thYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW1hZ2UgaXMgaW4gdHJhY2tpbmcgc3RhdGUgYW5kIGJlaW5nIHRyYWNrZWQgaW4gcmVhbCB3b3JsZCBieSB0aGUgdW5kZXJseWluZyBBUlxuICAgICAqIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0cmFja2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RyYWNraW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW1hZ2Ugd2FzIHJlY2VudGx5IHRyYWNrZWQgYnV0IGN1cnJlbnRseSBpcyBub3QgYWN0aXZlbHkgdHJhY2tlZCBkdWUgdG8gaW5hYmlsaXR5IG9mXG4gICAgICogaWRlbnRpZnlpbmcgdGhlIGltYWdlIGJ5IHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS4gUG9zaXRpb24gYW5kIHJvdGF0aW9uIHdpbGwgYmUgYmFzZWQgb25cbiAgICAgKiB0aGUgcHJldmlvdXNseSBrbm93biB0cmFuc2Zvcm1hdGlvbiBhc3N1bWluZyB0aGUgdHJhY2tlZCBpbWFnZSBoYXMgbm90IG1vdmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGVtdWxhdGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW11bGF0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8SW1hZ2VCaXRtYXA+fSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gaW1hZ2UgYml0bWFwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBwcmVwYXJlKCkge1xuICAgICAgICBpZiAodGhpcy5fYml0bWFwKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGltYWdlOiB0aGlzLl9iaXRtYXAsXG4gICAgICAgICAgICAgICAgd2lkdGhJbk1ldGVyczogdGhpcy5fd2lkdGhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3JlYXRlSW1hZ2VCaXRtYXAodGhpcy5faW1hZ2UpXG4gICAgICAgICAgICAudGhlbigoYml0bWFwKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYml0bWFwID0gYml0bWFwO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGltYWdlOiB0aGlzLl9iaXRtYXAsXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoSW5NZXRlcnM6IHRoaXMuX3dpZHRoXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSB0cmFja2VkIGltYWdlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcG9zZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JpdG1hcCkge1xuICAgICAgICAgICAgdGhpcy5fYml0bWFwLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLl9iaXRtYXAgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBwb3NpdGlvbiBvZiB0aGUgdHJhY2tlZCBpbWFnZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBQb3NpdGlvbiBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHVwZGF0ZSBlbnRpdHkgcG9zaXRpb24gdG8gbWF0Y2ggdHJhY2tlZCBpbWFnZSBwb3NpdGlvblxuICAgICAqIGVudGl0eS5zZXRQb3NpdGlvbih0cmFja2VkSW1hZ2UuZ2V0UG9zaXRpb24oKSk7XG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9wb3NlKSB0aGlzLl9wb3NpdGlvbi5jb3B5KHRoaXMuX3Bvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgcm90YXRpb24gb2YgdGhlIHRyYWNrZWQgaW1hZ2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gUm90YXRpb24gaW4gd29ybGQgc3BhY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyB1cGRhdGUgZW50aXR5IHJvdGF0aW9uIHRvIG1hdGNoIHRyYWNrZWQgaW1hZ2Ugcm90YXRpb25cbiAgICAgKiBlbnRpdHkuc2V0Um90YXRpb24odHJhY2tlZEltYWdlLmdldFJvdGF0aW9uKCkpO1xuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fcG9zZSkgdGhpcy5fcm90YXRpb24uY29weSh0aGlzLl9wb3NlLnRyYW5zZm9ybS5vcmllbnRhdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb3RhdGlvbjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyVHJhY2tlZEltYWdlIH07XG4iXSwibmFtZXMiOlsiWHJUcmFja2VkSW1hZ2UiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImltYWdlIiwid2lkdGgiLCJfaW1hZ2UiLCJfd2lkdGgiLCJfYml0bWFwIiwiX21lYXN1cmVkV2lkdGgiLCJfdHJhY2thYmxlIiwiX3RyYWNraW5nIiwiX2VtdWxhdGVkIiwiX3Bvc2UiLCJfcG9zaXRpb24iLCJWZWMzIiwiX3JvdGF0aW9uIiwiUXVhdCIsInZhbHVlIiwidHJhY2thYmxlIiwidHJhY2tpbmciLCJlbXVsYXRlZCIsInByZXBhcmUiLCJ3aWR0aEluTWV0ZXJzIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJ0aGVuIiwiYml0bWFwIiwiZGVzdHJveSIsImNsb3NlIiwiZ2V0UG9zaXRpb24iLCJjb3B5IiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJnZXRSb3RhdGlvbiIsIm9yaWVudGF0aW9uIiwiRVZFTlRfVFJBQ0tFRCIsIkVWRU5UX1VOVFJBQ0tFRCJdLCJtYXBwaW5ncyI6Ijs7OztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLFNBQVNDLFlBQVksQ0FBQztBQW1GdEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxLQUFLLEVBQUVDLEtBQUssRUFBRTtBQUN0QixJQUFBLEtBQUssRUFBRSxDQUFBO0FBM0VYO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsT0FBTyxHQUFHLElBQUksQ0FBQTtBQUVkO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsY0FBYyxHQUFHLENBQUMsQ0FBQTtBQUVsQjtBQUNK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
