import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Asset } from '../asset/asset.js';

const components = ['x', 'y', 'z', 'w'];
const vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];
function rawToValue(app, args, value, old) {
  switch (args.type) {
    case 'boolean':
      return !!value;
    case 'number':
      if (typeof value === 'number') {
        return value;
      } else if (typeof value === 'string') {
        const v = parseInt(value, 10);
        if (isNaN(v)) return null;
        return v;
      } else if (typeof value === 'boolean') {
        return 0 + value;
      }
      return null;
    case 'json':
      {
        const result = {};
        if (Array.isArray(args.schema)) {
          if (!value || typeof value !== 'object') {
            value = {};
          }
          for (let i = 0; i < args.schema.length; i++) {
            const field = args.schema[i];
            if (!field.name) continue;
            if (field.array) {
              result[field.name] = [];
              const arr = Array.isArray(value[field.name]) ? value[field.name] : [];
              for (let j = 0; j < arr.length; j++) {
                result[field.name].push(rawToValue(app, field, arr[j]));
              }
            } else {
              // use the value of the field as it's passed into rawToValue otherwise
              // use the default field value
              const val = value.hasOwnProperty(field.name) ? value[field.name] : field.default;
              result[field.name] = rawToValue(app, field, val);
            }
          }
        }
        return result;
      }
    case 'asset':
      if (value instanceof Asset) {
        return value;
      } else if (typeof value === 'number') {
        return app.assets.get(value) || null;
      } else if (typeof value === 'string') {
        return app.assets.get(parseInt(value, 10)) || null;
      }
      return null;
    case 'entity':
      if (value instanceof GraphNode) {
        return value;
      } else if (typeof value === 'string') {
        return app.getEntityFromIndex(value);
      }
      return null;
    case 'rgb':
    case 'rgba':
      if (value instanceof Color) {
        if (old instanceof Color) {
          old.copy(value);
          return old;
        }
        return value.clone();
      } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'number') return null;
        }
        if (!old) old = new Color();
        old.r = value[0];
        old.g = value[1];
        old.b = value[2];
        old.a = value.length === 3 ? 1 : value[3];
        return old;
      } else if (typeof value === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
        if (!old) old = new Color();
        old.fromString(value);
        return old;
      }
      return null;
    case 'vec2':
    case 'vec3':
    case 'vec4':
      {
        const len = parseInt(args.type.slice(3), 10);
        const vecType = vecLookup[len];
        if (value instanceof vecType) {
          if (old instanceof vecType) {
            old.copy(value);
            return old;
          }
          return value.clone();
        } else if (value instanceof Array && value.length === len) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'number') return null;
          }
          if (!old) old = new vecType();
          for (let i = 0; i < len; i++) old[components[i]] = value[i];
          return old;
        }
        return null;
      }
    case 'curve':
      if (value) {
        let curve;
        if (value instanceof Curve || value instanceof CurveSet) {
          curve = value.clone();
        } else {
          const CurveType = value.keys[0] instanceof Array ? CurveSet : Curve;
          curve = new CurveType(value.keys);
          curve.type = value.type;
        }
        return curve;
      }
      break;
  }
  return value;
}

/**
 * Container of Script Attribute definitions. Implements an interface to add/remove attributes and
 * store their definition for a {@link ScriptType}. Note: An instance of ScriptAttributes is
 * created automatically by each {@link ScriptType}.
 *
 * @category Script
 */
class ScriptAttributes {
  /**
   * Create a new ScriptAttributes instance.
   *
   * @param {Class<import('./script-type.js').ScriptType>} scriptType - Script Type that attributes relate to.
   */
  constructor(scriptType) {
    this.scriptType = scriptType;
    this.index = {};
  }
  /**
   * Add Attribute.
   *
   * @param {string} name - Name of an attribute.
   * @param {object} args - Object with Arguments for an attribute.
   * @param {("boolean"|"number"|"string"|"json"|"asset"|"entity"|"rgb"|"rgba"|"vec2"|"vec3"|"vec4"|"curve")} args.type - Type
   * of an attribute value.  Can be:
   *
   * - "asset"
   * - "boolean"
   * - "curve"
   * - "entity"
   * - "json"
   * - "number"
   * - "rgb"
   * - "rgba"
   * - "string"
   * - "vec2"
   * - "vec3"
   * - "vec4"
   *
   * @param {*} [args.default] - Default attribute value.
   * @param {string} [args.title] - Title for Editor's for field UI.
   * @param {string} [args.description] - Description for Editor's for field UI.
   * @param {string|string[]} [args.placeholder] - Placeholder for Editor's for field UI.
   * For multi-field types, such as vec2, vec3, and others use array of strings.
   * @param {boolean} [args.array] - If attribute can hold single or multiple values.
   * @param {number} [args.size] - If attribute is array, maximum number of values can be set.
   * @param {number} [args.min] - Minimum value for type 'number', if max and min defined, slider
   * will be rendered in Editor's UI.
   * @param {number} [args.max] - Maximum value for type 'number', if max and min defined, slider
   * will be rendered in Editor's UI.
   * @param {number} [args.precision] - Level of precision for field type 'number' with floating
   * values.
   * @param {number} [args.step] - Step value for type 'number'. The amount used to increment the
   * value when using the arrow keys in the Editor's UI.
   * @param {string} [args.assetType] - Name of asset type to be used in 'asset' type attribute
   * picker in Editor's UI, defaults to '*' (all).
   * @param {string[]} [args.curves] - List of names for Curves for field type 'curve'.
   * @param {string} [args.color] - String of color channels for Curves for field type 'curve',
   * can be any combination of `rgba` characters. Defining this property will render Gradient in
   * Editor's field UI.
   * @param {object[]} [args.enum] - List of fixed choices for field, defined as array of objects,
   * where key in object is a title of an option.
   * @param {object[]} [args.schema] - List of attributes for type 'json'. Each attribute
   * description is an object with the same properties as regular script attributes but with an
   * added 'name' field to specify the name of each attribute in the JSON.
   * @example
   * PlayerController.attributes.add('fullName', {
   *     type: 'string'
   * });
   * @example
   * PlayerController.attributes.add('speed', {
   *     type: 'number',
   *     title: 'Speed',
   *     placeholder: 'km/h',
   *     default: 22.2
   * });
   * @example
   * PlayerController.attributes.add('resolution', {
   *     type: 'number',
   *     default: 32,
   *     enum: [
   *         { '32x32': 32 },
   *         { '64x64': 64 },
   *         { '128x128': 128 }
   *     ]
   * });
   * @example
   * PlayerController.attributes.add('config', {
   *     type: 'json',
   *     schema: [{
   *         name: 'speed',
   *         type: 'number',
   *         title: 'Speed',
   *         placeholder: 'km/h',
   *         default: 22.2
   *     }, {
   *         name: 'resolution',
   *         type: 'number',
   *         default: 32,
   *         enum: [
   *             { '32x32': 32 },
   *             { '64x64': 64 },
   *             { '128x128': 128 }
   *         ]
   *     }]
   * });
   */
  add(name, args) {
    if (this.index[name]) {
      Debug.warn(`attribute '${name}' is already defined for script type '${this.scriptType.name}'`);
      return;
    } else if (ScriptAttributes.reservedNames.has(name)) {
      Debug.warn(`attribute '${name}' is a reserved attribute name`);
      return;
    }
    this.index[name] = args;
    Object.defineProperty(this.scriptType.prototype, name, {
      get: function () {
        return this.__attributes[name];
      },
      set: function (raw) {
        const evt = 'attr';
        const evtName = 'attr:' + name;
        const old = this.__attributes[name];
        // keep copy of old for the event below
        let oldCopy = old;
        // json types might have a 'clone' field in their
        // schema so make sure it's not that
        // entities should not be cloned as well
        if (old && args.type !== 'json' && args.type !== 'entity' && old.clone) {
          // check if an event handler is there
          // before cloning for performance
          if (this.hasEvent(evt) || this.hasEvent(evtName)) {
            oldCopy = old.clone();
          }
        }

        // convert to appropriate type
        if (args.array) {
          this.__attributes[name] = [];
          if (raw) {
            for (let i = 0, len = raw.length; i < len; i++) {
              this.__attributes[name].push(rawToValue(this.app, args, raw[i], old ? old[i] : null));
            }
          }
        } else {
          this.__attributes[name] = rawToValue(this.app, args, raw, old);
        }
        this.fire(evt, name, this.__attributes[name], oldCopy);
        this.fire(evtName, this.__attributes[name], oldCopy);
      }
    });
  }

  /**
   * Remove Attribute.
   *
   * @param {string} name - Name of an attribute.
   * @returns {boolean} True if removed or false if not defined.
   * @example
   * PlayerController.attributes.remove('fullName');
   */
  remove(name) {
    if (!this.index[name]) return false;
    delete this.index[name];
    delete this.scriptType.prototype[name];
    return true;
  }

  /**
   * Detect if Attribute is added.
   *
   * @param {string} name - Name of an attribute.
   * @returns {boolean} True if Attribute is defined.
   * @example
   * if (PlayerController.attributes.has('fullName')) {
   *     // attribute fullName is defined
   * }
   */
  has(name) {
    return !!this.index[name];
  }

  /**
   * Get object with attribute arguments. Note: Changing argument properties will not affect
   * existing Script Instances.
   *
   * @param {string} name - Name of an attribute.
   * @returns {?object} Arguments with attribute properties.
   * @example
   * // changing default value for an attribute 'fullName'
   * var attr = PlayerController.attributes.get('fullName');
   * if (attr) attr.default = 'Unknown';
   */
  get(name) {
    return this.index[name] || null;
  }
}
ScriptAttributes.reservedNames = new Set(['app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed', '__attributes', '__attributesRaw', '__scriptType', '__executionOrder', '_callbacks', '_callbackActive', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent']);

export { ScriptAttributes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LWF0dHJpYnV0ZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NyaXB0L3NjcmlwdC1hdHRyaWJ1dGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBDdXJ2ZSB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBDdXJ2ZVNldCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi9hc3NldC9hc3NldC5qcyc7XG5cbmNvbnN0IGNvbXBvbmVudHMgPSBbJ3gnLCAneScsICd6JywgJ3cnXTtcbmNvbnN0IHZlY0xvb2t1cCA9IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgVmVjMiwgVmVjMywgVmVjNF07XG5cbmZ1bmN0aW9uIHJhd1RvVmFsdWUoYXBwLCBhcmdzLCB2YWx1ZSwgb2xkKSB7XG4gICAgc3dpdGNoIChhcmdzLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICByZXR1cm4gISF2YWx1ZTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdiA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKHYpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMCArIHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGNhc2UgJ2pzb24nOiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSB7fTtcblxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXJncy5zY2hlbWEpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0ge307XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLnNjaGVtYS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IGFyZ3Muc2NoZW1hW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZpZWxkLm5hbWUpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZC5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZpZWxkLm5hbWVdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFyciA9IEFycmF5LmlzQXJyYXkodmFsdWVbZmllbGQubmFtZV0pID8gdmFsdWVbZmllbGQubmFtZV0gOiBbXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBhcnIubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZmllbGQubmFtZV0ucHVzaChyYXdUb1ZhbHVlKGFwcCwgZmllbGQsIGFycltqXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHRoZSB2YWx1ZSBvZiB0aGUgZmllbGQgYXMgaXQncyBwYXNzZWQgaW50byByYXdUb1ZhbHVlIG90aGVyd2lzZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHRoZSBkZWZhdWx0IGZpZWxkIHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWwgPSB2YWx1ZS5oYXNPd25Qcm9wZXJ0eShmaWVsZC5uYW1lKSA/IHZhbHVlW2ZpZWxkLm5hbWVdIDogZmllbGQuZGVmYXVsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmaWVsZC5uYW1lXSA9IHJhd1RvVmFsdWUoYXBwLCBmaWVsZCwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBjYXNlICdhc3NldCc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcHAuYXNzZXRzLmdldCh2YWx1ZSkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcHAuYXNzZXRzLmdldChwYXJzZUludCh2YWx1ZSwgMTApKSB8fCBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGNhc2UgJ2VudGl0eSc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXBwLmdldEVudGl0eUZyb21JbmRleCh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY2FzZSAncmdiJzpcbiAgICAgICAgY2FzZSAncmdiYSc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAgICAgICAgIGlmIChvbGQgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICBvbGQuY29weSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5jbG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHZhbHVlLmxlbmd0aCA+PSAzICYmIHZhbHVlLmxlbmd0aCA8PSA0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2ldICE9PSAnbnVtYmVyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIW9sZCkgb2xkID0gbmV3IENvbG9yKCk7XG5cbiAgICAgICAgICAgICAgICBvbGQuciA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgICAgIG9sZC5nID0gdmFsdWVbMV07XG4gICAgICAgICAgICAgICAgb2xkLmIgPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgICAgICBvbGQuYSA9ICh2YWx1ZS5sZW5ndGggPT09IDMpID8gMSA6IHZhbHVlWzNdO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9sZDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiAvIyhbMC05YWJjZGVmXXsyfSl7Myw0fS9pLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvbGQpXG4gICAgICAgICAgICAgICAgICAgIG9sZCA9IG5ldyBDb2xvcigpO1xuXG4gICAgICAgICAgICAgICAgb2xkLmZyb21TdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY2FzZSAndmVjMic6XG4gICAgICAgIGNhc2UgJ3ZlYzMnOlxuICAgICAgICBjYXNlICd2ZWM0Jzoge1xuICAgICAgICAgICAgY29uc3QgbGVuID0gcGFyc2VJbnQoYXJncy50eXBlLnNsaWNlKDMpLCAxMCk7XG4gICAgICAgICAgICBjb25zdCB2ZWNUeXBlID0gdmVjTG9va3VwW2xlbl07XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHZlY1R5cGUpIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkIGluc3RhbmNlb2YgdmVjVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBvbGQuY29weSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5jbG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHZhbHVlLmxlbmd0aCA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2ldICE9PSAnbnVtYmVyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIW9sZCkgb2xkID0gbmV3IHZlY1R5cGUoKTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIG9sZFtjb21wb25lbnRzW2ldXSA9IHZhbHVlW2ldO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9sZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgJ2N1cnZlJzpcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGxldCBjdXJ2ZTtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBDdXJ2ZSB8fCB2YWx1ZSBpbnN0YW5jZW9mIEN1cnZlU2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnZlID0gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBDdXJ2ZVR5cGUgPSB2YWx1ZS5rZXlzWzBdIGluc3RhbmNlb2YgQXJyYXkgPyBDdXJ2ZVNldCA6IEN1cnZlO1xuICAgICAgICAgICAgICAgICAgICBjdXJ2ZSA9IG5ldyBDdXJ2ZVR5cGUodmFsdWUua2V5cyk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnZlLnR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogQ29udGFpbmVyIG9mIFNjcmlwdCBBdHRyaWJ1dGUgZGVmaW5pdGlvbnMuIEltcGxlbWVudHMgYW4gaW50ZXJmYWNlIHRvIGFkZC9yZW1vdmUgYXR0cmlidXRlcyBhbmRcbiAqIHN0b3JlIHRoZWlyIGRlZmluaXRpb24gZm9yIGEge0BsaW5rIFNjcmlwdFR5cGV9LiBOb3RlOiBBbiBpbnN0YW5jZSBvZiBTY3JpcHRBdHRyaWJ1dGVzIGlzXG4gKiBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgYnkgZWFjaCB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gKlxuICogQGNhdGVnb3J5IFNjcmlwdFxuICovXG5jbGFzcyBTY3JpcHRBdHRyaWJ1dGVzIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2NyaXB0QXR0cmlidXRlcyBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Q2xhc3M8aW1wb3J0KCcuL3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IHNjcmlwdFR5cGUgLSBTY3JpcHQgVHlwZSB0aGF0IGF0dHJpYnV0ZXMgcmVsYXRlIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgdGhpcy5zY3JpcHRUeXBlID0gc2NyaXB0VHlwZTtcbiAgICAgICAgdGhpcy5pbmRleCA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyByZXNlcnZlZE5hbWVzID0gbmV3IFNldChbXG4gICAgICAgICdhcHAnLCAnZW50aXR5JywgJ2VuYWJsZWQnLCAnX2VuYWJsZWQnLCAnX2VuYWJsZWRPbGQnLCAnX2Rlc3Ryb3llZCcsXG4gICAgICAgICdfX2F0dHJpYnV0ZXMnLCAnX19hdHRyaWJ1dGVzUmF3JywgJ19fc2NyaXB0VHlwZScsICdfX2V4ZWN1dGlvbk9yZGVyJyxcbiAgICAgICAgJ19jYWxsYmFja3MnLCAnX2NhbGxiYWNrQWN0aXZlJywgJ2hhcycsICdnZXQnLCAnb24nLCAnb2ZmJywgJ2ZpcmUnLCAnb25jZScsICdoYXNFdmVudCdcbiAgICBdKTtcblxuICAgIC8qKlxuICAgICAqIEFkZCBBdHRyaWJ1dGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgYW4gYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBhcmdzIC0gT2JqZWN0IHdpdGggQXJndW1lbnRzIGZvciBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHsoXCJib29sZWFuXCJ8XCJudW1iZXJcInxcInN0cmluZ1wifFwianNvblwifFwiYXNzZXRcInxcImVudGl0eVwifFwicmdiXCJ8XCJyZ2JhXCJ8XCJ2ZWMyXCJ8XCJ2ZWMzXCJ8XCJ2ZWM0XCJ8XCJjdXJ2ZVwiKX0gYXJncy50eXBlIC0gVHlwZVxuICAgICAqIG9mIGFuIGF0dHJpYnV0ZSB2YWx1ZS4gIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiXG4gICAgICogLSBcImJvb2xlYW5cIlxuICAgICAqIC0gXCJjdXJ2ZVwiXG4gICAgICogLSBcImVudGl0eVwiXG4gICAgICogLSBcImpzb25cIlxuICAgICAqIC0gXCJudW1iZXJcIlxuICAgICAqIC0gXCJyZ2JcIlxuICAgICAqIC0gXCJyZ2JhXCJcbiAgICAgKiAtIFwic3RyaW5nXCJcbiAgICAgKiAtIFwidmVjMlwiXG4gICAgICogLSBcInZlYzNcIlxuICAgICAqIC0gXCJ2ZWM0XCJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZ3MuZGVmYXVsdF0gLSBEZWZhdWx0IGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2FyZ3MudGl0bGVdIC0gVGl0bGUgZm9yIEVkaXRvcidzIGZvciBmaWVsZCBVSS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2FyZ3MuZGVzY3JpcHRpb25dIC0gRGVzY3JpcHRpb24gZm9yIEVkaXRvcidzIGZvciBmaWVsZCBVSS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gW2FyZ3MucGxhY2Vob2xkZXJdIC0gUGxhY2Vob2xkZXIgZm9yIEVkaXRvcidzIGZvciBmaWVsZCBVSS5cbiAgICAgKiBGb3IgbXVsdGktZmllbGQgdHlwZXMsIHN1Y2ggYXMgdmVjMiwgdmVjMywgYW5kIG90aGVycyB1c2UgYXJyYXkgb2Ygc3RyaW5ncy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthcmdzLmFycmF5XSAtIElmIGF0dHJpYnV0ZSBjYW4gaG9sZCBzaW5nbGUgb3IgbXVsdGlwbGUgdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJncy5zaXplXSAtIElmIGF0dHJpYnV0ZSBpcyBhcnJheSwgbWF4aW11bSBudW1iZXIgb2YgdmFsdWVzIGNhbiBiZSBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthcmdzLm1pbl0gLSBNaW5pbXVtIHZhbHVlIGZvciB0eXBlICdudW1iZXInLCBpZiBtYXggYW5kIG1pbiBkZWZpbmVkLCBzbGlkZXJcbiAgICAgKiB3aWxsIGJlIHJlbmRlcmVkIGluIEVkaXRvcidzIFVJLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJncy5tYXhdIC0gTWF4aW11bSB2YWx1ZSBmb3IgdHlwZSAnbnVtYmVyJywgaWYgbWF4IGFuZCBtaW4gZGVmaW5lZCwgc2xpZGVyXG4gICAgICogd2lsbCBiZSByZW5kZXJlZCBpbiBFZGl0b3IncyBVSS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MucHJlY2lzaW9uXSAtIExldmVsIG9mIHByZWNpc2lvbiBmb3IgZmllbGQgdHlwZSAnbnVtYmVyJyB3aXRoIGZsb2F0aW5nXG4gICAgICogdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJncy5zdGVwXSAtIFN0ZXAgdmFsdWUgZm9yIHR5cGUgJ251bWJlcicuIFRoZSBhbW91bnQgdXNlZCB0byBpbmNyZW1lbnQgdGhlXG4gICAgICogdmFsdWUgd2hlbiB1c2luZyB0aGUgYXJyb3cga2V5cyBpbiB0aGUgRWRpdG9yJ3MgVUkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFthcmdzLmFzc2V0VHlwZV0gLSBOYW1lIG9mIGFzc2V0IHR5cGUgdG8gYmUgdXNlZCBpbiAnYXNzZXQnIHR5cGUgYXR0cmlidXRlXG4gICAgICogcGlja2VyIGluIEVkaXRvcidzIFVJLCBkZWZhdWx0cyB0byAnKicgKGFsbCkuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW2FyZ3MuY3VydmVzXSAtIExpc3Qgb2YgbmFtZXMgZm9yIEN1cnZlcyBmb3IgZmllbGQgdHlwZSAnY3VydmUnLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbYXJncy5jb2xvcl0gLSBTdHJpbmcgb2YgY29sb3IgY2hhbm5lbHMgZm9yIEN1cnZlcyBmb3IgZmllbGQgdHlwZSAnY3VydmUnLFxuICAgICAqIGNhbiBiZSBhbnkgY29tYmluYXRpb24gb2YgYHJnYmFgIGNoYXJhY3RlcnMuIERlZmluaW5nIHRoaXMgcHJvcGVydHkgd2lsbCByZW5kZXIgR3JhZGllbnQgaW5cbiAgICAgKiBFZGl0b3IncyBmaWVsZCBVSS5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSBbYXJncy5lbnVtXSAtIExpc3Qgb2YgZml4ZWQgY2hvaWNlcyBmb3IgZmllbGQsIGRlZmluZWQgYXMgYXJyYXkgb2Ygb2JqZWN0cyxcbiAgICAgKiB3aGVyZSBrZXkgaW4gb2JqZWN0IGlzIGEgdGl0bGUgb2YgYW4gb3B0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IFthcmdzLnNjaGVtYV0gLSBMaXN0IG9mIGF0dHJpYnV0ZXMgZm9yIHR5cGUgJ2pzb24nLiBFYWNoIGF0dHJpYnV0ZVxuICAgICAqIGRlc2NyaXB0aW9uIGlzIGFuIG9iamVjdCB3aXRoIHRoZSBzYW1lIHByb3BlcnRpZXMgYXMgcmVndWxhciBzY3JpcHQgYXR0cmlidXRlcyBidXQgd2l0aCBhblxuICAgICAqIGFkZGVkICduYW1lJyBmaWVsZCB0byBzcGVjaWZ5IHRoZSBuYW1lIG9mIGVhY2ggYXR0cmlidXRlIGluIHRoZSBKU09OLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmFkZCgnZnVsbE5hbWUnLCB7XG4gICAgICogICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLmF0dHJpYnV0ZXMuYWRkKCdzcGVlZCcsIHtcbiAgICAgKiAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICogICAgIHRpdGxlOiAnU3BlZWQnLFxuICAgICAqICAgICBwbGFjZWhvbGRlcjogJ2ttL2gnLFxuICAgICAqICAgICBkZWZhdWx0OiAyMi4yXG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLmF0dHJpYnV0ZXMuYWRkKCdyZXNvbHV0aW9uJywge1xuICAgICAqICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgKiAgICAgZGVmYXVsdDogMzIsXG4gICAgICogICAgIGVudW06IFtcbiAgICAgKiAgICAgICAgIHsgJzMyeDMyJzogMzIgfSxcbiAgICAgKiAgICAgICAgIHsgJzY0eDY0JzogNjQgfSxcbiAgICAgKiAgICAgICAgIHsgJzEyOHgxMjgnOiAxMjggfVxuICAgICAqICAgICBdXG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLmF0dHJpYnV0ZXMuYWRkKCdjb25maWcnLCB7XG4gICAgICogICAgIHR5cGU6ICdqc29uJyxcbiAgICAgKiAgICAgc2NoZW1hOiBbe1xuICAgICAqICAgICAgICAgbmFtZTogJ3NwZWVkJyxcbiAgICAgKiAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAqICAgICAgICAgdGl0bGU6ICdTcGVlZCcsXG4gICAgICogICAgICAgICBwbGFjZWhvbGRlcjogJ2ttL2gnLFxuICAgICAqICAgICAgICAgZGVmYXVsdDogMjIuMlxuICAgICAqICAgICB9LCB7XG4gICAgICogICAgICAgICBuYW1lOiAncmVzb2x1dGlvbicsXG4gICAgICogICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgKiAgICAgICAgIGRlZmF1bHQ6IDMyLFxuICAgICAqICAgICAgICAgZW51bTogW1xuICAgICAqICAgICAgICAgICAgIHsgJzMyeDMyJzogMzIgfSxcbiAgICAgKiAgICAgICAgICAgICB7ICc2NHg2NCc6IDY0IH0sXG4gICAgICogICAgICAgICAgICAgeyAnMTI4eDEyOCc6IDEyOCB9XG4gICAgICogICAgICAgICBdXG4gICAgICogICAgIH1dXG4gICAgICogfSk7XG4gICAgICovXG4gICAgYWRkKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhbbmFtZV0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGF0dHJpYnV0ZSAnJHtuYW1lfScgaXMgYWxyZWFkeSBkZWZpbmVkIGZvciBzY3JpcHQgdHlwZSAnJHt0aGlzLnNjcmlwdFR5cGUubmFtZX0nYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAoU2NyaXB0QXR0cmlidXRlcy5yZXNlcnZlZE5hbWVzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgYXR0cmlidXRlICcke25hbWV9JyBpcyBhIHJlc2VydmVkIGF0dHJpYnV0ZSBuYW1lYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluZGV4W25hbWVdID0gYXJncztcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcy5zY3JpcHRUeXBlLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHJhdykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV2dCA9ICdhdHRyJztcbiAgICAgICAgICAgICAgICBjb25zdCBldnROYW1lID0gJ2F0dHI6JyArIG5hbWU7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9fYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIGNvcHkgb2Ygb2xkIGZvciB0aGUgZXZlbnQgYmVsb3dcbiAgICAgICAgICAgICAgICBsZXQgb2xkQ29weSA9IG9sZDtcbiAgICAgICAgICAgICAgICAvLyBqc29uIHR5cGVzIG1pZ2h0IGhhdmUgYSAnY2xvbmUnIGZpZWxkIGluIHRoZWlyXG4gICAgICAgICAgICAgICAgLy8gc2NoZW1hIHNvIG1ha2Ugc3VyZSBpdCdzIG5vdCB0aGF0XG4gICAgICAgICAgICAgICAgLy8gZW50aXRpZXMgc2hvdWxkIG5vdCBiZSBjbG9uZWQgYXMgd2VsbFxuICAgICAgICAgICAgICAgIGlmIChvbGQgJiYgYXJncy50eXBlICE9PSAnanNvbicgJiYgYXJncy50eXBlICE9PSAnZW50aXR5JyAmJiBvbGQuY2xvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgYW4gZXZlbnQgaGFuZGxlciBpcyB0aGVyZVxuICAgICAgICAgICAgICAgICAgICAvLyBiZWZvcmUgY2xvbmluZyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaGFzRXZlbnQoZXZ0KSB8fCB0aGlzLmhhc0V2ZW50KGV2dE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRDb3B5ID0gb2xkLmNsb25lKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIGFwcHJvcHJpYXRlIHR5cGVcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9fYXR0cmlidXRlc1tuYW1lXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmF3KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmF3Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2F0dHJpYnV0ZXNbbmFtZV0ucHVzaChyYXdUb1ZhbHVlKHRoaXMuYXBwLCBhcmdzLCByYXdbaV0sIG9sZCA/IG9sZFtpXSA6IG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX19hdHRyaWJ1dGVzW25hbWVdID0gcmF3VG9WYWx1ZSh0aGlzLmFwcCwgYXJncywgcmF3LCBvbGQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZShldnQsIG5hbWUsIHRoaXMuX19hdHRyaWJ1dGVzW25hbWVdLCBvbGRDb3B5KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoZXZ0TmFtZSwgdGhpcy5fX2F0dHJpYnV0ZXNbbmFtZV0sIG9sZENvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgQXR0cmlidXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIGFuIGF0dHJpYnV0ZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiByZW1vdmVkIG9yIGZhbHNlIGlmIG5vdCBkZWZpbmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLnJlbW92ZSgnZnVsbE5hbWUnKTtcbiAgICAgKi9cbiAgICByZW1vdmUobmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuaW5kZXhbbmFtZV0pXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhbbmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLnNjcmlwdFR5cGUucHJvdG90eXBlW25hbWVdO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlY3QgaWYgQXR0cmlidXRlIGlzIGFkZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIGFuIGF0dHJpYnV0ZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBBdHRyaWJ1dGUgaXMgZGVmaW5lZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChQbGF5ZXJDb250cm9sbGVyLmF0dHJpYnV0ZXMuaGFzKCdmdWxsTmFtZScpKSB7XG4gICAgICogICAgIC8vIGF0dHJpYnV0ZSBmdWxsTmFtZSBpcyBkZWZpbmVkXG4gICAgICogfVxuICAgICAqL1xuICAgIGhhcyhuYW1lKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuaW5kZXhbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IG9iamVjdCB3aXRoIGF0dHJpYnV0ZSBhcmd1bWVudHMuIE5vdGU6IENoYW5naW5nIGFyZ3VtZW50IHByb3BlcnRpZXMgd2lsbCBub3QgYWZmZWN0XG4gICAgICogZXhpc3RpbmcgU2NyaXB0IEluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHJldHVybnMgez9vYmplY3R9IEFyZ3VtZW50cyB3aXRoIGF0dHJpYnV0ZSBwcm9wZXJ0aWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gY2hhbmdpbmcgZGVmYXVsdCB2YWx1ZSBmb3IgYW4gYXR0cmlidXRlICdmdWxsTmFtZSdcbiAgICAgKiB2YXIgYXR0ciA9IFBsYXllckNvbnRyb2xsZXIuYXR0cmlidXRlcy5nZXQoJ2Z1bGxOYW1lJyk7XG4gICAgICogaWYgKGF0dHIpIGF0dHIuZGVmYXVsdCA9ICdVbmtub3duJztcbiAgICAgKi9cbiAgICBnZXQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbmRleFtuYW1lXSB8fCBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NyaXB0QXR0cmlidXRlcyB9O1xuIl0sIm5hbWVzIjpbImNvbXBvbmVudHMiLCJ2ZWNMb29rdXAiLCJ1bmRlZmluZWQiLCJWZWMyIiwiVmVjMyIsIlZlYzQiLCJyYXdUb1ZhbHVlIiwiYXBwIiwiYXJncyIsInZhbHVlIiwib2xkIiwidHlwZSIsInYiLCJwYXJzZUludCIsImlzTmFOIiwicmVzdWx0IiwiQXJyYXkiLCJpc0FycmF5Iiwic2NoZW1hIiwiaSIsImxlbmd0aCIsImZpZWxkIiwibmFtZSIsImFycmF5IiwiYXJyIiwiaiIsInB1c2giLCJ2YWwiLCJoYXNPd25Qcm9wZXJ0eSIsImRlZmF1bHQiLCJBc3NldCIsImFzc2V0cyIsImdldCIsIkdyYXBoTm9kZSIsImdldEVudGl0eUZyb21JbmRleCIsIkNvbG9yIiwiY29weSIsImNsb25lIiwiciIsImciLCJiIiwiYSIsInRlc3QiLCJmcm9tU3RyaW5nIiwibGVuIiwic2xpY2UiLCJ2ZWNUeXBlIiwiY3VydmUiLCJDdXJ2ZSIsIkN1cnZlU2V0IiwiQ3VydmVUeXBlIiwia2V5cyIsIlNjcmlwdEF0dHJpYnV0ZXMiLCJjb25zdHJ1Y3RvciIsInNjcmlwdFR5cGUiLCJpbmRleCIsImFkZCIsIkRlYnVnIiwid2FybiIsInJlc2VydmVkTmFtZXMiLCJoYXMiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsInByb3RvdHlwZSIsIl9fYXR0cmlidXRlcyIsInNldCIsInJhdyIsImV2dCIsImV2dE5hbWUiLCJvbGRDb3B5IiwiaGFzRXZlbnQiLCJmaXJlIiwicmVtb3ZlIiwiU2V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBWUEsTUFBTUEsVUFBVSxH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
