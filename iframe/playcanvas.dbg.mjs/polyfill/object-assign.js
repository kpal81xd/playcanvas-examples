// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
if (typeof Object.assign != 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) {

      if (target == null) {
        // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0LWFzc2lnbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BvbHlmaWxsL29iamVjdC1hc3NpZ24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2Fzc2lnbiNQb2x5ZmlsbFxuaWYgKHR5cGVvZiBPYmplY3QuYXNzaWduICE9ICdmdW5jdGlvbicpIHtcbiAgICAvLyBNdXN0IGJlIHdyaXRhYmxlOiB0cnVlLCBlbnVtZXJhYmxlOiBmYWxzZSwgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdCwgXCJhc3NpZ25cIiwge1xuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gYXNzaWduKHRhcmdldCwgdmFyQXJncykgeyAvLyAubGVuZ3RoIG9mIGZ1bmN0aW9uIGlzIDJcbiAgICAgICAgICAgICd1c2Ugc3RyaWN0JztcbiAgICAgICAgICAgIGlmICh0YXJnZXQgPT0gbnVsbCkgeyAvLyBUeXBlRXJyb3IgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRvID0gT2JqZWN0KHRhcmdldCk7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgaWYgKG5leHRTb3VyY2UgIT0gbnVsbCkgeyAvLyBTa2lwIG92ZXIgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgbmV4dEtleSBpbiBuZXh0U291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBBdm9pZCBidWdzIHdoZW4gaGFzT3duUHJvcGVydHkgaXMgc2hhZG93ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobmV4dFNvdXJjZSwgbmV4dEtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b1tuZXh0S2V5XSA9IG5leHRTb3VyY2VbbmV4dEtleV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG87XG4gICAgICAgIH0sXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbn1cbiJdLCJuYW1lcyI6WyJPYmplY3QiLCJhc3NpZ24iLCJkZWZpbmVQcm9wZXJ0eSIsInZhbHVlIiwidGFyZ2V0IiwidmFyQXJncyIsIlR5cGVFcnJvciIsInRvIiwiaW5kZXgiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJuZXh0U291cmNlIiwibmV4dEtleSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsIndyaXRhYmxlIiwiY29uZmlndXJhYmxlIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLElBQUksT0FBT0EsTUFBTSxDQUFDQyxNQUFNLElBQUksVUFBVSxFQUFFO0FBQ3BDO0FBQ0FELEVBQUFBLE1BQU0sQ0FBQ0UsY0FBYyxDQUFDRixNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3BDRyxJQUFBQSxLQUFLLEVBQUUsU0FBU0YsTUFBTUEsQ0FBQ0csTUFBTSxFQUFFQyxPQUFPLEVBQUU7O01BRXBDLElBQUlELE1BQU0sSUFBSSxJQUFJLEVBQUU7QUFBRTtBQUNsQixRQUFBLE1BQU0sSUFBSUUsU0FBUyxDQUFDLDRDQUE0QyxDQUFDLENBQUE7QUFDckUsT0FBQTtBQUVBLE1BQUEsSUFBSUMsRUFBRSxHQUFHUCxNQUFNLENBQUNJLE1BQU0sQ0FBQyxDQUFBO0FBRXZCLE1BQUEsS0FBSyxJQUFJSSxLQUFLLEdBQUcsQ0FBQyxFQUFFQSxLQUFLLEdBQUdDLFNBQVMsQ0FBQ0MsTUFBTSxFQUFFRixLQUFLLEVBQUUsRUFBRTtBQUNuRCxRQUFBLElBQUlHLFVBQVUsR0FBR0YsU0FBUyxDQUFDRCxLQUFLLENBQUMsQ0FBQTtRQUVqQyxJQUFJRyxVQUFVLElBQUksSUFBSSxFQUFFO0FBQUU7QUFDdEIsVUFBQSxLQUFLLElBQUlDLE9BQU8sSUFBSUQsVUFBVSxFQUFFO0FBQzVCO0FBQ0EsWUFBQSxJQUFJWCxNQUFNLENBQUNhLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUNKLFVBQVUsRUFBRUMsT0FBTyxDQUFDLEVBQUU7QUFDM0RMLGNBQUFBLEVBQUUsQ0FBQ0ssT0FBTyxDQUFDLEdBQUdELFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7QUFDckMsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNBLE1BQUEsT0FBT0wsRUFBRSxDQUFBO0tBQ1o7QUFDRFMsSUFBQUEsUUFBUSxFQUFFLElBQUk7QUFDZEMsSUFBQUEsWUFBWSxFQUFFLElBQUE7QUFDbEIsR0FBQyxDQUFDLENBQUE7QUFDTiJ9
