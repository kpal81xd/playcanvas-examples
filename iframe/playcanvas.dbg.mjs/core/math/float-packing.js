import { math } from './math.js';

let checkRange = 5;
const oneDiv255 = 1 / 255;
const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);

/**
 * Utility static class providing functionality to pack float values to various storage
 * representations.
 *
 * @category Math
 */
class FloatPacking {
  /**
   * Packs a float to a 16-bit half-float representation used by the GPU.
   *
   * @param {number} value - The float value to pack.
   * @returns {number} The packed value.
   */
  static float2Half(value) {
    // based on https://esdiscuss.org/topic/float16array
    // This method is faster than the OpenEXR implementation (very often
    // used, eg. in Ogre), with the additional benefit of rounding, inspired
    // by James Tursa?s half-precision code.
    floatView[0] = value;
    const x = int32View[0];
    let bits = x >> 16 & 0x8000; // Get the sign
    let m = x >> 12 & 0x07ff; // Keep one extra bit for rounding
    const e = x >> 23 & 0xff; // Using int is faster here

    // If zero, or denormal, or exponent underflows too much for a denormal half, return signed zero.
    if (e < 103) {
      return bits;
    }

    // If NaN, return NaN. If Inf or exponent overflow, return Inf.
    if (e > 142) {
      bits |= 0x7c00;

      // If exponent was 0xff and one mantissa bit was set, it means NaN,
      // not Inf, so make sure we set one mantissa bit too.
      bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
      return bits;
    }

    // If exponent underflows but not too much, return a denormal
    if (e < 113) {
      m |= 0x0800;

      // Extra rounding may overflow and set mantissa to 0 and exponent to 1, which is OK.
      bits |= (m >> 114 - e) + (m >> 113 - e & 1);
      return bits;
    }
    bits |= e - 112 << 10 | m >> 1;

    // Extra rounding. An overflow will set mantissa to 0 and increment the exponent, which is OK.
    bits += m & 1;
    return bits;
  }

  /**
   * Packs a float value in [0..1) range to specified number of bytes and stores them in an array
   * with start offset. Based on: https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
   * Note: calls to Math.round are only needed on iOS. Precision is somehow really bad without
   * it. Looks like an issue with their implementation of Uint8ClampedArray.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} numBytes - The number of bytes to pack the value to.
   *
   * @ignore
   */
  static float2Bytes(value, array, offset, numBytes) {
    const enc1 = 255.0 * value % 1;
    array[offset + 0] = Math.round((value % 1 - oneDiv255 * enc1) * 255);
    if (numBytes > 1) {
      const enc2 = 65025.0 * value % 1;
      array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
      if (numBytes > 2) {
        const enc3 = 16581375.0 * value % 1;
        array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);
        if (numBytes > 3) {
          array[offset + 3] = Math.round(enc3 * 255);
        }
      }
    }
  }

  /**
   * Packs a float into specified number of bytes. Min and max range for the float is specified,
   * allowing the float to be normalized to 0..1 range.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} min - Range minimum.
   * @param {number} max - Range maximum.
   * @param {number} numBytes - The number of bytes to pack the value to.
   *
   * @ignore
   */
  static float2BytesRange(value, array, offset, min, max, numBytes) {
    if (value < min || value > max) {
      if (checkRange) {
        checkRange--;
        console.warn('float2BytesRange - value to pack is out of specified range.');
      }
    }
    value = math.clamp((value - min) / (max - min), 0, 1);
    FloatPacking.float2Bytes(value, array, offset, numBytes);
  }

  /**
   * Packs a float into specified number of bytes, using 1 byte for exponent and the remaining
   * bytes for the mantissa.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} numBytes - The number of bytes to pack the value to.
   *
   * @ignore
   */
  static float2MantissaExponent(value, array, offset, numBytes) {
    // exponent is increased by one, so that 2^exponent is larger than the value
    const exponent = Math.floor(Math.log2(Math.abs(value))) + 1;
    value /= Math.pow(2, exponent);

    // value is now in -1..1 range, store it using specified number of bytes less one
    FloatPacking.float2BytesRange(value, array, offset, -1, 1, numBytes - 1);

    // last byte for the exponent (positive or negative)
    array[offset + numBytes - 1] = Math.round(exponent + 127);
  }
}

export { FloatPacking };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXQtcGFja2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9mbG9hdC1wYWNraW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuXG5sZXQgY2hlY2tSYW5nZSA9IDU7XG5jb25zdCBvbmVEaXYyNTUgPSAxIC8gMjU1O1xuY29uc3QgZmxvYXRWaWV3ID0gbmV3IEZsb2F0MzJBcnJheSgxKTtcbmNvbnN0IGludDMyVmlldyA9IG5ldyBJbnQzMkFycmF5KGZsb2F0Vmlldy5idWZmZXIpO1xuXG4vKipcbiAqIFV0aWxpdHkgc3RhdGljIGNsYXNzIHByb3ZpZGluZyBmdW5jdGlvbmFsaXR5IHRvIHBhY2sgZmxvYXQgdmFsdWVzIHRvIHZhcmlvdXMgc3RvcmFnZVxuICogcmVwcmVzZW50YXRpb25zLlxuICpcbiAqIEBjYXRlZ29yeSBNYXRoXG4gKi9cbmNsYXNzIEZsb2F0UGFja2luZyB7XG4gICAgLyoqXG4gICAgICogUGFja3MgYSBmbG9hdCB0byBhIDE2LWJpdCBoYWxmLWZsb2F0IHJlcHJlc2VudGF0aW9uIHVzZWQgYnkgdGhlIEdQVS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBmbG9hdCB2YWx1ZSB0byBwYWNrLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBwYWNrZWQgdmFsdWUuXG4gICAgICovXG4gICAgc3RhdGljIGZsb2F0MkhhbGYodmFsdWUpIHtcbiAgICAgICAgLy8gYmFzZWQgb24gaHR0cHM6Ly9lc2Rpc2N1c3Mub3JnL3RvcGljL2Zsb2F0MTZhcnJheVxuICAgICAgICAvLyBUaGlzIG1ldGhvZCBpcyBmYXN0ZXIgdGhhbiB0aGUgT3BlbkVYUiBpbXBsZW1lbnRhdGlvbiAodmVyeSBvZnRlblxuICAgICAgICAvLyB1c2VkLCBlZy4gaW4gT2dyZSksIHdpdGggdGhlIGFkZGl0aW9uYWwgYmVuZWZpdCBvZiByb3VuZGluZywgaW5zcGlyZWRcbiAgICAgICAgLy8gYnkgSmFtZXMgVHVyc2E/cyBoYWxmLXByZWNpc2lvbiBjb2RlLlxuICAgICAgICBmbG9hdFZpZXdbMF0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgeCA9IGludDMyVmlld1swXTtcblxuICAgICAgICBsZXQgYml0cyA9ICh4ID4+IDE2KSAmIDB4ODAwMDsgLy8gR2V0IHRoZSBzaWduXG4gICAgICAgIGxldCBtID0gKHggPj4gMTIpICYgMHgwN2ZmOyAvLyBLZWVwIG9uZSBleHRyYSBiaXQgZm9yIHJvdW5kaW5nXG4gICAgICAgIGNvbnN0IGUgPSAoeCA+PiAyMykgJiAweGZmOyAvLyBVc2luZyBpbnQgaXMgZmFzdGVyIGhlcmVcblxuICAgICAgICAvLyBJZiB6ZXJvLCBvciBkZW5vcm1hbCwgb3IgZXhwb25lbnQgdW5kZXJmbG93cyB0b28gbXVjaCBmb3IgYSBkZW5vcm1hbCBoYWxmLCByZXR1cm4gc2lnbmVkIHplcm8uXG4gICAgICAgIGlmIChlIDwgMTAzKSB7XG4gICAgICAgICAgICByZXR1cm4gYml0cztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIE5hTiwgcmV0dXJuIE5hTi4gSWYgSW5mIG9yIGV4cG9uZW50IG92ZXJmbG93LCByZXR1cm4gSW5mLlxuICAgICAgICBpZiAoZSA+IDE0Mikge1xuICAgICAgICAgICAgYml0cyB8PSAweDdjMDA7XG5cbiAgICAgICAgICAgIC8vIElmIGV4cG9uZW50IHdhcyAweGZmIGFuZCBvbmUgbWFudGlzc2EgYml0IHdhcyBzZXQsIGl0IG1lYW5zIE5hTixcbiAgICAgICAgICAgIC8vIG5vdCBJbmYsIHNvIG1ha2Ugc3VyZSB3ZSBzZXQgb25lIG1hbnRpc3NhIGJpdCB0b28uXG4gICAgICAgICAgICBiaXRzIHw9ICgoZSA9PT0gMjU1KSA/IDAgOiAxKSAmJiAoeCAmIDB4MDA3ZmZmZmYpO1xuICAgICAgICAgICAgcmV0dXJuIGJpdHM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBleHBvbmVudCB1bmRlcmZsb3dzIGJ1dCBub3QgdG9vIG11Y2gsIHJldHVybiBhIGRlbm9ybWFsXG4gICAgICAgIGlmIChlIDwgMTEzKSB7XG4gICAgICAgICAgICBtIHw9IDB4MDgwMDtcblxuICAgICAgICAgICAgLy8gRXh0cmEgcm91bmRpbmcgbWF5IG92ZXJmbG93IGFuZCBzZXQgbWFudGlzc2EgdG8gMCBhbmQgZXhwb25lbnQgdG8gMSwgd2hpY2ggaXMgT0suXG4gICAgICAgICAgICBiaXRzIHw9IChtID4+ICgxMTQgLSBlKSkgKyAoKG0gPj4gKDExMyAtIGUpKSAmIDEpO1xuICAgICAgICAgICAgcmV0dXJuIGJpdHM7XG4gICAgICAgIH1cblxuICAgICAgICBiaXRzIHw9ICgoZSAtIDExMikgPDwgMTApIHwgKG0gPj4gMSk7XG5cbiAgICAgICAgLy8gRXh0cmEgcm91bmRpbmcuIEFuIG92ZXJmbG93IHdpbGwgc2V0IG1hbnRpc3NhIHRvIDAgYW5kIGluY3JlbWVudCB0aGUgZXhwb25lbnQsIHdoaWNoIGlzIE9LLlxuICAgICAgICBiaXRzICs9IG0gJiAxO1xuICAgICAgICByZXR1cm4gYml0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYWNrcyBhIGZsb2F0IHZhbHVlIGluIFswLi4xKSByYW5nZSB0byBzcGVjaWZpZWQgbnVtYmVyIG9mIGJ5dGVzIGFuZCBzdG9yZXMgdGhlbSBpbiBhbiBhcnJheVxuICAgICAqIHdpdGggc3RhcnQgb2Zmc2V0LiBCYXNlZCBvbjogaHR0cHM6Ly9hcmFzLXAuaW5mby9ibG9nLzIwMDkvMDcvMzAvZW5jb2RpbmctZmxvYXRzLXRvLXJnYmEtdGhlLWZpbmFsL1xuICAgICAqIE5vdGU6IGNhbGxzIHRvIE1hdGgucm91bmQgYXJlIG9ubHkgbmVlZGVkIG9uIGlPUy4gUHJlY2lzaW9uIGlzIHNvbWVob3cgcmVhbGx5IGJhZCB3aXRob3V0XG4gICAgICogaXQuIExvb2tzIGxpa2UgYW4gaXNzdWUgd2l0aCB0aGVpciBpbXBsZW1lbnRhdGlvbiBvZiBVaW50OENsYW1wZWRBcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBmbG9hdCB2YWx1ZSB0byBwYWNrLlxuICAgICAqIEBwYXJhbSB7VWludDhDbGFtcGVkQXJyYXl9IGFycmF5IC0gVGhlIGFycmF5IHRvIHN0b3JlIHRoZSBwYWNrZWQgdmFsdWUgaW4uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9mZnNldCAtIFRoZSBzdGFydCBvZmZzZXQgaW4gdGhlIGFycmF5IHRvIHN0b3JlIHRoZSBwYWNrZWQgdmFsdWUgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bUJ5dGVzIC0gVGhlIG51bWJlciBvZiBieXRlcyB0byBwYWNrIHRoZSB2YWx1ZSB0by5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGF0aWMgZmxvYXQyQnl0ZXModmFsdWUsIGFycmF5LCBvZmZzZXQsIG51bUJ5dGVzKSB7XG4gICAgICAgIGNvbnN0IGVuYzEgPSAoMjU1LjAgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IE1hdGgucm91bmQoKCh2YWx1ZSAlIDEpIC0gb25lRGl2MjU1ICogZW5jMSkgKiAyNTUpO1xuXG4gICAgICAgIGlmIChudW1CeXRlcyA+IDEpIHtcbiAgICAgICAgICAgIGNvbnN0IGVuYzIgPSAoNjUwMjUuMCAqIHZhbHVlKSAlIDE7XG4gICAgICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IE1hdGgucm91bmQoKGVuYzEgLSBvbmVEaXYyNTUgKiBlbmMyKSAqIDI1NSk7XG5cbiAgICAgICAgICAgIGlmIChudW1CeXRlcyA+IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmMzID0gKDE2NTgxMzc1LjAgKiB2YWx1ZSkgJSAxO1xuICAgICAgICAgICAgICAgIGFycmF5W29mZnNldCArIDJdID0gTWF0aC5yb3VuZCgoZW5jMiAtIG9uZURpdjI1NSAqIGVuYzMpICogMjU1KTtcblxuICAgICAgICAgICAgICAgIGlmIChudW1CeXRlcyA+IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSBNYXRoLnJvdW5kKGVuYzMgKiAyNTUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhY2tzIGEgZmxvYXQgaW50byBzcGVjaWZpZWQgbnVtYmVyIG9mIGJ5dGVzLiBNaW4gYW5kIG1heCByYW5nZSBmb3IgdGhlIGZsb2F0IGlzIHNwZWNpZmllZCxcbiAgICAgKiBhbGxvd2luZyB0aGUgZmxvYXQgdG8gYmUgbm9ybWFsaXplZCB0byAwLi4xIHJhbmdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIGZsb2F0IHZhbHVlIHRvIHBhY2suXG4gICAgICogQHBhcmFtIHtVaW50OENsYW1wZWRBcnJheX0gYXJyYXkgLSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBpbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gVGhlIHN0YXJ0IG9mZnNldCBpbiB0aGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIC0gUmFuZ2UgbWluaW11bS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IC0gUmFuZ2UgbWF4aW11bS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtQnl0ZXMgLSBUaGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHBhY2sgdGhlIHZhbHVlIHRvLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBmbG9hdDJCeXRlc1JhbmdlKHZhbHVlLCBhcnJheSwgb2Zmc2V0LCBtaW4sIG1heCwgbnVtQnl0ZXMpIHtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmFsdWUgPCBtaW4gfHwgdmFsdWUgPiBtYXgpIHtcbiAgICAgICAgICAgIGlmIChjaGVja1JhbmdlKSB7XG4gICAgICAgICAgICAgICAgY2hlY2tSYW5nZS0tO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignZmxvYXQyQnl0ZXNSYW5nZSAtIHZhbHVlIHRvIHBhY2sgaXMgb3V0IG9mIHNwZWNpZmllZCByYW5nZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB2YWx1ZSA9IG1hdGguY2xhbXAoKHZhbHVlIC0gbWluKSAvIChtYXggLSBtaW4pLCAwLCAxKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKHZhbHVlLCBhcnJheSwgb2Zmc2V0LCBudW1CeXRlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGFja3MgYSBmbG9hdCBpbnRvIHNwZWNpZmllZCBudW1iZXIgb2YgYnl0ZXMsIHVzaW5nIDEgYnl0ZSBmb3IgZXhwb25lbnQgYW5kIHRoZSByZW1haW5pbmdcbiAgICAgKiBieXRlcyBmb3IgdGhlIG1hbnRpc3NhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIGZsb2F0IHZhbHVlIHRvIHBhY2suXG4gICAgICogQHBhcmFtIHtVaW50OENsYW1wZWRBcnJheX0gYXJyYXkgLSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBpbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gVGhlIHN0YXJ0IG9mZnNldCBpbiB0aGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtQnl0ZXMgLSBUaGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHBhY2sgdGhlIHZhbHVlIHRvLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBmbG9hdDJNYW50aXNzYUV4cG9uZW50KHZhbHVlLCBhcnJheSwgb2Zmc2V0LCBudW1CeXRlcykge1xuICAgICAgICAvLyBleHBvbmVudCBpcyBpbmNyZWFzZWQgYnkgb25lLCBzbyB0aGF0IDJeZXhwb25lbnQgaXMgbGFyZ2VyIHRoYW4gdGhlIHZhbHVlXG4gICAgICAgIGNvbnN0IGV4cG9uZW50ID0gTWF0aC5mbG9vcihNYXRoLmxvZzIoTWF0aC5hYnModmFsdWUpKSkgKyAxO1xuICAgICAgICB2YWx1ZSAvPSBNYXRoLnBvdygyLCBleHBvbmVudCk7XG5cbiAgICAgICAgLy8gdmFsdWUgaXMgbm93IGluIC0xLi4xIHJhbmdlLCBzdG9yZSBpdCB1c2luZyBzcGVjaWZpZWQgbnVtYmVyIG9mIGJ5dGVzIGxlc3Mgb25lXG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlc1JhbmdlKHZhbHVlLCBhcnJheSwgb2Zmc2V0LCAtMSwgMSwgbnVtQnl0ZXMgLSAxKTtcblxuICAgICAgICAvLyBsYXN0IGJ5dGUgZm9yIHRoZSBleHBvbmVudCAocG9zaXRpdmUgb3IgbmVnYXRpdmUpXG4gICAgICAgIGFycmF5W29mZnNldCArIG51bUJ5dGVzIC0gMV0gPSBNYXRoLnJvdW5kKGV4cG9uZW50ICsgMTI3KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEZsb2F0UGFja2luZyB9O1xuIl0sIm5hbWVzIjpbImNoZWNrUmFuZ2UiLCJvbmVEaXYyNTUiLCJmbG9hdFZpZXciLCJGbG9hdDMyQXJyYXkiLCJpbnQzMlZpZXciLCJJbnQzMkFycmF5IiwiYnVmZmVyIiwiRmxvYXRQYWNraW5nIiwiZmxvYXQySGFsZiIsInZhbHVlIiwieCIsImJpdHMiLCJtIiwiZSIsImZsb2F0MkJ5dGVzIiwiYXJyYXkiLCJvZmZzZXQiLCJudW1CeXRlcyIsImVuYzEiLCJNYXRoIiwicm91bmQiLCJlbmMyIiwiZW5jMyIsImZsb2F0MkJ5dGVzUmFuZ2UiLCJtaW4iLCJtYXgiLCJjb25zb2xlIiwid2FybiIsIm1hdGgiLCJjbGFtcCIsImZsb2F0Mk1hbnRpc3NhRXhwb25lbnQiLCJleHBvbmVudCIsImZsb29yIiwibG9nMiIsImFicyIsInBvdyJdLCJtYXBwaW5ncyI6Ijs7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
