var _class;
/**
 * A 4-dimensional vector.
 *
 * @category Math
 */
class Vec4 {
  /**
   * Creates a new Vec4 object.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 4, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @param {number} [z] - The z value. Defaults to 0.
   * @param {number} [w] - The w value. Defaults to 0.
   * @example
   * const v = new pc.Vec4(1, 2, 3, 4);
   */
  constructor(x = 0, y = 0, z = 0, w = 0) {
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
    /**
     * The fourth component of the vector.
     *
     * @type {number}
     */
    this.w = void 0;
    if (x.length === 4) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
      this.w = x[3];
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  }

  /**
   * Adds a 4-dimensional vector to another in place.
   *
   * @param {Vec4} rhs - The vector to add to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
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
    this.w += rhs.w;
    return this;
  }

  /**
   * Adds two 4-dimensional vectors together and returns the result.
   *
   * @param {Vec4} lhs - The first vector operand for the addition.
   * @param {Vec4} rhs - The second vector operand for the addition.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
   * const r = new pc.Vec4();
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
    this.w = lhs.w + rhs.w;
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec4} Self for chaining.
   * @example
   * const vec = new pc.Vec4(3, 4, 5, 6);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6, 7, 8]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    this.w += scalar;
    return this;
  }

  /**
   * Adds a 4-dimensional vector scaled by scalar value. Does not modify the vector being added.
   *
   * @param {Vec4} rhs - The vector to add to the specified vector.
   * @param {number} scalar - The number to multiply the added vector with.
   * @returns {Vec4} Self for chaining.
   * @example
   * const vec = new pc.Vec4(1, 2, 3, 4);
   *
   * vec.addScaled(pc.Vec4.ONE, 2);
   *
   * // Outputs [3, 4, 5, 6]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScaled(rhs, scalar) {
    this.x += rhs.x * scalar;
    this.y += rhs.y * scalar;
    this.z += rhs.z * scalar;
    this.w += rhs.w * scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 4-dimensional vector.
   *
   * @returns {this} A 4-dimensional vector containing the result of the cloning.
   * @example
   * const v = new pc.Vec4(10, 20, 30, 40);
   * const vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z, this.w);
  }

  /**
   * Copies the contents of a source 4-dimensional vector to a destination 4-dimensional vector.
   *
   * @param {Vec4} rhs - A vector to copy to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * const src = new pc.Vec4(10, 20, 30, 40);
   * const dst = new pc.Vec4();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this;
  }

  /**
   * Divides a 4-dimensional vector by another in place.
   *
   * @param {Vec4} rhs - The vector to divide the specified vector by.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(4, 9, 16, 25);
   * const b = new pc.Vec4(2, 3, 4, 5);
   *
   * a.div(b);
   *
   * // Outputs [2, 3, 4, 5]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    this.z /= rhs.z;
    this.w /= rhs.w;
    return this;
  }

  /**
   * Divides one 4-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec4} lhs - The dividend vector (the vector being divided).
   * @param {Vec4} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(4, 9, 16, 25);
   * const b = new pc.Vec4(2, 3, 4, 5);
   * const r = new pc.Vec4();
   *
   * r.div2(a, b);
   * // Outputs [2, 3, 4, 5]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    this.z = lhs.z / rhs.z;
    this.w = lhs.w / rhs.w;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec4} Self for chaining.
   * @example
   * const vec = new pc.Vec4(3, 6, 9, 12);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2, 3, 4]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    this.w /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 4-dimensional
   * vectors.
   *
   * @param {Vec4} rhs - The second 4-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * const v1 = new pc.Vec4(5, 10, 20, 40);
   * const v2 = new pc.Vec4(10, 20, 40, 80);
   * const v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z + this.w * rhs.w;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec4} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec4(1, 2, 3, 4);
   * const b = new pc.Vec4(5, 6, 7, 8);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
  }

  /**
   * Reports whether two vectors are equal using an absolute error tolerance.
   *
   * @param {Vec4} rhs - The vector to be compared against.
   * @param {number} [epsilon] - The maximum difference between each component of the two
   * vectors. Defaults to 1e-6.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec4();
   * const b = new pc.Vec4();
   * console.log("The two vectors are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
   */
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
  }

  /**
   * Returns the magnitude of the specified 4-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 4-dimensional vector.
   * @example
   * const vec = new pc.Vec4(3, 4, 0, 0);
   * const len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Returns the magnitude squared of the specified 4-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 4-dimensional vector.
   * @example
   * const vec = new pc.Vec4(3, 4, 0);
   * const len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Returns the result of a linear interpolation between two specified 4-dimensional vectors.
   *
   * @param {Vec4} lhs - The 4-dimensional to interpolate from.
   * @param {Vec4} rhs - The 4-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(0, 0, 0, 0);
   * const b = new pc.Vec4(10, 10, 10, 10);
   * const r = new pc.Vec4();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5, 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    this.z = lhs.z + alpha * (rhs.z - lhs.z);
    this.w = lhs.w + alpha * (rhs.w - lhs.w);
    return this;
  }

  /**
   * Multiplies a 4-dimensional vector to another in place.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(2, 3, 4, 5);
   * const b = new pc.Vec4(4, 5, 6, 7);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15, 24, 35
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    this.z *= rhs.z;
    this.w *= rhs.w;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 4-dimensional vectors together.
   *
   * @param {Vec4} lhs - The 4-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec4} rhs - The 4-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(2, 3, 4, 5);
   * const b = new pc.Vec4(4, 5, 6, 7);
   * const r = new pc.Vec4();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15, 24, 35
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    this.z = lhs.z * rhs.z;
    this.w = lhs.w * rhs.w;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec4} Self for chaining.
   * @example
   * const vec = new pc.Vec4(3, 6, 9, 12);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18, 27, 36]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }

  /**
   * Returns this 4-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @param {Vec4} [src] - The vector to normalize. If not set, the operation is done in place.
   * @returns {Vec4} Self for chaining.
   * @example
   * const v = new pc.Vec4(25, 0, 0, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0, 0, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize(src = this) {
    const lengthSq = src.x * src.x + src.y * src.y + src.z * src.z + src.w * src.w;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x = src.x * invLength;
      this.y = src.y * invLength;
      this.z = src.z * invLength;
      this.w = src.w * invLength;
    }
    return this;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @param {Vec4} [src] - The vector to floor. If not set, the operation is done in place.
   * @returns {Vec4} Self for chaining.
   */
  floor(src = this) {
    this.x = Math.floor(src.x);
    this.y = Math.floor(src.y);
    this.z = Math.floor(src.z);
    this.w = Math.floor(src.w);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @param {Vec4} [src] - The vector to ceil. If not set, the operation is done in place.
   * @returns {Vec4} Self for chaining.
   */
  ceil(src = this) {
    this.x = Math.ceil(src.x);
    this.y = Math.ceil(src.y);
    this.z = Math.ceil(src.z);
    this.w = Math.ceil(src.w);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @param {Vec4} [src] - The vector to round. If not set, the operation is done in place.
   * @returns {Vec4} Self for chaining.
   */
  round(src = this) {
    this.x = Math.round(src.x);
    this.y = Math.round(src.y);
    this.z = Math.round(src.z);
    this.w = Math.round(src.w);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the source of elements to compare to.
   * @returns {Vec4} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    if (rhs.z < this.z) this.z = rhs.z;
    if (rhs.w < this.w) this.w = rhs.w;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the source of elements to compare to.
   * @returns {Vec4} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    if (rhs.z > this.z) this.z = rhs.z;
    if (rhs.w > this.w) this.w = rhs.w;
    return this;
  }

  /**
   * Sets the specified 4-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @param {number} z - The value to set on the third component of the vector.
   * @param {number} w - The value to set on the fourth component of the vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * const v = new pc.Vec4();
   * v.set(5, 10, 20, 40);
   *
   * // Outputs 5, 10, 20, 40
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Subtracts a 4-dimensional vector from another in place.
   *
   * @param {Vec4} rhs - The vector to add to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10, -10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    this.z -= rhs.z;
    this.w -= rhs.w;
    return this;
  }

  /**
   * Subtracts two 4-dimensional vectors from one another and returns the result.
   *
   * @param {Vec4} lhs - The first vector operand for the subtraction.
   * @param {Vec4} rhs - The second vector operand for the subtraction.
   * @returns {Vec4} Self for chaining.
   * @example
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
   * const r = new pc.Vec4();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10, -10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    this.z = lhs.z - rhs.z;
    this.w = lhs.w - rhs.w;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec4} Self for chaining.
   * @example
   * const vec = new pc.Vec4(3, 4, 5, 6);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2, 3, 4]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    this.w -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * const v = new pc.Vec4(20, 10, 5, 0);
   * // Outputs [20, 10, 5, 0]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }

  /**
   * A constant vector set to [0, 0, 0, 0].
   *
   * @type {Vec4}
   * @readonly
   */
}
_class = Vec4;
Vec4.ZERO = Object.freeze(new _class(0, 0, 0, 0));
/**
 * A constant vector set to [1, 1, 1, 1].
 *
 * @type {Vec4}
 * @readonly
 */
Vec4.ONE = Object.freeze(new _class(1, 1, 1, 1));

export { Vec4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjNC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWM0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAqXG4gKiBAY2F0ZWdvcnkgTWF0aFxuICovXG5jbGFzcyBWZWM0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgZmlyc3QgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHg7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2Vjb25kIGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB5O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRoaXJkIGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB6O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZvdXJ0aCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgVmVjNCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXX0gW3hdIC0gVGhlIHggdmFsdWUuIERlZmF1bHRzIHRvIDAuIElmIHggaXMgYW4gYXJyYXkgb2YgbGVuZ3RoIDQsIHRoZVxuICAgICAqIGFycmF5IHdpbGwgYmUgdXNlZCB0byBwb3B1bGF0ZSBhbGwgY29tcG9uZW50cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHkgdmFsdWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBUaGUgdyB2YWx1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih4ID0gMCwgeSA9IDAsIHogPSAwLCB3ID0gMCkge1xuICAgICAgICBpZiAoeC5sZW5ndGggPT09IDQpIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHhbMF07XG4gICAgICAgICAgICB0aGlzLnkgPSB4WzFdO1xuICAgICAgICAgICAgdGhpcy56ID0geFsyXTtcbiAgICAgICAgICAgIHRoaXMudyA9IHhbM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgICAgICB0aGlzLncgPSB3O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjNCgxMCwgMTAsIDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDIwLCAyMCwgMjAsIDIwKTtcbiAgICAgKlxuICAgICAqIGEuYWRkKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwLCAzMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkKHJocykge1xuICAgICAgICB0aGlzLnggKz0gcmhzLng7XG4gICAgICAgIHRoaXMueSArPSByaHMueTtcbiAgICAgICAgdGhpcy56ICs9IHJocy56O1xuICAgICAgICB0aGlzLncgKz0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyB0d28gNC1kaW1lbnNpb25hbCB2ZWN0b3JzIHRvZ2V0aGVyIGFuZCByZXR1cm5zIHRoZSByZXN1bHQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IGxocyAtIFRoZSBmaXJzdCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIGFkZGl0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHNlY29uZCB2ZWN0b3Igb3BlcmFuZCBmb3IgdGhlIGFkZGl0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjNCgxMCwgMTAsIDEwLCAxMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDIwLCAyMCwgMjAsIDIwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIHIuYWRkMihhLCBiKTtcbiAgICAgKiAvLyBPdXRwdXRzIFszMCwgMzAsIDMwXVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKyByaHMuejtcbiAgICAgICAgdGhpcy53ID0gbGhzLncgKyByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbnVtYmVyIHRvIGVhY2ggZWxlbWVudCBvZiBhIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIGFkZC5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjNCgzLCA0LCA1LCA2KTtcbiAgICAgKlxuICAgICAqIHZlYy5hZGRTY2FsYXIoMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs1LCA2LCA3LCA4XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy56ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy53ICs9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3Igc2NhbGVkIGJ5IHNjYWxhciB2YWx1ZS4gRG9lcyBub3QgbW9kaWZ5IHRoZSB2ZWN0b3IgYmVpbmcgYWRkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIG11bHRpcGx5IHRoZSBhZGRlZCB2ZWN0b3Igd2l0aC5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKlxuICAgICAqIHZlYy5hZGRTY2FsZWQocGMuVmVjNC5PTkUsIDIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMywgNCwgNSwgNl1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGRTY2FsZWQocmhzLCBzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICs9IHJocy54ICogc2NhbGFyO1xuICAgICAgICB0aGlzLnkgKz0gcmhzLnkgKiBzY2FsYXI7XG4gICAgICAgIHRoaXMueiArPSByaHMueiAqIHNjYWxhcjtcbiAgICAgICAgdGhpcy53ICs9IHJocy53ICogc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIDQtZGltZW5zaW9uYWwgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjNCgxMCwgMjAsIDMwLCA0MCk7XG4gICAgICogY29uc3QgdmNsb25lID0gdi5jbG9uZSgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgY2xvbmluZyBpczogXCIgKyB2Y2xvbmUudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cih0aGlzLngsIHRoaXMueSwgdGhpcy56LCB0aGlzLncpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYSBkZXN0aW5hdGlvbiA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gQSB2ZWN0b3IgdG8gY29weSB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzcmMgPSBuZXcgcGMuVmVjNCgxMCwgMjAsIDMwLCA0MCk7XG4gICAgICogY29uc3QgZHN0ID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIGRzdC5jb3B5KHNyYyk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gdmVjdG9ycyBhcmUgXCIgKyAoZHN0LmVxdWFscyhzcmMpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIHRoaXMueCA9IHJocy54O1xuICAgICAgICB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIHRoaXMudyA9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgYSA0LWRpbWVuc2lvbmFsIHZlY3RvciBieSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgdmVjdG9yIHRvIGRpdmlkZSB0aGUgc3BlY2lmaWVkIHZlY3RvciBieS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoNCwgOSwgMTYsIDI1KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICpcbiAgICAgKiBhLmRpdihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzIsIDMsIDQsIDVdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkaXZpc2lvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdihyaHMpIHtcbiAgICAgICAgdGhpcy54IC89IHJocy54O1xuICAgICAgICB0aGlzLnkgLz0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAvPSByaHMuejtcbiAgICAgICAgdGhpcy53IC89IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgb25lIDQtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGFub3RoZXIgYW5kIHdyaXRlcyB0aGUgcmVzdWx0IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgZGl2aWRlbmQgdmVjdG9yICh0aGUgdmVjdG9yIGJlaW5nIGRpdmlkZWQpLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIGRpdmlzb3IgdmVjdG9yICh0aGUgdmVjdG9yIGRpdmlkaW5nIHRoZSBkaXZpZGVuZCkuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWM0KDQsIDksIDE2LCAyNSk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDIsIDMsIDQsIDUpO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5kaXYyKGEsIGIpO1xuICAgICAqIC8vIE91dHB1dHMgWzIsIDMsIDQsIDVdXG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2MihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAvIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAvIHJocy55O1xuICAgICAgICB0aGlzLnogPSBsaHMueiAvIHJocy56O1xuICAgICAgICB0aGlzLncgPSBsaHMudyAvIHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gZGl2aWRlIGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWM0KDMsIDYsIDksIDEyKTtcbiAgICAgKlxuICAgICAqIHZlYy5kaXZTY2FsYXIoMyk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAyLCAzLCA0XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdlNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy55IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy56IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy53IC89IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBkb3QgcHJvZHVjdCBvcGVyYXRpb24gcGVyZm9ybWVkIG9uIHRoZSB0d28gc3BlY2lmaWVkIDQtZGltZW5zaW9uYWxcbiAgICAgKiB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgc2Vjb25kIDQtZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGRvdCBwcm9kdWN0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IG9wZXJhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYxID0gbmV3IHBjLlZlYzQoNSwgMTAsIDIwLCA0MCk7XG4gICAgICogY29uc3QgdjIgPSBuZXcgcGMuVmVjNCgxMCwgMjAsIDQwLCA4MCk7XG4gICAgICogY29uc3QgdjFkb3R2MiA9IHYxLmRvdCh2Mik7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkb3QgcHJvZHVjdCBpczogXCIgKyB2MWRvdHYyKTtcbiAgICAgKi9cbiAgICBkb3QocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiByaHMueCArIHRoaXMueSAqIHJocy55ICsgdGhpcy56ICogcmhzLnogKyB0aGlzLncgKiByaHMudztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHZlY3RvcnMgYXJlIGVxdWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgdmVjdG9yIHRvIGNvbXBhcmUgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMSwgMiwgMywgNCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDUsIDYsIDcsIDgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggPT09IHJocy54ICYmIHRoaXMueSA9PT0gcmhzLnkgJiYgdGhpcy56ID09PSByaHMueiAmJiB0aGlzLncgPT09IHJocy53O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gdmVjdG9ycyBhcmUgZXF1YWwgdXNpbmcgYW4gYWJzb2x1dGUgZXJyb3IgdG9sZXJhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgdmVjdG9yIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlcHNpbG9uXSAtIFRoZSBtYXhpbXVtIGRpZmZlcmVuY2UgYmV0d2VlbiBlYWNoIGNvbXBvbmVudCBvZiB0aGUgdHdvXG4gICAgICogdmVjdG9ycy4gRGVmYXVsdHMgdG8gMWUtNi5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBhcHByb3hpbWF0ZWx5IFwiICsgKGEuZXF1YWxzQXBwcm94KGIsIDFlLTkpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFsc0FwcHJveChyaHMsIGVwc2lsb24gPSAxZS02KSB7XG4gICAgICAgIHJldHVybiAoTWF0aC5hYnModGhpcy54IC0gcmhzLngpIDwgZXBzaWxvbikgJiZcbiAgICAgICAgICAgIChNYXRoLmFicyh0aGlzLnkgLSByaHMueSkgPCBlcHNpbG9uKSAmJlxuICAgICAgICAgICAgKE1hdGguYWJzKHRoaXMueiAtIHJocy56KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy53IC0gcmhzLncpIDwgZXBzaWxvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjNCgzLCA0LCAwLCAwKTtcbiAgICAgKiBjb25zdCBsZW4gPSB2ZWMubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzQoMywgNCwgMCk7XG4gICAgICogY29uc3QgbGVuID0gdmVjLmxlbmd0aFNxKCk7XG4gICAgICogLy8gT3V0cHV0cyAyNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBzcXVhcmVkIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGhTcSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgNC1kaW1lbnNpb25hbCB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBwb2ludCBvZiBpbnRlcnBvbGF0aW9uLiBCZXR3ZWVuIDAgYW5kIDEsXG4gICAgICogdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgc3RyYWlnaHQgbGluZSBiZXR3ZWVuIGxocyBhbmQgcmhzLiBPdXRzaWRlIG9mIHRoaXNcbiAgICAgKiByYW5nZSwgdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgcmF5IGV4dHJhcG9sYXRlZCBmcm9tIHRoaXMgbGluZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMCwgMCwgMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDEwLCAxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIHIubGVycChhLCBiLCAwKTsgICAvLyByIGlzIGVxdWFsIHRvIGFcbiAgICAgKiByLmxlcnAoYSwgYiwgMC41KTsgLy8gciBpcyA1LCA1LCA1LCA1XG4gICAgICogci5sZXJwKGEsIGIsIDEpOyAgIC8vIHIgaXMgZXF1YWwgdG8gYlxuICAgICAqL1xuICAgIGxlcnAobGhzLCByaHMsIGFscGhhKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICsgYWxwaGEgKiAocmhzLnggLSBsaHMueCk7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICsgYWxwaGEgKiAocmhzLnkgLSBsaHMueSk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICsgYWxwaGEgKiAocmhzLnogLSBsaHMueik7XG4gICAgICAgIHRoaXMudyA9IGxocy53ICsgYWxwaGEgKiAocmhzLncgLSBsaHMudyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWM0KDIsIDMsIDQsIDUpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCg0LCA1LCA2LCA3KTtcbiAgICAgKlxuICAgICAqIGEubXVsKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjQsIDM1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bChyaHMpIHtcbiAgICAgICAgdGhpcy54ICo9IHJocy54O1xuICAgICAgICB0aGlzLnkgKj0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAqPSByaHMuejtcbiAgICAgICAgdGhpcy53ICo9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBtdWx0aXBseWluZyB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gbGhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDQsIDUsIDYsIDcpO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5tdWwyKGEsIGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjQsIDM1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKiByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKiByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKiByaHMuejtcbiAgICAgICAgdGhpcy53ID0gbGhzLncgKiByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGVhY2ggZWxlbWVudCBvZiBhIHZlY3RvciBieSBhIG51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIG11bHRpcGx5IGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWM0KDMsIDYsIDksIDEyKTtcbiAgICAgKlxuICAgICAqIHZlYy5tdWxTY2FsYXIoMyk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs5LCAxOCwgMjcsIDM2XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy56ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy53ICo9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoaXMgNC1kaW1lbnNpb25hbCB2ZWN0b3IgY29udmVydGVkIHRvIGEgdW5pdCB2ZWN0b3IgaW4gcGxhY2UuIElmIHRoZSB2ZWN0b3IgaGFzIGFcbiAgICAgKiBsZW5ndGggb2YgemVybywgdGhlIHZlY3RvcidzIGVsZW1lbnRzIHdpbGwgYmUgc2V0IHRvIHplcm8uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IFtzcmNdIC0gVGhlIHZlY3RvciB0byBub3JtYWxpemUuIElmIG5vdCBzZXQsIHRoZSBvcGVyYXRpb24gaXMgZG9uZSBpbiBwbGFjZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzQoMjUsIDAsIDAsIDApO1xuICAgICAqXG4gICAgICogdi5ub3JtYWxpemUoKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIG5vcm1hbGl6YXRpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBub3JtYWxpemUoc3JjID0gdGhpcykge1xuICAgICAgICBjb25zdCBsZW5ndGhTcSA9IHNyYy54ICogc3JjLnggKyBzcmMueSAqIHNyYy55ICsgc3JjLnogKiBzcmMueiArIHNyYy53ICogc3JjLnc7XG4gICAgICAgIGlmIChsZW5ndGhTcSA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGludkxlbmd0aCA9IDEgLyBNYXRoLnNxcnQobGVuZ3RoU3EpO1xuICAgICAgICAgICAgdGhpcy54ID0gc3JjLnggKiBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgPSBzcmMueSAqIGludkxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMueiA9IHNyYy56ICogaW52TGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy53ID0gc3JjLncgKiBpbnZMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgc2V0IHRvIHRoZSBsYXJnZXN0IGludGVnZXIgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGl0cyB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gW3NyY10gLSBUaGUgdmVjdG9yIHRvIGZsb29yLiBJZiBub3Qgc2V0LCB0aGUgb3BlcmF0aW9uIGlzIGRvbmUgaW4gcGxhY2UuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGZsb29yKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5mbG9vcihzcmMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguZmxvb3Ioc3JjLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLmZsb29yKHNyYy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5mbG9vcihzcmMudyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIHRvIHRoZSBuZXh0IGxhcmdlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gW3NyY10gLSBUaGUgdmVjdG9yIHRvIGNlaWwuIElmIG5vdCBzZXQsIHRoZSBvcGVyYXRpb24gaXMgZG9uZSBpbiBwbGFjZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY2VpbChzcmMgPSB0aGlzKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGguY2VpbChzcmMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguY2VpbChzcmMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGguY2VpbChzcmMueik7XG4gICAgICAgIHRoaXMudyA9IE1hdGguY2VpbChzcmMudyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIG9yIGRvd24gdG8gdGhlIG5lYXJlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gW3NyY10gLSBUaGUgdmVjdG9yIHRvIHJvdW5kLiBJZiBub3Qgc2V0LCB0aGUgb3BlcmF0aW9uIGlzIGRvbmUgaW4gcGxhY2UuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHJvdW5kKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5yb3VuZChzcmMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQoc3JjLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLnJvdW5kKHNyYy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5yb3VuZChzcmMudyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBhc3NpZ25lZCBhIHZhbHVlIGZyb20gcmhzIHBhcmFtZXRlciBpZiBpdCBpcyBzbWFsbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc291cmNlIG9mIGVsZW1lbnRzIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG1pbihyaHMpIHtcbiAgICAgICAgaWYgKHJocy54IDwgdGhpcy54KSB0aGlzLnggPSByaHMueDtcbiAgICAgICAgaWYgKHJocy55IDwgdGhpcy55KSB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgaWYgKHJocy56IDwgdGhpcy56KSB0aGlzLnogPSByaHMuejtcbiAgICAgICAgaWYgKHJocy53IDwgdGhpcy53KSB0aGlzLncgPSByaHMudztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIGFzc2lnbmVkIGEgdmFsdWUgZnJvbSByaHMgcGFyYW1ldGVyIGlmIGl0IGlzIGxhcmdlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNvdXJjZSBvZiBlbGVtZW50cyB0byBjb21wYXJlIHRvLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtYXgocmhzKSB7XG4gICAgICAgIGlmIChyaHMueCA+IHRoaXMueCkgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIGlmIChyaHMueSA+IHRoaXMueSkgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIGlmIChyaHMueiA+IHRoaXMueikgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIGlmIChyaHMudyA+IHRoaXMudykgdGhpcy53ID0gcmhzLnc7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgZmlyc3QgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBzZWNvbmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSB0aGlyZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIGZvdXJ0aCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKiB2LnNldCg1LCAxMCwgMjAsIDQwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgNSwgMTAsIDIwLCA0MFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgZnJvbSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgdmVjdG9yIHRvIGFkZCB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMTAsIDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLnN1YihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWy0xMCwgLTEwLCAtMTAsIC0xMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHN1YnRyYWN0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViKHJocykge1xuICAgICAgICB0aGlzLnggLT0gcmhzLng7XG4gICAgICAgIHRoaXMueSAtPSByaHMueTtcbiAgICAgICAgdGhpcy56IC09IHJocy56O1xuICAgICAgICB0aGlzLncgLT0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIHR3byA0LWRpbWVuc2lvbmFsIHZlY3RvcnMgZnJvbSBvbmUgYW5vdGhlciBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBzdWJ0cmFjdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBzdWJ0cmFjdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMTAsIDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiByLnN1YjIoYSwgYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFstMTAsIC0xMCwgLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YjIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggLSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgLSByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogLSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gbGhzLncgLSByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdHMgYSBudW1iZXIgZnJvbSBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBzdWJ0cmFjdC5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjNCgzLCA0LCA1LCA2KTtcbiAgICAgKlxuICAgICAqIHZlYy5zdWJTY2FsYXIoMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAyLCAzLCA0XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YlNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54IC09IHNjYWxhcjtcbiAgICAgICAgdGhpcy55IC09IHNjYWxhcjtcbiAgICAgICAgdGhpcy56IC09IHNjYWxhcjtcbiAgICAgICAgdGhpcy53IC09IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgdmVjdG9yIHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHZlY3RvciBpbiBzdHJpbmcgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjNCgyMCwgMTAsIDUsIDApO1xuICAgICAqIC8vIE91dHB1dHMgWzIwLCAxMCwgNSwgMF1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fSwgJHt0aGlzLnp9LCAke3RoaXMud31dYDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIDAsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBWZWM0KDAsIDAsIDAsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMSwgMSwgMSwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjNH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgT05FID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjNCgxLCAxLCAxLCAxKSk7XG59XG5cbmV4cG9ydCB7IFZlYzQgfTtcbiJdLCJuYW1lcyI6WyJWZWM0IiwiY29uc3RydWN0b3IiLCJ4IiwieSIsInoiLCJ3IiwibGVuZ3RoIiwiYWRkIiwicmhzIiwiYWRkMiIsImxocyIsImFkZFNjYWxhciIsInNjYWxhciIsImFkZFNjYWxlZCIsImNsb25lIiwiY3N0ciIsImNvcHkiLCJkaXYiLCJkaXYyIiwiZGl2U2NhbGFyIiwiZG90IiwiZXF1YWxzIiwiZXF1YWxzQXBwcm94IiwiZXBzaWxvbiIsIk1hdGgiLCJhYnMiLCJzcXJ0IiwibGVuZ3RoU3EiLCJsZXJwIiwiYWxwaGEiLCJtdWwiLCJtdWwyIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic3JjIiwiaW52TGVuZ3RoIiwiZmxvb3IiLCJjZWlsIiwicm91bmQiLCJtaW4iLCJtYXgiLCJzZXQiLCJzdWIiLCJzdWIyIiwic3ViU2NhbGFyIiwidG9TdHJpbmciLCJfY2xhc3MiLCJaRVJPIiwiT2JqZWN0IiwiZnJlZXplIiwiT05FIl0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLElBQUksQ0FBQztBQTZCUDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUF2Q3hDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUgsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUQ7QUFDSjtBQUNBO0FB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LEdBQUdvQixJQUFJLENBQUNjLEtBQUssQ0FBQ0osR0FBRyxDQUFDOUIsQ0FBQyxDQUFDLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxDQUFDLEdBQUdtQixJQUFJLENBQUNjLEtBQUssQ0FBQ0osR0FBRyxDQUFDN0IsQ0FBQyxDQUFDLENBQUE7QUFDMUIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lrQyxHQUFHQSxDQUFDL0IsR0FBRyxFQUFFO0FBQ0wsSUFBQSxJQUFJQSxHQUFHLENBQUNOLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR00sR0FBRyxDQUFDTixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJTSxHQUFHLENBQUNMLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSyxHQUFHLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ksR0FBRyxDQUFDSixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSSxHQUFHLENBQUNILENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFDbEMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ltQyxHQUFHQSxDQUFDaEMsR0FBRyxFQUFFO0FBQ0wsSUFBQSxJQUFJQSxHQUFHLENBQUNOLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR00sR0FBRyxDQUFDTixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJTSxHQUFHLENBQUNMLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSyxHQUFHLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0ksR0FBRyxDQUFDSixDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJSSxHQUFHLENBQUNILENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsRUFBRSxJQUFJLENBQUNBLENBQUMsR0FBR0csR0FBRyxDQUFDSCxDQUFDLENBQUE7QUFDbEMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lvQyxHQUFHQSxDQUFDdkMsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0lBQ1osSUFBSSxDQUFDSCxDQUFDLEdBQUdBLENBQUMsQ0FBQTtJQUNWLElBQUksQ0FBQ0MsQ0FBQyxHQUFHQSxDQUFDLENBQUE7SUFDVixJQUFJLENBQUNDLENBQUMsR0FBR0EsQ0FBQyxDQUFBO0lBQ1YsSUFBSSxDQUFDQyxDQUFDLEdBQUdBLENBQUMsQ0FBQTtBQUVWLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSXFDLEdBQUdBLENBQUNsQyxHQUFHLEVBQUU7QUFDTCxJQUFBLElBQUksQ0FBQ04sQ0FBQyxJQUFJTSxHQUFHLENBQUNOLENBQUMsQ0FBQTtBQUNmLElBQUEsSUFBSSxDQUFDQyxDQUFDLElBQUlLLEdBQUcsQ0FBQ0wsQ0FBQyxDQUFBO0FBQ2YsSUFBQSxJQUFJLENBQUNDLENBQUMsSUFBSUksR0FBRyxDQUFDSixDQUFDLENBQUE7QUFDZixJQUFBLElBQUksQ0FBQ0MsQ0FBQyxJQUFJRyxHQUFHLENBQUNILENBQUMsQ0FBQTtBQUVmLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lzQyxFQUFBQSxJQUFJQSxDQUFDakMsR0FBRyxFQUFFRixHQUFHLEVBQUU7SUFDWCxJQUFJLENBQUNOLENBQUMsR0FBR1EsR0FBRyxDQUFDUixDQUFDLEdBQUdNLEdBQUcsQ0FBQ04sQ0FBQyxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsQ0FBQyxHQUFHTyxHQUFHLENBQUNQLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxDQUFDLEdBQUdNLEdBQUcsQ0FBQ04sQ0FBQyxHQUFHSSxHQUFHLENBQUNKLENBQUMsQ0FBQTtJQUN0QixJQUFJLENBQUNDLENBQUMsR0FBR0ssR0FBRyxDQUFDTCxDQUFDLEdBQUdHLEdBQUcsQ0FBQ0gsQ0FBQyxDQUFBO0FBRXRCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0l1QyxTQUFTQSxDQUFDaEMsTUFBTSxFQUFFO0lBQ2QsSUFBSSxDQUFDVixDQUFDLElBQUlVLE1BQU0sQ0FBQTtJQUNoQixJQUFJLENBQUNULENBQUMsSUFBSVMsTUFBTSxDQUFBO0lBQ2hCLElBQUksQ0FBQ1IsQ0FBQyxJQUFJUSxNQUFNLENBQUE7SUFDaEIsSUFBSSxDQUFDUCxDQUFDLElBQUlPLE1BQU0sQ0FBQTtBQUVoQixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWlDLEVBQUFBLFFBQVFBLEdBQUc7QUFDUCxJQUFBLE9BQVEsSUFBRyxJQUFJLENBQUMzQyxDQUFFLENBQUEsRUFBQSxFQUFJLElBQUksQ0FBQ0MsQ0FBRSxDQUFJLEVBQUEsRUFBQSxJQUFJLENBQUNDLENBQUUsQ0FBQSxFQUFBLEVBQUksSUFBSSxDQUFDQyxDQUFFLENBQUUsQ0FBQSxDQUFBLENBQUE7QUFDekQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFVQSxDQUFBO0FBQUN5QyxNQUFBLEdBdm9CSzlDLElBQUksQ0FBQTtBQUFKQSxJQUFJLENBOG5CQytDLElBQUksR0FBR0MsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSWpELE1BQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRWpEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXJvQk1BLElBQUksQ0Fzb0JDa0QsR0FBRyxHQUFHRixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJakQsTUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOzs7OyJ9
