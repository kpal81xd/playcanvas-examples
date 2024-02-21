import { Debug, DebugHelper } from '../../../core/debug.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * A WebGPU implementation of the BindGroup, which is a wrapper over GPUBindGroup.
 *
 * @ignore
 */
class WebgpuBindGroup {
  constructor() {
    /**
     * @type {GPUBindGroup}
     * @private
     */
    this.bindGroup = void 0;
  }
  update(bindGroup) {
    this.destroy();
    const device = bindGroup.device;

    /** @type {GPUBindGroupDescriptor} */
    const descr = this.createDescriptor(device, bindGroup);
    WebgpuDebug.validate(device);
    this.bindGroup = device.wgpu.createBindGroup(descr);
    WebgpuDebug.end(device, {
      debugFormat: this.debugFormat,
      descr: descr,
      format: bindGroup.format,
      bindGroup: bindGroup
    });
  }
  destroy() {
    // this.bindGroup?.destroy();
    this.bindGroup = null;
  }

  /**
   * Creates a bind group descriptor in WebGPU format
   *
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - Graphics device.
   * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to create the
   * descriptor for.
   * @returns {object} - Returns the generated descriptor of type
   * GPUBindGroupDescriptor, which can be used to create a GPUBindGroup
   */
  createDescriptor(device, bindGroup) {
    // Note: This needs to match WebgpuBindGroupFormat.createDescriptor
    const entries = [];
    const format = bindGroup.format;
    Debug.call(() => {
      this.debugFormat = '';
    });

    // uniform buffers
    let index = 0;
    bindGroup.uniformBuffers.forEach(ub => {
      const buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
      Debug.assert(buffer, 'NULL uniform buffer cannot be used by the bind group');
      Debug.call(() => {
        this.debugFormat += `${index}: UB\n`;
      });
      entries.push({
        binding: index++,
        resource: {
          buffer: buffer,
          offset: 0,
          size: ub.format.byteSize
        }
      });
    });

    // textures
    bindGroup.textures.forEach((tex, textureIndex) => {
      /** @type {import('./webgpu-texture.js').WebgpuTexture} */
      const wgpuTexture = tex.impl;
      const textureFormat = format.textureFormats[textureIndex];

      // texture
      const view = wgpuTexture.getView(device);
      Debug.assert(view, 'NULL texture view cannot be used by the bind group');
      Debug.call(() => {
        this.debugFormat += `${index}: ${bindGroup.format.textureFormats[textureIndex].name}\n`;
      });
      entries.push({
        binding: index++,
        resource: view
      });

      // sampler
      const sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
      Debug.assert(sampler, 'NULL sampler cannot be used by the bind group');
      Debug.call(() => {
        this.debugFormat += `${index}: ${sampler.label}\n`;
      });
      entries.push({
        binding: index++,
        resource: sampler
      });
    });

    // storage textures
    bindGroup.storageTextures.forEach((tex, textureIndex) => {
      /** @type {import('./webgpu-texture.js').WebgpuTexture} */
      const wgpuTexture = tex.impl;

      // texture
      const view = wgpuTexture.getView(device);
      Debug.assert(view, 'NULL texture view cannot be used by the bind group');
      Debug.call(() => {
        this.debugFormat += `${index}: ${bindGroup.format.storageTextureFormats[textureIndex].name}\n`;
      });
      entries.push({
        binding: index++,
        resource: view
      });
    });
    const descr = {
      layout: bindGroup.format.impl.bindGroupLayout,
      entries: entries
    };
    DebugHelper.setLabel(descr, bindGroup.name);
    return descr;
  }
}

export { WebgpuBindGroup };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWJpbmQtZ3JvdXAuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LWJpbmQtZ3JvdXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBXZWJncHVEZWJ1ZyB9IGZyb20gJy4vd2ViZ3B1LWRlYnVnLmpzJztcblxuLyoqXG4gKiBBIFdlYkdQVSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQmluZEdyb3VwLCB3aGljaCBpcyBhIHdyYXBwZXIgb3ZlciBHUFVCaW5kR3JvdXAuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVCaW5kR3JvdXAge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVCaW5kR3JvdXB9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBiaW5kR3JvdXA7XG5cbiAgICB1cGRhdGUoYmluZEdyb3VwKSB7XG5cbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IGJpbmRHcm91cC5kZXZpY2U7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVCaW5kR3JvdXBEZXNjcmlwdG9yfSAqL1xuICAgICAgICBjb25zdCBkZXNjciA9IHRoaXMuY3JlYXRlRGVzY3JpcHRvcihkZXZpY2UsIGJpbmRHcm91cCk7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcudmFsaWRhdGUoZGV2aWNlKTtcblxuICAgICAgICB0aGlzLmJpbmRHcm91cCA9IGRldmljZS53Z3B1LmNyZWF0ZUJpbmRHcm91cChkZXNjcik7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKGRldmljZSwge1xuICAgICAgICAgICAgZGVidWdGb3JtYXQ6IHRoaXMuZGVidWdGb3JtYXQsXG4gICAgICAgICAgICBkZXNjcjogZGVzY3IsXG4gICAgICAgICAgICBmb3JtYXQ6IGJpbmRHcm91cC5mb3JtYXQsXG4gICAgICAgICAgICBiaW5kR3JvdXA6IGJpbmRHcm91cFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyB0aGlzLmJpbmRHcm91cD8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmJpbmRHcm91cCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGJpbmQgZ3JvdXAgZGVzY3JpcHRvciBpbiBXZWJHUFUgZm9ybWF0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIEdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYmluZC1ncm91cC5qcycpLkJpbmRHcm91cH0gYmluZEdyb3VwIC0gQmluZCBncm91cCB0byBjcmVhdGUgdGhlXG4gICAgICogZGVzY3JpcHRvciBmb3IuXG4gICAgICogQHJldHVybnMge29iamVjdH0gLSBSZXR1cm5zIHRoZSBnZW5lcmF0ZWQgZGVzY3JpcHRvciBvZiB0eXBlXG4gICAgICogR1BVQmluZEdyb3VwRGVzY3JpcHRvciwgd2hpY2ggY2FuIGJlIHVzZWQgdG8gY3JlYXRlIGEgR1BVQmluZEdyb3VwXG4gICAgICovXG4gICAgY3JlYXRlRGVzY3JpcHRvcihkZXZpY2UsIGJpbmRHcm91cCkge1xuXG4gICAgICAgIC8vIE5vdGU6IFRoaXMgbmVlZHMgdG8gbWF0Y2ggV2ViZ3B1QmluZEdyb3VwRm9ybWF0LmNyZWF0ZURlc2NyaXB0b3JcbiAgICAgICAgY29uc3QgZW50cmllcyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IGJpbmRHcm91cC5mb3JtYXQ7XG5cbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYnVnRm9ybWF0ID0gJyc7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHVuaWZvcm0gYnVmZmVyc1xuICAgICAgICBsZXQgaW5kZXggPSAwO1xuICAgICAgICBiaW5kR3JvdXAudW5pZm9ybUJ1ZmZlcnMuZm9yRWFjaCgodWIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IHViLnBlcnNpc3RlbnQgPyB1Yi5pbXBsLmJ1ZmZlciA6IHViLmFsbG9jYXRpb24uZ3B1QnVmZmVyLmJ1ZmZlcjtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChidWZmZXIsICdOVUxMIHVuaWZvcm0gYnVmZmVyIGNhbm5vdCBiZSB1c2VkIGJ5IHRoZSBiaW5kIGdyb3VwJyk7XG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlYnVnRm9ybWF0ICs9IGAke2luZGV4fTogVUJcXG5gO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgYmluZGluZzogaW5kZXgrKyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgICBidWZmZXI6IGJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgICAgICBzaXplOiB1Yi5mb3JtYXQuYnl0ZVNpemVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgYmluZEdyb3VwLnRleHR1cmVzLmZvckVhY2goKHRleCwgdGV4dHVyZUluZGV4KSA9PiB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3dlYmdwdS10ZXh0dXJlLmpzJykuV2ViZ3B1VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IHdncHVUZXh0dXJlID0gdGV4LmltcGw7XG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0ID0gZm9ybWF0LnRleHR1cmVGb3JtYXRzW3RleHR1cmVJbmRleF07XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB3Z3B1VGV4dHVyZS5nZXRWaWV3KGRldmljZSk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmlldywgJ05VTEwgdGV4dHVyZSB2aWV3IGNhbm5vdCBiZSB1c2VkIGJ5IHRoZSBiaW5kIGdyb3VwJyk7XG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlYnVnRm9ybWF0ICs9IGAke2luZGV4fTogJHtiaW5kR3JvdXAuZm9ybWF0LnRleHR1cmVGb3JtYXRzW3RleHR1cmVJbmRleF0ubmFtZX1cXG5gO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgYmluZGluZzogaW5kZXgrKyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZTogdmlld1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIHNhbXBsZXJcbiAgICAgICAgICAgIGNvbnN0IHNhbXBsZXIgPSB3Z3B1VGV4dHVyZS5nZXRTYW1wbGVyKGRldmljZSwgdGV4dHVyZUZvcm1hdC5zYW1wbGVUeXBlKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzYW1wbGVyLCAnTlVMTCBzYW1wbGVyIGNhbm5vdCBiZSB1c2VkIGJ5IHRoZSBiaW5kIGdyb3VwJyk7XG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlYnVnRm9ybWF0ICs9IGAke2luZGV4fTogJHtzYW1wbGVyLmxhYmVsfVxcbmA7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBiaW5kaW5nOiBpbmRleCsrLFxuICAgICAgICAgICAgICAgIHJlc291cmNlOiBzYW1wbGVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gc3RvcmFnZSB0ZXh0dXJlc1xuICAgICAgICBiaW5kR3JvdXAuc3RvcmFnZVRleHR1cmVzLmZvckVhY2goKHRleCwgdGV4dHVyZUluZGV4KSA9PiB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3dlYmdwdS10ZXh0dXJlLmpzJykuV2ViZ3B1VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IHdncHVUZXh0dXJlID0gdGV4LmltcGw7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB3Z3B1VGV4dHVyZS5nZXRWaWV3KGRldmljZSk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmlldywgJ05VTEwgdGV4dHVyZSB2aWV3IGNhbm5vdCBiZSB1c2VkIGJ5IHRoZSBiaW5kIGdyb3VwJyk7XG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlYnVnRm9ybWF0ICs9IGAke2luZGV4fTogJHtiaW5kR3JvdXAuZm9ybWF0LnN0b3JhZ2VUZXh0dXJlRm9ybWF0c1t0ZXh0dXJlSW5kZXhdLm5hbWV9XFxuYDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGJpbmRpbmc6IGluZGV4KyssXG4gICAgICAgICAgICAgICAgcmVzb3VyY2U6IHZpZXdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZXNjciA9IHtcbiAgICAgICAgICAgIGxheW91dDogYmluZEdyb3VwLmZvcm1hdC5pbXBsLmJpbmRHcm91cExheW91dCxcbiAgICAgICAgICAgIGVudHJpZXM6IGVudHJpZXNcbiAgICAgICAgfTtcblxuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChkZXNjciwgYmluZEdyb3VwLm5hbWUpO1xuXG4gICAgICAgIHJldHVybiBkZXNjcjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdwdUJpbmRHcm91cCB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUJpbmRHcm91cCIsImNvbnN0cnVjdG9yIiwiYmluZEdyb3VwIiwidXBkYXRlIiwiZGVzdHJveSIsImRldmljZSIsImRlc2NyIiwiY3JlYXRlRGVzY3JpcHRvciIsIldlYmdwdURlYnVnIiwidmFsaWRhdGUiLCJ3Z3B1IiwiY3JlYXRlQmluZEdyb3VwIiwiZW5kIiwiZGVidWdGb3JtYXQiLCJmb3JtYXQiLCJlbnRyaWVzIiwiRGVidWciLCJjYWxsIiwiaW5kZXgiLCJ1bmlmb3JtQnVmZmVycyIsImZvckVhY2giLCJ1YiIsImJ1ZmZlciIsInBlcnNpc3RlbnQiLCJpbXBsIiwiYWxsb2NhdGlvbiIsImdwdUJ1ZmZlciIsImFzc2VydCIsInB1c2giLCJiaW5kaW5nIiwicmVzb3VyY2UiLCJvZmZzZXQiLCJzaXplIiwiYnl0ZVNpemUiLCJ0ZXh0dXJlcyIsInRleCIsInRleHR1cmVJbmRleCIsIndncHVUZXh0dXJlIiwidGV4dHVyZUZvcm1hdCIsInRleHR1cmVGb3JtYXRzIiwidmlldyIsImdldFZpZXciLCJuYW1lIiwic2FtcGxlciIsImdldFNhbXBsZXIiLCJzYW1wbGVUeXBlIiwibGFiZWwiLCJzdG9yYWdlVGV4dHVyZXMiLCJzdG9yYWdlVGV4dHVyZUZvcm1hdHMiLCJsYXlvdXQiLCJiaW5kR3JvdXBMYXlvdXQiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIl0sIm1hcHBpbmdzIjoiOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUNsQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxHQUFBO0VBRVRDLE1BQU1BLENBQUNELFNBQVMsRUFBRTtJQUVkLElBQUksQ0FBQ0UsT0FBTyxFQUFFLENBQUE7QUFDZCxJQUFBLE1BQU1DLE1BQU0sR0FBR0gs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