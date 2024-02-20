var alphaTestPS = /* glsl */`
uniform float alpha_ref;

void alphaTest(float a) {
    if (a < alpha_ref) discard;
}
`;

export { alphaTestPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGFUZXN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9hbHBoYVRlc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgYWxwaGFfcmVmO1xuXG52b2lkIGFscGhhVGVzdChmbG9hdCBhKSB7XG4gICAgaWYgKGEgPCBhbHBoYV9yZWYpIGRpc2NhcmQ7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==