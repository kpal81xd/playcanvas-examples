import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGFORMAT_L8A8 } from './constants.js';
import { DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2 } from '../../platform/graphics/constants.js';
import { XrDepthSensing } from './xr-depth-sensing.js';
import { XrDomOverlay } from './xr-dom-overlay.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrImageTracking } from './xr-image-tracking.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrPlaneDetection } from './xr-plane-detection.js';
import { XrAnchors } from './xr-anchors.js';
import { XrMeshDetection } from './xr-mesh-detection.js';
import { XrViews } from './xr-views.js';

/**
 * Callback used by {@link XrManager#endXr} and {@link XrManager#startXr}.
 *
 * @callback XrErrorCallback
 * @param {Error|null} err - The Error object or null if operation was successful.
 */

/**
 * Callback used by manual room capturing.
 *
 * @callback XrRoomCaptureCallback
 * @param {Error|null} err - The Error object or null if manual room capture was successful.
 */

/**
 * Manage and update XR session and its states.
 *
 * @augments EventHandler
 * @category XR
 */
class XrManager extends EventHandler {
  /**
   * Create a new XrManager instance.
   *
   * @param {import('../app-base.js').AppBase} app - The main application.
   * @hideconstructor
   */
  constructor(app) {
    super();
    /**
     * @type {import('../app-base.js').AppBase}
     * @ignore
     */
    this.app = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!navigator.xr;
    /**
     * @type {Object<string, boolean>}
     * @private
     */
    this._available = {};
    /**
     * @type {string|null}
     * @private
     */
    this._type = null;
    /**
     * @type {string|null}
     * @private
     */
    this._spaceType = null;
    /**
     * @type {XRSession|null}
     * @private
     */
    this._session = null;
    /**
     * @type {XRWebGLLayer|null}
     * @private
     */
    this._baseLayer = null;
    /**
     * @type {XRWebGLBinding|null}
     * @ignore
     */
    this.webglBinding = null;
    /**
     * @type {XRReferenceSpace|null}
     * @ignore
     */
    this._referenceSpace = null;
    /**
     * Provides access to depth sensing capabilities.
     *
     * @type {XrDepthSensing}
     * @ignore
     */
    this.depthSensing = void 0;
    /**
     * Provides access to DOM overlay capabilities.
     *
     * @type {XrDomOverlay}
     */
    this.domOverlay = void 0;
    /**
     * Provides the ability to perform hit tests on the representation of real world geometry
     * of the underlying AR system.
     *
     * @type {XrHitTest}
     */
    this.hitTest = void 0;
    /**
     * Provides access to image tracking capabilities.
     *
     * @type {XrImageTracking}
     */
    this.imageTracking = void 0;
    /**
     * Provides access to plane detection capabilities.
     *
     * @type {XrPlaneDetection}
     */
    this.planeDetection = void 0;
    /**
     * Provides access to mesh detection capabilities.
     *
     * @type {XrMeshDetection}
     */
    this.meshDetection = void 0;
    /**
     * Provides access to Input Sources.
     *
     * @type {XrInput}
     */
    this.input = void 0;
    /**
     * Provides access to light estimation capabilities.
     *
     * @type {XrLightEstimation}
     */
    this.lightEstimation = void 0;
    /**
     * Provides access to views and their capabilities.
     *
     * @type {XrViews}
     */
    this.views = void 0;
    /**
     * Provides access to Anchors.
     *
     * @type {XrAnchors}
     */
    this.anchors = void 0;
    /**
     * @type {import('../components/camera/component.js').CameraComponent}
     * @private
     */
    this._camera = null;
    /**
     * @type {Vec3}
     * @private
     */
    this._localPosition = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._localRotation = new Quat();
    /**
     * @type {number}
     * @private
     */
    this._depthNear = 0.1;
    /**
     * @type {number}
     * @private
     */
    this._depthFar = 1000;
    /**
     * @type {number}
     * @private
     */
    this._width = 0;
    /**
     * @type {number}
     * @private
     */
    this._height = 0;
    this.app = app;

    // Add all the supported session types
    this._available[XRTYPE_INLINE] = false;
    this._available[XRTYPE_VR] = false;
    this._available[XRTYPE_AR] = false;
    this.views = new XrViews(this);
    this.depthSensing = new XrDepthSensing(this);
    this.domOverlay = new XrDomOverlay(this);
    this.hitTest = new XrHitTest(this);
    this.imageTracking = new XrImageTracking(this);
    this.planeDetection = new XrPlaneDetection(this);
    this.meshDetection = new XrMeshDetection(this);
    this.input = new XrInput(this);
    this.lightEstimation = new XrLightEstimation(this);
    this.anchors = new XrAnchors(this);
    this.views = new XrViews(this);

    // TODO
    // 1. HMD class with its params
    // 2. Space class
    // 3. Controllers class

    if (this._supported) {
      navigator.xr.addEventListener('devicechange', () => {
        this._deviceAvailabilityCheck();
      });
      this._deviceAvailabilityCheck();
      this.app.graphicsDevice.on('devicelost', this._onDeviceLost, this);
      this.app.graphicsDevice.on('devicerestored', this._onDeviceRestored, this);
    }
  }

  /**
   * Destroys the XrManager instance.
   *
   * @ignore
   */
  destroy() {}

  /**
   * Attempts to start XR session for provided {@link CameraComponent} and optionally fires
   * callback when session is created or failed to create. Integrated XR APIs need to be enabled
   * by providing relevant options.
   *
   * @param {import('../components/camera/component.js').CameraComponent} camera - It will be
   * used to render XR session and manipulated based on pose tracking.
   * @param {string} type - Session type. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
   * best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
   * that is intended to be blended with real-world environment.
   *
   * @param {string} spaceType - Reference space type. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
   * capabilities.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation. It is meant for seated or basic local XR sessions.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform. It is meant for seated or
   * basic local XR sessions.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {object} [options] - Object with additional options for XR session initialization.
   * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
   * used for getting access to additional WebXR spec extensions.
   * @param {boolean} [options.anchors] - Set to true to attempt to enable
   * {@link XrAnchors}.
   * @param {boolean} [options.imageTracking] - Set to true to attempt to enable
   * {@link XrImageTracking}.
   * @param {boolean} [options.planeDetection] - Set to true to attempt to enable
   * {@link XrPlaneDetection}.
   * @param {boolean} [options.meshDetection] - Set to true to attempt to enable
   * {@link XrMeshDetection}.
   * @param {XrErrorCallback} [options.callback] - Optional callback function called once session
   * is started. The callback has one argument Error - it is null if successfully started XR
   * session.
   * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
   * attempt to enable {@link XrDepthSensing}.
   * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
   * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
   * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
   * system.
   * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
   * preference for depth sensing, can be 'luminance-alpha' or 'float32'
   * (XRDEPTHSENSINGFORMAT_*), defaults to 'luminance-alpha'. Most preferred and supported will
   * be chosen by the underlying depth sensing system.
   * @example
   * button.on('click', function () {
   *     app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR);
   * });
   * @example
   * button.on('click', function () {
   *     app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
   *         anchors: true,
   *         imageTracking: true,
   *         depthSensing: { }
   *     });
   * });
   */
  start(camera, type, spaceType, options) {
    var _this$app$graphicsDev, _this$app$graphicsDev2;
    let callback = options;
    if (typeof options === 'object') callback = options.callback;
    if (!this._available[type]) {
      if (callback) callback(new Error('XR is not available'));
      return;
    }
    if (this._session) {
      if (callback) callback(new Error('XR session is already started'));
      return;
    }
    this._camera = camera;
    this._camera.camera.xr = this;
    this._type = type;
    this._spaceType = spaceType;
    this._setClipPlanes(camera.nearClip, camera.farClip);

    // TODO
    // makeXRCompatible
    // scenario to test:
    // 1. app is running on integrated GPU
    // 2. XR device is connected, to another GPU
    // 3. probably immersive-vr will fail to be created
    // 4. call makeXRCompatible, very likely will lead to context loss

    const opts = {
      requiredFeatures: [spaceType],
      optionalFeatures: []
    };
    const webgl = ((_this$app$graphicsDev = this.app.graphicsDevice) == null ? void 0 : _this$app$graphicsDev.isWebGL1) || ((_this$app$graphicsDev2 = this.app.graphicsDevice) == null ? void 0 : _this$app$graphicsDev2.isWebGL2);
    if (type === XRTYPE_AR) {
      opts.optionalFeatures.push('light-estimation');
      opts.optionalFeatures.push('hit-test');
      if (options) {
        if (options.imageTracking && this.imageTracking.supported) opts.optionalFeatures.push('image-tracking');
        if (options.planeDetection) opts.optionalFeatures.push('plane-detection');
        if (options.meshDetection) opts.optionalFeatures.push('mesh-detection');
      }
      if (this.domOverlay.supported && this.domOverlay.root) {
        opts.optionalFeatures.push('dom-overlay');
        opts.domOverlay = {
          root: this.domOverlay.root
        };
      }
      if (options && options.anchors && this.anchors.supported) {
        opts.optionalFeatures.push('anchors');
      }
      if (options && options.depthSensing && this.depthSensing.supported) {
        opts.optionalFeatures.push('depth-sensing');
        const usagePreference = [XRDEPTHSENSINGUSAGE_CPU];
        const dataFormatPreference = [XRDEPTHSENSINGFORMAT_L8A8];
        if (options.depthSensing.usagePreference) {
          const ind = usagePreference.indexOf(options.depthSensing.usagePreference);
          if (ind !== -1) usagePreference.splice(ind, 1);
          usagePreference.unshift(options.depthSensing.usagePreference);
        }
        if (options.depthSensing.dataFormatPreference) {
          const ind = dataFormatPreference.indexOf(options.depthSensing.dataFormatPreference);
          if (ind !== -1) dataFormatPreference.splice(ind, 1);
          dataFormatPreference.unshift(options.depthSensing.dataFormatPreference);
        }
        opts.depthSensing = {
          usagePreference: usagePreference,
          dataFormatPreference: dataFormatPreference
        };
      }
      if (webgl && options && options.cameraColor && this.views.supportedColor) {
        opts.optionalFeatures.push('camera-access');
      }
    }
    opts.optionalFeatures.push('hand-tracking');
    if (options && options.optionalFeatures) opts.optionalFeatures = opts.optionalFeatures.concat(options.optionalFeatures);
    if (this.imageTracking.supported && this.imageTracking.images.length) {
      this.imageTracking.prepareImages((err, trackedImages) => {
        if (err) {
          if (callback) callback(err);
          this.fire('error', err);
          return;
        }
        if (trackedImages !== null) opts.trackedImages = trackedImages;
        this._onStartOptionsReady(type, spaceType, opts, callback);
      });
    } else {
      this._onStartOptionsReady(type, spaceType, opts, callback);
    }
  }

  /**
   * @param {string} type - Session type.
   * @param {string} spaceType - Reference space type.
   * @param {*} options - Session options.
   * @param {XrErrorCallback} callback - Error callback.
   * @private
   */
  _onStartOptionsReady(type, spaceType, options, callback) {
    navigator.xr.requestSession(type, options).then(session => {
      this._onSessionStart(session, spaceType, callback);
    }).catch(ex => {
      this._camera.camera.xr = null;
      this._camera = null;
      this._type = null;
      this._spaceType = null;
      if (callback) callback(ex);
      this.fire('error', ex);
    });
  }

  /**
   * Attempts to end XR session and optionally fires callback when session is ended or failed to
   * end.
   *
   * @param {XrErrorCallback} [callback] - Optional callback function called once session is
   * started. The callback has one argument Error - it is null if successfully started XR
   * session.
   * @example
   * app.keyboard.on('keydown', function (evt) {
   *     if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
   *         app.xr.end();
   *     }
   * });
   */
  end(callback) {
    if (!this._session) {
      if (callback) callback(new Error('XR Session is not initialized'));
      return;
    }
    this.webglBinding = null;
    if (callback) this.once('end', callback);
    this._session.end();
  }

  /**
   * Check if specific type of session is available.
   *
   * @param {string} type - Session type. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
   * best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
   * that is intended to be blended with real-world environment.
   *
   * @example
   * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
   *     // VR is available
   * }
   * @returns {boolean} True if specified session type is available.
   */
  isAvailable(type) {
    return this._available[type];
  }

  /** @private */
  _deviceAvailabilityCheck() {
    for (const key in this._available) {
      this._sessionSupportCheck(key);
    }
  }

  /**
   * Initiate manual room capture. If the underlying XR system supports manual capture of the
   * room, it will start the capturing process, which can affect plane and mesh detection,
   * and improve hit-test quality against real-world geometry.
   *
   * @param {XrRoomCaptureCallback} callback - Callback that will be fired once capture is complete
   * or failed.
   *
   * @example
   * this.app.xr.initiateRoomCapture((err) => {
   *     if (err) {
   *         // capture failed
   *         return;
   *     }
   *     // capture was successful
   * });
   */
  initiateRoomCapture(callback) {
    if (!this._session) {
      callback(new Error('Session is not active'));
      return;
    }
    if (!this._session.initiateRoomCapture) {
      callback(new Error('Session does not support manual room capture'));
      return;
    }
    this._session.initiateRoomCapture().then(() => {
      if (callback) callback(null);
    }).catch(err => {
      if (callback) callback(err);
    });
  }

  /**
   * @param {string} type - Session type.
   * @private
   */
  _sessionSupportCheck(type) {
    navigator.xr.isSessionSupported(type).then(available => {
      if (this._available[type] === available) return;
      this._available[type] = available;
      this.fire('available', type, available);
      this.fire('available:' + type, available);
    }).catch(ex => {
      this.fire('error', ex);
    });
  }

  /**
   * @param {XRSession} session - XR session.
   * @param {string} spaceType - Space type to request for the session.
   * @param {Function} callback - Callback to call when session is started.
   * @private
   */
  _onSessionStart(session, spaceType, callback) {
    let failed = false;
    this._session = session;
    const onVisibilityChange = () => {
      this.fire('visibility:change', session.visibilityState);
    };
    const onClipPlanesChange = () => {
      this._setClipPlanes(this._camera.nearClip, this._camera.farClip);
    };

    // clean up once session is ended
    const onEnd = () => {
      if (this._camera) {
        this._camera.off('set_nearClip', onClipPlanesChange);
        this._camera.off('set_farClip', onClipPlanesChange);
        this._camera.camera.xr = null;
        this._camera = null;
      }
      session.removeEventListener('end', onEnd);
      session.removeEventListener('visibilitychange', onVisibilityChange);
      if (!failed) this.fire('end');
      this._session = null;
      this._referenceSpace = null;
      this._width = 0;
      this._height = 0;
      this._type = null;
      this._spaceType = null;

      // old requestAnimationFrame will never be triggered,
      // so queue up new tick
      if (this.app.systems) this.app.tick();
    };
    session.addEventListener('end', onEnd);
    session.addEventListener('visibilitychange', onVisibilityChange);
    this._camera.on('set_nearClip', onClipPlanesChange);
    this._camera.on('set_farClip', onClipPlanesChange);

    // A framebufferScaleFactor scale of 1 is the full resolution of the display
    // so we need to calculate this based on devicePixelRatio of the dislay and what
    // we've set this in the graphics device
    Debug.assert(window, 'window is needed to scale the XR framebuffer. Are you running XR headless?');
    this._createBaseLayer();

    // request reference space
    session.requestReferenceSpace(spaceType).then(referenceSpace => {
      this._referenceSpace = referenceSpace;

      // old requestAnimationFrame will never be triggered,
      // so queue up new tick
      this.app.tick();
      if (callback) callback(null);
      this.fire('start');
    }).catch(ex => {
      failed = true;
      session.end();
      if (callback) callback(ex);
      this.fire('error', ex);
    });
  }

  /**
   * @param {number} near - Near plane distance.
   * @param {number} far - Far plane distance.
   * @private
   */
  _setClipPlanes(near, far) {
    if (this._depthNear === near && this._depthFar === far) return;
    this._depthNear = near;
    this._depthFar = far;
    if (!this._session) return;

    // if session is available,
    // queue up render state update
    this._session.updateRenderState({
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }
  _createBaseLayer() {
    const device = this.app.graphicsDevice;
    const framebufferScaleFactor = device.maxPixelRatio / window.devicePixelRatio;
    this._baseLayer = new XRWebGLLayer(this._session, device.gl, {
      alpha: true,
      depth: true,
      stencil: true,
      framebufferScaleFactor: framebufferScaleFactor,
      antialias: false
    });
    const deviceType = device.deviceType;
    if ((deviceType === DEVICETYPE_WEBGL1 || deviceType === DEVICETYPE_WEBGL2) && window.XRWebGLBinding) {
      try {
        this.webglBinding = new XRWebGLBinding(this._session, device.gl); // eslint-disable-line no-undef
      } catch (ex) {
        this.fire('error', ex);
      }
    }
    this._session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }

  /** @private */
  _onDeviceLost() {
    if (!this._session) return;
    if (this.webglBinding) this.webglBinding = null;
    this._baseLayer = null;
    this._session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }

  /** @private */
  _onDeviceRestored() {
    if (!this._session) return;
    setTimeout(() => {
      this.app.graphicsDevice.gl.makeXRCompatible().then(() => {
        this._createBaseLayer();
      }).catch(ex => {
        this.fire('error', ex);
      });
    }, 0);
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   *
   * @returns {boolean} True if update was successful, false otherwise.
   * @ignore
   */
  update(frame) {
    if (!this._session) return false;

    // canvas resolution should be set on first frame availability or resolution changes
    const width = frame.session.renderState.baseLayer.framebufferWidth;
    const height = frame.session.renderState.baseLayer.framebufferHeight;
    if (this._width !== width || this._height !== height) {
      this._width = width;
      this._height = height;
      this.app.graphicsDevice.setResolution(width, height);
    }
    const pose = frame.getViewerPose(this._referenceSpace);
    if (!pose) return false;
    const lengthOld = this.views.list.length;

    // add views
    this.views.update(frame, pose.views);

    // reset position
    const posePosition = pose.transform.position;
    const poseOrientation = pose.transform.orientation;
    this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);
    this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);

    // update the camera fov properties only when we had 0 views
    if (lengthOld === 0 && this.views.list.length > 0) {
      const viewProjMat = new Mat4();
      const view = this.views.list[0];
      viewProjMat.copy(view.projMat);
      const data = viewProjMat.data;
      const fov = 2.0 * Math.atan(1.0 / data[5]) * 180.0 / Math.PI;
      const aspectRatio = data[5] / data[0];
      const farClip = data[14] / (data[10] + 1);
      const nearClip = data[14] / (data[10] - 1);
      const horizontalFov = false;
      const camera = this._camera.camera;
      camera.setXrProperties({
        aspectRatio,
        farClip,
        fov,
        horizontalFov,
        nearClip
      });
    }

    // position and rotate camera based on calculated vectors
    this._camera.camera._node.setLocalPosition(this._localPosition);
    this._camera.camera._node.setLocalRotation(this._localRotation);
    this.input.update(frame);
    if (this._type === XRTYPE_AR) {
      if (this.hitTest.supported) this.hitTest.update(frame);
      if (this.lightEstimation.supported) this.lightEstimation.update(frame);
      if (this.imageTracking.supported) this.imageTracking.update(frame);
      if (this.anchors.supported) this.anchors.update(frame);
      if (this.planeDetection.supported) this.planeDetection.update(frame);
      if (this.depthSensing.supported) this.depthSensing.update();
      if (this.meshDetection.supported) this.meshDetection.update(frame);
    }
    this.fire('update', frame);
    return true;
  }

  /**
   * True if XR is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if XR session is running.
   *
   * @type {boolean}
   */
  get active() {
    return !!this._session;
  }

  /**
   * Returns type of currently running XR session or null if no session is running. Can be any of
   * XRTYPE_*.
   *
   * @type {string|null}
   */
  get type() {
    return this._type;
  }

  /**
   * Returns reference space type of currently running XR session or null if no session is
   * running. Can be any of XRSPACE_*.
   *
   * @type {string|null}
   */
  get spaceType() {
    return this._spaceType;
  }

  /**
   * Provides access to XRSession of WebXR.
   *
   * @type {object|null}
   */
  get session() {
    return this._session;
  }

  /**
   * Active camera for which XR session is running or null.
   *
   * @type {import('../entity.js').Entity|null}
   */
  get camera() {
    return this._camera ? this._camera.entity : null;
  }

  /**
   * Indicates whether WebXR content is currently visible to the user, and if it is, whether it's
   * the primary focus. Can be 'hidden', 'visible' or 'visible-blurred'.
   *
   * @type {string}
   * @ignore
   */
  get visibilityState() {
    if (!this._session) return null;
    return this._session.visibilityState;
  }
}
/**
 * Fired when availability of the XR type is changed. This event is available in two
 * forms. They are as follows:
 *
 * 1. `available` - Fired when availability of any XR type is changed. The handler is passed
 * the session type that has changed availability and a boolean representing the availability.
 * 2. `available:[type]` - Fired when availability of specific XR type is changed. The handler
 * is passed a boolean representing the availability.
 *
 * @event
 * @example
 * app.xr.on('available', (type, available) => {
 *     console.log(`XR type ${type} is now ${available ? 'available' : 'unavailable'}`);
 * });
 * @example
 * app.xr.on(`available:${pc.XRTYPE_VR}`, (available) => {
 *     console.log(`XR type VR is now ${available ? 'available' : 'unavailable'}`);
 * });
 */
XrManager.EVENT_AVAILABLE = 'available';
/**
 * Fired when XR session is started.
 *
 * @event
 * @example
 * app.xr.on('start', () => {
 *     // XR session has started
 * });
 */
XrManager.EVENT_START = 'start';
/**
 * Fired when XR session is ended.
 *
 * @event
 * @example
 * app.xr.on('end', () => {
 *     // XR session has ended
 * });
 */
XrManager.EVENT_END = 'end';
/**
 * Fired when XR session is updated, providing relevant XRFrame object. The handler is passed
 * [XRFrame](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame) object that can be used
 * for interfacing directly with WebXR APIs.
 *
 * @event
 * @example
 * app.xr.on('update', (frame) => {
 *     console.log('XR frame updated');
 * });
 */
XrManager.EVENT_UPDATE = 'update';
/**
 * Fired when XR session is failed to start or failed to check for session type support. The handler
 * is passed the [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
 * object related to failure of session start or check of session type support.
 *
 * @event
 * @example
 * app.xr.on('error', (error) => {
 *     console.error(error.message);
 * });
 */
XrManager.EVENT_ERROR = 'error';

export { XrManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFhSVFlQRV9JTkxJTkUsIFhSVFlQRV9WUiwgWFJUWVBFX0FSLCBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSwgWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERFVklDRVRZUEVfV0VCR0wxLCBERVZJQ0VUWVBFX1dFQkdMMiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBYckRlcHRoU2Vuc2luZyB9IGZyb20gJy4veHItZGVwdGgtc2Vuc2luZy5qcyc7XG5pbXBvcnQgeyBYckRvbU92ZXJsYXkgfSBmcm9tICcuL3hyLWRvbS1vdmVybGF5LmpzJztcbmltcG9ydCB7IFhySGl0VGVzdCB9IGZyb20gJy4veHItaGl0LXRlc3QuanMnO1xuaW1wb3J0IHsgWHJJbWFnZVRyYWNraW5nIH0gZnJvbSAnLi94ci1pbWFnZS10cmFja2luZy5qcyc7XG5pbXBvcnQgeyBYcklucHV0IH0gZnJvbSAnLi94ci1pbnB1dC5qcyc7XG5pbXBvcnQgeyBYckxpZ2h0RXN0aW1hdGlvbiB9IGZyb20gJy4veHItbGlnaHQtZXN0aW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBYclBsYW5lRGV0ZWN0aW9uIH0gZnJvbSAnLi94ci1wbGFuZS1kZXRlY3Rpb24uanMnO1xuaW1wb3J0IHsgWHJBbmNob3JzIH0gZnJvbSAnLi94ci1hbmNob3JzLmpzJztcbmltcG9ydCB7IFhyTWVzaERldGVjdGlvbiB9IGZyb20gJy4veHItbWVzaC1kZXRlY3Rpb24uanMnO1xuaW1wb3J0IHsgWHJWaWV3cyB9IGZyb20gJy4veHItdmlld3MuanMnO1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFhyTWFuYWdlciNlbmRYcn0gYW5kIHtAbGluayBYck1hbmFnZXIjc3RhcnRYcn0uXG4gKlxuICogQGNhbGxiYWNrIFhyRXJyb3JDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IG9yIG51bGwgaWYgb3BlcmF0aW9uIHdhcyBzdWNjZXNzZnVsLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSBtYW51YWwgcm9vbSBjYXB0dXJpbmcuXG4gKlxuICogQGNhbGxiYWNrIFhyUm9vbUNhcHR1cmVDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IG9yIG51bGwgaWYgbWFudWFsIHJvb20gY2FwdHVyZSB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IFhSXG4gKi9cbmNsYXNzIFhyTWFuYWdlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhdmFpbGFiaWxpdHkgb2YgdGhlIFhSIHR5cGUgaXMgY2hhbmdlZC4gVGhpcyBldmVudCBpcyBhdmFpbGFibGUgaW4gdHdvXG4gICAgICogZm9ybXMuIFRoZXkgYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgYXZhaWxhYmxlYCAtIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIGFueSBYUiB0eXBlIGlzIGNoYW5nZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZFxuICAgICAqIHRoZSBzZXNzaW9uIHR5cGUgdGhhdCBoYXMgY2hhbmdlZCBhdmFpbGFiaWxpdHkgYW5kIGEgYm9vbGVhbiByZXByZXNlbnRpbmcgdGhlIGF2YWlsYWJpbGl0eS5cbiAgICAgKiAyLiBgYXZhaWxhYmxlOlt0eXBlXWAgLSBGaXJlZCB3aGVuIGF2YWlsYWJpbGl0eSBvZiBzcGVjaWZpYyBYUiB0eXBlIGlzIGNoYW5nZWQuIFRoZSBoYW5kbGVyXG4gICAgICogaXMgcGFzc2VkIGEgYm9vbGVhbiByZXByZXNlbnRpbmcgdGhlIGF2YWlsYWJpbGl0eS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdhdmFpbGFibGUnLCAodHlwZSwgYXZhaWxhYmxlKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBYUiB0eXBlICR7dHlwZX0gaXMgbm93ICR7YXZhaWxhYmxlID8gJ2F2YWlsYWJsZScgOiAndW5hdmFpbGFibGUnfWApO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKGBhdmFpbGFibGU6JHtwYy5YUlRZUEVfVlJ9YCwgKGF2YWlsYWJsZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgWFIgdHlwZSBWUiBpcyBub3cgJHthdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZSd9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FWQUlMQUJMRSA9ICdhdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignc3RhcnQnLCAoKSA9PiB7XG4gICAgICogICAgIC8vIFhSIHNlc3Npb24gaGFzIHN0YXJ0ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1RBUlQgPSAnc3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2VuZCcsICgpID0+IHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZW5kZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRU5EID0gJ2VuZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgdXBkYXRlZCwgcHJvdmlkaW5nIHJlbGV2YW50IFhSRnJhbWUgb2JqZWN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWRcbiAgICAgKiBbWFJGcmFtZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hSRnJhbWUpIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkXG4gICAgICogZm9yIGludGVyZmFjaW5nIGRpcmVjdGx5IHdpdGggV2ViWFIgQVBJcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCd1cGRhdGUnLCAoZnJhbWUpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1hSIGZyYW1lIHVwZGF0ZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVVBEQVRFID0gJ3VwZGF0ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuIFRoZSBoYW5kbGVyXG4gICAgICogaXMgcGFzc2VkIHRoZSBbRXJyb3JdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yKVxuICAgICAqIG9iamVjdCByZWxhdGVkIHRvIGZhaWx1cmUgb2Ygc2Vzc2lvbiBzdGFydCBvciBjaGVjayBvZiBzZXNzaW9uIHR5cGUgc3VwcG9ydC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9FUlJPUiA9ICdlcnJvcic7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFwcDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N1cHBvcnRlZCA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISFuYXZpZ2F0b3IueHI7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgYm9vbGVhbj59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXZhaWxhYmxlID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdHlwZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3BhY2VUeXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlNlc3Npb258bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXNzaW9uID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUldlYkdMTGF5ZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iYXNlTGF5ZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xCaW5kaW5nfG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdlYmdsQmluZGluZyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGRlcHRoIHNlbnNpbmcgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRGVwdGhTZW5zaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXB0aFNlbnNpbmc7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gRE9NIG92ZXJsYXkgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRG9tT3ZlcmxheX1cbiAgICAgKi9cbiAgICBkb21PdmVybGF5O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gcGVyZm9ybSBoaXQgdGVzdHMgb24gdGhlIHJlcHJlc2VudGF0aW9uIG9mIHJlYWwgd29ybGQgZ2VvbWV0cnlcbiAgICAgKiBvZiB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJIaXRUZXN0fVxuICAgICAqL1xuICAgIGhpdFRlc3Q7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gaW1hZ2UgdHJhY2tpbmcgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hySW1hZ2VUcmFja2luZ31cbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKi9cbiAgICBwbGFuZURldGVjdGlvbjtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBtZXNoIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJNZXNoRGV0ZWN0aW9ufVxuICAgICAqL1xuICAgIG1lc2hEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqL1xuICAgIGxpZ2h0RXN0aW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byB2aWV3cyBhbmQgdGhlaXIgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyVmlld3N9XG4gICAgICovXG4gICAgdmlld3M7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gQW5jaG9ycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckFuY2hvcnN9XG4gICAgICovXG4gICAgYW5jaG9ycztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYW1lcmEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGhOZWFyID0gMC4xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEZhciA9IDEwMDA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGVpZ2h0ID0gMDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgbWFpbiBhcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG5cbiAgICAgICAgLy8gQWRkIGFsbCB0aGUgc3VwcG9ydGVkIHNlc3Npb24gdHlwZXNcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9JTkxJTkVdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZVtYUlRZUEVfVlJdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZVtYUlRZUEVfQVJdID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy52aWV3cyA9IG5ldyBYclZpZXdzKHRoaXMpO1xuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLm1lc2hEZXRlY3Rpb24gPSBuZXcgWHJNZXNoRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmFuY2hvcnMgPSBuZXcgWHJBbmNob3JzKHRoaXMpO1xuICAgICAgICB0aGlzLnZpZXdzID0gbmV3IFhyVmlld3ModGhpcyk7XG5cbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyAxLiBITUQgY2xhc3Mgd2l0aCBpdHMgcGFyYW1zXG4gICAgICAgIC8vIDIuIFNwYWNlIGNsYXNzXG4gICAgICAgIC8vIDMuIENvbnRyb2xsZXJzIGNsYXNzXG5cbiAgICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgbmF2aWdhdG9yLnhyLmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZWNoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuXG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5vbignZGV2aWNlbG9zdCcsIHRoaXMuX29uRGV2aWNlTG9zdCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5vbignZGV2aWNlcmVzdG9yZWQnLCB0aGlzLl9vbkRldmljZVJlc3RvcmVkLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveSgpIHsgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gc3RhcnQgWFIgc2Vzc2lvbiBmb3IgcHJvdmlkZWQge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYW5kIG9wdGlvbmFsbHkgZmlyZXNcbiAgICAgKiBjYWxsYmFjayB3aGVuIHNlc3Npb24gaXMgY3JlYXRlZCBvciBmYWlsZWQgdG8gY3JlYXRlLiBJbnRlZ3JhdGVkIFhSIEFQSXMgbmVlZCB0byBiZSBlbmFibGVkXG4gICAgICogYnkgcHJvdmlkaW5nIHJlbGV2YW50IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBJdCB3aWxsIGJlXG4gICAgICogdXNlZCB0byByZW5kZXIgWFIgc2Vzc2lvbiBhbmQgbWFuaXB1bGF0ZWQgYmFzZWQgb24gcG9zZSB0cmFja2luZy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0lOTElORX06IElubGluZSAtIGFsd2F5cyBhdmFpbGFibGUgdHlwZSBvZiBzZXNzaW9uLiBJdCBoYXMgbGltaXRlZCBmZWF0dXJlc1xuICAgICAqIGF2YWlsYWJpbGl0eSBhbmQgaXMgcmVuZGVyZWQgaW50byBIVE1MIGVsZW1lbnQuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX1ZSfTogSW1tZXJzaXZlIFZSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIgZGV2aWNlIHdpdGhcbiAgICAgKiBiZXN0IGF2YWlsYWJsZSB0cmFja2luZyBmZWF0dXJlcy5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfQVJ9OiBJbW1lcnNpdmUgQVIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUi9BUiBkZXZpY2VcbiAgICAgKiB0aGF0IGlzIGludGVuZGVkIHRvIGJlIGJsZW5kZWQgd2l0aCByZWFsLXdvcmxkIGVudmlyb25tZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNwYWNlVHlwZSAtIFJlZmVyZW5jZSBzcGFjZSB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1ZJRVdFUn06IFZpZXdlciAtIGFsd2F5cyBzdXBwb3J0ZWQgc3BhY2Ugd2l0aCBzb21lIGJhc2ljIHRyYWNraW5nXG4gICAgICogY2FwYWJpbGl0aWVzLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUx9OiBMb2NhbCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpbiBuZWFyIHRoZVxuICAgICAqIHZpZXdlciBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvciBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMRkxPT1J9OiBMb2NhbCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpblxuICAgICAqIGF0IHRoZSBmbG9vciBpbiBhIHNhZmUgcG9zaXRpb24gZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeSBheGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLlxuICAgICAqIEZsb29yIGxldmVsIHZhbHVlIG1pZ2h0IGJlIGVzdGltYXRlZCBieSB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybS4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvclxuICAgICAqIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfQk9VTkRFREZMT09SfTogQm91bmRlZCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGl0cyBuYXRpdmVcbiAgICAgKiBvcmlnaW4gYXQgdGhlIGZsb29yLCB3aGVyZSB0aGUgdXNlciBpcyBleHBlY3RlZCB0byBtb3ZlIHdpdGhpbiBhIHByZS1lc3RhYmxpc2hlZCBib3VuZGFyeS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1VOQk9VTkRFRH06IFVuYm91bmRlZCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aGVyZSB0aGUgdXNlciBpc1xuICAgICAqIGV4cGVjdGVkIHRvIG1vdmUgZnJlZWx5IGFyb3VuZCB0aGVpciBlbnZpcm9ubWVudCwgcG90ZW50aWFsbHkgbG9uZyBkaXN0YW5jZXMgZnJvbSB0aGVpclxuICAgICAqIHN0YXJ0aW5nIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBmb3IgWFIgc2Vzc2lvbiBpbml0aWFsaXphdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzXSAtIE9wdGlvbmFsIGZlYXR1cmVzIGZvciBYUlNlc3Npb24gc3RhcnQuIEl0IGlzXG4gICAgICogdXNlZCBmb3IgZ2V0dGluZyBhY2Nlc3MgdG8gYWRkaXRpb25hbCBXZWJYUiBzcGVjIGV4dGVuc2lvbnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbmNob3JzXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlXG4gICAgICoge0BsaW5rIFhyQW5jaG9yc30uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pbWFnZVRyYWNraW5nXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlXG4gICAgICoge0BsaW5rIFhySW1hZ2VUcmFja2luZ30uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wbGFuZURldGVjdGlvbl0gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYclBsYW5lRGV0ZWN0aW9ufS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLm1lc2hEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJNZXNoRGV0ZWN0aW9ufS5cbiAgICAgKiBAcGFyYW0ge1hyRXJyb3JDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvblxuICAgICAqIGlzIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmRlcHRoU2Vuc2luZ10gLSBPcHRpb25hbCBvYmplY3Qgd2l0aCBkZXB0aCBzZW5zaW5nIHBhcmFtZXRlcnMgdG9cbiAgICAgKiBhdHRlbXB0IHRvIGVuYWJsZSB7QGxpbmsgWHJEZXB0aFNlbnNpbmd9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlXSAtIE9wdGlvbmFsIHVzYWdlIHByZWZlcmVuY2UgZm9yIGRlcHRoXG4gICAgICogc2Vuc2luZywgY2FuIGJlICdjcHUtb3B0aW1pemVkJyBvciAnZ3B1LW9wdGltaXplZCcgKFhSREVQVEhTRU5TSU5HVVNBR0VfKiksIGRlZmF1bHRzIHRvXG4gICAgICogJ2NwdS1vcHRpbWl6ZWQnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGwgYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmdcbiAgICAgKiBzeXN0ZW0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZV0gLSBPcHRpb25hbCBkYXRhIGZvcm1hdFxuICAgICAqIHByZWZlcmVuY2UgZm9yIGRlcHRoIHNlbnNpbmcsIGNhbiBiZSAnbHVtaW5hbmNlLWFscGhhJyBvciAnZmxvYXQzMidcbiAgICAgKiAoWFJERVBUSFNFTlNJTkdGT1JNQVRfKiksIGRlZmF1bHRzIHRvICdsdW1pbmFuY2UtYWxwaGEnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGxcbiAgICAgKiBiZSBjaG9zZW4gYnkgdGhlIHVuZGVybHlpbmcgZGVwdGggc2Vuc2luZyBzeXN0ZW0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBidXR0b24ub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfVlIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUik7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBidXR0b24ub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfQVIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUiwge1xuICAgICAqICAgICAgICAgYW5jaG9yczogdHJ1ZSxcbiAgICAgKiAgICAgICAgIGltYWdlVHJhY2tpbmc6IHRydWUsXG4gICAgICogICAgICAgICBkZXB0aFNlbnNpbmc6IHsgfVxuICAgICAqICAgICB9KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGFydChjYW1lcmEsIHR5cGUsIHNwYWNlVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgY2FsbGJhY2sgPSBvcHRpb25zO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9hdmFpbGFibGVbdHlwZV0pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBpcyBub3QgYXZhaWxhYmxlJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBzZXNzaW9uIGlzIGFscmVhZHkgc3RhcnRlZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYSA9IGNhbWVyYTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IHRoaXM7XG4gICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlO1xuICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBzcGFjZVR5cGU7XG5cbiAgICAgICAgdGhpcy5fc2V0Q2xpcFBsYW5lcyhjYW1lcmEubmVhckNsaXAsIGNhbWVyYS5mYXJDbGlwKTtcblxuICAgICAgICAvLyBUT0RPXG4gICAgICAgIC8vIG1ha2VYUkNvbXBhdGlibGVcbiAgICAgICAgLy8gc2NlbmFyaW8gdG8gdGVzdDpcbiAgICAgICAgLy8gMS4gYXBwIGlzIHJ1bm5pbmcgb24gaW50ZWdyYXRlZCBHUFVcbiAgICAgICAgLy8gMi4gWFIgZGV2aWNlIGlzIGNvbm5lY3RlZCwgdG8gYW5vdGhlciBHUFVcbiAgICAgICAgLy8gMy4gcHJvYmFibHkgaW1tZXJzaXZlLXZyIHdpbGwgZmFpbCB0byBiZSBjcmVhdGVkXG4gICAgICAgIC8vIDQuIGNhbGwgbWFrZVhSQ29tcGF0aWJsZSwgdmVyeSBsaWtlbHkgd2lsbCBsZWFkIHRvIGNvbnRleHQgbG9zc1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICByZXF1aXJlZEZlYXR1cmVzOiBbc3BhY2VUeXBlXSxcbiAgICAgICAgICAgIG9wdGlvbmFsRmVhdHVyZXM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3Qgd2ViZ2wgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZT8uaXNXZWJHTDEgfHwgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U/LmlzV2ViR0wyO1xuXG4gICAgICAgIGlmICh0eXBlID09PSBYUlRZUEVfQVIpIHtcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdsaWdodC1lc3RpbWF0aW9uJyk7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaGl0LXRlc3QnKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5pbWFnZVRyYWNraW5nICYmIHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdpbWFnZS10cmFja2luZycpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucGxhbmVEZXRlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdwbGFuZS1kZXRlY3Rpb24nKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLm1lc2hEZXRlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdtZXNoLWRldGVjdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5kb21PdmVybGF5LnN1cHBvcnRlZCAmJiB0aGlzLmRvbU92ZXJsYXkucm9vdCkge1xuICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdkb20tb3ZlcmxheScpO1xuICAgICAgICAgICAgICAgIG9wdHMuZG9tT3ZlcmxheSA9IHsgcm9vdDogdGhpcy5kb21PdmVybGF5LnJvb3QgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbmNob3JzICYmIHRoaXMuYW5jaG9ycy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnYW5jaG9ycycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAod2ViZ2wgJiYgb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYUNvbG9yICYmIHRoaXMudmlld3Muc3VwcG9ydGVkQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnY2FtZXJhLWFjY2VzcycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm9wdGlvbmFsRmVhdHVyZXMpXG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMgPSBvcHRzLm9wdGlvbmFsRmVhdHVyZXMuY29uY2F0KG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQgJiYgdGhpcy5pbWFnZVRyYWNraW5nLmltYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuaW1hZ2VUcmFja2luZy5wcmVwYXJlSW1hZ2VzKChlcnIsIHRyYWNrZWRJbWFnZXMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHJhY2tlZEltYWdlcyAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgb3B0cy50cmFja2VkSW1hZ2VzID0gdHJhY2tlZEltYWdlcztcblxuICAgICAgICAgICAgICAgIHRoaXMuX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuXG4gICAgICogQHBhcmFtIHsqfSBvcHRpb25zIC0gU2Vzc2lvbiBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBjYWxsYmFjayAtIEVycm9yIGNhbGxiYWNrLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBuYXZpZ2F0b3IueHIucmVxdWVzdFNlc3Npb24odHlwZSwgb3B0aW9ucykudGhlbigoc2Vzc2lvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5fb25TZXNzaW9uU3RhcnQoc2Vzc2lvbiwgc3BhY2VUeXBlLCBjYWxsYmFjayk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIGVuZCBYUiBzZXNzaW9uIGFuZCBvcHRpb25hbGx5IGZpcmVzIGNhbGxiYWNrIHdoZW4gc2Vzc2lvbiBpcyBlbmRlZCBvciBmYWlsZWQgdG9cbiAgICAgKiBlbmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1hyRXJyb3JDYWxsYmFja30gW2NhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb24gaXNcbiAgICAgKiBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAqICAgICBpZiAoZXZ0LmtleSA9PT0gcGMuS0VZX0VTQ0FQRSAmJiBhcHAueHIuYWN0aXZlKSB7XG4gICAgICogICAgICAgICBhcHAueHIuZW5kKCk7XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBlbmQoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ldyBFcnJvcignWFIgU2Vzc2lvbiBpcyBub3QgaW5pdGlhbGl6ZWQnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndlYmdsQmluZGluZyA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB0aGlzLm9uY2UoJ2VuZCcsIGNhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uLmVuZCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHNwZWNpZmljIHR5cGUgb2Ygc2Vzc2lvbiBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0lOTElORX06IElubGluZSAtIGFsd2F5cyBhdmFpbGFibGUgdHlwZSBvZiBzZXNzaW9uLiBJdCBoYXMgbGltaXRlZCBmZWF0dXJlc1xuICAgICAqIGF2YWlsYWJpbGl0eSBhbmQgaXMgcmVuZGVyZWQgaW50byBIVE1MIGVsZW1lbnQuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX1ZSfTogSW1tZXJzaXZlIFZSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIgZGV2aWNlIHdpdGhcbiAgICAgKiBiZXN0IGF2YWlsYWJsZSB0cmFja2luZyBmZWF0dXJlcy5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfQVJ9OiBJbW1lcnNpdmUgQVIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUi9BUiBkZXZpY2VcbiAgICAgKiB0aGF0IGlzIGludGVuZGVkIHRvIGJlIGJsZW5kZWQgd2l0aCByZWFsLXdvcmxkIGVudmlyb25tZW50LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAoYXBwLnhyLmlzQXZhaWxhYmxlKHBjLlhSVFlQRV9WUikpIHtcbiAgICAgKiAgICAgLy8gVlIgaXMgYXZhaWxhYmxlXG4gICAgICogfVxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHNwZWNpZmllZCBzZXNzaW9uIHR5cGUgaXMgYXZhaWxhYmxlLlxuICAgICAqL1xuICAgIGlzQXZhaWxhYmxlKHR5cGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F2YWlsYWJsZVt0eXBlXTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2F2YWlsYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvblN1cHBvcnRDaGVjayhrZXkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhdGUgbWFudWFsIHJvb20gY2FwdHVyZS4gSWYgdGhlIHVuZGVybHlpbmcgWFIgc3lzdGVtIHN1cHBvcnRzIG1hbnVhbCBjYXB0dXJlIG9mIHRoZVxuICAgICAqIHJvb20sIGl0IHdpbGwgc3RhcnQgdGhlIGNhcHR1cmluZyBwcm9jZXNzLCB3aGljaCBjYW4gYWZmZWN0IHBsYW5lIGFuZCBtZXNoIGRldGVjdGlvbixcbiAgICAgKiBhbmQgaW1wcm92ZSBoaXQtdGVzdCBxdWFsaXR5IGFnYWluc3QgcmVhbC13b3JsZCBnZW9tZXRyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJSb29tQ2FwdHVyZUNhbGxiYWNrfSBjYWxsYmFjayAtIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBmaXJlZCBvbmNlIGNhcHR1cmUgaXMgY29tcGxldGVcbiAgICAgKiBvciBmYWlsZWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMuYXBwLnhyLmluaXRpYXRlUm9vbUNhcHR1cmUoKGVycikgPT4ge1xuICAgICAqICAgICBpZiAoZXJyKSB7XG4gICAgICogICAgICAgICAvLyBjYXB0dXJlIGZhaWxlZFxuICAgICAqICAgICAgICAgcmV0dXJuO1xuICAgICAqICAgICB9XG4gICAgICogICAgIC8vIGNhcHR1cmUgd2FzIHN1Y2Nlc3NmdWxcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbml0aWF0ZVJvb21DYXB0dXJlKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdTZXNzaW9uIGlzIG5vdCBhY3RpdmUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uLmluaXRpYXRlUm9vbUNhcHR1cmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG5ldyBFcnJvcignU2Vzc2lvbiBkb2VzIG5vdCBzdXBwb3J0IG1hbnVhbCByb29tIGNhcHR1cmUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXNzaW9uLmluaXRpYXRlUm9vbUNhcHR1cmUoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2Vzc2lvblN1cHBvcnRDaGVjayh0eXBlKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5pc1Nlc3Npb25TdXBwb3J0ZWQodHlwZSkudGhlbigoYXZhaWxhYmxlKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXZhaWxhYmxlW3R5cGVdID09PSBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB0aGlzLl9hdmFpbGFibGVbdHlwZV0gPSBhdmFpbGFibGU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2F2YWlsYWJsZScsIHR5cGUsIGF2YWlsYWJsZSk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2F2YWlsYWJsZTonICsgdHlwZSwgYXZhaWxhYmxlKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSU2Vzc2lvbn0gc2Vzc2lvbiAtIFhSIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNwYWNlVHlwZSAtIFNwYWNlIHR5cGUgdG8gcmVxdWVzdCBmb3IgdGhlIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayB0byBjYWxsIHdoZW4gc2Vzc2lvbiBpcyBzdGFydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KHNlc3Npb24sIHNwYWNlVHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgbGV0IGZhaWxlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24gPSBzZXNzaW9uO1xuXG4gICAgICAgIGNvbnN0IG9uVmlzaWJpbGl0eUNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgndmlzaWJpbGl0eTpjaGFuZ2UnLCBzZXNzaW9uLnZpc2liaWxpdHlTdGF0ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3Qgb25DbGlwUGxhbmVzQ2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2xpcFBsYW5lcyh0aGlzLl9jYW1lcmEubmVhckNsaXAsIHRoaXMuX2NhbWVyYS5mYXJDbGlwKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBjbGVhbiB1cCBvbmNlIHNlc3Npb24gaXMgZW5kZWRcbiAgICAgICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLm9mZignc2V0X25lYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmEub2ZmKCdzZXRfZmFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgICAgICBzZXNzaW9uLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpO1xuXG4gICAgICAgICAgICBpZiAoIWZhaWxlZCkgdGhpcy5maXJlKCdlbmQnKTtcblxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSAwO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcC5zeXN0ZW1zKVxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZCcsIG9uRW5kKTtcbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5vbignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuXG4gICAgICAgIC8vIEEgZnJhbWVidWZmZXJTY2FsZUZhY3RvciBzY2FsZSBvZiAxIGlzIHRoZSBmdWxsIHJlc29sdXRpb24gb2YgdGhlIGRpc3BsYXlcbiAgICAgICAgLy8gc28gd2UgbmVlZCB0byBjYWxjdWxhdGUgdGhpcyBiYXNlZCBvbiBkZXZpY2VQaXhlbFJhdGlvIG9mIHRoZSBkaXNsYXkgYW5kIHdoYXRcbiAgICAgICAgLy8gd2UndmUgc2V0IHRoaXMgaW4gdGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAgICBEZWJ1Zy5hc3NlcnQod2luZG93LCAnd2luZG93IGlzIG5lZWRlZCB0byBzY2FsZSB0aGUgWFIgZnJhbWVidWZmZXIuIEFyZSB5b3UgcnVubmluZyBYUiBoZWFkbGVzcz8nKTtcblxuICAgICAgICB0aGlzLl9jcmVhdGVCYXNlTGF5ZXIoKTtcblxuICAgICAgICAvLyByZXF1ZXN0IHJlZmVyZW5jZSBzcGFjZVxuICAgICAgICBzZXNzaW9uLnJlcXVlc3RSZWZlcmVuY2VTcGFjZShzcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IHJlZmVyZW5jZVNwYWNlO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnc3RhcnQnKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2Vzc2lvbi5lbmQoKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBOZWFyIHBsYW5lIGRpc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYXIgLSBGYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2xpcFBsYW5lcyhuZWFyLCBmYXIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlcHRoTmVhciA9PT0gbmVhciAmJiB0aGlzLl9kZXB0aEZhciA9PT0gZmFyKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2RlcHRoTmVhciA9IG5lYXI7XG4gICAgICAgIHRoaXMuX2RlcHRoRmFyID0gZmFyO1xuXG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBpZiBzZXNzaW9uIGlzIGF2YWlsYWJsZSxcbiAgICAgICAgLy8gcXVldWUgdXAgcmVuZGVyIHN0YXRlIHVwZGF0ZVxuICAgICAgICB0aGlzLl9zZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF9jcmVhdGVCYXNlTGF5ZXIoKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBjb25zdCBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yID0gZGV2aWNlLm1heFBpeGVsUmF0aW8gLyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcblxuICAgICAgICB0aGlzLl9iYXNlTGF5ZXIgPSBuZXcgWFJXZWJHTExheWVyKHRoaXMuX3Nlc3Npb24sIGRldmljZS5nbCwge1xuICAgICAgICAgICAgYWxwaGE6IHRydWUsXG4gICAgICAgICAgICBkZXB0aDogdHJ1ZSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IHRydWUsXG4gICAgICAgICAgICBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yOiBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yLFxuICAgICAgICAgICAgYW50aWFsaWFzOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZXZpY2VUeXBlID0gZGV2aWNlLmRldmljZVR5cGU7XG4gICAgICAgIGlmICgoZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHTDEgfHwgZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHTDIpICYmIHdpbmRvdy5YUldlYkdMQmluZGluZykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLndlYmdsQmluZGluZyA9IG5ldyBYUldlYkdMQmluZGluZyh0aGlzLl9zZXNzaW9uLCBkZXZpY2UuZ2wpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGJhc2VMYXllcjogdGhpcy5fYmFzZUxheWVyLFxuICAgICAgICAgICAgZGVwdGhOZWFyOiB0aGlzLl9kZXB0aE5lYXIsXG4gICAgICAgICAgICBkZXB0aEZhcjogdGhpcy5fZGVwdGhGYXJcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uRGV2aWNlTG9zdCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsQmluZGluZylcbiAgICAgICAgICAgIHRoaXMud2ViZ2xCaW5kaW5nID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9iYXNlTGF5ZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgYmFzZUxheWVyOiB0aGlzLl9iYXNlTGF5ZXIsXG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25EZXZpY2VSZXN0b3JlZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UuZ2wubWFrZVhSQ29tcGF0aWJsZSgpXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVCYXNlTGF5ZXIoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgMCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB1cGRhdGUgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIGNhbnZhcyByZXNvbHV0aW9uIHNob3VsZCBiZSBzZXQgb24gZmlyc3QgZnJhbWUgYXZhaWxhYmlsaXR5IG9yIHJlc29sdXRpb24gY2hhbmdlc1xuICAgICAgICBjb25zdCB3aWR0aCA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVySGVpZ2h0O1xuICAgICAgICBpZiAodGhpcy5fd2lkdGggIT09IHdpZHRoIHx8IHRoaXMuX2hlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uuc2V0UmVzb2x1dGlvbih3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBvc2UgPSBmcmFtZS5nZXRWaWV3ZXJQb3NlKHRoaXMuX3JlZmVyZW5jZVNwYWNlKTtcblxuICAgICAgICBpZiAoIXBvc2UpIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBsZW5ndGhPbGQgPSB0aGlzLnZpZXdzLmxpc3QubGVuZ3RoO1xuXG4gICAgICAgIC8vIGFkZCB2aWV3c1xuICAgICAgICB0aGlzLnZpZXdzLnVwZGF0ZShmcmFtZSwgcG9zZS52aWV3cyk7XG5cbiAgICAgICAgLy8gcmVzZXQgcG9zaXRpb25cbiAgICAgICAgY29uc3QgcG9zZVBvc2l0aW9uID0gcG9zZS50cmFuc2Zvcm0ucG9zaXRpb247XG4gICAgICAgIGNvbnN0IHBvc2VPcmllbnRhdGlvbiA9IHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uO1xuICAgICAgICB0aGlzLl9sb2NhbFBvc2l0aW9uLnNldChwb3NlUG9zaXRpb24ueCwgcG9zZVBvc2l0aW9uLnksIHBvc2VQb3NpdGlvbi56KTtcbiAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbi5zZXQocG9zZU9yaWVudGF0aW9uLngsIHBvc2VPcmllbnRhdGlvbi55LCBwb3NlT3JpZW50YXRpb24ueiwgcG9zZU9yaWVudGF0aW9uLncpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgY2FtZXJhIGZvdiBwcm9wZXJ0aWVzIG9ubHkgd2hlbiB3ZSBoYWQgMCB2aWV3c1xuICAgICAgICBpZiAobGVuZ3RoT2xkID09PSAwICYmIHRoaXMudmlld3MubGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy52aWV3cy5saXN0WzBdO1xuXG4gICAgICAgICAgICB2aWV3UHJvak1hdC5jb3B5KHZpZXcucHJvak1hdCk7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdmlld1Byb2pNYXQuZGF0YTtcblxuICAgICAgICAgICAgY29uc3QgZm92ID0gKDIuMCAqIE1hdGguYXRhbigxLjAgLyBkYXRhWzVdKSAqIDE4MC4wKSAvIE1hdGguUEk7XG4gICAgICAgICAgICBjb25zdCBhc3BlY3RSYXRpbyA9IGRhdGFbNV0gLyBkYXRhWzBdO1xuICAgICAgICAgICAgY29uc3QgZmFyQ2xpcCA9IGRhdGFbMTRdIC8gKGRhdGFbMTBdICsgMSk7XG4gICAgICAgICAgICBjb25zdCBuZWFyQ2xpcCA9IGRhdGFbMTRdIC8gKGRhdGFbMTBdIC0gMSk7XG4gICAgICAgICAgICBjb25zdCBob3Jpem9udGFsRm92ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuX2NhbWVyYS5jYW1lcmE7XG4gICAgICAgICAgICBjYW1lcmEuc2V0WHJQcm9wZXJ0aWVzKHtcbiAgICAgICAgICAgICAgICBhc3BlY3RSYXRpbyxcbiAgICAgICAgICAgICAgICBmYXJDbGlwLFxuICAgICAgICAgICAgICAgIGZvdixcbiAgICAgICAgICAgICAgICBob3Jpem9udGFsRm92LFxuICAgICAgICAgICAgICAgIG5lYXJDbGlwXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGUgY2FtZXJhIGJhc2VkIG9uIGNhbGN1bGF0ZWQgdmVjdG9yc1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLl9ub2RlLnNldExvY2FsUG9zaXRpb24odGhpcy5fbG9jYWxQb3NpdGlvbik7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEuX25vZGUuc2V0TG9jYWxSb3RhdGlvbih0aGlzLl9sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICB0aGlzLmlucHV0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFhSVFlQRV9BUikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaGl0VGVzdC5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5oaXRUZXN0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmxpZ2h0RXN0aW1hdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodEVzdGltYXRpb24udXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmFuY2hvcnMuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuYW5jaG9ycy51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wbGFuZURldGVjdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbi51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kZXB0aFNlbnNpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5tZXNoRGV0ZWN0aW9uLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2hEZXRlY3Rpb24udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgndXBkYXRlJywgZnJhbWUpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFhSIHNlc3Npb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBhY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2ZcbiAgICAgKiBYUlRZUEVfKi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyByZWZlcmVuY2Ugc3BhY2UgdHlwZSBvZiBjdXJyZW50bHkgcnVubmluZyBYUiBzZXNzaW9uIG9yIG51bGwgaWYgbm8gc2Vzc2lvbiBpc1xuICAgICAqIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2YgWFJTUEFDRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCBzcGFjZVR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGFjZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIFhSU2Vzc2lvbiBvZiBXZWJYUi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgc2Vzc2lvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZlIGNhbWVyYSBmb3Igd2hpY2ggWFIgc2Vzc2lvbiBpcyBydW5uaW5nIG9yIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgY2FtZXJhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhID8gdGhpcy5fY2FtZXJhLmVudGl0eSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5kaWNhdGVzIHdoZXRoZXIgV2ViWFIgY29udGVudCBpcyBjdXJyZW50bHkgdmlzaWJsZSB0byB0aGUgdXNlciwgYW5kIGlmIGl0IGlzLCB3aGV0aGVyIGl0J3NcbiAgICAgKiB0aGUgcHJpbWFyeSBmb2N1cy4gQ2FuIGJlICdoaWRkZW4nLCAndmlzaWJsZScgb3IgJ3Zpc2libGUtYmx1cnJlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdmlzaWJpbGl0eVN0YXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYck1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJYck1hbmFnZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJuYXZpZ2F0b3IiLCJ4ciIsIl9hdmFpbGFibGUiLCJfdHlwZSIsIl9zcGFjZVR5cGUiLCJfc2Vzc2lvbiIsIl9iYXNlTGF5ZXIiLCJ3ZWJnbEJpbmRpbmciLCJfcmVmZXJlbmNlU3BhY2UiLCJkZXB0aFNlbnNpbmciLCJkb21PdmVybGF5IiwiaGl0VGVzdCIsImltYWdlVHJhY2tpbmciLCJwbGFuZURldGVjdGlvbiIsIm1lc2hEZXRlY3Rpb24iLCJpbnB1dCIsImxpZ2h0RXN0aW1hdGlvbiIsInZpZXdzIiwiYW5jaG9ycyIsIl9jYW1lcmEiLCJfbG9jYWxQb3NpdGlvbiIsIlZlYzMiLCJfbG9jYWxSb3RhdGlvbiIsIlF1YXQiLCJfZGVwdGhOZWFyIiwiX2RlcHRoRmFyIiwiX3dpZHRoIiwiX2hlaWdodCIsIlhSVFlQRV9JTkxJTkUiLCJYUlRZUEVfVlIiLCJYUlRZUEVfQVIiLCJYclZpZXdzIiwiWHJEZXB0aFNlbnNpbmciLCJYckRvbU92ZXJsYXkiLCJYckhpdFRlc3QiLCJYckltYWdlVHJhY2tpbmciLCJYclBsYW5lRGV0ZWN0aW9uIiwiWHJNZXNoRGV0ZWN0aW9uIiwiWHJJbnB1dCIsIlhyTGlnaHRFc3RpbWF0aW9uIiwiWHJBbmNob3JzIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjayIsImdyYXBoaWNzRGV2aWNlIiwib24iLCJfb25EZXZpY2VMb3N0IiwiX29uRGV2aWNlUmVzdG9yZWQiLCJkZXN0cm95Iiwic3RhcnQiLCJjYW1lcmEiLCJ0eXBlIiwic3BhY2VUeXBlIiwib3B0aW9ucyIsIl90aGlzJGFwcCRncmFwaGljc0RldiIsIl90aGlzJGFwcCRncmFwaGljc0RldjIiLCJjYWxsYmFjayIsIkVycm9yIiwiX3NldENsaXBQbGFuZXMiLCJuZWFyQ2xpcCIsImZhckNsaXAiLCJvcHRzIiwicmVxdWlyZWRGZWF0dXJlcyIsIm9wdGlvbmFsRmVhdHVyZXMiLCJ3ZWJnbCIsImlzV2ViR0wxIiwiaXNXZWJHTDIiLCJwdXNoIiwic3VwcG9ydGVkIiwicm9vdCIsInVzYWdlUHJlZmVyZW5jZSIsIlhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVIiwiZGF0YUZvcm1hdFByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSIsInVuc2hpZnQiLCJjYW1lcmFDb2xvciIsInN1cHBvcnRlZENvbG9yIiwiY29uY2F0IiwiaW1hZ2VzIiwibGVuZ3RoIiwicHJlcGFyZUltYWdlcyIsImVyciIsInRyYWNrZWRJbWFnZXMiLCJmaXJlIiwiX29uU3RhcnRPcHRpb25zUmVhZHkiLCJyZXF1ZXN0U2Vzc2lvbiIsInRoZW4iLCJzZXNzaW9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiY2F0Y2giLCJleCIsImVuZCIsIm9uY2UiLCJpc0F2YWlsYWJsZSIsImtleSIsIl9zZXNzaW9uU3VwcG9ydENoZWNrIiwiaW5pdGlhdGVSb29tQ2FwdHVyZSIsImlzU2Vzc2lvblN1cHBvcnRlZCIsImF2YWlsYWJsZSIsImZhaWxlZCIsIm9uVmlzaWJpbGl0eUNoYW5nZSIsInZpc2liaWxpdHlTdGF0ZSIsIm9uQ2xpcFBsYW5lc0NoYW5nZSIsIm9uRW5kIiwib2ZmIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInN5c3RlbXMiLCJ0aWNrIiwiRGVidWciLCJhc3NlcnQiLCJ3aW5kb3ciLCJfY3JlYXRlQmFzZUxheWVyIiwicmVxdWVzdFJlZmVyZW5jZVNwYWNlIiwicmVmZXJlbmNlU3BhY2UiLCJuZWFyIiwiZmFyIiwidXBkYXRlUmVuZGVyU3RhdGUiLCJkZXB0aE5lYXIiLCJkZXB0aEZhciIsImRldmljZSIsImZyYW1lYnVmZmVyU2NhbGVGYWN0b3IiLCJtYXhQaXhlbFJhdGlvIiwiZGV2aWNlUGl4ZWxSYXRpbyIsIlhSV2ViR0xMYXllciIsImdsIiwiYWxwaGEiLCJkZXB0aCIsInN0ZW5jaWwiLCJhbnRpYWxpYXMiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHTDEiLCJERVZJQ0VUWVBFX1dFQkdMMiIsIlhSV2ViR0xCaW5kaW5nIiwiYmFzZUxheWVyIiwic2V0VGltZW91dCIsIm1ha2VYUkNvbXBhdGlibGUiLCJ1cGRhdGUiLCJmcmFtZSIsIndpZHRoIiwicmVuZGVyU3RhdGUiLCJmcmFtZWJ1ZmZlcldpZHRoIiwiaGVpZ2h0IiwiZnJhbWVidWZmZXJIZWlnaHQiLCJzZXRSZXNvbHV0aW9uIiwicG9zZSIsImdldFZpZXdlclBvc2UiLCJsZW5ndGhPbGQiLCJsaXN0IiwicG9zZVBvc2l0aW9uIiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJwb3NlT3JpZW50YXRpb24iLCJvcmllbnRhdGlvbiIsInNldCIsIngiLCJ5IiwieiIsInciLCJ2aWV3UHJvak1hdCIsIk1hdDQiLCJ2aWV3IiwiY29weSIsInByb2pNYXQiLCJkYXRhIiwiZm92IiwiTWF0aCIsImF0YW4iLCJQSSIsImFzcGVjdFJhdGlvIiwiaG9yaXpvbnRhbEZvdiIsInNldFhyUHJvcGVydGllcyIsIl9ub2RlIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldExvY2FsUm90YXRpb24iLCJhY3RpdmUiLCJlbnRpdHkiLCJFVkVOVF9BVkFJTEFCTEUiLCJFVkVOVF9TVEFSVCIsIkVWRU5UX0VORCIsIkVWRU5UX1VQREFURSIsIkVWRU5UX0VSUk9SIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBcUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxTQUFTQyxZQUFZLENBQUM7QUE4T2pDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7QUFDYixJQUFBLEtBQUssRUFBRSxDQUFBO0FBL0tYO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFBLEdBQUcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVIO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsVUFBVSxHQUFHQyxRQUFRLENBQUNDLE9BQU8sSUFBSSxDQUFDLENBQUNDLFNBQVMsQ0FBQ0MsRUFBRSxDQUFBO0FBRS9DO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUVmO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUVaO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsVUFBVSxHQUFHLElBQUksQ0FBQTtBQUVqQjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFFZjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFFakI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5CO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUV0QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxVQUFVLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFVjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVA7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLGVBQWUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVmO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUw7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxPQUFPLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUDtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFFZDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxjQUFjLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFFM0I7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsY0FBYyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBRTNCO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsVUFBVSxHQUFHLEdBQUcsQ0FBQTtBQUVoQjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFNBQVMsR0FBRyxJQUFJLENBQUE7QUFFaEI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBRVY7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxPQUFPLEdBQUcsQ0FBQyxDQUFBO0lBV1AsSUFBSSxDQUFDL0IsR0FBRyxHQUFHQSxHQUFHLENBQUE7O0FBRWQ7QUFDQSxJQUFBLElBQUksQ0FBQ00sVUFBVSxDQUFDMEIsYUFBYSxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3RDLElBQUEsSUFBSSxDQUFDMUIsVUFBVSxDQUFDMkIsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ2xDLElBQUEsSUFBSSxDQUFDM0IsVUFBVSxDQUFDNEIsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBRWxDLElBQUEsSUFBSSxDQUFDYixLQUFLLEdBQUcsSUFBSWMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQzlCLElBQUEsSUFBSSxDQUFDdEIsWUFBWSxHQUFHLElBQUl1QixjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDNUMsSUFBQSxJQUFJLENBQUN0QixVQUFVLEdBQUcsSUFBSXVCLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQ3RCLE9BQU8sR0FBRyxJQUFJdUIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2xDLElBQUEsSUFBSSxDQUFDdEIsYUFBYSxHQUFHLElBQUl1QixlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUN0QixjQUFjLEdBQUcsSUFBSXVCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDdEIsYUFBYSxHQUFHLElBQUl1QixlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUN0QixLQUFLLEdBQUcsSUFBSXVCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM5QixJQUFBLElBQUksQ0FBQ3RCLGVBQWUsR0FBRyxJQUFJdUIsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDbEQsSUFBQSxJQUFJLENBQUNyQixPQUFPLEdBQUcsSUFBSXNCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNsQyxJQUFBLElBQUksQ0FBQ3ZCLEtBQUssR0FBRyxJQUFJYyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBOztJQUVBLElBQUksSUFBSSxDQUFDbEMsVUFBVSxFQUFFO0FBQ2pCRyxNQUFBQSxTQUFTLENBQUNDLEVBQUUsQ0FBQ3dDLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxNQUFNO1FBQ2hELElBQUksQ0FBQ0Msd0JBQXdCLEVBQUUsQ0FBQTtBQUNuQyxPQUFDLENBQUMsQ0FBQTtNQUNGLElBQUksQ0FBQ0Esd0JBQXdCLEVBQUUsQ0FBQTtBQUUvQixNQUFBLElBQUksQ0FBQzlDLEdBQUcsQ0FBQytDLGNBQWMsQ0FBQ0MsRUFBRSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNsRSxNQUFBLElBQUksQ0FBQ2pELEdBQUcsQ0FBQytDLGNBQWMsQ0FBQ0MsRUFBRSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQ0UsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDOUUsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxPQUFPQSxHQUFHLEVBQUU7O0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLEtBQUtBLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRTtJQUFBLElBQUFDLHFCQUFBLEVBQUFDLHNCQUFBLENBQUE7SUFDcEMsSUFBSUMsUUFBUSxHQUFHSCxPQUFPLENBQUE7SUFFdEIsSUFBSSxPQUFPQSxPQUFPLEtBQUssUUFBUSxFQUMzQkcsUUFBUSxHQUFHSCxPQUFPLENBQUNHLFFBQVEsQ0FBQTtBQUUvQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNyRCxVQUFVLENBQUNnRCxJQUFJLENBQUMsRUFBRTtNQUN4QixJQUFJSyxRQUFRLEVBQUVBLFFBQVEsQ0FBQyxJQUFJQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFBO0FBQ3hELE1BQUEsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ25ELFFBQVEsRUFBRTtNQUNmLElBQUlrRCxRQUFRLEVBQUVBLFFBQVEsQ0FBQyxJQUFJQyxLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFBO0FBQ2xFLE1BQUEsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUNyQyxPQUFPLEdBQUc4QixNQUFNLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUM5QixPQUFPLENBQUM4QixNQUFNLENBQUNoRCxFQUFFLEdBQUcsSUFBSSxDQUFBO0lBQzdCLElBQUksQ0FBQ0UsS0FBSyxHQUFHK0MsSUFBSSxDQUFBO0lBQ2pCLElBQUksQ0FBQzlDLFVBQVUsR0FBRytDLFNBQVMsQ0FBQTtJQUUzQixJQUFJLENBQUNNLGNBQWMsQ0FBQ1IsTUFBTSxDQUFDUyxRQUFRLEVBQUVULE1BQU0sQ0FBQ1UsT0FBTyxDQUFDLENBQUE7O0FBRXBEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLElBQUEsTUFBTUMsSUFBSSxHQUFHO01BQ1RDLGdCQUFnQixFQUFFLENBQUNWLFNBQVMsQ0FBQztBQUM3QlcsTUFBQUEsZ0JBQWdCLEVBQUUsRUFBQTtLQUNyQixDQUFBO0lBRUQsTUFBTUMsS0FBSyxHQUFHLENBQUEsQ0FBQVYscUJBQUEsR0FBQSxJQUFJLENBQUN6RCxHQUFHLENBQUMrQyxjQUFjLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUF2QlUscUJBQUEsQ0FBeUJXLFFBQVEsTUFBQVYsQ0FBQUEsc0JBQUEsR0FBSSxJQUFJLENBQUMxRCxHQUFHLENBQUMrQyxjQUFjLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUF2Qlcsc0JBQUEsQ0FBeUJXLFFBQVEsQ0FBQSxDQUFBO0lBRXBGLElBQUlmLElBQUksS0FBS3BCLFNBQVMsRUFBRTtBQUNwQjhCLE1BQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0FBQzlDTixNQUFBQSxJQUFJLENBQUNFLGdCQUFnQixDQUFDSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUE7QUFFdEMsTUFBQSxJQUFJZCxPQUFPLEVBQUU7QUFDVCxRQUFBLElBQUlBLE9BQU8sQ0FBQ3hDLGFBQWEsSUFBSSxJQUFJLENBQUNBLGFBQWEsQ0FBQ3VELFNBQVMsRUFDckRQLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO1FBRWhELElBQUlkLE9BQU8sQ0FBQ3ZDLGNBQWMsRUFDdEIrQyxJQUFJLENBQUNFLGdCQUFnQixDQUFDSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtRQUVqRCxJQUFJZCxPQUFPLENBQUN0QyxhQUFhLEVBQ3JCOEMsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0ksSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUE7QUFDcEQsT0FBQTtNQUVBLElBQUksSUFBSSxDQUFDeEQsVUFBVSxDQUFDeUQsU0FBUyxJQUFJLElBQUksQ0FBQ3pELFVBQVUsQ0FBQzBELElBQUksRUFBRTtBQUNuRFIsUUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0ksSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQ3pDTixJQUFJLENBQUNsRCxVQUFVLEdBQUc7QUFBRTBELFVBQUFBLElBQUksRUFBRSxJQUFJLENBQUMxRCxVQUFVLENBQUMwRCxJQUFBQTtTQUFNLENBQUE7QUFDcEQsT0FBQTtNQUVBLElBQUloQixPQUFPLElBQUlBLE9BQU8sQ0FBQ2xDLE9BQU8sSUFBSSxJQUFJLENBQUNBLE9BQU8sQ0FBQ2lELFNBQVMsRUFBRTtBQUN0RFAsUUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0ksSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBQ3pDLE9BQUE7TUFFQSxJQUFJZCxPQUFPLElBQUlBLE9BQU8sQ0FBQzNDLFlBQVksSUFBSSxJQUFJLENBQUNBLFlBQVksQ0FBQzBELFNBQVMsRUFBRTtBQUNoRVAsUUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0ksSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFBO0FBRTNDLFFBQUEsTUFBTUcsZUFBZSxHQUFHLENBQUNDLHVCQUF1QixDQUFDLENBQUE7QUFDakQsUUFBQSxNQUFNQyxvQkFBb0IsR0FBRyxDQUFDQyx5QkFBeUIsQ0FBQyxDQUFBO0FBRXhELFFBQUEsSUFBSXBCLE9BQU8sQ0FBQzNDLFlBQVksQ0FBQzRELGVBQWUsRUFBRTtVQUN0QyxNQUFNSSxHQUFHLEdBQUdKLGVBQWUsQ0FBQ0ssT0FBTyxDQUFDdEIsT0FBTyxDQUFDM0MsWUFBWSxDQUFDNEQsZUFBZSxDQUFDLENBQUE7QUFDekUsVUFBQSxJQUFJSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUVKLGVBQWUsQ0FBQ00sTUFBTSxDQUFDRixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7VUFDOUNKLGVBQWUsQ0FBQ08sT0FBTyxDQUFDeEIsT0FBTyxDQUFDM0MsWUFBWSxDQUFDNEQsZUFBZSxDQUFDLENBQUE7QUFDakUsU0FBQTtBQUVBLFFBQUEsSUFBSWpCLE9BQU8sQ0FBQzNDLFlBQVksQ0FBQzhELG9CQUFvQixFQUFFO1VBQzNDLE1BQU1FLEdBQUcsR0FBR0Ysb0JBQW9CLENBQUNHLE9BQU8sQ0FBQ3RCLE9BQU8sQ0FBQzNDLFlBQVksQ0FBQzhELG9CQUFvQixDQUFDLENBQUE7QUFDbkYsVUFBQSxJQUFJRSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUVGLG9CQUFvQixDQUFDSSxNQUFNLENBQUNGLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQTtVQUNuREYsb0JBQW9CLENBQUNLLE9BQU8sQ0FBQ3hCLE9BQU8sQ0FBQzNDLFlBQVksQ0FBQzhELG9CQUFvQixDQUFDLENBQUE7QUFDM0UsU0FBQTtRQUVBWCxJQUFJLENBQUNuRCxZQUFZLEdBQUc7QUFDaEI0RCxVQUFBQSxlQUFlLEVBQUVBLGVBQWU7QUFDaENFLFVBQUFBLG9CQUFvQixFQUFFQSxvQkFBQUE7U0FDekIsQ0FBQTtBQUNMLE9BQUE7QUFFQSxNQUFBLElBQUlSLEtBQUssSUFBSVgsT0FBTyxJQUFJQSxPQUFPLENBQUN5QixXQUFXLElBQUksSUFBSSxDQUFDNUQsS0FBSyxDQUFDNkQsY0FBYyxFQUFFO0FBQ3RFbEIsUUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0ksSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFBO0FBQy9DLE9BQUE7QUFDSixLQUFBO0FBRUFOLElBQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQTtBQUUzQyxJQUFBLElBQUlkLE9BQU8sSUFBSUEsT0FBTyxDQUFDVSxnQkFBZ0IsRUFDbkNGLElBQUksQ0FBQ0UsZ0JBQWdCLEdBQUdGLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNpQixNQUFNLENBQUMzQixPQUFPLENBQUNVLGdCQUFnQixDQUFDLENBQUE7QUFFbEYsSUFBQSxJQUFJLElBQUksQ0FBQ2xELGFBQWEsQ0FBQ3VELFNBQVMsSUFBSSxJQUFJLENBQUN2RCxhQUFhLENBQUNvRSxNQUFNLENBQUNDLE1BQU0sRUFBRTtNQUNsRSxJQUFJLENBQUNyRSxhQUFhLENBQUNzRSxhQUFhLENBQUMsQ0FBQ0MsR0FBRyxFQUFFQyxhQUFhLEtBQUs7QUFDckQsUUFBQSxJQUFJRCxHQUFHLEVBQUU7QUFDTCxVQUFBLElBQUk1QixRQUFRLEVBQUVBLFFBQVEsQ0FBQzRCLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLFVBQUEsSUFBSSxDQUFDRSxJQUFJLENBQUMsT0FBTyxFQUFFRixHQUFHLENBQUMsQ0FBQTtBQUN2QixVQUFBLE9BQUE7QUFDSixTQUFBO1FBRUEsSUFBSUMsYUFBYSxLQUFLLElBQUksRUFDdEJ4QixJQUFJLENBQUN3QixhQUFhLEdBQUdBLGFBQWEsQ0FBQTtRQUV0QyxJQUFJLENBQUNFLG9CQUFvQixDQUFDcEMsSUFBSSxFQUFFQyxTQUFTLEVBQUVTLElBQUksRUFBRUwsUUFBUSxDQUFDLENBQUE7QUFDOUQsT0FBQyxDQUFDLENBQUE7QUFDTixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUMrQixvQkFBb0IsQ0FBQ3BDLElBQUksRUFBRUMsU0FBUyxFQUFFUyxJQUFJLEVBQUVMLFFBQVEsQ0FBQyxDQUFBO0FBQzlELEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0krQixvQkFBb0JBLENBQUNwQyxJQUFJLEVBQUVDLFNBQVMsRUFBRUMsT0FBTyxFQUFFRyxRQUFRLEVBQUU7QUFDckR2RCxJQUFBQSxTQUFTLENBQUNDLEVBQUUsQ0FBQ3NGLGNBQWMsQ0FBQ3JDLElBQUksRUFBRUUsT0FBTyxDQUFDLENBQUNvQyxJQUFJLENBQUVDLE9BQU8sSUFBSztNQUN6RCxJQUFJLENBQUNDLGVBQWUsQ0FBQ0QsT0FBTyxFQUFFdEMsU0FBUyxFQUFFSSxRQUFRLENBQUMsQ0FBQTtBQUN0RCxLQUFDLENBQUMsQ0FBQ29DLEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ2IsTUFBQSxJQUFJLENBQUN6RSxPQUFPLENBQUM4QixNQUFNLENBQUNoRCxFQUFFLEdBQUcsSUFBSSxDQUFBO01BQzdCLElBQUksQ0FBQ2tCLE9BQU8sR0FBRyxJQUFJLENBQUE7TUFDbkIsSUFBSSxDQUFDaEIsS0FBSyxHQUFHLElBQUksQ0FBQTtNQUNqQixJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFFdEIsTUFBQSxJQUFJbUQsUUFBUSxFQUFFQSxRQUFRLENBQUNxQyxFQUFFLENBQUMsQ0FBQTtBQUMxQixNQUFBLElBQUksQ0FBQ1AsSUFBSSxDQUFDLE9BQU8sRUFBRU8sRUFBRSxDQUFDLENBQUE7QUFDMUIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsR0FBR0EsQ0FBQ3RDLFFBQVEsRUFBRTtBQUNWLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2xELFFBQVEsRUFBRTtNQUNoQixJQUFJa0QsUUFBUSxFQUFFQSxRQUFRLENBQUMsSUFBSUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQTtBQUNsRSxNQUFBLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDakQsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUV4QixJQUFJZ0QsUUFBUSxFQUFFLElBQUksQ0FBQ3VDLElBQUksQ0FBQyxLQUFLLEVBQUV2QyxRQUFRLENBQUMsQ0FBQTtBQUV4QyxJQUFBLElBQUksQ0FBQ2xELFFBQVEsQ0FBQ3dGLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lFLFdBQVdBLENBQUM3QyxJQUFJLEVBQUU7QUFDZCxJQUFBLE9BQU8sSUFBSSxDQUFDaEQsVUFBVSxDQUFDZ0QsSUFBSSxDQUFDLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNBUixFQUFBQSx3QkFBd0JBLEdBQUc7QUFDdkIsSUFBQSxLQUFLLE1BQU1zRCxHQUFHLElBQUksSUFBSSxDQUFDOUYsVUFBVSxFQUFFO0FBQy9CLE1BQUEsSUFBSSxDQUFDK0Ysb0JBQW9CLENBQUNELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUUsbUJBQW1CQSxDQUFDM0MsUUFBUSxFQUFFO0FBQzFCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2xELFFBQVEsRUFBRTtBQUNoQmtELE1BQUFBLFFBQVEsQ0FBQyxJQUFJQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFBO0FBQzVDLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNuRCxRQUFRLENBQUM2RixtQkFBbUIsRUFBRTtBQUNwQzNDLE1BQUFBLFFBQVEsQ0FBQyxJQUFJQyxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQyxDQUFBO0FBQ25FLE1BQUEsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUNuRCxRQUFRLENBQUM2RixtQkFBbUIsRUFBRSxDQUFDVixJQUFJLENBQUMsTUFBTTtBQUMzQyxNQUFBLElBQUlqQyxRQUFRLEVBQUVBLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNoQyxLQUFDLENBQUMsQ0FBQ29DLEtBQUssQ0FBRVIsR0FBRyxJQUFLO0FBQ2QsTUFBQSxJQUFJNUIsUUFBUSxFQUFFQSxRQUFRLENBQUM0QixHQUFHLENBQUMsQ0FBQTtBQUMvQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSWMsb0JBQW9CQSxDQUFDL0MsSUFBSSxFQUFFO0lBQ3ZCbEQsU0FBUyxDQUFDQyxFQUFFLENBQUNrRyxrQkFBa0IsQ0FBQ2pELElBQUksQ0FBQyxDQUFDc0MsSUFBSSxDQUFFWSxTQUFTLElBQUs7TUFDdEQsSUFBSSxJQUFJLENBQUNsRyxVQUFVLENBQUNnRCxJQUFJLENBQUMsS0FBS2tELFNBQVMsRUFDbkMsT0FBQTtBQUVKLE1BQUEsSUFBSSxDQUFDbEcsVUFBVSxDQUFDZ0QsSUFBSSxDQUFDLEdBQUdrRCxTQUFTLENBQUE7TUFDakMsSUFBSSxDQUFDZixJQUFJLENBQUMsV0FBVyxFQUFFbkMsSUFBSSxFQUFFa0QsU0FBUyxDQUFDLENBQUE7TUFDdkMsSUFBSSxDQUFDZixJQUFJLENBQUMsWUFBWSxHQUFHbkMsSUFBSSxFQUFFa0QsU0FBUyxDQUFDLENBQUE7QUFDN0MsS0FBQyxDQUFDLENBQUNULEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ2IsTUFBQSxJQUFJLENBQUNQLElBQUksQ0FBQyxPQUFPLEVBQUVPLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUYsRUFBQUEsZUFBZUEsQ0FBQ0QsT0FBTyxFQUFFdEMsU0FBUyxFQUFFSSxRQUFRLEVBQUU7SUFDMUMsSUFBSThDLE1BQU0sR0FBRyxLQUFLLENBQUE7SUFFbEIsSUFBSSxDQUFDaEcsUUFBUSxHQUFHb0YsT0FBTyxDQUFBO0lBRXZCLE1BQU1hLGtCQUFrQixHQUFHQSxNQUFNO01BQzdCLElBQUksQ0FBQ2pCLElBQUksQ0FBQyxtQkFBbUIsRUFBRUksT0FBTyxDQUFDYyxlQUFlLENBQUMsQ0FBQTtLQUMxRCxDQUFBO0lBRUQsTUFBTUMsa0JBQWtCLEdBQUdBLE1BQU07QUFDN0IsTUFBQSxJQUFJLENBQUMvQyxjQUFjLENBQUMsSUFBSSxDQUFDdEMsT0FBTyxDQUFDdUMsUUFBUSxFQUFFLElBQUksQ0FBQ3ZDLE9BQU8sQ0FBQ3dDLE9BQU8sQ0FBQyxDQUFBO0tBQ25FLENBQUE7O0FBRUQ7SUFDQSxNQUFNOEMsS0FBSyxHQUFHQSxNQUFNO01BQ2hCLElBQUksSUFBSSxDQUFDdEYsT0FBTyxFQUFFO1FBQ2QsSUFBSSxDQUFDQSxPQUFPLENBQUN1RixHQUFHLENBQUMsY0FBYyxFQUFFRixrQkFBa0IsQ0FBQyxDQUFBO1FBQ3BELElBQUksQ0FBQ3JGLE9BQU8sQ0FBQ3VGLEdBQUcsQ0FBQyxhQUFhLEVBQUVGLGtCQUFrQixDQUFDLENBQUE7QUFDbkQsUUFBQSxJQUFJLENBQUNyRixPQUFPLENBQUM4QixNQUFNLENBQUNoRCxFQUFFLEdBQUcsSUFBSSxDQUFBO1FBQzdCLElBQUksQ0FBQ2tCLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFDdkIsT0FBQTtBQUVBc0UsTUFBQUEsT0FBTyxDQUFDa0IsbUJBQW1CLENBQUMsS0FBSyxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN6Q2hCLE1BQUFBLE9BQU8sQ0FBQ2tCLG1CQUFtQixDQUFDLGtCQUFrQixFQUFFTCxrQkFBa0IsQ0FBQyxDQUFBO01BRW5FLElBQUksQ0FBQ0QsTUFBTSxFQUFFLElBQUksQ0FBQ2hCLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTtNQUU3QixJQUFJLENBQUNoRixRQUFRLEdBQUcsSUFBSSxDQUFBO01BQ3BCLElBQUksQ0FBQ0csZUFBZSxHQUFHLElBQUksQ0FBQTtNQUMzQixJQUFJLENBQUNrQixNQUFNLEdBQUcsQ0FBQyxDQUFBO01BQ2YsSUFBSSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxDQUFBO01BQ2hCLElBQUksQ0FBQ3hCLEtBQUssR0FBRyxJQUFJLENBQUE7TUFDakIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBOztBQUV0QjtBQUNBO0FBQ0EsTUFBQSxJQUFJLElBQUksQ0FBQ1IsR0FBRyxDQUFDZ0gsT0FBTyxFQUNoQixJQUFJLENBQUNoSCxHQUFHLENBQUNpSCxJQUFJLEVBQUUsQ0FBQTtLQUN0QixDQUFBO0FBRURwQixJQUFBQSxPQUFPLENBQUNoRCxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUVnRSxLQUFLLENBQUMsQ0FBQTtBQUN0Q2hCLElBQUFBLE9BQU8sQ0FBQ2hELGdCQUFnQixDQUFDLGtCQUFrQixFQUFFNkQsa0JBQWtCLENBQUMsQ0FBQTtJQUVoRSxJQUFJLENBQUNuRixPQUFPLENBQUN5QixFQUFFLENBQUMsY0FBYyxFQUFFNEQsa0JBQWtCLENBQUMsQ0FBQTtJQUNuRCxJQUFJLENBQUNyRixPQUFPLENBQUN5QixFQUFFLENBQUMsYUFBYSxFQUFFNEQsa0JBQWtCLENBQUMsQ0FBQTs7QUFFbEQ7QUFDQTtBQUNBO0FBQ0FNLElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDQyxNQUFNLEVBQUUsNEVBQTRFLENBQUMsQ0FBQTtJQUVsRyxJQUFJLENBQUNDLGdCQUFnQixFQUFFLENBQUE7O0FBRXZCO0lBQ0F4QixPQUFPLENBQUN5QixxQkFBcUIsQ0FBQy9ELFNBQVMsQ0FBQyxDQUFDcUMsSUFBSSxDQUFFMkIsY0FBYyxJQUFLO01BQzlELElBQUksQ0FBQzNHLGVBQWUsR0FBRzJHLGNBQWMsQ0FBQTs7QUFFckM7QUFDQTtBQUNBLE1BQUEsSUFBSSxDQUFDdkgsR0FBRyxDQUFDaUgsSUFBSSxFQUFFLENBQUE7QUFFZixNQUFBLElBQUl0RCxRQUFRLEVBQUVBLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM1QixNQUFBLElBQUksQ0FBQzhCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtBQUN0QixLQUFDLENBQUMsQ0FBQ00sS0FBSyxDQUFFQyxFQUFFLElBQUs7QUFDYlMsTUFBQUEsTUFBTSxHQUFHLElBQUksQ0FBQTtNQUNiWixPQUFPLENBQUNJLEdBQUcsRUFBRSxDQUFBO0FBQ2IsTUFBQSxJQUFJdEMsUUFBUSxFQUFFQSxRQUFRLENBQUNxQyxFQUFFLENBQUMsQ0FBQTtBQUMxQixNQUFBLElBQUksQ0FBQ1AsSUFBSSxDQUFDLE9BQU8sRUFBRU8sRUFBRSxDQUFDLENBQUE7QUFDMUIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSW5DLEVBQUFBLGNBQWNBLENBQUMyRCxJQUFJLEVBQUVDLEdBQUcsRUFBRTtJQUN0QixJQUFJLElBQUksQ0FBQzdGLFVBQVUsS0FBSzRGLElBQUksSUFBSSxJQUFJLENBQUMzRixTQUFTLEtBQUs0RixHQUFHLEVBQ2xELE9BQUE7SUFFSixJQUFJLENBQUM3RixVQUFVLEdBQUc0RixJQUFJLENBQUE7SUFDdEIsSUFBSSxDQUFDM0YsU0FBUyxHQUFHNEYsR0FBRyxDQUFBO0FBRXBCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2hILFFBQVEsRUFDZCxPQUFBOztBQUVKO0FBQ0E7QUFDQSxJQUFBLElBQUksQ0FBQ0EsUUFBUSxDQUFDaUgsaUJBQWlCLENBQUM7TUFDNUJDLFNBQVMsRUFBRSxJQUFJLENBQUMvRixVQUFVO01BQzFCZ0csUUFBUSxFQUFFLElBQUksQ0FBQy9GLFNBQUFBO0FBQ25CLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTtBQUVBd0YsRUFBQUEsZ0JBQWdCQSxHQUFHO0FBQ2YsSUFBQSxNQUFNUSxNQUFNLEdBQUcsSUFBSSxDQUFDN0gsR0FBRyxDQUFDK0MsY0FBYyxDQUFBO0lBQ3RDLE1BQU0rRSxzQkFBc0IsR0FBR0QsTUFBTSxDQUFDRSxhQUFhLEdBQUdYLE1BQU0sQ0FBQ1ksZ0JBQWdCLENBQUE7QUFFN0UsSUFBQSxJQUFJLENBQUN0SCxVQUFVLEdBQUcsSUFBSXVILFlBQVksQ0FBQyxJQUFJLENBQUN4SCxRQUFRLEVBQUVvSCxNQUFNLENBQUNLLEVBQUUsRUFBRTtBQUN6REMsTUFBQUEsS0FBSyxFQUFFLElBQUk7QUFDWEMsTUFBQUEsS0FBSyxFQUFFLElBQUk7QUFDWEMsTUFBQUEsT0FBTyxFQUFFLElBQUk7QUFDYlAsTUFBQUEsc0JBQXNCLEVBQUVBLHNCQUFzQjtBQUM5Q1EsTUFBQUEsU0FBUyxFQUFFLEtBQUE7QUFDZixLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsTUFBTUMsVUFBVSxHQUFHVixNQUFNLENBQUNVLFVBQVUsQ0FBQTtBQUNwQyxJQUFBLElBQUksQ0FBQ0EsVUFBVSxLQUFLQyxpQkFBaUIsSUFBSUQsVUFBVSxLQUFLRSxpQkFBaUIsS0FBS3JCLE1BQU0sQ0FBQ3NCLGNBQWMsRUFBRTtNQUNqRyxJQUFJO0FBQ0EsUUFBQSxJQUFJLENBQUMvSCxZQUFZLEdBQUcsSUFBSStILGNBQWMsQ0FBQyxJQUFJLENBQUNqSSxRQUFRLEVBQUVvSCxNQUFNLENBQUNLLEVBQUUsQ0FBQyxDQUFDO09BQ3BFLENBQUMsT0FBT2xDLEVBQUUsRUFBRTtBQUNULFFBQUEsSUFBSSxDQUFDUCxJQUFJLENBQUMsT0FBTyxFQUFFTyxFQUFFLENBQUMsQ0FBQTtBQUMxQixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDdkYsUUFBUSxDQUFDaUgsaUJBQWlCLENBQUM7TUFDNUJpQixTQUFTLEVBQUUsSUFBSSxDQUFDakksVUFBVTtNQUMxQmlILFNBQVMsRUFBRSxJQUFJLENBQUMvRixVQUFVO01BQzFCZ0csUUFBUSxFQUFFLElBQUksQ0FBQy9GLFNBQUFBO0FBQ25CLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtBQUNBb0IsRUFBQUEsYUFBYUEsR0FBRztBQUNaLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3hDLFFBQVEsRUFDZCxPQUFBO0lBRUosSUFBSSxJQUFJLENBQUNFLFlBQVksRUFDakIsSUFBSSxDQUFDQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0lBRTVCLElBQUksQ0FBQ0QsVUFBVSxHQUFHLElBQUksQ0FBQTtBQUV0QixJQUFBLElBQUksQ0FBQ0QsUUFBUSxDQUFDaUgsaUJBQWlCLENBQUM7TUFDNUJpQixTQUFTLEVBQUUsSUFBSSxDQUFDakksVUFBVTtNQUMxQmlILFNBQVMsRUFBRSxJQUFJLENBQUMvRixVQUFVO01BQzFCZ0csUUFBUSxFQUFFLElBQUksQ0FBQy9GLFNBQUFBO0FBQ25CLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtBQUNBcUIsRUFBQUEsaUJBQWlCQSxHQUFHO0FBQ2hCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3pDLFFBQVEsRUFDZCxPQUFBO0FBRUptSSxJQUFBQSxVQUFVLENBQUMsTUFBTTtBQUNiLE1BQUEsSUFBSSxDQUFDNUksR0FBRyxDQUFDK0MsY0FBYyxDQUFDbUYsRUFBRSxDQUFDVyxnQkFBZ0IsRUFBRSxDQUN4Q2pELElBQUksQ0FBQyxNQUFNO1FBQ1IsSUFBSSxDQUFDeUIsZ0JBQWdCLEVBQUUsQ0FBQTtBQUMzQixPQUFDLENBQUMsQ0FDRHRCLEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ1gsUUFBQSxJQUFJLENBQUNQLElBQUksQ0FBQyxPQUFPLEVBQUVPLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLE9BQUMsQ0FBQyxDQUFBO0tBQ1QsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNULEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0k4QyxNQUFNQSxDQUFDQyxLQUFLLEVBQUU7QUFDVixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUN0SSxRQUFRLEVBQUUsT0FBTyxLQUFLLENBQUE7O0FBRWhDO0lBQ0EsTUFBTXVJLEtBQUssR0FBR0QsS0FBSyxDQUFDbEQsT0FBTyxDQUFDb0QsV0FBVyxDQUFDTixTQUFTLENBQUNPLGdCQUFnQixDQUFBO0lBQ2xFLE1BQU1DLE1BQU0sR0FBR0osS0FBSyxDQUFDbEQsT0FBTyxDQUFDb0QsV0FBVyxDQUFDTixTQUFTLENBQUNTLGlCQUFpQixDQUFBO0lBQ3BFLElBQUksSUFBSSxDQUFDdEgsTUFBTSxLQUFLa0gsS0FBSyxJQUFJLElBQUksQ0FBQ2pILE9BQU8sS0FBS29ILE1BQU0sRUFBRTtNQUNsRCxJQUFJLENBQUNySCxNQUFNLEdBQUdrSCxLQUFLLENBQUE7TUFDbkIsSUFBSSxDQUFDakgsT0FBTyxHQUFHb0gsTUFBTSxDQUFBO01BQ3JCLElBQUksQ0FBQ25KLEdBQUcsQ0FBQytDLGNBQWMsQ0FBQ3NHLGFBQWEsQ0FBQ0wsS0FBSyxFQUFFRyxNQUFNLENBQUMsQ0FBQTtBQUN4RCxLQUFBO0lBRUEsTUFBTUcsSUFBSSxHQUFHUCxLQUFLLENBQUNRLGFBQWEsQ0FBQyxJQUFJLENBQUMzSSxlQUFlLENBQUMsQ0FBQTtBQUV0RCxJQUFBLElBQUksQ0FBQzBJLElBQUksRUFBRSxPQUFPLEtBQUssQ0FBQTtJQUV2QixNQUFNRSxTQUFTLEdBQUcsSUFBSSxDQUFDbkksS0FBSyxDQUFDb0ksSUFBSSxDQUFDcEUsTUFBTSxDQUFBOztBQUV4QztJQUNBLElBQUksQ0FBQ2hFLEtBQUssQ0FBQ3lILE1BQU0sQ0FBQ0MsS0FBSyxFQUFFTyxJQUFJLENBQUNqSSxLQUFLLENBQUMsQ0FBQTs7QUFFcEM7QUFDQSxJQUFBLE1BQU1xSSxZQUFZLEdBQUdKLElBQUksQ0FBQ0ssU0FBUyxDQUFDQyxRQUFRLENBQUE7QUFDNUMsSUFBQSxNQUFNQyxlQUFlLEdBQUdQLElBQUksQ0FBQ0ssU0FBUyxDQUFDRyxXQUFXLENBQUE7QUFDbEQsSUFBQSxJQUFJLENBQUN0SSxjQUFjLENBQUN1SSxHQUFHLENBQUNMLFlBQVksQ0FBQ00sQ0FBQyxFQUFFTixZQUFZLENBQUNPLENBQUMsRUFBRVAsWUFBWSxDQUFDUSxDQUFDLENBQUMsQ0FBQTtJQUN2RSxJQUFJLENBQUN4SSxjQUFjLENBQUNxSSxHQUFHLENBQUNGLGVBQWUsQ0FBQ0csQ0FBQyxFQUFFSCxlQUFlLENBQUNJLENBQUMsRUFBRUosZUFBZSxDQUFDSyxDQUFDLEVBQUVMLGVBQWUsQ0FBQ00sQ0FBQyxDQUFDLENBQUE7O0FBRW5HO0FBQ0EsSUFBQSxJQUFJWCxTQUFTLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQ25JLEtBQUssQ0FBQ29JLElBQUksQ0FBQ3BFLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDL0MsTUFBQSxNQUFNK0UsV0FBVyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO01BQzlCLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUNqSixLQUFLLENBQUNvSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFL0JXLE1BQUFBLFdBQVcsQ0FBQ0csSUFBSSxDQUFDRCxJQUFJLENBQUNFLE9BQU8sQ0FBQyxDQUFBO0FBQzlCLE1BQUEsTUFBTUMsSUFBSSxHQUFHTCxXQUFXLENBQUNLLElBQUksQ0FBQTtNQUU3QixNQUFNQyxHQUFHLEdBQUksR0FBRyxHQUFHQyxJQUFJLENBQUNDLElBQUksQ0FBQyxHQUFHLEdBQUdILElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBSUUsSUFBSSxDQUFDRSxFQUFFLENBQUE7TUFDOUQsTUFBTUMsV0FBVyxHQUFHTCxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUdBLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQyxNQUFBLE1BQU0xRyxPQUFPLEdBQUcwRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUlBLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN6QyxNQUFBLE1BQU0zRyxRQUFRLEdBQUcyRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUlBLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtNQUMxQyxNQUFNTSxhQUFhLEdBQUcsS0FBSyxDQUFBO0FBRTNCLE1BQUEsTUFBTTFILE1BQU0sR0FBRyxJQUFJLENBQUM5QixPQUFPLENBQUM4QixNQUFNLENBQUE7TUFDbENBLE1BQU0sQ0FBQzJILGVBQWUsQ0FBQztRQUNuQkYsV0FBVztRQUNYL0csT0FBTztRQUNQMkcsR0FBRztRQUNISyxhQUFhO0FBQ2JqSCxRQUFBQSxRQUFBQTtBQUNKLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDdkMsT0FBTyxDQUFDOEIsTUFBTSxDQUFDNEgsS0FBSyxDQUFDQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMxSixjQUFjLENBQUMsQ0FBQTtBQUMvRCxJQUFBLElBQUksQ0FBQ0QsT0FBTyxDQUFDOEIsTUFBTSxDQUFDNEgsS0FBSyxDQUFDRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUN6SixjQUFjLENBQUMsQ0FBQTtBQUUvRCxJQUFBLElBQUksQ0FBQ1AsS0FBSyxDQUFDMkgsTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUV4QixJQUFBLElBQUksSUFBSSxDQUFDeEksS0FBSyxLQUFLMkIsU0FBUyxFQUFFO0FBQzFCLE1BQUEsSUFBSSxJQUFJLENBQUNuQixPQUFPLENBQUN3RCxTQUFTLEVBQ3RCLElBQUksQ0FBQ3hELE9BQU8sQ0FBQytILE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLENBQUE7QUFFOUIsTUFBQSxJQUFJLElBQUksQ0FBQzNILGVBQWUsQ0FBQ21ELFNBQVMsRUFDOUIsSUFBSSxDQUFDbkQsZUFBZSxDQUFDMEgsTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUV0QyxNQUFBLElBQUksSUFBSSxDQUFDL0gsYUFBYSxDQUFDdUQsU0FBUyxFQUM1QixJQUFJLENBQUN2RCxhQUFhLENBQUM4SCxNQUFNLENBQUNDLEtBQUssQ0FBQyxDQUFBO0FBRXBDLE1BQUEsSUFBSSxJQUFJLENBQUN6SCxPQUFPLENBQUNpRCxTQUFTLEVBQ3RCLElBQUksQ0FBQ2pELE9BQU8sQ0FBQ3dILE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLENBQUE7QUFFOUIsTUFBQSxJQUFJLElBQUksQ0FBQzlILGNBQWMsQ0FBQ3NELFNBQVMsRUFDN0IsSUFBSSxDQUFDdEQsY0FBYyxDQUFDNkgsTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUVyQyxNQUFBLElBQUksSUFBSSxDQUFDbEksWUFBWSxDQUFDMEQsU0FBUyxFQUMzQixJQUFJLENBQUMxRCxZQUFZLENBQUNpSSxNQUFNLEVBQUUsQ0FBQTtBQUU5QixNQUFBLElBQUksSUFBSSxDQUFDNUgsYUFBYSxDQUFDcUQsU0FBUyxFQUM1QixJQUFJLENBQUNyRCxhQUFhLENBQUM0SCxNQUFNLENBQUNDLEtBQUssQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ3RELElBQUksQ0FBQyxRQUFRLEVBQUVzRCxLQUFLLENBQUMsQ0FBQTtBQUUxQixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXhFLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQ3RFLFVBQVUsQ0FBQTtBQUMxQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJbUwsTUFBTUEsR0FBRztBQUNULElBQUEsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDM0ssUUFBUSxDQUFBO0FBQzFCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSTZDLElBQUlBLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQy9DLEtBQUssQ0FBQTtBQUNyQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlnRCxTQUFTQSxHQUFHO0lBQ1osT0FBTyxJQUFJLENBQUMvQyxVQUFVLENBQUE7QUFDMUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXFGLE9BQU9BLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ3BGLFFBQVEsQ0FBQTtBQUN4QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJNEMsTUFBTUEsR0FBRztJQUNULE9BQU8sSUFBSSxDQUFDOUIsT0FBTyxHQUFHLElBQUksQ0FBQ0EsT0FBTyxDQUFDOEosTUFBTSxHQUFHLElBQUksQ0FBQTtBQUNwRCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSTFFLGVBQWVBLEdBQUc7QUFDbEIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDbEcsUUFBUSxFQUNkLE9BQU8sSUFBSSxDQUFBO0FBRWYsSUFBQSxPQUFPLElBQUksQ0FBQ0EsUUFBUSxDQUFDa0csZUFBZSxDQUFBO0FBQ3hDLEdBQUE7QUFDSixDQUFBO0FBeDVCSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQW5CTTlHLFNBQVMsQ0FvQkp5TCxlQUFlLEdBQUcsV0FBVyxDQUFBO0FBRXBDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQTlCTXpMLFNBQVMsQ0ErQkowTCxXQUFXLEdBQUcsT0FBTyxDQUFBO0FBRTVCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXpDTTFMLFNBQVMsQ0EwQ0oyTCxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBRXhCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF0RE0zTCxTQUFTLENBdURKNEwsWUFBWSxHQUFHLFFBQVEsQ0FBQTtBQUU5QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBbkVNNUwsU0FBUyxDQW9FSjZMLFdBQVcsR0FBRyxPQUFPOzs7OyJ9
