import decodePS from './decode.js';
import encodePS from './encode.js';

var reprojectPS = /* glsl */`
// This shader requires the following #DEFINEs:
//
// PROCESS_FUNC - must be one of reproject, prefilter
// DECODE_FUNC - must be one of decodeRGBM, decodeRGBE, decodeGamma or decodeLinear
// ENCODE_FUNC - must be one of encodeRGBM, encodeRGBE, encideGamma or encodeLinear
// SOURCE_FUNC - must be one of sampleCubemap, sampleEquirect, sampleOctahedral
// TARGET_FUNC - must be one of getDirectionCubemap, getDirectionEquirect, getDirectionOctahedral
//
// When filtering:
// NUM_SAMPLES - number of samples
// NUM_SAMPLES_SQRT - sqrt of number of samples

varying vec2 vUv0;

// source
#ifdef CUBEMAP_SOURCE
    uniform samplerCube sourceCube;
#else
    uniform sampler2D sourceTex;
#endif

#ifdef USE_SAMPLES_TEX
    // samples
    uniform sampler2D samplesTex;
    uniform vec2 samplesTexInverseSize;
#endif

// params:
// x - target cubemap face 0..6
// y - specular power (when prefiltering)
// z - source cubemap seam scale (0 to disable)
// w - target cubemap size for seam calc (0 to disable)
uniform vec4 params;

// params2:
// x - target image total pixels
// y - source cubemap size
uniform vec2 params2;

float targetFace() { return params.x; }
float specularPower() { return params.y; }
float sourceCubeSeamScale() { return params.z; }
float targetCubeSeamScale() { return params.w; }

float targetTotalPixels() { return params2.x; }
float sourceTotalPixels() { return params2.y; }

float PI = 3.141592653589793;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

${decodePS}
${encodePS}

//-- supported projections

vec3 modifySeams(vec3 dir, float scale) {
    vec3 adir = abs(dir);
    float M = max(max(adir.x, adir.y), adir.z);
    return dir / M * vec3(
        adir.x == M ? 1.0 : scale,
        adir.y == M ? 1.0 : scale,
        adir.z == M ? 1.0 : scale
    );
}

vec2 toSpherical(vec3 dir) {
    return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec3 fromSpherical(vec2 uv) {
    return vec3(cos(uv.y) * sin(uv.x),
                sin(uv.y),
                cos(uv.y) * cos(uv.x));
}

vec3 getDirectionEquirect() {
    return fromSpherical((vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0) * vec2(PI, PI * 0.5));
}

// octahedral code, based on https://jcgt.org/published/0003/02/01/
// "Survey of Efficient Representations for Independent Unit Vectors" by Cigolle, Donow, Evangelakos, Mara, McGuire, Meyer

float signNotZero(float k){
    return(k >= 0.0) ? 1.0 : -1.0;
}

vec2 signNotZero(vec2 v) {
    return vec2(signNotZero(v.x), signNotZero(v.y));
}

// Returns a unit vector. Argument o is an octahedral vector packed via octEncode, on the [-1, +1] square
vec3 octDecode(vec2 o) {
    vec3 v = vec3(o.x, 1.0 - abs(o.x) - abs(o.y), o.y);
    if (v.y < 0.0) {
        v.xz = (1.0 - abs(v.zx)) * signNotZero(v.xz);
    }
    return normalize(v);
}

vec3 getDirectionOctahedral() {
    return octDecode(vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0);
}

// Assumes that v is a unit vector. The result is an octahedral vector on the [-1, +1] square
vec2 octEncode(in vec3 v) {
    float l1norm = abs(v.x) + abs(v.y) + abs(v.z);
    vec2 result = v.xz * (1.0 / l1norm);
    if (v.y < 0.0) {
        result = (1.0 - abs(result.yx)) * signNotZero(result.xy);
    }
    return result;
}

/////////////////////////////////////////////////////////////////////

#ifdef CUBEMAP_SOURCE
    vec4 sampleCubemap(vec3 dir) {
        return textureCube(sourceCube, modifySeams(dir, 1.0 - sourceCubeSeamScale()));
    }

    vec4 sampleCubemap(vec2 sph) {
    return sampleCubemap(fromSpherical(sph));
}

    vec4 sampleCubemap(vec3 dir, float mipLevel) {
        return textureCubeLodEXT(sourceCube, modifySeams(dir, 1.0 - exp2(mipLevel) * sourceCubeSeamScale()), mipLevel);
    }

    vec4 sampleCubemap(vec2 sph, float mipLevel) {
        return sampleCubemap(fromSpherical(sph), mipLevel);
    }
#else

    vec4 sampleEquirect(vec2 sph) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
    }

    vec4 sampleEquirect(vec3 dir) {
        return sampleEquirect(toSpherical(dir));
    }

    vec4 sampleEquirect(vec2 sph, float mipLevel) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleEquirect(vec3 dir, float mipLevel) {
        return sampleEquirect(toSpherical(dir), mipLevel);
    }

    vec4 sampleOctahedral(vec3 dir) {
        vec2 uv = octEncode(dir) * 0.5 + 0.5;
        return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
    }

    vec4 sampleOctahedral(vec2 sph) {
        return sampleOctahedral(fromSpherical(sph));
    }

    vec4 sampleOctahedral(vec3 dir, float mipLevel) {
        vec2 uv = octEncode(dir) * 0.5 + 0.5;
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleOctahedral(vec2 sph, float mipLevel) {
        return sampleOctahedral(fromSpherical(sph), mipLevel);
    }

#endif

vec3 getDirectionCubemap() {
    vec2 st = vUv0 * 2.0 - 1.0;
    float face = targetFace();

    vec3 vec;
    if (face == 0.0) {
        vec = vec3(1, -st.y, -st.x);
    } else if (face == 1.0) {
        vec = vec3(-1, -st.y, st.x);
    } else if (face == 2.0) {
        vec = vec3(st.x, 1, st.y);
    } else if (face == 3.0) {
        vec = vec3(st.x, -1, -st.y);
    } else if (face == 4.0) {
        vec = vec3(st.x, -st.y, 1);
    } else {
        vec = vec3(-st.x, -st.y, -1);
    }

    return normalize(modifySeams(vec, 1.0 / (1.0 - targetCubeSeamScale())));
}

mat3 matrixFromVector(vec3 n) { // frisvad
    float a = 1.0 / (1.0 + n.z);
    float b = -n.x * n.y * a;
    vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
    return mat3(b1, b2, n);
}

mat3 matrixFromVectorSlow(vec3 n) {
    vec3 up = (1.0 - abs(n.y) <= 0.0000001) ? vec3(0.0, 0.0, n.y > 0.0 ? 1.0 : -1.0) : vec3(0.0, 1.0, 0.0);
    vec3 x = normalize(cross(up, n));
    vec3 y = cross(n, x);
    return mat3(x, y, n);
}

vec4 reproject() {
    if (NUM_SAMPLES <= 1) {
        // single sample
        return ENCODE_FUNC(DECODE_FUNC(SOURCE_FUNC(TARGET_FUNC())));
    } else {
        // multi sample
        vec3 t = TARGET_FUNC();
        vec3 tu = dFdx(t);
        vec3 tv = dFdy(t);

        vec3 result = vec3(0.0);
        for (float u = 0.0; u < NUM_SAMPLES_SQRT; ++u) {
            for (float v = 0.0; v < NUM_SAMPLES_SQRT; ++v) {
                result += DECODE_FUNC(SOURCE_FUNC(normalize(t +
                                                            tu * (u / NUM_SAMPLES_SQRT - 0.5) +
                                                            tv * (v / NUM_SAMPLES_SQRT - 0.5))));
            }
        }
        return ENCODE_FUNC(result / (NUM_SAMPLES_SQRT * NUM_SAMPLES_SQRT));
    }
}

vec4 unpackFloat = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);

#ifdef USE_SAMPLES_TEX
    void unpackSample(int i, out vec3 L, out float mipLevel) {
        float u = (float(i * 4) + 0.5) * samplesTexInverseSize.x;
        float v = (floor(u) + 0.5) * samplesTexInverseSize.y;

        vec4 raw;
        raw.x = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.y = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.z = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.w = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat);

        L.xyz = raw.xyz * 2.0 - 1.0;
        mipLevel = raw.w * 8.0;
    }

    // convolve an environment given pre-generated samples
    vec4 prefilterSamples() {
        // construct vector space given target direction
        mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

        vec3 L;
        float mipLevel;

        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = 0; i < NUM_SAMPLES; ++i) {
            unpackSample(i, L, mipLevel);
            result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel)) * L.z;
            totalWeight += L.z;
        }

        return ENCODE_FUNC(result / totalWeight);
    }

    // unweighted version of prefilterSamples
    vec4 prefilterSamplesUnweighted() {
        // construct vector space given target direction
        mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

        vec3 L;
        float mipLevel;

        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = 0; i < NUM_SAMPLES; ++i) {
            unpackSample(i, L, mipLevel);
            result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel));
        }

        return ENCODE_FUNC(result / float(NUM_SAMPLES));
    }
#endif

void main(void) {
    gl_FragColor = PROCESS_FUNC();
}
`;

export { reprojectPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvcmVwcm9qZWN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkZWNvZGUgZnJvbSAnLi9kZWNvZGUuanMnO1xuaW1wb3J0IGVuY29kZSBmcm9tICcuL2VuY29kZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBUaGlzIHNoYWRlciByZXF1aXJlcyB0aGUgZm9sbG93aW5nICNERUZJTkVzOlxuLy9cbi8vIFBST0NFU1NfRlVOQyAtIG11c3QgYmUgb25lIG9mIHJlcHJvamVjdCwgcHJlZmlsdGVyXG4vLyBERUNPREVfRlVOQyAtIG11c3QgYmUgb25lIG9mIGRlY29kZVJHQk0sIGRlY29kZVJHQkUsIGRlY29kZUdhbW1hIG9yIGRlY29kZUxpbmVhclxuLy8gRU5DT0RFX0ZVTkMgLSBtdXN0IGJlIG9uZSBvZiBlbmNvZGVSR0JNLCBlbmNvZGVSR0JFLCBlbmNpZGVHYW1tYSBvciBlbmNvZGVMaW5lYXJcbi8vIFNPVVJDRV9GVU5DIC0gbXVzdCBiZSBvbmUgb2Ygc2FtcGxlQ3ViZW1hcCwgc2FtcGxlRXF1aXJlY3QsIHNhbXBsZU9jdGFoZWRyYWxcbi8vIFRBUkdFVF9GVU5DIC0gbXVzdCBiZSBvbmUgb2YgZ2V0RGlyZWN0aW9uQ3ViZW1hcCwgZ2V0RGlyZWN0aW9uRXF1aXJlY3QsIGdldERpcmVjdGlvbk9jdGFoZWRyYWxcbi8vXG4vLyBXaGVuIGZpbHRlcmluZzpcbi8vIE5VTV9TQU1QTEVTIC0gbnVtYmVyIG9mIHNhbXBsZXNcbi8vIE5VTV9TQU1QTEVTX1NRUlQgLSBzcXJ0IG9mIG51bWJlciBvZiBzYW1wbGVzXG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG4vLyBzb3VyY2VcbiNpZmRlZiBDVUJFTUFQX1NPVVJDRVxuICAgIHVuaWZvcm0gc2FtcGxlckN1YmUgc291cmNlQ3ViZTtcbiNlbHNlXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgc291cmNlVGV4O1xuI2VuZGlmXG5cbiNpZmRlZiBVU0VfU0FNUExFU19URVhcbiAgICAvLyBzYW1wbGVzXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgc2FtcGxlc1RleDtcbiAgICB1bmlmb3JtIHZlYzIgc2FtcGxlc1RleEludmVyc2VTaXplO1xuI2VuZGlmXG5cbi8vIHBhcmFtczpcbi8vIHggLSB0YXJnZXQgY3ViZW1hcCBmYWNlIDAuLjZcbi8vIHkgLSBzcGVjdWxhciBwb3dlciAod2hlbiBwcmVmaWx0ZXJpbmcpXG4vLyB6IC0gc291cmNlIGN1YmVtYXAgc2VhbSBzY2FsZSAoMCB0byBkaXNhYmxlKVxuLy8gdyAtIHRhcmdldCBjdWJlbWFwIHNpemUgZm9yIHNlYW0gY2FsYyAoMCB0byBkaXNhYmxlKVxudW5pZm9ybSB2ZWM0IHBhcmFtcztcblxuLy8gcGFyYW1zMjpcbi8vIHggLSB0YXJnZXQgaW1hZ2UgdG90YWwgcGl4ZWxzXG4vLyB5IC0gc291cmNlIGN1YmVtYXAgc2l6ZVxudW5pZm9ybSB2ZWMyIHBhcmFtczI7XG5cbmZsb2F0IHRhcmdldEZhY2UoKSB7IHJldHVybiBwYXJhbXMueDsgfVxuZmxvYXQgc3BlY3VsYXJQb3dlcigpIHsgcmV0dXJuIHBhcmFtcy55OyB9XG5mbG9hdCBzb3VyY2VDdWJlU2VhbVNjYWxlKCkgeyByZXR1cm4gcGFyYW1zLno7IH1cbmZsb2F0IHRhcmdldEN1YmVTZWFtU2NhbGUoKSB7IHJldHVybiBwYXJhbXMudzsgfVxuXG5mbG9hdCB0YXJnZXRUb3RhbFBpeGVscygpIHsgcmV0dXJuIHBhcmFtczIueDsgfVxuZmxvYXQgc291cmNlVG90YWxQaXhlbHMoKSB7IHJldHVybiBwYXJhbXMyLnk7IH1cblxuZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbiR7ZGVjb2RlfVxuJHtlbmNvZGV9XG5cbi8vLS0gc3VwcG9ydGVkIHByb2plY3Rpb25zXG5cbnZlYzMgbW9kaWZ5U2VhbXModmVjMyBkaXIsIGZsb2F0IHNjYWxlKSB7XG4gICAgdmVjMyBhZGlyID0gYWJzKGRpcik7XG4gICAgZmxvYXQgTSA9IG1heChtYXgoYWRpci54LCBhZGlyLnkpLCBhZGlyLnopO1xuICAgIHJldHVybiBkaXIgLyBNICogdmVjMyhcbiAgICAgICAgYWRpci54ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci55ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci56ID09IE0gPyAxLjAgOiBzY2FsZVxuICAgICk7XG59XG5cbnZlYzIgdG9TcGhlcmljYWwodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gdmVjMihkaXIueHogPT0gdmVjMigwLjApID8gMC4wIDogYXRhbihkaXIueCwgZGlyLnopLCBhc2luKGRpci55KSk7XG59XG5cbnZlYzMgZnJvbVNwaGVyaWNhbCh2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIHZlYzMoY29zKHV2LnkpICogc2luKHV2LngpLFxuICAgICAgICAgICAgICAgIHNpbih1di55KSxcbiAgICAgICAgICAgICAgICBjb3ModXYueSkgKiBjb3ModXYueCkpO1xufVxuXG52ZWMzIGdldERpcmVjdGlvbkVxdWlyZWN0KCkge1xuICAgIHJldHVybiBmcm9tU3BoZXJpY2FsKCh2ZWMyKHZVdjAueCwgMS4wIC0gdlV2MC55KSAqIDIuMCAtIDEuMCkgKiB2ZWMyKFBJLCBQSSAqIDAuNSkpO1xufVxuXG4vLyBvY3RhaGVkcmFsIGNvZGUsIGJhc2VkIG9uIGh0dHBzOi8vamNndC5vcmcvcHVibGlzaGVkLzAwMDMvMDIvMDEvXG4vLyBcIlN1cnZleSBvZiBFZmZpY2llbnQgUmVwcmVzZW50YXRpb25zIGZvciBJbmRlcGVuZGVudCBVbml0IFZlY3RvcnNcIiBieSBDaWdvbGxlLCBEb25vdywgRXZhbmdlbGFrb3MsIE1hcmEsIE1jR3VpcmUsIE1leWVyXG5cbmZsb2F0IHNpZ25Ob3RaZXJvKGZsb2F0IGspe1xuICAgIHJldHVybihrID49IDAuMCkgPyAxLjAgOiAtMS4wO1xufVxuXG52ZWMyIHNpZ25Ob3RaZXJvKHZlYzIgdikge1xuICAgIHJldHVybiB2ZWMyKHNpZ25Ob3RaZXJvKHYueCksIHNpZ25Ob3RaZXJvKHYueSkpO1xufVxuXG4vLyBSZXR1cm5zIGEgdW5pdCB2ZWN0b3IuIEFyZ3VtZW50IG8gaXMgYW4gb2N0YWhlZHJhbCB2ZWN0b3IgcGFja2VkIHZpYSBvY3RFbmNvZGUsIG9uIHRoZSBbLTEsICsxXSBzcXVhcmVcbnZlYzMgb2N0RGVjb2RlKHZlYzIgbykge1xuICAgIHZlYzMgdiA9IHZlYzMoby54LCAxLjAgLSBhYnMoby54KSAtIGFicyhvLnkpLCBvLnkpO1xuICAgIGlmICh2LnkgPCAwLjApIHtcbiAgICAgICAgdi54eiA9ICgxLjAgLSBhYnModi56eCkpICogc2lnbk5vdFplcm8odi54eik7XG4gICAgfVxuICAgIHJldHVybiBub3JtYWxpemUodik7XG59XG5cbnZlYzMgZ2V0RGlyZWN0aW9uT2N0YWhlZHJhbCgpIHtcbiAgICByZXR1cm4gb2N0RGVjb2RlKHZlYzIodlV2MC54LCAxLjAgLSB2VXYwLnkpICogMi4wIC0gMS4wKTtcbn1cblxuLy8gQXNzdW1lcyB0aGF0IHYgaXMgYSB1bml0IHZlY3Rvci4gVGhlIHJlc3VsdCBpcyBhbiBvY3RhaGVkcmFsIHZlY3RvciBvbiB0aGUgWy0xLCArMV0gc3F1YXJlXG52ZWMyIG9jdEVuY29kZShpbiB2ZWMzIHYpIHtcbiAgICBmbG9hdCBsMW5vcm0gPSBhYnModi54KSArIGFicyh2LnkpICsgYWJzKHYueik7XG4gICAgdmVjMiByZXN1bHQgPSB2Lnh6ICogKDEuMCAvIGwxbm9ybSk7XG4gICAgaWYgKHYueSA8IDAuMCkge1xuICAgICAgICByZXN1bHQgPSAoMS4wIC0gYWJzKHJlc3VsdC55eCkpICogc2lnbk5vdFplcm8ocmVzdWx0Lnh5KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiNpZmRlZiBDVUJFTUFQX1NPVVJDRVxuICAgIHZlYzQgc2FtcGxlQ3ViZW1hcCh2ZWMzIGRpcikge1xuICAgICAgICByZXR1cm4gdGV4dHVyZUN1YmUoc291cmNlQ3ViZSwgbW9kaWZ5U2VhbXMoZGlyLCAxLjAgLSBzb3VyY2VDdWJlU2VhbVNjYWxlKCkpKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUN1YmVtYXAodmVjMiBzcGgpIHtcbiAgICByZXR1cm4gc2FtcGxlQ3ViZW1hcChmcm9tU3BoZXJpY2FsKHNwaCkpO1xufVxuXG4gICAgdmVjNCBzYW1wbGVDdWJlbWFwKHZlYzMgZGlyLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgICAgICByZXR1cm4gdGV4dHVyZUN1YmVMb2RFWFQoc291cmNlQ3ViZSwgbW9kaWZ5U2VhbXMoZGlyLCAxLjAgLSBleHAyKG1pcExldmVsKSAqIHNvdXJjZUN1YmVTZWFtU2NhbGUoKSksIG1pcExldmVsKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUN1YmVtYXAodmVjMiBzcGgsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgICAgIHJldHVybiBzYW1wbGVDdWJlbWFwKGZyb21TcGhlcmljYWwoc3BoKSwgbWlwTGV2ZWwpO1xuICAgIH1cbiNlbHNlXG5cbiAgICB2ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzIgc3BoKSB7XG4gICAgICAgIHZlYzIgdXYgPSBzcGggLyB2ZWMyKFBJICogMi4wLCBQSSkgKyAwLjU7XG4gICAgICAgIHJldHVybiB0ZXh0dXJlMkQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzMgZGlyKSB7XG4gICAgICAgIHJldHVybiBzYW1wbGVFcXVpcmVjdCh0b1NwaGVyaWNhbChkaXIpKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzIgc3BoLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgICAgICB2ZWMyIHV2ID0gc3BoIC8gdmVjMihQSSAqIDIuMCwgUEkpICsgMC41O1xuICAgICAgICByZXR1cm4gdGV4dHVyZTJETG9kRVhUKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSwgbWlwTGV2ZWwpO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlRXF1aXJlY3QodmVjMyBkaXIsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgICAgIHJldHVybiBzYW1wbGVFcXVpcmVjdCh0b1NwaGVyaWNhbChkaXIpLCBtaXBMZXZlbCk7XG4gICAgfVxuXG4gICAgdmVjNCBzYW1wbGVPY3RhaGVkcmFsKHZlYzMgZGlyKSB7XG4gICAgICAgIHZlYzIgdXYgPSBvY3RFbmNvZGUoZGlyKSAqIDAuNSArIDAuNTtcbiAgICAgICAgcmV0dXJuIHRleHR1cmUyRChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSkpO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlT2N0YWhlZHJhbCh2ZWMyIHNwaCkge1xuICAgICAgICByZXR1cm4gc2FtcGxlT2N0YWhlZHJhbChmcm9tU3BoZXJpY2FsKHNwaCkpO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlT2N0YWhlZHJhbCh2ZWMzIGRpciwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICAgICAgdmVjMiB1diA9IG9jdEVuY29kZShkaXIpICogMC41ICsgMC41O1xuICAgICAgICByZXR1cm4gdGV4dHVyZTJETG9kRVhUKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSwgbWlwTGV2ZWwpO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlT2N0YWhlZHJhbCh2ZWMyIHNwaCwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIHNhbXBsZU9jdGFoZWRyYWwoZnJvbVNwaGVyaWNhbChzcGgpLCBtaXBMZXZlbCk7XG4gICAgfVxuXG4jZW5kaWZcblxudmVjMyBnZXREaXJlY3Rpb25DdWJlbWFwKCkge1xuICAgIHZlYzIgc3QgPSB2VXYwICogMi4wIC0gMS4wO1xuICAgIGZsb2F0IGZhY2UgPSB0YXJnZXRGYWNlKCk7XG5cbiAgICB2ZWMzIHZlYztcbiAgICBpZiAoZmFjZSA9PSAwLjApIHtcbiAgICAgICAgdmVjID0gdmVjMygxLCAtc3QueSwgLXN0LngpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSAxLjApIHtcbiAgICAgICAgdmVjID0gdmVjMygtMSwgLXN0LnksIHN0LngpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSAyLjApIHtcbiAgICAgICAgdmVjID0gdmVjMyhzdC54LCAxLCBzdC55KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gMy4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoc3QueCwgLTEsIC1zdC55KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gNC4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoc3QueCwgLXN0LnksIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZlYyA9IHZlYzMoLXN0LngsIC1zdC55LCAtMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vcm1hbGl6ZShtb2RpZnlTZWFtcyh2ZWMsIDEuMCAvICgxLjAgLSB0YXJnZXRDdWJlU2VhbVNjYWxlKCkpKSk7XG59XG5cbm1hdDMgbWF0cml4RnJvbVZlY3Rvcih2ZWMzIG4pIHsgLy8gZnJpc3ZhZFxuICAgIGZsb2F0IGEgPSAxLjAgLyAoMS4wICsgbi56KTtcbiAgICBmbG9hdCBiID0gLW4ueCAqIG4ueSAqIGE7XG4gICAgdmVjMyBiMSA9IHZlYzMoMS4wIC0gbi54ICogbi54ICogYSwgYiwgLW4ueCk7XG4gICAgdmVjMyBiMiA9IHZlYzMoYiwgMS4wIC0gbi55ICogbi55ICogYSwgLW4ueSk7XG4gICAgcmV0dXJuIG1hdDMoYjEsIGIyLCBuKTtcbn1cblxubWF0MyBtYXRyaXhGcm9tVmVjdG9yU2xvdyh2ZWMzIG4pIHtcbiAgICB2ZWMzIHVwID0gKDEuMCAtIGFicyhuLnkpIDw9IDAuMDAwMDAwMSkgPyB2ZWMzKDAuMCwgMC4wLCBuLnkgPiAwLjAgPyAxLjAgOiAtMS4wKSA6IHZlYzMoMC4wLCAxLjAsIDAuMCk7XG4gICAgdmVjMyB4ID0gbm9ybWFsaXplKGNyb3NzKHVwLCBuKSk7XG4gICAgdmVjMyB5ID0gY3Jvc3MobiwgeCk7XG4gICAgcmV0dXJuIG1hdDMoeCwgeSwgbik7XG59XG5cbnZlYzQgcmVwcm9qZWN0KCkge1xuICAgIGlmIChOVU1fU0FNUExFUyA8PSAxKSB7XG4gICAgICAgIC8vIHNpbmdsZSBzYW1wbGVcbiAgICAgICAgcmV0dXJuIEVOQ09ERV9GVU5DKERFQ09ERV9GVU5DKFNPVVJDRV9GVU5DKFRBUkdFVF9GVU5DKCkpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbXVsdGkgc2FtcGxlXG4gICAgICAgIHZlYzMgdCA9IFRBUkdFVF9GVU5DKCk7XG4gICAgICAgIHZlYzMgdHUgPSBkRmR4KHQpO1xuICAgICAgICB2ZWMzIHR2ID0gZEZkeSh0KTtcblxuICAgICAgICB2ZWMzIHJlc3VsdCA9IHZlYzMoMC4wKTtcbiAgICAgICAgZm9yIChmbG9hdCB1ID0gMC4wOyB1IDwgTlVNX1NBTVBMRVNfU1FSVDsgKyt1KSB7XG4gICAgICAgICAgICBmb3IgKGZsb2F0IHYgPSAwLjA7IHYgPCBOVU1fU0FNUExFU19TUVJUOyArK3YpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkMobm9ybWFsaXplKHQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHUgKiAodSAvIE5VTV9TQU1QTEVTX1NRUlQgLSAwLjUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR2ICogKHYgLyBOVU1fU0FNUExFU19TUVJUIC0gMC41KSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gRU5DT0RFX0ZVTkMocmVzdWx0IC8gKE5VTV9TQU1QTEVTX1NRUlQgKiBOVU1fU0FNUExFU19TUVJUKSk7XG4gICAgfVxufVxuXG52ZWM0IHVucGFja0Zsb2F0ID0gdmVjNCgxLjAsIDEuMCAvIDI1NS4wLCAxLjAgLyA2NTAyNS4wLCAxLjAgLyAxNjU4MTM3NS4wKTtcblxuI2lmZGVmIFVTRV9TQU1QTEVTX1RFWFxuICAgIHZvaWQgdW5wYWNrU2FtcGxlKGludCBpLCBvdXQgdmVjMyBMLCBvdXQgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICAgICAgZmxvYXQgdSA9IChmbG9hdChpICogNCkgKyAwLjUpICogc2FtcGxlc1RleEludmVyc2VTaXplLng7XG4gICAgICAgIGZsb2F0IHYgPSAoZmxvb3IodSkgKyAwLjUpICogc2FtcGxlc1RleEludmVyc2VTaXplLnk7XG5cbiAgICAgICAgdmVjNCByYXc7XG4gICAgICAgIHJhdy54ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpOyB1ICs9IHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgICAgICByYXcueSA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTsgdSArPSBzYW1wbGVzVGV4SW52ZXJzZVNpemUueDtcbiAgICAgICAgcmF3LnogPSBkb3QodGV4dHVyZTJEKHNhbXBsZXNUZXgsIHZlYzIodSwgdikpLCB1bnBhY2tGbG9hdCk7IHUgKz0gc2FtcGxlc1RleEludmVyc2VTaXplLng7XG4gICAgICAgIHJhdy53ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpO1xuXG4gICAgICAgIEwueHl6ID0gcmF3Lnh5eiAqIDIuMCAtIDEuMDtcbiAgICAgICAgbWlwTGV2ZWwgPSByYXcudyAqIDguMDtcbiAgICB9XG5cbiAgICAvLyBjb252b2x2ZSBhbiBlbnZpcm9ubWVudCBnaXZlbiBwcmUtZ2VuZXJhdGVkIHNhbXBsZXNcbiAgICB2ZWM0IHByZWZpbHRlclNhbXBsZXMoKSB7XG4gICAgICAgIC8vIGNvbnN0cnVjdCB2ZWN0b3Igc3BhY2UgZ2l2ZW4gdGFyZ2V0IGRpcmVjdGlvblxuICAgICAgICBtYXQzIHZlY1NwYWNlID0gbWF0cml4RnJvbVZlY3RvclNsb3coVEFSR0VUX0ZVTkMoKSk7XG5cbiAgICAgICAgdmVjMyBMO1xuICAgICAgICBmbG9hdCBtaXBMZXZlbDtcblxuICAgICAgICB2ZWMzIHJlc3VsdCA9IHZlYzMoMC4wKTtcbiAgICAgICAgZmxvYXQgdG90YWxXZWlnaHQgPSAwLjA7XG4gICAgICAgIGZvciAoaW50IGkgPSAwOyBpIDwgTlVNX1NBTVBMRVM7ICsraSkge1xuICAgICAgICAgICAgdW5wYWNrU2FtcGxlKGksIEwsIG1pcExldmVsKTtcbiAgICAgICAgICAgIHJlc3VsdCArPSBERUNPREVfRlVOQyhTT1VSQ0VfRlVOQyh2ZWNTcGFjZSAqIEwsIG1pcExldmVsKSkgKiBMLno7XG4gICAgICAgICAgICB0b3RhbFdlaWdodCArPSBMLno7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gRU5DT0RFX0ZVTkMocmVzdWx0IC8gdG90YWxXZWlnaHQpO1xuICAgIH1cblxuICAgIC8vIHVud2VpZ2h0ZWQgdmVyc2lvbiBvZiBwcmVmaWx0ZXJTYW1wbGVzXG4gICAgdmVjNCBwcmVmaWx0ZXJTYW1wbGVzVW53ZWlnaHRlZCgpIHtcbiAgICAgICAgLy8gY29uc3RydWN0IHZlY3RvciBzcGFjZSBnaXZlbiB0YXJnZXQgZGlyZWN0aW9uXG4gICAgICAgIG1hdDMgdmVjU3BhY2UgPSBtYXRyaXhGcm9tVmVjdG9yU2xvdyhUQVJHRVRfRlVOQygpKTtcblxuICAgICAgICB2ZWMzIEw7XG4gICAgICAgIGZsb2F0IG1pcExldmVsO1xuXG4gICAgICAgIHZlYzMgcmVzdWx0ID0gdmVjMygwLjApO1xuICAgICAgICBmbG9hdCB0b3RhbFdlaWdodCA9IDAuMDtcbiAgICAgICAgZm9yIChpbnQgaSA9IDA7IGkgPCBOVU1fU0FNUExFUzsgKytpKSB7XG4gICAgICAgICAgICB1bnBhY2tTYW1wbGUoaSwgTCwgbWlwTGV2ZWwpO1xuICAgICAgICAgICAgcmVzdWx0ICs9IERFQ09ERV9GVU5DKFNPVVJDRV9GVU5DKHZlY1NwYWNlICogTCwgbWlwTGV2ZWwpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBFTkNPREVfRlVOQyhyZXN1bHQgLyBmbG9hdChOVU1fU0FNUExFUykpO1xuICAgIH1cbiNlbmRpZlxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX0ZyYWdDb2xvciA9IFBST0NFU1NfRlVOQygpO1xufVxuYDtcbiJdLCJuYW1lcyI6WyJkZWNvZGUiLCJlbmNvZGUiXSwibWFwcGluZ3MiOiI7OztBQUdBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRUEsUUFBTyxDQUFBO0FBQ1QsRUFBRUMsUUFBTyxDQUFBO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
