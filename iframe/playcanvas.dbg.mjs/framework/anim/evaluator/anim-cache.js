import { math } from '../../../core/math/math.js';
import { INTERPOLATION_STEP, INTERPOLATION_CUBIC, INTERPOLATION_LINEAR } from '../constants.js';

/**
 * Internal cache data for the evaluation of a single curve timeline.
 *
 * @ignore
 */
class AnimCache {
  /**
   * Create a new AnimCache instance.
   */
  constructor() {
    // these members are calculated per-segment
    this._left = Infinity; // time of left knot
    this._right = -Infinity; // time of right knot
    this._len = 0; // distance between current knots
    this._recip = 0; // reciprocal len
    this._p0 = 0; // index of the left knot
    this._p1 = 0; // index of the right knot

    // these members are calculated per-time evaluation
    this._t = 0; // normalized time
    this._hermite = {
      // hermite weights, calculated on demand
      valid: false,
      p0: 0,
      m0: 0,
      p1: 0,
      m1: 0
    };
  }
  update(time, input) {
    if (time < this._left || time >= this._right) {
      // recalculate knots
      const len = input.length;
      if (!len) {
        // curve is empty
        this._left = -Infinity;
        this._right = Infinity;
        this._len = 0;
        this._recip = 0;
        this._p0 = this._p1 = 0;
      } else {
        if (time < input[0]) {
          // time falls before the first key
          this._left = -Infinity;
          this._right = input[0];
          this._len = 0;
          this._recip = 0;
          this._p0 = this._p1 = 0;
        } else if (time >= input[len - 1]) {
          // time falls after the last key
          this._left = input[len - 1];
          this._right = Infinity;
          this._len = 0;
          this._recip = 0;
          this._p0 = this._p1 = len - 1;
        } else {
          // time falls within the bounds of the curve
          const index = this._findKey(time, input);
          this._left = input[index];
          this._right = input[index + 1];
          this._len = this._right - this._left;
          const diff = 1.0 / this._len;
          this._recip = isFinite(diff) ? diff : 0;
          this._p0 = index;
          this._p1 = index + 1;
        }
      }
    }

    // calculate normalized time
    this._t = this._recip === 0 ? 0 : (time - this._left) * this._recip;
    this._hermite.valid = false;
  }
  _findKey(time, input) {
    // TODO: start the search around the currently selected knots
    let index = 0;
    while (time >= input[index + 1]) {
      index++;
    }
    return index;
  }

  // evaluate the output anim data at the current time
  eval(result, interpolation, output) {
    const data = output._data;
    const comp = output._components;
    const idx0 = this._p0 * comp;
    if (interpolation === INTERPOLATION_STEP) {
      for (let i = 0; i < comp; ++i) {
        result[i] = data[idx0 + i];
      }
    } else {
      const t = this._t;
      const idx1 = this._p1 * comp;
      switch (interpolation) {
        case INTERPOLATION_LINEAR:
          for (let i = 0; i < comp; ++i) {
            result[i] = math.lerp(data[idx0 + i], data[idx1 + i], t);
          }
          break;
        case INTERPOLATION_CUBIC:
          {
            const hermite = this._hermite;
            if (!hermite.valid) {
              // cache hermite weights
              const t2 = t * t;
              const twot = t + t;
              const omt = 1 - t;
              const omt2 = omt * omt;
              hermite.valid = true;
              hermite.p0 = (1 + twot) * omt2;
              hermite.m0 = t * omt2;
              hermite.p1 = t2 * (3 - twot);
              hermite.m1 = t2 * (t - 1);
            }
            const p0 = (this._p0 * 3 + 1) * comp; // point at k
            const m0 = (this._p0 * 3 + 2) * comp; // out-tangent at k
            const p1 = (this._p1 * 3 + 1) * comp; // point at k + 1
            const m1 = (this._p1 * 3 + 0) * comp; // in-tangent at k + 1

            for (let i = 0; i < comp; ++i) {
              result[i] = hermite.p0 * data[p0 + i] + hermite.m0 * data[m0 + i] * this._len + hermite.p1 * data[p1 + i] + hermite.m1 * data[m1 + i] * this._len;
            }
            break;
          }
      }
    }
  }
}

export { AnimCache };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jYWNoZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9hbmltL2V2YWx1YXRvci9hbmltLWNhY2hlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IElOVEVSUE9MQVRJT05fQ1VCSUMsIElOVEVSUE9MQVRJT05fTElORUFSLCBJTlRFUlBPTEFUSU9OX1NURVAgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIEludGVybmFsIGNhY2hlIGRhdGEgZm9yIHRoZSBldmFsdWF0aW9uIG9mIGEgc2luZ2xlIGN1cnZlIHRpbWVsaW5lLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbUNhY2hlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbUNhY2hlIGluc3RhbmNlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyB0aGVzZSBtZW1iZXJzIGFyZSBjYWxjdWxhdGVkIHBlci1zZWdtZW50XG4gICAgICAgIHRoaXMuX2xlZnQgPSBJbmZpbml0eTsgICAgICAvLyB0aW1lIG9mIGxlZnQga25vdFxuICAgICAgICB0aGlzLl9yaWdodCA9IC1JbmZpbml0eTsgICAgLy8gdGltZSBvZiByaWdodCBrbm90XG4gICAgICAgIHRoaXMuX2xlbiA9IDA7ICAgICAgICAgICAgICAvLyBkaXN0YW5jZSBiZXR3ZWVuIGN1cnJlbnQga25vdHNcbiAgICAgICAgdGhpcy5fcmVjaXAgPSAwOyAgICAgICAgICAgIC8vIHJlY2lwcm9jYWwgbGVuXG4gICAgICAgIHRoaXMuX3AwID0gMDsgICAgICAgICAgICAgICAvLyBpbmRleCBvZiB0aGUgbGVmdCBrbm90XG4gICAgICAgIHRoaXMuX3AxID0gMDsgICAgICAgICAgICAgICAvLyBpbmRleCBvZiB0aGUgcmlnaHQga25vdFxuXG4gICAgICAgIC8vIHRoZXNlIG1lbWJlcnMgYXJlIGNhbGN1bGF0ZWQgcGVyLXRpbWUgZXZhbHVhdGlvblxuICAgICAgICB0aGlzLl90ID0gMDsgICAgICAgICAgICAgICAgLy8gbm9ybWFsaXplZCB0aW1lXG4gICAgICAgIHRoaXMuX2hlcm1pdGUgPSB7ICAgICAgICAgICAvLyBoZXJtaXRlIHdlaWdodHMsIGNhbGN1bGF0ZWQgb24gZGVtYW5kXG4gICAgICAgICAgICB2YWxpZDogZmFsc2UsXG4gICAgICAgICAgICBwMDogMCxcbiAgICAgICAgICAgIG0wOiAwLFxuICAgICAgICAgICAgcDE6IDAsXG4gICAgICAgICAgICBtMTogMFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lLCBpbnB1dCkge1xuICAgICAgICBpZiAodGltZSA8IHRoaXMuX2xlZnQgfHwgdGltZSA+PSB0aGlzLl9yaWdodCkge1xuICAgICAgICAgICAgLy8gcmVjYWxjdWxhdGUga25vdHNcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgICAgIGlmICghbGVuKSB7XG4gICAgICAgICAgICAgICAgLy8gY3VydmUgaXMgZW1wdHlcbiAgICAgICAgICAgICAgICB0aGlzLl9sZWZ0ID0gLUluZmluaXR5O1xuICAgICAgICAgICAgICAgIHRoaXMuX3JpZ2h0ID0gSW5maW5pdHk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGVuID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWNpcCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fcDAgPSB0aGlzLl9wMSA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lIDwgaW5wdXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdGltZSBmYWxscyBiZWZvcmUgdGhlIGZpcnN0IGtleVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZWZ0ID0gLUluZmluaXR5O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yaWdodCA9IGlucHV0WzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZW4gPSAwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWNpcCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3AwID0gdGhpcy5fcDEgPSAwO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGltZSA+PSBpbnB1dFtsZW4gLSAxXSkge1xuICAgICAgICAgICAgICAgICAgICAvLyB0aW1lIGZhbGxzIGFmdGVyIHRoZSBsYXN0IGtleVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZWZ0ID0gaW5wdXRbbGVuIC0gMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JpZ2h0ID0gSW5maW5pdHk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xlbiA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlY2lwID0gMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcDAgPSB0aGlzLl9wMSA9IGxlbiAtIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdGltZSBmYWxscyB3aXRoaW4gdGhlIGJvdW5kcyBvZiB0aGUgY3VydmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9maW5kS2V5KHRpbWUsIGlucHV0KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVmdCA9IGlucHV0W2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmlnaHQgPSBpbnB1dFtpbmRleCArIDFdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZW4gPSB0aGlzLl9yaWdodCAtIHRoaXMuX2xlZnQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpZmYgPSAxLjAgLyB0aGlzLl9sZW47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlY2lwID0gKGlzRmluaXRlKGRpZmYpID8gZGlmZiA6IDApO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9wMCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9wMSA9IGluZGV4ICsgMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxjdWxhdGUgbm9ybWFsaXplZCB0aW1lXG4gICAgICAgIHRoaXMuX3QgPSAodGhpcy5fcmVjaXAgPT09IDApID8gMCA6ICgodGltZSAtIHRoaXMuX2xlZnQpICogdGhpcy5fcmVjaXApO1xuICAgICAgICB0aGlzLl9oZXJtaXRlLnZhbGlkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgX2ZpbmRLZXkodGltZSwgaW5wdXQpIHtcbiAgICAgICAgLy8gVE9ETzogc3RhcnQgdGhlIHNlYXJjaCBhcm91bmQgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBrbm90c1xuICAgICAgICBsZXQgaW5kZXggPSAwO1xuICAgICAgICB3aGlsZSAodGltZSA+PSBpbnB1dFtpbmRleCArIDFdKSB7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZSB0aGUgb3V0cHV0IGFuaW0gZGF0YSBhdCB0aGUgY3VycmVudCB0aW1lXG4gICAgZXZhbChyZXN1bHQsIGludGVycG9sYXRpb24sIG91dHB1dCkge1xuICAgICAgICBjb25zdCBkYXRhID0gb3V0cHV0Ll9kYXRhO1xuICAgICAgICBjb25zdCBjb21wID0gb3V0cHV0Ll9jb21wb25lbnRzO1xuICAgICAgICBjb25zdCBpZHgwID0gdGhpcy5fcDAgKiBjb21wO1xuXG4gICAgICAgIGlmIChpbnRlcnBvbGF0aW9uID09PSBJTlRFUlBPTEFUSU9OX1NURVApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcDsgKytpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2ldID0gZGF0YVtpZHgwICsgaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0ID0gdGhpcy5fdDtcbiAgICAgICAgICAgIGNvbnN0IGlkeDEgPSB0aGlzLl9wMSAqIGNvbXA7XG5cbiAgICAgICAgICAgIHN3aXRjaCAoaW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICAgIGNhc2UgSU5URVJQT0xBVElPTl9MSU5FQVI6XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbaV0gPSBtYXRoLmxlcnAoZGF0YVtpZHgwICsgaV0sIGRhdGFbaWR4MSArIGldLCB0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgSU5URVJQT0xBVElPTl9DVUJJQzoge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZXJtaXRlID0gdGhpcy5faGVybWl0ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWhlcm1pdGUudmFsaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhY2hlIGhlcm1pdGUgd2VpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdDIgPSB0ICogdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR3b3QgPSB0ICsgdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9tdCA9IDEgLSB0O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb210MiA9IG9tdCAqIG9tdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaGVybWl0ZS52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJtaXRlLnAwID0gKDEgKyB0d290KSAqIG9tdDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJtaXRlLm0wID0gdCAqIG9tdDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJtaXRlLnAxID0gdDIgKiAoMyAtIHR3b3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVybWl0ZS5tMSA9IHQyICogKHQgLSAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHAwID0gKHRoaXMuX3AwICogMyArIDEpICogY29tcDsgICAgIC8vIHBvaW50IGF0IGtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbTAgPSAodGhpcy5fcDAgKiAzICsgMikgKiBjb21wOyAgICAgLy8gb3V0LXRhbmdlbnQgYXQga1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwMSA9ICh0aGlzLl9wMSAqIDMgKyAxKSAqIGNvbXA7ICAgICAvLyBwb2ludCBhdCBrICsgMVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtMSA9ICh0aGlzLl9wMSAqIDMgKyAwKSAqIGNvbXA7ICAgICAvLyBpbi10YW5nZW50IGF0IGsgKyAxXG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtpXSA9IGhlcm1pdGUucDAgKiBkYXRhW3AwICsgaV0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVybWl0ZS5tMCAqIGRhdGFbbTAgKyBpXSAqIHRoaXMuX2xlbiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZXJtaXRlLnAxICogZGF0YVtwMSArIGldICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlcm1pdGUubTEgKiBkYXRhW20xICsgaV0gKiB0aGlzLl9sZW47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ2FjaGUgfTtcbiJdLCJuYW1lcyI6WyJBbmltQ2FjaGUiLCJjb25zdHJ1Y3RvciIsIl9sZWZ0IiwiSW5maW5pdHkiLCJfcmlnaHQiLCJfbGVuIiwiX3JlY2lwIiwiX3AwIiwiX3AxIiwiX3QiLCJfaGVybWl0ZSIsInZhbGlkIiwicDAiLCJtMCIsInAxIiwibTEiLCJ1cGRhdGUiLCJ0aW1lIiwiaW5wdXQiLCJsZW4iLCJsZW5ndGgiLCJpbmRleCIsIl9maW5kS2V5IiwiZGlmZiIsImlzRmluaXRlIiwiZXZhbCIsInJlc3VsdCIsImludGVycG9sYXRpb24iLCJvdXRwdXQiLCJkYXRhIiwiX2RhdGEiLCJjb21wIiwiX2NvbXBvbmVudHMiLCJpZHgwIiwiSU5URVJQT0xBVElPTl9TVEVQIiwiaSIsInQiLCJpZHgxIiwiSU5URVJQT0xBVElPTl9MSU5FQVIiLCJtYXRoIiwibGVycCIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJoZXJtaXRlIiwidDIiLCJ0d290Iiwib210Iiwib210MiJdLCJtYXBwaW5ncyI6Ijs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFNBQVMsQ0FBQztBQUNaO0FBQ0o7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxHQUFHO0FBQ1Y7QUFDQSxJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHQyxRQUFRLENBQUM7QUFDdEIsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUFDRCxRQUFRLENBQUM7QUFDeEIsSUFBQSxJQUFJLENBQUNFLElBQUksR0FBRyxDQUFDLENBQUM7QUFDZCxJQUFBLElBQUksQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNoQixJQUFBLElBQUksQ0FBQ0MsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUNiLElBQUEsSUFBSSxDQUFDQyxHQUFHLEdBQUcsQ0FBQyxDQUFDOztBQUViO0FBQ0EsSUFBQSxJQUFJLENBQUNDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDWixJQUFJ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