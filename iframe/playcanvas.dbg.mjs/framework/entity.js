import { Debug } from '../core/debug.js';
import { guid } from '../core/guid.js';
import { GraphNode } from '../scene/graph-node.js';
import { getApplication } from './globals.js';

/**
 * @type {GraphNode[]}
 * @ignore
 */
const _enableList = [];

/**
 * The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game
 * will consist of an {@link Entity}, and a set of {@link Component}s which are managed by their
 * respective {@link ComponentSystem}s. One of those components maybe a {@link ScriptComponent}
 * which allows you to write custom code to attach to your Entity.
 *
 * The Entity uniquely identifies the object and also provides a transform for position and
 * orientation which it inherits from {@link GraphNode} so can be added into the scene graph. The
 * Component and ComponentSystem provide the logic to give an Entity a specific type of behavior.
 * e.g. the ability to render a model or play a sound. Components are specific to an instance of an
 * Entity and are attached (e.g. `this.entity.model`) ComponentSystems allow access to all Entities
 * and Components and are attached to the {@link AppBase}.
 *
 * @augments GraphNode
 */
class Entity extends GraphNode {
  /**
   * Create a new Entity.
   *
   * @param {string} [name] - The non-unique name of the entity, default is "Untitled".
   * @param {import('./app-base.js').AppBase} [app] - The application the entity belongs to,
   * default is the current application.
   * @example
   * const entity = new pc.Entity();
   *
   * // Add a Component to the Entity
   * entity.addComponent("camera", {
   *     fov: 45,
   *     nearClip: 1,
   *     farClip: 10000
   * });
   *
   * // Add the Entity into the scene graph
   * app.root.addChild(entity);
   *
   * // Move the entity
   * entity.translate(10, 0, 0);
   *
   * // Or translate it by setting its position directly
   * const p = entity.getPosition();
   * entity.setPosition(p.x + 10, p.y, p.z);
   *
   * // Change the entity's rotation in local space
   * const e = entity.getLocalEulerAngles();
   * entity.setLocalEulerAngles(e.x, e.y + 90, e.z);
   *
   * // Or use rotateLocal
   * entity.rotateLocal(0, 90, 0);
   */
  constructor(name, app = getApplication()) {
    super(name);
    /**
     * Gets the {@link AnimComponent} attached to this entity.
     *
     * @type {import('./components/anim/component.js').AnimComponent|undefined}
     * @readonly
     */
    this.anim = void 0;
    /**
     * Gets the {@link AnimationComponent} attached to this entity.
     *
     * @type {import('./components/animation/component.js').AnimationComponent|undefined}
     * @readonly
     */
    this.animation = void 0;
    /**
     * Gets the {@link AudioListenerComponent} attached to this entity.
     *
     * @type {import('./components/audio-listener/component.js').AudioListenerComponent|undefined}
     * @readonly
     */
    this.audiolistener = void 0;
    /**
     * Gets the {@link ButtonComponent} attached to this entity.
     *
     * @type {import('./components/button/component.js').ButtonComponent|undefined}
     * @readonly
     */
    this.button = void 0;
    /**
     * Gets the {@link CameraComponent} attached to this entity.
     *
     * @type {import('./components/camera/component.js').CameraComponent|undefined}
     * @readonly
     */
    this.camera = void 0;
    /**
     * Gets the {@link CollisionComponent} attached to this entity.
     *
     * @type {import('./components/collision/component.js').CollisionComponent|undefined}
     * @readonly
     */
    this.collision = void 0;
    /**
     * Gets the {@link ElementComponent} attached to this entity.
     *
     * @type {import('./components/element/component.js').ElementComponent|undefined}
     * @readonly
     */
    this.element = void 0;
    /**
     * Gets the {@link GSplatComponent} attached to this entity.
     *
     * @type {import('./components/gsplat/component.js').GSplatComponent|undefined}
     * @readonly
     */
    this.gsplat = void 0;
    /**
     * Gets the {@link LayoutChildComponent} attached to this entity.
     *
     * @type {import('./components/layout-child/component.js').LayoutChildComponent|undefined}
     * @readonly
     */
    this.layoutchild = void 0;
    /**
     * Gets the {@link LayoutGroupComponent} attached to this entity.
     *
     * @type {import('./components/layout-group/component.js').LayoutGroupComponent|undefined}
     * @readonly
     */
    this.layoutgroup = void 0;
    /**
     * Gets the {@link LightComponent} attached to this entity.
     *
     * @type {import('./components/light/component.js').LightComponent|undefined}
     * @readonly
     */
    this.light = void 0;
    /**
     * Gets the {@link ModelComponent} attached to this entity.
     *
     * @type {import('./components/model/component.js').ModelComponent|undefined}
     * @readonly
     */
    this.model = void 0;
    /**
     * Gets the {@link ParticleSystemComponent} attached to this entity.
     *
     * @type {import('./components/particle-system/component.js').ParticleSystemComponent|undefined}
     * @readonly
     */
    this.particlesystem = void 0;
    /**
     * Gets the {@link RenderComponent} attached to this entity.
     *
     * @type {import('./components/render/component.js').RenderComponent|undefined}
     * @readonly
     */
    this.render = void 0;
    /**
     * Gets the {@link RigidBodyComponent} attached to this entity.
     *
     * @type {import('./components/rigid-body/component.js').RigidBodyComponent|undefined}
     * @readonly
     */
    this.rigidbody = void 0;
    /**
     * Gets the {@link ScreenComponent} attached to this entity.
     *
     * @type {import('./components/screen/component.js').ScreenComponent|undefined}
     * @readonly
     */
    this.screen = void 0;
    /**
     * Gets the {@link ScriptComponent} attached to this entity.
     *
     * @type {import('./components/script/component.js').ScriptComponent|undefined}
     * @readonly
     */
    this.script = void 0;
    /**
     * Gets the {@link ScrollbarComponent} attached to this entity.
     *
     * @type {import('./components/scrollbar/component.js').ScrollbarComponent|undefined}
     * @readonly
     */
    this.scrollbar = void 0;
    /**
     * Gets the {@link ScrollViewComponent} attached to this entity.
     *
     * @type {import('./components/scroll-view/component.js').ScrollViewComponent|undefined}
     * @readonly
     */
    this.scrollview = void 0;
    /**
     * Gets the {@link SoundComponent} attached to this entity.
     *
     * @type {import('./components/sound/component.js').SoundComponent|undefined}
     * @readonly
     */
    this.sound = void 0;
    /**
     * Gets the {@link SpriteComponent} attached to this entity.
     *
     * @type {import('./components/sprite/component.js').SpriteComponent|undefined}
     * @readonly
     */
    this.sprite = void 0;
    /**
     * Component storage.
     *
     * @type {Object<string, import('./components/component.js').Component>}
     * @ignore
     */
    this.c = {};
    /**
     * @type {import('./app-base.js').AppBase}
     * @private
     */
    this._app = void 0;
    /**
     * Used by component systems to speed up destruction.
     *
     * @type {boolean}
     * @ignore
     */
    this._destroying = false;
    /**
     * @type {string|null}
     * @private
     */
    this._guid = null;
    /**
     * Used to differentiate between the entities of a template root instance, which have it set to
     * true, and the cloned instance entities (set to false).
     *
     * @type {boolean}
     * @ignore
     */
    this._template = false;
    Debug.assert(app, 'Could not find current application');
    this._app = app;
  }

  /**
   * Create a new component and add it to the entity. Use this to add functionality to the entity
   * like rendering a model, playing sounds and so on.
   *
   * @param {string} type - The name of the component to add. Valid strings are:
   *
   * - "anim" - see {@link AnimComponent}
   * - "animation" - see {@link AnimationComponent}
   * - "audiolistener" - see {@link AudioListenerComponent}
   * - "button" - see {@link ButtonComponent}
   * - "camera" - see {@link CameraComponent}
   * - "collision" - see {@link CollisionComponent}
   * - "element" - see {@link ElementComponent}
   * - "gsplat" - see {@link GSplatComponent}
   * - "layoutchild" - see {@link LayoutChildComponent}
   * - "layoutgroup" - see {@link LayoutGroupComponent}
   * - "light" - see {@link LightComponent}
   * - "model" - see {@link ModelComponent}
   * - "particlesystem" - see {@link ParticleSystemComponent}
   * - "render" - see {@link RenderComponent}
   * - "rigidbody" - see {@link RigidBodyComponent}
   * - "screen" - see {@link ScreenComponent}
   * - "script" - see {@link ScriptComponent}
   * - "scrollbar" - see {@link ScrollbarComponent}
   * - "scrollview" - see {@link ScrollViewComponent}
   * - "sound" - see {@link SoundComponent}
   * - "sprite" - see {@link SpriteComponent}
   *
   * @param {object} [data] - The initialization data for the specific component type. Refer to
   * each specific component's API reference page for details on valid values for this parameter.
   * @returns {import('./components/component.js').Component|null} The new Component that was
   * attached to the entity or null if there was an error.
   * @example
   * const entity = new pc.Entity();
   *
   * // Add a light component with default properties
   * entity.addComponent("light");
   *
   * // Add a camera component with some specified properties
   * entity.addComponent("camera", {
   *     fov: 45,
   *     clearColor: new pc.Color(1, 0, 0)
   * });
   */
  addComponent(type, data) {
    const system = this._app.systems[type];
    if (!system) {
      Debug.error(`addComponent: System '${type}' doesn't exist`);
      return null;
    }
    if (this.c[type]) {
      Debug.warn(`addComponent: Entity already has '${type}' component`);
      return null;
    }
    return system.addComponent(this, data);
  }

  /**
   * Remove a component from the Entity.
   *
   * @param {string} type - The name of the Component type.
   * @example
   * const entity = new pc.Entity();
   * entity.addComponent("light"); // add new light component
   *
   * entity.removeComponent("light"); // remove light component
   */
  removeComponent(type) {
    const system = this._app.systems[type];
    if (!system) {
      Debug.error(`addComponent: System '${type}' doesn't exist`);
      return;
    }
    if (!this.c[type]) {
      Debug.warn(`removeComponent: Entity doesn't have '${type}' component`);
      return;
    }
    system.removeComponent(this);
  }

  /**
   * Search the entity and all of its descendants for the first component of specified type.
   *
   * @param {string} type - The name of the component type to retrieve.
   * @returns {import('./components/component.js').Component} A component of specified type, if
   * the entity or any of its descendants has one. Returns undefined otherwise.
   * @example
   * // Get the first found light component in the hierarchy tree that starts with this entity
   * const light = entity.findComponent("light");
   */
  findComponent(type) {
    const entity = this.findOne(function (node) {
      return node.c && node.c[type];
    });
    return entity && entity.c[type];
  }

  /**
   * Search the entity and all of its descendants for all components of specified type.
   *
   * @param {string} type - The name of the component type to retrieve.
   * @returns {import('./components/component.js').Component[]} All components of specified type
   * in the entity or any of its descendants. Returns empty array if none found.
   * @example
   * // Get all light components in the hierarchy tree that starts with this entity
   * const lights = entity.findComponents("light");
   */
  findComponents(type) {
    const entities = this.find(function (node) {
      return node.c && node.c[type];
    });
    return entities.map(function (entity) {
      return entity.c[type];
    });
  }

  /**
   * Search the entity and all of its descendants for the first script instance of specified type.
   *
   * @param {string|Class<import('./script/script-type.js').ScriptType>} nameOrType - The name or type of {@link ScriptType}.
   * @returns {import('./script/script-type.js').ScriptType|undefined} A script instance of specified type, if the entity or any of its descendants
   * has one. Returns undefined otherwise.
   * @example
   * // Get the first found "playerController" instance in the hierarchy tree that starts with this entity
   * var controller = entity.findScript("playerController");
   */
  findScript(nameOrType) {
    const entity = this.findOne(node => {
      var _node$c;
      return (_node$c = node.c) == null || (_node$c = _node$c.script) == null ? void 0 : _node$c.has(nameOrType);
    });
    return entity == null ? void 0 : entity.c.script.get(nameOrType);
  }

  /**
   * Search the entity and all of its descendants for all script instances of specified type.
   *
   * @param {string|Class<import('./script/script-type.js').ScriptType>} nameOrType - The name or type of {@link ScriptType}.
   * @returns {import('./script/script-type.js').ScriptType[]} All script instances of specified type in the entity or any of its
   * descendants. Returns empty array if none found.
   * @example
   * // Get all "playerController" instances in the hierarchy tree that starts with this entity
   * var controllers = entity.findScripts("playerController");
   */
  findScripts(nameOrType) {
    const entities = this.find(node => {
      var _node$c2;
      return (_node$c2 = node.c) == null || (_node$c2 = _node$c2.script) == null ? void 0 : _node$c2.has(nameOrType);
    });
    return entities.map(entity => entity.c.script.get(nameOrType));
  }

  /**
   * Get the GUID value for this Entity.
   *
   * @returns {string} The GUID of the Entity.
   * @ignore
   */
  getGuid() {
    // if the guid hasn't been set yet then set it now before returning it
    if (!this._guid) {
      this.setGuid(guid.create());
    }
    return this._guid;
  }

  /**
   * Set the GUID value for this Entity. Note that it is unlikely that you should need to change
   * the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
   *
   * @param {string} guid - The GUID to assign to the Entity.
   * @ignore
   */
  setGuid(guid) {
    // remove current guid from entityIndex
    const index = this._app._entityIndex;
    if (this._guid) {
      delete index[this._guid];
    }

    // add new guid to entityIndex
    this._guid = guid;
    index[this._guid] = this;
  }

  /**
   * @param {GraphNode} node - The node to update.
   * @param {boolean} enabled - Enable or disable the node.
   * @private
   */
  _notifyHierarchyStateChanged(node, enabled) {
    let enableFirst = false;
    if (node === this && _enableList.length === 0) enableFirst = true;
    node._beingEnabled = true;
    node._onHierarchyStateChanged(enabled);
    if (node._onHierarchyStatePostChanged) _enableList.push(node);
    const c = node._children;
    for (let i = 0, len = c.length; i < len; i++) {
      if (c[i]._enabled) this._notifyHierarchyStateChanged(c[i], enabled);
    }
    node._beingEnabled = false;
    if (enableFirst) {
      // do not cache the length here, as enableList may be added to during loop
      for (let i = 0; i < _enableList.length; i++) {
        _enableList[i]._onHierarchyStatePostChanged();
      }
      _enableList.length = 0;
    }
  }

  /**
   * @param {boolean} enabled - Enable or disable the node.
   * @private
   */
  _onHierarchyStateChanged(enabled) {
    super._onHierarchyStateChanged(enabled);

    // enable / disable all the components
    const components = this.c;
    for (const type in components) {
      if (components.hasOwnProperty(type)) {
        const component = components[type];
        if (component.enabled) {
          if (enabled) {
            component.onEnable();
          } else {
            component.onDisable();
          }
        }
      }
    }
  }

  /** @private */
  _onHierarchyStatePostChanged() {
    // post enable all the components
    const components = this.c;
    for (const type in components) {
      if (components.hasOwnProperty(type)) components[type].onPostStateChange();
    }
  }

  /**
   * Find a descendant of this entity with the GUID.
   *
   * @param {string} guid - The GUID to search for.
   * @returns {Entity|null} The entity with the matching GUID or null if no entity is found.
   */
  findByGuid(guid) {
    if (this._guid === guid) return this;
    const e = this._app._entityIndex[guid];
    if (e && (e === this || e.isDescendantOf(this))) {
      return e;
    }
    return null;
  }

  /**
   * Remove all components from the Entity and detach it from the Entity hierarchy. Then
   * recursively destroy all ancestor Entities.
   *
   * @example
   * const firstChild = this.entity.children[0];
   * firstChild.destroy(); // delete child, all components and remove from hierarchy
   */
  destroy() {
    this._destroying = true;

    // Disable all enabled components first
    for (const name in this.c) {
      this.c[name].enabled = false;
    }

    // Remove all components
    for (const name in this.c) {
      this.c[name].system.removeComponent(this);
    }
    super.destroy();

    // remove from entity index
    if (this._guid) {
      delete this._app._entityIndex[this._guid];
    }
    this._destroying = false;
  }

  /**
   * Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components
   * and all descendants. Note, this Entity is not in the hierarchy and must be added manually.
   *
   * @returns {this} A new Entity which is a deep copy of the original.
   * @example
   * const e = this.entity.clone();
   *
   * // Add clone as a sibling to the original
   * this.entity.parent.addChild(e);
   */
  clone() {
    const duplicatedIdsMap = {};
    const clone = this._cloneRecursively(duplicatedIdsMap);
    duplicatedIdsMap[this.getGuid()] = clone;
    resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);
    return clone;
  }

  /**
   * @param {Object<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
   * entities.
   * @returns {this} A new Entity which is a deep copy of the original.
   * @private
   */
  _cloneRecursively(duplicatedIdsMap) {
    /** @type {this} */
    const clone = new this.constructor(undefined, this._app);
    super._cloneInternal(clone);
    for (const type in this.c) {
      const component = this.c[type];
      component.system.cloneComponent(this, clone);
    }
    for (let i = 0; i < this._children.length; i++) {
      const oldChild = this._children[i];
      if (oldChild instanceof Entity) {
        const newChild = oldChild._cloneRecursively(duplicatedIdsMap);
        clone.addChild(newChild);
        duplicatedIdsMap[oldChild.getGuid()] = newChild;
      }
    }
    return clone;
  }
}

// When an entity that has properties that contain references to other
// entities within its subtree is duplicated, the expectation of the
// user is likely that those properties will be updated to point to
// the corresponding entities within the newly-created duplicate subtree.
//
// To handle this, we need to search for properties that refer to entities
// within the old duplicated structure, find their newly-cloned partners
// within the new structure, and update the references accordingly. This
// function implements that requirement.
/**
 * Fired after the entity is destroyed.
 *
 * @event
 * @example
 * entity.on('destroy', (e) => {
 *     console.log(`Entity ${e.name} has been destroyed`);
 * });
 */
Entity.EVENT_DESTROY = 'destroy';
function resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
  if (oldEntity instanceof Entity) {
    const components = oldEntity.c;

    // Handle component properties
    for (const componentName in components) {
      const component = components[componentName];
      const entityProperties = component.system.getPropertiesOfType('entity');
      for (let i = 0, len = entityProperties.length; i < len; i++) {
        const propertyDescriptor = entityProperties[i];
        const propertyName = propertyDescriptor.name;
        const oldEntityReferenceId = component[propertyName];
        const entityIsWithinOldSubtree = !!oldSubtreeRoot.findByGuid(oldEntityReferenceId);
        if (entityIsWithinOldSubtree) {
          const newEntityReferenceId = duplicatedIdsMap[oldEntityReferenceId].getGuid();
          if (newEntityReferenceId) {
            newEntity.c[componentName][propertyName] = newEntityReferenceId;
          } else {
            Debug.warn('Could not find corresponding entity id when resolving duplicated entity references');
          }
        }
      }
    }

    // Handle entity script attributes
    if (components.script && !newEntity._app.useLegacyScriptAttributeCloning) {
      newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
    }

    // Handle entity render attributes
    if (components.render) {
      newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
    }

    // Handle entity anim attributes
    if (components.anim) {
      newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
    }

    // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`,
    // in order to correctly handle cases where a child has an entity reference
    // field that points to a parent or other ancestor that is still within the
    // duplicated subtree.
    const _old = oldEntity.children.filter(function (e) {
      return e instanceof Entity;
    });
    const _new = newEntity.children.filter(function (e) {
      return e instanceof Entity;
    });
    for (let i = 0, len = _old.length; i < len; i++) {
      resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, _old[i], _new[i], duplicatedIdsMap);
    }
  }
}

export { Entity };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXR5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2VudGl0eS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgZ3VpZCB9IGZyb20gJy4uL2NvcmUvZ3VpZC5qcyc7XG5cbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuXG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4vZ2xvYmFscy5qcyc7XG5cbi8qKlxuICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICogQGlnbm9yZVxuICovXG5jb25zdCBfZW5hYmxlTGlzdCA9IFtdO1xuXG4vKipcbiAqIFRoZSBFbnRpdHkgaXMgdGhlIGNvcmUgcHJpbWl0aXZlIG9mIGEgUGxheUNhbnZhcyBnYW1lLiBHZW5lcmFsbHkgc3BlYWtpbmcgYW4gb2JqZWN0IGluIHlvdXIgZ2FtZVxuICogd2lsbCBjb25zaXN0IG9mIGFuIHtAbGluayBFbnRpdHl9LCBhbmQgYSBzZXQgb2Yge0BsaW5rIENvbXBvbmVudH1zIHdoaWNoIGFyZSBtYW5hZ2VkIGJ5IHRoZWlyXG4gKiByZXNwZWN0aXZlIHtAbGluayBDb21wb25lbnRTeXN0ZW19cy4gT25lIG9mIHRob3NlIGNvbXBvbmVudHMgbWF5YmUgYSB7QGxpbmsgU2NyaXB0Q29tcG9uZW50fVxuICogd2hpY2ggYWxsb3dzIHlvdSB0byB3cml0ZSBjdXN0b20gY29kZSB0byBhdHRhY2ggdG8geW91ciBFbnRpdHkuXG4gKlxuICogVGhlIEVudGl0eSB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSBvYmplY3QgYW5kIGFsc28gcHJvdmlkZXMgYSB0cmFuc2Zvcm0gZm9yIHBvc2l0aW9uIGFuZFxuICogb3JpZW50YXRpb24gd2hpY2ggaXQgaW5oZXJpdHMgZnJvbSB7QGxpbmsgR3JhcGhOb2RlfSBzbyBjYW4gYmUgYWRkZWQgaW50byB0aGUgc2NlbmUgZ3JhcGguIFRoZVxuICogQ29tcG9uZW50IGFuZCBDb21wb25lbnRTeXN0ZW0gcHJvdmlkZSB0aGUgbG9naWMgdG8gZ2l2ZSBhbiBFbnRpdHkgYSBzcGVjaWZpYyB0eXBlIG9mIGJlaGF2aW9yLlxuICogZS5nLiB0aGUgYWJpbGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBwbGF5IGEgc291bmQuIENvbXBvbmVudHMgYXJlIHNwZWNpZmljIHRvIGFuIGluc3RhbmNlIG9mIGFuXG4gKiBFbnRpdHkgYW5kIGFyZSBhdHRhY2hlZCAoZS5nLiBgdGhpcy5lbnRpdHkubW9kZWxgKSBDb21wb25lbnRTeXN0ZW1zIGFsbG93IGFjY2VzcyB0byBhbGwgRW50aXRpZXNcbiAqIGFuZCBDb21wb25lbnRzIGFuZCBhcmUgYXR0YWNoZWQgdG8gdGhlIHtAbGluayBBcHBCYXNlfS5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhOb2RlXG4gKi9cbmNsYXNzIEVudGl0eSBleHRlbmRzIEdyYXBoTm9kZSB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgYWZ0ZXIgdGhlIGVudGl0eSBpcyBkZXN0cm95ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5vbignZGVzdHJveScsIChlKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBFbnRpdHkgJHtlLm5hbWV9IGhhcyBiZWVuIGRlc3Ryb3llZGApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9ERVNUUk9ZID0gJ2Rlc3Ryb3knO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEFuaW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW0vY29tcG9uZW50LmpzJykuQW5pbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYW5pbTtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW1hdGlvbi9jb21wb25lbnQuanMnKS5BbmltYXRpb25Db21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGFuaW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9hdWRpby1saXN0ZW5lci9jb21wb25lbnQuanMnKS5BdWRpb0xpc3RlbmVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBhdWRpb2xpc3RlbmVyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvYnV0dG9uL2NvbXBvbmVudC5qcycpLkJ1dHRvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYnV0dG9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY2FtZXJhO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY29sbGlzaW9uL2NvbXBvbmVudC5qcycpLkNvbGxpc2lvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY29sbGlzaW9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgZWxlbWVudDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBHU3BsYXRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2dzcGxhdC9jb21wb25lbnQuanMnKS5HU3BsYXRDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGdzcGxhdDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWNoaWxkL2NvbXBvbmVudC5qcycpLkxheW91dENoaWxkQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRjaGlsZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWdyb3VwL2NvbXBvbmVudC5qcycpLkxheW91dEdyb3VwQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRncm91cDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMaWdodENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGxpZ2h0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIE1vZGVsQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9tb2RlbC9jb21wb25lbnQuanMnKS5Nb2RlbENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbW9kZWw7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3BhcnRpY2xlLXN5c3RlbS9jb21wb25lbnQuanMnKS5QYXJ0aWNsZVN5c3RlbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcGFydGljbGVzeXN0ZW07XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmVuZGVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJykuUmVuZGVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICByZW5kZXI7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcycpLlJpZ2lkQm9keUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcmlnaWRib2R5O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyZWVuL2NvbXBvbmVudC5qcycpLlNjcmVlbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyZWVuO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmlwdENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcycpLlNjcmlwdENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyaXB0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbGJhckNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2Nyb2xsYmFyL2NvbXBvbmVudC5qcycpLlNjcm9sbGJhckNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2Nyb2xsYmFyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Njcm9sbC12aWV3L2NvbXBvbmVudC5qcycpLlNjcm9sbFZpZXdDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjcm9sbHZpZXc7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgU291bmRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3NvdW5kL2NvbXBvbmVudC5qcycpLlNvdW5kQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzb3VuZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBTcHJpdGVDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Nwcml0ZS9jb21wb25lbnQuanMnKS5TcHJpdGVDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNwcml0ZTtcblxuICAgIC8qKlxuICAgICAqIENvbXBvbmVudCBzdG9yYWdlLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIGltcG9ydCgnLi9jb21wb25lbnRzL2NvbXBvbmVudC5qcycpLkNvbXBvbmVudD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FwcDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkgY29tcG9uZW50IHN5c3RlbXMgdG8gc3BlZWQgdXAgZGVzdHJ1Y3Rpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2Rlc3Ryb3lpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ndWlkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZSBlbnRpdGllcyBvZiBhIHRlbXBsYXRlIHJvb3QgaW5zdGFuY2UsIHdoaWNoIGhhdmUgaXQgc2V0IHRvXG4gICAgICogdHJ1ZSwgYW5kIHRoZSBjbG9uZWQgaW5zdGFuY2UgZW50aXRpZXMgKHNldCB0byBmYWxzZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3RlbXBsYXRlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGVudGl0eSwgZGVmYXVsdCBpcyBcIlVudGl0bGVkXCIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBbYXBwXSAtIFRoZSBhcHBsaWNhdGlvbiB0aGUgZW50aXR5IGJlbG9uZ3MgdG8sXG4gICAgICogZGVmYXVsdCBpcyB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBhIENvbXBvbmVudCB0byB0aGUgRW50aXR5XG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudChcImNhbWVyYVwiLCB7XG4gICAgICogICAgIGZvdjogNDUsXG4gICAgICogICAgIG5lYXJDbGlwOiAxLFxuICAgICAqICAgICBmYXJDbGlwOiAxMDAwMFxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQWRkIHRoZSBFbnRpdHkgaW50byB0aGUgc2NlbmUgZ3JhcGhcbiAgICAgKiBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqXG4gICAgICogLy8gTW92ZSB0aGUgZW50aXR5XG4gICAgICogZW50aXR5LnRyYW5zbGF0ZSgxMCwgMCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBPciB0cmFuc2xhdGUgaXQgYnkgc2V0dGluZyBpdHMgcG9zaXRpb24gZGlyZWN0bHlcbiAgICAgKiBjb25zdCBwID0gZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogZW50aXR5LnNldFBvc2l0aW9uKHAueCArIDEwLCBwLnksIHAueik7XG4gICAgICpcbiAgICAgKiAvLyBDaGFuZ2UgdGhlIGVudGl0eSdzIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlXG4gICAgICogY29uc3QgZSA9IGVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoZS54LCBlLnkgKyA5MCwgZS56KTtcbiAgICAgKlxuICAgICAqIC8vIE9yIHVzZSByb3RhdGVMb2NhbFxuICAgICAqIGVudGl0eS5yb3RhdGVMb2NhbCgwLCA5MCwgMCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSwgYXBwID0gZ2V0QXBwbGljYXRpb24oKSkge1xuICAgICAgICBzdXBlcihuYW1lKTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoYXBwLCAnQ291bGQgbm90IGZpbmQgY3VycmVudCBhcHBsaWNhdGlvbicpO1xuICAgICAgICB0aGlzLl9hcHAgPSBhcHA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGNvbXBvbmVudCBhbmQgYWRkIGl0IHRvIHRoZSBlbnRpdHkuIFVzZSB0aGlzIHRvIGFkZCBmdW5jdGlvbmFsaXR5IHRvIHRoZSBlbnRpdHlcbiAgICAgKiBsaWtlIHJlbmRlcmluZyBhIG1vZGVsLCBwbGF5aW5nIHNvdW5kcyBhbmQgc28gb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBjb21wb25lbnQgdG8gYWRkLiBWYWxpZCBzdHJpbmdzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gXCJhbmltXCIgLSBzZWUge0BsaW5rIEFuaW1Db21wb25lbnR9XG4gICAgICogLSBcImFuaW1hdGlvblwiIC0gc2VlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9XG4gICAgICogLSBcImF1ZGlvbGlzdGVuZXJcIiAtIHNlZSB7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudH1cbiAgICAgKiAtIFwiYnV0dG9uXCIgLSBzZWUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiY2FtZXJhXCIgLSBzZWUge0BsaW5rIENhbWVyYUNvbXBvbmVudH1cbiAgICAgKiAtIFwiY29sbGlzaW9uXCIgLSBzZWUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiZWxlbWVudFwiIC0gc2VlIHtAbGluayBFbGVtZW50Q29tcG9uZW50fVxuICAgICAqIC0gXCJnc3BsYXRcIiAtIHNlZSB7QGxpbmsgR1NwbGF0Q29tcG9uZW50fVxuICAgICAqIC0gXCJsYXlvdXRjaGlsZFwiIC0gc2VlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH1cbiAgICAgKiAtIFwibGF5b3V0Z3JvdXBcIiAtIHNlZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9XG4gICAgICogLSBcImxpZ2h0XCIgLSBzZWUge0BsaW5rIExpZ2h0Q29tcG9uZW50fVxuICAgICAqIC0gXCJtb2RlbFwiIC0gc2VlIHtAbGluayBNb2RlbENvbXBvbmVudH1cbiAgICAgKiAtIFwicGFydGljbGVzeXN0ZW1cIiAtIHNlZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9XG4gICAgICogLSBcInJlbmRlclwiIC0gc2VlIHtAbGluayBSZW5kZXJDb21wb25lbnR9XG4gICAgICogLSBcInJpZ2lkYm9keVwiIC0gc2VlIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnR9XG4gICAgICogLSBcInNjcmVlblwiIC0gc2VlIHtAbGluayBTY3JlZW5Db21wb25lbnR9XG4gICAgICogLSBcInNjcmlwdFwiIC0gc2VlIHtAbGluayBTY3JpcHRDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbGJhclwiIC0gc2VlIHtAbGluayBTY3JvbGxiYXJDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbHZpZXdcIiAtIHNlZSB7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudH1cbiAgICAgKiAtIFwic291bmRcIiAtIHNlZSB7QGxpbmsgU291bmRDb21wb25lbnR9XG4gICAgICogLSBcInNwcml0ZVwiIC0gc2VlIHtAbGluayBTcHJpdGVDb21wb25lbnR9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2RhdGFdIC0gVGhlIGluaXRpYWxpemF0aW9uIGRhdGEgZm9yIHRoZSBzcGVjaWZpYyBjb21wb25lbnQgdHlwZS4gUmVmZXIgdG9cbiAgICAgKiBlYWNoIHNwZWNpZmljIGNvbXBvbmVudCdzIEFQSSByZWZlcmVuY2UgcGFnZSBmb3IgZGV0YWlscyBvbiB2YWxpZCB2YWx1ZXMgZm9yIHRoaXMgcGFyYW1ldGVyLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnR8bnVsbH0gVGhlIG5ldyBDb21wb25lbnQgdGhhdCB3YXNcbiAgICAgKiBhdHRhY2hlZCB0byB0aGUgZW50aXR5IG9yIG51bGwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICAgICAqXG4gICAgICogLy8gQWRkIGEgbGlnaHQgY29tcG9uZW50IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzXG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudChcImxpZ2h0XCIpO1xuICAgICAqXG4gICAgICogLy8gQWRkIGEgY2FtZXJhIGNvbXBvbmVudCB3aXRoIHNvbWUgc3BlY2lmaWVkIHByb3BlcnRpZXNcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwiY2FtZXJhXCIsIHtcbiAgICAgKiAgICAgZm92OiA0NSxcbiAgICAgKiAgICAgY2xlYXJDb2xvcjogbmV3IHBjLkNvbG9yKDEsIDAsIDApXG4gICAgICogfSk7XG4gICAgICovXG4gICAgYWRkQ29tcG9uZW50KHR5cGUsIGRhdGEpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5fYXBwLnN5c3RlbXNbdHlwZV07XG4gICAgICAgIGlmICghc3lzdGVtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgYWRkQ29tcG9uZW50OiBTeXN0ZW0gJyR7dHlwZX0nIGRvZXNuJ3QgZXhpc3RgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNbdHlwZV0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGFkZENvbXBvbmVudDogRW50aXR5IGFscmVhZHkgaGFzICcke3R5cGV9JyBjb21wb25lbnRgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzeXN0ZW0uYWRkQ29tcG9uZW50KHRoaXMsIGRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIHRoZSBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBDb21wb25lbnQgdHlwZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwibGlnaHRcIik7IC8vIGFkZCBuZXcgbGlnaHQgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBlbnRpdHkucmVtb3ZlQ29tcG9uZW50KFwibGlnaHRcIik7IC8vIHJlbW92ZSBsaWdodCBjb21wb25lbnRcbiAgICAgKi9cbiAgICByZW1vdmVDb21wb25lbnQodHlwZSkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLl9hcHAuc3lzdGVtc1t0eXBlXTtcbiAgICAgICAgaWYgKCFzeXN0ZW0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBhZGRDb21wb25lbnQ6IFN5c3RlbSAnJHt0eXBlfScgZG9lc24ndCBleGlzdGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5jW3R5cGVdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGByZW1vdmVDb21wb25lbnQ6IEVudGl0eSBkb2Vzbid0IGhhdmUgJyR7dHlwZX0nIGNvbXBvbmVudGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN5c3RlbS5yZW1vdmVDb21wb25lbnQodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBlbnRpdHkgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBmaXJzdCBjb21wb25lbnQgb2Ygc3BlY2lmaWVkIHR5cGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBjb21wb25lbnQgdHlwZSB0byByZXRyaWV2ZS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY29tcG9uZW50LmpzJykuQ29tcG9uZW50fSBBIGNvbXBvbmVudCBvZiBzcGVjaWZpZWQgdHlwZSwgaWZcbiAgICAgKiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgZGVzY2VuZGFudHMgaGFzIG9uZS4gUmV0dXJucyB1bmRlZmluZWQgb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gR2V0IHRoZSBmaXJzdCBmb3VuZCBsaWdodCBjb21wb25lbnQgaW4gdGhlIGhpZXJhcmNoeSB0cmVlIHRoYXQgc3RhcnRzIHdpdGggdGhpcyBlbnRpdHlcbiAgICAgKiBjb25zdCBsaWdodCA9IGVudGl0eS5maW5kQ29tcG9uZW50KFwibGlnaHRcIik7XG4gICAgICovXG4gICAgZmluZENvbXBvbmVudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZmluZE9uZShmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGUuYyAmJiBub2RlLmNbdHlwZV07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW50aXR5ICYmIGVudGl0eS5jW3R5cGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZW50aXR5IGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciBhbGwgY29tcG9uZW50cyBvZiBzcGVjaWZpZWQgdHlwZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudCB0eXBlIHRvIHJldHJpZXZlLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnRbXX0gQWxsIGNvbXBvbmVudHMgb2Ygc3BlY2lmaWVkIHR5cGVcbiAgICAgKiBpbiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgZGVzY2VuZGFudHMuIFJldHVybnMgZW1wdHkgYXJyYXkgaWYgbm9uZSBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCBhbGwgbGlnaHQgY29tcG9uZW50cyBpbiB0aGUgaGllcmFyY2h5IHRyZWUgdGhhdCBzdGFydHMgd2l0aCB0aGlzIGVudGl0eVxuICAgICAqIGNvbnN0IGxpZ2h0cyA9IGVudGl0eS5maW5kQ29tcG9uZW50cyhcImxpZ2h0XCIpO1xuICAgICAqL1xuICAgIGZpbmRDb21wb25lbnRzKHR5cGUpIHtcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSB0aGlzLmZpbmQoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBub2RlLmMgJiYgbm9kZS5jW3R5cGVdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVudGl0aWVzLm1hcChmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gZW50aXR5LmNbdHlwZV07XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZW50aXR5IGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgZmlyc3Qgc2NyaXB0IGluc3RhbmNlIG9mIHNwZWNpZmllZCB0eXBlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8aW1wb3J0KCcuL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGU+fSBuYW1lT3JUeXBlIC0gVGhlIG5hbWUgb3IgdHlwZSBvZiB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfHVuZGVmaW5lZH0gQSBzY3JpcHQgaW5zdGFuY2Ugb2Ygc3BlY2lmaWVkIHR5cGUsIGlmIHRoZSBlbnRpdHkgb3IgYW55IG9mIGl0cyBkZXNjZW5kYW50c1xuICAgICAqIGhhcyBvbmUuIFJldHVybnMgdW5kZWZpbmVkIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgZmlyc3QgZm91bmQgXCJwbGF5ZXJDb250cm9sbGVyXCIgaW5zdGFuY2UgaW4gdGhlIGhpZXJhcmNoeSB0cmVlIHRoYXQgc3RhcnRzIHdpdGggdGhpcyBlbnRpdHlcbiAgICAgKiB2YXIgY29udHJvbGxlciA9IGVudGl0eS5maW5kU2NyaXB0KFwicGxheWVyQ29udHJvbGxlclwiKTtcbiAgICAgKi9cbiAgICBmaW5kU2NyaXB0KG5hbWVPclR5cGUpIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5maW5kT25lKG5vZGUgPT4gbm9kZS5jPy5zY3JpcHQ/LmhhcyhuYW1lT3JUeXBlKSk7XG4gICAgICAgIHJldHVybiBlbnRpdHk/LmMuc2NyaXB0LmdldChuYW1lT3JUeXBlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGVudGl0eSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgYWxsIHNjcmlwdCBpbnN0YW5jZXMgb2Ygc3BlY2lmaWVkIHR5cGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxpbXBvcnQoJy4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGVbXX0gQWxsIHNjcmlwdCBpbnN0YW5jZXMgb2Ygc3BlY2lmaWVkIHR5cGUgaW4gdGhlIGVudGl0eSBvciBhbnkgb2YgaXRzXG4gICAgICogZGVzY2VuZGFudHMuIFJldHVybnMgZW1wdHkgYXJyYXkgaWYgbm9uZSBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCBhbGwgXCJwbGF5ZXJDb250cm9sbGVyXCIgaW5zdGFuY2VzIGluIHRoZSBoaWVyYXJjaHkgdHJlZSB0aGF0IHN0YXJ0cyB3aXRoIHRoaXMgZW50aXR5XG4gICAgICogdmFyIGNvbnRyb2xsZXJzID0gZW50aXR5LmZpbmRTY3JpcHRzKFwicGxheWVyQ29udHJvbGxlclwiKTtcbiAgICAgKi9cbiAgICBmaW5kU2NyaXB0cyhuYW1lT3JUeXBlKSB7XG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gdGhpcy5maW5kKG5vZGUgPT4gbm9kZS5jPy5zY3JpcHQ/LmhhcyhuYW1lT3JUeXBlKSk7XG4gICAgICAgIHJldHVybiBlbnRpdGllcy5tYXAoZW50aXR5ID0+IGVudGl0eS5jLnNjcmlwdC5nZXQobmFtZU9yVHlwZSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgR1VJRCB2YWx1ZSBmb3IgdGhpcyBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgR1VJRCBvZiB0aGUgRW50aXR5LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRHdWlkKCkge1xuICAgICAgICAvLyBpZiB0aGUgZ3VpZCBoYXNuJ3QgYmVlbiBzZXQgeWV0IHRoZW4gc2V0IGl0IG5vdyBiZWZvcmUgcmV0dXJuaW5nIGl0XG4gICAgICAgIGlmICghdGhpcy5fZ3VpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRHdWlkKGd1aWQuY3JlYXRlKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2d1aWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBHVUlEIHZhbHVlIGZvciB0aGlzIEVudGl0eS4gTm90ZSB0aGF0IGl0IGlzIHVubGlrZWx5IHRoYXQgeW91IHNob3VsZCBuZWVkIHRvIGNoYW5nZVxuICAgICAqIHRoZSBHVUlEIHZhbHVlIG9mIGFuIEVudGl0eSBhdCBydW4tdGltZS4gRG9pbmcgc28gd2lsbCBjb3JydXB0IHRoZSBncmFwaCB0aGlzIEVudGl0eSBpcyBpbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkIC0gVGhlIEdVSUQgdG8gYXNzaWduIHRvIHRoZSBFbnRpdHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEd1aWQoZ3VpZCkge1xuICAgICAgICAvLyByZW1vdmUgY3VycmVudCBndWlkIGZyb20gZW50aXR5SW5kZXhcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9hcHAuX2VudGl0eUluZGV4O1xuICAgICAgICBpZiAodGhpcy5fZ3VpZCkge1xuICAgICAgICAgICAgZGVsZXRlIGluZGV4W3RoaXMuX2d1aWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIG5ldyBndWlkIHRvIGVudGl0eUluZGV4XG4gICAgICAgIHRoaXMuX2d1aWQgPSBndWlkO1xuICAgICAgICBpbmRleFt0aGlzLl9ndWlkXSA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gRW5hYmxlIG9yIGRpc2FibGUgdGhlIG5vZGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKG5vZGUsIGVuYWJsZWQpIHtcbiAgICAgICAgbGV0IGVuYWJsZUZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmIChub2RlID09PSB0aGlzICYmIF9lbmFibGVMaXN0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgIGVuYWJsZUZpcnN0ID0gdHJ1ZTtcblxuICAgICAgICBub2RlLl9iZWluZ0VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIG5vZGUuX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpO1xuXG4gICAgICAgIGlmIChub2RlLl9vbkhpZXJhcmNoeVN0YXRlUG9zdENoYW5nZWQpXG4gICAgICAgICAgICBfZW5hYmxlTGlzdC5wdXNoKG5vZGUpO1xuXG4gICAgICAgIGNvbnN0IGMgPSBub2RlLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLl9lbmFibGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjW2ldLCBlbmFibGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChlbmFibGVGaXJzdCkge1xuICAgICAgICAgICAgLy8gZG8gbm90IGNhY2hlIHRoZSBsZW5ndGggaGVyZSwgYXMgZW5hYmxlTGlzdCBtYXkgYmUgYWRkZWQgdG8gZHVyaW5nIGxvb3BcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2VuYWJsZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBfZW5hYmxlTGlzdFtpXS5fb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9lbmFibGVMaXN0Lmxlbmd0aCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBFbmFibGUgb3IgZGlzYWJsZSB0aGUgbm9kZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKSB7XG4gICAgICAgIHN1cGVyLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICAvLyBlbmFibGUgLyBkaXNhYmxlIGFsbCB0aGUgY29tcG9uZW50c1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gdGhpcy5jO1xuICAgICAgICBmb3IgKGNvbnN0IHR5cGUgaW4gY29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBjb21wb25lbnRzW3R5cGVdO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm9uRW5hYmxlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQub25EaXNhYmxlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkKCkge1xuICAgICAgICAvLyBwb3N0IGVuYWJsZSBhbGwgdGhlIGNvbXBvbmVudHNcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHRoaXMuYztcbiAgICAgICAgZm9yIChjb25zdCB0eXBlIGluIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmhhc093blByb3BlcnR5KHR5cGUpKVxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHNbdHlwZV0ub25Qb3N0U3RhdGVDaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBkZXNjZW5kYW50IG9mIHRoaXMgZW50aXR5IHdpdGggdGhlIEdVSUQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCAtIFRoZSBHVUlEIHRvIHNlYXJjaCBmb3IuXG4gICAgICogQHJldHVybnMge0VudGl0eXxudWxsfSBUaGUgZW50aXR5IHdpdGggdGhlIG1hdGNoaW5nIEdVSUQgb3IgbnVsbCBpZiBubyBlbnRpdHkgaXMgZm91bmQuXG4gICAgICovXG4gICAgZmluZEJ5R3VpZChndWlkKSB7XG4gICAgICAgIGlmICh0aGlzLl9ndWlkID09PSBndWlkKSByZXR1cm4gdGhpcztcblxuICAgICAgICBjb25zdCBlID0gdGhpcy5fYXBwLl9lbnRpdHlJbmRleFtndWlkXTtcbiAgICAgICAgaWYgKGUgJiYgKGUgPT09IHRoaXMgfHwgZS5pc0Rlc2NlbmRhbnRPZih0aGlzKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGFsbCBjb21wb25lbnRzIGZyb20gdGhlIEVudGl0eSBhbmQgZGV0YWNoIGl0IGZyb20gdGhlIEVudGl0eSBoaWVyYXJjaHkuIFRoZW5cbiAgICAgKiByZWN1cnNpdmVseSBkZXN0cm95IGFsbCBhbmNlc3RvciBFbnRpdGllcy5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZmlyc3RDaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIGZpcnN0Q2hpbGQuZGVzdHJveSgpOyAvLyBkZWxldGUgY2hpbGQsIGFsbCBjb21wb25lbnRzIGFuZCByZW1vdmUgZnJvbSBoaWVyYXJjaHlcbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9kZXN0cm95aW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBlbmFibGVkIGNvbXBvbmVudHMgZmlyc3RcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuYykge1xuICAgICAgICAgICAgdGhpcy5jW25hbWVdLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBhbGwgY29tcG9uZW50c1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5jKSB7XG4gICAgICAgICAgICB0aGlzLmNbbmFtZV0uc3lzdGVtLnJlbW92ZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICAvLyByZW1vdmUgZnJvbSBlbnRpdHkgaW5kZXhcbiAgICAgICAgaWYgKHRoaXMuX2d1aWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hcHAuX2VudGl0eUluZGV4W3RoaXMuX2d1aWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVzdHJveWluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGRlZXAgY29weSBvZiB0aGUgRW50aXR5LiBEdXBsaWNhdGUgdGhlIGZ1bGwgRW50aXR5IGhpZXJhcmNoeSwgd2l0aCBhbGwgQ29tcG9uZW50c1xuICAgICAqIGFuZCBhbGwgZGVzY2VuZGFudHMuIE5vdGUsIHRoaXMgRW50aXR5IGlzIG5vdCBpbiB0aGUgaGllcmFyY2h5IGFuZCBtdXN0IGJlIGFkZGVkIG1hbnVhbGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgbmV3IEVudGl0eSB3aGljaCBpcyBhIGRlZXAgY29weSBvZiB0aGUgb3JpZ2luYWwuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlID0gdGhpcy5lbnRpdHkuY2xvbmUoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBjbG9uZSBhcyBhIHNpYmxpbmcgdG8gdGhlIG9yaWdpbmFsXG4gICAgICogdGhpcy5lbnRpdHkucGFyZW50LmFkZENoaWxkKGUpO1xuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBkdXBsaWNhdGVkSWRzTWFwID0ge307XG4gICAgICAgIGNvbnN0IGNsb25lID0gdGhpcy5fY2xvbmVSZWN1cnNpdmVseShkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgZHVwbGljYXRlZElkc01hcFt0aGlzLmdldEd1aWQoKV0gPSBjbG9uZTtcblxuICAgICAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXModGhpcywgdGhpcywgY2xvbmUsIGR1cGxpY2F0ZWRJZHNNYXApO1xuXG4gICAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge09iamVjdDxzdHJpbmcsIEVudGl0eT59IGR1cGxpY2F0ZWRJZHNNYXAgLSBBIG1hcCBvZiBvcmlnaW5hbCBlbnRpdHkgR1VJRHMgdG8gY2xvbmVkXG4gICAgICogZW50aXRpZXMuXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgbmV3IEVudGl0eSB3aGljaCBpcyBhIGRlZXAgY29weSBvZiB0aGUgb3JpZ2luYWwuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvbmVSZWN1cnNpdmVseShkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih1bmRlZmluZWQsIHRoaXMuX2FwcCk7XG4gICAgICAgIHN1cGVyLl9jbG9uZUludGVybmFsKGNsb25lKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHR5cGUgaW4gdGhpcy5jKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSB0aGlzLmNbdHlwZV07XG4gICAgICAgICAgICBjb21wb25lbnQuc3lzdGVtLmNsb25lQ29tcG9uZW50KHRoaXMsIGNsb25lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9sZENoaWxkID0gdGhpcy5fY2hpbGRyZW5baV07XG4gICAgICAgICAgICBpZiAob2xkQ2hpbGQgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDaGlsZCA9IG9sZENoaWxkLl9jbG9uZVJlY3Vyc2l2ZWx5KGR1cGxpY2F0ZWRJZHNNYXApO1xuICAgICAgICAgICAgICAgIGNsb25lLmFkZENoaWxkKG5ld0NoaWxkKTtcbiAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwW29sZENoaWxkLmdldEd1aWQoKV0gPSBuZXdDaGlsZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9XG59XG5cbi8vIFdoZW4gYW4gZW50aXR5IHRoYXQgaGFzIHByb3BlcnRpZXMgdGhhdCBjb250YWluIHJlZmVyZW5jZXMgdG8gb3RoZXJcbi8vIGVudGl0aWVzIHdpdGhpbiBpdHMgc3VidHJlZSBpcyBkdXBsaWNhdGVkLCB0aGUgZXhwZWN0YXRpb24gb2YgdGhlXG4vLyB1c2VyIGlzIGxpa2VseSB0aGF0IHRob3NlIHByb3BlcnRpZXMgd2lsbCBiZSB1cGRhdGVkIHRvIHBvaW50IHRvXG4vLyB0aGUgY29ycmVzcG9uZGluZyBlbnRpdGllcyB3aXRoaW4gdGhlIG5ld2x5LWNyZWF0ZWQgZHVwbGljYXRlIHN1YnRyZWUuXG4vL1xuLy8gVG8gaGFuZGxlIHRoaXMsIHdlIG5lZWQgdG8gc2VhcmNoIGZvciBwcm9wZXJ0aWVzIHRoYXQgcmVmZXIgdG8gZW50aXRpZXNcbi8vIHdpdGhpbiB0aGUgb2xkIGR1cGxpY2F0ZWQgc3RydWN0dXJlLCBmaW5kIHRoZWlyIG5ld2x5LWNsb25lZCBwYXJ0bmVyc1xuLy8gd2l0aGluIHRoZSBuZXcgc3RydWN0dXJlLCBhbmQgdXBkYXRlIHRoZSByZWZlcmVuY2VzIGFjY29yZGluZ2x5LiBUaGlzXG4vLyBmdW5jdGlvbiBpbXBsZW1lbnRzIHRoYXQgcmVxdWlyZW1lbnQuXG5mdW5jdGlvbiByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkU3VidHJlZVJvb3QsIG9sZEVudGl0eSwgbmV3RW50aXR5LCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgaWYgKG9sZEVudGl0eSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gb2xkRW50aXR5LmM7XG5cbiAgICAgICAgLy8gSGFuZGxlIGNvbXBvbmVudCBwcm9wZXJ0aWVzXG4gICAgICAgIGZvciAoY29uc3QgY29tcG9uZW50TmFtZSBpbiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBjb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgICAgICAgICAgY29uc3QgZW50aXR5UHJvcGVydGllcyA9IGNvbXBvbmVudC5zeXN0ZW0uZ2V0UHJvcGVydGllc09mVHlwZSgnZW50aXR5Jyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBlbnRpdHlQcm9wZXJ0aWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHlEZXNjcmlwdG9yID0gZW50aXR5UHJvcGVydGllc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eURlc2NyaXB0b3IubmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBvbGRFbnRpdHlSZWZlcmVuY2VJZCA9IGNvbXBvbmVudFtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUlzV2l0aGluT2xkU3VidHJlZSA9ICEhb2xkU3VidHJlZVJvb3QuZmluZEJ5R3VpZChvbGRFbnRpdHlSZWZlcmVuY2VJZCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5SXNXaXRoaW5PbGRTdWJ0cmVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld0VudGl0eVJlZmVyZW5jZUlkID0gZHVwbGljYXRlZElkc01hcFtvbGRFbnRpdHlSZWZlcmVuY2VJZF0uZ2V0R3VpZCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdFbnRpdHlSZWZlcmVuY2VJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3RW50aXR5LmNbY29tcG9uZW50TmFtZV1bcHJvcGVydHlOYW1lXSA9IG5ld0VudGl0eVJlZmVyZW5jZUlkO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybignQ291bGQgbm90IGZpbmQgY29ycmVzcG9uZGluZyBlbnRpdHkgaWQgd2hlbiByZXNvbHZpbmcgZHVwbGljYXRlZCBlbnRpdHkgcmVmZXJlbmNlcycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIGVudGl0eSBzY3JpcHQgYXR0cmlidXRlc1xuICAgICAgICBpZiAoY29tcG9uZW50cy5zY3JpcHQgJiYgIW5ld0VudGl0eS5fYXBwLnVzZUxlZ2FjeVNjcmlwdEF0dHJpYnV0ZUNsb25pbmcpIHtcbiAgICAgICAgICAgIG5ld0VudGl0eS5zY3JpcHQucmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKGNvbXBvbmVudHMuc2NyaXB0LCBkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSBlbnRpdHkgcmVuZGVyIGF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudHMucmVuZGVyKSB7XG4gICAgICAgICAgICBuZXdFbnRpdHkucmVuZGVyLnJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhjb21wb25lbnRzLnJlbmRlciwgZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgZW50aXR5IGFuaW0gYXR0cmlidXRlc1xuICAgICAgICBpZiAoY29tcG9uZW50cy5hbmltKSB7XG4gICAgICAgICAgICBuZXdFbnRpdHkuYW5pbS5yZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMoY29tcG9uZW50cy5hbmltLCBkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlY3Vyc2UgaW50byBjaGlsZHJlbi4gTm90ZSB0aGF0IHdlIGNvbnRpbnVlIHRvIHBhc3MgaW4gdGhlIHNhbWUgYG9sZFN1YnRyZWVSb290YCxcbiAgICAgICAgLy8gaW4gb3JkZXIgdG8gY29ycmVjdGx5IGhhbmRsZSBjYXNlcyB3aGVyZSBhIGNoaWxkIGhhcyBhbiBlbnRpdHkgcmVmZXJlbmNlXG4gICAgICAgIC8vIGZpZWxkIHRoYXQgcG9pbnRzIHRvIGEgcGFyZW50IG9yIG90aGVyIGFuY2VzdG9yIHRoYXQgaXMgc3RpbGwgd2l0aGluIHRoZVxuICAgICAgICAvLyBkdXBsaWNhdGVkIHN1YnRyZWUuXG4gICAgICAgIGNvbnN0IF9vbGQgPSBvbGRFbnRpdHkuY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gKGUgaW5zdGFuY2VvZiBFbnRpdHkpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgX25ldyA9IG5ld0VudGl0eS5jaGlsZHJlbi5maWx0ZXIoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHJldHVybiAoZSBpbnN0YW5jZW9mIEVudGl0eSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBfb2xkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkU3VidHJlZVJvb3QsIF9vbGRbaV0sIF9uZXdbaV0sIGR1cGxpY2F0ZWRJZHNNYXApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBFbnRpdHkgfTtcbiJdLCJuYW1lcyI6WyJfZW5hYmxlTGlzdCIsIkVudGl0eSIsIkdyYXBoTm9kZSIsImNvbnN0cnVjdG9yIiwibmFtZSIsImFwcCIsImdldEFwcGxpY2F0aW9uIiwiYW5pbSIsImFuaW1hdGlvbiIsImF1ZGlvbGlzdGVuZXIiLCJidXR0b24iLCJjYW1lcmEiLCJjb2xsaXNpb24iLCJlbGVtZW50IiwiZ3NwbGF0IiwibGF5b3V0Y2hpbGQiLCJsYXlvdXRncm91cCIsImxpZ2h0IiwibW9kZWwiLCJwYXJ0aWNsZXN5c3RlbSIsInJlbmRlciIsInJpZ2lkYm9keSIsInNjcmVlbiIsInNjcmlwdCIsInNjcm9sbGJhciIsInNjcm9sbHZpZXciLCJzb3VuZCIsInNwcml0ZSIsImMiLCJfYXBwIiwiX2Rlc3Ryb3lpbmciLCJfZ3VpZCIsIl90ZW1wbGF0ZSIsIkRlYnVnIiwiYXNzZXJ0IiwiYWRkQ29tcG9uZW50IiwidHlwZSIsImRhdGEiLCJzeXN0ZW0iLCJzeXN0ZW1zIiwiZXJyb3IiLCJ3YXJuIiwicmVtb3ZlQ29tcG9uZW50IiwiZmluZENvbXBvbmVudCIsImVudGl0eSIsImZpbmRPbmUiLCJub2RlIiwiZmluZENvbXBvbmVudHMiLCJlbnRpdGllcyIsImZpbmQiLCJtYXAiLCJmaW5kU2NyaXB0IiwibmFtZU9yVHlwZSIsIl9ub2RlJGMiLCJoYXMiLCJnZXQiLCJmaW5kU2NyaXB0cyIsIl9ub2RlJGMyIiwiZ2V0R3VpZCIsInNldEd1aWQiLCJndWlkIiwiY3JlYXRlIiwiaW5kZXgiLCJfZW50aXR5SW5kZXgiLCJfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwiZW5hYmxlZCIsImVuYWJsZUZpcnN0IiwibGVuZ3RoIiwiX2JlaW5nRW5hYmxlZCIsIl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsIl9vbkhpZXJhcmNoeVN0YXRlUG9zdENoYW5nZWQiLCJwdXNoIiwiX2NoaWxkcmVuIiwiaSIsImxlbiIsIl9lbmFibGVkIiwiY29tcG9uZW50cyIsImhhc093blByb3BlcnR5IiwiY29tcG9uZW50Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJvblBvc3RTdGF0ZUNoYW5nZSIsImZpbmRCeUd1aWQiLCJlIiwiaXNEZXNjZW5kYW50T2YiLCJkZXN0cm95IiwiY2xvbmUiLCJkdXBsaWNhdGVkSWRzTWFwIiwiX2Nsb25lUmVjdXJzaXZlbHkiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJ1bmRlZmluZWQiLCJfY2xvbmVJbnRlcm5hbCIsImNsb25lQ29tcG9uZW50Iiwib2xkQ2hpbGQiLCJuZXdDaGlsZCIsImFkZENoaWxkIiwiRVZFTlRfREVTVFJPWSIsIm9sZFN1YnRyZWVSb290Iiwib2xkRW50aXR5IiwibmV3RW50aXR5IiwiY29tcG9uZW50TmFtZSIsImVudGl0eVByb3BlcnRpZXMiLCJnZXRQcm9wZXJ0aWVzT2ZUeXBlIiwicHJvcGVydHlEZXNjcmlwdG9yIiwicHJvcGVydHlOYW1lIiwib2xkRW50aXR5UmVmZXJlbmNlSWQiLCJlbnRpdHlJc1dpdGhpbk9sZFN1YnRyZWUiLCJuZXdFbnRpdHlSZWZlcmVuY2VJZCIsInVzZUxlZ2FjeVNjcmlwdEF0dHJpYnV0ZUNsb25pbmciLCJfb2xkIiwiY2hpbGRyZW4iLCJmaWx0ZXIiLCJfbmV3Il0sIm1hcHBpbmdzIjoiOzs7OztBQU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsV0FBVyxHQUFHLEVBQUUsQ0FBQTs7QUFFdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxTQUFTQyxTQUFTLENBQUM7QUF5TjNCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUVDLEdBQUcsR0FBR0MsY0FBYyxFQUFFLEVBQUU7SUFDdEMsS0FBSyxDQUFDRixJQUFJLENBQUMsQ0FBQTtBQS9PZjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUcsSUFBSSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVUO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVA7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVg7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLEtBQUssR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVMO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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
