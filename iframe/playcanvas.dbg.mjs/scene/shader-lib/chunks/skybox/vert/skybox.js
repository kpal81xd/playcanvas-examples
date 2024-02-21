var skyboxVS = /* glsl */`
attribute vec3 aPosition;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform mat4 matrix_projectionSkybox;
uniform mat3 cubeMapRotationMatrix;

varying vec3 vViewDir;

#ifdef SKYMESH
    uniform mat4 matrix_model;
    varying vec3 vWorldPos;
#endif

void main(void) {

    mat4 view = matrix_view;

    #ifdef SKYMESH

        vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = matrix_projectionSkybox * view * worldPos;

    #else

        view[3][0] = view[3][1] = view[3][2] = 0.0;
        gl_Position = matrix_projectionSkybox * view * vec4(aPosition, 1.0);
        vViewDir = aPosition * cubeMapRotationMatrix;

    #endif

    // Force skybox to far Z, regardless of the clip planes on the camera
    // Subtract a tiny fudge factor to ensure floating point errors don't
    // still push pixels beyond far Z. See:
    // https://community.khronos.org/t/skybox-problem/61857

    gl_Position.z = gl_Position.w - 0.00001;
}
`;

export { skyboxVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc2t5Ym94L3ZlcnQvc2t5Ym94LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMyBhUG9zaXRpb247XG5cbiNpZm5kZWYgVklFV01BVFJJWFxuI2RlZmluZSBWSUVXTUFUUklYXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4jZW5kaWZcblxudW5pZm9ybSBtYXQ0IG1hdHJpeF9wcm9qZWN0aW9uU2t5Ym94O1xudW5pZm9ybSBtYXQzIGN1YmVNYXBSb3RhdGlvbk1hdHJpeDtcblxudmFyeWluZyB2ZWMzIHZWaWV3RGlyO1xuXG4jaWZkZWYgU0tZTUVTSFxuICAgIHVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XG4gICAgdmFyeWluZyB2ZWMzIHZXb3JsZFBvcztcbiNlbmRpZlxuXG52b2lkIG1haW4odm9pZCkge1xuXG4gICAgbWF0NCB2aWV3ID0gbWF0cml4X3ZpZXc7XG5cbiAgICAjaWZkZWYgU0tZTUVTSFxuXG4gICAgICAgIHZlYzQgd29ybGRQb3MgPSBtYXRyaXhfbW9kZWwgKiB2ZWM0KGFQb3NpdGlvbiwgMS4wKTtcbiAgICAgICAgdldvcmxkUG9zID0gd29ybGRQb3MueHl6O1xuICAgICAgICBnbF9Qb3NpdGlvbiA9IG1hdHJpeF9wcm9qZWN0aW9uU2t5Ym94ICogdmlldyAqIHdvcmxkUG9zO1xuXG4gICAgI2Vsc2VcblxuICAgICAgICB2aWV3WzNdWzBdID0gdmlld1szXVsxXSA9IHZpZXdbM11bMl0gPSAwLjA7XG4gICAgICAgIGdsX1Bvc2l0aW9uID0gbWF0cml4X3Byb2plY3Rpb25Ta3lib3ggKiB2aWV3ICogdmVjNChhUG9zaXRpb24sIDEuMCk7XG4gICAgICAgIHZWaWV3RGlyID0gYVBvc2l0aW9uICogY3ViZU1hcFJvdGF0aW9uTWF0cml4O1xuXG4gICAgI2VuZGlmXG5cbiAgICAvLyBGb3JjZSBza3lib3ggdG8gZmFyIFosIHJlZ2FyZGxlc3Mgb2YgdGhlIGNsaXAgcGxhbmVzIG9uIHRoZSBjYW1lcmFcbiAgICAvLyBTdWJ0cmFjdCBhIHRpbnkgZnVkZ2UgZmFjdG9yIHRvIGVuc3VyZSBmbG9hdGluZyBwb2ludCBlcnJvcnMgZG9uJ3RcbiAgICAvLyBzdGlsbCBwdXNoIHBpeGVscyBiZXlvbmQgZmFyIFouIFNlZTpcbiAgICAvLyBodHRwczovL2NvbW11bml0eS5raHJvbm9zLm9yZy90L3NreWJveC1wcm9ibGVtLzYxODU3XG5cbiAgICBnbF9Qb3NpdGlvbi56ID0gZ2xfUG9zaXRpb24udyAtIDAuMDAwMDE7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGVBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
