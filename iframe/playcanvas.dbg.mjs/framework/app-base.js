import { version, revision } from '../core/core.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { TRACEID_RENDER_FRAME, TRACEID_RENDER_FRAME_TIME } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { math } from '../core/math/math.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, CULLFACE_NONE } from '../platform/graphics/constants.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { http } from '../platform/net/http.js';
import { LAYERID_WORLD, LAYERID_DEPTH, SORTMODE_NONE, LAYERID_SKYBOX, LAYERID_UI, SORTMODE_MANUAL, LAYERID_IMMEDIATE, SPECULAR_BLINN } from '../scene/constants.js';
import { setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { FrameGraph } from '../scene/frame-graph.js';
import { AreaLightLuts } from '../scene/area-light-luts.js';
import { Layer } from '../scene/layer.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { Scene } from '../scene/scene.js';
import { Material } from '../scene/materials/material.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { setDefaultMaterial } from '../scene/materials/default-material.js';
import { Asset } from './asset/asset.js';
import { AssetRegistry } from './asset/asset-registry.js';
import { BundleRegistry } from './bundle/bundle-registry.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { BundleHandler } from './handlers/bundle.js';
import { ResourceLoader } from './handlers/loader.js';
import { I18n } from './i18n/i18n.js';
import { ScriptRegistry } from './script/script-registry.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';
import { FILLMODE_KEEP_ASPECT, RESOLUTION_FIXED, RESOLUTION_AUTO, FILLMODE_FILL_WINDOW } from './constants.js';
import { getApplication, setApplication } from './globals.js';

// Mini-object used to measure progress of loading sets
class Progress {
  constructor(length) {
    this.length = length;
    this.count = 0;
  }
  inc() {
    this.count++;
  }
  done() {
    return this.count === this.length;
  }
}

/**
 * Callback used by {@link AppBase#configure} when configuration file is loaded and parsed (or
 * an error occurs).
 *
 * @callback ConfigureAppCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * Callback used by {@link AppBase#preload} when all assets (marked as 'preload') are loaded.
 *
 * @callback PreloadAppCallback
 */

/**
 * Gets the current application, if any.
 *
 * @type {AppBase|null}
 * @ignore
 */
let app = null;

/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 *
 * @augments EventHandler
 */
class AppBase extends EventHandler {
  /**
   * Create a new AppBase instance.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element.
   * @example
   * // Engine-only example: create the application manually
   * const options = new AppOptions();
   * const app = new pc.AppBase(canvas);
   * app.init(options);
   *
   * // Start the application's main loop
   * app.start();
   *
   * @hideconstructor
   */
  constructor(canvas) {
    super();
    /**
     * A request id returned by requestAnimationFrame, allowing us to cancel it.
     *
     * @ignore
     */
    this.frameRequestId = void 0;
    if ((version.indexOf('$')) < 0) {
      Debug.log(`Powered by PlayCanvas ${version} ${revision}`);
    }

    // Store application instance
    AppBase._applications[canvas.id] = this;
    setApplication(this);
    app = this;

    /** @private */
    this._destroyRequested = false;

    /** @private */
    this._inFrameUpdate = false;

    /** @private */
    this._time = 0;

    /**
     * Scales the global time delta. Defaults to 1.
     *
     * @type {number}
     * @example
     * // Set the app to run at half speed
     * this.app.timeScale = 0.5;
     */
    this.timeScale = 1;

    /**
     * Clamps per-frame delta time to an upper bound. Useful since returning from a tab
     * deactivation can generate huge values for dt, which can adversely affect game state.
     * Defaults to 0.1 (seconds).
     *
     * @type {number}
     * @example
     * // Don't clamp inter-frame times of 200ms or less
     * this.app.maxDeltaTime = 0.2;
     */
    this.maxDeltaTime = 0.1; // Maximum delta is 0.1s or 10 fps.

    /**
     * The total number of frames the application has updated since start() was called.
     *
     * @type {number}
     * @ignore
     */
    this.frame = 0;

    /**
     * When true, the application's render function is called every frame. Setting autoRender
     * to false is useful to applications where the rendered image may often be unchanged over
     * time. This can heavily reduce the application's load on the CPU and GPU. Defaults to
     * true.
     *
     * @type {boolean}
     * @example
     * // Disable rendering every frame and only render on a keydown event
     * this.app.autoRender = false;
     * this.app.keyboard.on('keydown', function (event) {
     *     this.app.renderNextFrame = true;
     * }, this);
     */
    this.autoRender = true;

    /**
     * Set to true to render the scene on the next iteration of the main loop. This only has an
     * effect if {@link AppBase#autoRender} is set to false. The value of renderNextFrame
     * is set back to false again as soon as the scene has been rendered.
     *
     * @type {boolean}
     * @example
     * // Render the scene only while space key is pressed
     * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
     *     this.app.renderNextFrame = true;
     * }
     */
    this.renderNextFrame = false;

    /**
     * Enable if you want entity type script attributes to not be re-mapped when an entity is
     * cloned.
     *
     * @type {boolean}
     * @ignore
     */
    this.useLegacyScriptAttributeCloning = script.legacy;
    this._librariesLoaded = false;
    this._fillMode = FILLMODE_KEEP_ASPECT;
    this._resolutionMode = RESOLUTION_FIXED;
    this._allowResize = true;

    /**
     * For backwards compatibility with scripts 1.0.
     *
     * @type {AppBase}
     * @deprecated
     * @ignore
     */
    this.context = this;
  }

  /**
   * Initialize the app.
   *
   * @param {import('./app-options.js').AppOptions} appOptions - Options specifying the init
   * parameters for the app.
   */
  init(appOptions) {
    const device = appOptions.graphicsDevice;
    Debug.assert(device, "The application cannot be created without a valid GraphicsDevice");

    /**
     * The graphics device used by the application.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.graphicsDevice = device;
    this._initDefaultMaterial();
    this._initProgramLibrary();
    this.stats = new ApplicationStats(device);

    /**
     * @type {import('../platform/sound/manager.js').SoundManager}
     * @private
     */
    this._soundManager = appOptions.soundManager;

    /**
     * The resource loader.
     *
     * @type {ResourceLoader}
     */
    this.loader = new ResourceLoader(this);

    /**
     * Stores all entities that have been created for this app by guid.
     *
     * @type {Object<string, Entity>}
     * @ignore
     */
    this._entityIndex = {};

    /**
     * The scene managed by the application.
     *
     * @type {Scene}
     * @example
     * // Set the tone mapping property of the application's scene
     * this.app.scene.toneMapping = pc.TONEMAP_FILMIC;
     */
    this.scene = new Scene(device);
    this._registerSceneImmediate(this.scene);

    /**
     * The root entity of the application.
     *
     * @type {Entity}
     * @example
     * // Return the first entity called 'Camera' in a depth-first search of the scene hierarchy
     * const camera = this.app.root.findByName('Camera');
     */
    this.root = new Entity();
    this.root._enabledInHierarchy = true;

    /**
     * The asset registry managed by the application.
     *
     * @type {AssetRegistry}
     * @example
     * // Search the asset registry for all assets with the tag 'vehicle'
     * const vehicleAssets = this.app.assets.findByTag('vehicle');
     */
    this.assets = new AssetRegistry(this.loader);
    if (appOptions.assetPrefix) this.assets.prefix = appOptions.assetPrefix;

    /**
     * @type {BundleRegistry}
     * @ignore
     */
    this.bundles = new BundleRegistry(this.assets);

    /**
     * Set this to false if you want to run without using bundles. We set it to true only if
     * TextDecoder is available because we currently rely on it for untarring.
     *
     * @type {boolean}
     * @ignore
     */
    this.enableBundles = typeof TextDecoder !== 'undefined';
    this.scriptsOrder = appOptions.scriptsOrder || [];

    /**
     * The application's script registry.
     *
     * @type {ScriptRegistry}
     */
    this.scripts = new ScriptRegistry(this);

    /**
     * Handles localization.
     *
     * @type {I18n}
     */
    this.i18n = new I18n(this);

    /**
     * The scene registry managed by the application.
     *
     * @type {SceneRegistry}
     * @example
     * // Search the scene registry for a item with the name 'racetrack1'
     * const sceneItem = this.app.scenes.find('racetrack1');
     *
     * // Load the scene using the item's url
     * this.app.scenes.loadScene(sceneItem.url);
     */
    this.scenes = new SceneRegistry(this);
    this.defaultLayerWorld = new Layer({
      name: "World",
      id: LAYERID_WORLD
    });
    this.defaultLayerDepth = new Layer({
      name: "Depth",
      id: LAYERID_DEPTH,
      enabled: false,
      opaqueSortMode: SORTMODE_NONE
    });
    this.defaultLayerSkybox = new Layer({
      name: "Skybox",
      id: LAYERID_SKYBOX,
      opaqueSortMode: SORTMODE_NONE
    });
    this.defaultLayerUi = new Layer({
      name: "UI",
      id: LAYERID_UI,
      transparentSortMode: SORTMODE_MANUAL
    });
    this.defaultLayerImmediate = new Layer({
      name: "Immediate",
      id: LAYERID_IMMEDIATE,
      opaqueSortMode: SORTMODE_NONE
    });
    const defaultLayerComposition = new LayerComposition("default");
    defaultLayerComposition.pushOpaque(this.defaultLayerWorld);
    defaultLayerComposition.pushOpaque(this.defaultLayerDepth);
    defaultLayerComposition.pushOpaque(this.defaultLayerSkybox);
    defaultLayerComposition.pushTransparent(this.defaultLayerWorld);
    defaultLayerComposition.pushOpaque(this.defaultLayerImmediate);
    defaultLayerComposition.pushTransparent(this.defaultLayerImmediate);
    defaultLayerComposition.pushTransparent(this.defaultLayerUi);
    this.scene.layers = defaultLayerComposition;

    // placeholder texture for area light LUTs
    AreaLightLuts.createPlaceholder(device);

    /**
     * The forward renderer.
     *
     * @type {ForwardRenderer}
     * @ignore
     */
    this.renderer = new ForwardRenderer(device);
    this.renderer.scene = this.scene;

    /**
     * The frame graph.
     *
     * @type {FrameGraph}
     * @ignore
     */
    this.frameGraph = new FrameGraph();

    /**
     * The run-time lightmapper.
     *
     * @type {import('./lightmapper/lightmapper.js').Lightmapper}
     */
    this.lightmapper = null;
    if (appOptions.lightmapper) {
      this.lightmapper = new appOptions.lightmapper(device, this.root, this.scene, this.renderer, this.assets);
      this.once('prerender', this._firstBake, this);
    }

    /**
     * The application's batch manager.
     *
     * @type {import('../scene/batching/batch-manager.js').BatchManager}
     * @private
     */
    this._batcher = null;
    if (appOptions.batchManager) {
      this._batcher = new appOptions.batchManager(device, this.root, this.scene);
      this.once('prerender', this._firstBatch, this);
    }

    /**
     * The keyboard device.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    this.keyboard = appOptions.keyboard || null;

    /**
     * The mouse device.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    this.mouse = appOptions.mouse || null;

    /**
     * Used to get touch events input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    this.touch = appOptions.touch || null;

    /**
     * Used to access GamePad input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
     */
    this.gamepads = appOptions.gamepads || null;

    /**
     * Used to handle input for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    this.elementInput = appOptions.elementInput || null;
    if (this.elementInput) this.elementInput.app = this;

    /**
     * The XR Manager that provides ability to start VR/AR sessions.
     *
     * @type {import('./xr/xr-manager.js').XrManager}
     * @example
     * // check if VR is available
     * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
     *     // VR is available
     * }
     */
    this.xr = appOptions.xr ? new appOptions.xr(this) : null;
    if (this.elementInput) this.elementInput.attachSelectEvents();

    /**
     * @type {boolean}
     * @ignore
     */
    this._inTools = false;

    /**
     * @type {Asset|null}
     * @private
     */
    this._skyboxAsset = null;

    /**
     * @type {string}
     * @ignore
     */
    this._scriptPrefix = appOptions.scriptPrefix || '';
    if (this.enableBundles) {
      this.loader.addHandler("bundle", new BundleHandler(this));
    }

    // create and register all required resource handlers
    appOptions.resourceHandlers.forEach(resourceHandler => {
      const handler = new resourceHandler(this);
      this.loader.addHandler(handler.handlerType, handler);
    });

    /**
     * The application's component system registry. The Application constructor adds the
     * following component systems to its component system registry:
     *
     * - anim ({@link AnimComponentSystem})
     * - animation ({@link AnimationComponentSystem})
     * - audiolistener ({@link AudioListenerComponentSystem})
     * - button ({@link ButtonComponentSystem})
     * - camera ({@link CameraComponentSystem})
     * - collision ({@link CollisionComponentSystem})
     * - element ({@link ElementComponentSystem})
     * - layoutchild ({@link LayoutChildComponentSystem})
     * - layoutgroup ({@link LayoutGroupComponentSystem})
     * - light ({@link LightComponentSystem})
     * - model ({@link ModelComponentSystem})
     * - particlesystem ({@link ParticleSystemComponentSystem})
     * - rigidbody ({@link RigidBodyComponentSystem})
     * - render ({@link RenderComponentSystem})
     * - screen ({@link ScreenComponentSystem})
     * - script ({@link ScriptComponentSystem})
     * - scrollbar ({@link ScrollbarComponentSystem})
     * - scrollview ({@link ScrollViewComponentSystem})
     * - sound ({@link SoundComponentSystem})
     * - sprite ({@link SpriteComponentSystem})
     *
     * @type {ComponentSystemRegistry}
     * @example
     * // Set global gravity to zero
     * this.app.systems.rigidbody.gravity.set(0, 0, 0);
     * @example
     * // Set the global sound volume to 50%
     * this.app.systems.sound.volume = 0.5;
     */
    this.systems = new ComponentSystemRegistry();

    // create and register all required component systems
    appOptions.componentSystems.forEach(componentSystem => {
      this.systems.add(new componentSystem(this));
    });

    /** @private */
    this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

    // Depending on browser add the correct visibilitychange event and store the name of the
    // hidden attribute in this._hiddenAttr.
    if (typeof document !== 'undefined') {
      if (document.hidden !== undefined) {
        this._hiddenAttr = 'hidden';
        document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
      } else if (document.mozHidden !== undefined) {
        this._hiddenAttr = 'mozHidden';
        document.addEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
      } else if (document.msHidden !== undefined) {
        this._hiddenAttr = 'msHidden';
        document.addEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
      } else if (document.webkitHidden !== undefined) {
        this._hiddenAttr = 'webkitHidden';
        document.addEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
      }
    }

    // bind tick function to current scope
    /* eslint-disable-next-line no-use-before-define */
    this.tick = makeTick(this); // Circular linting issue as makeTick and Application reference each other
  }

  /**
   * Get the current application. In the case where there are multiple running applications, the
   * function can get an application based on a supplied canvas id. This function is particularly
   * useful when the current Application is not readily available. For example, in the JavaScript
   * console of the browser's developer tools.
   *
   * @param {string} [id] - If defined, the returned application should use the canvas which has
   * this id. Otherwise current application will be returned.
   * @returns {AppBase|undefined} The running application, if any.
   * @example
   * const app = pc.AppBase.getApplication();
   */
  static getApplication(id) {
    return id ? AppBase._applications[id] : getApplication();
  }

  /** @private */
  _initDefaultMaterial() {
    const material = new StandardMaterial();
    material.name = "Default Material";
    material.shadingModel = SPECULAR_BLINN;
    setDefaultMaterial(this.graphicsDevice, material);
  }

  /** @private */
  _initProgramLibrary() {
    const library = new ProgramLibrary(this.graphicsDevice, new StandardMaterial());
    setProgramLibrary(this.graphicsDevice, library);
  }

  /**
   * @type {import('../platform/sound/manager.js').SoundManager}
   * @ignore
   */
  get soundManager() {
    return this._soundManager;
  }

  /**
   * The application's batch manager. The batch manager is used to merge mesh instances in
   * the scene, which reduces the overall number of draw calls, thereby boosting performance.
   *
   * @type {import('../scene/batching/batch-manager.js').BatchManager}
   */
  get batcher() {
    Debug.assert(this._batcher, "BatchManager has not been created and is required for correct functionality.");
    return this._batcher;
  }

  /**
   * The current fill mode of the canvas. Can be:
   *
   * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
   * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
   * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
   * maintaining the aspect ratio.
   *
   * @type {string}
   */
  get fillMode() {
    return this._fillMode;
  }

  /**
   * The current resolution mode of the canvas, Can be:
   *
   * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
   * match canvas client size.
   * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
   *
   * @type {string}
   */
  get resolutionMode() {
    return this._resolutionMode;
  }

  /**
   * Load the application configuration file and apply application properties and fill the asset
   * registry.
   *
   * @param {string} url - The URL of the configuration file to load.
   * @param {ConfigureAppCallback} callback - The Function called when the configuration file is
   * loaded and parsed (or an error occurs).
   */
  configure(url, callback) {
    http.get(url, (err, response) => {
      if (err) {
        callback(err);
        return;
      }
      const props = response.application_properties;
      const scenes = response.scenes;
      const assets = response.assets;
      this._parseApplicationProperties(props, err => {
        this._parseScenes(scenes);
        this._parseAssets(assets);
        if (!err) {
          callback(null);
        } else {
          callback(err);
        }
      });
    });
  }

  /**
   * Load all assets in the asset registry that are marked as 'preload'.
   *
   * @param {PreloadAppCallback} callback - Function called when all assets are loaded.
   */
  preload(callback) {
    this.fire("preload:start");

    // get list of assets to preload
    const assets = this.assets.list({
      preload: true
    });
    const progress = new Progress(assets.length);
    let _done = false;

    // check if all loading is done
    const done = () => {
      // do not proceed if application destroyed
      if (!this.graphicsDevice) {
        return;
      }
      if (!_done && progress.done()) {
        _done = true;
        this.fire("preload:end");
        callback();
      }
    };

    // totals loading progress of assets
    const total = assets.length;
    if (progress.length) {
      const onAssetLoad = asset => {
        progress.inc();
        this.fire('preload:progress', progress.count / total);
        if (progress.done()) done();
      };
      const onAssetError = (err, asset) => {
        progress.inc();
        this.fire('preload:progress', progress.count / total);
        if (progress.done()) done();
      };

      // for each asset
      for (let i = 0; i < assets.length; i++) {
        if (!assets[i].loaded) {
          assets[i].once('load', onAssetLoad);
          assets[i].once('error', onAssetError);
          this.assets.load(assets[i]);
        } else {
          progress.inc();
          this.fire("preload:progress", progress.count / total);
          if (progress.done()) done();
        }
      }
    } else {
      done();
    }
  }
  _preloadScripts(sceneData, callback) {
    if (!script.legacy) {
      callback();
      return;
    }
    this.systems.script.preloading = true;
    const scripts = this._getScriptReferences(sceneData);
    const l = scripts.length;
    const progress = new Progress(l);
    const regex = /^http(s)?:\/\//;
    if (l) {
      const onLoad = (err, ScriptType) => {
        if (err) console.error(err);
        progress.inc();
        if (progress.done()) {
          this.systems.script.preloading = false;
          callback();
        }
      };
      for (let i = 0; i < l; i++) {
        let scriptUrl = scripts[i];
        // support absolute URLs (for now)
        if (!regex.test(scriptUrl.toLowerCase()) && this._scriptPrefix) scriptUrl = path.join(this._scriptPrefix, scripts[i]);
        this.loader.load(scriptUrl, 'script', onLoad);
      }
    } else {
      this.systems.script.preloading = false;
      callback();
    }
  }

  // set application properties from data file
  _parseApplicationProperties(props, callback) {
    // configure retrying assets
    if (typeof props.maxAssetRetries === 'number' && props.maxAssetRetries > 0) {
      this.loader.enableRetry(props.maxAssetRetries);
    }

    // TODO: remove this temporary block after migrating properties
    if (!props.useDevicePixelRatio) props.useDevicePixelRatio = props.use_device_pixel_ratio;
    if (!props.resolutionMode) props.resolutionMode = props.resolution_mode;
    if (!props.fillMode) props.fillMode = props.fill_mode;
    this._width = props.width;
    this._height = props.height;
    if (props.useDevicePixelRatio) {
      this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
    }
    this.setCanvasResolution(props.resolutionMode, this._width, this._height);
    this.setCanvasFillMode(props.fillMode, this._width, this._height);

    // set up layers
    if (props.layers && props.layerOrder) {
      const composition = new LayerComposition("application");
      const layers = {};
      for (const key in props.layers) {
        const data = props.layers[key];
        data.id = parseInt(key, 10);
        // depth layer should only be enabled when needed
        // by incrementing its ref counter
        data.enabled = data.id !== LAYERID_DEPTH;
        layers[key] = new Layer(data);
      }
      for (let i = 0, len = props.layerOrder.length; i < len; i++) {
        const sublayer = props.layerOrder[i];
        const layer = layers[sublayer.layer];
        if (!layer) continue;
        if (sublayer.transparent) {
          composition.pushTransparent(layer);
        } else {
          composition.pushOpaque(layer);
        }
        composition.subLayerEnabled[i] = sublayer.enabled;
      }
      this.scene.layers = composition;
    }

    // add batch groups
    if (props.batchGroups) {
      const batcher = this.batcher;
      if (batcher) {
        for (let i = 0, len = props.batchGroups.length; i < len; i++) {
          const grp = props.batchGroups[i];
          batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
        }
      }
    }

    // set localization assets
    if (props.i18nAssets) {
      this.i18n.assets = props.i18nAssets;
    }
    this._loadLibraries(props.libraries, callback);
  }

  /**
   * @param {string[]} urls - List of URLs to load.
   * @param {Function} callback - Callback function.
   * @private
   */
  _loadLibraries(urls, callback) {
    const len = urls.length;
    let count = len;
    const regex = /^http(s)?:\/\//;
    if (len) {
      const onLoad = (err, script) => {
        count--;
        if (err) {
          callback(err);
        } else if (count === 0) {
          this.onLibrariesLoaded();
          callback(null);
        }
      };
      for (let i = 0; i < len; ++i) {
        let url = urls[i];
        if (!regex.test(url.toLowerCase()) && this._scriptPrefix) url = path.join(this._scriptPrefix, url);
        this.loader.load(url, 'script', onLoad);
      }
    } else {
      this.onLibrariesLoaded();
      callback(null);
    }
  }

  /**
   * Insert scene name/urls into the registry.
   *
   * @param {*} scenes - Scenes to add to the scene registry.
   * @private
   */
  _parseScenes(scenes) {
    if (!scenes) return;
    for (let i = 0; i < scenes.length; i++) {
      this.scenes.add(scenes[i].name, scenes[i].url);
    }
  }

  /**
   * Insert assets into registry.
   *
   * @param {*} assets - Assets to insert.
   * @private
   */
  _parseAssets(assets) {
    const list = [];
    const scriptsIndex = {};
    const bundlesIndex = {};
    if (!script.legacy) {
      // add scripts in order of loading first
      for (let i = 0; i < this.scriptsOrder.length; i++) {
        const id = this.scriptsOrder[i];
        if (!assets[id]) continue;
        scriptsIndex[id] = true;
        list.push(assets[id]);
      }

      // then add bundles
      if (this.enableBundles) {
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }

      // then add rest of assets
      for (const id in assets) {
        if (scriptsIndex[id] || bundlesIndex[id]) continue;
        list.push(assets[id]);
      }
    } else {
      if (this.enableBundles) {
        // add bundles
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }

      // then add rest of assets
      for (const id in assets) {
        if (bundlesIndex[id]) continue;
        list.push(assets[id]);
      }
    }
    for (let i = 0; i < list.length; i++) {
      const data = list[i];
      const asset = new Asset(data.name, data.type, data.file, data.data);
      asset.id = parseInt(data.id, 10);
      asset.preload = data.preload ? data.preload : false;
      // if this is a script asset and has already been embedded in the page then
      // mark it as loaded
      asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
      // tags
      asset.tags.add(data.tags);
      // i18n
      if (data.i18n) {
        for (const locale in data.i18n) {
          asset.addLocalizedAssetId(locale, data.i18n[locale]);
        }
      }
      // registry
      this.assets.add(asset);
    }
  }

  /**
   * @param {Scene} scene - The scene.
   * @returns {Array} - The list of scripts that are referenced by the scene.
   * @private
   */
  _getScriptReferences(scene) {
    let priorityScripts = [];
    if (scene.settings.priority_scripts) {
      priorityScripts = scene.settings.priority_scripts;
    }
    const _scripts = [];
    const _index = {};

    // first add priority scripts
    for (let i = 0; i < priorityScripts.length; i++) {
      _scripts.push(priorityScripts[i]);
      _index[priorityScripts[i]] = true;
    }

    // then iterate hierarchy to get referenced scripts
    const entities = scene.entities;
    for (const key in entities) {
      if (!entities[key].components.script) {
        continue;
      }
      const scripts = entities[key].components.script.scripts;
      for (let i = 0; i < scripts.length; i++) {
        if (_index[scripts[i].url]) continue;
        _scripts.push(scripts[i].url);
        _index[scripts[i].url] = true;
      }
    }
    return _scripts;
  }

  /**
   * Start the application. This function does the following:
   *
   * 1. Fires an event on the application named 'start'
   * 2. Calls initialize for all components on entities in the hierarchy
   * 3. Fires an event on the application named 'initialize'
   * 4. Calls postInitialize for all components on entities in the hierarchy
   * 5. Fires an event on the application named 'postinitialize'
   * 6. Starts executing the main loop of the application
   *
   * This function is called internally by PlayCanvas applications made in the Editor but you
   * will need to call start yourself if you are using the engine stand-alone.
   *
   * @example
   * app.start();
   */
  start() {
    Debug.call(() => {
      Debug.assert(!this._alreadyStarted, "The application can be started only one time.");
      this._alreadyStarted = true;
    });
    this.frame = 0;
    this.fire("start", {
      timestamp: now(),
      target: this
    });
    if (!this._librariesLoaded) {
      this.onLibrariesLoaded();
    }
    this.systems.fire('initialize', this.root);
    this.fire('initialize');
    this.systems.fire('postInitialize', this.root);
    this.systems.fire('postPostInitialize', this.root);
    this.fire('postinitialize');
    this.tick();
  }

  /**
   * Update all input devices managed by the application.
   *
   * @param {number} dt - The time in seconds since the last update.
   * @private
   */
  inputUpdate(dt) {
    if (this.controller) {
      this.controller.update(dt);
    }
    if (this.mouse) {
      this.mouse.update();
    }
    if (this.keyboard) {
      this.keyboard.update();
    }
    if (this.gamepads) {
      this.gamepads.update();
    }
  }

  /**
   * Update the application. This function will call the update functions and then the postUpdate
   * functions of all enabled components. It will then update the current state of all connected
   * input devices. This function is called internally in the application's main loop and does
   * not need to be called explicitly.
   *
   * @param {number} dt - The time delta in seconds since the last frame.
   */
  update(dt) {
    this.frame++;
    this.graphicsDevice.updateClientRect();
    this.stats.frame.updateStart = now();

    // Perform ComponentSystem update
    if (script.legacy) this.systems.fire('fixedUpdate', 1.0 / 60.0);
    this.systems.fire(this._inTools ? 'toolsUpdate' : 'update', dt);
    this.systems.fire('animationUpdate', dt);
    this.systems.fire('postUpdate', dt);

    // fire update event
    this.fire("update", dt);

    // update input devices
    this.inputUpdate(dt);
    this.stats.frame.updateTime = now() - this.stats.frame.updateStart;
  }
  frameStart() {
    this.graphicsDevice.frameStart();
  }
  frameEnd() {
    this.graphicsDevice.frameEnd();
  }

  /**
   * Render the application's scene. More specifically, the scene's {@link LayerComposition} is
   * rendered. This function is called internally in the application's main loop and does not
   * need to be called explicitly.
   *
   * @ignore
   */
  render() {
    this.stats.frame.renderStart = now();
    this.fire('prerender');
    this.root.syncHierarchy();
    if (this._batcher) {
      this._batcher.updateAll();
    }
    ForwardRenderer._skipRenderCounter = 0;

    // render the scene composition
    this.renderComposition(this.scene.layers);
    this.fire('postrender');
    this.stats.frame.renderTime = now() - this.stats.frame.renderStart;
  }

  // render a layer composition
  renderComposition(layerComposition) {
    DebugGraphics.clearGpuMarkers();
    this.renderer.buildFrameGraph(this.frameGraph, layerComposition);
    this.frameGraph.render(this.graphicsDevice);
  }

  /**
   * @param {number} now - The timestamp passed to the requestAnimationFrame callback.
   * @param {number} dt - The time delta in seconds since the last frame. This is subject to the
   * application's time scale and max delta values.
   * @param {number} ms - The time in milliseconds since the last frame.
   * @private
   */
  _fillFrameStatsBasic(now, dt, ms) {
    // Timing stats
    const stats = this.stats.frame;
    stats.dt = dt;
    stats.ms = ms;
    if (now > stats._timeToCountFrames) {
      stats.fps = stats._fpsAccum;
      stats._fpsAccum = 0;
      stats._timeToCountFrames = now + 1000;
    } else {
      stats._fpsAccum++;
    }

    // total draw call
    this.stats.drawCalls.total = this.graphicsDevice._drawCallsPerFrame;
    this.graphicsDevice._drawCallsPerFrame = 0;
  }

  /** @private */
  _fillFrameStats() {
    let stats = this.stats.frame;

    // Render stats
    stats.cameras = this.renderer._camerasRendered;
    stats.materials = this.renderer._materialSwitches;
    stats.shaders = this.graphicsDevice._shaderSwitchesPerFrame;
    stats.shadowMapUpdates = this.renderer._shadowMapUpdates;
    stats.shadowMapTime = this.renderer._shadowMapTime;
    stats.depthMapTime = this.renderer._depthMapTime;
    stats.forwardTime = this.renderer._forwardTime;
    const prims = this.graphicsDevice._primsPerFrame;
    stats.triangles = prims[PRIMITIVE_TRIANGLES] / 3 + Math.max(prims[PRIMITIVE_TRISTRIP] - 2, 0) + Math.max(prims[PRIMITIVE_TRIFAN] - 2, 0);
    stats.cullTime = this.renderer._cullTime;
    stats.sortTime = this.renderer._sortTime;
    stats.skinTime = this.renderer._skinTime;
    stats.morphTime = this.renderer._morphTime;
    stats.lightClusters = this.renderer._lightClusters;
    stats.lightClustersTime = this.renderer._lightClustersTime;
    stats.otherPrimitives = 0;
    for (let i = 0; i < prims.length; i++) {
      if (i < PRIMITIVE_TRIANGLES) {
        stats.otherPrimitives += prims[i];
      }
      prims[i] = 0;
    }
    this.renderer._camerasRendered = 0;
    this.renderer._materialSwitches = 0;
    this.renderer._shadowMapUpdates = 0;
    this.graphicsDevice._shaderSwitchesPerFrame = 0;
    this.renderer._cullTime = 0;
    this.renderer._layerCompositionUpdateTime = 0;
    this.renderer._lightClustersTime = 0;
    this.renderer._sortTime = 0;
    this.renderer._skinTime = 0;
    this.renderer._morphTime = 0;
    this.renderer._shadowMapTime = 0;
    this.renderer._depthMapTime = 0;
    this.renderer._forwardTime = 0;

    // Draw call stats
    stats = this.stats.drawCalls;
    stats.forward = this.renderer._forwardDrawCalls;
    stats.culled = this.renderer._numDrawCallsCulled;
    stats.depth = 0;
    stats.shadow = this.renderer._shadowDrawCalls;
    stats.skinned = this.renderer._skinDrawCalls;
    stats.immediate = 0;
    stats.instanced = 0;
    stats.removedByInstancing = 0;
    stats.misc = stats.total - (stats.forward + stats.shadow);
    this.renderer._depthDrawCalls = 0;
    this.renderer._shadowDrawCalls = 0;
    this.renderer._forwardDrawCalls = 0;
    this.renderer._numDrawCallsCulled = 0;
    this.renderer._skinDrawCalls = 0;
    this.renderer._immediateRendered = 0;
    this.renderer._instancedDrawCalls = 0;
    this.stats.misc.renderTargetCreationTime = this.graphicsDevice.renderTargetCreationTime;
    stats = this.stats.particles;
    stats.updatesPerFrame = stats._updatesPerFrame;
    stats.frameTime = stats._frameTime;
    stats._updatesPerFrame = 0;
    stats._frameTime = 0;
  }

  /**
   * Controls how the canvas fills the window and resizes when the window changes.
   *
   * @param {string} mode - The mode to use when setting the size of the canvas. Can be:
   *
   * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
   * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
   * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
   * maintaining the aspect ratio.
   *
   * @param {number} [width] - The width of the canvas (only used when mode is {@link FILLMODE_NONE}).
   * @param {number} [height] - The height of the canvas (only used when mode is {@link FILLMODE_NONE}).
   */
  setCanvasFillMode(mode, width, height) {
    this._fillMode = mode;
    this.resizeCanvas(width, height);
  }

  /**
   * Change the resolution of the canvas, and set the way it behaves when the window is resized.
   *
   * @param {string} mode - The mode to use when setting the resolution. Can be:
   *
   * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
   * match canvas client size.
   * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
   *
   * @param {number} [width] - The horizontal resolution, optional in AUTO mode, if not provided
   * canvas clientWidth is used.
   * @param {number} [height] - The vertical resolution, optional in AUTO mode, if not provided
   * canvas clientHeight is used.
   */
  setCanvasResolution(mode, width, height) {
    this._resolutionMode = mode;

    // In AUTO mode the resolution is the same as the canvas size, unless specified
    if (mode === RESOLUTION_AUTO && width === undefined) {
      width = this.graphicsDevice.canvas.clientWidth;
      height = this.graphicsDevice.canvas.clientHeight;
    }
    this.graphicsDevice.resizeCanvas(width, height);
  }

  /**
   * Queries the visibility of the window or tab in which the application is running.
   *
   * @returns {boolean} True if the application is not visible and false otherwise.
   */
  isHidden() {
    return document[this._hiddenAttr];
  }

  /**
   * Called when the visibility state of the current tab/window changes.
   *
   * @private
   */
  onVisibilityChange() {
    if (this.isHidden()) {
      if (this._soundManager) {
        this._soundManager.suspend();
      }
    } else {
      if (this._soundManager) {
        this._soundManager.resume();
      }
    }
  }

  /**
   * Resize the application's canvas element in line with the current fill mode.
   *
   * - In {@link FILLMODE_KEEP_ASPECT} mode, the canvas will grow to fill the window as best it
   * can while maintaining the aspect ratio.
   * - In {@link FILLMODE_FILL_WINDOW} mode, the canvas will simply fill the window, changing
   * aspect ratio.
   * - In {@link FILLMODE_NONE} mode, the canvas will always match the size provided.
   *
   * @param {number} [width] - The width of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
   * @param {number} [height] - The height of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
   * @returns {object} A object containing the values calculated to use as width and height.
   */
  resizeCanvas(width, height) {
    if (!this._allowResize) return undefined; // prevent resizing (e.g. if presenting in VR HMD)

    // prevent resizing when in XR session
    if (this.xr && this.xr.session) return undefined;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    if (this._fillMode === FILLMODE_KEEP_ASPECT) {
      const r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
      const winR = windowWidth / windowHeight;
      if (r > winR) {
        width = windowWidth;
        height = width / r;
      } else {
        height = windowHeight;
        width = height * r;
      }
    } else if (this._fillMode === FILLMODE_FILL_WINDOW) {
      width = windowWidth;
      height = windowHeight;
    }
    // OTHERWISE: FILLMODE_NONE use width and height that are provided

    this.graphicsDevice.canvas.style.width = width + 'px';
    this.graphicsDevice.canvas.style.height = height + 'px';
    this.updateCanvasSize();

    // return the final values calculated for width and height
    return {
      width: width,
      height: height
    };
  }

  /**
   * Updates the {@link GraphicsDevice} canvas size to match the canvas size on the document
   * page. It is recommended to call this function when the canvas size changes (e.g on window
   * resize and orientation change events) so that the canvas resolution is immediately updated.
   */
  updateCanvasSize() {
    var _this$xr;
    // Don't update if we are in VR or XR
    if (!this._allowResize || (_this$xr = this.xr) != null && _this$xr.active) {
      return;
    }

    // In AUTO mode the resolution is changed to match the canvas size
    if (this._resolutionMode === RESOLUTION_AUTO) {
      // Check if the canvas DOM has changed size
      const canvas = this.graphicsDevice.canvas;
      this.graphicsDevice.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
    }
  }

  /**
   * Event handler called when all code libraries have been loaded. Code libraries are passed
   * into the constructor of the Application and the application won't start running or load
   * packs until all libraries have been loaded.
   *
   * @private
   */
  onLibrariesLoaded() {
    this._librariesLoaded = true;
    if (this.systems.rigidbody) {
      this.systems.rigidbody.onLibraryLoaded();
    }
  }

  /**
   * Apply scene settings to the current scene. Useful when your scene settings are parsed or
   * generated from a non-URL source.
   *
   * @param {object} settings - The scene settings to be applied.
   * @param {object} settings.physics - The physics settings to be applied.
   * @param {number[]} settings.physics.gravity - The world space vector representing global
   * gravity in the physics simulation. Must be a fixed size array with three number elements,
   * corresponding to each axis [ X, Y, Z ].
   * @param {object} settings.render - The rendering settings to be applied.
   * @param {number[]} settings.render.global_ambient - The color of the scene's ambient light.
   * Must be a fixed size array with three number elements, corresponding to each color channel
   * [ R, G, B ].
   * @param {string} settings.render.fog - The type of fog used by the scene. Can be:
   *
   * - {@link FOG_NONE}
   * - {@link FOG_LINEAR}
   * - {@link FOG_EXP}
   * - {@link FOG_EXP2}
   *
   * @param {number[]} settings.render.fog_color - The color of the fog (if enabled). Must be a
   * fixed size array with three number elements, corresponding to each color channel [ R, G, B ].
   * @param {number} settings.render.fog_density - The density of the fog (if enabled). This
   * property is only valid if the fog property is set to {@link FOG_EXP} or {@link FOG_EXP2}.
   * @param {number} settings.render.fog_start - The distance from the viewpoint where linear fog
   * begins. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
   * @param {number} settings.render.fog_end - The distance from the viewpoint where linear fog
   * reaches its maximum. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
   * @param {number} settings.render.gamma_correction - The gamma correction to apply when
   * rendering the scene. Can be:
   *
   * - {@link GAMMA_NONE}
   * - {@link GAMMA_SRGB}
   *
   * @param {number} settings.render.tonemapping - The tonemapping transform to apply when
   * writing fragments to the frame buffer. Can be:
   *
   * - {@link TONEMAP_LINEAR}
   * - {@link TONEMAP_FILMIC}
   * - {@link TONEMAP_HEJL}
   * - {@link TONEMAP_ACES}
   *
   * @param {number} settings.render.exposure - The exposure value tweaks the overall brightness
   * of the scene.
   * @param {number|null} [settings.render.skybox] - The asset ID of the cube map texture to be
   * used as the scene's skybox. Defaults to null.
   * @param {number} settings.render.skyboxIntensity - Multiplier for skybox intensity.
   * @param {number} settings.render.skyboxLuminance - Lux (lm/m^2) value for skybox intensity when physical light units are enabled.
   * @param {number} settings.render.skyboxMip - The mip level of the skybox to be displayed.
   * Only valid for prefiltered cubemap skyboxes.
   * @param {number[]} settings.render.skyboxRotation - Rotation of skybox.
   * @param {number} settings.render.lightmapSizeMultiplier - The lightmap resolution multiplier.
   * @param {number} settings.render.lightmapMaxResolution - The maximum lightmap resolution.
   * @param {number} settings.render.lightmapMode - The lightmap baking mode. Can be:
   *
   * - {@link BAKE_COLOR}: single color lightmap
   * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
   *
   * @param {boolean} settings.render.ambientBake - Enable baking ambient light into lightmaps.
   * @param {number} settings.render.ambientBakeNumSamples - Number of samples to use when baking ambient light.
   * @param {number} settings.render.ambientBakeSpherePart - How much of the sphere to include when baking ambient light.
   * @param {number} settings.render.ambientBakeOcclusionBrightness - Brightness of the baked ambient occlusion.
   * @param {number} settings.render.ambientBakeOcclusionContrast - Contrast of the baked ambient occlusion.
   * @param {number} settings.render.ambientLuminance - Lux (lm/m^2) value for ambient light intensity.
   *
   * @param {boolean} settings.render.clusteredLightingEnabled - Enable clustered lighting.
   * @param {boolean} settings.render.lightingShadowsEnabled - If set to true, the clustered lighting will support shadows.
   * @param {boolean} settings.render.lightingCookiesEnabled - If set to true, the clustered lighting will support cookie textures.
   * @param {boolean} settings.render.lightingAreaLightsEnabled - If set to true, the clustered lighting will support area lights.
   * @param {number} settings.render.lightingShadowAtlasResolution - Resolution of the atlas texture storing all non-directional shadow textures.
   * @param {number} settings.render.lightingCookieAtlasResolution - Resolution of the atlas texture storing all non-directional cookie textures.
   * @param {number} settings.render.lightingMaxLightsPerCell - Maximum number of lights a cell can store.
   * @param {number} settings.render.lightingShadowType - The type of shadow filtering used by all shadows. Can be:
   *
   * - {@link SHADOW_PCF1}: PCF 1x1 sampling.
   * - {@link SHADOW_PCF3}: PCF 3x3 sampling.
   * - {@link SHADOW_PCF5}: PCF 5x5 sampling. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
   *
   * @param {Vec3} settings.render.lightingCells - Number of cells along each world-space axis the space containing lights
   * is subdivided into.
   *
   * Only lights with bakeDir=true will be used for generating the dominant light direction.
   * @example
   *
   * const settings = {
   *     physics: {
   *         gravity: [0, -9.8, 0]
   *     },
   *     render: {
   *         fog_end: 1000,
   *         tonemapping: 0,
   *         skybox: null,
   *         fog_density: 0.01,
   *         gamma_correction: 1,
   *         exposure: 1,
   *         fog_start: 1,
   *         global_ambient: [0, 0, 0],
   *         skyboxIntensity: 1,
   *         skyboxRotation: [0, 0, 0],
   *         fog_color: [0, 0, 0],
   *         lightmapMode: 1,
   *         fog: 'none',
   *         lightmapMaxResolution: 2048,
   *         skyboxMip: 2,
   *         lightmapSizeMultiplier: 16
   *     }
   * };
   * app.applySceneSettings(settings);
   */
  applySceneSettings(settings) {
    let asset;
    if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
      const gravity = settings.physics.gravity;
      this.systems.rigidbody.gravity.set(gravity[0], gravity[1], gravity[2]);
    }
    this.scene.applySettings(settings);
    if (settings.render.hasOwnProperty('skybox')) {
      if (settings.render.skybox) {
        asset = this.assets.get(settings.render.skybox);
        if (asset) {
          this.setSkybox(asset);
        } else {
          this.assets.once('add:' + settings.render.skybox, this.setSkybox, this);
        }
      } else {
        this.setSkybox(null);
      }
    }
  }

  /**
   * Sets the area light LUT tables for this app.
   *
   * @param {number[]} ltcMat1 - LUT table of type `array` to be set.
   * @param {number[]} ltcMat2 - LUT table of type `array` to be set.
   */
  setAreaLightLuts(ltcMat1, ltcMat2) {
    if (ltcMat1 && ltcMat2) {
      AreaLightLuts.set(this.graphicsDevice, ltcMat1, ltcMat2);
    } else {
      Debug.warn("setAreaLightLuts: LUTs for area light are not valid");
    }
  }

  /**
   * Sets the skybox asset to current scene, and subscribes to asset load/change events.
   *
   * @param {Asset} asset - Asset of type `skybox` to be set to, or null to remove skybox.
   */
  setSkybox(asset) {
    if (asset !== this._skyboxAsset) {
      const onSkyboxRemoved = () => {
        this.setSkybox(null);
      };
      const onSkyboxChanged = () => {
        this.scene.setSkybox(this._skyboxAsset ? this._skyboxAsset.resources : null);
      };

      // cleanup previous asset
      if (this._skyboxAsset) {
        this.assets.off('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
        this.assets.off('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
        this._skyboxAsset.off('change', onSkyboxChanged, this);
      }

      // set new asset
      this._skyboxAsset = asset;
      if (this._skyboxAsset) {
        this.assets.on('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
        this.assets.once('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
        this._skyboxAsset.on('change', onSkyboxChanged, this);
        if (this.scene.skyboxMip === 0 && !this._skyboxAsset.loadFaces) {
          this._skyboxAsset.loadFaces = true;
        }
        this.assets.load(this._skyboxAsset);
      }
      onSkyboxChanged();
    }
  }

  /** @private */
  _firstBake() {
    var _this$lightmapper;
    (_this$lightmapper = this.lightmapper) == null || _this$lightmapper.bake(null, this.scene.lightmapMode);
  }

  /** @private */
  _firstBatch() {
    var _this$batcher;
    (_this$batcher = this.batcher) == null || _this$batcher.generate();
  }

  /**
   * Provide an opportunity to modify the timestamp supplied by requestAnimationFrame.
   *
   * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
   * @returns {number|undefined} The modified timestamp.
   * @ignore
   */
  _processTimestamp(timestamp) {
    return timestamp;
  }

  /**
   * Draws a single line. Line start and end coordinates are specified in world-space. The line
   * will be flat-shaded with the specified color.
   *
   * @param {Vec3} start - The start world-space coordinate of the line.
   * @param {Vec3} end - The end world-space coordinate of the line.
   * @param {Color} [color] - The color of the line. It defaults to white if not specified.
   * @param {boolean} [depthTest] - Specifies if the line is depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the line into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a 1-unit long white line
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end);
   * @example
   * // Render a 1-unit long red line which is not depth tested and renders on top of other geometry
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end, pc.Color.RED, false);
   * @example
   * // Render a 1-unit long white line into the world layer
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * const worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
   * app.drawLine(start, end, pc.Color.WHITE, true, worldLayer);
   */
  drawLine(start, end, color, depthTest, layer) {
    this.scene.drawLine(start, end, color, depthTest, layer);
  }

  /**
   * Renders an arbitrary number of discrete line segments. The lines are not connected by each
   * subsequent point in the array. Instead, they are individual segments specified by two
   * points. Therefore, the lengths of the supplied position and color arrays must be the same
   * and also must be a multiple of 2. The colors of the ends of each line segment will be
   * interpolated along the length of each line.
   *
   * @param {Vec3[]} positions - An array of points to draw lines between. The length of the
   * array must be a multiple of 2.
   * @param {Color[] | Color} colors - An array of colors or a single color. If an array is
   * specified, this must be the same length as the position array. The length of the array
   * must also be a multiple of 2.
   * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a single line, with unique colors for each point
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLines([start, end], [pc.Color.RED, pc.Color.WHITE]);
   * @example
   * // Render 2 discrete line segments
   * const points = [
   *     // Line 1
   *     new pc.Vec3(0, 0, 0),
   *     new pc.Vec3(1, 0, 0),
   *     // Line 2
   *     new pc.Vec3(1, 1, 0),
   *     new pc.Vec3(1, 1, 1)
   * ];
   * const colors = [
   *     // Line 1
   *     pc.Color.RED,
   *     pc.Color.YELLOW,
   *     // Line 2
   *     pc.Color.CYAN,
   *     pc.Color.BLUE
   * ];
   * app.drawLines(points, colors);
   */
  drawLines(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLines(positions, colors, depthTest, layer);
  }

  /**
   * Renders an arbitrary number of discrete line segments. The lines are not connected by each
   * subsequent point in the array. Instead, they are individual segments specified by two
   * points.
   *
   * @param {number[]} positions - An array of points to draw lines between. Each point is
   * represented by 3 numbers - x, y and z coordinate.
   * @param {number[]} colors - An array of colors to color the lines. This must be the same
   * length as the position array. The length of the array must also be a multiple of 2.
   * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render 2 discrete line segments
   * const points = [
   *     // Line 1
   *     0, 0, 0,
   *     1, 0, 0,
   *     // Line 2
   *     1, 1, 0,
   *     1, 1, 1
   * ];
   * const colors = [
   *     // Line 1
   *     1, 0, 0, 1,  // red
   *     0, 1, 0, 1,  // green
   *     // Line 2
   *     0, 0, 1, 1,  // blue
   *     1, 1, 1, 1   // white
   * ];
   * app.drawLineArrays(points, colors);
   */
  drawLineArrays(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLineArrays(positions, colors, depthTest, layer);
  }

  /**
   * Draws a wireframe sphere with center, radius and color.
   *
   * @param {Vec3} center - The center of the sphere.
   * @param {number} radius - The radius of the sphere.
   * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
   * @param {number} [segments] - Number of line segments used to render the circles forming the
   * sphere. Defaults to 20.
   * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
   * depth buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a red wire sphere with radius of 1
   * const center = new pc.Vec3(0, 0, 0);
   * app.drawWireSphere(center, 1.0, pc.Color.RED);
   * @ignore
   */
  drawWireSphere(center, radius, color = Color.WHITE, segments = 20, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawWireSphere(center, radius, color, segments, depthTest, layer);
  }

  /**
   * Draws a wireframe axis aligned box specified by min and max points and color.
   *
   * @param {Vec3} minPoint - The min corner point of the box.
   * @param {Vec3} maxPoint - The max corner point of the box.
   * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
   * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
   * depth buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @param {Mat4} [mat] - Matrix to transform the box before rendering.
   * @example
   * // Render a red wire aligned box
   * const min = new pc.Vec3(-1, -1, -1);
   * const max = new pc.Vec3(1, 1, 1);
   * app.drawWireAlignedBox(min, max, pc.Color.RED);
   * @ignore
   */
  drawWireAlignedBox(minPoint, maxPoint, color = Color.WHITE, depthTest = true, layer = this.scene.defaultDrawLayer, mat) {
    this.scene.immediate.drawWireAlignedBox(minPoint, maxPoint, color, depthTest, layer, mat);
  }

  /**
   * Draw meshInstance at this frame
   *
   * @param {import('../scene/mesh-instance.js').MeshInstance} meshInstance - The mesh instance
   * to draw.
   * @param {Layer} [layer] - The layer to render the mesh instance into. Defaults to
   * {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawMeshInstance(meshInstance, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
  }

  /**
   * Draw mesh at this frame.
   *
   * @param {import('../scene/mesh.js').Mesh} mesh - The mesh to draw.
   * @param {Material} material - The material to use to render the mesh.
   * @param {Mat4} matrix - The matrix to use to render the mesh.
   * @param {Layer} [layer] - The layer to render the mesh into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawMesh(mesh, material, matrix, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
  }

  /**
   * Draw quad of size [-0.5, 0.5] at this frame.
   *
   * @param {Mat4} matrix - The matrix to use to render the quad.
   * @param {Material} material - The material to use to render the quad.
   * @param {Layer} [layer] - The layer to render the quad into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawQuad(matrix, material, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, this.scene.immediate.getQuadMesh(), null, layer);
  }

  /**
   * Draws a texture at [x, y] position on screen, with size [width, height]. The origin of the
   * screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
   *
   * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
   * range [0, 2].
   * @param {number} height - The height of the rectangle of the rendered texture. Should be in
   * the range [0, 2].
   * @param {import('../platform/graphics/texture.js').Texture} texture - The texture to render.
   * @param {Material} material - The material used when rendering the texture.
   * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @param {boolean} [filterable] - Indicate if the texture can be sampled using filtering.
   * Passing false uses unfiltered sampling, allowing a depth texture to be sampled on WebGPU.
   * Defaults to true.
   * @ignore
   */
  drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer, filterable = true) {
    // only WebGPU supports filterable parameter to be false, allowing a depth texture / shadow
    // map to be fetched (without filtering) and rendered
    if (filterable === false && !this.graphicsDevice.isWebGPU) return;

    // TODO: if this is used for anything other than debug texture display, we should optimize this to avoid allocations
    const matrix = new Mat4();
    matrix.setTRS(new Vec3(x, y, 0.0), Quat.IDENTITY, new Vec3(width, -height, 0.0));
    if (!material) {
      material = new Material();
      material.cull = CULLFACE_NONE;
      material.setParameter("colorMap", texture);
      material.shader = filterable ? this.scene.immediate.getTextureShader() : this.scene.immediate.getUnfilterableTextureShader();
      material.update();
    }
    this.drawQuad(matrix, material, layer);
  }

  /**
   * Draws a depth texture at [x, y] position on screen, with size [width, height]. The origin of
   * the screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
   *
   * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
   * range [0, 2].
   * @param {number} height - The height of the rectangle of the rendered texture. Should be in
   * the range [0, 2].
   * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawDepthTexture(x, y, width, height, layer = this.scene.defaultDrawLayer) {
    const material = new Material();
    material.cull = CULLFACE_NONE;
    material.shader = this.scene.immediate.getDepthTextureShader();
    material.update();
    this.drawTexture(x, y, width, height, null, material, layer);
  }

  /**
   * Destroys application and removes all event listeners at the end of the current engine frame
   * update. However, if called outside of the engine frame update, calling destroy() will
   * destroy the application immediately.
   *
   * @example
   * app.destroy();
   */
  destroy() {
    var _this$lightmapper2, _this$xr2, _this$xr3, _this$_soundManager;
    if (this._inFrameUpdate) {
      this._destroyRequested = true;
      return;
    }
    const canvasId = this.graphicsDevice.canvas.id;
    this.fire('destroy', this); // fire destroy event
    this.off('librariesloaded');
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
    }
    this._visibilityChangeHandler = null;
    this.root.destroy();
    this.root = null;
    if (this.mouse) {
      this.mouse.off();
      this.mouse.detach();
      this.mouse = null;
    }
    if (this.keyboard) {
      this.keyboard.off();
      this.keyboard.detach();
      this.keyboard = null;
    }
    if (this.touch) {
      this.touch.off();
      this.touch.detach();
      this.touch = null;
    }
    if (this.elementInput) {
      this.elementInput.detach();
      this.elementInput = null;
    }
    if (this.gamepads) {
      this.gamepads.destroy();
      this.gamepads = null;
    }
    if (this.controller) {
      this.controller = null;
    }
    this.systems.destroy();

    // layer composition
    if (this.scene.layers) {
      this.scene.layers.destroy();
    }

    // destroy all texture resources
    const assets = this.assets.list();
    for (let i = 0; i < assets.length; i++) {
      assets[i].unload();
      assets[i].off();
    }
    this.assets.off();

    // destroy bundle registry
    this.bundles.destroy();
    this.bundles = null;
    this.i18n.destroy();
    this.i18n = null;
    const scriptHandler = this.loader.getHandler('script');
    scriptHandler == null || scriptHandler.clearCache();
    this.loader.destroy();
    this.loader = null;
    this.scene.destroy();
    this.scene = null;
    this.systems = null;
    this.context = null;

    // script registry
    this.scripts.destroy();
    this.scripts = null;
    this.scenes.destroy();
    this.scenes = null;
    (_this$lightmapper2 = this.lightmapper) == null || _this$lightmapper2.destroy();
    this.lightmapper = null;
    if (this._batcher) {
      this._batcher.destroy();
      this._batcher = null;
    }
    this._entityIndex = {};
    this.defaultLayerDepth.onPreRenderOpaque = null;
    this.defaultLayerDepth.onPostRenderOpaque = null;
    this.defaultLayerDepth.onDisable = null;
    this.defaultLayerDepth.onEnable = null;
    this.defaultLayerDepth = null;
    this.defaultLayerWorld = null;
    (_this$xr2 = this.xr) == null || _this$xr2.end();
    (_this$xr3 = this.xr) == null || _this$xr3.destroy();
    this.renderer.destroy();
    this.renderer = null;
    this.graphicsDevice.destroy();
    this.graphicsDevice = null;
    this.tick = null;
    this.off(); // remove all events

    (_this$_soundManager = this._soundManager) == null || _this$_soundManager.destroy();
    this._soundManager = null;
    script.app = null;
    AppBase._applications[canvasId] = null;
    if (getApplication() === this) {
      setApplication(null);
    }
    AppBase.cancelTick(this);
  }
  static cancelTick(app) {
    if (app.frameRequestId) {
      window.cancelAnimationFrame(app.frameRequestId);
      app.frameRequestId = undefined;
    }
  }

  /**
   * Get entity from the index by guid.
   *
   * @param {string} guid - The GUID to search for.
   * @returns {Entity} The Entity with the GUID or null.
   * @ignore
   */
  getEntityFromIndex(guid) {
    return this._entityIndex[guid];
  }

  /**
   * @param {Scene} scene - The scene.
   * @private
   */
  _registerSceneImmediate(scene) {
    this.on('postrender', scene.immediate.onPostRender, scene.immediate);
  }
}

// static data
AppBase._applications = {};
const _frameEndData = {};

/**
 * Callback used by {@link AppBase#start} and itself to request
 * the rendering of a new animation frame.
 *
 * @callback MakeTickCallback
 * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
 * @param {*} [frame] - XRFrame from requestAnimationFrame callback.
 * @ignore
 */

/**
 * Create tick function to be wrapped in closure.
 *
 * @param {AppBase} _app - The application.
 * @returns {MakeTickCallback} The tick function.
 * @private
 */
const makeTick = function makeTick(_app) {
  const application = _app;
  /**
   * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
   * @param {*} [frame] - XRFrame from requestAnimationFrame callback.
   */
  return function (timestamp, frame) {
    var _application$xr;
    if (!application.graphicsDevice) return;
    application.frameRequestId = null;
    application._inFrameUpdate = true;
    setApplication(application);

    // have current application pointer in pc
    app = application;
    const currentTime = application._processTimestamp(timestamp) || now();
    const ms = currentTime - (application._time || currentTime);
    let dt = ms / 1000.0;
    dt = math.clamp(dt, 0, application.maxDeltaTime);
    dt *= application.timeScale;
    application._time = currentTime;

    // Submit a request to queue up a new animation frame immediately
    if ((_application$xr = application.xr) != null && _application$xr.session) {
      application.frameRequestId = application.xr.session.requestAnimationFrame(application.tick);
    } else {
      application.frameRequestId = platform.browser ? window.requestAnimationFrame(application.tick) : null;
    }
    if (application.graphicsDevice.contextLost) return;
    application._fillFrameStatsBasic(currentTime, dt, ms);
    application._fillFrameStats();
    application.fire("frameupdate", ms);
    let shouldRenderFrame = true;
    if (frame) {
      var _application$xr2;
      shouldRenderFrame = (_application$xr2 = application.xr) == null ? void 0 : _application$xr2.update(frame);
      application.graphicsDevice.defaultFramebuffer = frame.session.renderState.baseLayer.framebuffer;
    } else {
      application.graphicsDevice.defaultFramebuffer = null;
    }
    if (shouldRenderFrame) {
      Debug.trace(TRACEID_RENDER_FRAME, `---- Frame ${application.frame}`);
      Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- UpdateStart ${now().toFixed(2)}ms`);
      application.update(dt);
      application.fire("framerender");
      if (application.autoRender || application.renderNextFrame) {
        Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderStart ${now().toFixed(2)}ms`);
        application.updateCanvasSize();
        application.frameStart();
        application.render();
        application.frameEnd();
        application.renderNextFrame = false;
        Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderEnd ${now().toFixed(2)}ms`);
      }

      // set event data
      _frameEndData.timestamp = now();
      _frameEndData.target = application;
      application.fire("frameend", _frameEndData);
    }
    application._inFrameUpdate = false;
    if (application._destroyRequested) {
      application.destroy();
    }
  };
};

export { AppBase, app };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLCBDVUxMRkFDRV9OT05FXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgaHR0cCB9IGZyb20gJy4uL3BsYXRmb3JtL25ldC9odHRwLmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILCBMQVlFUklEX0lNTUVESUFURSwgTEFZRVJJRF9TS1lCT1gsIExBWUVSSURfVUksIExBWUVSSURfV09STEQsXG4gICAgU09SVE1PREVfTk9ORSwgU09SVE1PREVfTUFOVUFMLCBTUEVDVUxBUl9CTElOTlxufSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgc2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgUHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEZyYW1lR3JhcGggfSBmcm9tICcuLi9zY2VuZS9mcmFtZS1ncmFwaC5qcyc7XG5pbXBvcnQgeyBBcmVhTGlnaHRMdXRzIH0gZnJvbSAnLi4vc2NlbmUvYXJlYS1saWdodC1sdXRzLmpzJztcbmltcG9ydCB7IExheWVyIH0gZnJvbSAnLi4vc2NlbmUvbGF5ZXIuanMnO1xuaW1wb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9IGZyb20gJy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJztcbmltcG9ydCB7IFNjZW5lIH0gZnJvbSAnLi4vc2NlbmUvc2NlbmUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVSZWdpc3RyeSB9IGZyb20gJy4vYnVuZGxlL2J1bmRsZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9IGZyb20gJy4vY29tcG9uZW50cy9yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVIYW5kbGVyIH0gZnJvbSAnLi9oYW5kbGVycy9idW5kbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMb2FkZXIgfSBmcm9tICcuL2hhbmRsZXJzL2xvYWRlci5qcyc7XG5pbXBvcnQgeyBJMThuIH0gZnJvbSAnLi9pMThuL2kxOG4uanMnO1xuaW1wb3J0IHsgU2NyaXB0UmVnaXN0cnkgfSBmcm9tICcuL3NjcmlwdC9zY3JpcHQtcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHsgU2NlbmVSZWdpc3RyeSB9IGZyb20gJy4vc2NlbmUtcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi9zY3JpcHQuanMnO1xuaW1wb3J0IHsgQXBwbGljYXRpb25TdGF0cyB9IGZyb20gJy4vc3RhdHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEZJTExNT0RFX0ZJTExfV0lORE9XLCBGSUxMTU9ERV9LRUVQX0FTUEVDVCxcbiAgICBSRVNPTFVUSU9OX0FVVE8sIFJFU09MVVRJT05fRklYRURcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQge1xuICAgIGdldEFwcGxpY2F0aW9uLFxuICAgIHNldEFwcGxpY2F0aW9uXG59IGZyb20gJy4vZ2xvYmFscy5qcyc7XG5cbi8vIE1pbmktb2JqZWN0IHVzZWQgdG8gbWVhc3VyZSBwcm9ncmVzcyBvZiBsb2FkaW5nIHNldHNcbmNsYXNzIFByb2dyZXNzIHtcbiAgICBjb25zdHJ1Y3RvcihsZW5ndGgpIHtcbiAgICAgICAgdGhpcy5sZW5ndGggPSBsZW5ndGg7XG4gICAgICAgIHRoaXMuY291bnQgPSAwO1xuICAgIH1cblxuICAgIGluYygpIHtcbiAgICAgICAgdGhpcy5jb3VudCsrO1xuICAgIH1cblxuICAgIGRvbmUoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5jb3VudCA9PT0gdGhpcy5sZW5ndGgpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBcHBCYXNlI2NvbmZpZ3VyZX0gd2hlbiBjb25maWd1cmF0aW9uIGZpbGUgaXMgbG9hZGVkIGFuZCBwYXJzZWQgKG9yXG4gKiBhbiBlcnJvciBvY2N1cnMpLlxuICpcbiAqIEBjYWxsYmFjayBDb25maWd1cmVBcHBDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjcHJlbG9hZH0gd2hlbiBhbGwgYXNzZXRzIChtYXJrZWQgYXMgJ3ByZWxvYWQnKSBhcmUgbG9hZGVkLlxuICpcbiAqIEBjYWxsYmFjayBQcmVsb2FkQXBwQ2FsbGJhY2tcbiAqL1xuXG4vKipcbiAqIEdldHMgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24sIGlmIGFueS5cbiAqXG4gKiBAdHlwZSB7QXBwQmFzZXxudWxsfVxuICogQGlnbm9yZVxuICovXG5sZXQgYXBwID0gbnVsbDtcblxuLyoqXG4gKiBBbiBBcHBsaWNhdGlvbiByZXByZXNlbnRzIGFuZCBtYW5hZ2VzIHlvdXIgUGxheUNhbnZhcyBhcHBsaWNhdGlvbi4gSWYgeW91IGFyZSBkZXZlbG9waW5nIHVzaW5nXG4gKiB0aGUgUGxheUNhbnZhcyBFZGl0b3IsIHRoZSBBcHBsaWNhdGlvbiBpcyBjcmVhdGVkIGZvciB5b3UuIFlvdSBjYW4gYWNjZXNzIHlvdXIgQXBwbGljYXRpb25cbiAqIGluc3RhbmNlIGluIHlvdXIgc2NyaXB0cy4gQmVsb3cgaXMgYSBza2VsZXRvbiBzY3JpcHQgd2hpY2ggc2hvd3MgaG93IHlvdSBjYW4gYWNjZXNzIHRoZVxuICogYXBwbGljYXRpb24gJ2FwcCcgcHJvcGVydHkgaW5zaWRlIHRoZSBpbml0aWFsaXplIGFuZCB1cGRhdGUgZnVuY3Rpb25zOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEVkaXRvciBleGFtcGxlOiBhY2Nlc3NpbmcgdGhlIHBjLkFwcGxpY2F0aW9uIGZyb20gYSBzY3JpcHRcbiAqIHZhciBNeVNjcmlwdCA9IHBjLmNyZWF0ZVNjcmlwdCgnbXlTY3JpcHQnKTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICogICAgIC8vIEV2ZXJ5IHNjcmlwdCBpbnN0YW5jZSBoYXMgYSBwcm9wZXJ0eSAndGhpcy5hcHAnIGFjY2Vzc2libGUgaW4gdGhlIGluaXRpYWxpemUuLi5cbiAqICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKlxuICogTXlTY3JpcHQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGR0KSB7XG4gKiAgICAgLy8gLi4uYW5kIHVwZGF0ZSBmdW5jdGlvbnMuXG4gKiAgICAgY29uc3QgYXBwID0gdGhpcy5hcHA7XG4gKiB9O1xuICogYGBgXG4gKlxuICogSWYgeW91IGFyZSB1c2luZyB0aGUgRW5naW5lIHdpdGhvdXQgdGhlIEVkaXRvciwgeW91IGhhdmUgdG8gY3JlYXRlIHRoZSBhcHBsaWNhdGlvbiBpbnN0YW5jZVxuICogbWFudWFsbHkuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBBcHBCYXNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBBIHJlcXVlc3QgaWQgcmV0dXJuZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLCBhbGxvd2luZyB1cyB0byBjYW5jZWwgaXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJhbWVSZXF1ZXN0SWQ7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQXBwQmFzZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IGNhbnZhcyAtIFRoZSBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEVuZ2luZS1vbmx5IGV4YW1wbGU6IGNyZWF0ZSB0aGUgYXBwbGljYXRpb24gbWFudWFsbHlcbiAgICAgKiBjb25zdCBvcHRpb25zID0gbmV3IEFwcE9wdGlvbnMoKTtcbiAgICAgKiBjb25zdCBhcHAgPSBuZXcgcGMuQXBwQmFzZShjYW52YXMpO1xuICAgICAqIGFwcC5pbml0KG9wdGlvbnMpO1xuICAgICAqXG4gICAgICogLy8gU3RhcnQgdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICpcbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmVyc2lvbj8uaW5kZXhPZignJCcpIDwgMCkge1xuICAgICAgICAgICAgRGVidWcubG9nKGBQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJHt2ZXJzaW9ufSAke3JldmlzaW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFN0b3JlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXMuaWRdID0gdGhpcztcbiAgICAgICAgc2V0QXBwbGljYXRpb24odGhpcyk7XG5cbiAgICAgICAgYXBwID0gdGhpcztcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTY2FsZXMgdGhlIGdsb2JhbCB0aW1lIGRlbHRhLiBEZWZhdWx0cyB0byAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGFwcCB0byBydW4gYXQgaGFsZiBzcGVlZFxuICAgICAgICAgKiB0aGlzLmFwcC50aW1lU2NhbGUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRpbWVTY2FsZSA9IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsYW1wcyBwZXItZnJhbWUgZGVsdGEgdGltZSB0byBhbiB1cHBlciBib3VuZC4gVXNlZnVsIHNpbmNlIHJldHVybmluZyBmcm9tIGEgdGFiXG4gICAgICAgICAqIGRlYWN0aXZhdGlvbiBjYW4gZ2VuZXJhdGUgaHVnZSB2YWx1ZXMgZm9yIGR0LCB3aGljaCBjYW4gYWR2ZXJzZWx5IGFmZmVjdCBnYW1lIHN0YXRlLlxuICAgICAgICAgKiBEZWZhdWx0cyB0byAwLjEgKHNlY29uZHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEb24ndCBjbGFtcCBpbnRlci1mcmFtZSB0aW1lcyBvZiAyMDBtcyBvciBsZXNzXG4gICAgICAgICAqIHRoaXMuYXBwLm1heERlbHRhVGltZSA9IDAuMjtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4RGVsdGFUaW1lID0gMC4xOyAvLyBNYXhpbXVtIGRlbHRhIGlzIDAuMXMgb3IgMTAgZnBzLlxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyB0aGUgYXBwbGljYXRpb24gaGFzIHVwZGF0ZWQgc2luY2Ugc3RhcnQoKSB3YXMgY2FsbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hlbiB0cnVlLCB0aGUgYXBwbGljYXRpb24ncyByZW5kZXIgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IGZyYW1lLiBTZXR0aW5nIGF1dG9SZW5kZXJcbiAgICAgICAgICogdG8gZmFsc2UgaXMgdXNlZnVsIHRvIGFwcGxpY2F0aW9ucyB3aGVyZSB0aGUgcmVuZGVyZWQgaW1hZ2UgbWF5IG9mdGVuIGJlIHVuY2hhbmdlZCBvdmVyXG4gICAgICAgICAqIHRpbWUuIFRoaXMgY2FuIGhlYXZpbHkgcmVkdWNlIHRoZSBhcHBsaWNhdGlvbidzIGxvYWQgb24gdGhlIENQVSBhbmQgR1BVLiBEZWZhdWx0cyB0b1xuICAgICAgICAgKiB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRGlzYWJsZSByZW5kZXJpbmcgZXZlcnkgZnJhbWUgYW5kIG9ubHkgcmVuZGVyIG9uIGEga2V5ZG93biBldmVudFxuICAgICAgICAgKiB0aGlzLmFwcC5hdXRvUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAqIHRoaXMuYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9LCB0aGlzKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXV0b1JlbmRlciA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIHRvIHJlbmRlciB0aGUgc2NlbmUgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSBtYWluIGxvb3AuIFRoaXMgb25seSBoYXMgYW5cbiAgICAgICAgICogZWZmZWN0IGlmIHtAbGluayBBcHBCYXNlI2F1dG9SZW5kZXJ9IGlzIHNldCB0byBmYWxzZS4gVGhlIHZhbHVlIG9mIHJlbmRlck5leHRGcmFtZVxuICAgICAgICAgKiBpcyBzZXQgYmFjayB0byBmYWxzZSBhZ2FpbiBhcyBzb29uIGFzIHRoZSBzY2VuZSBoYXMgYmVlbiByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJlbmRlciB0aGUgc2NlbmUgb25seSB3aGlsZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgKiBpZiAodGhpcy5hcHAua2V5Ym9hcmQuaXNQcmVzc2VkKHBjLktFWV9TUEFDRSkpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSBpZiB5b3Ugd2FudCBlbnRpdHkgdHlwZSBzY3JpcHQgYXR0cmlidXRlcyB0byBub3QgYmUgcmUtbWFwcGVkIHdoZW4gYW4gZW50aXR5IGlzXG4gICAgICAgICAqIGNsb25lZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyA9IHNjcmlwdC5sZWdhY3k7XG5cbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gRklMTE1PREVfS0VFUF9BU1BFQ1Q7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gUkVTT0xVVElPTl9GSVhFRDtcbiAgICAgICAgdGhpcy5fYWxsb3dSZXNpemUgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzY3JpcHRzIDEuMC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FwcEJhc2V9XG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLW9wdGlvbnMuanMnKS5BcHBPcHRpb25zfSBhcHBPcHRpb25zIC0gT3B0aW9ucyBzcGVjaWZ5aW5nIHRoZSBpbml0XG4gICAgICogcGFyYW1ldGVycyBmb3IgdGhlIGFwcC5cbiAgICAgKi9cbiAgICBpbml0KGFwcE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gYXBwT3B0aW9ucy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGV2aWNlLCBcIlRoZSBhcHBsaWNhdGlvbiBjYW5ub3QgYmUgY3JlYXRlZCB3aXRob3V0IGEgdmFsaWQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IGRldmljZTtcblxuICAgICAgICB0aGlzLl9pbml0RGVmYXVsdE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMuX2luaXRQcm9ncmFtTGlicmFyeSgpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IEFwcGxpY2F0aW9uU3RhdHMoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IGFwcE9wdGlvbnMuc291bmRNYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcmVzb3VyY2UgbG9hZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7UmVzb3VyY2VMb2FkZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRlciA9IG5ldyBSZXNvdXJjZUxvYWRlcih0aGlzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIGFsbCBlbnRpdGllcyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIGZvciB0aGlzIGFwcCBieSBndWlkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgRW50aXR5Pn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW50aXR5SW5kZXggPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmV9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgdG9uZSBtYXBwaW5nIHByb3BlcnR5IG9mIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lLnRvbmVNYXBwaW5nID0gcGMuVE9ORU1BUF9GSUxNSUM7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbmV3IFNjZW5lKGRldmljZSk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUodGhpcy5zY2VuZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJldHVybiB0aGUgZmlyc3QgZW50aXR5IGNhbGxlZCAnQ2FtZXJhJyBpbiBhIGRlcHRoLWZpcnN0IHNlYXJjaCBvZiB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICAgICAqIGNvbnN0IGNhbWVyYSA9IHRoaXMuYXBwLnJvb3QuZmluZEJ5TmFtZSgnQ2FtZXJhJyk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJvb3QgPSBuZXcgRW50aXR5KCk7XG4gICAgICAgIHRoaXMucm9vdC5fZW5hYmxlZEluSGllcmFyY2h5ID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFzc2V0IHJlZ2lzdHJ5IG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7QXNzZXRSZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2VhcmNoIHRoZSBhc3NldCByZWdpc3RyeSBmb3IgYWxsIGFzc2V0cyB3aXRoIHRoZSB0YWcgJ3ZlaGljbGUnXG4gICAgICAgICAqIGNvbnN0IHZlaGljbGVBc3NldHMgPSB0aGlzLmFwcC5hc3NldHMuZmluZEJ5VGFnKCd2ZWhpY2xlJyk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG5ldyBBc3NldFJlZ2lzdHJ5KHRoaXMubG9hZGVyKTtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMuYXNzZXRQcmVmaXgpIHRoaXMuYXNzZXRzLnByZWZpeCA9IGFwcE9wdGlvbnMuYXNzZXRQcmVmaXg7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtCdW5kbGVSZWdpc3RyeX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5idW5kbGVzID0gbmV3IEJ1bmRsZVJlZ2lzdHJ5KHRoaXMuYXNzZXRzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IHRoaXMgdG8gZmFsc2UgaWYgeW91IHdhbnQgdG8gcnVuIHdpdGhvdXQgdXNpbmcgYnVuZGxlcy4gV2Ugc2V0IGl0IHRvIHRydWUgb25seSBpZlxuICAgICAgICAgKiBUZXh0RGVjb2RlciBpcyBhdmFpbGFibGUgYmVjYXVzZSB3ZSBjdXJyZW50bHkgcmVseSBvbiBpdCBmb3IgdW50YXJyaW5nLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbmFibGVCdW5kbGVzID0gKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpO1xuXG4gICAgICAgIHRoaXMuc2NyaXB0c09yZGVyID0gYXBwT3B0aW9ucy5zY3JpcHRzT3JkZXIgfHwgW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIHNjcmlwdCByZWdpc3RyeS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NjcmlwdFJlZ2lzdHJ5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY3JpcHRzID0gbmV3IFNjcmlwdFJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGVzIGxvY2FsaXphdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0kxOG59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmkxOG4gPSBuZXcgSTE4bih0aGlzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIHJlZ2lzdHJ5IG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmVSZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2VhcmNoIHRoZSBzY2VuZSByZWdpc3RyeSBmb3IgYSBpdGVtIHdpdGggdGhlIG5hbWUgJ3JhY2V0cmFjazEnXG4gICAgICAgICAqIGNvbnN0IHNjZW5lSXRlbSA9IHRoaXMuYXBwLnNjZW5lcy5maW5kKCdyYWNldHJhY2sxJyk7XG4gICAgICAgICAqXG4gICAgICAgICAqIC8vIExvYWQgdGhlIHNjZW5lIHVzaW5nIHRoZSBpdGVtJ3MgdXJsXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lcy5sb2FkU2NlbmUoc2NlbmVJdGVtLnVybCk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG5ldyBTY2VuZVJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBuZXcgTGF5ZXIoeyBuYW1lOiBcIldvcmxkXCIsIGlkOiBMQVlFUklEX1dPUkxEIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoID0gbmV3IExheWVyKHsgbmFtZTogXCJEZXB0aFwiLCBpZDogTEFZRVJJRF9ERVBUSCwgZW5hYmxlZDogZmFsc2UsIG9wYXF1ZVNvcnRNb2RlOiBTT1JUTU9ERV9OT05FIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllclNreWJveCA9IG5ldyBMYXllcih7IG5hbWU6IFwiU2t5Ym94XCIsIGlkOiBMQVlFUklEX1NLWUJPWCwgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkUgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyVWkgPSBuZXcgTGF5ZXIoeyBuYW1lOiBcIlVJXCIsIGlkOiBMQVlFUklEX1VJLCB0cmFuc3BhcmVudFNvcnRNb2RlOiBTT1JUTU9ERV9NQU5VQUwgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlID0gbmV3IExheWVyKHsgbmFtZTogXCJJbW1lZGlhdGVcIiwgaWQ6IExBWUVSSURfSU1NRURJQVRFLCBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORSB9KTtcblxuICAgICAgICBjb25zdCBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiZGVmYXVsdFwiKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckRlcHRoKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllclNreWJveCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllclVpKTtcbiAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMgPSBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbjtcblxuICAgICAgICAvLyBwbGFjZWhvbGRlciB0ZXh0dXJlIGZvciBhcmVhIGxpZ2h0IExVVHNcbiAgICAgICAgQXJlYUxpZ2h0THV0cy5jcmVhdGVQbGFjZWhvbGRlcihkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZm9yd2FyZCByZW5kZXJlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZvcndhcmRSZW5kZXJlcn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG5ldyBGb3J3YXJkUmVuZGVyZXIoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZyYW1lR3JhcGh9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaCA9IG5ldyBGcmFtZUdyYXBoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBydW4tdGltZSBsaWdodG1hcHBlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmxpZ2h0bWFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbmV3IGFwcE9wdGlvbnMubGlnaHRtYXBwZXIoZGV2aWNlLCB0aGlzLnJvb3QsIHRoaXMuc2NlbmUsIHRoaXMucmVuZGVyZXIsIHRoaXMuYXNzZXRzKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYWtlLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmJhdGNoTWFuYWdlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG5ldyBhcHBPcHRpb25zLmJhdGNoTWFuYWdlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX2ZpcnN0QmF0Y2gsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBrZXlib2FyZCBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmtleWJvYXJkID0gYXBwT3B0aW9ucy5rZXlib2FyZCB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbW91c2UgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcycpLk1vdXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tb3VzZSA9IGFwcE9wdGlvbnMubW91c2UgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBnZXQgdG91Y2ggZXZlbnRzIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2ggPSBhcHBPcHRpb25zLnRvdWNoIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gYWNjZXNzIEdhbWVQYWQgaW5wdXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5nYW1lcGFkcyA9IGFwcE9wdGlvbnMuZ2FtZXBhZHMgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBoYW5kbGUgaW5wdXQgZm9yIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRJbnB1dH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gYXBwT3B0aW9ucy5lbGVtZW50SW5wdXQgfHwgbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXBwID0gdGhpcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFhSIE1hbmFnZXIgdGhhdCBwcm92aWRlcyBhYmlsaXR5IHRvIHN0YXJ0IFZSL0FSIHNlc3Npb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIGNoZWNrIGlmIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiBpZiAoYXBwLnhyLmlzQXZhaWxhYmxlKHBjLlhSVFlQRV9WUikpIHtcbiAgICAgICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiB9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnhyID0gYXBwT3B0aW9ucy54ciA/IG5ldyBhcHBPcHRpb25zLnhyKHRoaXMpIDogbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5hdHRhY2hTZWxlY3RFdmVudHMoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2luVG9vbHMgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Fzc2V0fG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NjcmlwdFByZWZpeCA9IGFwcE9wdGlvbnMuc2NyaXB0UHJlZml4IHx8ICcnO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoXCJidW5kbGVcIiwgbmV3IEJ1bmRsZUhhbmRsZXIodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgcmVzb3VyY2UgaGFuZGxlcnNcbiAgICAgICAgYXBwT3B0aW9ucy5yZXNvdXJjZUhhbmRsZXJzLmZvckVhY2goKHJlc291cmNlSGFuZGxlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyByZXNvdXJjZUhhbmRsZXIodGhpcyk7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5hZGRIYW5kbGVyKGhhbmRsZXIuaGFuZGxlclR5cGUsIGhhbmRsZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3MgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeS4gVGhlIEFwcGxpY2F0aW9uIGNvbnN0cnVjdG9yIGFkZHMgdGhlXG4gICAgICAgICAqIGZvbGxvd2luZyBjb21wb25lbnQgc3lzdGVtcyB0byBpdHMgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSBhbmltICh7QGxpbmsgQW5pbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYW5pbWF0aW9uICh7QGxpbmsgQW5pbWF0aW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhdWRpb2xpc3RlbmVyICh7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYnV0dG9uICh7QGxpbmsgQnV0dG9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBjYW1lcmEgKHtAbGluayBDYW1lcmFDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNvbGxpc2lvbiAoe0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gZWxlbWVudCAoe0BsaW5rIEVsZW1lbnRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGNoaWxkICh7QGxpbmsgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGdyb3VwICh7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxpZ2h0ICh7QGxpbmsgTGlnaHRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIG1vZGVsICh7QGxpbmsgTW9kZWxDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHBhcnRpY2xlc3lzdGVtICh7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHJpZ2lkYm9keSAoe0BsaW5rIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmVuZGVyICh7QGxpbmsgUmVuZGVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JlZW4gKHtAbGluayBTY3JlZW5Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmlwdCAoe0BsaW5rIFNjcmlwdENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2Nyb2xsYmFyICh7QGxpbmsgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGx2aWV3ICh7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc291bmQgKHtAbGluayBTb3VuZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc3ByaXRlICh7QGxpbmsgU3ByaXRlQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgZ2xvYmFsIGdyYXZpdHkgdG8gemVyb1xuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldCgwLCAwLCAwKTtcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSBnbG9iYWwgc291bmQgdm9sdW1lIHRvIDUwJVxuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnNvdW5kLnZvbHVtZSA9IDAuNTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IG5ldyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSgpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgcmVnaXN0ZXIgYWxsIHJlcXVpcmVkIGNvbXBvbmVudCBzeXN0ZW1zXG4gICAgICAgIGFwcE9wdGlvbnMuY29tcG9uZW50U3lzdGVtcy5mb3JFYWNoKChjb21wb25lbnRTeXN0ZW0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5hZGQobmV3IGNvbXBvbmVudFN5c3RlbSh0aGlzKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciA9IHRoaXMub25WaXNpYmlsaXR5Q2hhbmdlLmJpbmQodGhpcyk7XG5cbiAgICAgICAgLy8gRGVwZW5kaW5nIG9uIGJyb3dzZXIgYWRkIHRoZSBjb3JyZWN0IHZpc2liaWxpdHljaGFuZ2UgZXZlbnQgYW5kIHN0b3JlIHRoZSBuYW1lIG9mIHRoZVxuICAgICAgICAvLyBoaWRkZW4gYXR0cmlidXRlIGluIHRoaXMuX2hpZGRlbkF0dHIuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuaGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ2hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1vekhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtb3pIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5tc0hpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtc0hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQud2Via2l0SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ3dlYmtpdEhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBiaW5kIHRpY2sgZnVuY3Rpb24gdG8gY3VycmVudCBzY29wZVxuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdXNlLWJlZm9yZS1kZWZpbmUgKi9cbiAgICAgICAgdGhpcy50aWNrID0gbWFrZVRpY2sodGhpcyk7IC8vIENpcmN1bGFyIGxpbnRpbmcgaXNzdWUgYXMgbWFrZVRpY2sgYW5kIEFwcGxpY2F0aW9uIHJlZmVyZW5jZSBlYWNoIG90aGVyXG4gICAgfVxuXG4gICAgc3RhdGljIF9hcHBsaWNhdGlvbnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi4gSW4gdGhlIGNhc2Ugd2hlcmUgdGhlcmUgYXJlIG11bHRpcGxlIHJ1bm5pbmcgYXBwbGljYXRpb25zLCB0aGVcbiAgICAgKiBmdW5jdGlvbiBjYW4gZ2V0IGFuIGFwcGxpY2F0aW9uIGJhc2VkIG9uIGEgc3VwcGxpZWQgY2FudmFzIGlkLiBUaGlzIGZ1bmN0aW9uIGlzIHBhcnRpY3VsYXJseVxuICAgICAqIHVzZWZ1bCB3aGVuIHRoZSBjdXJyZW50IEFwcGxpY2F0aW9uIGlzIG5vdCByZWFkaWx5IGF2YWlsYWJsZS4gRm9yIGV4YW1wbGUsIGluIHRoZSBKYXZhU2NyaXB0XG4gICAgICogY29uc29sZSBvZiB0aGUgYnJvd3NlcidzIGRldmVsb3BlciB0b29scy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbaWRdIC0gSWYgZGVmaW5lZCwgdGhlIHJldHVybmVkIGFwcGxpY2F0aW9uIHNob3VsZCB1c2UgdGhlIGNhbnZhcyB3aGljaCBoYXNcbiAgICAgKiB0aGlzIGlkLiBPdGhlcndpc2UgY3VycmVudCBhcHBsaWNhdGlvbiB3aWxsIGJlIHJldHVybmVkLlxuICAgICAqIEByZXR1cm5zIHtBcHBCYXNlfHVuZGVmaW5lZH0gVGhlIHJ1bm5pbmcgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFwcCA9IHBjLkFwcEJhc2UuZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0QXBwbGljYXRpb24oaWQpIHtcbiAgICAgICAgcmV0dXJuIGlkID8gQXBwQmFzZS5fYXBwbGljYXRpb25zW2lkXSA6IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXREZWZhdWx0TWF0ZXJpYWwoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IFwiRGVmYXVsdCBNYXRlcmlhbFwiO1xuICAgICAgICBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPSBTUEVDVUxBUl9CTElOTjtcbiAgICAgICAgc2V0RGVmYXVsdE1hdGVyaWFsKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaW5pdFByb2dyYW1MaWJyYXJ5KCkge1xuICAgICAgICBjb25zdCBsaWJyYXJ5ID0gbmV3IFByb2dyYW1MaWJyYXJ5KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG5ldyBTdGFuZGFyZE1hdGVyaWFsKCkpO1xuICAgICAgICBzZXRQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBsaWJyYXJ5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgc291bmRNYW5hZ2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291bmRNYW5hZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuIFRoZSBiYXRjaCBtYW5hZ2VyIGlzIHVzZWQgdG8gbWVyZ2UgbWVzaCBpbnN0YW5jZXMgaW5cbiAgICAgKiB0aGUgc2NlbmUsIHdoaWNoIHJlZHVjZXMgdGhlIG92ZXJhbGwgbnVtYmVyIG9mIGRyYXcgY2FsbHMsIHRoZXJlYnkgYm9vc3RpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAqL1xuICAgIGdldCBiYXRjaGVyKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5fYmF0Y2hlciwgXCJCYXRjaE1hbmFnZXIgaGFzIG5vdCBiZWVuIGNyZWF0ZWQgYW5kIGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0IGZ1bmN0aW9uYWxpdHkuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBmaWxsIG1vZGUgb2YgdGhlIGNhbnZhcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfTk9ORX06IHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9OiB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmcgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfTogdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXQgY2FuIHdoaWxlXG4gICAgICogbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGZpbGxNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsbE1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgcmVzb2x1dGlvbiBtb2RlIG9mIHRoZSBjYW52YXMsIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHJlc29sdXRpb25Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzb2x1dGlvbk1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCB0aGUgYXBwbGljYXRpb24gY29uZmlndXJhdGlvbiBmaWxlIGFuZCBhcHBseSBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGFuZCBmaWxsIHRoZSBhc3NldFxuICAgICAqIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZSB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7Q29uZmlndXJlQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgaXNcbiAgICAgKiBsb2FkZWQgYW5kIHBhcnNlZCAob3IgYW4gZXJyb3Igb2NjdXJzKS5cbiAgICAgKi9cbiAgICBjb25maWd1cmUodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBodHRwLmdldCh1cmwsIChlcnIsIHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByb3BzID0gcmVzcG9uc2UuYXBwbGljYXRpb25fcHJvcGVydGllcztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lcyA9IHJlc3BvbnNlLnNjZW5lcztcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHJlc3BvbnNlLmFzc2V0cztcblxuICAgICAgICAgICAgdGhpcy5fcGFyc2VBcHBsaWNhdGlvblByb3BlcnRpZXMocHJvcHMsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZVNjZW5lcyhzY2VuZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQXNzZXRzKGFzc2V0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhbGwgYXNzZXRzIGluIHRoZSBhc3NldCByZWdpc3RyeSB0aGF0IGFyZSBtYXJrZWQgYXMgJ3ByZWxvYWQnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQcmVsb2FkQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gYWxsIGFzc2V0cyBhcmUgbG9hZGVkLlxuICAgICAqL1xuICAgIHByZWxvYWQoY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5maXJlKFwicHJlbG9hZDpzdGFydFwiKTtcblxuICAgICAgICAvLyBnZXQgbGlzdCBvZiBhc3NldHMgdG8gcHJlbG9hZFxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cy5saXN0KHtcbiAgICAgICAgICAgIHByZWxvYWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYXNzZXRzLmxlbmd0aCk7XG5cbiAgICAgICAgbGV0IF9kb25lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gY2hlY2sgaWYgYWxsIGxvYWRpbmcgaXMgZG9uZVxuICAgICAgICBjb25zdCBkb25lID0gKCkgPT4ge1xuICAgICAgICAgICAgLy8gZG8gbm90IHByb2NlZWQgaWYgYXBwbGljYXRpb24gZGVzdHJveWVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghX2RvbmUgJiYgcHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6ZW5kXCIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gdG90YWxzIGxvYWRpbmcgcHJvZ3Jlc3Mgb2YgYXNzZXRzXG4gICAgICAgIGNvbnN0IHRvdGFsID0gYXNzZXRzLmxlbmd0aDtcblxuICAgICAgICBpZiAocHJvZ3Jlc3MubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBvbkFzc2V0TG9hZCA9IChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncHJlbG9hZDpwcm9ncmVzcycsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Bc3NldEVycm9yID0gKGVyciwgYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGFzc2V0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRzW2ldLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBhc3NldHNbaV0ub25jZSgnbG9hZCcsIG9uQXNzZXRMb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2Vycm9yJywgb25Bc3NldEVycm9yKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5sb2FkKGFzc2V0c1tpXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6cHJvZ3Jlc3NcIiwgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb25lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcHJlbG9hZFNjcmlwdHMoc2NlbmVEYXRhLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXNjcmlwdC5sZWdhY3kpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSB0aGlzLl9nZXRTY3JpcHRSZWZlcmVuY2VzKHNjZW5lRGF0YSk7XG5cbiAgICAgICAgY29uc3QgbCA9IHNjcmlwdHMubGVuZ3RoO1xuICAgICAgICBjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcyhsKTtcbiAgICAgICAgY29uc3QgcmVnZXggPSAvXmh0dHAocyk/OlxcL1xcLy87XG5cbiAgICAgICAgaWYgKGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIFNjcmlwdFR5cGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNjcmlwdFVybCA9IHNjcmlwdHNbaV07XG4gICAgICAgICAgICAgICAgLy8gc3VwcG9ydCBhYnNvbHV0ZSBVUkxzIChmb3Igbm93KVxuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChzY3JpcHRVcmwudG9Mb3dlckNhc2UoKSkgJiYgdGhpcy5fc2NyaXB0UHJlZml4KVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRVcmwgPSBwYXRoLmpvaW4odGhpcy5fc2NyaXB0UHJlZml4LCBzY3JpcHRzW2ldKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQoc2NyaXB0VXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldCBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGZyb20gZGF0YSBmaWxlXG4gICAgX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBjb25maWd1cmUgcmV0cnlpbmcgYXNzZXRzXG4gICAgICAgIGlmICh0eXBlb2YgcHJvcHMubWF4QXNzZXRSZXRyaWVzID09PSAnbnVtYmVyJyAmJiBwcm9wcy5tYXhBc3NldFJldHJpZXMgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5lbmFibGVSZXRyeShwcm9wcy5tYXhBc3NldFJldHJpZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgdGVtcG9yYXJ5IGJsb2NrIGFmdGVyIG1pZ3JhdGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghcHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbylcbiAgICAgICAgICAgIHByb3BzLnVzZURldmljZVBpeGVsUmF0aW8gPSBwcm9wcy51c2VfZGV2aWNlX3BpeGVsX3JhdGlvO1xuICAgICAgICBpZiAoIXByb3BzLnJlc29sdXRpb25Nb2RlKVxuICAgICAgICAgICAgcHJvcHMucmVzb2x1dGlvbk1vZGUgPSBwcm9wcy5yZXNvbHV0aW9uX21vZGU7XG4gICAgICAgIGlmICghcHJvcHMuZmlsbE1vZGUpXG4gICAgICAgICAgICBwcm9wcy5maWxsTW9kZSA9IHByb3BzLmZpbGxfbW9kZTtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHByb3BzLndpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBwcm9wcy5oZWlnaHQ7XG4gICAgICAgIGlmIChwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvKSB7XG4gICAgICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLm1heFBpeGVsUmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0Q2FudmFzUmVzb2x1dGlvbihwcm9wcy5yZXNvbHV0aW9uTW9kZSwgdGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0Q2FudmFzRmlsbE1vZGUocHJvcHMuZmlsbE1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuXG4gICAgICAgIC8vIHNldCB1cCBsYXllcnNcbiAgICAgICAgaWYgKHByb3BzLmxheWVycyAmJiBwcm9wcy5sYXllck9yZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiYXBwbGljYXRpb25cIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcHJvcHMubGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHByb3BzLmxheWVyc1trZXldO1xuICAgICAgICAgICAgICAgIGRhdGEuaWQgPSBwYXJzZUludChrZXksIDEwKTtcbiAgICAgICAgICAgICAgICAvLyBkZXB0aCBsYXllciBzaG91bGQgb25seSBiZSBlbmFibGVkIHdoZW4gbmVlZGVkXG4gICAgICAgICAgICAgICAgLy8gYnkgaW5jcmVtZW50aW5nIGl0cyByZWYgY291bnRlclxuICAgICAgICAgICAgICAgIGRhdGEuZW5hYmxlZCA9IGRhdGEuaWQgIT09IExBWUVSSURfREVQVEg7XG4gICAgICAgICAgICAgICAgbGF5ZXJzW2tleV0gPSBuZXcgTGF5ZXIoZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5sYXllck9yZGVyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VibGF5ZXIgPSBwcm9wcy5sYXllck9yZGVyW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzW3N1YmxheWVyLmxheWVyXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChzdWJsYXllci50cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnB1c2hPcGFxdWUobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnN1YkxheWVyRW5hYmxlZFtpXSA9IHN1YmxheWVyLmVuYWJsZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gY29tcG9zaXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgYmF0Y2ggZ3JvdXBzXG4gICAgICAgIGlmIChwcm9wcy5iYXRjaEdyb3Vwcykge1xuICAgICAgICAgICAgY29uc3QgYmF0Y2hlciA9IHRoaXMuYmF0Y2hlcjtcbiAgICAgICAgICAgIGlmIChiYXRjaGVyKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BzLmJhdGNoR3JvdXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdycCA9IHByb3BzLmJhdGNoR3JvdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICBiYXRjaGVyLmFkZEdyb3VwKGdycC5uYW1lLCBncnAuZHluYW1pYywgZ3JwLm1heEFhYmJTaXplLCBncnAuaWQsIGdycC5sYXllcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBsb2NhbGl6YXRpb24gYXNzZXRzXG4gICAgICAgIGlmIChwcm9wcy5pMThuQXNzZXRzKSB7XG4gICAgICAgICAgICB0aGlzLmkxOG4uYXNzZXRzID0gcHJvcHMuaTE4bkFzc2V0cztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvYWRMaWJyYXJpZXMocHJvcHMubGlicmFyaWVzLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gdXJscyAtIExpc3Qgb2YgVVJMcyB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9hZExpYnJhcmllcyh1cmxzLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBsZW4gPSB1cmxzLmxlbmd0aDtcbiAgICAgICAgbGV0IGNvdW50ID0gbGVuO1xuXG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIHNjcmlwdCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvdW50LS07XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHVybCA9IHVybHNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QodXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgdXJsKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IHNjZW5lIG5hbWUvdXJscyBpbnRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gc2NlbmVzIC0gU2NlbmVzIHRvIGFkZCB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VTY2VuZXMoc2NlbmVzKSB7XG4gICAgICAgIGlmICghc2NlbmVzKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmVzLmFkZChzY2VuZXNbaV0ubmFtZSwgc2NlbmVzW2ldLnVybCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYXNzZXRzIGludG8gcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IGFzc2V0cyAtIEFzc2V0cyB0byBpbnNlcnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VBc3NldHMoYXNzZXRzKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBbXTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzSW5kZXggPSB7fTtcbiAgICAgICAgY29uc3QgYnVuZGxlc0luZGV4ID0ge307XG5cbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICAvLyBhZGQgc2NyaXB0cyBpbiBvcmRlciBvZiBsb2FkaW5nIGZpcnN0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2NyaXB0c09yZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSB0aGlzLnNjcmlwdHNPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgc2NyaXB0c0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCBidW5kbGVzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0c1tpZF0udHlwZSA9PT0gJ2J1bmRsZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1bmRsZXNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCByZXN0IG9mIGFzc2V0c1xuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c0luZGV4W2lkXSB8fCBidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1bmRsZXNJbmRleFtpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbGlzdFtpXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gbmV3IEFzc2V0KGRhdGEubmFtZSwgZGF0YS50eXBlLCBkYXRhLmZpbGUsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5pZCA9IHBhcnNlSW50KGRhdGEuaWQsIDEwKTtcbiAgICAgICAgICAgIGFzc2V0LnByZWxvYWQgPSBkYXRhLnByZWxvYWQgPyBkYXRhLnByZWxvYWQgOiBmYWxzZTtcbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgYSBzY3JpcHQgYXNzZXQgYW5kIGhhcyBhbHJlYWR5IGJlZW4gZW1iZWRkZWQgaW4gdGhlIHBhZ2UgdGhlblxuICAgICAgICAgICAgLy8gbWFyayBpdCBhcyBsb2FkZWRcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IGRhdGEudHlwZSA9PT0gJ3NjcmlwdCcgJiYgZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5sb2FkaW5nVHlwZSA+IDA7XG4gICAgICAgICAgICAvLyB0YWdzXG4gICAgICAgICAgICBhc3NldC50YWdzLmFkZChkYXRhLnRhZ3MpO1xuICAgICAgICAgICAgLy8gaTE4blxuICAgICAgICAgICAgaWYgKGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbG9jYWxlIGluIGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgICAgICBhc3NldC5hZGRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSwgZGF0YS5pMThuW2xvY2FsZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lzdHJ5XG4gICAgICAgICAgICB0aGlzLmFzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHJldHVybnMge0FycmF5fSAtIFRoZSBsaXN0IG9mIHNjcmlwdHMgdGhhdCBhcmUgcmVmZXJlbmNlZCBieSB0aGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZSkge1xuICAgICAgICBsZXQgcHJpb3JpdHlTY3JpcHRzID0gW107XG4gICAgICAgIGlmIChzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzKSB7XG4gICAgICAgICAgICBwcmlvcml0eVNjcmlwdHMgPSBzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgX3NjcmlwdHMgPSBbXTtcbiAgICAgICAgY29uc3QgX2luZGV4ID0ge307XG5cbiAgICAgICAgLy8gZmlyc3QgYWRkIHByaW9yaXR5IHNjcmlwdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmlvcml0eVNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIF9zY3JpcHRzLnB1c2gocHJpb3JpdHlTY3JpcHRzW2ldKTtcbiAgICAgICAgICAgIF9pbmRleFtwcmlvcml0eVNjcmlwdHNbaV1dID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gaXRlcmF0ZSBoaWVyYXJjaHkgdG8gZ2V0IHJlZmVyZW5jZWQgc2NyaXB0c1xuICAgICAgICBjb25zdCBlbnRpdGllcyA9IHNjZW5lLmVudGl0aWVzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBlbnRpdGllcykge1xuICAgICAgICAgICAgaWYgKCFlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0LnNjcmlwdHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoX2luZGV4W3NjcmlwdHNbaV0udXJsXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgX3NjcmlwdHMucHVzaChzY3JpcHRzW2ldLnVybCk7XG4gICAgICAgICAgICAgICAgX2luZGV4W3NjcmlwdHNbaV0udXJsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3NjcmlwdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIGRvZXMgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIDEuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnc3RhcnQnXG4gICAgICogMi4gQ2FsbHMgaW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDMuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnaW5pdGlhbGl6ZSdcbiAgICAgKiA0LiBDYWxscyBwb3N0SW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDUuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAncG9zdGluaXRpYWxpemUnXG4gICAgICogNi4gU3RhcnRzIGV4ZWN1dGluZyB0aGUgbWFpbiBsb29wIG9mIHRoZSBhcHBsaWNhdGlvblxuICAgICAqXG4gICAgICogVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSBQbGF5Q2FudmFzIGFwcGxpY2F0aW9ucyBtYWRlIGluIHRoZSBFZGl0b3IgYnV0IHlvdVxuICAgICAqIHdpbGwgbmVlZCB0byBjYWxsIHN0YXJ0IHlvdXJzZWxmIGlmIHlvdSBhcmUgdXNpbmcgdGhlIGVuZ2luZSBzdGFuZC1hbG9uZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICovXG4gICAgc3RhcnQoKSB7XG5cbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuX2FscmVhZHlTdGFydGVkLCBcIlRoZSBhcHBsaWNhdGlvbiBjYW4gYmUgc3RhcnRlZCBvbmx5IG9uZSB0aW1lLlwiKTtcbiAgICAgICAgICAgIHRoaXMuX2FscmVhZHlTdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG5cbiAgICAgICAgdGhpcy5maXJlKFwic3RhcnRcIiwge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBub3coKSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXRoaXMuX2xpYnJhcmllc0xvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2luaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLmZpcmUoJ2luaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdEluaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFBvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdwb3N0aW5pdGlhbGl6ZScpO1xuXG4gICAgICAgIHRoaXMudGljaygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBhbGwgaW5wdXQgZGV2aWNlcyBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaW5wdXRVcGRhdGUoZHQpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLnVwZGF0ZShkdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2UudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZ2FtZXBhZHMpIHtcbiAgICAgICAgICAgIHRoaXMuZ2FtZXBhZHMudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgdXBkYXRlIGZ1bmN0aW9ucyBhbmQgdGhlbiB0aGUgcG9zdFVwZGF0ZVxuICAgICAqIGZ1bmN0aW9ucyBvZiBhbGwgZW5hYmxlZCBjb21wb25lbnRzLiBJdCB3aWxsIHRoZW4gdXBkYXRlIHRoZSBjdXJyZW50IHN0YXRlIG9mIGFsbCBjb25uZWN0ZWRcbiAgICAgKiBpbnB1dCBkZXZpY2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lc1xuICAgICAqIG5vdCBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKi9cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5mcmFtZSsrO1xuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UudXBkYXRlQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBQZXJmb3JtIENvbXBvbmVudFN5c3RlbSB1cGRhdGVcbiAgICAgICAgaWYgKHNjcmlwdC5sZWdhY3kpXG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnZml4ZWRVcGRhdGUnLCAxLjAgLyA2MC4wKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSh0aGlzLl9pblRvb2xzID8gJ3Rvb2xzVXBkYXRlJyA6ICd1cGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdhbmltYXRpb25VcGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0VXBkYXRlJywgZHQpO1xuXG4gICAgICAgIC8vIGZpcmUgdXBkYXRlIGV2ZW50XG4gICAgICAgIHRoaXMuZmlyZShcInVwZGF0ZVwiLCBkdCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGlucHV0IGRldmljZXNcbiAgICAgICAgdGhpcy5pbnB1dFVwZGF0ZShkdCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGZyYW1lU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuZnJhbWVTdGFydCgpO1xuICAgIH1cblxuICAgIGZyYW1lRW5kKCkge1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmZyYW1lRW5kKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lLiBNb3JlIHNwZWNpZmljYWxseSwgdGhlIHNjZW5lJ3Mge0BsaW5rIExheWVyQ29tcG9zaXRpb259IGlzXG4gICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgaW4gdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wIGFuZCBkb2VzIG5vdFxuICAgICAqIG5lZWQgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyKCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5maXJlKCdwcmVyZW5kZXInKTtcbiAgICAgICAgdGhpcy5yb290LnN5bmNIaWVyYXJjaHkoKTtcblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlci51cGRhdGVBbGwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgc2NlbmUgY29tcG9zaXRpb25cbiAgICAgICAgdGhpcy5yZW5kZXJDb21wb3NpdGlvbih0aGlzLnNjZW5lLmxheWVycyk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdwb3N0cmVuZGVyJyk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHJlbmRlciBhIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgcmVuZGVyQ29tcG9zaXRpb24obGF5ZXJDb21wb3NpdGlvbikge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLmNsZWFyR3B1TWFya2VycygpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmJ1aWxkRnJhbWVHcmFwaCh0aGlzLmZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmZyYW1lR3JhcGgucmVuZGVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBub3cgLSBUaGUgdGltZXN0YW1wIHBhc3NlZCB0byB0aGUgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuIFRoaXMgaXMgc3ViamVjdCB0byB0aGVcbiAgICAgKiBhcHBsaWNhdGlvbidzIHRpbWUgc2NhbGUgYW5kIG1heCBkZWx0YSB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1zIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ZpbGxGcmFtZVN0YXRzQmFzaWMobm93LCBkdCwgbXMpIHtcbiAgICAgICAgLy8gVGltaW5nIHN0YXRzXG4gICAgICAgIGNvbnN0IHN0YXRzID0gdGhpcy5zdGF0cy5mcmFtZTtcbiAgICAgICAgc3RhdHMuZHQgPSBkdDtcbiAgICAgICAgc3RhdHMubXMgPSBtcztcbiAgICAgICAgaWYgKG5vdyA+IHN0YXRzLl90aW1lVG9Db3VudEZyYW1lcykge1xuICAgICAgICAgICAgc3RhdHMuZnBzID0gc3RhdHMuX2Zwc0FjY3VtO1xuICAgICAgICAgICAgc3RhdHMuX2Zwc0FjY3VtID0gMDtcbiAgICAgICAgICAgIHN0YXRzLl90aW1lVG9Db3VudEZyYW1lcyA9IG5vdyArIDEwMDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRvdGFsIGRyYXcgY2FsbFxuICAgICAgICB0aGlzLnN0YXRzLmRyYXdDYWxscy50b3RhbCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLl9kcmF3Q2FsbHNQZXJGcmFtZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpbGxGcmFtZVN0YXRzKCkge1xuICAgICAgICBsZXQgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuXG4gICAgICAgIC8vIFJlbmRlciBzdGF0c1xuICAgICAgICBzdGF0cy5jYW1lcmFzID0gdGhpcy5yZW5kZXJlci5fY2FtZXJhc1JlbmRlcmVkO1xuICAgICAgICBzdGF0cy5tYXRlcmlhbHMgPSB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzO1xuICAgICAgICBzdGF0cy5zaGFkZXJzID0gdGhpcy5ncmFwaGljc0RldmljZS5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVXBkYXRlcyA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFVwZGF0ZXM7XG4gICAgICAgIHN0YXRzLnNoYWRvd01hcFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lO1xuICAgICAgICBzdGF0cy5kZXB0aE1hcFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9kZXB0aE1hcFRpbWU7XG4gICAgICAgIHN0YXRzLmZvcndhcmRUaW1lID0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWU7XG4gICAgICAgIGNvbnN0IHByaW1zID0gdGhpcy5ncmFwaGljc0RldmljZS5fcHJpbXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMudHJpYW5nbGVzID0gcHJpbXNbUFJJTUlUSVZFX1RSSUFOR0xFU10gLyAzICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklTVFJJUF0gLSAyLCAwKSArXG4gICAgICAgICAgICBNYXRoLm1heChwcmltc1tQUklNSVRJVkVfVFJJRkFOXSAtIDIsIDApO1xuICAgICAgICBzdGF0cy5jdWxsVGltZSA9IHRoaXMucmVuZGVyZXIuX2N1bGxUaW1lO1xuICAgICAgICBzdGF0cy5zb3J0VGltZSA9IHRoaXMucmVuZGVyZXIuX3NvcnRUaW1lO1xuICAgICAgICBzdGF0cy5za2luVGltZSA9IHRoaXMucmVuZGVyZXIuX3NraW5UaW1lO1xuICAgICAgICBzdGF0cy5tb3JwaFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9tb3JwaFRpbWU7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnMgPSB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzO1xuICAgICAgICBzdGF0cy5saWdodENsdXN0ZXJzVGltZSA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnNUaW1lO1xuICAgICAgICBzdGF0cy5vdGhlclByaW1pdGl2ZXMgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaSA8IFBSSU1JVElWRV9UUklBTkdMRVMpIHtcbiAgICAgICAgICAgICAgICBzdGF0cy5vdGhlclByaW1pdGl2ZXMgKz0gcHJpbXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmltc1tpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJlci5fY2FtZXJhc1JlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbWF0ZXJpYWxTd2l0Y2hlcyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFVwZGF0ZXMgPSAwO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fY3VsbFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnNUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc29ydFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aE1hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZSA9IDA7XG5cbiAgICAgICAgLy8gRHJhdyBjYWxsIHN0YXRzXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cy5kcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmZvcndhcmQgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5jdWxsZWQgPSB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQ7XG4gICAgICAgIHN0YXRzLmRlcHRoID0gMDtcbiAgICAgICAgc3RhdHMuc2hhZG93ID0gdGhpcy5yZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5za2lubmVkID0gdGhpcy5yZW5kZXJlci5fc2tpbkRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuaW1tZWRpYXRlID0gMDtcbiAgICAgICAgc3RhdHMuaW5zdGFuY2VkID0gMDtcbiAgICAgICAgc3RhdHMucmVtb3ZlZEJ5SW5zdGFuY2luZyA9IDA7XG4gICAgICAgIHN0YXRzLm1pc2MgPSBzdGF0cy50b3RhbCAtIChzdGF0cy5mb3J3YXJkICsgc3RhdHMuc2hhZG93KTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZGVwdGhEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2tpbkRyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ltbWVkaWF0ZVJlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW5zdGFuY2VkRHJhd0NhbGxzID0gMDtcblxuICAgICAgICB0aGlzLnN0YXRzLm1pc2MucmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gdGhpcy5ncmFwaGljc0RldmljZS5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWU7XG5cbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLnBhcnRpY2xlcztcbiAgICAgICAgc3RhdHMudXBkYXRlc1BlckZyYW1lID0gc3RhdHMuX3VwZGF0ZXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMuZnJhbWVUaW1lID0gc3RhdHMuX2ZyYW1lVGltZTtcbiAgICAgICAgc3RhdHMuX3VwZGF0ZXNQZXJGcmFtZSA9IDA7XG4gICAgICAgIHN0YXRzLl9mcmFtZVRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0aGUgY2FudmFzIGZpbGxzIHRoZSB3aW5kb3cgYW5kIHJlc2l6ZXMgd2hlbiB0aGUgd2luZG93IGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHNpemUgb2YgdGhlIGNhbnZhcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfTk9ORX06IHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9OiB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmcgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfTogdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXQgY2FuIHdoaWxlXG4gICAgICogbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgKG9ubHkgdXNlZCB3aGVuIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMgKG9ubHkgdXNlZCB3aGVuIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9KS5cbiAgICAgKi9cbiAgICBzZXRDYW52YXNGaWxsTW9kZShtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gbW9kZTtcbiAgICAgICAgdGhpcy5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBjYW52YXMsIGFuZCBzZXQgdGhlIHdheSBpdCBiZWhhdmVzIHdoZW4gdGhlIHdpbmRvdyBpcyByZXNpemVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgLSBUaGUgbW9kZSB0byB1c2Ugd2hlbiBzZXR0aW5nIHRoZSByZXNvbHV0aW9uLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSBob3Jpem9udGFsIHJlc29sdXRpb24sIG9wdGlvbmFsIGluIEFVVE8gbW9kZSwgaWYgbm90IHByb3ZpZGVkXG4gICAgICogY2FudmFzIGNsaWVudFdpZHRoIGlzIHVzZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIHZlcnRpY2FsIHJlc29sdXRpb24sIG9wdGlvbmFsIGluIEFVVE8gbW9kZSwgaWYgbm90IHByb3ZpZGVkXG4gICAgICogY2FudmFzIGNsaWVudEhlaWdodCBpcyB1c2VkLlxuICAgICAqL1xuICAgIHNldENhbnZhc1Jlc29sdXRpb24obW9kZSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICB0aGlzLl9yZXNvbHV0aW9uTW9kZSA9IG1vZGU7XG5cbiAgICAgICAgLy8gSW4gQVVUTyBtb2RlIHRoZSByZXNvbHV0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBjYW52YXMgc2l6ZSwgdW5sZXNzIHNwZWNpZmllZFxuICAgICAgICBpZiAobW9kZSA9PT0gUkVTT0xVVElPTl9BVVRPICYmICh3aWR0aCA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgd2lkdGggPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5jbGllbnRXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudEhlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIHZpc2liaWxpdHkgb2YgdGhlIHdpbmRvdyBvciB0YWIgaW4gd2hpY2ggdGhlIGFwcGxpY2F0aW9uIGlzIHJ1bm5pbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYXBwbGljYXRpb24gaXMgbm90IHZpc2libGUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc0hpZGRlbigpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50W3RoaXMuX2hpZGRlbkF0dHJdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSB2aXNpYmlsaXR5IHN0YXRlIG9mIHRoZSBjdXJyZW50IHRhYi93aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25WaXNpYmlsaXR5Q2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5pc0hpZGRlbigpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmRNYW5hZ2VyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyLnN1c3BlbmQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIucmVzdW1lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNpemUgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQgaW4gbGluZSB3aXRoIHRoZSBjdXJyZW50IGZpbGwgbW9kZS5cbiAgICAgKlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdFxuICAgICAqIGNhbiB3aGlsZSBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmdcbiAgICAgKiBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfTk9ORX0gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgY2FudmFzLiBPbmx5IHVzZWQgaWYgY3VycmVudCBmaWxsIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9LlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEEgb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHZhbHVlcyBjYWxjdWxhdGVkIHRvIHVzZSBhcyB3aWR0aCBhbmQgaGVpZ2h0LlxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGlmICghdGhpcy5fYWxsb3dSZXNpemUpIHJldHVybiB1bmRlZmluZWQ7IC8vIHByZXZlbnQgcmVzaXppbmcgKGUuZy4gaWYgcHJlc2VudGluZyBpbiBWUiBITUQpXG5cbiAgICAgICAgLy8gcHJldmVudCByZXNpemluZyB3aGVuIGluIFhSIHNlc3Npb25cbiAgICAgICAgaWYgKHRoaXMueHIgJiYgdGhpcy54ci5zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICBjb25zdCB3aW5kb3dXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9LRUVQX0FTUEVDVCkge1xuICAgICAgICAgICAgY29uc3QgciA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLndpZHRoIC8gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaGVpZ2h0O1xuICAgICAgICAgICAgY29uc3Qgd2luUiA9IHdpbmRvd1dpZHRoIC8gd2luZG93SGVpZ2h0O1xuXG4gICAgICAgICAgICBpZiAociA+IHdpblIpIHtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHdpbmRvd1dpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHdpZHRoIC8gcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2luZG93SGVpZ2h0O1xuICAgICAgICAgICAgICAgIHdpZHRoID0gaGVpZ2h0ICogcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9maWxsTW9kZSA9PT0gRklMTE1PREVfRklMTF9XSU5ET1cpIHtcbiAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gT1RIRVJXSVNFOiBGSUxMTU9ERV9OT05FIHVzZSB3aWR0aCBhbmQgaGVpZ2h0IHRoYXQgYXJlIHByb3ZpZGVkXG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDYW52YXNTaXplKCk7XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSBmaW5hbCB2YWx1ZXMgY2FsY3VsYXRlZCBmb3Igd2lkdGggYW5kIGhlaWdodFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2V9IGNhbnZhcyBzaXplIHRvIG1hdGNoIHRoZSBjYW52YXMgc2l6ZSBvbiB0aGUgZG9jdW1lbnRcbiAgICAgKiBwYWdlLiBJdCBpcyByZWNvbW1lbmRlZCB0byBjYWxsIHRoaXMgZnVuY3Rpb24gd2hlbiB0aGUgY2FudmFzIHNpemUgY2hhbmdlcyAoZS5nIG9uIHdpbmRvd1xuICAgICAqIHJlc2l6ZSBhbmQgb3JpZW50YXRpb24gY2hhbmdlIGV2ZW50cykgc28gdGhhdCB0aGUgY2FudmFzIHJlc29sdXRpb24gaXMgaW1tZWRpYXRlbHkgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVDYW52YXNTaXplKCkge1xuICAgICAgICAvLyBEb24ndCB1cGRhdGUgaWYgd2UgYXJlIGluIFZSIG9yIFhSXG4gICAgICAgIGlmICgoIXRoaXMuX2FsbG93UmVzaXplKSB8fCAodGhpcy54cj8uYWN0aXZlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW4gQVVUTyBtb2RlIHRoZSByZXNvbHV0aW9uIGlzIGNoYW5nZWQgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplXG4gICAgICAgIGlmICh0aGlzLl9yZXNvbHV0aW9uTW9kZSA9PT0gUkVTT0xVVElPTl9BVVRPKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgY2FudmFzIERPTSBoYXMgY2hhbmdlZCBzaXplXG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcztcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVzaXplQ2FudmFzKGNhbnZhcy5jbGllbnRXaWR0aCwgY2FudmFzLmNsaWVudEhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFdmVudCBoYW5kbGVyIGNhbGxlZCB3aGVuIGFsbCBjb2RlIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLiBDb2RlIGxpYnJhcmllcyBhcmUgcGFzc2VkXG4gICAgICogaW50byB0aGUgY29uc3RydWN0b3Igb2YgdGhlIEFwcGxpY2F0aW9uIGFuZCB0aGUgYXBwbGljYXRpb24gd29uJ3Qgc3RhcnQgcnVubmluZyBvciBsb2FkXG4gICAgICogcGFja3MgdW50aWwgYWxsIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxpYnJhcmllc0xvYWRlZCgpIHtcbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnJpZ2lkYm9keS5vbkxpYnJhcnlMb2FkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IHNjZW5lIHNldHRpbmdzIHRvIHRoZSBjdXJyZW50IHNjZW5lLiBVc2VmdWwgd2hlbiB5b3VyIHNjZW5lIHNldHRpbmdzIGFyZSBwYXJzZWQgb3JcbiAgICAgKiBnZW5lcmF0ZWQgZnJvbSBhIG5vbi1VUkwgc291cmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIC0gVGhlIHNjZW5lIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnBoeXNpY3MgLSBUaGUgcGh5c2ljcyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eSAtIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbFxuICAgICAqIGdyYXZpdHkgaW4gdGhlIHBoeXNpY3Mgc2ltdWxhdGlvbi4gTXVzdCBiZSBhIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsXG4gICAgICogY29ycmVzcG9uZGluZyB0byBlYWNoIGF4aXMgWyBYLCBZLCBaIF0uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnJlbmRlciAtIFRoZSByZW5kZXJpbmcgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZ2xvYmFsX2FtYmllbnQgLSBUaGUgY29sb3Igb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodC5cbiAgICAgKiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWxcbiAgICAgKiBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ3MucmVuZGVyLmZvZyAtIFRoZSB0eXBlIG9mIGZvZyB1c2VkIGJ5IHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRk9HX05PTkV9XG4gICAgICogLSB7QGxpbmsgRk9HX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFAyfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLmZvZ19jb2xvciAtIFRoZSBjb2xvciBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gTXVzdCBiZSBhXG4gICAgICogZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWwgWyBSLCBHLCBCIF0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfZGVuc2l0eSAtIFRoZSBkZW5zaXR5IG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBUaGlzXG4gICAgICogcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0VYUH0gb3Ige0BsaW5rIEZPR19FWFAyfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19zdGFydCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIGJlZ2lucy4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19lbmQgLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2dcbiAgICAgKiByZWFjaGVzIGl0cyBtYXhpbXVtLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZ2FtbWFfY29ycmVjdGlvbiAtIFRoZSBnYW1tYSBjb3JyZWN0aW9uIHRvIGFwcGx5IHdoZW5cbiAgICAgKiByZW5kZXJpbmcgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBHQU1NQV9OT05FfVxuICAgICAqIC0ge0BsaW5rIEdBTU1BX1NSR0J9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnRvbmVtYXBwaW5nIC0gVGhlIHRvbmVtYXBwaW5nIHRyYW5zZm9ybSB0byBhcHBseSB3aGVuXG4gICAgICogd3JpdGluZyBmcmFnbWVudHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9GSUxNSUN9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9IRUpMfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfQUNFU31cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZXhwb3N1cmUgLSBUaGUgZXhwb3N1cmUgdmFsdWUgdHdlYWtzIHRoZSBvdmVyYWxsIGJyaWdodG5lc3NcbiAgICAgKiBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVsbH0gW3NldHRpbmdzLnJlbmRlci5za3lib3hdIC0gVGhlIGFzc2V0IElEIG9mIHRoZSBjdWJlIG1hcCB0ZXh0dXJlIHRvIGJlXG4gICAgICogdXNlZCBhcyB0aGUgc2NlbmUncyBza3lib3guIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hJbnRlbnNpdHkgLSBNdWx0aXBsaWVyIGZvciBza3lib3ggaW50ZW5zaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBza3lib3ggaW50ZW5zaXR5IHdoZW4gcGh5c2ljYWwgbGlnaHQgdW5pdHMgYXJlIGVuYWJsZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hNaXAgLSBUaGUgbWlwIGxldmVsIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLlxuICAgICAqIE9ubHkgdmFsaWQgZm9yIHByZWZpbHRlcmVkIGN1YmVtYXAgc2t5Ym94ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLnNreWJveFJvdGF0aW9uIC0gUm90YXRpb24gb2Ygc2t5Ym94LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBTaXplTXVsdGlwbGllciAtIFRoZSBsaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1heFJlc29sdXRpb24gLSBUaGUgbWF4aW11bSBsaWdodG1hcCByZXNvbHV0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBNb2RlIC0gVGhlIGxpZ2h0bWFwIGJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcC9zcGVjdWxhcilcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlIC0gRW5hYmxlIGJha2luZyBhbWJpZW50IGxpZ2h0IGludG8gbGlnaHRtYXBzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VOdW1TYW1wbGVzIC0gTnVtYmVyIG9mIHNhbXBsZXMgdG8gdXNlIHdoZW4gYmFraW5nIGFtYmllbnQgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZVNwaGVyZVBhcnQgLSBIb3cgbXVjaCBvZiB0aGUgc3BoZXJlIHRvIGluY2x1ZGUgd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyAtIEJyaWdodG5lc3Mgb2YgdGhlIGJha2VkIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCAtIENvbnRyYXN0IG9mIHRoZSBiYWtlZCBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRMdW1pbmFuY2UgLSBMdXggKGxtL21eMikgdmFsdWUgZm9yIGFtYmllbnQgbGlnaHQgaW50ZW5zaXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIC0gRW5hYmxlIGNsdXN0ZXJlZCBsaWdodGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd3NFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IHNoYWRvd3MuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDb29raWVzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBjb29raWUgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBhcmVhIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93QXRsYXNSZXNvbHV0aW9uIC0gUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgc2hhZG93IHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDb29raWVBdGxhc1Jlc29sdXRpb24gLSBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBjb29raWUgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ01heExpZ2h0c1BlckNlbGwgLSBNYXhpbXVtIG51bWJlciBvZiBsaWdodHMgYSBjZWxsIGNhbiBzdG9yZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93VHlwZSAtIFRoZSB0eXBlIG9mIHNoYWRvdyBmaWx0ZXJpbmcgdXNlZCBieSBhbGwgc2hhZG93cy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjF9OiBQQ0YgMXgxIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YzfTogUENGIDN4MyBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGNX06IFBDRiA1eDUgc2FtcGxpbmcuIEZhbGxzIGJhY2sgdG8ge0BsaW5rIFNIQURPV19QQ0YzfSBvbiBXZWJHTCAxLjAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0NlbGxzIC0gTnVtYmVyIG9mIGNlbGxzIGFsb25nIGVhY2ggd29ybGQtc3BhY2UgYXhpcyB0aGUgc3BhY2UgY29udGFpbmluZyBsaWdodHNcbiAgICAgKiBpcyBzdWJkaXZpZGVkIGludG8uXG4gICAgICpcbiAgICAgKiBPbmx5IGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSB3aWxsIGJlIHVzZWQgZm9yIGdlbmVyYXRpbmcgdGhlIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogY29uc3Qgc2V0dGluZ3MgPSB7XG4gICAgICogICAgIHBoeXNpY3M6IHtcbiAgICAgKiAgICAgICAgIGdyYXZpdHk6IFswLCAtOS44LCAwXVxuICAgICAqICAgICB9LFxuICAgICAqICAgICByZW5kZXI6IHtcbiAgICAgKiAgICAgICAgIGZvZ19lbmQ6IDEwMDAsXG4gICAgICogICAgICAgICB0b25lbWFwcGluZzogMCxcbiAgICAgKiAgICAgICAgIHNreWJveDogbnVsbCxcbiAgICAgKiAgICAgICAgIGZvZ19kZW5zaXR5OiAwLjAxLFxuICAgICAqICAgICAgICAgZ2FtbWFfY29ycmVjdGlvbjogMSxcbiAgICAgKiAgICAgICAgIGV4cG9zdXJlOiAxLFxuICAgICAqICAgICAgICAgZm9nX3N0YXJ0OiAxLFxuICAgICAqICAgICAgICAgZ2xvYmFsX2FtYmllbnQ6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIHNreWJveEludGVuc2l0eTogMSxcbiAgICAgKiAgICAgICAgIHNreWJveFJvdGF0aW9uOiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBmb2dfY29sb3I6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwTW9kZTogMSxcbiAgICAgKiAgICAgICAgIGZvZzogJ25vbmUnLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNYXhSZXNvbHV0aW9uOiAyMDQ4LFxuICAgICAqICAgICAgICAgc2t5Ym94TWlwOiAyLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllcjogMTZcbiAgICAgKiAgICAgfVxuICAgICAqIH07XG4gICAgICogYXBwLmFwcGx5U2NlbmVTZXR0aW5ncyhzZXR0aW5ncyk7XG4gICAgICovXG4gICAgYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKSB7XG4gICAgICAgIGxldCBhc3NldDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXZpdHkgPSBzZXR0aW5ncy5waHlzaWNzLmdyYXZpdHk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KGdyYXZpdHlbMF0sIGdyYXZpdHlbMV0sIGdyYXZpdHlbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zY2VuZS5hcHBseVNldHRpbmdzKHNldHRpbmdzKTtcblxuICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLmhhc093blByb3BlcnR5KCdza3lib3gnKSkge1xuICAgICAgICAgICAgaWYgKHNldHRpbmdzLnJlbmRlci5za3lib3gpIHtcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuYXNzZXRzLmdldChzZXR0aW5ncy5yZW5kZXIuc2t5Ym94KTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgnYWRkOicgKyBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94LCB0aGlzLnNldFNreWJveCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFyZWEgbGlnaHQgTFVUIHRhYmxlcyBmb3IgdGhpcyBhcHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQxIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbHRjTWF0MiAtIExVVCB0YWJsZSBvZiB0eXBlIGBhcnJheWAgdG8gYmUgc2V0LlxuICAgICAqL1xuICAgIHNldEFyZWFMaWdodEx1dHMobHRjTWF0MSwgbHRjTWF0Mikge1xuXG4gICAgICAgIGlmIChsdGNNYXQxICYmIGx0Y01hdDIpIHtcbiAgICAgICAgICAgIEFyZWFMaWdodEx1dHMuc2V0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGx0Y01hdDEsIGx0Y01hdDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcud2FybihcInNldEFyZWFMaWdodEx1dHM6IExVVHMgZm9yIGFyZWEgbGlnaHQgYXJlIG5vdCB2YWxpZFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNreWJveCBhc3NldCB0byBjdXJyZW50IHNjZW5lLCBhbmQgc3Vic2NyaWJlcyB0byBhc3NldCBsb2FkL2NoYW5nZSBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIEFzc2V0IG9mIHR5cGUgYHNreWJveGAgdG8gYmUgc2V0IHRvLCBvciBudWxsIHRvIHJlbW92ZSBza3lib3guXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldCAhPT0gdGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94UmVtb3ZlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94Q2hhbmdlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNjZW5lLnNldFNreWJveCh0aGlzLl9za3lib3hBc3NldCA/IHRoaXMuX3NreWJveEFzc2V0LnJlc291cmNlcyA6IG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gY2xlYW51cCBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub2ZmKCdsb2FkOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub2ZmKCdjaGFuZ2UnLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgbmV3IGFzc2V0XG4gICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IGFzc2V0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub24oJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uY2UoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub24oJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5za3lib3hNaXAgPT09IDAgJiYgIXRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5sb2FkRmFjZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLmxvYWQodGhpcy5fc2t5Ym94QXNzZXQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvblNreWJveENoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJha2UoKSB7XG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmJha2UobnVsbCwgdGhpcy5zY2VuZS5saWdodG1hcE1vZGUpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJhdGNoKCkge1xuICAgICAgICB0aGlzLmJhdGNoZXI/LmdlbmVyYXRlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZSBhbiBvcHBvcnR1bml0eSB0byBtb2RpZnkgdGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfHVuZGVmaW5lZH0gVGhlIG1vZGlmaWVkIHRpbWVzdGFtcC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3Byb2Nlc3NUaW1lc3RhbXAodGltZXN0YW1wKSB7XG4gICAgICAgIHJldHVybiB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBzaW5nbGUgbGluZS4gTGluZSBzdGFydCBhbmQgZW5kIGNvb3JkaW5hdGVzIGFyZSBzcGVjaWZpZWQgaW4gd29ybGQtc3BhY2UuIFRoZSBsaW5lXG4gICAgICogd2lsbCBiZSBmbGF0LXNoYWRlZCB3aXRoIHRoZSBzcGVjaWZpZWQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHN0YXJ0IHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBlbmQgLSBUaGUgZW5kIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgbGluZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lIGlzIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgd2hpdGUgbGluZVxuICAgICAqIGNvbnN0IHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogY29uc3QgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgcmVkIGxpbmUgd2hpY2ggaXMgbm90IGRlcHRoIHRlc3RlZCBhbmQgcmVuZGVycyBvbiB0b3Agb2Ygb3RoZXIgZ2VvbWV0cnlcbiAgICAgKiBjb25zdCBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGNvbnN0IGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kLCBwYy5Db2xvci5SRUQsIGZhbHNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHdoaXRlIGxpbmUgaW50byB0aGUgd29ybGQgbGF5ZXJcbiAgICAgKiBjb25zdCBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGNvbnN0IGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGNvbnN0IHdvcmxkTGF5ZXIgPSBhcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChwYy5MQVlFUklEX1dPUkxEKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuV0hJVEUsIHRydWUsIHdvcmxkTGF5ZXIpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuIFRoZXJlZm9yZSwgdGhlIGxlbmd0aHMgb2YgdGhlIHN1cHBsaWVkIHBvc2l0aW9uIGFuZCBjb2xvciBhcnJheXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGFuZCBhbHNvIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAyLiBUaGUgY29sb3JzIG9mIHRoZSBlbmRzIG9mIGVhY2ggbGluZSBzZWdtZW50IHdpbGwgYmVcbiAgICAgKiBpbnRlcnBvbGF0ZWQgYWxvbmcgdGhlIGxlbmd0aCBvZiBlYWNoIGxpbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzNbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgcG9pbnRzIHRvIGRyYXcgbGluZXMgYmV0d2Vlbi4gVGhlIGxlbmd0aCBvZiB0aGVcbiAgICAgKiBhcnJheSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge0NvbG9yW10gfCBDb2xvcn0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIG9yIGEgc2luZ2xlIGNvbG9yLiBJZiBhbiBhcnJheSBpc1xuICAgICAqIHNwZWNpZmllZCwgdGhpcyBtdXN0IGJlIHRoZSBzYW1lIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5XG4gICAgICogbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgc2luZ2xlIGxpbmUsIHdpdGggdW5pcXVlIGNvbG9ycyBmb3IgZWFjaCBwb2ludFxuICAgICAqIGNvbnN0IHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogY29uc3QgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lcyhbc3RhcnQsIGVuZF0sIFtwYy5Db2xvci5SRUQsIHBjLkNvbG9yLldISVRFXSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgMiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzXG4gICAgICogY29uc3QgcG9pbnRzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMCwgMCwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDAsIDApLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDEsIDEpXG4gICAgICogXTtcbiAgICAgKiBjb25zdCBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBwYy5Db2xvci5SRUQsXG4gICAgICogICAgIHBjLkNvbG9yLllFTExPVyxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIHBjLkNvbG9yLkNZQU4sXG4gICAgICogICAgIHBjLkNvbG9yLkJMVUVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBFYWNoIHBvaW50IGlzXG4gICAgICogcmVwcmVzZW50ZWQgYnkgMyBudW1iZXJzIC0geCwgeSBhbmQgeiBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiBjb25zdCBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAwLCAwLCAwLFxuICAgICAqICAgICAxLCAwLCAwLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMSwgMSwgMCxcbiAgICAgKiAgICAgMSwgMSwgMVxuICAgICAqIF07XG4gICAgICogY29uc3QgY29sb3JzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgMSwgMCwgMCwgMSwgIC8vIHJlZFxuICAgICAqICAgICAwLCAxLCAwLCAxLCAgLy8gZ3JlZW5cbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIDAsIDAsIDEsIDEsICAvLyBibHVlXG4gICAgICogICAgIDEsIDEsIDEsIDEgICAvLyB3aGl0ZVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lQXJyYXlzKHBvaW50cywgY29sb3JzKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSB3aXJlZnJhbWUgc3BoZXJlIHdpdGggY2VudGVyLCByYWRpdXMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBjZW50ZXIgLSBUaGUgY2VudGVyIG9mIHRoZSBzcGhlcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJhZGl1cyAtIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzZWdtZW50c10gLSBOdW1iZXIgb2YgbGluZSBzZWdtZW50cyB1c2VkIHRvIHJlbmRlciB0aGUgY2lyY2xlcyBmb3JtaW5nIHRoZVxuICAgICAqIHNwaGVyZS4gRGVmYXVsdHMgdG8gMjAuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgc3BoZXJlIHdpdGggcmFkaXVzIG9mIDFcbiAgICAgKiBjb25zdCBjZW50ZXIgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVTcGhlcmUoY2VudGVyLCAxLjAsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciA9IENvbG9yLldISVRFLCBzZWdtZW50cyA9IDIwLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IsIHNlZ21lbnRzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBheGlzIGFsaWduZWQgYm94IHNwZWNpZmllZCBieSBtaW4gYW5kIG1heCBwb2ludHMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBtaW5Qb2ludCAtIFRoZSBtaW4gY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtWZWMzfSBtYXhQb2ludCAtIFRoZSBtYXggY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAcGFyYW0ge01hdDR9IFttYXRdIC0gTWF0cml4IHRvIHRyYW5zZm9ybSB0aGUgYm94IGJlZm9yZSByZW5kZXJpbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSByZWQgd2lyZSBhbGlnbmVkIGJveFxuICAgICAqIGNvbnN0IG1pbiA9IG5ldyBwYy5WZWMzKC0xLCAtMSwgLTEpO1xuICAgICAqIGNvbnN0IG1heCA9IG5ldyBwYy5WZWMzKDEsIDEsIDEpO1xuICAgICAqIGFwcC5kcmF3V2lyZUFsaWduZWRCb3gobWluLCBtYXgsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlQWxpZ25lZEJveChtaW5Qb2ludCwgbWF4UG9pbnQsIGNvbG9yID0gQ29sb3IuV0hJVEUsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyLCBtYXQpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd1dpcmVBbGlnbmVkQm94KG1pblBvaW50LCBtYXhQb2ludCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIsIG1hdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoSW5zdGFuY2UgYXQgdGhpcyBmcmFtZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlXG4gICAgICogdG8gZHJhdy5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSBpbnRvLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2ggYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLmpzJykuTWVzaH0gbWVzaCAtIFRoZSBtZXNoIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaChtZXNoLCBtYXRlcmlhbCwgbWF0cml4LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBxdWFkIG9mIHNpemUgWy0wLjUsIDAuNV0gYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIHF1YWQuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHF1YWQgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0UXVhZE1lc2goKSwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHVzZWQgd2hlbiByZW5kZXJpbmcgdGhlIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmaWx0ZXJhYmxlXSAtIEluZGljYXRlIGlmIHRoZSB0ZXh0dXJlIGNhbiBiZSBzYW1wbGVkIHVzaW5nIGZpbHRlcmluZy5cbiAgICAgKiBQYXNzaW5nIGZhbHNlIHVzZXMgdW5maWx0ZXJlZCBzYW1wbGluZywgYWxsb3dpbmcgYSBkZXB0aCB0ZXh0dXJlIHRvIGJlIHNhbXBsZWQgb24gV2ViR1BVLlxuICAgICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdUZXh0dXJlKHgsIHksIHdpZHRoLCBoZWlnaHQsIHRleHR1cmUsIG1hdGVyaWFsLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllciwgZmlsdGVyYWJsZSA9IHRydWUpIHtcblxuICAgICAgICAvLyBvbmx5IFdlYkdQVSBzdXBwb3J0cyBmaWx0ZXJhYmxlIHBhcmFtZXRlciB0byBiZSBmYWxzZSwgYWxsb3dpbmcgYSBkZXB0aCB0ZXh0dXJlIC8gc2hhZG93XG4gICAgICAgIC8vIG1hcCB0byBiZSBmZXRjaGVkICh3aXRob3V0IGZpbHRlcmluZykgYW5kIHJlbmRlcmVkXG4gICAgICAgIGlmIChmaWx0ZXJhYmxlID09PSBmYWxzZSAmJiAhdGhpcy5ncmFwaGljc0RldmljZS5pc1dlYkdQVSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBUT0RPOiBpZiB0aGlzIGlzIHVzZWQgZm9yIGFueXRoaW5nIG90aGVyIHRoYW4gZGVidWcgdGV4dHVyZSBkaXNwbGF5LCB3ZSBzaG91bGQgb3B0aW1pemUgdGhpcyB0byBhdm9pZCBhbGxvY2F0aW9uc1xuICAgICAgICBjb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICBtYXRyaXguc2V0VFJTKG5ldyBWZWMzKHgsIHksIDAuMCksIFF1YXQuSURFTlRJVFksIG5ldyBWZWMzKHdpZHRoLCAtaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX05PTkU7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoXCJjb2xvck1hcFwiLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoYWRlciA9IGZpbHRlcmFibGUgPyB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRUZXh0dXJlU2hhZGVyKCkgOiB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRVbmZpbHRlcmFibGVUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgZGVwdGggdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mXG4gICAgICogdGhlIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd0RlcHRoVGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0RGVwdGhUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbnVsbCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhcHBsaWNhdGlvbiBhbmQgcmVtb3ZlcyBhbGwgZXZlbnQgbGlzdGVuZXJzIGF0IHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZW5naW5lIGZyYW1lXG4gICAgICogdXBkYXRlLiBIb3dldmVyLCBpZiBjYWxsZWQgb3V0c2lkZSBvZiB0aGUgZW5naW5lIGZyYW1lIHVwZGF0ZSwgY2FsbGluZyBkZXN0cm95KCkgd2lsbFxuICAgICAqIGRlc3Ryb3kgdGhlIGFwcGxpY2F0aW9uIGltbWVkaWF0ZWx5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuZGVzdHJveSgpO1xuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkZyYW1lVXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhbnZhc0lkID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaWQ7XG5cbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95JywgdGhpcyk7IC8vIGZpcmUgZGVzdHJveSBldmVudFxuICAgICAgICB0aGlzLm9mZignbGlicmFyaWVzbG9hZGVkJyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucm9vdC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2Uub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5rZXlib2FyZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLnRvdWNoLm9mZigpO1xuICAgICAgICAgICAgdGhpcy50b3VjaC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2ggPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmdhbWVwYWRzKSB7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZ2FtZXBhZHMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5kZXN0cm95KCk7XG5cbiAgICAgICAgLy8gbGF5ZXIgY29tcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycy5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXN0cm95IGFsbCB0ZXh0dXJlIHJlc291cmNlc1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cy5saXN0KCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhc3NldHNbaV0udW5sb2FkKCk7XG4gICAgICAgICAgICBhc3NldHNbaV0ub2ZmKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hc3NldHMub2ZmKCk7XG5cblxuICAgICAgICAvLyBkZXN0cm95IGJ1bmRsZSByZWdpc3RyeVxuICAgICAgICB0aGlzLmJ1bmRsZXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaTE4bi5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuaTE4biA9IG51bGw7XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0SGFuZGxlciA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpO1xuICAgICAgICBzY3JpcHRIYW5kbGVyPy5jbGVhckNhY2hlKCk7XG5cbiAgICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zY2VuZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG5cbiAgICAgICAgLy8gc2NyaXB0IHJlZ2lzdHJ5XG4gICAgICAgIHRoaXMuc2NyaXB0cy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2NyaXB0cyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zY2VuZXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5saWdodG1hcHBlcj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VudGl0eUluZGV4ID0ge307XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vblByZVJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25Qb3N0UmVuZGVyT3BhcXVlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkRpc2FibGUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uRW5hYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMueHI/LmVuZCgpO1xuICAgICAgICB0aGlzLnhyPy5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5yZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLnRpY2sgPSBudWxsO1xuXG4gICAgICAgIHRoaXMub2ZmKCk7IC8vIHJlbW92ZSBhbGwgZXZlbnRzXG5cbiAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IG51bGw7XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgQXBwQmFzZS5jYW5jZWxUaWNrKHRoaXMpO1xuICAgIH1cblxuICAgIHN0YXRpYyBjYW5jZWxUaWNrKGFwcCkge1xuICAgICAgICBpZiAoYXBwLmZyYW1lUmVxdWVzdElkKSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoYXBwLmZyYW1lUmVxdWVzdElkKTtcbiAgICAgICAgICAgIGFwcC5mcmFtZVJlcXVlc3RJZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBlbnRpdHkgZnJvbSB0aGUgaW5kZXggYnkgZ3VpZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkIC0gVGhlIEdVSUQgdG8gc2VhcmNoIGZvci5cbiAgICAgKiBAcmV0dXJucyB7RW50aXR5fSBUaGUgRW50aXR5IHdpdGggdGhlIEdVSUQgb3IgbnVsbC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0RW50aXR5RnJvbUluZGV4KGd1aWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudGl0eUluZGV4W2d1aWRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5vbigncG9zdHJlbmRlcicsIHNjZW5lLmltbWVkaWF0ZS5vblBvc3RSZW5kZXIsIHNjZW5lLmltbWVkaWF0ZSk7XG4gICAgfVxufVxuXG4vLyBzdGF0aWMgZGF0YVxuY29uc3QgX2ZyYW1lRW5kRGF0YSA9IHt9O1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2Ujc3RhcnR9IGFuZCBpdHNlbGYgdG8gcmVxdWVzdFxuICogdGhlIHJlbmRlcmluZyBvZiBhIG5ldyBhbmltYXRpb24gZnJhbWUuXG4gKlxuICogQGNhbGxiYWNrIE1ha2VUaWNrQ2FsbGJhY2tcbiAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICogQHBhcmFtIHsqfSBbZnJhbWVdIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAqIEBpZ25vcmVcbiAqL1xuXG4vKipcbiAqIENyZWF0ZSB0aWNrIGZ1bmN0aW9uIHRvIGJlIHdyYXBwZWQgaW4gY2xvc3VyZS5cbiAqXG4gKiBAcGFyYW0ge0FwcEJhc2V9IF9hcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gKiBAcmV0dXJucyB7TWFrZVRpY2tDYWxsYmFja30gVGhlIHRpY2sgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBtYWtlVGljayA9IGZ1bmN0aW9uIChfYXBwKSB7XG4gICAgY29uc3QgYXBwbGljYXRpb24gPSBfYXBwO1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gW2ZyYW1lXSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0aW1lc3RhbXAsIGZyYW1lKSB7XG4gICAgICAgIGlmICghYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgYXBwbGljYXRpb24uZnJhbWVSZXF1ZXN0SWQgPSBudWxsO1xuICAgICAgICBhcHBsaWNhdGlvbi5faW5GcmFtZVVwZGF0ZSA9IHRydWU7XG5cbiAgICAgICAgc2V0QXBwbGljYXRpb24oYXBwbGljYXRpb24pO1xuXG4gICAgICAgIC8vIGhhdmUgY3VycmVudCBhcHBsaWNhdGlvbiBwb2ludGVyIGluIHBjXG4gICAgICAgIGFwcCA9IGFwcGxpY2F0aW9uO1xuXG4gICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gYXBwbGljYXRpb24uX3Byb2Nlc3NUaW1lc3RhbXAodGltZXN0YW1wKSB8fCBub3coKTtcbiAgICAgICAgY29uc3QgbXMgPSBjdXJyZW50VGltZSAtIChhcHBsaWNhdGlvbi5fdGltZSB8fCBjdXJyZW50VGltZSk7XG4gICAgICAgIGxldCBkdCA9IG1zIC8gMTAwMC4wO1xuICAgICAgICBkdCA9IG1hdGguY2xhbXAoZHQsIDAsIGFwcGxpY2F0aW9uLm1heERlbHRhVGltZSk7XG4gICAgICAgIGR0ICo9IGFwcGxpY2F0aW9uLnRpbWVTY2FsZTtcblxuICAgICAgICBhcHBsaWNhdGlvbi5fdGltZSA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIC8vIFN1Ym1pdCBhIHJlcXVlc3QgdG8gcXVldWUgdXAgYSBuZXcgYW5pbWF0aW9uIGZyYW1lIGltbWVkaWF0ZWx5XG4gICAgICAgIGlmIChhcHBsaWNhdGlvbi54cj8uc2Vzc2lvbikge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZnJhbWVSZXF1ZXN0SWQgPSBhcHBsaWNhdGlvbi54ci5zZXNzaW9uLnJlcXVlc3RBbmltYXRpb25GcmFtZShhcHBsaWNhdGlvbi50aWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZyYW1lUmVxdWVzdElkID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZXVwZGF0ZVwiLCBtcyk7XG5cbiAgICAgICAgbGV0IHNob3VsZFJlbmRlckZyYW1lID0gdHJ1ZTtcblxuICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgIHNob3VsZFJlbmRlckZyYW1lID0gYXBwbGljYXRpb24ueHI/LnVwZGF0ZShmcmFtZSk7XG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5ncmFwaGljc0RldmljZS5kZWZhdWx0RnJhbWVidWZmZXIgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hvdWxkUmVuZGVyRnJhbWUpIHtcblxuICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIGAtLS0tIEZyYW1lICR7YXBwbGljYXRpb24uZnJhbWV9YCk7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FLCBgLS0gVXBkYXRlU3RhcnQgJHtub3coKS50b0ZpeGVkKDIpfW1zYCk7XG5cbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLnVwZGF0ZShkdCk7XG5cbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZXJlbmRlclwiKTtcblxuXG4gICAgICAgICAgICBpZiAoYXBwbGljYXRpb24uYXV0b1JlbmRlciB8fCBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUpIHtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBSZW5kZXJTdGFydCAke25vdygpLnRvRml4ZWQoMil9bXNgKTtcblxuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLnVwZGF0ZUNhbnZhc1NpemUoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5mcmFtZVN0YXJ0KCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24uZnJhbWVFbmQoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBSZW5kZXJFbmQgJHtub3coKS50b0ZpeGVkKDIpfW1zYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudCBkYXRhXG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50YXJnZXQgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lZW5kXCIsIF9mcmFtZUVuZERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uX2Rlc3Ryb3lSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5leHBvcnQgeyBhcHAsIEFwcEJhc2UgfTtcbiJdLCJuYW1lcyI6WyJQcm9ncmVzcyIsImNvbnN0cnVjdG9yIiwibGVuZ3RoIiwiY291bnQiLCJpbmMiLCJkb25lIiwiYXBwIiwiQXBwQmFzZSIsIkV2ZW50SGFuZGxlciIsImNhbnZhcyIsImZyYW1lUmVxdWVzdElkIiwidmVyc2lvbiIsImluZGV4T2YiLCJEZWJ1ZyIsImxvZyIsInJldmlzaW9uIiwiX2FwcGxpY2F0aW9ucyIsImlkIiwic2V0QXBwbGljYXRpb24iLCJfZGVzdHJveVJlcXVlc3RlZCIsIl9pbkZyYW1lVXBkYXRlIiwiX3RpbWUiLCJ0aW1lU2NhbGUiLCJtYXhEZWx0YVRpbWUiLCJmcmFtZSIsImF1dG9SZW5kZXIiLCJyZW5kZXJOZXh0RnJhbWUiLCJ1c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nIiwic2NyaXB0IiwibGVnYWN5IiwiX2xpYnJhcmllc0xvYWRlZCIsIl9maWxsTW9kZSIsIkZJTExNT0RFX0tFRVBfQVNQRUNUIiwiX3Jlc29sdXRpb25Nb2RlIiwiUkVTT0xVVElPTl9GSVhFRCIsIl9hbGxvd1Jlc2l6ZSIsImNvbnRleHQiLCJpbml0IiwiYXBwT3B0aW9ucyIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiYXNzZXJ0IiwiX2luaXREZWZhdWx0TWF0ZXJpYWwiLCJfaW5pdFByb2dyYW1MaWJyYXJ5Iiwic3RhdHMiLCJBcHBsaWNhdGlvblN0YXRzIiwiX3NvdW5kTWFuYWdlciIsInNvdW5kTWFuYWdlciIsImxvYWRlciIsIlJlc291cmNlTG9hZGVyIiwiX2VudGl0eUluZGV4Iiwic2NlbmUiLCJTY2VuZSIsIl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlIiwicm9vdCIsIkVudGl0eSIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJhc3NldHMiLCJBc3NldFJlZ2lzdHJ5IiwiYXNzZXRQcmVmaXgiLCJwcmVmaXgiLCJidW5kbGVzIiwiQnVuZGxlUmVnaXN0cnkiLCJlbmFibGVCdW5kbGVzIiwiVGV4dERlY29kZXIiLCJzY3JpcHRzT3JkZXIiLCJzY3JpcHRzIiwiU2NyaXB0UmVnaXN0cnkiLCJpMThuIiwiSTE4biIsInNjZW5lcyIsIlNjZW5lUmVnaXN0cnkiLCJkZWZhdWx0TGF5ZXJXb3JsZCIsIkxheWVyIiwibmFtZSIsIkxBWUVSSURfV09STEQiLCJkZWZhdWx0TGF5ZXJEZXB0aCIsIkxBWUVSSURfREVQVEgiLCJlbmFibGVkIiwib3BhcXVlU29ydE1vZGUiLCJTT1JUTU9ERV9OT05FIiwiZGVmYXVsdExheWVyU2t5Ym94IiwiTEFZRVJJRF9TS1lCT1giLCJkZWZhdWx0TGF5ZXJVaSIsIkxBWUVSSURfVUkiLCJ0cmFuc3BhcmVudFNvcnRNb2RlIiwiU09SVE1PREVfTUFOVUFMIiwiZGVmYXVsdExheWVySW1tZWRpYXRlIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiIsIkxheWVyQ29tcG9zaXRpb24iLCJwdXNoT3BhcXVlIiwicHVzaFRyYW5zcGFyZW50IiwibGF5ZXJzIiwiQXJlYUxpZ2h0THV0cyIsImNyZWF0ZVBsYWNlaG9sZGVyIiwicmVuZGVyZXIiLCJGb3J3YXJkUmVuZGVyZXIiLCJmcmFtZUdyYXBoIiwiRnJhbWVHcmFwaCIsImxpZ2h0bWFwcGVyIiwib25jZSIsIl9maXJzdEJha2UiLCJfYmF0Y2hlciIsImJhdGNoTWFuYWdlciIsIl9maXJzdEJhdGNoIiwia2V5Ym9hcmQiLCJtb3VzZSIsInRvdWNoIiwiZ2FtZXBhZHMiLCJlbGVtZW50SW5wdXQiLCJ4ciIsImF0dGFjaFNlbGVjdEV2ZW50cyIsIl9pblRvb2xzIiwiX3NreWJveEFzc2V0IiwiX3NjcmlwdFByZWZpeCIsInNjcmlwdFByZWZpeCIsImFkZEhhbmRsZXIiLCJCdW5kbGVIYW5kbGVyIiwicmVzb3VyY2VIYW5kbGVycyIsImZvckVhY2giLCJyZXNvdXJjZUhhbmRsZXIiLCJoYW5kbGVyIiwiaGFuZGxlclR5cGUiLCJzeXN0ZW1zIiwiQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkiLCJjb21wb25lbnRTeXN0ZW1zIiwiY29tcG9uZW50U3lzdGVtIiwiYWRkIiwiX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwiYmluZCIsImRvY3VtZW50IiwiaGlkZGVuIiwidW5kZWZpbmVkIiwiX2hpZGRlbkF0dHIiLCJhZGRFdmVudExpc3RlbmVyIiwibW96SGlkZGVuIiwibXNIaWRkZW4iLCJ3ZWJraXRIaWRkZW4iLCJ0aWNrIiwibWFrZVRpY2siLCJnZXRBcHBsaWNhdGlvbiIsIm1hdGVyaWFsIiwiU3RhbmRhcmRNYXRlcmlhbCIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX0JMSU5OIiwic2V0RGVmYXVsdE1hdGVyaWFsIiwibGlicmFyeSIsIlByb2dyYW1MaWJyYXJ5Iiwic2V0UHJvZ3JhbUxpYnJhcnkiLCJiYXRjaGVyIiwiZmlsbE1vZGUiLCJyZXNvbHV0aW9uTW9kZSIsImNvbmZpZ3VyZSIsInVybCIsImNhbGxiYWNrIiwiaHR0cCIsImdldCIsImVyciIsInJlc3BvbnNlIiwicHJvcHMiLCJhcHBsaWNhdGlvbl9wcm9wZXJ0aWVzIiwiX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzIiwiX3BhcnNlU2NlbmVzIiwiX3BhcnNlQXNzZXRzIiwicHJlbG9hZCIsImZpcmUiLCJsaXN0IiwicHJvZ3Jlc3MiLCJfZG9uZSIsInRvdGFsIiwib25Bc3NldExvYWQiLCJhc3NldCIsIm9uQXNzZXRFcnJvciIsImkiLCJsb2FkZWQiLCJsb2FkIiwiX3ByZWxvYWRTY3JpcHRzIiwic2NlbmVEYXRhIiwicHJlbG9hZGluZyIsIl9nZXRTY3JpcHRSZWZlcmVuY2VzIiwibCIsInJlZ2V4Iiwib25Mb2FkIiwiU2NyaXB0VHlwZSIsImNvbnNvbGUiLCJlcnJvciIsInNjcmlwdFVybCIsInRlc3QiLCJ0b0xvd2VyQ2FzZSIsInBhdGgiLCJqb2luIiwibWF4QXNzZXRSZXRyaWVzIiwiZW5hYmxlUmV0cnkiLCJ1c2VEZXZpY2VQaXhlbFJhdGlvIiwidXNlX2RldmljZV9waXhlbF9yYXRpbyIsInJlc29sdXRpb25fbW9kZSIsImZpbGxfbW9kZSIsIl93aWR0aCIsIndpZHRoIiwiX2hlaWdodCIsImhlaWdodCIsIm1heFBpeGVsUmF0aW8iLCJ3aW5kb3ciLCJkZXZpY2VQaXhlbFJhdGlvIiwic2V0Q2FudmFzUmVzb2x1dGlvbiIsInNldENhbnZhc0ZpbGxNb2RlIiwibGF5ZXJPcmRlciIsImNvbXBvc2l0aW9uIiwia2V5IiwiZGF0YSIsInBhcnNlSW50IiwibGVuIiwic3VibGF5ZXIiLCJsYXllciIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJFbmFibGVkIiwiYmF0Y2hHcm91cHMiLCJncnAiLCJhZGRHcm91cCIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImkxOG5Bc3NldHMiLCJfbG9hZExpYnJhcmllcyIsImxpYnJhcmllcyIsInVybHMiLCJvbkxpYnJhcmllc0xvYWRlZCIsInNjcmlwdHNJbmRleCIsImJ1bmRsZXNJbmRleCIsInB1c2giLCJ0eXBlIiwiQXNzZXQiLCJmaWxlIiwibG9hZGluZ1R5cGUiLCJ0YWdzIiwibG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsInByaW9yaXR5U2NyaXB0cyIsInNldHRpbmdzIiwicHJpb3JpdHlfc2NyaXB0cyIsIl9zY3JpcHRzIiwiX2luZGV4IiwiZW50aXRpZXMiLCJjb21wb25lbnRzIiwic3RhcnQiLCJjYWxsIiwiX2FscmVhZHlTdGFydGVkIiwidGltZXN0YW1wIiwibm93IiwidGFyZ2V0IiwiaW5wdXRVcGRhdGUiLCJkdCIsImNvbnRyb2xsZXIiLCJ1cGRhdGUiLCJ1cGRhdGVDbGllbnRSZWN0IiwidXBkYXRlU3RhcnQiLCJ1cGRhdGVUaW1lIiwiZnJhbWVTdGFydCIsImZyYW1lRW5kIiwicmVuZGVyIiwicmVuZGVyU3RhcnQiLCJzeW5jSGllcmFyY2h5IiwidXBkYXRlQWxsIiwiX3NraXBSZW5kZXJDb3VudGVyIiwicmVuZGVyQ29tcG9zaXRpb24iLCJyZW5kZXJUaW1lIiwibGF5ZXJDb21wb3NpdGlvbiIsIkRlYnVnR3JhcGhpY3MiLCJjbGVhckdwdU1hcmtlcnMiLCJidWlsZEZyYW1lR3JhcGgiLCJfZmlsbEZyYW1lU3RhdHNCYXNpYyIsIm1zIiwiX3RpbWVUb0NvdW50RnJhbWVzIiwiZnBzIiwiX2Zwc0FjY3VtIiwiZHJhd0NhbGxzIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX2ZpbGxGcmFtZVN0YXRzIiwiY2FtZXJhcyIsIl9jYW1lcmFzUmVuZGVyZWQiLCJtYXRlcmlhbHMiLCJfbWF0ZXJpYWxTd2l0Y2hlcyIsInNoYWRlcnMiLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsInNoYWRvd01hcFVwZGF0ZXMiLCJfc2hhZG93TWFwVXBkYXRlcyIsInNoYWRvd01hcFRpbWUiLCJfc2hhZG93TWFwVGltZSIsImRlcHRoTWFwVGltZSIsIl9kZXB0aE1hcFRpbWUiLCJmb3J3YXJkVGltZSIsIl9mb3J3YXJkVGltZSIsInByaW1zIiwiX3ByaW1zUGVyRnJhbWUiLCJ0cmlhbmdsZXMiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiTWF0aCIsIm1heCIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJjdWxsVGltZSIsIl9jdWxsVGltZSIsInNvcnRUaW1lIiwiX3NvcnRUaW1lIiwic2tpblRpbWUiLCJfc2tpblRpbWUiLCJtb3JwaFRpbWUiLCJfbW9ycGhUaW1lIiwibGlnaHRDbHVzdGVycyIsIl9saWdodENsdXN0ZXJzIiwibGlnaHRDbHVzdGVyc1RpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJvdGhlclByaW1pdGl2ZXMiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJmb3J3YXJkIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJjdWxsZWQiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiZGVwdGgiLCJzaGFkb3ciLCJfc2hhZG93RHJhd0NhbGxzIiwic2tpbm5lZCIsIl9za2luRHJhd0NhbGxzIiwiaW1tZWRpYXRlIiwiaW5zdGFuY2VkIiwicmVtb3ZlZEJ5SW5zdGFuY2luZyIsIm1pc2MiLCJfZGVwdGhEcmF3Q2FsbHMiLCJfaW1tZWRpYXRlUmVuZGVyZWQiLCJfaW5zdGFuY2VkRHJhd0NhbGxzIiwicmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwicGFydGljbGVzIiwidXBkYXRlc1BlckZyYW1lIiwiX3VwZGF0ZXNQZXJGcmFtZSIsImZyYW1lVGltZSIsIl9mcmFtZVRpbWUiLCJtb2RlIiwicmVzaXplQ2FudmFzIiwiUkVTT0xVVElPTl9BVVRPIiwiY2xpZW50V2lkdGgiLCJjbGllbnRIZWlnaHQiLCJpc0hpZGRlbiIsInN1c3BlbmQiLCJyZXN1bWUiLCJzZXNzaW9uIiwid2luZG93V2lkdGgiLCJpbm5lcldpZHRoIiwid2luZG93SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJyIiwid2luUiIsIkZJTExNT0RFX0ZJTExfV0lORE9XIiwic3R5bGUiLCJ1cGRhdGVDYW52YXNTaXplIiwiX3RoaXMkeHIiLCJhY3RpdmUiLCJyaWdpZGJvZHkiLCJvbkxpYnJhcnlMb2FkZWQiLCJhcHBseVNjZW5lU2V0dGluZ3MiLCJBbW1vIiwiZ3Jhdml0eSIsInBoeXNpY3MiLCJzZXQiLCJhcHBseVNldHRpbmdzIiwiaGFzT3duUHJvcGVydHkiLCJza3lib3giLCJzZXRTa3lib3giLCJzZXRBcmVhTGlnaHRMdXRzIiwibHRjTWF0MSIsImx0Y01hdDIiLCJ3YXJuIiwib25Ta3lib3hSZW1vdmVkIiwib25Ta3lib3hDaGFuZ2VkIiwicmVzb3VyY2VzIiwib2ZmIiwib24iLCJza3lib3hNaXAiLCJsb2FkRmFjZXMiLCJfdGhpcyRsaWdodG1hcHBlciIsImJha2UiLCJsaWdodG1hcE1vZGUiLCJfdGhpcyRiYXRjaGVyIiwiZ2VuZXJhdGUiLCJfcHJvY2Vzc1RpbWVzdGFtcCIsImRyYXdMaW5lIiwiZW5kIiwiY29sb3IiLCJkZXB0aFRlc3QiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiZHJhd0xpbmVBcnJheXMiLCJkcmF3V2lyZVNwaGVyZSIsImNlbnRlciIsInJhZGl1cyIsIkNvbG9yIiwiV0hJVEUiLCJzZWdtZW50cyIsImRyYXdXaXJlQWxpZ25lZEJveCIsIm1pblBvaW50IiwibWF4UG9pbnQiLCJtYXQiLCJkcmF3TWVzaEluc3RhbmNlIiwibWVzaEluc3RhbmNlIiwiZHJhd01lc2giLCJtZXNoIiwibWF0cml4IiwiZHJhd1F1YWQiLCJnZXRRdWFkTWVzaCIsImRyYXdUZXh0dXJlIiwieCIsInkiLCJ0ZXh0dXJlIiwiZmlsdGVyYWJsZSIsImlzV2ViR1BVIiwiTWF0NCIsInNldFRSUyIsIlZlYzMiLCJRdWF0IiwiSURFTlRJVFkiLCJNYXRlcmlhbCIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImdldFVuZmlsdGVyYWJsZVRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsIl90aGlzJGxpZ2h0bWFwcGVyMiIsIl90aGlzJHhyMiIsIl90aGlzJHhyMyIsIl90aGlzJF9zb3VuZE1hbmFnZXIiLCJjYW52YXNJZCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJkZXRhY2giLCJ1bmxvYWQiLCJzY3JpcHRIYW5kbGVyIiwiZ2V0SGFuZGxlciIsImNsZWFyQ2FjaGUiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uRGlzYWJsZSIsIm9uRW5hYmxlIiwiY2FuY2VsVGljayIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwiZ2V0RW50aXR5RnJvbUluZGV4IiwiZ3VpZCIsIm9uUG9zdFJlbmRlciIsIl9mcmFtZUVuZERhdGEiLCJfYXBwIiwiYXBwbGljYXRpb24iLCJfYXBwbGljYXRpb24keHIiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJfYXBwbGljYXRpb24keHIyIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwicmVuZGVyU3RhdGUiLCJiYXNlTGF5ZXIiLCJmcmFtZWJ1ZmZlciIsInRyYWNlIiwiVFJBQ0VJRF9SRU5ERVJfRlJBTUUiLCJUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FIiwidG9GaXhlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNERBO0FBQ0EsTUFBTUEsUUFBUSxDQUFDO0VBQ1hDLFdBQVdBLENBQUNDLE1BQU0sRUFBRTtJQUNoQixJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQTtBQUNsQixHQUFBO0FBRUFDLEVB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
