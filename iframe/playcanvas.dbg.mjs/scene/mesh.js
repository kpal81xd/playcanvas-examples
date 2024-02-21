import { Debug } from '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, BUFFER_STATIC, BUFFER_DYNAMIC, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD, SEMANTIC_COLOR, PRIMITIVE_TRIANGLES, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, PRIMITIVE_POINTS, typedArrayIndexFormats, PRIMITIVE_LINES } from '../platform/graphics/constants.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID } from './constants.js';

let id = 0;

// Helper class used to store vertex / index data streams and related properties, when mesh is programmatically modified
class GeometryData {
  constructor() {
    this.initDefaults();
  }
  initDefaults() {
    // by default, existing mesh is updated but not recreated, until .clear function is called
    this.recreate = false;

    // usage for buffers
    this.verticesUsage = BUFFER_STATIC;
    this.indicesUsage = BUFFER_STATIC;

    // vertex and index buffer allocated size (maximum number of vertices / indices that can be stored in those without the need to reallocate them)
    this.maxVertices = 0;
    this.maxIndices = 0;

    // current number of vertices and indices in use
    this.vertexCount = 0;
    this.indexCount = 0;

    // dirty flags representing what needs be updated
    this.vertexStreamsUpdated = false;
    this.indexStreamUpdated = false;

    // dictionary of vertex streams that need to be updated, looked up by semantic
    this.vertexStreamDictionary = {};

    // index stream data that needs to be updated
    this.indices = null;
  }

  // function called when vertex stream is requested to be updated, and validates / updates currently used vertex count
  _changeVertexCount(count, semantic) {
    // update vertex count and validate it with existing streams
    if (!this.vertexCount) {
      this.vertexCount = count;
    } else {
      Debug.assert(this.vertexCount === count, `Vertex stream ${semantic} has ${count} vertices, which does not match already set streams with ${this.vertexCount} vertices.`);
    }
  }

  // default counts for vertex components
}

// class storing information about single vertex data stream
GeometryData.DEFAULT_COMPONENTS_POSITION = 3;
GeometryData.DEFAULT_COMPONENTS_NORMAL = 3;
GeometryData.DEFAULT_COMPONENTS_UV = 2;
GeometryData.DEFAULT_COMPONENTS_COLORS = 4;
class GeometryVertexStream {
  constructor(data, componentCount, dataType, dataTypeNormalize) {
    this.data = data; // array of data
    this.componentCount = componentCount; // number of components
    this.dataType = dataType; // format of elements (pc.TYPE_FLOAT32 ..)
    this.dataTypeNormalize = dataTypeNormalize; // normalize element (divide by 255)
  }
}

/**
 * A graphical primitive. The mesh is defined by a {@link VertexBuffer} and an optional
 * {@link IndexBuffer}. It also contains a primitive definition which controls the type of the
 * primitive and the portion of the vertex or index buffer to use.
 *
 * ## Mesh APIs
 * There are two ways a mesh can be generated or updated.
 *
 * ### Simple Mesh API
 * {@link Mesh} class provides interfaces such as {@link Mesh#setPositions} and {@link Mesh#setUvs}
 * that provide a simple way to provide vertex and index data for the Mesh, and hiding the
 * complexity of creating the {@link VertexFormat}. This is the recommended interface to use.
 *
 * A simple example which creates a Mesh with 3 vertices, containing position coordinates only, to
 * form a single triangle.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = [
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0  // pos 2
 * ];
 * mesh.setPositions(positions);
 * mesh.update();
 * ```
 *
 * An example which creates a Mesh with 4 vertices, containing position and uv coordinates in
 * channel 0, and an index buffer to form two triangles. Float32Array is used for positions and uvs.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = new Float32Array([
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0, // pos 2
 *     0, 1, 0  // pos 3
 * ]);
 * const uvs = new Float32Array([
 *     0, 0, // uv 0
 *     1, 0, // uv 1
 *     1, 1, // uv 2
 *     0, 1  // uv 3
 * ]);
 * const indices = [
 *     0, 1, 2, // triangle 0
 *     0, 2, 3  // triangle 1
 * ];
 * mesh.setPositions(positions);
 * mesh.setUvs(0, uvs);
 * mesh.setIndices(indices);
 * mesh.update();
 * ```
 *
 * This example demonstrates that vertex attributes such as position and normals, and also indices
 * can be provided using Arrays ([]) and also Typed Arrays (Float32Array and similar). Note that
 * typed arrays have higher performance, and are generally recommended for per-frame operations or
 * larger meshes, but their construction using new operator is costly operation. If you only need
 * to operate on a small number of vertices or indices, consider using Arrays to avoid the overhead
 * associated with allocating Typed Arrays.
 *
 * Follow these links for more complex examples showing the functionality.
 *
 * - {@link https://playcanvas.github.io/#graphics/mesh-decals}
 * - {@link https://playcanvas.github.io/#graphics/mesh-deformation}
 * - {@link https://playcanvas.github.io/#graphics/mesh-generation}
 * - {@link https://playcanvas.github.io/#graphics/point-cloud-simulation}
 *
 * ### Update Vertex and Index buffers
 * This allows greater flexibility, but is more complex to use. It allows more advanced setups, for
 * example sharing a Vertex or Index Buffer between multiple meshes. See {@link VertexBuffer},
 * {@link IndexBuffer} and {@link VertexFormat} for details.
 *
 * @category Graphics
 */
class Mesh extends RefCountedObject {
  /**
   * Create a new Mesh instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device used to manage this mesh.
   */
  constructor(graphicsDevice) {
    super();
    /**
     * Internal version of aabb, incremented when local aabb changes.
     *
     * @ignore
     */
    this._aabbVer = 0;
    /**
     * aabb representing object space bounds of the mesh.
     *
     * @type {BoundingBox}
     */
    this._aabb = new BoundingBox();
    this.id = id++;
    Debug.assert(graphicsDevice, "Mesh constructor takes a GraphicsDevice as a parameter, and it was not provided.");
    this.device = graphicsDevice;

    /**
     * The vertex buffer holding the vertex data of the mesh.
     *
     * @type {VertexBuffer}
     */
    this.vertexBuffer = null;

    /**
     * An array of index buffers. For unindexed meshes, this array can be empty. The first
     * index buffer in the array is used by {@link MeshInstance}s with a renderStyle property
     * set to {@link RENDERSTYLE_SOLID}. The second index buffer in the array is used if
     * renderStyle is set to {@link RENDERSTYLE_WIREFRAME}.
     *
     * @type {IndexBuffer[]}
     */
    this.indexBuffer = [null];

    /**
     * Array of primitive objects defining how vertex (and index) data in the mesh should be
     * interpreted by the graphics device.
     *
     * - `type` is the type of primitive to render. Can be:
     *
     *   - {@link PRIMITIVE_POINTS}
     *   - {@link PRIMITIVE_LINES}
     *   - {@link PRIMITIVE_LINELOOP}
     *   - {@link PRIMITIVE_LINESTRIP}
     *   - {@link PRIMITIVE_TRIANGLES}
     *   - {@link PRIMITIVE_TRISTRIP}
     *   - {@link PRIMITIVE_TRIFAN}
     *
     * - `base` is the offset of the first index or vertex to dispatch in the draw call.
     * - `count` is the number of indices or vertices to dispatch in the draw call.
     * - `indexed` specifies whether to interpret the primitive as indexed, thereby using the
     * currently set index buffer.
     *
     * @type {Array.<{type: number, base: number, count: number, indexed: boolean|undefined}>}
     */
    this.primitive = [{
      type: 0,
      base: 0,
      count: 0
    }];

    /**
     * The skin data (if any) that drives skinned mesh animations for this mesh.
     *
     * @type {import('./skin.js').Skin|null}
     */
    this.skin = null;
    this._morph = null;
    this._geometryData = null;

    // Array of object space AABBs of vertices affected by each bone
    this.boneAabb = null;
  }

  /**
   * The morph data (if any) that drives morph target animations for this mesh.
   *
   * @type {import('./morph.js').Morph|null}
   */
  set morph(morph) {
    if (morph !== this._morph) {
      if (this._morph) {
        this._morph.decRefCount();
      }
      this._morph = morph;
      if (morph) {
        morph.incRefCount();
      }
    }
  }
  get morph() {
    return this._morph;
  }

  /**
   * The axis-aligned bounding box for the object space vertices of this mesh.
   *
   * @type {BoundingBox}
   */
  set aabb(aabb) {
    this._aabb = aabb;
    this._aabbVer++;
  }
  get aabb() {
    return this._aabb;
  }

  /**
   * Destroys {@link VertexBuffer} and {@link IndexBuffer} associate with the mesh. This is
   * normally called by {@link Model#destroy} and does not need to be called manually.
   */
  destroy() {
    const morph = this.morph;
    if (morph) {
      // this decreases ref count on the morph
      this.morph = null;

      // destroy morph
      if (morph.refCount < 1) {
        morph.destroy();
      }
    }
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    for (let j = 0; j < this.indexBuffer.length; j++) {
      this._destroyIndexBuffer(j);
    }
    this.indexBuffer.length = 0;
    this._geometryData = null;
  }
  _destroyIndexBuffer(index) {
    if (this.indexBuffer[index]) {
      this.indexBuffer[index].destroy();
      this.indexBuffer[index] = null;
    }
  }

  // initializes local bounding boxes for each bone based on vertices affected by the bone
  // if morph targets are provided, it also adjusts local bone bounding boxes by maximum morph displacement
  _initBoneAabbs(morphTargets) {
    this.boneAabb = [];
    this.boneUsed = [];
    let x, y, z;
    let bMax, bMin;
    const boneMin = [];
    const boneMax = [];
    const boneUsed = this.boneUsed;
    const numBones = this.skin.boneNames.length;
    let maxMorphX, maxMorphY, maxMorphZ;

    // start with empty bone bounds
    for (let i = 0; i < numBones; i++) {
      boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    }

    // access to mesh from vertex buffer
    const iterator = new VertexIterator(this.vertexBuffer);
    const posElement = iterator.element[SEMANTIC_POSITION];
    const weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
    const indicesElement = iterator.element[SEMANTIC_BLENDINDICES];

    // Find bone AABBs of attached vertices
    const numVerts = this.vertexBuffer.numVertices;
    for (let j = 0; j < numVerts; j++) {
      for (let k = 0; k < 4; k++) {
        const boneWeight = weightsElement.array[weightsElement.index + k];
        if (boneWeight > 0) {
          const boneIndex = indicesElement.array[indicesElement.index + k];
          boneUsed[boneIndex] = true;
          x = posElement.array[posElement.index];
          y = posElement.array[posElement.index + 1];
          z = posElement.array[posElement.index + 2];

          // adjust bounds of a bone by the vertex
          bMax = boneMax[boneIndex];
          bMin = boneMin[boneIndex];
          if (bMin.x > x) bMin.x = x;
          if (bMin.y > y) bMin.y = y;
          if (bMin.z > z) bMin.z = z;
          if (bMax.x < x) bMax.x = x;
          if (bMax.y < y) bMax.y = y;
          if (bMax.z < z) bMax.z = z;
          if (morphTargets) {
            // find maximum displacement of the vertex by all targets
            let minMorphX = maxMorphX = x;
            let minMorphY = maxMorphY = y;
            let minMorphZ = maxMorphZ = z;

            // morph this vertex by all morph targets
            for (let l = 0; l < morphTargets.length; l++) {
              const target = morphTargets[l];
              const dx = target.deltaPositions[j * 3];
              const dy = target.deltaPositions[j * 3 + 1];
              const dz = target.deltaPositions[j * 3 + 2];
              if (dx < 0) {
                minMorphX += dx;
              } else {
                maxMorphX += dx;
              }
              if (dy < 0) {
                minMorphY += dy;
              } else {
                maxMorphY += dy;
              }
              if (dz < 0) {
                minMorphZ += dz;
              } else {
                maxMorphZ += dz;
              }
            }
            if (bMin.x > minMorphX) bMin.x = minMorphX;
            if (bMin.y > minMorphY) bMin.y = minMorphY;
            if (bMin.z > minMorphZ) bMin.z = minMorphZ;
            if (bMax.x < maxMorphX) bMax.x = maxMorphX;
            if (bMax.y < maxMorphY) bMax.y = maxMorphY;
            if (bMax.z < maxMorphZ) bMax.z = maxMorphZ;
          }
        }
      }
      iterator.next();
    }

    // account for normalized positional data
    const positionElement = this.vertexBuffer.getFormat().elements.find(e => e.name === SEMANTIC_POSITION);
    if (positionElement && positionElement.normalize) {
      const func = (() => {
        switch (positionElement.dataType) {
          case TYPE_INT8:
            return x => Math.max(x / 127.0, -1.0);
          case TYPE_UINT8:
            return x => x / 255.0;
          case TYPE_INT16:
            return x => Math.max(x / 32767.0, -1.0);
          case TYPE_UINT16:
            return x => x / 65535.0;
          default:
            return x => x;
        }
      })();
      for (let i = 0; i < numBones; i++) {
        if (boneUsed[i]) {
          const min = boneMin[i];
          const max = boneMax[i];
          min.set(func(min.x), func(min.y), func(min.z));
          max.set(func(max.x), func(max.y), func(max.z));
        }
      }
    }

    // store bone bounding boxes
    for (let i = 0; i < numBones; i++) {
      const aabb = new BoundingBox();
      aabb.setMinMax(boneMin[i], boneMax[i]);
      this.boneAabb.push(aabb);
    }
  }

  // when mesh API to modify vertex / index data are used, this allocates structure to store the data
  _initGeometryData() {
    if (!this._geometryData) {
      this._geometryData = new GeometryData();

      // if vertex buffer exists already, store the sizes
      if (this.vertexBuffer) {
        this._geometryData.vertexCount = this.vertexBuffer.numVertices;
        this._geometryData.maxVertices = this.vertexBuffer.numVertices;
      }

      // if index buffer exists already, store the sizes
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        this._geometryData.indexCount = this.indexBuffer[0].numIndices;
        this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
      }
    }
  }

  /**
   * Clears the mesh of existing vertices and indices and resets the {@link VertexFormat}
   * associated with the mesh. This call is typically followed by calls to methods such as
   * {@link Mesh#setPositions}, {@link Mesh#setVertexStream} or {@link Mesh#setIndices} and
   * finally {@link Mesh#update} to rebuild the mesh, allowing different {@link VertexFormat}.
   *
   * @param {boolean} [verticesDynamic] - Indicates the {@link VertexBuffer} should be created
   * with {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
   * @param {boolean} [indicesDynamic] - Indicates the {@link IndexBuffer} should be created with
   * {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
   * @param {number} [maxVertices] - A {@link VertexBuffer} will be allocated with at least
   * maxVertices, allowing additional vertices to be added to it without the allocation. If no
   * value is provided, a size to fit the provided vertices will be allocated.
   * @param {number} [maxIndices] - An {@link IndexBuffer} will be allocated with at least
   * maxIndices, allowing additional indices to be added to it without the allocation. If no
   * value is provided, a size to fit the provided indices will be allocated.
   */
  clear(verticesDynamic, indicesDynamic, maxVertices = 0, maxIndices = 0) {
    this._initGeometryData();
    this._geometryData.initDefaults();
    this._geometryData.recreate = true;
    this._geometryData.maxVertices = maxVertices;
    this._geometryData.maxIndices = maxIndices;
    this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
    this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
  }

  /**
   * Sets the vertex data for any supported semantic.
   *
   * @param {string} semantic - The meaning of the vertex element. For supported semantics, see
   * SEMANTIC_* in {@link VertexFormat}.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - Vertex
   * data for the specified semantic.
   * @param {number} componentCount - The number of values that form a single Vertex element. For
   * example when setting a 3D position represented by 3 numbers per vertex, number 3 should be
   * specified.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   * @param {number} [dataType] - The format of data when stored in the {@link VertexBuffer}, see
   * TYPE_* in {@link VertexFormat}. When not specified, {@link TYPE_FLOAT32} is used.
   * @param {boolean} [dataTypeNormalize] - If true, vertex attribute data will be mapped from a
   * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
   * unchanged. If this property is unspecified, false is assumed.
   */
  setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false) {
    this._initGeometryData();
    const vertexCount = numVertices || data.length / componentCount;
    this._geometryData._changeVertexCount(vertexCount, semantic);
    this._geometryData.vertexStreamsUpdated = true;
    this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(data, componentCount, dataType, dataTypeNormalize);
  }

  /**
   * Gets the vertex data corresponding to a semantic.
   *
   * @param {string} semantic - The semantic of the vertex element to get. For supported
   * semantics, see SEMANTIC_* in {@link VertexFormat}.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getVertexStream(semantic, data) {
    let count = 0;
    let done = false;

    // see if we have un-applied stream
    if (this._geometryData) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      if (stream) {
        done = true;
        count = this._geometryData.vertexCount;
        if (ArrayBuffer.isView(data)) {
          // destination data is typed array
          data.set(stream.data);
        } else {
          // destination data is array
          data.length = 0;
          data.push(stream.data);
        }
      }
    }
    if (!done) {
      // get stream from VertexBuffer
      if (this.vertexBuffer) {
        // note: there is no need to .end the iterator, as we are only reading data from it
        const iterator = new VertexIterator(this.vertexBuffer);
        count = iterator.readData(semantic, data);
      }
    }
    return count;
  }

  /**
   * Sets the vertex positions array. Vertices are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - Vertex
   * data containing positions.
   * @param {number} [componentCount] - The number of values that form a single position element.
   * Defaults to 3 if not specified, corresponding to x, y and z coordinates.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
    this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex normals array. Normals are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - Vertex
   * data containing normals.
   * @param {number} [componentCount] - The number of values that form a single normal element.
   * Defaults to 3 if not specified, corresponding to x, y and z direction.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
    this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex uv array. Uvs are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number} channel - The uv channel in [0..7] range.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - Vertex
   * data containing uv-coordinates.
   * @param {number} [componentCount] - The number of values that form a single uv element.
   * Defaults to 2 if not specified, corresponding to u and v coordinates.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
    this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex color array. Colors are stored using {@link TYPE_FLOAT32} format, which is
   * useful for HDR colors.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex
   * data containing colors.
   * @param {number} [componentCount] - The number of values that form a single color element.
   * Defaults to 4 if not specified, corresponding to r, g, b and a.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex color array. Colors are stored using {@link TYPE_UINT8} format, which is
   * useful for LDR colors. Values in the array are expected in [0..255] range, and are mapped to
   * [0..1] range in the shader.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex
   * data containing colors. The array is expected to contain 4 components per vertex,
   * corresponding to r, g, b and a.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setColors32(colors, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
  }

  /**
   * Sets the index array. Indices are stored using 16-bit format by default, unless more than
   * 65535 vertices are specified, in which case 32-bit format is used.
   *
   * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - The array of indices that
   * define primitives (lines, triangles, etc.).
   * @param {number} [numIndices] - The number of indices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setIndices(indices, numIndices) {
    this._initGeometryData();
    this._geometryData.indexStreamUpdated = true;
    this._geometryData.indices = indices;
    this._geometryData.indexCount = numIndices || indices.length;
  }

  /**
   * Gets the vertex positions data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getPositions(positions) {
    return this.getVertexStream(SEMANTIC_POSITION, positions);
  }

  /**
   * Gets the vertex normals data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getNormals(normals) {
    return this.getVertexStream(SEMANTIC_NORMAL, normals);
  }

  /**
   * Gets the vertex uv data.
   *
   * @param {number} channel - The uv channel in [0..7] range.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getUvs(channel, uvs) {
    return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
  }

  /**
   * Gets the vertex color data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getColors(colors) {
    return this.getVertexStream(SEMANTIC_COLOR, colors);
  }

  /**
   * Gets the index data.
   *
   * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - An array to populate with the
   * index data. When a typed array is supplied, enough space needs to be reserved, otherwise
   * only partial data is copied.
   * @returns {number} Returns the number of indices populated.
   */
  getIndices(indices) {
    let count = 0;

    // see if we have un-applied indices
    if (this._geometryData && this._geometryData.indices) {
      const streamIndices = this._geometryData.indices;
      count = this._geometryData.indexCount;
      if (ArrayBuffer.isView(indices)) {
        // destination data is typed array
        indices.set(streamIndices);
      } else {
        // destination data is array
        indices.length = 0;
        for (let i = 0, il = streamIndices.length; i < il; i++) {
          indices.push(streamIndices[i]);
        }
      }
    } else {
      // get data from IndexBuffer
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        const indexBuffer = this.indexBuffer[0];
        count = indexBuffer.readData(indices);
      }
    }
    return count;
  }

  /**
   * Applies any changes to vertex stream and indices to mesh. This allocates or reallocates
   * {@link vertexBuffer} or {@link IndexBuffer} to fit all provided vertices and indices, and
   * fills them with data.
   *
   * @param {number} [primitiveType] - The type of primitive to render.  Can be:
   *
   * - {@link PRIMITIVE_POINTS}
   * - {@link PRIMITIVE_LINES}
   * - {@link PRIMITIVE_LINELOOP}
   * - {@link PRIMITIVE_LINESTRIP}
   * - {@link PRIMITIVE_TRIANGLES}
   * - {@link PRIMITIVE_TRISTRIP}
   * - {@link PRIMITIVE_TRIFAN}
   *
   * Defaults to {@link PRIMITIVE_TRIANGLES} if unspecified.
   * @param {boolean} [updateBoundingBox] - True to update bounding box. Bounding box is updated
   * only if positions were set since last time update was called, and componentCount for
   * position was 3, otherwise bounding box is not updated. See {@link Mesh#setPositions}.
   * Defaults to true if unspecified. Set this to false to avoid update of the bounding box and
   * use aabb property to set it instead.
   */
  update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {
    if (this._geometryData) {
      // update bounding box if needed
      if (updateBoundingBox) {
        // find vec3 position stream
        const stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
        if (stream) {
          if (stream.componentCount === 3) {
            this._aabb.compute(stream.data, this._geometryData.vertexCount);
            this._aabbVer++;
          }
        }
      }

      // destroy vertex buffer if recreate was requested or if vertices don't fit
      let destroyVB = this._geometryData.recreate;
      if (this._geometryData.vertexCount > this._geometryData.maxVertices) {
        destroyVB = true;
        this._geometryData.maxVertices = this._geometryData.vertexCount;
      }
      if (destroyVB) {
        if (this.vertexBuffer) {
          this.vertexBuffer.destroy();
          this.vertexBuffer = null;
        }
      }

      // destroy index buffer if recreate was requested or if indices don't fit
      let destroyIB = this._geometryData.recreate;
      if (this._geometryData.indexCount > this._geometryData.maxIndices) {
        destroyIB = true;
        this._geometryData.maxIndices = this._geometryData.indexCount;
      }
      if (destroyIB) {
        if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
          this.indexBuffer[0].destroy();
          this.indexBuffer[0] = null;
        }
      }

      // update vertices if needed
      if (this._geometryData.vertexStreamsUpdated) {
        this._updateVertexBuffer();
      }

      // update indices if needed
      if (this._geometryData.indexStreamUpdated) {
        this._updateIndexBuffer();
      }

      // set up primitive parameters
      this.primitive[0].type = primitiveType;
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        // indexed
        if (this._geometryData.indexStreamUpdated) {
          this.primitive[0].count = this._geometryData.indexCount;
          this.primitive[0].indexed = true;
        }
      } else {
        // non-indexed
        if (this._geometryData.vertexStreamsUpdated) {
          this.primitive[0].count = this._geometryData.vertexCount;
          this.primitive[0].indexed = false;
        }
      }

      // counts can be changed on next frame, so set them to 0
      this._geometryData.vertexCount = 0;
      this._geometryData.indexCount = 0;
      this._geometryData.vertexStreamsUpdated = false;
      this._geometryData.indexStreamUpdated = false;
      this._geometryData.recreate = false;

      // update other render states
      this.updateRenderStates();
    }
  }

  // builds vertex format based on attached vertex streams
  _buildVertexFormat(vertexCount) {
    const vertexDesc = [];
    for (const semantic in this._geometryData.vertexStreamDictionary) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      vertexDesc.push({
        semantic: semantic,
        components: stream.componentCount,
        type: stream.dataType,
        normalize: stream.dataTypeNormalize
      });
    }
    return new VertexFormat(this.device, vertexDesc, vertexCount);
  }

  // copy attached data into vertex buffer
  _updateVertexBuffer() {
    // if we don't have vertex buffer, create new one, otherwise update existing one
    if (!this.vertexBuffer) {
      const allocateVertexCount = this._geometryData.maxVertices;
      const format = this._buildVertexFormat(allocateVertexCount);
      this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, this._geometryData.verticesUsage);
    }

    // lock vertex buffer and create typed access arrays for individual elements
    const iterator = new VertexIterator(this.vertexBuffer);

    // copy all stream data into vertex buffer
    const numVertices = this._geometryData.vertexCount;
    for (const semantic in this._geometryData.vertexStreamDictionary) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      iterator.writeData(semantic, stream.data, numVertices);

      // remove stream
      delete this._geometryData.vertexStreamDictionary[semantic];
    }
    iterator.end();
  }

  // copy attached data into index buffer
  _updateIndexBuffer() {
    // if we don't have index buffer, create new one, otherwise update existing one
    if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
      const createFormat = this._geometryData.maxVertices > 0xffff ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
      this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage);
    }
    const srcIndices = this._geometryData.indices;
    if (srcIndices) {
      const indexBuffer = this.indexBuffer[0];
      indexBuffer.writeData(srcIndices, this._geometryData.indexCount);

      // remove data
      this._geometryData.indices = null;
    }
  }

  // prepares the mesh to be rendered with specific render style
  prepareRenderState(renderStyle) {
    if (renderStyle === RENDERSTYLE_WIREFRAME) {
      this.generateWireframe();
    } else if (renderStyle === RENDERSTYLE_POINTS) {
      this.primitive[RENDERSTYLE_POINTS] = {
        type: PRIMITIVE_POINTS,
        base: 0,
        count: this.vertexBuffer ? this.vertexBuffer.numVertices : 0,
        indexed: false
      };
    }
  }

  // updates existing render states with changes to solid render state
  updateRenderStates() {
    if (this.primitive[RENDERSTYLE_POINTS]) {
      this.prepareRenderState(RENDERSTYLE_POINTS);
    }
    if (this.primitive[RENDERSTYLE_WIREFRAME]) {
      this.prepareRenderState(RENDERSTYLE_WIREFRAME);
    }
  }
  generateWireframe() {
    // release existing IB
    this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);
    const numVertices = this.vertexBuffer.numVertices;
    const lines = [];
    let format;
    if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
      const offsets = [[0, 1], [1, 2], [2, 0]];
      const base = this.primitive[RENDERSTYLE_SOLID].base;
      const count = this.primitive[RENDERSTYLE_SOLID].count;
      const indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
      const srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);
      const seen = new Set();
      for (let j = base; j < base + count; j += 3) {
        for (let k = 0; k < 3; k++) {
          const i1 = srcIndices[j + offsets[k][0]];
          const i2 = srcIndices[j + offsets[k][1]];
          const hash = i1 > i2 ? i2 * numVertices + i1 : i1 * numVertices + i2;
          if (!seen.has(hash)) {
            seen.add(hash);
            lines.push(i1, i2);
          }
        }
      }
      format = indexBuffer.format;
    } else {
      for (let i = 0; i < numVertices; i += 3) {
        lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
      }
      format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
    }
    const wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
    const dstIndices = new typedArrayIndexFormats[wireBuffer.format](wireBuffer.storage);
    dstIndices.set(lines);
    wireBuffer.unlock();
    this.primitive[RENDERSTYLE_WIREFRAME] = {
      type: PRIMITIVE_LINES,
      base: 0,
      count: lines.length,
      indexed: true
    };
    this.indexBuffer[RENDERSTYLE_WIREFRAME] = wireBuffer;
  }
}

export { Mesh };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL21lc2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFJlZkNvdW50ZWRPYmplY3QgfSBmcm9tICcuLi9jb3JlL3JlZi1jb3VudGVkLW9iamVjdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVEFUSUMsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUFJJTUlUSVZFX0xJTkVTLCBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfUE9JTlRTLFxuICAgIFNFTUFOVElDX0JMRU5ESU5ESUNFUywgU0VNQU5USUNfQkxFTkRXRUlHSFQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19URVhDT09SRCxcbiAgICBUWVBFX0ZMT0FUMzIsIFRZUEVfVUlOVDgsIFRZUEVfSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsXG4gICAgdHlwZWRBcnJheUluZGV4Rm9ybWF0c1xufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSW5kZXhCdWZmZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFZlcnRleEl0ZXJhdG9yIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzJztcblxuaW1wb3J0IHsgUkVOREVSU1RZTEVfU09MSUQsIFJFTkRFUlNUWUxFX1dJUkVGUkFNRSwgUkVOREVSU1RZTEVfUE9JTlRTIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5sZXQgaWQgPSAwO1xuXG4vLyBIZWxwZXIgY2xhc3MgdXNlZCB0byBzdG9yZSB2ZXJ0ZXggLyBpbmRleCBkYXRhIHN0cmVhbXMgYW5kIHJlbGF0ZWQgcHJvcGVydGllcywgd2hlbiBtZXNoIGlzIHByb2dyYW1tYXRpY2FsbHkgbW9kaWZpZWRcbmNsYXNzIEdlb21ldHJ5RGF0YSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuaW5pdERlZmF1bHRzKCk7XG4gICAgfVxuXG4gICAgaW5pdERlZmF1bHRzKCkge1xuXG4gICAgICAgIC8vIGJ5IGRlZmF1bHQsIGV4aXN0aW5nIG1lc2ggaXMgdXBkYXRlZCBidXQgbm90IHJlY3JlYXRlZCwgdW50aWwgLmNsZWFyIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICAgICAgICB0aGlzLnJlY3JlYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdXNhZ2UgZm9yIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy52ZXJ0aWNlc1VzYWdlID0gQlVGRkVSX1NUQVRJQztcbiAgICAgICAgdGhpcy5pbmRpY2VzVXNhZ2UgPSBCVUZGRVJfU1RBVElDO1xuXG4gICAgICAgIC8vIHZlcnRleCBhbmQgaW5kZXggYnVmZmVyIGFsbG9jYXRlZCBzaXplIChtYXhpbXVtIG51bWJlciBvZiB2ZXJ0aWNlcyAvIGluZGljZXMgdGhhdCBjYW4gYmUgc3RvcmVkIGluIHRob3NlIHdpdGhvdXQgdGhlIG5lZWQgdG8gcmVhbGxvY2F0ZSB0aGVtKVxuICAgICAgICB0aGlzLm1heFZlcnRpY2VzID0gMDtcbiAgICAgICAgdGhpcy5tYXhJbmRpY2VzID0gMDtcblxuICAgICAgICAvLyBjdXJyZW50IG51bWJlciBvZiB2ZXJ0aWNlcyBhbmQgaW5kaWNlcyBpbiB1c2VcbiAgICAgICAgdGhpcy52ZXJ0ZXhDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuaW5kZXhDb3VudCA9IDA7XG5cbiAgICAgICAgLy8gZGlydHkgZmxhZ3MgcmVwcmVzZW50aW5nIHdoYXQgbmVlZHMgYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLnZlcnRleFN0cmVhbXNVcGRhdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaW5kZXhTdHJlYW1VcGRhdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggc3RyZWFtcyB0aGF0IG5lZWQgdG8gYmUgdXBkYXRlZCwgbG9va2VkIHVwIGJ5IHNlbWFudGljXG4gICAgICAgIHRoaXMudmVydGV4U3RyZWFtRGljdGlvbmFyeSA9IHt9O1xuXG4gICAgICAgIC8vIGluZGV4IHN0cmVhbSBkYXRhIHRoYXQgbmVlZHMgdG8gYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLmluZGljZXMgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHZlcnRleCBzdHJlYW0gaXMgcmVxdWVzdGVkIHRvIGJlIHVwZGF0ZWQsIGFuZCB2YWxpZGF0ZXMgLyB1cGRhdGVzIGN1cnJlbnRseSB1c2VkIHZlcnRleCBjb3VudFxuICAgIF9jaGFuZ2VWZXJ0ZXhDb3VudChjb3VudCwgc2VtYW50aWMpIHtcblxuICAgICAgICAvLyB1cGRhdGUgdmVydGV4IGNvdW50IGFuZCB2YWxpZGF0ZSBpdCB3aXRoIGV4aXN0aW5nIHN0cmVhbXNcbiAgICAgICAgaWYgKCF0aGlzLnZlcnRleENvdW50KSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleENvdW50ID0gY291bnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy52ZXJ0ZXhDb3VudCA9PT0gY291bnQsIGBWZXJ0ZXggc3RyZWFtICR7c2VtYW50aWN9IGhhcyAke2NvdW50fSB2ZXJ0aWNlcywgd2hpY2ggZG9lcyBub3QgbWF0Y2ggYWxyZWFkeSBzZXQgc3RyZWFtcyB3aXRoICR7dGhpcy52ZXJ0ZXhDb3VudH0gdmVydGljZXMuYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkZWZhdWx0IGNvdW50cyBmb3IgdmVydGV4IGNvbXBvbmVudHNcbiAgICBzdGF0aWMgREVGQVVMVF9DT01QT05FTlRTX1BPU0lUSU9OID0gMztcblxuICAgIHN0YXRpYyBERUZBVUxUX0NPTVBPTkVOVFNfTk9STUFMID0gMztcblxuICAgIHN0YXRpYyBERUZBVUxUX0NPTVBPTkVOVFNfVVYgPSAyO1xuXG4gICAgc3RhdGljIERFRkFVTFRfQ09NUE9ORU5UU19DT0xPUlMgPSA0O1xufVxuXG4vLyBjbGFzcyBzdG9yaW5nIGluZm9ybWF0aW9uIGFib3V0IHNpbmdsZSB2ZXJ0ZXggZGF0YSBzdHJlYW1cbmNsYXNzIEdlb21ldHJ5VmVydGV4U3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcihkYXRhLCBjb21wb25lbnRDb3VudCwgZGF0YVR5cGUsIGRhdGFUeXBlTm9ybWFsaXplKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7ICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgb2YgZGF0YVxuICAgICAgICB0aGlzLmNvbXBvbmVudENvdW50ID0gY29tcG9uZW50Q291bnQ7ICAgICAgIC8vIG51bWJlciBvZiBjb21wb25lbnRzXG4gICAgICAgIHRoaXMuZGF0YVR5cGUgPSBkYXRhVHlwZTsgICAgICAgICAgICAgICAgICAgLy8gZm9ybWF0IG9mIGVsZW1lbnRzIChwYy5UWVBFX0ZMT0FUMzIgLi4pXG4gICAgICAgIHRoaXMuZGF0YVR5cGVOb3JtYWxpemUgPSBkYXRhVHlwZU5vcm1hbGl6ZTsgLy8gbm9ybWFsaXplIGVsZW1lbnQgKGRpdmlkZSBieSAyNTUpXG4gICAgfVxufVxuXG4vKipcbiAqIEEgZ3JhcGhpY2FsIHByaW1pdGl2ZS4gVGhlIG1lc2ggaXMgZGVmaW5lZCBieSBhIHtAbGluayBWZXJ0ZXhCdWZmZXJ9IGFuZCBhbiBvcHRpb25hbFxuICoge0BsaW5rIEluZGV4QnVmZmVyfS4gSXQgYWxzbyBjb250YWlucyBhIHByaW1pdGl2ZSBkZWZpbml0aW9uIHdoaWNoIGNvbnRyb2xzIHRoZSB0eXBlIG9mIHRoZVxuICogcHJpbWl0aXZlIGFuZCB0aGUgcG9ydGlvbiBvZiB0aGUgdmVydGV4IG9yIGluZGV4IGJ1ZmZlciB0byB1c2UuXG4gKlxuICogIyMgTWVzaCBBUElzXG4gKiBUaGVyZSBhcmUgdHdvIHdheXMgYSBtZXNoIGNhbiBiZSBnZW5lcmF0ZWQgb3IgdXBkYXRlZC5cbiAqXG4gKiAjIyMgU2ltcGxlIE1lc2ggQVBJXG4gKiB7QGxpbmsgTWVzaH0gY2xhc3MgcHJvdmlkZXMgaW50ZXJmYWNlcyBzdWNoIGFzIHtAbGluayBNZXNoI3NldFBvc2l0aW9uc30gYW5kIHtAbGluayBNZXNoI3NldFV2c31cbiAqIHRoYXQgcHJvdmlkZSBhIHNpbXBsZSB3YXkgdG8gcHJvdmlkZSB2ZXJ0ZXggYW5kIGluZGV4IGRhdGEgZm9yIHRoZSBNZXNoLCBhbmQgaGlkaW5nIHRoZVxuICogY29tcGxleGl0eSBvZiBjcmVhdGluZyB0aGUge0BsaW5rIFZlcnRleEZvcm1hdH0uIFRoaXMgaXMgdGhlIHJlY29tbWVuZGVkIGludGVyZmFjZSB0byB1c2UuXG4gKlxuICogQSBzaW1wbGUgZXhhbXBsZSB3aGljaCBjcmVhdGVzIGEgTWVzaCB3aXRoIDMgdmVydGljZXMsIGNvbnRhaW5pbmcgcG9zaXRpb24gY29vcmRpbmF0ZXMgb25seSwgdG9cbiAqIGZvcm0gYSBzaW5nbGUgdHJpYW5nbGUuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgbWVzaCA9IG5ldyBwYy5NZXNoKGRldmljZSk7XG4gKiBjb25zdCBwb3NpdGlvbnMgPSBbXG4gKiAgICAgMCwgMCwgMCwgLy8gcG9zIDBcbiAqICAgICAxLCAwLCAwLCAvLyBwb3MgMVxuICogICAgIDEsIDEsIDAgIC8vIHBvcyAyXG4gKiBdO1xuICogbWVzaC5zZXRQb3NpdGlvbnMocG9zaXRpb25zKTtcbiAqIG1lc2gudXBkYXRlKCk7XG4gKiBgYGBcbiAqXG4gKiBBbiBleGFtcGxlIHdoaWNoIGNyZWF0ZXMgYSBNZXNoIHdpdGggNCB2ZXJ0aWNlcywgY29udGFpbmluZyBwb3NpdGlvbiBhbmQgdXYgY29vcmRpbmF0ZXMgaW5cbiAqIGNoYW5uZWwgMCwgYW5kIGFuIGluZGV4IGJ1ZmZlciB0byBmb3JtIHR3byB0cmlhbmdsZXMuIEZsb2F0MzJBcnJheSBpcyB1c2VkIGZvciBwb3NpdGlvbnMgYW5kIHV2cy5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBtZXNoID0gbmV3IHBjLk1lc2goZGV2aWNlKTtcbiAqIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuICogICAgIDAsIDAsIDAsIC8vIHBvcyAwXG4gKiAgICAgMSwgMCwgMCwgLy8gcG9zIDFcbiAqICAgICAxLCAxLCAwLCAvLyBwb3MgMlxuICogICAgIDAsIDEsIDAgIC8vIHBvcyAzXG4gKiBdKTtcbiAqIGNvbnN0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuICogICAgIDAsIDAsIC8vIHV2IDBcbiAqICAgICAxLCAwLCAvLyB1diAxXG4gKiAgICAgMSwgMSwgLy8gdXYgMlxuICogICAgIDAsIDEgIC8vIHV2IDNcbiAqIF0pO1xuICogY29uc3QgaW5kaWNlcyA9IFtcbiAqICAgICAwLCAxLCAyLCAvLyB0cmlhbmdsZSAwXG4gKiAgICAgMCwgMiwgMyAgLy8gdHJpYW5nbGUgMVxuICogXTtcbiAqIG1lc2guc2V0UG9zaXRpb25zKHBvc2l0aW9ucyk7XG4gKiBtZXNoLnNldFV2cygwLCB1dnMpO1xuICogbWVzaC5zZXRJbmRpY2VzKGluZGljZXMpO1xuICogbWVzaC51cGRhdGUoKTtcbiAqIGBgYFxuICpcbiAqIFRoaXMgZXhhbXBsZSBkZW1vbnN0cmF0ZXMgdGhhdCB2ZXJ0ZXggYXR0cmlidXRlcyBzdWNoIGFzIHBvc2l0aW9uIGFuZCBub3JtYWxzLCBhbmQgYWxzbyBpbmRpY2VzXG4gKiBjYW4gYmUgcHJvdmlkZWQgdXNpbmcgQXJyYXlzIChbXSkgYW5kIGFsc28gVHlwZWQgQXJyYXlzIChGbG9hdDMyQXJyYXkgYW5kIHNpbWlsYXIpLiBOb3RlIHRoYXRcbiAqIHR5cGVkIGFycmF5cyBoYXZlIGhpZ2hlciBwZXJmb3JtYW5jZSwgYW5kIGFyZSBnZW5lcmFsbHkgcmVjb21tZW5kZWQgZm9yIHBlci1mcmFtZSBvcGVyYXRpb25zIG9yXG4gKiBsYXJnZXIgbWVzaGVzLCBidXQgdGhlaXIgY29uc3RydWN0aW9uIHVzaW5nIG5ldyBvcGVyYXRvciBpcyBjb3N0bHkgb3BlcmF0aW9uLiBJZiB5b3Ugb25seSBuZWVkXG4gKiB0byBvcGVyYXRlIG9uIGEgc21hbGwgbnVtYmVyIG9mIHZlcnRpY2VzIG9yIGluZGljZXMsIGNvbnNpZGVyIHVzaW5nIEFycmF5cyB0byBhdm9pZCB0aGUgb3ZlcmhlYWRcbiAqIGFzc29jaWF0ZWQgd2l0aCBhbGxvY2F0aW5nIFR5cGVkIEFycmF5cy5cbiAqXG4gKiBGb2xsb3cgdGhlc2UgbGlua3MgZm9yIG1vcmUgY29tcGxleCBleGFtcGxlcyBzaG93aW5nIHRoZSBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIC0ge0BsaW5rIGh0dHBzOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL21lc2gtZGVjYWxzfVxuICogLSB7QGxpbmsgaHR0cHM6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jZ3JhcGhpY3MvbWVzaC1kZWZvcm1hdGlvbn1cbiAqIC0ge0BsaW5rIGh0dHBzOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL21lc2gtZ2VuZXJhdGlvbn1cbiAqIC0ge0BsaW5rIGh0dHBzOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL3BvaW50LWNsb3VkLXNpbXVsYXRpb259XG4gKlxuICogIyMjIFVwZGF0ZSBWZXJ0ZXggYW5kIEluZGV4IGJ1ZmZlcnNcbiAqIFRoaXMgYWxsb3dzIGdyZWF0ZXIgZmxleGliaWxpdHksIGJ1dCBpcyBtb3JlIGNvbXBsZXggdG8gdXNlLiBJdCBhbGxvd3MgbW9yZSBhZHZhbmNlZCBzZXR1cHMsIGZvclxuICogZXhhbXBsZSBzaGFyaW5nIGEgVmVydGV4IG9yIEluZGV4IEJ1ZmZlciBiZXR3ZWVuIG11bHRpcGxlIG1lc2hlcy4gU2VlIHtAbGluayBWZXJ0ZXhCdWZmZXJ9LFxuICoge0BsaW5rIEluZGV4QnVmZmVyfSBhbmQge0BsaW5rIFZlcnRleEZvcm1hdH0gZm9yIGRldGFpbHMuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIE1lc2ggZXh0ZW5kcyBSZWZDb3VudGVkT2JqZWN0IHtcbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCB2ZXJzaW9uIG9mIGFhYmIsIGluY3JlbWVudGVkIHdoZW4gbG9jYWwgYWFiYiBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9hYWJiVmVyID0gMDtcblxuICAgIC8qKlxuICAgICAqIGFhYmIgcmVwcmVzZW50aW5nIG9iamVjdCBzcGFjZSBib3VuZHMgb2YgdGhlIG1lc2guXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgX2FhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBNZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGlzIG1lc2guXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIERlYnVnLmFzc2VydChncmFwaGljc0RldmljZSwgXCJNZXNoIGNvbnN0cnVjdG9yIHRha2VzIGEgR3JhcGhpY3NEZXZpY2UgYXMgYSBwYXJhbWV0ZXIsIGFuZCBpdCB3YXMgbm90IHByb3ZpZGVkLlwiKTtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHZlcnRleCBidWZmZXIgaG9sZGluZyB0aGUgdmVydGV4IGRhdGEgb2YgdGhlIG1lc2guXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZXJ0ZXhCdWZmZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGFycmF5IG9mIGluZGV4IGJ1ZmZlcnMuIEZvciB1bmluZGV4ZWQgbWVzaGVzLCB0aGlzIGFycmF5IGNhbiBiZSBlbXB0eS4gVGhlIGZpcnN0XG4gICAgICAgICAqIGluZGV4IGJ1ZmZlciBpbiB0aGUgYXJyYXkgaXMgdXNlZCBieSB7QGxpbmsgTWVzaEluc3RhbmNlfXMgd2l0aCBhIHJlbmRlclN0eWxlIHByb3BlcnR5XG4gICAgICAgICAqIHNldCB0byB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9LiBUaGUgc2Vjb25kIGluZGV4IGJ1ZmZlciBpbiB0aGUgYXJyYXkgaXMgdXNlZCBpZlxuICAgICAgICAgKiByZW5kZXJTdHlsZSBpcyBzZXQgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1dJUkVGUkFNRX0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtJbmRleEJ1ZmZlcltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IFtudWxsXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgb2YgcHJpbWl0aXZlIG9iamVjdHMgZGVmaW5pbmcgaG93IHZlcnRleCAoYW5kIGluZGV4KSBkYXRhIGluIHRoZSBtZXNoIHNob3VsZCBiZVxuICAgICAgICAgKiBpbnRlcnByZXRlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGB0eXBlYCBpcyB0aGUgdHlwZSBvZiBwcmltaXRpdmUgdG8gcmVuZGVyLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAgICAgKiAgIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgICAgICpcbiAgICAgICAgICogLSBgYmFzZWAgaXMgdGhlIG9mZnNldCBvZiB0aGUgZmlyc3QgaW5kZXggb3IgdmVydGV4IHRvIGRpc3BhdGNoIGluIHRoZSBkcmF3IGNhbGwuXG4gICAgICAgICAqIC0gYGNvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGluZGljZXMgb3IgdmVydGljZXMgdG8gZGlzcGF0Y2ggaW4gdGhlIGRyYXcgY2FsbC5cbiAgICAgICAgICogLSBgaW5kZXhlZGAgc3BlY2lmaWVzIHdoZXRoZXIgdG8gaW50ZXJwcmV0IHRoZSBwcmltaXRpdmUgYXMgaW5kZXhlZCwgdGhlcmVieSB1c2luZyB0aGVcbiAgICAgICAgICogY3VycmVudGx5IHNldCBpbmRleCBidWZmZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBcnJheS48e3R5cGU6IG51bWJlciwgYmFzZTogbnVtYmVyLCBjb3VudDogbnVtYmVyLCBpbmRleGVkOiBib29sZWFufHVuZGVmaW5lZH0+fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wcmltaXRpdmUgPSBbe1xuICAgICAgICAgICAgdHlwZTogMCxcbiAgICAgICAgICAgIGJhc2U6IDAsXG4gICAgICAgICAgICBjb3VudDogMFxuICAgICAgICB9XTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNraW4gZGF0YSAoaWYgYW55KSB0aGF0IGRyaXZlcyBza2lubmVkIG1lc2ggYW5pbWF0aW9ucyBmb3IgdGhpcyBtZXNoLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NraW4uanMnKS5Ta2lufG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNraW4gPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX21vcnBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhID0gbnVsbDtcblxuICAgICAgICAvLyBBcnJheSBvZiBvYmplY3Qgc3BhY2UgQUFCQnMgb2YgdmVydGljZXMgYWZmZWN0ZWQgYnkgZWFjaCBib25lXG4gICAgICAgIHRoaXMuYm9uZUFhYmIgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBkYXRhIChpZiBhbnkpIHRoYXQgZHJpdmVzIG1vcnBoIHRhcmdldCBhbmltYXRpb25zIGZvciB0aGlzIG1lc2guXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLmpzJykuTW9ycGh8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGgobW9ycGgpIHtcblxuICAgICAgICBpZiAobW9ycGggIT09IHRoaXMuX21vcnBoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbW9ycGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tb3JwaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tb3JwaCA9IG1vcnBoO1xuXG4gICAgICAgICAgICBpZiAobW9ycGgpIHtcbiAgICAgICAgICAgICAgICBtb3JwaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vcnBoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZm9yIHRoZSBvYmplY3Qgc3BhY2UgdmVydGljZXMgb2YgdGhpcyBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgICAgIHRoaXMuX2FhYmJWZXIrKztcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMge0BsaW5rIFZlcnRleEJ1ZmZlcn0gYW5kIHtAbGluayBJbmRleEJ1ZmZlcn0gYXNzb2NpYXRlIHdpdGggdGhlIG1lc2guIFRoaXMgaXNcbiAgICAgKiBub3JtYWxseSBjYWxsZWQgYnkge0BsaW5rIE1vZGVsI2Rlc3Ryb3l9IGFuZCBkb2VzIG5vdCBuZWVkIHRvIGJlIGNhbGxlZCBtYW51YWxseS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIGNvbnN0IG1vcnBoID0gdGhpcy5tb3JwaDtcbiAgICAgICAgaWYgKG1vcnBoKSB7XG5cbiAgICAgICAgICAgIC8vIHRoaXMgZGVjcmVhc2VzIHJlZiBjb3VudCBvbiB0aGUgbW9ycGhcbiAgICAgICAgICAgIHRoaXMubW9ycGggPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1vcnBoXG4gICAgICAgICAgICBpZiAobW9ycGgucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbW9ycGguZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lJbmRleEJ1ZmZlcihqKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBfZGVzdHJveUluZGV4QnVmZmVyKGluZGV4KSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlcltpbmRleF0uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlcltpbmRleF0gPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gaW5pdGlhbGl6ZXMgbG9jYWwgYm91bmRpbmcgYm94ZXMgZm9yIGVhY2ggYm9uZSBiYXNlZCBvbiB2ZXJ0aWNlcyBhZmZlY3RlZCBieSB0aGUgYm9uZVxuICAgIC8vIGlmIG1vcnBoIHRhcmdldHMgYXJlIHByb3ZpZGVkLCBpdCBhbHNvIGFkanVzdHMgbG9jYWwgYm9uZSBib3VuZGluZyBib3hlcyBieSBtYXhpbXVtIG1vcnBoIGRpc3BsYWNlbWVudFxuICAgIF9pbml0Qm9uZUFhYmJzKG1vcnBoVGFyZ2V0cykge1xuXG4gICAgICAgIHRoaXMuYm9uZUFhYmIgPSBbXTtcbiAgICAgICAgdGhpcy5ib25lVXNlZCA9IFtdO1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgbGV0IGJNYXgsIGJNaW47XG4gICAgICAgIGNvbnN0IGJvbmVNaW4gPSBbXTtcbiAgICAgICAgY29uc3QgYm9uZU1heCA9IFtdO1xuICAgICAgICBjb25zdCBib25lVXNlZCA9IHRoaXMuYm9uZVVzZWQ7XG4gICAgICAgIGNvbnN0IG51bUJvbmVzID0gdGhpcy5za2luLmJvbmVOYW1lcy5sZW5ndGg7XG4gICAgICAgIGxldCBtYXhNb3JwaFgsIG1heE1vcnBoWSwgbWF4TW9ycGhaO1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggZW1wdHkgYm9uZSBib3VuZHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Cb25lczsgaSsrKSB7XG4gICAgICAgICAgICBib25lTWluW2ldID0gbmV3IFZlYzMoTnVtYmVyLk1BWF9WQUxVRSwgTnVtYmVyLk1BWF9WQUxVRSwgTnVtYmVyLk1BWF9WQUxVRSk7XG4gICAgICAgICAgICBib25lTWF4W2ldID0gbmV3IFZlYzMoLU51bWJlci5NQVhfVkFMVUUsIC1OdW1iZXIuTUFYX1ZBTFVFLCAtTnVtYmVyLk1BWF9WQUxVRSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhY2Nlc3MgdG8gbWVzaCBmcm9tIHZlcnRleCBidWZmZXJcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBuZXcgVmVydGV4SXRlcmF0b3IodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICBjb25zdCBwb3NFbGVtZW50ID0gaXRlcmF0b3IuZWxlbWVudFtTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgICAgIGNvbnN0IHdlaWdodHNFbGVtZW50ID0gaXRlcmF0b3IuZWxlbWVudFtTRU1BTlRJQ19CTEVORFdFSUdIVF07XG4gICAgICAgIGNvbnN0IGluZGljZXNFbGVtZW50ID0gaXRlcmF0b3IuZWxlbWVudFtTRU1BTlRJQ19CTEVORElORElDRVNdO1xuXG4gICAgICAgIC8vIEZpbmQgYm9uZSBBQUJCcyBvZiBhdHRhY2hlZCB2ZXJ0aWNlc1xuICAgICAgICBjb25zdCBudW1WZXJ0cyA9IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bVZlcnRzOyBqKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgNDsgaysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9uZVdlaWdodCA9IHdlaWdodHNFbGVtZW50LmFycmF5W3dlaWdodHNFbGVtZW50LmluZGV4ICsga107XG4gICAgICAgICAgICAgICAgaWYgKGJvbmVXZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVJbmRleCA9IGluZGljZXNFbGVtZW50LmFycmF5W2luZGljZXNFbGVtZW50LmluZGV4ICsga107XG4gICAgICAgICAgICAgICAgICAgIGJvbmVVc2VkW2JvbmVJbmRleF0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIHggPSBwb3NFbGVtZW50LmFycmF5W3Bvc0VsZW1lbnQuaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB5ID0gcG9zRWxlbWVudC5hcnJheVtwb3NFbGVtZW50LmluZGV4ICsgMV07XG4gICAgICAgICAgICAgICAgICAgIHogPSBwb3NFbGVtZW50LmFycmF5W3Bvc0VsZW1lbnQuaW5kZXggKyAyXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhZGp1c3QgYm91bmRzIG9mIGEgYm9uZSBieSB0aGUgdmVydGV4XG4gICAgICAgICAgICAgICAgICAgIGJNYXggPSBib25lTWF4W2JvbmVJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGJNaW4gPSBib25lTWluW2JvbmVJbmRleF07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueCA+IHgpIGJNaW4ueCA9IHg7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnkgPiB5KSBiTWluLnkgPSB5O1xuICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi56ID4geikgYk1pbi56ID0gejtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC54IDwgeCkgYk1heC54ID0geDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueSA8IHkpIGJNYXgueSA9IHk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnogPCB6KSBiTWF4LnogPSB6O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtb3JwaFRhcmdldHMpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluZCBtYXhpbXVtIGRpc3BsYWNlbWVudCBvZiB0aGUgdmVydGV4IGJ5IGFsbCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWluTW9ycGhYID0gbWF4TW9ycGhYID0geDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW5Nb3JwaFkgPSBtYXhNb3JwaFkgPSB5O1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1pbk1vcnBoWiA9IG1heE1vcnBoWiA9IHo7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vcnBoIHRoaXMgdmVydGV4IGJ5IGFsbCBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBsID0gMDsgbCA8IG1vcnBoVGFyZ2V0cy5sZW5ndGg7IGwrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IG1vcnBoVGFyZ2V0c1tsXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR4ID0gdGFyZ2V0LmRlbHRhUG9zaXRpb25zW2ogKiAzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkeSA9IHRhcmdldC5kZWx0YVBvc2l0aW9uc1tqICogMyArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR6ID0gdGFyZ2V0LmRlbHRhUG9zaXRpb25zW2ogKiAzICsgMl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZHggPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbk1vcnBoWCArPSBkeDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhNb3JwaFggKz0gZHg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGR5IDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5Nb3JwaFkgKz0gZHk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4TW9ycGhZICs9IGR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkeiA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluTW9ycGhaICs9IGR6O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heE1vcnBoWiArPSBkejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnggPiBtaW5Nb3JwaFgpIGJNaW4ueCA9IG1pbk1vcnBoWDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnkgPiBtaW5Nb3JwaFkpIGJNaW4ueSA9IG1pbk1vcnBoWTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnogPiBtaW5Nb3JwaFopIGJNaW4ueiA9IG1pbk1vcnBoWjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueCA8IG1heE1vcnBoWCkgYk1heC54ID0gbWF4TW9ycGhYO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueSA8IG1heE1vcnBoWSkgYk1heC55ID0gbWF4TW9ycGhZO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueiA8IG1heE1vcnBoWikgYk1heC56ID0gbWF4TW9ycGhaO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWNjb3VudCBmb3Igbm9ybWFsaXplZCBwb3NpdGlvbmFsIGRhdGFcbiAgICAgICAgY29uc3QgcG9zaXRpb25FbGVtZW50ID0gdGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0Rm9ybWF0KCkuZWxlbWVudHMuZmluZChlID0+IGUubmFtZSA9PT0gU0VNQU5USUNfUE9TSVRJT04pO1xuICAgICAgICBpZiAocG9zaXRpb25FbGVtZW50ICYmIHBvc2l0aW9uRWxlbWVudC5ub3JtYWxpemUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bmMgPSAoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAocG9zaXRpb25FbGVtZW50LmRhdGFUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9JTlQ4OiByZXR1cm4geCA9PiBNYXRoLm1heCh4IC8gMTI3LjAsIC0xLjApO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDg6IHJldHVybiB4ID0+IHggLyAyNTUuMDtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUWVBFX0lOVDE2OiByZXR1cm4geCA9PiBNYXRoLm1heCh4IC8gMzI3NjcuMCwgLTEuMCk7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6IHJldHVybiB4ID0+IHggLyA2NTUzNS4wO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiByZXR1cm4geCA9PiB4O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQm9uZXM7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChib25lVXNlZFtpXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaW4gPSBib25lTWluW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXggPSBib25lTWF4W2ldO1xuICAgICAgICAgICAgICAgICAgICBtaW4uc2V0KGZ1bmMobWluLngpLCBmdW5jKG1pbi55KSwgZnVuYyhtaW4ueikpO1xuICAgICAgICAgICAgICAgICAgICBtYXguc2V0KGZ1bmMobWF4LngpLCBmdW5jKG1heC55KSwgZnVuYyhtYXgueikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIGJvbmUgYm91bmRpbmcgYm94ZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Cb25lczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgICAgICBhYWJiLnNldE1pbk1heChib25lTWluW2ldLCBib25lTWF4W2ldKTtcbiAgICAgICAgICAgIHRoaXMuYm9uZUFhYmIucHVzaChhYWJiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdoZW4gbWVzaCBBUEkgdG8gbW9kaWZ5IHZlcnRleCAvIGluZGV4IGRhdGEgYXJlIHVzZWQsIHRoaXMgYWxsb2NhdGVzIHN0cnVjdHVyZSB0byBzdG9yZSB0aGUgZGF0YVxuICAgIF9pbml0R2VvbWV0cnlEYXRhKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2dlb21ldHJ5RGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhID0gbmV3IEdlb21ldHJ5RGF0YSgpO1xuXG4gICAgICAgICAgICAvLyBpZiB2ZXJ0ZXggYnVmZmVyIGV4aXN0cyBhbHJlYWR5LCBzdG9yZSB0aGUgc2l6ZXNcbiAgICAgICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudCA9IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcyA9IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBpbmRleCBidWZmZXIgZXhpc3RzIGFscmVhZHksIHN0b3JlIHRoZSBzaXplc1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQgPSB0aGlzLmluZGV4QnVmZmVyWzBdLm51bUluZGljZXM7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heEluZGljZXMgPSB0aGlzLmluZGV4QnVmZmVyWzBdLm51bUluZGljZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIG1lc2ggb2YgZXhpc3RpbmcgdmVydGljZXMgYW5kIGluZGljZXMgYW5kIHJlc2V0cyB0aGUge0BsaW5rIFZlcnRleEZvcm1hdH1cbiAgICAgKiBhc3NvY2lhdGVkIHdpdGggdGhlIG1lc2guIFRoaXMgY2FsbCBpcyB0eXBpY2FsbHkgZm9sbG93ZWQgYnkgY2FsbHMgdG8gbWV0aG9kcyBzdWNoIGFzXG4gICAgICoge0BsaW5rIE1lc2gjc2V0UG9zaXRpb25zfSwge0BsaW5rIE1lc2gjc2V0VmVydGV4U3RyZWFtfSBvciB7QGxpbmsgTWVzaCNzZXRJbmRpY2VzfSBhbmRcbiAgICAgKiBmaW5hbGx5IHtAbGluayBNZXNoI3VwZGF0ZX0gdG8gcmVidWlsZCB0aGUgbWVzaCwgYWxsb3dpbmcgZGlmZmVyZW50IHtAbGluayBWZXJ0ZXhGb3JtYXR9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbdmVydGljZXNEeW5hbWljXSAtIEluZGljYXRlcyB0aGUge0BsaW5rIFZlcnRleEJ1ZmZlcn0gc2hvdWxkIGJlIGNyZWF0ZWRcbiAgICAgKiB3aXRoIHtAbGluayBCVUZGRVJfRFlOQU1JQ30gdXNhZ2UuIElmIG5vdCBzcGVjaWZpZWQsIHtAbGluayBCVUZGRVJfU1RBVElDfSBpcyB1c2VkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2luZGljZXNEeW5hbWljXSAtIEluZGljYXRlcyB0aGUge0BsaW5rIEluZGV4QnVmZmVyfSBzaG91bGQgYmUgY3JlYXRlZCB3aXRoXG4gICAgICoge0BsaW5rIEJVRkZFUl9EWU5BTUlDfSB1c2FnZS4gSWYgbm90IHNwZWNpZmllZCwge0BsaW5rIEJVRkZFUl9TVEFUSUN9IGlzIHVzZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXhWZXJ0aWNlc10gLSBBIHtAbGluayBWZXJ0ZXhCdWZmZXJ9IHdpbGwgYmUgYWxsb2NhdGVkIHdpdGggYXQgbGVhc3RcbiAgICAgKiBtYXhWZXJ0aWNlcywgYWxsb3dpbmcgYWRkaXRpb25hbCB2ZXJ0aWNlcyB0byBiZSBhZGRlZCB0byBpdCB3aXRob3V0IHRoZSBhbGxvY2F0aW9uLiBJZiBub1xuICAgICAqIHZhbHVlIGlzIHByb3ZpZGVkLCBhIHNpemUgdG8gZml0IHRoZSBwcm92aWRlZCB2ZXJ0aWNlcyB3aWxsIGJlIGFsbG9jYXRlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21heEluZGljZXNdIC0gQW4ge0BsaW5rIEluZGV4QnVmZmVyfSB3aWxsIGJlIGFsbG9jYXRlZCB3aXRoIGF0IGxlYXN0XG4gICAgICogbWF4SW5kaWNlcywgYWxsb3dpbmcgYWRkaXRpb25hbCBpbmRpY2VzIHRvIGJlIGFkZGVkIHRvIGl0IHdpdGhvdXQgdGhlIGFsbG9jYXRpb24uIElmIG5vXG4gICAgICogdmFsdWUgaXMgcHJvdmlkZWQsIGEgc2l6ZSB0byBmaXQgdGhlIHByb3ZpZGVkIGluZGljZXMgd2lsbCBiZSBhbGxvY2F0ZWQuXG4gICAgICovXG4gICAgY2xlYXIodmVydGljZXNEeW5hbWljLCBpbmRpY2VzRHluYW1pYywgbWF4VmVydGljZXMgPSAwLCBtYXhJbmRpY2VzID0gMCkge1xuICAgICAgICB0aGlzLl9pbml0R2VvbWV0cnlEYXRhKCk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbml0RGVmYXVsdHMoKTtcblxuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEucmVjcmVhdGUgPSB0cnVlO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4VmVydGljZXMgPSBtYXhWZXJ0aWNlcztcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heEluZGljZXMgPSBtYXhJbmRpY2VzO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGljZXNVc2FnZSA9IHZlcnRpY2VzRHluYW1pYyA/IEJVRkZFUl9TVEFUSUMgOiBCVUZGRVJfRFlOQU1JQztcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXNVc2FnZSA9IGluZGljZXNEeW5hbWljID8gQlVGRkVSX1NUQVRJQyA6IEJVRkZFUl9EWU5BTUlDO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCBkYXRhIGZvciBhbnkgc3VwcG9ydGVkIHNlbWFudGljLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbWFudGljIC0gVGhlIG1lYW5pbmcgb2YgdGhlIHZlcnRleCBlbGVtZW50LiBGb3Igc3VwcG9ydGVkIHNlbWFudGljcywgc2VlXG4gICAgICogU0VNQU5USUNfKiBpbiB7QGxpbmsgVmVydGV4Rm9ybWF0fS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGRhdGEgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGZvciB0aGUgc3BlY2lmaWVkIHNlbWFudGljLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wb25lbnRDb3VudCAtIFRoZSBudW1iZXIgb2YgdmFsdWVzIHRoYXQgZm9ybSBhIHNpbmdsZSBWZXJ0ZXggZWxlbWVudC4gRm9yXG4gICAgICogZXhhbXBsZSB3aGVuIHNldHRpbmcgYSAzRCBwb3NpdGlvbiByZXByZXNlbnRlZCBieSAzIG51bWJlcnMgcGVyIHZlcnRleCwgbnVtYmVyIDMgc2hvdWxkIGJlXG4gICAgICogc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkYXRhVHlwZV0gLSBUaGUgZm9ybWF0IG9mIGRhdGEgd2hlbiBzdG9yZWQgaW4gdGhlIHtAbGluayBWZXJ0ZXhCdWZmZXJ9LCBzZWVcbiAgICAgKiBUWVBFXyogaW4ge0BsaW5rIFZlcnRleEZvcm1hdH0uIFdoZW4gbm90IHNwZWNpZmllZCwge0BsaW5rIFRZUEVfRkxPQVQzMn0gaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkYXRhVHlwZU5vcm1hbGl6ZV0gLSBJZiB0cnVlLCB2ZXJ0ZXggYXR0cmlidXRlIGRhdGEgd2lsbCBiZSBtYXBwZWQgZnJvbSBhXG4gICAgICogMCB0byAyNTUgcmFuZ2UgZG93biB0byAwIHRvIDEgd2hlbiBmZWQgdG8gYSBzaGFkZXIuIElmIGZhbHNlLCB2ZXJ0ZXggYXR0cmlidXRlIGRhdGEgaXMgbGVmdFxuICAgICAqIHVuY2hhbmdlZC4gSWYgdGhpcyBwcm9wZXJ0eSBpcyB1bnNwZWNpZmllZCwgZmFsc2UgaXMgYXNzdW1lZC5cbiAgICAgKi9cbiAgICBzZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIGRhdGEsIGNvbXBvbmVudENvdW50LCBudW1WZXJ0aWNlcywgZGF0YVR5cGUgPSBUWVBFX0ZMT0FUMzIsIGRhdGFUeXBlTm9ybWFsaXplID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5faW5pdEdlb21ldHJ5RGF0YSgpO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb3VudCA9IG51bVZlcnRpY2VzIHx8IGRhdGEubGVuZ3RoIC8gY29tcG9uZW50Q291bnQ7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5fY2hhbmdlVmVydGV4Q291bnQodmVydGV4Q291bnQsIHNlbWFudGljKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbXNVcGRhdGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY10gPSBuZXcgR2VvbWV0cnlWZXJ0ZXhTdHJlYW0oXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgY29tcG9uZW50Q291bnQsXG4gICAgICAgICAgICBkYXRhVHlwZSxcbiAgICAgICAgICAgIGRhdGFUeXBlTm9ybWFsaXplXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdmVydGV4IGRhdGEgY29ycmVzcG9uZGluZyB0byBhIHNlbWFudGljLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbWFudGljIC0gVGhlIHNlbWFudGljIG9mIHRoZSB2ZXJ0ZXggZWxlbWVudCB0byBnZXQuIEZvciBzdXBwb3J0ZWRcbiAgICAgKiBzZW1hbnRpY3MsIHNlZSBTRU1BTlRJQ18qIGluIHtAbGluayBWZXJ0ZXhGb3JtYXR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gZGF0YSAtIEFuXG4gICAgICogYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGUgdmVydGV4IGRhdGEuIFdoZW4gdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0b1xuICAgICAqIGJlIHJlc2VydmVkLCBvdGhlcndpc2Ugb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiB2ZXJ0aWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0VmVydGV4U3RyZWFtKHNlbWFudGljLCBkYXRhKSB7XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgIGxldCBkb25lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gc2VlIGlmIHdlIGhhdmUgdW4tYXBwbGllZCBzdHJlYW1cbiAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YSkge1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdO1xuICAgICAgICAgICAgaWYgKHN0cmVhbSkge1xuICAgICAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhkYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbiBkYXRhIGlzIHR5cGVkIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc2V0KHN0cmVhbS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbiBkYXRhIGlzIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIGRhdGEubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wdXNoKHN0cmVhbS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgICAgIC8vIGdldCBzdHJlYW0gZnJvbSBWZXJ0ZXhCdWZmZXJcbiAgICAgICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IHRoZXJlIGlzIG5vIG5lZWQgdG8gLmVuZCB0aGUgaXRlcmF0b3IsIGFzIHdlIGFyZSBvbmx5IHJlYWRpbmcgZGF0YSBmcm9tIGl0XG4gICAgICAgICAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBuZXcgVmVydGV4SXRlcmF0b3IodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICAgICAgICAgIGNvdW50ID0gaXRlcmF0b3IucmVhZERhdGEoc2VtYW50aWMsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCBwb3NpdGlvbnMgYXJyYXkuIFZlcnRpY2VzIGFyZSBzdG9yZWQgdXNpbmcge0BsaW5rIFRZUEVfRkxPQVQzMn0gZm9ybWF0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBwb3NpdGlvbnMgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGNvbnRhaW5pbmcgcG9zaXRpb25zLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29tcG9uZW50Q291bnRdIC0gVGhlIG51bWJlciBvZiB2YWx1ZXMgdGhhdCBmb3JtIGEgc2luZ2xlIHBvc2l0aW9uIGVsZW1lbnQuXG4gICAgICogRGVmYXVsdHMgdG8gMyBpZiBub3Qgc3BlY2lmaWVkLCBjb3JyZXNwb25kaW5nIHRvIHgsIHkgYW5kIHogY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbnMocG9zaXRpb25zLCBjb21wb25lbnRDb3VudCA9IEdlb21ldHJ5RGF0YS5ERUZBVUxUX0NPTVBPTkVOVFNfUE9TSVRJT04sIG51bVZlcnRpY2VzKSB7XG4gICAgICAgIHRoaXMuc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1BPU0lUSU9OLCBwb3NpdGlvbnMsIGNvbXBvbmVudENvdW50LCBudW1WZXJ0aWNlcywgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IG5vcm1hbHMgYXJyYXkuIE5vcm1hbHMgYXJlIHN0b3JlZCB1c2luZyB7QGxpbmsgVFlQRV9GTE9BVDMyfSBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IG5vcm1hbHMgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGNvbnRhaW5pbmcgbm9ybWFscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbXBvbmVudENvdW50XSAtIFRoZSBudW1iZXIgb2YgdmFsdWVzIHRoYXQgZm9ybSBhIHNpbmdsZSBub3JtYWwgZWxlbWVudC5cbiAgICAgKiBEZWZhdWx0cyB0byAzIGlmIG5vdCBzcGVjaWZpZWQsIGNvcnJlc3BvbmRpbmcgdG8geCwgeSBhbmQgeiBkaXJlY3Rpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXROb3JtYWxzKG5vcm1hbHMsIGNvbXBvbmVudENvdW50ID0gR2VvbWV0cnlEYXRhLkRFRkFVTFRfQ09NUE9ORU5UU19OT1JNQUwsIG51bVZlcnRpY2VzKSB7XG4gICAgICAgIHRoaXMuc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX05PUk1BTCwgbm9ybWFscywgY29tcG9uZW50Q291bnQsIG51bVZlcnRpY2VzLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggdXYgYXJyYXkuIFV2cyBhcmUgc3RvcmVkIHVzaW5nIHtAbGluayBUWVBFX0ZMT0FUMzJ9IGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaGFubmVsIC0gVGhlIHV2IGNoYW5uZWwgaW4gWzAuLjddIHJhbmdlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gdXZzIC0gVmVydGV4XG4gICAgICogZGF0YSBjb250YWluaW5nIHV2LWNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29tcG9uZW50Q291bnRdIC0gVGhlIG51bWJlciBvZiB2YWx1ZXMgdGhhdCBmb3JtIGEgc2luZ2xlIHV2IGVsZW1lbnQuXG4gICAgICogRGVmYXVsdHMgdG8gMiBpZiBub3Qgc3BlY2lmaWVkLCBjb3JyZXNwb25kaW5nIHRvIHUgYW5kIHYgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRVdnMoY2hhbm5lbCwgdXZzLCBjb21wb25lbnRDb3VudCA9IEdlb21ldHJ5RGF0YS5ERUZBVUxUX0NPTVBPTkVOVFNfVVYsIG51bVZlcnRpY2VzKSB7XG4gICAgICAgIHRoaXMuc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1RFWENPT1JEICsgY2hhbm5lbCwgdXZzLCBjb21wb25lbnRDb3VudCwgbnVtVmVydGljZXMsIFRZUEVfRkxPQVQzMiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCBjb2xvciBhcnJheS4gQ29sb3JzIGFyZSBzdG9yZWQgdXNpbmcge0BsaW5rIFRZUEVfRkxPQVQzMn0gZm9ybWF0LCB3aGljaCBpc1xuICAgICAqIHVzZWZ1bCBmb3IgSERSIGNvbG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gY29sb3JzIC0gVmVydGV4XG4gICAgICogZGF0YSBjb250YWluaW5nIGNvbG9ycy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbXBvbmVudENvdW50XSAtIFRoZSBudW1iZXIgb2YgdmFsdWVzIHRoYXQgZm9ybSBhIHNpbmdsZSBjb2xvciBlbGVtZW50LlxuICAgICAqIERlZmF1bHRzIHRvIDQgaWYgbm90IHNwZWNpZmllZCwgY29ycmVzcG9uZGluZyB0byByLCBnLCBiIGFuZCBhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0Q29sb3JzKGNvbG9ycywgY29tcG9uZW50Q291bnQgPSBHZW9tZXRyeURhdGEuREVGQVVMVF9DT01QT05FTlRTX0NPTE9SUywgbnVtVmVydGljZXMpIHtcbiAgICAgICAgdGhpcy5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQ09MT1IsIGNvbG9ycywgY29tcG9uZW50Q291bnQsIG51bVZlcnRpY2VzLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggY29sb3IgYXJyYXkuIENvbG9ycyBhcmUgc3RvcmVkIHVzaW5nIHtAbGluayBUWVBFX1VJTlQ4fSBmb3JtYXQsIHdoaWNoIGlzXG4gICAgICogdXNlZnVsIGZvciBMRFIgY29sb3JzLiBWYWx1ZXMgaW4gdGhlIGFycmF5IGFyZSBleHBlY3RlZCBpbiBbMC4uMjU1XSByYW5nZSwgYW5kIGFyZSBtYXBwZWQgdG9cbiAgICAgKiBbMC4uMV0gcmFuZ2UgaW4gdGhlIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gY29sb3JzIC0gVmVydGV4XG4gICAgICogZGF0YSBjb250YWluaW5nIGNvbG9ycy4gVGhlIGFycmF5IGlzIGV4cGVjdGVkIHRvIGNvbnRhaW4gNCBjb21wb25lbnRzIHBlciB2ZXJ0ZXgsXG4gICAgICogY29ycmVzcG9uZGluZyB0byByLCBnLCBiIGFuZCBhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0Q29sb3JzMzIoY29sb3JzLCBudW1WZXJ0aWNlcykge1xuICAgICAgICB0aGlzLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19DT0xPUiwgY29sb3JzLCBHZW9tZXRyeURhdGEuREVGQVVMVF9DT01QT05FTlRTX0NPTE9SUywgbnVtVmVydGljZXMsIFRZUEVfVUlOVDgsIHRydWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGluZGV4IGFycmF5LiBJbmRpY2VzIGFyZSBzdG9yZWQgdXNpbmcgMTYtYml0IGZvcm1hdCBieSBkZWZhdWx0LCB1bmxlc3MgbW9yZSB0aGFuXG4gICAgICogNjU1MzUgdmVydGljZXMgYXJlIHNwZWNpZmllZCwgaW4gd2hpY2ggY2FzZSAzMi1iaXQgZm9ybWF0IGlzIHVzZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfFVpbnQ4QXJyYXl8VWludDE2QXJyYXl8VWludDMyQXJyYXl9IGluZGljZXMgLSBUaGUgYXJyYXkgb2YgaW5kaWNlcyB0aGF0XG4gICAgICogZGVmaW5lIHByaW1pdGl2ZXMgKGxpbmVzLCB0cmlhbmdsZXMsIGV0Yy4pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtSW5kaWNlc10gLSBUaGUgbnVtYmVyIG9mIGluZGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldEluZGljZXMoaW5kaWNlcywgbnVtSW5kaWNlcykge1xuICAgICAgICB0aGlzLl9pbml0R2VvbWV0cnlEYXRhKCk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleFN0cmVhbVVwZGF0ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kaWNlcyA9IGluZGljZXM7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50ID0gbnVtSW5kaWNlcyB8fCBpbmRpY2VzLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2ZXJ0ZXggcG9zaXRpb25zIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IHBvc2l0aW9ucyAtIEFuXG4gICAgICogYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGUgdmVydGV4IGRhdGEuIFdoZW4gdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0b1xuICAgICAqIGJlIHJlc2VydmVkLCBvdGhlcndpc2Ugb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiB2ZXJ0aWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb25zKHBvc2l0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfUE9TSVRJT04sIHBvc2l0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdmVydGV4IG5vcm1hbHMgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gbm9ybWFscyAtIEFuXG4gICAgICogYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGUgdmVydGV4IGRhdGEuIFdoZW4gdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0b1xuICAgICAqIGJlIHJlc2VydmVkLCBvdGhlcndpc2Ugb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiB2ZXJ0aWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0Tm9ybWFscyhub3JtYWxzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZlcnRleFN0cmVhbShTRU1BTlRJQ19OT1JNQUwsIG5vcm1hbHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZlcnRleCB1diBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNoYW5uZWwgLSBUaGUgdXYgY2hhbm5lbCBpbiBbMC4uN10gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSB1dnMgLSBBblxuICAgICAqIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlIHZlcnRleCBkYXRhLiBXaGVuIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG9cbiAgICAgKiBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdmVydGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldFV2cyhjaGFubmVsLCB1dnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1RFWENPT1JEICsgY2hhbm5lbCwgdXZzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2ZXJ0ZXggY29sb3IgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gY29sb3JzIC0gQW5cbiAgICAgKiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZSB2ZXJ0ZXggZGF0YS4gV2hlbiB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvXG4gICAgICogYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZSBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXRDb2xvcnMoY29sb3JzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZlcnRleFN0cmVhbShTRU1BTlRJQ19DT0xPUiwgY29sb3JzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBpbmRleCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxVaW50OEFycmF5fFVpbnQxNkFycmF5fFVpbnQzMkFycmF5fSBpbmRpY2VzIC0gQW4gYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGVcbiAgICAgKiBpbmRleCBkYXRhLiBXaGVuIGEgdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0byBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlXG4gICAgICogb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiBpbmRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXRJbmRpY2VzKGluZGljZXMpIHtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAvLyBzZWUgaWYgd2UgaGF2ZSB1bi1hcHBsaWVkIGluZGljZXNcbiAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YSAmJiB0aGlzLl9nZW9tZXRyeURhdGEuaW5kaWNlcykge1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFtSW5kaWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzO1xuICAgICAgICAgICAgY291bnQgPSB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudDtcblxuICAgICAgICAgICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhpbmRpY2VzKSkge1xuICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uIGRhdGEgaXMgdHlwZWQgYXJyYXlcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnNldChzdHJlYW1JbmRpY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb24gZGF0YSBpcyBhcnJheVxuICAgICAgICAgICAgICAgIGluZGljZXMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgaWwgPSBzdHJlYW1JbmRpY2VzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHN0cmVhbUluZGljZXNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGdldCBkYXRhIGZyb20gSW5kZXhCdWZmZXJcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlclswXTtcbiAgICAgICAgICAgICAgICBjb3VudCA9IGluZGV4QnVmZmVyLnJlYWREYXRhKGluZGljZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgYW55IGNoYW5nZXMgdG8gdmVydGV4IHN0cmVhbSBhbmQgaW5kaWNlcyB0byBtZXNoLiBUaGlzIGFsbG9jYXRlcyBvciByZWFsbG9jYXRlc1xuICAgICAqIHtAbGluayB2ZXJ0ZXhCdWZmZXJ9IG9yIHtAbGluayBJbmRleEJ1ZmZlcn0gdG8gZml0IGFsbCBwcm92aWRlZCB2ZXJ0aWNlcyBhbmQgaW5kaWNlcywgYW5kXG4gICAgICogZmlsbHMgdGhlbSB3aXRoIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ByaW1pdGl2ZVR5cGVdIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9QT0lOVFN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FTE9PUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklBTkdMRVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklGQU59XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU30gaWYgdW5zcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbdXBkYXRlQm91bmRpbmdCb3hdIC0gVHJ1ZSB0byB1cGRhdGUgYm91bmRpbmcgYm94LiBCb3VuZGluZyBib3ggaXMgdXBkYXRlZFxuICAgICAqIG9ubHkgaWYgcG9zaXRpb25zIHdlcmUgc2V0IHNpbmNlIGxhc3QgdGltZSB1cGRhdGUgd2FzIGNhbGxlZCwgYW5kIGNvbXBvbmVudENvdW50IGZvclxuICAgICAqIHBvc2l0aW9uIHdhcyAzLCBvdGhlcndpc2UgYm91bmRpbmcgYm94IGlzIG5vdCB1cGRhdGVkLiBTZWUge0BsaW5rIE1lc2gjc2V0UG9zaXRpb25zfS5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlIGlmIHVuc3BlY2lmaWVkLiBTZXQgdGhpcyB0byBmYWxzZSB0byBhdm9pZCB1cGRhdGUgb2YgdGhlIGJvdW5kaW5nIGJveCBhbmRcbiAgICAgKiB1c2UgYWFiYiBwcm9wZXJ0eSB0byBzZXQgaXQgaW5zdGVhZC5cbiAgICAgKi9cbiAgICB1cGRhdGUocHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVMsIHVwZGF0ZUJvdW5kaW5nQm94ID0gdHJ1ZSkge1xuXG4gICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEpIHtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIGJvdW5kaW5nIGJveCBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh1cGRhdGVCb3VuZGluZ0JveCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZmluZCB2ZWMzIHBvc2l0aW9uIHN0cmVhbVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5W1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICAgICAgICAgICAgICBpZiAoc3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHJlYW0uY29tcG9uZW50Q291bnQgPT09IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2FhYmIuY29tcHV0ZShzdHJlYW0uZGF0YSwgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVzdHJveSB2ZXJ0ZXggYnVmZmVyIGlmIHJlY3JlYXRlIHdhcyByZXF1ZXN0ZWQgb3IgaWYgdmVydGljZXMgZG9uJ3QgZml0XG4gICAgICAgICAgICBsZXQgZGVzdHJveVZCID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnJlY3JlYXRlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudCA+IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcykge1xuICAgICAgICAgICAgICAgIGRlc3Ryb3lWQiA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVzdHJveVZCKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVzdHJveSBpbmRleCBidWZmZXIgaWYgcmVjcmVhdGUgd2FzIHJlcXVlc3RlZCBvciBpZiBpbmRpY2VzIGRvbid0IGZpdFxuICAgICAgICAgICAgbGV0IGRlc3Ryb3lJQiA9IHRoaXMuX2dlb21ldHJ5RGF0YS5yZWNyZWF0ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudCA+IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhJbmRpY2VzKSB7XG4gICAgICAgICAgICAgICAgZGVzdHJveUlCID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4SW5kaWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVzdHJveUlCKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbMF0uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyWzBdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSB2ZXJ0aWNlcyBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtc1VwZGF0ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVWZXJ0ZXhCdWZmZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGluZGljZXMgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4U3RyZWFtVXBkYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUluZGV4QnVmZmVyKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCB1cCBwcmltaXRpdmUgcGFyYW1ldGVyc1xuICAgICAgICAgICAgdGhpcy5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkgeyAgICAgIC8vIGluZGV4ZWRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4U3RyZWFtVXBkYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5jb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5pbmRleGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgeyAgICAgICAgLy8gbm9uLWluZGV4ZWRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbXNVcGRhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlWzBdLmNvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5pbmRleGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb3VudHMgY2FuIGJlIGNoYW5nZWQgb24gbmV4dCBmcmFtZSwgc28gc2V0IHRoZW0gdG8gMFxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50ID0gMDtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50ID0gMDtcblxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbXNVcGRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhTdHJlYW1VcGRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEucmVjcmVhdGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG90aGVyIHJlbmRlciBzdGF0ZXNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUmVuZGVyU3RhdGVzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBidWlsZHMgdmVydGV4IGZvcm1hdCBiYXNlZCBvbiBhdHRhY2hlZCB2ZXJ0ZXggc3RyZWFtc1xuICAgIF9idWlsZFZlcnRleEZvcm1hdCh2ZXJ0ZXhDb3VudCkge1xuXG4gICAgICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5KSB7XG4gICAgICAgICAgICBjb25zdCBzdHJlYW0gPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY107XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzdHJlYW0uY29tcG9uZW50Q291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogc3RyZWFtLmRhdGFUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogc3RyZWFtLmRhdGFUeXBlTm9ybWFsaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgVmVydGV4Rm9ybWF0KHRoaXMuZGV2aWNlLCB2ZXJ0ZXhEZXNjLCB2ZXJ0ZXhDb3VudCk7XG4gICAgfVxuXG4gICAgLy8gY29weSBhdHRhY2hlZCBkYXRhIGludG8gdmVydGV4IGJ1ZmZlclxuICAgIF91cGRhdGVWZXJ0ZXhCdWZmZXIoKSB7XG5cbiAgICAgICAgLy8gaWYgd2UgZG9uJ3QgaGF2ZSB2ZXJ0ZXggYnVmZmVyLCBjcmVhdGUgbmV3IG9uZSwgb3RoZXJ3aXNlIHVwZGF0ZSBleGlzdGluZyBvbmVcbiAgICAgICAgaWYgKCF0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgY29uc3QgYWxsb2NhdGVWZXJ0ZXhDb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcztcbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IHRoaXMuX2J1aWxkVmVydGV4Rm9ybWF0KGFsbG9jYXRlVmVydGV4Q291bnQpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZGV2aWNlLCBmb3JtYXQsIGFsbG9jYXRlVmVydGV4Q291bnQsIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0aWNlc1VzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvY2sgdmVydGV4IGJ1ZmZlciBhbmQgY3JlYXRlIHR5cGVkIGFjY2VzcyBhcnJheXMgZm9yIGluZGl2aWR1YWwgZWxlbWVudHNcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBuZXcgVmVydGV4SXRlcmF0b3IodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXG4gICAgICAgIC8vIGNvcHkgYWxsIHN0cmVhbSBkYXRhIGludG8gdmVydGV4IGJ1ZmZlclxuICAgICAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudDtcbiAgICAgICAgZm9yIChjb25zdCBzZW1hbnRpYyBpbiB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeSkge1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdO1xuICAgICAgICAgICAgaXRlcmF0b3Iud3JpdGVEYXRhKHNlbWFudGljLCBzdHJlYW0uZGF0YSwgbnVtVmVydGljZXMpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgc3RyZWFtXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaXRlcmF0b3IuZW5kKCk7XG4gICAgfVxuXG4gICAgLy8gY29weSBhdHRhY2hlZCBkYXRhIGludG8gaW5kZXggYnVmZmVyXG4gICAgX3VwZGF0ZUluZGV4QnVmZmVyKCkge1xuXG4gICAgICAgIC8vIGlmIHdlIGRvbid0IGhhdmUgaW5kZXggYnVmZmVyLCBjcmVhdGUgbmV3IG9uZSwgb3RoZXJ3aXNlIHVwZGF0ZSBleGlzdGluZyBvbmVcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoIDw9IDAgfHwgIXRoaXMuaW5kZXhCdWZmZXJbMF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZUZvcm1hdCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcyA+IDB4ZmZmZiA/IElOREVYRk9STUFUX1VJTlQzMiA6IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbMF0gPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5kZXZpY2UsIGNyZWF0ZUZvcm1hdCwgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heEluZGljZXMsIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzVXNhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3JjSW5kaWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzO1xuICAgICAgICBpZiAoc3JjSW5kaWNlcykge1xuXG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXJbMF07XG4gICAgICAgICAgICBpbmRleEJ1ZmZlci53cml0ZURhdGEoc3JjSW5kaWNlcywgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZGF0YVxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgdGhlIG1lc2ggdG8gYmUgcmVuZGVyZWQgd2l0aCBzcGVjaWZpYyByZW5kZXIgc3R5bGVcbiAgICBwcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpIHtcbiAgICAgICAgaWYgKHJlbmRlclN0eWxlID09PSBSRU5ERVJTVFlMRV9XSVJFRlJBTUUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2VuZXJhdGVXaXJlZnJhbWUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChyZW5kZXJTdHlsZSA9PT0gUkVOREVSU1RZTEVfUE9JTlRTKSB7XG4gICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9QT0lOVFNdID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgICAgICAgICAgICAgYmFzZTogMCxcbiAgICAgICAgICAgICAgICBjb3VudDogdGhpcy52ZXJ0ZXhCdWZmZXIgPyB0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyA6IDAsXG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIGV4aXN0aW5nIHJlbmRlciBzdGF0ZXMgd2l0aCBjaGFuZ2VzIHRvIHNvbGlkIHJlbmRlciBzdGF0ZVxuICAgIHVwZGF0ZVJlbmRlclN0YXRlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfUE9JTlRTXSkge1xuICAgICAgICAgICAgdGhpcy5wcmVwYXJlUmVuZGVyU3RhdGUoUkVOREVSU1RZTEVfUE9JTlRTKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9XSVJFRlJBTUVdKSB7XG4gICAgICAgICAgICB0aGlzLnByZXBhcmVSZW5kZXJTdGF0ZShSRU5ERVJTVFlMRV9XSVJFRlJBTUUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVXaXJlZnJhbWUoKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSBleGlzdGluZyBJQlxuICAgICAgICB0aGlzLl9kZXN0cm95SW5kZXhCdWZmZXIoUkVOREVSU1RZTEVfV0lSRUZSQU1FKTtcblxuICAgICAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuXG4gICAgICAgIGNvbnN0IGxpbmVzID0gW107XG4gICAgICAgIGxldCBmb3JtYXQ7XG4gICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkge1xuICAgICAgICAgICAgY29uc3Qgb2Zmc2V0cyA9IFtbMCwgMV0sIFsxLCAyXSwgWzIsIDBdXTtcblxuICAgICAgICAgICAgY29uc3QgYmFzZSA9IHRoaXMucHJpbWl0aXZlW1JFTkRFUlNUWUxFX1NPTElEXS5iYXNlO1xuICAgICAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9TT0xJRF0uY291bnQ7XG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXJbUkVOREVSU1RZTEVfU09MSURdO1xuICAgICAgICAgICAgY29uc3Qgc3JjSW5kaWNlcyA9IG5ldyB0eXBlZEFycmF5SW5kZXhGb3JtYXRzW2luZGV4QnVmZmVyLmZvcm1hdF0oaW5kZXhCdWZmZXIuc3RvcmFnZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGogPSBiYXNlOyBqIDwgYmFzZSArIGNvdW50OyBqICs9IDMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IDM7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpMSA9IHNyY0luZGljZXNbaiArIG9mZnNldHNba11bMF1dO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpMiA9IHNyY0luZGljZXNbaiArIG9mZnNldHNba11bMV1dO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNoID0gKGkxID4gaTIpID8gKChpMiAqIG51bVZlcnRpY2VzKSArIGkxKSA6ICgoaTEgKiBudW1WZXJ0aWNlcykgKyBpMik7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2Vlbi5oYXMoaGFzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlZW4uYWRkKGhhc2gpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXMucHVzaChpMSwgaTIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9ybWF0ID0gaW5kZXhCdWZmZXIuZm9ybWF0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSArPSAzKSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaChpLCBpICsgMSwgaSArIDEsIGkgKyAyLCBpICsgMiwgaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3JtYXQgPSBsaW5lcy5sZW5ndGggPiA2NTUzNSA/IElOREVYRk9STUFUX1VJTlQzMiA6IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdpcmVCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIodGhpcy52ZXJ0ZXhCdWZmZXIuZGV2aWNlLCBmb3JtYXQsIGxpbmVzLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGRzdEluZGljZXMgPSBuZXcgdHlwZWRBcnJheUluZGV4Rm9ybWF0c1t3aXJlQnVmZmVyLmZvcm1hdF0od2lyZUJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZHN0SW5kaWNlcy5zZXQobGluZXMpO1xuICAgICAgICB3aXJlQnVmZmVyLnVubG9jaygpO1xuXG4gICAgICAgIHRoaXMucHJpbWl0aXZlW1JFTkRFUlNUWUxFX1dJUkVGUkFNRV0gPSB7XG4gICAgICAgICAgICB0eXBlOiBQUklNSVRJVkVfTElORVMsXG4gICAgICAgICAgICBiYXNlOiAwLFxuICAgICAgICAgICAgY291bnQ6IGxpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgIGluZGV4ZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlcltSRU5ERVJTVFlMRV9XSVJFRlJBTUVdID0gd2lyZUJ1ZmZlcjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IE1lc2ggfTtcbiJdLCJuYW1lcyI6WyJpZCIsIkdlb21ldHJ5RGF0YSIsImNvbnN0cnVjdG9yIiwiaW5pdERlZmF1bHRzIiwicmVjcmVhdGUiLCJ2ZXJ0aWNlc1VzYWdlIiwiQlVGRkVSX1NUQVRJQyIsImluZGljZXNVc2FnZSIsIm1heFZlcnRpY2VzIiwibWF4SW5kaWNlcyIsInZlcnRleENvdW50IiwiaW5kZXhDb3VudCIsInZlcnRleFN0cmVhbXNVcGRhdGVkIiwiaW5kZXhTdHJlYW1VcGRhdGVkIiwidmVydGV4U3RyZWFtRGljdGlvbmFyeSIsImluZGljZXMiLCJfY2hhbmdlVmVydGV4Q291bnQiLCJjb3VudCIsInNlbWFudGljIiwiRGVidWciLCJhc3NlcnQiLCJERUZBVUxUX0NPTVBPTkVOVFNfUE9TSVRJT04iLCJERUZBVUxUX0NPTVBPTkVOVFNfTk9STUFMIiwiREVGQVVMVF9DT01QT05FTlRTX1VWIiwiREVGQVVMVF9DT01QT05FTlRTX0NPTE9SUyIsIkdlb21ldHJ5VmVydGV4U3RyZWFtIiwiZGF0YSIsImNvbXBvbmVudENvdW50IiwiZGF0YVR5cGUiLCJkYXRhVHlwZU5vcm1hbGl6ZSIsIk1lc2giLCJSZWZDb3VudGVkT2JqZWN0IiwiZ3JhcGhpY3NEZXZpY2UiLCJfYWFiYlZlciIsIl9hYWJiIiwiQm91bmRpbmdCb3giLCJkZXZpY2UiLCJ2ZXJ0ZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsInByaW1pdGl2ZSIsInR5cGUiLCJiYXNlIiwic2tpbiIsIl9tb3JwaCIsIl9nZW9tZXRyeURhdGEiLCJib25lQWFiYiIsIm1vcnBoIiwiZGVjUmVmQ291bnQiLCJpbmNSZWZDb3VudCIsImFhYmIiLCJkZXN0cm95IiwicmVmQ291bnQiLCJqIiwibGVuZ3RoIiwiX2Rlc3Ryb3lJbmRleEJ1ZmZlciIsImluZGV4IiwiX2luaXRCb25lQWFiYnMiLCJtb3JwaFRhcmdldHMiLCJib25lVXNlZCIsIngiLCJ5IiwieiIsImJNYXgiLCJiTWluIiwiYm9uZU1pbiIsImJvbmVNYXgiLCJudW1Cb25lcyIsImJvbmVOYW1lcyIsIm1heE1vcnBoWCIsIm1heE1vcnBoWSIsIm1heE1vcnBoWiIsImkiLCJWZWMzIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiaXRlcmF0b3IiLCJWZXJ0ZXhJdGVyYXRvciIsInBvc0VsZW1lbnQiLCJlbGVtZW50IiwiU0VNQU5USUNfUE9TSVRJT04iLCJ3ZWlnaHRzRWxlbWVudCIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiaW5kaWNlc0VsZW1lbnQiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJudW1WZXJ0cyIsIm51bVZlcnRpY2VzIiwiayIsImJvbmVXZWlnaHQiLCJhcnJheSIsImJvbmVJbmRleCIsIm1pbk1vcnBoWCIsIm1pbk1vcnBoWSIsIm1pbk1vcnBoWiIsImwiLCJ0YXJnZXQiLCJkeCIsImRlbHRhUG9zaXRpb25zIiwiZHkiLCJkeiIsIm5leHQiLCJwb3NpdGlvbkVsZW1lbnQiLCJnZXRGb3JtYXQiLCJlbGVtZW50cyIsImZpbmQiLCJlIiwibmFtZSIsIm5vcm1hbGl6ZSIsImZ1bmMiLCJUWVBFX0lOVDgiLCJNYXRoIiwibWF4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIm1pbiIsInNldCIsInNldE1pbk1heCIsInB1c2giLCJfaW5pdEdlb21ldHJ5RGF0YSIsIm51bUluZGljZXMiLCJjbGVhciIsInZlcnRpY2VzRHluYW1pYyIsImluZGljZXNEeW5hbWljIiwiQlVGRkVSX0RZTkFNSUMiLCJzZXRWZXJ0ZXhTdHJlYW0iLCJUWVBFX0ZMT0FUMzIiLCJnZXRWZXJ0ZXhTdHJlYW0iLCJkb25lIiwic3RyZWFtIiwiQXJyYXlCdWZmZXIiLCJpc1ZpZXciLCJyZWFkRGF0YSIsInNldFBvc2l0aW9ucyIsInBvc2l0aW9ucyIsInNldE5vcm1hbHMiLCJub3JtYWxzIiwiU0VNQU5USUNfTk9STUFMIiwic2V0VXZzIiwiY2hhbm5lbCIsInV2cyIsIlNFTUFOVElDX1RFWENPT1JEIiwic2V0Q29sb3JzIiwiY29sb3JzIiwiU0VNQU5USUNfQ09MT1IiLCJzZXRDb2xvcnMzMiIsInNldEluZGljZXMiLCJnZXRQb3NpdGlvbnMiLCJnZXROb3JtYWxzIiwiZ2V0VXZzIiwiZ2V0Q29sb3JzIiwiZ2V0SW5kaWNlcyIsInN0cmVhbUluZGljZXMiLCJpbCIsInVwZGF0ZSIsInByaW1pdGl2ZVR5cGUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwidXBkYXRlQm91bmRpbmdCb3giLCJjb21wdXRlIiwiZGVzdHJveVZCIiwiZGVzdHJveUlCIiwiX3VwZGF0ZVZlcnRleEJ1ZmZlciIsIl91cGRhdGVJbmRleEJ1ZmZlciIsImluZGV4ZWQiLCJ1cGRhdGVSZW5kZXJTdGF0ZXMiLCJfYnVpbGRWZXJ0ZXhGb3JtYXQiLCJ2ZXJ0ZXhEZXNjIiwiY29tcG9uZW50cyIsIlZlcnRleEZvcm1hdCIsImFsbG9jYXRlVmVydGV4Q291bnQiLCJmb3JtYXQiLCJWZXJ0ZXhCdWZmZXIiLCJ3cml0ZURhdGEiLCJlbmQiLCJjcmVhdGVGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJbmRleEJ1ZmZlciIsInNyY0luZGljZXMiLCJwcmVwYXJlUmVuZGVyU3RhdGUiLCJyZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1dJUkVGUkFNRSIsImdlbmVyYXRlV2lyZWZyYW1lIiwiUkVOREVSU1RZTEVfUE9JTlRTIiwiUFJJTUlUSVZFX1BPSU5UUyIsImxpbmVzIiwib2Zmc2V0cyIsIlJFTkRFUlNUWUxFX1NPTElEIiwidHlwZWRBcnJheUluZGV4Rm9ybWF0cyIsInN0b3JhZ2UiLCJzZWVuIiwiU2V0IiwiaTEiLCJpMiIsImhhc2giLCJoYXMiLCJhZGQiLCJ3aXJlQnVmZmVyIiwiZHN0SW5kaWNlcyIsInVubG9jayIsIlBSSU1JVElWRV9MSU5FUyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFvQkEsSUFBSUEsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFVjtBQUNBLE1BQU1DLFlBQVksQ0FBQztBQUNmQyxFQUFBQSxXQUFXQSxHQUFHO0lBQ1YsSUFBSSxDQUFDQyxZQUFZLEVBQUUsQ0FBQTtBQUN2QixHQUFBO0FBRUFBLEVBQUFBLFlBQVlBLEdBQUc7QUFFWDtJQUNBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLEtBQUssQ0FBQTs7QUFFckI7SUFDQSxJQUFJLENBQUNDLGFBQWEsR0FBR0MsYUFBYSxDQUFBO0lBQ2xDLElBQUksQ0FBQ0MsWUFBWSxHQUFHRCxhQUFhLENBQUE7O0FBRWpDO0lBQ0EsSUFBSSxDQUFDRSxXQUFXLEdBQUcsQ0FBQyxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTs7QUFFbkI7SUFDQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBOztBQUVuQjtJQUNBLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsS0FBSyxDQUFBO0lBQ2pDLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsS0FBSyxDQUFBOztBQUUvQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxFQUFFLENBQUE7O0FBRWhDO0lBQ0EsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDQUMsRUFBQUEsa0JBQWtCQSxDQUFDQyxLQUFLLEVBQUVDLFFBQVEsRUFBRTtBQUVoQztBQUNBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FB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
