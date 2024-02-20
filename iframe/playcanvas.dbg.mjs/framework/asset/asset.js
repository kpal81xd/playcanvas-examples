import { path } from '../../core/path.js';
import { Tags } from '../../core/tags.js';
import { EventHandler } from '../../core/event-handler.js';
import { findAvailableLocale } from '../i18n/utils.js';
import { ABSOLUTE_URL } from './constants.js';
import { AssetFile } from './asset-file.js';
import { getApplication } from '../globals.js';
import { http } from '../../platform/net/http.js';

// auto incrementing number for asset ids
let assetIdCounter = -1;
const VARIANT_SUPPORT = {
  pvr: 'extCompressedTexturePVRTC',
  dxt: 'extCompressedTextureS3TC',
  etc2: 'extCompressedTextureETC',
  etc1: 'extCompressedTextureETC1',
  basis: 'canvas' // dummy, basis is always supported
};

const VARIANT_DEFAULT_PRIORITY = ['pvr', 'dxt', 'etc2', 'etc1', 'basis'];

/**
 * Callback used by {@link Asset#ready} and called when an asset is ready.
 *
 * @callback AssetReadyCallback
 * @param {Asset} asset - The ready asset.
 */

/**
 * An asset record of a file or data resource that can be loaded by the engine. The asset contains
 * four important fields:
 *
 * - `file`: contains the details of a file (filename, url) which contains the resource data, e.g.
 * an image file for a texture asset.
 * - `data`: contains a JSON blob which contains either the resource data for the asset (e.g.
 * material data) or additional data for the file (e.g. material mappings for a model).
 * - `options`: contains a JSON blob with handler-specific load options.
 * - `resource`: contains the final resource when it is loaded. (e.g. a {@link StandardMaterial} or
 * a {@link Texture}).
 *
 * See the {@link AssetRegistry} for details on loading resources from assets.
 *
 * @augments EventHandler
 * @category Asset
 */
class Asset extends EventHandler {
  /**
   * Create a new Asset record. Generally, Assets are created in the loading process and you
   * won't need to create them by hand.
   *
   * @param {string} name - A non-unique but human-readable name which can be later used to
   * retrieve the asset.
   * @param {string} type - Type of asset. One of ["animation", "audio", "binary", "container",
   * "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "sprite",
   * "template", text", "texture", "textureatlas"]
   * @param {object} [file] - Details about the file the asset is made from. At the least must
   * contain the 'url' field. For assets that don't contain file data use null.
   * @param {string} [file.url] - The URL of the resource file that contains the asset data.
   * @param {string} [file.filename] - The filename of the resource file or null if no filename
   * was set (e.g from using {@link AssetRegistry#loadFromUrl}).
   * @param {number} [file.size] - The size of the resource file or null if no size was set
   * (e.g. from using {@link AssetRegistry#loadFromUrl}).
   * @param {string} [file.hash] - The MD5 hash of the resource file data and the Asset data
   * field or null if hash was set (e.g from using {@link AssetRegistry#loadFromUrl}).
   * @param {ArrayBuffer} [file.contents] - Optional file contents. This is faster than wrapping
   * the data in a (base64 encoded) blob. Currently only used by container assets.
   * @param {object|string} [data] - JSON object or string with additional data about the asset.
   * (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of
   * materials).
   * @param {object} [options] - The asset handler options. For container options see
   * {@link ContainerHandler}.
   * @param {'anonymous'|'use-credentials'|null} [options.crossOrigin] - For use with texture assets
   * that are loaded using the browser. This setting overrides the default crossOrigin specifier.
   * For more details on crossOrigin and its use, see
   * https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin.
   * @example
   * const asset = new pc.Asset("a texture", "texture", {
   *     url: "http://example.com/my/assets/here/texture.png"
   * });
   */
  constructor(name, type, file, data, options) {
    super();
    this._id = assetIdCounter--;
    this._name = name || '';

    /**
     * The type of the asset. One of ["animation", "audio", "binary", "container", "cubemap",
     * "css", "font", "json", "html", "material", "model", "render", "script", "shader", "sprite",
     * "template", "text", "texture", "textureatlas"]
     *
     * @type {("animation"|"audio"|"binary"|"container"|"cubemap"|"css"|"font"|"json"|"html"|"material"|"model"|"render"|"script"|"shader"|"sprite"|"template"|"text"|"texture"|"textureatlas")}
     */
    this.type = type;

    /**
     * Asset tags. Enables finding of assets by tags using the {@link AssetRegistry#findByTag} method.
     *
     * @type {Tags}
     */
    this.tags = new Tags(this);
    this._preload = false;
    this._file = null;
    this._data = data || {};

    /**
     * Optional JSON data that contains the asset handler options.
     *
     * @type {object}
     */
    this.options = options || {};

    // This is where the loaded resource(s) will be
    this._resources = [];

    // a string-assetId dictionary that maps
    // locale to asset id
    this._i18n = {};

    /**
     * True if the asset has finished attempting to load the resource. It is not guaranteed
     * that the resources are available as there could have been a network error.
     *
     * @type {boolean}
     */
    this.loaded = false;

    /**
     * True if the resource is currently being loaded.
     *
     * @type {boolean}
     */
    this.loading = false;

    /**
     * The asset registry that this Asset belongs to.
     *
     * @type {import('./asset-registry.js').AssetRegistry|null}
     */
    this.registry = null;
    if (file) this.file = file;
  }

  /**
   * The asset id.
   *
   * @type {number}
   */
  set id(value) {
    this._id = value;
  }
  get id() {
    return this._id;
  }

  /**
   * The asset name.
   *
   * @type {string}
   */
  set name(value) {
    if (this._name === value) return;
    const old = this._name;
    this._name = value;
    this.fire('name', this, this._name, old);
  }
  get name() {
    return this._name;
  }

  /**
   * The file details or null if no file.
   *
   * @type {object}
   */
  set file(value) {
    // if value contains variants, choose the correct variant first
    if (value && value.variants && ['texture', 'textureatlas', 'bundle'].indexOf(this.type) !== -1) {
      var _this$registry;
      // search for active variant
      const app = ((_this$registry = this.registry) == null || (_this$registry = _this$registry._loader) == null ? void 0 : _this$registry._app) || getApplication();
      const device = app == null ? void 0 : app.graphicsDevice;
      if (device) {
        for (let i = 0, len = VARIANT_DEFAULT_PRIORITY.length; i < len; i++) {
          const variant = VARIANT_DEFAULT_PRIORITY[i];
          // if the device supports the variant
          if (value.variants[variant] && device[VARIANT_SUPPORT[variant]]) {
            value = value.variants[variant];
            break;
          }

          // if the variant does not exist but the asset is in a bundle
          // and the bundle contain assets with this variant then return the default
          // file for the asset
          if (app.enableBundles) {
            const bundles = app.bundles.listBundlesForAsset(this);
            if (bundles && bundles.find(b => {
              var _b$file;
              return b == null || (_b$file = b.file) == null ? void 0 : _b$file.variants[variant];
            })) {
              break;
            }
          }
        }
      }
    }
    const oldFile = this._file;
    const newFile = value ? new AssetFile(value.url, value.filename, value.hash, value.size, value.opt, value.contents) : null;
    if (!!newFile !== !!oldFile || newFile && !newFile.equals(oldFile)) {
      this._file = newFile;
      this.fire('change', this, 'file', newFile, oldFile);
      this.reload();
    }
  }
  get file() {
    return this._file;
  }

  /**
   * Optional JSON data that contains either the complete resource data. (e.g. in the case of a
   * material) or additional data (e.g. in the case of a model it contains mappings from mesh to
   * material).
   *
   * @type {object}
   */
  set data(value) {
    // fire change event when data changes
    // because the asset might need reloading if that happens
    const old = this._data;
    this._data = value;
    if (value !== old) {
      this.fire('change', this, 'data', value, old);
      if (this.loaded) this.registry._loader.patch(this, this.registry);
    }
  }
  get data() {
    return this._data;
  }

  /**
   * A reference to the resource when the asset is loaded. e.g. a {@link Texture} or a {@link Model}.
   *
   * @type {object}
   */
  set resource(value) {
    const _old = this._resources[0];
    this._resources[0] = value;
    this.fire('change', this, 'resource', value, _old);
  }
  get resource() {
    return this._resources[0];
  }

  /**
   * A reference to the resources of the asset when it's loaded. An asset can hold more runtime
   * resources than one e.g. cubemaps.
   *
   * @type {object[]}
   */
  set resources(value) {
    const _old = this._resources;
    this._resources = value;
    this.fire('change', this, 'resources', value, _old);
  }
  get resources() {
    return this._resources;
  }

  /**
   * If true the asset will be loaded during the preload phase of application set up.
   *
   * @type {boolean}
   */
  set preload(value) {
    value = !!value;
    if (this._preload === value) return;
    this._preload = value;
    if (this._preload && !this.loaded && !this.loading && this.registry) this.registry.load(this);
  }
  get preload() {
    return this._preload;
  }
  set loadFaces(value) {
    value = !!value;
    if (!this.hasOwnProperty('_loadFaces') || value !== this._loadFaces) {
      this._loadFaces = value;

      // the loadFaces property should be part of the asset data block
      // because changing the flag should result in asset patch being invoked.
      // here we must invoke it manually instead.
      if (this.loaded) this.registry._loader.patch(this, this.registry);
    }
  }
  get loadFaces() {
    return this._loadFaces;
  }

  /**
   * Return the URL required to fetch the file for this asset.
   *
   * @returns {string|null} The URL. Returns null if the asset has no associated file.
   * @example
   * const assets = app.assets.find("My Image", "texture");
   * const img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
   */
  getFileUrl() {
    const file = this.file;
    if (!file || !file.url) return null;
    let url = file.url;
    if (this.registry && this.registry.prefix && !ABSOLUTE_URL.test(url)) url = this.registry.prefix + url;

    // add file hash to avoid hard-caching problems
    if (this.type !== 'script' && file.hash) {
      const separator = url.indexOf('?') !== -1 ? '&' : '?';
      url += separator + 't=' + file.hash;
    }
    return url;
  }

  /**
   * Construct an asset URL from this asset's location and a relative path. If the relativePath
   * is a blob or Base64 URI, then return that instead.
   *
   * @param {string} relativePath - The relative path to be concatenated to this asset's base url.
   * @returns {string} Resulting URL of the asset.
   * @ignore
   */
  getAbsoluteUrl(relativePath) {
    if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
      return relativePath;
    }
    const base = path.getDirectory(this.file.url);
    return path.join(base, relativePath);
  }

  /**
   * Returns the asset id of the asset that corresponds to the specified locale.
   *
   * @param {string} locale - The desired locale e.g. Ar-AR.
   * @returns {number} An asset id or null if there is no asset specified for the desired locale.
   * @ignore
   */
  getLocalizedAssetId(locale) {
    // tries to find either the desired locale or a fallback locale
    locale = findAvailableLocale(locale, this._i18n);
    return this._i18n[locale] || null;
  }

  /**
   * Adds a replacement asset id for the specified locale. When the locale in
   * {@link Application#i18n} changes then references to this asset will be replaced with the
   * specified asset id. (Currently only supported by the {@link ElementComponent}).
   *
   * @param {string} locale - The locale e.g. Ar-AR.
   * @param {number} assetId - The asset id.
   * @ignore
   */
  addLocalizedAssetId(locale, assetId) {
    this._i18n[locale] = assetId;
    this.fire('add:localized', locale, assetId);
  }

  /**
   * Removes a localized asset.
   *
   * @param {string} locale - The locale e.g. Ar-AR.
   * @ignore
   */
  removeLocalizedAssetId(locale) {
    const assetId = this._i18n[locale];
    if (assetId) {
      delete this._i18n[locale];
      this.fire('remove:localized', locale, assetId);
    }
  }

  /**
   * Take a callback which is called as soon as the asset is loaded. If the asset is already
   * loaded the callback is called straight away.
   *
   * @param {AssetReadyCallback} callback - The function called when the asset is ready. Passed
   * the (asset) arguments.
   * @param {object} [scope] - Scope object to use when calling the callback.
   * @example
   * const asset = app.assets.find("My Asset");
   * asset.ready(function (asset) {
   *   // asset loaded
   * });
   * app.assets.load(asset);
   */
  ready(callback, scope) {
    scope = scope || this;
    if (this.loaded) {
      callback.call(scope, this);
    } else {
      this.once('load', function (asset) {
        callback.call(scope, asset);
      });
    }
  }
  reload() {
    // no need to be reloaded
    if (this.loaded) {
      this.loaded = false;
      this.registry.load(this);
    }
  }

  /**
   * Destroys the associated resource and marks asset as unloaded.
   *
   * @example
   * const asset = app.assets.find("My Asset");
   * asset.unload();
   * // asset.resource is null
   */
  unload() {
    if (!this.loaded && this._resources.length === 0) return;
    this.fire('unload', this);
    this.registry.fire('unload:' + this.id, this);
    const old = this._resources;

    // clear resources on the asset
    this.resources = [];
    this.loaded = false;

    // remove resource from loader cache
    if (this.file) {
      this.registry._loader.clearCache(this.getFileUrl(), this.type);
    }

    // destroy resources
    for (let i = 0; i < old.length; ++i) {
      const resource = old[i];
      if (resource && resource.destroy) {
        resource.destroy();
      }
    }
  }

  /**
   * Helper function to resolve asset file data and return the contents as an ArrayBuffer. If the
   * asset file contents are present, that is returned. Otherwise the file data is be downloaded
   * via http.
   *
   * @param {string} loadUrl - The URL as passed into the handler
   * @param {import('../handlers/loader.js').ResourceLoaderCallback} callback - The callback
   * function to receive results.
   * @param {Asset} [asset] - The asset
   * @param {number} maxRetries - Number of retries if http download is required
   * @ignore
   */
  static fetchArrayBuffer(loadUrl, callback, asset, maxRetries = 0) {
    var _asset$file;
    if (asset != null && (_asset$file = asset.file) != null && _asset$file.contents) {
      // asset file contents were provided
      setTimeout(() => {
        callback(null, asset.file.contents);
      });
    } else {
      // asset contents must be downloaded
      http.get(loadUrl, {
        cache: true,
        responseType: 'arraybuffer',
        retry: maxRetries > 0,
        maxRetries: maxRetries
      }, callback);
    }
  }
}
/**
 * Fired when the asset has completed loading.
 *
 * @event
 * @example
 * asset.on('load', (asset) => {
 *     console.log(`Asset loaded: ${asset.name}`);
 * });
 */
Asset.EVENT_LOAD = 'load';
/**
 * Fired just before the asset unloads the resource. This allows for the opportunity to prepare
 * for an asset that will be unloaded. E.g. Changing the texture of a model to a default before
 * the one it was using is unloaded.
 *
 * @event
 * @example
 * asset.on('unload', (asset) => {
 *    console.log(`Asset about to unload: ${asset.name}`);
 * });
 */
Asset.EVENT_UNLOAD = 'unload';
/**
 * Fired when the asset is removed from the asset registry.
 *
 * @event
 * @example
 * asset.on('remove', (asset) => {
 *    console.log(`Asset removed: ${asset.name}`);
 * });
 */
Asset.EVENT_REMOVE = 'remove';
/**
 * Fired if the asset encounters an error while loading.
 *
 * @event
 * @example
 * asset.on('error', (err, asset) => {
 *    console.error(`Error loading asset ${asset.name}: ${err}`);
 * });
 */
Asset.EVENT_ERROR = 'error';
/**
 * Fired when one of the asset properties `file`, `data`, `resource` or `resources` is changed.
 *
 * @event
 * @example
 * asset.on('change', (asset, property, newValue, oldValue) => {
 *    console.log(`Asset ${asset.name} has property ${property} changed from ${oldValue} to ${newValue}`);
 * });
 */
Asset.EVENT_CHANGE = 'change';
/**
 * Fired when we add a new localized asset id to the asset.
 *
 * @event
 * @example
 * asset.on('add:localized', (locale, assetId) => {
 *    console.log(`Asset ${asset.name} has added localized asset ${assetId} for locale ${locale}`);
 * });
 */
Asset.EVENT_ADDLOCALIZED = 'add:localized';
/**
 * Fired when we remove a localized asset id from the asset.
 *
 * @event
 * @example
 * asset.on('remove:localized', (locale, assetId) => {
 *   console.log(`Asset ${asset.name} has removed localized asset ${assetId} for locale ${locale}`);
 * });
 */
Asset.EVENT_REMOVELOCALIZED = 'remove:localized';

export { Asset };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBUYWdzIH0gZnJvbSAnLi4vLi4vY29yZS90YWdzLmpzJztcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgZmluZEF2YWlsYWJsZUxvY2FsZSB9IGZyb20gJy4uL2kxOG4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBBc3NldEZpbGUgfSBmcm9tICcuL2Fzc2V0LWZpbGUuanMnO1xuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi9nbG9iYWxzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbi8vIGF1dG8gaW5jcmVtZW50aW5nIG51bWJlciBmb3IgYXNzZXQgaWRzXG5sZXQgYXNzZXRJZENvdW50ZXIgPSAtMTtcblxuY29uc3QgVkFSSUFOVF9TVVBQT1JUID0ge1xuICAgIHB2cjogJ2V4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMnLFxuICAgIGR4dDogJ2V4dENvbXByZXNzZWRUZXh0dXJlUzNUQycsXG4gICAgZXRjMjogJ2V4dENvbXByZXNzZWRUZXh0dXJlRVRDJyxcbiAgICBldGMxOiAnZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxJyxcbiAgICBiYXNpczogJ2NhbnZhcycgLy8gZHVtbXksIGJhc2lzIGlzIGFsd2F5cyBzdXBwb3J0ZWRcbn07XG5cbmNvbnN0IFZBUklBTlRfREVGQVVMVF9QUklPUklUWSA9IFsncHZyJywgJ2R4dCcsICdldGMyJywgJ2V0YzEnLCAnYmFzaXMnXTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldCNyZWFkeX0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIHJlYWR5LlxuICpcbiAqIEBjYWxsYmFjayBBc3NldFJlYWR5Q2FsbGJhY2tcbiAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIHJlYWR5IGFzc2V0LlxuICovXG5cbi8qKlxuICogQW4gYXNzZXQgcmVjb3JkIG9mIGEgZmlsZSBvciBkYXRhIHJlc291cmNlIHRoYXQgY2FuIGJlIGxvYWRlZCBieSB0aGUgZW5naW5lLiBUaGUgYXNzZXQgY29udGFpbnNcbiAqIGZvdXIgaW1wb3J0YW50IGZpZWxkczpcbiAqXG4gKiAtIGBmaWxlYDogY29udGFpbnMgdGhlIGRldGFpbHMgb2YgYSBmaWxlIChmaWxlbmFtZSwgdXJsKSB3aGljaCBjb250YWlucyB0aGUgcmVzb3VyY2UgZGF0YSwgZS5nLlxuICogYW4gaW1hZ2UgZmlsZSBmb3IgYSB0ZXh0dXJlIGFzc2V0LlxuICogLSBgZGF0YWA6IGNvbnRhaW5zIGEgSlNPTiBibG9iIHdoaWNoIGNvbnRhaW5zIGVpdGhlciB0aGUgcmVzb3VyY2UgZGF0YSBmb3IgdGhlIGFzc2V0IChlLmcuXG4gKiBtYXRlcmlhbCBkYXRhKSBvciBhZGRpdGlvbmFsIGRhdGEgZm9yIHRoZSBmaWxlIChlLmcuIG1hdGVyaWFsIG1hcHBpbmdzIGZvciBhIG1vZGVsKS5cbiAqIC0gYG9wdGlvbnNgOiBjb250YWlucyBhIEpTT04gYmxvYiB3aXRoIGhhbmRsZXItc3BlY2lmaWMgbG9hZCBvcHRpb25zLlxuICogLSBgcmVzb3VyY2VgOiBjb250YWlucyB0aGUgZmluYWwgcmVzb3VyY2Ugd2hlbiBpdCBpcyBsb2FkZWQuIChlLmcuIGEge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWx9IG9yXG4gKiBhIHtAbGluayBUZXh0dXJlfSkuXG4gKlxuICogU2VlIHRoZSB7QGxpbmsgQXNzZXRSZWdpc3RyeX0gZm9yIGRldGFpbHMgb24gbG9hZGluZyByZXNvdXJjZXMgZnJvbSBhc3NldHMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmNsYXNzIEFzc2V0IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBoYXMgY29tcGxldGVkIGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFzc2V0Lm9uKCdsb2FkJywgKGFzc2V0KSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBBc3NldCBsb2FkZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfTE9BRCA9ICdsb2FkJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIGp1c3QgYmVmb3JlIHRoZSBhc3NldCB1bmxvYWRzIHRoZSByZXNvdXJjZS4gVGhpcyBhbGxvd3MgZm9yIHRoZSBvcHBvcnR1bml0eSB0byBwcmVwYXJlXG4gICAgICogZm9yIGFuIGFzc2V0IHRoYXQgd2lsbCBiZSB1bmxvYWRlZC4gRS5nLiBDaGFuZ2luZyB0aGUgdGV4dHVyZSBvZiBhIG1vZGVsIHRvIGEgZGVmYXVsdCBiZWZvcmVcbiAgICAgKiB0aGUgb25lIGl0IHdhcyB1c2luZyBpcyB1bmxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXNzZXQub24oJ3VubG9hZCcsIChhc3NldCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUubG9nKGBBc3NldCBhYm91dCB0byB1bmxvYWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVU5MT0FEID0gJ3VubG9hZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBpcyByZW1vdmVkIGZyb20gdGhlIGFzc2V0IHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhc3NldC5vbigncmVtb3ZlJywgKGFzc2V0KSA9PiB7XG4gICAgICogICAgY29uc29sZS5sb2coYEFzc2V0IHJlbW92ZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCBpZiB0aGUgYXNzZXQgZW5jb3VudGVycyBhbiBlcnJvciB3aGlsZSBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhc3NldC5vbignZXJyb3InLCAoZXJyLCBhc3NldCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGxvYWRpbmcgYXNzZXQgJHthc3NldC5uYW1lfTogJHtlcnJ9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VSUk9SID0gJ2Vycm9yJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gb25lIG9mIHRoZSBhc3NldCBwcm9wZXJ0aWVzIGBmaWxlYCwgYGRhdGFgLCBgcmVzb3VyY2VgIG9yIGByZXNvdXJjZXNgIGlzIGNoYW5nZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFzc2V0Lm9uKCdjaGFuZ2UnLCAoYXNzZXQsIHByb3BlcnR5LCBuZXdWYWx1ZSwgb2xkVmFsdWUpID0+IHtcbiAgICAgKiAgICBjb25zb2xlLmxvZyhgQXNzZXQgJHthc3NldC5uYW1lfSBoYXMgcHJvcGVydHkgJHtwcm9wZXJ0eX0gY2hhbmdlZCBmcm9tICR7b2xkVmFsdWV9IHRvICR7bmV3VmFsdWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0NIQU5HRSA9ICdjaGFuZ2UnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB3ZSBhZGQgYSBuZXcgbG9jYWxpemVkIGFzc2V0IGlkIHRvIHRoZSBhc3NldC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXNzZXQub24oJ2FkZDpsb2NhbGl6ZWQnLCAobG9jYWxlLCBhc3NldElkKSA9PiB7XG4gICAgICogICAgY29uc29sZS5sb2coYEFzc2V0ICR7YXNzZXQubmFtZX0gaGFzIGFkZGVkIGxvY2FsaXplZCBhc3NldCAke2Fzc2V0SWR9IGZvciBsb2NhbGUgJHtsb2NhbGV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0FERExPQ0FMSVpFRCA9ICdhZGQ6bG9jYWxpemVkJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gd2UgcmVtb3ZlIGEgbG9jYWxpemVkIGFzc2V0IGlkIGZyb20gdGhlIGFzc2V0LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhc3NldC5vbigncmVtb3ZlOmxvY2FsaXplZCcsIChsb2NhbGUsIGFzc2V0SWQpID0+IHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKGBBc3NldCAke2Fzc2V0Lm5hbWV9IGhhcyByZW1vdmVkIGxvY2FsaXplZCBhc3NldCAke2Fzc2V0SWR9IGZvciBsb2NhbGUgJHtsb2NhbGV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1JFTU9WRUxPQ0FMSVpFRCA9ICdyZW1vdmU6bG9jYWxpemVkJztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBc3NldCByZWNvcmQuIEdlbmVyYWxseSwgQXNzZXRzIGFyZSBjcmVhdGVkIGluIHRoZSBsb2FkaW5nIHByb2Nlc3MgYW5kIHlvdVxuICAgICAqIHdvbid0IG5lZWQgdG8gY3JlYXRlIHRoZW0gYnkgaGFuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gQSBub24tdW5pcXVlIGJ1dCBodW1hbi1yZWFkYWJsZSBuYW1lIHdoaWNoIGNhbiBiZSBsYXRlciB1c2VkIHRvXG4gICAgICogcmV0cmlldmUgdGhlIGFzc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVHlwZSBvZiBhc3NldC4gT25lIG9mIFtcImFuaW1hdGlvblwiLCBcImF1ZGlvXCIsIFwiYmluYXJ5XCIsIFwiY29udGFpbmVyXCIsXG4gICAgICogXCJjdWJlbWFwXCIsIFwiY3NzXCIsIFwiZm9udFwiLCBcImpzb25cIiwgXCJodG1sXCIsIFwibWF0ZXJpYWxcIiwgXCJtb2RlbFwiLCBcInNjcmlwdFwiLCBcInNoYWRlclwiLCBcInNwcml0ZVwiLFxuICAgICAqIFwidGVtcGxhdGVcIiwgdGV4dFwiLCBcInRleHR1cmVcIiwgXCJ0ZXh0dXJlYXRsYXNcIl1cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2ZpbGVdIC0gRGV0YWlscyBhYm91dCB0aGUgZmlsZSB0aGUgYXNzZXQgaXMgbWFkZSBmcm9tLiBBdCB0aGUgbGVhc3QgbXVzdFxuICAgICAqIGNvbnRhaW4gdGhlICd1cmwnIGZpZWxkLiBGb3IgYXNzZXRzIHRoYXQgZG9uJ3QgY29udGFpbiBmaWxlIGRhdGEgdXNlIG51bGwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtmaWxlLnVybF0gLSBUaGUgVVJMIG9mIHRoZSByZXNvdXJjZSBmaWxlIHRoYXQgY29udGFpbnMgdGhlIGFzc2V0IGRhdGEuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtmaWxlLmZpbGVuYW1lXSAtIFRoZSBmaWxlbmFtZSBvZiB0aGUgcmVzb3VyY2UgZmlsZSBvciBudWxsIGlmIG5vIGZpbGVuYW1lXG4gICAgICogd2FzIHNldCAoZS5nIGZyb20gdXNpbmcge0BsaW5rIEFzc2V0UmVnaXN0cnkjbG9hZEZyb21Vcmx9KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2ZpbGUuc2l6ZV0gLSBUaGUgc2l6ZSBvZiB0aGUgcmVzb3VyY2UgZmlsZSBvciBudWxsIGlmIG5vIHNpemUgd2FzIHNldFxuICAgICAqIChlLmcuIGZyb20gdXNpbmcge0BsaW5rIEFzc2V0UmVnaXN0cnkjbG9hZEZyb21Vcmx9KS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGUuaGFzaF0gLSBUaGUgTUQ1IGhhc2ggb2YgdGhlIHJlc291cmNlIGZpbGUgZGF0YSBhbmQgdGhlIEFzc2V0IGRhdGFcbiAgICAgKiBmaWVsZCBvciBudWxsIGlmIGhhc2ggd2FzIHNldCAoZS5nIGZyb20gdXNpbmcge0BsaW5rIEFzc2V0UmVnaXN0cnkjbG9hZEZyb21Vcmx9KS5cbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBbZmlsZS5jb250ZW50c10gLSBPcHRpb25hbCBmaWxlIGNvbnRlbnRzLiBUaGlzIGlzIGZhc3RlciB0aGFuIHdyYXBwaW5nXG4gICAgICogdGhlIGRhdGEgaW4gYSAoYmFzZTY0IGVuY29kZWQpIGJsb2IuIEN1cnJlbnRseSBvbmx5IHVzZWQgYnkgY29udGFpbmVyIGFzc2V0cy5cbiAgICAgKiBAcGFyYW0ge29iamVjdHxzdHJpbmd9IFtkYXRhXSAtIEpTT04gb2JqZWN0IG9yIHN0cmluZyB3aXRoIGFkZGl0aW9uYWwgZGF0YSBhYm91dCB0aGUgYXNzZXQuXG4gICAgICogKGUuZy4gZm9yIHRleHR1cmUgYW5kIG1vZGVsIGFzc2V0cykgb3IgY29udGFpbnMgdGhlIGFzc2V0IGRhdGEgaXRzZWxmIChlLmcuIGluIHRoZSBjYXNlIG9mXG4gICAgICogbWF0ZXJpYWxzKS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIGFzc2V0IGhhbmRsZXIgb3B0aW9ucy4gRm9yIGNvbnRhaW5lciBvcHRpb25zIHNlZVxuICAgICAqIHtAbGluayBDb250YWluZXJIYW5kbGVyfS5cbiAgICAgKiBAcGFyYW0geydhbm9ueW1vdXMnfCd1c2UtY3JlZGVudGlhbHMnfG51bGx9IFtvcHRpb25zLmNyb3NzT3JpZ2luXSAtIEZvciB1c2Ugd2l0aCB0ZXh0dXJlIGFzc2V0c1xuICAgICAqIHRoYXQgYXJlIGxvYWRlZCB1c2luZyB0aGUgYnJvd3Nlci4gVGhpcyBzZXR0aW5nIG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBjcm9zc09yaWdpbiBzcGVjaWZpZXIuXG4gICAgICogRm9yIG1vcmUgZGV0YWlscyBvbiBjcm9zc09yaWdpbiBhbmQgaXRzIHVzZSwgc2VlXG4gICAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxJbWFnZUVsZW1lbnQvY3Jvc3NPcmlnaW4uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IG5ldyBwYy5Bc3NldChcImEgdGV4dHVyZVwiLCBcInRleHR1cmVcIiwge1xuICAgICAqICAgICB1cmw6IFwiaHR0cDovL2V4YW1wbGUuY29tL215L2Fzc2V0cy9oZXJlL3RleHR1cmUucG5nXCJcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lLCB0eXBlLCBmaWxlLCBkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSBhc3NldElkQ291bnRlci0tO1xuICAgICAgICB0aGlzLl9uYW1lID0gbmFtZSB8fCAnJztcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHR5cGUgb2YgdGhlIGFzc2V0LiBPbmUgb2YgW1wiYW5pbWF0aW9uXCIsIFwiYXVkaW9cIiwgXCJiaW5hcnlcIiwgXCJjb250YWluZXJcIiwgXCJjdWJlbWFwXCIsXG4gICAgICAgICAqIFwiY3NzXCIsIFwiZm9udFwiLCBcImpzb25cIiwgXCJodG1sXCIsIFwibWF0ZXJpYWxcIiwgXCJtb2RlbFwiLCBcInJlbmRlclwiLCBcInNjcmlwdFwiLCBcInNoYWRlclwiLCBcInNwcml0ZVwiLFxuICAgICAgICAgKiBcInRlbXBsYXRlXCIsIFwidGV4dFwiLCBcInRleHR1cmVcIiwgXCJ0ZXh0dXJlYXRsYXNcIl1cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgeyhcImFuaW1hdGlvblwifFwiYXVkaW9cInxcImJpbmFyeVwifFwiY29udGFpbmVyXCJ8XCJjdWJlbWFwXCJ8XCJjc3NcInxcImZvbnRcInxcImpzb25cInxcImh0bWxcInxcIm1hdGVyaWFsXCJ8XCJtb2RlbFwifFwicmVuZGVyXCJ8XCJzY3JpcHRcInxcInNoYWRlclwifFwic3ByaXRlXCJ8XCJ0ZW1wbGF0ZVwifFwidGV4dFwifFwidGV4dHVyZVwifFwidGV4dHVyZWF0bGFzXCIpfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXNzZXQgdGFncy4gRW5hYmxlcyBmaW5kaW5nIG9mIGFzc2V0cyBieSB0YWdzIHVzaW5nIHRoZSB7QGxpbmsgQXNzZXRSZWdpc3RyeSNmaW5kQnlUYWd9IG1ldGhvZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RhZ3N9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgICAgICB0aGlzLl9wcmVsb2FkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YSB8fCB7IH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE9wdGlvbmFsIEpTT04gZGF0YSB0aGF0IGNvbnRhaW5zIHRoZSBhc3NldCBoYW5kbGVyIG9wdGlvbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHsgfTtcblxuICAgICAgICAvLyBUaGlzIGlzIHdoZXJlIHRoZSBsb2FkZWQgcmVzb3VyY2Uocykgd2lsbCBiZVxuICAgICAgICB0aGlzLl9yZXNvdXJjZXMgPSBbXTtcblxuICAgICAgICAvLyBhIHN0cmluZy1hc3NldElkIGRpY3Rpb25hcnkgdGhhdCBtYXBzXG4gICAgICAgIC8vIGxvY2FsZSB0byBhc3NldCBpZFxuICAgICAgICB0aGlzLl9pMThuID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgdGhlIGFzc2V0IGhhcyBmaW5pc2hlZCBhdHRlbXB0aW5nIHRvIGxvYWQgdGhlIHJlc291cmNlLiBJdCBpcyBub3QgZ3VhcmFudGVlZFxuICAgICAgICAgKiB0aGF0IHRoZSByZXNvdXJjZXMgYXJlIGF2YWlsYWJsZSBhcyB0aGVyZSBjb3VsZCBoYXZlIGJlZW4gYSBuZXR3b3JrIGVycm9yLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgdGhlIHJlc291cmNlIGlzIGN1cnJlbnRseSBiZWluZyBsb2FkZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhc3NldCByZWdpc3RyeSB0aGF0IHRoaXMgQXNzZXQgYmVsb25ncyB0by5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl8bnVsbH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVnaXN0cnkgPSBudWxsO1xuXG4gICAgICAgIGlmIChmaWxlKSB0aGlzLmZpbGUgPSBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGlkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2lkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGlkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IG5hbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBuYW1lKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9uYW1lID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fbmFtZTtcbiAgICAgICAgdGhpcy5fbmFtZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ25hbWUnLCB0aGlzLCB0aGlzLl9uYW1lLCBvbGQpO1xuICAgIH1cblxuICAgIGdldCBuYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZSBkZXRhaWxzIG9yIG51bGwgaWYgbm8gZmlsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgc2V0IGZpbGUodmFsdWUpIHtcbiAgICAgICAgLy8gaWYgdmFsdWUgY29udGFpbnMgdmFyaWFudHMsIGNob29zZSB0aGUgY29ycmVjdCB2YXJpYW50IGZpcnN0XG4gICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS52YXJpYW50cyAmJiBbJ3RleHR1cmUnLCAndGV4dHVyZWF0bGFzJywgJ2J1bmRsZSddLmluZGV4T2YodGhpcy50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIHNlYXJjaCBmb3IgYWN0aXZlIHZhcmlhbnRcbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IHRoaXMucmVnaXN0cnk/Ll9sb2FkZXI/Ll9hcHAgfHwgZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IGFwcD8uZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IFZBUklBTlRfREVGQVVMVF9QUklPUklUWS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50ID0gVkFSSUFOVF9ERUZBVUxUX1BSSU9SSVRZW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgZGV2aWNlIHN1cHBvcnRzIHRoZSB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS52YXJpYW50c1t2YXJpYW50XSAmJiBkZXZpY2VbVkFSSUFOVF9TVVBQT1JUW3ZhcmlhbnRdXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS52YXJpYW50c1t2YXJpYW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIHZhcmlhbnQgZG9lcyBub3QgZXhpc3QgYnV0IHRoZSBhc3NldCBpcyBpbiBhIGJ1bmRsZVxuICAgICAgICAgICAgICAgICAgICAvLyBhbmQgdGhlIGJ1bmRsZSBjb250YWluIGFzc2V0cyB3aXRoIHRoaXMgdmFyaWFudCB0aGVuIHJldHVybiB0aGUgZGVmYXVsdFxuICAgICAgICAgICAgICAgICAgICAvLyBmaWxlIGZvciB0aGUgYXNzZXRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFwcC5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidW5kbGVzID0gYXBwLmJ1bmRsZXMubGlzdEJ1bmRsZXNGb3JBc3NldCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidW5kbGVzICYmIGJ1bmRsZXMuZmluZCgoYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBiPy5maWxlPy52YXJpYW50c1t2YXJpYW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbGRGaWxlID0gdGhpcy5fZmlsZTtcbiAgICAgICAgY29uc3QgbmV3RmlsZSA9IHZhbHVlID8gbmV3IEFzc2V0RmlsZSh2YWx1ZS51cmwsIHZhbHVlLmZpbGVuYW1lLCB2YWx1ZS5oYXNoLCB2YWx1ZS5zaXplLCB2YWx1ZS5vcHQsIHZhbHVlLmNvbnRlbnRzKSA6IG51bGw7XG5cbiAgICAgICAgaWYgKCEhbmV3RmlsZSAhPT0gISFvbGRGaWxlIHx8IChuZXdGaWxlICYmICFuZXdGaWxlLmVxdWFscyhvbGRGaWxlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZpbGUgPSBuZXdGaWxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnLCB0aGlzLCAnZmlsZScsIG5ld0ZpbGUsIG9sZEZpbGUpO1xuICAgICAgICAgICAgdGhpcy5yZWxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmaWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBPcHRpb25hbCBKU09OIGRhdGEgdGhhdCBjb250YWlucyBlaXRoZXIgdGhlIGNvbXBsZXRlIHJlc291cmNlIGRhdGEuIChlLmcuIGluIHRoZSBjYXNlIG9mIGFcbiAgICAgKiBtYXRlcmlhbCkgb3IgYWRkaXRpb25hbCBkYXRhIChlLmcuIGluIHRoZSBjYXNlIG9mIGEgbW9kZWwgaXQgY29udGFpbnMgbWFwcGluZ3MgZnJvbSBtZXNoIHRvXG4gICAgICogbWF0ZXJpYWwpLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBzZXQgZGF0YSh2YWx1ZSkge1xuICAgICAgICAvLyBmaXJlIGNoYW5nZSBldmVudCB3aGVuIGRhdGEgY2hhbmdlc1xuICAgICAgICAvLyBiZWNhdXNlIHRoZSBhc3NldCBtaWdodCBuZWVkIHJlbG9hZGluZyBpZiB0aGF0IGhhcHBlbnNcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fZGF0YTtcbiAgICAgICAgdGhpcy5fZGF0YSA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgIT09IG9sZCkge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnLCB0aGlzLCAnZGF0YScsIHZhbHVlLCBvbGQpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RyeS5fbG9hZGVyLnBhdGNoKHRoaXMsIHRoaXMucmVnaXN0cnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRhdGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVmZXJlbmNlIHRvIHRoZSByZXNvdXJjZSB3aGVuIHRoZSBhc3NldCBpcyBsb2FkZWQuIGUuZy4gYSB7QGxpbmsgVGV4dHVyZX0gb3IgYSB7QGxpbmsgTW9kZWx9LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBzZXQgcmVzb3VyY2UodmFsdWUpIHtcbiAgICAgICAgY29uc3QgX29sZCA9IHRoaXMuX3Jlc291cmNlc1swXTtcbiAgICAgICAgdGhpcy5fcmVzb3VyY2VzWzBdID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJywgdGhpcywgJ3Jlc291cmNlJywgdmFsdWUsIF9vbGQpO1xuICAgIH1cblxuICAgIGdldCByZXNvdXJjZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc291cmNlc1swXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgcmVzb3VyY2VzIG9mIHRoZSBhc3NldCB3aGVuIGl0J3MgbG9hZGVkLiBBbiBhc3NldCBjYW4gaG9sZCBtb3JlIHJ1bnRpbWVcbiAgICAgKiByZXNvdXJjZXMgdGhhbiBvbmUgZS5nLiBjdWJlbWFwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3RbXX1cbiAgICAgKi9cbiAgICBzZXQgcmVzb3VyY2VzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9vbGQgPSB0aGlzLl9yZXNvdXJjZXM7XG4gICAgICAgIHRoaXMuX3Jlc291cmNlcyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2NoYW5nZScsIHRoaXMsICdyZXNvdXJjZXMnLCB2YWx1ZSwgX29sZCk7XG4gICAgfVxuXG4gICAgZ2V0IHJlc291cmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc291cmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhc3NldCB3aWxsIGJlIGxvYWRlZCBkdXJpbmcgdGhlIHByZWxvYWQgcGhhc2Ugb2YgYXBwbGljYXRpb24gc2V0IHVwLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHByZWxvYWQodmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fcHJlbG9hZCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcHJlbG9hZCA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fcHJlbG9hZCAmJiAhdGhpcy5sb2FkZWQgJiYgIXRoaXMubG9hZGluZyAmJiB0aGlzLnJlZ2lzdHJ5KVxuICAgICAgICAgICAgdGhpcy5yZWdpc3RyeS5sb2FkKHRoaXMpO1xuICAgIH1cblxuICAgIGdldCBwcmVsb2FkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlbG9hZDtcbiAgICB9XG5cbiAgICBzZXQgbG9hZEZhY2VzKHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KCdfbG9hZEZhY2VzJykgfHwgdmFsdWUgIT09IHRoaXMuX2xvYWRGYWNlcykge1xuICAgICAgICAgICAgdGhpcy5fbG9hZEZhY2VzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIHRoZSBsb2FkRmFjZXMgcHJvcGVydHkgc2hvdWxkIGJlIHBhcnQgb2YgdGhlIGFzc2V0IGRhdGEgYmxvY2tcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgY2hhbmdpbmcgdGhlIGZsYWcgc2hvdWxkIHJlc3VsdCBpbiBhc3NldCBwYXRjaCBiZWluZyBpbnZva2VkLlxuICAgICAgICAgICAgLy8gaGVyZSB3ZSBtdXN0IGludm9rZSBpdCBtYW51YWxseSBpbnN0ZWFkLlxuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGVkKVxuICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0cnkuX2xvYWRlci5wYXRjaCh0aGlzLCB0aGlzLnJlZ2lzdHJ5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb2FkRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2FkRmFjZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBVUkwgcmVxdWlyZWQgdG8gZmV0Y2ggdGhlIGZpbGUgZm9yIHRoaXMgYXNzZXQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IFRoZSBVUkwuIFJldHVybnMgbnVsbCBpZiB0aGUgYXNzZXQgaGFzIG5vIGFzc29jaWF0ZWQgZmlsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZChcIk15IEltYWdlXCIsIFwidGV4dHVyZVwiKTtcbiAgICAgKiBjb25zdCBpbWcgPSBcIiZsdDtpbWcgc3JjPSdcIiArIGFzc2V0c1swXS5nZXRGaWxlVXJsKCkgKyBcIicmZ3Q7XCI7XG4gICAgICovXG4gICAgZ2V0RmlsZVVybCgpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuZmlsZTtcblxuICAgICAgICBpZiAoIWZpbGUgfHwgIWZpbGUudXJsKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgbGV0IHVybCA9IGZpbGUudXJsO1xuXG4gICAgICAgIGlmICh0aGlzLnJlZ2lzdHJ5ICYmIHRoaXMucmVnaXN0cnkucHJlZml4ICYmICFBQlNPTFVURV9VUkwudGVzdCh1cmwpKVxuICAgICAgICAgICAgdXJsID0gdGhpcy5yZWdpc3RyeS5wcmVmaXggKyB1cmw7XG5cbiAgICAgICAgLy8gYWRkIGZpbGUgaGFzaCB0byBhdm9pZCBoYXJkLWNhY2hpbmcgcHJvYmxlbXNcbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gJ3NjcmlwdCcgJiYgZmlsZS5oYXNoKSB7XG4gICAgICAgICAgICBjb25zdCBzZXBhcmF0b3IgPSB1cmwuaW5kZXhPZignPycpICE9PSAtMSA/ICcmJyA6ICc/JztcbiAgICAgICAgICAgIHVybCArPSBzZXBhcmF0b3IgKyAndD0nICsgZmlsZS5oYXNoO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYW4gYXNzZXQgVVJMIGZyb20gdGhpcyBhc3NldCdzIGxvY2F0aW9uIGFuZCBhIHJlbGF0aXZlIHBhdGguIElmIHRoZSByZWxhdGl2ZVBhdGhcbiAgICAgKiBpcyBhIGJsb2Igb3IgQmFzZTY0IFVSSSwgdGhlbiByZXR1cm4gdGhhdCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlUGF0aCAtIFRoZSByZWxhdGl2ZSBwYXRoIHRvIGJlIGNvbmNhdGVuYXRlZCB0byB0aGlzIGFzc2V0J3MgYmFzZSB1cmwuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmVzdWx0aW5nIFVSTCBvZiB0aGUgYXNzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEFic29sdXRlVXJsKHJlbGF0aXZlUGF0aCkge1xuICAgICAgICBpZiAocmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHwgcmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2RhdGE6JykpIHtcbiAgICAgICAgICAgIHJldHVybiByZWxhdGl2ZVBhdGg7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiYXNlID0gcGF0aC5nZXREaXJlY3RvcnkodGhpcy5maWxlLnVybCk7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oYmFzZSwgcmVsYXRpdmVQYXRoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBhc3NldCBpZCBvZiB0aGUgYXNzZXQgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgc3BlY2lmaWVkIGxvY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgZGVzaXJlZCBsb2NhbGUgZS5nLiBBci1BUi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbiBhc3NldCBpZCBvciBudWxsIGlmIHRoZXJlIGlzIG5vIGFzc2V0IHNwZWNpZmllZCBmb3IgdGhlIGRlc2lyZWQgbG9jYWxlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSkge1xuICAgICAgICAvLyB0cmllcyB0byBmaW5kIGVpdGhlciB0aGUgZGVzaXJlZCBsb2NhbGUgb3IgYSBmYWxsYmFjayBsb2NhbGVcbiAgICAgICAgbG9jYWxlID0gZmluZEF2YWlsYWJsZUxvY2FsZShsb2NhbGUsIHRoaXMuX2kxOG4pO1xuICAgICAgICByZXR1cm4gdGhpcy5faTE4bltsb2NhbGVdIHx8IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlcGxhY2VtZW50IGFzc2V0IGlkIGZvciB0aGUgc3BlY2lmaWVkIGxvY2FsZS4gV2hlbiB0aGUgbG9jYWxlIGluXG4gICAgICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59IGNoYW5nZXMgdGhlbiByZWZlcmVuY2VzIHRvIHRoaXMgYXNzZXQgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZVxuICAgICAqIHNwZWNpZmllZCBhc3NldCBpZC4gKEN1cnJlbnRseSBvbmx5IHN1cHBvcnRlZCBieSB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzc2V0SWQgLSBUaGUgYXNzZXQgaWQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZExvY2FsaXplZEFzc2V0SWQobG9jYWxlLCBhc3NldElkKSB7XG4gICAgICAgIHRoaXMuX2kxOG5bbG9jYWxlXSA9IGFzc2V0SWQ7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkOmxvY2FsaXplZCcsIGxvY2FsZSwgYXNzZXRJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxvY2FsaXplZCBhc3NldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZUxvY2FsaXplZEFzc2V0SWQobG9jYWxlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0SWQgPSB0aGlzLl9pMThuW2xvY2FsZV07XG4gICAgICAgIGlmIChhc3NldElkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5faTE4bltsb2NhbGVdO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmU6bG9jYWxpemVkJywgbG9jYWxlLCBhc3NldElkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2UgYSBjYWxsYmFjayB3aGljaCBpcyBjYWxsZWQgYXMgc29vbiBhcyB0aGUgYXNzZXQgaXMgbG9hZGVkLiBJZiB0aGUgYXNzZXQgaXMgYWxyZWFkeVxuICAgICAqIGxvYWRlZCB0aGUgY2FsbGJhY2sgaXMgY2FsbGVkIHN0cmFpZ2h0IGF3YXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0UmVhZHlDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGFzc2V0IGlzIHJlYWR5LiBQYXNzZWRcbiAgICAgKiB0aGUgKGFzc2V0KSBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBTY29wZSBvYmplY3QgdG8gdXNlIHdoZW4gY2FsbGluZyB0aGUgY2FsbGJhY2suXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZmluZChcIk15IEFzc2V0XCIpO1xuICAgICAqIGFzc2V0LnJlYWR5KGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAqICAgLy8gYXNzZXQgbG9hZGVkXG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKi9cbiAgICByZWFkeShjYWxsYmFjaywgc2NvcGUpIHtcbiAgICAgICAgc2NvcGUgPSBzY29wZSB8fCB0aGlzO1xuXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChzY29wZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNjb3BlLCBhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbG9hZCgpIHtcbiAgICAgICAgLy8gbm8gbmVlZCB0byBiZSByZWxvYWRlZFxuICAgICAgICBpZiAodGhpcy5sb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdHJ5LmxvYWQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgYXNzb2NpYXRlZCByZXNvdXJjZSBhbmQgbWFya3MgYXNzZXQgYXMgdW5sb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5maW5kKFwiTXkgQXNzZXRcIik7XG4gICAgICogYXNzZXQudW5sb2FkKCk7XG4gICAgICogLy8gYXNzZXQucmVzb3VyY2UgaXMgbnVsbFxuICAgICAqL1xuICAgIHVubG9hZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmxvYWRlZCAmJiB0aGlzLl9yZXNvdXJjZXMubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZmlyZSgndW5sb2FkJywgdGhpcyk7XG4gICAgICAgIHRoaXMucmVnaXN0cnkuZmlyZSgndW5sb2FkOicgKyB0aGlzLmlkLCB0aGlzKTtcblxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9yZXNvdXJjZXM7XG5cbiAgICAgICAgLy8gY2xlYXIgcmVzb3VyY2VzIG9uIHRoZSBhc3NldFxuICAgICAgICB0aGlzLnJlc291cmNlcyA9IFtdO1xuICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHJlbW92ZSByZXNvdXJjZSBmcm9tIGxvYWRlciBjYWNoZVxuICAgICAgICBpZiAodGhpcy5maWxlKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdHJ5Ll9sb2FkZXIuY2xlYXJDYWNoZSh0aGlzLmdldEZpbGVVcmwoKSwgdGhpcy50eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlc3Ryb3kgcmVzb3VyY2VzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IG9sZFtpXTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZSAmJiByZXNvdXJjZS5kZXN0cm95KSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHJlc29sdmUgYXNzZXQgZmlsZSBkYXRhIGFuZCByZXR1cm4gdGhlIGNvbnRlbnRzIGFzIGFuIEFycmF5QnVmZmVyLiBJZiB0aGVcbiAgICAgKiBhc3NldCBmaWxlIGNvbnRlbnRzIGFyZSBwcmVzZW50LCB0aGF0IGlzIHJldHVybmVkLiBPdGhlcndpc2UgdGhlIGZpbGUgZGF0YSBpcyBiZSBkb3dubG9hZGVkXG4gICAgICogdmlhIGh0dHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9hZFVybCAtIFRoZSBVUkwgYXMgcGFzc2VkIGludG8gdGhlIGhhbmRsZXJcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vaGFuZGxlcnMvbG9hZGVyLmpzJykuUmVzb3VyY2VMb2FkZXJDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2tcbiAgICAgKiBmdW5jdGlvbiB0byByZWNlaXZlIHJlc3VsdHMuXG4gICAgICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIFRoZSBhc3NldFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhSZXRyaWVzIC0gTnVtYmVyIG9mIHJldHJpZXMgaWYgaHR0cCBkb3dubG9hZCBpcyByZXF1aXJlZFxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGF0aWMgZmV0Y2hBcnJheUJ1ZmZlcihsb2FkVXJsLCBjYWxsYmFjaywgYXNzZXQsIG1heFJldHJpZXMgPSAwKSB7XG4gICAgICAgIGlmIChhc3NldD8uZmlsZT8uY29udGVudHMpIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGZpbGUgY29udGVudHMgd2VyZSBwcm92aWRlZFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgYXNzZXQuZmlsZS5jb250ZW50cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGNvbnRlbnRzIG11c3QgYmUgZG93bmxvYWRlZFxuICAgICAgICAgICAgaHR0cC5nZXQobG9hZFVybCwge1xuICAgICAgICAgICAgICAgIGNhY2hlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJyxcbiAgICAgICAgICAgICAgICByZXRyeTogbWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICAgICAgbWF4UmV0cmllczogbWF4UmV0cmllc1xuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBc3NldCB9O1xuIl0sIm5hbWVzIjpbImFzc2V0SWRDb3VudGVyIiwiVkFSSUFOVF9TVVBQT1JUIiwicHZyIiwiZHh0IiwiZXRjMiIsImV0YzEiLCJiYXNpcyIsIlZBUklBTlRfREVGQVVMVF9QUklPUklUWSIsIkFzc2V0IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidHlwZSIsImZpbGUiLCJkYXRhIiwib3B0aW9ucyIsIl9pZCIsIl9uYW1lIiwidGFncyIsIlRhZ3MiLCJfcHJlbG9hZCIsIl9maWxlIiwiX2RhdGEiLCJfcmVzb3VyY2VzIiwiX2kxOG4iLCJsb2FkZWQiLCJsb2FkaW5nIiwicmVnaXN0cnkiLCJpZCIsInZhbHVlIiwib2xkIiwiZmlyZSIsInZhcmlhbnRzIiwiaW5kZXhPZiIsIl90aGlzJHJlZ2lzdHJ5IiwiYXBwIiwiX2xvYWRlciIsIl9hcHAiLCJnZXRBcHBsaWNhdGlvbiIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiaSIsImxlbiIsImxlbmd0aCIsInZhcmlhbnQiLCJlbmFibGVCdW5kbGVzIiwiYnVuZGxlcyIsImxpc3RCdW5kbGVzRm9yQXNzZXQiLCJmaW5kIiwiYiIsIl9iJGZpbGUiLCJvbGRGaWxlIiwibmV3RmlsZSIsIkFzc2V0RmlsZSIsInVybCIsImZpbGVuYW1lIiwiaGFzaCIsInNpemUiLCJvcHQiLCJjb250ZW50cyIsImVxdWFscyIsInJlbG9hZCIsInBhdGNoIiwicmVzb3VyY2UiLCJfb2xkIiwicmVzb3VyY2VzIiwicHJlbG9hZCIsImxvYWQiLCJsb2FkRmFjZXMiLCJoYXNPd25Qcm9wZXJ0eSIsIl9sb2FkRmFjZXMiLCJnZXRGaWxlVXJsIiwicHJlZml4IiwiQUJTT0xVVEVfVVJMIiwidGVzdCIsInNlcGFyYXRvciIsImdldEFic29sdXRlVXJsIiwicmVsYXRpdmVQYXRoIiwic3RhcnRzV2l0aCIsImJhc2UiLCJwYXRoIiwiZ2V0RGlyZWN0b3J5Iiwiam9pbiIsImdldExvY2FsaXplZEFzc2V0SWQiLCJsb2NhbGUiLCJmaW5kQXZhaWxhYmxlTG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsImFzc2V0SWQiLCJyZW1vdmVMb2NhbGl6ZWRBc3NldElkIiwicmVhZHkiLCJjYWxsYmFjayIsInNjb3BlIiwiY2FsbCIsIm9uY2UiLCJhc3NldCIsInVubG9hZCIsImNsZWFyQ2FjaGUiLCJkZXN0cm95IiwiZmV0Y2hBcnJheUJ1ZmZlciIsImxvYWRVcmwiLCJtYXhSZXRyaWVzIiwiX2Fzc2V0JGZpbGUiLCJzZXRUaW1lb3V0IiwiaHR0cCIsImdldCIsImNhY2hlIiwicmVzcG9uc2VUeXBlIiwicmV0cnkiLCJFVkVOVF9MT0FEIiwiRVZFTlRfVU5MT0FEIiwiRVZFTlRfUkVNT1ZFIiwiRVZFTlRfRVJST1IiLCJFVkVOVF9DSEFOR0UiLCJFVkVOVF9BRERMT0NBTElaRUQiLCJFVkVOVF9SRU1PVkVMT0NBTElaRUQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVlBO0FBQ0EsSUFBSUEsY0FBYyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBRXZCLE1BQU1DLGVBQWUsR0FBRztBQUNwQkMsRUFBQUEsR0FBRyxFQUFFLDJCQUEyQjtBQUNoQ0MsRUFBQUEsR0FBRyxFQUFFLDBCQUEwQjtBQUMvQkMsRUFBQUEsSUFBSSxFQUFFLHlCQUF5QjtBQUMvQkMsRUFBQUEsSUFBSSxFQUFFLDBCQUEwQjtFQUNoQ0MsS0FBSyxFQUFFLFFBQVE7QUFDbkIsQ0FBQyxDQUFBOztBQUVELE1BQU1DLHdCQUF3QixHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFB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
