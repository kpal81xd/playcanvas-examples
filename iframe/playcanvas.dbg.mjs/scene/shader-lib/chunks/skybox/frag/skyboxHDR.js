var skyboxHDRPS = /* glsl */`
varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

#ifdef SKYMESH

    varying vec3 vWorldPos;
    uniform mat3 cubeMapRotationMatrix;
    uniform vec3 projectedSkydomeCenter;

#endif

void main(void) {

    #ifdef SKYMESH

        // get vector from world space pos to tripod origin
        vec3 envDir = normalize(vWorldPos - projectedSkydomeCenter);
        vec3 dir = envDir * cubeMapRotationMatrix;

    #else

        vec3 dir = vViewDir;

    #endif

    dir.x *= -1.0;
    vec3 linear = $DECODE(textureCube(texture_cubeMap, fixSeamsStatic(dir, $FIXCONST)));
    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;

export { skyboxHDRPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94SERSLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc2t5Ym94L2ZyYWcvc2t5Ym94SERSLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzMgdlZpZXdEaXI7XG5cbnVuaWZvcm0gc2FtcGxlckN1YmUgdGV4dHVyZV9jdWJlTWFwO1xuXG4jaWZkZWYgU0tZTUVTSFxuXG4gICAgdmFyeWluZyB2ZWMzIHZXb3JsZFBvcztcbiAgICB1bmlmb3JtIG1hdDMgY3ViZU1hcFJvdGF0aW9uTWF0cml4O1xuICAgIHVuaWZvcm0gdmVjMyBwcm9qZWN0ZWRTa3lkb21lQ2VudGVyO1xuXG4jZW5kaWZcblxudm9pZCBtYWluKHZvaWQpIHtcblxuICAgICNpZmRlZiBTS1lNRVNIXG5cbiAgICAgICAgLy8gZ2V0IHZlY3RvciBmcm9tIHdvcmxkIHNwYWNlIHBvcyB0byB0cmlwb2Qgb3JpZ2luXG4gICAgICAgIHZlYzMgZW52RGlyID0gbm9ybWFsaXplKHZXb3JsZFBvcyAtIHByb2plY3RlZFNreWRvbWVDZW50ZXIpO1xuICAgICAgICB2ZWMzIGRpciA9IGVudkRpciAqIGN1YmVNYXBSb3RhdGlvbk1hdHJpeDtcblxuICAgICNlbHNlXG5cbiAgICAgICAgdmVjMyBkaXIgPSB2Vmlld0RpcjtcblxuICAgICNlbmRpZlxuXG4gICAgZGlyLnggKj0gLTEuMDtcbiAgICB2ZWMzIGxpbmVhciA9ICRERUNPREUodGV4dHVyZUN1YmUodGV4dHVyZV9jdWJlTWFwLCBmaXhTZWFtc1N0YXRpYyhkaXIsICRGSVhDT05TVCkpKTtcbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGdhbW1hQ29ycmVjdE91dHB1dCh0b25lTWFwKHByb2Nlc3NFbnZpcm9ubWVudChsaW5lYXIpKSksIDEuMCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
