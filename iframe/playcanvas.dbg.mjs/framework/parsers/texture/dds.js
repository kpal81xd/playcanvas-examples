import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
import { PIXELFORMAT_RGB8, TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT5, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_ETC1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';

/** @typedef {import('../../handlers/texture.js').TextureParser} TextureParser */

/**
 * Legacy texture parser for dds files.
 *
 * @implements {TextureParser}
 * @ignore
 */
class DdsParser {
  constructor(registry) {
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
  }
  open(url, data, device, textureOptions = {}) {
    const header = new Uint32Array(data, 0, 128 / 4);
    const width = header[4];
    const height = header[3];
    const mips = Math.max(header[7], 1);
    const isFourCc = header[20] === 4;
    const fcc = header[21];
    const bpp = header[22];
    const isCubemap = header[28] === 65024; // TODO: check by bitflag

    const FCC_DXT1 = 827611204; // DXT1
    const FCC_DXT5 = 894720068; // DXT5
    const FCC_FP16 = 113; // RGBA16f
    const FCC_FP32 = 116; // RGBA32f

    // non standard
    const FCC_ETC1 = 826496069;
    const FCC_PVRTC_2BPP_RGB_1 = 825438800;
    const FCC_PVRTC_2BPP_RGBA_1 = 825504336;
    const FCC_PVRTC_4BPP_RGB_1 = 825439312;
    const FCC_PVRTC_4BPP_RGBA_1 = 825504848;
    let compressed = false;
    let etc1 = false;
    let pvrtc2 = false;
    let pvrtc4 = false;
    let format = null;
    let componentSize = 1;
    let texture;
    if (isFourCc) {
      if (fcc === FCC_DXT1) {
        format = PIXELFORMAT_DXT1;
        compressed = true;
      } else if (fcc === FCC_DXT5) {
        format = PIXELFORMAT_DXT5;
        compressed = true;
      } else if (fcc === FCC_FP16) {
        format = PIXELFORMAT_RGBA16F;
        componentSize = 2;
      } else if (fcc === FCC_FP32) {
        format = PIXELFORMAT_RGBA32F;
        componentSize = 4;
      } else if (fcc === FCC_ETC1) {
        format = PIXELFORMAT_ETC1;
        compressed = true;
        etc1 = true;
      } else if (fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1) {
        format = fcc === FCC_PVRTC_2BPP_RGB_1 ? PIXELFORMAT_PVRTC_2BPP_RGB_1 : PIXELFORMAT_PVRTC_2BPP_RGBA_1;
        compressed = true;
        pvrtc2 = true;
      } else if (fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1) {
        format = fcc === FCC_PVRTC_4BPP_RGB_1 ? PIXELFORMAT_PVRTC_4BPP_RGB_1 : PIXELFORMAT_PVRTC_4BPP_RGBA_1;
        compressed = true;
        pvrtc4 = true;
      }
    } else {
      if (bpp === 32) {
        format = PIXELFORMAT_RGBA8;
      }
    }
    if (!format) {
      Debug.error(`This DDS pixel format is currently unsupported. Empty texture will be created instead of ${url}.`);
      texture = new Texture(device, {
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGB8,
        name: 'dds-legacy-empty'
      });
      return texture;
    }
    texture = new Texture(device, _extends({
      name: url,
      profilerHint: TEXHINT_ASSET,
      addressU: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      addressV: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      width: width,
      height: height,
      format: format,
      cubemap: isCubemap,
      mipmaps: mips > 1
    }, textureOptions));
    let offset = 128;
    const faces = isCubemap ? 6 : 1;
    let mipSize;
    const DXT_BLOCK_WIDTH = 4;
    const DXT_BLOCK_HEIGHT = 4;
    const blockSize = fcc === FCC_DXT1 ? 8 : 16;
    let numBlocksAcross, numBlocksDown, numBlocks;
    for (let face = 0; face < faces; face++) {
      let mipWidth = width;
      let mipHeight = height;
      for (let i = 0; i < mips; i++) {
        if (compressed) {
          if (etc1) {
            mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8;
          } else if (pvrtc2) {
            mipSize = Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4;
          } else if (pvrtc4) {
            mipSize = Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2;
          } else {
            numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
            numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
            numBlocks = numBlocksAcross * numBlocksDown;
            mipSize = numBlocks * blockSize;
          }
        } else {
          mipSize = mipWidth * mipHeight * 4;
        }
        const mipBuff = format === PIXELFORMAT_RGBA32F ? new Float32Array(data, offset, mipSize) : format === PIXELFORMAT_RGBA16F ? new Uint16Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
        if (!isCubemap) {
          texture._levels[i] = mipBuff;
        } else {
          if (!texture._levels[i]) texture._levels[i] = [];
          texture._levels[i][face] = mipBuff;
        }
        offset += mipSize * componentSize;
        mipWidth = Math.max(mipWidth * 0.5, 1);
        mipHeight = Math.max(mipHeight * 0.5, 1);
      }
    }
    texture.upload();
    return texture;
  }
}

export { DdsParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvdGV4dHVyZS9kZHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEFERFJFU1NfUkVQRUFULFxuICAgIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfRVRDMSxcbiAgICBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBURVhISU5UX0FTU0VUXG59IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vaGFuZGxlcnMvdGV4dHVyZS5qcycpLlRleHR1cmVQYXJzZXJ9IFRleHR1cmVQYXJzZXIgKi9cblxuLyoqXG4gKiBMZWdhY3kgdGV4dHVyZSBwYXJzZXIgZm9yIGRkcyBmaWxlcy5cbiAqXG4gKiBAaW1wbGVtZW50cyB7VGV4dHVyZVBhcnNlcn1cbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRGRzUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihyZWdpc3RyeSkge1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgY2FsbGJhY2ssIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBkZXZpY2UsIHRleHR1cmVPcHRpb25zID0ge30pIHtcbiAgICAgICAgY29uc3QgaGVhZGVyID0gbmV3IFVpbnQzMkFycmF5KGRhdGEsIDAsIDEyOCAvIDQpO1xuXG4gICAgICAgIGNvbnN0IHdpZHRoID0gaGVhZGVyWzRdO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBoZWFkZXJbM107XG4gICAgICAgIGNvbnN0IG1pcHMgPSBNYXRoLm1heChoZWFkZXJbN10sIDEpO1xuICAgICAgICBjb25zdCBpc0ZvdXJDYyA9IGhlYWRlclsyMF0gPT09IDQ7XG4gICAgICAgIGNvbnN0IGZjYyA9IGhlYWRlclsyMV07XG4gICAgICAgIGNvbnN0IGJwcCA9IGhlYWRlclsyMl07XG4gICAgICAgIGNvbnN0IGlzQ3ViZW1hcCA9IGhlYWRlclsyOF0gPT09IDY1MDI0OyAvLyBUT0RPOiBjaGVjayBieSBiaXRmbGFnXG5cbiAgICAgICAgY29uc3QgRkNDX0RYVDEgPSA4Mjc2MTEyMDQ7IC8vIERYVDFcbiAgICAgICAgY29uc3QgRkNDX0RYVDUgPSA4OTQ3MjAwNjg7IC8vIERYVDVcbiAgICAgICAgY29uc3QgRkNDX0ZQMTYgPSAxMTM7ICAgICAgIC8vIFJHQkExNmZcbiAgICAgICAgY29uc3QgRkNDX0ZQMzIgPSAxMTY7ICAgICAgIC8vIFJHQkEzMmZcblxuICAgICAgICAvLyBub24gc3RhbmRhcmRcbiAgICAgICAgY29uc3QgRkNDX0VUQzEgPSA4MjY0OTYwNjk7XG4gICAgICAgIGNvbnN0IEZDQ19QVlJUQ18yQlBQX1JHQl8xID0gODI1NDM4ODAwO1xuICAgICAgICBjb25zdCBGQ0NfUFZSVENfMkJQUF9SR0JBXzEgPSA4MjU1MDQzMzY7XG4gICAgICAgIGNvbnN0IEZDQ19QVlJUQ180QlBQX1JHQl8xID0gODI1NDM5MzEyO1xuICAgICAgICBjb25zdCBGQ0NfUFZSVENfNEJQUF9SR0JBXzEgPSA4MjU1MDQ4NDg7XG5cbiAgICAgICAgbGV0IGNvbXByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IGV0YzEgPSBmYWxzZTtcbiAgICAgICAgbGV0IHB2cnRjMiA9IGZhbHNlO1xuICAgICAgICBsZXQgcHZydGM0ID0gZmFsc2U7XG4gICAgICAgIGxldCBmb3JtYXQgPSBudWxsO1xuICAgICAgICBsZXQgY29tcG9uZW50U2l6ZSA9IDE7XG5cbiAgICAgICAgbGV0IHRleHR1cmU7XG5cbiAgICAgICAgaWYgKGlzRm91ckNjKSB7XG4gICAgICAgICAgICBpZiAoZmNjID09PSBGQ0NfRFhUMSkge1xuICAgICAgICAgICAgICAgIGZvcm1hdCA9IFBJWEVMRk9STUFUX0RYVDE7XG4gICAgICAgICAgICAgICAgY29tcHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZjYyA9PT0gRkNDX0RYVDUpIHtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBQSVhFTEZPUk1BVF9EWFQ1O1xuICAgICAgICAgICAgICAgIGNvbXByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmY2MgPT09IEZDQ19GUDE2KSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplID0gMjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmNjID09PSBGQ0NfRlAzMikge1xuICAgICAgICAgICAgICAgIGZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZSA9IDQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZjYyA9PT0gRkNDX0VUQzEpIHtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBQSVhFTEZPUk1BVF9FVEMxO1xuICAgICAgICAgICAgICAgIGNvbXByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGV0YzEgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmY2MgPT09IEZDQ19QVlJUQ18yQlBQX1JHQl8xIHx8IGZjYyA9PT0gRkNDX1BWUlRDXzJCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gZmNjID09PSBGQ0NfUFZSVENfMkJQUF9SR0JfMSA/IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEgOiBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMTtcbiAgICAgICAgICAgICAgICBjb21wcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBwdnJ0YzIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmY2MgPT09IEZDQ19QVlJUQ180QlBQX1JHQl8xIHx8IGZjYyA9PT0gRkNDX1BWUlRDXzRCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gZmNjID09PSBGQ0NfUFZSVENfNEJQUF9SR0JfMSA/IFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEgOiBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMTtcbiAgICAgICAgICAgICAgICBjb21wcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBwdnJ0YzQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGJwcCA9PT0gMzIpIHtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZm9ybWF0KSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgVGhpcyBERFMgcGl4ZWwgZm9ybWF0IGlzIGN1cnJlbnRseSB1bnN1cHBvcnRlZC4gRW1wdHkgdGV4dHVyZSB3aWxsIGJlIGNyZWF0ZWQgaW5zdGVhZCBvZiAke3VybH0uYCk7XG4gICAgICAgICAgICB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IDQsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiA0LFxuICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCOCxcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGRzLWxlZ2FjeS1lbXB0eSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiB1cmwsXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBwcm9maWxlckhpbnQ6IFRFWEhJTlRfQVNTRVQsXG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgIGFkZHJlc3NVOiBpc0N1YmVtYXAgPyBBRERSRVNTX0NMQU1QX1RPX0VER0UgOiBBRERSRVNTX1JFUEVBVCxcbiAgICAgICAgICAgIGFkZHJlc3NWOiBpc0N1YmVtYXAgPyBBRERSRVNTX0NMQU1QX1RPX0VER0UgOiBBRERSRVNTX1JFUEVBVCxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgICAgICBjdWJlbWFwOiBpc0N1YmVtYXAsXG4gICAgICAgICAgICBtaXBtYXBzOiBtaXBzID4gMSxcblxuICAgICAgICAgICAgLi4udGV4dHVyZU9wdGlvbnNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IG9mZnNldCA9IDEyODtcbiAgICAgICAgY29uc3QgZmFjZXMgPSBpc0N1YmVtYXAgPyA2IDogMTtcbiAgICAgICAgbGV0IG1pcFNpemU7XG4gICAgICAgIGNvbnN0IERYVF9CTE9DS19XSURUSCA9IDQ7XG4gICAgICAgIGNvbnN0IERYVF9CTE9DS19IRUlHSFQgPSA0O1xuICAgICAgICBjb25zdCBibG9ja1NpemUgPSBmY2MgPT09IEZDQ19EWFQxID8gOCA6IDE2O1xuICAgICAgICBsZXQgbnVtQmxvY2tzQWNyb3NzLCBudW1CbG9ja3NEb3duLCBudW1CbG9ja3M7XG4gICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZXM7IGZhY2UrKykge1xuICAgICAgICAgICAgbGV0IG1pcFdpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICBsZXQgbWlwSGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaXBzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXRjMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlwU2l6ZSA9IE1hdGguZmxvb3IoKG1pcFdpZHRoICsgMykgLyA0KSAqIE1hdGguZmxvb3IoKG1pcEhlaWdodCArIDMpIC8gNCkgKiA4O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHB2cnRjMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlwU2l6ZSA9IE1hdGgubWF4KG1pcFdpZHRoLCAxNikgKiBNYXRoLm1heChtaXBIZWlnaHQsIDgpIC8gNDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwdnJ0YzQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcFNpemUgPSBNYXRoLm1heChtaXBXaWR0aCwgOCkgKiBNYXRoLm1heChtaXBIZWlnaHQsIDgpIC8gMjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG51bUJsb2Nrc0Fjcm9zcyA9IE1hdGguZmxvb3IoKG1pcFdpZHRoICsgRFhUX0JMT0NLX1dJRFRIIC0gMSkgLyBEWFRfQkxPQ0tfV0lEVEgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbnVtQmxvY2tzRG93biA9IE1hdGguZmxvb3IoKG1pcEhlaWdodCArIERYVF9CTE9DS19IRUlHSFQgLSAxKSAvIERYVF9CTE9DS19IRUlHSFQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbnVtQmxvY2tzID0gbnVtQmxvY2tzQWNyb3NzICogbnVtQmxvY2tzRG93bjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcFNpemUgPSBudW1CbG9ja3MgKiBibG9ja1NpemU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtaXBTaXplID0gbWlwV2lkdGggKiBtaXBIZWlnaHQgKiA0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1pcEJ1ZmYgPSBmb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkEzMkYgPyBuZXcgRmxvYXQzMkFycmF5KGRhdGEsIG9mZnNldCwgbWlwU2l6ZSkgOlxuICAgICAgICAgICAgICAgICAgICAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGID8gbmV3IFVpbnQxNkFycmF5KGRhdGEsIG9mZnNldCwgbWlwU2l6ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFVpbnQ4QXJyYXkoZGF0YSwgb2Zmc2V0LCBtaXBTaXplKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzQ3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNbaV0gPSBtaXBCdWZmO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzW2ldKSB0ZXh0dXJlLl9sZXZlbHNbaV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbGV2ZWxzW2ldW2ZhY2VdID0gbWlwQnVmZjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb2Zmc2V0ICs9IG1pcFNpemUgKiBjb21wb25lbnRTaXplO1xuICAgICAgICAgICAgICAgIG1pcFdpZHRoID0gTWF0aC5tYXgobWlwV2lkdGggKiAwLjUsIDEpO1xuICAgICAgICAgICAgICAgIG1pcEhlaWdodCA9IE1hdGgubWF4KG1pcEhlaWdodCAqIDAuNSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlLnVwbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgRGRzUGFyc2VyIH07XG4iXSwibmFtZXMiOlsiRGRzUGFyc2VyIiwiY29uc3RydWN0b3IiLCJyZWdpc3RyeSIsIm1heFJldHJpZXMiLCJsb2FkIiwidXJsIiwiY2FsbGJhY2siLCJhc3NldCIsIkFzc2V0IiwiZmV0Y2hBcnJheUJ1ZmZlciIsIm9wZW4iLCJkYXRhIiwiZGV2aWNlIiwidGV4dHVyZU9wdGlvbnMiLCJoZWFkZXIiLCJVaW50MzJBcnJheSIsIndpZHRoIiwiaGVpZ2h0IiwibWlwcyIsIk1hdGgiLCJtYXgiLCJpc0ZvdXJDYyIsImZjYyIsImJwcCIsImlzQ3ViZW1hcCIsIkZDQ19EWFQxIiwiRkNDX0RYVDUiLCJGQ0NfRlAxNiIsIkZDQ19GUDMyIiwiRkNDX0VUQzEiLCJGQ0NfUFZSVENfMkJQUF9SR0JfMSIsIkZDQ19QVlJUQ18yQlBQX1JHQkFfMSIsIkZDQ19QVlJUQ180QlBQX1JHQl8xIiwiRkNDX1BWUlRDXzRCUFBfUkdCQV8xIiwiY29tcHJlc3NlZCIsImV0YzEiLCJwdnJ0YzIiLCJwdnJ0YzQiLCJmb3JtYXQiLCJjb21wb25lbnRTaXplIiwidGV4dHVyZSIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJEZWJ1ZyIsImVycm9yIiwiVGV4dHVyZSIsIlBJWEVMRk9STUFUX1JHQjgiLCJuYW1lIiwiX2V4dGVuZHMiLCJwcm9maWxlckhpbnQiLCJURVhISU5UX0FTU0VUIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX1JFUEVBVCIsImFkZHJlc3NWIiwiY3ViZW1hcCIsIm1pcG1hcHMiLCJvZmZzZXQiLCJmYWNlcyIsIm1pcFNpemUiLCJEWFRfQkxPQ0tfV0lEVEgiLCJEWFRfQkxPQ0tfSEVJR0hUIiwiYmxvY2tTaXplIiwibnVtQmxvY2tzQWNyb3NzIiwibnVtQmxvY2tzRG93biIsIm51bUJsb2NrcyIsImZhY2UiLCJtaXBXaWR0aCIsIm1pcEhlaWdodCIsImkiLCJmbG9vciIsIm1pcEJ1ZmYiLCJGbG9hdDMyQXJyYXkiLCJVaW50MTZBcnJheSIsIlVpbnQ4QXJyYXkiLCJfbGV2ZWxzIiwidXBsb2FkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFlQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxTQUFTLENBQUM7RUFDWkMsV0FBV0EsQ0FBQ0MsUUFBUSxFQUFFO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUN2QixHQUFBO0FBRUFDLEVBQUFBLElBQUlBLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUU7QUFDdkJDLElBQUFBLEtBQUssQ0FBQ0MsZ0JBQWdCLENBQUNKLEdBQUcsQ0FBQ0QsSUFBSSxFQUFFRSxRQUFRLEVBQUVDLEtBQUssRUFBRSxJQUFJLENBQUNKLFVBQVUsQ0FBQyxDQUFBO0FBQ3RFLEdBQUE7RUFFQU8sSUFBSUEsQ0FBQ0wsR0FBRyxFQUFFTSxJ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