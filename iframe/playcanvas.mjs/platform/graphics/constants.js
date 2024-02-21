const ADDRESS_REPEAT = 0;
const ADDRESS_CLAMP_TO_EDGE = 1;
const ADDRESS_MIRRORED_REPEAT = 2;
const BLENDMODE_ZERO = 0;
const BLENDMODE_ONE = 1;
const BLENDMODE_SRC_COLOR = 2;
const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;
const BLENDMODE_DST_COLOR = 4;
const BLENDMODE_ONE_MINUS_DST_COLOR = 5;
const BLENDMODE_SRC_ALPHA = 6;
const BLENDMODE_SRC_ALPHA_SATURATE = 7;
const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;
const BLENDMODE_DST_ALPHA = 9;
const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;
const BLENDMODE_CONSTANT = 11;
const BLENDMODE_ONE_MINUS_CONSTANT = 12;
const BLENDEQUATION_ADD = 0;
const BLENDEQUATION_SUBTRACT = 1;
const BLENDEQUATION_REVERSE_SUBTRACT = 2;
const BLENDEQUATION_MIN = 3;
const BLENDEQUATION_MAX = 4;
const BUFFER_STATIC = 0;
const BUFFER_DYNAMIC = 1;
const BUFFER_STREAM = 2;
const BUFFER_GPUDYNAMIC = 3;
const CLEARFLAG_COLOR = 1;
const CLEARFLAG_DEPTH = 2;
const CLEARFLAG_STENCIL = 4;
const CUBEFACE_POSX = 0;
const CUBEFACE_NEGX = 1;
const CUBEFACE_POSY = 2;
const CUBEFACE_NEGY = 3;
const CUBEFACE_POSZ = 4;
const CUBEFACE_NEGZ = 5;
const CULLFACE_NONE = 0;
const CULLFACE_BACK = 1;
const CULLFACE_FRONT = 2;
const CULLFACE_FRONTANDBACK = 3;
const FILTER_NEAREST = 0;
const FILTER_LINEAR = 1;
const FILTER_NEAREST_MIPMAP_NEAREST = 2;
const FILTER_NEAREST_MIPMAP_LINEAR = 3;
const FILTER_LINEAR_MIPMAP_NEAREST = 4;
const FILTER_LINEAR_MIPMAP_LINEAR = 5;
const FUNC_NEVER = 0;
const FUNC_LESS = 1;
const FUNC_EQUAL = 2;
const FUNC_LESSEQUAL = 3;
const FUNC_GREATER = 4;
const FUNC_NOTEQUAL = 5;
const FUNC_GREATEREQUAL = 6;
const FUNC_ALWAYS = 7;
const INDEXFORMAT_UINT8 = 0;
const INDEXFORMAT_UINT16 = 1;
const INDEXFORMAT_UINT32 = 2;
const PIXELFORMAT_A8 = 0;
const PIXELFORMAT_L8 = 1;
const PIXELFORMAT_LA8 = 2;
const PIXELFORMAT_RGB565 = 3;
const PIXELFORMAT_RGBA5551 = 4;
const PIXELFORMAT_RGBA4 = 5;
const PIXELFORMAT_RGB8 = 6;
const PIXELFORMAT_RGBA8 = 7;
const PIXELFORMAT_DXT1 = 8;
const PIXELFORMAT_DXT3 = 9;
const PIXELFORMAT_DXT5 = 10;
const PIXELFORMAT_RGB16F = 11;
const PIXELFORMAT_RGBA16F = 12;
const PIXELFORMAT_RGB32F = 13;
const PIXELFORMAT_RGBA32F = 14;
const PIXELFORMAT_R32F = 15;
const PIXELFORMAT_DEPTH = 16;
const PIXELFORMAT_DEPTHSTENCIL = 17;
const PIXELFORMAT_111110F = 18;
const PIXELFORMAT_SRGB = 19;
const PIXELFORMAT_SRGBA = 20;
const PIXELFORMAT_ETC1 = 21;
const PIXELFORMAT_ETC2_RGB = 22;
const PIXELFORMAT_ETC2_RGBA = 23;
const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;
const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;
const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;
const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;
const PIXELFORMAT_ASTC_4x4 = 28;
const PIXELFORMAT_ATC_RGB = 29;
const PIXELFORMAT_ATC_RGBA = 30;
const PIXELFORMAT_BGRA8 = 31;
const PIXELFORMAT_R8I = 32;
const PIXELFORMAT_R8U = 33;
const PIXELFORMAT_R16I = 34;
const PIXELFORMAT_R16U = 35;
const PIXELFORMAT_R32I = 36;
const PIXELFORMAT_R32U = 37;
const PIXELFORMAT_RG8I = 38;
const PIXELFORMAT_RG8U = 39;
const PIXELFORMAT_RG16I = 40;
const PIXELFORMAT_RG16U = 41;
const PIXELFORMAT_RG32I = 42;
const PIXELFORMAT_RG32U = 43;
const PIXELFORMAT_RGBA8I = 44;
const PIXELFORMAT_RGBA8U = 45;
const PIXELFORMAT_RGBA16I = 46;
const PIXELFORMAT_RGBA16U = 47;
const PIXELFORMAT_RGBA32I = 48;
const PIXELFORMAT_RGBA32U = 49;
const pixelFormatInfo = new Map([[PIXELFORMAT_A8, {
  name: 'A8',
  size: 1
}], [PIXELFORMAT_L8, {
  name: 'L8',
  size: 1
}], [PIXELFORMAT_LA8, {
  name: 'LA8',
  size: 2
}], [PIXELFORMAT_RGB565, {
  name: 'RGB565',
  size: 2
}], [PIXELFORMAT_RGBA5551, {
  name: 'RGBA5551',
  size: 2
}], [PIXELFORMAT_RGBA4, {
  name: 'RGBA4',
  size: 2
}], [PIXELFORMAT_RGB8, {
  name: 'RGB8',
  size: 4
}], [PIXELFORMAT_RGBA8, {
  name: 'RGBA8',
  size: 4
}], [PIXELFORMAT_RGB16F, {
  name: 'RGB16F',
  size: 8
}], [PIXELFORMAT_RGBA16F, {
  name: 'RGBA16F',
  size: 8
}], [PIXELFORMAT_RGB32F, {
  name: 'RGB32F',
  size: 16
}], [PIXELFORMAT_RGBA32F, {
  name: 'RGBA32F',
  size: 16
}], [PIXELFORMAT_R32F, {
  name: 'R32F',
  size: 4
}], [PIXELFORMAT_DEPTH, {
  name: 'DEPTH',
  size: 4
}], [PIXELFORMAT_DEPTHSTENCIL, {
  name: 'DEPTHSTENCIL',
  size: 4
}], [PIXELFORMAT_111110F, {
  name: '111110F',
  size: 4
}], [PIXELFORMAT_SRGB, {
  name: 'SRGB',
  size: 4
}], [PIXELFORMAT_SRGBA, {
  name: 'SRGBA',
  size: 4
}], [PIXELFORMAT_BGRA8, {
  name: 'BGRA8',
  size: 4
}], [PIXELFORMAT_DXT1, {
  name: 'DXT1',
  blockSize: 8
}], [PIXELFORMAT_DXT3, {
  name: 'DXT3',
  blockSize: 16
}], [PIXELFORMAT_DXT5, {
  name: 'DXT5',
  blockSize: 16
}], [PIXELFORMAT_ETC1, {
  name: 'ETC1',
  blockSize: 8
}], [PIXELFORMAT_ETC2_RGB, {
  name: 'ETC2_RGB',
  blockSize: 8
}], [PIXELFORMAT_ETC2_RGBA, {
  name: 'ETC2_RGBA',
  blockSize: 16
}], [PIXELFORMAT_PVRTC_2BPP_RGB_1, {
  name: 'PVRTC_2BPP_RGB_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_2BPP_RGBA_1, {
  name: 'PVRTC_2BPP_RGBA_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_4BPP_RGB_1, {
  name: 'PVRTC_4BPP_RGB_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_4BPP_RGBA_1, {
  name: 'PVRTC_4BPP_RGBA_1',
  blockSize: 8
}], [PIXELFORMAT_ASTC_4x4, {
  name: 'ASTC_4x4',
  blockSize: 16
}], [PIXELFORMAT_ATC_RGB, {
  name: 'ATC_RGB',
  blockSize: 8
}], [PIXELFORMAT_ATC_RGBA, {
  name: 'ATC_RGBA',
  blockSize: 16
}], [PIXELFORMAT_R8I, {
  name: 'R8I',
  size: 1,
  isInt: true
}], [PIXELFORMAT_R8U, {
  name: 'R8U',
  size: 1,
  isInt: true
}], [PIXELFORMAT_R16I, {
  name: 'R16I',
  size: 2,
  isInt: true
}], [PIXELFORMAT_R16U, {
  name: 'R16U',
  size: 2,
  isInt: true
}], [PIXELFORMAT_R32I, {
  name: 'R32I',
  size: 4,
  isInt: true
}], [PIXELFORMAT_R32U, {
  name: 'R32U',
  size: 4,
  isInt: true
}], [PIXELFORMAT_RG8I, {
  name: 'RG8I',
  size: 2,
  isInt: true
}], [PIXELFORMAT_RG8U, {
  name: 'RG8U',
  size: 2,
  isInt: true
}], [PIXELFORMAT_RG16I, {
  name: 'RG16I',
  size: 4,
  isInt: true
}], [PIXELFORMAT_RG16U, {
  name: 'RG16U',
  size: 4,
  isInt: true
}], [PIXELFORMAT_RG32I, {
  name: 'RG32I',
  size: 8,
  isInt: true
}], [PIXELFORMAT_RG32U, {
  name: 'RG32U',
  size: 8,
  isInt: true
}], [PIXELFORMAT_RGBA8I, {
  name: 'RGBA8I',
  size: 4,
  isInt: true
}], [PIXELFORMAT_RGBA8U, {
  name: 'RGBA8U',
  size: 4,
  isInt: true
}], [PIXELFORMAT_RGBA16I, {
  name: 'RGBA16I',
  size: 8,
  isInt: true
}], [PIXELFORMAT_RGBA16U, {
  name: 'RGBA16U',
  size: 8,
  isInt: true
}], [PIXELFORMAT_RGBA32I, {
  name: 'RGBA32I',
  size: 16,
  isInt: true
}], [PIXELFORMAT_RGBA32U, {
  name: 'RGBA32U',
  size: 16,
  isInt: true
}]]);
const isCompressedPixelFormat = format => {
  var _pixelFormatInfo$get;
  return ((_pixelFormatInfo$get = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get.blockSize) !== undefined;
};
const isIntegerPixelFormat = format => {
  var _pixelFormatInfo$get2;
  return ((_pixelFormatInfo$get2 = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get2.isInt) === true;
};
const getPixelFormatArrayType = format => {
  switch (format) {
    case PIXELFORMAT_RGB32F:
    case PIXELFORMAT_RGBA32F:
      return Float32Array;
    case PIXELFORMAT_R32I:
    case PIXELFORMAT_RG32I:
    case PIXELFORMAT_RGBA32I:
      return Int32Array;
    case PIXELFORMAT_R32U:
    case PIXELFORMAT_RG32U:
    case PIXELFORMAT_RGBA32U:
      return Uint32Array;
    case PIXELFORMAT_R16I:
    case PIXELFORMAT_RG16I:
    case PIXELFORMAT_RGBA16I:
      return Int16Array;
    case PIXELFORMAT_R16U:
    case PIXELFORMAT_RG16U:
    case PIXELFORMAT_RGBA16U:
    case PIXELFORMAT_RGB565:
    case PIXELFORMAT_RGBA5551:
    case PIXELFORMAT_RGBA4:
    case PIXELFORMAT_RGB16F:
    case PIXELFORMAT_RGBA16F:
      return Uint16Array;
    case PIXELFORMAT_R8I:
    case PIXELFORMAT_RG8I:
    case PIXELFORMAT_RGBA8I:
      return Int8Array;
    default:
      return Uint8Array;
  }
};
const PRIMITIVE_POINTS = 0;
const PRIMITIVE_LINES = 1;
const PRIMITIVE_LINELOOP = 2;
const PRIMITIVE_LINESTRIP = 3;
const PRIMITIVE_TRIANGLES = 4;
const PRIMITIVE_TRISTRIP = 5;
const PRIMITIVE_TRIFAN = 6;
const SEMANTIC_POSITION = "POSITION";
const SEMANTIC_NORMAL = "NORMAL";
const SEMANTIC_TANGENT = "TANGENT";
const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";
const SEMANTIC_BLENDINDICES = "BLENDINDICES";
const SEMANTIC_COLOR = "COLOR";
const SEMANTIC_TEXCOORD = "TEXCOORD";
const SEMANTIC_TEXCOORD0 = "TEXCOORD0";
const SEMANTIC_TEXCOORD1 = "TEXCOORD1";
const SEMANTIC_TEXCOORD2 = "TEXCOORD2";
const SEMANTIC_TEXCOORD3 = "TEXCOORD3";
const SEMANTIC_TEXCOORD4 = "TEXCOORD4";
const SEMANTIC_TEXCOORD5 = "TEXCOORD5";
const SEMANTIC_TEXCOORD6 = "TEXCOORD6";
const SEMANTIC_TEXCOORD7 = "TEXCOORD7";
const SEMANTIC_ATTR = "ATTR";
const SEMANTIC_ATTR0 = "ATTR0";
const SEMANTIC_ATTR1 = "ATTR1";
const SEMANTIC_ATTR2 = "ATTR2";
const SEMANTIC_ATTR3 = "ATTR3";
const SEMANTIC_ATTR4 = "ATTR4";
const SEMANTIC_ATTR5 = "ATTR5";
const SEMANTIC_ATTR6 = "ATTR6";
const SEMANTIC_ATTR7 = "ATTR7";
const SEMANTIC_ATTR8 = "ATTR8";
const SEMANTIC_ATTR9 = "ATTR9";
const SEMANTIC_ATTR10 = "ATTR10";
const SEMANTIC_ATTR11 = "ATTR11";
const SEMANTIC_ATTR12 = "ATTR12";
const SEMANTIC_ATTR13 = "ATTR13";
const SEMANTIC_ATTR14 = "ATTR14";
const SEMANTIC_ATTR15 = "ATTR15";
const SHADERTAG_MATERIAL = 1;
const STENCILOP_KEEP = 0;
const STENCILOP_ZERO = 1;
const STENCILOP_REPLACE = 2;
const STENCILOP_INCREMENT = 3;
const STENCILOP_INCREMENTWRAP = 4;
const STENCILOP_DECREMENT = 5;
const STENCILOP_DECREMENTWRAP = 6;
const STENCILOP_INVERT = 7;
const TEXTURELOCK_NONE = 0;
const TEXTURELOCK_READ = 1;
const TEXTURELOCK_WRITE = 2;
const TEXTURETYPE_DEFAULT = 'default';
const TEXTURETYPE_RGBM = 'rgbm';
const TEXTURETYPE_RGBE = 'rgbe';
const TEXTURETYPE_RGBP = 'rgbp';
const TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';
const TEXHINT_NONE = 0;
const TEXHINT_SHADOWMAP = 1;
const TEXHINT_ASSET = 2;
const TEXHINT_LIGHTMAP = 3;
const TEXTUREDIMENSION_1D = '1d';
const TEXTUREDIMENSION_2D = '2d';
const TEXTUREDIMENSION_2D_ARRAY = '2d-array';
const TEXTUREDIMENSION_CUBE = 'cube';
const TEXTUREDIMENSION_CUBE_ARRAY = 'cube-array';
const TEXTUREDIMENSION_3D = '3d';
const SAMPLETYPE_FLOAT = 0;
const SAMPLETYPE_UNFILTERABLE_FLOAT = 1;
const SAMPLETYPE_DEPTH = 2;
const SAMPLETYPE_INT = 3;
const SAMPLETYPE_UINT = 4;
const TEXTUREPROJECTION_NONE = "none";
const TEXTUREPROJECTION_CUBE = "cube";
const TEXTUREPROJECTION_EQUIRECT = "equirect";
const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";
const SHADERLANGUAGE_GLSL = 'glsl';
const SHADERLANGUAGE_WGSL = 'wgsl';
const TYPE_INT8 = 0;
const TYPE_UINT8 = 1;
const TYPE_INT16 = 2;
const TYPE_UINT16 = 3;
const TYPE_INT32 = 4;
const TYPE_UINT32 = 5;
const TYPE_FLOAT32 = 6;
const TYPE_FLOAT16 = 7;
const UNIFORMTYPE_BOOL = 0;
const UNIFORMTYPE_INT = 1;
const UNIFORMTYPE_FLOAT = 2;
const UNIFORMTYPE_VEC2 = 3;
const UNIFORMTYPE_VEC3 = 4;
const UNIFORMTYPE_VEC4 = 5;
const UNIFORMTYPE_IVEC2 = 6;
const UNIFORMTYPE_IVEC3 = 7;
const UNIFORMTYPE_IVEC4 = 8;
const UNIFORMTYPE_BVEC2 = 9;
const UNIFORMTYPE_BVEC3 = 10;
const UNIFORMTYPE_BVEC4 = 11;
const UNIFORMTYPE_MAT2 = 12;
const UNIFORMTYPE_MAT3 = 13;
const UNIFORMTYPE_MAT4 = 14;
const UNIFORMTYPE_TEXTURE2D = 15;
const UNIFORMTYPE_TEXTURECUBE = 16;
const UNIFORMTYPE_FLOATARRAY = 17;
const UNIFORMTYPE_TEXTURE2D_SHADOW = 18;
const UNIFORMTYPE_TEXTURECUBE_SHADOW = 19;
const UNIFORMTYPE_TEXTURE3D = 20;
const UNIFORMTYPE_VEC2ARRAY = 21;
const UNIFORMTYPE_VEC3ARRAY = 22;
const UNIFORMTYPE_VEC4ARRAY = 23;
const UNIFORMTYPE_MAT4ARRAY = 24;
const UNIFORMTYPE_TEXTURE2D_ARRAY = 25;
const UNIFORMTYPE_UINT = 26;
const UNIFORMTYPE_UVEC2 = 27;
const UNIFORMTYPE_UVEC3 = 28;
const UNIFORMTYPE_UVEC4 = 29;
const UNIFORMTYPE_INTARRAY = 30;
const UNIFORMTYPE_UINTARRAY = 31;
const UNIFORMTYPE_BOOLARRAY = 32;
const UNIFORMTYPE_IVEC2ARRAY = 33;
const UNIFORMTYPE_UVEC2ARRAY = 34;
const UNIFORMTYPE_BVEC2ARRAY = 35;
const UNIFORMTYPE_IVEC3ARRAY = 36;
const UNIFORMTYPE_UVEC3ARRAY = 37;
const UNIFORMTYPE_BVEC3ARRAY = 38;
const UNIFORMTYPE_IVEC4ARRAY = 39;
const UNIFORMTYPE_UVEC4ARRAY = 40;
const UNIFORMTYPE_BVEC4ARRAY = 41;
const UNIFORMTYPE_ITEXTURE2D = 42;
const UNIFORMTYPE_UTEXTURE2D = 43;
const UNIFORMTYPE_ITEXTURECUBE = 44;
const UNIFORMTYPE_UTEXTURECUBE = 45;
const UNIFORMTYPE_ITEXTURE3D = 46;
const UNIFORMTYPE_UTEXTURE3D = 47;
const UNIFORMTYPE_ITEXTURE2D_ARRAY = 48;
const UNIFORMTYPE_UTEXTURE2D_ARRAY = 49;
const uniformTypeToName = ['bool', 'int', 'float', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube', '', 'sampler2DShadow', 'samplerCubeShadow', 'sampler3D', '', '', '', '', 'sampler2DArray', 'uint', 'uvec2', 'uvec3', 'uvec4', '', '', '', '', '', '', '', '', '', '', '', '', 'isampler2D', 'usampler2D', 'isamplerCube', 'usamplerCube', 'isampler3D', 'usampler3D', 'isampler2DArray', 'usampler2DArray'];
const uniformTypeToStorage = new Uint8Array([TYPE_INT32, TYPE_INT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_INT32, TYPE_INT32, TYPE_INT32, TYPE_INT32, TYPE_INT32, TYPE_INT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_INT32, TYPE_INT32, TYPE_FLOAT32, TYPE_INT32, TYPE_INT32, TYPE_INT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_FLOAT32, TYPE_INT32, TYPE_UINT32, TYPE_UINT32, TYPE_UINT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT32]);
const DEVICETYPE_WEBGL1 = 'webgl1';
const DEVICETYPE_WEBGL2 = 'webgl2';
const DEVICETYPE_WEBGPU = 'webgpu';
const DEVICETYPE_NULL = 'null';
const SHADERSTAGE_VERTEX = 1;
const SHADERSTAGE_FRAGMENT = 2;
const SHADERSTAGE_COMPUTE = 4;
const BINDGROUP_MESH = 0;
const BINDGROUP_VIEW = 1;
const bindGroupNames = ['mesh', 'view'];
const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';
const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Uint16Array];
const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4, 2];
const vertexTypesNames = ['INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32', 'FLOAT16'];
const typedArrayToType = {
  "Int8Array": TYPE_INT8,
  "Uint8Array": TYPE_UINT8,
  "Int16Array": TYPE_INT16,
  "Uint16Array": TYPE_UINT16,
  "Int32Array": TYPE_INT32,
  "Uint32Array": TYPE_UINT32,
  "Float32Array": TYPE_FLOAT32
};
const typedArrayIndexFormats = [Uint8Array, Uint16Array, Uint32Array];
const typedArrayIndexFormatsByteSize = [1, 2, 4];
const semanticToLocation = {};
semanticToLocation[SEMANTIC_POSITION] = 0;
semanticToLocation[SEMANTIC_NORMAL] = 1;
semanticToLocation[SEMANTIC_BLENDWEIGHT] = 2;
semanticToLocation[SEMANTIC_BLENDINDICES] = 3;
semanticToLocation[SEMANTIC_COLOR] = 4;
semanticToLocation[SEMANTIC_TEXCOORD0] = 5;
semanticToLocation[SEMANTIC_TEXCOORD1] = 6;
semanticToLocation[SEMANTIC_TEXCOORD2] = 7;
semanticToLocation[SEMANTIC_TEXCOORD3] = 8;
semanticToLocation[SEMANTIC_TEXCOORD4] = 9;
semanticToLocation[SEMANTIC_TEXCOORD5] = 10;
semanticToLocation[SEMANTIC_TEXCOORD6] = 11;
semanticToLocation[SEMANTIC_TEXCOORD7] = 12;
semanticToLocation[SEMANTIC_TANGENT] = 13;
semanticToLocation[SEMANTIC_ATTR0] = 0;
semanticToLocation[SEMANTIC_ATTR1] = 1;
semanticToLocation[SEMANTIC_ATTR2] = 2;
semanticToLocation[SEMANTIC_ATTR3] = 3;
semanticToLocation[SEMANTIC_ATTR4] = 4;
semanticToLocation[SEMANTIC_ATTR5] = 5;
semanticToLocation[SEMANTIC_ATTR6] = 6;
semanticToLocation[SEMANTIC_ATTR7] = 7;
semanticToLocation[SEMANTIC_ATTR8] = 8;
semanticToLocation[SEMANTIC_ATTR9] = 9;
semanticToLocation[SEMANTIC_ATTR10] = 10;
semanticToLocation[SEMANTIC_ATTR11] = 11;
semanticToLocation[SEMANTIC_ATTR12] = 12;
semanticToLocation[SEMANTIC_ATTR13] = 13;
semanticToLocation[SEMANTIC_ATTR14] = 14;
semanticToLocation[SEMANTIC_ATTR15] = 15;
const CHUNKAPI_1_51 = '1.51';
const CHUNKAPI_1_55 = '1.55';
const CHUNKAPI_1_56 = '1.56';
const CHUNKAPI_1_57 = '1.57';
const CHUNKAPI_1_58 = '1.58';
const CHUNKAPI_1_60 = '1.60';
const CHUNKAPI_1_62 = '1.62';
const CHUNKAPI_1_65 = '1.65';

export { ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BINDGROUP_MESH, BINDGROUP_VIEW, BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDEQUATION_REVERSE_SUBTRACT, BLENDEQUATION_SUBTRACT, BLENDMODE_CONSTANT, BLENDMODE_DST_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_CONSTANT, BLENDMODE_ONE_MINUS_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC_COLOR, BLENDMODE_ZERO, BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM, CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_58, CHUNKAPI_1_60, CHUNKAPI_1_62, CHUNKAPI_1_65, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CUBEFACE_NEGX, CUBEFACE_NEGY, CUBEFACE_NEGZ, CUBEFACE_POSX, CUBEFACE_POSY, CUBEFACE_POSZ, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE, DEVICETYPE_NULL, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, INDEXFORMAT_UINT8, PIXELFORMAT_111110F, PIXELFORMAT_A8, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_R16I, PIXELFORMAT_R16U, PIXELFORMAT_R32F, PIXELFORMAT_R32I, PIXELFORMAT_R32U, PIXELFORMAT_R8I, PIXELFORMAT_R8U, PIXELFORMAT_RG16I, PIXELFORMAT_RG16U, PIXELFORMAT_RG32I, PIXELFORMAT_RG32U, PIXELFORMAT_RG8I, PIXELFORMAT_RG8U, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGB565, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16I, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32I, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA8I, PIXELFORMAT_RGBA8U, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, SEMANTIC_ATTR, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_ATTR5, SEMANTIC_ATTR6, SEMANTIC_ATTR7, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, SHADERTAG_MATERIAL, STENCILOP_DECREMENT, STENCILOP_DECREMENTWRAP, STENCILOP_INCREMENT, STENCILOP_INCREMENTWRAP, STENCILOP_INVERT, STENCILOP_KEEP, STENCILOP_REPLACE, STENCILOP_ZERO, TEXHINT_ASSET, TEXHINT_LIGHTMAP, TEXHINT_NONE, TEXHINT_SHADOWMAP, TEXTUREDIMENSION_1D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_CUBE_ARRAY, TEXTURELOCK_NONE, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_OCTAHEDRAL, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR, TYPE_FLOAT16, TYPE_FLOAT32, TYPE_INT16, TYPE_INT32, TYPE_INT8, TYPE_UINT16, TYPE_UINT32, TYPE_UINT8, UNIFORMTYPE_BOOL, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_ITEXTURE2D_ARRAY, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_IVEC4, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURE2D_ARRAY, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_UINT, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_UTEXTURE2D, UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_UVEC4, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, bindGroupNames, getPixelFormatArrayType, isCompressedPixelFormat, isIntegerPixelFormat, pixelFormatInfo, semanticToLocation, typedArrayIndexFormats, typedArrayIndexFormatsByteSize, typedArrayToType, typedArrayTypes, typedArrayTypesByteSize, uniformTypeToName, uniformTypeToStorage, vertexTypesNames };