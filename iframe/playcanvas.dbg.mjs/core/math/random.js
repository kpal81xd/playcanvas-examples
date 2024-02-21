import { math } from './math.js';

// golden angle in radians: PI * (3 - sqrt(5))
const _goldenAngle = 2.399963229728653;

/**
 * Random API.
 *
 * @namespace
 * @ignore
 */
const random = {
  /**
   * Return a pseudo-random 2D point inside a unit circle with uniform distribution.
   *
   * @param {import('./vec2.js').Vec2} point - The returned generated point.
   * @ignore
   */
  circlePoint(point) {
    const r = Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    point.x = r * Math.cos(theta);
    point.y = r * Math.sin(theta);
  },
  /**
   * Generates evenly distributed deterministic points inside a unit circle using Fermat's spiral
   * and Vogel's method.
   *
   * @param {import('./vec2.js').Vec2} point - The returned generated point.
   * @param {number} index - Index of the point to generate, in the range from 0 to numPoints - 1.
   * @param {number} numPoints - The total number of points of the set.
   * @ignore
   */
  circlePointDeterministic(point, index, numPoints) {
    const theta = index * _goldenAngle;
    const r = Math.sqrt(index) / Math.sqrt(numPoints);
    point.x = r * Math.cos(theta);
    point.y = r * Math.sin(theta);
  },
  /**
   * Generates evenly distributed deterministic points on a unit sphere using Fibonacci sphere
   * algorithm. It also allows the points to cover only part of the sphere by specifying start
   * and end parameters, representing value from 0 (top of the sphere) and 1 (bottom of the
   * sphere). For example by specifying 0.4 and 0.6 and start and end, a band around the equator
   * would be generated.
   *
   * @param {import('./vec3.js').Vec3} point - The returned generated point.
   * @param {number} index - Index of the point to generate, in the range from 0 to numPoints - 1.
   * @param {number} numPoints - The total number of points of the set.
   * @param {number} [start] - Part on the sphere along y axis to start the points, in the range
   * of 0 and 1. Defaults to 0.
   * @param {number} [end] - Part on the sphere along y axis to stop the points, in the range of
   * 0 and 1. Defaults to 1.
   * @ignore
   */
  spherePointDeterministic(point, index, numPoints, start = 0, end = 1) {
    // y coordinate needs to go from -1 (top) to 1 (bottom) for the full sphere
    // evaluate its value for this point and specified start and end
    start = 1 - 2 * start;
    end = 1 - 2 * end;
    const y = math.lerp(start, end, index / numPoints);

    // radius at y
    const radius = Math.sqrt(1 - y * y);

    // golden angle increment
    const theta = _goldenAngle * index;
    point.x = Math.cos(theta) * radius;
    point.y = y;
    point.z = Math.sin(theta) * radius;
  },
  /**
   * Generate a repeatable pseudo-random sequence using radical inverse. Based on
   * http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
   *
   * @param {number} i - The index in the sequence to return.
   * @returns {number} The pseudo-random value.
   * @ignore
   */
  radicalInverse(i) {
    let bits = (i << 16 | i >>> 16) >>> 0;
    bits = ((bits & 0x55555555) << 1 | (bits & 0xAAAAAAAA) >>> 1) >>> 0;
    bits = ((bits & 0x33333333) << 2 | (bits & 0xCCCCCCCC) >>> 2) >>> 0;
    bits = ((bits & 0x0F0F0F0F) << 4 | (bits & 0xF0F0F0F0) >>> 4) >>> 0;
    bits = ((bits & 0x00FF00FF) << 8 | (bits & 0xFF00FF00) >>> 8) >>> 0;
    return bits * 2.3283064365386963e-10;
  }
};

export { random };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvY29yZS9tYXRoL3JhbmRvbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi9tYXRoLmpzJztcblxuLy8gZ29sZGVuIGFuZ2xlIGluIHJhZGlhbnM6IFBJICogKDMgLSBzcXJ0KDUpKVxuY29uc3QgX2dvbGRlbkFuZ2xlID0gMi4zOTk5NjMyMjk3Mjg2NTM7XG5cbi8qKlxuICogUmFuZG9tIEFQSS5cbiAqXG4gKiBAbmFtZXNwYWNlXG4gKiBAaWdub3JlXG4gKi9cbmNvbnN0IHJhbmRvbSA9IHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBwc2V1ZG8tcmFuZG9tIDJEIHBvaW50IGluc2lkZSBhIHVuaXQgY2lyY2xlIHdpdGggdW5pZm9ybSBkaXN0cmlidXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZWMyLmpzJykuVmVjMn0gcG9pbnQgLSBUaGUgcmV0dXJuZWQgZ2VuZXJhdGVkIHBvaW50LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjaXJjbGVQb2ludChwb2ludCkge1xuICAgICAgICBjb25zdCByID0gTWF0aC5zcXJ0KE1hdGgucmFuZG9tKCkpO1xuICAgICAgICBjb25zdCB0aGV0YSA9IE1hdGgucmFuZG9tKCkgKiAyICogTWF0aC5QSTtcbiAgICAgICAgcG9pbnQueCA9IHIgKiBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgIHBvaW50LnkgPSByICogTWF0aC5zaW4odGhldGEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgZXZlbmx5IGRpc3RyaWJ1dGVkIGRldGVybWluaXN0aWMgcG9pbnRzIGluc2lkZSBhIHVuaXQgY2lyY2xlIHVzaW5nIEZlcm1hdCdzIHNwaXJhbFxuICAgICAqIGFuZCBWb2dlbCdzIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3ZlYzIuanMnKS5WZWMyfSBwb2ludCAtIFRoZSByZXR1cm5lZCBnZW5lcmF0ZWQgcG9pbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5kZXggb2YgdGhlIHBvaW50IHRvIGdlbmVyYXRlLCBpbiB0aGUgcmFuZ2UgZnJvbSAwIHRvIG51bVBvaW50cyAtIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bVBvaW50cyAtIFRoZSB0b3RhbCBudW1iZXIgb2YgcG9pbnRzIG9mIHRoZSBzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNpcmNsZVBvaW50RGV0ZXJtaW5pc3RpYyhwb2ludCwgaW5kZXgsIG51bVBvaW50cykge1xuICAgICAgICBjb25zdCB0aGV0YSA9IGluZGV4ICogX2dvbGRlbkFuZ2xlO1xuICAgICAgICBjb25zdCByID0gTWF0aC5zcXJ0KGluZGV4KSAvIE1hdGguc3FydChudW1Qb2ludHMpO1xuXG4gICAgICAgIHBvaW50LnggPSByICogTWF0aC5jb3ModGhldGEpO1xuICAgICAgICBwb2ludC55ID0gciAqIE1hdGguc2luKHRoZXRhKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGV2ZW5seSBkaXN0cmlidXRlZCBkZXRlcm1pbmlzdGljIHBvaW50cyBvbiBhIHVuaXQgc3BoZXJlIHVzaW5nIEZpYm9uYWNjaSBzcGhlcmVcbiAgICAgKiBhbGdvcml0aG0uIEl0IGFsc28gYWxsb3dzIHRoZSBwb2ludHMgdG8gY292ZXIgb25seSBwYXJ0IG9mIHRoZSBzcGhlcmUgYnkgc3BlY2lmeWluZyBzdGFydFxuICAgICAqIGFuZCBlbmQgcGFyYW1ldGVycywgcmVwcmVzZW50aW5nIHZhbHVlIGZyb20gMCAodG9wIG9mIHRoZSBzcGhlcmUpIGFuZCAxIChib3R0b20gb2YgdGhlXG4gICAgICogc3BoZXJlKS4gRm9yIGV4YW1wbGUgYnkgc3BlY2lmeWluZyAwLjQgYW5kIDAuNiBhbmQgc3RhcnQgYW5kIGVuZCwgYSBiYW5kIGFyb3VuZCB0aGUgZXF1YXRvclxuICAgICAqIHdvdWxkIGJlIGdlbmVyYXRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3ZlYzMuanMnKS5WZWMzfSBwb2ludCAtIFRoZSByZXR1cm5lZCBnZW5lcmF0ZWQgcG9pbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5kZXggb2YgdGhlIHBvaW50IHRvIGdlbmVyYXRlLCBpbiB0aGUgcmFuZ2UgZnJvbSAwIHRvIG51bVBvaW50cyAtIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bVBvaW50cyAtIFRoZSB0b3RhbCBudW1iZXIgb2YgcG9pbnRzIG9mIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydF0gLSBQYXJ0IG9uIHRoZSBzcGhlcmUgYWxvbmcgeSBheGlzIHRvIHN0YXJ0IHRoZSBwb2ludHMsIGluIHRoZSByYW5nZVxuICAgICAqIG9mIDAgYW5kIDEuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlbmRdIC0gUGFydCBvbiB0aGUgc3BoZXJlIGFsb25nIHkgYXhpcyB0byBzdG9wIHRoZSBwb2ludHMsIGluIHRoZSByYW5nZSBvZlxuICAgICAqIDAgYW5kIDEuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNwaGVyZVBvaW50RGV0ZXJtaW5pc3RpYyhwb2ludCwgaW5kZXgsIG51bVBvaW50cywgc3RhcnQgPSAwLCBlbmQgPSAxKSB7XG5cbiAgICAgICAgLy8geSBjb29yZGluYXRlIG5lZWRzIHRvIGdvIGZyb20gLTEgKHRvcCkgdG8gMSAoYm90dG9tKSBmb3IgdGhlIGZ1bGwgc3BoZXJlXG4gICAgICAgIC8vIGV2YWx1YXRlIGl0cyB2YWx1ZSBmb3IgdGhpcyBwb2ludCBhbmQgc3BlY2lmaWVkIHN0YXJ0IGFuZCBlbmRcbiAgICAgICAgc3RhcnQgPSAxIC0gMiAqIHN0YXJ0O1xuICAgICAgICBlbmQgPSAxIC0gMiAqIGVuZDtcbiAgICAgICAgY29uc3QgeSA9IG1hdGgubGVycChzdGFydCwgZW5kLCBpbmRleCAvIG51bVBvaW50cyk7XG5cbiAgICAgICAgLy8gcmFkaXVzIGF0IHlcbiAgICAgICAgY29uc3QgcmFkaXVzID0gTWF0aC5zcXJ0KDEgLSB5ICogeSk7XG5cbiAgICAgICAgLy8gZ29sZGVuIGFuZ2xlIGluY3JlbWVudFxuICAgICAgICBjb25zdCB0aGV0YSA9IF9nb2xkZW5BbmdsZSAqIGluZGV4O1xuXG4gICAgICAgIHBvaW50LnggPSBNYXRoLmNvcyh0aGV0YSkgKiByYWRpdXM7XG4gICAgICAgIHBvaW50LnkgPSB5O1xuICAgICAgICBwb2ludC56ID0gTWF0aC5zaW4odGhldGEpICogcmFkaXVzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhIHJlcGVhdGFibGUgcHNldWRvLXJhbmRvbSBzZXF1ZW5jZSB1c2luZyByYWRpY2FsIGludmVyc2UuIEJhc2VkIG9uXG4gICAgICogaHR0cDovL2hvbGdlci5kYW1tZXJ0ei5vcmcvc3R1ZmYvbm90ZXNfSGFtbWVyc2xleU9uSGVtaXNwaGVyZS5odG1sXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaSAtIFRoZSBpbmRleCBpbiB0aGUgc2VxdWVuY2UgdG8gcmV0dXJuLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBwc2V1ZG8tcmFuZG9tIHZhbHVlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByYWRpY2FsSW52ZXJzZShpKSB7XG4gICAgICAgIGxldCBiaXRzID0gKChpIDw8IDE2KSB8IChpID4+PiAxNikpID4+PiAwO1xuICAgICAgICBiaXRzID0gKCgoYml0cyAmIDB4NTU1NTU1NTUpIDw8IDEpIHwgKChiaXRzICYgMHhBQUFBQUFBQSkgPj4+IDEpKSA+Pj4gMDtcbiAgICAgICAgYml0cyA9ICgoKGJpdHMgJiAweDMzMzMzMzMzKSA8PCAyKSB8ICgoYml0cyAmIDB4Q0NDQ0NDQ0MpID4+PiAyKSkgPj4+IDA7XG4gICAgICAgIGJpdHMgPSAoKChiaXRzICYgMHgwRjBGMEYwRikgPDwgNCkgfCAoKGJpdHMgJiAweEYwRjBGMEYwKSA+Pj4gNCkpID4+PiAwO1xuICAgICAgICBiaXRzID0gKCgoYml0cyAmIDB4MDBGRjAwRkYpIDw8IDgpIHwgKChiaXRzICYgMHhGRjAwRkYwMCkgPj4+IDgpKSA+Pj4gMDtcbiAgICAgICAgcmV0dXJuIGJpdHMgKiAyLjMyODMwNjQzNjUzODY5NjNlLTEwO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IHJhbmRvbSB9O1xuIl0sIm5hbWVzIjpbIl9nb2xkZW5BbmdsZSIsInJhbmRvbSIsImNpcmNsZVBvaW50IiwicG9pbnQiLCJyIiwiTWF0aCIsInNxcnQiLCJ0aGV0YSIsIlBJIiwieCIsImNvcyIsInkiLCJzaW4iLCJjaXJjbGVQb2ludERldGVybWluaXN0aWMiLCJpbmRleCIsIm51bVBvaW50cyIsInNwaGVyZVBvaW50RGV0ZXJtaW5pc3RpYyIsInN0YXJ0IiwiZW5kIiwibWF0aCIsImxlcnAiLCJyYWRpdXMiLCJ6IiwicmFkaWNhbEludmVyc2UiLCJpIiwiYml0cyJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBLE1BQU1BLFlBQVksR0FBRyxpQkFBaUIsQ0FBQTs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxHQUFHO0FBQ1g7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLEtBQUssRUFBRTtJQUNmLE1BQU1DLENBQUMsR0FBR0MsSUFBSSxDQUFDQyxJQUFJLENBQUNELElBQUksQ0FBQ0osTUFBTSxFQUFFLENBQUMsQ0FBQTtBQUNsQyxJQUFBLE1BQU1NLEtBQUssR0FBR0YsSUFBSSxDQUFDSixNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUdJLElBQUksQ0FBQ0csRUFBRSxDQUFBO0lBQ3pDTCxLQUFLLENBQUNNLENBQUMsR0FBR0wsQ0FBQyxHQUFHQyxJQUFJLENBQUNLLEdBQUcsQ0FBQ0gsS0FBSyxDQUFDLENBQUE7SUFDN0JK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