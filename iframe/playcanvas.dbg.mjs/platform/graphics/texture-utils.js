import { Debug } from '../../core/debug.js';
import { pixelFormatInfo, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1 } from './constants.js';

/**
 * A class providing utility functions for textures.
 *
 * @ignore
 */
class TextureUtils {
  /**
   * Calculate the dimension of a texture at a specific mip level.
   *
   * @param {number} dimension - Texture dimension at level 0.
   * @param {number} mipLevel - Mip level.
   * @returns {number} The dimension of the texture at the specified mip level.
   */
  static calcLevelDimension(dimension, mipLevel) {
    return Math.max(dimension >> mipLevel, 1);
  }

  /**
   * Calculate the number of mip levels for a texture with the specified dimensions.
   *
   * @param {number} width - Texture's width.
   * @param {number} height - Texture's height.
   * @param {number} [depth] - Texture's depth. Defaults to 1.
   * @returns {number} The number of mip levels required for the texture.
   */
  static calcMipLevelsCount(width, height, depth = 1) {
    return 1 + Math.floor(Math.log2(Math.max(width, height, depth)));
  }

  /**
   * Calculate the size in bytes of the texture level given its format and dimensions.
   *
   * @param {number} width - Texture's width.
   * @param {number} height - Texture's height.
   * @param {number} depth - Texture's depth.
   * @param {number} format - Texture's pixel format PIXELFORMAT_***.
   * @returns {number} The number of bytes of GPU memory required for the texture.
   * @ignore
   */
  static calcLevelGpuSize(width, height, depth, format) {
    var _pixelFormatInfo$get$, _pixelFormatInfo$get, _formatInfo$blockSize;
    const formatInfo = pixelFormatInfo.get(format);
    Debug.assert(formatInfo !== undefined, `Invalid pixel format ${format}`);
    const pixelSize = (_pixelFormatInfo$get$ = (_pixelFormatInfo$get = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get.size) != null ? _pixelFormatInfo$get$ : 0;
    if (pixelSize > 0) {
      return width * height * depth * pixelSize;
    }
    const blockSize = (_formatInfo$blockSize = formatInfo.blockSize) != null ? _formatInfo$blockSize : 0;
    let blockWidth = Math.floor((width + 3) / 4);
    const blockHeight = Math.floor((height + 3) / 4);
    const blockDepth = Math.floor((depth + 3) / 4);
    if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 || format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
      blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
    }
    return blockWidth * blockHeight * blockDepth * blockSize;
  }

  /**
   * Calculate the GPU memory required for a texture.
   *
   * @param {number} width - Texture's width.
   * @param {number} height - Texture's height.
   * @param {number} depth - Texture's depth.
   * @param {number} format - Texture's pixel format PIXELFORMAT_***.
   * @param {boolean} mipmaps - True if the texture includes mipmaps, false otherwise.
   * @param {boolean} cubemap - True is the texture is a cubemap, false otherwise.
   * @returns {number} The number of bytes of GPU memory required for the texture.
   * @ignore
   */
  static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
    let result = 0;
    while (1) {
      result += TextureUtils.calcLevelGpuSize(width, height, depth, format);

      // we're done if mipmaps aren't required or we've calculated the smallest mipmap level
      if (!mipmaps || width === 1 && height === 1 && depth === 1) {
        break;
      }
      width = Math.max(width >> 1, 1);
      height = Math.max(height >> 1, 1);
      depth = Math.max(depth >> 1, 1);
    }
    return result * (cubemap ? 6 : 1);
  }
}

export { TextureUtils };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS11dGlscy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUtdXRpbHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgcGl4ZWxGb3JtYXRJbmZvLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBBIGNsYXNzIHByb3ZpZGluZyB1dGlsaXR5IGZ1bmN0aW9ucyBmb3IgdGV4dHVyZXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBUZXh0dXJlVXRpbHMge1xuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZSB0aGUgZGltZW5zaW9uIG9mIGEgdGV4dHVyZSBhdCBhIHNwZWNpZmljIG1pcCBsZXZlbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkaW1lbnNpb24gLSBUZXh0dXJlIGRpbWVuc2lvbiBhdCBsZXZlbCAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaXBMZXZlbCAtIE1pcCBsZXZlbC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgZGltZW5zaW9uIG9mIHRoZSB0ZXh0dXJlIGF0IHRoZSBzcGVjaWZpZWQgbWlwIGxldmVsLlxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxjTGV2ZWxEaW1lbnNpb24oZGltZW5zaW9uLCBtaXBMZXZlbCkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoZGltZW5zaW9uID4+IG1pcExldmVsLCAxKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgdGhlIG51bWJlciBvZiBtaXAgbGV2ZWxzIGZvciBhIHRleHR1cmUgd2l0aCB0aGUgc3BlY2lmaWVkIGRpbWVuc2lvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUZXh0dXJlJ3Mgd2lkdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRleHR1cmUncyBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkZXB0aF0gLSBUZXh0dXJlJ3MgZGVwdGguIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiBtaXAgbGV2ZWxzIHJlcXVpcmVkIGZvciB0aGUgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgY2FsY01pcExldmVsc0NvdW50KHdpZHRoLCBoZWlnaHQsIGRlcHRoID0gMSkge1xuICAgICAgICByZXR1cm4gMSArIE1hdGguZmxvb3IoTWF0aC5sb2cyKE1hdGgubWF4KHdpZHRoLCBoZWlnaHQsIGRlcHRoKSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZSB0aGUgc2l6ZSBpbiBieXRlcyBvZiB0aGUgdGV4dHVyZSBsZXZlbCBnaXZlbiBpdHMgZm9ybWF0IGFuZCBkaW1lbnNpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGV4dHVyZSdzIHdpZHRoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUZXh0dXJlJ3MgaGVpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZXB0aCAtIFRleHR1cmUncyBkZXB0aC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZm9ybWF0IC0gVGV4dHVyZSdzIHBpeGVsIGZvcm1hdCBQSVhFTEZPUk1BVF8qKiouXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiBieXRlcyBvZiBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciB0aGUgdGV4dHVyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhdGljIGNhbGNMZXZlbEdwdVNpemUod2lkdGgsIGhlaWdodCwgZGVwdGgsIGZvcm1hdCkge1xuXG4gICAgICAgIGNvbnN0IGZvcm1hdEluZm8gPSBwaXhlbEZvcm1hdEluZm8uZ2V0KGZvcm1hdCk7XG4gICAgICAgIERlYnVnLmFzc2VydChmb3JtYXRJbmZvICE9PSB1bmRlZmluZWQsIGBJbnZhbGlkIHBpeGVsIGZvcm1hdCAke2Zvcm1hdH1gKTtcblxuICAgICAgICBjb25zdCBwaXhlbFNpemUgPSBwaXhlbEZvcm1hdEluZm8uZ2V0KGZvcm1hdCk/LnNpemUgPz8gMDtcbiAgICAgICAgaWYgKHBpeGVsU2l6ZSA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiB3aWR0aCAqIGhlaWdodCAqIGRlcHRoICogcGl4ZWxTaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmxvY2tTaXplID0gZm9ybWF0SW5mby5ibG9ja1NpemUgPz8gMDtcbiAgICAgICAgbGV0IGJsb2NrV2lkdGggPSBNYXRoLmZsb29yKCh3aWR0aCArIDMpIC8gNCk7XG4gICAgICAgIGNvbnN0IGJsb2NrSGVpZ2h0ID0gTWF0aC5mbG9vcigoaGVpZ2h0ICsgMykgLyA0KTtcbiAgICAgICAgY29uc3QgYmxvY2tEZXB0aCA9IE1hdGguZmxvb3IoKGRlcHRoICsgMykgLyA0KTtcblxuICAgICAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIHx8XG4gICAgICAgICAgICBmb3JtYXQgPT09IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICBibG9ja1dpZHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcihibG9ja1dpZHRoIC8gMiksIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsb2NrV2lkdGggKiBibG9ja0hlaWdodCAqIGJsb2NrRGVwdGggKiBibG9ja1NpemU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlIHRoZSBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUZXh0dXJlJ3Mgd2lkdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRleHR1cmUncyBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlcHRoIC0gVGV4dHVyZSdzIGRlcHRoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb3JtYXQgLSBUZXh0dXJlJ3MgcGl4ZWwgZm9ybWF0IFBJWEVMRk9STUFUXyoqKi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG1pcG1hcHMgLSBUcnVlIGlmIHRoZSB0ZXh0dXJlIGluY2x1ZGVzIG1pcG1hcHMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGN1YmVtYXAgLSBUcnVlIGlzIHRoZSB0ZXh0dXJlIGlzIGEgY3ViZW1hcCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgYnl0ZXMgb2YgR1BVIG1lbW9yeSByZXF1aXJlZCBmb3IgdGhlIHRleHR1cmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxjR3B1U2l6ZSh3aWR0aCwgaGVpZ2h0LCBkZXB0aCwgZm9ybWF0LCBtaXBtYXBzLCBjdWJlbWFwKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuXG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gVGV4dHVyZVV0aWxzLmNhbGNMZXZlbEdwdVNpemUod2lkdGgsIGhlaWdodCwgZGVwdGgsIGZvcm1hdCk7XG5cbiAgICAgICAgICAgIC8vIHdlJ3JlIGRvbmUgaWYgbWlwbWFwcyBhcmVuJ3QgcmVxdWlyZWQgb3Igd2UndmUgY2FsY3VsYXRlZCB0aGUgc21hbGxlc3QgbWlwbWFwIGxldmVsXG4gICAgICAgICAgICBpZiAoIW1pcG1hcHMgfHwgKCh3aWR0aCA9PT0gMSkgJiYgKGhlaWdodCA9PT0gMSkgJiYgKGRlcHRoID09PSAxKSkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpZHRoID0gTWF0aC5tYXgod2lkdGggPj4gMSwgMSk7XG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heChoZWlnaHQgPj4gMSwgMSk7XG4gICAgICAgICAgICBkZXB0aCA9IE1hdGgubWF4KGRlcHRoID4+IDEsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdCAqIChjdWJlbWFwID8gNiA6IDEpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgVGV4dHVyZVV0aWxzIH07XG4iXSwibmFtZXMiOlsiVGV4dHVyZVV0aWxzIiwiY2FsY0xldmVsRGltZW5zaW9uIiwiZGltZW5zaW9uIiwibWlwTGV2ZWwiLCJNYXRoIiwibWF4IiwiY2FsY01pcExldmVsc0NvdW50Iiwid2lkdGgiLCJoZWlnaHQiLCJkZXB0aCIsImZsb29yIiwibG9nMiIsImNhbGNMZXZlbEdwdVNpemUiLCJmb3JtYXQiLCJfcGl4ZWxGb3JtYXRJbmZvJGdldCQiLCJfcGl4ZWxGb3JtYXRJbmZvJGdldCIsIl9mb3JtYXRJbmZvJGJsb2NrU2l6ZSIsImZvcm1hdEluZm8iLCJwaXhlbEZvcm1hdEluZm8iLCJnZXQiLCJEZWJ1ZyIsImFzc2VydCIsInVuZGVmaW5lZCIsInBpeGVsU2l6ZSIsInNpemUiLCJibG9ja1NpemUiLCJibG9ja1dpZHRoIiwiYmxvY2tIZWlnaHQiLCJibG9ja0RlcHRoIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xIiwiY2FsY0dwdVNpemUiLCJtaXBtYXBzIiwiY3ViZW1hcCIsInJlc3VsdCJdLCJtYXBwaW5ncyI6Ijs7O0FBTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFlBQVksQ0FBQztBQUNmO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ksRUFBQSxPQUFPQyxrQkFBa0JBLENBQUNDLFNBQVMsRUFBRUMsUUFBUSxFQUFFO0lB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