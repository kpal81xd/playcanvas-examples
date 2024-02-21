import '../../../core/tracing.js';
import { StringIds } from '../../../core/string-ids.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT } from '../constants.js';
import { WebgpuUtils } from './webgpu-utils.js';
import { gpuTextureFormats } from './constants.js';

const samplerTypes = [];
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';
samplerTypes[SAMPLETYPE_INT] = 'comparison';
samplerTypes[SAMPLETYPE_UINT] = 'comparison';
const sampleTypes = [];
sampleTypes[SAMPLETYPE_FLOAT] = 'float';
sampleTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'unfilterable-float';
sampleTypes[SAMPLETYPE_DEPTH] = 'depth';
sampleTypes[SAMPLETYPE_INT] = 'sint';
sampleTypes[SAMPLETYPE_UINT] = 'uint';
const stringIds = new StringIds();
class WebgpuBindGroupFormat {
  constructor(bindGroupFormat) {
    const device = bindGroupFormat.device;
    const {
      key,
      descr
    } = this.createDescriptor(bindGroupFormat);
    this.key = stringIds.get(key);
    this.bindGroupLayout = device.wgpu.createBindGroupLayout(descr);
  }
  destroy() {
    this.bindGroupLayout = null;
  }
  loseContext() {}
  getTextureSlot(bindGroupFormat, index) {
    return bindGroupFormat.bufferFormats.length + index * 2;
  }
  createDescriptor(bindGroupFormat) {
    const entries = [];
    let key = '';
    let index = 0;
    bindGroupFormat.bufferFormats.forEach(bufferFormat => {
      const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
      key += `#${index}U:${visibility}`;
      entries.push({
        binding: index++,
        visibility: visibility,
        buffer: {
          type: 'uniform',
          hasDynamicOffset: true
        }
      });
    });
    bindGroupFormat.textureFormats.forEach(textureFormat => {
      const visibility = WebgpuUtils.shaderStage(textureFormat.visibility);
      const sampleType = textureFormat.sampleType;
      const viewDimension = textureFormat.textureDimension;
      const multisampled = false;
      const gpuSampleType = sampleTypes[sampleType];
      key += `#${index}T:${visibility}-${gpuSampleType}-${viewDimension}-${multisampled}`;
      entries.push({
        binding: index++,
        visibility: visibility,
        texture: {
          sampleType: gpuSampleType,
          viewDimension: viewDimension,
          multisampled: multisampled
        }
      });
      const gpuSamplerType = samplerTypes[sampleType];
      key += `#${index}S:${visibility}-${gpuSamplerType}`;
      entries.push({
        binding: index++,
        visibility: visibility,
        sampler: {
          type: gpuSamplerType
        }
      });
    });
    bindGroupFormat.storageTextureFormats.forEach(textureFormat => {
      const {
        format,
        textureDimension
      } = textureFormat;
      key += `#${index}ST:${format}-${textureDimension}`;
      entries.push({
        binding: index++,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: 'write-only',
          format: gpuTextureFormats[format],
          viewDimension: textureDimension
        }
      });
    });
    const descr = {
      entries: entries
    };
    return {
      key,
      descr
    };
  }
}

export { WebgpuBindGroupFormat };
