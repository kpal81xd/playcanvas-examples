import { BODYFLAG_NORESPONSE_OBJECT, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from '../rigid-body/constants.js';

let _ammoVec1, _ammoQuat, _ammoTransform;

/**
 * Creates a trigger object used to create internal physics objects that interact with rigid bodies
 * and trigger collision events with no collision response.
 *
 * @ignore
 */
class Trigger {
  /**
   * Create a new Trigger instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The running {@link AppBase}.
   * @param {import('../component.js').Component} component - The component for which the trigger
   * will be created.
   * @param {ComponentData} data - The data for the component.
   */
  constructor(app, component, data) {
    this.entity = component.entity;
    this.component = component;
    this.app = app;
    if (typeof Ammo !== 'undefined' && !_ammoVec1) {
      _ammoVec1 = new Ammo.btVector3();
      _ammoQuat = new Ammo.btQuaternion();
      _ammoTransform = new Ammo.btTransform();
    }
    this.initialize(data);
  }
  initialize(data) {
    const entity = this.entity;
    const shape = data.shape;
    if (shape && typeof Ammo !== 'undefined') {
      if (entity.trigger) {
        entity.trigger.destroy();
      }
      const mass = 1;
      const component = this.component;
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
      _ammoTransform.setOrigin(_ammoVec1);
      _ammoTransform.setRotation(_ammoQuat);
      const body = this.app.systems.rigidbody.createBody(mass, shape, _ammoTransform);
      body.setRestitution(0);
      body.setFriction(0);
      body.setDamping(0, 0);
      _ammoVec1.setValue(0, 0, 0);
      body.setLinearFactor(_ammoVec1);
      body.setAngularFactor(_ammoVec1);
      body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_NORESPONSE_OBJECT);
      body.entity = entity;
      this.body = body;
      if (this.component.enabled && entity.enabled) {
        this.enable();
      }
    }
  }
  destroy() {
    const body = this.body;
    if (!body) return;
    this.disable();
    this.app.systems.rigidbody.destroyBody(body);
  }
  _getEntityTransform(transform) {
    const component = this.component;
    if (component) {
      const bodyPos = component.getShapePosition();
      const bodyRot = component.getShapeRotation();
      _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
      _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
    } else {
      const pos = this.entity.getPosition();
      const rot = this.entity.getRotation();
      _ammoVec1.setValue(pos.x, pos.y, pos.z);
      _ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    }
    transform.setOrigin(_ammoVec1);
    transform.setRotation(_ammoQuat);
  }
  updateTransform() {
    this._getEntityTransform(_ammoTransform);
    const body = this.body;
    body.setWorldTransform(_ammoTransform);
    body.activate();
  }
  enable() {
    const body = this.body;
    if (!body) return;
    const systems = this.app.systems;
    systems.rigidbody.addBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);
    systems.rigidbody._triggers.push(this);

    // set the body's activation state to active so that it is
    // simulated properly again
    body.forceActivationState(BODYSTATE_ACTIVE_TAG);
    this.updateTransform();
  }
  disable() {
    const body = this.body;
    if (!body) return;
    const systems = this.app.systems;
    const idx = systems.rigidbody._triggers.indexOf(this);
    if (idx > -1) {
      systems.rigidbody._triggers.splice(idx, 1);
    }
    systems.rigidbody.removeBody(body);

    // set the body's activation state to disable simulation so
    // that it properly deactivates after we remove it from the physics world
    body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
  }
}

export { Trigger };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJpZ2dlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2NvbGxpc2lvbi90cmlnZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNULCBCT0RZTUFTS19OT1RfU1RBVElDLCBCT0RZR1JPVVBfVFJJR0dFUiwgQk9EWVNUQVRFX0FDVElWRV9UQUcsIEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04gfSBmcm9tICcuLi9yaWdpZC1ib2R5L2NvbnN0YW50cy5qcyc7XG5cbmxldCBfYW1tb1ZlYzEsIF9hbW1vUXVhdCwgX2FtbW9UcmFuc2Zvcm07XG5cbi8qKlxuICogQ3JlYXRlcyBhIHRyaWdnZXIgb2JqZWN0IHVzZWQgdG8gY3JlYXRlIGludGVybmFsIHBoeXNpY3Mgb2JqZWN0cyB0aGF0IGludGVyYWN0IHdpdGggcmlnaWQgYm9kaWVzXG4gKiBhbmQgdHJpZ2dlciBjb2xsaXNpb24gZXZlbnRzIHdpdGggbm8gY29sbGlzaW9uIHJlc3BvbnNlLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgVHJpZ2dlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRyaWdnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudC5qcycpLkNvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIGNvbXBvbmVudCBmb3Igd2hpY2ggdGhlIHRyaWdnZXJcbiAgICAgKiB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgICogQHBhcmFtIHtDb21wb25lbnREYXRhfSBkYXRhIC0gVGhlIGRhdGEgZm9yIHRoZSBjb21wb25lbnQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCBjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5lbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICB0aGlzLmNvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJyAmJiAhX2FtbW9WZWMxKSB7XG4gICAgICAgICAgICBfYW1tb1ZlYzEgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIF9hbW1vUXVhdCA9IG5ldyBBbW1vLmJ0UXVhdGVybmlvbigpO1xuICAgICAgICAgICAgX2FtbW9UcmFuc2Zvcm0gPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplKGRhdGEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemUoZGF0YSkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgY29uc3Qgc2hhcGUgPSBkYXRhLnNoYXBlO1xuXG4gICAgICAgIGlmIChzaGFwZSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWFzcyA9IDE7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuY29tcG9uZW50O1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHlQb3MgPSBjb21wb25lbnQuZ2V0U2hhcGVQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHlSb3QgPSBjb21wb25lbnQuZ2V0U2hhcGVSb3RhdGlvbigpO1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShib2R5UG9zLngsIGJvZHlQb3MueSwgYm9keVBvcy56KTtcbiAgICAgICAgICAgICAgICBfYW1tb1F1YXQuc2V0VmFsdWUoYm9keVJvdC54LCBib2R5Um90LnksIGJvZHlSb3QueiwgYm9keVJvdC53KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zID0gZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm90ID0gZW50aXR5LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICAgICAgICAgIF9hbW1vUXVhdC5zZXRWYWx1ZShyb3QueCwgcm90LnksIHJvdC56LCByb3Qudyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9hbW1vVHJhbnNmb3JtLnNldE9yaWdpbihfYW1tb1ZlYzEpO1xuICAgICAgICAgICAgX2FtbW9UcmFuc2Zvcm0uc2V0Um90YXRpb24oX2FtbW9RdWF0KTtcblxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LmNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRSZXN0aXR1dGlvbigwKTtcbiAgICAgICAgICAgIGJvZHkuc2V0RnJpY3Rpb24oMCk7XG4gICAgICAgICAgICBib2R5LnNldERhbXBpbmcoMCwgMCk7XG4gICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoMCwgMCwgMCk7XG4gICAgICAgICAgICBib2R5LnNldExpbmVhckZhY3RvcihfYW1tb1ZlYzEpO1xuICAgICAgICAgICAgYm9keS5zZXRBbmd1bGFyRmFjdG9yKF9hbW1vVmVjMSk7XG5cbiAgICAgICAgICAgIGJvZHkuc2V0Q29sbGlzaW9uRmxhZ3MoYm9keS5nZXRDb2xsaXNpb25GbGFncygpIHwgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpO1xuICAgICAgICAgICAgYm9keS5lbnRpdHkgPSBlbnRpdHk7XG5cbiAgICAgICAgICAgIHRoaXMuYm9keSA9IGJvZHk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbXBvbmVudC5lbmFibGVkICYmIGVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLmJvZHk7XG4gICAgICAgIGlmICghYm9keSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZGlzYWJsZSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LmRlc3Ryb3lCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIF9nZXRFbnRpdHlUcmFuc2Zvcm0odHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuY29tcG9uZW50O1xuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb25zdCBib2R5UG9zID0gY29tcG9uZW50LmdldFNoYXBlUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHlSb3QgPSBjb21wb25lbnQuZ2V0U2hhcGVSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGJvZHlQb3MueCwgYm9keVBvcy55LCBib2R5UG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKGJvZHlSb3QueCwgYm9keVJvdC55LCBib2R5Um90LnosIGJvZHlSb3Qudyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgIF9hbW1vUXVhdC5zZXRWYWx1ZShyb3QueCwgcm90LnksIHJvdC56LCByb3Qudyk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmFuc2Zvcm0uc2V0T3JpZ2luKF9hbW1vVmVjMSk7XG4gICAgICAgIHRyYW5zZm9ybS5zZXRSb3RhdGlvbihfYW1tb1F1YXQpO1xuICAgIH1cblxuICAgIHVwZGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5ib2R5O1xuICAgICAgICBib2R5LnNldFdvcmxkVHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcbiAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuICAgIH1cblxuICAgIGVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuYm9keTtcbiAgICAgICAgaWYgKCFib2R5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3Qgc3lzdGVtcyA9IHRoaXMuYXBwLnN5c3RlbXM7XG4gICAgICAgIHN5c3RlbXMucmlnaWRib2R5LmFkZEJvZHkoYm9keSwgQk9EWUdST1VQX1RSSUdHRVIsIEJPRFlNQVNLX05PVF9TVEFUSUMgXiBCT0RZR1JPVVBfVFJJR0dFUik7XG4gICAgICAgIHN5c3RlbXMucmlnaWRib2R5Ll90cmlnZ2Vycy5wdXNoKHRoaXMpO1xuXG4gICAgICAgIC8vIHNldCB0aGUgYm9keSdzIGFjdGl2YXRpb24gc3RhdGUgdG8gYWN0aXZlIHNvIHRoYXQgaXQgaXNcbiAgICAgICAgLy8gc2ltdWxhdGVkIHByb3Blcmx5IGFnYWluXG4gICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0FDVElWRV9UQUcpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgZGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuYm9keTtcbiAgICAgICAgaWYgKCFib2R5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3Qgc3lzdGVtcyA9IHRoaXMuYXBwLnN5c3RlbXM7XG4gICAgICAgIGNvbnN0IGlkeCA9IHN5c3RlbXMucmlnaWRib2R5Ll90cmlnZ2Vycy5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIHN5c3RlbXMucmlnaWRib2R5Ll90cmlnZ2Vycy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBzeXN0ZW1zLnJpZ2lkYm9keS5yZW1vdmVCb2R5KGJvZHkpO1xuXG4gICAgICAgIC8vIHNldCB0aGUgYm9keSdzIGFjdGl2YXRpb24gc3RhdGUgdG8gZGlzYWJsZSBzaW11bGF0aW9uIHNvXG4gICAgICAgIC8vIHRoYXQgaXQgcHJvcGVybHkgZGVhY3RpdmF0ZXMgYWZ0ZXIgd2UgcmVtb3ZlIGl0IGZyb20gdGhlIHBoeXNpY3Mgd29ybGRcbiAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRyaWdnZXIgfTtcbiJdLCJuYW1lcyI6WyJfYW1tb1ZlYzEiLCJfYW1tb1F1YXQiLCJfYW1tb1RyYW5zZm9ybSIsIlRyaWdnZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImNvbXBvbmVudCIsImRhdGEiLCJlbnRpdHkiLCJBbW1vIiwiYnRWZWN0b3IzIiwiYnRRdWF0ZXJuaW9uIiwiYnRUcmFuc2Zvcm0iLCJpbml0aWFsaXplIiwic2hhcGUiLCJ0cmlnZ2VyIiwiZGVzdHJveSIsIm1hc3MiLCJib2R5UG9zIiwiZ2V0U2hhcGVQb3NpdGlvbiIsImJvZHlSb3QiLCJnZXRTaGFwZVJvdGF0aW9uIiwic2V0VmFsdWUiLCJ4IiwieSIsInoiLCJ3IiwicG9zIiwiZ2V0UG9zaXRpb24iLCJyb3QiLCJnZXRSb3RhdGlvbiIsInNldE9yaWdpbiIsInNldFJvdGF0aW9uIiwiYm9keSIsInN5c3RlbXMiLCJyaWdpZGJvZHkiLCJjcmVhdGVCb2R5Iiwic2V0UmVzdGl0dXRpb24iLCJzZXRGcmljdGlvbiIsInNldERhbXBpbmciLCJzZXRMaW5lYXJGYWN0b3IiLCJzZXRBbmd1bGFyRmFjdG9yIiwic2V0Q29sbGlzaW9uRmxhZ3MiLCJnZXRDb2xsaXNpb25GbGFncyIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiZW5hYmxlZCIsImVuYWJsZSIsImRpc2FibGUiLCJkZXN0cm95Qm9keSIsIl9nZXRFbnRpdHlUcmFuc2Zvcm0iLCJ0cmFuc2Zvcm0iLCJ1cGRhdGVUcmFuc2Zvcm0iLCJzZXRXb3JsZFRyYW5zZm9ybSIsImFjdGl2YXRlIiwiYWRkQm9keSIsIkJPRFlHUk9VUF9UUklHR0VSIiwiQk9EWU1BU0tfTk9UX1NUQVRJQyIsIl90cmlnZ2VycyIsInB1c2giLCJmb3JjZUFjdGl2YXRpb25TdGF0ZSIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInJlbW92ZUJvZHkiLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIl0sIm1hcHBpbmdzIjoiOztBQUVBLElBQUlBLFNBQVMsRUFBRUMsU0FBUyxFQUFFQyxjQUFjLENBQUE7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLE9BQU8sQ0FBQztBQUNWO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsR0FBRyxFQUFFQyxTQUFTLEVBQUVDLElBQUksRUFBRTtBQUM5QixJQUFBLElBQUksQ0FBQ0MsTUFBTSxHQUFHRixTQUFTLENBQUNFLE1BQU0sQ0FBQTtJQUM5QixJQUFJLENBQUNGLFNBQVMsR0FBR0EsU0FBUyxDQUFBO0lBQzFCLElBQUksQ0FBQ0QsR0FBRyxHQUFHQSxHQUFHLENBQUE7QUFFZCxJQUFBLElBQUksT0FBT0ksSUFBSSxLQUFL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