import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_KINEMATIC, BODYMASK_ALL, BODYGROUP_DYNAMIC, BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from './constants.js';
import { Component } from '../component.js';

// Shared math variable to avoid excessive allocation
let _ammoTransform;
let _ammoVec1, _ammoVec2, _ammoQuat;
const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();

/**
 * The rigidbody component, when combined with a {@link CollisionComponent}, allows your entities
 * to be simulated using realistic physics. A rigidbody component will fall under gravity and
 * collide with other rigid bodies. Using scripts, you can apply forces and impulses to rigid
 * bodies.
 *
 * You should never need to use the RigidBodyComponent constructor. To add an RigidBodyComponent to
 * a {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Create a static 1x1x1 box-shaped rigid body
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody"); // Without options, this defaults to a 'static' body
 * entity.addComponent("collision"); // Without options, this defaults to a 1x1x1 box shape
 * ```
 *
 * To create a dynamic sphere with mass of 10, do:
 *
 * ```javascript
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody", {
 *     type: pc.BODYTYPE_DYNAMIC,
 *     mass: 10
 * });
 * entity.addComponent("collision", {
 *     type: "sphere"
 * });
 * ```
 *
 * Relevant 'Engine-only' examples:
 *
 * - [Falling shapes](https://playcanvas.github.io/#/physics/falling-shapes)
 * - [Vehicle physics](https://playcanvas.github.io/#/physics/vehicle)
 *
 * @augments Component
 * @category Physics
 */
class RigidBodyComponent extends Component {
  /**
   * Create a new RigidBodyComponent instance.
   *
   * @param {import('./system.js').RigidBodyComponentSystem} system - The ComponentSystem that
   * created this component.
   * @param {import('../../entity.js').Entity} entity - The entity this component is attached to.
   */
  constructor(system, entity) {
    // eslint-disable-line no-useless-constructor
    super(system, entity);
    /** @private */
    this._angularDamping = 0;
    /** @private */
    this._angularFactor = new Vec3(1, 1, 1);
    /** @private */
    this._angularVelocity = new Vec3();
    /** @private */
    this._body = null;
    /** @private */
    this._friction = 0.5;
    /** @private */
    this._group = BODYGROUP_STATIC;
    /** @private */
    this._linearDamping = 0;
    /** @private */
    this._linearFactor = new Vec3(1, 1, 1);
    /** @private */
    this._linearVelocity = new Vec3();
    /** @private */
    this._mask = BODYMASK_NOT_STATIC;
    /** @private */
    this._mass = 1;
    /** @private */
    this._restitution = 0;
    /** @private */
    this._rollingFriction = 0;
    /** @private */
    this._simulationEnabled = false;
    /** @private */
    this._type = BODYTYPE_STATIC;
  }

  /** @ignore */
  static onLibraryLoaded() {
    // Lazily create shared variable
    if (typeof Ammo !== 'undefined') {
      _ammoTransform = new Ammo.btTransform();
      _ammoVec1 = new Ammo.btVector3();
      _ammoVec2 = new Ammo.btVector3();
      _ammoQuat = new Ammo.btQuaternion();
    }
  }

  /**
   * Controls the rate at which a body loses angular velocity over time.
   *
   * @type {number}
   */
  set angularDamping(damping) {
    if (this._angularDamping !== damping) {
      this._angularDamping = damping;
      if (this._body) {
        this._body.setDamping(this._linearDamping, damping);
      }
    }
  }
  get angularDamping() {
    return this._angularDamping;
  }

  /**
   * Scaling factor for angular movement of the body in each axis. Only valid for rigid bodies of
   * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely rotate).
   *
   * @type {Vec3}
   */
  set angularFactor(factor) {
    if (!this._angularFactor.equals(factor)) {
      this._angularFactor.copy(factor);
      if (this._body && this._type === BODYTYPE_DYNAMIC) {
        _ammoVec1.setValue(factor.x, factor.y, factor.z);
        this._body.setAngularFactor(_ammoVec1);
      }
    }
  }
  get angularFactor() {
    return this._angularFactor;
  }

  /**
   * Defines the rotational speed of the body around each world axis.
   *
   * @type {Vec3}
   */
  set angularVelocity(velocity) {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      this._body.activate();
      _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
      this._body.setAngularVelocity(_ammoVec1);
      this._angularVelocity.copy(velocity);
    }
  }
  get angularVelocity() {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      const velocity = this._body.getAngularVelocity();
      this._angularVelocity.set(velocity.x(), velocity.y(), velocity.z());
    }
    return this._angularVelocity;
  }
  set body(body) {
    if (this._body !== body) {
      this._body = body;
      if (body && this._simulationEnabled) {
        body.activate();
      }
    }
  }
  get body() {
    return this._body;
  }

  /**
   * The friction value used when contacts occur between two bodies. A higher value indicates
   * more friction. Should be set in the range 0 to 1. Defaults to 0.5.
   *
   * @type {number}
   */
  set friction(friction) {
    if (this._friction !== friction) {
      this._friction = friction;
      if (this._body) {
        this._body.setFriction(friction);
      }
    }
  }
  get friction() {
    return this._friction;
  }

  /**
   * The collision group this body belongs to. Combine the group and the mask to prevent bodies
   * colliding with each other. Defaults to 1.
   *
   * @type {number}
   */
  set group(group) {
    if (this._group !== group) {
      this._group = group;

      // re-enabling simulation adds rigidbody back into world with new masks
      if (this.enabled && this.entity.enabled) {
        this.disableSimulation();
        this.enableSimulation();
      }
    }
  }
  get group() {
    return this._group;
  }

  /**
   * Controls the rate at which a body loses linear velocity over time. Defaults to 0.
   *
   * @type {number}
   */
  set linearDamping(damping) {
    if (this._linearDamping !== damping) {
      this._linearDamping = damping;
      if (this._body) {
        this._body.setDamping(damping, this._angularDamping);
      }
    }
  }
  get linearDamping() {
    return this._linearDamping;
  }

  /**
   * Scaling factor for linear movement of the body in each axis. Only valid for rigid bodies of
   * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely move).
   *
   * @type {Vec3}
   */
  set linearFactor(factor) {
    if (!this._linearFactor.equals(factor)) {
      this._linearFactor.copy(factor);
      if (this._body && this._type === BODYTYPE_DYNAMIC) {
        _ammoVec1.setValue(factor.x, factor.y, factor.z);
        this._body.setLinearFactor(_ammoVec1);
      }
    }
  }
  get linearFactor() {
    return this._linearFactor;
  }

  /**
   * Defines the speed of the body in a given direction.
   *
   * @type {Vec3}
   */
  set linearVelocity(velocity) {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      this._body.activate();
      _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
      this._body.setLinearVelocity(_ammoVec1);
      this._linearVelocity.copy(velocity);
    }
  }
  get linearVelocity() {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      const velocity = this._body.getLinearVelocity();
      this._linearVelocity.set(velocity.x(), velocity.y(), velocity.z());
    }
    return this._linearVelocity;
  }

  /**
   * The collision mask sets which groups this body collides with. It is a bitfield of 16 bits,
   * the first 8 bits are reserved for engine use. Defaults to 65535.
   *
   * @type {number}
   */
  set mask(mask) {
    if (this._mask !== mask) {
      this._mask = mask;

      // re-enabling simulation adds rigidbody back into world with new masks
      if (this.enabled && this.entity.enabled) {
        this.disableSimulation();
        this.enableSimulation();
      }
    }
  }
  get mask() {
    return this._mask;
  }

  /**
   * The mass of the body. This is only relevant for {@link BODYTYPE_DYNAMIC} bodies, other types
   * have infinite mass. Defaults to 1.
   *
   * @type {number}
   */
  set mass(mass) {
    if (this._mass !== mass) {
      this._mass = mass;
      if (this._body && this._type === BODYTYPE_DYNAMIC) {
        const enabled = this.enabled && this.entity.enabled;
        if (enabled) {
          this.disableSimulation();
        }

        // calculateLocalInertia writes local inertia to ammoVec1 here...
        this._body.getCollisionShape().calculateLocalInertia(mass, _ammoVec1);
        // ...and then writes the calculated local inertia to the body
        this._body.setMassProps(mass, _ammoVec1);
        this._body.updateInertiaTensor();
        if (enabled) {
          this.enableSimulation();
        }
      }
    }
  }
  get mass() {
    return this._mass;
  }

  /**
   * Influences the amount of energy lost when two rigid bodies collide. The calculation
   * multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
   * that all energy is lost in the collision while a value of 1 means that no energy is lost.
   * Should be set in the range 0 to 1. Defaults to 0.
   *
   * @type {number}
   */
  set restitution(restitution) {
    if (this._restitution !== restitution) {
      this._restitution = restitution;
      if (this._body) {
        this._body.setRestitution(restitution);
      }
    }
  }
  get restitution() {
    return this._restitution;
  }

  /**
   * Sets a torsional friction orthogonal to the contact point. Defaults to 0.
   *
   * @type {number}
   */
  set rollingFriction(friction) {
    if (this._rollingFriction !== friction) {
      this._rollingFriction = friction;
      if (this._body) {
        this._body.setRollingFriction(friction);
      }
    }
  }
  get rollingFriction() {
    return this._rollingFriction;
  }

  /**
   * The rigid body type determines how the body is simulated. Can be:
   *
   * - {@link BODYTYPE_STATIC}: infinite mass and cannot move.
   * - {@link BODYTYPE_DYNAMIC}: simulated according to applied forces.
   * - {@link BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces (can only be
   * moved by setting the position and rotation of component's {@link Entity}).
   *
   * Defaults to {@link BODYTYPE_STATIC}.
   *
   * @type {string}
   */
  set type(type) {
    if (this._type !== type) {
      this._type = type;
      this.disableSimulation();

      // set group and mask to defaults for type
      switch (type) {
        case BODYTYPE_DYNAMIC:
          this._group = BODYGROUP_DYNAMIC;
          this._mask = BODYMASK_ALL;
          break;
        case BODYTYPE_KINEMATIC:
          this._group = BODYGROUP_KINEMATIC;
          this._mask = BODYMASK_ALL;
          break;
        case BODYTYPE_STATIC:
        default:
          this._group = BODYGROUP_STATIC;
          this._mask = BODYMASK_NOT_STATIC;
          break;
      }

      // Create a new body
      this.createBody();
    }
  }
  get type() {
    return this._type;
  }

  /**
   * If the Entity has a Collision shape attached then create a rigid body using this shape. This
   * method destroys the existing body.
   *
   * @private
   */
  createBody() {
    const entity = this.entity;
    let shape;
    if (entity.collision) {
      shape = entity.collision.shape;

      // if a trigger was already created from the collision system
      // destroy it
      if (entity.trigger) {
        entity.trigger.destroy();
        delete entity.trigger;
      }
    }
    if (shape) {
      if (this._body) {
        this.system.removeBody(this._body);
        this.system.destroyBody(this._body);
        this._body = null;
      }
      const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;
      this._getEntityTransform(_ammoTransform);
      const body = this.system.createBody(mass, shape, _ammoTransform);
      body.setRestitution(this._restitution);
      body.setFriction(this._friction);
      body.setRollingFriction(this._rollingFriction);
      body.setDamping(this._linearDamping, this._angularDamping);
      if (this._type === BODYTYPE_DYNAMIC) {
        const linearFactor = this._linearFactor;
        _ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
        body.setLinearFactor(_ammoVec1);
        const angularFactor = this._angularFactor;
        _ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
        body.setAngularFactor(_ammoVec1);
      } else if (this._type === BODYTYPE_KINEMATIC) {
        body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_KINEMATIC_OBJECT);
        body.setActivationState(BODYSTATE_DISABLE_DEACTIVATION);
      }
      body.entity = entity;
      this.body = body;
      if (this.enabled && entity.enabled) {
        this.enableSimulation();
      }
    }
  }

  /**
   * Returns true if the rigid body is currently actively being simulated. I.e. Not 'sleeping'.
   *
   * @returns {boolean} True if the body is active.
   */
  isActive() {
    return this._body ? this._body.isActive() : false;
  }

  /**
   * Forcibly activate the rigid body simulation. Only affects rigid bodies of type
   * {@link BODYTYPE_DYNAMIC}.
   */
  activate() {
    if (this._body) {
      this._body.activate();
    }
  }

  /**
   * Add a body to the simulation.
   *
   * @ignore
   */
  enableSimulation() {
    const entity = this.entity;
    if (entity.collision && entity.collision.enabled && !this._simulationEnabled) {
      const body = this._body;
      if (body) {
        this.system.addBody(body, this._group, this._mask);
        switch (this._type) {
          case BODYTYPE_DYNAMIC:
            this.system._dynamic.push(this);
            body.forceActivationState(BODYSTATE_ACTIVE_TAG);
            this.syncEntityToBody();
            break;
          case BODYTYPE_KINEMATIC:
            this.system._kinematic.push(this);
            body.forceActivationState(BODYSTATE_DISABLE_DEACTIVATION);
            break;
          case BODYTYPE_STATIC:
            body.forceActivationState(BODYSTATE_ACTIVE_TAG);
            this.syncEntityToBody();
            break;
        }
        if (entity.collision.type === 'compound') {
          this.system._compounds.push(entity.collision);
        }
        body.activate();
        this._simulationEnabled = true;
      }
    }
  }

  /**
   * Remove a body from the simulation.
   *
   * @ignore
   */
  disableSimulation() {
    const body = this._body;
    if (body && this._simulationEnabled) {
      const system = this.system;
      let idx = system._compounds.indexOf(this.entity.collision);
      if (idx > -1) {
        system._compounds.splice(idx, 1);
      }
      idx = system._dynamic.indexOf(this);
      if (idx > -1) {
        system._dynamic.splice(idx, 1);
      }
      idx = system._kinematic.indexOf(this);
      if (idx > -1) {
        system._kinematic.splice(idx, 1);
      }
      system.removeBody(body);

      // set activation state to disable simulation to avoid body.isActive() to return
      // true even if it's not in the dynamics world
      body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
      this._simulationEnabled = false;
    }
  }

  /**
   * Apply an force to the body at a point. By default, the force is applied at the origin of the
   * body. However, the force can be applied at an offset this point by specifying a world space
   * vector from the body's origin to the point of application. This function has two valid
   * signatures. You can either specify the force (and optional relative point) via 3D-vector or
   * numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the force in world-space or
   * the x-component of the force in world-space.
   * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
   * at which to apply the impulse in world-space or the y-component of the force in world-space.
   * @param {number} [z] - The z-component of the force in world-space.
   * @param {number} [px] - The x-component of a world-space offset from the body's position
   * where the force is applied.
   * @param {number} [py] - The y-component of a world-space offset from the body's position
   * where the force is applied.
   * @param {number} [pz] - The z-component of a world-space offset from the body's position
   * where the force is applied.
   * @example
   * // Apply an approximation of gravity at the body's center
   * this.entity.rigidbody.applyForce(0, -10, 0);
   * @example
   * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
   * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
   * @example
   * // Apply a force at the body's center
   * // Calculate a force vector pointing in the world space direction of the entity
   * const force = this.entity.forward.clone().mulScalar(100);
   *
   * // Apply the force
   * this.entity.rigidbody.applyForce(force);
   * @example
   * // Apply a force at some relative offset from the body's center
   * // Calculate a force vector pointing in the world space direction of the entity
   * const force = this.entity.forward.clone().mulScalar(100);
   *
   * // Calculate the world space relative offset
   * const relativePos = new pc.Vec3();
   * const childEntity = this.entity.findByName('Engine');
   * relativePos.sub2(childEntity.getPosition(), this.entity.getPosition());
   *
   * // Apply the force
   * this.entity.rigidbody.applyForce(force, relativePos);
   */
  applyForce(x, y, z, px, py, pz) {
    const body = this._body;
    if (body) {
      body.activate();
      if (x instanceof Vec3) {
        _ammoVec1.setValue(x.x, x.y, x.z);
      } else {
        _ammoVec1.setValue(x, y, z);
      }
      if (y instanceof Vec3) {
        _ammoVec2.setValue(y.x, y.y, y.z);
      } else if (px !== undefined) {
        _ammoVec2.setValue(px, py, pz);
      } else {
        _ammoVec2.setValue(0, 0, 0);
      }
      body.applyForce(_ammoVec1, _ammoVec2);
    }
  }

  /**
   * Apply torque (rotational force) to the body. This function has two valid signatures. You can
   * either specify the torque force with a 3D-vector or with 3 numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the torque force in world-space
   * or the x-component of the torque force in world-space.
   * @param {number} [y] - The y-component of the torque force in world-space.
   * @param {number} [z] - The z-component of the torque force in world-space.
   * @example
   * // Apply via vector
   * const torque = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyTorque(torque);
   * @example
   * // Apply via numbers
   * entity.rigidbody.applyTorque(0, 10, 0);
   */
  applyTorque(x, y, z) {
    const body = this._body;
    if (body) {
      body.activate();
      if (x instanceof Vec3) {
        _ammoVec1.setValue(x.x, x.y, x.z);
      } else {
        _ammoVec1.setValue(x, y, z);
      }
      body.applyTorque(_ammoVec1);
    }
  }

  /**
   * Apply an impulse (instantaneous change of velocity) to the body at a point. This function
   * has two valid signatures. You can either specify the impulse (and optional relative point)
   * via 3D-vector or numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the impulse in world-space or
   * the x-component of the impulse in world-space.
   * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
   * at which to apply the impulse in the local-space of the entity or the y-component of the
   * impulse to apply in world-space.
   * @param {number} [z] - The z-component of the impulse to apply in world-space.
   * @param {number} [px] - The x-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @param {number} [py] - The y-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @param {number} [pz] - The z-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @example
   * // Apply an impulse along the world-space positive y-axis at the entity's position.
   * const impulse = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyImpulse(impulse);
   * @example
   * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
   * // z-axis of the entity's local-space.
   * const impulse = new pc.Vec3(0, 10, 0);
   * const relativePoint = new pc.Vec3(0, 0, 1);
   * entity.rigidbody.applyImpulse(impulse, relativePoint);
   * @example
   * // Apply an impulse along the world-space positive y-axis at the entity's position.
   * entity.rigidbody.applyImpulse(0, 10, 0);
   * @example
   * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
   * // z-axis of the entity's local-space.
   * entity.rigidbody.applyImpulse(0, 10, 0, 0, 0, 1);
   */
  applyImpulse(x, y, z, px, py, pz) {
    const body = this._body;
    if (body) {
      body.activate();
      if (x instanceof Vec3) {
        _ammoVec1.setValue(x.x, x.y, x.z);
      } else {
        _ammoVec1.setValue(x, y, z);
      }
      if (y instanceof Vec3) {
        _ammoVec2.setValue(y.x, y.y, y.z);
      } else if (px !== undefined) {
        _ammoVec2.setValue(px, py, pz);
      } else {
        _ammoVec2.setValue(0, 0, 0);
      }
      body.applyImpulse(_ammoVec1, _ammoVec2);
    }
  }

  /**
   * Apply a torque impulse (rotational force applied instantaneously) to the body. This function
   * has two valid signatures. You can either specify the torque force with a 3D-vector or with 3
   * numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the torque impulse in
   * world-space or the x-component of the torque impulse in world-space.
   * @param {number} [y] - The y-component of the torque impulse in world-space.
   * @param {number} [z] - The z-component of the torque impulse in world-space.
   * @example
   * // Apply via vector
   * const torque = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyTorqueImpulse(torque);
   * @example
   * // Apply via numbers
   * entity.rigidbody.applyTorqueImpulse(0, 10, 0);
   */
  applyTorqueImpulse(x, y, z) {
    const body = this._body;
    if (body) {
      body.activate();
      if (x instanceof Vec3) {
        _ammoVec1.setValue(x.x, x.y, x.z);
      } else {
        _ammoVec1.setValue(x, y, z);
      }
      body.applyTorqueImpulse(_ammoVec1);
    }
  }

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_STATIC}.
   *
   * @returns {boolean} True if static.
   */
  isStatic() {
    return this._type === BODYTYPE_STATIC;
  }

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_STATIC} or {@link BODYTYPE_KINEMATIC}.
   *
   * @returns {boolean} True if static or kinematic.
   */
  isStaticOrKinematic() {
    return this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC;
  }

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_KINEMATIC}.
   *
   * @returns {boolean} True if kinematic.
   */
  isKinematic() {
    return this._type === BODYTYPE_KINEMATIC;
  }

  /**
   * Writes an entity transform into an Ammo.btTransform but ignoring scale.
   *
   * @param {object} transform - The ammo transform to write the entity transform to.
   * @private
   */
  _getEntityTransform(transform) {
    const entity = this.entity;
    const component = entity.collision;
    if (component) {
      const bodyPos = component.getShapePosition();
      const bodyRot = component.getShapeRotation();
      _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
      _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
    } else {
      const pos = entity.getPosition();
      const rot = entity.getRotation();
      _ammoVec1.setValue(pos.x, pos.y, pos.z);
      _ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    }
    transform.setOrigin(_ammoVec1);
    transform.setRotation(_ammoQuat);
  }

  /**
   * Set the rigid body transform to be the same as the Entity transform. This must be called
   * after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called in
   * order to update the rigid body to match the Entity.
   *
   * @private
   */
  syncEntityToBody() {
    const body = this._body;
    if (body) {
      this._getEntityTransform(_ammoTransform);
      body.setWorldTransform(_ammoTransform);
      if (this._type === BODYTYPE_KINEMATIC) {
        const motionState = body.getMotionState();
        if (motionState) {
          motionState.setWorldTransform(_ammoTransform);
        }
      }
      body.activate();
    }
  }

  /**
   * Sets an entity's transform to match that of the world transformation matrix of a dynamic
   * rigid body's motion state.
   *
   * @private
   */
  _updateDynamic() {
    const body = this._body;

    // If a dynamic body is frozen, we can assume its motion state transform is
    // the same is the entity world transform
    if (body.isActive()) {
      // Update the motion state. Note that the test for the presence of the motion
      // state is technically redundant since the engine creates one for all bodies.
      const motionState = body.getMotionState();
      if (motionState) {
        const entity = this.entity;
        motionState.getWorldTransform(_ammoTransform);
        const p = _ammoTransform.getOrigin();
        const q = _ammoTransform.getRotation();
        const component = entity.collision;
        if (component && component._hasOffset) {
          const lo = component.data.linearOffset;
          const ao = component.data.angularOffset;

          // Un-rotate the angular offset and then use the new rotation to
          // un-translate the linear offset in local space
          // Order of operations matter here
          const invertedAo = _quat2.copy(ao).invert();
          const entityRot = _quat1.set(q.x(), q.y(), q.z(), q.w()).mul(invertedAo);
          entityRot.transformVector(lo, _vec3);
          entity.setPosition(p.x() - _vec3.x, p.y() - _vec3.y, p.z() - _vec3.z);
          entity.setRotation(entityRot);
        } else {
          entity.setPosition(p.x(), p.y(), p.z());
          entity.setRotation(q.x(), q.y(), q.z(), q.w());
        }
      }
    }
  }

  /**
   * Writes the entity's world transformation matrix into the motion state of a kinematic body.
   *
   * @private
   */
  _updateKinematic() {
    const motionState = this._body.getMotionState();
    if (motionState) {
      this._getEntityTransform(_ammoTransform);
      motionState.setWorldTransform(_ammoTransform);
    }
  }

  /**
   * Teleport an entity to a new world-space position, optionally setting orientation. This
   * function should only be called for rigid bodies that are dynamic. This function has three
   * valid signatures. The first takes a 3-dimensional vector for the position and an optional
   * 3-dimensional vector for Euler rotation. The second takes a 3-dimensional vector for the
   * position and an optional quaternion for rotation. The third takes 3 numbers for the position
   * and an optional 3 numbers for Euler rotation.
   *
   * @param {Vec3|number} x - A 3-dimensional vector holding the new position or the new position
   * x-coordinate.
   * @param {Quat|Vec3|number} [y] - A 3-dimensional vector or quaternion holding the new
   * rotation or the new position y-coordinate.
   * @param {number} [z] - The new position z-coordinate.
   * @param {number} [rx] - The new Euler x-angle value.
   * @param {number} [ry] - The new Euler y-angle value.
   * @param {number} [rz] - The new Euler z-angle value.
   * @example
   * // Teleport the entity to the origin
   * entity.rigidbody.teleport(pc.Vec3.ZERO);
   * @example
   * // Teleport the entity to the origin
   * entity.rigidbody.teleport(0, 0, 0);
   * @example
   * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
   * const position = new pc.Vec3(1, 2, 3);
   * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
   * @example
   * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
   * entity.rigidbody.teleport(1, 2, 3, 0, 0, 0);
   */
  teleport(x, y, z, rx, ry, rz) {
    if (x instanceof Vec3) {
      this.entity.setPosition(x);
    } else {
      this.entity.setPosition(x, y, z);
    }
    if (y instanceof Quat) {
      this.entity.setRotation(y);
    } else if (y instanceof Vec3) {
      this.entity.setEulerAngles(y);
    } else if (rx !== undefined) {
      this.entity.setEulerAngles(rx, ry, rz);
    }
    this.syncEntityToBody();
  }

  /** @ignore */
  onEnable() {
    if (!this._body) {
      this.createBody();
    }
    this.enableSimulation();
  }

  /** @ignore */
  onDisable() {
    this.disableSimulation();
  }
}
/**
 * Fired when a contact occurs between two rigid bodies. The handler is passed a
 * {@link ContactResult} object containing details of the contact between the two rigid bodies.
 *
 * @event
 * @example
 * entity.rigidbody.on('contact', (result) => {
 *    console.log(`Contact between ${entity.name} and ${result.other.name}`);
 * });
 */
RigidBodyComponent.EVENT_CONTACT = 'contact';
/**
 * Fired when two rigid bodies start touching. The handler is passed a {@link ContactResult}
 * object containing details of the contact between the two rigid bodies.
 *
 * @event
 * @example
 * entity.rigidbody.on('collisionstart', (result) => {
 *     console.log(`Collision started between ${entity.name} and ${result.other.name}`);
 * });
 */
RigidBodyComponent.EVENT_COLLISIONSTART = 'collisionstart';
/**
 * Fired when two rigid bodies stop touching. The handler is passed a {@link ContactResult}
 * object containing details of the contact between the two rigid bodies.
 *
 * @event
 * @example
 * entity.rigidbody.on('collisionend', (result) => {
 *     console.log(`Collision ended between ${entity.name} and ${result.other.name}`);
 * });
 */
RigidBodyComponent.EVENT_COLLISIONEND = 'collisionend';
/**
 * Fired when a rigid body enters a trigger volume. The handler is passed an {@link Entity}
 * representing the trigger volume that this rigid body entered.
 *
 * @event
 * @example
 * entity.rigidbody.on('triggerenter', (trigger) => {
 *     console.log(`Entity ${entity.name} entered trigger volume ${trigger.name}`);
 * });
 */
RigidBodyComponent.EVENT_TRIGGERENTER = 'triggerenter';
/**
 * Fired when a rigid body exits a trigger volume. The handler is passed an {@link Entity}
 * representing the trigger volume that this rigid body exited.
 *
 * @event
 * @example
 * entity.rigidbody.on('triggerleave', (trigger) => {
 *     console.log(`Entity ${entity.name} exited trigger volume ${trigger.name}`);
 * });
 */
RigidBodyComponent.EVENT_TRIGGERLEAVE = 'triggerleave';

export { RigidBodyComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWVRZUEVfU1RBVElDLFxuICAgIEJPRFlHUk9VUF9EWU5BTUlDLCBCT0RZR1JPVVBfS0lORU1BVElDLCBCT0RZR1JPVVBfU1RBVElDLFxuICAgIEJPRFlNQVNLX0FMTCwgQk9EWU1BU0tfTk9UX1NUQVRJQyxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQ1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vLyBTaGFyZWQgbWF0aCB2YXJpYWJsZSB0byBhdm9pZCBleGNlc3NpdmUgYWxsb2NhdGlvblxubGV0IF9hbW1vVHJhbnNmb3JtO1xubGV0IF9hbW1vVmVjMSwgX2FtbW9WZWMyLCBfYW1tb1F1YXQ7XG5jb25zdCBfcXVhdDEgPSBuZXcgUXVhdCgpO1xuY29uc3QgX3F1YXQyID0gbmV3IFF1YXQoKTtcbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgcmlnaWRib2R5IGNvbXBvbmVudCwgd2hlbiBjb21iaW5lZCB3aXRoIGEge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0sIGFsbG93cyB5b3VyIGVudGl0aWVzXG4gKiB0byBiZSBzaW11bGF0ZWQgdXNpbmcgcmVhbGlzdGljIHBoeXNpY3MuIEEgcmlnaWRib2R5IGNvbXBvbmVudCB3aWxsIGZhbGwgdW5kZXIgZ3Jhdml0eSBhbmRcbiAqIGNvbGxpZGUgd2l0aCBvdGhlciByaWdpZCBib2RpZXMuIFVzaW5nIHNjcmlwdHMsIHlvdSBjYW4gYXBwbHkgZm9yY2VzIGFuZCBpbXB1bHNlcyB0byByaWdpZFxuICogYm9kaWVzLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byB1c2UgdGhlIFJpZ2lkQm9keUNvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIFJpZ2lkQm9keUNvbXBvbmVudCB0b1xuICogYSB7QGxpbmsgRW50aXR5fSwgdXNlIHtAbGluayBFbnRpdHkjYWRkQ29tcG9uZW50fTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDcmVhdGUgYSBzdGF0aWMgMXgxeDEgYm94LXNoYXBlZCByaWdpZCBib2R5XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhICdzdGF0aWMnIGJvZHlcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhIDF4MXgxIGJveCBzaGFwZVxuICogYGBgXG4gKlxuICogVG8gY3JlYXRlIGEgZHluYW1pYyBzcGhlcmUgd2l0aCBtYXNzIG9mIDEwLCBkbzpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIiwge1xuICogICAgIHR5cGU6IHBjLkJPRFlUWVBFX0RZTkFNSUMsXG4gKiAgICAgbWFzczogMTBcbiAqIH0pO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiLCB7XG4gKiAgICAgdHlwZTogXCJzcGhlcmVcIlxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICpcbiAqIC0gW0ZhbGxpbmcgc2hhcGVzXShodHRwczovL3BsYXljYW52YXMuZ2l0aHViLmlvLyMvcGh5c2ljcy9mYWxsaW5nLXNoYXBlcylcbiAqIC0gW1ZlaGljbGUgcGh5c2ljc10oaHR0cHM6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jL3BoeXNpY3MvdmVoaWNsZSlcbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAY2F0ZWdvcnkgUGh5c2ljc1xuICovXG5jbGFzcyBSaWdpZEJvZHlDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBjb250YWN0IG9jY3VycyBiZXR3ZWVuIHR3byByaWdpZCBib2RpZXMuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhXG4gICAgICoge0BsaW5rIENvbnRhY3RSZXN1bHR9IG9iamVjdCBjb250YWluaW5nIGRldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5vbignY29udGFjdCcsIChyZXN1bHQpID0+IHtcbiAgICAgKiAgICBjb25zb2xlLmxvZyhgQ29udGFjdCBiZXR3ZWVuICR7ZW50aXR5Lm5hbWV9IGFuZCAke3Jlc3VsdC5vdGhlci5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9DT05UQUNUID0gJ2NvbnRhY3QnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgYSB7QGxpbmsgQ29udGFjdFJlc3VsdH1cbiAgICAgKiBvYmplY3QgY29udGFpbmluZyBkZXRhaWxzIG9mIHRoZSBjb250YWN0IGJldHdlZW4gdGhlIHR3byByaWdpZCBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkub24oJ2NvbGxpc2lvbnN0YXJ0JywgKHJlc3VsdCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQ29sbGlzaW9uIHN0YXJ0ZWQgYmV0d2VlbiAke2VudGl0eS5uYW1lfSBhbmQgJHtyZXN1bHQub3RoZXIubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfQ09MTElTSU9OU1RBUlQgPSAnY29sbGlzaW9uc3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0b3AgdG91Y2hpbmcuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhIHtAbGluayBDb250YWN0UmVzdWx0fVxuICAgICAqIG9iamVjdCBjb250YWluaW5nIGRldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5vbignY29sbGlzaW9uZW5kJywgKHJlc3VsdCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQ29sbGlzaW9uIGVuZGVkIGJldHdlZW4gJHtlbnRpdHkubmFtZX0gYW5kICR7cmVzdWx0Lm90aGVyLm5hbWV9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0NPTExJU0lPTkVORCA9ICdjb2xsaXNpb25lbmQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZW50ZXJzIGEgdHJpZ2dlciB2b2x1bWUuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhbiB7QGxpbmsgRW50aXR5fVxuICAgICAqIHJlcHJlc2VudGluZyB0aGUgdHJpZ2dlciB2b2x1bWUgdGhhdCB0aGlzIHJpZ2lkIGJvZHkgZW50ZXJlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5vbigndHJpZ2dlcmVudGVyJywgKHRyaWdnZXIpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYEVudGl0eSAke2VudGl0eS5uYW1lfSBlbnRlcmVkIHRyaWdnZXIgdm9sdW1lICR7dHJpZ2dlci5uYW1lfWApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9UUklHR0VSRU5URVIgPSAndHJpZ2dlcmVudGVyJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSByaWdpZCBib2R5IGV4aXRzIGEgdHJpZ2dlciB2b2x1bWUuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCBhbiB7QGxpbmsgRW50aXR5fVxuICAgICAqIHJlcHJlc2VudGluZyB0aGUgdHJpZ2dlciB2b2x1bWUgdGhhdCB0aGlzIHJpZ2lkIGJvZHkgZXhpdGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5Lm9uKCd0cmlnZ2VybGVhdmUnLCAodHJpZ2dlcikgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgRW50aXR5ICR7ZW50aXR5Lm5hbWV9IGV4aXRlZCB0cmlnZ2VyIHZvbHVtZSAke3RyaWdnZXIubmFtZX1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfVFJJR0dFUkxFQVZFID0gJ3RyaWdnZXJsZWF2ZSc7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfYW5ndWxhckRhbXBpbmcgPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2FuZ3VsYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9hbmd1bGFyVmVsb2NpdHkgPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JvZHkgPSBudWxsO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZyaWN0aW9uID0gMC41O1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJEYW1waW5nID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJWZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzcyA9IDE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVzdGl0dXRpb24gPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JvbGxpbmdGcmljdGlvbiA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF90eXBlID0gQk9EWVRZUEVfU1RBVElDO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoaXMgY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBzdGF0aWMgb25MaWJyYXJ5TG9hZGVkKCkge1xuICAgICAgICAvLyBMYXppbHkgY3JlYXRlIHNoYXJlZCB2YXJpYWJsZVxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBfYW1tb1RyYW5zZm9ybSA9IG5ldyBBbW1vLmJ0VHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBfYW1tb1ZlYzEgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIF9hbW1vVmVjMiA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgX2FtbW9RdWF0ID0gbmV3IEFtbW8uYnRRdWF0ZXJuaW9uKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGJvZHkgbG9zZXMgYW5ndWxhciB2ZWxvY2l0eSBvdmVyIHRpbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbmd1bGFyRGFtcGluZyhkYW1waW5nKSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmd1bGFyRGFtcGluZyAhPT0gZGFtcGluZykge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmcgPSBkYW1waW5nO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RGFtcGluZyh0aGlzLl9saW5lYXJEYW1waW5nLCBkYW1waW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyRGFtcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJEYW1waW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNjYWxpbmcgZmFjdG9yIGZvciBhbmd1bGFyIG1vdmVtZW50IG9mIHRoZSBib2R5IGluIGVhY2ggYXhpcy4gT25seSB2YWxpZCBmb3IgcmlnaWQgYm9kaWVzIG9mXG4gICAgICogdHlwZSB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uIERlZmF1bHRzIHRvIDEgaW4gYWxsIGF4ZXMgKGJvZHkgY2FuIGZyZWVseSByb3RhdGUpLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJGYWN0b3IoZmFjdG9yKSB7XG4gICAgICAgIGlmICghdGhpcy5fYW5ndWxhckZhY3Rvci5lcXVhbHMoZmFjdG9yKSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhckZhY3Rvci5jb3B5KGZhY3Rvcik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoZmFjdG9yLngsIGZhY3Rvci55LCBmYWN0b3Iueik7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyRmFjdG9yKF9hbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJGYWN0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyB0aGUgcm90YXRpb25hbCBzcGVlZCBvZiB0aGUgYm9keSBhcm91bmQgZWFjaCB3b3JsZCBheGlzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJWZWxvY2l0eSh2ZWxvY2l0eSkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh2ZWxvY2l0eS54LCB2ZWxvY2l0eS55LCB2ZWxvY2l0eS56KTtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0QW5ndWxhclZlbG9jaXR5KF9hbW1vVmVjMSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlbG9jaXR5ID0gdGhpcy5fYm9keS5nZXRBbmd1bGFyVmVsb2NpdHkoKTtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eTtcbiAgICB9XG5cbiAgICBzZXQgYm9keShib2R5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICE9PSBib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5ID0gYm9keTtcblxuICAgICAgICAgICAgaWYgKGJvZHkgJiYgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYm9keSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvZHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZyaWN0aW9uIHZhbHVlIHVzZWQgd2hlbiBjb250YWN0cyBvY2N1ciBiZXR3ZWVuIHR3byBib2RpZXMuIEEgaGlnaGVyIHZhbHVlIGluZGljYXRlc1xuICAgICAqIG1vcmUgZnJpY3Rpb24uIFNob3VsZCBiZSBzZXQgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC41LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZnJpY3Rpb24oZnJpY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZyaWN0aW9uICE9PSBmcmljdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fZnJpY3Rpb24gPSBmcmljdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldEZyaWN0aW9uKGZyaWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmcmljdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZyaWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gZ3JvdXAgdGhpcyBib2R5IGJlbG9uZ3MgdG8uIENvbWJpbmUgdGhlIGdyb3VwIGFuZCB0aGUgbWFzayB0byBwcmV2ZW50IGJvZGllc1xuICAgICAqIGNvbGxpZGluZyB3aXRoIGVhY2ggb3RoZXIuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBncm91cChncm91cCkge1xuICAgICAgICBpZiAodGhpcy5fZ3JvdXAgIT09IGdyb3VwKSB7XG4gICAgICAgICAgICB0aGlzLl9ncm91cCA9IGdyb3VwO1xuXG4gICAgICAgICAgICAvLyByZS1lbmFibGluZyBzaW11bGF0aW9uIGFkZHMgcmlnaWRib2R5IGJhY2sgaW50byB3b3JsZCB3aXRoIG5ldyBtYXNrc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGdyb3VwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIHJhdGUgYXQgd2hpY2ggYSBib2R5IGxvc2VzIGxpbmVhciB2ZWxvY2l0eSBvdmVyIHRpbWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xpbmVhckRhbXBpbmcgIT09IGRhbXBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmcgPSBkYW1waW5nO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RGFtcGluZyhkYW1waW5nLCB0aGlzLl9hbmd1bGFyRGFtcGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRGFtcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGxpbmVhciBtb3ZlbWVudCBvZiB0aGUgYm9keSBpbiBlYWNoIGF4aXMuIE9ubHkgdmFsaWQgZm9yIHJpZ2lkIGJvZGllcyBvZlxuICAgICAqIHR5cGUge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LiBEZWZhdWx0cyB0byAxIGluIGFsbCBheGVzIChib2R5IGNhbiBmcmVlbHkgbW92ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgbGluZWFyRmFjdG9yKGZhY3Rvcikge1xuICAgICAgICBpZiAoIXRoaXMuX2xpbmVhckZhY3Rvci5lcXVhbHMoZmFjdG9yKSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShmYWN0b3IueCwgZmFjdG9yLnksIGZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldExpbmVhckZhY3RvcihfYW1tb1ZlYzEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhckZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckZhY3RvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSBzcGVlZCBvZiB0aGUgYm9keSBpbiBhIGdpdmVuIGRpcmVjdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJWZWxvY2l0eSh2ZWxvY2l0eSkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh2ZWxvY2l0eS54LCB2ZWxvY2l0eS55LCB2ZWxvY2l0eS56KTtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyVmVsb2NpdHkoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgdGhpcy5fbGluZWFyVmVsb2NpdHkuY29weSh2ZWxvY2l0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlbG9jaXR5ID0gdGhpcy5fYm9keS5nZXRMaW5lYXJWZWxvY2l0eSgpO1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyVmVsb2NpdHkuc2V0KHZlbG9jaXR5LngoKSwgdmVsb2NpdHkueSgpLCB2ZWxvY2l0eS56KCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJWZWxvY2l0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sbGlzaW9uIG1hc2sgc2V0cyB3aGljaCBncm91cHMgdGhpcyBib2R5IGNvbGxpZGVzIHdpdGguIEl0IGlzIGEgYml0ZmllbGQgb2YgMTYgYml0cyxcbiAgICAgKiB0aGUgZmlyc3QgOCBiaXRzIGFyZSByZXNlcnZlZCBmb3IgZW5naW5lIHVzZS4gRGVmYXVsdHMgdG8gNjU1MzUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2sgPSBtYXNrO1xuXG4gICAgICAgICAgICAvLyByZS1lbmFibGluZyBzaW11bGF0aW9uIGFkZHMgcmlnaWRib2R5IGJhY2sgaW50byB3b3JsZCB3aXRoIG5ldyBtYXNrc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXNzIG9mIHRoZSBib2R5LiBUaGlzIGlzIG9ubHkgcmVsZXZhbnQgZm9yIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfSBib2RpZXMsIG90aGVyIHR5cGVzXG4gICAgICogaGF2ZSBpbmZpbml0ZSBtYXNzLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFzcyhtYXNzKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXNzICE9PSBtYXNzKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXNzID0gbWFzcztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZDtcbiAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlTG9jYWxJbmVydGlhIHdyaXRlcyBsb2NhbCBpbmVydGlhIHRvIGFtbW9WZWMxIGhlcmUuLi5cbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LmdldENvbGxpc2lvblNoYXBlKCkuY2FsY3VsYXRlTG9jYWxJbmVydGlhKG1hc3MsIF9hbW1vVmVjMSk7XG4gICAgICAgICAgICAgICAgLy8gLi4uYW5kIHRoZW4gd3JpdGVzIHRoZSBjYWxjdWxhdGVkIGxvY2FsIGluZXJ0aWEgdG8gdGhlIGJvZHlcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldE1hc3NQcm9wcyhtYXNzLCBfYW1tb1ZlYzEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkudXBkYXRlSW5lcnRpYVRlbnNvcigpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluZmx1ZW5jZXMgdGhlIGFtb3VudCBvZiBlbmVyZ3kgbG9zdCB3aGVuIHR3byByaWdpZCBib2RpZXMgY29sbGlkZS4gVGhlIGNhbGN1bGF0aW9uXG4gICAgICogbXVsdGlwbGllcyB0aGUgcmVzdGl0dXRpb24gdmFsdWVzIGZvciBib3RoIGNvbGxpZGluZyBib2RpZXMuIEEgbXVsdGlwbGllZCB2YWx1ZSBvZiAwIG1lYW5zXG4gICAgICogdGhhdCBhbGwgZW5lcmd5IGlzIGxvc3QgaW4gdGhlIGNvbGxpc2lvbiB3aGlsZSBhIHZhbHVlIG9mIDEgbWVhbnMgdGhhdCBubyBlbmVyZ3kgaXMgbG9zdC5cbiAgICAgKiBTaG91bGQgYmUgc2V0IGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZXN0aXR1dGlvbihyZXN0aXR1dGlvbikge1xuICAgICAgICBpZiAodGhpcy5fcmVzdGl0dXRpb24gIT09IHJlc3RpdHV0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXN0aXR1dGlvbiA9IHJlc3RpdHV0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0UmVzdGl0dXRpb24ocmVzdGl0dXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlc3RpdHV0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzdGl0dXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHRvcnNpb25hbCBmcmljdGlvbiBvcnRob2dvbmFsIHRvIHRoZSBjb250YWN0IHBvaW50LiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcm9sbGluZ0ZyaWN0aW9uKGZyaWN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9yb2xsaW5nRnJpY3Rpb24gIT09IGZyaWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9yb2xsaW5nRnJpY3Rpb24gPSBmcmljdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldFJvbGxpbmdGcmljdGlvbihmcmljdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcm9sbGluZ0ZyaWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9sbGluZ0ZyaWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByaWdpZCBib2R5IHR5cGUgZGV0ZXJtaW5lcyBob3cgdGhlIGJvZHkgaXMgc2ltdWxhdGVkLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9OiBpbmZpbml0ZSBtYXNzIGFuZCBjYW5ub3QgbW92ZS5cbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfTogc2ltdWxhdGVkIGFjY29yZGluZyB0byBhcHBsaWVkIGZvcmNlcy5cbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9OiBpbmZpbml0ZSBtYXNzIGFuZCBkb2VzIG5vdCByZXNwb25kIHRvIGZvcmNlcyAoY2FuIG9ubHkgYmVcbiAgICAgKiBtb3ZlZCBieSBzZXR0aW5nIHRoZSBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgY29tcG9uZW50J3Mge0BsaW5rIEVudGl0eX0pLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHR5cGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgIT09IHR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlO1xuXG4gICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG5cbiAgICAgICAgICAgIC8vIHNldCBncm91cCBhbmQgbWFzayB0byBkZWZhdWx0cyBmb3IgdHlwZVxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9EWU5BTUlDOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9EWU5BTUlDO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfQUxMO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX0tJTkVNQVRJQzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JvdXAgPSBCT0RZR1JPVVBfS0lORU1BVElDO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfQUxMO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX1NUQVRJQzpcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9TVEFUSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19OT1RfU1RBVElDO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGJvZHlcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm9keSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRoZSBFbnRpdHkgaGFzIGEgQ29sbGlzaW9uIHNoYXBlIGF0dGFjaGVkIHRoZW4gY3JlYXRlIGEgcmlnaWQgYm9keSB1c2luZyB0aGlzIHNoYXBlLiBUaGlzXG4gICAgICogbWV0aG9kIGRlc3Ryb3lzIHRoZSBleGlzdGluZyBib2R5LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjcmVhdGVCb2R5KCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgbGV0IHNoYXBlO1xuXG4gICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICBzaGFwZSA9IGVudGl0eS5jb2xsaXNpb24uc2hhcGU7XG5cbiAgICAgICAgICAgIC8vIGlmIGEgdHJpZ2dlciB3YXMgYWxyZWFkeSBjcmVhdGVkIGZyb20gdGhlIGNvbGxpc2lvbiBzeXN0ZW1cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaXRcbiAgICAgICAgICAgIGlmIChlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgZW50aXR5LnRyaWdnZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hhcGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVtb3ZlQm9keSh0aGlzLl9ib2R5KTtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5kZXN0cm95Qm9keSh0aGlzLl9ib2R5KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtYXNzID0gdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQyA/IHRoaXMuX21hc3MgOiAwO1xuXG4gICAgICAgICAgICB0aGlzLl9nZXRFbnRpdHlUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5zeXN0ZW0uY3JlYXRlQm9keShtYXNzLCBzaGFwZSwgX2FtbW9UcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICBib2R5LnNldFJlc3RpdHV0aW9uKHRoaXMuX3Jlc3RpdHV0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0RnJpY3Rpb24odGhpcy5fZnJpY3Rpb24pO1xuICAgICAgICAgICAgYm9keS5zZXRSb2xsaW5nRnJpY3Rpb24odGhpcy5fcm9sbGluZ0ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0RGFtcGluZyh0aGlzLl9saW5lYXJEYW1waW5nLCB0aGlzLl9hbmd1bGFyRGFtcGluZyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZWFyRmFjdG9yID0gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShsaW5lYXJGYWN0b3IueCwgbGluZWFyRmFjdG9yLnksIGxpbmVhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldExpbmVhckZhY3RvcihfYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckZhY3RvciA9IHRoaXMuX2FuZ3VsYXJGYWN0b3I7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGFuZ3VsYXJGYWN0b3IueCwgYW5ndWxhckZhY3Rvci55LCBhbmd1bGFyRmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0QW5ndWxhckZhY3RvcihfYW1tb1ZlYzEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBib2R5LnNldENvbGxpc2lvbkZsYWdzKGJvZHkuZ2V0Q29sbGlzaW9uRmxhZ3MoKSB8IEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QpO1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0QWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuZW50aXR5ID0gZW50aXR5O1xuXG4gICAgICAgICAgICB0aGlzLmJvZHkgPSBib2R5O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIGVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgY3VycmVudGx5IGFjdGl2ZWx5IGJlaW5nIHNpbXVsYXRlZC4gSS5lLiBOb3QgJ3NsZWVwaW5nJy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBib2R5IGlzIGFjdGl2ZS5cbiAgICAgKi9cbiAgICBpc0FjdGl2ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvZHkgPyB0aGlzLl9ib2R5LmlzQWN0aXZlKCkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JjaWJseSBhY3RpdmF0ZSB0aGUgcmlnaWQgYm9keSBzaW11bGF0aW9uLiBPbmx5IGFmZmVjdHMgcmlnaWQgYm9kaWVzIG9mIHR5cGVcbiAgICAgKiB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uXG4gICAgICovXG4gICAgYWN0aXZhdGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBib2R5IHRvIHRoZSBzaW11bGF0aW9uLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuYWJsZVNpbXVsYXRpb24oKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBpZiAoZW50aXR5LmNvbGxpc2lvbiAmJiBlbnRpdHkuY29sbGlzaW9uLmVuYWJsZWQgJiYgIXRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYWRkQm9keShib2R5LCB0aGlzLl9ncm91cCwgdGhpcy5fbWFzayk7XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMuX3R5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9EWU5BTUlDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2R5bmFtaWMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0FDVElWRV9UQUcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeW5jRW50aXR5VG9Cb2R5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9LSU5FTUFUSUM6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fa2luZW1hdGljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9TVEFUSUM6XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24udHlwZSA9PT0gJ2NvbXBvdW5kJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fY29tcG91bmRzLnB1c2goZW50aXR5LmNvbGxpc2lvbik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGEgYm9keSBmcm9tIHRoZSBzaW11bGF0aW9uLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRpc2FibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkgJiYgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN5c3RlbSA9IHRoaXMuc3lzdGVtO1xuXG4gICAgICAgICAgICBsZXQgaWR4ID0gc3lzdGVtLl9jb21wb3VuZHMuaW5kZXhPZih0aGlzLmVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9jb21wb3VuZHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlkeCA9IHN5c3RlbS5fZHluYW1pYy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9keW5hbWljLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZHggPSBzeXN0ZW0uX2tpbmVtYXRpYy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9raW5lbWF0aWMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN5c3RlbS5yZW1vdmVCb2R5KGJvZHkpO1xuXG4gICAgICAgICAgICAvLyBzZXQgYWN0aXZhdGlvbiBzdGF0ZSB0byBkaXNhYmxlIHNpbXVsYXRpb24gdG8gYXZvaWQgYm9keS5pc0FjdGl2ZSgpIHRvIHJldHVyblxuICAgICAgICAgICAgLy8gdHJ1ZSBldmVuIGlmIGl0J3Mgbm90IGluIHRoZSBkeW5hbWljcyB3b3JsZFxuICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OKTtcblxuICAgICAgICAgICAgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IGFuIGZvcmNlIHRvIHRoZSBib2R5IGF0IGEgcG9pbnQuIEJ5IGRlZmF1bHQsIHRoZSBmb3JjZSBpcyBhcHBsaWVkIGF0IHRoZSBvcmlnaW4gb2YgdGhlXG4gICAgICogYm9keS4gSG93ZXZlciwgdGhlIGZvcmNlIGNhbiBiZSBhcHBsaWVkIGF0IGFuIG9mZnNldCB0aGlzIHBvaW50IGJ5IHNwZWNpZnlpbmcgYSB3b3JsZCBzcGFjZVxuICAgICAqIHZlY3RvciBmcm9tIHRoZSBib2R5J3Mgb3JpZ2luIHRvIHRoZSBwb2ludCBvZiBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgZm9yY2UgKGFuZCBvcHRpb25hbCByZWxhdGl2ZSBwb2ludCkgdmlhIDNELXZlY3RvciBvclxuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIGZvcmNlIGluIHdvcmxkLXNwYWNlIG9yXG4gICAgICogdGhlIHgtY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2Ugb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4XSAtIFRoZSB4LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGFwcHJveGltYXRpb24gb2YgZ3Jhdml0eSBhdCB0aGUgYm9keSdzIGNlbnRlclxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKDAsIC0xMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBhcHByb3hpbWF0aW9uIG9mIGdyYXZpdHkgYXQgMSB1bml0IGRvd24gdGhlIHdvcmxkIFogZnJvbSB0aGUgY2VudGVyIG9mIHRoZSBib2R5XG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoMCwgLTEwLCAwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGEgZm9yY2UgYXQgdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiAvLyBDYWxjdWxhdGUgYSBmb3JjZSB2ZWN0b3IgcG9pbnRpbmcgaW4gdGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiB0aGUgZW50aXR5XG4gICAgICogY29uc3QgZm9yY2UgPSB0aGlzLmVudGl0eS5mb3J3YXJkLmNsb25lKCkubXVsU2NhbGFyKDEwMCk7XG4gICAgICpcbiAgICAgKiAvLyBBcHBseSB0aGUgZm9yY2VcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZShmb3JjZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhIGZvcmNlIGF0IHNvbWUgcmVsYXRpdmUgb2Zmc2V0IGZyb20gdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiAvLyBDYWxjdWxhdGUgYSBmb3JjZSB2ZWN0b3IgcG9pbnRpbmcgaW4gdGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiB0aGUgZW50aXR5XG4gICAgICogY29uc3QgZm9yY2UgPSB0aGlzLmVudGl0eS5mb3J3YXJkLmNsb25lKCkubXVsU2NhbGFyKDEwMCk7XG4gICAgICpcbiAgICAgKiAvLyBDYWxjdWxhdGUgdGhlIHdvcmxkIHNwYWNlIHJlbGF0aXZlIG9mZnNldFxuICAgICAqIGNvbnN0IHJlbGF0aXZlUG9zID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBjb25zdCBjaGlsZEVudGl0eSA9IHRoaXMuZW50aXR5LmZpbmRCeU5hbWUoJ0VuZ2luZScpO1xuICAgICAqIHJlbGF0aXZlUG9zLnN1YjIoY2hpbGRFbnRpdHkuZ2V0UG9zaXRpb24oKSwgdGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKSk7XG4gICAgICpcbiAgICAgKiAvLyBBcHBseSB0aGUgZm9yY2VcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZShmb3JjZSwgcmVsYXRpdmVQb3MpO1xuICAgICAqL1xuICAgIGFwcGx5Rm9yY2UoeCwgeSwgeiwgcHgsIHB5LCBweikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh5IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZSh5LngsIHkueSwgeS56KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZShweCwgcHksIHB6KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKDAsIDAsIDApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBib2R5LmFwcGx5Rm9yY2UoX2FtbW9WZWMxLCBfYW1tb1ZlYzIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgdG9ycXVlIChyb3RhdGlvbmFsIGZvcmNlKSB0byB0aGUgYm9keS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW5cbiAgICAgKiBlaXRoZXIgc3BlY2lmeSB0aGUgdG9ycXVlIGZvcmNlIHdpdGggYSAzRC12ZWN0b3Igb3Igd2l0aCAzIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZVxuICAgICAqIG9yIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZSgwLCAxMCwgMCk7XG4gICAgICovXG4gICAgYXBwbHlUb3JxdWUoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib2R5LmFwcGx5VG9ycXVlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBpbXB1bHNlIChpbnN0YW50YW5lb3VzIGNoYW5nZSBvZiB2ZWxvY2l0eSkgdG8gdGhlIGJvZHkgYXQgYSBwb2ludC4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgaW1wdWxzZSAoYW5kIG9wdGlvbmFsIHJlbGF0aXZlIHBvaW50KVxuICAgICAqIHZpYSAzRC12ZWN0b3Igb3IgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkgb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZVxuICAgICAqIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSB0byBhcHBseSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4XSAtIFRoZSB4LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogY29uc3QgaW1wdWxzZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZShpbXB1bHNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCAxIHVuaXQgZG93biB0aGUgcG9zaXRpdmVcbiAgICAgKiAvLyB6LWF4aXMgb2YgdGhlIGVudGl0eSdzIGxvY2FsLXNwYWNlLlxuICAgICAqIGNvbnN0IGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogY29uc3QgcmVsYXRpdmVQb2ludCA9IG5ldyBwYy5WZWMzKDAsIDAsIDEpO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlJbXB1bHNlKGltcHVsc2UsIHJlbGF0aXZlUG9pbnQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IHRoZSBlbnRpdHkncyBwb3NpdGlvbi5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCwgMCwgMCwgMSk7XG4gICAgICovXG4gICAgYXBwbHlJbXB1bHNlKHgsIHksIHosIHB4LCBweSwgcHopIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LngsIHgueSwgeC56KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoeS54LCB5LnksIHkueik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZSgwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5hcHBseUltcHVsc2UoX2FtbW9WZWMxLCBfYW1tb1ZlYzIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYSB0b3JxdWUgaW1wdWxzZSAocm90YXRpb25hbCBmb3JjZSBhcHBsaWVkIGluc3RhbnRhbmVvdXNseSkgdG8gdGhlIGJvZHkuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIHRvcnF1ZSBmb3JjZSB3aXRoIGEgM0QtdmVjdG9yIG9yIHdpdGggM1xuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBpbXB1bHNlIGluXG4gICAgICogd29ybGQtc3BhY2Ugb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCB0b3JxdWUgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZUltcHVsc2UodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZUltcHVsc2UoMCwgMTAsIDApO1xuICAgICAqL1xuICAgIGFwcGx5VG9ycXVlSW1wdWxzZSh4LCB5LCB6KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeC54LCB4LnksIHgueik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5hcHBseVRvcnF1ZUltcHVsc2UoX2FtbW9WZWMxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3RhdGljLlxuICAgICAqL1xuICAgIGlzU3RhdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX1NUQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIG9mIHR5cGUge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ30gb3Ige0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzdGF0aWMgb3Iga2luZW1hdGljLlxuICAgICAqL1xuICAgIGlzU3RhdGljT3JLaW5lbWF0aWMoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfU1RBVElDIHx8IHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIG9mIHR5cGUge0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBraW5lbWF0aWMuXG4gICAgICovXG4gICAgaXNLaW5lbWF0aWMoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXcml0ZXMgYW4gZW50aXR5IHRyYW5zZm9ybSBpbnRvIGFuIEFtbW8uYnRUcmFuc2Zvcm0gYnV0IGlnbm9yaW5nIHNjYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHRyYW5zZm9ybSAtIFRoZSBhbW1vIHRyYW5zZm9ybSB0byB3cml0ZSB0aGUgZW50aXR5IHRyYW5zZm9ybSB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRFbnRpdHlUcmFuc2Zvcm0odHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJvZHlQb3MgPSBjb21wb25lbnQuZ2V0U2hhcGVQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgYm9keVJvdCA9IGNvbXBvbmVudC5nZXRTaGFwZVJvdGF0aW9uKCk7XG4gICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoYm9keVBvcy54LCBib2R5UG9zLnksIGJvZHlQb3Mueik7XG4gICAgICAgICAgICBfYW1tb1F1YXQuc2V0VmFsdWUoYm9keVJvdC54LCBib2R5Um90LnksIGJvZHlSb3QueiwgYm9keVJvdC53KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gZW50aXR5LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUocG9zLngsIHBvcy55LCBwb3Mueik7XG4gICAgICAgICAgICBfYW1tb1F1YXQuc2V0VmFsdWUocm90LngsIHJvdC55LCByb3Queiwgcm90LncpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJhbnNmb3JtLnNldE9yaWdpbihfYW1tb1ZlYzEpO1xuICAgICAgICB0cmFuc2Zvcm0uc2V0Um90YXRpb24oX2FtbW9RdWF0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJpZ2lkIGJvZHkgdHJhbnNmb3JtIHRvIGJlIHRoZSBzYW1lIGFzIHRoZSBFbnRpdHkgdHJhbnNmb3JtLiBUaGlzIG11c3QgYmUgY2FsbGVkXG4gICAgICogYWZ0ZXIgYW55IEVudGl0eSB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbnMgKGUuZy4ge0BsaW5rIEVudGl0eSNzZXRQb3NpdGlvbn0pIGFyZSBjYWxsZWQgaW5cbiAgICAgKiBvcmRlciB0byB1cGRhdGUgdGhlIHJpZ2lkIGJvZHkgdG8gbWF0Y2ggdGhlIEVudGl0eS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3luY0VudGl0eVRvQm9keSgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9nZXRFbnRpdHlUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICBib2R5LnNldFdvcmxkVHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICAgICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhbiBlbnRpdHkncyB0cmFuc2Zvcm0gdG8gbWF0Y2ggdGhhdCBvZiB0aGUgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4IG9mIGEgZHluYW1pY1xuICAgICAqIHJpZ2lkIGJvZHkncyBtb3Rpb24gc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVEeW5hbWljKCkge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcblxuICAgICAgICAvLyBJZiBhIGR5bmFtaWMgYm9keSBpcyBmcm96ZW4sIHdlIGNhbiBhc3N1bWUgaXRzIG1vdGlvbiBzdGF0ZSB0cmFuc2Zvcm0gaXNcbiAgICAgICAgLy8gdGhlIHNhbWUgaXMgdGhlIGVudGl0eSB3b3JsZCB0cmFuc2Zvcm1cbiAgICAgICAgaWYgKGJvZHkuaXNBY3RpdmUoKSkge1xuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb3Rpb24gc3RhdGUuIE5vdGUgdGhhdCB0aGUgdGVzdCBmb3IgdGhlIHByZXNlbmNlIG9mIHRoZSBtb3Rpb25cbiAgICAgICAgICAgIC8vIHN0YXRlIGlzIHRlY2huaWNhbGx5IHJlZHVuZGFudCBzaW5jZSB0aGUgZW5naW5lIGNyZWF0ZXMgb25lIGZvciBhbGwgYm9kaWVzLlxuICAgICAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSBib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcblxuICAgICAgICAgICAgICAgIG1vdGlvblN0YXRlLmdldFdvcmxkVHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHAgPSBfYW1tb1RyYW5zZm9ybS5nZXRPcmlnaW4oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBxID0gX2FtbW9UcmFuc2Zvcm0uZ2V0Um90YXRpb24oKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCAmJiBjb21wb25lbnQuX2hhc09mZnNldCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsbyA9IGNvbXBvbmVudC5kYXRhLmxpbmVhck9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYW8gPSBjb21wb25lbnQuZGF0YS5hbmd1bGFyT2Zmc2V0O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFVuLXJvdGF0ZSB0aGUgYW5ndWxhciBvZmZzZXQgYW5kIHRoZW4gdXNlIHRoZSBuZXcgcm90YXRpb24gdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gdW4tdHJhbnNsYXRlIHRoZSBsaW5lYXIgb2Zmc2V0IGluIGxvY2FsIHNwYWNlXG4gICAgICAgICAgICAgICAgICAgIC8vIE9yZGVyIG9mIG9wZXJhdGlvbnMgbWF0dGVyIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52ZXJ0ZWRBbyA9IF9xdWF0Mi5jb3B5KGFvKS5pbnZlcnQoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50aXR5Um90ID0gX3F1YXQxLnNldChxLngoKSwgcS55KCksIHEueigpLCBxLncoKSkubXVsKGludmVydGVkQW8pO1xuXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVJvdC50cmFuc2Zvcm1WZWN0b3IobG8sIF92ZWMzKTtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFBvc2l0aW9uKHAueCgpIC0gX3ZlYzMueCwgcC55KCkgLSBfdmVjMy55LCBwLnooKSAtIF92ZWMzLnopO1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2V0Um90YXRpb24oZW50aXR5Um90KTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRQb3NpdGlvbihwLngoKSwgcC55KCksIHAueigpKTtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFJvdGF0aW9uKHEueCgpLCBxLnkoKSwgcS56KCksIHEudygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXcml0ZXMgdGhlIGVudGl0eSdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBpbnRvIHRoZSBtb3Rpb24gc3RhdGUgb2YgYSBraW5lbWF0aWMgYm9keS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUtpbmVtYXRpYygpIHtcbiAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSB0aGlzLl9ib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcbiAgICAgICAgICAgIG1vdGlvblN0YXRlLnNldFdvcmxkVHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlbGVwb3J0IGFuIGVudGl0eSB0byBhIG5ldyB3b3JsZC1zcGFjZSBwb3NpdGlvbiwgb3B0aW9uYWxseSBzZXR0aW5nIG9yaWVudGF0aW9uLiBUaGlzXG4gICAgICogZnVuY3Rpb24gc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZvciByaWdpZCBib2RpZXMgdGhhdCBhcmUgZHluYW1pYy4gVGhpcyBmdW5jdGlvbiBoYXMgdGhyZWVcbiAgICAgKiB2YWxpZCBzaWduYXR1cmVzLiBUaGUgZmlyc3QgdGFrZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgdGhlIHBvc2l0aW9uIGFuZCBhbiBvcHRpb25hbFxuICAgICAqIDMtZGltZW5zaW9uYWwgdmVjdG9yIGZvciBFdWxlciByb3RhdGlvbi4gVGhlIHNlY29uZCB0YWtlcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGZvciB0aGVcbiAgICAgKiBwb3NpdGlvbiBhbmQgYW4gb3B0aW9uYWwgcXVhdGVybmlvbiBmb3Igcm90YXRpb24uIFRoZSB0aGlyZCB0YWtlcyAzIG51bWJlcnMgZm9yIHRoZSBwb3NpdGlvblxuICAgICAqIGFuZCBhbiBvcHRpb25hbCAzIG51bWJlcnMgZm9yIEV1bGVyIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB0aGUgbmV3IHBvc2l0aW9uIG9yIHRoZSBuZXcgcG9zaXRpb25cbiAgICAgKiB4LWNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtRdWF0fFZlYzN8bnVtYmVyfSBbeV0gLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIG9yIHF1YXRlcm5pb24gaG9sZGluZyB0aGUgbmV3XG4gICAgICogcm90YXRpb24gb3IgdGhlIG5ldyBwb3NpdGlvbiB5LWNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBuZXcgcG9zaXRpb24gei1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnhdIC0gVGhlIG5ldyBFdWxlciB4LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnldIC0gVGhlIG5ldyBFdWxlciB5LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnpdIC0gVGhlIG5ldyBFdWxlciB6LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB0aGUgb3JpZ2luXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydChwYy5WZWMzLlpFUk8pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB0aGUgb3JpZ2luXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydCgwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMSwgMiwgM10gYW5kIHJlc2V0IG9yaWVudGF0aW9uXG4gICAgICogY29uc3QgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KHBvc2l0aW9uLCBwYy5WZWMzLlpFUk8pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxLCAyLCAzXSBhbmQgcmVzZXQgb3JpZW50YXRpb25cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KDEsIDIsIDMsIDAsIDAsIDApO1xuICAgICAqL1xuICAgIHRlbGVwb3J0KHgsIHksIHosIHJ4LCByeSwgcnopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbih4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbih5KTtcbiAgICAgICAgfSBlbHNlIGlmICh5IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoeSk7XG4gICAgICAgIH0gZWxzZSBpZiAocnggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMocngsIHJ5LCByeik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm9keSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIl9hbW1vVHJhbnNmb3JtIiwiX2FtbW9WZWMxIiwiX2FtbW9WZWMyIiwiX2FtbW9RdWF0IiwiX3F1YXQxIiwiUXVhdCIsIl9xdWF0MiIsIl92ZWMzIiwiVmVjMyIsIlJpZ2lkQm9keUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX2FuZ3VsYXJEYW1waW5nIiwiX2FuZ3VsYXJGYWN0b3IiLCJfYW5ndWxhclZlbG9jaXR5IiwiX2JvZHkiLCJfZnJpY3Rpb24iLCJfZ3JvdXAiLCJCT0RZR1JPVVBfU1RBVElDIiwiX2xpbmVhckRhbXBpbmciLCJfbGluZWFyRmFjdG9yIiwiX2xpbmVhclZlbG9jaXR5IiwiX21hc2siLCJCT0RZTUFTS19OT1RfU1RBVElDIiwiX21hc3MiLCJfcmVzdGl0dXRpb24iLCJfcm9sbGluZ0ZyaWN0aW9uIiwiX3NpbXVsYXRpb25FbmFibGVkIiwiX3R5cGUiLCJCT0RZVFlQRV9TVEFUSUMiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiYnRUcmFuc2Zvcm0iLCJidFZlY3RvcjMiLCJidFF1YXRlcm5pb24iLCJhbmd1bGFyRGFtcGluZyIsImRhbXBpbmciLCJzZXREYW1waW5nIiwiYW5ndWxhckZhY3RvciIsImZhY3RvciIsImVxdWFscyIsImNvcHkiLCJCT0RZVFlQRV9EWU5BTUlDIiwic2V0VmFsdWUiLCJ4IiwieSIsInoiLCJzZXRBbmd1bGFyRmFjdG9yIiwiYW5ndWxhclZlbG9jaXR5IiwidmVsb2NpdHkiLCJhY3RpdmF0ZSIsInNldEFuZ3VsYXJWZWxvY2l0eSIsImdldEFuZ3VsYXJWZWxvY2l0eSIsInNldCIsImJvZHkiLCJmcmljdGlvbiIsInNldEZyaWN0aW9uIiwiZ3JvdXAiLCJlbmFibGVkIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJlbmFibGVTaW11bGF0aW9uIiwibGluZWFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsInNldExpbmVhckZhY3RvciIsImxpbmVhclZlbG9jaXR5Iiwic2V0TGluZWFyVmVsb2NpdHkiLCJnZXRMaW5lYXJWZWxvY2l0eSIsIm1hc2siLCJtYXNzIiwiZ2V0Q29sbGlzaW9uU2hhcGUiLCJjYWxjdWxhdGVMb2NhbEluZXJ0aWEiLCJzZXRNYXNzUHJvcHMiLCJ1cGRhdGVJbmVydGlhVGVuc29yIiwicmVzdGl0dXRpb24iLCJzZXRSZXN0aXR1dGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInNldFJvbGxpbmdGcmljdGlvbiIsInR5cGUiLCJCT0RZR1JPVVBfRFlOQU1JQyIsIkJPRFlNQVNLX0FMTCIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIkJPRFlHUk9VUF9LSU5FTUFUSUMiLCJjcmVhdGVCb2R5Iiwic2hhcGUiLCJjb2xsaXNpb24iLCJ0cmlnZ2VyIiwiZGVzdHJveSIsInJlbW92ZUJvZHkiLCJkZXN0cm95Qm9keSIsIl9nZXRFbnRpdHlUcmFuc2Zvcm0iLCJzZXRDb2xsaXNpb25GbGFncyIsImdldENvbGxpc2lvbkZsYWdzIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsInNldEFjdGl2YXRpb25TdGF0ZSIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsImlzQWN0aXZlIiwiYWRkQm9keSIsIl9keW5hbWljIiwicHVzaCIsImZvcmNlQWN0aXZhdGlvblN0YXRlIiwiQk9EWVNUQVRFX0FDVElWRV9UQUciLCJzeW5jRW50aXR5VG9Cb2R5IiwiX2tpbmVtYXRpYyIsIl9jb21wb3VuZHMiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsImFwcGx5Rm9yY2UiLCJweCIsInB5IiwicHoiLCJ1bmRlZmluZWQiLCJhcHBseVRvcnF1ZSIsImFwcGx5SW1wdWxzZSIsImFwcGx5VG9ycXVlSW1wdWxzZSIsImlzU3RhdGljIiwiaXNTdGF0aWNPcktpbmVtYXRpYyIsImlzS2luZW1hdGljIiwidHJhbnNmb3JtIiwiY29tcG9uZW50IiwiYm9keVBvcyIsImdldFNoYXBlUG9zaXRpb24iLCJib2R5Um90IiwiZ2V0U2hhcGVSb3RhdGlvbiIsInciLCJwb3MiLCJnZXRQb3NpdGlvbiIsInJvdCIsImdldFJvdGF0aW9uIiwic2V0T3JpZ2luIiwic2V0Um90YXRpb24iLCJzZXRXb3JsZFRyYW5zZm9ybSIsIm1vdGlvblN0YXRlIiwiZ2V0TW90aW9uU3RhdGUiLCJfdXBkYXRlRHluYW1pYyIsImdldFdvcmxkVHJhbnNmb3JtIiwicCIsImdldE9yaWdpbiIsInEiLCJfaGFzT2Zmc2V0IiwibG8iLCJkYXRhIiwibGluZWFyT2Zmc2V0IiwiYW8iLCJhbmd1bGFyT2Zmc2V0IiwiaW52ZXJ0ZWRBbyIsImludmVydCIsImVudGl0eVJvdCIsIm11bCIsInRyYW5zZm9ybVZlY3RvciIsInNldFBvc2l0aW9uIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInRlbGVwb3J0IiwicngiLCJyeSIsInJ6Iiwic2V0RXVsZXJBbmdsZXMiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsIkVWRU5UX0NPTlRBQ1QiLCJFVkVOVF9DT0xMSVNJT05TVEFSVCIsIkVWRU5UX0NPTExJU0lPTkVORCIsIkVWRU5UX1RSSUdHRVJFTlRFUiIsIkVWRU5UX1RSSUdHRVJMRUFWRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFZQTtBQUNBLElBQUlBLGNBQWMsQ0FBQTtBQUNsQixJQUFJQyxTQUFTLEVBQUVDLFNBQVMsRUFBRUMsU0FBUyxDQUFBO0FBQ25DLE1BQU1DLE1BQU0sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNQyxNQUFNLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDekIsTUFBTUUsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUV4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGtCQUFrQixTQUFTQyxTQUFTLENBQUM7QUEwR3ZDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQUU7QUFDMUIsSUFBQSxLQUFLLENBQUNELE1BQU0sRUFBRUMsTUFBTSxD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
