/**
 * Math API.
 *
 * @namespace
 * @category Math
 */
const math = {
  /**
   * Conversion factor between degrees and radians.
   *
   * @type {number}
   */
  DEG_TO_RAD: Math.PI / 180,
  /**
   * Conversion factor between degrees and radians.
   *
   * @type {number}
   */
  RAD_TO_DEG: 180 / Math.PI,
  /**
   * Clamp a number between min and max inclusive.
   *
   * @param {number} value - Number to clamp.
   * @param {number} min - Min value.
   * @param {number} max - Max value.
   * @returns {number} The clamped value.
   */
  clamp(value, min, max) {
    if (value >= max) return max;
    if (value <= min) return min;
    return value;
  },
  /**
   * Convert an 24 bit integer into an array of 3 bytes.
   *
   * @param {number} i - Number holding an integer value.
   * @returns {number[]} An array of 3 bytes.
   * @example
   * // Set bytes to [0x11, 0x22, 0x33]
   * const bytes = pc.math.intToBytes24(0x112233);
   */
  intToBytes24(i) {
    const r = i >> 16 & 0xff;
    const g = i >> 8 & 0xff;
    const b = i & 0xff;
    return [r, g, b];
  },
  /**
   * Convert an 32 bit integer into an array of 4 bytes.
   *
   * @param {number} i - Number holding an integer value.
   * @returns {number[]} An array of 4 bytes.
   * @example
   * // Set bytes to [0x11, 0x22, 0x33, 0x44]
   * const bytes = pc.math.intToBytes32(0x11223344);
   */
  intToBytes32(i) {
    const r = i >> 24 & 0xff;
    const g = i >> 16 & 0xff;
    const b = i >> 8 & 0xff;
    const a = i & 0xff;
    return [r, g, b, a];
  },
  /**
   * Convert 3 8 bit Numbers into a single unsigned 24 bit Number.
   *
   * @param {number} r - A single byte (0-255).
   * @param {number} g - A single byte (0-255).
   * @param {number} b - A single byte (0-255).
   * @returns {number} A single unsigned 24 bit Number.
   * @example
   * // Set result1 to 0x112233 from an array of 3 values
   * const result1 = pc.math.bytesToInt24([0x11, 0x22, 0x33]);
   *
   * // Set result2 to 0x112233 from 3 discrete values
   * const result2 = pc.math.bytesToInt24(0x11, 0x22, 0x33);
   */
  bytesToInt24(r, g, b) {
    if (r.length) {
      b = r[2];
      g = r[1];
      r = r[0];
    }
    return r << 16 | g << 8 | b;
  },
  /**
   * Convert 4 1-byte Numbers into a single unsigned 32bit Number.
   *
   * @param {number} r - A single byte (0-255).
   * @param {number} g - A single byte (0-255).
   * @param {number} b - A single byte (0-255).
   * @param {number} a - A single byte (0-255).
   * @returns {number} A single unsigned 32bit Number.
   * @example
   * // Set result1 to 0x11223344 from an array of 4 values
   * const result1 = pc.math.bytesToInt32([0x11, 0x22, 0x33, 0x44]);
   *
   * // Set result2 to 0x11223344 from 4 discrete values
   * const result2 = pc.math.bytesToInt32(0x11, 0x22, 0x33, 0x44);
   */
  bytesToInt32(r, g, b, a) {
    if (r.length) {
      a = r[3];
      b = r[2];
      g = r[1];
      r = r[0];
    }

    // Why ((r << 24)>>>0)?
    // << operator uses signed 32 bit numbers, so 128<<24 is negative.
    // >>> used unsigned so >>>0 converts back to an unsigned.
    // See https://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
    return (r << 24 | g << 16 | b << 8 | a) >>> 0;
  },
  /**
   * Calculates the linear interpolation of two numbers.
   *
   * @param {number} a - Number to linearly interpolate from.
   * @param {number} b - Number to linearly interpolate to.
   * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
   * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
   * between a and b is returned. alpha is clamped between 0 and 1.
   * @returns {number} The linear interpolation of two numbers.
   */
  lerp(a, b, alpha) {
    return a + (b - a) * math.clamp(alpha, 0, 1);
  },
  /**
   * Calculates the linear interpolation of two angles ensuring that interpolation is correctly
   * performed across the 360 to 0 degree boundary. Angles are supplied in degrees.
   *
   * @param {number} a - Angle (in degrees) to linearly interpolate from.
   * @param {number} b - Angle (in degrees) to linearly interpolate to.
   * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
   * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
   * between a and b is returned. alpha is clamped between 0 and 1.
   * @returns {number} The linear interpolation of two angles.
   */
  lerpAngle(a, b, alpha) {
    if (b - a > 180) {
      b -= 360;
    }
    if (b - a < -180) {
      b += 360;
    }
    return math.lerp(a, b, math.clamp(alpha, 0, 1));
  },
  /**
   * Returns true if argument is a power-of-two and false otherwise.
   *
   * @param {number} x - Number to check for power-of-two property.
   * @returns {boolean} true if power-of-two and false otherwise.
   */
  powerOfTwo(x) {
    return x !== 0 && !(x & x - 1);
  },
  /**
   * Returns the next power of 2 for the specified value.
   *
   * @param {number} val - The value for which to calculate the next power of 2.
   * @returns {number} The next power of 2.
   */
  nextPowerOfTwo(val) {
    val--;
    val |= val >> 1;
    val |= val >> 2;
    val |= val >> 4;
    val |= val >> 8;
    val |= val >> 16;
    val++;
    return val;
  },
  /**
   * Returns the nearest (smaller or larger) power of 2 for the specified value.
   *
   * @param {number} val - The value for which to calculate the nearest power of 2.
   * @returns {number} The nearest power of 2.
   */
  nearestPowerOfTwo(val) {
    return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
  },
  /**
   * Return a pseudo-random number between min and max. The number generated is in the range
   * [min, max), that is inclusive of the minimum but exclusive of the maximum.
   *
   * @param {number} min - Lower bound for range.
   * @param {number} max - Upper bound for range.
   * @returns {number} Pseudo-random number between the supplied range.
   */
  random(min, max) {
    const diff = max - min;
    return Math.random() * diff + min;
  },
  /**
   * The function interpolates smoothly between two input values based on a third one that should
   * be between the first two. The returned value is clamped between 0 and 1.
   *
   * The slope (i.e. derivative) of the smoothstep function starts at 0 and ends at 0. This makes
   * it easy to create a sequence of transitions using smoothstep to interpolate each segment
   * rather than using a more sophisticated or expensive interpolation technique.
   *
   * See https://en.wikipedia.org/wiki/Smoothstep for more details.
   *
   * @param {number} min - The lower bound of the interpolation range.
   * @param {number} max - The upper bound of the interpolation range.
   * @param {number} x - The value to interpolate.
   * @returns {number} The smoothly interpolated value clamped between zero and one.
   */
  smoothstep(min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * (3 - 2 * x);
  },
  /**
   * An improved version of the {@link math.smoothstep} function which has zero 1st and 2nd order
   * derivatives at t=0 and t=1.
   *
   * See https://en.wikipedia.org/wiki/Smoothstep#Variations for more details.
   *
   * @param {number} min - The lower bound of the interpolation range.
   * @param {number} max - The upper bound of the interpolation range.
   * @param {number} x - The value to interpolate.
   * @returns {number} The smoothly interpolated value clamped between zero and one.
   */
  smootherstep(min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  /**
   * Rounds a number up to nearest multiple.
   *
   * @param {number} numToRound - The number to round up.
   * @param {number} multiple - The multiple to round up to.
   * @returns {number} A number rounded up to nearest multiple.
   */
  roundUp(numToRound, multiple) {
    if (multiple === 0) return numToRound;
    return Math.ceil(numToRound / multiple) * multiple;
  },
  /**
   * Checks whether a given number resides between two other given numbers.
   *
   * @param {number} num - The number to check the position of.
   * @param {number} a - The first upper or lower threshold to check between.
   * @param {number} b - The second upper or lower threshold to check between.
   * @param {boolean} inclusive - If true, a num param which is equal to a or b will return true.
   * @returns {boolean} true if between or false otherwise.
   * @ignore
   */
  between(num, a, b, inclusive) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return inclusive ? num >= min && num <= max : num > min && num < max;
  }
};

export { math };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9tYXRoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTWF0aCBBUEkuXG4gKlxuICogQG5hbWVzcGFjZVxuICogQGNhdGVnb3J5IE1hdGhcbiAqL1xuY29uc3QgbWF0aCA9IHtcbiAgICAvKipcbiAgICAgKiBDb252ZXJzaW9uIGZhY3RvciBiZXR3ZWVuIGRlZ3JlZXMgYW5kIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIERFR19UT19SQUQ6IE1hdGguUEkgLyAxODAsXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJzaW9uIGZhY3RvciBiZXR3ZWVuIGRlZ3JlZXMgYW5kIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIFJBRF9UT19ERUc6IDE4MCAvIE1hdGguUEksXG5cbiAgICAvKipcbiAgICAgKiBDbGFtcCBhIG51bWJlciBiZXR3ZWVuIG1pbiBhbmQgbWF4IGluY2x1c2l2ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIE51bWJlciB0byBjbGFtcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIC0gTWluIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggLSBNYXggdmFsdWUuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGNsYW1wZWQgdmFsdWUuXG4gICAgICovXG4gICAgY2xhbXAodmFsdWUsIG1pbiwgbWF4KSB7XG4gICAgICAgIGlmICh2YWx1ZSA+PSBtYXgpIHJldHVybiBtYXg7XG4gICAgICAgIGlmICh2YWx1ZSA8PSBtaW4pIHJldHVybiBtaW47XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhbiAyNCBiaXQgaW50ZWdlciBpbnRvIGFuIGFycmF5IG9mIDMgYnl0ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaSAtIE51bWJlciBob2xkaW5nIGFuIGludGVnZXIgdmFsdWUuXG4gICAgICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzIGJ5dGVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IGJ5dGVzIHRvIFsweDExLCAweDIyLCAweDMzXVxuICAgICAqIGNvbnN0IGJ5dGVzID0gcGMubWF0aC5pbnRUb0J5dGVzMjQoMHgxMTIyMzMpO1xuICAgICAqL1xuICAgIGludFRvQnl0ZXMyNChpKSB7XG4gICAgICAgIGNvbnN0IHIgPSAoaSA+PiAxNikgJiAweGZmO1xuICAgICAgICBjb25zdCBnID0gKGkgPj4gOCkgJiAweGZmO1xuICAgICAgICBjb25zdCBiID0gKGkpICYgMHhmZjtcblxuICAgICAgICByZXR1cm4gW3IsIGcsIGJdO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGFuIDMyIGJpdCBpbnRlZ2VyIGludG8gYW4gYXJyYXkgb2YgNCBieXRlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpIC0gTnVtYmVyIGhvbGRpbmcgYW4gaW50ZWdlciB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyW119IEFuIGFycmF5IG9mIDQgYnl0ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYnl0ZXMgdG8gWzB4MTEsIDB4MjIsIDB4MzMsIDB4NDRdXG4gICAgICogY29uc3QgYnl0ZXMgPSBwYy5tYXRoLmludFRvQnl0ZXMzMigweDExMjIzMzQ0KTtcbiAgICAgKi9cbiAgICBpbnRUb0J5dGVzMzIoaSkge1xuICAgICAgICBjb25zdCByID0gKGkgPj4gMjQpICYgMHhmZjtcbiAgICAgICAgY29uc3QgZyA9IChpID4+IDE2KSAmIDB4ZmY7XG4gICAgICAgIGNvbnN0IGIgPSAoaSA+PiA4KSAmIDB4ZmY7XG4gICAgICAgIGNvbnN0IGEgPSAoaSkgJiAweGZmO1xuXG4gICAgICAgIHJldHVybiBbciwgZywgYiwgYV07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgMyA4IGJpdCBOdW1iZXJzIGludG8gYSBzaW5nbGUgdW5zaWduZWQgMjQgYml0IE51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBnIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEEgc2luZ2xlIHVuc2lnbmVkIDI0IGJpdCBOdW1iZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcmVzdWx0MSB0byAweDExMjIzMyBmcm9tIGFuIGFycmF5IG9mIDMgdmFsdWVzXG4gICAgICogY29uc3QgcmVzdWx0MSA9IHBjLm1hdGguYnl0ZXNUb0ludDI0KFsweDExLCAweDIyLCAweDMzXSk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgcmVzdWx0MiB0byAweDExMjIzMyBmcm9tIDMgZGlzY3JldGUgdmFsdWVzXG4gICAgICogY29uc3QgcmVzdWx0MiA9IHBjLm1hdGguYnl0ZXNUb0ludDI0KDB4MTEsIDB4MjIsIDB4MzMpO1xuICAgICAqL1xuICAgIGJ5dGVzVG9JbnQyNChyLCBnLCBiKSB7XG4gICAgICAgIGlmIChyLmxlbmd0aCkge1xuICAgICAgICAgICAgYiA9IHJbMl07XG4gICAgICAgICAgICBnID0gclsxXTtcbiAgICAgICAgICAgIHIgPSByWzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoKHIgPDwgMTYpIHwgKGcgPDwgOCkgfCBiKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCA0IDEtYnl0ZSBOdW1iZXJzIGludG8gYSBzaW5nbGUgdW5zaWduZWQgMzJiaXQgTnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBzaW5nbGUgdW5zaWduZWQgMzJiaXQgTnVtYmVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJlc3VsdDEgdG8gMHgxMTIyMzM0NCBmcm9tIGFuIGFycmF5IG9mIDQgdmFsdWVzXG4gICAgICogY29uc3QgcmVzdWx0MSA9IHBjLm1hdGguYnl0ZXNUb0ludDMyKFsweDExLCAweDIyLCAweDMzLCAweDQ0XSk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgcmVzdWx0MiB0byAweDExMjIzMzQ0IGZyb20gNCBkaXNjcmV0ZSB2YWx1ZXNcbiAgICAgKiBjb25zdCByZXN1bHQyID0gcGMubWF0aC5ieXRlc1RvSW50MzIoMHgxMSwgMHgyMiwgMHgzMywgMHg0NCk7XG4gICAgICovXG4gICAgYnl0ZXNUb0ludDMyKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgaWYgKHIubGVuZ3RoKSB7XG4gICAgICAgICAgICBhID0gclszXTtcbiAgICAgICAgICAgIGIgPSByWzJdO1xuICAgICAgICAgICAgZyA9IHJbMV07XG4gICAgICAgICAgICByID0gclswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoeSAoKHIgPDwgMjQpPj4+MCk/XG4gICAgICAgIC8vIDw8IG9wZXJhdG9yIHVzZXMgc2lnbmVkIDMyIGJpdCBudW1iZXJzLCBzbyAxMjg8PDI0IGlzIG5lZ2F0aXZlLlxuICAgICAgICAvLyA+Pj4gdXNlZCB1bnNpZ25lZCBzbyA+Pj4wIGNvbnZlcnRzIGJhY2sgdG8gYW4gdW5zaWduZWQuXG4gICAgICAgIC8vIFNlZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xOTA4NDkyL3Vuc2lnbmVkLWludGVnZXItaW4tamF2YXNjcmlwdFxuICAgICAgICByZXR1cm4gKChyIDw8IDI0KSB8IChnIDw8IDE2KSB8IChiIDw8IDgpIHwgYSkgPj4+IDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgdGhlIGxpbmVhciBpbnRlcnBvbGF0aW9uIG9mIHR3byBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBOdW1iZXIgdG8gbGluZWFybHkgaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIE51bWJlciB0byBsaW5lYXJseSBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIHJlc3VsdCBvZiBpbnRlcnBvbGF0aW9uLiBXaGVuIGFscGhhIGlzIDAsXG4gICAgICogYSBpcyByZXR1cm5lZC4gV2hlbiBhbHBoYSBpcyAxLCBiIGlzIHJldHVybmVkLiBCZXR3ZWVuIDAgYW5kIDEsIGEgbGluZWFyIGludGVycG9sYXRpb25cbiAgICAgKiBiZXR3ZWVuIGEgYW5kIGIgaXMgcmV0dXJuZWQuIGFscGhhIGlzIGNsYW1wZWQgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBvZiB0d28gbnVtYmVycy5cbiAgICAgKi9cbiAgICBsZXJwKGEsIGIsIGFscGhhKSB7XG4gICAgICAgIHJldHVybiBhICsgKGIgLSBhKSAqIG1hdGguY2xhbXAoYWxwaGEsIDAsIDEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGVzIHRoZSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBvZiB0d28gYW5nbGVzIGVuc3VyaW5nIHRoYXQgaW50ZXJwb2xhdGlvbiBpcyBjb3JyZWN0bHlcbiAgICAgKiBwZXJmb3JtZWQgYWNyb3NzIHRoZSAzNjAgdG8gMCBkZWdyZWUgYm91bmRhcnkuIEFuZ2xlcyBhcmUgc3VwcGxpZWQgaW4gZGVncmVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gQW5nbGUgKGluIGRlZ3JlZXMpIHRvIGxpbmVhcmx5IGludGVycG9sYXRlIGZyb20uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBBbmdsZSAoaW4gZGVncmVlcykgdG8gbGluZWFybHkgaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSByZXN1bHQgb2YgaW50ZXJwb2xhdGlvbi4gV2hlbiBhbHBoYSBpcyAwLFxuICAgICAqIGEgaXMgcmV0dXJuZWQuIFdoZW4gYWxwaGEgaXMgMSwgYiBpcyByZXR1cm5lZC4gQmV0d2VlbiAwIGFuZCAxLCBhIGxpbmVhciBpbnRlcnBvbGF0aW9uXG4gICAgICogYmV0d2VlbiBhIGFuZCBiIGlzIHJldHVybmVkLiBhbHBoYSBpcyBjbGFtcGVkIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbGluZWFyIGludGVycG9sYXRpb24gb2YgdHdvIGFuZ2xlcy5cbiAgICAgKi9cbiAgICBsZXJwQW5nbGUoYSwgYiwgYWxwaGEpIHtcbiAgICAgICAgaWYgKGIgLSBhID4gMTgwKSB7XG4gICAgICAgICAgICBiIC09IDM2MDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYiAtIGEgPCAtMTgwKSB7XG4gICAgICAgICAgICBiICs9IDM2MDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0aC5sZXJwKGEsIGIsIG1hdGguY2xhbXAoYWxwaGEsIDAsIDEpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFyZ3VtZW50IGlzIGEgcG93ZXItb2YtdHdvIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIE51bWJlciB0byBjaGVjayBmb3IgcG93ZXItb2YtdHdvIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIHBvd2VyLW9mLXR3byBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHBvd2VyT2ZUd28oeCkge1xuICAgICAgICByZXR1cm4gKCh4ICE9PSAwKSAmJiAhKHggJiAoeCAtIDEpKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5leHQgcG93ZXIgb2YgMiBmb3IgdGhlIHNwZWNpZmllZCB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWwgLSBUaGUgdmFsdWUgZm9yIHdoaWNoIHRvIGNhbGN1bGF0ZSB0aGUgbmV4dCBwb3dlciBvZiAyLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBuZXh0IHBvd2VyIG9mIDIuXG4gICAgICovXG4gICAgbmV4dFBvd2VyT2ZUd28odmFsKSB7XG4gICAgICAgIHZhbC0tO1xuICAgICAgICB2YWwgfD0gKHZhbCA+PiAxKTtcbiAgICAgICAgdmFsIHw9ICh2YWwgPj4gMik7XG4gICAgICAgIHZhbCB8PSAodmFsID4+IDQpO1xuICAgICAgICB2YWwgfD0gKHZhbCA+PiA4KTtcbiAgICAgICAgdmFsIHw9ICh2YWwgPj4gMTYpO1xuICAgICAgICB2YWwrKztcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbmVhcmVzdCAoc21hbGxlciBvciBsYXJnZXIpIHBvd2VyIG9mIDIgZm9yIHRoZSBzcGVjaWZpZWQgdmFsdWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsIC0gVGhlIHZhbHVlIGZvciB3aGljaCB0byBjYWxjdWxhdGUgdGhlIG5lYXJlc3QgcG93ZXIgb2YgMi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbmVhcmVzdCBwb3dlciBvZiAyLlxuICAgICAqL1xuICAgIG5lYXJlc3RQb3dlck9mVHdvKHZhbCkge1xuICAgICAgICByZXR1cm4gTWF0aC5wb3coMiwgTWF0aC5yb3VuZChNYXRoLmxvZyh2YWwpIC8gTWF0aC5sb2coMikpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGEgcHNldWRvLXJhbmRvbSBudW1iZXIgYmV0d2VlbiBtaW4gYW5kIG1heC4gVGhlIG51bWJlciBnZW5lcmF0ZWQgaXMgaW4gdGhlIHJhbmdlXG4gICAgICogW21pbiwgbWF4KSwgdGhhdCBpcyBpbmNsdXNpdmUgb2YgdGhlIG1pbmltdW0gYnV0IGV4Y2x1c2l2ZSBvZiB0aGUgbWF4aW11bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBMb3dlciBib3VuZCBmb3IgcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFVwcGVyIGJvdW5kIGZvciByYW5nZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBQc2V1ZG8tcmFuZG9tIG51bWJlciBiZXR3ZWVuIHRoZSBzdXBwbGllZCByYW5nZS5cbiAgICAgKi9cbiAgICByYW5kb20obWluLCBtYXgpIHtcbiAgICAgICAgY29uc3QgZGlmZiA9IG1heCAtIG1pbjtcbiAgICAgICAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiBkaWZmICsgbWluO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gaW50ZXJwb2xhdGVzIHNtb290aGx5IGJldHdlZW4gdHdvIGlucHV0IHZhbHVlcyBiYXNlZCBvbiBhIHRoaXJkIG9uZSB0aGF0IHNob3VsZFxuICAgICAqIGJlIGJldHdlZW4gdGhlIGZpcnN0IHR3by4gVGhlIHJldHVybmVkIHZhbHVlIGlzIGNsYW1wZWQgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqXG4gICAgICogVGhlIHNsb3BlIChpLmUuIGRlcml2YXRpdmUpIG9mIHRoZSBzbW9vdGhzdGVwIGZ1bmN0aW9uIHN0YXJ0cyBhdCAwIGFuZCBlbmRzIGF0IDAuIFRoaXMgbWFrZXNcbiAgICAgKiBpdCBlYXN5IHRvIGNyZWF0ZSBhIHNlcXVlbmNlIG9mIHRyYW5zaXRpb25zIHVzaW5nIHNtb290aHN0ZXAgdG8gaW50ZXJwb2xhdGUgZWFjaCBzZWdtZW50XG4gICAgICogcmF0aGVyIHRoYW4gdXNpbmcgYSBtb3JlIHNvcGhpc3RpY2F0ZWQgb3IgZXhwZW5zaXZlIGludGVycG9sYXRpb24gdGVjaG5pcXVlLlxuICAgICAqXG4gICAgICogU2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1Ntb290aHN0ZXAgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBUaGUgbG93ZXIgYm91bmQgb2YgdGhlIGludGVycG9sYXRpb24gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFRoZSB1cHBlciBib3VuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbiByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBpbnRlcnBvbGF0ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgc21vb3RobHkgaW50ZXJwb2xhdGVkIHZhbHVlIGNsYW1wZWQgYmV0d2VlbiB6ZXJvIGFuZCBvbmUuXG4gICAgICovXG4gICAgc21vb3Roc3RlcChtaW4sIG1heCwgeCkge1xuICAgICAgICBpZiAoeCA8PSBtaW4pIHJldHVybiAwO1xuICAgICAgICBpZiAoeCA+PSBtYXgpIHJldHVybiAxO1xuXG4gICAgICAgIHggPSAoeCAtIG1pbikgLyAobWF4IC0gbWluKTtcblxuICAgICAgICByZXR1cm4geCAqIHggKiAoMyAtIDIgKiB4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQW4gaW1wcm92ZWQgdmVyc2lvbiBvZiB0aGUge0BsaW5rIG1hdGguc21vb3Roc3RlcH0gZnVuY3Rpb24gd2hpY2ggaGFzIHplcm8gMXN0IGFuZCAybmQgb3JkZXJcbiAgICAgKiBkZXJpdmF0aXZlcyBhdCB0PTAgYW5kIHQ9MS5cbiAgICAgKlxuICAgICAqIFNlZSBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TbW9vdGhzdGVwI1ZhcmlhdGlvbnMgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBUaGUgbG93ZXIgYm91bmQgb2YgdGhlIGludGVycG9sYXRpb24gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFRoZSB1cHBlciBib3VuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbiByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBpbnRlcnBvbGF0ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgc21vb3RobHkgaW50ZXJwb2xhdGVkIHZhbHVlIGNsYW1wZWQgYmV0d2VlbiB6ZXJvIGFuZCBvbmUuXG4gICAgICovXG4gICAgc21vb3RoZXJzdGVwKG1pbiwgbWF4LCB4KSB7XG4gICAgICAgIGlmICh4IDw9IG1pbikgcmV0dXJuIDA7XG4gICAgICAgIGlmICh4ID49IG1heCkgcmV0dXJuIDE7XG5cbiAgICAgICAgeCA9ICh4IC0gbWluKSAvIChtYXggLSBtaW4pO1xuXG4gICAgICAgIHJldHVybiB4ICogeCAqIHggKiAoeCAqICh4ICogNiAtIDE1KSArIDEwKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUm91bmRzIGEgbnVtYmVyIHVwIHRvIG5lYXJlc3QgbXVsdGlwbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtVG9Sb3VuZCAtIFRoZSBudW1iZXIgdG8gcm91bmQgdXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG11bHRpcGxlIC0gVGhlIG11bHRpcGxlIHRvIHJvdW5kIHVwIHRvLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEEgbnVtYmVyIHJvdW5kZWQgdXAgdG8gbmVhcmVzdCBtdWx0aXBsZS5cbiAgICAgKi9cbiAgICByb3VuZFVwKG51bVRvUm91bmQsIG11bHRpcGxlKSB7XG4gICAgICAgIGlmIChtdWx0aXBsZSA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBudW1Ub1JvdW5kO1xuICAgICAgICByZXR1cm4gTWF0aC5jZWlsKG51bVRvUm91bmQgLyBtdWx0aXBsZSkgKiBtdWx0aXBsZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBudW1iZXIgcmVzaWRlcyBiZXR3ZWVuIHR3byBvdGhlciBnaXZlbiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bSAtIFRoZSBudW1iZXIgdG8gY2hlY2sgdGhlIHBvc2l0aW9uIG9mLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gVGhlIGZpcnN0IHVwcGVyIG9yIGxvd2VyIHRocmVzaG9sZCB0byBjaGVjayBiZXR3ZWVuLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIHNlY29uZCB1cHBlciBvciBsb3dlciB0aHJlc2hvbGQgdG8gY2hlY2sgYmV0d2Vlbi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGluY2x1c2l2ZSAtIElmIHRydWUsIGEgbnVtIHBhcmFtIHdoaWNoIGlzIGVxdWFsIHRvIGEgb3IgYiB3aWxsIHJldHVybiB0cnVlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIGJldHdlZW4gb3IgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiZXR3ZWVuKG51bSwgYSwgYiwgaW5jbHVzaXZlKSB7XG4gICAgICAgIGNvbnN0IG1pbiA9IE1hdGgubWluKGEsIGIpO1xuICAgICAgICBjb25zdCBtYXggPSBNYXRoLm1heChhLCBiKTtcbiAgICAgICAgcmV0dXJuIGluY2x1c2l2ZSA/IG51bSA+PSBtaW4gJiYgbnVtIDw9IG1heCA6IG51bSA+IG1pbiAmJiBudW0gPCBtYXg7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgbWF0aCB9O1xuIl0sIm5hbWVzIjpbIm1hdGgiLCJERUdfVE9fUkFEIiwiTWF0aCIsIlBJIiwiUkFEX1RPX0RFRyIsImNsYW1wIiwidmFsdWUiLCJtaW4iLCJtYXgiLCJpbnRUb0J5dGVzMjQiLCJpIiwiciIsImciLCJiIiwiaW50VG9CeXRlczMyIiwiYSIsImJ5dGVzVG9JbnQyNCIsImxlbmd0aCIsImJ5dGVzVG9JbnQzMiIsImxlcnAiLCJhbHBoYSIsImxlcnBBbmdsZSIsInBvd2VyT2ZUd28iLCJ4IiwibmV4dFBvd2VyT2ZUd28iLCJ2YWwiLCJuZWFyZXN0UG93ZXJPZlR3byIsInBvdyIsInJvdW5kIiwibG9nIiwicmFuZG9tIiwiZGlmZiIsInNtb290aHN0ZXAiLCJzbW9vdGhlcnN0ZXAiLCJyb3VuZFVwIiwibnVtVG9Sb3VuZCIsIm11bHRpcGxlIiwiY2VpbCIsImJldHdlZW4iLCJudW0iLCJpbmNsdXNpdmUiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLElBQUksR0FBRztBQUNUO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsVUFBVSxFQUFFQyxJQUFJLENBQUNDLEVBQUUsR0FBRyxHQUFHO0FBRXpCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsVUFBVSxFQUFFLEdBQUcsR0FBR0YsSUFBSSxDQUFDQyxFQUFFO0FBRXpCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsS0FBS0EsQ0FBQ0MsS0FBSyxFQUFFQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtBQUNuQixJQUFBLElBQUlGLEtBQUssSUFBSUUsR0FBRyxFQUFFLE9BQU9BLEdBQUcsQ0FBQTtBQUM1QixJQUFBLElBQUlGLEtBQUssSUFBSUMsR0FBRyxFQUFFLE9BQU9BLEdBQUcsQ0FBQTtBQUM1QixJQUFBLE9BQU9ELEtBQUssQ0FBQTtHQUNmO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
