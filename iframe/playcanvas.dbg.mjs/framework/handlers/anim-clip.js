import { Http, http } from '../../platform/net/http.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { ResourceHandler } from './handler.js';

/**
 * Resource handler used for loading {@link AnimClip} resources.
 *
 * @ignore
 */
class AnimClipHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'animclip');
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    // we need to specify JSON for blob URLs
    const options = {
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    };
    if (url.load.startsWith('blob:')) {
      options.responseType = Http.ResponseType.JSON;
    }
    http.get(url.load, options, function (err, response) {
      if (err) {
        callback(`Error loading animation clip resource: ${url.original} [${err}]`);
      } else {
        callback(null, response);
      }
    });
  }
  open(url, data) {
    const name = data.name;
    const duration = data.duration;
    const inputs = data.inputs.map(function (input) {
      return new AnimData(1, input);
    });
    const outputs = data.outputs.map(function (output) {
      return new AnimData(output.components, output.data);
    });
    const curves = data.curves.map(function (curve) {
      return new AnimCurve([curve.path], curve.inputIndex, curve.outputIndex, curve.interpolation);
    });
    return new AnimTrack(name, duration, inputs, outputs, curves);
  }
}

export { AnimClipHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jbGlwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2FuaW0tY2xpcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBodHRwLCBIdHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBBbmltQ3VydmUgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLWN1cnZlLmpzJztcbmltcG9ydCB7IEFuaW1EYXRhIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1kYXRhLmpzJztcbmltcG9ydCB7IEFuaW1UcmFjayB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tdHJhY2suanMnO1xuXG5pbXBvcnQgeyBSZXNvdXJjZUhhbmRsZXIgfSBmcm9tICcuL2hhbmRsZXIuanMnO1xuXG4vKipcbiAqIFJlc291cmNlIGhhbmRsZXIgdXNlZCBmb3IgbG9hZGluZyB7QGxpbmsgQW5pbUNsaXB9IHJlc291cmNlcy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEFuaW1DbGlwSGFuZGxlciBleHRlbmRzIFJlc291cmNlSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCwgJ2FuaW1jbGlwJyk7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdXJsID0ge1xuICAgICAgICAgICAgICAgIGxvYWQ6IHVybCxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbDogdXJsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2UgbmVlZCB0byBzcGVjaWZ5IEpTT04gZm9yIGJsb2IgVVJMc1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgcmV0cnk6IHRoaXMubWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICBtYXhSZXRyaWVzOiB0aGlzLm1heFJldHJpZXNcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodXJsLmxvYWQuc3RhcnRzV2l0aCgnYmxvYjonKSkge1xuICAgICAgICAgICAgb3B0aW9ucy5yZXNwb25zZVR5cGUgPSBIdHRwLlJlc3BvbnNlVHlwZS5KU09OO1xuICAgICAgICB9XG5cbiAgICAgICAgaHR0cC5nZXQodXJsLmxvYWQsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soYEVycm9yIGxvYWRpbmcgYW5pbWF0aW9uIGNsaXAgcmVzb3VyY2U6ICR7dXJsLm9yaWdpbmFsfSBbJHtlcnJ9XWApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBkYXRhLm5hbWU7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gZGF0YS5kdXJhdGlvbjtcbiAgICAgICAgY29uc3QgaW5wdXRzID0gZGF0YS5pbnB1dHMubWFwKGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbmltRGF0YSgxLCBpbnB1dCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBvdXRwdXRzID0gZGF0YS5vdXRwdXRzLm1hcChmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFuaW1EYXRhKG91dHB1dC5jb21wb25lbnRzLCBvdXRwdXQuZGF0YSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjdXJ2ZXMgPSBkYXRhLmN1cnZlcy5tYXAoZnVuY3Rpb24gKGN1cnZlKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFuaW1DdXJ2ZShcbiAgICAgICAgICAgICAgICBbY3VydmUucGF0aF0sXG4gICAgICAgICAgICAgICAgY3VydmUuaW5wdXRJbmRleCxcbiAgICAgICAgICAgICAgICBjdXJ2ZS5vdXRwdXRJbmRleCxcbiAgICAgICAgICAgICAgICBjdXJ2ZS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG5ldyBBbmltVHJhY2soXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICAgICBpbnB1dHMsXG4gICAgICAgICAgICBvdXRwdXRzLFxuICAgICAgICAgICAgY3VydmVzXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ2xpcEhhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJBbmltQ2xpcEhhbmRsZXIiLCJSZXNvdXJjZUhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsIm9yaWdpbmFsIiwib3B0aW9ucyIsInJldHJ5IiwibWF4UmV0cmllcyIsInN0YXJ0c1dpdGgiLCJyZXNwb25zZVR5cGUiLCJIdHRwIiwiUmVzcG9uc2VUeXBlIiwiSlNPTiIsImh0dHAiLCJnZXQiLCJlcnIiLCJyZXNwb25zZSIsIm9wZW4iLCJkYXRhIiwibmFtZSIsImR1cmF0aW9uIiwiaW5wdXRzIiwibWFwIiwiaW5wdXQiLCJBbmltRGF0YSIsIm91dHB1dHMiLCJvdXRwdXQiLCJjb21wb25lbnRzIiwiY3VydmVzIiwiY3VydmUiLCJBbmltQ3VydmUiLCJwYXRoIiwiaW5wdXRJbmRleCIsIm91dHB1dEluZGV4IiwiaW50ZXJwb2xhdGlvbiIsIkFuaW1UcmFjayJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGVBQWUsU0FBU0MsZUFBZSxDQUFDO0VBQzFDQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7QUFD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