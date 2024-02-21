import '../../core/tracing.js';
import { TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, PIXELFORMAT_RGBA8, SAMPLETYPE_INT, SAMPLETYPE_UINT, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_2D_ARRAY } from './constants.js';

let id = 0;
const textureDimensionInfo = {
  [TEXTUREDIMENSION_2D]: 'texture2D',
  [TEXTUREDIMENSION_CUBE]: 'textureCube',
  [TEXTUREDIMENSION_3D]: 'texture3D',
  [TEXTUREDIMENSION_2D_ARRAY]: 'texture2DArray'
};
class BindBufferFormat {
  constructor(name, visibility) {
    this.name = name;
    this.visibility = visibility;
  }
}
class BindTextureFormat {
  constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT) {
    this.scopeId = void 0;
    this.name = name;
    this.visibility = visibility;
    this.textureDimension = textureDimension;
    this.sampleType = sampleType;
  }
}
class BindStorageTextureFormat {
  constructor(name, format = PIXELFORMAT_RGBA8, textureDimension = TEXTUREDIMENSION_2D) {
    this.scopeId = void 0;
    this.name = name;
    this.format = format;
    this.textureDimension = textureDimension;
  }
}
class BindGroupFormat {
  constructor(graphicsDevice, bufferFormats = [], textureFormats = [], storageTextureFormats = [], options = {}) {
    var _options$compute;
    this.compute = false;
    this.id = id++;
    this.compute = (_options$compute = options.compute) != null ? _options$compute : false;
    this.device = graphicsDevice;
    const scope = graphicsDevice.scope;
    this.bufferFormats = bufferFormats;
    this.bufferFormatsMap = new Map();
    bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));
    this.textureFormats = textureFormats;
    this.textureFormatsMap = new Map();
    textureFormats.forEach((tf, i) => {
      this.textureFormatsMap.set(tf.name, i);
      tf.scopeId = scope.resolve(tf.name);
    });
    this.storageTextureFormats = storageTextureFormats;
    this.storageTextureFormatsMap = new Map();
    storageTextureFormats.forEach((tf, i) => {
      this.storageTextureFormatsMap.set(tf.name, i);
      tf.scopeId = scope.resolve(tf.name);
    });
    this.impl = graphicsDevice.createBindGroupFormatImpl(this);
  }
  destroy() {
    this.impl.destroy();
  }
  getTexture(name) {
    const index = this.textureFormatsMap.get(name);
    if (index !== undefined) {
      return this.textureFormats[index];
    }
    return null;
  }
  getStorageTexture(name) {
    const index = this.storageTextureFormatsMap.get(name);
    if (index !== undefined) {
      return this.storageTextureFormats[index];
    }
    return null;
  }
  getShaderDeclarationTextures(bindGroup) {
    let code = '';
    let bindIndex = this.bufferFormats.length;
    this.textureFormats.forEach(format => {
      let textureType = textureDimensionInfo[format.textureDimension];
      let namePostfix = '';
      let extraCode = '';
      if (textureType === 'texture2DArray') {
        namePostfix = '_texture';
        extraCode = `#define ${format.name} sampler2DArray(${format.name}${namePostfix}, ${format.name}_sampler)\n`;
      }
      if (format.sampleType === SAMPLETYPE_INT) {
        textureType = `i${textureType}`;
      } else if (format.sampleType === SAMPLETYPE_UINT) {
        textureType = `u${textureType}`;
      }
      code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform ${textureType} ${format.name}${namePostfix};\n` + `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n` + extraCode;
    });
    return code;
  }
  loseContext() {}
}

export { BindBufferFormat, BindGroupFormat, BindStorageTextureFormat, BindTextureFormat };
