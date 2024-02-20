import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

const _vec3 = new Vec3();
const _quat = new Quat();

/**
 * A collision volume. Use this in conjunction with a {@link RigidBodyComponent} to make a
 * collision volume that can be simulated using the physics engine.
 *
 * If the {@link Entity} does not have a {@link RigidBodyComponent} then this collision volume will
 * act as a trigger volume. When an entity with a dynamic or kinematic body enters or leaves an
 * entity with a trigger volume, both entities will receive trigger events.
 *
 * The following table shows all the events that can be fired between two Entities:
 *
 * |                                       | Rigid Body (Static)                                                   | Rigid Body (Dynamic or Kinematic)                                     | Trigger Volume                                      |
 * | ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
 * | **Rigid Body (Static)**               |                                                                       | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> |                                                     |
 * | **Rigid Body (Dynamic or Kinematic)** | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>triggerenter</li><li>triggerleave</li></ul> |
 * | **Trigger Volume**                    |                                                                       | <ul><li>triggerenter</li><li>triggerleave</li></ul>                   |                                                     |
 *
 * @property {string} type The type of the collision volume. Can be:
 *
 * - "box": A box-shaped collision volume.
 * - "capsule": A capsule-shaped collision volume.
 * - "compound": A compound shape. Any descendant entities with a collision component
 * of type box, capsule, cone, cylinder or sphere will be combined into a single, rigid
 * shape.
 * - "cone": A cone-shaped collision volume.
 * - "cylinder": A cylinder-shaped collision volume.
 * - "mesh": A collision volume that uses a model asset as its shape.
 * - "sphere": A sphere-shaped collision volume.
 *
 * Defaults to "box".
 * @property {Vec3} halfExtents The half-extents of the
 * box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5].
 * @property {Vec3} linearOffset The positional offset of the collision shape from the Entity position along the local axes.
 * Defaults to [0, 0, 0].
 * @property {Quat} angularOffset The rotational offset of the collision shape from the Entity rotation in local space.
 * Defaults to identity.
 * @property {number} radius The radius of the sphere, capsule, cylinder or cone-shaped collision
 * volumes. Defaults to 0.5.
 * @property {number} axis The local space axis with which the capsule, cylinder or cone-shaped
 * collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
 * @property {number} height The total height of the capsule, cylinder or cone-shaped collision
 * volume from tip to tip. Defaults to 2.
 * @property {Asset|number} asset The asset for the model of the mesh collision volume - can also
 * be an asset id. Defaults to null.
 * @property {Asset|number} renderAsset The render asset of the mesh collision volume - can also be
 * an asset id. Defaults to null. If not set then the asset property will be checked instead.
 * @property {import('../../../scene/model.js').Model} model The model that is added to the scene
 * graph for the mesh collision volume.
 * @augments Component
 * @category Physics
 */
class CollisionComponent extends Component {
  /**
   * Create a new CollisionComponent.
   *
   * @param {import('./system.js').CollisionComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    /** @private */
    this._compoundParent = null;
    this._hasOffset = false;
    this.entity.on('insert', this._onInsert, this);
    this.on('set_type', this.onSetType, this);
    this.on('set_halfExtents', this.onSetHalfExtents, this);
    this.on('set_linearOffset', this.onSetOffset, this);
    this.on('set_angularOffset', this.onSetOffset, this);
    this.on('set_radius', this.onSetRadius, this);
    this.on('set_height', this.onSetHeight, this);
    this.on('set_axis', this.onSetAxis, this);
    this.on('set_asset', this.onSetAsset, this);
    this.on('set_renderAsset', this.onSetRenderAsset, this);
    this.on('set_model', this.onSetModel, this);
    this.on('set_render', this.onSetRender, this);
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetType(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.system.changeType(this, oldValue, newValue);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetHalfExtents(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && t === 'box') {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetOffset(name, oldValue, newValue) {
    this._hasOffset = !this.data.linearOffset.equals(Vec3.ZERO) || !this.data.angularOffset.equals(Quat.IDENTITY);
    if (this.data.initialized) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRadius(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetHeight(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetAxis(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      // Remove old listeners
      const asset = assets.get(oldValue);
      if (asset) {
        asset.off('remove', this.onAssetRemoved, this);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.asset = newValue.id;
      }
      const asset = assets.get(this.data.asset);
      if (asset) {
        // make sure we don't subscribe twice
        asset.off('remove', this.onAssetRemoved, this);
        asset.on('remove', this.onAssetRemoved, this);
      }
    }
    if (this.data.initialized && this.data.type === 'mesh') {
      if (!newValue) {
        // if asset is null set model to null
        // so that it's going to be removed from the simulation
        this.data.model = null;
      }
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRenderAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      // Remove old listeners
      const asset = assets.get(oldValue);
      if (asset) {
        asset.off('remove', this.onRenderAssetRemoved, this);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.renderAsset = newValue.id;
      }
      const asset = assets.get(this.data.renderAsset);
      if (asset) {
        // make sure we don't subscribe twice
        asset.off('remove', this.onRenderAssetRemoved, this);
        asset.on('remove', this.onRenderAssetRemoved, this);
      }
    }
    if (this.data.initialized && this.data.type === 'mesh') {
      if (!newValue) {
        // if render asset is null set render to null
        // so that it's going to be removed from the simulation
        this.data.render = null;
      }
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetModel(name, oldValue, newValue) {
    if (this.data.initialized && this.data.type === 'mesh') {
      // recreate physical shapes skipping loading the model
      // from the 'asset' as the model passed in newValue might
      // have been created procedurally
      this.system.implementations.mesh.doRecreatePhysicalShape(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRender(name, oldValue, newValue) {
    this.onSetModel(name, oldValue, newValue);
  }

  /**
   * @param {Asset} asset - Asset that was removed.
   * @private
   */
  onAssetRemoved(asset) {
    asset.off('remove', this.onAssetRemoved, this);
    if (this.data.asset === asset.id) {
      this.asset = null;
    }
  }

  /**
   * @param {Asset} asset - Asset that was removed.
   * @private
   */
  onRenderAssetRemoved(asset) {
    asset.off('remove', this.onRenderAssetRemoved, this);
    if (this.data.renderAsset === asset.id) {
      this.renderAsset = null;
    }
  }

  /**
   * @param {*} shape - Ammo shape.
   * @returns {number|null} The shape's index in the child array of the compound shape.
   * @private
   */
  _getCompoundChildShapeIndex(shape) {
    const compound = this.data.shape;
    const shapes = compound.getNumChildShapes();
    for (let i = 0; i < shapes; i++) {
      const childShape = compound.getChildShape(i);
      if (childShape.ptr === shape.ptr) {
        return i;
      }
    }
    return null;
  }

  /**
   * @param {import('../../../scene/graph-node.js').GraphNode} parent - The parent node.
   * @private
   */
  _onInsert(parent) {
    // TODO
    // if is child of compound shape
    // and there is no change of compoundParent, then update child transform
    // once updateChildTransform is exposed in ammo.js

    if (typeof Ammo === 'undefined') return;
    if (this._compoundParent) {
      this.system.recreatePhysicalShapes(this);
    } else if (!this.entity.rigidbody) {
      let ancestor = this.entity.parent;
      while (ancestor) {
        if (ancestor.collision && ancestor.collision.type === 'compound') {
          if (ancestor.collision.shape.getNumChildShapes() === 0) {
            this.system.recreatePhysicalShapes(ancestor.collision);
          } else {
            this.system.recreatePhysicalShapes(this);
          }
          break;
        }
        ancestor = ancestor.parent;
      }
    }
  }

  /** @private */
  _updateCompound() {
    const entity = this.entity;
    if (entity._dirtyWorld) {
      let dirty = entity._dirtyLocal;
      let parent = entity;
      while (parent && !dirty) {
        if (parent.collision && parent.collision === this._compoundParent) break;
        if (parent._dirtyLocal) dirty = true;
        parent = parent.parent;
      }
      if (dirty) {
        entity.forEach(this.system.implementations.compound._updateEachDescendantTransform, entity);
        const bodyComponent = this._compoundParent.entity.rigidbody;
        if (bodyComponent) bodyComponent.activate();
      }
    }
  }

  /**
   * @description Returns the world position for the collision shape taking into account of any offsets.
   * @returns {Vec3} The world position for the collision shape.
   */
  getShapePosition() {
    const pos = this.entity.getPosition();
    if (this._hasOffset) {
      const rot = this.entity.getRotation();
      const lo = this.data.linearOffset;
      _quat.copy(rot).transformVector(lo, _vec3);
      return _vec3.add(pos);
    }
    return pos;
  }

  /**
   * @description Returns the world rotation for the collision shape taking into account of any offsets.
   * @returns {Quat} The world rotation for the collision.
   */
  getShapeRotation() {
    const rot = this.entity.getRotation();
    if (this._hasOffset) {
      return _quat.copy(rot).mul(this.data.angularOffset);
    }
    return rot;
  }

  /** @private */
  onEnable() {
    if (this.data.type === 'mesh' && (this.data.asset || this.data.renderAsset) && this.data.initialized) {
      const asset = this.system.app.assets.get(this.data.asset || this.data.renderAsset);
      // recreate the collision shape if the model asset is not loaded
      // or the shape does not exist
      if (asset && (!asset.resource || !this.data.shape)) {
        this.system.recreatePhysicalShapes(this);
        return;
      }
    }
    if (this.entity.rigidbody) {
      if (this.entity.rigidbody.enabled) {
        this.entity.rigidbody.enableSimulation();
      }
    } else if (this._compoundParent && this !== this._compoundParent) {
      if (this._compoundParent.shape.getNumChildShapes() === 0) {
        this.system.recreatePhysicalShapes(this._compoundParent);
      } else {
        const transform = this.system._getNodeTransform(this.entity, this._compoundParent.entity);
        this._compoundParent.shape.addChildShape(transform, this.data.shape);
        Ammo.destroy(transform);
        if (this._compoundParent.entity.rigidbody) this._compoundParent.entity.rigidbody.activate();
      }
    } else if (this.entity.trigger) {
      this.entity.trigger.enable();
    }
  }

  /** @private */
  onDisable() {
    if (this.entity.rigidbody) {
      this.entity.rigidbody.disableSimulation();
    } else if (this._compoundParent && this !== this._compoundParent) {
      if (!this._compoundParent.entity._destroying) {
        this.system._removeCompoundChild(this._compoundParent, this.data.shape);
        if (this._compoundParent.entity.rigidbody) this._compoundParent.entity.rigidbody.activate();
      }
    } else if (this.entity.trigger) {
      this.entity.trigger.disable();
    }
  }

  /** @private */
  onBeforeRemove() {
    if (this.asset) {
      this.asset = null;
    }
    if (this.renderAsset) {
      this.renderAsset = null;
    }
    this.entity.off('insert', this._onInsert, this);
    this.off();
  }
}
/**
 * Fired when a contact occurs between two rigid bodies. The handler is passed a
 * {@link ContactResult} object which contains details of the contact between the two rigid
 * bodies.
 *
 * @event
 * @example
 * entity.collision.on('contact', (result) => {
 *    console.log(`Contact between ${entity.name} and ${result.other.name}`);
 * });
 */
CollisionComponent.EVENT_CONTACT = 'contact';
/**
 * Fired when two rigid bodies start touching. The handler is passed the {@link ContactResult}
 * object which contains details of the contact between the two rigid bodies.
 *
 * @event
 * @example
 * entity.collision.on('collisionstart', (result) => {
 *    console.log(`${entity.name} started touching ${result.other.name}`);
 * });
 */
CollisionComponent.EVENT_COLLISIONSTART = 'collisionstart';
/**
 * Fired two rigid-bodies stop touching. The handler is passed an {@link Entity} that
 * represents the other rigid body involved in the collision.
 *
 * @event
 * @example
 * entity.collision.on('collisionend', (other) => {
 *     console.log(`${entity.name} stopped touching ${other.name}`);
 * });
 */
CollisionComponent.EVENT_COLLISIONEND = 'collisionend';
/**
 * Fired when a rigid body enters a trigger volume. The handler is passed an {@link Entity}
 * representing the rigid body that entered this collision volume.
 *
 * @event
 * @example
 * entity.collision.on('triggerenter', (other) => {
 *     console.log(`${other.name} entered trigger volume ${entity.name}`);
 * });
 */
CollisionComponent.EVENT_TRIGGERENTER = 'triggerenter';
/**
 * Fired when a rigid body exits a trigger volume. The handler is passed an {@link Entity}
 * representing the rigid body that exited this collision volume.
 *
 * @event
 * @example
 * entity.collision.on('triggerleave', (other) => {
 *     console.log(`${other.name} exited trigger volume ${entity.name}`);
 * });
 */
CollisionComponent.EVENT_TRIGGERLEAVE = 'triggerleave';

export { CollisionComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9xdWF0ID0gbmV3IFF1YXQoKTtcblxuLyoqXG4gKiBBIGNvbGxpc2lvbiB2b2x1bWUuIFVzZSB0aGlzIGluIGNvbmp1bmN0aW9uIHdpdGggYSB7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50fSB0byBtYWtlIGFcbiAqIGNvbGxpc2lvbiB2b2x1bWUgdGhhdCBjYW4gYmUgc2ltdWxhdGVkIHVzaW5nIHRoZSBwaHlzaWNzIGVuZ2luZS5cbiAqXG4gKiBJZiB0aGUge0BsaW5rIEVudGl0eX0gZG9lcyBub3QgaGF2ZSBhIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnR9IHRoZW4gdGhpcyBjb2xsaXNpb24gdm9sdW1lIHdpbGxcbiAqIGFjdCBhcyBhIHRyaWdnZXIgdm9sdW1lLiBXaGVuIGFuIGVudGl0eSB3aXRoIGEgZHluYW1pYyBvciBraW5lbWF0aWMgYm9keSBlbnRlcnMgb3IgbGVhdmVzIGFuXG4gKiBlbnRpdHkgd2l0aCBhIHRyaWdnZXIgdm9sdW1lLCBib3RoIGVudGl0aWVzIHdpbGwgcmVjZWl2ZSB0cmlnZ2VyIGV2ZW50cy5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIHRhYmxlIHNob3dzIGFsbCB0aGUgZXZlbnRzIHRoYXQgY2FuIGJlIGZpcmVkIGJldHdlZW4gdHdvIEVudGl0aWVzOlxuICpcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJpZ2lkIEJvZHkgKFN0YXRpYykgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJpZ2lkIEJvZHkgKER5bmFtaWMgb3IgS2luZW1hdGljKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFRyaWdnZXIgVm9sdW1lICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCAqKlJpZ2lkIEJvZHkgKFN0YXRpYykqKiAgICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgPHVsPjxsaT5jb250YWN0PC9saT48bGk+Y29sbGlzaW9uc3RhcnQ8L2xpPjxsaT5jb2xsaXNpb25lbmQ8L2xpPjwvdWw+IHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgKipSaWdpZCBCb2R5IChEeW5hbWljIG9yIEtpbmVtYXRpYykqKiB8IDx1bD48bGk+Y29udGFjdDwvbGk+PGxpPmNvbGxpc2lvbnN0YXJ0PC9saT48bGk+Y29sbGlzaW9uZW5kPC9saT48L3VsPiB8IDx1bD48bGk+Y29udGFjdDwvbGk+PGxpPmNvbGxpc2lvbnN0YXJ0PC9saT48bGk+Y29sbGlzaW9uZW5kPC9saT48L3VsPiB8IDx1bD48bGk+dHJpZ2dlcmVudGVyPC9saT48bGk+dHJpZ2dlcmxlYXZlPC9saT48L3VsPiB8XG4gKiB8ICoqVHJpZ2dlciBWb2x1bWUqKiAgICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCA8dWw+PGxpPnRyaWdnZXJlbnRlcjwvbGk+PGxpPnRyaWdnZXJsZWF2ZTwvbGk+PC91bD4gICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0eXBlIFRoZSB0eXBlIG9mIHRoZSBjb2xsaXNpb24gdm9sdW1lLiBDYW4gYmU6XG4gKlxuICogLSBcImJveFwiOiBBIGJveC1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjYXBzdWxlXCI6IEEgY2Fwc3VsZS1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjb21wb3VuZFwiOiBBIGNvbXBvdW5kIHNoYXBlLiBBbnkgZGVzY2VuZGFudCBlbnRpdGllcyB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudFxuICogb2YgdHlwZSBib3gsIGNhcHN1bGUsIGNvbmUsIGN5bGluZGVyIG9yIHNwaGVyZSB3aWxsIGJlIGNvbWJpbmVkIGludG8gYSBzaW5nbGUsIHJpZ2lkXG4gKiBzaGFwZS5cbiAqIC0gXCJjb25lXCI6IEEgY29uZS1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjeWxpbmRlclwiOiBBIGN5bGluZGVyLXNoYXBlZCBjb2xsaXNpb24gdm9sdW1lLlxuICogLSBcIm1lc2hcIjogQSBjb2xsaXNpb24gdm9sdW1lIHRoYXQgdXNlcyBhIG1vZGVsIGFzc2V0IGFzIGl0cyBzaGFwZS5cbiAqIC0gXCJzcGhlcmVcIjogQSBzcGhlcmUtc2hhcGVkIGNvbGxpc2lvbiB2b2x1bWUuXG4gKlxuICogRGVmYXVsdHMgdG8gXCJib3hcIi5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gaGFsZkV4dGVudHMgVGhlIGhhbGYtZXh0ZW50cyBvZiB0aGVcbiAqIGJveC1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZSBpbiB0aGUgeCwgeSBhbmQgeiBheGVzLiBEZWZhdWx0cyB0byBbMC41LCAwLjUsIDAuNV0uXG4gKiBAcHJvcGVydHkge1ZlYzN9IGxpbmVhck9mZnNldCBUaGUgcG9zaXRpb25hbCBvZmZzZXQgb2YgdGhlIGNvbGxpc2lvbiBzaGFwZSBmcm9tIHRoZSBFbnRpdHkgcG9zaXRpb24gYWxvbmcgdGhlIGxvY2FsIGF4ZXMuXG4gKiBEZWZhdWx0cyB0byBbMCwgMCwgMF0uXG4gKiBAcHJvcGVydHkge1F1YXR9IGFuZ3VsYXJPZmZzZXQgVGhlIHJvdGF0aW9uYWwgb2Zmc2V0IG9mIHRoZSBjb2xsaXNpb24gc2hhcGUgZnJvbSB0aGUgRW50aXR5IHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlLlxuICogRGVmYXVsdHMgdG8gaWRlbnRpdHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmFkaXVzIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSwgY2Fwc3VsZSwgY3lsaW5kZXIgb3IgY29uZS1zaGFwZWQgY29sbGlzaW9uXG4gKiB2b2x1bWVzLiBEZWZhdWx0cyB0byAwLjUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYXhpcyBUaGUgbG9jYWwgc3BhY2UgYXhpcyB3aXRoIHdoaWNoIHRoZSBjYXBzdWxlLCBjeWxpbmRlciBvciBjb25lLXNoYXBlZFxuICogY29sbGlzaW9uIHZvbHVtZSdzIGxlbmd0aCBpcyBhbGlnbmVkLiAwIGZvciBYLCAxIGZvciBZIGFuZCAyIGZvciBaLiBEZWZhdWx0cyB0byAxIChZLWF4aXMpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodCBUaGUgdG90YWwgaGVpZ2h0IG9mIHRoZSBjYXBzdWxlLCBjeWxpbmRlciBvciBjb25lLXNoYXBlZCBjb2xsaXNpb25cbiAqIHZvbHVtZSBmcm9tIHRpcCB0byB0aXAuIERlZmF1bHRzIHRvIDIuXG4gKiBAcHJvcGVydHkge0Fzc2V0fG51bWJlcn0gYXNzZXQgVGhlIGFzc2V0IGZvciB0aGUgbW9kZWwgb2YgdGhlIG1lc2ggY29sbGlzaW9uIHZvbHVtZSAtIGNhbiBhbHNvXG4gKiBiZSBhbiBhc3NldCBpZC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR8bnVtYmVyfSByZW5kZXJBc3NldCBUaGUgcmVuZGVyIGFzc2V0IG9mIHRoZSBtZXNoIGNvbGxpc2lvbiB2b2x1bWUgLSBjYW4gYWxzbyBiZVxuICogYW4gYXNzZXQgaWQuIERlZmF1bHRzIHRvIG51bGwuIElmIG5vdCBzZXQgdGhlbiB0aGUgYXNzZXQgcHJvcGVydHkgd2lsbCBiZSBjaGVja2VkIGluc3RlYWQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnKS5Nb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lXG4gKiBncmFwaCBmb3IgdGhlIG1lc2ggY29sbGlzaW9uIHZvbHVtZS5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqIEBjYXRlZ29yeSBQaHlzaWNzXG4gKi9cbmNsYXNzIENvbGxpc2lvbkNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFcbiAgICAgKiB7QGxpbmsgQ29udGFjdFJlc3VsdH0gb2JqZWN0IHdoaWNoIGNvbnRhaW5zIGRldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIHJpZ2lkXG4gICAgICogYm9kaWVzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuY29sbGlzaW9uLm9uKCdjb250YWN0JywgKHJlc3VsdCkgPT4ge1xuICAgICAqICAgIGNvbnNvbGUubG9nKGBDb250YWN0IGJldHdlZW4gJHtlbnRpdHkubmFtZX0gYW5kICR7cmVzdWx0Lm90aGVyLm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0NPTlRBQ1QgPSAnY29udGFjdCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHR3byByaWdpZCBib2RpZXMgc3RhcnQgdG91Y2hpbmcuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUge0BsaW5rIENvbnRhY3RSZXN1bHR9XG4gICAgICogb2JqZWN0IHdoaWNoIGNvbnRhaW5zIGRldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmNvbGxpc2lvbi5vbignY29sbGlzaW9uc3RhcnQnLCAocmVzdWx0KSA9PiB7XG4gICAgICogICAgY29uc29sZS5sb2coYCR7ZW50aXR5Lm5hbWV9IHN0YXJ0ZWQgdG91Y2hpbmcgJHtyZXN1bHQub3RoZXIubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ09MTElTSU9OU1RBUlQgPSAnY29sbGlzaW9uc3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgdHdvIHJpZ2lkLWJvZGllcyBzdG9wIHRvdWNoaW5nLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYW4ge0BsaW5rIEVudGl0eX0gdGhhdFxuICAgICAqIHJlcHJlc2VudHMgdGhlIG90aGVyIHJpZ2lkIGJvZHkgaW52b2x2ZWQgaW4gdGhlIGNvbGxpc2lvbi5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmNvbGxpc2lvbi5vbignY29sbGlzaW9uZW5kJywgKG90aGVyKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGAke2VudGl0eS5uYW1lfSBzdG9wcGVkIHRvdWNoaW5nICR7b3RoZXIubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ09MTElTSU9ORU5EID0gJ2NvbGxpc2lvbmVuZCc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFuIHtAbGluayBFbnRpdHl9XG4gICAgICogcmVwcmVzZW50aW5nIHRoZSByaWdpZCBib2R5IHRoYXQgZW50ZXJlZCB0aGlzIGNvbGxpc2lvbiB2b2x1bWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5jb2xsaXNpb24ub24oJ3RyaWdnZXJlbnRlcicsIChvdGhlcikgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgJHtvdGhlci5uYW1lfSBlbnRlcmVkIHRyaWdnZXIgdm9sdW1lICR7ZW50aXR5Lm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1RSSUdHRVJFTlRFUiA9ICd0cmlnZ2VyZW50ZXInO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZXhpdHMgYSB0cmlnZ2VyIHZvbHVtZS4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIGFuIHtAbGluayBFbnRpdHl9XG4gICAgICogcmVwcmVzZW50aW5nIHRoZSByaWdpZCBib2R5IHRoYXQgZXhpdGVkIHRoaXMgY29sbGlzaW9uIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmNvbGxpc2lvbi5vbigndHJpZ2dlcmxlYXZlJywgKG90aGVyKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGAke290aGVyLm5hbWV9IGV4aXRlZCB0cmlnZ2VyIHZvbHVtZSAke2VudGl0eS5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9UUklHR0VSTEVBVkUgPSAndHJpZ2dlcmxlYXZlJztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb2xsaXNpb25Db21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5Db2xsaXNpb25Db21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9jb21wb3VuZFBhcmVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2hhc09mZnNldCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Lm9uKCdpbnNlcnQnLCB0aGlzLl9vbkluc2VydCwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5vbignc2V0X3R5cGUnLCB0aGlzLm9uU2V0VHlwZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9oYWxmRXh0ZW50cycsIHRoaXMub25TZXRIYWxmRXh0ZW50cywgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9saW5lYXJPZmZzZXQnLCB0aGlzLm9uU2V0T2Zmc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2FuZ3VsYXJPZmZzZXQnLCB0aGlzLm9uU2V0T2Zmc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JhZGl1cycsIHRoaXMub25TZXRSYWRpdXMsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfaGVpZ2h0JywgdGhpcy5vblNldEhlaWdodCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9heGlzJywgdGhpcy5vblNldEF4aXMsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfYXNzZXQnLCB0aGlzLm9uU2V0QXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfcmVuZGVyQXNzZXQnLCB0aGlzLm9uU2V0UmVuZGVyQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbW9kZWwnLCB0aGlzLm9uU2V0TW9kZWwsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfcmVuZGVyJywgdGhpcy5vblNldFJlbmRlciwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldFR5cGUobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmNoYW5nZVR5cGUodGhpcywgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRIYWxmRXh0ZW50cyhuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgdCA9IHRoaXMuZGF0YS50eXBlO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmIHQgPT09ICdib3gnKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldE9mZnNldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5faGFzT2Zmc2V0ID0gIXRoaXMuZGF0YS5saW5lYXJPZmZzZXQuZXF1YWxzKFZlYzMuWkVSTykgfHwgIXRoaXMuZGF0YS5hbmd1bGFyT2Zmc2V0LmVxdWFscyhRdWF0LklERU5USVRZKTtcblxuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldFJhZGl1cyhuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgdCA9IHRoaXMuZGF0YS50eXBlO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmICh0ID09PSAnc3BoZXJlJyB8fCB0ID09PSAnY2Fwc3VsZScgfHwgdCA9PT0gJ2N5bGluZGVyJyB8fCB0ID09PSAnY29uZScpKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldEhlaWdodChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgdCA9IHRoaXMuZGF0YS50eXBlO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmICh0ID09PSAnY2Fwc3VsZScgfHwgdCA9PT0gJ2N5bGluZGVyJyB8fCB0ID09PSAnY29uZScpKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldEF4aXMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLmRhdGEudHlwZTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCAmJiAodCA9PT0gJ2NhcHN1bGUnIHx8IHQgPT09ICdjeWxpbmRlcicgfHwgdCA9PT0gJ2NvbmUnKSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuYXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuZGF0YS5hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZG9uJ3Qgc3Vic2NyaWJlIHR3aWNlXG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmIHRoaXMuZGF0YS50eXBlID09PSAnbWVzaCcpIHtcbiAgICAgICAgICAgIGlmICghbmV3VmFsdWUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBhc3NldCBpcyBudWxsIHNldCBtb2RlbCB0byBudWxsXG4gICAgICAgICAgICAgICAgLy8gc28gdGhhdCBpdCdzIGdvaW5nIHRvIGJlIHJlbW92ZWQgZnJvbSB0aGUgc2ltdWxhdGlvblxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldFJlbmRlckFzc2V0KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnNcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW5kZXJBc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5yZW5kZXJBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5kYXRhLnJlbmRlckFzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB3ZSBkb24ndCBzdWJzY3JpYmUgdHdpY2VcbiAgICAgICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW5kZXJBc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVuZGVyQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRhdGEuaW5pdGlhbGl6ZWQgJiYgdGhpcy5kYXRhLnR5cGUgPT09ICdtZXNoJykge1xuICAgICAgICAgICAgaWYgKCFuZXdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIHJlbmRlciBhc3NldCBpcyBudWxsIHNldCByZW5kZXIgdG8gbnVsbFxuICAgICAgICAgICAgICAgIC8vIHNvIHRoYXQgaXQncyBnb2luZyB0byBiZSByZW1vdmVkIGZyb20gdGhlIHNpbXVsYXRpb25cbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEucmVuZGVyID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFByb3BlcnR5IG5hbWUuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFByZXZpb3VzIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcGFyYW0geyp9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uU2V0TW9kZWwobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuaW5pdGlhbGl6ZWQgJiYgdGhpcy5kYXRhLnR5cGUgPT09ICdtZXNoJykge1xuICAgICAgICAgICAgLy8gcmVjcmVhdGUgcGh5c2ljYWwgc2hhcGVzIHNraXBwaW5nIGxvYWRpbmcgdGhlIG1vZGVsXG4gICAgICAgICAgICAvLyBmcm9tIHRoZSAnYXNzZXQnIGFzIHRoZSBtb2RlbCBwYXNzZWQgaW4gbmV3VmFsdWUgbWlnaHRcbiAgICAgICAgICAgIC8vIGhhdmUgYmVlbiBjcmVhdGVkIHByb2NlZHVyYWxseVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uaW1wbGVtZW50YXRpb25zLm1lc2guZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFByb3BlcnR5IG5hbWUuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFByZXZpb3VzIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcGFyYW0geyp9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uU2V0UmVuZGVyKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLm9uU2V0TW9kZWwobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIEFzc2V0IHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIEFzc2V0IHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblJlbmRlckFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW5kZXJBc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLnJlbmRlckFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJBc3NldCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IHNoYXBlIC0gQW1tbyBzaGFwZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfG51bGx9IFRoZSBzaGFwZSdzIGluZGV4IGluIHRoZSBjaGlsZCBhcnJheSBvZiB0aGUgY29tcG91bmQgc2hhcGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgoc2hhcGUpIHtcbiAgICAgICAgY29uc3QgY29tcG91bmQgPSB0aGlzLmRhdGEuc2hhcGU7XG4gICAgICAgIGNvbnN0IHNoYXBlcyA9IGNvbXBvdW5kLmdldE51bUNoaWxkU2hhcGVzKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaGFwZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2hpbGRTaGFwZSA9IGNvbXBvdW5kLmdldENoaWxkU2hhcGUoaSk7XG4gICAgICAgICAgICBpZiAoY2hpbGRTaGFwZS5wdHIgPT09IHNoYXBlLnB0cikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnKS5HcmFwaE5vZGV9IHBhcmVudCAtIFRoZSBwYXJlbnQgbm9kZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkluc2VydChwYXJlbnQpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyBpZiBpcyBjaGlsZCBvZiBjb21wb3VuZCBzaGFwZVxuICAgICAgICAvLyBhbmQgdGhlcmUgaXMgbm8gY2hhbmdlIG9mIGNvbXBvdW5kUGFyZW50LCB0aGVuIHVwZGF0ZSBjaGlsZCB0cmFuc2Zvcm1cbiAgICAgICAgLy8gb25jZSB1cGRhdGVDaGlsZFRyYW5zZm9ybSBpcyBleHBvc2VkIGluIGFtbW8uanNcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gPT09ICd1bmRlZmluZWQnKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5lbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICBsZXQgYW5jZXN0b3IgPSB0aGlzLmVudGl0eS5wYXJlbnQ7XG4gICAgICAgICAgICB3aGlsZSAoYW5jZXN0b3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5jZXN0b3IuY29sbGlzaW9uICYmIGFuY2VzdG9yLmNvbGxpc2lvbi50eXBlID09PSAnY29tcG91bmQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhbmNlc3Rvci5jb2xsaXNpb24uc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhhbmNlc3Rvci5jb2xsaXNpb24pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYW5jZXN0b3IgPSBhbmNlc3Rvci5wYXJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlQ29tcG91bmQoKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBpZiAoZW50aXR5Ll9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBsZXQgZGlydHkgPSBlbnRpdHkuX2RpcnR5TG9jYWw7XG4gICAgICAgICAgICBsZXQgcGFyZW50ID0gZW50aXR5O1xuICAgICAgICAgICAgd2hpbGUgKHBhcmVudCAmJiAhZGlydHkpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50LmNvbGxpc2lvbiAmJiBwYXJlbnQuY29sbGlzaW9uID09PSB0aGlzLl9jb21wb3VuZFBhcmVudClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBpZiAocGFyZW50Ll9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgICAgICAgICBkaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGlydHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkuZm9yRWFjaCh0aGlzLnN5c3RlbS5pbXBsZW1lbnRhdGlvbnMuY29tcG91bmQuX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtLCBlbnRpdHkpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYm9keUNvbXBvbmVudCA9IHRoaXMuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHk7XG4gICAgICAgICAgICAgICAgaWYgKGJvZHlDb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgIGJvZHlDb21wb25lbnQuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQGRlc2NyaXB0aW9uIFJldHVybnMgdGhlIHdvcmxkIHBvc2l0aW9uIGZvciB0aGUgY29sbGlzaW9uIHNoYXBlIHRha2luZyBpbnRvIGFjY291bnQgb2YgYW55IG9mZnNldHMuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBwb3NpdGlvbiBmb3IgdGhlIGNvbGxpc2lvbiBzaGFwZS5cbiAgICAgKi9cbiAgICBnZXRTaGFwZVBvc2l0aW9uKCkge1xuICAgICAgICBjb25zdCBwb3MgPSB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpO1xuXG4gICAgICAgIGlmICh0aGlzLl9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IHRoaXMuZW50aXR5LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBsbyA9IHRoaXMuZGF0YS5saW5lYXJPZmZzZXQ7XG5cbiAgICAgICAgICAgIF9xdWF0LmNvcHkocm90KS50cmFuc2Zvcm1WZWN0b3IobG8sIF92ZWMzKTtcbiAgICAgICAgICAgIHJldHVybiBfdmVjMy5hZGQocG9zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwb3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGRlc2NyaXB0aW9uIFJldHVybnMgdGhlIHdvcmxkIHJvdGF0aW9uIGZvciB0aGUgY29sbGlzaW9uIHNoYXBlIHRha2luZyBpbnRvIGFjY291bnQgb2YgYW55IG9mZnNldHMuXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSB3b3JsZCByb3RhdGlvbiBmb3IgdGhlIGNvbGxpc2lvbi5cbiAgICAgKi9cbiAgICBnZXRTaGFwZVJvdGF0aW9uKCkge1xuICAgICAgICBjb25zdCByb3QgPSB0aGlzLmVudGl0eS5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgIGlmICh0aGlzLl9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBfcXVhdC5jb3B5KHJvdCkubXVsKHRoaXMuZGF0YS5hbmd1bGFyT2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb3Q7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEudHlwZSA9PT0gJ21lc2gnICYmICh0aGlzLmRhdGEuYXNzZXQgfHwgdGhpcy5kYXRhLnJlbmRlckFzc2V0KSAmJiB0aGlzLmRhdGEuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5kYXRhLmFzc2V0IHx8IHRoaXMuZGF0YS5yZW5kZXJBc3NldCk7XG4gICAgICAgICAgICAvLyByZWNyZWF0ZSB0aGUgY29sbGlzaW9uIHNoYXBlIGlmIHRoZSBtb2RlbCBhc3NldCBpcyBub3QgbG9hZGVkXG4gICAgICAgICAgICAvLyBvciB0aGUgc2hhcGUgZG9lcyBub3QgZXhpc3RcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiAoIWFzc2V0LnJlc291cmNlIHx8ICF0aGlzLmRhdGEuc2hhcGUpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkucmlnaWRib2R5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2NvbXBvdW5kUGFyZW50ICYmIHRoaXMgIT09IHRoaXMuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY29tcG91bmRQYXJlbnQuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcy5fY29tcG91bmRQYXJlbnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSB0aGlzLnN5c3RlbS5fZ2V0Tm9kZVRyYW5zZm9ybSh0aGlzLmVudGl0eSwgdGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb21wb3VuZFBhcmVudC5zaGFwZS5hZGRDaGlsZFNoYXBlKHRyYW5zZm9ybSwgdGhpcy5kYXRhLnNoYXBlKTtcbiAgICAgICAgICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkudHJpZ2dlci5lbmFibGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fY29tcG91bmRQYXJlbnQgJiYgdGhpcyAhPT0gdGhpcy5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5Ll9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3JlbW92ZUNvbXBvdW5kQ2hpbGQodGhpcy5fY29tcG91bmRQYXJlbnQsIHRoaXMuZGF0YS5zaGFwZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnRyaWdnZXIuZGlzYWJsZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLmFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLmFzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5yZW5kZXJBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJBc3NldCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMuX29uSW5zZXJ0LCB0aGlzKTtcblxuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQ29sbGlzaW9uQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiX3ZlYzMiLCJWZWMzIiwiX3F1YXQiLCJRdWF0IiwiQ29sbGlzaW9uQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfY29tcG91bmRQYXJlbnQiLCJfaGFzT2Zmc2V0Iiwib24iLCJfb25JbnNlcnQiLCJvblNldFR5cGUiLCJvblNldEhhbGZFeHRlbnRzIiwib25TZXRPZmZzZXQiLCJvblNldFJhZGl1cyIsIm9uU2V0SGVpZ2h0Iiwib25TZXRBeGlzIiwib25TZXRBc3NldCIsIm9uU2V0UmVuZGVyQXNzZXQiLCJvblNldE1vZGVsIiwib25TZXRSZW5kZXIiLCJuYW1lIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImNoYW5nZVR5cGUiLCJ0IiwiZGF0YSIsInR5cGUiLCJpbml0aWFsaXplZCIsInJlY3JlYXRlUGh5c2ljYWxTaGFwZXMiLCJsaW5lYXJPZmZzZXQiLCJlcXVhbHMiLCJaRVJPIiwiYW5ndWxhck9mZnNldCIsIklERU5USVRZIiwiYXNzZXRzIiwiYXBwIiwiYXNzZXQiLCJnZXQiLCJvZmYiLCJvbkFzc2V0UmVtb3ZlZCIsIkFzc2V0IiwiaWQiLCJtb2RlbCIsIm9uUmVuZGVyQXNzZXRSZW1vdmVkIiwicmVuZGVyQXNzZXQiLCJyZW5kZXIiLCJpbXBsZW1lbnRhdGlvbnMiLCJtZXNoIiwiZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUiLCJfZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgiLCJzaGFwZSIsImNvbXBvdW5kIiwic2hhcGVzIiwiZ2V0TnVtQ2hpbGRTaGFwZXMiLCJpIiwiY2hpbGRTaGFwZSIsImdldENoaWxkU2hhcGUiLCJwdHIiLCJwYXJlbnQiLCJBbW1vIiwicmlnaWRib2R5IiwiYW5jZXN0b3IiLCJjb2xsaXNpb24iLCJfdXBkYXRlQ29tcG91bmQiLCJfZGlydHlXb3JsZCIsImRpcnR5IiwiX2RpcnR5TG9jYWwiLCJmb3JFYWNoIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtIiwiYm9keUNvbXBvbmVudCIsImFjdGl2YXRlIiwiZ2V0U2hhcGVQb3NpdGlvbiIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJsbyIsImNvcHkiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJhZGQiLCJnZXRTaGFwZVJvdGF0aW9uIiwibXVsIiwib25FbmFibGUiLCJyZXNvdXJjZSIsImVuYWJsZWQiLCJlbmFibGVTaW11bGF0aW9uIiwidHJhbnNmb3JtIiwiX2dldE5vZGVUcmFuc2Zvcm0iLCJhZGRDaGlsZFNoYXBlIiwiZGVzdHJveSIsInRyaWdnZXIiLCJlbmFibGUiLCJvbkRpc2FibGUiLCJkaXNhYmxlU2ltdWxhdGlvbiIsIl9kZXN0cm95aW5nIiwiX3JlbW92ZUNvbXBvdW5kQ2hpbGQiLCJkaXNhYmxlIiwib25CZWZvcmVSZW1vdmUiLCJFVkVOVF9DT05UQUNUIiwiRVZFTlRfQ09MTElTSU9OU1RBUlQiLCJFVkVOVF9DT0xMSVNJT05FTkQiLCJFVkVOVF9UUklHR0VSRU5URVIiLCJFVkVOVF9UUklHR0VSTEVBVkUiXSwibWFwcGluZ3MiOiI7Ozs7O0FBT0EsTUFBTUEsS0FBSyxHQUFHLElBQUlDLElBQUksRUFB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
