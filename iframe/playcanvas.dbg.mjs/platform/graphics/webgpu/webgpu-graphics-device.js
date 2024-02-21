import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8 } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { DebugGraphics } from '../debug-graphics.js';
import { RenderTarget } from '../render-target.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuComputePipeline } from './webgpu-compute-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { WebgpuMipmapRenderer } from './webgpu-mipmap-renderer.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuDynamicBuffers } from './webgpu-dynamic-buffers.js';
import { WebgpuGpuProfiler } from './webgpu-gpu-profiler.js';
import { WebgpuResolver } from './webgpu-resolver.js';
import { WebgpuCompute } from './webgpu-compute.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
  constructor(canvas, options = {}) {
    var _options$alpha, _options$antialias;
    super(canvas, options);
    /**
     * Object responsible for caching and creation of render pipelines.
     */
    this.renderPipeline = new WebgpuRenderPipeline(this);
    /**
     * Object responsible for caching and creation of compute pipelines.
     */
    this.computePipeline = new WebgpuComputePipeline(this);
    /**
     * Object responsible for clearing the rendering surface by rendering a quad.
     *
     * @type { WebgpuClearRenderer }
     */
    this.clearRenderer = void 0;
    /**
     * Object responsible for mipmap generation.
     *
     * @type { WebgpuMipmapRenderer }
     */
    this.mipmapRenderer = void 0;
    /**
     * Render pipeline currently set on the device.
     *
     * @type {GPURenderPipeline}
     * @private
     */
    this.pipeline = void 0;
    /**
     * An array of bind group formats, based on currently assigned bind groups
     *
     * @type {WebgpuBindGroupFormat[]}
     */
    this.bindGroupFormats = [];
    /**
     * Current command buffer encoder.
     *
     * @type {GPUCommandEncoder|null}
     * @private
     */
    this.commandEncoder = null;
    /**
     * Command buffers scheduled for execution on the GPU.
     *
     * @type {GPUCommandBuffer[]}
     * @private
     */
    this.commandBuffers = [];
    /**
     * @type {GPUSupportedLimits}
     * @private
     */
    this.limits = void 0;
    options = this.initOptions;

    // alpha defaults to true
    options.alpha = (_options$alpha = options.alpha) != null ? _options$alpha : true;
    this.backBufferAntialias = (_options$antialias = options.antialias) != null ? _options$antialias : false;
    this.isWebGPU = true;
    this._deviceType = DEVICETYPE_WEBGPU;
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    this.clearRenderer.destroy();
    this.clearRenderer = null;
    this.mipmapRenderer.destroy();
    this.mipmapRenderer = null;
    this.resolver.destroy();
    this.resolver = null;
    super.destroy();
  }
  initDeviceCaps() {
    // temporarily disabled functionality which is not supported to avoid errors
    this.disableParticleSystem = true;
    const limits = this.gpuAdapter.limits;
    this.limits = limits;
    this.precision = 'highp';
    this.maxPrecision = 'highp';
    this.maxSamples = 4;
    this.maxTextures = 16;
    this.maxTextureSize = limits.maxTextureDimension2D;
    this.maxCubeMapSize = limits.maxTextureDimension2D;
    this.maxVolumeSize = limits.maxTextureDimension3D;
    this.maxColorAttachments = limits.maxColorAttachments;
    this.maxPixelRatio = 1;
    this.maxAnisotropy = 16;
    this.fragmentUniformsCount = limits.maxUniformBufferBindingSize / 16;
    this.vertexUniformsCount = limits.maxUniformBufferBindingSize / 16;
    this.supportsInstancing = true;
    this.supportsUniformBuffers = true;
    this.supportsVolumeTextures = true;
    this.supportsBoneTextures = true;
    this.supportsMorphTargetTexturesCore = true;
    this.supportsAreaLights = true;
    this.supportsDepthShadow = true;
    this.supportsGpuParticles = false;
    this.supportsMrt = true;
    this.supportsCompute = true;
    this.extUintElement = true;
    this.extTextureFloat = true;
    this.textureFloatRenderable = true;
    this.textureHalfFloatFilterable = true;
    this.extTextureHalfFloat = true;
    this.textureHalfFloatRenderable = true;
    this.textureHalfFloatUpdatable = true;
    this.boneLimit = 1024;
    this.supportsImageBitmap = true;
    this.extStandardDerivatives = true;
    this.extBlendMinmax = true;
    this.areaLightLutFormat = this.textureFloatFilterable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
    this.supportsTextureFetch = true;

    // WebGPU currently only supports 1 and 4 samples
    this.samples = this.backBufferAntialias ? 4 : 1;
  }
  async initWebGpu(glslangUrl, twgslUrl) {
    if (!window.navigator.gpu) {
      throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
    }

    // temporary message to confirm Webgpu is being used
    Debug.log("WebgpuGraphicsDevice initialization ..");

    // build a full URL from a relative path
    const buildUrl = relativePath => {
      const url = new URL(window.location.href);
      url.pathname = relativePath;
      url.search = '';
      return url.toString();
    };
    const results = await Promise.all([import(`${buildUrl(twgslUrl)}`).then(module => twgsl(twgslUrl.replace('.js', '.wasm'))), import(`${buildUrl(glslangUrl)}`).then(module => module.default())]);
    this.twgsl = results[0];
    this.glslang = results[1];

    /** @type {GPURequestAdapterOptions} */
    const adapterOptions = {
      powerPreference: this.initOptions.powerPreference !== 'default' ? this.initOptions.powerPreference : undefined
    };

    /**
     * @type {GPUAdapter}
     * @private
     */
    this.gpuAdapter = await window.navigator.gpu.requestAdapter(adapterOptions);

    // optional features:
    //      "depth-clip-control",
    //      "depth32float-stencil8",
    //      "indirect-first-instance",
    //      "shader-f16",
    //      "bgra8unorm-storage",

    // request optional features
    const requiredFeatures = [];
    const requireFeature = feature => {
      const supported = this.gpuAdapter.features.has(feature);
      if (supported) {
        requiredFeatures.push(feature);
      }
      return supported;
    };
    this.textureFloatFilterable = requireFeature('float32-filterable');
    this.extCompressedTextureS3TC = requireFeature('texture-compression-bc');
    this.extCompressedTextureETC = requireFeature('texture-compression-etc2');
    this.extCompressedTextureASTC = requireFeature('texture-compression-astc');
    this.supportsTimestampQuery = requireFeature('timestamp-query');
    this.textureRG11B10Renderable = requireFeature('rg11b10ufloat-renderable');
    Debug.log(`WEBGPU features: ${requiredFeatures.join(', ')}`);

    /** @type {GPUDeviceDescriptor} */
    const deviceDescr = {
      requiredFeatures,
      // Note that we can request limits, but it does not seem to be supported at the moment
      requiredLimits: {},
      defaultQueue: {
        label: 'Default Queue'
      }
    };

    /**
     * @type {GPUDevice}
     * @private
     */
    this.wgpu = await this.gpuAdapter.requestDevice(deviceDescr);
    this.initDeviceCaps();
    this.gpuContext = this.canvas.getContext('webgpu');

    // pixel format of the framebuffer is the most efficient one on the system
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.backBufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;

    /**
     * Configuration of the main colorframebuffer we obtain using getCurrentTexture
     *
     * @type {GPUCanvasConfiguration}
     * @private
     */
    this.canvasConfig = {
      device: this.wgpu,
      colorSpace: 'srgb',
      alphaMode: this.initOptions.alpha ? 'premultiplied' : 'opaque',
      // use preferred format for optimal performance on mobile
      format: preferredCanvasFormat,
      // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      // formats that views created from textures returned by getCurrentTexture may use
      viewFormats: []
    };
    this.gpuContext.configure(this.canvasConfig);
    this.createBackbuffer();
    this.clearRenderer = new WebgpuClearRenderer(this);
    this.mipmapRenderer = new WebgpuMipmapRenderer(this);
    this.resolver = new WebgpuResolver(this);
    this.postInit();
    return this;
  }
  postInit() {
    super.postInit();
    this.initializeRenderState();
    this.setupPassEncoderDefaults();
    this.gpuProfiler = new WebgpuGpuProfiler(this);

    // init dynamic buffer using 1MB allocation
    this.dynamicBuffers = new WebgpuDynamicBuffers(this, 1024 * 1024, this.limits.minUniformBufferOffsetAlignment);
  }
  createBackbuffer() {
    this.supportsStencil = this.initOptions.stencil;
    this.backBuffer = new RenderTarget({
      name: 'WebgpuFramebuffer',
      graphicsDevice: this,
      depth: this.initOptions.depth,
      stencil: this.supportsStencil,
      samples: this.samples
    });
  }
  frameStart() {
    super.frameStart();
    this.gpuProfiler.frameStart();

    // submit any commands collected before the frame rendering
    this.submit();
    WebgpuDebug.memory(this);
    WebgpuDebug.validate(this);

    // current frame color output buffer
    const outColorBuffer = this.gpuContext.getCurrentTexture();
    DebugHelper.setLabel(outColorBuffer, `${this.backBuffer.name}`);

    // reallocate framebuffer if dimensions change, to match the output texture
    if (this.backBufferSize.x !== outColorBuffer.width || this.backBufferSize.y !== outColorBuffer.height) {
      this.backBufferSize.set(outColorBuffer.width, outColorBuffer.height);
      this.backBuffer.destroy();
      this.backBuffer = null;
      this.createBackbuffer();
    }
    const rt = this.backBuffer;
    const wrt = rt.impl;

    // assign the format, allowing following init call to use it to allocate matching multisampled buffer
    wrt.setColorAttachment(0, undefined, outColorBuffer.format);
    this.initRenderTarget(rt);

    // assign current frame's render texture
    wrt.assignColorTexture(outColorBuffer);
    WebgpuDebug.end(this);
    WebgpuDebug.end(this);
  }
  frameEnd() {
    super.frameEnd();
    this.gpuProfiler.frameEnd();

    // submit scheduled command buffers
    this.submit();
    this.gpuProfiler.request();
  }
  createUniformBufferImpl(uniformBuffer) {
    return new WebgpuUniformBuffer(uniformBuffer);
  }
  createVertexBufferImpl(vertexBuffer, format) {
    return new WebgpuVertexBuffer(vertexBuffer, format);
  }
  createIndexBufferImpl(indexBuffer) {
    return new WebgpuIndexBuffer(indexBuffer);
  }
  createShaderImpl(shader) {
    return new WebgpuShader(shader);
  }
  createTextureImpl(texture) {
    return new WebgpuTexture(texture);
  }
  createRenderTargetImpl(renderTarget) {
    return new WebgpuRenderTarget(renderTarget);
  }
  createBindGroupFormatImpl(bindGroupFormat) {
    return new WebgpuBindGroupFormat(bindGroupFormat);
  }
  createBindGroupImpl(bindGroup) {
    return new WebgpuBindGroup();
  }
  createComputeImpl(compute) {
    return new WebgpuCompute(compute);
  }

  /**
   * @param {number} index - Index of the bind group slot
   * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to attach
   */
  setBindGroup(index, bindGroup) {
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      // set it on the device
      this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, bindGroup.uniformBufferOffsets);

      // store the active formats, used by the pipeline creation
      this.bindGroupFormats[index] = bindGroup.format.impl;
    }
  }
  submitVertexBuffer(vertexBuffer, slot) {
    const elements = vertexBuffer.format.elements;
    const elementCount = elements.length;
    const vbBuffer = vertexBuffer.impl.buffer;
    for (let i = 0; i < elementCount; i++) {
      this.passEncoder.setVertexBuffer(slot + i, vbBuffer, elements[i].offset);
    }
    return elementCount;
  }
  draw(primitive, numInstances = 1, keepBuffers) {
    if (this.shader.ready && !this.shader.failed) {
      WebgpuDebug.validate(this);
      const passEncoder = this.passEncoder;
      Debug.assert(passEncoder);

      // vertex buffers
      const vb0 = this.vertexBuffers[0];
      const vb1 = this.vertexBuffers[1];
      this.vertexBuffers.length = 0;
      if (vb0) {
        const vbSlot = this.submitVertexBuffer(vb0, 0);
        if (vb1) {
          this.submitVertexBuffer(vb1, vbSlot);
        }
      }

      // render pipeline
      const pipeline = this.renderPipeline.get(primitive, vb0 == null ? void 0 : vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.blendState, this.depthState, this.cullMode, this.stencilEnabled, this.stencilFront, this.stencilBack);
      Debug.assert(pipeline);
      if (this.pipeline !== pipeline) {
        this.pipeline = pipeline;
        passEncoder.setPipeline(pipeline);
      }

      // draw
      const ib = this.indexBuffer;
      if (ib) {
        this.indexBuffer = null;
        passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
        passEncoder.drawIndexed(primitive.count, numInstances, 0, 0, 0);
      } else {
        passEncoder.draw(primitive.count, numInstances, 0, 0);
      }
      WebgpuDebug.end(this, {
        vb0,
        vb1,
        ib,
        primitive,
        numInstances,
        pipeline
      });
    }
  }
  setShader(shader) {
    this.shader = shader;

    // TODO: we should probably track other stats instead, like pipeline switches
    this._shaderSwitchesPerFrame++;
    return true;
  }
  setBlendState(blendState) {
    this.blendState.copy(blendState);
  }
  setDepthState(depthState) {
    this.depthState.copy(depthState);
  }
  setStencilState(stencilFront, stencilBack) {
    if (stencilFront || stencilBack) {
      this.stencilEnabled = true;
      this.stencilFront.copy(stencilFront != null ? stencilFront : StencilParameters.DEFAULT);
      this.stencilBack.copy(stencilBack != null ? stencilBack : StencilParameters.DEFAULT);

      // ref value - based on stencil front
      const ref = this.stencilFront.ref;
      if (this.stencilRef !== ref) {
        this.stencilRef = ref;
        this.passEncoder.setStencilReference(ref);
      }
    } else {
      this.stencilEnabled = false;
    }
  }
  setBlendColor(r, g, b, a) {
    const c = this.blendColor;
    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      c.set(r, g, b, a);
      this.passEncoder.setBlendConstant(c);
    }
  }
  setCullMode(cullMode) {
    this.cullMode = cullMode;
  }
  setAlphaToCoverage(state) {}
  initializeContextCaches() {
    super.initializeContextCaches();
  }

  /**
   * Set up default values for the render pass encoder.
   */
  setupPassEncoderDefaults() {
    this.pipeline = null;
    this.stencilRef = 0;
    this.blendColor.set(0, 0, 0, 0);
  }
  _uploadDirtyTextures() {
    this.textures.forEach(texture => {
      if (texture._needsUpload || texture._needsMipmaps) {
        texture.upload();
      }
    });
  }

  /**
   * Start a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   * @ignore
   */
  startRenderPass(renderPass) {
    // upload textures that need it, to avoid them being uploaded / their mips generated during the pass
    // TODO: this needs a better solution
    this._uploadDirtyTextures();
    WebgpuDebug.internal(this);
    WebgpuDebug.validate(this);
    const rt = renderPass.renderTarget || this.backBuffer;
    this.renderTarget = rt;
    Debug.assert(rt);

    /** @type {WebgpuRenderTarget} */
    const wrt = rt.impl;

    // create a new encoder for each pass
    this.commandEncoder = this.wgpu.createCommandEncoder();
    DebugHelper.setLabel(this.commandEncoder, `${renderPass.name}-Encoder`);

    // framebuffer is initialized at the start of the frame
    if (rt !== this.backBuffer) {
      this.initRenderTarget(rt);
    }

    // set up clear / store / load settings
    wrt.setupForRenderPass(renderPass);
    const renderPassDesc = wrt.renderPassDescriptor;

    // timestamp
    if (this.gpuProfiler._enabled) {
      if (this.gpuProfiler.timestampQueriesSet) {
        const slot = this.gpuProfiler.getSlot(renderPass.name);
        renderPassDesc.timestampWrites = {
          querySet: this.gpuProfiler.timestampQueriesSet.querySet,
          beginningOfPassWriteIndex: slot * 2,
          endOfPassWriteIndex: slot * 2 + 1
        };
      }
    }

    // start the pass
    this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
    DebugHelper.setLabel(this.passEncoder, renderPass.name);
    this.setupPassEncoderDefaults();

    // the pass always clears full target
    // TODO: avoid this setting the actual viewport/scissor on webgpu as those are automatically reset to full
    // render target. We just need to update internal state, for the get functionality to return it.
    const {
      width,
      height
    } = rt;
    this.setViewport(0, 0, width, height);
    this.setScissor(0, 0, width, height);
    Debug.assert(!this.insideRenderPass, 'RenderPass cannot be started while inside another render pass.');
    this.insideRenderPass = true;
  }

  /**
   * End a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
   * @ignore
   */
  endRenderPass(renderPass) {
    // end the render pass
    this.passEncoder.end();
    this.passEncoder = null;
    this.insideRenderPass = false;

    // each render pass can use different number of bind groups
    this.bindGroupFormats.length = 0;

    // generate mipmaps using the same command buffer encoder
    for (let i = 0; i < renderPass.colorArrayOps.length; i++) {
      const colorOps = renderPass.colorArrayOps[i];
      if (colorOps.mipmaps) {
        this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
      }
    }

    // schedule command buffer submission
    const cb = this.commandEncoder.finish();
    DebugHelper.setLabel(cb, `${renderPass.name}-CommandBuffer`);
    this.addCommandBuffer(cb);
    this.commandEncoder = null;
    WebgpuDebug.end(this, {
      renderPass
    });
    WebgpuDebug.end(this, {
      renderPass
    });
  }
  startComputePass() {
    WebgpuDebug.internal(this);
    WebgpuDebug.validate(this);

    // create a new encoder for each pass
    this.commandEncoder = this.wgpu.createCommandEncoder();
    // DebugHelper.setLabel(this.commandEncoder, `${renderPass.name}-Encoder`);
    DebugHelper.setLabel(this.commandEncoder, 'ComputePass-Encoder');

    // clear cached encoder state
    this.pipeline = null;

    // TODO: add performance queries to compute passes

    // start the pass
    this.passEncoder = this.commandEncoder.beginComputePass();
    DebugHelper.setLabel(this.passEncoder, 'ComputePass');
    Debug.assert(!this.insideRenderPass, 'ComputePass cannot be started while inside another pass.');
    this.insideRenderPass = true;
  }
  endComputePass() {
    // end the compute pass
    this.passEncoder.end();
    this.passEncoder = null;
    this.insideRenderPass = false;

    // each render pass can use different number of bind groups
    this.bindGroupFormats.length = 0;

    // schedule command buffer submission
    const cb = this.commandEncoder.finish();
    // DebugHelper.setLabel(cb, `${renderPass.name}-CommandBuffer`);
    DebugHelper.setLabel(cb, 'ComputePass-CommandBuffer');
    this.addCommandBuffer(cb);
    this.commandEncoder = null;
    WebgpuDebug.end(this);
    WebgpuDebug.end(this);
  }
  addCommandBuffer(commandBuffer, front = false) {
    if (front) {
      this.commandBuffers.unshift(commandBuffer);
    } else {
      this.commandBuffers.push(commandBuffer);
    }
  }
  submit() {
    if (this.commandBuffers.length > 0) {
      // copy dynamic buffers data to the GPU (this schedules the copy CB to run before all other CBs)
      this.dynamicBuffers.submit();

      // trace all scheduled command buffers
      Debug.call(() => {
        if (this.commandBuffers.length > 0) {
          Debug.trace(TRACEID_RENDER_QUEUE, `SUBMIT (${this.commandBuffers.length})`);
          for (let i = 0; i < this.commandBuffers.length; i++) {
            Debug.trace(TRACEID_RENDER_QUEUE, `  CB: ${this.commandBuffers[i].label}`);
          }
        }
      });
      this.wgpu.queue.submit(this.commandBuffers);
      this.commandBuffers.length = 0;

      // notify dynamic buffers
      this.dynamicBuffers.onCommandBuffersSubmitted();
    }
  }
  clear(options) {
    if (options.flags) {
      this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
    }
  }
  setViewport(x, y, w, h) {
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      if (!this.renderTarget.flipY) {
        y = this.renderTarget.height - y - h;
      }
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
      this.passEncoder.setViewport(x, y, w, h, 0, 1);
    }
  }
  setScissor(x, y, w, h) {
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      if (!this.renderTarget.flipY) {
        y = this.renderTarget.height - y - h;
      }
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
      this.passEncoder.setScissorRect(x, y, w, h);
    }
  }

  /**
   * Copies source render target into destination render target. Mostly used by post-effects.
   *
   * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
   * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
   * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
   * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
   * @returns {boolean} True if the copy was successful, false otherwise.
   */
  copyRenderTarget(source, dest, color, depth) {
    var _this$commandEncoder;
    /** @type {GPUExtent3D} */
    const copySize = {
      width: source ? source.width : dest.width,
      height: source ? source.height : dest.height,
      depthOrArrayLayers: 1
    };

    // use existing or create new encoder if not in a render pass
    const commandEncoder = (_this$commandEncoder = this.commandEncoder) != null ? _this$commandEncoder : this.wgpu.createCommandEncoder();
    DebugHelper.setLabel(commandEncoder, 'CopyRenderTarget-Encoder');
    DebugGraphics.pushGpuMarker(this, 'COPY-RT');
    if (color) {
      // read from supplied render target, or from the framebuffer
      /** @type {GPUImageCopyTexture} */
      const copySrc = {
        texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };

      // write to supplied render target, or to the framebuffer
      /** @type {GPUImageCopyTexture} */
      const copyDst = {
        texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };
      Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
      commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
    }
    if (depth) {
      // read from supplied render target, or from the framebuffer
      const sourceRT = source ? source : this.renderTarget;
      const sourceTexture = sourceRT.impl.depthTexture;
      if (source.samples > 1) {
        // resolve the depth to a color buffer of destination render target
        const destTexture = dest.colorBuffer.impl.gpuTexture;
        this.resolver.resolveDepth(commandEncoder, sourceTexture, destTexture);
      } else {
        // write to supplied render target, or to the framebuffer
        const destTexture = dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture;

        /** @type {GPUImageCopyTexture} */
        const copySrc = {
          texture: sourceTexture,
          mipLevel: 0
        };

        /** @type {GPUImageCopyTexture} */
        const copyDst = {
          texture: destTexture,
          mipLevel: 0
        };
        Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
        commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
      }
    }
    DebugGraphics.popGpuMarker(this);

    // if we created the encoder
    if (!this.commandEncoder) {
      // copy operation runs next
      const cb = commandEncoder.finish();
      DebugHelper.setLabel(cb, 'CopyRenderTarget-CommandBuffer');
      this.addCommandBuffer(cb);
    }
    return true;
  }
  pushMarker(name) {
    var _this$passEncoder;
    (_this$passEncoder = this.passEncoder) == null || _this$passEncoder.pushDebugGroup(name);
  }
  popMarker() {
    var _this$passEncoder2;
    (_this$passEncoder2 = this.passEncoder) == null || _this$passEncoder2.popDebugGroup();
  }
}

export { WebgpuGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfUkVOREVSX1FVRVVFIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUkdCQTMyRiwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0JHUkE4LCBERVZJQ0VUWVBFX1dFQkdQVVxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuLi9ncmFwaGljcy1kZXZpY2UuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBXZWJncHVCaW5kR3JvdXAgfSBmcm9tICcuL3dlYmdwdS1iaW5kLWdyb3VwLmpzJztcbmltcG9ydCB7IFdlYmdwdUJpbmRHcm91cEZvcm1hdCB9IGZyb20gJy4vd2ViZ3B1LWJpbmQtZ3JvdXAtZm9ybWF0LmpzJztcbmltcG9ydCB7IFdlYmdwdUluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdVJlbmRlclBpcGVsaW5lIH0gZnJvbSAnLi93ZWJncHUtcmVuZGVyLXBpcGVsaW5lLmpzJztcbmltcG9ydCB7IFdlYmdwdUNvbXB1dGVQaXBlbGluZSB9IGZyb20gJy4vd2ViZ3B1LWNvbXB1dGUtcGlwZWxpbmUuanMnO1xuaW1wb3J0IHsgV2ViZ3B1UmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi93ZWJncHUtcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBXZWJncHVTaGFkZXIgfSBmcm9tICcuL3dlYmdwdS1zaGFkZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1VGV4dHVyZSB9IGZyb20gJy4vd2ViZ3B1LXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ3B1VW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4vd2ViZ3B1LXVuaWZvcm0tYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdVZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ3B1LXZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1Q2xlYXJSZW5kZXJlciB9IGZyb20gJy4vd2ViZ3B1LWNsZWFyLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdU1pcG1hcFJlbmRlcmVyIH0gZnJvbSAnLi93ZWJncHUtbWlwbWFwLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdURlYnVnIH0gZnJvbSAnLi93ZWJncHUtZGVidWcuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RHluYW1pY0J1ZmZlcnMgfSBmcm9tICcuL3dlYmdwdS1keW5hbWljLWJ1ZmZlcnMuanMnO1xuaW1wb3J0IHsgV2ViZ3B1R3B1UHJvZmlsZXIgfSBmcm9tICcuL3dlYmdwdS1ncHUtcHJvZmlsZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1UmVzb2x2ZXIgfSBmcm9tICcuL3dlYmdwdS1yZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVDb21wdXRlIH0gZnJvbSAnLi93ZWJncHUtY29tcHV0ZS5qcyc7XG5cbmNsYXNzIFdlYmdwdUdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgR3JhcGhpY3NEZXZpY2Uge1xuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgY2FjaGluZyBhbmQgY3JlYXRpb24gb2YgcmVuZGVyIHBpcGVsaW5lcy5cbiAgICAgKi9cbiAgICByZW5kZXJQaXBlbGluZSA9IG5ldyBXZWJncHVSZW5kZXJQaXBlbGluZSh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgY2FjaGluZyBhbmQgY3JlYXRpb24gb2YgY29tcHV0ZSBwaXBlbGluZXMuXG4gICAgICovXG4gICAgY29tcHV0ZVBpcGVsaW5lID0gbmV3IFdlYmdwdUNvbXB1dGVQaXBlbGluZSh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgY2xlYXJpbmcgdGhlIHJlbmRlcmluZyBzdXJmYWNlIGJ5IHJlbmRlcmluZyBhIHF1YWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7IFdlYmdwdUNsZWFyUmVuZGVyZXIgfVxuICAgICAqL1xuICAgIGNsZWFyUmVuZGVyZXI7XG5cbiAgICAvKipcbiAgICAgKiBPYmplY3QgcmVzcG9uc2libGUgZm9yIG1pcG1hcCBnZW5lcmF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUgeyBXZWJncHVNaXBtYXBSZW5kZXJlciB9XG4gICAgICovXG4gICAgbWlwbWFwUmVuZGVyZXI7XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgcGlwZWxpbmUgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVJlbmRlclBpcGVsaW5lfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcGlwZWxpbmU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBiaW5kIGdyb3VwIGZvcm1hdHMsIGJhc2VkIG9uIGN1cnJlbnRseSBhc3NpZ25lZCBiaW5kIGdyb3Vwc1xuICAgICAqXG4gICAgICogQHR5cGUge1dlYmdwdUJpbmRHcm91cEZvcm1hdFtdfVxuICAgICAqL1xuICAgIGJpbmRHcm91cEZvcm1hdHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgY29tbWFuZCBidWZmZXIgZW5jb2Rlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHUFVDb21tYW5kRW5jb2RlcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgY29tbWFuZEVuY29kZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQ29tbWFuZCBidWZmZXJzIHNjaGVkdWxlZCBmb3IgZXhlY3V0aW9uIG9uIHRoZSBHUFUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVQ29tbWFuZEJ1ZmZlcltdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgY29tbWFuZEJ1ZmZlcnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVTdXBwb3J0ZWRMaW1pdHN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsaW1pdHM7XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcihjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICBvcHRpb25zID0gdGhpcy5pbml0T3B0aW9ucztcblxuICAgICAgICAvLyBhbHBoYSBkZWZhdWx0cyB0byB0cnVlXG4gICAgICAgIG9wdGlvbnMuYWxwaGEgPSBvcHRpb25zLmFscGhhID8/IHRydWU7XG5cbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyQW50aWFsaWFzID0gb3B0aW9ucy5hbnRpYWxpYXMgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuaXNXZWJHUFUgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kZXZpY2VUeXBlID0gREVWSUNFVFlQRV9XRUJHUFU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgdGhpcy5jbGVhclJlbmRlcmVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5jbGVhclJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLm1pcG1hcFJlbmRlcmVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5yZXNvbHZlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucmVzb2x2ZXIgPSBudWxsO1xuXG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBpbml0RGV2aWNlQ2FwcygpIHtcblxuICAgICAgICAvLyB0ZW1wb3JhcmlseSBkaXNhYmxlZCBmdW5jdGlvbmFsaXR5IHdoaWNoIGlzIG5vdCBzdXBwb3J0ZWQgdG8gYXZvaWQgZXJyb3JzXG4gICAgICAgIHRoaXMuZGlzYWJsZVBhcnRpY2xlU3lzdGVtID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBsaW1pdHMgPSB0aGlzLmdwdUFkYXB0ZXIubGltaXRzO1xuICAgICAgICB0aGlzLmxpbWl0cyA9IGxpbWl0cztcblxuICAgICAgICB0aGlzLnByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIHRoaXMubWF4UHJlY2lzaW9uID0gJ2hpZ2hwJztcbiAgICAgICAgdGhpcy5tYXhTYW1wbGVzID0gNDtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlcyA9IDE2O1xuICAgICAgICB0aGlzLm1heFRleHR1cmVTaXplID0gbGltaXRzLm1heFRleHR1cmVEaW1lbnNpb24yRDtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uMkQ7XG4gICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uM0Q7XG4gICAgICAgIHRoaXMubWF4Q29sb3JBdHRhY2htZW50cyA9IGxpbWl0cy5tYXhDb2xvckF0dGFjaG1lbnRzO1xuICAgICAgICB0aGlzLm1heFBpeGVsUmF0aW8gPSAxO1xuICAgICAgICB0aGlzLm1heEFuaXNvdHJvcHkgPSAxNjtcbiAgICAgICAgdGhpcy5mcmFnbWVudFVuaWZvcm1zQ291bnQgPSBsaW1pdHMubWF4VW5pZm9ybUJ1ZmZlckJpbmRpbmdTaXplIC8gMTY7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGxpbWl0cy5tYXhVbmlmb3JtQnVmZmVyQmluZGluZ1NpemUgLyAxNjtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVm9sdW1lVGV4dHVyZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQm9uZVRleHR1cmVzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0FyZWFMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzRGVwdGhTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzR3B1UGFydGljbGVzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNcnQgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQ29tcHV0ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdEZpbHRlcmFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSAxMDI0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSB0aGlzLnRleHR1cmVGbG9hdEZpbHRlcmFibGUgPyBQSVhFTEZPUk1BVF9SR0JBMzJGIDogUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNUZXh0dXJlRmV0Y2ggPSB0cnVlO1xuXG4gICAgICAgIC8vIFdlYkdQVSBjdXJyZW50bHkgb25seSBzdXBwb3J0cyAxIGFuZCA0IHNhbXBsZXNcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gdGhpcy5iYWNrQnVmZmVyQW50aWFsaWFzID8gNCA6IDE7XG4gICAgfVxuXG4gICAgYXN5bmMgaW5pdFdlYkdwdShnbHNsYW5nVXJsLCB0d2dzbFVybCkge1xuXG4gICAgICAgIGlmICghd2luZG93Lm5hdmlnYXRvci5ncHUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHJldHJpZXZlIEdQVS4gRW5zdXJlIHlvdSBhcmUgdXNpbmcgYSBicm93c2VyIHRoYXQgc3VwcG9ydHMgV2ViR1BVIHJlbmRlcmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBtZXNzYWdlIHRvIGNvbmZpcm0gV2ViZ3B1IGlzIGJlaW5nIHVzZWRcbiAgICAgICAgRGVidWcubG9nKFwiV2ViZ3B1R3JhcGhpY3NEZXZpY2UgaW5pdGlhbGl6YXRpb24gLi5cIik7XG5cbiAgICAgICAgLy8gYnVpbGQgYSBmdWxsIFVSTCBmcm9tIGEgcmVsYXRpdmUgcGF0aFxuICAgICAgICBjb25zdCBidWlsZFVybCA9IChyZWxhdGl2ZVBhdGgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuICAgICAgICAgICAgdXJsLnBhdGhuYW1lID0gcmVsYXRpdmVQYXRoO1xuICAgICAgICAgICAgdXJsLnNlYXJjaCA9ICcnO1xuICAgICAgICAgICAgcmV0dXJuIHVybC50b1N0cmluZygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBpbXBvcnQoYCR7YnVpbGRVcmwodHdnc2xVcmwpfWApLnRoZW4obW9kdWxlID0+IHR3Z3NsKHR3Z3NsVXJsLnJlcGxhY2UoJy5qcycsICcud2FzbScpKSksXG4gICAgICAgICAgICBpbXBvcnQoYCR7YnVpbGRVcmwoZ2xzbGFuZ1VybCl9YCkudGhlbihtb2R1bGUgPT4gbW9kdWxlLmRlZmF1bHQoKSlcbiAgICAgICAgXSk7XG5cbiAgICAgICAgdGhpcy50d2dzbCA9IHJlc3VsdHNbMF07XG4gICAgICAgIHRoaXMuZ2xzbGFuZyA9IHJlc3VsdHNbMV07XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVSZXF1ZXN0QWRhcHRlck9wdGlvbnN9ICovXG4gICAgICAgIGNvbnN0IGFkYXB0ZXJPcHRpb25zID0ge1xuICAgICAgICAgICAgcG93ZXJQcmVmZXJlbmNlOiB0aGlzLmluaXRPcHRpb25zLnBvd2VyUHJlZmVyZW5jZSAhPT0gJ2RlZmF1bHQnID8gdGhpcy5pbml0T3B0aW9ucy5wb3dlclByZWZlcmVuY2UgOiB1bmRlZmluZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0dQVUFkYXB0ZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdwdUFkYXB0ZXIgPSBhd2FpdCB3aW5kb3cubmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcihhZGFwdGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gb3B0aW9uYWwgZmVhdHVyZXM6XG4gICAgICAgIC8vICAgICAgXCJkZXB0aC1jbGlwLWNvbnRyb2xcIixcbiAgICAgICAgLy8gICAgICBcImRlcHRoMzJmbG9hdC1zdGVuY2lsOFwiLFxuICAgICAgICAvLyAgICAgIFwiaW5kaXJlY3QtZmlyc3QtaW5zdGFuY2VcIixcbiAgICAgICAgLy8gICAgICBcInNoYWRlci1mMTZcIixcbiAgICAgICAgLy8gICAgICBcImJncmE4dW5vcm0tc3RvcmFnZVwiLFxuXG4gICAgICAgIC8vIHJlcXVlc3Qgb3B0aW9uYWwgZmVhdHVyZXNcbiAgICAgICAgY29uc3QgcmVxdWlyZWRGZWF0dXJlcyA9IFtdO1xuICAgICAgICBjb25zdCByZXF1aXJlRmVhdHVyZSA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdXBwb3J0ZWQgPSB0aGlzLmdwdUFkYXB0ZXIuZmVhdHVyZXMuaGFzKGZlYXR1cmUpO1xuICAgICAgICAgICAgaWYgKHN1cHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdXBwb3J0ZWQ7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMudGV4dHVyZUZsb2F0RmlsdGVyYWJsZSA9IHJlcXVpcmVGZWF0dXJlKCdmbG9hdDMyLWZpbHRlcmFibGUnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMgPSByZXF1aXJlRmVhdHVyZSgndGV4dHVyZS1jb21wcmVzc2lvbi1iYycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDID0gcmVxdWlyZUZlYXR1cmUoJ3RleHR1cmUtY29tcHJlc3Npb24tZXRjMicpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyA9IHJlcXVpcmVGZWF0dXJlKCd0ZXh0dXJlLWNvbXByZXNzaW9uLWFzdGMnKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1RpbWVzdGFtcFF1ZXJ5ID0gcmVxdWlyZUZlYXR1cmUoJ3RpbWVzdGFtcC1xdWVyeScpO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVJHMTFCMTBSZW5kZXJhYmxlID0gcmVxdWlyZUZlYXR1cmUoJ3JnMTFiMTB1ZmxvYXQtcmVuZGVyYWJsZScpO1xuICAgICAgICBEZWJ1Zy5sb2coYFdFQkdQVSBmZWF0dXJlczogJHtyZXF1aXJlZEZlYXR1cmVzLmpvaW4oJywgJyl9YCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVEZXZpY2VEZXNjcmlwdG9yfSAqL1xuICAgICAgICBjb25zdCBkZXZpY2VEZXNjciA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXMsXG5cbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCB3ZSBjYW4gcmVxdWVzdCBsaW1pdHMsIGJ1dCBpdCBkb2VzIG5vdCBzZWVtIHRvIGJlIHN1cHBvcnRlZCBhdCB0aGUgbW9tZW50XG4gICAgICAgICAgICByZXF1aXJlZExpbWl0czoge1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZGVmYXVsdFF1ZXVlOiB7XG4gICAgICAgICAgICAgICAgbGFiZWw6ICdEZWZhdWx0IFF1ZXVlJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R1BVRGV2aWNlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy53Z3B1ID0gYXdhaXQgdGhpcy5ncHVBZGFwdGVyLnJlcXVlc3REZXZpY2UoZGV2aWNlRGVzY3IpO1xuXG4gICAgICAgIHRoaXMuaW5pdERldmljZUNhcHMoKTtcblxuICAgICAgICB0aGlzLmdwdUNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCd3ZWJncHUnKTtcblxuICAgICAgICAvLyBwaXhlbCBmb3JtYXQgb2YgdGhlIGZyYW1lYnVmZmVyIGlzIHRoZSBtb3N0IGVmZmljaWVudCBvbmUgb24gdGhlIHN5c3RlbVxuICAgICAgICBjb25zdCBwcmVmZXJyZWRDYW52YXNGb3JtYXQgPSBuYXZpZ2F0b3IuZ3B1LmdldFByZWZlcnJlZENhbnZhc0Zvcm1hdCgpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXJGb3JtYXQgPSBwcmVmZXJyZWRDYW52YXNGb3JtYXQgPT09ICdyZ2JhOHVub3JtJyA/IFBJWEVMRk9STUFUX1JHQkE4IDogUElYRUxGT1JNQVRfQkdSQTg7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbmZpZ3VyYXRpb24gb2YgdGhlIG1haW4gY29sb3JmcmFtZWJ1ZmZlciB3ZSBvYnRhaW4gdXNpbmcgZ2V0Q3VycmVudFRleHR1cmVcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dQVUNhbnZhc0NvbmZpZ3VyYXRpb259XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNhbnZhc0NvbmZpZyA9IHtcbiAgICAgICAgICAgIGRldmljZTogdGhpcy53Z3B1LFxuICAgICAgICAgICAgY29sb3JTcGFjZTogJ3NyZ2InLFxuICAgICAgICAgICAgYWxwaGFNb2RlOiB0aGlzLmluaXRPcHRpb25zLmFscGhhID8gJ3ByZW11bHRpcGxpZWQnIDogJ29wYXF1ZScsXG5cbiAgICAgICAgICAgIC8vIHVzZSBwcmVmZXJyZWQgZm9ybWF0IGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlIG9uIG1vYmlsZVxuICAgICAgICAgICAgZm9ybWF0OiBwcmVmZXJyZWRDYW52YXNGb3JtYXQsXG5cbiAgICAgICAgICAgIC8vIFJFTkRFUl9BVFRBQ0hNRU5UIGlzIHJlcXVpcmVkLCBDT1BZX1NSQyBhbGxvd3Mgc2NlbmUgZ3JhYiB0byBjb3B5IG91dCBmcm9tIGl0XG4gICAgICAgICAgICB1c2FnZTogR1BVVGV4dHVyZVVzYWdlLlJFTkRFUl9BVFRBQ0hNRU5UIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfU1JDIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfRFNULFxuXG4gICAgICAgICAgICAvLyBmb3JtYXRzIHRoYXQgdmlld3MgY3JlYXRlZCBmcm9tIHRleHR1cmVzIHJldHVybmVkIGJ5IGdldEN1cnJlbnRUZXh0dXJlIG1heSB1c2VcbiAgICAgICAgICAgIHZpZXdGb3JtYXRzOiBbXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdwdUNvbnRleHQuY29uZmlndXJlKHRoaXMuY2FudmFzQ29uZmlnKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZUJhY2tidWZmZXIoKTtcblxuICAgICAgICB0aGlzLmNsZWFyUmVuZGVyZXIgPSBuZXcgV2ViZ3B1Q2xlYXJSZW5kZXJlcih0aGlzKTtcbiAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlciA9IG5ldyBXZWJncHVNaXBtYXBSZW5kZXJlcih0aGlzKTtcbiAgICAgICAgdGhpcy5yZXNvbHZlciA9IG5ldyBXZWJncHVSZXNvbHZlcih0aGlzKTtcblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcG9zdEluaXQoKSB7XG4gICAgICAgIHN1cGVyLnBvc3RJbml0KCk7XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplUmVuZGVyU3RhdGUoKTtcbiAgICAgICAgdGhpcy5zZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKTtcblxuICAgICAgICB0aGlzLmdwdVByb2ZpbGVyID0gbmV3IFdlYmdwdUdwdVByb2ZpbGVyKHRoaXMpO1xuXG4gICAgICAgIC8vIGluaXQgZHluYW1pYyBidWZmZXIgdXNpbmcgMU1CIGFsbG9jYXRpb25cbiAgICAgICAgdGhpcy5keW5hbWljQnVmZmVycyA9IG5ldyBXZWJncHVEeW5hbWljQnVmZmVycyh0aGlzLCAxMDI0ICogMTAyNCwgdGhpcy5saW1pdHMubWluVW5pZm9ybUJ1ZmZlck9mZnNldEFsaWdubWVudCk7XG4gICAgfVxuXG4gICAgY3JlYXRlQmFja2J1ZmZlcigpIHtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1N0ZW5jaWwgPSB0aGlzLmluaXRPcHRpb25zLnN0ZW5jaWw7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgbmFtZTogJ1dlYmdwdUZyYW1lYnVmZmVyJyxcbiAgICAgICAgICAgIGdyYXBoaWNzRGV2aWNlOiB0aGlzLFxuICAgICAgICAgICAgZGVwdGg6IHRoaXMuaW5pdE9wdGlvbnMuZGVwdGgsXG4gICAgICAgICAgICBzdGVuY2lsOiB0aGlzLnN1cHBvcnRzU3RlbmNpbCxcbiAgICAgICAgICAgIHNhbXBsZXM6IHRoaXMuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmcmFtZVN0YXJ0KCkge1xuXG4gICAgICAgIHN1cGVyLmZyYW1lU3RhcnQoKTtcbiAgICAgICAgdGhpcy5ncHVQcm9maWxlci5mcmFtZVN0YXJ0KCk7XG5cbiAgICAgICAgLy8gc3VibWl0IGFueSBjb21tYW5kcyBjb2xsZWN0ZWQgYmVmb3JlIHRoZSBmcmFtZSByZW5kZXJpbmdcbiAgICAgICAgdGhpcy5zdWJtaXQoKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5tZW1vcnkodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgIC8vIGN1cnJlbnQgZnJhbWUgY29sb3Igb3V0cHV0IGJ1ZmZlclxuICAgICAgICBjb25zdCBvdXRDb2xvckJ1ZmZlciA9IHRoaXMuZ3B1Q29udGV4dC5nZXRDdXJyZW50VGV4dHVyZSgpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChvdXRDb2xvckJ1ZmZlciwgYCR7dGhpcy5iYWNrQnVmZmVyLm5hbWV9YCk7XG5cbiAgICAgICAgLy8gcmVhbGxvY2F0ZSBmcmFtZWJ1ZmZlciBpZiBkaW1lbnNpb25zIGNoYW5nZSwgdG8gbWF0Y2ggdGhlIG91dHB1dCB0ZXh0dXJlXG4gICAgICAgIGlmICh0aGlzLmJhY2tCdWZmZXJTaXplLnggIT09IG91dENvbG9yQnVmZmVyLndpZHRoIHx8IHRoaXMuYmFja0J1ZmZlclNpemUueSAhPT0gb3V0Q29sb3JCdWZmZXIuaGVpZ2h0KSB7XG5cbiAgICAgICAgICAgIHRoaXMuYmFja0J1ZmZlclNpemUuc2V0KG91dENvbG9yQnVmZmVyLndpZHRoLCBvdXRDb2xvckJ1ZmZlci5oZWlnaHQpO1xuXG4gICAgICAgICAgICB0aGlzLmJhY2tCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5iYWNrQnVmZmVyID0gbnVsbDtcblxuICAgICAgICAgICAgdGhpcy5jcmVhdGVCYWNrYnVmZmVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBydCA9IHRoaXMuYmFja0J1ZmZlcjtcbiAgICAgICAgY29uc3Qgd3J0ID0gcnQuaW1wbDtcblxuICAgICAgICAvLyBhc3NpZ24gdGhlIGZvcm1hdCwgYWxsb3dpbmcgZm9sbG93aW5nIGluaXQgY2FsbCB0byB1c2UgaXQgdG8gYWxsb2NhdGUgbWF0Y2hpbmcgbXVsdGlzYW1wbGVkIGJ1ZmZlclxuICAgICAgICB3cnQuc2V0Q29sb3JBdHRhY2htZW50KDAsIHVuZGVmaW5lZCwgb3V0Q29sb3JCdWZmZXIuZm9ybWF0KTtcblxuICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBjdXJyZW50IGZyYW1lJ3MgcmVuZGVyIHRleHR1cmVcbiAgICAgICAgd3J0LmFzc2lnbkNvbG9yVGV4dHVyZShvdXRDb2xvckJ1ZmZlcik7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKHRoaXMpO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcyk7XG4gICAgfVxuXG4gICAgZnJhbWVFbmQoKSB7XG4gICAgICAgIHN1cGVyLmZyYW1lRW5kKCk7XG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXIuZnJhbWVFbmQoKTtcblxuICAgICAgICAvLyBzdWJtaXQgc2NoZWR1bGVkIGNvbW1hbmQgYnVmZmVyc1xuICAgICAgICB0aGlzLnN1Ym1pdCgpO1xuXG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXIucmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVVuaWZvcm1CdWZmZXJJbXBsKHVuaWZvcm1CdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVVbmlmb3JtQnVmZmVyKHVuaWZvcm1CdWZmZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVWZXJ0ZXhCdWZmZXIodmVydGV4QnVmZmVyLCBmb3JtYXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUluZGV4QnVmZmVySW1wbChpbmRleEJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVNoYWRlcihzaGFkZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmVJbXBsKHRleHR1cmUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVUZXh0dXJlKHRleHR1cmUpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgfVxuXG4gICAgY3JlYXRlQmluZEdyb3VwRm9ybWF0SW1wbChiaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVCaW5kR3JvdXBGb3JtYXQoYmluZEdyb3VwRm9ybWF0KTtcbiAgICB9XG5cbiAgICBjcmVhdGVCaW5kR3JvdXBJbXBsKGJpbmRHcm91cCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUJpbmRHcm91cCgpO1xuICAgIH1cblxuICAgIGNyZWF0ZUNvbXB1dGVJbXBsKGNvbXB1dGUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVDb21wdXRlKGNvbXB1dGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIHRoZSBiaW5kIGdyb3VwIHNsb3RcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYmluZC1ncm91cC5qcycpLkJpbmRHcm91cH0gYmluZEdyb3VwIC0gQmluZCBncm91cCB0byBhdHRhY2hcbiAgICAgKi9cbiAgICBzZXRCaW5kR3JvdXAoaW5kZXgsIGJpbmRHcm91cCkge1xuXG4gICAgICAgIC8vIFRPRE86IHRoaXMgY29uZGl0aW9uIHNob3VsZCBiZSByZW1vdmVkLCBpdCdzIGhlcmUgdG8gaGFuZGxlIGZha2UgZ3JhYiBwYXNzLCB3aGljaCBzaG91bGQgYmUgcmVmYWN0b3JlZCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLnBhc3NFbmNvZGVyKSB7XG5cbiAgICAgICAgICAgIC8vIHNldCBpdCBvbiB0aGUgZGV2aWNlXG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldEJpbmRHcm91cChpbmRleCwgYmluZEdyb3VwLmltcGwuYmluZEdyb3VwLCBiaW5kR3JvdXAudW5pZm9ybUJ1ZmZlck9mZnNldHMpO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgYWN0aXZlIGZvcm1hdHMsIHVzZWQgYnkgdGhlIHBpcGVsaW5lIGNyZWF0aW9uXG4gICAgICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHNbaW5kZXhdID0gYmluZEdyb3VwLmZvcm1hdC5pbXBsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3VibWl0VmVydGV4QnVmZmVyKHZlcnRleEJ1ZmZlciwgc2xvdCkge1xuXG4gICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgY29uc3QgZWxlbWVudENvdW50ID0gZWxlbWVudHMubGVuZ3RoO1xuICAgICAgICBjb25zdCB2YkJ1ZmZlciA9IHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRWZXJ0ZXhCdWZmZXIoc2xvdCArIGksIHZiQnVmZmVyLCBlbGVtZW50c1tpXS5vZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRDb3VudDtcbiAgICB9XG5cbiAgICBkcmF3KHByaW1pdGl2ZSwgbnVtSW5zdGFuY2VzID0gMSwga2VlcEJ1ZmZlcnMpIHtcblxuICAgICAgICBpZiAodGhpcy5zaGFkZXIucmVhZHkgJiYgIXRoaXMuc2hhZGVyLmZhaWxlZCkge1xuXG4gICAgICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZSh0aGlzKTtcblxuICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSB0aGlzLnBhc3NFbmNvZGVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHBhc3NFbmNvZGVyKTtcblxuICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGNvbnN0IHZiMCA9IHRoaXMudmVydGV4QnVmZmVyc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHZiMSA9IHRoaXMudmVydGV4QnVmZmVyc1sxXTtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICBpZiAodmIwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmJTbG90ID0gdGhpcy5zdWJtaXRWZXJ0ZXhCdWZmZXIodmIwLCAwKTtcbiAgICAgICAgICAgICAgICBpZiAodmIxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VibWl0VmVydGV4QnVmZmVyKHZiMSwgdmJTbG90KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBwaXBlbGluZVxuICAgICAgICAgICAgY29uc3QgcGlwZWxpbmUgPSB0aGlzLnJlbmRlclBpcGVsaW5lLmdldChwcmltaXRpdmUsIHZiMD8uZm9ybWF0LCB2YjE/LmZvcm1hdCwgdGhpcy5zaGFkZXIsIHRoaXMucmVuZGVyVGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHMsIHRoaXMuYmxlbmRTdGF0ZSwgdGhpcy5kZXB0aFN0YXRlLCB0aGlzLmN1bGxNb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkLCB0aGlzLnN0ZW5jaWxGcm9udCwgdGhpcy5zdGVuY2lsQmFjayk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQocGlwZWxpbmUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5waXBlbGluZSAhPT0gcGlwZWxpbmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBpcGVsaW5lID0gcGlwZWxpbmU7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICBjb25zdCBpYiA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBpZiAoaWIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRJbmRleEJ1ZmZlcihpYi5pbXBsLmJ1ZmZlciwgaWIuaW1wbC5mb3JtYXQpO1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXdJbmRleGVkKHByaW1pdGl2ZS5jb3VudCwgbnVtSW5zdGFuY2VzLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuZHJhdyhwcmltaXRpdmUuY291bnQsIG51bUluc3RhbmNlcywgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdmIwLFxuICAgICAgICAgICAgICAgIHZiMSxcbiAgICAgICAgICAgICAgICBpYixcbiAgICAgICAgICAgICAgICBwcmltaXRpdmUsXG4gICAgICAgICAgICAgICAgbnVtSW5zdGFuY2VzLFxuICAgICAgICAgICAgICAgIHBpcGVsaW5lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNoYWRlcihzaGFkZXIpIHtcblxuICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIC8vIFRPRE86IHdlIHNob3VsZCBwcm9iYWJseSB0cmFjayBvdGhlciBzdGF0cyBpbnN0ZWFkLCBsaWtlIHBpcGVsaW5lIHN3aXRjaGVzXG4gICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgc2V0QmxlbmRTdGF0ZShibGVuZFN0YXRlKSB7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZS5jb3B5KGJsZW5kU3RhdGUpO1xuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICB0aGlzLmRlcHRoU3RhdGUuY29weShkZXB0aFN0YXRlKTtcbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZyb250LmNvcHkoc3RlbmNpbEZyb250ID8/IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQpO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsQmFjay5jb3B5KHN0ZW5jaWxCYWNrID8/IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQpO1xuXG4gICAgICAgICAgICAvLyByZWYgdmFsdWUgLSBiYXNlZCBvbiBzdGVuY2lsIGZyb250XG4gICAgICAgICAgICBjb25zdCByZWYgPSB0aGlzLnN0ZW5jaWxGcm9udC5yZWY7XG4gICAgICAgICAgICBpZiAodGhpcy5zdGVuY2lsUmVmICE9PSByZWYpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWYgPSByZWY7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRTdGVuY2lsUmVmZXJlbmNlKHJlZik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuYmxlbmRDb2xvcjtcbiAgICAgICAgaWYgKHIgIT09IGMuciB8fCBnICE9PSBjLmcgfHwgYiAhPT0gYy5iIHx8IGEgIT09IGMuYSkge1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldEJsZW5kQ29uc3RhbnQoYyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICB0aGlzLmN1bGxNb2RlID0gY3VsbE1vZGU7XG4gICAgfVxuXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHVwIGRlZmF1bHQgdmFsdWVzIGZvciB0aGUgcmVuZGVyIHBhc3MgZW5jb2Rlci5cbiAgICAgKi9cbiAgICBzZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKSB7XG4gICAgICAgIHRoaXMucGlwZWxpbmUgPSBudWxsO1xuICAgICAgICB0aGlzLnN0ZW5jaWxSZWYgPSAwO1xuICAgICAgICB0aGlzLmJsZW5kQ29sb3Iuc2V0KDAsIDAsIDAsIDApO1xuICAgIH1cblxuICAgIF91cGxvYWREaXJ0eVRleHR1cmVzKCkge1xuXG4gICAgICAgIHRoaXMudGV4dHVyZXMuZm9yRWFjaCgodGV4dHVyZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwcykge1xuICAgICAgICAgICAgICAgIHRleHR1cmUudXBsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIHN0YXJ0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGFydFJlbmRlclBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIC8vIHVwbG9hZCB0ZXh0dXJlcyB0aGF0IG5lZWQgaXQsIHRvIGF2b2lkIHRoZW0gYmVpbmcgdXBsb2FkZWQgLyB0aGVpciBtaXBzIGdlbmVyYXRlZCBkdXJpbmcgdGhlIHBhc3NcbiAgICAgICAgLy8gVE9ETzogdGhpcyBuZWVkcyBhIGJldHRlciBzb2x1dGlvblxuICAgICAgICB0aGlzLl91cGxvYWREaXJ0eVRleHR1cmVzKCk7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuaW50ZXJuYWwodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gcmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQgfHwgdGhpcy5iYWNrQnVmZmVyO1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHJ0O1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocnQpO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7V2ViZ3B1UmVuZGVyVGFyZ2V0fSAqL1xuICAgICAgICBjb25zdCB3cnQgPSBydC5pbXBsO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBlbmNvZGVyIGZvciBlYWNoIHBhc3NcbiAgICAgICAgdGhpcy5jb21tYW5kRW5jb2RlciA9IHRoaXMud2dwdS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh0aGlzLmNvbW1hbmRFbmNvZGVyLCBgJHtyZW5kZXJQYXNzLm5hbWV9LUVuY29kZXJgKTtcblxuICAgICAgICAvLyBmcmFtZWJ1ZmZlciBpcyBpbml0aWFsaXplZCBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgIGlmIChydCAhPT0gdGhpcy5iYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHVwIGNsZWFyIC8gc3RvcmUgLyBsb2FkIHNldHRpbmdzXG4gICAgICAgIHdydC5zZXR1cEZvclJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyUGFzc0Rlc2MgPSB3cnQucmVuZGVyUGFzc0Rlc2NyaXB0b3I7XG5cbiAgICAgICAgLy8gdGltZXN0YW1wXG4gICAgICAgIGlmICh0aGlzLmdwdVByb2ZpbGVyLl9lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ncHVQcm9maWxlci50aW1lc3RhbXBRdWVyaWVzU2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuZ3B1UHJvZmlsZXIuZ2V0U2xvdChyZW5kZXJQYXNzLm5hbWUpO1xuXG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzc0Rlc2MudGltZXN0YW1wV3JpdGVzID0ge1xuICAgICAgICAgICAgICAgICAgICBxdWVyeVNldDogdGhpcy5ncHVQcm9maWxlci50aW1lc3RhbXBRdWVyaWVzU2V0LnF1ZXJ5U2V0LFxuICAgICAgICAgICAgICAgICAgICBiZWdpbm5pbmdPZlBhc3NXcml0ZUluZGV4OiBzbG90ICogMixcbiAgICAgICAgICAgICAgICAgICAgZW5kT2ZQYXNzV3JpdGVJbmRleDogc2xvdCAqIDIgKyAxXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IHRoZSBwYXNzXG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIgPSB0aGlzLmNvbW1hbmRFbmNvZGVyLmJlZ2luUmVuZGVyUGFzcyhyZW5kZXJQYXNzRGVzYyk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMucGFzc0VuY29kZXIsIHJlbmRlclBhc3MubmFtZSk7XG5cbiAgICAgICAgdGhpcy5zZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKTtcblxuICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgIC8vIFRPRE86IGF2b2lkIHRoaXMgc2V0dGluZyB0aGUgYWN0dWFsIHZpZXdwb3J0L3NjaXNzb3Igb24gd2ViZ3B1IGFzIHRob3NlIGFyZSBhdXRvbWF0aWNhbGx5IHJlc2V0IHRvIGZ1bGxcbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldC4gV2UganVzdCBuZWVkIHRvIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZSwgZm9yIHRoZSBnZXQgZnVuY3Rpb25hbGl0eSB0byByZXR1cm4gaXQuXG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gcnQ7XG4gICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaW5zaWRlUmVuZGVyUGFzcywgJ1JlbmRlclBhc3MgY2Fubm90IGJlIHN0YXJ0ZWQgd2hpbGUgaW5zaWRlIGFub3RoZXIgcmVuZGVyIHBhc3MuJyk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIGVuZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kUmVuZGVyUGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgLy8gZW5kIHRoZSByZW5kZXIgcGFzc1xuICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLmVuZCgpO1xuICAgICAgICB0aGlzLnBhc3NFbmNvZGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gZmFsc2U7XG5cbiAgICAgICAgLy8gZWFjaCByZW5kZXIgcGFzcyBjYW4gdXNlIGRpZmZlcmVudCBudW1iZXIgb2YgYmluZCBncm91cHNcbiAgICAgICAgdGhpcy5iaW5kR3JvdXBGb3JtYXRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgbWlwbWFwcyB1c2luZyB0aGUgc2FtZSBjb21tYW5kIGJ1ZmZlciBlbmNvZGVyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyUGFzcy5jb2xvckFycmF5T3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xvck9wcyA9IHJlbmRlclBhc3MuY29sb3JBcnJheU9wc1tpXTtcbiAgICAgICAgICAgIGlmIChjb2xvck9wcy5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlci5nZW5lcmF0ZShyZW5kZXJQYXNzLnJlbmRlclRhcmdldC5fY29sb3JCdWZmZXJzW2ldLmltcGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2NoZWR1bGUgY29tbWFuZCBidWZmZXIgc3VibWlzc2lvblxuICAgICAgICBjb25zdCBjYiA9IHRoaXMuY29tbWFuZEVuY29kZXIuZmluaXNoKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKGNiLCBgJHtyZW5kZXJQYXNzLm5hbWV9LUNvbW1hbmRCdWZmZXJgKTtcblxuICAgICAgICB0aGlzLmFkZENvbW1hbmRCdWZmZXIoY2IpO1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gbnVsbDtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgIH1cblxuICAgIHN0YXJ0Q29tcHV0ZVBhc3MoKSB7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuaW50ZXJuYWwodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBlbmNvZGVyIGZvciBlYWNoIHBhc3NcbiAgICAgICAgdGhpcy5jb21tYW5kRW5jb2RlciA9IHRoaXMud2dwdS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xuICAgICAgICAvLyBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh0aGlzLmNvbW1hbmRFbmNvZGVyLCBgJHtyZW5kZXJQYXNzLm5hbWV9LUVuY29kZXJgKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5jb21tYW5kRW5jb2RlciwgJ0NvbXB1dGVQYXNzLUVuY29kZXInKTtcblxuICAgICAgICAvLyBjbGVhciBjYWNoZWQgZW5jb2RlciBzdGF0ZVxuICAgICAgICB0aGlzLnBpcGVsaW5lID0gbnVsbDtcblxuICAgICAgICAvLyBUT0RPOiBhZGQgcGVyZm9ybWFuY2UgcXVlcmllcyB0byBjb21wdXRlIHBhc3Nlc1xuXG4gICAgICAgIC8vIHN0YXJ0IHRoZSBwYXNzXG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIgPSB0aGlzLmNvbW1hbmRFbmNvZGVyLmJlZ2luQ29tcHV0ZVBhc3MoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5wYXNzRW5jb2RlciwgJ0NvbXB1dGVQYXNzJyk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluc2lkZVJlbmRlclBhc3MsICdDb21wdXRlUGFzcyBjYW5ub3QgYmUgc3RhcnRlZCB3aGlsZSBpbnNpZGUgYW5vdGhlciBwYXNzLicpO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSB0cnVlO1xuICAgIH1cblxuICAgIGVuZENvbXB1dGVQYXNzKCkge1xuXG4gICAgICAgIC8vIGVuZCB0aGUgY29tcHV0ZSBwYXNzXG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIuZW5kKCk7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICAvLyBlYWNoIHJlbmRlciBwYXNzIGNhbiB1c2UgZGlmZmVyZW50IG51bWJlciBvZiBiaW5kIGdyb3Vwc1xuICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBzY2hlZHVsZSBjb21tYW5kIGJ1ZmZlciBzdWJtaXNzaW9uXG4gICAgICAgIGNvbnN0IGNiID0gdGhpcy5jb21tYW5kRW5jb2Rlci5maW5pc2goKTtcbiAgICAgICAgLy8gRGVidWdIZWxwZXIuc2V0TGFiZWwoY2IsIGAke3JlbmRlclBhc3MubmFtZX0tQ29tbWFuZEJ1ZmZlcmApO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChjYiwgJ0NvbXB1dGVQYXNzLUNvbW1hbmRCdWZmZXInKTtcblxuICAgICAgICB0aGlzLmFkZENvbW1hbmRCdWZmZXIoY2IpO1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gbnVsbDtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzKTtcbiAgICB9XG5cbiAgICBhZGRDb21tYW5kQnVmZmVyKGNvbW1hbmRCdWZmZXIsIGZyb250ID0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGZyb250KSB7XG4gICAgICAgICAgICB0aGlzLmNvbW1hbmRCdWZmZXJzLnVuc2hpZnQoY29tbWFuZEJ1ZmZlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbW1hbmRCdWZmZXJzLnB1c2goY29tbWFuZEJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdWJtaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbW1hbmRCdWZmZXJzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgLy8gY29weSBkeW5hbWljIGJ1ZmZlcnMgZGF0YSB0byB0aGUgR1BVICh0aGlzIHNjaGVkdWxlcyB0aGUgY29weSBDQiB0byBydW4gYmVmb3JlIGFsbCBvdGhlciBDQnMpXG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNCdWZmZXJzLnN1Ym1pdCgpO1xuXG4gICAgICAgICAgICAvLyB0cmFjZSBhbGwgc2NoZWR1bGVkIGNvbW1hbmQgYnVmZmVyc1xuICAgICAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29tbWFuZEJ1ZmZlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9RVUVVRSwgYFNVQk1JVCAoJHt0aGlzLmNvbW1hbmRCdWZmZXJzLmxlbmd0aH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jb21tYW5kQnVmZmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfUVVFVUUsIGAgIENCOiAke3RoaXMuY29tbWFuZEJ1ZmZlcnNbaV0ubGFiZWx9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy53Z3B1LnF1ZXVlLnN1Ym1pdCh0aGlzLmNvbW1hbmRCdWZmZXJzKTtcbiAgICAgICAgICAgIHRoaXMuY29tbWFuZEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgLy8gbm90aWZ5IGR5bmFtaWMgYnVmZmVyc1xuICAgICAgICAgICAgdGhpcy5keW5hbWljQnVmZmVycy5vbkNvbW1hbmRCdWZmZXJzU3VibWl0dGVkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjbGVhcihvcHRpb25zKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmZsYWdzKSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUmVuZGVyZXIuY2xlYXIodGhpcywgdGhpcy5yZW5kZXJUYXJnZXQsIG9wdGlvbnMsIHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRWaWV3cG9ydCh4LCB5LCB3LCBoKSB7XG4gICAgICAgIC8vIFRPRE86IG9ubHkgZXhlY3V0ZSB3aGVuIGl0IGNoYW5nZXMuIEFsc28sIHRoZSB2aWV3cG9ydCBvZiBlbmNvZGVyICBtYXRjaGVzIHRoZSByZW5kZXJpbmcgYXR0YWNobWVudHMsXG4gICAgICAgIC8vIHNvIHdlIGNhbiBza2lwIHRoaXMgaWYgZnVsbHNjcmVlblxuICAgICAgICAvLyBUT0RPOiB0aGlzIGNvbmRpdGlvbiBzaG91bGQgYmUgcmVtb3ZlZCwgaXQncyBoZXJlIHRvIGhhbmRsZSBmYWtlIGdyYWIgcGFzcywgd2hpY2ggc2hvdWxkIGJlIHJlZmFjdG9yZWQgaW5zdGVhZFxuICAgICAgICBpZiAodGhpcy5wYXNzRW5jb2Rlcikge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVuZGVyVGFyZ2V0LmZsaXBZKSB7XG4gICAgICAgICAgICAgICAgeSA9IHRoaXMucmVuZGVyVGFyZ2V0LmhlaWdodCAtIHkgLSBoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZ4ID0geDtcbiAgICAgICAgICAgIHRoaXMudnkgPSB5O1xuICAgICAgICAgICAgdGhpcy52dyA9IHc7XG4gICAgICAgICAgICB0aGlzLnZoID0gaDtcblxuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRWaWV3cG9ydCh4LCB5LCB3LCBoLCAwLCAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNjaXNzb3IoeCwgeSwgdywgaCkge1xuICAgICAgICAvLyBUT0RPOiBvbmx5IGV4ZWN1dGUgd2hlbiBpdCBjaGFuZ2VzLiBBbHNvLCB0aGUgdmlld3BvcnQgb2YgZW5jb2RlciAgbWF0Y2hlcyB0aGUgcmVuZGVyaW5nIGF0dGFjaG1lbnRzLFxuICAgICAgICAvLyBzbyB3ZSBjYW4gc2tpcCB0aGlzIGlmIGZ1bGxzY3JlZW5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnJlbmRlclRhcmdldC5mbGlwWSkge1xuICAgICAgICAgICAgICAgIHkgPSB0aGlzLnJlbmRlclRhcmdldC5oZWlnaHQgLSB5IC0gaDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zeCA9IHg7XG4gICAgICAgICAgICB0aGlzLnN5ID0geTtcbiAgICAgICAgICAgIHRoaXMuc3cgPSB3O1xuICAgICAgICAgICAgdGhpcy5zaCA9IGg7XG5cbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0U2Npc3NvclJlY3QoeCwgeSwgdywgaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgc291cmNlIHJlbmRlciB0YXJnZXQgaW50byBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBNb3N0bHkgdXNlZCBieSBwb3N0LWVmZmVjdHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3NvdXJjZV0gLSBUaGUgc291cmNlIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW2Rlc3RdIC0gVGhlIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgY29sb3IgYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29weSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvcHlSZW5kZXJUYXJnZXQoc291cmNlLCBkZXN0LCBjb2xvciwgZGVwdGgpIHtcblxuICAgICAgICAvKiogQHR5cGUge0dQVUV4dGVudDNEfSAqL1xuICAgICAgICBjb25zdCBjb3B5U2l6ZSA9IHtcbiAgICAgICAgICAgIHdpZHRoOiBzb3VyY2UgPyBzb3VyY2Uud2lkdGggOiBkZXN0LndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBzb3VyY2UgPyBzb3VyY2UuaGVpZ2h0IDogZGVzdC5oZWlnaHQsXG4gICAgICAgICAgICBkZXB0aE9yQXJyYXlMYXllcnM6IDFcbiAgICAgICAgfTtcblxuICAgICAgICAvLyB1c2UgZXhpc3Rpbmcgb3IgY3JlYXRlIG5ldyBlbmNvZGVyIGlmIG5vdCBpbiBhIHJlbmRlciBwYXNzXG4gICAgICAgIGNvbnN0IGNvbW1hbmRFbmNvZGVyID0gdGhpcy5jb21tYW5kRW5jb2RlciA/PyB0aGlzLndncHUuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY29tbWFuZEVuY29kZXIsICdDb3B5UmVuZGVyVGFyZ2V0LUVuY29kZXInKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICBpZiAoY29sb3IpIHtcblxuICAgICAgICAgICAgLy8gcmVhZCBmcm9tIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIGZyb20gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5U3JjID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZSA/IHNvdXJjZS5jb2xvckJ1ZmZlci5pbXBsLmdwdVRleHR1cmUgOiB0aGlzLnJlbmRlclRhcmdldC5pbXBsLmFzc2lnbmVkQ29sb3JUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyB3cml0ZSB0byBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciB0byB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlEc3QgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogZGVzdCA/IGRlc3QuY29sb3JCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5hc3NpZ25lZENvbG9yVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGNvcHlTcmMudGV4dHVyZSAhPT0gbnVsbCAmJiBjb3B5RHN0LnRleHR1cmUgIT09IG51bGwpO1xuICAgICAgICAgICAgY29tbWFuZEVuY29kZXIuY29weVRleHR1cmVUb1RleHR1cmUoY29weVNyYywgY29weURzdCwgY29weVNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcHRoKSB7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgZnJvbSBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciBmcm9tIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc291cmNlUlQgPSBzb3VyY2UgPyBzb3VyY2UgOiB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZVRleHR1cmUgPSBzb3VyY2VSVC5pbXBsLmRlcHRoVGV4dHVyZTtcblxuICAgICAgICAgICAgaWYgKHNvdXJjZS5zYW1wbGVzID4gMSkge1xuXG4gICAgICAgICAgICAgICAgLy8gcmVzb2x2ZSB0aGUgZGVwdGggdG8gYSBjb2xvciBidWZmZXIgb2YgZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RUZXh0dXJlID0gZGVzdC5jb2xvckJ1ZmZlci5pbXBsLmdwdVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNvbHZlci5yZXNvbHZlRGVwdGgoY29tbWFuZEVuY29kZXIsIHNvdXJjZVRleHR1cmUsIGRlc3RUZXh0dXJlKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRvIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIHRvIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RUZXh0dXJlID0gZGVzdCA/IGRlc3QuZGVwdGhCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5kZXB0aFRleHR1cmU7XG5cbiAgICAgICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICAgICAgY29uc3QgY29weVNyYyA9IHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZTogc291cmNlVGV4dHVyZSxcbiAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvcHlEc3QgPSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmU6IGRlc3RUZXh0dXJlLFxuICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoY29weVNyYy50ZXh0dXJlICE9PSBudWxsICYmIGNvcHlEc3QudGV4dHVyZSAhPT0gbnVsbCk7XG4gICAgICAgICAgICAgICAgY29tbWFuZEVuY29kZXIuY29weVRleHR1cmVUb1RleHR1cmUoY29weVNyYywgY29weURzdCwgY29weVNpemUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgLy8gaWYgd2UgY3JlYXRlZCB0aGUgZW5jb2RlclxuICAgICAgICBpZiAoIXRoaXMuY29tbWFuZEVuY29kZXIpIHtcblxuICAgICAgICAgICAgLy8gY29weSBvcGVyYXRpb24gcnVucyBuZXh0XG4gICAgICAgICAgICBjb25zdCBjYiA9IGNvbW1hbmRFbmNvZGVyLmZpbmlzaCgpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY2IsICdDb3B5UmVuZGVyVGFyZ2V0LUNvbW1hbmRCdWZmZXInKTtcbiAgICAgICAgICAgIHRoaXMuYWRkQ29tbWFuZEJ1ZmZlcihjYik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXI/LnB1c2hEZWJ1Z0dyb3VwKG5hbWUpO1xuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlcj8ucG9wRGVidWdHcm91cCgpO1xuICAgIH1cbiAgICAvLyAjZW5kaWZcbn1cblxuZXhwb3J0IHsgV2ViZ3B1R3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJXZWJncHVHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwiX29wdGlvbnMkYWxwaGEiLCJfb3B0aW9ucyRhbnRpYWxpYXMiLCJyZW5kZXJQaXBlbGluZSIsIldlYmdwdVJlbmRlclBpcGVsaW5lIiwiY29tcHV0ZVBpcGVsaW5lIiwiV2ViZ3B1Q29tcHV0ZVBpcGVsaW5lIiwiY2xlYXJSZW5kZXJlciIsIm1pcG1hcFJlbmRlcmVyIiwicGlwZWxpbmUiLCJiaW5kR3JvdXBGb3JtYXRzIiwiY29tbWFuZEVuY29kZXIiLCJjb21tYW5kQnVmZmVycyIsImxpbWl0cyIsImluaXRPcHRpb25zIiwiYWxwaGEiLCJiYWNrQnVmZmVyQW50aWFsaWFzIiwiYW50aWFsaWFzIiwiaXNXZWJHUFUiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwiZGVzdHJveSIsInJlc29sdmVyIiwiaW5pdERldmljZUNhcHMiLCJkaXNhYmxlUGFydGljbGVTeXN0ZW0iLCJncHVBZGFwdGVyIiwicHJlY2lzaW9uIiwibWF4UHJlY2lzaW9uIiwibWF4U2FtcGxlcyIsIm1heFRleHR1cmVzIiwibWF4VGV4dHVyZVNpemUiLCJtYXhUZXh0dXJlRGltZW5zaW9uMkQiLCJtYXhDdWJlTWFwU2l6ZSIsIm1heFZvbHVtZVNpemUiLCJtYXhUZXh0dXJlRGltZW5zaW9uM0QiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwibWF4UGl4ZWxSYXRpbyIsIm1heEFuaXNvdHJvcHkiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJtYXhVbmlmb3JtQnVmZmVyQmluZGluZ1NpemUiLCJ2ZXJ0ZXhVbmlmb3Jtc0NvdW50Iiwic3VwcG9ydHNJbnN0YW5jaW5nIiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsInN1cHBvcnRzVm9sdW1lVGV4dHVyZXMiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsInN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJzdXBwb3J0c0RlcHRoU2hhZG93Iiwic3VwcG9ydHNHcHVQYXJ0aWNsZXMiLCJzdXBwb3J0c01ydCIsInN1cHBvcnRzQ29tcHV0ZSIsImV4dFVpbnRFbGVtZW50IiwiZXh0VGV4dHVyZUZsb2F0IiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInRleHR1cmVIYWxmRmxvYXRGaWx0ZXJhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwidGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImJvbmVMaW1pdCIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0QmxlbmRNaW5tYXgiLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJ0ZXh0dXJlRmxvYXRGaWx0ZXJhYmxlIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1JHQkE4Iiwic3VwcG9ydHNUZXh0dXJlRmV0Y2giLCJzYW1wbGVzIiwiaW5pdFdlYkdwdSIsImdsc2xhbmdVcmwiLCJ0d2dzbFVybCIsIndpbmRvdyIsIm5hdmlnYXRvciIsImdwdSIsIkVycm9yIiwiRGVidWciLCJsb2ciLCJidWlsZFVybCIsInJlbGF0aXZlUGF0aCIsInVybCIsIlVSTCIsImxvY2F0aW9uIiwiaHJlZiIsInBhdGhuYW1lIiwic2VhcmNoIiwidG9TdHJpbmciLCJyZXN1bHRzIiwiUHJvbWlzZSIsImFsbCIsInRoZW4iLCJtb2R1bGUiLCJ0d2dzbCIsInJlcGxhY2UiLCJkZWZhdWx0IiwiZ2xzbGFuZyIsImFkYXB0ZXJPcHRpb25zIiwicG93ZXJQcmVmZXJlbmNlIiwidW5kZWZpbmVkIiwicmVxdWVzdEFkYXB0ZXIiLCJyZXF1aXJlZEZlYXR1cmVzIiwicmVxdWlyZUZlYXR1cmUiLCJmZWF0dXJlIiwic3VwcG9ydGVkIiwiZmVhdHVyZXMiLCJoYXMiLCJwdXNoIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFTVEMiLCJzdXBwb3J0c1RpbWVzdGFtcFF1ZXJ5IiwidGV4dHVyZVJHMTFCMTBSZW5kZXJhYmxlIiwiam9pbiIsImRldmljZURlc2NyIiwicmVxdWlyZWRMaW1pdHMiLCJkZWZhdWx0UXVldWUiLCJsYWJlbCIsIndncHUiLCJyZXF1ZXN0RGV2aWNlIiwiZ3B1Q29udGV4dCIsImdldENvbnRleHQiLCJwcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJnZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJiYWNrQnVmZmVyRm9ybWF0IiwiUElYRUxGT1JNQVRfQkdSQTgiLCJjYW52YXNDb25maWciLCJkZXZpY2UiLCJjb2xvclNwYWNlIiwiYWxwaGFNb2RlIiwiZm9ybWF0IiwidXNhZ2UiLCJHUFVUZXh0dXJlVXNhZ2UiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwiQ09QWV9EU1QiLCJ2aWV3Rm9ybWF0cyIsImNvbmZpZ3VyZSIsImNyZWF0ZUJhY2tidWZmZXIiLCJXZWJncHVDbGVhclJlbmRlcmVyIiwiV2ViZ3B1TWlwbWFwUmVuZGVyZXIiLCJXZWJncHVSZXNvbHZlciIsInBvc3RJbml0IiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwic2V0dXBQYXNzRW5jb2RlckRlZmF1bHRzIiwiZ3B1UHJvZmlsZXIiLCJXZWJncHVHcHVQcm9maWxlciIsImR5bmFtaWNCdWZmZXJzIiwiV2ViZ3B1RHluYW1pY0J1ZmZlcnMiLCJtaW5Vbmlmb3JtQnVmZmVyT2Zmc2V0QWxpZ25tZW50Iiwic3VwcG9ydHNTdGVuY2lsIiwic3RlbmNpbCIsImJhY2tCdWZmZXIiLCJSZW5kZXJUYXJnZXQiLCJuYW1lIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXB0aCIsImZyYW1lU3RhcnQiLCJzdWJtaXQiLCJXZWJncHVEZWJ1ZyIsIm1lbW9yeSIsInZhbGlkYXRlIiwib3V0Q29sb3JCdWZmZXIiLCJnZXRDdXJyZW50VGV4dHVyZSIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJiYWNrQnVmZmVyU2l6ZSIsIngiLCJ3aWR0aCIsInkiLCJoZWlnaHQiLCJzZXQiLCJydCIsIndydCIsImltcGwiLCJzZXRDb2xvckF0dGFjaG1lbnQiLCJpbml0UmVuZGVyVGFyZ2V0IiwiYXNzaWduQ29sb3JUZXh0dXJlIiwiZW5kIiwiZnJhbWVFbmQiLCJyZXF1ZXN0IiwiY3JlYXRlVW5pZm9ybUJ1ZmZlckltcGwiLCJ1bmlmb3JtQnVmZmVyIiwiV2ViZ3B1VW5pZm9ybUJ1ZmZlciIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJncHVWZXJ0ZXhCdWZmZXIiLCJjcmVhdGVJbmRleEJ1ZmZlckltcGwiLCJpbmRleEJ1ZmZlciIsIldlYmdwdUluZGV4QnVmZmVyIiwiY3JlYXRlU2hhZGVySW1wbCIsInNoYWRlciIsIldlYmdwdVNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwidGV4dHVyZSIsIldlYmdwdVRleHR1cmUiLCJjcmVhdGVSZW5kZXJUYXJnZXRJbXBsIiwicmVuZGVyVGFyZ2V0IiwiV2ViZ3B1UmVuZGVyVGFyZ2V0IiwiY3JlYXRlQmluZEdyb3VwRm9ybWF0SW1wbCIsImJpbmRHcm91cEZvcm1hdCIsIldlYmdwdUJpbmRHcm91cEZvcm1hdCIsImNyZWF0ZUJpbmRHcm91cEltcGwiLCJiaW5kR3JvdXAiLCJXZWJncHVCaW5kR3JvdXAiLCJjcmVhdGVDb21wdXRlSW1wbCIsImNvbXB1dGUiLCJXZWJncHVDb21wdXRlIiwic2V0QmluZEdyb3VwIiwiaW5kZXgiLCJwYXNzRW5jb2RlciIsInVuaWZvcm1CdWZmZXJPZmZzZXRzIiwic3VibWl0VmVydGV4QnVmZmVyIiwic2xvdCIsImVsZW1lbnRzIiwiZWxlbWVudENvdW50IiwibGVuZ3RoIiwidmJCdWZmZXIiLCJidWZmZXIiLCJpIiwic2V0VmVydGV4QnVmZmVyIiwib2Zmc2V0IiwiZHJhdyIsInByaW1pdGl2ZSIsIm51bUluc3RhbmNlcyIsImtlZXBCdWZmZXJzIiwicmVhZHkiLCJmYWlsZWQiLCJhc3NlcnQiLCJ2YjAiLCJ2ZXJ0ZXhCdWZmZXJzIiwidmIxIiwidmJTbG90IiwiZ2V0IiwiYmxlbmRTdGF0ZSIsImRlcHRoU3RhdGUiLCJjdWxsTW9kZSIsInN0ZW5jaWxFbmFibGVkIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJzZXRQaXBlbGluZSIsImliIiwic2V0SW5kZXhCdWZmZXIiLCJkcmF3SW5kZXhlZCIsImNvdW50Iiwic2V0U2hhZGVyIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzZXRCbGVuZFN0YXRlIiwiY29weSIsInNldERlcHRoU3RhdGUiLCJzZXRTdGVuY2lsU3RhdGUiLCJTdGVuY2lsUGFyYW1ldGVycyIsIkRFRkFVTFQiLCJyZWYiLCJzdGVuY2lsUmVmIiwic2V0U3RlbmNpbFJlZmVyZW5jZSIsInNldEJsZW5kQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiYyIsImJsZW5kQ29sb3IiLCJzZXRCbGVuZENvbnN0YW50Iiwic2V0Q3VsbE1vZGUiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJzdGF0ZSIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwiX3VwbG9hZERpcnR5VGV4dHVyZXMiLCJ0ZXh0dXJlcyIsImZvckVhY2giLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzIiwidXBsb2FkIiwic3RhcnRSZW5kZXJQYXNzIiwicmVuZGVyUGFzcyIsImludGVybmFsIiwiY3JlYXRlQ29tbWFuZEVuY29kZXIiLCJzZXR1cEZvclJlbmRlclBhc3MiLCJyZW5kZXJQYXNzRGVzYyIsInJlbmRlclBhc3NEZXNjcmlwdG9yIiwiX2VuYWJsZWQiLCJ0aW1lc3RhbXBRdWVyaWVzU2V0IiwiZ2V0U2xvdCIsInRpbWVzdGFtcFdyaXRlcyIsInF1ZXJ5U2V0IiwiYmVnaW5uaW5nT2ZQYXNzV3JpdGVJbmRleCIsImVuZE9mUGFzc1dyaXRlSW5kZXgiLCJiZWdpblJlbmRlclBhc3MiLCJzZXRWaWV3cG9ydCIsInNldFNjaXNzb3IiLCJpbnNpZGVSZW5kZXJQYXNzIiwiZW5kUmVuZGVyUGFzcyIsImNvbG9yQXJyYXlPcHMiLCJjb2xvck9wcyIsIm1pcG1hcHMiLCJnZW5lcmF0ZSIsIl9jb2xvckJ1ZmZlcnMiLCJjYiIsImZpbmlzaCIsImFkZENvbW1hbmRCdWZmZXIiLCJzdGFydENvbXB1dGVQYXNzIiwiYmVnaW5Db21wdXRlUGFzcyIsImVuZENvbXB1dGVQYXNzIiwiY29tbWFuZEJ1ZmZlciIsImZyb250IiwidW5zaGlmdCIsImNhbGwiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX1FVRVVFIiwicXVldWUiLCJvbkNvbW1hbmRCdWZmZXJzU3VibWl0dGVkIiwiY2xlYXIiLCJmbGFncyIsImRlZmF1bHRDbGVhck9wdGlvbnMiLCJ3IiwiaCIsImZsaXBZIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNldFNjaXNzb3JSZWN0IiwiY29weVJlbmRlclRhcmdldCIsInNvdXJjZSIsImRlc3QiLCJjb2xvciIsIl90aGlzJGNvbW1hbmRFbmNvZGVyIiwiY29weVNpemUiLCJkZXB0aE9yQXJyYXlMYXllcnMiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImNvcHlTcmMiLCJjb2xvckJ1ZmZlciIsImdwdVRleHR1cmUiLCJhc3NpZ25lZENvbG9yVGV4dHVyZSIsIm1pcExldmVsIiwiY29weURzdCIsImNvcHlUZXh0dXJlVG9UZXh0dXJlIiwic291cmNlUlQiLCJzb3VyY2VUZXh0dXJlIiwiZGVwdGhUZXh0dXJlIiwiZGVzdFRleHR1cmUiLCJyZXNvbHZlRGVwdGgiLCJkZXB0aEJ1ZmZlciIsInBvcEdwdU1hcmtlciIsInB1c2hNYXJrZXIiLCJfdGhpcyRwYXNzRW5jb2RlciIsInB1c2hEZWJ1Z0dyb3VwIiwicG9wTWFya2VyIiwiX3RoaXMkcGFzc0VuY29kZXIyIiwicG9wRGVidWdHcm91cCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTZCQSxNQUFNQSxvQkFBb0IsU0FBU0MsY0FBYyxDQUFDO0FBOEQ5Q0MsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxPQUFPLEdBQUcsRUFBRSxFQUFFO0lBQUEsSUFBQUMsY0FBQSxFQUFBQyxrQkFBQSxDQUFBO0FBQzlCLElBQUEsS0FBSyxDQUFDSCxNQUFNLEVBQUVDLE9BQU8sQ0FBQyxDQUFBO0FBOUQxQjtBQUNKO0FBQ0E7QUFGSSxJQUFBLElBQUEsQ0FHQUcsY0FBYyxHQUFHLElBQUlDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFBO0FBRS9DO0FBQ0o7QUFDQTtBQUZJLElBQUEsSUFBQSxDQUdBQyxlQUFlLEdBQUcsSUFBSUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFakQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0FBRXJCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFDLENBQUFBLGNBQWMsR0FBRyxJQUFJLENBQUE7QUFFckI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsY0FBYyxHQUFHLEVBQUUsQ0FBQTtBQUVuQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFJRmIsT0FBTyxHQUFHLElBQUksQ0FBQ2MsV0FBVyxDQUFBOztBQUUxQjtJQUNBZCxPQUFPLENBQUNlLEtBQUssR0FBQSxDQUFBZCxjQUFBLEdBQUdELE9BQU8sQ0FBQ2UsS0FBSyxLQUFBLElBQUEsR0FBQWQsY0FBQSxHQUFJLElBQUksQ0FBQTtJQUVyQyxJQUFJLENBQUNlLG1CQUFtQixHQUFBLENBQUFkLGtCQUFBLEdBQUdGLE9BQU8sQ0FBQ2lCLFNBQVMsS0FBQSxJQUFBLEdBQUFmLGtCQUFBLEdBQUksS0FBSyxDQUFBO0lBQ3JELElBQUksQ0FBQ2dCLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxXQUFXLEdBQUdDLGlCQUFpQixDQUFBO0FBQ3hDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0lDLEVBQUFBLE9BQU9BLEdBQUc7QUFFTixJQUFBLElBQUksQ0FBQ2QsYUFBYSxDQUFDYyxPQUFPLEVBQUUsQ0FBQTtJQUM1QixJQUFJLENBQUNkLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFFekIsSUFBQSxJQUFJLENBQUNDLGNBQWMsQ0FBQ2EsT0FBTyxFQUFFLENBQUE7SUFDN0IsSUFBSSxDQUFDYixjQUFjLEdBQUcsSUFBSSxDQUFBO0FBRTFCLElBQUEsSUFBSSxDQUFDYyxRQUFRLENBQUNELE9BQU8sRUFBRSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUVwQixLQUFLLENBQUNELE9BQU8sRUFBRSxDQUFBO0FBQ25CLEdBQUE7QUFFQUUsRUFBQUEsY0FBY0EsR0FBRztBQUViO0lBQ0EsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRyxJQUFJLENBQUE7QUFFakMsSUFBQSxNQUFNWCxNQUFNLEdBQUcsSUFBSSxDQUFDWSxVQUFVLENBQUNaLE1BQU0sQ0FBQTtJQUNyQyxJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBRXBCLElBQUksQ0FBQ2EsU0FBUyxHQUFHLE9BQU8sQ0FBQTtJQUN4QixJQUFJLENBQUNDLFlBQVksR0FBRyxPQUFPLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEVBQUUsQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHakIsTUFBTSxDQUFDa0IscUJBQXFCLENBQUE7QUFDbEQsSUFBQSxJQUFJLENBQUNDLGNBQWMsR0FBR25CLE1BQU0sQ0FBQ2tCLHFCQUFxQixDQUFBO0FBQ2xELElBQUEsSUFBSSxDQUFDRSxhQUFhLEdBQUdwQixNQUFNLENBQUNxQixxQkFBcUIsQ0FBQTtBQUNqRCxJQUFBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUd0QixNQUFNLENBQUNzQixtQkFBbUIsQ0FBQTtJQUNyRCxJQUFJLENBQUNDLGFBQWEsR0FBRyxDQUFDLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxhQUFhLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLElBQUEsSUFBSSxDQUFDQyxxQkFBcUIsR0FBR3pCLE1BQU0sQ0FBQzBCLDJCQUEyQixHQUFHLEVBQUUsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUczQixNQUFNLENBQUMwQiwyQkFBMkIsR0FBRyxFQUFFLENBQUE7SUFDbEUsSUFBSSxDQUFDRSxrQkFBa0IsR0FBRyxJQUFJLENBQUE7SUFDOUIsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxJQUFJLENBQUE7SUFDbEMsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxJQUFJLENBQUE7SUFDbEMsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFDaEMsSUFBSSxDQUFDQywrQkFBK0IsR0FBRyxJQUFJLENBQUE7SUFDM0MsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxJQUFJLENBQUE7SUFDOUIsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxJQUFJLENBQUE7SUFDL0IsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxLQUFLLENBQUE7SUFDakMsSUFBSSxDQUFDQyxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUksQ0FBQTtJQUMzQixJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxlQUFlLEdBQUcsSUFBSSxDQUFBO0lBQzNCLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsSUFBSSxDQUFBO0lBQ2xDLElBQUksQ0FBQ0MsMEJBQTBCLEdBQUcsSUFBSSxDQUFBO0lBQ3RDLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQy9CLElBQUksQ0FBQ0MsMEJBQTBCLEdBQUcsSUFBSSxDQUFBO0lBQ3RDLElBQUksQ0FBQ0MseUJBQXlCLEdBQUcsSUFBSSxDQUFBO0lBQ3JDLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTtJQUNyQixJQUFJLENBQUNDLG1CQUFtQixHQUFHLElBQUksQ0FBQTtJQUMvQixJQUFJLENBQUNDLHNCQUFzQixHQUFHLElBQUksQ0FBQTtJQUNsQyxJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxJQUFJLENBQUNDLHNCQUFzQixHQUFHQyxtQkFBbUIsR0FBR0MsaUJBQWlCLENBQUE7SUFDL0YsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7O0FBRWhDO0lBQ0EsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFDbkQsbUJBQW1CLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNuRCxHQUFBO0FBRUEsRUFBQSxNQUFNb0QsVUFBVUEsQ0FBQ0MsVUFBVSxFQUFFQyxRQUFRLEVBQUU7QUFFbkMsSUFBQSxJQUFJLENBQUNDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxHQUFHLEVBQUU7QUFDdkIsTUFBQSxNQUFNLElBQUlDLEtBQUssQ0FBQyx3RkFBd0YsQ0FBQyxDQUFBO0FBQzdHLEtBQUE7O0FBRUE7QUFDQUMsSUFBQUEsS0FBSyxDQUFDQyxHQUFHLENBQUMsd0NBQXdDLENBQUMsQ0FBQTs7QUFFbkQ7SUFDQSxNQUFNQyxRQUFRLEdBQUlDLFlBQVksSUFBSztNQUMvQixNQUFNQyxHQUFHLEdBQUcsSUFBSUMsR0FBRyxDQUFDVCxNQUFNLENBQUNVLFFBQVEsQ0FBQ0MsSUFBSSxDQUFDLENBQUE7TUFDekNILEdBQUcsQ0FBQ0ksUUFBUSxHQUFHTCxZQUFZLENBQUE7TUFDM0JDLEdBQUcsQ0FBQ0ssTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUNmLE1BQUEsT0FBT0wsR0FBRyxDQUFDTSxRQUFRLEVBQUUsQ0FBQTtLQUN4QixDQUFBO0lBRUQsTUFBTUMsT0FBTyxHQUFHLE1BQU1DLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLENBQzlCLE9BQVEsQ0FBQSxFQUFFWCxRQUFRLENBQUNQLFFBQVEsQ0FBRSxDQUFBLENBQUMsQ0FBQyxDQUFDbUIsSUFBSSxDQUFDQyxNQUFNLElBQUlDLEtBQUssQ0FBQ3JCLFFBQVEsQ0FBQ3NCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUN2RixPQUFRLENBQUVmLEVBQUFBLFFBQVEsQ0FBQ1IsVUFBVSxDQUFFLENBQUEsQ0FBQyxDQUFDLENBQUNvQixJQUFJLENBQUNDLE1BQU0sSUFBSUEsTUFBTSxDQUFDRyxPQUFPLEVBQUUsQ0FBQyxDQUNyRSxDQUFDLENBQUE7QUFFRixJQUFBLElBQUksQ0FBQ0YsS0FBSyxHQUFHTCxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkIsSUFBQSxJQUFJLENBQUNRLE9BQU8sR0FBR1IsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBOztBQUV6QjtBQUNBLElBQUEsTUFBTVMsY0FBYyxHQUFHO0FBQ25CQyxNQUFBQSxlQUFlLEVBQUUsSUFBSSxDQUFDbEYsV0FBVyxDQUFDa0YsZUFBZSxLQUFLLFNBQVMsR0FBRyxJQUFJLENBQUNsRixXQUFXLENBQUNrRixlQUFlLEdBQUdDLFNBQUFBO0tBQ3hHLENBQUE7O0FBRUQ7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ3hFLFVBQVUsR0FBRyxNQUFNOEMsTUFBTSxDQUFDQyxTQUFTLENBQUNDLEdBQUcsQ0FBQ3lCLGNBQWMsQ0FBQ0gsY0FBYyxDQUFDLENBQUE7O0FBRTNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtJQUNBLE1BQU1JLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtJQUMzQixNQUFNQyxjQUFjLEdBQUlDLE9BQU8sSUFBSztNQUNoQyxNQUFNQyxTQUFTLEdBQUcsSUFBSSxDQUFDN0UsVUFBVSxDQUFDOEUsUUFBUSxDQUFDQyxHQUFHLENBQUNILE9BQU8sQ0FBQyxDQUFBO0FBQ3ZELE1BQUEsSUFBSUMsU0FBUyxFQUFFO0FBQ1hILFFBQUFBLGdCQUFnQixDQUFDTSxJQUFJLENBQUNKLE9BQU8sQ0FBQyxDQUFBO0FBQ2xDLE9BQUE7QUFDQSxNQUFBLE9BQU9DLFNBQVMsQ0FBQTtLQUNuQixDQUFBO0FBQ0QsSUFBQSxJQUFJLENBQUN2QyxzQkFBc0IsR0FBR3FDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0FBQ2xFLElBQUEsSUFBSSxDQUFDTSx3QkFBd0IsR0FBR04sY0FBYyxDQUFDLHdCQUF3QixDQUFDLENBQUE7QUFDeEUsSUFBQSxJQUFJLENBQUNPLHVCQUF1QixHQUFHUCxjQUFjLENBQUMsMEJBQTBCLENBQUMsQ0FBQTtBQUN6RSxJQUFBLElBQUksQ0FBQ1Esd0JBQXdCLEdBQUdSLGNBQWMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFBO0FBQzFFLElBQUEsSUFBSSxDQUFDUyxzQkFBc0IsR0FBR1QsY0FBYyxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFFL0QsSUFBQSxJQUFJLENBQUNVLHdCQUF3QixHQUFHVixjQUFjLENBQUMsMEJBQTBCLENBQUMsQ0FBQTtJQUMxRXpCLEtBQUssQ0FBQ0MsR0FBRyxDQUFFLENBQW1CdUIsaUJBQUFBLEVBQUFBLGdCQUFnQixDQUFDWSxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUEsQ0FBQyxDQUFDLENBQUE7O0FBRTVEO0FBQ0EsSUFBQSxNQUFNQyxXQUFXLEdBQUc7TUFDaEJiLGdCQUFnQjtBQUVoQjtNQUNBYyxjQUFjLEVBQUUsRUFDZjtBQUVEQyxNQUFBQSxZQUFZLEVBQUU7QUFDVkMsUUFBQUEsS0FBSyxFQUFFLGVBQUE7QUFDWCxPQUFBO0tBQ0gsQ0FBQTs7QUFFRDtBQUNSO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDM0YsVUFBVSxDQUFDNEYsYUFBYSxDQUFDTCxXQUFXLENBQUMsQ0FBQTtJQUU1RCxJQUFJLENBQUN6RixjQUFjLEVBQUUsQ0FBQTtJQUVyQixJQUFJLENBQUMrRixVQUFVLEdBQUcsSUFBSSxDQUFDdkgsTUFBTSxDQUFDd0gsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFBOztBQUVsRDtJQUNBLE1BQU1DLHFCQUFxQixHQUFHaEQsU0FBUyxDQUFDQyxHQUFHLENBQUNnRCx3QkFBd0IsRUFBRSxDQUFBO0lBQ3RFLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUdGLHFCQUFxQixLQUFLLFlBQVksR0FBR3ZELGlCQUFpQixHQUFHMEQsaUJBQWlCLENBQUE7O0FBRXRHO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsWUFBWSxHQUFHO01BQ2hCQyxNQUFNLEVBQUUsSUFBSSxDQUFDVCxJQUFJO0FBQ2pCVSxNQUFBQSxVQUFVLEVBQUUsTUFBTTtNQUNsQkMsU0FBUyxFQUFFLElBQUksQ0FBQ2pILFdBQVcsQ0FBQ0MsS0FBSyxHQUFHLGVBQWUsR0FBRyxRQUFRO0FBRTlEO0FBQ0FpSCxNQUFBQSxNQUFNLEVBQUVSLHFCQUFxQjtBQUU3QjtNQUNBUyxLQUFLLEVBQUVDLGVBQWUsQ0FBQ0MsaUJBQWlCLEdBQUdELGVBQWUsQ0FBQ0UsUUFBUSxHQUFHRixlQUFlLENBQUNHLFFBQVE7QUFFOUY7QUFDQUMsTUFBQUEsV0FBVyxFQUFFLEVBQUE7S0FDaEIsQ0FBQTtJQUNELElBQUksQ0FBQ2hCLFVBQVUsQ0FBQ2lCLFNBQVMsQ0FBQyxJQUFJLENBQUNYLFlBQVksQ0FBQyxDQUFBO0lBRTVDLElBQUksQ0FBQ1ksZ0JBQWdCLEVBQUUsQ0FBQTtBQUV2QixJQUFBLElBQUksQ0FBQ2pJLGFBQWEsR0FBRyxJQUFJa0ksbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDbEQsSUFBQSxJQUFJLENBQUNqSSxjQUFjLEdBQUcsSUFBSWtJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3BELElBQUEsSUFBSSxDQUFDcEgsUUFBUSxHQUFHLElBQUlxSCxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFeEMsSUFBSSxDQUFDQyxRQUFRLEVBQUUsQ0FBQTtBQUVmLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0FBRUFBLEVBQUFBLFFBQVFBLEdBQUc7SUFDUCxLQUFLLENBQUNBLFFBQVEsRUFBRSxDQUFBO0lBRWhCLElBQUksQ0FBQ0MscUJBQXFCLEVBQUUsQ0FBQTtJQUM1QixJQUFJLENBQUNDLHdCQUF3QixFQUFFLENBQUE7QUFFL0IsSUFBQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQTs7QUFFOUM7QUFDQSxJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUlDLG9CQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksQ0FBQ3JJLE1BQU0sQ0FBQ3NJLCtCQUErQixDQUFDLENBQUE7QUFDbEgsR0FBQTtBQUVBWCxFQUFBQSxnQkFBZ0JBLEdBQUc7QUFDZixJQUFBLElBQUksQ0FBQ1ksZUFBZSxHQUFHLElBQUksQ0FBQ3RJLFdBQVcsQ0FBQ3VJLE9BQU8sQ0FBQTtBQUMvQyxJQUFBLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUlDLFlBQVksQ0FBQztBQUMvQkMsTUFBQUEsSUFBSSxFQUFFLG1CQUFtQjtBQUN6QkMsTUFBQUEsY0FBYyxFQUFFLElBQUk7QUFDcEJDLE1BQUFBLEtBQUssRUFBRSxJQUFJLENBQUM1SSxXQUFXLENBQUM0SSxLQUFLO01BQzdCTCxPQUFPLEVBQUUsSUFBSSxDQUFDRCxlQUFlO01BQzdCakYsT0FBTyxFQUFFLElBQUksQ0FBQ0EsT0FBQUE7QUFDbEIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBRUF3RixFQUFBQSxVQUFVQSxHQUFHO0lBRVQsS0FBSyxDQUFDQSxVQUFVLEVBQUUsQ0FBQTtBQUNsQixJQUFBLElBQUksQ0FBQ1osV0FBVyxDQUFDWSxVQUFVLEVBQUUsQ0FBQTs7QUFFN0I7SUFDQSxJQUFJLENBQUNDLE1BQU0sRUFBRSxDQUFBO0FBRWJDLElBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3hCRCxJQUFBQSxXQUFXLENBQUNFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQTs7QUFFMUI7SUFDQSxNQUFNQyxjQUFjLEdBQUcsSUFBSSxDQUFDMUMsVUFBVSxDQUFDMkMsaUJBQWlCLEVBQUUsQ0FBQTtBQUMxREMsSUFBQUEsV0FBVyxDQUFDQyxRQUFRLENBQUNILGNBQWMsRUFBRyxDQUFBLEVBQUUsSUFBSSxDQUFDVixVQUFVLENBQUNFLElBQUssQ0FBQSxDQUFDLENBQUMsQ0FBQTs7QUFFL0Q7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDWSxjQUFjLENBQUNDLENBQUMsS0FBS0wsY0FBYyxDQUFDTSxLQUFLLElBQUksSUFBSSxDQUFDRixjQUFjLENBQUNHLENBQUMsS0FBS1AsY0FBYyxDQUFDUSxNQUFNLEVBQUU7QUFFbkcsTUFBQSxJQUFJLENBQUNKLGNBQWMsQ0FBQ0ssR0FBRyxDQUFDVCxjQUFjLENBQUNNLEtBQUssRUFBRU4sY0FBYyxDQUFDUSxNQUFNLENBQUMsQ0FBQTtBQUVwRSxNQUFBLElBQUksQ0FBQ2xCLFVBQVUsQ0FBQ2pJLE9BQU8sRUFBRSxDQUFBO01BQ3pCLElBQUksQ0FBQ2lJLFVBQVUsR0FBRyxJQUFJLENBQUE7TUFFdEIsSUFBSSxDQUFDZCxnQkFBZ0IsRUFBRSxDQUFBO0FBQzNCLEtBQUE7QUFFQSxJQUFBLE1BQU1rQyxFQUFFLEdBQUcsSUFBSSxDQUFDcEIsVUFBVSxDQUFBO0FBQzFCLElBQUEsTUFBTXFCLEdBQUcsR0FBR0QsRUFBRSxDQUFDRSxJQUFJLENBQUE7O0FBRW5CO0lBQ0FELEdBQUcsQ0FBQ0Usa0JBQWtCLENBQUMsQ0FBQyxFQUFFNUUsU0FBUyxFQUFFK0QsY0FBYyxDQUFDaEMsTUFBTSxDQUFDLENBQUE7QUFFM0QsSUFBQSxJQUFJLENBQUM4QyxnQkFBZ0IsQ0FBQ0osRUFBRSxDQUFDLENBQUE7O0FBRXpCO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQ0ksa0JBQWtCLENBQUNmLGNBQWMsQ0FBQyxDQUFBO0FBRXRDSCxJQUFBQSxXQUFXLENBQUNtQixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDckJuQixJQUFBQSxXQUFXLENBQUNtQixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDekIsR0FBQTtBQUVBQyxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsS0FBSyxDQUFDQSxRQUFRLEVBQUUsQ0FBQTtBQUNoQixJQUFBLElBQUksQ0FBQ2xDLFdBQVcsQ0FBQ2tDLFFBQVEsRUFBRSxDQUFBOztBQUUzQjtJQUNBLElBQUksQ0FBQ3JCLE1BQU0sRUFBRSxDQUFBO0FBRWIsSUFBQSxJQUFJLENBQUNiLFdBQVcsQ0FBQ21DLE9BQU8sRUFBRSxDQUFBO0FBQzlCLEdBQUE7RUFFQUMsdUJBQXVCQSxDQUFDQyxhQUFhLEVBQUU7QUFDbkMsSUFBQSxPQUFPLElBQUlDLG1CQUFtQixDQUFDRCxhQUFhLENBQUMsQ0FBQTtBQUNqRCxHQUFBO0FBRUFFLEVBQUFBLHNCQUFzQkEsQ0FBQ0MsWUFBWSxFQUFFdkQsTUFBTSxFQUFFO0FBQ3pDLElBQUEsT0FBTyxJQUFJd0Qsa0JBQWtCLENBQUNELFlBQVksRUFBRXZELE1BQU0sQ0FBQyxDQUFBO0FBQ3ZELEdBQUE7RUFFQXlELHFCQUFxQkEsQ0FBQ0MsV0FBVyxFQUFFO0FBQy9CLElBQUEsT0FBTyxJQUFJQyxpQkFBaUIsQ0FBQ0QsV0FBVyxDQUFDLENBQUE7QUFDN0MsR0FBQTtFQUVBRSxnQkFBZ0JBLENBQUNDLE1BQU0sRUFBRTtBQUNyQixJQUFBLE9BQU8sSUFBSUMsWUFBWSxDQUFDRCxNQUFNLENBQUMsQ0FBQTtBQUNuQyxHQUFBO0VBRUFFLGlCQUFpQkEsQ0FBQ0MsT0FBTyxFQUFFO0FBQ3ZCLElBQUEsT0FBTyxJQUFJQyxhQUFhLENBQUNELE9BQU8sQ0FBQyxDQUFBO0FBQ3JDLEdBQUE7RUFFQUUsc0JBQXNCQSxDQUFDQyxZQUFZLEVBQUU7QUFDakMsSUFBQSxPQUFPLElBQUlDLGtCQUFrQixDQUFDRCxZQUFZLENBQUMsQ0FBQTtBQUMvQyxHQUFBO0VBRUFFLHlCQUF5QkEsQ0FBQ0MsZUFBZSxFQUFFO0FBQ3ZDLElBQUEsT0FBTyxJQUFJQyxxQkFBcUIsQ0FBQ0QsZUFBZSxDQUFDLENBQUE7QUFDckQsR0FBQTtFQUVBRSxtQkFBbUJBLENBQUNDLFNBQVMsRUFBRTtJQUMzQixPQUFPLElBQUlDLGVBQWUsRUFBRSxDQUFBO0FBQ2hDLEdBQUE7RUFFQUMsaUJBQWlCQSxDQUFDQyxPQUFPLEVBQUU7QUFDdkIsSUFBQSxPQUFPLElBQUlDLGFBQWEsQ0FBQ0QsT0FBTyxDQUFDLENBQUE7QUFDckMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNJRSxFQUFBQSxZQUFZQSxDQUFDQyxLQUFLLEVBQUVOLFNBQVMsRUFBRTtBQUUzQjtJQUNBLElBQUksSUFBSSxDQUFDTyxXQUFXLEVBQUU7QUFFbEI7QUFDQSxNQUFBLElBQUksQ0FBQ0EsV0FBVyxDQUFDRixZQUFZLENBQUNDLEtBQUssRUFBRU4sU0FBUyxDQUFDN0IsSUFBSSxDQUFDNkIsU0FBUyxFQUFFQSxTQUFTLENBQUNRLG9CQUFvQixDQUFDLENBQUE7O0FBRTlGO01BQ0EsSUFBSSxDQUFDdk0sZ0JBQWdCLENBQUNxTSxLQUFLLENBQUMsR0FBR04sU0FBUyxDQUFDekUsTUFBTSxDQUFDNEMsSUFBSSxDQUFBO0FBQ3hELEtBQUE7QUFDSixHQUFBO0FBRUFzQyxFQUFBQSxrQkFBa0JBLENBQUMzQixZQUFZLEVBQUU0QixJQUFJLEVBQUU7QUFFbkMsSUFBQSxNQUFNQyxRQUFRLEdBQUc3QixZQUFZLENBQUN2RCxNQUFNLENBQUNvRixRQUFRLENBQUE7QUFDN0MsSUFBQSxNQUFNQyxZQUFZLEdBQUdELFFBQVEsQ0FBQ0UsTUFBTSxDQUFBO0FBQ3BDLElBQUEsTUFBTUMsUUFBUSxHQUFHaEMsWUFBWSxDQUFDWCxJQUFJLENBQUM0QyxNQUFNLENBQUE7SUFDekMsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdKLFlBQVksRUFBRUksQ0FBQyxFQUFFLEVBQUU7QUFDbkMsTUFBQSxJQUFJLENBQUNULFdBQVcsQ0FBQ1UsZUFBZSxDQUFDUCxJQUFJLEdBQUdNLENBQUMsRUFBRUYsUUFBUSxFQUFFSCxRQUFRLENBQUNLLENBQUMsQ0FBQyxDQUFDRSxNQUFNLENBQUMsQ0FBQTtBQUM1RSxLQUFBO0FBRUEsSUFBQSxPQUFPTixZQUFZLENBQUE7QUFDdkIsR0FBQTtFQUVBTyxJQUFJQSxDQUFDQyxTQUFTLEVBQUVDLFlBQVksR0FBRyxDQUFDLEVBQUVDLFdBQVcsRUFBRTtBQUUzQyxJQUFBLElBQUksSUFBSSxDQUFDbEMsTUFBTSxDQUFDbUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDbkMsTUFBTSxDQUFDb0MsTUFBTSxFQUFFO0FBRTFDcEUsTUFBQUEsV0FBVyxDQUFDRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFMUIsTUFBQSxNQUFNaUQsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFBO0FBQ3BDckksTUFBQUEsS0FBSyxDQUFDdUosTUFBTSxDQUFDbEIsV0FBVyxDQUFDLENBQUE7O0FBRXpCO0FBQ0EsTUFBQSxNQUFNbUIsR0FBRyxHQUFHLElBQUksQ0FBQ0MsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLE1BQUEsTUFBTUMsR0FBRyxHQUFHLElBQUksQ0FBQ0QsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLE1BQUEsSUFBSSxDQUFDQSxhQUFhLENBQUNkLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFN0IsTUFBQSxJQUFJYSxHQUFHLEVBQUU7UUFDTCxNQUFNRyxNQUFNLEdBQUcsSUFBSSxDQUFDcEIsa0JBQWtCLENBQUNpQixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDOUMsUUFBQSxJQUFJRSxHQUFHLEVBQUU7QUFDTCxVQUFBLElBQUksQ0FBQ25CLGtCQUFrQixDQUFDbUIsR0FBRyxFQUFFQyxNQUFNLENBQUMsQ0FBQTtBQUN4QyxTQUFBO0FBQ0osT0FBQTs7QUFFQTtNQUNBLE1BQU03TixRQUFRLEdBQUcsSUFBSSxDQUFDTixjQUFjLENBQUNvTyxHQUFHLENBQUNWLFNBQVMsRUFBRU0sR0FBRyxJQUFIQSxJQUFBQSxHQUFBQSxLQUFBQSxDQUFBQSxHQUFBQSxHQUFHLENBQUVuRyxNQUFNLEVBQUVxRyxHQUFHLElBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFIQSxHQUFHLENBQUVyRyxNQUFNLEVBQUUsSUFBSSxDQUFDNkQsTUFBTSxFQUFFLElBQUksQ0FBQ00sWUFBWSxFQUNuRSxJQUFJLENBQUN6TCxnQkFBZ0IsRUFBRSxJQUFJLENBQUM4TixVQUFVLEVBQUUsSUFBSSxDQUFDQyxVQUFVLEVBQUUsSUFBSSxDQUFDQyxRQUFRLEVBQ3RFLElBQUksQ0FBQ0MsY0FBYyxFQUFFLElBQUksQ0FBQ0MsWUFBWSxFQUFFLElBQUksQ0FBQ0MsV0FBVyxDQUFDLENBQUE7QUFDbEdsSyxNQUFBQSxLQUFLLENBQUN1SixNQUFNLENBQUN6TixRQUFRLENBQUMsQ0FBQTtBQUV0QixNQUFBLElBQUksSUFBSSxDQUFDQSxRQUFRLEtBQUtBLFFBQVEsRUFBRTtRQUM1QixJQUFJLENBQUNBLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQ3hCdU0sUUFBQUEsV0FBVyxDQUFDOEIsV0FBVyxDQUFDck8sUUFBUSxDQUFDLENBQUE7QUFDckMsT0FBQTs7QUFFQTtBQUNBLE1BQUEsTUFBTXNPLEVBQUUsR0FBRyxJQUFJLENBQUNyRCxXQUFXLENBQUE7QUFDM0IsTUFBQSxJQUFJcUQsRUFBRSxFQUFFO1FBQ0osSUFBSSxDQUFDckQsV0FBVyxHQUFHLElBQUksQ0FBQTtBQUN2QnNCLFFBQUFBLFdBQVcsQ0FBQ2dDLGNBQWMsQ0FBQ0QsRUFBRSxDQUFDbkUsSUFBSSxDQUFDNEMsTUFBTSxFQUFFdUIsRUFBRSxDQUFDbkUsSUFBSSxDQUFDNUMsTUFBTSxDQUFDLENBQUE7QUFDMURnRixRQUFBQSxXQUFXLENBQUNpQyxXQUFXLENBQUNwQixTQUFTLENBQUNxQixLQUFLLEVBQUVwQixZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNuRSxPQUFDLE1BQU07QUFDSGQsUUFBQUEsV0FBVyxDQUFDWSxJQUFJLENBQUNDLFNBQVMsQ0FBQ3FCLEtBQUssRUFBRXBCLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDekQsT0FBQTtBQUVBakUsTUFBQUEsV0FBVyxDQUFDbUIsR0FBRyxDQUFDLElBQUksRUFBRTtRQUNsQm1ELEdBQUc7UUFDSEUsR0FBRztRQUNIVSxFQUFFO1FBQ0ZsQixTQUFTO1FBQ1RDLFlBQVk7QUFDWnJOLFFBQUFBLFFBQUFBO0FBQ0osT0FBQyxDQUFDLENBQUE7QUFDTixLQUFBO0FBQ0osR0FBQTtFQUVBME8sU0FBU0EsQ0FBQ3RELE1BQU0sRUFBRTtJQUVkLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBR3BCO0lBQ0EsSUFBSSxDQUFDdUQsdUJBQXVCLEVBQUUsQ0FBQTtBQUc5QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUVBQyxhQUFhQSxDQUFDYixVQUFVLEVBQUU7QUFDdEIsSUFBQSxJQUFJLENBQUNBLFVBQVUsQ0FBQ2MsSUFBSSxDQUFDZCxVQUFVLENBQUMsQ0FBQTtBQUNwQyxHQUFBO0VBRUFlLGFBQWFBLENBQUNkLFVBQVUsRUFBRTtBQUN0QixJQUFBLElBQUksQ0FBQ0EsVUFBVSxDQUFDYSxJQUFJLENBQUNiLFVBQVUsQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7QUFFQWUsRUFBQUEsZUFBZUEsQ0FBQ1osWUFBWSxFQUFFQyxXQUFXLEVBQUU7SUFDdkMsSUFBSUQsWUFBWSxJQUFJQyxXQUFXLEVBQUU7TUFDN0IsSUFBSSxDQUFDRixjQUFjLEdBQUcsSUFBSSxDQUFBO0FBQzFCLE1BQUEsSUFBSSxDQUFDQyxZQUFZLENBQUNVLElBQUksQ0FBQ1YsWUFBWSxJQUFaQSxJQUFBQSxHQUFBQSxZQUFZLEdBQUlhLGlCQUFpQixDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUNqRSxNQUFBLElBQUksQ0FBQ2IsV0FBVyxDQUFDUyxJQUFJLENBQUNULFdBQVcsSUFBWEEsSUFBQUEsR0FBQUEsV0FBVyxHQUFJWSxpQkFBaUIsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7O0FBRS9EO0FBQ0EsTUFBQSxNQUFNQyxHQUFHLEdBQUcsSUFBSSxDQUFDZixZQUFZLENBQUNlLEdBQUcsQ0FBQTtBQUNqQyxNQUFBLElBQUksSUFBSSxDQUFDQyxVQUFVLEtBQUtELEdBQUcsRUFBRTtRQUN6QixJQUFJLENBQUNDLFVBQVUsR0FBR0QsR0FBRyxDQUFBO0FBQ3JCLFFBQUEsSUFBSSxDQUFDM0MsV0FBVyxDQUFDNkMsbUJBQW1CLENBQUNGLEdBQUcsQ0FBQyxDQUFBO0FBQzdDLE9BQUE7QUFDSixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUNoQixjQUFjLEdBQUcsS0FBSyxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBO0VBRUFtQixhQUFhQSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7QUFDdEIsSUFBQSxNQUFNQyxDQUFDLEdBQUcsSUFBSSxDQUFDQyxVQUFVLENBQUE7SUFDekIsSUFBSUwsQ0FBQyxLQUFLSSxDQUFDLENBQUNKLENBQUMsSUFBSUMsQ0FBQyxLQUFLRyxDQUFDLENBQUNILENBQUMsSUFBSUMsQ0FBQyxLQUFLRSxDQUFDLENBQUNGLENBQUMsSUFBSUMsQ0FBQyxLQUFLQyxDQUFDLENBQUNELENBQUMsRUFBRTtNQUNsREMsQ0FBQyxDQUFDMUYsR0FBRyxDQUFDc0YsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDakIsTUFBQSxJQUFJLENBQUNsRCxXQUFXLENBQUNxRCxnQkFBZ0IsQ0FBQ0YsQ0FBQyxDQUFDLENBQUE7QUFDeEMsS0FBQTtBQUNKLEdBQUE7RUFFQUcsV0FBV0EsQ0FBQzVCLFFBQVEsRUFBRTtJQUNsQixJQUFJLENBQUNBLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQzVCLEdBQUE7RUFFQTZCLGtCQUFrQkEsQ0FBQ0MsS0FBSyxFQUFFLEVBQzFCO0FBRUFDLEVBQUFBLHVCQUF1QkEsR0FBRztJQUN0QixLQUFLLENBQUNBLHVCQUF1QixFQUFFLENBQUE7QUFDbkMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDSTNILEVBQUFBLHdCQUF3QkEsR0FBRztJQUN2QixJQUFJLENBQUNySSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ21QLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDbkIsSUFBQSxJQUFJLENBQUNRLFVBQVUsQ0FBQzNGLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNuQyxHQUFBO0FBRUFpRyxFQUFBQSxvQkFBb0JBLEdBQUc7QUFFbkIsSUFBQSxJQUFJLENBQUNDLFFBQVEsQ0FBQ0MsT0FBTyxDQUFFNUUsT0FBTyxJQUFLO0FBQy9CLE1BQUEsSUFBSUEsT0FBTyxDQUFDNkUsWUFBWSxJQUFJN0UsT0FBTyxDQUFDOEUsYUFBYSxFQUFFO1FBQy9DOUUsT0FBTyxDQUFDK0UsTUFBTSxFQUFFLENBQUE7QUFDcEIsT0FBQTtBQUNKLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsZUFBZUEsQ0FBQ0MsVUFBVSxFQUFFO0FBRXhCO0FBQ0E7SUFDQSxJQUFJLENBQUNQLG9CQUFvQixFQUFFLENBQUE7QUFFM0I3RyxJQUFBQSxXQUFXLENBQUNxSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDMUJySCxJQUFBQSxXQUFXLENBQUNFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUUxQixNQUFNVyxFQUFFLEdBQUd1RyxVQUFVLENBQUM5RSxZQUFZLElBQUksSUFBSSxDQUFDN0MsVUFBVSxDQUFBO0lBQ3JELElBQUksQ0FBQzZDLFlBQVksR0FBR3pCLEVBQUUsQ0FBQTtBQUN0Qi9GLElBQUFBLEtBQUssQ0FBQ3VKLE1BQU0sQ0FBQ3hELEVBQUUsQ0FBQyxDQUFBOztBQUVoQjtBQUNBLElBQUEsTUFBTUMsR0FBRyxHQUFHRCxFQUFFLENBQUNFLElBQUksQ0FBQTs7QUFFbkI7SUFDQSxJQUFJLENBQUNqSyxjQUFjLEdBQUcsSUFBSSxDQUFDeUcsSUFBSSxDQUFDK0osb0JBQW9CLEVBQUUsQ0FBQTtBQUN0RGpILElBQUFBLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDLElBQUksQ0FBQ3hKLGNBQWMsRUFBRyxDQUFBLEVBQUVzUSxVQUFVLENBQUN6SCxJQUFLLENBQUEsUUFBQSxDQUFTLENBQUMsQ0FBQTs7QUFFdkU7QUFDQSxJQUFBLElBQUlrQixFQUFFLEtBQUssSUFBSSxDQUFDcEIsVUFBVSxFQUFFO0FBQ3hCLE1BQUEsSUFBSSxDQUFDd0IsZ0JBQWdCLENBQUNKLEVBQUUsQ0FBQyxDQUFBO0FBQzdCLEtBQUE7O0FBRUE7QUFDQUMsSUFBQUEsR0FBRyxDQUFDeUcsa0JBQWtCLENBQUNILFVBQVUsQ0FBQyxDQUFBO0FBRWxDLElBQUEsTUFBTUksY0FBYyxHQUFHMUcsR0FBRyxDQUFDMkcsb0JBQW9CLENBQUE7O0FBRS9DO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQ3ZJLFdBQVcsQ0FBQ3dJLFFBQVEsRUFBRTtBQUMzQixNQUFBLElBQUksSUFBSSxDQUFDeEksV0FBVyxDQUFDeUksbUJBQW1CLEVBQUU7UUFDdEMsTUFBTXJFLElBQUksR0FBRyxJQUFJLENBQUNwRSxXQUFXLENBQUMwSSxPQUFPLENBQUNSLFVBQVUsQ0FBQ3pILElBQUksQ0FBQyxDQUFBO1FBRXRENkgsY0FBYyxDQUFDSyxlQUFlLEdBQUc7QUFDN0JDLFVBQUFBLFFBQVEsRUFBRSxJQUFJLENBQUM1SSxXQUFXLENBQUN5SSxtQkFBbUIsQ0FBQ0csUUFBUTtVQUN2REMseUJBQXlCLEVBQUV6RSxJQUFJLEdBQUcsQ0FBQztBQUNuQzBFLFVBQUFBLG1CQUFtQixFQUFFMUUsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFBO1NBQ25DLENBQUE7QUFDTCxPQUFBO0FBQ0osS0FBQTs7QUFFQTtJQUNBLElBQUksQ0FBQ0gsV0FBVyxHQUFHLElBQUksQ0FBQ3JNLGNBQWMsQ0FBQ21SLGVBQWUsQ0FBQ1QsY0FBYyxDQUFDLENBQUE7SUFDdEVuSCxXQUFXLENBQUNDLFFBQVEsQ0FBQyxJQUFJLENBQUM2QyxXQUFXLEVBQUVpRSxVQUFVLENBQUN6SCxJQUFJLENBQUMsQ0FBQTtJQUV2RCxJQUFJLENBQUNWLHdCQUF3QixFQUFFLENBQUE7O0FBRS9CO0FBQ0E7QUFDQTtJQUNBLE1BQU07TUFBRXdCLEtBQUs7QUFBRUUsTUFBQUEsTUFBQUE7QUFBTyxLQUFDLEdBQUdFLEVBQUUsQ0FBQTtJQUM1QixJQUFJLENBQUNxSCxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRXpILEtBQUssRUFBRUUsTUFBTSxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDd0gsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUxSCxLQUFLLEVBQUVFLE1BQU0sQ0FBQyxDQUFBO0lBRXBDN0YsS0FBSyxDQUFDdUosTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDK0QsZ0JBQWdCLEVBQUUsZ0VBQWdFLENBQUMsQ0FBQTtJQUN0RyxJQUFJLENBQUNBLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxhQUFhQSxDQUFDakIsVUFBVSxFQUFFO0FBRXRCO0FBQ0EsSUFBQSxJQUFJLENBQUNqRSxXQUFXLENBQUNoQyxHQUFHLEVBQUUsQ0FBQTtJQUN0QixJQUFJLENBQUNnQyxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ2lGLGdCQUFnQixHQUFHLEtBQUssQ0FBQTs7QUFFN0I7QUFDQSxJQUFBLElBQUksQ0FBQ3ZSLGdCQUFnQixDQUFDNE0sTUFBTSxHQUFHLENBQUMsQ0FBQTs7QUFFaEM7QUFDQSxJQUFBLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHd0QsVUFBVSxDQUFDa0IsYUFBYSxDQUFDN0UsTUFBTSxFQUFFRyxDQUFDLEVBQUUsRUFBRTtBQUN0RCxNQUFBLE1BQU0yRSxRQUFRLEdBQUduQixVQUFVLENBQUNrQixhQUFhLENBQUMxRSxDQUFDLENBQUMsQ0FBQTtNQUM1QyxJQUFJMkUsUUFBUSxDQUFDQyxPQUFPLEVBQUU7QUFDbEIsUUFBQSxJQUFJLENBQUM3UixjQUFjLENBQUM4UixRQUFRLENBQUNyQixVQUFVLENBQUM5RSxZQUFZLENBQUNvRyxhQUFhLENBQUM5RSxDQUFDLENBQUMsQ0FBQzdDLElBQUksQ0FBQyxDQUFBO0FBQy9FLE9BQUE7QUFDSixLQUFBOztBQUVBO0lBQ0EsTUFBTTRILEVBQUUsR0FBRyxJQUFJLENBQUM3UixjQUFjLENBQUM4UixNQUFNLEVBQUUsQ0FBQTtJQUN2Q3ZJLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDcUksRUFBRSxFQUFHLEdBQUV2QixVQUFVLENBQUN6SCxJQUFLLENBQUEsY0FBQSxDQUFlLENBQUMsQ0FBQTtBQUU1RCxJQUFBLElBQUksQ0FBQ2tKLGdCQUFnQixDQUFDRixFQUFFLENBQUMsQ0FBQTtJQUN6QixJQUFJLENBQUM3UixjQUFjLEdBQUcsSUFBSSxDQUFBO0FBRTFCa0osSUFBQUEsV0FBVyxDQUFDbUIsR0FBRyxDQUFDLElBQUksRUFBRTtBQUFFaUcsTUFBQUEsVUFBQUE7QUFBVyxLQUFDLENBQUMsQ0FBQTtBQUNyQ3BILElBQUFBLFdBQVcsQ0FBQ21CLEdBQUcsQ0FBQyxJQUFJLEVBQUU7QUFBRWlHLE1BQUFBLFVBQUFBO0FBQVcsS0FBQyxDQUFDLENBQUE7QUFDekMsR0FBQTtBQUVBMEIsRUFBQUEsZ0JBQWdCQSxHQUFHO0FBRWY5SSxJQUFBQSxXQUFXLENBQUNxSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDMUJySCxJQUFBQSxXQUFXLENBQUNFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQTs7QUFFMUI7SUFDQSxJQUFJLENBQUNwSixjQUFjLEdBQUcsSUFBSSxDQUFDeUcsSUFBSSxDQUFDK0osb0JBQW9CLEVBQUUsQ0FBQTtBQUN0RDtJQUNBakgsV0FBVyxDQUFDQyxRQUFRLENBQUMsSUFBSSxDQUFDeEosY0FBYyxFQUFFLHFCQUFxQixDQUFDLENBQUE7O0FBRWhFO0lBQ0EsSUFBSSxDQUFDRixRQUFRLEdBQUcsSUFBSSxDQUFBOztBQUVwQjs7QUFFQTtJQUNBLElBQUksQ0FBQ3VNLFdBQVcsR0FBRyxJQUFJLENBQUNyTSxjQUFjLENBQUNpUyxnQkFBZ0IsRUFBRSxDQUFBO0lBQ3pEMUksV0FBVyxDQUFDQyxRQUFRLENBQUMsSUFBSSxDQUFDNkMsV0FBVyxFQUFFLGFBQWEsQ0FBQyxDQUFBO0lBRXJEckksS0FBSyxDQUFDdUosTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDK0QsZ0JBQWdCLEVBQUUsMERBQTBELENBQUMsQ0FBQTtJQUNoRyxJQUFJLENBQUNBLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUNoQyxHQUFBO0FBRUFZLEVBQUFBLGNBQWNBLEdBQUc7QUFFYjtBQUNBLElBQUEsSUFBSSxDQUFDN0YsV0FBVyxDQUFDaEMsR0FBRyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDZ0MsV0FBVyxHQUFHLElBQUksQ0FBQTtJQUN2QixJQUFJLENBQUNpRixnQkFBZ0IsR0FBRyxLQUFLLENBQUE7O0FBRTdCO0FBQ0EsSUFBQSxJQUFJLENBQUN2UixnQkFBZ0IsQ0FBQzRNLE1BQU0sR0FBRyxDQUFDLENBQUE7O0FBRWhDO0lBQ0EsTUFBTWtGLEVBQUUsR0FBRyxJQUFJLENBQUM3UixjQUFjLENBQUM4UixNQUFNLEVBQUUsQ0FBQTtBQUN2QztBQUNBdkksSUFBQUEsV0FBVyxDQUFDQyxRQUFRLENBQUNxSSxFQUFFLEVBQUUsMkJBQTJCLENBQUMsQ0FBQTtBQUVyRCxJQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNGLEVBQUUsQ0FBQyxDQUFBO0lBQ3pCLElBQUksQ0FBQzdSLGNBQWMsR0FBRyxJQUFJLENBQUE7QUFFMUJrSixJQUFBQSxXQUFXLENBQUNtQixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDckJuQixJQUFBQSxXQUFXLENBQUNtQixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDekIsR0FBQTtBQUVBMEgsRUFBQUEsZ0JBQWdCQSxDQUFDSSxhQUFhLEVBQUVDLEtBQUssR0FBRyxLQUFLLEVBQUU7QUFDM0MsSUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUCxNQUFBLElBQUksQ0FBQ25TLGNBQWMsQ0FBQ29TLE9BQU8sQ0FBQ0YsYUFBYSxDQUFDLENBQUE7QUFDOUMsS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJLENBQUNsUyxjQUFjLENBQUM2RixJQUFJLENBQUNxTSxhQUFhLENBQUMsQ0FBQTtBQUMzQyxLQUFBO0FBQ0osR0FBQTtBQUVBbEosRUFBQUEsTUFBTUEsR0FBRztBQUNMLElBQUEsSUFBSSxJQUFJLENBQUNoSixjQUFjLENBQUMwTSxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBRWhDO0FBQ0EsTUFBQSxJQUFJLENBQUNyRSxjQUFjLENBQUNXLE1BQU0sRUFBRSxDQUFBOztBQUU1QjtNQUNBakYsS0FBSyxDQUFDc08sSUFBSSxDQUFDLE1BQU07QUFDYixRQUFBLElBQUksSUFBSSxDQUFDclMsY0FBYyxDQUFDME0sTUFBTSxHQUFHLENBQUMsRUFBRTtBQUNoQzNJLFVBQUFBLEtBQUssQ0FBQ3VPLEtBQUssQ0FBQ0Msb0JBQW9CLEVBQUcsQ0FBQSxRQUFBLEVBQVUsSUFBSSxDQUFDdlMsY0FBYyxDQUFDME0sTUFBTyxDQUFBLENBQUEsQ0FBRSxDQUFDLENBQUE7QUFDM0UsVUFBQSxLQUFLLElBQUlHLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUM3TSxjQUFjLENBQUMwTSxNQUFNLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQ2pEOUksWUFBQUEsS0FBSyxDQUFDdU8sS0FBSyxDQUFDQyxvQkFBb0IsRUFBRyxDQUFRLE1BQUEsRUFBQSxJQUFJLENBQUN2UyxjQUFjLENBQUM2TSxDQUFDLENBQUMsQ0FBQ3RHLEtBQU0sRUFBQyxDQUFDLENBQUE7QUFDOUUsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFDLENBQUMsQ0FBQTtNQUVGLElBQUksQ0FBQ0MsSUFBSSxDQUFDZ00sS0FBSyxDQUFDeEosTUFBTSxDQUFDLElBQUksQ0FBQ2hKLGNBQWMsQ0FBQyxDQUFBO0FBQzNDLE1BQUEsSUFBSSxDQUFDQSxjQUFjLENBQUMwTSxNQUFNLEdBQUcsQ0FBQyxDQUFBOztBQUU5QjtBQUNBLE1BQUEsSUFBSSxDQUFDckUsY0FBYyxDQUFDb0sseUJBQXlCLEVBQUUsQ0FBQTtBQUNuRCxLQUFBO0FBQ0osR0FBQTtFQUVBQyxLQUFLQSxDQUFDdFQsT0FBTyxFQUFFO0lBQ1gsSUFBSUEsT0FBTyxDQUFDdVQsS0FBSyxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNoVCxhQUFhLENBQUMrUyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQ25ILFlBQVksRUFBRW5NLE9BQU8sRUFBRSxJQUFJLENBQUN3VCxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3hGLEtBQUE7QUFDSixHQUFBO0VBRUF6QixXQUFXQSxDQUFDMUgsQ0FBQyxFQUFFRSxDQUFDLEVBQUVrSixDQUFDLEVBQUVDLENBQUMsRUFBRTtBQUNwQjtBQUNBO0FBQ0E7SUFDQSxJQUFJLElBQUksQ0FBQzFHLFdBQVcsRUFBRTtBQUVsQixNQUFBLElBQUksQ0FBQyxJQUFJLENBQUNiLFlBQVksQ0FBQ3dILEtBQUssRUFBRTtRQUMxQnBKLENBQUMsR0FBRyxJQUFJLENBQUM0QixZQUFZLENBQUMzQixNQUFNLEdBQUdELENBQUMsR0FBR21KLENBQUMsQ0FBQTtBQUN4QyxPQUFBO01BRUEsSUFBSSxDQUFDRSxFQUFFLEdBQUd2SixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUN3SixFQUFFLEdBQUd0SixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUN1SixFQUFFLEdBQUdMLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ00sRUFBRSxHQUFHTCxDQUFDLENBQUE7QUFFWCxNQUFBLElBQUksQ0FBQzFHLFdBQVcsQ0FBQytFLFdBQVcsQ0FBQzFILENBQUMsRUFBRUUsQ0FBQyxFQUFFa0osQ0FBQyxFQUFFQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2xELEtBQUE7QUFDSixHQUFBO0VBRUExQixVQUFVQSxDQUFDM0gsQ0FBQyxFQUFFRSxDQUFDLEVBQUVrSixDQUFDLEVBQUVDLENBQUMsRUFBRTtBQUNuQjtBQUNBO0FBQ0E7SUFDQSxJQUFJLElBQUksQ0FBQzFHLFdBQVcsRUFBRTtBQUVsQixNQUFBLElBQUksQ0FBQyxJQUFJLENBQUNiLFlBQVksQ0FBQ3dILEtBQUssRUFBRTtRQUMxQnBKLENBQUMsR0FBRyxJQUFJLENBQUM0QixZQUFZLENBQUMzQixNQUFNLEdBQUdELENBQUMsR0FBR21KLENBQUMsQ0FBQTtBQUN4QyxPQUFBO01BRUEsSUFBSSxDQUFDTSxFQUFFLEdBQUczSixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUM0SixFQUFFLEdBQUcxSixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUMySixFQUFFLEdBQUdULENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ1UsRUFBRSxHQUFHVCxDQUFDLENBQUE7QUFFWCxNQUFBLElBQUksQ0FBQzFHLFdBQVcsQ0FBQ29ILGNBQWMsQ0FBQy9KLENBQUMsRUFBRUUsQ0FBQyxFQUFFa0osQ0FBQyxFQUFFQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSVcsZ0JBQWdCQSxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFOUssS0FBSyxFQUFFO0FBQUEsSUFBQSxJQUFBK0ssb0JBQUEsQ0FBQTtBQUV6QztBQUNBLElBQUEsTUFBTUMsUUFBUSxHQUFHO01BQ2JwSyxLQUFLLEVBQUVnSyxNQUFNLEdBQUdBLE1BQU0sQ0FBQ2hLLEtBQUssR0FBR2lLLElBQUksQ0FBQ2pLLEtBQUs7TUFDekNFLE1BQU0sRUFBRThKLE1BQU0sR0FBR0EsTUFBTSxDQUFDOUosTUFBTSxHQUFHK0osSUFBSSxDQUFDL0osTUFBTTtBQUM1Q21LLE1BQUFBLGtCQUFrQixFQUFFLENBQUE7S0FDdkIsQ0FBQTs7QUFFRDtBQUNBLElBQUEsTUFBTWhVLGNBQWMsR0FBQThULENBQUFBLG9CQUFBLEdBQUcsSUFBSSxDQUFDOVQsY0FBYyxLQUFBLElBQUEsR0FBQThULG9CQUFBLEdBQUksSUFBSSxDQUFDck4sSUFBSSxDQUFDK0osb0JBQW9CLEVBQUUsQ0FBQTtBQUM5RWpILElBQUFBLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDeEosY0FBYyxFQUFFLDBCQUEwQixDQUFDLENBQUE7QUFFaEVpVSxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUE7QUFFNUMsSUFBQSxJQUFJTCxLQUFLLEVBQUU7QUFFUDtBQUNBO0FBQ0EsTUFBQSxNQUFNTSxPQUFPLEdBQUc7QUFDWjlJLFFBQUFBLE9BQU8sRUFBRXNJLE1BQU0sR0FBR0EsTUFBTSxDQUFDUyxXQUFXLENBQUNuSyxJQUFJLENBQUNvSyxVQUFVLEdBQUcsSUFBSSxDQUFDN0ksWUFBWSxDQUFDdkIsSUFBSSxDQUFDcUssb0JBQW9CO0FBQ2xHQyxRQUFBQSxRQUFRLEVBQUUsQ0FBQTtPQUNiLENBQUE7O0FBRUQ7QUFDQTtBQUNBLE1BQUEsTUFBTUMsT0FBTyxHQUFHO0FBQ1puSixRQUFBQSxPQUFPLEVBQUV1SSxJQUFJLEdBQUdBLElBQUksQ0FBQ1EsV0FBVyxDQUFDbkssSUFBSSxDQUFDb0ssVUFBVSxHQUFHLElBQUksQ0FBQzdJLFlBQVksQ0FBQ3ZCLElBQUksQ0FBQ3FLLG9CQUFvQjtBQUM5RkMsUUFBQUEsUUFBUSxFQUFFLENBQUE7T0FDYixDQUFBO0FBRUR2USxNQUFBQSxLQUFLLENBQUN1SixNQUFNLENBQUM0RyxPQUFPLENBQUM5SSxPQUFPLEtBQUssSUFBSSxJQUFJbUosT0FBTyxDQUFDbkosT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFBO01BQ2xFckwsY0FBYyxDQUFDeVUsb0JBQW9CLENBQUNOLE9BQU8sRUFBRUssT0FBTyxFQUFFVCxRQUFRLENBQUMsQ0FBQTtBQUNuRSxLQUFBO0FBRUEsSUFBQSxJQUFJaEwsS0FBSyxFQUFFO0FBRVA7TUFDQSxNQUFNMkwsUUFBUSxHQUFHZixNQUFNLEdBQUdBLE1BQU0sR0FBRyxJQUFJLENBQUNuSSxZQUFZLENBQUE7QUFDcEQsTUFBQSxNQUFNbUosYUFBYSxHQUFHRCxRQUFRLENBQUN6SyxJQUFJLENBQUMySyxZQUFZLENBQUE7QUFFaEQsTUFBQSxJQUFJakIsTUFBTSxDQUFDblEsT0FBTyxHQUFHLENBQUMsRUFBRTtBQUVwQjtRQUNBLE1BQU1xUixXQUFXLEdBQUdqQixJQUFJLENBQUNRLFdBQVcsQ0FBQ25LLElBQUksQ0FBQ29LLFVBQVUsQ0FBQTtRQUNwRCxJQUFJLENBQUMxVCxRQUFRLENBQUNtVSxZQUFZLENBQUM5VSxjQUFjLEVBQUUyVSxhQUFhLEVBQUVFLFdBQVcsQ0FBQyxDQUFBO0FBRTFFLE9BQUMsTUFBTTtBQUVIO0FBQ0EsUUFBQSxNQUFNQSxXQUFXLEdBQUdqQixJQUFJLEdBQUdBLElBQUksQ0FBQ21CLFdBQVcsQ0FBQzlLLElBQUksQ0FBQ29LLFVBQVUsR0FBRyxJQUFJLENBQUM3SSxZQUFZLENBQUN2QixJQUFJLENBQUMySyxZQUFZLENBQUE7O0FBRWpHO0FBQ0EsUUFBQSxNQUFNVCxPQUFPLEdBQUc7QUFDWjlJLFVBQUFBLE9BQU8sRUFBRXNKLGFBQWE7QUFDdEJKLFVBQUFBLFFBQVEsRUFBRSxDQUFBO1NBQ2IsQ0FBQTs7QUFFRDtBQUNBLFFBQUEsTUFBTUMsT0FBTyxHQUFHO0FBQ1puSixVQUFBQSxPQUFPLEVBQUV3SixXQUFXO0FBQ3BCTixVQUFBQSxRQUFRLEVBQUUsQ0FBQTtTQUNiLENBQUE7QUFFRHZRLFFBQUFBLEtBQUssQ0FBQ3VKLE1BQU0sQ0FBQzRHLE9BQU8sQ0FBQzlJLE9BQU8sS0FBSyxJQUFJLElBQUltSixPQUFPLENBQUNuSixPQUFPLEtBQUssSUFBSSxDQUFDLENBQUE7UUFDbEVyTCxjQUFjLENBQUN5VSxvQkFBb0IsQ0FBQ04sT0FBTyxFQUFFSyxPQUFPLEVBQUVULFFBQVEsQ0FBQyxDQUFBO0FBQ25FLE9BQUE7QUFDSixLQUFBO0FBRUFFLElBQUFBLGFBQWEsQ0FBQ2UsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBOztBQUVoQztBQUNBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2hWLGNBQWMsRUFBRTtBQUV0QjtBQUNBLE1BQUEsTUFBTTZSLEVBQUUsR0FBRzdSLGNBQWMsQ0FBQzhSLE1BQU0sRUFBRSxDQUFBO0FBQ2xDdkksTUFBQUEsV0FBVyxDQUFDQyxRQUFRLENBQUNxSSxFQUFFLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQTtBQUMxRCxNQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNGLEVBQUUsQ0FBQyxDQUFBO0FBQzdCLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUdBb0QsVUFBVUEsQ0FBQ3BNLElBQUksRUFBRTtBQUFBLElBQUEsSUFBQXFNLGlCQUFBLENBQUE7SUFDYixDQUFBQSxpQkFBQSxHQUFJLElBQUEsQ0FBQzdJLFdBQVcsS0FBQSxJQUFBLElBQWhCNkksaUJBQUEsQ0FBa0JDLGNBQWMsQ0FBQ3RNLElBQUksQ0FBQyxDQUFBO0FBQzFDLEdBQUE7QUFFQXVNLEVBQUFBLFNBQVNBLEdBQUc7QUFBQSxJQUFBLElBQUFDLGtCQUFBLENBQUE7SUFDUixDQUFBQSxrQkFBQSxPQUFJLENBQUNoSixXQUFXLGFBQWhCZ0osa0JBQUEsQ0FBa0JDLGFBQWEsRUFBRSxDQUFBO0FBQ3JDLEdBQUE7QUFFSjs7OzsifQ==
