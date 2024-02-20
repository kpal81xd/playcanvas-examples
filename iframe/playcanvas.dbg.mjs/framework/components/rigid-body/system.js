import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { BODYFLAG_NORESPONSE_OBJECT } from './constants.js';
import { RigidBodyComponent } from './component.js';
import { RigidBodyComponentData } from './data.js';

let ammoRayStart, ammoRayEnd;

/**
 * Object holding the result of a successful raycast hit.
 *
 * @category Physics
 */
class RaycastResult {
  /**
   * Create a new RaycastResult instance.
   *
   * @param {import('../../entity.js').Entity} entity - The entity that was hit.
   * @param {Vec3} point - The point at which the ray hit the entity in world space.
   * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
   * @param {number} hitFraction - The normalized distance (between 0 and 1) at which the ray hit
   * occurred from the starting point.
   * @hideconstructor
   */
  constructor(entity, point, normal, hitFraction) {
    /**
     * The entity that was hit.
     *
     * @type {import('../../entity.js').Entity}
     */
    this.entity = entity;

    /**
     * The point at which the ray hit the entity in world space.
     *
     * @type {Vec3}
     */
    this.point = point;

    /**
     * The normal vector of the surface where the ray hit in world space.
     *
     * @type {Vec3}
     */
    this.normal = normal;

    /**
     * The normalized distance (between 0 and 1) at which the ray hit occurred from the
     * starting point.
     *
     * @type {number}
     */
    this.hitFraction = hitFraction;
  }
}

/**
 * Object holding the result of a contact between two rigid bodies.
 *
 * @category Physics
 */
class SingleContactResult {
  /**
   * Create a new SingleContactResult instance.
   *
   * @param {import('../../entity.js').Entity} a - The first entity involved in the contact.
   * @param {import('../../entity.js').Entity} b - The second entity involved in the contact.
   * @param {ContactPoint} contactPoint - The contact point between the two entities.
   * @hideconstructor
   */
  constructor(a, b, contactPoint) {
    if (arguments.length === 0) {
      /**
       * The first entity involved in the contact.
       *
       * @type {import('../../entity.js').Entity}
       */
      this.a = null;

      /**
       * The second entity involved in the contact.
       *
       * @type {import('../../entity.js').Entity}
       */
      this.b = null;

      /**
       * The total accumulated impulse applied by the constraint solver during the last
       * sub-step. Describes how hard two bodies collided.
       *
       * @type {number}
       */
      this.impulse = 0;

      /**
       * The point on Entity A where the contact occurred, relative to A.
       *
       * @type {Vec3}
       */
      this.localPointA = new Vec3();

      /**
       * The point on Entity B where the contact occurred, relative to B.
       *
       * @type {Vec3}
       */
      this.localPointB = new Vec3();

      /**
       * The point on Entity A where the contact occurred, in world space.
       *
       * @type {Vec3}
       */
      this.pointA = new Vec3();

      /**
       * The point on Entity B where the contact occurred, in world space.
       *
       * @type {Vec3}
       */
      this.pointB = new Vec3();

      /**
       * The normal vector of the contact on Entity B, in world space.
       *
       * @type {Vec3}
       */
      this.normal = new Vec3();
    } else {
      this.a = a;
      this.b = b;
      this.impulse = contactPoint.impulse;
      this.localPointA = contactPoint.localPoint;
      this.localPointB = contactPoint.localPointOther;
      this.pointA = contactPoint.point;
      this.pointB = contactPoint.pointOther;
      this.normal = contactPoint.normal;
    }
  }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactPoint {
  /**
   * Create a new ContactPoint instance.
   *
   * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to
   * the entity.
   * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred,
   * relative to the other entity.
   * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
   * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in
   * world space.
   * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world
   * space.
   * @param {number} [impulse] - The total accumulated impulse applied by the constraint solver
   * during the last sub-step. Describes how hard two objects collide. Defaults to 0.
   * @hideconstructor
   */
  constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
    /**
     * The point on the entity where the contact occurred, relative to the entity.
     *
     * @type {Vec3}
     */
    this.localPoint = localPoint;

    /**
     * The point on the other entity where the contact occurred, relative to the other entity.
     *
     * @type {Vec3}
     */
    this.localPointOther = localPointOther;

    /**
     * The point on the entity where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    this.point = point;

    /**
     * The point on the other entity where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    this.pointOther = pointOther;

    /**
     * The normal vector of the contact on the other entity, in world space.
     *
     * @type {Vec3}
     */
    this.normal = normal;

    /**
     * The total accumulated impulse applied by the constraint solver during the last sub-step.
     * Describes how hard two objects collide.
     *
     * @type {number}
     */
    this.impulse = impulse;
  }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactResult {
  /**
   * Create a new ContactResult instance.
   *
   * @param {import('../../entity.js').Entity} other - The entity that was involved in the
   * contact with this entity.
   * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
   * @hideconstructor
   */
  constructor(other, contacts) {
    /**
     * The entity that was involved in the contact with this entity.
     *
     * @type {import('../../entity.js').Entity}
     */
    this.other = other;

    /**
     * An array of ContactPoints with the other entity.
     *
     * @type {ContactPoint[]}
     */
    this.contacts = contacts;
  }
}
const _schema = ['enabled'];

/**
 * The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also
 * controls global values for the world such as gravity. Note: The RigidBodyComponentSystem is only
 * valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 *
 * @augments ComponentSystem
 * @category Physics
 */
class RigidBodyComponentSystem extends ComponentSystem {
  /**
   * Create a new RigidBodyComponentSystem.
   *
   * @param {import('../../app-base.js').AppBase} app - The Application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    /**
     * @type {number}
     * @ignore
     */
    this.maxSubSteps = 10;
    /**
     * @type {number}
     * @ignore
     */
    this.fixedTimeStep = 1 / 60;
    /**
     * The world space vector representing global gravity in the physics simulation. Defaults to
     * [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
     *
     * @type {Vec3}
     */
    this.gravity = new Vec3(0, -9.81, 0);
    /**
     * @type {Float32Array}
     * @private
     */
    this._gravityFloat32 = new Float32Array(3);
    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    this._dynamic = [];
    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    this._kinematic = [];
    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    this._triggers = [];
    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    this._compounds = [];
    this.id = 'rigidbody';
    this._stats = app.stats.frame;
    this.ComponentType = RigidBodyComponent;
    this.DataType = RigidBodyComponentData;
    this.contactPointPool = null;
    this.contactResultPool = null;
    this.singleContactResultPool = null;
    this.schema = _schema;
    this.collisions = {};
    this.frameCollisions = {};
    this.on('beforeremove', this.onBeforeRemove, this);
  }

  /**
   * Called once Ammo has been loaded. Responsible for creating the physics world.
   *
   * @ignore
   */
  onLibraryLoaded() {
    // Create the Ammo physics world
    if (typeof Ammo !== 'undefined') {
      this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
      this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
      this.overlappingPairCache = new Ammo.btDbvtBroadphase();
      this.solver = new Ammo.btSequentialImpulseConstraintSolver();
      this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);
      if (this.dynamicsWorld.setInternalTickCallback) {
        const checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
        this.dynamicsWorld.setInternalTickCallback(checkForCollisionsPointer);
      } else {
        Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
      }

      // Lazily create temp vars
      ammoRayStart = new Ammo.btVector3();
      ammoRayEnd = new Ammo.btVector3();
      RigidBodyComponent.onLibraryLoaded();
      this.contactPointPool = new ObjectPool(ContactPoint, 1);
      this.contactResultPool = new ObjectPool(ContactResult, 1);
      this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);
      this.app.systems.on('update', this.onUpdate, this);
    } else {
      // Unbind the update function if we haven't loaded Ammo by now
      this.app.systems.off('update', this.onUpdate, this);
    }
  }
  initializeComponentData(component, data, properties) {
    const props = ['mass', 'linearDamping', 'angularDamping', 'linearFactor', 'angularFactor', 'friction', 'rollingFriction', 'restitution', 'type', 'group', 'mask'];
    for (const property of props) {
      if (data.hasOwnProperty(property)) {
        const value = data[property];
        if (Array.isArray(value)) {
          component[property] = new Vec3(value[0], value[1], value[2]);
        } else {
          component[property] = value;
        }
      }
    }
    super.initializeComponentData(component, data, ['enabled']);
  }
  cloneComponent(entity, clone) {
    // create new data block for clone
    const rigidbody = entity.rigidbody;
    const data = {
      enabled: rigidbody.enabled,
      mass: rigidbody.mass,
      linearDamping: rigidbody.linearDamping,
      angularDamping: rigidbody.angularDamping,
      linearFactor: [rigidbody.linearFactor.x, rigidbody.linearFactor.y, rigidbody.linearFactor.z],
      angularFactor: [rigidbody.angularFactor.x, rigidbody.angularFactor.y, rigidbody.angularFactor.z],
      friction: rigidbody.friction,
      rollingFriction: rigidbody.rollingFriction,
      restitution: rigidbody.restitution,
      type: rigidbody.type,
      group: rigidbody.group,
      mask: rigidbody.mask
    };
    return this.addComponent(clone, data);
  }
  onBeforeRemove(entity, component) {
    if (component.enabled) {
      component.enabled = false;
    }
    if (component.body) {
      this.destroyBody(component.body);
      component.body = null;
    }
  }
  addBody(body, group, mask) {
    if (group !== undefined && mask !== undefined) {
      this.dynamicsWorld.addRigidBody(body, group, mask);
    } else {
      this.dynamicsWorld.addRigidBody(body);
    }
  }
  removeBody(body) {
    this.dynamicsWorld.removeRigidBody(body);
  }
  createBody(mass, shape, transform) {
    const localInertia = new Ammo.btVector3(0, 0, 0);
    if (mass !== 0) {
      shape.calculateLocalInertia(mass, localInertia);
    }
    const motionState = new Ammo.btDefaultMotionState(transform);
    const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new Ammo.btRigidBody(bodyInfo);
    Ammo.destroy(bodyInfo);
    Ammo.destroy(localInertia);
    return body;
  }
  destroyBody(body) {
    // The motion state needs to be destroyed explicitly (if present)
    const motionState = body.getMotionState();
    if (motionState) {
      Ammo.destroy(motionState);
    }
    Ammo.destroy(body);
  }

  /**
   * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
   * start to end, if the ray hits an entity with a collision component, it returns a
   * {@link RaycastResult}, otherwise returns null.
   *
   * @param {Vec3} start - The world space point where the ray starts.
   * @param {Vec3} end - The world space point where the ray ends.
   * @param {object} [options] - The additional options for the raycasting.
   * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
   * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
   * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
   * query but within an array.
   * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
   * Must return true to proceed with result. Takes one argument: the entity to evaluate.
   *
   * @returns {RaycastResult|null} The result of the raycasting or null if there was no hit.
   */
  raycastFirst(start, end, options = {}) {
    // Tags and custom callback can only be performed by looking at all results.
    if (options.filterTags || options.filterCallback) {
      options.sort = true;
      return this.raycastAll(start, end, options)[0] || null;
    }
    let result = null;
    ammoRayStart.setValue(start.x, start.y, start.z);
    ammoRayEnd.setValue(end.x, end.y, end.z);
    const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);
    if (typeof options.filterCollisionGroup === 'number') {
      rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
    }
    if (typeof options.filterCollisionMask === 'number') {
      rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
    }
    this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
    if (rayCallback.hasHit()) {
      const collisionObj = rayCallback.get_m_collisionObject();
      const body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
      if (body) {
        const point = rayCallback.get_m_hitPointWorld();
        const normal = rayCallback.get_m_hitNormalWorld();
        result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), rayCallback.get_m_closestHitFraction());
      }
    }
    Ammo.destroy(rayCallback);
    return result;
  }

  /**
   * Raycast the world and return all entities the ray hits. It returns an array of
   * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
   * of length 0. Results are sorted by distance with closest first.
   *
   * @param {Vec3} start - The world space point where the ray starts.
   * @param {Vec3} end - The world space point where the ray ends.
   * @param {object} [options] - The additional options for the raycasting.
   * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
   * first. Defaults to false.
   * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
   * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
   * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
   * query but within an array.
   * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
   * Must return true to proceed with result. Takes the entity to evaluate as argument.
   *
   * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
   *
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2));
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity is tagged with `bird` OR `mammal`
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterTags: [ "bird", "mammal" ]
   * });
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity has a `camera` component
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterCallback: (entity) => entity && entity.camera
   * });
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity is tagged with (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
   * // and the entity has an `anim` component
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterTags: [
   *         [ "carnivore", "mammal" ],
   *         [ "carnivore", "reptile" ]
   *     ],
   *     filterCallback: (entity) => entity && entity.anim
   * });
   */
  raycastAll(start, end, options = {}) {
    Debug.assert(Ammo.AllHitsRayResultCallback, 'pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');
    const results = [];
    ammoRayStart.setValue(start.x, start.y, start.z);
    ammoRayEnd.setValue(end.x, end.y, end.z);
    const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);
    if (typeof options.filterCollisionGroup === 'number') {
      rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
    }
    if (typeof options.filterCollisionMask === 'number') {
      rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
    }
    this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
    if (rayCallback.hasHit()) {
      const collisionObjs = rayCallback.get_m_collisionObjects();
      const points = rayCallback.get_m_hitPointWorld();
      const normals = rayCallback.get_m_hitNormalWorld();
      const hitFractions = rayCallback.get_m_hitFractions();
      const numHits = collisionObjs.size();
      for (let i = 0; i < numHits; i++) {
        const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
        if (body && body.entity) {
          if (options.filterTags && !body.entity.tags.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
            continue;
          }
          const point = points.at(i);
          const normal = normals.at(i);
          const result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), hitFractions.at(i));
          results.push(result);
        }
      }
      if (options.sort) {
        results.sort((a, b) => a.hitFraction - b.hitFraction);
      }
    }
    Ammo.destroy(rayCallback);
    return results;
  }

  /**
   * Stores a collision between the entity and other in the contacts map and returns true if it
   * is a new collision.
   *
   * @param {import('../../entity.js').Entity} entity - The entity.
   * @param {import('../../entity.js').Entity} other - The entity that collides with the first
   * entity.
   * @returns {boolean} True if this is a new collision, false otherwise.
   * @private
   */
  _storeCollision(entity, other) {
    let isNewCollision = false;
    const guid = entity.getGuid();
    this.collisions[guid] = this.collisions[guid] || {
      others: [],
      entity: entity
    };
    if (this.collisions[guid].others.indexOf(other) < 0) {
      this.collisions[guid].others.push(other);
      isNewCollision = true;
    }
    this.frameCollisions[guid] = this.frameCollisions[guid] || {
      others: [],
      entity: entity
    };
    this.frameCollisions[guid].others.push(other);
    return isNewCollision;
  }
  _createContactPointFromAmmo(contactPoint) {
    const localPointA = contactPoint.get_m_localPointA();
    const localPointB = contactPoint.get_m_localPointB();
    const positionWorldOnA = contactPoint.getPositionWorldOnA();
    const positionWorldOnB = contactPoint.getPositionWorldOnB();
    const normalWorldOnB = contactPoint.get_m_normalWorldOnB();
    const contact = this.contactPointPool.allocate();
    contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
    contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
    contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
    contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
    contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
    contact.impulse = contactPoint.getAppliedImpulse();
    return contact;
  }
  _createReverseContactPointFromAmmo(contactPoint) {
    const localPointA = contactPoint.get_m_localPointA();
    const localPointB = contactPoint.get_m_localPointB();
    const positionWorldOnA = contactPoint.getPositionWorldOnA();
    const positionWorldOnB = contactPoint.getPositionWorldOnB();
    const normalWorldOnB = contactPoint.get_m_normalWorldOnB();
    const contact = this.contactPointPool.allocate();
    contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
    contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
    contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
    contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
    contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
    contact.impulse = contactPoint.getAppliedImpulse();
    return contact;
  }
  _createSingleContactResult(a, b, contactPoint) {
    const result = this.singleContactResultPool.allocate();
    result.a = a;
    result.b = b;
    result.localPointA = contactPoint.localPoint;
    result.localPointB = contactPoint.localPointOther;
    result.pointA = contactPoint.point;
    result.pointB = contactPoint.pointOther;
    result.normal = contactPoint.normal;
    result.impulse = contactPoint.impulse;
    return result;
  }
  _createContactResult(other, contacts) {
    const result = this.contactResultPool.allocate();
    result.other = other;
    result.contacts = contacts;
    return result;
  }

  /**
   * Removes collisions that no longer exist from the collisions list and fires collisionend
   * events to the related entities.
   *
   * @private
   */
  _cleanOldCollisions() {
    for (const guid in this.collisions) {
      if (this.collisions.hasOwnProperty(guid)) {
        const frameCollision = this.frameCollisions[guid];
        const collision = this.collisions[guid];
        const entity = collision.entity;
        const entityCollision = entity.collision;
        const entityRigidbody = entity.rigidbody;
        const others = collision.others;
        const length = others.length;
        let i = length;
        while (i--) {
          const other = others[i];
          // if the contact does not exist in the current frame collisions then fire event
          if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
            // remove from others list
            others.splice(i, 1);
            if (entity.trigger) {
              // handle a trigger entity
              if (entityCollision) {
                entityCollision.fire('triggerleave', other);
              }
              if (other.rigidbody) {
                other.rigidbody.fire('triggerleave', entity);
              }
            } else if (!other.trigger) {
              // suppress events if the other entity is a trigger
              if (entityRigidbody) {
                entityRigidbody.fire('collisionend', other);
              }
              if (entityCollision) {
                entityCollision.fire('collisionend', other);
              }
            }
          }
        }
        if (others.length === 0) {
          delete this.collisions[guid];
        }
      }
    }
  }

  /**
   * Returns true if the entity has a contact event attached and false otherwise.
   *
   * @param {import('../../entity.js').Entity} entity - Entity to test.
   * @returns {boolean} True if the entity has a contact and false otherwise.
   * @private
   */
  _hasContactEvent(entity) {
    const c = entity.collision;
    if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
      return true;
    }
    const r = entity.rigidbody;
    return r && (r.hasEvent('collisionstart') || r.hasEvent('collisionend') || r.hasEvent('contact'));
  }

  /**
   * Checks for collisions and fires collision events.
   *
   * @param {number} world - The pointer to the dynamics world that invoked this callback.
   * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
   * @private
   */
  _checkForCollisions(world, timeStep) {
    const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

    // Check for collisions and fire callbacks
    const dispatcher = dynamicsWorld.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();
    this.frameCollisions = {};

    // loop through the all contacts and fire events
    for (let i = 0; i < numManifolds; i++) {
      const manifold = dispatcher.getManifoldByIndexInternal(i);
      const body0 = manifold.getBody0();
      const body1 = manifold.getBody1();
      const wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
      const wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
      const e0 = wb0.entity;
      const e1 = wb1.entity;

      // check if entity is null - TODO: investigate when this happens
      if (!e0 || !e1) {
        continue;
      }
      const flags0 = wb0.getCollisionFlags();
      const flags1 = wb1.getCollisionFlags();
      const numContacts = manifold.getNumContacts();
      const forwardContacts = [];
      const reverseContacts = [];
      let newCollision;
      if (numContacts > 0) {
        // don't fire contact events for triggers
        if (flags0 & BODYFLAG_NORESPONSE_OBJECT || flags1 & BODYFLAG_NORESPONSE_OBJECT) {
          const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
          const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
          const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
          const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));

          // fire triggerenter events for triggers
          if (e0Events) {
            newCollision = this._storeCollision(e0, e1);
            if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
              e0.collision.fire('triggerenter', e1);
            }
          }
          if (e1Events) {
            newCollision = this._storeCollision(e1, e0);
            if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
              e1.collision.fire('triggerenter', e0);
            }
          }

          // fire triggerenter events for rigidbodies
          if (e0BodyEvents) {
            if (!newCollision) {
              newCollision = this._storeCollision(e1, e0);
            }
            if (newCollision) {
              e0.rigidbody.fire('triggerenter', e1);
            }
          }
          if (e1BodyEvents) {
            if (!newCollision) {
              newCollision = this._storeCollision(e0, e1);
            }
            if (newCollision) {
              e1.rigidbody.fire('triggerenter', e0);
            }
          }
        } else {
          const e0Events = this._hasContactEvent(e0);
          const e1Events = this._hasContactEvent(e1);
          const globalEvents = this.hasEvent('contact');
          if (globalEvents || e0Events || e1Events) {
            for (let j = 0; j < numContacts; j++) {
              const btContactPoint = manifold.getContactPoint(j);
              const contactPoint = this._createContactPointFromAmmo(btContactPoint);
              if (e0Events || e1Events) {
                forwardContacts.push(contactPoint);
                const reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
                reverseContacts.push(reverseContactPoint);
              }
              if (globalEvents) {
                // fire global contact event for every contact
                const result = this._createSingleContactResult(e0, e1, contactPoint);
                this.fire('contact', result);
              }
            }
            if (e0Events) {
              const forwardResult = this._createContactResult(e1, forwardContacts);
              newCollision = this._storeCollision(e0, e1);
              if (e0.collision) {
                e0.collision.fire('contact', forwardResult);
                if (newCollision) {
                  e0.collision.fire('collisionstart', forwardResult);
                }
              }
              if (e0.rigidbody) {
                e0.rigidbody.fire('contact', forwardResult);
                if (newCollision) {
                  e0.rigidbody.fire('collisionstart', forwardResult);
                }
              }
            }
            if (e1Events) {
              const reverseResult = this._createContactResult(e0, reverseContacts);
              newCollision = this._storeCollision(e1, e0);
              if (e1.collision) {
                e1.collision.fire('contact', reverseResult);
                if (newCollision) {
                  e1.collision.fire('collisionstart', reverseResult);
                }
              }
              if (e1.rigidbody) {
                e1.rigidbody.fire('contact', reverseResult);
                if (newCollision) {
                  e1.rigidbody.fire('collisionstart', reverseResult);
                }
              }
            }
          }
        }
      }
    }

    // check for collisions that no longer exist and fire events
    this._cleanOldCollisions();

    // Reset contact pools
    this.contactPointPool.freeAll();
    this.contactResultPool.freeAll();
    this.singleContactResultPool.freeAll();
  }
  onUpdate(dt) {
    let i, len;
    this._stats.physicsStart = now();

    // downcast gravity to float32 so we can accurately compare with existing
    // gravity set in ammo.
    this._gravityFloat32[0] = this.gravity.x;
    this._gravityFloat32[1] = this.gravity.y;
    this._gravityFloat32[2] = this.gravity.z;

    // Check to see whether we need to update gravity on the dynamics world
    const gravity = this.dynamicsWorld.getGravity();
    if (gravity.x() !== this._gravityFloat32[0] || gravity.y() !== this._gravityFloat32[1] || gravity.z() !== this._gravityFloat32[2]) {
      gravity.setValue(this.gravity.x, this.gravity.y, this.gravity.z);
      this.dynamicsWorld.setGravity(gravity);
    }
    const triggers = this._triggers;
    for (i = 0, len = triggers.length; i < len; i++) {
      triggers[i].updateTransform();
    }
    const compounds = this._compounds;
    for (i = 0, len = compounds.length; i < len; i++) {
      compounds[i]._updateCompound();
    }

    // Update all kinematic bodies based on their current entity transform
    const kinematic = this._kinematic;
    for (i = 0, len = kinematic.length; i < len; i++) {
      kinematic[i]._updateKinematic();
    }

    // Step the physics simulation
    this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

    // Update the transforms of all entities referencing a dynamic body
    const dynamic = this._dynamic;
    for (i = 0, len = dynamic.length; i < len; i++) {
      dynamic[i]._updateDynamic();
    }
    if (!this.dynamicsWorld.setInternalTickCallback) this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);
    this._stats.physicsTime = now() - this._stats.physicsStart;
  }
  destroy() {
    super.destroy();
    this.app.systems.off('update', this.onUpdate, this);
    if (typeof Ammo !== 'undefined') {
      Ammo.destroy(this.dynamicsWorld);
      Ammo.destroy(this.solver);
      Ammo.destroy(this.overlappingPairCache);
      Ammo.destroy(this.dispatcher);
      Ammo.destroy(this.collisionConfiguration);
      this.dynamicsWorld = null;
      this.solver = null;
      this.overlappingPairCache = null;
      this.dispatcher = null;
      this.collisionConfiguration = null;
    }
  }
}
/**
 * Fired when a contact occurs between two rigid bodies. The handler is passed a
 * {@link SingleContactResult} object containing details of the contact between the two bodies.
 *
 * @event
 * @example
 * app.systems.rigidbody.on('contact', (result) => {
 *     console.log(`Contact between ${result.a.name} and ${result.b.name}`);
 * });
 */
RigidBodyComponentSystem.EVENT_CONTACT = 'contact';
Component._buildAccessors(RigidBodyComponent.prototype, _schema);

export { ContactPoint, ContactResult, RaycastResult, RigidBodyComponentSystem, SingleContactResult };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5sZXQgYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kO1xuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBzdWNjZXNzZnVsIHJheWNhc3QgaGl0LlxuICpcbiAqIEBjYXRlZ29yeSBQaHlzaWNzXG4gKi9cbmNsYXNzIFJheWNhc3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSYXljYXN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0aGF0IHdhcyBoaXQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb2ludCAtIFRoZSBwb2ludCBhdCB3aGljaCB0aGUgcmF5IGhpdCB0aGUgZW50aXR5IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gbm9ybWFsIC0gVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIHN1cmZhY2Ugd2hlcmUgdGhlIHJheSBoaXQgaW4gd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhpdEZyYWN0aW9uIC0gVGhlIG5vcm1hbGl6ZWQgZGlzdGFuY2UgKGJldHdlZW4gMCBhbmQgMSkgYXQgd2hpY2ggdGhlIHJheSBoaXRcbiAgICAgKiBvY2N1cnJlZCBmcm9tIHRoZSBzdGFydGluZyBwb2ludC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZW50aXR5LCBwb2ludCwgbm9ybWFsLCBoaXRGcmFjdGlvbikge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBoaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZW50aXR5ID0gZW50aXR5O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBvaW50ID0gcG9pbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsaXplZCBkaXN0YW5jZSAoYmV0d2VlbiAwIGFuZCAxKSBhdCB3aGljaCB0aGUgcmF5IGhpdCBvY2N1cnJlZCBmcm9tIHRoZVxuICAgICAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaGl0RnJhY3Rpb24gPSBoaXRGcmFjdGlvbjtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICpcbiAqIEBjYXRlZ29yeSBQaHlzaWNzXG4gKi9cbmNsYXNzIFNpbmdsZUNvbnRhY3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTaW5nbGVDb250YWN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gYSAtIFRoZSBmaXJzdCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gYiAtIFRoZSBzZWNvbmQgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50fSBjb250YWN0UG9pbnQgLSBUaGUgY29udGFjdCBwb2ludCBiZXR3ZWVuIHRoZSB0d28gZW50aXRpZXMuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGEsIGIsIGNvbnRhY3RQb2ludCkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgZmlyc3QgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5hID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgc2Vjb25kIGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuYiA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHRvdGFsIGFjY3VtdWxhdGVkIGltcHVsc2UgYXBwbGllZCBieSB0aGUgY29uc3RyYWludCBzb2x2ZXIgZHVyaW5nIHRoZSBsYXN0XG4gICAgICAgICAgICAgKiBzdWItc3RlcC4gRGVzY3JpYmVzIGhvdyBoYXJkIHR3byBib2RpZXMgY29sbGlkZWQuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pbXB1bHNlID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEEgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIEEuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQiB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gQi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBBIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wb2ludEEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQiB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMucG9pbnRCID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgY29udGFjdCBvbiBFbnRpdHkgQiwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubm9ybWFsID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYSA9IGE7XG4gICAgICAgICAgICB0aGlzLmIgPSBiO1xuICAgICAgICAgICAgdGhpcy5pbXB1bHNlID0gY29udGFjdFBvaW50LmltcHVsc2U7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnQ7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgICAgIHRoaXMucG9pbnRBID0gY29udGFjdFBvaW50LnBvaW50O1xuICAgICAgICAgICAgdGhpcy5wb2ludEIgPSBjb250YWN0UG9pbnQucG9pbnRPdGhlcjtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBPYmplY3QgaG9sZGluZyB0aGUgcmVzdWx0IG9mIGEgY29udGFjdCBiZXR3ZWVuIHR3byBFbnRpdGllcy5cbiAqXG4gKiBAY2F0ZWdvcnkgUGh5c2ljc1xuICovXG5jbGFzcyBDb250YWN0UG9pbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UG9pbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50XSAtIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbG9jYWxQb2ludE90aGVyXSAtIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLFxuICAgICAqIHJlbGF0aXZlIHRvIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluXG4gICAgICogd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbm9ybWFsXSAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkXG4gICAgICogc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbXB1bHNlXSAtIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyXG4gICAgICogZHVyaW5nIHRoZSBsYXN0IHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIG9iamVjdHMgY29sbGlkZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9jYWxQb2ludCA9IG5ldyBWZWMzKCksIGxvY2FsUG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIHBvaW50ID0gbmV3IFZlYzMoKSwgcG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIG5vcm1hbCA9IG5ldyBWZWMzKCksIGltcHVsc2UgPSAwKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnQgPSBsb2NhbFBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnRPdGhlciA9IGxvY2FsUG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnQgPSBwb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnRPdGhlciA9IHBvaW50T3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuXG4gICAgICAgICAqIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXB1bHNlID0gaW1wdWxzZTtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKlxuICogQGNhdGVnb3J5IFBoeXNpY3NcbiAqL1xuY2xhc3MgQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlXG4gICAgICogY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50W119IGNvbnRhY3RzIC0gQW4gYXJyYXkgb2YgQ29udGFjdFBvaW50cyB3aXRoIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG90aGVyLCBjb250YWN0cykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBpbnZvbHZlZCBpbiB0aGUgY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm90aGVyID0gb3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29udGFjdFBvaW50W119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbnRhY3RzID0gY29udGFjdHM7XG4gICAgfVxufVxuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBtYWludGFpbnMgdGhlIGR5bmFtaWNzIHdvcmxkIGZvciBzaW11bGF0aW5nIHJpZ2lkIGJvZGllcywgaXQgYWxzb1xuICogY29udHJvbHMgZ2xvYmFsIHZhbHVlcyBmb3IgdGhlIHdvcmxkIHN1Y2ggYXMgZ3Jhdml0eS4gTm90ZTogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBpcyBvbmx5XG4gKiB2YWxpZCBpZiAzRCBQaHlzaWNzIGlzIGVuYWJsZWQgaW4geW91ciBhcHBsaWNhdGlvbi4gWW91IGNhbiBlbmFibGUgdGhpcyBpbiB0aGUgYXBwbGljYXRpb25cbiAqIHNldHRpbmdzIGZvciB5b3VyIHByb2plY3QuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICogQGNhdGVnb3J5IFBoeXNpY3NcbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgY29udGFjdCBvY2N1cnMgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYVxuICAgICAqIHtAbGluayBTaW5nbGVDb250YWN0UmVzdWx0fSBvYmplY3QgY29udGFpbmluZyBkZXRhaWxzIG9mIHRoZSBjb250YWN0IGJldHdlZW4gdGhlIHR3byBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5vbignY29udGFjdCcsIChyZXN1bHQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYENvbnRhY3QgYmV0d2VlbiAke3Jlc3VsdC5hLm5hbWV9IGFuZCAke3Jlc3VsdC5iLm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0NPTlRBQ1QgPSAnY29udGFjdCc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtYXhTdWJTdGVwcyA9IDEwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZml4ZWRUaW1lU3RlcCA9IDEgLyA2MDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbCBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogWzAsIC05LjgxLCAwXSB3aGljaCBpcyBhbiBhcHByb3hpbWF0aW9uIG9mIHRoZSBncmF2aXRhdGlvbmFsIGZvcmNlIG9uIEVhcnRoLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ3Jhdml0eSA9IG5ldyBWZWMzKDAsIC05LjgxLCAwKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ3Jhdml0eUZsb2F0MzIgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2R5bmFtaWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9raW5lbWF0aWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmlnZ2VycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBvdW5kcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyaWdpZGJvZHknO1xuICAgICAgICB0aGlzLl9zdGF0cyA9IGFwcC5zdGF0cy5mcmFtZTtcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0ge307XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIG9uY2UgQW1tbyBoYXMgYmVlbiBsb2FkZWQuIFJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyB0aGUgcGh5c2ljcyB3b3JsZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBvbkxpYnJhcnlMb2FkZWQoKSB7XG4gICAgICAgIC8vIENyZWF0ZSB0aGUgQW1tbyBwaHlzaWNzIHdvcmxkXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbiA9IG5ldyBBbW1vLmJ0RGVmYXVsdENvbGxpc2lvbkNvbmZpZ3VyYXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlciA9IG5ldyBBbW1vLmJ0Q29sbGlzaW9uRGlzcGF0Y2hlcih0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgdGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSA9IG5ldyBBbW1vLmJ0RGJ2dEJyb2FkcGhhc2UoKTtcbiAgICAgICAgICAgIHRoaXMuc29sdmVyID0gbmV3IEFtbW8uYnRTZXF1ZW50aWFsSW1wdWxzZUNvbnN0cmFpbnRTb2x2ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZCA9IG5ldyBBbW1vLmJ0RGlzY3JldGVEeW5hbWljc1dvcmxkKHRoaXMuZGlzcGF0Y2hlciwgdGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSwgdGhpcy5zb2x2ZXIsIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyID0gQW1tby5hZGRGdW5jdGlvbih0aGlzLl9jaGVja0ZvckNvbGxpc2lvbnMuYmluZCh0aGlzKSwgJ3ZpZicpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjayhjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignV0FSTklORzogVGhpcyB2ZXJzaW9uIG9mIGFtbW8uanMgY2FuIHBvdGVudGlhbGx5IGZhaWwgdG8gcmVwb3J0IGNvbnRhY3RzLiBQbGVhc2UgdXBkYXRlIGl0IHRvIHRoZSBsYXRlc3QgdmVyc2lvbi4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTGF6aWx5IGNyZWF0ZSB0ZW1wIHZhcnNcbiAgICAgICAgICAgIGFtbW9SYXlTdGFydCA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgYW1tb1JheUVuZCA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgUmlnaWRCb2R5Q29tcG9uZW50Lm9uTGlicmFyeUxvYWRlZCgpO1xuXG4gICAgICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UG9pbnQsIDEpO1xuICAgICAgICAgICAgdGhpcy5jb250YWN0UmVzdWx0UG9vbCA9IG5ldyBPYmplY3RQb29sKENvbnRhY3RSZXN1bHQsIDEpO1xuICAgICAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbCA9IG5ldyBPYmplY3RQb29sKFNpbmdsZUNvbnRhY3RSZXN1bHQsIDEpO1xuXG4gICAgICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFVuYmluZCB0aGUgdXBkYXRlIGZ1bmN0aW9uIGlmIHdlIGhhdmVuJ3QgbG9hZGVkIEFtbW8gYnkgbm93XG4gICAgICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgY29uc3QgcHJvcHMgPSBbXG4gICAgICAgICAgICAnbWFzcycsXG4gICAgICAgICAgICAnbGluZWFyRGFtcGluZycsXG4gICAgICAgICAgICAnYW5ndWxhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2xpbmVhckZhY3RvcicsXG4gICAgICAgICAgICAnYW5ndWxhckZhY3RvcicsXG4gICAgICAgICAgICAnZnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3JvbGxpbmdGcmljdGlvbicsXG4gICAgICAgICAgICAncmVzdGl0dXRpb24nLFxuICAgICAgICAgICAgJ3R5cGUnLFxuICAgICAgICAgICAgJ2dyb3VwJyxcbiAgICAgICAgICAgICdtYXNrJ1xuICAgICAgICBdO1xuXG4gICAgICAgIGZvciAoY29uc3QgcHJvcGVydHkgb2YgcHJvcHMpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFtwcm9wZXJ0eV0gPSBuZXcgVmVjMyh2YWx1ZVswXSwgdmFsdWVbMV0sIHZhbHVlWzJdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBbJ2VuYWJsZWQnXSk7XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICAvLyBjcmVhdGUgbmV3IGRhdGEgYmxvY2sgZm9yIGNsb25lXG4gICAgICAgIGNvbnN0IHJpZ2lkYm9keSA9IGVudGl0eS5yaWdpZGJvZHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiByaWdpZGJvZHkuZW5hYmxlZCxcbiAgICAgICAgICAgIG1hc3M6IHJpZ2lkYm9keS5tYXNzLFxuICAgICAgICAgICAgbGluZWFyRGFtcGluZzogcmlnaWRib2R5LmxpbmVhckRhbXBpbmcsXG4gICAgICAgICAgICBhbmd1bGFyRGFtcGluZzogcmlnaWRib2R5LmFuZ3VsYXJEYW1waW5nLFxuICAgICAgICAgICAgbGluZWFyRmFjdG9yOiBbcmlnaWRib2R5LmxpbmVhckZhY3Rvci54LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnksIHJpZ2lkYm9keS5saW5lYXJGYWN0b3Iuel0sXG4gICAgICAgICAgICBhbmd1bGFyRmFjdG9yOiBbcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3IueCwgcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3IueSwgcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3Iuel0sXG4gICAgICAgICAgICBmcmljdGlvbjogcmlnaWRib2R5LmZyaWN0aW9uLFxuICAgICAgICAgICAgcm9sbGluZ0ZyaWN0aW9uOiByaWdpZGJvZHkucm9sbGluZ0ZyaWN0aW9uLFxuICAgICAgICAgICAgcmVzdGl0dXRpb246IHJpZ2lkYm9keS5yZXN0aXR1dGlvbixcbiAgICAgICAgICAgIHR5cGU6IHJpZ2lkYm9keS50eXBlLFxuICAgICAgICAgICAgZ3JvdXA6IHJpZ2lkYm9keS5ncm91cCxcbiAgICAgICAgICAgIG1hc2s6IHJpZ2lkYm9keS5tYXNrXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29tcG9uZW50LmJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUJvZHkoY29tcG9uZW50LmJvZHkpO1xuICAgICAgICAgICAgY29tcG9uZW50LmJvZHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQm9keShib2R5LCBncm91cCwgbWFzaykge1xuICAgICAgICBpZiAoZ3JvdXAgIT09IHVuZGVmaW5lZCAmJiBtYXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJvZHkoYm9keSkge1xuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmVtb3ZlUmlnaWRCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBsb2NhbEluZXJ0aWEgPSBuZXcgQW1tby5idFZlY3RvcjMoMCwgMCwgMCk7XG4gICAgICAgIGlmIChtYXNzICE9PSAwKSB7XG4gICAgICAgICAgICBzaGFwZS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gbmV3IEFtbW8uYnREZWZhdWx0TW90aW9uU3RhdGUodHJhbnNmb3JtKTtcbiAgICAgICAgY29uc3QgYm9keUluZm8gPSBuZXcgQW1tby5idFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8obWFzcywgbW90aW9uU3RhdGUsIHNoYXBlLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICBjb25zdCBib2R5ID0gbmV3IEFtbW8uYnRSaWdpZEJvZHkoYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3kobG9jYWxJbmVydGlhKTtcblxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICB9XG5cbiAgICBkZXN0cm95Qm9keShib2R5KSB7XG4gICAgICAgIC8vIFRoZSBtb3Rpb24gc3RhdGUgbmVlZHMgdG8gYmUgZGVzdHJveWVkIGV4cGxpY2l0bHkgKGlmIHByZXNlbnQpXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShtb3Rpb25TdGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gdGhlIGZpcnN0IGVudGl0eSB0aGUgcmF5IGhpdHMuIEZpcmUgYSByYXkgaW50byB0aGUgd29ybGQgZnJvbVxuICAgICAqIHN0YXJ0IHRvIGVuZCwgaWYgdGhlIHJheSBoaXRzIGFuIGVudGl0eSB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudCwgaXQgcmV0dXJucyBhXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIHRoZSByYXljYXN0aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cF0gLSBDb2xsaXNpb24gZ3JvdXAgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2tdIC0gQ29sbGlzaW9uIG1hc2sgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHthbnlbXX0gW29wdGlvbnMuZmlsdGVyVGFnc10gLSBUYWdzIGZpbHRlcnMuIERlZmluZWQgdGhlIHNhbWUgd2F5IGFzIGEge0BsaW5rIFRhZ3MjaGFzfVxuICAgICAqIHF1ZXJ5IGJ1dCB3aXRoaW4gYW4gYXJyYXkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMuZmlsdGVyQ2FsbGJhY2tdIC0gQ3VzdG9tIGZ1bmN0aW9uIHRvIHVzZSB0byBmaWx0ZXIgZW50aXRpZXMuXG4gICAgICogTXVzdCByZXR1cm4gdHJ1ZSB0byBwcm9jZWVkIHdpdGggcmVzdWx0LiBUYWtlcyBvbmUgYXJndW1lbnQ6IHRoZSBlbnRpdHkgdG8gZXZhbHVhdGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdHxudWxsfSBUaGUgcmVzdWx0IG9mIHRoZSByYXljYXN0aW5nIG9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIGhpdC5cbiAgICAgKi9cbiAgICByYXljYXN0Rmlyc3Qoc3RhcnQsIGVuZCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIC8vIFRhZ3MgYW5kIGN1c3RvbSBjYWxsYmFjayBjYW4gb25seSBiZSBwZXJmb3JtZWQgYnkgbG9va2luZyBhdCBhbGwgcmVzdWx0cy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZmlsdGVyVGFncyB8fCBvcHRpb25zLmZpbHRlckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNvcnQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmF5Y2FzdEFsbChzdGFydCwgZW5kLCBvcHRpb25zKVswXSB8fCBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlckdyb3VwKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uR3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2sgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICByYXlDYWxsYmFjay5zZXRfbV9jb2xsaXNpb25GaWx0ZXJNYXNrKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmogPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3QoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2JqLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSksXG4gICAgICAgICAgICAgICAgICAgIHJheUNhbGxiYWNrLmdldF9tX2Nsb3Nlc3RIaXRGcmFjdGlvbigpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSYXljYXN0IHRoZSB3b3JsZCBhbmQgcmV0dXJuIGFsbCBlbnRpdGllcyB0aGUgcmF5IGhpdHMuIEl0IHJldHVybnMgYW4gYXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgUmF5Y2FzdFJlc3VsdH0sIG9uZSBmb3IgZWFjaCBoaXQuIElmIG5vIGhpdHMgYXJlIGRldGVjdGVkLCB0aGUgcmV0dXJuZWQgYXJyYXkgd2lsbCBiZVxuICAgICAqIG9mIGxlbmd0aCAwLiBSZXN1bHRzIGFyZSBzb3J0ZWQgYnkgZGlzdGFuY2Ugd2l0aCBjbG9zZXN0IGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIHRoZSByYXljYXN0aW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc29ydF0gLSBXaGV0aGVyIHRvIHNvcnQgcmF5Y2FzdCByZXN1bHRzIGJhc2VkIG9uIGRpc3RhbmNlIHdpdGggY2xvc2VzdFxuICAgICAqIGZpcnN0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmlsdGVyQ29sbGlzaW9uR3JvdXBdIC0gQ29sbGlzaW9uIGdyb3VwIHRvIGFwcGx5IHRvIHRoZSByYXljYXN0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25NYXNrXSAtIENvbGxpc2lvbiBtYXNrIHRvIGFwcGx5IHRvIHRoZSByYXljYXN0LlxuICAgICAqIEBwYXJhbSB7YW55W119IFtvcHRpb25zLmZpbHRlclRhZ3NdIC0gVGFncyBmaWx0ZXJzLiBEZWZpbmVkIHRoZSBzYW1lIHdheSBhcyBhIHtAbGluayBUYWdzI2hhc31cbiAgICAgKiBxdWVyeSBidXQgd2l0aGluIGFuIGFycmF5LlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLmZpbHRlckNhbGxiYWNrXSAtIEN1c3RvbSBmdW5jdGlvbiB0byB1c2UgdG8gZmlsdGVyIGVudGl0aWVzLlxuICAgICAqIE11c3QgcmV0dXJuIHRydWUgdG8gcHJvY2VlZCB3aXRoIHJlc3VsdC4gVGFrZXMgdGhlIGVudGl0eSB0byBldmFsdWF0ZSBhcyBhcmd1bWVudC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtSYXljYXN0UmVzdWx0W119IEFuIGFycmF5IG9mIHJheWNhc3QgaGl0IHJlc3VsdHMgKDAgbGVuZ3RoIGlmIHRoZXJlIHdlcmUgbm8gaGl0cykuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgcmVzdWx0cyBvZiBhIHJheWNhc3QgYmV0d2VlbiAwLCAyLCAyIGFuZCAwLCAtMiwgLTJcbiAgICAgKiBjb25zdCBoaXRzID0gdGhpcy5hcHAuc3lzdGVtcy5yaWdpZGJvZHkucmF5Y2FzdEFsbChuZXcgVmVjMygwLCAyLCAyKSwgbmV3IFZlYzMoMCwgLTIsIC0yKSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIHJlc3VsdHMgb2YgYSByYXljYXN0IGJldHdlZW4gMCwgMiwgMiBhbmQgMCwgLTIsIC0yXG4gICAgICogLy8gd2hlcmUgaGl0IGVudGl0eSBpcyB0YWdnZWQgd2l0aCBgYmlyZGAgT1IgYG1hbW1hbGBcbiAgICAgKiBjb25zdCBoaXRzID0gdGhpcy5hcHAuc3lzdGVtcy5yaWdpZGJvZHkucmF5Y2FzdEFsbChuZXcgVmVjMygwLCAyLCAyKSwgbmV3IFZlYzMoMCwgLTIsIC0yKSwge1xuICAgICAqICAgICBmaWx0ZXJUYWdzOiBbIFwiYmlyZFwiLCBcIm1hbW1hbFwiIF1cbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgcmVzdWx0cyBvZiBhIHJheWNhc3QgYmV0d2VlbiAwLCAyLCAyIGFuZCAwLCAtMiwgLTJcbiAgICAgKiAvLyB3aGVyZSBoaXQgZW50aXR5IGhhcyBhIGBjYW1lcmFgIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpLCB7XG4gICAgICogICAgIGZpbHRlckNhbGxiYWNrOiAoZW50aXR5KSA9PiBlbnRpdHkgJiYgZW50aXR5LmNhbWVyYVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCByZXN1bHRzIG9mIGEgcmF5Y2FzdCBiZXR3ZWVuIDAsIDIsIDIgYW5kIDAsIC0yLCAtMlxuICAgICAqIC8vIHdoZXJlIGhpdCBlbnRpdHkgaXMgdGFnZ2VkIHdpdGggKGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYCkgT1IgKGBjYXJuaXZvcmVgIEFORCBgcmVwdGlsZWApXG4gICAgICogLy8gYW5kIHRoZSBlbnRpdHkgaGFzIGFuIGBhbmltYCBjb21wb25lbnRcbiAgICAgKiBjb25zdCBoaXRzID0gdGhpcy5hcHAuc3lzdGVtcy5yaWdpZGJvZHkucmF5Y2FzdEFsbChuZXcgVmVjMygwLCAyLCAyKSwgbmV3IFZlYzMoMCwgLTIsIC0yKSwge1xuICAgICAqICAgICBmaWx0ZXJUYWdzOiBbXG4gICAgICogICAgICAgICBbIFwiY2Fybml2b3JlXCIsIFwibWFtbWFsXCIgXSxcbiAgICAgKiAgICAgICAgIFsgXCJjYXJuaXZvcmVcIiwgXCJyZXB0aWxlXCIgXVxuICAgICAqICAgICBdLFxuICAgICAqICAgICBmaWx0ZXJDYWxsYmFjazogKGVudGl0eSkgPT4gZW50aXR5ICYmIGVudGl0eS5hbmltXG4gICAgICogfSk7XG4gICAgICovXG4gICAgcmF5Y2FzdEFsbChzdGFydCwgZW5kLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLCAncGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI3JheWNhc3RBbGw6IFlvdXIgdmVyc2lvbiBvZiBhbW1vLmpzIGRvZXMgbm90IGV4cG9zZSBBbW1vLkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjay4gVXBkYXRlIGl0IHRvIGxhdGVzdC4nKTtcblxuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlckdyb3VwKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uR3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2sgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICByYXlDYWxsYmFjay5zZXRfbV9jb2xsaXNpb25GaWx0ZXJNYXNrKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmpzID0gcmF5Q2FsbGJhY2suZ2V0X21fY29sbGlzaW9uT2JqZWN0cygpO1xuICAgICAgICAgICAgY29uc3QgcG9pbnRzID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0UG9pbnRXb3JsZCgpO1xuICAgICAgICAgICAgY29uc3Qgbm9ybWFscyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdE5vcm1hbFdvcmxkKCk7XG4gICAgICAgICAgICBjb25zdCBoaXRGcmFjdGlvbnMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRGcmFjdGlvbnMoKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtSGl0cyA9IGNvbGxpc2lvbk9ianMuc2l6ZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1IaXRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib2R5ID0gQW1tby5jYXN0T2JqZWN0KGNvbGxpc2lvbk9ianMuYXQoaSksIEFtbW8uYnRSaWdpZEJvZHkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJvZHkgJiYgYm9keS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZmlsdGVyVGFncyAmJiAhYm9keS5lbnRpdHkudGFncy5oYXMoLi4ub3B0aW9ucy5maWx0ZXJUYWdzKSB8fCBvcHRpb25zLmZpbHRlckNhbGxiYWNrICYmICFvcHRpb25zLmZpbHRlckNhbGxiYWNrKGJvZHkuZW50aXR5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHBvaW50cy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsID0gbm9ybWFscy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmVudGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKHBvaW50LngoKSwgcG9pbnQueSgpLCBwb2ludC56KCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBoaXRGcmFjdGlvbnMuYXQoaSlcbiAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnNvcnQoKGEsIGIpID0+IGEuaGl0RnJhY3Rpb24gLSBiLmhpdEZyYWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcmVzIGEgY29sbGlzaW9uIGJldHdlZW4gdGhlIGVudGl0eSBhbmQgb3RoZXIgaW4gdGhlIGNvbnRhY3RzIG1hcCBhbmQgcmV0dXJucyB0cnVlIGlmIGl0XG4gICAgICogaXMgYSBuZXcgY29sbGlzaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCBjb2xsaWRlcyB3aXRoIHRoZSBmaXJzdFxuICAgICAqIGVudGl0eS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGlzIGlzIGEgbmV3IGNvbGxpc2lvbiwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N0b3JlQ29sbGlzaW9uKGVudGl0eSwgb3RoZXIpIHtcbiAgICAgICAgbGV0IGlzTmV3Q29sbGlzaW9uID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGd1aWQgPSBlbnRpdHkuZ2V0R3VpZCgpO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXSA9IHRoaXMuY29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG5cbiAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuICAgICAgICAgICAgaXNOZXdDb2xsaXNpb24gPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0gPSB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdLm90aGVycy5wdXNoKG90aGVyKTtcblxuICAgICAgICByZXR1cm4gaXNOZXdDb2xsaXNpb247XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnQuc2V0KGxvY2FsUG9pbnRBLngoKSwgbG9jYWxQb2ludEEueSgpLCBsb2NhbFBvaW50QS56KCkpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkEueCgpLCBwb3NpdGlvbldvcmxkT25BLnkoKSwgcG9zaXRpb25Xb3JsZE9uQS56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50T3RoZXIuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5hbGxvY2F0ZSgpO1xuXG4gICAgICAgIHJlc3VsdC5hID0gYTtcbiAgICAgICAgcmVzdWx0LmIgPSBiO1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgcmVzdWx0LmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgcmVzdWx0LnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgcmVzdWx0LnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICByZXN1bHQubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgcmVzdWx0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIF9jcmVhdGVDb250YWN0UmVzdWx0KG90aGVyLCBjb250YWN0cykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IG90aGVyO1xuICAgICAgICByZXN1bHQuY29udGFjdHMgPSBjb250YWN0cztcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNvbGxpc2lvbnMgdGhhdCBubyBsb25nZXIgZXhpc3QgZnJvbSB0aGUgY29sbGlzaW9ucyBsaXN0IGFuZCBmaXJlcyBjb2xsaXNpb25lbmRcbiAgICAgKiBldmVudHMgdG8gdGhlIHJlbGF0ZWQgZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbGVhbk9sZENvbGxpc2lvbnMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgZ3VpZCBpbiB0aGlzLmNvbGxpc2lvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbGxpc2lvbnMuaGFzT3duUHJvcGVydHkoZ3VpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZUNvbGxpc2lvbiA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbiA9IHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBjb2xsaXNpb24uZW50aXR5O1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUNvbGxpc2lvbiA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5UmlnaWRib2R5ID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlcnMgPSBjb2xsaXNpb24ub3RoZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IG90aGVycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGkgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlciA9IG90aGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNvbnRhY3QgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGN1cnJlbnQgZnJhbWUgY29sbGlzaW9ucyB0aGVuIGZpcmUgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcmFtZUNvbGxpc2lvbiB8fCBmcmFtZUNvbGxpc2lvbi5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBvdGhlcnMgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJzLnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIGEgdHJpZ2dlciBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCd0cmlnZ2VybGVhdmUnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvdGhlci5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXIucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJsZWF2ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghb3RoZXIudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN1cHByZXNzIGV2ZW50cyBpZiB0aGUgb3RoZXIgZW50aXR5IGlzIGEgdHJpZ2dlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlSaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5UmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbmVuZCcsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eUNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlDb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvdGhlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29udGFjdCBldmVudCBhdHRhY2hlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gRW50aXR5IHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGVudGl0eSBoYXMgYSBjb250YWN0IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGFzQ29udGFjdEV2ZW50KGVudGl0eSkge1xuICAgICAgICBjb25zdCBjID0gZW50aXR5LmNvbGxpc2lvbjtcbiAgICAgICAgaWYgKGMgJiYgKGMuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgYy5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgYy5oYXNFdmVudCgnY29udGFjdCcpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgcmV0dXJuIHIgJiYgKHIuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgci5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgci5oYXNFdmVudCgnY29udGFjdCcpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmVzIGNvbGxpc2lvbiBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd29ybGQgLSBUaGUgcG9pbnRlciB0byB0aGUgZHluYW1pY3Mgd29ybGQgdGhhdCBpbnZva2VkIHRoaXMgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWVTdGVwIC0gVGhlIGFtb3VudCBvZiBzaW11bGF0aW9uIHRpbWUgcHJvY2Vzc2VkIGluIHRoZSBsYXN0IHNpbXVsYXRpb24gdGljay5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jaGVja0ZvckNvbGxpc2lvbnMod29ybGQsIHRpbWVTdGVwKSB7XG4gICAgICAgIGNvbnN0IGR5bmFtaWNzV29ybGQgPSBBbW1vLndyYXBQb2ludGVyKHdvcmxkLCBBbW1vLmJ0RHluYW1pY3NXb3JsZCk7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmUgY2FsbGJhY2tzXG4gICAgICAgIGNvbnN0IGRpc3BhdGNoZXIgPSBkeW5hbWljc1dvcmxkLmdldERpc3BhdGNoZXIoKTtcbiAgICAgICAgY29uc3QgbnVtTWFuaWZvbGRzID0gZGlzcGF0Y2hlci5nZXROdW1NYW5pZm9sZHMoKTtcblxuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9ucyA9IHt9O1xuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgYWxsIGNvbnRhY3RzIGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU1hbmlmb2xkczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYW5pZm9sZCA9IGRpc3BhdGNoZXIuZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwoaSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJvZHkwID0gbWFuaWZvbGQuZ2V0Qm9keTAoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkxID0gbWFuaWZvbGQuZ2V0Qm9keTEoKTtcblxuICAgICAgICAgICAgY29uc3Qgd2IwID0gQW1tby5jYXN0T2JqZWN0KGJvZHkwLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgIGNvbnN0IHdiMSA9IEFtbW8uY2FzdE9iamVjdChib2R5MSwgQW1tby5idFJpZ2lkQm9keSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGUwID0gd2IwLmVudGl0eTtcbiAgICAgICAgICAgIGNvbnN0IGUxID0gd2IxLmVudGl0eTtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgZW50aXR5IGlzIG51bGwgLSBUT0RPOiBpbnZlc3RpZ2F0ZSB3aGVuIHRoaXMgaGFwcGVuc1xuICAgICAgICAgICAgaWYgKCFlMCB8fCAhZTEpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmxhZ3MwID0gd2IwLmdldENvbGxpc2lvbkZsYWdzKCk7XG4gICAgICAgICAgICBjb25zdCBmbGFnczEgPSB3YjEuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtQ29udGFjdHMgPSBtYW5pZm9sZC5nZXROdW1Db250YWN0cygpO1xuICAgICAgICAgICAgY29uc3QgZm9yd2FyZENvbnRhY3RzID0gW107XG4gICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGxldCBuZXdDb2xsaXNpb247XG5cbiAgICAgICAgICAgIGlmIChudW1Db250YWN0cyA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBmaXJlIGNvbnRhY3QgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgIGlmICgoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpIHx8XG4gICAgICAgICAgICAgICAgICAgIChmbGFnczEgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IGUwLmNvbGxpc2lvbiAmJiAoZTAuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSBlMS5jb2xsaXNpb24gJiYgKGUxLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwQm9keUV2ZW50cyA9IGUwLnJpZ2lkYm9keSAmJiAoZTAucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFCb2R5RXZlbnRzID0gZTEucmlnaWRib2R5ICYmIChlMS5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgdHJpZ2dlcnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbiAmJiAhKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLmNvbGxpc2lvbi5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgcmlnaWRib2RpZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUJvZHlFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLnJpZ2lkYm9keS5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IHRoaXMuX2hhc0NvbnRhY3RFdmVudChlMCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUxRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2xvYmFsRXZlbnRzID0gdGhpcy5oYXNFdmVudCgnY29udGFjdCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbG9iYWxFdmVudHMgfHwgZTBFdmVudHMgfHwgZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtQ29udGFjdHM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ0Q29udGFjdFBvaW50ID0gbWFuaWZvbGQuZ2V0Q29udGFjdFBvaW50KGopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhY3RQb2ludCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3J3YXJkQ29udGFjdHMucHVzaChjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZUNvbnRhY3RzLnB1c2gocmV2ZXJzZUNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmaXJlIGdsb2JhbCBjb250YWN0IGV2ZW50IGZvciBldmVyeSBjb250YWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQoZTAsIGUxLCBjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NvbnRhY3QnLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9yd2FyZFJlc3VsdCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RSZXN1bHQoZTEsIGZvcndhcmRDb250YWN0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTAucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb250YWN0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb2xsaXNpb25zdGFydCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMCwgcmV2ZXJzZUNvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaGVjayBmb3IgY29sbGlzaW9ucyB0aGF0IG5vIGxvbmdlciBleGlzdCBhbmQgZmlyZSBldmVudHNcbiAgICAgICAgdGhpcy5fY2xlYW5PbGRDb2xsaXNpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgY29udGFjdCBwb29sc1xuICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5mcmVlQWxsKCk7XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGksIGxlbjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBkb3duY2FzdCBncmF2aXR5IHRvIGZsb2F0MzIgc28gd2UgY2FuIGFjY3VyYXRlbHkgY29tcGFyZSB3aXRoIGV4aXN0aW5nXG4gICAgICAgIC8vIGdyYXZpdHkgc2V0IGluIGFtbW8uXG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzBdID0gdGhpcy5ncmF2aXR5Lng7XG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzFdID0gdGhpcy5ncmF2aXR5Lnk7XG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzJdID0gdGhpcy5ncmF2aXR5Lno7XG5cbiAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIHdoZXRoZXIgd2UgbmVlZCB0byB1cGRhdGUgZ3Jhdml0eSBvbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHRoaXMuZHluYW1pY3NXb3JsZC5nZXRHcmF2aXR5KCk7XG4gICAgICAgIGlmIChncmF2aXR5LngoKSAhPT0gdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMF0gfHxcbiAgICAgICAgICAgIGdyYXZpdHkueSgpICE9PSB0aGlzLl9ncmF2aXR5RmxvYXQzMlsxXSB8fFxuICAgICAgICAgICAgZ3Jhdml0eS56KCkgIT09IHRoaXMuX2dyYXZpdHlGbG9hdDMyWzJdKSB7XG4gICAgICAgICAgICBncmF2aXR5LnNldFZhbHVlKHRoaXMuZ3Jhdml0eS54LCB0aGlzLmdyYXZpdHkueSwgdGhpcy5ncmF2aXR5LnopO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnNldEdyYXZpdHkoZ3Jhdml0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmlnZ2VycyA9IHRoaXMuX3RyaWdnZXJzO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0cmlnZ2Vycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdHJpZ2dlcnNbaV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21wb3VuZHMgPSB0aGlzLl9jb21wb3VuZHM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGNvbXBvdW5kcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcG91bmRzW2ldLl91cGRhdGVDb21wb3VuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBraW5lbWF0aWMgYm9kaWVzIGJhc2VkIG9uIHRoZWlyIGN1cnJlbnQgZW50aXR5IHRyYW5zZm9ybVxuICAgICAgICBjb25zdCBraW5lbWF0aWMgPSB0aGlzLl9raW5lbWF0aWM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGtpbmVtYXRpYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAga2luZW1hdGljW2ldLl91cGRhdGVLaW5lbWF0aWMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgdGhlIHBoeXNpY3Mgc2ltdWxhdGlvblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc3RlcFNpbXVsYXRpb24oZHQsIHRoaXMubWF4U3ViU3RlcHMsIHRoaXMuZml4ZWRUaW1lU3RlcCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSB0cmFuc2Zvcm1zIG9mIGFsbCBlbnRpdGllcyByZWZlcmVuY2luZyBhIGR5bmFtaWMgYm9keVxuICAgICAgICBjb25zdCBkeW5hbWljID0gdGhpcy5fZHluYW1pYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gZHluYW1pYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgZHluYW1pY1tpXS5fdXBkYXRlRHluYW1pYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9jaGVja0ZvckNvbGxpc2lvbnMoQW1tby5nZXRQb2ludGVyKHRoaXMuZHluYW1pY3NXb3JsZCksIGR0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NUaW1lID0gbm93KCkgLSB0aGlzLl9zdGF0cy5waHlzaWNzU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZHluYW1pY3NXb3JsZCk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5zb2x2ZXIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZGlzcGF0Y2hlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBDb250YWN0UG9pbnQsIENvbnRhY3RSZXN1bHQsIFJheWNhc3RSZXN1bHQsIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSwgU2luZ2xlQ29udGFjdFJlc3VsdCB9O1xuIl0sIm5hbWVzIjpbImFtbW9SYXlTdGFydCIsImFtbW9SYXlFbmQiLCJSYXljYXN0UmVzdWx0IiwiY29uc3RydWN0b3IiLCJlbnRpdHkiLCJwb2ludCIsIm5vcm1hbCIsImhpdEZyYWN0aW9uIiwiU2luZ2xlQ29udGFjdFJlc3VsdCIsImEiLCJiIiwiY29udGFjdFBvaW50IiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiaW1wdWxzZSIsImxvY2FsUG9pbnRBIiwiVmVjMyIsImxvY2FsUG9pbnRCIiwicG9pbnRBIiwicG9pbnRCIiwibG9jYWxQb2ludCIsImxvY2FsUG9pbnRPdGhlciIsInBvaW50T3RoZXIiLCJDb250YWN0UG9pbnQiLCJDb250YWN0UmVzdWx0Iiwib3RoZXIiLCJjb250YWN0cyIsIl9zY2hlbWEiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJhcHAiLCJtYXhTdWJTdGVwcyIsImZpeGVkVGltZVN0ZXAiLCJncmF2aXR5IiwiX2dyYXZpdHlGbG9hdDMyIiwiRmxvYXQzMkFycmF5IiwiX2R5bmFtaWMiLCJfa2luZW1hdGljIiwiX3RyaWdnZXJzIiwiX2NvbXBvdW5kcyIsImlkIiwiX3N0YXRzIiwic3RhdHMiLCJmcmFtZSIsIkNvbXBvbmVudFR5cGUiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJEYXRhVHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudERhdGEiLCJjb250YWN0UG9pbnRQb29sIiwiY29udGFjdFJlc3VsdFBvb2wiLCJzaW5nbGVDb250YWN0UmVzdWx0UG9vbCIsInNjaGVtYSIsImNvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbnMiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25MaWJyYXJ5TG9hZGVkIiwiQW1tbyIsImNvbGxpc2lvbkNvbmZpZ3VyYXRpb24iLCJidERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uIiwiZGlzcGF0Y2hlciIsImJ0Q29sbGlzaW9uRGlzcGF0Y2hlciIsIm92ZXJsYXBwaW5nUGFpckNhY2hlIiwiYnREYnZ0QnJvYWRwaGFzZSIsInNvbHZlciIsImJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyIiwiZHluYW1pY3NXb3JsZCIsImJ0RGlzY3JldGVEeW5hbWljc1dvcmxkIiwic2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2siLCJjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyIiwiYWRkRnVuY3Rpb24iLCJfY2hlY2tGb3JDb2xsaXNpb25zIiwiYmluZCIsIkRlYnVnIiwid2FybiIsImJ0VmVjdG9yMyIsIk9iamVjdFBvb2wiLCJzeXN0ZW1zIiwib25VcGRhdGUiLCJvZmYiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsImRhdGEiLCJwcm9wZXJ0aWVzIiwicHJvcHMiLCJwcm9wZXJ0eSIsImhhc093blByb3BlcnR5IiwidmFsdWUiLCJBcnJheSIsImlzQXJyYXkiLCJjbG9uZUNvbXBvbmVudCIsImNsb25lIiwicmlnaWRib2R5IiwiZW5hYmxlZCIsIm1hc3MiLCJsaW5lYXJEYW1waW5nIiwiYW5ndWxhckRhbXBpbmciLCJsaW5lYXJGYWN0b3IiLCJ4IiwieSIsInoiLCJhbmd1bGFyRmFjdG9yIiwiZnJpY3Rpb24iLCJyb2xsaW5nRnJpY3Rpb24iLCJyZXN0aXR1dGlvbiIsInR5cGUiLCJncm91cCIsIm1hc2siLCJhZGRDb21wb25lbnQiLCJib2R5IiwiZGVzdHJveUJvZHkiLCJhZGRCb2R5IiwidW5kZWZpbmVkIiwiYWRkUmlnaWRCb2R5IiwicmVtb3ZlQm9keSIsInJlbW92ZVJpZ2lkQm9keSIsImNyZWF0ZUJvZHkiLCJzaGFwZSIsInRyYW5zZm9ybSIsImxvY2FsSW5lcnRpYSIsImNhbGN1bGF0ZUxvY2FsSW5lcnRpYSIsIm1vdGlvblN0YXRlIiwiYnREZWZhdWx0TW90aW9uU3RhdGUiLCJib2R5SW5mbyIsImJ0UmlnaWRCb2R5Q29uc3RydWN0aW9uSW5mbyIsImJ0UmlnaWRCb2R5IiwiZGVzdHJveSIsImdldE1vdGlvblN0YXRlIiwicmF5Y2FzdEZpcnN0Iiwic3RhcnQiLCJlbmQiLCJvcHRpb25zIiwiZmlsdGVyVGFncyIsImZpbHRlckNhbGxiYWNrIiwic29ydCIsInJheWNhc3RBbGwiLCJyZXN1bHQiLCJzZXRWYWx1ZSIsInJheUNhbGxiYWNrIiwiQ2xvc2VzdFJheVJlc3VsdENhbGxiYWNrIiwiZmlsdGVyQ29sbGlzaW9uR3JvdXAiLCJzZXRfbV9jb2xsaXNpb25GaWx0ZXJHcm91cCIsImZpbHRlckNvbGxpc2lvbk1hc2siLCJzZXRfbV9jb2xsaXNpb25GaWx0ZXJNYXNrIiwicmF5VGVzdCIsImhhc0hpdCIsImNvbGxpc2lvbk9iaiIsImdldF9tX2NvbGxpc2lvbk9iamVjdCIsImNhc3RPYmplY3QiLCJnZXRfbV9oaXRQb2ludFdvcmxkIiwiZ2V0X21faGl0Tm9ybWFsV29ybGQiLCJnZXRfbV9jbG9zZXN0SGl0RnJhY3Rpb24iLCJhc3NlcnQiLCJBbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2siLCJyZXN1bHRzIiwiY29sbGlzaW9uT2JqcyIsImdldF9tX2NvbGxpc2lvbk9iamVjdHMiLCJwb2ludHMiLCJub3JtYWxzIiwiaGl0RnJhY3Rpb25zIiwiZ2V0X21faGl0RnJhY3Rpb25zIiwibnVtSGl0cyIsInNpemUiLCJpIiwiYXQiLCJ0YWdzIiwiaGFzIiwicHVzaCIsIl9zdG9yZUNvbGxpc2lvbiIsImlzTmV3Q29sbGlzaW9uIiwiZ3VpZCIsImdldEd1aWQiLCJvdGhlcnMiLCJpbmRleE9mIiwiX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vIiwiZ2V0X21fbG9jYWxQb2ludEEiLCJnZXRfbV9sb2NhbFBvaW50QiIsInBvc2l0aW9uV29ybGRPbkEiLCJnZXRQb3NpdGlvbldvcmxkT25BIiwicG9zaXRpb25Xb3JsZE9uQiIsImdldFBvc2l0aW9uV29ybGRPbkIiLCJub3JtYWxXb3JsZE9uQiIsImdldF9tX25vcm1hbFdvcmxkT25CIiwiY29udGFjdCIsImFsbG9jYXRlIiwic2V0IiwiZ2V0QXBwbGllZEltcHVsc2UiLCJfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vIiwiX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQiLCJfY3JlYXRlQ29udGFjdFJlc3VsdCIsIl9jbGVhbk9sZENvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbiIsImNvbGxpc2lvbiIsImVudGl0eUNvbGxpc2lvbiIsImVudGl0eVJpZ2lkYm9keSIsInNwbGljZSIsInRyaWdnZXIiLCJmaXJlIiwiX2hhc0NvbnRhY3RFdmVudCIsImMiLCJoYXNFdmVudCIsInIiLCJ3b3JsZCIsInRpbWVTdGVwIiwid3JhcFBvaW50ZXIiLCJidER5bmFtaWNzV29ybGQiLCJnZXREaXNwYXRjaGVyIiwibnVtTWFuaWZvbGRzIiwiZ2V0TnVtTWFuaWZvbGRzIiwibWFuaWZvbGQiLCJnZXRNYW5pZm9sZEJ5SW5kZXhJbnRlcm5hbCIsImJvZHkwIiwiZ2V0Qm9keTAiLCJib2R5MSIsImdldEJvZHkxIiwid2IwIiwid2IxIiwiZTAiLCJlMSIsImZsYWdzMCIsImdldENvbGxpc2lvbkZsYWdzIiwiZmxhZ3MxIiwibnVtQ29udGFjdHMiLCJnZXROdW1Db250YWN0cyIsImZvcndhcmRDb250YWN0cyIsInJldmVyc2VDb250YWN0cyIsIm5ld0NvbGxpc2lvbiIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiZTBFdmVudHMiLCJlMUV2ZW50cyIsImUwQm9keUV2ZW50cyIsImUxQm9keUV2ZW50cyIsImdsb2JhbEV2ZW50cyIsImoiLCJidENvbnRhY3RQb2ludCIsImdldENvbnRhY3RQb2ludCIsInJldmVyc2VDb250YWN0UG9pbnQiLCJmb3J3YXJkUmVzdWx0IiwicmV2ZXJzZVJlc3VsdCIsImZyZWVBbGwiLCJkdCIsImxlbiIsInBoeXNpY3NTdGFydCIsIm5vdyIsImdldEdyYXZpdHkiLCJzZXRHcmF2aXR5IiwidHJpZ2dlcnMiLCJ1cGRhdGVUcmFuc2Zvcm0iLCJjb21wb3VuZHMiLCJfdXBkYXRlQ29tcG91bmQiLCJraW5lbWF0aWMiLCJfdXBkYXRlS2luZW1hdGljIiwic3RlcFNpbXVsYXRpb24iLCJkeW5hbWljIiwiX3VwZGF0ZUR5bmFtaWMiLCJnZXRQb2ludGVyIiwicGh5c2ljc1RpbWUiLCJFVkVOVF9DT05UQUNUIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBYUEsSUFBSUEsWUFBWSxFQUFFQyxVQUFVLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxhQUFhLENBQUM7QUFDaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsV0FBVyxFQUFFO0FBQzVDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNILE1BQU0sR0FBR0EsTUFBTSxDQUFBOztBQUVwQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxLQUFLLEdBQUdBLEtBQUssQ0FBQTs7QUFFbEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBRXBCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsV0FBVyxHQUFHQSxXQUFXLENBQUE7QUFDbEMsR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1B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
