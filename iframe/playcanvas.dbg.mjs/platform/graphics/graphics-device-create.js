import { platform } from '../../core/platform.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, DEVICETYPE_NULL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';
import { NullGraphicsDevice } from './null/null-graphics-device.js';

/**
 * Creates a graphics device.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {object} options - Graphics device options.
 * @param {string[]} [options.deviceTypes] - An array of DEVICETYPE_*** constants, defining the
 * order in which the devices are attempted to get created. Defaults to an empty array. If the
 * specified array does not contain [{@link DEVICETYPE_WEBGL2} or {@link DEVICETYPE_WEBGL1}], those
 * are internally added to its end in this order. Typically, you'd only specify
 * {@link DEVICETYPE_WEBGPU}, or leave it empty.
 * @param {boolean} [options.antialias] - Boolean that indicates whether or not to perform
 * anti-aliasing if possible. Defaults to true.
 * @param {boolean} [options.depth] - Boolean that indicates that the drawing buffer is
 * requested to have a depth buffer of at least 16 bits. Defaults to true.
 * @param {boolean} [options.stencil] - Boolean that indicates that the drawing buffer is
 * requested to have a stencil buffer of at least 8 bits. Defaults to true.
 * @param {string} [options.glslangUrl] - The URL to the glslang script. Required if the
 * {@link DEVICETYPE_WEBGPU} type is added to deviceTypes array. Not used for
 * {@link DEVICETYPE_WEBGL1} or {@link DEVICETYPE_WEBGL2} device type creation.
 * @param {string} [options.twgslUrl] - An url to twgsl script, required if glslangUrl was specified.
 * @param {boolean} [options.xrCompatible] - Boolean that hints to the user agent to use a
 * compatible graphics adapter for an immersive XR device.
 * @param {'default'|'high-performance'|'low-power'} [options.powerPreference] - A hint indicating
 * what configuration of GPU would be selected. Possible values are:
 *
 * - 'default': Let the user agent decide which GPU configuration is most suitable. This is the
 * default value.
 * - 'high-performance': Prioritizes rendering performance over power consumption.
 * - 'low-power': Prioritizes power saving over rendering performance.
 *
 * Defaults to 'default'.
 * @returns {Promise} - Promise object representing the created graphics device.
 * @category Graphics
 */
function createGraphicsDevice(canvas, options = {}) {
  var _options$deviceTypes;
  const deviceTypes = (_options$deviceTypes = options.deviceTypes) != null ? _options$deviceTypes : [];

  // automatically added fallbacks
  if (!deviceTypes.includes(DEVICETYPE_WEBGL2)) {
    deviceTypes.push(DEVICETYPE_WEBGL2);
  }
  if (!deviceTypes.includes(DEVICETYPE_WEBGL1)) {
    deviceTypes.push(DEVICETYPE_WEBGL1);
  }
  if (!deviceTypes.includes(DEVICETYPE_NULL)) {
    deviceTypes.push(DEVICETYPE_NULL);
  }

  // XR compatibility if not specified
  if (platform.browser && !!navigator.xr) {
    var _options$xrCompatible;
    (_options$xrCompatible = options.xrCompatible) != null ? _options$xrCompatible : options.xrCompatible = true;
  }

  // make a list of device creation functions in priority order
  const deviceCreateFuncs = [];
  for (let i = 0; i < deviceTypes.length; i++) {
    var _window;
    const deviceType = deviceTypes[i];
    if (deviceType === DEVICETYPE_WEBGPU && (_window = window) != null && (_window = _window.navigator) != null && _window.gpu) {
      deviceCreateFuncs.push(() => {
        const device = new WebgpuGraphicsDevice(canvas, options);
        return device.initWebGpu(options.glslangUrl, options.twgslUrl);
      });
    }
    if (deviceType === DEVICETYPE_WEBGL1 || deviceType === DEVICETYPE_WEBGL2) {
      deviceCreateFuncs.push(() => {
        options.preferWebGl2 = deviceType === DEVICETYPE_WEBGL2;
        return new WebglGraphicsDevice(canvas, options);
      });
    }
    if (deviceType === DEVICETYPE_NULL) {
      deviceCreateFuncs.push(() => {
        return new NullGraphicsDevice(canvas, options);
      });
    }
  }

  // execute each device creation function returning the first successful result
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const next = () => {
      if (attempt >= deviceCreateFuncs.length) {
        reject(new Error('Failed to create a graphics device'));
      } else {
        Promise.resolve(deviceCreateFuncs[attempt++]()).then(device => {
          if (device) {
            resolve(device);
          } else {
            next();
          }
        }).catch(err => {
          console.log(err);
          next();
        });
      }
    };
    next();
  });
}

export { createGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLWNyZWF0ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1jcmVhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuaW1wb3J0IHsgREVWSUNFVFlQRV9XRUJHTDIsIERFVklDRVRZUEVfV0VCR0wxLCBERVZJQ0VUWVBFX1dFQkdQVSwgREVWSUNFVFlQRV9OVUxMIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgV2ViZ3B1R3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IFdlYmdsR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL3dlYmdsL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBOdWxsR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL251bGwvbnVsbC1ncmFwaGljcy1kZXZpY2UuanMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBncmFwaGljcyBkZXZpY2UuXG4gKlxuICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyBlbGVtZW50LlxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBHcmFwaGljcyBkZXZpY2Ugb3B0aW9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nW119IFtvcHRpb25zLmRldmljZVR5cGVzXSAtIEFuIGFycmF5IG9mIERFVklDRVRZUEVfKioqIGNvbnN0YW50cywgZGVmaW5pbmcgdGhlXG4gKiBvcmRlciBpbiB3aGljaCB0aGUgZGV2aWNlcyBhcmUgYXR0ZW1wdGVkIHRvIGdldCBjcmVhdGVkLiBEZWZhdWx0cyB0byBhbiBlbXB0eSBhcnJheS4gSWYgdGhlXG4gKiBzcGVjaWZpZWQgYXJyYXkgZG9lcyBub3QgY29udGFpbiBbe0BsaW5rIERFVklDRVRZUEVfV0VCR0wyfSBvciB7QGxpbmsgREVWSUNFVFlQRV9XRUJHTDF9XSwgdGhvc2VcbiAqIGFyZSBpbnRlcm5hbGx5IGFkZGVkIHRvIGl0cyBlbmQgaW4gdGhpcyBvcmRlci4gVHlwaWNhbGx5LCB5b3UnZCBvbmx5IHNwZWNpZnlcbiAqIHtAbGluayBERVZJQ0VUWVBFX1dFQkdQVX0sIG9yIGxlYXZlIGl0IGVtcHR5LlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbnRpYWxpYXNdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0byBwZXJmb3JtXG4gKiBhbnRpLWFsaWFzaW5nIGlmIHBvc3NpYmxlLiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXB0aF0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gKiByZXF1ZXN0ZWQgdG8gaGF2ZSBhIGRlcHRoIGJ1ZmZlciBvZiBhdCBsZWFzdCAxNiBiaXRzLiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zdGVuY2lsXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgZHJhd2luZyBidWZmZXIgaXNcbiAqIHJlcXVlc3RlZCB0byBoYXZlIGEgc3RlbmNpbCBidWZmZXIgb2YgYXQgbGVhc3QgOCBiaXRzLiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmdsc2xhbmdVcmxdIC0gVGhlIFVSTCB0byB0aGUgZ2xzbGFuZyBzY3JpcHQuIFJlcXVpcmVkIGlmIHRoZVxuICoge0BsaW5rIERFVklDRVRZUEVfV0VCR1BVfSB0eXBlIGlzIGFkZGVkIHRvIGRldmljZVR5cGVzIGFycmF5LiBOb3QgdXNlZCBmb3JcbiAqIHtAbGluayBERVZJQ0VUWVBFX1dFQkdMMX0gb3Ige0BsaW5rIERFVklDRVRZUEVfV0VCR0wyfSBkZXZpY2UgdHlwZSBjcmVhdGlvbi5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50d2dzbFVybF0gLSBBbiB1cmwgdG8gdHdnc2wgc2NyaXB0LCByZXF1aXJlZCBpZiBnbHNsYW5nVXJsIHdhcyBzcGVjaWZpZWQuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnhyQ29tcGF0aWJsZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdG8gdGhlIHVzZXIgYWdlbnQgdG8gdXNlIGFcbiAqIGNvbXBhdGlibGUgZ3JhcGhpY3MgYWRhcHRlciBmb3IgYW4gaW1tZXJzaXZlIFhSIGRldmljZS5cbiAqIEBwYXJhbSB7J2RlZmF1bHQnfCdoaWdoLXBlcmZvcm1hbmNlJ3wnbG93LXBvd2VyJ30gW29wdGlvbnMucG93ZXJQcmVmZXJlbmNlXSAtIEEgaGludCBpbmRpY2F0aW5nXG4gKiB3aGF0IGNvbmZpZ3VyYXRpb24gb2YgR1BVIHdvdWxkIGJlIHNlbGVjdGVkLiBQb3NzaWJsZSB2YWx1ZXMgYXJlOlxuICpcbiAqIC0gJ2RlZmF1bHQnOiBMZXQgdGhlIHVzZXIgYWdlbnQgZGVjaWRlIHdoaWNoIEdQVSBjb25maWd1cmF0aW9uIGlzIG1vc3Qgc3VpdGFibGUuIFRoaXMgaXMgdGhlXG4gKiBkZWZhdWx0IHZhbHVlLlxuICogLSAnaGlnaC1wZXJmb3JtYW5jZSc6IFByaW9yaXRpemVzIHJlbmRlcmluZyBwZXJmb3JtYW5jZSBvdmVyIHBvd2VyIGNvbnN1bXB0aW9uLlxuICogLSAnbG93LXBvd2VyJzogUHJpb3JpdGl6ZXMgcG93ZXIgc2F2aW5nIG92ZXIgcmVuZGVyaW5nIHBlcmZvcm1hbmNlLlxuICpcbiAqIERlZmF1bHRzIHRvICdkZWZhdWx0Jy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtIFByb21pc2Ugb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgY3JlYXRlZCBncmFwaGljcyBkZXZpY2UuXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlR3JhcGhpY3NEZXZpY2UoY2FudmFzLCBvcHRpb25zID0ge30pIHtcblxuICAgIGNvbnN0IGRldmljZVR5cGVzID0gb3B0aW9ucy5kZXZpY2VUeXBlcyA/PyBbXTtcblxuICAgIC8vIGF1dG9tYXRpY2FsbHkgYWRkZWQgZmFsbGJhY2tzXG4gICAgaWYgKCFkZXZpY2VUeXBlcy5pbmNsdWRlcyhERVZJQ0VUWVBFX1dFQkdMMikpIHtcbiAgICAgICAgZGV2aWNlVHlwZXMucHVzaChERVZJQ0VUWVBFX1dFQkdMMik7XG4gICAgfVxuICAgIGlmICghZGV2aWNlVHlwZXMuaW5jbHVkZXMoREVWSUNFVFlQRV9XRUJHTDEpKSB7XG4gICAgICAgIGRldmljZVR5cGVzLnB1c2goREVWSUNFVFlQRV9XRUJHTDEpO1xuICAgIH1cbiAgICBpZiAoIWRldmljZVR5cGVzLmluY2x1ZGVzKERFVklDRVRZUEVfTlVMTCkpIHtcbiAgICAgICAgZGV2aWNlVHlwZXMucHVzaChERVZJQ0VUWVBFX05VTEwpO1xuICAgIH1cblxuICAgIC8vIFhSIGNvbXBhdGliaWxpdHkgaWYgbm90IHNwZWNpZmllZFxuICAgIGlmIChwbGF0Zm9ybS5icm93c2VyICYmICEhbmF2aWdhdG9yLnhyKSB7XG4gICAgICAgIG9wdGlvbnMueHJDb21wYXRpYmxlID8/PSB0cnVlO1xuICAgIH1cblxuICAgIC8vIG1ha2UgYSBsaXN0IG9mIGRldmljZSBjcmVhdGlvbiBmdW5jdGlvbnMgaW4gcHJpb3JpdHkgb3JkZXJcbiAgICBjb25zdCBkZXZpY2VDcmVhdGVGdW5jcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGV2aWNlVHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZGV2aWNlVHlwZSA9IGRldmljZVR5cGVzW2ldO1xuXG4gICAgICAgIGlmIChkZXZpY2VUeXBlID09PSBERVZJQ0VUWVBFX1dFQkdQVSAmJiB3aW5kb3c/Lm5hdmlnYXRvcj8uZ3B1KSB7XG4gICAgICAgICAgICBkZXZpY2VDcmVhdGVGdW5jcy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXZpY2UgPSBuZXcgV2ViZ3B1R3JhcGhpY3NEZXZpY2UoY2FudmFzLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGV2aWNlLmluaXRXZWJHcHUob3B0aW9ucy5nbHNsYW5nVXJsLCBvcHRpb25zLnR3Z3NsVXJsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR0wxIHx8IGRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR0wyKSB7XG4gICAgICAgICAgICBkZXZpY2VDcmVhdGVGdW5jcy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnByZWZlcldlYkdsMiA9IGRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR0wyO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgV2ViZ2xHcmFwaGljc0RldmljZShjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9OVUxMKSB7XG4gICAgICAgICAgICBkZXZpY2VDcmVhdGVGdW5jcy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE51bGxHcmFwaGljc0RldmljZShjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIGVhY2ggZGV2aWNlIGNyZWF0aW9uIGZ1bmN0aW9uIHJldHVybmluZyB0aGUgZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHRcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgIGNvbnN0IG5leHQgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA+PSBkZXZpY2VDcmVhdGVGdW5jcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIGEgZ3JhcGhpY3MgZGV2aWNlJykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBQcm9taXNlLnJlc29sdmUoZGV2aWNlQ3JlYXRlRnVuY3NbYXR0ZW1wdCsrXSgpKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoZGV2aWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBuZXh0KCk7XG4gICAgfSk7XG59XG5cbmV4cG9ydCB7IGNyZWF0ZUdyYXBoaWNzRGV2aWNlIH07XG4iXSwibmFtZXMiOlsiY3JlYXRlR3JhcGhpY3NEZXZpY2UiLCJjYW52YXMiLCJvcHRpb25zIiwiX29wdGlvbnMkZGV2aWNlVHlwZXMiLCJkZXZpY2VUeXBlcyIsImluY2x1ZGVzIiwiREVWSUNFVFlQRV9XRUJHTDIiLCJwdXNoIiwiREVWSUNFVFlQRV9XRUJHTDEiLCJERVZJQ0VUWVBFX05VTEwiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJuYXZpZ2F0b3IiLCJ4ciIsIl9vcHRpb25zJHhyQ29tcGF0aWJsZSIsInhyQ29tcGF0aWJsZSIsImRldmljZUNyZWF0ZUZ1bmNzIiwiaSIsImxlbmd0aCIsIl93aW5kb3ciLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHUFUiLCJ3aW5kb3ciLCJncHUiLCJkZXZpY2UiLCJXZWJncHVHcmFwaGljc0RldmljZSIsImluaXRXZWJHcHUiLCJnbHNsYW5nVXJsIiwidHdnc2xVcmwiLCJwcmVmZXJXZWJHbDIiLCJXZWJnbEdyYXBoaWNzRGV2aWNlIiwiTnVsbEdyYXBoaWNzRGV2aWNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJhdHRlbXB0IiwibmV4dCIsIkVycm9yIiwidGhlbiIsImNhdGNoIiwiZXJyIiwiY29uc29sZSIsImxvZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxvQkFBb0JBLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUFBLEVBQUEsSUFBQUMsb0JBQUEsQ0FBQTtFQUVoRCxNQUFNQyxXQUFXLEdBQUFELENBQUFBLG9CQUFBLEdBQUdELE9BQU8sQ0FBQ0UsV0FBVyxLQUFBLElBQUEsR0FBQUQsb0JBQUEsR0FBSSxFQUFFLENBQUE7O0FBRTdDO0FBQ0EsRUFBQSxJQUFJLENBQUNDLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDQyxpQkFBaUIsQ0FBQyxFQUFFO0FBQzFDRixJQUFBQSxXQUFXLENBQUNHLElBQUksQ0FBQ0QsaUJBQWlCLENBQUMsQ0FBQTtBQUN2QyxHQUFBO0FBQ0EsRUFBQSxJQUFJLENBQUNGLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDRyxpQkFBaUIsQ0FBQyxFQUFFO0FBQzFDSixJQUFBQSxXQUFXLENBQUNHLElBQUksQ0FBQ0MsaUJBQWlCLENBQUMsQ0FBQTtB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
