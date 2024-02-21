import { extends as _extends } from '../../_virtual/_rollupPluginBabelHelpers.js';
import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import { Debug } from '../../core/debug.js';
import { ShaderGenerator } from './programs/shader-generator.js';
import { SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';

/**
 * Create a shader from named shader chunks.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsName - The vertex shader chunk name.
 * @param {string} fsName - The fragment shader chunk name.
 * @param {boolean | Record<string, boolean | string | string[]>} [useTransformFeedback] - Whether
 * to use transform feedback. Defaults to false.
 * @param {object} [shaderDefinitionOptions] - Additional options that will be added to the shader
 * definition.
 * @param {boolean} [shaderDefinitionOptions.useTransformFeedback] - Whether to use transform
 * feedback. Defaults to false.
 * @param {string | string[]} [shaderDefinitionOptions.fragmentOutputTypes] - Fragment shader
 * output types, which default to vec4. Passing a string will set the output type for all color
 * attachments. Passing an array will set the output type for each color attachment.
 * @see ShaderUtils.createDefinition
 * @returns {Shader} The newly created shader.
 * @category Graphics
 */
function createShader(device, vsName, fsName, useTransformFeedback = false, shaderDefinitionOptions = {}) {
  // Normalize arguments to allow passing shaderDefinitionOptions as the 6th argument
  if (typeof useTransformFeedback === 'boolean') {
    shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
  } else if (typeof useTransformFeedback === 'object') {
    shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
  }
  return new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
    name: `${vsName}_${fsName}`,
    vertexCode: shaderChunks[vsName],
    fragmentCode: shaderChunks[fsName]
  })));
}

/**
 * Create a shader from the supplied source code. Note that this function adds additional shader
 * blocks to both vertex and fragment shaders, which allow the shader to use more features and
 * compile on both WebGL and WebGPU. Specifically, these blocks are added, and should not be
 * part of provided vsCode and fsCode: shader version, shader precision, commonly used extensions.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsCode - The vertex shader code.
 * @param {string} fsCode - The fragment shader code.
 * @param {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @param {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @param {boolean | Record<string, boolean | string | string[]>} [useTransformFeedback] - Whether
 * to use transform feedback. Defaults to false.
 * @param {object} [shaderDefinitionOptions] - Additional options that will be added to the shader
 * definition.
 * @param {boolean} [shaderDefinitionOptions.useTransformFeedback] - Whether to use transform
 * feedback. Defaults to false.
 * @param {string | string[]} [shaderDefinitionOptions.fragmentOutputTypes] - Fragment shader
 * output types, which default to vec4. Passing a string will set the output type for all color
 * attachments. Passing an array will set the output type for each color attachment.
 * @see ShaderUtils.createDefinition
 * @returns {Shader} The newly created shader.
 * @category Graphics
 */
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false, shaderDefinitionOptions = {}) {
  // the function signature has changed, fail if called incorrectly
  Debug.assert(typeof attributes !== 'boolean');

  // Normalize arguments to allow passing shaderDefinitionOptions as the 6th argument
  if (typeof useTransformFeedback === 'boolean') {
    shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
  } else if (typeof useTransformFeedback === 'object') {
    shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
  }
  const programLibrary = getProgramLibrary(device);
  let shader = programLibrary.getCachedShader(uniqueName);
  if (!shader) {
    shader = new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
      name: uniqueName,
      vertexCode: vsCode,
      fragmentCode: fsCode,
      attributes: attributes
    })));
    programLibrary.setCachedShader(uniqueName, shader);
  }
  return shader;
}
class ShaderGeneratorPassThrough extends ShaderGenerator {
  constructor(key, shaderDefinition) {
    super();
    this.key = key;
    this.shaderDefinition = shaderDefinition;
  }
  generateKey(options) {
    return this.key;
  }
  createShaderDefinition(device, options) {
    return this.shaderDefinition;
  }
}

/**
 * Process shader using shader processing options, utilizing cache of the ProgramLibrary
 *
 * @param {Shader} shader - The shader to be processed.
 * @param {import('../../platform/graphics/shader-processor-options.js').ShaderProcessorOptions} processingOptions -
 * The shader processing options.
 * @returns {Shader} The processed shader.
 * @ignore
 */
function processShader(shader, processingOptions) {
  var _shaderDefinition$nam;
  Debug.assert(shader);
  const shaderDefinition = shader.definition;

  // 'shader' generator for a material - simply return existing shader definition. Use generator and getProgram
  // to allow for shader processing to be cached
  const name = (_shaderDefinition$nam = shaderDefinition.name) != null ? _shaderDefinition$nam : 'shader';

  // unique name based of the shader id
  const key = `${name}-id-${shader.id}`;
  const materialGenerator = new ShaderGeneratorPassThrough(key, shaderDefinition);

  // temporarily register the program generator
  const libraryModuleName = 'shader';
  const library = getProgramLibrary(shader.device);
  Debug.assert(!library.isRegistered(libraryModuleName));
  library.register(libraryModuleName, materialGenerator);

  // generate shader variant - its the same shader, but with different processing options
  const variant = library.getProgram(libraryModuleName, {}, processingOptions);

  // For now WGSL shaders need to provide their own formats as they aren't processed.
  // Make sure to copy these from the original shader.
  if (shader.definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
    variant.meshUniformBufferFormat = shaderDefinition.meshUniformBufferFormat;
    variant.meshBindGroupFormat = shaderDefinition.meshBindGroupFormat;
  }

  // unregister it again
  library.unregister(libraryModuleName);
  return variant;
}
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode, processShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3V0aWxzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFNoYWRlckdlbmVyYXRvciB9IGZyb20gJy4vcHJvZ3JhbXMvc2hhZGVyLWdlbmVyYXRvci5qcyc7XG5pbXBvcnQgeyBTSEFERVJMQU5HVUFHRV9XR1NMIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBDcmVhdGUgYSBzaGFkZXIgZnJvbSBuYW1lZCBzaGFkZXIgY2h1bmtzLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gKiBncmFwaGljcyBkZXZpY2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gdnNOYW1lIC0gVGhlIHZlcnRleCBzaGFkZXIgY2h1bmsgbmFtZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBmc05hbWUgLSBUaGUgZnJhZ21lbnQgc2hhZGVyIGNodW5rIG5hbWUuXG4gKiBAcGFyYW0ge2Jvb2xlYW4gfCBSZWNvcmQ8c3RyaW5nLCBib29sZWFuIHwgc3RyaW5nIHwgc3RyaW5nW10+fSBbdXNlVHJhbnNmb3JtRmVlZGJhY2tdIC0gV2hldGhlclxuICogdG8gdXNlIHRyYW5zZm9ybSBmZWVkYmFjay4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAcGFyYW0ge29iamVjdH0gW3NoYWRlckRlZmluaXRpb25PcHRpb25zXSAtIEFkZGl0aW9uYWwgb3B0aW9ucyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIHNoYWRlclxuICogZGVmaW5pdGlvbi5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NoYWRlckRlZmluaXRpb25PcHRpb25zLnVzZVRyYW5zZm9ybUZlZWRiYWNrXSAtIFdoZXRoZXIgdG8gdXNlIHRyYW5zZm9ybVxuICogZmVlZGJhY2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gW3NoYWRlckRlZmluaXRpb25PcHRpb25zLmZyYWdtZW50T3V0cHV0VHlwZXNdIC0gRnJhZ21lbnQgc2hhZGVyXG4gKiBvdXRwdXQgdHlwZXMsIHdoaWNoIGRlZmF1bHQgdG8gdmVjNC4gUGFzc2luZyBhIHN0cmluZyB3aWxsIHNldCB0aGUgb3V0cHV0IHR5cGUgZm9yIGFsbCBjb2xvclxuICogYXR0YWNobWVudHMuIFBhc3NpbmcgYW4gYXJyYXkgd2lsbCBzZXQgdGhlIG91dHB1dCB0eXBlIGZvciBlYWNoIGNvbG9yIGF0dGFjaG1lbnQuXG4gKiBAc2VlIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb25cbiAqIEByZXR1cm5zIHtTaGFkZXJ9IFRoZSBuZXdseSBjcmVhdGVkIHNoYWRlci5cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5mdW5jdGlvbiBjcmVhdGVTaGFkZXIoZGV2aWNlLCB2c05hbWUsIGZzTmFtZSwgdXNlVHJhbnNmb3JtRmVlZGJhY2sgPSBmYWxzZSwgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMgPSB7fSkge1xuXG4gICAgLy8gTm9ybWFsaXplIGFyZ3VtZW50cyB0byBhbGxvdyBwYXNzaW5nIHNoYWRlckRlZmluaXRpb25PcHRpb25zIGFzIHRoZSA2dGggYXJndW1lbnRcbiAgICBpZiAodHlwZW9mIHVzZVRyYW5zZm9ybUZlZWRiYWNrID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMudXNlVHJhbnNmb3JtRmVlZGJhY2sgPSB1c2VUcmFuc2Zvcm1GZWVkYmFjaztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB1c2VUcmFuc2Zvcm1GZWVkYmFjayA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMgPSB7XG4gICAgICAgICAgICAuLi5zaGFkZXJEZWZpbml0aW9uT3B0aW9ucyxcbiAgICAgICAgICAgIC4uLnVzZVRyYW5zZm9ybUZlZWRiYWNrXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICAuLi5zaGFkZXJEZWZpbml0aW9uT3B0aW9ucyxcbiAgICAgICAgbmFtZTogYCR7dnNOYW1lfV8ke2ZzTmFtZX1gLFxuICAgICAgICB2ZXJ0ZXhDb2RlOiBzaGFkZXJDaHVua3NbdnNOYW1lXSxcbiAgICAgICAgZnJhZ21lbnRDb2RlOiBzaGFkZXJDaHVua3NbZnNOYW1lXVxuICAgIH0pKTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBzaGFkZXIgZnJvbSB0aGUgc3VwcGxpZWQgc291cmNlIGNvZGUuIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIGFkZHMgYWRkaXRpb25hbCBzaGFkZXJcbiAqIGJsb2NrcyB0byBib3RoIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycywgd2hpY2ggYWxsb3cgdGhlIHNoYWRlciB0byB1c2UgbW9yZSBmZWF0dXJlcyBhbmRcbiAqIGNvbXBpbGUgb24gYm90aCBXZWJHTCBhbmQgV2ViR1BVLiBTcGVjaWZpY2FsbHksIHRoZXNlIGJsb2NrcyBhcmUgYWRkZWQsIGFuZCBzaG91bGQgbm90IGJlXG4gKiBwYXJ0IG9mIHByb3ZpZGVkIHZzQ29kZSBhbmQgZnNDb2RlOiBzaGFkZXIgdmVyc2lvbiwgc2hhZGVyIHByZWNpc2lvbiwgY29tbW9ubHkgdXNlZCBleHRlbnNpb25zLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gKiBncmFwaGljcyBkZXZpY2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gdnNDb2RlIC0gVGhlIHZlcnRleCBzaGFkZXIgY29kZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBmc0NvZGUgLSBUaGUgZnJhZ21lbnQgc2hhZGVyIGNvZGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gdW5pcXVlTmFtZSAtIFVuaXF1ZSBuYW1lIGZvciB0aGUgc2hhZGVyLiBJZiBhIHNoYWRlciB3aXRoIHRoaXMgbmFtZSBhbHJlYWR5XG4gKiBleGlzdHMsIGl0IHdpbGwgYmUgcmV0dXJuZWQgaW5zdGVhZCBvZiBhIG5ldyBzaGFkZXIgaW5zdGFuY2UuXG4gKiBAcGFyYW0ge09iamVjdDxzdHJpbmcsIHN0cmluZz59IFthdHRyaWJ1dGVzXSAtIE9iamVjdCBkZXRhaWxpbmcgdGhlIG1hcHBpbmcgb2YgdmVydGV4IHNoYWRlclxuICogYXR0cmlidXRlIG5hbWVzIHRvIHNlbWFudGljcyBTRU1BTlRJQ18qLiBUaGlzIGVuYWJsZXMgdGhlIGVuZ2luZSB0byBtYXRjaCB2ZXJ0ZXggYnVmZmVyIGRhdGEgYXNcbiAqIGlucHV0cyB0byB0aGUgc2hhZGVyLiBEZWZhdWx0cyB0byB1bmRlZmluZWQsIHdoaWNoIGdlbmVyYXRlcyB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzLlxuICogQHBhcmFtIHtib29sZWFuIHwgUmVjb3JkPHN0cmluZywgYm9vbGVhbiB8IHN0cmluZyB8IHN0cmluZ1tdPn0gW3VzZVRyYW5zZm9ybUZlZWRiYWNrXSAtIFdoZXRoZXJcbiAqIHRvIHVzZSB0cmFuc2Zvcm0gZmVlZGJhY2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHBhcmFtIHtvYmplY3R9IFtzaGFkZXJEZWZpbml0aW9uT3B0aW9uc10gLSBBZGRpdGlvbmFsIG9wdGlvbnMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBzaGFkZXJcbiAqIGRlZmluaXRpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtzaGFkZXJEZWZpbml0aW9uT3B0aW9ucy51c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBXaGV0aGVyIHRvIHVzZSB0cmFuc2Zvcm1cbiAqIGZlZWRiYWNrLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEBwYXJhbSB7c3RyaW5nIHwgc3RyaW5nW119IFtzaGFkZXJEZWZpbml0aW9uT3B0aW9ucy5mcmFnbWVudE91dHB1dFR5cGVzXSAtIEZyYWdtZW50IHNoYWRlclxuICogb3V0cHV0IHR5cGVzLCB3aGljaCBkZWZhdWx0IHRvIHZlYzQuIFBhc3NpbmcgYSBzdHJpbmcgd2lsbCBzZXQgdGhlIG91dHB1dCB0eXBlIGZvciBhbGwgY29sb3JcbiAqIGF0dGFjaG1lbnRzLiBQYXNzaW5nIGFuIGFycmF5IHdpbGwgc2V0IHRoZSBvdXRwdXQgdHlwZSBmb3IgZWFjaCBjb2xvciBhdHRhY2htZW50LlxuICogQHNlZSBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uXG4gKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgbmV3bHkgY3JlYXRlZCBzaGFkZXIuXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZGV2aWNlLCB2c0NvZGUsIGZzQ29kZSwgdW5pcXVlTmFtZSwgYXR0cmlidXRlcywgdXNlVHJhbnNmb3JtRmVlZGJhY2sgPSBmYWxzZSwgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMgPSB7fSkge1xuXG4gICAgLy8gdGhlIGZ1bmN0aW9uIHNpZ25hdHVyZSBoYXMgY2hhbmdlZCwgZmFpbCBpZiBjYWxsZWQgaW5jb3JyZWN0bHlcbiAgICBEZWJ1Zy5hc3NlcnQodHlwZW9mIGF0dHJpYnV0ZXMgIT09ICdib29sZWFuJyk7XG5cbiAgICAvLyBOb3JtYWxpemUgYXJndW1lbnRzIHRvIGFsbG93IHBhc3Npbmcgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMgYXMgdGhlIDZ0aCBhcmd1bWVudFxuICAgIGlmICh0eXBlb2YgdXNlVHJhbnNmb3JtRmVlZGJhY2sgPT09ICdib29sZWFuJykge1xuICAgICAgICBzaGFkZXJEZWZpbml0aW9uT3B0aW9ucy51c2VUcmFuc2Zvcm1GZWVkYmFjayA9IHVzZVRyYW5zZm9ybUZlZWRiYWNrO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHVzZVRyYW5zZm9ybUZlZWRiYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICBzaGFkZXJEZWZpbml0aW9uT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIC4uLnNoYWRlckRlZmluaXRpb25PcHRpb25zLFxuICAgICAgICAgICAgLi4udXNlVHJhbnNmb3JtRmVlZGJhY2tcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9ncmFtTGlicmFyeSA9IGdldFByb2dyYW1MaWJyYXJ5KGRldmljZSk7XG4gICAgbGV0IHNoYWRlciA9IHByb2dyYW1MaWJyYXJ5LmdldENhY2hlZFNoYWRlcih1bmlxdWVOYW1lKTtcbiAgICBpZiAoIXNoYWRlcikge1xuICAgICAgICBzaGFkZXIgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgICAgIC4uLnNoYWRlckRlZmluaXRpb25PcHRpb25zLFxuICAgICAgICAgICAgbmFtZTogdW5pcXVlTmFtZSxcbiAgICAgICAgICAgIHZlcnRleENvZGU6IHZzQ29kZSxcbiAgICAgICAgICAgIGZyYWdtZW50Q29kZTogZnNDb2RlLFxuICAgICAgICAgICAgYXR0cmlidXRlczogYXR0cmlidXRlc1xuICAgICAgICB9KSk7XG4gICAgICAgIHByb2dyYW1MaWJyYXJ5LnNldENhY2hlZFNoYWRlcih1bmlxdWVOYW1lLCBzaGFkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gc2hhZGVyO1xufVxuXG5jbGFzcyBTaGFkZXJHZW5lcmF0b3JQYXNzVGhyb3VnaCBleHRlbmRzIFNoYWRlckdlbmVyYXRvciB7XG4gICAgY29uc3RydWN0b3Ioa2V5LCBzaGFkZXJEZWZpbml0aW9uKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMua2V5ID0ga2V5O1xuICAgICAgICB0aGlzLnNoYWRlckRlZmluaXRpb24gPSBzaGFkZXJEZWZpbml0aW9uO1xuICAgIH1cblxuICAgIGdlbmVyYXRlS2V5KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMua2V5O1xuICAgIH1cblxuICAgIGNyZWF0ZVNoYWRlckRlZmluaXRpb24oZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNoYWRlckRlZmluaXRpb247XG4gICAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3Mgc2hhZGVyIHVzaW5nIHNoYWRlciBwcm9jZXNzaW5nIG9wdGlvbnMsIHV0aWxpemluZyBjYWNoZSBvZiB0aGUgUHJvZ3JhbUxpYnJhcnlcbiAqXG4gKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBiZSBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzJykuU2hhZGVyUHJvY2Vzc29yT3B0aW9uc30gcHJvY2Vzc2luZ09wdGlvbnMgLVxuICogVGhlIHNoYWRlciBwcm9jZXNzaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgcHJvY2Vzc2VkIHNoYWRlci5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gcHJvY2Vzc1NoYWRlcihzaGFkZXIsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG5cbiAgICBEZWJ1Zy5hc3NlcnQoc2hhZGVyKTtcbiAgICBjb25zdCBzaGFkZXJEZWZpbml0aW9uID0gc2hhZGVyLmRlZmluaXRpb247XG5cbiAgICAvLyAnc2hhZGVyJyBnZW5lcmF0b3IgZm9yIGEgbWF0ZXJpYWwgLSBzaW1wbHkgcmV0dXJuIGV4aXN0aW5nIHNoYWRlciBkZWZpbml0aW9uLiBVc2UgZ2VuZXJhdG9yIGFuZCBnZXRQcm9ncmFtXG4gICAgLy8gdG8gYWxsb3cgZm9yIHNoYWRlciBwcm9jZXNzaW5nIHRvIGJlIGNhY2hlZFxuICAgIGNvbnN0IG5hbWUgPSBzaGFkZXJEZWZpbml0aW9uLm5hbWUgPz8gJ3NoYWRlcic7XG5cbiAgICAvLyB1bmlxdWUgbmFtZSBiYXNlZCBvZiB0aGUgc2hhZGVyIGlkXG4gICAgY29uc3Qga2V5ID0gYCR7bmFtZX0taWQtJHtzaGFkZXIuaWR9YDtcblxuICAgIGNvbnN0IG1hdGVyaWFsR2VuZXJhdG9yID0gbmV3IFNoYWRlckdlbmVyYXRvclBhc3NUaHJvdWdoKGtleSwgc2hhZGVyRGVmaW5pdGlvbik7XG5cbiAgICAvLyB0ZW1wb3JhcmlseSByZWdpc3RlciB0aGUgcHJvZ3JhbSBnZW5lcmF0b3JcbiAgICBjb25zdCBsaWJyYXJ5TW9kdWxlTmFtZSA9ICdzaGFkZXInO1xuICAgIGNvbnN0IGxpYnJhcnkgPSBnZXRQcm9ncmFtTGlicmFyeShzaGFkZXIuZGV2aWNlKTtcbiAgICBEZWJ1Zy5hc3NlcnQoIWxpYnJhcnkuaXNSZWdpc3RlcmVkKGxpYnJhcnlNb2R1bGVOYW1lKSk7XG4gICAgbGlicmFyeS5yZWdpc3RlcihsaWJyYXJ5TW9kdWxlTmFtZSwgbWF0ZXJpYWxHZW5lcmF0b3IpO1xuXG4gICAgLy8gZ2VuZXJhdGUgc2hhZGVyIHZhcmlhbnQgLSBpdHMgdGhlIHNhbWUgc2hhZGVyLCBidXQgd2l0aCBkaWZmZXJlbnQgcHJvY2Vzc2luZyBvcHRpb25zXG4gICAgY29uc3QgdmFyaWFudCA9IGxpYnJhcnkuZ2V0UHJvZ3JhbShsaWJyYXJ5TW9kdWxlTmFtZSwge30sIHByb2Nlc3NpbmdPcHRpb25zKTtcblxuICAgIC8vIEZvciBub3cgV0dTTCBzaGFkZXJzIG5lZWQgdG8gcHJvdmlkZSB0aGVpciBvd24gZm9ybWF0cyBhcyB0aGV5IGFyZW4ndCBwcm9jZXNzZWQuXG4gICAgLy8gTWFrZSBzdXJlIHRvIGNvcHkgdGhlc2UgZnJvbSB0aGUgb3JpZ2luYWwgc2hhZGVyLlxuICAgIGlmIChzaGFkZXIuZGVmaW5pdGlvbi5zaGFkZXJMYW5ndWFnZSA9PT0gU0hBREVSTEFOR1VBR0VfV0dTTCkge1xuICAgICAgICB2YXJpYW50Lm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0ID0gc2hhZGVyRGVmaW5pdGlvbi5tZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcbiAgICAgICAgdmFyaWFudC5tZXNoQmluZEdyb3VwRm9ybWF0ID0gc2hhZGVyRGVmaW5pdGlvbi5tZXNoQmluZEdyb3VwRm9ybWF0O1xuICAgIH1cblxuICAgIC8vIHVucmVnaXN0ZXIgaXQgYWdhaW5cbiAgICBsaWJyYXJ5LnVucmVnaXN0ZXIobGlicmFyeU1vZHVsZU5hbWUpO1xuXG4gICAgcmV0dXJuIHZhcmlhbnQ7XG59XG5cblxuc2hhZGVyQ2h1bmtzLmNyZWF0ZVNoYWRlciA9IGNyZWF0ZVNoYWRlcjtcbnNoYWRlckNodW5rcy5jcmVhdGVTaGFkZXJGcm9tQ29kZSA9IGNyZWF0ZVNoYWRlckZyb21Db2RlO1xuXG5leHBvcnQgeyBjcmVhdGVTaGFkZXIsIGNyZWF0ZVNoYWRlckZyb21Db2RlLCBwcm9jZXNzU2hhZGVyIH07XG4iXSwibmFtZXMiOlsiY3JlYXRlU2hhZGVyIiwiZGV2aWNlIiwidnNOYW1lIiwiZnNOYW1lIiwidXNlVHJhbnNmb3JtRmVlZGJhY2siLCJzaGFkZXJEZWZpbml0aW9uT3B0aW9ucyIsIl9leHRlbmRzIiwiU2hhZGVyIiwiU2hhZGVyVXRpbHMiLCJjcmVhdGVEZWZpbml0aW9uIiwibmFtZSIsInZlcnRleENvZGUiLCJzaGFkZXJDaHVua3MiLCJmcmFnbWVudENvZGUiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsInZzQ29kZSIsImZzQ29kZSIsInVuaXF1ZU5hbWUiLCJhdHRyaWJ1dGVzIiwiRGVidWciLCJhc3NlcnQiLCJwcm9ncmFtTGlicmFyeSIsImdldFByb2dyYW1MaWJyYXJ5Iiwic2hhZGVyIiwiZ2V0Q2FjaGVkU2hhZGVyIiwic2V0Q2FjaGVkU2hhZGVyIiwiU2hhZGVyR2VuZXJhdG9yUGFzc1Rocm91Z2giLCJTaGFkZXJHZW5lcmF0b3IiLCJjb25zdHJ1Y3RvciIsImtleSIsInNoYWRlckRlZmluaXRpb24iLCJnZW5lcmF0ZUtleSIsIm9wdGlvbnMiLCJjcmVhdGVTaGFkZXJEZWZpbml0aW9uIiwicHJvY2Vzc1NoYWRlciIsInByb2Nlc3NpbmdPcHRpb25zIiwiX3NoYWRlckRlZmluaXRpb24kbmFtIiwiZGVmaW5pdGlvbiIsImlkIiwibWF0ZXJpYWxHZW5lcmF0b3IiLCJsaWJyYXJ5TW9kdWxlTmFtZSIsImxpYnJhcnkiLCJpc1JlZ2lzdGVyZWQiLCJyZWdpc3RlciIsInZhcmlhbnQiLCJnZXRQcm9ncmFtIiwic2hhZGVyTGFuZ3VhZ2UiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwidW5yZWdpc3RlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLFlBQVlBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLG9CQUFvQixHQUFHLEtBQUssRUFBRUMsdUJBQXVCLEdBQUcsRUFBRSxFQUFFO0FBRXRHO0FBQ0EsRUFBQSxJQUFJLE9BQU9ELG9CQUFvQixLQUFLLFNBQVMsRUFBRTtJQUMzQ0MsdUJBQXVCLENBQUNELG9CQUFvQixHQUFHQSxvQkFBb0IsQ0FBQTtBQUN2RSxHQUFDLE1BQU0sSUFBSSxPQUFPQSxvQkFBb0IsS0FBSyxRQUFRLEVBQUU7QUFDakRDLElBQUFBLHVCQUF1QixHQUFBQyxRQUFBLENBQUEsRUFBQSxFQUNoQkQsdUJBQXVCLEVBQ3ZCRCxvQkFBb0IsQ0FDMUIsQ0FBQTtBQUNMLEdBQUE7QUFFQSxFQUFBLE9BQU8sSUFBSUcsTUFBTSxDQUFDTixNQUFNLEVBQUVPLFdBQVcsQ0FBQ0MsZ0JBQWdCLENBQUNSLE1BQU0sRUFBQUssUUFBQSxLQUN0REQsdUJBQXVCLEVBQUE7QUFDMUJLLElBQUFBLElBQUksRUFBRyxDQUFBLEVBQUVSLE1BQU8sQ0FBQSxDQUFBLEVBQUdDLE1BQU8sQ0FBQyxDQUFBO0FBQzNCUSxJQUFBQSxVQUFVLEVBQUVDLFlBQVksQ0FBQ1YsTUFBTSxDQUFDO0lBQ2hDVyxZQUFZLEVBQUVELFlBQVksQ0FBQ1QsTUFBTSxDQUFBO0FBQUMsR0FBQSxDQUNyQyxDQUFDLENBQUMsQ0FBQTtBQUNQLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTVyxvQkFBb0JBLENBQUNiLE1BQU0sRUFBRWMsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLFVBQVUsRUFBRUMsVUFBVSxFQUFFZCxvQkFBb0IsR0FBRyxLQUFLLEVBQUVDLHVCQUF1QixHQUFHLEVBQUUsRUFBRTtBQUV0STtBQUNBYyxFQUFBQSxLQUFLLENBQUNDLE1BQU0sQ0FBQyxPQUFPRixVQUFVLEtBQUssU0FBUyxDQUFDLENBQUE7O0FBRTdDO0FBQ0EsRUFBQSxJQUFJLE9BQU9kLG9CQUFvQixLQUFLLFNBQVMsRUFBRTtJQUMzQ0MsdUJBQXVCLENBQUNELG9CQUFvQixHQUFHQSxvQkFBb0IsQ0FBQTtBQUN2RSxHQUFDLE1BQU0sSUFBSSxPQUFPQSxvQkFBb0IsS0FBSyxRQUFRLEVBQUU7QUFDakRDLElBQUFBLHVCQUF1QixHQUFBQyxRQUFBLENBQUEsRUFBQSxFQUNoQkQsdUJBQXVCLEVBQ3ZCRCxvQkFBb0IsQ0FDMUIsQ0FBQTtBQUNMLEdBQUE7QUFFQSxFQUFBLE1BQU1pQixjQUFjLEdBQUdDLGlCQUFpQixDQUFDckIsTUFBTSxDQUFDLENBQUE7QUFDaEQsRUFBQSxJQUFJc0IsTUFBTSxHQUFHRixjQUFjLENBQUNHLGVBQWUsQ0FBQ1AsVUFBVSxDQUFDLENBQUE7RUFDdkQsSUFBSSxDQUFDTSxNQUFNLEVBQUU7QUFDVEEsSUFBQUEsTUFBTSxHQUFHLElBQUloQixNQUFNLENBQUNOLE1BQU0sRUFBRU8sV0FBVyxDQUFDQyxnQkFBZ0IsQ0FBQ1IsTUFBTSxFQUFBSyxRQUFBLEtBQ3hERCx1QkFBdUIsRUFBQTtBQUMxQkssTUFBQUEsSUFBSSxFQUFFTyxVQUFVO0FBQ2hCTixNQUFBQSxVQUFVLEVBQUVJLE1BQU07QUFDbEJGLE1BQUFBLFlBQVksRUFBRUcsTUFBTTtBQUNwQkUsTUFBQUEsVUFBVSxFQUFFQSxVQUFBQTtBQUFVLEtBQUEsQ0FDekIsQ0FBQyxDQUFDLENBQUE7QUFDSEcsSUFBQUEsY0FBYyxDQUFDSSxlQUFlLENBQUNSLFVBQVUsRUFBRU0sTUFBTSxDQUFDLENBQUE7QUFDdEQsR0FBQTtBQUNBLEVBQUEsT0FBT0EsTUFBTSxDQUFBO0FBQ2pCLENBQUE7QUFFQSxNQUFNRywwQkFBMEIsU0FBU0MsZUFBZSxDQUFDO0FBQ3JEQyxFQUFBQSxXQUFXQSxDQUFDQyxHQUFHLEVBQUVDLGdCQUFnQixFQUFFO0FBQy9CLElBQUEsS0FBSyxFQUFFLENBQUE7SUFDUCxJQUFJLENBQUNELEdBQUcsR0FBR0EsR0FBRyxDQUFBO0lBQ2QsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBR0EsZ0JBQWdCLENBQUE7QUFDNUMsR0FBQTtFQUVBQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUU7SUFDakIsT0FBTyxJQUFJLENBQUNILEdBQUcsQ0FBQTtBQUNuQixHQUFBO0FBRUFJLEVBQUFBLHNCQUFzQkEsQ0FBQ2hDLE1BQU0sRUFBRStCLE9BQU8sRUFBRTtJQUNwQyxPQUFPLElBQUksQ0FBQ0YsZ0JBQWdCLENBQUE7QUFDaEMsR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0ksYUFBYUEsQ0FBQ1gsTUFBTSxFQUFFWSxpQkFBaUIsRUFBRTtBQUFBLEVBQUEsSUFBQUMscUJBQUEsQ0FBQTtBQUU5Q2pCLEVBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDRyxNQUFNLENBQUMsQ0FBQTtBQUNwQixFQUFBLE1BQU1PLGdCQUFnQixHQUFHUCxNQUFNLENBQUNjLFVBQVUsQ0FBQTs7QUFFMUM7QUFDQTtFQUNBLE1BQU0zQixJQUFJLEdBQUEwQixDQUFBQSxxQkFBQSxHQUFHTixnQkFBZ0IsQ0FBQ3BCLElBQUksS0FBQSxJQUFBLEdBQUEwQixxQkFBQSxHQUFJLFFBQVEsQ0FBQTs7QUFFOUM7RUFDQSxNQUFNUCxHQUFHLEdBQUksQ0FBRW5CLEVBQUFBLElBQUssT0FBTWEsTUFBTSxDQUFDZSxFQUFHLENBQUMsQ0FBQSxDQUFBO0VBRXJDLE1BQU1DLGlCQUFpQixHQUFHLElBQUliLDBCQUEwQixDQUFDRyxHQUFHLEVBQUVDLGdCQUFnQixDQUFDLENBQUE7O0FBRS9FO0VBQ0EsTUFBTVUsaUJBQWlCLEdBQUcsUUFBUSxDQUFBO0FBQ2xDLEVBQUEsTUFBTUMsT0FBTyxHQUFHbkIsaUJBQWlCLENBQUNDLE1BQU0sQ0FBQ3RCLE1BQU0sQ0FBQyxDQUFBO0VBQ2hEa0IsS0FBSyxDQUFDQyxNQUFNLENBQUMsQ0FBQ3FCLE9BQU8sQ0FBQ0MsWUFBWSxDQUFDRixpQkFBaUIsQ0FBQyxDQUFDLENBQUE7QUFDdERDLEVBQUFBLE9BQU8sQ0FBQ0UsUUFBUSxDQUFDSCxpQkFBaUIsRUFBRUQsaUJBQWlCLENBQUMsQ0FBQTs7QUFFdEQ7QUFDQSxFQUFBLE1BQU1LLE9BQU8sR0FBR0gsT0FBTyxDQUFDSSxVQUFVLENBQUNMLGlCQUFpQixFQUFFLEVBQUUsRUFBRUwsaUJBQWlCLENBQUMsQ0FBQTs7QUFFNUU7QUFDQTtBQUNBLEVBQUEsSUFBSVosTUFBTSxDQUFDYyxVQUFVLENBQUNTLGNBQWMsS0FBS0MsbUJBQW1CLEVBQUU7QUFDMURILElBQUFBLE9BQU8sQ0FBQ0ksdUJBQXVCLEdBQUdsQixnQkFBZ0IsQ0FBQ2tCLHVCQUF1QixDQUFBO0FBQzFFSixJQUFBQSxPQUFPLENBQUNLLG1CQUFtQixHQUFHbkIsZ0JBQWdCLENBQUNtQixtQkFBbUIsQ0FBQTtBQUN0RSxHQUFBOztBQUVBO0FBQ0FSLEVBQUFBLE9BQU8sQ0FBQ1MsVUFBVSxDQUFDVixpQkFBaUIsQ0FBQyxDQUFBO0FBRXJDLEVBQUEsT0FBT0ksT0FBTyxDQUFBO0FBQ2xCLENBQUE7QUFHQWhDLFlBQVksQ0FBQ1osWUFBWSxHQUFHQSxZQUFZLENBQUE7QUFDeENZLFlBQVksQ0FBQ0Usb0JBQW9CLEdBQUdBLG9CQUFvQjs7OzsifQ==