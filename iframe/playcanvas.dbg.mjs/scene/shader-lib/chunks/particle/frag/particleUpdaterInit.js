var particleUpdaterInitPS = /* glsl */`
varying vec2 vUv0;

uniform highp sampler2D particleTexIN;
uniform highp sampler2D internalTex0;
uniform highp sampler2D internalTex1;
uniform highp sampler2D internalTex2;
uniform highp sampler2D internalTex3;

uniform mat3 emitterMatrix, emitterMatrixInv;
uniform vec3 emitterScale;

uniform vec3 emitterPos, frameRandom, localVelocityDivMult, velocityDivMult;
uniform float delta, rate, rateDiv, lifetime, numParticles, rotSpeedDivMult, radialSpeedDivMult, seed;
uniform float startAngle, startAngle2;
uniform float initialVelocity;

uniform float graphSampleSize;
uniform float graphNumSamples;

vec3 inPos;
vec3 inVel;
float inAngle;
bool inShow;
float inLife;
float visMode;

vec3 outPos;
vec3 outVel;
float outAngle;
bool outShow;
float outLife;
`;

export { particleUpdaterInitPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVySW5pdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVVcGRhdGVySW5pdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIHBhcnRpY2xlVGV4SU47XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDA7XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDE7XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDI7XG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBpbnRlcm5hbFRleDM7XG5cbnVuaWZvcm0gbWF0MyBlbWl0dGVyTWF0cml4LCBlbWl0dGVyTWF0cml4SW52O1xudW5pZm9ybSB2ZWMzIGVtaXR0ZXJTY2FsZTtcblxudW5pZm9ybSB2ZWMzIGVtaXR0ZXJQb3MsIGZyYW1lUmFuZG9tLCBsb2NhbFZlbG9jaXR5RGl2TXVsdCwgdmVsb2NpdHlEaXZNdWx0O1xudW5pZm9ybSBmbG9hdCBkZWx0YSwgcmF0ZSwgcmF0ZURpdiwgbGlmZXRpbWUsIG51bVBhcnRpY2xlcywgcm90U3BlZWREaXZNdWx0LCByYWRpYWxTcGVlZERpdk11bHQsIHNlZWQ7XG51bmlmb3JtIGZsb2F0IHN0YXJ0QW5nbGUsIHN0YXJ0QW5nbGUyO1xudW5pZm9ybSBmbG9hdCBpbml0aWFsVmVsb2NpdHk7XG5cbnVuaWZvcm0gZmxvYXQgZ3JhcGhTYW1wbGVTaXplO1xudW5pZm9ybSBmbG9hdCBncmFwaE51bVNhbXBsZXM7XG5cbnZlYzMgaW5Qb3M7XG52ZWMzIGluVmVsO1xuZmxvYXQgaW5BbmdsZTtcbmJvb2wgaW5TaG93O1xuZmxvYXQgaW5MaWZlO1xuZmxvYXQgdmlzTW9kZTtcblxudmVjMyBvdXRQb3M7XG52ZWMzIG91dFZlbDtcbmZsb2F0IG91dEFuZ2xlO1xuYm9vbCBvdXRTaG93O1xuZmxvYXQgb3V0TGlmZTtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==