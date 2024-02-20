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
    } else if (type === XRTYPE_VR) {
      opts.optionalFeatures.push('hand-tracking');
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFhSVFlQRV9JTkxJTkUsIFhSVFlQRV9WUiwgWFJUWVBFX0FSLCBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSwgWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERFVklDRVRZUEVfV0VCR0wxLCBERVZJQ0VUWVBFX1dFQkdMMiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBYckRlcHRoU2Vuc2luZyB9IGZyb20gJy4veHItZGVwdGgtc2Vuc2luZy5qcyc7XG5pbXBvcnQgeyBYckRvbU92ZXJsYXkgfSBmcm9tICcuL3hyLWRvbS1vdmVybGF5LmpzJztcbmltcG9ydCB7IFhySGl0VGVzdCB9IGZyb20gJy4veHItaGl0LXRlc3QuanMnO1xuaW1wb3J0IHsgWHJJbWFnZVRyYWNraW5nIH0gZnJvbSAnLi94ci1pbWFnZS10cmFja2luZy5qcyc7XG5pbXBvcnQgeyBYcklucHV0IH0gZnJvbSAnLi94ci1pbnB1dC5qcyc7XG5pbXBvcnQgeyBYckxpZ2h0RXN0aW1hdGlvbiB9IGZyb20gJy4veHItbGlnaHQtZXN0aW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBYclBsYW5lRGV0ZWN0aW9uIH0gZnJvbSAnLi94ci1wbGFuZS1kZXRlY3Rpb24uanMnO1xuaW1wb3J0IHsgWHJBbmNob3JzIH0gZnJvbSAnLi94ci1hbmNob3JzLmpzJztcbmltcG9ydCB7IFhyTWVzaERldGVjdGlvbiB9IGZyb20gJy4veHItbWVzaC1kZXRlY3Rpb24uanMnO1xuaW1wb3J0IHsgWHJWaWV3cyB9IGZyb20gJy4veHItdmlld3MuanMnO1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFhyTWFuYWdlciNlbmRYcn0gYW5kIHtAbGluayBYck1hbmFnZXIjc3RhcnRYcn0uXG4gKlxuICogQGNhbGxiYWNrIFhyRXJyb3JDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IG9yIG51bGwgaWYgb3BlcmF0aW9uIHdhcyBzdWNjZXNzZnVsLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSBtYW51YWwgcm9vbSBjYXB0dXJpbmcuXG4gKlxuICogQGNhbGxiYWNrIFhyUm9vbUNhcHR1cmVDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IG9yIG51bGwgaWYgbWFudWFsIHJvb20gY2FwdHVyZSB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IFhSXG4gKi9cbmNsYXNzIFhyTWFuYWdlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhdmFpbGFiaWxpdHkgb2YgdGhlIFhSIHR5cGUgaXMgY2hhbmdlZC4gVGhpcyBldmVudCBpcyBhdmFpbGFibGUgaW4gdHdvXG4gICAgICogZm9ybXMuIFRoZXkgYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgYXZhaWxhYmxlYCAtIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIGFueSBYUiB0eXBlIGlzIGNoYW5nZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZFxuICAgICAqIHRoZSBzZXNzaW9uIHR5cGUgdGhhdCBoYXMgY2hhbmdlZCBhdmFpbGFiaWxpdHkgYW5kIGEgYm9vbGVhbiByZXByZXNlbnRpbmcgdGhlIGF2YWlsYWJpbGl0eS5cbiAgICAgKiAyLiBgYXZhaWxhYmxlOlt0eXBlXWAgLSBGaXJlZCB3aGVuIGF2YWlsYWJpbGl0eSBvZiBzcGVjaWZpYyBYUiB0eXBlIGlzIGNoYW5nZWQuIFRoZSBoYW5kbGVyXG4gICAgICogaXMgcGFzc2VkIGEgYm9vbGVhbiByZXByZXNlbnRpbmcgdGhlIGF2YWlsYWJpbGl0eS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdhdmFpbGFibGUnLCAodHlwZSwgYXZhaWxhYmxlKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBYUiB0eXBlICR7dHlwZX0gaXMgbm93ICR7YXZhaWxhYmxlID8gJ2F2YWlsYWJsZScgOiAndW5hdmFpbGFibGUnfWApO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKGBhdmFpbGFibGU6JHtwYy5YUlRZUEVfVlJ9YCwgKGF2YWlsYWJsZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgWFIgdHlwZSBWUiBpcyBub3cgJHthdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZSd9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FWQUlMQUJMRSA9ICdhdmFpbGFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignc3RhcnQnLCAoKSA9PiB7XG4gICAgICogICAgIC8vIFhSIHNlc3Npb24gaGFzIHN0YXJ0ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1RBUlQgPSAnc3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2VuZCcsICgpID0+IHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZW5kZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRU5EID0gJ2VuZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgdXBkYXRlZCwgcHJvdmlkaW5nIHJlbGV2YW50IFhSRnJhbWUgb2JqZWN0LiBUaGUgaGFuZGxlciBpcyBwYXNzZWRcbiAgICAgKiBbWFJGcmFtZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hSRnJhbWUpIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkXG4gICAgICogZm9yIGludGVyZmFjaW5nIGRpcmVjdGx5IHdpdGggV2ViWFIgQVBJcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCd1cGRhdGUnLCAoZnJhbWUpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1hSIGZyYW1lIHVwZGF0ZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVVBEQVRFID0gJ3VwZGF0ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuIFRoZSBoYW5kbGVyXG4gICAgICogaXMgcGFzc2VkIHRoZSBbRXJyb3JdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yKVxuICAgICAqIG9iamVjdCByZWxhdGVkIHRvIGZhaWx1cmUgb2Ygc2Vzc2lvbiBzdGFydCBvciBjaGVjayBvZiBzZXNzaW9uIHR5cGUgc3VwcG9ydC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9FUlJPUiA9ICdlcnJvcic7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFwcDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N1cHBvcnRlZCA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISFuYXZpZ2F0b3IueHI7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgYm9vbGVhbj59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXZhaWxhYmxlID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdHlwZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3BhY2VUeXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlNlc3Npb258bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXNzaW9uID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUldlYkdMTGF5ZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iYXNlTGF5ZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xCaW5kaW5nfG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdlYmdsQmluZGluZyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGRlcHRoIHNlbnNpbmcgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRGVwdGhTZW5zaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXB0aFNlbnNpbmc7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gRE9NIG92ZXJsYXkgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRG9tT3ZlcmxheX1cbiAgICAgKi9cbiAgICBkb21PdmVybGF5O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gcGVyZm9ybSBoaXQgdGVzdHMgb24gdGhlIHJlcHJlc2VudGF0aW9uIG9mIHJlYWwgd29ybGQgZ2VvbWV0cnlcbiAgICAgKiBvZiB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJIaXRUZXN0fVxuICAgICAqL1xuICAgIGhpdFRlc3Q7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gaW1hZ2UgdHJhY2tpbmcgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hySW1hZ2VUcmFja2luZ31cbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKi9cbiAgICBwbGFuZURldGVjdGlvbjtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBtZXNoIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJNZXNoRGV0ZWN0aW9ufVxuICAgICAqL1xuICAgIG1lc2hEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqL1xuICAgIGxpZ2h0RXN0aW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byB2aWV3cyBhbmQgdGhlaXIgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyVmlld3N9XG4gICAgICovXG4gICAgdmlld3M7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gQW5jaG9ycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckFuY2hvcnN9XG4gICAgICovXG4gICAgYW5jaG9ycztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYW1lcmEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGhOZWFyID0gMC4xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEZhciA9IDEwMDA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGVpZ2h0ID0gMDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgbWFpbiBhcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG5cbiAgICAgICAgLy8gQWRkIGFsbCB0aGUgc3VwcG9ydGVkIHNlc3Npb24gdHlwZXNcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9JTkxJTkVdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZVtYUlRZUEVfVlJdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZVtYUlRZUEVfQVJdID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy52aWV3cyA9IG5ldyBYclZpZXdzKHRoaXMpO1xuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLm1lc2hEZXRlY3Rpb24gPSBuZXcgWHJNZXNoRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmFuY2hvcnMgPSBuZXcgWHJBbmNob3JzKHRoaXMpO1xuICAgICAgICB0aGlzLnZpZXdzID0gbmV3IFhyVmlld3ModGhpcyk7XG5cbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyAxLiBITUQgY2xhc3Mgd2l0aCBpdHMgcGFyYW1zXG4gICAgICAgIC8vIDIuIFNwYWNlIGNsYXNzXG4gICAgICAgIC8vIDMuIENvbnRyb2xsZXJzIGNsYXNzXG5cbiAgICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgbmF2aWdhdG9yLnhyLmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZWNoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuXG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5vbignZGV2aWNlbG9zdCcsIHRoaXMuX29uRGV2aWNlTG9zdCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5vbignZGV2aWNlcmVzdG9yZWQnLCB0aGlzLl9vbkRldmljZVJlc3RvcmVkLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveSgpIHsgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gc3RhcnQgWFIgc2Vzc2lvbiBmb3IgcHJvdmlkZWQge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYW5kIG9wdGlvbmFsbHkgZmlyZXNcbiAgICAgKiBjYWxsYmFjayB3aGVuIHNlc3Npb24gaXMgY3JlYXRlZCBvciBmYWlsZWQgdG8gY3JlYXRlLiBJbnRlZ3JhdGVkIFhSIEFQSXMgbmVlZCB0byBiZSBlbmFibGVkXG4gICAgICogYnkgcHJvdmlkaW5nIHJlbGV2YW50IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBJdCB3aWxsIGJlXG4gICAgICogdXNlZCB0byByZW5kZXIgWFIgc2Vzc2lvbiBhbmQgbWFuaXB1bGF0ZWQgYmFzZWQgb24gcG9zZSB0cmFja2luZy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0lOTElORX06IElubGluZSAtIGFsd2F5cyBhdmFpbGFibGUgdHlwZSBvZiBzZXNzaW9uLiBJdCBoYXMgbGltaXRlZCBmZWF0dXJlc1xuICAgICAqIGF2YWlsYWJpbGl0eSBhbmQgaXMgcmVuZGVyZWQgaW50byBIVE1MIGVsZW1lbnQuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX1ZSfTogSW1tZXJzaXZlIFZSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIgZGV2aWNlIHdpdGhcbiAgICAgKiBiZXN0IGF2YWlsYWJsZSB0cmFja2luZyBmZWF0dXJlcy5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfQVJ9OiBJbW1lcnNpdmUgQVIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUi9BUiBkZXZpY2VcbiAgICAgKiB0aGF0IGlzIGludGVuZGVkIHRvIGJlIGJsZW5kZWQgd2l0aCByZWFsLXdvcmxkIGVudmlyb25tZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNwYWNlVHlwZSAtIFJlZmVyZW5jZSBzcGFjZSB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1ZJRVdFUn06IFZpZXdlciAtIGFsd2F5cyBzdXBwb3J0ZWQgc3BhY2Ugd2l0aCBzb21lIGJhc2ljIHRyYWNraW5nXG4gICAgICogY2FwYWJpbGl0aWVzLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUx9OiBMb2NhbCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpbiBuZWFyIHRoZVxuICAgICAqIHZpZXdlciBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvciBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMRkxPT1J9OiBMb2NhbCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpblxuICAgICAqIGF0IHRoZSBmbG9vciBpbiBhIHNhZmUgcG9zaXRpb24gZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeSBheGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLlxuICAgICAqIEZsb29yIGxldmVsIHZhbHVlIG1pZ2h0IGJlIGVzdGltYXRlZCBieSB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybS4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvclxuICAgICAqIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfQk9VTkRFREZMT09SfTogQm91bmRlZCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGl0cyBuYXRpdmVcbiAgICAgKiBvcmlnaW4gYXQgdGhlIGZsb29yLCB3aGVyZSB0aGUgdXNlciBpcyBleHBlY3RlZCB0byBtb3ZlIHdpdGhpbiBhIHByZS1lc3RhYmxpc2hlZCBib3VuZGFyeS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1VOQk9VTkRFRH06IFVuYm91bmRlZCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aGVyZSB0aGUgdXNlciBpc1xuICAgICAqIGV4cGVjdGVkIHRvIG1vdmUgZnJlZWx5IGFyb3VuZCB0aGVpciBlbnZpcm9ubWVudCwgcG90ZW50aWFsbHkgbG9uZyBkaXN0YW5jZXMgZnJvbSB0aGVpclxuICAgICAqIHN0YXJ0aW5nIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBmb3IgWFIgc2Vzc2lvbiBpbml0aWFsaXphdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzXSAtIE9wdGlvbmFsIGZlYXR1cmVzIGZvciBYUlNlc3Npb24gc3RhcnQuIEl0IGlzXG4gICAgICogdXNlZCBmb3IgZ2V0dGluZyBhY2Nlc3MgdG8gYWRkaXRpb25hbCBXZWJYUiBzcGVjIGV4dGVuc2lvbnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbmNob3JzXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlXG4gICAgICoge0BsaW5rIFhyQW5jaG9yc30uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pbWFnZVRyYWNraW5nXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlXG4gICAgICoge0BsaW5rIFhySW1hZ2VUcmFja2luZ30uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wbGFuZURldGVjdGlvbl0gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYclBsYW5lRGV0ZWN0aW9ufS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLm1lc2hEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJNZXNoRGV0ZWN0aW9ufS5cbiAgICAgKiBAcGFyYW0ge1hyRXJyb3JDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvblxuICAgICAqIGlzIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmRlcHRoU2Vuc2luZ10gLSBPcHRpb25hbCBvYmplY3Qgd2l0aCBkZXB0aCBzZW5zaW5nIHBhcmFtZXRlcnMgdG9cbiAgICAgKiBhdHRlbXB0IHRvIGVuYWJsZSB7QGxpbmsgWHJEZXB0aFNlbnNpbmd9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlXSAtIE9wdGlvbmFsIHVzYWdlIHByZWZlcmVuY2UgZm9yIGRlcHRoXG4gICAgICogc2Vuc2luZywgY2FuIGJlICdjcHUtb3B0aW1pemVkJyBvciAnZ3B1LW9wdGltaXplZCcgKFhSREVQVEhTRU5TSU5HVVNBR0VfKiksIGRlZmF1bHRzIHRvXG4gICAgICogJ2NwdS1vcHRpbWl6ZWQnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGwgYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmdcbiAgICAgKiBzeXN0ZW0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZV0gLSBPcHRpb25hbCBkYXRhIGZvcm1hdFxuICAgICAqIHByZWZlcmVuY2UgZm9yIGRlcHRoIHNlbnNpbmcsIGNhbiBiZSAnbHVtaW5hbmNlLWFscGhhJyBvciAnZmxvYXQzMidcbiAgICAgKiAoWFJERVBUSFNFTlNJTkdGT1JNQVRfKiksIGRlZmF1bHRzIHRvICdsdW1pbmFuY2UtYWxwaGEnLiBNb3N0IHByZWZlcnJlZCBhbmQgc3VwcG9ydGVkIHdpbGxcbiAgICAgKiBiZSBjaG9zZW4gYnkgdGhlIHVuZGVybHlpbmcgZGVwdGggc2Vuc2luZyBzeXN0ZW0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBidXR0b24ub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfVlIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUik7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBidXR0b24ub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfQVIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUiwge1xuICAgICAqICAgICAgICAgYW5jaG9yczogdHJ1ZSxcbiAgICAgKiAgICAgICAgIGltYWdlVHJhY2tpbmc6IHRydWUsXG4gICAgICogICAgICAgICBkZXB0aFNlbnNpbmc6IHsgfVxuICAgICAqICAgICB9KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGFydChjYW1lcmEsIHR5cGUsIHNwYWNlVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgY2FsbGJhY2sgPSBvcHRpb25zO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9hdmFpbGFibGVbdHlwZV0pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBpcyBub3QgYXZhaWxhYmxlJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBzZXNzaW9uIGlzIGFscmVhZHkgc3RhcnRlZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYSA9IGNhbWVyYTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IHRoaXM7XG4gICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlO1xuICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBzcGFjZVR5cGU7XG5cbiAgICAgICAgdGhpcy5fc2V0Q2xpcFBsYW5lcyhjYW1lcmEubmVhckNsaXAsIGNhbWVyYS5mYXJDbGlwKTtcblxuICAgICAgICAvLyBUT0RPXG4gICAgICAgIC8vIG1ha2VYUkNvbXBhdGlibGVcbiAgICAgICAgLy8gc2NlbmFyaW8gdG8gdGVzdDpcbiAgICAgICAgLy8gMS4gYXBwIGlzIHJ1bm5pbmcgb24gaW50ZWdyYXRlZCBHUFVcbiAgICAgICAgLy8gMi4gWFIgZGV2aWNlIGlzIGNvbm5lY3RlZCwgdG8gYW5vdGhlciBHUFVcbiAgICAgICAgLy8gMy4gcHJvYmFibHkgaW1tZXJzaXZlLXZyIHdpbGwgZmFpbCB0byBiZSBjcmVhdGVkXG4gICAgICAgIC8vIDQuIGNhbGwgbWFrZVhSQ29tcGF0aWJsZSwgdmVyeSBsaWtlbHkgd2lsbCBsZWFkIHRvIGNvbnRleHQgbG9zc1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICByZXF1aXJlZEZlYXR1cmVzOiBbc3BhY2VUeXBlXSxcbiAgICAgICAgICAgIG9wdGlvbmFsRmVhdHVyZXM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3Qgd2ViZ2wgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZT8uaXNXZWJHTDEgfHwgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U/LmlzV2ViR0wyO1xuXG4gICAgICAgIGlmICh0eXBlID09PSBYUlRZUEVfQVIpIHtcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdsaWdodC1lc3RpbWF0aW9uJyk7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaGl0LXRlc3QnKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5pbWFnZVRyYWNraW5nICYmIHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdpbWFnZS10cmFja2luZycpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucGxhbmVEZXRlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdwbGFuZS1kZXRlY3Rpb24nKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLm1lc2hEZXRlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdtZXNoLWRldGVjdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5kb21PdmVybGF5LnN1cHBvcnRlZCAmJiB0aGlzLmRvbU92ZXJsYXkucm9vdCkge1xuICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdkb20tb3ZlcmxheScpO1xuICAgICAgICAgICAgICAgIG9wdHMuZG9tT3ZlcmxheSA9IHsgcm9vdDogdGhpcy5kb21PdmVybGF5LnJvb3QgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbmNob3JzICYmIHRoaXMuYW5jaG9ycy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnYW5jaG9ycycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAod2ViZ2wgJiYgb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYUNvbG9yICYmIHRoaXMudmlld3Muc3VwcG9ydGVkQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnY2FtZXJhLWFjY2VzcycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFhSVFlQRV9WUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcylcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcyA9IG9wdHMub3B0aW9uYWxGZWF0dXJlcy5jb25jYXQob3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzKTtcblxuICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZCAmJiB0aGlzLmltYWdlVHJhY2tpbmcuaW1hZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnByZXBhcmVJbWFnZXMoKGVyciwgdHJhY2tlZEltYWdlcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkSW1hZ2VzICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLnRyYWNrZWRJbWFnZXMgPSB0cmFja2VkSW1hZ2VzO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0geyp9IG9wdGlvbnMgLSBTZXNzaW9uIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5yZXF1ZXN0U2Vzc2lvbih0eXBlLCBvcHRpb25zKS50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gZW5kIFhSIHNlc3Npb24gYW5kIG9wdGlvbmFsbHkgZmlyZXMgY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGVuZGVkIG9yIGZhaWxlZCB0b1xuICAgICAqIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpc1xuICAgICAqIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChldnQua2V5ID09PSBwYy5LRVlfRVNDQVBFICYmIGFwcC54ci5hY3RpdmUpIHtcbiAgICAgKiAgICAgICAgIGFwcC54ci5lbmQoKTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBpbml0aWFsaXplZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud2ViZ2xCaW5kaW5nID0gbnVsbDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHRoaXMub25jZSgnZW5kJywgY2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24uZW5kKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgc3BlY2lmaWMgdHlwZSBvZiBzZXNzaW9uIGlzIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRZUEVfSU5MSU5FfTogSW5saW5lIC0gYWx3YXlzIGF2YWlsYWJsZSB0eXBlIG9mIHNlc3Npb24uIEl0IGhhcyBsaW1pdGVkIGZlYXR1cmVzXG4gICAgICogYXZhaWxhYmlsaXR5IGFuZCBpcyByZW5kZXJlZCBpbnRvIEhUTUwgZWxlbWVudC5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfVlJ9OiBJbW1lcnNpdmUgVlIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUiBkZXZpY2Ugd2l0aFxuICAgICAqIGJlc3QgYXZhaWxhYmxlIHRyYWNraW5nIGZlYXR1cmVzLlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9BUn06IEltbWVyc2l2ZSBBUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSL0FSIGRldmljZVxuICAgICAqIHRoYXQgaXMgaW50ZW5kZWQgdG8gYmUgYmxlbmRlZCB3aXRoIHJlYWwtd29ybGQgZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChhcHAueHIuaXNBdmFpbGFibGUocGMuWFJUWVBFX1ZSKSkge1xuICAgICAqICAgICAvLyBWUiBpcyBhdmFpbGFibGVcbiAgICAgKiB9XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3BlY2lmaWVkIHNlc3Npb24gdHlwZSBpcyBhdmFpbGFibGUuXG4gICAgICovXG4gICAgaXNBdmFpbGFibGUodHlwZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlW3R5cGVdO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXNzaW9uU3VwcG9ydENoZWNrKGtleSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZSBtYW51YWwgcm9vbSBjYXB0dXJlLiBJZiB0aGUgdW5kZXJseWluZyBYUiBzeXN0ZW0gc3VwcG9ydHMgbWFudWFsIGNhcHR1cmUgb2YgdGhlXG4gICAgICogcm9vbSwgaXQgd2lsbCBzdGFydCB0aGUgY2FwdHVyaW5nIHByb2Nlc3MsIHdoaWNoIGNhbiBhZmZlY3QgcGxhbmUgYW5kIG1lc2ggZGV0ZWN0aW9uLFxuICAgICAqIGFuZCBpbXByb3ZlIGhpdC10ZXN0IHF1YWxpdHkgYWdhaW5zdCByZWFsLXdvcmxkIGdlb21ldHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtYclJvb21DYXB0dXJlQ2FsbGJhY2t9IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGZpcmVkIG9uY2UgY2FwdHVyZSBpcyBjb21wbGV0ZVxuICAgICAqIG9yIGZhaWxlZC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdGhpcy5hcHAueHIuaW5pdGlhdGVSb29tQ2FwdHVyZSgoZXJyKSA9PiB7XG4gICAgICogICAgIGlmIChlcnIpIHtcbiAgICAgKiAgICAgICAgIC8vIGNhcHR1cmUgZmFpbGVkXG4gICAgICogICAgICAgICByZXR1cm47XG4gICAgICogICAgIH1cbiAgICAgKiAgICAgLy8gY2FwdHVyZSB3YXMgc3VjY2Vzc2Z1bFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluaXRpYXRlUm9vbUNhcHR1cmUoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoJ1Nlc3Npb24gaXMgbm90IGFjdGl2ZScpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24uaW5pdGlhdGVSb29tQ2FwdHVyZSkge1xuICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdTZXNzaW9uIGRvZXMgbm90IHN1cHBvcnQgbWFudWFsIHJvb20gY2FwdHVyZScpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24uaW5pdGlhdGVSb29tQ2FwdHVyZSgpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXNzaW9uU3VwcG9ydENoZWNrKHR5cGUpIHtcbiAgICAgICAgbmF2aWdhdG9yLnhyLmlzU2Vzc2lvblN1cHBvcnRlZCh0eXBlKS50aGVuKChhdmFpbGFibGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdmFpbGFibGVbdHlwZV0gPT09IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9IGF2YWlsYWJsZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlJywgdHlwZSwgYXZhaWxhYmxlKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlOicgKyB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7WFJTZXNzaW9ufSBzZXNzaW9uIC0gWFIgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gU3BhY2UgdHlwZSB0byByZXF1ZXN0IGZvciB0aGUgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIHRvIGNhbGwgd2hlbiBzZXNzaW9uIGlzIHN0YXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TZXNzaW9uU3RhcnQoc2Vzc2lvbiwgc3BhY2VUeXBlLCBjYWxsYmFjaykge1xuICAgICAgICBsZXQgZmFpbGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IHNlc3Npb247XG5cbiAgICAgICAgY29uc3Qgb25WaXNpYmlsaXR5Q2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCd2aXNpYmlsaXR5OmNoYW5nZScsIHNlc3Npb24udmlzaWJpbGl0eVN0YXRlKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvbkNsaXBQbGFuZXNDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKHRoaXMuX2NhbWVyYS5uZWFyQ2xpcCwgdGhpcy5fY2FtZXJhLmZhckNsaXApO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGNsZWFuIHVwIG9uY2Ugc2Vzc2lvbiBpcyBlbmRlZFxuICAgICAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYW1lcmEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmEub2ZmKCdzZXRfbmVhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9mYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmEgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZXNzaW9uLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZCcsIG9uRW5kKTtcbiAgICAgICAgICAgIHNlc3Npb24ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uVmlzaWJpbGl0eUNoYW5nZSk7XG5cbiAgICAgICAgICAgIGlmICghZmFpbGVkKSB0aGlzLmZpcmUoJ2VuZCcpO1xuXG4gICAgICAgICAgICB0aGlzLl9zZXNzaW9uID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3JlZmVyZW5jZVNwYWNlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gMDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IDA7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIG9sZCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgd2lsbCBuZXZlciBiZSB0cmlnZ2VyZWQsXG4gICAgICAgICAgICAvLyBzbyBxdWV1ZSB1cCBuZXcgdGlja1xuICAgICAgICAgICAgaWYgKHRoaXMuYXBwLnN5c3RlbXMpXG4gICAgICAgICAgICAgICAgdGhpcy5hcHAudGljaygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNlc3Npb24uYWRkRXZlbnRMaXN0ZW5lcignZW5kJywgb25FbmQpO1xuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpO1xuXG4gICAgICAgIHRoaXMuX2NhbWVyYS5vbignc2V0X25lYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLm9uKCdzZXRfZmFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG5cbiAgICAgICAgLy8gQSBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yIHNjYWxlIG9mIDEgaXMgdGhlIGZ1bGwgcmVzb2x1dGlvbiBvZiB0aGUgZGlzcGxheVxuICAgICAgICAvLyBzbyB3ZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGlzIGJhc2VkIG9uIGRldmljZVBpeGVsUmF0aW8gb2YgdGhlIGRpc2xheSBhbmQgd2hhdFxuICAgICAgICAvLyB3ZSd2ZSBzZXQgdGhpcyBpbiB0aGUgZ3JhcGhpY3MgZGV2aWNlXG4gICAgICAgIERlYnVnLmFzc2VydCh3aW5kb3csICd3aW5kb3cgaXMgbmVlZGVkIHRvIHNjYWxlIHRoZSBYUiBmcmFtZWJ1ZmZlci4gQXJlIHlvdSBydW5uaW5nIFhSIGhlYWRsZXNzPycpO1xuXG4gICAgICAgIHRoaXMuX2NyZWF0ZUJhc2VMYXllcigpO1xuXG4gICAgICAgIC8vIHJlcXVlc3QgcmVmZXJlbmNlIHNwYWNlXG4gICAgICAgIHNlc3Npb24ucmVxdWVzdFJlZmVyZW5jZVNwYWNlKHNwYWNlVHlwZSkudGhlbigocmVmZXJlbmNlU3BhY2UpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3JlZmVyZW5jZVNwYWNlID0gcmVmZXJlbmNlU3BhY2U7XG5cbiAgICAgICAgICAgIC8vIG9sZCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgd2lsbCBuZXZlciBiZSB0cmlnZ2VyZWQsXG4gICAgICAgICAgICAvLyBzbyBxdWV1ZSB1cCBuZXcgdGlja1xuICAgICAgICAgICAgdGhpcy5hcHAudGljaygpO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzdGFydCcpO1xuICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgICBzZXNzaW9uLmVuZCgpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhleCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbmVhciAtIE5lYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhciAtIEZhciBwbGFuZSBkaXN0YW5jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRDbGlwUGxhbmVzKG5lYXIsIGZhcikge1xuICAgICAgICBpZiAodGhpcy5fZGVwdGhOZWFyID09PSBuZWFyICYmIHRoaXMuX2RlcHRoRmFyID09PSBmYXIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZGVwdGhOZWFyID0gbmVhcjtcbiAgICAgICAgdGhpcy5fZGVwdGhGYXIgPSBmYXI7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIGlmIHNlc3Npb24gaXMgYXZhaWxhYmxlLFxuICAgICAgICAvLyBxdWV1ZSB1cCByZW5kZXIgc3RhdGUgdXBkYXRlXG4gICAgICAgIHRoaXMuX3Nlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgZGVwdGhOZWFyOiB0aGlzLl9kZXB0aE5lYXIsXG4gICAgICAgICAgICBkZXB0aEZhcjogdGhpcy5fZGVwdGhGYXJcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUJhc2VMYXllcigpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IGZyYW1lYnVmZmVyU2NhbGVGYWN0b3IgPSBkZXZpY2UubWF4UGl4ZWxSYXRpbyAvIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuXG4gICAgICAgIHRoaXMuX2Jhc2VMYXllciA9IG5ldyBYUldlYkdMTGF5ZXIodGhpcy5fc2Vzc2lvbiwgZGV2aWNlLmdsLCB7XG4gICAgICAgICAgICBhbHBoYTogdHJ1ZSxcbiAgICAgICAgICAgIGRlcHRoOiB0cnVlLFxuICAgICAgICAgICAgc3RlbmNpbDogdHJ1ZSxcbiAgICAgICAgICAgIGZyYW1lYnVmZmVyU2NhbGVGYWN0b3I6IGZyYW1lYnVmZmVyU2NhbGVGYWN0b3IsXG4gICAgICAgICAgICBhbnRpYWxpYXM6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGRldmljZVR5cGUgPSBkZXZpY2UuZGV2aWNlVHlwZTtcbiAgICAgICAgaWYgKChkZXZpY2VUeXBlID09PSBERVZJQ0VUWVBFX1dFQkdMMSB8fCBkZXZpY2VUeXBlID09PSBERVZJQ0VUWVBFX1dFQkdMMikgJiYgd2luZG93LlhSV2ViR0xCaW5kaW5nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoaXMud2ViZ2xCaW5kaW5nID0gbmV3IFhSV2ViR0xCaW5kaW5nKHRoaXMuX3Nlc3Npb24sIGRldmljZS5nbCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgYmFzZUxheWVyOiB0aGlzLl9iYXNlTGF5ZXIsXG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25EZXZpY2VMb3N0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2xCaW5kaW5nKVxuICAgICAgICAgICAgdGhpcy53ZWJnbEJpbmRpbmcgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2Jhc2VMYXllciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbi51cGRhdGVSZW5kZXJTdGF0ZSh7XG4gICAgICAgICAgICBiYXNlTGF5ZXI6IHRoaXMuX2Jhc2VMYXllcixcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vbkRldmljZVJlc3RvcmVkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5nbC5tYWtlWFJDb21wYXRpYmxlKClcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUJhc2VMYXllcigpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCAwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHVwZGF0ZSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gY2FudmFzIHJlc29sdXRpb24gc2hvdWxkIGJlIHNldCBvbiBmaXJzdCBmcmFtZSBhdmFpbGFiaWxpdHkgb3IgcmVzb2x1dGlvbiBjaGFuZ2VzXG4gICAgICAgIGNvbnN0IHdpZHRoID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXIuZnJhbWVidWZmZXJXaWR0aDtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXIuZnJhbWVidWZmZXJIZWlnaHQ7XG4gICAgICAgIGlmICh0aGlzLl93aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5faGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5zZXRSZXNvbHV0aW9uKHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcG9zZSA9IGZyYW1lLmdldFZpZXdlclBvc2UodGhpcy5fcmVmZXJlbmNlU3BhY2UpO1xuXG4gICAgICAgIGlmICghcG9zZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGxlbmd0aE9sZCA9IHRoaXMudmlld3MubGlzdC5sZW5ndGg7XG5cbiAgICAgICAgLy8gYWRkIHZpZXdzXG4gICAgICAgIHRoaXMudmlld3MudXBkYXRlKGZyYW1lLCBwb3NlLnZpZXdzKTtcblxuICAgICAgICAvLyByZXNldCBwb3NpdGlvblxuICAgICAgICBjb25zdCBwb3NlUG9zaXRpb24gPSBwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbjtcbiAgICAgICAgY29uc3QgcG9zZU9yaWVudGF0aW9uID0gcG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb247XG4gICAgICAgIHRoaXMuX2xvY2FsUG9zaXRpb24uc2V0KHBvc2VQb3NpdGlvbi54LCBwb3NlUG9zaXRpb24ueSwgcG9zZVBvc2l0aW9uLnopO1xuICAgICAgICB0aGlzLl9sb2NhbFJvdGF0aW9uLnNldChwb3NlT3JpZW50YXRpb24ueCwgcG9zZU9yaWVudGF0aW9uLnksIHBvc2VPcmllbnRhdGlvbi56LCBwb3NlT3JpZW50YXRpb24udyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBjYW1lcmEgZm92IHByb3BlcnRpZXMgb25seSB3aGVuIHdlIGhhZCAwIHZpZXdzXG4gICAgICAgIGlmIChsZW5ndGhPbGQgPT09IDAgJiYgdGhpcy52aWV3cy5saXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLnZpZXdzLmxpc3RbMF07XG5cbiAgICAgICAgICAgIHZpZXdQcm9qTWF0LmNvcHkodmlldy5wcm9qTWF0KTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB2aWV3UHJvak1hdC5kYXRhO1xuXG4gICAgICAgICAgICBjb25zdCBmb3YgPSAoMi4wICogTWF0aC5hdGFuKDEuMCAvIGRhdGFbNV0pICogMTgwLjApIC8gTWF0aC5QSTtcbiAgICAgICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvID0gZGF0YVs1XSAvIGRhdGFbMF07XG4gICAgICAgICAgICBjb25zdCBmYXJDbGlwID0gZGF0YVsxNF0gLyAoZGF0YVsxMF0gKyAxKTtcbiAgICAgICAgICAgIGNvbnN0IG5lYXJDbGlwID0gZGF0YVsxNF0gLyAoZGF0YVsxMF0gLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGhvcml6b250YWxGb3YgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdGhpcy5fY2FtZXJhLmNhbWVyYTtcbiAgICAgICAgICAgIGNhbWVyYS5zZXRYclByb3BlcnRpZXMoe1xuICAgICAgICAgICAgICAgIGFzcGVjdFJhdGlvLFxuICAgICAgICAgICAgICAgIGZhckNsaXAsXG4gICAgICAgICAgICAgICAgZm92LFxuICAgICAgICAgICAgICAgIGhvcml6b250YWxGb3YsXG4gICAgICAgICAgICAgICAgbmVhckNsaXBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJvdGF0ZSBjYW1lcmEgYmFzZWQgb24gY2FsY3VsYXRlZCB2ZWN0b3JzXG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEuX25vZGUuc2V0TG9jYWxQb3NpdGlvbih0aGlzLl9sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS5fbm9kZS5zZXRMb2NhbFJvdGF0aW9uKHRoaXMuX2xvY2FsUm90YXRpb24pO1xuXG4gICAgICAgIHRoaXMuaW5wdXQudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5oaXRUZXN0LnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmhpdFRlc3QudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRFc3RpbWF0aW9uLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0RXN0aW1hdGlvbi51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmltYWdlVHJhY2tpbmcudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuYW5jaG9ycy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5hbmNob3JzLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnBsYW5lRGV0ZWN0aW9uLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLnBsYW5lRGV0ZWN0aW9uLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcudXBkYXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lc2hEZXRlY3Rpb24uc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMubWVzaERldGVjdGlvbi51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCd1cGRhdGUnLCBmcmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBYUiBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgc2Vzc2lvbiBpcyBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGFjdGl2ZSgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHR5cGUgb2YgY3VycmVudGx5IHJ1bm5pbmcgWFIgc2Vzc2lvbiBvciBudWxsIGlmIG5vIHNlc3Npb24gaXMgcnVubmluZy4gQ2FuIGJlIGFueSBvZlxuICAgICAqIFhSVFlQRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHJlZmVyZW5jZSBzcGFjZSB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzXG4gICAgICogcnVubmluZy4gQ2FuIGJlIGFueSBvZiBYUlNQQUNFXyouXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHNwYWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwYWNlVHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gWFJTZXNzaW9uIG9mIFdlYlhSLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdHxudWxsfVxuICAgICAqL1xuICAgIGdldCBzZXNzaW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY3RpdmUgY2FtZXJhIGZvciB3aGljaCBYUiBzZXNzaW9uIGlzIHJ1bm5pbmcgb3IgbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eXxudWxsfVxuICAgICAqL1xuICAgIGdldCBjYW1lcmEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEgPyB0aGlzLl9jYW1lcmEuZW50aXR5IDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmRpY2F0ZXMgd2hldGhlciBXZWJYUiBjb250ZW50IGlzIGN1cnJlbnRseSB2aXNpYmxlIHRvIHRoZSB1c2VyLCBhbmQgaWYgaXQgaXMsIHdoZXRoZXIgaXQnc1xuICAgICAqIHRoZSBwcmltYXJ5IGZvY3VzLiBDYW4gYmUgJ2hpZGRlbicsICd2aXNpYmxlJyBvciAndmlzaWJsZS1ibHVycmVkJy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB2aXNpYmlsaXR5U3RhdGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9zZXNzaW9uLnZpc2liaWxpdHlTdGF0ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyTWFuYWdlciB9O1xuIl0sIm5hbWVzIjpbIlhyTWFuYWdlciIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIm5hdmlnYXRvciIsInhyIiwiX2F2YWlsYWJsZSIsIl90eXBlIiwiX3NwYWNlVHlwZSIsIl9zZXNzaW9uIiwiX2Jhc2VMYXllciIsIndlYmdsQmluZGluZyIsIl9yZWZlcmVuY2VTcGFjZSIsImRlcHRoU2Vuc2luZyIsImRvbU92ZXJsYXkiLCJoaXRUZXN0IiwiaW1hZ2VUcmFja2luZyIsInBsYW5lRGV0ZWN0aW9uIiwibWVzaERldGVjdGlvbiIsImlucHV0IiwibGlnaHRFc3RpbWF0aW9uIiwidmlld3MiLCJhbmNob3JzIiwiX2NhbWVyYSIsIl9sb2NhbFBvc2l0aW9uIiwiVmVjMyIsIl9sb2NhbFJvdGF0aW9uIiwiUXVhdCIsIl9kZXB0aE5lYXIiLCJfZGVwdGhGYXIiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiWFJUWVBFX0lOTElORSIsIlhSVFlQRV9WUiIsIlhSVFlQRV9BUiIsIlhyVmlld3MiLCJYckRlcHRoU2Vuc2luZyIsIlhyRG9tT3ZlcmxheSIsIlhySGl0VGVzdCIsIlhySW1hZ2VUcmFja2luZyIsIlhyUGxhbmVEZXRlY3Rpb24iLCJYck1lc2hEZXRlY3Rpb24iLCJYcklucHV0IiwiWHJMaWdodEVzdGltYXRpb24iLCJYckFuY2hvcnMiLCJhZGRFdmVudExpc3RlbmVyIiwiX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrIiwiZ3JhcGhpY3NEZXZpY2UiLCJvbiIsIl9vbkRldmljZUxvc3QiLCJfb25EZXZpY2VSZXN0b3JlZCIsImRlc3Ryb3kiLCJzdGFydCIsImNhbWVyYSIsInR5cGUiLCJzcGFjZVR5cGUiLCJvcHRpb25zIiwiX3RoaXMkYXBwJGdyYXBoaWNzRGV2IiwiX3RoaXMkYXBwJGdyYXBoaWNzRGV2MiIsImNhbGxiYWNrIiwiRXJyb3IiLCJfc2V0Q2xpcFBsYW5lcyIsIm5lYXJDbGlwIiwiZmFyQ2xpcCIsIm9wdHMiLCJyZXF1aXJlZEZlYXR1cmVzIiwib3B0aW9uYWxGZWF0dXJlcyIsIndlYmdsIiwiaXNXZWJHTDEiLCJpc1dlYkdMMiIsInB1c2giLCJzdXBwb3J0ZWQiLCJyb290IiwidXNhZ2VQcmVmZXJlbmNlIiwiWFJERVBUSFNFTlNJTkdVU0FHRV9DUFUiLCJkYXRhRm9ybWF0UHJlZmVyZW5jZSIsIlhSREVQVEhTRU5TSU5HRk9STUFUX0w4QTgiLCJpbmQiLCJpbmRleE9mIiwic3BsaWNlIiwidW5zaGlmdCIsImNhbWVyYUNvbG9yIiwic3VwcG9ydGVkQ29sb3IiLCJjb25jYXQiLCJpbWFnZXMiLCJsZW5ndGgiLCJwcmVwYXJlSW1hZ2VzIiwiZXJyIiwidHJhY2tlZEltYWdlcyIsImZpcmUiLCJfb25TdGFydE9wdGlvbnNSZWFkeSIsInJlcXVlc3RTZXNzaW9uIiwidGhlbiIsInNlc3Npb24iLCJfb25TZXNzaW9uU3RhcnQiLCJjYXRjaCIsImV4IiwiZW5kIiwib25jZSIsImlzQXZhaWxhYmxlIiwia2V5IiwiX3Nlc3Npb25TdXBwb3J0Q2hlY2siLCJpbml0aWF0ZVJvb21DYXB0dXJlIiwiaXNTZXNzaW9uU3VwcG9ydGVkIiwiYXZhaWxhYmxlIiwiZmFpbGVkIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwidmlzaWJpbGl0eVN0YXRlIiwib25DbGlwUGxhbmVzQ2hhbmdlIiwib25FbmQiLCJvZmYiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwic3lzdGVtcyIsInRpY2siLCJEZWJ1ZyIsImFzc2VydCIsIndpbmRvdyIsIl9jcmVhdGVCYXNlTGF5ZXIiLCJyZXF1ZXN0UmVmZXJlbmNlU3BhY2UiLCJyZWZlcmVuY2VTcGFjZSIsIm5lYXIiLCJmYXIiLCJ1cGRhdGVSZW5kZXJTdGF0ZSIsImRlcHRoTmVhciIsImRlcHRoRmFyIiwiZGV2aWNlIiwiZnJhbWVidWZmZXJTY2FsZUZhY3RvciIsIm1heFBpeGVsUmF0aW8iLCJkZXZpY2VQaXhlbFJhdGlvIiwiWFJXZWJHTExheWVyIiwiZ2wiLCJhbHBoYSIsImRlcHRoIiwic3RlbmNpbCIsImFudGlhbGlhcyIsImRldmljZVR5cGUiLCJERVZJQ0VUWVBFX1dFQkdMMSIsIkRFVklDRVRZUEVfV0VCR0wyIiwiWFJXZWJHTEJpbmRpbmciLCJiYXNlTGF5ZXIiLCJzZXRUaW1lb3V0IiwibWFrZVhSQ29tcGF0aWJsZSIsInVwZGF0ZSIsImZyYW1lIiwid2lkdGgiLCJyZW5kZXJTdGF0ZSIsImZyYW1lYnVmZmVyV2lkdGgiLCJoZWlnaHQiLCJmcmFtZWJ1ZmZlckhlaWdodCIsInNldFJlc29sdXRpb24iLCJwb3NlIiwiZ2V0Vmlld2VyUG9zZSIsImxlbmd0aE9sZCIsImxpc3QiLCJwb3NlUG9zaXRpb24iLCJ0cmFuc2Zvcm0iLCJwb3NpdGlvbiIsInBvc2VPcmllbnRhdGlvbiIsIm9yaWVudGF0aW9uIiwic2V0IiwieCIsInkiLCJ6IiwidyIsInZpZXdQcm9qTWF0IiwiTWF0NCIsInZpZXciLCJjb3B5IiwicHJvak1hdCIsImRhdGEiLCJmb3YiLCJNYXRoIiwiYXRhbiIsIlBJIiwiYXNwZWN0UmF0aW8iLCJob3Jpem9udGFsRm92Iiwic2V0WHJQcm9wZXJ0aWVzIiwiX25vZGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0TG9jYWxSb3RhdGlvbiIsImFjdGl2ZSIsImVudGl0eSIsIkVWRU5UX0FWQUlMQUJMRSIsIkVWRU5UX1NUQVJUIiwiRVZFTlRfRU5EIiwiRVZFTlRfVVBEQVRFIiwiRVZFTlRfRVJST1IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxTQUFTLFNBQVNDLFlBQVksQ0FBQztBQThPakM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLEdBQUcsRUFBRTtBQUNiLElBQUEsS0FBSyxFQUFFLENBQUE7QUEvS1g7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUEsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUg7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxVQUFVLEdBQUdDLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJLENBQUMsQ0FBQ0MsU0FBUyxDQUFDQyxFQUFFLENBQUE7QUFFL0M7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxVQUFVLEdBQUcsRUFBRSxDQUFB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
