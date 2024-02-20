import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
import { ReadStream } from '../../../core/read-stream.js';
import { TEXHINT_ASSET, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8, TEXTURETYPE_RGBE } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';

/** @typedef {import('../../handlers/texture.js').TextureParser} TextureParser */

/**
 * Texture parser for hdr files.
 *
 * @implements {TextureParser}
 * @ignore
 */
class HdrParser {
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
      addressU: ADDRESS_REPEAT,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      width: textureData.width,
      height: textureData.height,
      levels: textureData.levels,
      format: PIXELFORMAT_RGBA8,
      type: TEXTURETYPE_RGBE,
      // RGBE can't be filtered, so mipmaps are out of the question! (unless we generated them ourselves)
      mipmaps: false
    }, textureOptions));
    texture.upload();
    return texture;
  }

  // https://floyd.lbl.gov/radiance/refer/filefmts.pdf with help from http://www.graphics.cornell.edu/~bjw/rgbe/rgbe.c
  parse(data) {
    const readStream = new ReadStream(data);

    // require magic
    const magic = readStream.readLine();
    if (!magic.startsWith('#?RADIANCE')) {
      Debug.error('radiance header has invalid magic');
      return null;
    }

    // read header variables
    const variables = {};
    while (true) {
      const line = readStream.readLine();
      if (line.length === 0) {
        // empty line signals end of header
        break;
      } else {
        const parts = line.split('=');
        if (parts.length === 2) {
          variables[parts[0]] = parts[1];
        }
      }
    }

    // we require FORMAT variable
    if (!variables.hasOwnProperty('FORMAT')) {
      Debug.error('radiance header missing FORMAT variable');
      return null;
    }

    // read the resolution specifier
    const resolution = readStream.readLine().split(' ');
    if (resolution.length !== 4) {
      Debug.error('radiance header has invalid resolution');
      return null;
    }
    const height = parseInt(resolution[1], 10);
    const width = parseInt(resolution[3], 10);
    const pixels = this._readPixels(readStream, width, height, resolution[0] === '-Y');
    if (!pixels) {
      return null;
    }

    // create texture
    return {
      width: width,
      height: height,
      levels: [pixels]
    };
  }
  _readPixels(readStream, width, height, flipY) {
    // out of bounds
    if (width < 8 || width > 0x7fff) {
      return this._readPixelsFlat(readStream, width, height);
    }
    const rgbe = [0, 0, 0, 0];

    // check first scanline width to determine whether the file is RLE
    readStream.readArray(rgbe);
    if (rgbe[0] !== 2 || rgbe[1] !== 2 || (rgbe[2] & 0x80) !== 0) {
      // not RLE
      readStream.skip(-4);
      return this._readPixelsFlat(readStream, width, height);
    }

    // allocate texture buffer
    const buffer = new ArrayBuffer(width * height * 4);
    const view = new Uint8Array(buffer);
    let scanstart = flipY ? 0 : width * 4 * (height - 1);
    let x, y, i, channel, count, value;
    for (y = 0; y < height; ++y) {
      // read scanline width specifier
      if (y) {
        readStream.readArray(rgbe);
      }

      // sanity check it
      if ((rgbe[2] << 8) + rgbe[3] !== width) {
        Debug.error('radiance has invalid scanline width');
        return null;
      }

      // each scanline is stored by channel
      for (channel = 0; channel < 4; ++channel) {
        x = 0;
        while (x < width) {
          count = readStream.readU8();
          if (count > 128) {
            // run of the same value
            count -= 128;
            if (x + count > width) {
              Debug.error('radiance has invalid scanline data');
              return null;
            }
            value = readStream.readU8();
            for (i = 0; i < count; ++i) {
              view[scanstart + channel + 4 * x++] = value;
            }
          } else {
            // non-run
            if (count === 0 || x + count > width) {
              Debug.error('radiance has invalid scanline data');
              return null;
            }
            for (i = 0; i < count; ++i) {
              view[scanstart + channel + 4 * x++] = readStream.readU8();
            }
          }
        }
      }
      scanstart += width * 4 * (flipY ? 1 : -1);
    }
    return view;
  }
  _readPixelsFlat(readStream, width, height) {
    return readStream.remainingBytes === width * height * 4 ? new Uint8Array(readStream.arraybuffer, readStream.offset) : null;
  }
}

export { HdrParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGRyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvdGV4dHVyZS9oZHIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFJlYWRTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3JlYWQtc3RyZWFtLmpzJztcblxuaW1wb3J0IHtcbiAgICBURVhISU5UX0FTU0VULFxuICAgIEFERFJFU1NfUkVQRUFULCBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgVEVYVFVSRVRZUEVfUkdCRVxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2hhbmRsZXJzL3RleHR1cmUuanMnKS5UZXh0dXJlUGFyc2VyfSBUZXh0dXJlUGFyc2VyICovXG5cbi8qKlxuICogVGV4dHVyZSBwYXJzZXIgZm9yIGhkciBmaWxlcy5cbiAqXG4gKiBAaW1wbGVtZW50cyB7VGV4dHVyZVBhcnNlcn1cbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgSGRyUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihyZWdpc3RyeSkge1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgY2FsbGJhY2ssIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBkZXZpY2UsIHRleHR1cmVPcHRpb25zID0ge30pIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZURhdGEgPSB0aGlzLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgIGlmICghdGV4dHVyZURhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogdXJsLFxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgcHJvZmlsZXJIaW50OiBURVhISU5UX0FTU0VULFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19SRVBFQVQsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICB3aWR0aDogdGV4dHVyZURhdGEud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHRleHR1cmVEYXRhLmhlaWdodCxcbiAgICAgICAgICAgIGxldmVsczogdGV4dHVyZURhdGEubGV2ZWxzLFxuICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX1JHQkUsXG4gICAgICAgICAgICAvLyBSR0JFIGNhbid0IGJlIGZpbHRlcmVkLCBzbyBtaXBtYXBzIGFyZSBvdXQgb2YgdGhlIHF1ZXN0aW9uISAodW5sZXNzIHdlIGdlbmVyYXRlZCB0aGVtIG91cnNlbHZlcylcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuXG4gICAgICAgICAgICAuLi50ZXh0dXJlT3B0aW9uc1xuICAgICAgICB9KTtcblxuICAgICAgICB0ZXh0dXJlLnVwbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgIH1cblxuICAgIC8vIGh0dHBzOi8vZmxveWQubGJsLmdvdi9yYWRpYW5jZS9yZWZlci9maWxlZm10cy5wZGYgd2l0aCBoZWxwIGZyb20gaHR0cDovL3d3dy5ncmFwaGljcy5jb3JuZWxsLmVkdS9+Ymp3L3JnYmUvcmdiZS5jXG4gICAgcGFyc2UoZGF0YSkge1xuICAgICAgICBjb25zdCByZWFkU3RyZWFtID0gbmV3IFJlYWRTdHJlYW0oZGF0YSk7XG5cbiAgICAgICAgLy8gcmVxdWlyZSBtYWdpY1xuICAgICAgICBjb25zdCBtYWdpYyA9IHJlYWRTdHJlYW0ucmVhZExpbmUoKTtcbiAgICAgICAgaWYgKCFtYWdpYy5zdGFydHNXaXRoKCcjP1JBRElBTkNFJykpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdyYWRpYW5jZSBoZWFkZXIgaGFzIGludmFsaWQgbWFnaWMnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVhZCBoZWFkZXIgdmFyaWFibGVzXG4gICAgICAgIGNvbnN0IHZhcmlhYmxlcyA9IHsgfTtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSByZWFkU3RyZWFtLnJlYWRMaW5lKCk7XG4gICAgICAgICAgICBpZiAobGluZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBlbXB0eSBsaW5lIHNpZ25hbHMgZW5kIG9mIGhlYWRlclxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoJz0nKTtcbiAgICAgICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1twYXJ0c1swXV0gPSBwYXJ0c1sxXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZSByZXF1aXJlIEZPUk1BVCB2YXJpYWJsZVxuICAgICAgICBpZiAoIXZhcmlhYmxlcy5oYXNPd25Qcm9wZXJ0eSgnRk9STUFUJykpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdyYWRpYW5jZSBoZWFkZXIgbWlzc2luZyBGT1JNQVQgdmFyaWFibGUnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVhZCB0aGUgcmVzb2x1dGlvbiBzcGVjaWZpZXJcbiAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IHJlYWRTdHJlYW0ucmVhZExpbmUoKS5zcGxpdCgnICcpO1xuICAgICAgICBpZiAocmVzb2x1dGlvbi5sZW5ndGggIT09IDQpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdyYWRpYW5jZSBoZWFkZXIgaGFzIGludmFsaWQgcmVzb2x1dGlvbicpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWlnaHQgPSBwYXJzZUludChyZXNvbHV0aW9uWzFdLCAxMCk7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gcGFyc2VJbnQocmVzb2x1dGlvblszXSwgMTApO1xuICAgICAgICBjb25zdCBwaXhlbHMgPSB0aGlzLl9yZWFkUGl4ZWxzKHJlYWRTdHJlYW0sIHdpZHRoLCBoZWlnaHQsIHJlc29sdXRpb25bMF0gPT09ICctWScpO1xuXG4gICAgICAgIGlmICghcGl4ZWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSB0ZXh0dXJlXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGxldmVsczogW3BpeGVsc11cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBfcmVhZFBpeGVscyhyZWFkU3RyZWFtLCB3aWR0aCwgaGVpZ2h0LCBmbGlwWSkge1xuICAgICAgICAvLyBvdXQgb2YgYm91bmRzXG4gICAgICAgIGlmICh3aWR0aCA8IDggfHwgd2lkdGggPiAweDdmZmYpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWFkUGl4ZWxzRmxhdChyZWFkU3RyZWFtLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJnYmUgPSBbMCwgMCwgMCwgMF07XG5cbiAgICAgICAgLy8gY2hlY2sgZmlyc3Qgc2NhbmxpbmUgd2lkdGggdG8gZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGZpbGUgaXMgUkxFXG4gICAgICAgIHJlYWRTdHJlYW0ucmVhZEFycmF5KHJnYmUpO1xuICAgICAgICBpZiAoKHJnYmVbMF0gIT09IDIgfHwgcmdiZVsxXSAhPT0gMiB8fCAocmdiZVsyXSAmIDB4ODApICE9PSAwKSkge1xuICAgICAgICAgICAgLy8gbm90IFJMRVxuICAgICAgICAgICAgcmVhZFN0cmVhbS5za2lwKC00KTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWFkUGl4ZWxzRmxhdChyZWFkU3RyZWFtLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmUgYnVmZmVyXG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcih3aWR0aCAqIGhlaWdodCAqIDQpO1xuICAgICAgICBjb25zdCB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgbGV0IHNjYW5zdGFydCA9IGZsaXBZID8gMCA6IHdpZHRoICogNCAqIChoZWlnaHQgLSAxKTtcbiAgICAgICAgbGV0IHgsIHksIGksIGNoYW5uZWwsIGNvdW50LCB2YWx1ZTtcblxuICAgICAgICBmb3IgKHkgPSAwOyB5IDwgaGVpZ2h0OyArK3kpIHtcbiAgICAgICAgICAgIC8vIHJlYWQgc2NhbmxpbmUgd2lkdGggc3BlY2lmaWVyXG4gICAgICAgICAgICBpZiAoeSkge1xuICAgICAgICAgICAgICAgIHJlYWRTdHJlYW0ucmVhZEFycmF5KHJnYmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzYW5pdHkgY2hlY2sgaXRcbiAgICAgICAgICAgIGlmICgocmdiZVsyXSA8PCA4KSArIHJnYmVbM10gIT09IHdpZHRoKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ3JhZGlhbmNlIGhhcyBpbnZhbGlkIHNjYW5saW5lIHdpZHRoJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVhY2ggc2NhbmxpbmUgaXMgc3RvcmVkIGJ5IGNoYW5uZWxcbiAgICAgICAgICAgIGZvciAoY2hhbm5lbCA9IDA7IGNoYW5uZWwgPCA0OyArK2NoYW5uZWwpIHtcbiAgICAgICAgICAgICAgICB4ID0gMDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoeCA8IHdpZHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50ID0gcmVhZFN0cmVhbS5yZWFkVTgoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50ID4gMTI4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBydW4gb2YgdGhlIHNhbWUgdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50IC09IDEyODtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh4ICsgY291bnQgPiB3aWR0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKCdyYWRpYW5jZSBoYXMgaW52YWxpZCBzY2FubGluZSBkYXRhJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHJlYWRTdHJlYW0ucmVhZFU4KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY291bnQ7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdbc2NhbnN0YXJ0ICsgY2hhbm5lbCArIDQgKiB4KytdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBub24tcnVuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQgPT09IDAgfHwgeCArIGNvdW50ID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcigncmFkaWFuY2UgaGFzIGludmFsaWQgc2NhbmxpbmUgZGF0YScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNvdW50OyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3W3NjYW5zdGFydCArIGNoYW5uZWwgKyA0ICogeCsrXSA9IHJlYWRTdHJlYW0ucmVhZFU4KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjYW5zdGFydCArPSB3aWR0aCAqIDQgKiAoZmxpcFkgPyAxIDogLTEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZpZXc7XG4gICAgfVxuXG4gICAgX3JlYWRQaXhlbHNGbGF0KHJlYWRTdHJlYW0sIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgcmV0dXJuIHJlYWRTdHJlYW0ucmVtYWluaW5nQnl0ZXMgPT09IHdpZHRoICogaGVpZ2h0ICogNCA/IG5ldyBVaW50OEFycmF5KHJlYWRTdHJlYW0uYXJyYXlidWZmZXIsIHJlYWRTdHJlYW0ub2Zmc2V0KSA6IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBIZHJQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJIZHJQYXJzZXIiLCJjb25zdHJ1Y3RvciIsInJlZ2lzdHJ5IiwibWF4UmV0cmllcyIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsImFzc2V0IiwiQXNzZXQiLCJmZXRjaEFycmF5QnVmZmVyIiwib3BlbiIsImRhdGEiLCJkZXZpY2UiLCJ0ZXh0dXJlT3B0aW9ucyIsInRleHR1cmVEYXRhIiwicGFyc2UiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsIl9leHRlbmRzIiwibmFtZSIsInByb2ZpbGVySGludCIsIlRFWEhJTlRfQVNTRVQiLCJhZGRyZXNzVSIsIkFERFJFU1NfUkVQRUFUIiwiYWRkcmVzc1YiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsIndpZHRoIiwiaGVpZ2h0IiwibGV2ZWxzIiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfUkdCRSIsIm1pcG1hcHMiLCJ1cGxvYWQiLCJyZWFkU3RyZWFtIiwiUmVhZFN0cmVhbSIsIm1hZ2ljIiwicmVhZExpbmUiLCJzdGFydHNXaXRoIiwiRGVidWciLCJlcnJvciIsInZhcmlhYmxlcyIsImxpbmUiLCJsZW5ndGgiLCJwYXJ0cyIsInNwbGl0IiwiaGFzT3duUHJvcGVydHkiLCJyZXNvbHV0aW9uIiwicGFyc2VJbnQiLCJwaXhlbHMiLCJfcmVhZFBpeGVscyIsImZsaXBZIiwiX3JlYWRQaXhlbHNGbGF0IiwicmdiZSIsInJlYWRBcnJheSIsInNraXAiLCJidWZmZXIiLCJBcnJheUJ1ZmZlciIsInZpZXciLCJVaW50OEFycmF5Iiwic2NhbnN0YXJ0IiwieCIsInkiLCJpIiwiY2hhbm5lbCIsImNvdW50IiwidmFsdWUiLCJyZWFkVTgiLCJyZW1h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
