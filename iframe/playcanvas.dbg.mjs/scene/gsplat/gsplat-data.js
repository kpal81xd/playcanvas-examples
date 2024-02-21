import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

const vec3 = new Vec3();
const mat4 = new Mat4();
const quat = new Quat();
const quat2 = new Quat();
const aabb = new BoundingBox();
const aabb2 = new BoundingBox();
const debugPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];
const debugLines = [debugPoints[0], debugPoints[1], debugPoints[1], debugPoints[3], debugPoints[3], debugPoints[2], debugPoints[2], debugPoints[0], debugPoints[4], debugPoints[5], debugPoints[5], debugPoints[7], debugPoints[7], debugPoints[6], debugPoints[6], debugPoints[4], debugPoints[0], debugPoints[4], debugPoints[1], debugPoints[5], debugPoints[2], debugPoints[6], debugPoints[3], debugPoints[7]];
const debugColor = new Color(1, 1, 0, 0.4);

/**
 * Defines the shape of a SplatTRS.
 * @typedef {object} SplatTRS - Represents a splat object with position, rotation, and scale.
 * @property {number} x - The x-coordinate of the position.
 * @property {number} y - The y-coordinate of the position.
 * @property {number} z - The z-coordinate of the position.
 * @property {number} rx - The x-component of the quaternion rotation.
 * @property {number} ry - The y-component of the quaternion rotation.
 * @property {number} rz - The z-component of the quaternion rotation.
 * @property {number} rw - The w-component of the quaternion rotation.
 * @property {number} sx - The scale factor in the x-direction.
 * @property {number} sy - The scale factor in the y-direction.
 * @property {number} sz - The scale factor in the z-direction.
 */

/**
 * @param {Mat4} result - Mat4 instance holding calculated rotation matrix.
 * @param {SplatTRS} data - The splat TRS object.
 */
const calcSplatMat = (result, data) => {
  const px = data.x;
  const py = data.y;
  const pz = data.z;
  const d = Math.sqrt(data.rx * data.rx + data.ry * data.ry + data.rz * data.rz + data.rw * data.rw);
  const x = data.rx / d;
  const y = data.ry / d;
  const z = data.rz / d;
  const w = data.rw / d;

  // build rotation matrix
  result.data.set([1.0 - 2.0 * (z * z + w * w), 2.0 * (y * z + x * w), 2.0 * (y * w - x * z), 0, 2.0 * (y * z - x * w), 1.0 - 2.0 * (y * y + w * w), 2.0 * (z * w + x * y), 0, 2.0 * (y * w + x * z), 2.0 * (z * w - x * y), 1.0 - 2.0 * (y * y + z * z), 0, px, py, pz, 1]);
};
class GSplatData {
  // /**
  //  * @param {import('./ply-reader').PlyElement[]} elements - The elements.
  //  * @param {boolean} [performZScale] - Whether to perform z scaling.
  //  */
  constructor(elements, performZScale = true) {
    // /** @type {import('./ply-reader').PlyElement[]} */
    this.elements = void 0;
    // /** @type {import('./ply-reader').PlyElement} */
    this.vertexElement = void 0;
    this.elements = elements;
    this.vertexElement = elements.find(element => element.name === 'vertex');
    if (!this.isCompressed && performZScale) {
      mat4.setScale(-1, -1, 1);
      this.transform(mat4);
    }
  }
  get numSplats() {
    return this.vertexElement.count;
  }

  /**
   * @param {BoundingBox} result - Bounding box instance holding calculated result.
   * @param {SplatTRS} data - The splat TRS object.
   */
  static calcSplatAabb(result, data) {
    calcSplatMat(mat4, data);
    aabb.center.set(0, 0, 0);
    aabb.halfExtents.set(data.sx * 2, data.sy * 2, data.sz * 2);
    result.setFromTransformedAabb(aabb, mat4);
  }

  /**
   * Transform splat data by the given matrix.
   *
   * @param {Mat4} mat - The matrix.
   */
  transform(mat) {
    const x = this.getProp('x');
    const y = this.getProp('y');
    const z = this.getProp('z');
    const rx = this.getProp('rot_0');
    const ry = this.getProp('rot_1');
    const rz = this.getProp('rot_2');
    const rw = this.getProp('rot_3');
    quat2.setFromMat4(mat);
    for (let i = 0; i < this.numSplats; ++i) {
      // transform center
      vec3.set(x[i], y[i], z[i]);
      mat.transformPoint(vec3, vec3);
      x[i] = vec3.x;
      y[i] = vec3.y;
      z[i] = vec3.z;

      // transform orientation
      quat.set(ry[i], rz[i], rw[i], rx[i]).mul2(quat2, quat);
      rx[i] = quat.w;
      ry[i] = quat.x;
      rz[i] = quat.y;
      rw[i] = quat.z;

      // TODO: transform SH
    }
  }

  // access a named property
  getProp(name) {
    var _this$vertexElement$p;
    return (_this$vertexElement$p = this.vertexElement.properties.find(property => property.name === name && property.storage)) == null ? void 0 : _this$vertexElement$p.storage;
  }

  // add a new property
  addProp(name, storage) {
    this.vertexElement.properties.push({
      type: 'float',
      name,
      storage,
      byteSize: 4
    });
  }

  // calculate scene aabb taking into account splat size
  calcAabb(result, pred) {
    const x = this.getProp('x');
    const y = this.getProp('y');
    const z = this.getProp('z');
    const rx = this.getProp('rot_0');
    const ry = this.getProp('rot_1');
    const rz = this.getProp('rot_2');
    const rw = this.getProp('rot_3');
    const sx = this.getProp('scale_0');
    const sy = this.getProp('scale_1');
    const sz = this.getProp('scale_2');
    const splat = {
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      rw: 0,
      sx: 0,
      sy: 0,
      sz: 0
    };
    let first = true;
    for (let i = 0; i < this.numSplats; ++i) {
      if (pred && !pred(i)) {
        continue;
      }
      splat.x = x[i];
      splat.y = y[i];
      splat.z = z[i];
      splat.rx = rx[i];
      splat.ry = ry[i];
      splat.rz = rz[i];
      splat.rw = rw[i];
      splat.sx = Math.exp(sx[i]);
      splat.sy = Math.exp(sy[i]);
      splat.sz = Math.exp(sz[i]);
      if (first) {
        first = false;
        GSplatData.calcSplatAabb(result, splat);
      } else {
        GSplatData.calcSplatAabb(aabb2, splat);
        result.add(aabb2);
      }
    }
    return !first;
  }

  /**
   * @param {Vec3} result - The result.
   * @param {Function} pred - Predicate given index for skipping.
   */
  calcFocalPoint(result, pred) {
    const x = this.getProp('x');
    const y = this.getProp('y');
    const z = this.getProp('z');
    const sx = this.getProp('scale_0');
    const sy = this.getProp('scale_1');
    const sz = this.getProp('scale_2');
    result.x = 0;
    result.y = 0;
    result.z = 0;
    let sum = 0;
    for (let i = 0; i < this.numSplats; ++i) {
      if (pred && !pred(i)) {
        continue;
      }
      const weight = 1.0 / (1.0 + Math.exp(Math.max(sx[i], sy[i], sz[i])));
      result.x += x[i] * weight;
      result.y += y[i] * weight;
      result.z += z[i] * weight;
      sum += weight;
    }
    result.mulScalar(1 / sum);
  }

  /**
   * @param {import('../scene.js').Scene} scene - The application's scene.
   * @param {Mat4} worldMat - The world matrix.
   */
  renderWireframeBounds(scene, worldMat) {
    const x = this.getProp('x');
    const y = this.getProp('y');
    const z = this.getProp('z');
    const rx = this.getProp('rot_0');
    const ry = this.getProp('rot_1');
    const rz = this.getProp('rot_2');
    const rw = this.getProp('rot_3');
    const sx = this.getProp('scale_0');
    const sy = this.getProp('scale_1');
    const sz = this.getProp('scale_2');
    const splat = {
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      rw: 0,
      sx: 0,
      sy: 0,
      sz: 0
    };
    for (let i = 0; i < this.numSplats; ++i) {
      splat.x = x[i];
      splat.y = y[i];
      splat.z = z[i];
      splat.rx = rx[i];
      splat.ry = ry[i];
      splat.rz = rz[i];
      splat.rw = rw[i];
      splat.sx = Math.exp(sx[i]);
      splat.sy = Math.exp(sy[i]);
      splat.sz = Math.exp(sz[i]);
      calcSplatMat(mat4, splat);
      mat4.mul2(worldMat, mat4);
      for (let j = 0; j < 8; ++j) {
        vec3.set(splat.sx * 2 * (j & 1 ? 1 : -1), splat.sy * 2 * (j & 2 ? 1 : -1), splat.sz * 2 * (j & 4 ? 1 : -1));
        mat4.transformPoint(vec3, debugPoints[j]);
      }
      scene.drawLineArrays(debugLines, debugColor);
    }
  }

  // compressed splats
  get isCompressed() {
    return this.elements.some(e => e.name === 'chunk') && ['packed_position', 'packed_rotation', 'packed_scale', 'packed_color'].every(name => this.getProp(name));
  }
  decompress() {
    const members = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2'];
    const chunks = this.elements.find(e => e.name === 'chunk');
    const vertices = this.vertexElement;

    // allocate uncompressed data
    const data = {};
    members.forEach(name => {
      data[name] = new Float32Array(vertices.count);
    });
    const getChunkProp = name => {
      var _chunks$properties$fi;
      return (_chunks$properties$fi = chunks.properties.find(p => p.name === name && p.storage)) == null ? void 0 : _chunks$properties$fi.storage;
    };
    const min_x = getChunkProp('min_x');
    const min_y = getChunkProp('min_y');
    const min_z = getChunkProp('min_z');
    const max_x = getChunkProp('max_x');
    const max_y = getChunkProp('max_y');
    const max_z = getChunkProp('max_z');
    const min_scale_x = getChunkProp('min_scale_x');
    const min_scale_y = getChunkProp('min_scale_y');
    const min_scale_z = getChunkProp('min_scale_z');
    const max_scale_x = getChunkProp('max_scale_x');
    const max_scale_y = getChunkProp('max_scale_y');
    const max_scale_z = getChunkProp('max_scale_z');
    const position = this.getProp('packed_position');
    const rotation = this.getProp('packed_rotation');
    const scale = this.getProp('packed_scale');
    const color = this.getProp('packed_color');
    const unpackUnorm = (value, bits) => {
      const t = (1 << bits) - 1;
      return (value & t) / t;
    };
    const unpack111011 = (result, value) => {
      result.x = unpackUnorm(value >>> 21, 11);
      result.y = unpackUnorm(value >>> 11, 10);
      result.z = unpackUnorm(value, 11);
    };
    const unpack8888 = (result, value) => {
      result.x = unpackUnorm(value >>> 24, 8);
      result.y = unpackUnorm(value >>> 16, 8);
      result.z = unpackUnorm(value >>> 8, 8);
      result.w = unpackUnorm(value, 8);
    };

    // unpack quaternion with 2,10,10,10 format (largest element, 3x10bit element)
    const unpackRot = (result, value) => {
      const norm = 1.0 / (Math.sqrt(2) * 0.5);
      const a = (unpackUnorm(value >>> 20, 10) - 0.5) * norm;
      const b = (unpackUnorm(value >>> 10, 10) - 0.5) * norm;
      const c = (unpackUnorm(value, 10) - 0.5) * norm;
      const m = Math.sqrt(1.0 - (a * a + b * b + c * c));
      switch (value >>> 30) {
        case 0:
          result.set(m, a, b, c);
          break;
        case 1:
          result.set(a, m, b, c);
          break;
        case 2:
          result.set(a, b, m, c);
          break;
        case 3:
          result.set(a, b, c, m);
          break;
      }
    };
    const lerp = (a, b, t) => a * (1 - t) + b * t;
    const p = new Vec3();
    const r = new Quat();
    const s = new Vec3();
    const c = new Vec4();
    for (let i = 0; i < vertices.count; ++i) {
      const ci = Math.floor(i / 256);
      unpack111011(p, position[i]);
      unpackRot(r, rotation[i]);
      unpack111011(s, scale[i]);
      unpack8888(c, color[i]);
      data.x[i] = lerp(min_x[ci], max_x[ci], p.x);
      data.y[i] = lerp(min_y[ci], max_y[ci], p.y);
      data.z[i] = lerp(min_z[ci], max_z[ci], p.z);
      data.rot_0[i] = r.x;
      data.rot_1[i] = r.y;
      data.rot_2[i] = r.z;
      data.rot_3[i] = r.w;
      data.scale_0[i] = lerp(min_scale_x[ci], max_scale_x[ci], s.x);
      data.scale_1[i] = lerp(min_scale_y[ci], max_scale_y[ci], s.y);
      data.scale_2[i] = lerp(min_scale_z[ci], max_scale_z[ci], s.z);
      const SH_C0 = 0.28209479177387814;
      data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
      data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
      data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
      data.opacity[i] = -Math.log(1 / c.w - 1);
    }
    return new GSplatData([{
      name: 'vertex',
      count: vertices.count,
      properties: members.map(name => {
        return {
          name: name,
          type: 'float',
          byteSize: 4,
          storage: data[name]
        };
      })
    }], false);
  }
}

export { GSplatData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3NwbGF0LWRhdGEuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9nc3BsYXQvZ3NwbGF0LWRhdGEuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5jb25zdCB2ZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IG1hdDQgPSBuZXcgTWF0NCgpO1xuY29uc3QgcXVhdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBxdWF0MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBhYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBhYWJiMiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG5jb25zdCBkZWJ1Z1BvaW50cyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcbmNvbnN0IGRlYnVnTGluZXMgPSBbXG4gICAgZGVidWdQb2ludHNbMF0sIGRlYnVnUG9pbnRzWzFdLCBkZWJ1Z1BvaW50c1sxXSwgZGVidWdQb2ludHNbM10sIGRlYnVnUG9pbnRzWzNdLCBkZWJ1Z1BvaW50c1syXSwgZGVidWdQb2ludHNbMl0sIGRlYnVnUG9pbnRzWzBdLFxuICAgIGRlYnVnUG9pbnRzWzRdLCBkZWJ1Z1BvaW50c1s1XSwgZGVidWdQb2ludHNbNV0sIGRlYnVnUG9pbnRzWzddLCBkZWJ1Z1BvaW50c1s3XSwgZGVidWdQb2ludHNbNl0sIGRlYnVnUG9pbnRzWzZdLCBkZWJ1Z1BvaW50c1s0XSxcbiAgICBkZWJ1Z1BvaW50c1swXSwgZGVidWdQb2ludHNbNF0sIGRlYnVnUG9pbnRzWzFdLCBkZWJ1Z1BvaW50c1s1XSwgZGVidWdQb2ludHNbMl0sIGRlYnVnUG9pbnRzWzZdLCBkZWJ1Z1BvaW50c1szXSwgZGVidWdQb2ludHNbN11cbl07XG5jb25zdCBkZWJ1Z0NvbG9yID0gbmV3IENvbG9yKDEsIDEsIDAsIDAuNCk7XG5cbi8qKlxuICogRGVmaW5lcyB0aGUgc2hhcGUgb2YgYSBTcGxhdFRSUy5cbiAqIEB0eXBlZGVmIHtvYmplY3R9IFNwbGF0VFJTIC0gUmVwcmVzZW50cyBhIHNwbGF0IG9iamVjdCB3aXRoIHBvc2l0aW9uLCByb3RhdGlvbiwgYW5kIHNjYWxlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSBwb3NpdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSB5IC0gVGhlIHktY29vcmRpbmF0ZSBvZiB0aGUgcG9zaXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0geiAtIFRoZSB6LWNvb3JkaW5hdGUgb2YgdGhlIHBvc2l0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJ4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJ5IC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJ6IC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJ3IC0gVGhlIHctY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN4IC0gVGhlIHNjYWxlIGZhY3RvciBpbiB0aGUgeC1kaXJlY3Rpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3kgLSBUaGUgc2NhbGUgZmFjdG9yIGluIHRoZSB5LWRpcmVjdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzeiAtIFRoZSBzY2FsZSBmYWN0b3IgaW4gdGhlIHotZGlyZWN0aW9uLlxuICovXG5cbi8qKlxuICogQHBhcmFtIHtNYXQ0fSByZXN1bHQgLSBNYXQ0IGluc3RhbmNlIGhvbGRpbmcgY2FsY3VsYXRlZCByb3RhdGlvbiBtYXRyaXguXG4gKiBAcGFyYW0ge1NwbGF0VFJTfSBkYXRhIC0gVGhlIHNwbGF0IFRSUyBvYmplY3QuXG4gKi9cbmNvbnN0IGNhbGNTcGxhdE1hdCA9IChyZXN1bHQsIGRhdGEpID0+IHtcbiAgICBjb25zdCBweCA9IGRhdGEueDtcbiAgICBjb25zdCBweSA9IGRhdGEueTtcbiAgICBjb25zdCBweiA9IGRhdGEuejtcbiAgICBjb25zdCBkID0gTWF0aC5zcXJ0KGRhdGEucnggKiBkYXRhLnJ4ICsgZGF0YS5yeSAqIGRhdGEucnkgKyBkYXRhLnJ6ICogZGF0YS5yeiArIGRhdGEucncgKiBkYXRhLnJ3KTtcbiAgICBjb25zdCB4ID0gZGF0YS5yeCAvIGQ7XG4gICAgY29uc3QgeSA9IGRhdGEucnkgLyBkO1xuICAgIGNvbnN0IHogPSBkYXRhLnJ6IC8gZDtcbiAgICBjb25zdCB3ID0gZGF0YS5ydyAvIGQ7XG5cbiAgICAvLyBidWlsZCByb3RhdGlvbiBtYXRyaXhcbiAgICByZXN1bHQuZGF0YS5zZXQoW1xuICAgICAgICAxLjAgLSAyLjAgKiAoeiAqIHogKyB3ICogdyksXG4gICAgICAgIDIuMCAqICh5ICogeiArIHggKiB3KSxcbiAgICAgICAgMi4wICogKHkgKiB3IC0geCAqIHopLFxuICAgICAgICAwLFxuXG4gICAgICAgIDIuMCAqICh5ICogeiAtIHggKiB3KSxcbiAgICAgICAgMS4wIC0gMi4wICogKHkgKiB5ICsgdyAqIHcpLFxuICAgICAgICAyLjAgKiAoeiAqIHcgKyB4ICogeSksXG4gICAgICAgIDAsXG5cbiAgICAgICAgMi4wICogKHkgKiB3ICsgeCAqIHopLFxuICAgICAgICAyLjAgKiAoeiAqIHcgLSB4ICogeSksXG4gICAgICAgIDEuMCAtIDIuMCAqICh5ICogeSArIHogKiB6KSxcbiAgICAgICAgMCxcblxuICAgICAgICBweCwgcHksIHB6LCAxXG4gICAgXSk7XG59O1xuXG5jbGFzcyBHU3BsYXREYXRhIHtcbiAgICAvLyAvKiogQHR5cGUge2ltcG9ydCgnLi9wbHktcmVhZGVyJykuUGx5RWxlbWVudFtdfSAqL1xuICAgIGVsZW1lbnRzO1xuXG4gICAgLy8gLyoqIEB0eXBlIHtpbXBvcnQoJy4vcGx5LXJlYWRlcicpLlBseUVsZW1lbnR9ICovXG4gICAgdmVydGV4RWxlbWVudDtcblxuICAgIC8vIC8qKlxuICAgIC8vICAqIEBwYXJhbSB7aW1wb3J0KCcuL3BseS1yZWFkZXInKS5QbHlFbGVtZW50W119IGVsZW1lbnRzIC0gVGhlIGVsZW1lbnRzLlxuICAgIC8vICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3BlcmZvcm1aU2NhbGVdIC0gV2hldGhlciB0byBwZXJmb3JtIHogc2NhbGluZy5cbiAgICAvLyAgKi9cbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50cywgcGVyZm9ybVpTY2FsZSA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IGVsZW1lbnRzO1xuICAgICAgICB0aGlzLnZlcnRleEVsZW1lbnQgPSBlbGVtZW50cy5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC5uYW1lID09PSAndmVydGV4Jyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmlzQ29tcHJlc3NlZCAmJiBwZXJmb3JtWlNjYWxlKSB7XG4gICAgICAgICAgICBtYXQ0LnNldFNjYWxlKC0xLCAtMSwgMSk7XG4gICAgICAgICAgICB0aGlzLnRyYW5zZm9ybShtYXQ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBudW1TcGxhdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZlcnRleEVsZW1lbnQuY291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtCb3VuZGluZ0JveH0gcmVzdWx0IC0gQm91bmRpbmcgYm94IGluc3RhbmNlIGhvbGRpbmcgY2FsY3VsYXRlZCByZXN1bHQuXG4gICAgICogQHBhcmFtIHtTcGxhdFRSU30gZGF0YSAtIFRoZSBzcGxhdCBUUlMgb2JqZWN0LlxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxjU3BsYXRBYWJiKHJlc3VsdCwgZGF0YSkge1xuICAgICAgICBjYWxjU3BsYXRNYXQobWF0NCwgZGF0YSk7XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQoZGF0YS5zeCAqIDIsIGRhdGEuc3kgKiAyLCBkYXRhLnN6ICogMik7XG4gICAgICAgIHJlc3VsdC5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIG1hdDQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybSBzcGxhdCBkYXRhIGJ5IHRoZSBnaXZlbiBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdCAtIFRoZSBtYXRyaXguXG4gICAgICovXG4gICAgdHJhbnNmb3JtKG1hdCkge1xuICAgICAgICBjb25zdCB4ID0gdGhpcy5nZXRQcm9wKCd4Jyk7XG4gICAgICAgIGNvbnN0IHkgPSB0aGlzLmdldFByb3AoJ3knKTtcbiAgICAgICAgY29uc3QgeiA9IHRoaXMuZ2V0UHJvcCgneicpO1xuXG4gICAgICAgIGNvbnN0IHJ4ID0gdGhpcy5nZXRQcm9wKCdyb3RfMCcpO1xuICAgICAgICBjb25zdCByeSA9IHRoaXMuZ2V0UHJvcCgncm90XzEnKTtcbiAgICAgICAgY29uc3QgcnogPSB0aGlzLmdldFByb3AoJ3JvdF8yJyk7XG4gICAgICAgIGNvbnN0IHJ3ID0gdGhpcy5nZXRQcm9wKCdyb3RfMycpO1xuXG4gICAgICAgIHF1YXQyLnNldEZyb21NYXQ0KG1hdCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm51bVNwbGF0czsgKytpKSB7XG4gICAgICAgICAgICAvLyB0cmFuc2Zvcm0gY2VudGVyXG4gICAgICAgICAgICB2ZWMzLnNldCh4W2ldLCB5W2ldLCB6W2ldKTtcbiAgICAgICAgICAgIG1hdC50cmFuc2Zvcm1Qb2ludCh2ZWMzLCB2ZWMzKTtcbiAgICAgICAgICAgIHhbaV0gPSB2ZWMzLng7XG4gICAgICAgICAgICB5W2ldID0gdmVjMy55O1xuICAgICAgICAgICAgeltpXSA9IHZlYzMuejtcblxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtIG9yaWVudGF0aW9uXG4gICAgICAgICAgICBxdWF0LnNldChyeVtpXSwgcnpbaV0sIHJ3W2ldLCByeFtpXSkubXVsMihxdWF0MiwgcXVhdCk7XG4gICAgICAgICAgICByeFtpXSA9IHF1YXQudztcbiAgICAgICAgICAgIHJ5W2ldID0gcXVhdC54O1xuICAgICAgICAgICAgcnpbaV0gPSBxdWF0Lnk7XG4gICAgICAgICAgICByd1tpXSA9IHF1YXQuejtcblxuICAgICAgICAgICAgLy8gVE9ETzogdHJhbnNmb3JtIFNIXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhY2Nlc3MgYSBuYW1lZCBwcm9wZXJ0eVxuICAgIGdldFByb3AobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy52ZXJ0ZXhFbGVtZW50LnByb3BlcnRpZXMuZmluZChwcm9wZXJ0eSA9PiBwcm9wZXJ0eS5uYW1lID09PSBuYW1lICYmIHByb3BlcnR5LnN0b3JhZ2UpPy5zdG9yYWdlO1xuICAgIH1cblxuICAgIC8vIGFkZCBhIG5ldyBwcm9wZXJ0eVxuICAgIGFkZFByb3AobmFtZSwgc3RvcmFnZSkge1xuICAgICAgICB0aGlzLnZlcnRleEVsZW1lbnQucHJvcGVydGllcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICdmbG9hdCcsXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgc3RvcmFnZSxcbiAgICAgICAgICAgIGJ5dGVTaXplOiA0XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBzY2VuZSBhYWJiIHRha2luZyBpbnRvIGFjY291bnQgc3BsYXQgc2l6ZVxuICAgIGNhbGNBYWJiKHJlc3VsdCwgcHJlZCkge1xuICAgICAgICBjb25zdCB4ID0gdGhpcy5nZXRQcm9wKCd4Jyk7XG4gICAgICAgIGNvbnN0IHkgPSB0aGlzLmdldFByb3AoJ3knKTtcbiAgICAgICAgY29uc3QgeiA9IHRoaXMuZ2V0UHJvcCgneicpO1xuXG4gICAgICAgIGNvbnN0IHJ4ID0gdGhpcy5nZXRQcm9wKCdyb3RfMCcpO1xuICAgICAgICBjb25zdCByeSA9IHRoaXMuZ2V0UHJvcCgncm90XzEnKTtcbiAgICAgICAgY29uc3QgcnogPSB0aGlzLmdldFByb3AoJ3JvdF8yJyk7XG4gICAgICAgIGNvbnN0IHJ3ID0gdGhpcy5nZXRQcm9wKCdyb3RfMycpO1xuXG4gICAgICAgIGNvbnN0IHN4ID0gdGhpcy5nZXRQcm9wKCdzY2FsZV8wJyk7XG4gICAgICAgIGNvbnN0IHN5ID0gdGhpcy5nZXRQcm9wKCdzY2FsZV8xJyk7XG4gICAgICAgIGNvbnN0IHN6ID0gdGhpcy5nZXRQcm9wKCdzY2FsZV8yJyk7XG5cbiAgICAgICAgY29uc3Qgc3BsYXQgPSB7XG4gICAgICAgICAgICB4OiAwLCB5OiAwLCB6OiAwLCByeDogMCwgcnk6IDAsIHJ6OiAwLCBydzogMCwgc3g6IDAsIHN5OiAwLCBzejogMFxuICAgICAgICB9O1xuXG4gICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm51bVNwbGF0czsgKytpKSB7XG4gICAgICAgICAgICBpZiAocHJlZCAmJiAhcHJlZChpKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzcGxhdC54ID0geFtpXTtcbiAgICAgICAgICAgIHNwbGF0LnkgPSB5W2ldO1xuICAgICAgICAgICAgc3BsYXQueiA9IHpbaV07XG4gICAgICAgICAgICBzcGxhdC5yeCA9IHJ4W2ldO1xuICAgICAgICAgICAgc3BsYXQucnkgPSByeVtpXTtcbiAgICAgICAgICAgIHNwbGF0LnJ6ID0gcnpbaV07XG4gICAgICAgICAgICBzcGxhdC5ydyA9IHJ3W2ldO1xuICAgICAgICAgICAgc3BsYXQuc3ggPSBNYXRoLmV4cChzeFtpXSk7XG4gICAgICAgICAgICBzcGxhdC5zeSA9IE1hdGguZXhwKHN5W2ldKTtcbiAgICAgICAgICAgIHNwbGF0LnN6ID0gTWF0aC5leHAoc3pbaV0pO1xuXG4gICAgICAgICAgICBpZiAoZmlyc3QpIHtcbiAgICAgICAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIEdTcGxhdERhdGEuY2FsY1NwbGF0QWFiYihyZXN1bHQsIHNwbGF0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgR1NwbGF0RGF0YS5jYWxjU3BsYXRBYWJiKGFhYmIyLCBzcGxhdCk7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmFkZChhYWJiMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gIWZpcnN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmVzdWx0IC0gVGhlIHJlc3VsdC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBwcmVkIC0gUHJlZGljYXRlIGdpdmVuIGluZGV4IGZvciBza2lwcGluZy5cbiAgICAgKi9cbiAgICBjYWxjRm9jYWxQb2ludChyZXN1bHQsIHByZWQpIHtcbiAgICAgICAgY29uc3QgeCA9IHRoaXMuZ2V0UHJvcCgneCcpO1xuICAgICAgICBjb25zdCB5ID0gdGhpcy5nZXRQcm9wKCd5Jyk7XG4gICAgICAgIGNvbnN0IHogPSB0aGlzLmdldFByb3AoJ3onKTtcblxuICAgICAgICBjb25zdCBzeCA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMCcpO1xuICAgICAgICBjb25zdCBzeSA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMScpO1xuICAgICAgICBjb25zdCBzeiA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMicpO1xuXG4gICAgICAgIHJlc3VsdC54ID0gMDtcbiAgICAgICAgcmVzdWx0LnkgPSAwO1xuICAgICAgICByZXN1bHQueiA9IDA7XG5cbiAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5udW1TcGxhdHM7ICsraSkge1xuICAgICAgICAgICAgaWYgKHByZWQgJiYgIXByZWQoaSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHdlaWdodCA9IDEuMCAvICgxLjAgKyBNYXRoLmV4cChNYXRoLm1heChzeFtpXSwgc3lbaV0sIHN6W2ldKSkpO1xuICAgICAgICAgICAgcmVzdWx0LnggKz0geFtpXSAqIHdlaWdodDtcbiAgICAgICAgICAgIHJlc3VsdC55ICs9IHlbaV0gKiB3ZWlnaHQ7XG4gICAgICAgICAgICByZXN1bHQueiArPSB6W2ldICogd2VpZ2h0O1xuICAgICAgICAgICAgc3VtICs9IHdlaWdodDtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQubXVsU2NhbGFyKDEgLyBzdW0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBhcHBsaWNhdGlvbidzIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gd29ybGRNYXQgLSBUaGUgd29ybGQgbWF0cml4LlxuICAgICAqL1xuICAgIHJlbmRlcldpcmVmcmFtZUJvdW5kcyhzY2VuZSwgd29ybGRNYXQpIHtcbiAgICAgICAgY29uc3QgeCA9IHRoaXMuZ2V0UHJvcCgneCcpO1xuICAgICAgICBjb25zdCB5ID0gdGhpcy5nZXRQcm9wKCd5Jyk7XG4gICAgICAgIGNvbnN0IHogPSB0aGlzLmdldFByb3AoJ3onKTtcblxuICAgICAgICBjb25zdCByeCA9IHRoaXMuZ2V0UHJvcCgncm90XzAnKTtcbiAgICAgICAgY29uc3QgcnkgPSB0aGlzLmdldFByb3AoJ3JvdF8xJyk7XG4gICAgICAgIGNvbnN0IHJ6ID0gdGhpcy5nZXRQcm9wKCdyb3RfMicpO1xuICAgICAgICBjb25zdCBydyA9IHRoaXMuZ2V0UHJvcCgncm90XzMnKTtcblxuICAgICAgICBjb25zdCBzeCA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMCcpO1xuICAgICAgICBjb25zdCBzeSA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMScpO1xuICAgICAgICBjb25zdCBzeiA9IHRoaXMuZ2V0UHJvcCgnc2NhbGVfMicpO1xuXG4gICAgICAgIGNvbnN0IHNwbGF0ID0ge1xuICAgICAgICAgICAgeDogMCwgeTogMCwgejogMCwgcng6IDAsIHJ5OiAwLCByejogMCwgcnc6IDAsIHN4OiAwLCBzeTogMCwgc3o6IDBcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubnVtU3BsYXRzOyArK2kpIHtcbiAgICAgICAgICAgIHNwbGF0LnggPSB4W2ldO1xuICAgICAgICAgICAgc3BsYXQueSA9IHlbaV07XG4gICAgICAgICAgICBzcGxhdC56ID0geltpXTtcbiAgICAgICAgICAgIHNwbGF0LnJ4ID0gcnhbaV07XG4gICAgICAgICAgICBzcGxhdC5yeSA9IHJ5W2ldO1xuICAgICAgICAgICAgc3BsYXQucnogPSByeltpXTtcbiAgICAgICAgICAgIHNwbGF0LnJ3ID0gcndbaV07XG4gICAgICAgICAgICBzcGxhdC5zeCA9IE1hdGguZXhwKHN4W2ldKTtcbiAgICAgICAgICAgIHNwbGF0LnN5ID0gTWF0aC5leHAoc3lbaV0pO1xuICAgICAgICAgICAgc3BsYXQuc3ogPSBNYXRoLmV4cChzeltpXSk7XG5cbiAgICAgICAgICAgIGNhbGNTcGxhdE1hdChtYXQ0LCBzcGxhdCk7XG4gICAgICAgICAgICBtYXQ0Lm11bDIod29ybGRNYXQsIG1hdDQpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7ICsraikge1xuICAgICAgICAgICAgICAgIHZlYzMuc2V0KFxuICAgICAgICAgICAgICAgICAgICBzcGxhdC5zeCAqIDIgKiAoKGogJiAxKSA/IDEgOiAtMSksXG4gICAgICAgICAgICAgICAgICAgIHNwbGF0LnN5ICogMiAqICgoaiAmIDIpID8gMSA6IC0xKSxcbiAgICAgICAgICAgICAgICAgICAgc3BsYXQuc3ogKiAyICogKChqICYgNCkgPyAxIDogLTEpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBtYXQ0LnRyYW5zZm9ybVBvaW50KHZlYzMsIGRlYnVnUG9pbnRzW2pdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NlbmUuZHJhd0xpbmVBcnJheXMoZGVidWdMaW5lcywgZGVidWdDb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb21wcmVzc2VkIHNwbGF0c1xuICAgIGdldCBpc0NvbXByZXNzZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVsZW1lbnRzLnNvbWUoZSA9PiBlLm5hbWUgPT09ICdjaHVuaycpICYmXG4gICAgICAgICAgICAgICBbJ3BhY2tlZF9wb3NpdGlvbicsICdwYWNrZWRfcm90YXRpb24nLCAncGFja2VkX3NjYWxlJywgJ3BhY2tlZF9jb2xvciddLmV2ZXJ5KG5hbWUgPT4gdGhpcy5nZXRQcm9wKG5hbWUpKTtcbiAgICB9XG5cbiAgICBkZWNvbXByZXNzKCkge1xuICAgICAgICBjb25zdCBtZW1iZXJzID0gWyd4JywgJ3knLCAneicsICdmX2RjXzAnLCAnZl9kY18xJywgJ2ZfZGNfMicsICdvcGFjaXR5JywgJ3JvdF8wJywgJ3JvdF8xJywgJ3JvdF8yJywgJ3JvdF8zJywgJ3NjYWxlXzAnLCAnc2NhbGVfMScsICdzY2FsZV8yJ107XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuZWxlbWVudHMuZmluZChlID0+IGUubmFtZSA9PT0gJ2NodW5rJyk7XG4gICAgICAgIGNvbnN0IHZlcnRpY2VzID0gdGhpcy52ZXJ0ZXhFbGVtZW50O1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHVuY29tcHJlc3NlZCBkYXRhXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7fTtcbiAgICAgICAgbWVtYmVycy5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgICAgICBkYXRhW25hbWVdID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0aWNlcy5jb3VudCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGdldENodW5rUHJvcCA9IChuYW1lKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2h1bmtzLnByb3BlcnRpZXMuZmluZChwID0+IHAubmFtZSA9PT0gbmFtZSAmJiBwLnN0b3JhZ2UpPy5zdG9yYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG1pbl94ID0gZ2V0Q2h1bmtQcm9wKCdtaW5feCcpO1xuICAgICAgICBjb25zdCBtaW5feSA9IGdldENodW5rUHJvcCgnbWluX3knKTtcbiAgICAgICAgY29uc3QgbWluX3ogPSBnZXRDaHVua1Byb3AoJ21pbl96Jyk7XG4gICAgICAgIGNvbnN0IG1heF94ID0gZ2V0Q2h1bmtQcm9wKCdtYXhfeCcpO1xuICAgICAgICBjb25zdCBtYXhfeSA9IGdldENodW5rUHJvcCgnbWF4X3knKTtcbiAgICAgICAgY29uc3QgbWF4X3ogPSBnZXRDaHVua1Byb3AoJ21heF96Jyk7XG4gICAgICAgIGNvbnN0IG1pbl9zY2FsZV94ID0gZ2V0Q2h1bmtQcm9wKCdtaW5fc2NhbGVfeCcpO1xuICAgICAgICBjb25zdCBtaW5fc2NhbGVfeSA9IGdldENodW5rUHJvcCgnbWluX3NjYWxlX3knKTtcbiAgICAgICAgY29uc3QgbWluX3NjYWxlX3ogPSBnZXRDaHVua1Byb3AoJ21pbl9zY2FsZV96Jyk7XG4gICAgICAgIGNvbnN0IG1heF9zY2FsZV94ID0gZ2V0Q2h1bmtQcm9wKCdtYXhfc2NhbGVfeCcpO1xuICAgICAgICBjb25zdCBtYXhfc2NhbGVfeSA9IGdldENodW5rUHJvcCgnbWF4X3NjYWxlX3knKTtcbiAgICAgICAgY29uc3QgbWF4X3NjYWxlX3ogPSBnZXRDaHVua1Byb3AoJ21heF9zY2FsZV96Jyk7XG5cbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSB0aGlzLmdldFByb3AoJ3BhY2tlZF9wb3NpdGlvbicpO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IHRoaXMuZ2V0UHJvcCgncGFja2VkX3JvdGF0aW9uJyk7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5nZXRQcm9wKCdwYWNrZWRfc2NhbGUnKTtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLmdldFByb3AoJ3BhY2tlZF9jb2xvcicpO1xuXG4gICAgICAgIGNvbnN0IHVucGFja1Vub3JtID0gKHZhbHVlLCBiaXRzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0ID0gKDEgPDwgYml0cykgLSAxO1xuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSAmIHQpIC8gdDtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCB1bnBhY2sxMTEwMTEgPSAocmVzdWx0LCB2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0LnggPSB1bnBhY2tVbm9ybSh2YWx1ZSA+Pj4gMjEsIDExKTtcbiAgICAgICAgICAgIHJlc3VsdC55ID0gdW5wYWNrVW5vcm0odmFsdWUgPj4+IDExLCAxMCk7XG4gICAgICAgICAgICByZXN1bHQueiA9IHVucGFja1Vub3JtKHZhbHVlLCAxMSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdW5wYWNrODg4OCA9IChyZXN1bHQsIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICByZXN1bHQueCA9IHVucGFja1Vub3JtKHZhbHVlID4+PiAyNCwgOCk7XG4gICAgICAgICAgICByZXN1bHQueSA9IHVucGFja1Vub3JtKHZhbHVlID4+PiAxNiwgOCk7XG4gICAgICAgICAgICByZXN1bHQueiA9IHVucGFja1Vub3JtKHZhbHVlID4+PiA4LCA4KTtcbiAgICAgICAgICAgIHJlc3VsdC53ID0gdW5wYWNrVW5vcm0odmFsdWUsIDgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHVucGFjayBxdWF0ZXJuaW9uIHdpdGggMiwxMCwxMCwxMCBmb3JtYXQgKGxhcmdlc3QgZWxlbWVudCwgM3gxMGJpdCBlbGVtZW50KVxuICAgICAgICBjb25zdCB1bnBhY2tSb3QgPSAocmVzdWx0LCB2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgbm9ybSA9IDEuMCAvIChNYXRoLnNxcnQoMikgKiAwLjUpO1xuICAgICAgICAgICAgY29uc3QgYSA9ICh1bnBhY2tVbm9ybSh2YWx1ZSA+Pj4gMjAsIDEwKSAtIDAuNSkgKiBub3JtO1xuICAgICAgICAgICAgY29uc3QgYiA9ICh1bnBhY2tVbm9ybSh2YWx1ZSA+Pj4gMTAsIDEwKSAtIDAuNSkgKiBub3JtO1xuICAgICAgICAgICAgY29uc3QgYyA9ICh1bnBhY2tVbm9ybSh2YWx1ZSwgMTApIC0gMC41KSAqIG5vcm07XG4gICAgICAgICAgICBjb25zdCBtID0gTWF0aC5zcXJ0KDEuMCAtIChhICogYSArIGIgKiBiICsgYyAqIGMpKTtcblxuICAgICAgICAgICAgc3dpdGNoICh2YWx1ZSA+Pj4gMzApIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6IHJlc3VsdC5zZXQobSwgYSwgYiwgYyk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTogcmVzdWx0LnNldChhLCBtLCBiLCBjKTsgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAyOiByZXN1bHQuc2V0KGEsIGIsIG0sIGMpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDM6IHJlc3VsdC5zZXQoYSwgYiwgYywgbSk7IGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGxlcnAgPSAoYSwgYiwgdCkgPT4gYSAqICgxIC0gdCkgKyBiICogdDtcblxuICAgICAgICBjb25zdCBwID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgciA9IG5ldyBRdWF0KCk7XG4gICAgICAgIGNvbnN0IHMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBjID0gbmV3IFZlYzQoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRpY2VzLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNpID0gTWF0aC5mbG9vcihpIC8gMjU2KTtcblxuICAgICAgICAgICAgdW5wYWNrMTExMDExKHAsIHBvc2l0aW9uW2ldKTtcbiAgICAgICAgICAgIHVucGFja1JvdChyLCByb3RhdGlvbltpXSk7XG4gICAgICAgICAgICB1bnBhY2sxMTEwMTEocywgc2NhbGVbaV0pO1xuICAgICAgICAgICAgdW5wYWNrODg4OChjLCBjb2xvcltpXSk7XG5cbiAgICAgICAgICAgIGRhdGEueFtpXSA9IGxlcnAobWluX3hbY2ldLCBtYXhfeFtjaV0sIHAueCk7XG4gICAgICAgICAgICBkYXRhLnlbaV0gPSBsZXJwKG1pbl95W2NpXSwgbWF4X3lbY2ldLCBwLnkpO1xuICAgICAgICAgICAgZGF0YS56W2ldID0gbGVycChtaW5feltjaV0sIG1heF96W2NpXSwgcC56KTtcblxuICAgICAgICAgICAgZGF0YS5yb3RfMFtpXSA9IHIueDtcbiAgICAgICAgICAgIGRhdGEucm90XzFbaV0gPSByLnk7XG4gICAgICAgICAgICBkYXRhLnJvdF8yW2ldID0gci56O1xuICAgICAgICAgICAgZGF0YS5yb3RfM1tpXSA9IHIudztcblxuICAgICAgICAgICAgZGF0YS5zY2FsZV8wW2ldID0gbGVycChtaW5fc2NhbGVfeFtjaV0sIG1heF9zY2FsZV94W2NpXSwgcy54KTtcbiAgICAgICAgICAgIGRhdGEuc2NhbGVfMVtpXSA9IGxlcnAobWluX3NjYWxlX3lbY2ldLCBtYXhfc2NhbGVfeVtjaV0sIHMueSk7XG4gICAgICAgICAgICBkYXRhLnNjYWxlXzJbaV0gPSBsZXJwKG1pbl9zY2FsZV96W2NpXSwgbWF4X3NjYWxlX3pbY2ldLCBzLnopO1xuXG4gICAgICAgICAgICBjb25zdCBTSF9DMCA9IDAuMjgyMDk0NzkxNzczODc4MTQ7XG4gICAgICAgICAgICBkYXRhLmZfZGNfMFtpXSA9IChjLnggLSAwLjUpIC8gU0hfQzA7XG4gICAgICAgICAgICBkYXRhLmZfZGNfMVtpXSA9IChjLnkgLSAwLjUpIC8gU0hfQzA7XG4gICAgICAgICAgICBkYXRhLmZfZGNfMltpXSA9IChjLnogLSAwLjUpIC8gU0hfQzA7XG4gICAgICAgICAgICBkYXRhLm9wYWNpdHlbaV0gPSAtTWF0aC5sb2coMSAvIGMudyAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBHU3BsYXREYXRhKFt7XG4gICAgICAgICAgICBuYW1lOiAndmVydGV4JyxcbiAgICAgICAgICAgIGNvdW50OiB2ZXJ0aWNlcy5jb3VudCxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IG1lbWJlcnMubWFwKChuYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Zsb2F0JyxcbiAgICAgICAgICAgICAgICAgICAgYnl0ZVNpemU6IDQsXG4gICAgICAgICAgICAgICAgICAgIHN0b3JhZ2U6IGRhdGFbbmFtZV1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfV0sIGZhbHNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdTcGxhdERhdGEgfTtcbiJdLCJuYW1lcyI6WyJ2ZWMzIiwiVmVjMyIsIm1hdDQiLCJNYXQ0IiwicXVhdCIsIlF1YXQiLCJxdWF0MiIsImFhYmIiLCJCb3VuZGluZ0JveCIsImFhYmIyIiwiZGVidWdQb2ludHMiLCJkZWJ1Z0xpbmVzIiwiZGVidWdDb2xvciIsIkNvbG9yIiwiY2FsY1NwbGF0TWF0IiwicmVzdWx0IiwiZGF0YSIsInB4IiwieCIsInB5IiwieSIsInB6IiwieiIsImQiLCJNYXRoIiwic3FydCIsInJ4IiwicnkiLCJyeiIsInJ3IiwidyIsInNldCIsIkdTcGxhdERhdGEiLCJjb25zdHJ1Y3RvciIsImVsZW1lbnRzIiwicGVyZm9ybVpTY2FsZSIsInZlcnRleEVsZW1lbnQiLCJmaW5kIiwiZWxlbWVudCIsIm5hbWUiLCJpc0NvbXByZXNzZWQiLCJzZXRTY2FsZSIsInRyYW5zZm9ybSIsIm51bVNwbGF0cyIsImNvdW50IiwiY2FsY1NwbGF0QWFiYiIsImNlbnRlciIsImhhbGZFeHRlbnRzIiwic3giLCJzeSIsInN6Iiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1hdCIsImdldFByb3AiLCJzZXRGcm9tTWF0NCIsImkiLCJ0cmFuc2Zvcm1Qb2ludCIsIm11bDIiLCJfdGhpcyR2ZXJ0ZXhFbGVtZW50JHAiLCJwcm9wZXJ0aWVzIiwicHJvcGVydHkiLCJzdG9yYWdlIiwiYWRkUHJvcCIsInB1c2giLCJ0eXBlIiwiYnl0ZVNpemUiLCJjYWxjQWFiYiIsInByZWQiLCJzcGxhdCIsImZpcnN0IiwiZXhwIiwiYWRkIiwiY2FsY0ZvY2FsUG9pbnQiLCJzdW0iLCJ3ZWlnaHQiLCJtYXgiLCJtdWxTY2FsYXIiLCJyZW5kZXJXaXJlZnJhbWVCb3VuZHMiLCJzY2VuZSIsIndvcmxkTWF0IiwiaiIsImRyYXdMaW5lQXJyYXlzIiwic29tZSIsImUiLCJldmVyeSIsImRlY29tcHJlc3MiLCJtZW1iZXJzIiwiY2h1bmtzIiwidmVydGljZXMiLCJmb3JFYWNoIiwiRmxvYXQzMkFycmF5IiwiZ2V0Q2h1bmtQcm9wIiwiX2NodW5rcyRwcm9wZXJ0aWVzJGZpIiwicCIsIm1pbl94IiwibWluX3kiLCJtaW5feiIsIm1heF94IiwibWF4X3kiLCJtYXhfeiIsIm1pbl9zY2FsZV94IiwibWluX3NjYWxlX3kiLCJtaW5fc2NhbGVfeiIsIm1heF9zY2FsZV94IiwibWF4X3NjYWxlX3kiLCJtYXhfc2NhbGVfeiIsInBvc2l0aW9uIiwicm90YXRpb24iLCJzY2FsZSIsImNvbG9yIiwidW5wYWNrVW5vcm0iLCJ2YWx1ZSIsImJpdHMiLCJ0IiwidW5wYWNrMTExMDExIiwidW5wYWNrODg4OCIsInVucGFja1JvdCIsIm5vcm0iLCJhIiwiYiIsImMiLCJtIiwibGVycCIsInIiLCJzIiwiVmVjNCIsImNpIiwiZmxvb3IiLCJyb3RfMCIsInJvdF8xIiwicm90XzIiLCJyb3RfMyIsInNjYWxlXzAiLCJzY2FsZV8xIiwic2NhbGVfMiIsIlNIX0MwIiwiZl9kY18wIiwiZl9kY18xIiwiZl9kY18yIiwib3BhY2l0eSIsImxvZyIsIm1hcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQU9BLE1BQU1BLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUMsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1DLEtBQUssR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUN4QixNQUFNRSxJQUFJLEdBQUcsSUFBSUMsV0FBVyxFQUFFLENBQUE7QUFDOUIsTUFBTUMsS0FBSyxHQUFHLElBQUlELFdBQVcsRUFBRSxDQUFBO0FBRS9CLE1BQU1FLFdBQVcsR0FBRyxDQUFDLElBQUlULElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxDQUFDLENBQUE7QUFDcEgsTUFBTVUsVUFBVSxHQUFHLENBQ2ZELFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUM5SEEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQzlIQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUVBLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FDakksQ0FBQTtBQUNELE1BQU1FLFVBQVUsR0FBRyxJQUFJQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxZQUFZLEdBQUdBLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxLQUFLO0FBQ25DLEVBQUEsTUFBTUMsRUFBRSxHQUFHRCxJQUFJLENBQUNFLENBQUMsQ0FBQTtBQUNqQixFQUFBLE1BQU1DLEVBQUUsR0FBR0gsSUFBSSxDQUFDSSxDQUFDLENBQUE7QUFDakIsRUFBQSxNQUFNQyxFQUFFLEdBQUdMLElBQUksQ0FBQ00sQ0FBQyxDQUFBO0FBQ2pCLEVBQUEsTUFBTUMsQ0FBQyxHQUFHQyxJQUFJLENBQUNDLElBQUksQ0FBQ1QsSUFBSSxD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
