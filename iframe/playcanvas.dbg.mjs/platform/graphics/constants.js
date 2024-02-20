/**
 * Ignores the integer part of texture coordinates, using only the fractional part.
 *
 * @type {number}
 * @category Graphics
 */
const ADDRESS_REPEAT = 0;

/**
 * Clamps texture coordinate to the range 0 to 1.
 *
 * @type {number}
 * @category Graphics
 */
const ADDRESS_CLAMP_TO_EDGE = 1;

/**
 * Texture coordinate to be set to the fractional part if the integer part is even. If the integer
 * part is odd, then the texture coordinate is set to 1 minus the fractional part.
 *
 * @type {number}
 * @category Graphics
 */
const ADDRESS_MIRRORED_REPEAT = 2;

/**
 * Multiply all fragment components by zero.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ZERO = 0;

/**
 * Multiply all fragment components by one.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE = 1;

/**
 * Multiply all fragment components by the components of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_SRC_COLOR = 2;

/**
 * Multiply all fragment components by one minus the components of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;

/**
 * Multiply all fragment components by the components of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_DST_COLOR = 4;

/**
 * Multiply all fragment components by one minus the components of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE_MINUS_DST_COLOR = 5;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_SRC_ALPHA = 6;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_SRC_ALPHA_SATURATE = 7;

/**
 * Multiply all fragment components by one minus the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;

/**
 * Multiply all fragment components by the alpha value of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_DST_ALPHA = 9;

/**
 * Multiply all fragment components by one minus the alpha value of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;

/**
 * Multiplies all fragment components by a constant.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_CONSTANT = 11;

/**
 * Multiplies all fragment components by 1 minus a constant.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDMODE_ONE_MINUS_CONSTANT = 12;

/**
 * Add the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDEQUATION_ADD = 0;

/**
 * Subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDEQUATION_SUBTRACT = 1;

/**
 * Reverse and subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDEQUATION_REVERSE_SUBTRACT = 2;

/**
 * Use the smallest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDEQUATION_MIN = 3;

/**
 * Use the largest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLENDEQUATION_MAX = 4;

/**
 * The data store contents will be modified once and used many times.
 *
 * @type {number}
 * @category Graphics
 */
const BUFFER_STATIC = 0;

/**
 * The data store contents will be modified repeatedly and used many times.
 *
 * @type {number}
 * @category Graphics
 */
const BUFFER_DYNAMIC = 1;

/**
 * The data store contents will be modified once and used at most a few times.
 *
 * @type {number}
 * @category Graphics
 */
const BUFFER_STREAM = 2;

/**
 * The data store contents will be modified repeatedly on the GPU and used many times. Optimal for
 * transform feedback usage (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const BUFFER_GPUDYNAMIC = 3;

/**
 * Clear the color buffer.
 *
 * @type {number}
 * @category Graphics
 */
const CLEARFLAG_COLOR = 1;

/**
 * Clear the depth buffer.
 *
 * @type {number}
 * @category Graphics
 */
const CLEARFLAG_DEPTH = 2;

/**
 * Clear the stencil buffer.
 *
 * @type {number}
 * @category Graphics
 */
const CLEARFLAG_STENCIL = 4;

/**
 * The positive X face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_POSX = 0;

/**
 * The negative X face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_NEGX = 1;

/**
 * The positive Y face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_POSY = 2;

/**
 * The negative Y face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_NEGY = 3;

/**
 * The positive Z face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_POSZ = 4;

/**
 * The negative Z face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEFACE_NEGZ = 5;

/**
 * No triangles are culled.
 *
 * @type {number}
 * @category Graphics
 */
const CULLFACE_NONE = 0;

/**
 * Triangles facing away from the view direction are culled.
 *
 * @type {number}
 * @category Graphics
 */
const CULLFACE_BACK = 1;

/**
 * Triangles facing the view direction are culled.
 *
 * @type {number}
 * @category Graphics
 */
const CULLFACE_FRONT = 2;

/**
 * Triangles are culled regardless of their orientation with respect to the view direction. Note
 * that point or line primitives are unaffected by this render state.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const CULLFACE_FRONTANDBACK = 3;

/**
 * Point sample filtering.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_NEAREST = 0;

/**
 * Bilinear filtering.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_LINEAR = 1;

/**
 * Use the nearest neighbor in the nearest mipmap level.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_NEAREST_MIPMAP_NEAREST = 2;

/**
 * Linearly interpolate in the nearest mipmap level.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_NEAREST_MIPMAP_LINEAR = 3;

/**
 * Use the nearest neighbor after linearly interpolating between mipmap levels.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_LINEAR_MIPMAP_NEAREST = 4;

/**
 * Linearly interpolate both the mipmap levels and between texels.
 *
 * @type {number}
 * @category Graphics
 */
const FILTER_LINEAR_MIPMAP_LINEAR = 5;

/**
 * Never pass.
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_NEVER = 0;

/**
 * Pass if (ref & mask) < (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_LESS = 1;

/**
 * Pass if (ref & mask) == (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_EQUAL = 2;

/**
 * Pass if (ref & mask) <= (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_LESSEQUAL = 3;

/**
 * Pass if (ref & mask) > (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_GREATER = 4;

/**
 * Pass if (ref & mask) != (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_NOTEQUAL = 5;

/**
 * Pass if (ref & mask) >= (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_GREATEREQUAL = 6;

/**
 * Always pass.
 *
 * @type {number}
 * @category Graphics
 */
const FUNC_ALWAYS = 7;

/**
 * 8-bit unsigned vertex indices (0 to 255).
 *
 * @type {number}
 * @category Graphics
 */
const INDEXFORMAT_UINT8 = 0;

/**
 * 16-bit unsigned vertex indices (0 to 65,535).
 *
 * @type {number}
 * @category Graphics
 */
const INDEXFORMAT_UINT16 = 1;

/**
 * 32-bit unsigned vertex indices (0 to 4,294,967,295).
 *
 * @type {number}
 * @category Graphics
 */
const INDEXFORMAT_UINT32 = 2;

/**
 * 8-bit alpha.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_A8 = 0;

/**
 * 8-bit luminance.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_L8 = 1;

/**
 * 8-bit luminance with 8-bit alpha.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_LA8 = 2;

/**
 * 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGB565 = 3;

/**
 * 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA5551 = 4;

/**
 * 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA4 = 5;

/**
 * 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGB8 = 6;

/**
 * 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA8 = 7;

/**
 * Block compressed format storing 16 input pixels in 64 bits of output, consisting of two 16-bit
 * RGB 5:6:5 color values and a 4x4 two bit lookup table.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_DXT1 = 8;

/**
 * Block compressed format storing 16 input pixels (corresponding to a 4x4 pixel block) into 128
 * bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by
 * 64 bits of color data; encoded the same way as DXT1.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_DXT3 = 9;

/**
 * Block compressed format storing 16 input pixels into 128 bits of output, consisting of 64 bits
 * of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits
 * of color data (encoded the same way as DXT1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_DXT5 = 10;

/**
 * 16-bit floating point RGB (16-bit float for each red, green and blue channels).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGB16F = 11;

/**
 * 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA16F = 12;

/**
 * 32-bit floating point RGB (32-bit float for each red, green and blue channels).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGB32F = 13;

/**
 * 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA32F = 14;

/**
 * 32-bit floating point single channel format (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R32F = 15;

/**
 * A readable depth buffer format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_DEPTH = 16;

/**
 * A readable depth/stencil buffer format (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_DEPTHSTENCIL = 17;

/**
 * A floating-point color-only format with 11 bits for red and green channels and 10 bits for the
 * blue channel (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_111110F = 18;

/**
 * Color-only sRGB format (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_SRGB = 19;

/**
 * Color sRGB format with additional alpha channel (WebGL2 only).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_SRGBA = 20;

/**
 * ETC1 compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ETC1 = 21;

/**
 * ETC2 (RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ETC2_RGB = 22;

/**
 * ETC2 (RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ETC2_RGBA = 23;

/**
 * PVRTC (2BPP RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;

/**
 * PVRTC (2BPP RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;

/**
 * PVRTC (4BPP RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;

/**
 * PVRTC (4BPP RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;

/**
 * ATC compressed format with alpha channel in blocks of 4x4.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ASTC_4x4 = 28;

/**
 * ATC compressed format with no alpha channel.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ATC_RGB = 29;

/**
 * ATC compressed format with alpha channel.
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_ATC_RGBA = 30;

/**
 * 32-bit BGRA (8-bits for blue channel, 8 for green, 8 for red with 8-bit alpha).
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const PIXELFORMAT_BGRA8 = 31;

/**
 * 8-bit signed integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R8I = 32;

/**
 * 8-bit unsigned integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R8U = 33;

/**
 * 16-bit signed integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R16I = 34;

/**
 * 16-bit unsigned integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R16U = 35;

/**
 * 32-bit signed integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R32I = 36;

/**
 * 32-bit unsigned integer single-channel (R) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_R32U = 37;

/**
 * 8-bit per-channel signed integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG8I = 38;

/**
 * 8-bit per-channel unsigned integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG8U = 39;

/**
 * 16-bit per-channel signed integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG16I = 40;

/**
 * 16-bit per-channel unsigned integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG16U = 41;

/**
 * 32-bit per-channel signed integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG32I = 42;

/**
 * 32-bit per-channel unsigned integer (RG) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RG32U = 43;

/**
 * 8-bit per-channel signed integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA8I = 44;

/**
 * 8-bit per-channel unsigned integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA8U = 45;

/**
 * 16-bit per-channel signed integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA16I = 46;

/**
 * 16-bit per-channel unsigned integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA16U = 47;

/**
 * 32-bit per-channel signed integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA32I = 48;

/**
 * 32-bit per-channel unsigned integer (RGBA) format (Not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const PIXELFORMAT_RGBA32U = 49;

// map of engine PIXELFORMAT_*** enums to information about the format
const pixelFormatInfo = new Map([
// uncompressed formats
[PIXELFORMAT_A8, {
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
}],
// compressed formats
[PIXELFORMAT_DXT1, {
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
}],
// uncompressed integer formats (Not supported on WebGL1)
[PIXELFORMAT_R8I, {
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

// update this function when exposing additional compressed pixel formats
const isCompressedPixelFormat = format => {
  var _pixelFormatInfo$get;
  return ((_pixelFormatInfo$get = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get.blockSize) !== undefined;
};
const isIntegerPixelFormat = format => {
  var _pixelFormatInfo$get2;
  return ((_pixelFormatInfo$get2 = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get2.isInt) === true;
};

// get the pixel format array type
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

/**
 * List of distinct points.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_POINTS = 0;

/**
 * Discrete list of line segments.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_LINES = 1;

/**
 * List of points that are linked sequentially by line segments, with a closing line segment
 * between the last and first points.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_LINELOOP = 2;

/**
 * List of points that are linked sequentially by line segments.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_LINESTRIP = 3;

/**
 * Discrete list of triangles.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_TRIANGLES = 4;

/**
 * Connected strip of triangles where a specified vertex forms a triangle using the previous two.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_TRISTRIP = 5;

/**
 * Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
 *
 * @type {number}
 * @category Graphics
 */
const PRIMITIVE_TRIFAN = 6;

/**
 * Vertex attribute to be treated as a position.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_POSITION = "POSITION";

/**
 * Vertex attribute to be treated as a normal.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_NORMAL = "NORMAL";

/**
 * Vertex attribute to be treated as a tangent.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TANGENT = "TANGENT";

/**
 * Vertex attribute to be treated as skin blend weights.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";

/**
 * Vertex attribute to be treated as skin blend indices.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_BLENDINDICES = "BLENDINDICES";

/**
 * Vertex attribute to be treated as a color.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_COLOR = "COLOR";

// private semantic used for programmatic construction of individual texcoord semantics
const SEMANTIC_TEXCOORD = "TEXCOORD";

/**
 * Vertex attribute to be treated as a texture coordinate (set 0).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD0 = "TEXCOORD0";

/**
 * Vertex attribute to be treated as a texture coordinate (set 1).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD1 = "TEXCOORD1";

/**
 * Vertex attribute to be treated as a texture coordinate (set 2).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD2 = "TEXCOORD2";

/**
 * Vertex attribute to be treated as a texture coordinate (set 3).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD3 = "TEXCOORD3";

/**
 * Vertex attribute to be treated as a texture coordinate (set 4).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD4 = "TEXCOORD4";

/**
 * Vertex attribute to be treated as a texture coordinate (set 5).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD5 = "TEXCOORD5";

/**
 * Vertex attribute to be treated as a texture coordinate (set 6).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD6 = "TEXCOORD6";

/**
 * Vertex attribute to be treated as a texture coordinate (set 7).
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_TEXCOORD7 = "TEXCOORD7";

// private semantic used for programmatic construction of individual attr semantics
const SEMANTIC_ATTR = "ATTR";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR0 = "ATTR0";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR1 = "ATTR1";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR2 = "ATTR2";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR3 = "ATTR3";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR4 = "ATTR4";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR5 = "ATTR5";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR6 = "ATTR6";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR7 = "ATTR7";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR8 = "ATTR8";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR9 = "ATTR9";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR10 = "ATTR10";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR11 = "ATTR11";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR12 = "ATTR12";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR13 = "ATTR13";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR14 = "ATTR14";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
const SEMANTIC_ATTR15 = "ATTR15";
const SHADERTAG_MATERIAL = 1;

/**
 * Don't change the stencil buffer value.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_KEEP = 0;

/**
 * Set value to zero.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_ZERO = 1;

/**
 * Replace value with the reference value (see {@link StencilParameters}).
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_REPLACE = 2;

/**
 * Increment the value.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_INCREMENT = 3;

/**
 * Increment the value but wrap it to zero when it's larger than a maximum representable value.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_INCREMENTWRAP = 4;

/**
 * Decrement the value.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_DECREMENT = 5;

/**
 * Decrement the value but wrap it to a maximum representable value if the current value is 0.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_DECREMENTWRAP = 6;

/**
 * Invert the value bitwise.
 *
 * @type {number}
 * @category Graphics
 */
const STENCILOP_INVERT = 7;

/**
 * The texture is not in a locked state.
 *
 * @type {number}
 */
const TEXTURELOCK_NONE = 0;

/**
 * Read only. Any changes to the locked mip level's pixels will not update the texture.
 *
 * @type {number}
 * @category Graphics
 */
const TEXTURELOCK_READ = 1;

/**
 * Write only. The contents of the specified mip level will be entirely replaced.
 *
 * @type {number}
 * @category Graphics
 */
const TEXTURELOCK_WRITE = 2;

/**
 * Texture is a default type.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTURETYPE_DEFAULT = 'default';

/**
 * Texture stores high dynamic range data in RGBM format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTURETYPE_RGBM = 'rgbm';

/**
 * Texture stores high dynamic range data in RGBE format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTURETYPE_RGBE = 'rgbe';

/**
 * Texture stores high dynamic range data in RGBP encoding.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTURETYPE_RGBP = 'rgbp';

/**
 * Texture stores normalmap data swizzled in GGGR format. This is used for tangent space normal
 * maps. The R component is stored in alpha and G is stored in RGB. This packing can result in
 * higher quality when the texture data is compressed.
 *
 * @type {string}
 * @category Graphics
 */
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

/**
 * Texture data is not stored a specific projection format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTUREPROJECTION_NONE = "none";

/**
 * Texture data is stored in cubemap projection format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTUREPROJECTION_CUBE = "cube";

/**
 * Texture data is stored in equirectangular projection format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTUREPROJECTION_EQUIRECT = "equirect";

/**
 * Texture data is stored in octahedral projection format.
 *
 * @type {string}
 * @category Graphics
 */
const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";

/**
 * Shader source code uses GLSL language.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERLANGUAGE_GLSL = 'glsl';

/**
 * Shader source code uses WGSL language.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERLANGUAGE_WGSL = 'wgsl';

/**
 * Signed byte vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_INT8 = 0;

/**
 * Unsigned byte vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_UINT8 = 1;

/**
 * Signed short vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_INT16 = 2;

/**
 * Unsigned short vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_UINT16 = 3;

/**
 * Signed integer vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_INT32 = 4;

/**
 * Unsigned integer vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_UINT32 = 5;

/**
 * Floating point vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_FLOAT32 = 6;

/**
 * 16-bit floating point vertex element type (not supported by WebGL1).
 *
 * @type {number}
 * @category Graphics
 */
const TYPE_FLOAT16 = 7;

// Uniform types
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

// Unsigned uniform types
const UNIFORMTYPE_UINT = 26;
const UNIFORMTYPE_UVEC2 = 27;
const UNIFORMTYPE_UVEC3 = 28;
const UNIFORMTYPE_UVEC4 = 29;

// Integer uniform array types
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

// Integer texture types
const UNIFORMTYPE_ITEXTURE2D = 42;
const UNIFORMTYPE_UTEXTURE2D = 43;
const UNIFORMTYPE_ITEXTURECUBE = 44;
const UNIFORMTYPE_UTEXTURECUBE = 45;
const UNIFORMTYPE_ITEXTURE3D = 46;
const UNIFORMTYPE_UTEXTURE3D = 47;
const UNIFORMTYPE_ITEXTURE2D_ARRAY = 48;
const UNIFORMTYPE_UTEXTURE2D_ARRAY = 49;
const uniformTypeToName = [
// Uniforms
'bool', 'int', 'float', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube', '',
// not directly handled: UNIFORMTYPE_FLOATARRAY
'sampler2DShadow', 'samplerCubeShadow', 'sampler3D', '',
// not directly handled: UNIFORMTYPE_VEC2ARRAY
'',
// not directly handled: UNIFORMTYPE_VEC3ARRAY
'',
// not directly handled: UNIFORMTYPE_VEC4ARRAY
'',
// not directly handled: UNIFORMTYPE_MAT4ARRAY
'sampler2DArray', 'uint', 'uvec2', 'uvec3', 'uvec4', '',
// not directly handled: UNIFORMTYPE_INTARRAY
'',
// not directly handled: UNIFORMTYPE_UINTARRAY
'',
// not directly handled: UNIFORMTYPE_BOOLARRAY
'',
// not directly handled: UNIFORMTYPE_IVEC2ARRAY
'',
// not directly handled: UNIFORMTYPE_UVEC2ARRAY
'',
// not directly handled: UNIFORMTYPE_BVEC2ARRAY
'',
// not directly handled: UNIFORMTYPE_IVEC3ARRAY
'',
// not directly handled: UNIFORMTYPE_UVEC3ARRAY
'',
// not directly handled: UNIFORMTYPE_BVEC3ARRAY
'',
// not directly handled: UNIFORMTYPE_IVEC4ARRAY
'',
// not directly handled: UNIFORMTYPE_UVEC4ARRAY
'',
// not directly handled: UNIFORMTYPE_BVEC4ARRAY
'isampler2D', 'usampler2D', 'isamplerCube', 'usamplerCube', 'isampler3D', 'usampler3D', 'isampler2DArray', 'usampler2DArray'];

// Map to convert uniform type to storage type, used in uniform-buffer.js
const uniformTypeToStorage = new Uint8Array([TYPE_INT32,
// UNIFORMTYPE_BOOL
TYPE_INT32,
// UNIFORMTYPE_INT
TYPE_FLOAT32,
// UNIFORMTYPE_FLOAT
TYPE_FLOAT32,
// UNIFORMTYPE_VEC2
TYPE_FLOAT32,
// UNIFORMTYPE_VEC3
TYPE_FLOAT32,
// UNIFORMTYPE_VEC4
TYPE_INT32,
// UNIFORMTYPE_IVEC2
TYPE_INT32,
// UNIFORMTYPE_IVEC3
TYPE_INT32,
// UNIFORMTYPE_IVEC4
TYPE_INT32,
// UNIFORMTYPE_BVEC2
TYPE_INT32,
// UNIFORMTYPE_BVEC3
TYPE_INT32,
// UNIFORMTYPE_BVEC4
TYPE_FLOAT32,
// UNIFORMTYPE_MAT2
TYPE_FLOAT32,
// UNIFORMTYPE_MAT3
TYPE_FLOAT32,
// UNIFORMTYPE_MAT4
TYPE_INT32,
// UNIFORMTYPE_TEXTURE2D
TYPE_INT32,
// UNIFORMTYPE_TEXTURECUBE
TYPE_FLOAT32,
// UNIFORMTYPE_FLOATARRAY
TYPE_INT32,
// UNIFORMTYPE_TEXTURE2D_SHADOW
TYPE_INT32,
// UNIFORMTYPE_TEXTURECUBE_SHADOW
TYPE_INT32,
// UNIFORMTYPE_TEXTURE3D
TYPE_FLOAT32,
// UNIFORMTYPE_VEC2ARRAY
TYPE_FLOAT32,
// UNIFORMTYPE_VEC3ARRAY
TYPE_FLOAT32,
// UNIFORMTYPE_VEC4ARRAY
TYPE_FLOAT32,
// UNIFORMTYPE_MAT4ARRAY
TYPE_INT32,
// UNIFORMTYPE_TEXTURE2D_ARRAY
TYPE_UINT32,
// UNIFORMTYPE_UINT
TYPE_UINT32,
// UNIFORMTYPE_UVEC2
TYPE_UINT32,
// UNIFORMTYPE_UVEC3
TYPE_UINT32,
// UNIFORMTYPE_UVEC4
TYPE_INT32,
// UNIFORMTYPE_INTARRAY
TYPE_UINT32,
// UNIFORMTYPE_UINTARRAY
TYPE_INT32,
// UNIFORMTYPE_BOOLARRAY
TYPE_INT32,
// UNIFORMTYPE_IVEC2ARRAY
TYPE_UINT32,
// UNIFORMTYPE_UVEC2ARRAY
TYPE_INT32,
// UNIFORMTYPE_BVEC2ARRAY
TYPE_INT32,
// UNIFORMTYPE_IVEC3ARRAY
TYPE_UINT32,
// UNIFORMTYPE_UVEC3ARRAY
TYPE_INT32,
// UNIFORMTYPE_BVEC3ARRAY
TYPE_INT32,
// UNIFORMTYPE_IVEC4ARRAY
TYPE_UINT32,
// UNIFORMTYPE_UVEC4ARRAY
TYPE_INT32,
// UNIFORMTYPE_BVEC4ARRAY
TYPE_INT32,
// UNIFORMTYPE_ITEXTURE2D
TYPE_UINT32,
// UNIFORMTYPE_UTEXTURE2D
TYPE_INT32,
// UNIFORMTYPE_ITEXTURECUBE
TYPE_UINT32,
// UNIFORMTYPE_UTEXTURECUBE
TYPE_INT32,
// UNIFORMTYPE_ITEXTURE3D
TYPE_UINT32,
// UNIFORMTYPE_UTEXTURE3D
TYPE_INT32,
// UNIFORMTYPE_ITEXTURE2D_ARRAY
TYPE_UINT32 // UNIFORMTYPE_UTEXTURE2D_ARRAY
]);

/**
 * A WebGL 1 device type.
 *
 * @type {string}
 * @category Graphics
 */
const DEVICETYPE_WEBGL1 = 'webgl1';

/**
 * A WebGL 2 device type.
 *
 * @type {string}
 * @category Graphics
 */
const DEVICETYPE_WEBGL2 = 'webgl2';

/**
 * A WebGPU device type.
 *
 * @type {string}
 * @category Graphics
 */
const DEVICETYPE_WEBGPU = 'webgpu';

/**
 * A Null device type.
 *
 * @type {string}
 * @category Graphics
 */
const DEVICETYPE_NULL = 'null';

// (bit-flags) shader stages for resource visibility on the GPU
const SHADERSTAGE_VERTEX = 1;
const SHADERSTAGE_FRAGMENT = 2;
const SHADERSTAGE_COMPUTE = 4;

// indices of commonly used bind groups
// sorted in a way that any trailing bind groups can be unused in any render pass
const BINDGROUP_MESH = 0;
const BINDGROUP_VIEW = 1;

// names of bind groups
const bindGroupNames = ['mesh', 'view'];

// name of the default uniform buffer slot in a bind group
const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';

// map of engine TYPE_*** enums to their corresponding typed array constructors and byte sizes
const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Uint16Array];
const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4, 2];
const vertexTypesNames = ['INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32', 'FLOAT16'];

// map of typed array to engine TYPE_***
const typedArrayToType = {
  "Int8Array": TYPE_INT8,
  "Uint8Array": TYPE_UINT8,
  "Int16Array": TYPE_INT16,
  "Uint16Array": TYPE_UINT16,
  "Int32Array": TYPE_INT32,
  "Uint32Array": TYPE_UINT32,
  "Float32Array": TYPE_FLOAT32
};

// map of engine INDEXFORMAT_*** to their corresponding typed array constructors and byte sizes
const typedArrayIndexFormats = [Uint8Array, Uint16Array, Uint32Array];
const typedArrayIndexFormatsByteSize = [1, 2, 4];

/**
 * Map of engine semantics into location on device in range 0..15 (note - semantics mapping to the
 * same location cannot be used at the same time) organized in a way that ATTR0-ATTR7 do not
 * overlap with common important semantics.
 *
 * @type {object}
 * @ignore
 * @category Graphics
 */
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

/**
 * Chunk API versions
 *
 * @type {string}
 * @category Graphics
 */
const CHUNKAPI_1_51 = '1.51';
const CHUNKAPI_1_55 = '1.55';
const CHUNKAPI_1_56 = '1.56';
const CHUNKAPI_1_57 = '1.57';
const CHUNKAPI_1_58 = '1.58';
const CHUNKAPI_1_60 = '1.60';
const CHUNKAPI_1_62 = '1.62';
const CHUNKAPI_1_65 = '1.65';

export { ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BINDGROUP_MESH, BINDGROUP_VIEW, BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDEQUATION_REVERSE_SUBTRACT, BLENDEQUATION_SUBTRACT, BLENDMODE_CONSTANT, BLENDMODE_DST_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_CONSTANT, BLENDMODE_ONE_MINUS_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC_COLOR, BLENDMODE_ZERO, BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM, CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_58, CHUNKAPI_1_60, CHUNKAPI_1_62, CHUNKAPI_1_65, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CUBEFACE_NEGX, CUBEFACE_NEGY, CUBEFACE_NEGZ, CUBEFACE_POSX, CUBEFACE_POSY, CUBEFACE_POSZ, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE, DEVICETYPE_NULL, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, INDEXFORMAT_UINT8, PIXELFORMAT_111110F, PIXELFORMAT_A8, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_R16I, PIXELFORMAT_R16U, PIXELFORMAT_R32F, PIXELFORMAT_R32I, PIXELFORMAT_R32U, PIXELFORMAT_R8I, PIXELFORMAT_R8U, PIXELFORMAT_RG16I, PIXELFORMAT_RG16U, PIXELFORMAT_RG32I, PIXELFORMAT_RG32U, PIXELFORMAT_RG8I, PIXELFORMAT_RG8U, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGB565, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16I, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32I, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA8I, PIXELFORMAT_RGBA8U, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, SEMANTIC_ATTR, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_ATTR5, SEMANTIC_ATTR6, SEMANTIC_ATTR7, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, SHADERTAG_MATERIAL, STENCILOP_DECREMENT, STENCILOP_DECREMENTWRAP, STENCILOP_INCREMENT, STENCILOP_INCREMENTWRAP, STENCILOP_INVERT, STENCILOP_KEEP, STENCILOP_REPLACE, STENCILOP_ZERO, TEXHINT_ASSET, TEXHINT_LIGHTMAP, TEXHINT_NONE, TEXHINT_SHADOWMAP, TEXTUREDIMENSION_1D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_CUBE_ARRAY, TEXTURELOCK_NONE, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_OCTAHEDRAL, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR, TYPE_FLOAT16, TYPE_FLOAT32, TYPE_INT16, TYPE_INT32, TYPE_INT8, TYPE_UINT16, TYPE_UINT32, TYPE_UINT8, UNIFORMTYPE_BOOL, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_ITEXTURE2D_ARRAY, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_IVEC4, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURE2D_ARRAY, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_UINT, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_UTEXTURE2D, UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_UVEC4, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, bindGroupNames, getPixelFormatArrayType, isCompressedPixelFormat, isIntegerPixelFormat, pixelFormatInfo, semanticToLocation, typedArrayIndexFormats, typedArrayIndexFormatsByteSize, typedArrayToType, typedArrayTypes, typedArrayTypesByteSize, uniformTypeToName, uniformTypeToStorage, vertexTypesNames };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSWdub3JlcyB0aGUgaW50ZWdlciBwYXJ0IG9mIHRleHR1cmUgY29vcmRpbmF0ZXMsIHVzaW5nIG9ubHkgdGhlIGZyYWN0aW9uYWwgcGFydC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBBRERSRVNTX1JFUEVBVCA9IDA7XG5cbi8qKlxuICogQ2xhbXBzIHRleHR1cmUgY29vcmRpbmF0ZSB0byB0aGUgcmFuZ2UgMCB0byAxLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEFERFJFU1NfQ0xBTVBfVE9fRURHRSA9IDE7XG5cbi8qKlxuICogVGV4dHVyZSBjb29yZGluYXRlIHRvIGJlIHNldCB0byB0aGUgZnJhY3Rpb25hbCBwYXJ0IGlmIHRoZSBpbnRlZ2VyIHBhcnQgaXMgZXZlbi4gSWYgdGhlIGludGVnZXJcbiAqIHBhcnQgaXMgb2RkLCB0aGVuIHRoZSB0ZXh0dXJlIGNvb3JkaW5hdGUgaXMgc2V0IHRvIDEgbWludXMgdGhlIGZyYWN0aW9uYWwgcGFydC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgemVyby5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfWkVSTyA9IDA7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgb25lLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkUgPSAxO1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IHRoZSBjb21wb25lbnRzIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1NSQ19DT0xPUiA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgb25lIG1pbnVzIHRoZSBjb21wb25lbnRzIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IgPSAzO1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IHRoZSBjb21wb25lbnRzIG9mIHRoZSBkZXN0aW5hdGlvbiBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfRFNUX0NPTE9SID0gNDtcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSBvbmUgbWludXMgdGhlIGNvbXBvbmVudHMgb2YgdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SID0gNTtcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfU1JDX0FMUEhBID0gNjtcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFID0gNztcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSBvbmUgbWludXMgdGhlIGFscGhhIHZhbHVlIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEgPSA4O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IHRoZSBhbHBoYSB2YWx1ZSBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0RTVF9BTFBIQSA9IDk7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgb25lIG1pbnVzIHRoZSBhbHBoYSB2YWx1ZSBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEgPSAxMDtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IGEgY29uc3RhbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UID0gMTE7XG5cbi8qKlxuICogTXVsdGlwbGllcyBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSAxIG1pbnVzIGEgY29uc3RhbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVCA9IDEyO1xuXG4vKipcbiAqIEFkZCB0aGUgcmVzdWx0cyBvZiB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBmcmFnbWVudCBtdWx0aXBsaWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fQUREID0gMDtcblxuLyoqXG4gKiBTdWJ0cmFjdCB0aGUgcmVzdWx0cyBvZiB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBmcmFnbWVudCBtdWx0aXBsaWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fU1VCVFJBQ1QgPSAxO1xuXG4vKipcbiAqIFJldmVyc2UgYW5kIHN1YnRyYWN0IHRoZSByZXN1bHRzIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYWdtZW50IG11bHRpcGxpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRFUVVBVElPTl9SRVZFUlNFX1NVQlRSQUNUID0gMjtcblxuLyoqXG4gKiBVc2UgdGhlIHNtYWxsZXN0IHZhbHVlLiBDaGVjayBhcHAuZ3JhcGhpY3NEZXZpY2UuZXh0QmxlbmRNaW5tYXggZm9yIHN1cHBvcnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRFUVVBVElPTl9NSU4gPSAzO1xuXG4vKipcbiAqIFVzZSB0aGUgbGFyZ2VzdCB2YWx1ZS4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fTUFYID0gNDtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIG9uY2UgYW5kIHVzZWQgbWFueSB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCVUZGRVJfU1RBVElDID0gMDtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIHJlcGVhdGVkbHkgYW5kIHVzZWQgbWFueSB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCVUZGRVJfRFlOQU1JQyA9IDE7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCBvbmNlIGFuZCB1c2VkIGF0IG1vc3QgYSBmZXcgdGltZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQlVGRkVSX1NUUkVBTSA9IDI7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCByZXBlYXRlZGx5IG9uIHRoZSBHUFUgYW5kIHVzZWQgbWFueSB0aW1lcy4gT3B0aW1hbCBmb3JcbiAqIHRyYW5zZm9ybSBmZWVkYmFjayB1c2FnZSAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJVRkZFUl9HUFVEWU5BTUlDID0gMztcblxuLyoqXG4gKiBDbGVhciB0aGUgY29sb3IgYnVmZmVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IENMRUFSRkxBR19DT0xPUiA9IDE7XG5cbi8qKlxuICogQ2xlYXIgdGhlIGRlcHRoIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBDTEVBUkZMQUdfREVQVEggPSAyO1xuXG4vKipcbiAqIENsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBDTEVBUkZMQUdfU1RFTkNJTCA9IDQ7XG5cbi8qKlxuICogVGhlIHBvc2l0aXZlIFggZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfUE9TWCA9IDA7XG5cbi8qKlxuICogVGhlIG5lZ2F0aXZlIFggZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfTkVHWCA9IDE7XG5cbi8qKlxuICogVGhlIHBvc2l0aXZlIFkgZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfUE9TWSA9IDI7XG5cbi8qKlxuICogVGhlIG5lZ2F0aXZlIFkgZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfTkVHWSA9IDM7XG5cbi8qKlxuICogVGhlIHBvc2l0aXZlIFogZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfUE9TWiA9IDQ7XG5cbi8qKlxuICogVGhlIG5lZ2F0aXZlIFogZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfTkVHWiA9IDU7XG5cbi8qKlxuICogTm8gdHJpYW5nbGVzIGFyZSBjdWxsZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfTk9ORSA9IDA7XG5cbi8qKlxuICogVHJpYW5nbGVzIGZhY2luZyBhd2F5IGZyb20gdGhlIHZpZXcgZGlyZWN0aW9uIGFyZSBjdWxsZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfQkFDSyA9IDE7XG5cbi8qKlxuICogVHJpYW5nbGVzIGZhY2luZyB0aGUgdmlldyBkaXJlY3Rpb24gYXJlIGN1bGxlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBDVUxMRkFDRV9GUk9OVCA9IDI7XG5cbi8qKlxuICogVHJpYW5nbGVzIGFyZSBjdWxsZWQgcmVnYXJkbGVzcyBvZiB0aGVpciBvcmllbnRhdGlvbiB3aXRoIHJlc3BlY3QgdG8gdGhlIHZpZXcgZGlyZWN0aW9uLiBOb3RlXG4gKiB0aGF0IHBvaW50IG9yIGxpbmUgcHJpbWl0aXZlcyBhcmUgdW5hZmZlY3RlZCBieSB0aGlzIHJlbmRlciBzdGF0ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGlnbm9yZVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBDVUxMRkFDRV9GUk9OVEFOREJBQ0sgPSAzO1xuXG4vKipcbiAqIFBvaW50IHNhbXBsZSBmaWx0ZXJpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1QgPSAwO1xuXG4vKipcbiAqIEJpbGluZWFyIGZpbHRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGSUxURVJfTElORUFSID0gMTtcblxuLyoqXG4gKiBVc2UgdGhlIG5lYXJlc3QgbmVpZ2hib3IgaW4gdGhlIG5lYXJlc3QgbWlwbWFwIGxldmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUID0gMjtcblxuLyoqXG4gKiBMaW5lYXJseSBpbnRlcnBvbGF0ZSBpbiB0aGUgbmVhcmVzdCBtaXBtYXAgbGV2ZWwuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiA9IDM7XG5cbi8qKlxuICogVXNlIHRoZSBuZWFyZXN0IG5laWdoYm9yIGFmdGVyIGxpbmVhcmx5IGludGVycG9sYXRpbmcgYmV0d2VlbiBtaXBtYXAgbGV2ZWxzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgPSA0O1xuXG4vKipcbiAqIExpbmVhcmx5IGludGVycG9sYXRlIGJvdGggdGhlIG1pcG1hcCBsZXZlbHMgYW5kIGJldHdlZW4gdGV4ZWxzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiA9IDU7XG5cbi8qKlxuICogTmV2ZXIgcGFzcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX05FVkVSID0gMDtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRlVOQ19MRVNTID0gMTtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEZVTkNfRVFVQUwgPSAyO1xuXG4vKipcbiAqIFBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRlVOQ19MRVNTRVFVQUwgPSAzO1xuXG4vKipcbiAqIFBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX0dSRUFURVIgPSA0O1xuXG4vKipcbiAqIFBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRlVOQ19OT1RFUVVBTCA9IDU7XG5cbi8qKlxuICogUGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX0dSRUFURVJFUVVBTCA9IDY7XG5cbi8qKlxuICogQWx3YXlzIHBhc3MuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRlVOQ19BTFdBWVMgPSA3O1xuXG4vKipcbiAqIDgtYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDI1NSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgSU5ERVhGT1JNQVRfVUlOVDggPSAwO1xuXG4vKipcbiAqIDE2LWJpdCB1bnNpZ25lZCB2ZXJ0ZXggaW5kaWNlcyAoMCB0byA2NSw1MzUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IElOREVYRk9STUFUX1VJTlQxNiA9IDE7XG5cbi8qKlxuICogMzItYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDQsMjk0LDk2NywyOTUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IElOREVYRk9STUFUX1VJTlQzMiA9IDI7XG5cbi8qKlxuICogOC1iaXQgYWxwaGEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQTggPSAwO1xuXG4vKipcbiAqIDgtYml0IGx1bWluYW5jZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOCA9IDE7XG5cbi8qKlxuICogOC1iaXQgbHVtaW5hbmNlIHdpdGggOC1iaXQgYWxwaGEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfTEE4ID0gMjtcblxuLyoqXG4gKiAxNi1iaXQgUkdCICg1LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA2IGZvciBncmVlbiBhbmQgNSBmb3IgYmx1ZSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCNTY1ID0gMztcblxuLyoqXG4gKiAxNi1iaXQgUkdCQSAoNS1iaXRzIGZvciByZWQgY2hhbm5lbCwgNSBmb3IgZ3JlZW4sIDUgZm9yIGJsdWUgd2l0aCAxLWJpdCBhbHBoYSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTU1NTEgPSA0O1xuXG4vKipcbiAqIDE2LWJpdCBSR0JBICg0LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA0IGZvciBncmVlbiwgNCBmb3IgYmx1ZSB3aXRoIDQtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBNCA9IDU7XG5cbi8qKlxuICogMjQtYml0IFJHQiAoOC1iaXRzIGZvciByZWQgY2hhbm5lbCwgOCBmb3IgZ3JlZW4gYW5kIDggZm9yIGJsdWUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQjggPSA2O1xuXG4vKipcbiAqIDMyLWJpdCBSR0JBICg4LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA4IGZvciBncmVlbiwgOCBmb3IgYmx1ZSB3aXRoIDgtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBOCA9IDc7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgaW4gNjQgYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgdHdvIDE2LWJpdFxuICogUkdCIDU6Njo1IGNvbG9yIHZhbHVlcyBhbmQgYSA0eDQgdHdvIGJpdCBsb29rdXAgdGFibGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfRFhUMSA9IDg7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgKGNvcnJlc3BvbmRpbmcgdG8gYSA0eDQgcGl4ZWwgYmxvY2spIGludG8gMTI4XG4gKiBiaXRzIG9mIG91dHB1dCwgY29uc2lzdGluZyBvZiA2NCBiaXRzIG9mIGFscGhhIGNoYW5uZWwgZGF0YSAoNCBiaXRzIGZvciBlYWNoIHBpeGVsKSBmb2xsb3dlZCBieVxuICogNjQgYml0cyBvZiBjb2xvciBkYXRhOyBlbmNvZGVkIHRoZSBzYW1lIHdheSBhcyBEWFQxLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RYVDMgPSA5O1xuXG4vKipcbiAqIEJsb2NrIGNvbXByZXNzZWQgZm9ybWF0IHN0b3JpbmcgMTYgaW5wdXQgcGl4ZWxzIGludG8gMTI4IGJpdHMgb2Ygb3V0cHV0LCBjb25zaXN0aW5nIG9mIDY0IGJpdHNcbiAqIG9mIGFscGhhIGNoYW5uZWwgZGF0YSAodHdvIDggYml0IGFscGhhIHZhbHVlcyBhbmQgYSA0eDQgMyBiaXQgbG9va3VwIHRhYmxlKSBmb2xsb3dlZCBieSA2NCBiaXRzXG4gKiBvZiBjb2xvciBkYXRhIChlbmNvZGVkIHRoZSBzYW1lIHdheSBhcyBEWFQxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9EWFQ1ID0gMTA7XG5cbi8qKlxuICogMTYtYml0IGZsb2F0aW5nIHBvaW50IFJHQiAoMTYtYml0IGZsb2F0IGZvciBlYWNoIHJlZCwgZ3JlZW4gYW5kIGJsdWUgY2hhbm5lbHMpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQjE2RiA9IDExO1xuXG4vKipcbiAqIDE2LWJpdCBmbG9hdGluZyBwb2ludCBSR0JBICgxNi1iaXQgZmxvYXQgZm9yIGVhY2ggcmVkLCBncmVlbiwgYmx1ZSBhbmQgYWxwaGEgY2hhbm5lbHMpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQkExNkYgPSAxMjtcblxuLyoqXG4gKiAzMi1iaXQgZmxvYXRpbmcgcG9pbnQgUkdCICgzMi1iaXQgZmxvYXQgZm9yIGVhY2ggcmVkLCBncmVlbiBhbmQgYmx1ZSBjaGFubmVscykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCMzJGID0gMTM7XG5cbi8qKlxuICogMzItYml0IGZsb2F0aW5nIHBvaW50IFJHQkEgKDMyLWJpdCBmbG9hdCBmb3IgZWFjaCByZWQsIGdyZWVuLCBibHVlIGFuZCBhbHBoYSBjaGFubmVscykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTMyRiA9IDE0O1xuXG4vKipcbiAqIDMyLWJpdCBmbG9hdGluZyBwb2ludCBzaW5nbGUgY2hhbm5lbCBmb3JtYXQgKFdlYkdMMiBvbmx5KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SMzJGID0gMTU7XG5cbi8qKlxuICogQSByZWFkYWJsZSBkZXB0aCBidWZmZXIgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RFUFRIID0gMTY7XG5cbi8qKlxuICogQSByZWFkYWJsZSBkZXB0aC9zdGVuY2lsIGJ1ZmZlciBmb3JtYXQgKFdlYkdMMiBvbmx5KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwgPSAxNztcblxuLyoqXG4gKiBBIGZsb2F0aW5nLXBvaW50IGNvbG9yLW9ubHkgZm9ybWF0IHdpdGggMTEgYml0cyBmb3IgcmVkIGFuZCBncmVlbiBjaGFubmVscyBhbmQgMTAgYml0cyBmb3IgdGhlXG4gKiBibHVlIGNoYW5uZWwgKFdlYkdMMiBvbmx5KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF8xMTExMTBGID0gMTg7XG5cbi8qKlxuICogQ29sb3Itb25seSBzUkdCIGZvcm1hdCAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1NSR0IgPSAxOTtcblxuLyoqXG4gKiBDb2xvciBzUkdCIGZvcm1hdCB3aXRoIGFkZGl0aW9uYWwgYWxwaGEgY2hhbm5lbCAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1NSR0JBID0gMjA7XG5cbi8qKlxuICogRVRDMSBjb21wcmVzc2VkIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMxID0gMjE7XG5cbi8qKlxuICogRVRDMiAoUkdCKSBjb21wcmVzc2VkIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMyX1JHQiA9IDIyO1xuXG4vKipcbiAqIEVUQzIgKFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0VUQzJfUkdCQSA9IDIzO1xuXG4vKipcbiAqIFBWUlRDICgyQlBQIFJHQikgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSA9IDI0O1xuXG4vKipcbiAqIFBWUlRDICgyQlBQIFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xID0gMjU7XG5cbi8qKlxuICogUFZSVEMgKDRCUFAgUkdCKSBjb21wcmVzc2VkIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xID0gMjY7XG5cbi8qKlxuICogUFZSVEMgKDRCUFAgUkdCQSkgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEgPSAyNztcblxuLyoqXG4gKiBBVEMgY29tcHJlc3NlZCBmb3JtYXQgd2l0aCBhbHBoYSBjaGFubmVsIGluIGJsb2NrcyBvZiA0eDQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQVNUQ180eDQgPSAyODtcblxuLyoqXG4gKiBBVEMgY29tcHJlc3NlZCBmb3JtYXQgd2l0aCBubyBhbHBoYSBjaGFubmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0FUQ19SR0IgPSAyOTtcblxuLyoqXG4gKiBBVEMgY29tcHJlc3NlZCBmb3JtYXQgd2l0aCBhbHBoYSBjaGFubmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0FUQ19SR0JBID0gMzA7XG5cbi8qKlxuICogMzItYml0IEJHUkEgKDgtYml0cyBmb3IgYmx1ZSBjaGFubmVsLCA4IGZvciBncmVlbiwgOCBmb3IgcmVkIHdpdGggOC1iaXQgYWxwaGEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAaWdub3JlXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0JHUkE4ID0gMzE7XG5cbi8qKlxuICogOC1iaXQgc2lnbmVkIGludGVnZXIgc2luZ2xlLWNoYW5uZWwgKFIpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4SSA9IDMyO1xuXG4vKipcbiAqIDgtYml0IHVuc2lnbmVkIGludGVnZXIgc2luZ2xlLWNoYW5uZWwgKFIpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4VSA9IDMzO1xuXG4vKipcbiAqIDE2LWJpdCBzaWduZWQgaW50ZWdlciBzaW5nbGUtY2hhbm5lbCAoUikgZm9ybWF0IChOb3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjE2SSA9IDM0O1xuXG4vKipcbiAqIDE2LWJpdCB1bnNpZ25lZCBpbnRlZ2VyIHNpbmdsZS1jaGFubmVsIChSKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SMTZVID0gMzU7XG5cbi8qKlxuICogMzItYml0IHNpZ25lZCBpbnRlZ2VyIHNpbmdsZS1jaGFubmVsIChSKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SMzJJID0gMzY7XG5cbi8qKlxuICogMzItYml0IHVuc2lnbmVkIGludGVnZXIgc2luZ2xlLWNoYW5uZWwgKFIpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1IzMlUgPSAzNztcblxuLyoqXG4gKiA4LWJpdCBwZXItY2hhbm5lbCBzaWduZWQgaW50ZWdlciAoUkcpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHOEkgPSAzODtcblxuLyoqXG4gKiA4LWJpdCBwZXItY2hhbm5lbCB1bnNpZ25lZCBpbnRlZ2VyIChSRykgZm9ybWF0IChOb3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkc4VSA9IDM5O1xuXG4vKipcbiAqIDE2LWJpdCBwZXItY2hhbm5lbCBzaWduZWQgaW50ZWdlciAoUkcpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHMTZJID0gNDA7XG5cbi8qKlxuICogMTYtYml0IHBlci1jaGFubmVsIHVuc2lnbmVkIGludGVnZXIgKFJHKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SRzE2VSA9IDQxO1xuXG4vKipcbiAqIDMyLWJpdCBwZXItY2hhbm5lbCBzaWduZWQgaW50ZWdlciAoUkcpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHMzJJID0gNDI7XG5cbi8qKlxuICogMzItYml0IHBlci1jaGFubmVsIHVuc2lnbmVkIGludGVnZXIgKFJHKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SRzMyVSA9IDQzO1xuXG4vKipcbiAqIDgtYml0IHBlci1jaGFubmVsIHNpZ25lZCBpbnRlZ2VyIChSR0JBKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBOEkgPSA0NDtcblxuLyoqXG4gKiA4LWJpdCBwZXItY2hhbm5lbCB1bnNpZ25lZCBpbnRlZ2VyIChSR0JBKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBOFUgPSA0NTtcblxuLyoqXG4gKiAxNi1iaXQgcGVyLWNoYW5uZWwgc2lnbmVkIGludGVnZXIgKFJHQkEpIGZvcm1hdCAoTm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQkExNkkgPSA0NjtcblxuLyoqXG4gKiAxNi1iaXQgcGVyLWNoYW5uZWwgdW5zaWduZWQgaW50ZWdlciAoUkdCQSkgZm9ybWF0IChOb3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTE2VSA9IDQ3O1xuXG4vKipcbiAqIDMyLWJpdCBwZXItY2hhbm5lbCBzaWduZWQgaW50ZWdlciAoUkdCQSkgZm9ybWF0IChOb3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTMySSA9IDQ4O1xuXG4vKipcbiAqIDMyLWJpdCBwZXItY2hhbm5lbCB1bnNpZ25lZCBpbnRlZ2VyIChSR0JBKSBmb3JtYXQgKE5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBMzJVID0gNDk7XG5cblxuLy8gbWFwIG9mIGVuZ2luZSBQSVhFTEZPUk1BVF8qKiogZW51bXMgdG8gaW5mb3JtYXRpb24gYWJvdXQgdGhlIGZvcm1hdFxuZXhwb3J0IGNvbnN0IHBpeGVsRm9ybWF0SW5mbyA9IG5ldyBNYXAoW1xuXG4gICAgLy8gdW5jb21wcmVzc2VkIGZvcm1hdHNcbiAgICBbUElYRUxGT1JNQVRfQTgsICAgICAgICAgICAgeyBuYW1lOiAnQTgnLCBzaXplOiAxIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9MOCwgICAgICAgICAgICB7IG5hbWU6ICdMOCcsIHNpemU6IDEgfV0sXG4gICAgW1BJWEVMRk9STUFUX0xBOCwgICAgICAgICAgIHsgbmFtZTogJ0xBOCcsIHNpemU6IDIgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQjU2NSwgICAgICAgIHsgbmFtZTogJ1JHQjU2NScsIHNpemU6IDIgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQkE1NTUxLCAgICAgIHsgbmFtZTogJ1JHQkE1NTUxJywgc2l6ZTogMiB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCQTQsICAgICAgICAgeyBuYW1lOiAnUkdCQTQnLCBzaXplOiAyIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0I4LCAgICAgICAgICB7IG5hbWU6ICdSR0I4Jywgc2l6ZTogNCB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCQTgsICAgICAgICAgeyBuYW1lOiAnUkdCQTgnLCBzaXplOiA0IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0IxNkYsICAgICAgICB7IG5hbWU6ICdSR0IxNkYnLCBzaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBMTZGLCAgICAgICB7IG5hbWU6ICdSR0JBMTZGJywgc2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCMzJGLCAgICAgICAgeyBuYW1lOiAnUkdCMzJGJywgc2l6ZTogMTYgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQkEzMkYsICAgICAgIHsgbmFtZTogJ1JHQkEzMkYnLCBzaXplOiAxNiB9XSxcbiAgICBbUElYRUxGT1JNQVRfUjMyRiwgICAgICAgICAgeyBuYW1lOiAnUjMyRicsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUX0RFUFRILCAgICAgICAgIHsgbmFtZTogJ0RFUFRIJywgc2l6ZTogNCB9XSxcbiAgICBbUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMLCAgeyBuYW1lOiAnREVQVEhTVEVOQ0lMJywgc2l6ZTogNCB9XSxcbiAgICBbUElYRUxGT1JNQVRfMTExMTEwRiwgICAgICAgeyBuYW1lOiAnMTExMTEwRicsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUX1NSR0IsICAgICAgICAgIHsgbmFtZTogJ1NSR0InLCBzaXplOiA0IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9TUkdCQSwgICAgICAgICB7IG5hbWU6ICdTUkdCQScsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUX0JHUkE4LCAgICAgICAgIHsgbmFtZTogJ0JHUkE4Jywgc2l6ZTogNCB9XSxcblxuICAgIC8vIGNvbXByZXNzZWQgZm9ybWF0c1xuICAgIFtQSVhFTEZPUk1BVF9EWFQxLCB7IG5hbWU6ICdEWFQxJywgYmxvY2tTaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9EWFQzLCB7IG5hbWU6ICdEWFQzJywgYmxvY2tTaXplOiAxNiB9XSxcbiAgICBbUElYRUxGT1JNQVRfRFhUNSwgeyBuYW1lOiAnRFhUNScsIGJsb2NrU2l6ZTogMTYgfV0sXG4gICAgW1BJWEVMRk9STUFUX0VUQzEsIHsgbmFtZTogJ0VUQzEnLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX0VUQzJfUkdCLCB7IG5hbWU6ICdFVEMyX1JHQicsIGJsb2NrU2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfRVRDMl9SR0JBLCB7IG5hbWU6ICdFVEMyX1JHQkEnLCBibG9ja1NpemU6IDE2IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCB7IG5hbWU6ICdQVlJUQ18yQlBQX1JHQl8xJywgYmxvY2tTaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSwgeyBuYW1lOiAnUFZSVENfMkJQUF9SR0JBXzEnLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIHsgbmFtZTogJ1BWUlRDXzRCUFBfUkdCXzEnLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCB7IG5hbWU6ICdQVlJUQ180QlBQX1JHQkFfMScsIGJsb2NrU2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfQVNUQ180eDQsIHsgbmFtZTogJ0FTVENfNHg0JywgYmxvY2tTaXplOiAxNiB9XSxcbiAgICBbUElYRUxGT1JNQVRfQVRDX1JHQiwgeyBuYW1lOiAnQVRDX1JHQicsIGJsb2NrU2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfQVRDX1JHQkEsIHsgbmFtZTogJ0FUQ19SR0JBJywgYmxvY2tTaXplOiAxNiB9XSxcblxuICAgIC8vIHVuY29tcHJlc3NlZCBpbnRlZ2VyIGZvcm1hdHMgKE5vdCBzdXBwb3J0ZWQgb24gV2ViR0wxKVxuICAgIFtQSVhFTEZPUk1BVF9SOEksICAgICAgeyBuYW1lOiAnUjhJJywgc2l6ZTogMSwgaXNJbnQ6IHRydWUgfV0sXG4gICAgW1BJWEVMRk9STUFUX1I4VSwgICAgICB7IG5hbWU6ICdSOFUnLCBzaXplOiAxLCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUjE2SSwgICAgIHsgbmFtZTogJ1IxNkknLCBzaXplOiAyLCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUjE2VSwgICAgIHsgbmFtZTogJ1IxNlUnLCBzaXplOiAyLCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUjMySSwgICAgIHsgbmFtZTogJ1IzMkknLCBzaXplOiA0LCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUjMyVSwgICAgIHsgbmFtZTogJ1IzMlUnLCBzaXplOiA0LCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkc4SSwgICAgIHsgbmFtZTogJ1JHOEknLCBzaXplOiAyLCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkc4VSwgICAgIHsgbmFtZTogJ1JHOFUnLCBzaXplOiAyLCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkcxNkksICAgIHsgbmFtZTogJ1JHMTZJJywgc2l6ZTogNCwgaXNJbnQ6IHRydWUgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHMTZVLCAgICB7IG5hbWU6ICdSRzE2VScsIHNpemU6IDQsIGlzSW50OiB0cnVlIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SRzMySSwgICAgeyBuYW1lOiAnUkczMkknLCBzaXplOiA4LCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkczMlUsICAgIHsgbmFtZTogJ1JHMzJVJywgc2l6ZTogOCwgaXNJbnQ6IHRydWUgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQkE4SSwgICB7IG5hbWU6ICdSR0JBOEknLCBzaXplOiA0LCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCQThVLCAgIHsgbmFtZTogJ1JHQkE4VScsIHNpemU6IDQsIGlzSW50OiB0cnVlIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBMTZJLCAgeyBuYW1lOiAnUkdCQTE2SScsIHNpemU6IDgsIGlzSW50OiB0cnVlIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBMTZVLCAgeyBuYW1lOiAnUkdCQTE2VScsIHNpemU6IDgsIGlzSW50OiB0cnVlIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBMzJJLCAgeyBuYW1lOiAnUkdCQTMySScsIHNpemU6IDE2LCBpc0ludDogdHJ1ZSB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCQTMyVSwgIHsgbmFtZTogJ1JHQkEzMlUnLCBzaXplOiAxNiwgaXNJbnQ6IHRydWUgfV1cbl0pO1xuXG4vLyB1cGRhdGUgdGhpcyBmdW5jdGlvbiB3aGVuIGV4cG9zaW5nIGFkZGl0aW9uYWwgY29tcHJlc3NlZCBwaXhlbCBmb3JtYXRzXG5leHBvcnQgY29uc3QgaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQgPSAoZm9ybWF0KSA9PiB7XG4gICAgcmV0dXJuIHBpeGVsRm9ybWF0SW5mby5nZXQoZm9ybWF0KT8uYmxvY2tTaXplICE9PSB1bmRlZmluZWQ7XG59O1xuXG5leHBvcnQgY29uc3QgaXNJbnRlZ2VyUGl4ZWxGb3JtYXQgPSAoZm9ybWF0KSA9PiB7XG4gICAgcmV0dXJuIHBpeGVsRm9ybWF0SW5mby5nZXQoZm9ybWF0KT8uaXNJbnQgPT09IHRydWU7XG59O1xuXG4vLyBnZXQgdGhlIHBpeGVsIGZvcm1hdCBhcnJheSB0eXBlXG5leHBvcnQgY29uc3QgZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUgPSAoZm9ybWF0KSA9PiB7XG4gICAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTMyRjpcbiAgICAgICAgICAgIHJldHVybiBGbG9hdDMyQXJyYXk7XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjMySTpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SRzMySTpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJJOlxuICAgICAgICAgICAgcmV0dXJuIEludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjMyVTpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SRzMyVTpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJVOlxuICAgICAgICAgICAgcmV0dXJuIFVpbnQzMkFycmF5O1xuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IxNkk6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkcxNkk6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTE2STpcbiAgICAgICAgICAgIHJldHVybiBJbnQxNkFycmF5O1xuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IxNlU6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkcxNlU6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTE2VTpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0I1NjU6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTU1NTE6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTQ6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNkY6XG4gICAgICAgICAgICByZXR1cm4gVWludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhJOlxuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHOEk6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQThJOlxuICAgICAgICAgICAgcmV0dXJuIEludDhBcnJheTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBVaW50OEFycmF5O1xuICAgIH1cbn07XG5cbi8qKlxuICogTGlzdCBvZiBkaXN0aW5jdCBwb2ludHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1BPSU5UUyA9IDA7XG5cbi8qKlxuICogRGlzY3JldGUgbGlzdCBvZiBsaW5lIHNlZ21lbnRzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBSSU1JVElWRV9MSU5FUyA9IDE7XG5cbi8qKlxuICogTGlzdCBvZiBwb2ludHMgdGhhdCBhcmUgbGlua2VkIHNlcXVlbnRpYWxseSBieSBsaW5lIHNlZ21lbnRzLCB3aXRoIGEgY2xvc2luZyBsaW5lIHNlZ21lbnRcbiAqIGJldHdlZW4gdGhlIGxhc3QgYW5kIGZpcnN0IHBvaW50cy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfTElORUxPT1AgPSAyO1xuXG4vKipcbiAqIExpc3Qgb2YgcG9pbnRzIHRoYXQgYXJlIGxpbmtlZCBzZXF1ZW50aWFsbHkgYnkgbGluZSBzZWdtZW50cy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfTElORVNUUklQID0gMztcblxuLyoqXG4gKiBEaXNjcmV0ZSBsaXN0IG9mIHRyaWFuZ2xlcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfVFJJQU5HTEVTID0gNDtcblxuLyoqXG4gKiBDb25uZWN0ZWQgc3RyaXAgb2YgdHJpYW5nbGVzIHdoZXJlIGEgc3BlY2lmaWVkIHZlcnRleCBmb3JtcyBhIHRyaWFuZ2xlIHVzaW5nIHRoZSBwcmV2aW91cyB0d28uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1RSSVNUUklQID0gNTtcblxuLyoqXG4gKiBDb25uZWN0ZWQgZmFuIG9mIHRyaWFuZ2xlcyB3aGVyZSB0aGUgZmlyc3QgdmVydGV4IGZvcm1zIHRyaWFuZ2xlcyB3aXRoIHRoZSBmb2xsb3dpbmcgcGFpcnMgb2YgdmVydGljZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1RSSUZBTiA9IDY7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgcG9zaXRpb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfUE9TSVRJT04gPSBcIlBPU0lUSU9OXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgbm9ybWFsLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX05PUk1BTCA9IFwiTk9STUFMXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGFuZ2VudC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19UQU5HRU5UID0gXCJUQU5HRU5UXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIHNraW4gYmxlbmQgd2VpZ2h0cy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19CTEVORFdFSUdIVCA9IFwiQkxFTkRXRUlHSFRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgc2tpbiBibGVuZCBpbmRpY2VzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0JMRU5ESU5ESUNFUyA9IFwiQkxFTkRJTkRJQ0VTXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgY29sb3IuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQ09MT1IgPSBcIkNPTE9SXCI7XG5cbi8vIHByaXZhdGUgc2VtYW50aWMgdXNlZCBmb3IgcHJvZ3JhbW1hdGljIGNvbnN0cnVjdGlvbiBvZiBpbmRpdmlkdWFsIHRleGNvb3JkIHNlbWFudGljc1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEID0gXCJURVhDT09SRFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDApLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMCA9IFwiVEVYQ09PUkQwXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgMSkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfVEVYQ09PUkQxID0gXCJURVhDT09SRDFcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgYSB0ZXh0dXJlIGNvb3JkaW5hdGUgKHNldCAyKS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDIgPSBcIlRFWENPT1JEMlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDMpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMyA9IFwiVEVYQ09PUkQzXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNCkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfVEVYQ09PUkQ0ID0gXCJURVhDT09SRDRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgYSB0ZXh0dXJlIGNvb3JkaW5hdGUgKHNldCA1KS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDUgPSBcIlRFWENPT1JENVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDYpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JENiA9IFwiVEVYQ09PUkQ2XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNykuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfVEVYQ09PUkQ3ID0gXCJURVhDT09SRDdcIjtcblxuLy8gcHJpdmF0ZSBzZW1hbnRpYyB1c2VkIGZvciBwcm9ncmFtbWF0aWMgY29uc3RydWN0aW9uIG9mIGluZGl2aWR1YWwgYXR0ciBzZW1hbnRpY3NcbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSID0gXCJBVFRSXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIwID0gXCJBVFRSMFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMSA9IFwiQVRUUjFcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjIgPSBcIkFUVFIyXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIzID0gXCJBVFRSM1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSNCA9IFwiQVRUUjRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjUgPSBcIkFUVFI1XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI2ID0gXCJBVFRSNlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSNyA9IFwiQVRUUjdcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjggPSBcIkFUVFI4XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI5ID0gXCJBVFRSOVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTAgPSBcIkFUVFIxMFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTEgPSBcIkFUVFIxMVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTIgPSBcIkFUVFIxMlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTMgPSBcIkFUVFIxM1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTQgPSBcIkFUVFIxNFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTUgPSBcIkFUVFIxNVwiO1xuXG5leHBvcnQgY29uc3QgU0hBREVSVEFHX01BVEVSSUFMID0gMTtcblxuLyoqXG4gKiBEb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9LRUVQID0gMDtcblxuLyoqXG4gKiBTZXQgdmFsdWUgdG8gemVyby5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfWkVSTyA9IDE7XG5cbi8qKlxuICogUmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgU3RlbmNpbFBhcmFtZXRlcnN9KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfUkVQTEFDRSA9IDI7XG5cbi8qKlxuICogSW5jcmVtZW50IHRoZSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfSU5DUkVNRU5UID0gMztcblxuLyoqXG4gKiBJbmNyZW1lbnQgdGhlIHZhbHVlIGJ1dCB3cmFwIGl0IHRvIHplcm8gd2hlbiBpdCdzIGxhcmdlciB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQID0gNDtcblxuLyoqXG4gKiBEZWNyZW1lbnQgdGhlIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9ERUNSRU1FTlQgPSA1O1xuXG4vKipcbiAqIERlY3JlbWVudCB0aGUgdmFsdWUgYnV0IHdyYXAgaXQgdG8gYSBtYXhpbXVtIHJlcHJlc2VudGFibGUgdmFsdWUgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgMC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUCA9IDY7XG5cbi8qKlxuICogSW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9JTlZFUlQgPSA3O1xuXG4vKipcbiAqIFRoZSB0ZXh0dXJlIGlzIG5vdCBpbiBhIGxvY2tlZCBzdGF0ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRUxPQ0tfTk9ORSA9IDA7XG5cbi8qKlxuICogUmVhZCBvbmx5LiBBbnkgY2hhbmdlcyB0byB0aGUgbG9ja2VkIG1pcCBsZXZlbCdzIHBpeGVscyB3aWxsIG5vdCB1cGRhdGUgdGhlIHRleHR1cmUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRUxPQ0tfUkVBRCA9IDE7XG5cbi8qKlxuICogV3JpdGUgb25seS4gVGhlIGNvbnRlbnRzIG9mIHRoZSBzcGVjaWZpZWQgbWlwIGxldmVsIHdpbGwgYmUgZW50aXJlbHkgcmVwbGFjZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRUxPQ0tfV1JJVEUgPSAyO1xuXG4vKipcbiAqIFRleHR1cmUgaXMgYSBkZWZhdWx0IHR5cGUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVRZUEVfREVGQVVMVCA9ICdkZWZhdWx0JztcblxuLyoqXG4gKiBUZXh0dXJlIHN0b3JlcyBoaWdoIGR5bmFtaWMgcmFuZ2UgZGF0YSBpbiBSR0JNIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9SR0JNID0gJ3JnYm0nO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIGhpZ2ggZHluYW1pYyByYW5nZSBkYXRhIGluIFJHQkUgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVUWVBFX1JHQkUgPSAncmdiZSc7XG5cbi8qKlxuICogVGV4dHVyZSBzdG9yZXMgaGlnaCBkeW5hbWljIHJhbmdlIGRhdGEgaW4gUkdCUCBlbmNvZGluZy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9SR0JQID0gJ3JnYnAnO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIG5vcm1hbG1hcCBkYXRhIHN3aXp6bGVkIGluIEdHR1IgZm9ybWF0LiBUaGlzIGlzIHVzZWQgZm9yIHRhbmdlbnQgc3BhY2Ugbm9ybWFsXG4gKiBtYXBzLiBUaGUgUiBjb21wb25lbnQgaXMgc3RvcmVkIGluIGFscGhhIGFuZCBHIGlzIHN0b3JlZCBpbiBSR0IuIFRoaXMgcGFja2luZyBjYW4gcmVzdWx0IGluXG4gKiBoaWdoZXIgcXVhbGl0eSB3aGVuIHRoZSB0ZXh0dXJlIGRhdGEgaXMgY29tcHJlc3NlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUiA9ICdzd2l6emxlR0dHUic7XG5cbmV4cG9ydCBjb25zdCBURVhISU5UX05PTkUgPSAwO1xuZXhwb3J0IGNvbnN0IFRFWEhJTlRfU0hBRE9XTUFQID0gMTtcbmV4cG9ydCBjb25zdCBURVhISU5UX0FTU0VUID0gMjtcbmV4cG9ydCBjb25zdCBURVhISU5UX0xJR0hUTUFQID0gMztcblxuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMUQgPSAnMWQnO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMkQgPSAnMmQnO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVkgPSAnMmQtYXJyYXknO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fQ1VCRSA9ICdjdWJlJztcbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OX0NVQkVfQVJSQVkgPSAnY3ViZS1hcnJheSc7XG5leHBvcnQgY29uc3QgVEVYVFVSRURJTUVOU0lPTl8zRCA9ICczZCc7XG5cbmV4cG9ydCBjb25zdCBTQU1QTEVUWVBFX0ZMT0FUID0gMDtcbmV4cG9ydCBjb25zdCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCA9IDE7XG5leHBvcnQgY29uc3QgU0FNUExFVFlQRV9ERVBUSCA9IDI7XG5leHBvcnQgY29uc3QgU0FNUExFVFlQRV9JTlQgPSAzO1xuZXhwb3J0IGNvbnN0IFNBTVBMRVRZUEVfVUlOVCA9IDQ7XG5cbi8qKlxuICogVGV4dHVyZSBkYXRhIGlzIG5vdCBzdG9yZWQgYSBzcGVjaWZpYyBwcm9qZWN0aW9uIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFUFJPSkVDVElPTl9OT05FID0gXCJub25lXCI7XG5cbi8qKlxuICogVGV4dHVyZSBkYXRhIGlzIHN0b3JlZCBpbiBjdWJlbWFwIHByb2plY3Rpb24gZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUgPSBcImN1YmVcIjtcblxuLyoqXG4gKiBUZXh0dXJlIGRhdGEgaXMgc3RvcmVkIGluIGVxdWlyZWN0YW5ndWxhciBwcm9qZWN0aW9uIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFUFJPSkVDVElPTl9FUVVJUkVDVCA9IFwiZXF1aXJlY3RcIjtcblxuLyoqXG4gKiBUZXh0dXJlIGRhdGEgaXMgc3RvcmVkIGluIG9jdGFoZWRyYWwgcHJvamVjdGlvbiBmb3JtYXQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTCA9IFwib2N0YWhlZHJhbFwiO1xuXG4vKipcbiAqIFNoYWRlciBzb3VyY2UgY29kZSB1c2VzIEdMU0wgbGFuZ3VhZ2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSTEFOR1VBR0VfR0xTTCA9ICdnbHNsJztcblxuLyoqXG4gKiBTaGFkZXIgc291cmNlIGNvZGUgdXNlcyBXR1NMIGxhbmd1YWdlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUkxBTkdVQUdFX1dHU0wgPSAnd2dzbCc7XG5cbi8qKlxuICogU2lnbmVkIGJ5dGUgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX0lOVDggPSAwO1xuXG4vKipcbiAqIFVuc2lnbmVkIGJ5dGUgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX1VJTlQ4ID0gMTtcblxuLyoqXG4gKiBTaWduZWQgc2hvcnQgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX0lOVDE2ID0gMjtcblxuLyoqXG4gKiBVbnNpZ25lZCBzaG9ydCB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfVUlOVDE2ID0gMztcblxuLyoqXG4gKiBTaWduZWQgaW50ZWdlciB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfSU5UMzIgPSA0O1xuXG4vKipcbiAqIFVuc2lnbmVkIGludGVnZXIgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX1VJTlQzMiA9IDU7XG5cbi8qKlxuICogRmxvYXRpbmcgcG9pbnQgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX0ZMT0FUMzIgPSA2O1xuXG4vKipcbiAqIDE2LWJpdCBmbG9hdGluZyBwb2ludCB2ZXJ0ZXggZWxlbWVudCB0eXBlIChub3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVFlQRV9GTE9BVDE2ID0gNztcblxuLy8gVW5pZm9ybSB0eXBlc1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JPT0wgPSAwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lOVCA9IDE7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfRkxPQVQgPSAyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzIgPSAzO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzMgPSA0O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzQgPSA1O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUMyID0gNjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JVkVDMyA9IDc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfSVZFQzQgPSA4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JWRUMyID0gOTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9CVkVDMyA9IDEwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JWRUM0ID0gMTE7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfTUFUMiA9IDEyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX01BVDMgPSAxMztcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9NQVQ0ID0gMTQ7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRTJEID0gMTU7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRUNVQkUgPSAxNjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZID0gMTc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyA9IDE4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyA9IDE5O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkUzRCA9IDIwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzJBUlJBWSA9IDIxO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSA9IDIyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzRBUlJBWSA9IDIzO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX01BVDRBUlJBWSA9IDI0O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9BUlJBWSA9IDI1O1xuXG4vLyBVbnNpZ25lZCB1bmlmb3JtIHR5cGVzXG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVUlOVCA9IDI2O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1VWRUMyID0gMjc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVVZFQzMgPSAyODtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9VVkVDNCA9IDI5O1xuXG4vLyBJbnRlZ2VyIHVuaWZvcm0gYXJyYXkgdHlwZXNcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JTlRBUlJBWSA9IDMwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1VJTlRBUlJBWSA9IDMxO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JPT0xBUlJBWSA9IDMyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUMyQVJSQVkgPSAzMztcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9VVkVDMkFSUkFZID0gMzQ7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfQlZFQzJBUlJBWSA9IDM1O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUMzQVJSQVkgPSAzNjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9VVkVDM0FSUkFZID0gMzc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfQlZFQzNBUlJBWSA9IDM4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUM0QVJSQVkgPSAzOTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9VVkVDNEFSUkFZID0gNDA7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfQlZFQzRBUlJBWSA9IDQxO1xuXG4vLyBJbnRlZ2VyIHRleHR1cmUgdHlwZXNcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JVEVYVFVSRTJEID0gNDI7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVVRFWFRVUkUyRCA9IDQzO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lURVhUVVJFQ1VCRSA9IDQ0O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1VURVhUVVJFQ1VCRSA9IDQ1O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lURVhUVVJFM0QgPSA0NjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9VVEVYVFVSRTNEID0gNDc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfSVRFWFRVUkUyRF9BUlJBWSA9IDQ4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1VURVhUVVJFMkRfQVJSQVkgPSA0OTtcblxuZXhwb3J0IGNvbnN0IHVuaWZvcm1UeXBlVG9OYW1lID0gW1xuICAgIC8vIFVuaWZvcm1zXG4gICAgJ2Jvb2wnLFxuICAgICdpbnQnLFxuICAgICdmbG9hdCcsXG4gICAgJ3ZlYzInLFxuICAgICd2ZWMzJyxcbiAgICAndmVjNCcsXG4gICAgJ2l2ZWMyJyxcbiAgICAnaXZlYzMnLFxuICAgICdpdmVjNCcsXG4gICAgJ2J2ZWMyJyxcbiAgICAnYnZlYzMnLFxuICAgICdidmVjNCcsXG4gICAgJ21hdDInLFxuICAgICdtYXQzJyxcbiAgICAnbWF0NCcsXG4gICAgJ3NhbXBsZXIyRCcsXG4gICAgJ3NhbXBsZXJDdWJlJyxcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0ZMT0FUQVJSQVlcbiAgICAnc2FtcGxlcjJEU2hhZG93JyxcbiAgICAnc2FtcGxlckN1YmVTaGFkb3cnLFxuICAgICdzYW1wbGVyM0QnLFxuICAgICcnLCAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfVkVDMkFSUkFZXG4gICAgJycsIC8vIG5vdCBkaXJlY3RseSBoYW5kbGVkOiBVTklGT1JNVFlQRV9WRUMzQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1ZFQzRBUlJBWVxuICAgICcnLCAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfTUFUNEFSUkFZXG4gICAgJ3NhbXBsZXIyREFycmF5JyxcbiAgICAndWludCcsXG4gICAgJ3V2ZWMyJyxcbiAgICAndXZlYzMnLFxuICAgICd1dmVjNCcsXG4gICAgJycsIC8vIG5vdCBkaXJlY3RseSBoYW5kbGVkOiBVTklGT1JNVFlQRV9JTlRBUlJBWVxuICAgICcnLCAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfVUlOVEFSUkFZXG4gICAgJycsIC8vIG5vdCBkaXJlY3RseSBoYW5kbGVkOiBVTklGT1JNVFlQRV9CT09MQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0lWRUMyQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1VWRUMyQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0JWRUMyQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0lWRUMzQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1VWRUMzQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0JWRUMzQVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0lWRUM0QVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1VWRUM0QVJSQVlcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0JWRUM0QVJSQVlcbiAgICAnaXNhbXBsZXIyRCcsXG4gICAgJ3VzYW1wbGVyMkQnLFxuICAgICdpc2FtcGxlckN1YmUnLFxuICAgICd1c2FtcGxlckN1YmUnLFxuICAgICdpc2FtcGxlcjNEJyxcbiAgICAndXNhbXBsZXIzRCcsXG4gICAgJ2lzYW1wbGVyMkRBcnJheScsXG4gICAgJ3VzYW1wbGVyMkRBcnJheSdcbl07XG5cbi8vIE1hcCB0byBjb252ZXJ0IHVuaWZvcm0gdHlwZSB0byBzdG9yYWdlIHR5cGUsIHVzZWQgaW4gdW5pZm9ybS1idWZmZXIuanNcbmV4cG9ydCBjb25zdCB1bmlmb3JtVHlwZVRvU3RvcmFnZSA9IG5ldyBVaW50OEFycmF5KFtcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfQk9PTFxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9JTlRcbiAgICBUWVBFX0ZMT0FUMzIsICAgLy8gVU5JRk9STVRZUEVfRkxPQVRcbiAgICBUWVBFX0ZMT0FUMzIsICAgLy8gVU5JRk9STVRZUEVfVkVDMlxuICAgIFRZUEVfRkxPQVQzMiwgICAvLyBVTklGT1JNVFlQRV9WRUMzXG4gICAgVFlQRV9GTE9BVDMyLCAgIC8vIFVOSUZPUk1UWVBFX1ZFQzRcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfSVZFQzJcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfSVZFQzNcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfSVZFQzRcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfQlZFQzJcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfQlZFQzNcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfQlZFQzRcbiAgICBUWVBFX0ZMT0FUMzIsICAgLy8gVU5JRk9STVRZUEVfTUFUMlxuICAgIFRZUEVfRkxPQVQzMiwgICAvLyBVTklGT1JNVFlQRV9NQVQzXG4gICAgVFlQRV9GTE9BVDMyLCAgIC8vIFVOSUZPUk1UWVBFX01BVDRcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfVEVYVFVSRTJEXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFXG4gICAgVFlQRV9GTE9BVDMyLCAgIC8vIFVOSUZPUk1UWVBFX0ZMT0FUQVJSQVlcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPV1xuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1dcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfVEVYVFVSRTNEXG4gICAgVFlQRV9GTE9BVDMyLCAgIC8vIFVOSUZPUk1UWVBFX1ZFQzJBUlJBWVxuICAgIFRZUEVfRkxPQVQzMiwgICAvLyBVTklGT1JNVFlQRV9WRUMzQVJSQVlcbiAgICBUWVBFX0ZMT0FUMzIsICAgLy8gVU5JRk9STVRZUEVfVkVDNEFSUkFZXG4gICAgVFlQRV9GTE9BVDMyLCAgIC8vIFVOSUZPUk1UWVBFX01BVDRBUlJBWVxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9URVhUVVJFMkRfQVJSQVlcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVUlOVFxuICAgIFRZUEVfVUlOVDMyLCAgICAvLyBVTklGT1JNVFlQRV9VVkVDMlxuICAgIFRZUEVfVUlOVDMyLCAgICAvLyBVTklGT1JNVFlQRV9VVkVDM1xuICAgIFRZUEVfVUlOVDMyLCAgICAvLyBVTklGT1JNVFlQRV9VVkVDNFxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9JTlRBUlJBWVxuICAgIFRZUEVfVUlOVDMyLCAgICAvLyBVTklGT1JNVFlQRV9VSU5UQVJSQVlcbiAgICBUWVBFX0lOVDMyLCAgICAgLy8gVU5JRk9STVRZUEVfQk9PTEFSUkFZXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX0lWRUMyQVJSQVlcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVZFQzJBUlJBWVxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9CVkVDMkFSUkFZXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX0lWRUMzQVJSQVlcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVZFQzNBUlJBWVxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9CVkVDM0FSUkFZXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX0lWRUM0QVJSQVlcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVZFQzRBUlJBWVxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9CVkVDNEFSUkFZXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX0lURVhUVVJFMkRcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVRFWFRVUkUyRFxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9JVEVYVFVSRUNVQkVcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVRFWFRVUkVDVUJFXG4gICAgVFlQRV9JTlQzMiwgICAgIC8vIFVOSUZPUk1UWVBFX0lURVhUVVJFM0RcbiAgICBUWVBFX1VJTlQzMiwgICAgLy8gVU5JRk9STVRZUEVfVVRFWFRVUkUzRFxuICAgIFRZUEVfSU5UMzIsICAgICAvLyBVTklGT1JNVFlQRV9JVEVYVFVSRTJEX0FSUkFZXG4gICAgVFlQRV9VSU5UMzIgICAgIC8vIFVOSUZPUk1UWVBFX1VURVhUVVJFMkRfQVJSQVlcbl0pO1xuXG4vKipcbiAqIEEgV2ViR0wgMSBkZXZpY2UgdHlwZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBERVZJQ0VUWVBFX1dFQkdMMSA9ICd3ZWJnbDEnO1xuXG4vKipcbiAqIEEgV2ViR0wgMiBkZXZpY2UgdHlwZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBERVZJQ0VUWVBFX1dFQkdMMiA9ICd3ZWJnbDInO1xuXG4vKipcbiAqIEEgV2ViR1BVIGRldmljZSB0eXBlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IERFVklDRVRZUEVfV0VCR1BVID0gJ3dlYmdwdSc7XG5cbi8qKlxuICogQSBOdWxsIGRldmljZSB0eXBlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IERFVklDRVRZUEVfTlVMTCA9ICdudWxsJztcblxuLy8gKGJpdC1mbGFncykgc2hhZGVyIHN0YWdlcyBmb3IgcmVzb3VyY2UgdmlzaWJpbGl0eSBvbiB0aGUgR1BVXG5leHBvcnQgY29uc3QgU0hBREVSU1RBR0VfVkVSVEVYID0gMTtcbmV4cG9ydCBjb25zdCBTSEFERVJTVEFHRV9GUkFHTUVOVCA9IDI7XG5leHBvcnQgY29uc3QgU0hBREVSU1RBR0VfQ09NUFVURSA9IDQ7XG5cbi8vIGluZGljZXMgb2YgY29tbW9ubHkgdXNlZCBiaW5kIGdyb3Vwc1xuLy8gc29ydGVkIGluIGEgd2F5IHRoYXQgYW55IHRyYWlsaW5nIGJpbmQgZ3JvdXBzIGNhbiBiZSB1bnVzZWQgaW4gYW55IHJlbmRlciBwYXNzXG5leHBvcnQgY29uc3QgQklOREdST1VQX01FU0ggPSAwO1xuZXhwb3J0IGNvbnN0IEJJTkRHUk9VUF9WSUVXID0gMTtcblxuLy8gbmFtZXMgb2YgYmluZCBncm91cHNcbmV4cG9ydCBjb25zdCBiaW5kR3JvdXBOYW1lcyA9IFsnbWVzaCcsICd2aWV3J107XG5cbi8vIG5hbWUgb2YgdGhlIGRlZmF1bHQgdW5pZm9ybSBidWZmZXIgc2xvdCBpbiBhIGJpbmQgZ3JvdXBcbmV4cG9ydCBjb25zdCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSA9ICdkZWZhdWx0JztcblxuLy8gbWFwIG9mIGVuZ2luZSBUWVBFXyoqKiBlbnVtcyB0byB0aGVpciBjb3JyZXNwb25kaW5nIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycyBhbmQgYnl0ZSBzaXplc1xuZXhwb3J0IGNvbnN0IHR5cGVkQXJyYXlUeXBlcyA9IFtJbnQ4QXJyYXksIFVpbnQ4QXJyYXksIEludDE2QXJyYXksIFVpbnQxNkFycmF5LCBJbnQzMkFycmF5LCBVaW50MzJBcnJheSwgRmxvYXQzMkFycmF5LCBVaW50MTZBcnJheV07XG5leHBvcnQgY29uc3QgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUgPSBbMSwgMSwgMiwgMiwgNCwgNCwgNCwgMl07XG5leHBvcnQgY29uc3QgdmVydGV4VHlwZXNOYW1lcyA9IFsnSU5UOCcsICdVSU5UOCcsICdJTlQxNicsICdVSU5UMTYnLCAnSU5UMzInLCAnVUlOVDMyJywgJ0ZMT0FUMzInLCAnRkxPQVQxNiddO1xuXG4vLyBtYXAgb2YgdHlwZWQgYXJyYXkgdG8gZW5naW5lIFRZUEVfKioqXG5leHBvcnQgY29uc3QgdHlwZWRBcnJheVRvVHlwZSA9IHtcbiAgICBcIkludDhBcnJheVwiOiBUWVBFX0lOVDgsXG4gICAgXCJVaW50OEFycmF5XCI6IFRZUEVfVUlOVDgsXG4gICAgXCJJbnQxNkFycmF5XCI6IFRZUEVfSU5UMTYsXG4gICAgXCJVaW50MTZBcnJheVwiOiBUWVBFX1VJTlQxNixcbiAgICBcIkludDMyQXJyYXlcIjogVFlQRV9JTlQzMixcbiAgICBcIlVpbnQzMkFycmF5XCI6IFRZUEVfVUlOVDMyLFxuICAgIFwiRmxvYXQzMkFycmF5XCI6IFRZUEVfRkxPQVQzMlxufTtcblxuLy8gbWFwIG9mIGVuZ2luZSBJTkRFWEZPUk1BVF8qKiogdG8gdGhlaXIgY29ycmVzcG9uZGluZyB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMgYW5kIGJ5dGUgc2l6ZXNcbmV4cG9ydCBjb25zdCB0eXBlZEFycmF5SW5kZXhGb3JtYXRzID0gW1VpbnQ4QXJyYXksIFVpbnQxNkFycmF5LCBVaW50MzJBcnJheV07XG5leHBvcnQgY29uc3QgdHlwZWRBcnJheUluZGV4Rm9ybWF0c0J5dGVTaXplID0gWzEsIDIsIDRdO1xuXG4vKipcbiAqIE1hcCBvZiBlbmdpbmUgc2VtYW50aWNzIGludG8gbG9jYXRpb24gb24gZGV2aWNlIGluIHJhbmdlIDAuLjE1IChub3RlIC0gc2VtYW50aWNzIG1hcHBpbmcgdG8gdGhlXG4gKiBzYW1lIGxvY2F0aW9uIGNhbm5vdCBiZSB1c2VkIGF0IHRoZSBzYW1lIHRpbWUpIG9yZ2FuaXplZCBpbiBhIHdheSB0aGF0IEFUVFIwLUFUVFI3IGRvIG5vdFxuICogb3ZlcmxhcCB3aXRoIGNvbW1vbiBpbXBvcnRhbnQgc2VtYW50aWNzLlxuICpcbiAqIEB0eXBlIHtvYmplY3R9XG4gKiBAaWdub3JlXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IHNlbWFudGljVG9Mb2NhdGlvbiA9IHt9O1xuXG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfUE9TSVRJT05dID0gMDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19OT1JNQUxdID0gMTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19CTEVORFdFSUdIVF0gPSAyO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0JMRU5ESU5ESUNFU10gPSAzO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0NPTE9SXSA9IDQ7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQwXSA9IDU7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQxXSA9IDY7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQyXSA9IDc7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQzXSA9IDg7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQ0XSA9IDk7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQ1XSA9IDEwO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX1RFWENPT1JENl0gPSAxMTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDddID0gMTI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEFOR0VOVF0gPSAxMztcblxuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIwXSA9IDA7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjFdID0gMTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMl0gPSAyO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIzXSA9IDM7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjRdID0gNDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSNV0gPSA1O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI2XSA9IDY7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjddID0gNztcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSOF0gPSA4O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI5XSA9IDk7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjEwXSA9IDEwO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxMV0gPSAxMTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTJdID0gMTI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjEzXSA9IDEzO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxNF0gPSAxNDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTVdID0gMTU7XG5cbi8qKlxuICogQ2h1bmsgQVBJIHZlcnNpb25zXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81MSA9ICcxLjUxJztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU1ID0gJzEuNTUnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNTYgPSAnMS41Nic7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81NyA9ICcxLjU3JztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU4ID0gJzEuNTgnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNjAgPSAnMS42MCc7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV82MiA9ICcxLjYyJztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzY1ID0gJzEuNjUnO1xuIl0sIm5hbWVzIjpbIkFERFJFU1NfUkVQRUFUIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJCTEVORE1PREVfWkVSTyIsIkJMRU5ETU9ERV9PTkUiLCJCTEVORE1PREVfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IiLCJCTEVORE1PREVfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IiLCJCTEVORE1PREVfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBIiwiQkxFTkRNT0RFX0NPTlNUQU5UIiwiQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVCIsIkJMRU5ERVFVQVRJT05fQUREIiwiQkxFTkRFUVVBVElPTl9TVUJUUkFDVCIsIkJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVCIsIkJMRU5ERVFVQVRJT05fTUlOIiwiQkxFTkRFUVVBVElPTl9NQVgiLCJCVUZGRVJfU1RBVElDIiwiQlVGRkVSX0RZTkFNSUMiLCJCVUZGRVJfU1RSRUFNIiwiQlVGRkVSX0dQVURZTkFNSUMiLCJDTEVBUkZMQUdfQ09MT1IiLCJDTEVBUkZMQUdfREVQVEgiLCJDTEVBUkZMQUdfU1RFTkNJTCIsIkNVQkVGQUNFX1BPU1giLCJDVUJFRkFDRV9ORUdYIiwiQ1VCRUZBQ0VfUE9TWSIsIkNVQkVGQUNFX05FR1kiLCJDVUJFRkFDRV9QT1NaIiwiQ1VCRUZBQ0VfTkVHWiIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9GUk9OVEFOREJBQ0siLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiRlVOQ19ORVZFUiIsIkZVTkNfTEVTUyIsIkZVTkNfRVFVQUwiLCJGVU5DX0xFU1NFUVVBTCIsIkZVTkNfR1JFQVRFUiIsIkZVTkNfTk9URVFVQUwiLCJGVU5DX0dSRUFURVJFUVVBTCIsIkZVTkNfQUxXQVlTIiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJQSVhFTEZPUk1BVF9BOCIsIlBJWEVMRk9STUFUX0w4IiwiUElYRUxGT1JNQVRfTEE4IiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlBJWEVMRk9STUFUX1JHQjgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9EWFQzIiwiUElYRUxGT1JNQVRfRFhUNSIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0IzMkYiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfUjMyRiIsIlBJWEVMRk9STUFUX0RFUFRIIiwiUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMIiwiUElYRUxGT1JNQVRfMTExMTEwRiIsIlBJWEVMRk9STUFUX1NSR0IiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlBJWEVMRk9STUFUX0VUQzEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX0FTVENfNHg0IiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwiUElYRUxGT1JNQVRfQkdSQTgiLCJQSVhFTEZPUk1BVF9SOEkiLCJQSVhFTEZPUk1BVF9SOFUiLCJQSVhFTEZPUk1BVF9SMTZJIiwiUElYRUxGT1JNQVRfUjE2VSIsIlBJWEVMRk9STUFUX1IzMkkiLCJQSVhFTEZPUk1BVF9SMzJVIiwiUElYRUxGT1JNQVRfUkc4SSIsIlBJWEVMRk9STUFUX1JHOFUiLCJQSVhFTEZPUk1BVF9SRzE2SSIsIlBJWEVMRk9STUFUX1JHMTZVIiwiUElYRUxGT1JNQVRfUkczMkkiLCJQSVhFTEZPUk1BVF9SRzMyVSIsIlBJWEVMRk9STUFUX1JHQkE4SSIsIlBJWEVMRk9STUFUX1JHQkE4VSIsIlBJWEVMRk9STUFUX1JHQkExNkkiLCJQSVhFTEZPUk1BVF9SR0JBMTZVIiwiUElYRUxGT1JNQVRfUkdCQTMySSIsIlBJWEVMRk9STUFUX1JHQkEzMlUiLCJwaXhlbEZvcm1hdEluZm8iLCJNYXAiLCJuYW1lIiwic2l6ZSIsImJsb2NrU2l6ZSIsImlzSW50IiwiaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQiLCJmb3JtYXQiLCJfcGl4ZWxGb3JtYXRJbmZvJGdldCIsImdldCIsInVuZGVmaW5lZCIsImlzSW50ZWdlclBpeGVsRm9ybWF0IiwiX3BpeGVsRm9ybWF0SW5mbyRnZXQyIiwiZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUiLCJGbG9hdDMyQXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQ09MT1IiLCJTRU1BTlRJQ19URVhDT09SRCIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX1RFWENPT1JEMSIsIlNFTUFOVElDX1RFWENPT1JEMiIsIlNFTUFOVElDX1RFWENPT1JEMyIsIlNFTUFOVElDX1RFWENPT1JENCIsIlNFTUFOVElDX1RFWENPT1JENSIsIlNFTUFOVElDX1RFWENPT1JENiIsIlNFTUFOVElDX1RFWENPT1JENyIsIlNFTUFOVElDX0FUVFIiLCJTRU1BTlRJQ19BVFRSMCIsIlNFTUFOVElDX0FUVFIxIiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlNFTUFOVElDX0FUVFI0IiwiU0VNQU5USUNfQVRUUjUiLCJTRU1BTlRJQ19BVFRSNiIsIlNFTUFOVElDX0FUVFI3IiwiU0VNQU5USUNfQVRUUjgiLCJTRU1BTlRJQ19BVFRSOSIsIlNFTUFOVElDX0FUVFIxMCIsIlNFTUFOVElDX0FUVFIxMSIsIlNFTUFOVElDX0FUVFIxMiIsIlNFTUFOVElDX0FUVFIxMyIsIlNFTUFOVElDX0FUVFIxNCIsIlNFTUFOVElDX0FUVFIxNSIsIlNIQURFUlRBR19NQVRFUklBTCIsIlNURU5DSUxPUF9LRUVQIiwiU1RFTkNJTE9QX1pFUk8iLCJTVEVOQ0lMT1BfUkVQTEFDRSIsIlNURU5DSUxPUF9JTkNSRU1FTlQiLCJTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUCIsIlNURU5DSUxPUF9ERUNSRU1FTlQiLCJTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUCIsIlNURU5DSUxPUF9JTlZFUlQiLCJURVhUVVJFTE9DS19OT05FIiwiVEVYVFVSRUxPQ0tfUkVBRCIsIlRFWFRVUkVMT0NLX1dSSVRFIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsIlRFWFRVUkVUWVBFX1JHQk0iLCJURVhUVVJFVFlQRV9SR0JFIiwiVEVYVFVSRVRZUEVfUkdCUCIsIlRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIiwiVEVYSElOVF9OT05FIiwiVEVYSElOVF9TSEFET1dNQVAiLCJURVhISU5UX0FTU0VUIiwiVEVYSElOVF9MSUdIVE1BUCIsIlRFWFRVUkVESU1FTlNJT05fMUQiLCJURVhUVVJFRElNRU5TSU9OXzJEIiwiVEVYVFVSRURJTUVOU0lPTl8yRF9BUlJBWSIsIlRFWFRVUkVESU1FTlNJT05fQ1VCRSIsIlRFWFRVUkVESU1FTlNJT05fQ1VCRV9BUlJBWSIsIlRFWFRVUkVESU1FTlNJT05fM0QiLCJTQU1QTEVUWVBFX0ZMT0FUIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJTQU1QTEVUWVBFX0RFUFRIIiwiU0FNUExFVFlQRV9JTlQiLCJTQU1QTEVUWVBFX1VJTlQiLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsIlRFWFRVUkVQUk9KRUNUSU9OX0VRVUlSRUNUIiwiVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTCIsIlNIQURFUkxBTkdVQUdFX0dMU0wiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsIlRZUEVfRkxPQVQxNiIsIlVOSUZPUk1UWVBFX0JPT0wiLCJVTklGT1JNVFlQRV9JTlQiLCJVTklGT1JNVFlQRV9GTE9BVCIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJVTklGT1JNVFlQRV9WRUMzIiwiVU5JRk9STVRZUEVfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUMyIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJVTklGT1JNVFlQRV9JVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUMyIiwiVU5JRk9STVRZUEVfQlZFQzMiLCJVTklGT1JNVFlQRV9CVkVDNCIsIlVOSUZPUk1UWVBFX01BVDIiLCJVTklGT1JNVFlQRV9NQVQzIiwiVU5JRk9STVRZUEVfTUFUNCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiVU5JRk9STVRZUEVfRkxPQVRBUlJBWSIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFM0QiLCJVTklGT1JNVFlQRV9WRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9WRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9WRUM0QVJSQVkiLCJVTklGT1JNVFlQRV9NQVQ0QVJSQVkiLCJVTklGT1JNVFlQRV9URVhUVVJFMkRfQVJSQVkiLCJVTklGT1JNVFlQRV9VSU5UIiwiVU5JRk9STVRZUEVfVVZFQzIiLCJVTklGT1JNVFlQRV9VVkVDMyIsIlVOSUZPUk1UWVBFX1VWRUM0IiwiVU5JRk9STVRZUEVfSU5UQVJSQVkiLCJVTklGT1JNVFlQRV9VSU5UQVJSQVkiLCJVTklGT1JNVFlQRV9CT09MQVJSQVkiLCJVTklGT1JNVFlQRV9JVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfVVZFQzJBUlJBWSIsIlVOSUZPUk1UWVBFX0JWRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9JVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfVVZFQzNBUlJBWSIsIlVOSUZPUk1UWVBFX0JWRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9JVkVDNEFSUkFZIiwiVU5JRk9STVRZUEVfVVZFQzRBUlJBWSIsIlVOSUZPUk1UWVBFX0JWRUM0QVJSQVkiLCJVTklGT1JNVFlQRV9JVEVYVFVSRTJEIiwiVU5JRk9STVRZUEVfVVRFWFRVUkUyRCIsIlVOSUZPUk1UWVBFX0lURVhUVVJFQ1VCRSIsIlVOSUZPUk1UWVBFX1VURVhUVVJFQ1VCRSIsIlVOSUZPUk1UWVBFX0lURVhUVVJFM0QiLCJVTklGT1JNVFlQRV9VVEVYVFVSRTNEIiwiVU5JRk9STVRZUEVfSVRFWFRVUkUyRF9BUlJBWSIsIlVOSUZPUk1UWVBFX1VURVhUVVJFMkRfQVJSQVkiLCJ1bmlmb3JtVHlwZVRvTmFtZSIsInVuaWZvcm1UeXBlVG9TdG9yYWdlIiwiREVWSUNFVFlQRV9XRUJHTDEiLCJERVZJQ0VUWVBFX1dFQkdMMiIsIkRFVklDRVRZUEVfV0VCR1BVIiwiREVWSUNFVFlQRV9OVUxMIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJTSEFERVJTVEFHRV9DT01QVVRFIiwiQklOREdST1VQX01FU0giLCJCSU5ER1JPVVBfVklFVyIsImJpbmRHcm91cE5hbWVzIiwiVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUiLCJ0eXBlZEFycmF5VHlwZXMiLCJ0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZSIsInZlcnRleFR5cGVzTmFtZXMiLCJ0eXBlZEFycmF5VG9UeXBlIiwidHlwZWRBcnJheUluZGV4Rm9ybWF0cyIsInR5cGVkQXJyYXlJbmRleEZvcm1hdHNCeXRlU2l6ZSIsInNlbWFudGljVG9Mb2NhdGlvbiIsIkNIVU5LQVBJXzFfNTEiLCJDSFVOS0FQSV8xXzU1IiwiQ0hVTktBUElfMV81NiIsIkNIVU5LQVBJXzFfNTciLCJDSFVOS0FQSV8xXzU4IiwiQ0hVTktBUElfMV82MCIsIkNIVU5LQVBJXzFfNjIiLCJDSFVOS0FQSV8xXzY1Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMscUJBQXFCLEdB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TUFBTUMscUJBQXFCLEdBQUcsZUFBYzs7QUFFbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLFFBQU87O0FBRXJDO0FBQ08sTUFBTUMsaUJBQWlCLEdBQUcsV0FBVTs7QUFFM0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsWUFBVzs7QUFFN0M7QUFDTyxNQUFNQyxhQUFhLEdBQUcsT0FBTTs7QUFFbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLFFBQU87O0FBRXJDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxRQUFPOztBQUVyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsUUFBTzs7QUFFckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLFFBQU87O0FBRXJDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1B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
