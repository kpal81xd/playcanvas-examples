import { hashCode } from '../../core/hash.js';
import { SEMANTIC_POSITION, SEMANTIC_ATTR13 } from '../../platform/graphics/constants.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { DITHER_NONE } from '../constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ShaderGenerator } from '../shader-lib/programs/shader-generator.js';
import { ShaderPass } from '../shader-pass.js';

const splatCoreVS = `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;
    uniform mat4 matrix_viewProjection;

    uniform vec2 viewport;

    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    mat3 quatToMat3(vec3 R)
    {
        float x = R.x;
        float y = R.y;
        float z = R.z;
        float w = sqrt(1.0 - dot(R, R));

        return mat3(
            1.0 - 2.0 * (z * z + w * w),
                2.0 * (y * z + x * w),
                2.0 * (y * w - x * z),

                2.0 * (y * z - x * w),
            1.0 - 2.0 * (y * y + w * w),
                2.0 * (z * w + x * y),

                2.0 * (y * w + x * z),
                2.0 * (z * w - x * y),
            1.0 - 2.0 * (y * y + z * z)
        );
    }

    uniform vec4 tex_params;
    uniform sampler2D splatColor;
    uniform highp sampler2D splatScale;
    uniform highp sampler2D splatRotation;
    uniform highp sampler2D splatCenter;

    #ifdef INT_INDICES

        attribute uint vertex_id;
        ivec2 dataUV;
        void evalDataUV() {

            // turn vertex_id into int grid coordinates
            ivec2 textureSize = ivec2(tex_params.xy);
            vec2 invTextureSize = tex_params.zw;

            int gridV = int(float(vertex_id) * invTextureSize.x);
            int gridU = int(vertex_id) - gridV * textureSize.x;
            dataUV = ivec2(gridU, gridV);
        }

        vec4 getColor() {
            return texelFetch(splatColor, dataUV, 0);
        }

        vec3 getScale() {
            return texelFetch(splatScale, dataUV, 0).xyz;
        }

        vec3 getRotation() {
            return texelFetch(splatRotation, dataUV, 0).xyz;
        }

        vec3 getCenter() {
            return texelFetch(splatCenter, dataUV, 0).xyz;
        }

    #else

        // TODO: use texture2DLodEXT on WebGL

        attribute float vertex_id;
        vec2 dataUV;
        void evalDataUV() {
            vec2 textureSize = tex_params.xy;
            vec2 invTextureSize = tex_params.zw;

            // turn vertex_id into int grid coordinates
            float gridV = floor(vertex_id * invTextureSize.x);
            float gridU = vertex_id - (gridV * textureSize.x);

            // convert grid coordinates to uv coordinates with half pixel offset
            dataUV = vec2(gridU, gridV) * invTextureSize + (0.5 * invTextureSize);
        }

        vec4 getColor() {
            return texture2D(splatColor, dataUV);
        }

        vec3 getScale() {
            return texture2D(splatScale, dataUV).xyz;
        }

        vec3 getRotation() {
            return texture2D(splatRotation, dataUV).xyz;
        }

        vec3 getCenter() {
            return texture2D(splatCenter, dataUV).xyz;
        }

    #endif

    void computeCov3d(in mat3 rot, in vec3 scale, out vec3 covA, out vec3 covB)
    {
        // M = S * R
        float M0 = scale.x * rot[0][0];
        float M1 = scale.x * rot[0][1];
        float M2 = scale.x * rot[0][2];
        float M3 = scale.y * rot[1][0];
        float M4 = scale.y * rot[1][1];
        float M5 = scale.y * rot[1][2];
        float M6 = scale.z * rot[2][0];
        float M7 = scale.z * rot[2][1];
        float M8 = scale.z * rot[2][2];

        covA = vec3(
            M0 * M0 + M3 * M3 + M6 * M6,
            M0 * M1 + M3 * M4 + M6 * M7,
            M0 * M2 + M3 * M5 + M6 * M8
        );

        covB = vec3(
            M1 * M1 + M4 * M4 + M7 * M7,
            M1 * M2 + M4 * M5 + M7 * M8,
            M2 * M2 + M5 * M5 + M8 * M8
        );
    }

    vec3 evalCenter() {
        evalDataUV();
        return getCenter();
    }

    #ifndef GL2
    #ifndef WEBGPU
    mat3 transpose(in mat3 m) {
        return mat3(
            m[0].x, m[1].x, m[2].x,
            m[0].y, m[1].y, m[2].y,
            m[0].z, m[1].z, m[2].z
        );
    }
    #endif
    #endif

    vec4 evalSplat(vec4 centerWorld)
    {
        vec4 splat_cam = matrix_view * centerWorld;
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            return vec4(0.0, 0.0, 2.0, 1.0);
        }

        vec3 scale = getScale();
        vec3 rotation = getRotation();

        color = getColor();

        #ifdef DEBUG_RENDER
            vec3 local = quatToMat3(rotation) * (vertex_position * scale * 2.0) + center;
            return matrix_viewProjection * matrix_model * vec4(local, 1.0);
        #else
            vec3 splat_cova;
            vec3 splat_covb;
            computeCov3d(mat3(matrix_model) * quatToMat3(rotation), scale, splat_cova, splat_covb);

            mat3 Vrk = mat3(
                splat_cova.x, splat_cova.y, splat_cova.z, 
                splat_cova.y, splat_covb.x, splat_covb.y,
                splat_cova.z, splat_covb.y, splat_covb.z
            );

            float focal = viewport.x * matrix_projection[0][0];

            mat3 J = mat3(
                focal / splat_cam.z, 0., -(focal * splat_cam.x) / (splat_cam.z * splat_cam.z), 
                0., focal / splat_cam.z, -(focal * splat_cam.y) / (splat_cam.z * splat_cam.z), 
                0., 0., 0.
            );

            mat3 W = transpose(mat3(matrix_view));
            mat3 T = W * J;
            mat3 cov = transpose(T) * Vrk * T;

            float diagonal1 = cov[0][0] + 0.3;
            float offDiagonal = cov[0][1];
            float diagonal2 = cov[1][1] + 0.3;

            float mid = 0.5 * (diagonal1 + diagonal2);
            float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
            float lambda1 = mid + radius;
            float lambda2 = max(mid - radius, 0.1);
            vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
            vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
            vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

            // early out tiny splats
            // TODO: figure out length units and expose as uniform parameter
            // TODO: perhaps make this a shader compile-time option
            if (dot(v1, v1) < 4.0 && dot(v2, v2) < 4.0) {
                return vec4(0.0, 0.0, 2.0, 1.0);
            }

            texCoord = vertex_position.xy * 2.0;

            return splat_proj +
                vec4((vertex_position.x * v1 + vertex_position.y * v2) / viewport * 2.0,
                    0.0, 0.0) * splat_proj.w;
        #endif

        id = float(vertex_id);
    }
`;
const splatCoreFS = /* glsl_ */`
    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat() {

        #ifdef DEBUG_RENDER

            if (color.a < 0.2) discard;
            return color;

        #else

            float A = -dot(texCoord, texCoord);
            if (A < -4.0) discard;
            float B = exp(A) * color.a;

            #ifdef PICK_PASS
                if (B < 0.3) discard;
                return(uColor);
            #endif

            #ifndef DITHER_NONE
                opacityDither(B, id * 0.013);
            #endif

            // the color here is in gamma space, so bring it to linear
            vec3 diffuse = decodeGamma(color.rgb);

            // apply tone-mapping and gamma correction as needed
            diffuse = toneMap(diffuse);
            diffuse = gammaCorrectOutput(diffuse);

            return vec4(diffuse, B);

        #endif
    }
`;
class GShaderGeneratorSplat {
  generateKey(options) {
    const vsHash = hashCode(options.vertex);
    const fsHash = hashCode(options.fragment);
    return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.debugRender}-${options.dither}}`;
  }
  createShaderDefinition(device, options) {
    const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
    const shaderPassDefines = shaderPassInfo.shaderDefines;
    const defines = shaderPassDefines + (options.debugRender ? '#define DEBUG_RENDER\n' : '') + (device.isWebGL1 ? '' : '#define INT_INDICES\n') + `#define DITHER_${options.dither.toUpperCase()}\n`;
    const vs = defines + splatCoreVS + options.vertex;
    const fs = defines + shaderChunks.decodePS + (options.dither === DITHER_NONE ? '' : shaderChunks.bayerPS + shaderChunks.opacityDitherPS) + ShaderGenerator.tonemapCode(options.toneMapping) + ShaderGenerator.gammaCode(options.gamma) + splatCoreFS + options.fragment;
    return ShaderUtils.createDefinition(device, {
      name: 'SplatShader',
      attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_id: SEMANTIC_ATTR13
      },
      vertexCode: vs,
      fragmentCode: fs
    });
  }
}
const gsplat = new GShaderGeneratorSplat();

export { gsplat };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLWdlbmVyYXRvci1nc3BsYXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9nc3BsYXQvc2hhZGVyLWdlbmVyYXRvci1nc3BsYXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaGFzaENvZGUgfSBmcm9tIFwiLi4vLi4vY29yZS9oYXNoLmpzXCI7XG5pbXBvcnQgeyBTRU1BTlRJQ19BVFRSMTMsIFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSBcIi4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXV0aWxzLmpzXCI7XG5pbXBvcnQgeyBESVRIRVJfTk9ORSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gXCIuLi9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanNcIjtcbmltcG9ydCB7IFNoYWRlckdlbmVyYXRvciB9IGZyb20gXCIuLi9zaGFkZXItbGliL3Byb2dyYW1zL3NoYWRlci1nZW5lcmF0b3IuanNcIjtcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tIFwiLi4vc2hhZGVyLXBhc3MuanNcIjtcblxuY29uc3Qgc3BsYXRDb3JlVlMgPSBgXG4gICAgYXR0cmlidXRlIHZlYzMgdmVydGV4X3Bvc2l0aW9uO1xuXG4gICAgdW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcbiAgICB1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4gICAgdW5pZm9ybSBtYXQ0IG1hdHJpeF9wcm9qZWN0aW9uO1xuICAgIHVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XG5cbiAgICB1bmlmb3JtIHZlYzIgdmlld3BvcnQ7XG5cbiAgICB2YXJ5aW5nIHZlYzIgdGV4Q29vcmQ7XG4gICAgdmFyeWluZyB2ZWM0IGNvbG9yO1xuICAgIHZhcnlpbmcgZmxvYXQgaWQ7XG5cbiAgICBtYXQzIHF1YXRUb01hdDModmVjMyBSKVxuICAgIHtcbiAgICAgICAgZmxvYXQgeCA9IFIueDtcbiAgICAgICAgZmxvYXQgeSA9IFIueTtcbiAgICAgICAgZmxvYXQgeiA9IFIuejtcbiAgICAgICAgZmxvYXQgdyA9IHNxcnQoMS4wIC0gZG90KFIsIFIpKTtcblxuICAgICAgICByZXR1cm4gbWF0MyhcbiAgICAgICAgICAgIDEuMCAtIDIuMCAqICh6ICogeiArIHcgKiB3KSxcbiAgICAgICAgICAgICAgICAyLjAgKiAoeSAqIHogKyB4ICogdyksXG4gICAgICAgICAgICAgICAgMi4wICogKHkgKiB3IC0geCAqIHopLFxuXG4gICAgICAgICAgICAgICAgMi4wICogKHkgKiB6IC0geCAqIHcpLFxuICAgICAgICAgICAgMS4wIC0gMi4wICogKHkgKiB5ICsgdyAqIHcpLFxuICAgICAgICAgICAgICAgIDIuMCAqICh6ICogdyArIHggKiB5KSxcblxuICAgICAgICAgICAgICAgIDIuMCAqICh5ICogdyArIHggKiB6KSxcbiAgICAgICAgICAgICAgICAyLjAgKiAoeiAqIHcgLSB4ICogeSksXG4gICAgICAgICAgICAxLjAgLSAyLjAgKiAoeSAqIHkgKyB6ICogeilcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICB1bmlmb3JtIHZlYzQgdGV4X3BhcmFtcztcbiAgICB1bmlmb3JtIHNhbXBsZXIyRCBzcGxhdENvbG9yO1xuICAgIHVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIHNwbGF0U2NhbGU7XG4gICAgdW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgc3BsYXRSb3RhdGlvbjtcbiAgICB1bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBzcGxhdENlbnRlcjtcblxuICAgICNpZmRlZiBJTlRfSU5ESUNFU1xuXG4gICAgICAgIGF0dHJpYnV0ZSB1aW50IHZlcnRleF9pZDtcbiAgICAgICAgaXZlYzIgZGF0YVVWO1xuICAgICAgICB2b2lkIGV2YWxEYXRhVVYoKSB7XG5cbiAgICAgICAgICAgIC8vIHR1cm4gdmVydGV4X2lkIGludG8gaW50IGdyaWQgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIGl2ZWMyIHRleHR1cmVTaXplID0gaXZlYzIodGV4X3BhcmFtcy54eSk7XG4gICAgICAgICAgICB2ZWMyIGludlRleHR1cmVTaXplID0gdGV4X3BhcmFtcy56dztcblxuICAgICAgICAgICAgaW50IGdyaWRWID0gaW50KGZsb2F0KHZlcnRleF9pZCkgKiBpbnZUZXh0dXJlU2l6ZS54KTtcbiAgICAgICAgICAgIGludCBncmlkVSA9IGludCh2ZXJ0ZXhfaWQpIC0gZ3JpZFYgKiB0ZXh0dXJlU2l6ZS54O1xuICAgICAgICAgICAgZGF0YVVWID0gaXZlYzIoZ3JpZFUsIGdyaWRWKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZlYzQgZ2V0Q29sb3IoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4ZWxGZXRjaChzcGxhdENvbG9yLCBkYXRhVVYsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgdmVjMyBnZXRTY2FsZSgpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZXhlbEZldGNoKHNwbGF0U2NhbGUsIGRhdGFVViwgMCkueHl6O1xuICAgICAgICB9XG5cbiAgICAgICAgdmVjMyBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZXhlbEZldGNoKHNwbGF0Um90YXRpb24sIGRhdGFVViwgMCkueHl6O1xuICAgICAgICB9XG5cbiAgICAgICAgdmVjMyBnZXRDZW50ZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4ZWxGZXRjaChzcGxhdENlbnRlciwgZGF0YVVWLCAwKS54eXo7XG4gICAgICAgIH1cblxuICAgICNlbHNlXG5cbiAgICAgICAgLy8gVE9ETzogdXNlIHRleHR1cmUyRExvZEVYVCBvbiBXZWJHTFxuXG4gICAgICAgIGF0dHJpYnV0ZSBmbG9hdCB2ZXJ0ZXhfaWQ7XG4gICAgICAgIHZlYzIgZGF0YVVWO1xuICAgICAgICB2b2lkIGV2YWxEYXRhVVYoKSB7XG4gICAgICAgICAgICB2ZWMyIHRleHR1cmVTaXplID0gdGV4X3BhcmFtcy54eTtcbiAgICAgICAgICAgIHZlYzIgaW52VGV4dHVyZVNpemUgPSB0ZXhfcGFyYW1zLnp3O1xuXG4gICAgICAgICAgICAvLyB0dXJuIHZlcnRleF9pZCBpbnRvIGludCBncmlkIGNvb3JkaW5hdGVzXG4gICAgICAgICAgICBmbG9hdCBncmlkViA9IGZsb29yKHZlcnRleF9pZCAqIGludlRleHR1cmVTaXplLngpO1xuICAgICAgICAgICAgZmxvYXQgZ3JpZFUgPSB2ZXJ0ZXhfaWQgLSAoZ3JpZFYgKiB0ZXh0dXJlU2l6ZS54KTtcblxuICAgICAgICAgICAgLy8gY29udmVydCBncmlkIGNvb3JkaW5hdGVzIHRvIHV2IGNvb3JkaW5hdGVzIHdpdGggaGFsZiBwaXhlbCBvZmZzZXRcbiAgICAgICAgICAgIGRhdGFVViA9IHZlYzIoZ3JpZFUsIGdyaWRWKSAqIGludlRleHR1cmVTaXplICsgKDAuNSAqIGludlRleHR1cmVTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZlYzQgZ2V0Q29sb3IoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dHVyZTJEKHNwbGF0Q29sb3IsIGRhdGFVVik7XG4gICAgICAgIH1cblxuICAgICAgICB2ZWMzIGdldFNjYWxlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRleHR1cmUyRChzcGxhdFNjYWxlLCBkYXRhVVYpLnh5ejtcbiAgICAgICAgfVxuXG4gICAgICAgIHZlYzMgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dHVyZTJEKHNwbGF0Um90YXRpb24sIGRhdGFVVikueHl6O1xuICAgICAgICB9XG5cbiAgICAgICAgdmVjMyBnZXRDZW50ZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dHVyZTJEKHNwbGF0Q2VudGVyLCBkYXRhVVYpLnh5ejtcbiAgICAgICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICB2b2lkIGNvbXB1dGVDb3YzZChpbiBtYXQzIHJvdCwgaW4gdmVjMyBzY2FsZSwgb3V0IHZlYzMgY292QSwgb3V0IHZlYzMgY292QilcbiAgICB7XG4gICAgICAgIC8vIE0gPSBTICogUlxuICAgICAgICBmbG9hdCBNMCA9IHNjYWxlLnggKiByb3RbMF1bMF07XG4gICAgICAgIGZsb2F0IE0xID0gc2NhbGUueCAqIHJvdFswXVsxXTtcbiAgICAgICAgZmxvYXQgTTIgPSBzY2FsZS54ICogcm90WzBdWzJdO1xuICAgICAgICBmbG9hdCBNMyA9IHNjYWxlLnkgKiByb3RbMV1bMF07XG4gICAgICAgIGZsb2F0IE00ID0gc2NhbGUueSAqIHJvdFsxXVsxXTtcbiAgICAgICAgZmxvYXQgTTUgPSBzY2FsZS55ICogcm90WzFdWzJdO1xuICAgICAgICBmbG9hdCBNNiA9IHNjYWxlLnogKiByb3RbMl1bMF07XG4gICAgICAgIGZsb2F0IE03ID0gc2NhbGUueiAqIHJvdFsyXVsxXTtcbiAgICAgICAgZmxvYXQgTTggPSBzY2FsZS56ICogcm90WzJdWzJdO1xuXG4gICAgICAgIGNvdkEgPSB2ZWMzKFxuICAgICAgICAgICAgTTAgKiBNMCArIE0zICogTTMgKyBNNiAqIE02LFxuICAgICAgICAgICAgTTAgKiBNMSArIE0zICogTTQgKyBNNiAqIE03LFxuICAgICAgICAgICAgTTAgKiBNMiArIE0zICogTTUgKyBNNiAqIE04XG4gICAgICAgICk7XG5cbiAgICAgICAgY292QiA9IHZlYzMoXG4gICAgICAgICAgICBNMSAqIE0xICsgTTQgKiBNNCArIE03ICogTTcsXG4gICAgICAgICAgICBNMSAqIE0yICsgTTQgKiBNNSArIE03ICogTTgsXG4gICAgICAgICAgICBNMiAqIE0yICsgTTUgKiBNNSArIE04ICogTThcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICB2ZWMzIGV2YWxDZW50ZXIoKSB7XG4gICAgICAgIGV2YWxEYXRhVVYoKTtcbiAgICAgICAgcmV0dXJuIGdldENlbnRlcigpO1xuICAgIH1cblxuICAgICNpZm5kZWYgR0wyXG4gICAgI2lmbmRlZiBXRUJHUFVcbiAgICBtYXQzIHRyYW5zcG9zZShpbiBtYXQzIG0pIHtcbiAgICAgICAgcmV0dXJuIG1hdDMoXG4gICAgICAgICAgICBtWzBdLngsIG1bMV0ueCwgbVsyXS54LFxuICAgICAgICAgICAgbVswXS55LCBtWzFdLnksIG1bMl0ueSxcbiAgICAgICAgICAgIG1bMF0ueiwgbVsxXS56LCBtWzJdLnpcbiAgICAgICAgKTtcbiAgICB9XG4gICAgI2VuZGlmXG4gICAgI2VuZGlmXG5cbiAgICB2ZWM0IGV2YWxTcGxhdCh2ZWM0IGNlbnRlcldvcmxkKVxuICAgIHtcbiAgICAgICAgdmVjNCBzcGxhdF9jYW0gPSBtYXRyaXhfdmlldyAqIGNlbnRlcldvcmxkO1xuICAgICAgICB2ZWM0IHNwbGF0X3Byb2ogPSBtYXRyaXhfcHJvamVjdGlvbiAqIHNwbGF0X2NhbTtcblxuICAgICAgICAvLyBjdWxsIGJlaGluZCBjYW1lcmFcbiAgICAgICAgaWYgKHNwbGF0X3Byb2oueiA8IC1zcGxhdF9wcm9qLncpIHtcbiAgICAgICAgICAgIHJldHVybiB2ZWM0KDAuMCwgMC4wLCAyLjAsIDEuMCk7XG4gICAgICAgIH1cblxuICAgICAgICB2ZWMzIHNjYWxlID0gZ2V0U2NhbGUoKTtcbiAgICAgICAgdmVjMyByb3RhdGlvbiA9IGdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgY29sb3IgPSBnZXRDb2xvcigpO1xuXG4gICAgICAgICNpZmRlZiBERUJVR19SRU5ERVJcbiAgICAgICAgICAgIHZlYzMgbG9jYWwgPSBxdWF0VG9NYXQzKHJvdGF0aW9uKSAqICh2ZXJ0ZXhfcG9zaXRpb24gKiBzY2FsZSAqIDIuMCkgKyBjZW50ZXI7XG4gICAgICAgICAgICByZXR1cm4gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogbWF0cml4X21vZGVsICogdmVjNChsb2NhbCwgMS4wKTtcbiAgICAgICAgI2Vsc2VcbiAgICAgICAgICAgIHZlYzMgc3BsYXRfY292YTtcbiAgICAgICAgICAgIHZlYzMgc3BsYXRfY292YjtcbiAgICAgICAgICAgIGNvbXB1dGVDb3YzZChtYXQzKG1hdHJpeF9tb2RlbCkgKiBxdWF0VG9NYXQzKHJvdGF0aW9uKSwgc2NhbGUsIHNwbGF0X2NvdmEsIHNwbGF0X2NvdmIpO1xuXG4gICAgICAgICAgICBtYXQzIFZyayA9IG1hdDMoXG4gICAgICAgICAgICAgICAgc3BsYXRfY292YS54LCBzcGxhdF9jb3ZhLnksIHNwbGF0X2NvdmEueiwgXG4gICAgICAgICAgICAgICAgc3BsYXRfY292YS55LCBzcGxhdF9jb3ZiLngsIHNwbGF0X2NvdmIueSxcbiAgICAgICAgICAgICAgICBzcGxhdF9jb3ZhLnosIHNwbGF0X2NvdmIueSwgc3BsYXRfY292Yi56XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBmbG9hdCBmb2NhbCA9IHZpZXdwb3J0LnggKiBtYXRyaXhfcHJvamVjdGlvblswXVswXTtcblxuICAgICAgICAgICAgbWF0MyBKID0gbWF0MyhcbiAgICAgICAgICAgICAgICBmb2NhbCAvIHNwbGF0X2NhbS56LCAwLiwgLShmb2NhbCAqIHNwbGF0X2NhbS54KSAvIChzcGxhdF9jYW0ueiAqIHNwbGF0X2NhbS56KSwgXG4gICAgICAgICAgICAgICAgMC4sIGZvY2FsIC8gc3BsYXRfY2FtLnosIC0oZm9jYWwgKiBzcGxhdF9jYW0ueSkgLyAoc3BsYXRfY2FtLnogKiBzcGxhdF9jYW0ueiksIFxuICAgICAgICAgICAgICAgIDAuLCAwLiwgMC5cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIG1hdDMgVyA9IHRyYW5zcG9zZShtYXQzKG1hdHJpeF92aWV3KSk7XG4gICAgICAgICAgICBtYXQzIFQgPSBXICogSjtcbiAgICAgICAgICAgIG1hdDMgY292ID0gdHJhbnNwb3NlKFQpICogVnJrICogVDtcblxuICAgICAgICAgICAgZmxvYXQgZGlhZ29uYWwxID0gY292WzBdWzBdICsgMC4zO1xuICAgICAgICAgICAgZmxvYXQgb2ZmRGlhZ29uYWwgPSBjb3ZbMF1bMV07XG4gICAgICAgICAgICBmbG9hdCBkaWFnb25hbDIgPSBjb3ZbMV1bMV0gKyAwLjM7XG5cbiAgICAgICAgICAgIGZsb2F0IG1pZCA9IDAuNSAqIChkaWFnb25hbDEgKyBkaWFnb25hbDIpO1xuICAgICAgICAgICAgZmxvYXQgcmFkaXVzID0gbGVuZ3RoKHZlYzIoKGRpYWdvbmFsMSAtIGRpYWdvbmFsMikgLyAyLjAsIG9mZkRpYWdvbmFsKSk7XG4gICAgICAgICAgICBmbG9hdCBsYW1iZGExID0gbWlkICsgcmFkaXVzO1xuICAgICAgICAgICAgZmxvYXQgbGFtYmRhMiA9IG1heChtaWQgLSByYWRpdXMsIDAuMSk7XG4gICAgICAgICAgICB2ZWMyIGRpYWdvbmFsVmVjdG9yID0gbm9ybWFsaXplKHZlYzIob2ZmRGlhZ29uYWwsIGxhbWJkYTEgLSBkaWFnb25hbDEpKTtcbiAgICAgICAgICAgIHZlYzIgdjEgPSBtaW4oc3FydCgyLjAgKiBsYW1iZGExKSwgMTAyNC4wKSAqIGRpYWdvbmFsVmVjdG9yO1xuICAgICAgICAgICAgdmVjMiB2MiA9IG1pbihzcXJ0KDIuMCAqIGxhbWJkYTIpLCAxMDI0LjApICogdmVjMihkaWFnb25hbFZlY3Rvci55LCAtZGlhZ29uYWxWZWN0b3IueCk7XG5cbiAgICAgICAgICAgIC8vIGVhcmx5IG91dCB0aW55IHNwbGF0c1xuICAgICAgICAgICAgLy8gVE9ETzogZmlndXJlIG91dCBsZW5ndGggdW5pdHMgYW5kIGV4cG9zZSBhcyB1bmlmb3JtIHBhcmFtZXRlclxuICAgICAgICAgICAgLy8gVE9ETzogcGVyaGFwcyBtYWtlIHRoaXMgYSBzaGFkZXIgY29tcGlsZS10aW1lIG9wdGlvblxuICAgICAgICAgICAgaWYgKGRvdCh2MSwgdjEpIDwgNC4wICYmIGRvdCh2MiwgdjIpIDwgNC4wKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZlYzQoMC4wLCAwLjAsIDIuMCwgMS4wKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGV4Q29vcmQgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkgKiAyLjA7XG5cbiAgICAgICAgICAgIHJldHVybiBzcGxhdF9wcm9qICtcbiAgICAgICAgICAgICAgICB2ZWM0KCh2ZXJ0ZXhfcG9zaXRpb24ueCAqIHYxICsgdmVydGV4X3Bvc2l0aW9uLnkgKiB2MikgLyB2aWV3cG9ydCAqIDIuMCxcbiAgICAgICAgICAgICAgICAgICAgMC4wLCAwLjApICogc3BsYXRfcHJvai53O1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICBpZCA9IGZsb2F0KHZlcnRleF9pZCk7XG4gICAgfVxuYDtcblxuY29uc3Qgc3BsYXRDb3JlRlMgPSAvKiBnbHNsXyAqLyBgXG4gICAgdmFyeWluZyB2ZWMyIHRleENvb3JkO1xuICAgIHZhcnlpbmcgdmVjNCBjb2xvcjtcbiAgICB2YXJ5aW5nIGZsb2F0IGlkO1xuXG4gICAgI2lmZGVmIFBJQ0tfUEFTU1xuICAgICAgICB1bmlmb3JtIHZlYzQgdUNvbG9yO1xuICAgICNlbmRpZlxuXG4gICAgdmVjNCBldmFsU3BsYXQoKSB7XG5cbiAgICAgICAgI2lmZGVmIERFQlVHX1JFTkRFUlxuXG4gICAgICAgICAgICBpZiAoY29sb3IuYSA8IDAuMikgZGlzY2FyZDtcbiAgICAgICAgICAgIHJldHVybiBjb2xvcjtcblxuICAgICAgICAjZWxzZVxuXG4gICAgICAgICAgICBmbG9hdCBBID0gLWRvdCh0ZXhDb29yZCwgdGV4Q29vcmQpO1xuICAgICAgICAgICAgaWYgKEEgPCAtNC4wKSBkaXNjYXJkO1xuICAgICAgICAgICAgZmxvYXQgQiA9IGV4cChBKSAqIGNvbG9yLmE7XG5cbiAgICAgICAgICAgICNpZmRlZiBQSUNLX1BBU1NcbiAgICAgICAgICAgICAgICBpZiAoQiA8IDAuMykgZGlzY2FyZDtcbiAgICAgICAgICAgICAgICByZXR1cm4odUNvbG9yKTtcbiAgICAgICAgICAgICNlbmRpZlxuXG4gICAgICAgICAgICAjaWZuZGVmIERJVEhFUl9OT05FXG4gICAgICAgICAgICAgICAgb3BhY2l0eURpdGhlcihCLCBpZCAqIDAuMDEzKTtcbiAgICAgICAgICAgICNlbmRpZlxuXG4gICAgICAgICAgICAvLyB0aGUgY29sb3IgaGVyZSBpcyBpbiBnYW1tYSBzcGFjZSwgc28gYnJpbmcgaXQgdG8gbGluZWFyXG4gICAgICAgICAgICB2ZWMzIGRpZmZ1c2UgPSBkZWNvZGVHYW1tYShjb2xvci5yZ2IpO1xuXG4gICAgICAgICAgICAvLyBhcHBseSB0b25lLW1hcHBpbmcgYW5kIGdhbW1hIGNvcnJlY3Rpb24gYXMgbmVlZGVkXG4gICAgICAgICAgICBkaWZmdXNlID0gdG9uZU1hcChkaWZmdXNlKTtcbiAgICAgICAgICAgIGRpZmZ1c2UgPSBnYW1tYUNvcnJlY3RPdXRwdXQoZGlmZnVzZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB2ZWM0KGRpZmZ1c2UsIEIpO1xuXG4gICAgICAgICNlbmRpZlxuICAgIH1cbmA7XG5cbmNsYXNzIEdTaGFkZXJHZW5lcmF0b3JTcGxhdCB7XG4gICAgZ2VuZXJhdGVLZXkob3B0aW9ucykge1xuICAgICAgICBjb25zdCB2c0hhc2ggPSBoYXNoQ29kZShvcHRpb25zLnZlcnRleCk7XG4gICAgICAgIGNvbnN0IGZzSGFzaCA9IGhhc2hDb2RlKG9wdGlvbnMuZnJhZ21lbnQpO1xuICAgICAgICByZXR1cm4gYHNwbGF0LSR7b3B0aW9ucy5wYXNzfS0ke29wdGlvbnMuZ2FtbWF9LSR7b3B0aW9ucy50b25lTWFwcGluZ30tJHt2c0hhc2h9LSR7ZnNIYXNofS0ke29wdGlvbnMuZGVidWdSZW5kZXJ9LSR7b3B0aW9ucy5kaXRoZXJ9fWA7XG4gICAgfVxuXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbihkZXZpY2UsIG9wdGlvbnMpIHtcblxuICAgICAgICBjb25zdCBzaGFkZXJQYXNzSW5mbyA9IFNoYWRlclBhc3MuZ2V0KGRldmljZSkuZ2V0QnlJbmRleChvcHRpb25zLnBhc3MpO1xuICAgICAgICBjb25zdCBzaGFkZXJQYXNzRGVmaW5lcyA9IHNoYWRlclBhc3NJbmZvLnNoYWRlckRlZmluZXM7XG5cbiAgICAgICAgY29uc3QgZGVmaW5lcyA9XG4gICAgICAgICAgICBzaGFkZXJQYXNzRGVmaW5lcyArXG4gICAgICAgICAgICAob3B0aW9ucy5kZWJ1Z1JlbmRlciA/ICcjZGVmaW5lIERFQlVHX1JFTkRFUlxcbicgOiAnJykgK1xuICAgICAgICAgICAgKGRldmljZS5pc1dlYkdMMSA/ICcnIDogJyNkZWZpbmUgSU5UX0lORElDRVNcXG4nKSArXG4gICAgICAgICAgICBgI2RlZmluZSBESVRIRVJfJHtvcHRpb25zLmRpdGhlci50b1VwcGVyQ2FzZSgpfVxcbmA7XG5cbiAgICAgICAgY29uc3QgdnMgPSBkZWZpbmVzICsgc3BsYXRDb3JlVlMgKyBvcHRpb25zLnZlcnRleDtcbiAgICAgICAgY29uc3QgZnMgPSBkZWZpbmVzICsgc2hhZGVyQ2h1bmtzLmRlY29kZVBTICtcbiAgICAgICAgICAgIChvcHRpb25zLmRpdGhlciA9PT0gRElUSEVSX05PTkUgPyAnJyA6IHNoYWRlckNodW5rcy5iYXllclBTICsgc2hhZGVyQ2h1bmtzLm9wYWNpdHlEaXRoZXJQUykgK1xuICAgICAgICAgICAgU2hhZGVyR2VuZXJhdG9yLnRvbmVtYXBDb2RlKG9wdGlvbnMudG9uZU1hcHBpbmcpICtcbiAgICAgICAgICAgIFNoYWRlckdlbmVyYXRvci5nYW1tYUNvZGUob3B0aW9ucy5nYW1tYSkgK1xuICAgICAgICAgICAgc3BsYXRDb3JlRlMgKyBvcHRpb25zLmZyYWdtZW50O1xuXG4gICAgICAgIHJldHVybiBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogJ1NwbGF0U2hhZGVyJyxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhfcG9zaXRpb246IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICAgICAgICAgICAgIHZlcnRleF9pZDogU0VNQU5USUNfQVRUUjEzXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmVydGV4Q29kZTogdnMsXG4gICAgICAgICAgICBmcmFnbWVudENvZGU6IGZzXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuY29uc3QgZ3NwbGF0ID0gbmV3IEdTaGFkZXJHZW5lcmF0b3JTcGxhdCgpO1xuXG5leHBvcnQgeyBnc3BsYXQgfTtcbiJdLCJuYW1lcyI6WyJzcGxhdENvcmVWUyIsInNwbGF0Q29yZUZTIiwiR1NoYWRlckdlbmVyYXRvclNwbGF0IiwiZ2VuZXJhdGVLZXkiLCJvcHRpb25zIiwidnNIYXNoIiwiaGFzaENvZGUiLCJ2ZXJ0ZXgiLCJmc0hhc2giLCJmcmFnbWVudCIsInBhc3MiLCJnYW1tYSIsInRvbmVNYXBwaW5nIiwiZGVidWdSZW5kZXIiLCJkaXRoZXIiLCJjcmVhdGVTaGFkZXJEZWZpbml0aW9uIiwiZGV2aWNlIiwic2hhZGVyUGFzc0luZm8iLCJTaGFkZXJQYXNzIiwiZ2V0IiwiZ2V0QnlJbmRleCIsInNoYWRlclBhc3NEZWZpbmVzIiwic2hhZGVyRGVmaW5lcyIsImRlZmluZXMiLCJpc1dlYkdMMSIsInRvVXBwZXJDYXNlIiwidnMiLCJmcyIsInNoYWRlckNodW5rcyIsImRlY29kZVBTIiwiRElUSEVSX05PTkUiLCJiYXllclBTIiwib3BhY2l0eURpdGhlclBTIiwiU2hhZGVyR2VuZXJhdG9yIiwidG9uZW1hcENvZGUiLCJnYW1tYUNvZGUiLCJTaGFkZXJVdGlscyIsImNyZWF0ZURlZmluaXRpb24iLCJuYW1lIiwiYXR0cmlidXRlcyIsInZlcnRleF9wb3NpdGlvbiIsIlNFTUFOVElDX1BPU0lUSU9OIiwidmVydGV4X2lkIiwiU0VNQU5USUNfQVRUUjEzIiwidmVydGV4Q29kZSIsImZyYWdtZW50Q29kZSIsImdzcGxhdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFRQSxNQUFNQSxXQUFXLEdBQUksQ0FBQTtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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
