import { Debug } from '../../core/debug.js';
import { random } from '../../core/math/random.js';
import { Vec3 } from '../../core/math/vec3.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from './quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const getProjectionName = projection => {
  switch (projection) {
    case TEXTUREPROJECTION_CUBE:
      return "Cubemap";
    case TEXTUREPROJECTION_OCTAHEDRAL:
      return "Octahedral";
    default:
      // for anything else, assume equirect
      return "Equirect";
  }
};

// pack a 32bit floating point value into RGBA8
const packFloat32ToRGBA8 = (value, array, offset) => {
  if (value <= 0) {
    array[offset + 0] = 0;
    array[offset + 1] = 0;
    array[offset + 2] = 0;
    array[offset + 3] = 0;
  } else if (value >= 1.0) {
    array[offset + 0] = 255;
    array[offset + 1] = 0;
    array[offset + 2] = 0;
    array[offset + 3] = 0;
  } else {
    let encX = 1 * value % 1;
    let encY = 255 * value % 1;
    let encZ = 65025 * value % 1;
    const encW = 16581375.0 * value % 1;
    encX -= encY / 255;
    encY -= encZ / 255;
    encZ -= encW / 255;
    array[offset + 0] = Math.min(255, Math.floor(encX * 256));
    array[offset + 1] = Math.min(255, Math.floor(encY * 256));
    array[offset + 2] = Math.min(255, Math.floor(encZ * 256));
    array[offset + 3] = Math.min(255, Math.floor(encW * 256));
  }
};

// pack samples into texture-ready format
const packSamples = samples => {
  const numSamples = samples.length;
  const w = Math.min(numSamples, 512);
  const h = Math.ceil(numSamples / w);
  const data = new Uint8Array(w * h * 4);

  // normalize float data and pack into rgba8
  let off = 0;
  for (let i = 0; i < numSamples; i += 4) {
    packFloat32ToRGBA8(samples[i + 0] * 0.5 + 0.5, data, off + 0);
    packFloat32ToRGBA8(samples[i + 1] * 0.5 + 0.5, data, off + 4);
    packFloat32ToRGBA8(samples[i + 2] * 0.5 + 0.5, data, off + 8);
    packFloat32ToRGBA8(samples[i + 3] / 8, data, off + 12);
    off += 16;
  }
  return {
    width: w,
    height: h,
    data: data
  };
};

// generate a vector on the hemisphere with constant distribution.
// function kept because it's useful for debugging
// vec3 hemisphereSampleUniform(vec2 uv) {
//     float phi = uv.y * 2.0 * PI;
//     float cosTheta = 1.0 - uv.x;
//     float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
//     return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
// }

// generate a vector on the hemisphere with phong reflection distribution
const hemisphereSamplePhong = (dstVec, x, y, specularPower) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.pow(1 - x, 1 / (specularPower + 1));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with lambert distribution
const hemisphereSampleLambert = (dstVec, x, y) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.sqrt(1 - x);
  const sinTheta = Math.sqrt(x);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with GGX distribution.
// a is linear roughness^2
const hemisphereSampleGGX = (dstVec, x, y, a) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.sqrt((1 - x) / (1 + (a * a - 1) * x));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};
const D_GGX = (NoH, linearRoughness) => {
  const a = NoH * linearRoughness;
  const k = linearRoughness / (1.0 - NoH * NoH + a * a);
  return k * k * (1 / Math.PI);
};

// generate precomputed samples for phong reflections of the given power
const generatePhongSamples = (numSamples, specularPower) => {
  const H = new Vec3();
  const result = [];
  for (let i = 0; i < numSamples; ++i) {
    hemisphereSamplePhong(H, i / numSamples, random.radicalInverse(i), specularPower);
    result.push(H.x, H.y, H.z, 0);
  }
  return result;
};

// generate precomputed samples for lambert convolution
const generateLambertSamples = (numSamples, sourceTotalPixels) => {
  const pixelsPerSample = sourceTotalPixels / numSamples;
  const H = new Vec3();
  const result = [];
  for (let i = 0; i < numSamples; ++i) {
    hemisphereSampleLambert(H, i / numSamples, random.radicalInverse(i));
    const pdf = H.z / Math.PI;
    const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
    result.push(H.x, H.y, H.z, mipLevel);
  }
  return result;
};

// print to the console the required samples table for GGX reflection convolution
// console.log(calculateRequiredSamplesGGX());

// this is a table with pre-calculated number of samples required for GGX.
// the table is generated by calculateRequiredSamplesGGX()
// the table is organized by [numSamples][specularPower]
//
// we use a repeatable pseudo-random sequence of numbers when generating samples
// for use in prefiltering GGX reflections. however not all the random samples
// will be valid. this is because some resulting reflection vectors will be below
// the hemisphere. this is especially apparent when calculating vectors for the
// higher roughnesses. (since vectors are more wild, more of them are invalid).
// for example, specularPower 2 results in half the generated vectors being
// invalid. (meaning the GPU would spend half the time on vectors that don't
// contribute to the final result).
//
// calculating how many samples are required to generate 'n' valid samples is a
// slow operation, so this table stores the pre-calculated numbers of samples
// required for the sets of (numSamples, specularPowers) pairs we expect to
// encounter at runtime.
const requiredSamplesGGX = {
  "16": {
    "2": 26,
    "8": 20,
    "32": 17,
    "128": 16,
    "512": 16
  },
  "32": {
    "2": 53,
    "8": 40,
    "32": 34,
    "128": 32,
    "512": 32
  },
  "128": {
    "2": 214,
    "8": 163,
    "32": 139,
    "128": 130,
    "512": 128
  },
  "1024": {
    "2": 1722,
    "8": 1310,
    "32": 1114,
    "128": 1041,
    "512": 1025
  }
};

// get the number of random samples required to generate numSamples valid samples.
const getRequiredSamplesGGX = (numSamples, specularPower) => {
  const table = requiredSamplesGGX[numSamples];
  return table && table[specularPower] || numSamples;
};

// generate precomputed GGX samples
const generateGGXSamples = (numSamples, specularPower, sourceTotalPixels) => {
  const pixelsPerSample = sourceTotalPixels / numSamples;
  const roughness = 1 - Math.log2(specularPower) / 11.0;
  const a = roughness * roughness;
  const H = new Vec3();
  const L = new Vec3();
  const N = new Vec3(0, 0, 1);
  const result = [];
  const requiredSamples = getRequiredSamplesGGX(numSamples, specularPower);
  for (let i = 0; i < requiredSamples; ++i) {
    hemisphereSampleGGX(H, i / requiredSamples, random.radicalInverse(i), a);
    const NoH = H.z; // since N is (0, 0, 1)
    L.set(H.x, H.y, H.z).mulScalar(2 * NoH).sub(N);
    if (L.z > 0) {
      const pdf = D_GGX(Math.min(1, NoH), a) / 4 + 0.001;
      const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
      result.push(L.x, L.y, L.z, mipLevel);
    }
  }
  while (result.length < numSamples * 4) {
    result.push(0, 0, 0, 0);
  }
  return result;
};

// pack float samples data into an rgba8 texture
const createSamplesTex = (device, name, samples) => {
  const packedSamples = packSamples(samples);
  return new Texture(device, {
    name: name,
    width: packedSamples.width,
    height: packedSamples.height,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    levels: [packedSamples.data]
  });
};

// simple cache storing key->value
// missFunc is called if the key is not present
class SimpleCache {
  constructor(destroyContent = true) {
    this.map = new Map();
    this.destroyContent = destroyContent;
  }
  destroy() {
    if (this.destroyContent) {
      this.map.forEach((value, key) => {
        value.destroy();
      });
    }
  }
  get(key, missFunc) {
    if (!this.map.has(key)) {
      const result = missFunc();
      this.map.set(key, result);
      return result;
    }
    return this.map.get(key);
  }
}

// cache, used to store samples. we store these separately from textures since multiple
// devices can use the same set of samples.
const samplesCache = new SimpleCache(false);

// cache, storing samples stored in textures, those are per device
const deviceCache = new DeviceCache();
const getCachedTexture = (device, key, getSamplesFnc) => {
  const cache = deviceCache.get(device, () => {
    return new SimpleCache();
  });
  return cache.get(key, () => {
    return createSamplesTex(device, key, samplesCache.get(key, getSamplesFnc));
  });
};
const generateLambertSamplesTex = (device, numSamples, sourceTotalPixels) => {
  const key = `lambert-samples-${numSamples}-${sourceTotalPixels}`;
  return getCachedTexture(device, key, () => {
    return generateLambertSamples(numSamples, sourceTotalPixels);
  });
};
const generatePhongSamplesTex = (device, numSamples, specularPower) => {
  const key = `phong-samples-${numSamples}-${specularPower}`;
  return getCachedTexture(device, key, () => {
    return generatePhongSamples(numSamples, specularPower);
  });
};
const generateGGXSamplesTex = (device, numSamples, specularPower, sourceTotalPixels) => {
  const key = `ggx-samples-${numSamples}-${specularPower}-${sourceTotalPixels}`;
  return getCachedTexture(device, key, () => {
    return generateGGXSamples(numSamples, specularPower, sourceTotalPixels);
  });
};
const vsCode = `
attribute vec2 vertex_position;

uniform vec4 uvMod;

varying vec2 vUv0;

void main(void) {
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = getImageEffectUV((vertex_position.xy * 0.5 + 0.5) * uvMod.xy + uvMod.zw);
}
`;

/**
 * This function reprojects textures between cubemap, equirectangular and octahedral formats. The
 * function can read and write textures with pixel data in RGBE, RGBM, linear and sRGB formats.
 * When specularPower is specified it will perform a phong-weighted convolution of the source (for
 * generating a gloss maps).
 *
 * @param {Texture} source - The source texture.
 * @param {Texture} target - The target texture.
 * @param {object} [options] - The options object.
 * @param {number} [options.specularPower] - Optional specular power. When specular power is
 * specified, the source is convolved by a phong-weighted kernel raised to the specified power.
 * Otherwise the function performs a standard resample.
 * @param {number} [options.numSamples] - Optional number of samples (default is 1024).
 * @param {number} [options.face] - Optional cubemap face to update (default is update all faces).
 * @param {string} [options.distribution] - Specify convolution distribution - 'none', 'lambert',
 * 'phong', 'ggx'. Default depends on specularPower.
 * @param {import('../../core/math/vec4.js').Vec4} [options.rect] - Optional viewport rectangle.
 * @param {number} [options.seamPixels] - Optional number of seam pixels to render
 * @returns {boolean} True if the reprojection was applied and false otherwise (e.g. if rect is empty)
 * @category Graphics
 */
function reprojectTexture(source, target, options = {}) {
  var _options$seamPixels, _options$rect$z, _options$rect, _options$rect$w, _options$rect2;
  // maintain backwards compatibility with previous function signature
  // reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024)
  if (source instanceof GraphicsDevice) {
    source = arguments[1];
    target = arguments[2];
    options = {};
    if (arguments[3] !== undefined) {
      options.specularPower = arguments[3];
    }
    if (arguments[4] !== undefined) {
      options.numSamples = arguments[4];
    }
    Debug.deprecated('please use the updated pc.reprojectTexture API.');
  }

  // calculate inner width and height
  const seamPixels = (_options$seamPixels = options.seamPixels) != null ? _options$seamPixels : 0;
  const innerWidth = ((_options$rect$z = (_options$rect = options.rect) == null ? void 0 : _options$rect.z) != null ? _options$rect$z : target.width) - seamPixels * 2;
  const innerHeight = ((_options$rect$w = (_options$rect2 = options.rect) == null ? void 0 : _options$rect2.w) != null ? _options$rect$w : target.height) - seamPixels * 2;
  if (innerWidth < 1 || innerHeight < 1) {
    // early out if inner space is empty
    return false;
  }

  // table of distribution -> function name
  const funcNames = {
    'none': 'reproject',
    'lambert': 'prefilterSamplesUnweighted',
    'phong': 'prefilterSamplesUnweighted',
    'ggx': 'prefilterSamples'
  };

  // extract options
  const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
  const face = options.hasOwnProperty('face') ? options.face : null;
  const distribution = options.hasOwnProperty('distribution') ? options.distribution : specularPower === 1 ? 'none' : 'phong';
  const processFunc = funcNames[distribution] || 'reproject';
  const prefilterSamples = processFunc.startsWith('prefilterSamples');
  const decodeFunc = ChunkUtils.decodeFunc(source.encoding);
  const encodeFunc = ChunkUtils.encodeFunc(target.encoding);
  const sourceFunc = `sample${getProjectionName(source.projection)}`;
  const targetFunc = `getDirection${getProjectionName(target.projection)}`;
  const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;

  // generate unique shader key
  const shaderKey = `${processFunc}_${decodeFunc}_${encodeFunc}_${sourceFunc}_${targetFunc}_${numSamples}`;
  const device = source.device;
  let shader = getProgramLibrary(device).getCachedShader(shaderKey);
  if (!shader) {
    const defines = `#define PROCESS_FUNC ${processFunc}\n` + (prefilterSamples ? `#define USE_SAMPLES_TEX\n` : '') + (source.cubemap ? `#define CUBEMAP_SOURCE\n` : '') + `#define DECODE_FUNC ${decodeFunc}\n` + `#define ENCODE_FUNC ${encodeFunc}\n` + `#define SOURCE_FUNC ${sourceFunc}\n` + `#define TARGET_FUNC ${targetFunc}\n` + `#define NUM_SAMPLES ${numSamples}\n` + `#define NUM_SAMPLES_SQRT ${Math.round(Math.sqrt(numSamples)).toFixed(1)}\n`;
    shader = createShaderFromCode(device, vsCode, `${defines}\n${shaderChunks.reprojectPS}`, shaderKey);
  }
  DebugGraphics.pushGpuMarker(device, "ReprojectTexture");

  // render state
  // TODO: set up other render state here to expected state
  device.setBlendState(BlendState.NOBLEND);
  const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
  Debug.assert(constantSource);
  constantSource.setValue(source);
  const constantParams = device.scope.resolve("params");
  const constantParams2 = device.scope.resolve("params2");
  const uvModParam = device.scope.resolve("uvMod");
  if (seamPixels > 0) {
    uvModParam.setValue([(innerWidth + seamPixels * 2) / innerWidth, (innerHeight + seamPixels * 2) / innerHeight, -seamPixels / innerWidth, -seamPixels / innerHeight]);
  } else {
    uvModParam.setValue([1, 1, 0, 0]);
  }
  const params = [0, specularPower, source.fixCubemapSeams ? 1.0 / source.width : 0.0,
  // source seam scale
  target.fixCubemapSeams ? 1.0 / target.width : 0.0 // target seam scale
  ];

  const params2 = [target.width * target.height * (target.cubemap ? 6 : 1), source.width * source.height * (source.cubemap ? 6 : 1)];
  if (prefilterSamples) {
    // set or generate the pre-calculated samples data
    const sourceTotalPixels = source.width * source.height * (source.cubemap ? 6 : 1);
    const samplesTex = distribution === 'ggx' ? generateGGXSamplesTex(device, numSamples, specularPower, sourceTotalPixels) : distribution === 'lambert' ? generateLambertSamplesTex(device, numSamples, sourceTotalPixels) : generatePhongSamplesTex(device, numSamples, specularPower);
    device.scope.resolve("samplesTex").setValue(samplesTex);
    device.scope.resolve("samplesTexInverseSize").setValue([1.0 / samplesTex.width, 1.0 / samplesTex.height]);
  }
  for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
    if (face === null || f === face) {
      var _options;
      const renderTarget = new RenderTarget({
        colorBuffer: target,
        face: f,
        depth: false,
        flipY: device.isWebGPU
      });
      params[0] = f;
      constantParams.setValue(params);
      constantParams2.setValue(params2);
      drawQuadWithShader(device, renderTarget, shader, (_options = options) == null ? void 0 : _options.rect);
      renderTarget.destroy();
    }
  }
  DebugGraphics.popGpuMarker(device);
  return true;
}

export { reprojectTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3JhbmRvbS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQge1xuICAgIEZJTFRFUl9ORUFSRVNULFxuICAgIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUwsIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkVcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBEZXZpY2VDYWNoZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RldmljZS1jYWNoZS5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBDaHVua1V0aWxzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5cbmNvbnN0IGdldFByb2plY3Rpb25OYW1lID0gKHByb2plY3Rpb24pID0+IHtcbiAgICBzd2l0Y2ggKHByb2plY3Rpb24pIHtcbiAgICAgICAgY2FzZSBURVhUVVJFUFJPSkVDVElPTl9DVUJFOlxuICAgICAgICAgICAgcmV0dXJuIFwiQ3ViZW1hcFwiO1xuICAgICAgICBjYXNlIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUw6XG4gICAgICAgICAgICByZXR1cm4gXCJPY3RhaGVkcmFsXCI7XG4gICAgICAgIGRlZmF1bHQ6IC8vIGZvciBhbnl0aGluZyBlbHNlLCBhc3N1bWUgZXF1aXJlY3RcbiAgICAgICAgICAgIHJldHVybiBcIkVxdWlyZWN0XCI7XG4gICAgfVxufTtcblxuLy8gcGFjayBhIDMyYml0IGZsb2F0aW5nIHBvaW50IHZhbHVlIGludG8gUkdCQThcbmNvbnN0IHBhY2tGbG9hdDMyVG9SR0JBOCA9ICh2YWx1ZSwgYXJyYXksIG9mZnNldCkgPT4ge1xuICAgIGlmICh2YWx1ZSA8PSAwKSB7XG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gMDtcbiAgICB9IGVsc2UgaWYgKHZhbHVlID49IDEuMCkge1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IDI1NTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgZW5jWCA9ICgxICogdmFsdWUpICUgMTtcbiAgICAgICAgbGV0IGVuY1kgPSAoMjU1ICogdmFsdWUpICUgMTtcbiAgICAgICAgbGV0IGVuY1ogPSAoNjUwMjUgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBjb25zdCBlbmNXID0gKDE2NTgxMzc1LjAgKiB2YWx1ZSkgJSAxO1xuXG4gICAgICAgIGVuY1ggLT0gZW5jWSAvIDI1NTtcbiAgICAgICAgZW5jWSAtPSBlbmNaIC8gMjU1O1xuICAgICAgICBlbmNaIC09IGVuY1cgLyAyNTU7XG5cbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWCAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNZICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1ogKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jVyAqIDI1NikpO1xuICAgIH1cbn07XG5cbi8vIHBhY2sgc2FtcGxlcyBpbnRvIHRleHR1cmUtcmVhZHkgZm9ybWF0XG5jb25zdCBwYWNrU2FtcGxlcyA9IChzYW1wbGVzKSA9PiB7XG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IHNhbXBsZXMubGVuZ3RoO1xuXG4gICAgY29uc3QgdyA9IE1hdGgubWluKG51bVNhbXBsZXMsIDUxMik7XG4gICAgY29uc3QgaCA9IE1hdGguY2VpbChudW1TYW1wbGVzIC8gdyk7XG4gICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KHcgKiBoICogNCk7XG5cbiAgICAvLyBub3JtYWxpemUgZmxvYXQgZGF0YSBhbmQgcGFjayBpbnRvIHJnYmE4XG4gICAgbGV0IG9mZiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyBpICs9IDQpIHtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSArIDBdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyAwKTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSArIDFdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyA0KTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSArIDJdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyA4KTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSArIDNdIC8gOCwgZGF0YSwgb2ZmICsgMTIpO1xuICAgICAgICBvZmYgKz0gMTY7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgd2lkdGg6IHcsXG4gICAgICAgIGhlaWdodDogaCxcbiAgICAgICAgZGF0YTogZGF0YVxuICAgIH07XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIGNvbnN0YW50IGRpc3RyaWJ1dGlvbi5cbi8vIGZ1bmN0aW9uIGtlcHQgYmVjYXVzZSBpdCdzIHVzZWZ1bCBmb3IgZGVidWdnaW5nXG4vLyB2ZWMzIGhlbWlzcGhlcmVTYW1wbGVVbmlmb3JtKHZlYzIgdXYpIHtcbi8vICAgICBmbG9hdCBwaGkgPSB1di55ICogMi4wICogUEk7XG4vLyAgICAgZmxvYXQgY29zVGhldGEgPSAxLjAgLSB1di54O1xuLy8gICAgIGZsb2F0IHNpblRoZXRhID0gc3FydCgxLjAgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbi8vICAgICByZXR1cm4gdmVjMyhjb3MocGhpKSAqIHNpblRoZXRhLCBzaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSk7XG4vLyB9XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggcGhvbmcgcmVmbGVjdGlvbiBkaXN0cmlidXRpb25cbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVQaG9uZyA9IChkc3RWZWMsIHgsIHksIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnBvdygxIC0geCwgMSAvIChzcGVjdWxhclBvd2VyICsgMSkpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KDEgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIGxhbWJlcnQgZGlzdHJpYnV0aW9uXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlTGFtYmVydCA9IChkc3RWZWMsIHgsIHkpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnNxcnQoMSAtIHgpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KHgpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggR0dYIGRpc3RyaWJ1dGlvbi5cbi8vIGEgaXMgbGluZWFyIHJvdWdobmVzc14yXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlR0dYID0gKGRzdFZlYywgeCwgeSwgYSkgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguc3FydCgoMSAtIHgpIC8gKDEgKyAoYSAqIGEgLSAxKSAqIHgpKTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCgxIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuY29uc3QgRF9HR1ggPSAoTm9ILCBsaW5lYXJSb3VnaG5lc3MpID0+IHtcbiAgICBjb25zdCBhID0gTm9IICogbGluZWFyUm91Z2huZXNzO1xuICAgIGNvbnN0IGsgPSBsaW5lYXJSb3VnaG5lc3MgLyAoMS4wIC0gTm9IICogTm9IICsgYSAqIGEpO1xuICAgIHJldHVybiBrICogayAqICgxIC8gTWF0aC5QSSk7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBzYW1wbGVzIGZvciBwaG9uZyByZWZsZWN0aW9ucyBvZiB0aGUgZ2l2ZW4gcG93ZXJcbmNvbnN0IGdlbmVyYXRlUGhvbmdTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVQaG9uZyhILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBzcGVjdWxhclBvd2VyKTtcbiAgICAgICAgcmVzdWx0LnB1c2goSC54LCBILnksIEgueiwgMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIHNhbXBsZXMgZm9yIGxhbWJlcnQgY29udm9sdXRpb25cbmNvbnN0IGdlbmVyYXRlTGFtYmVydFNhbXBsZXMgPSAobnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBwaXhlbHNQZXJTYW1wbGUgPSBzb3VyY2VUb3RhbFBpeGVscyAvIG51bVNhbXBsZXM7XG5cbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0KEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSkpO1xuICAgICAgICBjb25zdCBwZGYgPSBILnogLyBNYXRoLlBJO1xuICAgICAgICBjb25zdCBtaXBMZXZlbCA9IDAuNSAqIE1hdGgubG9nMihwaXhlbHNQZXJTYW1wbGUgLyBwZGYpO1xuICAgICAgICByZXN1bHQucHVzaChILngsIEgueSwgSC56LCBtaXBMZXZlbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdGFibGUgc3RvcmluZyB0aGUgbnVtYmVyIG9mIHNhbXBsZXMgcmVxdWlyZWQgdG8gZ2V0ICdudW1TYW1wbGVzJ1xuLy8gdmFsaWQgc2FtcGxlcyBmb3IgdGhlIGdpdmVuIHNwZWN1bGFyUG93ZXIuXG4vKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xuY29uc3QgY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYID0gKCkgPT4ge1xuICAgIGNvbnN0IGNvdW50VmFsaWRTYW1wbGVzR0dYID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICAgICAgY29uc3Qgcm91Z2huZXNzID0gMSAtIE1hdGgubG9nMihzcGVjdWxhclBvd2VyKSAvIDExLjA7XG4gICAgICAgIGNvbnN0IGEgPSByb3VnaG5lc3MgKiByb3VnaG5lc3M7XG4gICAgICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBMID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgTiA9IG5ldyBWZWMzKDAsIDAsIDEpO1xuXG4gICAgICAgIGxldCB2YWxpZFNhbXBsZXMgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUdHWChILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBhKTtcblxuICAgICAgICAgICAgY29uc3QgTm9IID0gSC56OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNpbmNlIE4gaXMgKDAsIDAsIDEpXG4gICAgICAgICAgICBMLnNldChILngsIEgueSwgSC56KS5tdWxTY2FsYXIoMiAqIE5vSCkuc3ViKE4pO1xuXG4gICAgICAgICAgICB2YWxpZFNhbXBsZXMgKz0gTC56ID4gMCA/IDEgOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbGlkU2FtcGxlcztcbiAgICB9O1xuXG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IFsxMDI0LCAxMjgsIDMyLCAxNl07XG4gICAgY29uc3Qgc3BlY3VsYXJQb3dlcnMgPSBbNTEyLCAxMjgsIDMyLCA4LCAyXTtcblxuICAgIGNvbnN0IHJlcXVpcmVkVGFibGUgPSB7fTtcbiAgICBudW1TYW1wbGVzLmZvckVhY2goKG51bVNhbXBsZXMpID0+IHtcbiAgICAgICAgY29uc3QgdGFibGUgPSB7IH07XG4gICAgICAgIHNwZWN1bGFyUG93ZXJzLmZvckVhY2goKHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICAgICAgICAgIGxldCByZXF1aXJlZFNhbXBsZXMgPSBudW1TYW1wbGVzO1xuICAgICAgICAgICAgd2hpbGUgKGNvdW50VmFsaWRTYW1wbGVzR0dYKHJlcXVpcmVkU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPCBudW1TYW1wbGVzKSB7XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRTYW1wbGVzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0YWJsZVtzcGVjdWxhclBvd2VyXSA9IHJlcXVpcmVkU2FtcGxlcztcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcXVpcmVkVGFibGVbbnVtU2FtcGxlc10gPSB0YWJsZTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXF1aXJlZFRhYmxlO1xufTtcblxuLy8gcHJpbnQgdG8gdGhlIGNvbnNvbGUgdGhlIHJlcXVpcmVkIHNhbXBsZXMgdGFibGUgZm9yIEdHWCByZWZsZWN0aW9uIGNvbnZvbHV0aW9uXG4vLyBjb25zb2xlLmxvZyhjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1goKSk7XG5cbi8vIHRoaXMgaXMgYSB0YWJsZSB3aXRoIHByZS1jYWxjdWxhdGVkIG51bWJlciBvZiBzYW1wbGVzIHJlcXVpcmVkIGZvciBHR1guXG4vLyB0aGUgdGFibGUgaXMgZ2VuZXJhdGVkIGJ5IGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCgpXG4vLyB0aGUgdGFibGUgaXMgb3JnYW5pemVkIGJ5IFtudW1TYW1wbGVzXVtzcGVjdWxhclBvd2VyXVxuLy9cbi8vIHdlIHVzZSBhIHJlcGVhdGFibGUgcHNldWRvLXJhbmRvbSBzZXF1ZW5jZSBvZiBudW1iZXJzIHdoZW4gZ2VuZXJhdGluZyBzYW1wbGVzXG4vLyBmb3IgdXNlIGluIHByZWZpbHRlcmluZyBHR1ggcmVmbGVjdGlvbnMuIGhvd2V2ZXIgbm90IGFsbCB0aGUgcmFuZG9tIHNhbXBsZXNcbi8vIHdpbGwgYmUgdmFsaWQuIHRoaXMgaXMgYmVjYXVzZSBzb21lIHJlc3VsdGluZyByZWZsZWN0aW9uIHZlY3RvcnMgd2lsbCBiZSBiZWxvd1xuLy8gdGhlIGhlbWlzcGhlcmUuIHRoaXMgaXMgZXNwZWNpYWxseSBhcHBhcmVudCB3aGVuIGNhbGN1bGF0aW5nIHZlY3RvcnMgZm9yIHRoZVxuLy8gaGlnaGVyIHJvdWdobmVzc2VzLiAoc2luY2UgdmVjdG9ycyBhcmUgbW9yZSB3aWxkLCBtb3JlIG9mIHRoZW0gYXJlIGludmFsaWQpLlxuLy8gZm9yIGV4YW1wbGUsIHNwZWN1bGFyUG93ZXIgMiByZXN1bHRzIGluIGhhbGYgdGhlIGdlbmVyYXRlZCB2ZWN0b3JzIGJlaW5nXG4vLyBpbnZhbGlkLiAobWVhbmluZyB0aGUgR1BVIHdvdWxkIHNwZW5kIGhhbGYgdGhlIHRpbWUgb24gdmVjdG9ycyB0aGF0IGRvbid0XG4vLyBjb250cmlidXRlIHRvIHRoZSBmaW5hbCByZXN1bHQpLlxuLy9cbi8vIGNhbGN1bGF0aW5nIGhvdyBtYW55IHNhbXBsZXMgYXJlIHJlcXVpcmVkIHRvIGdlbmVyYXRlICduJyB2YWxpZCBzYW1wbGVzIGlzIGFcbi8vIHNsb3cgb3BlcmF0aW9uLCBzbyB0aGlzIHRhYmxlIHN0b3JlcyB0aGUgcHJlLWNhbGN1bGF0ZWQgbnVtYmVycyBvZiBzYW1wbGVzXG4vLyByZXF1aXJlZCBmb3IgdGhlIHNldHMgb2YgKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXJzKSBwYWlycyB3ZSBleHBlY3QgdG9cbi8vIGVuY291bnRlciBhdCBydW50aW1lLlxuY29uc3QgcmVxdWlyZWRTYW1wbGVzR0dYID0ge1xuICAgIFwiMTZcIjoge1xuICAgICAgICBcIjJcIjogMjYsXG4gICAgICAgIFwiOFwiOiAyMCxcbiAgICAgICAgXCIzMlwiOiAxNyxcbiAgICAgICAgXCIxMjhcIjogMTYsXG4gICAgICAgIFwiNTEyXCI6IDE2XG4gICAgfSxcbiAgICBcIjMyXCI6IHtcbiAgICAgICAgXCIyXCI6IDUzLFxuICAgICAgICBcIjhcIjogNDAsXG4gICAgICAgIFwiMzJcIjogMzQsXG4gICAgICAgIFwiMTI4XCI6IDMyLFxuICAgICAgICBcIjUxMlwiOiAzMlxuICAgIH0sXG4gICAgXCIxMjhcIjoge1xuICAgICAgICBcIjJcIjogMjE0LFxuICAgICAgICBcIjhcIjogMTYzLFxuICAgICAgICBcIjMyXCI6IDEzOSxcbiAgICAgICAgXCIxMjhcIjogMTMwLFxuICAgICAgICBcIjUxMlwiOiAxMjhcbiAgICB9LFxuICAgIFwiMTAyNFwiOiB7XG4gICAgICAgIFwiMlwiOiAxNzIyLFxuICAgICAgICBcIjhcIjogMTMxMCxcbiAgICAgICAgXCIzMlwiOiAxMTE0LFxuICAgICAgICBcIjEyOFwiOiAxMDQxLFxuICAgICAgICBcIjUxMlwiOiAxMDI1XG4gICAgfVxufTtcblxuLy8gZ2V0IHRoZSBudW1iZXIgb2YgcmFuZG9tIHNhbXBsZXMgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgbnVtU2FtcGxlcyB2YWxpZCBzYW1wbGVzLlxuY29uc3QgZ2V0UmVxdWlyZWRTYW1wbGVzR0dYID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCB0YWJsZSA9IHJlcXVpcmVkU2FtcGxlc0dHWFtudW1TYW1wbGVzXTtcbiAgICByZXR1cm4gKHRhYmxlICYmIHRhYmxlW3NwZWN1bGFyUG93ZXJdKSB8fCBudW1TYW1wbGVzO1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgR0dYIHNhbXBsZXNcbmNvbnN0IGdlbmVyYXRlR0dYU2FtcGxlcyA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IHBpeGVsc1BlclNhbXBsZSA9IHNvdXJjZVRvdGFsUGl4ZWxzIC8gbnVtU2FtcGxlcztcbiAgICBjb25zdCByb3VnaG5lc3MgPSAxIC0gTWF0aC5sb2cyKHNwZWN1bGFyUG93ZXIpIC8gMTEuMDtcbiAgICBjb25zdCBhID0gcm91Z2huZXNzICogcm91Z2huZXNzO1xuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IEwgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IE4gPSBuZXcgVmVjMygwLCAwLCAxKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGNvbnN0IHJlcXVpcmVkU2FtcGxlcyA9IGdldFJlcXVpcmVkU2FtcGxlc0dHWChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVxdWlyZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUdHWChILCBpIC8gcmVxdWlyZWRTYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIGEpO1xuXG4gICAgICAgIGNvbnN0IE5vSCA9IEguejsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaW5jZSBOIGlzICgwLCAwLCAxKVxuICAgICAgICBMLnNldChILngsIEgueSwgSC56KS5tdWxTY2FsYXIoMiAqIE5vSCkuc3ViKE4pO1xuXG4gICAgICAgIGlmIChMLnogPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBwZGYgPSBEX0dHWChNYXRoLm1pbigxLCBOb0gpLCBhKSAvIDQgKyAwLjAwMTtcbiAgICAgICAgICAgIGNvbnN0IG1pcExldmVsID0gMC41ICogTWF0aC5sb2cyKHBpeGVsc1BlclNhbXBsZSAvIHBkZik7XG4gICAgICAgICAgICByZXN1bHQucHVzaChMLngsIEwueSwgTC56LCBtaXBMZXZlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAocmVzdWx0Lmxlbmd0aCA8IG51bVNhbXBsZXMgKiA0KSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKDAsIDAsIDAsIDApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBwYWNrIGZsb2F0IHNhbXBsZXMgZGF0YSBpbnRvIGFuIHJnYmE4IHRleHR1cmVcbmNvbnN0IGNyZWF0ZVNhbXBsZXNUZXggPSAoZGV2aWNlLCBuYW1lLCBzYW1wbGVzKSA9PiB7XG4gICAgY29uc3QgcGFja2VkU2FtcGxlcyA9IHBhY2tTYW1wbGVzKHNhbXBsZXMpO1xuICAgIHJldHVybiBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgd2lkdGg6IHBhY2tlZFNhbXBsZXMud2lkdGgsXG4gICAgICAgIGhlaWdodDogcGFja2VkU2FtcGxlcy5oZWlnaHQsXG4gICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBsZXZlbHM6IFtwYWNrZWRTYW1wbGVzLmRhdGFdXG4gICAgfSk7XG59O1xuXG4vLyBzaW1wbGUgY2FjaGUgc3RvcmluZyBrZXktPnZhbHVlXG4vLyBtaXNzRnVuYyBpcyBjYWxsZWQgaWYgdGhlIGtleSBpcyBub3QgcHJlc2VudFxuY2xhc3MgU2ltcGxlQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGRlc3Ryb3lDb250ZW50ID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lDb250ZW50ID0gZGVzdHJveUNvbnRlbnQ7XG4gICAgfVxuXG4gICAgbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdHJveUNvbnRlbnQpIHtcbiAgICAgICAgICAgIHRoaXMubWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldChrZXksIG1pc3NGdW5jKSB7XG4gICAgICAgIGlmICghdGhpcy5tYXAuaGFzKGtleSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IG1pc3NGdW5jKCk7XG4gICAgICAgICAgICB0aGlzLm1hcC5zZXQoa2V5LCByZXN1bHQpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGtleSk7XG4gICAgfVxufVxuXG4vLyBjYWNoZSwgdXNlZCB0byBzdG9yZSBzYW1wbGVzLiB3ZSBzdG9yZSB0aGVzZSBzZXBhcmF0ZWx5IGZyb20gdGV4dHVyZXMgc2luY2UgbXVsdGlwbGVcbi8vIGRldmljZXMgY2FuIHVzZSB0aGUgc2FtZSBzZXQgb2Ygc2FtcGxlcy5cbmNvbnN0IHNhbXBsZXNDYWNoZSA9IG5ldyBTaW1wbGVDYWNoZShmYWxzZSk7XG5cbi8vIGNhY2hlLCBzdG9yaW5nIHNhbXBsZXMgc3RvcmVkIGluIHRleHR1cmVzLCB0aG9zZSBhcmUgcGVyIGRldmljZVxuY29uc3QgZGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuY29uc3QgZ2V0Q2FjaGVkVGV4dHVyZSA9IChkZXZpY2UsIGtleSwgZ2V0U2FtcGxlc0ZuYykgPT4ge1xuICAgIGNvbnN0IGNhY2hlID0gZGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFNpbXBsZUNhY2hlKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2FjaGUuZ2V0KGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gY3JlYXRlU2FtcGxlc1RleChkZXZpY2UsIGtleSwgc2FtcGxlc0NhY2hlLmdldChrZXksIGdldFNhbXBsZXNGbmMpKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlTGFtYmVydFNhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBsYW1iZXJ0LXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NvdXJjZVRvdGFsUGl4ZWxzfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlTGFtYmVydFNhbXBsZXMobnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYHBob25nLXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NwZWN1bGFyUG93ZXJ9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVQaG9uZ1NhbXBsZXMobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcik7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZUdHWFNhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBnZ3gtc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c3BlY3VsYXJQb3dlcn0tJHtzb3VyY2VUb3RhbFBpeGVsc31gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUdHWFNhbXBsZXMobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgdnNDb2RlID0gYFxuYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uO1xuXG51bmlmb3JtIHZlYzQgdXZNb2Q7XG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX1Bvc2l0aW9uID0gdmVjNCh2ZXJ0ZXhfcG9zaXRpb24sIDAuNSwgMS4wKTtcbiAgICB2VXYwID0gZ2V0SW1hZ2VFZmZlY3RVVigodmVydGV4X3Bvc2l0aW9uLnh5ICogMC41ICsgMC41KSAqIHV2TW9kLnh5ICsgdXZNb2QuencpO1xufVxuYDtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHJlcHJvamVjdHMgdGV4dHVyZXMgYmV0d2VlbiBjdWJlbWFwLCBlcXVpcmVjdGFuZ3VsYXIgYW5kIG9jdGFoZWRyYWwgZm9ybWF0cy4gVGhlXG4gKiBmdW5jdGlvbiBjYW4gcmVhZCBhbmQgd3JpdGUgdGV4dHVyZXMgd2l0aCBwaXhlbCBkYXRhIGluIFJHQkUsIFJHQk0sIGxpbmVhciBhbmQgc1JHQiBmb3JtYXRzLlxuICogV2hlbiBzcGVjdWxhclBvd2VyIGlzIHNwZWNpZmllZCBpdCB3aWxsIHBlcmZvcm0gYSBwaG9uZy13ZWlnaHRlZCBjb252b2x1dGlvbiBvZiB0aGUgc291cmNlIChmb3JcbiAqIGdlbmVyYXRpbmcgYSBnbG9zcyBtYXBzKS5cbiAqXG4gKiBAcGFyYW0ge1RleHR1cmV9IHNvdXJjZSAtIFRoZSBzb3VyY2UgdGV4dHVyZS5cbiAqIEBwYXJhbSB7VGV4dHVyZX0gdGFyZ2V0IC0gVGhlIHRhcmdldCB0ZXh0dXJlLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBvcHRpb25zIG9iamVjdC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zcGVjdWxhclBvd2VyXSAtIE9wdGlvbmFsIHNwZWN1bGFyIHBvd2VyLiBXaGVuIHNwZWN1bGFyIHBvd2VyIGlzXG4gKiBzcGVjaWZpZWQsIHRoZSBzb3VyY2UgaXMgY29udm9sdmVkIGJ5IGEgcGhvbmctd2VpZ2h0ZWQga2VybmVsIHJhaXNlZCB0byB0aGUgc3BlY2lmaWVkIHBvd2VyLlxuICogT3RoZXJ3aXNlIHRoZSBmdW5jdGlvbiBwZXJmb3JtcyBhIHN0YW5kYXJkIHJlc2FtcGxlLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm51bVNhbXBsZXNdIC0gT3B0aW9uYWwgbnVtYmVyIG9mIHNhbXBsZXMgKGRlZmF1bHQgaXMgMTAyNCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBPcHRpb25hbCBjdWJlbWFwIGZhY2UgdG8gdXBkYXRlIChkZWZhdWx0IGlzIHVwZGF0ZSBhbGwgZmFjZXMpLlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRpc3RyaWJ1dGlvbl0gLSBTcGVjaWZ5IGNvbnZvbHV0aW9uIGRpc3RyaWJ1dGlvbiAtICdub25lJywgJ2xhbWJlcnQnLFxuICogJ3Bob25nJywgJ2dneCcuIERlZmF1bHQgZGVwZW5kcyBvbiBzcGVjdWxhclBvd2VyLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gW29wdGlvbnMucmVjdF0gLSBPcHRpb25hbCB2aWV3cG9ydCByZWN0YW5nbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc2VhbVBpeGVsc10gLSBPcHRpb25hbCBudW1iZXIgb2Ygc2VhbSBwaXhlbHMgdG8gcmVuZGVyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgcmVwcm9qZWN0aW9uIHdhcyBhcHBsaWVkIGFuZCBmYWxzZSBvdGhlcndpc2UgKGUuZy4gaWYgcmVjdCBpcyBlbXB0eSlcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5mdW5jdGlvbiByZXByb2plY3RUZXh0dXJlKHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBtYWludGFpbiBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHByZXZpb3VzIGZ1bmN0aW9uIHNpZ25hdHVyZVxuICAgIC8vIHJlcHJvamVjdFRleHR1cmUoZGV2aWNlLCBzb3VyY2UsIHRhcmdldCwgc3BlY3VsYXJQb3dlciA9IDEsIG51bVNhbXBsZXMgPSAxMDI0KVxuICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICBzb3VyY2UgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgb3B0aW9ucyA9IHsgfTtcbiAgICAgICAgaWYgKGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNwZWN1bGFyUG93ZXIgPSBhcmd1bWVudHNbM107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFyZ3VtZW50c1s0XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLm51bVNhbXBsZXMgPSBhcmd1bWVudHNbNF07XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwbGVhc2UgdXNlIHRoZSB1cGRhdGVkIHBjLnJlcHJvamVjdFRleHR1cmUgQVBJLicpO1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBpbm5lciB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgY29uc3Qgc2VhbVBpeGVscyA9IG9wdGlvbnMuc2VhbVBpeGVscyA/PyAwO1xuICAgIGNvbnN0IGlubmVyV2lkdGggPSAob3B0aW9ucy5yZWN0Py56ID8/IHRhcmdldC53aWR0aCkgLSBzZWFtUGl4ZWxzICogMjtcbiAgICBjb25zdCBpbm5lckhlaWdodCA9IChvcHRpb25zLnJlY3Q/LncgPz8gdGFyZ2V0LmhlaWdodCkgLSBzZWFtUGl4ZWxzICogMjtcbiAgICBpZiAoaW5uZXJXaWR0aCA8IDEgfHwgaW5uZXJIZWlnaHQgPCAxKSB7XG4gICAgICAgIC8vIGVhcmx5IG91dCBpZiBpbm5lciBzcGFjZSBpcyBlbXB0eVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gdGFibGUgb2YgZGlzdHJpYnV0aW9uIC0+IGZ1bmN0aW9uIG5hbWVcbiAgICBjb25zdCBmdW5jTmFtZXMgPSB7XG4gICAgICAgICdub25lJzogJ3JlcHJvamVjdCcsXG4gICAgICAgICdsYW1iZXJ0JzogJ3ByZWZpbHRlclNhbXBsZXNVbndlaWdodGVkJyxcbiAgICAgICAgJ3Bob25nJzogJ3ByZWZpbHRlclNhbXBsZXNVbndlaWdodGVkJyxcbiAgICAgICAgJ2dneCc6ICdwcmVmaWx0ZXJTYW1wbGVzJ1xuICAgIH07XG5cbiAgICAvLyBleHRyYWN0IG9wdGlvbnNcbiAgICBjb25zdCBzcGVjdWxhclBvd2VyID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJQb3dlcicpID8gb3B0aW9ucy5zcGVjdWxhclBvd2VyIDogMTtcbiAgICBjb25zdCBmYWNlID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnZmFjZScpID8gb3B0aW9ucy5mYWNlIDogbnVsbDtcbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdkaXN0cmlidXRpb24nKSA/IG9wdGlvbnMuZGlzdHJpYnV0aW9uIDogKHNwZWN1bGFyUG93ZXIgPT09IDEpID8gJ25vbmUnIDogJ3Bob25nJztcblxuICAgIGNvbnN0IHByb2Nlc3NGdW5jID0gZnVuY05hbWVzW2Rpc3RyaWJ1dGlvbl0gfHwgJ3JlcHJvamVjdCc7XG4gICAgY29uc3QgcHJlZmlsdGVyU2FtcGxlcyA9IHByb2Nlc3NGdW5jLnN0YXJ0c1dpdGgoJ3ByZWZpbHRlclNhbXBsZXMnKTtcbiAgICBjb25zdCBkZWNvZGVGdW5jID0gQ2h1bmtVdGlscy5kZWNvZGVGdW5jKHNvdXJjZS5lbmNvZGluZyk7XG4gICAgY29uc3QgZW5jb2RlRnVuYyA9IENodW5rVXRpbHMuZW5jb2RlRnVuYyh0YXJnZXQuZW5jb2RpbmcpO1xuICAgIGNvbnN0IHNvdXJjZUZ1bmMgPSBgc2FtcGxlJHtnZXRQcm9qZWN0aW9uTmFtZShzb3VyY2UucHJvamVjdGlvbil9YDtcbiAgICBjb25zdCB0YXJnZXRGdW5jID0gYGdldERpcmVjdGlvbiR7Z2V0UHJvamVjdGlvbk5hbWUodGFyZ2V0LnByb2plY3Rpb24pfWA7XG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ251bVNhbXBsZXMnKSA/IG9wdGlvbnMubnVtU2FtcGxlcyA6IDEwMjQ7XG5cbiAgICAvLyBnZW5lcmF0ZSB1bmlxdWUgc2hhZGVyIGtleVxuICAgIGNvbnN0IHNoYWRlcktleSA9IGAke3Byb2Nlc3NGdW5jfV8ke2RlY29kZUZ1bmN9XyR7ZW5jb2RlRnVuY31fJHtzb3VyY2VGdW5jfV8ke3RhcmdldEZ1bmN9XyR7bnVtU2FtcGxlc31gO1xuXG4gICAgY29uc3QgZGV2aWNlID0gc291cmNlLmRldmljZTtcblxuICAgIGxldCBzaGFkZXIgPSBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpLmdldENhY2hlZFNoYWRlcihzaGFkZXJLZXkpO1xuICAgIGlmICghc2hhZGVyKSB7XG4gICAgICAgIGNvbnN0IGRlZmluZXMgPVxuICAgICAgICAgICAgYCNkZWZpbmUgUFJPQ0VTU19GVU5DICR7cHJvY2Vzc0Z1bmN9XFxuYCArXG4gICAgICAgICAgICAocHJlZmlsdGVyU2FtcGxlcyA/IGAjZGVmaW5lIFVTRV9TQU1QTEVTX1RFWFxcbmAgOiAnJykgK1xuICAgICAgICAgICAgKHNvdXJjZS5jdWJlbWFwID8gYCNkZWZpbmUgQ1VCRU1BUF9TT1VSQ0VcXG5gIDogJycpICtcbiAgICAgICAgICAgIGAjZGVmaW5lIERFQ09ERV9GVU5DICR7ZGVjb2RlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIEVOQ09ERV9GVU5DICR7ZW5jb2RlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIFNPVVJDRV9GVU5DICR7c291cmNlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIFRBUkdFVF9GVU5DICR7dGFyZ2V0RnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIE5VTV9TQU1QTEVTICR7bnVtU2FtcGxlc31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIE5VTV9TQU1QTEVTX1NRUlQgJHtNYXRoLnJvdW5kKE1hdGguc3FydChudW1TYW1wbGVzKSkudG9GaXhlZCgxKX1cXG5gO1xuXG4gICAgICAgIHNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKFxuICAgICAgICAgICAgZGV2aWNlLFxuICAgICAgICAgICAgdnNDb2RlLFxuICAgICAgICAgICAgYCR7ZGVmaW5lc31cXG4ke3NoYWRlckNodW5rcy5yZXByb2plY3RQU31gLFxuICAgICAgICAgICAgc2hhZGVyS2V5XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgXCJSZXByb2plY3RUZXh0dXJlXCIpO1xuXG4gICAgLy8gcmVuZGVyIHN0YXRlXG4gICAgLy8gVE9ETzogc2V0IHVwIG90aGVyIHJlbmRlciBzdGF0ZSBoZXJlIHRvIGV4cGVjdGVkIHN0YXRlXG4gICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcblxuICAgIGNvbnN0IGNvbnN0YW50U291cmNlID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoc291cmNlLmN1YmVtYXAgPyBcInNvdXJjZUN1YmVcIiA6IFwic291cmNlVGV4XCIpO1xuICAgIERlYnVnLmFzc2VydChjb25zdGFudFNvdXJjZSk7XG4gICAgY29uc3RhbnRTb3VyY2Uuc2V0VmFsdWUoc291cmNlKTtcblxuICAgIGNvbnN0IGNvbnN0YW50UGFyYW1zID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXNcIik7XG4gICAgY29uc3QgY29uc3RhbnRQYXJhbXMyID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXMyXCIpO1xuXG4gICAgY29uc3QgdXZNb2RQYXJhbSA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwidXZNb2RcIik7XG4gICAgaWYgKHNlYW1QaXhlbHMgPiAwKSB7XG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoW1xuICAgICAgICAgICAgKGlubmVyV2lkdGggKyBzZWFtUGl4ZWxzICogMikgLyBpbm5lcldpZHRoLFxuICAgICAgICAgICAgKGlubmVySGVpZ2h0ICsgc2VhbVBpeGVscyAqIDIpIC8gaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICAtc2VhbVBpeGVscyAvIGlubmVyV2lkdGgsXG4gICAgICAgICAgICAtc2VhbVBpeGVscyAvIGlubmVySGVpZ2h0XG4gICAgICAgIF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoWzEsIDEsIDAsIDBdKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBbXG4gICAgICAgIDAsXG4gICAgICAgIHNwZWN1bGFyUG93ZXIsXG4gICAgICAgIHNvdXJjZS5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyBzb3VyY2Uud2lkdGggOiAwLjAsICAgICAgICAgIC8vIHNvdXJjZSBzZWFtIHNjYWxlXG4gICAgICAgIHRhcmdldC5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyB0YXJnZXQud2lkdGggOiAwLjAgICAgICAgICAgIC8vIHRhcmdldCBzZWFtIHNjYWxlXG4gICAgXTtcblxuICAgIGNvbnN0IHBhcmFtczIgPSBbXG4gICAgICAgIHRhcmdldC53aWR0aCAqIHRhcmdldC5oZWlnaHQgKiAodGFyZ2V0LmN1YmVtYXAgPyA2IDogMSksXG4gICAgICAgIHNvdXJjZS53aWR0aCAqIHNvdXJjZS5oZWlnaHQgKiAoc291cmNlLmN1YmVtYXAgPyA2IDogMSlcbiAgICBdO1xuXG4gICAgaWYgKHByZWZpbHRlclNhbXBsZXMpIHtcbiAgICAgICAgLy8gc2V0IG9yIGdlbmVyYXRlIHRoZSBwcmUtY2FsY3VsYXRlZCBzYW1wbGVzIGRhdGFcbiAgICAgICAgY29uc3Qgc291cmNlVG90YWxQaXhlbHMgPSBzb3VyY2Uud2lkdGggKiBzb3VyY2UuaGVpZ2h0ICogKHNvdXJjZS5jdWJlbWFwID8gNiA6IDEpO1xuICAgICAgICBjb25zdCBzYW1wbGVzVGV4ID1cbiAgICAgICAgICAgIChkaXN0cmlidXRpb24gPT09ICdnZ3gnKSA/IGdlbmVyYXRlR0dYU2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA6XG4gICAgICAgICAgICAgICAgKChkaXN0cmlidXRpb24gPT09ICdsYW1iZXJ0JykgPyBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSk7XG4gICAgICAgIGRldmljZS5zY29wZS5yZXNvbHZlKFwic2FtcGxlc1RleFwiKS5zZXRWYWx1ZShzYW1wbGVzVGV4KTtcbiAgICAgICAgZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJzYW1wbGVzVGV4SW52ZXJzZVNpemVcIikuc2V0VmFsdWUoWzEuMCAvIHNhbXBsZXNUZXgud2lkdGgsIDEuMCAvIHNhbXBsZXNUZXguaGVpZ2h0XSk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgZiA9IDA7IGYgPCAodGFyZ2V0LmN1YmVtYXAgPyA2IDogMSk7IGYrKykge1xuICAgICAgICBpZiAoZmFjZSA9PT0gbnVsbCB8fCBmID09PSBmYWNlKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJUYXJnZXQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGFyZ2V0LFxuICAgICAgICAgICAgICAgIGZhY2U6IGYsXG4gICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZsaXBZOiBkZXZpY2UuaXNXZWJHUFVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gZjtcbiAgICAgICAgICAgIGNvbnN0YW50UGFyYW1zLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICBjb25zdGFudFBhcmFtczIuc2V0VmFsdWUocGFyYW1zMik7XG5cbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHJlbmRlclRhcmdldCwgc2hhZGVyLCBvcHRpb25zPy5yZWN0KTtcblxuICAgICAgICAgICAgcmVuZGVyVGFyZ2V0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IHsgcmVwcm9qZWN0VGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImdldFByb2plY3Rpb25OYW1lIiwicHJvamVjdGlvbiIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMIiwicGFja0Zsb2F0MzJUb1JHQkE4IiwidmFsdWUiLCJhcnJheSIsIm9mZnNldCIsImVuY1giLCJlbmNZIiwiZW5jWiIsImVuY1ciLCJNYXRoIiwibWluIiwiZmxvb3IiLCJwYWNrU2FtcGxlcyIsInNhbXBsZXMiLCJudW1TYW1wbGVzIiwibGVuZ3RoIiwidyIsImgiLCJjZWlsIiwiZGF0YSIsIlVpbnQ4QXJyYXkiLCJvZmYiLCJpIiwid2lkdGgiLCJoZWlnaHQiLCJoZW1pc3BoZXJlU2FtcGxlUGhvbmciLCJkc3RWZWMiLCJ4IiwieSIsInNwZWN1bGFyUG93ZXIiLCJwaGkiLCJQSSIsImNvc1RoZXRhIiwicG93Iiwic2luVGhldGEiLCJzcXJ0Iiwic2V0IiwiY29zIiwic2luIiwibm9ybWFsaXplIiwiaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQiLCJoZW1pc3BoZXJlU2FtcGxlR0dYIiwiYSIsIkRfR0dYIiwiTm9IIiwibGluZWFyUm91Z2huZXNzIiwiayIsImdlbmVyYXRlUGhvbmdTYW1wbGVzIiwiSCIsIlZlYzMiLCJyZXN1bHQiLCJyYW5kb20iLCJyYWRpY2FsSW52ZXJzZSIsInB1c2giLCJ6IiwiZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyIsInNvdXJjZVRvdGFsUGl4ZWxzIiwicGl4ZWxzUGVyU2FtcGxlIiwicGRmIiwibWlwTGV2ZWwiLCJsb2cyIiwicmVxdWlyZWRTYW1wbGVzR0dYIiwiZ2V0UmVxdWlyZWRTYW1wbGVzR0dYIiwidGFibGUiLCJnZW5lcmF0ZUdHWFNhbXBsZXMiLCJyb3VnaG5lc3MiLCJMIiwiTiIsInJlcXVpcmVkU2FtcGxlcyIsIm11bFNjYWxhciIsInN1YiIsImNyZWF0ZVNhbXBsZXNUZXgiLCJkZXZpY2UiLCJuYW1lIiwicGFja2VkU2FtcGxlcyIsIlRleHR1cmUiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJsZXZlbHMiLCJTaW1wbGVDYWNoZSIsImNvbnN0cnVjdG9yIiwiZGVzdHJveUNvbnRlbnQiLCJtYXAiLCJNYXAiLCJkZXN0cm95IiwiZm9yRWFjaCIsImtleSIsImdldCIsIm1pc3NGdW5jIiwiaGFzIiwic2FtcGxlc0NhY2hlIiwiZGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsImdldENhY2hlZFRleHR1cmUiLCJnZXRTYW1wbGVzRm5jIiwiY2FjaGUiLCJnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4IiwiZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXgiLCJnZW5lcmF0ZUdHWFNhbXBsZXNUZXgiLCJ2c0NvZGUiLCJyZXByb2plY3RUZXh0dXJlIiwic291cmNlIiwidGFyZ2V0Iiwib3B0aW9ucyIsIl9vcHRpb25zJHNlYW1QaXhlbHMiLCJfb3B0aW9ucyRyZWN0JHoiLCJfb3B0aW9ucyRyZWN0IiwiX29wdGlvbnMkcmVjdCR3IiwiX29wdGlvbnMkcmVjdDIiLCJHcmFwaGljc0RldmljZSIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInNlYW1QaXhlbHMiLCJpbm5lcldpZHRoIiwicmVjdCIsImlubmVySGVpZ2h0IiwiZnVuY05hbWVzIiwiaGFzT3duUHJvcGVydHkiLCJmYWNlIiwiZGlzdHJpYnV0aW9uIiwicHJvY2Vzc0Z1bmMiLCJwcmVmaWx0ZXJTYW1wbGVzIiwic3RhcnRzV2l0aCIsImRlY29kZUZ1bmMiLCJDaHVua1V0aWxzIiwiZW5jb2RpbmciLCJlbmNvZGVGdW5jIiwic291cmNlRnVuYyIsInRhcmdldEZ1bmMiLCJzaGFkZXJLZXkiLCJzaGFkZXIiLCJnZXRQcm9ncmFtTGlicmFyeSIsImdldENhY2hlZFNoYWRlciIsImRlZmluZXMiLCJjdWJlbWFwIiwicm91bmQiLCJ0b0ZpeGVkIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJzaGFkZXJDaHVua3MiLCJyZXByb2plY3RQUyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwic2V0QmxlbmRTdGF0ZSIsIkJsZW5kU3RhdGUiLCJOT0JMRU5EIiwiY29uc3RhbnRTb3VyY2UiLCJzY29wZSIsInJlc29sdmUiLCJhc3NlcnQiLCJzZXRWYWx1ZSIsImNvbnN0YW50UGFyYW1zIiwiY29uc3RhbnRQYXJhbXMyIiwidXZNb2RQYXJhbSIsInBhcmFtcyIsImZpeEN1YmVtYXBTZWFtcyIsInBhcmFtczIiLCJzYW1wbGVzVGV4IiwiZiIsIl9vcHRpb25zIiwicmVuZGVyVGFyZ2V0IiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsImZsaXBZIiwiaXNXZWJHUFUiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJwb3BHcHVNYXJrZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxQkEsTUFBTUEsaUJBQWlCLEdBQUlDLFVBQVUsSUFBSztBQUN0QyxFQUFBLFFBQVFBLFVBQVU7QUFDZCxJQUFBLEtBQUtDLHNCQUFzQjtBQUN2QixNQUFBLE9BQU8sU0FBUyxDQUFBO0FBQ3BCLElBQUEsS0FBS0MsNEJBQTRCO0FBQzdCLE1BQUEsT0FBTyxZQUFZLENBQUE7QUFDdkIsSUFBQTtBQUFTO0FBQ0wsTUFBQSxPQUFPLFVBQVUsQ0FBQTtBQUN6QixHQUFBO0FBQ0osQ0FBQyxDQUFBOztBQUVEO0FBQ0EsTUFBTUMsa0JBQWtCLEdBQUdBLENBQUNDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEtBQUs7RUFDakQsSUFBSUYsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNaQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDekIsR0FBQyxNQUFNLElBQUlGLEtBQUssSUFBSSxHQUFHLEVBQUU7QUFDckJDLElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQTtBQUN2QkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FB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
