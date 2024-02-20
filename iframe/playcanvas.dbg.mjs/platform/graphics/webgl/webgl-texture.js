import { Debug } from '../../../core/debug.js';
import { PIXELFORMAT_BGRA8, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA32I, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA16I, PIXELFORMAT_RGBA8U, PIXELFORMAT_RGBA8I, PIXELFORMAT_RG32U, PIXELFORMAT_RG32I, PIXELFORMAT_RG16U, PIXELFORMAT_RG16I, PIXELFORMAT_RG8U, PIXELFORMAT_RG8I, PIXELFORMAT_R32U, PIXELFORMAT_R32I, PIXELFORMAT_R16U, PIXELFORMAT_R16I, PIXELFORMAT_R8U, PIXELFORMAT_R8I, PIXELFORMAT_SRGBA, PIXELFORMAT_SRGB, PIXELFORMAT_111110F, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB16F, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_ETC1, PIXELFORMAT_DXT5, PIXELFORMAT_DXT3, PIXELFORMAT_DXT1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from '../constants.js';

/**
 * Checks that an image's width and height do not exceed the max texture size. If they do, it will
 * be scaled down to that maximum size and returned as a canvas element.
 *
 * @param {HTMLImageElement} image - The image to downsample.
 * @param {number} size - The maximum allowed size of the image.
 * @returns {HTMLImageElement|HTMLCanvasElement} The downsampled image.
 * @ignore
 */
function downsampleImage(image, size) {
  const srcW = image.width;
  const srcH = image.height;
  if (srcW > size || srcH > size) {
    const scale = size / Math.max(srcW, srcH);
    const dstW = Math.floor(srcW * scale);
    const dstH = Math.floor(srcH * scale);
    Debug.warn(`Image dimensions larger than max supported texture size of ${size}. Resizing from ${srcW}, ${srcH} to ${dstW}, ${dstH}.`);
    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
    return canvas;
  }
  return image;
}

/**
 * A WebGL implementation of the Texture.
 *
 * @ignore
 */
class WebglTexture {
  constructor() {
    this._glTexture = null;
    this._glTarget = void 0;
    this._glFormat = void 0;
    this._glInternalFormat = void 0;
    this._glPixelType = void 0;
    this._glCreated = void 0;
    this.dirtyParameterFlags = 0;
  }
  destroy(device) {
    if (this._glTexture) {
      // Update shadowed texture unit state to remove texture from any units
      for (let i = 0; i < device.textureUnits.length; i++) {
        const textureUnit = device.textureUnits[i];
        for (let j = 0; j < textureUnit.length; j++) {
          if (textureUnit[j] === this._glTexture) {
            textureUnit[j] = null;
          }
        }
      }

      // release WebGL texture resource
      device.gl.deleteTexture(this._glTexture);
      this._glTexture = null;
    }
  }
  loseContext() {
    this._glTexture = null;
  }
  propertyChanged(flag) {
    this.dirtyParameterFlags |= flag;
  }
  initialize(device, texture) {
    const gl = device.gl;
    this._glTexture = gl.createTexture();
    this._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP : texture._volume ? gl.TEXTURE_3D : texture.array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    switch (texture._format) {
      case PIXELFORMAT_A8:
        this._glFormat = gl.ALPHA;
        this._glInternalFormat = gl.ALPHA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_L8:
        this._glFormat = gl.LUMINANCE;
        this._glInternalFormat = gl.LUMINANCE;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_LA8:
        this._glFormat = gl.LUMINANCE_ALPHA;
        this._glInternalFormat = gl.LUMINANCE_ALPHA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RGB565:
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.RGB;
        this._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
        break;
      case PIXELFORMAT_RGBA5551:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
        break;
      case PIXELFORMAT_RGBA4:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
        break;
      case PIXELFORMAT_RGB8:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.isWebGL2 ? gl.RGB8 : gl.RGB;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RGBA8:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.isWebGL2 ? gl.RGBA8 : gl.RGBA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_DXT1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT;
        break;
      case PIXELFORMAT_DXT3:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        break;
      case PIXELFORMAT_DXT5:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT;
        break;
      case PIXELFORMAT_ETC1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureETC1.COMPRESSED_RGB_ETC1_WEBGL;
        break;
      case PIXELFORMAT_PVRTC_2BPP_RGB_1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        break;
      case PIXELFORMAT_PVRTC_2BPP_RGBA_1:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
        break;
      case PIXELFORMAT_PVRTC_4BPP_RGB_1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        break;
      case PIXELFORMAT_PVRTC_4BPP_RGBA_1:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        break;
      case PIXELFORMAT_ETC2_RGB:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGB8_ETC2;
        break;
      case PIXELFORMAT_ETC2_RGBA:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGBA8_ETC2_EAC;
        break;
      case PIXELFORMAT_ASTC_4x4:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureASTC.COMPRESSED_RGBA_ASTC_4x4_KHR;
        break;
      case PIXELFORMAT_ATC_RGB:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGB_ATC_WEBGL;
        break;
      case PIXELFORMAT_ATC_RGBA:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL;
        break;
      case PIXELFORMAT_RGB16F:
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGB;
        if (device.isWebGL2) {
          this._glInternalFormat = gl.RGB16F;
          this._glPixelType = gl.HALF_FLOAT;
        } else {
          this._glInternalFormat = gl.RGB;
          this._glPixelType = device.extTextureHalfFloat.HALF_FLOAT_OES;
        }
        break;
      case PIXELFORMAT_RGBA16F:
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGBA;
        if (device.isWebGL2) {
          this._glInternalFormat = gl.RGBA16F;
          this._glPixelType = gl.HALF_FLOAT;
        } else {
          this._glInternalFormat = gl.RGBA;
          this._glPixelType = device.extTextureHalfFloat.HALF_FLOAT_OES;
        }
        break;
      case PIXELFORMAT_RGB32F:
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGB;
        if (device.isWebGL2) {
          this._glInternalFormat = gl.RGB32F;
        } else {
          this._glInternalFormat = gl.RGB;
        }
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_RGBA32F:
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGBA;
        if (device.isWebGL2) {
          this._glInternalFormat = gl.RGBA32F;
        } else {
          this._glInternalFormat = gl.RGBA;
        }
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_R32F:
        // WebGL2 only
        this._glFormat = gl.RED;
        this._glInternalFormat = gl.R32F;
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_DEPTH:
        if (device.isWebGL2) {
          // native WebGL2
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT32F; // should allow 16/24 bits?
          this._glPixelType = gl.FLOAT;
        } else {
          // using WebGL1 extension
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT;
          this._glPixelType = gl.UNSIGNED_SHORT; // the only acceptable value?
        }

        break;
      case PIXELFORMAT_DEPTHSTENCIL:
        this._glFormat = gl.DEPTH_STENCIL;
        if (device.isWebGL2) {
          this._glInternalFormat = gl.DEPTH24_STENCIL8;
          this._glPixelType = gl.UNSIGNED_INT_24_8;
        } else {
          this._glInternalFormat = gl.DEPTH_STENCIL;
          this._glPixelType = device.extDepthTexture.UNSIGNED_INT_24_8_WEBGL;
        }
        break;
      case PIXELFORMAT_111110F:
        // WebGL2 only
        Debug.assert(device.isWebGL2, "PIXELFORMAT_111110F texture format is not supported by WebGL1.");
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.R11F_G11F_B10F;
        this._glPixelType = gl.UNSIGNED_INT_10F_11F_11F_REV;
        break;
      case PIXELFORMAT_SRGB:
        // WebGL2 only
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.SRGB8;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_SRGBA:
        // WebGL2 only
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.SRGB8_ALPHA8;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      // Integer texture formats (R) (WebGL2 only)
      case PIXELFORMAT_R8I:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R8I;
        this._glPixelType = gl.BYTE;
        break;
      case PIXELFORMAT_R8U:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R8UI;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_R16I:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R16I;
        this._glPixelType = gl.SHORT;
        break;
      case PIXELFORMAT_R16U:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R16UI;
        this._glPixelType = gl.UNSIGNED_SHORT;
        break;
      case PIXELFORMAT_R32I:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R32I;
        this._glPixelType = gl.INT;
        break;
      case PIXELFORMAT_R32U:
        // WebGL2 only
        this._glFormat = gl.RED_INTEGER;
        this._glInternalFormat = gl.R32UI;
        this._glPixelType = gl.UNSIGNED_INT;
        break;
      // Integer texture formats (RG) (WebGL2 only)
      case PIXELFORMAT_RG8I:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG8I;
        this._glPixelType = gl.BYTE;
        break;
      case PIXELFORMAT_RG8U:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG8UI;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RG16I:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG16I;
        this._glPixelType = gl.SHORT;
        break;
      case PIXELFORMAT_RG16U:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG16UI;
        this._glPixelType = gl.UNSIGNED_SHORT;
        break;
      case PIXELFORMAT_RG32I:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG32I;
        this._glPixelType = gl.INT;
        break;
      case PIXELFORMAT_RG32U:
        // WebGL2 only
        this._glFormat = gl.RG_INTEGER;
        this._glInternalFormat = gl.RG32UI;
        this._glPixelType = gl.UNSIGNED_INT;
        break;
      // Integer texture formats (RGBA) (WebGL2 only)
      case PIXELFORMAT_RGBA8I:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA8I;
        this._glPixelType = gl.BYTE;
        break;
      case PIXELFORMAT_RGBA8U:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA8UI;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RGBA16I:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA16I;
        this._glPixelType = gl.SHORT;
        break;
      case PIXELFORMAT_RGBA16U:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA16UI;
        this._glPixelType = gl.UNSIGNED_SHORT;
        break;
      case PIXELFORMAT_RGBA32I:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA32I;
        this._glPixelType = gl.INT;
        break;
      case PIXELFORMAT_RGBA32U:
        // WebGL2 only
        this._glFormat = gl.RGBA_INTEGER;
        this._glInternalFormat = gl.RGBA32UI;
        this._glPixelType = gl.UNSIGNED_INT;
        break;
      case PIXELFORMAT_BGRA8:
        Debug.error("BGRA8 texture format is not supported by WebGL.");
        break;
    }
    this._glCreated = false;
  }

  /**
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The device.
   * @param {import('../texture.js').Texture} texture - The texture to update.
   */
  upload(device, texture) {
    Debug.assert(texture.device, "Attempting to use a texture that has been destroyed.", texture);
    const gl = device.gl;
    if (!texture._needsUpload && (texture._needsMipmapsUpload && texture._mipmapsUploaded || !texture.pot)) return;
    let mipLevel = 0;
    let mipObject;
    let resMult;
    const requiredMipLevels = texture.requiredMipLevels;
    if (texture.array) {
      // for texture arrays we reserve the space in advance
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, requiredMipLevels, this._glInternalFormat, texture._width, texture._height, texture._arrayLength);
    }

    // Upload all existing mip levels. Initialize 0 mip anyway.
    while (texture._levels[mipLevel] || mipLevel === 0) {
      if (!texture._needsUpload && mipLevel === 0) {
        mipLevel++;
        continue;
      } else if (mipLevel && (!texture._needsMipmapsUpload || !texture._mipmaps)) {
        break;
      }
      mipObject = texture._levels[mipLevel];
      resMult = 1 / Math.pow(2, mipLevel);
      if (mipLevel === 1 && !texture._compressed && !texture._integerFormat && texture._levels.length < requiredMipLevels) {
        // We have more than one mip levels we want to assign, but we need all mips to make
        // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
        // (this implies the call to _completePartialMipLevels above was unsuccessful)
        gl.generateMipmap(this._glTarget);
        texture._mipmapsUploaded = true;
      }
      if (texture._cubemap) {
        // ----- CUBEMAP -----
        let face;
        if (device._isBrowserInterface(mipObject[0])) {
          // Upload the image, canvas or video
          for (face = 0; face < 6; face++) {
            if (!texture._levelsUpdated[0][face]) continue;
            let src = mipObject[face];
            // Downsize images that are too large to be used as cube maps
            if (device._isImageBrowserInterface(src)) {
              if (src.width > device.maxCubeMapSize || src.height > device.maxCubeMapSize) {
                src = downsampleImage(src, device.maxCubeMapSize);
                if (mipLevel === 0) {
                  texture._width = src.width;
                  texture._height = src.height;
                }
              }
            }
            device.setUnpackFlipY(false);
            device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
            if (this._glCreated) {
              gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, 0, 0, this._glFormat, this._glPixelType, src);
            } else {
              gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, this._glFormat, this._glPixelType, src);
            }
          }
        } else {
          // Upload the byte array
          resMult = 1 / Math.pow(2, mipLevel);
          for (face = 0; face < 6; face++) {
            if (!texture._levelsUpdated[0][face]) continue;
            const texData = mipObject[face];
            if (texture._compressed) {
              if (this._glCreated && texData) {
                gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, 0, 0, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), this._glInternalFormat, texData);
              } else {
                gl.compressedTexImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, texData);
              }
            } else {
              device.setUnpackFlipY(false);
              device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
              if (this._glCreated && texData) {
                gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, 0, 0, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), this._glFormat, this._glPixelType, texData);
              } else {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, this._glFormat, this._glPixelType, texData);
              }
            }
          }
        }
      } else if (texture._volume) {
        // ----- 3D -----
        // Image/canvas/video not supported (yet?)
        // Upload the byte array
        if (texture._compressed) {
          gl.compressedTexImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, mipObject);
        } else {
          device.setUnpackFlipY(false);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
          gl.texImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, this._glFormat, this._glPixelType, mipObject);
        }
      } else if (texture.array && typeof mipObject === "object") {
        if (texture._arrayLength === mipObject.length) {
          if (texture._compressed) {
            for (let index = 0; index < texture._arrayLength; index++) {
              gl.compressedTexSubImage3D(gl.TEXTURE_2D_ARRAY, mipLevel, 0, 0, index, Math.max(Math.floor(texture._width * resMult), 1), Math.max(Math.floor(texture._height * resMult), 1), 1, this._glFormat, mipObject[index]);
            }
          } else {
            for (let index = 0; index < texture._arrayLength; index++) {
              gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, mipLevel, 0, 0, index, Math.max(Math.floor(texture._width * resMult), 1), Math.max(Math.floor(texture._height * resMult), 1), 1, this._glFormat, this._glPixelType, mipObject[index]);
            }
          }
        }
      } else {
        // ----- 2D -----
        if (device._isBrowserInterface(mipObject)) {
          // Downsize images that are too large to be used as textures
          if (device._isImageBrowserInterface(mipObject)) {
            if (mipObject.width > device.maxTextureSize || mipObject.height > device.maxTextureSize) {
              mipObject = downsampleImage(mipObject, device.maxTextureSize);
              if (mipLevel === 0) {
                texture._width = mipObject.width;
                texture._height = mipObject.height;
              }
            }
          }
          const w = mipObject.width || mipObject.videoWidth;
          const h = mipObject.height || mipObject.videoHeight;

          // Upload the image, canvas or video
          device.setUnpackFlipY(texture._flipY);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);

          // TEMP: disable fast path for video updates until
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1511207 is resolved
          if (this._glCreated && texture._width === w && texture._height === h && !device._isImageVideoInterface(mipObject)) {
            gl.texSubImage2D(gl.TEXTURE_2D, mipLevel, 0, 0, this._glFormat, this._glPixelType, mipObject);
          } else {
            gl.texImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, this._glFormat, this._glPixelType, mipObject);
            if (mipLevel === 0) {
              texture._width = w;
              texture._height = h;
            }
          }
        } else {
          // Upload the byte array
          resMult = 1 / Math.pow(2, mipLevel);
          if (texture._compressed) {
            if (this._glCreated && mipObject) {
              gl.compressedTexSubImage2D(gl.TEXTURE_2D, mipLevel, 0, 0, Math.max(Math.floor(texture._width * resMult), 1), Math.max(Math.floor(texture._height * resMult), 1), this._glInternalFormat, mipObject);
            } else {
              gl.compressedTexImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, Math.max(Math.floor(texture._width * resMult), 1), Math.max(Math.floor(texture._height * resMult), 1), 0, mipObject);
            }
          } else {
            device.setUnpackFlipY(false);
            device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
            if (this._glCreated && mipObject) {
              gl.texSubImage2D(gl.TEXTURE_2D, mipLevel, 0, 0, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), this._glFormat, this._glPixelType, mipObject);
            } else {
              gl.texImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, this._glFormat, this._glPixelType, mipObject);
            }
          }
        }
        if (mipLevel === 0) {
          texture._mipmapsUploaded = false;
        } else {
          texture._mipmapsUploaded = true;
        }
      }
      mipLevel++;
    }
    if (texture._needsUpload) {
      if (texture._cubemap) {
        for (let i = 0; i < 6; i++) texture._levelsUpdated[0][i] = false;
      } else {
        texture._levelsUpdated[0] = false;
      }
    }
    if (!texture._compressed && !texture._integerFormat && texture._mipmaps && texture._needsMipmapsUpload && (texture.pot || device.isWebGL2) && texture._levels.length === 1) {
      gl.generateMipmap(this._glTarget);
      texture._mipmapsUploaded = true;
    }

    // update vram stats
    if (texture._gpuSize) {
      texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
    }
    texture._gpuSize = texture.gpuSize;
    texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
    this._glCreated = true;
  }
}

export { WebglTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0xBOCwgUElYRUxGT1JNQVRfUkdCNTY1LCBQSVhFTEZPUk1BVF9SR0JBNTU1MSwgUElYRUxGT1JNQVRfUkdCQTQsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0IzMkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1IzMkYsIFBJWEVMRk9STUFUX0RFUFRILFxuICAgIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsIFBJWEVMRk9STUFUX0VUQzEsXG4gICAgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX0FTVENfNHg0LCBQSVhFTEZPUk1BVF9BVENfUkdCLFxuICAgIFBJWEVMRk9STUFUX0FUQ19SR0JBLCBQSVhFTEZPUk1BVF9CR1JBOCwgUElYRUxGT1JNQVRfUjhJLCBQSVhFTEZPUk1BVF9SOFUsIFBJWEVMRk9STUFUX1IxNkksIFBJWEVMRk9STUFUX1IxNlUsXG4gICAgUElYRUxGT1JNQVRfUjMySSwgUElYRUxGT1JNQVRfUjMyVSwgUElYRUxGT1JNQVRfUkcxNkksIFBJWEVMRk9STUFUX1JHMTZVLCBQSVhFTEZPUk1BVF9SRzMySSwgUElYRUxGT1JNQVRfUkczMlUsXG4gICAgUElYRUxGT1JNQVRfUkc4SSwgUElYRUxGT1JNQVRfUkc4VSwgUElYRUxGT1JNQVRfUkdCQTE2SSwgUElYRUxGT1JNQVRfUkdCQTE2VSwgUElYRUxGT1JNQVRfUkdCQTMySSwgUElYRUxGT1JNQVRfUkdCQTMyVSxcbiAgICBQSVhFTEZPUk1BVF9SR0JBOEksIFBJWEVMRk9STUFUX1JHQkE4VVxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IGFuIGltYWdlJ3Mgd2lkdGggYW5kIGhlaWdodCBkbyBub3QgZXhjZWVkIHRoZSBtYXggdGV4dHVyZSBzaXplLiBJZiB0aGV5IGRvLCBpdCB3aWxsXG4gKiBiZSBzY2FsZWQgZG93biB0byB0aGF0IG1heGltdW0gc2l6ZSBhbmQgcmV0dXJuZWQgYXMgYSBjYW52YXMgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxJbWFnZUVsZW1lbnR9IGltYWdlIC0gVGhlIGltYWdlIHRvIGRvd25zYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZSBvZiB0aGUgaW1hZ2UuXG4gKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudH0gVGhlIGRvd25zYW1wbGVkIGltYWdlLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBkb3duc2FtcGxlSW1hZ2UoaW1hZ2UsIHNpemUpIHtcbiAgICBjb25zdCBzcmNXID0gaW1hZ2Uud2lkdGg7XG4gICAgY29uc3Qgc3JjSCA9IGltYWdlLmhlaWdodDtcblxuICAgIGlmICgoc3JjVyA+IHNpemUpIHx8IChzcmNIID4gc2l6ZSkpIHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBzaXplIC8gTWF0aC5tYXgoc3JjVywgc3JjSCk7XG4gICAgICAgIGNvbnN0IGRzdFcgPSBNYXRoLmZsb29yKHNyY1cgKiBzY2FsZSk7XG4gICAgICAgIGNvbnN0IGRzdEggPSBNYXRoLmZsb29yKHNyY0ggKiBzY2FsZSk7XG5cbiAgICAgICAgRGVidWcud2FybihgSW1hZ2UgZGltZW5zaW9ucyBsYXJnZXIgdGhhbiBtYXggc3VwcG9ydGVkIHRleHR1cmUgc2l6ZSBvZiAke3NpemV9LiBSZXNpemluZyBmcm9tICR7c3JjV30sICR7c3JjSH0gdG8gJHtkc3RXfSwgJHtkc3RIfS5gKTtcblxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gZHN0VztcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGRzdEg7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgMCwgMCwgc3JjVywgc3JjSCwgMCwgMCwgZHN0VywgZHN0SCk7XG5cbiAgICAgICAgcmV0dXJuIGNhbnZhcztcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2U7XG59XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVGV4dHVyZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdsVGV4dHVyZSB7XG4gICAgX2dsVGV4dHVyZSA9IG51bGw7XG5cbiAgICBfZ2xUYXJnZXQ7XG5cbiAgICBfZ2xGb3JtYXQ7XG5cbiAgICBfZ2xJbnRlcm5hbEZvcm1hdDtcblxuICAgIF9nbFBpeGVsVHlwZTtcblxuICAgIF9nbENyZWF0ZWQ7XG5cbiAgICBkaXJ0eVBhcmFtZXRlckZsYWdzID0gMDtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG4gICAgICAgIGlmICh0aGlzLl9nbFRleHR1cmUpIHtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHNoYWRvd2VkIHRleHR1cmUgdW5pdCBzdGF0ZSB0byByZW1vdmUgdGV4dHVyZSBmcm9tIGFueSB1bml0c1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXZpY2UudGV4dHVyZVVuaXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSBkZXZpY2UudGV4dHVyZVVuaXRzW2ldO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGV4dHVyZVVuaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmVVbml0W2pdID09PSB0aGlzLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0W2pdID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVsZWFzZSBXZWJHTCB0ZXh0dXJlIHJlc291cmNlXG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLl9nbFRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLl9nbFRleHR1cmUgPSBudWxsO1xuICAgIH1cblxuICAgIHByb3BlcnR5Q2hhbmdlZChmbGFnKSB7XG4gICAgICAgIHRoaXMuZGlydHlQYXJhbWV0ZXJGbGFncyB8PSBmbGFnO1xuICAgIH1cblxuICAgIGluaXRpYWxpemUoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuXG4gICAgICAgIHRoaXMuX2dsVGFyZ2V0ID0gdGV4dHVyZS5fY3ViZW1hcCA/IGdsLlRFWFRVUkVfQ1VCRV9NQVAgOlxuICAgICAgICAgICAgKHRleHR1cmUuX3ZvbHVtZSA/IGdsLlRFWFRVUkVfM0QgOlxuICAgICAgICAgICAgICAgICh0ZXh0dXJlLmFycmF5ID8gZ2wuVEVYVFVSRV8yRF9BUlJBWSA6IGdsLlRFWFRVUkVfMkQpKTtcblxuICAgICAgICBzd2l0Y2ggKHRleHR1cmUuX2Zvcm1hdCkge1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkFMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0w4OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5MVU1JTkFOQ0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0VfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjU2NTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV82XzU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE1NTUxOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzVfNV81XzE7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzRfNF80XzQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5pc1dlYkdMMiA/IGdsLlJHQjggOiBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5pc1dlYkdMMiA/IGdsLlJHQkE4IDogZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JfUzNUQ19EWFQxX0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMzpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUM19FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDU6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDLkNPTVBSRVNTRURfUkdCQV9TM1RDX0RYVDVfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9FVEMxOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxLkNPTVBSRVNTRURfUkdCX0VUQzFfV0VCR0w7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDLkNPTVBSRVNTRURfUkdCX1BWUlRDXzJCUFBWMV9JTUc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzJCUFBWMV9JTUc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDLkNPTVBSRVNTRURfUkdCX1BWUlRDXzRCUFBWMV9JTUc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzRCUFBWMV9JTUc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzJfUkdCOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMuQ09NUFJFU1NFRF9SR0I4X0VUQzI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzJfUkdCQTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQy5DT01QUkVTU0VEX1JHQkE4X0VUQzJfRUFDO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BU1RDXzR4NDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMuQ09NUFJFU1NFRF9SR0JBX0FTVENfNHg0X0tIUjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQVRDX1JHQjpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVRDLkNPTVBSRVNTRURfUkdCX0FUQ19XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQVRDX1JHQkE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMuQ09NUFJFU1NFRF9SR0JBX0FUQ19JTlRFUlBPTEFURURfQUxQSEFfV0VCR0w7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjE2RjpcbiAgICAgICAgICAgICAgICAvLyBkZWZpbml0aW9uIHZhcmllcyBiZXR3ZWVuIFdlYkdMMSBhbmQgMlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjE2RjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5IQUxGX0ZMT0FUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkExNkY7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuSEFMRl9GTE9BVDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBkZXZpY2UuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjMyRjpcbiAgICAgICAgICAgICAgICAvLyBkZWZpbml0aW9uIHZhcmllcyBiZXR3ZWVuIFdlYkdMMSBhbmQgMlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjMyRjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkZMT0FUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMkY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRUQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEg6XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5pc1dlYkdMMikge1xuICAgICAgICAgICAgICAgICAgICAvLyBuYXRpdmUgV2ViR0wyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UMzJGOyAvLyBzaG91bGQgYWxsb3cgMTYvMjQgYml0cz9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2luZyBXZWJHTDEgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUOyAvLyB0aGUgb25seSBhY2NlcHRhYmxlIHZhbHVlP1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfU1RFTkNJTDtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5ERVBUSDI0X1NURU5DSUw4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0lOVF8yNF84O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5ERVBUSF9TVEVOQ0lMO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGRldmljZS5leHREZXB0aFRleHR1cmUuVU5TSUdORURfSU5UXzI0XzhfV0VCR0w7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF8xMTExMTBGOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChkZXZpY2UuaXNXZWJHTDIsIFwiUElYRUxGT1JNQVRfMTExMTEwRiB0ZXh0dXJlIGZvcm1hdCBpcyBub3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMS5cIik7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxMUZfRzExRl9CMTBGO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFVjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfU1JHQjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjg7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCQTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlNSR0I4X0FMUEhBODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAvLyBJbnRlZ2VyIHRleHR1cmUgZm9ybWF0cyAoUikgKFdlYkdMMiBvbmx5KVxuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SOEk6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRURfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUjhJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhVOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkVEX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlI4VUk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SMTZJOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkVEX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxNkk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5TSE9SVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjE2VTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJFRF9JTlRFR0VSO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SMTZVSTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SMzJJOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkVEX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5JTlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMlU6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRURfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUjMyVUk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9JTlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAvLyBJbnRlZ2VyIHRleHR1cmUgZm9ybWF0cyAoUkcpIChXZWJHTDIgb25seSlcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkc4STogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHOEk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SRzhVOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkc4VUk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SRzE2STogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHMTZJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuU0hPUlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHMTZVOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkcxNlVJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHMzJJOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkczMkk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5JTlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHMzJVOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdfSU5URUdFUjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkczMlVJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgLy8gSW50ZWdlciB0ZXh0dXJlIGZvcm1hdHMgKFJHQkEpIChXZWJHTDIgb25seSlcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQThJOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQV9JTlRFR0VSO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBOEk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBOFU6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE4VUk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZJOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQV9JTlRFR0VSO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBMTZJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuU0hPUlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNlU6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkExNlVJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkk6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5JTlQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMlU6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBX0lOVEVHRVI7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMlVJO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9CR1JBODpcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkJHUkE4IHRleHR1cmUgZm9ybWF0IGlzIG5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wuXCIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZ2xDcmVhdGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ2xHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vdGV4dHVyZS5qcycpLlRleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byB1cGRhdGUuXG4gICAgICovXG4gICAgdXBsb2FkKGRldmljZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydCh0ZXh0dXJlLmRldmljZSwgXCJBdHRlbXB0aW5nIHRvIHVzZSBhIHRleHR1cmUgdGhhdCBoYXMgYmVlbiBkZXN0cm95ZWQuXCIsIHRleHR1cmUpO1xuICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcblxuICAgICAgICBpZiAoIXRleHR1cmUuX25lZWRzVXBsb2FkICYmICgodGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkICYmIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCkgfHwgIXRleHR1cmUucG90KSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBsZXQgbWlwTGV2ZWwgPSAwO1xuICAgICAgICBsZXQgbWlwT2JqZWN0O1xuICAgICAgICBsZXQgcmVzTXVsdDtcblxuICAgICAgICBjb25zdCByZXF1aXJlZE1pcExldmVscyA9IHRleHR1cmUucmVxdWlyZWRNaXBMZXZlbHM7XG5cbiAgICAgICAgaWYgKHRleHR1cmUuYXJyYXkpIHtcbiAgICAgICAgICAgIC8vIGZvciB0ZXh0dXJlIGFycmF5cyB3ZSByZXNlcnZlIHRoZSBzcGFjZSBpbiBhZHZhbmNlXG4gICAgICAgICAgICBnbC50ZXhTdG9yYWdlM0QoZ2wuVEVYVFVSRV8yRF9BUlJBWSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlZE1pcExldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX3dpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9hcnJheUxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGxvYWQgYWxsIGV4aXN0aW5nIG1pcCBsZXZlbHMuIEluaXRpYWxpemUgMCBtaXAgYW55d2F5LlxuICAgICAgICB3aGlsZSAodGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXSB8fCBtaXBMZXZlbCA9PT0gMCkge1xuXG4gICAgICAgICAgICBpZiAoIXRleHR1cmUuX25lZWRzVXBsb2FkICYmIG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbWlwTGV2ZWwrKztcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWlwTGV2ZWwgJiYgKCF0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgfHwgIXRleHR1cmUuX21pcG1hcHMpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1pcE9iamVjdCA9IHRleHR1cmUuX2xldmVsc1ttaXBMZXZlbF07XG4gICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcblxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAxICYmICF0ZXh0dXJlLl9jb21wcmVzc2VkICYmICF0ZXh0dXJlLl9pbnRlZ2VyRm9ybWF0ICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPCByZXF1aXJlZE1pcExldmVscykge1xuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgbW9yZSB0aGFuIG9uZSBtaXAgbGV2ZWxzIHdlIHdhbnQgdG8gYXNzaWduLCBidXQgd2UgbmVlZCBhbGwgbWlwcyB0byBtYWtlXG4gICAgICAgICAgICAgICAgLy8gdGhlIHRleHR1cmUgY29tcGxldGUuIFRoZXJlZm9yZSBmaXJzdCBnZW5lcmF0ZSBhbGwgbWlwIGNoYWluIGZyb20gMCwgdGhlbiBhc3NpZ24gY3VzdG9tIG1pcHMuXG4gICAgICAgICAgICAgICAgLy8gKHRoaXMgaW1wbGllcyB0aGUgY2FsbCB0byBfY29tcGxldGVQYXJ0aWFsTWlwTGV2ZWxzIGFib3ZlIHdhcyB1bnN1Y2Nlc3NmdWwpXG4gICAgICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gQ1VCRU1BUCAtLS0tLVxuICAgICAgICAgICAgICAgIGxldCBmYWNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdFswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNyYyA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvd25zaXplIGltYWdlcyB0aGF0IGFyZSB0b28gbGFyZ2UgdG8gYmUgdXNlZCBhcyBjdWJlIG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKHNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3JjLndpZHRoID4gZGV2aWNlLm1heEN1YmVNYXBTaXplIHx8IHNyYy5oZWlnaHQgPiBkZXZpY2UubWF4Q3ViZU1hcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjID0gZG93bnNhbXBsZUltYWdlKHNyYywgZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IHNyYy53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IHNyYy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dsQ3JlYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleFN1YkltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4RGF0YSA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dsQ3JlYXRlZCAmJiB0ZXhEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLmNvbXByZXNzZWRUZXhTdWJJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXhEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2xDcmVhdGVkICYmIHRleERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4U3ViSW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyBmYWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXhEYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlLl92b2x1bWUpIHtcbiAgICAgICAgICAgICAgICAvLyAtLS0tLSAzRCAtLS0tLVxuICAgICAgICAgICAgICAgIC8vIEltYWdlL2NhbnZhcy92aWRlbyBub3Qgc3VwcG9ydGVkICh5ZXQ/KVxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmNvbXByZXNzZWRUZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fZGVwdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UzRChnbC5URVhUVVJFXzNELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmUuYXJyYXkgJiYgdHlwZW9mIG1pcE9iamVjdCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9hcnJheUxlbmd0aCA9PT0gbWlwT2JqZWN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZS5fY29tcHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRleHR1cmUuX2FycmF5TGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleFN1YkltYWdlM0QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkRfQVJSQVksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0KSwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RbaW5kZXhdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0ZXh0dXJlLl9hcnJheUxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleFN1YkltYWdlM0QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkRfQVJSQVksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0KSwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0W2luZGV4XVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDJEIC0tLS0tXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRG93bnNpemUgaW1hZ2VzIHRoYXQgYXJlIHRvbyBsYXJnZSB0byBiZSB1c2VkIGFzIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXBPYmplY3Qud2lkdGggPiBkZXZpY2UubWF4VGV4dHVyZVNpemUgfHwgbWlwT2JqZWN0LmhlaWdodCA+IGRldmljZS5tYXhUZXh0dXJlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdCA9IGRvd25zYW1wbGVJbWFnZShtaXBPYmplY3QsIGRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX3dpZHRoID0gbWlwT2JqZWN0LndpZHRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9oZWlnaHQgPSBtaXBPYmplY3QuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHcgPSBtaXBPYmplY3Qud2lkdGggfHwgbWlwT2JqZWN0LnZpZGVvV2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGggPSBtaXBPYmplY3QuaGVpZ2h0IHx8IG1pcE9iamVjdC52aWRlb0hlaWdodDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGltYWdlLCBjYW52YXMgb3IgdmlkZW9cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKHRleHR1cmUuX2ZsaXBZKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVEVNUDogZGlzYWJsZSBmYXN0IHBhdGggZm9yIHZpZGVvIHVwZGF0ZXMgdW50aWxcbiAgICAgICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MTUxMTIwNyBpcyByZXNvbHZlZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2xDcmVhdGVkICYmIHRleHR1cmUuX3dpZHRoID09PSB3ICYmIHRleHR1cmUuX2hlaWdodCA9PT0gaCAmJiAhZGV2aWNlLl9pc0ltYWdlVmlkZW9JbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4U3ViSW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IHc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5faGVpZ2h0ID0gaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9nbENyZWF0ZWQgJiYgbWlwT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleFN1YkltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCksIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCksIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9nbENyZWF0ZWQgJiYgbWlwT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4U3ViSW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWlwTGV2ZWwrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCkge1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKylcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtpXSA9IGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRleHR1cmUuX2NvbXByZXNzZWQgJiYgIXRleHR1cmUuX2ludGVnZXJGb3JtYXQgJiYgdGV4dHVyZS5fbWlwbWFwcyAmJiB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgKHRleHR1cmUucG90IHx8IGRldmljZS5pc1dlYkdMMikgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB2cmFtIHN0YXRzXG4gICAgICAgIGlmICh0ZXh0dXJlLl9ncHVTaXplKSB7XG4gICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlLl9ncHVTaXplID0gdGV4dHVyZS5ncHVTaXplO1xuICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCB0ZXh0dXJlLl9ncHVTaXplKTtcblxuICAgICAgICB0aGlzLl9nbENyZWF0ZWQgPSB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiZG93bnNhbXBsZUltYWdlIiwiaW1hZ2UiLCJzaXplIiwic3JjVyIsIndpZHRoIiwic3JjSCIsImhlaWdodCIsInNjYWxlIiwiTWF0aCIsIm1heCIsImRzdFciLCJmbG9vciIsImRzdEgiLCJEZWJ1ZyIsIndhcm4iLCJjYW52YXMiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJjb250ZXh0IiwiZ2V0Q29udGV4dCIsImRyYXdJbWFnZSIsIldlYmdsVGV4dHVyZSIsImNvbnN0cnVjdG9yIiwiX2dsVGV4dHVyZSIsIl9nbFRhcmdldCIsIl9nbEZvcm1hdCIsIl9nbEludGVybmFsRm9ybWF0IiwiX2dsUGl4ZWxUeXBlIiwiX2dsQ3JlYXRlZCIsImRpcnR5UGFyYW1ldGVyRmxhZ3MiLCJkZXN0cm95IiwiZGV2aWNlIiwiaSIsInRleHR1cmVVbml0cyIsImxlbmd0aCIsInRleHR1cmVVbml0IiwiaiIsImdsIiwiZGVsZXRlVGV4dHVyZSIsImxvc2VDb250ZXh0IiwicHJvcGVydHlDaGFuZ2VkIiwiZmxhZyIsImluaXRpYWxpemUiLCJ0ZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsIl9jdWJlbWFwIiwiVEVYVFVSRV9DVUJFX01BUCIsIl92b2x1bWUiLCJURVhUVVJFXzNEIiwiYXJyYXkiLCJURVhUVVJFXzJEX0FSUkFZIiwiVEVYVFVSRV8yRCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9BOCIsIkFMUEhBIiwiVU5TSUdORURfQllURSIsIlBJWEVMRk9STUFUX0w4IiwiTFVNSU5BTkNFIiwiUElYRUxGT1JNQVRfTEE4IiwiTFVNSU5BTkNFX0FMUEhBIiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUkdCIiwiVU5TSUdORURfU0hPUlRfNV82XzUiLCJQSVhFTEZPUk1BVF9SR0JBNTU1MSIsIlJHQkEiLCJVTlNJR05FRF9TSE9SVF81XzVfNV8xIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJVTlNJR05FRF9TSE9SVF80XzRfNF80IiwiUElYRUxGT1JNQVRfUkdCOCIsImlzV2ViR0wyIiwiUkdCOCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUkdCQTgiLCJQSVhFTEZPUk1BVF9EWFQxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiQ09NUFJFU1NFRF9SR0JfUzNUQ19EWFQxX0VYVCIsIlBJWEVMRk9STUFUX0RYVDMiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVCIsIlBJWEVMRk9STUFUX0RYVDUiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQ1X0VYVCIsIlBJWEVMRk9STUFUX0VUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJDT01QUkVTU0VEX1JHQl9FVEMxX1dFQkdMIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ18yQlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ180QlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX0VUQzJfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJDT01QUkVTU0VEX1JHQjhfRVRDMiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUMiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsIkNPTVBSRVNTRURfUkdCQV9BU1RDXzR4NF9LSFIiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJDT01QUkVTU0VEX1JHQl9BVENfV0VCR0wiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsIkNPTVBSRVNTRURfUkdCQV9BVENfSU5URVJQT0xBVEVEX0FMUEhBX1dFQkdMIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUkdCMTZGIiwiSEFMRl9GTE9BVCIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJSR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUkdCMzJGIiwiRkxPQVQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUkdCQTMyRiIsIlBJWEVMRk9STUFUX1IzMkYiLCJSRUQiLCJSMzJGIiwiUElYRUxGT1JNQVRfREVQVEgiLCJERVBUSF9DT01QT05FTlQiLCJERVBUSF9DT01QT05FTlQzMkYiLCJVTlNJR05FRF9TSE9SVCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIkRFUFRIX1NURU5DSUwiLCJERVBUSDI0X1NURU5DSUw4IiwiVU5TSUdORURfSU5UXzI0XzgiLCJleHREZXB0aFRleHR1cmUiLCJVTlNJR05FRF9JTlRfMjRfOF9XRUJHTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJhc3NlcnQiLCJSMTFGX0cxMUZfQjEwRiIsIlVOU0lHTkVEX0lOVF8xMEZfMTFGXzExRl9SRVYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiU1JHQjgiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlNSR0I4X0FMUEhBOCIsIlBJWEVMRk9STUFUX1I4SSIsIlJFRF9JTlRFR0VSIiwiUjhJIiwiQllURSIsIlBJWEVMRk9STUFUX1I4VSIsIlI4VUkiLCJQSVhFTEZPUk1BVF9SMTZJIiwiUjE2SSIsIlNIT1JUIiwiUElYRUxGT1JNQVRfUjE2VSIsIlIxNlVJIiwiUElYRUxGT1JNQVRfUjMySSIsIlIzMkkiLCJJTlQiLCJQSVhFTEZPUk1BVF9SMzJVIiwiUjMyVUkiLCJVTlNJR05FRF9JTlQiLCJQSVhFTEZPUk1BVF9SRzhJIiwiUkdfSU5URUdFUiIsIlJHOEkiLCJQSVhFTEZPUk1BVF9SRzhVIiwiUkc4VUkiLCJQSVhFTEZPUk1BVF9SRzE2SSIsIlJHMTZJIiwiUElYRUxGT1JNQVRfUkcxNlUiLCJSRzE2VUkiLCJQSVhFTEZPUk1BVF9SRzMySSIsIlJHMzJJIiwiUElYRUxGT1JNQVRfUkczMlUiLCJSRzMyVUkiLCJQSVhFTEZPUk1BVF9SR0JBOEkiLCJSR0JBX0lOVEVHRVIiLCJSR0JBOEkiLCJQSVhFTEZPUk1BVF9SR0JBOFUiLCJSR0JBOFVJIiwiUElYRUxGT1JNQVRfUkdCQTE2SSIsIlJHQkExNkkiLCJQSVhFTEZPUk1BVF9SR0JBMTZVIiwiUkdCQTE2VUkiLCJQSVhFTEZPUk1BVF9SR0JBMzJJIiwiUkdCQTMySSIsIlBJWEVMRk9STUFUX1JHQkEzMlUiLCJSR0JBMzJVSSIsIlBJWEVMRk9STUFUX0JHUkE4IiwiZXJyb3IiLCJ1cGxvYWQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiX21pcG1hcHNVcGxvYWRlZCIsInBvdCIsIm1pcExldmVsIiwibWlwT2JqZWN0IiwicmVzTXVsdCIsInJlcXVpcmVkTWlwTGV2ZWxzIiwidGV4U3RvcmFnZTNEIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9hcnJheUxlbmd0aCIsIl9sZXZlbHMiLCJfbWlwbWFwcyIsInBvdyIsIl9jb21wcmVzc2VkIiwiX2ludGVnZXJGb3JtYXQiLCJnZW5lcmF0ZU1pcG1hcCIsImZhY2UiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwiX2xldmVsc1VwZGF0ZWQiLCJzcmMiLCJfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UiLCJtYXhDdWJlTWFwU2l6ZSIsInNldFVucGFja0ZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIl9wcmVtdWx0aXBseUFscGhhIiwidGV4U3ViSW1hZ2UyRCIsIlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCIsInRleEltYWdlMkQiLCJ0ZXhEYXRhIiwiY29tcHJlc3NlZFRleFN1YkltYWdlMkQiLCJjb21wcmVzc2VkVGV4SW1hZ2UyRCIsImNvbXByZXNzZWRUZXhJbWFnZTNEIiwiX2RlcHRoIiwidGV4SW1hZ2UzRCIsImluZGV4IiwiY29tcHJlc3NlZFRleFN1YkltYWdlM0QiLCJ0ZXhTdWJJbWFnZTNEIiwibWF4VGV4dHVyZVNpemUiLCJ3IiwidmlkZW9XaWR0aCIsImgiLCJ2aWRlb0hlaWdodCIsIl9mbGlwWSIsIl9pc0ltYWdlVmlkZW9JbnRlcmZhY2UiLCJfZ3B1U2l6ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImdwdVNpemUiXSwibWFwcGluZ3MiOiI7OztBQWVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLGVBQWVBLENBQUNDLEtBQUssRUFBRUMsSUFBSSxFQUFFO0FBQ2xDLEVBQUEsTUFBTUMsSUFBSSxHQUFHRixLQUFLLENBQUNHLEtBQUssQ0FBQTtBQUN4QixFQUFBLE1BQU1DLElBQUksR0FBR0osS0FBSyxDQUFDSyxNQUFNLENBQUE7QUFFekIsRUFBQSxJQUFLSCxJQUFJLEdBQUdELElBQUksSUFBTUcsSUFBSSxHQUFHSCxJQUFLLEVBQUU7SUFDaEMsTUFBTUssS0FBSyxHQUFHTCxJQUFJLEdBQUdNLElBQUksQ0FBQ0MsR0FBRyxDQUFDTixJQUFJLEVBQUVFLElBQUksQ0FBQyxDQUFBO0lBQ3pDLE1BQU1LLElBQUksR0FBR0YsSUFBSSxDQUFDRyxLQUFLLENBQUNSLElBQUksR0FBR0ksS0FBSyxDQUFDLENBQUE7SUFDckMsTUFBTUssSUFBSSxHQUFHSixJQUFJLENBQUNHLEtBQUssQ0FBQ04sSUFBSSxHQUFHRSxLQUFLLENBQUMsQ0FBQTtBQUVyQ00s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
