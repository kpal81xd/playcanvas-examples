import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { isCompressedPixelFormat, PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, isIntegerPixelFormat, pixelFormatInfo, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR } from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { gpuTextureFormats } from './constants.js';

// map of ADDRESS_*** to GPUAddressMode
const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';

// map of FILTER_*** to GPUFilterMode for level and mip sampling
const gpuFilterModes = [];
gpuFilterModes[FILTER_NEAREST] = {
  level: 'nearest',
  mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR] = {
  level: 'linear',
  mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_NEAREST] = {
  level: 'nearest',
  mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_LINEAR] = {
  level: 'nearest',
  mip: 'linear'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_NEAREST] = {
  level: 'linear',
  mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_LINEAR] = {
  level: 'linear',
  mip: 'linear'
};
const dummyUse = thingOne => {
  // so lint thinks we're doing something with thingOne
};

/**
 * A WebGPU implementation of the Texture.
 *
 * @ignore
 */
class WebgpuTexture {
  constructor(texture) {
    /**
     * @type {GPUTexture}
     * @private
     */
    this.gpuTexture = void 0;
    /**
     * @type {GPUTextureView}
     * @private
     */
    this.view = void 0;
    /**
     * An array of samplers, addressed by SAMPLETYPE_*** constant, allowing texture to be sampled
     * using different samplers. Most textures are sampled as interpolated floats, but some can
     * additionally be sampled using non-interpolated floats (raw data) or compare sampling
     * (shadow maps).
     *
     * @type {GPUSampler[]}
     * @private
     */
    this.samplers = [];
    /**
     * @type {GPUTextureDescriptor}
     * @private
     */
    this.descr = void 0;
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    this.format = void 0;
    /** @type {import('../texture.js').Texture} */
    this.texture = texture;
    this.format = gpuTextureFormats[texture.format];
    Debug.assert(this.format !== '', `WebGPU does not support texture format ${texture.format} for texture ${texture.name}`, texture);
    this.create(texture.device);
  }
  create(device) {
    const texture = this.texture;
    const wgpu = device.wgpu;
    const mipLevelCount = texture.requiredMipLevels;
    Debug.assert(texture.width > 0 && texture.height > 0, `Invalid texture dimensions ${texture.width}x${texture.height} for texture ${texture.name}`, texture);
    this.descr = {
      size: {
        width: texture.width,
        height: texture.height,
        depthOrArrayLayers: texture.cubemap ? 6 : texture.array ? texture.arrayLength : 1
      },
      format: this.format,
      mipLevelCount: mipLevelCount,
      sampleCount: 1,
      dimension: texture.volume ? '3d' : '2d',
      // TODO: use only required usage flags
      // COPY_SRC - probably only needed on render target textures, to support copyRenderTarget (grab pass needs it)
      // RENDER_ATTACHMENT - needed for mipmap generation
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | (isCompressedPixelFormat(texture.format) ? 0 : GPUTextureUsage.RENDER_ATTACHMENT) | (texture.storage ? GPUTextureUsage.STORAGE_BINDING : 0)
    };
    WebgpuDebug.validate(device);
    this.gpuTexture = wgpu.createTexture(this.descr);
    DebugHelper.setLabel(this.gpuTexture, `${texture.name}${texture.cubemap ? '[cubemap]' : ''}${texture.volume ? '[3d]' : ''}`);
    WebgpuDebug.end(device, {
      descr: this.descr,
      texture
    });

    // default texture view descriptor
    let viewDescr;

    // some format require custom default texture view
    if (this.texture.format === PIXELFORMAT_DEPTHSTENCIL) {
      // we expose the depth part of the format
      viewDescr = {
        format: 'depth24plus',
        aspect: 'depth-only'
      };
    }
    this.view = this.createView(viewDescr);
  }
  destroy(device) {}
  propertyChanged(flag) {
    // samplers need to be recreated
    this.samplers.length = 0;
  }

  /**
   * @param {any} device - The Graphics Device.
   * @returns {any} - Returns the view.
   */
  getView(device) {
    this.uploadImmediate(device, this.texture);
    Debug.assert(this.view);
    return this.view;
  }
  createView(viewDescr) {
    var _options$format, _options$dimension, _options$aspect, _options$baseMipLevel, _options$mipLevelCoun, _options$baseArrayLay, _options$arrayLayerCo;
    const options = viewDescr != null ? viewDescr : {};
    const textureDescr = this.descr;
    const texture = this.texture;

    // '1d', '2d', '2d-array', 'cube', 'cube-array', '3d'
    const defaultViewDimension = () => {
      if (texture.cubemap) return 'cube';
      if (texture.volume) return '3d';
      if (texture.array) return '2d-array';
      return '2d';
    };

    /** @type {GPUTextureViewDescriptor} */
    const descr = {
      format: (_options$format = options.format) != null ? _options$format : textureDescr.format,
      dimension: (_options$dimension = options.dimension) != null ? _options$dimension : defaultViewDimension(),
      aspect: (_options$aspect = options.aspect) != null ? _options$aspect : 'all',
      baseMipLevel: (_options$baseMipLevel = options.baseMipLevel) != null ? _options$baseMipLevel : 0,
      mipLevelCount: (_options$mipLevelCoun = options.mipLevelCount) != null ? _options$mipLevelCoun : textureDescr.mipLevelCount,
      baseArrayLayer: (_options$baseArrayLay = options.baseArrayLayer) != null ? _options$baseArrayLay : 0,
      arrayLayerCount: (_options$arrayLayerCo = options.arrayLayerCount) != null ? _options$arrayLayerCo : textureDescr.depthOrArrayLayers
    };
    const view = this.gpuTexture.createView(descr);
    DebugHelper.setLabel(view, `${viewDescr ? `CustomView${JSON.stringify(viewDescr)}` : 'DefaultView'}:${this.texture.name}`);
    return view;
  }

  // TODO: share a global map of samplers. Possibly even use shared samplers for bind group,
  // or maybe even have some attached in view bind group and use globally

  /**
   * @param {any} device - The Graphics Device.
   * @param {number} [sampleType] - A sample type for the sampler, SAMPLETYPE_*** constant. If not
   * specified, the sampler type is based on the texture format / texture sampling type.
   * @returns {any} - Returns the sampler.
   */
  getSampler(device, sampleType) {
    let sampler = this.samplers[sampleType];
    if (!sampler) {
      const texture = this.texture;
      let label;

      /** @type GPUSamplerDescriptor */
      const descr = {
        addressModeU: gpuAddressModes[texture.addressU],
        addressModeV: gpuAddressModes[texture.addressV],
        addressModeW: gpuAddressModes[texture.addressW]
      };

      // default for compare sampling of texture
      if (!sampleType && texture.compareOnRead) {
        sampleType = SAMPLETYPE_DEPTH;
      }
      if (sampleType === SAMPLETYPE_DEPTH || sampleType === SAMPLETYPE_INT || sampleType === SAMPLETYPE_UINT) {
        // depth compare sampling
        descr.compare = 'less';
        descr.magFilter = 'linear';
        descr.minFilter = 'linear';
        label = 'Compare';
      } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {
        // webgpu cannot currently filter float / half float textures, or integer textures
        descr.magFilter = 'nearest';
        descr.minFilter = 'nearest';
        descr.mipmapFilter = 'nearest';
        label = 'Unfilterable';
      } else {
        // TODO: this is temporary and needs to be made generic
        if (this.texture.format === PIXELFORMAT_RGBA32F || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || this.texture.format === PIXELFORMAT_RGBA16F || isIntegerPixelFormat(this.texture.format)) {
          descr.magFilter = 'nearest';
          descr.minFilter = 'nearest';
          descr.mipmapFilter = 'nearest';
          label = 'Nearest';
        } else {
          descr.magFilter = gpuFilterModes[texture.magFilter].level;
          descr.minFilter = gpuFilterModes[texture.minFilter].level;
          descr.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
          Debug.call(() => {
            label = `Texture:${texture.magFilter}-${texture.minFilter}-${descr.mipmapFilter}`;
          });
        }
      }

      // ensure anisotropic filtering is only set when filtering is correctly
      // set up
      const allLinear = descr.minFilter === 'linear' && descr.magFilter === 'linear' && descr.mipmapFilter === 'linear';
      descr.maxAnisotropy = allLinear ? math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy) : 1;
      sampler = device.wgpu.createSampler(descr);
      DebugHelper.setLabel(sampler, label);
      this.samplers[sampleType] = sampler;
    }
    return sampler;
  }
  loseContext() {}

  /**
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   * @param {import('../texture.js').Texture} texture - The texture.
   */
  uploadImmediate(device, texture) {
    if (texture._needsUpload || texture._needsMipmapsUpload) {
      this.uploadData(device);
      texture._needsUpload = false;
      texture._needsMipmapsUpload = false;
    }
  }

  /**
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   */
  uploadData(device) {
    const texture = this.texture;
    if (texture._levels) {
      // upload texture data if any
      let anyUploads = false;
      let anyLevelMissing = false;
      const requiredMipLevels = texture.requiredMipLevels;
      for (let mipLevel = 0; mipLevel < requiredMipLevels; mipLevel++) {
        const mipObject = texture._levels[mipLevel];
        if (mipObject) {
          if (texture.cubemap) {
            for (let face = 0; face < 6; face++) {
              const faceSource = mipObject[face];
              if (faceSource) {
                if (this.isExternalImage(faceSource)) {
                  this.uploadExternalImage(device, faceSource, mipLevel, face);
                  anyUploads = true;
                } else if (ArrayBuffer.isView(faceSource)) {
                  // typed array

                  this.uploadTypedArrayData(device, faceSource, mipLevel, face);
                  anyUploads = true;
                } else {
                  Debug.error('Unsupported texture source data for cubemap face', faceSource);
                }
              } else {
                anyLevelMissing = true;
              }
            }
          } else if (texture._volume) {
            Debug.warn('Volume texture data upload is not supported yet', this.texture);
          } else if (texture.array) {
            // texture array

            if (texture.arrayLength === mipObject.length) {
              for (let index = 0; index < texture._arrayLength; index++) {
                const arraySource = mipObject[index];
                if (this.isExternalImage(arraySource)) {
                  this.uploadExternalImage(device, arraySource, mipLevel, index);
                  anyUploads = true;
                } else if (ArrayBuffer.isView(arraySource)) {
                  // typed array

                  this.uploadTypedArrayData(device, arraySource, mipLevel, index);
                  anyUploads = true;
                } else {
                  Debug.error('Unsupported texture source data for texture array entry', arraySource);
                }
              }
            } else {
              anyLevelMissing = true;
            }
          } else {
            // 2d texture

            if (this.isExternalImage(mipObject)) {
              this.uploadExternalImage(device, mipObject, mipLevel, 0);
              anyUploads = true;
            } else if (ArrayBuffer.isView(mipObject)) {
              // typed array

              this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
              anyUploads = true;
            } else {
              Debug.error('Unsupported texture source data', mipObject);
            }
          }
        } else {
          anyLevelMissing = true;
        }
      }
      if (anyUploads && anyLevelMissing && texture.mipmaps && !isCompressedPixelFormat(texture.format)) {
        device.mipmapRenderer.generate(this);
      }

      // update vram stats
      if (texture._gpuSize) {
        texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
      }
      texture._gpuSize = texture.gpuSize;
      texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
    }
  }

  // image types supported by copyExternalImageToTexture
  isExternalImage(image) {
    return image instanceof ImageBitmap || image instanceof HTMLVideoElement || image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas;
  }
  uploadExternalImage(device, image, mipLevel, index) {
    Debug.assert(mipLevel < this.descr.mipLevelCount, `Accessing mip level ${mipLevel} of texture with ${this.descr.mipLevelCount} mip levels`, this);
    const src = {
      source: image,
      origin: [0, 0],
      flipY: false
    };
    const dst = {
      texture: this.gpuTexture,
      mipLevel: mipLevel,
      origin: [0, 0, index],
      aspect: 'all' // can be: "all", "stencil-only", "depth-only"
    };

    const copySize = {
      width: this.descr.size.width,
      height: this.descr.size.height,
      depthOrArrayLayers: 1 // single layer
    };

    // submit existing scheduled commands to the queue before copying to preserve the order
    device.submit();

    // create 2d context so webgpu can upload the texture
    dummyUse(image instanceof HTMLCanvasElement && image.getContext('2d'));
    Debug.trace(TRACEID_RENDER_QUEUE, `IMAGE-TO-TEX: mip:${mipLevel} index:${index} ${this.texture.name}`);
    device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
  }
  uploadTypedArrayData(device, data, mipLevel, index) {
    const texture = this.texture;
    const wgpu = device.wgpu;

    /** @type {GPUImageCopyTexture} */
    const dest = {
      texture: this.gpuTexture,
      origin: [0, 0, index],
      mipLevel: mipLevel
    };

    // texture dimensions at the specified mip level
    const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
    const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);

    // data sizes
    const byteSize = TextureUtils.calcLevelGpuSize(width, height, 1, texture.format);
    Debug.assert(byteSize === data.byteLength, `Error uploading data to texture, the data byte size of ${data.byteLength} does not match required ${byteSize}`, texture);
    const formatInfo = pixelFormatInfo.get(texture.format);
    Debug.assert(formatInfo);

    /** @type {GPUImageDataLayout} */
    let dataLayout;
    let size;
    if (formatInfo.size) {
      // uncompressed format
      dataLayout = {
        offset: 0,
        bytesPerRow: formatInfo.size * width,
        rowsPerImage: height
      };
      size = {
        width: width,
        height: height
      };
    } else if (formatInfo.blockSize) {
      // compressed format
      const blockDim = size => {
        return Math.floor((size + 3) / 4);
      };
      dataLayout = {
        offset: 0,
        bytesPerRow: formatInfo.blockSize * blockDim(width),
        rowsPerImage: blockDim(height)
      };
      size = {
        width: Math.max(4, width),
        height: Math.max(4, height)
      };
    } else {
      Debug.assert(false, `WebGPU does not yet support texture format ${formatInfo.name} for texture ${texture.name}`, texture);
    }

    // submit existing scheduled commands to the queue before copying to preserve the order
    device.submit();
    Debug.trace(TRACEID_RENDER_QUEUE, `WRITE-TEX: mip:${mipLevel} index:${index} ${this.texture.name}`);
    wgpu.queue.writeTexture(dest, data, dataLayout, size);
  }
}

export { WebgpuTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfUVVFVUUgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7XG4gICAgcGl4ZWxGb3JtYXRJbmZvLCBpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCxcbiAgICBBRERSRVNTX1JFUEVBVCwgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCxcbiAgICBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsXG4gICAgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQsIFNBTVBMRVRZUEVfREVQVEgsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiwgaXNJbnRlZ2VyUGl4ZWxGb3JtYXQsIFNBTVBMRVRZUEVfSU5ULCBTQU1QTEVUWVBFX1VJTlRcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmVVdGlscyB9IGZyb20gJy4uL3RleHR1cmUtdXRpbHMuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RGVidWcgfSBmcm9tICcuL3dlYmdwdS1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBncHVUZXh0dXJlRm9ybWF0cyB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLy8gbWFwIG9mIEFERFJFU1NfKioqIHRvIEdQVUFkZHJlc3NNb2RlXG5jb25zdCBncHVBZGRyZXNzTW9kZXMgPSBbXTtcbmdwdUFkZHJlc3NNb2Rlc1tBRERSRVNTX1JFUEVBVF0gPSAncmVwZWF0JztcbmdwdUFkZHJlc3NNb2Rlc1tBRERSRVNTX0NMQU1QX1RPX0VER0VdID0gJ2NsYW1wLXRvLWVkZ2UnO1xuZ3B1QWRkcmVzc01vZGVzW0FERFJFU1NfTUlSUk9SRURfUkVQRUFUXSA9ICdtaXJyb3ItcmVwZWF0JztcblxuLy8gbWFwIG9mIEZJTFRFUl8qKiogdG8gR1BVRmlsdGVyTW9kZSBmb3IgbGV2ZWwgYW5kIG1pcCBzYW1wbGluZ1xuY29uc3QgZ3B1RmlsdGVyTW9kZXMgPSBbXTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9ORUFSRVNUXSA9IHsgbGV2ZWw6ICduZWFyZXN0JywgbWlwOiAnbmVhcmVzdCcgfTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9MSU5FQVJdID0geyBsZXZlbDogJ2xpbmVhcicsIG1pcDogJ25lYXJlc3QnIH07XG5ncHVGaWx0ZXJNb2Rlc1tGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVF0gPSB7IGxldmVsOiAnbmVhcmVzdCcsIG1pcDogJ25lYXJlc3QnIH07XG5ncHVGaWx0ZXJNb2Rlc1tGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSXSA9IHsgbGV2ZWw6ICduZWFyZXN0JywgbWlwOiAnbGluZWFyJyB9O1xuZ3B1RmlsdGVyTW9kZXNbRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVF0gPSB7IGxldmVsOiAnbGluZWFyJywgbWlwOiAnbmVhcmVzdCcgfTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUl0gPSB7IGxldmVsOiAnbGluZWFyJywgbWlwOiAnbGluZWFyJyB9O1xuXG5jb25zdCBkdW1teVVzZSA9ICh0aGluZ09uZSkgPT4ge1xuICAgIC8vIHNvIGxpbnQgdGhpbmtzIHdlJ3JlIGRvaW5nIHNvbWV0aGluZyB3aXRoIHRoaW5nT25lXG59O1xuXG4vKipcbiAqIEEgV2ViR1BVIGltcGxlbWVudGF0aW9uIG9mIHRoZSBUZXh0dXJlLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ3B1VGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBncHVUZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmVWaWV3fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdmlldztcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIHNhbXBsZXJzLCBhZGRyZXNzZWQgYnkgU0FNUExFVFlQRV8qKiogY29uc3RhbnQsIGFsbG93aW5nIHRleHR1cmUgdG8gYmUgc2FtcGxlZFxuICAgICAqIHVzaW5nIGRpZmZlcmVudCBzYW1wbGVycy4gTW9zdCB0ZXh0dXJlcyBhcmUgc2FtcGxlZCBhcyBpbnRlcnBvbGF0ZWQgZmxvYXRzLCBidXQgc29tZSBjYW5cbiAgICAgKiBhZGRpdGlvbmFsbHkgYmUgc2FtcGxlZCB1c2luZyBub24taW50ZXJwb2xhdGVkIGZsb2F0cyAocmF3IGRhdGEpIG9yIGNvbXBhcmUgc2FtcGxpbmdcbiAgICAgKiAoc2hhZG93IG1hcHMpLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVNhbXBsZXJbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNhbXBsZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7R1BVVGV4dHVyZURlc2NyaXB0b3J9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXNjcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZm9ybWF0O1xuXG4gICAgY29uc3RydWN0b3IodGV4dHVyZSkge1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vdGV4dHVyZS5qcycpLlRleHR1cmV9ICovXG4gICAgICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAgICAgdGhpcy5mb3JtYXQgPSBncHVUZXh0dXJlRm9ybWF0c1t0ZXh0dXJlLmZvcm1hdF07XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCAhPT0gJycsIGBXZWJHUFUgZG9lcyBub3Qgc3VwcG9ydCB0ZXh0dXJlIGZvcm1hdCAke3RleHR1cmUuZm9ybWF0fSBmb3IgdGV4dHVyZSAke3RleHR1cmUubmFtZX1gLCB0ZXh0dXJlKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZSh0ZXh0dXJlLmRldmljZSk7XG4gICAgfVxuXG4gICAgY3JlYXRlKGRldmljZSkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcbiAgICAgICAgY29uc3QgbWlwTGV2ZWxDb3VudCA9IHRleHR1cmUucmVxdWlyZWRNaXBMZXZlbHM7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRleHR1cmUud2lkdGggPiAwICYmIHRleHR1cmUuaGVpZ2h0ID4gMCwgYEludmFsaWQgdGV4dHVyZSBkaW1lbnNpb25zICR7dGV4dHVyZS53aWR0aH14JHt0ZXh0dXJlLmhlaWdodH0gZm9yIHRleHR1cmUgJHt0ZXh0dXJlLm5hbWV9YCwgdGV4dHVyZSk7XG5cbiAgICAgICAgdGhpcy5kZXNjciA9IHtcbiAgICAgICAgICAgIHNpemU6IHtcbiAgICAgICAgICAgICAgICB3aWR0aDogdGV4dHVyZS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRleHR1cmUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogdGV4dHVyZS5jdWJlbWFwID8gNiA6ICh0ZXh0dXJlLmFycmF5ID8gdGV4dHVyZS5hcnJheUxlbmd0aCA6IDEpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybWF0OiB0aGlzLmZvcm1hdCxcbiAgICAgICAgICAgIG1pcExldmVsQ291bnQ6IG1pcExldmVsQ291bnQsXG4gICAgICAgICAgICBzYW1wbGVDb3VudDogMSxcbiAgICAgICAgICAgIGRpbWVuc2lvbjogdGV4dHVyZS52b2x1bWUgPyAnM2QnIDogJzJkJyxcblxuICAgICAgICAgICAgLy8gVE9ETzogdXNlIG9ubHkgcmVxdWlyZWQgdXNhZ2UgZmxhZ3NcbiAgICAgICAgICAgIC8vIENPUFlfU1JDIC0gcHJvYmFibHkgb25seSBuZWVkZWQgb24gcmVuZGVyIHRhcmdldCB0ZXh0dXJlcywgdG8gc3VwcG9ydCBjb3B5UmVuZGVyVGFyZ2V0IChncmFiIHBhc3MgbmVlZHMgaXQpXG4gICAgICAgICAgICAvLyBSRU5ERVJfQVRUQUNITUVOVCAtIG5lZWRlZCBmb3IgbWlwbWFwIGdlbmVyYXRpb25cbiAgICAgICAgICAgIHVzYWdlOiBHUFVUZXh0dXJlVXNhZ2UuVEVYVFVSRV9CSU5ESU5HIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfRFNUIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfU1JDIHxcbiAgICAgICAgICAgICAgICAoaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQodGV4dHVyZS5mb3JtYXQpID8gMCA6IEdQVVRleHR1cmVVc2FnZS5SRU5ERVJfQVRUQUNITUVOVCkgfFxuICAgICAgICAgICAgICAgICh0ZXh0dXJlLnN0b3JhZ2UgPyBHUFVUZXh0dXJlVXNhZ2UuU1RPUkFHRV9CSU5ESU5HIDogMClcbiAgICAgICAgfTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZShkZXZpY2UpO1xuXG4gICAgICAgIHRoaXMuZ3B1VGV4dHVyZSA9IHdncHUuY3JlYXRlVGV4dHVyZSh0aGlzLmRlc2NyKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5ncHVUZXh0dXJlLCBgJHt0ZXh0dXJlLm5hbWV9JHt0ZXh0dXJlLmN1YmVtYXAgPyAnW2N1YmVtYXBdJyA6ICcnfSR7dGV4dHVyZS52b2x1bWUgPyAnWzNkXScgOiAnJ31gKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7XG4gICAgICAgICAgICBkZXNjcjogdGhpcy5kZXNjcixcbiAgICAgICAgICAgIHRleHR1cmVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIHZpZXcgZGVzY3JpcHRvclxuICAgICAgICBsZXQgdmlld0Rlc2NyO1xuXG4gICAgICAgIC8vIHNvbWUgZm9ybWF0IHJlcXVpcmUgY3VzdG9tIGRlZmF1bHQgdGV4dHVyZSB2aWV3XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cG9zZSB0aGUgZGVwdGggcGFydCBvZiB0aGUgZm9ybWF0XG4gICAgICAgICAgICB2aWV3RGVzY3IgPSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0OiAnZGVwdGgyNHBsdXMnLFxuICAgICAgICAgICAgICAgIGFzcGVjdDogJ2RlcHRoLW9ubHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52aWV3ID0gdGhpcy5jcmVhdGVWaWV3KHZpZXdEZXNjcik7XG4gICAgfVxuXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICB9XG5cbiAgICBwcm9wZXJ0eUNoYW5nZWQoZmxhZykge1xuICAgICAgICAvLyBzYW1wbGVycyBuZWVkIHRvIGJlIHJlY3JlYXRlZFxuICAgICAgICB0aGlzLnNhbXBsZXJzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHthbnl9IGRldmljZSAtIFRoZSBHcmFwaGljcyBEZXZpY2UuXG4gICAgICogQHJldHVybnMge2FueX0gLSBSZXR1cm5zIHRoZSB2aWV3LlxuICAgICAqL1xuICAgIGdldFZpZXcoZGV2aWNlKSB7XG5cbiAgICAgICAgdGhpcy51cGxvYWRJbW1lZGlhdGUoZGV2aWNlLCB0aGlzLnRleHR1cmUpO1xuXG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLnZpZXcpO1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3O1xuICAgIH1cblxuICAgIGNyZWF0ZVZpZXcodmlld0Rlc2NyKSB7XG5cbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHZpZXdEZXNjciA/PyB7fTtcbiAgICAgICAgY29uc3QgdGV4dHVyZURlc2NyID0gdGhpcy5kZXNjcjtcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcblxuICAgICAgICAvLyAnMWQnLCAnMmQnLCAnMmQtYXJyYXknLCAnY3ViZScsICdjdWJlLWFycmF5JywgJzNkJ1xuICAgICAgICBjb25zdCBkZWZhdWx0Vmlld0RpbWVuc2lvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLmN1YmVtYXApIHJldHVybiAnY3ViZSc7XG4gICAgICAgICAgICBpZiAodGV4dHVyZS52b2x1bWUpIHJldHVybiAnM2QnO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuYXJyYXkpIHJldHVybiAnMmQtYXJyYXknO1xuICAgICAgICAgICAgcmV0dXJuICcyZCc7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVUZXh0dXJlVmlld0Rlc2NyaXB0b3J9ICovXG4gICAgICAgIGNvbnN0IGRlc2NyID0ge1xuICAgICAgICAgICAgZm9ybWF0OiBvcHRpb25zLmZvcm1hdCA/PyB0ZXh0dXJlRGVzY3IuZm9ybWF0LFxuICAgICAgICAgICAgZGltZW5zaW9uOiBvcHRpb25zLmRpbWVuc2lvbiA/PyBkZWZhdWx0Vmlld0RpbWVuc2lvbigpLFxuICAgICAgICAgICAgYXNwZWN0OiBvcHRpb25zLmFzcGVjdCA/PyAnYWxsJyxcbiAgICAgICAgICAgIGJhc2VNaXBMZXZlbDogb3B0aW9ucy5iYXNlTWlwTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgIG1pcExldmVsQ291bnQ6IG9wdGlvbnMubWlwTGV2ZWxDb3VudCA/PyB0ZXh0dXJlRGVzY3IubWlwTGV2ZWxDb3VudCxcbiAgICAgICAgICAgIGJhc2VBcnJheUxheWVyOiBvcHRpb25zLmJhc2VBcnJheUxheWVyID8/IDAsXG4gICAgICAgICAgICBhcnJheUxheWVyQ291bnQ6IG9wdGlvbnMuYXJyYXlMYXllckNvdW50ID8/IHRleHR1cmVEZXNjci5kZXB0aE9yQXJyYXlMYXllcnNcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy5ncHVUZXh0dXJlLmNyZWF0ZVZpZXcoZGVzY3IpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh2aWV3LCBgJHt2aWV3RGVzY3IgPyBgQ3VzdG9tVmlldyR7SlNPTi5zdHJpbmdpZnkodmlld0Rlc2NyKX1gIDogJ0RlZmF1bHRWaWV3J306JHt0aGlzLnRleHR1cmUubmFtZX1gKTtcblxuICAgICAgICByZXR1cm4gdmlldztcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBzaGFyZSBhIGdsb2JhbCBtYXAgb2Ygc2FtcGxlcnMuIFBvc3NpYmx5IGV2ZW4gdXNlIHNoYXJlZCBzYW1wbGVycyBmb3IgYmluZCBncm91cCxcbiAgICAvLyBvciBtYXliZSBldmVuIGhhdmUgc29tZSBhdHRhY2hlZCBpbiB2aWV3IGJpbmQgZ3JvdXAgYW5kIHVzZSBnbG9iYWxseVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHthbnl9IGRldmljZSAtIFRoZSBHcmFwaGljcyBEZXZpY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzYW1wbGVUeXBlXSAtIEEgc2FtcGxlIHR5cGUgZm9yIHRoZSBzYW1wbGVyLCBTQU1QTEVUWVBFXyoqKiBjb25zdGFudC4gSWYgbm90XG4gICAgICogc3BlY2lmaWVkLCB0aGUgc2FtcGxlciB0eXBlIGlzIGJhc2VkIG9uIHRoZSB0ZXh0dXJlIGZvcm1hdCAvIHRleHR1cmUgc2FtcGxpbmcgdHlwZS5cbiAgICAgKiBAcmV0dXJucyB7YW55fSAtIFJldHVybnMgdGhlIHNhbXBsZXIuXG4gICAgICovXG4gICAgZ2V0U2FtcGxlcihkZXZpY2UsIHNhbXBsZVR5cGUpIHtcbiAgICAgICAgbGV0IHNhbXBsZXIgPSB0aGlzLnNhbXBsZXJzW3NhbXBsZVR5cGVdO1xuICAgICAgICBpZiAoIXNhbXBsZXIpIHtcblxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcbiAgICAgICAgICAgIGxldCBsYWJlbDtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIEdQVVNhbXBsZXJEZXNjcmlwdG9yICovXG4gICAgICAgICAgICBjb25zdCBkZXNjciA9IHtcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVU6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NVXSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVY6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NWXSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVc6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NXXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBmb3IgY29tcGFyZSBzYW1wbGluZyBvZiB0ZXh0dXJlXG4gICAgICAgICAgICBpZiAoIXNhbXBsZVR5cGUgJiYgdGV4dHVyZS5jb21wYXJlT25SZWFkKSB7XG4gICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfREVQVEg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzYW1wbGVUeXBlID09PSBTQU1QTEVUWVBFX0RFUFRIIHx8IHNhbXBsZVR5cGUgPT09IFNBTVBMRVRZUEVfSU5UIHx8IHNhbXBsZVR5cGUgPT09IFNBTVBMRVRZUEVfVUlOVCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZGVwdGggY29tcGFyZSBzYW1wbGluZ1xuICAgICAgICAgICAgICAgIGRlc2NyLmNvbXBhcmUgPSAnbGVzcyc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWFnRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgbGFiZWwgPSAnQ29tcGFyZSc7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2FtcGxlVHlwZSA9PT0gU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdwdSBjYW5ub3QgY3VycmVudGx5IGZpbHRlciBmbG9hdCAvIGhhbGYgZmxvYXQgdGV4dHVyZXMsIG9yIGludGVnZXIgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBkZXNjci5tYWdGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgIGRlc2NyLm1pcG1hcEZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICBsYWJlbCA9ICdVbmZpbHRlcmFibGUnO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBpcyB0ZW1wb3JhcnkgYW5kIG5lZWRzIHRvIGJlIG1hZGUgZ2VuZXJpY1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZS5mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCB8fFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGIHx8IGlzSW50ZWdlclBpeGVsRm9ybWF0KHRoaXMudGV4dHVyZS5mb3JtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsID0gJ05lYXJlc3QnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9IGdwdUZpbHRlck1vZGVzW3RleHR1cmUubWFnRmlsdGVyXS5sZXZlbDtcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gZ3B1RmlsdGVyTW9kZXNbdGV4dHVyZS5taW5GaWx0ZXJdLmxldmVsO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPSBncHVGaWx0ZXJNb2Rlc1t0ZXh0dXJlLm1pbkZpbHRlcl0ubWlwO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsID0gYFRleHR1cmU6JHt0ZXh0dXJlLm1hZ0ZpbHRlcn0tJHt0ZXh0dXJlLm1pbkZpbHRlcn0tJHtkZXNjci5taXBtYXBGaWx0ZXJ9YDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbnN1cmUgYW5pc290cm9waWMgZmlsdGVyaW5nIGlzIG9ubHkgc2V0IHdoZW4gZmlsdGVyaW5nIGlzIGNvcnJlY3RseVxuICAgICAgICAgICAgLy8gc2V0IHVwXG4gICAgICAgICAgICBjb25zdCBhbGxMaW5lYXIgPSAoZGVzY3IubWluRmlsdGVyID09PSAnbGluZWFyJyAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9PT0gJ2xpbmVhcicgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPT09ICdsaW5lYXInKTtcbiAgICAgICAgICAgIGRlc2NyLm1heEFuaXNvdHJvcHkgPSBhbGxMaW5lYXIgP1xuICAgICAgICAgICAgICAgIG1hdGguY2xhbXAoTWF0aC5yb3VuZCh0ZXh0dXJlLl9hbmlzb3Ryb3B5KSwgMSwgZGV2aWNlLm1heFRleHR1cmVBbmlzb3Ryb3B5KSA6XG4gICAgICAgICAgICAgICAgMTtcblxuICAgICAgICAgICAgc2FtcGxlciA9IGRldmljZS53Z3B1LmNyZWF0ZVNhbXBsZXIoZGVzY3IpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoc2FtcGxlciwgbGFiZWwpO1xuICAgICAgICAgICAgdGhpcy5zYW1wbGVyc1tzYW1wbGVUeXBlXSA9IHNhbXBsZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2FtcGxlcjtcbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICAgICAqIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vdGV4dHVyZS5qcycpLlRleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZS5cbiAgICAgKi9cbiAgICB1cGxvYWRJbW1lZGlhdGUoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCkge1xuICAgICAgICAgICAgdGhpcy51cGxvYWREYXRhKGRldmljZSk7XG5cbiAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdwdS1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJncHVHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gICAgICogZGV2aWNlLlxuICAgICAqL1xuICAgIHVwbG9hZERhdGEoZGV2aWNlKSB7XG5cbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcbiAgICAgICAgaWYgKHRleHR1cmUuX2xldmVscykge1xuXG4gICAgICAgICAgICAvLyB1cGxvYWQgdGV4dHVyZSBkYXRhIGlmIGFueVxuICAgICAgICAgICAgbGV0IGFueVVwbG9hZHMgPSBmYWxzZTtcbiAgICAgICAgICAgIGxldCBhbnlMZXZlbE1pc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVpcmVkTWlwTGV2ZWxzID0gdGV4dHVyZS5yZXF1aXJlZE1pcExldmVscztcbiAgICAgICAgICAgIGZvciAobGV0IG1pcExldmVsID0gMDsgbWlwTGV2ZWwgPCByZXF1aXJlZE1pcExldmVsczsgbWlwTGV2ZWwrKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbWlwT2JqZWN0ID0gdGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXTtcbiAgICAgICAgICAgICAgICBpZiAobWlwT2JqZWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFjZVNvdXJjZSA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmFjZVNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0V4dGVybmFsSW1hZ2UoZmFjZVNvdXJjZSkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWRFeHRlcm5hbEltYWdlKGRldmljZSwgZmFjZVNvdXJjZSwgbWlwTGV2ZWwsIGZhY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW55VXBsb2FkcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoZmFjZVNvdXJjZSkpIHsgLy8gdHlwZWQgYXJyYXlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWRUeXBlZEFycmF5RGF0YShkZXZpY2UsIGZhY2VTb3VyY2UsIG1pcExldmVsLCBmYWNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueVVwbG9hZHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKCdVbnN1cHBvcnRlZCB0ZXh0dXJlIHNvdXJjZSBkYXRhIGZvciBjdWJlbWFwIGZhY2UnLCBmYWNlU291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueUxldmVsTWlzc2luZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGV4dHVyZS5fdm9sdW1lKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1ZvbHVtZSB0ZXh0dXJlIGRhdGEgdXBsb2FkIGlzIG5vdCBzdXBwb3J0ZWQgeWV0JywgdGhpcy50ZXh0dXJlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmUuYXJyYXkpIHsgLy8gdGV4dHVyZSBhcnJheVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZS5hcnJheUxlbmd0aCA9PT0gbWlwT2JqZWN0Lmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRleHR1cmUuX2FycmF5TGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFycmF5U291cmNlID0gbWlwT2JqZWN0W2luZGV4XTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0V4dGVybmFsSW1hZ2UoYXJyYXlTb3VyY2UpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkRXh0ZXJuYWxJbWFnZShkZXZpY2UsIGFycmF5U291cmNlLCBtaXBMZXZlbCwgaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW55VXBsb2FkcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoYXJyYXlTb3VyY2UpKSB7IC8vIHR5cGVkIGFycmF5XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkVHlwZWRBcnJheURhdGEoZGV2aWNlLCBhcnJheVNvdXJjZSwgbWlwTGV2ZWwsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueVVwbG9hZHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKCdVbnN1cHBvcnRlZCB0ZXh0dXJlIHNvdXJjZSBkYXRhIGZvciB0ZXh0dXJlIGFycmF5IGVudHJ5JywgYXJyYXlTb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnlMZXZlbE1pc3NpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIDJkIHRleHR1cmVcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNFeHRlcm5hbEltYWdlKG1pcE9iamVjdCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkRXh0ZXJuYWxJbWFnZShkZXZpY2UsIG1pcE9iamVjdCwgbWlwTGV2ZWwsIDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueVVwbG9hZHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhtaXBPYmplY3QpKSB7IC8vIHR5cGVkIGFycmF5XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZFR5cGVkQXJyYXlEYXRhKGRldmljZSwgbWlwT2JqZWN0LCBtaXBMZXZlbCwgMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYW55VXBsb2FkcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignVW5zdXBwb3J0ZWQgdGV4dHVyZSBzb3VyY2UgZGF0YScsIG1pcE9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhbnlMZXZlbE1pc3NpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFueVVwbG9hZHMgJiYgYW55TGV2ZWxNaXNzaW5nICYmIHRleHR1cmUubWlwbWFwcyAmJiAhaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQodGV4dHVyZS5mb3JtYXQpKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLm1pcG1hcFJlbmRlcmVyLmdlbmVyYXRlKHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgdnJhbSBzdGF0c1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuX2dwdVNpemUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRleHR1cmUuX2dwdVNpemUgPSB0ZXh0dXJlLmdwdVNpemU7XG4gICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCB0ZXh0dXJlLl9ncHVTaXplKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGltYWdlIHR5cGVzIHN1cHBvcnRlZCBieSBjb3B5RXh0ZXJuYWxJbWFnZVRvVGV4dHVyZVxuICAgIGlzRXh0ZXJuYWxJbWFnZShpbWFnZSkge1xuICAgICAgICByZXR1cm4gKGltYWdlIGluc3RhbmNlb2YgSW1hZ2VCaXRtYXApIHx8XG4gICAgICAgICAgICAoaW1hZ2UgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50KSB8fFxuICAgICAgICAgICAgKGltYWdlIGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQpIHx8XG4gICAgICAgICAgICAoaW1hZ2UgaW5zdGFuY2VvZiBPZmZzY3JlZW5DYW52YXMpO1xuICAgIH1cblxuICAgIHVwbG9hZEV4dGVybmFsSW1hZ2UoZGV2aWNlLCBpbWFnZSwgbWlwTGV2ZWwsIGluZGV4KSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KG1pcExldmVsIDwgdGhpcy5kZXNjci5taXBMZXZlbENvdW50LCBgQWNjZXNzaW5nIG1pcCBsZXZlbCAke21pcExldmVsfSBvZiB0ZXh0dXJlIHdpdGggJHt0aGlzLmRlc2NyLm1pcExldmVsQ291bnR9IG1pcCBsZXZlbHNgLCB0aGlzKTtcblxuICAgICAgICBjb25zdCBzcmMgPSB7XG4gICAgICAgICAgICBzb3VyY2U6IGltYWdlLFxuICAgICAgICAgICAgb3JpZ2luOiBbMCwgMF0sXG4gICAgICAgICAgICBmbGlwWTogZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBkc3QgPSB7XG4gICAgICAgICAgICB0ZXh0dXJlOiB0aGlzLmdwdVRleHR1cmUsXG4gICAgICAgICAgICBtaXBMZXZlbDogbWlwTGV2ZWwsXG4gICAgICAgICAgICBvcmlnaW46IFswLCAwLCBpbmRleF0sXG4gICAgICAgICAgICBhc3BlY3Q6ICdhbGwnICAvLyBjYW4gYmU6IFwiYWxsXCIsIFwic3RlbmNpbC1vbmx5XCIsIFwiZGVwdGgtb25seVwiXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgY29weVNpemUgPSB7XG4gICAgICAgICAgICB3aWR0aDogdGhpcy5kZXNjci5zaXplLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmRlc2NyLnNpemUuaGVpZ2h0LFxuICAgICAgICAgICAgZGVwdGhPckFycmF5TGF5ZXJzOiAxICAgLy8gc2luZ2xlIGxheWVyXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gc3VibWl0IGV4aXN0aW5nIHNjaGVkdWxlZCBjb21tYW5kcyB0byB0aGUgcXVldWUgYmVmb3JlIGNvcHlpbmcgdG8gcHJlc2VydmUgdGhlIG9yZGVyXG4gICAgICAgIGRldmljZS5zdWJtaXQoKTtcblxuICAgICAgICAvLyBjcmVhdGUgMmQgY29udGV4dCBzbyB3ZWJncHUgY2FuIHVwbG9hZCB0aGUgdGV4dHVyZVxuICAgICAgICBkdW1teVVzZShpbWFnZSBpbnN0YW5jZW9mIEhUTUxDYW52YXNFbGVtZW50ICYmIGltYWdlLmdldENvbnRleHQoJzJkJykpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX1FVRVVFLCBgSU1BR0UtVE8tVEVYOiBtaXA6JHttaXBMZXZlbH0gaW5kZXg6JHtpbmRleH0gJHt0aGlzLnRleHR1cmUubmFtZX1gKTtcbiAgICAgICAgZGV2aWNlLndncHUucXVldWUuY29weUV4dGVybmFsSW1hZ2VUb1RleHR1cmUoc3JjLCBkc3QsIGNvcHlTaXplKTtcbiAgICB9XG5cbiAgICB1cGxvYWRUeXBlZEFycmF5RGF0YShkZXZpY2UsIGRhdGEsIG1pcExldmVsLCBpbmRleCkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcblxuICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgIGNvbnN0IGRlc3QgPSB7XG4gICAgICAgICAgICB0ZXh0dXJlOiB0aGlzLmdwdVRleHR1cmUsXG4gICAgICAgICAgICBvcmlnaW46IFswLCAwLCBpbmRleF0sXG4gICAgICAgICAgICBtaXBMZXZlbDogbWlwTGV2ZWxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyB0ZXh0dXJlIGRpbWVuc2lvbnMgYXQgdGhlIHNwZWNpZmllZCBtaXAgbGV2ZWxcbiAgICAgICAgY29uc3Qgd2lkdGggPSBUZXh0dXJlVXRpbHMuY2FsY0xldmVsRGltZW5zaW9uKHRleHR1cmUud2lkdGgsIG1pcExldmVsKTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gVGV4dHVyZVV0aWxzLmNhbGNMZXZlbERpbWVuc2lvbih0ZXh0dXJlLmhlaWdodCwgbWlwTGV2ZWwpO1xuXG4gICAgICAgIC8vIGRhdGEgc2l6ZXNcbiAgICAgICAgY29uc3QgYnl0ZVNpemUgPSBUZXh0dXJlVXRpbHMuY2FsY0xldmVsR3B1U2l6ZSh3aWR0aCwgaGVpZ2h0LCAxLCB0ZXh0dXJlLmZvcm1hdCk7XG4gICAgICAgIERlYnVnLmFzc2VydChieXRlU2l6ZSA9PT0gZGF0YS5ieXRlTGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgYEVycm9yIHVwbG9hZGluZyBkYXRhIHRvIHRleHR1cmUsIHRoZSBkYXRhIGJ5dGUgc2l6ZSBvZiAke2RhdGEuYnl0ZUxlbmd0aH0gZG9lcyBub3QgbWF0Y2ggcmVxdWlyZWQgJHtieXRlU2l6ZX1gLCB0ZXh0dXJlKTtcblxuICAgICAgICBjb25zdCBmb3JtYXRJbmZvID0gcGl4ZWxGb3JtYXRJbmZvLmdldCh0ZXh0dXJlLmZvcm1hdCk7XG4gICAgICAgIERlYnVnLmFzc2VydChmb3JtYXRJbmZvKTtcblxuICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlRGF0YUxheW91dH0gKi9cbiAgICAgICAgbGV0IGRhdGFMYXlvdXQ7XG4gICAgICAgIGxldCBzaXplO1xuXG4gICAgICAgIGlmIChmb3JtYXRJbmZvLnNpemUpIHtcbiAgICAgICAgICAgIC8vIHVuY29tcHJlc3NlZCBmb3JtYXRcbiAgICAgICAgICAgIGRhdGFMYXlvdXQgPSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIGJ5dGVzUGVyUm93OiBmb3JtYXRJbmZvLnNpemUgKiB3aWR0aCxcbiAgICAgICAgICAgICAgICByb3dzUGVySW1hZ2U6IGhlaWdodFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNpemUgPSB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdEluZm8uYmxvY2tTaXplKSB7XG4gICAgICAgICAgICAvLyBjb21wcmVzc2VkIGZvcm1hdFxuICAgICAgICAgICAgY29uc3QgYmxvY2tEaW0gPSAoc2l6ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKChzaXplICsgMykgLyA0KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhTGF5b3V0ID0ge1xuICAgICAgICAgICAgICAgIG9mZnNldDogMCxcbiAgICAgICAgICAgICAgICBieXRlc1BlclJvdzogZm9ybWF0SW5mby5ibG9ja1NpemUgKiBibG9ja0RpbSh3aWR0aCksXG4gICAgICAgICAgICAgICAgcm93c1BlckltYWdlOiBibG9ja0RpbShoZWlnaHQpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2l6ZSA9IHtcbiAgICAgICAgICAgICAgICB3aWR0aDogTWF0aC5tYXgoNCwgd2lkdGgpLFxuICAgICAgICAgICAgICAgIGhlaWdodDogTWF0aC5tYXgoNCwgaGVpZ2h0KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChmYWxzZSwgYFdlYkdQVSBkb2VzIG5vdCB5ZXQgc3VwcG9ydCB0ZXh0dXJlIGZvcm1hdCAke2Zvcm1hdEluZm8ubmFtZX0gZm9yIHRleHR1cmUgJHt0ZXh0dXJlLm5hbWV9YCwgdGV4dHVyZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdWJtaXQgZXhpc3Rpbmcgc2NoZWR1bGVkIGNvbW1hbmRzIHRvIHRoZSBxdWV1ZSBiZWZvcmUgY29weWluZyB0byBwcmVzZXJ2ZSB0aGUgb3JkZXJcbiAgICAgICAgZGV2aWNlLnN1Ym1pdCgpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX1FVRVVFLCBgV1JJVEUtVEVYOiBtaXA6JHttaXBMZXZlbH0gaW5kZXg6JHtpbmRleH0gJHt0aGlzLnRleHR1cmUubmFtZX1gKTtcbiAgICAgICAgd2dwdS5xdWV1ZS53cml0ZVRleHR1cmUoZGVzdCwgZGF0YSwgZGF0YUxheW91dCwgc2l6ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiZ3B1QWRkcmVzc01vZGVzIiwiQUREUkVTU19SRVBFQVQiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX01JUlJPUkVEX1JFUEVBVCIsImdwdUZpbHRlck1vZGVzIiwiRklMVEVSX05FQVJFU1QiLCJsZXZlbCIsIm1pcCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiZHVtbXlVc2UiLCJ0aGluZ09uZSIsIldlYmdwdVRleHR1cmUiLCJjb25zdHJ1Y3RvciIsInRleHR1cmUiLCJncHVUZXh0dXJlIiwidmlldyIsInNhbXBsZXJzIiwiZGVzY3IiLCJmb3JtYXQiLCJncHVUZXh0dXJlRm9ybWF0cyIsIkRlYnVnIiwiYXNzZXJ0IiwibmFtZSIsImNyZWF0ZSIsImRldmljZSIsIndncHUiLCJtaXBMZXZlbENvdW50IiwicmVxdWlyZWRNaXBMZXZlbHMiLCJ3aWR0aCIsImhlaWdodCIsInNpemUiLCJkZXB0aE9yQXJyYXlMYXllcnMiLCJjdWJlbWFwIiwiYXJyYXkiLCJhcnJheUxlbmd0aCIsInNhbXBsZUNvdW50IiwiZGltZW5zaW9uIiwidm9sdW1lIiwidXNhZ2UiLCJHUFVUZXh0dXJlVXNhZ2UiLCJURVhUVVJFX0JJTkRJTkciLCJDT1BZX0RTVCIsIkNPUFlfU1JDIiwiaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQiLCJSRU5ERVJfQVRUQUNITUVOVCIsInN0b3JhZ2UiLCJTVE9SQUdFX0JJTkRJTkciLCJXZWJncHVEZWJ1ZyIsInZhbGlkYXRlIiwiY3JlYXRlVGV4dHVyZSIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJlbmQiLCJ2aWV3RGVzY3IiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJhc3BlY3QiLCJjcmVhdGVWaWV3IiwiZGVzdHJveSIsInByb3BlcnR5Q2hhbmdlZCIsImZsYWciLCJsZW5ndGgiLCJnZXRWaWV3IiwidXBsb2FkSW1tZWRpYXRlIiwiX29wdGlvbnMkZm9ybWF0IiwiX29wdGlvbnMkZGltZW5zaW9uIiwiX29wdGlvbnMkYXNwZWN0IiwiX29wdGlvbnMkYmFzZU1pcExldmVsIiwiX29wdGlvbnMkbWlwTGV2ZWxDb3VuIiwiX29wdGlvbnMkYmFzZUFycmF5TGF5IiwiX29wdGlvbnMkYXJyYXlMYXllckNvIiwib3B0aW9ucyIsInRleHR1cmVEZXNjciIsImRlZmF1bHRWaWV3RGltZW5zaW9uIiwiYmFzZU1pcExldmVsIiwiYmFzZUFycmF5TGF5ZXIiLCJhcnJheUxheWVyQ291bnQiLCJKU09OIiwic3RyaW5naWZ5IiwiZ2V0U2FtcGxlciIsInNhbXBsZVR5cGUiLCJzYW1wbGVyIiwibGFiZWwiLCJhZGRyZXNzTW9kZVUiLCJhZGRyZXNzVSIsImFkZHJlc3NNb2RlViIsImFkZHJlc3NWIiwiYWRkcmVzc01vZGVXIiwiYWRkcmVzc1ciLCJjb21wYXJlT25SZWFkIiwiU0FNUExFVFlQRV9ERVBUSCIsIlNBTVBMRVRZUEVfSU5UIiwiU0FNUExFVFlQRV9VSU5UIiwiY29tcGFyZSIsIm1hZ0ZpbHRlciIsIm1pbkZpbHRlciIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwibWlwbWFwRmlsdGVyIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJpc0ludGVnZXJQaXhlbEZvcm1hdCIsImNhbGwiLCJhbGxMaW5lYXIiLCJtYXhBbmlzb3Ryb3B5IiwibWF0aCIsImNsYW1wIiwiTWF0aCIsInJvdW5kIiwiX2FuaXNvdHJvcHkiLCJtYXhUZXh0dXJlQW5pc290cm9weSIsImNyZWF0ZVNhbXBsZXIiLCJsb3NlQ29udGV4dCIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJ1cGxvYWREYXRhIiwiX2xldmVscyIsImFueVVwbG9hZHMiLCJhbnlMZXZlbE1pc3NpbmciLCJtaXBMZXZlbCIsIm1pcE9iamVjdCIsImZhY2UiLCJmYWNlU291cmNlIiwiaXNFeHRlcm5hbEltYWdlIiwidXBsb2FkRXh0ZXJuYWxJbWFnZSIsIkFycmF5QnVmZmVyIiwiaXNWaWV3IiwidXBsb2FkVHlwZWRBcnJheURhdGEiLCJlcnJvciIsIl92b2x1bWUiLCJ3YXJuIiwiaW5kZXgiLCJfYXJyYXlMZW5ndGgiLCJhcnJheVNvdXJjZSIsIm1pcG1hcHMiLCJtaXBtYXBSZW5kZXJlciIsImdlbmVyYXRlIiwiX2dwdVNpemUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJncHVTaXplIiwiaW1hZ2UiLCJJbWFnZUJpdG1hcCIsIkhUTUxWaWRlb0VsZW1lbnQiLCJIVE1MQ2FudmFzRWxlbWVudCIsIk9mZnNjcmVlbkNhbnZhcyIsInNyYyIsInNvdXJjZSIsIm9yaWdpbiIsImZsaXBZIiwiZHN0IiwiY29weVNpemUiLCJzdWJtaXQiLCJnZXRDb250ZXh0IiwidHJhY2UiLCJUUkFDRUlEX1JFTkRFUl9RVUVVRSIsInF1ZXVlIiwiY29weUV4dGVybmFsSW1hZ2VUb1RleHR1cmUiLCJkYXRhIiwiZGVzdCIsIlRleHR1cmVVdGlscyIsImNhbGNMZXZlbERpbWVuc2lvbiIsImJ5dGVTaXplIiwiY2FsY0xldmVsR3B1U2l6ZSIsImJ5dGVMZW5ndGgiLCJmb3JtYXRJbmZvIiwicGl4ZWxGb3JtYXRJbmZvIiwiZ2V0IiwiZGF0YUxheW91dCIsIm9mZnNldCIsImJ5dGVzUGVyUm93Iiwicm93c1BlckltYWdlIiwiYmxvY2tTaXplIiwiYmxvY2tEaW0iLCJmbG9vciIsIm1heCIsIndyaXRlVGV4dHVyZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkE7QUFDQSxNQUFNQSxlQUFlLEdBQUcsRUFBRSxDQUFBO0FBQzFCQSxlQUFlLENBQUNDLGNBQWMsQ0FBQyxHQUFHLFFBQVEsQ0FBQTtBQUMxQ0QsZUFBZSxDQUFDRSxxQkFBcUIsQ0FBQyxHQUFHLGVBQWUsQ0FBQTtBQUN4REYsZUFBZSxDQUFDRyx1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
