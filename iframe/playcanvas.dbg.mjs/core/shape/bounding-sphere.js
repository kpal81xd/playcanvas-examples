import { Debug } from '../debug.js';
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();

/**
 * A bounding sphere is a volume for facilitating fast intersection testing.
 *
 * @category Math
 */
class BoundingSphere {
  /**
   * Creates a new BoundingSphere instance.
   *
   * @param {Vec3} [center] - The world space coordinate marking the center of the sphere. The
   * constructor takes a reference of this parameter.
   * @param {number} [radius] - The radius of the bounding sphere. Defaults to 0.5.
   * @example
   * // Create a new bounding sphere centered on the origin with a radius of 0.5
   * const sphere = new pc.BoundingSphere();
   */
  constructor(center = new Vec3(), radius = 0.5) {
    /**
     * Center of sphere.
     *
     * @type {Vec3}
     */
    this.center = void 0;
    /**
     * The radius of the bounding sphere.
     *
     * @type {number}
     */
    this.radius = void 0;
    Debug.assert(!Object.isFrozen(center), 'The constructor of \'BoundingSphere\' does not accept a constant (frozen) object as a \'center\' parameter');
    this.center = center;
    this.radius = radius;
  }
  containsPoint(point) {
    const lenSq = tmpVecA.sub2(point, this.center).lengthSq();
    const r = this.radius;
    return lenSq < r * r;
  }

  /**
   * Test if a ray intersects with the sphere.
   *
   * @param {import('./ray.js').Ray} ray - Ray to test against (direction must be normalized).
   * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
   * into here.
   * @returns {boolean} True if there is an intersection.
   */
  intersectsRay(ray, point) {
    const m = tmpVecA.copy(ray.origin).sub(this.center);
    const b = m.dot(tmpVecB.copy(ray.direction).normalize());
    const c = m.dot(m) - this.radius * this.radius;

    // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
    if (c > 0 && b > 0) return false;
    const discr = b * b - c;
    // a negative discriminant corresponds to ray missing sphere
    if (discr < 0) return false;

    // ray intersects sphere, compute smallest t value of intersection
    const t = Math.abs(-b - Math.sqrt(discr));

    // if t is negative, ray started inside sphere so clamp t to zero
    if (point) point.copy(ray.direction).mulScalar(t).add(ray.origin);
    return true;
  }

  /**
   * Test if a Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere.
   *
   * @param {BoundingSphere} sphere - Bounding Sphere to test.
   * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere and false otherwise.
   */
  intersectsBoundingSphere(sphere) {
    tmpVecA.sub2(sphere.center, this.center);
    const totalRadius = sphere.radius + this.radius;
    if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
      return true;
    }
    return false;
  }
}

export { BoundingSphere };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm91bmRpbmctc3BoZXJlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcblxuY29uc3QgdG1wVmVjQSA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBWZWNCID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBBIGJvdW5kaW5nIHNwaGVyZSBpcyBhIHZvbHVtZSBmb3IgZmFjaWxpdGF0aW5nIGZhc3QgaW50ZXJzZWN0aW9uIHRlc3RpbmcuXG4gKlxuICogQGNhdGVnb3J5IE1hdGhcbiAqL1xuY2xhc3MgQm91bmRpbmdTcGhlcmUge1xuICAgIC8qKlxuICAgICAqIENlbnRlciBvZiBzcGhlcmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBjZW50ZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBib3VuZGluZyBzcGhlcmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHJhZGl1cztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQm91bmRpbmdTcGhlcmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtjZW50ZXJdIC0gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUgbWFya2luZyB0aGUgY2VudGVyIG9mIHRoZSBzcGhlcmUuIFRoZVxuICAgICAqIGNvbnN0cnVjdG9yIHRha2VzIGEgcmVmZXJlbmNlIG9mIHRoaXMgcGFyYW1ldGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIGJvdW5kaW5nIHNwaGVyZS4gRGVmYXVsdHMgdG8gMC41LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgbmV3IGJvdW5kaW5nIHNwaGVyZSBjZW50ZXJlZCBvbiB0aGUgb3JpZ2luIHdpdGggYSByYWRpdXMgb2YgMC41XG4gICAgICogY29uc3Qgc3BoZXJlID0gbmV3IHBjLkJvdW5kaW5nU3BoZXJlKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2VudGVyID0gbmV3IFZlYzMoKSwgcmFkaXVzID0gMC41KSB7XG4gICAgICAgIERlYnVnLmFzc2VydCghT2JqZWN0LmlzRnJvemVuKGNlbnRlciksICdUaGUgY29uc3RydWN0b3Igb2YgXFwnQm91bmRpbmdTcGhlcmVcXCcgZG9lcyBub3QgYWNjZXB0IGEgY29uc3RhbnQgKGZyb3plbikgb2JqZWN0IGFzIGEgXFwnY2VudGVyXFwnIHBhcmFtZXRlcicpO1xuXG4gICAgICAgIHRoaXMuY2VudGVyID0gY2VudGVyO1xuICAgICAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcbiAgICB9XG5cbiAgICBjb250YWluc1BvaW50KHBvaW50KSB7XG4gICAgICAgIGNvbnN0IGxlblNxID0gdG1wVmVjQS5zdWIyKHBvaW50LCB0aGlzLmNlbnRlcikubGVuZ3RoU3EoKTtcbiAgICAgICAgY29uc3QgciA9IHRoaXMucmFkaXVzO1xuICAgICAgICByZXR1cm4gbGVuU3EgPCByICogcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIGEgcmF5IGludGVyc2VjdHMgd2l0aCB0aGUgc3BoZXJlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmF5LmpzJykuUmF5fSByYXkgLSBSYXkgdG8gdGVzdCBhZ2FpbnN0IChkaXJlY3Rpb24gbXVzdCBiZSBub3JtYWxpemVkKS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtwb2ludF0gLSBJZiB0aGVyZSBpcyBhbiBpbnRlcnNlY3Rpb24sIHRoZSBpbnRlcnNlY3Rpb24gcG9pbnQgd2lsbCBiZSBjb3BpZWRcbiAgICAgKiBpbnRvIGhlcmUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLlxuICAgICAqL1xuICAgIGludGVyc2VjdHNSYXkocmF5LCBwb2ludCkge1xuICAgICAgICBjb25zdCBtID0gdG1wVmVjQS5jb3B5KHJheS5vcmlnaW4pLnN1Yih0aGlzLmNlbnRlcik7XG4gICAgICAgIGNvbnN0IGIgPSBtLmRvdCh0bXBWZWNCLmNvcHkocmF5LmRpcmVjdGlvbikubm9ybWFsaXplKCkpO1xuICAgICAgICBjb25zdCBjID0gbS5kb3QobSkgLSB0aGlzLnJhZGl1cyAqIHRoaXMucmFkaXVzO1xuXG4gICAgICAgIC8vIGV4aXQgaWYgcmF5J3Mgb3JpZ2luIG91dHNpZGUgb2Ygc3BoZXJlIChjID4gMCkgYW5kIHJheSBwb2ludGluZyBhd2F5IGZyb20gcyAoYiA+IDApXG4gICAgICAgIGlmIChjID4gMCAmJiBiID4gMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBkaXNjciA9IGIgKiBiIC0gYztcbiAgICAgICAgLy8gYSBuZWdhdGl2ZSBkaXNjcmltaW5hbnQgY29ycmVzcG9uZHMgdG8gcmF5IG1pc3Npbmcgc3BoZXJlXG4gICAgICAgIGlmIChkaXNjciA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gcmF5IGludGVyc2VjdHMgc3BoZXJlLCBjb21wdXRlIHNtYWxsZXN0IHQgdmFsdWUgb2YgaW50ZXJzZWN0aW9uXG4gICAgICAgIGNvbnN0IHQgPSBNYXRoLmFicygtYiAtIE1hdGguc3FydChkaXNjcikpO1xuXG4gICAgICAgIC8vIGlmIHQgaXMgbmVnYXRpdmUsIHJheSBzdGFydGVkIGluc2lkZSBzcGhlcmUgc28gY2xhbXAgdCB0byB6ZXJvXG4gICAgICAgIGlmIChwb2ludClcbiAgICAgICAgICAgIHBvaW50LmNvcHkocmF5LmRpcmVjdGlvbikubXVsU2NhbGFyKHQpLmFkZChyYXkub3JpZ2luKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIGEgQm91bmRpbmcgU3BoZXJlIGlzIG92ZXJsYXBwaW5nLCBlbnZlbG9waW5nLCBvciBpbnNpZGUgdGhpcyBCb3VuZGluZyBTcGhlcmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JvdW5kaW5nU3BoZXJlfSBzcGhlcmUgLSBCb3VuZGluZyBTcGhlcmUgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgQm91bmRpbmcgU3BoZXJlIGlzIG92ZXJsYXBwaW5nLCBlbnZlbG9waW5nLCBvciBpbnNpZGUgdGhpcyBCb3VuZGluZyBTcGhlcmUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzQm91bmRpbmdTcGhlcmUoc3BoZXJlKSB7XG4gICAgICAgIHRtcFZlY0Euc3ViMihzcGhlcmUuY2VudGVyLCB0aGlzLmNlbnRlcik7XG4gICAgICAgIGNvbnN0IHRvdGFsUmFkaXVzID0gc3BoZXJlLnJhZGl1cyArIHRoaXMucmFkaXVzO1xuICAgICAgICBpZiAodG1wVmVjQS5sZW5ndGhTcSgpIDw9IHRvdGFsUmFkaXVzICogdG90YWxSYWRpdXMpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQm91bmRpbmdTcGhlcmUgfTtcbiJdLCJuYW1lcyI6WyJ0bXBWZWNBIiwiVmVjMyIsInRtcFZlY0IiLCJCb3VuZGluZ1NwaGVyZSIsImNvbnN0cnVjdG9yIiwiY2VudGVyIiwicmFkaXVzIiwiRGVidWciLCJhc3NlcnQiLCJPYmplY3QiLCJpc0Zyb3plbiIsImNvbnRhaW5zUG9pbnQiLCJwb2ludCIsImxlblNxIiwic3ViMiIsImxlbmd0aFNxIiwiciIsImludGVyc2VjdHNSYXkiLCJyYXkiLCJtIiwiY29weSIsIm9yaWdpbiIsInN1YiIsImIiLCJkb3QiLCJkaXJlY3Rpb24iLCJub3JtYWxpemUiLCJjIiwiZGlzY3IiLCJ0IiwiTWF0aCIsImFicyIsInNxcnQiLCJtdWxTY2FsYXIiLCJhZGQiLCJpbnRlcnNlY3RzQm91bmRpbmdTcGhlcmUiLCJzcGhlcmUiLCJ0b3RhbFJhZGl1cyJdLCJtYXBwaW5ncyI6Ijs7O0FBR0EsTUFBTUEsT0FBTyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1DLE9BQU8sR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1FLGNBQWMsQ0FBQztBQWVqQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxNQUFNLEdBQUcsSUFBSUosSUFBSSxFQUFFLEVBQUVLLE1BQU0sR0FBRyxHQUFHLEVBQUU7QUF4Qi9DO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUQsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFhRkMsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUMsQ0FBQ0MsTUFBTSxDQUFDQyxRQUFRLENBQUNMLE1BQU0sQ0FBQyxFQUFFLDRHQUE0RyxDQUFDLENBQUE7SUFFcEosSUFBSSxDQUFDQSxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3hCLEdBQUE7RUFFQUssYUFBYUEsQ0FBQ0MsS0FBSyxFQUFFO0FBQ2pCLElBQUEsTUFBTUMsS0FBSyxHQUFHYixPQUFPLENBQUNjLElBQUksQ0FBQ0YsS0FBSyxFQUFFLElBQUksQ0FBQ1AsTUFBTSxDQUFDLENBQUNVLFFBQVEsRUFBRSxDQUFBO0FBQ3pELElBQUEsTUFBTUMsQ0FBQyxHQUFHLElBQUksQ0FBQ1YsTUFBTSxDQUFBO0FBQ3JCLElBQUEsT0FBT08sS0FBSyxHQUFHRyxDQUFDLEdBQUdBLENBQUMsQ0FBQTtBQUN4QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsYUFBYUEsQ0FBQ0MsR0FBRyxFQUFFTixLQUFLLEVBQUU7QUFDdEIsSUFBQSxNQUFNTyxDQUFDLEdBQUduQixPQUFPLENBQUNvQixJQUFJLENBQUNGLEdBQUcsQ0FBQ0csTUFBTSxDQUFDLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUNqQixNQUFNLENBQUMsQ0FBQTtBQUNuRCxJQUFBLE1BQU1rQixDQUFDLEdBQUdKLENBQUMsQ0FBQ0ssR0FBRyxDQUFDdEIsT0FBTyxDQUFDa0IsSUFBSSxDQUFDRixHQUFHLENBQUNPLFNBQVMsQ0FBQyxDQUFDQyxTQUFTLEVBQUUsQ0FBQyxDQUFBO0FBQ3hELElBQUEsTUFBTUMsQ0FBQyxHQUFHUixDQUFDLENBQUNLLEdBQUcsQ0FBQ0wsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDYixNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7O0FBRTlDO0lBQ0EsSUFBSXFCLENBQUMsR0FBRyxDQUFDLElBQUlKLENBQUMsR0FBRyxDQUFDLEVBQ2QsT0FBTyxLQUFLLENBQUE7QUFFaEIsSUFBQSxNQUFNSyxLQUFLLEdBQUdMLENBQUMsR0FBR0EsQ0FBQyxHQUFHSSxDQUFDLENBQUE7QUFDdkI7QUFDQSxJQUFBLElBQUlDLEtBQUssR0FBRyxDQUFDLEVBQ1QsT0FBTyxLQUFLLENBQUE7O0FBRWhCO0FBQ0EsSUFBQSxNQUFNQyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLENBQUNSLENBQUMsR0FBR08sSUFBSSxDQUFDRSxJQUFJLENBQUNKLEtBQUssQ0FBQyxDQUFDLENBQUE7O0FBRXpDO0lBQ0EsSUFBSWhCLEtBQUssRUFDTEEsS0FBSyxDQUFDUSxJQUFJLENBQUNGLEdBQUcsQ0FBQ08sU0FBUyxDQUFDLENBQUNRLFNBQVMsQ0FBQ0osQ0FBQyxDQUFDLENBQUNLLEdBQUcsQ0FBQ2hCLEdBQUcsQ0FBQ0csTUFBTSxDQUFDLENBQUE7QUFFMUQsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ljLHdCQUF3QkEsQ0FBQ0MsTUFBTSxFQUFFO0lBQzdCcEMsT0FBTyxDQUFDYyxJQUFJLENBQUNzQixNQUFNLENBQUMvQixNQUFNLEVBQUUsSUFBSSxDQUFDQSxNQUFNLENBQUMsQ0FBQTtJQUN4QyxNQUFNZ0MsV0FBVyxHQUFHRCxNQUFNLENBQUM5QixNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7SUFDL0MsSUFBSU4sT0FBTyxDQUFDZSxRQUFRLEVBQUUsSUFBSXNCLFdBQVcsR0FBR0EsV0FBVyxFQUFFO0FBQ2pELE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBO0FBRUEsSUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixHQUFBO0FBQ0o7Ozs7In0=