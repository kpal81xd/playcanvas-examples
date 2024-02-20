import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';
import { ScriptAttributes } from './script-attributes.js';

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');

/**
 * Represents the type of a script. It is returned by {@link createScript}. Also referred to as
 * Script Type.
 *
 * The type is to be extended using its JavaScript prototype. There is a list of methods that will
 * be executed by the engine on instances of this type, such as:
 *
 * - `initialize`
 * - `postInitialize`
 * - `update`
 * - `postUpdate`
 * - `swap`
 *
 * `initialize` and `postInitialize` - are called (if defined) when a script is about to run for
 * the first time - `postInitialize` will run after all `initialize` methods are executed in the
 * same tick or enabling chain of actions.
 *
 * `update` and `postUpdate` - are called (if defined) for enabled (running state) scripts on each
 * tick.
 *
 * `swap` - is called when a ScriptType that already exists in the registry gets redefined. If the
 * new ScriptType has a `swap` method in its prototype, then it will be executed to perform hot-
 * reload at runtime.
 *
 * @augments EventHandler
 * @category Script
 */
class ScriptType extends EventHandler {
  /**
   * Create a new ScriptType instance.
   *
   * @param {object} args - The input arguments object.
   * @param {import('../app-base.js').AppBase} args.app - The {@link AppBase} that is running the
   * script.
   * @param {import('../entity.js').Entity} args.entity - The {@link Entity} that the script is
   * attached to.
   */
  constructor(args) {
    super();
    /**
     * The {@link AppBase} that the instance of this type belongs to.
     *
     * @type {import('../app-base.js').AppBase}
     */
    this.app = void 0;
    /**
     * The {@link Entity} that the instance of this type belongs to.
     *
     * @type {import('../entity.js').Entity}
     */
    this.entity = void 0;
    /** @private */
    this._enabled = void 0;
    /** @private */
    this._enabledOld = void 0;
    /** @private */
    this._initialized = void 0;
    /** @private */
    this._postInitialized = void 0;
    /** @private */
    this.__destroyed = void 0;
    /** @private */
    this.__attributes = void 0;
    /** @private */
    this.__attributesRaw = void 0;
    /** @private */
    this.__scriptType = void 0;
    /**
     * The order in the script component that the methods of this script instance will run
     * relative to other script instances in the component.
     *
     * @type {number}
     * @private
     */
    this.__executionOrder = void 0;
    this.initScriptType(args);
  }

  /**
   * True if the instance of this type is in running state. False when script is not running,
   * because the Entity or any of its parents are disabled or the {@link ScriptComponent} is
   * disabled or the Script Instance is disabled. When disabled no update methods will be called
   * on each tick. initialize and postInitialize methods will run once when the script instance
   * is in `enabled` state during app tick.
   *
   * @type {boolean}
   */
  set enabled(value) {
    this._enabled = !!value;
    if (this.enabled === this._enabledOld) return;
    this._enabledOld = this.enabled;
    this.fire(this.enabled ? 'enable' : 'disable');
    this.fire('state', this.enabled);

    // initialize script if not initialized yet and script is enabled
    if (!this._initialized && this.enabled) {
      this._initialized = true;
      this.__initializeAttributes(true);
      if (this.initialize) this.entity.script._scriptMethod(this, SCRIPT_INITIALIZE);
    }

    // post initialize script if not post initialized yet and still enabled
    // (initialize might have disabled the script so check this.enabled again)
    // Warning: Do not do this if the script component is currently being enabled
    // because in this case post initialize must be called after all the scripts
    // in the script component have been initialized first
    if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
      this._postInitialized = true;
      if (this.postInitialize) this.entity.script._scriptMethod(this, SCRIPT_POST_INITIALIZE);
    }
  }
  get enabled() {
    return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
  }

  /**
   * @param {{entity: import('../entity.js').Entity, app: import('../app-base.js').AppBase}} args -
   * The entity and app.
   * @private
   */
  initScriptType(args) {
    const script = this.constructor; // get script type, i.e. function (class)
    Debug.assert(args && args.app && args.entity, `script [${script.__name}] has missing arguments in constructor`);
    this.app = args.app;
    this.entity = args.entity;
    this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
    this._enabledOld = this.enabled;
    this.__destroyed = false;
    this.__attributes = {};
    this.__attributesRaw = args.attributes || {}; // need at least an empty object to make sure default attributes are initialized
    this.__scriptType = script;
    this.__executionOrder = -1;
  }

  /**
   * Name of a Script Type.
   *
   * @type {string}
   * @private
   */

  // Will be assigned when calling createScript or registerScript.
  /**
   * @param {*} constructorFn - The constructor function of the script type.
   * @returns {string} The script name.
   * @private
   */
  static __getScriptName(constructorFn) {
    if (typeof constructorFn !== 'function') return undefined;
    if ('name' in Function.prototype) return constructorFn.name;
    if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
    const match = ('' + constructorFn).match(funcNameRegex);
    return match ? match[1] : undefined;
  }

  /**
   * Name of a Script Type.
   *
   * @type {string|null}
   */
  static get scriptName() {
    return this.__name;
  }

  /**
   * The interface to define attributes for Script Types. Refer to {@link ScriptAttributes}.
   *
   * @type {ScriptAttributes}
   * @example
   * var PlayerController = pc.createScript('playerController');
   *
   * PlayerController.attributes.add('speed', {
   *     type: 'number',
   *     title: 'Speed',
   *     placeholder: 'km/h',
   *     default: 22.2
   * });
   */
  static get attributes() {
    if (!this.hasOwnProperty('__attributes')) this.__attributes = new ScriptAttributes(this);
    return this.__attributes;
  }

  /**
   * @param {boolean} [force] - Set to true to force initialization of the attributes.
   * @private
   */
  __initializeAttributes(force) {
    if (!force && !this.__attributesRaw) return;

    // set attributes values
    for (const key in this.__scriptType.attributes.index) {
      if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
        this[key] = this.__attributesRaw[key];
      } else if (!this.__attributes.hasOwnProperty(key)) {
        if (this.__scriptType.attributes.index[key].hasOwnProperty('default')) {
          this[key] = this.__scriptType.attributes.index[key].default;
        } else {
          this[key] = null;
        }
      }
    }
    this.__attributesRaw = null;
  }

  /**
   * Shorthand function to extend Script Type prototype with list of methods.
   *
   * @param {object} methods - Object with methods, where key - is name of method, and value - is function.
   * @example
   * var PlayerController = pc.createScript('playerController');
   *
   * PlayerController.extend({
   *     initialize: function () {
   *         // called once on initialize
   *     },
   *     update: function (dt) {
   *         // called each tick
   *     }
   * });
   */
  static extend(methods) {
    for (const key in methods) {
      if (!methods.hasOwnProperty(key)) continue;
      this.prototype[key] = methods[key];
    }
  }

  /**
   * @function
   * @name ScriptType#[initialize]
   * @description Called when script is about to run for the first time.
   */

  /**
   * @function
   * @name ScriptType#[postInitialize]
   * @description Called after all initialize methods are executed in the same tick or enabling chain of actions.
   */

  /**
   * @function
   * @name ScriptType#[update]
   * @description Called for enabled (running state) scripts on each tick.
   * @param {number} dt - The delta time in seconds since the last frame.
   */

  /**
   * @function
   * @name ScriptType#[postUpdate]
   * @description Called for enabled (running state) scripts on each tick, after update.
   * @param {number} dt - The delta time in seconds since the last frame.
   */

  /**
   * @function
   * @name ScriptType#[swap]
   * @description Called when a ScriptType that already exists in the registry
   * gets redefined. If the new ScriptType has a `swap` method in its prototype,
   * then it will be executed to perform hot-reload at runtime.
   * @param {ScriptType} old - Old instance of the scriptType to copy data to the new instance.
   */
}
/**
 * Fired when a script instance becomes enabled.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('enable', () => {
 *         // Script Instance is now enabled
 *     });
 * };
 */
ScriptType.EVENT_ENABLE = 'enable';
/**
 * Fired when a script instance becomes disabled.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('disable', () => {
 *         // Script Instance is now disabled
 *     });
 * };
 */
ScriptType.EVENT_DISABLE = 'disable';
/**
 * Fired when a script instance changes state to enabled or disabled. The handler is passed a
 * boolean parameter that states whether the script instance is now enabled or disabled.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('state', (enabled) => {
 *         console.log(`Script Instance is now ${enabled ? 'enabled' : 'disabled'}`);
 *     });
 * };
 */
ScriptType.EVENT_STATE = 'state';
/**
 * Fired when a script instance is destroyed and removed from component.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('destroy', () => {
 *         // no longer part of the entity
 *         // this is a good place to clean up allocated resources used by the script
 *     });
 * };
 */
ScriptType.EVENT_DESTROY = 'destroy';
/**
 * Fired when script attributes have changed. This event is available in two forms. They are as follows:
 *
 * 1. `attr` - Fired for any attribute change. The handler is passed the name of the attribute
 * that changed, the value of the attribute before the change and the value of the attribute
 * after the change.
 * 2. `attr:[name]` - Fired for a specific attribute change. The handler is passed the value of
 * the attribute before the change and the value of the attribute after the change.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('attr', (name, newValue, oldValue) => {
 *         console.log(`Attribute '${name}' changed from '${oldValue}' to '${newValue}'`);
 *     });
 * };
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('attr:speed', (newValue, oldValue) => {
 *         console.log(`Attribute 'speed' changed from '${oldValue}' to '${newValue}'`);
 *     });
 * };
 */
ScriptType.EVENT_ATTR = 'attr';
/**
 * Fired when a script instance had an exception. The script instance will be automatically
 * disabled. The handler is passed an {@link Error} object containing the details of the
 * exception and the name of the method that threw the exception.
 *
 * @event
 * @example
 * PlayerController.prototype.initialize = function () {
 *     this.on('error', (err, method) => {
 *         // caught an exception
 *         console.log(err.stack);
 *     });
 * };
 */
ScriptType.EVENT_ERROR = 'error';
ScriptType.__name = null;

export { ScriptType };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LXR5cGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NyaXB0L3NjcmlwdC10eXBlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBTQ1JJUFRfSU5JVElBTElaRSwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNjcmlwdEF0dHJpYnV0ZXMgfSBmcm9tICcuL3NjcmlwdC1hdHRyaWJ1dGVzLmpzJztcblxuY29uc3QgZnVuY05hbWVSZWdleCA9IG5ldyBSZWdFeHAoJ15cXFxccypmdW5jdGlvbig/OlxcXFxzfFxcXFxzKlxcXFwvXFxcXCouKlxcXFwqXFxcXC9cXFxccyopKyhbXlxcXFwoXFxcXHNcXFxcL10qKVxcXFxzKicpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHR5cGUgb2YgYSBzY3JpcHQuIEl0IGlzIHJldHVybmVkIGJ5IHtAbGluayBjcmVhdGVTY3JpcHR9LiBBbHNvIHJlZmVycmVkIHRvIGFzXG4gKiBTY3JpcHQgVHlwZS5cbiAqXG4gKiBUaGUgdHlwZSBpcyB0byBiZSBleHRlbmRlZCB1c2luZyBpdHMgSmF2YVNjcmlwdCBwcm90b3R5cGUuIFRoZXJlIGlzIGEgbGlzdCBvZiBtZXRob2RzIHRoYXQgd2lsbFxuICogYmUgZXhlY3V0ZWQgYnkgdGhlIGVuZ2luZSBvbiBpbnN0YW5jZXMgb2YgdGhpcyB0eXBlLCBzdWNoIGFzOlxuICpcbiAqIC0gYGluaXRpYWxpemVgXG4gKiAtIGBwb3N0SW5pdGlhbGl6ZWBcbiAqIC0gYHVwZGF0ZWBcbiAqIC0gYHBvc3RVcGRhdGVgXG4gKiAtIGBzd2FwYFxuICpcbiAqIGBpbml0aWFsaXplYCBhbmQgYHBvc3RJbml0aWFsaXplYCAtIGFyZSBjYWxsZWQgKGlmIGRlZmluZWQpIHdoZW4gYSBzY3JpcHQgaXMgYWJvdXQgdG8gcnVuIGZvclxuICogdGhlIGZpcnN0IHRpbWUgLSBgcG9zdEluaXRpYWxpemVgIHdpbGwgcnVuIGFmdGVyIGFsbCBgaW5pdGlhbGl6ZWAgbWV0aG9kcyBhcmUgZXhlY3V0ZWQgaW4gdGhlXG4gKiBzYW1lIHRpY2sgb3IgZW5hYmxpbmcgY2hhaW4gb2YgYWN0aW9ucy5cbiAqXG4gKiBgdXBkYXRlYCBhbmQgYHBvc3RVcGRhdGVgIC0gYXJlIGNhbGxlZCAoaWYgZGVmaW5lZCkgZm9yIGVuYWJsZWQgKHJ1bm5pbmcgc3RhdGUpIHNjcmlwdHMgb24gZWFjaFxuICogdGljay5cbiAqXG4gKiBgc3dhcGAgLSBpcyBjYWxsZWQgd2hlbiBhIFNjcmlwdFR5cGUgdGhhdCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgcmVnaXN0cnkgZ2V0cyByZWRlZmluZWQuIElmIHRoZVxuICogbmV3IFNjcmlwdFR5cGUgaGFzIGEgYHN3YXBgIG1ldGhvZCBpbiBpdHMgcHJvdG90eXBlLCB0aGVuIGl0IHdpbGwgYmUgZXhlY3V0ZWQgdG8gcGVyZm9ybSBob3QtXG4gKiByZWxvYWQgYXQgcnVudGltZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgU2NyaXB0XG4gKi9cbmNsYXNzIFNjcmlwdFR5cGUgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgYmVjb21lcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdlbmFibGUnLCAoKSA9PiB7XG4gICAgICogICAgICAgICAvLyBTY3JpcHQgSW5zdGFuY2UgaXMgbm93IGVuYWJsZWRcbiAgICAgKiAgICAgfSk7XG4gICAgICogfTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRU5BQkxFID0gJ2VuYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGJlY29tZXMgZGlzYWJsZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIHRoaXMub24oJ2Rpc2FibGUnLCAoKSA9PiB7XG4gICAgICogICAgICAgICAvLyBTY3JpcHQgSW5zdGFuY2UgaXMgbm93IGRpc2FibGVkXG4gICAgICogICAgIH0pO1xuICAgICAqIH07XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0RJU0FCTEUgPSAnZGlzYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGNoYW5nZXMgc3RhdGUgdG8gZW5hYmxlZCBvciBkaXNhYmxlZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFcbiAgICAgKiBib29sZWFuIHBhcmFtZXRlciB0aGF0IHN0YXRlcyB3aGV0aGVyIHRoZSBzY3JpcHQgaW5zdGFuY2UgaXMgbm93IGVuYWJsZWQgb3IgZGlzYWJsZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIHRoaXMub24oJ3N0YXRlJywgKGVuYWJsZWQpID0+IHtcbiAgICAgKiAgICAgICAgIGNvbnNvbGUubG9nKGBTY3JpcHQgSW5zdGFuY2UgaXMgbm93ICR7ZW5hYmxlZCA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCd9YCk7XG4gICAgICogICAgIH0pO1xuICAgICAqIH07XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1NUQVRFID0gJ3N0YXRlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgZGVzdHJveWVkIGFuZCByZW1vdmVkIGZyb20gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdkZXN0cm95JywgKCkgPT4ge1xuICAgICAqICAgICAgICAgLy8gbm8gbG9uZ2VyIHBhcnQgb2YgdGhlIGVudGl0eVxuICAgICAqICAgICAgICAgLy8gdGhpcyBpcyBhIGdvb2QgcGxhY2UgdG8gY2xlYW4gdXAgYWxsb2NhdGVkIHJlc291cmNlcyB1c2VkIGJ5IHRoZSBzY3JpcHRcbiAgICAgKiAgICAgfSk7XG4gICAgICogfTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfREVTVFJPWSA9ICdkZXN0cm95JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gc2NyaXB0IGF0dHJpYnV0ZXMgaGF2ZSBjaGFuZ2VkLiBUaGlzIGV2ZW50IGlzIGF2YWlsYWJsZSBpbiB0d28gZm9ybXMuIFRoZXkgYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgYXR0cmAgLSBGaXJlZCBmb3IgYW55IGF0dHJpYnV0ZSBjaGFuZ2UuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUgbmFtZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgICogdGhhdCBjaGFuZ2VkLCB0aGUgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZSBiZWZvcmUgdGhlIGNoYW5nZSBhbmQgdGhlIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAgKiBhZnRlciB0aGUgY2hhbmdlLlxuICAgICAqIDIuIGBhdHRyOltuYW1lXWAgLSBGaXJlZCBmb3IgYSBzcGVjaWZpYyBhdHRyaWJ1dGUgY2hhbmdlLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlIHZhbHVlIG9mXG4gICAgICogdGhlIGF0dHJpYnV0ZSBiZWZvcmUgdGhlIGNoYW5nZSBhbmQgdGhlIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUgYWZ0ZXIgdGhlIGNoYW5nZS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgdGhpcy5vbignYXR0cicsIChuYW1lLCBuZXdWYWx1ZSwgb2xkVmFsdWUpID0+IHtcbiAgICAgKiAgICAgICAgIGNvbnNvbGUubG9nKGBBdHRyaWJ1dGUgJyR7bmFtZX0nIGNoYW5nZWQgZnJvbSAnJHtvbGRWYWx1ZX0nIHRvICcke25ld1ZhbHVlfSdgKTtcbiAgICAgKiAgICAgfSk7XG4gICAgICogfTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIHRoaXMub24oJ2F0dHI6c3BlZWQnLCAobmV3VmFsdWUsIG9sZFZhbHVlKSA9PiB7XG4gICAgICogICAgICAgICBjb25zb2xlLmxvZyhgQXR0cmlidXRlICdzcGVlZCcgY2hhbmdlZCBmcm9tICcke29sZFZhbHVlfScgdG8gJyR7bmV3VmFsdWV9J2ApO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9BVFRSID0gJ2F0dHInO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBoYWQgYW4gZXhjZXB0aW9uLiBUaGUgc2NyaXB0IGluc3RhbmNlIHdpbGwgYmUgYXV0b21hdGljYWxseVxuICAgICAqIGRpc2FibGVkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYW4ge0BsaW5rIEVycm9yfSBvYmplY3QgY29udGFpbmluZyB0aGUgZGV0YWlscyBvZiB0aGVcbiAgICAgKiBleGNlcHRpb24gYW5kIHRoZSBuYW1lIG9mIHRoZSBtZXRob2QgdGhhdCB0aHJldyB0aGUgZXhjZXB0aW9uLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdlcnJvcicsIChlcnIsIG1ldGhvZCkgPT4ge1xuICAgICAqICAgICAgICAgLy8gY2F1Z2h0IGFuIGV4Y2VwdGlvblxuICAgICAqICAgICAgICAgY29uc29sZS5sb2coZXJyLnN0YWNrKTtcbiAgICAgKiAgICAgfSk7XG4gICAgICogfTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRVJST1IgPSAnZXJyb3InO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHtAbGluayBBcHBCYXNlfSB0aGF0IHRoZSBpbnN0YW5jZSBvZiB0aGlzIHR5cGUgYmVsb25ncyB0by5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX1cbiAgICAgKi9cbiAgICBhcHA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUge0BsaW5rIEVudGl0eX0gdGhhdCB0aGUgaW5zdGFuY2Ugb2YgdGhpcyB0eXBlIGJlbG9uZ3MgdG8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICovXG4gICAgZW50aXR5O1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2VuYWJsZWQ7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZW5hYmxlZE9sZDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pbml0aWFsaXplZDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9wb3N0SW5pdGlhbGl6ZWQ7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfX2Rlc3Ryb3llZDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9fYXR0cmlidXRlcztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9fYXR0cmlidXRlc1JhdztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9fc2NyaXB0VHlwZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBvcmRlciBpbiB0aGUgc2NyaXB0IGNvbXBvbmVudCB0aGF0IHRoZSBtZXRob2RzIG9mIHRoaXMgc2NyaXB0IGluc3RhbmNlIHdpbGwgcnVuXG4gICAgICogcmVsYXRpdmUgdG8gb3RoZXIgc2NyaXB0IGluc3RhbmNlcyBpbiB0aGUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9fZXhlY3V0aW9uT3JkZXI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2NyaXB0VHlwZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBhcmdzIC0gVGhlIGlucHV0IGFyZ3VtZW50cyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXJncy5hcHAgLSBUaGUge0BsaW5rIEFwcEJhc2V9IHRoYXQgaXMgcnVubmluZyB0aGVcbiAgICAgKiBzY3JpcHQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gYXJncy5lbnRpdHkgLSBUaGUge0BsaW5rIEVudGl0eX0gdGhhdCB0aGUgc2NyaXB0IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXJncykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmluaXRTY3JpcHRUeXBlKGFyZ3MpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGluc3RhbmNlIG9mIHRoaXMgdHlwZSBpcyBpbiBydW5uaW5nIHN0YXRlLiBGYWxzZSB3aGVuIHNjcmlwdCBpcyBub3QgcnVubmluZyxcbiAgICAgKiBiZWNhdXNlIHRoZSBFbnRpdHkgb3IgYW55IG9mIGl0cyBwYXJlbnRzIGFyZSBkaXNhYmxlZCBvciB0aGUge0BsaW5rIFNjcmlwdENvbXBvbmVudH0gaXNcbiAgICAgKiBkaXNhYmxlZCBvciB0aGUgU2NyaXB0IEluc3RhbmNlIGlzIGRpc2FibGVkLiBXaGVuIGRpc2FibGVkIG5vIHVwZGF0ZSBtZXRob2RzIHdpbGwgYmUgY2FsbGVkXG4gICAgICogb24gZWFjaCB0aWNrLiBpbml0aWFsaXplIGFuZCBwb3N0SW5pdGlhbGl6ZSBtZXRob2RzIHdpbGwgcnVuIG9uY2Ugd2hlbiB0aGUgc2NyaXB0IGluc3RhbmNlXG4gICAgICogaXMgaW4gYGVuYWJsZWRgIHN0YXRlIGR1cmluZyBhcHAgdGljay5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSAhIXZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgPT09IHRoaXMuX2VuYWJsZWRPbGQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9lbmFibGVkT2xkID0gdGhpcy5lbmFibGVkO1xuICAgICAgICB0aGlzLmZpcmUodGhpcy5lbmFibGVkID8gJ2VuYWJsZScgOiAnZGlzYWJsZScpO1xuICAgICAgICB0aGlzLmZpcmUoJ3N0YXRlJywgdGhpcy5lbmFibGVkKTtcblxuICAgICAgICAvLyBpbml0aWFsaXplIHNjcmlwdCBpZiBub3QgaW5pdGlhbGl6ZWQgeWV0IGFuZCBzY3JpcHQgaXMgZW5hYmxlZFxuICAgICAgICBpZiAoIXRoaXMuX2luaXRpYWxpemVkICYmIHRoaXMuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9faW5pdGlhbGl6ZUF0dHJpYnV0ZXModHJ1ZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2NyaXB0Ll9zY3JpcHRNZXRob2QodGhpcywgU0NSSVBUX0lOSVRJQUxJWkUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zdCBpbml0aWFsaXplIHNjcmlwdCBpZiBub3QgcG9zdCBpbml0aWFsaXplZCB5ZXQgYW5kIHN0aWxsIGVuYWJsZWRcbiAgICAgICAgLy8gKGluaXRpYWxpemUgbWlnaHQgaGF2ZSBkaXNhYmxlZCB0aGUgc2NyaXB0IHNvIGNoZWNrIHRoaXMuZW5hYmxlZCBhZ2FpbilcbiAgICAgICAgLy8gV2FybmluZzogRG8gbm90IGRvIHRoaXMgaWYgdGhlIHNjcmlwdCBjb21wb25lbnQgaXMgY3VycmVudGx5IGJlaW5nIGVuYWJsZWRcbiAgICAgICAgLy8gYmVjYXVzZSBpbiB0aGlzIGNhc2UgcG9zdCBpbml0aWFsaXplIG11c3QgYmUgY2FsbGVkIGFmdGVyIGFsbCB0aGUgc2NyaXB0c1xuICAgICAgICAvLyBpbiB0aGUgc2NyaXB0IGNvbXBvbmVudCBoYXZlIGJlZW4gaW5pdGlhbGl6ZWQgZmlyc3RcbiAgICAgICAgaWYgKHRoaXMuX2luaXRpYWxpemVkICYmICF0aGlzLl9wb3N0SW5pdGlhbGl6ZWQgJiYgdGhpcy5lbmFibGVkICYmICF0aGlzLmVudGl0eS5zY3JpcHQuX2JlaW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdEluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMucG9zdEluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2NyaXB0Ll9zY3JpcHRNZXRob2QodGhpcywgU0NSSVBUX1BPU1RfSU5JVElBTElaRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQgJiYgIXRoaXMuX2Rlc3Ryb3llZCAmJiB0aGlzLmVudGl0eS5zY3JpcHQuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7e2VudGl0eTogaW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHksIGFwcDogaW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9fSBhcmdzIC1cbiAgICAgKiBUaGUgZW50aXR5IGFuZCBhcHAuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbml0U2NyaXB0VHlwZShhcmdzKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuY29uc3RydWN0b3I7IC8vIGdldCBzY3JpcHQgdHlwZSwgaS5lLiBmdW5jdGlvbiAoY2xhc3MpXG4gICAgICAgIERlYnVnLmFzc2VydChhcmdzICYmIGFyZ3MuYXBwICYmIGFyZ3MuZW50aXR5LCBgc2NyaXB0IFske3NjcmlwdC5fX25hbWV9XSBoYXMgbWlzc2luZyBhcmd1bWVudHMgaW4gY29uc3RydWN0b3JgKTtcblxuICAgICAgICB0aGlzLmFwcCA9IGFyZ3MuYXBwO1xuICAgICAgICB0aGlzLmVudGl0eSA9IGFyZ3MuZW50aXR5O1xuXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0eXBlb2YgYXJncy5lbmFibGVkID09PSAnYm9vbGVhbicgPyBhcmdzLmVuYWJsZWQgOiB0cnVlO1xuICAgICAgICB0aGlzLl9lbmFibGVkT2xkID0gdGhpcy5lbmFibGVkO1xuXG4gICAgICAgIHRoaXMuX19kZXN0cm95ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fX2F0dHJpYnV0ZXMgPSB7IH07XG4gICAgICAgIHRoaXMuX19hdHRyaWJ1dGVzUmF3ID0gYXJncy5hdHRyaWJ1dGVzIHx8IHsgfTsgLy8gbmVlZCBhdCBsZWFzdCBhbiBlbXB0eSBvYmplY3QgdG8gbWFrZSBzdXJlIGRlZmF1bHQgYXR0cmlidXRlcyBhcmUgaW5pdGlhbGl6ZWRcbiAgICAgICAgdGhpcy5fX3NjcmlwdFR5cGUgPSBzY3JpcHQ7XG4gICAgICAgIHRoaXMuX19leGVjdXRpb25PcmRlciA9IC0xO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE5hbWUgb2YgYSBTY3JpcHQgVHlwZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzdGF0aWMgX19uYW1lID0gbnVsbDsgLy8gV2lsbCBiZSBhc3NpZ25lZCB3aGVuIGNhbGxpbmcgY3JlYXRlU2NyaXB0IG9yIHJlZ2lzdGVyU2NyaXB0LlxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBjb25zdHJ1Y3RvckZuIC0gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIG9mIHRoZSBzY3JpcHQgdHlwZS5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc2NyaXB0IG5hbWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzdGF0aWMgX19nZXRTY3JpcHROYW1lKGNvbnN0cnVjdG9yRm4pIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvckZuICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoJ25hbWUnIGluIEZ1bmN0aW9uLnByb3RvdHlwZSkgcmV0dXJuIGNvbnN0cnVjdG9yRm4ubmFtZTtcbiAgICAgICAgaWYgKGNvbnN0cnVjdG9yRm4gPT09IEZ1bmN0aW9uIHx8IGNvbnN0cnVjdG9yRm4gPT09IEZ1bmN0aW9uLnByb3RvdHlwZS5jb25zdHJ1Y3RvcikgcmV0dXJuICdGdW5jdGlvbic7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gKCcnICsgY29uc3RydWN0b3JGbikubWF0Y2goZnVuY05hbWVSZWdleCk7XG4gICAgICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE5hbWUgb2YgYSBTY3JpcHQgVHlwZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0IHNjcmlwdE5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9fbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaW50ZXJmYWNlIHRvIGRlZmluZSBhdHRyaWJ1dGVzIGZvciBTY3JpcHQgVHlwZXMuIFJlZmVyIHRvIHtAbGluayBTY3JpcHRBdHRyaWJ1dGVzfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTY3JpcHRBdHRyaWJ1dGVzfVxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIFBsYXllckNvbnRyb2xsZXIgPSBwYy5jcmVhdGVTY3JpcHQoJ3BsYXllckNvbnRyb2xsZXInKTtcbiAgICAgKlxuICAgICAqIFBsYXllckNvbnRyb2xsZXIuYXR0cmlidXRlcy5hZGQoJ3NwZWVkJywge1xuICAgICAqICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgKiAgICAgdGl0bGU6ICdTcGVlZCcsXG4gICAgICogICAgIHBsYWNlaG9sZGVyOiAna20vaCcsXG4gICAgICogICAgIGRlZmF1bHQ6IDIyLjJcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0IGF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eSgnX19hdHRyaWJ1dGVzJykpIHRoaXMuX19hdHRyaWJ1dGVzID0gbmV3IFNjcmlwdEF0dHJpYnV0ZXModGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9fYXR0cmlidXRlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmb3JjZV0gLSBTZXQgdG8gdHJ1ZSB0byBmb3JjZSBpbml0aWFsaXphdGlvbiBvZiB0aGUgYXR0cmlidXRlcy5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9faW5pdGlhbGl6ZUF0dHJpYnV0ZXMoZm9yY2UpIHtcbiAgICAgICAgaWYgKCFmb3JjZSAmJiAhdGhpcy5fX2F0dHJpYnV0ZXNSYXcpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gc2V0IGF0dHJpYnV0ZXMgdmFsdWVzXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX19zY3JpcHRUeXBlLmF0dHJpYnV0ZXMuaW5kZXgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9fYXR0cmlidXRlc1JhdyAmJiB0aGlzLl9fYXR0cmlidXRlc1Jhdy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgdGhpc1trZXldID0gdGhpcy5fX2F0dHJpYnV0ZXNSYXdba2V5XTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuX19hdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fX3NjcmlwdFR5cGUuYXR0cmlidXRlcy5pbmRleFtrZXldLmhhc093blByb3BlcnR5KCdkZWZhdWx0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1trZXldID0gdGhpcy5fX3NjcmlwdFR5cGUuYXR0cmlidXRlcy5pbmRleFtrZXldLmRlZmF1bHQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1trZXldID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9fYXR0cmlidXRlc1JhdyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hvcnRoYW5kIGZ1bmN0aW9uIHRvIGV4dGVuZCBTY3JpcHQgVHlwZSBwcm90b3R5cGUgd2l0aCBsaXN0IG9mIG1ldGhvZHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbWV0aG9kcyAtIE9iamVjdCB3aXRoIG1ldGhvZHMsIHdoZXJlIGtleSAtIGlzIG5hbWUgb2YgbWV0aG9kLCBhbmQgdmFsdWUgLSBpcyBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBQbGF5ZXJDb250cm9sbGVyID0gcGMuY3JlYXRlU2NyaXB0KCdwbGF5ZXJDb250cm9sbGVyJyk7XG4gICAgICpcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLmV4dGVuZCh7XG4gICAgICogICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgICAgIC8vIGNhbGxlZCBvbmNlIG9uIGluaXRpYWxpemVcbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgdXBkYXRlOiBmdW5jdGlvbiAoZHQpIHtcbiAgICAgKiAgICAgICAgIC8vIGNhbGxlZCBlYWNoIHRpY2tcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBleHRlbmQobWV0aG9kcykge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBtZXRob2RzKSB7XG4gICAgICAgICAgICBpZiAoIW1ldGhvZHMuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgdGhpcy5wcm90b3R5cGVba2V5XSA9IG1ldGhvZHNba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIFNjcmlwdFR5cGUjW2luaXRpYWxpemVdXG4gICAgICogQGRlc2NyaXB0aW9uIENhbGxlZCB3aGVuIHNjcmlwdCBpcyBhYm91dCB0byBydW4gZm9yIHRoZSBmaXJzdCB0aW1lLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgU2NyaXB0VHlwZSNbcG9zdEluaXRpYWxpemVdXG4gICAgICogQGRlc2NyaXB0aW9uIENhbGxlZCBhZnRlciBhbGwgaW5pdGlhbGl6ZSBtZXRob2RzIGFyZSBleGVjdXRlZCBpbiB0aGUgc2FtZSB0aWNrIG9yIGVuYWJsaW5nIGNoYWluIG9mIGFjdGlvbnMuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBTY3JpcHRUeXBlI1t1cGRhdGVdXG4gICAgICogQGRlc2NyaXB0aW9uIENhbGxlZCBmb3IgZW5hYmxlZCAocnVubmluZyBzdGF0ZSkgc2NyaXB0cyBvbiBlYWNoIHRpY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIGRlbHRhIHRpbWUgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIFNjcmlwdFR5cGUjW3Bvc3RVcGRhdGVdXG4gICAgICogQGRlc2NyaXB0aW9uIENhbGxlZCBmb3IgZW5hYmxlZCAocnVubmluZyBzdGF0ZSkgc2NyaXB0cyBvbiBlYWNoIHRpY2ssIGFmdGVyIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgZGVsdGEgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgU2NyaXB0VHlwZSNbc3dhcF1cbiAgICAgKiBAZGVzY3JpcHRpb24gQ2FsbGVkIHdoZW4gYSBTY3JpcHRUeXBlIHRoYXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIHJlZ2lzdHJ5XG4gICAgICogZ2V0cyByZWRlZmluZWQuIElmIHRoZSBuZXcgU2NyaXB0VHlwZSBoYXMgYSBgc3dhcGAgbWV0aG9kIGluIGl0cyBwcm90b3R5cGUsXG4gICAgICogdGhlbiBpdCB3aWxsIGJlIGV4ZWN1dGVkIHRvIHBlcmZvcm0gaG90LXJlbG9hZCBhdCBydW50aW1lLlxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gb2xkIC0gT2xkIGluc3RhbmNlIG9mIHRoZSBzY3JpcHRUeXBlIHRvIGNvcHkgZGF0YSB0byB0aGUgbmV3IGluc3RhbmNlLlxuICAgICAqL1xufVxuXG5leHBvcnQgeyBTY3JpcHRUeXBlIH07XG4iXSwibmFtZXMiOlsiZnVuY05hbWVSZWdleCIsIlJlZ0V4cCIsIlNjcmlwdFR5cGUiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFyZ3MiLCJhcHAiLCJlbnRpdHkiLCJfZW5hYmxlZCIsIl9lbmFibGVkT2xkIiwiX2luaXRpYWxpemVkIiwiX3Bvc3RJbml0aWFsaXplZCIsIl9fZGVzdHJveWVkIiwiX19hdHRyaWJ1dGVzIiwiX19hdHRyaWJ1dGVzUmF3IiwiX19zY3JpcHRUeXBlIiwiX19leGVjdXRpb25PcmRlciIsImluaXRTY3JpcHRUeXBlIiwiZW5hYmxlZCIsInZhbHVlIiwiZmlyZSIsIl9faW5pdGlhbGl6ZUF0dHJpYnV0ZXMiLCJpbml0aWFsaXplIiwic2NyaXB0IiwiX3NjcmlwdE1ldGhvZCIsIlNDUklQVF9JTklUSUFMSVpFIiwiX2JlaW5nRW5hYmxlZCIsInBvc3RJbml0aWFsaXplIiwiU0NSSVBUX1BPU1RfSU5JVElBTElaRSIsIl9kZXN0cm95ZWQiLCJEZWJ1ZyIsImFzc2VydCIsIl9fbmFtZSIsImF0dHJpYnV0ZXMiLCJfX2dldFNjcmlwdE5hbWUiLCJjb25zdHJ1Y3RvckZuIiwidW5kZWZpbmVkIiwiRnVuY3Rpb24iLCJwcm90b3R5cGUiLCJuYW1lIiwibWF0Y2giLCJzY3JpcHROYW1lIiwiaGFzT3duUHJvcGVydHkiLCJTY3JpcHRBdHRyaWJ1dGVzIiwiZm9yY2UiLCJrZXkiLCJpbmRleCIsImRlZmF1bHQiLCJleHRlbmQiLCJtZXRob2RzIiwiRVZFTlRfRU5BQkxFIiwiRVZFTlRfRElTQUJMRSIsIkVWRU5UX1NUQVRFIiwiRVZFTlRfREVTVFJPWSIsIkVWRU5UX0FUVFIiLCJFVkVOVF9FUlJPUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFNQSxNQUFNQSxhQUFhLEdBQUcsSUFBSUMsTUFBTSxDQUFDLGlFQUFpRSxDQUFDLENBQUE7O0FBRW5HO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1D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
