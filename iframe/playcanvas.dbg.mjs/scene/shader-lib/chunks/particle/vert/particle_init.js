var particle_initVS = /* glsl */`
attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor
#ifdef USE_MESH
attribute vec2 particle_uv;         // mesh UV
#endif

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform float numParticles, numParticlesPot;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float stretch;
uniform vec3 wrapBounds;
uniform vec3 emitterScale, emitterPos, faceTangent, faceBinorm;
uniform float rate, rateDiv, lifetime, deltaRandomnessStatic, scaleDivMult, alphaDivMult, seed, delta;
uniform sampler2D particleTexOUT, particleTexIN;
uniform highp sampler2D internalTex0;
uniform highp sampler2D internalTex1;
uniform highp sampler2D internalTex2;

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params;
#endif

varying vec4 texCoordsAlphaLife;

vec3 inPos;
vec3 inVel;
float inAngle;
bool inShow;
float inLife;
`;

export { particle_initVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfaW5pdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfaW5pdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuYXR0cmlidXRlIHZlYzQgcGFydGljbGVfdmVydGV4RGF0YTsgLy8gWFlaID0gcGFydGljbGUgcG9zaXRpb24sIFcgPSBwYXJ0aWNsZSBJRCArIHJhbmRvbSBmYWN0b3JcbiNpZmRlZiBVU0VfTUVTSFxuYXR0cmlidXRlIHZlYzIgcGFydGljbGVfdXY7ICAgICAgICAgLy8gbWVzaCBVVlxuI2VuZGlmXG5cbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XG51bmlmb3JtIG1hdDQgbWF0cml4X21vZGVsO1xudW5pZm9ybSBtYXQzIG1hdHJpeF9ub3JtYWw7XG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdJbnZlcnNlO1xuXG4jaWZuZGVmIFZJRVdNQVRSSVhcbiNkZWZpbmUgVklFV01BVFJJWFxudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xuI2VuZGlmXG5cbnVuaWZvcm0gZmxvYXQgbnVtUGFydGljbGVzLCBudW1QYXJ0aWNsZXNQb3Q7XG51bmlmb3JtIGZsb2F0IGdyYXBoU2FtcGxlU2l6ZTtcbnVuaWZvcm0gZmxvYXQgZ3JhcGhOdW1TYW1wbGVzO1xudW5pZm9ybSBmbG9hdCBzdHJldGNoO1xudW5pZm9ybSB2ZWMzIHdyYXBCb3VuZHM7XG51bmlmb3JtIHZlYzMgZW1pdHRlclNjYWxlLCBlbWl0dGVyUG9zLCBmYWNlVGFuZ2VudCwgZmFjZUJpbm9ybTtcbnVuaWZvcm0gZmxvYXQgcmF0ZSwgcmF0ZURpdiwgbGlmZXRpbWUsIGRlbHRhUmFuZG9tbmVzc1N0YXRpYywgc2NhbGVEaXZNdWx0LCBhbHBoYURpdk11bHQsIHNlZWQsIGRlbHRhO1xudW5pZm9ybSBzYW1wbGVyMkQgcGFydGljbGVUZXhPVVQsIHBhcnRpY2xlVGV4SU47XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDA7XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDE7XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDI7XG5cbiNpZm5kZWYgQ0FNRVJBUExBTkVTXG4jZGVmaW5lIENBTUVSQVBMQU5FU1xudW5pZm9ybSB2ZWM0IGNhbWVyYV9wYXJhbXM7XG4jZW5kaWZcblxudmFyeWluZyB2ZWM0IHRleENvb3Jkc0FscGhhTGlmZTtcblxudmVjMyBpblBvcztcbnZlYzMgaW5WZWw7XG5mbG9hdCBpbkFuZ2xlO1xuYm9vbCBpblNob3c7XG5mbG9hdCBpbkxpZmU7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
