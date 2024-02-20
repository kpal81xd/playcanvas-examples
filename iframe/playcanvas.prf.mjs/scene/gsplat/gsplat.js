import { FloatPacking } from '../../core/math/float-packing.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { SEMANTIC_ATTR13, TYPE_FLOAT32, TYPE_UINT32, PIXELFORMAT_RGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';

class GSplat {
  constructor(device, numSplats, aabb) {
    this.device = void 0;
    this.numSplats = void 0;
    this.vertexFormat = void 0;
    this.format = void 0;
    this.colorTexture = void 0;
    this.scaleTexture = void 0;
    this.rotationTexture = void 0;
    this.centerTexture = void 0;
    this.centers = void 0;
    this.aabb = void 0;
    this.device = device;
    this.numSplats = numSplats;
    this.aabb = aabb;
    this.vertexFormat = new VertexFormat(device, [{
      semantic: SEMANTIC_ATTR13,
      components: 1,
      type: device.isWebGL1 ? TYPE_FLOAT32 : TYPE_UINT32,
      asInt: !device.isWebGL1
    }]);
    const size = this.evalTextureSize(numSplats);
    this.format = this.getTextureFormat(device, false);
    this.colorTexture = this.createTexture(device, 'splatColor', PIXELFORMAT_RGBA8, size);
    this.scaleTexture = this.createTexture(device, 'splatScale', this.format.format, size);
    this.rotationTexture = this.createTexture(device, 'splatRotation', this.format.format, size);
    this.centerTexture = this.createTexture(device, 'splatCenter', this.format.format, size);
  }
  destroy() {
    this.colorTexture.destroy();
    this.scaleTexture.destroy();
    this.rotationTexture.destroy();
    this.centerTexture.destroy();
  }
  setupMaterial(material) {
    material.setParameter('splatColor', this.colorTexture);
    material.setParameter('splatScale', this.scaleTexture);
    material.setParameter('splatRotation', this.rotationTexture);
    material.setParameter('splatCenter', this.centerTexture);
    const {
      width,
      height
    } = this.colorTexture;
    material.setParameter('tex_params', new Float32Array([width, height, 1 / width, 1 / height]));
  }
  evalTextureSize(count) {
    const width = Math.ceil(Math.sqrt(count));
    const height = Math.ceil(count / width);
    return new Vec2(width, height);
  }
  createTexture(device, name, format, size) {
    return new Texture(device, {
      name: name,
      width: size.x,
      height: size.y,
      format: format,
      cubemap: false,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
  }
  getTextureFormat(device, preferHighPrecision) {
    const halfFormat = device.extTextureHalfFloat && device.textureHalfFloatUpdatable ? PIXELFORMAT_RGBA16F : undefined;
    const half = halfFormat ? {
      format: halfFormat,
      numComponents: 4,
      isHalf: true
    } : undefined;
    const floatFormat = device.isWebGPU ? PIXELFORMAT_RGBA32F : device.extTextureFloat ? PIXELFORMAT_RGB32F : undefined;
    const float = floatFormat ? {
      format: floatFormat,
      numComponents: floatFormat === PIXELFORMAT_RGBA32F ? 4 : 3,
      isHalf: false
    } : undefined;
    return preferHighPrecision ? float != null ? float : half : half != null ? half : float;
  }
  updateColorData(c0, c1, c2, opacity) {
    const SH_C0 = 0.28209479177387814;
    const texture = this.colorTexture;
    const data = texture.lock();
    const sigmoid = v => {
      if (v > 0) {
        return 1 / (1 + Math.exp(-v));
      }
      const t = Math.exp(v);
      return t / (1 + t);
    };
    for (let i = 0; i < this.numSplats; ++i) {
      if (c0 && c1 && c2) {
        data[i * 4 + 0] = math.clamp((0.5 + SH_C0 * c0[i]) * 255, 0, 255);
        data[i * 4 + 1] = math.clamp((0.5 + SH_C0 * c1[i]) * 255, 0, 255);
        data[i * 4 + 2] = math.clamp((0.5 + SH_C0 * c2[i]) * 255, 0, 255);
      }
      data[i * 4 + 3] = opacity ? math.clamp(sigmoid(opacity[i]) * 255, 0, 255) : 255;
    }
    texture.unlock();
  }
  updateScaleData(scale0, scale1, scale2) {
    const {
      numComponents,
      isHalf
    } = this.format;
    const texture = this.scaleTexture;
    const data = texture.lock();
    const float2Half = FloatPacking.float2Half;
    for (let i = 0; i < this.numSplats; i++) {
      const sx = Math.exp(scale0[i]);
      const sy = Math.exp(scale1[i]);
      const sz = Math.exp(scale2[i]);
      if (isHalf) {
        data[i * numComponents + 0] = float2Half(sx);
        data[i * numComponents + 1] = float2Half(sy);
        data[i * numComponents + 2] = float2Half(sz);
      } else {
        data[i * numComponents + 0] = sx;
        data[i * numComponents + 1] = sy;
        data[i * numComponents + 2] = sz;
      }
    }
    texture.unlock();
  }
  updateRotationData(rot0, rot1, rot2, rot3) {
    const {
      numComponents,
      isHalf
    } = this.format;
    const quat = new Quat();
    const texture = this.rotationTexture;
    const data = texture.lock();
    const float2Half = FloatPacking.float2Half;
    for (let i = 0; i < this.numSplats; i++) {
      quat.set(rot0[i], rot1[i], rot2[i], rot3[i]).normalize();
      if (quat.w < 0) {
        quat.conjugate();
      }
      if (isHalf) {
        data[i * numComponents + 0] = float2Half(quat.x);
        data[i * numComponents + 1] = float2Half(quat.y);
        data[i * numComponents + 2] = float2Half(quat.z);
      } else {
        data[i * numComponents + 0] = quat.x;
        data[i * numComponents + 1] = quat.y;
        data[i * numComponents + 2] = quat.z;
      }
    }
    texture.unlock();
  }
  updateCenterData(x, y, z) {
    const {
      numComponents,
      isHalf
    } = this.format;
    const texture = this.centerTexture;
    const data = texture.lock();
    const float2Half = FloatPacking.float2Half;
    for (let i = 0; i < this.numSplats; i++) {
      if (isHalf) {
        data[i * numComponents + 0] = float2Half(x[i]);
        data[i * numComponents + 1] = float2Half(y[i]);
        data[i * numComponents + 2] = float2Half(z[i]);
      } else {
        data[i * numComponents + 0] = x[i];
        data[i * numComponents + 1] = y[i];
        data[i * numComponents + 2] = z[i];
      }
    }
    texture.unlock();
  }
}

export { GSplat };
