import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Model } from '../../../scene/model.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { CollisionComponent } from './component.js';
import { CollisionComponentData } from './data.js';
import { Trigger } from './trigger.js';

const mat4 = new Mat4();
const p1 = new Vec3();
const p2 = new Vec3();
const quat = new Quat();
const tempGraphNode = new GraphNode();
const _schema = ['enabled', 'type', 'halfExtents', 'linearOffset', 'angularOffset', 'radius', 'axis', 'height', 'asset', 'renderAsset', 'shape', 'model', 'render', 'checkVertexDuplicates'];

// Collision system implementations
class CollisionSystemImpl {
  constructor(system) {
    this.system = system;
  }

  // Called before the call to system.super.initializeComponentData is made
  beforeInitialize(component, data) {
    data.shape = null;
    data.model = new Model();
    data.model.graph = new GraphNode();
  }

  // Called after the call to system.super.initializeComponentData is made
  afterInitialize(component, data) {
    this.recreatePhysicalShapes(component);
    component.data.initialized = true;
  }

  // Called when a collision component changes type in order to recreate debug and physical shapes
  reset(component, data) {
    this.beforeInitialize(component, data);
    this.afterInitialize(component, data);
  }

  // Re-creates rigid bodies / triggers
  recreatePhysicalShapes(component) {
    const entity = component.entity;
    const data = component.data;
    if (typeof Ammo !== 'undefined') {
      if (entity.trigger) {
        entity.trigger.destroy();
        delete entity.trigger;
      }
      if (data.shape) {
        if (component._compoundParent) {
          this.system._removeCompoundChild(component._compoundParent, data.shape);
          if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
        }
        this.destroyShape(data);
      }
      data.shape = this.createPhysicalShape(component.entity, data);
      const firstCompoundChild = !component._compoundParent;
      if (data.type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
        component._compoundParent = component;
        entity.forEach(this._addEachDescendant, component);
      } else if (data.type !== 'compound') {
        if (component._compoundParent && component === component._compoundParent) {
          entity.forEach(this.system.implementations.compound._updateEachDescendant, component);
        }
        if (!component.rigidbody) {
          component._compoundParent = null;
          let parent = entity.parent;
          while (parent) {
            if (parent.collision && parent.collision.type === 'compound') {
              component._compoundParent = parent.collision;
              break;
            }
            parent = parent.parent;
          }
        }
      }
      if (component._compoundParent) {
        if (component !== component._compoundParent) {
          if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
            this.system.recreatePhysicalShapes(component._compoundParent);
          } else {
            this.system.updateCompoundChildTransform(entity);
            if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
          }
        }
      }
      if (entity.rigidbody) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody();
        if (entity.enabled && entity.rigidbody.enabled) {
          entity.rigidbody.enableSimulation();
        }
      } else if (!component._compoundParent) {
        if (!entity.trigger) {
          entity.trigger = new Trigger(this.system.app, component, data);
        } else {
          entity.trigger.initialize(data);
        }
      }
    }
  }

  // Creates a physical shape for the collision. This consists
  // of the actual shape that will be used for the rigid bodies / triggers of
  // the collision.
  createPhysicalShape(entity, data) {
    return undefined;
  }
  updateTransform(component, position, rotation, scale) {
    if (component.entity.trigger) {
      component.entity.trigger.updateTransform();
    }
  }
  destroyShape(data) {
    if (data.shape) {
      Ammo.destroy(data.shape);
      data.shape = null;
    }
  }
  beforeRemove(entity, component) {
    if (component.data.shape) {
      if (component._compoundParent && !component._compoundParent.entity._destroying) {
        this.system._removeCompoundChild(component._compoundParent, component.data.shape);
        if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
      }
      component._compoundParent = null;
      this.destroyShape(component.data);
    }
  }

  // Called when the collision is removed
  remove(entity, data) {
    if (entity.rigidbody && entity.rigidbody.body) {
      entity.rigidbody.disableSimulation();
    }
    if (entity.trigger) {
      entity.trigger.destroy();
      delete entity.trigger;
    }
  }

  // Called when the collision is cloned to another entity
  clone(entity, clone) {
    const src = this.system.store[entity.getGuid()];
    const data = {
      enabled: src.data.enabled,
      type: src.data.type,
      halfExtents: [src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z],
      linearOffset: [src.data.linearOffset.x, src.data.linearOffset.y, src.data.linearOffset.z],
      angularOffset: [src.data.angularOffset.x, src.data.angularOffset.y, src.data.angularOffset.z, src.data.angularOffset.w],
      radius: src.data.radius,
      axis: src.data.axis,
      height: src.data.height,
      asset: src.data.asset,
      renderAsset: src.data.renderAsset,
      model: src.data.model,
      render: src.data.render,
      checkVertexDuplicates: src.data.checkVertexDuplicates
    };
    return this.system.addComponent(clone, data);
  }
}

// Box Collision System
class CollisionBoxSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      const he = data.halfExtents;
      const ammoHe = new Ammo.btVector3(he ? he.x : 0.5, he ? he.y : 0.5, he ? he.z : 0.5);
      const shape = new Ammo.btBoxShape(ammoHe);
      Ammo.destroy(ammoHe);
      return shape;
    }
    return undefined;
  }
}

// Sphere Collision System
class CollisionSphereSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      return new Ammo.btSphereShape(data.radius);
    }
    return undefined;
  }
}

// Capsule Collision System
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis, _data$radius, _data$height;
    const axis = (_data$axis = data.axis) != null ? _data$axis : 1;
    const radius = (_data$radius = data.radius) != null ? _data$radius : 0.5;
    const height = Math.max(((_data$height = data.height) != null ? _data$height : 2) - 2 * radius, 0);
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          shape = new Ammo.btCapsuleShapeX(radius, height);
          break;
        case 1:
          shape = new Ammo.btCapsuleShape(radius, height);
          break;
        case 2:
          shape = new Ammo.btCapsuleShapeZ(radius, height);
          break;
      }
    }
    return shape;
  }
}

// Cylinder Collision System
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis2, _data$radius2, _data$height2;
    const axis = (_data$axis2 = data.axis) != null ? _data$axis2 : 1;
    const radius = (_data$radius2 = data.radius) != null ? _data$radius2 : 0.5;
    const height = (_data$height2 = data.height) != null ? _data$height2 : 1;
    let halfExtents = null;
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
          shape = new Ammo.btCylinderShapeX(halfExtents);
          break;
        case 1:
          halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
          shape = new Ammo.btCylinderShape(halfExtents);
          break;
        case 2:
          halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
          shape = new Ammo.btCylinderShapeZ(halfExtents);
          break;
      }
    }
    if (halfExtents) Ammo.destroy(halfExtents);
    return shape;
  }
}

// Cone Collision System
class CollisionConeSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis3, _data$radius3, _data$height3;
    const axis = (_data$axis3 = data.axis) != null ? _data$axis3 : 1;
    const radius = (_data$radius3 = data.radius) != null ? _data$radius3 : 0.5;
    const height = (_data$height3 = data.height) != null ? _data$height3 : 1;
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          shape = new Ammo.btConeShapeX(radius, height);
          break;
        case 1:
          shape = new Ammo.btConeShape(radius, height);
          break;
        case 2:
          shape = new Ammo.btConeShapeZ(radius, height);
          break;
      }
    }
    return shape;
  }
}

// Mesh Collision System
class CollisionMeshSystemImpl extends CollisionSystemImpl {
  // override for the mesh implementation because the asset model needs
  // special handling
  beforeInitialize(component, data) {}
  createAmmoMesh(mesh, node, shape, checkDupes = true) {
    const system = this.system;
    let triMesh;
    if (system._triMeshCache[mesh.id]) {
      triMesh = system._triMeshCache[mesh.id];
    } else {
      const vb = mesh.vertexBuffer;
      const format = vb.getFormat();
      let stride, positions;
      for (let _i = 0; _i < format.elements.length; _i++) {
        const element = format.elements[_i];
        if (element.name === SEMANTIC_POSITION) {
          positions = new Float32Array(vb.lock(), element.offset);
          stride = element.stride / 4;
          break;
        }
      }
      const indices = [];
      mesh.getIndices(indices);
      const numTriangles = mesh.primitive[0].count / 3;
      const v1 = new Ammo.btVector3();
      let i1, i2, i3;
      const base = mesh.primitive[0].base;
      triMesh = new Ammo.btTriangleMesh();
      system._triMeshCache[mesh.id] = triMesh;
      const vertexCache = new Map();
      const indexedArray = triMesh.getIndexedMeshArray();
      indexedArray.at(0).m_numTriangles = numTriangles;
      const addVertex = index => {
        const x = positions[index * stride];
        const y = positions[index * stride + 1];
        const z = positions[index * stride + 2];
        let idx;
        if (checkDupes) {
          const str = `${x}:${y}:${z}`;
          idx = vertexCache.get(str);
          if (idx !== undefined) {
            return idx;
          }
          v1.setValue(x, y, z);
          idx = triMesh.findOrAddVertex(v1, false);
          vertexCache.set(str, idx);
        } else {
          v1.setValue(x, y, z);
          idx = triMesh.findOrAddVertex(v1, false);
        }
        return idx;
      };
      for (var i = 0; i < numTriangles; i++) {
        i1 = addVertex(indices[base + i * 3]);
        i2 = addVertex(indices[base + i * 3 + 1]);
        i3 = addVertex(indices[base + i * 3 + 2]);
        triMesh.addIndex(i1);
        triMesh.addIndex(i2);
        triMesh.addIndex(i3);
      }
      Ammo.destroy(v1);
    }
    const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, true /* useQuantizedAabbCompression */);

    const scaling = system._getNodeScaling(node);
    triMeshShape.setLocalScaling(scaling);
    Ammo.destroy(scaling);
    const transform = system._getNodeTransform(node);
    shape.addChildShape(transform, triMeshShape);
    Ammo.destroy(transform);
  }
  createPhysicalShape(entity, data) {
    if (typeof Ammo === 'undefined') return undefined;
    if (data.model || data.render) {
      const shape = new Ammo.btCompoundShape();
      if (data.model) {
        const meshInstances = data.model.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
          this.createAmmoMesh(meshInstances[i].mesh, meshInstances[i].node, shape, data.checkVertexDuplicates);
        }
      } else if (data.render) {
        const meshes = data.render.meshes;
        for (let i = 0; i < meshes.length; i++) {
          this.createAmmoMesh(meshes[i], tempGraphNode, shape, data.checkVertexDuplicates);
        }
      }
      const entityTransform = entity.getWorldTransform();
      const scale = entityTransform.getScale();
      const vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
      shape.setLocalScaling(vec);
      Ammo.destroy(vec);
      return shape;
    }
    return undefined;
  }
  recreatePhysicalShapes(component) {
    const data = component.data;
    if (data.renderAsset || data.asset) {
      if (component.enabled && component.entity.enabled) {
        this.loadAsset(component, data.renderAsset || data.asset, data.renderAsset ? 'render' : 'model');
        return;
      }
    }
    this.doRecreatePhysicalShape(component);
  }
  loadAsset(component, id, property) {
    const data = component.data;
    const assets = this.system.app.assets;
    const previousPropertyValue = data[property];
    const onAssetFullyReady = asset => {
      if (data[property] !== previousPropertyValue) {
        // the asset has changed since we started loading it, so ignore this callback
        return;
      }
      data[property] = asset.resource;
      this.doRecreatePhysicalShape(component);
    };
    const loadAndHandleAsset = asset => {
      asset.ready(asset => {
        if (asset.data.containerAsset) {
          const containerAsset = assets.get(asset.data.containerAsset);
          if (containerAsset.loaded) {
            onAssetFullyReady(asset);
          } else {
            containerAsset.ready(() => {
              onAssetFullyReady(asset);
            });
            assets.load(containerAsset);
          }
        } else {
          onAssetFullyReady(asset);
        }
      });
      assets.load(asset);
    };
    const asset = assets.get(id);
    if (asset) {
      loadAndHandleAsset(asset);
    } else {
      assets.once('add:' + id, loadAndHandleAsset);
    }
  }
  doRecreatePhysicalShape(component) {
    const entity = component.entity;
    const data = component.data;
    if (data.model || data.render) {
      this.destroyShape(data);
      data.shape = this.createPhysicalShape(entity, data);
      if (entity.rigidbody) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody();
        if (entity.enabled && entity.rigidbody.enabled) {
          entity.rigidbody.enableSimulation();
        }
      } else {
        if (!entity.trigger) {
          entity.trigger = new Trigger(this.system.app, component, data);
        } else {
          entity.trigger.initialize(data);
        }
      }
    } else {
      this.beforeRemove(entity, component);
      this.remove(entity, data);
    }
  }
  updateTransform(component, position, rotation, scale) {
    if (component.shape) {
      const entityTransform = component.entity.getWorldTransform();
      const worldScale = entityTransform.getScale();

      // if the scale changed then recreate the shape
      const previousScale = component.shape.getLocalScaling();
      if (worldScale.x !== previousScale.x() || worldScale.y !== previousScale.y() || worldScale.z !== previousScale.z()) {
        this.doRecreatePhysicalShape(component);
      }
    }
    super.updateTransform(component, position, rotation, scale);
  }
  destroyShape(data) {
    if (!data.shape) return;
    const numShapes = data.shape.getNumChildShapes();
    for (let i = 0; i < numShapes; i++) {
      const shape = data.shape.getChildShape(i);
      Ammo.destroy(shape);
    }
    Ammo.destroy(data.shape);
    data.shape = null;
  }
}

// Compound Collision System
class CollisionCompoundSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      return new Ammo.btCompoundShape();
    }
    return undefined;
  }
  _addEachDescendant(entity) {
    if (!entity.collision || entity.rigidbody) return;
    entity.collision._compoundParent = this;
    if (entity !== this.entity) {
      entity.collision.system.recreatePhysicalShapes(entity.collision);
    }
  }
  _updateEachDescendant(entity) {
    if (!entity.collision) return;
    if (entity.collision._compoundParent !== this) return;
    entity.collision._compoundParent = null;
    if (entity !== this.entity && !entity.rigidbody) {
      entity.collision.system.recreatePhysicalShapes(entity.collision);
    }
  }
  _updateEachDescendantTransform(entity) {
    if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent) return;
    this.collision.system.updateCompoundChildTransform(entity);
  }
}

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @augments ComponentSystem
 * @category Physics
 */
class CollisionComponentSystem extends ComponentSystem {
  /**
   * Creates a new CollisionComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'collision';
    this.ComponentType = CollisionComponent;
    this.DataType = CollisionComponentData;
    this.schema = _schema;
    this.implementations = {};
    this._triMeshCache = {};
    this.on('beforeremove', this.onBeforeRemove, this);
    this.on('remove', this.onRemove, this);
  }
  initializeComponentData(component, _data, properties) {
    properties = ['type', 'halfExtents', 'radius', 'axis', 'height', 'shape', 'model', 'asset', 'render', 'renderAsset', 'enabled', 'linearOffset', 'angularOffset', 'checkVertexDuplicates'];

    // duplicate the input data because we are modifying it
    const data = {};
    for (let i = 0, len = properties.length; i < len; i++) {
      const property = properties[i];
      data[property] = _data[property];
    }

    // asset takes priority over model
    // but they are both trying to change the mesh
    // so remove one of them to avoid conflicts
    let idx;
    if (_data.hasOwnProperty('asset')) {
      idx = properties.indexOf('model');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
      idx = properties.indexOf('render');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
    } else if (_data.hasOwnProperty('model')) {
      idx = properties.indexOf('asset');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
    }
    if (!data.type) {
      data.type = component.data.type;
    }
    component.data.type = data.type;
    if (Array.isArray(data.halfExtents)) {
      data.halfExtents = new Vec3(data.halfExtents);
    }
    if (Array.isArray(data.linearOffset)) {
      data.linearOffset = new Vec3(data.linearOffset);
    }
    if (Array.isArray(data.angularOffset)) {
      // Allow for euler angles to be passed as a 3 length array
      const values = data.angularOffset;
      if (values.length === 3) {
        data.angularOffset = new Quat().setFromEulerAngles(values[0], values[1], values[2]);
      } else {
        data.angularOffset = new Quat(data.angularOffset);
      }
    }
    const impl = this._createImplementation(data.type);
    impl.beforeInitialize(component, data);
    super.initializeComponentData(component, data, properties);
    impl.afterInitialize(component, data);
  }

  // Creates an implementation based on the collision type and caches it
  // in an internal implementations structure, before returning it.
  _createImplementation(type) {
    if (this.implementations[type] === undefined) {
      let impl;
      switch (type) {
        case 'box':
          impl = new CollisionBoxSystemImpl(this);
          break;
        case 'sphere':
          impl = new CollisionSphereSystemImpl(this);
          break;
        case 'capsule':
          impl = new CollisionCapsuleSystemImpl(this);
          break;
        case 'cylinder':
          impl = new CollisionCylinderSystemImpl(this);
          break;
        case 'cone':
          impl = new CollisionConeSystemImpl(this);
          break;
        case 'mesh':
          impl = new CollisionMeshSystemImpl(this);
          break;
        case 'compound':
          impl = new CollisionCompoundSystemImpl(this);
          break;
        default:
          Debug.error(`_createImplementation: Invalid collision system type: ${type}`);
      }
      this.implementations[type] = impl;
    }
    return this.implementations[type];
  }

  // Gets an existing implementation for the specified entity
  _getImplementation(entity) {
    return this.implementations[entity.collision.data.type];
  }
  cloneComponent(entity, clone) {
    return this._getImplementation(entity).clone(entity, clone);
  }
  onBeforeRemove(entity, component) {
    this.implementations[component.data.type].beforeRemove(entity, component);
    component.onBeforeRemove();
  }
  onRemove(entity, data) {
    this.implementations[data.type].remove(entity, data);
  }
  updateCompoundChildTransform(entity) {
    // TODO
    // use updateChildTransform once it is exposed in ammo.js

    this._removeCompoundChild(entity.collision._compoundParent, entity.collision.data.shape);
    if (entity.enabled && entity.collision.enabled) {
      const transform = this._getNodeTransform(entity, entity.collision._compoundParent.entity);
      entity.collision._compoundParent.shape.addChildShape(transform, entity.collision.data.shape);
      Ammo.destroy(transform);
    }
  }
  _removeCompoundChild(collision, shape) {
    if (collision.shape.removeChildShape) {
      collision.shape.removeChildShape(shape);
    } else {
      const ind = collision._getCompoundChildShapeIndex(shape);
      if (ind !== null) {
        collision.shape.removeChildShapeByIndex(ind);
      }
    }
  }
  onTransformChanged(component, position, rotation, scale) {
    this.implementations[component.data.type].updateTransform(component, position, rotation, scale);
  }

  // Destroys the previous collision type and creates a new one based on the new type provided
  changeType(component, previousType, newType) {
    this.implementations[previousType].beforeRemove(component.entity, component);
    this.implementations[previousType].remove(component.entity, component.data);
    this._createImplementation(newType).reset(component, component.data);
  }

  // Recreates rigid bodies or triggers for the specified component
  recreatePhysicalShapes(component) {
    this.implementations[component.data.type].recreatePhysicalShapes(component);
  }
  _calculateNodeRelativeTransform(node, relative) {
    if (node === relative) {
      const scale = node.getWorldTransform().getScale();
      mat4.setScale(scale.x, scale.y, scale.z);
    } else {
      this._calculateNodeRelativeTransform(node.parent, relative);
      mat4.mul(node.getLocalTransform());
    }
  }
  _getNodeScaling(node) {
    const wtm = node.getWorldTransform();
    const scl = wtm.getScale();
    return new Ammo.btVector3(scl.x, scl.y, scl.z);
  }
  _getNodeTransform(node, relative) {
    let pos, rot;
    if (relative) {
      this._calculateNodeRelativeTransform(node, relative);
      pos = p1;
      rot = quat;
      mat4.getTranslation(pos);
      rot.setFromMat4(mat4);
    } else {
      pos = node.getPosition();
      rot = node.getRotation();
    }
    const ammoQuat = new Ammo.btQuaternion();
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const origin = transform.getOrigin();
    const component = node.collision;
    if (component && component._hasOffset) {
      const lo = component.data.linearOffset;
      const ao = component.data.angularOffset;
      const newOrigin = p2;
      quat.copy(rot).transformVector(lo, newOrigin);
      newOrigin.add(pos);
      quat.copy(rot).mul(ao);
      origin.setValue(newOrigin.x, newOrigin.y, newOrigin.z);
      ammoQuat.setValue(quat.x, quat.y, quat.z, quat.w);
    } else {
      origin.setValue(pos.x, pos.y, pos.z);
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    }
    transform.setRotation(ammoQuat);
    Ammo.destroy(ammoQuat);
    Ammo.destroy(origin);
    return transform;
  }
  destroy() {
    for (const key in this._triMeshCache) {
      Ammo.destroy(this._triMeshCache[key]);
    }
    this._triMeshCache = null;
    super.destroy();
  }
}
Component._buildAccessors(CollisionComponent.prototype, _schema);

export { CollisionComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuaW1wb3J0IHsgVHJpZ2dlciB9IGZyb20gJy4vdHJpZ2dlci5qcyc7XG5cbmNvbnN0IG1hdDQgPSBuZXcgTWF0NCgpO1xuY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuY29uc3QgcDIgPSBuZXcgVmVjMygpO1xuY29uc3QgcXVhdCA9IG5ldyBRdWF0KCk7XG5jb25zdCB0ZW1wR3JhcGhOb2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuXG5jb25zdCBfc2NoZW1hID0gW1xuICAgICdlbmFibGVkJyxcbiAgICAndHlwZScsXG4gICAgJ2hhbGZFeHRlbnRzJyxcbiAgICAnbGluZWFyT2Zmc2V0JyxcbiAgICAnYW5ndWxhck9mZnNldCcsXG4gICAgJ3JhZGl1cycsXG4gICAgJ2F4aXMnLFxuICAgICdoZWlnaHQnLFxuICAgICdhc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0JyxcbiAgICAnc2hhcGUnLFxuICAgICdtb2RlbCcsXG4gICAgJ3JlbmRlcicsXG4gICAgJ2NoZWNrVmVydGV4RHVwbGljYXRlcydcbl07XG5cbi8vIENvbGxpc2lvbiBzeXN0ZW0gaW1wbGVtZW50YXRpb25zXG5jbGFzcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0pIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0gPSBzeXN0ZW07XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIGJlZm9yZSB0aGUgY2FsbCB0byBzeXN0ZW0uc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEgaXMgbWFkZVxuICAgIGJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGRhdGEubW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgZGF0YS5tb2RlbC5ncmFwaCA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYWZ0ZXIgdGhlIGNhbGwgdG8gc3lzdGVtLnN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhIGlzIG1hZGVcbiAgICBhZnRlckluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpO1xuICAgICAgICBjb21wb25lbnQuZGF0YS5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gYSBjb2xsaXNpb24gY29tcG9uZW50IGNoYW5nZXMgdHlwZSBpbiBvcmRlciB0byByZWNyZWF0ZSBkZWJ1ZyBhbmQgcGh5c2ljYWwgc2hhcGVzXG4gICAgcmVzZXQoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICB0aGlzLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlLWNyZWF0ZXMgcmlnaWQgYm9kaWVzIC8gdHJpZ2dlcnNcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcmVtb3ZlQ29tcG91bmRDaGlsZChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LCBkYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95U2hhcGUoZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50LmVudGl0eSwgZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Q29tcG91bmRDaGlsZCA9ICFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50O1xuXG4gICAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnY29tcG91bmQnICYmICghY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCB8fCBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IGNvbXBvbmVudDtcblxuICAgICAgICAgICAgICAgIGVudGl0eS5mb3JFYWNoKHRoaXMuX2FkZEVhY2hEZXNjZW5kYW50LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnR5cGUgIT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCAmJiBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmZvckVhY2godGhpcy5zeXN0ZW0uaW1wbGVtZW50YXRpb25zLmNvbXBvdW5kLl91cGRhdGVFYWNoRGVzY2VuZGFudCwgY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnQgPSBlbnRpdHkucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50LmNvbGxpc2lvbiAmJiBwYXJlbnQuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ID0gcGFyZW50LmNvbGxpc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCAhPT0gY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmlyc3RDb21wb3VuZENoaWxkICYmIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyID0gbmV3IFRyaWdnZXIodGhpcy5zeXN0ZW0uYXBwLCBjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmluaXRpYWxpemUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlcyBhIHBoeXNpY2FsIHNoYXBlIGZvciB0aGUgY29sbGlzaW9uLiBUaGlzIGNvbnNpc3RzXG4gICAgLy8gb2YgdGhlIGFjdHVhbCBzaGFwZSB0aGF0IHdpbGwgYmUgdXNlZCBmb3IgdGhlIHJpZ2lkIGJvZGllcyAvIHRyaWdnZXJzIG9mXG4gICAgLy8gdGhlIGNvbGxpc2lvbi5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgY29tcG9uZW50LmVudGl0eS50cmlnZ2VyLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVzdHJveVNoYXBlKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShkYXRhLnNoYXBlKTtcbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZGF0YS5zaGFwZSkge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgJiYgIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5Ll9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3JlbW92ZUNvbXBvdW5kQ2hpbGQoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCwgY29tcG9uZW50LmRhdGEuc2hhcGUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFwZShjb21wb25lbnQuZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiB0aGUgY29sbGlzaW9uIGlzIHJlbW92ZWRcbiAgICByZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmIChlbnRpdHkucmlnaWRib2R5ICYmIGVudGl0eS5yaWdpZGJvZHkuYm9keSkge1xuICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5kZXN0cm95KCk7XG4gICAgICAgICAgICBkZWxldGUgZW50aXR5LnRyaWdnZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiB0aGUgY29sbGlzaW9uIGlzIGNsb25lZCB0byBhbm90aGVyIGVudGl0eVxuICAgIGNsb25lKGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3Qgc3JjID0gdGhpcy5zeXN0ZW0uc3RvcmVbZW50aXR5LmdldEd1aWQoKV07XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNyYy5kYXRhLmVuYWJsZWQsXG4gICAgICAgICAgICB0eXBlOiBzcmMuZGF0YS50eXBlLFxuICAgICAgICAgICAgaGFsZkV4dGVudHM6IFtzcmMuZGF0YS5oYWxmRXh0ZW50cy54LCBzcmMuZGF0YS5oYWxmRXh0ZW50cy55LCBzcmMuZGF0YS5oYWxmRXh0ZW50cy56XSxcbiAgICAgICAgICAgIGxpbmVhck9mZnNldDogW3NyYy5kYXRhLmxpbmVhck9mZnNldC54LCBzcmMuZGF0YS5saW5lYXJPZmZzZXQueSwgc3JjLmRhdGEubGluZWFyT2Zmc2V0LnpdLFxuICAgICAgICAgICAgYW5ndWxhck9mZnNldDogW3NyYy5kYXRhLmFuZ3VsYXJPZmZzZXQueCwgc3JjLmRhdGEuYW5ndWxhck9mZnNldC55LCBzcmMuZGF0YS5hbmd1bGFyT2Zmc2V0LnosIHNyYy5kYXRhLmFuZ3VsYXJPZmZzZXQud10sXG4gICAgICAgICAgICByYWRpdXM6IHNyYy5kYXRhLnJhZGl1cyxcbiAgICAgICAgICAgIGF4aXM6IHNyYy5kYXRhLmF4aXMsXG4gICAgICAgICAgICBoZWlnaHQ6IHNyYy5kYXRhLmhlaWdodCxcbiAgICAgICAgICAgIGFzc2V0OiBzcmMuZGF0YS5hc3NldCxcbiAgICAgICAgICAgIHJlbmRlckFzc2V0OiBzcmMuZGF0YS5yZW5kZXJBc3NldCxcbiAgICAgICAgICAgIG1vZGVsOiBzcmMuZGF0YS5tb2RlbCxcbiAgICAgICAgICAgIHJlbmRlcjogc3JjLmRhdGEucmVuZGVyLFxuICAgICAgICAgICAgY2hlY2tWZXJ0ZXhEdXBsaWNhdGVzOiBzcmMuZGF0YS5jaGVja1ZlcnRleER1cGxpY2F0ZXNcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcy5zeXN0ZW0uYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcbiAgICB9XG59XG5cbi8vIEJveCBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25Cb3hTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgaGUgPSBkYXRhLmhhbGZFeHRlbnRzO1xuICAgICAgICAgICAgY29uc3QgYW1tb0hlID0gbmV3IEFtbW8uYnRWZWN0b3IzKGhlID8gaGUueCA6IDAuNSwgaGUgPyBoZS55IDogMC41LCBoZSA/IGhlLnogOiAwLjUpO1xuICAgICAgICAgICAgY29uc3Qgc2hhcGUgPSBuZXcgQW1tby5idEJveFNoYXBlKGFtbW9IZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koYW1tb0hlKTtcbiAgICAgICAgICAgIHJldHVybiBzaGFwZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLy8gU3BoZXJlIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvblNwaGVyZVN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFtbW8uYnRTcGhlcmVTaGFwZShkYXRhLnJhZGl1cyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8vIENhcHN1bGUgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uQ2Fwc3VsZVN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBjb25zdCBheGlzID0gZGF0YS5heGlzID8/IDE7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IGRhdGEucmFkaXVzID8/IDAuNTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoKGRhdGEuaGVpZ2h0ID8/IDIpIC0gMiAqIHJhZGl1cywgMCk7XG5cbiAgICAgICAgbGV0IHNoYXBlID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGF4aXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGVYKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q2Fwc3VsZVNoYXBlKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q2Fwc3VsZVNoYXBlWihyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgIH1cbn1cblxuLy8gQ3lsaW5kZXIgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uQ3lsaW5kZXJTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgY29uc3QgYXhpcyA9IGRhdGEuYXhpcyA/PyAxO1xuICAgICAgICBjb25zdCByYWRpdXMgPSBkYXRhLnJhZGl1cyA/PyAwLjU7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGRhdGEuaGVpZ2h0ID8/IDE7XG5cbiAgICAgICAgbGV0IGhhbGZFeHRlbnRzID0gbnVsbDtcbiAgICAgICAgbGV0IHNoYXBlID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGF4aXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGhlaWdodCAqIDAuNSwgcmFkaXVzLCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZVgoaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKHJhZGl1cywgaGVpZ2h0ICogMC41LCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZShoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgaGFsZkV4dGVudHMgPSBuZXcgQW1tby5idFZlY3RvcjMocmFkaXVzLCByYWRpdXMsIGhlaWdodCAqIDAuNSk7XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDeWxpbmRlclNoYXBlWihoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbGZFeHRlbnRzKVxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGhhbGZFeHRlbnRzKTtcblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDb25lIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgY29uc3QgYXhpcyA9IGRhdGEuYXhpcyA/PyAxO1xuICAgICAgICBjb25zdCByYWRpdXMgPSBkYXRhLnJhZGl1cyA/PyAwLjU7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGRhdGEuaGVpZ2h0ID8/IDE7XG5cbiAgICAgICAgbGV0IHNoYXBlID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGF4aXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDb25lU2hhcGVYKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29uZVNoYXBlKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29uZVNoYXBlWihyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgIH1cbn1cblxuLy8gTWVzaCBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25NZXNoU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIC8vIG92ZXJyaWRlIGZvciB0aGUgbWVzaCBpbXBsZW1lbnRhdGlvbiBiZWNhdXNlIHRoZSBhc3NldCBtb2RlbCBuZWVkc1xuICAgIC8vIHNwZWNpYWwgaGFuZGxpbmdcbiAgICBiZWZvcmVJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSkge31cblxuICAgIGNyZWF0ZUFtbW9NZXNoKG1lc2gsIG5vZGUsIHNoYXBlLCBjaGVja0R1cGVzID0gdHJ1ZSkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcbiAgICAgICAgbGV0IHRyaU1lc2g7XG5cbiAgICAgICAgaWYgKHN5c3RlbS5fdHJpTWVzaENhY2hlW21lc2guaWRdKSB7XG4gICAgICAgICAgICB0cmlNZXNoID0gc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB2YiA9IG1lc2gudmVydGV4QnVmZmVyO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSB2Yi5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgIGxldCBzdHJpZGUsIHBvc2l0aW9ucztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19QT1NJVElPTikge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KHZiLmxvY2soKSwgZWxlbWVudC5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBzdHJpZGUgPSBlbGVtZW50LnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgICAgICAgICAgbWVzaC5nZXRJbmRpY2VzKGluZGljZXMpO1xuICAgICAgICAgICAgY29uc3QgbnVtVHJpYW5nbGVzID0gbWVzaC5wcmltaXRpdmVbMF0uY291bnQgLyAzO1xuXG4gICAgICAgICAgICBjb25zdCB2MSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgbGV0IGkxLCBpMiwgaTM7XG5cbiAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBtZXNoLnByaW1pdGl2ZVswXS5iYXNlO1xuICAgICAgICAgICAgdHJpTWVzaCA9IG5ldyBBbW1vLmJ0VHJpYW5nbGVNZXNoKCk7XG4gICAgICAgICAgICBzeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSA9IHRyaU1lc2g7XG5cbiAgICAgICAgICAgIGNvbnN0IHZlcnRleENhY2hlID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgY29uc3QgaW5kZXhlZEFycmF5ID0gdHJpTWVzaC5nZXRJbmRleGVkTWVzaEFycmF5KCk7XG4gICAgICAgICAgICBpbmRleGVkQXJyYXkuYXQoMCkubV9udW1UcmlhbmdsZXMgPSBudW1UcmlhbmdsZXM7XG5cbiAgICAgICAgICAgIGNvbnN0IGFkZFZlcnRleCA9IChpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBwb3NpdGlvbnNbaW5kZXggKiBzdHJpZGVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBwb3NpdGlvbnNbaW5kZXggKiBzdHJpZGUgKyAxXTtcbiAgICAgICAgICAgICAgICBjb25zdCB6ID0gcG9zaXRpb25zW2luZGV4ICogc3RyaWRlICsgMl07XG5cbiAgICAgICAgICAgICAgICBsZXQgaWR4O1xuICAgICAgICAgICAgICAgIGlmIChjaGVja0R1cGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0ciA9IGAke3h9OiR7eX06JHt6fWA7XG5cbiAgICAgICAgICAgICAgICAgICAgaWR4ID0gdmVydGV4Q2FjaGUuZ2V0KHN0cik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlkeDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHYxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgICAgICAgICBpZHggPSB0cmlNZXNoLmZpbmRPckFkZFZlcnRleCh2MSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB2ZXJ0ZXhDYWNoZS5zZXQoc3RyLCBpZHgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHYxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgICAgICAgICBpZHggPSB0cmlNZXNoLmZpbmRPckFkZFZlcnRleCh2MSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBpZHg7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bVRyaWFuZ2xlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaTEgPSBhZGRWZXJ0ZXgoaW5kaWNlc1tiYXNlICsgaSAqIDNdKTtcbiAgICAgICAgICAgICAgICBpMiA9IGFkZFZlcnRleChpbmRpY2VzW2Jhc2UgKyBpICogMyArIDFdKTtcbiAgICAgICAgICAgICAgICBpMyA9IGFkZFZlcnRleChpbmRpY2VzW2Jhc2UgKyBpICogMyArIDJdKTtcblxuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkSW5kZXgoaTEpO1xuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkSW5kZXgoaTIpO1xuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkSW5kZXgoaTMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodjEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHJpTWVzaFNoYXBlID0gbmV3IEFtbW8uYnRCdmhUcmlhbmdsZU1lc2hTaGFwZSh0cmlNZXNoLCB0cnVlIC8qIHVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiAqLyk7XG5cbiAgICAgICAgY29uc3Qgc2NhbGluZyA9IHN5c3RlbS5fZ2V0Tm9kZVNjYWxpbmcobm9kZSk7XG4gICAgICAgIHRyaU1lc2hTaGFwZS5zZXRMb2NhbFNjYWxpbmcoc2NhbGluZyk7XG4gICAgICAgIEFtbW8uZGVzdHJveShzY2FsaW5nKTtcblxuICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSBzeXN0ZW0uX2dldE5vZGVUcmFuc2Zvcm0obm9kZSk7XG4gICAgICAgIHNoYXBlLmFkZENoaWxkU2hhcGUodHJhbnNmb3JtLCB0cmlNZXNoU2hhcGUpO1xuICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICB9XG5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChkYXRhLm1vZGVsIHx8IGRhdGEucmVuZGVyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gbmV3IEFtbW8uYnRDb21wb3VuZFNoYXBlKCk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGRhdGEubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoSW5zdGFuY2VzW2ldLm1lc2gsIG1lc2hJbnN0YW5jZXNbaV0ubm9kZSwgc2hhcGUsIGRhdGEuY2hlY2tWZXJ0ZXhEdXBsaWNhdGVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEucmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaGVzID0gZGF0YS5yZW5kZXIubWVzaGVzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlQW1tb01lc2gobWVzaGVzW2ldLCB0ZW1wR3JhcGhOb2RlLCBzaGFwZSwgZGF0YS5jaGVja1ZlcnRleER1cGxpY2F0ZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZW50aXR5VHJhbnNmb3JtID0gZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBjb25zdCBzY2FsZSA9IGVudGl0eVRyYW5zZm9ybS5nZXRTY2FsZSgpO1xuICAgICAgICAgICAgY29uc3QgdmVjID0gbmV3IEFtbW8uYnRWZWN0b3IzKHNjYWxlLngsIHNjYWxlLnksIHNjYWxlLnopO1xuICAgICAgICAgICAgc2hhcGUuc2V0TG9jYWxTY2FsaW5nKHZlYyk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodmVjKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKGRhdGEucmVuZGVyQXNzZXQgfHwgZGF0YS5hc3NldCkge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkICYmIGNvbXBvbmVudC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZEFzc2V0KFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEucmVuZGVyQXNzZXQgfHwgZGF0YS5hc3NldCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5yZW5kZXJBc3NldCA/ICdyZW5kZXInIDogJ21vZGVsJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgIH1cblxuICAgIGxvYWRBc3NldChjb21wb25lbnQsIGlkLCBwcm9wZXJ0eSkge1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGNvbnN0IHByZXZpb3VzUHJvcGVydHlWYWx1ZSA9IGRhdGFbcHJvcGVydHldO1xuXG4gICAgICAgIGNvbnN0IG9uQXNzZXRGdWxseVJlYWR5ID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YVtwcm9wZXJ0eV0gIT09IHByZXZpb3VzUHJvcGVydHlWYWx1ZSkge1xuICAgICAgICAgICAgICAgIC8vIHRoZSBhc3NldCBoYXMgY2hhbmdlZCBzaW5jZSB3ZSBzdGFydGVkIGxvYWRpbmcgaXQsIHNvIGlnbm9yZSB0aGlzIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBsb2FkQW5kSGFuZGxlQXNzZXQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgIGFzc2V0LnJlYWR5KChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhc3NldC5kYXRhLmNvbnRhaW5lckFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lckFzc2V0ID0gYXNzZXRzLmdldChhc3NldC5kYXRhLmNvbnRhaW5lckFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRhaW5lckFzc2V0LmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25Bc3NldEZ1bGx5UmVhZHkoYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyQXNzZXQucmVhZHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQXNzZXRGdWxseVJlYWR5KGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzLmxvYWQoY29udGFpbmVyQXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb25Bc3NldEZ1bGx5UmVhZHkoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBhc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KGlkKTtcbiAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICBsb2FkQW5kSGFuZGxlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgaWQsIGxvYWRBbmRIYW5kbGVBc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gY29tcG9uZW50LmVudGl0eTtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuXG4gICAgICAgIGlmIChkYXRhLm1vZGVsIHx8IGRhdGEucmVuZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFwZShkYXRhKTtcblxuICAgICAgICAgICAgZGF0YS5zaGFwZSA9IHRoaXMuY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpO1xuXG4gICAgICAgICAgICBpZiAoZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmNyZWF0ZUJvZHkoKTtcblxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuZW5hYmxlZCAmJiBlbnRpdHkucmlnaWRib2R5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyID0gbmV3IFRyaWdnZXIodGhpcy5zeXN0ZW0uYXBwLCBjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmluaXRpYWxpemUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5iZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZW50aXR5LCBkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5zaGFwZSkge1xuICAgICAgICAgICAgY29uc3QgZW50aXR5VHJhbnNmb3JtID0gY29tcG9uZW50LmVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgY29uc3Qgd29ybGRTY2FsZSA9IGVudGl0eVRyYW5zZm9ybS5nZXRTY2FsZSgpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgc2NhbGUgY2hhbmdlZCB0aGVuIHJlY3JlYXRlIHRoZSBzaGFwZVxuICAgICAgICAgICAgY29uc3QgcHJldmlvdXNTY2FsZSA9IGNvbXBvbmVudC5zaGFwZS5nZXRMb2NhbFNjYWxpbmcoKTtcbiAgICAgICAgICAgIGlmICh3b3JsZFNjYWxlLnggIT09IHByZXZpb3VzU2NhbGUueCgpIHx8XG4gICAgICAgICAgICAgICAgd29ybGRTY2FsZS55ICE9PSBwcmV2aW91c1NjYWxlLnkoKSB8fFxuICAgICAgICAgICAgICAgIHdvcmxkU2NhbGUueiAhPT0gcHJldmlvdXNTY2FsZS56KCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci51cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKTtcbiAgICB9XG5cbiAgICBkZXN0cm95U2hhcGUoZGF0YSkge1xuICAgICAgICBpZiAoIWRhdGEuc2hhcGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbnVtU2hhcGVzID0gZGF0YS5zaGFwZS5nZXROdW1DaGlsZFNoYXBlcygpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNoYXBlczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzaGFwZSA9IGRhdGEuc2hhcGUuZ2V0Q2hpbGRTaGFwZShpKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShzaGFwZSk7XG4gICAgICAgIH1cblxuICAgICAgICBBbW1vLmRlc3Ryb3koZGF0YS5zaGFwZSk7XG4gICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuICAgIH1cbn1cblxuLy8gQ29tcG91bmQgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbW1vLmJ0Q29tcG91bmRTaGFwZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgX2FkZEVhY2hEZXNjZW5kYW50KGVudGl0eSkge1xuICAgICAgICBpZiAoIWVudGl0eS5jb2xsaXNpb24gfHwgZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudCA9IHRoaXM7XG5cbiAgICAgICAgaWYgKGVudGl0eSAhPT0gdGhpcy5lbnRpdHkpIHtcbiAgICAgICAgICAgIGVudGl0eS5jb2xsaXNpb24uc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoZW50aXR5LmNvbGxpc2lvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlRWFjaERlc2NlbmRhbnQoZW50aXR5KSB7XG4gICAgICAgIGlmICghZW50aXR5LmNvbGxpc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgIT09IHRoaXMpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIGlmIChlbnRpdHkgIT09IHRoaXMuZW50aXR5ICYmICFlbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICBlbnRpdHkuY29sbGlzaW9uLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtKGVudGl0eSkge1xuICAgICAgICBpZiAoIWVudGl0eS5jb2xsaXNpb24gfHwgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgIT09IHRoaXMuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbi5zeXN0ZW0udXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybShlbnRpdHkpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBNYW5hZ2VzIGNyZWF0aW9uIG9mIHtAbGluayBDb2xsaXNpb25Db21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKiBAY2F0ZWdvcnkgUGh5c2ljc1xuICovXG5jbGFzcyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2NvbGxpc2lvbic7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gQ29sbGlzaW9uQ29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gQ29sbGlzaW9uQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnMgPSB7IH07XG5cbiAgICAgICAgdGhpcy5fdHJpTWVzaENhY2hlID0geyB9O1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25CZWZvcmVSZW1vdmUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIF9kYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIHByb3BlcnRpZXMgPSBbXG4gICAgICAgICAgICAndHlwZScsXG4gICAgICAgICAgICAnaGFsZkV4dGVudHMnLFxuICAgICAgICAgICAgJ3JhZGl1cycsXG4gICAgICAgICAgICAnYXhpcycsXG4gICAgICAgICAgICAnaGVpZ2h0JyxcbiAgICAgICAgICAgICdzaGFwZScsXG4gICAgICAgICAgICAnbW9kZWwnLFxuICAgICAgICAgICAgJ2Fzc2V0JyxcbiAgICAgICAgICAgICdyZW5kZXInLFxuICAgICAgICAgICAgJ3JlbmRlckFzc2V0JyxcbiAgICAgICAgICAgICdlbmFibGVkJyxcbiAgICAgICAgICAgICdsaW5lYXJPZmZzZXQnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJPZmZzZXQnLFxuICAgICAgICAgICAgJ2NoZWNrVmVydGV4RHVwbGljYXRlcydcbiAgICAgICAgXTtcblxuICAgICAgICAvLyBkdXBsaWNhdGUgdGhlIGlucHV0IGRhdGEgYmVjYXVzZSB3ZSBhcmUgbW9kaWZ5aW5nIGl0XG4gICAgICAgIGNvbnN0IGRhdGEgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BlcnRpZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5ID0gcHJvcGVydGllc1tpXTtcbiAgICAgICAgICAgIGRhdGFbcHJvcGVydHldID0gX2RhdGFbcHJvcGVydHldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXNzZXQgdGFrZXMgcHJpb3JpdHkgb3ZlciBtb2RlbFxuICAgICAgICAvLyBidXQgdGhleSBhcmUgYm90aCB0cnlpbmcgdG8gY2hhbmdlIHRoZSBtZXNoXG4gICAgICAgIC8vIHNvIHJlbW92ZSBvbmUgb2YgdGhlbSB0byBhdm9pZCBjb25mbGljdHNcbiAgICAgICAgbGV0IGlkeDtcbiAgICAgICAgaWYgKF9kYXRhLmhhc093blByb3BlcnR5KCdhc3NldCcpKSB7XG4gICAgICAgICAgICBpZHggPSBwcm9wZXJ0aWVzLmluZGV4T2YoJ21vZGVsJyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZHggPSBwcm9wZXJ0aWVzLmluZGV4T2YoJ3JlbmRlcicpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKF9kYXRhLmhhc093blByb3BlcnR5KCdtb2RlbCcpKSB7XG4gICAgICAgICAgICBpZHggPSBwcm9wZXJ0aWVzLmluZGV4T2YoJ2Fzc2V0Jyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWRhdGEudHlwZSkge1xuICAgICAgICAgICAgZGF0YS50eXBlID0gY29tcG9uZW50LmRhdGEudHlwZTtcbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnQuZGF0YS50eXBlID0gZGF0YS50eXBlO1xuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEuaGFsZkV4dGVudHMpKSB7XG4gICAgICAgICAgICBkYXRhLmhhbGZFeHRlbnRzID0gbmV3IFZlYzMoZGF0YS5oYWxmRXh0ZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmxpbmVhck9mZnNldCkpIHtcbiAgICAgICAgICAgIGRhdGEubGluZWFyT2Zmc2V0ID0gbmV3IFZlYzMoZGF0YS5saW5lYXJPZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YS5hbmd1bGFyT2Zmc2V0KSkge1xuICAgICAgICAgICAgLy8gQWxsb3cgZm9yIGV1bGVyIGFuZ2xlcyB0byBiZSBwYXNzZWQgYXMgYSAzIGxlbmd0aCBhcnJheVxuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gZGF0YS5hbmd1bGFyT2Zmc2V0O1xuICAgICAgICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgICAgICAgICBkYXRhLmFuZ3VsYXJPZmZzZXQgPSBuZXcgUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcyh2YWx1ZXNbMF0sIHZhbHVlc1sxXSwgdmFsdWVzWzJdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGF0YS5hbmd1bGFyT2Zmc2V0ID0gbmV3IFF1YXQoZGF0YS5hbmd1bGFyT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGltcGwgPSB0aGlzLl9jcmVhdGVJbXBsZW1lbnRhdGlvbihkYXRhLnR5cGUpO1xuICAgICAgICBpbXBsLmJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKTtcblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuXG4gICAgICAgIGltcGwuYWZ0ZXJJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlcyBhbiBpbXBsZW1lbnRhdGlvbiBiYXNlZCBvbiB0aGUgY29sbGlzaW9uIHR5cGUgYW5kIGNhY2hlcyBpdFxuICAgIC8vIGluIGFuIGludGVybmFsIGltcGxlbWVudGF0aW9ucyBzdHJ1Y3R1cmUsIGJlZm9yZSByZXR1cm5pbmcgaXQuXG4gICAgX2NyZWF0ZUltcGxlbWVudGF0aW9uKHR5cGUpIHtcbiAgICAgICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb25zW3R5cGVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxldCBpbXBsO1xuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnYm94JzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25Cb3hTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdzcGhlcmUnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvblNwaGVyZVN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NhcHN1bGUnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjeWxpbmRlcic6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ3lsaW5kZXJTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjb25lJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25Db25lU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnbWVzaCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBvdW5kJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25Db21wb3VuZFN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBfY3JlYXRlSW1wbGVtZW50YXRpb246IEludmFsaWQgY29sbGlzaW9uIHN5c3RlbSB0eXBlOiAke3R5cGV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1t0eXBlXSA9IGltcGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbnNbdHlwZV07XG4gICAgfVxuXG4gICAgLy8gR2V0cyBhbiBleGlzdGluZyBpbXBsZW1lbnRhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBlbnRpdHlcbiAgICBfZ2V0SW1wbGVtZW50YXRpb24oZW50aXR5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uc1tlbnRpdHkuY29sbGlzaW9uLmRhdGEudHlwZV07XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0SW1wbGVtZW50YXRpb24oZW50aXR5KS5jbG9uZShlbnRpdHksIGNsb25lKTtcbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tjb21wb25lbnQuZGF0YS50eXBlXS5iZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgICBjb21wb25lbnQub25CZWZvcmVSZW1vdmUoKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbZGF0YS50eXBlXS5yZW1vdmUoZW50aXR5LCBkYXRhKTtcbiAgICB9XG5cbiAgICB1cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtKGVudGl0eSkge1xuICAgICAgICAvLyBUT0RPXG4gICAgICAgIC8vIHVzZSB1cGRhdGVDaGlsZFRyYW5zZm9ybSBvbmNlIGl0IGlzIGV4cG9zZWQgaW4gYW1tby5qc1xuXG4gICAgICAgIHRoaXMuX3JlbW92ZUNvbXBvdW5kQ2hpbGQoZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQsIGVudGl0eS5jb2xsaXNpb24uZGF0YS5zaGFwZSk7XG5cbiAgICAgICAgaWYgKGVudGl0eS5lbmFibGVkICYmIGVudGl0eS5jb2xsaXNpb24uZW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gdGhpcy5fZ2V0Tm9kZVRyYW5zZm9ybShlbnRpdHksIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50LmVudGl0eSk7XG4gICAgICAgICAgICBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudC5zaGFwZS5hZGRDaGlsZFNoYXBlKHRyYW5zZm9ybSwgZW50aXR5LmNvbGxpc2lvbi5kYXRhLnNoYXBlKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0cmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZUNvbXBvdW5kQ2hpbGQoY29sbGlzaW9uLCBzaGFwZSkge1xuICAgICAgICBpZiAoY29sbGlzaW9uLnNoYXBlLnJlbW92ZUNoaWxkU2hhcGUpIHtcbiAgICAgICAgICAgIGNvbGxpc2lvbi5zaGFwZS5yZW1vdmVDaGlsZFNoYXBlKHNoYXBlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGluZCA9IGNvbGxpc2lvbi5fZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgoc2hhcGUpO1xuICAgICAgICAgICAgaWYgKGluZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbGxpc2lvbi5zaGFwZS5yZW1vdmVDaGlsZFNoYXBlQnlJbmRleChpbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25UcmFuc2Zvcm1DaGFuZ2VkKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tjb21wb25lbnQuZGF0YS50eXBlXS51cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKTtcbiAgICB9XG5cbiAgICAvLyBEZXN0cm95cyB0aGUgcHJldmlvdXMgY29sbGlzaW9uIHR5cGUgYW5kIGNyZWF0ZXMgYSBuZXcgb25lIGJhc2VkIG9uIHRoZSBuZXcgdHlwZSBwcm92aWRlZFxuICAgIGNoYW5nZVR5cGUoY29tcG9uZW50LCBwcmV2aW91c1R5cGUsIG5ld1R5cGUpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbcHJldmlvdXNUeXBlXS5iZWZvcmVSZW1vdmUoY29tcG9uZW50LmVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbcHJldmlvdXNUeXBlXS5yZW1vdmUoY29tcG9uZW50LmVudGl0eSwgY29tcG9uZW50LmRhdGEpO1xuICAgICAgICB0aGlzLl9jcmVhdGVJbXBsZW1lbnRhdGlvbihuZXdUeXBlKS5yZXNldChjb21wb25lbnQsIGNvbXBvbmVudC5kYXRhKTtcbiAgICB9XG5cbiAgICAvLyBSZWNyZWF0ZXMgcmlnaWQgYm9kaWVzIG9yIHRyaWdnZXJzIGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudFxuICAgIHJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50KSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2NvbXBvbmVudC5kYXRhLnR5cGVdLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlTm9kZVJlbGF0aXZlVHJhbnNmb3JtKG5vZGUsIHJlbGF0aXZlKSB7XG4gICAgICAgIGlmIChub2RlID09PSByZWxhdGl2ZSkge1xuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSBub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgIG1hdDQuc2V0U2NhbGUoc2NhbGUueCwgc2NhbGUueSwgc2NhbGUueik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0obm9kZS5wYXJlbnQsIHJlbGF0aXZlKTtcbiAgICAgICAgICAgIG1hdDQubXVsKG5vZGUuZ2V0TG9jYWxUcmFuc2Zvcm0oKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZ2V0Tm9kZVNjYWxpbmcobm9kZSkge1xuICAgICAgICBjb25zdCB3dG0gPSBub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgIGNvbnN0IHNjbCA9IHd0bS5nZXRTY2FsZSgpO1xuICAgICAgICByZXR1cm4gbmV3IEFtbW8uYnRWZWN0b3IzKHNjbC54LCBzY2wueSwgc2NsLnopO1xuICAgIH1cblxuICAgIF9nZXROb2RlVHJhbnNmb3JtKG5vZGUsIHJlbGF0aXZlKSB7XG4gICAgICAgIGxldCBwb3MsIHJvdDtcblxuICAgICAgICBpZiAocmVsYXRpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSk7XG5cbiAgICAgICAgICAgIHBvcyA9IHAxO1xuICAgICAgICAgICAgcm90ID0gcXVhdDtcblxuICAgICAgICAgICAgbWF0NC5nZXRUcmFuc2xhdGlvbihwb3MpO1xuICAgICAgICAgICAgcm90LnNldEZyb21NYXQ0KG1hdDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgcm90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFtbW9RdWF0ID0gbmV3IEFtbW8uYnRRdWF0ZXJuaW9uKCk7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IG5ldyBBbW1vLmJ0VHJhbnNmb3JtKCk7XG5cbiAgICAgICAgdHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHRyYW5zZm9ybS5nZXRPcmlnaW4oKTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5jb2xsaXNpb247XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudCAmJiBjb21wb25lbnQuX2hhc09mZnNldCkge1xuICAgICAgICAgICAgY29uc3QgbG8gPSBjb21wb25lbnQuZGF0YS5saW5lYXJPZmZzZXQ7XG4gICAgICAgICAgICBjb25zdCBhbyA9IGNvbXBvbmVudC5kYXRhLmFuZ3VsYXJPZmZzZXQ7XG4gICAgICAgICAgICBjb25zdCBuZXdPcmlnaW4gPSBwMjtcblxuICAgICAgICAgICAgcXVhdC5jb3B5KHJvdCkudHJhbnNmb3JtVmVjdG9yKGxvLCBuZXdPcmlnaW4pO1xuICAgICAgICAgICAgbmV3T3JpZ2luLmFkZChwb3MpO1xuICAgICAgICAgICAgcXVhdC5jb3B5KHJvdCkubXVsKGFvKTtcblxuICAgICAgICAgICAgb3JpZ2luLnNldFZhbHVlKG5ld09yaWdpbi54LCBuZXdPcmlnaW4ueSwgbmV3T3JpZ2luLnopO1xuICAgICAgICAgICAgYW1tb1F1YXQuc2V0VmFsdWUocXVhdC54LCBxdWF0LnksIHF1YXQueiwgcXVhdC53KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9yaWdpbi5zZXRWYWx1ZShwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRSb3RhdGlvbihhbW1vUXVhdCk7XG4gICAgICAgIEFtbW8uZGVzdHJveShhbW1vUXVhdCk7XG4gICAgICAgIEFtbW8uZGVzdHJveShvcmlnaW4pO1xuXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm07XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fdHJpTWVzaENhY2hlKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5fdHJpTWVzaENhY2hlW2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdHJpTWVzaENhY2hlID0gbnVsbDtcblxuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKENvbGxpc2lvbkNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJtYXQ0IiwiTWF0NCIsInAxIiwiVmVjMyIsInAyIiwicXVhdCIsIlF1YXQiLCJ0ZW1wR3JhcGhOb2RlIiwiR3JhcGhOb2RlIiwiX3NjaGVtYSIsIkNvbGxpc2lvblN5c3RlbUltcGwiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImJlZm9yZUluaXRpYWxpemUiLCJjb21wb25lbnQiLCJkYXRhIiwic2hhcGUiLCJtb2RlbCIsIk1vZGVsIiwiZ3JhcGgiLCJhZnRlckluaXRpYWxpemUiLCJyZWNyZWF0ZVBoeXNpY2FsU2hhcGVzIiwiaW5pdGlhbGl6ZWQiLCJyZXNldCIsImVudGl0eSIsIkFtbW8iLCJ0cmlnZ2VyIiwiZGVzdHJveSIsIl9jb21wb3VuZFBhcmVudCIsIl9yZW1vdmVDb21wb3VuZENoaWxkIiwicmlnaWRib2R5IiwiYWN0aXZhdGUiLCJkZXN0cm95U2hhcGUiLCJjcmVhdGVQaHlzaWNhbFNoYXBlIiwiZmlyc3RDb21wb3VuZENoaWxkIiwidHlwZSIsImZvckVhY2giLCJfYWRkRWFjaERlc2NlbmRhbnQiLCJpbXBsZW1lbnRhdGlvbnMiLCJjb21wb3VuZCIsIl91cGRhdGVFYWNoRGVzY2VuZGFudCIsInBhcmVudCIsImNvbGxpc2lvbiIsImdldE51bUNoaWxkU2hhcGVzIiwidXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybSIsImRpc2FibGVTaW11bGF0aW9uIiwiY3JlYXRlQm9keSIsImVuYWJsZWQiLCJlbmFibGVTaW11bGF0aW9uIiwiVHJpZ2dlciIsImFwcCIsImluaXRpYWxpemUiLCJ1bmRlZmluZWQiLCJ1cGRhdGVUcmFuc2Zvcm0iLCJwb3NpdGlvbiIsInJvdGF0aW9uIiwic2NhbGUiLCJiZWZvcmVSZW1vdmUiLCJfZGVzdHJveWluZyIsInJlbW92ZSIsImJvZHkiLCJjbG9uZSIsInNyYyIsInN0b3JlIiwiZ2V0R3VpZCIsImhhbGZFeHRlbnRzIiwieCIsInkiLCJ6IiwibGluZWFyT2Zmc2V0IiwiYW5ndWxhck9mZnNldCIsInciLCJyYWRpdXMiLCJheGlzIiwiaGVpZ2h0IiwiYXNzZXQiLCJyZW5kZXJBc3NldCIsInJlbmRlciIsImNoZWNrVmVydGV4RHVwbGljYXRlcyIsImFkZENvbXBvbmVudCIsIkNvbGxpc2lvbkJveFN5c3RlbUltcGwiLCJoZSIsImFtbW9IZSIsImJ0VmVjdG9yMyIsImJ0Qm94U2hhcGUiLCJDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsIiwiYnRTcGhlcmVTaGFwZSIsIkNvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsIiwiX2RhdGEkYXhpcyIsIl9kYXRhJHJhZGl1cyIsIl9kYXRhJGhlaWdodCIsIk1hdGgiLCJtYXgiLCJidENhcHN1bGVTaGFwZVgiLCJidENhcHN1bGVTaGFwZSIsImJ0Q2Fwc3VsZVNoYXBlWiIsIkNvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCIsIl9kYXRhJGF4aXMyIiwiX2RhdGEkcmFkaXVzMiIsIl9kYXRhJGhlaWdodDIiLCJidEN5bGluZGVyU2hhcGVYIiwiYnRDeWxpbmRlclNoYXBlIiwiYnRDeWxpbmRlclNoYXBlWiIsIkNvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsIiwiX2RhdGEkYXhpczMiLCJfZGF0YSRyYWRpdXMzIiwiX2RhdGEkaGVpZ2h0MyIsImJ0Q29uZVNoYXBlWCIsImJ0Q29uZVNoYXBlIiwiYnRDb25lU2hhcGVaIiwiQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwiLCJjcmVhdGVBbW1vTWVzaCIsIm1lc2giLCJub2RlIiwiY2hlY2tEdXBlcyIsInRyaU1lc2giLCJfdHJpTWVzaENhY2hlIiwiaWQiLCJ2YiIsInZlcnRleEJ1ZmZlciIsImZvcm1hdCIsImdldEZvcm1hdCIsInN0cmlkZSIsInBvc2l0aW9ucyIsImkiLCJlbGVtZW50cyIsImxlbmd0aCIsImVsZW1lbnQiLCJuYW1lIiwiU0VNQU5USUNfUE9TSVRJT04iLCJGbG9hdDMyQXJyYXkiLCJsb2NrIiwib2Zmc2V0IiwiaW5kaWNlcyIsImdldEluZGljZXMiLCJudW1UcmlhbmdsZXMiLCJwcmltaXRpdmUiLCJjb3VudCIsInYxIiwiaTEiLCJpMiIsImkzIiwiYmFzZSIsImJ0VHJpYW5nbGVNZXNoIiwidmVydGV4Q2FjaGUiLCJNYXAiLCJpbmRleGVkQXJyYXkiLCJnZXRJbmRleGVkTWVzaEFycmF5IiwiYXQiLCJtX251bVRyaWFuZ2xlcyIsImFkZFZlcnRleCIsImluZGV4IiwiaWR4Iiwic3RyIiwiZ2V0Iiwic2V0VmFsdWUiLCJmaW5kT3JBZGRWZXJ0ZXgiLCJzZXQiLCJhZGRJbmRleCIsInRyaU1lc2hTaGFwZSIsImJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUiLCJzY2FsaW5nIiwiX2dldE5vZGVTY2FsaW5nIiwic2V0TG9jYWxTY2FsaW5nIiwidHJhbnNmb3JtIiwiX2dldE5vZGVUcmFuc2Zvcm0iLCJhZGRDaGlsZFNoYXBlIiwiYnRDb21wb3VuZFNoYXBlIiwibWVzaEluc3RhbmNlcyIsIm1lc2hlcyIsImVudGl0eVRyYW5zZm9ybSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0U2NhbGUiLCJ2ZWMiLCJsb2FkQXNzZXQiLCJkb1JlY3JlYXRlUGh5c2ljYWxTaGFwZSIsInByb3BlcnR5IiwiYXNzZXRzIiwicHJldmlvdXNQcm9wZXJ0eVZhbHVlIiwib25Bc3NldEZ1bGx5UmVhZHkiLCJyZXNvdXJjZSIsImxvYWRBbmRIYW5kbGVBc3NldCIsInJlYWR5IiwiY29udGFpbmVyQXNzZXQiLCJsb2FkZWQiLCJsb2FkIiwib25jZSIsIndvcmxkU2NhbGUiLCJwcmV2aW91c1NjYWxlIiwiZ2V0TG9jYWxTY2FsaW5nIiwibnVtU2hhcGVzIiwiZ2V0Q2hpbGRTaGFwZSIsIkNvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCIsIl91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybSIsIkNvbGxpc2lvbkNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFR5cGUiLCJDb2xsaXNpb25Db21wb25lbnQiLCJEYXRhVHlwZSIsIkNvbGxpc2lvbkNvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25SZW1vdmUiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsIl9kYXRhIiwicHJvcGVydGllcyIsImxlbiIsImhhc093blByb3BlcnR5IiwiaW5kZXhPZiIsInNwbGljZSIsIkFycmF5IiwiaXNBcnJheSIsInZhbHVlcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImltcGwiLCJfY3JlYXRlSW1wbGVtZW50YXRpb24iLCJEZWJ1ZyIsImVycm9yIiwiX2dldEltcGxlbWVudGF0aW9uIiwiY2xvbmVDb21wb25lbnQiLCJyZW1vdmVDaGlsZFNoYXBlIiwiaW5kIiwiX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4IiwicmVtb3ZlQ2hpbGRTaGFwZUJ5SW5kZXgiLCJvblRyYW5zZm9ybUNoYW5nZWQiLCJjaGFuZ2VUeXBlIiwicHJldmlvdXNUeXBlIiwibmV3VHlwZSIsIl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0iLCJyZWxhdGl2ZSIsInNldFNjYWxlIiwibXVsIiwiZ2V0TG9jYWxUcmFuc2Zvcm0iLCJ3dG0iLCJzY2wiLCJwb3MiLCJyb3QiLCJnZXRUcmFuc2xhdGlvbiIsInNldEZyb21NYXQ0IiwiZ2V0UG9zaXRpb24iLCJnZXRSb3RhdGlvbiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwiYnRUcmFuc2Zvcm0iLCJzZXRJZGVudGl0eSIsIm9yaWdpbiIsImdldE9yaWdpbiIsIl9oYXNPZmZzZXQiLCJsbyIsImFvIiwibmV3T3JpZ2luIiwiY29weSIsInRyYW5zZm9ybVZlY3RvciIsImFkZCIsInNldFJvdGF0aW9uIiwia2V5IiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBa0JBLE1BQU1BLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FB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
