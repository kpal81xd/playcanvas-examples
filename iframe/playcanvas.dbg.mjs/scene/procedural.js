import { math } from '../core/math/math.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT } from '../platform/graphics/constants.js';
import { Mesh } from './mesh.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

// cached mesh primitives
const shapePrimitives = [];

/**
 * Generates normal information from the specified positions and triangle indices. See
 * {@link createMesh}.
 *
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex normals.
 * @example
 * const normals = pc.calculateNormals(positions, indices);
 * const mesh = pc.createMesh(graphicsDevice, positions, {
 *     normals: normals,
 *     uvs: uvs,
 *     indices: indices
 * });
 * @category Graphics
 */
function calculateNormals(positions, indices) {
  const triangleCount = indices.length / 3;
  const vertexCount = positions.length / 3;
  const p1 = new Vec3();
  const p2 = new Vec3();
  const p3 = new Vec3();
  const p1p2 = new Vec3();
  const p1p3 = new Vec3();
  const faceNormal = new Vec3();
  const normals = [];

  // Initialize the normal array to zero
  for (let i = 0; i < positions.length; i++) {
    normals[i] = 0;
  }

  // Accumulate face normals for each vertex
  for (let i = 0; i < triangleCount; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];
    p1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    p2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    p3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
    p1p2.sub2(p2, p1);
    p1p3.sub2(p3, p1);
    faceNormal.cross(p1p2, p1p3).normalize();
    normals[i1 * 3] += faceNormal.x;
    normals[i1 * 3 + 1] += faceNormal.y;
    normals[i1 * 3 + 2] += faceNormal.z;
    normals[i2 * 3] += faceNormal.x;
    normals[i2 * 3 + 1] += faceNormal.y;
    normals[i2 * 3 + 2] += faceNormal.z;
    normals[i3 * 3] += faceNormal.x;
    normals[i3 * 3 + 1] += faceNormal.y;
    normals[i3 * 3 + 2] += faceNormal.z;
  }

  // Normalize all normals
  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals[i * 3] *= invLen;
    normals[i * 3 + 1] *= invLen;
    normals[i * 3 + 2] *= invLen;
  }
  return normals;
}

/**
 * Generates tangent information from the specified positions, normals, texture coordinates and
 * triangle indices. See {@link createMesh}.
 *
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} normals - An array of 3-dimensional vertex normals.
 * @param {number[]} uvs - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex tangents.
 * @example
 * const tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * const mesh = pc.createMesh(graphicsDevice, positions, {
 *     normals: normals,
 *     tangents: tangents,
 *     uvs: uvs,
 *     indices: indices
 * });
 * @category Graphics
 */
function calculateTangents(positions, normals, uvs, indices) {
  // Lengyel's Method
  // http://web.archive.org/web/20180620024439/http://www.terathon.com/code/tangent.html
  const triangleCount = indices.length / 3;
  const vertexCount = positions.length / 3;
  const v1 = new Vec3();
  const v2 = new Vec3();
  const v3 = new Vec3();
  const w1 = new Vec2();
  const w2 = new Vec2();
  const w3 = new Vec2();
  const sdir = new Vec3();
  const tdir = new Vec3();
  const tan1 = new Float32Array(vertexCount * 3);
  const tan2 = new Float32Array(vertexCount * 3);
  const tangents = [];
  for (let i = 0; i < triangleCount; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];
    v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    v3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
    w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
    w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
    w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);
    const x1 = v2.x - v1.x;
    const x2 = v3.x - v1.x;
    const y1 = v2.y - v1.y;
    const y2 = v3.y - v1.y;
    const z1 = v2.z - v1.z;
    const z2 = v3.z - v1.z;
    const s1 = w2.x - w1.x;
    const s2 = w3.x - w1.x;
    const _t = w2.y - w1.y;
    const _t2 = w3.y - w1.y;
    const area = s1 * _t2 - s2 * _t;

    // Area can be 0 for degenerate triangles or bad uv coordinates
    if (area === 0) {
      // Fallback to default values
      sdir.set(0, 1, 0);
      tdir.set(1, 0, 0);
    } else {
      const r = 1 / area;
      sdir.set((_t2 * x1 - _t * x2) * r, (_t2 * y1 - _t * y2) * r, (_t2 * z1 - _t * z2) * r);
      tdir.set((s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
    }
    tan1[i1 * 3 + 0] += sdir.x;
    tan1[i1 * 3 + 1] += sdir.y;
    tan1[i1 * 3 + 2] += sdir.z;
    tan1[i2 * 3 + 0] += sdir.x;
    tan1[i2 * 3 + 1] += sdir.y;
    tan1[i2 * 3 + 2] += sdir.z;
    tan1[i3 * 3 + 0] += sdir.x;
    tan1[i3 * 3 + 1] += sdir.y;
    tan1[i3 * 3 + 2] += sdir.z;
    tan2[i1 * 3 + 0] += tdir.x;
    tan2[i1 * 3 + 1] += tdir.y;
    tan2[i1 * 3 + 2] += tdir.z;
    tan2[i2 * 3 + 0] += tdir.x;
    tan2[i2 * 3 + 1] += tdir.y;
    tan2[i2 * 3 + 2] += tdir.z;
    tan2[i3 * 3 + 0] += tdir.x;
    tan2[i3 * 3 + 1] += tdir.y;
    tan2[i3 * 3 + 2] += tdir.z;
  }
  const t1 = new Vec3();
  const t2 = new Vec3();
  const n = new Vec3();
  const temp = new Vec3();
  for (let i = 0; i < vertexCount; i++) {
    n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
    t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);

    // Gram-Schmidt orthogonalize
    const ndott = n.dot(t1);
    temp.copy(n).mulScalar(ndott);
    temp.sub2(t1, temp).normalize();
    tangents[i * 4] = temp.x;
    tangents[i * 4 + 1] = temp.y;
    tangents[i * 4 + 2] = temp.z;

    // Calculate handedness
    temp.cross(n, t1);
    tangents[i * 4 + 3] = temp.dot(t2) < 0.0 ? -1.0 : 1.0;
  }
  return tangents;
}

/**
 * Creates a new mesh object from the supplied vertex information and topology.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number[]} [opts.normals] - An array of 3-dimensional vertex normals.
 * @param {number[]} [opts.tangents] - An array of 3-dimensional vertex tangents.
 * @param {number[]} [opts.colors] - An array of 4-dimensional vertex colors where each component
 * is an integer in the range 0 to 255.
 * @param {number[]} [opts.uvs] - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} [opts.uvs1] - Same as opts.uvs, but for additional UV set
 * @param {number[]} [opts.blendIndices] - An array of 4-dimensional bone indices where each
 * component is an integer in the range 0 to 255.
 * @param {number[]} [opts.blendWeights] - An array of 4-dimensional bone weights where each
 * component is in the range 0 to 1 and the sum of the weights should equal 1.
 * @param {number[]} [opts.indices] - An array of triangle indices.
 * @returns {Mesh} A new Mesh constructed from the supplied vertex and triangle data.
 * @example
 * // Create a simple, indexed triangle (with texture coordinates and vertex normals)
 * const mesh = pc.createMesh(graphicsDevice, [0, 0, 0, 1, 0, 0, 0, 1, 0], {
 *     normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
 *     uvs: [0, 0, 1, 0, 0, 1],
 *     indices: [0, 1, 2]
 * });
 * @category Graphics
 */
function createMesh(device, positions, opts) {
  const mesh = new Mesh(device);
  mesh.setPositions(positions);
  if (opts) {
    if (opts.normals) {
      mesh.setNormals(opts.normals);
    }
    if (opts.tangents) {
      mesh.setVertexStream(SEMANTIC_TANGENT, opts.tangents, 4);
    }
    if (opts.colors) {
      mesh.setColors32(opts.colors);
    }
    if (opts.uvs) {
      mesh.setUvs(0, opts.uvs);
    }
    if (opts.uvs1) {
      mesh.setUvs(1, opts.uvs1);
    }
    if (opts.blendIndices) {
      mesh.setVertexStream(SEMANTIC_BLENDINDICES, opts.blendIndices, 4, opts.blendIndices.length / 4, TYPE_UINT8);
    }
    if (opts.blendWeights) {
      mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, opts.blendWeights, 4);
    }
    if (opts.indices) {
      mesh.setIndices(opts.indices);
    }
  }
  mesh.update();
  return mesh;
}

/**
 * Creates a procedural torus-shaped mesh.
 *
 * The size, shape and tesselation properties of the torus can be controlled via function
 * parameters. By default, the function will create a torus in the XZ-plane with a tube radius of
 * 0.2, a ring radius of 0.3, 20 segments and 30 sides.
 *
 * Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the torus's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.tubeRadius] - The radius of the tube forming the body of the torus
 * (defaults to 0.2).
 * @param {number} [opts.ringRadius] - The radius from the centre of the torus to the centre of the
 * tube (defaults to 0.3).
 * @param {number} [opts.sectorAngle] - The sector angle in degrees of the ring of the torus
 * (defaults to 2 * Math.PI).
 * @param {number} [opts.segments] - The number of radial divisions forming cross-sections of the
 * torus ring (defaults to 20).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the torus ring
 * (defaults to 30).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new torus-shaped mesh.
 * @category Graphics
 */
function createTorus(device, opts = {}) {
  var _opts$tubeRadius, _opts$ringRadius, _opts$sectorAngle, _opts$segments, _opts$sides, _opts$calculateTangen;
  // Check the supplied options and provide defaults for unspecified ones
  const rc = (_opts$tubeRadius = opts.tubeRadius) != null ? _opts$tubeRadius : 0.2;
  const rt = (_opts$ringRadius = opts.ringRadius) != null ? _opts$ringRadius : 0.3;
  const sectorAngle = ((_opts$sectorAngle = opts.sectorAngle) != null ? _opts$sectorAngle : 360) * math.DEG_TO_RAD;
  const segments = (_opts$segments = opts.segments) != null ? _opts$segments : 30;
  const sides = (_opts$sides = opts.sides) != null ? _opts$sides : 20;
  const calcTangents = (_opts$calculateTangen = opts.calculateTangents) != null ? _opts$calculateTangen : false;

  // Variable declarations
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= sides; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = Math.cos(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      const y = Math.sin(2 * Math.PI * i / sides) * rc;
      const z = Math.sin(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      const nx = Math.cos(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
      const ny = Math.sin(2 * Math.PI * i / sides);
      const nz = Math.sin(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
      const u = i / sides;
      const v = 1 - j / segments;
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, 1.0 - v);
      if (i < sides && j < segments) {
        const first = i * (segments + 1) + j;
        const second = (i + 1) * (segments + 1) + j;
        const third = i * (segments + 1) + (j + 1);
        const fourth = (i + 1) * (segments + 1) + (j + 1);
        indices.push(first, second, third);
        indices.push(second, fourth, third);
      }
    }
  }
  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}
function _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
  // Variable declarations
  const pos = new Vec3();
  const bottomToTop = new Vec3();
  const norm = new Vec3();
  const top = new Vec3();
  const bottom = new Vec3();
  const tangent = new Vec3();
  const positions = [];
  const normals = [];
  const uvs = [];
  const uvs1 = [];
  const indices = [];
  let offset;

  // Define the body of the cone/cylinder
  if (height > 0) {
    for (let i = 0; i <= heightSegments; i++) {
      for (let j = 0; j <= capSegments; j++) {
        // Sweep the cone body from the positive Y axis to match a 3DS Max cone/cylinder
        const theta = j / capSegments * 2 * Math.PI - Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
        top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
        pos.lerp(bottom, top, i / heightSegments);
        bottomToTop.sub2(top, bottom).normalize();
        tangent.set(cosTheta, 0, -sinTheta);
        norm.cross(tangent, bottomToTop).normalize();
        positions.push(pos.x, pos.y, pos.z);
        normals.push(norm.x, norm.y, norm.z);
        let u = j / capSegments;
        let v = i / heightSegments;
        uvs.push(u, 1 - v);

        // Pack UV1 to 1st third
        const _v = v;
        v = u;
        u = _v;
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        uvs1.push(u, 1 - v);
        if (i < heightSegments && j < capSegments) {
          const first = i * (capSegments + 1) + j;
          const second = i * (capSegments + 1) + (j + 1);
          const third = (i + 1) * (capSegments + 1) + j;
          const fourth = (i + 1) * (capSegments + 1) + (j + 1);
          indices.push(first, second, third);
          indices.push(second, fourth, third);
        }
      }
    }
  }
  if (roundedCaps) {
    const latitudeBands = Math.floor(capSegments / 2);
    const longitudeBands = capSegments;
    const capOffset = height / 2;

    // Generate top cap
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= longitudeBands; lon++) {
        // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
        const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        let u = 1 - lon / longitudeBands;
        let v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, 1 - v);

        // Pack UV1 to 2nd third
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 1.0 / 3;
        uvs1.push(u, 1 - v);
      }
    }
    offset = (heightSegments + 1) * (capSegments + 1);
    for (let lat = 0; lat < latitudeBands; ++lat) {
      for (let lon = 0; lon < longitudeBands; ++lon) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second);
      }
    }

    // Generate bottom cap
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = Math.PI * 0.5 + lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= longitudeBands; lon++) {
        // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
        const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        let u = 1 - lon / longitudeBands;
        let v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, 1 - v);

        // Pack UV1 to 3rd third
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 2.0 / 3;
        uvs1.push(u, 1 - v);
      }
    }
    offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
    for (let lat = 0; lat < latitudeBands; ++lat) {
      for (let lon = 0; lon < longitudeBands; ++lon) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second);
      }
    }
  } else {
    // Generate bottom cap
    offset = (heightSegments + 1) * (capSegments + 1);
    if (baseRadius > 0) {
      for (let i = 0; i < capSegments; i++) {
        const theta = i / capSegments * 2 * Math.PI;
        const x = Math.sin(theta);
        const y = -height / 2;
        const z = Math.cos(theta);
        let u = 1 - (x + 1) / 2;
        let v = (z + 1) / 2;
        positions.push(x * baseRadius, y, z * baseRadius);
        normals.push(0, -1, 0);
        uvs.push(u, 1 - v);

        // Pack UV1 to 2nd third
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 1 / 3;
        uvs1.push(u, 1 - v);
        if (i > 1) {
          indices.push(offset, offset + i, offset + i - 1);
        }
      }
    }

    // Generate top cap
    offset += capSegments;
    if (peakRadius > 0) {
      for (let i = 0; i < capSegments; i++) {
        const theta = i / capSegments * 2 * Math.PI;
        const x = Math.sin(theta);
        const y = height / 2;
        const z = Math.cos(theta);
        let u = 1 - (x + 1) / 2;
        let v = (z + 1) / 2;
        positions.push(x * peakRadius, y, z * peakRadius);
        normals.push(0, 1, 0);
        uvs.push(u, 1 - v);

        // Pack UV1 to 3rd third
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 2 / 3;
        uvs1.push(u, 1 - v);
        if (i > 1) {
          indices.push(offset, offset + i - 1, offset + i);
        }
      }
    }
  }
  return {
    positions: positions,
    normals: normals,
    uvs: uvs,
    uvs1: uvs1,
    indices: indices
  };
}

/**
 * Creates a procedural cylinder-shaped mesh.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via function
 * parameters. By default, the function will create a cylinder standing vertically centered on the
 * XZ-plane with a radius of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the cylinder's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the cylinder
 * (defaults to 0.5).
 * @param {number} [opts.height] - The length of the body of the cylinder (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cylinder
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the
 * cylinder (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 * @category Graphics
 */
function createCylinder(device, opts = {}) {
  var _opts$radius, _opts$height, _opts$heightSegments, _opts$capSegments, _opts$calculateTangen2;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.5;
  const height = (_opts$height = opts.height) != null ? _opts$height : 1;
  const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 5;
  const capSegments = (_opts$capSegments = opts.capSegments) != null ? _opts$capSegments : 20;
  const calcTangents = (_opts$calculateTangen2 = opts.calculateTangents) != null ? _opts$calculateTangen2 : false;

  // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
  const options = _createConeData(radius, radius, height, heightSegments, capSegments, false);
  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }
  return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural capsule-shaped mesh.
 *
 * The size, shape and tesselation properties of the capsule can be controlled via function
 * parameters. By default, the function will create a capsule standing vertically centered on the
 * XZ-plane with a radius of 0.25, a height of 1.0, 1 height segment and 10 cap segments.
 *
 * Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the capsule's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the capsule (defaults
 * to 0.3).
 * @param {number} [opts.height] - The length of the body of the capsule from tip to tip (defaults
 * to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the tubular length of the
 * capsule (defaults to 1).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the capsule
 * (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 * @category Graphics
 */
function createCapsule(device, opts = {}) {
  var _opts$radius2, _opts$height2, _opts$heightSegments2, _opts$sides2, _opts$calculateTangen3;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius2 = opts.radius) != null ? _opts$radius2 : 0.3;
  const height = (_opts$height2 = opts.height) != null ? _opts$height2 : 1;
  const heightSegments = (_opts$heightSegments2 = opts.heightSegments) != null ? _opts$heightSegments2 : 1;
  const sides = (_opts$sides2 = opts.sides) != null ? _opts$sides2 : 20;
  const calcTangents = (_opts$calculateTangen3 = opts.calculateTangents) != null ? _opts$calculateTangen3 : false;

  // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
  const options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);
  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }
  return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural cone-shaped mesh.
 *
 * The size, shape and tesselation properties of the cone can be controlled via function
 * parameters. By default, the function will create a cone standing vertically centered on the
 * XZ-plane with a base radius of 0.5, a height of 1.0, 5 height segments and 20 cap segments.
 *
 * Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.baseRadius] - The base radius of the cone (defaults to 0.5).
 * @param {number} [opts.peakRadius] - The peak radius of the cone (defaults to 0.0).
 * @param {number} [opts.height] - The length of the body of the cone (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cone
 * (defaults to 18).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cone-shaped mesh.
 * @category Graphics
 */
function createCone(device, opts = {}) {
  var _opts$baseRadius, _opts$peakRadius, _opts$height3, _opts$heightSegments3, _opts$capSegments2, _opts$calculateTangen4;
  // Check the supplied options and provide defaults for unspecified ones
  const baseRadius = (_opts$baseRadius = opts.baseRadius) != null ? _opts$baseRadius : 0.5;
  const peakRadius = (_opts$peakRadius = opts.peakRadius) != null ? _opts$peakRadius : 0;
  const height = (_opts$height3 = opts.height) != null ? _opts$height3 : 1;
  const heightSegments = (_opts$heightSegments3 = opts.heightSegments) != null ? _opts$heightSegments3 : 5;
  const capSegments = (_opts$capSegments2 = opts.capSegments) != null ? _opts$capSegments2 : 18;
  const calcTangents = (_opts$calculateTangen4 = opts.calculateTangents) != null ? _opts$calculateTangen4 : false;
  const options = _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);
  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }
  return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural sphere-shaped mesh.
 *
 * The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centered on the object space origin with a radius of
 * 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the sphere's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the sphere (defaults to 0.5).
 * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of the
 * sphere (defaults to 16).
 * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
 * the sphere (defaults to 16).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new sphere-shaped mesh.
 * @category Graphics
 */
function createSphere(device, opts = {}) {
  var _opts$radius3, _opts$latitudeBands, _opts$longitudeBands, _opts$calculateTangen5;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius3 = opts.radius) != null ? _opts$radius3 : 0.5;
  const latitudeBands = (_opts$latitudeBands = opts.latitudeBands) != null ? _opts$latitudeBands : 16;
  const longitudeBands = (_opts$longitudeBands = opts.longitudeBands) != null ? _opts$longitudeBands : 16;
  const calcTangents = (_opts$calculateTangen5 = opts.calculateTangents) != null ? _opts$calculateTangen5 : false;

  // Variable declarations
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = lat * Math.PI / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let lon = 0; lon <= longitudeBands; lon++) {
      // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
      const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      const u = 1 - lon / longitudeBands;
      const v = 1 - lat / latitudeBands;
      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }
  for (let lat = 0; lat < latitudeBands; ++lat) {
    for (let lon = 0; lon < longitudeBands; ++lon) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;
      indices.push(first + 1, second, first);
      indices.push(first + 1, second + 1, second);
    }
  }
  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    // UV1 = UV0 for sphere
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}

/**
 * Creates a procedural plane-shaped mesh.
 *
 * The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centered on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is
 * aligned along the positive Y axis.
 *
 * Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the plane's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes
 * (defaults to [0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane
 * (defaults to 5).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane
 * (defaults to 5).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new plane-shaped mesh.
 * @category Graphics
 */
function createPlane(device, opts = {}) {
  var _opts$halfExtents, _opts$widthSegments, _opts$lengthSegments, _opts$calculateTangen6;
  // Check the supplied options and provide defaults for unspecified ones
  const he = (_opts$halfExtents = opts.halfExtents) != null ? _opts$halfExtents : new Vec2(0.5, 0.5);
  const ws = (_opts$widthSegments = opts.widthSegments) != null ? _opts$widthSegments : 5;
  const ls = (_opts$lengthSegments = opts.lengthSegments) != null ? _opts$lengthSegments : 5;
  const calcTangents = (_opts$calculateTangen6 = opts.calculateTangents) != null ? _opts$calculateTangen6 : false;

  // Variable declarations
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Generate plane as follows (assigned UVs denoted at corners):
  // (0,1)x---------x(1,1)
  //      |         |
  //      |         |
  //      |    O--X |length
  //      |    |    |
  //      |    Z    |
  // (0,0)x---------x(1,0)
  // width
  let vcounter = 0;
  for (let i = 0; i <= ws; i++) {
    for (let j = 0; j <= ls; j++) {
      const x = -he.x + 2 * he.x * i / ws;
      const y = 0.0;
      const z = -(-he.y + 2 * he.y * j / ls);
      const u = i / ws;
      const v = j / ls;
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(u, 1 - v);
      if (i < ws && j < ls) {
        indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
        indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
      }
      vcounter++;
    }
  }
  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    // UV1 = UV0 for plane
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}

/**
 * Creates a procedural box-shaped mesh.
 *
 * The size, shape and tesselation properties of the box can be controlled via function parameters.
 * By default, the function will create a box centered on the object space origin with a width,
 * length and height of 1.0 unit and 10 segments in either axis (50 triangles per face).
 *
 * Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent
 * information is generated into the vertex buffer of the box's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec3} [opts.halfExtents] - The half dimensions of the box in each axis (defaults to
 * [0.5, 0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the box
 * (defaults to 1).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the box
 * (defaults to 1).
 * @param {number} [opts.heightSegments] - The number of divisions along the Y axis of the box
 * (defaults to 1).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @param {number} [opts.yOffset] - Move the box vertically by given offset in local space. Pass
 * 0.5 to generate the box with pivot point at the bottom face. Defaults to 0.
 * @returns {Mesh} A new box-shaped mesh.
 * @category Graphics
 */
function createBox(device, opts = {}) {
  var _opts$halfExtents2, _opts$widthSegments2, _opts$lengthSegments2, _opts$heightSegments4, _opts$calculateTangen7, _opts$yOffset;
  // Check the supplied options and provide defaults for unspecified ones
  const he = (_opts$halfExtents2 = opts.halfExtents) != null ? _opts$halfExtents2 : new Vec3(0.5, 0.5, 0.5);
  const ws = (_opts$widthSegments2 = opts.widthSegments) != null ? _opts$widthSegments2 : 1;
  const ls = (_opts$lengthSegments2 = opts.lengthSegments) != null ? _opts$lengthSegments2 : 1;
  const hs = (_opts$heightSegments4 = opts.heightSegments) != null ? _opts$heightSegments4 : 1;
  const calcTangents = (_opts$calculateTangen7 = opts.calculateTangents) != null ? _opts$calculateTangen7 : false;
  const yOffset = (_opts$yOffset = opts.yOffset) != null ? _opts$yOffset : 0;
  const minY = -he.y + yOffset;
  const maxY = he.y + yOffset;
  const corners = [new Vec3(-he.x, minY, he.z), new Vec3(he.x, minY, he.z), new Vec3(he.x, maxY, he.z), new Vec3(-he.x, maxY, he.z), new Vec3(he.x, minY, -he.z), new Vec3(-he.x, minY, -he.z), new Vec3(-he.x, maxY, -he.z), new Vec3(he.x, maxY, -he.z)];
  const faceAxes = [[0, 1, 3],
  // FRONT
  [4, 5, 7],
  // BACK
  [3, 2, 6],
  // TOP
  [1, 0, 4],
  // BOTTOM
  [1, 4, 2],
  // RIGHT
  [5, 0, 6] // LEFT
  ];

  const faceNormals = [[0, 0, 1],
  // FRONT
  [0, 0, -1],
  // BACK
  [0, 1, 0],
  // TOP
  [0, -1, 0],
  // BOTTOM
  [1, 0, 0],
  // RIGHT
  [-1, 0, 0] // LEFT
  ];

  const sides = {
    FRONT: 0,
    BACK: 1,
    TOP: 2,
    BOTTOM: 3,
    RIGHT: 4,
    LEFT: 5
  };
  const positions = [];
  const normals = [];
  const uvs = [];
  const uvs1 = [];
  const indices = [];
  let vcounter = 0;
  const generateFace = (side, uSegments, vSegments) => {
    const temp1 = new Vec3();
    const temp2 = new Vec3();
    const temp3 = new Vec3();
    const r = new Vec3();
    for (let i = 0; i <= uSegments; i++) {
      for (let j = 0; j <= vSegments; j++) {
        temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
        temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
        temp3.sub2(temp2, corners[faceAxes[side][0]]);
        r.add2(temp1, temp3);
        let u = i / uSegments;
        let v = j / vSegments;
        positions.push(r.x, r.y, r.z);
        normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
        uvs.push(u, 1 - v);

        // pack as 3x2. 1/3 will be empty, but it's either that or stretched pixels
        // TODO: generate non-rectangular lightMaps, so we could use space without stretching
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += side % 3 / 3;
        v += Math.floor(side / 3) / 3;
        uvs1.push(u, 1 - v);
        if (i < uSegments && j < vSegments) {
          indices.push(vcounter + vSegments + 1, vcounter + 1, vcounter);
          indices.push(vcounter + vSegments + 1, vcounter + vSegments + 2, vcounter + 1);
        }
        vcounter++;
      }
    }
  };
  generateFace(sides.FRONT, ws, hs);
  generateFace(sides.BACK, ws, hs);
  generateFace(sides.TOP, ws, ls);
  generateFace(sides.BOTTOM, ws, ls);
  generateFace(sides.RIGHT, ls, hs);
  generateFace(sides.LEFT, ls, hs);
  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs1,
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}

// returns Primitive data, used by ModelComponent and RenderComponent
function getShapePrimitive(device, type) {
  // find in cache
  let primData = null;
  for (let i = 0; i < shapePrimitives.length; i++) {
    if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
      primData = shapePrimitives[i].primData;
    }
  }

  // not in cache, create new
  if (!primData) {
    let mesh, area;
    switch (type) {
      case 'box':
        mesh = createBox(device);
        area = {
          x: 2,
          y: 2,
          z: 2,
          uv: 2.0 / 3
        };
        break;
      case 'capsule':
        mesh = createCapsule(device, {
          radius: 0.5,
          height: 2
        });
        area = {
          x: Math.PI * 2,
          y: Math.PI,
          z: Math.PI * 2,
          uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
        };
        break;
      case 'cone':
        mesh = createCone(device, {
          baseRadius: 0.5,
          peakRadius: 0,
          height: 1
        });
        area = {
          x: 2.54,
          y: 2.54,
          z: 2.54,
          uv: 1.0 / 3 + 1.0 / 3 / 3
        };
        break;
      case 'cylinder':
        mesh = createCylinder(device, {
          radius: 0.5,
          height: 1
        });
        area = {
          x: Math.PI,
          y: 0.79 * 2,
          z: Math.PI,
          uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
        };
        break;
      case 'plane':
        mesh = createPlane(device, {
          halfExtents: new Vec2(0.5, 0.5),
          widthSegments: 1,
          lengthSegments: 1
        });
        area = {
          x: 0,
          y: 1,
          z: 0,
          uv: 1
        };
        break;
      case 'sphere':
        mesh = createSphere(device, {
          radius: 0.5
        });
        area = {
          x: Math.PI,
          y: Math.PI,
          z: Math.PI,
          uv: 1
        };
        break;
      case 'torus':
        mesh = createTorus(device, {
          tubeRadius: 0.2,
          ringRadius: 0.3
        });
        area = {
          x: Math.PI * 0.5 * 0.5 - Math.PI * 0.1 * 0.1,
          y: 0.4,
          z: 0.4,
          uv: 1
        };
        break;
      default:
        throw new Error('Invalid primitive type: ' + type);
    }

    // inc reference to keep primitive alive
    mesh.incRefCount();
    primData = {
      mesh: mesh,
      area: area
    };

    // add to cache
    shapePrimitives.push({
      type: type,
      device: device,
      primData: primData
    });
  }
  return primData;
}

export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, getShapePrimitive };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2VkdXJhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3Byb2NlZHVyYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQge1xuICAgIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgVFlQRV9VSU5UOFxufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi9tZXNoLmpzJztcblxuY29uc3QgcHJpbWl0aXZlVXYxUGFkZGluZyA9IDQuMCAvIDY0O1xuY29uc3QgcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlID0gMS4wIC0gcHJpbWl0aXZlVXYxUGFkZGluZyAqIDI7XG5cbi8vIGNhY2hlZCBtZXNoIHByaW1pdGl2ZXNcbmNvbnN0IHNoYXBlUHJpbWl0aXZlcyA9IFtdO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBub3JtYWwgaW5mb3JtYXRpb24gZnJvbSB0aGUgc3BlY2lmaWVkIHBvc2l0aW9ucyBhbmQgdHJpYW5nbGUgaW5kaWNlcy4gU2VlXG4gKiB7QGxpbmsgY3JlYXRlTWVzaH0uXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggcG9zaXRpb25zLlxuICogQHBhcmFtIHtudW1iZXJbXX0gaW5kaWNlcyAtIEFuIGFycmF5IG9mIHRyaWFuZ2xlIGluZGljZXMuXG4gKiBAcmV0dXJucyB7bnVtYmVyW119IEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IG5vcm1hbHMuXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgbm9ybWFscyA9IHBjLmNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKTtcbiAqIGNvbnN0IG1lc2ggPSBwYy5jcmVhdGVNZXNoKGdyYXBoaWNzRGV2aWNlLCBwb3NpdGlvbnMsIHtcbiAqICAgICBub3JtYWxzOiBub3JtYWxzLFxuICogICAgIHV2czogdXZzLFxuICogICAgIGluZGljZXM6IGluZGljZXNcbiAqIH0pO1xuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKSB7XG4gICAgY29uc3QgdHJpYW5nbGVDb3VudCA9IGluZGljZXMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2ZXJ0ZXhDb3VudCAgID0gcG9zaXRpb25zLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgZmFjZU5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICBjb25zdCBub3JtYWxzID0gW107XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBub3JtYWwgYXJyYXkgdG8gemVyb1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9zaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5vcm1hbHNbaV0gPSAwO1xuICAgIH1cblxuICAgIC8vIEFjY3VtdWxhdGUgZmFjZSBub3JtYWxzIGZvciBlYWNoIHZlcnRleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGkxID0gaW5kaWNlc1tpICogM107XG4gICAgICAgIGNvbnN0IGkyID0gaW5kaWNlc1tpICogMyArIDFdO1xuICAgICAgICBjb25zdCBpMyA9IGluZGljZXNbaSAqIDMgKyAyXTtcblxuICAgICAgICBwMS5zZXQocG9zaXRpb25zW2kxICogM10sIHBvc2l0aW9uc1tpMSAqIDMgKyAxXSwgcG9zaXRpb25zW2kxICogMyArIDJdKTtcbiAgICAgICAgcDIuc2V0KHBvc2l0aW9uc1tpMiAqIDNdLCBwb3NpdGlvbnNbaTIgKiAzICsgMV0sIHBvc2l0aW9uc1tpMiAqIDMgKyAyXSk7XG4gICAgICAgIHAzLnNldChwb3NpdGlvbnNbaTMgKiAzXSwgcG9zaXRpb25zW2kzICogMyArIDFdLCBwb3NpdGlvbnNbaTMgKiAzICsgMl0pO1xuXG4gICAgICAgIHAxcDIuc3ViMihwMiwgcDEpO1xuICAgICAgICBwMXAzLnN1YjIocDMsIHAxKTtcbiAgICAgICAgZmFjZU5vcm1hbC5jcm9zcyhwMXAyLCBwMXAzKS5ub3JtYWxpemUoKTtcblxuICAgICAgICBub3JtYWxzW2kxICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMSAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTEgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kyICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMiAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTIgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kzICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMyAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTMgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGl6ZSBhbGwgbm9ybWFsc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBueCA9IG5vcm1hbHNbaSAqIDNdO1xuICAgICAgICBjb25zdCBueSA9IG5vcm1hbHNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgbnogPSBub3JtYWxzW2kgKiAzICsgMl07XG4gICAgICAgIGNvbnN0IGludkxlbiA9IDEgLyBNYXRoLnNxcnQobnggKiBueCArIG55ICogbnkgKyBueiAqIG56KTtcbiAgICAgICAgbm9ybWFsc1tpICogM10gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMV0gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMl0gKj0gaW52TGVuO1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxzO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0YW5nZW50IGluZm9ybWF0aW9uIGZyb20gdGhlIHNwZWNpZmllZCBwb3NpdGlvbnMsIG5vcm1hbHMsIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kXG4gKiB0cmlhbmdsZSBpbmRpY2VzLiBTZWUge0BsaW5rIGNyZWF0ZU1lc2h9LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IG5vcm1hbHMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gdXZzIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0YW5nZW50cyA9IHBjLmNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAqIGNvbnN0IG1lc2ggPSBwYy5jcmVhdGVNZXNoKGdyYXBoaWNzRGV2aWNlLCBwb3NpdGlvbnMsIHtcbiAqICAgICBub3JtYWxzOiBub3JtYWxzLFxuICogICAgIHRhbmdlbnRzOiB0YW5nZW50cyxcbiAqICAgICB1dnM6IHV2cyxcbiAqICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gKiB9KTtcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcykge1xuICAgIC8vIExlbmd5ZWwncyBNZXRob2RcbiAgICAvLyBodHRwOi8vd2ViLmFyY2hpdmUub3JnL3dlYi8yMDE4MDYyMDAyNDQzOS9odHRwOi8vd3d3LnRlcmF0aG9uLmNvbS9jb2RlL3RhbmdlbnQuaHRtbFxuICAgIGNvbnN0IHRyaWFuZ2xlQ291bnQgPSBpbmRpY2VzLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgdmVydGV4Q291bnQgICA9IHBvc2l0aW9ucy5sZW5ndGggLyAzO1xuICAgIGNvbnN0IHYxICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHYyICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHYzICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHcxICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHcyICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHczICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHNkaXIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRkaXIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRhbjEgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleENvdW50ICogMyk7XG4gICAgY29uc3QgdGFuMiA9IG5ldyBGbG9hdDMyQXJyYXkodmVydGV4Q291bnQgKiAzKTtcblxuICAgIGNvbnN0IHRhbmdlbnRzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlQ291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBpMSA9IGluZGljZXNbaSAqIDNdO1xuICAgICAgICBjb25zdCBpMiA9IGluZGljZXNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgaTMgPSBpbmRpY2VzW2kgKiAzICsgMl07XG5cbiAgICAgICAgdjEuc2V0KHBvc2l0aW9uc1tpMSAqIDNdLCBwb3NpdGlvbnNbaTEgKiAzICsgMV0sIHBvc2l0aW9uc1tpMSAqIDMgKyAyXSk7XG4gICAgICAgIHYyLnNldChwb3NpdGlvbnNbaTIgKiAzXSwgcG9zaXRpb25zW2kyICogMyArIDFdLCBwb3NpdGlvbnNbaTIgKiAzICsgMl0pO1xuICAgICAgICB2My5zZXQocG9zaXRpb25zW2kzICogM10sIHBvc2l0aW9uc1tpMyAqIDMgKyAxXSwgcG9zaXRpb25zW2kzICogMyArIDJdKTtcblxuICAgICAgICB3MS5zZXQodXZzW2kxICogMl0sIHV2c1tpMSAqIDIgKyAxXSk7XG4gICAgICAgIHcyLnNldCh1dnNbaTIgKiAyXSwgdXZzW2kyICogMiArIDFdKTtcbiAgICAgICAgdzMuc2V0KHV2c1tpMyAqIDJdLCB1dnNbaTMgKiAyICsgMV0pO1xuXG4gICAgICAgIGNvbnN0IHgxID0gdjIueCAtIHYxLng7XG4gICAgICAgIGNvbnN0IHgyID0gdjMueCAtIHYxLng7XG4gICAgICAgIGNvbnN0IHkxID0gdjIueSAtIHYxLnk7XG4gICAgICAgIGNvbnN0IHkyID0gdjMueSAtIHYxLnk7XG4gICAgICAgIGNvbnN0IHoxID0gdjIueiAtIHYxLno7XG4gICAgICAgIGNvbnN0IHoyID0gdjMueiAtIHYxLno7XG5cbiAgICAgICAgY29uc3QgczEgPSB3Mi54IC0gdzEueDtcbiAgICAgICAgY29uc3QgczIgPSB3My54IC0gdzEueDtcbiAgICAgICAgY29uc3QgdDEgPSB3Mi55IC0gdzEueTtcbiAgICAgICAgY29uc3QgdDIgPSB3My55IC0gdzEueTtcblxuICAgICAgICBjb25zdCBhcmVhID0gczEgKiB0MiAtIHMyICogdDE7XG5cbiAgICAgICAgLy8gQXJlYSBjYW4gYmUgMCBmb3IgZGVnZW5lcmF0ZSB0cmlhbmdsZXMgb3IgYmFkIHV2IGNvb3JkaW5hdGVzXG4gICAgICAgIGlmIChhcmVhID09PSAwKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBkZWZhdWx0IHZhbHVlc1xuICAgICAgICAgICAgc2Rpci5zZXQoMCwgMSwgMCk7XG4gICAgICAgICAgICB0ZGlyLnNldCgxLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSAxIC8gYXJlYTtcbiAgICAgICAgICAgIHNkaXIuc2V0KCh0MiAqIHgxIC0gdDEgKiB4MikgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHQyICogeTEgLSB0MSAqIHkyKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAodDIgKiB6MSAtIHQxICogejIpICogcik7XG4gICAgICAgICAgICB0ZGlyLnNldCgoczEgKiB4MiAtIHMyICogeDEpICogcixcbiAgICAgICAgICAgICAgICAgICAgIChzMSAqIHkyIC0gczIgKiB5MSkgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHMxICogejIgLSBzMiAqIHoxKSAqIHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFuMVtpMSAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTEgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kxICogMyArIDJdICs9IHNkaXIuejtcbiAgICAgICAgdGFuMVtpMiAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTIgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kyICogMyArIDJdICs9IHNkaXIuejtcbiAgICAgICAgdGFuMVtpMyAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTMgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kzICogMyArIDJdICs9IHNkaXIuejtcblxuICAgICAgICB0YW4yW2kxICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMSAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTEgKiAzICsgMl0gKz0gdGRpci56O1xuICAgICAgICB0YW4yW2kyICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMiAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTIgKiAzICsgMl0gKz0gdGRpci56O1xuICAgICAgICB0YW4yW2kzICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMyAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTMgKiAzICsgMl0gKz0gdGRpci56O1xuICAgIH1cblxuICAgIGNvbnN0IHQxID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0MiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgbiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdGVtcCA9IG5ldyBWZWMzKCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleENvdW50OyBpKyspIHtcbiAgICAgICAgbi5zZXQobm9ybWFsc1tpICogM10sIG5vcm1hbHNbaSAqIDMgKyAxXSwgbm9ybWFsc1tpICogMyArIDJdKTtcbiAgICAgICAgdDEuc2V0KHRhbjFbaSAqIDNdLCB0YW4xW2kgKiAzICsgMV0sIHRhbjFbaSAqIDMgKyAyXSk7XG4gICAgICAgIHQyLnNldCh0YW4yW2kgKiAzXSwgdGFuMltpICogMyArIDFdLCB0YW4yW2kgKiAzICsgMl0pO1xuXG4gICAgICAgIC8vIEdyYW0tU2NobWlkdCBvcnRob2dvbmFsaXplXG4gICAgICAgIGNvbnN0IG5kb3R0ID0gbi5kb3QodDEpO1xuICAgICAgICB0ZW1wLmNvcHkobikubXVsU2NhbGFyKG5kb3R0KTtcbiAgICAgICAgdGVtcC5zdWIyKHQxLCB0ZW1wKS5ub3JtYWxpemUoKTtcblxuICAgICAgICB0YW5nZW50c1tpICogNF0gICAgID0gdGVtcC54O1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDFdID0gdGVtcC55O1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDJdID0gdGVtcC56O1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBoYW5kZWRuZXNzXG4gICAgICAgIHRlbXAuY3Jvc3MobiwgdDEpO1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDNdID0gKHRlbXAuZG90KHQyKSA8IDAuMCkgPyAtMS4wIDogMS4wO1xuICAgIH1cblxuICAgIHJldHVybiB0YW5nZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IG1lc2ggb2JqZWN0IGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBpbmZvcm1hdGlvbiBhbmQgdG9wb2xvZ3kuXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLm5vcm1hbHNdIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggbm9ybWFscy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLnRhbmdlbnRzXSAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHRhbmdlbnRzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuY29sb3JzXSAtIEFuIGFycmF5IG9mIDQtZGltZW5zaW9uYWwgdmVydGV4IGNvbG9ycyB3aGVyZSBlYWNoIGNvbXBvbmVudFxuICogaXMgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2UgMCB0byAyNTUuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy51dnNdIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLnV2czFdIC0gU2FtZSBhcyBvcHRzLnV2cywgYnV0IGZvciBhZGRpdGlvbmFsIFVWIHNldFxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuYmxlbmRJbmRpY2VzXSAtIEFuIGFycmF5IG9mIDQtZGltZW5zaW9uYWwgYm9uZSBpbmRpY2VzIHdoZXJlIGVhY2hcbiAqIGNvbXBvbmVudCBpcyBhbiBpbnRlZ2VyIGluIHRoZSByYW5nZSAwIHRvIDI1NS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmJsZW5kV2VpZ2h0c10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIGJvbmUgd2VpZ2h0cyB3aGVyZSBlYWNoXG4gKiBjb21wb25lbnQgaXMgaW4gdGhlIHJhbmdlIDAgdG8gMSBhbmQgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBzaG91bGQgZXF1YWwgMS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmluZGljZXNdIC0gQW4gYXJyYXkgb2YgdHJpYW5nbGUgaW5kaWNlcy5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBNZXNoIGNvbnN0cnVjdGVkIGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBhbmQgdHJpYW5nbGUgZGF0YS5cbiAqIEBleGFtcGxlXG4gKiAvLyBDcmVhdGUgYSBzaW1wbGUsIGluZGV4ZWQgdHJpYW5nbGUgKHdpdGggdGV4dHVyZSBjb29yZGluYXRlcyBhbmQgdmVydGV4IG5vcm1hbHMpXG4gKiBjb25zdCBtZXNoID0gcGMuY3JlYXRlTWVzaChncmFwaGljc0RldmljZSwgWzAsIDAsIDAsIDEsIDAsIDAsIDAsIDEsIDBdLCB7XG4gKiAgICAgbm9ybWFsczogWzAsIDAsIDEsIDAsIDAsIDEsIDAsIDAsIDFdLFxuICogICAgIHV2czogWzAsIDAsIDEsIDAsIDAsIDFdLFxuICogICAgIGluZGljZXM6IFswLCAxLCAyXVxuICogfSk7XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0cykge1xuXG4gICAgY29uc3QgbWVzaCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgbWVzaC5zZXRQb3NpdGlvbnMocG9zaXRpb25zKTtcblxuICAgIGlmIChvcHRzKSB7XG4gICAgICAgIGlmIChvcHRzLm5vcm1hbHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0Tm9ybWFscyhvcHRzLm5vcm1hbHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudGFuZ2VudHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1RBTkdFTlQsIG9wdHMudGFuZ2VudHMsIDQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuY29sb3JzKSB7XG4gICAgICAgICAgICBtZXNoLnNldENvbG9yczMyKG9wdHMuY29sb3JzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLnV2cykge1xuICAgICAgICAgICAgbWVzaC5zZXRVdnMoMCwgb3B0cy51dnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudXZzMSkge1xuICAgICAgICAgICAgbWVzaC5zZXRVdnMoMSwgb3B0cy51dnMxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmJsZW5kSW5kaWNlcykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBvcHRzLmJsZW5kSW5kaWNlcywgNCwgb3B0cy5ibGVuZEluZGljZXMubGVuZ3RoIC8gNCwgVFlQRV9VSU5UOCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5ibGVuZFdlaWdodHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0JMRU5EV0VJR0hULCBvcHRzLmJsZW5kV2VpZ2h0cywgNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5pbmRpY2VzKSB7XG4gICAgICAgICAgICBtZXNoLnNldEluZGljZXMob3B0cy5pbmRpY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1lc2gudXBkYXRlKCk7XG4gICAgcmV0dXJuIG1lc2g7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgdG9ydXMtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSB0b3J1cyBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIHRvcnVzIGluIHRoZSBYWi1wbGFuZSB3aXRoIGEgdHViZSByYWRpdXMgb2ZcbiAqIDAuMiwgYSByaW5nIHJhZGl1cyBvZiAwLjMsIDIwIHNlZ21lbnRzIGFuZCAzMCBzaWRlcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHRvcnVzIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgdG9ydXMncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMudHViZVJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIHRvcnVzXG4gKiAoZGVmYXVsdHMgdG8gMC4yKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5yaW5nUmFkaXVzXSAtIFRoZSByYWRpdXMgZnJvbSB0aGUgY2VudHJlIG9mIHRoZSB0b3J1cyB0byB0aGUgY2VudHJlIG9mIHRoZVxuICogdHViZSAoZGVmYXVsdHMgdG8gMC4zKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5zZWN0b3JBbmdsZV0gLSBUaGUgc2VjdG9yIGFuZ2xlIGluIGRlZ3JlZXMgb2YgdGhlIHJpbmcgb2YgdGhlIHRvcnVzXG4gKiAoZGVmYXVsdHMgdG8gMiAqIE1hdGguUEkpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgcmFkaWFsIGRpdmlzaW9ucyBmb3JtaW5nIGNyb3NzLXNlY3Rpb25zIG9mIHRoZVxuICogdG9ydXMgcmluZyAoZGVmYXVsdHMgdG8gMjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNpZGVzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSB0b3J1cyByaW5nXG4gKiAoZGVmYXVsdHMgdG8gMzApLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgdG9ydXMtc2hhcGVkIG1lc2guXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVG9ydXMoZGV2aWNlLCBvcHRzID0ge30pIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJjID0gb3B0cy50dWJlUmFkaXVzID8/IDAuMjtcbiAgICBjb25zdCBydCA9IG9wdHMucmluZ1JhZGl1cyA/PyAwLjM7XG4gICAgY29uc3Qgc2VjdG9yQW5nbGUgPSAob3B0cy5zZWN0b3JBbmdsZSA/PyAzNjApICogbWF0aC5ERUdfVE9fUkFEO1xuICAgIGNvbnN0IHNlZ21lbnRzID0gb3B0cy5zZWdtZW50cyA/PyAzMDtcbiAgICBjb25zdCBzaWRlcyA9IG9wdHMuc2lkZXMgPz8gMjA7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA/PyBmYWxzZTtcblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBzaWRlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHNlZ21lbnRzOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLmNvcyhzZWN0b3JBbmdsZSAqIGogLyBzZWdtZW50cykgKiAocnQgKyByYyAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKSk7XG4gICAgICAgICAgICBjb25zdCB5ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpICogcmM7XG4gICAgICAgICAgICBjb25zdCB6ID0gTWF0aC5zaW4oc2VjdG9yQW5nbGUgKiBqIC8gc2VnbWVudHMpICogKHJ0ICsgcmMgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcykpO1xuXG4gICAgICAgICAgICBjb25zdCBueCA9IE1hdGguY29zKHNlY3RvckFuZ2xlICogaiAvIHNlZ21lbnRzKSAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKTtcbiAgICAgICAgICAgIGNvbnN0IG55ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpO1xuICAgICAgICAgICAgY29uc3QgbnogPSBNYXRoLnNpbihzZWN0b3JBbmdsZSAqIGogLyBzZWdtZW50cykgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHUgPSBpIC8gc2lkZXM7XG4gICAgICAgICAgICBjb25zdCB2ID0gMSAtIGogLyBzZWdtZW50cztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2gobngsIG55LCBueik7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxLjAgLSB2KTtcblxuICAgICAgICAgICAgaWYgKChpIDwgc2lkZXMpICYmIChqIDwgc2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKChpKSkgICAgICogKHNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgPSAoKGkgKyAxKSkgKiAoc2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICA9ICgoaSkpICAgICAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdXJ0aCA9ICgoaSArIDEpKSAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goc2Vjb25kLCBmb3VydGgsIHRoaXJkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUNvbmVEYXRhKGJhc2VSYWRpdXMsIHBlYWtSYWRpdXMsIGhlaWdodCwgaGVpZ2h0U2VnbWVudHMsIGNhcFNlZ21lbnRzLCByb3VuZGVkQ2Fwcykge1xuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvcyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tVG9Ub3AgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IG5vcm0gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRvcCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0YW5nZW50ID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgdXZzMSA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcbiAgICBsZXQgb2Zmc2V0O1xuXG4gICAgLy8gRGVmaW5lIHRoZSBib2R5IG9mIHRoZSBjb25lL2N5bGluZGVyXG4gICAgaWYgKGhlaWdodCA+IDApIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gaGVpZ2h0U2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gY2FwU2VnbWVudHM7IGorKykge1xuICAgICAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBjb25lIGJvZHkgZnJvbSB0aGUgcG9zaXRpdmUgWSBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBjb25lL2N5bGluZGVyXG4gICAgICAgICAgICAgICAgY29uc3QgdGhldGEgPSAoaiAvIGNhcFNlZ21lbnRzKSAqIDIgKiBNYXRoLlBJIC0gTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBib3R0b20uc2V0KHNpblRoZXRhICogYmFzZVJhZGl1cywgLWhlaWdodCAvIDIsIGNvc1RoZXRhICogYmFzZVJhZGl1cyk7XG4gICAgICAgICAgICAgICAgdG9wLnNldChzaW5UaGV0YSAqIHBlYWtSYWRpdXMsIGhlaWdodCAvIDIsIGNvc1RoZXRhICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgcG9zLmxlcnAoYm90dG9tLCB0b3AsIGkgLyBoZWlnaHRTZWdtZW50cyk7XG4gICAgICAgICAgICAgICAgYm90dG9tVG9Ub3Auc3ViMih0b3AsIGJvdHRvbSkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICAgICAgdGFuZ2VudC5zZXQoY29zVGhldGEsIDAsIC1zaW5UaGV0YSk7XG4gICAgICAgICAgICAgICAgbm9ybS5jcm9zcyh0YW5nZW50LCBib3R0b21Ub1RvcCkubm9ybWFsaXplKCk7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaChwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2gobm9ybS54LCBub3JtLnksIG5vcm0ueik7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBqIC8gY2FwU2VnbWVudHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSBpIC8gaGVpZ2h0U2VnbWVudHM7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMXN0IHRoaXJkXG4gICAgICAgICAgICAgICAgY29uc3QgX3YgPSB2O1xuICAgICAgICAgICAgICAgIHYgPSB1O1xuICAgICAgICAgICAgICAgIHUgPSBfdjtcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgaGVpZ2h0U2VnbWVudHMpICYmIChqIDwgY2FwU2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICAgPSAoKGkpKSAgICAgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgID0gKChpKSkgICAgICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICAgPSAoKGkgKyAxKSkgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3VydGggID0gKChpICsgMSkpICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHNlY29uZCwgZm91cnRoLCB0aGlyZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJvdW5kZWRDYXBzKSB7XG4gICAgICAgIGNvbnN0IGxhdGl0dWRlQmFuZHMgPSBNYXRoLmZsb29yKGNhcFNlZ21lbnRzIC8gMik7XG4gICAgICAgIGNvbnN0IGxvbmdpdHVkZUJhbmRzID0gY2FwU2VnbWVudHM7XG4gICAgICAgIGNvbnN0IGNhcE9mZnNldCA9IGhlaWdodCAvIDI7XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgdG9wIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGxhdCAqIE1hdGguUEkgKiAwLjUpIC8gbGF0aXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8PSBsb25naXR1ZGVCYW5kczsgbG9uKyspIHtcbiAgICAgICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpblBoaSA9IE1hdGguc2luKHBoaSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gY29zVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtIGxvbiAvIGxvbmdpdHVkZUJhbmRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcGVha1JhZGl1cywgeSAqIHBlYWtSYWRpdXMgKyBjYXBPZmZzZXQsIHogKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMm5kIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMS4wIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8IGxvbmdpdHVkZUJhbmRzOyArK2xvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQsIG9mZnNldCArIGZpcnN0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQgKyAxLCBvZmZzZXQgKyBzZWNvbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgYm90dG9tIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gTWF0aC5QSSAqIDAuNSArIChsYXQgKiBNYXRoLlBJICogMC41KSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBoaSA9IGxvbiAqIDIgKiBNYXRoLlBJIC8gbG9uZ2l0dWRlQmFuZHMgLSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29zUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IDEgLSBsYXQgLyBsYXRpdHVkZUJhbmRzO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHBlYWtSYWRpdXMsIHkgKiBwZWFrUmFkaXVzIC0gY2FwT2Zmc2V0LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIuMCAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9mZnNldCA9IChoZWlnaHRTZWdtZW50cyArIDEpICogKGNhcFNlZ21lbnRzICsgMSkgKyAobG9uZ2l0dWRlQmFuZHMgKyAxKSAqIChsYXRpdHVkZUJhbmRzICsgMSk7XG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8IGxhdGl0dWRlQmFuZHM7ICsrbGF0KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IGZpcnN0ICsgbG9uZ2l0dWRlQmFuZHMgKyAxO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kLCBvZmZzZXQgKyBmaXJzdCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kICsgMSwgb2Zmc2V0ICsgc2Vjb25kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEdlbmVyYXRlIGJvdHRvbSBjYXBcbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgaWYgKGJhc2VSYWRpdXMgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcFNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aGV0YSA9IChpIC8gY2FwU2VnbWVudHMpICogMiAqIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gLWhlaWdodCAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSAoeCArIDEpIC8gMjtcbiAgICAgICAgICAgICAgICBsZXQgdiA9ICh6ICsgMSkgLyAyO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIGJhc2VSYWRpdXMsIHksIHogKiBiYXNlUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goMCwgLTEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDJuZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDEgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSwgb2Zmc2V0ICsgaSAtIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHRvcCBjYXBcbiAgICAgICAgb2Zmc2V0ICs9IGNhcFNlZ21lbnRzO1xuICAgICAgICBpZiAocGVha1JhZGl1cyA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FwU2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGkgLyBjYXBTZWdtZW50cykgKiAyICogTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBoZWlnaHQgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gKHggKyAxKSAvIDI7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAoeiArIDEpIC8gMjtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBwZWFrUmFkaXVzLCB5LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIDEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSAtIDEsIG9mZnNldCArIGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHBvc2l0aW9uczogcG9zaXRpb25zLFxuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzMSxcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY3lsaW5kZXItc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjeWxpbmRlciBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGN5bGluZGVyIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgcmFkaXVzIG9mIDAuNSwgYSBoZWlnaHQgb2YgMS4wLCAxIGhlaWdodCBzZWdtZW50IGFuZCAyMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjeWxpbmRlciBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGN5bGluZGVyJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICogZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIGN5bGluZGVyXG4gKiAoZGVmYXVsdHMgdG8gMC41KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRdIC0gVGhlIGxlbmd0aCBvZiB0aGUgYm9keSBvZiB0aGUgY3lsaW5kZXIgKGRlZmF1bHRzIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxlbmd0aCBvZiB0aGUgY3lsaW5kZXJcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5jYXBTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGVcbiAqIGN5bGluZGVyIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDeWxpbmRlcihkZXZpY2UsIG9wdHMgPSB7fSkge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmFkaXVzID0gb3B0cy5yYWRpdXMgPz8gMC41O1xuICAgIGNvbnN0IGhlaWdodCA9IG9wdHMuaGVpZ2h0ID8/IDE7XG4gICAgY29uc3QgaGVpZ2h0U2VnbWVudHMgPSBvcHRzLmhlaWdodFNlZ21lbnRzID8/IDU7XG4gICAgY29uc3QgY2FwU2VnbWVudHMgPSBvcHRzLmNhcFNlZ21lbnRzID8/IDIwO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgPz8gZmFsc2U7XG5cbiAgICAvLyBDcmVhdGUgdmVydGV4IGRhdGEgZm9yIGEgY29uZSB0aGF0IGhhcyBhIGJhc2UgYW5kIHBlYWsgcmFkaXVzIHRoYXQgaXMgdGhlIHNhbWUgKGkuZS4gYSBjeWxpbmRlcilcbiAgICBjb25zdCBvcHRpb25zID0gX2NyZWF0ZUNvbmVEYXRhKHJhZGl1cywgcmFkaXVzLCBoZWlnaHQsIGhlaWdodFNlZ21lbnRzLCBjYXBTZWdtZW50cywgZmFsc2UpO1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMob3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMubm9ybWFscywgb3B0aW9ucy51dnMsIG9wdGlvbnMuaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY2Fwc3VsZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGNhcHN1bGUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBjYXBzdWxlIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgcmFkaXVzIG9mIDAuMjUsIGEgaGVpZ2h0IG9mIDEuMCwgMSBoZWlnaHQgc2VnbWVudCBhbmQgMTAgY2FwIHNlZ21lbnRzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY2Fwc3VsZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGNhcHN1bGUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHR1YmUgZm9ybWluZyB0aGUgYm9keSBvZiB0aGUgY2Fwc3VsZSAoZGVmYXVsdHNcbiAqIHRvIDAuMykuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGNhcHN1bGUgZnJvbSB0aXAgdG8gdGlwIChkZWZhdWx0c1xuICogdG8gMS4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgdHVidWxhciBsZW5ndGggb2YgdGhlXG4gKiBjYXBzdWxlIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5zaWRlc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGUgY2Fwc3VsZVxuICogKGRlZmF1bHRzIHRvIDIwKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGN5bGluZGVyLXNoYXBlZCBtZXNoLlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNhcHN1bGUoZGV2aWNlLCBvcHRzID0ge30pIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJhZGl1cyA9IG9wdHMucmFkaXVzID8/IDAuMztcbiAgICBjb25zdCBoZWlnaHQgPSBvcHRzLmhlaWdodCA/PyAxO1xuICAgIGNvbnN0IGhlaWdodFNlZ21lbnRzID0gb3B0cy5oZWlnaHRTZWdtZW50cyA/PyAxO1xuICAgIGNvbnN0IHNpZGVzID0gb3B0cy5zaWRlcyA/PyAyMDtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzID8/IGZhbHNlO1xuXG4gICAgLy8gQ3JlYXRlIHZlcnRleCBkYXRhIGZvciBhIGNvbmUgdGhhdCBoYXMgYSBiYXNlIGFuZCBwZWFrIHJhZGl1cyB0aGF0IGlzIHRoZSBzYW1lIChpLmUuIGEgY3lsaW5kZXIpXG4gICAgY29uc3Qgb3B0aW9ucyA9IF9jcmVhdGVDb25lRGF0YShyYWRpdXMsIHJhZGl1cywgaGVpZ2h0IC0gMiAqIHJhZGl1cywgaGVpZ2h0U2VnbWVudHMsIHNpZGVzLCB0cnVlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGNvbmUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjb25lIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgY29uZSBzdGFuZGluZyB2ZXJ0aWNhbGx5IGNlbnRlcmVkIG9uIHRoZVxuICogWFotcGxhbmUgd2l0aCBhIGJhc2UgcmFkaXVzIG9mIDAuNSwgYSBoZWlnaHQgb2YgMS4wLCA1IGhlaWdodCBzZWdtZW50cyBhbmQgMjAgY2FwIHNlZ21lbnRzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY29uZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudCBpbmZvcm1hdGlvblxuICogaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGNvbmUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuYmFzZVJhZGl1c10gLSBUaGUgYmFzZSByYWRpdXMgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucGVha1JhZGl1c10gLSBUaGUgcGVhayByYWRpdXMgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDAuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxlbmd0aCBvZiB0aGUgY29uZVxuICogKGRlZmF1bHRzIHRvIDUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmNhcFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSBjb25lXG4gKiAoZGVmYXVsdHMgdG8gMTgpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgY29uZS1zaGFwZWQgbWVzaC5cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDb25lKGRldmljZSwgb3B0cyA9IHt9KSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBiYXNlUmFkaXVzID0gb3B0cy5iYXNlUmFkaXVzID8/IDAuNTtcbiAgICBjb25zdCBwZWFrUmFkaXVzID0gb3B0cy5wZWFrUmFkaXVzID8/IDA7XG4gICAgY29uc3QgaGVpZ2h0ID0gb3B0cy5oZWlnaHQgPz8gMTtcbiAgICBjb25zdCBoZWlnaHRTZWdtZW50cyA9IG9wdHMuaGVpZ2h0U2VnbWVudHMgPz8gNTtcbiAgICBjb25zdCBjYXBTZWdtZW50cyA9IG9wdHMuY2FwU2VnbWVudHMgPz8gMTg7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA/PyBmYWxzZTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBfY3JlYXRlQ29uZURhdGEoYmFzZVJhZGl1cywgcGVha1JhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIGZhbHNlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHNwaGVyZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgc3BoZXJlIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLiBCeVxuICogZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgc3BoZXJlIGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSByYWRpdXMgb2ZcbiAqIDAuNSBhbmQgMTYgc2VnbWVudHMgaW4gYm90aCBsb25naXR1ZGUgYW5kIGxhdGl0dWRlLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc3BoZXJlIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgc3BoZXJlJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICogZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGF0aXR1ZGVCYW5kc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGF0aXR1ZGluYWwgYXhpcyBvZiB0aGVcbiAqIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxvbmdpdHVkZUJhbmRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsb25naXR1ZGluYWwgYXhpcyBvZlxuICogdGhlIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgc3BoZXJlLXNoYXBlZCBtZXNoLlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNwaGVyZShkZXZpY2UsIG9wdHMgPSB7fSkge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmFkaXVzID0gb3B0cy5yYWRpdXMgPz8gMC41O1xuICAgIGNvbnN0IGxhdGl0dWRlQmFuZHMgPSBvcHRzLmxhdGl0dWRlQmFuZHMgPz8gMTY7XG4gICAgY29uc3QgbG9uZ2l0dWRlQmFuZHMgPSBvcHRzLmxvbmdpdHVkZUJhbmRzID8/IDE2O1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgPz8gZmFsc2U7XG5cbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuXG4gICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDw9IGxhdGl0dWRlQmFuZHM7IGxhdCsrKSB7XG4gICAgICAgIGNvbnN0IHRoZXRhID0gbGF0ICogTWF0aC5QSSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcblxuICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICBjb25zdCBwaGkgPSBsb24gKiAyICogTWF0aC5QSSAvIGxvbmdpdHVkZUJhbmRzIC0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgY29uc3QgeCA9IGNvc1BoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgY29uc3QgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHYgPSAxIC0gbGF0IC8gbGF0aXR1ZGVCYW5kcztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHJhZGl1cywgeSAqIHJhZGl1cywgeiAqIHJhZGl1cyk7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPCBsYXRpdHVkZUJhbmRzOyArK2xhdCkge1xuICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBmaXJzdCArIGxvbmdpdHVkZUJhbmRzICsgMTtcblxuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0ICsgMSwgc2Vjb25kLCBmaXJzdCk7XG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goZmlyc3QgKyAxLCBzZWNvbmQgKyAxLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2cywgLy8gVVYxID0gVVYwIGZvciBzcGhlcmVcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHBsYW5lLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBwbGFuZSBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb24gcGFyYW1ldGVycy4gQnlcbiAqIGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIHBsYW5lIGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSB3aWR0aCBhbmRcbiAqIGxlbmd0aCBvZiAxLjAgYW5kIDUgc2VnbWVudHMgaW4gZWl0aGVyIGF4aXMgKDUwIHRyaWFuZ2xlcykuIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBwbGFuZSBpc1xuICogYWxpZ25lZCBhbG9uZyB0aGUgcG9zaXRpdmUgWSBheGlzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgcGxhbmUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBwbGFuZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7VmVjMn0gW29wdHMuaGFsZkV4dGVudHNdIC0gVGhlIGhhbGYgZGltZW5zaW9ucyBvZiB0aGUgcGxhbmUgaW4gdGhlIFggYW5kIFogYXhlc1xuICogKGRlZmF1bHRzIHRvIFswLjUsIDAuNV0pLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLndpZHRoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFggYXhpcyBvZiB0aGUgcGxhbmVcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sZW5ndGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWiBheGlzIG9mIHRoZSBwbGFuZVxuICogKGRlZmF1bHRzIHRvIDUpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgcGxhbmUtc2hhcGVkIG1lc2guXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGxhbmUoZGV2aWNlLCBvcHRzID0ge30pIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IGhlID0gb3B0cy5oYWxmRXh0ZW50cyA/PyBuZXcgVmVjMigwLjUsIDAuNSk7XG4gICAgY29uc3Qgd3MgPSBvcHRzLndpZHRoU2VnbWVudHMgPz8gNTtcbiAgICBjb25zdCBscyA9IG9wdHMubGVuZ3RoU2VnbWVudHMgPz8gNTtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzID8/IGZhbHNlO1xuXG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcblxuICAgIC8vIEdlbmVyYXRlIHBsYW5lIGFzIGZvbGxvd3MgKGFzc2lnbmVkIFVWcyBkZW5vdGVkIGF0IGNvcm5lcnMpOlxuICAgIC8vICgwLDEpeC0tLS0tLS0tLXgoMSwxKVxuICAgIC8vICAgICAgfCAgICAgICAgIHxcbiAgICAvLyAgICAgIHwgICAgICAgICB8XG4gICAgLy8gICAgICB8ICAgIE8tLVggfGxlbmd0aFxuICAgIC8vICAgICAgfCAgICB8ICAgIHxcbiAgICAvLyAgICAgIHwgICAgWiAgICB8XG4gICAgLy8gKDAsMCl4LS0tLS0tLS0teCgxLDApXG4gICAgLy8gd2lkdGhcbiAgICBsZXQgdmNvdW50ZXIgPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gd3M7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8PSBsczsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gLWhlLnggKyAyICogaGUueCAqIGkgLyB3cztcbiAgICAgICAgICAgIGNvbnN0IHkgPSAwLjA7XG4gICAgICAgICAgICBjb25zdCB6ID0gLSgtaGUueSArIDIgKiBoZS55ICogaiAvIGxzKTtcbiAgICAgICAgICAgIGNvbnN0IHUgPSBpIC8gd3M7XG4gICAgICAgICAgICBjb25zdCB2ID0gaiAvIGxzO1xuXG4gICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgIG5vcm1hbHMucHVzaCgwLCAxLCAwKTtcbiAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgaWYgKChpIDwgd3MpICYmIChqIDwgbHMpKSB7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgbHMgKyAxLCB2Y291bnRlciArIDEsIHZjb3VudGVyKTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyBscyArIDEsIHZjb3VudGVyICsgbHMgKyAyLCB2Y291bnRlciArIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2Y291bnRlcisrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2cywgLy8gVVYxID0gVVYwIGZvciBwbGFuZVxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgYm94LXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgYm94IGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLlxuICogQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgYm94IGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSB3aWR0aCxcbiAqIGxlbmd0aCBhbmQgaGVpZ2h0IG9mIDEuMCB1bml0IGFuZCAxMCBzZWdtZW50cyBpbiBlaXRoZXIgYXhpcyAoNTAgdHJpYW5nbGVzIHBlciBmYWNlKS5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGJveCBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEgb24gZWFjaCBmYWNlLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBib3gncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge1ZlYzN9IFtvcHRzLmhhbGZFeHRlbnRzXSAtIFRoZSBoYWxmIGRpbWVuc2lvbnMgb2YgdGhlIGJveCBpbiBlYWNoIGF4aXMgKGRlZmF1bHRzIHRvXG4gKiBbMC41LCAwLjUsIDAuNV0pLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLndpZHRoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFggYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGVuZ3RoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFogYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFkgYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy55T2Zmc2V0XSAtIE1vdmUgdGhlIGJveCB2ZXJ0aWNhbGx5IGJ5IGdpdmVuIG9mZnNldCBpbiBsb2NhbCBzcGFjZS4gUGFzc1xuICogMC41IHRvIGdlbmVyYXRlIHRoZSBib3ggd2l0aCBwaXZvdCBwb2ludCBhdCB0aGUgYm90dG9tIGZhY2UuIERlZmF1bHRzIHRvIDAuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgYm94LXNoYXBlZCBtZXNoLlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUJveChkZXZpY2UsIG9wdHMgPSB7fSkge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgaGUgPSBvcHRzLmhhbGZFeHRlbnRzID8/IG5ldyBWZWMzKDAuNSwgMC41LCAwLjUpO1xuICAgIGNvbnN0IHdzID0gb3B0cy53aWR0aFNlZ21lbnRzID8/IDE7XG4gICAgY29uc3QgbHMgPSBvcHRzLmxlbmd0aFNlZ21lbnRzID8/IDE7XG4gICAgY29uc3QgaHMgPSBvcHRzLmhlaWdodFNlZ21lbnRzID8/IDE7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA/PyBmYWxzZTtcblxuICAgIGNvbnN0IHlPZmZzZXQgPSBvcHRzLnlPZmZzZXQgPz8gMDtcbiAgICBjb25zdCBtaW5ZID0gLWhlLnkgKyB5T2Zmc2V0O1xuICAgIGNvbnN0IG1heFkgPSBoZS55ICsgeU9mZnNldDtcblxuICAgIGNvbnN0IGNvcm5lcnMgPSBbXG4gICAgICAgIG5ldyBWZWMzKC1oZS54LCBtaW5ZLCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgbWluWSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIG1heFksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMygtaGUueCwgbWF4WSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIG1pblksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIG1pblksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIG1heFksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgbWF4WSwgLWhlLnopXG4gICAgXTtcblxuICAgIGNvbnN0IGZhY2VBeGVzID0gW1xuICAgICAgICBbMCwgMSwgM10sIC8vIEZST05UXG4gICAgICAgIFs0LCA1LCA3XSwgLy8gQkFDS1xuICAgICAgICBbMywgMiwgNl0sIC8vIFRPUFxuICAgICAgICBbMSwgMCwgNF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgNCwgMl0sIC8vIFJJR0hUXG4gICAgICAgIFs1LCAwLCA2XSAgLy8gTEVGVFxuICAgIF07XG5cbiAgICBjb25zdCBmYWNlTm9ybWFscyA9IFtcbiAgICAgICAgWzAsICAwLCAgMV0sIC8vIEZST05UXG4gICAgICAgIFswLCAgMCwgLTFdLCAvLyBCQUNLXG4gICAgICAgIFswLCAgMSwgIDBdLCAvLyBUT1BcbiAgICAgICAgWzAsIC0xLCAgMF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgIDAsICAwXSwgLy8gUklHSFRcbiAgICAgICAgWy0xLCAgMCwgIDBdICAvLyBMRUZUXG4gICAgXTtcblxuICAgIGNvbnN0IHNpZGVzID0ge1xuICAgICAgICBGUk9OVDogMCxcbiAgICAgICAgQkFDSzogMSxcbiAgICAgICAgVE9QOiAyLFxuICAgICAgICBCT1RUT006IDMsXG4gICAgICAgIFJJR0hUOiA0LFxuICAgICAgICBMRUZUOiA1XG4gICAgfTtcblxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCB1dnMxID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgIGxldCB2Y291bnRlciA9IDA7XG5cbiAgICBjb25zdCBnZW5lcmF0ZUZhY2UgPSAoc2lkZSwgdVNlZ21lbnRzLCB2U2VnbWVudHMpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcDEgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCB0ZW1wMiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IHRlbXAzID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgciA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gdVNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHZTZWdtZW50czsgaisrKSB7XG4gICAgICAgICAgICAgICAgdGVtcDEubGVycChjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSwgY29ybmVyc1tmYWNlQXhlc1tzaWRlXVsxXV0sIGkgLyB1U2VnbWVudHMpO1xuICAgICAgICAgICAgICAgIHRlbXAyLmxlcnAoY29ybmVyc1tmYWNlQXhlc1tzaWRlXVswXV0sIGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMl1dLCBqIC8gdlNlZ21lbnRzKTtcbiAgICAgICAgICAgICAgICB0ZW1wMy5zdWIyKHRlbXAyLCBjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSk7XG4gICAgICAgICAgICAgICAgci5hZGQyKHRlbXAxLCB0ZW1wMyk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBpIC8gdVNlZ21lbnRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gaiAvIHZTZWdtZW50cztcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHIueCwgci55LCByLnopO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaChmYWNlTm9ybWFsc1tzaWRlXVswXSwgZmFjZU5vcm1hbHNbc2lkZV1bMV0sIGZhY2VOb3JtYWxzW3NpZGVdWzJdKTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBwYWNrIGFzIDN4Mi4gMS8zIHdpbGwgYmUgZW1wdHksIGJ1dCBpdCdzIGVpdGhlciB0aGF0IG9yIHN0cmV0Y2hlZCBwaXhlbHNcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmF0ZSBub24tcmVjdGFuZ3VsYXIgbGlnaHRNYXBzLCBzbyB3ZSBjb3VsZCB1c2Ugc3BhY2Ugd2l0aG91dCBzdHJldGNoaW5nXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuXG4gICAgICAgICAgICAgICAgdSArPSAoc2lkZSAlIDMpIC8gMztcbiAgICAgICAgICAgICAgICB2ICs9IE1hdGguZmxvb3Ioc2lkZSAvIDMpIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgdVNlZ21lbnRzKSAmJiAoaiA8IHZTZWdtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgdlNlZ21lbnRzICsgMSwgdmNvdW50ZXIgKyAxLCB2Y291bnRlcik7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIHZTZWdtZW50cyArIDEsIHZjb3VudGVyICsgdlNlZ21lbnRzICsgMiwgdmNvdW50ZXIgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2Y291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5GUk9OVCwgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuQkFDSywgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuVE9QLCB3cywgbHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5CT1RUT00sIHdzLCBscyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLlJJR0hULCBscywgaHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5MRUZULCBscywgaHMpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2czEsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLy8gcmV0dXJucyBQcmltaXRpdmUgZGF0YSwgdXNlZCBieSBNb2RlbENvbXBvbmVudCBhbmQgUmVuZGVyQ29tcG9uZW50XG5mdW5jdGlvbiBnZXRTaGFwZVByaW1pdGl2ZShkZXZpY2UsIHR5cGUpIHtcblxuICAgIC8vIGZpbmQgaW4gY2FjaGVcbiAgICBsZXQgcHJpbURhdGEgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhcGVQcmltaXRpdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChzaGFwZVByaW1pdGl2ZXNbaV0udHlwZSA9PT0gdHlwZSAmJiBzaGFwZVByaW1pdGl2ZXNbaV0uZGV2aWNlID09PSBkZXZpY2UpIHtcbiAgICAgICAgICAgIHByaW1EYXRhID0gc2hhcGVQcmltaXRpdmVzW2ldLnByaW1EYXRhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gbm90IGluIGNhY2hlLCBjcmVhdGUgbmV3XG4gICAgaWYgKCFwcmltRGF0YSkge1xuXG4gICAgICAgIGxldCBtZXNoLCBhcmVhO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSAnYm94JzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQm94KGRldmljZSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMiwgeTogMiwgejogMiwgdXY6ICgyLjAgLyAzKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ2Fwc3VsZShkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMiB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAoTWF0aC5QSSAqIDIpLCB5OiBNYXRoLlBJLCB6OiAoTWF0aC5QSSAqIDIpLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjb25lJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ29uZShkZXZpY2UsIHsgYmFzZVJhZGl1czogMC41LCBwZWFrUmFkaXVzOiAwLCBoZWlnaHQ6IDEgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMi41NCwgeTogMi41NCwgejogMi41NCwgdXY6ICgxLjAgLyAzICsgKDEuMCAvIDMpIC8gMykgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVDeWxpbmRlcihkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiBNYXRoLlBJLCB5OiAoMC43OSAqIDIpLCB6OiBNYXRoLlBJLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdwbGFuZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZVBsYW5lKGRldmljZSwgeyBoYWxmRXh0ZW50czogbmV3IFZlYzIoMC41LCAwLjUpLCB3aWR0aFNlZ21lbnRzOiAxLCBsZW5ndGhTZWdtZW50czogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAwLCB5OiAxLCB6OiAwLCB1djogMSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdzcGhlcmUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVTcGhlcmUoZGV2aWNlLCB7IHJhZGl1czogMC41IH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEksIHk6IE1hdGguUEksIHo6IE1hdGguUEksIHV2OiAxIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3RvcnVzJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlVG9ydXMoZGV2aWNlLCB7IHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEkgKiAwLjUgKiAwLjUgLSBNYXRoLlBJICogMC4xICogMC4xLCB5OiAwLjQsIHo6IDAuNCwgdXY6IDEgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpbWl0aXZlIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluYyByZWZlcmVuY2UgdG8ga2VlcCBwcmltaXRpdmUgYWxpdmVcbiAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuXG4gICAgICAgIHByaW1EYXRhID0geyBtZXNoOiBtZXNoLCBhcmVhOiBhcmVhIH07XG5cbiAgICAgICAgLy8gYWRkIHRvIGNhY2hlXG4gICAgICAgIHNoYXBlUHJpbWl0aXZlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICBkZXZpY2U6IGRldmljZSxcbiAgICAgICAgICAgIHByaW1EYXRhOiBwcmltRGF0YVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJpbURhdGE7XG59XG5cbmV4cG9ydCB7IGNhbGN1bGF0ZU5vcm1hbHMsIGNhbGN1bGF0ZVRhbmdlbnRzLCBjcmVhdGVCb3gsIGNyZWF0ZUNhcHN1bGUsIGNyZWF0ZUNvbmUsIGNyZWF0ZUN5bGluZGVyLCBjcmVhdGVNZXNoLCBjcmVhdGVQbGFuZSwgY3JlYXRlU3BoZXJlLCBjcmVhdGVUb3J1cywgZ2V0U2hhcGVQcmltaXRpdmUgfTtcbiJdLCJuYW1lcyI6WyJwcmltaXRpdmVVdjFQYWRkaW5nIiwicHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlIiwic2hhcGVQcmltaXRpdmVzIiwiY2FsY3VsYXRlTm9ybWFscyIsInBvc2l0aW9ucyIsImluZGljZXMiLCJ0cmlhbmdsZUNvdW50IiwibGVuZ3RoIiwidmVydGV4Q291bnQiLCJwMSIsIlZlYzMiLCJwMiIsInAzIiwicDFwMiIsInAxcDMiLCJmYWNlTm9ybWFsIiwibm9ybWFscyIsImkiLCJpMSIsImkyIiwiaTMiLCJzZXQiLCJzdWIyIiwiY3Jvc3MiLCJub3JtYWxpemUiLCJ4IiwieSIsInoiLCJueCIsIm55IiwibnoiLCJpbnZMZW4iLCJNYXRoIiwic3FydCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwidXZzIiwidjEiLCJ2MiIsInYzIiwidzEiLCJWZWMyIiwidzIiLCJ3MyIsInNkaXIiLCJ0ZGlyIiwidGFuMSIsIkZsb2F0MzJBcnJheSIsInRhbjIiLCJ0YW5nZW50cyIsIngxIiwieDIiLCJ5MSIsInkyIiwiejEiLCJ6MiIsInMxIiwiczIiLCJ0MSIsInQyIiwiYXJlYSIsInIiLCJuIiwidGVtcCIsIm5kb3R0IiwiZG90IiwiY29weSIsIm11bFNjYWxhciIsImNyZWF0ZU1lc2giLCJkZXZpY2UiLCJvcHRzIiwibWVzaCIsIk1lc2giLCJzZXRQb3NpdGlvbnMiLCJzZXROb3JtYWxzIiwic2V0VmVydGV4U3RyZWFtIiwiU0VNQU5USUNfVEFOR0VOVCIsImNvbG9ycyIsInNldENvbG9yczMyIiwic2V0VXZzIiwidXZzMSIsImJsZW5kSW5kaWNlcyIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlRZUEVfVUlOVDgiLCJibGVuZFdlaWdodHMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsInNldEluZGljZXMiLCJ1cGRhdGUiLCJjcmVhdGVUb3J1cyIsIl9vcHRzJHR1YmVSYWRpdXMiLCJfb3B0cyRyaW5nUmFkaXVzIiwiX29wdHMkc2VjdG9yQW5nbGUiLCJfb3B0cyRzZWdtZW50cyIsIl9vcHRzJHNpZGVzIiwiX29wdHMkY2FsY3VsYXRlVGFuZ2VuIiwicmMiLCJ0dWJlUmFkaXVzIiwicnQiLCJyaW5nUmFkaXVzIiwic2VjdG9yQW5nbGUiLCJtYXRoIiwiREVHX1RPX1JBRCIsInNlZ21lbnRzIiwic2lkZXMiLCJjYWxjVGFuZ2VudHMiLCJqIiwiY29zIiwiUEkiLCJzaW4iLCJ1IiwidiIsInB1c2giLCJmaXJzdCIsInNlY29uZCIsInRoaXJkIiwiZm91cnRoIiwib3B0aW9ucyIsIl9jcmVhdGVDb25lRGF0YSIsImJhc2VSYWRpdXMiLCJwZWFrUmFkaXVzIiwiaGVpZ2h0IiwiaGVpZ2h0U2VnbWVudHMiLCJjYXBTZWdtZW50cyIsInJvdW5kZWRDYXBzIiwicG9zIiwiYm90dG9tVG9Ub3AiLCJub3JtIiwidG9wIiwiYm90dG9tIiwidGFuZ2VudCIsIm9mZnNldCIsInRoZXRhIiwic2luVGhldGEiLCJjb3NUaGV0YSIsImxlcnAiLCJfdiIsImxhdGl0dWRlQmFuZHMiLCJmbG9vciIsImxvbmdpdHVkZUJhbmRzIiwiY2FwT2Zmc2V0IiwibGF0IiwibG9uIiwicGhpIiwic2luUGhpIiwiY29zUGhpIiwiY3JlYXRlQ3lsaW5kZXIiLCJfb3B0cyRyYWRpdXMiLCJfb3B0cyRoZWlnaHQiLCJfb3B0cyRoZWlnaHRTZWdtZW50cyIsIl9vcHRzJGNhcFNlZ21lbnRzIiwiX29wdHMkY2FsY3VsYXRlVGFuZ2VuMiIsInJhZGl1cyIsImNyZWF0ZUNhcHN1bGUiLCJfb3B0cyRyYWRpdXMyIiwiX29wdHMkaGVpZ2h0MiIsIl9vcHRzJGhlaWdodFNlZ21lbnRzMiIsIl9vcHRzJHNpZGVzMiIsIl9vcHRzJGNhbGN1bGF0ZVRhbmdlbjMiLCJjcmVhdGVDb25lIiwiX29wdHMkYmFzZVJhZGl1cyIsIl9vcHRzJHBlYWtSYWRpdXMiLCJfb3B0cyRoZWlnaHQzIiwiX29wdHMkaGVpZ2h0U2VnbWVudHMzIiwiX29wdHMkY2FwU2VnbWVudHMyIiwiX29wdHMkY2FsY3VsYXRlVGFuZ2VuNCIsImNyZWF0ZVNwaGVyZSIsIl9vcHRzJHJhZGl1czMiLCJfb3B0cyRsYXRpdHVkZUJhbmRzIiwiX29wdHMkbG9uZ2l0dWRlQmFuZHMiLCJfb3B0cyRjYWxjdWxhdGVUYW5nZW41IiwiY3JlYXRlUGxhbmUiLCJfb3B0cyRoYWxmRXh0ZW50cyIsIl9vcHRzJHdpZHRoU2VnbWVudHMiLCJfb3B0cyRsZW5ndGhTZWdtZW50cyIsIl9vcHRzJGNhbGN1bGF0ZVRhbmdlbjYiLCJoZSIsImhhbGZFeHRlbnRzIiwid3MiLCJ3aWR0aFNlZ21lbnRzIiwibHMiLCJsZW5ndGhTZWdtZW50cyIsInZjb3VudGVyIiwiY3JlYXRlQm94IiwiX29wdHMkaGFsZkV4dGVudHMyIiwiX29wdHMkd2lkdGhTZWdtZW50czIiLCJfb3B0cyRsZW5ndGhTZWdtZW50czIiLCJfb3B0cyRoZWlnaHRTZWdtZW50czQiLCJfb3B0cyRjYWxjdWxhdGVUYW5nZW43IiwiX29wdHMkeU9mZnNldCIsImhzIiwieU9mZnNldCIsIm1pblkiLCJtYXhZIiwiY29ybmVycyIsImZhY2VBeGVzIiwiZmFjZU5vcm1hbHMiLCJGUk9OVCIsIkJBQ0siLCJUT1AiLCJCT1RUT00iLCJSSUdIVCIsIkxFRlQiLCJnZW5lcmF0ZUZhY2UiLCJzaWRlIiwidVNlZ21lbnRzIiwidlNlZ21lbnRzIiwidGVtcDEiLCJ0ZW1wMiIsInRlbXAzIiwiYWRkMiIsImdldFNoYXBlUHJpbWl0aXZlIiwidHlwZSIsInByaW1EYXRhIiwidXYiLCJFcnJvciIsImluY1JlZkNvdW50Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFXQSxNQUFNQSxtQkFBbUIsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFBO0FBQ3BDLE1BQU1DLHdCQUF3QixHQUFHLEdBQUcsR0FBR0QsbUJBQW1CLEdBQUcsQ0FBQyxDQUFBOztBQUU5RDtBQUNBLE1BQU1FLGVBQWUsR0FBRyxFQUFFLENBQUE7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsZ0JBQWdCQSxDQUFDQyxTQUFTLEVBQUVDLE9BQU8sRUFBRTtBQUMxQyxFQUFBLE1BQU1DLGFBQWEsR0FBR0QsT0FBTyxDQUFDRSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ3hDLEVBQUEsTUFBTUMsV0FBVyxHQUFLSixTQUFTLENBQUNHLE1BQU0sR0FBRyxDQUFD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
