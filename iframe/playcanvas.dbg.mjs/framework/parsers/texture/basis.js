import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';

/** @typedef {import('../../handlers/texture.js').TextureParser} TextureParser */

/**
 * Parser for basis files.
 *
 * @implements {TextureParser}
 * @ignore
 */
class BasisParser {
  constructor(registry, device) {
    this.device = device;
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    const device = this.device;
    const transcode = data => {
      var _asset$file;
      const basisModuleFound = basisTranscode(device, url.load, data, callback, {
        isGGGR: ((asset == null || (_asset$file = asset.file) == null || (_asset$file = _asset$file.variants) == null || (_asset$file = _asset$file.basis) == null ? void 0 : _asset$file.opt) & 8) !== 0
      });
      if (!basisModuleFound) {
        callback(`Basis module not found. Asset '${asset.name}' basis texture variant will not be loaded.`);
      }
    };
    Asset.fetchArrayBuffer(url.load, (err, result) => {
      if (err) {
        callback(err);
      } else {
        transcode(result);
      }
    }, asset, this.maxRetries);
  }

  // our async transcode call provides the neat structure we need to create the texture instance
  open(url, data, device, textureOptions = {}) {
    const texture = new Texture(device, _extends({
      name: url,
      profilerHint: TEXHINT_ASSET,
      addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      width: data.width,
      height: data.height,
      format: data.format,
      cubemap: data.cubemap,
      levels: data.levels
    }, textureOptions));
    texture.upload();
    return texture;
  }
}

export { BasisParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvcGFyc2Vycy90ZXh0dXJlL2Jhc2lzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19SRVBFQVQsIFRFWEhJTlRfQVNTRVQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcbmltcG9ydCB7IGJhc2lzVHJhbnNjb2RlIH0gZnJvbSAnLi4vLi4vaGFuZGxlcnMvYmFzaXMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vaGFuZGxlcnMvdGV4dHVyZS5qcycpLlRleHR1cmVQYXJzZXJ9IFRleHR1cmVQYXJzZXIgKi9cblxuLyoqXG4gKiBQYXJzZXIgZm9yIGJhc2lzIGZpbGVzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtUZXh0dXJlUGFyc2VyfVxuICogQGlnbm9yZVxuICovXG5jbGFzcyBCYXNpc1BhcnNlciB7XG4gICAgY29uc3RydWN0b3IocmVnaXN0cnksIGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gMDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIGNvbnN0IHRyYW5zY29kZSA9IChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBiYXNpc01vZHVsZUZvdW5kID0gYmFzaXNUcmFuc2NvZGUoXG4gICAgICAgICAgICAgICAgZGV2aWNlLFxuICAgICAgICAgICAgICAgIHVybC5sb2FkLFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgICAgICAgICAgeyBpc0dHR1I6IChhc3NldD8uZmlsZT8udmFyaWFudHM/LmJhc2lzPy5vcHQgJiA4KSAhPT0gMCB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoIWJhc2lzTW9kdWxlRm91bmQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhgQmFzaXMgbW9kdWxlIG5vdCBmb3VuZC4gQXNzZXQgJyR7YXNzZXQubmFtZX0nIGJhc2lzIHRleHR1cmUgdmFyaWFudCB3aWxsIG5vdCBiZSBsb2FkZWQuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJhbnNjb2RlKHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIC8vIG91ciBhc3luYyB0cmFuc2NvZGUgY2FsbCBwcm92aWRlcyB0aGUgbmVhdCBzdHJ1Y3R1cmUgd2UgbmVlZCB0byBjcmVhdGUgdGhlIHRleHR1cmUgaW5zdGFuY2VcbiAgICBvcGVuKHVybCwgZGF0YSwgZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IHVybCxcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHByb2ZpbGVySGludDogVEVYSElOVF9BU1NFVCxcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgYWRkcmVzc1U6IGRhdGEuY3ViZW1hcCA/IEFERFJFU1NfQ0xBTVBfVE9fRURHRSA6IEFERFJFU1NfUkVQRUFULFxuICAgICAgICAgICAgYWRkcmVzc1Y6IGRhdGEuY3ViZW1hcCA/IEFERFJFU1NfQ0xBTVBfVE9fRURHRSA6IEFERFJFU1NfUkVQRUFULFxuICAgICAgICAgICAgd2lkdGg6IGRhdGEud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgZm9ybWF0OiBkYXRhLmZvcm1hdCxcbiAgICAgICAgICAgIGN1YmVtYXA6IGRhdGEuY3ViZW1hcCxcbiAgICAgICAgICAgIGxldmVsczogZGF0YS5sZXZlbHMsXG5cbiAgICAgICAgICAgIC4uLnRleHR1cmVPcHRpb25zXG4gICAgICAgIH0pO1xuICAgICAgICB0ZXh0dXJlLnVwbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQmFzaXNQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJCYXNpc1BhcnNlciIsImNvbnN0cnVjdG9yIiwicmVnaXN0cnkiLCJkZXZpY2UiLCJtYXhSZXRyaWVzIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJ0cmFuc2NvZGUiLCJkYXRhIiwiX2Fzc2V0JGZpbGUiLCJiYXNpc01vZHVsZUZvdW5kIiwiYmFzaXNUcmFuc2NvZGUiLCJpc0dHR1IiLCJmaWxlIiwidmFyaWFudHMiLCJiYXNpcyIsIm9wdCIsIm5hbWUiLCJBc3NldCIsImZldGNoQXJyYXlCdWZmZXIiLCJlcnIiLCJyZXN1bHQiLCJvcGVuIiwidGV4dHVyZU9wdGlvbnMiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsIl9leHRlbmRzIiwicHJvZmlsZXJIaW50IiwiVEVYSElOVF9BU1NFVCIsImFkZHJlc3NVIiwiY3ViZW1hcCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfUkVQRUFUIiwiYWRkcmVzc1YiLCJ3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
