import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { DebugHelper, Debug } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';

/**
 * A WebGPU helper class implementing custom resolve of multi-sampled textures.
 *
 * @ignore
 */
class WebgpuResolver {
  constructor(device) {
    /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
    this.device = void 0;
    /**
     * Cache of render pipelines for each texture format, to avoid their per frame creation.
     *
     * @type {Map<GPUTextureFormat, GPURenderPipeline>}
     * @private
     */
    this.pipelineCache = new Map();
    this.device = device;

    // Shader that renders a fullscreen textured quad and copies the depth value from sample index 0
    // TODO: could handle all sample indices and use min/max as needed
    const code = `
 
            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
            );

            struct VertexOutput {
                @builtin(position) position : vec4f,
            };

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
              var output : VertexOutput;
              output.position = vec4f(pos[vertexIndex], 0, 1);
              return output;
            }

            @group(0) @binding(0) var img : texture_depth_multisampled_2d;

            @fragment
            fn fragmentMain(@builtin(position) fragColor: vec4f) -> @location(0) vec4f {
                // load th depth value from sample index 0
                var depth = textureLoad(img, vec2i(fragColor.xy), 0u);
                return vec4<f32>(depth, 0.0, 0.0, 0.0);
            }
        `;
    this.shader = new Shader(device, {
      name: 'WebGPUResolverDepthShader',
      shaderLanguage: SHADERLANGUAGE_WGSL,
      vshader: code,
      fshader: code
    });
  }
  destroy() {
    this.shader.destroy();
    this.shader = null;
    this.pipelineCache = null;
  }

  /** @private */
  getPipeline(format) {
    let pipeline = this.pipelineCache.get(format);
    if (!pipeline) {
      pipeline = this.createPipeline(format);
      this.pipelineCache.set(format, pipeline);
    }
    return pipeline;
  }

  /** @private */
  createPipeline(format) {
    /** @type {import('./webgpu-shader.js').WebgpuShader} */
    const webgpuShader = this.shader.impl;
    const pipeline = this.device.wgpu.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: webgpuShader.getVertexShaderModule(),
        entryPoint: webgpuShader.vertexEntryPoint
      },
      fragment: {
        module: webgpuShader.getFragmentShaderModule(),
        entryPoint: webgpuShader.fragmentEntryPoint,
        targets: [{
          format: format
        }]
      },
      primitive: {
        topology: 'triangle-strip'
      }
    });
    DebugHelper.setLabel(pipeline, `RenderPipeline-DepthResolver-${format}`);
    return pipeline;
  }

  /**
   * @param {GPUCommandEncoder} commandEncoder - Command encoder to use for the resolve.
   * @param {GPUTexture} sourceTexture - Source multi-sampled depth texture to resolve.
   * @param {GPUTexture} destinationTexture - Destination depth texture to resolve to.
   * @private
   */
  resolveDepth(commandEncoder, sourceTexture, destinationTexture) {
    Debug.assert(sourceTexture.sampleCount > 1);
    Debug.assert(destinationTexture.sampleCount === 1);
    Debug.assert(sourceTexture.depthOrArrayLayers === destinationTexture.depthOrArrayLayers);
    const device = this.device;
    const wgpu = device.wgpu;

    // pipeline depends on the format
    const pipeline = this.getPipeline(destinationTexture.format);
    DebugGraphics.pushGpuMarker(device, 'DEPTH_RESOLVE-RENDERER');
    const numFaces = sourceTexture.depthOrArrayLayers;
    for (let face = 0; face < numFaces; face++) {
      // copy depth only (not stencil)
      const srcView = sourceTexture.createView({
        dimension: '2d',
        aspect: 'depth-only',
        baseMipLevel: 0,
        mipLevelCount: 1,
        baseArrayLayer: face
      });
      const dstView = destinationTexture.createView({
        dimension: '2d',
        baseMipLevel: 0,
        mipLevelCount: 1,
        baseArrayLayer: face
      });
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: dstView,
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      DebugHelper.setLabel(passEncoder, `DepthResolve-PassEncoder`);

      // no need for a sampler when using textureLoad
      const bindGroup = wgpu.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: srcView
        }]
      });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(4);
      passEncoder.end();
    }
    DebugGraphics.popGpuMarker(device);

    // clear invalidated state
    device.pipeline = null;
  }
}

export { WebgpuResolver };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXJlc29sdmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ3B1L3dlYmdwdS1yZXNvbHZlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTaGFkZXIgfSBmcm9tIFwiLi4vc2hhZGVyLmpzXCI7XG5pbXBvcnQgeyBTSEFERVJMQU5HVUFHRV9XR1NMIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUvZGVidWcuanNcIjtcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tIFwiLi4vZGVidWctZ3JhcGhpY3MuanNcIjtcblxuLyoqXG4gKiBBIFdlYkdQVSBoZWxwZXIgY2xhc3MgaW1wbGVtZW50aW5nIGN1c3RvbSByZXNvbHZlIG9mIG11bHRpLXNhbXBsZWQgdGV4dHVyZXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVSZXNvbHZlciB7XG4gICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSAqL1xuICAgIGRldmljZTtcblxuICAgIC8qKlxuICAgICAqIENhY2hlIG9mIHJlbmRlciBwaXBlbGluZXMgZm9yIGVhY2ggdGV4dHVyZSBmb3JtYXQsIHRvIGF2b2lkIHRoZWlyIHBlciBmcmFtZSBjcmVhdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8R1BVVGV4dHVyZUZvcm1hdCwgR1BVUmVuZGVyUGlwZWxpbmU+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcGlwZWxpbmVDYWNoZSA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcblxuICAgICAgICAvLyBTaGFkZXIgdGhhdCByZW5kZXJzIGEgZnVsbHNjcmVlbiB0ZXh0dXJlZCBxdWFkIGFuZCBjb3BpZXMgdGhlIGRlcHRoIHZhbHVlIGZyb20gc2FtcGxlIGluZGV4IDBcbiAgICAgICAgLy8gVE9ETzogY291bGQgaGFuZGxlIGFsbCBzYW1wbGUgaW5kaWNlcyBhbmQgdXNlIG1pbi9tYXggYXMgbmVlZGVkXG4gICAgICAgIGNvbnN0IGNvZGUgPSBgXG4gXG4gICAgICAgICAgICB2YXI8cHJpdmF0ZT4gcG9zIDogYXJyYXk8dmVjMmYsIDQ+ID0gYXJyYXk8dmVjMmYsIDQ+KFxuICAgICAgICAgICAgICAgIHZlYzIoLTEuMCwgMS4wKSwgdmVjMigxLjAsIDEuMCksIHZlYzIoLTEuMCwgLTEuMCksIHZlYzIoMS4wLCAtMS4wKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgc3RydWN0IFZlcnRleE91dHB1dCB7XG4gICAgICAgICAgICAgICAgQGJ1aWx0aW4ocG9zaXRpb24pIHBvc2l0aW9uIDogdmVjNGYsXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBAdmVydGV4XG4gICAgICAgICAgICBmbiB2ZXJ0ZXhNYWluKEBidWlsdGluKHZlcnRleF9pbmRleCkgdmVydGV4SW5kZXggOiB1MzIpIC0+IFZlcnRleE91dHB1dCB7XG4gICAgICAgICAgICAgIHZhciBvdXRwdXQgOiBWZXJ0ZXhPdXRwdXQ7XG4gICAgICAgICAgICAgIG91dHB1dC5wb3NpdGlvbiA9IHZlYzRmKHBvc1t2ZXJ0ZXhJbmRleF0sIDAsIDEpO1xuICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyIGltZyA6IHRleHR1cmVfZGVwdGhfbXVsdGlzYW1wbGVkXzJkO1xuXG4gICAgICAgICAgICBAZnJhZ21lbnRcbiAgICAgICAgICAgIGZuIGZyYWdtZW50TWFpbihAYnVpbHRpbihwb3NpdGlvbikgZnJhZ0NvbG9yOiB2ZWM0ZikgLT4gQGxvY2F0aW9uKDApIHZlYzRmIHtcbiAgICAgICAgICAgICAgICAvLyBsb2FkIHRoIGRlcHRoIHZhbHVlIGZyb20gc2FtcGxlIGluZGV4IDBcbiAgICAgICAgICAgICAgICB2YXIgZGVwdGggPSB0ZXh0dXJlTG9hZChpbWcsIHZlYzJpKGZyYWdDb2xvci54eSksIDB1KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmVjNDxmMzI+KGRlcHRoLCAwLjAsIDAuMCwgMC4wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgYDtcblxuICAgICAgICB0aGlzLnNoYWRlciA9IG5ldyBTaGFkZXIoZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiAnV2ViR1BVUmVzb2x2ZXJEZXB0aFNoYWRlcicsXG4gICAgICAgICAgICBzaGFkZXJMYW5ndWFnZTogU0hBREVSTEFOR1VBR0VfV0dTTCxcbiAgICAgICAgICAgIHZzaGFkZXI6IGNvZGUsXG4gICAgICAgICAgICBmc2hhZGVyOiBjb2RlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuc2hhZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zaGFkZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnBpcGVsaW5lQ2FjaGUgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIGdldFBpcGVsaW5lKGZvcm1hdCkge1xuICAgICAgICBsZXQgcGlwZWxpbmUgPSB0aGlzLnBpcGVsaW5lQ2FjaGUuZ2V0KGZvcm1hdCk7XG4gICAgICAgIGlmICghcGlwZWxpbmUpIHtcbiAgICAgICAgICAgIHBpcGVsaW5lID0gdGhpcy5jcmVhdGVQaXBlbGluZShmb3JtYXQpO1xuICAgICAgICAgICAgdGhpcy5waXBlbGluZUNhY2hlLnNldChmb3JtYXQsIHBpcGVsaW5lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGlwZWxpbmU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgY3JlYXRlUGlwZWxpbmUoZm9ybWF0KSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vd2ViZ3B1LXNoYWRlci5qcycpLldlYmdwdVNoYWRlcn0gKi9cbiAgICAgICAgY29uc3Qgd2ViZ3B1U2hhZGVyID0gdGhpcy5zaGFkZXIuaW1wbDtcblxuICAgICAgICBjb25zdCBwaXBlbGluZSA9IHRoaXMuZGV2aWNlLndncHUuY3JlYXRlUmVuZGVyUGlwZWxpbmUoe1xuICAgICAgICAgICAgbGF5b3V0OiAnYXV0bycsXG4gICAgICAgICAgICB2ZXJ0ZXg6IHtcbiAgICAgICAgICAgICAgICBtb2R1bGU6IHdlYmdwdVNoYWRlci5nZXRWZXJ0ZXhTaGFkZXJNb2R1bGUoKSxcbiAgICAgICAgICAgICAgICBlbnRyeVBvaW50OiB3ZWJncHVTaGFkZXIudmVydGV4RW50cnlQb2ludFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZyYWdtZW50OiB7XG4gICAgICAgICAgICAgICAgbW9kdWxlOiB3ZWJncHVTaGFkZXIuZ2V0RnJhZ21lbnRTaGFkZXJNb2R1bGUoKSxcbiAgICAgICAgICAgICAgICBlbnRyeVBvaW50OiB3ZWJncHVTaGFkZXIuZnJhZ21lbnRFbnRyeVBvaW50LFxuICAgICAgICAgICAgICAgIHRhcmdldHM6IFt7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogZm9ybWF0XG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcmltaXRpdmU6IHtcbiAgICAgICAgICAgICAgICB0b3BvbG9neTogJ3RyaWFuZ2xlLXN0cmlwJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwocGlwZWxpbmUsIGBSZW5kZXJQaXBlbGluZS1EZXB0aFJlc29sdmVyLSR7Zm9ybWF0fWApO1xuICAgICAgICByZXR1cm4gcGlwZWxpbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHUFVDb21tYW5kRW5jb2Rlcn0gY29tbWFuZEVuY29kZXIgLSBDb21tYW5kIGVuY29kZXIgdG8gdXNlIGZvciB0aGUgcmVzb2x2ZS5cbiAgICAgKiBAcGFyYW0ge0dQVVRleHR1cmV9IHNvdXJjZVRleHR1cmUgLSBTb3VyY2UgbXVsdGktc2FtcGxlZCBkZXB0aCB0ZXh0dXJlIHRvIHJlc29sdmUuXG4gICAgICogQHBhcmFtIHtHUFVUZXh0dXJlfSBkZXN0aW5hdGlvblRleHR1cmUgLSBEZXN0aW5hdGlvbiBkZXB0aCB0ZXh0dXJlIHRvIHJlc29sdmUgdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZXNvbHZlRGVwdGgoY29tbWFuZEVuY29kZXIsIHNvdXJjZVRleHR1cmUsIGRlc3RpbmF0aW9uVGV4dHVyZSkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChzb3VyY2VUZXh0dXJlLnNhbXBsZUNvdW50ID4gMSk7XG4gICAgICAgIERlYnVnLmFzc2VydChkZXN0aW5hdGlvblRleHR1cmUuc2FtcGxlQ291bnQgPT09IDEpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoc291cmNlVGV4dHVyZS5kZXB0aE9yQXJyYXlMYXllcnMgPT09IGRlc3RpbmF0aW9uVGV4dHVyZS5kZXB0aE9yQXJyYXlMYXllcnMpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCB3Z3B1ID0gZGV2aWNlLndncHU7XG5cbiAgICAgICAgLy8gcGlwZWxpbmUgZGVwZW5kcyBvbiB0aGUgZm9ybWF0XG4gICAgICAgIGNvbnN0IHBpcGVsaW5lID0gdGhpcy5nZXRQaXBlbGluZShkZXN0aW5hdGlvblRleHR1cmUuZm9ybWF0KTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnREVQVEhfUkVTT0xWRS1SRU5ERVJFUicpO1xuXG4gICAgICAgIGNvbnN0IG51bUZhY2VzID0gc291cmNlVGV4dHVyZS5kZXB0aE9yQXJyYXlMYXllcnM7XG4gICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgbnVtRmFjZXM7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAvLyBjb3B5IGRlcHRoIG9ubHkgKG5vdCBzdGVuY2lsKVxuICAgICAgICAgICAgY29uc3Qgc3JjVmlldyA9IHNvdXJjZVRleHR1cmUuY3JlYXRlVmlldyh7XG4gICAgICAgICAgICAgICAgZGltZW5zaW9uOiAnMmQnLFxuICAgICAgICAgICAgICAgIGFzcGVjdDogJ2RlcHRoLW9ubHknLFxuICAgICAgICAgICAgICAgIGJhc2VNaXBMZXZlbDogMCxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbENvdW50OiAxLFxuICAgICAgICAgICAgICAgIGJhc2VBcnJheUxheWVyOiBmYWNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgZHN0VmlldyA9IGRlc3RpbmF0aW9uVGV4dHVyZS5jcmVhdGVWaWV3KHtcbiAgICAgICAgICAgICAgICBkaW1lbnNpb246ICcyZCcsXG4gICAgICAgICAgICAgICAgYmFzZU1pcExldmVsOiAwLFxuICAgICAgICAgICAgICAgIG1pcExldmVsQ291bnQ6IDEsXG4gICAgICAgICAgICAgICAgYmFzZUFycmF5TGF5ZXI6IGZhY2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBwYXNzRW5jb2RlciA9IGNvbW1hbmRFbmNvZGVyLmJlZ2luUmVuZGVyUGFzcyh7XG4gICAgICAgICAgICAgICAgY29sb3JBdHRhY2htZW50czogW3tcbiAgICAgICAgICAgICAgICAgICAgdmlldzogZHN0VmlldyxcbiAgICAgICAgICAgICAgICAgICAgbG9hZE9wOiAnY2xlYXInLFxuICAgICAgICAgICAgICAgICAgICBzdG9yZU9wOiAnc3RvcmUnXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwocGFzc0VuY29kZXIsIGBEZXB0aFJlc29sdmUtUGFzc0VuY29kZXJgKTtcblxuICAgICAgICAgICAgLy8gbm8gbmVlZCBmb3IgYSBzYW1wbGVyIHdoZW4gdXNpbmcgdGV4dHVyZUxvYWRcbiAgICAgICAgICAgIGNvbnN0IGJpbmRHcm91cCA9IHdncHUuY3JlYXRlQmluZEdyb3VwKHtcbiAgICAgICAgICAgICAgICBsYXlvdXQ6IHBpcGVsaW5lLmdldEJpbmRHcm91cExheW91dCgwKSxcbiAgICAgICAgICAgICAgICBlbnRyaWVzOiBbe1xuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAwLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZTogc3JjVmlld1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0QmluZEdyb3VwKDAsIGJpbmRHcm91cCk7XG4gICAgICAgICAgICBwYXNzRW5jb2Rlci5kcmF3KDQpO1xuICAgICAgICAgICAgcGFzc0VuY29kZXIuZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuXG4gICAgICAgIC8vIGNsZWFyIGludmFsaWRhdGVkIHN0YXRlXG4gICAgICAgIGRldmljZS5waXBlbGluZSA9IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVSZXNvbHZlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdVJlc29sdmVyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJwaXBlbGluZUNhY2hlIiwiTWFwIiwiY29kZSIsInNoYWRlciIsIlNoYWRlciIsIm5hbWUiLCJzaGFkZXJMYW5ndWFnZSIsIlNIQURFUkxBTkdVQUdFX1dHU0wiLCJ2c2hhZGVyIiwiZnNoYWRlciIsImRlc3Ryb3kiLCJnZXRQaXBlbGluZSIsImZvcm1hdCIsInBpcGVsaW5lIiwiZ2V0IiwiY3JlYXRlUGlwZWxpbmUiLCJzZXQiLCJ3ZWJncHVTaGFkZXIiLCJpbXBsIiwid2dwdSIsImNyZWF0ZVJlbmRlclBpcGVsaW5lIiwibGF5b3V0IiwidmVydGV4IiwibW9kdWxlIiwiZ2V0VmVydGV4U2hhZGVyTW9kdWxlIiwiZW50cnlQb2ludCIsInZlcnRleEVudHJ5UG9pbnQiLCJmcmFnbWVudCIsImdldEZyYWdtZW50U2hhZGVyTW9kdWxlIiwiZnJhZ21lbnRFbnRyeVBvaW50IiwidGFyZ2V0cyIsInByaW1pdGl2ZSIsInRvcG9sb2d5IiwiRGVidWdIZWxwZXIiLCJzZXRMYWJlbCIsInJlc29sdmVEZXB0aCIsImNvbW1hbmRFbmNvZGVyIiwic291cmNlVGV4dHVyZSIsImRlc3RpbmF0aW9uVGV4dHVyZSIsIkRlYnVnIiwiYXNzZXJ0Iiwic2FtcGxlQ291bnQiLCJkZXB0aE9yQXJyYXlMYXllcnMiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm51bUZhY2VzIiwiZmFjZSIsInNyY1ZpZXciLCJjcmVhdGVWaWV3IiwiZGltZW5zaW9uIiwiYXNwZWN0IiwiYmFzZU1pcExldmVsIiwibWlwTGV2ZWxDb3VudCIsImJhc2VBcnJheUxheWVyIiwiZHN0VmlldyIsInBhc3NFbmNvZGVyIiwiYmVnaW5SZW5kZXJQYXNzIiwiY29sb3JBdHRhY2htZW50cyIsInZpZXciLCJsb2FkT3AiLCJzdG9yZU9wIiwiYmluZEdyb3VwIiwiY3JlYXRlQmluZEdyb3VwIiwiZ2V0QmluZEdyb3VwTGF5b3V0IiwiZW50cmllcyIsImJpbmRpbmciLCJyZXNvdXJjZSIsInNldFBpcGVsaW5lIiwic2V0QmluZEdyb3VwIiwiZHJhdyIsImVuZCIsInBvcEdwdU1hcmtlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxDQUFDO0VBWWpCQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUU7QUFYcEI7QUFBQSxJQUFBLElBQUEsQ0FDQUEsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFB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