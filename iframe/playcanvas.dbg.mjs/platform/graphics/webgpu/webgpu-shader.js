import { Debug, DebugHelper } from '../../../core/debug.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { ShaderProcessor } from '../shader-processor.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * A WebGPU implementation of the Shader.
 *
 * @ignore
 */
class WebgpuShader {
  /**
   * @param {import('../shader.js').Shader} shader - The shader.
   */
  constructor(shader) {
    /**
     * Transpiled vertex shader code.
     *
     * @type {string|null}
     */
    this._vertexCode = null;
    /**
     * Transpiled fragment shader code.
     *
     * @type {string|null}
     */
    this._fragmentCode = null;
    /**
     * Compute shader code.
     *
     * @type {string|null}
     */
    this._computeCode = null;
    /**
     * Name of the vertex entry point function.
     */
    this.vertexEntryPoint = 'main';
    /**
     * Name of the fragment entry point function.
     */
    this.fragmentEntryPoint = 'main';
    /**
     * Name of the compute entry point function.
     */
    this.computeEntryPoint = 'main';
    /** @type {import('../shader.js').Shader} */
    this.shader = shader;
    const definition = shader.definition;
    Debug.assert(definition);
    if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
      var _definition$vshader, _definition$fshader, _definition$cshader;
      this._vertexCode = (_definition$vshader = definition.vshader) != null ? _definition$vshader : null;
      this._fragmentCode = (_definition$fshader = definition.fshader) != null ? _definition$fshader : null;
      this._computeCode = (_definition$cshader = definition.cshader) != null ? _definition$cshader : null;
      this.meshUniformBufferFormat = definition.meshUniformBufferFormat;
      this.meshBindGroupFormat = definition.meshBindGroupFormat;
      this.vertexEntryPoint = 'vertexMain';
      this.fragmentEntryPoint = 'fragmentMain';
      shader.ready = true;
    } else {
      if (definition.processingOptions) {
        this.process();
      }
    }
  }

  /**
   * Free the WebGPU resources associated with a shader.
   *
   * @param {import('../shader.js').Shader} shader - The shader to free.
   */
  destroy(shader) {
    this._vertexCode = null;
    this._fragmentCode = null;
  }
  createShaderModule(code, shaderType) {
    const device = this.shader.device;
    const wgpu = device.wgpu;
    WebgpuDebug.validate(device);
    const shaderModule = wgpu.createShaderModule({
      code: code
    });
    DebugHelper.setLabel(shaderModule, `${shaderType}:${this.shader.label}`);
    WebgpuDebug.end(device, {
      shaderType,
      source: code,
      shader: this.shader
    });
    return shaderModule;
  }
  getVertexShaderModule() {
    return this.createShaderModule(this._vertexCode, 'Vertex');
  }
  getFragmentShaderModule() {
    return this.createShaderModule(this._fragmentCode, 'Fragment');
  }
  getComputeShaderModule() {
    return this.createShaderModule(this._computeCode, 'Compute');
  }
  process() {
    const shader = this.shader;

    // process the shader source to allow for uniforms
    const processed = ShaderProcessor.run(shader.device, shader.definition, shader);

    // keep reference to processed shaders in debug mode
    Debug.call(() => {
      this.processed = processed;
    });
    this._vertexCode = this.transpile(processed.vshader, 'vertex', shader.definition.vshader);
    this._fragmentCode = this.transpile(processed.fshader, 'fragment', shader.definition.fshader);
    if (!(this._vertexCode && this._fragmentCode)) {
      shader.failed = true;
    } else {
      shader.ready = true;
    }
    shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
    shader.meshBindGroupFormat = processed.meshBindGroupFormat;
  }
  transpile(src, shaderType, originalSrc) {
    try {
      const spirv = this.shader.device.glslang.compileGLSL(src, shaderType);
      return this.shader.device.twgsl.convertSpirV2WGSL(spirv);
    } catch (err) {
      console.error(`Failed to transpile webgl ${shaderType} shader [${this.shader.label}] to WebGPU: [${err.message}]`, {
        processed: src,
        original: originalSrc,
        shader: this.shader
      });
    }
  }
  get vertexCode() {
    Debug.assert(this._vertexCode);
    return this._vertexCode;
  }
  get fragmentCode() {
    Debug.assert(this._fragmentCode);
    return this._fragmentCode;
  }

  /**
   * Dispose the shader when the context has been lost.
   */
  loseContext() {}

  /**
   * Restore shader after the context has been obtained.
   *
   * @param {import('../graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to restore.
   */
  restoreContext(device, shader) {}
}

export { WebgpuShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgU0hBREVSTEFOR1VBR0VfV0dTTCB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNoYWRlclByb2Nlc3NvciB9IGZyb20gJy4uL3NoYWRlci1wcm9jZXNzb3IuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RGVidWcgfSBmcm9tICcuL3dlYmdwdS1kZWJ1Zy5qcyc7XG5cbi8qKlxuICogQSBXZWJHUFUgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNoYWRlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdwdVNoYWRlciB7XG4gICAgLyoqXG4gICAgICogVHJhbnNwaWxlZCB2ZXJ0ZXggc2hhZGVyIGNvZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgX3ZlcnRleENvZGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVHJhbnNwaWxlZCBmcmFnbWVudCBzaGFkZXIgY29kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBfZnJhZ21lbnRDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENvbXB1dGUgc2hhZGVyIGNvZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgX2NvbXB1dGVDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIE5hbWUgb2YgdGhlIHZlcnRleCBlbnRyeSBwb2ludCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICB2ZXJ0ZXhFbnRyeVBvaW50ID0gJ21haW4nO1xuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgZnJhZ21lbnQgZW50cnkgcG9pbnQgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnJhZ21lbnRFbnRyeVBvaW50ID0gJ21haW4nO1xuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgY29tcHV0ZSBlbnRyeSBwb2ludCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBjb21wdXRlRW50cnlQb2ludCA9ICdtYWluJztcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc2hhZGVyKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9ICovXG4gICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb24gPSBzaGFkZXIuZGVmaW5pdGlvbjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlZmluaXRpb24pO1xuXG4gICAgICAgIGlmIChkZWZpbml0aW9uLnNoYWRlckxhbmd1YWdlID09PSBTSEFERVJMQU5HVUFHRV9XR1NMKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX3ZlcnRleENvZGUgPSBkZWZpbml0aW9uLnZzaGFkZXIgPz8gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2ZyYWdtZW50Q29kZSA9IGRlZmluaXRpb24uZnNoYWRlciA/PyBudWxsO1xuICAgICAgICAgICAgdGhpcy5fY29tcHV0ZUNvZGUgPSBkZWZpbml0aW9uLmNzaGFkZXIgPz8gbnVsbDtcbiAgICAgICAgICAgIHRoaXMubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQgPSBkZWZpbml0aW9uLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0O1xuICAgICAgICAgICAgdGhpcy5tZXNoQmluZEdyb3VwRm9ybWF0ID0gZGVmaW5pdGlvbi5tZXNoQmluZEdyb3VwRm9ybWF0O1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhFbnRyeVBvaW50ID0gJ3ZlcnRleE1haW4nO1xuICAgICAgICAgICAgdGhpcy5mcmFnbWVudEVudHJ5UG9pbnQgPSAnZnJhZ21lbnRNYWluJztcbiAgICAgICAgICAgIHNoYWRlci5yZWFkeSA9IHRydWU7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgaWYgKGRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3MoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWUgdGhlIFdlYkdQVSByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBmcmVlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuX3ZlcnRleENvZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9mcmFnbWVudENvZGUgPSBudWxsO1xuICAgIH1cblxuICAgIGNyZWF0ZVNoYWRlck1vZHVsZShjb2RlLCBzaGFkZXJUeXBlKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc2hhZGVyLmRldmljZTtcbiAgICAgICAgY29uc3Qgd2dwdSA9IGRldmljZS53Z3B1O1xuXG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKGRldmljZSk7XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyTW9kdWxlID0gd2dwdS5jcmVhdGVTaGFkZXJNb2R1bGUoe1xuICAgICAgICAgICAgY29kZTogY29kZVxuICAgICAgICB9KTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoc2hhZGVyTW9kdWxlLCBgJHtzaGFkZXJUeXBlfToke3RoaXMuc2hhZGVyLmxhYmVsfWApO1xuXG4gICAgICAgIFdlYmdwdURlYnVnLmVuZChkZXZpY2UsIHtcbiAgICAgICAgICAgIHNoYWRlclR5cGUsXG4gICAgICAgICAgICBzb3VyY2U6IGNvZGUsXG4gICAgICAgICAgICBzaGFkZXI6IHRoaXMuc2hhZGVyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBzaGFkZXJNb2R1bGU7XG4gICAgfVxuXG4gICAgZ2V0VmVydGV4U2hhZGVyTW9kdWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVTaGFkZXJNb2R1bGUodGhpcy5fdmVydGV4Q29kZSwgJ1ZlcnRleCcpO1xuICAgIH1cblxuICAgIGdldEZyYWdtZW50U2hhZGVyTW9kdWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVTaGFkZXJNb2R1bGUodGhpcy5fZnJhZ21lbnRDb2RlLCAnRnJhZ21lbnQnKTtcbiAgICB9XG5cbiAgICBnZXRDb21wdXRlU2hhZGVyTW9kdWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVTaGFkZXJNb2R1bGUodGhpcy5fY29tcHV0ZUNvZGUsICdDb21wdXRlJyk7XG4gICAgfVxuXG4gICAgcHJvY2VzcygpIHtcbiAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5zaGFkZXI7XG5cbiAgICAgICAgLy8gcHJvY2VzcyB0aGUgc2hhZGVyIHNvdXJjZSB0byBhbGxvdyBmb3IgdW5pZm9ybXNcbiAgICAgICAgY29uc3QgcHJvY2Vzc2VkID0gU2hhZGVyUHJvY2Vzc29yLnJ1bihzaGFkZXIuZGV2aWNlLCBzaGFkZXIuZGVmaW5pdGlvbiwgc2hhZGVyKTtcblxuICAgICAgICAvLyBrZWVwIHJlZmVyZW5jZSB0byBwcm9jZXNzZWQgc2hhZGVycyBpbiBkZWJ1ZyBtb2RlXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzZWQgPSBwcm9jZXNzZWQ7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3ZlcnRleENvZGUgPSB0aGlzLnRyYW5zcGlsZShwcm9jZXNzZWQudnNoYWRlciwgJ3ZlcnRleCcsIHNoYWRlci5kZWZpbml0aW9uLnZzaGFkZXIpO1xuICAgICAgICB0aGlzLl9mcmFnbWVudENvZGUgPSB0aGlzLnRyYW5zcGlsZShwcm9jZXNzZWQuZnNoYWRlciwgJ2ZyYWdtZW50Jywgc2hhZGVyLmRlZmluaXRpb24uZnNoYWRlcik7XG5cbiAgICAgICAgaWYgKCEodGhpcy5fdmVydGV4Q29kZSAmJiB0aGlzLl9mcmFnbWVudENvZGUpKSB7XG4gICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNoYWRlci5yZWFkeSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkZXIubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQgPSBwcm9jZXNzZWQubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQ7XG4gICAgICAgIHNoYWRlci5tZXNoQmluZEdyb3VwRm9ybWF0ID0gcHJvY2Vzc2VkLm1lc2hCaW5kR3JvdXBGb3JtYXQ7XG4gICAgfVxuXG4gICAgdHJhbnNwaWxlKHNyYywgc2hhZGVyVHlwZSwgb3JpZ2luYWxTcmMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwaXJ2ID0gdGhpcy5zaGFkZXIuZGV2aWNlLmdsc2xhbmcuY29tcGlsZUdMU0woc3JjLCBzaGFkZXJUeXBlKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNoYWRlci5kZXZpY2UudHdnc2wuY29udmVydFNwaXJWMldHU0woc3BpcnYpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB0cmFuc3BpbGUgd2ViZ2wgJHtzaGFkZXJUeXBlfSBzaGFkZXIgWyR7dGhpcy5zaGFkZXIubGFiZWx9XSB0byBXZWJHUFU6IFske2Vyci5tZXNzYWdlfV1gLCB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc2VkOiBzcmMsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWw6IG9yaWdpbmFsU3JjLFxuICAgICAgICAgICAgICAgIHNoYWRlcjogdGhpcy5zaGFkZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHZlcnRleENvZGUoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl92ZXJ0ZXhDb2RlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZlcnRleENvZGU7XG4gICAgfVxuXG4gICAgZ2V0IGZyYWdtZW50Q29kZSgpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX2ZyYWdtZW50Q29kZSk7XG4gICAgICAgIHJldHVybiB0aGlzLl9mcmFnbWVudENvZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGlzcG9zZSB0aGUgc2hhZGVyIHdoZW4gdGhlIGNvbnRleHQgaGFzIGJlZW4gbG9zdC5cbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIHNoYWRlciBhZnRlciB0aGUgY29udGV4dCBoYXMgYmVlbiBvYnRhaW5lZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIHJlc3RvcmUuXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoZGV2aWNlLCBzaGFkZXIpIHtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdwdVNoYWRlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdVNoYWRlciIsImNvbnN0cnVjdG9yIiwic2hhZGVyIiwiX3ZlcnRleENvZGUiLCJfZnJhZ21lbnRDb2RlIiwiX2NvbXB1dGVDb2RlIiwidmVydGV4RW50cnlQb2ludCIsImZyYWdtZW50RW50cnlQb2ludCIsImNvbXB1dGVFbnRyeVBvaW50IiwiZGVmaW5pdGlvbiIsIkRlYnVnIiwiYXNzZXJ0Iiwic2hhZGVyTGFuZ3VhZ2UiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwiX2RlZmluaXRpb24kdnNoYWRlciIsIl9kZWZpbml0aW9uJGZzaGFkZXIiLCJfZGVmaW5pdGlvbiRjc2hhZGVyIiwidnNoYWRlciIsImZzaGFkZXIiLCJjc2hhZGVyIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwicmVhZHkiLCJwcm9jZXNzaW5nT3B0aW9ucyIsInByb2Nlc3MiLCJkZXN0cm95IiwiY3JlYXRlU2hhZGVyTW9kdWxlIiwiY29kZSIsInNoYWRlclR5cGUiLCJkZXZpY2UiLCJ3Z3B1IiwiV2ViZ3B1RGVidWciLCJ2YWxpZGF0ZSIsInNoYWRlck1vZHVsZSIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJsYWJlbCIsImVuZCIsInNvdXJjZSIsImdldFZlcnRleFNoYWRlck1vZHVsZSIsImdldEZyYWdtZW50U2hhZGVyTW9kdWxlIiwiZ2V0Q29tcHV0ZVNoYWRlck1vZHVsZSIsInByb2Nlc3NlZCIsIlNoYWRlclByb2Nlc3NvciIsInJ1biIsImNhbGwiLCJ0cmFuc3BpbGUiLCJmYWlsZWQiLCJzcmMiLCJvcmlnaW5hbFNyYyIsInNwaXJ2IiwiZ2xzbGFuZyIsImNvbXBpbGVHTFNMIiwidHdnc2wiLCJjb252ZXJ0U3BpclYyV0dTTCIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsIm1lc3NhZ2UiLCJvcmlnaW5hbCIsInZlcnRleENvZGUiLCJmcmFnbWVudENvZGUiLCJsb3NlQ29udGV4dCIsInJlc3RvcmVDb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7OztBQU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxZQUFZLENBQUM7QUFxQ2Y7QUFDSjtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE1BQU0sRUFBRTtBQXZDcEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFdBQVcsR0FBRyxJQUFJLENBQUE7QUFFbEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFFcEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7QUFFbkI7QUFDSjtBQUNBO0lBRkksSUFHQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsTUFBTSxDQUFBO0FBRXpCO0FBQ0o7QUFDQTtJQUZJLElBR0FDLENBQUFBLGtCQUFrQixHQUFHLE1BQU0sQ0FBQTtBQUUzQjtBQUNKO0FBQ0E7SUFGSSxJQUdBQyxDQUFBQSxpQkFBaUIsR0FBRyxNQUFNLENBQUE7QUFNdEI7SUFDQSxJQUFJLENBQUNOLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBRXBCLElBQUEsTUFBTU8sVUFBVSxHQUFHUCxNQUFNLENBQUNPLFVBQVUsQ0FBQTtBQUNwQ0MsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUNGLFVBQVUsQ0FBQyxDQUFBO0FBRXhCLElBQUEsSUFBSUEsVUFBVSxDQUFDRyxjQUFjLEtBQUtDLG1CQUFtQixFQUFFO0FBQUEsTUFBQSxJQUFBQyxtQkFBQSxFQUFBQyxtQkFBQSxFQUFBQyxtQkFBQSxDQUFBO01BRW5ELElBQUksQ0FBQ2IsV0FBVyxHQUFBLENBQUFXLG1CQUFBLEdBQUdMLFVBQVUsQ0FBQ1EsT0FBTyxLQUFBLElBQUEsR0FBQUgsbUJBQUEsR0FBSSxJQUFJLENBQUE7TUFDN0MsSUFBSSxDQUFDVixhQUFhLEdBQUEsQ0FBQVcsbUJBQUEsR0FBR04sVUFBVSxDQUFDUyxPQUFPLEtBQUEsSUFBQSxHQUFBSCxtQkFBQSxHQUFJLElBQUksQ0FBQTtNQUMvQyxJQUFJLENBQUNWLFlBQVksR0FBQSxDQUFBVyxtQkFBQSxHQUFHUCxVQUFVLENBQUNVLE9BQU8sS0FBQSxJQUFBLEdBQUFILG1CQUFBLEdBQUksSUFBSSxDQUFBO0FBQzlDLE1BQUEsSUFBSSxDQUFDSSx1QkFBdUIsR0FBR1gsVUFBVSxDQUFDVyx1QkFBdUIsQ0FBQTtBQUNqRSxNQUFBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUdaLFVBQVUsQ0FBQ1ksbUJBQW1CLENBQUE7TUFDekQsSUFBSSxDQUFDZixnQkFBZ0IsR0FBRyxZQUFZLENBQUE7TUFDcEMsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxjQUFjLENBQUE7TUFDeENMLE1BQU0sQ0FBQ29CLEtBQUssR0FBRyxJQUFJLENBQUE7QUFFdkIsS0FBQyxNQUFNO01BRUgsSUFBSWIsVUFBVSxDQUFDYyxpQkFBaUIsRUFBRTtRQUM5QixJQUFJLENBQUNDLE9BQU8sRUFBRSxDQUFBO0FBQ2xCLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLE9BQU9BLENBQUN2QixNQUFNLEVBQUU7SUFDWixJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7QUFFQXNCLEVBQUFBLGtCQUFrQkEsQ0FBQ0MsSUFBSSxFQUFFQyxVQUFVLEVBQUU7QUFDakMsSUFBQSxNQUFNQyxNQUFNLEdBQUcsSUFBSSxDQUFDM0IsTUFBTSxDQUFDMkIsTUFBTSxDQUFBO0FBQ2pDLElBQUEsTUFBTUMsSUFBSSxHQUFHRCxNQUFNLENBQUNDLElBQUksQ0FBQTtBQUV4QkMsSUFBQUEsV0FBVyxDQUFDQyxRQUFRLENBQUNILE1BQU0sQ0FBQyxDQUFBO0FBRTVCLElBQUEsTUFBTUksWUFBWSxHQUFHSCxJQUFJLENBQUNKLGtCQUFrQixDQUFDO0FBQ3pDQyxNQUFBQSxJQUFJLEVBQUVBLElBQUFBO0FBQ1YsS0FBQyxDQUFDLENBQUE7QUFDRk8sSUFBQUEsV0FBVyxDQUFDQyxRQUFRLENBQUNGLFlBQVksRUFBRyxDQUFFTCxFQUFBQSxVQUFXLENBQUcsQ0FBQSxFQUFBLElBQUksQ0FBQzFCLE1BQU0sQ0FBQ2tDLEtBQU0sRUFBQyxDQUFDLENBQUE7QUFFeEVMLElBQUFBLFdBQVcsQ0FBQ00sR0FBRyxDQUFDUixNQUFNLEVBQUU7TUFDcEJELFVBQVU7QUFDVlUsTUFBQUEsTUFBTSxFQUFFWCxJQUFJO01BQ1p6QixNQUFNLEVBQUUsSUFBSSxDQUFDQSxNQUFBQTtBQUNqQixLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsT0FBTytCLFlBQVksQ0FBQTtBQUN2QixHQUFBO0FBRUFNLEVBQUFBLHFCQUFxQkEsR0FBRztJQUNwQixPQUFPLElBQUksQ0FBQ2Isa0JBQWtCLENBQUMsSUFBSSxDQUFDdkIsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFBO0FBQzlELEdBQUE7QUFFQXFDLEVBQUFBLHVCQUF1QkEsR0FBRztJQUN0QixPQUFPLElBQUksQ0FBQ2Qsa0JBQWtCLENBQUMsSUFBSSxDQUFDdEIsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFBO0FBQ2xFLEdBQUE7QUFFQXFDLEVBQUFBLHNCQUFzQkEsR0FBRztJQUNyQixPQUFPLElBQUksQ0FBQ2Ysa0JBQWtCLENBQUMsSUFBSSxDQUFDckIsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFBO0FBQ2hFLEdBQUE7QUFFQW1CLEVBQUFBLE9BQU9BLEdBQUc7QUFDTixJQUFBLE1BQU10QixNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7O0FBRTFCO0FBQ0EsSUFBQSxNQUFNd0MsU0FBUyxHQUFHQyxlQUFlLENBQUNDLEdBQUcsQ0FBQzFDLE1BQU0sQ0FBQzJCLE1BQU0sRUFBRTNCLE1BQU0sQ0FBQ08sVUFBVSxFQUFFUCxNQUFNLENBQUMsQ0FBQTs7QUFFL0U7SUFDQVEsS0FBSyxDQUFDbUMsSUFBSSxDQUFDLE1BQU07TUFDYixJQUFJLENBQUNILFNBQVMsR0FBR0EsU0FBUyxDQUFBO0FBQzlCLEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxJQUFJLENBQUN2QyxXQUFXLEdBQUcsSUFBSSxDQUFDMkMsU0FBUyxDQUFDSixTQUFTLENBQUN6QixPQUFPLEVBQUUsUUFBUSxFQUFFZixNQUFNLENBQUNPLFVBQVUsQ0FBQ1EsT0FBTyxDQUFDLENBQUE7QUFDekYsSUFBQSxJQUFJLENBQUNiLGFBQWEsR0FBRyxJQUFJLENBQUMwQyxTQUFTLENBQUNKLFNBQVMsQ0FBQ3hCLE9BQU8sRUFBRSxVQUFVLEVBQUVoQixNQUFNLENBQUNPLFVBQVUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7SUFFN0YsSUFBSSxFQUFFLElBQUksQ0FBQ2YsV0FBVyxJQUFJLElBQUksQ0FBQ0MsYUFBYSxDQUFDLEVBQUU7TUFDM0NGLE1BQU0sQ0FBQzZDLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQyxNQUFNO01BQ0g3QyxNQUFNLENBQUNvQixLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEtBQUE7QUFFQXBCLElBQUFBLE1BQU0sQ0FBQ2tCLHVCQUF1QixHQUFHc0IsU0FBUyxDQUFDdEIsdUJBQXVCLENBQUE7QUFDbEVsQixJQUFBQSxNQUFNLENBQUNtQixtQkFBbUIsR0FBR3FCLFNBQVMsQ0FBQ3JCLG1CQUFtQixDQUFBO0FBQzlELEdBQUE7QUFFQXlCLEVBQUFBLFNBQVNBLENBQUNFLEdBQUcsRUFBRXBCLFVBQVUsRUFBRXFCLFdBQVcsRUFBRTtJQUNwQyxJQUFJO0FBQ0EsTUFBQSxNQUFNQyxLQUFLLEdBQUcsSUFBSSxDQUFDaEQsTUFBTSxDQUFDMkIsTUFBTSxDQUFDc0IsT0FBTyxDQUFDQyxXQUFXLENBQUNKLEdBQUcsRUFBRXBCLFVBQVUsQ0FBQyxDQUFBO01BQ3JFLE9BQU8sSUFBSSxDQUFDMUIsTUFBTSxDQUFDMkIsTUFBTSxDQUFDd0IsS0FBSyxDQUFDQyxpQkFBaUIsQ0FBQ0osS0FBSyxDQUFDLENBQUE7S0FDM0QsQ0FBQyxPQUFPSyxHQUFHLEVBQUU7QUFDVkMsTUFBQUEsT0FBTyxDQUFDQyxLQUFLLENBQUUsQ0FBNEI3QiwwQkFBQUEsRUFBQUEsVUFBVyxZQUFXLElBQUksQ0FBQzFCLE1BQU0sQ0FBQ2tDLEtBQU0sQ0FBZ0JtQixjQUFBQSxFQUFBQSxHQUFHLENBQUNHLE9BQVEsR0FBRSxFQUFFO0FBQy9HaEIsUUFBQUEsU0FBUyxFQUFFTSxHQUFHO0FBQ2RXLFFBQUFBLFFBQVEsRUFBRVYsV0FBVztRQUNyQi9DLE1BQU0sRUFBRSxJQUFJLENBQUNBLE1BQUFBO0FBQ2pCLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJMEQsVUFBVUEsR0FBRztBQUNibEQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDUixXQUFXLENBQUMsQ0FBQTtJQUM5QixPQUFPLElBQUksQ0FBQ0EsV0FBVyxDQUFBO0FBQzNCLEdBQUE7RUFFQSxJQUFJMEQsWUFBWUEsR0FBRztBQUNmbkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDUCxhQUFhLENBQUMsQ0FBQTtJQUNoQyxPQUFPLElBQUksQ0FBQ0EsYUFBYSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0VBQ0kwRCxXQUFXQSxHQUFHLEVBQ2Q7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLGNBQWNBLENBQUNsQyxNQUFNLEVBQUUzQixNQUFNLEVBQUUsRUFDL0I7QUFDSjs7OzsifQ==