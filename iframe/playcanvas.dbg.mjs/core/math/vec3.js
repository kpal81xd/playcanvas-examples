var _class;
/**
 * 3-dimensional vector.
 *
 * @category Math
 */
class Vec3 {
  /**
   * Creates a new Vec3 object.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 3, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @param {number} [z] - The z value. Defaults to 0.
   * @example
   * const v = new pc.Vec3(1, 2, 3);
   */
  constructor(x = 0, y = 0, z = 0) {
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
    /**
     * The third component of the vector.
     *
     * @type {number}
     */
    this.z = void 0;
    if (x.length === 3) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  /**
   * Adds a 3-dimensional vector to another in place.
   *
   * @param {Vec3} rhs - The vector to add to the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   *
   * a.add(b);
   *
   * // Outputs [30, 30, 30]
   * console.log("The result of the addition is: " + a.toString());
   */
  add(rhs) {
    this.x += rhs.x;
    this.y += rhs.y;
    this.z += rhs.z;
    return this;
  }

  /**
   * Adds two 3-dimensional vectors together and returns the result.
   *
   * @param {Vec3} lhs - The first vector operand for the addition.
   * @param {Vec3} rhs - The second vector operand for the addition.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   * const r = new pc.Vec3();
   *
   * r.add2(a, b);
   * // Outputs [30, 30, 30]
   *
   * console.log("The result of the addition is: " + r.toString());
   */
  add2(lhs, rhs) {
    this.x = lhs.x + rhs.x;
    this.y = lhs.y + rhs.y;
    this.z = lhs.z + rhs.z;
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 4, 5);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6, 7]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    return this;
  }

  /**
   * Adds a 3-dimensional vector scaled by scalar value. Does not modify the vector being added.
   *
   * @param {Vec3} rhs - The vector to add to the specified vector.
   * @param {number} scalar - The number to multiply the added vector with.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(1, 2, 3);
   *
   * vec.addScaled(pc.Vec3.UP, 2);
   *
   * // Outputs [1, 4, 3]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScaled(rhs, scalar) {
    this.x += rhs.x * scalar;
    this.y += rhs.y * scalar;
    this.z += rhs.z * scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 3-dimensional vector.
   *
   * @returns {this} A 3-dimensional vector containing the result of the cloning.
   * @example
   * const v = new pc.Vec3(10, 20, 30);
   * const vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z);
  }

  /**
   * Copies the contents of a source 3-dimensional vector to a destination 3-dimensional vector.
   *
   * @param {Vec3} rhs - A vector to copy to the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const src = new pc.Vec3(10, 20, 30);
   * const dst = new pc.Vec3();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    return this;
  }

  /**
   * Returns the result of a cross product operation performed on the two specified 3-dimensional
   * vectors.
   *
   * @param {Vec3} lhs - The first 3-dimensional vector operand of the cross product.
   * @param {Vec3} rhs - The second 3-dimensional vector operand of the cross product.
   * @returns {Vec3} Self for chaining.
   * @example
   * const back = new pc.Vec3().cross(pc.Vec3.RIGHT, pc.Vec3.UP);
   *
   * // Prints the Z axis (i.e. [0, 0, 1])
   * console.log("The result of the cross product is: " + back.toString());
   */
  cross(lhs, rhs) {
    // Create temporary variables in case lhs or rhs are 'this'
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const rx = rhs.x;
    const ry = rhs.y;
    const rz = rhs.z;
    this.x = ly * rz - ry * lz;
    this.y = lz * rx - rz * lx;
    this.z = lx * ry - rx * ly;
    return this;
  }

  /**
   * Returns the distance between the two specified 3-dimensional vectors.
   *
   * @param {Vec3} rhs - The second 3-dimensional vector to test.
   * @returns {number} The distance between the two vectors.
   * @example
   * const v1 = new pc.Vec3(5, 10, 20);
   * const v2 = new pc.Vec3(10, 20, 40);
   * const d = v1.distance(v2);
   * console.log("The distance between v1 and v2 is: " + d);
   */
  distance(rhs) {
    const x = this.x - rhs.x;
    const y = this.y - rhs.y;
    const z = this.z - rhs.z;
    return Math.sqrt(x * x + y * y + z * z);
  }

  /**
   * Divides a 3-dimensional vector by another in place.
   *
   * @param {Vec3} rhs - The vector to divide the specified vector by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(4, 9, 16);
   * const b = new pc.Vec3(2, 3, 4);
   *
   * a.div(b);
   *
   * // Outputs [2, 3, 4]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    this.z /= rhs.z;
    return this;
  }

  /**
   * Divides one 3-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec3} lhs - The dividend vector (the vector being divided).
   * @param {Vec3} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(4, 9, 16);
   * const b = new pc.Vec3(2, 3, 4);
   * const r = new pc.Vec3();
   *
   * r.div2(a, b);
   * // Outputs [2, 3, 4]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    this.z = lhs.z / rhs.z;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 6, 9);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2, 3]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 3-dimensional
   * vectors.
   *
   * @param {Vec3} rhs - The second 3-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * const v1 = new pc.Vec3(5, 10, 20);
   * const v2 = new pc.Vec3(10, 20, 40);
   * const v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec3} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec3(1, 2, 3);
   * const b = new pc.Vec3(4, 5, 6);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }

  /**
   * Reports whether two vectors are equal using an absolute error tolerance.
   *
   * @param {Vec3} rhs - The vector to be compared against.
   * @param {number} [epsilon] - The maximum difference between each component of the two
   * vectors. Defaults to 1e-6.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec3();
   * const b = new pc.Vec3();
   * console.log("The two vectors are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
   */
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon;
  }

  /**
   * Returns the magnitude of the specified 3-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 3-dimensional vector.
   * @example
   * const vec = new pc.Vec3(3, 4, 0);
   * const len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Returns the magnitude squared of the specified 3-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 3-dimensional vector.
   * @example
   * const vec = new pc.Vec3(3, 4, 0);
   * const len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Returns the result of a linear interpolation between two specified 3-dimensional vectors.
   *
   * @param {Vec3} lhs - The 3-dimensional to interpolate from.
   * @param {Vec3} rhs - The 3-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(0, 0, 0);
   * const b = new pc.Vec3(10, 10, 10);
   * const r = new pc.Vec3();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    this.z = lhs.z + alpha * (rhs.z - lhs.z);
    return this;
  }

  /**
   * Multiplies a 3-dimensional vector to another in place.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(2, 3, 4);
   * const b = new pc.Vec3(4, 5, 6);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15, 24
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    this.z *= rhs.z;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 3-dimensional vectors together.
   *
   * @param {Vec3} lhs - The 3-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(2, 3, 4);
   * const b = new pc.Vec3(4, 5, 6);
   * const r = new pc.Vec3();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15, 24
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    this.z = lhs.z * rhs.z;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 6, 9);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18, 27]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  /**
   * Returns this 3-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @param {Vec3} [src] - The vector to normalize. If not set, the operation is done in place.
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3(25, 0, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize(src = this) {
    const lengthSq = src.x * src.x + src.y * src.y + src.z * src.z;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x = src.x * invLength;
      this.y = src.y * invLength;
      this.z = src.z * invLength;
    }
    return this;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @param {Vec3} [src] - The vector to floor. If not set, the operation is done in place.
   * @returns {Vec3} Self for chaining.
   */
  floor(src = this) {
    this.x = Math.floor(src.x);
    this.y = Math.floor(src.y);
    this.z = Math.floor(src.z);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @param {Vec3} [src] - The vector to ceil. If not set, the operation is done in place.
   * @returns {Vec3} Self for chaining.
   */
  ceil(src = this) {
    this.x = Math.ceil(src.x);
    this.y = Math.ceil(src.y);
    this.z = Math.ceil(src.z);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @param {Vec3} [src] - The vector to round. If not set, the operation is done in place.
   * @returns {Vec3} Self for chaining.
   */
  round(src = this) {
    this.x = Math.round(src.x);
    this.y = Math.round(src.y);
    this.z = Math.round(src.z);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
   * @returns {Vec3} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    if (rhs.z < this.z) this.z = rhs.z;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
   * @returns {Vec3} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    if (rhs.z > this.z) this.z = rhs.z;
    return this;
  }

  /**
   * Projects this 3-dimensional vector onto the specified vector.
   *
   * @param {Vec3} rhs - The vector onto which the original vector will be projected on.
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3(5, 5, 5);
   * const normal = new pc.Vec3(1, 0, 0);
   *
   * v.project(normal);
   *
   * // Outputs 5, 0, 0
   * console.log("The result of the vector projection is: " + v.toString());
   */
  project(rhs) {
    const a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    const b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
    const s = a_dot_b / b_dot_b;
    this.x = rhs.x * s;
    this.y = rhs.y * s;
    this.z = rhs.z * s;
    return this;
  }

  /**
   * Sets the specified 3-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @param {number} z - The value to set on the third component of the vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3();
   * v.set(5, 10, 20);
   *
   * // Outputs 5, 10, 20
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Subtracts a 3-dimensional vector from another in place.
   *
   * @param {Vec3} rhs - The vector to subtract from the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    this.z -= rhs.z;
    return this;
  }

  /**
   * Subtracts two 3-dimensional vectors from one another and returns the result.
   *
   * @param {Vec3} lhs - The first vector operand for the subtraction.
   * @param {Vec3} rhs - The second vector operand for the subtraction.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   * const r = new pc.Vec3();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    this.z = lhs.z - rhs.z;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 4, 5);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2, 3]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * const v = new pc.Vec3(20, 10, 5);
   * // Outputs [20, 10, 5]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}]`;
  }

  /**
   * A constant vector set to [0, 0, 0].
   *
   * @type {Vec3}
   * @readonly
   */
}
_class = Vec3;
Vec3.ZERO = Object.freeze(new _class(0, 0, 0));
/**
 * A constant vector set to [1, 1, 1].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.ONE = Object.freeze(new _class(1, 1, 1));
/**
 * A constant vector set to [0, 1, 0].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.UP = Object.freeze(new _class(0, 1, 0));
/**
 * A constant vector set to [0, -1, 0].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.DOWN = Object.freeze(new _class(0, -1, 0));
/**
 * A constant vector set to [1, 0, 0].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.RIGHT = Object.freeze(new _class(1, 0, 0));
/**
 * A constant vector set to [-1, 0, 0].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.LEFT = Object.freeze(new _class(-1, 0, 0));
/**
 * A constant vector set to [0, 0, -1].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.FORWARD = Object.freeze(new _class(0, 0, -1));
/**
 * A constant vector set to [0, 0, 1].
 *
 * @type {Vec3}
 * @readonly
 */
Vec3.BACK = Object.freeze(new _class(0, 0, 1));

export { Vec3 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjMy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWMzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gKlxuICogQGNhdGVnb3J5IE1hdGhcbiAqL1xuY2xhc3MgVmVjMyB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0aGlyZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgejtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgVmVjMyBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXX0gW3hdIC0gVGhlIHggdmFsdWUuIERlZmF1bHRzIHRvIDAuIElmIHggaXMgYW4gYXJyYXkgb2YgbGVuZ3RoIDMsIHRoZVxuICAgICAqIGFycmF5IHdpbGwgYmUgdXNlZCB0byBwb3B1bGF0ZSBhbGwgY29tcG9uZW50cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHkgdmFsdWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMzKDEsIDIsIDMpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHggPSAwLCB5ID0gMCwgeiA9IDApIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHZlY3RvciB0byBhZGQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyMCwgMjAsIDIwKTtcbiAgICAgKlxuICAgICAqIGEuYWRkKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwLCAzMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkKHJocykge1xuICAgICAgICB0aGlzLnggKz0gcmhzLng7XG4gICAgICAgIHRoaXMueSArPSByaHMueTtcbiAgICAgICAgdGhpcy56ICs9IHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdHdvIDMtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlciBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoMTAsIDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMzKDIwLCAyMCwgMjApO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqXG4gICAgICogci5hZGQyKGEsIGIpO1xuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMCwgMzBdXG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkMihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCArIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSArIHJocy55O1xuICAgICAgICB0aGlzLnogPSBsaHMueiArIHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBudW1iZXIgdG8gZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gYWRkLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMzKDMsIDQsIDUpO1xuICAgICAqXG4gICAgICogdmVjLmFkZFNjYWxhcigyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzUsIDYsIDddXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggKz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgKz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnogKz0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBzY2FsZWQgYnkgc2NhbGFyIHZhbHVlLiBEb2VzIG5vdCBtb2RpZnkgdGhlIHZlY3RvciBiZWluZyBhZGRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHZlY3RvciB0byBhZGQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gbXVsdGlwbHkgdGhlIGFkZGVkIHZlY3RvciB3aXRoLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMzKDEsIDIsIDMpO1xuICAgICAqXG4gICAgICogdmVjLmFkZFNjYWxlZChwYy5WZWMzLlVQLCAyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzEsIDQsIDNdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkU2NhbGVkKHJocywgc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCArPSByaHMueCAqIHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICs9IHJocy55ICogc2NhbGFyO1xuICAgICAgICB0aGlzLnogKz0gcmhzLnogKiBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgY29udGFpbmluZyB0aGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMzKDEwLCAyMCwgMzApO1xuICAgICAqIGNvbnN0IHZjbG9uZSA9IHYuY2xvbmUoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgdmNsb25lLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICAvKiogQHR5cGUge3RoaXN9ICovXG4gICAgICAgIGNvbnN0IGNzdHIgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgICAgICByZXR1cm4gbmV3IGNzdHIodGhpcy54LCB0aGlzLnksIHRoaXMueik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBhIGRlc3RpbmF0aW9uIDMtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBBIHZlY3RvciB0byBjb3B5IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNyYyA9IG5ldyBwYy5WZWMzKDEwLCAyMCwgMzApO1xuICAgICAqIGNvbnN0IGRzdCA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICpcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGRzdC5lcXVhbHMoc3JjKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLnggPSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBhIGNyb3NzIHByb2R1Y3Qgb3BlcmF0aW9uIHBlcmZvcm1lZCBvbiB0aGUgdHdvIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsXG4gICAgICogdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbGhzIC0gVGhlIGZpcnN0IDMtZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGNyb3NzIHByb2R1Y3QuXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgc2Vjb25kIDMtZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGNyb3NzIHByb2R1Y3QuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYmFjayA9IG5ldyBwYy5WZWMzKCkuY3Jvc3MocGMuVmVjMy5SSUdIVCwgcGMuVmVjMy5VUCk7XG4gICAgICpcbiAgICAgKiAvLyBQcmludHMgdGhlIFogYXhpcyAoaS5lLiBbMCwgMCwgMV0pXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjcm9zcyBwcm9kdWN0IGlzOiBcIiArIGJhY2sudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgY3Jvc3MobGhzLCByaHMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIHRlbXBvcmFyeSB2YXJpYWJsZXMgaW4gY2FzZSBsaHMgb3IgcmhzIGFyZSAndGhpcydcbiAgICAgICAgY29uc3QgbHggPSBsaHMueDtcbiAgICAgICAgY29uc3QgbHkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgbHogPSBsaHMuejtcbiAgICAgICAgY29uc3QgcnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcnogPSByaHMuejtcblxuICAgICAgICB0aGlzLnggPSBseSAqIHJ6IC0gcnkgKiBsejtcbiAgICAgICAgdGhpcy55ID0gbHogKiByeCAtIHJ6ICogbHg7XG4gICAgICAgIHRoaXMueiA9IGx4ICogcnkgLSByeCAqIGx5O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byBzcGVjaWZpZWQgMy1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgc2Vjb25kIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byB2ZWN0b3JzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdjEgPSBuZXcgcGMuVmVjMyg1LCAxMCwgMjApO1xuICAgICAqIGNvbnN0IHYyID0gbmV3IHBjLlZlYzMoMTAsIDIwLCA0MCk7XG4gICAgICogY29uc3QgZCA9IHYxLmRpc3RhbmNlKHYyKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBkaXN0YW5jZSBiZXR3ZWVuIHYxIGFuZCB2MiBpczogXCIgKyBkKTtcbiAgICAgKi9cbiAgICBkaXN0YW5jZShyaHMpIHtcbiAgICAgICAgY29uc3QgeCA9IHRoaXMueCAtIHJocy54O1xuICAgICAgICBjb25zdCB5ID0gdGhpcy55IC0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHogPSB0aGlzLnogLSByaHMuejtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh4ICogeCArIHkgKiB5ICsgeiAqIHopO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgdmVjdG9yIHRvIGRpdmlkZSB0aGUgc3BlY2lmaWVkIHZlY3RvciBieS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoNCwgOSwgMTYpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyLCAzLCA0KTtcbiAgICAgKlxuICAgICAqIGEuZGl2KGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMiwgMywgNF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2KHJocykge1xuICAgICAgICB0aGlzLnggLz0gcmhzLng7XG4gICAgICAgIHRoaXMueSAvPSByaHMueTtcbiAgICAgICAgdGhpcy56IC89IHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgb25lIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGFub3RoZXIgYW5kIHdyaXRlcyB0aGUgcmVzdWx0IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBsaHMgLSBUaGUgZGl2aWRlbmQgdmVjdG9yICh0aGUgdmVjdG9yIGJlaW5nIGRpdmlkZWQpLlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIGRpdmlzb3IgdmVjdG9yICh0aGUgdmVjdG9yIGRpdmlkaW5nIHRoZSBkaXZpZGVuZCkuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDQsIDksIDE2KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoMiwgMywgNCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICpcbiAgICAgKiByLmRpdjIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMiwgMywgNF1cbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXYyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC8gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC8gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56IC8gcmhzLno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IgYnkgYSBudW1iZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBkaXZpZGUgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzMoMywgNiwgOSk7XG4gICAgICpcbiAgICAgKiB2ZWMuZGl2U2NhbGFyKDMpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMSwgMiwgM11cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXZTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiAvPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgZG90IHByb2R1Y3Qgb3BlcmF0aW9uIHBlcmZvcm1lZCBvbiB0aGUgdHdvIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsXG4gICAgICogdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHNlY29uZCAzLWRpbWVuc2lvbmFsIHZlY3RvciBvcGVyYW5kIG9mIHRoZSBkb3QgcHJvZHVjdC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgcmVzdWx0IG9mIHRoZSBkb3QgcHJvZHVjdCBvcGVyYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2MSA9IG5ldyBwYy5WZWMzKDUsIDEwLCAyMCk7XG4gICAgICogY29uc3QgdjIgPSBuZXcgcGMuVmVjMygxMCwgMjAsIDQwKTtcbiAgICAgKiBjb25zdCB2MWRvdHYyID0gdjEuZG90KHYyKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IGlzOiBcIiArIHYxZG90djIpO1xuICAgICAqL1xuICAgIGRvdChyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHJocy54ICsgdGhpcy55ICogcmhzLnkgKyB0aGlzLnogKiByaHMuejtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHZlY3RvcnMgYXJlIGVxdWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgdmVjdG9yIHRvIGNvbXBhcmUgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMzKDQsIDUsIDYpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggPT09IHJocy54ICYmIHRoaXMueSA9PT0gcmhzLnkgJiYgdGhpcy56ID09PSByaHMuejtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHZlY3RvcnMgYXJlIGVxdWFsIHVzaW5nIGFuIGFic29sdXRlIGVycm9yIHRvbGVyYW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHZlY3RvciB0byBiZSBjb21wYXJlZCBhZ2FpbnN0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZXBzaWxvbl0gLSBUaGUgbWF4aW11bSBkaWZmZXJlbmNlIGJldHdlZW4gZWFjaCBjb21wb25lbnQgb2YgdGhlIHR3b1xuICAgICAqIHZlY3RvcnMuIERlZmF1bHRzIHRvIDFlLTYuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gdmVjdG9ycyBhcmUgYXBwcm94aW1hdGVseSBcIiArIChhLmVxdWFsc0FwcHJveChiLCAxZS05KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHNBcHByb3gocmhzLCBlcHNpbG9uID0gMWUtNikge1xuICAgICAgICByZXR1cm4gKE1hdGguYWJzKHRoaXMueCAtIHJocy54KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy55IC0gcmhzLnkpIDwgZXBzaWxvbikgJiZcbiAgICAgICAgICAgIChNYXRoLmFicyh0aGlzLnogLSByaHMueikgPCBlcHNpbG9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMzKDMsIDQsIDApO1xuICAgICAqIGNvbnN0IGxlbiA9IHZlYy5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHZlY3RvciBpczogXCIgKyBsZW4pO1xuICAgICAqL1xuICAgIGxlbmd0aCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnopO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG1hZ25pdHVkZSBzcXVhcmVkIG9mIHRoZSBzcGVjaWZpZWQgMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMygzLCA0LCAwKTtcbiAgICAgKiBjb25zdCBsZW4gPSB2ZWMubGVuZ3RoU3EoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDI1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIHNxdWFyZWQgb2YgdGhlIHZlY3RvciBpczogXCIgKyBsZW4pO1xuICAgICAqL1xuICAgIGxlbmd0aFNxKCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBhIGxpbmVhciBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGxocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHRvIGludGVycG9sYXRlIGZyb20uXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgMy1kaW1lbnNpb25hbCB0byBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIHBvaW50IG9mIGludGVycG9sYXRpb24uIEJldHdlZW4gMCBhbmQgMSxcbiAgICAgKiB0aGUgbGluZWFyIGludGVycG9sYW50IHdpbGwgb2NjdXIgb24gYSBzdHJhaWdodCBsaW5lIGJldHdlZW4gbGhzIGFuZCByaHMuIE91dHNpZGUgb2YgdGhpc1xuICAgICAqIHJhbmdlLCB0aGUgbGluZWFyIGludGVycG9sYW50IHdpbGwgb2NjdXIgb24gYSByYXkgZXh0cmFwb2xhdGVkIGZyb20gdGhpcyBsaW5lLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoMTAsIDEwLCAxMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICpcbiAgICAgKiByLmxlcnAoYSwgYiwgMCk7ICAgLy8gciBpcyBlcXVhbCB0byBhXG4gICAgICogci5sZXJwKGEsIGIsIDAuNSk7IC8vIHIgaXMgNSwgNSwgNVxuICAgICAqIHIubGVycChhLCBiLCAxKTsgICAvLyByIGlzIGVxdWFsIHRvIGJcbiAgICAgKi9cbiAgICBsZXJwKGxocywgcmhzLCBhbHBoYSkge1xuICAgICAgICB0aGlzLnggPSBsaHMueCArIGFscGhhICogKHJocy54IC0gbGhzLngpO1xuICAgICAgICB0aGlzLnkgPSBsaHMueSArIGFscGhhICogKHJocy55IC0gbGhzLnkpO1xuICAgICAgICB0aGlzLnogPSBsaHMueiArIGFscGhhICogKHJocy56IC0gbGhzLnopO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygyLCAzLCA0KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoNCwgNSwgNik7XG4gICAgICpcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTUsIDI0XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bChyaHMpIHtcbiAgICAgICAgdGhpcy54ICo9IHJocy54O1xuICAgICAgICB0aGlzLnkgKj0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAqPSByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGxocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDIsIDMsIDQpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMyg0LCA1LCA2KTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTUsIDI0XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKiByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKiByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKiByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGVhY2ggZWxlbWVudCBvZiBhIHZlY3RvciBieSBhIG51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIG11bHRpcGx5IGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMzKDMsIDYsIDkpO1xuICAgICAqXG4gICAgICogdmVjLm11bFNjYWxhcigzKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzksIDE4LCAyN11cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWxTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAqPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAqPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiAqPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGlzIDMtZGltZW5zaW9uYWwgdmVjdG9yIGNvbnZlcnRlZCB0byBhIHVuaXQgdmVjdG9yIGluIHBsYWNlLiBJZiB0aGUgdmVjdG9yIGhhcyBhXG4gICAgICogbGVuZ3RoIG9mIHplcm8sIHRoZSB2ZWN0b3IncyBlbGVtZW50cyB3aWxsIGJlIHNldCB0byB6ZXJvLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbc3JjXSAtIFRoZSB2ZWN0b3IgdG8gbm9ybWFsaXplLiBJZiBub3Qgc2V0LCB0aGUgb3BlcmF0aW9uIGlzIGRvbmUgaW4gcGxhY2UuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMzKDI1LCAwLCAwKTtcbiAgICAgKlxuICAgICAqIHYubm9ybWFsaXplKCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDEsIDAsIDBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBub3JtYWxpemF0aW9uIGlzOiBcIiArIHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbm9ybWFsaXplKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgY29uc3QgbGVuZ3RoU3EgPSBzcmMueCAqIHNyYy54ICsgc3JjLnkgKiBzcmMueSArIHNyYy56ICogc3JjLno7XG4gICAgICAgIGlmIChsZW5ndGhTcSA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGludkxlbmd0aCA9IDEgLyBNYXRoLnNxcnQobGVuZ3RoU3EpO1xuICAgICAgICAgICAgdGhpcy54ID0gc3JjLnggKiBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgPSBzcmMueSAqIGludkxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMueiA9IHNyYy56ICogaW52TGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHNldCB0byB0aGUgbGFyZ2VzdCBpbnRlZ2VyIGxlc3MgdGhhbiBvciBlcXVhbCB0byBpdHMgdmFsdWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtzcmNdIC0gVGhlIHZlY3RvciB0byBmbG9vci4gSWYgbm90IHNldCwgdGhlIG9wZXJhdGlvbiBpcyBkb25lIGluIHBsYWNlLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBmbG9vcihzcmMgPSB0aGlzKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGguZmxvb3Ioc3JjLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLmZsb29yKHNyYy55KTtcbiAgICAgICAgdGhpcy56ID0gTWF0aC5mbG9vcihzcmMueik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIHRvIHRoZSBuZXh0IGxhcmdlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3NyY10gLSBUaGUgdmVjdG9yIHRvIGNlaWwuIElmIG5vdCBzZXQsIHRoZSBvcGVyYXRpb24gaXMgZG9uZSBpbiBwbGFjZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY2VpbChzcmMgPSB0aGlzKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGguY2VpbChzcmMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguY2VpbChzcmMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGguY2VpbChzcmMueik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIG9yIGRvd24gdG8gdGhlIG5lYXJlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3NyY10gLSBUaGUgdmVjdG9yIHRvIHJvdW5kLiBJZiBub3Qgc2V0LCB0aGUgb3BlcmF0aW9uIGlzIGRvbmUgaW4gcGxhY2UuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHJvdW5kKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5yb3VuZChzcmMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQoc3JjLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLnJvdW5kKHNyYy56KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIGFzc2lnbmVkIGEgdmFsdWUgZnJvbSByaHMgcGFyYW1ldGVyIGlmIGl0IGlzIHNtYWxsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzb3VyY2Ugb2YgZWxlbWVudHMgdG8gY29tcGFyZSB0by5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgbWluKHJocykge1xuICAgICAgICBpZiAocmhzLnggPCB0aGlzLngpIHRoaXMueCA9IHJocy54O1xuICAgICAgICBpZiAocmhzLnkgPCB0aGlzLnkpIHRoaXMueSA9IHJocy55O1xuICAgICAgICBpZiAocmhzLnogPCB0aGlzLnopIHRoaXMueiA9IHJocy56O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgYXNzaWduZWQgYSB2YWx1ZSBmcm9tIHJocyBwYXJhbWV0ZXIgaWYgaXQgaXMgbGFyZ2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc291cmNlIG9mIGVsZW1lbnRzIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG1heChyaHMpIHtcbiAgICAgICAgaWYgKHJocy54ID4gdGhpcy54KSB0aGlzLnggPSByaHMueDtcbiAgICAgICAgaWYgKHJocy55ID4gdGhpcy55KSB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgaWYgKHJocy56ID4gdGhpcy56KSB0aGlzLnogPSByaHMuejtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvamVjdHMgdGhpcyAzLWRpbWVuc2lvbmFsIHZlY3RvciBvbnRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgdmVjdG9yIG9udG8gd2hpY2ggdGhlIG9yaWdpbmFsIHZlY3RvciB3aWxsIGJlIHByb2plY3RlZCBvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoNSwgNSwgNSk7XG4gICAgICogY29uc3Qgbm9ybWFsID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICpcbiAgICAgKiB2LnByb2plY3Qobm9ybWFsKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgNSwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHByb2plY3Rpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBwcm9qZWN0KHJocykge1xuICAgICAgICBjb25zdCBhX2RvdF9iID0gdGhpcy54ICogcmhzLnggKyB0aGlzLnkgKiByaHMueSArIHRoaXMueiAqIHJocy56O1xuICAgICAgICBjb25zdCBiX2RvdF9iID0gcmhzLnggKiByaHMueCArIHJocy55ICogcmhzLnkgKyByaHMueiAqIHJocy56O1xuICAgICAgICBjb25zdCBzID0gYV9kb3RfYiAvIGJfZG90X2I7XG4gICAgICAgIHRoaXMueCA9IHJocy54ICogcztcbiAgICAgICAgdGhpcy55ID0gcmhzLnkgKiBzO1xuICAgICAgICB0aGlzLnogPSByaHMueiAqIHM7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgZmlyc3QgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBzZWNvbmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSB0aGlyZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2LnNldCg1LCAxMCwgMjApO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA1LCAxMCwgMjBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBzZXQgaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzZXQoeCwgeSwgeikge1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB0aGlzLnogPSB6O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGZyb20gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHZlY3RvciB0byBzdWJ0cmFjdCBmcm9tIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoMjAsIDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLnN1YihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWy0xMCwgLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YihyaHMpIHtcbiAgICAgICAgdGhpcy54IC09IHJocy54O1xuICAgICAgICB0aGlzLnkgLT0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAtPSByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdHMgdHdvIDMtZGltZW5zaW9uYWwgdmVjdG9ycyBmcm9tIG9uZSBhbm90aGVyIGFuZCByZXR1cm5zIHRoZSByZXN1bHQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGxocyAtIFRoZSBmaXJzdCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIHN1YnRyYWN0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIHNlY29uZCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIHN1YnRyYWN0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoMjAsIDIwLCAyMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICpcbiAgICAgKiByLnN1YjIoYSwgYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFstMTAsIC0xMCwgLTEwXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWIyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56IC0gcmhzLno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgbnVtYmVyIGZyb20gZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gc3VidHJhY3QuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzMoMywgNCwgNSk7XG4gICAgICpcbiAgICAgKiB2ZWMuc3ViU2NhbGFyKDIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMSwgMiwgM11cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHN1YnRyYWN0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWJTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAtPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAtPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiAtPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHZlY3RvciB0byBzdHJpbmcgZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSB2ZWN0b3IgaW4gc3RyaW5nIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoMjAsIDEwLCA1KTtcbiAgICAgKiAvLyBPdXRwdXRzIFsyMCwgMTAsIDVdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbJHt0aGlzLnh9LCAke3RoaXMueX0sICR7dGhpcy56fV1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgMCwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgWkVSTyA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMCwgMCwgMCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFsxLCAxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBPTkUgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMzKDEsIDEsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgMSwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgVVAgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMzKDAsIDEsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgLTEsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIERPV04gPSBPYmplY3QuZnJlZXplKG5ldyBWZWMzKDAsIC0xLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzEsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFJJR0hUID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMygxLCAwLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWy0xLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBMRUZUID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMygtMSwgMCwgMCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAwLCAtMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgRk9SV0FSRCA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMCwgMCwgLTEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMCwgMCwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgQkFDSyA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMCwgMCwgMSkpO1xufVxuXG5leHBvcnQgeyBWZWMzIH07XG4iXSwibmFtZXMiOlsiVmVjMyIsImNvbnN0cnVjdG9yIiwieCIsInkiLCJ6IiwibGVuZ3RoIiwiYWRkIiwicmhzIiwiYWRkMiIsImxocyIsImFkZFNjYWxhciIsInNjYWxhciIsImFkZFNjYWxlZCIsImNsb25lIiwiY3N0ciIsImNvcHkiLCJjcm9zcyIsImx4IiwibHkiLCJseiIsInJ4IiwicnkiLCJyeiIsImRpc3RhbmNlIiwiTWF0aCIsInNxcnQiLCJkaXYiLCJkaXYyIiwiZGl2U2NhbGFyIiwiZG90IiwiZXF1YWxzIiwiZXF1YWxzQXBwcm94IiwiZXBzaWxvbiIsImFicyIsImxlbmd0aFNxIiwibGVycCIsImFscGhhIiwibXVsIiwibXVsMiIsIm11bFNjYWxhciIsIm5vcm1hbGl6ZSIsInNyYyIsImludkxlbmd0aCIsImZsb29yIiwiY2VpbCIsInJvdW5kIiwibWluIiwibWF4IiwicHJvamVjdCIsImFfZG90X2IiLCJiX2RvdF9iIiwicyIsInNldCIsInN1YiIsInN1YjIiLCJzdWJTY2FsYXIiLCJ0b1N0cmluZyIsIl9jbGFzcyIsIlpFUk8iLCJPYmplY3QiLCJm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QUssQ0FBQ0osR0FBRyxDQUFDckMsQ0FBQyxDQUFDLENBQUE7QUFDMUIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0kwQyxHQUFHQSxDQUFDdkMsR0FBRyxFQUFFO0FBQ0wsSUFBQSxJQUFJQSxHQUFHLENBQUNMLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSyxHQUFHLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ksR0FBRyxDQUFDSixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSSxHQUFHLENBQUNILENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFDbEMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0kyQyxHQUFHQSxDQUFDeEMsR0FBRyxFQUFFO0FBQ0wsSUFBQSxJQUFJQSxHQUFHLENBQUNMLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSyxHQUFHLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ksR0FBRyxDQUFDSixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSSxHQUFHLENBQUNILENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFDbEMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJNEMsT0FBT0EsQ0FBQ3pDLEdBQUcsRUFBRTtJQUNULE1BQU0wQyxPQUFPLEdBQUcsSUFBSSxDQUFDL0MsQ0FBQyxHQUFHSyxHQUFHLENBQUNMLENBQUMsR0FBRyxJQUFJLENBQUNDLENBQUMsR0FBR0ksR0FBRyxDQUFDSixDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUdHLEdBQUcsQ0FBQ0gsQ0FBQyxDQUFBO0lBQ2hFLE1BQU04QyxPQUFPLEdBQUczQyxHQUFHLENBQUNMLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLEdBQUdLLEdBQUcsQ0FBQ0osQ0FBQyxHQUFHSSxHQUFHLENBQUNKLENBQUMsR0FBR0ksR0FBRyxDQUFDSCxDQUFDLEdBQUdHLEdBQUcsQ0FBQ0gsQ0FBQyxDQUFBO0FBQzdELElBQUEsTUFBTStDLENBQUMsR0FBR0YsT0FBTyxHQUFHQyxPQUFPLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNoRCxDQUFDLEdBQUdLLEdBQUcsQ0FBQ0wsQ0FBQyxHQUFHaUQsQ0FBQyxDQUFBO0FBQ2xCLElBQUEsSUFBSSxDQUFDaEQsQ0FBQyxHQUFHSSxHQUFHLENBQUNKLENBQUMsR0FBR2dELENBQUMsQ0FBQTtBQUNsQixJQUFBLElBQUksQ0FBQy9DLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLEdBQUcrQyxDQUFDLENBQUE7QUFDbEIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxHQUFHQSxDQUFDbEQsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRTtJQUNULElBQUksQ0FBQ0YsQ0FBQyxHQUFHQSxDQUFDLENBQUE7SUFDVixJQUFJLENBQUNDLENBQUMsR0FBR0EsQ0FBQyxDQUFBO0lBQ1YsSUFBSSxDQUFDQyxDQUFDLEdBQUdBLENBQUMsQ0FBQTtBQUVWLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWlELEdBQUdBLENBQUM5QyxHQUFHLEVBQUU7QUFDTCxJQUFBLElBQUksQ0FBQ0wsQ0FBQyxJQUFJSyxHQUFHLENBQUNMLENBQUMsQ0FBQTtBQUNmLElBQUEsSUFBSSxDQUFDQyxDQUFDLElBQUlJLEdBQUcsQ0FBQ0osQ0FBQyxDQUFBO0FBQ2YsSUFBQSxJQUFJLENBQUNDLENBQUMsSUFBSUcsR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFFZixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJa0QsRUFBQUEsSUFBSUEsQ0FBQzdDLEdBQUcsRUFBRUYsR0FBRyxFQUFFO0lBQ1gsSUFBSSxDQUFDTCxDQUFDLEdBQUdPLEdBQUcsQ0FBQ1AsQ0FBQyxHQUFHSyxHQUFHLENBQUNMLENBQUMsQ0FBQTtJQUN0QixJQUFJLENBQUNDLENBQUMsR0FBR00sR0FBRyxDQUFDTixDQUFDLEdBQUdJLEdBQUcsQ0FBQ0osQ0FBQyxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsQ0FBQyxHQUFHSyxHQUFHLENBQUNMLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFFdEIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSW1ELFNBQVNBLENBQUM1QyxNQUFNLEVBQUU7SUFDZCxJQUFJLENBQUNULENBQUMsSUFBSVMsTUFBTSxDQUFBO0lBQ2hCLElBQUksQ0FBQ1IsQ0FBQyxJQUFJUSxNQUFNLENBQUE7SUFDaEIsSUFBSSxDQUFDUCxDQUFDLElBQUlPLE1BQU0sQ0FBQTtBQUVoQixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTZDLEVBQUFBLFFBQVFBLEdBQUc7QUFDUCxJQUFBLE9BQVEsQ0FBRyxDQUFBLEVBQUEsSUFBSSxDQUFDdEQsQ0FBRSxDQUFJLEVBQUEsRUFBQSxJQUFJLENBQUNDLENBQUUsQ0FBSSxFQUFBLEVBQUEsSUFBSSxDQUFDQyxDQUFFLENBQUUsQ0FBQSxDQUFBLENBQUE7QUFDOUMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUEwREEsQ0FBQTtBQUFDcUQsTUFBQSxHQTV0Qkt6RCxJQUFJLENBQUE7QUFBSkEsSUFBSSxDQW1xQkMwRCxJQUFJLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUk1RCxNQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRTlDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQTFxQk1BLElBQUksQ0EycUJDNkQsR0FBRyxHQUFHRixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJNUQsTUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUU3QztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFsckJNQSxJQUFJLENBbXJCQzhELEVBQUUsR0FBR0gsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSTVELE1BQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFNUM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBMXJCTUEsSUFBSSxDQTJyQkMrRCxJQUFJLEdBQUdKLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUk1RCxNQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFL0M7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBbHNCTUEsSUFBSSxDQW1zQkNnRSxLQUFLLEdBQUdMLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUk1RCxNQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRS9DO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQTFzQk1BLElBQUksQ0Eyc0JDaUUsSUFBSSxHQUFHTixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJNUQsTUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRS9DO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQWx0Qk1BLElBQUksQ0FtdEJDa0UsT0FBTyxHQUFHUCxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJNUQsTUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRWxEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQTF0Qk1BLElBQUksQ0EydEJDbUUsSUFBSSxHQUFHUixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJNUQsTUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Ozs7In0=
