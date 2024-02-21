import { Debug } from './debug.js';

/**
 * Event Handle that is created by {@link EventHandler} and can be used for easier event removal and management.
 * @example
 * const evt = obj.on('test', (a, b) => {
 *     console.log(a + b);
 * });
 * obj.fire('test');
 *
 * evt.off(); // easy way to remove this event
 * obj.fire('test'); // this will not trigger an event
 * @example
 * // store an array of event handles
 * let events = [ ];
 *
 * events.push(objA.on('testA', () => { }));
 * events.push(objB.on('testB', () => { }));
 *
 * // when needed, remove all events
 * events.forEach((evt) => {
 *     evt.off();
 * });
 * events = [ ];
 */
class EventHandle {
  /**
   * @param {import('./event-handler.js').EventHandler} handler - source object of the event.
   * @param {string} name - Name of the event.
   * @param {import('./event-handler.js').HandleEventCallback} callback - Function that is called when event is fired.
   * @param {object} scope - Object that is used as `this` when event is fired.
   * @param {boolean} [once] - If this is a single event and will be removed after event is fired.
   */
  constructor(handler, name, callback, scope, once = false) {
    /**
     * @type {import('./event-handler.js').EventHandler}
     * @private
     */
    this.handler = void 0;
    /**
     * @type {string}
     * @private
     */
    this.name = void 0;
    /**
     * @type {import('./event-handler.js').HandleEventCallback}
     * @ignore
     */
    this.callback = void 0;
    /**
     * @type {object}
     * @ignore
     */
    this.scope = void 0;
    /**
     * @type {boolean}
     * @ignore
     */
    this._once = void 0;
    /**
     * True if event has been removed.
     * @type {boolean}
     * @private
     */
    this._removed = false;
    this.handler = handler;
    this.name = name;
    this.callback = callback;
    this.scope = scope;
    this._once = once;
  }

  /**
   * Remove this event from its handler.
   */
  off() {
    if (this._removed) return;
    this.handler.off(this.name, this.callback, this.scope);
  }
  on(name, callback, scope = this) {
    Debug.deprecated('Using chaining with EventHandler.on is deprecated, subscribe to an event from EventHandler directly instead.');
    return this.handler._addCallback(name, callback, scope, false);
  }
  once(name, callback, scope = this) {
    Debug.deprecated('Using chaining with EventHandler.once is deprecated, subscribe to an event from EventHandler directly instead.');
    return this.handler._addCallback(name, callback, scope, true);
  }

  /**
   * Mark if event has been removed.
   * @type {boolean}
   * @internal
   */
  set removed(value) {
    if (!value) return;
    this._removed = true;
  }

  /**
   * True if event has been removed.
   * @type {boolean}
   */
  get removed() {
    return this._removed;
  }
}

export { EventHandle };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtaGFuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvY29yZS9ldmVudC1oYW5kbGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuLyoqXG4gKiBFdmVudCBIYW5kbGUgdGhhdCBpcyBjcmVhdGVkIGJ5IHtAbGluayBFdmVudEhhbmRsZXJ9IGFuZCBjYW4gYmUgdXNlZCBmb3IgZWFzaWVyIGV2ZW50IHJlbW92YWwgYW5kIG1hbmFnZW1lbnQuXG4gKiBAZXhhbXBsZVxuICogY29uc3QgZXZ0ID0gb2JqLm9uKCd0ZXN0JywgKGEsIGIpID0+IHtcbiAqICAgICBjb25zb2xlLmxvZyhhICsgYik7XG4gKiB9KTtcbiAqIG9iai5maXJlKCd0ZXN0Jyk7XG4gKlxuICogZXZ0Lm9mZigpOyAvLyBlYXN5IHdheSB0byByZW1vdmUgdGhpcyBldmVudFxuICogb2JqLmZpcmUoJ3Rlc3QnKTsgLy8gdGhpcyB3aWxsIG5vdCB0cmlnZ2VyIGFuIGV2ZW50XG4gKiBAZXhhbXBsZVxuICogLy8gc3RvcmUgYW4gYXJyYXkgb2YgZXZlbnQgaGFuZGxlc1xuICogbGV0IGV2ZW50cyA9IFsgXTtcbiAqXG4gKiBldmVudHMucHVzaChvYmpBLm9uKCd0ZXN0QScsICgpID0+IHsgfSkpO1xuICogZXZlbnRzLnB1c2gob2JqQi5vbigndGVzdEInLCAoKSA9PiB7IH0pKTtcbiAqXG4gKiAvLyB3aGVuIG5lZWRlZCwgcmVtb3ZlIGFsbCBldmVudHNcbiAqIGV2ZW50cy5mb3JFYWNoKChldnQpID0+IHtcbiAqICAgICBldnQub2ZmKCk7XG4gKiB9KTtcbiAqIGV2ZW50cyA9IFsgXTtcbiAqL1xuY2xhc3MgRXZlbnRIYW5kbGUge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZXZlbnQtaGFuZGxlci5qcycpLkV2ZW50SGFuZGxlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGhhbmRsZXI7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbmFtZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZXZlbnQtaGFuZGxlci5qcycpLkhhbmRsZUV2ZW50Q2FsbGJhY2t9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNhbGxiYWNrO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2NvcGU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX29uY2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGV2ZW50IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVtb3ZlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZXZlbnQtaGFuZGxlci5qcycpLkV2ZW50SGFuZGxlcn0gaGFuZGxlciAtIHNvdXJjZSBvYmplY3Qgb2YgdGhlIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZXZlbnQtaGFuZGxlci5qcycpLkhhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2NvcGUgLSBPYmplY3QgdGhhdCBpcyB1c2VkIGFzIGB0aGlzYCB3aGVuIGV2ZW50IGlzIGZpcmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29uY2VdIC0gSWYgdGhpcyBpcyBhIHNpbmdsZSBldmVudCBhbmQgd2lsbCBiZSByZW1vdmVkIGFmdGVyIGV2ZW50IGlzIGZpcmVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGhhbmRsZXIsIG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgb25jZSA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAgICAgdGhpcy5zY29wZSA9IHNjb3BlO1xuICAgICAgICB0aGlzLl9vbmNlID0gb25jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhpcyBldmVudCBmcm9tIGl0cyBoYW5kbGVyLlxuICAgICAqL1xuICAgIG9mZigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbW92ZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5oYW5kbGVyLm9mZih0aGlzLm5hbWUsIHRoaXMuY2FsbGJhY2ssIHRoaXMuc2NvcGUpO1xuICAgIH1cblxuICAgIG9uKG5hbWUsIGNhbGxiYWNrLCBzY29wZSA9IHRoaXMpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgnVXNpbmcgY2hhaW5pbmcgd2l0aCBFdmVudEhhbmRsZXIub24gaXMgZGVwcmVjYXRlZCwgc3Vic2NyaWJlIHRvIGFuIGV2ZW50IGZyb20gRXZlbnRIYW5kbGVyIGRpcmVjdGx5IGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmhhbmRsZXIuX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIG9uY2UobmFtZSwgY2FsbGJhY2ssIHNjb3BlID0gdGhpcykge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdVc2luZyBjaGFpbmluZyB3aXRoIEV2ZW50SGFuZGxlci5vbmNlIGlzIGRlcHJlY2F0ZWQsIHN1YnNjcmliZSB0byBhbiBldmVudCBmcm9tIEV2ZW50SGFuZGxlciBkaXJlY3RseSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVyLl9hZGRDYWxsYmFjayhuYW1lLCBjYWxsYmFjaywgc2NvcGUsIHRydWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgaWYgZXZlbnQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKi9cbiAgICBzZXQgcmVtb3ZlZCh2YWx1ZSkge1xuICAgICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX3JlbW92ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgZXZlbnQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgcmVtb3ZlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZWQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBFdmVudEhhbmRsZSB9O1xuIl0sIm5hbWVzIjpbIkV2ZW50SGFuZGxlIiwiY29uc3RydWN0b3IiLCJoYW5kbGVyIiwibmFtZSIsImNhbGxiYWNrIiwic2NvcGUiLCJvbmNlIiwiX29uY2UiLCJfcmVtb3ZlZCIsIm9mZiIsIm9uIiwiRGVidWciLCJkZXByZWNhdGVkIiwiX2FkZENhbGxiYWNrIiwicmVtb3ZlZCIsInZhbHVlIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxXQUFXLENBQUM7QUFzQ2Q7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsS0FBSyxFQUFFO0FBNUMxRDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBSixPQUFPLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFSjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBRSxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsUUFBUSxHQUFHLEtBQUssQ0FBQTtJQVVaLElBQUksQ0FBQ04sT0FBTyxHQUFHQSxPQUFPLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxJQUFJLEdBQUdBLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7SUFDbEIsSUFBSSxDQUFDRSxLQUFLLEdBQUdELElBQUksQ0FBQTtBQUNyQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJRyxFQUFBQSxHQUFHQSxHQUFHO0lBQ0YsSUFBSSxJQUFJLENBQUNELFFBQVEsRUFBRSxPQUFBO0FBQ25CLElBQUEsSUFBSSxDQUFDTixPQUFPLENBQUNPLEdBQUcsQ0FBQyxJQUFJLENBQUNOLElBQUksRUFBRSxJQUFJLENBQUNDLFFBQVEsRUFBRSxJQUFJLENBQUNDLEtBQUssQ0FBQyxDQUFBO0FBQzFELEdBQUE7RUFFQUssRUFBRUEsQ0FBQ1AsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLEtBQUssR0FBRyxJQUFJLEVBQUU7QUFDN0JNLElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLDhHQUE4RyxDQUFDLENBQUE7QUFDaEksSUFBQSxPQUFPLElBQUksQ0FBQ1YsT0FBTyxDQUFDVyxZQUFZLENBQUNWLElBQUksRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUE7QUFDbEUsR0FBQTtFQUVBQyxJQUFJQSxDQUFDSCxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxHQUFHLElBQUksRUFBRTtBQUMvQk0sSUFBQUEsS0FBSyxDQUFDQyxVQUFVLENBQUMsZ0hBQWdILENBQUMsQ0FBQTtBQUNsSSxJQUFBLE9BQU8sSUFBSSxDQUFDVixPQUFPLENBQUNXLFlBQVksQ0FBQ1YsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNqRSxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJUyxPQUFPQSxDQUFDQyxLQUFLLEVBQUU7SUFDZixJQUFJLENBQUNBLEtBQUssRUFBRSxPQUFBO0lBQ1osSUFBSSxDQUFDUCxRQUFRLEdBQUcsSUFBSSxDQUFBO0FBQ3hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSSxJQUFJTSxPQUFPQSxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUNOLFFBQVEsQ0FBQTtBQUN4QixHQUFBO0FBQ0o7Ozs7In0=
