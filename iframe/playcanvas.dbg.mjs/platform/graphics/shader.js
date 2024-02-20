import { TRACEID_SHADER_ALLOC } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { platform } from '../../core/platform.js';
import { Preprocessor } from '../../core/preprocessor.js';
import { DebugGraphics } from './debug-graphics.js';

let id = 0;

/**
 * A shader is a program that is responsible for rendering graphical primitives on a device's
 * graphics processor. The shader is generated from a shader definition. This shader definition
 * specifies the code for processing vertices and fragments processed by the GPU. The language of
 * the code is GLSL (or more specifically ESSL, the OpenGL ES Shading Language). The shader
 * definition also describes how the PlayCanvas engine should map vertex buffer elements onto the
 * attributes specified in the vertex shader code.
 *
 * @category Graphics
 */
class Shader {
  /**
   * Creates a new Shader instance.
   *
   * Consider {@link createShaderFromCode} as a simpler and more powerful way to create
   * a shader.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this shader.
   * @param {object} definition - The shader definition from which to build the shader.
   * @param {string} [definition.name] - The name of the shader.
   * @param {Object<string, string>} [definition.attributes] - Object detailing the mapping of
   * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
   * vertex buffer data as inputs to the shader. When not specified, rendering without
   * vertex buffer is assumed.
   * @param {string} [definition.vshader] - Vertex shader source (GLSL code). Optional when
   * compute shader is specified.
   * @param {string} [definition.fshader] - Fragment shader source (GLSL code). Optional when
   * useTransformFeedback or compute shader is specified.
   * @param {string} [definition.cshader] - Compute shader source (WGSL code). Only supported on
   * WebGPU platform.
   * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
   * post-VS data to a buffer.
   * @param {string | string[]} [definition.fragmentOutputTypes] - Fragment shader output types,
   * which default to vec4. Passing a string will set the output type for all color attachments.
   * Passing an array will set the output type for each color attachment.
   * @param {string} [definition.shaderLanguage] - Specifies the shader language of vertex and
   * fragment shaders. Defaults to {@link SHADERLANGUAGE_GLSL}.
   * @example
   * // Create a shader that renders primitives with a solid red color
   *
   * // Vertex shader
   * const vshader = `
   * attribute vec3 aPosition;
   *
   * void main(void) {
   *     gl_Position = vec4(aPosition, 1.0);
   * }
   * `;
   *
   * // Fragment shader
   * const fshader = `
   * precision ${graphicsDevice.precision} float;
   *
   * void main(void) {
   *     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
   * }
   * `;
   *
   * const shaderDefinition = {
   *     attributes: {
   *         aPosition: pc.SEMANTIC_POSITION
   *     },
   *     vshader,
   *     fshader
   * };
   *
   * const shader = new pc.Shader(graphicsDevice, shaderDefinition);
   */
  constructor(graphicsDevice, definition) {
    /**
     * Format of the uniform buffer for mesh bind group.
     *
     * @type {import('./uniform-buffer-format.js').UniformBufferFormat}
     * @ignore
     */
    this.meshUniformBufferFormat = void 0;
    /**
     * Format of the bind group for the mesh bind group.
     *
     * @type {import('./bind-group-format.js').BindGroupFormat}
     * @ignore
     */
    this.meshBindGroupFormat = void 0;
    this.id = id++;
    this.device = graphicsDevice;
    this.definition = definition;
    this.name = definition.name || 'Untitled';
    this.init();
    if (definition.cshader) {
      Debug.assert(graphicsDevice.supportsCompute, 'Compute shaders are not supported on this device.');
      Debug.assert(!definition.vshader && !definition.fshader, 'Vertex and fragment shaders are not supported when creating a compute shader.');
    } else {
      Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
      Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');

      // pre-process shader sources
      definition.vshader = Preprocessor.run(definition.vshader);

      // Strip unused color attachments from fragment shader.
      // Note: this is only needed for iOS 15 on WebGL2 where there seems to be a bug where color attachments that are not
      // written to generate metal linking errors. This is fixed on iOS 16, and iOS 14 does not support WebGL2.
      const stripUnusedColorAttachments = graphicsDevice.isWebGL2 && (platform.name === 'osx' || platform.name === 'ios');
      definition.fshader = Preprocessor.run(definition.fshader, stripUnusedColorAttachments);
    }
    this.impl = graphicsDevice.createShaderImpl(this);
    Debug.trace(TRACEID_SHADER_ALLOC, `Alloc: ${this.label}, stack: ${DebugGraphics.toString()}`, {
      instance: this
    });
  }

  /**
   * Initialize a shader back to its default state.
   *
   * @private
   */
  init() {
    this.ready = false;
    this.failed = false;
  }

  /** @ignore */
  get label() {
    return `Shader Id ${this.id} ${this.name}`;
  }

  /**
   * Frees resources associated with this shader.
   */
  destroy() {
    Debug.trace(TRACEID_SHADER_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    this.device.onDestroyShader(this);
    this.impl.destroy(this);
  }

  /**
   * Called when the WebGL context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.init();
    this.impl.loseContext();
  }

  /** @ignore */
  restoreContext() {
    this.impl.restoreContext(this.device, this);
  }
}

export { Shader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfU0hBREVSX0FMTE9DIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBQcmVwcm9jZXNzb3IgfSBmcm9tICcuLi8uLi9jb3JlL3ByZXByb2Nlc3Nvci5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSBzaGFkZXIgaXMgYSBwcm9ncmFtIHRoYXQgaXMgcmVzcG9uc2libGUgZm9yIHJlbmRlcmluZyBncmFwaGljYWwgcHJpbWl0aXZlcyBvbiBhIGRldmljZSdzXG4gKiBncmFwaGljcyBwcm9jZXNzb3IuIFRoZSBzaGFkZXIgaXMgZ2VuZXJhdGVkIGZyb20gYSBzaGFkZXIgZGVmaW5pdGlvbi4gVGhpcyBzaGFkZXIgZGVmaW5pdGlvblxuICogc3BlY2lmaWVzIHRoZSBjb2RlIGZvciBwcm9jZXNzaW5nIHZlcnRpY2VzIGFuZCBmcmFnbWVudHMgcHJvY2Vzc2VkIGJ5IHRoZSBHUFUuIFRoZSBsYW5ndWFnZSBvZlxuICogdGhlIGNvZGUgaXMgR0xTTCAob3IgbW9yZSBzcGVjaWZpY2FsbHkgRVNTTCwgdGhlIE9wZW5HTCBFUyBTaGFkaW5nIExhbmd1YWdlKS4gVGhlIHNoYWRlclxuICogZGVmaW5pdGlvbiBhbHNvIGRlc2NyaWJlcyBob3cgdGhlIFBsYXlDYW52YXMgZW5naW5lIHNob3VsZCBtYXAgdmVydGV4IGJ1ZmZlciBlbGVtZW50cyBvbnRvIHRoZVxuICogYXR0cmlidXRlcyBzcGVjaWZpZWQgaW4gdGhlIHZlcnRleCBzaGFkZXIgY29kZS5cbiAqXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgU2hhZGVyIHtcbiAgICAvKipcbiAgICAgKiBGb3JtYXQgb2YgdGhlIHVuaWZvcm0gYnVmZmVyIGZvciBtZXNoIGJpbmQgZ3JvdXAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcycpLlVuaWZvcm1CdWZmZXJGb3JtYXR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0O1xuXG4gICAgLyoqXG4gICAgICogRm9ybWF0IG9mIHRoZSBiaW5kIGdyb3VwIGZvciB0aGUgbWVzaCBiaW5kIGdyb3VwLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9iaW5kLWdyb3VwLWZvcm1hdC5qcycpLkJpbmRHcm91cEZvcm1hdH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbWVzaEJpbmRHcm91cEZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2hhZGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQ29uc2lkZXIge0BsaW5rIGNyZWF0ZVNoYWRlckZyb21Db2RlfSBhcyBhIHNpbXBsZXIgYW5kIG1vcmUgcG93ZXJmdWwgd2F5IHRvIGNyZWF0ZVxuICAgICAqIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uIGZyb20gd2hpY2ggdG8gYnVpbGQgdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RlZmluaXRpb24ubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gW2RlZmluaXRpb24uYXR0cmlidXRlc10gLSBPYmplY3QgZGV0YWlsaW5nIHRoZSBtYXBwaW5nIG9mXG4gICAgICogdmVydGV4IHNoYWRlciBhdHRyaWJ1dGUgbmFtZXMgdG8gc2VtYW50aWNzIFNFTUFOVElDXyouIFRoaXMgZW5hYmxlcyB0aGUgZW5naW5lIHRvIG1hdGNoXG4gICAgICogdmVydGV4IGJ1ZmZlciBkYXRhIGFzIGlucHV0cyB0byB0aGUgc2hhZGVyLiBXaGVuIG5vdCBzcGVjaWZpZWQsIHJlbmRlcmluZyB3aXRob3V0XG4gICAgICogdmVydGV4IGJ1ZmZlciBpcyBhc3N1bWVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi52c2hhZGVyXSAtIFZlcnRleCBzaGFkZXIgc291cmNlIChHTFNMIGNvZGUpLiBPcHRpb25hbCB3aGVuXG4gICAgICogY29tcHV0ZSBzaGFkZXIgaXMgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5mc2hhZGVyXSAtIEZyYWdtZW50IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuIE9wdGlvbmFsIHdoZW5cbiAgICAgKiB1c2VUcmFuc2Zvcm1GZWVkYmFjayBvciBjb21wdXRlIHNoYWRlciBpcyBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtkZWZpbml0aW9uLmNzaGFkZXJdIC0gQ29tcHV0ZSBzaGFkZXIgc291cmNlIChXR1NMIGNvZGUpLiBPbmx5IHN1cHBvcnRlZCBvblxuICAgICAqIFdlYkdQVSBwbGF0Zm9ybS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZWZpbml0aW9uLnVzZVRyYW5zZm9ybUZlZWRiYWNrXSAtIFNwZWNpZmllcyB0aGF0IHRoaXMgc2hhZGVyIG91dHB1dHNcbiAgICAgKiBwb3N0LVZTIGRhdGEgdG8gYSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gW2RlZmluaXRpb24uZnJhZ21lbnRPdXRwdXRUeXBlc10gLSBGcmFnbWVudCBzaGFkZXIgb3V0cHV0IHR5cGVzLFxuICAgICAqIHdoaWNoIGRlZmF1bHQgdG8gdmVjNC4gUGFzc2luZyBhIHN0cmluZyB3aWxsIHNldCB0aGUgb3V0cHV0IHR5cGUgZm9yIGFsbCBjb2xvciBhdHRhY2htZW50cy5cbiAgICAgKiBQYXNzaW5nIGFuIGFycmF5IHdpbGwgc2V0IHRoZSBvdXRwdXQgdHlwZSBmb3IgZWFjaCBjb2xvciBhdHRhY2htZW50LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5zaGFkZXJMYW5ndWFnZV0gLSBTcGVjaWZpZXMgdGhlIHNoYWRlciBsYW5ndWFnZSBvZiB2ZXJ0ZXggYW5kXG4gICAgICogZnJhZ21lbnQgc2hhZGVycy4gRGVmYXVsdHMgdG8ge0BsaW5rIFNIQURFUkxBTkdVQUdFX0dMU0x9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgc2hhZGVyIHRoYXQgcmVuZGVycyBwcmltaXRpdmVzIHdpdGggYSBzb2xpZCByZWQgY29sb3JcbiAgICAgKlxuICAgICAqIC8vIFZlcnRleCBzaGFkZXJcbiAgICAgKiBjb25zdCB2c2hhZGVyID0gYFxuICAgICAqIGF0dHJpYnV0ZSB2ZWMzIGFQb3NpdGlvbjtcbiAgICAgKlxuICAgICAqIHZvaWQgbWFpbih2b2lkKSB7XG4gICAgICogICAgIGdsX1Bvc2l0aW9uID0gdmVjNChhUG9zaXRpb24sIDEuMCk7XG4gICAgICogfVxuICAgICAqIGA7XG4gICAgICpcbiAgICAgKiAvLyBGcmFnbWVudCBzaGFkZXJcbiAgICAgKiBjb25zdCBmc2hhZGVyID0gYFxuICAgICAqIHByZWNpc2lvbiAke2dyYXBoaWNzRGV2aWNlLnByZWNpc2lvbn0gZmxvYXQ7XG4gICAgICpcbiAgICAgKiB2b2lkIG1haW4odm9pZCkge1xuICAgICAqICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDEuMCwgMC4wLCAwLjAsIDEuMCk7XG4gICAgICogfVxuICAgICAqIGA7XG4gICAgICpcbiAgICAgKiBjb25zdCBzaGFkZXJEZWZpbml0aW9uID0ge1xuICAgICAqICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICogICAgICAgICBhUG9zaXRpb246IHBjLlNFTUFOVElDX1BPU0lUSU9OXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHZzaGFkZXIsXG4gICAgICogICAgIGZzaGFkZXJcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogY29uc3Qgc2hhZGVyID0gbmV3IHBjLlNoYWRlcihncmFwaGljc0RldmljZSwgc2hhZGVyRGVmaW5pdGlvbik7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGRlZmluaXRpb24pIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMuZGVmaW5pdGlvbiA9IGRlZmluaXRpb247XG4gICAgICAgIHRoaXMubmFtZSA9IGRlZmluaXRpb24ubmFtZSB8fCAnVW50aXRsZWQnO1xuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICBpZiAoZGVmaW5pdGlvbi5jc2hhZGVyKSB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3JhcGhpY3NEZXZpY2Uuc3VwcG9ydHNDb21wdXRlLCAnQ29tcHV0ZSBzaGFkZXJzIGFyZSBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgZGV2aWNlLicpO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCFkZWZpbml0aW9uLnZzaGFkZXIgJiYgIWRlZmluaXRpb24uZnNoYWRlciwgJ1ZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBhcmUgbm90IHN1cHBvcnRlZCB3aGVuIGNyZWF0aW5nIGEgY29tcHV0ZSBzaGFkZXIuJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoZGVmaW5pdGlvbi52c2hhZGVyLCAnTm8gdmVydGV4IHNoYWRlciBoYXMgYmVlbiBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBhIHNoYWRlci4nKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChkZWZpbml0aW9uLmZzaGFkZXIsICdObyBmcmFnbWVudCBzaGFkZXIgaGFzIGJlZW4gc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgYSBzaGFkZXIuJyk7XG5cbiAgICAgICAgICAgIC8vIHByZS1wcm9jZXNzIHNoYWRlciBzb3VyY2VzXG4gICAgICAgICAgICBkZWZpbml0aW9uLnZzaGFkZXIgPSBQcmVwcm9jZXNzb3IucnVuKGRlZmluaXRpb24udnNoYWRlcik7XG5cbiAgICAgICAgICAgIC8vIFN0cmlwIHVudXNlZCBjb2xvciBhdHRhY2htZW50cyBmcm9tIGZyYWdtZW50IHNoYWRlci5cbiAgICAgICAgICAgIC8vIE5vdGU6IHRoaXMgaXMgb25seSBuZWVkZWQgZm9yIGlPUyAxNSBvbiBXZWJHTDIgd2hlcmUgdGhlcmUgc2VlbXMgdG8gYmUgYSBidWcgd2hlcmUgY29sb3IgYXR0YWNobWVudHMgdGhhdCBhcmUgbm90XG4gICAgICAgICAgICAvLyB3cml0dGVuIHRvIGdlbmVyYXRlIG1ldGFsIGxpbmtpbmcgZXJyb3JzLiBUaGlzIGlzIGZpeGVkIG9uIGlPUyAxNiwgYW5kIGlPUyAxNCBkb2VzIG5vdCBzdXBwb3J0IFdlYkdMMi5cbiAgICAgICAgICAgIGNvbnN0IHN0cmlwVW51c2VkQ29sb3JBdHRhY2htZW50cyA9IGdyYXBoaWNzRGV2aWNlLmlzV2ViR0wyICYmIChwbGF0Zm9ybS5uYW1lID09PSAnb3N4JyB8fCBwbGF0Zm9ybS5uYW1lID09PSAnaW9zJyk7XG4gICAgICAgICAgICBkZWZpbml0aW9uLmZzaGFkZXIgPSBQcmVwcm9jZXNzb3IucnVuKGRlZmluaXRpb24uZnNoYWRlciwgc3RyaXBVbnVzZWRDb2xvckF0dGFjaG1lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVNoYWRlckltcGwodGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9TSEFERVJfQUxMT0MsIGBBbGxvYzogJHt0aGlzLmxhYmVsfSwgc3RhY2s6ICR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfWAsIHtcbiAgICAgICAgICAgIGluc3RhbmNlOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgYSBzaGFkZXIgYmFjayB0byBpdHMgZGVmYXVsdCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaW5pdCgpIHtcbiAgICAgICAgdGhpcy5yZWFkeSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZhaWxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKiBAaWdub3JlICovXG4gICAgZ2V0IGxhYmVsKCkge1xuICAgICAgICByZXR1cm4gYFNoYWRlciBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHNoYWRlci5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1NIQURFUl9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG4gICAgICAgIHRoaXMuZGV2aWNlLm9uRGVzdHJveVNoYWRlcih0aGlzKTtcbiAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3kodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICByZXN0b3JlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLnJlc3RvcmVDb250ZXh0KHRoaXMuZGV2aWNlLCB0aGlzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNoYWRlciB9O1xuIl0sIm5hbWVzIjpbImlkIiwiU2hhZGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImRlZmluaXRpb24iLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIm1lc2hCaW5kR3JvdXBGb3JtYXQiLCJkZXZpY2UiLCJuYW1lIiwiaW5pdCIsImNzaGFkZXIiLCJEZWJ1ZyIsImFzc2VydCIsInN1cHBvcnRzQ29tcHV0ZSIsInZzaGFkZXIiLCJmc2hhZGVyIiwiUHJlcHJvY2Vzc29yIiwicnVuIiwic3RyaXBVbnVzZWRDb2xvckF0dGFjaG1lbnRzIiwiaXNXZWJHTDIiLCJwbGF0Zm9ybSIsImltcGwiLCJjcmVhdGVTaGFkZXJJbXBsIiwidHJhY2UiLCJUUkFDRUlEX1NIQURFUl9BTExPQyIsImxhYmVsIiwiRGVidWdHcmFwaGljcyIsInRvU3RyaW5nIiwiaW5zdGFuY2UiLCJyZWFkeSIsImZhaWxlZCIsImRlc3Ryb3kiLCJvbkRlc3Ryb3lTaGFkZXIiLCJsb3NlQ29udGV4dCIsInJlc3RvcmVDb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFNQSxJQUFJQSxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxDQUFDO0FBaUJUO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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
