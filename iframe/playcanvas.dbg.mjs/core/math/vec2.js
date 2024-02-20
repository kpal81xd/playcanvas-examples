import { math } from './math.js';

var _class;

/**
 * A 2-dimensional vector.
 *
 * @category Math
 */
class Vec2 {
  /**
   * Create a new Vec2 instance.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 2, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @example
   * const v = new pc.Vec2(1, 2);
   */
  constructor(x = 0, y = 0) {
    /**
     * The first component of the vector.
     *
     * @type {number}
     */
    this.x = void 0;
    /**
     * The second component of the vector.
     *
     * @type {number}
     */
    this.y = void 0;
    if (x.length === 2) {
      this.x = x[0];
      this.y = x[1];
    } else {
      this.x = x;
      this.y = y;
    }
  }

  /**
   * Adds a 2-dimensional vector to another in place.
   *
   * @param {Vec2} rhs - The vector to add to the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(10, 10);
   * const b = new pc.Vec2(20, 20);
   *
   * a.add(b);
   *
   * // Outputs [30, 30]
   * console.log("The result of the addition is: " + a.toString());
   */
  add(rhs) {
    this.x += rhs.x;
    this.y += rhs.y;
    return this;
  }

  /**
   * Adds two 2-dimensional vectors together and returns the result.
   *
   * @param {Vec2} lhs - The first vector operand for the addition.
   * @param {Vec2} rhs - The second vector operand for the addition.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(10, 10);
   * const b = new pc.Vec2(20, 20);
   * const r = new pc.Vec2();
   *
   * r.add2(a, b);
   * // Outputs [30, 30]
   *
   * console.log("The result of the addition is: " + r.toString());
   */
  add2(lhs, rhs) {
    this.x = lhs.x + rhs.x;
    this.y = lhs.y + rhs.y;
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec2} Self for chaining.
   * @example
   * const vec = new pc.Vec2(3, 4);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    return this;
  }

  /**
   * Adds a 2-dimensional vector scaled by scalar value. Does not modify the vector being added.
   *
   * @param {Vec2} rhs - The vector to add to the specified vector.
   * @param {number} scalar - The number to multiply the added vector with.
   * @returns {Vec2} Self for chaining.
   * @example
   * const vec = new pc.Vec2(1, 2);
   *
   * vec.addScaled(pc.Vec2.UP, 2);
   *
   * // Outputs [1, 4]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScaled(rhs, scalar) {
    this.x += rhs.x * scalar;
    this.y += rhs.y * scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 2-dimensional vector.
   *
   * @returns {this} A 2-dimensional vector containing the result of the cloning.
   * @example
   * const v = new pc.Vec2(10, 20);
   * const vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y);
  }

  /**
   * Copies the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
   *
   * @param {Vec2} rhs - A vector to copy to the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * const src = new pc.Vec2(10, 20);
   * const dst = new pc.Vec2();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    return this;
  }

  /**
   * Returns the result of a cross product operation performed on the two specified 2-dimensional
   * vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector operand of the cross product.
   * @returns {number} The cross product of the two vectors.
   * @example
   * const right = new pc.Vec2(1, 0);
   * const up = new pc.Vec2(0, 1);
   * const crossProduct = right.cross(up);
   *
   * // Prints 1
   * console.log("The result of the cross product is: " + crossProduct);
   */
  cross(rhs) {
    return this.x * rhs.y - this.y * rhs.x;
  }

  /**
   * Returns the distance between the two specified 2-dimensional vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector to test.
   * @returns {number} The distance between the two vectors.
   * @example
   * const v1 = new pc.Vec2(5, 10);
   * const v2 = new pc.Vec2(10, 20);
   * const d = v1.distance(v2);
   * console.log("The distance between v1 and v2 is: " + d);
   */
  distance(rhs) {
    const x = this.x - rhs.x;
    const y = this.y - rhs.y;
    return Math.sqrt(x * x + y * y);
  }

  /**
   * Divides a 2-dimensional vector by another in place.
   *
   * @param {Vec2} rhs - The vector to divide the specified vector by.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(4, 9);
   * const b = new pc.Vec2(2, 3);
   *
   * a.div(b);
   *
   * // Outputs [2, 3]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    return this;
  }

  /**
   * Divides one 2-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec2} lhs - The dividend vector (the vector being divided).
   * @param {Vec2} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(4, 9);
   * const b = new pc.Vec2(2, 3);
   * const r = new pc.Vec2();
   *
   * r.div2(a, b);
   * // Outputs [2, 3]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec2} Self for chaining.
   * @example
   * const vec = new pc.Vec2(3, 6);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 2-dimensional
   * vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * const v1 = new pc.Vec2(5, 10);
   * const v2 = new pc.Vec2(10, 20);
   * const v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec2} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec2(1, 2);
   * const b = new pc.Vec2(4, 5);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y;
  }

  /**
   * Reports whether two vectors are equal using an absolute error tolerance.
   *
   * @param {Vec2} rhs - The vector to be compared against.
   * @param {number} [epsilon] - The maximum difference between each component of the two
   * vectors. Defaults to 1e-6.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec2();
   * const b = new pc.Vec2();
   * console.log("The two vectors are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
   */
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon;
  }

  /**
   * Returns the magnitude of the specified 2-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 2-dimensional vector.
   * @example
   * const vec = new pc.Vec2(3, 4);
   * const len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Returns the magnitude squared of the specified 2-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 2-dimensional vector.
   * @example
   * const vec = new pc.Vec2(3, 4);
   * const len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Returns the result of a linear interpolation between two specified 2-dimensional vectors.
   *
   * @param {Vec2} lhs - The 2-dimensional to interpolate from.
   * @param {Vec2} rhs - The 2-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(0, 0);
   * const b = new pc.Vec2(10, 10);
   * const r = new pc.Vec2();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    return this;
  }

  /**
   * Multiplies a 2-dimensional vector to another in place.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(2, 3);
   * const b = new pc.Vec2(4, 5);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 2-dimensional vectors together.
   *
   * @param {Vec2} lhs - The 2-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(2, 3);
   * const b = new pc.Vec2(4, 5);
   * const r = new pc.Vec2();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec2} Self for chaining.
   * @example
   * const vec = new pc.Vec2(3, 6);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Returns this 2-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @param {Vec2} [src] - The vector to normalize. If not set, the operation is done in place.
   * @returns {Vec2} Self for chaining.
   * @example
   * const v = new pc.Vec2(25, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize(src = this) {
    const lengthSq = src.x * src.x + src.y * src.y;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x = src.x * invLength;
      this.y = src.y * invLength;
    }
    return this;
  }

  /**
   * Rotate a vector by an angle in degrees.
   *
   * @param {number} degrees - The number to degrees to rotate the vector by.
   * @returns {Vec2} Self for chaining.
   * @example
   * const v = new pc.Vec2(0, 10);
   *
   * v.rotate(45); // rotates by 45 degrees
   *
   * // Outputs [7.071068.., 7.071068..]
   * console.log("Vector after rotation is: " + v.toString());
   */
  rotate(degrees) {
    const angle = Math.atan2(this.x, this.y) + degrees * math.DEG_TO_RAD;
    const len = Math.sqrt(this.x * this.x + this.y * this.y);
    this.x = Math.sin(angle) * len;
    this.y = Math.cos(angle) * len;
    return this;
  }

  /**
   * Returns the angle in degrees of the specified 2-dimensional vector.
   *
   * @returns {number} The angle in degrees of the specified 2-dimensional vector.
   * @example
   * const v = new pc.Vec2(6, 0);
   * const angle = v.angle();
   * // Outputs 90..
   * console.log("The angle of the vector is: " + angle);
   */
  angle() {
    return Math.atan2(this.x, this.y) * math.RAD_TO_DEG;
  }

  /**
   * Returns the shortest Euler angle between two 2-dimensional vectors.
   *
   * @param {Vec2} rhs - The 2-dimensional vector to calculate angle to.
   * @returns {number} The shortest angle in degrees between two 2-dimensional vectors.
   * @example
   * const a = new pc.Vec2(0, 10); // up
   * const b = new pc.Vec2(1, -1); // down-right
   * const angle = a.angleTo(b);
   * // Outputs 135..
   * console.log("The angle between vectors a and b: " + angle);
   */
  angleTo(rhs) {
    return Math.atan2(this.x * rhs.y + this.y * rhs.x, this.x * rhs.x + this.y * rhs.y) * math.RAD_TO_DEG;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @param {Vec2} [src] - The vector to floor. If not set, the operation is done in place.
   * @returns {Vec2} Self for chaining.
   */
  floor(src = this) {
    this.x = Math.floor(src.x);
    this.y = Math.floor(src.y);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @param {Vec2} [src] - The vector to ceil. If not set, the operation is done in place.
   * @returns {Vec2} Self for chaining.
   */
  ceil(src = this) {
    this.x = Math.ceil(src.x);
    this.y = Math.ceil(src.y);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @param {Vec2} [src] - The vector to round. If not set, the operation is done in place.
   * @returns {Vec2} Self for chaining.
   */
  round(src = this) {
    this.x = Math.round(src.x);
    this.y = Math.round(src.y);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
   * @returns {Vec2} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
   * @returns {Vec2} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    return this;
  }

  /**
   * Sets the specified 2-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * const v = new pc.Vec2();
   * v.set(5, 10);
   *
   * // Outputs 5, 10
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Subtracts a 2-dimensional vector from another in place.
   *
   * @param {Vec2} rhs - The vector to subtract from the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(10, 10);
   * const b = new pc.Vec2(20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    return this;
  }

  /**
   * Subtracts two 2-dimensional vectors from one another and returns the result.
   *
   * @param {Vec2} lhs - The first vector operand for the subtraction.
   * @param {Vec2} rhs - The second vector operand for the subtraction.
   * @returns {Vec2} Self for chaining.
   * @example
   * const a = new pc.Vec2(10, 10);
   * const b = new pc.Vec2(20, 20);
   * const r = new pc.Vec2();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec2} Self for chaining.
   * @example
   * const vec = new pc.Vec2(3, 4);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * const v = new pc.Vec2(20, 10);
   * // Outputs [20, 10]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}]`;
  }

  /**
   * Calculates the angle between two Vec2's in radians.
   *
   * @param {Vec2} lhs - The first vector operand for the calculation.
   * @param {Vec2} rhs - The second vector operand for the calculation.
   * @returns {number} The calculated angle in radians.
   * @ignore
   */
  static angleRad(lhs, rhs) {
    return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
  }

  /**
   * A constant vector set to [0, 0].
   *
   * @type {Vec2}
   * @readonly
   */
}
_class = Vec2;
Vec2.ZERO = Object.freeze(new _class(0, 0));
/**
 * A constant vector set to [1, 1].
 *
 * @type {Vec2}
 * @readonly
 */
Vec2.ONE = Object.freeze(new _class(1, 1));
/**
 * A constant vector set to [0, 1].
 *
 * @type {Vec2}
 * @readonly
 */
Vec2.UP = Object.freeze(new _class(0, 1));
/**
 * A constant vector set to [0, -1].
 *
 * @type {Vec2}
 * @readonly
 */
Vec2.DOWN = Object.freeze(new _class(0, -1));
/**
 * A constant vector set to [1, 0].
 *
 * @type {Vec2}
 * @readonly
 */
Vec2.RIGHT = Object.freeze(new _class(1, 0));
/**
 * A constant vector set to [-1, 0].
 *
 * @type {Vec2}
 * @readonly
 */
Vec2.LEFT = Object.freeze(new _class(-1, 0));

export { Vec2 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWMyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuXG4vKipcbiAqIEEgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gKlxuICogQGNhdGVnb3J5IE1hdGhcbiAqL1xuY2xhc3MgVmVjMiB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBWZWMyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSB4IHZhbHVlLiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5IG9mIGxlbmd0aCAyLCB0aGVcbiAgICAgKiBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMyKDEsIDIpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHggPSAwLCB5ID0gMCkge1xuICAgICAgICBpZiAoeC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHhbMF07XG4gICAgICAgICAgICB0aGlzLnkgPSB4WzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHZlY3RvciB0byBhZGQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLmFkZChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkKHJocykge1xuICAgICAgICB0aGlzLnggKz0gcmhzLng7XG4gICAgICAgIHRoaXMueSArPSByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHR3byAyLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDIwLCAyMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiByLmFkZDIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwXVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbnVtYmVyIHRvIGVhY2ggZWxlbWVudCBvZiBhIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIGFkZC5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMigzLCA0KTtcbiAgICAgKlxuICAgICAqIHZlYy5hZGRTY2FsYXIoMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs1LCA2XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICs9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3Igc2NhbGVkIGJ5IHNjYWxhciB2YWx1ZS4gRG9lcyBub3QgbW9kaWZ5IHRoZSB2ZWN0b3IgYmVpbmcgYWRkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIG11bHRpcGx5IHRoZSBhZGRlZCB2ZWN0b3Igd2l0aC5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMigxLCAyKTtcbiAgICAgKlxuICAgICAqIHZlYy5hZGRTY2FsZWQocGMuVmVjMi5VUCwgMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCA0XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZFNjYWxlZChyaHMsIHNjYWxhcikge1xuICAgICAgICB0aGlzLnggKz0gcmhzLnggKiBzY2FsYXI7XG4gICAgICAgIHRoaXMueSArPSByaHMueSAqIHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGlkZW50aWNhbCBjb3B5IG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSAyLWRpbWVuc2lvbmFsIHZlY3RvciBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzIoMTAsIDIwKTtcbiAgICAgKiBjb25zdCB2Y2xvbmUgPSB2LmNsb25lKCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHZjbG9uZS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIDItZGltZW5zaW9uYWwgdmVjdG9yIHRvIGEgZGVzdGluYXRpb24gMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIEEgdmVjdG9yIHRvIGNvcHkgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc3JjID0gbmV3IHBjLlZlYzIoMTAsIDIwKTtcbiAgICAgKiBjb25zdCBkc3QgPSBuZXcgcGMuVmVjMigpO1xuICAgICAqXG4gICAgICogZHN0LmNvcHkoc3JjKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChkc3QuZXF1YWxzKHNyYykgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBhIGNyb3NzIHByb2R1Y3Qgb3BlcmF0aW9uIHBlcmZvcm1lZCBvbiB0aGUgdHdvIHNwZWNpZmllZCAyLWRpbWVuc2lvbmFsXG4gICAgICogdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHNlY29uZCAyLWRpbWVuc2lvbmFsIHZlY3RvciBvcGVyYW5kIG9mIHRoZSBjcm9zcyBwcm9kdWN0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBjcm9zcyBwcm9kdWN0IG9mIHRoZSB0d28gdmVjdG9ycy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJpZ2h0ID0gbmV3IHBjLlZlYzIoMSwgMCk7XG4gICAgICogY29uc3QgdXAgPSBuZXcgcGMuVmVjMigwLCAxKTtcbiAgICAgKiBjb25zdCBjcm9zc1Byb2R1Y3QgPSByaWdodC5jcm9zcyh1cCk7XG4gICAgICpcbiAgICAgKiAvLyBQcmludHMgMVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgY3Jvc3MgcHJvZHVjdCBpczogXCIgKyBjcm9zc1Byb2R1Y3QpO1xuICAgICAqL1xuICAgIGNyb3NzKHJocykge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogcmhzLnkgLSB0aGlzLnkgKiByaHMueDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRoZSB0d28gc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHNlY29uZCAyLWRpbWVuc2lvbmFsIHZlY3RvciB0byB0ZXN0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRoZSB0d28gdmVjdG9ycy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYxID0gbmV3IHBjLlZlYzIoNSwgMTApO1xuICAgICAqIGNvbnN0IHYyID0gbmV3IHBjLlZlYzIoMTAsIDIwKTtcbiAgICAgKiBjb25zdCBkID0gdjEuZGlzdGFuY2UodjIpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGRpc3RhbmNlIGJldHdlZW4gdjEgYW5kIHYyIGlzOiBcIiArIGQpO1xuICAgICAqL1xuICAgIGRpc3RhbmNlKHJocykge1xuICAgICAgICBjb25zdCB4ID0gdGhpcy54IC0gcmhzLng7XG4gICAgICAgIGNvbnN0IHkgPSB0aGlzLnkgLSByaHMueTtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh4ICogeCArIHkgKiB5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXZpZGVzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHZlY3RvciB0byBkaXZpZGUgdGhlIHNwZWNpZmllZCB2ZWN0b3IgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDQsIDkpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMigyLCAzKTtcbiAgICAgKlxuICAgICAqIGEuZGl2KGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMiwgM11cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2KHJocykge1xuICAgICAgICB0aGlzLnggLz0gcmhzLng7XG4gICAgICAgIHRoaXMueSAvPSByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXZpZGVzIG9uZSAyLWRpbWVuc2lvbmFsIHZlY3RvciBieSBhbm90aGVyIGFuZCB3cml0ZXMgdGhlIHJlc3VsdCB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gbGhzIC0gVGhlIGRpdmlkZW5kIHZlY3RvciAodGhlIHZlY3RvciBiZWluZyBkaXZpZGVkKS5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSBkaXZpc29yIHZlY3RvciAodGhlIHZlY3RvciBkaXZpZGluZyB0aGUgZGl2aWRlbmQpLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMig0LCA5KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzIoMiwgMyk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiByLmRpdjIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMiwgM11cbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXYyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC8gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC8gcmhzLnk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IgYnkgYSBudW1iZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBkaXZpZGUgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzIoMywgNik7XG4gICAgICpcbiAgICAgKiB2ZWMuZGl2U2NhbGFyKDMpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMSwgMl1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXZTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAvPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgZG90IHByb2R1Y3Qgb3BlcmF0aW9uIHBlcmZvcm1lZCBvbiB0aGUgdHdvIHNwZWNpZmllZCAyLWRpbWVuc2lvbmFsXG4gICAgICogdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHNlY29uZCAyLWRpbWVuc2lvbmFsIHZlY3RvciBvcGVyYW5kIG9mIHRoZSBkb3QgcHJvZHVjdC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgcmVzdWx0IG9mIHRoZSBkb3QgcHJvZHVjdCBvcGVyYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2MSA9IG5ldyBwYy5WZWMyKDUsIDEwKTtcbiAgICAgKiBjb25zdCB2MiA9IG5ldyBwYy5WZWMyKDEwLCAyMCk7XG4gICAgICogY29uc3QgdjFkb3R2MiA9IHYxLmRvdCh2Mik7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkb3QgcHJvZHVjdCBpczogXCIgKyB2MWRvdHYyKTtcbiAgICAgKi9cbiAgICBkb3QocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiByaHMueCArIHRoaXMueSAqIHJocy55O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gdmVjdG9ycyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSB2ZWN0b3IgdG8gY29tcGFyZSB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMigxLCAyKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzIoNCwgNSk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcmhzLnggJiYgdGhpcy55ID09PSByaHMueTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHZlY3RvcnMgYXJlIGVxdWFsIHVzaW5nIGFuIGFic29sdXRlIGVycm9yIHRvbGVyYW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHZlY3RvciB0byBiZSBjb21wYXJlZCBhZ2FpbnN0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZXBzaWxvbl0gLSBUaGUgbWF4aW11bSBkaWZmZXJlbmNlIGJldHdlZW4gZWFjaCBjb21wb25lbnQgb2YgdGhlIHR3b1xuICAgICAqIHZlY3RvcnMuIERlZmF1bHRzIHRvIDFlLTYuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzIoKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzIoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gdmVjdG9ycyBhcmUgYXBwcm94aW1hdGVseSBcIiArIChhLmVxdWFsc0FwcHJveChiLCAxZS05KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHNBcHByb3gocmhzLCBlcHNpbG9uID0gMWUtNikge1xuICAgICAgICByZXR1cm4gKE1hdGguYWJzKHRoaXMueCAtIHJocy54KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy55IC0gcmhzLnkpIDwgZXBzaWxvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMigzLCA0KTtcbiAgICAgKiBjb25zdCBsZW4gPSB2ZWMubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzIoMywgNCk7XG4gICAgICogY29uc3QgbGVuID0gdmVjLmxlbmd0aFNxKCk7XG4gICAgICogLy8gT3V0cHV0cyAyNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBzcXVhcmVkIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGhTcSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSBsaHMgLSBUaGUgMi1kaW1lbnNpb25hbCB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIDItZGltZW5zaW9uYWwgdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBwb2ludCBvZiBpbnRlcnBvbGF0aW9uLiBCZXR3ZWVuIDAgYW5kIDEsXG4gICAgICogdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgc3RyYWlnaHQgbGluZSBiZXR3ZWVuIGxocyBhbmQgcmhzLiBPdXRzaWRlIG9mIHRoaXNcbiAgICAgKiByYW5nZSwgdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgcmF5IGV4dHJhcG9sYXRlZCBmcm9tIHRoaXMgbGluZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzIoMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiByLmxlcnAoYSwgYiwgMCk7ICAgLy8gciBpcyBlcXVhbCB0byBhXG4gICAgICogci5sZXJwKGEsIGIsIDAuNSk7IC8vIHIgaXMgNSwgNVxuICAgICAqIHIubGVycChhLCBiLCAxKTsgICAvLyByIGlzIGVxdWFsIHRvIGJcbiAgICAgKi9cbiAgICBsZXJwKGxocywgcmhzLCBhbHBoYSkge1xuICAgICAgICB0aGlzLnggPSBsaHMueCArIGFscGhhICogKHJocy54IC0gbGhzLngpO1xuICAgICAgICB0aGlzLnkgPSBsaHMueSArIGFscGhhICogKHJocy55IC0gbGhzLnkpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgYSAyLWRpbWVuc2lvbmFsIHZlY3RvciB0byBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMigyLCAzKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzIoNCwgNSk7XG4gICAgICpcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICB0aGlzLnggKj0gcmhzLng7XG4gICAgICAgIHRoaXMueSAqPSByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCAyLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IGxocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDIsIDMpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMig0LCA1KTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzIoKTtcbiAgICAgKlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAqIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAqIHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gbXVsdGlwbHkgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzIoMywgNik7XG4gICAgICpcbiAgICAgKiB2ZWMubXVsU2NhbGFyKDMpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbOSwgMThdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggKj0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgKj0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyAyLWRpbWVuc2lvbmFsIHZlY3RvciBjb252ZXJ0ZWQgdG8gYSB1bml0IHZlY3RvciBpbiBwbGFjZS4gSWYgdGhlIHZlY3RvciBoYXMgYVxuICAgICAqIGxlbmd0aCBvZiB6ZXJvLCB0aGUgdmVjdG9yJ3MgZWxlbWVudHMgd2lsbCBiZSBzZXQgdG8gemVyby5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gW3NyY10gLSBUaGUgdmVjdG9yIHRvIG5vcm1hbGl6ZS4gSWYgbm90IHNldCwgdGhlIG9wZXJhdGlvbiBpcyBkb25lIGluIHBsYWNlLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMigyNSwgMCk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAxLCAwXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZShzcmMgPSB0aGlzKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aFNxID0gc3JjLnggKiBzcmMueCArIHNyYy55ICogc3JjLnk7XG4gICAgICAgIGlmIChsZW5ndGhTcSA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGludkxlbmd0aCA9IDEgLyBNYXRoLnNxcnQobGVuZ3RoU3EpO1xuICAgICAgICAgICAgdGhpcy54ID0gc3JjLnggKiBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgPSBzcmMueSAqIGludkxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZSBhIHZlY3RvciBieSBhbiBhbmdsZSBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlZ3JlZXMgLSBUaGUgbnVtYmVyIHRvIGRlZ3JlZXMgdG8gcm90YXRlIHRoZSB2ZWN0b3IgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMyKDAsIDEwKTtcbiAgICAgKlxuICAgICAqIHYucm90YXRlKDQ1KTsgLy8gcm90YXRlcyBieSA0NSBkZWdyZWVzXG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs3LjA3MTA2OC4uLCA3LjA3MTA2OC4uXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVmVjdG9yIGFmdGVyIHJvdGF0aW9uIGlzOiBcIiArIHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgcm90YXRlKGRlZ3JlZXMpIHtcbiAgICAgICAgY29uc3QgYW5nbGUgPSBNYXRoLmF0YW4yKHRoaXMueCwgdGhpcy55KSArIChkZWdyZWVzICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgY29uc3QgbGVuID0gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSk7XG4gICAgICAgIHRoaXMueCA9IE1hdGguc2luKGFuZ2xlKSAqIGxlbjtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5jb3MoYW5nbGUpICogbGVuO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBhbmdsZSBpbiBkZWdyZWVzIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgYW5nbGUgaW4gZGVncmVlcyBvZiB0aGUgc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMyKDYsIDApO1xuICAgICAqIGNvbnN0IGFuZ2xlID0gdi5hbmdsZSgpO1xuICAgICAqIC8vIE91dHB1dHMgOTAuLlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGFuZ2xlIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgYW5nbGUpO1xuICAgICAqL1xuICAgIGFuZ2xlKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMih0aGlzLngsIHRoaXMueSkgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgc2hvcnRlc3QgRXVsZXIgYW5nbGUgYmV0d2VlbiB0d28gMi1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gY2FsY3VsYXRlIGFuZ2xlIHRvLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzaG9ydGVzdCBhbmdsZSBpbiBkZWdyZWVzIGJldHdlZW4gdHdvIDItZGltZW5zaW9uYWwgdmVjdG9ycy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMigwLCAxMCk7IC8vIHVwXG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDEsIC0xKTsgLy8gZG93bi1yaWdodFxuICAgICAqIGNvbnN0IGFuZ2xlID0gYS5hbmdsZVRvKGIpO1xuICAgICAqIC8vIE91dHB1dHMgMTM1Li5cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBhbmdsZSBiZXR3ZWVuIHZlY3RvcnMgYSBhbmQgYjogXCIgKyBhbmdsZSk7XG4gICAgICovXG4gICAgYW5nbGVUbyhyaHMpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIodGhpcy54ICogcmhzLnkgKyB0aGlzLnkgKiByaHMueCwgdGhpcy54ICogcmhzLnggKyB0aGlzLnkgKiByaHMueSkgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHNldCB0byB0aGUgbGFyZ2VzdCBpbnRlZ2VyIGxlc3MgdGhhbiBvciBlcXVhbCB0byBpdHMgdmFsdWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IFtzcmNdIC0gVGhlIHZlY3RvciB0byBmbG9vci4gSWYgbm90IHNldCwgdGhlIG9wZXJhdGlvbiBpcyBkb25lIGluIHBsYWNlLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBmbG9vcihzcmMgPSB0aGlzKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGguZmxvb3Ioc3JjLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLmZsb29yKHNyYy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHJvdW5kZWQgdXAgdG8gdGhlIG5leHQgbGFyZ2VzdCBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSBbc3JjXSAtIFRoZSB2ZWN0b3IgdG8gY2VpbC4gSWYgbm90IHNldCwgdGhlIG9wZXJhdGlvbiBpcyBkb25lIGluIHBsYWNlLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjZWlsKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5jZWlsKHNyYy54KTtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5jZWlsKHNyYy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHJvdW5kZWQgdXAgb3IgZG93biB0byB0aGUgbmVhcmVzdCBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSBbc3JjXSAtIFRoZSB2ZWN0b3IgdG8gcm91bmQuIElmIG5vdCBzZXQsIHRoZSBvcGVyYXRpb24gaXMgZG9uZSBpbiBwbGFjZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgcm91bmQoc3JjID0gdGhpcykge1xuICAgICAgICB0aGlzLnggPSBNYXRoLnJvdW5kKHNyYy54KTtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yb3VuZChzcmMueSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBhc3NpZ25lZCBhIHZhbHVlIGZyb20gcmhzIHBhcmFtZXRlciBpZiBpdCBpcyBzbWFsbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc291cmNlIG9mIGVsZW1lbnRzIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG1pbihyaHMpIHtcbiAgICAgICAgaWYgKHJocy54IDwgdGhpcy54KSB0aGlzLnggPSByaHMueDtcbiAgICAgICAgaWYgKHJocy55IDwgdGhpcy55KSB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIGFzc2lnbmVkIGEgdmFsdWUgZnJvbSByaHMgcGFyYW1ldGVyIGlmIGl0IGlzIGxhcmdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIDItZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNvdXJjZSBvZiBlbGVtZW50cyB0byBjb21wYXJlIHRvLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtYXgocmhzKSB7XG4gICAgICAgIGlmIChyaHMueCA+IHRoaXMueCkgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIGlmIChyaHMueSA+IHRoaXMueSkgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCAyLWRpbWVuc2lvbmFsIHZlY3RvciB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgZmlyc3QgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBzZWNvbmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICogdi5zZXQoNSwgMTApO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA1LCAxMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgZnJvbSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgdmVjdG9yIHRvIHN1YnRyYWN0IGZyb20gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLnN1YihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWy0xMCwgLTEwXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWIocmhzKSB7XG4gICAgICAgIHRoaXMueCAtPSByaHMueDtcbiAgICAgICAgdGhpcy55IC09IHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyB0d28gMi1kaW1lbnNpb25hbCB2ZWN0b3JzIGZyb20gb25lIGFub3RoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMyKDIwLCAyMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiByLnN1YjIoYSwgYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFstMTAsIC0xMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHN1YnRyYWN0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViMihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAtIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAtIHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyBhIG51bWJlciBmcm9tIGVhY2ggZWxlbWVudCBvZiBhIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIHN1YnRyYWN0LlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMyKDMsIDQpO1xuICAgICAqXG4gICAgICogdmVjLnN1YlNjYWxhcigyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzEsIDJdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggLT0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgLT0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSB2ZWN0b3IgdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdmVjdG9yIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMyKDIwLCAxMCk7XG4gICAgICogLy8gT3V0cHV0cyBbMjAsIDEwXVxuICAgICAqIGNvbnNvbGUubG9nKHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiBgWyR7dGhpcy54fSwgJHt0aGlzLnl9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlcyB0aGUgYW5nbGUgYmV0d2VlbiB0d28gVmVjMidzIGluIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IGxocyAtIFRoZSBmaXJzdCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIGNhbGN1bGF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHNlY29uZCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIGNhbGN1bGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBjYWxjdWxhdGVkIGFuZ2xlIGluIHJhZGlhbnMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBhbmdsZVJhZChsaHMsIHJocykge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihsaHMueCAqIHJocy55IC0gbGhzLnkgKiByaHMueCwgbGhzLnggKiByaHMueCArIGxocy55ICogcmhzLnkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgWkVSTyA9IE9iamVjdC5mcmVlemUobmV3IFZlYzIoMCwgMCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFsxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBPTkUgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMyKDEsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgVVAgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMyKDAsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgLTFdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIERPV04gPSBPYmplY3QuZnJlZXplKG5ldyBWZWMyKDAsIC0xKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzEsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFJJR0hUID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMigxLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWy0xLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBMRUZUID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMigtMSwgMCkpO1xufVxuXG5leHBvcnQgeyBWZWMyIH07XG4iXSwibmFtZXMiOlsiVmVjMiIsImNvbnN0cnVjdG9yIiwieCIsInkiLCJsZW5ndGgiLCJhZGQiLCJyaHMiLCJhZGQyIiwibGhzIiwiYWRkU2NhbGFyIiwic2NhbGFyIiwiYWRkU2NhbGVkIiwiY2xvbmUiLCJjc3RyIiwiY29weSIsImNyb3NzIiwiZGlzdGFuY2UiLCJNYXRoIiwic3FydCIsImRpdiIsImRpdjIiLCJkaXZTY2FsYXIiLCJkb3QiLCJlcXVhbHMiLCJlcXVhbHNBcHByb3giLCJlcHNpbG9uIiwiYWJzIiwibGVuZ3RoU3EiLCJsZXJwIiwiYWxwaGEiLCJtdWwiLCJtdWwyIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic3JjIiwiaW52TGVuZ3RoIiwicm90YXRlIiwiZGVncmVlcyIsImFuZ2xlIiwiYXRhbjIiLCJtYXRoIiwiREVHX1RPX1JBRCIsImxlbiIsInNpbiIsImNvcyIsIlJBRF9UT19ERUciLCJhbmdsZVRvIiwiZmxvb3IiLCJjZWlsIiwicm91bmQiLCJtaW4iLCJtYXgiLCJzZXQiLCJzdWIiLCJzdWIyIiwic3ViU2NhbGFyIiwidG9TdHJpbmciLCJhbmdsZVJhZCIsIl9jbGFzcyIsIlpFUk8iLCJPYmplY3QiLCJmcmVlemUiLCJPTkUiLCJVUCIsIkRPV04iLCJSSUdIVCIsIkxFRlQiXSwibWFwcGluZ3MiOiI7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsSUFBSSxDQUFDO0FBZVA7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUF2QjFCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUQsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFZRyxJQUFBLElBQUlELENBQUMsQ0FBQ0UsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNoQixNQUFBLElBQUksQ0FBQ0YsQ0FBQyxHQUFHQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDYixNQUFBLElBQUksQ0FBQ0MsQ0FBQyxHQUFHRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakIsS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDQSxDQUFDLEdBQUdBLENBQUMsQ0FBQTtNQUNWLElBQUksQ0FBQ0MsQ0FBQyxHQUFHQSxDQUFDLENBQUE7QUFDZCxLQUFBO0FBQ0osR0FBQTs7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
