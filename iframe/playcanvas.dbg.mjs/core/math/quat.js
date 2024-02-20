import { math } from './math.js';
import { Vec3 } from './vec3.js';

var _class;

/**
 * A quaternion.
 *
 * @category Math
 */
class Quat {
  /**
   * Create a new Quat instance.
   *
   * @param {number|number[]} [x] - The quaternion's x component. Defaults to 0. If x is an array
   * of length 4, the array will be used to populate all components.
   * @param {number} [y] - The quaternion's y component. Defaults to 0.
   * @param {number} [z] - The quaternion's z component. Defaults to 0.
   * @param {number} [w] - The quaternion's w component. Defaults to 1.
   */
  constructor(x = 0, y = 0, z = 0, w = 1) {
    /**
     * The x component of the quaternion.
     *
     * @type {number}
     */
    this.x = void 0;
    /**
     * The y component of the quaternion.
     *
     * @type {number}
     */
    this.y = void 0;
    /**
     * The z component of the quaternion.
     *
     * @type {number}
     */
    this.z = void 0;
    /**
     * The w component of the quaternion.
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
   * Returns an identical copy of the specified quaternion.
   *
   * @returns {this} A quaternion containing the result of the cloning.
   * @example
   * const q = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * const qclone = q.clone();
   *
   * console.log("The result of the cloning is: " + q.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z, this.w);
  }
  conjugate(src = this) {
    this.x = src.x * -1;
    this.y = src.y * -1;
    this.z = src.z * -1;
    this.w = src.w;
    return this;
  }

  /**
   * Copies the contents of a source quaternion to a destination quaternion.
   *
   * @param {Quat} rhs - The quaternion to be copied.
   * @returns {Quat} Self for chaining.
   * @example
   * const src = new pc.Quat();
   * const dst = new pc.Quat();
   * dst.copy(src, src);
   * console.log("The two quaternions are " + (src.equals(dst) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this;
  }

  /**
   * Reports whether two quaternions are equal.
   *
   * @param {Quat} rhs - The quaternion to be compared against.
   * @returns {boolean} True if the quaternions are equal and false otherwise.
   * @example
   * const a = new pc.Quat();
   * const b = new pc.Quat();
   * console.log("The two quaternions are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
  }

  /**
   * Reports whether two quaternions are equal using an absolute error tolerance.
   *
   * @param {Quat} rhs - The quaternion to be compared against.
   * @param {number} [epsilon] - The maximum difference between each component of the two
   * quaternions. Defaults to 1e-6.
   * @returns {boolean} True if the quaternions are equal and false otherwise.
   * @example
   * const a = new pc.Quat();
   * const b = new pc.Quat();
   * console.log("The two quaternions are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
   */
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
  }

  /**
   * Gets the rotation axis and angle for a given quaternion. If a quaternion is created with
   * `setFromAxisAngle`, this method will return the same values as provided in the original
   * parameter list OR functionally equivalent values.
   *
   * @param {Vec3} axis - The 3-dimensional vector to receive the axis of rotation.
   * @returns {number} Angle, in degrees, of the rotation.
   * @example
   * const q = new pc.Quat();
   * q.setFromAxisAngle(new pc.Vec3(0, 1, 0), 90);
   * const v = new pc.Vec3();
   * const angle = q.getAxisAngle(v);
   * // Outputs 90
   * console.log(angle);
   * // Outputs [0, 1, 0]
   * console.log(v.toString());
   */
  getAxisAngle(axis) {
    let rad = Math.acos(this.w) * 2;
    const s = Math.sin(rad / 2);
    if (s !== 0) {
      axis.x = this.x / s;
      axis.y = this.y / s;
      axis.z = this.z / s;
      if (axis.x < 0 || axis.y < 0 || axis.z < 0) {
        // Flip the sign
        axis.x *= -1;
        axis.y *= -1;
        axis.z *= -1;
        rad *= -1;
      }
    } else {
      // If s is zero, return any axis (no rotation - axis does not matter)
      axis.x = 1;
      axis.y = 0;
      axis.z = 0;
    }
    return rad * math.RAD_TO_DEG;
  }

  /**
   * Converts the supplied quaternion to Euler angles.
   *
   * @param {Vec3} [eulers] - The 3-dimensional vector to receive the Euler angles.
   * @returns {Vec3} The 3-dimensional vector holding the Euler angles that
   * correspond to the supplied quaternion.
   */
  getEulerAngles(eulers = new Vec3()) {
    let x, y, z;
    const qx = this.x;
    const qy = this.y;
    const qz = this.z;
    const qw = this.w;
    const a2 = 2 * (qw * qy - qx * qz);
    if (a2 <= -0.99999) {
      x = 2 * Math.atan2(qx, qw);
      y = -Math.PI / 2;
      z = 0;
    } else if (a2 >= 0.99999) {
      x = 2 * Math.atan2(qx, qw);
      y = Math.PI / 2;
      z = 0;
    } else {
      x = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
      y = Math.asin(a2);
      z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
    }
    return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
  }

  /**
   * Generates the inverse of the specified quaternion.
   *
   * @param {Quat} [src] - The quaternion to invert. If not set, the operation is done in place.
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a quaternion rotated 180 degrees around the y-axis
   * const rot = new pc.Quat().setFromEulerAngles(0, 180, 0);
   *
   * // Invert in place
   * rot.invert();
   */
  invert(src = this) {
    return this.conjugate(src).normalize();
  }

  /**
   * Returns the magnitude of the specified quaternion.
   *
   * @returns {number} The magnitude of the specified quaternion.
   * @example
   * const q = new pc.Quat(0, 0, 0, 5);
   * const len = q.length();
   * // Outputs 5
   * console.log("The length of the quaternion is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Returns the magnitude squared of the specified quaternion.
   *
   * @returns {number} The magnitude of the specified quaternion.
   * @example
   * const q = new pc.Quat(3, 4, 0);
   * const lenSq = q.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the quaternion is: " + lenSq);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Returns the result of multiplying the specified quaternions together.
   *
   * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
   * @returns {Quat} Self for chaining.
   * @example
   * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
   *
   * // a becomes a 90 degree rotation around the Y axis
   * // In other words, a = a * b
   * a.mul(b);
   *
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    const q1x = this.x;
    const q1y = this.y;
    const q1z = this.z;
    const q1w = this.w;
    const q2x = rhs.x;
    const q2y = rhs.y;
    const q2z = rhs.z;
    const q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this;
  }

  /**
   * Returns the result of multiplying the specified quaternions together.
   *
   * @param {Quat} lhs - The quaternion used as the first multiplicand of the operation.
   * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
   * @returns {Quat} Self for chaining.
   * @example
   * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
   * const r = new pc.Quat();
   *
   * // r is set to a 90 degree rotation around the Y axis
   * // In other words, r = a * b
   * r.mul2(a, b);
   *
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    const q1x = lhs.x;
    const q1y = lhs.y;
    const q1z = lhs.z;
    const q1w = lhs.w;
    const q2x = rhs.x;
    const q2y = rhs.y;
    const q2z = rhs.z;
    const q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this;
  }

  /**
   * Returns the specified quaternion converted in place to a unit quaternion.
   *
   * @param {Quat} [src] - The quaternion to normalize. If not set, the operation is done in place.
   * @returns {Quat} The result of the normalization.
   * @example
   * const v = new pc.Quat(0, 0, 0, 5);
   *
   * v.normalize();
   *
   * // Outputs 0, 0, 0, 1
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize(src = this) {
    let len = src.length();
    if (len === 0) {
      this.x = this.y = this.z = 0;
      this.w = 1;
    } else {
      len = 1 / len;
      this.x = src.x * len;
      this.y = src.y * len;
      this.z = src.z * len;
      this.w = src.w * len;
    }
    return this;
  }

  /**
   * Sets the specified quaternion to the supplied numerical values.
   *
   * @param {number} x - The x component of the quaternion.
   * @param {number} y - The y component of the quaternion.
   * @param {number} z - The z component of the quaternion.
   * @param {number} w - The w component of the quaternion.
   * @returns {Quat} Self for chaining.
   * @example
   * const q = new pc.Quat();
   * q.set(1, 0, 0, 0);
   *
   * // Outputs 1, 0, 0, 0
   * console.log("The result of the vector set is: " + q.toString());
   */
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Sets a quaternion from an angular rotation around an axis.
   *
   * @param {Vec3} axis - World space axis around which to rotate.
   * @param {number} angle - Angle to rotate around the given axis in degrees.
   * @returns {Quat} Self for chaining.
   * @example
   * const q = new pc.Quat();
   * q.setFromAxisAngle(pc.Vec3.UP, 90);
   */
  setFromAxisAngle(axis, angle) {
    angle *= 0.5 * math.DEG_TO_RAD;
    const sa = Math.sin(angle);
    const ca = Math.cos(angle);
    this.x = sa * axis.x;
    this.y = sa * axis.y;
    this.z = sa * axis.z;
    this.w = ca;
    return this;
  }

  /**
   * Sets a quaternion from Euler angles specified in XYZ order.
   *
   * @param {number|Vec3} ex - Angle to rotate around X axis in degrees. If ex is a Vec3, the
   * three angles will be read from it instead.
   * @param {number} [ey] - Angle to rotate around Y axis in degrees.
   * @param {number} [ez] - Angle to rotate around Z axis in degrees.
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a quaternion from 3 euler angles
   * const q = new pc.Quat();
   * q.setFromEulerAngles(45, 90, 180);
   *
   * // Create the same quaternion from a vector containing the same 3 euler angles
   * const v = new pc.Vec3(45, 90, 180);
   * const r = new pc.Quat();
   * r.setFromEulerAngles(v);
   */
  setFromEulerAngles(ex, ey, ez) {
    if (ex instanceof Vec3) {
      const vec = ex;
      ex = vec.x;
      ey = vec.y;
      ez = vec.z;
    }
    const halfToRad = 0.5 * math.DEG_TO_RAD;
    ex *= halfToRad;
    ey *= halfToRad;
    ez *= halfToRad;
    const sx = Math.sin(ex);
    const cx = Math.cos(ex);
    const sy = Math.sin(ey);
    const cy = Math.cos(ey);
    const sz = Math.sin(ez);
    const cz = Math.cos(ez);
    this.x = sx * cy * cz - cx * sy * sz;
    this.y = cx * sy * cz + sx * cy * sz;
    this.z = cx * cy * sz - sx * sy * cz;
    this.w = cx * cy * cz + sx * sy * sz;
    return this;
  }

  /**
   * Converts the specified 4x4 matrix to a quaternion. Note that since a quaternion is purely a
   * representation for orientation, only the translational part of the matrix is lost.
   *
   * @param {import('./mat4.js').Mat4} m - The 4x4 matrix to convert.
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
   * const rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   *
   * // Convert to a quaternion
   * const q = new pc.Quat().setFromMat4(rot);
   */
  setFromMat4(m) {
    let m00, m01, m02, m10, m11, m12, m20, m21, m22, s, rs, lx, ly, lz;
    m = m.data;

    // Cache matrix values for super-speed
    m00 = m[0];
    m01 = m[1];
    m02 = m[2];
    m10 = m[4];
    m11 = m[5];
    m12 = m[6];
    m20 = m[8];
    m21 = m[9];
    m22 = m[10];

    // Remove the scale from the matrix
    lx = m00 * m00 + m01 * m01 + m02 * m02;
    if (lx === 0) return this;
    lx = 1 / Math.sqrt(lx);
    ly = m10 * m10 + m11 * m11 + m12 * m12;
    if (ly === 0) return this;
    ly = 1 / Math.sqrt(ly);
    lz = m20 * m20 + m21 * m21 + m22 * m22;
    if (lz === 0) return this;
    lz = 1 / Math.sqrt(lz);
    m00 *= lx;
    m01 *= lx;
    m02 *= lx;
    m10 *= ly;
    m11 *= ly;
    m12 *= ly;
    m20 *= lz;
    m21 *= lz;
    m22 *= lz;

    // http://www.cs.ucr.edu/~vbz/resources/quatut.pdf

    const tr = m00 + m11 + m22;
    if (tr >= 0) {
      s = Math.sqrt(tr + 1);
      this.w = s * 0.5;
      s = 0.5 / s;
      this.x = (m12 - m21) * s;
      this.y = (m20 - m02) * s;
      this.z = (m01 - m10) * s;
    } else {
      if (m00 > m11) {
        if (m00 > m22) {
          // XDiagDomMatrix
          rs = m00 - (m11 + m22) + 1;
          rs = Math.sqrt(rs);
          this.x = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m12 - m21) * rs;
          this.y = (m01 + m10) * rs;
          this.z = (m02 + m20) * rs;
        } else {
          // ZDiagDomMatrix
          rs = m22 - (m00 + m11) + 1;
          rs = Math.sqrt(rs);
          this.z = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m01 - m10) * rs;
          this.x = (m20 + m02) * rs;
          this.y = (m21 + m12) * rs;
        }
      } else if (m11 > m22) {
        // YDiagDomMatrix
        rs = m11 - (m22 + m00) + 1;
        rs = Math.sqrt(rs);
        this.y = rs * 0.5;
        rs = 0.5 / rs;
        this.w = (m20 - m02) * rs;
        this.z = (m12 + m21) * rs;
        this.x = (m10 + m01) * rs;
      } else {
        // ZDiagDomMatrix
        rs = m22 - (m00 + m11) + 1;
        rs = Math.sqrt(rs);
        this.z = rs * 0.5;
        rs = 0.5 / rs;
        this.w = (m01 - m10) * rs;
        this.x = (m20 + m02) * rs;
        this.y = (m21 + m12) * rs;
      }
    }
    return this;
  }

  /**
   * Set the quaternion that represents the shortest rotation from one direction to another.
   *
   * @param {Vec3} from - The direction to rotate from. It should be normalized.
   * @param {Vec3} to - The direction to rotate to. It should be normalized.
   * @returns {Quat} Self for chaining.
   *
   * {@link https://www.xarg.org/proof/quaternion-from-two-vectors/ Proof of correctness}
   */
  setFromDirections(from, to) {
    const dotProduct = 1 + from.dot(to);
    if (dotProduct < Number.EPSILON) {
      // the vectors point in opposite directions
      // so we need to rotate 180 degrees around an arbitrary orthogonal axis
      if (Math.abs(from.x) > Math.abs(from.y)) {
        this.x = -from.z;
        this.y = 0;
        this.z = from.x;
        this.w = 0;
      } else {
        this.x = 0;
        this.y = -from.z;
        this.z = from.y;
        this.w = 0;
      }
    } else {
      // cross product between the two vectors
      this.x = from.y * to.z - from.z * to.y;
      this.y = from.z * to.x - from.x * to.z;
      this.z = from.x * to.y - from.y * to.x;
      this.w = dotProduct;
    }
    return this.normalize();
  }

  /**
   * Performs a spherical interpolation between two quaternions. The result of the interpolation
   * is written to the quaternion calling the function.
   *
   * @param {Quat} lhs - The quaternion to interpolate from.
   * @param {Quat} rhs - The quaternion to interpolate to.
   * @param {number} alpha - The value controlling the interpolation in relation to the two input
   * quaternions. The value is in the range 0 to 1, 0 generating q1, 1 generating q2 and anything
   * in between generating a spherical interpolation between the two.
   * @returns {Quat} Self for chaining.
   * @example
   * const q1 = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * const q2 = new pc.Quat(-0.21, -0.21, -0.67, 0.68);
   *
   * const result;
   * result = new pc.Quat().slerp(q1, q2, 0);   // Return q1
   * result = new pc.Quat().slerp(q1, q2, 0.5); // Return the midpoint interpolant
   * result = new pc.Quat().slerp(q1, q2, 1);   // Return q2
   */
  slerp(lhs, rhs, alpha) {
    // Algorithm sourced from:
    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const lw = lhs.w;
    let rx = rhs.x;
    let ry = rhs.y;
    let rz = rhs.z;
    let rw = rhs.w;

    // Calculate angle between them.
    let cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;
    if (cosHalfTheta < 0) {
      rw = -rw;
      rx = -rx;
      ry = -ry;
      rz = -rz;
      cosHalfTheta = -cosHalfTheta;
    }

    // If lhs == rhs or lhs == -rhs then theta == 0 and we can return lhs
    if (Math.abs(cosHalfTheta) >= 1) {
      this.w = lw;
      this.x = lx;
      this.y = ly;
      this.z = lz;
      return this;
    }

    // Calculate temporary values.
    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

    // If theta = 180 degrees then result is not fully defined
    // we could rotate around any axis normal to qa or qb
    if (Math.abs(sinHalfTheta) < 0.001) {
      this.w = lw * 0.5 + rw * 0.5;
      this.x = lx * 0.5 + rx * 0.5;
      this.y = ly * 0.5 + ry * 0.5;
      this.z = lz * 0.5 + rz * 0.5;
      return this;
    }
    const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;

    // Calculate Quaternion.
    this.w = lw * ratioA + rw * ratioB;
    this.x = lx * ratioA + rx * ratioB;
    this.y = ly * ratioA + ry * ratioB;
    this.z = lz * ratioA + rz * ratioB;
    return this;
  }

  /**
   * Transforms a 3-dimensional vector by the specified quaternion.
   *
   * @param {Vec3} vec - The 3-dimensional vector to be transformed.
   * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the transformation.
   * @returns {Vec3} The input vector v transformed by the current instance.
   * @example
   * // Create a 3-dimensional vector
   * const v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * const q = new pc.Quat().setFromEulerAngles(10, 20, 30);
   *
   * const tv = q.transformVector(v);
   */
  transformVector(vec, res = new Vec3()) {
    const x = vec.x,
      y = vec.y,
      z = vec.z;
    const qx = this.x,
      qy = this.y,
      qz = this.z,
      qw = this.w;

    // calculate quat * vec
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return res;
  }

  /**
   * Converts the quaternion to string form.
   *
   * @returns {string} The quaternion in string form.
   * @example
   * const v = new pc.Quat(0, 0, 0, 1);
   * // Outputs [0, 0, 0, 1]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }

  /**
   * A constant quaternion set to [0, 0, 0, 1] (the identity).
   *
   * @type {Quat}
   * @readonly
   */
}
_class = Quat;
Quat.IDENTITY = Object.freeze(new _class(0, 0, 0, 1));
/**
 * A constant quaternion set to [0, 0, 0, 0].
 *
 * @type {Quat}
 * @readonly
 */
Quat.ZERO = Object.freeze(new _class(0, 0, 0, 0));

export { Quat };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICpcbiAqIEBjYXRlZ29yeSBNYXRoXG4gKi9cbmNsYXNzIFF1YXQge1xuICAgIC8qKlxuICAgICAqIFRoZSB4IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB5IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB6IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgejtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBRdWF0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeCBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuIElmIHggaXMgYW4gYXJyYXlcbiAgICAgKiBvZiBsZW5ndGggNCwgdGhlIGFycmF5IHdpbGwgYmUgdXNlZCB0byBwb3B1bGF0ZSBhbGwgY29tcG9uZW50cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHF1YXRlcm5pb24ncyB5IGNvbXBvbmVudC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHF1YXRlcm5pb24ncyB6IGNvbXBvbmVudC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVGhlIHF1YXRlcm5pb24ncyB3IGNvbXBvbmVudC4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih4ID0gMCwgeSA9IDAsIHogPSAwLCB3ID0gMSkge1xuICAgICAgICBpZiAoeC5sZW5ndGggPT09IDQpIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHhbMF07XG4gICAgICAgICAgICB0aGlzLnkgPSB4WzFdO1xuICAgICAgICAgICAgdGhpcy56ID0geFsyXTtcbiAgICAgICAgICAgIHRoaXMudyA9IHhbM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgICAgICB0aGlzLncgPSB3O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBxdWF0ZXJuaW9uIGNvbnRhaW5pbmcgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHEgPSBuZXcgcGMuUXVhdCgtMC4xMSwgLTAuMTUsIC0wLjQ2LCAwLjg3KTtcbiAgICAgKiBjb25zdCBxY2xvbmUgPSBxLmNsb25lKCk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgY29uanVnYXRlKHNyYyA9IHRoaXMpIHtcbiAgICAgICAgdGhpcy54ID0gc3JjLnggKiAtMTtcbiAgICAgICAgdGhpcy55ID0gc3JjLnkgKiAtMTtcbiAgICAgICAgdGhpcy56ID0gc3JjLnogKiAtMTtcbiAgICAgICAgdGhpcy53ID0gc3JjLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSBxdWF0ZXJuaW9uIHRvIGEgZGVzdGluYXRpb24gcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gYmUgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNyYyA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc3QgZHN0ID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBkc3QuY29weShzcmMsIHNyYyk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiAoKHRoaXMueCA9PT0gcmhzLngpICYmICh0aGlzLnkgPT09IHJocy55KSAmJiAodGhpcy56ID09PSByaHMueikgJiYgKHRoaXMudyA9PT0gcmhzLncpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHF1YXRlcm5pb25zIGFyZSBlcXVhbCB1c2luZyBhbiBhYnNvbHV0ZSBlcnJvciB0b2xlcmFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlcHNpbG9uXSAtIFRoZSBtYXhpbXVtIGRpZmZlcmVuY2UgYmV0d2VlbiBlYWNoIGNvbXBvbmVudCBvZiB0aGUgdHdvXG4gICAgICogcXVhdGVybmlvbnMuIERlZmF1bHRzIHRvIDFlLTYuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBhcHByb3hpbWF0ZWx5IFwiICsgKGEuZXF1YWxzQXBwcm94KGIsIDFlLTkpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFsc0FwcHJveChyaHMsIGVwc2lsb24gPSAxZS02KSB7XG4gICAgICAgIHJldHVybiAoTWF0aC5hYnModGhpcy54IC0gcmhzLngpIDwgZXBzaWxvbikgJiZcbiAgICAgICAgICAgIChNYXRoLmFicyh0aGlzLnkgLSByaHMueSkgPCBlcHNpbG9uKSAmJlxuICAgICAgICAgICAgKE1hdGguYWJzKHRoaXMueiAtIHJocy56KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy53IC0gcmhzLncpIDwgZXBzaWxvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgcm90YXRpb24gYXhpcyBhbmQgYW5nbGUgZm9yIGEgZ2l2ZW4gcXVhdGVybmlvbi4gSWYgYSBxdWF0ZXJuaW9uIGlzIGNyZWF0ZWQgd2l0aFxuICAgICAqIGBzZXRGcm9tQXhpc0FuZ2xlYCwgdGhpcyBtZXRob2Qgd2lsbCByZXR1cm4gdGhlIHNhbWUgdmFsdWVzIGFzIHByb3ZpZGVkIGluIHRoZSBvcmlnaW5hbFxuICAgICAqIHBhcmFtZXRlciBsaXN0IE9SIGZ1bmN0aW9uYWxseSBlcXVpdmFsZW50IHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gYXhpcyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSBheGlzIG9mIHJvdGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEFuZ2xlLCBpbiBkZWdyZWVzLCBvZiB0aGUgcm90YXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21BeGlzQW5nbGUobmV3IHBjLlZlYzMoMCwgMSwgMCksIDkwKTtcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBjb25zdCBhbmdsZSA9IHEuZ2V0QXhpc0FuZ2xlKHYpO1xuICAgICAqIC8vIE91dHB1dHMgOTBcbiAgICAgKiBjb25zb2xlLmxvZyhhbmdsZSk7XG4gICAgICogLy8gT3V0cHV0cyBbMCwgMSwgMF1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGdldEF4aXNBbmdsZShheGlzKSB7XG4gICAgICAgIGxldCByYWQgPSBNYXRoLmFjb3ModGhpcy53KSAqIDI7XG4gICAgICAgIGNvbnN0IHMgPSBNYXRoLnNpbihyYWQgLyAyKTtcbiAgICAgICAgaWYgKHMgIT09IDApIHtcbiAgICAgICAgICAgIGF4aXMueCA9IHRoaXMueCAvIHM7XG4gICAgICAgICAgICBheGlzLnkgPSB0aGlzLnkgLyBzO1xuICAgICAgICAgICAgYXhpcy56ID0gdGhpcy56IC8gcztcbiAgICAgICAgICAgIGlmIChheGlzLnggPCAwIHx8IGF4aXMueSA8IDAgfHwgYXhpcy56IDwgMCkge1xuICAgICAgICAgICAgICAgIC8vIEZsaXAgdGhlIHNpZ25cbiAgICAgICAgICAgICAgICBheGlzLnggKj0gLTE7XG4gICAgICAgICAgICAgICAgYXhpcy55ICo9IC0xO1xuICAgICAgICAgICAgICAgIGF4aXMueiAqPSAtMTtcbiAgICAgICAgICAgICAgICByYWQgKj0gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJZiBzIGlzIHplcm8sIHJldHVybiBhbnkgYXhpcyAobm8gcm90YXRpb24gLSBheGlzIGRvZXMgbm90IG1hdHRlcilcbiAgICAgICAgICAgIGF4aXMueCA9IDE7XG4gICAgICAgICAgICBheGlzLnkgPSAwO1xuICAgICAgICAgICAgYXhpcy56ID0gMDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmFkICogbWF0aC5SQURfVE9fREVHO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBzdXBwbGllZCBxdWF0ZXJuaW9uIHRvIEV1bGVyIGFuZ2xlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2V1bGVyc10gLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgRXVsZXIgYW5nbGVzLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB0aGUgRXVsZXIgYW5nbGVzIHRoYXRcbiAgICAgKiBjb3JyZXNwb25kIHRvIHRoZSBzdXBwbGllZCBxdWF0ZXJuaW9uLlxuICAgICAqL1xuICAgIGdldEV1bGVyQW5nbGVzKGV1bGVycyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgbGV0IHgsIHksIHo7XG5cbiAgICAgICAgY29uc3QgcXggPSB0aGlzLng7XG4gICAgICAgIGNvbnN0IHF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxeiA9IHRoaXMuejtcbiAgICAgICAgY29uc3QgcXcgPSB0aGlzLnc7XG5cbiAgICAgICAgY29uc3QgYTIgPSAyICogKHF3ICogcXkgLSBxeCAqIHF6KTtcblxuICAgICAgICBpZiAoYTIgPD0gLTAuOTk5OTkpIHtcbiAgICAgICAgICAgIHggPSAyICogTWF0aC5hdGFuMihxeCwgcXcpO1xuICAgICAgICAgICAgeSA9IC1NYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKGEyID49IDAuOTk5OTkpIHtcbiAgICAgICAgICAgIHggPSAyICogTWF0aC5hdGFuMihxeCwgcXcpO1xuICAgICAgICAgICAgeSA9IE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgeiA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB4ID0gTWF0aC5hdGFuMigyICogKHF3ICogcXggKyBxeSAqIHF6KSwgMSAtIDIgKiAocXggKiBxeCArIHF5ICogcXkpKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmFzaW4oYTIpO1xuICAgICAgICAgICAgeiA9IE1hdGguYXRhbjIoMiAqIChxdyAqIHF6ICsgcXggKiBxeSksIDEgLSAyICogKHF5ICogcXkgKyBxeiAqIHF6KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXVsZXJzLnNldCh4LCB5LCB6KS5tdWxTY2FsYXIobWF0aC5SQURfVE9fREVHKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgdGhlIGludmVyc2Ugb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSBbc3JjXSAtIFRoZSBxdWF0ZXJuaW9uIHRvIGludmVydC4gSWYgbm90IHNldCwgdGhlIG9wZXJhdGlvbiBpcyBkb25lIGluIHBsYWNlLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gcm90YXRlZCAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIGNvbnN0IHJvdCA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDE4MCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBJbnZlcnQgaW4gcGxhY2VcbiAgICAgKiByb3QuaW52ZXJ0KCk7XG4gICAgICovXG4gICAgaW52ZXJ0KHNyYyA9IHRoaXMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKHNyYykubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDUpO1xuICAgICAqIGNvbnN0IGxlbiA9IHEubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSBxdWF0ZXJuaW9uIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIHNxdWFyZWQgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogY29uc3QgbGVuU3EgPSBxLmxlbmd0aFNxKCk7XG4gICAgICogLy8gT3V0cHV0cyAyNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBzcXVhcmVkIG9mIHRoZSBxdWF0ZXJuaW9uIGlzOiBcIiArIGxlblNxKTtcbiAgICAgKi9cbiAgICBsZW5ndGhTcSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9ucyB0b2dldGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAzMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAzMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IFtzcmNdIC0gVGhlIHF1YXRlcm5pb24gdG8gbm9ybWFsaXplLiBJZiBub3Qgc2V0LCB0aGUgb3BlcmF0aW9uIGlzIGRvbmUgaW4gcGxhY2UuXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSByZXN1bHQgb2YgdGhlIG5vcm1hbGl6YXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAwLCAwLCAwLCAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZShzcmMgPSB0aGlzKSB7XG4gICAgICAgIGxldCBsZW4gPSBzcmMubGVuZ3RoKCk7XG4gICAgICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMueSA9IHRoaXMueiA9IDA7XG4gICAgICAgICAgICB0aGlzLncgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuID0gMSAvIGxlbjtcbiAgICAgICAgICAgIHRoaXMueCA9IHNyYy54ICogbGVuO1xuICAgICAgICAgICAgdGhpcy55ID0gc3JjLnkgKiBsZW47XG4gICAgICAgICAgICB0aGlzLnogPSBzcmMueiAqIGxlbjtcbiAgICAgICAgICAgIHRoaXMudyA9IHNyYy53ICogbGVuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24gdG8gdGhlIHN1cHBsaWVkIG51bWVyaWNhbCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldCgxLCAwLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyBxLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBhbiBhbmd1bGFyIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gV29ybGQgc3BhY2UgYXhpcyBhcm91bmQgd2hpY2ggdG8gcm90YXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgdGhlIGdpdmVuIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgOTApO1xuICAgICAqL1xuICAgIHNldEZyb21BeGlzQW5nbGUoYXhpcywgYW5nbGUpIHtcbiAgICAgICAgYW5nbGUgKj0gMC41ICogbWF0aC5ERUdfVE9fUkFEO1xuXG4gICAgICAgIGNvbnN0IHNhID0gTWF0aC5zaW4oYW5nbGUpO1xuICAgICAgICBjb25zdCBjYSA9IE1hdGguY29zKGFuZ2xlKTtcblxuICAgICAgICB0aGlzLnggPSBzYSAqIGF4aXMueDtcbiAgICAgICAgdGhpcy55ID0gc2EgKiBheGlzLnk7XG4gICAgICAgIHRoaXMueiA9IHNhICogYXhpcy56O1xuICAgICAgICB0aGlzLncgPSBjYTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgcXVhdGVybmlvbiBmcm9tIEV1bGVyIGFuZ2xlcyBzcGVjaWZpZWQgaW4gWFlaIG9yZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8VmVjM30gZXggLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFggYXhpcyBpbiBkZWdyZWVzLiBJZiBleCBpcyBhIFZlYzMsIHRoZVxuICAgICAqIHRocmVlIGFuZ2xlcyB3aWxsIGJlIHJlYWQgZnJvbSBpdCBpbnN0ZWFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZXldIC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBZIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V6XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWiBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgcXVhdGVybmlvbiBmcm9tIDMgZXVsZXIgYW5nbGVzXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tRXVsZXJBbmdsZXMoNDUsIDkwLCAxODApO1xuICAgICAqXG4gICAgICogLy8gQ3JlYXRlIHRoZSBzYW1lIHF1YXRlcm5pb24gZnJvbSBhIHZlY3RvciBjb250YWluaW5nIHRoZSBzYW1lIDMgZXVsZXIgYW5nbGVzXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWMzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiByLnNldEZyb21FdWxlckFuZ2xlcyh2KTtcbiAgICAgKi9cbiAgICBzZXRGcm9tRXVsZXJBbmdsZXMoZXgsIGV5LCBleikge1xuICAgICAgICBpZiAoZXggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBjb25zdCB2ZWMgPSBleDtcbiAgICAgICAgICAgIGV4ID0gdmVjLng7XG4gICAgICAgICAgICBleSA9IHZlYy55O1xuICAgICAgICAgICAgZXogPSB2ZWMuejtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhhbGZUb1JhZCA9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgZXggKj0gaGFsZlRvUmFkO1xuICAgICAgICBleSAqPSBoYWxmVG9SYWQ7XG4gICAgICAgIGV6ICo9IGhhbGZUb1JhZDtcblxuICAgICAgICBjb25zdCBzeCA9IE1hdGguc2luKGV4KTtcbiAgICAgICAgY29uc3QgY3ggPSBNYXRoLmNvcyhleCk7XG4gICAgICAgIGNvbnN0IHN5ID0gTWF0aC5zaW4oZXkpO1xuICAgICAgICBjb25zdCBjeSA9IE1hdGguY29zKGV5KTtcbiAgICAgICAgY29uc3Qgc3ogPSBNYXRoLnNpbihleik7XG4gICAgICAgIGNvbnN0IGN6ID0gTWF0aC5jb3MoZXopO1xuXG4gICAgICAgIHRoaXMueCA9IHN4ICogY3kgKiBjeiAtIGN4ICogc3kgKiBzejtcbiAgICAgICAgdGhpcy55ID0gY3ggKiBzeSAqIGN6ICsgc3ggKiBjeSAqIHN6O1xuICAgICAgICB0aGlzLnogPSBjeCAqIGN5ICogc3ogLSBzeCAqIHN5ICogY3o7XG4gICAgICAgIHRoaXMudyA9IGN4ICogY3kgKiBjeiArIHN4ICogc3kgKiBzejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXggdG8gYSBxdWF0ZXJuaW9uLiBOb3RlIHRoYXQgc2luY2UgYSBxdWF0ZXJuaW9uIGlzIHB1cmVseSBhXG4gICAgICogcmVwcmVzZW50YXRpb24gZm9yIG9yaWVudGF0aW9uLCBvbmx5IHRoZSB0cmFuc2xhdGlvbmFsIHBhcnQgb2YgdGhlIG1hdHJpeCBpcyBsb3N0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWF0NC5qcycpLk1hdDR9IG0gLSBUaGUgNHg0IG1hdHJpeCB0byBjb252ZXJ0LlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXggb2YgMTgwIGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiBjb25zdCByb3QgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKlxuICAgICAqIC8vIENvbnZlcnQgdG8gYSBxdWF0ZXJuaW9uXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbU1hdDQocm90KTtcbiAgICAgKi9cbiAgICBzZXRGcm9tTWF0NChtKSB7XG4gICAgICAgIGxldCBtMDAsIG0wMSwgbTAyLCBtMTAsIG0xMSwgbTEyLCBtMjAsIG0yMSwgbTIyLFxuICAgICAgICAgICAgcywgcnMsIGx4LCBseSwgbHo7XG5cbiAgICAgICAgbSA9IG0uZGF0YTtcblxuICAgICAgICAvLyBDYWNoZSBtYXRyaXggdmFsdWVzIGZvciBzdXBlci1zcGVlZFxuICAgICAgICBtMDAgPSBtWzBdO1xuICAgICAgICBtMDEgPSBtWzFdO1xuICAgICAgICBtMDIgPSBtWzJdO1xuICAgICAgICBtMTAgPSBtWzRdO1xuICAgICAgICBtMTEgPSBtWzVdO1xuICAgICAgICBtMTIgPSBtWzZdO1xuICAgICAgICBtMjAgPSBtWzhdO1xuICAgICAgICBtMjEgPSBtWzldO1xuICAgICAgICBtMjIgPSBtWzEwXTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNjYWxlIGZyb20gdGhlIG1hdHJpeFxuICAgICAgICBseCA9IG0wMCAqIG0wMCArIG0wMSAqIG0wMSArIG0wMiAqIG0wMjtcbiAgICAgICAgaWYgKGx4ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx4ID0gMSAvIE1hdGguc3FydChseCk7XG4gICAgICAgIGx5ID0gbTEwICogbTEwICsgbTExICogbTExICsgbTEyICogbTEyO1xuICAgICAgICBpZiAobHkgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHkgPSAxIC8gTWF0aC5zcXJ0KGx5KTtcbiAgICAgICAgbHogPSBtMjAgKiBtMjAgKyBtMjEgKiBtMjEgKyBtMjIgKiBtMjI7XG4gICAgICAgIGlmIChseiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseiA9IDEgLyBNYXRoLnNxcnQobHopO1xuXG4gICAgICAgIG0wMCAqPSBseDtcbiAgICAgICAgbTAxICo9IGx4O1xuICAgICAgICBtMDIgKj0gbHg7XG4gICAgICAgIG0xMCAqPSBseTtcbiAgICAgICAgbTExICo9IGx5O1xuICAgICAgICBtMTIgKj0gbHk7XG4gICAgICAgIG0yMCAqPSBsejtcbiAgICAgICAgbTIxICo9IGx6O1xuICAgICAgICBtMjIgKj0gbHo7XG5cbiAgICAgICAgLy8gaHR0cDovL3d3dy5jcy51Y3IuZWR1L352YnovcmVzb3VyY2VzL3F1YXR1dC5wZGZcblxuICAgICAgICBjb25zdCB0ciA9IG0wMCArIG0xMSArIG0yMjtcbiAgICAgICAgaWYgKHRyID49IDApIHtcbiAgICAgICAgICAgIHMgPSBNYXRoLnNxcnQodHIgKyAxKTtcbiAgICAgICAgICAgIHRoaXMudyA9IHMgKiAwLjU7XG4gICAgICAgICAgICBzID0gMC41IC8gcztcbiAgICAgICAgICAgIHRoaXMueCA9IChtMTIgLSBtMjEpICogcztcbiAgICAgICAgICAgIHRoaXMueSA9IChtMjAgLSBtMDIpICogcztcbiAgICAgICAgICAgIHRoaXMueiA9IChtMDEgLSBtMTApICogcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtMDAgPiBtMTEpIHtcbiAgICAgICAgICAgICAgICBpZiAobTAwID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFhEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgICAgIHJzID0gKG0wMCAtIChtMTEgKyBtMjIpKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53ID0gKG0xMiAtIG0yMSkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy55ID0gKG0wMSArIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gKG0wMiArIG0yMCkgKiBycztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBaRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMjAgKyBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChtMTEgPiBtMjIpIHtcbiAgICAgICAgICAgICAgICAvLyBZRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgIHJzID0gKG0xMSAtIChtMjIgKyBtMDApKSArIDE7XG4gICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy55ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAobTIwIC0gbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMTIgKyBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0xMCArIG0wMSkgKiBycztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0wMSAtIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHF1YXRlcm5pb24gdGhhdCByZXByZXNlbnRzIHRoZSBzaG9ydGVzdCByb3RhdGlvbiBmcm9tIG9uZSBkaXJlY3Rpb24gdG8gYW5vdGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gZnJvbSAtIFRoZSBkaXJlY3Rpb24gdG8gcm90YXRlIGZyb20uIEl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gdG8gLSBUaGUgZGlyZWN0aW9uIHRvIHJvdGF0ZSB0by4gSXQgc2hvdWxkIGJlIG5vcm1hbGl6ZWQuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqXG4gICAgICoge0BsaW5rIGh0dHBzOi8vd3d3Lnhhcmcub3JnL3Byb29mL3F1YXRlcm5pb24tZnJvbS10d28tdmVjdG9ycy8gUHJvb2Ygb2YgY29ycmVjdG5lc3N9XG4gICAgICovXG4gICAgc2V0RnJvbURpcmVjdGlvbnMoZnJvbSwgdG8pIHtcbiAgICAgICAgY29uc3QgZG90UHJvZHVjdCA9IDEgKyBmcm9tLmRvdCh0byk7XG5cbiAgICAgICAgaWYgKGRvdFByb2R1Y3QgPCBOdW1iZXIuRVBTSUxPTikge1xuICAgICAgICAgICAgLy8gdGhlIHZlY3RvcnMgcG9pbnQgaW4gb3Bwb3NpdGUgZGlyZWN0aW9uc1xuICAgICAgICAgICAgLy8gc28gd2UgbmVlZCB0byByb3RhdGUgMTgwIGRlZ3JlZXMgYXJvdW5kIGFuIGFyYml0cmFyeSBvcnRob2dvbmFsIGF4aXNcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhmcm9tLngpID4gTWF0aC5hYnMoZnJvbS55KSkge1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IC1mcm9tLno7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnogPSBmcm9tLng7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSAtZnJvbS56O1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IGZyb20ueTtcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY3Jvc3MgcHJvZHVjdCBiZXR3ZWVuIHRoZSB0d28gdmVjdG9yc1xuICAgICAgICAgICAgdGhpcy54ID0gZnJvbS55ICogdG8ueiAtIGZyb20ueiAqIHRvLnk7XG4gICAgICAgICAgICB0aGlzLnkgPSBmcm9tLnogKiB0by54IC0gZnJvbS54ICogdG8uejtcbiAgICAgICAgICAgIHRoaXMueiA9IGZyb20ueCAqIHRvLnkgLSBmcm9tLnkgKiB0by54O1xuICAgICAgICAgICAgdGhpcy53ID0gZG90UHJvZHVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgc3BoZXJpY2FsIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gcXVhdGVybmlvbnMuIFRoZSByZXN1bHQgb2YgdGhlIGludGVycG9sYXRpb25cbiAgICAgKiBpcyB3cml0dGVuIHRvIHRoZSBxdWF0ZXJuaW9uIGNhbGxpbmcgdGhlIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSBsaHMgLSBUaGUgcXVhdGVybmlvbiB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBpbnRlcnBvbGF0aW9uIGluIHJlbGF0aW9uIHRvIHRoZSB0d28gaW5wdXRcbiAgICAgKiBxdWF0ZXJuaW9ucy4gVGhlIHZhbHVlIGlzIGluIHRoZSByYW5nZSAwIHRvIDEsIDAgZ2VuZXJhdGluZyBxMSwgMSBnZW5lcmF0aW5nIHEyIGFuZCBhbnl0aGluZ1xuICAgICAqIGluIGJldHdlZW4gZ2VuZXJhdGluZyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdGhlIHR3by5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxMSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIGNvbnN0IHEyID0gbmV3IHBjLlF1YXQoLTAuMjEsIC0wLjIxLCAtMC42NywgMC42OCk7XG4gICAgICpcbiAgICAgKiBjb25zdCByZXN1bHQ7XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDApOyAgIC8vIFJldHVybiBxMVxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwLjUpOyAvLyBSZXR1cm4gdGhlIG1pZHBvaW50IGludGVycG9sYW50XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDEpOyAgIC8vIFJldHVybiBxMlxuICAgICAqL1xuICAgIHNsZXJwKGxocywgcmhzLCBhbHBoYSkge1xuICAgICAgICAvLyBBbGdvcml0aG0gc291cmNlZCBmcm9tOlxuICAgICAgICAvLyBodHRwOi8vd3d3LmV1Y2xpZGVhbnNwYWNlLmNvbS9tYXRocy9hbGdlYnJhL3JlYWxOb3JtZWRBbGdlYnJhL3F1YXRlcm5pb25zL3NsZXJwL1xuICAgICAgICBjb25zdCBseCA9IGxocy54O1xuICAgICAgICBjb25zdCBseSA9IGxocy55O1xuICAgICAgICBjb25zdCBseiA9IGxocy56O1xuICAgICAgICBjb25zdCBsdyA9IGxocy53O1xuICAgICAgICBsZXQgcnggPSByaHMueDtcbiAgICAgICAgbGV0IHJ5ID0gcmhzLnk7XG4gICAgICAgIGxldCByeiA9IHJocy56O1xuICAgICAgICBsZXQgcncgPSByaHMudztcblxuICAgICAgICAvLyBDYWxjdWxhdGUgYW5nbGUgYmV0d2VlbiB0aGVtLlxuICAgICAgICBsZXQgY29zSGFsZlRoZXRhID0gbHcgKiBydyArIGx4ICogcnggKyBseSAqIHJ5ICsgbHogKiByejtcblxuICAgICAgICBpZiAoY29zSGFsZlRoZXRhIDwgMCkge1xuICAgICAgICAgICAgcncgPSAtcnc7XG4gICAgICAgICAgICByeCA9IC1yeDtcbiAgICAgICAgICAgIHJ5ID0gLXJ5O1xuICAgICAgICAgICAgcnogPSAtcno7XG4gICAgICAgICAgICBjb3NIYWxmVGhldGEgPSAtY29zSGFsZlRoZXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbGhzID09IHJocyBvciBsaHMgPT0gLXJocyB0aGVuIHRoZXRhID09IDAgYW5kIHdlIGNhbiByZXR1cm4gbGhzXG4gICAgICAgIGlmIChNYXRoLmFicyhjb3NIYWxmVGhldGEpID49IDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IGx3O1xuICAgICAgICAgICAgdGhpcy54ID0gbHg7XG4gICAgICAgICAgICB0aGlzLnkgPSBseTtcbiAgICAgICAgICAgIHRoaXMueiA9IGx6O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxjdWxhdGUgdGVtcG9yYXJ5IHZhbHVlcy5cbiAgICAgICAgY29uc3QgaGFsZlRoZXRhID0gTWF0aC5hY29zKGNvc0hhbGZUaGV0YSk7XG4gICAgICAgIGNvbnN0IHNpbkhhbGZUaGV0YSA9IE1hdGguc3FydCgxIC0gY29zSGFsZlRoZXRhICogY29zSGFsZlRoZXRhKTtcblxuICAgICAgICAvLyBJZiB0aGV0YSA9IDE4MCBkZWdyZWVzIHRoZW4gcmVzdWx0IGlzIG5vdCBmdWxseSBkZWZpbmVkXG4gICAgICAgIC8vIHdlIGNvdWxkIHJvdGF0ZSBhcm91bmQgYW55IGF4aXMgbm9ybWFsIHRvIHFhIG9yIHFiXG4gICAgICAgIGlmIChNYXRoLmFicyhzaW5IYWxmVGhldGEpIDwgMC4wMDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IChsdyAqIDAuNSArIHJ3ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueCA9IChseCAqIDAuNSArIHJ4ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueSA9IChseSAqIDAuNSArIHJ5ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueiA9IChseiAqIDAuNSArIHJ6ICogMC41KTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmF0aW9BID0gTWF0aC5zaW4oKDEgLSBhbHBoYSkgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuICAgICAgICBjb25zdCByYXRpb0IgPSBNYXRoLnNpbihhbHBoYSAqIGhhbGZUaGV0YSkgLyBzaW5IYWxmVGhldGE7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIFF1YXRlcm5pb24uXG4gICAgICAgIHRoaXMudyA9IChsdyAqIHJhdGlvQSArIHJ3ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy54ID0gKGx4ICogcmF0aW9BICsgcnggKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnkgPSAobHkgKiByYXRpb0EgKyByeSAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueiA9IChseiAqIHJhdGlvQSArIHJ6ICogcmF0aW9CKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdmVjIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlIHRyYW5zZm9ybWF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgaW5wdXQgdmVjdG9yIHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICpcbiAgICAgKiBjb25zdCB0diA9IHEudHJhbnNmb3JtVmVjdG9yKHYpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlY3Rvcih2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgeCA9IHZlYy54LCB5ID0gdmVjLnksIHogPSB2ZWMuejtcbiAgICAgICAgY29uc3QgcXggPSB0aGlzLngsIHF5ID0gdGhpcy55LCBxeiA9IHRoaXMueiwgcXcgPSB0aGlzLnc7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHF1YXQgKiB2ZWNcbiAgICAgICAgY29uc3QgaXggPSBxdyAqIHggKyBxeSAqIHogLSBxeiAqIHk7XG4gICAgICAgIGNvbnN0IGl5ID0gcXcgKiB5ICsgcXogKiB4IC0gcXggKiB6O1xuICAgICAgICBjb25zdCBpeiA9IHF3ICogeiArIHF4ICogeSAtIHF5ICogeDtcbiAgICAgICAgY29uc3QgaXcgPSAtcXggKiB4IC0gcXkgKiB5IC0gcXogKiB6O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSByZXN1bHQgKiBpbnZlcnNlIHF1YXRcbiAgICAgICAgcmVzLnggPSBpeCAqIHF3ICsgaXcgKiAtcXggKyBpeSAqIC1xeiAtIGl6ICogLXF5O1xuICAgICAgICByZXMueSA9IGl5ICogcXcgKyBpdyAqIC1xeSArIGl6ICogLXF4IC0gaXggKiAtcXo7XG4gICAgICAgIHJlcy56ID0gaXogKiBxdyArIGl3ICogLXF6ICsgaXggKiAtcXkgLSBpeSAqIC1xeDtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBxdWF0ZXJuaW9uIHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHF1YXRlcm5pb24gaW4gc3RyaW5nIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgMSk7XG4gICAgICogLy8gT3V0cHV0cyBbMCwgMCwgMCwgMV1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fSwgJHt0aGlzLnp9LCAke3RoaXMud31dYDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHF1YXRlcm5pb24gc2V0IHRvIFswLCAwLCAwLCAxXSAodGhlIGlkZW50aXR5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBJREVOVElUWSA9IE9iamVjdC5mcmVlemUobmV3IFF1YXQoMCwgMCwgMCwgMSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBxdWF0ZXJuaW9uIHNldCB0byBbMCwgMCwgMCwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgWkVSTyA9IE9iamVjdC5mcmVlemUobmV3IFF1YXQoMCwgMCwgMCwgMCkpO1xufVxuXG5leHBvcnQgeyBRdWF0IH07XG4iXSwibmFtZXMiOlsiUXVhdCIsImNvbnN0cnVjdG9yIiwieCIsInkiLCJ6IiwidyIsImxlbmd0aCIsImNsb25lIiwiY3N0ciIsImNvbmp1Z2F0ZSIsInNyYyIsImNvcHkiLCJyaHMiLCJlcXVhbHMiLCJlcXVhbHNBcHByb3giLCJlcHNpbG9uIiwiTWF0aCIsImFicyIsImdldEF4aXNBbmdsZSIsImF4aXMiLCJyYWQiLCJhY29zIiwicyIsInNpbiIsIm1hdGgiLCJSQURfVE9fREVHIiwiZ2V0RXVsZXJBbmdsZXMiLCJldWxlcnMiLCJWZWMzIiwicXgiLCJxeSIsInF6IiwicXciLCJhMiIsImF0YW4yIiwiUEkiLCJhc2luIiwic2V0IiwibXVsU2NhbGFyIiwiaW52ZXJ0Iiwibm9ybWFsaXplIiwic3FydCIsImxlbmd0aFNxIiwibXVsIiwicTF4IiwicTF5IiwicTF6IiwicTF3IiwicTJ4IiwicTJ5IiwicTJ6IiwicTJ3IiwibXVsMiIsImxocyIsImxlbiIsInNldEZyb21BeGlzQW5nbGUiLCJhbmdsZSIsIkRFR19UT19SQUQiLCJzYSIsImNhIiwiY29zIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZXgiLCJleSIsImV6IiwidmVjIiwiaGFsZlRvUmFkIiwic3giLCJjeCIsInN5IiwiY3kiLCJzeiIsImN6Iiwic2V0RnJvbU1hdDQiLCJtIiwibTAwIiwibTAxIiwibTAyIiwibTEwIiwibTExIiwibTEyIiwibTIwIiwibTIxIiwibTIyIiwicnMiLCJseCIsImx5IiwibHoiLCJkYXRhIiwidHIiLCJzZXRGcm9tRGlyZWN0aW9ucyIsImZyb20iLCJ0byIsImRvdFByb2R1Y3QiLCJkb3QiLCJOdW1iZXIiLCJFUFNJTE9OIiwic2xlcnAiLCJhbHBoYSIsImx3IiwicngiLCJyeSIsInJ6IiwicnciLCJjb3NIYWxmVGhldGEiLCJoYWxmVGhldGEiLCJzaW5IYWxmVGhldGEiLCJyYXRpb0EiLCJyYXRpb0IiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyZXMiLCJpeCIsIml5IiwiaXoiLCJpdyIsInRvU3RyaW5nIiwiX2NsYXNzIiwiSURFTlRJVFkiLCJPYmplY3QiLCJmcmVlemUiLCJaRVJPIl0sIm1hcHBpbmdzIjoiOzs7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLENBQUM7QUE2QlA7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFyQ3hDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUgsQ0FBQyxHQUFBLEtBQUEs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
