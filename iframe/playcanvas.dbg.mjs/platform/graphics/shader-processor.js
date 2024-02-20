import { Debug } from '../../core/debug.js';
import { uniformTypeToName, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH, semanticToLocation, TYPE_FLOAT32, TYPE_FLOAT16, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_2D_ARRAY, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, TYPE_INT8, TYPE_INT16, TYPE_INT32 } from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { BindBufferFormat, BindTextureFormat, BindGroupFormat } from './bind-group-format.js';

// accepted keywords
// TODO: 'out' keyword is not in the list, as handling it is more complicated due
// to 'out' keyword also being used to mark output only function parameters.
const KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\buniform\b)/g;

// match 'attribute' and anything else till ';'
const KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)([;]+)/g;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

// an array identifier, for example 'data[4]' - group 1 is 'data', group 2 is everything in brackets: '4'
const ARRAY_IDENTIFIER = /([\w-]+)\[(.*?)\]/;
const precisionQualifiers = new Set(['highp', 'mediump', 'lowp']);
const shadowSamplers = new Set(['sampler2DShadow', 'samplerCubeShadow', 'sampler2DArrayShadow']);
const textureDimensions = {
  sampler2D: TEXTUREDIMENSION_2D,
  sampler3D: TEXTUREDIMENSION_3D,
  samplerCube: TEXTUREDIMENSION_CUBE,
  samplerCubeShadow: TEXTUREDIMENSION_CUBE,
  sampler2DShadow: TEXTUREDIMENSION_2D,
  sampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
  sampler2DArrayShadow: TEXTUREDIMENSION_2D_ARRAY,
  isampler2D: TEXTUREDIMENSION_2D,
  usampler2D: TEXTUREDIMENSION_2D,
  isampler3D: TEXTUREDIMENSION_3D,
  usampler3D: TEXTUREDIMENSION_3D,
  isamplerCube: TEXTUREDIMENSION_CUBE,
  usamplerCube: TEXTUREDIMENSION_CUBE,
  isampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
  usampler2DArray: TEXTUREDIMENSION_2D_ARRAY
};
class UniformLine {
  constructor(line, shader) {
    // example: `lowp vec4 tints[2 * 4]`
    this.line = line;

    // split to words handling any number of spaces
    const words = line.trim().split(/\s+/);

    // optional precision
    if (precisionQualifiers.has(words[0])) {
      this.precision = words.shift();
    }

    // type
    this.type = words.shift();
    if (line.includes(',')) {
      Debug.error(`A comma on a uniform line is not supported, split it into multiple uniforms: ${line}`, shader);
    }

    // array of uniforms
    if (line.includes('[')) {
      const rest = words.join(' ');
      const match = ARRAY_IDENTIFIER.exec(rest);
      Debug.assert(match);
      this.name = match[1];
      this.arraySize = Number(match[2]);
      if (isNaN(this.arraySize)) {
        shader.failed = true;
        Debug.error(`Only numerically specified uniform array sizes are supported, this uniform is not supported: '${line}'`, shader);
      }
    } else {
      // simple uniform
      this.name = words.shift();
      this.arraySize = 0;
    }
    this.isSampler = this.type.indexOf('sampler') !== -1;
    this.isSignedInt = this.type.indexOf('isampler') !== -1;
    this.isUnsignedInt = this.type.indexOf('usampler') !== -1;
  }
}

/**
 * Pure static class implementing processing of GLSL shaders. It allocates fixed locations for
 * attributes, and handles conversion of uniforms to uniform buffers.
 *
 * @ignore
 */
class ShaderProcessor {
  /**
   * Process the shader.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {object} shaderDefinition - The shader definition.
   * @param {import('./shader.js').Shader} shader - The shader definition.
   * @returns {object} - The processed shader data.
   */
  static run(device, shaderDefinition, shader) {
    /** @type {Map<string, number>} */
    const varyingMap = new Map();

    // extract lines of interests from both shaders
    const vertexExtracted = ShaderProcessor.extract(shaderDefinition.vshader);
    const fragmentExtracted = ShaderProcessor.extract(shaderDefinition.fshader);

    // VS - convert a list of attributes to a shader block with fixed locations
    const attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);

    // VS - convert a list of varyings to a shader block
    const vertexVaryingsBlock = ShaderProcessor.processVaryings(vertexExtracted.varyings, varyingMap, true);

    // FS - convert a list of varyings to a shader block
    const fragmentVaryingsBlock = ShaderProcessor.processVaryings(fragmentExtracted.varyings, varyingMap, false);

    // FS - convert a list of outputs to a shader block
    const outBlock = ShaderProcessor.processOuts(fragmentExtracted.outs);

    // uniforms - merge vertex and fragment uniforms, and create shared uniform buffers
    // Note that as both vertex and fragment can declare the same uniform, we need to remove duplicates
    const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
    const uniforms = Array.from(new Set(concatUniforms));

    // parse uniform lines
    const parsedUniforms = uniforms.map(line => new UniformLine(line, shader));

    // validation - as uniforms go to a shared uniform buffer, vertex and fragment versions need to match
    Debug.call(() => {
      const map = new Map();
      parsedUniforms.forEach(uni => {
        const existing = map.get(uni.name);
        Debug.assert(!existing, `Vertex and fragment shaders cannot use the same uniform name with different types: '${existing}' and '${uni.line}'`, shader);
        map.set(uni.name, uni.line);
      });
    });
    const uniformsData = ShaderProcessor.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);

    // VS - insert the blocks to the source
    const vBlock = attributesBlock + '\n' + vertexVaryingsBlock + '\n' + uniformsData.code;
    const vshader = vertexExtracted.src.replace(MARKER, vBlock);

    // FS - insert the blocks to the source
    const fBlock = fragmentVaryingsBlock + '\n' + outBlock + '\n' + uniformsData.code;
    const fshader = fragmentExtracted.src.replace(MARKER, fBlock);
    return {
      vshader: vshader,
      fshader: fshader,
      meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
      meshBindGroupFormat: uniformsData.meshBindGroupFormat
    };
  }

  // Extract required information from the shader source code.
  static extract(src) {
    // collected data
    const attributes = [];
    const varyings = [];
    const outs = [];
    const uniforms = [];

    // replacement marker - mark a first replacement place, this is where code
    // blocks are injected later
    let replacement = `${MARKER}\n`;

    // extract relevant parts of the shader
    let match;
    while ((match = KEYWORD.exec(src)) !== null) {
      const keyword = match[1];
      switch (keyword) {
        case 'attribute':
        case 'varying':
        case 'uniform':
        case 'out':
          {
            // read the line
            KEYWORD_LINE.lastIndex = match.index;
            const lineMatch = KEYWORD_LINE.exec(src);
            if (keyword === 'attribute') {
              attributes.push(lineMatch[2]);
            } else if (keyword === 'varying') {
              varyings.push(lineMatch[2]);
            } else if (keyword === 'out') {
              outs.push(lineMatch[2]);
            } else if (keyword === 'uniform') {
              uniforms.push(lineMatch[2]);
            }

            // cut it out
            src = ShaderProcessor.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
            KEYWORD.lastIndex = match.index + replacement.length;

            // only place a single replacement marker
            replacement = '';
            break;
          }
      }
    }
    return {
      src,
      attributes,
      varyings,
      outs,
      uniforms
    };
  }

  /**
   * Process the lines with uniforms. The function receives the lines containing all uniforms,
   * both numerical as well as textures/samplers. The function also receives the format of uniform
   * buffers (numerical) and bind groups (textures) for view and material level. All uniforms that
   * match any of those are ignored, as those would be supplied by view / material level buffers.
   * All leftover uniforms create uniform buffer and bind group for the mesh itself, containing
   * uniforms that change on the level of the mesh.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {Array<UniformLine>} uniforms - Lines containing uniforms.
   * @param {import('./shader-processor-options.js').ShaderProcessorOptions} processingOptions -
   * Uniform formats.
   * @param {import('./shader.js').Shader} shader - The shader definition.
   * @returns {object} - The uniform data. Returns a shader code block containing uniforms, to be
   * inserted into the shader, as well as generated uniform format structures for the mesh level.
   */
  static processUniforms(device, uniforms, processingOptions, shader) {
    // split uniform lines into samplers and the rest
    /** @type {Array<UniformLine>} */
    const uniformLinesSamplers = [];
    /** @type {Array<UniformLine>} */
    const uniformLinesNonSamplers = [];
    uniforms.forEach(uniform => {
      if (uniform.isSampler) {
        uniformLinesSamplers.push(uniform);
      } else {
        uniformLinesNonSamplers.push(uniform);
      }
    });

    // build mesh uniform buffer format
    const meshUniforms = [];
    uniformLinesNonSamplers.forEach(uniform => {
      // uniforms not already in supplied uniform buffers go to the mesh buffer
      if (!processingOptions.hasUniform(uniform.name)) {
        const uniformType = uniformTypeToName.indexOf(uniform.type);
        Debug.assert(uniformType >= 0, `Uniform type ${uniform.type} is not recognized on line [${uniform.line}]`);
        const uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
        Debug.assert(!uniformFormat.invalid, `Invalid uniform line: ${uniform.line}`, shader);
        meshUniforms.push(uniformFormat);
      }

      // validate types in else
    });

    const meshUniformBufferFormat = meshUniforms.length ? new UniformBufferFormat(device, meshUniforms) : null;

    // build mesh bind group format - start with uniform buffer
    const bufferFormats = [];
    if (meshUniformBufferFormat) {
      // TODO: we could optimize visibility to only stages that use any of the data
      bufferFormats.push(new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT));
    }

    // add textures uniforms
    const textureFormats = [];
    uniformLinesSamplers.forEach(uniform => {
      // unmatched texture uniforms go to mesh block
      if (!processingOptions.hasTexture(uniform.name)) {
        // sample type
        // WebGpu does not currently support filtered float format textures, and so we map them to unfilterable type
        // as we sample them without filtering anyways
        let sampleType = SAMPLETYPE_FLOAT;
        if (uniform.isSignedInt) {
          sampleType = SAMPLETYPE_INT;
        } else if (uniform.isUnsignedInt) {
          sampleType = SAMPLETYPE_UINT;
        } else {
          if (uniform.precision === 'highp') sampleType = SAMPLETYPE_UNFILTERABLE_FLOAT;
          if (shadowSamplers.has(uniform.type)) sampleType = SAMPLETYPE_DEPTH;
        }

        // dimension
        const dimension = textureDimensions[uniform.type];

        // TODO: we could optimize visibility to only stages that use any of the data
        textureFormats.push(new BindTextureFormat(uniform.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType));
      }

      // validate types in else
    });

    const meshBindGroupFormat = new BindGroupFormat(device, bufferFormats, textureFormats);

    // generate code for uniform buffers
    let code = '';
    processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
      if (format) {
        code += format.getShaderDeclaration(bindGroupIndex, 0);
      }
    });

    // and also for generated mesh format, which is at the slot 0 of the bind group
    if (meshUniformBufferFormat) {
      code += meshUniformBufferFormat.getShaderDeclaration(BINDGROUP_MESH, 0);
    }

    // generate code for textures
    processingOptions.bindGroupFormats.forEach((format, bindGroupIndex) => {
      if (format) {
        code += format.getShaderDeclarationTextures(bindGroupIndex);
      }
    });

    // and also for generated mesh format
    code += meshBindGroupFormat.getShaderDeclarationTextures(BINDGROUP_MESH);
    return {
      code,
      meshUniformBufferFormat,
      meshBindGroupFormat
    };
  }
  static processVaryings(varyingLines, varyingMap, isVertex) {
    let block = '';
    const op = isVertex ? 'out' : 'in';
    varyingLines.forEach((line, index) => {
      const words = ShaderProcessor.splitToWords(line);
      const type = words[0];
      const name = words[1];
      if (isVertex) {
        // store it in the map
        varyingMap.set(name, index);
      } else {
        Debug.assert(varyingMap.has(name), `Fragment shader requires varying [${name}] but vertex shader does not generate it.`);
        index = varyingMap.get(name);
      }

      // generates: 'layout(location = 0) in vec4 position;'
      block += `layout(location = ${index}) ${op} ${type} ${name};\n`;
    });
    return block;
  }
  static processOuts(outsLines) {
    let block = '';
    outsLines.forEach((line, index) => {
      // generates: 'layout(location = 0) out vec4 gl_FragColor;'
      block += `layout(location = ${index}) out ${line};\n`;
    });
    return block;
  }

  // extract count from type ('vec3' => 3, 'float' => 1)
  static getTypeCount(type) {
    const lastChar = type.substring(type.length - 1);
    const num = parseInt(lastChar, 10);
    return isNaN(num) ? 1 : num;
  }
  static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
    let block = '';
    const usedLocations = {};
    attributeLines.forEach(line => {
      const words = ShaderProcessor.splitToWords(line);
      let type = words[0];
      let name = words[1];
      if (shaderDefinitionAttributes.hasOwnProperty(name)) {
        const semantic = shaderDefinitionAttributes[name];
        const location = semanticToLocation[semantic];
        Debug.assert(!usedLocations.hasOwnProperty(location), `WARNING: Two vertex attributes are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
        usedLocations[location] = semantic;

        // if vertex format for this attribute is not of a float type, we need to adjust the attribute format, for example we convert
        //      attribute vec4 vertex_position;
        // to
        //      attribute ivec4 _private_vertex_position;
        //      vec4 vertex_position = vec4(_private_vertex_position);
        // Note that we skip normalized elements, as shader receives them as floats already.
        let copyCode;
        const element = processingOptions.getVertexElement(semantic);
        if (element) {
          const dataType = element.dataType;
          if (dataType !== TYPE_FLOAT32 && dataType !== TYPE_FLOAT16 && !element.normalize && !element.asInt) {
            const attribNumElements = ShaderProcessor.getTypeCount(type);
            const newName = `_private_${name}`;

            // second line of new code, copy private (u)int type into vec type
            copyCode = `vec${attribNumElements} ${name} = vec${attribNumElements}(${newName});\n`;
            name = newName;

            // new attribute type, based on the vertex format element type, example: vec3 -> ivec3
            const isSignedType = dataType === TYPE_INT8 || dataType === TYPE_INT16 || dataType === TYPE_INT32;
            if (attribNumElements === 1) {
              type = isSignedType ? 'int' : 'uint';
            } else {
              type = isSignedType ? `ivec${attribNumElements}` : `uvec${attribNumElements}`;
            }
          }
        }

        // generates: 'layout(location = 0) in vec4 position;'
        block += `layout(location = ${location}) in ${type} ${name};\n`;
        if (copyCode) {
          block += copyCode;
        }
      }
    });
    return block;
  }
  static splitToWords(line) {
    // remove any double spaces
    line = line.replace(/\s+/g, ' ').trim();
    return line.split(' ');
  }
  static cutOut(src, start, end, replacement) {
    return src.substring(0, start) + replacement + src.substring(end);
  }
}

export { ShaderProcessor };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLXByb2Nlc3Nvci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgQklOREdST1VQX01FU0gsIHVuaWZvcm1UeXBlVG9OYW1lLCBzZW1hbnRpY1RvTG9jYXRpb24sXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSxcbiAgICBTQU1QTEVUWVBFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRILCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLCBURVhUVVJFRElNRU5TSU9OX0NVQkUsIFRFWFRVUkVESU1FTlNJT05fM0QsXG4gICAgVFlQRV9GTE9BVDMyLCBUWVBFX0lOVDgsIFRZUEVfSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfRkxPQVQxNiwgU0FNUExFVFlQRV9JTlQsIFNBTVBMRVRZUEVfVUlOVFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtRm9ybWF0LCBVbmlmb3JtQnVmZmVyRm9ybWF0IH0gZnJvbSAnLi91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEdyb3VwRm9ybWF0LCBCaW5kQnVmZmVyRm9ybWF0LCBCaW5kVGV4dHVyZUZvcm1hdCB9IGZyb20gJy4vYmluZC1ncm91cC1mb3JtYXQuanMnO1xuXG4vLyBhY2NlcHRlZCBrZXl3b3Jkc1xuLy8gVE9ETzogJ291dCcga2V5d29yZCBpcyBub3QgaW4gdGhlIGxpc3QsIGFzIGhhbmRsaW5nIGl0IGlzIG1vcmUgY29tcGxpY2F0ZWQgZHVlXG4vLyB0byAnb3V0JyBrZXl3b3JkIGFsc28gYmVpbmcgdXNlZCB0byBtYXJrIG91dHB1dCBvbmx5IGZ1bmN0aW9uIHBhcmFtZXRlcnMuXG5jb25zdCBLRVlXT1JEID0gL1sgXFx0XSooXFxiYXR0cmlidXRlXFxifFxcYnZhcnlpbmdcXGJ8XFxidW5pZm9ybVxcYikvZztcblxuLy8gbWF0Y2ggJ2F0dHJpYnV0ZScgYW5kIGFueXRoaW5nIGVsc2UgdGlsbCAnOydcbmNvbnN0IEtFWVdPUkRfTElORSA9IC8oXFxiYXR0cmlidXRlXFxifFxcYnZhcnlpbmdcXGJ8XFxib3V0XFxifFxcYnVuaWZvcm1cXGIpWyBcXHRdKihbXjtdKykoWztdKykvZztcblxuLy8gbWFya2VyIGZvciBhIHBsYWNlIGluIHRoZSBzb3VyY2UgY29kZSB0byBiZSByZXBsYWNlZCBieSBjb2RlXG5jb25zdCBNQVJLRVIgPSAnQEBAJztcblxuLy8gYW4gYXJyYXkgaWRlbnRpZmllciwgZm9yIGV4YW1wbGUgJ2RhdGFbNF0nIC0gZ3JvdXAgMSBpcyAnZGF0YScsIGdyb3VwIDIgaXMgZXZlcnl0aGluZyBpbiBicmFja2V0czogJzQnXG5jb25zdCBBUlJBWV9JREVOVElGSUVSID0gLyhbXFx3LV0rKVxcWyguKj8pXFxdLztcblxuY29uc3QgcHJlY2lzaW9uUXVhbGlmaWVycyA9IG5ldyBTZXQoWydoaWdocCcsICdtZWRpdW1wJywgJ2xvd3AnXSk7XG5jb25zdCBzaGFkb3dTYW1wbGVycyA9IG5ldyBTZXQoWydzYW1wbGVyMkRTaGFkb3cnLCAnc2FtcGxlckN1YmVTaGFkb3cnLCAnc2FtcGxlcjJEQXJyYXlTaGFkb3cnXSk7XG5jb25zdCB0ZXh0dXJlRGltZW5zaW9ucyA9IHtcbiAgICBzYW1wbGVyMkQ6IFRFWFRVUkVESU1FTlNJT05fMkQsXG4gICAgc2FtcGxlcjNEOiBURVhUVVJFRElNRU5TSU9OXzNELFxuICAgIHNhbXBsZXJDdWJlOiBURVhUVVJFRElNRU5TSU9OX0NVQkUsXG4gICAgc2FtcGxlckN1YmVTaGFkb3c6IFRFWFRVUkVESU1FTlNJT05fQ1VCRSxcbiAgICBzYW1wbGVyMkRTaGFkb3c6IFRFWFRVUkVESU1FTlNJT05fMkQsXG4gICAgc2FtcGxlcjJEQXJyYXk6IFRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVksXG4gICAgc2FtcGxlcjJEQXJyYXlTaGFkb3c6IFRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVksXG4gICAgaXNhbXBsZXIyRDogVEVYVFVSRURJTUVOU0lPTl8yRCxcbiAgICB1c2FtcGxlcjJEOiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIGlzYW1wbGVyM0Q6IFRFWFRVUkVESU1FTlNJT05fM0QsXG4gICAgdXNhbXBsZXIzRDogVEVYVFVSRURJTUVOU0lPTl8zRCxcbiAgICBpc2FtcGxlckN1YmU6IFRFWFRVUkVESU1FTlNJT05fQ1VCRSxcbiAgICB1c2FtcGxlckN1YmU6IFRFWFRVUkVESU1FTlNJT05fQ1VCRSxcbiAgICBpc2FtcGxlcjJEQXJyYXk6IFRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVksXG4gICAgdXNhbXBsZXIyREFycmF5OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZXG59O1xuXG5jbGFzcyBVbmlmb3JtTGluZSB7XG4gICAgY29uc3RydWN0b3IobGluZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gZXhhbXBsZTogYGxvd3AgdmVjNCB0aW50c1syICogNF1gXG4gICAgICAgIHRoaXMubGluZSA9IGxpbmU7XG5cbiAgICAgICAgLy8gc3BsaXQgdG8gd29yZHMgaGFuZGxpbmcgYW55IG51bWJlciBvZiBzcGFjZXNcbiAgICAgICAgY29uc3Qgd29yZHMgPSBsaW5lLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICAgIC8vIG9wdGlvbmFsIHByZWNpc2lvblxuICAgICAgICBpZiAocHJlY2lzaW9uUXVhbGlmaWVycy5oYXMod29yZHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHdvcmRzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0eXBlXG4gICAgICAgIHRoaXMudHlwZSA9IHdvcmRzLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKGxpbmUuaW5jbHVkZXMoJywnKSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEEgY29tbWEgb24gYSB1bmlmb3JtIGxpbmUgaXMgbm90IHN1cHBvcnRlZCwgc3BsaXQgaXQgaW50byBtdWx0aXBsZSB1bmlmb3JtczogJHtsaW5lfWAsIHNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcnJheSBvZiB1bmlmb3Jtc1xuICAgICAgICBpZiAobGluZS5pbmNsdWRlcygnWycpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3QgPSB3b3Jkcy5qb2luKCcgJyk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IEFSUkFZX0lERU5USUZJRVIuZXhlYyhyZXN0KTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChtYXRjaCk7XG5cbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSBOdW1iZXIobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHRoaXMuYXJyYXlTaXplKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBPbmx5IG51bWVyaWNhbGx5IHNwZWNpZmllZCB1bmlmb3JtIGFycmF5IHNpemVzIGFyZSBzdXBwb3J0ZWQsIHRoaXMgdW5pZm9ybSBpcyBub3Qgc3VwcG9ydGVkOiAnJHtsaW5lfSdgLCBzaGFkZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIHNpbXBsZSB1bmlmb3JtXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB3b3Jkcy5zaGlmdCgpO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1NhbXBsZXIgPSB0aGlzLnR5cGUuaW5kZXhPZignc2FtcGxlcicpICE9PSAtMTtcbiAgICAgICAgdGhpcy5pc1NpZ25lZEludCA9IHRoaXMudHlwZS5pbmRleE9mKCdpc2FtcGxlcicpICE9PSAtMTtcbiAgICAgICAgdGhpcy5pc1Vuc2lnbmVkSW50ID0gdGhpcy50eXBlLmluZGV4T2YoJ3VzYW1wbGVyJykgIT09IC0xO1xuICAgIH1cbn1cblxuLyoqXG4gKiBQdXJlIHN0YXRpYyBjbGFzcyBpbXBsZW1lbnRpbmcgcHJvY2Vzc2luZyBvZiBHTFNMIHNoYWRlcnMuIEl0IGFsbG9jYXRlcyBmaXhlZCBsb2NhdGlvbnMgZm9yXG4gKiBhdHRyaWJ1dGVzLCBhbmQgaGFuZGxlcyBjb252ZXJzaW9uIG9mIHVuaWZvcm1zIHRvIHVuaWZvcm0gYnVmZmVycy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFNoYWRlclByb2Nlc3NvciB7XG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNoYWRlckRlZmluaXRpb24gLSBUaGUgc2hhZGVyIGRlZmluaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIGRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge29iamVjdH0gLSBUaGUgcHJvY2Vzc2VkIHNoYWRlciBkYXRhLlxuICAgICAqL1xuICAgIHN0YXRpYyBydW4oZGV2aWNlLCBzaGFkZXJEZWZpbml0aW9uLCBzaGFkZXIpIHtcblxuICAgICAgICAvKiogQHR5cGUge01hcDxzdHJpbmcsIG51bWJlcj59ICovXG4gICAgICAgIGNvbnN0IHZhcnlpbmdNYXAgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgLy8gZXh0cmFjdCBsaW5lcyBvZiBpbnRlcmVzdHMgZnJvbSBib3RoIHNoYWRlcnNcbiAgICAgICAgY29uc3QgdmVydGV4RXh0cmFjdGVkID0gU2hhZGVyUHJvY2Vzc29yLmV4dHJhY3Qoc2hhZGVyRGVmaW5pdGlvbi52c2hhZGVyKTtcbiAgICAgICAgY29uc3QgZnJhZ21lbnRFeHRyYWN0ZWQgPSBTaGFkZXJQcm9jZXNzb3IuZXh0cmFjdChzaGFkZXJEZWZpbml0aW9uLmZzaGFkZXIpO1xuXG4gICAgICAgIC8vIFZTIC0gY29udmVydCBhIGxpc3Qgb2YgYXR0cmlidXRlcyB0byBhIHNoYWRlciBibG9jayB3aXRoIGZpeGVkIGxvY2F0aW9uc1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzQmxvY2sgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc0F0dHJpYnV0ZXModmVydGV4RXh0cmFjdGVkLmF0dHJpYnV0ZXMsIHNoYWRlckRlZmluaXRpb24uYXR0cmlidXRlcywgc2hhZGVyRGVmaW5pdGlvbi5wcm9jZXNzaW5nT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVlMgLSBjb252ZXJ0IGEgbGlzdCBvZiB2YXJ5aW5ncyB0byBhIHNoYWRlciBibG9ja1xuICAgICAgICBjb25zdCB2ZXJ0ZXhWYXJ5aW5nc0Jsb2NrID0gU2hhZGVyUHJvY2Vzc29yLnByb2Nlc3NWYXJ5aW5ncyh2ZXJ0ZXhFeHRyYWN0ZWQudmFyeWluZ3MsIHZhcnlpbmdNYXAsIHRydWUpO1xuXG4gICAgICAgIC8vIEZTIC0gY29udmVydCBhIGxpc3Qgb2YgdmFyeWluZ3MgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3QgZnJhZ21lbnRWYXJ5aW5nc0Jsb2NrID0gU2hhZGVyUHJvY2Vzc29yLnByb2Nlc3NWYXJ5aW5ncyhmcmFnbWVudEV4dHJhY3RlZC52YXJ5aW5ncywgdmFyeWluZ01hcCwgZmFsc2UpO1xuXG4gICAgICAgIC8vIEZTIC0gY29udmVydCBhIGxpc3Qgb2Ygb3V0cHV0cyB0byBhIHNoYWRlciBibG9ja1xuICAgICAgICBjb25zdCBvdXRCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzT3V0cyhmcmFnbWVudEV4dHJhY3RlZC5vdXRzKTtcblxuICAgICAgICAvLyB1bmlmb3JtcyAtIG1lcmdlIHZlcnRleCBhbmQgZnJhZ21lbnQgdW5pZm9ybXMsIGFuZCBjcmVhdGUgc2hhcmVkIHVuaWZvcm0gYnVmZmVyc1xuICAgICAgICAvLyBOb3RlIHRoYXQgYXMgYm90aCB2ZXJ0ZXggYW5kIGZyYWdtZW50IGNhbiBkZWNsYXJlIHRoZSBzYW1lIHVuaWZvcm0sIHdlIG5lZWQgdG8gcmVtb3ZlIGR1cGxpY2F0ZXNcbiAgICAgICAgY29uc3QgY29uY2F0VW5pZm9ybXMgPSB2ZXJ0ZXhFeHRyYWN0ZWQudW5pZm9ybXMuY29uY2F0KGZyYWdtZW50RXh0cmFjdGVkLnVuaWZvcm1zKTtcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBBcnJheS5mcm9tKG5ldyBTZXQoY29uY2F0VW5pZm9ybXMpKTtcblxuICAgICAgICAvLyBwYXJzZSB1bmlmb3JtIGxpbmVzXG4gICAgICAgIGNvbnN0IHBhcnNlZFVuaWZvcm1zID0gdW5pZm9ybXMubWFwKGxpbmUgPT4gbmV3IFVuaWZvcm1MaW5lKGxpbmUsIHNoYWRlcikpO1xuXG4gICAgICAgIC8vIHZhbGlkYXRpb24gLSBhcyB1bmlmb3JtcyBnbyB0byBhIHNoYXJlZCB1bmlmb3JtIGJ1ZmZlciwgdmVydGV4IGFuZCBmcmFnbWVudCB2ZXJzaW9ucyBuZWVkIHRvIG1hdGNoXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgcGFyc2VkVW5pZm9ybXMuZm9yRWFjaCgodW5pKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KHVuaS5uYW1lKTtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoIWV4aXN0aW5nLCBgVmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzIGNhbm5vdCB1c2UgdGhlIHNhbWUgdW5pZm9ybSBuYW1lIHdpdGggZGlmZmVyZW50IHR5cGVzOiAnJHtleGlzdGluZ30nIGFuZCAnJHt1bmkubGluZX0nYCwgc2hhZGVyKTtcbiAgICAgICAgICAgICAgICBtYXAuc2V0KHVuaS5uYW1lLCB1bmkubGluZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zRGF0YSA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVW5pZm9ybXMoZGV2aWNlLCBwYXJzZWRVbmlmb3Jtcywgc2hhZGVyRGVmaW5pdGlvbi5wcm9jZXNzaW5nT3B0aW9ucywgc2hhZGVyKTtcblxuICAgICAgICAvLyBWUyAtIGluc2VydCB0aGUgYmxvY2tzIHRvIHRoZSBzb3VyY2VcbiAgICAgICAgY29uc3QgdkJsb2NrID0gYXR0cmlidXRlc0Jsb2NrICsgJ1xcbicgKyB2ZXJ0ZXhWYXJ5aW5nc0Jsb2NrICsgJ1xcbicgKyB1bmlmb3Jtc0RhdGEuY29kZTtcbiAgICAgICAgY29uc3QgdnNoYWRlciA9IHZlcnRleEV4dHJhY3RlZC5zcmMucmVwbGFjZShNQVJLRVIsIHZCbG9jayk7XG5cbiAgICAgICAgLy8gRlMgLSBpbnNlcnQgdGhlIGJsb2NrcyB0byB0aGUgc291cmNlXG4gICAgICAgIGNvbnN0IGZCbG9jayA9IGZyYWdtZW50VmFyeWluZ3NCbG9jayArICdcXG4nICsgb3V0QmxvY2sgKyAnXFxuJyArIHVuaWZvcm1zRGF0YS5jb2RlO1xuICAgICAgICBjb25zdCBmc2hhZGVyID0gZnJhZ21lbnRFeHRyYWN0ZWQuc3JjLnJlcGxhY2UoTUFSS0VSLCBmQmxvY2spO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2c2hhZGVyOiB2c2hhZGVyLFxuICAgICAgICAgICAgZnNoYWRlcjogZnNoYWRlcixcbiAgICAgICAgICAgIG1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0OiB1bmlmb3Jtc0RhdGEubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQsXG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwRm9ybWF0OiB1bmlmb3Jtc0RhdGEubWVzaEJpbmRHcm91cEZvcm1hdFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIEV4dHJhY3QgcmVxdWlyZWQgaW5mb3JtYXRpb24gZnJvbSB0aGUgc2hhZGVyIHNvdXJjZSBjb2RlLlxuICAgIHN0YXRpYyBleHRyYWN0KHNyYykge1xuXG4gICAgICAgIC8vIGNvbGxlY3RlZCBkYXRhXG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBbXTtcbiAgICAgICAgY29uc3QgdmFyeWluZ3MgPSBbXTtcbiAgICAgICAgY29uc3Qgb3V0cyA9IFtdO1xuICAgICAgICBjb25zdCB1bmlmb3JtcyA9IFtdO1xuXG4gICAgICAgIC8vIHJlcGxhY2VtZW50IG1hcmtlciAtIG1hcmsgYSBmaXJzdCByZXBsYWNlbWVudCBwbGFjZSwgdGhpcyBpcyB3aGVyZSBjb2RlXG4gICAgICAgIC8vIGJsb2NrcyBhcmUgaW5qZWN0ZWQgbGF0ZXJcbiAgICAgICAgbGV0IHJlcGxhY2VtZW50ID0gYCR7TUFSS0VSfVxcbmA7XG5cbiAgICAgICAgLy8gZXh0cmFjdCByZWxldmFudCBwYXJ0cyBvZiB0aGUgc2hhZGVyXG4gICAgICAgIGxldCBtYXRjaDtcbiAgICAgICAgd2hpbGUgKChtYXRjaCA9IEtFWVdPUkQuZXhlYyhzcmMpKSAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgICBjb25zdCBrZXl3b3JkID0gbWF0Y2hbMV07XG4gICAgICAgICAgICBzd2l0Y2ggKGtleXdvcmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdhdHRyaWJ1dGUnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3ZhcnlpbmcnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3VuaWZvcm0nOlxuICAgICAgICAgICAgICAgIGNhc2UgJ291dCc6IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZWFkIHRoZSBsaW5lXG4gICAgICAgICAgICAgICAgICAgIEtFWVdPUkRfTElORS5sYXN0SW5kZXggPSBtYXRjaC5pbmRleDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZU1hdGNoID0gS0VZV09SRF9MSU5FLmV4ZWMoc3JjKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5d29yZCA9PT0gJ2F0dHJpYnV0ZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMucHVzaChsaW5lTWF0Y2hbMl0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGtleXdvcmQgPT09ICd2YXJ5aW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyeWluZ3MucHVzaChsaW5lTWF0Y2hbMl0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGtleXdvcmQgPT09ICdvdXQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAndW5pZm9ybScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaWZvcm1zLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGN1dCBpdCBvdXRcbiAgICAgICAgICAgICAgICAgICAgc3JjID0gU2hhZGVyUHJvY2Vzc29yLmN1dE91dChzcmMsIG1hdGNoLmluZGV4LCBLRVlXT1JEX0xJTkUubGFzdEluZGV4LCByZXBsYWNlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIEtFWVdPUkQubGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyByZXBsYWNlbWVudC5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gb25seSBwbGFjZSBhIHNpbmdsZSByZXBsYWNlbWVudCBtYXJrZXJcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZW1lbnQgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNyYyxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMsXG4gICAgICAgICAgICB2YXJ5aW5ncyxcbiAgICAgICAgICAgIG91dHMsXG4gICAgICAgICAgICB1bmlmb3Jtc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIGxpbmVzIHdpdGggdW5pZm9ybXMuIFRoZSBmdW5jdGlvbiByZWNlaXZlcyB0aGUgbGluZXMgY29udGFpbmluZyBhbGwgdW5pZm9ybXMsXG4gICAgICogYm90aCBudW1lcmljYWwgYXMgd2VsbCBhcyB0ZXh0dXJlcy9zYW1wbGVycy4gVGhlIGZ1bmN0aW9uIGFsc28gcmVjZWl2ZXMgdGhlIGZvcm1hdCBvZiB1bmlmb3JtXG4gICAgICogYnVmZmVycyAobnVtZXJpY2FsKSBhbmQgYmluZCBncm91cHMgKHRleHR1cmVzKSBmb3IgdmlldyBhbmQgbWF0ZXJpYWwgbGV2ZWwuIEFsbCB1bmlmb3JtcyB0aGF0XG4gICAgICogbWF0Y2ggYW55IG9mIHRob3NlIGFyZSBpZ25vcmVkLCBhcyB0aG9zZSB3b3VsZCBiZSBzdXBwbGllZCBieSB2aWV3IC8gbWF0ZXJpYWwgbGV2ZWwgYnVmZmVycy5cbiAgICAgKiBBbGwgbGVmdG92ZXIgdW5pZm9ybXMgY3JlYXRlIHVuaWZvcm0gYnVmZmVyIGFuZCBiaW5kIGdyb3VwIGZvciB0aGUgbWVzaCBpdHNlbGYsIGNvbnRhaW5pbmdcbiAgICAgKiB1bmlmb3JtcyB0aGF0IGNoYW5nZSBvbiB0aGUgbGV2ZWwgb2YgdGhlIG1lc2guXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge0FycmF5PFVuaWZvcm1MaW5lPn0gdW5pZm9ybXMgLSBMaW5lcyBjb250YWluaW5nIHVuaWZvcm1zLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci1wcm9jZXNzb3Itb3B0aW9ucy5qcycpLlNoYWRlclByb2Nlc3Nvck9wdGlvbnN9IHByb2Nlc3NpbmdPcHRpb25zIC1cbiAgICAgKiBVbmlmb3JtIGZvcm1hdHMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIGRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge29iamVjdH0gLSBUaGUgdW5pZm9ybSBkYXRhLiBSZXR1cm5zIGEgc2hhZGVyIGNvZGUgYmxvY2sgY29udGFpbmluZyB1bmlmb3JtcywgdG8gYmVcbiAgICAgKiBpbnNlcnRlZCBpbnRvIHRoZSBzaGFkZXIsIGFzIHdlbGwgYXMgZ2VuZXJhdGVkIHVuaWZvcm0gZm9ybWF0IHN0cnVjdHVyZXMgZm9yIHRoZSBtZXNoIGxldmVsLlxuICAgICAqL1xuICAgIHN0YXRpYyBwcm9jZXNzVW5pZm9ybXMoZGV2aWNlLCB1bmlmb3JtcywgcHJvY2Vzc2luZ09wdGlvbnMsIHNoYWRlcikge1xuXG4gICAgICAgIC8vIHNwbGl0IHVuaWZvcm0gbGluZXMgaW50byBzYW1wbGVycyBhbmQgdGhlIHJlc3RcbiAgICAgICAgLyoqIEB0eXBlIHtBcnJheTxVbmlmb3JtTGluZT59ICovXG4gICAgICAgIGNvbnN0IHVuaWZvcm1MaW5lc1NhbXBsZXJzID0gW107XG4gICAgICAgIC8qKiBAdHlwZSB7QXJyYXk8VW5pZm9ybUxpbmU+fSAqL1xuICAgICAgICBjb25zdCB1bmlmb3JtTGluZXNOb25TYW1wbGVycyA9IFtdO1xuICAgICAgICB1bmlmb3Jtcy5mb3JFYWNoKCh1bmlmb3JtKSA9PiB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS5pc1NhbXBsZXIpIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtTGluZXNTYW1wbGVycy5wdXNoKHVuaWZvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtTGluZXNOb25TYW1wbGVycy5wdXNoKHVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBidWlsZCBtZXNoIHVuaWZvcm0gYnVmZmVyIGZvcm1hdFxuICAgICAgICBjb25zdCBtZXNoVW5pZm9ybXMgPSBbXTtcbiAgICAgICAgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMuZm9yRWFjaCgodW5pZm9ybSkgPT4ge1xuICAgICAgICAgICAgLy8gdW5pZm9ybXMgbm90IGFscmVhZHkgaW4gc3VwcGxpZWQgdW5pZm9ybSBidWZmZXJzIGdvIHRvIHRoZSBtZXNoIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKCFwcm9jZXNzaW5nT3B0aW9ucy5oYXNVbmlmb3JtKHVuaWZvcm0ubmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtVHlwZSA9IHVuaWZvcm1UeXBlVG9OYW1lLmluZGV4T2YodW5pZm9ybS50eXBlKTtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodW5pZm9ybVR5cGUgPj0gMCwgYFVuaWZvcm0gdHlwZSAke3VuaWZvcm0udHlwZX0gaXMgbm90IHJlY29nbml6ZWQgb24gbGluZSBbJHt1bmlmb3JtLmxpbmV9XWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUZvcm1hdCh1bmlmb3JtLm5hbWUsIHVuaWZvcm1UeXBlLCB1bmlmb3JtLmFycmF5U2l6ZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCF1bmlmb3JtRm9ybWF0LmludmFsaWQsIGBJbnZhbGlkIHVuaWZvcm0gbGluZTogJHt1bmlmb3JtLmxpbmV9YCwgc2hhZGVyKTtcbiAgICAgICAgICAgICAgICBtZXNoVW5pZm9ybXMucHVzaCh1bmlmb3JtRm9ybWF0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdmFsaWRhdGUgdHlwZXMgaW4gZWxzZVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCA9IG1lc2hVbmlmb3Jtcy5sZW5ndGggPyBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdChkZXZpY2UsIG1lc2hVbmlmb3JtcykgOiBudWxsO1xuXG4gICAgICAgIC8vIGJ1aWxkIG1lc2ggYmluZCBncm91cCBmb3JtYXQgLSBzdGFydCB3aXRoIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgIGNvbnN0IGJ1ZmZlckZvcm1hdHMgPSBbXTtcbiAgICAgICAgaWYgKG1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiB3ZSBjb3VsZCBvcHRpbWl6ZSB2aXNpYmlsaXR5IHRvIG9ubHkgc3RhZ2VzIHRoYXQgdXNlIGFueSBvZiB0aGUgZGF0YVxuICAgICAgICAgICAgYnVmZmVyRm9ybWF0cy5wdXNoKG5ldyBCaW5kQnVmZmVyRm9ybWF0KFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLCBTSEFERVJTVEFHRV9WRVJURVggfCBTSEFERVJTVEFHRV9GUkFHTUVOVCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIHRleHR1cmVzIHVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHRleHR1cmVGb3JtYXRzID0gW107XG4gICAgICAgIHVuaWZvcm1MaW5lc1NhbXBsZXJzLmZvckVhY2goKHVuaWZvcm0pID0+IHtcbiAgICAgICAgICAgIC8vIHVubWF0Y2hlZCB0ZXh0dXJlIHVuaWZvcm1zIGdvIHRvIG1lc2ggYmxvY2tcbiAgICAgICAgICAgIGlmICghcHJvY2Vzc2luZ09wdGlvbnMuaGFzVGV4dHVyZSh1bmlmb3JtLm5hbWUpKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBzYW1wbGUgdHlwZVxuICAgICAgICAgICAgICAgIC8vIFdlYkdwdSBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBmaWx0ZXJlZCBmbG9hdCBmb3JtYXQgdGV4dHVyZXMsIGFuZCBzbyB3ZSBtYXAgdGhlbSB0byB1bmZpbHRlcmFibGUgdHlwZVxuICAgICAgICAgICAgICAgIC8vIGFzIHdlIHNhbXBsZSB0aGVtIHdpdGhvdXQgZmlsdGVyaW5nIGFueXdheXNcbiAgICAgICAgICAgICAgICBsZXQgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfRkxPQVQ7XG4gICAgICAgICAgICAgICAgaWYgKHVuaWZvcm0uaXNTaWduZWRJbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfSU5UO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodW5pZm9ybS5pc1Vuc2lnbmVkSW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX1VJTlQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaWZvcm0ucHJlY2lzaW9uID09PSAnaGlnaHAnKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZG93U2FtcGxlcnMuaGFzKHVuaWZvcm0udHlwZSkpXG4gICAgICAgICAgICAgICAgICAgICAgICBzYW1wbGVUeXBlID0gU0FNUExFVFlQRV9ERVBUSDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBkaW1lbnNpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkaW1lbnNpb24gPSB0ZXh0dXJlRGltZW5zaW9uc1t1bmlmb3JtLnR5cGVdO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgICAgICB0ZXh0dXJlRm9ybWF0cy5wdXNoKG5ldyBCaW5kVGV4dHVyZUZvcm1hdCh1bmlmb3JtLm5hbWUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBkaW1lbnNpb24sIHNhbXBsZVR5cGUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdmFsaWRhdGUgdHlwZXMgaW4gZWxzZVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwRm9ybWF0ID0gbmV3IEJpbmRHcm91cEZvcm1hdChkZXZpY2UsIGJ1ZmZlckZvcm1hdHMsIHRleHR1cmVGb3JtYXRzKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBjb2RlIGZvciB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgbGV0IGNvZGUgPSAnJztcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMudW5pZm9ybUZvcm1hdHMuZm9yRWFjaCgoZm9ybWF0LCBiaW5kR3JvdXBJbmRleCkgPT4ge1xuICAgICAgICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gZm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uKGJpbmRHcm91cEluZGV4LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYW5kIGFsc28gZm9yIGdlbmVyYXRlZCBtZXNoIGZvcm1hdCwgd2hpY2ggaXMgYXQgdGhlIHNsb3QgMCBvZiB0aGUgYmluZCBncm91cFxuICAgICAgICBpZiAobWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb24oQklOREdST1VQX01FU0gsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgY29kZSBmb3IgdGV4dHVyZXNcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMuYmluZEdyb3VwRm9ybWF0cy5mb3JFYWNoKChmb3JtYXQsIGJpbmRHcm91cEluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBmb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyhiaW5kR3JvdXBJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFuZCBhbHNvIGZvciBnZW5lcmF0ZWQgbWVzaCBmb3JtYXRcbiAgICAgICAgY29kZSArPSBtZXNoQmluZEdyb3VwRm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uVGV4dHVyZXMoQklOREdST1VQX01FU0gpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQsXG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwRm9ybWF0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIHByb2Nlc3NWYXJ5aW5ncyh2YXJ5aW5nTGluZXMsIHZhcnlpbmdNYXAsIGlzVmVydGV4KSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCBvcCA9IGlzVmVydGV4ID8gJ291dCcgOiAnaW4nO1xuICAgICAgICB2YXJ5aW5nTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSB3b3Jkc1swXTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB3b3Jkc1sxXTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4KSB7XG4gICAgICAgICAgICAgICAgLy8gc3RvcmUgaXQgaW4gdGhlIG1hcFxuICAgICAgICAgICAgICAgIHZhcnlpbmdNYXAuc2V0KG5hbWUsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZhcnlpbmdNYXAuaGFzKG5hbWUpLCBgRnJhZ21lbnQgc2hhZGVyIHJlcXVpcmVzIHZhcnlpbmcgWyR7bmFtZX1dIGJ1dCB2ZXJ0ZXggc2hhZGVyIGRvZXMgbm90IGdlbmVyYXRlIGl0LmApO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdmFyeWluZ01hcC5nZXQobmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgYmxvY2sgKz0gYGxheW91dChsb2NhdGlvbiA9ICR7aW5kZXh9KSAke29wfSAke3R5cGV9ICR7bmFtZX07XFxuYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgcHJvY2Vzc091dHMob3V0c0xpbmVzKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBvdXRzTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIG91dCB2ZWM0IGdsX0ZyYWdDb2xvcjsnXG4gICAgICAgICAgICBibG9jayArPSBgbGF5b3V0KGxvY2F0aW9uID0gJHtpbmRleH0pIG91dCAke2xpbmV9O1xcbmA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCBjb3VudCBmcm9tIHR5cGUgKCd2ZWMzJyA9PiAzLCAnZmxvYXQnID0+IDEpXG4gICAgc3RhdGljIGdldFR5cGVDb3VudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGxhc3RDaGFyID0gdHlwZS5zdWJzdHJpbmcodHlwZS5sZW5ndGggLSAxKTtcbiAgICAgICAgY29uc3QgbnVtID0gcGFyc2VJbnQobGFzdENoYXIsIDEwKTtcbiAgICAgICAgcmV0dXJuIGlzTmFOKG51bSkgPyAxIDogbnVtO1xuICAgIH1cblxuICAgIHN0YXRpYyBwcm9jZXNzQXR0cmlidXRlcyhhdHRyaWJ1dGVMaW5lcywgc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCB1c2VkTG9jYXRpb25zID0ge307XG4gICAgICAgIGF0dHJpYnV0ZUxpbmVzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGxldCB0eXBlID0gd29yZHNbMF07XG4gICAgICAgICAgICBsZXQgbmFtZSA9IHdvcmRzWzFdO1xuXG4gICAgICAgICAgICBpZiAoc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IHNoYWRlckRlZmluaXRpb25BdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gc2VtYW50aWNUb0xvY2F0aW9uW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdXNlZExvY2F0aW9ucy5oYXNPd25Qcm9wZXJ0eShsb2NhdGlvbiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBXQVJOSU5HOiBUd28gdmVydGV4IGF0dHJpYnV0ZXMgYXJlIG1hcHBlZCB0byB0aGUgc2FtZSBsb2NhdGlvbiBpbiBhIHNoYWRlcjogJHt1c2VkTG9jYXRpb25zW2xvY2F0aW9uXX0gYW5kICR7c2VtYW50aWN9YCk7XG4gICAgICAgICAgICAgICAgdXNlZExvY2F0aW9uc1tsb2NhdGlvbl0gPSBzZW1hbnRpYztcblxuICAgICAgICAgICAgICAgIC8vIGlmIHZlcnRleCBmb3JtYXQgZm9yIHRoaXMgYXR0cmlidXRlIGlzIG5vdCBvZiBhIGZsb2F0IHR5cGUsIHdlIG5lZWQgdG8gYWRqdXN0IHRoZSBhdHRyaWJ1dGUgZm9ybWF0LCBmb3IgZXhhbXBsZSB3ZSBjb252ZXJ0XG4gICAgICAgICAgICAgICAgLy8gICAgICBhdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gdG9cbiAgICAgICAgICAgICAgICAvLyAgICAgIGF0dHJpYnV0ZSBpdmVjNCBfcHJpdmF0ZV92ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gICAgICB2ZWM0IHZlcnRleF9wb3NpdGlvbiA9IHZlYzQoX3ByaXZhdGVfdmVydGV4X3Bvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAvLyBOb3RlIHRoYXQgd2Ugc2tpcCBub3JtYWxpemVkIGVsZW1lbnRzLCBhcyBzaGFkZXIgcmVjZWl2ZXMgdGhlbSBhcyBmbG9hdHMgYWxyZWFkeS5cbiAgICAgICAgICAgICAgICBsZXQgY29weUNvZGU7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHByb2Nlc3NpbmdPcHRpb25zLmdldFZlcnRleEVsZW1lbnQoc2VtYW50aWMpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFUeXBlID0gZWxlbWVudC5kYXRhVHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFUeXBlICE9PSBUWVBFX0ZMT0FUMzIgJiYgZGF0YVR5cGUgIT09IFRZUEVfRkxPQVQxNiAmJiAhZWxlbWVudC5ub3JtYWxpemUgJiYgIWVsZW1lbnQuYXNJbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXR0cmliTnVtRWxlbWVudHMgPSBTaGFkZXJQcm9jZXNzb3IuZ2V0VHlwZUNvdW50KHR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3TmFtZSA9IGBfcHJpdmF0ZV8ke25hbWV9YDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2Vjb25kIGxpbmUgb2YgbmV3IGNvZGUsIGNvcHkgcHJpdmF0ZSAodSlpbnQgdHlwZSBpbnRvIHZlYyB0eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3B5Q29kZSA9IGB2ZWMke2F0dHJpYk51bUVsZW1lbnRzfSAke25hbWV9ID0gdmVjJHthdHRyaWJOdW1FbGVtZW50c30oJHtuZXdOYW1lfSk7XFxuYDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG5ld05hbWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5ldyBhdHRyaWJ1dGUgdHlwZSwgYmFzZWQgb24gdGhlIHZlcnRleCBmb3JtYXQgZWxlbWVudCB0eXBlLCBleGFtcGxlOiB2ZWMzIC0+IGl2ZWMzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NpZ25lZFR5cGUgPSBkYXRhVHlwZSA9PT0gVFlQRV9JTlQ4IHx8IGRhdGFUeXBlID09PSBUWVBFX0lOVDE2IHx8IGRhdGFUeXBlID09PSBUWVBFX0lOVDMyO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYk51bUVsZW1lbnRzID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IGlzU2lnbmVkVHlwZSA/ICdpbnQnIDogJ3VpbnQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gaXNTaWduZWRUeXBlID8gYGl2ZWMke2F0dHJpYk51bUVsZW1lbnRzfWAgOiBgdXZlYyR7YXR0cmliTnVtRWxlbWVudHN9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgICAgIGJsb2NrICs9IGBsYXlvdXQobG9jYXRpb24gPSAke2xvY2F0aW9ufSkgaW4gJHt0eXBlfSAke25hbWV9O1xcbmA7XG5cbiAgICAgICAgICAgICAgICBpZiAoY29weUNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2sgKz0gY29weUNvZGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJsb2NrO1xuICAgIH1cblxuICAgIHN0YXRpYyBzcGxpdFRvV29yZHMobGluZSkge1xuICAgICAgICAvLyByZW1vdmUgYW55IGRvdWJsZSBzcGFjZXNcbiAgICAgICAgbGluZSA9IGxpbmUucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGxpbmUuc3BsaXQoJyAnKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3V0T3V0KHNyYywgc3RhcnQsIGVuZCwgcmVwbGFjZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIHNyYy5zdWJzdHJpbmcoMCwgc3RhcnQpICsgcmVwbGFjZW1lbnQgKyBzcmMuc3Vic3RyaW5nKGVuZCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkZXJQcm9jZXNzb3IgfTtcbiJdLCJuYW1lcyI6WyJLRVlXT1JEIiwiS0VZV09SRF9MSU5FIiwiTUFSS0VSIiwiQVJSQVlfSURFTlRJRklFUiIsInByZWNpc2lvblF1YWxpZmllcnMiLCJTZXQiLCJzaGFkb3dTYW1wbGVycyIsInRleHR1cmVEaW1lbnNpb25zIiwic2FtcGxlcjJEIiwiVEVYVFVSRURJTUVOU0lPTl8yRCIsInNhbXBsZXIzRCIsIlRFWFRVUkVESU1FTlNJT05fM0QiLCJzYW1wbGVyQ3ViZSIsIlRFWFRVUkVESU1FTlNJT05fQ1VCRSIsInNhbXBsZXJDdWJlU2hhZG93Iiwic2FtcGxlcjJEU2hhZG93Iiwic2FtcGxlcjJEQXJyYXkiLCJURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZIiwic2FtcGxlcjJEQXJyYXlTaGFkb3ciLCJpc2FtcGxlcjJEIiwidXNhbXBsZXIyRCIsImlzYW1wbGVyM0QiLCJ1c2FtcGxlcjNEIiwiaXNhbXBsZXJDdWJlIiwidXNhbXBsZXJDdWJlIiwiaXNhbXBsZXIyREFycmF5IiwidXNhbXBsZXIyREFycmF5IiwiVW5pZm9ybUxpbmUiLCJjb25zdHJ1Y3RvciIsImxpbmUiLCJzaGFkZXIiLCJ3b3JkcyIsInRyaW0iLCJzcGxpdCIsImhhcyIsInByZWNpc2lvbiIsInNoaWZ0IiwidHlwZSIsImluY2x1ZGVzIiwiRGVidWciLCJlcnJvciIsInJlc3QiLCJqb2luIiwibWF0Y2giLCJleGVjIiwiYXNzZXJ0IiwibmFtZSIsImFycmF5U2l6ZSIsIk51bWJlciIsImlzTmFOIiwiZmFpbGVkIiwiaXNTYW1wbGVyIiwiaW5kZXhPZiIsImlzU2lnbmVkSW50IiwiaXNVbnNpZ25lZEludCIsIlNoYWRlclByb2Nlc3NvciIsInJ1biIsImRldmljZSIsInNoYWRlckRlZmluaXRpb24iLCJ2YXJ5aW5nTWFwIiwiTWFwIiwidmVydGV4RXh0cmFjdGVkIiwiZXh0cmFjdCIsInZzaGFkZXIiLCJmcmFnbWVudEV4dHJhY3RlZCIsImZzaGFkZXIiLCJhdHRyaWJ1dGVzQmxvY2siLCJwcm9jZXNzQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJwcm9jZXNzaW5nT3B0aW9ucyIsInZlcnRleFZhcnlpbmdzQmxvY2siLCJwcm9jZXNzVmFyeWluZ3MiLCJ2YXJ5aW5ncyIsImZyYWdtZW50VmFyeWluZ3NCbG9jayIsIm91dEJsb2NrIiwicHJvY2Vzc091dHMiLCJvdXRzIiwiY29uY2F0VW5pZm9ybXMiLCJ1bmlmb3JtcyIsImNvbmNhdCIsIkFycmF5IiwiZnJvbSIsInBhcnNlZFVuaWZvcm1zIiwibWFwIiwiY2FsbCIsImZvckVhY2giLCJ1bmkiLCJleGlzdGluZyIsImdldCIsInNldCIsInVuaWZvcm1zRGF0YSIsInByb2Nlc3NVbmlmb3JtcyIsInZCbG9jayIsImNvZGUiLCJzcmMiLCJyZXBsYWNlIiwiZkJsb2NrIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwicmVwbGFjZW1lbnQiLCJrZXl3b3JkIiwibGFzdEluZGV4IiwiaW5kZXgiLCJsaW5lTWF0Y2giLCJwdXNoIiwiY3V0T3V0IiwibGVuZ3RoIiwidW5pZm9ybUxpbmVzU2FtcGxlcnMiLCJ1bmlmb3JtTGluZXNOb25TYW1wbGVycyIsInVuaWZvcm0iLCJtZXNoVW5pZm9ybXMiLCJoYXNVbmlmb3JtIiwidW5pZm9ybVR5cGUiLCJ1bmlmb3JtVHlwZVRvTmFtZSIsInVuaWZvcm1Gb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiaW52YWxpZCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJidWZmZXJGb3JtYXRzIiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJ0ZXh0dXJlRm9ybWF0cyIsImhhc1RleHR1cmUiLCJzYW1wbGVUeXBlIiwiU0FNUExFVFlQRV9GTE9BVCIsIlNBTVBMRVRZUEVfSU5UIiwiU0FNUExFVFlQRV9VSU5UIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJTQU1QTEVUWVBFX0RFUFRIIiwiZGltZW5zaW9uIiwiQmluZFRleHR1cmVGb3JtYXQiLCJCaW5kR3JvdXBGb3JtYXQiLCJ1bmlmb3JtRm9ybWF0cyIsImZvcm1hdCIsImJpbmRHcm91cEluZGV4IiwiZ2V0U2hhZGVyRGVjbGFyYXRpb24iLCJCSU5ER1JPVVBfTUVTSCIsImJpbmRHcm91cEZvcm1hdHMiLCJnZXRTaGFkZXJEZWNsYXJhdGlvblRleHR1cmVzIiwidmFyeWluZ0xpbmVzIiwiaXNWZXJ0ZXgiLCJibG9jayIsIm9wIiwic3BsaXRUb1dvcmRzIiwib3V0c0xpbmVzIiwiZ2V0VHlwZUNvdW50IiwibGFzdENoYXIiLCJzdWJzdHJpbmciLCJudW0iLCJwYXJzZUludCIsImF0dHJpYnV0ZUxpbmVzIiwic2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMiLCJ1c2VkTG9jYXRpb25zIiwiaGFzT3duUHJvcGVydHkiLCJzZW1hbnRpYyIsImxvY2F0aW9uIiwic2VtYW50aWNUb0xvY2F0aW9uIiwiY29weUNvZGUiLCJlbGVtZW50IiwiZ2V0VmVydGV4RWxlbWVudCIsImRhdGFUeXBlIiwiVFlQRV9GTE9BVDMyIiwiVFlQRV9GTE9BVDE2Iiwibm9ybWFsaXplIiwiYXNJbnQiLCJhdHRyaWJOdW1FbGVtZW50cyIsIm5ld05hbWUiLCJpc1NpZ25lZFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX0lOVDE2IiwiVFlQRV9JTlQzMiIsInN0YXJ0IiwiZW5kIl0sIm1hcHBpbmdzIjoiOzs7OztBQVlBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLE9BQU8sR0FBRyxnREFBZ0QsQ0FBQTs7QUFFaEU7QUFDQSxNQUFNQyxZQUFZLEdBQUcscUVBQXFFLENBQUE7O0FBRTFGO0FBQ0EsTUFBTUMsTUFBTSxHQUFHLEtBQUssQ0FBQTs7QUFFcEI7QUFDQSxNQUFNQyxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQTtBQUU1QyxNQUFNQyxtQkFBbUIsR0FBRyxJQUFJQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDakUsTUFBTUMsY0FBYyxHQUFHLElBQUlELEdBQUcsQ0FBQyxDQUFDLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQTtBQUNoRyxNQUFNRSxpQkFBaUIsR0FBRztBQUN0QkMsRUFBQUEsU0FBUyxFQUFFQyxtQkFBbUI7QUFDOUJDLEVBQUFBLFNBQVMsRUFBRUMsbUJBQW1CO0FBQzlCQyxFQUFBQSxXQUFXLEVBQUVDLHFCQUFxQjtBQUNsQ0MsRUFBQUEsaUJBQWlCLEVBQUVELHFCQUFxQjtBQUN4Q0UsRUFBQUEsZUFBZSxFQUFFTixtQkFBbUI7QUFDcENPLEVBQUFBLGNBQWMsRUFBRUMseUJBQXlCO0FBQ3pDQyxFQUFBQSxvQkFBb0IsRUFBRUQseUJBQXlCO0FBQy9DRSxFQUFBQSxVQUFVLEVBQUVWLG1CQUFtQjtBQUMvQlcsRUFBQUEsVUFBVSxFQUFFWCxtQkFBbUI7QUFDL0JZLEVBQUFBLFVBQVUsRUFBRVYsbUJBQW1CO0FBQy9C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
