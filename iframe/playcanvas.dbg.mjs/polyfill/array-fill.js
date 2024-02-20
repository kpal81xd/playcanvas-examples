import { defineProtoFunc } from './defineProtoFunc.js';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill#polyfill
defineProtoFunc(Array, 'fill', function (value) {
  // Steps 1-2.
  if (this == null) {
    throw new TypeError('this is null or not defined');
  }
  var O = Object(this);

  // Steps 3-5.
  var len = O.length >>> 0;

  // Steps 6-7.
  var start = arguments[1];
  var relativeStart = start >> 0;

  // Step 8.
  var k = relativeStart < 0 ? Math.max(len + relativeStart, 0) : Math.min(relativeStart, len);

  // Steps 9-10.
  var end = arguments[2];
  var relativeEnd = end === undefined ? len : end >> 0;

  // Step 11.
  var finalValue = relativeEnd < 0 ? Math.max(len + relativeEnd, 0) : Math.min(relativeEnd, len);

  // Step 12.
  while (k < finalValue) {
    O[k] = value;
    k++;
  }

  // Step 13.
  return O;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXktZmlsbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BvbHlmaWxsL2FycmF5LWZpbGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVmaW5lUHJvdG9GdW5jIH0gZnJvbSBcIi4vZGVmaW5lUHJvdG9GdW5jLmpzXCI7XG5cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2ZpbGwjcG9seWZpbGxcbmRlZmluZVByb3RvRnVuYyhBcnJheSwgJ2ZpbGwnLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIC8vIFN0ZXBzIDEtMi5cbiAgICBpZiAodGhpcyA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RoaXMgaXMgbnVsbCBvciBub3QgZGVmaW5lZCcpO1xuICAgIH1cblxuICAgIHZhciBPID0gT2JqZWN0KHRoaXMpO1xuXG4gICAgLy8gU3RlcHMgMy01LlxuICAgIHZhciBsZW4gPSBPLmxlbmd0aCA+Pj4gMDtcblxuICAgIC8vIFN0ZXBzIDYtNy5cbiAgICB2YXIgc3RhcnQgPSBhcmd1bWVudHNbMV07XG4gICAgdmFyIHJlbGF0aXZlU3RhcnQgPSBzdGFydCA+PiAwO1xuXG4gICAgLy8gU3RlcCA4LlxuICAgIHZhciBrID0gcmVsYXRpdmVTdGFydCA8IDAgPyBNYXRoLm1heChsZW4gKyByZWxhdGl2ZVN0YXJ0LCAwKSA6IE1hdGgubWluKHJlbGF0aXZlU3RhcnQsIGxlbik7XG5cbiAgICAvLyBTdGVwcyA5LTEwLlxuICAgIHZhciBlbmQgPSBhcmd1bWVudHNbMl07XG4gICAgdmFyIHJlbGF0aXZlRW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiBlbmQgPj4gMDtcblxuICAgIC8vIFN0ZXAgMTEuXG4gICAgdmFyIGZpbmFsVmFsdWUgPSByZWxhdGl2ZUVuZCA8IDAgPyBNYXRoLm1heChsZW4gKyByZWxhdGl2ZUVuZCwgMCkgOiBNYXRoLm1pbihyZWxhdGl2ZUVuZCwgbGVuKTtcblxuICAgIC8vIFN0ZXAgMTIuXG4gICAgd2hpbGUgKGsgPCBmaW5hbFZhbHVlKSB7XG4gICAgICAgIE9ba10gPSB2YWx1ZTtcbiAgICAgICAgaysrO1xuICAgIH1cblxuICAgIC8vIFN0ZXAgMTMuXG4gICAgcmV0dXJuIE87XG59KTtcbiJdLCJuYW1lcyI6WyJkZWZpbmVQcm90b0Z1bmMiLCJBcnJheSIsInZhbHVlIiwiVHlwZUVycm9yIiwiTyIsIk9iamVjdCIsImxlbiIsImxlbmd0aCIsInN0YXJ0IiwiYXJndW1lbnRzIiwicmVsYXRpdmVTdGFydCIsImsiLCJNYXRoIiwibWF4IiwibWluIiwiZW5kIiwicmVsYXRpdmVFbmQiLCJ1bmRlZmluZWQiLCJmaW5hbFZhbHVlIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0FBLGVBQWUsQ0FBQ0MsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFTQyxLQUFLLEVBQUU7QUFDM0M7RUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7QUFDZCxJQUFBLE1BQU0sSUFBSUMsU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUE7QUFDdEQsR0FBQTtBQUVBLEVBQUEsSUFBSUMsQ0FBQyxHQUFHQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7O0FBRXBCO0FBQ0EsRUFBQSxJQUFJQyxHQUFHLEdBQUdGLENBQUMsQ0FBQ0csTUFBTSxLQUFLLENBQUMsQ0FBQTs7QUFFeEI7QUFDQSxFQUFBLElBQUlDLEtBQUssR0FBR0MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hCLEVBQUEsSUFBSUMsYUFBYSxHQUFHRixLQUFLLElBQUksQ0FBQyxDQUFBOztBQUU5QjtFQUNBLElBQUlHLENBQUMsR0FBR0QsYUFBYSxHQUFHLENBQUMsR0FBR0UsSUFBSSxDQUFDQyxHQUFHLENBQUNQLEdBQUcsR0FBR0ksYUFBYSxFQUFFLENBQUMsQ0FBQyxHQUFHRSxJQUFJLENBQUNFLEdBQUcsQ0FBQ0osYUFBYSxFQUFFSixHQUFHLENBQUMsQ0FBQTs7QUFFM0Y7QUFDQSxFQUFBLElBQUlTLEdBQUcsR0FBR04sU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFBO0VBQ3RCLElBQUlPLFdBQVcsR0FBR0QsR0FBRyxLQUFLRSxTQUFTLEdBQUdYLEdBQUcsR0FBR1MsR0FBRyxJQUFJLENBQUMsQ0FBQTs7QUFFcEQ7RUFDQSxJQUFJRyxVQUFVLEdBQUdGLFdBQVcsR0FBRyxDQUFDLEdBQUdKLElBQUksQ0FBQ0MsR0FBRyxDQUFDUCxHQUFHLEdBQUdVLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBR0osSUFBSSxDQUFDRSxHQUFHLENBQUNFLFdBQVcsRUFBRVYsR0FBRyxDQUFDLENBQUE7O0FBRTlGO0VBQ0EsT0FBT0ssQ0FBQyxHQUFHTyxVQUFVLEVBQUU7QUFDbkJkLElBQUFBLENBQUMsQ0FBQ08sQ0FBQyxDQUFDLEdBQUdULEtBQUssQ0FBQTtBQUNaUyxJQUFBQSxDQUFDLEVBQUUsQ0FBQTtBQUNQLEdBQUE7O0FBRUE7QUFDQSxFQUFBLE9BQU9QLENBQUMsQ0FBQTtBQUNaLENBQUMsQ0FBQyJ9