import { Debug } from '../../../core/debug.js';
import { TRACEID_SHADER_COMPILE } from '../../../core/constants.js';
import { now } from '../../../core/time.js';
import { WebglShaderInput } from './webgl-shader-input.js';
import { semanticToLocation, SHADERTAG_MATERIAL } from '../constants.js';
import { DeviceCache } from '../device-cache.js';

let _totalCompileTime = 0;
const _vertexShaderBuiltins = ['gl_VertexID', 'gl_InstanceID', 'gl_DrawID', 'gl_BaseVertex', 'gl_BaseInstance'];

// class used to hold compiled WebGL vertex or fragment shaders in the device cache
class CompiledShaderCache {
  constructor() {
    // maps shader source to a compiled WebGL shader
    this.map = new Map();
  }
  // destroy all created shaders when the device is destroyed
  destroy(device) {
    this.map.forEach(shader => {
      device.gl.deleteShader(shader);
    });
  }

  // just empty the cache when the context is lost
  loseContext(device) {
    this.map.clear();
  }
}

// class used to hold a list of recently created shaders forming a batch, to allow their more optimized compilation
class ShaderBatchCache {
  constructor() {
    this.shaders = [];
  }
  loseContext(device) {
    this.shaders = [];
  }
}
const _vertexShaderCache = new DeviceCache();
const _fragmentShaderCache = new DeviceCache();
const _shaderBatchCache = new DeviceCache();

/**
 * A WebGL implementation of the Shader.
 *
 * @ignore
 */
class WebglShader {
  constructor(shader) {
    this.compileDuration = 0;
    this.init();

    // kick off vertex and fragment shader compilation, but not linking here, as that would
    // make it blocking.
    this.compile(shader.device, shader);

    // add the shader to recently created list
    WebglShader.getBatchShaders(shader.device).push(shader);

    // add it to a device list of all shaders
    shader.device.shaders.push(shader);
  }

  /**
   * Free the WebGL resources associated with a shader.
   *
   * @param {import('../shader.js').Shader} shader - The shader to free.
   */
  destroy(shader) {
    if (this.glProgram) {
      shader.device.gl.deleteProgram(this.glProgram);
      this.glProgram = null;
    }
  }
  init() {
    this.uniforms = [];
    this.samplers = [];
    this.attributes = [];
    this.glProgram = null;
    this.glVertexShader = null;
    this.glFragmentShader = null;
  }
  static getBatchShaders(device) {
    const batchCache = _shaderBatchCache.get(device, () => {
      return new ShaderBatchCache();
    });
    return batchCache.shaders;
  }
  static endShaderBatch(device) {
    // Trigger link step for all recently created shaders. This allows linking to be done in parallel, before
    // the blocking wait on the linking result is triggered in finalize function
    const shaders = WebglShader.getBatchShaders(device);
    shaders.forEach(shader => shader.impl.link(device, shader));
    shaders.length = 0;
  }

  /**
   * Dispose the shader when the context has been lost.
   */
  loseContext() {
    this.init();
  }

  /**
   * Restore shader after the context has been obtained.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to restore.
   */
  restoreContext(device, shader) {
    this.compile(device, shader);
  }

  /**
   * Compile shader programs.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to compile.
   */
  compile(device, shader) {
    const definition = shader.definition;
    this.glVertexShader = this._compileShaderSource(device, definition.vshader, true);
    this.glFragmentShader = this._compileShaderSource(device, definition.fshader, false);
  }

  /**
   * Link shader programs. This is called at a later stage, to allow many shaders to compile in parallel.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to compile.
   */
  link(device, shader) {
    // if the shader was already linked
    if (this.glProgram) return;

    // if the device is lost, silently ignore
    const gl = device.gl;
    if (gl.isContextLost()) {
      return;
    }
    let startTime = 0;
    Debug.call(() => {
      this.compileDuration = 0;
      startTime = now();
    });
    const glProgram = gl.createProgram();
    this.glProgram = glProgram;
    gl.attachShader(glProgram, this.glVertexShader);
    gl.attachShader(glProgram, this.glFragmentShader);
    const definition = shader.definition;
    const attrs = definition.attributes;
    if (device.isWebGL2 && definition.useTransformFeedback) {
      // Collect all "out_" attributes and use them for output
      const outNames = [];
      for (const attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          outNames.push("out_" + attr);
        }
      }
      gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
    }

    // map all vertex input attributes to fixed locations
    const locations = {};
    for (const attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        const semantic = attrs[attr];
        const loc = semanticToLocation[semantic];
        Debug.assert(!locations.hasOwnProperty(loc), `WARNING: Two attributes are mapped to the same location in a shader: ${locations[loc]} and ${attr}`);
        locations[loc] = attr;
        gl.bindAttribLocation(glProgram, loc, attr);
      }
    }
    gl.linkProgram(glProgram);
    Debug.call(() => {
      this.compileDuration = now() - startTime;
    });
    device._shaderStats.linked++;
    if (definition.tag === SHADERTAG_MATERIAL) {
      device._shaderStats.materialShaders++;
    }
  }

  /**
   * Compiles an individual shader.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {string} src - The shader source code.
   * @param {boolean} isVertexShader - True if the shader is a vertex shader, false if it is a
   * fragment shader.
   * @returns {WebGLShader} The compiled shader.
   * @private
   */
  _compileShaderSource(device, src, isVertexShader) {
    const gl = device.gl;

    // device cache for current device, containing cache of compiled shaders
    const shaderDeviceCache = isVertexShader ? _vertexShaderCache : _fragmentShaderCache;
    const shaderCache = shaderDeviceCache.get(device, () => {
      return new CompiledShaderCache();
    });

    // try to get compiled shader from the cache
    let glShader = shaderCache.map.get(src);
    if (!glShader) {
      const startTime = now();
      device.fire('shader:compile:start', {
        timestamp: startTime,
        target: device
      });
      glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);

      // if the device is lost, silently ignore
      if (!glShader && gl.isContextLost()) {
        return glShader;
      }
      gl.shaderSource(glShader, src);
      gl.compileShader(glShader);
      shaderCache.map.set(src, glShader);
      const endTime = now();
      device.fire('shader:compile:end', {
        timestamp: endTime,
        target: device
      });
      device._shaderStats.compileTime += endTime - startTime;
      if (isVertexShader) {
        device._shaderStats.vsCompiled++;
      } else {
        device._shaderStats.fsCompiled++;
      }
    }
    return glShader;
  }

  /**
   * Link the shader, and extract its attributes and uniform information.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to query.
   * @returns {boolean} True if the shader was successfully queried and false otherwise.
   */
  finalize(device, shader) {
    // if the device is lost, silently ignore
    const gl = device.gl;
    if (gl.isContextLost()) {
      return true;
    }

    // if the program wasn't linked yet (shader was not created in batch)
    if (!this.glProgram) this.link(device, shader);
    const glProgram = this.glProgram;
    const definition = shader.definition;
    const startTime = now();
    device.fire('shader:link:start', {
      timestamp: startTime,
      target: device
    });

    // this is the main thead blocking part of the shader compilation, time it
    let linkStartTime = 0;
    Debug.call(() => {
      linkStartTime = now();
    });
    const linkStatus = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
    if (!linkStatus) {
      var _gl$getExtension, _gl$getExtension2;
      // Check for compilation errors
      if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, "vertex")) return false;
      if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, "fragment")) return false;
      const message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);

      // log translated shaders
      definition.translatedFrag = (_gl$getExtension = gl.getExtension('WEBGL_debug_shaders')) == null ? void 0 : _gl$getExtension.getTranslatedShaderSource(this.glFragmentShader);
      definition.translatedVert = (_gl$getExtension2 = gl.getExtension('WEBGL_debug_shaders')) == null ? void 0 : _gl$getExtension2.getTranslatedShaderSource(this.glVertexShader);
      console.error(message, definition);
      return false;
    }

    // Query the program for each vertex buffer input (GLSL 'attribute')
    let i = 0;
    const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
    while (i < numAttributes) {
      const info = gl.getActiveAttrib(glProgram, i++);
      const location = gl.getAttribLocation(glProgram, info.name);

      // a built-in attributes for which we do not need to provide any data
      if (_vertexShaderBuiltins.indexOf(info.name) !== -1) continue;

      // Check attributes are correctly linked up
      if (definition.attributes[info.name] === undefined) {
        console.error(`Vertex shader attribute "${info.name}" is not mapped to a semantic in shader definition, shader [${shader.label}]`, shader);
        shader.failed = true;
      } else {
        const shaderInput = new WebglShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
        this.attributes.push(shaderInput);
      }
    }

    // Query the program for each shader state (GLSL 'uniform')
    i = 0;
    const numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
    while (i < numUniforms) {
      const info = gl.getActiveUniform(glProgram, i++);
      const location = gl.getUniformLocation(glProgram, info.name);
      const shaderInput = new WebglShaderInput(device, info.name, device.pcUniformType[info.type], location);
      if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE || device.isWebGL2 && (info.type === gl.UNSIGNED_INT_SAMPLER_2D || info.type === gl.INT_SAMPLER_2D || info.type === gl.SAMPLER_2D_SHADOW || info.type === gl.SAMPLER_CUBE_SHADOW || info.type === gl.SAMPLER_3D || info.type === gl.INT_SAMPLER_3D || info.type === gl.UNSIGNED_INT_SAMPLER_3D || info.type === gl.SAMPLER_2D_ARRAY || info.type === gl.INT_SAMPLER_2D_ARRAY || info.type === gl.UNSIGNED_INT_SAMPLER_2D_ARRAY)) {
        this.samplers.push(shaderInput);
      } else {
        this.uniforms.push(shaderInput);
      }
    }
    shader.ready = true;
    const endTime = now();
    device.fire('shader:link:end', {
      timestamp: endTime,
      target: device
    });
    device._shaderStats.compileTime += endTime - startTime;
    Debug.call(() => {
      const duration = now() - linkStartTime;
      this.compileDuration += duration;
      _totalCompileTime += this.compileDuration;
      Debug.trace(TRACEID_SHADER_COMPILE, `[id: ${shader.id}] ${shader.name}: ${this.compileDuration.toFixed(1)}ms, TOTAL: ${_totalCompileTime.toFixed(1)}ms`);
    });
    return true;
  }

  /**
   * Check the compilation status of a shader.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to query.
   * @param {WebGLShader} glShader - The WebGL shader.
   * @param {string} source - The shader source code.
   * @param {string} shaderType - The shader type. Can be 'vertex' or 'fragment'.
   * @returns {boolean} True if the shader compiled successfully, false otherwise.
   * @private
   */
  _isCompiled(device, shader, glShader, source, shaderType) {
    const gl = device.gl;
    if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
      const infoLog = gl.getShaderInfoLog(glShader);
      const [code, error] = this._processError(source, infoLog);
      const message = `Failed to compile ${shaderType} shader:\n\n${infoLog}\n${code}`;
      error.shader = shader;
      console.error(message, error);
      return false;
    }
    return true;
  }

  /**
   * Truncate the WebGL shader compilation log to just include the error line plus the 5 lines
   * before and after it.
   *
   * @param {string} src - The shader source code.
   * @param {string} infoLog - The info log returned from WebGL on a failed shader compilation.
   * @returns {Array} An array where the first element is the 10 lines of code around the first
   * detected error, and the second element an object storing the error message, line number and
   * complete shader source.
   * @private
   */
  _processError(src, infoLog) {
    const error = {};
    let code = '';
    if (src) {
      const lines = src.split('\n');
      let from = 0;
      let to = lines.length;

      // if error is in the code, only show nearby lines instead of whole shader code
      if (infoLog && infoLog.startsWith('ERROR:')) {
        const match = infoLog.match(/^ERROR:\s([0-9]+):([0-9]+):\s*(.+)/);
        if (match) {
          error.message = match[3];
          error.line = parseInt(match[2], 10);
          from = Math.max(0, error.line - 6);
          to = Math.min(lines.length, error.line + 5);
        }
      }

      // Chrome reports shader errors on lines indexed from 1
      for (let i = from; i < to; i++) {
        code += i + 1 + ":\t" + lines[i] + '\n';
      }
      error.source = src;
    }
    return [code, error];
  }
}

export { WebglShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtc2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBUUkFDRUlEX1NIQURFUl9DT01QSUxFIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xTaGFkZXJJbnB1dCB9IGZyb20gJy4vd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFNIQURFUlRBR19NQVRFUklBTCwgc2VtYW50aWNUb0xvY2F0aW9uIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vZGV2aWNlLWNhY2hlLmpzJztcblxubGV0IF90b3RhbENvbXBpbGVUaW1lID0gMDtcblxuY29uc3QgX3ZlcnRleFNoYWRlckJ1aWx0aW5zID0gW1xuICAgICdnbF9WZXJ0ZXhJRCcsXG4gICAgJ2dsX0luc3RhbmNlSUQnLFxuICAgICdnbF9EcmF3SUQnLFxuICAgICdnbF9CYXNlVmVydGV4JyxcbiAgICAnZ2xfQmFzZUluc3RhbmNlJ1xuXTtcblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGNvbXBpbGVkIFdlYkdMIHZlcnRleCBvciBmcmFnbWVudCBzaGFkZXJzIGluIHRoZSBkZXZpY2UgY2FjaGVcbmNsYXNzIENvbXBpbGVkU2hhZGVyQ2FjaGUge1xuICAgIC8vIG1hcHMgc2hhZGVyIHNvdXJjZSB0byBhIGNvbXBpbGVkIFdlYkdMIHNoYWRlclxuICAgIG1hcCA9IG5ldyBNYXAoKTtcblxuICAgIC8vIGRlc3Ryb3kgYWxsIGNyZWF0ZWQgc2hhZGVycyB3aGVuIHRoZSBkZXZpY2UgaXMgZGVzdHJveWVkXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgdGhpcy5tYXAuZm9yRWFjaCgoc2hhZGVyKSA9PiB7XG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlU2hhZGVyKHNoYWRlcik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGp1c3QgZW1wdHkgdGhlIGNhY2hlIHdoZW4gdGhlIGNvbnRleHQgaXMgbG9zdFxuICAgIGxvc2VDb250ZXh0KGRldmljZSkge1xuICAgICAgICB0aGlzLm1hcC5jbGVhcigpO1xuICAgIH1cbn1cblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGEgbGlzdCBvZiByZWNlbnRseSBjcmVhdGVkIHNoYWRlcnMgZm9ybWluZyBhIGJhdGNoLCB0byBhbGxvdyB0aGVpciBtb3JlIG9wdGltaXplZCBjb21waWxhdGlvblxuY2xhc3MgU2hhZGVyQmF0Y2hDYWNoZSB7XG4gICAgc2hhZGVycyA9IFtdO1xuXG4gICAgbG9zZUNvbnRleHQoZGV2aWNlKSB7XG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuICAgIH1cbn1cblxuY29uc3QgX3ZlcnRleFNoYWRlckNhY2hlID0gbmV3IERldmljZUNhY2hlKCk7XG5jb25zdCBfZnJhZ21lbnRTaGFkZXJDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuY29uc3QgX3NoYWRlckJhdGNoQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuLyoqXG4gKiBBIFdlYkdMIGltcGxlbWVudGF0aW9uIG9mIHRoZSBTaGFkZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFNoYWRlciB7XG4gICAgY29tcGlsZUR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHNoYWRlcikge1xuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICAvLyBraWNrIG9mZiB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlciBjb21waWxhdGlvbiwgYnV0IG5vdCBsaW5raW5nIGhlcmUsIGFzIHRoYXQgd291bGRcbiAgICAgICAgLy8gbWFrZSBpdCBibG9ja2luZy5cbiAgICAgICAgdGhpcy5jb21waWxlKHNoYWRlci5kZXZpY2UsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIHRoZSBzaGFkZXIgdG8gcmVjZW50bHkgY3JlYXRlZCBsaXN0XG4gICAgICAgIFdlYmdsU2hhZGVyLmdldEJhdGNoU2hhZGVycyhzaGFkZXIuZGV2aWNlKS5wdXNoKHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIGl0IHRvIGEgZGV2aWNlIGxpc3Qgb2YgYWxsIHNoYWRlcnNcbiAgICAgICAgc2hhZGVyLmRldmljZS5zaGFkZXJzLnB1c2goc2hhZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRoZSBXZWJHTCByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBmcmVlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koc2hhZGVyKSB7XG4gICAgICAgIGlmICh0aGlzLmdsUHJvZ3JhbSkge1xuICAgICAgICAgICAgc2hhZGVyLmRldmljZS5nbC5kZWxldGVQcm9ncmFtKHRoaXMuZ2xQcm9ncmFtKTtcbiAgICAgICAgICAgIHRoaXMuZ2xQcm9ncmFtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluaXQoKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMgPSBbXTtcbiAgICAgICAgdGhpcy5zYW1wbGVycyA9IFtdO1xuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ2xWZXJ0ZXhTaGFkZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmdsRnJhZ21lbnRTaGFkZXIgPSBudWxsO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRCYXRjaFNoYWRlcnMoZGV2aWNlKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoQ2FjaGUgPSBfc2hhZGVyQmF0Y2hDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNoYWRlckJhdGNoQ2FjaGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBiYXRjaENhY2hlLnNoYWRlcnM7XG4gICAgfVxuXG4gICAgc3RhdGljIGVuZFNoYWRlckJhdGNoKGRldmljZSkge1xuXG4gICAgICAgIC8vIFRyaWdnZXIgbGluayBzdGVwIGZvciBhbGwgcmVjZW50bHkgY3JlYXRlZCBzaGFkZXJzLiBUaGlzIGFsbG93cyBsaW5raW5nIHRvIGJlIGRvbmUgaW4gcGFyYWxsZWwsIGJlZm9yZVxuICAgICAgICAvLyB0aGUgYmxvY2tpbmcgd2FpdCBvbiB0aGUgbGlua2luZyByZXN1bHQgaXMgdHJpZ2dlcmVkIGluIGZpbmFsaXplIGZ1bmN0aW9uXG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSBXZWJnbFNoYWRlci5nZXRCYXRjaFNoYWRlcnMoZGV2aWNlKTtcbiAgICAgICAgc2hhZGVycy5mb3JFYWNoKHNoYWRlciA9PiBzaGFkZXIuaW1wbC5saW5rKGRldmljZSwgc2hhZGVyKSk7XG4gICAgICAgIHNoYWRlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNwb3NlIHRoZSBzaGFkZXIgd2hlbiB0aGUgY29udGV4dCBoYXMgYmVlbiBsb3N0LlxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIHNoYWRlciBhZnRlciB0aGUgY29udGV4dCBoYXMgYmVlbiBvYnRhaW5lZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byByZXN0b3JlLlxuICAgICAqL1xuICAgIHJlc3RvcmVDb250ZXh0KGRldmljZSwgc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuY29tcGlsZShkZXZpY2UsIHNoYWRlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGlsZSBzaGFkZXIgcHJvZ3JhbXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBjb21waWxlKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuICAgICAgICB0aGlzLmdsVmVydGV4U2hhZGVyID0gdGhpcy5fY29tcGlsZVNoYWRlclNvdXJjZShkZXZpY2UsIGRlZmluaXRpb24udnNoYWRlciwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZ2xGcmFnbWVudFNoYWRlciA9IHRoaXMuX2NvbXBpbGVTaGFkZXJTb3VyY2UoZGV2aWNlLCBkZWZpbml0aW9uLmZzaGFkZXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaW5rIHNoYWRlciBwcm9ncmFtcy4gVGhpcyBpcyBjYWxsZWQgYXQgYSBsYXRlciBzdGFnZSwgdG8gYWxsb3cgbWFueSBzaGFkZXJzIHRvIGNvbXBpbGUgaW4gcGFyYWxsZWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBsaW5rKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIHNoYWRlciB3YXMgYWxyZWFkeSBsaW5rZWRcbiAgICAgICAgaWYgKHRoaXMuZ2xQcm9ncmFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIGlmIHRoZSBkZXZpY2UgaXMgbG9zdCwgc2lsZW50bHkgaWdub3JlXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBpZiAoZ2wuaXNDb250ZXh0TG9zdCgpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RhcnRUaW1lID0gMDtcbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNvbXBpbGVEdXJhdGlvbiA9IDA7XG4gICAgICAgICAgICBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZ2xQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IGdsUHJvZ3JhbTtcblxuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCB0aGlzLmdsVmVydGV4U2hhZGVyKTtcbiAgICAgICAgZ2wuYXR0YWNoU2hhZGVyKGdsUHJvZ3JhbSwgdGhpcy5nbEZyYWdtZW50U2hhZGVyKTtcblxuICAgICAgICBjb25zdCBkZWZpbml0aW9uID0gc2hhZGVyLmRlZmluaXRpb247XG4gICAgICAgIGNvbnN0IGF0dHJzID0gZGVmaW5pdGlvbi5hdHRyaWJ1dGVzO1xuICAgICAgICBpZiAoZGV2aWNlLmlzV2ViR0wyICYmIGRlZmluaXRpb24udXNlVHJhbnNmb3JtRmVlZGJhY2spIHtcbiAgICAgICAgICAgIC8vIENvbGxlY3QgYWxsIFwib3V0X1wiIGF0dHJpYnV0ZXMgYW5kIHVzZSB0aGVtIGZvciBvdXRwdXRcbiAgICAgICAgICAgIGNvbnN0IG91dE5hbWVzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHIgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXR0cnMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0TmFtZXMucHVzaChcIm91dF9cIiArIGF0dHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGdsLnRyYW5zZm9ybUZlZWRiYWNrVmFyeWluZ3MoZ2xQcm9ncmFtLCBvdXROYW1lcywgZ2wuSU5URVJMRUFWRURfQVRUUklCUyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYXAgYWxsIHZlcnRleCBpbnB1dCBhdHRyaWJ1dGVzIHRvIGZpeGVkIGxvY2F0aW9uc1xuICAgICAgICBjb25zdCBsb2NhdGlvbnMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIGluIGF0dHJzKSB7XG4gICAgICAgICAgICBpZiAoYXR0cnMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGF0dHJzW2F0dHJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvYyA9IHNlbWFudGljVG9Mb2NhdGlvbltzZW1hbnRpY107XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCFsb2NhdGlvbnMuaGFzT3duUHJvcGVydHkobG9jKSwgYFdBUk5JTkc6IFR3byBhdHRyaWJ1dGVzIGFyZSBtYXBwZWQgdG8gdGhlIHNhbWUgbG9jYXRpb24gaW4gYSBzaGFkZXI6ICR7bG9jYXRpb25zW2xvY119IGFuZCAke2F0dHJ9YCk7XG5cbiAgICAgICAgICAgICAgICBsb2NhdGlvbnNbbG9jXSA9IGF0dHI7XG4gICAgICAgICAgICAgICAgZ2wuYmluZEF0dHJpYkxvY2F0aW9uKGdsUHJvZ3JhbSwgbG9jLCBhdHRyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmxpbmtQcm9ncmFtKGdsUHJvZ3JhbSk7XG5cbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNvbXBpbGVEdXJhdGlvbiA9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkKys7XG4gICAgICAgIGlmIChkZWZpbml0aW9uLnRhZyA9PT0gU0hBREVSVEFHX01BVEVSSUFMKSB7XG4gICAgICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLm1hdGVyaWFsU2hhZGVycysrO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbXBpbGVzIGFuIGluZGl2aWR1YWwgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ2xHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjIC0gVGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzVmVydGV4U2hhZGVyIC0gVHJ1ZSBpZiB0aGUgc2hhZGVyIGlzIGEgdmVydGV4IHNoYWRlciwgZmFsc2UgaWYgaXQgaXMgYVxuICAgICAqIGZyYWdtZW50IHNoYWRlci5cbiAgICAgKiBAcmV0dXJucyB7V2ViR0xTaGFkZXJ9IFRoZSBjb21waWxlZCBzaGFkZXIuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY29tcGlsZVNoYWRlclNvdXJjZShkZXZpY2UsIHNyYywgaXNWZXJ0ZXhTaGFkZXIpIHtcbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgLy8gZGV2aWNlIGNhY2hlIGZvciBjdXJyZW50IGRldmljZSwgY29udGFpbmluZyBjYWNoZSBvZiBjb21waWxlZCBzaGFkZXJzXG4gICAgICAgIGNvbnN0IHNoYWRlckRldmljZUNhY2hlID0gaXNWZXJ0ZXhTaGFkZXIgPyBfdmVydGV4U2hhZGVyQ2FjaGUgOiBfZnJhZ21lbnRTaGFkZXJDYWNoZTtcbiAgICAgICAgY29uc3Qgc2hhZGVyQ2FjaGUgPSBzaGFkZXJEZXZpY2VDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IENvbXBpbGVkU2hhZGVyQ2FjaGUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdHJ5IHRvIGdldCBjb21waWxlZCBzaGFkZXIgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgbGV0IGdsU2hhZGVyID0gc2hhZGVyQ2FjaGUubWFwLmdldChzcmMpO1xuXG4gICAgICAgIGlmICghZ2xTaGFkZXIpIHtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgZGV2aWNlLmZpcmUoJ3NoYWRlcjpjb21waWxlOnN0YXJ0Jywge1xuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgIHRhcmdldDogZGV2aWNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBnbFNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihpc1ZlcnRleFNoYWRlciA/IGdsLlZFUlRFWF9TSEFERVIgOiBnbC5GUkFHTUVOVF9TSEFERVIpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZGV2aWNlIGlzIGxvc3QsIHNpbGVudGx5IGlnbm9yZVxuICAgICAgICAgICAgaWYgKCFnbFNoYWRlciAmJiBnbC5pc0NvbnRleHRMb3N0KCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2xTaGFkZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGdsLnNoYWRlclNvdXJjZShnbFNoYWRlciwgc3JjKTtcbiAgICAgICAgICAgIGdsLmNvbXBpbGVTaGFkZXIoZ2xTaGFkZXIpO1xuXG4gICAgICAgICAgICBzaGFkZXJDYWNoZS5tYXAuc2V0KHNyYywgZ2xTaGFkZXIpO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBlbmRUaW1lID0gbm93KCk7XG4gICAgICAgICAgICBkZXZpY2UuZmlyZSgnc2hhZGVyOmNvbXBpbGU6ZW5kJywge1xuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogZW5kVGltZSxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGRldmljZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLmNvbXBpbGVUaW1lICs9IGVuZFRpbWUgLSBzdGFydFRpbWU7XG5cbiAgICAgICAgICAgIGlmIChpc1ZlcnRleFNoYWRlcikge1xuICAgICAgICAgICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMudnNDb21waWxlZCsrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLmZzQ29tcGlsZWQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGdsU2hhZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpbmsgdGhlIHNoYWRlciwgYW5kIGV4dHJhY3QgaXRzIGF0dHJpYnV0ZXMgYW5kIHVuaWZvcm0gaW5mb3JtYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gcXVlcnkuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNoYWRlciB3YXMgc3VjY2Vzc2Z1bGx5IHF1ZXJpZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBmaW5hbGl6ZShkZXZpY2UsIHNoYWRlcikge1xuXG4gICAgICAgIC8vIGlmIHRoZSBkZXZpY2UgaXMgbG9zdCwgc2lsZW50bHkgaWdub3JlXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBpZiAoZ2wuaXNDb250ZXh0TG9zdCgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBwcm9ncmFtIHdhc24ndCBsaW5rZWQgeWV0IChzaGFkZXIgd2FzIG5vdCBjcmVhdGVkIGluIGJhdGNoKVxuICAgICAgICBpZiAoIXRoaXMuZ2xQcm9ncmFtKVxuICAgICAgICAgICAgdGhpcy5saW5rKGRldmljZSwgc2hhZGVyKTtcblxuICAgICAgICBjb25zdCBnbFByb2dyYW0gPSB0aGlzLmdsUHJvZ3JhbTtcbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6bGluazpzdGFydCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiBkZXZpY2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIG1haW4gdGhlYWQgYmxvY2tpbmcgcGFydCBvZiB0aGUgc2hhZGVyIGNvbXBpbGF0aW9uLCB0aW1lIGl0XG4gICAgICAgIGxldCBsaW5rU3RhcnRUaW1lID0gMDtcbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBsaW5rU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtTdGF0dXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKGdsUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpO1xuICAgICAgICBpZiAoIWxpbmtTdGF0dXMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbXBpbGF0aW9uIGVycm9yc1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsVmVydGV4U2hhZGVyLCBkZWZpbml0aW9uLnZzaGFkZXIsIFwidmVydGV4XCIpKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsRnJhZ21lbnRTaGFkZXIsIGRlZmluaXRpb24uZnNoYWRlciwgXCJmcmFnbWVudFwiKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBcIkZhaWxlZCB0byBsaW5rIHNoYWRlciBwcm9ncmFtLiBFcnJvcjogXCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyhnbFByb2dyYW0pO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG5cbiAgICAgICAgICAgIC8vIGxvZyB0cmFuc2xhdGVkIHNoYWRlcnNcbiAgICAgICAgICAgIGRlZmluaXRpb24udHJhbnNsYXRlZEZyYWcgPSBnbC5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3NoYWRlcnMnKT8uZ2V0VHJhbnNsYXRlZFNoYWRlclNvdXJjZSh0aGlzLmdsRnJhZ21lbnRTaGFkZXIpO1xuICAgICAgICAgICAgZGVmaW5pdGlvbi50cmFuc2xhdGVkVmVydCA9IGdsLmdldEV4dGVuc2lvbignV0VCR0xfZGVidWdfc2hhZGVycycpPy5nZXRUcmFuc2xhdGVkU2hhZGVyU291cmNlKHRoaXMuZ2xWZXJ0ZXhTaGFkZXIpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UsIGRlZmluaXRpb24pO1xuICAgICAgICAgICAgLy8gI2Vsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUXVlcnkgdGhlIHByb2dyYW0gZm9yIGVhY2ggdmVydGV4IGJ1ZmZlciBpbnB1dCAoR0xTTCAnYXR0cmlidXRlJylcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBjb25zdCBudW1BdHRyaWJ1dGVzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihnbFByb2dyYW0sIGdsLkFDVElWRV9BVFRSSUJVVEVTKTtcbiAgICAgICAgd2hpbGUgKGkgPCBudW1BdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlQXR0cmliKGdsUHJvZ3JhbSwgaSsrKTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24oZ2xQcm9ncmFtLCBpbmZvLm5hbWUpO1xuXG4gICAgICAgICAgICAvLyBhIGJ1aWx0LWluIGF0dHJpYnV0ZXMgZm9yIHdoaWNoIHdlIGRvIG5vdCBuZWVkIHRvIHByb3ZpZGUgYW55IGRhdGFcbiAgICAgICAgICAgIGlmIChfdmVydGV4U2hhZGVyQnVpbHRpbnMuaW5kZXhPZihpbmZvLm5hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlcyBhcmUgY29ycmVjdGx5IGxpbmtlZCB1cFxuICAgICAgICAgICAgaWYgKGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBWZXJ0ZXggc2hhZGVyIGF0dHJpYnV0ZSBcIiR7aW5mby5uYW1lfVwiIGlzIG5vdCBtYXBwZWQgdG8gYSBzZW1hbnRpYyBpbiBzaGFkZXIgZGVmaW5pdGlvbiwgc2hhZGVyIFske3NoYWRlci5sYWJlbH1dYCwgc2hhZGVyKTtcbiAgICAgICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2hhZGVySW5wdXQgPSBuZXcgV2ViZ2xTaGFkZXJJbnB1dChkZXZpY2UsIGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdLCBkZXZpY2UucGNVbmlmb3JtVHlwZVtpbmZvLnR5cGVdLCBsb2NhdGlvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnB1c2goc2hhZGVySW5wdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUXVlcnkgdGhlIHByb2dyYW0gZm9yIGVhY2ggc2hhZGVyIHN0YXRlIChHTFNMICd1bmlmb3JtJylcbiAgICAgICAgaSA9IDA7XG4gICAgICAgIGNvbnN0IG51bVVuaWZvcm1zID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihnbFByb2dyYW0sIGdsLkFDVElWRV9VTklGT1JNUyk7XG4gICAgICAgIHdoaWxlIChpIDwgbnVtVW5pZm9ybXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBnbC5nZXRBY3RpdmVVbmlmb3JtKGdsUHJvZ3JhbSwgaSsrKTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKGdsUHJvZ3JhbSwgaW5mby5uYW1lKTtcblxuICAgICAgICAgICAgY29uc3Qgc2hhZGVySW5wdXQgPSBuZXcgV2ViZ2xTaGFkZXJJbnB1dChkZXZpY2UsIGluZm8ubmFtZSwgZGV2aWNlLnBjVW5pZm9ybVR5cGVbaW5mby50eXBlXSwgbG9jYXRpb24pO1xuXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgaW5mby50eXBlID09PSBnbC5TQU1QTEVSXzJEIHx8XG4gICAgICAgICAgICAgICAgaW5mby50eXBlID09PSBnbC5TQU1QTEVSX0NVQkUgfHxcbiAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5pc1dlYkdMMiAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLlVOU0lHTkVEX0lOVF9TQU1QTEVSXzJEIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLklOVF9TQU1QTEVSXzJEIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfMkRfU0hBRE9XIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfQ1VCRV9TSEFET1cgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZm8udHlwZSA9PT0gZ2wuU0FNUExFUl8zRCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mby50eXBlID09PSBnbC5JTlRfU0FNUExFUl8zRCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mby50eXBlID09PSBnbC5VTlNJR05FRF9JTlRfU0FNUExFUl8zRCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5mby50eXBlID09PSBnbC5TQU1QTEVSXzJEX0FSUkFZIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLklOVF9TQU1QTEVSXzJEX0FSUkFZIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLnR5cGUgPT09IGdsLlVOU0lHTkVEX0lOVF9TQU1QTEVSXzJEX0FSUkFZXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNhbXBsZXJzLnB1c2goc2hhZGVySW5wdXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVuaWZvcm1zLnB1c2goc2hhZGVySW5wdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2hhZGVyLnJlYWR5ID0gdHJ1ZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGVuZFRpbWUgPSBub3coKTtcbiAgICAgICAgZGV2aWNlLmZpcmUoJ3NoYWRlcjpsaW5rOmVuZCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogZW5kVGltZSxcbiAgICAgICAgICAgIHRhcmdldDogZGV2aWNlXG4gICAgICAgIH0pO1xuICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLmNvbXBpbGVUaW1lICs9IGVuZFRpbWUgLSBzdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZHVyYXRpb24gPSBub3coKSAtIGxpbmtTdGFydFRpbWU7XG4gICAgICAgICAgICB0aGlzLmNvbXBpbGVEdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIF90b3RhbENvbXBpbGVUaW1lICs9IHRoaXMuY29tcGlsZUR1cmF0aW9uO1xuICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9TSEFERVJfQ09NUElMRSwgYFtpZDogJHtzaGFkZXIuaWR9XSAke3NoYWRlci5uYW1lfTogJHt0aGlzLmNvbXBpbGVEdXJhdGlvbi50b0ZpeGVkKDEpfW1zLCBUT1RBTDogJHtfdG90YWxDb21waWxlVGltZS50b0ZpeGVkKDEpfW1zYCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIHRoZSBjb21waWxhdGlvbiBzdGF0dXMgb2YgYSBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gcXVlcnkuXG4gICAgICogQHBhcmFtIHtXZWJHTFNoYWRlcn0gZ2xTaGFkZXIgLSBUaGUgV2ViR0wgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzb3VyY2UgLSBUaGUgc2hhZGVyIHNvdXJjZSBjb2RlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaGFkZXJUeXBlIC0gVGhlIHNoYWRlciB0eXBlLiBDYW4gYmUgJ3ZlcnRleCcgb3IgJ2ZyYWdtZW50Jy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2hhZGVyIGNvbXBpbGVkIHN1Y2Nlc3NmdWxseSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2lzQ29tcGlsZWQoZGV2aWNlLCBzaGFkZXIsIGdsU2hhZGVyLCBzb3VyY2UsIHNoYWRlclR5cGUpIHtcbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgaWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoZ2xTaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICAgICAgY29uc3QgaW5mb0xvZyA9IGdsLmdldFNoYWRlckluZm9Mb2coZ2xTaGFkZXIpO1xuICAgICAgICAgICAgY29uc3QgW2NvZGUsIGVycm9yXSA9IHRoaXMuX3Byb2Nlc3NFcnJvcihzb3VyY2UsIGluZm9Mb2cpO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBGYWlsZWQgdG8gY29tcGlsZSAke3NoYWRlclR5cGV9IHNoYWRlcjpcXG5cXG4ke2luZm9Mb2d9XFxuJHtjb2RlfWA7XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBlcnJvci5zaGFkZXIgPSBzaGFkZXI7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UsIGVycm9yKTtcbiAgICAgICAgICAgIC8vICNlbHNlXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1bmNhdGUgdGhlIFdlYkdMIHNoYWRlciBjb21waWxhdGlvbiBsb2cgdG8ganVzdCBpbmNsdWRlIHRoZSBlcnJvciBsaW5lIHBsdXMgdGhlIDUgbGluZXNcbiAgICAgKiBiZWZvcmUgYW5kIGFmdGVyIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNyYyAtIFRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGluZm9Mb2cgLSBUaGUgaW5mbyBsb2cgcmV0dXJuZWQgZnJvbSBXZWJHTCBvbiBhIGZhaWxlZCBzaGFkZXIgY29tcGlsYXRpb24uXG4gICAgICogQHJldHVybnMge0FycmF5fSBBbiBhcnJheSB3aGVyZSB0aGUgZmlyc3QgZWxlbWVudCBpcyB0aGUgMTAgbGluZXMgb2YgY29kZSBhcm91bmQgdGhlIGZpcnN0XG4gICAgICogZGV0ZWN0ZWQgZXJyb3IsIGFuZCB0aGUgc2Vjb25kIGVsZW1lbnQgYW4gb2JqZWN0IHN0b3JpbmcgdGhlIGVycm9yIG1lc3NhZ2UsIGxpbmUgbnVtYmVyIGFuZFxuICAgICAqIGNvbXBsZXRlIHNoYWRlciBzb3VyY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc0Vycm9yKHNyYywgaW5mb0xvZykge1xuICAgICAgICBjb25zdCBlcnJvciA9IHsgfTtcbiAgICAgICAgbGV0IGNvZGUgPSAnJztcblxuICAgICAgICBpZiAoc3JjKSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHNyYy5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBsZXQgZnJvbSA9IDA7XG4gICAgICAgICAgICBsZXQgdG8gPSBsaW5lcy5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIGlmIGVycm9yIGlzIGluIHRoZSBjb2RlLCBvbmx5IHNob3cgbmVhcmJ5IGxpbmVzIGluc3RlYWQgb2Ygd2hvbGUgc2hhZGVyIGNvZGVcbiAgICAgICAgICAgIGlmIChpbmZvTG9nICYmIGluZm9Mb2cuc3RhcnRzV2l0aCgnRVJST1I6JykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGluZm9Mb2cubWF0Y2goL15FUlJPUjpcXHMoWzAtOV0rKTooWzAtOV0rKTpcXHMqKC4rKS8pO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvci5tZXNzYWdlID0gbWF0Y2hbM107XG4gICAgICAgICAgICAgICAgICAgIGVycm9yLmxpbmUgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSBNYXRoLm1heCgwLCBlcnJvci5saW5lIC0gNik7XG4gICAgICAgICAgICAgICAgICAgIHRvID0gTWF0aC5taW4obGluZXMubGVuZ3RoLCBlcnJvci5saW5lICsgNSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaHJvbWUgcmVwb3J0cyBzaGFkZXIgZXJyb3JzIG9uIGxpbmVzIGluZGV4ZWQgZnJvbSAxXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gZnJvbTsgaSA8IHRvOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IChpICsgMSkgKyBcIjpcXHRcIiArIGxpbmVzW2ldICsgJ1xcbic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVycm9yLnNvdXJjZSA9IHNyYztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbY29kZSwgZXJyb3JdO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xTaGFkZXIgfTtcbiJdLCJuYW1lcyI6WyJfdG90YWxDb21waWxlVGltZSIsIl92ZXJ0ZXhTaGFkZXJCdWlsdGlucyIsIkNvbXBpbGVkU2hhZGVyQ2FjaGUiLCJjb25zdHJ1Y3RvciIsIm1hcCIsIk1hcCIsImRlc3Ryb3kiLCJkZXZpY2UiLCJmb3JFYWNoIiwic2hhZGVyIiwiZ2wiLCJkZWxldGVTaGFkZXIiLCJsb3NlQ29udGV4dCIsImNsZWFyIiwiU2hhZGVyQmF0Y2hDYWNoZSIsInNoYWRlcnMiLCJfdmVydGV4U2hhZGVyQ2FjaGUiLCJEZXZpY2VDYWNoZSIsIl9mcmFnbWVudFNoYWRlckNhY2hlIiwiX3NoYWRlckJhdGNoQ2FjaGUiLCJXZWJnbFNoYWRlciIsImNvbXBpbGVEdXJhdGlvbiIsImluaXQiLCJjb21waWxlIiwiZ2V0QmF0Y2hTaGFkZXJzIiwicHVzaCIsImdsUHJvZ3JhbSIsImRlbGV0ZVByb2dyYW0iLCJ1bmlmb3JtcyIsInNhbXBsZXJzIiwiYXR0cmlidXRlcyIsImdsVmVydGV4U2hhZGVyIiwiZ2xGcmFnbWVudFNoYWRlciIsImJhdGNoQ2FjaGUiLCJnZXQiLCJlbmRTaGFkZXJCYXRjaCIsImltcGwiLCJsaW5rIiwibGVuZ3RoIiwicmVzdG9yZUNvbnRleHQiLCJkZWZpbml0aW9uIiwiX2NvbXBpbGVTaGFkZXJTb3VyY2UiLCJ2c2hhZGVyIiwiZnNoYWRlciIsImlzQ29udGV4dExvc3QiLCJzdGFydFRpbWUiLCJEZWJ1ZyIsImNhbGwiLCJub3ciLCJjcmVhdGVQcm9ncmFtIiwiYXR0YWNoU2hhZGVyIiwiYXR0cnMiLCJpc1dlYkdMMiIsInVzZVRyYW5zZm9ybUZlZWRiYWNrIiwib3V0TmFtZXMiLCJhdHRyIiwiaGFzT3duUHJvcGVydHkiLCJ0cmFuc2Zvcm1GZWVkYmFja1ZhcnlpbmdzIiwiSU5URVJMRUFWRURfQVRUUklCUyIsImxvY2F0aW9ucyIsInNlbWFudGljIiwibG9jIiwic2VtYW50aWNUb0xvY2F0aW9uIiwiYXNzZXJ0IiwiYmluZEF0dHJpYkxvY2F0aW9uIiwibGlua1Byb2dyYW0iLCJfc2hhZGVyU3RhdHMiLCJsaW5rZWQiLCJ0YWciLCJTSEFERVJUQUdfTUFURVJJQUwiLCJtYXRlcmlhbFNoYWRlcnMiLCJzcmMiLCJpc1ZlcnRleFNoYWRlciIsInNoYWRlckRldmljZUNhY2hlIiwic2hhZGVyQ2FjaGUiLCJnbFNoYWRlciIsImZpcmUiLCJ0aW1lc3RhbXAiLCJ0YXJnZXQiLCJjcmVhdGVTaGFkZXIiLCJWRVJURVhfU0hBREVSIiwiRlJBR01FTlRfU0hBREVSIiwic2hhZGVyU291cmNlIiwiY29tcGlsZVNoYWRlciIsInNldCIsImVuZFRpbWUiLCJjb21waWxlVGltZSIsInZzQ29tcGlsZWQiLCJmc0NvbXBpbGVkIiwiZmluYWxpemUiLCJsaW5rU3RhcnRUaW1lIiwibGlua1N0YXR1cyIsImdldFByb2dyYW1QYXJhbWV0ZXIiLCJMSU5LX1NUQVRVUyIsIl9nbCRnZXRFeHRlbnNpb24iLCJfZ2wkZ2V0RXh0ZW5zaW9uMiIsIl9pc0NvbXBpbGVkIiwibWVzc2FnZSIsImdldFByb2dyYW1JbmZvTG9nIiwidHJhbnNsYXRlZEZyYWciLCJnZXRFeHRlbnNpb24iLCJnZXRUcmFuc2xhdGVkU2hhZGVyU291cmNlIiwidHJhbnNsYXRlZFZlcnQiLCJjb25zb2xlIiwiZXJyb3IiLCJpIiwibnVtQXR0cmlidXRlcyIsIkFDVElWRV9BVFRSSUJVVEVTIiwiaW5mbyIsImdldEFjdGl2ZUF0dHJpYiIsImxvY2F0aW9uIiwiZ2V0QXR0cmliTG9jYXRpb24iLCJuYW1lIiwiaW5kZXhPZiIsInVuZGVmaW5lZCIsImxhYmVsIiwiZmFpbGVkIiwic2hhZGVySW5wdXQiLCJXZWJnbFNoYWRlcklucHV0IiwicGNVbmlmb3JtVHlwZSIsInR5cGUiLCJudW1Vbmlmb3JtcyIsIkFDVElWRV9VTklGT1JNUyIsImdldEFjdGl2ZVVuaWZvcm0iLCJnZXRVbmlmb3JtTG9jYXRpb24iLCJTQU1QTEVSXzJEIiwiU0FNUExFUl9DVUJFIiwiVU5TSUdORURfSU5UX1NBTVBMRVJfMkQiLCJJTlRfU0FNUExFUl8yRCIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJJTlRfU0FNUExFUl8zRCIsIlVOU0lHTkVEX0lOVF9TQU1QTEVSXzNEIiwiU0FNUExFUl8yRF9BUlJBWSIsIklOVF9TQU1QTEVSXzJEX0FSUkFZIiwiVU5TSUdORURfSU5UX1NBTVBMRVJfMkRfQVJSQVkiLCJyZWFkeSIsImR1cmF0aW9uIiwidHJhY2UiLCJUUkFDRUlEX1NIQURFUl9DT01QSUxFIiwiaWQiLCJ0b0ZpeGVkIiwic291cmNlIiwic2hhZGVyVHlwZSIsImdldFNoYWRlclBhcmFtZXRlciIsIkNPTVBJTEVfU1RBVFVTIiwiaW5mb0xvZyIsImdldFNoYWRlckluZm9Mb2ciLCJjb2RlIiwiX3Byb2Nlc3NFcnJvciIsImxpbmVzIiwic3BsaXQiLCJmcm9tIiwidG8iLCJzdGFydHNXaXRoIiwibWF0Y2giLCJsaW5lIiwicGFyc2VJbnQiLCJNYXRoIiwibWF4IiwibWluIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBUUEsSUFBSUEsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0FBRXpCLE1BQU1DLHFCQUFxQixHQUFHLENBQzFCLGFBQWEsRUFDYixlQUFlLEVBQ2YsV0FBVyxFQUNYLGVBQWUsRUFDZixpQkFBaUIsQ0FDcEIsQ0FBQTs7QUFFRDtBQUNBLE1BQU1DLG1CQUFtQixDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUN0QjtBQUFBLElBQUEsSUFBQSxDQUNBQyxHQUFHLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFBQSxHQUFBO0FBRWY7RUFDQUMsT0FBT0EsQ0FBQ0MsTUFBTSxFQUFFO0FBQ1osSUFBQSxJQUFJLENBQUNILEdBQUcsQ0FBQ0ksT0FBTyxDQUFFQyxNQUFNLElBQUs7QUFDekJGLE1BQUFBLE1BQU0sQ0FBQ0csRUFBRSxDQUFDQyxZQUFZLENBQUNGLE1BQU0sQ0FBQyxDQUFBO0FBQ2xDLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtFQUNBRyxXQUFXQSxDQUFDTCxNQUFNLEVBQUU7QUFDaEIsSUFBQSxJQUFJLENBQUNILEdBQUcsQ0FBQ1MsS0FBSyxFQUFFLENBQUE7QUFDcEIsR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQSxNQUFNQyxnQkFBZ0IsQ0FBQztFQUFBWCxXQUFBLEdBQUE7SUFBQSxJQUNuQlksQ0FBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUFBLEdBQUE7RUFFWkgsV0FBV0EsQ0FBQ0wsTUFBTSxFQUFFO0lBQ2hCLElBQUksQ0FBQ1EsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUNyQixHQUFBO0FBQ0osQ0FBQTtBQUVBLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBQzVDLE1BQU1DLG9CQUFvQixHQUFHLElBQUlELFdBQVcsRUFBRSxDQUFBO0FBQzlDLE1BQU1FLGlCQUFpQixHQUFHLElBQUlGLFdBQVcsRUFBRSxDQUFBOztBQUUzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUcsV0FBVyxDQUFDO0VBR2RqQixXQUFXQSxDQUFDTSxNQUFNLEVBQUU7SUFBQSxJQUZwQlksQ0FBQUEsZUFBZSxHQUFHLENBQUMsQ0FBQTtJQUdmLElBQUksQ0FBQ0MsSUFBSSxFQUFFLENBQUE7O0FBRVg7QUFDQTtJQUNBLElBQUksQ0FBQ0MsT0FBTyxDQUFDZCxNQUFNLENBQUNGLE1BQU0sRUFBRUUsTUFBTSxDQUFDLENBQUE7O0FBRW5DO0lBQ0FXLFdBQVcsQ0FBQ0ksZUFBZSxDQUFDZixNQUFNLENBQUNGLE1BQU0sQ0FBQyxDQUFDa0IsSUFBSSxDQUFDaEIsTUFBTSxDQUFDLENBQUE7O0FBRXZEO0lBQ0FBLE1BQU0sQ0FBQ0YsTUFBTSxDQUFDUSxPQUFPLENBQUNVLElBQUksQ0FBQ2hCLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJSCxPQUFPQSxDQUFDRyxNQUFNLEVBQUU7SUFDWixJQUFJLElBQUksQ0FBQ2lCLFNBQVMsRUFBRTtNQUNoQmpCLE1BQU0sQ0FBQ0YsTUFBTSxDQUFDRyxFQUFFLENBQUNpQixhQUFhLENBQUMsSUFBSSxDQUFDRCxTQUFTLENBQUMsQ0FBQTtNQUM5QyxJQUFJLENBQUNBLFNBQVMsR0FBRyxJQUFJLENBQUE7QUFDekIsS0FBQTtBQUNKLEdBQUE7QUFFQUosRUFBQUEsSUFBSUEsR0FBRztJQUNILElBQUksQ0FBQ00sUUFBUSxHQUFHLEVBQUUsQ0FBQTtJQUNsQixJQUFJLENBQUNDLFFBQVEsR0FBRyxFQUFFLENBQUE7SUFDbEIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsRUFBRSxDQUFBO0lBRXBCLElBQUksQ0FBQ0osU0FBUyxHQUFHLElBQUksQ0FBQTtJQUNyQixJQUFJLENBQUNLLGNBQWMsR0FBRyxJQUFJLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDaEMsR0FBQTtFQUVBLE9BQU9SLGVBQWVBLENBQUNqQixNQUFNLEVBQUU7SUFDM0IsTUFBTTBCLFVBQVUsR0FBR2QsaUJBQWlCLENBQUNlLEdBQUcsQ0FBQzNCLE1BQU0sRUFBRSxNQUFNO01BQ25ELE9BQU8sSUFBSU8sZ0JBQWdCLEVBQUUsQ0FBQTtBQUNqQyxLQUFDLENBQUMsQ0FBQTtJQUNGLE9BQU9tQixVQUFVLENBQUNsQixPQUFPLENBQUE7QUFDN0IsR0FBQTtFQUVBLE9BQU9vQixjQUFjQSxDQUFDNUIsTUFBTSxFQUFFO0FBRTFCO0FBQ0E7QUFDQSxJQUFBLE1BQU1RLE9BQU8sR0FBR0ssV0FBVyxDQUFDSSxlQUFlLENBQUNqQixNQUFNLENBQUMsQ0FBQTtBQUNuRFEsSUFBQUEsT0FBTyxDQUFDUCxPQUFPLENBQUNDLE1BQU0sSUFBSUEsTUFBTSxDQUFDMkIsSUFBSSxDQUFDQyxJQUFJLENBQUM5QixNQUFNLEVBQUVFLE1BQU0sQ0FBQyxDQUFDLENBQUE7SUFDM0RNLE9BQU8sQ0FBQ3VCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDSTFCLEVBQUFBLFdBQVdBLEdBQUc7SUFDVixJQUFJLENBQUNVLElBQUksRUFBRSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWlCLEVBQUFBLGNBQWNBLENBQUNoQyxNQUFNLEVBQUVFLE1BQU0sRUFBRTtBQUMzQixJQUFBLElBQUksQ0FBQ2MsT0FBTyxDQUFDaEIsTUFBTSxFQUFFRSxNQUFNLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJYyxFQUFBQSxPQUFPQSxDQUFDaEIsTUFBTSxFQUFFRSxNQUFNLEVBQUU7QUFFcEIsSUFBQSxNQUFNK0IsVUFBVSxHQUFHL0IsTUFBTSxDQUFDK0IsVUFBVSxDQUFBO0FBQ3BDLElBQUEsSUFBSSxDQUFDVCxjQUFjLEdBQUcsSUFBSSxDQUFDVSxvQkFBb0IsQ0FBQ2xDLE1BQU0sRUFBRWlDLFVBQVUsQ0FBQ0UsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2pGLElBQUEsSUFBSSxDQUFDVixnQkFBZ0IsR0FBRyxJQUFJLENBQUNTLG9CQUFvQixDQUFDbEMsTUFBTSxFQUFFaUMsVUFBVSxDQUFDRyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUE7QUFDeEYsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSU4sRUFBQUEsSUFBSUEsQ0FBQzlCLE1BQU0sRUFBRUUsTUFBTSxFQUFFO0FBRWpCO0lBQ0EsSUFBSSxJQUFJLENBQUNpQixTQUFTLEVBQ2QsT0FBQTs7QUFFSjtBQUNBLElBQUEsTUFBTWhCLEVBQUUsR0FBR0gsTUFBTSxDQUFDRyxFQUFFLENBQUE7QUFDcEIsSUFBQSxJQUFJQSxFQUFFLENBQUNrQyxhQUFhLEVBQUUsRUFBRTtBQUNwQixNQUFBLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSUMsU0FBUyxHQUFHLENBQUMsQ0FBQTtJQUNqQkMsS0FBSyxDQUFDQyxJQUFJLENBQUMsTUFBTTtNQUNiLElBQUksQ0FBQzFCLGVBQWUsR0FBRyxDQUFDLENBQUE7TUFDeEJ3QixTQUFTLEdBQUdHLEdBQUcsRUFBRSxDQUFBO0FBQ3JCLEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxNQUFNdEIsU0FBUyxHQUFHaEIsRUFBRSxDQUFDdUMsYUFBYSxFQUFFLENBQUE7SUFDcEMsSUFBSSxDQUFDdkIsU0FBUyxHQUFHQSxTQUFTLENBQUE7SUFFMUJoQixFQUFFLENBQUN3QyxZQUFZLENBQUN4QixTQUFTLEVBQUUsSUFBSSxDQUFDSyxjQUFjLENBQUMsQ0FBQTtJQUMvQ3JCLEVBQUUsQ0FBQ3dDLFlBQVksQ0FBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUNNLGdCQUFnQixDQUFDLENBQUE7QUFFakQsSUFBQSxNQUFNUSxVQUFVLEdBQUcvQixNQUFNLENBQUMrQixVQUFVLENBQUE7QUFDcEMsSUFBQSxNQUFNVyxLQUFLLEdBQUdYLFVBQVUsQ0FBQ1YsVUFBVSxDQUFBO0FBQ25DLElBQUEsSUFBSXZCLE1BQU0sQ0FBQzZDLFFBQVEsSUFBSVosVUFBVSxDQUFDYSxvQkFBb0IsRUFBRTtBQUNwRDtNQUNBLE1BQU1DLFFBQVEsR0FBRyxFQUFFLENBQUE7QUFDbkIsTUFBQSxLQUFLLE1BQU1DLElBQUksSUFBSUosS0FBSyxFQUFFO0FBQ3RCLFFBQUEsSUFBSUEsS0FBSyxDQUFDSyxjQUFjLENBQUNELElBQUksQ0FBQyxFQUFFO0FBQzVCRCxVQUFBQSxRQUFRLENBQUM3QixJQUFJLENBQUMsTUFBTSxHQUFHOEIsSUFBSSxDQUFDLENBQUE7QUFDaEMsU0FBQTtBQUNKLE9BQUE7TUFDQTdDLEVBQUUsQ0FBQytDLHlCQUF5QixDQUFDL0IsU0FBUyxFQUFFNEIsUUFBUSxFQUFFNUMsRUFBRSxDQUFDZ0QsbUJBQW1CLENBQUMsQ0FBQTtBQUM3RSxLQUFBOztBQUVBO0lBQ0EsTUFBTUMsU0FBUyxHQUFHLEVBQUUsQ0FBQTtBQUNwQixJQUFBLEtBQUssTUFBTUosSUFBSSxJQUFJSixLQUFLLEVBQUU7QUFDdEIsTUFBQSxJQUFJQSxLQUFLLENBQUNLLGNBQWMsQ0FBQ0QsSUFBSSxDQUFDLEVBQUU7QUFDNUIsUUFBQSxNQUFNSyxRQUFRLEdBQUdULEtBQUssQ0FBQ0ksSUFBSSxDQUFDLENBQUE7QUFDNUIsUUFBQSxNQUFNTSxHQUFHLEdBQUdDLGtCQUFrQixDQUFDRixRQUFRLENBQUMsQ0FBQTtBQUN4Q2QsUUFBQUEsS0FBSyxDQUFDaUIsTUFBTSxDQUFDLENBQUNKLFNBQVMsQ0FBQ0gsY0FBYyxDQUFDSyxHQUFHLENBQUMsRUFBRyxDQUFBLHFFQUFBLEVBQXVFRixTQUFTLENBQUNFLEdBQUcsQ0FBRSxDQUFPTixLQUFBQSxFQUFBQSxJQUFLLEVBQUMsQ0FBQyxDQUFBO0FBRWxKSSxRQUFBQSxTQUFTLENBQUNFLEdBQUcsQ0FBQyxHQUFHTixJQUFJLENBQUE7UUFDckI3QyxFQUFFLENBQUNzRCxrQkFBa0IsQ0FBQ3RDLFNBQVMsRUFBRW1DLEdBQUcsRUFBRU4sSUFBSSxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFFQTdDLElBQUFBLEVBQUUsQ0FBQ3VELFdBQVcsQ0FBQ3ZDLFNBQVMsQ0FBQyxDQUFBO0lBRXpCb0IsS0FBSyxDQUFDQyxJQUFJLENBQUMsTUFBTTtBQUNiLE1BQUEsSUFBSSxDQUFDMUIsZUFBZSxHQUFHMkIsR0FBRyxFQUFFLEdBQUdILFNBQVMsQ0FBQTtBQUM1QyxLQUFDLENBQUMsQ0FBQTtBQUdGdEMsSUFBQUEsTUFBTSxDQUFDMkQsWUFBWSxDQUFDQyxNQUFNLEVBQUUsQ0FBQTtBQUM1QixJQUFBLElBQUkzQixVQUFVLENBQUM0QixHQUFHLEtBQUtDLGtCQUFrQixFQUFFO0FBQ3ZDOUQsTUFBQUEsTUFBTSxDQUFDMkQsWUFBWSxDQUFDSSxlQUFlLEVBQUUsQ0FBQTtBQUN6QyxLQUFBO0FBRUosR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJN0IsRUFBQUEsb0JBQW9CQSxDQUFDbEMsTUFBTSxFQUFFZ0UsR0FBRyxFQUFFQyxjQUFjLEVBQUU7QUFDOUMsSUFBQSxNQUFNOUQsRUFBRSxHQUFHSCxNQUFNLENBQUNHLEVBQUUsQ0FBQTs7QUFFcEI7QUFDQSxJQUFBLE1BQU0rRCxpQkFBaUIsR0FBR0QsY0FBYyxHQUFHeEQsa0JBQWtCLEdBQUdFLG9CQUFvQixDQUFBO0lBQ3BGLE1BQU13RCxXQUFXLEdBQUdELGlCQUFpQixDQUFDdkMsR0FBRyxDQUFDM0IsTUFBTSxFQUFFLE1BQU07TUFDcEQsT0FBTyxJQUFJTCxtQkFBbUIsRUFBRSxDQUFBO0FBQ3BDLEtBQUMsQ0FBQyxDQUFBOztBQUVGO0lBQ0EsSUFBSXlFLFFBQVEsR0FBR0QsV0FBVyxDQUFDdEUsR0FBRyxDQUFDOEIsR0FBRyxDQUFDcUMsR0FBRyxDQUFDLENBQUE7SUFFdkMsSUFBSSxDQUFDSSxRQUFRLEVBQUU7QUFFWCxNQUFBLE1BQU05QixTQUFTLEdBQUdHLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCekMsTUFBQUEsTUFBTSxDQUFDcUUsSUFBSSxDQUFDLHNCQUFzQixFQUFFO0FBQ2hDQyxRQUFBQSxTQUFTLEVBQUVoQyxTQUFTO0FBQ3BCaUMsUUFBQUEsTUFBTSxFQUFFdkUsTUFBQUE7QUFDWixPQUFDLENBQUMsQ0FBQTtBQUdGb0UsTUFBQUEsUUFBUSxHQUFHakUsRUFBRSxDQUFDcUUsWUFBWSxDQUFDUCxjQUFjLEdBQUc5RCxFQUFFLENBQUNzRSxhQUFhLEdBQUd0RSxFQUFFLENBQUN1RSxlQUFlLENBQUMsQ0FBQTs7QUFFbEY7TUFDQSxJQUFJLENBQUNOLFFBQVEsSUFBSWpFLEVBQUUsQ0FBQ2tDLGFBQWEsRUFBRSxFQUFFO0FBQ2pDLFFBQUEsT0FBTytCLFFBQVEsQ0FBQTtBQUNuQixPQUFBO0FBRUFqRSxNQUFBQSxFQUFFLENBQUN3RSxZQUFZLENBQUNQLFFBQVEsRUFBRUosR0FBRyxDQUFDLENBQUE7QUFDOUI3RCxNQUFBQSxFQUFFLENBQUN5RSxhQUFhLENBQUNSLFFBQVEsQ0FBQyxDQUFBO01BRTFCRCxXQUFXLENBQUN0RSxHQUFHLENBQUNnRixHQUFHLENBQUNiLEdBQUcsRUFBRUksUUFBUSxDQUFDLENBQUE7QUFHbEMsTUFBQSxNQUFNVSxPQUFPLEdBQUdyQyxHQUFHLEVBQUUsQ0FBQTtBQUNyQnpDLE1BQUFBLE1BQU0sQ0FBQ3FFLElBQUksQ0FBQyxvQkFBb0IsRUFBRTtBQUM5QkMsUUFBQUEsU0FBUyxFQUFFUSxPQUFPO0FBQ2xCUCxRQUFBQSxNQUFNLEVBQUV2RSxNQUFBQTtBQUNaLE9BQUMsQ0FBQyxDQUFBO0FBQ0ZBLE1BQUFBLE1BQU0sQ0FBQzJELFlBQVksQ0FBQ29CLFdBQVcsSUFBSUQsT0FBTyxHQUFHeEMsU0FBUyxDQUFBO0FBRXRELE1BQUEsSUFBSTJCLGNBQWMsRUFBRTtBQUNoQmpFLFFBQUFBLE1BQU0sQ0FBQzJELFlBQVksQ0FBQ3FCLFVBQVUsRUFBRSxDQUFBO0FBQ3BDLE9BQUMsTUFBTTtBQUNIaEYsUUFBQUEsTUFBTSxDQUFDMkQsWUFBWSxDQUFDc0IsVUFBVSxFQUFFLENBQUE7QUFDcEMsT0FBQTtBQUVKLEtBQUE7QUFFQSxJQUFBLE9BQU9iLFFBQVEsQ0FBQTtBQUNuQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ljLEVBQUFBLFFBQVFBLENBQUNsRixNQUFNLEVBQUVFLE1BQU0sRUFBRTtBQUVyQjtBQUNBLElBQUEsTUFBTUMsRUFBRSxHQUFHSCxNQUFNLENBQUNHLEVBQUUsQ0FBQTtBQUNwQixJQUFBLElBQUlBLEVBQUUsQ0FBQ2tDLGFBQWEsRUFBRSxFQUFFO0FBQ3BCLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBOztBQUVBO0FBQ0EsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDbEIsU0FBUyxFQUNmLElBQUksQ0FBQ1csSUFBSSxDQUFDOUIsTUFBTSxFQUFFRSxNQUFNLENBQUMsQ0FBQTtBQUU3QixJQUFBLE1BQU1pQixTQUFTLEdBQUcsSUFBSSxDQUFDQSxTQUFTLENBQUE7QUFDaEMsSUFBQSxNQUFNYyxVQUFVLEdBQUcvQixNQUFNLENBQUMrQixVQUFVLENBQUE7QUFHcEMsSUFBQSxNQUFNSyxTQUFTLEdBQUdHLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCekMsSUFBQUEsTUFBTSxDQUFDcUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQzdCQyxNQUFBQSxTQUFTLEVBQUVoQyxTQUFTO0FBQ3BCaUMsTUFBQUEsTUFBTSxFQUFFdkUsTUFBQUE7QUFDWixLQUFDLENBQUMsQ0FBQTs7QUFHRjtJQUNBLElBQUltRixhQUFhLEdBQUcsQ0FBQyxDQUFBO0lBQ3JCNUMsS0FBSyxDQUFDQyxJQUFJLENBQUMsTUFBTTtNQUNiMkMsYUFBYSxHQUFHMUMsR0FBRyxFQUFFLENBQUE7QUFDekIsS0FBQyxDQUFDLENBQUE7SUFFRixNQUFNMkMsVUFBVSxHQUFHakYsRUFBRSxDQUFDa0YsbUJBQW1CLENBQUNsRSxTQUFTLEVBQUVoQixFQUFFLENBQUNtRixXQUFXLENBQUMsQ0FBQTtJQUNwRSxJQUFJLENBQUNGLFVBQVUsRUFBRTtNQUFBLElBQUFHLGdCQUFBLEVBQUFDLGlCQUFBLENBQUE7QUFFYjtNQUNBLElBQUksQ0FBQyxJQUFJLENBQUNDLFdBQVcsQ0FBQ3pGLE1BQU0sRUFBRUUsTUFBTSxFQUFFLElBQUksQ0FBQ3NCLGNBQWMsRUFBRVMsVUFBVSxDQUFDRSxPQUFPLEVBQUUsUUFBUSxDQUFDLEVBQ3BGLE9BQU8sS0FBSyxDQUFBO01BRWhCLElBQUksQ0FBQyxJQUFJLENBQUNzRCxXQUFXLENBQUN6RixNQUFNLEVBQUVFLE1BQU0sRUFBRSxJQUFJLENBQUN1QixnQkFBZ0IsRUFBRVEsVUFBVSxDQUFDRyxPQUFPLEVBQUUsVUFBVSxDQUFDLEVBQ3hGLE9BQU8sS0FBSyxDQUFBO01BRWhCLE1BQU1zRCxPQUFPLEdBQUcsd0NBQXdDLEdBQUd2RixFQUFFLENBQUN3RixpQkFBaUIsQ0FBQ3hFLFNBQVMsQ0FBQyxDQUFBOztBQUkxRjtBQUNBYyxNQUFBQSxVQUFVLENBQUMyRCxjQUFjLEdBQUEsQ0FBQUwsZ0JBQUEsR0FBR3BGLEVBQUUsQ0FBQzBGLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFBLElBQUEsR0FBQSxLQUFBLENBQUEsR0FBdENOLGdCQUFBLENBQXdDTyx5QkFBeUIsQ0FBQyxJQUFJLENBQUNyRSxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3BIUSxNQUFBQSxVQUFVLENBQUM4RCxjQUFjLEdBQUEsQ0FBQVAsaUJBQUEsR0FBR3JGLEVBQUUsQ0FBQzBGLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFBLElBQUEsR0FBQSxLQUFBLENBQUEsR0FBdENMLGlCQUFBLENBQXdDTSx5QkFBeUIsQ0FBQyxJQUFJLENBQUN0RSxjQUFjLENBQUMsQ0FBQTtBQUVsSHdFLE1BQUFBLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDUCxPQUFPLEVBQUV6RCxVQUFVLENBQUMsQ0FBQTtBQUtsQyxNQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLEtBQUE7O0FBRUE7SUFDQSxJQUFJaUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUNULE1BQU1DLGFBQWEsR0FBR2hHLEVBQUUsQ0FBQ2tGLG1CQUFtQixDQUFDbEUsU0FBUyxFQUFFaEIsRUFBRSxDQUFDaUcsaUJBQWlCLENBQUMsQ0FBQTtJQUM3RSxPQUFPRixDQUFDLEdBQUdDLGFBQWEsRUFBRTtNQUN0QixNQUFNRSxJQUFJLEdBQUdsRyxFQUFFLENBQUNtRyxlQUFlLENBQUNuRixTQUFTLEVBQUUrRSxDQUFDLEVBQUUsQ0FBQyxDQUFBO01BQy9DLE1BQU1LLFFBQVEsR0FBR3BHLEVBQUUsQ0FBQ3FHLGlCQUFpQixDQUFDckYsU0FBUyxFQUFFa0YsSUFBSSxDQUFDSSxJQUFJLENBQUMsQ0FBQTs7QUFFM0Q7TUFDQSxJQUFJL0cscUJBQXFCLENBQUNnSCxPQUFPLENBQUNMLElBQUksQ0FBQ0ksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQy9DLFNBQUE7O0FBRUo7TUFDQSxJQUFJeEUsVUFBVSxDQUFDVixVQUFVLENBQUM4RSxJQUFJLENBQUNJLElBQUksQ0FBQyxLQUFLRSxTQUFTLEVBQUU7QUFDaERYLFFBQUFBLE9BQU8sQ0FBQ0MsS0FBSyxDQUFFLENBQUEseUJBQUEsRUFBMkJJLElBQUksQ0FBQ0ksSUFBSyxDQUE4RHZHLDREQUFBQSxFQUFBQSxNQUFNLENBQUMwRyxLQUFNLENBQUUsQ0FBQSxDQUFBLEVBQUUxRyxNQUFNLENBQUMsQ0FBQTtRQUMxSUEsTUFBTSxDQUFDMkcsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN4QixPQUFDLE1BQU07UUFDSCxNQUFNQyxXQUFXLEdBQUcsSUFBSUMsZ0JBQWdCLENBQUMvRyxNQUFNLEVBQUVpQyxVQUFVLENBQUNWLFVBQVUsQ0FBQzhFLElBQUksQ0FBQ0ksSUFBSSxDQUFDLEVBQUV6RyxNQUFNLENBQUNnSCxhQUFhLENBQUNYLElBQUksQ0FBQ1ksSUFBSSxDQUFDLEVBQUVWLFFBQVEsQ0FBQyxDQUFBO0FBQzdILFFBQUEsSUFBSSxDQUFDaEYsVUFBVSxDQUFDTCxJQUFJLENBQUM0RixXQUFXLENBQUMsQ0FBQTtBQUNyQyxPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBWixJQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQ0wsTUFBTWdCLFdBQVcsR0FBRy9HLEVBQUUsQ0FBQ2tGLG1CQUFtQixDQUFDbEUsU0FBUyxFQUFFaEIsRUFBRSxDQUFDZ0gsZUFBZSxDQUFDLENBQUE7SUFDekUsT0FBT2pCLENBQUMsR0FBR2dCLFdBQVcsRUFBRTtNQUNwQixNQUFNYixJQUFJLEdBQUdsRyxFQUFFLENBQUNpSCxnQkFBZ0IsQ0FBQ2pHLFNBQVMsRUFBRStFLENBQUMsRUFBRSxDQUFDLENBQUE7TUFDaEQsTUFBTUssUUFBUSxHQUFHcEcsRUFBRSxDQUFDa0gsa0JBQWtCLENBQUNsRyxTQUFTLEVBQUVrRixJQUFJLENBQUNJLElBQUksQ0FBQyxDQUFBO01BRTVELE1BQU1LLFdBQVcsR0FBRyxJQUFJQyxnQkFBZ0IsQ0FBQy9HLE1BQU0sRUFBRXFHLElBQUksQ0FBQ0ksSUFBSSxFQUFFekcsTUFBTSxDQUFDZ0gsYUFBYSxDQUFDWCxJQUFJLENBQUNZLElBQUksQ0FBQyxFQUFFVixRQUFRLENBQUMsQ0FBQTtNQUV0RyxJQUNJRixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQ21ILFVBQVUsSUFDM0JqQixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQ29ILFlBQVksSUFFekJ2SCxNQUFNLENBQUM2QyxRQUFRLEtBQ1h3RCxJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQ3FILHVCQUF1QixJQUN4Q25CLElBQUksQ0FBQ1ksSUFBSSxLQUFLOUcsRUFBRSxDQUFDc0gsY0FBYyxJQUMvQnBCLElBQUksQ0FBQ1ksSUFBSSxLQUFLOUcsRUFBRSxDQUFDdUgsaUJBQWlCLElBQ2xDckIsSUFBSSxDQUFDWSxJQUFJLEtBQUs5RyxFQUFFLENBQUN3SCxtQkFBbUIsSUFDcEN0QixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQ3lILFVBQVUsSUFDM0J2QixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQzBILGNBQWMsSUFDL0J4QixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQzJILHVCQUF1QixJQUN4Q3pCLElBQUksQ0FBQ1ksSUFBSSxLQUFLOUcsRUFBRSxDQUFDNEgsZ0JBQWdCLElBQ2pDMUIsSUFBSSxDQUFDWSxJQUFJLEtBQUs5RyxFQUFFLENBQUM2SCxvQkFBb0IsSUFDckMzQixJQUFJLENBQUNZLElBQUksS0FBSzlHLEVBQUUsQ0FBQzhILDZCQUE2QixDQUVyRCxFQUNIO0FBQ0UsUUFBQSxJQUFJLENBQUMzRyxRQUFRLENBQUNKLElBQUksQ0FBQzRGLFdBQVcsQ0FBQyxDQUFBO0FBQ25DLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDekYsUUFBUSxDQUFDSCxJQUFJLENBQUM0RixXQUFXLENBQUMsQ0FBQTtBQUNuQyxPQUFBO0FBQ0osS0FBQTtJQUVBNUcsTUFBTSxDQUFDZ0ksS0FBSyxHQUFHLElBQUksQ0FBQTtBQUduQixJQUFBLE1BQU1wRCxPQUFPLEdBQUdyQyxHQUFHLEVBQUUsQ0FBQTtBQUNyQnpDLElBQUFBLE1BQU0sQ0FBQ3FFLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtBQUMzQkMsTUFBQUEsU0FBUyxFQUFFUSxPQUFPO0FBQ2xCUCxNQUFBQSxNQUFNLEVBQUV2RSxNQUFBQTtBQUNaLEtBQUMsQ0FBQyxDQUFBO0FBQ0ZBLElBQUFBLE1BQU0sQ0FBQzJELFlBQVksQ0FBQ29CLFdBQVcsSUFBSUQsT0FBTyxHQUFHeEMsU0FBUyxDQUFBO0lBR3REQyxLQUFLLENBQUNDLElBQUksQ0FBQyxNQUFNO0FBQ2IsTUFBQSxNQUFNMkYsUUFBUSxHQUFHMUYsR0FBRyxFQUFFLEdBQUcwQyxhQUFhLENBQUE7TUFDdEMsSUFBSSxDQUFDckUsZUFBZSxJQUFJcUgsUUFBUSxDQUFBO01BQ2hDMUksaUJBQWlCLElBQUksSUFBSSxDQUFDcUIsZUFBZSxDQUFBO0FBQ3pDeUIsTUFBQUEsS0FBSyxDQUFDNkYsS0FBSyxDQUFDQyxzQkFBc0IsRUFBRyxDQUFBLEtBQUEsRUFBT25JLE1BQU0sQ0FBQ29JLEVBQUcsQ0FBQSxFQUFBLEVBQUlwSSxNQUFNLENBQUN1RyxJQUFLLENBQUksRUFBQSxFQUFBLElBQUksQ0FBQzNGLGVBQWUsQ0FBQ3lILE9BQU8sQ0FBQyxDQUFDLENBQUUsQ0FBQSxXQUFBLEVBQWE5SSxpQkFBaUIsQ0FBQzhJLE9BQU8sQ0FBQyxDQUFDLENBQUUsSUFBRyxDQUFDLENBQUE7QUFDNUosS0FBQyxDQUFDLENBQUE7QUFFRixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0k5QyxXQUFXQSxDQUFDekYsTUFBTSxFQUFFRSxNQUFNLEVBQUVrRSxRQUFRLEVBQUVvRSxNQUFNLEVBQUVDLFVBQVUsRUFBRTtBQUN0RCxJQUFBLE1BQU10SSxFQUFFLEdBQUdILE1BQU0sQ0FBQ0csRUFBRSxDQUFBO0lBRXBCLElBQUksQ0FBQ0EsRUFBRSxDQUFDdUksa0JBQWtCLENBQUN0RSxRQUFRLEVBQUVqRSxFQUFFLENBQUN3SSxjQUFjLENBQUMsRUFBRTtBQUNyRCxNQUFBLE1BQU1DLE9BQU8sR0FBR3pJLEVBQUUsQ0FBQzBJLGdCQUFnQixDQUFDekUsUUFBUSxDQUFDLENBQUE7QUFDN0MsTUFBQSxNQUFNLENBQUMwRSxJQUFJLEVBQUU3QyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM4QyxhQUFhLENBQUNQLE1BQU0sRUFBRUksT0FBTyxDQUFDLENBQUE7TUFDekQsTUFBTWxELE9BQU8sR0FBSSxDQUFvQitDLGtCQUFBQSxFQUFBQSxVQUFXLGVBQWNHLE9BQVEsQ0FBQSxFQUFBLEVBQUlFLElBQUssQ0FBQyxDQUFBLENBQUE7TUFFaEY3QyxLQUFLLENBQUMvRixNQUFNLEdBQUdBLE1BQU0sQ0FBQTtBQUNyQjhGLE1BQUFBLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDUCxPQUFPLEVBQUVPLEtBQUssQ0FBQyxDQUFBO0FBSTdCLE1BQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsS0FBQTtBQUNBLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSThDLEVBQUFBLGFBQWFBLENBQUMvRSxHQUFHLEVBQUU0RSxPQUFPLEVBQUU7SUFDeEIsTUFBTTNDLEtBQUssR0FBRyxFQUFHLENBQUE7SUFDakIsSUFBSTZDLElBQUksR0FBRyxFQUFFLENBQUE7QUFFYixJQUFBLElBQUk5RSxHQUFHLEVBQUU7QUFDTCxNQUFBLE1BQU1nRixLQUFLLEdBQUdoRixHQUFHLENBQUNpRixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUE7TUFDN0IsSUFBSUMsSUFBSSxHQUFHLENBQUMsQ0FBQTtBQUNaLE1BQUEsSUFBSUMsRUFBRSxHQUFHSCxLQUFLLENBQUNqSCxNQUFNLENBQUE7O0FBRXJCO01BQ0EsSUFBSTZHLE9BQU8sSUFBSUEsT0FBTyxDQUFDUSxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7QUFDekMsUUFBQSxNQUFNQyxLQUFLLEdBQUdULE9BQU8sQ0FBQ1MsS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUE7QUFDakUsUUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUHBELFVBQUFBLEtBQUssQ0FBQ1AsT0FBTyxHQUFHMkQsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO1VBQ3hCcEQsS0FBSyxDQUFDcUQsSUFBSSxHQUFHQyxRQUFRLENBQUNGLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtBQUVuQ0gsVUFBQUEsSUFBSSxHQUFHTSxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEVBQUV4RCxLQUFLLENBQUNxRCxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDbENILFVBQUFBLEVBQUUsR0FBR0ssSUFBSSxDQUFDRSxHQUFHLENBQUNWLEtBQUssQ0FBQ2pILE1BQU0sRUFBRWtFLEtBQUssQ0FBQ3FELElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxTQUFBO0FBQ0osT0FBQTs7QUFFQTtNQUNBLEtBQUssSUFBSXBELENBQUMsR0FBR2dELElBQUksRUFBRWhELENBQUMsR0FBR2lELEVBQUUsRUFBRWpELENBQUMsRUFBRSxFQUFFO0FBQzVCNEMsUUFBQUEsSUFBSSxJQUFLNUMsQ0FBQyxHQUFHLENBQUMsR0FBSSxLQUFLLEdBQUc4QyxLQUFLLENBQUM5QyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDN0MsT0FBQTtNQUVBRCxLQUFLLENBQUN1QyxNQUFNLEdBQUd4RSxHQUFHLENBQUE7QUFDdEIsS0FBQTtBQUVBLElBQUEsT0FBTyxDQUFDOEUsSUFBSSxFQUFFN0MsS0FBSyxDQUFDLENBQUE7QUFDeEIsR0FBQTtBQUNKOzs7OyJ9
