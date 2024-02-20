import { Debug } from '../../../core/debug.js';
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ScriptAttributes } from '../../script/script-attributes.js';
import { SCRIPT_POST_INITIALIZE, SCRIPT_INITIALIZE, SCRIPT_UPDATE, SCRIPT_POST_UPDATE, SCRIPT_SWAP } from '../../script/constants.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';

/**
 * The ScriptComponent allows you to extend the functionality of an Entity by attaching your own
 * Script Types defined in JavaScript files to be executed with access to the Entity. For more
 * details on scripting see [Scripting](https://developer.playcanvas.com/user-manual/scripting/).
 *
 * @augments Component
 * @category Script
 */
class ScriptComponent extends Component {
  /**
   * Create a new ScriptComponent instance.
   *
   * @param {import('./system.js').ScriptComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {Entity} entity - The Entity that this Component is attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    /**
     * Holds all script instances for this component.
     *
     * @type {import('../../script/script-type.js').ScriptType[]}
     * @private
     */
    this._scripts = [];
    // holds all script instances with an update method
    this._updateList = new SortedLoopArray({
      sortBy: '__executionOrder'
    });
    // holds all script instances with a postUpdate method
    this._postUpdateList = new SortedLoopArray({
      sortBy: '__executionOrder'
    });
    this._scriptsIndex = {};
    this._destroyedScripts = [];
    this._destroyed = false;
    this._scriptsData = null;
    this._oldState = true;

    // override default 'enabled' property of base pc.Component
    // because this is faster
    this._enabled = true;

    // whether this component is currently being enabled
    this._beingEnabled = false;
    // if true then we are currently looping through
    // script instances. This is used to prevent a scripts array
    // from being modified while a loop is being executed
    this._isLoopingThroughScripts = false;

    // the order that this component will be updated
    // by the script system. This is set by the system itself.
    this._executionOrder = -1;
    this.on('set_enabled', this._onSetEnabled, this);
  }

  /**
   * An array of all script instances attached to an entity. This array is read-only and should
   * not be modified by developer.
   *
   * @type {import('../../script/script-type.js').ScriptType[]}
   */
  set scripts(value) {
    this._scriptsData = value;
    for (const key in value) {
      if (!value.hasOwnProperty(key)) continue;
      const script = this._scriptsIndex[key];
      if (script) {
        // existing script

        // enabled
        if (typeof value[key].enabled === 'boolean') script.enabled = !!value[key].enabled;

        // attributes
        if (typeof value[key].attributes === 'object') {
          for (const attr in value[key].attributes) {
            if (ScriptAttributes.reservedNames.has(attr)) continue;
            if (!script.__attributes.hasOwnProperty(attr)) {
              // new attribute
              const scriptType = this.system.app.scripts.get(key);
              if (scriptType) scriptType.attributes.add(attr, {});
            }

            // update attribute
            script[attr] = value[key].attributes[attr];
          }
        }
      } else {
        // TODO scripts2
        // new script
        console.log(this.order);
      }
    }
  }
  get scripts() {
    return this._scripts;
  }
  set enabled(value) {
    const oldValue = this._enabled;
    this._enabled = value;
    this.fire('set', 'enabled', oldValue, value);
  }
  get enabled() {
    return this._enabled;
  }
  onEnable() {
    this._beingEnabled = true;
    this._checkState();
    if (!this.entity._beingEnabled) {
      this.onPostStateChange();
    }
    this._beingEnabled = false;
  }
  onDisable() {
    this._checkState();
  }
  onPostStateChange() {
    const wasLooping = this._beginLooping();
    for (let i = 0, len = this.scripts.length; i < len; i++) {
      const script = this.scripts[i];
      if (script._initialized && !script._postInitialized && script.enabled) {
        script._postInitialized = true;
        if (script.postInitialize) this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
      }
    }
    this._endLooping(wasLooping);
  }

  // Sets isLoopingThroughScripts to false and returns
  // its previous value
  _beginLooping() {
    const looping = this._isLoopingThroughScripts;
    this._isLoopingThroughScripts = true;
    return looping;
  }

  // Restores isLoopingThroughScripts to the specified parameter
  // If all loops are over then remove destroyed scripts form the _scripts array
  _endLooping(wasLoopingBefore) {
    this._isLoopingThroughScripts = wasLoopingBefore;
    if (!this._isLoopingThroughScripts) {
      this._removeDestroyedScripts();
    }
  }

  // We also need this handler because it is fired
  // when value === old instead of onEnable and onDisable
  // which are only fired when value !== old
  _onSetEnabled(prop, old, value) {
    this._beingEnabled = true;
    this._checkState();
    this._beingEnabled = false;
  }
  _checkState() {
    const state = this.enabled && this.entity.enabled;
    if (state === this._oldState) return;
    this._oldState = state;
    this.fire(state ? 'enable' : 'disable');
    this.fire('state', state);
    if (state) {
      this.system._addComponentToEnabled(this);
    } else {
      this.system._removeComponentFromEnabled(this);
    }
    const wasLooping = this._beginLooping();
    for (let i = 0, len = this.scripts.length; i < len; i++) {
      const script = this.scripts[i];
      script.enabled = script._enabled;
    }
    this._endLooping(wasLooping);
  }
  _onBeforeRemove() {
    this.fire('remove');
    const wasLooping = this._beginLooping();

    // destroy all scripts
    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];
      if (!script) continue;
      this.destroy(script.__scriptType.__name);
    }
    this._endLooping(wasLooping);
  }
  _removeDestroyedScripts() {
    const len = this._destroyedScripts.length;
    if (!len) return;
    for (let i = 0; i < len; i++) {
      const script = this._destroyedScripts[i];
      this._removeScriptInstance(script);
    }
    this._destroyedScripts.length = 0;

    // update execution order for scripts
    this._resetExecutionOrder(0, this._scripts.length);
  }
  _onInitializeAttributes() {
    for (let i = 0, len = this.scripts.length; i < len; i++) this.scripts[i].__initializeAttributes();
  }
  _scriptMethod(script, method, arg) {
    try {
      script[method](arg);
    } catch (ex) {
      // disable script if it fails to call method
      script.enabled = false;
      if (!script.hasEvent('error')) {
        console.warn(`unhandled exception while calling "${method}" for "${script.__scriptType.__name}" script: `, ex);
        console.error(ex);
      }
      script.fire('error', ex, method);
      this.fire('error', script, ex, method);
    }
  }
  _onInitialize() {
    const scripts = this._scripts;
    const wasLooping = this._beginLooping();
    for (let i = 0, len = scripts.length; i < len; i++) {
      const script = scripts[i];
      if (!script._initialized && script.enabled) {
        script._initialized = true;
        if (script.initialize) this._scriptMethod(script, SCRIPT_INITIALIZE);
      }
    }
    this._endLooping(wasLooping);
  }
  _onPostInitialize() {
    this.onPostStateChange();
  }
  _onUpdate(dt) {
    const list = this._updateList;
    if (!list.length) return;
    const wasLooping = this._beginLooping();
    for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
      const script = list.items[list.loopIndex];
      if (script.enabled) {
        this._scriptMethod(script, SCRIPT_UPDATE, dt);
      }
    }
    this._endLooping(wasLooping);
  }
  _onPostUpdate(dt) {
    const list = this._postUpdateList;
    if (!list.length) return;
    const wasLooping = this._beginLooping();
    for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
      const script = list.items[list.loopIndex];
      if (script.enabled) {
        this._scriptMethod(script, SCRIPT_POST_UPDATE, dt);
      }
    }
    this._endLooping(wasLooping);
  }

  /**
   * Inserts script instance into the scripts array at the specified index. Also inserts the
   * script into the update list if it has an update method and the post update list if it has a
   * postUpdate method.
   *
   * @param {object} scriptInstance - The script instance.
   * @param {number} index - The index where to insert the script at. If -1, append it at the end.
   * @param {number} scriptsLength - The length of the scripts array.
   * @private
   */
  _insertScriptInstance(scriptInstance, index, scriptsLength) {
    if (index === -1) {
      // append script at the end and set execution order
      this._scripts.push(scriptInstance);
      scriptInstance.__executionOrder = scriptsLength;

      // append script to the update list if it has an update method
      if (scriptInstance.update) {
        this._updateList.append(scriptInstance);
      }

      // add script to the postUpdate list if it has a postUpdate method
      if (scriptInstance.postUpdate) {
        this._postUpdateList.append(scriptInstance);
      }
    } else {
      // insert script at index and set execution order
      this._scripts.splice(index, 0, scriptInstance);
      scriptInstance.__executionOrder = index;

      // now we also need to update the execution order of all
      // the script instances that come after this script
      this._resetExecutionOrder(index + 1, scriptsLength + 1);

      // insert script to the update list if it has an update method
      // in the right order
      if (scriptInstance.update) {
        this._updateList.insert(scriptInstance);
      }

      // insert script to the postUpdate list if it has a postUpdate method
      // in the right order
      if (scriptInstance.postUpdate) {
        this._postUpdateList.insert(scriptInstance);
      }
    }
  }
  _removeScriptInstance(scriptInstance) {
    const idx = this._scripts.indexOf(scriptInstance);
    if (idx === -1) return idx;
    this._scripts.splice(idx, 1);
    if (scriptInstance.update) {
      this._updateList.remove(scriptInstance);
    }
    if (scriptInstance.postUpdate) {
      this._postUpdateList.remove(scriptInstance);
    }
    return idx;
  }
  _resetExecutionOrder(startIndex, scriptsLength) {
    for (let i = startIndex; i < scriptsLength; i++) {
      this._scripts[i].__executionOrder = i;
    }
  }
  _resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newAttributes, duplicatedIdsMap) {
    if (attribute.array) {
      // handle entity array attribute
      const len = oldValue.length;
      if (!len) {
        return;
      }
      const newGuidArray = oldValue.slice();
      for (let i = 0; i < len; i++) {
        const guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
        if (duplicatedIdsMap[guid]) {
          newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
        }
      }
      newAttributes[attributeName] = newGuidArray;
    } else {
      // handle regular entity attribute
      if (oldValue instanceof Entity) {
        oldValue = oldValue.getGuid();
      } else if (typeof oldValue !== 'string') {
        return;
      }
      if (duplicatedIdsMap[oldValue]) {
        newAttributes[attributeName] = duplicatedIdsMap[oldValue];
      }
    }
  }

  /**
   * Detect if script is attached to an entity.
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @returns {boolean} If script is attached to an entity.
   * @example
   * if (entity.script.has('playerController')) {
   *     // entity has script
   * }
   */
  has(nameOrType) {
    if (typeof nameOrType === 'string') {
      return !!this._scriptsIndex[nameOrType];
    }
    if (!nameOrType) return false;
    const scriptType = nameOrType;
    const scriptName = scriptType.__name;
    const scriptData = this._scriptsIndex[scriptName];
    const scriptInstance = scriptData && scriptData.instance;
    return scriptInstance instanceof scriptType; // will return false if scriptInstance undefined
  }

  /**
   * Get a script instance (if attached).
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @returns {import('../../script/script-type.js').ScriptType|null} If script is attached, the
   * instance is returned. Otherwise null is returned.
   * @example
   * const controller = entity.script.get('playerController');
   */
  get(nameOrType) {
    if (typeof nameOrType === 'string') {
      const data = this._scriptsIndex[nameOrType];
      return data ? data.instance : null;
    }
    if (!nameOrType) return null;
    const scriptType = nameOrType;
    const scriptName = scriptType.__name;
    const scriptData = this._scriptsIndex[scriptName];
    const scriptInstance = scriptData && scriptData.instance;
    return scriptInstance instanceof scriptType ? scriptInstance : null;
  }

  /**
   * Create a script instance and attach to an entity script component.
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @param {object} [args] - Object with arguments for a script.
   * @param {boolean} [args.enabled] - If script instance is enabled after creation. Defaults to
   * true.
   * @param {object} [args.attributes] - Object with values for attributes (if any), where key is
   * name of an attribute.
   * @param {boolean} [args.preloading] - If script instance is created during preload. If true,
   * script and attributes must be initialized manually. Defaults to false.
   * @param {number} [args.ind] - The index where to insert the script instance at. Defaults to
   * -1, which means append it at the end.
   * @returns {import('../../script/script-type.js').ScriptType|null} Returns an instance of a
   * {@link ScriptType} if successfully attached to an entity, or null if it failed because a
   * script with a same name has already been added or if the {@link ScriptType} cannot be found
   * by name in the {@link ScriptRegistry}.
   * @example
   * entity.script.create('playerController', {
   *     attributes: {
   *         speed: 4
   *     }
   * });
   */
  create(nameOrType, args = {}) {
    const self = this;
    let scriptType = nameOrType;
    let scriptName = nameOrType;

    // shorthand using script name
    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }
    if (scriptType) {
      if (!this._scriptsIndex[scriptName] || !this._scriptsIndex[scriptName].instance) {
        // create script instance
        const scriptInstance = new scriptType({
          app: this.system.app,
          entity: this.entity,
          enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
          attributes: args.attributes
        });
        const len = this._scripts.length;
        let ind = -1;
        if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind) ind = args.ind;
        this._insertScriptInstance(scriptInstance, ind, len);
        this._scriptsIndex[scriptName] = {
          instance: scriptInstance,
          onSwap: function () {
            self.swap(scriptName);
          }
        };
        this[scriptName] = scriptInstance;
        if (!args.preloading) scriptInstance.__initializeAttributes();
        this.fire('create', scriptName, scriptInstance);
        this.fire('create:' + scriptName, scriptInstance);
        this.system.app.scripts.on('swap:' + scriptName, this._scriptsIndex[scriptName].onSwap);
        if (!args.preloading) {
          if (scriptInstance.enabled && !scriptInstance._initialized) {
            scriptInstance._initialized = true;
            if (scriptInstance.initialize) this._scriptMethod(scriptInstance, SCRIPT_INITIALIZE);
          }
          if (scriptInstance.enabled && !scriptInstance._postInitialized) {
            scriptInstance._postInitialized = true;
            if (scriptInstance.postInitialize) this._scriptMethod(scriptInstance, SCRIPT_POST_INITIALIZE);
          }
        }
        return scriptInstance;
      }
      Debug.warn(`script '${scriptName}' is already added to entity '${this.entity.name}'`);
    } else {
      this._scriptsIndex[scriptName] = {
        awaiting: true,
        ind: this._scripts.length
      };
      Debug.warn(`script '${scriptName}' is not found, awaiting it to be added to registry`);
    }
    return null;
  }

  /**
   * Destroy the script instance that is attached to an entity.
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @returns {boolean} If it was successfully destroyed.
   * @example
   * entity.script.destroy('playerController');
   */
  destroy(nameOrType) {
    let scriptName = nameOrType;
    let scriptType = nameOrType;

    // shorthand using script name
    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }
    const scriptData = this._scriptsIndex[scriptName];
    delete this._scriptsIndex[scriptName];
    if (!scriptData) return false;
    const scriptInstance = scriptData.instance;
    if (scriptInstance && !scriptInstance._destroyed) {
      scriptInstance.enabled = false;
      scriptInstance._destroyed = true;

      // if we are not currently looping through our scripts
      // then it's safe to remove the script
      if (!this._isLoopingThroughScripts) {
        const ind = this._removeScriptInstance(scriptInstance);
        if (ind >= 0) {
          this._resetExecutionOrder(ind, this._scripts.length);
        }
      } else {
        // otherwise push the script in _destroyedScripts and
        // remove it from _scripts when the loop is over
        this._destroyedScripts.push(scriptInstance);
      }
    }

    // remove swap event
    this.system.app.scripts.off('swap:' + scriptName, scriptData.onSwap);
    delete this[scriptName];
    this.fire('destroy', scriptName, scriptInstance || null);
    this.fire('destroy:' + scriptName, scriptInstance || null);
    if (scriptInstance) scriptInstance.fire('destroy');
    return true;
  }

  /**
   * Swap the script instance.
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @returns {boolean} If it was successfully swapped.
   * @private
   */
  swap(nameOrType) {
    let scriptName = nameOrType;
    let scriptType = nameOrType;

    // shorthand using script name
    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }
    const old = this._scriptsIndex[scriptName];
    if (!old || !old.instance) return false;
    const scriptInstanceOld = old.instance;
    const ind = this._scripts.indexOf(scriptInstanceOld);
    const scriptInstance = new scriptType({
      app: this.system.app,
      entity: this.entity,
      enabled: scriptInstanceOld.enabled,
      attributes: scriptInstanceOld.__attributes
    });
    if (!scriptInstance.swap) return false;
    scriptInstance.__initializeAttributes();

    // add to component
    this._scripts[ind] = scriptInstance;
    this._scriptsIndex[scriptName].instance = scriptInstance;
    this[scriptName] = scriptInstance;

    // set execution order and make sure we update
    // our update and postUpdate lists
    scriptInstance.__executionOrder = ind;
    if (scriptInstanceOld.update) {
      this._updateList.remove(scriptInstanceOld);
    }
    if (scriptInstanceOld.postUpdate) {
      this._postUpdateList.remove(scriptInstanceOld);
    }
    if (scriptInstance.update) {
      this._updateList.insert(scriptInstance);
    }
    if (scriptInstance.postUpdate) {
      this._postUpdateList.insert(scriptInstance);
    }
    this._scriptMethod(scriptInstance, SCRIPT_SWAP, scriptInstanceOld);
    this.fire('swap', scriptName, scriptInstance);
    this.fire('swap:' + scriptName, scriptInstance);
    return true;
  }

  /**
   * When an entity is cloned and it has entity script attributes that point to other entities in
   * the same subtree that is cloned, then we want the new script attributes to point at the
   * cloned entities. This method remaps the script attributes for this entity and it assumes
   * that this entity is the result of the clone operation.
   *
   * @param {ScriptComponent} oldScriptComponent - The source script component that belongs to
   * the entity that was being cloned.
   * @param {object} duplicatedIdsMap - A dictionary with guid-entity values that contains the
   * entities that were cloned.
   * @private
   */
  resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {
    const newScriptComponent = this.entity.script;

    // for each script in the old component
    for (const scriptName in oldScriptComponent._scriptsIndex) {
      // get the script type from the script registry
      const scriptType = this.system.app.scripts.get(scriptName);
      if (!scriptType) {
        continue;
      }

      // get the script from the component's index
      const script = oldScriptComponent._scriptsIndex[scriptName];
      if (!script || !script.instance) {
        continue;
      }

      // if __attributesRaw exists then it means that the new entity
      // has not yet initialized its attributes so put the new guid in there,
      // otherwise it means that the attributes have already been initialized
      // so convert the new guid to an entity
      // and put it in the new attributes
      const newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
      const newAttributes = newScriptComponent[scriptName].__attributes;
      if (!newAttributesRaw && !newAttributes) {
        continue;
      }

      // if we are using attributesRaw then use the guid otherwise use the entity
      const useGuid = !!newAttributesRaw;

      // get the old script attributes from the instance
      const oldAttributes = script.instance.__attributes;
      for (const attributeName in oldAttributes) {
        if (!oldAttributes[attributeName]) {
          continue;
        }

        // get the attribute definition from the script type
        const attribute = scriptType.attributes.get(attributeName);
        if (!attribute) {
          continue;
        }
        if (attribute.type === 'entity') {
          // entity attributes
          this._resolveEntityScriptAttribute(attribute, attributeName, oldAttributes[attributeName], useGuid, newAttributesRaw || newAttributes, duplicatedIdsMap);
        } else if (attribute.type === 'json' && Array.isArray(attribute.schema)) {
          // json attributes
          const oldValue = oldAttributes[attributeName];
          const newJsonValue = newAttributesRaw ? newAttributesRaw[attributeName] : newAttributes[attributeName];
          for (let i = 0; i < attribute.schema.length; i++) {
            const field = attribute.schema[i];
            if (field.type !== 'entity') {
              continue;
            }
            if (attribute.array) {
              for (let j = 0; j < oldValue.length; j++) {
                this._resolveEntityScriptAttribute(field, field.name, oldValue[j][field.name], useGuid, newJsonValue[j], duplicatedIdsMap);
              }
            } else {
              this._resolveEntityScriptAttribute(field, field.name, oldValue[field.name], useGuid, newJsonValue, duplicatedIdsMap);
            }
          }
        }
      }
    }
  }

  /**
   * Move script instance to different position to alter update order of scripts within entity.
   *
   * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
   * name or type of {@link ScriptType}.
   * @param {number} ind - New position index.
   * @returns {boolean} If it was successfully moved.
   * @example
   * entity.script.move('playerController', 0);
   */
  move(nameOrType, ind) {
    const len = this._scripts.length;
    if (ind >= len || ind < 0) return false;
    let scriptType = nameOrType;
    let scriptName = nameOrType;
    if (typeof scriptName !== 'string') {
      scriptName = nameOrType.__name;
    } else {
      scriptType = null;
    }
    const scriptData = this._scriptsIndex[scriptName];
    if (!scriptData || !scriptData.instance) return false;

    // if script type specified, make sure instance of said type
    const scriptInstance = scriptData.instance;
    if (scriptType && !(scriptInstance instanceof scriptType)) return false;
    const indOld = this._scripts.indexOf(scriptInstance);
    if (indOld === -1 || indOld === ind) return false;

    // move script to another position
    this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);

    // reset execution order for scripts and re-sort update and postUpdate lists
    this._resetExecutionOrder(0, len);
    this._updateList.sort();
    this._postUpdateList.sort();
    this.fire('move', scriptName, scriptInstance, ind, indOld);
    this.fire('move:' + scriptName, scriptInstance, ind, indOld);
    return true;
  }
}
/**
 * Fired when a {@link ScriptType} instance is created and attached to the script component.
 * This event is available in two forms. They are as follows:
 *
 * 1. `create` - Fired when a script instance is created. The name of the script type and the
 * script type instance are passed as arguments.
 * 2. `create:[name]` - Fired when a script instance is created that has the specified script
 * type name. The script instance is passed as an argument to the handler.
 *
 * @event
 * @example
 * entity.script.on('create', (name, scriptInstance) => {
 *     console.log(`Instance of script '${name}' created`);
 * });
 * @example
 * entity.script.on('create:player', (scriptInstance) => {
 *     console.log(`Instance of script 'player' created`);
 * });
 */
ScriptComponent.EVENT_CREATE = 'create';
/**
 * Fired when a {@link ScriptType} instance is destroyed and removed from the script component.
 * This event is available in two forms. They are as follows:
 *
 * 1. `destroy` - Fired when a script instance is destroyed. The name of the script type and
 * the script type instance are passed as arguments.
 * 2. `destroy:[name]` - Fired when a script instance is destroyed that has the specified
 * script type name. The script instance is passed as an argument.
 *
 * @event
 * @example
 * entity.script.on('destroy', (name, scriptInstance) => {
 *     console.log(`Instance of script '${name}' destroyed`);
 * });
 * @example
 * entity.script.on('destroy:player', (scriptInstance) => {
 *     console.log(`Instance of script 'player' destroyed`);
 * });
 */
ScriptComponent.EVENT_DESTROY = 'destroy';
/**
 * Fired when the script component becomes enabled. This event does not take into account the
 * enabled state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.script.on('enable', () => {
 *     console.log(`Script component of entity '${entity.name}' has been enabled`);
 * });
 */
ScriptComponent.EVENT_ENABLE = 'enable';
/**
 * Fired when the script component becomes disabled. This event does not take into account the
 * enabled state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.script.on('disable', () => {
 *     console.log(`Script component of entity '${entity.name}' has been disabled`);
 * });
 */
ScriptComponent.EVENT_DISABLE = 'disable';
/**
 * Fired when the script component has been removed from its entity.
 *
 * @event
 * @example
 * entity.script.on('remove', () => {
 *     console.log(`Script component removed from entity '${entity.name}'`);
 * });
 */
ScriptComponent.EVENT_REMOVE = 'remove';
/**
 * Fired when the script component changes state to enabled or disabled. The handler is passed
 * the new boolean enabled state of the script component. This event does not take into account
 * the enabled state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.script.on('state', (enabled) => {
 *     console.log(`Script component of entity '${entity.name}' changed state to '${enabled}'`);
 * });
 */
ScriptComponent.EVENT_STATE = 'state';
/**
 * Fired when the index of a {@link ScriptType} instance is changed in the script component.
 * This event is available in two forms. They are as follows:
 *
 * 1. `move` - Fired when a script instance is moved. The name of the script type, the script
 * type instance, the new index and the old index are passed as arguments.
 * 2. `move:[name]` - Fired when a specifically named script instance is moved. The script
 * instance, the new index and the old index are passed as arguments.
 *
 * @event
 * @example
 * entity.script.on('move', (name, scriptInstance, newIndex, oldIndex) => {
 *     console.log(`Script '${name}' moved from index '${oldIndex}' to '${newIndex}'`);
 * });
 * @example
 * entity.script.on('move:player', (scriptInstance, newIndex, oldIndex) => {
 *     console.log(`Script 'player' moved from index '${oldIndex}' to '${newIndex}'`);
 * });
 */
ScriptComponent.EVENT_MOVE = 'move';
/**
 * Fired when a {@link ScriptType} instance had an exception. The handler is passed the script
 * instance, the exception and the method name that the exception originated from.
 *
 * @event
 * @example
 * entity.script.on('error', (scriptInstance, exception, methodName) => {
 *     console.log(`Script error: ${exception} in method '${methodName}'`);
 * });
 */
ScriptComponent.EVENT_ERROR = 'error';

export { ScriptComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgU29ydGVkTG9vcEFycmF5IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9zb3J0ZWQtbG9vcC1hcnJheS5qcyc7XG5cbmltcG9ydCB7IFNjcmlwdEF0dHJpYnV0ZXMgfSBmcm9tICcuLi8uLi9zY3JpcHQvc2NyaXB0LWF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHtcbiAgICBTQ1JJUFRfSU5JVElBTElaRSwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSwgU0NSSVBUX1VQREFURSxcbiAgICBTQ1JJUFRfUE9TVF9VUERBVEUsIFNDUklQVF9TV0FQXG59IGZyb20gJy4uLy4uL3NjcmlwdC9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuLyoqXG4gKiBUaGUgU2NyaXB0Q29tcG9uZW50IGFsbG93cyB5b3UgdG8gZXh0ZW5kIHRoZSBmdW5jdGlvbmFsaXR5IG9mIGFuIEVudGl0eSBieSBhdHRhY2hpbmcgeW91ciBvd25cbiAqIFNjcmlwdCBUeXBlcyBkZWZpbmVkIGluIEphdmFTY3JpcHQgZmlsZXMgdG8gYmUgZXhlY3V0ZWQgd2l0aCBhY2Nlc3MgdG8gdGhlIEVudGl0eS4gRm9yIG1vcmVcbiAqIGRldGFpbHMgb24gc2NyaXB0aW5nIHNlZSBbU2NyaXB0aW5nXShodHRwczovL2RldmVsb3Blci5wbGF5Y2FudmFzLmNvbS91c2VyLW1hbnVhbC9zY3JpcHRpbmcvKS5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAY2F0ZWdvcnkgU2NyaXB0XG4gKi9cbmNsYXNzIFNjcmlwdENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHtAbGluayBTY3JpcHRUeXBlfSBpbnN0YW5jZSBpcyBjcmVhdGVkIGFuZCBhdHRhY2hlZCB0byB0aGUgc2NyaXB0IGNvbXBvbmVudC5cbiAgICAgKiBUaGlzIGV2ZW50IGlzIGF2YWlsYWJsZSBpbiB0d28gZm9ybXMuIFRoZXkgYXJlIGFzIGZvbGxvd3M6XG4gICAgICpcbiAgICAgKiAxLiBgY3JlYXRlYCAtIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgY3JlYXRlZC4gVGhlIG5hbWUgb2YgdGhlIHNjcmlwdCB0eXBlIGFuZCB0aGVcbiAgICAgKiBzY3JpcHQgdHlwZSBpbnN0YW5jZSBhcmUgcGFzc2VkIGFzIGFyZ3VtZW50cy5cbiAgICAgKiAyLiBgY3JlYXRlOltuYW1lXWAgLSBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGNyZWF0ZWQgdGhhdCBoYXMgdGhlIHNwZWNpZmllZCBzY3JpcHRcbiAgICAgKiB0eXBlIG5hbWUuIFRoZSBzY3JpcHQgaW5zdGFuY2UgaXMgcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBoYW5kbGVyLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdjcmVhdGUnLCAobmFtZSwgc2NyaXB0SW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYEluc3RhbmNlIG9mIHNjcmlwdCAnJHtuYW1lfScgY3JlYXRlZGApO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignY3JlYXRlOnBsYXllcicsIChzY3JpcHRJbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgSW5zdGFuY2Ugb2Ygc2NyaXB0ICdwbGF5ZXInIGNyZWF0ZWRgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ1JFQVRFID0gJ2NyZWF0ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEge0BsaW5rIFNjcmlwdFR5cGV9IGluc3RhbmNlIGlzIGRlc3Ryb3llZCBhbmQgcmVtb3ZlZCBmcm9tIHRoZSBzY3JpcHQgY29tcG9uZW50LlxuICAgICAqIFRoaXMgZXZlbnQgaXMgYXZhaWxhYmxlIGluIHR3byBmb3Jtcy4gVGhleSBhcmUgYXMgZm9sbG93czpcbiAgICAgKlxuICAgICAqIDEuIGBkZXN0cm95YCAtIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgZGVzdHJveWVkLiBUaGUgbmFtZSBvZiB0aGUgc2NyaXB0IHR5cGUgYW5kXG4gICAgICogdGhlIHNjcmlwdCB0eXBlIGluc3RhbmNlIGFyZSBwYXNzZWQgYXMgYXJndW1lbnRzLlxuICAgICAqIDIuIGBkZXN0cm95OltuYW1lXWAgLSBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGRlc3Ryb3llZCB0aGF0IGhhcyB0aGUgc3BlY2lmaWVkXG4gICAgICogc2NyaXB0IHR5cGUgbmFtZS4gVGhlIHNjcmlwdCBpbnN0YW5jZSBpcyBwYXNzZWQgYXMgYW4gYXJndW1lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Rlc3Ryb3knLCAobmFtZSwgc2NyaXB0SW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYEluc3RhbmNlIG9mIHNjcmlwdCAnJHtuYW1lfScgZGVzdHJveWVkYCk7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkZXN0cm95OnBsYXllcicsIChzY3JpcHRJbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgSW5zdGFuY2Ugb2Ygc2NyaXB0ICdwbGF5ZXInIGRlc3Ryb3llZGApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ERVNUUk9ZID0gJ2Rlc3Ryb3knO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgc2NyaXB0IGNvbXBvbmVudCBiZWNvbWVzIGVuYWJsZWQuIFRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbnRvIGFjY291bnQgdGhlXG4gICAgICogZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgYW5jZXN0b3JzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdlbmFibGUnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBTY3JpcHQgY29tcG9uZW50IG9mIGVudGl0eSAnJHtlbnRpdHkubmFtZX0nIGhhcyBiZWVuIGVuYWJsZWRgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRU5BQkxFID0gJ2VuYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBzY3JpcHQgY29tcG9uZW50IGJlY29tZXMgZGlzYWJsZWQuIFRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbnRvIGFjY291bnQgdGhlXG4gICAgICogZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgYW5jZXN0b3JzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkaXNhYmxlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgU2NyaXB0IGNvbXBvbmVudCBvZiBlbnRpdHkgJyR7ZW50aXR5Lm5hbWV9JyBoYXMgYmVlbiBkaXNhYmxlZGApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ESVNBQkxFID0gJ2Rpc2FibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgc2NyaXB0IGNvbXBvbmVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20gaXRzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbigncmVtb3ZlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgU2NyaXB0IGNvbXBvbmVudCByZW1vdmVkIGZyb20gZW50aXR5ICcke2VudGl0eS5uYW1lfSdgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVNT1ZFID0gJ3JlbW92ZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBzY3JpcHQgY29tcG9uZW50IGNoYW5nZXMgc3RhdGUgdG8gZW5hYmxlZCBvciBkaXNhYmxlZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkXG4gICAgICogdGhlIG5ldyBib29sZWFuIGVuYWJsZWQgc3RhdGUgb2YgdGhlIHNjcmlwdCBjb21wb25lbnQuIFRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbnRvIGFjY291bnRcbiAgICAgKiB0aGUgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgYW5jZXN0b3JzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdzdGF0ZScsIChlbmFibGVkKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBTY3JpcHQgY29tcG9uZW50IG9mIGVudGl0eSAnJHtlbnRpdHkubmFtZX0nIGNoYW5nZWQgc3RhdGUgdG8gJyR7ZW5hYmxlZH0nYCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1NUQVRFID0gJ3N0YXRlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluZGV4IG9mIGEge0BsaW5rIFNjcmlwdFR5cGV9IGluc3RhbmNlIGlzIGNoYW5nZWQgaW4gdGhlIHNjcmlwdCBjb21wb25lbnQuXG4gICAgICogVGhpcyBldmVudCBpcyBhdmFpbGFibGUgaW4gdHdvIGZvcm1zLiBUaGV5IGFyZSBhcyBmb2xsb3dzOlxuICAgICAqXG4gICAgICogMS4gYG1vdmVgIC0gRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBtb3ZlZC4gVGhlIG5hbWUgb2YgdGhlIHNjcmlwdCB0eXBlLCB0aGUgc2NyaXB0XG4gICAgICogdHlwZSBpbnN0YW5jZSwgdGhlIG5ldyBpbmRleCBhbmQgdGhlIG9sZCBpbmRleCBhcmUgcGFzc2VkIGFzIGFyZ3VtZW50cy5cbiAgICAgKiAyLiBgbW92ZTpbbmFtZV1gIC0gRmlyZWQgd2hlbiBhIHNwZWNpZmljYWxseSBuYW1lZCBzY3JpcHQgaW5zdGFuY2UgaXMgbW92ZWQuIFRoZSBzY3JpcHRcbiAgICAgKiBpbnN0YW5jZSwgdGhlIG5ldyBpbmRleCBhbmQgdGhlIG9sZCBpbmRleCBhcmUgcGFzc2VkIGFzIGFyZ3VtZW50cy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignbW92ZScsIChuYW1lLCBzY3JpcHRJbnN0YW5jZSwgbmV3SW5kZXgsIG9sZEluZGV4KSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBTY3JpcHQgJyR7bmFtZX0nIG1vdmVkIGZyb20gaW5kZXggJyR7b2xkSW5kZXh9JyB0byAnJHtuZXdJbmRleH0nYCk7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdtb3ZlOnBsYXllcicsIChzY3JpcHRJbnN0YW5jZSwgbmV3SW5kZXgsIG9sZEluZGV4KSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBTY3JpcHQgJ3BsYXllcicgbW92ZWQgZnJvbSBpbmRleCAnJHtvbGRJbmRleH0nIHRvICcke25ld0luZGV4fSdgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfTU9WRSA9ICdtb3ZlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgU2NyaXB0VHlwZX0gaW5zdGFuY2UgaGFkIGFuIGV4Y2VwdGlvbi4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSBzY3JpcHRcbiAgICAgKiBpbnN0YW5jZSwgdGhlIGV4Y2VwdGlvbiBhbmQgdGhlIG1ldGhvZCBuYW1lIHRoYXQgdGhlIGV4Y2VwdGlvbiBvcmlnaW5hdGVkIGZyb20uXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Vycm9yJywgKHNjcmlwdEluc3RhbmNlLCBleGNlcHRpb24sIG1ldGhvZE5hbWUpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFNjcmlwdCBlcnJvcjogJHtleGNlcHRpb259IGluIG1ldGhvZCAnJHttZXRob2ROYW1lfSdgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRVJST1IgPSAnZXJyb3InO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcmlwdENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlNjcmlwdENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9sZHMgYWxsIHNjcmlwdCBpbnN0YW5jZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlW119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zY3JpcHRzID0gW107XG4gICAgICAgIC8vIGhvbGRzIGFsbCBzY3JpcHQgaW5zdGFuY2VzIHdpdGggYW4gdXBkYXRlIG1ldGhvZFxuICAgICAgICB0aGlzLl91cGRhdGVMaXN0ID0gbmV3IFNvcnRlZExvb3BBcnJheSh7IHNvcnRCeTogJ19fZXhlY3V0aW9uT3JkZXInIH0pO1xuICAgICAgICAvLyBob2xkcyBhbGwgc2NyaXB0IGluc3RhbmNlcyB3aXRoIGEgcG9zdFVwZGF0ZSBtZXRob2RcbiAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QgPSBuZXcgU29ydGVkTG9vcEFycmF5KHsgc29ydEJ5OiAnX19leGVjdXRpb25PcmRlcicgfSk7XG5cbiAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMgPSBbXTtcbiAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNEYXRhID0gbnVsbDtcbiAgICAgICAgdGhpcy5fb2xkU3RhdGUgPSB0cnVlO1xuXG4gICAgICAgIC8vIG92ZXJyaWRlIGRlZmF1bHQgJ2VuYWJsZWQnIHByb3BlcnR5IG9mIGJhc2UgcGMuQ29tcG9uZW50XG4gICAgICAgIC8vIGJlY2F1c2UgdGhpcyBpcyBmYXN0ZXJcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gd2hldGhlciB0aGlzIGNvbXBvbmVudCBpcyBjdXJyZW50bHkgYmVpbmcgZW5hYmxlZFxuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgLy8gaWYgdHJ1ZSB0aGVuIHdlIGFyZSBjdXJyZW50bHkgbG9vcGluZyB0aHJvdWdoXG4gICAgICAgIC8vIHNjcmlwdCBpbnN0YW5jZXMuIFRoaXMgaXMgdXNlZCB0byBwcmV2ZW50IGEgc2NyaXB0cyBhcnJheVxuICAgICAgICAvLyBmcm9tIGJlaW5nIG1vZGlmaWVkIHdoaWxlIGEgbG9vcCBpcyBiZWluZyBleGVjdXRlZFxuICAgICAgICB0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHRoZSBvcmRlciB0aGF0IHRoaXMgY29tcG9uZW50IHdpbGwgYmUgdXBkYXRlZFxuICAgICAgICAvLyBieSB0aGUgc2NyaXB0IHN5c3RlbS4gVGhpcyBpcyBzZXQgYnkgdGhlIHN5c3RlbSBpdHNlbGYuXG4gICAgICAgIHRoaXMuX2V4ZWN1dGlvbk9yZGVyID0gLTE7XG5cbiAgICAgICAgdGhpcy5vbignc2V0X2VuYWJsZWQnLCB0aGlzLl9vblNldEVuYWJsZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGFsbCBzY3JpcHQgaW5zdGFuY2VzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS4gVGhpcyBhcnJheSBpcyByZWFkLW9ubHkgYW5kIHNob3VsZFxuICAgICAqIG5vdCBiZSBtb2RpZmllZCBieSBkZXZlbG9wZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlW119XG4gICAgICovXG4gICAgc2V0IHNjcmlwdHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2NyaXB0c0RhdGEgPSB2YWx1ZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKCF2YWx1ZS5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLl9zY3JpcHRzSW5kZXhba2V5XTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQpIHtcbiAgICAgICAgICAgICAgICAvLyBleGlzdGluZyBzY3JpcHRcblxuICAgICAgICAgICAgICAgIC8vIGVuYWJsZWRcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2tleV0uZW5hYmxlZCA9PT0gJ2Jvb2xlYW4nKVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9ICEhdmFsdWVba2V5XS5lbmFibGVkO1xuXG4gICAgICAgICAgICAgICAgLy8gYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWVba2V5XS5hdHRyaWJ1dGVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdmFsdWVba2V5XS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoU2NyaXB0QXR0cmlidXRlcy5yZXNlcnZlZE5hbWVzLmhhcyhhdHRyKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzY3JpcHQuX19hdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmV3IGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdFR5cGUgPSB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5nZXQoa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0VHlwZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmFkZChhdHRyLCB7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRbYXR0cl0gPSB2YWx1ZVtrZXldLmF0dHJpYnV0ZXNbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFRPRE8gc2NyaXB0czJcbiAgICAgICAgICAgICAgICAvLyBuZXcgc2NyaXB0XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5vcmRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2NyaXB0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NjcmlwdHM7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9lbmFibGVkO1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0JywgJ2VuYWJsZWQnLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fYmVpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5lbnRpdHkuX2JlaW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5vblBvc3RTdGF0ZUNoYW5nZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYmVpbmdFbmFibGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG4gICAgfVxuXG4gICAgb25Qb3N0U3RhdGVDaGFuZ2UoKSB7XG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLnNjcmlwdHNbaV07XG5cbiAgICAgICAgICAgIGlmIChzY3JpcHQuX2luaXRpYWxpemVkICYmICFzY3JpcHQuX3Bvc3RJbml0aWFsaXplZCAmJiBzY3JpcHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHNjcmlwdC5fcG9zdEluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQucG9zdEluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHQsIFNDUklQVF9QT1NUX0lOSVRJQUxJWkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICAvLyBTZXRzIGlzTG9vcGluZ1Rocm91Z2hTY3JpcHRzIHRvIGZhbHNlIGFuZCByZXR1cm5zXG4gICAgLy8gaXRzIHByZXZpb3VzIHZhbHVlXG4gICAgX2JlZ2luTG9vcGluZygpIHtcbiAgICAgICAgY29uc3QgbG9vcGluZyA9IHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzO1xuICAgICAgICB0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyA9IHRydWU7XG4gICAgICAgIHJldHVybiBsb29waW5nO1xuICAgIH1cblxuICAgIC8vIFJlc3RvcmVzIGlzTG9vcGluZ1Rocm91Z2hTY3JpcHRzIHRvIHRoZSBzcGVjaWZpZWQgcGFyYW1ldGVyXG4gICAgLy8gSWYgYWxsIGxvb3BzIGFyZSBvdmVyIHRoZW4gcmVtb3ZlIGRlc3Ryb3llZCBzY3JpcHRzIGZvcm0gdGhlIF9zY3JpcHRzIGFycmF5XG4gICAgX2VuZExvb3Bpbmcod2FzTG9vcGluZ0JlZm9yZSkge1xuICAgICAgICB0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyA9IHdhc0xvb3BpbmdCZWZvcmU7XG4gICAgICAgIGlmICghdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZURlc3Ryb3llZFNjcmlwdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdlIGFsc28gbmVlZCB0aGlzIGhhbmRsZXIgYmVjYXVzZSBpdCBpcyBmaXJlZFxuICAgIC8vIHdoZW4gdmFsdWUgPT09IG9sZCBpbnN0ZWFkIG9mIG9uRW5hYmxlIGFuZCBvbkRpc2FibGVcbiAgICAvLyB3aGljaCBhcmUgb25seSBmaXJlZCB3aGVuIHZhbHVlICE9PSBvbGRcbiAgICBfb25TZXRFbmFibGVkKHByb3AsIG9sZCwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYmVpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBfY2hlY2tTdGF0ZSgpIHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZDtcbiAgICAgICAgaWYgKHN0YXRlID09PSB0aGlzLl9vbGRTdGF0ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9vbGRTdGF0ZSA9IHN0YXRlO1xuXG4gICAgICAgIHRoaXMuZmlyZShzdGF0ZSA/ICdlbmFibGUnIDogJ2Rpc2FibGUnKTtcbiAgICAgICAgdGhpcy5maXJlKCdzdGF0ZScsIHN0YXRlKTtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9hZGRDb21wb25lbnRUb0VuYWJsZWQodGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5fcmVtb3ZlQ29tcG9uZW50RnJvbUVuYWJsZWQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5zY3JpcHRzW2ldO1xuICAgICAgICAgICAgc2NyaXB0LmVuYWJsZWQgPSBzY3JpcHQuX2VuYWJsZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIF9vbkJlZm9yZVJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnKTtcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgc2NyaXB0c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2NyaXB0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5zY3JpcHRzW2ldO1xuICAgICAgICAgICAgaWYgKCFzY3JpcHQpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3koc2NyaXB0Ll9fc2NyaXB0VHlwZS5fX25hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICBfcmVtb3ZlRGVzdHJveWVkU2NyaXB0cygpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fZGVzdHJveWVkU2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGlmICghbGVuKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5fZGVzdHJveWVkU2NyaXB0c1tpXTtcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZVNjcmlwdEluc3RhbmNlKHNjcmlwdCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gdXBkYXRlIGV4ZWN1dGlvbiBvcmRlciBmb3Igc2NyaXB0c1xuICAgICAgICB0aGlzLl9yZXNldEV4ZWN1dGlvbk9yZGVyKDAsIHRoaXMuX3NjcmlwdHMubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBfb25Jbml0aWFsaXplQXR0cmlidXRlcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICAgIHRoaXMuc2NyaXB0c1tpXS5fX2luaXRpYWxpemVBdHRyaWJ1dGVzKCk7XG4gICAgfVxuXG4gICAgX3NjcmlwdE1ldGhvZChzY3JpcHQsIG1ldGhvZCwgYXJnKSB7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICBzY3JpcHRbbWV0aG9kXShhcmcpO1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAvLyBkaXNhYmxlIHNjcmlwdCBpZiBpdCBmYWlscyB0byBjYWxsIG1ldGhvZFxuICAgICAgICAgICAgc2NyaXB0LmVuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKCFzY3JpcHQuaGFzRXZlbnQoJ2Vycm9yJykpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYHVuaGFuZGxlZCBleGNlcHRpb24gd2hpbGUgY2FsbGluZyBcIiR7bWV0aG9kfVwiIGZvciBcIiR7c2NyaXB0Ll9fc2NyaXB0VHlwZS5fX25hbWV9XCIgc2NyaXB0OiBgLCBleCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjcmlwdC5maXJlKCdlcnJvcicsIGV4LCBtZXRob2QpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIHNjcmlwdCwgZXgsIG1ldGhvZCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX29uSW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHRoaXMuX3NjcmlwdHM7XG5cbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBzY3JpcHRzW2ldO1xuICAgICAgICAgICAgaWYgKCFzY3JpcHQuX2luaXRpYWxpemVkICYmIHNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgc2NyaXB0Ll9pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5pbml0aWFsaXplKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTQ1JJUFRfSU5JVElBTElaRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIF9vblBvc3RJbml0aWFsaXplKCkge1xuICAgICAgICB0aGlzLm9uUG9zdFN0YXRlQ2hhbmdlKCk7XG4gICAgfVxuXG4gICAgX29uVXBkYXRlKGR0KSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLl91cGRhdGVMaXN0O1xuICAgICAgICBpZiAoIWxpc3QubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIGZvciAobGlzdC5sb29wSW5kZXggPSAwOyBsaXN0Lmxvb3BJbmRleCA8IGxpc3QubGVuZ3RoOyBsaXN0Lmxvb3BJbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBsaXN0Lml0ZW1zW2xpc3QubG9vcEluZGV4XTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHQsIFNDUklQVF9VUERBVEUsIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX29uUG9zdFVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5fcG9zdFVwZGF0ZUxpc3Q7XG4gICAgICAgIGlmICghbGlzdC5sZW5ndGgpIHJldHVybjtcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsaXN0Lmxvb3BJbmRleCA9IDA7IGxpc3QubG9vcEluZGV4IDwgbGlzdC5sZW5ndGg7IGxpc3QubG9vcEluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGxpc3QuaXRlbXNbbGlzdC5sb29wSW5kZXhdO1xuICAgICAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdCwgU0NSSVBUX1BPU1RfVVBEQVRFLCBkdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydHMgc2NyaXB0IGluc3RhbmNlIGludG8gdGhlIHNjcmlwdHMgYXJyYXkgYXQgdGhlIHNwZWNpZmllZCBpbmRleC4gQWxzbyBpbnNlcnRzIHRoZVxuICAgICAqIHNjcmlwdCBpbnRvIHRoZSB1cGRhdGUgbGlzdCBpZiBpdCBoYXMgYW4gdXBkYXRlIG1ldGhvZCBhbmQgdGhlIHBvc3QgdXBkYXRlIGxpc3QgaWYgaXQgaGFzIGFcbiAgICAgKiBwb3N0VXBkYXRlIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBzY3JpcHQgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGluZGV4IHdoZXJlIHRvIGluc2VydCB0aGUgc2NyaXB0IGF0LiBJZiAtMSwgYXBwZW5kIGl0IGF0IHRoZSBlbmQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjcmlwdHNMZW5ndGggLSBUaGUgbGVuZ3RoIG9mIHRoZSBzY3JpcHRzIGFycmF5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luc2VydFNjcmlwdEluc3RhbmNlKHNjcmlwdEluc3RhbmNlLCBpbmRleCwgc2NyaXB0c0xlbmd0aCkge1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAvLyBhcHBlbmQgc2NyaXB0IGF0IHRoZSBlbmQgYW5kIHNldCBleGVjdXRpb24gb3JkZXJcbiAgICAgICAgICAgIHRoaXMuX3NjcmlwdHMucHVzaChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fX2V4ZWN1dGlvbk9yZGVyID0gc2NyaXB0c0xlbmd0aDtcblxuICAgICAgICAgICAgLy8gYXBwZW5kIHNjcmlwdCB0byB0aGUgdXBkYXRlIGxpc3QgaWYgaXQgaGFzIGFuIHVwZGF0ZSBtZXRob2RcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVMaXN0LmFwcGVuZChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFkZCBzY3JpcHQgdG8gdGhlIHBvc3RVcGRhdGUgbGlzdCBpZiBpdCBoYXMgYSBwb3N0VXBkYXRlIG1ldGhvZFxuICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdC5hcHBlbmQoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaW5zZXJ0IHNjcmlwdCBhdCBpbmRleCBhbmQgc2V0IGV4ZWN1dGlvbiBvcmRlclxuICAgICAgICAgICAgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaW5kZXgsIDAsIHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBpbmRleDtcblxuICAgICAgICAgICAgLy8gbm93IHdlIGFsc28gbmVlZCB0byB1cGRhdGUgdGhlIGV4ZWN1dGlvbiBvcmRlciBvZiBhbGxcbiAgICAgICAgICAgIC8vIHRoZSBzY3JpcHQgaW5zdGFuY2VzIHRoYXQgY29tZSBhZnRlciB0aGlzIHNjcmlwdFxuICAgICAgICAgICAgdGhpcy5fcmVzZXRFeGVjdXRpb25PcmRlcihpbmRleCArIDEsIHNjcmlwdHNMZW5ndGggKyAxKTtcblxuICAgICAgICAgICAgLy8gaW5zZXJ0IHNjcmlwdCB0byB0aGUgdXBkYXRlIGxpc3QgaWYgaXQgaGFzIGFuIHVwZGF0ZSBtZXRob2RcbiAgICAgICAgICAgIC8vIGluIHRoZSByaWdodCBvcmRlclxuICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaW5zZXJ0IHNjcmlwdCB0byB0aGUgcG9zdFVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhIHBvc3RVcGRhdGUgbWV0aG9kXG4gICAgICAgICAgICAvLyBpbiB0aGUgcmlnaHQgb3JkZXJcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5wb3N0VXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSkge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuIGlkeDtcblxuICAgICAgICB0aGlzLl9zY3JpcHRzLnNwbGljZShpZHgsIDEpO1xuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5wb3N0VXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdC5yZW1vdmUoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGlkeDtcbiAgICB9XG5cbiAgICBfcmVzZXRFeGVjdXRpb25PcmRlcihzdGFydEluZGV4LCBzY3JpcHRzTGVuZ3RoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgc2NyaXB0c0xlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzW2ldLl9fZXhlY3V0aW9uT3JkZXIgPSBpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoYXR0cmlidXRlLCBhdHRyaWJ1dGVOYW1lLCBvbGRWYWx1ZSwgdXNlR3VpZCwgbmV3QXR0cmlidXRlcywgZHVwbGljYXRlZElkc01hcCkge1xuICAgICAgICBpZiAoYXR0cmlidXRlLmFycmF5KSB7XG4gICAgICAgICAgICAvLyBoYW5kbGUgZW50aXR5IGFycmF5IGF0dHJpYnV0ZVxuICAgICAgICAgICAgY29uc3QgbGVuID0gb2xkVmFsdWUubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKCFsZW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld0d1aWRBcnJheSA9IG9sZFZhbHVlLnNsaWNlKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3VpZCA9IG5ld0d1aWRBcnJheVtpXSBpbnN0YW5jZW9mIEVudGl0eSA/IG5ld0d1aWRBcnJheVtpXS5nZXRHdWlkKCkgOiBuZXdHdWlkQXJyYXlbaV07XG4gICAgICAgICAgICAgICAgaWYgKGR1cGxpY2F0ZWRJZHNNYXBbZ3VpZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3R3VpZEFycmF5W2ldID0gdXNlR3VpZCA/IGR1cGxpY2F0ZWRJZHNNYXBbZ3VpZF0uZ2V0R3VpZCgpIDogZHVwbGljYXRlZElkc01hcFtndWlkXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ld0F0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPSBuZXdHdWlkQXJyYXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBoYW5kbGUgcmVndWxhciBlbnRpdHkgYXR0cmlidXRlXG4gICAgICAgICAgICBpZiAob2xkVmFsdWUgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBvbGRWYWx1ZSA9IG9sZFZhbHVlLmdldEd1aWQoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9sZFZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGR1cGxpY2F0ZWRJZHNNYXBbb2xkVmFsdWVdKSB7XG4gICAgICAgICAgICAgICAgbmV3QXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IGR1cGxpY2F0ZWRJZHNNYXBbb2xkVmFsdWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0ZWN0IGlmIHNjcmlwdCBpcyBhdHRhY2hlZCB0byBhbiBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGU+fSBuYW1lT3JUeXBlIC0gVGhlXG4gICAgICogbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgc2NyaXB0IGlzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChlbnRpdHkuc2NyaXB0LmhhcygncGxheWVyQ29udHJvbGxlcicpKSB7XG4gICAgICogICAgIC8vIGVudGl0eSBoYXMgc2NyaXB0XG4gICAgICogfVxuICAgICAqL1xuICAgIGhhcyhuYW1lT3JUeXBlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiAhIXRoaXMuX3NjcmlwdHNJbmRleFtuYW1lT3JUeXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbmFtZU9yVHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEgJiYgc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZTsgLy8gd2lsbCByZXR1cm4gZmFsc2UgaWYgc2NyaXB0SW5zdGFuY2UgdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc2NyaXB0IGluc3RhbmNlIChpZiBhdHRhY2hlZCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGU+fSBuYW1lT3JUeXBlIC0gVGhlXG4gICAgICogbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfG51bGx9IElmIHNjcmlwdCBpcyBhdHRhY2hlZCwgdGhlXG4gICAgICogaW5zdGFuY2UgaXMgcmV0dXJuZWQuIE90aGVyd2lzZSBudWxsIGlzIHJldHVybmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgY29udHJvbGxlciA9IGVudGl0eS5zY3JpcHQuZ2V0KCdwbGF5ZXJDb250cm9sbGVyJyk7XG4gICAgICovXG4gICAgZ2V0KG5hbWVPclR5cGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtuYW1lT3JUeXBlXTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhID8gZGF0YS5pbnN0YW5jZSA6IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW5hbWVPclR5cGUpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEgJiYgc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZSA/IHNjcmlwdEluc3RhbmNlIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBzY3JpcHQgaW5zdGFuY2UgYW5kIGF0dGFjaCB0byBhbiBlbnRpdHkgc2NyaXB0IGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfENsYXNzPGltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGVcbiAgICAgKiBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJnc10gLSBPYmplY3Qgd2l0aCBhcmd1bWVudHMgZm9yIGEgc2NyaXB0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FyZ3MuZW5hYmxlZF0gLSBJZiBzY3JpcHQgaW5zdGFuY2UgaXMgZW5hYmxlZCBhZnRlciBjcmVhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB0cnVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJncy5hdHRyaWJ1dGVzXSAtIE9iamVjdCB3aXRoIHZhbHVlcyBmb3IgYXR0cmlidXRlcyAoaWYgYW55KSwgd2hlcmUga2V5IGlzXG4gICAgICogbmFtZSBvZiBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYXJncy5wcmVsb2FkaW5nXSAtIElmIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGR1cmluZyBwcmVsb2FkLiBJZiB0cnVlLFxuICAgICAqIHNjcmlwdCBhbmQgYXR0cmlidXRlcyBtdXN0IGJlIGluaXRpYWxpemVkIG1hbnVhbGx5LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MuaW5kXSAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBpbnN0YW5jZSBhdC4gRGVmYXVsdHMgdG9cbiAgICAgKiAtMSwgd2hpY2ggbWVhbnMgYXBwZW5kIGl0IGF0IHRoZSBlbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZXxudWxsfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGFcbiAgICAgKiB7QGxpbmsgU2NyaXB0VHlwZX0gaWYgc3VjY2Vzc2Z1bGx5IGF0dGFjaGVkIHRvIGFuIGVudGl0eSwgb3IgbnVsbCBpZiBpdCBmYWlsZWQgYmVjYXVzZSBhXG4gICAgICogc2NyaXB0IHdpdGggYSBzYW1lIG5hbWUgaGFzIGFscmVhZHkgYmVlbiBhZGRlZCBvciBpZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IGNhbm5vdCBiZSBmb3VuZFxuICAgICAqIGJ5IG5hbWUgaW4gdGhlIHtAbGluayBTY3JpcHRSZWdpc3RyeX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0LmNyZWF0ZSgncGxheWVyQ29udHJvbGxlcicsIHtcbiAgICAgKiAgICAgYXR0cmlidXRlczoge1xuICAgICAqICAgICAgICAgc3BlZWQ6IDRcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNyZWF0ZShuYW1lT3JUeXBlLCBhcmdzID0ge30pIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuICAgICAgICBsZXQgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGU7XG5cbiAgICAgICAgLy8gc2hvcnRoYW5kIHVzaW5nIHNjcmlwdCBuYW1lXG4gICAgICAgIGlmICh0eXBlb2Ygc2NyaXB0VHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjcmlwdFR5cGUgPSB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5nZXQoc2NyaXB0VHlwZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdIHx8ICF0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0uaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgc2NyaXB0IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBuZXcgc2NyaXB0VHlwZSh7XG4gICAgICAgICAgICAgICAgICAgIGFwcDogdGhpcy5zeXN0ZW0uYXBwLFxuICAgICAgICAgICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBhcmdzLmhhc093blByb3BlcnR5KCdlbmFibGVkJykgPyBhcmdzLmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBhcmdzLmF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX3NjcmlwdHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxldCBpbmQgPSAtMTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3MuaW5kID09PSAnbnVtYmVyJyAmJiBhcmdzLmluZCAhPT0gLTEgJiYgbGVuID4gYXJncy5pbmQpXG4gICAgICAgICAgICAgICAgICAgIGluZCA9IGFyZ3MuaW5kO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5faW5zZXJ0U2NyaXB0SW5zdGFuY2Uoc2NyaXB0SW5zdGFuY2UsIGluZCwgbGVuKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2U6IHNjcmlwdEluc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBvblN3YXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc3dhcChzY3JpcHROYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MucHJlbG9hZGluZylcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdjcmVhdGUnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdjcmVhdGU6JyArIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLm9uKCdzd2FwOicgKyBzY3JpcHROYW1lLCB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0ub25Td2FwKTtcblxuICAgICAgICAgICAgICAgIGlmICghYXJncy5wcmVsb2FkaW5nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLmVuYWJsZWQgJiYgIXNjcmlwdEluc3RhbmNlLl9pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX2luaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLmluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdEluc3RhbmNlLCBTQ1JJUFRfSU5JVElBTElaRSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCAmJiAhc2NyaXB0SW5zdGFuY2UuX3Bvc3RJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX3Bvc3RJbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdEluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdEluc3RhbmNlLCBTQ1JJUFRfUE9TVF9JTklUSUFMSVpFKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBzY3JpcHQgJyR7c2NyaXB0TmFtZX0nIGlzIGFscmVhZHkgYWRkZWQgdG8gZW50aXR5ICcke3RoaXMuZW50aXR5Lm5hbWV9J2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGF3YWl0aW5nOiB0cnVlLFxuICAgICAgICAgICAgICAgIGluZDogdGhpcy5fc2NyaXB0cy5sZW5ndGhcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLndhcm4oYHNjcmlwdCAnJHtzY3JpcHROYW1lfScgaXMgbm90IGZvdW5kLCBhd2FpdGluZyBpdCB0byBiZSBhZGRlZCB0byByZWdpc3RyeWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgc2NyaXB0IGluc3RhbmNlIHRoYXQgaXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZVxuICAgICAqIG5hbWUgb3IgdHlwZSBvZiB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIGl0IHdhcyBzdWNjZXNzZnVsbHkgZGVzdHJveWVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5kZXN0cm95KCdwbGF5ZXJDb250cm9sbGVyJyk7XG4gICAgICovXG4gICAgZGVzdHJveShuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjcmlwdERhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGlmICghc2NyaXB0RGF0YSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlICYmICFzY3JpcHRJbnN0YW5jZS5fZGVzdHJveWVkKSB7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fZGVzdHJveWVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIG5vdCBjdXJyZW50bHkgbG9vcGluZyB0aHJvdWdoIG91ciBzY3JpcHRzXG4gICAgICAgICAgICAvLyB0aGVuIGl0J3Mgc2FmZSB0byByZW1vdmUgdGhlIHNjcmlwdFxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZCA9IHRoaXMuX3JlbW92ZVNjcmlwdEluc3RhbmNlKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzZXRFeGVjdXRpb25PcmRlcihpbmQsIHRoaXMuX3NjcmlwdHMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBwdXNoIHRoZSBzY3JpcHQgaW4gX2Rlc3Ryb3llZFNjcmlwdHMgYW5kXG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gX3NjcmlwdHMgd2hlbiB0aGUgbG9vcCBpcyBvdmVyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVzdHJveWVkU2NyaXB0cy5wdXNoKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBzd2FwIGV2ZW50XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLm9mZignc3dhcDonICsgc2NyaXB0TmFtZSwgc2NyaXB0RGF0YS5vblN3YXApO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzW3NjcmlwdE5hbWVdO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlIHx8IG51bGwpO1xuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3k6JyArIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlIHx8IG51bGwpO1xuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZSlcbiAgICAgICAgICAgIHNjcmlwdEluc3RhbmNlLmZpcmUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTd2FwIHRoZSBzY3JpcHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGU+fSBuYW1lT3JUeXBlIC0gVGhlXG4gICAgICogbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBzd2FwcGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3dhcChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFvbGQgfHwgIW9sZC5pbnN0YW5jZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlT2xkID0gb2xkLmluc3RhbmNlO1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2VPbGQpO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gbmV3IHNjcmlwdFR5cGUoe1xuICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgZW5hYmxlZDogc2NyaXB0SW5zdGFuY2VPbGQuZW5hYmxlZCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHNjcmlwdEluc3RhbmNlT2xkLl9fYXR0cmlidXRlc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXNjcmlwdEluc3RhbmNlLnN3YXApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgIC8vIGFkZCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fc2NyaXB0c1tpbmRdID0gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSA9IHNjcmlwdEluc3RhbmNlO1xuICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgLy8gc2V0IGV4ZWN1dGlvbiBvcmRlciBhbmQgbWFrZSBzdXJlIHdlIHVwZGF0ZVxuICAgICAgICAvLyBvdXIgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxpc3RzXG4gICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBpbmQ7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZU9sZC51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2VPbGQucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHRJbnN0YW5jZSwgU0NSSVBUX1NXQVAsIHNjcmlwdEluc3RhbmNlT2xkKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3N3YXAnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc3dhcDonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gYW4gZW50aXR5IGlzIGNsb25lZCBhbmQgaXQgaGFzIGVudGl0eSBzY3JpcHQgYXR0cmlidXRlcyB0aGF0IHBvaW50IHRvIG90aGVyIGVudGl0aWVzIGluXG4gICAgICogdGhlIHNhbWUgc3VidHJlZSB0aGF0IGlzIGNsb25lZCwgdGhlbiB3ZSB3YW50IHRoZSBuZXcgc2NyaXB0IGF0dHJpYnV0ZXMgdG8gcG9pbnQgYXQgdGhlXG4gICAgICogY2xvbmVkIGVudGl0aWVzLiBUaGlzIG1ldGhvZCByZW1hcHMgdGhlIHNjcmlwdCBhdHRyaWJ1dGVzIGZvciB0aGlzIGVudGl0eSBhbmQgaXQgYXNzdW1lc1xuICAgICAqIHRoYXQgdGhpcyBlbnRpdHkgaXMgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY3JpcHRDb21wb25lbnR9IG9sZFNjcmlwdENvbXBvbmVudCAtIFRoZSBzb3VyY2Ugc2NyaXB0IGNvbXBvbmVudCB0aGF0IGJlbG9uZ3MgdG9cbiAgICAgKiB0aGUgZW50aXR5IHRoYXQgd2FzIGJlaW5nIGNsb25lZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZHVwbGljYXRlZElkc01hcCAtIEEgZGljdGlvbmFyeSB3aXRoIGd1aWQtZW50aXR5IHZhbHVlcyB0aGF0IGNvbnRhaW5zIHRoZVxuICAgICAqIGVudGl0aWVzIHRoYXQgd2VyZSBjbG9uZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkU2NyaXB0Q29tcG9uZW50LCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGNvbnN0IG5ld1NjcmlwdENvbXBvbmVudCA9IHRoaXMuZW50aXR5LnNjcmlwdDtcblxuICAgICAgICAvLyBmb3IgZWFjaCBzY3JpcHQgaW4gdGhlIG9sZCBjb21wb25lbnRcbiAgICAgICAgZm9yIChjb25zdCBzY3JpcHROYW1lIGluIG9sZFNjcmlwdENvbXBvbmVudC5fc2NyaXB0c0luZGV4KSB7XG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCB0eXBlIGZyb20gdGhlIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHROYW1lKTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCBmcm9tIHRoZSBjb21wb25lbnQncyBpbmRleFxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gb2xkU2NyaXB0Q29tcG9uZW50Ll9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdCB8fCAhc2NyaXB0Lmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIF9fYXR0cmlidXRlc1JhdyBleGlzdHMgdGhlbiBpdCBtZWFucyB0aGF0IHRoZSBuZXcgZW50aXR5XG4gICAgICAgICAgICAvLyBoYXMgbm90IHlldCBpbml0aWFsaXplZCBpdHMgYXR0cmlidXRlcyBzbyBwdXQgdGhlIG5ldyBndWlkIGluIHRoZXJlLFxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGl0IG1lYW5zIHRoYXQgdGhlIGF0dHJpYnV0ZXMgaGF2ZSBhbHJlYWR5IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgIC8vIHNvIGNvbnZlcnQgdGhlIG5ldyBndWlkIHRvIGFuIGVudGl0eVxuICAgICAgICAgICAgLy8gYW5kIHB1dCBpdCBpbiB0aGUgbmV3IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGNvbnN0IG5ld0F0dHJpYnV0ZXNSYXcgPSBuZXdTY3JpcHRDb21wb25lbnRbc2NyaXB0TmFtZV0uX19hdHRyaWJ1dGVzUmF3O1xuICAgICAgICAgICAgY29uc3QgbmV3QXR0cmlidXRlcyA9IG5ld1NjcmlwdENvbXBvbmVudFtzY3JpcHROYW1lXS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBpZiAoIW5ld0F0dHJpYnV0ZXNSYXcgJiYgIW5ld0F0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIHVzaW5nIGF0dHJpYnV0ZXNSYXcgdGhlbiB1c2UgdGhlIGd1aWQgb3RoZXJ3aXNlIHVzZSB0aGUgZW50aXR5XG4gICAgICAgICAgICBjb25zdCB1c2VHdWlkID0gISFuZXdBdHRyaWJ1dGVzUmF3O1xuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIG9sZCBzY3JpcHQgYXR0cmlidXRlcyBmcm9tIHRoZSBpbnN0YW5jZVxuICAgICAgICAgICAgY29uc3Qgb2xkQXR0cmlidXRlcyA9IHNjcmlwdC5pbnN0YW5jZS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZU5hbWUgaW4gb2xkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGlmICghb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgdGhlIGF0dHJpYnV0ZSBkZWZpbml0aW9uIGZyb20gdGhlIHNjcmlwdCB0eXBlXG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmdldChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVudGl0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZUd1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdBdHRyaWJ1dGVzUmF3IHx8IG5ld0F0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ2pzb24nICYmIEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8ganNvbiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3SnNvblZhbHVlID0gKG5ld0F0dHJpYnV0ZXNSYXcgPyBuZXdBdHRyaWJ1dGVzUmF3W2F0dHJpYnV0ZU5hbWVdIDogbmV3QXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRyaWJ1dGUuc2NoZW1hLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IGF0dHJpYnV0ZS5zY2hlbWFbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQudHlwZSAhPT0gJ2VudGl0eScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgb2xkVmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlW2pdW2ZpZWxkLm5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0pzb25WYWx1ZVtqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZVtmaWVsZC5uYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3SnNvblZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1vdmUgc2NyaXB0IGluc3RhbmNlIHRvIGRpZmZlcmVudCBwb3NpdGlvbiB0byBhbHRlciB1cGRhdGUgb3JkZXIgb2Ygc2NyaXB0cyB3aXRoaW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZVxuICAgICAqIG5hbWUgb3IgdHlwZSBvZiB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZCAtIE5ldyBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQubW92ZSgncGxheWVyQ29udHJvbGxlcicsIDApO1xuICAgICAqL1xuICAgIG1vdmUobmFtZU9yVHlwZSwgaW5kKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX3NjcmlwdHMubGVuZ3RoO1xuICAgICAgICBpZiAoaW5kID49IGxlbiB8fCBpbmQgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGxldCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdE5hbWUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2NyaXB0TmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBuYW1lT3JUeXBlLl9fbmFtZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdFR5cGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFzY3JpcHREYXRhIHx8ICFzY3JpcHREYXRhLmluc3RhbmNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIGlmIHNjcmlwdCB0eXBlIHNwZWNpZmllZCwgbWFrZSBzdXJlIGluc3RhbmNlIG9mIHNhaWQgdHlwZVxuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIGlmIChzY3JpcHRUeXBlICYmICEoc2NyaXB0SW5zdGFuY2UgaW5zdGFuY2VvZiBzY3JpcHRUeXBlKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbmRPbGQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICBpZiAoaW5kT2xkID09PSAtMSB8fCBpbmRPbGQgPT09IGluZClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBtb3ZlIHNjcmlwdCB0byBhbm90aGVyIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGluZCwgMCwgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaW5kT2xkLCAxKVswXSk7XG5cbiAgICAgICAgLy8gcmVzZXQgZXhlY3V0aW9uIG9yZGVyIGZvciBzY3JpcHRzIGFuZCByZS1zb3J0IHVwZGF0ZSBhbmQgcG9zdFVwZGF0ZSBsaXN0c1xuICAgICAgICB0aGlzLl9yZXNldEV4ZWN1dGlvbk9yZGVyKDAsIGxlbik7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUxpc3Quc29ydCgpO1xuICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdC5zb3J0KCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdtb3ZlJywgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKTtcbiAgICAgICAgdGhpcy5maXJlKCdtb3ZlOicgKyBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSwgaW5kLCBpbmRPbGQpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NyaXB0Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU2NyaXB0Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfc2NyaXB0cyIsIl91cGRhdGVMaXN0IiwiU29ydGVkTG9vcEFycmF5Iiwic29ydEJ5IiwiX3Bvc3RVcGRhdGVMaXN0IiwiX3NjcmlwdHNJbmRleCIsIl9kZXN0cm95ZWRTY3JpcHRzIiwiX2Rlc3Ryb3llZCIsIl9zY3JpcHRzRGF0YSIsIl9vbGRTdGF0ZSIsIl9lbmFibGVkIiwiX2JlaW5nRW5hYmxlZCIsIl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyIsIl9leGVjdXRpb25PcmRlciIsIm9uIiwiX29uU2V0RW5hYmxlZCIsInNjcmlwdHMiLCJ2YWx1ZSIsImtleSIsImhhc093blByb3BlcnR5Iiwic2NyaXB0IiwiZW5hYmxlZCIsImF0dHJpYnV0ZXMiLCJhdHRyIiwiU2NyaXB0QXR0cmlidXRlcyIsInJlc2VydmVkTmFtZXMiLCJoYXMiLCJfX2F0dHJpYnV0ZXMiLCJzY3JpcHRUeXBlIiwiYXBwIiwiZ2V0IiwiYWRkIiwiY29uc29sZSIsImxvZyIsIm9yZGVyIiwib2xkVmFsdWUiLCJmaXJlIiwib25FbmFibGUiLCJfY2hlY2tTdGF0ZSIsIm9uUG9zdFN0YXRlQ2hhbmdlIiwib25EaXNhYmxlIiwid2FzTG9vcGluZyIsIl9iZWdpbkxvb3BpbmciLCJpIiwibGVuIiwibGVuZ3RoIiwiX2luaXRpYWxpemVkIiwiX3Bvc3RJbml0aWFsaXplZCIsInBvc3RJbml0aWFsaXplIiwiX3NjcmlwdE1ldGhvZCIsIlNDUklQVF9QT1NUX0lOSVRJQUxJWkUiLCJfZW5kTG9vcGluZyIsImxvb3BpbmciLCJ3YXNMb29waW5nQmVmb3JlIiwiX3JlbW92ZURlc3Ryb3llZFNjcmlwdHMiLCJwcm9wIiwib2xkIiwic3RhdGUiLCJfYWRkQ29tcG9uZW50VG9FbmFibGVkIiwiX3JlbW92ZUNvbXBvbmVudEZyb21FbmFibGVkIiwiX29uQmVmb3JlUmVtb3ZlIiwiZGVzdHJveSIsIl9fc2NyaXB0VHlwZSIsIl9fbmFtZSIsIl9yZW1vdmVTY3JpcHRJbnN0YW5jZSIsIl9yZXNldEV4ZWN1dGlvbk9yZGVyIiwiX29uSW5pdGlhbGl6ZUF0dHJpYnV0ZXMiLCJfX2luaXRpYWxpemVBdHRyaWJ1dGVzIiwibWV0aG9kIiwiYXJnIiwiZXgiLCJoYXNFdmVudCIsIndhcm4iLCJlcnJvciIsIl9vbkluaXRpYWxpemUiLCJpbml0aWFsaXplIiwiU0NSSVBUX0lOSVRJQUxJWkUiLCJfb25Qb3N0SW5pdGlhbGl6ZSIsIl9vblVwZGF0ZSIsImR0IiwibGlzdCIsImxvb3BJbmRleCIsIml0ZW1zIiwiU0NSSVBUX1VQREFURSIsIl9vblBvc3RVcGRhdGUiLCJTQ1JJUFRfUE9TVF9VUERBVEUiLCJfaW5zZXJ0U2NyaXB0SW5zdGFuY2UiLCJzY3JpcHRJbnN0YW5jZSIsImluZGV4Iiwic2NyaXB0c0xlbmd0aCIsInB1c2giLCJfX2V4ZWN1dGlvbk9yZGVyIiwidXBkYXRlIiwiYXBwZW5kIiwicG9zdFVwZGF0ZSIsInNwbGljZSIsImluc2VydCIsImlkeCIsImluZGV4T2YiLCJyZW1vdmUiLCJzdGFydEluZGV4IiwiX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJhdHRyaWJ1dGVOYW1lIiwidXNlR3VpZCIsIm5ld0F0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkSWRzTWFwIiwiYXJyYXkiLCJuZXdHdWlkQXJyYXkiLCJzbGljZSIsImd1aWQiLCJFbnRpdHkiLCJnZXRHdWlkIiwibmFtZU9yVHlwZSIsInNjcmlwdE5hbWUiLCJzY3JpcHREYXRhIiwiaW5zdGFuY2UiLCJkYXRhIiwiY3JlYXRlIiwiYXJncyIsInNlbGYiLCJpbmQiLCJvblN3YXAiLCJzd2FwIiwicHJlbG9hZGluZyIsIkRlYnVnIiwibmFtZSIsImF3YWl0aW5nIiwib2ZmIiwic2NyaXB0SW5zdGFuY2VPbGQiLCJTQ1JJUFRfU1dBUCIsInJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyIsIm9sZFNjcmlwdENvbXBvbmVudCIsIm5ld1NjcmlwdENvbXBvbmVudCIsIm5ld0F0dHJpYnV0ZXNSYXciLCJfX2F0dHJpYnV0ZXNSYXciLCJvbGRBdHRyaWJ1dGVzIiwidHlwZSIsIkFycmF5IiwiaXNBcnJheSIsInNjaGVtYSIsIm5ld0pzb25WYWx1ZSIsImZpZWxkIiwiaiIsIm1vdmUiLCJpbmRPbGQiLCJzb3J0IiwiRVZFTlRfQ1JFQVRFIiwiRVZFTlRfREVTVFJPWSIsIkVWRU5UX0VOQUJMRSIsIkVWRU5UX0RJU0FCTEUiLCJFVkVOVF9SRU1PVkUiLCJFVkVOVF9TVEFURSIsIkVWRU5UX01PVkUiLCJFVkVOVF9FUlJPUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQVlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQTRIcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFDeEIsSUFBQSxLQUFLLENBQUNELE1BQU0sRUFBRUMsTUFBTSxDQUFDLENBQUE7O0FBRXJCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsUUFBUSxHQUFHLEVBQUUsQ0FBQTtBQUNsQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxXQUFXLEdBQUcsSUFBSUMsZUFBZSxDQUFDO0FBQUVDLE1BQUFBLE1BQU0sRUFBRSxrQkFBQTtBQUFtQixLQUFDLENBQUMsQ0FBQTtBQUN0RTtBQUNBLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsSUFBSUYsZUFBZSxDQUFDO0FBQUVDLE1BQUFBLE1BQU0sRUFBRSxrQkFBQTtBQUFtQixLQUFDLENBQUMsQ0FBQTtBQUUxRSxJQUFBLElBQUksQ0FBQ0UsYUFBYSxHQUFHLEVBQUUsQ0FBQTtJQUN2QixJQUFJLENBQUNDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQTtJ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
