import { defineProtoFunc } from './defineProtoFunc.js';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith#Polyfill
defineProtoFunc(String, 'endsWith', function (search, this_len) {
  if (this_len === undefined || this_len > this.length) {
    this_len = this.length;
  }
  return this.substring(this_len - search.length, this_len) === search;
});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes#Polyfill
defineProtoFunc(String, 'includes', function (search, start) {

  if (typeof start !== 'number') {
    start = 0;
  }
  if (start + search.length > this.length) {
    return false;
  } else {
    return this.indexOf(search, start) !== -1;
  }
});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith#Polyfill
defineProtoFunc(String, 'startsWith', function (search, rawPos) {
  var pos = rawPos > 0 ? rawPos | 0 : 0;
  return this.substring(pos, pos + search.length) === search;
});

// https://vanillajstoolkit.com/polyfills/stringtrimend/
defineProtoFunc(String, 'trimEnd', function () {
  return this.replace(new RegExp(/[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source + '$', 'g'), '');
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcG9seWZpbGwvc3RyaW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRlZmluZVByb3RvRnVuYyB9IGZyb20gXCIuL2RlZmluZVByb3RvRnVuYy5qc1wiO1xuXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9TdHJpbmcvZW5kc1dpdGgjUG9seWZpbGxcbmRlZmluZVByb3RvRnVuYyhTdHJpbmcsICdlbmRzV2l0aCcsIGZ1bmN0aW9uIChzZWFyY2gsIHRoaXNfbGVuKSB7XG4gICAgaWYgKHRoaXNfbGVuID09PSB1bmRlZmluZWQgfHwgdGhpc19sZW4gPiB0aGlzLmxlbmd0aCkge1xuICAgICAgICB0aGlzX2xlbiA9IHRoaXMubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdWJzdHJpbmcodGhpc19sZW4gLSBzZWFyY2gubGVuZ3RoLCB0aGlzX2xlbikgPT09IHNlYXJjaDtcbn0pO1xuXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9TdHJpbmcvaW5jbHVkZXMjUG9seWZpbGxcbmRlZmluZVByb3RvRnVuYyhTdHJpbmcsICdpbmNsdWRlcycsIGZ1bmN0aW9uIChzZWFyY2gsIHN0YXJ0KSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgKyBzZWFyY2gubGVuZ3RoID4gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4T2Yoc2VhcmNoLCBzdGFydCkgIT09IC0xO1xuICAgIH1cbn0pO1xuXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9TdHJpbmcvc3RhcnRzV2l0aCNQb2x5ZmlsbFxuZGVmaW5lUHJvdG9GdW5jKFN0cmluZywgJ3N0YXJ0c1dpdGgnLCBmdW5jdGlvbihzZWFyY2gsIHJhd1Bvcykge1xuICAgIHZhciBwb3MgPSByYXdQb3MgPiAwID8gcmF3UG9zfDAgOiAwO1xuICAgIHJldHVybiB0aGlzLnN1YnN0cmluZyhwb3MsIHBvcyArIHNlYXJjaC5sZW5ndGgpID09PSBzZWFyY2g7XG59KTtcblxuLy8gaHR0cHM6Ly92YW5pbGxhanN0b29sa2l0LmNvbS9wb2x5ZmlsbHMvc3RyaW5ndHJpbWVuZC9cbmRlZmluZVByb3RvRnVuYyhTdHJpbmcsICd0cmltRW5kJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJlcGxhY2UobmV3IFJlZ0V4cCgvW1xceDA5XFx4MEFcXHgwQlxceDBDXFx4MERcXHgyMFxceEEwXFx1MTY4MFxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBBXFx1MjAyRlxcdTIwNUZcXHUzMDAwXFx1MjAyOFxcdTIwMjlcXHVGRUZGXSsvLnNvdXJjZSArICckJywgJ2cnKSwgJycpO1xufSk7XG4iXSwibmFtZXMiOlsiZGVmaW5lUHJvdG9GdW5jIiwiU3RyaW5nIiwic2VhcmNoIiwidGhpc19sZW4iLCJ1bmRlZmluZWQiLCJsZW5ndGgiLCJzdWJzdHJpbmciLCJzdGFydCIsImluZGV4T2YiLCJyYXdQb3MiLCJwb3MiLCJyZXBsYWNlIiwiUmVnRXhwIiwic291cmNlIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0FBLGVBQWUsQ0FBQ0MsTUFBTSxFQUFFLFVBQVUsRUFBRSxVQUFVQyxNQUFNLEVBQUVDLFFBQVEsRUFBRTtFQUM1RCxJQUFJQSxRQUFRLEtBQUtDLFNBQVMsSUFBSUQsUUFBUSxHQUFHLElBQUksQ0FBQ0UsTUFBTSxFQUFFO0lBQ2xERixRQUFRLEdBQUcsSUFBSSxDQUFDRSxNQUFNLENBQUE7QUFDMUIsR0FBQTtBQUNBLEVBQUEsT0FBTyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0gsUUFBUSxHQUFHRCxNQUFNLENBQUNHLE1BQU0sRUFBRUYsUUFBUSxDQUFDLEtBQUtELE1BQU0sQ0FBQTtBQUN4RSxDQUFDLENBQUMsQ0FBQTs7QUFFRjtBQUNBRixlQUFlLENBQUNDLE1BQU0sRUFBRSxVQUFVLEVBQUUsVUFBVUMsTUFBTSxFQUFFSyxLQUFLLEVBQUU7O0FBRXpELEVBQUEsSUFBSSxPQUFPQSxLQUFLLEtBQUssUUFBUSxFQUFFO0FBQzNCQSxJQUFBQSxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBQ2IsR0FBQTtFQUVBLElBQUlBLEtBQUssR0FBR0wsTUFBTSxDQUFDRyxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLEVBQUU7QUFDckMsSUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixHQUFDLE1BQU07SUFDSCxPQUFPLElBQUksQ0FBQ0csT0FBTyxDQUFDTixNQUFNLEVBQUVLLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQzdDLEdBQUE7QUFDSixDQUFDLENBQUMsQ0FBQTs7QUFFRjtBQUNBUCxlQUFlLENBQUNDLE1BQU0sRUFBRSxZQUFZLEVBQUUsVUFBU0MsTUFBTSxFQUFFTyxNQUFNLEVBQUU7RUFDM0QsSUFBSUMsR0FBRyxHQUFHRCxNQUFNLEdBQUcsQ0FBQyxHQUFHQSxNQUFNLEdBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNuQyxFQUFBLE9BQU8sSUFBSSxDQUFDSCxTQUFTLENBQUNJLEdBQUcsRUFBRUEsR0FBRyxHQUFHUixNQUFNLENBQUNHLE1BQU0sQ0FBQyxLQUFLSCxNQUFNLENBQUE7QUFDOUQsQ0FBQyxDQUFDLENBQUE7O0FBRUY7QUFDQUYsZUFBZSxDQUFDQyxNQUFNLEVBQUUsU0FBUyxFQUFFLFlBQVk7QUFDM0MsRUFBQSxPQUFPLElBQUksQ0FBQ1UsT0FBTyxDQUFDLElBQUlDLE1BQU0sQ0FBQyw2SUFBNkksQ0FBQ0MsTUFBTSxHQUFHLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtBQUN4TSxDQUFDLENBQUMifQ==
