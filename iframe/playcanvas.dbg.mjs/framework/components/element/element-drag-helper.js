import { platform } from '../../../core/platform.js';
import { EventHandler } from '../../../core/event-handler.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ElementComponent } from './component.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';

const _inputScreenPosition = new Vec2();
const _inputWorldPosition = new Vec3();
const _ray = new Ray();
const _plane = new Plane();
const _normal = new Vec3();
const _point = new Vec3();
const _entityRotation = new Quat();
const OPPOSITE_AXIS = {
  x: 'y',
  y: 'x'
};

/**
 * Helper class that makes it easy to create Elements that can be dragged by the mouse or touch.
 *
 * @augments EventHandler
 * @category User Interface
 */
class ElementDragHelper extends EventHandler {
  /**
   * Create a new ElementDragHelper instance.
   *
   * @param {ElementComponent} element - The Element that should become draggable.
   * @param {string} [axis] - Optional axis to constrain to, either 'x', 'y' or null.
   */
  constructor(element, axis) {
    super();
    if (!element || !(element instanceof ElementComponent)) {
      throw new Error('Element was null or not an ElementComponent');
    }
    if (axis && axis !== 'x' && axis !== 'y') {
      throw new Error('Unrecognized axis: ' + axis);
    }
    this._element = element;
    this._app = element.system.app;
    this._axis = axis || null;
    this._enabled = true;
    this._dragScale = new Vec3();
    this._dragStartMousePosition = new Vec3();
    this._dragStartHandlePosition = new Vec3();
    this._deltaMousePosition = new Vec3();
    this._deltaHandlePosition = new Vec3();
    this._isDragging = false;
    this._toggleLifecycleListeners('on');
  }

  /**
   * @param {'on'|'off'} onOrOff - Either 'on' or 'off'.
   * @private
   */
  _toggleLifecycleListeners(onOrOff) {
    this._element[onOrOff]('mousedown', this._onMouseDownOrTouchStart, this);
    this._element[onOrOff]('touchstart', this._onMouseDownOrTouchStart, this);
    this._element[onOrOff]('selectstart', this._onMouseDownOrTouchStart, this);
  }

  /**
   * @param {'on'|'off'} onOrOff - Either 'on' or 'off'.
   * @private
   */
  _toggleDragListeners(onOrOff) {
    const isOn = onOrOff === 'on';

    // Prevent multiple listeners
    if (this._hasDragListeners && isOn) {
      return;
    }

    // mouse events, if mouse is available
    if (this._app.mouse) {
      this._element[onOrOff]('mousemove', this._onMove, this);
      this._element[onOrOff]('mouseup', this._onMouseUpOrTouchEnd, this);
    }

    // touch events, if touch is available
    if (platform.touch) {
      this._element[onOrOff]('touchmove', this._onMove, this);
      this._element[onOrOff]('touchend', this._onMouseUpOrTouchEnd, this);
      this._element[onOrOff]('touchcancel', this._onMouseUpOrTouchEnd, this);
    }

    // webxr events
    this._element[onOrOff]('selectmove', this._onMove, this);
    this._element[onOrOff]('selectend', this._onMouseUpOrTouchEnd, this);
    this._hasDragListeners = isOn;
  }
  _onMouseDownOrTouchStart(event) {
    if (this._element && !this._isDragging && this.enabled) {
      this._dragCamera = event.camera;
      this._calculateDragScale();
      const currentMousePosition = this._screenToLocal(event);
      if (currentMousePosition) {
        this._toggleDragListeners('on');
        this._isDragging = true;
        this._dragStartMousePosition.copy(currentMousePosition);
        this._dragStartHandlePosition.copy(this._element.entity.getLocalPosition());
        this.fire('drag:start');
      }
    }
  }
  _onMouseUpOrTouchEnd() {
    if (this._isDragging) {
      this._isDragging = false;
      this._toggleDragListeners('off');
      this.fire('drag:end');
    }
  }

  /**
   * This method calculates the `Vec3` intersection point of plane/ray intersection based on
   * the mouse/touch input event. If there is no intersection, it returns `null`.
   *
   * @param {import('../../input/element-input').ElementTouchEvent | import('../../input/element-input').ElementMouseEvent | import('../../input/element-input').ElementSelectEvent} event - The event.
   * @returns {Vec3|null} The `Vec3` intersection point of plane/ray intersection, if there
   * is an intersection, otherwise `null`
   * @private
   */
  _screenToLocal(event) {
    if (event.inputSource) {
      _ray.set(event.inputSource.getOrigin(), event.inputSource.getDirection());
    } else {
      this._determineInputPosition(event);
      this._chooseRayOriginAndDirection();
    }
    _normal.copy(this._element.entity.forward).mulScalar(-1);
    _plane.setFromPointNormal(this._element.entity.getPosition(), _normal);
    if (_plane.intersectsRay(_ray, _point)) {
      _entityRotation.copy(this._element.entity.getRotation()).invert().transformVector(_point, _point);
      _point.mul(this._dragScale);
      return _point;
    }
    return null;
  }
  _determineInputPosition(event) {
    const devicePixelRatio = this._app.graphicsDevice.maxPixelRatio;
    if (typeof event.x !== 'undefined' && typeof event.y !== 'undefined') {
      _inputScreenPosition.x = event.x * devicePixelRatio;
      _inputScreenPosition.y = event.y * devicePixelRatio;
    } else if (event.changedTouches) {
      _inputScreenPosition.x = event.changedTouches[0].x * devicePixelRatio;
      _inputScreenPosition.y = event.changedTouches[0].y * devicePixelRatio;
    } else {
      console.warn('Could not determine position from input event');
    }
  }
  _chooseRayOriginAndDirection() {
    if (this._element.screen && this._element.screen.screen.screenSpace) {
      _ray.origin.set(_inputScreenPosition.x, -_inputScreenPosition.y, 0);
      _ray.direction.copy(Vec3.FORWARD);
    } else {
      _inputWorldPosition.copy(this._dragCamera.screenToWorld(_inputScreenPosition.x, _inputScreenPosition.y, 1));
      _ray.origin.copy(this._dragCamera.entity.getPosition());
      _ray.direction.copy(_inputWorldPosition).sub(_ray.origin).normalize();
    }
  }
  _calculateDragScale() {
    let current = this._element.entity.parent;
    const screen = this._element.screen && this._element.screen.screen;
    const isWithin2DScreen = screen && screen.screenSpace;
    const screenScale = isWithin2DScreen ? screen.scale : 1;
    const dragScale = this._dragScale;
    dragScale.set(screenScale, screenScale, screenScale);
    while (current) {
      dragScale.mul(current.getLocalScale());
      current = current.parent;
      if (isWithin2DScreen && current.screen) {
        break;
      }
    }
    dragScale.x = 1 / dragScale.x;
    dragScale.y = 1 / dragScale.y;
    dragScale.z = 0;
  }

  /**
   * This method is linked to `_element` events: `mousemove` and `touchmove`
   *
   * @param {import('../../input/element-input').ElementTouchEvent} event - The event.
   * @private
   */
  _onMove(event) {
    const {
      _element: element,
      _deltaMousePosition: deltaMousePosition,
      _deltaHandlePosition: deltaHandlePosition,
      _axis: axis
    } = this;
    if (element && this._isDragging && this.enabled && element.enabled && element.entity.enabled) {
      const currentMousePosition = this._screenToLocal(event);
      if (currentMousePosition) {
        deltaMousePosition.sub2(currentMousePosition, this._dragStartMousePosition);
        deltaHandlePosition.add2(this._dragStartHandlePosition, deltaMousePosition);
        if (axis) {
          const currentPosition = element.entity.getLocalPosition();
          const constrainedAxis = OPPOSITE_AXIS[axis];
          deltaHandlePosition[constrainedAxis] = currentPosition[constrainedAxis];
        }
        element.entity.setLocalPosition(deltaHandlePosition);
        this.fire('drag:move', deltaHandlePosition);
      }
    }
  }
  destroy() {
    this._toggleLifecycleListeners('off');
    this._toggleDragListeners('off');
  }
  set enabled(value) {
    this._enabled = value;
  }
  get enabled() {
    return this._enabled;
  }
  get isDragging() {
    return this._isDragging;
  }
}
/**
 * Fired when a new drag operation starts.
 *
 * @event
 * @example
 * elementDragHelper.on('drag:start', () => {
 *     console.log('Drag started');
 * });
 */
ElementDragHelper.EVENT_DRAGSTART = 'drag:start';
/**
 * Fired when the current new drag operation ends.
 *
 * @event
 * @example
 * elementDragHelper.on('drag:end', () => {
 *     console.log('Drag ended');
 * });
 */
ElementDragHelper.EVENT_DRAGEND = 'drag:end';
/**
 * Fired whenever the position of the dragged element changes. The handler is passed the
 * current {@link Vec3} position of the dragged element.
 *
 * @event
 * @example
 * elementDragHelper.on('drag:move', (position) => {
 *     console.log(`Dragged element position is ${position}`);
 * });
 */
ElementDragHelper.EVENT_DRAGMOVE = 'drag:move';

export { ElementDragHelper };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC1kcmFnLWhlbHBlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvZWxlbWVudC1kcmFnLWhlbHBlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBFbGVtZW50Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9zaGFwZS9yYXkuanMnO1xuaW1wb3J0IHsgUGxhbmUgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3NoYXBlL3BsYW5lLmpzJztcblxuY29uc3QgX2lucHV0U2NyZWVuUG9zaXRpb24gPSBuZXcgVmVjMigpO1xuY29uc3QgX2lucHV0V29ybGRQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcmF5ID0gbmV3IFJheSgpO1xuY29uc3QgX3BsYW5lID0gbmV3IFBsYW5lKCk7XG5jb25zdCBfbm9ybWFsID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wb2ludCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfZW50aXR5Um90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG5jb25zdCBPUFBPU0lURV9BWElTID0ge1xuICAgIHg6ICd5JyxcbiAgICB5OiAneCdcbn07XG5cbi8qKlxuICogSGVscGVyIGNsYXNzIHRoYXQgbWFrZXMgaXQgZWFzeSB0byBjcmVhdGUgRWxlbWVudHMgdGhhdCBjYW4gYmUgZHJhZ2dlZCBieSB0aGUgbW91c2Ugb3IgdG91Y2guXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IFVzZXIgSW50ZXJmYWNlXG4gKi9cbmNsYXNzIEVsZW1lbnREcmFnSGVscGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgbmV3IGRyYWcgb3BlcmF0aW9uIHN0YXJ0cy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZWxlbWVudERyYWdIZWxwZXIub24oJ2RyYWc6c3RhcnQnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdEcmFnIHN0YXJ0ZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRFJBR1NUQVJUID0gJ2RyYWc6c3RhcnQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY3VycmVudCBuZXcgZHJhZyBvcGVyYXRpb24gZW5kcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZWxlbWVudERyYWdIZWxwZXIub24oJ2RyYWc6ZW5kJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnRHJhZyBlbmRlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9EUkFHRU5EID0gJ2RyYWc6ZW5kJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW5ldmVyIHRoZSBwb3NpdGlvbiBvZiB0aGUgZHJhZ2dlZCBlbGVtZW50IGNoYW5nZXMuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGVcbiAgICAgKiBjdXJyZW50IHtAbGluayBWZWMzfSBwb3NpdGlvbiBvZiB0aGUgZHJhZ2dlZCBlbGVtZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbGVtZW50RHJhZ0hlbHBlci5vbignZHJhZzptb3ZlJywgKHBvc2l0aW9uKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBEcmFnZ2VkIGVsZW1lbnQgcG9zaXRpb24gaXMgJHtwb3NpdGlvbn1gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfRFJBR01PVkUgPSAnZHJhZzptb3ZlJztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50RHJhZ0hlbHBlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50IHRoYXQgc2hvdWxkIGJlY29tZSBkcmFnZ2FibGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtheGlzXSAtIE9wdGlvbmFsIGF4aXMgdG8gY29uc3RyYWluIHRvLCBlaXRoZXIgJ3gnLCAneScgb3IgbnVsbC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50LCBheGlzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgaWYgKCFlbGVtZW50IHx8ICEoZWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnRDb21wb25lbnQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0VsZW1lbnQgd2FzIG51bGwgb3Igbm90IGFuIEVsZW1lbnRDb21wb25lbnQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChheGlzICYmIGF4aXMgIT09ICd4JyAmJiBheGlzICE9PSAneScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5yZWNvZ25pemVkIGF4aXM6ICcgKyBheGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICB0aGlzLl9hcHAgPSBlbGVtZW50LnN5c3RlbS5hcHA7XG4gICAgICAgIHRoaXMuX2F4aXMgPSBheGlzIHx8IG51bGw7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kcmFnU2NhbGUgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9kcmFnU3RhcnRNb3VzZVBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5fZHJhZ1N0YXJ0SGFuZGxlUG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9kZWx0YU1vdXNlUG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9kZWx0YUhhbmRsZVBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5faXNEcmFnZ2luZyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycygnb24nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geydvbid8J29mZid9IG9uT3JPZmYgLSBFaXRoZXIgJ29uJyBvciAnb2ZmJy5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMob25Pck9mZikge1xuICAgICAgICB0aGlzLl9lbGVtZW50W29uT3JPZmZdKCdtb3VzZWRvd24nLCB0aGlzLl9vbk1vdXNlRG93bk9yVG91Y2hTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnRbb25Pck9mZl0oJ3RvdWNoc3RhcnQnLCB0aGlzLl9vbk1vdXNlRG93bk9yVG91Y2hTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnRbb25Pck9mZl0oJ3NlbGVjdHN0YXJ0JywgdGhpcy5fb25Nb3VzZURvd25PclRvdWNoU3RhcnQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7J29uJ3wnb2ZmJ30gb25Pck9mZiAtIEVpdGhlciAnb24nIG9yICdvZmYnLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RvZ2dsZURyYWdMaXN0ZW5lcnMob25Pck9mZikge1xuICAgICAgICBjb25zdCBpc09uID0gb25Pck9mZiA9PT0gJ29uJztcblxuICAgICAgICAvLyBQcmV2ZW50IG11bHRpcGxlIGxpc3RlbmVyc1xuICAgICAgICBpZiAodGhpcy5faGFzRHJhZ0xpc3RlbmVycyAmJiBpc09uKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3VzZSBldmVudHMsIGlmIG1vdXNlIGlzIGF2YWlsYWJsZVxuICAgICAgICBpZiAodGhpcy5fYXBwLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50W29uT3JPZmZdKCdtb3VzZW1vdmUnLCB0aGlzLl9vbk1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudFtvbk9yT2ZmXSgnbW91c2V1cCcsIHRoaXMuX29uTW91c2VVcE9yVG91Y2hFbmQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG91Y2ggZXZlbnRzLCBpZiB0b3VjaCBpcyBhdmFpbGFibGVcbiAgICAgICAgaWYgKHBsYXRmb3JtLnRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50W29uT3JPZmZdKCd0b3VjaG1vdmUnLCB0aGlzLl9vbk1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudFtvbk9yT2ZmXSgndG91Y2hlbmQnLCB0aGlzLl9vbk1vdXNlVXBPclRvdWNoRW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnRbb25Pck9mZl0oJ3RvdWNoY2FuY2VsJywgdGhpcy5fb25Nb3VzZVVwT3JUb3VjaEVuZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZWJ4ciBldmVudHNcbiAgICAgICAgdGhpcy5fZWxlbWVudFtvbk9yT2ZmXSgnc2VsZWN0bW92ZScsIHRoaXMuX29uTW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnRbb25Pck9mZl0oJ3NlbGVjdGVuZCcsIHRoaXMuX29uTW91c2VVcE9yVG91Y2hFbmQsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX2hhc0RyYWdMaXN0ZW5lcnMgPSBpc09uO1xuICAgIH1cblxuICAgIF9vbk1vdXNlRG93bk9yVG91Y2hTdGFydChldmVudCkge1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCAmJiAhdGhpcy5faXNEcmFnZ2luZyAmJiB0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RyYWdDYW1lcmEgPSBldmVudC5jYW1lcmE7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVEcmFnU2NhbGUoKTtcblxuICAgICAgICAgICAgY29uc3QgY3VycmVudE1vdXNlUG9zaXRpb24gPSB0aGlzLl9zY3JlZW5Ub0xvY2FsKGV2ZW50KTtcblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb3VzZVBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlRHJhZ0xpc3RlbmVycygnb24nKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pc0RyYWdnaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kcmFnU3RhcnRNb3VzZVBvc2l0aW9uLmNvcHkoY3VycmVudE1vdXNlUG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RyYWdTdGFydEhhbmRsZVBvc2l0aW9uLmNvcHkodGhpcy5fZWxlbWVudC5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZHJhZzpzdGFydCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTW91c2VVcE9yVG91Y2hFbmQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc0RyYWdnaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVEcmFnTGlzdGVuZXJzKCdvZmYnKTtcblxuICAgICAgICAgICAgdGhpcy5maXJlKCdkcmFnOmVuZCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgY2FsY3VsYXRlcyB0aGUgYFZlYzNgIGludGVyc2VjdGlvbiBwb2ludCBvZiBwbGFuZS9yYXkgaW50ZXJzZWN0aW9uIGJhc2VkIG9uXG4gICAgICogdGhlIG1vdXNlL3RvdWNoIGlucHV0IGV2ZW50LiBJZiB0aGVyZSBpcyBubyBpbnRlcnNlY3Rpb24sIGl0IHJldHVybnMgYG51bGxgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQnKS5FbGVtZW50VG91Y2hFdmVudCB8IGltcG9ydCgnLi4vLi4vaW5wdXQvZWxlbWVudC1pbnB1dCcpLkVsZW1lbnRNb3VzZUV2ZW50IHwgaW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0JykuRWxlbWVudFNlbGVjdEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM3xudWxsfSBUaGUgYFZlYzNgIGludGVyc2VjdGlvbiBwb2ludCBvZiBwbGFuZS9yYXkgaW50ZXJzZWN0aW9uLCBpZiB0aGVyZVxuICAgICAqIGlzIGFuIGludGVyc2VjdGlvbiwgb3RoZXJ3aXNlIGBudWxsYFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NjcmVlblRvTG9jYWwoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LmlucHV0U291cmNlKSB7XG4gICAgICAgICAgICBfcmF5LnNldChldmVudC5pbnB1dFNvdXJjZS5nZXRPcmlnaW4oKSwgZXZlbnQuaW5wdXRTb3VyY2UuZ2V0RGlyZWN0aW9uKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZGV0ZXJtaW5lSW5wdXRQb3NpdGlvbihldmVudCk7XG4gICAgICAgICAgICB0aGlzLl9jaG9vc2VSYXlPcmlnaW5BbmREaXJlY3Rpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9ub3JtYWwuY29weSh0aGlzLl9lbGVtZW50LmVudGl0eS5mb3J3YXJkKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICBfcGxhbmUuc2V0RnJvbVBvaW50Tm9ybWFsKHRoaXMuX2VsZW1lbnQuZW50aXR5LmdldFBvc2l0aW9uKCksIF9ub3JtYWwpO1xuXG4gICAgICAgIGlmIChfcGxhbmUuaW50ZXJzZWN0c1JheShfcmF5LCBfcG9pbnQpKSB7XG4gICAgICAgICAgICBfZW50aXR5Um90YXRpb24uY29weSh0aGlzLl9lbGVtZW50LmVudGl0eS5nZXRSb3RhdGlvbigpKS5pbnZlcnQoKS50cmFuc2Zvcm1WZWN0b3IoX3BvaW50LCBfcG9pbnQpO1xuICAgICAgICAgICAgX3BvaW50Lm11bCh0aGlzLl9kcmFnU2NhbGUpO1xuICAgICAgICAgICAgcmV0dXJuIF9wb2ludDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIF9kZXRlcm1pbmVJbnB1dFBvc2l0aW9uKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IGRldmljZVBpeGVsUmF0aW8gPSB0aGlzLl9hcHAuZ3JhcGhpY3NEZXZpY2UubWF4UGl4ZWxSYXRpbztcblxuICAgICAgICBpZiAodHlwZW9mIGV2ZW50LnggIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBldmVudC55ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgX2lucHV0U2NyZWVuUG9zaXRpb24ueCA9IGV2ZW50LnggKiBkZXZpY2VQaXhlbFJhdGlvO1xuICAgICAgICAgICAgX2lucHV0U2NyZWVuUG9zaXRpb24ueSA9IGV2ZW50LnkgKiBkZXZpY2VQaXhlbFJhdGlvO1xuICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNoYW5nZWRUb3VjaGVzKSB7XG4gICAgICAgICAgICBfaW5wdXRTY3JlZW5Qb3NpdGlvbi54ID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0ueCAqIGRldmljZVBpeGVsUmF0aW87XG4gICAgICAgICAgICBfaW5wdXRTY3JlZW5Qb3NpdGlvbi55ID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0ueSAqIGRldmljZVBpeGVsUmF0aW87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBkZXRlcm1pbmUgcG9zaXRpb24gZnJvbSBpbnB1dCBldmVudCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nob29zZVJheU9yaWdpbkFuZERpcmVjdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuc2NyZWVuICYmIHRoaXMuX2VsZW1lbnQuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgX3JheS5vcmlnaW4uc2V0KF9pbnB1dFNjcmVlblBvc2l0aW9uLngsIC1faW5wdXRTY3JlZW5Qb3NpdGlvbi55LCAwKTtcbiAgICAgICAgICAgIF9yYXkuZGlyZWN0aW9uLmNvcHkoVmVjMy5GT1JXQVJEKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9pbnB1dFdvcmxkUG9zaXRpb24uY29weSh0aGlzLl9kcmFnQ2FtZXJhLnNjcmVlblRvV29ybGQoX2lucHV0U2NyZWVuUG9zaXRpb24ueCwgX2lucHV0U2NyZWVuUG9zaXRpb24ueSwgMSkpO1xuICAgICAgICAgICAgX3JheS5vcmlnaW4uY29weSh0aGlzLl9kcmFnQ2FtZXJhLmVudGl0eS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIF9yYXkuZGlyZWN0aW9uLmNvcHkoX2lucHV0V29ybGRQb3NpdGlvbikuc3ViKF9yYXkub3JpZ2luKS5ub3JtYWxpemUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jYWxjdWxhdGVEcmFnU2NhbGUoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gdGhpcy5fZWxlbWVudC5lbnRpdHkucGFyZW50O1xuICAgICAgICBjb25zdCBzY3JlZW4gPSB0aGlzLl9lbGVtZW50LnNjcmVlbiAmJiB0aGlzLl9lbGVtZW50LnNjcmVlbi5zY3JlZW47XG4gICAgICAgIGNvbnN0IGlzV2l0aGluMkRTY3JlZW4gPSBzY3JlZW4gJiYgc2NyZWVuLnNjcmVlblNwYWNlO1xuICAgICAgICBjb25zdCBzY3JlZW5TY2FsZSA9IGlzV2l0aGluMkRTY3JlZW4gPyBzY3JlZW4uc2NhbGUgOiAxO1xuICAgICAgICBjb25zdCBkcmFnU2NhbGUgPSB0aGlzLl9kcmFnU2NhbGU7XG5cbiAgICAgICAgZHJhZ1NjYWxlLnNldChzY3JlZW5TY2FsZSwgc2NyZWVuU2NhbGUsIHNjcmVlblNjYWxlKTtcblxuICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgZHJhZ1NjYWxlLm11bChjdXJyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG5cbiAgICAgICAgICAgIGlmIChpc1dpdGhpbjJEU2NyZWVuICYmIGN1cnJlbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkcmFnU2NhbGUueCA9IDEgLyBkcmFnU2NhbGUueDtcbiAgICAgICAgZHJhZ1NjYWxlLnkgPSAxIC8gZHJhZ1NjYWxlLnk7XG4gICAgICAgIGRyYWdTY2FsZS56ID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaW5rZWQgdG8gYF9lbGVtZW50YCBldmVudHM6IGBtb3VzZW1vdmVgIGFuZCBgdG91Y2htb3ZlYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQnKS5FbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb3ZlKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIF9lbGVtZW50OiBlbGVtZW50LFxuICAgICAgICAgICAgX2RlbHRhTW91c2VQb3NpdGlvbjogZGVsdGFNb3VzZVBvc2l0aW9uLFxuICAgICAgICAgICAgX2RlbHRhSGFuZGxlUG9zaXRpb246IGRlbHRhSGFuZGxlUG9zaXRpb24sXG4gICAgICAgICAgICBfYXhpczogYXhpc1xuICAgICAgICB9ID0gdGhpcztcbiAgICAgICAgaWYgKGVsZW1lbnQgJiYgdGhpcy5faXNEcmFnZ2luZyAmJiB0aGlzLmVuYWJsZWQgJiYgZWxlbWVudC5lbmFibGVkICYmIGVsZW1lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRNb3VzZVBvc2l0aW9uID0gdGhpcy5fc2NyZWVuVG9Mb2NhbChldmVudCk7XG4gICAgICAgICAgICBpZiAoY3VycmVudE1vdXNlUG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICBkZWx0YU1vdXNlUG9zaXRpb24uc3ViMihjdXJyZW50TW91c2VQb3NpdGlvbiwgdGhpcy5fZHJhZ1N0YXJ0TW91c2VQb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgZGVsdGFIYW5kbGVQb3NpdGlvbi5hZGQyKHRoaXMuX2RyYWdTdGFydEhhbmRsZVBvc2l0aW9uLCBkZWx0YU1vdXNlUG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGF4aXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFBvc2l0aW9uID0gZWxlbWVudC5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb25zdHJhaW5lZEF4aXMgPSBPUFBPU0lURV9BWElTW2F4aXNdO1xuICAgICAgICAgICAgICAgICAgICBkZWx0YUhhbmRsZVBvc2l0aW9uW2NvbnN0cmFpbmVkQXhpc10gPSBjdXJyZW50UG9zaXRpb25bY29uc3RyYWluZWRBeGlzXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50LmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKGRlbHRhSGFuZGxlUG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZHJhZzptb3ZlJywgZGVsdGFIYW5kbGVQb3NpdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMoJ29mZicpO1xuICAgICAgICB0aGlzLl90b2dnbGVEcmFnTGlzdGVuZXJzKCdvZmYnKTtcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIGdldCBpc0RyYWdnaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNEcmFnZ2luZztcbiAgICB9XG59XG5cbmV4cG9ydCB7IEVsZW1lbnREcmFnSGVscGVyIH07XG4iXSwibmFtZXMiOlsiX2lucHV0U2NyZWVuUG9zaXRpb24iLCJWZWMyIiwiX2lucHV0V29ybGRQb3NpdGlvbiIsIlZlYzMiLCJfcmF5IiwiUmF5IiwiX3BsYW5lIiwiUGxhbmUiLCJfbm9ybWFsIiwiX3BvaW50IiwiX2VudGl0eVJvdGF0aW9uIiwiUXVhdCIsIk9QUE9TSVRFX0FYSVMiLCJ4IiwieSIsIkVsZW1lbnREcmFnSGVscGVyIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJlbGVtZW50IiwiYXhpcyIsIkVsZW1lbnRDb21wb25lbnQiLCJFcnJvciIsIl9lbGVtZW50IiwiX2FwcCIsInN5c3RlbSIsImFwcCIsIl9heGlzIiwiX2VuYWJsZWQiLCJfZHJhZ1NjYWxlIiwiX2RyYWdTdGFydE1vdXNlUG9zaXRpb24iLCJfZHJhZ1N0YXJ0SGFuZGxlUG9zaXRpb24iLCJfZGVsdGFNb3VzZVBvc2l0aW9uIiwiX2RlbHRhSGFuZGxlUG9zaXRpb24iLCJfaXNEcmFnZ2luZyIsIl90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMiLCJvbk9yT2ZmIiwiX29uTW91c2VEb3duT3JUb3VjaFN0YXJ0IiwiX3RvZ2dsZURyYWdMaXN0ZW5lcnMiLCJpc09uIiwiX2hhc0RyYWdMaXN0ZW5lcnMiLCJtb3VzZSIsIl9vbk1vdmUiLCJfb25Nb3VzZVVwT3JUb3VjaEVuZCIsInBsYXRmb3JtIiwidG91Y2giLCJldmVudCIsImVuYWJsZWQiLCJfZHJhZ0NhbWVyYSIsImNhbWVyYSIsIl9jYWxjdWxhdGVEcmFnU2NhbGUiLCJjdXJyZW50TW91c2VQb3NpdGlvbiIsIl9zY3JlZW5Ub0xvY2FsIiwiY29weSIsImVudGl0eSIsImdldExvY2FsUG9zaXRpb24iLCJmaXJlIiwiaW5wdXRTb3VyY2UiLCJzZXQiLCJnZXRPcmlnaW4iLCJnZXREaXJlY3Rpb24iLCJfZGV0ZXJtaW5lSW5wdXRQb3NpdGlvbiIsIl9jaG9vc2VSYXlPcmlnaW5BbmREaXJlY3Rpb24iLCJmb3J3YXJkIiwibXVsU2NhbGFyIiwic2V0RnJvbVBvaW50Tm9ybWFsIiwiZ2V0UG9zaXRpb24iLCJpbnRlcnNlY3RzUmF5IiwiZ2V0Um90YXRpb24iLCJpbnZlcnQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJtdWwiLCJkZXZpY2VQaXhlbFJhdGlvIiwiZ3JhcGhpY3NEZXZpY2UiLCJtYXhQaXhlbFJhdGlvIiwiY2hhbmdlZFRvdWNoZXMiLCJjb25zb2xlIiwid2FybiIsInNjcmVlbiIsInNjcmVlblNwYWNlIiwib3JpZ2luIiwiZGlyZWN0aW9uIiwiRk9SV0FSRCIsInNjcmVlblRvV29ybGQiLCJzdWIiLCJub3JtYWxpemUiLCJjdXJyZW50IiwicGFyZW50IiwiaXNXaXRoaW4yRFNjcmVlbiIsInNjcmVlblNjYWxlIiwic2NhbGUiLCJkcmFnU2NhbGUiLCJnZXRMb2NhbFNjYWxlIiwieiIsImRlbHRhTW91c2VQb3NpdGlvbiIsImRlbHRhSGFuZGxlUG9zaXRpb24iLCJzdWIyIiwiYWRkMiIsImN1cnJlbnRQb3NpdGlvbiIsImNvbnN0cmFpbmVkQXhpcyIsInNldExvY2FsUG9zaXRpb24iLCJkZXN0cm95IiwidmFsdWUiLCJpc0RyYWdnaW5nIiwiRVZFTlRfRFJBR1NUQVJU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