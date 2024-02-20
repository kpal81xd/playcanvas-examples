import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { LIGHTSHAPE_PUNCTUAL } from '../../../scene/constants.js';
import { Light, lightTypes } from '../../../scene/light.js';
import { ComponentSystem } from '../system.js';
import { LightComponent, _lightProps } from './component.js';
import { LightComponentData } from './data.js';

/**
 * A Light Component is used to dynamically light the scene.
 *
 * @augments ComponentSystem
 * @category Graphics
 */
class LightComponentSystem extends ComponentSystem {
  /**
   * Create a new LightComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'light';
    this.ComponentType = LightComponent;
    this.DataType = LightComponentData;
    this.on('beforeremove', this._onRemoveComponent, this);
  }
  initializeComponentData(component, _data) {
    const properties = _lightProps;

    // duplicate because we're modifying the data
    const data = {};
    for (let i = 0, len = properties.length; i < len; i++) {
      const property = properties[i];
      data[property] = _data[property];
    }
    if (!data.type) data.type = component.data.type;
    component.data.type = data.type;
    if (data.layers && Array.isArray(data.layers)) {
      data.layers = data.layers.slice(0);
    }
    if (data.color && Array.isArray(data.color)) data.color = new Color(data.color[0], data.color[1], data.color[2]);
    if (data.cookieOffset && data.cookieOffset instanceof Array) data.cookieOffset = new Vec2(data.cookieOffset[0], data.cookieOffset[1]);
    if (data.cookieScale && data.cookieScale instanceof Array) data.cookieScale = new Vec2(data.cookieScale[0], data.cookieScale[1]);
    if (data.enable) {
      console.warn('WARNING: enable: Property is deprecated. Set enabled property instead.');
      data.enabled = data.enable;
    }
    if (!data.shape) {
      data.shape = LIGHTSHAPE_PUNCTUAL;
    }
    const light = new Light(this.app.graphicsDevice, this.app.scene.clusteredLightingEnabled);
    light.type = lightTypes[data.type];
    light._node = component.entity;
    component.data.light = light;
    super.initializeComponentData(component, data, properties);
  }
  _onRemoveComponent(entity, component) {
    component.onRemove();
  }
  cloneComponent(entity, clone) {
    const light = entity.light;
    const data = [];
    let name;
    const _props = _lightProps;
    for (let i = 0; i < _props.length; i++) {
      name = _props[i];
      if (name === 'light') continue;
      if (light[name] && light[name].clone) {
        data[name] = light[name].clone();
      } else {
        data[name] = light[name];
      }
    }
    return this.addComponent(clone, data);
  }
  changeType(component, oldValue, newValue) {
    if (oldValue !== newValue) {
      component.light.type = lightTypes[newValue];
    }
  }
}

export { LightComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvc3lzdGVtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5cbmltcG9ydCB7IExJR0hUU0hBUEVfUFVOQ1RVQUwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHQsIGxpZ2h0VHlwZXMgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9saWdodC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IF9saWdodFByb3BzLCBMaWdodENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbi8qKlxuICogQSBMaWdodCBDb21wb25lbnQgaXMgdXNlZCB0byBkeW5hbWljYWxseSBsaWdodCB0aGUgc2NlbmUuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIExpZ2h0Q29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTGlnaHRDb21wb25lbnRTeXN0ZW0gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnbGlnaHQnO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IExpZ2h0Q29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gTGlnaHRDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMuX29uUmVtb3ZlQ29tcG9uZW50LCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIF9kYXRhKSB7XG4gICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBfbGlnaHRQcm9wcztcblxuICAgICAgICAvLyBkdXBsaWNhdGUgYmVjYXVzZSB3ZSdyZSBtb2RpZnlpbmcgdGhlIGRhdGFcbiAgICAgICAgY29uc3QgZGF0YSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcGVydGllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBwcm9wZXJ0aWVzW2ldO1xuICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBfZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWRhdGEudHlwZSlcbiAgICAgICAgICAgIGRhdGEudHlwZSA9IGNvbXBvbmVudC5kYXRhLnR5cGU7XG5cbiAgICAgICAgY29tcG9uZW50LmRhdGEudHlwZSA9IGRhdGEudHlwZTtcblxuICAgICAgICBpZiAoZGF0YS5sYXllcnMgJiYgQXJyYXkuaXNBcnJheShkYXRhLmxheWVycykpIHtcbiAgICAgICAgICAgIGRhdGEubGF5ZXJzID0gZGF0YS5sYXllcnMuc2xpY2UoMCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5jb2xvciAmJiBBcnJheS5pc0FycmF5KGRhdGEuY29sb3IpKVxuICAgICAgICAgICAgZGF0YS5jb2xvciA9IG5ldyBDb2xvcihkYXRhLmNvbG9yWzBdLCBkYXRhLmNvbG9yWzFdLCBkYXRhLmNvbG9yWzJdKTtcblxuICAgICAgICBpZiAoZGF0YS5jb29raWVPZmZzZXQgJiYgZGF0YS5jb29raWVPZmZzZXQgaW5zdGFuY2VvZiBBcnJheSlcbiAgICAgICAgICAgIGRhdGEuY29va2llT2Zmc2V0ID0gbmV3IFZlYzIoZGF0YS5jb29raWVPZmZzZXRbMF0sIGRhdGEuY29va2llT2Zmc2V0WzFdKTtcblxuICAgICAgICBpZiAoZGF0YS5jb29raWVTY2FsZSAmJiBkYXRhLmNvb2tpZVNjYWxlIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgICAgICBkYXRhLmNvb2tpZVNjYWxlID0gbmV3IFZlYzIoZGF0YS5jb29raWVTY2FsZVswXSwgZGF0YS5jb29raWVTY2FsZVsxXSk7XG5cbiAgICAgICAgaWYgKGRhdGEuZW5hYmxlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1dBUk5JTkc6IGVuYWJsZTogUHJvcGVydHkgaXMgZGVwcmVjYXRlZC4gU2V0IGVuYWJsZWQgcHJvcGVydHkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIGRhdGEuZW5hYmxlZCA9IGRhdGEuZW5hYmxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkYXRhLnNoYXBlKSB7XG4gICAgICAgICAgICBkYXRhLnNoYXBlID0gTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gbmV3IExpZ2h0KHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLCB0aGlzLmFwcC5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuICAgICAgICBsaWdodC50eXBlID0gbGlnaHRUeXBlc1tkYXRhLnR5cGVdO1xuICAgICAgICBsaWdodC5fbm9kZSA9IGNvbXBvbmVudC5lbnRpdHk7XG4gICAgICAgIGNvbXBvbmVudC5kYXRhLmxpZ2h0ID0gbGlnaHQ7XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKTtcbiAgICB9XG5cbiAgICBfb25SZW1vdmVDb21wb25lbnQoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50Lm9uUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBsaWdodCA9IGVudGl0eS5saWdodDtcblxuICAgICAgICBjb25zdCBkYXRhID0gW107XG4gICAgICAgIGxldCBuYW1lO1xuICAgICAgICBjb25zdCBfcHJvcHMgPSBfbGlnaHRQcm9wcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBfcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG5hbWUgPSBfcHJvcHNbaV07XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gJ2xpZ2h0JykgY29udGludWU7XG4gICAgICAgICAgICBpZiAobGlnaHRbbmFtZV0gJiYgbGlnaHRbbmFtZV0uY2xvbmUpIHtcbiAgICAgICAgICAgICAgICBkYXRhW25hbWVdID0gbGlnaHRbbmFtZV0uY2xvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGF0YVtuYW1lXSA9IGxpZ2h0W25hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcbiAgICB9XG5cbiAgICBjaGFuZ2VUeXBlKGNvbXBvbmVudCwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5saWdodC50eXBlID0gbGlnaHRUeXBlc1tuZXdWYWx1ZV07XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0Q29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiTGlnaHRDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIkxpZ2h0Q29tcG9uZW50IiwiRGF0YVR5cGUiLCJMaWdodENvbXBvbmVudERhdGEiLCJvbiIsIl9vblJlbW92ZUNvbXBvbmVudCIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiX2RhdGEiLCJwcm9wZXJ0aWVzIiwiX2xpZ2h0UHJvcHMiLCJkYXRhIiwiaSIsImxlbiIsImxlbmd0aCIsInByb3BlcnR5IiwidHlwZSIsImxheWVycyIsIkFycmF5IiwiaXNBcnJheSIsInNsaWNlIiwiY29sb3IiLCJDb2xvciIsImNvb2tpZU9mZnNldCIsIlZlYzIiLCJjb29raWVTY2FsZSIsImVuYWJsZSIsImNvbnNvbGUiLCJ3YXJuIiwiZW5hYmxlZCIsInNoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsImxpZ2h0IiwiTGlnaHQiLCJncmFwaGljc0RldmljZSIsInNjZW5lIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHRUeXBlcyIsIl9ub2RlIiwiZW50aXR5Iiwib25SZW1vdmUiLCJjbG9uZUNvbXBvbmVudCIsImNsb25lIiwibmFtZSIsIl9wcm9wcyIsImFkZENvbXBvbmVudCIsImNoYW5nZVR5cGUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLG9CQUFvQixTQUFTQyxlQUFlLENBQUM7QUFDL0M7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLEdBQUcsRUFBRTtJQUNiLEtBQUssQ0FBQ0EsR0FBRyxDQUFDLENBQUE7SUFFVixJQUFJLENBQUNDLEVBQUUsR0FBRyxPQUFPLENBQUE7SUFFakIsSUFBSSxDQUFDQyxhQUFhLEdBQUdDLGNBQWMsQ0FBQTtJQUNuQyxJQUFJLENBQUNDLFFBQVEsR0FBR0Msa0JBQWtCLENBQUE7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
