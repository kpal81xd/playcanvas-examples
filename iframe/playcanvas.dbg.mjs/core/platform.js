// detect whether passive events are supported by the browser
const detectPassiveEvents = () => {
  let result = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function () {
        result = true;
        return false;
      }
    });
    window.addEventListener('testpassive', null, opts);
    window.removeEventListener('testpassive', null, opts);
  } catch (e) {}
  return result;
};
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const environment = typeof window !== 'undefined' ? 'browser' : 'node';

// detect platform
const platformName = /android/i.test(ua) ? 'android' : /ip([ao]d|hone)/i.test(ua) ? 'ios' : /windows/i.test(ua) ? 'windows' : /mac os/i.test(ua) ? 'osx' : /linux/i.test(ua) ? 'linux' : /cros/i.test(ua) ? 'cros' : null;

// detect browser
const browserName = environment !== 'browser' ? null : /(Chrome\/|Chromium\/|Edg.*\/)/.test(ua) ? 'chrome' :
// chrome, chromium, edge
/Safari\//.test(ua) ? 'safari' :
// safari, ios chrome/firefox
/Firefox\//.test(ua) ? 'firefox' : 'other';
const xbox = /xbox/i.test(ua);
const touch = environment === 'browser' && ('ontouchstart' in window || 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
const gamepads = environment === 'browser' && (!!navigator.getGamepads || !!navigator.webkitGetGamepads);
const workers = typeof Worker !== 'undefined';
const passiveEvents = detectPassiveEvents();

/**
 * Global namespace that stores flags regarding platform environment and features support.
 *
 * @namespace
 * @example
 * if (pc.platform.touch) {
 *     // touch is supported
 * }
 */
const platform = {
  /**
   * String identifying the current platform. Can be one of: android, ios, windows, osx, linux,
   * cros or null.
   *
   * @type {'android' | 'ios' | 'windows' | 'osx' | 'linux' | 'cros' | null}
   * @ignore
   */
  name: platformName,
  /**
   * String identifying the current runtime environment. Either 'browser' or 'node'.
   *
   * @type {'browser' | 'node'}
   */
  environment: environment,
  /**
   * The global object. This will be the window object when running in a browser and the global
   * object when running in nodejs.
   *
   * @type {object}
   */
  global: environment === 'browser' ? window : global,
  /**
   * Convenience boolean indicating whether we're running in the browser.
   *
   * @type {boolean}
   */
  browser: environment === 'browser',
  /**
   * True if running on a desktop or laptop device.
   *
   * @type {boolean}
   */
  desktop: ['windows', 'osx', 'linux', 'cros'].includes(platformName),
  /**
   * True if running on a mobile or tablet device.
   *
   * @type {boolean}
   */
  mobile: ['android', 'ios'].includes(platformName),
  /**
   * True if running on an iOS device.
   *
   * @type {boolean}
   */
  ios: platformName === 'ios',
  /**
   * True if running on an Android device.
   *
   * @type {boolean}
   */
  android: platformName === 'android',
  /**
   * True if running on an Xbox device.
   *
   * @type {boolean}
   */
  xbox: xbox,
  /**
   * True if the platform supports gamepads.
   *
   * @type {boolean}
   */
  gamepads: gamepads,
  /**
   * True if the supports touch input.
   *
   * @type {boolean}
   */
  touch: touch,
  /**
   * True if the platform supports Web Workers.
   *
   * @type {boolean}
   */
  workers: workers,
  /**
   * True if the platform supports an options object as the third parameter to
   * `EventTarget.addEventListener()` and the passive property is supported.
   *
   * @type {boolean}
   * @ignore
   */
  passiveEvents: passiveEvents,
  /**
   * Get the browser name.
   *
   * @type {'chrome' | 'safari' | 'firefox' | 'other' | null}
   * @ignore
   */
  browserName: browserName
};

export { platform };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhdGZvcm0uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9jb3JlL3BsYXRmb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGRldGVjdCB3aGV0aGVyIHBhc3NpdmUgZXZlbnRzIGFyZSBzdXBwb3J0ZWQgYnkgdGhlIGJyb3dzZXJcbmNvbnN0IGRldGVjdFBhc3NpdmVFdmVudHMgPSAoKSA9PiB7XG4gICAgbGV0IHJlc3VsdCA9IGZhbHNlO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb3B0cyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh7fSwgJ3Bhc3NpdmUnLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd0ZXN0cGFzc2l2ZScsIG51bGwsIG9wdHMpO1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGVzdHBhc3NpdmUnLCBudWxsLCBvcHRzKTtcbiAgICB9IGNhdGNoIChlKSB7fVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmNvbnN0IHVhID0gKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKSA/IG5hdmlnYXRvci51c2VyQWdlbnQgOiAnJztcbmNvbnN0IGVudmlyb25tZW50ID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/ICdicm93c2VyJyA6ICdub2RlJztcblxuLy8gZGV0ZWN0IHBsYXRmb3JtXG5jb25zdCBwbGF0Zm9ybU5hbWUgPVxuICAgICgvYW5kcm9pZC9pLnRlc3QodWEpID8gJ2FuZHJvaWQnIDpcbiAgICAgICAgKC9pcChbYW9dZHxob25lKS9pLnRlc3QodWEpID8gJ2lvcycgOlxuICAgICAgICAgICAgKC93aW5kb3dzL2kudGVzdCh1YSkgPyAnd2luZG93cycgOlxuICAgICAgICAgICAgICAgICgvbWFjIG9zL2kudGVzdCh1YSkgPyAnb3N4JyA6XG4gICAgICAgICAgICAgICAgICAgICgvbGludXgvaS50ZXN0KHVhKSA/ICdsaW51eCcgOlxuICAgICAgICAgICAgICAgICAgICAgICAgKC9jcm9zL2kudGVzdCh1YSkgPyAnY3JvcycgOiBudWxsKSkpKSkpO1xuXG4vLyBkZXRlY3QgYnJvd3NlclxuY29uc3QgYnJvd3Nlck5hbWUgPVxuICAgIChlbnZpcm9ubWVudCAhPT0gJ2Jyb3dzZXInKSA/IG51bGwgOlxuICAgICAgICAoLyhDaHJvbWVcXC98Q2hyb21pdW1cXC98RWRnLipcXC8pLy50ZXN0KHVhKSA/ICdjaHJvbWUnIDogIC8vIGNocm9tZSwgY2hyb21pdW0sIGVkZ2VcbiAgICAgICAgICAgICgvU2FmYXJpXFwvLy50ZXN0KHVhKSA/ICdzYWZhcmknIDogICAgICAgICAgICAgICAgICAgLy8gc2FmYXJpLCBpb3MgY2hyb21lL2ZpcmVmb3hcbiAgICAgICAgICAgICAgICAoL0ZpcmVmb3hcXC8vLnRlc3QodWEpID8gJ2ZpcmVmb3gnIDpcbiAgICAgICAgICAgICAgICAgICAgJ290aGVyJykpKTtcblxuY29uc3QgeGJveCA9IC94Ym94L2kudGVzdCh1YSk7XG5jb25zdCB0b3VjaCA9IChlbnZpcm9ubWVudCA9PT0gJ2Jyb3dzZXInKSAmJiAoJ29udG91Y2hzdGFydCcgaW4gd2luZG93IHx8ICgnbWF4VG91Y2hQb2ludHMnIGluIG5hdmlnYXRvciAmJiBuYXZpZ2F0b3IubWF4VG91Y2hQb2ludHMgPiAwKSk7XG5jb25zdCBnYW1lcGFkcyA9IChlbnZpcm9ubWVudCA9PT0gJ2Jyb3dzZXInKSAmJiAoISFuYXZpZ2F0b3IuZ2V0R2FtZXBhZHMgfHwgISFuYXZpZ2F0b3Iud2Via2l0R2V0R2FtZXBhZHMpO1xuY29uc3Qgd29ya2VycyA9ICh0eXBlb2YgV29ya2VyICE9PSAndW5kZWZpbmVkJyk7XG5jb25zdCBwYXNzaXZlRXZlbnRzID0gZGV0ZWN0UGFzc2l2ZUV2ZW50cygpO1xuXG4vKipcbiAqIEdsb2JhbCBuYW1lc3BhY2UgdGhhdCBzdG9yZXMgZmxhZ3MgcmVnYXJkaW5nIHBsYXRmb3JtIGVudmlyb25tZW50IGFuZCBmZWF0dXJlcyBzdXBwb3J0LlxuICpcbiAqIEBuYW1lc3BhY2VcbiAqIEBleGFtcGxlXG4gKiBpZiAocGMucGxhdGZvcm0udG91Y2gpIHtcbiAqICAgICAvLyB0b3VjaCBpcyBzdXBwb3J0ZWRcbiAqIH1cbiAqL1xuY29uc3QgcGxhdGZvcm0gPSB7XG4gICAgLyoqXG4gICAgICogU3RyaW5nIGlkZW50aWZ5aW5nIHRoZSBjdXJyZW50IHBsYXRmb3JtLiBDYW4gYmUgb25lIG9mOiBhbmRyb2lkLCBpb3MsIHdpbmRvd3MsIG9zeCwgbGludXgsXG4gICAgICogY3JvcyBvciBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUgeydhbmRyb2lkJyB8ICdpb3MnIHwgJ3dpbmRvd3MnIHwgJ29zeCcgfCAnbGludXgnIHwgJ2Nyb3MnIHwgbnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbmFtZTogcGxhdGZvcm1OYW1lLFxuXG4gICAgLyoqXG4gICAgICogU3RyaW5nIGlkZW50aWZ5aW5nIHRoZSBjdXJyZW50IHJ1bnRpbWUgZW52aXJvbm1lbnQuIEVpdGhlciAnYnJvd3Nlcicgb3IgJ25vZGUnLlxuICAgICAqXG4gICAgICogQHR5cGUgeydicm93c2VyJyB8ICdub2RlJ31cbiAgICAgKi9cbiAgICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ2xvYmFsIG9iamVjdC4gVGhpcyB3aWxsIGJlIHRoZSB3aW5kb3cgb2JqZWN0IHdoZW4gcnVubmluZyBpbiBhIGJyb3dzZXIgYW5kIHRoZSBnbG9iYWxcbiAgICAgKiBvYmplY3Qgd2hlbiBydW5uaW5nIGluIG5vZGVqcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgZ2xvYmFsOiAoZW52aXJvbm1lbnQgPT09ICdicm93c2VyJykgPyB3aW5kb3cgOiBnbG9iYWwsXG5cbiAgICAvKipcbiAgICAgKiBDb252ZW5pZW5jZSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB3ZSdyZSBydW5uaW5nIGluIHRoZSBicm93c2VyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgYnJvd3NlcjogZW52aXJvbm1lbnQgPT09ICdicm93c2VyJyxcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgcnVubmluZyBvbiBhIGRlc2t0b3Agb3IgbGFwdG9wIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGRlc2t0b3A6IFsnd2luZG93cycsICdvc3gnLCAnbGludXgnLCAnY3JvcyddLmluY2x1ZGVzKHBsYXRmb3JtTmFtZSksXG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHJ1bm5pbmcgb24gYSBtb2JpbGUgb3IgdGFibGV0IGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG1vYmlsZTogWydhbmRyb2lkJywgJ2lvcyddLmluY2x1ZGVzKHBsYXRmb3JtTmFtZSksXG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHJ1bm5pbmcgb24gYW4gaU9TIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGlvczogcGxhdGZvcm1OYW1lID09PSAnaW9zJyxcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgcnVubmluZyBvbiBhbiBBbmRyb2lkIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFuZHJvaWQ6IHBsYXRmb3JtTmFtZSA9PT0gJ2FuZHJvaWQnLFxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBydW5uaW5nIG9uIGFuIFhib3ggZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgeGJveDogeGJveCxcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHBsYXRmb3JtIHN1cHBvcnRzIGdhbWVwYWRzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2FtZXBhZHM6IGdhbWVwYWRzLFxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgc3VwcG9ydHMgdG91Y2ggaW5wdXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0b3VjaDogdG91Y2gsXG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBwbGF0Zm9ybSBzdXBwb3J0cyBXZWIgV29ya2Vycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHdvcmtlcnM6IHdvcmtlcnMsXG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBwbGF0Zm9ybSBzdXBwb3J0cyBhbiBvcHRpb25zIG9iamVjdCBhcyB0aGUgdGhpcmQgcGFyYW1ldGVyIHRvXG4gICAgICogYEV2ZW50VGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoKWAgYW5kIHRoZSBwYXNzaXZlIHByb3BlcnR5IGlzIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBwYXNzaXZlRXZlbnRzOiBwYXNzaXZlRXZlbnRzLFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBicm93c2VyIG5hbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7J2Nocm9tZScgfCAnc2FmYXJpJyB8ICdmaXJlZm94JyB8ICdvdGhlcicgfCBudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBicm93c2VyTmFtZTogYnJvd3Nlck5hbWVcbn07XG5cbmV4cG9ydCB7IHBsYXRmb3JtIH07XG4iXSwibmFtZXMiOlsiZGV0ZWN0UGFzc2l2ZUV2ZW50cyIsInJlc3VsdCIsIm9wdHMiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZSIsInVhIiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiZW52aXJvbm1lbnQiLCJwbGF0Zm9ybU5hbWUiLCJ0ZXN0IiwiYnJvd3Nlck5hbWUiLCJ4Ym94IiwidG91Y2giLCJtYXhUb3VjaFBvaW50cyIsImdhbWVwYWRzIiwiZ2V0R2FtZXBhZHMiLCJ3ZWJraXRHZXRHYW1lcGFkcyIsIndvcmtlcnMiLCJXb3JrZXIiLCJwYXNzaXZlRXZlbnRzIiwicGxhdGZvcm0iLCJuYW1lIiwiZ2xvYmFsIiwiYnJvd3NlciIsImRlc2t0b3AiLCJpbmNsdWRlcyIsIm1vYmlsZSIsImlvcyIsImFuZHJvaWQiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0EsTUFBTUEsbUJBQW1CLEdBQUdBLE1BQU07RUFDOUIsSUFBSUMsTUFBTSxHQUFHLEtBQUssQ0FBQTtFQUVsQixJQUFJO0lBQ0EsTUFBTUMsSUFBSSxHQUFHQyxNQUFNLENBQUNDLGNBQWMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFO01BQzlDQyxHQUFHLEVBQUUsWUFBWTtBQUNiSixRQUFBQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ2IsUUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixPQUFBO0FBQ0osS0FBQyxDQUFDLENBQUE7SUFDRkssTUFBTSxDQUFDQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFTCxJQUFJLENBQUMsQ0FBQTtJQUNsREksTUFBTSxDQUFDRSxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFTixJQUFJLENBQUMsQ0FBQTtBQUN6RCxHQUFDLENBQUMsT0FBT08sQ0FBQyxFQUFFLEVBQUM7QUFFYixFQUFBLE9BQU9SLE1BQU0sQ0FBQTtBQUNqQixDQUFDLENBQUE7QUFFRCxNQUFNUyxFQUFFLEdBQUksT0FBT0MsU0FBUyxLQUFLLFdBQVcsR0FB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
