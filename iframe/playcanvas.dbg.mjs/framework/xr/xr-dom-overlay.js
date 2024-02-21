import { platform } from '../../core/platform.js';

/**
 * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
 * requires that the root DOM element is provided for session start. That way, input source select
 * events are first tested against DOM Elements and then propagated down to the XR Session. If this
 * propagation is not desirable, use the `beforexrselect` event on a DOM element and the
 * `preventDefault` function to stop propagation.
 *
 * ```javascript
 * app.xr.domOverlay.root = element;
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
 * ```
 *
 * ```javascript
 * // Disable input source firing `select` event when some descendant element of DOM overlay root
 * // is touched/clicked. This is useful when the user interacts with UI elements and there should
 * // not be `select` events behind UI.
 * someElement.addEventListener('beforexrselect', function (evt) {
 *     evt.preventDefault();
 * });
 * ```
 *
 * @category XR
 */
class XrDomOverlay {
  /**
   * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
   * requires that the root DOM element is provided for session start. That way, input source
   * select events are first tested against DOM Elements and then propagated down to the XR
   * Session. If this propagation is not desirable, use the `beforexrselect` event on a DOM
   * element and the `preventDefault` function to stop propagation.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!window.XRDOMOverlayState;
    /**
     * @type {Element|null}
     * @private
     */
    this._root = null;
    this._manager = manager;
  }

  /**
   * True if DOM Overlay is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if DOM Overlay is available. This information becomes available only when the session has
   * started and a valid root DOM element has been provided.
   *
   * @type {boolean}
   */
  get available() {
    return this._supported && this._manager.active && this._manager._session.domOverlayState !== null;
  }

  /**
   * State of the DOM Overlay, which defines how the root DOM element is rendered. Possible
   * options:
   *
   * - screen - indicates that the DOM element is covering whole physical screen,
   * matching XR viewports.
   * - floating - indicates that the underlying platform renders the DOM element as
   * floating in space, which can move during the WebXR session or allow the application to move
   * the element.
   * - head-locked - indicates that the DOM element follows the user's head movement
   * consistently, appearing similar to a helmet heads-up display.
   *
   * @type {string|null}
   */
  get state() {
    if (!this._supported || !this._manager.active || !this._manager._session.domOverlayState) return null;
    return this._manager._session.domOverlayState.type;
  }

  /**
   * The DOM element to be used as the root for DOM Overlay. Can be changed only when XR session
   * is not running.
   *
   * @type {Element|null}
   * @example
   * app.xr.domOverlay.root = element;
   * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
   */
  set root(value) {
    if (!this._supported || this._manager.active) return;
    this._root = value;
  }
  get root() {
    return this._root;
  }
}

export { XrDomOverlay };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItZG9tLW92ZXJsYXkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItZG9tLW92ZXJsYXkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuLyoqXG4gKiBET00gT3ZlcmxheSBwcm92aWRlcyB0aGUgYWJpbGl0eSB0byB1c2UgRE9NIGVsZW1lbnRzIGFzIGFuIG92ZXJsYXkgaW4gYSBXZWJYUiBBUiBzZXNzaW9uLiBJdFxuICogcmVxdWlyZXMgdGhhdCB0aGUgcm9vdCBET00gZWxlbWVudCBpcyBwcm92aWRlZCBmb3Igc2Vzc2lvbiBzdGFydC4gVGhhdCB3YXksIGlucHV0IHNvdXJjZSBzZWxlY3RcbiAqIGV2ZW50cyBhcmUgZmlyc3QgdGVzdGVkIGFnYWluc3QgRE9NIEVsZW1lbnRzIGFuZCB0aGVuIHByb3BhZ2F0ZWQgZG93biB0byB0aGUgWFIgU2Vzc2lvbi4gSWYgdGhpc1xuICogcHJvcGFnYXRpb24gaXMgbm90IGRlc2lyYWJsZSwgdXNlIHRoZSBgYmVmb3JleHJzZWxlY3RgIGV2ZW50IG9uIGEgRE9NIGVsZW1lbnQgYW5kIHRoZVxuICogYHByZXZlbnREZWZhdWx0YCBmdW5jdGlvbiB0byBzdG9wIHByb3BhZ2F0aW9uLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGFwcC54ci5kb21PdmVybGF5LnJvb3QgPSBlbGVtZW50O1xuICogYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRGlzYWJsZSBpbnB1dCBzb3VyY2UgZmlyaW5nIGBzZWxlY3RgIGV2ZW50IHdoZW4gc29tZSBkZXNjZW5kYW50IGVsZW1lbnQgb2YgRE9NIG92ZXJsYXkgcm9vdFxuICogLy8gaXMgdG91Y2hlZC9jbGlja2VkLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIHRoZSB1c2VyIGludGVyYWN0cyB3aXRoIFVJIGVsZW1lbnRzIGFuZCB0aGVyZSBzaG91bGRcbiAqIC8vIG5vdCBiZSBgc2VsZWN0YCBldmVudHMgYmVoaW5kIFVJLlxuICogc29tZUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JleHJzZWxlY3QnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gKiAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBjYXRlZ29yeSBYUlxuICovXG5jbGFzcyBYckRvbU92ZXJsYXkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5YUkRPTU92ZXJsYXlTdGF0ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm9vdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBET00gT3ZlcmxheSBwcm92aWRlcyB0aGUgYWJpbGl0eSB0byB1c2UgRE9NIGVsZW1lbnRzIGFzIGFuIG92ZXJsYXkgaW4gYSBXZWJYUiBBUiBzZXNzaW9uLiBJdFxuICAgICAqIHJlcXVpcmVzIHRoYXQgdGhlIHJvb3QgRE9NIGVsZW1lbnQgaXMgcHJvdmlkZWQgZm9yIHNlc3Npb24gc3RhcnQuIFRoYXQgd2F5LCBpbnB1dCBzb3VyY2VcbiAgICAgKiBzZWxlY3QgZXZlbnRzIGFyZSBmaXJzdCB0ZXN0ZWQgYWdhaW5zdCBET00gRWxlbWVudHMgYW5kIHRoZW4gcHJvcGFnYXRlZCBkb3duIHRvIHRoZSBYUlxuICAgICAqIFNlc3Npb24uIElmIHRoaXMgcHJvcGFnYXRpb24gaXMgbm90IGRlc2lyYWJsZSwgdXNlIHRoZSBgYmVmb3JleHJzZWxlY3RgIGV2ZW50IG9uIGEgRE9NXG4gICAgICogZWxlbWVudCBhbmQgdGhlIGBwcmV2ZW50RGVmYXVsdGAgZnVuY3Rpb24gdG8gc3RvcCBwcm9wYWdhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgRE9NIE92ZXJsYXkgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIERPTSBPdmVybGF5IGlzIGF2YWlsYWJsZS4gVGhpcyBpbmZvcm1hdGlvbiBiZWNvbWVzIGF2YWlsYWJsZSBvbmx5IHdoZW4gdGhlIHNlc3Npb24gaGFzXG4gICAgICogc3RhcnRlZCBhbmQgYSB2YWxpZCByb290IERPTSBlbGVtZW50IGhhcyBiZWVuIHByb3ZpZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGF2YWlsYWJsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZCAmJiB0aGlzLl9tYW5hZ2VyLmFjdGl2ZSAmJiB0aGlzLl9tYW5hZ2VyLl9zZXNzaW9uLmRvbU92ZXJsYXlTdGF0ZSAhPT0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGF0ZSBvZiB0aGUgRE9NIE92ZXJsYXksIHdoaWNoIGRlZmluZXMgaG93IHRoZSByb290IERPTSBlbGVtZW50IGlzIHJlbmRlcmVkLiBQb3NzaWJsZVxuICAgICAqIG9wdGlvbnM6XG4gICAgICpcbiAgICAgKiAtIHNjcmVlbiAtIGluZGljYXRlcyB0aGF0IHRoZSBET00gZWxlbWVudCBpcyBjb3ZlcmluZyB3aG9sZSBwaHlzaWNhbCBzY3JlZW4sXG4gICAgICogbWF0Y2hpbmcgWFIgdmlld3BvcnRzLlxuICAgICAqIC0gZmxvYXRpbmcgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybSByZW5kZXJzIHRoZSBET00gZWxlbWVudCBhc1xuICAgICAqIGZsb2F0aW5nIGluIHNwYWNlLCB3aGljaCBjYW4gbW92ZSBkdXJpbmcgdGhlIFdlYlhSIHNlc3Npb24gb3IgYWxsb3cgdGhlIGFwcGxpY2F0aW9uIHRvIG1vdmVcbiAgICAgKiB0aGUgZWxlbWVudC5cbiAgICAgKiAtIGhlYWQtbG9ja2VkIC0gaW5kaWNhdGVzIHRoYXQgdGhlIERPTSBlbGVtZW50IGZvbGxvd3MgdGhlIHVzZXIncyBoZWFkIG1vdmVtZW50XG4gICAgICogY29uc2lzdGVudGx5LCBhcHBlYXJpbmcgc2ltaWxhciB0byBhIGhlbG1ldCBoZWFkcy11cCBkaXNwbGF5LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCBzdGF0ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQgfHwgIXRoaXMuX21hbmFnZXIuYWN0aXZlIHx8ICF0aGlzLl9tYW5hZ2VyLl9zZXNzaW9uLmRvbU92ZXJsYXlTdGF0ZSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9tYW5hZ2VyLl9zZXNzaW9uLmRvbU92ZXJsYXlTdGF0ZS50eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBET00gZWxlbWVudCB0byBiZSB1c2VkIGFzIHRoZSByb290IGZvciBET00gT3ZlcmxheS4gQ2FuIGJlIGNoYW5nZWQgb25seSB3aGVuIFhSIHNlc3Npb25cbiAgICAgKiBpcyBub3QgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fG51bGx9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuZG9tT3ZlcmxheS5yb290ID0gZWxlbWVudDtcbiAgICAgKiBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfQVIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUik7XG4gICAgICovXG4gICAgc2V0IHJvb3QodmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQgfHwgdGhpcy5fbWFuYWdlci5hY3RpdmUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcm9vdCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCByb290KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9vdDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyRG9tT3ZlcmxheSB9O1xuIl0sIm5hbWVzIjpbIlhyRG9tT3ZlcmxheSIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSRE9NT3ZlcmxheVN0YXRlIiwiX3Jvb3QiLCJzdXBwb3J0ZWQiLCJhdmFpbGFibGUiLCJhY3RpdmUiLCJfc2Vzc2lvbiIsImRvbU92ZXJsYXlTdGF0ZSIsInN0YXRlIiwidHlwZSIsInJvb3QiLCJ2YWx1ZSJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0FBbUJmO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtBQTVCckI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxVQUFVLEdBQUdDLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJLENBQUMsQ0FBQ0MsTUFBTSxDQUFDQyxpQkFBaUIsQ0FBQTtBQUUzRDtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFhUixJQUFJLENBQUNOLFFBQVEsR0FBR0QsT0FBTyxDQUFBO0FBQzNCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlRLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQ04sVUFBVSxDQUFBO0FBQzFCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSU8sU0FBU0EsR0FBRztBQUNaLElBQUEsT0FBTyxJQUFJLENBQUNQLFVBQVUsSUFBSSxJQUFJLENBQUNELFFBQVEsQ0FBQ1MsTUFBTSxJQUFJLElBQUksQ0FBQ1QsUUFBUSxDQUFDVSxRQUFRLENBQUNDLGVBQWUsS0FBSyxJQUFJLENBQUE7QUFDckcsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsS0FBS0EsR0FBRztJQUNSLElBQUksQ0FBQyxJQUFJLENBQUNYLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQ0QsUUFBUSxDQUFDUyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUNULFFBQVEsQ0FBQ1UsUUFBUSxDQUFDQyxlQUFlLEVBQ3BGLE9BQU8sSUFBSSxDQUFBO0lBRWYsT0FBTyxJQUFJLENBQUNYLFFBQVEsQ0FBQ1UsUUFBUSxDQUFDQyxlQUFlLENBQUNFLElBQUksQ0FBQTtBQUN0RCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlDLElBQUlBLENBQUNDLEtBQUssRUFBRTtJQUNaLElBQUksQ0FBQyxJQUFJLENBQUNkLFVBQVUsSUFBSSxJQUFJLENBQUNELFFBQVEsQ0FBQ1MsTUFBTSxFQUN4QyxPQUFBO0lBRUosSUFBSSxDQUFDSCxLQUFLLEdBQUdTLEtBQUssQ0FBQTtBQUN0QixHQUFBO0VBRUEsSUFBSUQsSUFBSUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDUixLQUFLLENBQUE7QUFDckIsR0FBQTtBQUNKOzs7OyJ9
