import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { RenderTarget } from './render-target.js';
import { TextureUtils } from './texture-utils.js';
import { TEXTURELOCK_NONE, PIXELFORMAT_RGBA8, isCompressedPixelFormat, isIntegerPixelFormat, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, TEXTURELOCK_WRITE, TEXTURELOCK_READ, getPixelFormatArrayType } from './constants.js';

let id = 0;

/**
 * A texture is a container for texel data that can be utilized in a fragment shader. Typically,
 * the texel data represents an image that is mapped over geometry.
 *
 * @category Graphics
 */
class Texture {
  /**
   * Create a new Texture instance.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this texture.
   * @param {object} [options] - Object for passing optional arguments.
   * @param {string} [options.name] - The name of the texture. Defaults to null.
   * @param {number} [options.width] - The width of the texture in pixels. Defaults to 4.
   * @param {number} [options.height] - The height of the texture in pixels. Defaults to 4.
   * @param {number} [options.depth] - The number of depth slices in a 3D texture (not supported by WebGl1).
   * @param {number} [options.format] - The pixel format of the texture. Can be:
   *
   * - {@link PIXELFORMAT_A8}
   * - {@link PIXELFORMAT_L8}
   * - {@link PIXELFORMAT_LA8}
   * - {@link PIXELFORMAT_RGB565}
   * - {@link PIXELFORMAT_RGBA5551}
   * - {@link PIXELFORMAT_RGBA4}
   * - {@link PIXELFORMAT_RGB8}
   * - {@link PIXELFORMAT_RGBA8}
   * - {@link PIXELFORMAT_DXT1}
   * - {@link PIXELFORMAT_DXT3}
   * - {@link PIXELFORMAT_DXT5}
   * - {@link PIXELFORMAT_RGB16F}
   * - {@link PIXELFORMAT_RGBA16F}
   * - {@link PIXELFORMAT_RGB32F}
   * - {@link PIXELFORMAT_RGBA32F}
   * - {@link PIXELFORMAT_ETC1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
   * - {@link PIXELFORMAT_111110F}
   * - {@link PIXELFORMAT_ASTC_4x4}
   * - {@link PIXELFORMAT_ATC_RGB}
   * - {@link PIXELFORMAT_ATC_RGBA}
   *
   * Defaults to {@link PIXELFORMAT_RGBA8}.
   * @param {string} [options.projection] - The projection type of the texture, used when the
   * texture represents an environment. Can be:
   *
   * - {@link TEXTUREPROJECTION_NONE}
   * - {@link TEXTUREPROJECTION_CUBE}
   * - {@link TEXTUREPROJECTION_EQUIRECT}
   * - {@link TEXTUREPROJECTION_OCTAHEDRAL}
   *
   * Defaults to {@link TEXTUREPROJECTION_CUBE} if options.cubemap is true, otherwise
   * {@link TEXTUREPROJECTION_NONE}.
   * @param {number} [options.minFilter] - The minification filter type to use. Defaults to
   * {@link FILTER_LINEAR_MIPMAP_LINEAR}.
   * @param {number} [options.magFilter] - The magnification filter type to use. Defaults to
   * {@link FILTER_LINEAR}.
   * @param {number} [options.anisotropy] - The level of anisotropic filtering to use. Defaults
   * to 1.
   * @param {number} [options.addressU] - The repeat mode to use in the U direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {number} [options.addressV] - The repeat mode to use in the V direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {number} [options.addressW] - The repeat mode to use in the W direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {boolean} [options.mipmaps] - When enabled try to generate or use mipmaps for this
   * texture. Default is true.
   * @param {boolean} [options.cubemap] - Specifies whether the texture is to be a cubemap.
   * Defaults to false.
   * @param {number} [options.arrayLength] - Specifies whether the texture is to be a 2D texture array.
   * When passed in as undefined or < 1, this is not an array texture. If >= 1, this is an array texture.
   * (not supported by WebGL1). Defaults to undefined.
   * @param {boolean} [options.volume] - Specifies whether the texture is to be a 3D volume
   * (not supported by WebGL1). Defaults to false.
   * @param {string} [options.type] - Specifies the texture type.  Can be:
   *
   * - {@link TEXTURETYPE_DEFAULT}
   * - {@link TEXTURETYPE_RGBM}
   * - {@link TEXTURETYPE_RGBE}
   * - {@link TEXTURETYPE_RGBP}
   * - {@link TEXTURETYPE_SWIZZLEGGGR}
   *
   * Defaults to {@link TEXTURETYPE_DEFAULT}.
   * @param {boolean} [options.fixCubemapSeams] - Specifies whether this cubemap texture requires
   * special seam fixing shader code to look right. Defaults to false.
   * @param {boolean} [options.flipY] - Specifies whether the texture should be flipped in the
   * Y-direction. Only affects textures with a source that is an image, canvas or video element.
   * Does not affect cubemaps, compressed textures or textures set from raw pixel data. Defaults
   * to false.
   * @param {boolean} [options.premultiplyAlpha] - If true, the alpha channel of the texture (if
   * present) is multiplied into the color channels. Defaults to false.
   * @param {boolean} [options.compareOnRead] - When enabled, and if texture format is
   * {@link PIXELFORMAT_DEPTH} or {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for
   * this texture, and you can get filtered results of comparison using texture() in your shader
   * (not supported by WebGL1). Defaults to false.
   * @param {number} [options.compareFunc] - Comparison function when compareOnRead is enabled
   * (not supported by WebGL1). Can be:
   *
   * - {@link FUNC_LESS}
   * - {@link FUNC_LESSEQUAL}
   * - {@link FUNC_GREATER}
   * - {@link FUNC_GREATEREQUAL}
   * - {@link FUNC_EQUAL}
   * - {@link FUNC_NOTEQUAL}
   *
   * Defaults to {@link FUNC_LESS}.
   * @param {Uint8Array[]|HTMLCanvasElement[]|HTMLImageElement[]|HTMLVideoElement[]|Uint8Array[][]} [options.levels]
   * - Array of Uint8Array or other supported browser interface; or a two-dimensional array
   * of Uint8Array if options.arrayLength is defined and greater than zero.
   * @param {boolean} [options.storage] - Defines if texture can be used as a storage texture by
   * a compute shader. Defaults to false.
   * @example
   * // Create a 8x8x24-bit texture
   * const texture = new pc.Texture(graphicsDevice, {
   *     width: 8,
   *     height: 8,
   *     format: pc.PIXELFORMAT_RGB8
   * });
   *
   * // Fill the texture with a gradient
   * const pixels = texture.lock();
   * const count = 0;
   * for (let i = 0; i < 8; i++) {
   *     for (let j = 0; j < 8; j++) {
   *         pixels[count++] = i * 32;
   *         pixels[count++] = j * 32;
   *         pixels[count++] = 255;
   *     }
   * }
   * texture.unlock();
   */
  constructor(graphicsDevice, options = {}) {
    var _options$name, _options$width, _options$height, _options$format, _options$storage, _options$cubemap, _options$fixCubemapSe, _options$flipY, _options$premultiplyA, _ref, _options$mipmaps, _options$minFilter, _options$magFilter, _options$anisotropy, _options$addressU, _options$addressV, _options$addressW, _options$compareOnRea, _options$compareFunc, _options$profilerHint;
    /**
     * The name of the texture.
     *
     * @type {string}
     */
    this.name = void 0;
    /** @ignore */
    this._gpuSize = 0;
    /** @protected */
    this.id = id++;
    /** @protected */
    this._invalid = false;
    /** @protected */
    this._lockedLevel = -1;
    /** @protected */
    this._lockedMode = TEXTURELOCK_NONE;
    /**
     * A render version used to track the last time the texture properties requiring bind group
     * to be updated were changed.
     *
     * @type {number}
     * @ignore
     */
    this.renderVersionDirty = 0;
    /** @protected */
    this._storage = false;
    this.device = graphicsDevice;
    Debug.assert(this.device, "Texture constructor requires a graphicsDevice to be valid");
    Debug.assert(!options.width || Number.isInteger(options.width), "Texture width must be an integer number, got", options);
    Debug.assert(!options.height || Number.isInteger(options.height), "Texture height must be an integer number, got", options);
    Debug.assert(!options.depth || Number.isInteger(options.depth), "Texture depth must be an integer number, got", options);
    this.name = (_options$name = options.name) != null ? _options$name : '';
    this._width = Math.floor((_options$width = options.width) != null ? _options$width : 4);
    this._height = Math.floor((_options$height = options.height) != null ? _options$height : 4);
    this._format = (_options$format = options.format) != null ? _options$format : PIXELFORMAT_RGBA8;
    this._compressed = isCompressedPixelFormat(this._format);
    this._integerFormat = isIntegerPixelFormat(this._format);
    if (this._integerFormat) {
      options.mipmaps = false;
      options.minFilter = FILTER_NEAREST;
      options.magFilter = FILTER_NEAREST;
    }
    if (graphicsDevice.supportsVolumeTextures) {
      var _options$volume, _options$depth, _options$arrayLength;
      this._volume = (_options$volume = options.volume) != null ? _options$volume : false;
      this._depth = Math.floor((_options$depth = options.depth) != null ? _options$depth : 1);
      this._arrayLength = Math.floor((_options$arrayLength = options.arrayLength) != null ? _options$arrayLength : 0);
    } else {
      this._volume = false;
      this._depth = 1;
      this._arrayLength = 0;
    }
    this._storage = (_options$storage = options.storage) != null ? _options$storage : false;
    this._cubemap = (_options$cubemap = options.cubemap) != null ? _options$cubemap : false;
    this.fixCubemapSeams = (_options$fixCubemapSe = options.fixCubemapSeams) != null ? _options$fixCubemapSe : false;
    this._flipY = (_options$flipY = options.flipY) != null ? _options$flipY : false;
    this._premultiplyAlpha = (_options$premultiplyA = options.premultiplyAlpha) != null ? _options$premultiplyA : false;
    this._mipmaps = (_ref = (_options$mipmaps = options.mipmaps) != null ? _options$mipmaps : options.autoMipmap) != null ? _ref : true;
    this._minFilter = (_options$minFilter = options.minFilter) != null ? _options$minFilter : FILTER_LINEAR_MIPMAP_LINEAR;
    this._magFilter = (_options$magFilter = options.magFilter) != null ? _options$magFilter : FILTER_LINEAR;
    this._anisotropy = (_options$anisotropy = options.anisotropy) != null ? _options$anisotropy : 1;
    this._addressU = (_options$addressU = options.addressU) != null ? _options$addressU : ADDRESS_REPEAT;
    this._addressV = (_options$addressV = options.addressV) != null ? _options$addressV : ADDRESS_REPEAT;
    this._addressW = (_options$addressW = options.addressW) != null ? _options$addressW : ADDRESS_REPEAT;
    this._compareOnRead = (_options$compareOnRea = options.compareOnRead) != null ? _options$compareOnRea : false;
    this._compareFunc = (_options$compareFunc = options.compareFunc) != null ? _options$compareFunc : FUNC_LESS;
    this.type = TEXTURETYPE_DEFAULT;
    if (options.hasOwnProperty('type')) {
      this.type = options.type;
    } else if (options.hasOwnProperty('rgbm')) {
      Debug.deprecated("options.rgbm is deprecated. Use options.type instead.");
      this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
    } else if (options.hasOwnProperty('swizzleGGGR')) {
      Debug.deprecated("options.swizzleGGGR is deprecated. Use options.type instead.");
      this.type = options.swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
    }
    this.projection = TEXTUREPROJECTION_NONE;
    if (this._cubemap) {
      this.projection = TEXTUREPROJECTION_CUBE;
    } else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
      this.projection = options.projection;
    }
    this.impl = graphicsDevice.createTextureImpl(this);
    this.profilerHint = (_options$profilerHint = options.profilerHint) != null ? _options$profilerHint : 0;
    this.dirtyAll();
    this._levels = options.levels;
    if (this._levels) {
      this.upload();
    } else {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }

    // track the texture
    graphicsDevice.textures.push(this);
    Debug.trace(TRACEID_TEXTURE_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` + `${this.cubemap ? '[Cubemap]' : ''}` + `${this.volume ? '[Volume]' : ''}` + `${this.array ? '[Array]' : ''}` + `${this.mipmaps ? '[Mipmaps]' : ''}`, this);
  }

  /**
   * Frees resources associated with this texture.
   */
  destroy() {
    Debug.trace(TRACEID_TEXTURE_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    const device = this.device;
    if (device) {
      // stop tracking the texture
      const idx = device.textures.indexOf(this);
      if (idx !== -1) {
        device.textures.splice(idx, 1);
      }

      // Remove texture from any uniforms
      device.scope.removeValue(this);

      // destroy implementation
      this.impl.destroy(device);

      // Update texture stats
      this.adjustVramSizeTracking(device._vram, -this._gpuSize);
      this._levels = null;
      this.device = null;
    }
  }

  /**
   * Resizes the texture. Only supported for render target textures, as it does not resize the
   * existing content of the texture, but only the allocated buffer for rendering into.
   *
   * @param {number} width - The new width of the texture.
   * @param {number} height - The new height of the texture.
   * @param {number} [depth] - The new depth of the texture. Defaults to 1.
   * @ignore
   */
  resize(width, height, depth = 1) {
    // destroy texture impl
    const device = this.device;
    this.adjustVramSizeTracking(device._vram, -this._gpuSize);
    this.impl.destroy(device);
    this._width = Math.floor(width);
    this._height = Math.floor(height);
    this._depth = Math.floor(depth);

    // re-create the implementation
    this.impl = device.createTextureImpl(this);
    this.dirtyAll();
  }

  /**
   * Called when the rendering context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.impl.loseContext();
    this.dirtyAll();
  }

  /**
   * Updates vram size tracking for the texture, size can be positive to add or negative to subtract
   *
   * @ignore
   */
  adjustVramSizeTracking(vram, size) {
    Debug.trace(TRACEID_VRAM_TEXTURE, `${this.id} ${this.name} size: ${size} vram.texture: ${vram.tex} => ${vram.tex + size}`);
    vram.tex += size;
    if (this.profilerHint === TEXHINT_SHADOWMAP) {
      vram.texShadow += size;
    } else if (this.profilerHint === TEXHINT_ASSET) {
      vram.texAsset += size;
    } else if (this.profilerHint === TEXHINT_LIGHTMAP) {
      vram.texLightmap += size;
    }
  }
  propertyChanged(flag) {
    this.impl.propertyChanged(flag);
    this.renderVersionDirty = this.device.renderVersion;
  }

  /**
   * Returns number of required mip levels for the texture based on its dimensions and parameters.
   *
   * @ignore
   * @type {number}
   */
  get requiredMipLevels() {
    return this.mipmaps ? TextureUtils.calcMipLevelsCount(this.width, this.height) : 1;
  }

  /**
   * Returns the current lock mode. One of:
   *
   * - {@link TEXTURELOCK_NONE}
   * - {@link TEXTURELOCK_READ}
   * - {@link TEXTURELOCK_WRITE}
   *
   * @ignore
   * @type {number}
   */
  get lockedMode() {
    return this._lockedMode;
  }

  /**
   * The minification filter to be applied to the texture. Can be:
   *
   * - {@link FILTER_NEAREST}
   * - {@link FILTER_LINEAR}
   * - {@link FILTER_NEAREST_MIPMAP_NEAREST}
   * - {@link FILTER_NEAREST_MIPMAP_LINEAR}
   * - {@link FILTER_LINEAR_MIPMAP_NEAREST}
   * - {@link FILTER_LINEAR_MIPMAP_LINEAR}
   *
   * @type {number}
   */
  set minFilter(v) {
    if (this._minFilter !== v) {
      if (isIntegerPixelFormat(this._format)) {
        Debug.warn("Texture#minFilter: minFilter property cannot be changed on an integer texture, will remain FILTER_NEAREST", this);
      } else {
        this._minFilter = v;
        this.propertyChanged(1);
      }
    }
  }
  get minFilter() {
    return this._minFilter;
  }

  /**
   * The magnification filter to be applied to the texture. Can be:
   *
   * - {@link FILTER_NEAREST}
   * - {@link FILTER_LINEAR}
   *
   * @type {number}
   */
  set magFilter(v) {
    if (this._magFilter !== v) {
      if (isIntegerPixelFormat(this._format)) {
        Debug.warn("Texture#magFilter: magFilter property cannot be changed on an integer texture, will remain FILTER_NEAREST", this);
      } else {
        this._magFilter = v;
        this.propertyChanged(2);
      }
    }
  }
  get magFilter() {
    return this._magFilter;
  }

  /**
   * The addressing mode to be applied to the texture horizontally. Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressU(v) {
    if (this._addressU !== v) {
      this._addressU = v;
      this.propertyChanged(4);
    }
  }
  get addressU() {
    return this._addressU;
  }

  /**
   * The addressing mode to be applied to the texture vertically. Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressV(v) {
    if (this._addressV !== v) {
      this._addressV = v;
      this.propertyChanged(8);
    }
  }
  get addressV() {
    return this._addressV;
  }

  /**
   * The addressing mode to be applied to the 3D texture depth (not supported on WebGL1). Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressW(addressW) {
    if (!this.device.supportsVolumeTextures) return;
    if (!this._volume) {
      Debug.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
      return;
    }
    if (addressW !== this._addressW) {
      this._addressW = addressW;
      this.propertyChanged(16);
    }
  }
  get addressW() {
    return this._addressW;
  }

  /**
   * When enabled, and if texture format is {@link PIXELFORMAT_DEPTH} or
   * {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for this texture, and you can get
   * filtered results of comparison using texture() in your shader (not supported on WebGL1).
   *
   * @type {boolean}
   */
  set compareOnRead(v) {
    if (this._compareOnRead !== v) {
      this._compareOnRead = v;
      this.propertyChanged(32);
    }
  }
  get compareOnRead() {
    return this._compareOnRead;
  }

  /**
   * Comparison function when compareOnRead is enabled (not supported on WebGL1). Possible values:
   *
   * - {@link FUNC_LESS}
   * - {@link FUNC_LESSEQUAL}
   * - {@link FUNC_GREATER}
   * - {@link FUNC_GREATEREQUAL}
   * - {@link FUNC_EQUAL}
   * - {@link FUNC_NOTEQUAL}
   *
   * @type {number}
   */
  set compareFunc(v) {
    if (this._compareFunc !== v) {
      this._compareFunc = v;
      this.propertyChanged(64);
    }
  }
  get compareFunc() {
    return this._compareFunc;
  }

  /**
   * Integer value specifying the level of anisotropic to apply to the texture ranging from 1 (no
   * anisotropic filtering) to the {@link GraphicsDevice} property maxAnisotropy.
   *
   * @type {number}
   */
  set anisotropy(v) {
    if (this._anisotropy !== v) {
      this._anisotropy = v;
      this.propertyChanged(128);
    }
  }
  get anisotropy() {
    return this._anisotropy;
  }

  /**
   * Defines if texture should generate/upload mipmaps if possible.
   *
   * @type {boolean}
   */
  set mipmaps(v) {
    if (this._mipmaps !== v) {
      if (this.device.isWebGPU) {
        Debug.warn("Texture#mipmaps: mipmap property is currently not allowed to be changed on WebGPU, create the texture appropriately.", this);
      } else if (isIntegerPixelFormat(this._format)) {
        Debug.warn("Texture#mipmaps: mipmap property cannot be changed on an integer texture, will remain false", this);
      } else {
        this._mipmaps = v;
      }
      if (v) this._needsMipmapsUpload = true;
    }
  }
  get mipmaps() {
    return this._mipmaps;
  }

  /**
   * Defines if texture can be used as a storage texture by a compute shader.
   *
   * @type {boolean}
   */
  get storage() {
    return this._storage;
  }

  /**
   * The width of the texture in pixels.
   *
   * @type {number}
   */
  get width() {
    return this._width;
  }

  /**
   * The height of the texture in pixels.
   *
   * @type {number}
   */
  get height() {
    return this._height;
  }

  /**
   * The number of depth slices in a 3D texture.
   *
   * @type {number}
   */
  get depth() {
    return this._depth;
  }

  /**
   * The pixel format of the texture. Can be:
   *
   * - {@link PIXELFORMAT_A8}
   * - {@link PIXELFORMAT_L8}
   * - {@link PIXELFORMAT_LA8}
   * - {@link PIXELFORMAT_RGB565}
   * - {@link PIXELFORMAT_RGBA5551}
   * - {@link PIXELFORMAT_RGBA4}
   * - {@link PIXELFORMAT_RGB8}
   * - {@link PIXELFORMAT_RGBA8}
   * - {@link PIXELFORMAT_DXT1}
   * - {@link PIXELFORMAT_DXT3}
   * - {@link PIXELFORMAT_DXT5}
   * - {@link PIXELFORMAT_RGB16F}
   * - {@link PIXELFORMAT_RGBA16F}
   * - {@link PIXELFORMAT_RGB32F}
   * - {@link PIXELFORMAT_RGBA32F}
   * - {@link PIXELFORMAT_ETC1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
   * - {@link PIXELFORMAT_111110F}
   * - {@link PIXELFORMAT_ASTC_4x4}>/li>
   * - {@link PIXELFORMAT_ATC_RGB}
   * - {@link PIXELFORMAT_ATC_RGBA}
   *
   * @type {number}
   */
  get format() {
    return this._format;
  }

  /**
   * Returns true if this texture is a cube map and false otherwise.
   *
   * @type {boolean}
   */
  get cubemap() {
    return this._cubemap;
  }
  get gpuSize() {
    const mips = this.pot && this._mipmaps && !(this._compressed && this._levels.length === 1);
    return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
  }

  /**
   * Returns true if this texture is a 2D texture array and false otherwise.
   *
   * @type {boolean}
   */
  get array() {
    return this._arrayLength > 0;
  }

  /**
   * Returns the number of textures inside this texture if this is a 2D array texture or 0 otherwise.
   *
   * @type {number}
   */
  get arrayLength() {
    return this._arrayLength;
  }

  /**
   * Returns true if this texture is a 3D volume and false otherwise.
   *
   * @type {boolean}
   */
  get volume() {
    return this._volume;
  }

  /**
   * Specifies whether the texture should be flipped in the Y-direction. Only affects textures
   * with a source that is an image, canvas or video element. Does not affect cubemaps,
   * compressed textures or textures set from raw pixel data. Defaults to true.
   *
   * @type {boolean}
   */
  set flipY(flipY) {
    if (this._flipY !== flipY) {
      this._flipY = flipY;
      this._needsUpload = true;
    }
  }
  get flipY() {
    return this._flipY;
  }
  set premultiplyAlpha(premultiplyAlpha) {
    if (this._premultiplyAlpha !== premultiplyAlpha) {
      this._premultiplyAlpha = premultiplyAlpha;
      this._needsUpload = true;
    }
  }
  get premultiplyAlpha() {
    return this._premultiplyAlpha;
  }

  /**
   * Returns true if all dimensions of the texture are power of two, and false otherwise.
   *
   * @type {boolean}
   */
  get pot() {
    return math.powerOfTwo(this._width) && math.powerOfTwo(this._height);
  }

  // get the texture's encoding type
  get encoding() {
    switch (this.type) {
      case TEXTURETYPE_RGBM:
        return 'rgbm';
      case TEXTURETYPE_RGBE:
        return 'rgbe';
      case TEXTURETYPE_RGBP:
        return 'rgbp';
      default:
        return this.format === PIXELFORMAT_RGB16F || this.format === PIXELFORMAT_RGB32F || this.format === PIXELFORMAT_RGBA16F || this.format === PIXELFORMAT_RGBA32F || isIntegerPixelFormat(this.format) ? 'linear' : 'srgb';
    }
  }

  // Force a full resubmission of the texture to the GPU (used on a context restore event)
  dirtyAll() {
    this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    this._mipmapsUploaded = false;
    this.propertyChanged(255); // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
  }

  /**
   * Locks a miplevel of the texture, returning a typed array to be filled with pixel data.
   *
   * @param {object} [options] - Optional options object. Valid properties are as follows:
   * @param {number} [options.level] - The mip level to lock with 0 being the top level. Defaults
   * to 0.
   * @param {number} [options.face] - If the texture is a cubemap, this is the index of the face
   * to lock.
   * @param {number} [options.mode] - The lock mode. Can be:
   * - {@link TEXTURELOCK_READ}
   * - {@link TEXTURELOCK_WRITE}
   * Defaults to {@link TEXTURELOCK_WRITE}.
   * @returns {Uint8Array|Uint16Array|Float32Array} A typed array containing the pixel data of
   * the locked mip level.
   */
  lock(options = {}) {
    var _options$level, _options$face, _options$mode;
    // Initialize options to some sensible defaults
    (_options$level = options.level) != null ? _options$level : options.level = 0;
    (_options$face = options.face) != null ? _options$face : options.face = 0;
    (_options$mode = options.mode) != null ? _options$mode : options.mode = TEXTURELOCK_WRITE;
    Debug.assert(this._lockedMode === TEXTURELOCK_NONE, 'The texture is already locked. Call `texture.unlock()` before attempting to lock again.', this);
    Debug.assert(options.mode === TEXTURELOCK_READ || options.mode === TEXTURELOCK_WRITE, 'Cannot lock a texture with TEXTURELOCK_NONE. To unlock a texture, call `texture.unlock()`.', this);
    this._lockedMode = options.mode;
    this._lockedLevel = options.level;
    const levels = this.cubemap ? this._levels[options.face] : this._levels;
    if (levels[options.level] === null) {
      // allocate storage for this mip level
      const width = Math.max(1, this._width >> options.level);
      const height = Math.max(1, this._height >> options.level);
      const depth = Math.max(1, this._depth >> options.level);
      const data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, depth, this._format));
      levels[options.level] = new (getPixelFormatArrayType(this._format))(data);
    }
    return levels[options.level];
  }

  /**
   * Set the pixel data of the texture from a canvas, image, video DOM element. If the texture is
   * a cubemap, the supplied source must be an array of 6 canvases, images or videos.
   *
   * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement|HTMLCanvasElement[]|HTMLImageElement[]|HTMLVideoElement[]} source - A
   * canvas, image or video element, or an array of 6 canvas, image or video elements.
   * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
   * Defaults to 0, which represents the base image source. A level value of N, that is greater
   * than 0, represents the image source for the Nth mipmap reduction level.
   */
  setSource(source, mipLevel = 0) {
    let invalid = false;
    let width, height;
    if (this._cubemap) {
      if (source[0]) {
        // rely on first face sizes
        width = source[0].width || 0;
        height = source[0].height || 0;
        for (let i = 0; i < 6; i++) {
          const face = source[i];
          // cubemap becomes invalid if any condition is not satisfied
          if (!face ||
          // face is missing
          face.width !== width ||
          // face is different width
          face.height !== height ||
          // face is different height
          !this.device._isBrowserInterface(face)) {
            // new image bitmap
            invalid = true;
            break;
          }
        }
      } else {
        // first face is missing
        invalid = true;
      }
      if (!invalid) {
        // mark levels as updated
        for (let i = 0; i < 6; i++) {
          if (this._levels[mipLevel][i] !== source[i]) this._levelsUpdated[mipLevel][i] = true;
        }
      }
    } else {
      // check if source is valid type of element
      if (!this.device._isBrowserInterface(source)) invalid = true;
      if (!invalid) {
        // mark level as updated
        if (source !== this._levels[mipLevel]) this._levelsUpdated[mipLevel] = true;
        width = source.width;
        height = source.height;
      }
    }
    if (invalid) {
      // invalid texture

      // default sizes
      this._width = 4;
      this._height = 4;

      // remove levels
      if (this._cubemap) {
        for (let i = 0; i < 6; i++) {
          this._levels[mipLevel][i] = null;
          this._levelsUpdated[mipLevel][i] = true;
        }
      } else {
        this._levels[mipLevel] = null;
        this._levelsUpdated[mipLevel] = true;
      }
    } else {
      // valid texture
      if (mipLevel === 0) {
        this._width = width;
        this._height = height;
      }
      this._levels[mipLevel] = source;
    }

    // valid or changed state of validity
    if (this._invalid !== invalid || !invalid) {
      this._invalid = invalid;

      // reupload
      this.upload();
    }
  }

  /**
   * Get the pixel data of the texture. If this is a cubemap then an array of 6 images will be
   * returned otherwise a single image.
   *
   * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
   * Defaults to 0, which represents the base image source. A level value of N, that is greater
   * than 0, represents the image source for the Nth mipmap reduction level.
   * @returns {HTMLImageElement} The source image of this texture. Can be null if source not
   * assigned for specific image level.
   */
  getSource(mipLevel = 0) {
    return this._levels[mipLevel];
  }

  /**
   * Unlocks the currently locked mip level and uploads it to VRAM.
   */
  unlock() {
    if (this._lockedMode === TEXTURELOCK_NONE) {
      Debug.warn("pc.Texture#unlock: Attempting to unlock a texture that is not locked.", this);
    }

    // Upload the new pixel data if locked in write mode (default)
    if (this._lockedMode === TEXTURELOCK_WRITE) {
      this.upload();
    }
    this._lockedLevel = -1;
    this._lockedMode = TEXTURELOCK_NONE;
  }

  /**
   * Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
   * is called by internally by {@link Texture#setSource} and {@link Texture#unlock}. However, it
   * still needs to be called explicitly in the case where an HTMLVideoElement is set as the
   * source of the texture.  Normally, this is done once every frame before video textured
   * geometry is rendered.
   */
  upload() {
    var _this$impl$uploadImme, _this$impl;
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    (_this$impl$uploadImme = (_this$impl = this.impl).uploadImmediate) == null || _this$impl$uploadImme.call(_this$impl, this.device, this);
  }

  /**
   * Download texture's top level data from graphics memory to local memory.
   *
   * @ignore
   */
  async downloadAsync() {
    const promises = [];
    for (let i = 0; i < (this.cubemap ? 6 : 1); i++) {
      var _this$device$readPixe, _this$device;
      const renderTarget = new RenderTarget({
        colorBuffer: this,
        depth: false,
        face: i
      });
      this.device.setRenderTarget(renderTarget);
      this.device.initRenderTarget(renderTarget);
      const levels = this.cubemap ? this._levels[i] : this._levels;
      let level = levels[0];
      if (levels[0] && this.device._isBrowserInterface(levels[0])) {
        levels[0] = null;
      }
      level = this.lock({
        face: i
      });
      const promise = (_this$device$readPixe = (_this$device = this.device).readPixelsAsync) == null ? void 0 : _this$device$readPixe.call(_this$device, 0, 0, this.width, this.height, level).then(() => renderTarget.destroy());
      promises.push(promise);
    }
    await Promise.all(promises);
  }
}

export { Texture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZVV0aWxzIH0gZnJvbSAnLi90ZXh0dXJlLXV0aWxzLmpzJztcbmltcG9ydCB7XG4gICAgaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQsXG4gICAgZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUsXG4gICAgQUREUkVTU19SRVBFQVQsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfTEVTUyxcbiAgICBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQSVhFTEZPUk1BVF9SR0IxNkYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQjMyRiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSLFxuICAgIGlzSW50ZWdlclBpeGVsRm9ybWF0LCBGSUxURVJfTkVBUkVTVCwgVEVYVFVSRUxPQ0tfTk9ORSwgVEVYVFVSRUxPQ0tfUkVBRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB0ZXh0dXJlIGlzIGEgY29udGFpbmVyIGZvciB0ZXhlbCBkYXRhIHRoYXQgY2FuIGJlIHV0aWxpemVkIGluIGEgZnJhZ21lbnQgc2hhZGVyLiBUeXBpY2FsbHksXG4gKiB0aGUgdGV4ZWwgZGF0YSByZXByZXNlbnRzIGFuIGltYWdlIHRoYXQgaXMgbWFwcGVkIG92ZXIgZ2VvbWV0cnkuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIFRleHR1cmUge1xuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBuYW1lO1xuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBfZ3B1U2l6ZSA9IDA7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIGlkID0gaWQrKztcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgX2ludmFsaWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgX2xvY2tlZExldmVsID0gLTE7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIF9sb2NrZWRNb2RlID0gVEVYVFVSRUxPQ0tfTk9ORTtcblxuICAgIC8qKlxuICAgICAqIEEgcmVuZGVyIHZlcnNpb24gdXNlZCB0byB0cmFjayB0aGUgbGFzdCB0aW1lIHRoZSB0ZXh0dXJlIHByb3BlcnRpZXMgcmVxdWlyaW5nIGJpbmQgZ3JvdXBcbiAgICAgKiB0byBiZSB1cGRhdGVkIHdlcmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlclZlcnNpb25EaXJ0eSA9IDA7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIF9zdG9yYWdlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVGV4dHVyZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2VcbiAgICAgKiB1c2VkIHRvIG1hbmFnZSB0aGlzIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCBmb3IgcGFzc2luZyBvcHRpb25hbCBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHRleHR1cmUuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLndpZHRoXSAtIFRoZSB3aWR0aCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmhlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gNC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZGVwdGhdIC0gVGhlIG51bWJlciBvZiBkZXB0aCBzbGljZXMgaW4gYSAzRCB0ZXh0dXJlIChub3Qgc3VwcG9ydGVkIGJ5IFdlYkdsMSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZvcm1hdF0gLSBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucHJvamVjdGlvbl0gLSBUaGUgcHJvamVjdGlvbiB0eXBlIG9mIHRoZSB0ZXh0dXJlLCB1c2VkIHdoZW4gdGhlXG4gICAgICogdGV4dHVyZSByZXByZXNlbnRzIGFuIGVudmlyb25tZW50LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1R9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfSBpZiBvcHRpb25zLmN1YmVtYXAgaXMgdHJ1ZSwgb3RoZXJ3aXNlXG4gICAgICoge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5GaWx0ZXJdIC0gVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1hZ0ZpbHRlcl0gLSBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hbmlzb3Ryb3B5XSAtIFRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcgdG8gdXNlLiBEZWZhdWx0c1xuICAgICAqIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NVXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFUgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NWXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFYgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NXXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFcgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5taXBtYXBzXSAtIFdoZW4gZW5hYmxlZCB0cnkgdG8gZ2VuZXJhdGUgb3IgdXNlIG1pcG1hcHMgZm9yIHRoaXNcbiAgICAgKiB0ZXh0dXJlLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jdWJlbWFwXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgY3ViZW1hcC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYXJyYXlMZW5ndGhdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgaXMgdG8gYmUgYSAyRCB0ZXh0dXJlIGFycmF5LlxuICAgICAqIFdoZW4gcGFzc2VkIGluIGFzIHVuZGVmaW5lZCBvciA8IDEsIHRoaXMgaXMgbm90IGFuIGFycmF5IHRleHR1cmUuIElmID49IDEsIHRoaXMgaXMgYW4gYXJyYXkgdGV4dHVyZS5cbiAgICAgKiAobm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLiBEZWZhdWx0cyB0byB1bmRlZmluZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy52b2x1bWVdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgaXMgdG8gYmUgYSAzRCB2b2x1bWVcbiAgICAgKiAobm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudHlwZV0gLSBTcGVjaWZpZXMgdGhlIHRleHR1cmUgdHlwZS4gIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVUWVBFX0RFRkFVTFR9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfUkdCTX1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFVFlQRV9SR0JFfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVUWVBFX1JHQlB9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1J9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRVRZUEVfREVGQVVMVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5maXhDdWJlbWFwU2VhbXNdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhpcyBjdWJlbWFwIHRleHR1cmUgcmVxdWlyZXNcbiAgICAgKiBzcGVjaWFsIHNlYW0gZml4aW5nIHNoYWRlciBjb2RlIHRvIGxvb2sgcmlnaHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZmxpcFldIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlXG4gICAgICogWS1kaXJlY3Rpb24uIE9ubHkgYWZmZWN0cyB0ZXh0dXJlcyB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LlxuICAgICAqIERvZXMgbm90IGFmZmVjdCBjdWJlbWFwcywgY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHNcbiAgICAgKiB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGx5QWxwaGFdIC0gSWYgdHJ1ZSwgdGhlIGFscGhhIGNoYW5uZWwgb2YgdGhlIHRleHR1cmUgKGlmXG4gICAgICogcHJlc2VudCkgaXMgbXVsdGlwbGllZCBpbnRvIHRoZSBjb2xvciBjaGFubmVscy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jb21wYXJlT25SZWFkXSAtIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvciB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yXG4gICAgICogdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXQgZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlclxuICAgICAqIChub3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jb21wYXJlRnVuY10gLSBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkXG4gICAgICogKG5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgRlVOQ19MRVNTfS5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXlbXXxIVE1MQ2FudmFzRWxlbWVudFtdfEhUTUxJbWFnZUVsZW1lbnRbXXxIVE1MVmlkZW9FbGVtZW50W118VWludDhBcnJheVtdW119IFtvcHRpb25zLmxldmVsc11cbiAgICAgKiAtIEFycmF5IG9mIFVpbnQ4QXJyYXkgb3Igb3RoZXIgc3VwcG9ydGVkIGJyb3dzZXIgaW50ZXJmYWNlOyBvciBhIHR3by1kaW1lbnNpb25hbCBhcnJheVxuICAgICAqIG9mIFVpbnQ4QXJyYXkgaWYgb3B0aW9ucy5hcnJheUxlbmd0aCBpcyBkZWZpbmVkIGFuZCBncmVhdGVyIHRoYW4gemVyby5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0b3JhZ2VdIC0gRGVmaW5lcyBpZiB0ZXh0dXJlIGNhbiBiZSB1c2VkIGFzIGEgc3RvcmFnZSB0ZXh0dXJlIGJ5XG4gICAgICogYSBjb21wdXRlIHNoYWRlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA4eDh4MjQtYml0IHRleHR1cmVcbiAgICAgKiBjb25zdCB0ZXh0dXJlID0gbmV3IHBjLlRleHR1cmUoZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgKiAgICAgd2lkdGg6IDgsXG4gICAgICogICAgIGhlaWdodDogOCxcbiAgICAgKiAgICAgZm9ybWF0OiBwYy5QSVhFTEZPUk1BVF9SR0I4XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBGaWxsIHRoZSB0ZXh0dXJlIHdpdGggYSBncmFkaWVudFxuICAgICAqIGNvbnN0IHBpeGVscyA9IHRleHR1cmUubG9jaygpO1xuICAgICAqIGNvbnN0IGNvdW50ID0gMDtcbiAgICAgKiBmb3IgKGxldCBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAqICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaSAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaiAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gMjU1O1xuICAgICAqICAgICB9XG4gICAgICogfVxuICAgICAqIHRleHR1cmUudW5sb2NrKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5kZXZpY2UsIFwiVGV4dHVyZSBjb25zdHJ1Y3RvciByZXF1aXJlcyBhIGdyYXBoaWNzRGV2aWNlIHRvIGJlIHZhbGlkXCIpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoIW9wdGlvbnMud2lkdGggfHwgTnVtYmVyLmlzSW50ZWdlcihvcHRpb25zLndpZHRoKSwgXCJUZXh0dXJlIHdpZHRoIG11c3QgYmUgYW4gaW50ZWdlciBudW1iZXIsIGdvdFwiLCBvcHRpb25zKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCFvcHRpb25zLmhlaWdodCB8fCBOdW1iZXIuaXNJbnRlZ2VyKG9wdGlvbnMuaGVpZ2h0KSwgXCJUZXh0dXJlIGhlaWdodCBtdXN0IGJlIGFuIGludGVnZXIgbnVtYmVyLCBnb3RcIiwgb3B0aW9ucyk7XG4gICAgICAgIERlYnVnLmFzc2VydCghb3B0aW9ucy5kZXB0aCB8fCBOdW1iZXIuaXNJbnRlZ2VyKG9wdGlvbnMuZGVwdGgpLCBcIlRleHR1cmUgZGVwdGggbXVzdCBiZSBhbiBpbnRlZ2VyIG51bWJlciwgZ290XCIsIG9wdGlvbnMpO1xuXG4gICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZSA/PyAnJztcblxuICAgICAgICB0aGlzLl93aWR0aCA9IE1hdGguZmxvb3Iob3B0aW9ucy53aWR0aCA/PyA0KTtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gTWF0aC5mbG9vcihvcHRpb25zLmhlaWdodCA/PyA0KTtcblxuICAgICAgICB0aGlzLl9mb3JtYXQgPSBvcHRpb25zLmZvcm1hdCA/PyBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgdGhpcy5fY29tcHJlc3NlZCA9IGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0KHRoaXMuX2Zvcm1hdCk7XG4gICAgICAgIHRoaXMuX2ludGVnZXJGb3JtYXQgPSBpc0ludGVnZXJQaXhlbEZvcm1hdCh0aGlzLl9mb3JtYXQpO1xuICAgICAgICBpZiAodGhpcy5faW50ZWdlckZvcm1hdCkge1xuICAgICAgICAgICAgb3B0aW9ucy5taXBtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICBvcHRpb25zLm1pbkZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgICAgICAgICAgb3B0aW9ucy5tYWdGaWx0ZXIgPSBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChncmFwaGljc0RldmljZS5zdXBwb3J0c1ZvbHVtZVRleHR1cmVzKSB7XG4gICAgICAgICAgICB0aGlzLl92b2x1bWUgPSBvcHRpb25zLnZvbHVtZSA/PyBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gTWF0aC5mbG9vcihvcHRpb25zLmRlcHRoID8/IDEpO1xuICAgICAgICAgICAgdGhpcy5fYXJyYXlMZW5ndGggPSBNYXRoLmZsb29yKG9wdGlvbnMuYXJyYXlMZW5ndGggPz8gMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92b2x1bWUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gMTtcbiAgICAgICAgICAgIHRoaXMuX2FycmF5TGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0b3JhZ2UgPSBvcHRpb25zLnN0b3JhZ2UgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuX2N1YmVtYXAgPSBvcHRpb25zLmN1YmVtYXAgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuZml4Q3ViZW1hcFNlYW1zID0gb3B0aW9ucy5maXhDdWJlbWFwU2VhbXMgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZsaXBZID0gb3B0aW9ucy5mbGlwWSA/PyBmYWxzZTtcbiAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSA/PyBmYWxzZTtcblxuICAgICAgICB0aGlzLl9taXBtYXBzID0gb3B0aW9ucy5taXBtYXBzID8/IG9wdGlvbnMuYXV0b01pcG1hcCA/PyB0cnVlO1xuICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSBvcHRpb25zLm1pbkZpbHRlciA/PyBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI7XG4gICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IG9wdGlvbnMubWFnRmlsdGVyID8/IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSBvcHRpb25zLmFuaXNvdHJvcHkgPz8gMTtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSBvcHRpb25zLmFkZHJlc3NVID8/IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzViA9IG9wdGlvbnMuYWRkcmVzc1YgPz8gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NXID0gb3B0aW9ucy5hZGRyZXNzVyA/PyBBRERSRVNTX1JFUEVBVDtcblxuICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gb3B0aW9ucy5jb21wYXJlT25SZWFkID8/IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IG9wdGlvbnMuY29tcGFyZUZ1bmMgPz8gRlVOQ19MRVNTO1xuXG4gICAgICAgIHRoaXMudHlwZSA9IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdyZ2JtJykpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnJnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMucmdibSA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3N3aXp6bGVHR0dSJykpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnN3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fTk9ORTtcbiAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wcm9qZWN0aW9uICYmIG9wdGlvbnMucHJvamVjdGlvbiAhPT0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSkge1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gb3B0aW9ucy5wcm9qZWN0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbXBsID0gZ3JhcGhpY3NEZXZpY2UuY3JlYXRlVGV4dHVyZUltcGwodGhpcyk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IG9wdGlvbnMucHJvZmlsZXJIaW50ID8/IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuZGlydHlBbGwoKTtcblxuICAgICAgICB0aGlzLl9sZXZlbHMgPSBvcHRpb25zLmxldmVscztcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscykge1xuICAgICAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IHRoaXMuX2N1YmVtYXAgPyBbW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdXSA6IFtudWxsXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyYWNrIHRoZSB0ZXh0dXJlXG4gICAgICAgIGdyYXBoaWNzRGV2aWNlLnRleHR1cmVzLnB1c2godGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9OiAke3RoaXMud2lkdGh9eCR7dGhpcy5oZWlnaHR9IGAgK1xuICAgICAgICAgICAgYCR7dGhpcy5jdWJlbWFwID8gJ1tDdWJlbWFwXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMudm9sdW1lID8gJ1tWb2x1bWVdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5hcnJheSA/ICdbQXJyYXldJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5taXBtYXBzID8gJ1tNaXBtYXBzXScgOiAnJ31gLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgIC8vIHN0b3AgdHJhY2tpbmcgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGRldmljZS50ZXh0dXJlcy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UudGV4dHVyZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSB0ZXh0dXJlIGZyb20gYW55IHVuaWZvcm1zXG4gICAgICAgICAgICBkZXZpY2Uuc2NvcGUucmVtb3ZlVmFsdWUodGhpcyk7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0ZXh0dXJlIHN0YXRzXG4gICAgICAgICAgICB0aGlzLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGhpcy5fZ3B1U2l6ZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNpemVzIHRoZSB0ZXh0dXJlLiBPbmx5IHN1cHBvcnRlZCBmb3IgcmVuZGVyIHRhcmdldCB0ZXh0dXJlcywgYXMgaXQgZG9lcyBub3QgcmVzaXplIHRoZVxuICAgICAqIGV4aXN0aW5nIGNvbnRlbnQgb2YgdGhlIHRleHR1cmUsIGJ1dCBvbmx5IHRoZSBhbGxvY2F0ZWQgYnVmZmVyIGZvciByZW5kZXJpbmcgaW50by5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSBuZXcgd2lkdGggb2YgdGhlIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGVwdGhdIC0gVGhlIG5ldyBkZXB0aCBvZiB0aGUgdGV4dHVyZS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzaXplKHdpZHRoLCBoZWlnaHQsIGRlcHRoID0gMSkge1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgdGV4dHVyZSBpbXBsXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICB0aGlzLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGhpcy5fZ3B1U2l6ZSk7XG4gICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBNYXRoLmZsb29yKHdpZHRoKTtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gTWF0aC5mbG9vcihoZWlnaHQpO1xuICAgICAgICB0aGlzLl9kZXB0aCA9IE1hdGguZmxvb3IoZGVwdGgpO1xuXG4gICAgICAgIC8vIHJlLWNyZWF0ZSB0aGUgaW1wbGVtZW50YXRpb25cbiAgICAgICAgdGhpcy5pbXBsID0gZGV2aWNlLmNyZWF0ZVRleHR1cmVJbXBsKHRoaXMpO1xuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHJlbmRlcmluZyBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHRoaXMuZGlydHlBbGwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHZyYW0gc2l6ZSB0cmFja2luZyBmb3IgdGhlIHRleHR1cmUsIHNpemUgY2FuIGJlIHBvc2l0aXZlIHRvIGFkZCBvciBuZWdhdGl2ZSB0byBzdWJ0cmFjdFxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkanVzdFZyYW1TaXplVHJhY2tpbmcodnJhbSwgc2l6ZSkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVlJBTV9URVhUVVJFLCBgJHt0aGlzLmlkfSAke3RoaXMubmFtZX0gc2l6ZTogJHtzaXplfSB2cmFtLnRleHR1cmU6ICR7dnJhbS50ZXh9ID0+ICR7dnJhbS50ZXggKyBzaXplfWApO1xuXG4gICAgICAgIHZyYW0udGV4ICs9IHNpemU7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfU0hBRE9XTUFQKSB7XG4gICAgICAgICAgICB2cmFtLnRleFNoYWRvdyArPSBzaXplO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX0FTU0VUKSB7XG4gICAgICAgICAgICB2cmFtLnRleEFzc2V0ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfTElHSFRNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4TGlnaHRtYXAgKz0gc2l6ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBwcm9wZXJ0eUNoYW5nZWQoZmxhZykge1xuICAgICAgICB0aGlzLmltcGwucHJvcGVydHlDaGFuZ2VkKGZsYWcpO1xuICAgICAgICB0aGlzLnJlbmRlclZlcnNpb25EaXJ0eSA9IHRoaXMuZGV2aWNlLnJlbmRlclZlcnNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBudW1iZXIgb2YgcmVxdWlyZWQgbWlwIGxldmVscyBmb3IgdGhlIHRleHR1cmUgYmFzZWQgb24gaXRzIGRpbWVuc2lvbnMgYW5kIHBhcmFtZXRlcnMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgcmVxdWlyZWRNaXBMZXZlbHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pcG1hcHMgPyBUZXh0dXJlVXRpbHMuY2FsY01pcExldmVsc0NvdW50KHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KSA6IDE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY3VycmVudCBsb2NrIG1vZGUuIE9uZSBvZjpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVMT0NLX05PTkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfUkVBRH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19XUklURX1cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBsb2NrZWRNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9ja2VkTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWluaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtaW5GaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWluRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICBpZiAoaXNJbnRlZ2VyUGl4ZWxGb3JtYXQodGhpcy5fZm9ybWF0KSkge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJUZXh0dXJlI21pbkZpbHRlcjogbWluRmlsdGVyIHByb3BlcnR5IGNhbm5vdCBiZSBjaGFuZ2VkIG9uIGFuIGludGVnZXIgdGV4dHVyZSwgd2lsbCByZW1haW4gRklMVEVSX05FQVJFU1RcIiwgdGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IHY7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWluRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYWduaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFnRmlsdGVyKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hZ0ZpbHRlciAhPT0gdikge1xuICAgICAgICAgICAgaWYgKGlzSW50ZWdlclBpeGVsRm9ybWF0KHRoaXMuX2Zvcm1hdCkpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiVGV4dHVyZSNtYWdGaWx0ZXI6IG1hZ0ZpbHRlciBwcm9wZXJ0eSBjYW5ub3QgYmUgY2hhbmdlZCBvbiBhbiBpbnRlZ2VyIHRleHR1cmUsIHdpbGwgcmVtYWluIEZJTFRFUl9ORUFSRVNUXCIsIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSB2O1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hZ0ZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hZ0ZpbHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgaG9yaXpvbnRhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzVSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSB2O1xuICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoNCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgdmVydGljYWxseS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1Yodikge1xuICAgICAgICBpZiAodGhpcy5fYWRkcmVzc1YgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NWID0gdjtcbiAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NWKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1Y7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSAzRCB0ZXh0dXJlIGRlcHRoIChub3Qgc3VwcG9ydGVkIG9uIFdlYkdMMSkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NXKGFkZHJlc3NXKSB7XG4gICAgICAgIGlmICghdGhpcy5kZXZpY2Uuc3VwcG9ydHNWb2x1bWVUZXh0dXJlcykgcmV0dXJuO1xuICAgICAgICBpZiAoIXRoaXMuX3ZvbHVtZSkge1xuICAgICAgICAgICAgRGVidWcud2FybihcInBjLlRleHR1cmUjYWRkcmVzc1c6IENhbid0IHNldCBXIGFkZHJlc3NpbmcgbW9kZSBmb3IgYSBub24tM0QgdGV4dHVyZS5cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFkZHJlc3NXICE9PSB0aGlzLl9hZGRyZXNzVykge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1cgPSBhZGRyZXNzVztcbiAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDE2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NXO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3JcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yIHRoaXMgdGV4dHVyZSwgYW5kIHlvdSBjYW4gZ2V0XG4gICAgICogZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlciAobm90IHN1cHBvcnRlZCBvbiBXZWJHTDEpLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVPblJlYWQodikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZU9uUmVhZCAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IHY7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Q2hhbmdlZCgzMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZU9uUmVhZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVPblJlYWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGFyaXNvbiBmdW5jdGlvbiB3aGVuIGNvbXBhcmVPblJlYWQgaXMgZW5hYmxlZCAobm90IHN1cHBvcnRlZCBvbiBXZWJHTDEpLiBQb3NzaWJsZSB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVGdW5jKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBhcmVGdW5jICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IHY7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Q2hhbmdlZCg2NCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZUZ1bmMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlRnVuYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlZ2VyIHZhbHVlIHNwZWNpZnlpbmcgdGhlIGxldmVsIG9mIGFuaXNvdHJvcGljIHRvIGFwcGx5IHRvIHRoZSB0ZXh0dXJlIHJhbmdpbmcgZnJvbSAxIChub1xuICAgICAqIGFuaXNvdHJvcGljIGZpbHRlcmluZykgdG8gdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gcHJvcGVydHkgbWF4QW5pc290cm9weS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuaXNvdHJvcHkodikge1xuICAgICAgICBpZiAodGhpcy5fYW5pc290cm9weSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IHY7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Q2hhbmdlZCgxMjgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuaXNvdHJvcHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmlzb3Ryb3B5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYgdGV4dHVyZSBzaG91bGQgZ2VuZXJhdGUvdXBsb2FkIG1pcG1hcHMgaWYgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbWlwbWFwcyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taXBtYXBzICE9PSB2KSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRldmljZS5pc1dlYkdQVSkge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJUZXh0dXJlI21pcG1hcHM6IG1pcG1hcCBwcm9wZXJ0eSBpcyBjdXJyZW50bHkgbm90IGFsbG93ZWQgdG8gYmUgY2hhbmdlZCBvbiBXZWJHUFUsIGNyZWF0ZSB0aGUgdGV4dHVyZSBhcHByb3ByaWF0ZWx5LlwiLCB0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNJbnRlZ2VyUGl4ZWxGb3JtYXQodGhpcy5fZm9ybWF0KSkge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJUZXh0dXJlI21pcG1hcHM6IG1pcG1hcCBwcm9wZXJ0eSBjYW5ub3QgYmUgY2hhbmdlZCBvbiBhbiBpbnRlZ2VyIHRleHR1cmUsIHdpbGwgcmVtYWluIGZhbHNlXCIsIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHYpIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWlwbWFwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBpZiB0ZXh0dXJlIGNhbiBiZSB1c2VkIGFzIGEgc3RvcmFnZSB0ZXh0dXJlIGJ5IGEgY29tcHV0ZSBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3RvcmFnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0b3JhZ2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG51bWJlciBvZiBkZXB0aCBzbGljZXMgaW4gYSAzRCB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH0+L2xpPlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0J9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQkF9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBmb3JtYXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb3JtYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoaXMgdGV4dHVyZSBpcyBhIGN1YmUgbWFwIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgY3ViZW1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1YmVtYXA7XG4gICAgfVxuXG4gICAgZ2V0IGdwdVNpemUoKSB7XG4gICAgICAgIGNvbnN0IG1pcHMgPSB0aGlzLnBvdCAmJiB0aGlzLl9taXBtYXBzICYmICEodGhpcy5fY29tcHJlc3NlZCAmJiB0aGlzLl9sZXZlbHMubGVuZ3RoID09PSAxKTtcbiAgICAgICAgcmV0dXJuIFRleHR1cmVVdGlscy5jYWxjR3B1U2l6ZSh0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0LCB0aGlzLl9kZXB0aCwgdGhpcy5fZm9ybWF0LCBtaXBzLCB0aGlzLl9jdWJlbWFwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgMkQgdGV4dHVyZSBhcnJheSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGFycmF5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXJyYXlMZW5ndGggPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG51bWJlciBvZiB0ZXh0dXJlcyBpbnNpZGUgdGhpcyB0ZXh0dXJlIGlmIHRoaXMgaXMgYSAyRCBhcnJheSB0ZXh0dXJlIG9yIDAgb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgYXJyYXlMZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hcnJheUxlbmd0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgM0Qgdm9sdW1lIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIHNob3VsZCBiZSBmbGlwcGVkIGluIHRoZSBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzXG4gICAgICogd2l0aCBhIHNvdXJjZSB0aGF0IGlzIGFuIGltYWdlLCBjYW52YXMgb3IgdmlkZW8gZWxlbWVudC4gRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLFxuICAgICAqIGNvbXByZXNzZWQgdGV4dHVyZXMgb3IgdGV4dHVyZXMgc2V0IGZyb20gcmF3IHBpeGVsIGRhdGEuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcFkoZmxpcFkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy5fZmxpcFkgPSBmbGlwWTtcbiAgICAgICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmbGlwWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBZO1xuICAgIH1cblxuICAgIHNldCBwcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgIT09IHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBwcmVtdWx0aXBseUFscGhhO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByZW11bHRpcGx5QWxwaGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmVtdWx0aXBseUFscGhhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBhbGwgZGltZW5zaW9ucyBvZiB0aGUgdGV4dHVyZSBhcmUgcG93ZXIgb2YgdHdvLCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBvdCgpIHtcbiAgICAgICAgcmV0dXJuIG1hdGgucG93ZXJPZlR3byh0aGlzLl93aWR0aCkgJiYgbWF0aC5wb3dlck9mVHdvKHRoaXMuX2hlaWdodCk7XG4gICAgfVxuXG4gICAgLy8gZ2V0IHRoZSB0ZXh0dXJlJ3MgZW5jb2RpbmcgdHlwZVxuICAgIGdldCBlbmNvZGluZygpIHtcbiAgICAgICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCTTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYm0nO1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JFOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdiZSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQlA6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JwJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuICh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTE2RiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkEzMkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzSW50ZWdlclBpeGVsRm9ybWF0KHRoaXMuZm9ybWF0KSkgPyAnbGluZWFyJyA6ICdzcmdiJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZvcmNlIGEgZnVsbCByZXN1Ym1pc3Npb24gb2YgdGhlIHRleHR1cmUgdG8gdGhlIEdQVSAodXNlZCBvbiBhIGNvbnRleHQgcmVzdG9yZSBldmVudClcbiAgICBkaXJ0eUFsbCgpIHtcbiAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZCA9IHRoaXMuX2N1YmVtYXAgPyBbW3RydWUsIHRydWUsIHRydWUsIHRydWUsIHRydWUsIHRydWVdXSA6IFt0cnVlXTtcblxuICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRoaXMuX21pcG1hcHM7XG4gICAgICAgIHRoaXMuX21pcG1hcHNVcGxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDI1NSk7ICAvLyAxIHwgMiB8IDQgfCA4IHwgMTYgfCAzMiB8IDY0IHwgMTI4XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9ja3MgYSBtaXBsZXZlbCBvZiB0aGUgdGV4dHVyZSwgcmV0dXJuaW5nIGEgdHlwZWQgYXJyYXkgdG8gYmUgZmlsbGVkIHdpdGggcGl4ZWwgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdC4gVmFsaWQgcHJvcGVydGllcyBhcmUgYXMgZm9sbG93czpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubGV2ZWxdIC0gVGhlIG1pcCBsZXZlbCB0byBsb2NrIHdpdGggMCBiZWluZyB0aGUgdG9wIGxldmVsLiBEZWZhdWx0c1xuICAgICAqIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gSWYgdGhlIHRleHR1cmUgaXMgYSBjdWJlbWFwLCB0aGlzIGlzIHRoZSBpbmRleCBvZiB0aGUgZmFjZVxuICAgICAqIHRvIGxvY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1vZGVdIC0gVGhlIGxvY2sgbW9kZS4gQ2FuIGJlOlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVMT0NLX1JFQUR9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9XG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRFWFRVUkVMT0NLX1dSSVRFfS5cbiAgICAgKiBAcmV0dXJucyB7VWludDhBcnJheXxVaW50MTZBcnJheXxGbG9hdDMyQXJyYXl9IEEgdHlwZWQgYXJyYXkgY29udGFpbmluZyB0aGUgcGl4ZWwgZGF0YSBvZlxuICAgICAqIHRoZSBsb2NrZWQgbWlwIGxldmVsLlxuICAgICAqL1xuICAgIGxvY2sob3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIC8vIEluaXRpYWxpemUgb3B0aW9ucyB0byBzb21lIHNlbnNpYmxlIGRlZmF1bHRzXG4gICAgICAgIG9wdGlvbnMubGV2ZWwgPz89IDA7XG4gICAgICAgIG9wdGlvbnMuZmFjZSA/Pz0gMDtcbiAgICAgICAgb3B0aW9ucy5tb2RlID8/PSBURVhUVVJFTE9DS19XUklURTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoXG4gICAgICAgICAgICB0aGlzLl9sb2NrZWRNb2RlID09PSBURVhUVVJFTE9DS19OT05FLFxuICAgICAgICAgICAgJ1RoZSB0ZXh0dXJlIGlzIGFscmVhZHkgbG9ja2VkLiBDYWxsIGB0ZXh0dXJlLnVubG9jaygpYCBiZWZvcmUgYXR0ZW1wdGluZyB0byBsb2NrIGFnYWluLicsXG4gICAgICAgICAgICB0aGlzXG4gICAgICAgICk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KFxuICAgICAgICAgICAgb3B0aW9ucy5tb2RlID09PSBURVhUVVJFTE9DS19SRUFEIHx8IG9wdGlvbnMubW9kZSA9PT0gVEVYVFVSRUxPQ0tfV1JJVEUsXG4gICAgICAgICAgICAnQ2Fubm90IGxvY2sgYSB0ZXh0dXJlIHdpdGggVEVYVFVSRUxPQ0tfTk9ORS4gVG8gdW5sb2NrIGEgdGV4dHVyZSwgY2FsbCBgdGV4dHVyZS51bmxvY2soKWAuJyxcbiAgICAgICAgICAgIHRoaXNcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLl9sb2NrZWRNb2RlID0gb3B0aW9ucy5tb2RlO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IG9wdGlvbnMubGV2ZWw7XG5cbiAgICAgICAgY29uc3QgbGV2ZWxzID0gdGhpcy5jdWJlbWFwID8gdGhpcy5fbGV2ZWxzW29wdGlvbnMuZmFjZV0gOiB0aGlzLl9sZXZlbHM7XG4gICAgICAgIGlmIChsZXZlbHNbb3B0aW9ucy5sZXZlbF0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIHN0b3JhZ2UgZm9yIHRoaXMgbWlwIGxldmVsXG4gICAgICAgICAgICBjb25zdCB3aWR0aCA9IE1hdGgubWF4KDEsIHRoaXMuX3dpZHRoID4+IG9wdGlvbnMubGV2ZWwpO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoMSwgdGhpcy5faGVpZ2h0ID4+IG9wdGlvbnMubGV2ZWwpO1xuICAgICAgICAgICAgY29uc3QgZGVwdGggPSBNYXRoLm1heCgxLCB0aGlzLl9kZXB0aCA+PiBvcHRpb25zLmxldmVsKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgQXJyYXlCdWZmZXIoVGV4dHVyZVV0aWxzLmNhbGNMZXZlbEdwdVNpemUod2lkdGgsIGhlaWdodCwgZGVwdGgsIHRoaXMuX2Zvcm1hdCkpO1xuICAgICAgICAgICAgbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IChnZXRQaXhlbEZvcm1hdEFycmF5VHlwZSh0aGlzLl9mb3JtYXQpKShkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsZXZlbHNbb3B0aW9ucy5sZXZlbF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBwaXhlbCBkYXRhIG9mIHRoZSB0ZXh0dXJlIGZyb20gYSBjYW52YXMsIGltYWdlLCB2aWRlbyBET00gZWxlbWVudC4gSWYgdGhlIHRleHR1cmUgaXNcbiAgICAgKiBhIGN1YmVtYXAsIHRoZSBzdXBwbGllZCBzb3VyY2UgbXVzdCBiZSBhbiBhcnJheSBvZiA2IGNhbnZhc2VzLCBpbWFnZXMgb3IgdmlkZW9zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fEhUTUxWaWRlb0VsZW1lbnR8SFRNTENhbnZhc0VsZW1lbnRbXXxIVE1MSW1hZ2VFbGVtZW50W118SFRNTFZpZGVvRWxlbWVudFtdfSBzb3VyY2UgLSBBXG4gICAgICogY2FudmFzLCBpbWFnZSBvciB2aWRlbyBlbGVtZW50LCBvciBhbiBhcnJheSBvZiA2IGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqL1xuICAgIHNldFNvdXJjZShzb3VyY2UsIG1pcExldmVsID0gMCkge1xuICAgICAgICBsZXQgaW52YWxpZCA9IGZhbHNlO1xuICAgICAgICBsZXQgd2lkdGgsIGhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgaWYgKHNvdXJjZVswXSkge1xuICAgICAgICAgICAgICAgIC8vIHJlbHkgb24gZmlyc3QgZmFjZSBzaXplc1xuICAgICAgICAgICAgICAgIHdpZHRoID0gc291cmNlWzBdLndpZHRoIHx8IDA7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlWzBdLmhlaWdodCB8fCAwO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFjZSA9IHNvdXJjZVtpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY3ViZW1hcCBiZWNvbWVzIGludmFsaWQgaWYgYW55IGNvbmRpdGlvbiBpcyBub3Qgc2F0aXNmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmICghZmFjZSB8fCAgICAgICAgICAgICAgICAgIC8vIGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS53aWR0aCAhPT0gd2lkdGggfHwgICAvLyBmYWNlIGlzIGRpZmZlcmVudCB3aWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS5oZWlnaHQgIT09IGhlaWdodCB8fCAvLyBmYWNlIGlzIGRpZmZlcmVudCBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKGZhY2UpKSB7ICAgICAgICAgICAgLy8gbmV3IGltYWdlIGJpdG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgZmFjZSBpcyBtaXNzaW5nXG4gICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaW52YWxpZCkge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgbGV2ZWxzIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGV2ZWxzW21pcExldmVsXVtpXSAhPT0gc291cmNlW2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNvdXJjZSBpcyB2YWxpZCB0eXBlIG9mIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShzb3VyY2UpKVxuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVsIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAoc291cmNlICE9PSB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZS53aWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBzb3VyY2UuaGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGludmFsaWQpIHtcbiAgICAgICAgICAgIC8vIGludmFsaWQgdGV4dHVyZVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHNpemVzXG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDQ7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSA0O1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgbGV2ZWxzXG4gICAgICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB2YWxpZCB0ZXh0dXJlXG4gICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IHNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIG9yIGNoYW5nZWQgc3RhdGUgb2YgdmFsaWRpdHlcbiAgICAgICAgaWYgKHRoaXMuX2ludmFsaWQgIT09IGludmFsaWQgfHwgIWludmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ludmFsaWQgPSBpbnZhbGlkO1xuXG4gICAgICAgICAgICAvLyByZXVwbG9hZFxuICAgICAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZS4gSWYgdGhpcyBpcyBhIGN1YmVtYXAgdGhlbiBhbiBhcnJheSBvZiA2IGltYWdlcyB3aWxsIGJlXG4gICAgICogcmV0dXJuZWQgb3RoZXJ3aXNlIGEgc2luZ2xlIGltYWdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqIEByZXR1cm5zIHtIVE1MSW1hZ2VFbGVtZW50fSBUaGUgc291cmNlIGltYWdlIG9mIHRoaXMgdGV4dHVyZS4gQ2FuIGJlIG51bGwgaWYgc291cmNlIG5vdFxuICAgICAqIGFzc2lnbmVkIGZvciBzcGVjaWZpYyBpbWFnZSBsZXZlbC5cbiAgICAgKi9cbiAgICBnZXRTb3VyY2UobWlwTGV2ZWwgPSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVubG9ja3MgdGhlIGN1cnJlbnRseSBsb2NrZWQgbWlwIGxldmVsIGFuZCB1cGxvYWRzIGl0IHRvIFZSQU0uXG4gICAgICovXG4gICAgdW5sb2NrKCkge1xuICAgICAgICBpZiAodGhpcy5fbG9ja2VkTW9kZSA9PT0gVEVYVFVSRUxPQ0tfTk9ORSkge1xuICAgICAgICAgICAgRGVidWcud2FybihcInBjLlRleHR1cmUjdW5sb2NrOiBBdHRlbXB0aW5nIHRvIHVubG9jayBhIHRleHR1cmUgdGhhdCBpcyBub3QgbG9ja2VkLlwiLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwbG9hZCB0aGUgbmV3IHBpeGVsIGRhdGEgaWYgbG9ja2VkIGluIHdyaXRlIG1vZGUgKGRlZmF1bHQpXG4gICAgICAgIGlmICh0aGlzLl9sb2NrZWRNb2RlID09PSBURVhUVVJFTE9DS19XUklURSkge1xuICAgICAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgICAgICB0aGlzLl9sb2NrZWRNb2RlID0gVEVYVFVSRUxPQ0tfTk9ORTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JjZXMgYSByZXVwbG9hZCBvZiB0aGUgdGV4dHVyZXMgcGl4ZWwgZGF0YSB0byBncmFwaGljcyBtZW1vcnkuIE9yZGluYXJpbHksIHRoaXMgZnVuY3Rpb25cbiAgICAgKiBpcyBjYWxsZWQgYnkgaW50ZXJuYWxseSBieSB7QGxpbmsgVGV4dHVyZSNzZXRTb3VyY2V9IGFuZCB7QGxpbmsgVGV4dHVyZSN1bmxvY2t9LiBIb3dldmVyLCBpdFxuICAgICAqIHN0aWxsIG5lZWRzIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5IGluIHRoZSBjYXNlIHdoZXJlIGFuIEhUTUxWaWRlb0VsZW1lbnQgaXMgc2V0IGFzIHRoZVxuICAgICAqIHNvdXJjZSBvZiB0aGUgdGV4dHVyZS4gIE5vcm1hbGx5LCB0aGlzIGlzIGRvbmUgb25jZSBldmVyeSBmcmFtZSBiZWZvcmUgdmlkZW8gdGV4dHVyZWRcbiAgICAgKiBnZW9tZXRyeSBpcyByZW5kZXJlZC5cbiAgICAgKi9cbiAgICB1cGxvYWQoKSB7XG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5pbXBsLnVwbG9hZEltbWVkaWF0ZT8uKHRoaXMuZGV2aWNlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEb3dubG9hZCB0ZXh0dXJlJ3MgdG9wIGxldmVsIGRhdGEgZnJvbSBncmFwaGljcyBtZW1vcnkgdG8gbG9jYWwgbWVtb3J5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzeW5jIGRvd25sb2FkQXN5bmMoKSB7XG4gICAgICAgIGNvbnN0IHByb21pc2VzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgKHRoaXMuY3ViZW1hcCA/IDYgOiAxKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJUYXJnZXQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcyxcbiAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZmFjZTogaVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZGV2aWNlLnNldFJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UuaW5pdFJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICBjb25zdCBsZXZlbHMgPSB0aGlzLmN1YmVtYXAgPyB0aGlzLl9sZXZlbHNbaV0gOiB0aGlzLl9sZXZlbHM7XG5cbiAgICAgICAgICAgIGxldCBsZXZlbCA9IGxldmVsc1swXTtcbiAgICAgICAgICAgIGlmIChsZXZlbHNbMF0gJiYgdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShsZXZlbHNbMF0pKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWxzWzBdID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV2ZWwgPSB0aGlzLmxvY2soeyBmYWNlOiBpIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBwcm9taXNlID0gdGhpcy5kZXZpY2UucmVhZFBpeGVsc0FzeW5jPy4oMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIGxldmVsKVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHJlbmRlclRhcmdldC5kZXN0cm95KCkpO1xuXG4gICAgICAgICAgICBwcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJpZCIsIlRleHR1cmUiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwib3B0aW9ucyIsIl9vcHRpb25zJG5hbWUiLCJfb3B0aW9ucyR3aWR0aCIsIl9vcHRpb25zJGhlaWdodCIsIl9vcHRpb25zJGZvcm1hdCIsIl9vcHRpb25zJHN0b3JhZ2UiLCJfb3B0aW9ucyRjdWJlbWFwIiwiX29wdGlvbnMkZml4Q3ViZW1hcFNlIiwiX29wdGlvbnMkZmxpcFkiLCJfb3B0aW9ucyRwcmVtdWx0aXBseUEiLCJfcmVmIiwiX29wdGlvbnMkbWlwbWFwcyIsIl9vcHRpb25zJG1pbkZpbHRlciIsIl9vcHRpb25zJG1hZ0ZpbHRlciIsIl9vcHRpb25zJGFuaXNvdHJvcHkiLCJfb3B0aW9ucyRhZGRyZXNzVSIsIl9vcHRpb25zJGFkZHJlc3NWIiwiX29wdGlvbnMkYWRkcmVzc1ciLCJfb3B0aW9ucyRjb21wYXJlT25SZWEiLCJfb3B0aW9ucyRjb21wYXJlRnVuYyIsIl9vcHRpb25zJHByb2ZpbGVySGludCIsIm5hbWUiLCJfZ3B1U2l6ZSIsIl9pbnZhbGlkIiwiX2xvY2tlZExldmVsIiwiX2xvY2tlZE1vZGUiLCJURVhUVVJFTE9DS19OT05FIiwicmVuZGVyVmVyc2lvbkRpcnR5IiwiX3N0b3JhZ2UiLCJkZXZpY2UiLCJEZWJ1ZyIsImFzc2VydCIsIndpZHRoIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwiaGVpZ2h0IiwiZGVwdGgiLCJfd2lkdGgiLCJNYXRoIiwiZmxvb3IiLCJfaGVpZ2h0IiwiX2Zvcm1hdCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiX2NvbXByZXNzZWQiLCJpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCIsIl9pbnRlZ2VyRm9ybWF0IiwiaXNJbnRlZ2VyUGl4ZWxGb3JtYXQiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJzdXBwb3J0c1ZvbHVtZVRleHR1cmVzIiwiX29wdGlvbnMkdm9sdW1lIiwiX29wdGlvbnMkZGVwdGgiLCJfb3B0aW9ucyRhcnJheUxlbmd0aCIsIl92b2x1bWUiLCJ2b2x1bWUiLCJfZGVwdGgiLCJfYXJyYXlMZW5ndGgiLCJhcnJheUxlbmd0aCIsInN0b3JhZ2UiLCJfY3ViZW1hcCIsImN1YmVtYXAiLCJmaXhDdWJlbWFwU2VhbXMiLCJfZmxpcFkiLCJmbGlwWSIsIl9wcmVtdWx0aXBseUFscGhhIiwicHJlbXVsdGlwbHlBbHBoYSIsIl9taXBtYXBzIiwiYXV0b01pcG1hcCIsIl9taW5GaWx0ZXIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIl9hbmlzb3Ryb3B5IiwiYW5pc290cm9weSIsIl9hZGRyZXNzVSIsImFkZHJlc3NVIiwiQUREUkVTU19SRVBFQVQiLCJfYWRkcmVzc1YiLCJhZGRyZXNzViIsIl9hZGRyZXNzVyIsImFkZHJlc3NXIiwiX2NvbXBhcmVPblJlYWQiLCJjb21wYXJlT25SZWFkIiwiX2NvbXBhcmVGdW5jIiwiY29tcGFyZUZ1bmMiLCJGVU5DX0xFU1MiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsImhhc093blByb3BlcnR5IiwiZGVwcmVjYXRlZCIsInJnYm0iLCJURVhUVVJFVFlQRV9SR0JNIiwic3dpenpsZUdHR1IiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsImltcGwiLCJjcmVhdGVUZXh0dXJlSW1wbCIsInByb2ZpbGVySGludCIsImRpcnR5QWxsIiwiX2xldmVscyIsImxldmVscyIsInVwbG9hZCIsInRleHR1cmVzIiwicHVzaCIsInRyYWNlIiwiVFJBQ0VJRF9URVhUVVJFX0FMTE9DIiwiYXJyYXkiLCJkZXN0cm95IiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInNjb3BlIiwicmVtb3ZlVmFsdWUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJyZXNpemUiLCJsb3NlQ29udGV4dCIsInZyYW0iLCJzaXplIiwiVFJBQ0VJRF9WUkFNX1RFWFRVUkUiLCJ0ZXgiLCJURVhISU5UX1NIQURPV01BUCIsInRleFNoYWRvdyIsIlRFWEhJTlRfQVNTRVQiLCJ0ZXhBc3NldCIsIlRFWEhJTlRfTElHSFRNQVAiLCJ0ZXhMaWdodG1hcCIsInByb3BlcnR5Q2hhbmdlZCIsImZsYWciLCJyZW5kZXJWZXJzaW9uIiwicmVxdWlyZWRNaXBMZXZlbHMiLCJUZXh0dXJlVXRpbHMiLCJjYWxjTWlwTGV2ZWxzQ291bnQiLCJsb2NrZWRNb2RlIiwidiIsIndhcm4iLCJpc1dlYkdQVSIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJncHVTaXplIiwibWlwcyIsInBvdCIsImxlbmd0aCIsImNhbGNHcHVTaXplIiwiX25lZWRzVXBsb2FkIiwibWF0aCIsInBvd2VyT2ZUd28iLCJlbmNvZGluZyIsIlRFWFRVUkVUWVBFX1JHQkUiLCJURVhUVVJFVFlQRV9SR0JQIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJfbGV2ZWxzVXBkYXRlZCIsIl9taXBtYXBzVXBsb2FkZWQiLCJsb2NrIiwiX29wdGlvbnMkbGV2ZWwiLCJfb3B0aW9ucyRmYWNlIiwiX29wdGlvbnMkbW9kZSIsImxldmVsIiwiZmFjZSIsIm1vZGUiLCJURVhUVVJFTE9DS19XUklURSIsIlRFWFRVUkVMT0NLX1JFQUQiLCJtYXgiLCJkYXRhIiwiQXJyYXlCdWZmZXIiLCJjYWxjTGV2ZWxHcHVTaXplIiwiZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUiLCJzZXRTb3VyY2UiLCJzb3VyY2UiLCJtaXBMZXZlbCIsImludmFsaWQiLCJpIiwiX2lzQnJvd3NlckludGVyZmFjZSIsImdldFNvdXJjZSIsInVubG9jayIsIl90aGlzJGltcGwkdXBsb2FkSW1tZSIsIl90aGlzJGltcGwiLCJ1cGxvYWRJbW1lZGlhdGUiLCJjYWxsIiwiZG93bmxvYWRBc3luYyIsInByb21pc2VzIiwiX3RoaXMkZGV2aWNlJHJlYWRQaXhlIiwiX3RoaXMkZGV2aWNlIiwicmVuZGVyVGFyZ2V0IiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJzZXRSZW5kZXJUYXJnZXQiLCJpbml0UmVuZGVyVGFyZ2V0IiwicHJvbWlzZSIsInJlYWRQaXhlbHNBc3luYyIsInRoZW4iLCJQcm9taXNlIiwiYWxsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBcUJBLElBQUlBLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsT0FBTyxDQUFDO0FBbUNWO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxjQUFjLEVBQUVDLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFBQSxJQUFBLElBQUFDLGFBQUEsRUFBQUMsY0FBQSxFQUFBQyxlQUFBLEVBQUFDLGVBQUEsRUFBQUMsZ0JBQUEsRUFBQUMsZ0JBQUEsRUFBQUMscUJBQUEsRUFBQUMsY0FBQSxFQUFBQyxxQkFBQSxFQUFBQyxJQUFBLEVBQUFDLGdCQUFBLEVBQUFDLGtCQUFBLEVBQUFDLGtCQUFBLEVBQUFDLG1CQUFBLEVBQUFDLGlCQUFBLEVBQUFDLGlCQUFBLEVBQUFDLGlCQUFBLEVBQUFDLHFCQUFBLEVBQUFDLG9CQUFBLEVBQUFDLHFCQUFBLENBQUE7QUFoSzFDO0FBQ0o7QUFDQTtBQUNB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
