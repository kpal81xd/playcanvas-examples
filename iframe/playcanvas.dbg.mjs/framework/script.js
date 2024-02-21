import { events } from '../core/events.js';
import { getApplication } from './globals.js';
import { ScriptTypes } from './script/script-types.js';

/**
 * Callback used by {@link script.createLoadingScreen}.
 *
 * @callback CreateScreenCallback
 * @param {import('./app-base.js').AppBase} app - The application.
 */

/**
 * Callback used by {@link script.create}.
 *
 * @callback CreateScriptCallback
 * @param {import('./app-base.js').AppBase} app - The application.
 * @returns {object} Return the Type of the script resource to be instanced for each Entity.
 * @ignore
 */

let _legacy = false;

// flag to avoid creating multiple loading screens e.g. when
// loading screen scripts are reloaded
let _createdLoadingScreen = false;

/**
 * The script namespace holds the createLoadingScreen function that is used to override the default
 * PlayCanvas loading screen.
 *
 * @namespace
 * @category Script
 */
const script = {
  // set during script load to be used for initializing script
  app: null,
  /**
   * Create a script resource object. A script file should contain a single call to
   * {@link script.create} and the callback should return a script object which will be
   * instantiated when attached to Entities.
   *
   * @param {string} name - The name of the script object.
   * @param {CreateScriptCallback} callback - The callback function which is passed an
   * {@link AppBase} object, which is used to access Entities and Components, and should
   * return the Type of the script resource to be instanced for each Entity.
   * @example
   * pc.script.create(function (app) {
   *     var Scriptable = function (entity) {
   *         // store entity
   *         this.entity = entity;
   *
   *         // use app
   *         app.components.model.addComponent(entity, {
   *             // component properties
   *         });
   *     };
   *
   *     return Scriptable;
   * });
   * @ignore
   */
  create(name, callback) {
    if (!_legacy) return;

    // get the ScriptType from the callback
    const ScriptType = callback(script.app);

    // store the script name
    ScriptType._pcScriptName = name;

    // Push this onto loading stack
    ScriptTypes.push(ScriptType, _legacy);
    this.fire("created", name, callback);
  },
  /**
   * Creates a script attribute for the current script. The script attribute can be accessed
   * inside the script instance like so 'this.attributeName' or outside a script instance like so
   * 'entity.script.attributeName'. Script attributes can be edited from the Attribute Editor of
   * the PlayCanvas Editor like normal Components.
   *
   * @param {string} name - The name of the attribute.
   * @param {string} type - The type of the attribute. Can be: 'number', 'string', 'boolean',
   * 'asset', 'entity', 'rgb', 'rgba', 'vector', 'enumeration', 'curve', 'colorcurve'.
   * @param {object} defaultValue - The default value of the attribute.
   * @param {object} options - Optional parameters for the attribute.
   * @param {number} options.min - The minimum value of the attribute.
   * @param {number} options.max - The maximum value of the attribute.
   * @param {number} options.step - The step that will be used when changing the attribute value
   * in the PlayCanvas Editor.
   * @param {number} options.decimalPrecision - A number that specifies the number of decimal
   * digits allowed for the value.
   * @param {object[]} options.enumerations - An array of name, value pairs from which the user
   * can select one if the attribute type is an enumeration.
   * @param {string[]} options.curves - (For 'curve' attributes only) An array of strings that
   * define the names of each curve in the curve editor.
   * @param {boolean} options.color - (For 'curve' attributes only) If true then the curve
   * attribute will be a color curve.
   * @example
   * pc.script.attribute('speed', 'number', 5);
   * pc.script.attribute('message', 'string', "My message");
   * pc.script.attribute('enemyPosition', 'vector', [1, 0, 0]);
   * pc.script.attribute('spellType', 'enumeration', 0, {
   *     enumerations: [{
   *         name: "Fire",
   *         value: 0
   *     }, {
   *         name: "Ice",
   *         value: 1
   *     }]
   * });
   * pc.script.attribute('enemy', 'entity');
   * pc.script.attribute('enemySpeed', 'curve');
   * pc.script.attribute('enemyPosition', 'curve', null, {
   *     curves: ['x', 'y', 'z']
   * });
   * pc.script.attribute('color', 'colorcurve', null, {
   *     type: 'rgba'
   * });
   *
   * pc.script.create('scriptable', function (app) {
   *     var Scriptable = function (entity) {
   *         // store entity
   *         this.entity = entity;
   *     };
   *
   *     return Scriptable;
   * });
   * @ignore
   */
  attribute(name, type, defaultValue, options) {
    // only works when parsing the script...
  },
  /**
   * Handles the creation of the loading screen of the application. A script can subscribe to the
   * events of a {@link AppBase} to show a loading screen, progress bar etc. In order for
   * this to work you need to set the project's loading screen script to the script that calls
   * this method.
   *
   * @param {CreateScreenCallback} callback - A function which can set up and tear down a
   * customized loading screen.
   * @example
   * pc.script.createLoadingScreen(function (app) {
   *     var showSplashScreen = function () {};
   *     var hideSplashScreen = function () {};
   *     var showProgress = function (progress) {};
   *     app.on("preload:start", showSplashScreen);
   *     app.on("preload:progress", showProgress);
   *     app.on("start", hideSplashScreen);
   * });
   */
  createLoadingScreen(callback) {
    if (_createdLoadingScreen) return;
    _createdLoadingScreen = true;
    const app = getApplication();
    callback(app);
  }
};
Object.defineProperty(script, 'legacy', {
  get: function () {
    return _legacy;
  },
  set: function (value) {
    _legacy = value;
  }
});
events.attach(script);

export { script };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3NjcmlwdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBldmVudHMgfSBmcm9tICcuLi9jb3JlL2V2ZW50cy5qcyc7XG5cbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi9nbG9iYWxzLmpzJztcbmltcG9ydCB7IFNjcmlwdFR5cGVzIH0gZnJvbSAnLi9zY3JpcHQvc2NyaXB0LXR5cGVzLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBzY3JpcHQuY3JlYXRlTG9hZGluZ1NjcmVlbn0uXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVNjcmVlbkNhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIHNjcmlwdC5jcmVhdGV9LlxuICpcbiAqIEBjYWxsYmFjayBDcmVhdGVTY3JpcHRDYWxsYmFja1xuICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBSZXR1cm4gdGhlIFR5cGUgb2YgdGhlIHNjcmlwdCByZXNvdXJjZSB0byBiZSBpbnN0YW5jZWQgZm9yIGVhY2ggRW50aXR5LlxuICogQGlnbm9yZVxuICovXG5cbmxldCBfbGVnYWN5ID0gZmFsc2U7XG5cbi8vIGZsYWcgdG8gYXZvaWQgY3JlYXRpbmcgbXVsdGlwbGUgbG9hZGluZyBzY3JlZW5zIGUuZy4gd2hlblxuLy8gbG9hZGluZyBzY3JlZW4gc2NyaXB0cyBhcmUgcmVsb2FkZWRcbmxldCBfY3JlYXRlZExvYWRpbmdTY3JlZW4gPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgc2NyaXB0IG5hbWVzcGFjZSBob2xkcyB0aGUgY3JlYXRlTG9hZGluZ1NjcmVlbiBmdW5jdGlvbiB0aGF0IGlzIHVzZWQgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHRcbiAqIFBsYXlDYW52YXMgbG9hZGluZyBzY3JlZW4uXG4gKlxuICogQG5hbWVzcGFjZVxuICogQGNhdGVnb3J5IFNjcmlwdFxuICovXG5jb25zdCBzY3JpcHQgPSB7XG4gICAgLy8gc2V0IGR1cmluZyBzY3JpcHQgbG9hZCB0byBiZSB1c2VkIGZvciBpbml0aWFsaXppbmcgc2NyaXB0XG4gICAgYXBwOiBudWxsLFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgc2NyaXB0IHJlc291cmNlIG9iamVjdC4gQSBzY3JpcHQgZmlsZSBzaG91bGQgY29udGFpbiBhIHNpbmdsZSBjYWxsIHRvXG4gICAgICoge0BsaW5rIHNjcmlwdC5jcmVhdGV9IGFuZCB0aGUgY2FsbGJhY2sgc2hvdWxkIHJldHVybiBhIHNjcmlwdCBvYmplY3Qgd2hpY2ggd2lsbCBiZVxuICAgICAqIGluc3RhbnRpYXRlZCB3aGVuIGF0dGFjaGVkIHRvIEVudGl0aWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2NyaXB0IG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge0NyZWF0ZVNjcmlwdENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB3aGljaCBpcyBwYXNzZWQgYW5cbiAgICAgKiB7QGxpbmsgQXBwQmFzZX0gb2JqZWN0LCB3aGljaCBpcyB1c2VkIHRvIGFjY2VzcyBFbnRpdGllcyBhbmQgQ29tcG9uZW50cywgYW5kIHNob3VsZFxuICAgICAqIHJldHVybiB0aGUgVHlwZSBvZiB0aGUgc2NyaXB0IHJlc291cmNlIHRvIGJlIGluc3RhbmNlZCBmb3IgZWFjaCBFbnRpdHkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5zY3JpcHQuY3JlYXRlKGZ1bmN0aW9uIChhcHApIHtcbiAgICAgKiAgICAgdmFyIFNjcmlwdGFibGUgPSBmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICogICAgICAgICAvLyBzdG9yZSBlbnRpdHlcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5ID0gZW50aXR5O1xuICAgICAqXG4gICAgICogICAgICAgICAvLyB1c2UgYXBwXG4gICAgICogICAgICAgICBhcHAuY29tcG9uZW50cy5tb2RlbC5hZGRDb21wb25lbnQoZW50aXR5LCB7XG4gICAgICogICAgICAgICAgICAgLy8gY29tcG9uZW50IHByb3BlcnRpZXNcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICB9O1xuICAgICAqXG4gICAgICogICAgIHJldHVybiBTY3JpcHRhYmxlO1xuICAgICAqIH0pO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjcmVhdGUobmFtZSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFfbGVnYWN5KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIGdldCB0aGUgU2NyaXB0VHlwZSBmcm9tIHRoZSBjYWxsYmFja1xuICAgICAgICBjb25zdCBTY3JpcHRUeXBlID0gY2FsbGJhY2soc2NyaXB0LmFwcCk7XG5cbiAgICAgICAgLy8gc3RvcmUgdGhlIHNjcmlwdCBuYW1lXG4gICAgICAgIFNjcmlwdFR5cGUuX3BjU2NyaXB0TmFtZSA9IG5hbWU7XG5cbiAgICAgICAgLy8gUHVzaCB0aGlzIG9udG8gbG9hZGluZyBzdGFja1xuICAgICAgICBTY3JpcHRUeXBlcy5wdXNoKFNjcmlwdFR5cGUsIF9sZWdhY3kpO1xuXG4gICAgICAgIHRoaXMuZmlyZShcImNyZWF0ZWRcIiwgbmFtZSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2NyaXB0IGF0dHJpYnV0ZSBmb3IgdGhlIGN1cnJlbnQgc2NyaXB0LiBUaGUgc2NyaXB0IGF0dHJpYnV0ZSBjYW4gYmUgYWNjZXNzZWRcbiAgICAgKiBpbnNpZGUgdGhlIHNjcmlwdCBpbnN0YW5jZSBsaWtlIHNvICd0aGlzLmF0dHJpYnV0ZU5hbWUnIG9yIG91dHNpZGUgYSBzY3JpcHQgaW5zdGFuY2UgbGlrZSBzb1xuICAgICAqICdlbnRpdHkuc2NyaXB0LmF0dHJpYnV0ZU5hbWUnLiBTY3JpcHQgYXR0cmlidXRlcyBjYW4gYmUgZWRpdGVkIGZyb20gdGhlIEF0dHJpYnV0ZSBFZGl0b3Igb2ZcbiAgICAgKiB0aGUgUGxheUNhbnZhcyBFZGl0b3IgbGlrZSBub3JtYWwgQ29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIHRoZSBhdHRyaWJ1dGUuIENhbiBiZTogJ251bWJlcicsICdzdHJpbmcnLCAnYm9vbGVhbicsXG4gICAgICogJ2Fzc2V0JywgJ2VudGl0eScsICdyZ2InLCAncmdiYScsICd2ZWN0b3InLCAnZW51bWVyYXRpb24nLCAnY3VydmUnLCAnY29sb3JjdXJ2ZScuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRlZmF1bHRWYWx1ZSAtIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPcHRpb25hbCBwYXJhbWV0ZXJzIGZvciB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcHRpb25zLm1pbiAtIFRoZSBtaW5pbXVtIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9wdGlvbnMubWF4IC0gVGhlIG1heGltdW0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3B0aW9ucy5zdGVwIC0gVGhlIHN0ZXAgdGhhdCB3aWxsIGJlIHVzZWQgd2hlbiBjaGFuZ2luZyB0aGUgYXR0cmlidXRlIHZhbHVlXG4gICAgICogaW4gdGhlIFBsYXlDYW52YXMgRWRpdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcHRpb25zLmRlY2ltYWxQcmVjaXNpb24gLSBBIG51bWJlciB0aGF0IHNwZWNpZmllcyB0aGUgbnVtYmVyIG9mIGRlY2ltYWxcbiAgICAgKiBkaWdpdHMgYWxsb3dlZCBmb3IgdGhlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IG9wdGlvbnMuZW51bWVyYXRpb25zIC0gQW4gYXJyYXkgb2YgbmFtZSwgdmFsdWUgcGFpcnMgZnJvbSB3aGljaCB0aGUgdXNlclxuICAgICAqIGNhbiBzZWxlY3Qgb25lIGlmIHRoZSBhdHRyaWJ1dGUgdHlwZSBpcyBhbiBlbnVtZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBvcHRpb25zLmN1cnZlcyAtIChGb3IgJ2N1cnZlJyBhdHRyaWJ1dGVzIG9ubHkpIEFuIGFycmF5IG9mIHN0cmluZ3MgdGhhdFxuICAgICAqIGRlZmluZSB0aGUgbmFtZXMgb2YgZWFjaCBjdXJ2ZSBpbiB0aGUgY3VydmUgZWRpdG9yLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0aW9ucy5jb2xvciAtIChGb3IgJ2N1cnZlJyBhdHRyaWJ1dGVzIG9ubHkpIElmIHRydWUgdGhlbiB0aGUgY3VydmVcbiAgICAgKiBhdHRyaWJ1dGUgd2lsbCBiZSBhIGNvbG9yIGN1cnZlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuc2NyaXB0LmF0dHJpYnV0ZSgnc3BlZWQnLCAnbnVtYmVyJywgNSk7XG4gICAgICogcGMuc2NyaXB0LmF0dHJpYnV0ZSgnbWVzc2FnZScsICdzdHJpbmcnLCBcIk15IG1lc3NhZ2VcIik7XG4gICAgICogcGMuc2NyaXB0LmF0dHJpYnV0ZSgnZW5lbXlQb3NpdGlvbicsICd2ZWN0b3InLCBbMSwgMCwgMF0pO1xuICAgICAqIHBjLnNjcmlwdC5hdHRyaWJ1dGUoJ3NwZWxsVHlwZScsICdlbnVtZXJhdGlvbicsIDAsIHtcbiAgICAgKiAgICAgZW51bWVyYXRpb25zOiBbe1xuICAgICAqICAgICAgICAgbmFtZTogXCJGaXJlXCIsXG4gICAgICogICAgICAgICB2YWx1ZTogMFxuICAgICAqICAgICB9LCB7XG4gICAgICogICAgICAgICBuYW1lOiBcIkljZVwiLFxuICAgICAqICAgICAgICAgdmFsdWU6IDFcbiAgICAgKiAgICAgfV1cbiAgICAgKiB9KTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdlbmVteScsICdlbnRpdHknKTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdlbmVteVNwZWVkJywgJ2N1cnZlJyk7XG4gICAgICogcGMuc2NyaXB0LmF0dHJpYnV0ZSgnZW5lbXlQb3NpdGlvbicsICdjdXJ2ZScsIG51bGwsIHtcbiAgICAgKiAgICAgY3VydmVzOiBbJ3gnLCAneScsICd6J11cbiAgICAgKiB9KTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdjb2xvcicsICdjb2xvcmN1cnZlJywgbnVsbCwge1xuICAgICAqICAgICB0eXBlOiAncmdiYSdcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHBjLnNjcmlwdC5jcmVhdGUoJ3NjcmlwdGFibGUnLCBmdW5jdGlvbiAoYXBwKSB7XG4gICAgICogICAgIHZhciBTY3JpcHRhYmxlID0gZnVuY3Rpb24gKGVudGl0eSkge1xuICAgICAqICAgICAgICAgLy8gc3RvcmUgZW50aXR5XG4gICAgICogICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcbiAgICAgKiAgICAgfTtcbiAgICAgKlxuICAgICAqICAgICByZXR1cm4gU2NyaXB0YWJsZTtcbiAgICAgKiB9KTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXR0cmlidXRlKG5hbWUsIHR5cGUsIGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICAgICAgICAvLyBvbmx5IHdvcmtzIHdoZW4gcGFyc2luZyB0aGUgc2NyaXB0Li4uXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEhhbmRsZXMgdGhlIGNyZWF0aW9uIG9mIHRoZSBsb2FkaW5nIHNjcmVlbiBvZiB0aGUgYXBwbGljYXRpb24uIEEgc2NyaXB0IGNhbiBzdWJzY3JpYmUgdG8gdGhlXG4gICAgICogZXZlbnRzIG9mIGEge0BsaW5rIEFwcEJhc2V9IHRvIHNob3cgYSBsb2FkaW5nIHNjcmVlbiwgcHJvZ3Jlc3MgYmFyIGV0Yy4gSW4gb3JkZXIgZm9yXG4gICAgICogdGhpcyB0byB3b3JrIHlvdSBuZWVkIHRvIHNldCB0aGUgcHJvamVjdCdzIGxvYWRpbmcgc2NyZWVuIHNjcmlwdCB0byB0aGUgc2NyaXB0IHRoYXQgY2FsbHNcbiAgICAgKiB0aGlzIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Q3JlYXRlU2NyZWVuQ2FsbGJhY2t9IGNhbGxiYWNrIC0gQSBmdW5jdGlvbiB3aGljaCBjYW4gc2V0IHVwIGFuZCB0ZWFyIGRvd24gYVxuICAgICAqIGN1c3RvbWl6ZWQgbG9hZGluZyBzY3JlZW4uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5zY3JpcHQuY3JlYXRlTG9hZGluZ1NjcmVlbihmdW5jdGlvbiAoYXBwKSB7XG4gICAgICogICAgIHZhciBzaG93U3BsYXNoU2NyZWVuID0gZnVuY3Rpb24gKCkge307XG4gICAgICogICAgIHZhciBoaWRlU3BsYXNoU2NyZWVuID0gZnVuY3Rpb24gKCkge307XG4gICAgICogICAgIHZhciBzaG93UHJvZ3Jlc3MgPSBmdW5jdGlvbiAocHJvZ3Jlc3MpIHt9O1xuICAgICAqICAgICBhcHAub24oXCJwcmVsb2FkOnN0YXJ0XCIsIHNob3dTcGxhc2hTY3JlZW4pO1xuICAgICAqICAgICBhcHAub24oXCJwcmVsb2FkOnByb2dyZXNzXCIsIHNob3dQcm9ncmVzcyk7XG4gICAgICogICAgIGFwcC5vbihcInN0YXJ0XCIsIGhpZGVTcGxhc2hTY3JlZW4pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNyZWF0ZUxvYWRpbmdTY3JlZW4oY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKF9jcmVhdGVkTG9hZGluZ1NjcmVlbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBfY3JlYXRlZExvYWRpbmdTY3JlZW4gPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IGFwcCA9IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgICAgIGNhbGxiYWNrKGFwcCk7XG4gICAgfVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNjcmlwdCwgJ2xlZ2FjeScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF9sZWdhY3k7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBfbGVnYWN5ID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbmV2ZW50cy5hdHRhY2goc2NyaXB0KTtcblxuZXhwb3J0IHsgc2NyaXB0IH07XG4iXSwibmFtZXMiOlsiX2xlZ2FjeSIsIl9jcmVhdGVkTG9hZGluZ1NjcmVlbiIsInNjcmlwdCIsImFwcCIsImNyZWF0ZSIsIm5hbWUiLCJjYWxsYmFjayIsIlNjcmlwdFR5cGUiLCJfcGNTY3JpcHROYW1lIiwiU2NyaXB0VHlwZXMiLCJwdXNoIiwiZmlyZSIsImF0dHJpYnV0ZSIsInR5cGUiLCJkZWZhdWx0VmFsdWUiLCJvcHRpb25zIiwiY3JlYXRlTG9hZGluZ1NjcmVlbiIsImdldEFwcGxpY2F0aW9uIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJzZXQiLCJ2YWx1ZSIsImV2ZW50cyIsImF0dGFjaCJdLCJtYXBwaW5ncyI6Ijs7OztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLElBQUlBLE9BQU8sR0FBRyxLQUFLLENBQUE7O0FBRW5CO0FBQ0E7QUFDQSxJQUFJQyxxQkFBcUIsR0FBRyxLQUFLLENBQUE7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxHQUFHO0FBQ1g7QUFDQUMsRUFBQUEsR0FBRyxFQUFFLElBQUk7QUFFVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxNQUFNQSxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBRTtJQUNuQixJQUFJLENBQUNOLE9BQU8sRUFDUixPQUFBOztBQUVKO0FBQ0EsSUFBQSxNQUFNTyxVQUFVLEdBQUdELFFBQVEsQ0FBQ0osTUFBTSxDQUFDQyxHQUFHLENBQUMsQ0FBQTs7QUFFdkM7SUFDQUksVUFBVSxDQUFDQyxhQUFhLEdBQUdILElBQUksQ0FBQTs7QUFFL0I7QUFDQUksSUFBQUEsV0FBVyxDQUFDQyxJQUFJLENBQUNILFVBQVUsRUFBRVAsT0FBTyxDQUFDLENBQUE7SUFFckMsSUFBSSxDQUFDVyxJQUFJLENBQUMsU0FBUyxFQUFFTixJQUFJLEVBQUVDLFFBQVEsQ0FBQyxDQUFBO0dBQ3ZDO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSU0sU0FBU0EsQ0FBQ1AsSUFBSSxFQUFFUSxJQUFJLEVBQUVDLFlBQVksRUFBRUMsT0FBTyxFQUFFO0FBQ3pDO0dBQ0g7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsbUJBQW1CQSxDQUFDVixRQUFRLEVBQUU7QUFDMUIsSUFBQSxJQUFJTCxxQkFBcUIsRUFDckIsT0FBQTtBQUVKQSxJQUFBQSxxQkFBcUIsR0FBRyxJQUFJLENBQUE7QUFFNUIsSUFBQSxNQUFNRSxHQUFHLEdBQUdjLGNBQWMsRUFBRSxDQUFBO0lBQzVCWCxRQUFRLENBQUNILEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLEdBQUE7QUFDSixFQUFDO0FBRURlLE1BQU0sQ0FBQ0MsY0FBYyxDQUFDakIsTUFBTSxFQUFFLFFBQVEsRUFBRTtFQUNwQ2tCLEdBQUcsRUFBRSxZQUFZO0FBQ2IsSUFBQSxPQUFPcEIsT0FBTyxDQUFBO0dBQ2pCO0FBQ0RxQixFQUFBQSxHQUFHLEVBQUUsVUFBVUMsS0FBSyxFQUFFO0FBQ2xCdEIsSUFBQUEsT0FBTyxHQUFHc0IsS0FBSyxDQUFBO0FBQ25CLEdBQUE7QUFDSixDQUFDLENBQUMsQ0FBQTtBQUVGQyxNQUFNLENBQUNDLE1BQU0sQ0FBQ3RCLE1BQU0sQ0FBQzs7OzsifQ==
