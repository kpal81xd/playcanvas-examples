import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTSHAPE_PUNCTUAL } from '../constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { LightCamera } from '../renderer/light-camera.js';

const epsilon = 0.000001;
const tempVec3 = new Vec3();
const tempAreaLightSizes = new Float32Array(6);
const areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
const areaHalfAxisHeight = new Vec3(0, 0, 0.5);

// format of a row in 8 bit texture used to encode light data
// this is used to store data in the texture correctly, and also use to generate defines for the shader
const TextureIndex8 = {
  // always 8bit texture data, regardless of float texture support
  FLAGS: 0,
  // lightType, lightShape, fallofMode, castShadows
  COLOR_A: 1,
  // color.r, color.r, color.g, color.g    // HDR color is stored using 2 bytes per channel
  COLOR_B: 2,
  // color.b, color.b, useCookie, lightMask
  SPOT_ANGLES: 3,
  // spotInner, spotInner, spotOuter, spotOuter
  SHADOW_BIAS: 4,
  // bias, bias, normalBias, normalBias
  COOKIE_A: 5,
  // cookieIntensity, cookieIsRgb, -, -
  COOKIE_B: 6,
  // cookieChannelMask.xyzw

  // leave in-between
  COUNT_ALWAYS: 7,
  // 8bit texture data used when float texture is not supported
  POSITION_X: 7,
  // position.x
  POSITION_Y: 8,
  // position.y
  POSITION_Z: 9,
  // position.z
  RANGE: 10,
  // range
  SPOT_DIRECTION_X: 11,
  // spot direction x
  SPOT_DIRECTION_Y: 12,
  // spot direction y
  SPOT_DIRECTION_Z: 13,
  // spot direction z

  PROJ_MAT_00: 14,
  // light projection matrix, mat4, 16 floats
  ATLAS_VIEWPORT_A: 14,
  // viewport.x, viewport.x, viewport.y, viewport.y

  PROJ_MAT_01: 15,
  ATLAS_VIEWPORT_B: 15,
  // viewport.z, viewport.z, -, -

  PROJ_MAT_02: 16,
  PROJ_MAT_03: 17,
  PROJ_MAT_10: 18,
  PROJ_MAT_11: 19,
  PROJ_MAT_12: 20,
  PROJ_MAT_13: 21,
  PROJ_MAT_20: 22,
  PROJ_MAT_21: 23,
  PROJ_MAT_22: 24,
  PROJ_MAT_23: 25,
  PROJ_MAT_30: 26,
  PROJ_MAT_31: 27,
  PROJ_MAT_32: 28,
  PROJ_MAT_33: 29,
  AREA_DATA_WIDTH_X: 30,
  AREA_DATA_WIDTH_Y: 31,
  AREA_DATA_WIDTH_Z: 32,
  AREA_DATA_HEIGHT_X: 33,
  AREA_DATA_HEIGHT_Y: 34,
  AREA_DATA_HEIGHT_Z: 35,
  // leave last
  COUNT: 36
};

// format of the float texture
const TextureIndexFloat = {
  POSITION_RANGE: 0,
  // positions.xyz, range
  SPOT_DIRECTION: 1,
  // spot direction.xyz, -

  PROJ_MAT_0: 2,
  // projection matrix row 0 (spot light)
  ATLAS_VIEWPORT: 2,
  // atlas viewport data (omni light)

  PROJ_MAT_1: 3,
  // projection matrix row 1 (spot light)
  PROJ_MAT_2: 4,
  // projection matrix row 2 (spot light)
  PROJ_MAT_3: 5,
  // projection matrix row 3 (spot light)

  AREA_DATA_WIDTH: 6,
  // area light half-width.xyz, -
  AREA_DATA_HEIGHT: 7,
  // area light half-height.xyz, -

  // leave last
  COUNT: 8
};

// format for high precision light texture - float
const FORMAT_FLOAT = 0;

// format for high precision light texture - 8bit
const FORMAT_8BIT = 1;

// device cache storing shader defines for the device
const shaderDefinesDeviceCache = new DeviceCache();

// A class used by clustered lighting, responsible for encoding light properties into textures for the use on the GPU
class LightsBuffer {
  static getLightTextureFormat(device) {
    // precision for texture storage
    // don't use float texture on devices with small number of texture units (as it uses both float and 8bit textures at the same time)
    return device.extTextureFloat && device.maxTextures > 8 ? FORMAT_FLOAT : FORMAT_8BIT;
  }
  static getShaderDefines(device) {
    // return defines for this device from the cache, or create them if not cached yet
    return shaderDefinesDeviceCache.get(device, () => {
      // converts object with properties to a list of these as an example: "#define CLUSTER_TEXTURE_8_BLAH 1.5"
      const buildShaderDefines = (device, object, prefix, floatOffset) => {
        return Object.keys(object).map(key => `#define ${prefix}${key} ${object[key]}${floatOffset}`).join('\n');
      };
      const lightTextureFormat = LightsBuffer.getLightTextureFormat(device);
      const clusterTextureFormat = lightTextureFormat === FORMAT_FLOAT ? 'FLOAT' : '8BIT';

      // on webgl2 and WebGPU we use texelFetch instruction to read data textures, and don't need the offset
      const floatOffset = device.supportsTextureFetch ? '' : '.5';
      return `
                \n#define CLUSTER_TEXTURE_${clusterTextureFormat}
                ${buildShaderDefines(device, TextureIndex8, 'CLUSTER_TEXTURE_8_', floatOffset)}
                ${buildShaderDefines(device, TextureIndexFloat, 'CLUSTER_TEXTURE_F_', floatOffset)}
            `;
    });
  }
  constructor(device) {
    this.device = device;

    // features
    this.cookiesEnabled = false;
    this.shadowsEnabled = false;
    this.areaLightsEnabled = false;

    // using 8 bit index so this is maximum supported number of lights
    this.maxLights = 255;

    // shared 8bit texture pixels:
    let pixelsPerLight8 = TextureIndex8.COUNT_ALWAYS;
    let pixelsPerLightFloat = 0;
    this.lightTextureFormat = LightsBuffer.getLightTextureFormat(device);

    // float texture format
    if (this.lightTextureFormat === FORMAT_FLOAT) {
      pixelsPerLightFloat = TextureIndexFloat.COUNT;
    } else {
      // 8bit texture
      pixelsPerLight8 = TextureIndex8.COUNT;
    }

    // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
    this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
    this.lightsTexture8 = this.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_RGBA8, 'LightsTexture8');
    this._lightsTexture8Id = this.device.scope.resolve('lightsTexture8');

    // float texture
    if (pixelsPerLightFloat) {
      this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
      this.lightsTextureFloat = this.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F, 'LightsTextureFloat');
      this._lightsTextureFloatId = this.device.scope.resolve('lightsTextureFloat');
    } else {
      this.lightsFloat = null;
      this.lightsTextureFloat = null;
      this._lightsTextureFloatId = undefined;
    }

    // inverse sizes for both textures
    this._lightsTextureInvSizeId = this.device.scope.resolve('lightsTextureInvSize');
    this._lightsTextureInvSizeData = new Float32Array(4);
    this._lightsTextureInvSizeData[0] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.width : 0;
    this._lightsTextureInvSizeData[1] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.height : 0;
    this._lightsTextureInvSizeData[2] = 1.0 / this.lightsTexture8.width;
    this._lightsTextureInvSizeData[3] = 1.0 / this.lightsTexture8.height;

    // compression ranges
    this.invMaxColorValue = 0;
    this.invMaxAttenuation = 0;
    this.boundsMin = new Vec3();
    this.boundsDelta = new Vec3();
  }
  destroy() {
    // release textures
    if (this.lightsTexture8) {
      this.lightsTexture8.destroy();
      this.lightsTexture8 = null;
    }
    if (this.lightsTextureFloat) {
      this.lightsTextureFloat.destroy();
      this.lightsTextureFloat = null;
    }
  }
  createTexture(device, width, height, format, name) {
    const tex = new Texture(device, {
      name: name,
      width: width,
      height: height,
      mipmaps: false,
      format: format,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      type: TEXTURETYPE_DEFAULT,
      magFilter: FILTER_NEAREST,
      minFilter: FILTER_NEAREST,
      anisotropy: 1
    });
    return tex;
  }
  setCompressionRanges(maxAttenuation, maxColorValue) {
    this.invMaxColorValue = 1 / maxColorValue;
    this.invMaxAttenuation = 1 / maxAttenuation;
  }
  setBounds(min, delta) {
    this.boundsMin.copy(min);
    this.boundsDelta.copy(delta);
  }
  uploadTextures() {
    if (this.lightsTextureFloat) {
      this.lightsTextureFloat.lock().set(this.lightsFloat);
      this.lightsTextureFloat.unlock();
    }
    this.lightsTexture8.lock().set(this.lights8);
    this.lightsTexture8.unlock();
  }
  updateUniforms() {
    // textures
    this._lightsTexture8Id.setValue(this.lightsTexture8);
    if (this.lightTextureFormat === FORMAT_FLOAT) {
      this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
    }
    this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
  }
  getSpotDirection(direction, spot) {
    // Spots shine down the negative Y axis
    const mat = spot._node.getWorldTransform();
    mat.getY(direction).mulScalar(-1);
    direction.normalize();
  }

  // half sizes of area light in world space, returned as an array of 6 floats
  getLightAreaSizes(light) {
    const mat = light._node.getWorldTransform();
    mat.transformVector(areaHalfAxisWidth, tempVec3);
    tempAreaLightSizes[0] = tempVec3.x;
    tempAreaLightSizes[1] = tempVec3.y;
    tempAreaLightSizes[2] = tempVec3.z;
    mat.transformVector(areaHalfAxisHeight, tempVec3);
    tempAreaLightSizes[3] = tempVec3.x;
    tempAreaLightSizes[4] = tempVec3.y;
    tempAreaLightSizes[5] = tempVec3.z;
    return tempAreaLightSizes;
  }
  addLightDataFlags(data8, index, light, isSpot, castShadows, shadowIntensity) {
    data8[index + 0] = isSpot ? 255 : 0;
    data8[index + 1] = light._shape * 64; // value 0..3
    data8[index + 2] = light._falloffMode * 255; // value 0..1
    data8[index + 3] = castShadows ? shadowIntensity * 255 : 0;
  }
  addLightDataColor(data8, index, light, gammaCorrection, isCookie) {
    const invMaxColorValue = this.invMaxColorValue;
    const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
    FloatPacking.float2Bytes(color[0] * invMaxColorValue, data8, index + 0, 2);
    FloatPacking.float2Bytes(color[1] * invMaxColorValue, data8, index + 2, 2);
    FloatPacking.float2Bytes(color[2] * invMaxColorValue, data8, index + 4, 2);

    // cookie
    data8[index + 6] = isCookie ? 255 : 0;

    // lightMask
    // 0: MASK_AFFECT_DYNAMIC
    // 127: MASK_AFFECT_DYNAMIC && MASK_AFFECT_LIGHTMAPPED
    // 255: MASK_AFFECT_LIGHTMAPPED
    const isDynamic = !!(light.mask & MASK_AFFECT_DYNAMIC);
    const isLightmapped = !!(light.mask & MASK_AFFECT_LIGHTMAPPED);
    data8[index + 7] = isDynamic && isLightmapped ? 127 : isLightmapped ? 255 : 0;
  }
  addLightDataSpotAngles(data8, index, light) {
    // 2 bytes each
    FloatPacking.float2Bytes(light._innerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 0, 2);
    FloatPacking.float2Bytes(light._outerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 2, 2);
  }
  addLightDataShadowBias(data8, index, light) {
    const lightRenderData = light.getRenderData(null, 0);
    const biases = light._getUniformBiasValues(lightRenderData);
    FloatPacking.float2BytesRange(biases.bias, data8, index, -1, 20, 2); // bias: -1 to 20 range
    FloatPacking.float2Bytes(biases.normalBias, data8, index + 2, 2); // normalBias: 0 to 1 range
  }

  addLightDataPositionRange(data8, index, light, pos) {
    // position and range scaled to 0..1 range
    const normPos = tempVec3.sub2(pos, this.boundsMin).div(this.boundsDelta);
    FloatPacking.float2Bytes(normPos.x, data8, index + 0, 4);
    FloatPacking.float2Bytes(normPos.y, data8, index + 4, 4);
    FloatPacking.float2Bytes(normPos.z, data8, index + 8, 4);
    FloatPacking.float2Bytes(light.attenuationEnd * this.invMaxAttenuation, data8, index + 12, 4);
  }
  addLightDataSpotDirection(data8, index, light) {
    this.getSpotDirection(tempVec3, light);
    FloatPacking.float2Bytes(tempVec3.x * (0.5 - epsilon) + 0.5, data8, index + 0, 4);
    FloatPacking.float2Bytes(tempVec3.y * (0.5 - epsilon) + 0.5, data8, index + 4, 4);
    FloatPacking.float2Bytes(tempVec3.z * (0.5 - epsilon) + 0.5, data8, index + 8, 4);
  }
  addLightDataLightProjMatrix(data8, index, lightProjectionMatrix) {
    const matData = lightProjectionMatrix.data;
    for (let m = 0; m < 12; m++)
    // these are in -2..2 range
    FloatPacking.float2BytesRange(matData[m], data8, index + 4 * m, -2, 2, 4);
    for (let m = 12; m < 16; m++) {
      // these are full float range
      FloatPacking.float2MantissaExponent(matData[m], data8, index + 4 * m, 4);
    }
  }
  addLightDataCookies(data8, index, light) {
    const isRgb = light._cookieChannel === 'rgb';
    data8[index + 0] = Math.floor(light.cookieIntensity * 255);
    data8[index + 1] = isRgb ? 255 : 0;
    // we have two unused bytes here

    if (!isRgb) {
      const channel = light._cookieChannel;
      data8[index + 4] = channel === 'rrr' ? 255 : 0;
      data8[index + 5] = channel === 'ggg' ? 255 : 0;
      data8[index + 6] = channel === 'bbb' ? 255 : 0;
      data8[index + 7] = channel === 'aaa' ? 255 : 0;
    }
  }
  addLightAtlasViewport(data8, index, atlasViewport) {
    // all these are in 0..1 range
    FloatPacking.float2Bytes(atlasViewport.x, data8, index + 0, 2);
    FloatPacking.float2Bytes(atlasViewport.y, data8, index + 2, 2);
    FloatPacking.float2Bytes(atlasViewport.z / 3, data8, index + 4, 2);
    // we have two unused bytes here
  }

  addLightAreaSizes(data8, index, light) {
    const areaSizes = this.getLightAreaSizes(light);
    for (let i = 0; i < 6; i++) {
      // these are full float range
      FloatPacking.float2MantissaExponent(areaSizes[i], data8, index + 4 * i, 4);
    }
  }

  // fill up both float and 8bit texture data with light properties
  addLightData(light, lightIndex, gammaCorrection) {
    const isSpot = light._type === LIGHTTYPE_SPOT;
    const hasAtlasViewport = light.atlasViewportAllocated; // if the light does not have viewport, it does not fit to the atlas
    const isCookie = this.cookiesEnabled && !!light._cookie && hasAtlasViewport;
    const isArea = this.areaLightsEnabled && light.shape !== LIGHTSHAPE_PUNCTUAL;
    const castShadows = this.shadowsEnabled && light.castShadows && hasAtlasViewport;
    const pos = light._node.getPosition();
    let lightProjectionMatrix = null; // light projection matrix - used for shadow map and cookie of spot light
    let atlasViewport = null; // atlas viewport info - used for shadow map and cookie of omni light
    if (isSpot) {
      if (castShadows) {
        const lightRenderData = light.getRenderData(null, 0);
        lightProjectionMatrix = lightRenderData.shadowMatrix;
      } else if (isCookie) {
        lightProjectionMatrix = LightCamera.evalSpotCookieMatrix(light);
      }
    } else {
      if (castShadows || isCookie) {
        atlasViewport = light.atlasViewport;
      }
    }

    // data always stored in 8bit texture
    const data8 = this.lights8;
    const data8Start = lightIndex * this.lightsTexture8.width * 4;

    // flags
    this.addLightDataFlags(data8, data8Start + 4 * TextureIndex8.FLAGS, light, isSpot, castShadows, light.shadowIntensity);

    // light color
    this.addLightDataColor(data8, data8Start + 4 * TextureIndex8.COLOR_A, light, gammaCorrection, isCookie);

    // spot light angles
    if (isSpot) {
      this.addLightDataSpotAngles(data8, data8Start + 4 * TextureIndex8.SPOT_ANGLES, light);
    }

    // shadow biases
    if (light.castShadows) {
      this.addLightDataShadowBias(data8, data8Start + 4 * TextureIndex8.SHADOW_BIAS, light);
    }

    // cookie properties
    if (isCookie) {
      this.addLightDataCookies(data8, data8Start + 4 * TextureIndex8.COOKIE_A, light);
    }

    // high precision data stored using float texture
    if (this.lightTextureFormat === FORMAT_FLOAT) {
      const dataFloat = this.lightsFloat;
      const dataFloatStart = lightIndex * this.lightsTextureFloat.width * 4;

      // pos and range
      dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 0] = pos.x;
      dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 1] = pos.y;
      dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 2] = pos.z;
      dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 3] = light.attenuationEnd;

      // spot direction
      if (isSpot) {
        this.getSpotDirection(tempVec3, light);
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 0] = tempVec3.x;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 1] = tempVec3.y;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 2] = tempVec3.z;
        // here we have unused float
      }

      // light projection matrix
      if (lightProjectionMatrix) {
        const matData = lightProjectionMatrix.data;
        for (let m = 0; m < 16; m++) dataFloat[dataFloatStart + 4 * TextureIndexFloat.PROJ_MAT_0 + m] = matData[m];
      }
      if (atlasViewport) {
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 0] = atlasViewport.x;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 1] = atlasViewport.y;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 2] = atlasViewport.z / 3; // size of a face slot (3x3 grid)
      }

      // area light sizes
      if (isArea) {
        const areaSizes = this.getLightAreaSizes(light);
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 0] = areaSizes[0];
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 1] = areaSizes[1];
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 2] = areaSizes[2];
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 0] = areaSizes[3];
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 1] = areaSizes[4];
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 2] = areaSizes[5];
      }
    } else {
      // high precision data stored using 8bit texture

      this.addLightDataPositionRange(data8, data8Start + 4 * TextureIndex8.POSITION_X, light, pos);

      // spot direction
      if (isSpot) {
        this.addLightDataSpotDirection(data8, data8Start + 4 * TextureIndex8.SPOT_DIRECTION_X, light);
      }

      // light projection matrix
      if (lightProjectionMatrix) {
        this.addLightDataLightProjMatrix(data8, data8Start + 4 * TextureIndex8.PROJ_MAT_00, lightProjectionMatrix);
      }
      if (atlasViewport) {
        this.addLightAtlasViewport(data8, data8Start + 4 * TextureIndex8.ATLAS_VIEWPORT_A, atlasViewport);
      }

      // area light sizes
      if (isArea) {
        this.addLightAreaSizes(data8, data8Start + 4 * TextureIndex8.AREA_DATA_WIDTH_X, light);
      }
    }
  }
}

export { LightsBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRzLWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIFRFWFRVUkVUWVBFX0RFRkFVTFQsIEZJTFRFUl9ORUFSRVNUIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEZsb2F0UGFja2luZyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9mbG9hdC1wYWNraW5nLmpzJztcbmltcG9ydCB7IExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hUVFlQRV9TUE9ULCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCwgTUFTS19BRkZFQ1RfRFlOQU1JQyB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZXZpY2VDYWNoZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RldmljZS1jYWNoZS5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4uL3JlbmRlcmVyL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmNvbnN0IGVwc2lsb24gPSAwLjAwMDAwMTtcblxuY29uc3QgdGVtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgdGVtcEFyZWFMaWdodFNpemVzID0gbmV3IEZsb2F0MzJBcnJheSg2KTtcbmNvbnN0IGFyZWFIYWxmQXhpc1dpZHRoID0gbmV3IFZlYzMoLTAuNSwgMCwgMCk7XG5jb25zdCBhcmVhSGFsZkF4aXNIZWlnaHQgPSBuZXcgVmVjMygwLCAwLCAwLjUpO1xuXG4vLyBmb3JtYXQgb2YgYSByb3cgaW4gOCBiaXQgdGV4dHVyZSB1c2VkIHRvIGVuY29kZSBsaWdodCBkYXRhXG4vLyB0aGlzIGlzIHVzZWQgdG8gc3RvcmUgZGF0YSBpbiB0aGUgdGV4dHVyZSBjb3JyZWN0bHksIGFuZCBhbHNvIHVzZSB0byBnZW5lcmF0ZSBkZWZpbmVzIGZvciB0aGUgc2hhZGVyXG5jb25zdCBUZXh0dXJlSW5kZXg4ID0ge1xuXG4gICAgLy8gYWx3YXlzIDhiaXQgdGV4dHVyZSBkYXRhLCByZWdhcmRsZXNzIG9mIGZsb2F0IHRleHR1cmUgc3VwcG9ydFxuICAgIEZMQUdTOiAwLCAgICAgICAgICAgICAgICAgICAvLyBsaWdodFR5cGUsIGxpZ2h0U2hhcGUsIGZhbGxvZk1vZGUsIGNhc3RTaGFkb3dzXG4gICAgQ09MT1JfQTogMSwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLnIsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmcgICAgLy8gSERSIGNvbG9yIGlzIHN0b3JlZCB1c2luZyAyIGJ5dGVzIHBlciBjaGFubmVsXG4gICAgQ09MT1JfQjogMiwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLmIsIGNvbG9yLmIsIHVzZUNvb2tpZSwgbGlnaHRNYXNrXG4gICAgU1BPVF9BTkdMRVM6IDMsICAgICAgICAgICAgIC8vIHNwb3RJbm5lciwgc3BvdElubmVyLCBzcG90T3V0ZXIsIHNwb3RPdXRlclxuICAgIFNIQURPV19CSUFTOiA0LCAgICAgICAgICAgICAvLyBiaWFzLCBiaWFzLCBub3JtYWxCaWFzLCBub3JtYWxCaWFzXG4gICAgQ09PS0lFX0E6IDUsICAgICAgICAgICAgICAgIC8vIGNvb2tpZUludGVuc2l0eSwgY29va2llSXNSZ2IsIC0sIC1cbiAgICBDT09LSUVfQjogNiwgICAgICAgICAgICAgICAgLy8gY29va2llQ2hhbm5lbE1hc2sueHl6d1xuXG4gICAgLy8gbGVhdmUgaW4tYmV0d2VlblxuICAgIENPVU5UX0FMV0FZUzogNyxcblxuICAgIC8vIDhiaXQgdGV4dHVyZSBkYXRhIHVzZWQgd2hlbiBmbG9hdCB0ZXh0dXJlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBQT1NJVElPTl9YOiA3LCAgICAgICAgICAgICAgLy8gcG9zaXRpb24ueFxuICAgIFBPU0lUSU9OX1k6IDgsICAgICAgICAgICAgICAvLyBwb3NpdGlvbi55XG4gICAgUE9TSVRJT05fWjogOSwgICAgICAgICAgICAgIC8vIHBvc2l0aW9uLnpcbiAgICBSQU5HRTogMTAsICAgICAgICAgICAgICAgICAgLy8gcmFuZ2VcbiAgICBTUE9UX0RJUkVDVElPTl9YOiAxMSwgICAgICAgLy8gc3BvdCBkaXJlY3Rpb24geFxuICAgIFNQT1RfRElSRUNUSU9OX1k6IDEyLCAgICAgICAvLyBzcG90IGRpcmVjdGlvbiB5XG4gICAgU1BPVF9ESVJFQ1RJT05fWjogMTMsICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uIHpcblxuICAgIFBST0pfTUFUXzAwOiAxNCwgICAgICAgICAgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeCwgbWF0NCwgMTYgZmxvYXRzXG4gICAgQVRMQVNfVklFV1BPUlRfQTogMTQsICAgICAgIC8vIHZpZXdwb3J0LngsIHZpZXdwb3J0LngsIHZpZXdwb3J0LnksIHZpZXdwb3J0LnlcblxuICAgIFBST0pfTUFUXzAxOiAxNSxcbiAgICBBVExBU19WSUVXUE9SVF9COiAxNSwgICAgICAgLy8gdmlld3BvcnQueiwgdmlld3BvcnQueiwgLSwgLVxuXG4gICAgUFJPSl9NQVRfMDI6IDE2LFxuICAgIFBST0pfTUFUXzAzOiAxNyxcbiAgICBQUk9KX01BVF8xMDogMTgsXG4gICAgUFJPSl9NQVRfMTE6IDE5LFxuICAgIFBST0pfTUFUXzEyOiAyMCxcbiAgICBQUk9KX01BVF8xMzogMjEsXG4gICAgUFJPSl9NQVRfMjA6IDIyLFxuICAgIFBST0pfTUFUXzIxOiAyMyxcbiAgICBQUk9KX01BVF8yMjogMjQsXG4gICAgUFJPSl9NQVRfMjM6IDI1LFxuICAgIFBST0pfTUFUXzMwOiAyNixcbiAgICBQUk9KX01BVF8zMTogMjcsXG4gICAgUFJPSl9NQVRfMzI6IDI4LFxuICAgIFBST0pfTUFUXzMzOiAyOSxcblxuICAgIEFSRUFfREFUQV9XSURUSF9YOiAzMCxcbiAgICBBUkVBX0RBVEFfV0lEVEhfWTogMzEsXG4gICAgQVJFQV9EQVRBX1dJRFRIX1o6IDMyLFxuICAgIEFSRUFfREFUQV9IRUlHSFRfWDogMzMsXG4gICAgQVJFQV9EQVRBX0hFSUdIVF9ZOiAzNCxcbiAgICBBUkVBX0RBVEFfSEVJR0hUX1o6IDM1LFxuXG4gICAgLy8gbGVhdmUgbGFzdFxuICAgIENPVU5UOiAzNlxufTtcblxuLy8gZm9ybWF0IG9mIHRoZSBmbG9hdCB0ZXh0dXJlXG5jb25zdCBUZXh0dXJlSW5kZXhGbG9hdCA9IHtcbiAgICBQT1NJVElPTl9SQU5HRTogMCwgICAgICAgICAgICAgIC8vIHBvc2l0aW9ucy54eXosIHJhbmdlXG4gICAgU1BPVF9ESVJFQ1RJT046IDEsICAgICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvbi54eXosIC1cblxuICAgIFBST0pfTUFUXzA6IDIsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDAgKHNwb3QgbGlnaHQpXG4gICAgQVRMQVNfVklFV1BPUlQ6IDIsICAgICAgICAgICAgICAvLyBhdGxhcyB2aWV3cG9ydCBkYXRhIChvbW5pIGxpZ2h0KVxuXG4gICAgUFJPSl9NQVRfMTogMywgICAgICAgICAgICAgICAgICAvLyBwcm9qZWN0aW9uIG1hdHJpeCByb3cgMSAoc3BvdCBsaWdodClcbiAgICBQUk9KX01BVF8yOiA0LCAgICAgICAgICAgICAgICAgIC8vIHByb2plY3Rpb24gbWF0cml4IHJvdyAyIChzcG90IGxpZ2h0KVxuICAgIFBST0pfTUFUXzM6IDUsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDMgKHNwb3QgbGlnaHQpXG5cbiAgICBBUkVBX0RBVEFfV0lEVEg6IDYsICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi13aWR0aC54eXosIC1cbiAgICBBUkVBX0RBVEFfSEVJR0hUOiA3LCAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi1oZWlnaHQueHl6LCAtXG5cbiAgICAvLyBsZWF2ZSBsYXN0XG4gICAgQ09VTlQ6IDhcbn07XG5cbi8vIGZvcm1hdCBmb3IgaGlnaCBwcmVjaXNpb24gbGlnaHQgdGV4dHVyZSAtIGZsb2F0XG5jb25zdCBGT1JNQVRfRkxPQVQgPSAwO1xuXG4vLyBmb3JtYXQgZm9yIGhpZ2ggcHJlY2lzaW9uIGxpZ2h0IHRleHR1cmUgLSA4Yml0XG5jb25zdCBGT1JNQVRfOEJJVCA9IDE7XG5cbi8vIGRldmljZSBjYWNoZSBzdG9yaW5nIHNoYWRlciBkZWZpbmVzIGZvciB0aGUgZGV2aWNlXG5jb25zdCBzaGFkZXJEZWZpbmVzRGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuLy8gQSBjbGFzcyB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZywgcmVzcG9uc2libGUgZm9yIGVuY29kaW5nIGxpZ2h0IHByb3BlcnRpZXMgaW50byB0ZXh0dXJlcyBmb3IgdGhlIHVzZSBvbiB0aGUgR1BVXG5jbGFzcyBMaWdodHNCdWZmZXIge1xuICAgIHN0YXRpYyBnZXRMaWdodFRleHR1cmVGb3JtYXQoZGV2aWNlKSB7XG4gICAgICAgIC8vIHByZWNpc2lvbiBmb3IgdGV4dHVyZSBzdG9yYWdlXG4gICAgICAgIC8vIGRvbid0IHVzZSBmbG9hdCB0ZXh0dXJlIG9uIGRldmljZXMgd2l0aCBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0cyAoYXMgaXQgdXNlcyBib3RoIGZsb2F0IGFuZCA4Yml0IHRleHR1cmVzIGF0IHRoZSBzYW1lIHRpbWUpXG4gICAgICAgIHJldHVybiAoZGV2aWNlLmV4dFRleHR1cmVGbG9hdCAmJiBkZXZpY2UubWF4VGV4dHVyZXMgPiA4KSA/IEZPUk1BVF9GTE9BVCA6IEZPUk1BVF84QklUO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRTaGFkZXJEZWZpbmVzKGRldmljZSkge1xuXG4gICAgICAgIC8vIHJldHVybiBkZWZpbmVzIGZvciB0aGlzIGRldmljZSBmcm9tIHRoZSBjYWNoZSwgb3IgY3JlYXRlIHRoZW0gaWYgbm90IGNhY2hlZCB5ZXRcbiAgICAgICAgcmV0dXJuIHNoYWRlckRlZmluZXNEZXZpY2VDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG5cbiAgICAgICAgICAgIC8vIGNvbnZlcnRzIG9iamVjdCB3aXRoIHByb3BlcnRpZXMgdG8gYSBsaXN0IG9mIHRoZXNlIGFzIGFuIGV4YW1wbGU6IFwiI2RlZmluZSBDTFVTVEVSX1RFWFRVUkVfOF9CTEFIIDEuNVwiXG4gICAgICAgICAgICBjb25zdCBidWlsZFNoYWRlckRlZmluZXMgPSAoZGV2aWNlLCBvYmplY3QsIHByZWZpeCwgZmxvYXRPZmZzZXQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqZWN0KVxuICAgICAgICAgICAgICAgICAgICAubWFwKGtleSA9PiBgI2RlZmluZSAke3ByZWZpeH0ke2tleX0gJHtvYmplY3Rba2V5XX0ke2Zsb2F0T2Zmc2V0fWApXG4gICAgICAgICAgICAgICAgICAgIC5qb2luKCdcXG4nKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VGV4dHVyZUZvcm1hdCA9IExpZ2h0c0J1ZmZlci5nZXRMaWdodFRleHR1cmVGb3JtYXQoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJUZXh0dXJlRm9ybWF0ID0gbGlnaHRUZXh0dXJlRm9ybWF0ID09PSBGT1JNQVRfRkxPQVQgPyAnRkxPQVQnIDogJzhCSVQnO1xuXG4gICAgICAgICAgICAvLyBvbiB3ZWJnbDIgYW5kIFdlYkdQVSB3ZSB1c2UgdGV4ZWxGZXRjaCBpbnN0cnVjdGlvbiB0byByZWFkIGRhdGEgdGV4dHVyZXMsIGFuZCBkb24ndCBuZWVkIHRoZSBvZmZzZXRcbiAgICAgICAgICAgIGNvbnN0IGZsb2F0T2Zmc2V0ID0gZGV2aWNlLnN1cHBvcnRzVGV4dHVyZUZldGNoID8gJycgOiAnLjUnO1xuXG4gICAgICAgICAgICByZXR1cm4gYFxuICAgICAgICAgICAgICAgIFxcbiNkZWZpbmUgQ0xVU1RFUl9URVhUVVJFXyR7Y2x1c3RlclRleHR1cmVGb3JtYXR9XG4gICAgICAgICAgICAgICAgJHtidWlsZFNoYWRlckRlZmluZXMoZGV2aWNlLCBUZXh0dXJlSW5kZXg4LCAnQ0xVU1RFUl9URVhUVVJFXzhfJywgZmxvYXRPZmZzZXQpfVxuICAgICAgICAgICAgICAgICR7YnVpbGRTaGFkZXJEZWZpbmVzKGRldmljZSwgVGV4dHVyZUluZGV4RmxvYXQsICdDTFVTVEVSX1RFWFRVUkVfRl8nLCBmbG9hdE9mZnNldCl9XG4gICAgICAgICAgICBgO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UpIHtcblxuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcblxuICAgICAgICAvLyBmZWF0dXJlc1xuICAgICAgICB0aGlzLmNvb2tpZXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc2hhZG93c0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRzRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHVzaW5nIDggYml0IGluZGV4IHNvIHRoaXMgaXMgbWF4aW11bSBzdXBwb3J0ZWQgbnVtYmVyIG9mIGxpZ2h0c1xuICAgICAgICB0aGlzLm1heExpZ2h0cyA9IDI1NTtcblxuICAgICAgICAvLyBzaGFyZWQgOGJpdCB0ZXh0dXJlIHBpeGVsczpcbiAgICAgICAgbGV0IHBpeGVsc1BlckxpZ2h0OCA9IFRleHR1cmVJbmRleDguQ09VTlRfQUxXQVlTO1xuICAgICAgICBsZXQgcGl4ZWxzUGVyTGlnaHRGbG9hdCA9IDA7XG5cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVGb3JtYXQgPSBMaWdodHNCdWZmZXIuZ2V0TGlnaHRUZXh0dXJlRm9ybWF0KGRldmljZSk7XG5cbiAgICAgICAgLy8gZmxvYXQgdGV4dHVyZSBmb3JtYXRcbiAgICAgICAgaWYgKHRoaXMubGlnaHRUZXh0dXJlRm9ybWF0ID09PSBGT1JNQVRfRkxPQVQpIHtcbiAgICAgICAgICAgIHBpeGVsc1BlckxpZ2h0RmxvYXQgPSBUZXh0dXJlSW5kZXhGbG9hdC5DT1VOVDtcbiAgICAgICAgfSBlbHNlIHsgLy8gOGJpdCB0ZXh0dXJlXG4gICAgICAgICAgICBwaXhlbHNQZXJMaWdodDggPSBUZXh0dXJlSW5kZXg4LkNPVU5UO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gOGJpdCB0ZXh0dXJlIC0gdG8gc3RvcmUgZGF0YSB0aGF0IGNhbiBmaXQgaW50byA4Yml0cyB0byBsb3dlciB0aGUgYmFuZHdpZHRoIHJlcXVpcmVtZW50c1xuICAgICAgICB0aGlzLmxpZ2h0czggPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoNCAqIHBpeGVsc1BlckxpZ2h0OCAqIHRoaXMubWF4TGlnaHRzKTtcbiAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOCA9IHRoaXMuY3JlYXRlVGV4dHVyZSh0aGlzLmRldmljZSwgcGl4ZWxzUGVyTGlnaHQ4LCB0aGlzLm1heExpZ2h0cywgUElYRUxGT1JNQVRfUkdCQTgsICdMaWdodHNUZXh0dXJlOCcpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlOElkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnbGlnaHRzVGV4dHVyZTgnKTtcblxuICAgICAgICAvLyBmbG9hdCB0ZXh0dXJlXG4gICAgICAgIGlmIChwaXhlbHNQZXJMaWdodEZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c0Zsb2F0ID0gbmV3IEZsb2F0MzJBcnJheSg0ICogcGl4ZWxzUGVyTGlnaHRGbG9hdCAqIHRoaXMubWF4TGlnaHRzKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0ID0gdGhpcy5jcmVhdGVUZXh0dXJlKHRoaXMuZGV2aWNlLCBwaXhlbHNQZXJMaWdodEZsb2F0LCB0aGlzLm1heExpZ2h0cywgUElYRUxGT1JNQVRfUkdCQTMyRiwgJ0xpZ2h0c1RleHR1cmVGbG9hdCcpO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlRmxvYXQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnZlcnNlIHNpemVzIGZvciBib3RoIHRleHR1cmVzXG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplSWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlSW52U2l6ZScpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMF0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQud2lkdGggOiAwO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMV0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuaGVpZ2h0IDogMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzJdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC53aWR0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzNdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC5oZWlnaHQ7XG5cbiAgICAgICAgLy8gY29tcHJlc3Npb24gcmFuZ2VzXG4gICAgICAgIHRoaXMuaW52TWF4Q29sb3JWYWx1ZSA9IDA7XG4gICAgICAgIHRoaXMuaW52TWF4QXR0ZW51YXRpb24gPSAwO1xuICAgICAgICB0aGlzLmJvdW5kc01pbiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBpZiAodGhpcy5saWdodHNUZXh0dXJlOCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZShkZXZpY2UsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgbmFtZSkge1xuICAgICAgICBjb25zdCB0ZXggPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX0RFRkFVTFQsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFuaXNvdHJvcHk6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRleDtcbiAgICB9XG5cbiAgICBzZXRDb21wcmVzc2lvblJhbmdlcyhtYXhBdHRlbnVhdGlvbiwgbWF4Q29sb3JWYWx1ZSkge1xuICAgICAgICB0aGlzLmludk1heENvbG9yVmFsdWUgPSAxIC8gbWF4Q29sb3JWYWx1ZTtcbiAgICAgICAgdGhpcy5pbnZNYXhBdHRlbnVhdGlvbiA9IDEgLyBtYXhBdHRlbnVhdGlvbjtcbiAgICB9XG5cbiAgICBzZXRCb3VuZHMobWluLCBkZWx0YSkge1xuICAgICAgICB0aGlzLmJvdW5kc01pbi5jb3B5KG1pbik7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEuY29weShkZWx0YSk7XG4gICAgfVxuXG4gICAgdXBsb2FkVGV4dHVyZXMoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdC5sb2NrKCkuc2V0KHRoaXMubGlnaHRzRmxvYXQpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQudW5sb2NrKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4LmxvY2soKS5zZXQodGhpcy5saWdodHM4KTtcbiAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC51bmxvY2soKTtcbiAgICB9XG5cbiAgICB1cGRhdGVVbmlmb3JtcygpIHtcblxuICAgICAgICAvLyB0ZXh0dXJlc1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlOElkLnNldFZhbHVlKHRoaXMubGlnaHRzVGV4dHVyZTgpO1xuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0VGV4dHVyZUZvcm1hdCA9PT0gRk9STUFUX0ZMT0FUKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlRmxvYXRJZC5zZXRWYWx1ZSh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZUlkLnNldFZhbHVlKHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplRGF0YSk7XG4gICAgfVxuXG4gICAgZ2V0U3BvdERpcmVjdGlvbihkaXJlY3Rpb24sIHNwb3QpIHtcblxuICAgICAgICAvLyBTcG90cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgY29uc3QgbWF0ID0gc3BvdC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICBtYXQuZ2V0WShkaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgIGRpcmVjdGlvbi5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvLyBoYWxmIHNpemVzIG9mIGFyZWEgbGlnaHQgaW4gd29ybGQgc3BhY2UsIHJldHVybmVkIGFzIGFuIGFycmF5IG9mIDYgZmxvYXRzXG4gICAgZ2V0TGlnaHRBcmVhU2l6ZXMobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBtYXQgPSBsaWdodC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIG1hdC50cmFuc2Zvcm1WZWN0b3IoYXJlYUhhbGZBeGlzV2lkdGgsIHRlbXBWZWMzKTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzBdID0gdGVtcFZlYzMueDtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzFdID0gdGVtcFZlYzMueTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzJdID0gdGVtcFZlYzMuejtcblxuICAgICAgICBtYXQudHJhbnNmb3JtVmVjdG9yKGFyZWFIYWxmQXhpc0hlaWdodCwgdGVtcFZlYzMpO1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbM10gPSB0ZW1wVmVjMy54O1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbNF0gPSB0ZW1wVmVjMy55O1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbNV0gPSB0ZW1wVmVjMy56O1xuXG4gICAgICAgIHJldHVybiB0ZW1wQXJlYUxpZ2h0U2l6ZXM7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhRmxhZ3MoZGF0YTgsIGluZGV4LCBsaWdodCwgaXNTcG90LCBjYXN0U2hhZG93cywgc2hhZG93SW50ZW5zaXR5KSB7XG4gICAgICAgIGRhdGE4W2luZGV4ICsgMF0gPSBpc1Nwb3QgPyAyNTUgOiAwO1xuICAgICAgICBkYXRhOFtpbmRleCArIDFdID0gbGlnaHQuX3NoYXBlICogNjQ7ICAgICAgICAgICAvLyB2YWx1ZSAwLi4zXG4gICAgICAgIGRhdGE4W2luZGV4ICsgMl0gPSBsaWdodC5fZmFsbG9mZk1vZGUgKiAyNTU7ICAgIC8vIHZhbHVlIDAuLjFcbiAgICAgICAgZGF0YThbaW5kZXggKyAzXSA9IGNhc3RTaGFkb3dzID8gc2hhZG93SW50ZW5zaXR5ICogMjU1IDogMDtcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFDb2xvcihkYXRhOCwgaW5kZXgsIGxpZ2h0LCBnYW1tYUNvcnJlY3Rpb24sIGlzQ29va2llKSB7XG4gICAgICAgIGNvbnN0IGludk1heENvbG9yVmFsdWUgPSB0aGlzLmludk1heENvbG9yVmFsdWU7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZ2FtbWFDb3JyZWN0aW9uID8gbGlnaHQuX2xpbmVhckZpbmFsQ29sb3IgOiBsaWdodC5fZmluYWxDb2xvcjtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGNvbG9yWzBdICogaW52TWF4Q29sb3JWYWx1ZSwgZGF0YTgsIGluZGV4ICsgMCwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhjb2xvclsxXSAqIGludk1heENvbG9yVmFsdWUsIGRhdGE4LCBpbmRleCArIDIsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoY29sb3JbMl0gKiBpbnZNYXhDb2xvclZhbHVlLCBkYXRhOCwgaW5kZXggKyA0LCAyKTtcblxuICAgICAgICAvLyBjb29raWVcbiAgICAgICAgZGF0YThbaW5kZXggKyA2XSA9IGlzQ29va2llID8gMjU1IDogMDtcblxuICAgICAgICAvLyBsaWdodE1hc2tcbiAgICAgICAgLy8gMDogTUFTS19BRkZFQ1RfRFlOQU1JQ1xuICAgICAgICAvLyAxMjc6IE1BU0tfQUZGRUNUX0RZTkFNSUMgJiYgTUFTS19BRkZFQ1RfTElHSFRNQVBQRURcbiAgICAgICAgLy8gMjU1OiBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRFxuICAgICAgICBjb25zdCBpc0R5bmFtaWMgPSAhIShsaWdodC5tYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQyk7XG4gICAgICAgIGNvbnN0IGlzTGlnaHRtYXBwZWQgPSAhIShsaWdodC5tYXNrICYgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpO1xuICAgICAgICBkYXRhOFtpbmRleCArIDddID0gKGlzRHluYW1pYyAmJiBpc0xpZ2h0bWFwcGVkKSA/IDEyNyA6IChpc0xpZ2h0bWFwcGVkID8gMjU1IDogMCk7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhU3BvdEFuZ2xlcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIC8vIDIgYnl0ZXMgZWFjaFxuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobGlnaHQuX2lubmVyQ29uZUFuZ2xlQ29zICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyAwLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGxpZ2h0Ll9vdXRlckNvbmVBbmdsZUNvcyAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgMiwgMik7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhU2hhZG93QmlhcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgIGNvbnN0IGJpYXNlcyA9IGxpZ2h0Ll9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXNSYW5nZShiaWFzZXMuYmlhcywgZGF0YTgsIGluZGV4LCAtMSwgMjAsIDIpOyAgLy8gYmlhczogLTEgdG8gMjAgcmFuZ2VcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGJpYXNlcy5ub3JtYWxCaWFzLCBkYXRhOCwgaW5kZXggKyAyLCAyKTsgICAgIC8vIG5vcm1hbEJpYXM6IDAgdG8gMSByYW5nZVxuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVBvc2l0aW9uUmFuZ2UoZGF0YTgsIGluZGV4LCBsaWdodCwgcG9zKSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGFuZCByYW5nZSBzY2FsZWQgdG8gMC4uMSByYW5nZVxuICAgICAgICBjb25zdCBub3JtUG9zID0gdGVtcFZlYzMuc3ViMihwb3MsIHRoaXMuYm91bmRzTWluKS5kaXYodGhpcy5ib3VuZHNEZWx0YSk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhub3JtUG9zLngsIGRhdGE4LCBpbmRleCArIDAsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobm9ybVBvcy55LCBkYXRhOCwgaW5kZXggKyA0LCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKG5vcm1Qb3MueiwgZGF0YTgsIGluZGV4ICsgOCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhsaWdodC5hdHRlbnVhdGlvbkVuZCAqIHRoaXMuaW52TWF4QXR0ZW51YXRpb24sIGRhdGE4LCBpbmRleCArIDEyLCA0KTtcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFTcG90RGlyZWN0aW9uKGRhdGE4LCBpbmRleCwgbGlnaHQpIHtcbiAgICAgICAgdGhpcy5nZXRTcG90RGlyZWN0aW9uKHRlbXBWZWMzLCBsaWdodCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyh0ZW1wVmVjMy54ICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyAwLCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKHRlbXBWZWMzLnkgKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDQsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXModGVtcFZlYzMueiAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgOCwgNCk7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhTGlnaHRQcm9qTWF0cml4KGRhdGE4LCBpbmRleCwgbGlnaHRQcm9qZWN0aW9uTWF0cml4KSB7XG4gICAgICAgIGNvbnN0IG1hdERhdGEgPSBsaWdodFByb2plY3Rpb25NYXRyaXguZGF0YTtcbiAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCAxMjsgbSsrKSAgICAvLyB0aGVzZSBhcmUgaW4gLTIuLjIgcmFuZ2VcbiAgICAgICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlc1JhbmdlKG1hdERhdGFbbV0sIGRhdGE4LCBpbmRleCArIDQgKiBtLCAtMiwgMiwgNCk7XG4gICAgICAgIGZvciAobGV0IG0gPSAxMjsgbSA8IDE2OyBtKyspIHsgIC8vIHRoZXNlIGFyZSBmdWxsIGZsb2F0IHJhbmdlXG4gICAgICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyTWFudGlzc2FFeHBvbmVudChtYXREYXRhW21dLCBkYXRhOCwgaW5kZXggKyA0ICogbSwgNCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFDb29raWVzKGRhdGE4LCBpbmRleCwgbGlnaHQpIHtcbiAgICAgICAgY29uc3QgaXNSZ2IgPSBsaWdodC5fY29va2llQ2hhbm5lbCA9PT0gJ3JnYic7XG4gICAgICAgIGRhdGE4W2luZGV4ICsgMF0gPSBNYXRoLmZsb29yKGxpZ2h0LmNvb2tpZUludGVuc2l0eSAqIDI1NSk7XG4gICAgICAgIGRhdGE4W2luZGV4ICsgMV0gPSBpc1JnYiA/IDI1NSA6IDA7XG4gICAgICAgIC8vIHdlIGhhdmUgdHdvIHVudXNlZCBieXRlcyBoZXJlXG5cbiAgICAgICAgaWYgKCFpc1JnYikge1xuICAgICAgICAgICAgY29uc3QgY2hhbm5lbCA9IGxpZ2h0Ll9jb29raWVDaGFubmVsO1xuICAgICAgICAgICAgZGF0YThbaW5kZXggKyA0XSA9IGNoYW5uZWwgPT09ICdycnInID8gMjU1IDogMDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgNV0gPSBjaGFubmVsID09PSAnZ2dnJyA/IDI1NSA6IDA7XG4gICAgICAgICAgICBkYXRhOFtpbmRleCArIDZdID0gY2hhbm5lbCA9PT0gJ2JiYicgPyAyNTUgOiAwO1xuICAgICAgICAgICAgZGF0YThbaW5kZXggKyA3XSA9IGNoYW5uZWwgPT09ICdhYWEnID8gMjU1IDogMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZExpZ2h0QXRsYXNWaWV3cG9ydChkYXRhOCwgaW5kZXgsIGF0bGFzVmlld3BvcnQpIHtcbiAgICAgICAgLy8gYWxsIHRoZXNlIGFyZSBpbiAwLi4xIHJhbmdlXG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhhdGxhc1ZpZXdwb3J0LngsIGRhdGE4LCBpbmRleCArIDAsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoYXRsYXNWaWV3cG9ydC55LCBkYXRhOCwgaW5kZXggKyAyLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGF0bGFzVmlld3BvcnQueiAvIDMsIGRhdGE4LCBpbmRleCArIDQsIDIpO1xuICAgICAgICAvLyB3ZSBoYXZlIHR3byB1bnVzZWQgYnl0ZXMgaGVyZVxuICAgIH1cblxuICAgIGFkZExpZ2h0QXJlYVNpemVzKGRhdGE4LCBpbmRleCwgbGlnaHQpIHtcbiAgICAgICAgY29uc3QgYXJlYVNpemVzID0gdGhpcy5nZXRMaWdodEFyZWFTaXplcyhsaWdodCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7ICAvLyB0aGVzZSBhcmUgZnVsbCBmbG9hdCByYW5nZVxuICAgICAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0Mk1hbnRpc3NhRXhwb25lbnQoYXJlYVNpemVzW2ldLCBkYXRhOCwgaW5kZXggKyA0ICogaSwgNCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmaWxsIHVwIGJvdGggZmxvYXQgYW5kIDhiaXQgdGV4dHVyZSBkYXRhIHdpdGggbGlnaHQgcHJvcGVydGllc1xuICAgIGFkZExpZ2h0RGF0YShsaWdodCwgbGlnaHRJbmRleCwgZ2FtbWFDb3JyZWN0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgaXNTcG90ID0gbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UO1xuICAgICAgICBjb25zdCBoYXNBdGxhc1ZpZXdwb3J0ID0gbGlnaHQuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZDsgLy8gaWYgdGhlIGxpZ2h0IGRvZXMgbm90IGhhdmUgdmlld3BvcnQsIGl0IGRvZXMgbm90IGZpdCB0byB0aGUgYXRsYXNcbiAgICAgICAgY29uc3QgaXNDb29raWUgPSB0aGlzLmNvb2tpZXNFbmFibGVkICYmICEhbGlnaHQuX2Nvb2tpZSAmJiBoYXNBdGxhc1ZpZXdwb3J0O1xuICAgICAgICBjb25zdCBpc0FyZWEgPSB0aGlzLmFyZWFMaWdodHNFbmFibGVkICYmIGxpZ2h0LnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMO1xuICAgICAgICBjb25zdCBjYXN0U2hhZG93cyA9IHRoaXMuc2hhZG93c0VuYWJsZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgaGFzQXRsYXNWaWV3cG9ydDtcbiAgICAgICAgY29uc3QgcG9zID0gbGlnaHQuX25vZGUuZ2V0UG9zaXRpb24oKTtcblxuICAgICAgICBsZXQgbGlnaHRQcm9qZWN0aW9uTWF0cml4ID0gbnVsbDsgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeCAtIHVzZWQgZm9yIHNoYWRvdyBtYXAgYW5kIGNvb2tpZSBvZiBzcG90IGxpZ2h0XG4gICAgICAgIGxldCBhdGxhc1ZpZXdwb3J0ID0gbnVsbDsgICAvLyBhdGxhcyB2aWV3cG9ydCBpbmZvIC0gdXNlZCBmb3Igc2hhZG93IG1hcCBhbmQgY29va2llIG9mIG9tbmkgbGlnaHRcbiAgICAgICAgaWYgKGlzU3BvdCkge1xuICAgICAgICAgICAgaWYgKGNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgICAgICBsaWdodFByb2plY3Rpb25NYXRyaXggPSBsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0Nvb2tpZSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0UHJvamVjdGlvbk1hdHJpeCA9IExpZ2h0Q2FtZXJhLmV2YWxTcG90Q29va2llTWF0cml4KGxpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChjYXN0U2hhZG93cyB8fCBpc0Nvb2tpZSkge1xuICAgICAgICAgICAgICAgIGF0bGFzVmlld3BvcnQgPSBsaWdodC5hdGxhc1ZpZXdwb3J0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGF0YSBhbHdheXMgc3RvcmVkIGluIDhiaXQgdGV4dHVyZVxuICAgICAgICBjb25zdCBkYXRhOCA9IHRoaXMubGlnaHRzODtcbiAgICAgICAgY29uc3QgZGF0YThTdGFydCA9IGxpZ2h0SW5kZXggKiB0aGlzLmxpZ2h0c1RleHR1cmU4LndpZHRoICogNDtcblxuICAgICAgICAvLyBmbGFnc1xuICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUZsYWdzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguRkxBR1MsIGxpZ2h0LCBpc1Nwb3QsIGNhc3RTaGFkb3dzLCBsaWdodC5zaGFkb3dJbnRlbnNpdHkpO1xuXG4gICAgICAgIC8vIGxpZ2h0IGNvbG9yXG4gICAgICAgIHRoaXMuYWRkTGlnaHREYXRhQ29sb3IoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5DT0xPUl9BLCBsaWdodCwgZ2FtbWFDb3JyZWN0aW9uLCBpc0Nvb2tpZSk7XG5cbiAgICAgICAgLy8gc3BvdCBsaWdodCBhbmdsZXNcbiAgICAgICAgaWYgKGlzU3BvdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFTcG90QW5nbGVzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguU1BPVF9BTkdMRVMsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBiaWFzZXNcbiAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YVNoYWRvd0JpYXMoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5TSEFET1dfQklBUywgbGlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29va2llIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKGlzQ29va2llKSB7XG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUNvb2tpZXMoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5DT09LSUVfQSwgbGlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaGlnaCBwcmVjaXNpb24gZGF0YSBzdG9yZWQgdXNpbmcgZmxvYXQgdGV4dHVyZVxuICAgICAgICBpZiAodGhpcy5saWdodFRleHR1cmVGb3JtYXQgPT09IEZPUk1BVF9GTE9BVCkge1xuXG4gICAgICAgICAgICBjb25zdCBkYXRhRmxvYXQgPSB0aGlzLmxpZ2h0c0Zsb2F0O1xuICAgICAgICAgICAgY29uc3QgZGF0YUZsb2F0U3RhcnQgPSBsaWdodEluZGV4ICogdGhpcy5saWdodHNUZXh0dXJlRmxvYXQud2lkdGggKiA0O1xuXG4gICAgICAgICAgICAvLyBwb3MgYW5kIHJhbmdlXG4gICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUE9TSVRJT05fUkFOR0UgKyAwXSA9IHBvcy54O1xuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgMV0gPSBwb3MueTtcbiAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QT1NJVElPTl9SQU5HRSArIDJdID0gcG9zLno7XG4gICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUE9TSVRJT05fUkFOR0UgKyAzXSA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kO1xuXG4gICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvblxuICAgICAgICAgICAgaWYgKGlzU3BvdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U3BvdERpcmVjdGlvbih0ZW1wVmVjMywgbGlnaHQpO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5TUE9UX0RJUkVDVElPTiArIDBdID0gdGVtcFZlYzMueDtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuU1BPVF9ESVJFQ1RJT04gKyAxXSA9IHRlbXBWZWMzLnk7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlNQT1RfRElSRUNUSU9OICsgMl0gPSB0ZW1wVmVjMy56O1xuICAgICAgICAgICAgICAgIC8vIGhlcmUgd2UgaGF2ZSB1bnVzZWQgZmxvYXRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGlnaHQgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgICAgICAgIGlmIChsaWdodFByb2plY3Rpb25NYXRyaXgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXREYXRhID0gbGlnaHRQcm9qZWN0aW9uTWF0cml4LmRhdGE7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCAxNjsgbSsrKVxuICAgICAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUFJPSl9NQVRfMCArIG1dID0gbWF0RGF0YVttXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGF0bGFzVmlld3BvcnQpIHtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVRMQVNfVklFV1BPUlQgKyAwXSA9IGF0bGFzVmlld3BvcnQueDtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVRMQVNfVklFV1BPUlQgKyAxXSA9IGF0bGFzVmlld3BvcnQueTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVRMQVNfVklFV1BPUlQgKyAyXSA9IGF0bGFzVmlld3BvcnQueiAvIDM7IC8vIHNpemUgb2YgYSBmYWNlIHNsb3QgKDN4MyBncmlkKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IHNpemVzXG4gICAgICAgICAgICBpZiAoaXNBcmVhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXJlYVNpemVzID0gdGhpcy5nZXRMaWdodEFyZWFTaXplcyhsaWdodCk7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9XSURUSCArIDBdID0gYXJlYVNpemVzWzBdO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfV0lEVEggKyAxXSA9IGFyZWFTaXplc1sxXTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX1dJRFRIICsgMl0gPSBhcmVhU2l6ZXNbMl07XG5cbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX0hFSUdIVCArIDBdID0gYXJlYVNpemVzWzNdO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfSEVJR0hUICsgMV0gPSBhcmVhU2l6ZXNbNF07XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9IRUlHSFQgKyAyXSA9IGFyZWFTaXplc1s1XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgeyAgICAvLyBoaWdoIHByZWNpc2lvbiBkYXRhIHN0b3JlZCB1c2luZyA4Yml0IHRleHR1cmVcblxuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFQb3NpdGlvblJhbmdlKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguUE9TSVRJT05fWCwgbGlnaHQsIHBvcyk7XG5cbiAgICAgICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uXG4gICAgICAgICAgICBpZiAoaXNTcG90KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFTcG90RGlyZWN0aW9uKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguU1BPVF9ESVJFQ1RJT05fWCwgbGlnaHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgaWYgKGxpZ2h0UHJvamVjdGlvbk1hdHJpeCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhTGlnaHRQcm9qTWF0cml4KGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguUFJPSl9NQVRfMDAsIGxpZ2h0UHJvamVjdGlvbk1hdHJpeCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMaWdodEF0bGFzVmlld3BvcnQoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5BVExBU19WSUVXUE9SVF9BLCBhdGxhc1ZpZXdwb3J0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBzaXplc1xuICAgICAgICAgICAgaWYgKGlzQXJlYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHRBcmVhU2l6ZXMoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5BUkVBX0RBVEFfV0lEVEhfWCwgbGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMaWdodHNCdWZmZXIgfTtcbiJdLCJuYW1lcyI6WyJlcHNpbG9uIiwidGVtcFZlYzMiLCJWZWMzIiwidGVtcEFyZWFMaWdodFNpemVzIiwiRmxvYXQzMkFycmF5IiwiYXJlYUhhbGZBeGlzV2lkdGgiLCJhcmVhSGFsZkF4aXNIZWlnaHQiLCJUZXh0dXJlSW5kZXg4IiwiRkxBR1MiLCJDT0xPUl9BIiwiQ09MT1JfQiIsIlNQT1RfQU5HTEVTIiwiU0hBRE9XX0JJQVMiLCJDT09LSUVfQSIsIkNPT0tJRV9CIiwiQ09VTlRfQUxXQVlTIiwiUE9TSVRJT05fWCIsIlBPU0lUSU9OX1kiLCJQT1NJVElPTl9aIiwiUkFOR0UiLCJTUE9UX0RJUkVDVElPTl9YIiwiU1BPVF9ESVJFQ1RJT05fWSIsIlNQT1RfRElSRUNUSU9OX1oiLCJQUk9KX01BVF8wMCIsIkFUTEFTX1ZJRVdQT1JUX0EiLCJQUk9KX01BVF8wMSIsIkFUTEFTX1ZJRVdQT1JUX0IiLCJQUk9KX01BVF8wMiIsIlBST0pfTUFUXzAzIiwiUFJPSl9NQVRfMTAiLCJQUk9KX01BVF8xMSIsIlBST0pfTUFUXzEyIiwiUFJPSl9NQVRfMTMiLCJQUk9KX01BVF8yMCIsIlBST0pfTUFUXzIxIiwiUFJPSl9NQVRfMjIiLCJQUk9KX01BVF8yMyIsIlBST0pfTUFUXzMwIiwiUFJPSl9NQVRfMzEiLCJQUk9KX01BVF8zMiIsIlBST0pfTUFUXzMzIiwiQVJFQV9EQVRBX1dJRFRIX1giLCJBUkVBX0RBVEFfV0lEVEhfWSIsIkFSRUFfREFUQV9XSURUSF9aIiwiQVJFQV9EQVRBX0hFSUdIVF9YIiwiQVJFQV9EQVRBX0hFSUdIVF9ZIiwiQVJFQV9EQVRBX0hFSUdIVF9aIiwiQ09VTlQiLCJUZXh0dXJlSW5kZXhGbG9hdCIsIlBPU0lUSU9OX1JBTkdFIiwiU1BPVF9ESVJFQ1RJT04iLCJQUk9KX01BVF8wIiwiQVRMQVNfVklFV1BPUlQiLCJQUk9KX01BVF8xIiwiUFJPSl9NQVRfMiIsIlBST0pfTUFUXzMiLCJBUkVBX0RBVEFfV0lEVEgiLCJBUkVBX0RBVEFfSEVJR0hUIiwiRk9STUFUX0ZMT0FUIiwiRk9STUFUXzhCSVQiLCJzaGFkZXJEZWZpbmVzRGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsIkxpZ2h0c0J1ZmZlciIsImdldExpZ2h0VGV4dHVyZUZvcm1hdCIsImRldmljZSIsImV4dFRleHR1cmVGbG9hdCIsIm1heFRleHR1cmVzIiwiZ2V0U2hhZGVyRGVmaW5lcyIsImdldCIsImJ1aWxkU2hhZGVyRGVmaW5lcyIsIm9iamVjdCIsInByZWZpeCIsImZsb2F0T2Zmc2V0IiwiT2JqZWN0Iiwia2V5cyIsIm1hcCIsImtleSIsImpvaW4iLCJsaWdodFRleHR1cmVGb3JtYXQiLCJjbHVzdGVyVGV4dHVyZUZvcm1hdCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiY29uc3RydWN0b3IiLCJjb29raWVzRW5hYmxlZCIsInNoYWRvd3NFbmFibGVkIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJtYXhMaWdodHMiLCJwaXhlbHNQZXJMaWdodDgiLCJwaXhlbHNQZXJMaWdodEZsb2F0IiwibGlnaHRzOCIsIlVpbnQ4Q2xhbXBlZEFycmF5IiwibGlnaHRzVGV4dHVyZTgiLCJjcmVhdGVUZXh0dXJlIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJfbGlnaHRzVGV4dHVyZThJZCIsInNjb3BlIiwicmVzb2x2ZSIsImxpZ2h0c0Zsb2F0IiwibGlnaHRzVGV4dHVyZUZsb2F0IiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIl9saWdodHNUZXh0dXJlRmxvYXRJZCIsInVuZGVmaW5lZCIsIl9saWdodHNUZXh0dXJlSW52U2l6ZUlkIiwiX2xpZ2h0c1RleHR1cmVJbnZTaXplRGF0YSIsIndpZHRoIiwiaGVpZ2h0IiwiaW52TWF4Q29sb3JWYWx1ZSIsImludk1heEF0dGVudWF0aW9uIiwiYm91bmRzTWluIiwiYm91bmRzRGVsdGEiLCJkZXN0cm95IiwiZm9ybWF0IiwibmFtZSIsInRleCIsIlRleHR1cmUiLCJtaXBtYXBzIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsInR5cGUiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwibWFnRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtaW5GaWx0ZXIiLCJhbmlzb3Ryb3B5Iiwic2V0Q29tcHJlc3Npb25SYW5nZXMiLCJtYXhBdHRlbnVhdGlvbiIsIm1heENvbG9yVmFsdWUiLCJzZXRCb3VuZHMiLCJtaW4iLCJkZWx0YSIsImNvcHkiLCJ1cGxvYWRUZXh0dXJlcyIsImxvY2siLCJzZXQiLCJ1bmxvY2siLCJ1cGRhdGVVbmlmb3JtcyIsInNldFZhbHVlIiwiZ2V0U3BvdERpcmVjdGlvbiIsImRpcmVjdGlvbiIsInNwb3QiLCJtYXQiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0WSIsIm11bFNjYWxhciIsIm5vcm1hbGl6ZSIsImdldExpZ2h0QXJlYVNpemVzIiwibGlnaHQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJ4IiwieSIsInoiLCJhZGRMaWdodERhdGFGbGFncyIsImRhdGE4IiwiaW5kZXgiLCJpc1Nwb3QiLCJjYXN0U2hhZG93cyIsInNoYWRvd0ludGVuc2l0eSIsIl9zaGFwZSIsIl9mYWxsb2ZmTW9kZSIsImFkZExpZ2h0RGF0YUNvbG9yIiwiZ2FtbWFDb3JyZWN0aW9uIiwiaXNDb29raWUiLCJjb2xvciIsIl9saW5lYXJGaW5hbENvbG9yIiwiX2ZpbmFsQ29sb3IiLCJGbG9hdFBhY2tpbmciLCJmbG9hdDJCeXRlcyIsImlzRHluYW1pYyIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiaXNMaWdodG1hcHBlZCIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiYWRkTGlnaHREYXRhU3BvdEFuZ2xlcyIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImFkZExpZ2h0RGF0YVNoYWRvd0JpYXMiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwiZmxvYXQyQnl0ZXNSYW5nZSIsImJpYXMiLCJub3JtYWxCaWFzIiwiYWRkTGlnaHREYXRhUG9zaXRpb25SYW5nZSIsInBvcyIsIm5vcm1Qb3MiLCJzdWIyIiwiZGl2IiwiYXR0ZW51YXRpb25FbmQiLCJhZGRMaWdodERhdGFTcG90RGlyZWN0aW9uIiwiYWRkTGlnaHREYXRhTGlnaHRQcm9qTWF0cml4IiwibGlnaHRQcm9qZWN0aW9uTWF0cml4IiwibWF0RGF0YSIsImRhdGEiLCJtIiwiZmxvYXQyTWFudGlzc2FFeHBvbmVudCIsImFkZExpZ2h0RGF0YUNvb2tpZXMiLCJpc1JnYiIsIl9jb29raWVDaGFubmVsIiwiTWF0aCIsImZsb29yIiwiY29va2llSW50ZW5zaXR5IiwiY2hhbm5lbCIsImFkZExpZ2h0QXRsYXNWaWV3cG9ydCIsImF0bGFzVmlld3BvcnQiLCJhZGRMaWdodEFyZWFTaXplcyIsImFyZWFTaXplcyIsImkiLCJhZGRMaWdodERhdGEiLCJsaWdodEluZGV4IiwiX3R5cGUiLCJMSUdIVFRZUEVfU1BPVCIsImhhc0F0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiX2Nvb2tpZSIsImlzQXJlYSIsInNoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsImdldFBvc2l0aW9uIiwic2hhZG93TWF0cml4IiwiTGlnaHRDYW1lcmEiLCJldmFsU3BvdENvb2tpZU1hdHJpeCIsImRhdGE4U3RhcnQiLCJkYXRhRmxvYXQiLCJkYXRhRmxvYXRTdGFydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFRQSxNQUFNQSxPQUFPLEdBQUcsUUFBUSxDQUFBO0FBRXhCLE1BQU1DLFFBQVEsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUMsTUFBTUMsaUJBQWlCLEdBQUcsSUFBSUgsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUM5QyxNQUFNSSxrQkFBa0IsR0FBRyxJQUFJSixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFOUM7QUFDQTtBQUNBLE1BQU1LLGFBQWEsR0FBRztBQUVsQjtBQUNBQyxFQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUFvQjtBQUM1QkMsRUFBQUEsT0FBTyxFQUFFLENBQUM7QUFBa0I7QUFDNUJDLEVBQUFBLE9BQU8sRUFBRSxDQUFDO0FBQWtCO0FBQzVCQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztBQUFjO0FBQzVCQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztB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
