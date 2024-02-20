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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgU0hBREVSTEFOR1VBR0VfV0dTTCB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNoYWRlclByb2Nlc3NvciB9IGZyb20gJy4uL3NoYWRlci1wcm9jZXNzb3IuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RGVidWcgfSBmcm9tICcuL3dlYmdwdS1kZWJ1Zy5qcyc7XG5cbi8qKlxuICogQSBXZWJHUFUgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNoYWRlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdwdVNoYWRlciB7XG4gICAgLyoqXG4gICAgICogVHJhbnNwaWxlZCB2ZXJ0ZXggc2hhZGVyIGNvZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgX3ZlcnRleENvZGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVHJhbnNwaWxlZCBmcmFnbWVudCBzaGFkZXIgY29kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBfZnJhZ21lbnRDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENvbXB1dGUgc2hhZGVyIGNvZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgX2NvbXB1dGVDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIE5hbWUgb2YgdGhlIHZlcnRleCBlbnRyeSBwb2ludCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICB2ZXJ0ZXhFbnRyeVBvaW50ID0gJ21haW4nO1xuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgZnJhZ21lbnQgZW50cnkgcG9pbnQgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnJhZ21lbnRFbnRyeVBvaW50ID0gJ21haW4nO1xuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgY29tcHV0ZSBlbnRyeSBwb2ludCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBjb21wdXRlRW50cnlQb2ludCA9ICdtYWluJztcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc2hhZGVyKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9ICovXG4gICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb24gPSBzaGFkZXIuZGVmaW5pdGlvbjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlZmluaXRpb24pO1xuXG4gICAgICAgIGlmIChkZWZpbml0aW9uLnNoYWRlckxhbmd1YWdlID09PSBTSEFERVJMQU5HVUFHRV9XR1NMKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX3ZlcnRleENvZGUgPSBkZWZpbml0aW9uLnZzaGFkZXIgPz8gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2ZyYWdtZW50Q29kZSA9IGRlZmluaXRpb24uZnNoYWRlciA/PyBudWxsO1xuICAgICAgICAgICAgdGhpcy5fY29tcHV0ZUNvZGUgPSBkZWZpbml0aW9uLmNzaGFkZXIgPz8gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudmVydGV4RW50cnlQb2ludCA9ICd2ZXJ0ZXhNYWluJztcbiAgICAgICAgICAgIHRoaXMuZnJhZ21lbnRFbnRyeVBvaW50ID0gJ2ZyYWdtZW50TWFpbic7XG4gICAgICAgICAgICBzaGFkZXIucmVhZHkgPSB0cnVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGlmIChkZWZpbml0aW9uLnByb2Nlc3NpbmdPcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRoZSBXZWJHUFUgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCBhIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gZnJlZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KHNoYWRlcikge1xuICAgICAgICB0aGlzLl92ZXJ0ZXhDb2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZnJhZ21lbnRDb2RlID0gbnVsbDtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJNb2R1bGUoY29kZSwgc2hhZGVyVHlwZSkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnNoYWRlci5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZShkZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IHNoYWRlck1vZHVsZSA9IHdncHUuY3JlYXRlU2hhZGVyTW9kdWxlKHtcbiAgICAgICAgICAgIGNvZGU6IGNvZGVcbiAgICAgICAgfSk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHNoYWRlck1vZHVsZSwgYCR7c2hhZGVyVHlwZX06JHt0aGlzLnNoYWRlci5sYWJlbH1gKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7XG4gICAgICAgICAgICBzaGFkZXJUeXBlLFxuICAgICAgICAgICAgc291cmNlOiBjb2RlLFxuICAgICAgICAgICAgc2hhZGVyOiB0aGlzLnNoYWRlclxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gc2hhZGVyTW9kdWxlO1xuICAgIH1cblxuICAgIGdldFZlcnRleFNoYWRlck1vZHVsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlU2hhZGVyTW9kdWxlKHRoaXMuX3ZlcnRleENvZGUsICdWZXJ0ZXgnKTtcbiAgICB9XG5cbiAgICBnZXRGcmFnbWVudFNoYWRlck1vZHVsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlU2hhZGVyTW9kdWxlKHRoaXMuX2ZyYWdtZW50Q29kZSwgJ0ZyYWdtZW50Jyk7XG4gICAgfVxuXG4gICAgZ2V0Q29tcHV0ZVNoYWRlck1vZHVsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlU2hhZGVyTW9kdWxlKHRoaXMuX2NvbXB1dGVDb2RlLCAnQ29tcHV0ZScpO1xuICAgIH1cblxuICAgIHByb2Nlc3MoKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuc2hhZGVyO1xuXG4gICAgICAgIC8vIHByb2Nlc3MgdGhlIHNoYWRlciBzb3VyY2UgdG8gYWxsb3cgZm9yIHVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZCA9IFNoYWRlclByb2Nlc3Nvci5ydW4oc2hhZGVyLmRldmljZSwgc2hhZGVyLmRlZmluaXRpb24sIHNoYWRlcik7XG5cbiAgICAgICAgLy8ga2VlcCByZWZlcmVuY2UgdG8gcHJvY2Vzc2VkIHNoYWRlcnMgaW4gZGVidWcgbW9kZVxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc2VkID0gcHJvY2Vzc2VkO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl92ZXJ0ZXhDb2RlID0gdGhpcy50cmFuc3BpbGUocHJvY2Vzc2VkLnZzaGFkZXIsICd2ZXJ0ZXgnLCBzaGFkZXIuZGVmaW5pdGlvbi52c2hhZGVyKTtcbiAgICAgICAgdGhpcy5fZnJhZ21lbnRDb2RlID0gdGhpcy50cmFuc3BpbGUocHJvY2Vzc2VkLmZzaGFkZXIsICdmcmFnbWVudCcsIHNoYWRlci5kZWZpbml0aW9uLmZzaGFkZXIpO1xuXG4gICAgICAgIGlmICghKHRoaXMuX3ZlcnRleENvZGUgJiYgdGhpcy5fZnJhZ21lbnRDb2RlKSkge1xuICAgICAgICAgICAgc2hhZGVyLmZhaWxlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaGFkZXIucmVhZHkgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZGVyLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0ID0gcHJvY2Vzc2VkLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0O1xuICAgICAgICBzaGFkZXIubWVzaEJpbmRHcm91cEZvcm1hdCA9IHByb2Nlc3NlZC5tZXNoQmluZEdyb3VwRm9ybWF0O1xuICAgIH1cblxuICAgIHRyYW5zcGlsZShzcmMsIHNoYWRlclR5cGUsIG9yaWdpbmFsU3JjKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzcGlydiA9IHRoaXMuc2hhZGVyLmRldmljZS5nbHNsYW5nLmNvbXBpbGVHTFNMKHNyYywgc2hhZGVyVHlwZSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaGFkZXIuZGV2aWNlLnR3Z3NsLmNvbnZlcnRTcGlyVjJXR1NMKHNwaXJ2KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdHJhbnNwaWxlIHdlYmdsICR7c2hhZGVyVHlwZX0gc2hhZGVyIFske3RoaXMuc2hhZGVyLmxhYmVsfV0gdG8gV2ViR1BVOiBbJHtlcnIubWVzc2FnZX1dYCwge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NlZDogc3JjLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiBvcmlnaW5hbFNyYyxcbiAgICAgICAgICAgICAgICBzaGFkZXI6IHRoaXMuc2hhZGVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2ZXJ0ZXhDb2RlKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5fdmVydGV4Q29kZSk7XG4gICAgICAgIHJldHVybiB0aGlzLl92ZXJ0ZXhDb2RlO1xuICAgIH1cblxuICAgIGdldCBmcmFnbWVudENvZGUoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9mcmFnbWVudENvZGUpO1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJhZ21lbnRDb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpc3Bvc2UgdGhlIHNoYWRlciB3aGVuIHRoZSBjb250ZXh0IGhhcyBiZWVuIGxvc3QuXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdG9yZSBzaGFkZXIgYWZ0ZXIgdGhlIGNvbnRleHQgaGFzIGJlZW4gb2J0YWluZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byByZXN0b3JlLlxuICAgICAqL1xuICAgIHJlc3RvcmVDb250ZXh0KGRldmljZSwgc2hhZGVyKSB7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVTaGFkZXIgfTtcbiJdLCJuYW1lcyI6WyJXZWJncHVTaGFkZXIiLCJjb25zdHJ1Y3RvciIsInNoYWRlciIsIl92ZXJ0ZXhDb2RlIiwiX2ZyYWdtZW50Q29kZSIsIl9jb21wdXRlQ29kZSIsInZlcnRleEVudHJ5UG9pbnQiLCJmcmFnbWVudEVudHJ5UG9pbnQiLCJjb21wdXRlRW50cnlQb2ludCIsImRlZmluaXRpb24iLCJEZWJ1ZyIsImFzc2VydCIsInNoYWRlckxhbmd1YWdlIiwiU0hBREVSTEFOR1VBR0VfV0dTTCIsIl9kZWZpbml0aW9uJHZzaGFkZXIiLCJfZGVmaW5pdGlvbiRmc2hhZGVyIiwiX2RlZmluaXRpb24kY3NoYWRlciIsInZzaGFkZXIiLCJmc2hhZGVyIiwiY3NoYWRlciIsInJlYWR5IiwicHJvY2Vzc2luZ09wdGlvbnMiLCJwcm9jZXNzIiwiZGVzdHJveSIsImNyZWF0ZVNoYWRlck1vZHVsZSIsImNvZGUiLCJzaGFkZXJUeXBlIiwiZGV2aWNlIiwid2dwdSIsIldlYmdwdURlYnVnIiwidmFsaWRhdGUiLCJzaGFkZXJNb2R1bGUiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwibGFiZWwiLCJlbmQiLCJzb3VyY2UiLCJnZXRWZXJ0ZXhTaGFkZXJNb2R1bGUiLCJnZXRGcmFnbWVudFNoYWRlck1vZHVsZSIsImdldENvbXB1dGVTaGFkZXJNb2R1bGUiLCJwcm9jZXNzZWQiLCJTaGFkZXJQcm9jZXNzb3IiLCJydW4iLCJjYWxsIiwidHJhbnNwaWxlIiwiZmFpbGVkIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0Iiwic3JjIiwib3JpZ2luYWxTcmMiLCJzcGlydiIsImdsc2xhbmciLCJjb21waWxlR0xTTCIsInR3Z3NsIiwiY29udmVydFNwaXJWMldHU0wiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJtZXNzYWdlIiwib3JpZ2luYWwiLCJ2ZXJ0ZXhDb2RlIiwiZnJhZ21lbnRDb2RlIiwibG9zZUNvbnRleHQiLCJyZXN0b3JlQ29udGV4dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0FBcUNmO0FBQ0o7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUU7QUF2Q3BCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBRWxCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBRXBCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5C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
