import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { getDefaultMaterial } from '../../../scene/materials/default-material.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { RenderComponent } from './component.js';
import { RenderComponentData } from './data.js';

const _schema = [{
  name: 'rootBone',
  type: 'entity'
}, 'enabled'];

// order matters here
const _properties = ['material', 'meshInstances', 'asset', 'materialAssets', 'castShadows', 'receiveShadows', 'castShadowsLightmap', 'lightmapped', 'lightmapSizeMultiplier', 'renderStyle', 'type', 'layers', 'isStatic', 'batchGroupId'];

/**
 * Allows an Entity to render a mesh or a primitive shape like a box, capsule, sphere, cylinder,
 * cone etc.
 *
 * @augments ComponentSystem
 * @category Graphics
 */
class RenderComponentSystem extends ComponentSystem {
  /**
   * Create a new RenderComponentSystem.
   *
   * @param {import('../../app-base.js').AppBase} app - The Application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'render';
    this.ComponentType = RenderComponent;
    this.DataType = RenderComponentData;
    this.schema = _schema;
    this.defaultMaterial = getDefaultMaterial(app.graphicsDevice);
    this.on('beforeremove', this.onRemove, this);
  }
  initializeComponentData(component, _data, properties) {
    if (_data.batchGroupId === null || _data.batchGroupId === undefined) {
      _data.batchGroupId = -1;
    }

    // duplicate layer list
    if (_data.layers && _data.layers.length) {
      _data.layers = _data.layers.slice(0);
    }
    for (let i = 0; i < _properties.length; i++) {
      if (_data.hasOwnProperty(_properties[i])) {
        component[_properties[i]] = _data[_properties[i]];
      }
    }
    if (_data.aabbCenter && _data.aabbHalfExtents) {
      component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
    }
    super.initializeComponentData(component, _data, _schema);
  }
  cloneComponent(entity, clone) {
    // copy properties
    const data = {};
    for (let i = 0; i < _properties.length; i++) {
      data[_properties[i]] = entity.render[_properties[i]];
    }
    data.enabled = entity.render.enabled;

    // mesh instances cannot be used this way, remove them and manually clone them later
    delete data.meshInstances;

    // clone component
    const component = this.addComponent(clone, data);

    // clone mesh instances
    const srcMeshInstances = entity.render.meshInstances;
    const meshes = srcMeshInstances.map(mi => mi.mesh);
    component._onSetMeshes(meshes);

    // assign materials
    for (let m = 0; m < srcMeshInstances.length; m++) {
      component.meshInstances[m].material = srcMeshInstances[m].material;
    }
    if (entity.render.customAabb) {
      component.customAabb = entity.render.customAabb.clone();
    }
    return component;
  }
  onRemove(entity, component) {
    component.onRemove();
  }
}
Component._buildAccessors(RenderComponent.prototype, _schema);

export { RenderComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL2RlZmF1bHQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgUmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmVuZGVyQ29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbmNvbnN0IF9zY2hlbWEgPSBbXG4gICAgeyBuYW1lOiAncm9vdEJvbmUnLCB0eXBlOiAnZW50aXR5JyB9LFxuICAgICdlbmFibGVkJ1xuXTtcblxuLy8gb3JkZXIgbWF0dGVycyBoZXJlXG5jb25zdCBfcHJvcGVydGllcyA9IFtcbiAgICAnbWF0ZXJpYWwnLFxuICAgICdtZXNoSW5zdGFuY2VzJyxcbiAgICAnYXNzZXQnLFxuICAgICdtYXRlcmlhbEFzc2V0cycsXG4gICAgJ2Nhc3RTaGFkb3dzJyxcbiAgICAncmVjZWl2ZVNoYWRvd3MnLFxuICAgICdjYXN0U2hhZG93c0xpZ2h0bWFwJyxcbiAgICAnbGlnaHRtYXBwZWQnLFxuICAgICdsaWdodG1hcFNpemVNdWx0aXBsaWVyJyxcbiAgICAncmVuZGVyU3R5bGUnLFxuICAgICd0eXBlJyxcbiAgICAnbGF5ZXJzJyxcbiAgICAnaXNTdGF0aWMnLFxuICAgICdiYXRjaEdyb3VwSWQnXG5dO1xuXG4vKipcbiAqIEFsbG93cyBhbiBFbnRpdHkgdG8gcmVuZGVyIGEgbWVzaCBvciBhIHByaW1pdGl2ZSBzaGFwZSBsaWtlIGEgYm94LCBjYXBzdWxlLCBzcGhlcmUsIGN5bGluZGVyLFxuICogY29uZSBldGMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIFJlbmRlckNvbXBvbmVudFN5c3RlbSBleHRlbmRzIENvbXBvbmVudFN5c3RlbSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJlbmRlckNvbXBvbmVudFN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyZW5kZXInO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IFJlbmRlckNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5EYXRhVHlwZSA9IFJlbmRlckNvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuICAgICAgICB0aGlzLmRlZmF1bHRNYXRlcmlhbCA9IGdldERlZmF1bHRNYXRlcmlhbChhcHAuZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgX2RhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgaWYgKF9kYXRhLmJhdGNoR3JvdXBJZCA9PT0gbnVsbCB8fCBfZGF0YS5iYXRjaEdyb3VwSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgX2RhdGEuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkdXBsaWNhdGUgbGF5ZXIgbGlzdFxuICAgICAgICBpZiAoX2RhdGEubGF5ZXJzICYmIF9kYXRhLmxheWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIF9kYXRhLmxheWVycyA9IF9kYXRhLmxheWVycy5zbGljZSgwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX3Byb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eShfcHJvcGVydGllc1tpXSkpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRbX3Byb3BlcnRpZXNbaV1dID0gX2RhdGFbX3Byb3BlcnRpZXNbaV1dO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9kYXRhLmFhYmJDZW50ZXIgJiYgX2RhdGEuYWFiYkhhbGZFeHRlbnRzKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuY3VzdG9tQWFiYiA9IG5ldyBCb3VuZGluZ0JveChuZXcgVmVjMyhfZGF0YS5hYWJiQ2VudGVyKSwgbmV3IFZlYzMoX2RhdGEuYWFiYkhhbGZFeHRlbnRzKSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIF9kYXRhLCBfc2NoZW1hKTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG5cbiAgICAgICAgLy8gY29weSBwcm9wZXJ0aWVzXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBfcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGF0YVtfcHJvcGVydGllc1tpXV0gPSBlbnRpdHkucmVuZGVyW19wcm9wZXJ0aWVzW2ldXTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhLmVuYWJsZWQgPSBlbnRpdHkucmVuZGVyLmVuYWJsZWQ7XG5cbiAgICAgICAgLy8gbWVzaCBpbnN0YW5jZXMgY2Fubm90IGJlIHVzZWQgdGhpcyB3YXksIHJlbW92ZSB0aGVtIGFuZCBtYW51YWxseSBjbG9uZSB0aGVtIGxhdGVyXG4gICAgICAgIGRlbGV0ZSBkYXRhLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgLy8gY2xvbmUgY29tcG9uZW50XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcblxuICAgICAgICAvLyBjbG9uZSBtZXNoIGluc3RhbmNlc1xuICAgICAgICBjb25zdCBzcmNNZXNoSW5zdGFuY2VzID0gZW50aXR5LnJlbmRlci5tZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBtZXNoZXMgPSBzcmNNZXNoSW5zdGFuY2VzLm1hcChtaSA9PiBtaS5tZXNoKTtcbiAgICAgICAgY29tcG9uZW50Ll9vblNldE1lc2hlcyhtZXNoZXMpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBtYXRlcmlhbHNcbiAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCBzcmNNZXNoSW5zdGFuY2VzLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICBjb21wb25lbnQubWVzaEluc3RhbmNlc1ttXS5tYXRlcmlhbCA9IHNyY01lc2hJbnN0YW5jZXNbbV0ubWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50aXR5LnJlbmRlci5jdXN0b21BYWJiKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuY3VzdG9tQWFiYiA9IGVudGl0eS5yZW5kZXIuY3VzdG9tQWFiYi5jbG9uZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBvblJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQub25SZW1vdmUoKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoUmVuZGVyQ29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IFJlbmRlckNvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJuYW1lIiwidHlwZSIsIl9wcm9wZXJ0aWVzIiwiUmVuZGVyQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJSZW5kZXJDb21wb25lbnQiLCJEYXRhVHlwZSIsIlJlbmRlckNvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJkZWZhdWx0TWF0ZXJpYWwiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJncmFwaGljc0RldmljZSIsIm9uIiwib25SZW1vdmUiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsIl9kYXRhIiwicHJvcGVydGllcyIsImJhdGNoR3JvdXBJZCIsInVuZGVmaW5lZCIsImxheWVycyIsImxlbmd0aCIsInNsaWNlIiwiaSIsImhhc093blByb3BlcnR5IiwiYWFiYkNlbnRlciIsImFhYmJIYWxmRXh0ZW50cyIsImN1c3RvbUFhYmIiLCJCb3VuZGluZ0JveCIsIlZlYzMiLCJjbG9uZUNvbXBvbmVudCIsImVudGl0eSIsImNsb25lIiwiZGF0YSIsInJlbmRlciIsImVuYWJsZWQiLCJtZXNoSW5zdGFuY2VzIiwiYWRkQ29tcG9uZW50Iiwic3JjTWVzaEluc3RhbmNlcyIsIm1lc2hlcyIsIm1hcCIsIm1pIiwibWVzaCIsIl9vblNldE1lc2hlcyIsIm0iLCJtYXRlcmlhbCIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFZQSxNQUFNQSxPQUFPLEdBQUcsQ0FDWjtBQUFFQyxFQUFBQSxJQUFJLEVBQUUsVUFBVTtBQUFFQyxFQUFBQSxJQUFJLEVB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
