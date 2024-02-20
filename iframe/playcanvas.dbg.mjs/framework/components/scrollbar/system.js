import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScrollbarComponent } from './component.js';
import { ScrollbarComponentData } from './data.js';

const _schema = [{
  name: 'enabled',
  type: 'boolean'
}, {
  name: 'orientation',
  type: 'number'
}, {
  name: 'value',
  type: 'number'
}, {
  name: 'handleSize',
  type: 'number'
}, {
  name: 'handleEntity',
  type: 'entity'
}];

/**
 * Manages creation of {@link ScrollbarComponent}s.
 *
 * @augments ComponentSystem
 * @category User Interface
 */
class ScrollbarComponentSystem extends ComponentSystem {
  /**
   * Create a new ScrollbarComponentSystem.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'scrollbar';
    this.ComponentType = ScrollbarComponent;
    this.DataType = ScrollbarComponentData;
    this.schema = _schema;
    this.on('beforeremove', this._onRemoveComponent, this);
  }
  initializeComponentData(component, data, properties) {
    super.initializeComponentData(component, data, _schema);
  }
  _onRemoveComponent(entity, component) {
    component.onRemove();
  }
}
Component._buildAccessors(ScrollbarComponent.prototype, _schema);

export { ScrollbarComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2Nyb2xsYmFyL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgU2Nyb2xsYmFyQ29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYmFyQ29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbmNvbnN0IF9zY2hlbWEgPSBbXG4gICAgeyBuYW1lOiAnZW5hYmxlZCcsIHR5cGU6ICdib29sZWFuJyB9LFxuICAgIHsgbmFtZTogJ29yaWVudGF0aW9uJywgdHlwZTogJ251bWJlcicgfSxcbiAgICB7IG5hbWU6ICd2YWx1ZScsIHR5cGU6ICdudW1iZXInIH0sXG4gICAgeyBuYW1lOiAnaGFuZGxlU2l6ZScsIHR5cGU6ICdudW1iZXInIH0sXG4gICAgeyBuYW1lOiAnaGFuZGxlRW50aXR5JywgdHlwZTogJ2VudGl0eScgfVxuXTtcblxuLyoqXG4gKiBNYW5hZ2VzIGNyZWF0aW9uIG9mIHtAbGluayBTY3JvbGxiYXJDb21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKiBAY2F0ZWdvcnkgVXNlciBJbnRlcmZhY2VcbiAqL1xuY2xhc3MgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ3Njcm9sbGJhcic7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gU2Nyb2xsYmFyQ29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gU2Nyb2xsYmFyQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25SZW1vdmVDb21wb25lbnQsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIF9zY2hlbWEpO1xuICAgIH1cblxuICAgIF9vblJlbW92ZUNvbXBvbmVudChlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQub25SZW1vdmUoKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoU2Nyb2xsYmFyQ29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IFNjcm9sbGJhckNvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJuYW1lIiwidHlwZSIsIlNjcm9sbGJhckNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaWQiLCJDb21wb25lbnRUeXBlIiwiU2Nyb2xsYmFyQ29tcG9uZW50IiwiRGF0YVR5cGUiLCJTY3JvbGxiYXJDb21wb25lbnREYXRhIiwic2NoZW1hIiwib24iLCJfb25SZW1vdmVDb21wb25lbnQiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsImRhdGEiLCJwcm9wZXJ0aWVzIiwiZW50aXR5Iiwib25SZW1vdmUiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7O0FBTUEsTUFBTUEsT0FBTyxHQUFHLENBQ1o7QUFBRUMsRUFBQUEsSUFBSSxFQUFFLFNBQVM7QUFBRUMsRUFBQUEsSUFBSSxFQUFFLFNBQUE7QUFBVSxDQUFDLEVBQ3BDO0FBQUVELEVBQUFBLElBQUksRUFBRSxhQUFhO0FBQUVDLEVBQUFBLElBQUksRUFBRSxRQUFBO0FBQVMsQ0FBQyxFQUN2QztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsT0FBTztBQUFFQyxFQUFBQSxJQUFJLEVBQUUsUUFBQTtBQUFTLENBQUMsRUFDakM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLFlBQVk7QUFBRUMsRUFBQUEsSUFBSSxFQUFFLFFBQUE7QUFBUyxDQUFDLEVBQ3RDO0FBQUVELEVBQUFBLElBQUksRUFBRSxjQUFjO0FBQUVDLEVBQUFBLElBQUksRUFBRSxRQUFBO0FBQVMsQ0FBQyxDQUMzQyxDQUFBOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLHdCQUF3QixTQUFTQyxlQUFlLENBQUM7QUFDbkQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLEdBQUcsRUFBRTtJQUNiLEtBQUssQ0FBQ0EsR0FBRyxDQUFDLENBQUE7SUFFVixJQUFJLENBQUNDLEVBQUUsR0FBRyxXQUFXLENBQUE7SUFFckIsSUFBSSxDQUFDQyxhQUFhLEdBQUdDLGtCQUFrQixDQUFBO0lBQ3ZDLElBQUksQ0FBQ0MsUUFBUSxHQUFHQyxzQkFBc0IsQ0FBQTtJQUV0QyxJQUFJLENBQUNDLE1BQU0sR0FBR1osT0FBTyxDQUFBO0lBRXJCLElBQUksQ0FBQ2EsRUFBRSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUNDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQzFELEdBQUE7QUFFQUMsRUFBQUEsdUJBQXVCQSxDQUFDQyxTQUFTLEVBQUVDLElBQUksRUFBRUMsVUFBVSxFQUFFO0lBQ2pELEtBQUssQ0FBQ0gsdUJBQXVCLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxFQUFFakIsT0FBTyxDQUFDLENBQUE7QUFDM0QsR0FBQTtBQUVBYyxFQUFBQSxrQkFBa0JBLENBQUNLLE1BQU0sRUFBRUgsU0FBUyxFQUFFO0lBQ2xDQSxTQUFTLENBQUNJLFFBQVEsRUFBRSxDQUFBO0FBQ3hCLEdBQUE7QUFDSixDQUFBO0FBRUFDLFNBQVMsQ0FBQ0MsZUFBZSxDQUFDYixrQkFBa0IsQ0FBQ2MsU0FBUyxFQUFFdkIsT0FBTyxDQUFDOzs7OyJ9
