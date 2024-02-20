var opacityDitherPS = /* glsl */`

uniform vec4 blueNoiseJitter;

#ifndef DITHER_BAYER8
    uniform sampler2D blueNoiseTex32;
#endif

void opacityDither(float alpha, float id) {
    #ifdef DITHER_BAYER8

        float noise = bayer8(floor(mod(gl_FragCoord.xy + blueNoiseJitter.xy + id, 8.0))) / 64.0;

    #else   // blue noise

        vec2 uv = fract(gl_FragCoord.xy / 32.0 + blueNoiseJitter.xy + id);
        float noise = texture2DLodEXT(blueNoiseTex32, uv, 0.0).y;

    #endif

    if (alpha < noise)
        discard;
}
`;

export { opacityDitherPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BhY2l0eS1kaXRoZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL29wYWNpdHktZGl0aGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbnVuaWZvcm0gdmVjNCBibHVlTm9pc2VKaXR0ZXI7XG5cbiNpZm5kZWYgRElUSEVSX0JBWUVSOFxuICAgIHVuaWZvcm0gc2FtcGxlcjJEIGJsdWVOb2lzZVRleDMyO1xuI2VuZGlmXG5cbnZvaWQgb3BhY2l0eURpdGhlcihmbG9hdCBhbHBoYSwgZmxvYXQgaWQpIHtcbiAgICAjaWZkZWYgRElUSEVSX0JBWUVSOFxuXG4gICAgICAgIGZsb2F0IG5vaXNlID0gYmF5ZXI4KGZsb29yKG1vZChnbF9GcmFnQ29vcmQueHkgKyBibHVlTm9pc2VKaXR0ZXIueHkgKyBpZCwgOC4wKSkpIC8gNjQuMDtcblxuICAgICNlbHNlICAgLy8gYmx1ZSBub2lzZVxuXG4gICAgICAgIHZlYzIgdXYgPSBmcmFjdChnbF9GcmFnQ29vcmQueHkgLyAzMi4wICsgYmx1ZU5vaXNlSml0dGVyLnh5ICsgaWQpO1xuICAgICAgICBmbG9hdCBub2lzZSA9IHRleHR1cmUyRExvZEVYVChibHVlTm9pc2VUZXgzMiwgdXYsIDAuMCkueTtcblxuICAgICNlbmRpZlxuXG4gICAgaWYgKGFscGhhIDwgbm9pc2UpXG4gICAgICAgIGRpc2NhcmQ7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
