// procedural Bayer matrix, based on: https://www.shadertoy.com/view/Mlt3z8

var bayerPS = /* glsl */`
// 2x2 bayer matrix [1 2][3 0], p in [0,1]
float bayer2(vec2 p) {
    return mod(2.0 * p.y + p.x + 1.0, 4.0);
}

// 4x4 matrix, p - pixel coordinate
float bayer4(vec2 p) {
    vec2 p1 = mod(p, 2.0);
    vec2 p2 = floor(0.5 * mod(p, 4.0));
    return 4.0 * bayer2(p1) + bayer2(p2);
}

// 8x8 matrix, p - pixel coordinate
float bayer8(vec2 p) {
    vec2 p1 = mod(p, 2.0);
    vec2 p2 = floor(0.5 * mod(p, 4.0));
    vec2 p4 = floor(0.25 * mod(p, 8.0));
    return 4.0 * (4.0 * bayer2(p1) + bayer2(p2)) + bayer2(p4);
}
`;

export { bayerPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9iYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBwcm9jZWR1cmFsIEJheWVyIG1hdHJpeCwgYmFzZWQgb246IGh0dHBzOi8vd3d3LnNoYWRlcnRveS5jb20vdmlldy9NbHQzejhcblxuZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIDJ4MiBiYXllciBtYXRyaXggWzEgMl1bMyAwXSwgcCBpbiBbMCwxXVxuZmxvYXQgYmF5ZXIyKHZlYzIgcCkge1xuICAgIHJldHVybiBtb2QoMi4wICogcC55ICsgcC54ICsgMS4wLCA0LjApO1xufVxuXG4vLyA0eDQgbWF0cml4LCBwIC0gcGl4ZWwgY29vcmRpbmF0ZVxuZmxvYXQgYmF5ZXI0KHZlYzIgcCkge1xuICAgIHZlYzIgcDEgPSBtb2QocCwgMi4wKTtcbiAgICB2ZWMyIHAyID0gZmxvb3IoMC41ICogbW9kKHAsIDQuMCkpO1xuICAgIHJldHVybiA0LjAgKiBiYXllcjIocDEpICsgYmF5ZXIyKHAyKTtcbn1cblxuLy8gOHg4IG1hdHJpeCwgcCAtIHBpeGVsIGNvb3JkaW5hdGVcbmZsb2F0IGJheWVyOCh2ZWMyIHApIHtcbiAgICB2ZWMyIHAxID0gbW9kKHAsIDIuMCk7XG4gICAgdmVjMiBwMiA9IGZsb29yKDAuNSAqIG1vZChwLCA0LjApKTtcbiAgICB2ZWMyIHA0ID0gZmxvb3IoMC4yNSAqIG1vZChwLCA4LjApKTtcbiAgICByZXR1cm4gNC4wICogKDQuMCAqIGJheWVyMihwMSkgKyBiYXllcjIocDIpKSArIGJheWVyMihwNCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQUVBLGNBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
