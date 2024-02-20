import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
import { TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_111110F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';

/** @typedef {import('../../handlers/texture.js').TextureParser} TextureParser */

// Defined here: https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/
const IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D]; // «KTX 11»\r\n\x1A\n

const KNOWN_FORMATS = {
  // compressed formats
  0x83F0: PIXELFORMAT_DXT1,
  0x83F2: PIXELFORMAT_DXT3,
  0x83F3: PIXELFORMAT_DXT5,
  0x8D64: PIXELFORMAT_ETC1,
  0x9274: PIXELFORMAT_ETC2_RGB,
  0x9278: PIXELFORMAT_ETC2_RGBA,
  0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
  0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
  0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
  0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1,
  // uncompressed formats
  0x8051: PIXELFORMAT_RGB8,
  // GL_RGB8
  0x8058: PIXELFORMAT_RGBA8,
  // GL_RGBA8
  0x8C41: PIXELFORMAT_SRGB,
  // GL_SRGB8
  0x8C43: PIXELFORMAT_SRGBA,
  // GL_SRGB8_ALPHA8
  0x8C3A: PIXELFORMAT_111110F,
  // GL_R11F_G11F_B10F
  0x881B: PIXELFORMAT_RGB16F,
  // GL_RGB16F
  0x881A: PIXELFORMAT_RGBA16F // GL_RGBA16F
};

function createContainer(pixelFormat, buffer, byteOffset, byteSize) {
  return pixelFormat === PIXELFORMAT_111110F ? new Uint32Array(buffer, byteOffset, byteSize / 4) : new Uint8Array(buffer, byteOffset, byteSize);
}

/**
 * Texture parser for ktx files.
 *
 * @implements {TextureParser}
 * @ignore
 */
class KtxParser {
  constructor(registry) {
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
  }
  open(url, data, device, textureOptions = {}) {
    const textureData = this.parse(data);
    if (!textureData) {
      return null;
    }
    const texture = new Texture(device, _extends({
      name: url,
      profilerHint: TEXHINT_ASSET,
      addressU: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      addressV: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      width: textureData.width,
      height: textureData.height,
      format: textureData.format,
      cubemap: textureData.cubemap,
      levels: textureData.levels
    }, textureOptions));
    texture.upload();
    return texture;
  }
  parse(data) {
    const dataU32 = new Uint32Array(data);

    // check magic bits
    if (IDENTIFIER[0] !== dataU32[0] || IDENTIFIER[1] !== dataU32[1] || IDENTIFIER[2] !== dataU32[2]) {
      Debug.warn('Invalid definition header found in KTX file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A');
      return null;
    }

    // unpack header info
    const header = {
      endianness: dataU32[3],
      // todo: Use this information
      glType: dataU32[4],
      glTypeSize: dataU32[5],
      glFormat: dataU32[6],
      glInternalFormat: dataU32[7],
      glBaseInternalFormat: dataU32[8],
      pixelWidth: dataU32[9],
      pixelHeight: dataU32[10],
      pixelDepth: dataU32[11],
      numberOfArrayElements: dataU32[12],
      numberOfFaces: dataU32[13],
      numberOfMipmapLevels: dataU32[14],
      bytesOfKeyValueData: dataU32[15]
    };

    // don't support volume textures
    if (header.pixelDepth > 1) {
      Debug.warn('More than 1 pixel depth not supported!');
      return null;
    }

    // don't support texture arrays
    if (header.numberOfArrayElements !== 0) {
      Debug.warn('Array texture not supported!');
      return null;
    }
    const format = KNOWN_FORMATS[header.glInternalFormat];

    // only support subset of pixel formats
    if (format === undefined) {
      Debug.warn('Unknown glInternalFormat: ' + header.glInternalFormat);
      return null;
    }

    // offset locating the first byte of texture level data
    let offset = 16 + header.bytesOfKeyValueData / 4;
    const isCubemap = header.numberOfFaces > 1;
    const levels = [];
    for (let mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
      const imageSizeInBytes = dataU32[offset++];
      if (isCubemap) {
        levels.push([]);
      }
      const target = isCubemap ? levels[mipmapLevel] : levels;
      for (let face = 0; face < (isCubemap ? 6 : 1); ++face) {
        target.push(createContainer(format, data, offset * 4, imageSizeInBytes));
        offset += imageSizeInBytes + 3 >> 2;
      }
    }
    return {
      format: format,
      width: header.pixelWidth,
      height: header.pixelHeight,
      levels: levels,
      cubemap: isCubemap
    };
  }
}

export { KtxParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia3R4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvdGV4dHVyZS9rdHguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEFERFJFU1NfUkVQRUFULFxuICAgIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfRVRDMSwgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSxcbiAgICBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX1NSR0IsIFBJWEVMRk9STUFUX1NSR0JBLFxuICAgIFBJWEVMRk9STUFUXzExMTExMEYsIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RixcbiAgICBURVhISU5UX0FTU0VUXG59IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vaGFuZGxlcnMvdGV4dHVyZS5qcycpLlRleHR1cmVQYXJzZXJ9IFRleHR1cmVQYXJzZXIgKi9cblxuLy8gRGVmaW5lZCBoZXJlOiBodHRwczovL3d3dy5raHJvbm9zLm9yZy9vcGVuZ2xlcy9zZGsvdG9vbHMvS1RYL2ZpbGVfZm9ybWF0X3NwZWMvXG5jb25zdCBJREVOVElGSUVSID0gWzB4NTg1NDRCQUIsIDB4QkIzMTMxMjAsIDB4MEExQTBBMERdOyAvLyDCq0tUWCAxMcK7XFxyXFxuXFx4MUFcXG5cblxuY29uc3QgS05PV05fRk9STUFUUyA9IHtcbiAgICAvLyBjb21wcmVzc2VkIGZvcm1hdHNcbiAgICAweDgzRjA6IFBJWEVMRk9STUFUX0RYVDEsXG4gICAgMHg4M0YyOiBQSVhFTEZPUk1BVF9EWFQzLFxuICAgIDB4ODNGMzogUElYRUxGT1JNQVRfRFhUNSxcbiAgICAweDhENjQ6IFBJWEVMRk9STUFUX0VUQzEsXG4gICAgMHg5Mjc0OiBQSVhFTEZPUk1BVF9FVEMyX1JHQixcbiAgICAweDkyNzg6IFBJWEVMRk9STUFUX0VUQzJfUkdCQSxcbiAgICAweDhDMDA6IFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsXG4gICAgMHg4QzAxOiBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLFxuICAgIDB4OEMwMjogUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsXG4gICAgMHg4QzAzOiBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSxcblxuICAgIC8vIHVuY29tcHJlc3NlZCBmb3JtYXRzXG4gICAgMHg4MDUxOiBQSVhFTEZPUk1BVF9SR0I4LCAgICAgICAvLyBHTF9SR0I4XG4gICAgMHg4MDU4OiBQSVhFTEZPUk1BVF9SR0JBOCwgICAgLy8gR0xfUkdCQThcbiAgICAweDhDNDE6IFBJWEVMRk9STUFUX1NSR0IsICAgICAgICAgICAvLyBHTF9TUkdCOFxuICAgIDB4OEM0MzogUElYRUxGT1JNQVRfU1JHQkEsICAgICAgICAgIC8vIEdMX1NSR0I4X0FMUEhBOFxuICAgIDB4OEMzQTogUElYRUxGT1JNQVRfMTExMTEwRiwgICAgICAgIC8vIEdMX1IxMUZfRzExRl9CMTBGXG4gICAgMHg4ODFCOiBQSVhFTEZPUk1BVF9SR0IxNkYsICAgICAgICAgLy8gR0xfUkdCMTZGXG4gICAgMHg4ODFBOiBQSVhFTEZPUk1BVF9SR0JBMTZGICAgICAgICAgLy8gR0xfUkdCQTE2RlxufTtcblxuZnVuY3Rpb24gY3JlYXRlQ29udGFpbmVyKHBpeGVsRm9ybWF0LCBidWZmZXIsIGJ5dGVPZmZzZXQsIGJ5dGVTaXplKSB7XG4gICAgcmV0dXJuIChwaXhlbEZvcm1hdCA9PT0gUElYRUxGT1JNQVRfMTExMTEwRikgP1xuICAgICAgICBuZXcgVWludDMyQXJyYXkoYnVmZmVyLCBieXRlT2Zmc2V0LCBieXRlU2l6ZSAvIDQpIDpcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCBieXRlT2Zmc2V0LCBieXRlU2l6ZSk7XG59XG5cbi8qKlxuICogVGV4dHVyZSBwYXJzZXIgZm9yIGt0eCBmaWxlcy5cbiAqXG4gKiBAaW1wbGVtZW50cyB7VGV4dHVyZVBhcnNlcn1cbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgS3R4UGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihyZWdpc3RyeSkge1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgY2FsbGJhY2ssIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBkZXZpY2UsIHRleHR1cmVPcHRpb25zID0ge30pIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZURhdGEgPSB0aGlzLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgIGlmICghdGV4dHVyZURhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogdXJsLFxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgcHJvZmlsZXJIaW50OiBURVhISU5UX0FTU0VULFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICBhZGRyZXNzVTogdGV4dHVyZURhdGEuY3ViZW1hcCA/IEFERFJFU1NfQ0xBTVBfVE9fRURHRSA6IEFERFJFU1NfUkVQRUFULFxuICAgICAgICAgICAgYWRkcmVzc1Y6IHRleHR1cmVEYXRhLmN1YmVtYXAgPyBBRERSRVNTX0NMQU1QX1RPX0VER0UgOiBBRERSRVNTX1JFUEVBVCxcbiAgICAgICAgICAgIHdpZHRoOiB0ZXh0dXJlRGF0YS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogdGV4dHVyZURhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgZm9ybWF0OiB0ZXh0dXJlRGF0YS5mb3JtYXQsXG4gICAgICAgICAgICBjdWJlbWFwOiB0ZXh0dXJlRGF0YS5jdWJlbWFwLFxuICAgICAgICAgICAgbGV2ZWxzOiB0ZXh0dXJlRGF0YS5sZXZlbHMsXG5cbiAgICAgICAgICAgIC4uLnRleHR1cmVPcHRpb25zXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRleHR1cmUudXBsb2FkKCk7XG5cbiAgICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgfVxuXG4gICAgcGFyc2UoZGF0YSkge1xuICAgICAgICBjb25zdCBkYXRhVTMyID0gbmV3IFVpbnQzMkFycmF5KGRhdGEpO1xuXG4gICAgICAgIC8vIGNoZWNrIG1hZ2ljIGJpdHNcbiAgICAgICAgaWYgKElERU5USUZJRVJbMF0gIT09IGRhdGFVMzJbMF0gfHxcbiAgICAgICAgICAgIElERU5USUZJRVJbMV0gIT09IGRhdGFVMzJbMV0gfHxcbiAgICAgICAgICAgIElERU5USUZJRVJbMl0gIT09IGRhdGFVMzJbMl0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ0ludmFsaWQgZGVmaW5pdGlvbiBoZWFkZXIgZm91bmQgaW4gS1RYIGZpbGUuIEV4cGVjdGVkIDB4QUI0QjU0NTgsIDB4MjAzMTMxQkIsIDB4MEQwQTFBMEEnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdW5wYWNrIGhlYWRlciBpbmZvXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IHtcbiAgICAgICAgICAgIGVuZGlhbm5lc3M6IGRhdGFVMzJbM10sIC8vIHRvZG86IFVzZSB0aGlzIGluZm9ybWF0aW9uXG4gICAgICAgICAgICBnbFR5cGU6IGRhdGFVMzJbNF0sXG4gICAgICAgICAgICBnbFR5cGVTaXplOiBkYXRhVTMyWzVdLFxuICAgICAgICAgICAgZ2xGb3JtYXQ6IGRhdGFVMzJbNl0sXG4gICAgICAgICAgICBnbEludGVybmFsRm9ybWF0OiBkYXRhVTMyWzddLFxuICAgICAgICAgICAgZ2xCYXNlSW50ZXJuYWxGb3JtYXQ6IGRhdGFVMzJbOF0sXG4gICAgICAgICAgICBwaXhlbFdpZHRoOiBkYXRhVTMyWzldLFxuICAgICAgICAgICAgcGl4ZWxIZWlnaHQ6IGRhdGFVMzJbMTBdLFxuICAgICAgICAgICAgcGl4ZWxEZXB0aDogZGF0YVUzMlsxMV0sXG4gICAgICAgICAgICBudW1iZXJPZkFycmF5RWxlbWVudHM6IGRhdGFVMzJbMTJdLFxuICAgICAgICAgICAgbnVtYmVyT2ZGYWNlczogZGF0YVUzMlsxM10sXG4gICAgICAgICAgICBudW1iZXJPZk1pcG1hcExldmVsczogZGF0YVUzMlsxNF0sXG4gICAgICAgICAgICBieXRlc09mS2V5VmFsdWVEYXRhOiBkYXRhVTMyWzE1XVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGRvbid0IHN1cHBvcnQgdm9sdW1lIHRleHR1cmVzXG4gICAgICAgIGlmIChoZWFkZXIucGl4ZWxEZXB0aCA+IDEpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ01vcmUgdGhhbiAxIHBpeGVsIGRlcHRoIG5vdCBzdXBwb3J0ZWQhJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvbid0IHN1cHBvcnQgdGV4dHVyZSBhcnJheXNcbiAgICAgICAgaWYgKGhlYWRlci5udW1iZXJPZkFycmF5RWxlbWVudHMgIT09IDApIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ0FycmF5IHRleHR1cmUgbm90IHN1cHBvcnRlZCEnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZm9ybWF0ID0gS05PV05fRk9STUFUU1toZWFkZXIuZ2xJbnRlcm5hbEZvcm1hdF07XG5cbiAgICAgICAgLy8gb25seSBzdXBwb3J0IHN1YnNldCBvZiBwaXhlbCBmb3JtYXRzXG4gICAgICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgRGVidWcud2FybignVW5rbm93biBnbEludGVybmFsRm9ybWF0OiAnICsgaGVhZGVyLmdsSW50ZXJuYWxGb3JtYXQpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBvZmZzZXQgbG9jYXRpbmcgdGhlIGZpcnN0IGJ5dGUgb2YgdGV4dHVyZSBsZXZlbCBkYXRhXG4gICAgICAgIGxldCBvZmZzZXQgPSAxNiArIGhlYWRlci5ieXRlc09mS2V5VmFsdWVEYXRhIC8gNDtcblxuICAgICAgICBjb25zdCBpc0N1YmVtYXAgPSAoaGVhZGVyLm51bWJlck9mRmFjZXMgPiAxKTtcbiAgICAgICAgY29uc3QgbGV2ZWxzID0gW107XG4gICAgICAgIGZvciAobGV0IG1pcG1hcExldmVsID0gMDsgbWlwbWFwTGV2ZWwgPCAoaGVhZGVyLm51bWJlck9mTWlwbWFwTGV2ZWxzIHx8IDEpOyBtaXBtYXBMZXZlbCsrKSB7XG4gICAgICAgICAgICBjb25zdCBpbWFnZVNpemVJbkJ5dGVzID0gZGF0YVUzMltvZmZzZXQrK107XG5cbiAgICAgICAgICAgIGlmIChpc0N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBsZXZlbHMucHVzaChbXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGlzQ3ViZW1hcCA/IGxldmVsc1ttaXBtYXBMZXZlbF0gOiBsZXZlbHM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgKGlzQ3ViZW1hcCA/IDYgOiAxKTsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnB1c2goY3JlYXRlQ29udGFpbmVyKGZvcm1hdCwgZGF0YSwgb2Zmc2V0ICogNCwgaW1hZ2VTaXplSW5CeXRlcykpO1xuICAgICAgICAgICAgICAgIG9mZnNldCArPSAoaW1hZ2VTaXplSW5CeXRlcyArIDMpID4+IDI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgICAgICB3aWR0aDogaGVhZGVyLnBpeGVsV2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlYWRlci5waXhlbEhlaWdodCxcbiAgICAgICAgICAgIGxldmVsczogbGV2ZWxzLFxuICAgICAgICAgICAgY3ViZW1hcDogaXNDdWJlbWFwXG4gICAgICAgIH07XG4gICAgfVxufVxuXG5leHBvcnQgeyBLdHhQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJJREVOVElGSUVSIiwiS05PV05fRk9STUFUUyIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9EWFQzIiwiUElYRUxGT1JNQVRfRFhUNSIsIlBJWEVMRk9STUFUX0VUQzEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1JHQjgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIlBJWEVMRk9STUFUX1NSR0IiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJQSVhFTEZPUk1BVF9SR0IxNkYiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiY3JlYXRlQ29udGFpbmVyIiwicGl4ZWxGb3JtYXQiLCJidWZmZXIiLCJieXRlT2Zmc2V0IiwiYnl0ZVNpemUiLCJVaW50MzJBcnJheSIsIlVpbnQ4QXJyYXkiLCJLdHhQYXJzZXIiLCJjb25zdHJ1Y3RvciIsInJlZ2lzdHJ5IiwibWF4UmV0cmllcyIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsImFzc2V0IiwiQXNzZXQiLCJmZXRjaEFycmF5QnVmZmVyIiwib3BlbiIsImRhdGEiLCJkZXZpY2UiLCJ0ZXh0dXJlT3B0aW9ucyIsInRleHR1cmVEYXRhIiwicGFyc2UiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsIl9leHRlbmRzIiwibmFtZSIsInByb2ZpbGVySGludCIsIlRFWEhJTlRfQVNTRVQiLCJhZGRyZXNzVSIsImN1YmVtYXAiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX1JFUEVBVCIsImFkZHJlc3NWIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJsZXZlbHMiLCJ1cGxvYWQiLCJkYXRhVTMyIiwiRGVidWciLCJ3YXJuIiwiaGVhZGVyIiwiZW5kaWFubmVzcyIsImdsVHlwZSIsImdsVHlwZVNpemUiLCJnbEZvcm1hdCIsImdsSW50ZXJuYWxGb3JtYXQiLCJnbEJhc2VJbnRlcm5hbEZvcm1hdCIsInBpeGVsV2lkdGgiLCJwaXhlbEhlaWdodCIsInBpeGVsRGVwdGgiLCJudW1iZXJPZkFycmF5RWxlbWVudHMiLCJudW1iZXJPZkZhY2VzIiwibnVtYmVyT2ZNaXBtYXBMZXZlbHMiLCJieXRlc09mS2V5VmFsdWVEYXRhIiwidW5kZWZpbmVkIiwib2Zmc2V0IiwiaXNDdWJlbWFwIiwibWlwbWFwTGV2ZWwiLCJpbWFnZVNpemVJbkJ5dGVzIiwicHVzaCIsInRhcmdldCIsImZhY2UiXSwibWFwcGluZ3MiOiI7Ozs7OztBQWVBOztBQUVBO0FBQ0EsTUFBTUEsVUFB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
