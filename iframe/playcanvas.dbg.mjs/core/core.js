/**
 * @name pc
 * @namespace
 * @description Root namespace for the PlayCanvas Engine.
 */

/**
 * The engine version number. This is in semantic versioning format (MAJOR.MINOR.PATCH).
 */
const version = '0.0.0';

/**
 * The engine revision number. This is the Git hash of the last commit made to the branch
 * from which the engine was built.
 */
const revision = '62b0cffb3';
const config = {};
const common = {};
const apps = {}; // Storage for the applications using the PlayCanvas Engine
const data = {}; // Storage for exported entity data

const typeofs = ['undefined', 'number', 'string', 'boolean'];
const objectTypes = {
  '[object Array]': 'array',
  '[object Object]': 'object',
  '[object Function]': 'function',
  '[object Date]': 'date',
  '[object RegExp]': 'regexp',
  '[object Float32Array]': 'float32array'
};

/**
 * Extended typeof() function, returns the type of the object.
 *
 * @param {object} obj - The object to get the type of.
 * @returns {string} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array".
 * @ignore
 */
function type(obj) {
  if (obj === null) {
    return 'null';
  }
  const typeString = typeof obj;
  if (typeofs.includes(typeString)) {
    return typeString;
  }
  return objectTypes[Object.prototype.toString.call(obj)];
}

/**
 * Merge the contents of two objects into a single object.
 *
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object that is merged with target.
 * @returns {object} The target object.
 * @example
 * const A = {
 *     a: function () {
 *         console.log(this.a);
 *     }
 * };
 * const B = {
 *     b: function () {
 *         console.log(this.b);
 *     }
 * };
 *
 * pc.extend(A, B);
 * A.a();
 * // logs "a"
 * A.b();
 * // logs "b"
 * @ignore
 */
function extend(target, ex) {
  for (const prop in ex) {
    const copy = ex[prop];
    if (type(copy) === 'object') {
      target[prop] = extend({}, copy);
    } else if (type(copy) === 'array') {
      target[prop] = extend([], copy);
    } else {
      target[prop] = copy;
    }
  }
  return target;
}

export { apps, common, config, data, extend, revision, type, version };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvY29yZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBuYW1lIHBjXG4gKiBAbmFtZXNwYWNlXG4gKiBAZGVzY3JpcHRpb24gUm9vdCBuYW1lc3BhY2UgZm9yIHRoZSBQbGF5Q2FudmFzIEVuZ2luZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBlbmdpbmUgdmVyc2lvbiBudW1iZXIuIFRoaXMgaXMgaW4gc2VtYW50aWMgdmVyc2lvbmluZyBmb3JtYXQgKE1BSk9SLk1JTk9SLlBBVENIKS5cbiAqL1xuY29uc3QgdmVyc2lvbiA9ICckX0NVUlJFTlRfU0RLX1ZFUlNJT04nO1xuXG4vKipcbiAqIFRoZSBlbmdpbmUgcmV2aXNpb24gbnVtYmVyLiBUaGlzIGlzIHRoZSBHaXQgaGFzaCBvZiB0aGUgbGFzdCBjb21taXQgbWFkZSB0byB0aGUgYnJhbmNoXG4gKiBmcm9tIHdoaWNoIHRoZSBlbmdpbmUgd2FzIGJ1aWx0LlxuICovXG5jb25zdCByZXZpc2lvbiA9ICckX0NVUlJFTlRfU0RLX1JFVklTSU9OJztcblxuY29uc3QgY29uZmlnID0geyB9O1xuY29uc3QgY29tbW9uID0geyB9O1xuY29uc3QgYXBwcyA9IHsgfTsgLy8gU3RvcmFnZSBmb3IgdGhlIGFwcGxpY2F0aW9ucyB1c2luZyB0aGUgUGxheUNhbnZhcyBFbmdpbmVcbmNvbnN0IGRhdGEgPSB7IH07IC8vIFN0b3JhZ2UgZm9yIGV4cG9ydGVkIGVudGl0eSBkYXRhXG5cbmNvbnN0IHR5cGVvZnMgPSBbJ3VuZGVmaW5lZCcsICdudW1iZXInLCAnc3RyaW5nJywgJ2Jvb2xlYW4nXTtcbmNvbnN0IG9iamVjdFR5cGVzID0ge1xuICAgICdbb2JqZWN0IEFycmF5XSc6ICdhcnJheScsXG4gICAgJ1tvYmplY3QgT2JqZWN0XSc6ICdvYmplY3QnLFxuICAgICdbb2JqZWN0IEZ1bmN0aW9uXSc6ICdmdW5jdGlvbicsXG4gICAgJ1tvYmplY3QgRGF0ZV0nOiAnZGF0ZScsXG4gICAgJ1tvYmplY3QgUmVnRXhwXSc6ICdyZWdleHAnLFxuICAgICdbb2JqZWN0IEZsb2F0MzJBcnJheV0nOiAnZmxvYXQzMmFycmF5J1xufTtcblxuLyoqXG4gKiBFeHRlbmRlZCB0eXBlb2YoKSBmdW5jdGlvbiwgcmV0dXJucyB0aGUgdHlwZSBvZiB0aGUgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmogLSBUaGUgb2JqZWN0IHRvIGdldCB0aGUgdHlwZSBvZi5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSB0eXBlIHN0cmluZzogXCJudWxsXCIsIFwidW5kZWZpbmVkXCIsIFwibnVtYmVyXCIsIFwic3RyaW5nXCIsIFwiYm9vbGVhblwiLCBcImFycmF5XCIsIFwib2JqZWN0XCIsIFwiZnVuY3Rpb25cIiwgXCJkYXRlXCIsIFwicmVnZXhwXCIgb3IgXCJmbG9hdDMyYXJyYXlcIi5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gdHlwZShvYmopIHtcbiAgICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgfVxuXG4gICAgY29uc3QgdHlwZVN0cmluZyA9IHR5cGVvZiBvYmo7XG4gICAgaWYgKHR5cGVvZnMuaW5jbHVkZXModHlwZVN0cmluZykpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVTdHJpbmc7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdFR5cGVzW09iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopXTtcbn1cblxuLyoqXG4gKiBNZXJnZSB0aGUgY29udGVudHMgb2YgdHdvIG9iamVjdHMgaW50byBhIHNpbmdsZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHRhcmdldCAtIFRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBtZXJnZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBleCAtIFRoZSBvYmplY3QgdGhhdCBpcyBtZXJnZWQgd2l0aCB0YXJnZXQuXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgdGFyZ2V0IG9iamVjdC5cbiAqIEBleGFtcGxlXG4gKiBjb25zdCBBID0ge1xuICogICAgIGE6IGZ1bmN0aW9uICgpIHtcbiAqICAgICAgICAgY29uc29sZS5sb2codGhpcy5hKTtcbiAqICAgICB9XG4gKiB9O1xuICogY29uc3QgQiA9IHtcbiAqICAgICBiOiBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuYik7XG4gKiAgICAgfVxuICogfTtcbiAqXG4gKiBwYy5leHRlbmQoQSwgQik7XG4gKiBBLmEoKTtcbiAqIC8vIGxvZ3MgXCJhXCJcbiAqIEEuYigpO1xuICogLy8gbG9ncyBcImJcIlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0LCBleCkge1xuICAgIGZvciAoY29uc3QgcHJvcCBpbiBleCkge1xuICAgICAgICBjb25zdCBjb3B5ID0gZXhbcHJvcF07XG5cbiAgICAgICAgaWYgKHR5cGUoY29weSkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBleHRlbmQoe30sIGNvcHkpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUoY29weSkgPT09ICdhcnJheScpIHtcbiAgICAgICAgICAgIHRhcmdldFtwcm9wXSA9IGV4dGVuZChbXSwgY29weSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBjb3B5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IHsgYXBwcywgY29tbW9uLCBjb25maWcsIGRhdGEsIGV4dGVuZCwgcmV2aXNpb24sIHR5cGUsIHZlcnNpb24gfTtcbiJdLCJuYW1lcyI6WyJ2ZXJzaW9uIiwicmV2aXNpb24iLCJjb25maWciLCJjb21tb24iLCJhcHBzIiwiZGF0YSIsInR5cGVvZnMiLCJvYmplY3RUeXBlcyIsInR5cGUiLCJvYmoiLCJ0eXBlU3RyaW5nIiwiaW5jbHVkZXMiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsImNhbGwiLCJleHRlbmQiLCJ0YXJnZXQiLCJleCIsInByb3AiLCJjb3B5Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNNQSxNQUFBQSxPQUFPLEdBQUcsUUFBdUI7O0FBRXZDO0FBQ0E7QUFDQTtBQUNBO0FBQ01DLE1BQUFBLFFBQVEsR0FBRyxZQUF3QjtBQUVuQ0MsTUFBQUEsTUFBTSxHQUFHLEdBQUc7QUFDWkMsTUFBQUEsTUFBTSxHQUFHLEdBQUc7QUFDbEIsTUFBTUMsSUFBSSxHQUFHLEdBQUk7QUFDakIsTUFBTUMsSUFBSSxHQUFHLEdBQUk7O0FBRWpCLE1BQU1DLE9BQU8sR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFBO0FBQzVELE1BQU1DLFdBQVcsR0FBRztBQUNoQixFQUFBLGdCQUFnQixFQUFFLE9BQU87QUFDekIsRUFBQSxpQkFBaUIsRUFBRSxRQUFRO0FBQzNCLEVBQUEsbUJBQW1CLEVBQUUsVUFBVTtBQUMvQixFQUFBLGVBQWUsRUFBRSxNQUFNO0FBQ3ZCLEVBQUEsaUJBQWlCLEVBQUUsUUFBUTtBQUMzQixFQUFBLHVCQUF1QixFQUFFLGNBQUE7QUFDN0IsQ0FBQyxDQUFBOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsSUFBSUEsQ0FBQ0MsR0FBRyxFQUFFO0VBQ2YsSUFBSUEsR0FBRyxLQUFLLElBQUksRUFBRTtBQUNkLElBQUEsT0FBTyxNQUFNLENBQUE7QUFDakIsR0FBQTtFQUVBLE1BQU1DLFVBQVUsR0FBRyxPQUFPRCxHQUFHLENBQUE7QUFDN0IsRUFBQSxJQUFJSCxPQUFPLENBQUNLLFFBQVEsQ0FBQ0QsVUFBVSxDQUFDLEVBQUU7QUFDOUIsSUFBQSxPQUFPQSxVQUFVLENBQUE7QUFDckIsR0FBQTtBQUVBLEVBQUEsT0FBT0gsV0FBVyxDQUFDSyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsUUFBUSxDQUFDQyxJQUFJLENBQUNOLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDM0QsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNPLE1BQU1BLENBQUNDLE1BQU0sRUFBRUMsRUFBRSxFQUFFO0FBQ3hCLEVBQUEsS0FBSyxNQUFNQyxJQUFJLElBQUlELEVBQUUsRUFBRTtBQUNuQixJQUFBLE1BQU1FLElBQUksR0FBR0YsRUFBRSxDQUFDQyxJQUFJLENBQUMsQ0FBQTtBQUVyQixJQUFBLElBQUlYLElBQUksQ0FBQ1ksSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFO01BQ3pCSCxNQUFNLENBQUNFLElBQUksQ0FBQyxHQUFHSCxNQUFNLENBQUMsRUFBRSxFQUFFSSxJQUFJLENBQUMsQ0FBQTtLQUNsQyxNQUFNLElBQUlaLElBQUksQ0FBQ1ksSUFBSSxDQUFDLEtBQUssT0FBTyxFQUFFO01BQy9CSCxNQUFNLENBQUNFLElBQUksQ0FBQyxHQUFHSCxNQUFNLENBQUMsRUFBRSxFQUFFSSxJQUFJLENBQUMsQ0FBQTtBQUNuQyxLQUFDLE1BQU07QUFDSEgsTUFBQUEsTUFBTSxDQUFDRSxJQUFJLENBQUMsR0FBR0MsSUFBSSxDQUFBO0FBQ3ZCLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxPQUFPSCxNQUFNLENBQUE7QUFDakI7Ozs7In0=
