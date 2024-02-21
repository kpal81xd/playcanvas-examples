import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Ray } from '../../core/shape/ray.js';
import { XrHand } from './xr-hand.js';
import { now } from '../../core/time.js';

const vec3A = new Vec3();
const quat = new Quat();
let ids = 0;

/**
 * Represents XR input source, which is any input mechanism which allows the user to perform
 * targeted actions in the same virtual space as the viewer. Example XR input sources include, but
 * are not limited to: handheld controllers, optically tracked hands, touch screen taps, and
 * gaze-based input methods that operate on the viewer's pose.
 *
 * @augments EventHandler
 * @category XR
 */
class XrInputSource extends EventHandler {
  /**
   * Create a new XrInputSource instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @param {*} xrInputSource - [XRInputSource](https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource)
   * object that is created by WebXR API.
   * @hideconstructor
   */
  constructor(manager, xrInputSource) {
    super();
    /**
     * @type {number}
     * @private
     */
    this._id = void 0;
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {XRInputSource}
     * @private
     */
    this._xrInputSource = void 0;
    /**
     * @type {Ray}
     * @private
     */
    this._ray = new Ray();
    /**
     * @type {Ray}
     * @private
     */
    this._rayLocal = new Ray();
    /**
     * @type {boolean}
     * @private
     */
    this._grip = false;
    /**
     * @type {XrHand|null}
     * @private
     */
    this._hand = null;
    /**
     * @type {boolean}
     * @private
     */
    this._velocitiesAvailable = false;
    /**
     * @type {number}
     * @private
     */
    this._velocitiesTimestamp = now();
    /**
     * @type {Mat4|null}
     * @private
     */
    this._localTransform = null;
    /**
     * @type {Mat4|null}
     * @private
     */
    this._worldTransform = null;
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
     * @type {Vec3|null}
     * @private
     */
    this._localPosition = null;
    /**
     * @type {Vec3|null}
     * @private
     */
    this._localPositionLast = null;
    /**
     * @type {Quat|null}
     * @private
     */
    this._localRotation = null;
    /**
     * @type {Vec3|null}
     * @private
     */
    this._linearVelocity = null;
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyLocal = true;
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyRay = false;
    /**
     * @type {boolean}
     * @private
     */
    this._selecting = false;
    /**
     * @type {boolean}
     * @private
     */
    this._squeezing = false;
    /**
     * @type {boolean}
     * @private
     */
    this._elementInput = true;
    /**
     * @type {import('../entity.js').Entity|null}
     * @private
     */
    this._elementEntity = null;
    /**
     * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
     * @private
     */
    this._hitTestSources = [];
    this._id = ++ids;
    this._manager = manager;
    this._xrInputSource = xrInputSource;
    if (xrInputSource.hand) this._hand = new XrHand(this);
  }

  /**
   * Unique number associated with instance of input source. Same physical devices when
   * reconnected will not share this ID.
   *
   * @type {number}
   */
  get id() {
    return this._id;
  }

  /**
   * XRInputSource object that is associated with this input source.
   *
   * @type {object}
   */
  get inputSource() {
    return this._xrInputSource;
  }

  /**
   * Type of ray Input Device is based on. Can be one of the following:
   *
   * - {@link XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and
   * follow the direction it is facing. This is commonly referred to as a "gaze input" device in
   * the context of head-mounted displays.
   * - {@link XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction
   * with the canvas element associated with an inline session's output context, such as a mouse
   * click or touch event.
   * - {@link XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates
   * from either a handheld device or other hand-tracking mechanism and represents that the user
   * is using their hands or the held device for pointing.
   *
   * @type {string}
   */
  get targetRayMode() {
    return this._xrInputSource.targetRayMode;
  }

  /**
   * Describes which hand input source is associated with. Can be one of the following:
   *
   * - {@link XRHAND_NONE}: None - input source is not meant to be held in hands.
   * - {@link XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
   * - {@link XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right
   * hand.
   *
   * @type {string}
   */
  get handedness() {
    return this._xrInputSource.handedness;
  }

  /**
   * List of input profile names indicating both the preferred visual representation and behavior
   * of the input source.
   *
   * @type {string[]}
   */
  get profiles() {
    return this._xrInputSource.profiles;
  }

  /**
   * If input source can be held, then it will have node with its world transformation, that can
   * be used to position and rotate visual object based on it.
   *
   * @type {boolean}
   */
  get grip() {
    return this._grip;
  }

  /**
   * If input source is a tracked hand, then it will point to {@link XrHand} otherwise it is
   * null.
   *
   * @type {XrHand|null}
   */
  get hand() {
    return this._hand;
  }

  /**
   * If input source has buttons, triggers, thumbstick or touchpad, then this object provides
   * access to its states.
   *
   * @type {Gamepad|null}
   */
  get gamepad() {
    return this._xrInputSource.gamepad || null;
  }

  /**
   * True if input source is in active primary action between selectstart and selectend events.
   *
   * @type {boolean}
   */
  get selecting() {
    return this._selecting;
  }

  /**
   * True if input source is in active squeeze action between squeezestart and squeezeend events.
   *
   * @type {boolean}
   */
  get squeezing() {
    return this._squeezing;
  }

  /**
   * Set to true to allow input source to interact with Element components. Defaults to true.
   *
   * @type {boolean}
   */
  set elementInput(value) {
    if (this._elementInput === value) return;
    this._elementInput = value;
    if (!this._elementInput) this._elementEntity = null;
  }
  get elementInput() {
    return this._elementInput;
  }

  /**
   * If {@link XrInputSource#elementInput} is true, this property will hold entity with Element
   * component at which this input source is hovering, or null if not hovering over any element.
   *
   * @type {import('../entity.js').Entity|null}
   */
  get elementEntity() {
    return this._elementEntity;
  }

  /**
   * List of active {@link XrHitTestSource} instances associated with this input source.
   *
   * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
   */
  get hitTestSources() {
    return this._hitTestSources;
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    // hand
    if (this._hand) {
      this._hand.update(frame);
    } else {
      // grip
      const gripSpace = this._xrInputSource.gripSpace;
      if (gripSpace) {
        const gripPose = frame.getPose(gripSpace, this._manager._referenceSpace);
        if (gripPose) {
          if (!this._grip) {
            this._grip = true;
            this._localTransform = new Mat4();
            this._worldTransform = new Mat4();
            this._localPositionLast = new Vec3();
            this._localPosition = new Vec3();
            this._localRotation = new Quat();
            this._linearVelocity = new Vec3();
          }
          const timestamp = now();
          const dt = (timestamp - this._velocitiesTimestamp) / 1000;
          this._velocitiesTimestamp = timestamp;
          this._dirtyLocal = true;
          this._localPositionLast.copy(this._localPosition);
          this._localPosition.copy(gripPose.transform.position);
          this._localRotation.copy(gripPose.transform.orientation);
          this._velocitiesAvailable = true;
          if (this._manager.input.velocitiesSupported && gripPose.linearVelocity) {
            this._linearVelocity.copy(gripPose.linearVelocity);
          } else if (dt > 0) {
            vec3A.sub2(this._localPosition, this._localPositionLast).divScalar(dt);
            this._linearVelocity.lerp(this._linearVelocity, vec3A, 0.15);
          }
        } else {
          this._velocitiesAvailable = false;
        }
      }

      // ray
      const targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
      if (targetRayPose) {
        this._dirtyRay = true;
        this._rayLocal.origin.copy(targetRayPose.transform.position);
        this._rayLocal.direction.set(0, 0, -1);
        quat.copy(targetRayPose.transform.orientation);
        quat.transformVector(this._rayLocal.direction, this._rayLocal.direction);
      }
    }
  }

  /** @private */
  _updateTransforms() {
    if (this._dirtyLocal) {
      this._dirtyLocal = false;
      this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }
    const parent = this._manager.camera.parent;
    if (parent) {
      this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
      this._worldTransform.copy(this._localTransform);
    }
  }

  /** @private */
  _updateRayTransforms() {
    const dirty = this._dirtyRay;
    this._dirtyRay = false;
    const parent = this._manager.camera.parent;
    if (parent) {
      const parentTransform = this._manager.camera.parent.getWorldTransform();
      parentTransform.getTranslation(this._position);
      this._rotation.setFromMat4(parentTransform);
      this._rotation.transformVector(this._rayLocal.origin, this._ray.origin);
      this._ray.origin.add(this._position);
      this._rotation.transformVector(this._rayLocal.direction, this._ray.direction);
    } else if (dirty) {
      this._ray.origin.copy(this._rayLocal.origin);
      this._ray.direction.copy(this._rayLocal.direction);
    }
  }

  /**
   * Get the world space position of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space position of handheld input source.
   */
  getPosition() {
    if (!this._position) return null;
    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);
    return this._position;
  }

  /**
   * Get the local space position of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space position of handheld input source.
   */
  getLocalPosition() {
    return this._localPosition;
  }

  /**
   * Get the world space rotation of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Otherwise it will return null.
   *
   * @returns {Quat|null} The world space rotation of handheld input source.
   */
  getRotation() {
    if (!this._rotation) return null;
    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);
    return this._rotation;
  }

  /**
   * Get the local space rotation of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
   *
   * @returns {Quat|null} The world space rotation of handheld input source.
   */
  getLocalRotation() {
    return this._localRotation;
  }

  /**
   * Get the linear velocity (units per second) of the input source if it is handheld
   * ({@link XrInputSource#grip} is true). Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space linear velocity of the handheld input source.
   */
  getLinearVelocity() {
    if (!this._velocitiesAvailable) return null;
    return this._linearVelocity;
  }

  /**
   * Get the world space origin of input source ray.
   *
   * @returns {Vec3} The world space origin of input source ray.
   */
  getOrigin() {
    this._updateRayTransforms();
    return this._ray.origin;
  }

  /**
   * Get the world space direction of input source ray.
   *
   * @returns {Vec3} The world space direction of input source ray.
   */
  getDirection() {
    this._updateRayTransforms();
    return this._ray.direction;
  }

  /**
   * Attempts to start hit test source based on this input source.
   *
   * @param {object} [options] - Object for passing optional arguments.
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
   * @param {Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
   * @param {import('./xr-hit-test.js').XrHitTestStartCallback} [options.callback] - Optional
   * callback function called once hit test source is created or failed.
   * @example
   * app.xr.input.on('add', function (inputSource) {
   *     inputSource.hitTestStart({
   *         callback: function (err, hitTestSource) {
   *             if (err) return;
   *             hitTestSource.on('result', function (position, rotation, inputSource, hitTestResult) {
   *                 // position and rotation of hit test result
   *                 // that will be created from touch on mobile devices
   *             });
   *         }
   *     });
   * });
   */
  hitTestStart(options = {}) {
    options.inputSource = this;
    options.profile = this._xrInputSource.profiles[0];
    const callback = options.callback;
    options.callback = (err, hitTestSource) => {
      if (hitTestSource) this.onHitTestSourceAdd(hitTestSource);
      if (callback) callback(err, hitTestSource);
    };
    this._manager.hitTest.start(options);
  }

  /**
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * to be added.
   * @private
   */
  onHitTestSourceAdd(hitTestSource) {
    this._hitTestSources.push(hitTestSource);
    this.fire('hittest:add', hitTestSource);
    hitTestSource.on('result', (position, rotation, inputSource, hitTestResult) => {
      if (inputSource !== this) return;
      this.fire('hittest:result', hitTestSource, position, rotation, hitTestResult);
    });
    hitTestSource.once('remove', () => {
      this.onHitTestSourceRemove(hitTestSource);
      this.fire('hittest:remove', hitTestSource);
    });
  }

  /**
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * to be removed.
   * @private
   */
  onHitTestSourceRemove(hitTestSource) {
    const ind = this._hitTestSources.indexOf(hitTestSource);
    if (ind !== -1) this._hitTestSources.splice(ind, 1);
  }
}
/**
 * Fired when {@link XrInputSource} is removed.
 *
 * @event
 * @example
 * inputSource.once('remove', () => {
 *     // input source is not available anymore
 * });
 */
XrInputSource.EVENT_REMOVE = 'remove';
/**
 * Fired when input source has triggered primary action. This could be pressing a trigger
 * button, or touching a screen. The handler is passed an {@link XRInputSourceEvent} object
 * from the WebXR API.
 *
 * @event
 * @example
 * const ray = new pc.Ray();
 * inputSource.on('select', (evt) => {
 *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
 *     if (obj.intersectsRay(ray)) {
 *         // selected an object with input source
 *     }
 * });
 */
XrInputSource.EVENT_SELECT = 'select';
/**
 * Fired when input source has started to trigger primary action. The handler is passed an
 * {@link XRInputSourceEvent} object from the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('selectstart', (evt) => {
 *     console.log('Select started');
 * });
 */
XrInputSource.EVENT_SELECTSTART = 'selectstart';
/**
 * Fired when input source has ended triggering primary action. The handler is passed an
 * {@link XRInputSourceEvent} object from the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('selectend', (evt) => {
 *     console.log('Select ended');
 * });
 */
XrInputSource.EVENT_SELECTEND = 'selectend';
/**
 * Fired when input source has triggered squeeze action. This is associated with "grabbing"
 * action on the controllers. The handler is passed an {@link XRInputSourceEvent} object from
 * the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('squeeze', (evt) => {
 *     console.log('Squeeze');
 * });
 */
XrInputSource.EVENT_SQUEEZE = 'squeeze';
/**
 * Fired when input source has started to trigger squeeze action. The handler is passed an
 * {@link XRInputSourceEvent} object from the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('squeezestart', (evt) => {
 *     if (obj.containsPoint(inputSource.getPosition())) {
 *         // grabbed an object
 *     }
 * });
 */
XrInputSource.EVENT_SQUEEZESTART = 'squeezestart';
/**
 * Fired when input source has ended triggering squeeze action. The handler is passed an
 * {@link XRInputSourceEvent} object from the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('squeezeend', (evt) => {
 *     console.log('Squeeze ended');
 * });
 */
XrInputSource.EVENT_SQUEEZEEND = 'squeezeend';
/**
 * Fired when new {@link XrHitTestSource} is added to the input source. The handler is passed
 * the {@link XrHitTestSource} object that has been added.
 *
 * @event
 * @example
 * inputSource.on('hittest:add', (hitTestSource) => {
 *     // new hit test source is added
 * });
 */
XrInputSource.EVENT_HITTESTADD = 'hittest:add';
/**
 * Fired when {@link XrHitTestSource} is removed to the the input source. The handler is passed
 * the {@link XrHitTestSource} object that has been removed.
 *
 * @event
 * @example
 * inputSource.on('remove', (hitTestSource) => {
 *     // hit test source is removed
 * });
 */
XrInputSource.EVENT_HITTESTREMOVE = 'hittest:remove';
/**
 * Fired when hit test source receives new results. It provides transform information that
 * tries to match real world picked geometry. The handler is passed the {@link XrHitTestSource}
 * object that produced the hit result, the {@link Vec3} position, the {@link Quat}
 * rotation and the {@link XRHitTestResult} object that is created by the WebXR API.
 *
 * @event
 * @example
 * inputSource.on('hittest:result', (hitTestSource, position, rotation, hitTestResult) => {
 *     target.setPosition(position);
 *     target.setRotation(rotation);
 * });
 */
XrInputSource.EVENT_HITTESTRESULT = 'hittest:result';

export { XrInputSource };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaW5wdXQtc291cmNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLWlucHV0LXNvdXJjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9yYXkuanMnO1xuXG5pbXBvcnQgeyBYckhhbmQgfSBmcm9tICcuL3hyLWhhbmQuanMnO1xuXG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuXG5jb25zdCB2ZWMzQSA9IG5ldyBWZWMzKCk7XG5jb25zdCBxdWF0ID0gbmV3IFF1YXQoKTtcbmxldCBpZHMgPSAwO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgWFIgaW5wdXQgc291cmNlLCB3aGljaCBpcyBhbnkgaW5wdXQgbWVjaGFuaXNtIHdoaWNoIGFsbG93cyB0aGUgdXNlciB0byBwZXJmb3JtXG4gKiB0YXJnZXRlZCBhY3Rpb25zIGluIHRoZSBzYW1lIHZpcnR1YWwgc3BhY2UgYXMgdGhlIHZpZXdlci4gRXhhbXBsZSBYUiBpbnB1dCBzb3VyY2VzIGluY2x1ZGUsIGJ1dFxuICogYXJlIG5vdCBsaW1pdGVkIHRvOiBoYW5kaGVsZCBjb250cm9sbGVycywgb3B0aWNhbGx5IHRyYWNrZWQgaGFuZHMsIHRvdWNoIHNjcmVlbiB0YXBzLCBhbmRcbiAqIGdhemUtYmFzZWQgaW5wdXQgbWV0aG9kcyB0aGF0IG9wZXJhdGUgb24gdGhlIHZpZXdlcidzIHBvc2UuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IFhSXG4gKi9cbmNsYXNzIFhySW5wdXRTb3VyY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySW5wdXRTb3VyY2V9IGlzIHJlbW92ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uY2UoJ3JlbW92ZScsICgpID0+IHtcbiAgICAgKiAgICAgLy8gaW5wdXQgc291cmNlIGlzIG5vdCBhdmFpbGFibGUgYW55bW9yZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRU1PVkUgPSAncmVtb3ZlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyB0cmlnZ2VyZWQgcHJpbWFyeSBhY3Rpb24uIFRoaXMgY291bGQgYmUgcHJlc3NpbmcgYSB0cmlnZ2VyXG4gICAgICogYnV0dG9uLCBvciB0b3VjaGluZyBhIHNjcmVlbi4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFuIHtAbGluayBYUklucHV0U291cmNlRXZlbnR9IG9iamVjdFxuICAgICAqIGZyb20gdGhlIFdlYlhSIEFQSS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcmF5ID0gbmV3IHBjLlJheSgpO1xuICAgICAqIGlucHV0U291cmNlLm9uKCdzZWxlY3QnLCAoZXZ0KSA9PiB7XG4gICAgICogICAgIHJheS5zZXQoaW5wdXRTb3VyY2UuZ2V0T3JpZ2luKCksIGlucHV0U291cmNlLmdldERpcmVjdGlvbigpKTtcbiAgICAgKiAgICAgaWYgKG9iai5pbnRlcnNlY3RzUmF5KHJheSkpIHtcbiAgICAgKiAgICAgICAgIC8vIHNlbGVjdGVkIGFuIG9iamVjdCB3aXRoIGlucHV0IHNvdXJjZVxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1NFTEVDVCA9ICdzZWxlY3QnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIHN0YXJ0ZWQgdG8gdHJpZ2dlciBwcmltYXJ5IGFjdGlvbi4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFuXG4gICAgICoge0BsaW5rIFhSSW5wdXRTb3VyY2VFdmVudH0gb2JqZWN0IGZyb20gdGhlIFdlYlhSIEFQSS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5wdXRTb3VyY2Uub24oJ3NlbGVjdHN0YXJ0JywgKGV2dCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnU2VsZWN0IHN0YXJ0ZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU0VMRUNUU1RBUlQgPSAnc2VsZWN0c3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIGVuZGVkIHRyaWdnZXJpbmcgcHJpbWFyeSBhY3Rpb24uIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhblxuICAgICAqIHtAbGluayBYUklucHV0U291cmNlRXZlbnR9IG9iamVjdCBmcm9tIHRoZSBXZWJYUiBBUEkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdzZWxlY3RlbmQnLCAoZXZ0KSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdTZWxlY3QgZW5kZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU0VMRUNURU5EID0gJ3NlbGVjdGVuZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGlucHV0IHNvdXJjZSBoYXMgdHJpZ2dlcmVkIHNxdWVlemUgYWN0aW9uLiBUaGlzIGlzIGFzc29jaWF0ZWQgd2l0aCBcImdyYWJiaW5nXCJcbiAgICAgKiBhY3Rpb24gb24gdGhlIGNvbnRyb2xsZXJzLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYW4ge0BsaW5rIFhSSW5wdXRTb3VyY2VFdmVudH0gb2JqZWN0IGZyb21cbiAgICAgKiB0aGUgV2ViWFIgQVBJLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpbnB1dFNvdXJjZS5vbignc3F1ZWV6ZScsIChldnQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1NxdWVlemUnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1FVRUVaRSA9ICdzcXVlZXplJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyBzdGFydGVkIHRvIHRyaWdnZXIgc3F1ZWV6ZSBhY3Rpb24uIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhblxuICAgICAqIHtAbGluayBYUklucHV0U291cmNlRXZlbnR9IG9iamVjdCBmcm9tIHRoZSBXZWJYUiBBUEkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdzcXVlZXplc3RhcnQnLCAoZXZ0KSA9PiB7XG4gICAgICogICAgIGlmIChvYmouY29udGFpbnNQb2ludChpbnB1dFNvdXJjZS5nZXRQb3NpdGlvbigpKSkge1xuICAgICAqICAgICAgICAgLy8gZ3JhYmJlZCBhbiBvYmplY3RcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9TUVVFRVpFU1RBUlQgPSAnc3F1ZWV6ZXN0YXJ0JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyBlbmRlZCB0cmlnZ2VyaW5nIHNxdWVlemUgYWN0aW9uLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYW5cbiAgICAgKiB7QGxpbmsgWFJJbnB1dFNvdXJjZUV2ZW50fSBvYmplY3QgZnJvbSB0aGUgV2ViWFIgQVBJLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpbnB1dFNvdXJjZS5vbignc3F1ZWV6ZWVuZCcsIChldnQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1NxdWVlemUgZW5kZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1FVRUVaRUVORCA9ICdzcXVlZXplZW5kJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gbmV3IHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIGFkZGVkIHRvIHRoZSBpbnB1dCBzb3VyY2UuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZFxuICAgICAqIHRoZSB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBvYmplY3QgdGhhdCBoYXMgYmVlbiBhZGRlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5wdXRTb3VyY2Uub24oJ2hpdHRlc3Q6YWRkJywgKGhpdFRlc3RTb3VyY2UpID0+IHtcbiAgICAgKiAgICAgLy8gbmV3IGhpdCB0ZXN0IHNvdXJjZSBpcyBhZGRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ISVRURVNUQUREID0gJ2hpdHRlc3Q6YWRkJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gaXMgcmVtb3ZlZCB0byB0aGUgdGhlIGlucHV0IHNvdXJjZS4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkXG4gICAgICogdGhlIHtAbGluayBYckhpdFRlc3RTb3VyY2V9IG9iamVjdCB0aGF0IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdyZW1vdmUnLCAoaGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAqICAgICAvLyBoaXQgdGVzdCBzb3VyY2UgaXMgcmVtb3ZlZFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ISVRURVNUUkVNT1ZFID0gJ2hpdHRlc3Q6cmVtb3ZlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaGl0IHRlc3Qgc291cmNlIHJlY2VpdmVzIG5ldyByZXN1bHRzLiBJdCBwcm92aWRlcyB0cmFuc2Zvcm0gaW5mb3JtYXRpb24gdGhhdFxuICAgICAqIHRyaWVzIHRvIG1hdGNoIHJlYWwgd29ybGQgcGlja2VkIGdlb21ldHJ5LiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIHtAbGluayBYckhpdFRlc3RTb3VyY2V9XG4gICAgICogb2JqZWN0IHRoYXQgcHJvZHVjZWQgdGhlIGhpdCByZXN1bHQsIHRoZSB7QGxpbmsgVmVjM30gcG9zaXRpb24sIHRoZSB7QGxpbmsgUXVhdH1cbiAgICAgKiByb3RhdGlvbiBhbmQgdGhlIHtAbGluayBYUkhpdFRlc3RSZXN1bHR9IG9iamVjdCB0aGF0IGlzIGNyZWF0ZWQgYnkgdGhlIFdlYlhSIEFQSS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5wdXRTb3VyY2Uub24oJ2hpdHRlc3Q6cmVzdWx0JywgKGhpdFRlc3RTb3VyY2UsIHBvc2l0aW9uLCByb3RhdGlvbiwgaGl0VGVzdFJlc3VsdCkgPT4ge1xuICAgICAqICAgICB0YXJnZXQuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqICAgICB0YXJnZXQuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ISVRURVNUUkVTVUxUID0gJ2hpdHRlc3Q6cmVzdWx0JztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUklucHV0U291cmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3hySW5wdXRTb3VyY2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JheSA9IG5ldyBSYXkoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmF5TG9jYWwgPSBuZXcgUmF5KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ncmlwID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJIYW5kfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGFuZCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF92ZWxvY2l0aWVzQXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ZlbG9jaXRpZXNUaW1lc3RhbXAgPSBub3coKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxUcmFuc2Zvcm0gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF93b3JsZFRyYW5zZm9ybSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUG9zaXRpb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uTGFzdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9saW5lYXJWZWxvY2l0eSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eUxvY2FsID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RpcnR5UmF5ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZWxlY3RpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NxdWVlemluZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZWxlbWVudElucHV0ID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VsZW1lbnRFbnRpdHkgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1oaXQtdGVzdC1zb3VyY2UuanMnKS5YckhpdFRlc3RTb3VyY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oaXRUZXN0U291cmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhySW5wdXRTb3VyY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfSBtYW5hZ2VyIC0gV2ViWFIgTWFuYWdlci5cbiAgICAgKiBAcGFyYW0geyp9IHhySW5wdXRTb3VyY2UgLSBbWFJJbnB1dFNvdXJjZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hSSW5wdXRTb3VyY2UpXG4gICAgICogb2JqZWN0IHRoYXQgaXMgY3JlYXRlZCBieSBXZWJYUiBBUEkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIsIHhySW5wdXRTb3VyY2UpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9pZCA9ICsraWRzO1xuXG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuICAgICAgICB0aGlzLl94cklucHV0U291cmNlID0geHJJbnB1dFNvdXJjZTtcblxuICAgICAgICBpZiAoeHJJbnB1dFNvdXJjZS5oYW5kKVxuICAgICAgICAgICAgdGhpcy5faGFuZCA9IG5ldyBYckhhbmQodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5pcXVlIG51bWJlciBhc3NvY2lhdGVkIHdpdGggaW5zdGFuY2Ugb2YgaW5wdXQgc291cmNlLiBTYW1lIHBoeXNpY2FsIGRldmljZXMgd2hlblxuICAgICAqIHJlY29ubmVjdGVkIHdpbGwgbm90IHNoYXJlIHRoaXMgSUQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBpZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFhSSW5wdXRTb3VyY2Ugb2JqZWN0IHRoYXQgaXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgaW5wdXQgc291cmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBnZXQgaW5wdXRTb3VyY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFR5cGUgb2YgcmF5IElucHV0IERldmljZSBpcyBiYXNlZCBvbi4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfR0FaRX06IEdhemUgLSBpbmRpY2F0ZXMgdGhlIHRhcmdldCByYXkgd2lsbCBvcmlnaW5hdGUgYXQgdGhlIHZpZXdlciBhbmRcbiAgICAgKiBmb2xsb3cgdGhlIGRpcmVjdGlvbiBpdCBpcyBmYWNpbmcuIFRoaXMgaXMgY29tbW9ubHkgcmVmZXJyZWQgdG8gYXMgYSBcImdhemUgaW5wdXRcIiBkZXZpY2UgaW5cbiAgICAgKiB0aGUgY29udGV4dCBvZiBoZWFkLW1vdW50ZWQgZGlzcGxheXMuXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfU0NSRUVOfTogU2NyZWVuIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGlucHV0IHNvdXJjZSB3YXMgYW4gaW50ZXJhY3Rpb25cbiAgICAgKiB3aXRoIHRoZSBjYW52YXMgZWxlbWVudCBhc3NvY2lhdGVkIHdpdGggYW4gaW5saW5lIHNlc3Npb24ncyBvdXRwdXQgY29udGV4dCwgc3VjaCBhcyBhIG1vdXNlXG4gICAgICogY2xpY2sgb3IgdG91Y2ggZXZlbnQuXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfUE9JTlRFUn06IFRyYWNrZWQgUG9pbnRlciAtIGluZGljYXRlcyB0aGF0IHRoZSB0YXJnZXQgcmF5IG9yaWdpbmF0ZXNcbiAgICAgKiBmcm9tIGVpdGhlciBhIGhhbmRoZWxkIGRldmljZSBvciBvdGhlciBoYW5kLXRyYWNraW5nIG1lY2hhbmlzbSBhbmQgcmVwcmVzZW50cyB0aGF0IHRoZSB1c2VyXG4gICAgICogaXMgdXNpbmcgdGhlaXIgaGFuZHMgb3IgdGhlIGhlbGQgZGV2aWNlIGZvciBwb2ludGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHRhcmdldFJheU1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLnRhcmdldFJheU1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzY3JpYmVzIHdoaWNoIGhhbmQgaW5wdXQgc291cmNlIGlzIGFzc29jaWF0ZWQgd2l0aC4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJIQU5EX05PTkV9OiBOb25lIC0gaW5wdXQgc291cmNlIGlzIG5vdCBtZWFudCB0byBiZSBoZWxkIGluIGhhbmRzLlxuICAgICAqIC0ge0BsaW5rIFhSSEFORF9MRUZUfTogTGVmdCAtIGluZGljYXRlcyB0aGF0IGlucHV0IHNvdXJjZSBpcyBtZWFudCB0byBiZSBoZWxkIGluIGxlZnQgaGFuZC5cbiAgICAgKiAtIHtAbGluayBYUkhBTkRfUklHSFR9OiBSaWdodCAtIGluZGljYXRlcyB0aGF0IGlucHV0IHNvdXJjZSBpcyBtZWFudCB0byBiZSBoZWxkIGluIHJpZ2h0XG4gICAgICogaGFuZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGhhbmRlZG5lc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLmhhbmRlZG5lc3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBpbnB1dCBwcm9maWxlIG5hbWVzIGluZGljYXRpbmcgYm90aCB0aGUgcHJlZmVycmVkIHZpc3VhbCByZXByZXNlbnRhdGlvbiBhbmQgYmVoYXZpb3JcbiAgICAgKiBvZiB0aGUgaW5wdXQgc291cmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfVxuICAgICAqL1xuICAgIGdldCBwcm9maWxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hySW5wdXRTb3VyY2UucHJvZmlsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgaW5wdXQgc291cmNlIGNhbiBiZSBoZWxkLCB0aGVuIGl0IHdpbGwgaGF2ZSBub2RlIHdpdGggaXRzIHdvcmxkIHRyYW5zZm9ybWF0aW9uLCB0aGF0IGNhblxuICAgICAqIGJlIHVzZWQgdG8gcG9zaXRpb24gYW5kIHJvdGF0ZSB2aXN1YWwgb2JqZWN0IGJhc2VkIG9uIGl0LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGdyaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncmlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIGlucHV0IHNvdXJjZSBpcyBhIHRyYWNrZWQgaGFuZCwgdGhlbiBpdCB3aWxsIHBvaW50IHRvIHtAbGluayBYckhhbmR9IG90aGVyd2lzZSBpdCBpc1xuICAgICAqIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJIYW5kfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGhhbmQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIGlucHV0IHNvdXJjZSBoYXMgYnV0dG9ucywgdHJpZ2dlcnMsIHRodW1ic3RpY2sgb3IgdG91Y2hwYWQsIHRoZW4gdGhpcyBvYmplY3QgcHJvdmlkZXNcbiAgICAgKiBhY2Nlc3MgdG8gaXRzIHN0YXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHYW1lcGFkfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGdhbWVwYWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLmdhbWVwYWQgfHwgbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGlucHV0IHNvdXJjZSBpcyBpbiBhY3RpdmUgcHJpbWFyeSBhY3Rpb24gYmV0d2VlbiBzZWxlY3RzdGFydCBhbmQgc2VsZWN0ZW5kIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBzZWxlY3RpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZWxlY3Rpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBpbnB1dCBzb3VyY2UgaXMgaW4gYWN0aXZlIHNxdWVlemUgYWN0aW9uIGJldHdlZW4gc3F1ZWV6ZXN0YXJ0IGFuZCBzcXVlZXplZW5kIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBzcXVlZXppbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcXVlZXppbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRvIHRydWUgdG8gYWxsb3cgaW5wdXQgc291cmNlIHRvIGludGVyYWN0IHdpdGggRWxlbWVudCBjb21wb25lbnRzLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGVsZW1lbnRJbnB1dCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudElucHV0ID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9lbGVtZW50SW5wdXQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuX2VsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnRFbnRpdHkgPSBudWxsO1xuICAgIH1cblxuICAgIGdldCBlbGVtZW50SW5wdXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbGVtZW50SW5wdXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYge0BsaW5rIFhySW5wdXRTb3VyY2UjZWxlbWVudElucHV0fSBpcyB0cnVlLCB0aGlzIHByb3BlcnR5IHdpbGwgaG9sZCBlbnRpdHkgd2l0aCBFbGVtZW50XG4gICAgICogY29tcG9uZW50IGF0IHdoaWNoIHRoaXMgaW5wdXQgc291cmNlIGlzIGhvdmVyaW5nLCBvciBudWxsIGlmIG5vdCBob3ZlcmluZyBvdmVyIGFueSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fG51bGx9XG4gICAgICovXG4gICAgZ2V0IGVsZW1lbnRFbnRpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbGVtZW50RW50aXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpc3Qgb2YgYWN0aXZlIHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGluc3RhbmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZVtdfVxuICAgICAqL1xuICAgIGdldCBoaXRUZXN0U291cmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hpdFRlc3RTb3VyY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgLy8gaGFuZFxuICAgICAgICBpZiAodGhpcy5faGFuZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZC51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZ3JpcFxuICAgICAgICAgICAgY29uc3QgZ3JpcFNwYWNlID0gdGhpcy5feHJJbnB1dFNvdXJjZS5ncmlwU3BhY2U7XG4gICAgICAgICAgICBpZiAoZ3JpcFNwYWNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3JpcFBvc2UgPSBmcmFtZS5nZXRQb3NlKGdyaXBTcGFjZSwgdGhpcy5fbWFuYWdlci5fcmVmZXJlbmNlU3BhY2UpO1xuICAgICAgICAgICAgICAgIGlmIChncmlwUG9zZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2dyaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyaXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl93b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsUG9zaXRpb25MYXN0ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsUG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpbmVhclZlbG9jaXR5ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkdCA9ICh0aW1lc3RhbXAgLSB0aGlzLl92ZWxvY2l0aWVzVGltZXN0YW1wKSAvIDEwMDA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3ZlbG9jaXRpZXNUaW1lc3RhbXAgPSB0aW1lc3RhbXA7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbkxhc3QuY29weSh0aGlzLl9sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbi5jb3B5KGdyaXBQb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsUm90YXRpb24uY29weShncmlwUG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3ZlbG9jaXRpZXNBdmFpbGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWFuYWdlci5pbnB1dC52ZWxvY2l0aWVzU3VwcG9ydGVkICYmIGdyaXBQb3NlLmxpbmVhclZlbG9jaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5jb3B5KGdyaXBQb3NlLmxpbmVhclZlbG9jaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkdCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlYzNBLnN1YjIodGhpcy5fbG9jYWxQb3NpdGlvbiwgdGhpcy5fbG9jYWxQb3NpdGlvbkxhc3QpLmRpdlNjYWxhcihkdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5sZXJwKHRoaXMuX2xpbmVhclZlbG9jaXR5LCB2ZWMzQSwgMC4xNSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl92ZWxvY2l0aWVzQXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByYXlcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFJheVBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hySW5wdXRTb3VyY2UudGFyZ2V0UmF5U3BhY2UsIHRoaXMuX21hbmFnZXIuX3JlZmVyZW5jZVNwYWNlKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRSYXlQb3NlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlSYXkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JheUxvY2FsLm9yaWdpbi5jb3B5KHRhcmdldFJheVBvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yYXlMb2NhbC5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgICAgICBxdWF0LmNvcHkodGFyZ2V0UmF5UG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgIHF1YXQudHJhbnNmb3JtVmVjdG9yKHRoaXMuX3JheUxvY2FsLmRpcmVjdGlvbiwgdGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91cGRhdGVUcmFuc2Zvcm1zKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMuX2xvY2FsUG9zaXRpb24sIHRoaXMuX2xvY2FsUm90YXRpb24sIFZlYzMuT05FKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX21hbmFnZXIuY2FtZXJhLnBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0ubXVsMihwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKSwgdGhpcy5fbG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLl9sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlUmF5VHJhbnNmb3JtcygpIHtcbiAgICAgICAgY29uc3QgZGlydHkgPSB0aGlzLl9kaXJ0eVJheTtcbiAgICAgICAgdGhpcy5fZGlydHlSYXkgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9tYW5hZ2VyLmNhbWVyYS5wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFRyYW5zZm9ybSA9IHRoaXMuX21hbmFnZXIuY2FtZXJhLnBhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBwYXJlbnRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24odGhpcy5fcG9zaXRpb24pO1xuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24uc2V0RnJvbU1hdDQocGFyZW50VHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24udHJhbnNmb3JtVmVjdG9yKHRoaXMuX3JheUxvY2FsLm9yaWdpbiwgdGhpcy5fcmF5Lm9yaWdpbik7XG4gICAgICAgICAgICB0aGlzLl9yYXkub3JpZ2luLmFkZCh0aGlzLl9wb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9yb3RhdGlvbi50cmFuc2Zvcm1WZWN0b3IodGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uLCB0aGlzLl9yYXkuZGlyZWN0aW9uKTtcbiAgICAgICAgfSBlbHNlIGlmIChkaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fcmF5Lm9yaWdpbi5jb3B5KHRoaXMuX3JheUxvY2FsLm9yaWdpbik7XG4gICAgICAgICAgICB0aGlzLl9yYXkuZGlyZWN0aW9uLmNvcHkodGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgaW5wdXQgc291cmNlIGlmIGl0IGlzIGhhbmRoZWxkICh7QGxpbmsgWHJJbnB1dFNvdXJjZSNncmlwfVxuICAgICAqIGlzIHRydWUpLiBPdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfG51bGx9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBoYW5kaGVsZCBpbnB1dCBzb3VyY2UuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fcG9zaXRpb24pIHJldHVybiBudWxsO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybXMoKTtcbiAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24odGhpcy5fcG9zaXRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIGlucHV0IHNvdXJjZSBpZiBpdCBpcyBoYW5kaGVsZCAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH1cbiAgICAgKiBpcyB0cnVlKS4gTG9jYWwgc3BhY2UgaXMgcmVsYXRpdmUgdG8gcGFyZW50IG9mIHRoZSBYUiBjYW1lcmEuIE90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN8bnVsbH0gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGhhbmRoZWxkIGlucHV0IHNvdXJjZS5cbiAgICAgKi9cbiAgICBnZXRMb2NhbFBvc2l0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGlucHV0IHNvdXJjZSBpZiBpdCBpcyBoYW5kaGVsZCAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH1cbiAgICAgKiBpcyB0cnVlKS4gT3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdHxudWxsfSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgaGFuZGhlbGQgaW5wdXQgc291cmNlLlxuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JvdGF0aW9uKSByZXR1cm4gbnVsbDtcblxuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHRoaXMuX3JvdGF0aW9uLnNldEZyb21NYXQ0KHRoaXMuX3dvcmxkVHJhbnNmb3JtKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fcm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsb2NhbCBzcGFjZSByb3RhdGlvbiBvZiBpbnB1dCBzb3VyY2UgaWYgaXQgaXMgaGFuZGhlbGQgKHtAbGluayBYcklucHV0U291cmNlI2dyaXB9XG4gICAgICogaXMgdHJ1ZSkuIExvY2FsIHNwYWNlIGlzIHJlbGF0aXZlIHRvIHBhcmVudCBvZiB0aGUgWFIgY2FtZXJhLiBPdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fG51bGx9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBoYW5kaGVsZCBpbnB1dCBzb3VyY2UuXG4gICAgICovXG4gICAgZ2V0TG9jYWxSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsUm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsaW5lYXIgdmVsb2NpdHkgKHVuaXRzIHBlciBzZWNvbmQpIG9mIHRoZSBpbnB1dCBzb3VyY2UgaWYgaXQgaXMgaGFuZGhlbGRcbiAgICAgKiAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH0gaXMgdHJ1ZSkuIE90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN8bnVsbH0gVGhlIHdvcmxkIHNwYWNlIGxpbmVhciB2ZWxvY2l0eSBvZiB0aGUgaGFuZGhlbGQgaW5wdXQgc291cmNlLlxuICAgICAqL1xuICAgIGdldExpbmVhclZlbG9jaXR5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3ZlbG9jaXRpZXNBdmFpbGFibGUpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyVmVsb2NpdHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBvcmlnaW4gb2YgaW5wdXQgc291cmNlIHJheS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2Ugb3JpZ2luIG9mIGlucHV0IHNvdXJjZSByYXkuXG4gICAgICovXG4gICAgZ2V0T3JpZ2luKCkge1xuICAgICAgICB0aGlzLl91cGRhdGVSYXlUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYXkub3JpZ2luO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgZGlyZWN0aW9uIG9mIGlucHV0IHNvdXJjZSByYXkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiBpbnB1dCBzb3VyY2UgcmF5LlxuICAgICAqL1xuICAgIGdldERpcmVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUmF5VHJhbnNmb3JtcygpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcmF5LmRpcmVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0cyB0byBzdGFydCBoaXQgdGVzdCBzb3VyY2UgYmFzZWQgb24gdGhpcyBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5lbnRpdHlUeXBlc10gLSBPcHRpb25hbCBsaXN0IG9mIHVuZGVybHlpbmcgZW50aXR5IHR5cGVzIGFnYWluc3RcbiAgICAgKiB3aGljaCBoaXQgdGVzdHMgd2lsbCBiZSBwZXJmb3JtZWQuIERlZmF1bHRzIHRvIFsge0BsaW5rIFhSVFJBQ0tBQkxFX1BMQU5FfSBdLiBDYW4gYmUgYW55XG4gICAgICogY29tYmluYXRpb24gb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX1BPSU5UfTogUG9pbnQgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaGl0IHRlc3QgcmVzdWx0cyB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogYmFzZWQgb24gdGhlIGZlYXR1cmUgcG9pbnRzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX06IFBsYW5lIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBwbGFuZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX01FU0h9OiBNZXNoIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBtZXNoZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSYXl9IFtvcHRpb25zLm9mZnNldFJheV0gLSBPcHRpb25hbCByYXkgYnkgd2hpY2ggaGl0IHRlc3QgcmF5IGNhbiBiZSBvZmZzZXQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3QuanMnKS5YckhpdFRlc3RTdGFydENhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbFxuICAgICAqIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIGhpdCB0ZXN0IHNvdXJjZSBpcyBjcmVhdGVkIG9yIGZhaWxlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5pbnB1dC5vbignYWRkJywgZnVuY3Rpb24gKGlucHV0U291cmNlKSB7XG4gICAgICogICAgIGlucHV0U291cmNlLmhpdFRlc3RTdGFydCh7XG4gICAgICogICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgICAgIGlmIChlcnIpIHJldHVybjtcbiAgICAgKiAgICAgICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSwgaGl0VGVzdFJlc3VsdCkge1xuICAgICAqICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgaGl0IHRlc3QgcmVzdWx0XG4gICAgICogICAgICAgICAgICAgICAgIC8vIHRoYXQgd2lsbCBiZSBjcmVhdGVkIGZyb20gdG91Y2ggb24gbW9iaWxlIGRldmljZXNcbiAgICAgKiAgICAgICAgICAgICB9KTtcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaGl0VGVzdFN0YXJ0KG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBvcHRpb25zLmlucHV0U291cmNlID0gdGhpcztcbiAgICAgICAgb3B0aW9ucy5wcm9maWxlID0gdGhpcy5feHJJbnB1dFNvdXJjZS5wcm9maWxlc1swXTtcblxuICAgICAgICBjb25zdCBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgICAgIG9wdGlvbnMuY2FsbGJhY2sgPSAoZXJyLCBoaXRUZXN0U291cmNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoaGl0VGVzdFNvdXJjZSkgdGhpcy5vbkhpdFRlc3RTb3VyY2VBZGQoaGl0VGVzdFNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgaGl0VGVzdFNvdXJjZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fbWFuYWdlci5oaXRUZXN0LnN0YXJ0KG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZVxuICAgICAqIHRvIGJlIGFkZGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25IaXRUZXN0U291cmNlQWRkKGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgICAgdGhpcy5faGl0VGVzdFNvdXJjZXMucHVzaChoaXRUZXN0U291cmNlKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2hpdHRlc3Q6YWRkJywgaGl0VGVzdFNvdXJjZSk7XG5cbiAgICAgICAgaGl0VGVzdFNvdXJjZS5vbigncmVzdWx0JywgKHBvc2l0aW9uLCByb3RhdGlvbiwgaW5wdXRTb3VyY2UsIGhpdFRlc3RSZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChpbnB1dFNvdXJjZSAhPT0gdGhpcykgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdoaXR0ZXN0OnJlc3VsdCcsIGhpdFRlc3RTb3VyY2UsIHBvc2l0aW9uLCByb3RhdGlvbiwgaGl0VGVzdFJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgICBoaXRUZXN0U291cmNlLm9uY2UoJ3JlbW92ZScsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25IaXRUZXN0U291cmNlUmVtb3ZlKGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdoaXR0ZXN0OnJlbW92ZScsIGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1oaXQtdGVzdC1zb3VyY2UuanMnKS5YckhpdFRlc3RTb3VyY2V9IGhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2VcbiAgICAgKiB0byBiZSByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25IaXRUZXN0U291cmNlUmVtb3ZlKGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgICAgY29uc3QgaW5kID0gdGhpcy5faGl0VGVzdFNvdXJjZXMuaW5kZXhPZihoaXRUZXN0U291cmNlKTtcbiAgICAgICAgaWYgKGluZCAhPT0gLTEpIHRoaXMuX2hpdFRlc3RTb3VyY2VzLnNwbGljZShpbmQsIDEpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJJbnB1dFNvdXJjZSB9O1xuIl0sIm5hbWVzIjpbInZlYzNBIiwiVmVjMyIsInF1YXQiLCJRdWF0IiwiaWRzIiwiWHJJbnB1dFNvdXJjZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsInhySW5wdXRTb3VyY2UiLCJfaWQiLCJfbWFuYWdlciIsIl94cklucHV0U291cmNlIiwiX3JheSIsIlJheSIsIl9yYXlMb2NhbCIsIl9ncmlwIiwiX2hhbmQiLCJfdmVsb2NpdGllc0F2YWlsYWJsZSIsIl92ZWxvY2l0aWVzVGltZXN0YW1wIiwibm93IiwiX2xvY2FsVHJhbnNmb3JtIiwiX3dvcmxkVHJhbnNmb3JtIiwiX3Bvc2l0aW9uIiwiX3JvdGF0aW9uIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxQb3NpdGlvbkxhc3QiLCJfbG9jYWxSb3RhdGlvbiIsIl9saW5lYXJWZWxvY2l0eSIsIl9kaXJ0eUxvY2FsIiwiX2RpcnR5UmF5IiwiX3NlbGVjdGluZyIsIl9zcXVlZXppbmciLCJfZWxlbWVudElucHV0IiwiX2VsZW1lbnRFbnRpdHkiLCJfaGl0VGVzdFNvdXJjZXMiLCJoYW5kIiwiWHJIYW5kIiwiaWQiLCJpbnB1dFNvdXJjZSIsInRhcmdldFJheU1vZGUiLCJoYW5kZWRuZXNzIiwicHJvZmlsZXMiLCJncmlwIiwiZ2FtZXBhZCIsInNlbGVjdGluZyIsInNxdWVlemluZyIsImVsZW1lbnRJbnB1dCIsInZhbHVlIiwiZWxlbWVudEVudGl0eSIsImhpdFRlc3RTb3VyY2VzIiwidXBkYXRlIiwiZnJhbWUiLCJncmlwU3BhY2UiLCJncmlwUG9zZSIsImdldFBvc2UiLCJfcmVmZXJlbmNlU3BhY2UiLCJNYXQ0IiwidGltZXN0YW1wIiwiZHQiLCJjb3B5IiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJvcmllbnRhdGlvbiIsImlucHV0IiwidmVsb2NpdGllc1N1cHBvcnRlZCIsImxpbmVhclZlbG9jaXR5Iiwic3ViMiIsImRpdlNjYWxhciIsImxlcnAiLCJ0YXJnZXRSYXlQb3NlIiwidGFyZ2V0UmF5U3BhY2UiLCJvcmlnaW4iLCJkaXJlY3Rpb24iLCJzZXQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJfdXBkYXRlVHJhbnNmb3JtcyIsInNldFRSUyIsIk9ORSIsInBhcmVudCIsImNhbWVyYSIsIm11bDIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl91cGRhdGVSYXlUcmFuc2Zvcm1zIiwiZGlydHkiLCJwYXJlbnRUcmFuc2Zvcm0iLCJnZXRUcmFuc2xhdGlvbiIsInNldEZyb21NYXQ0IiwiYWRkIiwiZ2V0UG9zaXRpb24iLCJnZXRMb2NhbFBvc2l0aW9uIiwiZ2V0Um90YXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0TGluZWFyVmVsb2NpdHkiLCJnZXRPcmlnaW4iLCJnZXREaXJlY3Rpb24iLCJoaXRUZXN0U3RhcnQiLCJvcHRpb25zIiwicHJvZmlsZSIsImNhbGxiYWNrIiwiZXJyIiwiaGl0VGVzdFNvdXJjZSIsIm9uSGl0VGVzdFNvdXJjZUFkZCIsImhpdFRlc3QiLCJzdGFydCIsInB1c2giLCJmaXJlIiwib24iLCJyb3RhdGlvbiIsImhpdFRlc3RSZXN1bHQiLCJvbmNlIiwib25IaXRUZXN0U291cmNlUmVtb3ZlIiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSIsIkVWRU5UX1JFTU9WRSIsIkVWRU5UX1NFTEVDVCIsIkVWRU5UX1NFTEVDVFNUQVJUIiwiRVZFTlRfU0VMRUNURU5EIiwiRVZFTlRfU1FVRUVaRSIsIkVWRU5UX1NRVUVFWkVTVEFSVCIsIkVWRU5UX1NRVUVFWkVFTkQiLCJFVkVOVF9ISVRURVNUQUREIiwiRVZFTlRfSElUVEVTVFJFTU9WRSIsIkVWRU5UX0hJVFRFU1RSRVNVTFQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBVUEsTUFBTUEsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3hCLE1BQU1DLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixJQUFJQyxHQUFHLEdBQUcsQ0FBQyxDQUFBOztBQUVYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsU0FBU0MsWUFBWSxDQUFDO0FBbVJyQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE9BQU8sRUFBRUMsYUFBYSxFQUFFO0FBQ2hDLElBQUEsS0FBSyxFQUFFLENBQUE7QUF6Slg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsY0FBYyxHQUFBLEtBQUEsQ0FB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
