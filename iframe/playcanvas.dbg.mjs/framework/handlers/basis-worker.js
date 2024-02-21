// Basis worker
function BasisWorker() {
  // basis compression format enums, reproduced here
  const BASIS_FORMAT = {
    cTFETC1: 0,
    // etc1
    cTFETC2: 1,
    // etc2
    cTFBC1: 2,
    // dxt1
    cTFBC3: 3,
    // dxt5
    cTFPVRTC1_4_RGB: 8,
    // PVRTC1 rgb
    cTFPVRTC1_4_RGBA: 9,
    // PVRTC1 rgba
    cTFASTC_4x4: 10,
    // ASTC
    cTFATC_RGB: 11,
    // ATC rgb
    cTFATC_RGBA_INTERPOLATED_ALPHA: 12,
    // ATC rgba
    // uncompressed (fallback) formats
    cTFRGBA32: 13,
    // rgba 8888
    cTFRGB565: 14,
    // rgb 565
    cTFRGBA4444: 16 // rgba 4444
  };

  // map of GPU to basis format for textures without alpha
  const opaqueMapping = {
    astc: BASIS_FORMAT.cTFASTC_4x4,
    dxt: BASIS_FORMAT.cTFBC1,
    etc1: BASIS_FORMAT.cTFETC1,
    etc2: BASIS_FORMAT.cTFETC1,
    pvr: BASIS_FORMAT.cTFPVRTC1_4_RGB,
    atc: BASIS_FORMAT.cTFATC_RGB,
    none: BASIS_FORMAT.cTFRGB565
  };

  // map of GPU to basis format for textures with alpha
  const alphaMapping = {
    astc: BASIS_FORMAT.cTFASTC_4x4,
    dxt: BASIS_FORMAT.cTFBC3,
    etc1: BASIS_FORMAT.cTFRGBA4444,
    etc2: BASIS_FORMAT.cTFETC2,
    pvr: BASIS_FORMAT.cTFPVRTC1_4_RGBA,
    atc: BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA,
    none: BASIS_FORMAT.cTFRGBA4444
  };

  // engine pixel format constants, reproduced here
  const PIXEL_FORMAT = {
    ETC1: 21,
    ETC2_RGB: 22,
    ETC2_RGBA: 23,
    DXT1: 8,
    DXT5: 10,
    PVRTC_4BPP_RGB_1: 26,
    PVRTC_4BPP_RGBA_1: 27,
    ASTC_4x4: 28,
    ATC_RGB: 29,
    ATC_RGBA: 30,
    R8_G8_B8_A8: 7,
    R5_G6_B5: 3,
    R4_G4_B4_A4: 5
  };

  // map of basis format to engine pixel format
  const basisToEngineMapping = (basisFormat, deviceDetails) => {
    switch (basisFormat) {
      case BASIS_FORMAT.cTFETC1:
        return deviceDetails.formats.etc1 ? PIXEL_FORMAT.ETC1 : PIXEL_FORMAT.ETC2_RGB;
      case BASIS_FORMAT.cTFETC2:
        return PIXEL_FORMAT.ETC2_RGBA;
      case BASIS_FORMAT.cTFBC1:
        return PIXEL_FORMAT.DXT1;
      case BASIS_FORMAT.cTFBC3:
        return PIXEL_FORMAT.DXT5;
      case BASIS_FORMAT.cTFPVRTC1_4_RGB:
        return PIXEL_FORMAT.PVRTC_4BPP_RGB_1;
      case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
        return PIXEL_FORMAT.PVRTC_4BPP_RGBA_1;
      case BASIS_FORMAT.cTFASTC_4x4:
        return PIXEL_FORMAT.ASTC_4x4;
      case BASIS_FORMAT.cTFATC_RGB:
        return PIXEL_FORMAT.ATC_RGB;
      case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
        return PIXEL_FORMAT.ATC_RGBA;
      case BASIS_FORMAT.cTFRGBA32:
        return PIXEL_FORMAT.R8_G8_B8_A8;
      case BASIS_FORMAT.cTFRGB565:
        return PIXEL_FORMAT.R5_G6_B5;
      case BASIS_FORMAT.cTFRGBA4444:
        return PIXEL_FORMAT.R4_G4_B4_A4;
    }
  };

  // unswizzle two-component gggr8888 normal data into rgba8888
  const unswizzleGGGR = data => {
    // given R and G generate B
    const genB = function genB(R, G) {
      const r = R * (2.0 / 255.0) - 1.0;
      const g = G * (2.0 / 255.0) - 1.0;
      const b = Math.sqrt(1.0 - Math.min(1.0, r * r + g * g));
      return Math.max(0, Math.min(255, Math.floor((b + 1.0) * 0.5 * 255.0)));
    };
    for (let offset = 0; offset < data.length; offset += 4) {
      const R = data[offset + 3];
      const G = data[offset + 1];
      data[offset + 0] = R;
      data[offset + 2] = genB(R, G);
      data[offset + 3] = 255;
    }
    return data;
  };

  // pack rgba8888 data into rgb565
  const pack565 = data => {
    const result = new Uint16Array(data.length / 4);
    for (let offset = 0; offset < data.length; offset += 4) {
      const R = data[offset + 0];
      const G = data[offset + 1];
      const B = data[offset + 2];
      result[offset / 4] = (R & 0xf8) << 8 |
      // 5
      (G & 0xfc) << 3 |
      // 6
      B >> 3; // 5
    }

    return result;
  };
  const isPOT = (width, height) => {
    return (width & width - 1) === 0 && (height & height - 1) === 0;
  };
  const performanceNow = () => {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  };

  // globals, set on worker init
  let basis;
  let rgbPriority;
  let rgbaPriority;
  const chooseTargetFormat = (deviceDetails, hasAlpha, isUASTC) => {
    // attempt to match file compression scheme with runtime compression
    if (isUASTC) {
      if (deviceDetails.formats.astc) {
        return 'astc';
      }
    } else {
      if (hasAlpha) {
        if (deviceDetails.formats.etc2) {
          return 'etc2';
        }
      } else {
        if (deviceDetails.formats.etc1 || deviceDetails.formats.etc2) {
          return 'etc1';
        }
      }
    }
    const testInOrder = priority => {
      for (let i = 0; i < priority.length; ++i) {
        const format = priority[i];
        if (deviceDetails.formats[format]) {
          return format;
        }
      }
      return 'none';
    };
    return testInOrder(hasAlpha ? rgbaPriority : rgbPriority);
  };

  // return true if the texture dimensions are valid for the target format
  const dimensionsValid = (width, height, format, webgl2) => {
    switch (format) {
      // etc1, 2
      case BASIS_FORMAT.cTFETC1:
      case BASIS_FORMAT.cTFETC2:
        // no size restrictions
        return true;
      // dxt1, 5
      case BASIS_FORMAT.cTFBC1:
      case BASIS_FORMAT.cTFBC3:
        // width and height must be multiple of 4
        return (width & 0x3) === 0 && (height & 0x3) === 0;
      // pvrtc
      case BASIS_FORMAT.cTFPVRTC1_4_RGB:
      case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
        return isPOT(width, height) && (width === height || webgl2);
      // astc
      case BASIS_FORMAT.cTFASTC_4x4:
        return true;
      // atc
      case BASIS_FORMAT.cTFATC_RGB:
      case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
        // TODO: remove atc support? looks like it's been removed from the webgl spec, see
        // https://www.khronos.org/registry/webgl/extensions/rejected/WEBGL_compressed_texture_atc/
        return true;
    }
    return false;
  };
  const transcodeKTX2 = (url, data, options) => {
    if (!basis.KTX2File) {
      throw new Error('Basis transcoder module does not include support for KTX2.');
    }
    const funcStart = performanceNow();
    const basisFile = new basis.KTX2File(new Uint8Array(data));
    const width = basisFile.getWidth();
    const height = basisFile.getHeight();
    const levels = basisFile.getLevels();
    const hasAlpha = !!basisFile.getHasAlpha();
    const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
    if (!width || !height || !levels) {
      basisFile.close();
      basisFile.delete();
      throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} levels=${levels}`);
    }

    // choose the target format
    const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

    // unswizzle gggr textures under pvr compression
    const unswizzle = !!options.isGGGR && format === 'pvr';

    // convert to basis format taking into consideration platform restrictions
    let basisFormat;
    if (unswizzle) {
      // in order to unswizzle we need gggr8888
      basisFormat = BASIS_FORMAT.cTFRGBA32;
    } else {
      // select output format based on supported formats
      basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

      // if image dimensions don't work on target, fall back to uncompressed
      if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
        basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
      }
    }
    if (!basisFile.startTranscoding()) {
      basisFile.close();
      basisFile.delete();
      throw new Error('Failed to start transcoding url=' + url);
    }
    let i;
    const levelData = [];
    for (let mip = 0; mip < levels; ++mip) {
      const dstSize = basisFile.getImageTranscodedSizeInBytes(mip, 0, 0, basisFormat);
      const dst = new Uint8Array(dstSize);
      if (!basisFile.transcodeImage(dst, mip, 0, 0, basisFormat, 0, -1, -1)) {
        basisFile.close();
        basisFile.delete();
        throw new Error('Failed to transcode image url=' + url);
      }
      const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
      levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
    }
    basisFile.close();
    basisFile.delete();

    // handle unswizzle option
    if (unswizzle) {
      basisFormat = BASIS_FORMAT.cTFRGB565;
      for (i = 0; i < levelData.length; ++i) {
        levelData[i] = pack565(unswizzleGGGR(levelData[i]));
      }
    }
    return {
      format: basisToEngineMapping(basisFormat, options.deviceDetails),
      width: width,
      height: height,
      levels: levelData,
      cubemap: false,
      transcodeTime: performanceNow() - funcStart,
      url: url,
      unswizzledGGGR: unswizzle
    };
  };

  // transcode the basis super-compressed data into one of the runtime gpu native formats
  const transcodeBasis = (url, data, options) => {
    const funcStart = performanceNow();
    const basisFile = new basis.BasisFile(new Uint8Array(data));
    const width = basisFile.getImageWidth(0, 0);
    const height = basisFile.getImageHeight(0, 0);
    const images = basisFile.getNumImages();
    const levels = basisFile.getNumLevels(0);
    const hasAlpha = !!basisFile.getHasAlpha();
    const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
    if (!width || !height || !images || !levels) {
      basisFile.close();
      basisFile.delete();
      throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} images=${images} levels=${levels}`);
    }

    // choose the target format
    const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

    // unswizzle gggr textures under pvr compression
    const unswizzle = !!options.isGGGR && format === 'pvr';

    // convert to basis format taking into consideration platform restrictions
    let basisFormat;
    if (unswizzle) {
      // in order to unswizzle we need gggr8888
      basisFormat = BASIS_FORMAT.cTFRGBA32;
    } else {
      // select output format based on supported formats
      basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

      // if image dimensions don't work on target, fall back to uncompressed
      if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
        basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
      }
    }
    if (!basisFile.startTranscoding()) {
      basisFile.close();
      basisFile.delete();
      throw new Error('Failed to start transcoding url=' + url);
    }
    let i;
    const levelData = [];
    for (let mip = 0; mip < levels; ++mip) {
      const dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
      const dst = new Uint8Array(dstSize);
      if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 0, 0)) {
        if (mip === levels - 1 && dstSize === levelData[mip - 1].buffer.byteLength) {
          // https://github.com/BinomialLLC/basis_universal/issues/358
          // there is a regression on iOS/safari 17 where the last mipmap level
          // fails to transcode. this is a workaround which copies the previous mip
          // level data instead of failing.
          dst.set(new Uint8Array(levelData[mip - 1].buffer));
          console.warn('Failed to transcode last mipmap level, using previous level instead url=' + url);
        } else {
          basisFile.close();
          basisFile.delete();
          throw new Error('Failed to transcode image url=' + url);
        }
      }
      const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
      levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
    }
    basisFile.close();
    basisFile.delete();

    // handle unswizzle option
    if (unswizzle) {
      basisFormat = BASIS_FORMAT.cTFRGB565;
      for (i = 0; i < levelData.length; ++i) {
        levelData[i] = pack565(unswizzleGGGR(levelData[i]));
      }
    }
    return {
      format: basisToEngineMapping(basisFormat, options.deviceDetails),
      width: width,
      height: height,
      levels: levelData,
      cubemap: false,
      transcodeTime: performanceNow() - funcStart,
      url: url,
      unswizzledGGGR: unswizzle
    };
  };
  const transcode = (url, data, options) => {
    return options.isKTX2 ? transcodeKTX2(url, data, options) : transcodeBasis(url, data, options);
  };

  // download and transcode the file given the basis module and
  // file url
  const workerTranscode = (url, data, options) => {
    try {
      const result = transcode(url, data, options);
      result.levels = result.levels.map(v => v.buffer);
      self.postMessage({
        url: url,
        data: result
      }, result.levels);
    } catch (err) {
      self.postMessage({
        url: url,
        err: err
      }, null);
    }
  };
  const workerInit = (config, callback) => {
    // initialize the wasm module
    const instantiateWasmFunc = (imports, successCallback) => {
      WebAssembly.instantiate(config.module, imports).then(result => {
        successCallback(result);
      }).catch(reason => {
        console.error('instantiate failed + ' + reason);
      });
      return {};
    };
    self.BASIS(config.module ? {
      instantiateWasm: instantiateWasmFunc
    } : null).then(instance => {
      instance.initializeBasis();

      // set globals
      basis = instance;
      rgbPriority = config.rgbPriority;
      rgbaPriority = config.rgbaPriority;
      callback(null);
    });
  };

  // handle incoming worker requests
  const queue = [];
  self.onmessage = message => {
    const data = message.data;
    switch (data.type) {
      case 'init':
        workerInit(data.config, () => {
          for (let i = 0; i < queue.length; ++i) {
            workerTranscode(queue[i].url, queue[i].data, queue[i].options);
          }
          queue.length = 0;
        });
        break;
      case 'transcode':
        if (basis) {
          workerTranscode(data.url, data.data, data.options);
        } else {
          queue.push(data);
        }
        break;
    }
  };
}

export { BasisWorker };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaXMtd29ya2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2Jhc2lzLXdvcmtlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBCYXNpcyB3b3JrZXJcbmZ1bmN0aW9uIEJhc2lzV29ya2VyKCkge1xuICAgIC8vIGJhc2lzIGNvbXByZXNzaW9uIGZvcm1hdCBlbnVtcywgcmVwcm9kdWNlZCBoZXJlXG4gICAgY29uc3QgQkFTSVNfRk9STUFUID0ge1xuICAgICAgICBjVEZFVEMxOiAwLCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBldGMxXG4gICAgICAgIGNURkVUQzI6IDEsICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV0YzJcbiAgICAgICAgY1RGQkMxOiAyLCAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZHh0MVxuICAgICAgICBjVEZCQzM6IDMsICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkeHQ1XG4gICAgICAgIGNURlBWUlRDMV80X1JHQjogOCwgICAgICAgICAgICAgICAgIC8vIFBWUlRDMSByZ2JcbiAgICAgICAgY1RGUFZSVEMxXzRfUkdCQTogOSwgICAgICAgICAgICAgICAgLy8gUFZSVEMxIHJnYmFcbiAgICAgICAgY1RGQVNUQ180eDQ6IDEwLCAgICAgICAgICAgICAgICAgICAgLy8gQVNUQ1xuICAgICAgICBjVEZBVENfUkdCOiAxMSwgICAgICAgICAgICAgICAgICAgICAvLyBBVEMgcmdiXG4gICAgICAgIGNURkFUQ19SR0JBX0lOVEVSUE9MQVRFRF9BTFBIQTogMTIsIC8vIEFUQyByZ2JhXG4gICAgICAgIC8vIHVuY29tcHJlc3NlZCAoZmFsbGJhY2spIGZvcm1hdHNcbiAgICAgICAgY1RGUkdCQTMyOiAxMywgICAgICAgICAgICAgICAgICAgICAgLy8gcmdiYSA4ODg4XG4gICAgICAgIGNURlJHQjU2NTogMTQsICAgICAgICAgICAgICAgICAgICAgIC8vIHJnYiA1NjVcbiAgICAgICAgY1RGUkdCQTQ0NDQ6IDE2ICAgICAgICAgICAgICAgICAgICAgLy8gcmdiYSA0NDQ0XG4gICAgfTtcblxuICAgIC8vIG1hcCBvZiBHUFUgdG8gYmFzaXMgZm9ybWF0IGZvciB0ZXh0dXJlcyB3aXRob3V0IGFscGhhXG4gICAgY29uc3Qgb3BhcXVlTWFwcGluZyA9IHtcbiAgICAgICAgYXN0YzogQkFTSVNfRk9STUFULmNURkFTVENfNHg0LFxuICAgICAgICBkeHQ6IEJBU0lTX0ZPUk1BVC5jVEZCQzEsXG4gICAgICAgIGV0YzE6IEJBU0lTX0ZPUk1BVC5jVEZFVEMxLFxuICAgICAgICBldGMyOiBCQVNJU19GT1JNQVQuY1RGRVRDMSxcbiAgICAgICAgcHZyOiBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCLFxuICAgICAgICBhdGM6IEJBU0lTX0ZPUk1BVC5jVEZBVENfUkdCLFxuICAgICAgICBub25lOiBCQVNJU19GT1JNQVQuY1RGUkdCNTY1XG4gICAgfTtcblxuICAgIC8vIG1hcCBvZiBHUFUgdG8gYmFzaXMgZm9ybWF0IGZvciB0ZXh0dXJlcyB3aXRoIGFscGhhXG4gICAgY29uc3QgYWxwaGFNYXBwaW5nID0ge1xuICAgICAgICBhc3RjOiBCQVNJU19GT1JNQVQuY1RGQVNUQ180eDQsXG4gICAgICAgIGR4dDogQkFTSVNfRk9STUFULmNURkJDMyxcbiAgICAgICAgZXRjMTogQkFTSVNfRk9STUFULmNURlJHQkE0NDQ0LFxuICAgICAgICBldGMyOiBCQVNJU19GT1JNQVQuY1RGRVRDMixcbiAgICAgICAgcHZyOiBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCQSxcbiAgICAgICAgYXRjOiBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQkFfSU5URVJQT0xBVEVEX0FMUEhBLFxuICAgICAgICBub25lOiBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDRcbiAgICB9O1xuXG4gICAgLy8gZW5naW5lIHBpeGVsIGZvcm1hdCBjb25zdGFudHMsIHJlcHJvZHVjZWQgaGVyZVxuICAgIGNvbnN0IFBJWEVMX0ZPUk1BVCA9IHtcbiAgICAgICAgRVRDMTogMjEsXG4gICAgICAgIEVUQzJfUkdCOiAyMixcbiAgICAgICAgRVRDMl9SR0JBOiAyMyxcbiAgICAgICAgRFhUMTogOCxcbiAgICAgICAgRFhUNTogMTAsXG4gICAgICAgIFBWUlRDXzRCUFBfUkdCXzE6IDI2LFxuICAgICAgICBQVlJUQ180QlBQX1JHQkFfMTogMjcsXG4gICAgICAgIEFTVENfNHg0OiAyOCxcbiAgICAgICAgQVRDX1JHQjogMjksXG4gICAgICAgIEFUQ19SR0JBOiAzMCxcbiAgICAgICAgUjhfRzhfQjhfQTg6IDcsXG4gICAgICAgIFI1X0c2X0I1OiAzLFxuICAgICAgICBSNF9HNF9CNF9BNDogNVxuICAgIH07XG5cbiAgICAvLyBtYXAgb2YgYmFzaXMgZm9ybWF0IHRvIGVuZ2luZSBwaXhlbCBmb3JtYXRcbiAgICBjb25zdCBiYXNpc1RvRW5naW5lTWFwcGluZyA9IChiYXNpc0Zvcm1hdCwgZGV2aWNlRGV0YWlscykgPT4ge1xuICAgICAgICBzd2l0Y2ggKGJhc2lzRm9ybWF0KSB7XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZFVEMxOiByZXR1cm4gZGV2aWNlRGV0YWlscy5mb3JtYXRzLmV0YzEgPyBQSVhFTF9GT1JNQVQuRVRDMSA6IFBJWEVMX0ZPUk1BVC5FVEMyX1JHQjtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkVUQzI6IHJldHVybiBQSVhFTF9GT1JNQVQuRVRDMl9SR0JBO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQkMxOiByZXR1cm4gUElYRUxfRk9STUFULkRYVDE7XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZCQzM6IHJldHVybiBQSVhFTF9GT1JNQVQuRFhUNTtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURlBWUlRDMV80X1JHQjogcmV0dXJuIFBJWEVMX0ZPUk1BVC5QVlJUQ180QlBQX1JHQl8xO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCQTogcmV0dXJuIFBJWEVMX0ZPUk1BVC5QVlJUQ180QlBQX1JHQkFfMTtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkFTVENfNHg0OiByZXR1cm4gUElYRUxfRk9STUFULkFTVENfNHg0O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQjogcmV0dXJuIFBJWEVMX0ZPUk1BVC5BVENfUkdCO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQkFfSU5URVJQT0xBVEVEX0FMUEhBOiByZXR1cm4gUElYRUxfRk9STUFULkFUQ19SR0JBO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCQTMyOiByZXR1cm4gUElYRUxfRk9STUFULlI4X0c4X0I4X0E4O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1OiByZXR1cm4gUElYRUxfRk9STUFULlI1X0c2X0I1O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDQ6IHJldHVybiBQSVhFTF9GT1JNQVQuUjRfRzRfQjRfQTQ7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gdW5zd2l6emxlIHR3by1jb21wb25lbnQgZ2dncjg4ODggbm9ybWFsIGRhdGEgaW50byByZ2JhODg4OFxuICAgIGNvbnN0IHVuc3dpenpsZUdHR1IgPSAoZGF0YSkgPT4ge1xuICAgICAgICAvLyBnaXZlbiBSIGFuZCBHIGdlbmVyYXRlIEJcbiAgICAgICAgY29uc3QgZ2VuQiA9IGZ1bmN0aW9uIChSLCBHKSB7XG4gICAgICAgICAgICBjb25zdCByID0gUiAqICgyLjAgLyAyNTUuMCkgLSAxLjA7XG4gICAgICAgICAgICBjb25zdCBnID0gRyAqICgyLjAgLyAyNTUuMCkgLSAxLjA7XG4gICAgICAgICAgICBjb25zdCBiID0gTWF0aC5zcXJ0KDEuMCAtIE1hdGgubWluKDEuMCwgciAqIHIgKyBnICogZykpO1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcigoKGIgKyAxLjApICogMC41KSAqIDI1NS4wKSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZvciAobGV0IG9mZnNldCA9IDA7IG9mZnNldCA8IGRhdGEubGVuZ3RoOyBvZmZzZXQgKz0gNCkge1xuICAgICAgICAgICAgY29uc3QgUiA9IGRhdGFbb2Zmc2V0ICsgM107XG4gICAgICAgICAgICBjb25zdCBHID0gZGF0YVtvZmZzZXQgKyAxXTtcbiAgICAgICAgICAgIGRhdGFbb2Zmc2V0ICsgMF0gPSBSO1xuICAgICAgICAgICAgZGF0YVtvZmZzZXQgKyAyXSA9IGdlbkIoUiwgRyk7XG4gICAgICAgICAgICBkYXRhW29mZnNldCArIDNdID0gMjU1O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfTtcblxuICAgIC8vIHBhY2sgcmdiYTg4ODggZGF0YSBpbnRvIHJnYjU2NVxuICAgIGNvbnN0IHBhY2s1NjUgPSAoZGF0YSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDE2QXJyYXkoZGF0YS5sZW5ndGggLyA0KTtcblxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBkYXRhLmxlbmd0aDsgb2Zmc2V0ICs9IDQpIHtcbiAgICAgICAgICAgIGNvbnN0IFIgPSBkYXRhW29mZnNldCArIDBdO1xuICAgICAgICAgICAgY29uc3QgRyA9IGRhdGFbb2Zmc2V0ICsgMV07XG4gICAgICAgICAgICBjb25zdCBCID0gZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgICAgICAgIHJlc3VsdFtvZmZzZXQgLyA0XSA9ICgoUiAmIDB4ZjgpIDw8IDgpIHwgIC8vIDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoRyAmIDB4ZmMpIDw8IDMpIHwgIC8vIDZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoQiA+PiAzKSk7ICAgICAgICAgIC8vIDVcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IGlzUE9UID0gKHdpZHRoLCBoZWlnaHQpID0+IHtcbiAgICAgICAgcmV0dXJuICgod2lkdGggJiAod2lkdGggLSAxKSkgPT09IDApICYmICgoaGVpZ2h0ICYgKGhlaWdodCAtIDEpKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHBlcmZvcm1hbmNlTm93ID0gKCkgPT4ge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBwZXJmb3JtYW5jZSAhPT0gJ3VuZGVmaW5lZCcpID8gcGVyZm9ybWFuY2Uubm93KCkgOiAwO1xuICAgIH07XG5cbiAgICAvLyBnbG9iYWxzLCBzZXQgb24gd29ya2VyIGluaXRcbiAgICBsZXQgYmFzaXM7XG4gICAgbGV0IHJnYlByaW9yaXR5O1xuICAgIGxldCByZ2JhUHJpb3JpdHk7XG5cbiAgICBjb25zdCBjaG9vc2VUYXJnZXRGb3JtYXQgPSAoZGV2aWNlRGV0YWlscywgaGFzQWxwaGEsIGlzVUFTVEMpID0+IHtcbiAgICAgICAgLy8gYXR0ZW1wdCB0byBtYXRjaCBmaWxlIGNvbXByZXNzaW9uIHNjaGVtZSB3aXRoIHJ1bnRpbWUgY29tcHJlc3Npb25cbiAgICAgICAgaWYgKGlzVUFTVEMpIHtcbiAgICAgICAgICAgIGlmIChkZXZpY2VEZXRhaWxzLmZvcm1hdHMuYXN0Yykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnYXN0Yyc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaGFzQWxwaGEpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlRGV0YWlscy5mb3JtYXRzLmV0YzIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdldGMyJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2VEZXRhaWxzLmZvcm1hdHMuZXRjMSB8fCBkZXZpY2VEZXRhaWxzLmZvcm1hdHMuZXRjMikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2V0YzEnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRlc3RJbk9yZGVyID0gKHByaW9yaXR5KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW9yaXR5Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gcHJpb3JpdHlbaV07XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZURldGFpbHMuZm9ybWF0c1tmb3JtYXRdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICdub25lJztcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGVzdEluT3JkZXIoaGFzQWxwaGEgPyByZ2JhUHJpb3JpdHkgOiByZ2JQcmlvcml0eSk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiB0cnVlIGlmIHRoZSB0ZXh0dXJlIGRpbWVuc2lvbnMgYXJlIHZhbGlkIGZvciB0aGUgdGFyZ2V0IGZvcm1hdFxuICAgIGNvbnN0IGRpbWVuc2lvbnNWYWxpZCA9ICh3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIHdlYmdsMikgPT4ge1xuICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgLy8gZXRjMSwgMlxuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGRVRDMTpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkVUQzI6XG4gICAgICAgICAgICAgICAgLy8gbm8gc2l6ZSByZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIC8vIGR4dDEsIDVcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkJDMTpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkJDMzpcbiAgICAgICAgICAgICAgICAvLyB3aWR0aCBhbmQgaGVpZ2h0IG11c3QgYmUgbXVsdGlwbGUgb2YgNFxuICAgICAgICAgICAgICAgIHJldHVybiAoKHdpZHRoICYgMHgzKSA9PT0gMCkgJiYgKChoZWlnaHQgJiAweDMpID09PSAwKTtcbiAgICAgICAgICAgIC8vIHB2cnRjXG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZQVlJUQzFfNF9SR0I6XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZQVlJUQzFfNF9SR0JBOlxuICAgICAgICAgICAgICAgIHJldHVybiBpc1BPVCh3aWR0aCwgaGVpZ2h0KSAmJiAoKHdpZHRoID09PSBoZWlnaHQpIHx8IHdlYmdsMik7XG4gICAgICAgICAgICAvLyBhc3RjXG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZBU1RDXzR4NDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIC8vIGF0Y1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQjpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkFUQ19SR0JBX0lOVEVSUE9MQVRFRF9BTFBIQTpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiByZW1vdmUgYXRjIHN1cHBvcnQ/IGxvb2tzIGxpa2UgaXQncyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgd2ViZ2wgc3BlYywgc2VlXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly93d3cua2hyb25vcy5vcmcvcmVnaXN0cnkvd2ViZ2wvZXh0ZW5zaW9ucy9yZWplY3RlZC9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfYXRjL1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgY29uc3QgdHJhbnNjb2RlS1RYMiA9ICh1cmwsIGRhdGEsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKCFiYXNpcy5LVFgyRmlsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXNpcyB0cmFuc2NvZGVyIG1vZHVsZSBkb2VzIG5vdCBpbmNsdWRlIHN1cHBvcnQgZm9yIEtUWDIuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmdW5jU3RhcnQgPSBwZXJmb3JtYW5jZU5vdygpO1xuICAgICAgICBjb25zdCBiYXNpc0ZpbGUgPSBuZXcgYmFzaXMuS1RYMkZpbGUobmV3IFVpbnQ4QXJyYXkoZGF0YSkpO1xuXG4gICAgICAgIGNvbnN0IHdpZHRoID0gYmFzaXNGaWxlLmdldFdpZHRoKCk7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGJhc2lzRmlsZS5nZXRIZWlnaHQoKTtcbiAgICAgICAgY29uc3QgbGV2ZWxzID0gYmFzaXNGaWxlLmdldExldmVscygpO1xuICAgICAgICBjb25zdCBoYXNBbHBoYSA9ICEhYmFzaXNGaWxlLmdldEhhc0FscGhhKCk7XG4gICAgICAgIGNvbnN0IGlzVUFTVEMgPSBiYXNpc0ZpbGUuaXNVQVNUQyAmJiBiYXNpc0ZpbGUuaXNVQVNUQygpO1xuXG4gICAgICAgIGlmICghd2lkdGggfHwgIWhlaWdodCB8fCAhbGV2ZWxzKSB7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgIGJhc2lzRmlsZS5kZWxldGUoKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpbWFnZSBkaW1lbnNpb25zIHVybD0ke3VybH0gd2lkdGg9JHt3aWR0aH0gaGVpZ2h0PSR7aGVpZ2h0fSBsZXZlbHM9JHtsZXZlbHN9YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaG9vc2UgdGhlIHRhcmdldCBmb3JtYXRcbiAgICAgICAgY29uc3QgZm9ybWF0ID0gY2hvb3NlVGFyZ2V0Rm9ybWF0KG9wdGlvbnMuZGV2aWNlRGV0YWlscywgaGFzQWxwaGEsIGlzVUFTVEMpO1xuXG4gICAgICAgIC8vIHVuc3dpenpsZSBnZ2dyIHRleHR1cmVzIHVuZGVyIHB2ciBjb21wcmVzc2lvblxuICAgICAgICBjb25zdCB1bnN3aXp6bGUgPSAhIW9wdGlvbnMuaXNHR0dSICYmIGZvcm1hdCA9PT0gJ3B2cic7XG5cbiAgICAgICAgLy8gY29udmVydCB0byBiYXNpcyBmb3JtYXQgdGFraW5nIGludG8gY29uc2lkZXJhdGlvbiBwbGF0Zm9ybSByZXN0cmljdGlvbnNcbiAgICAgICAgbGV0IGJhc2lzRm9ybWF0O1xuICAgICAgICBpZiAodW5zd2l6emxlKSB7XG4gICAgICAgICAgICAvLyBpbiBvcmRlciB0byB1bnN3aXp6bGUgd2UgbmVlZCBnZ2dyODg4OFxuICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBCQVNJU19GT1JNQVQuY1RGUkdCQTMyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gc2VsZWN0IG91dHB1dCBmb3JtYXQgYmFzZWQgb24gc3VwcG9ydGVkIGZvcm1hdHNcbiAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gaGFzQWxwaGEgPyBhbHBoYU1hcHBpbmdbZm9ybWF0XSA6IG9wYXF1ZU1hcHBpbmdbZm9ybWF0XTtcblxuICAgICAgICAgICAgLy8gaWYgaW1hZ2UgZGltZW5zaW9ucyBkb24ndCB3b3JrIG9uIHRhcmdldCwgZmFsbCBiYWNrIHRvIHVuY29tcHJlc3NlZFxuICAgICAgICAgICAgaWYgKCFkaW1lbnNpb25zVmFsaWQod2lkdGgsIGhlaWdodCwgYmFzaXNGb3JtYXQsIG9wdGlvbnMuZGV2aWNlRGV0YWlscy53ZWJnbDIpKSB7XG4gICAgICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBoYXNBbHBoYSA/IEJBU0lTX0ZPUk1BVC5jVEZSR0JBMzIgOiBCQVNJU19GT1JNQVQuY1RGUkdCNTY1O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFiYXNpc0ZpbGUuc3RhcnRUcmFuc2NvZGluZygpKSB7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgIGJhc2lzRmlsZS5kZWxldGUoKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHN0YXJ0IHRyYW5zY29kaW5nIHVybD0nICsgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpO1xuXG4gICAgICAgIGNvbnN0IGxldmVsRGF0YSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXAgPSAwOyBtaXAgPCBsZXZlbHM7ICsrbWlwKSB7XG4gICAgICAgICAgICBjb25zdCBkc3RTaXplID0gYmFzaXNGaWxlLmdldEltYWdlVHJhbnNjb2RlZFNpemVJbkJ5dGVzKG1pcCwgMCwgMCwgYmFzaXNGb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgZHN0ID0gbmV3IFVpbnQ4QXJyYXkoZHN0U2l6ZSk7XG5cbiAgICAgICAgICAgIGlmICghYmFzaXNGaWxlLnRyYW5zY29kZUltYWdlKGRzdCwgbWlwLCAwLCAwLCBiYXNpc0Zvcm1hdCwgMCwgLTEsIC0xKSkge1xuICAgICAgICAgICAgICAgIGJhc2lzRmlsZS5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIGJhc2lzRmlsZS5kZWxldGUoKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byB0cmFuc2NvZGUgaW1hZ2UgdXJsPScgKyB1cmwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpczE2Qml0Rm9ybWF0ID0gKGJhc2lzRm9ybWF0ID09PSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1IHx8IGJhc2lzRm9ybWF0ID09PSBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDQpO1xuXG4gICAgICAgICAgICBsZXZlbERhdGEucHVzaChpczE2Qml0Rm9ybWF0ID8gbmV3IFVpbnQxNkFycmF5KGRzdC5idWZmZXIpIDogZHN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhc2lzRmlsZS5jbG9zZSgpO1xuICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG5cbiAgICAgICAgLy8gaGFuZGxlIHVuc3dpenpsZSBvcHRpb25cbiAgICAgICAgaWYgKHVuc3dpenpsZSkge1xuICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1O1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxldmVsRGF0YS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGxldmVsRGF0YVtpXSA9IHBhY2s1NjUodW5zd2l6emxlR0dHUihsZXZlbERhdGFbaV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmb3JtYXQ6IGJhc2lzVG9FbmdpbmVNYXBwaW5nKGJhc2lzRm9ybWF0LCBvcHRpb25zLmRldmljZURldGFpbHMpLFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBsZXZlbHM6IGxldmVsRGF0YSxcbiAgICAgICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNjb2RlVGltZTogcGVyZm9ybWFuY2VOb3coKSAtIGZ1bmNTdGFydCxcbiAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgdW5zd2l6emxlZEdHR1I6IHVuc3dpenpsZVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvLyB0cmFuc2NvZGUgdGhlIGJhc2lzIHN1cGVyLWNvbXByZXNzZWQgZGF0YSBpbnRvIG9uZSBvZiB0aGUgcnVudGltZSBncHUgbmF0aXZlIGZvcm1hdHNcbiAgICBjb25zdCB0cmFuc2NvZGVCYXNpcyA9ICh1cmwsIGRhdGEsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgY29uc3QgZnVuY1N0YXJ0ID0gcGVyZm9ybWFuY2VOb3coKTtcbiAgICAgICAgY29uc3QgYmFzaXNGaWxlID0gbmV3IGJhc2lzLkJhc2lzRmlsZShuZXcgVWludDhBcnJheShkYXRhKSk7XG5cbiAgICAgICAgY29uc3Qgd2lkdGggPSBiYXNpc0ZpbGUuZ2V0SW1hZ2VXaWR0aCgwLCAwKTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gYmFzaXNGaWxlLmdldEltYWdlSGVpZ2h0KDAsIDApO1xuICAgICAgICBjb25zdCBpbWFnZXMgPSBiYXNpc0ZpbGUuZ2V0TnVtSW1hZ2VzKCk7XG4gICAgICAgIGNvbnN0IGxldmVscyA9IGJhc2lzRmlsZS5nZXROdW1MZXZlbHMoMCk7XG4gICAgICAgIGNvbnN0IGhhc0FscGhhID0gISFiYXNpc0ZpbGUuZ2V0SGFzQWxwaGEoKTtcbiAgICAgICAgY29uc3QgaXNVQVNUQyA9IGJhc2lzRmlsZS5pc1VBU1RDICYmIGJhc2lzRmlsZS5pc1VBU1RDKCk7XG5cbiAgICAgICAgaWYgKCF3aWR0aCB8fCAhaGVpZ2h0IHx8ICFpbWFnZXMgfHwgIWxldmVscykge1xuICAgICAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaW1hZ2UgZGltZW5zaW9ucyB1cmw9JHt1cmx9IHdpZHRoPSR7d2lkdGh9IGhlaWdodD0ke2hlaWdodH0gaW1hZ2VzPSR7aW1hZ2VzfSBsZXZlbHM9JHtsZXZlbHN9YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaG9vc2UgdGhlIHRhcmdldCBmb3JtYXRcbiAgICAgICAgY29uc3QgZm9ybWF0ID0gY2hvb3NlVGFyZ2V0Rm9ybWF0KG9wdGlvbnMuZGV2aWNlRGV0YWlscywgaGFzQWxwaGEsIGlzVUFTVEMpO1xuXG4gICAgICAgIC8vIHVuc3dpenpsZSBnZ2dyIHRleHR1cmVzIHVuZGVyIHB2ciBjb21wcmVzc2lvblxuICAgICAgICBjb25zdCB1bnN3aXp6bGUgPSAhIW9wdGlvbnMuaXNHR0dSICYmIGZvcm1hdCA9PT0gJ3B2cic7XG5cbiAgICAgICAgLy8gY29udmVydCB0byBiYXNpcyBmb3JtYXQgdGFraW5nIGludG8gY29uc2lkZXJhdGlvbiBwbGF0Zm9ybSByZXN0cmljdGlvbnNcbiAgICAgICAgbGV0IGJhc2lzRm9ybWF0O1xuICAgICAgICBpZiAodW5zd2l6emxlKSB7XG4gICAgICAgICAgICAvLyBpbiBvcmRlciB0byB1bnN3aXp6bGUgd2UgbmVlZCBnZ2dyODg4OFxuICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBCQVNJU19GT1JNQVQuY1RGUkdCQTMyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gc2VsZWN0IG91dHB1dCBmb3JtYXQgYmFzZWQgb24gc3VwcG9ydGVkIGZvcm1hdHNcbiAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gaGFzQWxwaGEgPyBhbHBoYU1hcHBpbmdbZm9ybWF0XSA6IG9wYXF1ZU1hcHBpbmdbZm9ybWF0XTtcblxuICAgICAgICAgICAgLy8gaWYgaW1hZ2UgZGltZW5zaW9ucyBkb24ndCB3b3JrIG9uIHRhcmdldCwgZmFsbCBiYWNrIHRvIHVuY29tcHJlc3NlZFxuICAgICAgICAgICAgaWYgKCFkaW1lbnNpb25zVmFsaWQod2lkdGgsIGhlaWdodCwgYmFzaXNGb3JtYXQsIG9wdGlvbnMuZGV2aWNlRGV0YWlscy53ZWJnbDIpKSB7XG4gICAgICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBoYXNBbHBoYSA/IEJBU0lTX0ZPUk1BVC5jVEZSR0JBMzIgOiBCQVNJU19GT1JNQVQuY1RGUkdCNTY1O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFiYXNpc0ZpbGUuc3RhcnRUcmFuc2NvZGluZygpKSB7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgIGJhc2lzRmlsZS5kZWxldGUoKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHN0YXJ0IHRyYW5zY29kaW5nIHVybD0nICsgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpO1xuXG4gICAgICAgIGNvbnN0IGxldmVsRGF0YSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXAgPSAwOyBtaXAgPCBsZXZlbHM7ICsrbWlwKSB7XG4gICAgICAgICAgICBjb25zdCBkc3RTaXplID0gYmFzaXNGaWxlLmdldEltYWdlVHJhbnNjb2RlZFNpemVJbkJ5dGVzKDAsIG1pcCwgYmFzaXNGb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgZHN0ID0gbmV3IFVpbnQ4QXJyYXkoZHN0U2l6ZSk7XG5cbiAgICAgICAgICAgIGlmICghYmFzaXNGaWxlLnRyYW5zY29kZUltYWdlKGRzdCwgMCwgbWlwLCBiYXNpc0Zvcm1hdCwgMCwgMCkpIHtcbiAgICAgICAgICAgICAgICBpZiAobWlwID09PSBsZXZlbHMgLSAxICYmIGRzdFNpemUgPT09IGxldmVsRGF0YVttaXAgLSAxXS5idWZmZXIuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vQmlub21pYWxMTEMvYmFzaXNfdW5pdmVyc2FsL2lzc3Vlcy8zNThcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlcmUgaXMgYSByZWdyZXNzaW9uIG9uIGlPUy9zYWZhcmkgMTcgd2hlcmUgdGhlIGxhc3QgbWlwbWFwIGxldmVsXG4gICAgICAgICAgICAgICAgICAgIC8vIGZhaWxzIHRvIHRyYW5zY29kZS4gdGhpcyBpcyBhIHdvcmthcm91bmQgd2hpY2ggY29waWVzIHRoZSBwcmV2aW91cyBtaXBcbiAgICAgICAgICAgICAgICAgICAgLy8gbGV2ZWwgZGF0YSBpbnN0ZWFkIG9mIGZhaWxpbmcuXG4gICAgICAgICAgICAgICAgICAgIGRzdC5zZXQobmV3IFVpbnQ4QXJyYXkobGV2ZWxEYXRhW21pcCAtIDFdLmJ1ZmZlcikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byB0cmFuc2NvZGUgbGFzdCBtaXBtYXAgbGV2ZWwsIHVzaW5nIHByZXZpb3VzIGxldmVsIGluc3RlYWQgdXJsPScgKyB1cmwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJhc2lzRmlsZS5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHRyYW5zY29kZSBpbWFnZSB1cmw9JyArIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpczE2Qml0Rm9ybWF0ID0gKGJhc2lzRm9ybWF0ID09PSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1IHx8IGJhc2lzRm9ybWF0ID09PSBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDQpO1xuXG4gICAgICAgICAgICBsZXZlbERhdGEucHVzaChpczE2Qml0Rm9ybWF0ID8gbmV3IFVpbnQxNkFycmF5KGRzdC5idWZmZXIpIDogZHN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhc2lzRmlsZS5jbG9zZSgpO1xuICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG5cbiAgICAgICAgLy8gaGFuZGxlIHVuc3dpenpsZSBvcHRpb25cbiAgICAgICAgaWYgKHVuc3dpenpsZSkge1xuICAgICAgICAgICAgYmFzaXNGb3JtYXQgPSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1O1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxldmVsRGF0YS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGxldmVsRGF0YVtpXSA9IHBhY2s1NjUodW5zd2l6emxlR0dHUihsZXZlbERhdGFbaV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmb3JtYXQ6IGJhc2lzVG9FbmdpbmVNYXBwaW5nKGJhc2lzRm9ybWF0LCBvcHRpb25zLmRldmljZURldGFpbHMpLFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBsZXZlbHM6IGxldmVsRGF0YSxcbiAgICAgICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNjb2RlVGltZTogcGVyZm9ybWFuY2VOb3coKSAtIGZ1bmNTdGFydCxcbiAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgdW5zd2l6emxlZEdHR1I6IHVuc3dpenpsZVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBjb25zdCB0cmFuc2NvZGUgPSAodXJsLCBkYXRhLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmlzS1RYMiA/IHRyYW5zY29kZUtUWDIodXJsLCBkYXRhLCBvcHRpb25zKSA6IHRyYW5zY29kZUJhc2lzKHVybCwgZGF0YSwgb3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8vIGRvd25sb2FkIGFuZCB0cmFuc2NvZGUgdGhlIGZpbGUgZ2l2ZW4gdGhlIGJhc2lzIG1vZHVsZSBhbmRcbiAgICAvLyBmaWxlIHVybFxuICAgIGNvbnN0IHdvcmtlclRyYW5zY29kZSA9ICh1cmwsIGRhdGEsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRyYW5zY29kZSh1cmwsIGRhdGEsIG9wdGlvbnMpO1xuICAgICAgICAgICAgcmVzdWx0LmxldmVscyA9IHJlc3VsdC5sZXZlbHMubWFwKHYgPT4gdi5idWZmZXIpO1xuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7IHVybDogdXJsLCBkYXRhOiByZXN1bHQgfSwgcmVzdWx0LmxldmVscyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7IHVybDogdXJsLCBlcnI6IGVyciB9LCBudWxsKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCB3b3JrZXJJbml0ID0gKGNvbmZpZywgY2FsbGJhY2spID0+IHtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZSB0aGUgd2FzbSBtb2R1bGVcbiAgICAgICAgY29uc3QgaW5zdGFudGlhdGVXYXNtRnVuYyA9IChpbXBvcnRzLCBzdWNjZXNzQ2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGNvbmZpZy5tb2R1bGUsIGltcG9ydHMpXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ2FsbGJhY2socmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgocmVhc29uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2luc3RhbnRpYXRlIGZhaWxlZCArICcgKyByZWFzb24pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHNlbGYuQkFTSVMoY29uZmlnLm1vZHVsZSA/IHsgaW5zdGFudGlhdGVXYXNtOiBpbnN0YW50aWF0ZVdhc21GdW5jIH0gOiBudWxsKVxuICAgICAgICAgICAgLnRoZW4oKGluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5pdGlhbGl6ZUJhc2lzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgZ2xvYmFsc1xuICAgICAgICAgICAgICAgIGJhc2lzID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgcmdiUHJpb3JpdHkgPSBjb25maWcucmdiUHJpb3JpdHk7XG4gICAgICAgICAgICAgICAgcmdiYVByaW9yaXR5ID0gY29uZmlnLnJnYmFQcmlvcml0eTtcblxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIGhhbmRsZSBpbmNvbWluZyB3b3JrZXIgcmVxdWVzdHNcbiAgICBjb25zdCBxdWV1ZSA9IFtdO1xuICAgIHNlbGYub25tZXNzYWdlID0gKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IG1lc3NhZ2UuZGF0YTtcbiAgICAgICAgc3dpdGNoIChkYXRhLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgICAgICAgIHdvcmtlckluaXQoZGF0YS5jb25maWcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd29ya2VyVHJhbnNjb2RlKHF1ZXVlW2ldLnVybCwgcXVldWVbaV0uZGF0YSwgcXVldWVbaV0ub3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3RyYW5zY29kZSc6XG4gICAgICAgICAgICAgICAgaWYgKGJhc2lzKSB7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlclRyYW5zY29kZShkYXRhLnVybCwgZGF0YS5kYXRhLCBkYXRhLm9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXVlLnB1c2goZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IHtcbiAgICBCYXNpc1dvcmtlclxufTtcbiJdLCJuYW1lcyI6WyJCYXNpc1dvcmtlciIsIkJBU0lTX0ZPUk1BVCIsImNURkVUQzEiLCJjVEZFVEMyIiwiY1RGQkMxIiwiY1RGQkMzIiwiY1RGUFZSVEMxXzRfUkdCIiwiY1RGUFZSVEMxXzRfUkdCQSIsImNURkFTVENfNHg0IiwiY1RGQVRDX1JHQiIsImNURkFUQ19SR0JBX0lOVEVSUE9MQVRFRF9BTFBIQSIsImNURlJHQkEzMiIsImNURlJHQjU2NSIsImNURlJHQkE0NDQ0Iiwib3BhcXVlTWFwcGluZyIsImFzdGMiLCJkeHQiLCJldGMxIiwiZXRjMiIsInB2ciIsImF0YyIsIm5vbmUiLCJhbHBoYU1hcHBpbmciLCJQSVhFTF9GT1JNQVQiLCJFVEMxIiwiRVRDMl9SR0IiLCJFVEMyX1JHQkEiLCJEWFQxIiwiRFhUNSIsIlBWUlRDXzRCUFBfUkdCXzEiLCJQVlJUQ180QlBQX1JHQkFfMSIsIkFTVENfNHg0IiwiQVRDX1JHQiIsIkFUQ19SR0JBIiwiUjhfRzhfQjhfQTgiLCJSNV9HNl9CNSIsIlI0X0c0X0I0X0E0IiwiYmFzaXNUb0VuZ2luZU1hcHBpbmciLCJiYXNpc0Zvcm1hdCIsImRldmljZURldGFpbHMiLCJmb3JtYXRzIiwidW5zd2l6emxlR0dHUiIsImRhdGEiLCJnZW5CIiwiUiIsIkciLCJyIiwiZyIsImIiLCJNYXRoIiwic3FydCIsIm1pbiIsIm1heCIsImZsb29yIiwib2Zmc2V0IiwibGVuZ3RoIiwicGFjazU2NSIsInJlc3VsdCIsIlVpbnQxNkFycmF5IiwiQiIsImlzUE9UIiwid2lkdGgiLCJoZWlnaHQiLCJwZXJmb3JtYW5jZU5vdyIsInBlcmZvcm1hbmNlIiwibm93IiwiYmFzaXMiLCJyZ2JQcmlvcml0eSIsInJnYmFQcmlvcml0eSIsImNob29zZVRhcmdldEZvcm1hdCIsImhhc0FscGhhIiwiaXNVQVNUQyIsInRlc3RJbk9yZGVyIiwicHJpb3JpdHkiLCJpIiwiZm9ybWF0IiwiZGltZW5zaW9uc1ZhbGlkIiwid2ViZ2wyIiwidHJhbnNjb2RlS1RYMiIsInVybCIsIm9wdGlvbnMiLCJLVFgyRmlsZSIsIkVycm9yIiwiZnVuY1N0YXJ0IiwiYmFzaXNGaWxlIiwiVWludDhBcnJheSIsImdldFdpZHRoIiwiZ2V0SGVpZ2h0IiwibGV2ZWxzIiwiZ2V0TGV2ZWxzIiwiZ2V0SGFzQWxwaGEiLCJjbG9zZSIsImRlbGV0ZSIsInVuc3dpenpsZSIsImlzR0dHUiIsInN0YXJ0VHJhbnNjb2RpbmciLCJsZXZlbERhdGEiLCJtaXAiLCJkc3RTaXplIiwiZ2V0SW1hZ2VUcmFuc2NvZGVkU2l6ZUluQnl0ZXMiLCJkc3QiLCJ0cmFuc2NvZGVJbWFnZSIsImlzMTZCaXRGb3JtYXQiLCJwdXNoIiwiYnVmZmVyIiwiY3ViZW1hcCIsInRyYW5zY29kZVRpbWUiLCJ1bnN3aXp6bGVkR0dHUiIsInRyYW5zY29kZUJhc2lzIiwiQmFzaXNGaWxlIiwiZ2V0SW1hZ2VXaWR0aCIsImdldEltYWdlSGVpZ2h0IiwiaW1hZ2VzIiwiZ2V0TnVtSW1hZ2VzIiwiZ2V0TnVtTGV2ZWxzIiwiYnl0ZUxlbmd0aCIsInNldCIsImNvbnNvbGUiLCJ3YXJuIiwidHJhbnNjb2RlIiwiaXNLVFgyIiwid29ya2VyVHJhbnNjb2RlIiwibWFwIiwidiIsInNlbGYiLCJwb3N0TWVzc2FnZSIsImVyciIsIndvcmtlckluaXQiLCJjb25maWciLCJjYWxsYmFjayIsImluc3RhbnRpYXRlV2FzbUZ1bmMiLCJpbXBvcnRzIiwic3VjY2Vzc0NhbGxiYWNrIiwiV2ViQXNzZW1ibHkiLCJpbnN0YW50aWF0ZSIsIm1vZHVsZSIsInRoZW4iLCJjYXRjaCIsInJlYXNvbiIsImVycm9yIiwiQkFTSVMiLCJpbnN0YW50aWF0ZVdhc20iLCJpbnN0YW5jZSIsImluaXRpYWxpemVCYXNpcyIsInF1ZXVlIiwib25tZXNzYWdlIiwibWVzc2FnZSIsInR5cGUiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0EsU0FBU0EsV0FBV0EsR0FBRztBQUNuQjtBQUNBLEVBQUEsTUFBTUMsWUFBWSxHQUFHO0FBQ2pCQyxJQUFBQSxPQUFPLEVBQUUsQ0FBQztBQUEwQjtBQUNwQ0MsSUFBQUEsT0FBTyxFQUFFLENBQUM7QUFBMEI7QUFDcENDLElBQUFBLE1BQU0sRUFBRSxDQUFDO0FBQTJCO0FBQ3BDQyxJQUFBQSxNQUFNLEVBQUUsQ0FBQztBQUEyQjtBQUNwQ0MsSUFBQUEsZUFBZSxFQUFFLENBQUM7QUFBa0I7QUFDcENDLElBQUFBLGdCQUFnQixFQUFFLENBQUM7QUFB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
