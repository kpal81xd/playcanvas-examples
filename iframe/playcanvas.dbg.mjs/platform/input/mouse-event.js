import { MOUSEBUTTON_NONE } from './constants.js';

/**
 * Returns true if pointer lock is currently enabled.
 *
 * @returns {boolean} True if pointer lock is currently enabled.
 * @ignore
 */
function isMousePointerLocked() {
  return !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
}

/**
 * MouseEvent object that is passed to events 'mousemove', 'mouseup', 'mousedown' and 'mousewheel'.
 *
 * @category Input
 */
class MouseEvent {
  /**
   * Create a new MouseEvent instance.
   *
   * @param {import('./mouse.js').Mouse} mouse - The Mouse device that is firing this event.
   * @param {globalThis.MouseEvent} event - The original browser event that fired.
   */
  constructor(mouse, event) {
    let coords = {
      x: 0,
      y: 0
    };
    if (event) {
      if (event instanceof MouseEvent) {
        throw Error('Expected MouseEvent');
      }
      coords = mouse._getTargetCoords(event);
    } else {
      event = {};
    }
    if (coords) {
      /**
       * The x coordinate of the mouse pointer relative to the element {@link Mouse} is
       * attached to.
       *
       * @type {number}
       */
      this.x = coords.x;
      /**
       * The y coordinate of the mouse pointer relative to the element {@link Mouse} is
       * attached to.
       *
       * @type {number}
       */
      this.y = coords.y;
    } else if (isMousePointerLocked()) {
      this.x = 0;
      this.y = 0;
    } else {
      return;
    }

    /**
     * A value representing the amount the mouse wheel has moved, only valid for
     * {@link EVENT_MOUSEWHEEL} events.
     *
     * @type {number}
     */
    this.wheelDelta = 0;
    // deltaY is in a different range across different browsers. The only thing
    // that is consistent is the sign of the value so snap to -1/+1.
    if (event.type === 'wheel') {
      if (event.deltaY > 0) {
        this.wheelDelta = 1;
      } else if (event.deltaY < 0) {
        this.wheelDelta = -1;
      }
    }

    // Get the movement delta in this event
    if (isMousePointerLocked()) {
      /**
       * The change in x coordinate since the last mouse event.
       *
       * @type {number}
       */
      this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
      /**
       * The change in y coordinate since the last mouse event.
       *
       * @type {number}
       */
      this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
    } else {
      this.dx = this.x - mouse._lastX;
      this.dy = this.y - mouse._lastY;
    }
    if (event.type === 'mousedown' || event.type === 'mouseup') {
      /**
       * The mouse button associated with this event. Can be:
       *
       * - {@link MOUSEBUTTON_LEFT}
       * - {@link MOUSEBUTTON_MIDDLE}
       * - {@link MOUSEBUTTON_RIGHT}
       *
       * @type {number}
       */
      this.button = event.button;
    } else {
      this.button = MOUSEBUTTON_NONE;
    }
    this.buttons = mouse._buttons.slice(0);

    /**
     * The element that the mouse was fired from.
     *
     * @type {Element}
     */
    this.element = event.target;

    /**
     * True if the ctrl key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    this.ctrlKey = event.ctrlKey || false;
    /**
     * True if the alt key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    this.altKey = event.altKey || false;
    /**
     * True if the shift key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    this.shiftKey = event.shiftKey || false;
    /**
     * True if the meta key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    this.metaKey = event.metaKey || false;

    /**
     * The original browser event.
     *
     * @type {globalThis.MouseEvent}
     */
    this.event = event;
  }
}

export { MouseEvent, isMousePointerLocked };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW91c2UtZXZlbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9pbnB1dC9tb3VzZS1ldmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNT1VTRUJVVFRPTl9OT05FIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBwb2ludGVyIGxvY2sgaXMgY3VycmVudGx5IGVuYWJsZWQuXG4gKlxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgcG9pbnRlciBsb2NrIGlzIGN1cnJlbnRseSBlbmFibGVkLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBpc01vdXNlUG9pbnRlckxvY2tlZCgpIHtcbiAgICByZXR1cm4gISEoZG9jdW1lbnQucG9pbnRlckxvY2tFbGVtZW50IHx8IGRvY3VtZW50Lm1velBvaW50ZXJMb2NrRWxlbWVudCB8fCBkb2N1bWVudC53ZWJraXRQb2ludGVyTG9ja0VsZW1lbnQpO1xufVxuXG4vKipcbiAqIE1vdXNlRXZlbnQgb2JqZWN0IHRoYXQgaXMgcGFzc2VkIHRvIGV2ZW50cyAnbW91c2Vtb3ZlJywgJ21vdXNldXAnLCAnbW91c2Vkb3duJyBhbmQgJ21vdXNld2hlZWwnLlxuICpcbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5jbGFzcyBNb3VzZUV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTW91c2VFdmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21vdXNlLmpzJykuTW91c2V9IG1vdXNlIC0gVGhlIE1vdXNlIGRldmljZSB0aGF0IGlzIGZpcmluZyB0aGlzIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7Z2xvYmFsVGhpcy5Nb3VzZUV2ZW50fSBldmVudCAtIFRoZSBvcmlnaW5hbCBicm93c2VyIGV2ZW50IHRoYXQgZmlyZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobW91c2UsIGV2ZW50KSB7XG4gICAgICAgIGxldCBjb29yZHMgPSB7XG4gICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgeTogMFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50IGluc3RhbmNlb2YgTW91c2VFdmVudCkge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdFeHBlY3RlZCBNb3VzZUV2ZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb29yZHMgPSBtb3VzZS5fZ2V0VGFyZ2V0Q29vcmRzKGV2ZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV2ZW50ID0geyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvb3Jkcykge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgeCBjb29yZGluYXRlIG9mIHRoZSBtb3VzZSBwb2ludGVyIHJlbGF0aXZlIHRvIHRoZSBlbGVtZW50IHtAbGluayBNb3VzZX0gaXNcbiAgICAgICAgICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMueCA9IGNvb3Jkcy54O1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgeSBjb29yZGluYXRlIG9mIHRoZSBtb3VzZSBwb2ludGVyIHJlbGF0aXZlIHRvIHRoZSBlbGVtZW50IHtAbGluayBNb3VzZX0gaXNcbiAgICAgICAgICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMueSA9IGNvb3Jkcy55O1xuICAgICAgICB9IGVsc2UgaWYgKGlzTW91c2VQb2ludGVyTG9ja2VkKCkpIHtcbiAgICAgICAgICAgIHRoaXMueCA9IDA7XG4gICAgICAgICAgICB0aGlzLnkgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgdmFsdWUgcmVwcmVzZW50aW5nIHRoZSBhbW91bnQgdGhlIG1vdXNlIHdoZWVsIGhhcyBtb3ZlZCwgb25seSB2YWxpZCBmb3JcbiAgICAgICAgICoge0BsaW5rIEVWRU5UX01PVVNFV0hFRUx9IGV2ZW50cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IDA7XG4gICAgICAgIC8vIGRlbHRhWSBpcyBpbiBhIGRpZmZlcmVudCByYW5nZSBhY3Jvc3MgZGlmZmVyZW50IGJyb3dzZXJzLiBUaGUgb25seSB0aGluZ1xuICAgICAgICAvLyB0aGF0IGlzIGNvbnNpc3RlbnQgaXMgdGhlIHNpZ24gb2YgdGhlIHZhbHVlIHNvIHNuYXAgdG8gLTEvKzEuXG4gICAgICAgIGlmIChldmVudC50eXBlID09PSAnd2hlZWwnKSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuZGVsdGFZID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRlbHRhWSA8IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdldCB0aGUgbW92ZW1lbnQgZGVsdGEgaW4gdGhpcyBldmVudFxuICAgICAgICBpZiAoaXNNb3VzZVBvaW50ZXJMb2NrZWQoKSkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgY2hhbmdlIGluIHggY29vcmRpbmF0ZSBzaW5jZSB0aGUgbGFzdCBtb3VzZSBldmVudC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmR4ID0gZXZlbnQubW92ZW1lbnRYIHx8IGV2ZW50LndlYmtpdE1vdmVtZW50WCB8fCBldmVudC5tb3pNb3ZlbWVudFggfHwgMDtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGNoYW5nZSBpbiB5IGNvb3JkaW5hdGUgc2luY2UgdGhlIGxhc3QgbW91c2UgZXZlbnQuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5keSA9IGV2ZW50Lm1vdmVtZW50WSB8fCBldmVudC53ZWJraXRNb3ZlbWVudFkgfHwgZXZlbnQubW96TW92ZW1lbnRZIHx8IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR4ID0gdGhpcy54IC0gbW91c2UuX2xhc3RYO1xuICAgICAgICAgICAgdGhpcy5keSA9IHRoaXMueSAtIG1vdXNlLl9sYXN0WTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC50eXBlID09PSAnbW91c2Vkb3duJyB8fCBldmVudC50eXBlID09PSAnbW91c2V1cCcpIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIG1vdXNlIGJ1dHRvbiBhc3NvY2lhdGVkIHdpdGggdGhpcyBldmVudC4gQ2FuIGJlOlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIC0ge0BsaW5rIE1PVVNFQlVUVE9OX0xFRlR9XG4gICAgICAgICAgICAgKiAtIHtAbGluayBNT1VTRUJVVFRPTl9NSURETEV9XG4gICAgICAgICAgICAgKiAtIHtAbGluayBNT1VTRUJVVFRPTl9SSUdIVH1cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmJ1dHRvbiA9IGV2ZW50LmJ1dHRvbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9uID0gTU9VU0VCVVRUT05fTk9ORTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmJ1dHRvbnMgPSBtb3VzZS5fYnV0dG9ucy5zbGljZSgwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVsZW1lbnQgdGhhdCB0aGUgbW91c2Ugd2FzIGZpcmVkIGZyb20uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZXZlbnQudGFyZ2V0O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBjdHJsIGtleSB3YXMgcHJlc3NlZCB3aGVuIHRoaXMgZXZlbnQgd2FzIGZpcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3RybEtleSA9IGV2ZW50LmN0cmxLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBhbHQga2V5IHdhcyBwcmVzc2VkIHdoZW4gdGhpcyBldmVudCB3YXMgZmlyZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hbHRLZXkgPSBldmVudC5hbHRLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBzaGlmdCBrZXkgd2FzIHByZXNzZWQgd2hlbiB0aGlzIGV2ZW50IHdhcyBmaXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNoaWZ0S2V5ID0gZXZlbnQuc2hpZnRLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtZXRhIGtleSB3YXMgcHJlc3NlZCB3aGVuIHRoaXMgZXZlbnQgd2FzIGZpcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWV0YUtleSA9IGV2ZW50Lm1ldGFLZXkgfHwgZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBvcmlnaW5hbCBicm93c2VyIGV2ZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Z2xvYmFsVGhpcy5Nb3VzZUV2ZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgaXNNb3VzZVBvaW50ZXJMb2NrZWQsIE1vdXNlRXZlbnQgfTtcbiJdLCJuYW1lcyI6WyJpc01vdXNlUG9pbnRlckxvY2tlZCIsImRvY3VtZW50IiwicG9pbnRlckxvY2tFbGVtZW50IiwibW96UG9pbnRlckxvY2tFbGVtZW50Iiwid2Via2l0UG9pbnRlckxvY2tFbGVtZW50IiwiTW91c2VFdmVudCIsImNvbnN0cnVjdG9yIiwibW91c2UiLCJldmVudCIsImNvb3JkcyIsIngiLCJ5IiwiRXJyb3IiLCJfZ2V0VGFyZ2V0Q29vcmRzIiwid2hlZWxEZWx0YSIsInR5cGUiLCJkZWx0YVkiLCJkeCIsIm1vdmVtZW50WCIsIndlYmtpdE1vdmVtZW50WCIsIm1vek1vdmVtZW50WCIsImR5IiwibW92ZW1lbnRZIiwid2Via2l0TW92ZW1lbnRZIiwibW96TW92ZW1lbnRZIiwiX2xhc3RYIiwiX2xhc3RZIiwiYnV0dG9uIiwiTU9VU0VCVVRUT05fTk9ORSIsImJ1dHRvbnMiLCJfYnV0dG9ucyIsInNsaWNlIiwiZWxlbWVudCIsInRhcmdldCIsImN0cmxLZXkiLCJhbHRLZXkiLCJzaGlmdEtleSIsIm1ldGFLZXkiXSwibWFwcGluZ3MiOiI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Esb0JBQW9CQSxHQUFHO0FBQzVCLEVBQUEsT0FBTyxDQUFD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
