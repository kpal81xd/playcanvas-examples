import { Debug } from '../../core/debug.js';
import { path } from '../../core/path.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, INDEXFORMAT_UINT8, BUFFER_STATIC, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, SEMANTIC_COLOR, TYPE_UINT8, TYPE_UINT16, TYPE_FLOAT32, TYPE_UINT32, TYPE_INT32, TYPE_INT16, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { http } from '../../platform/net/http.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Light, lightTypes } from '../../scene/light.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { calculateNormals } from '../../scene/procedural.js';
import { Render } from '../../scene/render.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Entity } from '../entity.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../anim/constants.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { Asset } from '../asset/asset.js';
import { ABSOLUTE_URL } from '../asset/constants.js';
import { dracoDecode } from './draco-decoder.js';

// resources loaded from GLB file that the parser returns
class GlbResources {
  constructor() {
    this.gltf = void 0;
    this.nodes = void 0;
    this.scenes = void 0;
    this.animations = void 0;
    this.textures = void 0;
    this.materials = void 0;
    this.variants = void 0;
    this.meshVariants = void 0;
    this.meshDefaultMaterials = void 0;
    this.renders = void 0;
    this.skins = void 0;
    this.lights = void 0;
    this.cameras = void 0;
  }
  destroy() {
    // render needs to dec ref meshes
    if (this.renders) {
      this.renders.forEach(render => {
        render.meshes = null;
      });
    }
  }
}
const isDataURI = uri => {
  return /^data:.*,.*$/i.test(uri);
};
const getDataURIMimeType = uri => {
  return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'));
};
const getNumComponents = accessorType => {
  switch (accessorType) {
    case 'SCALAR':
      return 1;
    case 'VEC2':
      return 2;
    case 'VEC3':
      return 3;
    case 'VEC4':
      return 4;
    case 'MAT2':
      return 4;
    case 'MAT3':
      return 9;
    case 'MAT4':
      return 16;
    default:
      return 3;
  }
};
const getComponentType = componentType => {
  switch (componentType) {
    case 5120:
      return TYPE_INT8;
    case 5121:
      return TYPE_UINT8;
    case 5122:
      return TYPE_INT16;
    case 5123:
      return TYPE_UINT16;
    case 5124:
      return TYPE_INT32;
    case 5125:
      return TYPE_UINT32;
    case 5126:
      return TYPE_FLOAT32;
    default:
      return 0;
  }
};
const getComponentSizeInBytes = componentType => {
  switch (componentType) {
    case 5120:
      return 1;
    // int8
    case 5121:
      return 1;
    // uint8
    case 5122:
      return 2;
    // int16
    case 5123:
      return 2;
    // uint16
    case 5124:
      return 4;
    // int32
    case 5125:
      return 4;
    // uint32
    case 5126:
      return 4;
    // float32
    default:
      return 0;
  }
};
const getComponentDataType = componentType => {
  switch (componentType) {
    case 5120:
      return Int8Array;
    case 5121:
      return Uint8Array;
    case 5122:
      return Int16Array;
    case 5123:
      return Uint16Array;
    case 5124:
      return Int32Array;
    case 5125:
      return Uint32Array;
    case 5126:
      return Float32Array;
    default:
      return null;
  }
};
const gltfToEngineSemanticMap = {
  'POSITION': SEMANTIC_POSITION,
  'NORMAL': SEMANTIC_NORMAL,
  'TANGENT': SEMANTIC_TANGENT,
  'COLOR_0': SEMANTIC_COLOR,
  'JOINTS_0': SEMANTIC_BLENDINDICES,
  'WEIGHTS_0': SEMANTIC_BLENDWEIGHT,
  'TEXCOORD_0': SEMANTIC_TEXCOORD0,
  'TEXCOORD_1': SEMANTIC_TEXCOORD1,
  'TEXCOORD_2': SEMANTIC_TEXCOORD2,
  'TEXCOORD_3': SEMANTIC_TEXCOORD3,
  'TEXCOORD_4': SEMANTIC_TEXCOORD4,
  'TEXCOORD_5': SEMANTIC_TEXCOORD5,
  'TEXCOORD_6': SEMANTIC_TEXCOORD6,
  'TEXCOORD_7': SEMANTIC_TEXCOORD7
};

// order vertexDesc to match the rest of the engine
const attributeOrder = {
  [SEMANTIC_POSITION]: 0,
  [SEMANTIC_NORMAL]: 1,
  [SEMANTIC_TANGENT]: 2,
  [SEMANTIC_COLOR]: 3,
  [SEMANTIC_BLENDINDICES]: 4,
  [SEMANTIC_BLENDWEIGHT]: 5,
  [SEMANTIC_TEXCOORD0]: 6,
  [SEMANTIC_TEXCOORD1]: 7,
  [SEMANTIC_TEXCOORD2]: 8,
  [SEMANTIC_TEXCOORD3]: 9,
  [SEMANTIC_TEXCOORD4]: 10,
  [SEMANTIC_TEXCOORD5]: 11,
  [SEMANTIC_TEXCOORD6]: 12,
  [SEMANTIC_TEXCOORD7]: 13
};

// returns a function for dequantizing the data type
const getDequantizeFunc = srcType => {
  // see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
  switch (srcType) {
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
};

// dequantize an array of data
const dequantizeArray = (dstArray, srcArray, srcType) => {
  const convFunc = getDequantizeFunc(srcType);
  const len = srcArray.length;
  for (let i = 0; i < len; ++i) {
    dstArray[i] = convFunc(srcArray[i]);
  }
  return dstArray;
};

// get accessor data, making a copy and patching in the case of a sparse accessor
const getAccessorData = (gltfAccessor, bufferViews, flatten = false) => {
  const numComponents = getNumComponents(gltfAccessor.type);
  const dataType = getComponentDataType(gltfAccessor.componentType);
  if (!dataType) {
    return null;
  }
  let result;
  if (gltfAccessor.sparse) {
    // handle sparse data
    const sparse = gltfAccessor.sparse;

    // get indices data
    const indicesAccessor = {
      count: sparse.count,
      type: 'SCALAR'
    };
    const indices = getAccessorData(Object.assign(indicesAccessor, sparse.indices), bufferViews, true);

    // data values data
    const valuesAccessor = {
      count: sparse.count,
      type: gltfAccessor.type,
      componentType: gltfAccessor.componentType
    };
    const values = getAccessorData(Object.assign(valuesAccessor, sparse.values), bufferViews, true);

    // get base data
    if (gltfAccessor.hasOwnProperty('bufferView')) {
      const baseAccessor = {
        bufferView: gltfAccessor.bufferView,
        byteOffset: gltfAccessor.byteOffset,
        componentType: gltfAccessor.componentType,
        count: gltfAccessor.count,
        type: gltfAccessor.type
      };
      // make a copy of the base data since we'll patch the values
      result = getAccessorData(baseAccessor, bufferViews, true).slice();
    } else {
      // there is no base data, create empty 0'd out data
      result = new dataType(gltfAccessor.count * numComponents);
    }
    for (let i = 0; i < sparse.count; ++i) {
      const targetIndex = indices[i];
      for (let j = 0; j < numComponents; ++j) {
        result[targetIndex * numComponents + j] = values[i * numComponents + j];
      }
    }
  } else {
    if (gltfAccessor.hasOwnProperty("bufferView")) {
      const bufferView = bufferViews[gltfAccessor.bufferView];
      if (flatten && bufferView.hasOwnProperty('byteStride')) {
        // flatten stridden data
        const bytesPerElement = numComponents * dataType.BYTES_PER_ELEMENT;
        const storage = new ArrayBuffer(gltfAccessor.count * bytesPerElement);
        const tmpArray = new Uint8Array(storage);
        let dstOffset = 0;
        for (let i = 0; i < gltfAccessor.count; ++i) {
          // no need to add bufferView.byteOffset because accessor takes this into account
          let srcOffset = (gltfAccessor.byteOffset || 0) + i * bufferView.byteStride;
          for (let b = 0; b < bytesPerElement; ++b) {
            tmpArray[dstOffset++] = bufferView[srcOffset++];
          }
        }
        result = new dataType(storage);
      } else {
        result = new dataType(bufferView.buffer, bufferView.byteOffset + (gltfAccessor.byteOffset || 0), gltfAccessor.count * numComponents);
      }
    } else {
      result = new dataType(gltfAccessor.count * numComponents);
    }
  }
  return result;
};

// get accessor data as (unnormalized, unquantized) Float32 data
const getAccessorDataFloat32 = (gltfAccessor, bufferViews) => {
  const data = getAccessorData(gltfAccessor, bufferViews, true);
  if (data instanceof Float32Array || !gltfAccessor.normalized) {
    // if the source data is quantized (say to int16), but not normalized
    // then reading the values of the array is the same whether the values
    // are stored as float32 or int16. so probably no need to convert to
    // float32.
    return data;
  }
  const float32Data = new Float32Array(data.length);
  dequantizeArray(float32Data, data, getComponentType(gltfAccessor.componentType));
  return float32Data;
};

// returns a dequantized bounding box for the accessor
const getAccessorBoundingBox = gltfAccessor => {
  let min = gltfAccessor.min;
  let max = gltfAccessor.max;
  if (!min || !max) {
    return null;
  }
  if (gltfAccessor.normalized) {
    const ctype = getComponentType(gltfAccessor.componentType);
    min = dequantizeArray([], min, ctype);
    max = dequantizeArray([], max, ctype);
  }
  return new BoundingBox(new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
};
const getPrimitiveType = primitive => {
  if (!primitive.hasOwnProperty('mode')) {
    return PRIMITIVE_TRIANGLES;
  }
  switch (primitive.mode) {
    case 0:
      return PRIMITIVE_POINTS;
    case 1:
      return PRIMITIVE_LINES;
    case 2:
      return PRIMITIVE_LINELOOP;
    case 3:
      return PRIMITIVE_LINESTRIP;
    case 4:
      return PRIMITIVE_TRIANGLES;
    case 5:
      return PRIMITIVE_TRISTRIP;
    case 6:
      return PRIMITIVE_TRIFAN;
    default:
      return PRIMITIVE_TRIANGLES;
  }
};
const generateIndices = numVertices => {
  const dummyIndices = new Uint16Array(numVertices);
  for (let i = 0; i < numVertices; i++) {
    dummyIndices[i] = i;
  }
  return dummyIndices;
};
const generateNormals = (sourceDesc, indices) => {
  // get positions
  const p = sourceDesc[SEMANTIC_POSITION];
  if (!p || p.components !== 3) {
    return;
  }
  let positions;
  if (p.size !== p.stride) {
    // extract positions which aren't tightly packed
    const srcStride = p.stride / typedArrayTypesByteSize[p.type];
    const src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
    positions = new typedArrayTypes[p.type](p.count * 3);
    for (let i = 0; i < p.count; ++i) {
      positions[i * 3 + 0] = src[i * srcStride + 0];
      positions[i * 3 + 1] = src[i * srcStride + 1];
      positions[i * 3 + 2] = src[i * srcStride + 2];
    }
  } else {
    // position data is tightly packed so we can use it directly
    positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
  }
  const numVertices = p.count;

  // generate indices if necessary
  if (!indices) {
    indices = generateIndices(numVertices);
  }

  // generate normals
  const normalsTemp = calculateNormals(positions, indices);
  const normals = new Float32Array(normalsTemp.length);
  normals.set(normalsTemp);
  sourceDesc[SEMANTIC_NORMAL] = {
    buffer: normals.buffer,
    size: 12,
    offset: 0,
    stride: 12,
    count: numVertices,
    components: 3,
    type: TYPE_FLOAT32
  };
};
const flipTexCoordVs = vertexBuffer => {
  let i, j;
  const floatOffsets = [];
  const shortOffsets = [];
  const byteOffsets = [];
  for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
    const element = vertexBuffer.format.elements[i];
    if (element.name === SEMANTIC_TEXCOORD0 || element.name === SEMANTIC_TEXCOORD1) {
      switch (element.dataType) {
        case TYPE_FLOAT32:
          floatOffsets.push({
            offset: element.offset / 4 + 1,
            stride: element.stride / 4
          });
          break;
        case TYPE_UINT16:
          shortOffsets.push({
            offset: element.offset / 2 + 1,
            stride: element.stride / 2
          });
          break;
        case TYPE_UINT8:
          byteOffsets.push({
            offset: element.offset + 1,
            stride: element.stride
          });
          break;
      }
    }
  }
  const flip = (offsets, type, one) => {
    const typedArray = new type(vertexBuffer.storage);
    for (i = 0; i < offsets.length; ++i) {
      let index = offsets[i].offset;
      const stride = offsets[i].stride;
      for (j = 0; j < vertexBuffer.numVertices; ++j) {
        typedArray[index] = one - typedArray[index];
        index += stride;
      }
    }
  };
  if (floatOffsets.length > 0) {
    flip(floatOffsets, Float32Array, 1.0);
  }
  if (shortOffsets.length > 0) {
    flip(shortOffsets, Uint16Array, 65535);
  }
  if (byteOffsets.length > 0) {
    flip(byteOffsets, Uint8Array, 255);
  }
};

// given a texture, clone it
// NOTE: CPU-side texture data will be shared but GPU memory will be duplicated
const cloneTexture = texture => {
  const shallowCopyLevels = texture => {
    const result = [];
    for (let mip = 0; mip < texture._levels.length; ++mip) {
      let level = [];
      if (texture.cubemap) {
        for (let face = 0; face < 6; ++face) {
          level.push(texture._levels[mip][face]);
        }
      } else {
        level = texture._levels[mip];
      }
      result.push(level);
    }
    return result;
  };
  const result = new Texture(texture.device, texture); // duplicate texture
  result._levels = shallowCopyLevels(texture); // shallow copy the levels structure
  return result;
};

// given a texture asset, clone it
const cloneTextureAsset = src => {
  const result = new Asset(src.name + '_clone', src.type, src.file, src.data, src.options);
  result.loaded = true;
  result.resource = cloneTexture(src.resource);
  src.registry.add(result);
  return result;
};
const createVertexBufferInternal = (device, sourceDesc, flipV) => {
  const positionDesc = sourceDesc[SEMANTIC_POSITION];
  if (!positionDesc) {
    // ignore meshes without positions
    return null;
  }
  const numVertices = positionDesc.count;

  // generate vertexDesc elements
  const vertexDesc = [];
  for (const semantic in sourceDesc) {
    if (sourceDesc.hasOwnProperty(semantic)) {
      const element = {
        semantic: semantic,
        components: sourceDesc[semantic].components,
        type: sourceDesc[semantic].type,
        normalize: !!sourceDesc[semantic].normalize
      };
      if (!VertexFormat.isElementValid(device, element)) {
        // WebGP does not support some formats and we need to remap it to one larger, for example int16x3 -> int16x4
        // TODO: this might need the actual data changes if this element is the last one in the vertex, as it might
        // try to read outside of the vertex buffer.
        element.components++;
      }
      vertexDesc.push(element);
    }
  }

  // sort vertex elements by engine-ideal order
  vertexDesc.sort((lhs, rhs) => {
    return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
  });
  let i, j, k;
  let source, target, sourceOffset;
  const vertexFormat = new VertexFormat(device, vertexDesc);

  // check whether source data is correctly interleaved
  let isCorrectlyInterleaved = true;
  for (i = 0; i < vertexFormat.elements.length; ++i) {
    target = vertexFormat.elements[i];
    source = sourceDesc[target.name];
    sourceOffset = source.offset - positionDesc.offset;
    if (source.buffer !== positionDesc.buffer || source.stride !== target.stride || source.size !== target.size || sourceOffset !== target.offset) {
      isCorrectlyInterleaved = false;
      break;
    }
  }

  // create vertex buffer
  const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC);
  const vertexData = vertexBuffer.lock();
  const targetArray = new Uint32Array(vertexData);
  let sourceArray;
  if (isCorrectlyInterleaved) {
    // copy data
    sourceArray = new Uint32Array(positionDesc.buffer, positionDesc.offset, numVertices * vertexBuffer.format.size / 4);
    targetArray.set(sourceArray);
  } else {
    let targetStride, sourceStride;
    // copy data and interleave
    for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
      target = vertexBuffer.format.elements[i];
      targetStride = target.stride / 4;
      source = sourceDesc[target.name];
      sourceStride = source.stride / 4;
      // ensure we don't go beyond the end of the arraybuffer when dealing with
      // interlaced vertex formats
      sourceArray = new Uint32Array(source.buffer, source.offset, (source.count - 1) * sourceStride + (source.size + 3) / 4);
      let src = 0;
      let dst = target.offset / 4;
      const kend = Math.floor((source.size + 3) / 4);
      for (j = 0; j < numVertices; ++j) {
        for (k = 0; k < kend; ++k) {
          targetArray[dst + k] = sourceArray[src + k];
        }
        src += sourceStride;
        dst += targetStride;
      }
    }
  }
  if (flipV) {
    flipTexCoordVs(vertexBuffer);
  }
  vertexBuffer.unlock();
  return vertexBuffer;
};
const createVertexBuffer = (device, attributes, indices, accessors, bufferViews, flipV, vertexBufferDict) => {
  // extract list of attributes to use
  const useAttributes = {};
  const attribIds = [];
  for (const attrib in attributes) {
    if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
      useAttributes[attrib] = attributes[attrib];

      // build unique id for each attribute in format: Semantic:accessorIndex
      attribIds.push(attrib + ':' + attributes[attrib]);
    }
  }

  // sort unique ids and create unique vertex buffer ID
  attribIds.sort();
  const vbKey = attribIds.join();

  // return already created vertex buffer if identical
  let vb = vertexBufferDict[vbKey];
  if (!vb) {
    // build vertex buffer format desc and source
    const sourceDesc = {};
    for (const attrib in useAttributes) {
      const accessor = accessors[attributes[attrib]];
      const accessorData = getAccessorData(accessor, bufferViews);
      const bufferView = bufferViews[accessor.bufferView];
      const semantic = gltfToEngineSemanticMap[attrib];
      const size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
      const stride = bufferView && bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
      sourceDesc[semantic] = {
        buffer: accessorData.buffer,
        size: size,
        offset: accessorData.byteOffset,
        stride: stride,
        count: accessor.count,
        components: getNumComponents(accessor.type),
        type: getComponentType(accessor.componentType),
        normalize: accessor.normalized
      };
    }

    // generate normals if they're missing (this should probably be a user option)
    if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
      generateNormals(sourceDesc, indices);
    }

    // create and store it in the dictionary
    vb = createVertexBufferInternal(device, sourceDesc, flipV);
    vertexBufferDict[vbKey] = vb;
  }
  return vb;
};
const createSkin = (device, gltfSkin, accessors, bufferViews, nodes, glbSkins) => {
  let i, j, bindMatrix;
  const joints = gltfSkin.joints;
  const numJoints = joints.length;
  const ibp = [];
  if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
    const inverseBindMatrices = gltfSkin.inverseBindMatrices;
    const ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews, true);
    const ibmValues = [];
    for (i = 0; i < numJoints; i++) {
      for (j = 0; j < 16; j++) {
        ibmValues[j] = ibmData[i * 16 + j];
      }
      bindMatrix = new Mat4();
      bindMatrix.set(ibmValues);
      ibp.push(bindMatrix);
    }
  } else {
    for (i = 0; i < numJoints; i++) {
      bindMatrix = new Mat4();
      ibp.push(bindMatrix);
    }
  }
  const boneNames = [];
  for (i = 0; i < numJoints; i++) {
    boneNames[i] = nodes[joints[i]].name;
  }

  // create a cache key from bone names and see if we have matching skin
  const key = boneNames.join('#');
  let skin = glbSkins.get(key);
  if (!skin) {
    // create the skin and add it to the cache
    skin = new Skin(device, ibp, boneNames);
    glbSkins.set(key, skin);
  }
  return skin;
};
const createDracoMesh = (device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises) => {
  var _primitive$extensions;
  // create the mesh
  const result = new Mesh(device);
  result.aabb = getAccessorBoundingBox(accessors[primitive.attributes.POSITION]);

  // create vertex description
  const vertexDesc = [];
  for (const [name, index] of Object.entries(primitive.attributes)) {
    var _accessor$normalized;
    const accessor = accessors[index];
    const semantic = gltfToEngineSemanticMap[name];
    const componentType = getComponentType(accessor.componentType);
    vertexDesc.push({
      semantic: semantic,
      components: getNumComponents(accessor.type),
      type: componentType,
      normalize: (_accessor$normalized = accessor.normalized) != null ? _accessor$normalized : semantic === SEMANTIC_COLOR && (componentType === TYPE_UINT8 || componentType === TYPE_UINT16)
    });
  }
  promises.push(new Promise((resolve, reject) => {
    // decode draco data
    const dracoExt = primitive.extensions.KHR_draco_mesh_compression;
    dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        var _primitive$attributes;
        // worker reports order of attributes as array of attribute unique_id
        const order = {};
        for (const [name, index] of Object.entries(dracoExt.attributes)) {
          order[gltfToEngineSemanticMap[name]] = decompressedData.attributes.indexOf(index);
        }

        // order vertexDesc
        vertexDesc.sort((a, b) => {
          return order[a.semantic] - order[b.semantic];
        });

        // draco decompressor will generate normals if they are missing
        if (!((_primitive$attributes = primitive.attributes) != null && _primitive$attributes.NORMAL)) {
          vertexDesc.splice(1, 0, {
            semantic: 'NORMAL',
            components: 3,
            type: TYPE_FLOAT32
          });
        }
        const vertexFormat = new VertexFormat(device, vertexDesc);

        // create vertex buffer
        const numVertices = decompressedData.vertices.byteLength / vertexFormat.size;
        const indexFormat = numVertices <= 65535 ? INDEXFORMAT_UINT16 : INDEXFORMAT_UINT32;
        const numIndices = decompressedData.indices.byteLength / (numVertices <= 65535 ? 2 : 4);
        Debug.call(() => {
          if (numVertices !== accessors[primitive.attributes.POSITION].count) {
            Debug.warn('mesh has invalid vertex count');
          }
          if (numIndices !== accessors[primitive.indices].count) {
            Debug.warn('mesh has invalid index count');
          }
        });
        const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC, decompressedData.vertices);
        const indexBuffer = new IndexBuffer(device, indexFormat, numIndices, BUFFER_STATIC, decompressedData.indices);
        result.vertexBuffer = vertexBuffer;
        result.indexBuffer[0] = indexBuffer;
        result.primitive[0].type = getPrimitiveType(primitive);
        result.primitive[0].base = 0;
        result.primitive[0].count = indexBuffer ? numIndices : numVertices;
        result.primitive[0].indexed = !!indexBuffer;
        resolve();
      }
    });
  }));

  // handle material variants
  if (primitive != null && (_primitive$extensions = primitive.extensions) != null && _primitive$extensions.KHR_materials_variants) {
    const variants = primitive.extensions.KHR_materials_variants;
    const tempMapping = {};
    variants.mappings.forEach(mapping => {
      mapping.variants.forEach(variant => {
        tempMapping[variant] = mapping.material;
      });
    });
    meshVariants[result.id] = tempMapping;
  }
  meshDefaultMaterials[result.id] = primitive.material;
  return result;
};
const createMesh = (device, gltfMesh, accessors, bufferViews, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, assetOptions, promises) => {
  const meshes = [];
  gltfMesh.primitives.forEach(primitive => {
    var _primitive$extensions2;
    if ((_primitive$extensions2 = primitive.extensions) != null && _primitive$extensions2.KHR_draco_mesh_compression) {
      // handle draco compressed mesh
      meshes.push(createDracoMesh(device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises));
    } else {
      // handle uncompressed mesh
      let indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
      const vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, flipV, vertexBufferDict);
      const primitiveType = getPrimitiveType(primitive);

      // build the mesh
      const mesh = new Mesh(device);
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = primitiveType;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].indexed = indices !== null;

      // index buffer
      if (indices !== null) {
        let indexFormat;
        if (indices instanceof Uint8Array) {
          indexFormat = INDEXFORMAT_UINT8;
        } else if (indices instanceof Uint16Array) {
          indexFormat = INDEXFORMAT_UINT16;
        } else {
          indexFormat = INDEXFORMAT_UINT32;
        }

        // 32bit index buffer is used but not supported
        if (indexFormat === INDEXFORMAT_UINT32 && !device.extUintElement) {
          if (vertexBuffer.numVertices > 0xFFFF) {
            console.warn('Glb file contains 32bit index buffer but these are not supported by this device - it may be rendered incorrectly.');
          }

          // convert to 16bit
          indexFormat = INDEXFORMAT_UINT16;
          indices = new Uint16Array(indices);
        }
        if (indexFormat === INDEXFORMAT_UINT8 && device.isWebGPU) {
          Debug.warn('Glb file contains 8bit index buffer but these are not supported by WebGPU - converting to 16bit.');

          // convert to 16bit
          indexFormat = INDEXFORMAT_UINT16;
          indices = new Uint16Array(indices);
        }
        const indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
        mesh.indexBuffer[0] = indexBuffer;
        mesh.primitive[0].count = indices.length;
      } else {
        mesh.primitive[0].count = vertexBuffer.numVertices;
      }
      if (primitive.hasOwnProperty("extensions") && primitive.extensions.hasOwnProperty("KHR_materials_variants")) {
        const variants = primitive.extensions.KHR_materials_variants;
        const tempMapping = {};
        variants.mappings.forEach(mapping => {
          mapping.variants.forEach(variant => {
            tempMapping[variant] = mapping.material;
          });
        });
        meshVariants[mesh.id] = tempMapping;
      }
      meshDefaultMaterials[mesh.id] = primitive.material;
      let accessor = accessors[primitive.attributes.POSITION];
      mesh.aabb = getAccessorBoundingBox(accessor);

      // morph targets
      if (primitive.hasOwnProperty('targets')) {
        const targets = [];
        primitive.targets.forEach((target, index) => {
          const options = {};
          if (target.hasOwnProperty('POSITION')) {
            accessor = accessors[target.POSITION];
            options.deltaPositions = getAccessorDataFloat32(accessor, bufferViews);
            options.deltaPositionsType = TYPE_FLOAT32;
            options.aabb = getAccessorBoundingBox(accessor);
          }
          if (target.hasOwnProperty('NORMAL')) {
            accessor = accessors[target.NORMAL];
            // NOTE: the morph targets can't currently accept quantized normals
            options.deltaNormals = getAccessorDataFloat32(accessor, bufferViews);
            options.deltaNormalsType = TYPE_FLOAT32;
          }

          // name if specified
          if (gltfMesh.hasOwnProperty('extras') && gltfMesh.extras.hasOwnProperty('targetNames')) {
            options.name = gltfMesh.extras.targetNames[index];
          } else {
            options.name = index.toString(10);
          }

          // default weight if specified
          if (gltfMesh.hasOwnProperty('weights')) {
            options.defaultWeight = gltfMesh.weights[index];
          }
          options.preserveData = assetOptions.morphPreserveData;
          targets.push(new MorphTarget(options));
        });
        mesh.morph = new Morph(targets, device, {
          preferHighPrecision: assetOptions.morphPreferHighPrecision
        });
      }
      meshes.push(mesh);
    }
  });
  return meshes;
};
const extractTextureTransform = (source, material, maps) => {
  var _source$extensions;
  let map;
  const texCoord = source.texCoord;
  if (texCoord) {
    for (map = 0; map < maps.length; ++map) {
      material[maps[map] + 'MapUv'] = texCoord;
    }
  }
  const zeros = [0, 0];
  const ones = [1, 1];
  const textureTransform = (_source$extensions = source.extensions) == null ? void 0 : _source$extensions.KHR_texture_transform;
  if (textureTransform) {
    const offset = textureTransform.offset || zeros;
    const scale = textureTransform.scale || ones;
    const rotation = textureTransform.rotation ? -textureTransform.rotation * math.RAD_TO_DEG : 0;
    const tilingVec = new Vec2(scale[0], scale[1]);
    const offsetVec = new Vec2(offset[0], 1.0 - scale[1] - offset[1]);
    for (map = 0; map < maps.length; ++map) {
      material[`${maps[map]}MapTiling`] = tilingVec;
      material[`${maps[map]}MapOffset`] = offsetVec;
      material[`${maps[map]}MapRotation`] = rotation;
    }
  }
};
const extensionPbrSpecGlossiness = (data, material, textures) => {
  let color, texture;
  if (data.hasOwnProperty('diffuseFactor')) {
    color = data.diffuseFactor;
    // Convert from linear space to sRGB space
    material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
    material.opacity = color[3];
  } else {
    material.diffuse.set(1, 1, 1);
    material.opacity = 1;
  }
  if (data.hasOwnProperty('diffuseTexture')) {
    const diffuseTexture = data.diffuseTexture;
    texture = textures[diffuseTexture.index];
    material.diffuseMap = texture;
    material.diffuseMapChannel = 'rgb';
    material.opacityMap = texture;
    material.opacityMapChannel = 'a';
    extractTextureTransform(diffuseTexture, material, ['diffuse', 'opacity']);
  }
  material.useMetalness = false;
  if (data.hasOwnProperty('specularFactor')) {
    color = data.specularFactor;
    // Convert from linear space to sRGB space
    material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.specular.set(1, 1, 1);
  }
  if (data.hasOwnProperty('glossinessFactor')) {
    material.gloss = data.glossinessFactor;
  } else {
    material.gloss = 1.0;
  }
  if (data.hasOwnProperty('specularGlossinessTexture')) {
    const specularGlossinessTexture = data.specularGlossinessTexture;
    material.specularEncoding = 'srgb';
    material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
    material.specularMapChannel = 'rgb';
    material.glossMapChannel = 'a';
    extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
  }
};
const extensionClearCoat = (data, material, textures) => {
  if (data.hasOwnProperty('clearcoatFactor')) {
    material.clearCoat = data.clearcoatFactor * 0.25; // TODO: remove temporary workaround for replicating glTF clear-coat visuals
  } else {
    material.clearCoat = 0;
  }
  if (data.hasOwnProperty('clearcoatTexture')) {
    const clearcoatTexture = data.clearcoatTexture;
    material.clearCoatMap = textures[clearcoatTexture.index];
    material.clearCoatMapChannel = 'r';
    extractTextureTransform(clearcoatTexture, material, ['clearCoat']);
  }
  if (data.hasOwnProperty('clearcoatRoughnessFactor')) {
    material.clearCoatGloss = data.clearcoatRoughnessFactor;
  } else {
    material.clearCoatGloss = 0;
  }
  if (data.hasOwnProperty('clearcoatRoughnessTexture')) {
    const clearcoatRoughnessTexture = data.clearcoatRoughnessTexture;
    material.clearCoatGlossMap = textures[clearcoatRoughnessTexture.index];
    material.clearCoatGlossMapChannel = 'g';
    extractTextureTransform(clearcoatRoughnessTexture, material, ['clearCoatGloss']);
  }
  if (data.hasOwnProperty('clearcoatNormalTexture')) {
    const clearcoatNormalTexture = data.clearcoatNormalTexture;
    material.clearCoatNormalMap = textures[clearcoatNormalTexture.index];
    extractTextureTransform(clearcoatNormalTexture, material, ['clearCoatNormal']);
    if (clearcoatNormalTexture.hasOwnProperty('scale')) {
      material.clearCoatBumpiness = clearcoatNormalTexture.scale;
    }
  }
  material.clearCoatGlossInvert = true;
};
const extensionUnlit = (data, material, textures) => {
  material.useLighting = false;

  // copy diffuse into emissive
  material.emissive.copy(material.diffuse);
  material.emissiveTint = material.diffuseTint;
  material.emissiveMap = material.diffuseMap;
  material.emissiveMapUv = material.diffuseMapUv;
  material.emissiveMapTiling.copy(material.diffuseMapTiling);
  material.emissiveMapOffset.copy(material.diffuseMapOffset);
  material.emissiveMapRotation = material.diffuseMapRotation;
  material.emissiveMapChannel = material.diffuseMapChannel;
  material.emissiveVertexColor = material.diffuseVertexColor;
  material.emissiveVertexColorChannel = material.diffuseVertexColorChannel;

  // disable lighting and skybox
  material.useLighting = false;
  material.useSkybox = false;

  // blank diffuse
  material.diffuse.set(0, 0, 0);
  material.diffuseTint = false;
  material.diffuseMap = null;
  material.diffuseVertexColor = false;
};
const extensionSpecular = (data, material, textures) => {
  material.useMetalnessSpecularColor = true;
  if (data.hasOwnProperty('specularColorTexture')) {
    material.specularEncoding = 'srgb';
    material.specularMap = textures[data.specularColorTexture.index];
    material.specularMapChannel = 'rgb';
    extractTextureTransform(data.specularColorTexture, material, ['specular']);
  }
  if (data.hasOwnProperty('specularColorFactor')) {
    const color = data.specularColorFactor;
    material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.specular.set(1, 1, 1);
  }
  if (data.hasOwnProperty('specularFactor')) {
    material.specularityFactor = data.specularFactor;
  } else {
    material.specularityFactor = 1;
  }
  if (data.hasOwnProperty('specularTexture')) {
    material.specularityFactorMapChannel = 'a';
    material.specularityFactorMap = textures[data.specularTexture.index];
    extractTextureTransform(data.specularTexture, material, ['specularityFactor']);
  }
};
const extensionIor = (data, material, textures) => {
  if (data.hasOwnProperty('ior')) {
    material.refractionIndex = 1.0 / data.ior;
  }
};
const extensionTransmission = (data, material, textures) => {
  material.blendType = BLEND_NORMAL;
  material.useDynamicRefraction = true;
  if (data.hasOwnProperty('transmissionFactor')) {
    material.refraction = data.transmissionFactor;
  }
  if (data.hasOwnProperty('transmissionTexture')) {
    material.refractionMapChannel = 'r';
    material.refractionMap = textures[data.transmissionTexture.index];
    extractTextureTransform(data.transmissionTexture, material, ['refraction']);
  }
};
const extensionSheen = (data, material, textures) => {
  material.useSheen = true;
  if (data.hasOwnProperty('sheenColorFactor')) {
    const color = data.sheenColorFactor;
    material.sheen.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.sheen.set(1, 1, 1);
  }
  if (data.hasOwnProperty('sheenColorTexture')) {
    material.sheenMap = textures[data.sheenColorTexture.index];
    material.sheenEncoding = 'srgb';
    extractTextureTransform(data.sheenColorTexture, material, ['sheen']);
  }
  if (data.hasOwnProperty('sheenRoughnessFactor')) {
    material.sheenGloss = data.sheenRoughnessFactor;
  } else {
    material.sheenGloss = 0.0;
  }
  if (data.hasOwnProperty('sheenRoughnessTexture')) {
    material.sheenGlossMap = textures[data.sheenRoughnessTexture.index];
    material.sheenGlossMapChannel = 'a';
    extractTextureTransform(data.sheenRoughnessTexture, material, ['sheenGloss']);
  }
  material.sheenGlossInvert = true;
};
const extensionVolume = (data, material, textures) => {
  material.blendType = BLEND_NORMAL;
  material.useDynamicRefraction = true;
  if (data.hasOwnProperty('thicknessFactor')) {
    material.thickness = data.thicknessFactor;
  }
  if (data.hasOwnProperty('thicknessTexture')) {
    material.thicknessMap = textures[data.thicknessTexture.index];
    material.thicknessMapChannel = 'g';
    extractTextureTransform(data.thicknessTexture, material, ['thickness']);
  }
  if (data.hasOwnProperty('attenuationDistance')) {
    material.attenuationDistance = data.attenuationDistance;
  }
  if (data.hasOwnProperty('attenuationColor')) {
    const color = data.attenuationColor;
    material.attenuation.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  }
};
const extensionEmissiveStrength = (data, material, textures) => {
  if (data.hasOwnProperty('emissiveStrength')) {
    material.emissiveIntensity = data.emissiveStrength;
  }
};
const extensionIridescence = (data, material, textures) => {
  material.useIridescence = true;
  if (data.hasOwnProperty('iridescenceFactor')) {
    material.iridescence = data.iridescenceFactor;
  }
  if (data.hasOwnProperty('iridescenceTexture')) {
    material.iridescenceMapChannel = 'r';
    material.iridescenceMap = textures[data.iridescenceTexture.index];
    extractTextureTransform(data.iridescenceTexture, material, ['iridescence']);
  }
  if (data.hasOwnProperty('iridescenceIor')) {
    material.iridescenceRefractionIndex = data.iridescenceIor;
  }
  if (data.hasOwnProperty('iridescenceThicknessMinimum')) {
    material.iridescenceThicknessMin = data.iridescenceThicknessMinimum;
  }
  if (data.hasOwnProperty('iridescenceThicknessMaximum')) {
    material.iridescenceThicknessMax = data.iridescenceThicknessMaximum;
  }
  if (data.hasOwnProperty('iridescenceThicknessTexture')) {
    material.iridescenceThicknessMapChannel = 'g';
    material.iridescenceThicknessMap = textures[data.iridescenceThicknessTexture.index];
    extractTextureTransform(data.iridescenceThicknessTexture, material, ['iridescenceThickness']);
  }
};
const createMaterial = (gltfMaterial, textures, flipV) => {
  const material = new StandardMaterial();

  // glTF doesn't define how to occlude specular
  material.occludeSpecular = SPECOCC_AO;
  material.diffuseTint = true;
  material.diffuseVertexColor = true;
  material.specularTint = true;
  material.specularVertexColor = true;
  if (gltfMaterial.hasOwnProperty('name')) {
    material.name = gltfMaterial.name;
  }
  let color, texture;
  if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
    const pbrData = gltfMaterial.pbrMetallicRoughness;
    if (pbrData.hasOwnProperty('baseColorFactor')) {
      color = pbrData.baseColorFactor;
      // Convert from linear space to sRGB space
      material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
      material.opacity = color[3];
    } else {
      material.diffuse.set(1, 1, 1);
      material.opacity = 1;
    }
    if (pbrData.hasOwnProperty('baseColorTexture')) {
      const baseColorTexture = pbrData.baseColorTexture;
      texture = textures[baseColorTexture.index];
      material.diffuseMap = texture;
      material.diffuseMapChannel = 'rgb';
      material.opacityMap = texture;
      material.opacityMapChannel = 'a';
      extractTextureTransform(baseColorTexture, material, ['diffuse', 'opacity']);
    }
    material.useMetalness = true;
    material.specular.set(1, 1, 1);
    if (pbrData.hasOwnProperty('metallicFactor')) {
      material.metalness = pbrData.metallicFactor;
    } else {
      material.metalness = 1;
    }
    if (pbrData.hasOwnProperty('roughnessFactor')) {
      material.gloss = pbrData.roughnessFactor;
    } else {
      material.gloss = 1;
    }
    material.glossInvert = true;
    if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
      const metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
      material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
      material.metalnessMapChannel = 'b';
      material.glossMapChannel = 'g';
      extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
    }
  }
  if (gltfMaterial.hasOwnProperty('normalTexture')) {
    const normalTexture = gltfMaterial.normalTexture;
    material.normalMap = textures[normalTexture.index];
    extractTextureTransform(normalTexture, material, ['normal']);
    if (normalTexture.hasOwnProperty('scale')) {
      material.bumpiness = normalTexture.scale;
    }
  }
  if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
    const occlusionTexture = gltfMaterial.occlusionTexture;
    material.aoMap = textures[occlusionTexture.index];
    material.aoMapChannel = 'r';
    extractTextureTransform(occlusionTexture, material, ['ao']);
    // TODO: support 'strength'
  }

  if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
    color = gltfMaterial.emissiveFactor;
    // Convert from linear space to sRGB space
    material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
    material.emissiveTint = true;
  } else {
    material.emissive.set(0, 0, 0);
    material.emissiveTint = false;
  }
  if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
    const emissiveTexture = gltfMaterial.emissiveTexture;
    material.emissiveMap = textures[emissiveTexture.index];
    extractTextureTransform(emissiveTexture, material, ['emissive']);
  }
  if (gltfMaterial.hasOwnProperty('alphaMode')) {
    switch (gltfMaterial.alphaMode) {
      case 'MASK':
        material.blendType = BLEND_NONE;
        if (gltfMaterial.hasOwnProperty('alphaCutoff')) {
          material.alphaTest = gltfMaterial.alphaCutoff;
        } else {
          material.alphaTest = 0.5;
        }
        break;
      case 'BLEND':
        material.blendType = BLEND_NORMAL;

        // note: by default don't write depth on semitransparent materials
        material.depthWrite = false;
        break;
      default:
      case 'OPAQUE':
        material.blendType = BLEND_NONE;
        break;
    }
  } else {
    material.blendType = BLEND_NONE;
  }
  if (gltfMaterial.hasOwnProperty('doubleSided')) {
    material.twoSidedLighting = gltfMaterial.doubleSided;
    material.cull = gltfMaterial.doubleSided ? CULLFACE_NONE : CULLFACE_BACK;
  } else {
    material.twoSidedLighting = false;
    material.cull = CULLFACE_BACK;
  }

  // Provide list of supported extensions and their functions
  const extensions = {
    "KHR_materials_clearcoat": extensionClearCoat,
    "KHR_materials_emissive_strength": extensionEmissiveStrength,
    "KHR_materials_ior": extensionIor,
    "KHR_materials_iridescence": extensionIridescence,
    "KHR_materials_pbrSpecularGlossiness": extensionPbrSpecGlossiness,
    "KHR_materials_sheen": extensionSheen,
    "KHR_materials_specular": extensionSpecular,
    "KHR_materials_transmission": extensionTransmission,
    "KHR_materials_unlit": extensionUnlit,
    "KHR_materials_volume": extensionVolume
  };

  // Handle extensions
  if (gltfMaterial.hasOwnProperty('extensions')) {
    for (const key in gltfMaterial.extensions) {
      const extensionFunc = extensions[key];
      if (extensionFunc !== undefined) {
        extensionFunc(gltfMaterial.extensions[key], material, textures);
      }
    }
  }
  material.update();
  return material;
};

// create the anim structure
const createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) => {
  // create animation data block for the accessor
  const createAnimData = gltfAccessor => {
    return new AnimData(getNumComponents(gltfAccessor.type), getAccessorDataFloat32(gltfAccessor, bufferViews));
  };
  const interpMap = {
    'STEP': INTERPOLATION_STEP,
    'LINEAR': INTERPOLATION_LINEAR,
    'CUBICSPLINE': INTERPOLATION_CUBIC
  };

  // Input and output maps reference data by sampler input/output key.
  const inputMap = {};
  const outputMap = {};
  // The curve map stores temporary curve data by sampler index. Each curves input/output value will be resolved to an inputs/outputs array index after all samplers have been processed.
  // Curves and outputs that are deleted from their maps will not be included in the final AnimTrack
  const curveMap = {};
  let outputCounter = 1;
  let i;

  // convert samplers
  for (i = 0; i < gltfAnimation.samplers.length; ++i) {
    const sampler = gltfAnimation.samplers[i];

    // get input data
    if (!inputMap.hasOwnProperty(sampler.input)) {
      inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
    }

    // get output data
    if (!outputMap.hasOwnProperty(sampler.output)) {
      outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
    }
    const interpolation = sampler.hasOwnProperty('interpolation') && interpMap.hasOwnProperty(sampler.interpolation) ? interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

    // create curve
    const curve = {
      paths: [],
      input: sampler.input,
      output: sampler.output,
      interpolation: interpolation
    };
    curveMap[i] = curve;
  }
  const quatArrays = [];
  const transformSchema = {
    'translation': 'localPosition',
    'rotation': 'localRotation',
    'scale': 'localScale'
  };
  const constructNodePath = node => {
    const path = [];
    while (node) {
      path.unshift(node.name);
      node = node.parent;
    }
    return path;
  };

  // All morph targets are included in a single channel of the animation, with all targets output data interleaved with each other.
  // This function splits each morph target out into it a curve with its own output data, allowing us to animate each morph target independently by name.
  const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
    const out = outputMap[curve.output];
    if (!out) {
      Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
      return;
    }

    // names of morph targets
    let targetNames;
    if (meshes && meshes[gltfNode.mesh]) {
      const mesh = meshes[gltfNode.mesh];
      if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames')) {
        targetNames = mesh.extras.targetNames;
      }
    }
    const outData = out.data;
    const morphTargetCount = outData.length / inputMap[curve.input].data.length;
    const keyframeCount = outData.length / morphTargetCount;

    // single array buffer for all keys, 4 bytes per entry
    const singleBufferSize = keyframeCount * 4;
    const buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);
    for (let j = 0; j < morphTargetCount; j++) {
      var _targetNames;
      const morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);

      // the output data for all morph targets in a single curve is interleaved. We need to retrieve the keyframe output data for a single morph target
      for (let k = 0; k < keyframeCount; k++) {
        morphTargetOutput[k] = outData[k * morphTargetCount + j];
      }
      const output = new AnimData(1, morphTargetOutput);
      const weightName = (_targetNames = targetNames) != null && _targetNames[j] ? `name.${targetNames[j]}` : j;

      // add the individual morph target output data to the outputMap using a negative value key (so as not to clash with sampler.output values)
      outputMap[-outputCounter] = output;
      const morphCurve = {
        paths: [{
          entityPath: entityPath,
          component: 'graph',
          propertyPath: [`weight.${weightName}`]
        }],
        // each morph target curve input can use the same sampler.input from the channel they were all in
        input: curve.input,
        // but each morph target curve should reference its individual output that was just created
        output: -outputCounter,
        interpolation: curve.interpolation
      };
      outputCounter++;
      // add the morph target curve to the curveMap
      curveMap[`morphCurve-${i}-${j}`] = morphCurve;
    }
  };

  // convert anim channels
  for (i = 0; i < gltfAnimation.channels.length; ++i) {
    const channel = gltfAnimation.channels[i];
    const target = channel.target;
    const curve = curveMap[channel.sampler];
    const node = nodes[target.node];
    const gltfNode = gltfNodes[target.node];
    const entityPath = constructNodePath(node);
    if (target.path.startsWith('weights')) {
      createMorphTargetCurves(curve, gltfNode, entityPath);
      // as all individual morph targets in this morph curve have their own curve now, this morph curve should be flagged
      // so it's not included in the final output
      curveMap[channel.sampler].morphCurve = true;
    } else {
      curve.paths.push({
        entityPath: entityPath,
        component: 'graph',
        propertyPath: [transformSchema[target.path]]
      });
    }
  }
  const inputs = [];
  const outputs = [];
  const curves = [];

  // Add each input in the map to the final inputs array. The inputMap should now reference the index of input in the inputs array instead of the input itself.
  for (const inputKey in inputMap) {
    inputs.push(inputMap[inputKey]);
    inputMap[inputKey] = inputs.length - 1;
  }
  // Add each output in the map to the final outputs array. The outputMap should now reference the index of output in the outputs array instead of the output itself.
  for (const outputKey in outputMap) {
    outputs.push(outputMap[outputKey]);
    outputMap[outputKey] = outputs.length - 1;
  }
  // Create an AnimCurve for each curve object in the curveMap. Each curve object's input value should be resolved to the index of the input in the
  // inputs arrays using the inputMap. Likewise for output values.
  for (const curveKey in curveMap) {
    const curveData = curveMap[curveKey];
    // if the curveData contains a morph curve then do not add it to the final curve list as the individual morph target curves are included instead
    if (curveData.morphCurve) {
      continue;
    }
    curves.push(new AnimCurve(curveData.paths, inputMap[curveData.input], outputMap[curveData.output], curveData.interpolation));

    // if this target is a set of quaternion keys, make note of its index so we can perform
    // quaternion-specific processing on it.
    if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
      quatArrays.push(curves[curves.length - 1].output);
    }
  }

  // sort the list of array indexes so we can skip dups
  quatArrays.sort();

  // run through the quaternion data arrays flipping quaternion keys
  // that don't fall in the same winding order.
  let prevIndex = null;
  let data;
  for (i = 0; i < quatArrays.length; ++i) {
    const index = quatArrays[i];
    // skip over duplicate array indices
    if (i === 0 || index !== prevIndex) {
      data = outputs[index];
      if (data.components === 4) {
        const d = data.data;
        const len = d.length - 4;
        for (let j = 0; j < len; j += 4) {
          const dp = d[j + 0] * d[j + 4] + d[j + 1] * d[j + 5] + d[j + 2] * d[j + 6] + d[j + 3] * d[j + 7];
          if (dp < 0) {
            d[j + 4] *= -1;
            d[j + 5] *= -1;
            d[j + 6] *= -1;
            d[j + 7] *= -1;
          }
        }
      }
      prevIndex = index;
    }
  }

  // calculate duration of the animation as maximum time value
  let duration = 0;
  for (i = 0; i < inputs.length; i++) {
    data = inputs[i]._data;
    duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
  }
  return new AnimTrack(gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : 'animation_' + animationIndex, duration, inputs, outputs, curves);
};
const tempMat = new Mat4();
const tempVec = new Vec3();
const createNode = (gltfNode, nodeIndex) => {
  const entity = new GraphNode();
  if (gltfNode.hasOwnProperty('name') && gltfNode.name.length > 0) {
    entity.name = gltfNode.name;
  } else {
    entity.name = 'node_' + nodeIndex;
  }

  // Parse transformation properties
  if (gltfNode.hasOwnProperty('matrix')) {
    tempMat.data.set(gltfNode.matrix);
    tempMat.getTranslation(tempVec);
    entity.setLocalPosition(tempVec);
    tempMat.getEulerAngles(tempVec);
    entity.setLocalEulerAngles(tempVec);
    tempMat.getScale(tempVec);
    entity.setLocalScale(tempVec);
  }
  if (gltfNode.hasOwnProperty('rotation')) {
    const r = gltfNode.rotation;
    entity.setLocalRotation(r[0], r[1], r[2], r[3]);
  }
  if (gltfNode.hasOwnProperty('translation')) {
    const t = gltfNode.translation;
    entity.setLocalPosition(t[0], t[1], t[2]);
  }
  if (gltfNode.hasOwnProperty('scale')) {
    const s = gltfNode.scale;
    entity.setLocalScale(s[0], s[1], s[2]);
  }
  return entity;
};

// creates a camera component on the supplied node, and returns it
const createCamera = (gltfCamera, node) => {
  const projection = gltfCamera.type === 'orthographic' ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE;
  const gltfProperties = projection === PROJECTION_ORTHOGRAPHIC ? gltfCamera.orthographic : gltfCamera.perspective;
  const componentData = {
    enabled: false,
    projection: projection,
    nearClip: gltfProperties.znear,
    aspectRatioMode: ASPECT_AUTO
  };
  if (gltfProperties.zfar) {
    componentData.farClip = gltfProperties.zfar;
  }
  if (projection === PROJECTION_ORTHOGRAPHIC) {
    componentData.orthoHeight = 0.5 * gltfProperties.ymag;
    if (gltfProperties.ymag) {
      componentData.aspectRatioMode = ASPECT_MANUAL;
      componentData.aspectRatio = gltfProperties.xmag / gltfProperties.ymag;
    }
  } else {
    componentData.fov = gltfProperties.yfov * math.RAD_TO_DEG;
    if (gltfProperties.aspectRatio) {
      componentData.aspectRatioMode = ASPECT_MANUAL;
      componentData.aspectRatio = gltfProperties.aspectRatio;
    }
  }
  const cameraEntity = new Entity(gltfCamera.name);
  cameraEntity.addComponent('camera', componentData);
  return cameraEntity;
};

// creates light component, adds it to the node and returns the created light component
const createLight = (gltfLight, node) => {
  const lightProps = {
    enabled: false,
    type: gltfLight.type === 'point' ? 'omni' : gltfLight.type,
    color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
    // when range is not defined, infinity should be used - but that is causing infinity in bounds calculations
    range: gltfLight.hasOwnProperty('range') ? gltfLight.range : 9999,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    // TODO: (engine issue #3252) Set intensity to match glTF specification, which uses physically based values:
    // - Omni and spot lights use luminous intensity in candela (lm/sr)
    // - Directional lights use illuminance in lux (lm/m2).
    // Current implementation: clapms specified intensity to 0..2 range
    intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
  };
  if (gltfLight.hasOwnProperty('spot')) {
    lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
    lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : Math.PI / 4;
  }

  // glTF stores light already in energy/area, but we need to provide the light with only the energy parameter,
  // so we need the intensities in candela back to lumen
  if (gltfLight.hasOwnProperty("intensity")) {
    lightProps.luminance = gltfLight.intensity * Light.getLightUnitConversion(lightTypes[lightProps.type], lightProps.outerConeAngle, lightProps.innerConeAngle);
  }

  // Rotate to match light orientation in glTF specification
  // Note that this adds a new entity node into the hierarchy that does not exist in the gltf hierarchy
  const lightEntity = new Entity(node.name);
  lightEntity.rotateLocal(90, 0, 0);

  // add component
  lightEntity.addComponent('light', lightProps);
  return lightEntity;
};
const createSkins = (device, gltf, nodes, bufferViews) => {
  if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
    return [];
  }

  // cache for skins to filter out duplicates
  const glbSkins = new Map();
  return gltf.skins.map(gltfSkin => {
    return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
  });
};
const createMeshes = (device, gltf, bufferViews, flipV, options) => {
  var _gltf$meshes, _gltf$accessors, _gltf$bufferViews;
  // dictionary of vertex buffers to avoid duplicates
  const vertexBufferDict = {};
  const meshVariants = {};
  const meshDefaultMaterials = {};
  const promises = [];
  const valid = !options.skipMeshes && (gltf == null || (_gltf$meshes = gltf.meshes) == null ? void 0 : _gltf$meshes.length) && (gltf == null || (_gltf$accessors = gltf.accessors) == null ? void 0 : _gltf$accessors.length) && (gltf == null || (_gltf$bufferViews = gltf.bufferViews) == null ? void 0 : _gltf$bufferViews.length);
  const meshes = valid ? gltf.meshes.map(gltfMesh => {
    return createMesh(device, gltfMesh, gltf.accessors, bufferViews, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, options, promises);
  }) : [];
  return {
    meshes,
    meshVariants,
    meshDefaultMaterials,
    promises
  };
};
const createMaterials = (gltf, textures, options, flipV) => {
  var _options$material, _options$material$pro, _options$material2, _options$material3;
  if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
    return [];
  }
  const preprocess = options == null || (_options$material = options.material) == null ? void 0 : _options$material.preprocess;
  const process = (_options$material$pro = options == null || (_options$material2 = options.material) == null ? void 0 : _options$material2.process) != null ? _options$material$pro : createMaterial;
  const postprocess = options == null || (_options$material3 = options.material) == null ? void 0 : _options$material3.postprocess;
  return gltf.materials.map(gltfMaterial => {
    if (preprocess) {
      preprocess(gltfMaterial);
    }
    const material = process(gltfMaterial, textures, flipV);
    if (postprocess) {
      postprocess(gltfMaterial, material);
    }
    return material;
  });
};
const createVariants = gltf => {
  if (!gltf.hasOwnProperty("extensions") || !gltf.extensions.hasOwnProperty("KHR_materials_variants")) return null;
  const data = gltf.extensions.KHR_materials_variants.variants;
  const variants = {};
  for (let i = 0; i < data.length; i++) {
    variants[data[i].name] = i;
  }
  return variants;
};
const createAnimations = (gltf, nodes, bufferViews, options) => {
  var _options$animation, _options$animation2;
  if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
    return [];
  }
  const preprocess = options == null || (_options$animation = options.animation) == null ? void 0 : _options$animation.preprocess;
  const postprocess = options == null || (_options$animation2 = options.animation) == null ? void 0 : _options$animation2.postprocess;
  return gltf.animations.map((gltfAnimation, index) => {
    if (preprocess) {
      preprocess(gltfAnimation);
    }
    const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes, gltf.nodes);
    if (postprocess) {
      postprocess(gltfAnimation, animation);
    }
    return animation;
  });
};
const createNodes = (gltf, options) => {
  var _options$node, _options$node$process, _options$node2, _options$node3;
  if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
    return [];
  }
  const preprocess = options == null || (_options$node = options.node) == null ? void 0 : _options$node.preprocess;
  const process = (_options$node$process = options == null || (_options$node2 = options.node) == null ? void 0 : _options$node2.process) != null ? _options$node$process : createNode;
  const postprocess = options == null || (_options$node3 = options.node) == null ? void 0 : _options$node3.postprocess;
  const nodes = gltf.nodes.map((gltfNode, index) => {
    if (preprocess) {
      preprocess(gltfNode);
    }
    const node = process(gltfNode, index);
    if (postprocess) {
      postprocess(gltfNode, node);
    }
    return node;
  });

  // build node hierarchy
  for (let i = 0; i < gltf.nodes.length; ++i) {
    const gltfNode = gltf.nodes[i];
    if (gltfNode.hasOwnProperty('children')) {
      const parent = nodes[i];
      const uniqueNames = {};
      for (let j = 0; j < gltfNode.children.length; ++j) {
        const child = nodes[gltfNode.children[j]];
        if (!child.parent) {
          if (uniqueNames.hasOwnProperty(child.name)) {
            child.name += uniqueNames[child.name]++;
          } else {
            uniqueNames[child.name] = 1;
          }
          parent.addChild(child);
        }
      }
    }
  }
  return nodes;
};
const createScenes = (gltf, nodes) => {
  var _gltf$scenes$0$nodes;
  const scenes = [];
  const count = gltf.scenes.length;

  // if there's a single scene with a single node in it, don't create wrapper nodes
  if (count === 1 && ((_gltf$scenes$0$nodes = gltf.scenes[0].nodes) == null ? void 0 : _gltf$scenes$0$nodes.length) === 1) {
    const nodeIndex = gltf.scenes[0].nodes[0];
    scenes.push(nodes[nodeIndex]);
  } else {
    // create root node per scene
    for (let i = 0; i < count; i++) {
      const scene = gltf.scenes[i];
      if (scene.nodes) {
        const sceneRoot = new GraphNode(scene.name);
        for (let n = 0; n < scene.nodes.length; n++) {
          const childNode = nodes[scene.nodes[n]];
          sceneRoot.addChild(childNode);
        }
        scenes.push(sceneRoot);
      }
    }
  }
  return scenes;
};
const createCameras = (gltf, nodes, options) => {
  let cameras = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('cameras') && gltf.cameras.length > 0) {
    var _options$camera, _options$camera$proce, _options$camera2, _options$camera3;
    const preprocess = options == null || (_options$camera = options.camera) == null ? void 0 : _options$camera.preprocess;
    const process = (_options$camera$proce = options == null || (_options$camera2 = options.camera) == null ? void 0 : _options$camera2.process) != null ? _options$camera$proce : createCamera;
    const postprocess = options == null || (_options$camera3 = options.camera) == null ? void 0 : _options$camera3.postprocess;
    gltf.nodes.forEach((gltfNode, nodeIndex) => {
      if (gltfNode.hasOwnProperty('camera')) {
        const gltfCamera = gltf.cameras[gltfNode.camera];
        if (gltfCamera) {
          if (preprocess) {
            preprocess(gltfCamera);
          }
          const camera = process(gltfCamera, nodes[nodeIndex]);
          if (postprocess) {
            postprocess(gltfCamera, camera);
          }

          // add the camera to node->camera map
          if (camera) {
            if (!cameras) cameras = new Map();
            cameras.set(gltfNode, camera);
          }
        }
      }
    });
  }
  return cameras;
};
const createLights = (gltf, nodes, options) => {
  let lights = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') && gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {
    const gltfLights = gltf.extensions.KHR_lights_punctual.lights;
    if (gltfLights.length) {
      var _options$light, _options$light$proces, _options$light2, _options$light3;
      const preprocess = options == null || (_options$light = options.light) == null ? void 0 : _options$light.preprocess;
      const process = (_options$light$proces = options == null || (_options$light2 = options.light) == null ? void 0 : _options$light2.process) != null ? _options$light$proces : createLight;
      const postprocess = options == null || (_options$light3 = options.light) == null ? void 0 : _options$light3.postprocess;

      // handle nodes with lights
      gltf.nodes.forEach((gltfNode, nodeIndex) => {
        if (gltfNode.hasOwnProperty('extensions') && gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') && gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {
          const lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
          const gltfLight = gltfLights[lightIndex];
          if (gltfLight) {
            if (preprocess) {
              preprocess(gltfLight);
            }
            const light = process(gltfLight, nodes[nodeIndex]);
            if (postprocess) {
              postprocess(gltfLight, light);
            }

            // add the light to node->light map
            if (light) {
              if (!lights) lights = new Map();
              lights.set(gltfNode, light);
            }
          }
        }
      });
    }
  }
  return lights;
};

// link skins to the meshes
const linkSkins = (gltf, renders, skins) => {
  gltf.nodes.forEach(gltfNode => {
    if (gltfNode.hasOwnProperty('mesh') && gltfNode.hasOwnProperty('skin')) {
      const meshGroup = renders[gltfNode.mesh].meshes;
      meshGroup.forEach(mesh => {
        mesh.skin = skins[gltfNode.skin];
      });
    }
  });
};

// create engine resources from the downloaded GLB data
const createResources = async (device, gltf, bufferViews, textures, options) => {
  var _options$global, _options$global2;
  const preprocess = options == null || (_options$global = options.global) == null ? void 0 : _options$global.preprocess;
  const postprocess = options == null || (_options$global2 = options.global) == null ? void 0 : _options$global2.postprocess;
  if (preprocess) {
    preprocess(gltf);
  }

  // The original version of FACT generated incorrectly flipped V texture
  // coordinates. We must compensate by flipping V in this case. Once
  // all models have been re-exported we can remove this flag.
  const flipV = gltf.asset && gltf.asset.generator === 'PlayCanvas';

  // We'd like to remove the flipV code at some point.
  if (flipV) {
    Debug.warn('glTF model may have flipped UVs. Please reconvert.');
  }
  const nodes = createNodes(gltf, options);
  const scenes = createScenes(gltf, nodes);
  const lights = createLights(gltf, nodes, options);
  const cameras = createCameras(gltf, nodes, options);
  const variants = createVariants(gltf);

  // buffer data must have finished loading in order to create meshes and animations
  const bufferViewData = await Promise.all(bufferViews);
  const {
    meshes,
    meshVariants,
    meshDefaultMaterials,
    promises
  } = createMeshes(device, gltf, bufferViewData, flipV, options);
  const animations = createAnimations(gltf, nodes, bufferViewData, options);

  // textures must have finished loading in order to create materials
  const textureAssets = await Promise.all(textures);
  const textureInstances = textureAssets.map(t => t.resource);
  const materials = createMaterials(gltf, textureInstances, options, flipV);
  const skins = createSkins(device, gltf, nodes, bufferViewData);

  // create renders to wrap meshes
  const renders = [];
  for (let i = 0; i < meshes.length; i++) {
    renders[i] = new Render();
    renders[i].meshes = meshes[i];
  }

  // link skins to meshes
  linkSkins(gltf, renders, skins);
  const result = new GlbResources();
  result.gltf = gltf;
  result.nodes = nodes;
  result.scenes = scenes;
  result.animations = animations;
  result.textures = textureAssets;
  result.materials = materials;
  result.variants = variants;
  result.meshVariants = meshVariants;
  result.meshDefaultMaterials = meshDefaultMaterials;
  result.renders = renders;
  result.skins = skins;
  result.lights = lights;
  result.cameras = cameras;
  if (postprocess) {
    postprocess(gltf, result);
  }

  // wait for draco meshes to complete decoding
  await Promise.all(promises);
  return result;
};
const applySampler = (texture, gltfSampler) => {
  const getFilter = (filter, defaultValue) => {
    switch (filter) {
      case 9728:
        return FILTER_NEAREST;
      case 9729:
        return FILTER_LINEAR;
      case 9984:
        return FILTER_NEAREST_MIPMAP_NEAREST;
      case 9985:
        return FILTER_LINEAR_MIPMAP_NEAREST;
      case 9986:
        return FILTER_NEAREST_MIPMAP_LINEAR;
      case 9987:
        return FILTER_LINEAR_MIPMAP_LINEAR;
      default:
        return defaultValue;
    }
  };
  const getWrap = (wrap, defaultValue) => {
    switch (wrap) {
      case 33071:
        return ADDRESS_CLAMP_TO_EDGE;
      case 33648:
        return ADDRESS_MIRRORED_REPEAT;
      case 10497:
        return ADDRESS_REPEAT;
      default:
        return defaultValue;
    }
  };
  if (texture) {
    var _gltfSampler;
    gltfSampler = (_gltfSampler = gltfSampler) != null ? _gltfSampler : {};
    texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
    texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
    texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
    texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
  }
};
let gltfTextureUniqueId = 0;

// create gltf images. returns an array of promises that resolve to texture assets.
const createImages = (gltf, bufferViews, urlBase, registry, options) => {
  var _options$image, _options$image2, _options$image3;
  if (!gltf.images || gltf.images.length === 0) {
    return [];
  }
  const preprocess = options == null || (_options$image = options.image) == null ? void 0 : _options$image.preprocess;
  const processAsync = options == null || (_options$image2 = options.image) == null ? void 0 : _options$image2.processAsync;
  const postprocess = options == null || (_options$image3 = options.image) == null ? void 0 : _options$image3.postprocess;
  const mimeTypeFileExtensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/basis': 'basis',
    'image/ktx': 'ktx',
    'image/ktx2': 'ktx2',
    'image/vnd-ms.dds': 'dds'
  };
  const loadTexture = (gltfImage, url, bufferView, mimeType, options) => {
    return new Promise((resolve, reject) => {
      const continuation = bufferViewData => {
        const name = (gltfImage.name || 'gltf-texture') + '-' + gltfTextureUniqueId++;

        // construct the asset file
        const file = {
          url: url || name
        };
        if (bufferViewData) {
          file.contents = bufferViewData.slice(0).buffer;
        }
        if (mimeType) {
          const extension = mimeTypeFileExtensions[mimeType];
          if (extension) {
            file.filename = file.url + '.' + extension;
          }
        }

        // create and load the asset
        const asset = new Asset(name, 'texture', file, null, options);
        asset.on('load', asset => resolve(asset));
        asset.on('error', err => reject(err));
        registry.add(asset);
        registry.load(asset);
      };
      if (bufferView) {
        bufferView.then(bufferViewData => continuation(bufferViewData));
      } else {
        continuation(null);
      }
    });
  };
  return gltf.images.map((gltfImage, i) => {
    if (preprocess) {
      preprocess(gltfImage);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfImage, (err, textureAsset) => {
          if (err) reject(err);else resolve(textureAsset);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(textureAsset => {
      if (textureAsset) {
        return textureAsset;
      } else if (gltfImage.hasOwnProperty('uri')) {
        // uri specified
        if (isDataURI(gltfImage.uri)) {
          return loadTexture(gltfImage, gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null);
        }
        return loadTexture(gltfImage, ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, {
          crossOrigin: 'anonymous'
        });
      } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
        // bufferview
        return loadTexture(gltfImage, null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null);
      }

      // fail
      return Promise.reject(new Error(`Invalid image found in gltf (neither uri or bufferView found). index=${i}`));
    });
    if (postprocess) {
      promise = promise.then(textureAsset => {
        postprocess(gltfImage, textureAsset);
        return textureAsset;
      });
    }
    return promise;
  });
};

// create gltf textures. returns an array of promises that resolve to texture assets.
const createTextures = (gltf, images, options) => {
  var _gltf$images, _gltf$textures, _options$texture, _options$texture2, _options$texture3;
  if (!(gltf != null && (_gltf$images = gltf.images) != null && _gltf$images.length) || !(gltf != null && (_gltf$textures = gltf.textures) != null && _gltf$textures.length)) {
    return [];
  }
  const preprocess = options == null || (_options$texture = options.texture) == null ? void 0 : _options$texture.preprocess;
  const processAsync = options == null || (_options$texture2 = options.texture) == null ? void 0 : _options$texture2.processAsync;
  const postprocess = options == null || (_options$texture3 = options.texture) == null ? void 0 : _options$texture3.postprocess;
  const seenImages = new Set();
  return gltf.textures.map(gltfTexture => {
    if (preprocess) {
      preprocess(gltfTexture);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfTexture, gltf.images, (err, gltfImageIndex) => {
          if (err) reject(err);else resolve(gltfImageIndex);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(gltfImageIndex => {
      var _ref, _ref2, _gltfImageIndex, _gltfTexture$extensio, _gltfTexture$extensio2;
      // resolve image index
      gltfImageIndex = (_ref = (_ref2 = (_gltfImageIndex = gltfImageIndex) != null ? _gltfImageIndex : gltfTexture == null || (_gltfTexture$extensio = gltfTexture.extensions) == null || (_gltfTexture$extensio = _gltfTexture$extensio.KHR_texture_basisu) == null ? void 0 : _gltfTexture$extensio.source) != null ? _ref2 : gltfTexture == null || (_gltfTexture$extensio2 = gltfTexture.extensions) == null || (_gltfTexture$extensio2 = _gltfTexture$extensio2.EXT_texture_webp) == null ? void 0 : _gltfTexture$extensio2.source) != null ? _ref : gltfTexture.source;
      const cloneAsset = seenImages.has(gltfImageIndex);
      seenImages.add(gltfImageIndex);
      return images[gltfImageIndex].then(imageAsset => {
        var _gltf$samplers;
        const asset = cloneAsset ? cloneTextureAsset(imageAsset) : imageAsset;
        applySampler(asset.resource, ((_gltf$samplers = gltf.samplers) != null ? _gltf$samplers : [])[gltfTexture.sampler]);
        return asset;
      });
    });
    if (postprocess) {
      promise = promise.then(textureAsset => {
        postprocess(gltfTexture, textureAsset);
        return textureAsset;
      });
    }
    return promise;
  });
};

// load gltf buffers. returns an array of promises that resolve to typed arrays.
const loadBuffers = (gltf, binaryChunk, urlBase, options) => {
  var _options$buffer, _options$buffer2, _options$buffer3;
  if (!gltf.buffers || gltf.buffers.length === 0) {
    return [];
  }
  const preprocess = options == null || (_options$buffer = options.buffer) == null ? void 0 : _options$buffer.preprocess;
  const processAsync = options == null || (_options$buffer2 = options.buffer) == null ? void 0 : _options$buffer2.processAsync;
  const postprocess = options == null || (_options$buffer3 = options.buffer) == null ? void 0 : _options$buffer3.postprocess;
  return gltf.buffers.map((gltfBuffer, i) => {
    if (preprocess) {
      preprocess(gltfBuffer);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfBuffer, (err, arrayBuffer) => {
          if (err) reject(err);else resolve(arrayBuffer);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(arrayBuffer => {
      if (arrayBuffer) {
        return arrayBuffer;
      } else if (gltfBuffer.hasOwnProperty('uri')) {
        if (isDataURI(gltfBuffer.uri)) {
          // convert base64 to raw binary data held in a string
          // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
          const byteString = atob(gltfBuffer.uri.split(',')[1]);

          // create a view into the buffer
          const binaryArray = new Uint8Array(byteString.length);

          // set the bytes of the buffer to the correct values
          for (let j = 0; j < byteString.length; j++) {
            binaryArray[j] = byteString.charCodeAt(j);
          }
          return binaryArray;
        }
        return new Promise((resolve, reject) => {
          http.get(ABSOLUTE_URL.test(gltfBuffer.uri) ? gltfBuffer.uri : path.join(urlBase, gltfBuffer.uri), {
            cache: true,
            responseType: 'arraybuffer',
            retry: false
          }, (err, result) => {
            // eslint-disable-line no-loop-func
            if (err) reject(err);else resolve(new Uint8Array(result));
          });
        });
      }

      // glb buffer reference
      return binaryChunk;
    });
    if (postprocess) {
      promise = promise.then(buffer => {
        postprocess(gltf.buffers[i], buffer);
        return buffer;
      });
    }
    return promise;
  });
};

// parse the gltf chunk, returns the gltf json
const parseGltf = (gltfChunk, callback) => {
  const decodeBinaryUtf8 = array => {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(array);
    }
    let str = '';
    for (let i = 0; i < array.length; i++) {
      str += String.fromCharCode(array[i]);
    }
    return decodeURIComponent(escape(str));
  };
  const gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

  // check gltf version
  if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
    callback(`Invalid gltf version. Expected version 2.0 or above but found version '${gltf.asset.version}'.`);
    return;
  }

  // check required extensions
  callback(null, gltf);
};

// parse glb data, returns the gltf and binary chunk
const parseGlb = (glbData, callback) => {
  const data = glbData instanceof ArrayBuffer ? new DataView(glbData) : new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);

  // read header
  const magic = data.getUint32(0, true);
  const version = data.getUint32(4, true);
  const length = data.getUint32(8, true);
  if (magic !== 0x46546C67) {
    callback('Invalid magic number found in glb header. Expected 0x46546C67, found 0x' + magic.toString(16));
    return;
  }
  if (version !== 2) {
    callback('Invalid version number found in glb header. Expected 2, found ' + version);
    return;
  }
  if (length <= 0 || length > data.byteLength) {
    callback('Invalid length found in glb header. Found ' + length);
    return;
  }

  // read chunks
  const chunks = [];
  let offset = 12;
  while (offset < length) {
    const chunkLength = data.getUint32(offset, true);
    if (offset + chunkLength + 8 > data.byteLength) {
      callback(`Invalid chunk length found in glb. Found ${chunkLength}`);
    }
    const chunkType = data.getUint32(offset + 4, true);
    const chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
    chunks.push({
      length: chunkLength,
      type: chunkType,
      data: chunkData
    });
    offset += chunkLength + 8;
  }
  if (chunks.length !== 1 && chunks.length !== 2) {
    callback('Invalid number of chunks found in glb file.');
    return;
  }
  if (chunks[0].type !== 0x4E4F534A) {
    callback(`Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x${chunks[0].type.toString(16)}`);
    return;
  }
  if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
    callback(`Invalid chunk type found in glb file. Expected 0x004E4942, found 0x${chunks[1].type.toString(16)}`);
    return;
  }
  callback(null, {
    gltfChunk: chunks[0].data,
    binaryChunk: chunks.length === 2 ? chunks[1].data : null
  });
};

// parse the chunk of data, which can be glb or gltf
const parseChunk = (filename, data, callback) => {
  const hasGlbHeader = () => {
    // glb format starts with 'glTF'
    const u8 = new Uint8Array(data);
    return u8[0] === 103 && u8[1] === 108 && u8[2] === 84 && u8[3] === 70;
  };
  if (filename && filename.toLowerCase().endsWith('.glb') || hasGlbHeader()) {
    parseGlb(data, callback);
  } else {
    callback(null, {
      gltfChunk: data,
      binaryChunk: null
    });
  }
};

// create buffer views
const createBufferViews = (gltf, buffers, options) => {
  var _options$bufferView, _options$bufferView2, _options$bufferView3, _gltf$bufferViews2;
  const result = [];
  const preprocess = options == null || (_options$bufferView = options.bufferView) == null ? void 0 : _options$bufferView.preprocess;
  const processAsync = options == null || (_options$bufferView2 = options.bufferView) == null ? void 0 : _options$bufferView2.processAsync;
  const postprocess = options == null || (_options$bufferView3 = options.bufferView) == null ? void 0 : _options$bufferView3.postprocess;

  // handle case of no buffers
  if (!((_gltf$bufferViews2 = gltf.bufferViews) != null && _gltf$bufferViews2.length)) {
    return result;
  }
  for (let i = 0; i < gltf.bufferViews.length; ++i) {
    const gltfBufferView = gltf.bufferViews[i];
    if (preprocess) {
      preprocess(gltfBufferView);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfBufferView, buffers, (err, result) => {
          if (err) reject(err);else resolve(result);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(buffer => {
      if (buffer) {
        return buffer;
      }

      // convert buffer to typed array
      return buffers[gltfBufferView.buffer].then(buffer => {
        return new Uint8Array(buffer.buffer, buffer.byteOffset + (gltfBufferView.byteOffset || 0), gltfBufferView.byteLength);
      });
    });

    // add a 'byteStride' member to the typed array so we have easy access to it later
    if (gltfBufferView.hasOwnProperty('byteStride')) {
      promise = promise.then(typedArray => {
        typedArray.byteStride = gltfBufferView.byteStride;
        return typedArray;
      });
    }
    if (postprocess) {
      promise = promise.then(typedArray => {
        postprocess(gltfBufferView, typedArray);
        return typedArray;
      });
    }
    result.push(promise);
  }
  return result;
};
class GlbParser {
  // parse the gltf or glb data asynchronously, loading external resources
  static parse(filename, urlBase, data, device, registry, options, callback) {
    // parse the data
    parseChunk(filename, data, (err, chunks) => {
      if (err) {
        callback(err);
        return;
      }

      // parse gltf
      parseGltf(chunks.gltfChunk, (err, gltf) => {
        if (err) {
          callback(err);
          return;
        }
        const buffers = loadBuffers(gltf, chunks.binaryChunk, urlBase, options);
        const bufferViews = createBufferViews(gltf, buffers, options);
        const images = createImages(gltf, bufferViews, urlBase, registry, options);
        const textures = createTextures(gltf, images, options);
        createResources(device, gltf, bufferViews, textures, options).then(result => callback(null, result)).catch(err => callback(err));
      });
    });
  }
  static createDefaultMaterial() {
    return createMaterial({
      name: 'defaultGlbMaterial'
    }, []);
  }
}

export { GlbParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQUJTT0xVVEVfVVJMIH0gZnJvbSAnLi4vYXNzZXQvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgZHJhY29EZWNvZGUgfSBmcm9tICcuL2RyYWNvLWRlY29kZXIuanMnO1xuXG4vLyByZXNvdXJjZXMgbG9hZGVkIGZyb20gR0xCIGZpbGUgdGhhdCB0aGUgcGFyc2VyIHJldHVybnNcbmNsYXNzIEdsYlJlc291cmNlcyB7XG4gICAgZ2x0ZjtcblxuICAgIG5vZGVzO1xuXG4gICAgc2NlbmVzO1xuXG4gICAgYW5pbWF0aW9ucztcblxuICAgIHRleHR1cmVzO1xuXG4gICAgbWF0ZXJpYWxzO1xuXG4gICAgdmFyaWFudHM7XG5cbiAgICBtZXNoVmFyaWFudHM7XG5cbiAgICBtZXNoRGVmYXVsdE1hdGVyaWFscztcblxuICAgIHJlbmRlcnM7XG5cbiAgICBza2lucztcblxuICAgIGxpZ2h0cztcblxuICAgIGNhbWVyYXM7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZW5kZXIgbmVlZHMgdG8gZGVjIHJlZiBtZXNoZXNcbiAgICAgICAgaWYgKHRoaXMucmVuZGVycykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJzLmZvckVhY2goKHJlbmRlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlbmRlci5tZXNoZXMgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGlzRGF0YVVSSSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gL15kYXRhOi4qLC4qJC9pLnRlc3QodXJpKTtcbn07XG5cbmNvbnN0IGdldERhdGFVUklNaW1lVHlwZSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gdXJpLnN1YnN0cmluZyh1cmkuaW5kZXhPZignOicpICsgMSwgdXJpLmluZGV4T2YoJzsnKSk7XG59O1xuXG5jb25zdCBnZXROdW1Db21wb25lbnRzID0gKGFjY2Vzc29yVHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoYWNjZXNzb3JUeXBlKSB7XG4gICAgICAgIGNhc2UgJ1NDQUxBUic6IHJldHVybiAxO1xuICAgICAgICBjYXNlICdWRUMyJzogcmV0dXJuIDI7XG4gICAgICAgIGNhc2UgJ1ZFQzMnOiByZXR1cm4gMztcbiAgICAgICAgY2FzZSAnVkVDNCc6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQyJzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDMnOiByZXR1cm4gOTtcbiAgICAgICAgY2FzZSAnTUFUNCc6IHJldHVybiAxNjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDM7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50VHlwZSA9IChjb21wb25lbnRUeXBlKSA9PiB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIFRZUEVfSU5UODtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVFlQRV9VSU5UODtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gVFlQRV9JTlQxNjtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVFlQRV9VSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIFRZUEVfSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFRZUEVfVUlOVDMyO1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBUWVBFX0ZMT0FUMzI7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFNpemVJbkJ5dGVzID0gKGNvbXBvbmVudFR5cGUpID0+IHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gMTsgICAgLy8gaW50OFxuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiAxOyAgICAvLyB1aW50OFxuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiAyOyAgICAvLyBpbnQxNlxuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiAyOyAgICAvLyB1aW50MTZcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gNDsgICAgLy8gaW50MzJcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gNDsgICAgLy8gdWludDMyXG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIDQ7ICAgIC8vIGZsb2F0MzJcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50RGF0YVR5cGUgPSAoY29tcG9uZW50VHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBJbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFVpbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIEludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFVpbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBJbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBVaW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gRmxvYXQzMkFycmF5O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5jb25zdCBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCA9IHtcbiAgICAnUE9TSVRJT04nOiBTRU1BTlRJQ19QT1NJVElPTixcbiAgICAnTk9STUFMJzogU0VNQU5USUNfTk9STUFMLFxuICAgICdUQU5HRU5UJzogU0VNQU5USUNfVEFOR0VOVCxcbiAgICAnQ09MT1JfMCc6IFNFTUFOVElDX0NPTE9SLFxuICAgICdKT0lOVFNfMCc6IFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAnV0VJR0hUU18wJzogU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgJ1RFWENPT1JEXzAnOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgJ1RFWENPT1JEXzEnOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgJ1RFWENPT1JEXzInOiBTRU1BTlRJQ19URVhDT09SRDIsXG4gICAgJ1RFWENPT1JEXzMnOiBTRU1BTlRJQ19URVhDT09SRDMsXG4gICAgJ1RFWENPT1JEXzQnOiBTRU1BTlRJQ19URVhDT09SRDQsXG4gICAgJ1RFWENPT1JEXzUnOiBTRU1BTlRJQ19URVhDT09SRDUsXG4gICAgJ1RFWENPT1JEXzYnOiBTRU1BTlRJQ19URVhDT09SRDYsXG4gICAgJ1RFWENPT1JEXzcnOiBTRU1BTlRJQ19URVhDT09SRDdcbn07XG5cbi8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuY29uc3QgYXR0cmlidXRlT3JkZXIgPSB7XG4gICAgW1NFTUFOVElDX1BPU0lUSU9OXTogMCxcbiAgICBbU0VNQU5USUNfTk9STUFMXTogMSxcbiAgICBbU0VNQU5USUNfVEFOR0VOVF06IDIsXG4gICAgW1NFTUFOVElDX0NPTE9SXTogMyxcbiAgICBbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTogNCxcbiAgICBbU0VNQU5USUNfQkxFTkRXRUlHSFRdOiA1LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDBdOiA2LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDFdOiA3LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDJdOiA4LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDNdOiA5LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDRdOiAxMCxcbiAgICBbU0VNQU5USUNfVEVYQ09PUkQ1XTogMTEsXG4gICAgW1NFTUFOVElDX1RFWENPT1JENl06IDEyLFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDddOiAxM1xufTtcblxuLy8gcmV0dXJucyBhIGZ1bmN0aW9uIGZvciBkZXF1YW50aXppbmcgdGhlIGRhdGEgdHlwZVxuY29uc3QgZ2V0RGVxdWFudGl6ZUZ1bmMgPSAoc3JjVHlwZSkgPT4ge1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvZXh0ZW5zaW9ucy8yLjAvS2hyb25vcy9LSFJfbWVzaF9xdWFudGl6YXRpb24jZW5jb2RpbmctcXVhbnRpemVkLWRhdGFcbiAgICBzd2l0Y2ggKHNyY1R5cGUpIHtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgfVxufTtcblxuLy8gZGVxdWFudGl6ZSBhbiBhcnJheSBvZiBkYXRhXG5jb25zdCBkZXF1YW50aXplQXJyYXkgPSAoZHN0QXJyYXksIHNyY0FycmF5LCBzcmNUeXBlKSA9PiB7XG4gICAgY29uc3QgY29udkZ1bmMgPSBnZXREZXF1YW50aXplRnVuYyhzcmNUeXBlKTtcbiAgICBjb25zdCBsZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBkc3RBcnJheVtpXSA9IGNvbnZGdW5jKHNyY0FycmF5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGRzdEFycmF5O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEsIG1ha2luZyBhIGNvcHkgYW5kIHBhdGNoaW5nIGluIHRoZSBjYXNlIG9mIGEgc3BhcnNlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckRhdGEgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgZmxhdHRlbiA9IGZhbHNlKSA9PiB7XG4gICAgY29uc3QgbnVtQ29tcG9uZW50cyA9IGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpO1xuICAgIGNvbnN0IGRhdGFUeXBlID0gZ2V0Q29tcG9uZW50RGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgIGlmICghZGF0YVR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDtcblxuICAgIGlmIChnbHRmQWNjZXNzb3Iuc3BhcnNlKSB7XG4gICAgICAgIC8vIGhhbmRsZSBzcGFyc2UgZGF0YVxuICAgICAgICBjb25zdCBzcGFyc2UgPSBnbHRmQWNjZXNzb3Iuc3BhcnNlO1xuXG4gICAgICAgIC8vIGdldCBpbmRpY2VzIGRhdGFcbiAgICAgICAgY29uc3QgaW5kaWNlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdTQ0FMQVInXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbihpbmRpY2VzQWNjZXNzb3IsIHNwYXJzZS5pbmRpY2VzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGRhdGEgdmFsdWVzIGRhdGFcbiAgICAgICAgY29uc3QgdmFsdWVzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGUsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGdsdGZBY2Nlc3Nvci5oYXNPd25Qcm9wZXJ0eShcImJ1ZmZlclZpZXdcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1tnbHRmQWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgICAgICAgICBjb25zdCBieXRlc1BlckVsZW1lbnQgPSBudW1Db21wb25lbnRzICogZGF0YVR5cGUuQllURVNfUEVSX0VMRU1FTlQ7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZHN0T2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICAgICAgICAgIGxldCBzcmNPZmZzZXQgPSAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCkgKyBpICogYnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gKGdsdGZBY2Nlc3NvcikgPT4ge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSAocHJpbWl0aXZlKSA9PiB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IChudW1WZXJ0aWNlcykgPT4ge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSAoc291cmNlRGVzYywgaW5kaWNlcykgPT4ge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9ICh2ZXJ0ZXhCdWZmZXIpID0+IHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IChvZmZzZXRzLCB0eXBlLCBvbmUpID0+IHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9ICh0ZXh0dXJlKSA9PiB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSAodGV4dHVyZSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IChzcmMpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikgPT4ge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0ge1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKCFWZXJ0ZXhGb3JtYXQuaXNFbGVtZW50VmFsaWQoZGV2aWNlLCBlbGVtZW50KSkge1xuICAgICAgICAgICAgICAgIC8vIFdlYkdQIGRvZXMgbm90IHN1cHBvcnQgc29tZSBmb3JtYXRzIGFuZCB3ZSBuZWVkIHRvIHJlbWFwIGl0IHRvIG9uZSBsYXJnZXIsIGZvciBleGFtcGxlIGludDE2eDMgLT4gaW50MTZ4NFxuICAgICAgICAgICAgICAgIC8vIFRPRE86IHRoaXMgbWlnaHQgbmVlZCB0aGUgYWN0dWFsIGRhdGEgY2hhbmdlcyBpZiB0aGlzIGVsZW1lbnQgaXMgdGhlIGxhc3Qgb25lIGluIHRoZSB2ZXJ0ZXgsIGFzIGl0IG1pZ2h0XG4gICAgICAgICAgICAgICAgLy8gdHJ5IHRvIHJlYWQgb3V0c2lkZSBvZiB0aGUgdmVydGV4IGJ1ZmZlci5cbiAgICAgICAgICAgICAgICBlbGVtZW50LmNvbXBvbmVudHMrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZlcnRleERlc2MucHVzaChlbGVtZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdmVydGV4IGVsZW1lbnRzIGJ5IGVuZ2luZS1pZGVhbCBvcmRlclxuICAgIHZlcnRleERlc2Muc29ydCgobGhzLCByaHMpID0+IHtcbiAgICAgICAgcmV0dXJuIGF0dHJpYnV0ZU9yZGVyW2xocy5zZW1hbnRpY10gLSBhdHRyaWJ1dGVPcmRlcltyaHMuc2VtYW50aWNdO1xuICAgIH0pO1xuXG4gICAgbGV0IGksIGosIGs7XG4gICAgbGV0IHNvdXJjZSwgdGFyZ2V0LCBzb3VyY2VPZmZzZXQ7XG5cbiAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KGRldmljZSwgdmVydGV4RGVzYyk7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIHNvdXJjZSBkYXRhIGlzIGNvcnJlY3RseSBpbnRlcmxlYXZlZFxuICAgIGxldCBpc0NvcnJlY3RseUludGVybGVhdmVkID0gdHJ1ZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4Rm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHRhcmdldCA9IHZlcnRleEZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgc291cmNlID0gc291cmNlRGVzY1t0YXJnZXQubmFtZV07XG4gICAgICAgIHNvdXJjZU9mZnNldCA9IHNvdXJjZS5vZmZzZXQgLSBwb3NpdGlvbkRlc2Mub2Zmc2V0O1xuICAgICAgICBpZiAoKHNvdXJjZS5idWZmZXIgIT09IHBvc2l0aW9uRGVzYy5idWZmZXIpIHx8XG4gICAgICAgICAgICAoc291cmNlLnN0cmlkZSAhPT0gdGFyZ2V0LnN0cmlkZSkgfHxcbiAgICAgICAgICAgIChzb3VyY2Uuc2l6ZSAhPT0gdGFyZ2V0LnNpemUpIHx8XG4gICAgICAgICAgICAoc291cmNlT2Zmc2V0ICE9PSB0YXJnZXQub2Zmc2V0KSkge1xuICAgICAgICAgICAgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdmVydGV4IGJ1ZmZlclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4Rm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCVUZGRVJfU1RBVElDKTtcblxuICAgIGNvbnN0IHZlcnRleERhdGEgPSB2ZXJ0ZXhCdWZmZXIubG9jaygpO1xuICAgIGNvbnN0IHRhcmdldEFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHZlcnRleERhdGEpO1xuICAgIGxldCBzb3VyY2VBcnJheTtcblxuICAgIGlmIChpc0NvcnJlY3RseUludGVybGVhdmVkKSB7XG4gICAgICAgIC8vIGNvcHkgZGF0YVxuICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShwb3NpdGlvbkRlc2MuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbkRlc2Mub2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1WZXJ0aWNlcyAqIHZlcnRleEJ1ZmZlci5mb3JtYXQuc2l6ZSAvIDQpO1xuICAgICAgICB0YXJnZXRBcnJheS5zZXQoc291cmNlQXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCB0YXJnZXRTdHJpZGUsIHNvdXJjZVN0cmlkZTtcbiAgICAgICAgLy8gY29weSBkYXRhIGFuZCBpbnRlcmxlYXZlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGFyZ2V0U3RyaWRlID0gdGFyZ2V0LnN0cmlkZSAvIDQ7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICAgICAgc291cmNlU3RyaWRlID0gc291cmNlLnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAvLyBlbnN1cmUgd2UgZG9uJ3QgZ28gYmV5b25kIHRoZSBlbmQgb2YgdGhlIGFycmF5YnVmZmVyIHdoZW4gZGVhbGluZyB3aXRoXG4gICAgICAgICAgICAvLyBpbnRlcmxhY2VkIHZlcnRleCBmb3JtYXRzXG4gICAgICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShzb3VyY2UuYnVmZmVyLCBzb3VyY2Uub2Zmc2V0LCAoc291cmNlLmNvdW50IC0gMSkgKiBzb3VyY2VTdHJpZGUgKyAoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICBsZXQgc3JjID0gMDtcbiAgICAgICAgICAgIGxldCBkc3QgPSB0YXJnZXQub2Zmc2V0IC8gNDtcbiAgICAgICAgICAgIGNvbnN0IGtlbmQgPSBNYXRoLmZsb29yKChzb3VyY2Uuc2l6ZSArIDMpIC8gNCk7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBrZW5kOyArK2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0QXJyYXlbZHN0ICsga10gPSBzb3VyY2VBcnJheVtzcmMgKyBrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3JjICs9IHNvdXJjZVN0cmlkZTtcbiAgICAgICAgICAgICAgICBkc3QgKz0gdGFyZ2V0U3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIGZsaXBUZXhDb29yZFZzKHZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgdmVydGV4QnVmZmVyLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHZlcnRleEJ1ZmZlcjtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlciA9IChkZXZpY2UsIGF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KSA9PiB7XG5cbiAgICAvLyBleHRyYWN0IGxpc3Qgb2YgYXR0cmlidXRlcyB0byB1c2VcbiAgICBjb25zdCB1c2VBdHRyaWJ1dGVzID0ge307XG4gICAgY29uc3QgYXR0cmliSWRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgdXNlQXR0cmlidXRlc1thdHRyaWJdID0gYXR0cmlidXRlc1thdHRyaWJdO1xuXG4gICAgICAgICAgICAvLyBidWlsZCB1bmlxdWUgaWQgZm9yIGVhY2ggYXR0cmlidXRlIGluIGZvcm1hdDogU2VtYW50aWM6YWNjZXNzb3JJbmRleFxuICAgICAgICAgICAgYXR0cmliSWRzLnB1c2goYXR0cmliICsgJzonICsgYXR0cmlidXRlc1thdHRyaWJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdW5pcXVlIGlkcyBhbmQgY3JlYXRlIHVuaXF1ZSB2ZXJ0ZXggYnVmZmVyIElEXG4gICAgYXR0cmliSWRzLnNvcnQoKTtcbiAgICBjb25zdCB2YktleSA9IGF0dHJpYklkcy5qb2luKCk7XG5cbiAgICAvLyByZXR1cm4gYWxyZWFkeSBjcmVhdGVkIHZlcnRleCBidWZmZXIgaWYgaWRlbnRpY2FsXG4gICAgbGV0IHZiID0gdmVydGV4QnVmZmVyRGljdFt2YktleV07XG4gICAgaWYgKCF2Yikge1xuICAgICAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICAgICAgY29uc3Qgc291cmNlRGVzYyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiB1c2VBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvciA9IGFjY2Vzc29yc1thdHRyaWJ1dGVzW2F0dHJpYl1dO1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3JEYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbYWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW2F0dHJpYl07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSAqIGdldENvbXBvbmVudFNpemVJbkJ5dGVzKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gYnVmZmVyVmlldyAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykgPyBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgOiBzaXplO1xuICAgICAgICAgICAgc291cmNlRGVzY1tzZW1hbnRpY10gPSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyOiBhY2Nlc3NvckRhdGEuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiBhY2Nlc3NvckRhdGEuYnl0ZU9mZnNldCxcbiAgICAgICAgICAgICAgICBzdHJpZGU6IHN0cmlkZSxcbiAgICAgICAgICAgICAgICBjb3VudDogYWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBnZXRDb21wb25lbnRUeXBlKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYWNjZXNzb3Iubm9ybWFsaXplZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdlbmVyYXRlIG5vcm1hbHMgaWYgdGhleSdyZSBtaXNzaW5nICh0aGlzIHNob3VsZCBwcm9iYWJseSBiZSBhIHVzZXIgb3B0aW9uKVxuICAgICAgICBpZiAoIXNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoU0VNQU5USUNfTk9STUFMKSkge1xuICAgICAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCBzdG9yZSBpdCBpbiB0aGUgZGljdGlvbmFyeVxuICAgICAgICB2YiA9IGNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsKGRldmljZSwgc291cmNlRGVzYywgZmxpcFYpO1xuICAgICAgICB2ZXJ0ZXhCdWZmZXJEaWN0W3ZiS2V5XSA9IHZiO1xuICAgIH1cblxuICAgIHJldHVybiB2Yjtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW4gPSAoZGV2aWNlLCBnbHRmU2tpbiwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKSA9PiB7XG4gICAgbGV0IGksIGosIGJpbmRNYXRyaXg7XG4gICAgY29uc3Qgam9pbnRzID0gZ2x0ZlNraW4uam9pbnRzO1xuICAgIGNvbnN0IG51bUpvaW50cyA9IGpvaW50cy5sZW5ndGg7XG4gICAgY29uc3QgaWJwID0gW107XG4gICAgaWYgKGdsdGZTa2luLmhhc093blByb3BlcnR5KCdpbnZlcnNlQmluZE1hdHJpY2VzJykpIHtcbiAgICAgICAgY29uc3QgaW52ZXJzZUJpbmRNYXRyaWNlcyA9IGdsdGZTa2luLmludmVyc2VCaW5kTWF0cmljZXM7XG4gICAgICAgIGNvbnN0IGlibURhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW2ludmVyc2VCaW5kTWF0cmljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGlibVZhbHVlcyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IDE2OyBqKyspIHtcbiAgICAgICAgICAgICAgICBpYm1WYWx1ZXNbal0gPSBpYm1EYXRhW2kgKiAxNiArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBiaW5kTWF0cml4LnNldChpYm1WYWx1ZXMpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgYm9uZU5hbWVzW2ldID0gbm9kZXNbam9pbnRzW2ldXS5uYW1lO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIGNhY2hlIGtleSBmcm9tIGJvbmUgbmFtZXMgYW5kIHNlZSBpZiB3ZSBoYXZlIG1hdGNoaW5nIHNraW5cbiAgICBjb25zdCBrZXkgPSBib25lTmFtZXMuam9pbignIycpO1xuICAgIGxldCBza2luID0gZ2xiU2tpbnMuZ2V0KGtleSk7XG4gICAgaWYgKCFza2luKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSBza2luIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNraW4gPSBuZXcgU2tpbihkZXZpY2UsIGlicCwgYm9uZU5hbWVzKTtcbiAgICAgICAgZ2xiU2tpbnMuc2V0KGtleSwgc2tpbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNraW47XG59O1xuXG5jb25zdCBjcmVhdGVEcmFjb01lc2ggPSAoZGV2aWNlLCBwcmltaXRpdmUsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIHByb21pc2VzKSA9PiB7XG4gICAgLy8gY3JlYXRlIHRoZSBtZXNoXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICByZXN1bHQuYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3JzW3ByaW1pdGl2ZS5hdHRyaWJ1dGVzLlBPU0lUSU9OXSk7XG5cbiAgICAvLyBjcmVhdGUgdmVydGV4IGRlc2NyaXB0aW9uXG4gICAgY29uc3QgdmVydGV4RGVzYyA9IFtdO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGluZGV4XSBvZiBPYmplY3QuZW50cmllcyhwcmltaXRpdmUuYXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbaW5kZXhdO1xuICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW25hbWVdO1xuICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcblxuICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgc2VtYW50aWM6IHNlbWFudGljLFxuICAgICAgICAgICAgY29tcG9uZW50czogZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSxcbiAgICAgICAgICAgIHR5cGU6IGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWQgPz8gKHNlbWFudGljID09PSBTRU1BTlRJQ19DT0xPUiAmJiAoY29tcG9uZW50VHlwZSA9PT0gVFlQRV9VSU5UOCB8fCBjb21wb25lbnRUeXBlID09PSBUWVBFX1VJTlQxNikpXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb21pc2VzLnB1c2gobmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBkZWNvZGUgZHJhY28gZGF0YVxuICAgICAgICBjb25zdCBkcmFjb0V4dCA9IHByaW1pdGl2ZS5leHRlbnNpb25zLktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uO1xuICAgICAgICBkcmFjb0RlY29kZShidWZmZXJWaWV3c1tkcmFjb0V4dC5idWZmZXJWaWV3XS5zbGljZSgpLmJ1ZmZlciwgKGVyciwgZGVjb21wcmVzc2VkRGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHdvcmtlciByZXBvcnRzIG9yZGVyIG9mIGF0dHJpYnV0ZXMgYXMgYXJyYXkgb2YgYXR0cmlidXRlIHVuaXF1ZV9pZFxuICAgICAgICAgICAgICAgIGNvbnN0IG9yZGVyID0geyB9O1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW25hbWUsIGluZGV4XSBvZiBPYmplY3QuZW50cmllcyhkcmFjb0V4dC5hdHRyaWJ1dGVzKSkge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcltnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFtuYW1lXV0gPSBkZWNvbXByZXNzZWREYXRhLmF0dHJpYnV0ZXMuaW5kZXhPZihpbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gb3JkZXIgdmVydGV4RGVzY1xuICAgICAgICAgICAgICAgIHZlcnRleERlc2Muc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXJbYS5zZW1hbnRpY10gLSBvcmRlcltiLnNlbWFudGljXTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIGRyYWNvIGRlY29tcHJlc3NvciB3aWxsIGdlbmVyYXRlIG5vcm1hbHMgaWYgdGhleSBhcmUgbWlzc2luZ1xuICAgICAgICAgICAgICAgIGlmICghcHJpbWl0aXZlLmF0dHJpYnV0ZXM/Lk5PUk1BTCkge1xuICAgICAgICAgICAgICAgICAgICB2ZXJ0ZXhEZXNjLnNwbGljZSgxLCAwLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogJ05PUk1BTCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQoZGV2aWNlLCB2ZXJ0ZXhEZXNjKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgICAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSBkZWNvbXByZXNzZWREYXRhLnZlcnRpY2VzLmJ5dGVMZW5ndGggLyB2ZXJ0ZXhGb3JtYXQuc2l6ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleEZvcm1hdCA9IG51bVZlcnRpY2VzIDw9IDY1NTM1ID8gSU5ERVhGT1JNQVRfVUlOVDE2IDogSU5ERVhGT1JNQVRfVUlOVDMyO1xuICAgICAgICAgICAgICAgIGNvbnN0IG51bUluZGljZXMgPSBkZWNvbXByZXNzZWREYXRhLmluZGljZXMuYnl0ZUxlbmd0aCAvIChudW1WZXJ0aWNlcyA8PSA2NTUzNSA/IDIgOiA0KTtcblxuICAgICAgICAgICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobnVtVmVydGljZXMgIT09IGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl0uY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ21lc2ggaGFzIGludmFsaWQgdmVydGV4IGNvdW50Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG51bUluZGljZXMgIT09IGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10uY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ21lc2ggaGFzIGludmFsaWQgaW5kZXggY291bnQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcihkZXZpY2UsIHZlcnRleEZvcm1hdCwgbnVtVmVydGljZXMsIEJVRkZFUl9TVEFUSUMsIGRlY29tcHJlc3NlZERhdGEudmVydGljZXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKGRldmljZSwgaW5kZXhGb3JtYXQsIG51bUluZGljZXMsIEJVRkZFUl9TVEFUSUMsIGRlY29tcHJlc3NlZERhdGEuaW5kaWNlcyk7XG5cbiAgICAgICAgICAgICAgICByZXN1bHQudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5pbmRleEJ1ZmZlclswXSA9IGluZGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wcmltaXRpdmVbMF0udHlwZSA9IGdldFByaW1pdGl2ZVR5cGUocHJpbWl0aXZlKTtcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wcmltaXRpdmVbMF0uY291bnQgPSBpbmRleEJ1ZmZlciA/IG51bUluZGljZXMgOiBudW1WZXJ0aWNlcztcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAhIWluZGV4QnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KSk7XG5cbiAgICAvLyBoYW5kbGUgbWF0ZXJpYWwgdmFyaWFudHNcbiAgICBpZiAocHJpbWl0aXZlPy5leHRlbnNpb25zPy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzKSB7XG4gICAgICAgIGNvbnN0IHZhcmlhbnRzID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cztcbiAgICAgICAgY29uc3QgdGVtcE1hcHBpbmcgPSB7fTtcbiAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgbWFwcGluZy52YXJpYW50cy5mb3JFYWNoKCh2YXJpYW50KSA9PiB7XG4gICAgICAgICAgICAgICAgdGVtcE1hcHBpbmdbdmFyaWFudF0gPSBtYXBwaW5nLm1hdGVyaWFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBtZXNoVmFyaWFudHNbcmVzdWx0LmlkXSA9IHRlbXBNYXBwaW5nO1xuICAgIH1cbiAgICBtZXNoRGVmYXVsdE1hdGVyaWFsc1tyZXN1bHQuaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmNvbnN0IGNyZWF0ZU1lc2ggPSAoZGV2aWNlLCBnbHRmTWVzaCwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIGFzc2V0T3B0aW9ucywgcHJvbWlzZXMpID0+IHtcbiAgICBjb25zdCBtZXNoZXMgPSBbXTtcblxuICAgIGdsdGZNZXNoLnByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG5cbiAgICAgICAgaWYgKHByaW1pdGl2ZS5leHRlbnNpb25zPy5LSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbikge1xuICAgICAgICAgICAgLy8gaGFuZGxlIGRyYWNvIGNvbXByZXNzZWQgbWVzaFxuICAgICAgICAgICAgbWVzaGVzLnB1c2goY3JlYXRlRHJhY29NZXNoKGRldmljZSwgcHJpbWl0aXZlLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBwcm9taXNlcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaGFuZGxlIHVuY29tcHJlc3NlZCBtZXNoXG4gICAgICAgICAgICBsZXQgaW5kaWNlcyA9IHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnaW5kaWNlcycpID8gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10sIGJ1ZmZlclZpZXdzLCB0cnVlKSA6IG51bGw7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXIoZGV2aWNlLCBwcmltaXRpdmUuYXR0cmlidXRlcywgaW5kaWNlcywgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QpO1xuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVHlwZSA9IGdldFByaW1pdGl2ZVR5cGUocHJpbWl0aXZlKTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdGhlIG1lc2hcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gcHJpbWl0aXZlVHlwZTtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IChpbmRpY2VzICE9PSBudWxsKTtcblxuICAgICAgICAgICAgLy8gaW5kZXggYnVmZmVyXG4gICAgICAgICAgICBpZiAoaW5kaWNlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleEZvcm1hdDtcbiAgICAgICAgICAgICAgICBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UODtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50MTZBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQzMjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyAzMmJpdCBpbmRleCBidWZmZXIgaXMgdXNlZCBidXQgbm90IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIGlmIChpbmRleEZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDMyICYmICFkZXZpY2UuZXh0VWludEVsZW1lbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgPiAweEZGRkYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignR2xiIGZpbGUgY29udGFpbnMgMzJiaXQgaW5kZXggYnVmZmVyIGJ1dCB0aGVzZSBhcmUgbm90IHN1cHBvcnRlZCBieSB0aGlzIGRldmljZSAtIGl0IG1heSBiZSByZW5kZXJlZCBpbmNvcnJlY3RseS4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIDE2Yml0XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGluZGljZXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpbmRleEZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDggJiYgZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDhiaXQgaW5kZXggYnVmZmVyIGJ1dCB0aGVzZSBhcmUgbm90IHN1cHBvcnRlZCBieSBXZWJHUFUgLSBjb252ZXJ0aW5nIHRvIDE2Yml0LicpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gMTZiaXRcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEZvcm1hdCwgaW5kaWNlcy5sZW5ndGgsIEJVRkZFUl9TVEFUSUMsIGluZGljZXMpO1xuICAgICAgICAgICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgJiYgcHJpbWl0aXZlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudHMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgICAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLnZhcmlhbnRzLmZvckVhY2goKHZhcmlhbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbWVzaFZhcmlhbnRzW21lc2guaWRdID0gdGVtcE1hcHBpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBsZXQgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbcHJpbWl0aXZlLmF0dHJpYnV0ZXMuUE9TSVRJT05dO1xuICAgICAgICAgICAgbWVzaC5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG5cbiAgICAgICAgICAgIC8vIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ3RhcmdldHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZS50YXJnZXRzLmZvckVhY2goKHRhcmdldCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ1BPU0lUSU9OJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5QT1NJVElPTl07XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9uc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ05PUk1BTCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuTk9STUFMXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHRoZSBtb3JwaCB0YXJnZXRzIGNhbid0IGN1cnJlbnRseSBhY2NlcHQgcXVhbnRpemVkIG5vcm1hbHNcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbmFtZSBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0Zk1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBnbHRmTWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gaW5kZXgudG9TdHJpbmcoMTApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCB3ZWlnaHQgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRXZWlnaHQgPSBnbHRmTWVzaC53ZWlnaHRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucHJlc2VydmVEYXRhID0gYXNzZXRPcHRpb25zLm1vcnBoUHJlc2VydmVEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRzLnB1c2gobmV3IE1vcnBoVGFyZ2V0KG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIG1lc2gubW9ycGggPSBuZXcgTW9ycGgodGFyZ2V0cywgZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgICAgIHByZWZlckhpZ2hQcmVjaXNpb246IGFzc2V0T3B0aW9ucy5tb3JwaFByZWZlckhpZ2hQcmVjaXNpb25cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lc2hlcy5wdXNoKG1lc2gpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzaGVzO1xufTtcblxuY29uc3QgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0gPSAoc291cmNlLCBtYXRlcmlhbCwgbWFwcykgPT4ge1xuICAgIGxldCBtYXA7XG5cbiAgICBjb25zdCB0ZXhDb29yZCA9IHNvdXJjZS50ZXhDb29yZDtcbiAgICBpZiAodGV4Q29vcmQpIHtcbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW21hcHNbbWFwXSArICdNYXBVdiddID0gdGV4Q29vcmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB6ZXJvcyA9IFswLCAwXTtcbiAgICBjb25zdCBvbmVzID0gWzEsIDFdO1xuICAgIGNvbnN0IHRleHR1cmVUcmFuc2Zvcm0gPSBzb3VyY2UuZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfdHJhbnNmb3JtO1xuICAgIGlmICh0ZXh0dXJlVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRleHR1cmVUcmFuc2Zvcm0ub2Zmc2V0IHx8IHplcm9zO1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRleHR1cmVUcmFuc2Zvcm0uc2NhbGUgfHwgb25lcztcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSB0ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uID8gKC10ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uICogbWF0aC5SQURfVE9fREVHKSA6IDA7XG5cbiAgICAgICAgY29uc3QgdGlsaW5nVmVjID0gbmV3IFZlYzIoc2NhbGVbMF0sIHNjYWxlWzFdKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0VmVjID0gbmV3IFZlYzIob2Zmc2V0WzBdLCAxLjAgLSBzY2FsZVsxXSAtIG9mZnNldFsxXSk7XG5cbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBUaWxpbmdgXSA9IHRpbGluZ1ZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBPZmZzZXRgXSA9IG9mZnNldFZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBSb3RhdGlvbmBdID0gcm90YXRpb247XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuZGlmZnVzZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBkaWZmdXNlVGV4dHVyZSA9IGRhdGEuZGlmZnVzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tkaWZmdXNlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkaWZmdXNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgIH1cbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZ2xvc3NpbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzID0gZGF0YS5nbG9zc2luZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzID0gMS4wO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUgPSBkYXRhLnNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwID0gbWF0ZXJpYWwuZ2xvc3NNYXAgPSB0ZXh0dXJlc1tzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzTWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydnbG9zcycsICdtZXRhbG5lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uQ2xlYXJDb2F0ID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSBkYXRhLmNsZWFyY29hdEZhY3RvciAqIDAuMjU7IC8vIFRPRE86IHJlbW92ZSB0ZW1wb3Jhcnkgd29ya2Fyb3VuZCBmb3IgcmVwbGljYXRpbmcgZ2xURiBjbGVhci1jb2F0IHZpc3VhbHNcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0VGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFRleHR1cmUgPSBkYXRhLmNsZWFyY29hdFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcCA9IHRleHR1cmVzW2NsZWFyY29hdFRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXBDaGFubmVsID0gJ3InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdFRleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdCddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3MgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXRHbG9zcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdE5vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXROb3JtYWxUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXROb3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXROb3JtYWxNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXROb3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXROb3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKGNsZWFyY29hdE5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEJ1bXBpbmVzcyA9IGNsZWFyY29hdE5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc0ludmVydCA9IHRydWU7XG59O1xuXG5jb25zdCBleHRlbnNpb25VbmxpdCA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuXG4gICAgLy8gY29weSBkaWZmdXNlIGludG8gZW1pc3NpdmVcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZS5jb3B5KG1hdGVyaWFsLmRpZmZ1c2UpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IG1hdGVyaWFsLmRpZmZ1c2VUaW50O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gbWF0ZXJpYWwuZGlmZnVzZU1hcDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFV2ID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFV2O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVGlsaW5nLmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcFRpbGluZyk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBPZmZzZXQuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwT2Zmc2V0KTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFJvdGF0aW9uID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFJvdGF0aW9uO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3IgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3I7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsO1xuXG4gICAgLy8gZGlzYWJsZSBsaWdodGluZyBhbmQgc2t5Ym94XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcbiAgICBtYXRlcmlhbC51c2VTa3lib3ggPSBmYWxzZTtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJDb2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJDb2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yTWFwID0gdGV4dHVyZXNbZGF0YS5zcGVjdWxhclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNwZWN1bGFyVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXJpdHlGYWN0b3InXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uSW9yID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpb3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uSW5kZXggPSAxLjAgLyBkYXRhLmlvcjtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25UcmFuc21pc3Npb24gPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25GYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uID0gZGF0YS50cmFuc21pc3Npb25GYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25UZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbk1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXAgPSB0ZXh0dXJlc1tkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUsIG1hdGVyaWFsLCBbJ3JlZnJhY3Rpb24nXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uU2hlZW4gPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlU2hlZW4gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLnNoZWVuQ29sb3JGYWN0b3I7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoMSwgMSwgMSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuTWFwID0gdGV4dHVyZXNbZGF0YS5zaGVlbkNvbG9yVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Db2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Sb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzID0gZGF0YS5zaGVlblJvdWdobmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzID0gMC4wO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Sb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc01hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc01hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbkdsb3NzJ10pO1xuICAgIH1cblxuICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NJbnZlcnQgPSB0cnVlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVm9sdW1lID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnRoaWNrbmVzcyA9IGRhdGEudGhpY2tuZXNzRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndGhpY2tuZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnRoaWNrbmVzc01hcCA9IHRleHR1cmVzW2RhdGEudGhpY2tuZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEudGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsndGhpY2tuZXNzJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25EaXN0YW5jZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmF0dGVudWF0aW9uRGlzdGFuY2UgPSBkYXRhLmF0dGVudWF0aW9uRGlzdGFuY2U7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdhdHRlbnVhdGlvbkNvbG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLmF0dGVudWF0aW9uQ29sb3I7XG4gICAgICAgIG1hdGVyaWFsLmF0dGVudWF0aW9uLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZVN0cmVuZ3RoJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVJbnRlbnNpdHkgPSBkYXRhLmVtaXNzaXZlU3RyZW5ndGg7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uSXJpZGVzY2VuY2UgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlSXJpZGVzY2VuY2UgPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZUZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlID0gZGF0YS5pcmlkZXNjZW5jZUZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwQ2hhbm5lbCA9ICdyJztcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VNYXAgPSB0ZXh0dXJlc1tkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuaXJpZGVzY2VuY2VUZXh0dXJlLCBtYXRlcmlhbCwgWydpcmlkZXNjZW5jZSddKTtcblxuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VJb3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCA9IGRhdGEuaXJpZGVzY2VuY2VJb3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01pbmltdW0nKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbiA9IGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXggPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwQ2hhbm5lbCA9ICdnJztcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydpcmlkZXNjZW5jZVRoaWNrbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbCA9IChnbHRmTWF0ZXJpYWwsIHRleHR1cmVzLCBmbGlwVikgPT4ge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcblxuICAgIC8vIGdsVEYgZG9lc24ndCBkZWZpbmUgaG93IHRvIG9jY2x1ZGUgc3BlY3VsYXJcbiAgICBtYXRlcmlhbC5vY2NsdWRlU3BlY3VsYXIgPSBTUEVDT0NDX0FPO1xuXG4gICAgbWF0ZXJpYWwuZGlmZnVzZVRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBtYXRlcmlhbC5zcGVjdWxhclRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLnNwZWN1bGFyVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBnbHRmTWF0ZXJpYWwubmFtZTtcbiAgICB9XG5cbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgncGJyTWV0YWxsaWNSb3VnaG5lc3MnKSkge1xuICAgICAgICBjb25zdCBwYnJEYXRhID0gZ2x0Zk1hdGVyaWFsLnBick1ldGFsbGljUm91Z2huZXNzO1xuXG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JGYWN0b3InKSkge1xuICAgICAgICAgICAgY29sb3IgPSBwYnJEYXRhLmJhc2VDb2xvckZhY3RvcjtcbiAgICAgICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb2xvclRleHR1cmUgPSBwYnJEYXRhLmJhc2VDb2xvclRleHR1cmU7XG4gICAgICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbYmFzZUNvbG9yVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGJhc2VDb2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSBwYnJEYXRhLm1ldGFsbGljRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgncm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzID0gcGJyRGF0YS5yb3VnaG5lc3NGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3NJbnZlcnQgPSB0cnVlO1xuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSA9IHBickRhdGEubWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzTWFwID0gbWF0ZXJpYWwuZ2xvc3NNYXAgPSB0ZXh0dXJlc1ttZXRhbGxpY1JvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzTWFwQ2hhbm5lbCA9ICdiJztcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydnbG9zcycsICdtZXRhbG5lc3MnXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdub3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgbm9ybWFsVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5ub3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5ub3JtYWxNYXAgPSB0ZXh0dXJlc1tub3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShub3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydub3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKG5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmJ1bXBpbmVzcyA9IG5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdvY2NsdXNpb25UZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgb2NjbHVzaW9uVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5vY2NsdXNpb25UZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5hb01hcCA9IHRleHR1cmVzW29jY2x1c2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5hb01hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0ob2NjbHVzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsnYW8nXSk7XG4gICAgICAgIC8vIFRPRE86IHN1cHBvcnQgJ3N0cmVuZ3RoJ1xuICAgIH1cblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KDAsIDAsIDApO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBlbWlzc2l2ZVRleHR1cmUgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IHRleHR1cmVzW2VtaXNzaXZlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZW1pc3NpdmVUZXh0dXJlLCBtYXRlcmlhbCwgWydlbWlzc2l2ZSddKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYU1vZGUnKSkge1xuICAgICAgICBzd2l0Y2ggKGdsdGZNYXRlcmlhbC5hbHBoYU1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ01BU0snOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFDdXRvZmYnKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSBnbHRmTWF0ZXJpYWwuYWxwaGFDdXRvZmY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0JMRU5EJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG5cbiAgICAgICAgICAgICAgICAvLyBub3RlOiBieSBkZWZhdWx0IGRvbid0IHdyaXRlIGRlcHRoIG9uIHNlbWl0cmFuc3BhcmVudCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY2FzZSAnT1BBUVVFJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lyaWRlc2NlbmNlXCI6IGV4dGVuc2lvbklyaWRlc2NlbmNlLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfcGJyU3BlY3VsYXJHbG9zc2luZXNzXCI6IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc2hlZW5cIjogZXh0ZW5zaW9uU2hlZW4sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zcGVjdWxhclwiOiBleHRlbnNpb25TcGVjdWxhcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3RyYW5zbWlzc2lvblwiOiBleHRlbnNpb25UcmFuc21pc3Npb24sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc191bmxpdFwiOiBleHRlbnNpb25VbmxpdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3ZvbHVtZVwiOiBleHRlbnNpb25Wb2x1bWVcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzLCBnbHRmTm9kZXMpID0+IHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSAoZ2x0ZkFjY2Vzc29yKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBvdXQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XTtcbiAgICAgICAgaWYgKCFvdXQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuYW1lcyBvZiBtb3JwaCB0YXJnZXRzXG4gICAgICAgIGxldCB0YXJnZXROYW1lcztcbiAgICAgICAgaWYgKG1lc2hlcyAmJiBtZXNoZXNbZ2x0Zk5vZGUubWVzaF0pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbZ2x0Zk5vZGUubWVzaF07XG4gICAgICAgICAgICBpZiAobWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiYgbWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXROYW1lcyA9IG1lc2guZXh0cmFzLnRhcmdldE5hbWVzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3V0RGF0YSA9IG91dC5kYXRhO1xuICAgICAgICBjb25zdCBtb3JwaFRhcmdldENvdW50ID0gb3V0RGF0YS5sZW5ndGggLyBpbnB1dE1hcFtjdXJ2ZS5pbnB1dF0uZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGtleWZyYW1lQ291bnQgPSBvdXREYXRhLmxlbmd0aCAvIG1vcnBoVGFyZ2V0Q291bnQ7XG5cbiAgICAgICAgLy8gc2luZ2xlIGFycmF5IGJ1ZmZlciBmb3IgYWxsIGtleXMsIDQgYnl0ZXMgcGVyIGVudHJ5XG4gICAgICAgIGNvbnN0IHNpbmdsZUJ1ZmZlclNpemUgPSBrZXlmcmFtZUNvdW50ICogNDtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKHNpbmdsZUJ1ZmZlclNpemUgKiBtb3JwaFRhcmdldENvdW50KTtcblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1vcnBoVGFyZ2V0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRPdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlciwgc2luZ2xlQnVmZmVyU2l6ZSAqIGosIGtleWZyYW1lQ291bnQpO1xuXG4gICAgICAgICAgICAvLyB0aGUgb3V0cHV0IGRhdGEgZm9yIGFsbCBtb3JwaCB0YXJnZXRzIGluIGEgc2luZ2xlIGN1cnZlIGlzIGludGVybGVhdmVkLiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBrZXlmcmFtZSBvdXRwdXQgZGF0YSBmb3IgYSBzaW5nbGUgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGtleWZyYW1lQ291bnQ7IGsrKykge1xuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0T3V0cHV0W2tdID0gb3V0RGF0YVtrICogbW9ycGhUYXJnZXRDb3VudCArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gbmV3IEFuaW1EYXRhKDEsIG1vcnBoVGFyZ2V0T3V0cHV0KTtcbiAgICAgICAgICAgIGNvbnN0IHdlaWdodE5hbWUgPSB0YXJnZXROYW1lcz8uW2pdID8gYG5hbWUuJHt0YXJnZXROYW1lc1tqXX1gIDogajtcblxuICAgICAgICAgICAgLy8gYWRkIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBvdXRwdXQgZGF0YSB0byB0aGUgb3V0cHV0TWFwIHVzaW5nIGEgbmVnYXRpdmUgdmFsdWUga2V5IChzbyBhcyBub3QgdG8gY2xhc2ggd2l0aCBzYW1wbGVyLm91dHB1dCB2YWx1ZXMpXG4gICAgICAgICAgICBvdXRwdXRNYXBbLW91dHB1dENvdW50ZXJdID0gb3V0cHV0O1xuICAgICAgICAgICAgY29uc3QgbW9ycGhDdXJ2ZSA9IHtcbiAgICAgICAgICAgICAgICBwYXRoczogW3tcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFtgd2VpZ2h0LiR7d2VpZ2h0TmFtZX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2x0Zk5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhcyBhbGwgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXRzIGluIHRoaXMgbW9ycGggY3VydmUgaGF2ZSB0aGVpciBvd24gY3VydmUgbm93LCB0aGlzIG1vcnBoIGN1cnZlIHNob3VsZCBiZSBmbGFnZ2VkXG4gICAgICAgICAgICAvLyBzbyBpdCdzIG5vdCBpbmNsdWRlZCBpbiB0aGUgZmluYWwgb3V0cHV0XG4gICAgICAgICAgICBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdLm1vcnBoQ3VydmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VydmUucGF0aHMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbdHJhbnNmb3JtU2NoZW1hW3RhcmdldC5wYXRoXV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gW107XG4gICAgY29uc3Qgb3V0cHV0cyA9IFtdO1xuICAgIGNvbnN0IGN1cnZlcyA9IFtdO1xuXG4gICAgLy8gQWRkIGVhY2ggaW5wdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgaW5wdXRzIGFycmF5LiBUaGUgaW5wdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIGlucHV0IGluIHRoZSBpbnB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgaW5wdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3QgaW5wdXRLZXkgaW4gaW5wdXRNYXApIHtcbiAgICAgICAgaW5wdXRzLnB1c2goaW5wdXRNYXBbaW5wdXRLZXldKTtcbiAgICAgICAgaW5wdXRNYXBbaW5wdXRLZXldID0gaW5wdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIEFkZCBlYWNoIG91dHB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBvdXRwdXRzIGFycmF5LiBUaGUgb3V0cHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBvdXRwdXQgaW4gdGhlIG91dHB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgb3V0cHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IG91dHB1dEtleSBpbiBvdXRwdXRNYXApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKG91dHB1dE1hcFtvdXRwdXRLZXldKTtcbiAgICAgICAgb3V0cHV0TWFwW291dHB1dEtleV0gPSBvdXRwdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhbiBBbmltQ3VydmUgZm9yIGVhY2ggY3VydmUgb2JqZWN0IGluIHRoZSBjdXJ2ZU1hcC4gRWFjaCBjdXJ2ZSBvYmplY3QncyBpbnB1dCB2YWx1ZSBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gdGhlIGluZGV4IG9mIHRoZSBpbnB1dCBpbiB0aGVcbiAgICAvLyBpbnB1dHMgYXJyYXlzIHVzaW5nIHRoZSBpbnB1dE1hcC4gTGlrZXdpc2UgZm9yIG91dHB1dCB2YWx1ZXMuXG4gICAgZm9yIChjb25zdCBjdXJ2ZUtleSBpbiBjdXJ2ZU1hcCkge1xuICAgICAgICBjb25zdCBjdXJ2ZURhdGEgPSBjdXJ2ZU1hcFtjdXJ2ZUtleV07XG4gICAgICAgIC8vIGlmIHRoZSBjdXJ2ZURhdGEgY29udGFpbnMgYSBtb3JwaCBjdXJ2ZSB0aGVuIGRvIG5vdCBhZGQgaXQgdG8gdGhlIGZpbmFsIGN1cnZlIGxpc3QgYXMgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IGN1cnZlcyBhcmUgaW5jbHVkZWQgaW5zdGVhZFxuICAgICAgICBpZiAoY3VydmVEYXRhLm1vcnBoQ3VydmUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnZlcy5wdXNoKG5ldyBBbmltQ3VydmUoXG4gICAgICAgICAgICBjdXJ2ZURhdGEucGF0aHMsXG4gICAgICAgICAgICBpbnB1dE1hcFtjdXJ2ZURhdGEuaW5wdXRdLFxuICAgICAgICAgICAgb3V0cHV0TWFwW2N1cnZlRGF0YS5vdXRwdXRdLFxuICAgICAgICAgICAgY3VydmVEYXRhLmludGVycG9sYXRpb25cbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyB0YXJnZXQgaXMgYSBzZXQgb2YgcXVhdGVybmlvbiBrZXlzLCBtYWtlIG5vdGUgb2YgaXRzIGluZGV4IHNvIHdlIGNhbiBwZXJmb3JtXG4gICAgICAgIC8vIHF1YXRlcm5pb24tc3BlY2lmaWMgcHJvY2Vzc2luZyBvbiBpdC5cbiAgICAgICAgaWYgKGN1cnZlRGF0YS5wYXRocy5sZW5ndGggPiAwICYmIGN1cnZlRGF0YS5wYXRoc1swXS5wcm9wZXJ0eVBhdGhbMF0gPT09ICdsb2NhbFJvdGF0aW9uJyAmJiBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvbiAhPT0gSU5URVJQT0xBVElPTl9DVUJJQykge1xuICAgICAgICAgICAgcXVhdEFycmF5cy5wdXNoKGN1cnZlc1tjdXJ2ZXMubGVuZ3RoIC0gMV0ub3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdGhlIGxpc3Qgb2YgYXJyYXkgaW5kZXhlcyBzbyB3ZSBjYW4gc2tpcCBkdXBzXG4gICAgcXVhdEFycmF5cy5zb3J0KCk7XG5cbiAgICAvLyBydW4gdGhyb3VnaCB0aGUgcXVhdGVybmlvbiBkYXRhIGFycmF5cyBmbGlwcGluZyBxdWF0ZXJuaW9uIGtleXNcbiAgICAvLyB0aGF0IGRvbid0IGZhbGwgaW4gdGhlIHNhbWUgd2luZGluZyBvcmRlci5cbiAgICBsZXQgcHJldkluZGV4ID0gbnVsbDtcbiAgICBsZXQgZGF0YTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcXVhdEFycmF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHF1YXRBcnJheXNbaV07XG4gICAgICAgIC8vIHNraXAgb3ZlciBkdXBsaWNhdGUgYXJyYXkgaW5kaWNlc1xuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpbmRleCAhPT0gcHJldkluZGV4KSB7XG4gICAgICAgICAgICBkYXRhID0gb3V0cHV0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAoZGF0YS5jb21wb25lbnRzID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZCA9IGRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSBkLmxlbmd0aCAtIDQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGogKz0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcCA9IGRbaiArIDBdICogZFtqICsgNF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAxXSAqIGRbaiArIDVdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMl0gKiBkW2ogKyA2XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDNdICogZFtqICsgN107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRwIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNF0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA1XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDZdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgN10gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2SW5kZXggPSBpbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBkdXJhdGlvbiBvZiB0aGUgYW5pbWF0aW9uIGFzIG1heGltdW0gdGltZSB2YWx1ZVxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkYXRhICA9IGlucHV0c1tpXS5fZGF0YTtcbiAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgZGF0YS5sZW5ndGggPT09IDAgPyAwIDogZGF0YVtkYXRhLmxlbmd0aCAtIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFuaW1UcmFjayhcbiAgICAgICAgZ2x0ZkFuaW1hdGlvbi5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpID8gZ2x0ZkFuaW1hdGlvbi5uYW1lIDogKCdhbmltYXRpb25fJyArIGFuaW1hdGlvbkluZGV4KSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgY3VydmVzKTtcbn07XG5cbmNvbnN0IHRlbXBNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IGNyZWF0ZU5vZGUgPSAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkgPT4ge1xuICAgIGNvbnN0IGVudGl0eSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpICYmIGdsdGZOb2RlLm5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRpdHkubmFtZSA9IGdsdGZOb2RlLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSAnbm9kZV8nICsgbm9kZUluZGV4O1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRyYW5zZm9ybWF0aW9uIHByb3BlcnRpZXNcbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21hdHJpeCcpKSB7XG4gICAgICAgIHRlbXBNYXQuZGF0YS5zZXQoZ2x0Zk5vZGUubWF0cml4KTtcbiAgICAgICAgdGVtcE1hdC5nZXRUcmFuc2xhdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0RXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldFNjYWxlKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZSh0ZW1wVmVjKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3JvdGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgciA9IGdsdGZOb2RlLnJvdGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihyWzBdLCByWzFdLCByWzJdLCByWzNdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3RyYW5zbGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgdCA9IGdsdGZOb2RlLnRyYW5zbGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0WzBdLCB0WzFdLCB0WzJdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgY29uc3QgcyA9IGdsdGZOb2RlLnNjYWxlO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBhIGNhbWVyYSBjb21wb25lbnQgb24gdGhlIHN1cHBsaWVkIG5vZGUsIGFuZCByZXR1cm5zIGl0XG5jb25zdCBjcmVhdGVDYW1lcmEgPSAoZ2x0ZkNhbWVyYSwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgcHJvamVjdGlvbiA9IGdsdGZDYW1lcmEudHlwZSA9PT0gJ29ydGhvZ3JhcGhpYycgPyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgY29uc3QgZ2x0ZlByb3BlcnRpZXMgPSBwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IGdsdGZDYW1lcmEub3J0aG9ncmFwaGljIDogZ2x0ZkNhbWVyYS5wZXJzcGVjdGl2ZTtcblxuICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBwcm9qZWN0aW9uOiBwcm9qZWN0aW9uLFxuICAgICAgICBuZWFyQ2xpcDogZ2x0ZlByb3BlcnRpZXMuem5lYXIsXG4gICAgICAgIGFzcGVjdFJhdGlvTW9kZTogQVNQRUNUX0FVVE9cbiAgICB9O1xuXG4gICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnpmYXIpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mYXJDbGlwID0gZ2x0ZlByb3BlcnRpZXMuemZhcjtcbiAgICB9XG5cbiAgICBpZiAocHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5vcnRob0hlaWdodCA9IDAuNSAqIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy55bWFnKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMueG1hZyAvIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnREYXRhLmZvdiA9IGdsdGZQcm9wZXJ0aWVzLnlmb3YgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FtZXJhRW50aXR5ID0gbmV3IEVudGl0eShnbHRmQ2FtZXJhLm5hbWUpO1xuICAgIGNhbWVyYUVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIGNvbXBvbmVudERhdGEpO1xuICAgIHJldHVybiBjYW1lcmFFbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGxpZ2h0IGNvbXBvbmVudCwgYWRkcyBpdCB0byB0aGUgbm9kZSBhbmQgcmV0dXJucyB0aGUgY3JlYXRlZCBsaWdodCBjb21wb25lbnRcbmNvbnN0IGNyZWF0ZUxpZ2h0ID0gKGdsdGZMaWdodCwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgbGlnaHRQcm9wcyA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHR5cGU6IGdsdGZMaWdodC50eXBlID09PSAncG9pbnQnID8gJ29tbmknIDogZ2x0ZkxpZ2h0LnR5cGUsXG4gICAgICAgIGNvbG9yOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2NvbG9yJykgPyBuZXcgQ29sb3IoZ2x0ZkxpZ2h0LmNvbG9yKSA6IENvbG9yLldISVRFLFxuXG4gICAgICAgIC8vIHdoZW4gcmFuZ2UgaXMgbm90IGRlZmluZWQsIGluZmluaXR5IHNob3VsZCBiZSB1c2VkIC0gYnV0IHRoYXQgaXMgY2F1c2luZyBpbmZpbml0eSBpbiBib3VuZHMgY2FsY3VsYXRpb25zXG4gICAgICAgIHJhbmdlOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3JhbmdlJykgPyBnbHRmTGlnaHQucmFuZ2UgOiA5OTk5LFxuXG4gICAgICAgIGZhbGxvZmZNb2RlOiBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG5cbiAgICAgICAgLy8gVE9ETzogKGVuZ2luZSBpc3N1ZSAjMzI1MikgU2V0IGludGVuc2l0eSB0byBtYXRjaCBnbFRGIHNwZWNpZmljYXRpb24sIHdoaWNoIHVzZXMgcGh5c2ljYWxseSBiYXNlZCB2YWx1ZXM6XG4gICAgICAgIC8vIC0gT21uaSBhbmQgc3BvdCBsaWdodHMgdXNlIGx1bWlub3VzIGludGVuc2l0eSBpbiBjYW5kZWxhIChsbS9zcilcbiAgICAgICAgLy8gLSBEaXJlY3Rpb25hbCBsaWdodHMgdXNlIGlsbHVtaW5hbmNlIGluIGx1eCAobG0vbTIpLlxuICAgICAgICAvLyBDdXJyZW50IGltcGxlbWVudGF0aW9uOiBjbGFwbXMgc3BlY2lmaWVkIGludGVuc2l0eSB0byAwLi4yIHJhbmdlXG4gICAgICAgIGludGVuc2l0eTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSA/IG1hdGguY2xhbXAoZ2x0ZkxpZ2h0LmludGVuc2l0eSwgMCwgMikgOiAxXG4gICAgfTtcblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3Nwb3QnKSkge1xuICAgICAgICBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5pbm5lckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IDA7XG4gICAgICAgIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogTWF0aC5QSSAvIDQ7XG4gICAgfVxuXG4gICAgLy8gZ2xURiBzdG9yZXMgbGlnaHQgYWxyZWFkeSBpbiBlbmVyZ3kvYXJlYSwgYnV0IHdlIG5lZWQgdG8gcHJvdmlkZSB0aGUgbGlnaHQgd2l0aCBvbmx5IHRoZSBlbmVyZ3kgcGFyYW1ldGVyLFxuICAgIC8vIHNvIHdlIG5lZWQgdGhlIGludGVuc2l0aWVzIGluIGNhbmRlbGEgYmFjayB0byBsdW1lblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoXCJpbnRlbnNpdHlcIikpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbihsaWdodFR5cGVzW2xpZ2h0UHJvcHMudHlwZV0sIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUsIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUpO1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcCgoZ2x0ZlNraW4pID0+IHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGZsaXBWLCBvcHRpb25zKSA9PiB7XG4gICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggYnVmZmVycyB0byBhdm9pZCBkdXBsaWNhdGVzXG4gICAgY29uc3QgdmVydGV4QnVmZmVyRGljdCA9IHt9O1xuICAgIGNvbnN0IG1lc2hWYXJpYW50cyA9IHt9O1xuICAgIGNvbnN0IG1lc2hEZWZhdWx0TWF0ZXJpYWxzID0ge307XG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcblxuICAgIGNvbnN0IHZhbGlkID0gKCFvcHRpb25zLnNraXBNZXNoZXMgJiYgZ2x0Zj8ubWVzaGVzPy5sZW5ndGggJiYgZ2x0Zj8uYWNjZXNzb3JzPy5sZW5ndGggJiYgZ2x0Zj8uYnVmZmVyVmlld3M/Lmxlbmd0aCk7XG4gICAgY29uc3QgbWVzaGVzID0gdmFsaWQgPyBnbHRmLm1lc2hlcy5tYXAoKGdsdGZNZXNoKSA9PiB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMsIHByb21pc2VzKTtcbiAgICB9KSA6IFtdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWVzaGVzLFxuICAgICAgICBtZXNoVmFyaWFudHMsXG4gICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLFxuICAgICAgICBwcm9taXNlc1xuICAgIH07XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubWF0ZXJpYWw/LnByb2Nlc3MgPz8gY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKChnbHRmTWF0ZXJpYWwpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gKGdsdGYpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKChnbHRmQW5pbWF0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzLCBnbHRmLm5vZGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IChnbHRmLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJvY2VzcyA/PyBjcmVhdGVOb2RlO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKChnbHRmTm9kZSwgaW5kZXgpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSAoZ2x0Ziwgbm9kZXMpID0+IHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpID0+IHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByb2Nlc3MgPz8gY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnM/LmNhbWVyYT8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcmVwcm9jZXNzO1xuICAgICAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcm9jZXNzID8/IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5saWdodD8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpID0+IHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBhc3luYyAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZXMsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG5cbiAgICAvLyBidWZmZXIgZGF0YSBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWVzaGVzIGFuZCBhbmltYXRpb25zXG4gICAgY29uc3QgYnVmZmVyVmlld0RhdGEgPSBhd2FpdCBQcm9taXNlLmFsbChidWZmZXJWaWV3cyk7XG4gICAgY29uc3QgeyBtZXNoZXMsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIHByb21pc2VzIH0gPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3RGF0YSwgZmxpcFYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3RGF0YSwgb3B0aW9ucyk7XG5cbiAgICAvLyB0ZXh0dXJlcyBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWF0ZXJpYWxzXG4gICAgY29uc3QgdGV4dHVyZUFzc2V0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRleHR1cmVzKTtcbiAgICBjb25zdCB0ZXh0dXJlSW5zdGFuY2VzID0gdGV4dHVyZUFzc2V0cy5tYXAodCA9PiB0LnJlc291cmNlKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUluc3RhbmNlcywgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld0RhdGEpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcygpO1xuICAgIHJlc3VsdC5nbHRmID0gZ2x0ZjtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyB3YWl0IGZvciBkcmFjbyBtZXNoZXMgdG8gY29tcGxldGUgZGVjb2RpbmdcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSA9PiB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSAod3JhcCwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciA/PyB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGNyZWF0ZSBnbHRmIGltYWdlcy4gcmV0dXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyB0aGF0IHJlc29sdmUgdG8gdGV4dHVyZSBhc3NldHMuXG5jb25zdCBjcmVhdGVJbWFnZXMgPSAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmltYWdlcyB8fCBnbHRmLmltYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5pbWFnZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy5pbWFnZT8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uaW1hZ2U/LnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgbWltZVR5cGVGaWxlRXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgJ2ltYWdlL3BuZyc6ICdwbmcnLFxuICAgICAgICAnaW1hZ2UvanBlZyc6ICdqcGcnLFxuICAgICAgICAnaW1hZ2UvYmFzaXMnOiAnYmFzaXMnLFxuICAgICAgICAnaW1hZ2Uva3R4JzogJ2t0eCcsXG4gICAgICAgICdpbWFnZS9rdHgyJzogJ2t0eDInLFxuICAgICAgICAnaW1hZ2Uvdm5kLW1zLmRkcyc6ICdkZHMnXG4gICAgfTtcblxuICAgIGNvbnN0IGxvYWRUZXh0dXJlID0gKGdsdGZJbWFnZSwgdXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29udGludWF0aW9uID0gKGJ1ZmZlclZpZXdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChnbHRmSW1hZ2UubmFtZSB8fCAnZ2x0Zi10ZXh0dXJlJykgKyAnLScgKyBnbHRmVGV4dHVyZVVuaXF1ZUlkKys7XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHVybCB8fCBuYW1lXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZmVyVmlld0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXdEYXRhLnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLmZpbGVuYW1lID0gZmlsZS51cmwgKyAnLicgKyBleHRlbnNpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYW5kIGxvYWQgdGhlIGFzc2V0XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignbG9hZCcsIGFzc2V0ID0+IHJlc29sdmUoYXNzZXQpKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpO1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgICAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXcudGhlbihidWZmZXJWaWV3RGF0YSA9PiBjb250aW51YXRpb24oYnVmZmVyVmlld0RhdGEpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGludWF0aW9uKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGdsdGYuaW1hZ2VzLm1hcCgoZ2x0ZkltYWdlLCBpKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmSW1hZ2UsIChlcnIsIHRleHR1cmVBc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIC8vIHVyaSBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZJbWFnZS51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIGdsdGZJbWFnZS51cmksIG51bGwsIGdldERhdGFVUklNaW1lVHlwZShnbHRmSW1hZ2UudXJpKSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIEFCU09MVVRFX1VSTC50ZXN0KGdsdGZJbWFnZS51cmkpID8gZ2x0ZkltYWdlLnVyaSA6IHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlldycpICYmIGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnbWltZVR5cGUnKSkge1xuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlcnZpZXdcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZFRleHR1cmUoZ2x0ZkltYWdlLCBudWxsLCBidWZmZXJWaWV3c1tnbHRmSW1hZ2UuYnVmZmVyVmlld10sIGdsdGZJbWFnZS5taW1lVHlwZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGZhaWxcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoYEludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PSR7aX1gKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xufTtcblxuLy8gY3JlYXRlIGdsdGYgdGV4dHVyZXMuIHJldHVybnMgYW4gYXJyYXkgb2YgcHJvbWlzZXMgdGhhdCByZXNvbHZlIHRvIHRleHR1cmUgYXNzZXRzLlxuY29uc3QgY3JlYXRlVGV4dHVyZXMgPSAoZ2x0ZiwgaW1hZ2VzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBpZiAoIWdsdGY/LmltYWdlcz8ubGVuZ3RoIHx8ICFnbHRmPy50ZXh0dXJlcz8ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8udGV4dHVyZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy50ZXh0dXJlPy5wcm9jZXNzQXN5bmM7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy50ZXh0dXJlPy5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IHNlZW5JbWFnZXMgPSBuZXcgU2V0KCk7XG5cbiAgICByZXR1cm4gZ2x0Zi50ZXh0dXJlcy5tYXAoKGdsdGZUZXh0dXJlKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChwcm9jZXNzQXN5bmMpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgKGVyciwgZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlc29sdmUgaW1hZ2UgaW5kZXhcbiAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZkltYWdlSW5kZXggPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlID8/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZUZXh0dXJlPy5leHRlbnNpb25zPy5FWFRfdGV4dHVyZV93ZWJwPy5zb3VyY2UgPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZlRleHR1cmUuc291cmNlO1xuXG4gICAgICAgICAgICBjb25zdCBjbG9uZUFzc2V0ID0gc2VlbkltYWdlcy5oYXMoZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgc2VlbkltYWdlcy5hZGQoZ2x0ZkltYWdlSW5kZXgpO1xuXG4gICAgICAgICAgICByZXR1cm4gaW1hZ2VzW2dsdGZJbWFnZUluZGV4XS50aGVuKChpbWFnZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBjbG9uZUFzc2V0ID8gY2xvbmVUZXh0dXJlQXNzZXQoaW1hZ2VBc3NldCkgOiBpbWFnZUFzc2V0O1xuICAgICAgICAgICAgICAgIGFwcGx5U2FtcGxlcihhc3NldC5yZXNvdXJjZSwgKGdsdGYuc2FtcGxlcnMgPz8gW10pW2dsdGZUZXh0dXJlLnNhbXBsZXJdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0ZXh0dXJlQXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmVGV4dHVyZSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9KTtcbn07XG5cbi8vIGxvYWQgZ2x0ZiBidWZmZXJzLiByZXR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIHRoYXQgcmVzb2x2ZSB0byB0eXBlZCBhcnJheXMuXG5jb25zdCBsb2FkQnVmZmVycyA9IChnbHRmLCBiaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucykgPT4ge1xuICAgIGlmICghZ2x0Zi5idWZmZXJzIHx8IGdsdGYuYnVmZmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5idWZmZXI/LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gb3B0aW9ucz8uYnVmZmVyPy5wcm9jZXNzQXN5bmM7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5idWZmZXI/LnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYuYnVmZmVycy5tYXAoKGdsdGZCdWZmZXIsIGkpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyLCAoZXJyLCBhcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYXJyYXlCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKChhcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgaWYgKGFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFycmF5QnVmZmVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHRmQnVmZmVyLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkJ1ZmZlci51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgaGFuZGxlIFVSTEVuY29kZWQgRGF0YVVSSXMgLSBzZWUgU08gYW5zd2VyICM2ODUwMjc2IGZvciBjb2RlIHRoYXQgZG9lcyB0aGlzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ5dGVTdHJpbmcgPSBhdG9iKGdsdGZCdWZmZXIudXJpLnNwbGl0KCcsJylbMV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHZpZXcgaW50byB0aGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbmFyeUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZVN0cmluZy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgYnl0ZXMgb2YgdGhlIGJ1ZmZlciB0byB0aGUgY29ycmVjdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBieXRlU3RyaW5nLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlBcnJheVtqXSA9IGJ5dGVTdHJpbmcuY2hhckNvZGVBdChqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBiaW5hcnlBcnJheTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBodHRwLmdldChcbiAgICAgICAgICAgICAgICAgICAgICAgIEFCU09MVVRFX1VSTC50ZXN0KGdsdGZCdWZmZXIudXJpKSA/IGdsdGZCdWZmZXIudXJpIDogcGF0aC5qb2luKHVybEJhc2UsIGdsdGZCdWZmZXIudXJpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgY2FjaGU6IHRydWUsIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJywgcmV0cnk6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAoZXJyLCByZXN1bHQpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobmV3IFVpbnQ4QXJyYXkocmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICByZXR1cm4gYmluYXJ5Q2h1bms7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoYnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi5idWZmZXJzW2ldLCBidWZmZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xufTtcblxuLy8gcGFyc2UgdGhlIGdsdGYgY2h1bmssIHJldHVybnMgdGhlIGdsdGYganNvblxuY29uc3QgcGFyc2VHbHRmID0gKGdsdGZDaHVuaywgY2FsbGJhY2spID0+IHtcbiAgICBjb25zdCBkZWNvZGVCaW5hcnlVdGY4ID0gKGFycmF5KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgVGV4dERlY29kZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGFycmF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYXJyYXlbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoc3RyKSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGdsdGYgPSBKU09OLnBhcnNlKGRlY29kZUJpbmFyeVV0ZjgoZ2x0ZkNodW5rKSk7XG5cbiAgICAvLyBjaGVjayBnbHRmIHZlcnNpb25cbiAgICBpZiAoZ2x0Zi5hc3NldCAmJiBnbHRmLmFzc2V0LnZlcnNpb24gJiYgcGFyc2VGbG9hdChnbHRmLmFzc2V0LnZlcnNpb24pIDwgMikge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBnbHRmIHZlcnNpb24uIEV4cGVjdGVkIHZlcnNpb24gMi4wIG9yIGFib3ZlIGJ1dCBmb3VuZCB2ZXJzaW9uICcke2dsdGYuYXNzZXQudmVyc2lvbn0nLmApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgcmVxdWlyZWQgZXh0ZW5zaW9uc1xuICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xufTtcblxuLy8gcGFyc2UgZ2xiIGRhdGEsIHJldHVybnMgdGhlIGdsdGYgYW5kIGJpbmFyeSBjaHVua1xuY29uc3QgcGFyc2VHbGIgPSAoZ2xiRGF0YSwgY2FsbGJhY2spID0+IHtcbiAgICBjb25zdCBkYXRhID0gKGdsYkRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgPyBuZXcgRGF0YVZpZXcoZ2xiRGF0YSkgOiBuZXcgRGF0YVZpZXcoZ2xiRGF0YS5idWZmZXIsIGdsYkRhdGEuYnl0ZU9mZnNldCwgZ2xiRGF0YS5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIHJlYWQgaGVhZGVyXG4gICAgY29uc3QgbWFnaWMgPSBkYXRhLmdldFVpbnQzMigwLCB0cnVlKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gZGF0YS5nZXRVaW50MzIoNCwgdHJ1ZSk7XG4gICAgY29uc3QgbGVuZ3RoID0gZGF0YS5nZXRVaW50MzIoOCwgdHJ1ZSk7XG5cbiAgICBpZiAobWFnaWMgIT09IDB4NDY1NDZDNjcpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbWFnaWMgbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDB4NDY1NDZDNjcsIGZvdW5kIDB4JyArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodmVyc2lvbiAhPT0gMikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCB2ZXJzaW9uIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAyLCBmb3VuZCAnICsgdmVyc2lvbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGVuZ3RoIDw9IDAgfHwgbGVuZ3RoID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGxlbmd0aCBmb3VuZCBpbiBnbGIgaGVhZGVyLiBGb3VuZCAnICsgbGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJlYWQgY2h1bmtzXG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgbGV0IG9mZnNldCA9IDEyO1xuICAgIHdoaWxlIChvZmZzZXQgPCBsZW5ndGgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtMZW5ndGggPSBkYXRhLmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xuICAgICAgICBpZiAob2Zmc2V0ICsgY2h1bmtMZW5ndGggKyA4ID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAke2NodW5rTGVuZ3RofWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCR7Y2h1bmtzWzBdLnR5cGUudG9TdHJpbmcoMTYpfWApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKGBJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JHtjaHVua3NbMV0udHlwZS50b1N0cmluZygxNil9YCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykgPT4ge1xuICAgIGNvbnN0IGhhc0dsYkhlYWRlciA9ICgpID0+IHtcbiAgICAgICAgLy8gZ2xiIGZvcm1hdCBzdGFydHMgd2l0aCAnZ2xURidcbiAgICAgICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICAgICAgcmV0dXJuIHU4WzBdID09PSAxMDMgJiYgdThbMV0gPT09IDEwOCAmJiB1OFsyXSA9PT0gODQgJiYgdThbM10gPT09IDcwO1xuICAgIH07XG5cbiAgICBpZiAoKGZpbGVuYW1lICYmIGZpbGVuYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5nbGInKSkgfHwgaGFzR2xiSGVhZGVyKCkpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IGNyZWF0ZUJ1ZmZlclZpZXdzID0gKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMpID0+IHtcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnM/LmJ1ZmZlclZpZXc/LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gb3B0aW9ucz8uYnVmZmVyVmlldz8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYnVmZmVyVmlldz8ucG9zdHByb2Nlc3M7XG5cbiAgICAvLyBoYW5kbGUgY2FzZSBvZiBubyBidWZmZXJzXG4gICAgaWYgKCFnbHRmLmJ1ZmZlclZpZXdzPy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChwcm9jZXNzQXN5bmMpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJzLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb21pc2UgPSBwcm9taXNlLnRoZW4oKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbnZlcnQgYnVmZmVyIHRvIHR5cGVkIGFycmF5XG4gICAgICAgICAgICByZXR1cm4gYnVmZmVyc1tnbHRmQnVmZmVyVmlldy5idWZmZXJdLnRoZW4oKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXIuYnl0ZU9mZnNldCArIChnbHRmQnVmZmVyVmlldy5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQnVmZmVyVmlldy5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBhZGQgYSAnYnl0ZVN0cmlkZScgbWVtYmVyIHRvIHRoZSB0eXBlZCBhcnJheSBzbyB3ZSBoYXZlIGVhc3kgYWNjZXNzIHRvIGl0IGxhdGVyXG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0eXBlZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgdHlwZWRBcnJheS5ieXRlU3RyaWRlID0gZ2x0ZkJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZWRBcnJheTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0eXBlZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIHR5cGVkQXJyYXkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlZEFycmF5O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQucHVzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY2xhc3MgR2xiUGFyc2VyIHtcbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBhc3luY2hyb25vdXNseSwgbG9hZGluZyBleHRlcm5hbCByZXNvdXJjZXNcbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIHVybEJhc2UsIGRhdGEsIGRldmljZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIChlcnIsIGNodW5rcykgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICBwYXJzZUdsdGYoY2h1bmtzLmdsdGZDaHVuaywgKGVyciwgZ2x0ZikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlcnMgPSBsb2FkQnVmZmVycyhnbHRmLCBjaHVua3MuYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXdzID0gY3JlYXRlQnVmZmVyVmlld3MoZ2x0ZiwgYnVmZmVycywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW1hZ2VzID0gY3JlYXRlSW1hZ2VzKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBjcmVhdGVUZXh0dXJlcyhnbHRmLCBpbWFnZXMsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIHRleHR1cmVzLCBvcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAudGhlbihyZXN1bHQgPT4gY2FsbGJhY2sobnVsbCwgcmVzdWx0KSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBjYWxsYmFjayhlcnIpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlRGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTWF0ZXJpYWwoe1xuICAgICAgICAgICAgbmFtZTogJ2RlZmF1bHRHbGJNYXRlcmlhbCdcbiAgICAgICAgfSwgW10pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR2xiUGFyc2VyIH07XG4iXSwibmFtZXMiOlsiR2xiUmVzb3VyY2VzIiwiY29uc3RydWN0b3IiLCJnbHRmIiwibm9kZXMiLCJzY2VuZXMiLCJhbmltYXRpb25zIiwidGV4dHVyZXMiLCJtYXRlcmlhbHMiLCJ2YXJpYW50cyIsIm1lc2hWYXJpYW50cyIsIm1lc2hEZWZhdWx0TWF0ZXJpYWxzIiwicmVuZGVycyIsInNraW5zIiwibGlnaHRzIiwiY2FtZXJhcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwicmVuZGVyIiwibWVzaGVzIiwiaXNEYXRhVVJJIiwidXJpIiwidGVzdCIsImdldERhdGFVUklNaW1lVHlwZSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJnZXROdW1Db21wb25lbnRzIiwiYWNjZXNzb3JUeXBlIiwiZ2V0Q29tcG9uZW50VHlwZSIsImNvbXBvbmVudFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMiLCJnZXRDb21wb25lbnREYXRhVHlwZSIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19URVhDT09SRDIiLCJTRU1BTlRJQ19URVhDT09SRDMiLCJTRU1BTlRJQ19URVhDT09SRDQiLCJTRU1BTlRJQ19URVhDT09SRDUiLCJTRU1BTlRJQ19URVhDT09SRDYiLCJTRU1BTlRJQ19URVhDT09SRDciLCJhdHRyaWJ1dGVPcmRlciIsImdldERlcXVhbnRpemVGdW5jIiwic3JjVHlwZSIsIngiLCJNYXRoIiwibWF4IiwiZGVxdWFudGl6ZUFycmF5IiwiZHN0QXJyYXkiLCJzcmNBcnJheSIsImNvbnZGdW5jIiwibGVuIiwibGVuZ3RoIiwiaSIsImdldEFjY2Vzc29yRGF0YSIsImdsdGZBY2Nlc3NvciIsImJ1ZmZlclZpZXdzIiwiZmxhdHRlbiIsIm51bUNvbXBvbmVudHMiLCJ0eXBlIiwiZGF0YVR5cGUiLCJyZXN1bHQiLCJzcGFyc2UiLCJpbmRpY2VzQWNjZXNzb3IiLCJjb3VudCIsImluZGljZXMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2YWx1ZXNBY2Nlc3NvciIsInZhbHVlcyIsImhhc093blByb3BlcnR5IiwiYmFzZUFjY2Vzc29yIiwiYnVmZmVyVmlldyIsImJ5dGVPZmZzZXQiLCJzbGljZSIsInRhcmdldEluZGV4IiwiaiIsImJ5dGVzUGVyRWxlbWVudCIsIkJZVEVTX1BFUl9FTEVNRU5UIiwic3RvcmFnZSIsIkFycmF5QnVmZmVyIiwidG1wQXJyYXkiLCJkc3RPZmZzZXQiLCJzcmNPZmZzZXQiLCJieXRlU3RyaWRlIiwiYiIsImJ1ZmZlciIsImdldEFjY2Vzc29yRGF0YUZsb2F0MzIiLCJkYXRhIiwibm9ybWFsaXplZCIsImZsb2F0MzJEYXRhIiwiZ2V0QWNjZXNzb3JCb3VuZGluZ0JveCIsIm1pbiIsImN0eXBlIiwiQm91bmRpbmdCb3giLCJWZWMzIiwiZ2V0UHJpbWl0aXZlVHlwZSIsInByaW1pdGl2ZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJtb2RlIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiZ2VuZXJhdGVJbmRpY2VzIiwibnVtVmVydGljZXMiLCJkdW1teUluZGljZXMiLCJnZW5lcmF0ZU5vcm1hbHMiLCJzb3VyY2VEZXNjIiwicCIsImNvbXBvbmVudHMiLCJwb3NpdGlvbnMiLCJzaXplIiwic3RyaWRlIiwic3JjU3RyaWRlIiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJzcmMiLCJ0eXBlZEFycmF5VHlwZXMiLCJvZmZzZXQiLCJub3JtYWxzVGVtcCIsImNhbGN1bGF0ZU5vcm1hbHMiLCJub3JtYWxzIiwic2V0IiwiZmxpcFRleENvb3JkVnMiLCJ2ZXJ0ZXhCdWZmZXIiLCJmbG9hdE9mZnNldHMiLCJzaG9ydE9mZnNldHMiLCJieXRlT2Zmc2V0cyIsImZvcm1hdCIsImVsZW1lbnRzIiwiZWxlbWVudCIsIm5hbWUiLCJwdXNoIiwiZmxpcCIsIm9mZnNldHMiLCJvbmUiLCJ0eXBlZEFycmF5IiwiaW5kZXgiLCJjbG9uZVRleHR1cmUiLCJ0ZXh0dXJlIiwic2hhbGxvd0NvcHlMZXZlbHMiLCJtaXAiLCJfbGV2ZWxzIiwibGV2ZWwiLCJjdWJlbWFwIiwiZmFjZSIsIlRleHR1cmUiLCJkZXZpY2UiLCJjbG9uZVRleHR1cmVBc3NldCIsIkFzc2V0IiwiZmlsZSIsIm9wdGlvbnMiLCJsb2FkZWQiLCJyZXNvdXJjZSIsInJlZ2lzdHJ5IiwiYWRkIiwiY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwiLCJmbGlwViIsInBvc2l0aW9uRGVzYyIsInZlcnRleERlc2MiLCJzZW1hbnRpYyIsIm5vcm1hbGl6ZSIsIlZlcnRleEZvcm1hdCIsImlzRWxlbWVudFZhbGlkIiwic29ydCIsImxocyIsInJocyIsImsiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzb3VyY2VPZmZzZXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJpc0NvcnJlY3RseUludGVybGVhdmVkIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsInZlcnRleERhdGEiLCJsb2NrIiwidGFyZ2V0QXJyYXkiLCJzb3VyY2VBcnJheSIsInRhcmdldFN0cmlkZSIsInNvdXJjZVN0cmlkZSIsImRzdCIsImtlbmQiLCJmbG9vciIsInVubG9jayIsImNyZWF0ZVZlcnRleEJ1ZmZlciIsImF0dHJpYnV0ZXMiLCJhY2Nlc3NvcnMiLCJ2ZXJ0ZXhCdWZmZXJEaWN0IiwidXNlQXR0cmlidXRlcyIsImF0dHJpYklkcyIsImF0dHJpYiIsInZiS2V5Iiwiam9pbiIsInZiIiwiYWNjZXNzb3IiLCJhY2Nlc3NvckRhdGEiLCJjcmVhdGVTa2luIiwiZ2x0ZlNraW4iLCJnbGJTa2lucyIsImJpbmRNYXRyaXgiLCJqb2ludHMiLCJudW1Kb2ludHMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwiaWJtRGF0YSIsImlibVZhbHVlcyIsIk1hdDQiLCJib25lTmFtZXMiLCJrZXkiLCJza2luIiwiZ2V0IiwiU2tpbiIsImNyZWF0ZURyYWNvTWVzaCIsInByb21pc2VzIiwiX3ByaW1pdGl2ZSRleHRlbnNpb25zIiwiTWVzaCIsImFhYmIiLCJQT1NJVElPTiIsImVudHJpZXMiLCJfYWNjZXNzb3Ikbm9ybWFsaXplZCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZHJhY29FeHQiLCJleHRlbnNpb25zIiwiS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24iLCJkcmFjb0RlY29kZSIsImVyciIsImRlY29tcHJlc3NlZERhdGEiLCJjb25zb2xlIiwibG9nIiwiX3ByaW1pdGl2ZSRhdHRyaWJ1dGVzIiwib3JkZXIiLCJhIiwiTk9STUFMIiwic3BsaWNlIiwidmVydGljZXMiLCJieXRlTGVuZ3RoIiwiaW5kZXhGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJudW1JbmRpY2VzIiwiRGVidWciLCJjYWxsIiwid2FybiIsImluZGV4QnVmZmVyIiwiSW5kZXhCdWZmZXIiLCJiYXNlIiwiaW5kZXhlZCIsIktIUl9tYXRlcmlhbHNfdmFyaWFudHMiLCJ0ZW1wTWFwcGluZyIsIm1hcHBpbmdzIiwibWFwcGluZyIsInZhcmlhbnQiLCJtYXRlcmlhbCIsImlkIiwiY3JlYXRlTWVzaCIsImdsdGZNZXNoIiwiYXNzZXRPcHRpb25zIiwicHJpbWl0aXZlcyIsIl9wcmltaXRpdmUkZXh0ZW5zaW9uczIiLCJwcmltaXRpdmVUeXBlIiwibWVzaCIsIklOREVYRk9STUFUX1VJTlQ4IiwiZXh0VWludEVsZW1lbnQiLCJpc1dlYkdQVSIsInRhcmdldHMiLCJkZWx0YVBvc2l0aW9ucyIsImRlbHRhUG9zaXRpb25zVHlwZSIsImRlbHRhTm9ybWFscyIsImRlbHRhTm9ybWFsc1R5cGUiLCJleHRyYXMiLCJ0YXJnZXROYW1lcyIsInRvU3RyaW5nIiwiZGVmYXVsdFdlaWdodCIsIndlaWdodHMiLCJwcmVzZXJ2ZURhdGEiLCJtb3JwaFByZXNlcnZlRGF0YSIsIk1vcnBoVGFyZ2V0IiwibW9ycGgiLCJNb3JwaCIsInByZWZlckhpZ2hQcmVjaXNpb24iLCJtb3JwaFByZWZlckhpZ2hQcmVjaXNpb24iLCJleHRyYWN0VGV4dHVyZVRyYW5zZm9ybSIsIm1hcHMiLCJfc291cmNlJGV4dGVuc2lvbnMiLCJtYXAiLCJ0ZXhDb29yZCIsInplcm9zIiwib25lcyIsInRleHR1cmVUcmFuc2Zvcm0iLCJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iLCJzY2FsZSIsInJvdGF0aW9uIiwibWF0aCIsIlJBRF9UT19ERUciLCJ0aWxpbmdWZWMiLCJWZWMyIiwib2Zmc2V0VmVjIiwiZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MiLCJjb2xvciIsImRpZmZ1c2VGYWN0b3IiLCJkaWZmdXNlIiwicG93Iiwib3BhY2l0eSIsImRpZmZ1c2VUZXh0dXJlIiwiZGlmZnVzZU1hcCIsImRpZmZ1c2VNYXBDaGFubmVsIiwib3BhY2l0eU1hcCIsIm9wYWNpdHlNYXBDaGFubmVsIiwidXNlTWV0YWxuZXNzIiwic3BlY3VsYXJGYWN0b3IiLCJzcGVjdWxhciIsImdsb3NzIiwiZ2xvc3NpbmVzc0ZhY3RvciIsInNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUiLCJzcGVjdWxhckVuY29kaW5nIiwic3BlY3VsYXJNYXAiLCJnbG9zc01hcCIsInNwZWN1bGFyTWFwQ2hhbm5lbCIsImdsb3NzTWFwQ2hhbm5lbCIsImV4dGVuc2lvbkNsZWFyQ29hdCIsImNsZWFyQ29hdCIsImNsZWFyY29hdEZhY3RvciIsImNsZWFyY29hdFRleHR1cmUiLCJjbGVhckNvYXRNYXAiLCJjbGVhckNvYXRNYXBDaGFubmVsIiwiY2xlYXJDb2F0R2xvc3MiLCJjbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3IiLCJjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlIiwiY2xlYXJDb2F0R2xvc3NNYXAiLCJjbGVhckNvYXRHbG9zc01hcENoYW5uZWwiLCJjbGVhcmNvYXROb3JtYWxUZXh0dXJlIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwiY2xlYXJDb2F0QnVtcGluZXNzIiwiY2xlYXJDb2F0R2xvc3NJbnZlcnQiLCJleHRlbnNpb25VbmxpdCIsInVzZUxpZ2h0aW5nIiwiZW1pc3NpdmUiLCJjb3B5IiwiZW1pc3NpdmVUaW50IiwiZGlmZnVzZVRpbnQiLCJlbWlzc2l2ZU1hcCIsImVtaXNzaXZlTWFwVXYiLCJkaWZmdXNlTWFwVXYiLCJlbWlzc2l2ZU1hcFRpbGluZyIsImRpZmZ1c2VNYXBUaWxpbmciLCJlbWlzc2l2ZU1hcE9mZnNldCIsImRpZmZ1c2VNYXBPZmZzZXQiLCJlbWlzc2l2ZU1hcFJvdGF0aW9uIiwiZGlmZnVzZU1hcFJvdGF0aW9uIiwiZW1pc3NpdmVNYXBDaGFubmVsIiwiZW1pc3NpdmVWZXJ0ZXhDb2xvciIsImRpZmZ1c2VWZXJ0ZXhDb2xvciIsImVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsIiwiZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbCIsInVzZVNreWJveCIsImV4dGVuc2lvblNwZWN1bGFyIiwidXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciIsInNwZWN1bGFyQ29sb3JUZXh0dXJlIiwic3BlY3VsYXJDb2xvckZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yIiwic3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsIiwic3BlY3VsYXJpdHlGYWN0b3JNYXAiLCJzcGVjdWxhclRleHR1cmUiLCJleHRlbnNpb25Jb3IiLCJyZWZyYWN0aW9uSW5kZXgiLCJpb3IiLCJleHRlbnNpb25UcmFuc21pc3Npb24iLCJibGVuZFR5cGUiLCJCTEVORF9OT1JNQUwiLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsInJlZnJhY3Rpb24iLCJ0cmFuc21pc3Npb25GYWN0b3IiLCJyZWZyYWN0aW9uTWFwQ2hhbm5lbCIsInJlZnJhY3Rpb25NYXAiLCJ0cmFuc21pc3Npb25UZXh0dXJlIiwiZXh0ZW5zaW9uU2hlZW4iLCJ1c2VTaGVlbiIsInNoZWVuQ29sb3JGYWN0b3IiLCJzaGVlbiIsInNoZWVuTWFwIiwic2hlZW5Db2xvclRleHR1cmUiLCJzaGVlbkVuY29kaW5nIiwic2hlZW5HbG9zcyIsInNoZWVuUm91Z2huZXNzRmFjdG9yIiwic2hlZW5HbG9zc01hcCIsInNoZWVuUm91Z2huZXNzVGV4dHVyZSIsInNoZWVuR2xvc3NNYXBDaGFubmVsIiwic2hlZW5HbG9zc0ludmVydCIsImV4dGVuc2lvblZvbHVtZSIsInRoaWNrbmVzcyIsInRoaWNrbmVzc0ZhY3RvciIsInRoaWNrbmVzc01hcCIsInRoaWNrbmVzc1RleHR1cmUiLCJ0aGlja25lc3NNYXBDaGFubmVsIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsImF0dGVudWF0aW9uQ29sb3IiLCJhdHRlbnVhdGlvbiIsImV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgiLCJlbWlzc2l2ZUludGVuc2l0eSIsImVtaXNzaXZlU3RyZW5ndGgiLCJleHRlbnNpb25JcmlkZXNjZW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZUZhY3RvciIsImlyaWRlc2NlbmNlTWFwQ2hhbm5lbCIsImlyaWRlc2NlbmNlTWFwIiwiaXJpZGVzY2VuY2VUZXh0dXJlIiwiaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgiLCJpcmlkZXNjZW5jZUlvciIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0iLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSIsImNyZWF0ZU1hdGVyaWFsIiwiZ2x0Zk1hdGVyaWFsIiwiU3RhbmRhcmRNYXRlcmlhbCIsIm9jY2x1ZGVTcGVjdWxhciIsIlNQRUNPQ0NfQU8iLCJzcGVjdWxhclRpbnQiLCJzcGVjdWxhclZlcnRleENvbG9yIiwicGJyRGF0YSIsInBick1ldGFsbGljUm91Z2huZXNzIiwiYmFzZUNvbG9yRmFjdG9yIiwiYmFzZUNvbG9yVGV4dHVyZSIsIm1ldGFsbmVzcyIsIm1ldGFsbGljRmFjdG9yIiwicm91Z2huZXNzRmFjdG9yIiwiZ2xvc3NJbnZlcnQiLCJtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUiLCJtZXRhbG5lc3NNYXAiLCJtZXRhbG5lc3NNYXBDaGFubmVsIiwibm9ybWFsVGV4dHVyZSIsIm5vcm1hbE1hcCIsImJ1bXBpbmVzcyIsIm9jY2x1c2lvblRleHR1cmUiLCJhb01hcCIsImFvTWFwQ2hhbm5lbCIsImVtaXNzaXZlRmFjdG9yIiwiZW1pc3NpdmVUZXh0dXJlIiwiYWxwaGFNb2RlIiwiQkxFTkRfTk9ORSIsImFscGhhVGVzdCIsImFscGhhQ3V0b2ZmIiwiZGVwdGhXcml0ZSIsInR3b1NpZGVkTGlnaHRpbmciLCJkb3VibGVTaWRlZCIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwiQ1VMTEZBQ0VfQkFDSyIsImV4dGVuc2lvbkZ1bmMiLCJ1bmRlZmluZWQiLCJ1cGRhdGUiLCJjcmVhdGVBbmltYXRpb24iLCJnbHRmQW5pbWF0aW9uIiwiYW5pbWF0aW9uSW5kZXgiLCJnbHRmQWNjZXNzb3JzIiwiZ2x0Zk5vZGVzIiwiY3JlYXRlQW5pbURhdGEiLCJBbmltRGF0YSIsImludGVycE1hcCIsIklOVEVSUE9MQVRJT05fU1RFUCIsIklOVEVSUE9MQVRJT05fTElORUFSIiwiSU5URVJQT0xBVElPTl9DVUJJQyIsImlucHV0TWFwIiwib3V0cHV0TWFwIiwiY3VydmVNYXAiLCJvdXRwdXRDb3VudGVyIiwic2FtcGxlcnMiLCJzYW1wbGVyIiwiaW5wdXQiLCJvdXRwdXQiLCJpbnRlcnBvbGF0aW9uIiwiY3VydmUiLCJwYXRocyIsInF1YXRBcnJheXMiLCJ0cmFuc2Zvcm1TY2hlbWEiLCJjb25zdHJ1Y3ROb2RlUGF0aCIsIm5vZGUiLCJwYXRoIiwidW5zaGlmdCIsInBhcmVudCIsImNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzIiwiZ2x0Zk5vZGUiLCJlbnRpdHlQYXRoIiwib3V0Iiwib3V0RGF0YSIsIm1vcnBoVGFyZ2V0Q291bnQiLCJrZXlmcmFtZUNvdW50Iiwic2luZ2xlQnVmZmVyU2l6ZSIsIl90YXJnZXROYW1lcyIsIm1vcnBoVGFyZ2V0T3V0cHV0Iiwid2VpZ2h0TmFtZSIsIm1vcnBoQ3VydmUiLCJjb21wb25lbnQiLCJwcm9wZXJ0eVBhdGgiLCJjaGFubmVscyIsImNoYW5uZWwiLCJzdGFydHNXaXRoIiwiaW5wdXRzIiwib3V0cHV0cyIsImN1cnZlcyIsImlucHV0S2V5Iiwib3V0cHV0S2V5IiwiY3VydmVLZXkiLCJjdXJ2ZURhdGEiLCJBbmltQ3VydmUiLCJwcmV2SW5kZXgiLCJkIiwiZHAiLCJkdXJhdGlvbiIsIl9kYXRhIiwiQW5pbVRyYWNrIiwidGVtcE1hdCIsInRlbXBWZWMiLCJjcmVhdGVOb2RlIiwibm9kZUluZGV4IiwiZW50aXR5IiwiR3JhcGhOb2RlIiwibWF0cml4IiwiZ2V0VHJhbnNsYXRpb24iLCJzZXRMb2NhbFBvc2l0aW9uIiwiZ2V0RXVsZXJBbmdsZXMiLCJzZXRMb2NhbEV1bGVyQW5nbGVzIiwiZ2V0U2NhbGUiLCJzZXRMb2NhbFNjYWxlIiwiciIsInNldExvY2FsUm90YXRpb24iLCJ0IiwidHJhbnNsYXRpb24iLCJzIiwiY3JlYXRlQ2FtZXJhIiwiZ2x0ZkNhbWVyYSIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJnbHRmUHJvcGVydGllcyIsIm9ydGhvZ3JhcGhpYyIsInBlcnNwZWN0aXZlIiwiY29tcG9uZW50RGF0YSIsImVuYWJsZWQiLCJuZWFyQ2xpcCIsInpuZWFyIiwiYXNwZWN0UmF0aW9Nb2RlIiwiQVNQRUNUX0FVVE8iLCJ6ZmFyIiwiZmFyQ2xpcCIsIm9ydGhvSGVpZ2h0IiwieW1hZyIsIkFTUEVDVF9NQU5VQUwiLCJhc3BlY3RSYXRpbyIsInhtYWciLCJmb3YiLCJ5Zm92IiwiY2FtZXJhRW50aXR5IiwiRW50aXR5IiwiYWRkQ29tcG9uZW50IiwiY3JlYXRlTGlnaHQiLCJnbHRmTGlnaHQiLCJsaWdodFByb3BzIiwiQ29sb3IiLCJXSElURSIsInJhbmdlIiwiZmFsbG9mZk1vZGUiLCJMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQiLCJpbnRlbnNpdHkiLCJjbGFtcCIsImlubmVyQ29uZUFuZ2xlIiwic3BvdCIsIm91dGVyQ29uZUFuZ2xlIiwiUEkiLCJsdW1pbmFuY2UiLCJMaWdodCIsImdldExpZ2h0VW5pdENvbnZlcnNpb24iLCJsaWdodFR5cGVzIiwibGlnaHRFbnRpdHkiLCJyb3RhdGVMb2NhbCIsImNyZWF0ZVNraW5zIiwiTWFwIiwiY3JlYXRlTWVzaGVzIiwiX2dsdGYkbWVzaGVzIiwiX2dsdGYkYWNjZXNzb3JzIiwiX2dsdGYkYnVmZmVyVmlld3MiLCJ2YWxpZCIsInNraXBNZXNoZXMiLCJjcmVhdGVNYXRlcmlhbHMiLCJfb3B0aW9ucyRtYXRlcmlhbCIsIl9vcHRpb25zJG1hdGVyaWFsJHBybyIsIl9vcHRpb25zJG1hdGVyaWFsMiIsIl9vcHRpb25zJG1hdGVyaWFsMyIsInByZXByb2Nlc3MiLCJwcm9jZXNzIiwicG9zdHByb2Nlc3MiLCJjcmVhdGVWYXJpYW50cyIsImNyZWF0ZUFuaW1hdGlvbnMiLCJfb3B0aW9ucyRhbmltYXRpb24iLCJfb3B0aW9ucyRhbmltYXRpb24yIiwiYW5pbWF0aW9uIiwiY3JlYXRlTm9kZXMiLCJfb3B0aW9ucyRub2RlIiwiX29wdGlvbnMkbm9kZSRwcm9jZXNzIiwiX29wdGlvbnMkbm9kZTIiLCJfb3B0aW9ucyRub2RlMyIsInVuaXF1ZU5hbWVzIiwiY2hpbGRyZW4iLCJjaGlsZCIsImFkZENoaWxkIiwiY3JlYXRlU2NlbmVzIiwiX2dsdGYkc2NlbmVzJDAkbm9kZXMiLCJzY2VuZSIsInNjZW5lUm9vdCIsIm4iLCJjaGlsZE5vZGUiLCJjcmVhdGVDYW1lcmFzIiwiX29wdGlvbnMkY2FtZXJhIiwiX29wdGlvbnMkY2FtZXJhJHByb2NlIiwiX29wdGlvbnMkY2FtZXJhMiIsIl9vcHRpb25zJGNhbWVyYTMiLCJjYW1lcmEiLCJjcmVhdGVMaWdodHMiLCJLSFJfbGlnaHRzX3B1bmN0dWFsIiwiZ2x0ZkxpZ2h0cyIsIl9vcHRpb25zJGxpZ2h0IiwiX29wdGlvbnMkbGlnaHQkcHJvY2VzIiwiX29wdGlvbnMkbGlnaHQyIiwiX29wdGlvbnMkbGlnaHQzIiwibGlnaHQiLCJsaWdodEluZGV4IiwibGlua1NraW5zIiwibWVzaEdyb3VwIiwiY3JlYXRlUmVzb3VyY2VzIiwiX29wdGlvbnMkZ2xvYmFsIiwiX29wdGlvbnMkZ2xvYmFsMiIsImdsb2JhbCIsImFzc2V0IiwiZ2VuZXJhdG9yIiwiYnVmZmVyVmlld0RhdGEiLCJhbGwiLCJ0ZXh0dXJlQXNzZXRzIiwidGV4dHVyZUluc3RhbmNlcyIsIlJlbmRlciIsImFwcGx5U2FtcGxlciIsImdsdGZTYW1wbGVyIiwiZ2V0RmlsdGVyIiwiZmlsdGVyIiwiZGVmYXVsdFZhbHVlIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdldFdyYXAiLCJ3cmFwIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIl9nbHRmU2FtcGxlciIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwid3JhcFMiLCJhZGRyZXNzViIsIndyYXBUIiwiZ2x0ZlRleHR1cmVVbmlxdWVJZCIsImNyZWF0ZUltYWdlcyIsInVybEJhc2UiLCJfb3B0aW9ucyRpbWFnZSIsIl9vcHRpb25zJGltYWdlMiIsIl9vcHRpb25zJGltYWdlMyIsImltYWdlcyIsImltYWdlIiwicHJvY2Vzc0FzeW5jIiwibWltZVR5cGVGaWxlRXh0ZW5zaW9ucyIsImxvYWRUZXh0dXJlIiwiZ2x0ZkltYWdlIiwidXJsIiwibWltZVR5cGUiLCJjb250aW51YXRpb24iLCJjb250ZW50cyIsImV4dGVuc2lvbiIsImZpbGVuYW1lIiwib24iLCJsb2FkIiwidGhlbiIsInByb21pc2UiLCJ0ZXh0dXJlQXNzZXQiLCJBQlNPTFVURV9VUkwiLCJjcm9zc09yaWdpbiIsIkVycm9yIiwiY3JlYXRlVGV4dHVyZXMiLCJfZ2x0ZiRpbWFnZXMiLCJfZ2x0ZiR0ZXh0dXJlcyIsIl9vcHRpb25zJHRleHR1cmUiLCJfb3B0aW9ucyR0ZXh0dXJlMiIsIl9vcHRpb25zJHRleHR1cmUzIiwic2VlbkltYWdlcyIsIlNldCIsImdsdGZUZXh0dXJlIiwiZ2x0ZkltYWdlSW5kZXgiLCJfcmVmIiwiX3JlZjIiLCJfZ2x0ZkltYWdlSW5kZXgiLCJfZ2x0ZlRleHR1cmUkZXh0ZW5zaW8iLCJfZ2x0ZlRleHR1cmUkZXh0ZW5zaW8yIiwiS0hSX3RleHR1cmVfYmFzaXN1IiwiRVhUX3RleHR1cmVfd2VicCIsImNsb25lQXNzZXQiLCJoYXMiLCJpbWFnZUFzc2V0IiwiX2dsdGYkc2FtcGxlcnMiLCJsb2FkQnVmZmVycyIsImJpbmFyeUNodW5rIiwiX29wdGlvbnMkYnVmZmVyIiwiX29wdGlvbnMkYnVmZmVyMiIsIl9vcHRpb25zJGJ1ZmZlcjMiLCJidWZmZXJzIiwiZ2x0ZkJ1ZmZlciIsImFycmF5QnVmZmVyIiwiYnl0ZVN0cmluZyIsImF0b2IiLCJzcGxpdCIsImJpbmFyeUFycmF5IiwiY2hhckNvZGVBdCIsImh0dHAiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwicGFyc2VHbHRmIiwiZ2x0ZkNodW5rIiwiY2FsbGJhY2siLCJkZWNvZGVCaW5hcnlVdGY4IiwiYXJyYXkiLCJUZXh0RGVjb2RlciIsImRlY29kZSIsInN0ciIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImRlY29kZVVSSUNvbXBvbmVudCIsImVzY2FwZSIsIkpTT04iLCJwYXJzZSIsInZlcnNpb24iLCJwYXJzZUZsb2F0IiwicGFyc2VHbGIiLCJnbGJEYXRhIiwiRGF0YVZpZXciLCJtYWdpYyIsImdldFVpbnQzMiIsImNodW5rcyIsImNodW5rTGVuZ3RoIiwiY2h1bmtUeXBlIiwiY2h1bmtEYXRhIiwicGFyc2VDaHVuayIsImhhc0dsYkhlYWRlciIsInU4IiwidG9Mb3dlckNhc2UiLCJlbmRzV2l0aCIsImNyZWF0ZUJ1ZmZlclZpZXdzIiwiX29wdGlvbnMkYnVmZmVyVmlldyIsIl9vcHRpb25zJGJ1ZmZlclZpZXcyIiwiX29wdGlvbnMkYnVmZmVyVmlldzMiLCJfZ2x0ZiRidWZmZXJWaWV3czIiLCJnbHRmQnVmZmVyVmlldyIsIkdsYlBhcnNlciIsImNhdGNoIiwiY3JlYXRlRGVmYXVsdE1hdGVyaWFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvREE7QUFDQSxNQUFNQSxZQUFZLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQUEsSUFBQSxJQUFBLENBQ2ZDLElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVKQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFTEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBRU5DLFVBQVUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVWQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFUkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBRVRDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVSQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFWkMsb0JBQW9CLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFcEJDLE9BQU8sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVQ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
