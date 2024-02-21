// wrapper function that caches the func result on first invocation and
// then subsequently returns the cached value
const cachedResult = func => {
  const uninitToken = {};
  let result = uninitToken;
  return () => {
    if (result === uninitToken) {
      result = func();
    }
    return result;
  };
};
class Impl {
  // load a script
  static loadScript(url, callback) {
    const s = document.createElement('script');
    s.setAttribute('src', url);
    s.onload = () => {
      callback(null);
    };
    s.onerror = () => {
      callback(`Failed to load script='${url}'`);
    };
    document.body.appendChild(s);
  }

  // load a wasm module
  static loadWasm(moduleName, config, callback) {
    const loadUrl = Impl.wasmSupported() && config.glueUrl && config.wasmUrl ? config.glueUrl : config.fallbackUrl;
    if (loadUrl) {
      Impl.loadScript(loadUrl, err => {
        if (err) {
          callback(err, null);
        } else {
          const module = window[moduleName];

          // clear the module from the global window since we used to store global instance here
          window[moduleName] = undefined;

          // instantiate the module
          module({
            locateFile: () => config.wasmUrl,
            onAbort: () => {
              callback('wasm module aborted.');
            }
          }).then(instance => {
            callback(null, instance);
          });
        }
      });
    } else {
      callback('No supported wasm modules found.', null);
    }
  }

  // get state object for the named module
  static getModule(name) {
    if (!Impl.modules.hasOwnProperty(name)) {
      Impl.modules[name] = {
        config: null,
        initializing: false,
        instance: null,
        callbacks: []
      };
    }
    return Impl.modules[name];
  }
  static initialize(moduleName, module) {
    if (module.initializing) {
      return;
    }
    const config = module.config;
    if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
      module.initializing = true;
      Impl.loadWasm(moduleName, config, (err, instance) => {
        if (err) {
          if (config.errorHandler) {
            config.errorHandler(err);
          } else {
            console.error(`failed to initialize module=${moduleName} error=${err}`);
          }
        } else {
          module.instance = instance;
          module.callbacks.forEach(callback => {
            callback(instance);
          });
        }
      });
    }
  }
}

/**
 * Callback used by {@link Module#setConfig}.
 *
 * @callback ModuleErrorCallback
 * @param {string} error - If the instance fails to load this will contain a description of the error.
 */

/**
 * Callback used by {@link Module#getInstance}.
 *
 * @callback ModuleInstanceCallback
 * @param {any} moduleInstance - The module instance.
 */

/**
 * A pure static utility class which supports immediate and lazy loading of wasm modules.
 */
Impl.modules = {};
// returns true if the running host supports wasm modules (all browsers except IE)
Impl.wasmSupported = cachedResult(() => {
  try {
    if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (module instanceof WebAssembly.Module) return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
    }
  } catch (e) {}
  return false;
});
class WasmModule {
  /**
   * Set a wasm module's configuration.
   *
   * @param {string} moduleName - Name of the module.
   * @param {object} [config] - The configuration object.
   * @param {string} [config.glueUrl] - URL of glue script.
   * @param {string} [config.wasmUrl] - URL of the wasm script.
   * @param {string} [config.fallbackUrl] - URL of the fallback script to use when wasm modules
   * aren't supported.
   * @param {number} [config.numWorkers] - For modules running on worker threads, the number of
   * threads to use. Default value is based on module implementation.
   * @param {ModuleErrorCallback} [config.errorHandler] - Function to be called if the module fails
   * to download.
   */
  static setConfig(moduleName, config) {
    const module = Impl.getModule(moduleName);
    module.config = config;
    if (module.callbacks.length > 0) {
      // start module initialize immediately since there are pending getInstance requests
      Impl.initialize(moduleName, module);
    }
  }

  /**
   * Get a wasm module's configuration.
   *
   * @param {string} moduleName - Name of the module.
   * @returns {object | undefined} The previously set configuration.
   */
  static getConfig(moduleName) {
    var _Impl$modules;
    return (_Impl$modules = Impl.modules) == null || (_Impl$modules = _Impl$modules[moduleName]) == null ? void 0 : _Impl$modules.config;
  }

  /**
   * Get a wasm module instance. The instance will be created if necessary and returned
   * in the second parameter to callback.
   *
   * @param {string} moduleName - Name of the module.
   * @param {ModuleInstanceCallback} callback - The function called when the instance is
   * available.
   */
  static getInstance(moduleName, callback) {
    const module = Impl.getModule(moduleName);
    if (module.instance) {
      callback(module.instance);
    } else {
      module.callbacks.push(callback);
      if (module.config) {
        // config has been provided, kick off module initialize
        Impl.initialize(moduleName, module);
      }
    }
  }
}

export { WasmModule };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FzbS1tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9jb3JlL3dhc20tbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHdyYXBwZXIgZnVuY3Rpb24gdGhhdCBjYWNoZXMgdGhlIGZ1bmMgcmVzdWx0IG9uIGZpcnN0IGludm9jYXRpb24gYW5kXG4vLyB0aGVuIHN1YnNlcXVlbnRseSByZXR1cm5zIHRoZSBjYWNoZWQgdmFsdWVcbmNvbnN0IGNhY2hlZFJlc3VsdCA9IChmdW5jKSA9PiB7XG4gICAgY29uc3QgdW5pbml0VG9rZW4gPSB7fTtcbiAgICBsZXQgcmVzdWx0ID0gdW5pbml0VG9rZW47XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5pbml0VG9rZW4pIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG59O1xuXG5jbGFzcyBJbXBsIHtcbiAgICBzdGF0aWMgbW9kdWxlcyA9IHt9O1xuXG4gICAgLy8gcmV0dXJucyB0cnVlIGlmIHRoZSBydW5uaW5nIGhvc3Qgc3VwcG9ydHMgd2FzbSBtb2R1bGVzIChhbGwgYnJvd3NlcnMgZXhjZXB0IElFKVxuICAgIHN0YXRpYyB3YXNtU3VwcG9ydGVkID0gY2FjaGVkUmVzdWx0KCgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb2R1bGUgPSBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKFVpbnQ4QXJyYXkub2YoMHgwLCAweDYxLCAweDczLCAweDZkLCAweDAxLCAweDAwLCAweDAwLCAweDAwKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1vZHVsZSBpbnN0YW5jZW9mIFdlYkFzc2VtYmx5Lk1vZHVsZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBXZWJBc3NlbWJseS5JbnN0YW5jZShtb2R1bGUpIGluc3RhbmNlb2YgV2ViQXNzZW1ibHkuSW5zdGFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBsb2FkIGEgc2NyaXB0XG4gICAgc3RhdGljIGxvYWRTY3JpcHQodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgIHMuc2V0QXR0cmlidXRlKCdzcmMnLCB1cmwpO1xuICAgICAgICBzLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9O1xuICAgICAgICBzLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFjayhgRmFpbGVkIHRvIGxvYWQgc2NyaXB0PScke3VybH0nYCk7XG4gICAgICAgIH07XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocyk7XG4gICAgfVxuXG4gICAgLy8gbG9hZCBhIHdhc20gbW9kdWxlXG4gICAgc3RhdGljIGxvYWRXYXNtKG1vZHVsZU5hbWUsIGNvbmZpZywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbG9hZFVybCA9IChJbXBsLndhc21TdXBwb3J0ZWQoKSAmJiBjb25maWcuZ2x1ZVVybCAmJiBjb25maWcud2FzbVVybCkgPyBjb25maWcuZ2x1ZVVybCA6IGNvbmZpZy5mYWxsYmFja1VybDtcbiAgICAgICAgaWYgKGxvYWRVcmwpIHtcbiAgICAgICAgICAgIEltcGwubG9hZFNjcmlwdChsb2FkVXJsLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IHdpbmRvd1ttb2R1bGVOYW1lXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciB0aGUgbW9kdWxlIGZyb20gdGhlIGdsb2JhbCB3aW5kb3cgc2luY2Ugd2UgdXNlZCB0byBzdG9yZSBnbG9iYWwgaW5zdGFuY2UgaGVyZVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3dbbW9kdWxlTmFtZV0gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFudGlhdGUgdGhlIG1vZHVsZVxuICAgICAgICAgICAgICAgICAgICBtb2R1bGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRlRmlsZTogKCkgPT4gY29uZmlnLndhc21VcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFib3J0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soJ3dhc20gbW9kdWxlIGFib3J0ZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soJ05vIHN1cHBvcnRlZCB3YXNtIG1vZHVsZXMgZm91bmQuJywgbnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBnZXQgc3RhdGUgb2JqZWN0IGZvciB0aGUgbmFtZWQgbW9kdWxlXG4gICAgc3RhdGljIGdldE1vZHVsZShuYW1lKSB7XG4gICAgICAgIGlmICghSW1wbC5tb2R1bGVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBJbXBsLm1vZHVsZXNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY29uZmlnOiBudWxsLFxuICAgICAgICAgICAgICAgIGluaXRpYWxpemluZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW5zdGFuY2U6IG51bGwsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSW1wbC5tb2R1bGVzW25hbWVdO1xuICAgIH1cblxuICAgIHN0YXRpYyBpbml0aWFsaXplKG1vZHVsZU5hbWUsIG1vZHVsZSkge1xuICAgICAgICBpZiAobW9kdWxlLmluaXRpYWxpemluZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29uZmlnID0gbW9kdWxlLmNvbmZpZztcblxuICAgICAgICBpZiAoY29uZmlnLmdsdWVVcmwgfHwgY29uZmlnLndhc21VcmwgfHwgY29uZmlnLmZhbGxiYWNrVXJsKSB7XG4gICAgICAgICAgICBtb2R1bGUuaW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIEltcGwubG9hZFdhc20obW9kdWxlTmFtZSwgY29uZmlnLCAoZXJyLCBpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5lcnJvckhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5lcnJvckhhbmRsZXIoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGZhaWxlZCB0byBpbml0aWFsaXplIG1vZHVsZT0ke21vZHVsZU5hbWV9IGVycm9yPSR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kdWxlLmluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIG1vZHVsZS5jYWxsYmFja3MuZm9yRWFjaCgoY2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTW9kdWxlI3NldENvbmZpZ30uXG4gKlxuICogQGNhbGxiYWNrIE1vZHVsZUVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfSBlcnJvciAtIElmIHRoZSBpbnN0YW5jZSBmYWlscyB0byBsb2FkIHRoaXMgd2lsbCBjb250YWluIGEgZGVzY3JpcHRpb24gb2YgdGhlIGVycm9yLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTW9kdWxlI2dldEluc3RhbmNlfS5cbiAqXG4gKiBAY2FsbGJhY2sgTW9kdWxlSW5zdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHthbnl9IG1vZHVsZUluc3RhbmNlIC0gVGhlIG1vZHVsZSBpbnN0YW5jZS5cbiAqL1xuXG4vKipcbiAqIEEgcHVyZSBzdGF0aWMgdXRpbGl0eSBjbGFzcyB3aGljaCBzdXBwb3J0cyBpbW1lZGlhdGUgYW5kIGxhenkgbG9hZGluZyBvZiB3YXNtIG1vZHVsZXMuXG4gKi9cbmNsYXNzIFdhc21Nb2R1bGUge1xuICAgIC8qKlxuICAgICAqIFNldCBhIHdhc20gbW9kdWxlJ3MgY29uZmlndXJhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2R1bGVOYW1lIC0gTmFtZSBvZiB0aGUgbW9kdWxlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29uZmlnXSAtIFRoZSBjb25maWd1cmF0aW9uIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2NvbmZpZy5nbHVlVXJsXSAtIFVSTCBvZiBnbHVlIHNjcmlwdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2NvbmZpZy53YXNtVXJsXSAtIFVSTCBvZiB0aGUgd2FzbSBzY3JpcHQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtjb25maWcuZmFsbGJhY2tVcmxdIC0gVVJMIG9mIHRoZSBmYWxsYmFjayBzY3JpcHQgdG8gdXNlIHdoZW4gd2FzbSBtb2R1bGVzXG4gICAgICogYXJlbid0IHN1cHBvcnRlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbmZpZy5udW1Xb3JrZXJzXSAtIEZvciBtb2R1bGVzIHJ1bm5pbmcgb24gd29ya2VyIHRocmVhZHMsIHRoZSBudW1iZXIgb2ZcbiAgICAgKiB0aHJlYWRzIHRvIHVzZS4gRGVmYXVsdCB2YWx1ZSBpcyBiYXNlZCBvbiBtb2R1bGUgaW1wbGVtZW50YXRpb24uXG4gICAgICogQHBhcmFtIHtNb2R1bGVFcnJvckNhbGxiYWNrfSBbY29uZmlnLmVycm9ySGFuZGxlcl0gLSBGdW5jdGlvbiB0byBiZSBjYWxsZWQgaWYgdGhlIG1vZHVsZSBmYWlsc1xuICAgICAqIHRvIGRvd25sb2FkLlxuICAgICAqL1xuICAgIHN0YXRpYyBzZXRDb25maWcobW9kdWxlTmFtZSwgY29uZmlnKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZSA9IEltcGwuZ2V0TW9kdWxlKG1vZHVsZU5hbWUpO1xuICAgICAgICBtb2R1bGUuY29uZmlnID0gY29uZmlnO1xuICAgICAgICBpZiAobW9kdWxlLmNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBzdGFydCBtb2R1bGUgaW5pdGlhbGl6ZSBpbW1lZGlhdGVseSBzaW5jZSB0aGVyZSBhcmUgcGVuZGluZyBnZXRJbnN0YW5jZSByZXF1ZXN0c1xuICAgICAgICAgICAgSW1wbC5pbml0aWFsaXplKG1vZHVsZU5hbWUsIG1vZHVsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSB3YXNtIG1vZHVsZSdzIGNvbmZpZ3VyYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kdWxlTmFtZSAtIE5hbWUgb2YgdGhlIG1vZHVsZS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0IHwgdW5kZWZpbmVkfSBUaGUgcHJldmlvdXNseSBzZXQgY29uZmlndXJhdGlvbi5cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0Q29uZmlnKG1vZHVsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIEltcGwubW9kdWxlcz8uW21vZHVsZU5hbWVdPy5jb25maWc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgd2FzbSBtb2R1bGUgaW5zdGFuY2UuIFRoZSBpbnN0YW5jZSB3aWxsIGJlIGNyZWF0ZWQgaWYgbmVjZXNzYXJ5IGFuZCByZXR1cm5lZFxuICAgICAqIGluIHRoZSBzZWNvbmQgcGFyYW1ldGVyIHRvIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1vZHVsZU5hbWUgLSBOYW1lIG9mIHRoZSBtb2R1bGUuXG4gICAgICogQHBhcmFtIHtNb2R1bGVJbnN0YW5jZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXNcbiAgICAgKiBhdmFpbGFibGUuXG4gICAgICovXG4gICAgc3RhdGljIGdldEluc3RhbmNlKG1vZHVsZU5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZSA9IEltcGwuZ2V0TW9kdWxlKG1vZHVsZU5hbWUpO1xuXG4gICAgICAgIGlmIChtb2R1bGUuaW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG1vZHVsZS5pbnN0YW5jZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtb2R1bGUuY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKG1vZHVsZS5jb25maWcpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25maWcgaGFzIGJlZW4gcHJvdmlkZWQsIGtpY2sgb2ZmIG1vZHVsZSBpbml0aWFsaXplXG4gICAgICAgICAgICAgICAgSW1wbC5pbml0aWFsaXplKG1vZHVsZU5hbWUsIG1vZHVsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7XG4gICAgV2FzbU1vZHVsZVxufTtcbiJdLCJuYW1lcyI6WyJjYWNoZWRSZXN1bHQiLCJmdW5jIiwidW5pbml0VG9rZW4iLCJyZXN1bHQiLCJJbXBsIiwibG9hZFNjcmlwdCIsInVybCIsImNhbGxiYWNrIiwicyIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInNldEF0dHJpYnV0ZSIsIm9ubG9hZCIsIm9uZXJyb3IiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJsb2FkV2FzbSIsIm1vZHVsZU5hbWUiLCJjb25maWciLCJsb2FkVXJsIiwid2FzbVN1cHBvcnRlZCIsImdsdWVVcmwiLCJ3YXNtVXJsIiwiZmFsbGJhY2tVcmwiLCJlcnIiLCJtb2R1bGUiLCJ3aW5kb3ciLCJ1bmRlZmluZWQiLCJsb2NhdGVGaWxlIiwib25BYm9ydCIsInRoZW4iLCJpbnN0YW5jZSIsImdldE1vZHVsZSIsIm5hbWUiLCJtb2R1bGVzIiwiaGFzT3duUHJvcGVydHkiLCJpbml0aWFsaXppbmciLCJjYWxsYmFja3MiLCJpbml0aWFsaXplIiwiZXJyb3JIYW5kbGVyIiwiY29uc29sZSIsImVycm9yIiwiZm9yRWFjaCIsIldlYkFzc2VtYmx5IiwiaW5zdGFudGlhdGUiLCJNb2R1bGUiLCJVaW50OEFycmF5Iiwib2YiLCJJbnN0YW5jZSIsImUiLCJXYXNtTW9kdWxlIiwic2V0Q29uZmlnIiwibGVuZ3RoIiwiZ2V0Q29uZmlnIiwiX0ltcGwkbW9kdWxlcyIsImdldEluc3RhbmNlIiwicHVzaCJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBLE1BQU1BLFlBQVksR0FBSUMsSUFBSSxJQUFLO0VBQzNCLE1BQU1DLFdBQVcsR0FBRyxF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
