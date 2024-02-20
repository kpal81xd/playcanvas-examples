import { extend } from '../../../core/core.js';
import { events } from '../../../core/events.js';
import { Debug } from '../../../core/debug.js';
import { Color } from '../../../core/math/color.js';
import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { Entity } from '../../entity.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScriptLegacyComponent } from './component.js';
import { ScriptLegacyComponentData } from './data.js';

const _schema = ['enabled', 'scripts', 'instances', 'runInTools'];
const INITIALIZE = 'initialize';
const POST_INITIALIZE = 'postInitialize';
const UPDATE = 'update';
const POST_UPDATE = 'postUpdate';
const FIXED_UPDATE = 'fixedUpdate';
const TOOLS_UPDATE = 'toolsUpdate';
const ON_ENABLE = 'onEnable';
const ON_DISABLE = 'onDisable';
class ScriptLegacyComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'script';
    this.ComponentType = ScriptLegacyComponent;
    this.DataType = ScriptLegacyComponentData;
    this.schema = _schema;

    // used by application during preloading phase to ensure scripts aren't
    // initialized until everything is loaded
    this.preloading = false;

    // arrays to cache script instances for fast iteration
    this.instancesWithUpdate = [];
    this.instancesWithFixedUpdate = [];
    this.instancesWithPostUpdate = [];
    this.instancesWithToolsUpdate = [];
    this.on('beforeremove', this.onBeforeRemove, this);
    this.app.systems.on(INITIALIZE, this.onInitialize, this);
    this.app.systems.on(POST_INITIALIZE, this.onPostInitialize, this);
    this.app.systems.on(UPDATE, this.onUpdate, this);
    this.app.systems.on(FIXED_UPDATE, this.onFixedUpdate, this);
    this.app.systems.on(POST_UPDATE, this.onPostUpdate, this);
    this.app.systems.on(TOOLS_UPDATE, this.onToolsUpdate, this);
  }
  initializeComponentData(component, data, properties) {
    properties = ['runInTools', 'enabled', 'scripts'];

    // convert attributes array to dictionary
    if (data.scripts && data.scripts.length) {
      data.scripts.forEach(function (script) {
        if (script.attributes && Array.isArray(script.attributes)) {
          const dict = {};
          for (let i = 0; i < script.attributes.length; i++) {
            dict[script.attributes[i].name] = script.attributes[i];
          }
          script.attributes = dict;
        }
      });
    }
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    // overridden to make sure urls list is duplicated
    const src = this.store[entity.getGuid()];
    const data = {
      runInTools: src.data.runInTools,
      scripts: [],
      enabled: src.data.enabled
    };

    // manually clone scripts so that we don't clone attributes with pc.extend
    // which will result in a stack overflow when extending 'entity' script attributes
    const scripts = src.data.scripts;
    for (let i = 0, len = scripts.length; i < len; i++) {
      const attributes = scripts[i].attributes;
      if (attributes) {
        delete scripts[i].attributes;
      }
      data.scripts.push(extend({}, scripts[i]));
      if (attributes) {
        data.scripts[i].attributes = this._cloneAttributes(attributes);
        scripts[i].attributes = attributes;
      }
    }
    return this.addComponent(clone, data);
  }
  onBeforeRemove(entity, component) {
    // if the script component is enabled
    // call onDisable on all its instances first
    if (component.enabled) {
      this._disableScriptComponent(component);
    }

    // then call destroy on all the script instances
    this._destroyScriptComponent(component);
  }
  onInitialize(root) {
    this._registerInstances(root);
    if (root.enabled) {
      if (root.script && root.script.enabled) {
        this._initializeScriptComponent(root.script);
      }
      const children = root._children;
      for (let i = 0, len = children.length; i < len; i++) {
        if (children[i] instanceof Entity) {
          this.onInitialize(children[i]);
        }
      }
    }
  }
  onPostInitialize(root) {
    if (root.enabled) {
      if (root.script && root.script.enabled) {
        this._postInitializeScriptComponent(root.script);
      }
      const children = root._children;
      for (let i = 0, len = children.length; i < len; i++) {
        if (children[i] instanceof Entity) {
          this.onPostInitialize(children[i]);
        }
      }
    }
  }
  _callInstancesMethod(script, method) {
    const instances = script.data.instances;
    for (const name in instances) {
      if (instances.hasOwnProperty(name)) {
        const instance = instances[name].instance;
        if (instance[method]) {
          instance[method]();
        }
      }
    }
  }
  _initializeScriptComponent(script) {
    this._callInstancesMethod(script, INITIALIZE);
    script.data.initialized = true;

    // check again if the script and the entity are enabled
    // in case they got disabled during initialize
    if (script.enabled && script.entity.enabled) {
      this._enableScriptComponent(script);
    }
  }
  _enableScriptComponent(script) {
    this._callInstancesMethod(script, ON_ENABLE);
  }
  _disableScriptComponent(script) {
    this._callInstancesMethod(script, ON_DISABLE);
  }
  _destroyScriptComponent(script) {
    const instances = script.data.instances;
    for (const name in instances) {
      if (instances.hasOwnProperty(name)) {
        const instance = instances[name].instance;
        if (instance.destroy) {
          instance.destroy();
        }
        if (instance.update) {
          const index = this.instancesWithUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithUpdate.splice(index, 1);
          }
        }
        if (instance.fixedUpdate) {
          const index = this.instancesWithFixedUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithFixedUpdate.splice(index, 1);
          }
        }
        if (instance.postUpdate) {
          const index = this.instancesWithPostUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithPostUpdate.splice(index, 1);
          }
        }
        if (instance.toolsUpdate) {
          const index = this.instancesWithToolsUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithToolsUpdate.splice(index, 1);
          }
        }
        if (script.instances[name].instance === script[name]) {
          delete script[name];
        }
        delete script.instances[name];
      }
    }
  }
  _postInitializeScriptComponent(script) {
    this._callInstancesMethod(script, POST_INITIALIZE);
    script.data.postInitialized = true;
  }
  _updateInstances(method, updateList, dt) {
    for (let i = 0, len = updateList.length; i < len; i++) {
      const item = updateList[i];
      if (item && item.entity && item.entity.enabled && item.entity.script.enabled) {
        item[method](dt);
      }
    }
  }
  onUpdate(dt) {
    this._updateInstances(UPDATE, this.instancesWithUpdate, dt);
  }
  onFixedUpdate(dt) {
    this._updateInstances(FIXED_UPDATE, this.instancesWithFixedUpdate, dt);
  }
  onPostUpdate(dt) {
    this._updateInstances(POST_UPDATE, this.instancesWithPostUpdate, dt);
  }
  onToolsUpdate(dt) {
    this._updateInstances(TOOLS_UPDATE, this.instancesWithToolsUpdate, dt);
  }
  broadcast(name, functionName) {
    Debug.deprecated('ScriptLegacyComponentSystem.broadcast() is deprecated and will be removed soon. Please use: https://developer.playcanvas.com/user-manual/scripting/communication/');
    const args = Array.prototype.slice.call(arguments, 2);
    const dataStore = this.store;
    for (const id in dataStore) {
      if (dataStore.hasOwnProperty(id)) {
        const data = dataStore[id].data;
        if (data.instances[name]) {
          const fn = data.instances[name].instance[functionName];
          if (fn) {
            fn.apply(data.instances[name].instance, args);
          }
        }
      }
    }
  }
  _preRegisterInstance(entity, url, name, instance) {
    if (entity.script) {
      entity.script.data._instances = entity.script.data._instances || {};
      if (entity.script.data._instances[name]) {
        throw Error(`Script name collision '${name}'. Scripts from '${url}' and '${entity.script.data._instances[name].url}' {${entity.getGuid()}}`);
      }
      entity.script.data._instances[name] = {
        url: url,
        name: name,
        instance: instance
      };
    }
  }
  _registerInstances(entity) {
    if (entity.script) {
      if (entity.script.data._instances) {
        entity.script.instances = entity.script.data._instances;
        for (const instanceName in entity.script.instances) {
          const preRegistered = entity.script.instances[instanceName];
          const instance = preRegistered.instance;
          events.attach(instance);
          if (instance.update) {
            this.instancesWithUpdate.push(instance);
          }
          if (instance.fixedUpdate) {
            this.instancesWithFixedUpdate.push(instance);
          }
          if (instance.postUpdate) {
            this.instancesWithPostUpdate.push(instance);
          }
          if (instance.toolsUpdate) {
            this.instancesWithToolsUpdate.push(instance);
          }
          if (entity.script.scripts) {
            this._createAccessors(entity, preRegistered);
          }

          // Make instance accessible from the script component of the Entity
          if (entity.script[instanceName]) {
            throw Error(`Script with name '${instanceName}' is already attached to Script Component`);
          } else {
            entity.script[instanceName] = instance;
          }
        }

        // Remove temp storage
        delete entity.script.data._instances;
      }
    }
    const children = entity._children;
    for (let i = 0, len = children.length; i < len; i++) {
      if (children[i] instanceof Entity) {
        this._registerInstances(children[i]);
      }
    }
  }
  _cloneAttributes(attributes) {
    const result = {};
    for (const key in attributes) {
      if (!attributes.hasOwnProperty(key)) continue;
      if (attributes[key].type !== 'entity') {
        result[key] = extend({}, attributes[key]);
      } else {
        // don't pc.extend an entity
        const val = attributes[key].value;
        delete attributes[key].value;
        result[key] = extend({}, attributes[key]);
        result[key].value = val;
        attributes[key].value = val;
      }
    }
    return result;
  }
  _createAccessors(entity, instance) {
    const len = entity.script.scripts.length;
    const url = instance.url;
    for (let i = 0; i < len; i++) {
      const script = entity.script.scripts[i];
      if (script.url === url) {
        const attributes = script.attributes;
        if (script.name && attributes) {
          for (const key in attributes) {
            if (attributes.hasOwnProperty(key)) {
              this._createAccessor(attributes[key], instance);
            }
          }
          entity.script.data.attributes[script.name] = this._cloneAttributes(attributes);
        }
        break;
      }
    }
  }
  _createAccessor(attribute, instance) {
    const self = this;

    // create copy of attribute data
    // to avoid overwriting the same attribute values
    // that are used by the Editor
    attribute = {
      name: attribute.name,
      value: attribute.value,
      type: attribute.type
    };
    this._convertAttributeValue(attribute);
    Object.defineProperty(instance.instance, attribute.name, {
      get: function () {
        return attribute.value;
      },
      set: function (value) {
        const oldValue = attribute.value;
        attribute.value = value;
        self._convertAttributeValue(attribute);
        instance.instance.fire('set', attribute.name, oldValue, attribute.value);
      },
      configurable: true
    });
  }
  _updateAccessors(entity, instance) {
    const len = entity.script.scripts.length;
    const url = instance.url;
    for (let i = 0; i < len; i++) {
      const scriptComponent = entity.script;
      const script = scriptComponent.scripts[i];
      if (script.url === url) {
        const name = script.name;
        const attributes = script.attributes;
        if (name) {
          if (attributes) {
            // create / update attribute accessors
            for (const key in attributes) {
              if (attributes.hasOwnProperty(key)) {
                this._createAccessor(attributes[key], instance);
              }
            }
          }

          // delete accessors for attributes that no longer exist
          // and fire onAttributeChange when an attribute value changed
          const previousAttributes = scriptComponent.data.attributes[name];
          if (previousAttributes) {
            for (const key in previousAttributes) {
              const oldAttribute = previousAttributes[key];
              if (!(key in attributes)) {
                delete instance.instance[oldAttribute.name];
              } else {
                if (attributes[key].value !== oldAttribute.value) {
                  if (instance.instance.onAttributeChanged) {
                    instance.instance.onAttributeChanged(oldAttribute.name, oldAttribute.value, attributes[key].value);
                  }
                }
              }
            }
          }
          if (attributes) {
            scriptComponent.data.attributes[name] = this._cloneAttributes(attributes);
          } else {
            delete scriptComponent.data.attributes[name];
          }
        }
        break;
      }
    }
  }
  _convertAttributeValue(attribute) {
    if (attribute.type === 'rgb' || attribute.type === 'rgba') {
      if (Array.isArray(attribute.value)) {
        attribute.value = attribute.value.length === 3 ? new Color(attribute.value[0], attribute.value[1], attribute.value[2]) : new Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
      }
    } else if (attribute.type === 'vec2') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec2(attribute.value[0], attribute.value[1]);
    } else if (attribute.type === 'vec3' || attribute.type === 'vector') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec3(attribute.value[0], attribute.value[1], attribute.value[2]);
    } else if (attribute.type === 'vec4') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec4(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
    } else if (attribute.type === 'entity') {
      if (attribute.value !== null && typeof attribute.value === 'string') attribute.value = this.app.root.findByGuid(attribute.value);
    } else if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
      const curveType = attribute.value.keys[0] instanceof Array ? CurveSet : Curve;
      attribute.value = new curveType(attribute.value.keys);

      /* eslint-disable no-self-assign */
      attribute.value.type = attribute.value.type;
      /* eslint-enable no-self-assign */
    }
  }

  destroy() {
    super.destroy();
    this.app.systems.off(INITIALIZE, this.onInitialize, this);
    this.app.systems.off(POST_INITIALIZE, this.onPostInitialize, this);
    this.app.systems.off(UPDATE, this.onUpdate, this);
    this.app.systems.off(FIXED_UPDATE, this.onFixedUpdate, this);
    this.app.systems.off(POST_UPDATE, this.onPostUpdate, this);
    this.app.systems.off(TOOLS_UPDATE, this.onToolsUpdate, this);
  }
}
Component._buildAccessors(ScriptLegacyComponent.prototype, _schema);

export { ScriptLegacyComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0LWxlZ2FjeS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb3JlLmpzJztcbmltcG9ydCB7IGV2ZW50cyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZXZlbnRzLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IEN1cnZlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJztcbmltcG9ydCB7IEN1cnZlU2V0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uLy4uL2VudGl0eS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ3NjcmlwdHMnLFxuICAgICdpbnN0YW5jZXMnLFxuICAgICdydW5JblRvb2xzJ1xuXTtcblxuY29uc3QgSU5JVElBTElaRSA9ICdpbml0aWFsaXplJztcbmNvbnN0IFBPU1RfSU5JVElBTElaRSA9ICdwb3N0SW5pdGlhbGl6ZSc7XG5jb25zdCBVUERBVEUgPSAndXBkYXRlJztcbmNvbnN0IFBPU1RfVVBEQVRFID0gJ3Bvc3RVcGRhdGUnO1xuY29uc3QgRklYRURfVVBEQVRFID0gJ2ZpeGVkVXBkYXRlJztcbmNvbnN0IFRPT0xTX1VQREFURSA9ICd0b29sc1VwZGF0ZSc7XG5jb25zdCBPTl9FTkFCTEUgPSAnb25FbmFibGUnO1xuY29uc3QgT05fRElTQUJMRSA9ICdvbkRpc2FibGUnO1xuXG5jbGFzcyBTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnc2NyaXB0JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhO1xuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgLy8gdXNlZCBieSBhcHBsaWNhdGlvbiBkdXJpbmcgcHJlbG9hZGluZyBwaGFzZSB0byBlbnN1cmUgc2NyaXB0cyBhcmVuJ3RcbiAgICAgICAgLy8gaW5pdGlhbGl6ZWQgdW50aWwgZXZlcnl0aGluZyBpcyBsb2FkZWRcbiAgICAgICAgdGhpcy5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYXJyYXlzIHRvIGNhY2hlIHNjcmlwdCBpbnN0YW5jZXMgZm9yIGZhc3QgaXRlcmF0aW9uXG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlID0gW107XG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlID0gW107XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oSU5JVElBTElaRSwgdGhpcy5vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFBPU1RfSU5JVElBTElaRSwgdGhpcy5vblBvc3RJbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihVUERBVEUsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKEZJWEVEX1VQREFURSwgdGhpcy5vbkZpeGVkVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihQT1NUX1VQREFURSwgdGhpcy5vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFRPT0xTX1VQREFURSwgdGhpcy5vblRvb2xzVXBkYXRlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IFsncnVuSW5Ub29scycsICdlbmFibGVkJywgJ3NjcmlwdHMnXTtcblxuICAgICAgICAvLyBjb252ZXJ0IGF0dHJpYnV0ZXMgYXJyYXkgdG8gZGljdGlvbmFyeVxuICAgICAgICBpZiAoZGF0YS5zY3JpcHRzICYmIGRhdGEuc2NyaXB0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGRhdGEuc2NyaXB0cy5mb3JFYWNoKGZ1bmN0aW9uIChzY3JpcHQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmF0dHJpYnV0ZXMgJiYgQXJyYXkuaXNBcnJheShzY3JpcHQuYXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGljdCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWN0W3NjcmlwdC5hdHRyaWJ1dGVzW2ldLm5hbWVdID0gc2NyaXB0LmF0dHJpYnV0ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQuYXR0cmlidXRlcyA9IGRpY3Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gb3ZlcnJpZGRlbiB0byBtYWtlIHN1cmUgdXJscyBsaXN0IGlzIGR1cGxpY2F0ZWRcbiAgICAgICAgY29uc3Qgc3JjID0gdGhpcy5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIHJ1bkluVG9vbHM6IHNyYy5kYXRhLnJ1bkluVG9vbHMsXG4gICAgICAgICAgICBzY3JpcHRzOiBbXSxcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNyYy5kYXRhLmVuYWJsZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBtYW51YWxseSBjbG9uZSBzY3JpcHRzIHNvIHRoYXQgd2UgZG9uJ3QgY2xvbmUgYXR0cmlidXRlcyB3aXRoIHBjLmV4dGVuZFxuICAgICAgICAvLyB3aGljaCB3aWxsIHJlc3VsdCBpbiBhIHN0YWNrIG92ZXJmbG93IHdoZW4gZXh0ZW5kaW5nICdlbnRpdHknIHNjcmlwdCBhdHRyaWJ1dGVzXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSBzcmMuZGF0YS5zY3JpcHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGF0YS5zY3JpcHRzLnB1c2goZXh0ZW5kKHt9LCBzY3JpcHRzW2ldKSk7XG5cbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5zY3JpcHRzW2ldLmF0dHJpYnV0ZXMgPSB0aGlzLl9jbG9uZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICAgICAgICAgICAgc2NyaXB0c1tpXS5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNjcmlwdCBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAvLyBjYWxsIG9uRGlzYWJsZSBvbiBhbGwgaXRzIGluc3RhbmNlcyBmaXJzdFxuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVTY3JpcHRDb21wb25lbnQoY29tcG9uZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gY2FsbCBkZXN0cm95IG9uIGFsbCB0aGUgc2NyaXB0IGluc3RhbmNlc1xuICAgICAgICB0aGlzLl9kZXN0cm95U2NyaXB0Q29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgb25Jbml0aWFsaXplKHJvb3QpIHtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZXMocm9vdCk7XG5cbiAgICAgICAgaWYgKHJvb3QuZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKHJvb3Quc2NyaXB0ICYmIHJvb3Quc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHJvb3Quc2NyaXB0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSByb290Ll9jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uSW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25Qb3N0SW5pdGlhbGl6ZShyb290KSB7XG4gICAgICAgIGlmIChyb290LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChyb290LnNjcmlwdCAmJiByb290LnNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdEluaXRpYWxpemVTY3JpcHRDb21wb25lbnQocm9vdC5zY3JpcHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHJvb3QuX2NoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25Qb3N0SW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbGxJbnN0YW5jZXNNZXRob2Qoc2NyaXB0LCBtZXRob2QpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gc2NyaXB0LmRhdGEuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBpbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlW21ldGhvZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VbbWV0aG9kXSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBjaGVjayBhZ2FpbiBpZiB0aGUgc2NyaXB0IGFuZCB0aGUgZW50aXR5IGFyZSBlbmFibGVkXG4gICAgICAgIC8vIGluIGNhc2UgdGhleSBnb3QgZGlzYWJsZWQgZHVyaW5nIGluaXRpYWxpemVcbiAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkICYmIHNjcmlwdC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgT05fRU5BQkxFKTtcbiAgICB9XG5cbiAgICBfZGlzYWJsZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIE9OX0RJU0FCTEUpO1xuICAgIH1cblxuICAgIF9kZXN0cm95U2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBzY3JpcHQuZGF0YS5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IGluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UuZGVzdHJveSkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLmZpeGVkVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoRml4ZWRVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoUG9zdFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRvb2xzVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhUb29sc1VwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5pbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2UgPT09IHNjcmlwdFtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0W25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0Lmluc3RhbmNlc1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9wb3N0SW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIFBPU1RfSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLnBvc3RJbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUluc3RhbmNlcyhtZXRob2QsIHVwZGF0ZUxpc3QsIGR0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB1cGRhdGVMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gdXBkYXRlTGlzdFtpXTtcbiAgICAgICAgICAgIGlmIChpdGVtICYmIGl0ZW0uZW50aXR5ICYmIGl0ZW0uZW50aXR5LmVuYWJsZWQgJiYgaXRlbS5lbnRpdHkuc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBpdGVtW21ldGhvZF0oZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlSW5zdGFuY2VzKFVQREFURSwgdGhpcy5pbnN0YW5jZXNXaXRoVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgb25GaXhlZFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoRklYRURfVVBEQVRFLCB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSwgZHQpO1xuICAgIH1cblxuICAgIG9uUG9zdFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoUE9TVF9VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUsIGR0KTtcbiAgICB9XG5cbiAgICBvblRvb2xzVXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUluc3RhbmNlcyhUT09MU19VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgYnJvYWRjYXN0KG5hbWUsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0uYnJvYWRjYXN0KCkgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIHNvb24uIFBsZWFzZSB1c2U6IGh0dHBzOi8vZGV2ZWxvcGVyLnBsYXljYW52YXMuY29tL3VzZXItbWFudWFsL3NjcmlwdGluZy9jb21tdW5pY2F0aW9uLycpO1xuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXG4gICAgICAgIGNvbnN0IGRhdGFTdG9yZSA9IHRoaXMuc3RvcmU7XG5cbiAgICAgICAgZm9yIChjb25zdCBpZCBpbiBkYXRhU3RvcmUpIHtcbiAgICAgICAgICAgIGlmIChkYXRhU3RvcmUuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGRhdGFTdG9yZVtpZF0uZGF0YTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5pbnN0YW5jZXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm4gPSBkYXRhLmluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZVtmdW5jdGlvbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZuLmFwcGx5KGRhdGEuaW5zdGFuY2VzW25hbWVdLmluc3RhbmNlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9wcmVSZWdpc3Rlckluc3RhbmNlKGVudGl0eSwgdXJsLCBuYW1lLCBpbnN0YW5jZSkge1xuICAgICAgICBpZiAoZW50aXR5LnNjcmlwdCkge1xuICAgICAgICAgICAgZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXMgPSBlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlcyB8fCB7fTtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKGBTY3JpcHQgbmFtZSBjb2xsaXNpb24gJyR7bmFtZX0nLiBTY3JpcHRzIGZyb20gJyR7dXJsfScgYW5kICcke2VudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzW25hbWVdLnVybH0nIHske2VudGl0eS5nZXRHdWlkKCl9fWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgdXJsOiB1cmwsXG4gICAgICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICBpbnN0YW5jZTogaW5zdGFuY2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVnaXN0ZXJJbnN0YW5jZXMoZW50aXR5KSB7XG4gICAgICAgIGlmIChlbnRpdHkuc2NyaXB0KSB7XG4gICAgICAgICAgICBpZiAoZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkuc2NyaXB0Lmluc3RhbmNlcyA9IGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpbnN0YW5jZU5hbWUgaW4gZW50aXR5LnNjcmlwdC5pbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlUmVnaXN0ZXJlZCA9IGVudGl0eS5zY3JpcHQuaW5zdGFuY2VzW2luc3RhbmNlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlID0gcHJlUmVnaXN0ZXJlZC5pbnN0YW5jZTtcblxuICAgICAgICAgICAgICAgICAgICBldmVudHMuYXR0YWNoKGluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UuZml4ZWRVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aEZpeGVkVXBkYXRlLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UudG9vbHNVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS5zY3JpcHQuc2NyaXB0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQWNjZXNzb3JzKGVudGl0eSwgcHJlUmVnaXN0ZXJlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBNYWtlIGluc3RhbmNlIGFjY2Vzc2libGUgZnJvbSB0aGUgc2NyaXB0IGNvbXBvbmVudCBvZiB0aGUgRW50aXR5XG4gICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuc2NyaXB0W2luc3RhbmNlTmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IEVycm9yKGBTY3JpcHQgd2l0aCBuYW1lICcke2luc3RhbmNlTmFtZX0nIGlzIGFscmVhZHkgYXR0YWNoZWQgdG8gU2NyaXB0IENvbXBvbmVudGApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNjcmlwdFtpbnN0YW5jZU5hbWVdID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgdGVtcCBzdG9yYWdlXG4gICAgICAgICAgICAgICAgZGVsZXRlIGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBlbnRpdHkuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZ2lzdGVySW5zdGFuY2VzKGNoaWxkcmVuW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jbG9uZUF0dHJpYnV0ZXMoYXR0cmlidXRlcykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB7fTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXNba2V5XS50eXBlICE9PSAnZW50aXR5Jykge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gZXh0ZW5kKHt9LCBhdHRyaWJ1dGVzW2tleV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBwYy5leHRlbmQgYW4gZW50aXR5XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsID0gYXR0cmlidXRlc1trZXldLnZhbHVlO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBhdHRyaWJ1dGVzW2tleV0udmFsdWU7XG5cbiAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IGV4dGVuZCh7fSwgYXR0cmlidXRlc1trZXldKTtcbiAgICAgICAgICAgICAgICByZXN1bHRba2V5XS52YWx1ZSA9IHZhbDtcblxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XS52YWx1ZSA9IHZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUFjY2Vzc29ycyhlbnRpdHksIGluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IGVudGl0eS5zY3JpcHQuc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHVybCA9IGluc3RhbmNlLnVybDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBlbnRpdHkuc2NyaXB0LnNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LnVybCA9PT0gdXJsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IHNjcmlwdC5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQubmFtZSAmJiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVBY2Nlc3NvcihhdHRyaWJ1dGVzW2tleV0sIGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zY3JpcHQuZGF0YS5hdHRyaWJ1dGVzW3NjcmlwdC5uYW1lXSA9IHRoaXMuX2Nsb25lQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY3JlYXRlQWNjZXNzb3IoYXR0cmlidXRlLCBpbnN0YW5jZSkge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBjcmVhdGUgY29weSBvZiBhdHRyaWJ1dGUgZGF0YVxuICAgICAgICAvLyB0byBhdm9pZCBvdmVyd3JpdGluZyB0aGUgc2FtZSBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICAgIC8vIHRoYXQgYXJlIHVzZWQgYnkgdGhlIEVkaXRvclxuICAgICAgICBhdHRyaWJ1dGUgPSB7XG4gICAgICAgICAgICBuYW1lOiBhdHRyaWJ1dGUubmFtZSxcbiAgICAgICAgICAgIHZhbHVlOiBhdHRyaWJ1dGUudmFsdWUsXG4gICAgICAgICAgICB0eXBlOiBhdHRyaWJ1dGUudHlwZVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX2NvbnZlcnRBdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGUpO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZS5pbnN0YW5jZSwgYXR0cmlidXRlLm5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBzZWxmLl9jb252ZXJ0QXR0cmlidXRlVmFsdWUoYXR0cmlidXRlKTtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbnN0YW5jZS5maXJlKCdzZXQnLCBhdHRyaWJ1dGUubmFtZSwgb2xkVmFsdWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF91cGRhdGVBY2Nlc3NvcnMoZW50aXR5LCBpbnN0YW5jZSkge1xuICAgICAgICBjb25zdCBsZW4gPSBlbnRpdHkuc2NyaXB0LnNjcmlwdHMubGVuZ3RoO1xuICAgICAgICBjb25zdCB1cmwgPSBpbnN0YW5jZS51cmw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0Q29tcG9uZW50ID0gZW50aXR5LnNjcmlwdDtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHNjcmlwdENvbXBvbmVudC5zY3JpcHRzW2ldO1xuICAgICAgICAgICAgaWYgKHNjcmlwdC51cmwgPT09IHVybCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBzY3JpcHQubmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gc2NyaXB0LmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSAvIHVwZGF0ZSBhdHRyaWJ1dGUgYWNjZXNzb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVBY2Nlc3NvcihhdHRyaWJ1dGVzW2tleV0sIGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgYWNjZXNzb3JzIGZvciBhdHRyaWJ1dGVzIHRoYXQgbm8gbG9uZ2VyIGV4aXN0XG4gICAgICAgICAgICAgICAgICAgIC8vIGFuZCBmaXJlIG9uQXR0cmlidXRlQ2hhbmdlIHdoZW4gYW4gYXR0cmlidXRlIHZhbHVlIGNoYW5nZWRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNBdHRyaWJ1dGVzID0gc2NyaXB0Q29tcG9uZW50LmRhdGEuYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXZpb3VzQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcHJldmlvdXNBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkQXR0cmlidXRlID0gcHJldmlvdXNBdHRyaWJ1dGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoa2V5IGluIGF0dHJpYnV0ZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBpbnN0YW5jZS5pbnN0YW5jZVtvbGRBdHRyaWJ1dGUubmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXNba2V5XS52YWx1ZSAhPT0gb2xkQXR0cmlidXRlLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UuaW5zdGFuY2Uub25BdHRyaWJ1dGVDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5zdGFuY2Uub25BdHRyaWJ1dGVDaGFuZ2VkKG9sZEF0dHJpYnV0ZS5uYW1lLCBvbGRBdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZXNba2V5XS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0Q29tcG9uZW50LmRhdGEuYXR0cmlidXRlc1tuYW1lXSA9IHRoaXMuX2Nsb25lQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzY3JpcHRDb21wb25lbnQuZGF0YS5hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY29udmVydEF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZSkge1xuICAgICAgICBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdyZ2InIHx8IGF0dHJpYnV0ZS50eXBlID09PSAncmdiYScpIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGF0dHJpYnV0ZS52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBhdHRyaWJ1dGUudmFsdWUubGVuZ3RoID09PSAzID9cbiAgICAgICAgICAgICAgICAgICAgbmV3IENvbG9yKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdLCBhdHRyaWJ1dGUudmFsdWVbMl0pIDpcbiAgICAgICAgICAgICAgICAgICAgbmV3IENvbG9yKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdLCBhdHRyaWJ1dGUudmFsdWVbMl0sIGF0dHJpYnV0ZS52YWx1ZVszXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICd2ZWMyJykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSlcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgVmVjMihhdHRyaWJ1dGUudmFsdWVbMF0sIGF0dHJpYnV0ZS52YWx1ZVsxXSk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ3ZlYzMnIHx8IGF0dHJpYnV0ZS50eXBlID09PSAndmVjdG9yJykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSlcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgVmVjMyhhdHRyaWJ1dGUudmFsdWVbMF0sIGF0dHJpYnV0ZS52YWx1ZVsxXSwgYXR0cmlidXRlLnZhbHVlWzJdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAndmVjNCcpIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGF0dHJpYnV0ZS52YWx1ZSkpXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlID0gbmV3IFZlYzQoYXR0cmlidXRlLnZhbHVlWzBdLCBhdHRyaWJ1dGUudmFsdWVbMV0sIGF0dHJpYnV0ZS52YWx1ZVsyXSwgYXR0cmlidXRlLnZhbHVlWzNdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAnZW50aXR5Jykge1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS52YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgYXR0cmlidXRlLnZhbHVlID09PSAnc3RyaW5nJylcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSB0aGlzLmFwcC5yb290LmZpbmRCeUd1aWQoYXR0cmlidXRlLnZhbHVlKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAnY3VydmUnIHx8IGF0dHJpYnV0ZS50eXBlID09PSAnY29sb3JjdXJ2ZScpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnZlVHlwZSA9IGF0dHJpYnV0ZS52YWx1ZS5rZXlzWzBdIGluc3RhbmNlb2YgQXJyYXkgPyBDdXJ2ZVNldCA6IEN1cnZlO1xuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlID0gbmV3IGN1cnZlVHlwZShhdHRyaWJ1dGUudmFsdWUua2V5cyk7XG5cbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUudHlwZSA9IGF0dHJpYnV0ZS52YWx1ZS50eXBlO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKElOSVRJQUxJWkUsIHRoaXMub25Jbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoUE9TVF9JTklUSUFMSVpFLCB0aGlzLm9uUG9zdEluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZihVUERBVEUsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZihGSVhFRF9VUERBVEUsIHRoaXMub25GaXhlZFVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKFBPU1RfVVBEQVRFLCB0aGlzLm9uUG9zdFVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKFRPT0xTX1VQREFURSwgdGhpcy5vblRvb2xzVXBkYXRlLCB0aGlzKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoU2NyaXB0TGVnYWN5Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IFNjcmlwdExlZ2FjeUNvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJJTklUSUFMSVpFIiwiUE9TVF9JTklUSUFMSVpFIiwiVVBEQVRFIiwiUE9TVF9VUERBVEUiLCJGSVhFRF9VUERBVEUiLCJUT09MU19VUERBVEUiLCJPTl9FTkFCTEUiLCJPTl9ESVNBQkxFIiwiU2NyaXB0TGVnYWN5Q29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJTY3JpcHRMZWdhY3lDb21wb25lbnQiLCJEYXRhVHlwZSIsIlNjcmlwdExlZ2FjeUNvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJwcmVsb2FkaW5nIiwiaW5zdGFuY2VzV2l0aFVwZGF0ZSIsImluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSIsImluc3RhbmNlc1dpdGhQb3N0VXBkYXRlIiwiaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlIiwib24iLCJvbkJlZm9yZVJlbW92ZSIsInN5c3RlbXMiLCJvbkluaXRpYWxpemUiLCJvblBvc3RJbml0aWFsaXplIiwib25VcGRhdGUiLCJvbkZpeGVkVXBkYXRlIiwib25Qb3N0VXBkYXRlIiwib25Ub29sc1VwZGF0ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJzY3JpcHRzIiwibGVuZ3RoIiwiZm9yRWFjaCIsInNjcmlwdCIsImF0dHJpYnV0ZXMiLCJBcnJheSIsImlzQXJyYXkiLCJkaWN0IiwiaSIsIm5hbWUiLCJjbG9uZUNvbXBvbmVudCIsImVudGl0eSIsImNsb25lIiwic3JjIiwic3RvcmUiLCJnZXRHdWlkIiwicnVuSW5Ub29scyIsImVuYWJsZWQiLCJsZW4iLCJwdXNoIiwiZXh0ZW5kIiwiX2Nsb25lQXR0cmlidXRlcyIsImFkZENvbXBvbmVudCIsIl9kaXNhYmxlU2NyaXB0Q29tcG9uZW50IiwiX2Rlc3Ryb3lTY3JpcHRDb21wb25lbnQiLCJyb290IiwiX3JlZ2lzdGVySW5zdGFuY2VzIiwiX2luaXRpYWxpemVTY3JpcHRDb21wb25lbnQiLCJjaGlsZHJlbiIsIl9jaGlsZHJlbiIsIkVudGl0eSIsIl9wb3N0SW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudCIsIl9jYWxsSW5zdGFuY2VzTWV0aG9kIiwibWV0aG9kIiwiaW5zdGFuY2VzIiwiaGFzT3duUHJvcGVydHkiLCJpbnN0YW5jZSIsImluaXRpYWxpemVkIiwiX2VuYWJsZVNjcmlwdENvbXBvbmVudCIsImRlc3Ryb3kiLCJ1cGRhdGUiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJmaXhlZFVwZGF0ZSIsInBvc3RVcGRhdGUiLCJ0b29sc1VwZGF0ZSIsInBvc3RJbml0aWFsaXplZCIsIl91cGRhdGVJbnN0YW5jZXMiLCJ1cGRhdGVMaXN0IiwiZHQiLCJpdGVtIiwiYnJvYWRjYXN0IiwiZnVuY3Rpb25OYW1lIiwiRGVidWciLCJkZXByZWNhdGVkIiwiYXJncyIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsImFyZ3VtZW50cyIsImRhdGFTdG9yZSIsImZuIiwiYXBwbHkiLCJfcHJlUmVnaXN0ZXJJbnN0YW5jZSIsInVybCIsIl9pbnN0YW5jZXMiLCJFcnJvciIsImluc3RhbmNlTmFtZSIsInByZVJlZ2lzdGVyZWQiLCJldmVudHMiLCJhdHRhY2giLCJfY3JlYXRlQWNjZXNzb3JzIiwicmVzdWx0Iiwia2V5IiwidHlwZSIsInZhbCIsInZhbHVlIiwiX2NyZWF0ZUFjY2Vzc29yIiwiYXR0cmlidXRlIiwic2VsZiIsIl9jb252ZXJ0QXR0cmlidXRlVmFsdWUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsInNldCIsIm9sZFZhbHVlIiwiZmlyZSIsImNvbmZpZ3VyYWJsZSIsIl91cGRhdGVBY2Nlc3NvcnMiLCJzY3JpcHRDb21wb25lbnQiLCJwcmV2aW91c0F0dHJpYnV0ZXMiLCJvbGRBdHRyaWJ1dGUiLCJvbkF0dHJpYnV0ZUNoYW5nZWQiLCJDb2xvciIsIlZlYzIiLCJWZWMzIiwiVmVjNCIsImZpbmRCeUd1aWQiLCJjdXJ2ZVR5cGUiLCJrZXlzIiwiQ3VydmVTZXQiLCJDdXJ2ZSIsIm9mZiIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLE1BQU1BLE9BQU8sR0FBRyxDQUNaLFNBQVMsRUFDVCxTQUFTLEVBQ1QsV0FBVyxFQUNYLFlBQVksQ0FDZixDQUFBO0FBRUQsTUFBTUMsVUFBVSxHQUFHLFlBQVksQ0FBQTtBQUMvQixNQUFNQyxlQUFlLEdBQUcsZ0JBQWdCLENBQUE7QUFDeEMsTUFBTUMsTUFBTSxHQUFHLFFBQVEsQ0FBQTtBQUN2QixNQUFNQyxXQUFXLEdBQUcsWUFBWSxDQUFBO0FBQ2hDLE1BQU1DLFlBQVksR0FBRyxhQUFhLENBQUE7QUFDbEMsTUFBTUMsWUFBWSxHQUFHLGFBQWEsQ0FBQTtBQUNsQyxNQUFNQyxTQUFTLEdBQUcsVUFBVSxDQUFBO0FBQzVCLE1BQU1DLFVBQVUsR0FBRyxXQUFXLENBQUE7QUFFOUIsTUFBTUMs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
