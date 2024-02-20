import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';
import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';
import { script } from '../script.js';
import { Asset } from './asset.js';

/**
 * Callback used by {@link AssetRegistry#filter} to filter assets.
 *
 * @callback FilterAssetCallback
 * @param {Asset} asset - The current asset to filter.
 * @returns {boolean} Return `true` to include asset to result list.
 */

/**
 * Callback used by {@link AssetRegistry#loadFromUrl} and called when an asset is loaded (or an
 * error occurs).
 *
 * @callback LoadAssetCallback
 * @param {string|null} err - The error message is null if no errors were encountered.
 * @param {Asset} [asset] - The loaded asset if no errors were encountered.
 */

/**
 * Container for all assets that are available to this application. Note that PlayCanvas scripts
 * are provided with an AssetRegistry instance as `app.assets`.
 *
 * @augments EventHandler
 * @category Asset
 */
class AssetRegistry extends EventHandler {
  /**
   * Create an instance of an AssetRegistry.
   *
   * @param {import('../handlers/loader.js').ResourceLoader} loader - The ResourceLoader used to
   * load the asset files.
   */
  constructor(loader) {
    super();
    /**
     * @type {Set<Asset>}
     * @private
     */
    this._assets = new Set();
    /**
     * @type {Map<number, Asset>}
     * @private
     */
    this._idToAsset = new Map();
    /**
     * @type {Map<string, Asset>}
     * @private
     */
    this._urlToAsset = new Map();
    /**
     * @type {Map<string, Set<Asset>>}
     * @private
     */
    this._nameToAsset = new Map();
    /**
     * Index for looking up by tags.
     *
     * @private
     */
    this._tags = new TagsCache('_id');
    /**
     * A URL prefix that will be added to all asset loading requests.
     *
     * @type {string|null}
     */
    this.prefix = null;
    this._loader = loader;
  }

  /**
   * Create a filtered list of assets from the registry.
   *
   * @param {object} filters - Properties to filter on, currently supports: 'preload: true|false'.
   * @returns {Asset[]} The filtered list of assets.
   */
  list(filters = {}) {
    const assets = Array.from(this._assets);
    if (filters.preload !== undefined) {
      return assets.filter(asset => asset.preload === filters.preload);
    }
    return assets;
  }

  /**
   * Add an asset to the registry.
   *
   * @param {Asset} asset - The asset to add.
   * @example
   * const asset = new pc.Asset("My Asset", "texture", {
   *     url: "../path/to/image.jpg"
   * });
   * app.assets.add(asset);
   */
  add(asset) {
    var _asset$file, _asset$file2;
    if (this._assets.has(asset)) return;
    this._assets.add(asset);
    this._idToAsset.set(asset.id, asset);
    if ((_asset$file = asset.file) != null && _asset$file.url) {
      this._urlToAsset.set(asset.file.url, asset);
    }
    if (!this._nameToAsset.has(asset.name)) this._nameToAsset.set(asset.name, new Set());
    this._nameToAsset.get(asset.name).add(asset);
    asset.on('name', this._onNameChange, this);
    asset.registry = this;

    // tags cache
    this._tags.addItem(asset);
    asset.tags.on('add', this._onTagAdd, this);
    asset.tags.on('remove', this._onTagRemove, this);
    this.fire('add', asset);
    this.fire('add:' + asset.id, asset);
    if ((_asset$file2 = asset.file) != null && _asset$file2.url) {
      this.fire('add:url:' + asset.file.url, asset);
    }
    if (asset.preload) this.load(asset);
  }

  /**
   * Remove an asset from the registry.
   *
   * @param {Asset} asset - The asset to remove.
   * @returns {boolean} True if the asset was successfully removed and false otherwise.
   * @example
   * const asset = app.assets.get(100);
   * app.assets.remove(asset);
   */
  remove(asset) {
    var _asset$file3, _asset$file4;
    if (!this._assets.has(asset)) return false;
    this._assets.delete(asset);
    this._idToAsset.delete(asset.id);
    if ((_asset$file3 = asset.file) != null && _asset$file3.url) {
      this._urlToAsset.delete(asset.file.url);
    }
    asset.off('name', this._onNameChange, this);
    if (this._nameToAsset.has(asset.name)) {
      const items = this._nameToAsset.get(asset.name);
      items.delete(asset);
      if (items.size === 0) {
        this._nameToAsset.delete(asset.name);
      }
    }

    // tags cache
    this._tags.removeItem(asset);
    asset.tags.off('add', this._onTagAdd, this);
    asset.tags.off('remove', this._onTagRemove, this);
    asset.fire('remove', asset);
    this.fire('remove', asset);
    this.fire('remove:' + asset.id, asset);
    if ((_asset$file4 = asset.file) != null && _asset$file4.url) {
      this.fire('remove:url:' + asset.file.url, asset);
    }
    return true;
  }

  /**
   * Retrieve an asset from the registry by its id field.
   *
   * @param {number} id - The id of the asset to get.
   * @returns {Asset|undefined} The asset.
   * @example
   * const asset = app.assets.get(100);
   */
  get(id) {
    // Since some apps incorrectly pass the id as a string, force a conversion to a number
    return this._idToAsset.get(Number(id));
  }

  /**
   * Retrieve an asset from the registry by its file's URL field.
   *
   * @param {string} url - The url of the asset to get.
   * @returns {Asset|undefined} The asset.
   * @example
   * const asset = app.assets.getByUrl("../path/to/image.jpg");
   */
  getByUrl(url) {
    return this._urlToAsset.get(url);
  }

  /**
   * Load the asset's file from a remote source. Listen for "load" events on the asset to find
   * out when it is loaded.
   *
   * @param {Asset} asset - The asset to load.
   * @example
   * // load some assets
   * const assetsToLoad = [
   *     app.assets.find("My Asset"),
   *     app.assets.find("Another Asset")
   * ];
   * let count = 0;
   * assetsToLoad.forEach(function (assetToLoad) {
   *     assetToLoad.ready(function (asset) {
   *         count++;
   *         if (count === assetsToLoad.length) {
   *             // done
   *         }
   *     });
   *     app.assets.load(assetToLoad);
   * });
   */
  load(asset) {
    // do nothing if asset is already loaded
    // note: lots of code calls assets.load() assuming this check is present
    // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
    if (asset.loading || asset.loaded) {
      return;
    }
    const file = asset.file;

    // open has completed on the resource
    const _opened = resource => {
      if (resource instanceof Array) {
        asset.resources = resource;
      } else {
        asset.resource = resource;
      }

      // let handler patch the resource
      this._loader.patch(asset, this);
      this.fire('load', asset);
      this.fire('load:' + asset.id, asset);
      if (file && file.url) this.fire('load:url:' + file.url, asset);
      asset.fire('load', asset);
    };

    // load has completed on the resource
    const _loaded = (err, resource, extra) => {
      asset.loaded = true;
      asset.loading = false;
      if (err) {
        this.fire('error', err, asset);
        this.fire('error:' + asset.id, err, asset);
        asset.fire('error', err, asset);
      } else {
        if (!script.legacy && asset.type === 'script') {
          const handler = this._loader.getHandler('script');
          if (handler._cache[asset.id] && handler._cache[asset.id].parentNode === document.head) {
            // remove old element
            document.head.removeChild(handler._cache[asset.id]);
          }
          handler._cache[asset.id] = extra;
        }
        _opened(resource);
      }
    };
    if (file || asset.type === 'cubemap') {
      // start loading the resource
      this.fire('load:start', asset);
      this.fire('load:' + asset.id + ':start', asset);
      asset.loading = true;
      this._loader.load(asset.getFileUrl(), asset.type, _loaded, asset);
    } else {
      // asset has no file to load, open it directly
      const resource = this._loader.open(asset.type, asset.data);
      asset.loaded = true;
      _opened(resource);
    }
  }

  /**
   * Use this to load and create an asset if you don't have assets created. Usually you would
   * only use this if you are not integrated with the PlayCanvas Editor.
   *
   * @param {string} url - The url to load.
   * @param {string} type - The type of asset to load.
   * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
   * asset), where err is null if no errors were encountered.
   * @example
   * app.assets.loadFromUrl("../path/to/texture.jpg", "texture", function (err, asset) {
   *     const texture = asset.resource;
   * });
   */
  loadFromUrl(url, type, callback) {
    this.loadFromUrlAndFilename(url, null, type, callback);
  }

  /**
   * Use this to load and create an asset when both the URL and filename are required. For
   * example, use this function when loading BLOB assets, where the URL does not adequately
   * identify the file.
   *
   * @param {string} url - The url to load.
   * @param {string} filename - The filename of the asset to load.
   * @param {string} type - The type of asset to load.
   * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
   * asset), where err is null if no errors were encountered.
   * @example
   * const file = magicallyObtainAFile();
   * app.assets.loadFromUrlAndFilename(URL.createObjectURL(file), "texture.png", "texture", function (err, asset) {
   *     const texture = asset.resource;
   * });
   */
  loadFromUrlAndFilename(url, filename, type, callback) {
    const name = path.getBasename(filename || url);
    const file = {
      filename: filename || name,
      url: url
    };
    let asset = this.getByUrl(url);
    if (!asset) {
      asset = new Asset(name, type, file);
      this.add(asset);
    } else if (asset.loaded) {
      // asset is already loaded
      callback(asset.loadFromUrlError || null, asset);
      return;
    }
    const startLoad = asset => {
      asset.once('load', loadedAsset => {
        if (type === 'material') {
          this._loadTextures(loadedAsset, (err, textures) => {
            callback(err, loadedAsset);
          });
        } else {
          callback(null, loadedAsset);
        }
      });
      asset.once('error', err => {
        // store the error on the asset in case user requests this asset again
        if (err) {
          this.loadFromUrlError = err;
        }
        callback(err, asset);
      });
      this.load(asset);
    };
    if (asset.resource) {
      callback(null, asset);
    } else if (type === 'model') {
      this._loadModel(asset, startLoad);
    } else {
      startLoad(asset);
    }
  }

  // private method used for engine-only loading of model data
  _loadModel(modelAsset, continuation) {
    const url = modelAsset.getFileUrl();
    const ext = path.getExtension(url);
    if (ext === '.json' || ext === '.glb') {
      const dir = path.getDirectory(url);
      const basename = path.getBasename(url);

      // PlayCanvas model format supports material mapping file
      const mappingUrl = path.join(dir, basename.replace(ext, '.mapping.json'));
      this._loader.load(mappingUrl, 'json', (err, data) => {
        if (err) {
          modelAsset.data = {
            mapping: []
          };
          continuation(modelAsset);
        } else {
          this._loadMaterials(modelAsset, data, (e, materials) => {
            modelAsset.data = data;
            continuation(modelAsset);
          });
        }
      });
    } else {
      // other model format (e.g. obj)
      continuation(modelAsset);
    }
  }

  // private method used for engine-only loading of model materials
  _loadMaterials(modelAsset, mapping, callback) {
    const materials = [];
    let count = 0;
    const onMaterialLoaded = (err, materialAsset) => {
      // load dependent textures
      this._loadTextures(materialAsset, (err, textures) => {
        materials.push(materialAsset);
        if (materials.length === count) {
          callback(null, materials);
        }
      });
    };
    for (let i = 0; i < mapping.mapping.length; i++) {
      const path = mapping.mapping[i].path;
      if (path) {
        count++;
        const url = modelAsset.getAbsoluteUrl(path);
        this.loadFromUrl(url, 'material', onMaterialLoaded);
      }
    }
    if (count === 0) {
      callback(null, materials);
    }
  }

  // private method used for engine-only loading of the textures referenced by
  // the material asset
  _loadTextures(materialAsset, callback) {
    const textures = [];
    let count = 0;
    const data = materialAsset.data;
    if (data.mappingFormat !== 'path') {
      Debug.warn(`Skipping: ${materialAsset.name}, material files must be mappingFormat: "path" to be loaded from URL`);
      callback(null, textures);
      return;
    }
    const onTextureLoaded = (err, texture) => {
      if (err) console.error(err);
      textures.push(texture);
      if (textures.length === count) {
        callback(null, textures);
      }
    };
    const texParams = standardMaterialTextureParameters;
    for (let i = 0; i < texParams.length; i++) {
      const path = data[texParams[i]];
      if (path && typeof path === 'string') {
        count++;
        const url = materialAsset.getAbsoluteUrl(path);
        this.loadFromUrl(url, 'texture', onTextureLoaded);
      }
    }
    if (count === 0) {
      callback(null, textures);
    }
  }
  _onTagAdd(tag, asset) {
    this._tags.add(tag, asset);
  }
  _onTagRemove(tag, asset) {
    this._tags.remove(tag, asset);
  }
  _onNameChange(asset, name, nameOld) {
    // remove
    if (this._nameToAsset.has(nameOld)) {
      const items = this._nameToAsset.get(nameOld);
      items.delete(asset);
      if (items.size === 0) {
        this._nameToAsset.delete(nameOld);
      }
    }

    // add
    if (!this._nameToAsset.has(asset.name)) this._nameToAsset.set(asset.name, new Set());
    this._nameToAsset.get(asset.name).add(asset);
  }

  /**
   * Return all Assets that satisfy the search query. Query can be simply a string, or comma
   * separated strings, to have inclusive results of assets that match at least one query. A
   * query that consists of an array of tags can be used to match assets that have each tag of
   * array.
   *
   * @param {...*} query - Name of a tag or array of tags.
   * @returns {Asset[]} A list of all Assets matched query.
   * @example
   * const assets = app.assets.findByTag("level-1");
   * // returns all assets that tagged by `level-1`
   * @example
   * const assets = app.assets.findByTag("level-1", "level-2");
   * // returns all assets that tagged by `level-1` OR `level-2`
   * @example
   * const assets = app.assets.findByTag(["level-1", "monster"]);
   * // returns all assets that tagged by `level-1` AND `monster`
   * @example
   * const assets = app.assets.findByTag(["level-1", "monster"], ["level-2", "monster"]);
   * // returns all assets that tagged by (`level-1` AND `monster`) OR (`level-2` AND `monster`)
   */
  findByTag() {
    return this._tags.find(arguments);
  }

  /**
   * Return all Assets that satisfy a filter callback.
   *
   * @param {FilterAssetCallback} callback - The callback function that is used to filter assets.
   * Return `true` to include an asset in the returned array.
   * @returns {Asset[]} A list of all Assets found.
   * @example
   * const assets = app.assets.filter(asset => asset.name.includes('monster'));
   * console.log(`Found ${assets.length} assets with a name containing 'monster'`);
   */
  filter(callback) {
    return Array.from(this._assets).filter(asset => callback(asset));
  }

  /**
   * Return the first Asset with the specified name and type found in the registry.
   *
   * @param {string} name - The name of the Asset to find.
   * @param {string} [type] - The type of the Asset to find.
   * @returns {Asset|null} A single Asset or null if no Asset is found.
   * @example
   * const asset = app.assets.find("myTextureAsset", "texture");
   */
  find(name, type) {
    const items = this._nameToAsset.get(name);
    if (!items) return null;
    for (const asset of items) {
      if (!type || asset.type === type) {
        return asset;
      }
    }
    return null;
  }

  /**
   * Return all Assets with the specified name and type found in the registry.
   *
   * @param {string} name - The name of the Assets to find.
   * @param {string} [type] - The type of the Assets to find.
   * @returns {Asset[]} A list of all Assets found.
   * @example
   * const assets = app.assets.findAll('brick', 'texture');
   * console.log(`Found ${assets.length} texture assets named 'brick'`);
   */
  findAll(name, type) {
    const items = this._nameToAsset.get(name);
    if (!items) return [];
    const results = Array.from(items);
    if (!type) return results;
    return results.filter(asset => asset.type === type);
  }
}
/**
 * Fired when an asset completes loading. This event is available in three forms. They are as
 * follows:
 *
 * 1. `load` - Fired when any asset finishes loading.
 * 2. `load:[id]` - Fired when a specific asset has finished loading, where `[id]` is the
 * unique id of the asset.
 * 3. `load:url:[url]` - Fired when an asset finishes loading whose URL matches `[url]`, where
 * `[url]` is the URL of the asset.
 *
 * @event
 * @example
 * app.assets.on('load', (asset) => {
 *     console.log(`Asset loaded: ${asset.name}`);
 * });
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('load:' + id, (asset) => {
 *     console.log(`Asset loaded: ${asset.name}`);
 * });
 * app.assets.load(asset);
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('load:url:' + asset.file.url, (asset) => {
 *     console.log(`Asset loaded: ${asset.name}`);
 * });
 * app.assets.load(asset);
 */
AssetRegistry.EVENT_LOAD = 'load';
/**
 * Fired when an asset is added to the registry. This event is available in three forms. They
 * are as follows:
 *
 * 1. `add` - Fired when any asset is added to the registry.
 * 2. `add:[id]` - Fired when an asset is added to the registry, where `[id]` is the unique id
 * of the asset.
 * 3. `add:url:[url]` - Fired when an asset is added to the registry and matches the URL
 * `[url]`, where `[url]` is the URL of the asset.
 *
 * @event
 * @example
 * app.assets.on('add', (asset) => {
 *    console.log(`Asset added: ${asset.name}`);
 * });
 * @example
 * const id = 123456;
 * app.assets.on('add:' + id, (asset) => {
 *    console.log(`Asset added: ${asset.name}`);
 * });
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('add:url:' + asset.file.url, (asset) => {
 *    console.log(`Asset added: ${asset.name}`);
 * });
 */
AssetRegistry.EVENT_ADD = 'add';
/**
 * Fired when an asset is removed from the registry. This event is available in three forms.
 * They are as follows:
 *
 * 1. `remove` - Fired when any asset is removed from the registry.
 * 2. `remove:[id]` - Fired when an asset is removed from the registry, where `[id]` is the
 * unique id of the asset.
 * 3. `remove:url:[url]` - Fired when an asset is removed from the registry and matches the
 * URL `[url]`, where `[url]` is the URL of the asset.
 *
 * @event
 * @param {Asset} asset - The asset that was removed.
 * @example
 * app.assets.on('remove', (asset) => {
 *    console.log(`Asset removed: ${asset.name}`);
 * });
 * @example
 * const id = 123456;
 * app.assets.on('remove:' + id, (asset) => {
 *    console.log(`Asset removed: ${asset.name}`);
 * });
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('remove:url:' + asset.file.url, (asset) => {
 *    console.log(`Asset removed: ${asset.name}`);
 * });
 */
AssetRegistry.EVENT_REMOVE = 'remove';
/**
 * Fired when an error occurs during asset loading. This event is available in two forms. They
 * are as follows:
 *
 * 1. `error` - Fired when any asset reports an error in loading.
 * 2. `error:[id]` - Fired when an asset reports an error in loading, where `[id]` is the
 * unique id of the asset.
 *
 * @event
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('error', (err, asset) => {
 *     console.error(err);
 * });
 * app.assets.load(asset);
 * @example
 * const id = 123456;
 * const asset = app.assets.get(id);
 * app.assets.on('error:' + id, (err, asset) => {
 *     console.error(err);
 * });
 * app.assets.load(asset);
 */
AssetRegistry.EVENT_ERROR = 'error';

export { AssetRegistry };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3NDYWNoZSB9IGZyb20gJy4uLy4uL2NvcmUvdGFncy1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IHN0YW5kYXJkTWF0ZXJpYWxUZXh0dXJlUGFyYW1ldGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi4vc2NyaXB0LmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0LmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldFJlZ2lzdHJ5I2ZpbHRlcn0gdG8gZmlsdGVyIGFzc2V0cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmlsdGVyQXNzZXRDYWxsYmFja1xuICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgY3VycmVudCBhc3NldCB0byBmaWx0ZXIuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIGB0cnVlYCB0byBpbmNsdWRlIGFzc2V0IHRvIHJlc3VsdCBsaXN0LlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIGxvYWRlZCAob3IgYW5cbiAqIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIExvYWRBc3NldENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpcyBudWxsIGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIFRoZSBsb2FkZWQgYXNzZXQgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBhc3NldHMgdGhhdCBhcmUgYXZhaWxhYmxlIHRvIHRoaXMgYXBwbGljYXRpb24uIE5vdGUgdGhhdCBQbGF5Q2FudmFzIHNjcmlwdHNcbiAqIGFyZSBwcm92aWRlZCB3aXRoIGFuIEFzc2V0UmVnaXN0cnkgaW5zdGFuY2UgYXMgYGFwcC5hc3NldHNgLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5jbGFzcyBBc3NldFJlZ2lzdHJ5IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGNvbXBsZXRlcyBsb2FkaW5nLiBUaGlzIGV2ZW50IGlzIGF2YWlsYWJsZSBpbiB0aHJlZSBmb3Jtcy4gVGhleSBhcmUgYXNcbiAgICAgKiBmb2xsb3dzOlxuICAgICAqXG4gICAgICogMS4gYGxvYWRgIC0gRmlyZWQgd2hlbiBhbnkgYXNzZXQgZmluaXNoZXMgbG9hZGluZy5cbiAgICAgKiAyLiBgbG9hZDpbaWRdYCAtIEZpcmVkIHdoZW4gYSBzcGVjaWZpYyBhc3NldCBoYXMgZmluaXNoZWQgbG9hZGluZywgd2hlcmUgYFtpZF1gIGlzIHRoZVxuICAgICAqIHVuaXF1ZSBpZCBvZiB0aGUgYXNzZXQuXG4gICAgICogMy4gYGxvYWQ6dXJsOlt1cmxdYCAtIEZpcmVkIHdoZW4gYW4gYXNzZXQgZmluaXNoZXMgbG9hZGluZyB3aG9zZSBVUkwgbWF0Y2hlcyBgW3VybF1gLCB3aGVyZVxuICAgICAqIGBbdXJsXWAgaXMgdGhlIFVSTCBvZiB0aGUgYXNzZXQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5hc3NldHMub24oJ2xvYWQnLCAoYXNzZXQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYEFzc2V0IGxvYWRlZDogJHthc3NldC5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaWQgPSAxMjM0NTY7XG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldChpZCk7XG4gICAgICogYXBwLmFzc2V0cy5vbignbG9hZDonICsgaWQsIChhc3NldCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQXNzZXQgbG9hZGVkOiAke2Fzc2V0Lm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoaWQpO1xuICAgICAqIGFwcC5hc3NldHMub24oJ2xvYWQ6dXJsOicgKyBhc3NldC5maWxlLnVybCwgKGFzc2V0KSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBBc3NldCBsb2FkZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9MT0FEID0gJ2xvYWQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBpcyBhZGRlZCB0byB0aGUgcmVnaXN0cnkuIFRoaXMgZXZlbnQgaXMgYXZhaWxhYmxlIGluIHRocmVlIGZvcm1zLiBUaGV5XG4gICAgICogYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgYWRkYCAtIEZpcmVkIHdoZW4gYW55IGFzc2V0IGlzIGFkZGVkIHRvIHRoZSByZWdpc3RyeS5cbiAgICAgKiAyLiBgYWRkOltpZF1gIC0gRmlyZWQgd2hlbiBhbiBhc3NldCBpcyBhZGRlZCB0byB0aGUgcmVnaXN0cnksIHdoZXJlIGBbaWRdYCBpcyB0aGUgdW5pcXVlIGlkXG4gICAgICogb2YgdGhlIGFzc2V0LlxuICAgICAqIDMuIGBhZGQ6dXJsOlt1cmxdYCAtIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgYWRkZWQgdG8gdGhlIHJlZ2lzdHJ5IGFuZCBtYXRjaGVzIHRoZSBVUkxcbiAgICAgKiBgW3VybF1gLCB3aGVyZSBgW3VybF1gIGlzIHRoZSBVUkwgb2YgdGhlIGFzc2V0LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuYXNzZXRzLm9uKCdhZGQnLCAoYXNzZXQpID0+IHtcbiAgICAgKiAgICBjb25zb2xlLmxvZyhgQXNzZXQgYWRkZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGFwcC5hc3NldHMub24oJ2FkZDonICsgaWQsIChhc3NldCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUubG9nKGBBc3NldCBhZGRlZDogJHthc3NldC5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaWQgPSAxMjM0NTY7XG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldChpZCk7XG4gICAgICogYXBwLmFzc2V0cy5vbignYWRkOnVybDonICsgYXNzZXQuZmlsZS51cmwsIChhc3NldCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUubG9nKGBBc3NldCBhZGRlZDogJHthc3NldC5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9BREQgPSAnYWRkJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSByZWdpc3RyeS4gVGhpcyBldmVudCBpcyBhdmFpbGFibGUgaW4gdGhyZWUgZm9ybXMuXG4gICAgICogVGhleSBhcmUgYXMgZm9sbG93czpcbiAgICAgKlxuICAgICAqIDEuIGByZW1vdmVgIC0gRmlyZWQgd2hlbiBhbnkgYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKiAyLiBgcmVtb3ZlOltpZF1gIC0gRmlyZWQgd2hlbiBhbiBhc3NldCBpcyByZW1vdmVkIGZyb20gdGhlIHJlZ2lzdHJ5LCB3aGVyZSBgW2lkXWAgaXMgdGhlXG4gICAgICogdW5pcXVlIGlkIG9mIHRoZSBhc3NldC5cbiAgICAgKiAzLiBgcmVtb3ZlOnVybDpbdXJsXWAgLSBGaXJlZCB3aGVuIGFuIGFzc2V0IGlzIHJlbW92ZWQgZnJvbSB0aGUgcmVnaXN0cnkgYW5kIG1hdGNoZXMgdGhlXG4gICAgICogVVJMIGBbdXJsXWAsIHdoZXJlIGBbdXJsXWAgaXMgdGhlIFVSTCBvZiB0aGUgYXNzZXQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmFzc2V0cy5vbigncmVtb3ZlJywgKGFzc2V0KSA9PiB7XG4gICAgICogICAgY29uc29sZS5sb2coYEFzc2V0IHJlbW92ZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGFwcC5hc3NldHMub24oJ3JlbW92ZTonICsgaWQsIChhc3NldCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUubG9nKGBBc3NldCByZW1vdmVkOiAke2Fzc2V0Lm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBpZCA9IDEyMzQ1NjtcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgKiBhcHAuYXNzZXRzLm9uKCdyZW1vdmU6dXJsOicgKyBhc3NldC5maWxlLnVybCwgKGFzc2V0KSA9PiB7XG4gICAgICogICAgY29uc29sZS5sb2coYEFzc2V0IHJlbW92ZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGVycm9yIG9jY3VycyBkdXJpbmcgYXNzZXQgbG9hZGluZy4gVGhpcyBldmVudCBpcyBhdmFpbGFibGUgaW4gdHdvIGZvcm1zLiBUaGV5XG4gICAgICogYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgZXJyb3JgIC0gRmlyZWQgd2hlbiBhbnkgYXNzZXQgcmVwb3J0cyBhbiBlcnJvciBpbiBsb2FkaW5nLlxuICAgICAqIDIuIGBlcnJvcjpbaWRdYCAtIEZpcmVkIHdoZW4gYW4gYXNzZXQgcmVwb3J0cyBhbiBlcnJvciBpbiBsb2FkaW5nLCB3aGVyZSBgW2lkXWAgaXMgdGhlXG4gICAgICogdW5pcXVlIGlkIG9mIHRoZSBhc3NldC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaWQgPSAxMjM0NTY7XG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldChpZCk7XG4gICAgICogYXBwLmFzc2V0cy5vbignZXJyb3InLCAoZXJyLCBhc3NldCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoaWQpO1xuICAgICAqIGFwcC5hc3NldHMub24oJ2Vycm9yOicgKyBpZCwgKGVyciwgYXNzZXQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VSUk9SID0gJ2Vycm9yJztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTZXQ8QXNzZXQ+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0cyA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXA8bnVtYmVyLCBBc3NldD59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWRUb0Fzc2V0ID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hcDxzdHJpbmcsIEFzc2V0Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cmxUb0Fzc2V0ID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hcDxzdHJpbmcsIFNldDxBc3NldD4+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25hbWVUb0Fzc2V0ID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogSW5kZXggZm9yIGxvb2tpbmcgdXAgYnkgdGFncy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RhZ3MgPSBuZXcgVGFnc0NhY2hlKCdfaWQnKTtcblxuICAgIC8qKlxuICAgICAqIEEgVVJMIHByZWZpeCB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gYWxsIGFzc2V0IGxvYWRpbmcgcmVxdWVzdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgcHJlZml4ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhbiBBc3NldFJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2hhbmRsZXJzL2xvYWRlci5qcycpLlJlc291cmNlTG9hZGVyfSBsb2FkZXIgLSBUaGUgUmVzb3VyY2VMb2FkZXIgdXNlZCB0b1xuICAgICAqIGxvYWQgdGhlIGFzc2V0IGZpbGVzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGxvYWRlcikge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2xvYWRlciA9IGxvYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBmaWx0ZXJlZCBsaXN0IG9mIGFzc2V0cyBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBmaWx0ZXJzIC0gUHJvcGVydGllcyB0byBmaWx0ZXIgb24sIGN1cnJlbnRseSBzdXBwb3J0czogJ3ByZWxvYWQ6IHRydWV8ZmFsc2UnLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBUaGUgZmlsdGVyZWQgbGlzdCBvZiBhc3NldHMuXG4gICAgICovXG4gICAgbGlzdChmaWx0ZXJzID0ge30pIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gQXJyYXkuZnJvbSh0aGlzLl9hc3NldHMpO1xuICAgICAgICBpZiAoZmlsdGVycy5wcmVsb2FkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBhc3NldHMuZmlsdGVyKGFzc2V0ID0+IGFzc2V0LnByZWxvYWQgPT09IGZpbHRlcnMucHJlbG9hZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFzc2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYW4gYXNzZXQgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdG8gYWRkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXQgPSBuZXcgcGMuQXNzZXQoXCJNeSBBc3NldFwiLCBcInRleHR1cmVcIiwge1xuICAgICAqICAgICB1cmw6IFwiLi4vcGF0aC90by9pbWFnZS5qcGdcIlxuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgKi9cbiAgICBhZGQoYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0cy5oYXMoYXNzZXQpKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fYXNzZXRzLmFkZChhc3NldCk7XG5cbiAgICAgICAgdGhpcy5faWRUb0Fzc2V0LnNldChhc3NldC5pZCwgYXNzZXQpO1xuXG4gICAgICAgIGlmIChhc3NldC5maWxlPy51cmwpIHtcbiAgICAgICAgICAgIHRoaXMuX3VybFRvQXNzZXQuc2V0KGFzc2V0LmZpbGUudXJsLCBhc3NldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX25hbWVUb0Fzc2V0Lmhhcyhhc3NldC5uYW1lKSlcbiAgICAgICAgICAgIHRoaXMuX25hbWVUb0Fzc2V0LnNldChhc3NldC5uYW1lLCBuZXcgU2V0KCkpO1xuXG4gICAgICAgIHRoaXMuX25hbWVUb0Fzc2V0LmdldChhc3NldC5uYW1lKS5hZGQoYXNzZXQpO1xuXG4gICAgICAgIGFzc2V0Lm9uKCduYW1lJywgdGhpcy5fb25OYW1lQ2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBhc3NldC5yZWdpc3RyeSA9IHRoaXM7XG5cbiAgICAgICAgLy8gdGFncyBjYWNoZVxuICAgICAgICB0aGlzLl90YWdzLmFkZEl0ZW0oYXNzZXQpO1xuICAgICAgICBhc3NldC50YWdzLm9uKCdhZGQnLCB0aGlzLl9vblRhZ0FkZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0LnRhZ3Mub24oJ3JlbW92ZScsIHRoaXMuX29uVGFnUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGFzc2V0KTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQ6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgIGlmIChhc3NldC5maWxlPy51cmwpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYWRkOnVybDonICsgYXNzZXQuZmlsZS51cmwsIGFzc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhc3NldC5wcmVsb2FkKVxuICAgICAgICAgICAgdGhpcy5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYW4gYXNzZXQgZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0byByZW1vdmUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGFzc2V0IHdhcyBzdWNjZXNzZnVsbHkgcmVtb3ZlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMDApO1xuICAgICAqIGFwcC5hc3NldHMucmVtb3ZlKGFzc2V0KTtcbiAgICAgKi9cbiAgICByZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hc3NldHMuaGFzKGFzc2V0KSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2Fzc2V0cy5kZWxldGUoYXNzZXQpO1xuXG4gICAgICAgIHRoaXMuX2lkVG9Bc3NldC5kZWxldGUoYXNzZXQuaWQpO1xuXG4gICAgICAgIGlmIChhc3NldC5maWxlPy51cmwpIHtcbiAgICAgICAgICAgIHRoaXMuX3VybFRvQXNzZXQuZGVsZXRlKGFzc2V0LmZpbGUudXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2V0Lm9mZignbmFtZScsIHRoaXMuX29uTmFtZUNoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX25hbWVUb0Fzc2V0Lmhhcyhhc3NldC5uYW1lKSkge1xuICAgICAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLl9uYW1lVG9Bc3NldC5nZXQoYXNzZXQubmFtZSk7XG4gICAgICAgICAgICBpdGVtcy5kZWxldGUoYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGl0ZW1zLnNpemUgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9uYW1lVG9Bc3NldC5kZWxldGUoYXNzZXQubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0YWdzIGNhY2hlXG4gICAgICAgIHRoaXMuX3RhZ3MucmVtb3ZlSXRlbShhc3NldCk7XG4gICAgICAgIGFzc2V0LnRhZ3Mub2ZmKCdhZGQnLCB0aGlzLl9vblRhZ0FkZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0LnRhZ3Mub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblRhZ1JlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgYXNzZXQuZmlyZSgncmVtb3ZlJywgYXNzZXQpO1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGFzc2V0KTtcbiAgICAgICAgdGhpcy5maXJlKCdyZW1vdmU6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgIGlmIChhc3NldC5maWxlPy51cmwpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlOnVybDonICsgYXNzZXQuZmlsZS51cmwsIGFzc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIGFuIGFzc2V0IGZyb20gdGhlIHJlZ2lzdHJ5IGJ5IGl0cyBpZCBmaWVsZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIFRoZSBpZCBvZiB0aGUgYXNzZXQgdG8gZ2V0LlxuICAgICAqIEByZXR1cm5zIHtBc3NldHx1bmRlZmluZWR9IFRoZSBhc3NldC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoMTAwKTtcbiAgICAgKi9cbiAgICBnZXQoaWQpIHtcbiAgICAgICAgLy8gU2luY2Ugc29tZSBhcHBzIGluY29ycmVjdGx5IHBhc3MgdGhlIGlkIGFzIGEgc3RyaW5nLCBmb3JjZSBhIGNvbnZlcnNpb24gdG8gYSBudW1iZXJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkVG9Bc3NldC5nZXQoTnVtYmVyKGlkKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYW4gYXNzZXQgZnJvbSB0aGUgcmVnaXN0cnkgYnkgaXRzIGZpbGUncyBVUkwgZmllbGQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIHVybCBvZiB0aGUgYXNzZXQgdG8gZ2V0LlxuICAgICAqIEByZXR1cm5zIHtBc3NldHx1bmRlZmluZWR9IFRoZSBhc3NldC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXRCeVVybChcIi4uL3BhdGgvdG8vaW1hZ2UuanBnXCIpO1xuICAgICAqL1xuICAgIGdldEJ5VXJsKHVybCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXJsVG9Bc3NldC5nZXQodXJsKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIHRoZSBhc3NldCdzIGZpbGUgZnJvbSBhIHJlbW90ZSBzb3VyY2UuIExpc3RlbiBmb3IgXCJsb2FkXCIgZXZlbnRzIG9uIHRoZSBhc3NldCB0byBmaW5kXG4gICAgICogb3V0IHdoZW4gaXQgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdG8gbG9hZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgc29tZSBhc3NldHNcbiAgICAgKiBjb25zdCBhc3NldHNUb0xvYWQgPSBbXG4gICAgICogICAgIGFwcC5hc3NldHMuZmluZChcIk15IEFzc2V0XCIpLFxuICAgICAqICAgICBhcHAuYXNzZXRzLmZpbmQoXCJBbm90aGVyIEFzc2V0XCIpXG4gICAgICogXTtcbiAgICAgKiBsZXQgY291bnQgPSAwO1xuICAgICAqIGFzc2V0c1RvTG9hZC5mb3JFYWNoKGZ1bmN0aW9uIChhc3NldFRvTG9hZCkge1xuICAgICAqICAgICBhc3NldFRvTG9hZC5yZWFkeShmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgICAgIGNvdW50Kys7XG4gICAgICogICAgICAgICBpZiAoY291bnQgPT09IGFzc2V0c1RvTG9hZC5sZW5ndGgpIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBkb25lXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAuYXNzZXRzLmxvYWQoYXNzZXRUb0xvYWQpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWQoYXNzZXQpIHtcbiAgICAgICAgLy8gZG8gbm90aGluZyBpZiBhc3NldCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICAvLyBub3RlOiBsb3RzIG9mIGNvZGUgY2FsbHMgYXNzZXRzLmxvYWQoKSBhc3N1bWluZyB0aGlzIGNoZWNrIGlzIHByZXNlbnRcbiAgICAgICAgLy8gZG9uJ3QgcmVtb3ZlIGl0IHdpdGhvdXQgdXBkYXRpbmcgY2FsbHMgdG8gYXNzZXRzLmxvYWQoKSB3aXRoIGNoZWNrcyBmb3IgdGhlIGFzc2V0LmxvYWRlZCBzdGF0ZVxuICAgICAgICBpZiAoYXNzZXQubG9hZGluZyB8fCBhc3NldC5sb2FkZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGUgPSBhc3NldC5maWxlO1xuXG4gICAgICAgIC8vIG9wZW4gaGFzIGNvbXBsZXRlZCBvbiB0aGUgcmVzb3VyY2VcbiAgICAgICAgY29uc3QgX29wZW5lZCA9IChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZXNvdXJjZXMgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXQucmVzb3VyY2UgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGV0IGhhbmRsZXIgcGF0Y2ggdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIucGF0Y2goYXNzZXQsIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLnVybClcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6dXJsOicgKyBmaWxlLnVybCwgYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXQuZmlyZSgnbG9hZCcsIGFzc2V0KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBsb2FkIGhhcyBjb21wbGV0ZWQgb24gdGhlIHJlc291cmNlXG4gICAgICAgIGNvbnN0IF9sb2FkZWQgPSAoZXJyLCByZXNvdXJjZSwgZXh0cmEpID0+IHtcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICBhc3NldC5sb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcjonICsgYXNzZXQuaWQsIGVyciwgYXNzZXQpO1xuICAgICAgICAgICAgICAgIGFzc2V0LmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSAmJiBhc3NldC50eXBlID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fbG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdICYmIGhhbmRsZXIuX2NhY2hlW2Fzc2V0LmlkXS5wYXJlbnROb2RlID09PSBkb2N1bWVudC5oZWFkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgb2xkIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyLl9jYWNoZVthc3NldC5pZF0gPSBleHRyYTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBfb3BlbmVkKHJlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZmlsZSB8fCBhc3NldC50eXBlID09PSAnY3ViZW1hcCcpIHtcbiAgICAgICAgICAgIC8vIHN0YXJ0IGxvYWRpbmcgdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6c3RhcnQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkICsgJzpzdGFydCcsIGFzc2V0KTtcblxuICAgICAgICAgICAgYXNzZXQubG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIubG9hZChhc3NldC5nZXRGaWxlVXJsKCksIGFzc2V0LnR5cGUsIF9sb2FkZWQsIGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGhhcyBubyBmaWxlIHRvIGxvYWQsIG9wZW4gaXQgZGlyZWN0bHlcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gdGhpcy5fbG9hZGVyLm9wZW4oYXNzZXQudHlwZSwgYXNzZXQuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgX29wZW5lZChyZXNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2UgdGhpcyB0byBsb2FkIGFuZCBjcmVhdGUgYW4gYXNzZXQgaWYgeW91IGRvbid0IGhhdmUgYXNzZXRzIGNyZWF0ZWQuIFVzdWFsbHkgeW91IHdvdWxkXG4gICAgICogb25seSB1c2UgdGhpcyBpZiB5b3UgYXJlIG5vdCBpbnRlZ3JhdGVkIHdpdGggdGhlIFBsYXlDYW52YXMgRWRpdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtMb2FkQXNzZXRDYWxsYmFja30gY2FsbGJhY2sgLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiBhc3NldCBpcyBsb2FkZWQsIHBhc3NlZCAoZXJyLFxuICAgICAqIGFzc2V0KSwgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwiLi4vcGF0aC90by90ZXh0dXJlLmpwZ1wiLCBcInRleHR1cmVcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc3QgdGV4dHVyZSA9IGFzc2V0LnJlc291cmNlO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWRGcm9tVXJsKHVybCwgdHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5sb2FkRnJvbVVybEFuZEZpbGVuYW1lKHVybCwgbnVsbCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZSB0aGlzIHRvIGxvYWQgYW5kIGNyZWF0ZSBhbiBhc3NldCB3aGVuIGJvdGggdGhlIFVSTCBhbmQgZmlsZW5hbWUgYXJlIHJlcXVpcmVkLiBGb3JcbiAgICAgKiBleGFtcGxlLCB1c2UgdGhpcyBmdW5jdGlvbiB3aGVuIGxvYWRpbmcgQkxPQiBhc3NldHMsIHdoZXJlIHRoZSBVUkwgZG9lcyBub3QgYWRlcXVhdGVseVxuICAgICAqIGlkZW50aWZ5IHRoZSBmaWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZW5hbWUgLSBUaGUgZmlsZW5hbWUgb2YgdGhlIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgdHlwZSBvZiBhc3NldCB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7TG9hZEFzc2V0Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gYXNzZXQgaXMgbG9hZGVkLCBwYXNzZWQgKGVycixcbiAgICAgKiBhc3NldCksIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZmlsZSA9IG1hZ2ljYWxseU9idGFpbkFGaWxlKCk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybEFuZEZpbGVuYW1lKFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZSksIFwidGV4dHVyZS5wbmdcIiwgXCJ0ZXh0dXJlXCIsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnN0IHRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkRnJvbVVybEFuZEZpbGVuYW1lKHVybCwgZmlsZW5hbWUsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmdldEJhc2VuYW1lKGZpbGVuYW1lIHx8IHVybCk7XG5cbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZSB8fCBuYW1lLFxuICAgICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgYXNzZXQgPSB0aGlzLmdldEJ5VXJsKHVybCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIGFzc2V0ID0gbmV3IEFzc2V0KG5hbWUsIHR5cGUsIGZpbGUpO1xuICAgICAgICAgICAgdGhpcy5hZGQoYXNzZXQpO1xuICAgICAgICB9IGVsc2UgaWYgKGFzc2V0LmxvYWRlZCkge1xuICAgICAgICAgICAgLy8gYXNzZXQgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgICAgIGNhbGxiYWNrKGFzc2V0LmxvYWRGcm9tVXJsRXJyb3IgfHwgbnVsbCwgYXNzZXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhcnRMb2FkID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgKGxvYWRlZEFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdtYXRlcmlhbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZFRleHR1cmVzKGxvYWRlZEFzc2V0LCAoZXJyLCB0ZXh0dXJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBsb2FkZWRBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGxvYWRlZEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBlcnJvciBvbiB0aGUgYXNzZXQgaW4gY2FzZSB1c2VyIHJlcXVlc3RzIHRoaXMgYXNzZXQgYWdhaW5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZEZyb21VcmxFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMubG9hZChhc3NldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBhc3NldCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ21vZGVsJykge1xuICAgICAgICAgICAgdGhpcy5fbG9hZE1vZGVsKGFzc2V0LCBzdGFydExvYWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRMb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgZGF0YVxuICAgIF9sb2FkTW9kZWwobW9kZWxBc3NldCwgY29udGludWF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0RmlsZVVybCgpO1xuICAgICAgICBjb25zdCBleHQgPSBwYXRoLmdldEV4dGVuc2lvbih1cmwpO1xuXG4gICAgICAgIGlmIChleHQgPT09ICcuanNvbicgfHwgZXh0ID09PSAnLmdsYicpIHtcbiAgICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZ2V0RGlyZWN0b3J5KHVybCk7XG4gICAgICAgICAgICBjb25zdCBiYXNlbmFtZSA9IHBhdGguZ2V0QmFzZW5hbWUodXJsKTtcblxuICAgICAgICAgICAgLy8gUGxheUNhbnZhcyBtb2RlbCBmb3JtYXQgc3VwcG9ydHMgbWF0ZXJpYWwgbWFwcGluZyBmaWxlXG4gICAgICAgICAgICBjb25zdCBtYXBwaW5nVXJsID0gcGF0aC5qb2luKGRpciwgYmFzZW5hbWUucmVwbGFjZShleHQsICcubWFwcGluZy5qc29uJykpO1xuICAgICAgICAgICAgdGhpcy5fbG9hZGVyLmxvYWQobWFwcGluZ1VybCwgJ2pzb24nLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEFzc2V0LmRhdGEgPSB7IG1hcHBpbmc6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkTWF0ZXJpYWxzKG1vZGVsQXNzZXQsIGRhdGEsIChlLCBtYXRlcmlhbHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsQXNzZXQuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51YXRpb24obW9kZWxBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb3RoZXIgbW9kZWwgZm9ybWF0IChlLmcuIG9iailcbiAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgbWF0ZXJpYWxzXG4gICAgX2xvYWRNYXRlcmlhbHMobW9kZWxBc3NldCwgbWFwcGluZywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gW107XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgY29uc3Qgb25NYXRlcmlhbExvYWRlZCA9IChlcnIsIG1hdGVyaWFsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIC8vIGxvYWQgZGVwZW5kZW50IHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLl9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgKGVyciwgdGV4dHVyZXMpID0+IHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbWF0ZXJpYWxzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1hcHBpbmcubWFwcGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IG1hcHBpbmcubWFwcGluZ1tpXS5wYXRoO1xuICAgICAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0QWJzb2x1dGVVcmwocGF0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkRnJvbVVybCh1cmwsICdtYXRlcmlhbCcsIG9uTWF0ZXJpYWxMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBtYXRlcmlhbHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJpdmF0ZSBtZXRob2QgdXNlZCBmb3IgZW5naW5lLW9ubHkgbG9hZGluZyBvZiB0aGUgdGV4dHVyZXMgcmVmZXJlbmNlZCBieVxuICAgIC8vIHRoZSBtYXRlcmlhbCBhc3NldFxuICAgIF9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBbXTtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICBjb25zdCBkYXRhID0gbWF0ZXJpYWxBc3NldC5kYXRhO1xuICAgICAgICBpZiAoZGF0YS5tYXBwaW5nRm9ybWF0ICE9PSAncGF0aCcpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFNraXBwaW5nOiAke21hdGVyaWFsQXNzZXQubmFtZX0sIG1hdGVyaWFsIGZpbGVzIG11c3QgYmUgbWFwcGluZ0Zvcm1hdDogXCJwYXRoXCIgdG8gYmUgbG9hZGVkIGZyb20gVVJMYCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvblRleHR1cmVMb2FkZWQgPSAoZXJyLCB0ZXh0dXJlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICB0ZXh0dXJlcy5wdXNoKHRleHR1cmUpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdGV4UGFyYW1zID0gc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleFBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGRhdGFbdGV4UGFyYW1zW2ldXTtcbiAgICAgICAgICAgIGlmIChwYXRoICYmIHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gbWF0ZXJpYWxBc3NldC5nZXRBYnNvbHV0ZVVybChwYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRGcm9tVXJsKHVybCwgJ3RleHR1cmUnLCBvblRleHR1cmVMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25UYWdBZGQodGFnLCBhc3NldCkge1xuICAgICAgICB0aGlzLl90YWdzLmFkZCh0YWcsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25UYWdSZW1vdmUodGFnLCBhc3NldCkge1xuICAgICAgICB0aGlzLl90YWdzLnJlbW92ZSh0YWcsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25OYW1lQ2hhbmdlKGFzc2V0LCBuYW1lLCBuYW1lT2xkKSB7XG4gICAgICAgIC8vIHJlbW92ZVxuICAgICAgICBpZiAodGhpcy5fbmFtZVRvQXNzZXQuaGFzKG5hbWVPbGQpKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuX25hbWVUb0Fzc2V0LmdldChuYW1lT2xkKTtcbiAgICAgICAgICAgIGl0ZW1zLmRlbGV0ZShhc3NldCk7XG4gICAgICAgICAgICBpZiAoaXRlbXMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX25hbWVUb0Fzc2V0LmRlbGV0ZShuYW1lT2xkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZFxuICAgICAgICBpZiAoIXRoaXMuX25hbWVUb0Fzc2V0Lmhhcyhhc3NldC5uYW1lKSlcbiAgICAgICAgICAgIHRoaXMuX25hbWVUb0Fzc2V0LnNldChhc3NldC5uYW1lLCBuZXcgU2V0KCkpO1xuXG4gICAgICAgIHRoaXMuX25hbWVUb0Fzc2V0LmdldChhc3NldC5uYW1lKS5hZGQoYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgQXNzZXRzIHRoYXQgc2F0aXNmeSB0aGUgc2VhcmNoIHF1ZXJ5LiBRdWVyeSBjYW4gYmUgc2ltcGx5IGEgc3RyaW5nLCBvciBjb21tYVxuICAgICAqIHNlcGFyYXRlZCBzdHJpbmdzLCB0byBoYXZlIGluY2x1c2l2ZSByZXN1bHRzIG9mIGFzc2V0cyB0aGF0IG1hdGNoIGF0IGxlYXN0IG9uZSBxdWVyeS4gQVxuICAgICAqIHF1ZXJ5IHRoYXQgY29uc2lzdHMgb2YgYW4gYXJyYXkgb2YgdGFncyBjYW4gYmUgdXNlZCB0byBtYXRjaCBhc3NldHMgdGhhdCBoYXZlIGVhY2ggdGFnIG9mXG4gICAgICogYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLip9IHF1ZXJ5IC0gTmFtZSBvZiBhIHRhZyBvciBhcnJheSBvZiB0YWdzLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBBIGxpc3Qgb2YgYWxsIEFzc2V0cyBtYXRjaGVkIHF1ZXJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXRzID0gYXBwLmFzc2V0cy5maW5kQnlUYWcoXCJsZXZlbC0xXCIpO1xuICAgICAqIC8vIHJldHVybnMgYWxsIGFzc2V0cyB0aGF0IHRhZ2dlZCBieSBgbGV2ZWwtMWBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFwibGV2ZWwtMVwiLCBcImxldmVsLTJcIik7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBsZXZlbC0xYCBPUiBgbGV2ZWwtMmBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFtcImxldmVsLTFcIiwgXCJtb25zdGVyXCJdKTtcbiAgICAgKiAvLyByZXR1cm5zIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGxldmVsLTFgIEFORCBgbW9uc3RlcmBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFtcImxldmVsLTFcIiwgXCJtb25zdGVyXCJdLCBbXCJsZXZlbC0yXCIsIFwibW9uc3RlclwiXSk7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IChgbGV2ZWwtMWAgQU5EIGBtb25zdGVyYCkgT1IgKGBsZXZlbC0yYCBBTkQgYG1vbnN0ZXJgKVxuICAgICAqL1xuICAgIGZpbmRCeVRhZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RhZ3MuZmluZChhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgQXNzZXRzIHRoYXQgc2F0aXNmeSBhIGZpbHRlciBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyQXNzZXRDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIHRvIGZpbHRlciBhc3NldHMuXG4gICAgICogUmV0dXJuIGB0cnVlYCB0byBpbmNsdWRlIGFuIGFzc2V0IGluIHRoZSByZXR1cm5lZCBhcnJheS5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXRbXX0gQSBsaXN0IG9mIGFsbCBBc3NldHMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbHRlcihhc3NldCA9PiBhc3NldC5uYW1lLmluY2x1ZGVzKCdtb25zdGVyJykpO1xuICAgICAqIGNvbnNvbGUubG9nKGBGb3VuZCAke2Fzc2V0cy5sZW5ndGh9IGFzc2V0cyB3aXRoIGEgbmFtZSBjb250YWluaW5nICdtb25zdGVyJ2ApO1xuICAgICAqL1xuICAgIGZpbHRlcihjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9hc3NldHMpLmZpbHRlcihhc3NldCA9PiBjYWxsYmFjayhhc3NldCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlyc3QgQXNzZXQgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgYW5kIHR5cGUgZm91bmQgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgQXNzZXQgdG8gZmluZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGVdIC0gVGhlIHR5cGUgb2YgdGhlIEFzc2V0IHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fG51bGx9IEEgc2luZ2xlIEFzc2V0IG9yIG51bGwgaWYgbm8gQXNzZXQgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZmluZChcIm15VGV4dHVyZUFzc2V0XCIsIFwidGV4dHVyZVwiKTtcbiAgICAgKi9cbiAgICBmaW5kKG5hbWUsIHR5cGUpIHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLl9uYW1lVG9Bc3NldC5nZXQobmFtZSk7XG4gICAgICAgIGlmICghaXRlbXMpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgaXRlbXMpIHtcbiAgICAgICAgICAgIGlmICghdHlwZSB8fCBhc3NldC50eXBlID09PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFzc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBBc3NldHMgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgYW5kIHR5cGUgZm91bmQgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgQXNzZXRzIHRvIGZpbmQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlXSAtIFRoZSB0eXBlIG9mIHRoZSBBc3NldHMgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXRbXX0gQSBsaXN0IG9mIGFsbCBBc3NldHMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbmRBbGwoJ2JyaWNrJywgJ3RleHR1cmUnKTtcbiAgICAgKiBjb25zb2xlLmxvZyhgRm91bmQgJHthc3NldHMubGVuZ3RofSB0ZXh0dXJlIGFzc2V0cyBuYW1lZCAnYnJpY2snYCk7XG4gICAgICovXG4gICAgZmluZEFsbChuYW1lLCB0eXBlKSB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5fbmFtZVRvQXNzZXQuZ2V0KG5hbWUpO1xuICAgICAgICBpZiAoIWl0ZW1zKSByZXR1cm4gW107XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICAgICAgaWYgKCF0eXBlKSByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgcmV0dXJuIHJlc3VsdHMuZmlsdGVyKGFzc2V0ID0+IGFzc2V0LnR5cGUgPT09IHR5cGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQXNzZXRSZWdpc3RyeSB9O1xuIl0sIm5hbWVzIjpbIkFzc2V0UmVnaXN0cnkiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImxvYWRlciIsIl9hc3NldHMiLCJTZXQiLCJfaWRUb0Fzc2V0IiwiTWFwIiwiX3VybFRvQXNzZXQiLCJfbmFtZVRvQXNzZXQiLCJfdGFncyIsIlRhZ3NDYWNoZSIsInByZWZpeCIsIl9sb2FkZXIiLCJsaXN0IiwiZmlsdGVycyIsImFzc2V0cyIsIkFycmF5IiwiZnJvbSIsInByZWxvYWQiLCJ1bmRlZmluZWQiLCJmaWx0ZXIiLCJhc3NldCIsImFkZCIsIl9hc3NldCRmaWxlIiwiX2Fzc2V0JGZpbGUyIiwiaGFzIiwic2V0IiwiaWQiLCJmaWxlIiwidXJsIiwibmFtZSIsImdldCIsIm9uIiwiX29uTmFtZUNoYW5nZSIsInJlZ2lzdHJ5IiwiYWRkSXRlbSIsInRhZ3MiLCJfb25UYWdBZGQiLCJfb25UYWdSZW1vdmUiLCJmaXJlIiwibG9hZCIsInJlbW92ZSIsIl9hc3NldCRmaWxlMyIsIl9hc3NldCRmaWxlNCIsImRlbGV0ZSIsIm9mZiIsIml0ZW1zIiwic2l6ZSIsInJlbW92ZUl0ZW0iLCJOdW1iZXIiLCJnZXRCeVVybCIsImxvYWRpbmciLCJsb2FkZWQiLCJfb3BlbmVkIiwicmVzb3VyY2UiLCJyZXNvdXJjZXMiLCJwYXRjaCIsIl9sb2FkZWQiLCJlcnIiLCJleHRyYSIsInNjcmlwdCIsImxlZ2FjeSIsInR5cGUiLCJoYW5kbGVyIiwiZ2V0SGFuZGxlciIsIl9jYWNoZSIsInBhcmVudE5vZGUiLCJkb2N1bWVudCIsImhlYWQiLCJyZW1vdmVDaGlsZCIsImdldEZpbGVVcmwiLCJvcGVuIiwiZGF0YSIsImxvYWRGcm9tVXJsIiwiY2FsbGJhY2siLCJsb2FkRnJvbVVybEFuZEZpbGVuYW1lIiwiZmlsZW5hbWUiLCJwYXRoIiwiZ2V0QmFzZW5hbWUiLCJBc3NldCIsImxvYWRGcm9tVXJsRXJyb3IiLCJzdGFydExvYWQiLCJvbmNlIiwibG9hZGVkQXNzZXQiLCJfbG9hZFRleHR1cmVzIiwidGV4dHVyZXMiLCJfbG9hZE1vZGVsIiwibW9kZWxBc3NldCIsImNvbnRpbnVhdGlvbiIsImV4dCIsImdldEV4dGVuc2lvbiIsImRpciIsImdldERpcmVjdG9yeSIsImJhc2VuYW1lIiwibWFwcGluZ1VybCIsImpvaW4iLCJyZXBsYWNlIiwibWFwcGluZyIsIl9sb2FkTWF0ZXJpYWxzIiwiZSIsIm1hdGVyaWFscyIsImNvdW50Iiwib25NYXRlcmlhbExvYWRlZCIsIm1hdGVyaWFsQXNzZXQiLCJwdXNoIiwibGVuZ3RoIiwiaSIsImdldEFic29sdXRlVXJsIiwibWFwcGluZ0Zvcm1hdCIsIkRlYnVnIiwid2FybiIsIm9uVGV4dHVyZUxvYWRlZCIsInRleHR1cmUiLCJjb25zb2xlIiwiZXJyb3IiLCJ0ZXhQYXJhbXMiLCJzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnMiLCJ0YWciLCJuYW1lT2xkIiwiZmluZEJ5VGFnIiwiZmluZCIsImFyZ3VtZW50cyIsImZpbmRBbGwiLCJyZXN1bHRzIiwiRVZFTlRfTE9BRCIsIkVWRU5UX0FERCIsIkVWRU5UX1JFTU9WRSIsIkVWRU5UX0VSUk9SIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FB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
