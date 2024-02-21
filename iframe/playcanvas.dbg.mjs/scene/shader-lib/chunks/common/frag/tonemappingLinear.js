var tonemappingLinearPS = /* glsl */`
uniform float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
`;

export { tonemappingLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdMaW5lYXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy90b25lbWFwcGluZ0xpbmVhci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBleHBvc3VyZTtcblxudmVjMyB0b25lTWFwKHZlYzMgY29sb3IpIHtcbiAgICByZXR1cm4gY29sb3IgKiBleHBvc3VyZTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9