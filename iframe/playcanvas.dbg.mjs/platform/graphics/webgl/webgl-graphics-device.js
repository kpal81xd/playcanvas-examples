import { math } from '../../../core/math/math.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_UINT, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC4, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE2D_ARRAY, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_UTEXTURE2D, UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_ITEXTURE2D_ARRAY, UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_MAT4ARRAY, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB8, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, PRIMITIVE_TRISTRIP, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
import { DebugGraphics } from '../debug-graphics.js';
import { WebglVertexBuffer } from './webgl-vertex-buffer.js';
import { WebglIndexBuffer } from './webgl-index-buffer.js';
import { WebglShader } from './webgl-shader.js';
import { WebglTexture } from './webgl-texture.js';
import { WebglRenderTarget } from './webgl-render-target.js';
import { ShaderUtils } from '../shader-utils.js';
import { Shader } from '../shader.js';
import { BlendState } from '../blend-state.js';
import { DepthState } from '../depth-state.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebglGpuProfiler } from './webgl-gpu-profiler.js';

const invalidateAttachments = [];
const _fullScreenQuadVS = /* glsl */`
attribute vec2 vertex_position;
varying vec2 vUv0;
void main(void)
{
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = vertex_position.xy*0.5+0.5;
}
`;
const _precisionTest1PS = /* glsl */`
void main(void) { 
    gl_FragColor = vec4(2147483648.0);
}
`;
const _precisionTest2PS = /* glsl */`
uniform sampler2D source;
vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}
void main(void) {
    float c = texture2D(source, vec2(0.0)).r;
    float diff = abs(c - 2147483648.0) / 2147483648.0;
    gl_FragColor = packFloat(diff);
}
`;
const _outputTexture2D = /* glsl */`
varying vec2 vUv0;
uniform sampler2D source;
void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;
function quadWithShader(device, target, shader) {
  DebugGraphics.pushGpuMarker(device, "QuadWithShader");
  const oldRt = device.renderTarget;
  device.setRenderTarget(target);
  device.updateBegin();
  device.setCullMode(CULLFACE_NONE);
  device.setBlendState(BlendState.NOBLEND);
  device.setDepthState(DepthState.NODEPTH);
  device.setStencilState(null, null);
  device.setVertexBuffer(device.quadVertexBuffer, 0);
  device.setShader(shader);
  device.draw({
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
  });
  device.updateEnd();
  device.setRenderTarget(oldRt);
  device.updateBegin();
  DebugGraphics.popGpuMarker(device);
}
function testRenderable(gl, pixelFormat) {
  let result = true;

  // Create a 2x2 texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, null);

  // Try to use this texture as a render target
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  // It is legal for a WebGL implementation exposing the OES_texture_float extension to
  // support floating-point textures but not as attachments to framebuffer objects.
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    result = false;
  }

  // Clean up
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteTexture(texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(framebuffer);
  return result;
}
function testTextureHalfFloatUpdatable(gl, pixelFormat) {
  let result = true;

  // Create a 2x2 texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // upload some data - on iOS prior to about November 2019, passing data to half texture would fail here
  // see details here: https://bugs.webkit.org/show_bug.cgi?id=169999
  // note that if not supported, this prints an error to console, the error can be safely ignored as it's handled
  const data = new Uint16Array(4 * 2 * 2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, data);
  if (gl.getError() !== gl.NO_ERROR) {
    result = false;
    console.log("Above error related to HALF_FLOAT_OES can be ignored, it was triggered by testing half float texture support");
  }

  // Clean up
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteTexture(texture);
  return result;
}
function testTextureFloatHighPrecision(device) {
  if (!device.textureFloatRenderable) return false;
  const shader1 = new Shader(device, ShaderUtils.createDefinition(device, {
    name: 'ptest1',
    vertexCode: _fullScreenQuadVS,
    fragmentCode: _precisionTest1PS
  }));
  const shader2 = new Shader(device, ShaderUtils.createDefinition(device, {
    name: 'ptest2',
    vertexCode: _fullScreenQuadVS,
    fragmentCode: _precisionTest2PS
  }));
  const textureOptions = {
    format: PIXELFORMAT_RGBA32F,
    width: 1,
    height: 1,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    name: 'testFHP'
  };
  const tex1 = new Texture(device, textureOptions);
  const targ1 = new RenderTarget({
    colorBuffer: tex1,
    depth: false
  });
  quadWithShader(device, targ1, shader1);
  textureOptions.format = PIXELFORMAT_RGBA8;
  const tex2 = new Texture(device, textureOptions);
  const targ2 = new RenderTarget({
    colorBuffer: tex2,
    depth: false
  });
  device.constantTexSource.setValue(tex1);
  quadWithShader(device, targ2, shader2);
  const prevFramebuffer = device.activeFramebuffer;
  device.setFramebuffer(targ2.impl._glFrameBuffer);
  const pixels = new Uint8Array(4);
  device.readPixels(0, 0, 1, 1, pixels);
  device.setFramebuffer(prevFramebuffer);
  const x = pixels[0] / 255;
  const y = pixels[1] / 255;
  const z = pixels[2] / 255;
  const w = pixels[3] / 255;
  const f = x / (256 * 256 * 256) + y / (256 * 256) + z / 256 + w;
  tex1.destroy();
  targ1.destroy();
  tex2.destroy();
  targ2.destroy();
  shader1.destroy();
  shader2.destroy();
  return f === 0;
}

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments GraphicsDevice
 * @category Graphics
 */
class WebglGraphicsDevice extends GraphicsDevice {
  /**
   * Creates a new WebglGraphicsDevice instance.
   *
   * @param {HTMLCanvasElement} canvas - The canvas to which the graphics device will render.
   * @param {object} [options] - Options passed when creating the WebGL context.
   * @param {boolean} [options.alpha] - Boolean that indicates if the canvas contains an
   * alpha buffer. Defaults to true.
   * @param {boolean} [options.depth] - Boolean that indicates that the drawing buffer is
   * requested to have a depth buffer of at least 16 bits. Defaults to true.
   * @param {boolean} [options.stencil] - Boolean that indicates that the drawing buffer is
   * requested to have a stencil buffer of at least 8 bits. Defaults to true.
   * @param {boolean} [options.antialias] - Boolean that indicates whether or not to perform
   * anti-aliasing if possible. Defaults to true.
   * @param {boolean} [options.premultipliedAlpha] - Boolean that indicates that the page
   * compositor will assume the drawing buffer contains colors with pre-multiplied alpha.
   * Defaults to true.
   * @param {boolean} [options.preserveDrawingBuffer] - If the value is true the buffers will not
   * be cleared and will preserve their values until cleared or overwritten by the author.
   * Defaults to false.
   * @param {'default'|'high-performance'|'low-power'} [options.powerPreference] - A hint to the
   * user agent indicating what configuration of GPU is suitable for the WebGL context. Possible
   * values are:
   *
   * - 'default': Let the user agent decide which GPU configuration is most suitable. This is the
   * default value.
   * - 'high-performance': Prioritizes rendering performance over power consumption.
   * - 'low-power': Prioritizes power saving over rendering performance.
   *
   * Defaults to 'default'.
   * @param {boolean} [options.failIfMajorPerformanceCaveat] - Boolean that indicates if a
   * context will be created if the system performance is low or if no hardware GPU is available.
   * Defaults to false.
   * @param {boolean} [options.preferWebGl2] - Boolean that indicates if a WebGl2 context should
   * be preferred. Defaults to true.
   * @param {boolean} [options.desynchronized] - Boolean that hints the user agent to reduce the
   * latency by desynchronizing the canvas paint cycle from the event loop. Defaults to false.
   * @param {boolean} [options.xrCompatible] - Boolean that hints to the user agent to use a
   * compatible graphics adapter for an immersive XR device.
   * @param {WebGLRenderingContext | WebGL2RenderingContext} [options.gl] - The rendering context
   * to use. If not specified, a new context will be created.
   */
  constructor(canvas, options = {}) {
    var _options$antialias;
    super(canvas, options);
    /**
     * The WebGL context managed by the graphics device. The type could also technically be
     * `WebGLRenderingContext` if WebGL 2.0 is not available. But in order for IntelliSense to be
     * able to function for all WebGL calls in the codebase, we specify `WebGL2RenderingContext`
     * here instead.
     *
     * @type {WebGL2RenderingContext}
     * @ignore
     */
    this.gl = void 0;
    /**
     * WebGLFramebuffer object that represents the backbuffer of the device for a rendering frame.
     * When null, this is a framebuffer created when the device was created, otherwise it is a
     * framebuffer supplied by the XR session.
     *
     * @ignore
     */
    this._defaultFramebuffer = null;
    /**
     * True if the default framebuffer has changed since the last frame.
     *
     * @ignore
     */
    this._defaultFramebufferChanged = false;
    options = this.initOptions;
    this.updateClientRect();

    // initialize this before registering lost context handlers to avoid undefined access when the device is created lost.
    this.initTextureUnits();

    // Add handlers for when the WebGL context is lost or restored
    this.contextLost = false;
    this._contextLostHandler = event => {
      event.preventDefault();
      this.contextLost = true;
      this.loseContext();
      Debug.log('pc.GraphicsDevice: WebGL context lost.');
      this.fire('devicelost');
    };
    this._contextRestoredHandler = () => {
      Debug.log('pc.GraphicsDevice: WebGL context restored.');
      this.contextLost = false;
      this.restoreContext();
      this.fire('devicerestored');
    };

    // #4136 - turn off antialiasing on AppleWebKit browsers 15.4
    const ua = typeof navigator !== 'undefined' && navigator.userAgent;
    this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));
    if (this.forceDisableMultisampling) {
      options.antialias = false;
      Debug.log("Antialiasing has been turned off due to rendering issues on AppleWebKit 15.4");
    }

    // #5856 - turn off antialiasing on Windows Firefox
    if (platform.browserName === 'firefox' && platform.name === 'windows') {
      const _ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const match = _ua.match(/Firefox\/(\d+(\.\d+)*)/);
      const firefoxVersion = match ? match[1] : null;
      if (firefoxVersion) {
        const version = parseFloat(firefoxVersion);
        if (version >= 120 || version === 115) {
          options.antialias = false;
          Debug.log("Antialiasing has been turned off due to rendering issues on Windows Firefox esr115 and 120+. Current version: " + firefoxVersion);
        }
      }
    }
    let gl = null;

    // we always allocate the default framebuffer without antialiasing, so remove that option
    this.backBufferAntialias = (_options$antialias = options.antialias) != null ? _options$antialias : false;
    options.antialias = false;

    // Retrieve the WebGL context
    if (options.gl) {
      gl = options.gl;
    } else {
      const preferWebGl2 = options.preferWebGl2 !== undefined ? options.preferWebGl2 : true;
      const names = preferWebGl2 ? ["webgl2", "webgl", "experimental-webgl"] : ["webgl", "experimental-webgl"];
      for (let i = 0; i < names.length; i++) {
        gl = canvas.getContext(names[i], options);
        if (gl) {
          break;
        }
      }
    }
    if (!gl) {
      throw new Error("WebGL not supported");
    }
    this.gl = gl;
    this.isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.isWebGL1 = !this.isWebGL2;
    this._deviceType = this.isWebGL2 ? DEVICETYPE_WEBGL2 : DEVICETYPE_WEBGL1;

    // pixel format of the framebuffer
    this.updateBackbufferFormat(null);
    const isChrome = platform.browserName === 'chrome';
    const isSafari = platform.browserName === 'safari';
    const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;

    // enable temporary texture unit workaround on desktop safari
    this._tempEnableSafariTextureUnitWorkaround = isSafari;

    // enable temporary workaround for glBlitFramebuffer failing on Mac Chrome (#2504)
    this._tempMacChromeBlitFramebufferWorkaround = isMac && isChrome && !options.alpha;
    canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();
    this.createBackbuffer(null);

    // only enable ImageBitmap on chrome
    this.supportsImageBitmap = !isSafari && typeof ImageBitmap !== 'undefined';
    this.glAddress = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
    this.glBlendEquation = [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT, this.isWebGL2 ? gl.MIN : this.extBlendMinmax ? this.extBlendMinmax.MIN_EXT : gl.FUNC_ADD, this.isWebGL2 ? gl.MAX : this.extBlendMinmax ? this.extBlendMinmax.MAX_EXT : gl.FUNC_ADD];
    this.glBlendFunctionColor = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR];
    this.glBlendFunctionAlpha = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA];
    this.glComparison = [gl.NEVER, gl.LESS, gl.EQUAL, gl.LEQUAL, gl.GREATER, gl.NOTEQUAL, gl.GEQUAL, gl.ALWAYS];
    this.glStencilOp = [gl.KEEP, gl.ZERO, gl.REPLACE, gl.INCR, gl.INCR_WRAP, gl.DECR, gl.DECR_WRAP, gl.INVERT];
    this.glClearFlag = [0, gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT];
    this.glCull = [0, gl.BACK, gl.FRONT, gl.FRONT_AND_BACK];
    this.glFilter = [gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
    this.glPrimitive = [gl.POINTS, gl.LINES, gl.LINE_LOOP, gl.LINE_STRIP, gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN];
    this.glType = [gl.BYTE, gl.UNSIGNED_BYTE, gl.SHORT, gl.UNSIGNED_SHORT, gl.INT, gl.UNSIGNED_INT, gl.FLOAT, gl.HALF_FLOAT];
    this.pcUniformType = {};
    this.pcUniformType[gl.BOOL] = UNIFORMTYPE_BOOL;
    this.pcUniformType[gl.INT] = UNIFORMTYPE_INT;
    this.pcUniformType[gl.FLOAT] = UNIFORMTYPE_FLOAT;
    this.pcUniformType[gl.FLOAT_VEC2] = UNIFORMTYPE_VEC2;
    this.pcUniformType[gl.FLOAT_VEC3] = UNIFORMTYPE_VEC3;
    this.pcUniformType[gl.FLOAT_VEC4] = UNIFORMTYPE_VEC4;
    this.pcUniformType[gl.INT_VEC2] = UNIFORMTYPE_IVEC2;
    this.pcUniformType[gl.INT_VEC3] = UNIFORMTYPE_IVEC3;
    this.pcUniformType[gl.INT_VEC4] = UNIFORMTYPE_IVEC4;
    this.pcUniformType[gl.BOOL_VEC2] = UNIFORMTYPE_BVEC2;
    this.pcUniformType[gl.BOOL_VEC3] = UNIFORMTYPE_BVEC3;
    this.pcUniformType[gl.BOOL_VEC4] = UNIFORMTYPE_BVEC4;
    this.pcUniformType[gl.FLOAT_MAT2] = UNIFORMTYPE_MAT2;
    this.pcUniformType[gl.FLOAT_MAT3] = UNIFORMTYPE_MAT3;
    this.pcUniformType[gl.FLOAT_MAT4] = UNIFORMTYPE_MAT4;
    this.pcUniformType[gl.SAMPLER_2D] = UNIFORMTYPE_TEXTURE2D;
    this.pcUniformType[gl.SAMPLER_CUBE] = UNIFORMTYPE_TEXTURECUBE;
    this.pcUniformType[gl.UNSIGNED_INT] = UNIFORMTYPE_UINT;
    this.pcUniformType[gl.UNSIGNED_INT_VEC2] = UNIFORMTYPE_UVEC2;
    this.pcUniformType[gl.UNSIGNED_INT_VEC3] = UNIFORMTYPE_UVEC3;
    this.pcUniformType[gl.UNSIGNED_INT_VEC4] = UNIFORMTYPE_UVEC4;
    if (this.isWebGL2) {
      this.pcUniformType[gl.SAMPLER_2D_SHADOW] = UNIFORMTYPE_TEXTURE2D_SHADOW;
      this.pcUniformType[gl.SAMPLER_CUBE_SHADOW] = UNIFORMTYPE_TEXTURECUBE_SHADOW;
      this.pcUniformType[gl.SAMPLER_2D_ARRAY] = UNIFORMTYPE_TEXTURE2D_ARRAY;
      this.pcUniformType[gl.SAMPLER_3D] = UNIFORMTYPE_TEXTURE3D;
      this.pcUniformType[gl.INT_SAMPLER_2D] = UNIFORMTYPE_ITEXTURE2D;
      this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D] = UNIFORMTYPE_UTEXTURE2D;
      this.pcUniformType[gl.INT_SAMPLER_CUBE] = UNIFORMTYPE_ITEXTURECUBE;
      this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D] = UNIFORMTYPE_UTEXTURECUBE;
      this.pcUniformType[gl.INT_SAMPLER_3D] = UNIFORMTYPE_ITEXTURE3D;
      this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_3D] = UNIFORMTYPE_UTEXTURE3D;
      this.pcUniformType[gl.INT_SAMPLER_2D_ARRAY] = UNIFORMTYPE_ITEXTURE2D_ARRAY;
      this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D_ARRAY] = UNIFORMTYPE_UTEXTURE2D_ARRAY;
    }
    this.targetToSlot = {};
    this.targetToSlot[gl.TEXTURE_2D] = 0;
    this.targetToSlot[gl.TEXTURE_CUBE_MAP] = 1;
    this.targetToSlot[gl.TEXTURE_3D] = 2;

    // Define the uniform commit functions
    let scopeX, scopeY, scopeZ, scopeW;
    let uniformValue;
    this.commitFunction = [];
    this.commitFunction[UNIFORMTYPE_BOOL] = function (uniform, value) {
      if (uniform.value !== value) {
        gl.uniform1i(uniform.locationId, value);
        uniform.value = value;
      }
    };
    this.commitFunction[UNIFORMTYPE_INT] = this.commitFunction[UNIFORMTYPE_BOOL];
    this.commitFunction[UNIFORMTYPE_FLOAT] = function (uniform, value) {
      if (uniform.value !== value) {
        gl.uniform1f(uniform.locationId, value);
        uniform.value = value;
      }
    };
    this.commitFunction[UNIFORMTYPE_VEC2] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
        gl.uniform2fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
      }
    };
    this.commitFunction[UNIFORMTYPE_VEC3] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
        gl.uniform3fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
      }
    };
    this.commitFunction[UNIFORMTYPE_VEC4] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      scopeW = value[3];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
        gl.uniform4fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
        uniformValue[3] = scopeW;
      }
    };
    this.commitFunction[UNIFORMTYPE_IVEC2] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
        gl.uniform2iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
      }
    };
    this.commitFunction[UNIFORMTYPE_BVEC2] = this.commitFunction[UNIFORMTYPE_IVEC2];
    this.commitFunction[UNIFORMTYPE_IVEC3] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
        gl.uniform3iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
      }
    };
    this.commitFunction[UNIFORMTYPE_BVEC3] = this.commitFunction[UNIFORMTYPE_IVEC3];
    this.commitFunction[UNIFORMTYPE_IVEC4] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      scopeW = value[3];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
        gl.uniform4iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
        uniformValue[3] = scopeW;
      }
    };
    this.commitFunction[UNIFORMTYPE_BVEC4] = this.commitFunction[UNIFORMTYPE_IVEC4];
    this.commitFunction[UNIFORMTYPE_MAT2] = function (uniform, value) {
      gl.uniformMatrix2fv(uniform.locationId, false, value);
    };
    this.commitFunction[UNIFORMTYPE_MAT3] = function (uniform, value) {
      gl.uniformMatrix3fv(uniform.locationId, false, value);
    };
    this.commitFunction[UNIFORMTYPE_MAT4] = function (uniform, value) {
      gl.uniformMatrix4fv(uniform.locationId, false, value);
    };
    this.commitFunction[UNIFORMTYPE_FLOATARRAY] = function (uniform, value) {
      gl.uniform1fv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_VEC2ARRAY] = function (uniform, value) {
      gl.uniform2fv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_VEC3ARRAY] = function (uniform, value) {
      gl.uniform3fv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_VEC4ARRAY] = function (uniform, value) {
      gl.uniform4fv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_UINT] = function (uniform, value) {
      if (uniform.value !== value) {
        gl.uniform1ui(uniform.locationId, value);
        uniform.value = value;
      }
    };
    this.commitFunction[UNIFORMTYPE_UVEC2] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
        gl.uniform2uiv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
      }
    };
    this.commitFunction[UNIFORMTYPE_UVEC3] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
        gl.uniform3uiv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
      }
    };
    this.commitFunction[UNIFORMTYPE_UVEC4] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      scopeW = value[3];
      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
        gl.uniform4uiv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
        uniformValue[3] = scopeW;
      }
    };
    this.commitFunction[UNIFORMTYPE_INTARRAY] = function (uniform, value) {
      gl.uniform1iv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_UINTARRAY] = function (uniform, value) {
      gl.uniform1uiv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_BOOLARRAY] = this.commitFunction[UNIFORMTYPE_INTARRAY];
    this.commitFunction[UNIFORMTYPE_IVEC2ARRAY] = function (uniform, value) {
      gl.uniform2iv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_UVEC2ARRAY] = function (uniform, value) {
      gl.uniform2uiv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_BVEC2ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC2ARRAY];
    this.commitFunction[UNIFORMTYPE_IVEC3ARRAY] = function (uniform, value) {
      gl.uniform3iv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_UVEC3ARRAY] = function (uniform, value) {
      gl.uniform3uiv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_BVEC3ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC3ARRAY];
    this.commitFunction[UNIFORMTYPE_IVEC4ARRAY] = function (uniform, value) {
      gl.uniform4iv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_UVEC4ARRAY] = function (uniform, value) {
      gl.uniform4uiv(uniform.locationId, value);
    };
    this.commitFunction[UNIFORMTYPE_BVEC4ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC4ARRAY];
    this.commitFunction[UNIFORMTYPE_MAT4ARRAY] = function (uniform, value) {
      gl.uniformMatrix4fv(uniform.locationId, false, value);
    };
    this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;

    // Calculate an estimate of the maximum number of bones that can be uploaded to the GPU
    // based on the number of available uniforms and the number of uniforms required for non-
    // bone data.  This is based off of the Standard shader.  A user defined shader may have
    // even less space available for bones so this calculated value can be overridden via
    // pc.GraphicsDevice.setBoneLimit.
    let numUniforms = this.vertexUniformsCount;
    numUniforms -= 4 * 4; // Model, view, projection and shadow matrices
    numUniforms -= 8; // 8 lights max, each specifying a position vector
    numUniforms -= 1; // Eye position
    numUniforms -= 4 * 4; // Up to 4 texture transforms
    this.boneLimit = Math.floor(numUniforms / 3); // each bone uses 3 uniforms

    // Put a limit on the number of supported bones before skin partitioning must be performed
    // Some GPUs have demonstrated performance issues if the number of vectors allocated to the
    // skin matrix palette is left unbounded
    this.boneLimit = Math.min(this.boneLimit, 128);
    if (this.unmaskedRenderer === 'Mali-450 MP') {
      this.boneLimit = 34;
    }
    this.constantTexSource = this.scope.resolve("source");
    if (this.extTextureFloat) {
      if (this.isWebGL2) {
        // In WebGL2 float texture renderability is dictated by the EXT_color_buffer_float extension
        this.textureFloatRenderable = !!this.extColorBufferFloat;
      } else {
        // In WebGL1 we should just try rendering into a float texture
        this.textureFloatRenderable = testRenderable(gl, gl.FLOAT);
      }
    } else {
      this.textureFloatRenderable = false;
    }

    // two extensions allow us to render to half float buffers
    if (this.extColorBufferHalfFloat) {
      this.textureHalfFloatRenderable = !!this.extColorBufferHalfFloat;
    } else if (this.extTextureHalfFloat) {
      if (this.isWebGL2) {
        // EXT_color_buffer_float should affect both float and halffloat formats
        this.textureHalfFloatRenderable = !!this.extColorBufferFloat;
      } else {
        // Manual render check for half float
        this.textureHalfFloatRenderable = testRenderable(gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
      }
    } else {
      this.textureHalfFloatRenderable = false;
    }
    this.supportsMorphTargetTexturesCore = this.maxPrecision === "highp" && this.maxVertexTextures >= 2;
    this.supportsDepthShadow = this.isWebGL2;
    this._textureFloatHighPrecision = undefined;
    this._textureHalfFloatUpdatable = undefined;

    // area light LUT format - order of preference: half, float, 8bit
    this.areaLightLutFormat = PIXELFORMAT_RGBA8;
    if (this.extTextureHalfFloat && this.textureHalfFloatUpdatable && this.extTextureHalfFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA16F;
    } else if (this.extTextureFloat && this.extTextureFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
    }
    this.postInit();
  }
  postInit() {
    super.postInit();
    this.gpuProfiler = new WebglGpuProfiler(this);
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    super.destroy();
    const gl = this.gl;
    if (this.isWebGL2 && this.feedback) {
      gl.deleteTransformFeedback(this.feedback);
    }
    this.clearVertexArrayObjectCache();
    this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
    this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);
    this._contextLostHandler = null;
    this._contextRestoredHandler = null;
    this.gl = null;
    super.postDestroy();
  }
  createBackbuffer(frameBuffer) {
    this.supportsStencil = this.initOptions.stencil;
    this.backBuffer = new RenderTarget({
      name: 'WebglFramebuffer',
      graphicsDevice: this,
      depth: this.initOptions.depth,
      stencil: this.supportsStencil,
      samples: this.samples
    });

    // use the default WebGL framebuffer for rendering
    this.backBuffer.impl.suppliedColorFramebuffer = frameBuffer;
  }

  // Update framebuffer format based on the current framebuffer, as this is use to create matching multi-sampled framebuffer
  updateBackbufferFormat(framebuffer) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const alphaBits = this.gl.getParameter(this.gl.ALPHA_BITS);
    this.backBufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
  }
  updateBackbuffer() {
    const resolutionChanged = this.canvas.width !== this.backBufferSize.x || this.canvas.height !== this.backBufferSize.y;
    if (this._defaultFramebufferChanged || resolutionChanged) {
      // if the default framebuffer changes (entering or exiting XR for example)
      if (this._defaultFramebufferChanged) {
        this.updateBackbufferFormat(this._defaultFramebuffer);
      }
      this._defaultFramebufferChanged = false;
      this.backBufferSize.set(this.canvas.width, this.canvas.height);

      // recreate the backbuffer with newly supplied framebuffer
      this.backBuffer.destroy();
      this.createBackbuffer(this._defaultFramebuffer);
    }
  }

  // provide webgl implementation for the vertex buffer
  createVertexBufferImpl(vertexBuffer, format) {
    return new WebglVertexBuffer();
  }

  // provide webgl implementation for the index buffer
  createIndexBufferImpl(indexBuffer) {
    return new WebglIndexBuffer(indexBuffer);
  }
  createShaderImpl(shader) {
    return new WebglShader(shader);
  }
  createTextureImpl(texture) {
    return new WebglTexture();
  }
  createRenderTargetImpl(renderTarget) {
    return new WebglRenderTarget();
  }
  pushMarker(name) {
    if (platform.browser && window.spector) {
      const label = DebugGraphics.toString();
      window.spector.setMarker(`${label} #`);
    }
  }
  popMarker() {
    if (platform.browser && window.spector) {
      const label = DebugGraphics.toString();
      if (label.length) window.spector.setMarker(`${label} #`);else window.spector.clearMarker();
    }
  }

  /**
   * Query the precision supported by ints and floats in vertex and fragment shaders. Note that
   * getShaderPrecisionFormat is not guaranteed to be present (such as some instances of the
   * default Android browser). In this case, assume highp is available.
   *
   * @returns {string} "highp", "mediump" or "lowp"
   * @ignore
   */
  getPrecision() {
    const gl = this.gl;
    let precision = "highp";
    if (gl.getShaderPrecisionFormat) {
      const vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      const vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);
      const fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
      if (vertexShaderPrecisionHighpFloat && vertexShaderPrecisionMediumpFloat && fragmentShaderPrecisionHighpFloat && fragmentShaderPrecisionMediumpFloat) {
        const highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
        const mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;
        if (!highpAvailable) {
          if (mediumpAvailable) {
            precision = "mediump";
            Debug.warn("WARNING: highp not supported, using mediump");
          } else {
            precision = "lowp";
            Debug.warn("WARNING: highp and mediump not supported, using lowp");
          }
        }
      }
    }
    return precision;
  }
  getExtension() {
    for (let i = 0; i < arguments.length; i++) {
      if (this.supportedExtensions.indexOf(arguments[i]) !== -1) {
        return this.gl.getExtension(arguments[i]);
      }
    }
    return null;
  }

  /** @ignore */
  get extDisjointTimerQuery() {
    // lazy evaluation as this is not typically used
    if (!this._extDisjointTimerQuery) {
      if (this.isWebGL2) {
        // Note that Firefox exposes EXT_disjoint_timer_query under WebGL2 rather than EXT_disjoint_timer_query_webgl2
        this._extDisjointTimerQuery = this.getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
      }
    }
    return this._extDisjointTimerQuery;
  }

  /**
   * Initialize the extensions provided by the WebGL context.
   *
   * @ignore
   */
  initializeExtensions() {
    var _gl$getSupportedExten;
    const gl = this.gl;
    this.supportedExtensions = (_gl$getSupportedExten = gl.getSupportedExtensions()) != null ? _gl$getSupportedExten : [];
    this._extDisjointTimerQuery = null;
    if (this.isWebGL2) {
      this.extBlendMinmax = true;
      this.extDrawBuffers = true;
      this.drawBuffers = gl.drawBuffers.bind(gl);
      this.extInstancing = true;
      this.extStandardDerivatives = true;
      this.extTextureFloat = true;
      this.extTextureHalfFloat = true;
      this.textureHalfFloatFilterable = true;
      this.extTextureLod = true;
      this.extUintElement = true;
      this.extVertexArrayObject = true;
      this.extColorBufferFloat = this.getExtension('EXT_color_buffer_float');
      this.extDepthTexture = true;
      this.textureRG11B10Renderable = true;
    } else {
      var _this$extDrawBuffers;
      this.extBlendMinmax = this.getExtension("EXT_blend_minmax");
      this.extDrawBuffers = this.getExtension('WEBGL_draw_buffers');
      this.extInstancing = this.getExtension("ANGLE_instanced_arrays");
      this.drawBuffers = (_this$extDrawBuffers = this.extDrawBuffers) == null ? void 0 : _this$extDrawBuffers.drawBuffersWEBGL.bind(this.extDrawBuffers);
      if (this.extInstancing) {
        // Install the WebGL 2 Instancing API for WebGL 1.0
        const ext = this.extInstancing;
        gl.drawArraysInstanced = ext.drawArraysInstancedANGLE.bind(ext);
        gl.drawElementsInstanced = ext.drawElementsInstancedANGLE.bind(ext);
        gl.vertexAttribDivisor = ext.vertexAttribDivisorANGLE.bind(ext);
      }
      this.extStandardDerivatives = this.getExtension("OES_standard_derivatives");
      this.extTextureFloat = this.getExtension("OES_texture_float");
      this.extTextureLod = this.getExtension('EXT_shader_texture_lod');
      this.extUintElement = this.getExtension("OES_element_index_uint");
      this.extVertexArrayObject = this.getExtension("OES_vertex_array_object");
      if (this.extVertexArrayObject) {
        // Install the WebGL 2 VAO API for WebGL 1.0
        const ext = this.extVertexArrayObject;
        gl.createVertexArray = ext.createVertexArrayOES.bind(ext);
        gl.deleteVertexArray = ext.deleteVertexArrayOES.bind(ext);
        gl.isVertexArray = ext.isVertexArrayOES.bind(ext);
        gl.bindVertexArray = ext.bindVertexArrayOES.bind(ext);
      }
      this.extColorBufferFloat = null;
      this.extDepthTexture = gl.getExtension('WEBGL_depth_texture');
      this.extTextureHalfFloat = this.getExtension("OES_texture_half_float");
      this.extTextureHalfFloatLinear = this.getExtension("OES_texture_half_float_linear");
      this.textureHalfFloatFilterable = !!this.extTextureHalfFloatLinear;
    }
    this.extDebugRendererInfo = this.getExtension('WEBGL_debug_renderer_info');
    this.extTextureFloatLinear = this.getExtension("OES_texture_float_linear");
    this.textureFloatFilterable = !!this.extTextureFloatLinear;
    this.extFloatBlend = this.getExtension("EXT_float_blend");
    this.extTextureFilterAnisotropic = this.getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
    this.extCompressedTextureETC1 = this.getExtension('WEBGL_compressed_texture_etc1');
    this.extCompressedTextureETC = this.getExtension('WEBGL_compressed_texture_etc');
    this.extCompressedTexturePVRTC = this.getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
    this.extCompressedTextureS3TC = this.getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
    this.extCompressedTextureATC = this.getExtension('WEBGL_compressed_texture_atc');
    this.extCompressedTextureASTC = this.getExtension('WEBGL_compressed_texture_astc');
    this.extParallelShaderCompile = this.getExtension('KHR_parallel_shader_compile');

    // iOS exposes this for half precision render targets on both Webgl1 and 2 from iOS v 14.5beta
    this.extColorBufferHalfFloat = this.getExtension("EXT_color_buffer_half_float");
  }

  /**
   * Query the capabilities of the WebGL context.
   *
   * @ignore
   */
  initializeCapabilities() {
    var _contextAttribs$antia, _contextAttribs$stenc;
    const gl = this.gl;
    let ext;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : "";
    this.maxPrecision = this.precision = this.getPrecision();
    const contextAttribs = gl.getContextAttributes();
    this.supportsMsaa = (_contextAttribs$antia = contextAttribs == null ? void 0 : contextAttribs.antialias) != null ? _contextAttribs$antia : false;
    this.supportsStencil = (_contextAttribs$stenc = contextAttribs == null ? void 0 : contextAttribs.stencil) != null ? _contextAttribs$stenc : false;
    this.supportsInstancing = !!this.extInstancing;

    // Query parameter values from the WebGL context
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this.vertexUniformsCount = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    if (this.isWebGL2) {
      this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
      this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
      this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
      this.supportsMrt = true;
      this.supportsVolumeTextures = true;
    } else {
      ext = this.extDrawBuffers;
      this.supportsMrt = !!ext;
      this.maxDrawBuffers = ext ? gl.getParameter(ext.MAX_DRAW_BUFFERS_WEBGL) : 1;
      this.maxColorAttachments = ext ? gl.getParameter(ext.MAX_COLOR_ATTACHMENTS_WEBGL) : 1;
      this.maxVolumeSize = 1;
    }
    ext = this.extDebugRendererInfo;
    this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';

    // Mali-G52 has rendering issues with GPU particles including
    // SM-A225M, M2003J15SC and KFRAWI (Amazon Fire HD 8 2022)
    const maliRendererRegex = /\bMali-G52+/;

    // Samsung devices with Exynos (ARM) either crash or render incorrectly when using GPU for particles. See:
    // https://github.com/playcanvas/engine/issues/3967
    // https://github.com/playcanvas/engine/issues/3415
    // https://github.com/playcanvas/engine/issues/4514
    // Example UA matches: Starting 'SM' and any combination of letters or numbers:
    // Mozilla/5.0 (Linux, Android 12; SM-G970F Build/SP1A.210812.016; wv)
    const samsungModelRegex = /SM-[a-zA-Z0-9]+/;
    this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex)) && !this.unmaskedRenderer.match(maliRendererRegex);
    ext = this.extTextureFilterAnisotropic;
    this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    const antialiasSupported = this.isWebGL2 && !this.forceDisableMultisampling;
    this.maxSamples = antialiasSupported ? gl.getParameter(gl.MAX_SAMPLES) : 1;

    // some devices incorrectly report max samples larger than 4
    this.maxSamples = Math.min(this.maxSamples, 4);

    // we handle anti-aliasing internally by allocating multi-sampled backbuffer
    this.samples = antialiasSupported && this.backBufferAntialias ? this.maxSamples : 1;

    // Don't allow area lights on old android devices, they often fail to compile the shader, run it incorrectly or are very slow.
    this.supportsAreaLights = this.isWebGL2 || !platform.android;

    // supports texture fetch instruction
    this.supportsTextureFetch = this.isWebGL2;

    // Also do not allow them when we only have small number of texture units
    if (this.maxTextures <= 8) {
      this.supportsAreaLights = false;
    }
  }

  /**
   * Set the initial render state on the WebGL context.
   *
   * @ignore
   */
  initializeRenderState() {
    super.initializeRenderState();
    const gl = this.gl;

    // Initialize render state to a known start state

    // default blend state
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.blendEquation(gl.FUNC_ADD);
    gl.colorMask(true, true, true, true);
    gl.blendColor(0, 0, 0, 0);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // default depth state
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    this.stencil = false;
    gl.disable(gl.STENCIL_TEST);
    this.stencilFuncFront = this.stencilFuncBack = FUNC_ALWAYS;
    this.stencilRefFront = this.stencilRefBack = 0;
    this.stencilMaskFront = this.stencilMaskBack = 0xFF;
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
    this.stencilFailFront = this.stencilFailBack = STENCILOP_KEEP;
    this.stencilZfailFront = this.stencilZfailBack = STENCILOP_KEEP;
    this.stencilZpassFront = this.stencilZpassBack = STENCILOP_KEEP;
    this.stencilWriteMaskFront = 0xFF;
    this.stencilWriteMaskBack = 0xFF;
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilMask(0xFF);
    this.alphaToCoverage = false;
    this.raster = true;
    if (this.isWebGL2) {
      gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.disable(gl.RASTERIZER_DISCARD);
    }
    this.depthBiasEnabled = false;
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.clearDepth = 1;
    gl.clearDepth(1);
    this.clearColor = new Color(0, 0, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    this.clearStencil = 0;
    gl.clearStencil(0);
    if (this.isWebGL2) {
      gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
    } else {
      if (this.extStandardDerivatives) {
        gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
      }
    }
    gl.enable(gl.SCISSOR_TEST);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    this.unpackFlipY = false;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.unpackPremultiplyAlpha = false;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }
  initTextureUnits(count = 16) {
    this.textureUnits = [];
    for (let i = 0; i < count; i++) {
      this.textureUnits.push([null, null, null]);
    }
  }
  initializeContextCaches() {
    super.initializeContextCaches();

    // cache of VAOs
    this._vaoMap = new Map();
    this.boundVao = null;
    this.activeFramebuffer = null;
    this.feedback = null;
    this.transformFeedbackBuffer = null;
    this.textureUnit = 0;
    this.initTextureUnits(this.maxCombinedTextures);
  }

  /**
   * Called when the WebGL context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    var _this$gpuProfiler;
    // force the backbuffer to be recreated on restore
    this.backBufferSize.set(-1, -1);

    // release shaders
    for (const shader of this.shaders) {
      shader.loseContext();
    }

    // release textures
    for (const texture of this.textures) {
      texture.loseContext();
    }

    // release vertex and index buffers
    for (const buffer of this.buffers) {
      buffer.loseContext();
    }

    // Reset all render targets so they'll be recreated as required.
    // TODO: a solution for the case where a render target contains something
    // that was previously generated that needs to be re-rendered.
    for (const target of this.targets) {
      target.loseContext();
    }
    (_this$gpuProfiler = this.gpuProfiler) == null || _this$gpuProfiler.loseContext();
  }

  /**
   * Called when the WebGL context is restored. It reinitializes all context related resources.
   *
   * @ignore
   */
  restoreContext() {
    var _this$gpuProfiler2;
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();

    // Recompile all shaders (they'll be linked when they're next actually used)
    for (const shader of this.shaders) {
      shader.restoreContext();
    }

    // Recreate buffer objects and reupload buffer data to the GPU
    for (const buffer of this.buffers) {
      buffer.unlock();
    }
    (_this$gpuProfiler2 = this.gpuProfiler) == null || _this$gpuProfiler2.restoreContext();
  }

  /**
   * Called after a batch of shaders was created, to guide in their optimal preparation for rendering.
   *
   * @ignore
   */
  endShaderBatch() {
    WebglShader.endShaderBatch(this);
  }

  /**
   * Set the active rectangle for rendering on the specified device.
   *
   * @param {number} x - The pixel space x-coordinate of the bottom left corner of the viewport.
   * @param {number} y - The pixel space y-coordinate of the bottom left corner of the viewport.
   * @param {number} w - The width of the viewport in pixels.
   * @param {number} h - The height of the viewport in pixels.
   */
  setViewport(x, y, w, h) {
    if (this.vx !== x || this.vy !== y || this.vw !== w || this.vh !== h) {
      this.gl.viewport(x, y, w, h);
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
    }
  }

  /**
   * Set the active scissor rectangle on the specified device.
   *
   * @param {number} x - The pixel space x-coordinate of the bottom left corner of the scissor rectangle.
   * @param {number} y - The pixel space y-coordinate of the bottom left corner of the scissor rectangle.
   * @param {number} w - The width of the scissor rectangle in pixels.
   * @param {number} h - The height of the scissor rectangle in pixels.
   */
  setScissor(x, y, w, h) {
    if (this.sx !== x || this.sy !== y || this.sw !== w || this.sh !== h) {
      this.gl.scissor(x, y, w, h);
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
    }
  }

  /**
   * Binds the specified framebuffer object.
   *
   * @param {WebGLFramebuffer | null} fb - The framebuffer to bind.
   * @ignore
   */
  setFramebuffer(fb) {
    if (this.activeFramebuffer !== fb) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      this.activeFramebuffer = fb;
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
    const gl = this.gl;

    // if copying from the backbuffer
    if (source === this.backBuffer) {
      source = null;
    }
    if (!this.isWebGL2 && depth) {
      Debug.error("Depth is not copyable on WebGL 1.0");
      return false;
    }
    if (color) {
      if (!dest) {
        // copying to backbuffer
        if (!source._colorBuffer) {
          Debug.error("Can't copy empty color buffer to backbuffer");
          return false;
        }
      } else if (source) {
        // copying to render target
        if (!source._colorBuffer || !dest._colorBuffer) {
          Debug.error("Can't copy color buffer, because one of the render targets doesn't have it");
          return false;
        }
        if (source._colorBuffer._format !== dest._colorBuffer._format) {
          Debug.error("Can't copy render targets of different color formats");
          return false;
        }
      }
    }
    if (depth && source) {
      if (!source._depth) {
        // when depth is automatic, we cannot test the buffer nor its format
        if (!source._depthBuffer || !dest._depthBuffer) {
          Debug.error("Can't copy depth buffer, because one of the render targets doesn't have it");
          return false;
        }
        if (source._depthBuffer._format !== dest._depthBuffer._format) {
          Debug.error("Can't copy render targets of different depth formats");
          return false;
        }
      }
    }
    DebugGraphics.pushGpuMarker(this, 'COPY-RT');
    if (this.isWebGL2 && dest) {
      var _this$backBuffer;
      const prevRt = this.renderTarget;
      this.renderTarget = dest;
      this.updateBegin();

      // copy from single sampled framebuffer
      const src = source ? source.impl._glFrameBuffer : (_this$backBuffer = this.backBuffer) == null ? void 0 : _this$backBuffer.impl._glFrameBuffer;
      const dst = dest.impl._glFrameBuffer;
      Debug.assert(src !== dst, 'Source and destination framebuffers must be different when blitting.');
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
      const w = source ? source.width : dest.width;
      const h = source ? source.height : dest.height;
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);

      // TODO: not sure we need to restore the prev target, as this only should run in-between render passes
      this.renderTarget = prevRt;
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevRt ? prevRt.impl._glFrameBuffer : null);
    } else {
      const shader = this.getCopyShader();
      this.constantTexSource.setValue(source._colorBuffer);
      quadWithShader(this, dest, shader);
    }
    DebugGraphics.popGpuMarker(this);
    return true;
  }

  /**
   * Get copy shader for efficient rendering of fullscreen-quad with texture.
   *
   * @returns {Shader} The copy shader (based on `fullscreenQuadVS` and `outputTex2DPS` in
   * `shaderChunks`).
   * @ignore
   */
  getCopyShader() {
    if (!this._copyShader) {
      this._copyShader = new Shader(this, ShaderUtils.createDefinition(this, {
        name: 'outputTex2D',
        vertexCode: _fullScreenQuadVS,
        fragmentCode: _outputTexture2D
      }));
    }
    return this._copyShader;
  }
  frameStart() {
    super.frameStart();
    this.updateBackbuffer();
    this.gpuProfiler.frameStart();
  }
  frameEnd() {
    super.frameEnd();
    this.gpuProfiler.frameEnd();
    this.gpuProfiler.request();
  }

  /**
   * Start a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   * @ignore
   */
  startRenderPass(renderPass) {
    var _renderPass$renderTar;
    DebugGraphics.pushGpuMarker(this, `START-PASS`);

    // set up render target
    const rt = (_renderPass$renderTar = renderPass.renderTarget) != null ? _renderPass$renderTar : this.backBuffer;
    this.renderTarget = rt;
    Debug.assert(rt);
    this.updateBegin();

    // the pass always start using full size of the target
    const {
      width,
      height
    } = rt;
    this.setViewport(0, 0, width, height);
    this.setScissor(0, 0, width, height);

    // clear the render target
    const colorOps = renderPass.colorOps;
    const depthStencilOps = renderPass.depthStencilOps;
    if (colorOps != null && colorOps.clear || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {
      let clearFlags = 0;
      const clearOptions = {};
      if (colorOps != null && colorOps.clear) {
        clearFlags |= CLEARFLAG_COLOR;
        clearOptions.color = [colorOps.clearValue.r, colorOps.clearValue.g, colorOps.clearValue.b, colorOps.clearValue.a];
      }
      if (depthStencilOps.clearDepth) {
        clearFlags |= CLEARFLAG_DEPTH;
        clearOptions.depth = depthStencilOps.clearDepthValue;
      }
      if (depthStencilOps.clearStencil) {
        clearFlags |= CLEARFLAG_STENCIL;
        clearOptions.stencil = depthStencilOps.clearStencilValue;
      }

      // clear it
      clearOptions.flags = clearFlags;
      this.clear(clearOptions);
    }
    Debug.call(() => {
      if (this.insideRenderPass) {
        Debug.errorOnce('RenderPass cannot be started while inside another render pass.');
      }
    });
    this.insideRenderPass = true;
    DebugGraphics.popGpuMarker(this);
  }

  /**
   * End a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
   * @ignore
   */
  endRenderPass(renderPass) {
    DebugGraphics.pushGpuMarker(this, `END-PASS`);
    this.unbindVertexArray();
    const target = this.renderTarget;
    const colorBufferCount = renderPass.colorArrayOps.length;
    if (target) {
      var _renderPass$colorOps;
      // invalidate buffers to stop them being written to on tiled architectures
      if (this.isWebGL2) {
        invalidateAttachments.length = 0;
        const gl = this.gl;

        // color buffers
        for (let i = 0; i < colorBufferCount; i++) {
          const colorOps = renderPass.colorArrayOps[i];

          // invalidate color only if we don't need to resolve it
          if (!(colorOps.store || colorOps.resolve)) {
            invalidateAttachments.push(gl.COLOR_ATTACHMENT0 + i);
          }
        }

        // we cannot invalidate depth/stencil buffers of the backbuffer
        if (target !== this.backBuffer) {
          if (!renderPass.depthStencilOps.storeDepth) {
            invalidateAttachments.push(gl.DEPTH_ATTACHMENT);
          }
          if (!renderPass.depthStencilOps.storeStencil) {
            invalidateAttachments.push(gl.STENCIL_ATTACHMENT);
          }
        }
        if (invalidateAttachments.length > 0) {
          // invalidate the whole buffer
          // TODO: we could handle viewport invalidation as well
          if (renderPass.fullSizeClearRect) {
            gl.invalidateFramebuffer(gl.DRAW_FRAMEBUFFER, invalidateAttachments);
          }
        }
      }

      // resolve the color buffer (this resolves all MRT color buffers at once)
      if ((_renderPass$colorOps = renderPass.colorOps) != null && _renderPass$colorOps.resolve) {
        if (this.isWebGL2 && renderPass.samples > 1 && target.autoResolve) {
          target.resolve(true, false);
        }
      }

      // generate mipmaps
      for (let i = 0; i < colorBufferCount; i++) {
        const colorOps = renderPass.colorArrayOps[i];
        if (colorOps.mipmaps) {
          const colorBuffer = target._colorBuffers[i];
          if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.isWebGL2)) {
            DebugGraphics.pushGpuMarker(this, `MIPS${i}`);
            this.activeTexture(this.maxCombinedTextures - 1);
            this.bindTexture(colorBuffer);
            this.gl.generateMipmap(colorBuffer.impl._glTarget);
            DebugGraphics.popGpuMarker(this);
          }
        }
      }
    }
    this.insideRenderPass = false;
    DebugGraphics.popGpuMarker(this);
  }
  set defaultFramebuffer(value) {
    if (this._defaultFramebuffer !== value) {
      this._defaultFramebuffer = value;
      this._defaultFramebufferChanged = true;
    }
  }
  get defaultFramebuffer() {
    return this._defaultFramebuffer;
  }

  /**
   * Marks the beginning of a block of rendering. Internally, this function binds the render
   * target currently set on the device. This function should be matched with a call to
   * {@link GraphicsDevice#updateEnd}. Calls to {@link GraphicsDevice#updateBegin} and
   * {@link GraphicsDevice#updateEnd} must not be nested.
   *
   * @ignore
   */
  updateBegin() {
    var _this$renderTarget;
    DebugGraphics.pushGpuMarker(this, 'UPDATE-BEGIN');
    this.boundVao = null;

    // clear texture units once a frame on desktop safari
    if (this._tempEnableSafariTextureUnitWorkaround) {
      for (let unit = 0; unit < this.textureUnits.length; ++unit) {
        for (let slot = 0; slot < 3; ++slot) {
          this.textureUnits[unit][slot] = null;
        }
      }
    }

    // Set the render target
    const target = (_this$renderTarget = this.renderTarget) != null ? _this$renderTarget : this.backBuffer;
    Debug.assert(target);

    // Initialize the framebuffer
    const targetImpl = target.impl;
    if (!targetImpl.initialized) {
      this.initRenderTarget(target);
    }

    // Bind the framebuffer
    this.setFramebuffer(targetImpl._glFrameBuffer);
    DebugGraphics.popGpuMarker(this);
  }

  /**
   * Marks the end of a block of rendering. This function should be called after a matching call
   * to {@link GraphicsDevice#updateBegin}. Calls to {@link GraphicsDevice#updateBegin} and
   * {@link GraphicsDevice#updateEnd} must not be nested.
   *
   * @ignore
   */
  updateEnd() {
    DebugGraphics.pushGpuMarker(this, `UPDATE-END`);
    this.unbindVertexArray();

    // Unset the render target
    const target = this.renderTarget;
    if (target && target !== this.backBuffer) {
      // Resolve MSAA if needed
      if (this.isWebGL2 && target._samples > 1 && target.autoResolve) {
        target.resolve();
      }

      // If the active render target is auto-mipmapped, generate its mip chain
      const colorBuffer = target._colorBuffer;
      if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.isWebGL2)) {
        // FIXME: if colorBuffer is a cubemap currently we're re-generating mipmaps after
        // updating each face!
        this.activeTexture(this.maxCombinedTextures - 1);
        this.bindTexture(colorBuffer);
        this.gl.generateMipmap(colorBuffer.impl._glTarget);
      }
    }
    DebugGraphics.popGpuMarker(this);
  }

  /**
   * Updates a texture's vertical flip.
   *
   * @param {boolean} flipY - True to flip the texture vertically.
   * @ignore
   */
  setUnpackFlipY(flipY) {
    if (this.unpackFlipY !== flipY) {
      this.unpackFlipY = flipY;

      // Note: the WebGL spec states that UNPACK_FLIP_Y_WEBGL only affects
      // texImage2D and texSubImage2D, not compressedTexImage2D
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    }
  }

  /**
   * Updates a texture to have its RGB channels premultiplied by its alpha channel or not.
   *
   * @param {boolean} premultiplyAlpha - True to premultiply the alpha channel against the RGB
   * channels.
   * @ignore
   */
  setUnpackPremultiplyAlpha(premultiplyAlpha) {
    if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
      this.unpackPremultiplyAlpha = premultiplyAlpha;

      // Note: the WebGL spec states that UNPACK_PREMULTIPLY_ALPHA_WEBGL only affects
      // texImage2D and texSubImage2D, not compressedTexImage2D
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    }
  }

  /**
   * Activate the specified texture unit.
   *
   * @param {number} textureUnit - The texture unit to activate.
   * @ignore
   */
  activeTexture(textureUnit) {
    if (this.textureUnit !== textureUnit) {
      this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
      this.textureUnit = textureUnit;
    }
  }

  /**
   * If the texture is not already bound on the currently active texture unit, bind it.
   *
   * @param {Texture} texture - The texture to bind.
   * @ignore
   */
  bindTexture(texture) {
    const impl = texture.impl;
    const textureTarget = impl._glTarget;
    const textureObject = impl._glTexture;
    const textureUnit = this.textureUnit;
    const slot = this.targetToSlot[textureTarget];
    if (this.textureUnits[textureUnit][slot] !== textureObject) {
      this.gl.bindTexture(textureTarget, textureObject);
      this.textureUnits[textureUnit][slot] = textureObject;
    }
  }

  /**
   * If the texture is not bound on the specified texture unit, active the texture unit and bind
   * the texture to it.
   *
   * @param {Texture} texture - The texture to bind.
   * @param {number} textureUnit - The texture unit to activate and bind the texture to.
   * @ignore
   */
  bindTextureOnUnit(texture, textureUnit) {
    const impl = texture.impl;
    const textureTarget = impl._glTarget;
    const textureObject = impl._glTexture;
    const slot = this.targetToSlot[textureTarget];
    if (this.textureUnits[textureUnit][slot] !== textureObject) {
      this.activeTexture(textureUnit);
      this.gl.bindTexture(textureTarget, textureObject);
      this.textureUnits[textureUnit][slot] = textureObject;
    }
  }

  /**
   * Update the texture parameters for a given texture if they have changed.
   *
   * @param {Texture} texture - The texture to update.
   * @ignore
   */
  setTextureParameters(texture) {
    const gl = this.gl;
    const flags = texture.impl.dirtyParameterFlags;
    const target = texture.impl._glTarget;
    if (flags & 1) {
      let filter = texture._minFilter;
      if (!texture.pot && !this.isWebGL2 || !texture._mipmaps || texture._compressed && texture._levels.length === 1) {
        if (filter === FILTER_NEAREST_MIPMAP_NEAREST || filter === FILTER_NEAREST_MIPMAP_LINEAR) {
          filter = FILTER_NEAREST;
        } else if (filter === FILTER_LINEAR_MIPMAP_NEAREST || filter === FILTER_LINEAR_MIPMAP_LINEAR) {
          filter = FILTER_LINEAR;
        }
      }
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.glFilter[filter]);
    }
    if (flags & 2) {
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
    }
    if (flags & 4) {
      if (this.isWebGL2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
      } else {
        // WebGL1 doesn't support all addressing modes with NPOT textures
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture.pot ? texture._addressU : ADDRESS_CLAMP_TO_EDGE]);
      }
    }
    if (flags & 8) {
      if (this.isWebGL2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
      } else {
        // WebGL1 doesn't support all addressing modes with NPOT textures
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture.pot ? texture._addressV : ADDRESS_CLAMP_TO_EDGE]);
      }
    }
    if (flags & 16) {
      if (this.isWebGL2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
      }
    }
    if (flags & 32) {
      if (this.isWebGL2) {
        gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, texture._compareOnRead ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE);
      }
    }
    if (flags & 64) {
      if (this.isWebGL2) {
        gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.glComparison[texture._compareFunc]);
      }
    }
    if (flags & 128) {
      const ext = this.extTextureFilterAnisotropic;
      if (ext) {
        gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, math.clamp(Math.round(texture._anisotropy), 1, this.maxAnisotropy));
      }
    }
  }

  /**
   * Sets the specified texture on the specified texture unit.
   *
   * @param {Texture} texture - The texture to set.
   * @param {number} textureUnit - The texture unit to set the texture on.
   * @ignore
   */
  setTexture(texture, textureUnit) {
    const impl = texture.impl;
    if (!impl._glTexture) impl.initialize(this, texture);
    if (impl.dirtyParameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {
      // Ensure the specified texture unit is active
      this.activeTexture(textureUnit);

      // Ensure the texture is bound on correct target of the specified texture unit
      this.bindTexture(texture);
      if (impl.dirtyParameterFlags) {
        this.setTextureParameters(texture);
        impl.dirtyParameterFlags = 0;
      }
      if (texture._needsUpload || texture._needsMipmapsUpload) {
        impl.upload(this, texture);
        texture._needsUpload = false;
        texture._needsMipmapsUpload = false;
      }
    } else {
      // Ensure the texture is currently bound to the correct target on the specified texture unit.
      // If the texture is already bound to the correct target on the specified unit, there's no need
      // to actually make the specified texture unit active because the texture itself does not need
      // to be updated.
      this.bindTextureOnUnit(texture, textureUnit);
    }
  }

  // function creates VertexArrayObject from list of vertex buffers
  createVertexArray(vertexBuffers) {
    let key, vao;

    // only use cache when more than 1 vertex buffer, otherwise it's unique
    const useCache = vertexBuffers.length > 1;
    if (useCache) {
      // generate unique key for the vertex buffers
      key = "";
      for (let i = 0; i < vertexBuffers.length; i++) {
        const vertexBuffer = vertexBuffers[i];
        key += vertexBuffer.id + vertexBuffer.format.renderingHash;
      }

      // try to get VAO from cache
      vao = this._vaoMap.get(key);
    }

    // need to create new vao
    if (!vao) {
      // create VA object
      const gl = this.gl;
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      // don't capture index buffer in VAO
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      let locZero = false;
      for (let i = 0; i < vertexBuffers.length; i++) {
        // bind buffer
        const vertexBuffer = vertexBuffers[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.impl.bufferId);

        // for each attribute
        const elements = vertexBuffer.format.elements;
        for (let j = 0; j < elements.length; j++) {
          const e = elements[j];
          const loc = semanticToLocation[e.name];
          if (loc === 0) {
            locZero = true;
          }
          if (e.asInt) {
            gl.vertexAttribIPointer(loc, e.numComponents, this.glType[e.dataType], e.stride, e.offset);
          } else {
            gl.vertexAttribPointer(loc, e.numComponents, this.glType[e.dataType], e.normalize, e.stride, e.offset);
          }
          gl.enableVertexAttribArray(loc);
          if (vertexBuffer.format.instancing) {
            gl.vertexAttribDivisor(loc, 1);
          }
        }
      }

      // end of VA object
      gl.bindVertexArray(null);

      // unbind any array buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      // add it to cache
      if (useCache) {
        this._vaoMap.set(key, vao);
      }
      if (!locZero) {
        Debug.warn("No vertex attribute is mapped to location 0, which might cause compatibility issues on Safari on MacOS - please use attribute SEMANTIC_POSITION or SEMANTIC_ATTR15");
      }
    }
    return vao;
  }
  unbindVertexArray() {
    // unbind VAO from device to protect it from being changed
    if (this.boundVao) {
      this.boundVao = null;
      this.gl.bindVertexArray(null);
    }
  }
  setBuffers() {
    const gl = this.gl;
    let vao;

    // create VAO for specified vertex buffers
    if (this.vertexBuffers.length === 1) {
      // single VB keeps its VAO
      const vertexBuffer = this.vertexBuffers[0];
      Debug.assert(vertexBuffer.device === this, "The VertexBuffer was not created using current GraphicsDevice");
      if (!vertexBuffer.impl.vao) {
        vertexBuffer.impl.vao = this.createVertexArray(this.vertexBuffers);
      }
      vao = vertexBuffer.impl.vao;
    } else {
      // obtain temporary VAO for multiple vertex buffers
      vao = this.createVertexArray(this.vertexBuffers);
    }

    // set active VAO
    if (this.boundVao !== vao) {
      this.boundVao = vao;
      gl.bindVertexArray(vao);
    }

    // empty array of vertex buffers
    this.vertexBuffers.length = 0;

    // Set the active index buffer object
    // Note: we don't cache this state and set it only when it changes, as VAO captures last bind buffer in it
    // and so we don't know what VAO sets it to.
    const bufferId = this.indexBuffer ? this.indexBuffer.impl.bufferId : null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
  }

  /**
   * Submits a graphical primitive to the hardware for immediate rendering.
   *
   * @param {object} primitive - Primitive object describing how to submit current vertex/index
   * buffers.
   * @param {number} primitive.type - The type of primitive to render. Can be:
   *
   * - {@link PRIMITIVE_POINTS}
   * - {@link PRIMITIVE_LINES}
   * - {@link PRIMITIVE_LINELOOP}
   * - {@link PRIMITIVE_LINESTRIP}
   * - {@link PRIMITIVE_TRIANGLES}
   * - {@link PRIMITIVE_TRISTRIP}
   * - {@link PRIMITIVE_TRIFAN}
   *
   * @param {number} primitive.base - The offset of the first index or vertex to dispatch in the
   * draw call.
   * @param {number} primitive.count - The number of indices or vertices to dispatch in the draw
   * call.
   * @param {boolean} [primitive.indexed] - True to interpret the primitive as indexed, thereby
   * using the currently set index buffer and false otherwise.
   * @param {number} [numInstances] - The number of instances to render when using
   * ANGLE_instanced_arrays. Defaults to 1.
   * @param {boolean} [keepBuffers] - Optionally keep the current set of vertex / index buffers /
   * VAO. This is used when rendering of multiple views, for example under WebXR.
   * @example
   * // Render a single, unindexed triangle
   * device.draw({
   *     type: pc.PRIMITIVE_TRIANGLES,
   *     base: 0,
   *     count: 3,
   *     indexed: false
   * });
   */
  draw(primitive, numInstances, keepBuffers) {
    const gl = this.gl;
    let sampler, samplerValue, texture, numTextures; // Samplers
    let uniform, scopeId, uniformVersion, programVersion; // Uniforms
    const shader = this.shader;
    if (!shader) return;
    const samplers = shader.impl.samplers;
    const uniforms = shader.impl.uniforms;

    // vertex buffers
    if (!keepBuffers) {
      this.setBuffers();
    }

    // Commit the shader program variables
    let textureUnit = 0;
    for (let i = 0, len = samplers.length; i < len; i++) {
      sampler = samplers[i];
      samplerValue = sampler.scopeId.value;
      if (!samplerValue) {
        const samplerName = sampler.scopeId.name;
        if (samplerName === 'uSceneDepthMap' || samplerName === 'uDepthMap') {
          Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneDepthMap / enable Depth Grabpass on the Camera Component to enable it.`);
        }
        if (samplerName === 'uSceneColorMap' || samplerName === 'texture_grabPass') {
          Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene color texture is not available. Use CameraComponent.requestSceneColorMap / enable Color Grabpass on the Camera Component to enable it.`);
        }
        Debug.errorOnce(`Shader [${shader.label}] requires texture sampler [${samplerName}] which has not been set, while rendering [${DebugGraphics.toString()}]`);

        // skip this draw call to avoid incorrect rendering / webgl errors
        return;
      }
      if (samplerValue instanceof Texture) {
        texture = samplerValue;
        this.setTexture(texture, textureUnit);
        if (this.renderTarget) {
          // Set breakpoint here to debug "Source and destination textures of the draw are the same" errors
          if (this.renderTarget._samples < 2) {
            if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer === texture) {
              Debug.error("Trying to bind current color buffer as a texture", {
                renderTarget: this.renderTarget,
                texture
              });
            } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer === texture) {
              Debug.error("Trying to bind current depth buffer as a texture", {
                texture
              });
            }
          }
        }
        if (sampler.slot !== textureUnit) {
          gl.uniform1i(sampler.locationId, textureUnit);
          sampler.slot = textureUnit;
        }
        textureUnit++;
      } else {
        // Array
        sampler.array.length = 0;
        numTextures = samplerValue.length;
        for (let j = 0; j < numTextures; j++) {
          texture = samplerValue[j];
          this.setTexture(texture, textureUnit);
          sampler.array[j] = textureUnit;
          textureUnit++;
        }
        gl.uniform1iv(sampler.locationId, sampler.array);
      }
    }

    // Commit any updated uniforms
    for (let i = 0, len = uniforms.length; i < len; i++) {
      uniform = uniforms[i];
      scopeId = uniform.scopeId;
      uniformVersion = uniform.version;
      programVersion = scopeId.versionObject.version;

      // Check the value is valid
      if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
        uniformVersion.globalId = programVersion.globalId;
        uniformVersion.revision = programVersion.revision;

        // Call the function to commit the uniform value
        if (scopeId.value !== null) {
          this.commitFunction[uniform.dataType](uniform, scopeId.value);
        }
      }
    }
    if (this.isWebGL2 && this.transformFeedbackBuffer) {
      // Enable TF, start writing to out buffer
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.impl.bufferId);
      gl.beginTransformFeedback(gl.POINTS);
    }
    const mode = this.glPrimitive[primitive.type];
    const count = primitive.count;
    if (primitive.indexed) {
      const indexBuffer = this.indexBuffer;
      Debug.assert(indexBuffer.device === this, "The IndexBuffer was not created using current GraphicsDevice");
      const format = indexBuffer.impl.glFormat;
      const offset = primitive.base * indexBuffer.bytesPerIndex;
      if (numInstances > 0) {
        gl.drawElementsInstanced(mode, count, format, offset, numInstances);
      } else {
        gl.drawElements(mode, count, format, offset);
      }
    } else {
      const first = primitive.base;
      if (numInstances > 0) {
        gl.drawArraysInstanced(mode, first, count, numInstances);
      } else {
        gl.drawArrays(mode, first, count);
      }
    }
    if (this.isWebGL2 && this.transformFeedbackBuffer) {
      // disable TF
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    }
    this._drawCallsPerFrame++;
    this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1 ? numInstances : 1);
  }

  /**
   * Clears the frame buffer of the currently set render target.
   *
   * @param {object} [options] - Optional options object that controls the behavior of the clear
   * operation defined as follows:
   * @param {number[]} [options.color] - The color to clear the color buffer to in the range 0 to
   * 1 for each component.
   * @param {number} [options.depth] - The depth value to clear the depth buffer to in the
   * range 0 to 1. Defaults to 1.
   * @param {number} [options.flags] - The buffers to clear (the types being color, depth and
   * stencil). Can be any bitwise combination of:
   *
   * - {@link CLEARFLAG_COLOR}
   * - {@link CLEARFLAG_DEPTH}
   * - {@link CLEARFLAG_STENCIL}
   *
   * @param {number} [options.stencil] - The stencil value to clear the stencil buffer to.
   * Defaults to 0.
   * @example
   * // Clear color buffer to black and depth buffer to 1
   * device.clear();
   *
   * // Clear just the color buffer to red
   * device.clear({
   *     color: [1, 0, 0, 1],
   *     flags: pc.CLEARFLAG_COLOR
   * });
   *
   * // Clear color buffer to yellow and depth to 1.0
   * device.clear({
   *     color: [1, 1, 0, 1],
   *     depth: 1,
   *     flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
   * });
   */
  clear(options) {
    var _options$flags;
    const defaultOptions = this.defaultClearOptions;
    options = options || defaultOptions;
    const flags = (_options$flags = options.flags) != null ? _options$flags : defaultOptions.flags;
    if (flags !== 0) {
      const gl = this.gl;

      // Set the clear color
      if (flags & CLEARFLAG_COLOR) {
        var _options$color;
        const color = (_options$color = options.color) != null ? _options$color : defaultOptions.color;
        const r = color[0];
        const g = color[1];
        const b = color[2];
        const a = color[3];
        const c = this.clearColor;
        if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
          this.gl.clearColor(r, g, b, a);
          this.clearColor.set(r, g, b, a);
        }
        this.setBlendState(BlendState.NOBLEND);
      }
      if (flags & CLEARFLAG_DEPTH) {
        var _options$depth;
        // Set the clear depth
        const depth = (_options$depth = options.depth) != null ? _options$depth : defaultOptions.depth;
        if (depth !== this.clearDepth) {
          this.gl.clearDepth(depth);
          this.clearDepth = depth;
        }
        this.setDepthState(DepthState.WRITEDEPTH);
      }
      if (flags & CLEARFLAG_STENCIL) {
        var _options$stencil;
        // Set the clear stencil
        const stencil = (_options$stencil = options.stencil) != null ? _options$stencil : defaultOptions.stencil;
        if (stencil !== this.clearStencil) {
          this.gl.clearStencil(stencil);
          this.clearStencil = stencil;
        }
      }

      // Clear the frame buffer
      gl.clear(this.glClearFlag[flags]);
    }
  }
  submit() {
    this.gl.flush();
  }

  /**
   * Reads a block of pixels from a specified rectangle of the current color framebuffer into an
   * ArrayBufferView object.
   *
   * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
   * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
   * @param {number} w - The width of the rectangle, in pixels.
   * @param {number} h - The height of the rectangle, in pixels.
   * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
   * data.
   * @ignore
   */
  readPixels(x, y, w, h, pixels) {
    const gl = this.gl;
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  /**
   * Asynchronously reads a block of pixels from a specified rectangle of the current color framebuffer
   * into an ArrayBufferView object.
   *
   * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
   * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
   * @param {number} w - The width of the rectangle, in pixels.
   * @param {number} h - The height of the rectangle, in pixels.
   * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
   * data.
   * @ignore
   */
  async readPixelsAsync(x, y, w, h, pixels) {
    var _this$renderTarget$co, _impl$_glFormat, _impl$_glPixelType;
    const gl = this.gl;
    if (!this.isWebGL2) {
      // async fences aren't supported on webgl1
      this.readPixels(x, y, w, h, pixels);
      return;
    }
    const clientWaitAsync = (flags, interval_ms) => {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this.submit();
      return new Promise((resolve, reject) => {
        function test() {
          const res = gl.clientWaitSync(sync, flags, 0);
          if (res === gl.WAIT_FAILED) {
            gl.deleteSync(sync);
            reject(new Error('webgl clientWaitSync sync failed'));
          } else if (res === gl.TIMEOUT_EXPIRED) {
            setTimeout(test, interval_ms);
          } else {
            gl.deleteSync(sync);
            resolve();
          }
        }
        test();
      });
    };
    const impl = (_this$renderTarget$co = this.renderTarget.colorBuffer) == null ? void 0 : _this$renderTarget$co.impl;
    const format = (_impl$_glFormat = impl == null ? void 0 : impl._glFormat) != null ? _impl$_glFormat : gl.RGBA;
    const pixelType = (_impl$_glPixelType = impl == null ? void 0 : impl._glPixelType) != null ? _impl$_glPixelType : gl.UNSIGNED_BYTE;

    // create temporary (gpu-side) buffer and copy data into it
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
    gl.readPixels(x, y, w, h, format, pixelType, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    // async wait for previous read to finish
    await clientWaitAsync(0, 20);

    // copy the resulting data once it's arrived
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteBuffer(buf);
  }

  /**
   * Enables or disables alpha to coverage (WebGL2 only).
   *
   * @param {boolean} state - True to enable alpha to coverage and false to disable it.
   * @ignore
   */
  setAlphaToCoverage(state) {
    if (this.isWebGL1) return;
    if (this.alphaToCoverage === state) return;
    this.alphaToCoverage = state;
    if (state) {
      this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
    } else {
      this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
    }
  }

  /**
   * Sets the output vertex buffer. It will be written to by a shader with transform feedback
   * varyings.
   *
   * @param {import('../vertex-buffer.js').VertexBuffer} tf - The output vertex buffer.
   * @ignore
   */
  setTransformFeedbackBuffer(tf) {
    if (this.transformFeedbackBuffer === tf) return;
    this.transformFeedbackBuffer = tf;
    if (this.isWebGL2) {
      const gl = this.gl;
      if (tf) {
        if (!this.feedback) {
          this.feedback = gl.createTransformFeedback();
        }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
      } else {
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      }
    }
  }

  /**
   * Toggles the rasterization render state. Useful with transform feedback, when you only need
   * to process the data without drawing.
   *
   * @param {boolean} on - True to enable rasterization and false to disable it.
   * @ignore
   */
  setRaster(on) {
    if (this.raster === on) return;
    this.raster = on;
    if (this.isWebGL2) {
      if (on) {
        this.gl.disable(this.gl.RASTERIZER_DISCARD);
      } else {
        this.gl.enable(this.gl.RASTERIZER_DISCARD);
      }
    }
  }
  setStencilTest(enable) {
    if (this.stencil !== enable) {
      const gl = this.gl;
      if (enable) {
        gl.enable(gl.STENCIL_TEST);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }
      this.stencil = enable;
    }
  }
  setStencilFunc(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask || this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      this.gl.stencilFunc(this.glComparison[func], ref, mask);
      this.stencilFuncFront = this.stencilFuncBack = func;
      this.stencilRefFront = this.stencilRefBack = ref;
      this.stencilMaskFront = this.stencilMaskBack = mask;
    }
  }
  setStencilFuncFront(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
      this.stencilFuncFront = func;
      this.stencilRefFront = ref;
      this.stencilMaskFront = mask;
    }
  }
  setStencilFuncBack(func, ref, mask) {
    if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
      this.stencilFuncBack = func;
      this.stencilRefBack = ref;
      this.stencilMaskBack = mask;
    }
  }
  setStencilOperation(fail, zfail, zpass, writeMask) {
    if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass || this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
      this.gl.stencilOp(this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailFront = this.stencilFailBack = fail;
      this.stencilZfailFront = this.stencilZfailBack = zfail;
      this.stencilZpassFront = this.stencilZpassBack = zpass;
    }
    if (this.stencilWriteMaskFront !== writeMask || this.stencilWriteMaskBack !== writeMask) {
      this.gl.stencilMask(writeMask);
      this.stencilWriteMaskFront = writeMask;
      this.stencilWriteMaskBack = writeMask;
    }
  }
  setStencilOperationFront(fail, zfail, zpass, writeMask) {
    if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass) {
      this.gl.stencilOpSeparate(this.gl.FRONT, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailFront = fail;
      this.stencilZfailFront = zfail;
      this.stencilZpassFront = zpass;
    }
    if (this.stencilWriteMaskFront !== writeMask) {
      this.gl.stencilMaskSeparate(this.gl.FRONT, writeMask);
      this.stencilWriteMaskFront = writeMask;
    }
  }
  setStencilOperationBack(fail, zfail, zpass, writeMask) {
    if (this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
      this.gl.stencilOpSeparate(this.gl.BACK, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailBack = fail;
      this.stencilZfailBack = zfail;
      this.stencilZpassBack = zpass;
    }
    if (this.stencilWriteMaskBack !== writeMask) {
      this.gl.stencilMaskSeparate(this.gl.BACK, writeMask);
      this.stencilWriteMaskBack = writeMask;
    }
  }
  setBlendState(blendState) {
    const currentBlendState = this.blendState;
    if (!currentBlendState.equals(blendState)) {
      const gl = this.gl;

      // state values to set
      const {
        blend,
        colorOp,
        alphaOp,
        colorSrcFactor,
        colorDstFactor,
        alphaSrcFactor,
        alphaDstFactor
      } = blendState;

      // enable blend
      if (currentBlendState.blend !== blend) {
        if (blend) {
          gl.enable(gl.BLEND);
        } else {
          gl.disable(gl.BLEND);
        }
      }

      // blend ops
      if (currentBlendState.colorOp !== colorOp || currentBlendState.alphaOp !== alphaOp) {
        const glBlendEquation = this.glBlendEquation;
        gl.blendEquationSeparate(glBlendEquation[colorOp], glBlendEquation[alphaOp]);
      }

      // blend factors
      if (currentBlendState.colorSrcFactor !== colorSrcFactor || currentBlendState.colorDstFactor !== colorDstFactor || currentBlendState.alphaSrcFactor !== alphaSrcFactor || currentBlendState.alphaDstFactor !== alphaDstFactor) {
        gl.blendFuncSeparate(this.glBlendFunctionColor[colorSrcFactor], this.glBlendFunctionColor[colorDstFactor], this.glBlendFunctionAlpha[alphaSrcFactor], this.glBlendFunctionAlpha[alphaDstFactor]);
      }

      // color write
      if (currentBlendState.allWrite !== blendState.allWrite) {
        this.gl.colorMask(blendState.redWrite, blendState.greenWrite, blendState.blueWrite, blendState.alphaWrite);
      }

      // update internal state
      currentBlendState.copy(blendState);
    }
  }

  /**
   * Set the source and destination blending factors.
   *
   * @param {number} r - The red component in the range of 0 to 1. Default value is 0.
   * @param {number} g - The green component in the range of 0 to 1. Default value is 0.
   * @param {number} b - The blue component in the range of 0 to 1. Default value is 0.
   * @param {number} a - The alpha component in the range of 0 to 1. Default value is 0.
   * @ignore
   */
  setBlendColor(r, g, b, a) {
    const c = this.blendColor;
    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      this.gl.blendColor(r, g, b, a);
      c.set(r, g, b, a);
    }
  }
  setStencilState(stencilFront, stencilBack) {
    if (stencilFront || stencilBack) {
      this.setStencilTest(true);
      if (stencilFront === stencilBack) {
        // identical front/back stencil
        this.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
        this.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
      } else {
        var _stencilFront, _stencilBack;
        // front
        (_stencilFront = stencilFront) != null ? _stencilFront : stencilFront = StencilParameters.DEFAULT;
        this.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
        this.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);

        // back
        (_stencilBack = stencilBack) != null ? _stencilBack : stencilBack = StencilParameters.DEFAULT;
        this.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
        this.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
      }
    } else {
      this.setStencilTest(false);
    }
  }
  setDepthState(depthState) {
    const currentDepthState = this.depthState;
    if (!currentDepthState.equals(depthState)) {
      const gl = this.gl;

      // write
      const write = depthState.write;
      if (currentDepthState.write !== write) {
        gl.depthMask(write);
      }

      // handle case where depth testing is off, but depth write is on => enable always test to depth write
      // Note on WebGL API behavior: When depth testing is disabled, writes to the depth buffer are also disabled.
      let {
        func,
        test
      } = depthState;
      if (!test && write) {
        test = true;
        func = FUNC_ALWAYS;
      }
      if (currentDepthState.func !== func) {
        gl.depthFunc(this.glComparison[func]);
      }
      if (currentDepthState.test !== test) {
        if (test) {
          gl.enable(gl.DEPTH_TEST);
        } else {
          gl.disable(gl.DEPTH_TEST);
        }
      }

      // depth bias
      const {
        depthBias,
        depthBiasSlope
      } = depthState;
      if (depthBias || depthBiasSlope) {
        // enable bias
        if (!this.depthBiasEnabled) {
          this.depthBiasEnabled = true;
          this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
        }

        // values
        gl.polygonOffset(depthBiasSlope, depthBias);
      } else {
        // disable bias
        if (this.depthBiasEnabled) {
          this.depthBiasEnabled = false;
          this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
        }
      }

      // update internal state
      currentDepthState.copy(depthState);
    }
  }
  setCullMode(cullMode) {
    if (this.cullMode !== cullMode) {
      if (cullMode === CULLFACE_NONE) {
        this.gl.disable(this.gl.CULL_FACE);
      } else {
        if (this.cullMode === CULLFACE_NONE) {
          this.gl.enable(this.gl.CULL_FACE);
        }
        const mode = this.glCull[cullMode];
        if (this.cullFace !== mode) {
          this.gl.cullFace(mode);
          this.cullFace = mode;
        }
      }
      this.cullMode = cullMode;
    }
  }

  /**
   * Sets the active shader to be used during subsequent draw calls.
   *
   * @param {Shader} shader - The shader to set to assign to the device.
   * @returns {boolean} True if the shader was successfully set, false otherwise.
   */
  setShader(shader) {
    if (shader !== this.shader) {
      if (shader.failed) {
        return false;
      } else if (!shader.ready && !shader.impl.finalize(this, shader)) {
        shader.failed = true;
        return false;
      }
      this.shader = shader;

      // Set the active shader
      this.gl.useProgram(shader.impl.glProgram);
      this._shaderSwitchesPerFrame++;
      this.attributesInvalidated = true;
    }
    return true;
  }

  /**
   * Frees memory from all vertex array objects ever allocated with this device.
   *
   * @ignore
   */
  clearVertexArrayObjectCache() {
    const gl = this.gl;
    this._vaoMap.forEach((item, key, mapObj) => {
      gl.deleteVertexArray(item);
    });
    this._vaoMap.clear();
  }

  /**
   * Fullscreen mode.
   *
   * @type {boolean}
   */
  set fullscreen(fullscreen) {
    if (fullscreen) {
      const canvas = this.gl.canvas;
      canvas.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
  get fullscreen() {
    return !!document.fullscreenElement;
  }

  /**
   * Check if high precision floating-point textures are supported.
   *
   * @type {boolean}
   */
  get textureFloatHighPrecision() {
    if (this._textureFloatHighPrecision === undefined) {
      this._textureFloatHighPrecision = testTextureFloatHighPrecision(this);
    }
    return this._textureFloatHighPrecision;
  }

  /**
   * Check if texture with half float format can be updated with data.
   *
   * @type {boolean}
   */
  get textureHalfFloatUpdatable() {
    if (this._textureHalfFloatUpdatable === undefined) {
      if (this.isWebGL2) {
        this._textureHalfFloatUpdatable = true;
      } else {
        this._textureHalfFloatUpdatable = testTextureHalfFloatUpdatable(this.gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
      }
    }
    return this._textureHalfFloatUpdatable;
  }

  // debug helper to force lost context
  debugLoseContext(sleep = 100) {
    const context = this.gl.getExtension('WEBGL_lose_context');
    context.loseContext();
    setTimeout(() => context.restoreContext(), sleep);
  }
}

export { WebglGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQ0xFQVJGTEFHX0NPTE9SLCBDTEVBUkZMQUdfREVQVEgsIENMRUFSRkxBR19TVEVOQ0lMLFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0FMV0FZUyxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIFVOSUZPUk1UWVBFX1VJTlQsIFVOSUZPUk1UWVBFX1VWRUMyLCBVTklGT1JNVFlQRV9VVkVDMywgVU5JRk9STVRZUEVfVVZFQzQsIFVOSUZPUk1UWVBFX0lURVhUVVJFMkQsIFVOSUZPUk1UWVBFX1VURVhUVVJFMkQsXG4gICAgVU5JRk9STVRZUEVfSVRFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9VVEVYVFVSRUNVQkUsIFVOSUZPUk1UWVBFX0lURVhUVVJFM0QsIFVOSUZPUk1UWVBFX1VURVhUVVJFM0QsIFVOSUZPUk1UWVBFX0lURVhUVVJFMkRfQVJSQVksXG4gICAgVU5JRk9STVRZUEVfVVRFWFRVUkUyRF9BUlJBWSwgVU5JRk9STVRZUEVfSU5UQVJSQVksIFVOSUZPUk1UWVBFX1VJTlRBUlJBWSwgVU5JRk9STVRZUEVfQk9PTEFSUkFZLCBVTklGT1JNVFlQRV9JVkVDMkFSUkFZLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMyQVJSQVksIFVOSUZPUk1UWVBFX1VWRUMyQVJSQVksIFVOSUZPUk1UWVBFX0lWRUMzQVJSQVksIFVOSUZPUk1UWVBFX0JWRUMzQVJSQVksIFVOSUZPUk1UWVBFX1VWRUMzQVJSQVksXG4gICAgVU5JRk9STVRZUEVfSVZFQzRBUlJBWSwgVU5JRk9STVRZUEVfQlZFQzRBUlJBWSwgVU5JRk9STVRZUEVfVVZFQzRBUlJBWSwgVU5JRk9STVRZUEVfTUFUNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvbixcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkRfQVJSQVksXG4gICAgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIERFVklDRVRZUEVfV0VCR0wyLFxuICAgIERFVklDRVRZUEVfV0VCR0wxXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuL3dlYmdsLXZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdsU2hhZGVyIH0gZnJvbSAnLi93ZWJnbC1zaGFkZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xUZXh0dXJlIH0gZnJvbSAnLi93ZWJnbC10ZXh0dXJlLmpzJztcbmltcG9ydCB7IFdlYmdsUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi93ZWJnbC1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vc2hhZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4uL2RlcHRoLXN0YXRlLmpzJztcbmltcG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcbmltcG9ydCB7IFdlYmdsR3B1UHJvZmlsZXIgfSBmcm9tICcuL3dlYmdsLWdwdS1wcm9maWxlci5qcyc7XG5cbmNvbnN0IGludmFsaWRhdGVBdHRhY2htZW50cyA9IFtdO1xuXG5jb25zdCBfZnVsbFNjcmVlblF1YWRWUyA9IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfcG9zaXRpb247XG52YXJ5aW5nIHZlYzIgdlV2MDtcbnZvaWQgbWFpbih2b2lkKVxue1xuICAgIGdsX1Bvc2l0aW9uID0gdmVjNCh2ZXJ0ZXhfcG9zaXRpb24sIDAuNSwgMS4wKTtcbiAgICB2VXYwID0gdmVydGV4X3Bvc2l0aW9uLnh5KjAuNSswLjU7XG59XG5gO1xuXG5jb25zdCBfcHJlY2lzaW9uVGVzdDFQUyA9IC8qIGdsc2wgKi9gXG52b2lkIG1haW4odm9pZCkgeyBcbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDIxNDc0ODM2NDguMCk7XG59XG5gO1xuXG5jb25zdCBfcHJlY2lzaW9uVGVzdDJQUyA9IC8qIGdsc2wgKi9gXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG52ZWM0IHBhY2tGbG9hdChmbG9hdCBkZXB0aCkge1xuICAgIGNvbnN0IHZlYzQgYml0X3NoaWZ0ID0gdmVjNCgyNTYuMCAqIDI1Ni4wICogMjU2LjAsIDI1Ni4wICogMjU2LjAsIDI1Ni4wLCAxLjApO1xuICAgIGNvbnN0IHZlYzQgYml0X21hc2sgID0gdmVjNCgwLjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjApO1xuICAgIHZlYzQgcmVzID0gbW9kKGRlcHRoICogYml0X3NoaWZ0ICogdmVjNCgyNTUpLCB2ZWM0KDI1NikgKSAvIHZlYzQoMjU1KTtcbiAgICByZXMgLT0gcmVzLnh4eXogKiBiaXRfbWFzaztcbiAgICByZXR1cm4gcmVzO1xufVxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBmbG9hdCBjID0gdGV4dHVyZTJEKHNvdXJjZSwgdmVjMigwLjApKS5yO1xuICAgIGZsb2F0IGRpZmYgPSBhYnMoYyAtIDIxNDc0ODM2NDguMCkgLyAyMTQ3NDgzNjQ4LjA7XG4gICAgZ2xfRnJhZ0NvbG9yID0gcGFja0Zsb2F0KGRpZmYpO1xufVxuYDtcblxuY29uc3QgX291dHB1dFRleHR1cmUyRCA9IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzIgdlV2MDtcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCk7XG59XG5gO1xuXG5mdW5jdGlvbiBxdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmdldCwgc2hhZGVyKSB7XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBcIlF1YWRXaXRoU2hhZGVyXCIpO1xuXG4gICAgY29uc3Qgb2xkUnQgPSBkZXZpY2UucmVuZGVyVGFyZ2V0O1xuICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgIGRldmljZS5zZXRDdWxsTW9kZShDVUxMRkFDRV9OT05FKTtcbiAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLk5PQkxFTkQpO1xuICAgIGRldmljZS5zZXREZXB0aFN0YXRlKERlcHRoU3RhdGUuTk9ERVBUSCk7XG4gICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShudWxsLCBudWxsKTtcblxuICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoZGV2aWNlLnF1YWRWZXJ0ZXhCdWZmZXIsIDApO1xuICAgIGRldmljZS5zZXRTaGFkZXIoc2hhZGVyKTtcblxuICAgIGRldmljZS5kcmF3KHtcbiAgICAgICAgdHlwZTogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgICAgICBiYXNlOiAwLFxuICAgICAgICBjb3VudDogNCxcbiAgICAgICAgaW5kZXhlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIGRldmljZS51cGRhdGVFbmQoKTtcblxuICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQob2xkUnQpO1xuICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbn1cblxuZnVuY3Rpb24gdGVzdFJlbmRlcmFibGUoZ2wsIHBpeGVsRm9ybWF0KSB7XG4gICAgbGV0IHJlc3VsdCA9IHRydWU7XG5cbiAgICAvLyBDcmVhdGUgYSAyeDIgdGV4dHVyZVxuICAgIGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIDIsIDIsIDAsIGdsLlJHQkEsIHBpeGVsRm9ybWF0LCBudWxsKTtcblxuICAgIC8vIFRyeSB0byB1c2UgdGhpcyB0ZXh0dXJlIGFzIGEgcmVuZGVyIHRhcmdldFxuICAgIGNvbnN0IGZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRleHR1cmUsIDApO1xuXG4gICAgLy8gSXQgaXMgbGVnYWwgZm9yIGEgV2ViR0wgaW1wbGVtZW50YXRpb24gZXhwb3NpbmcgdGhlIE9FU190ZXh0dXJlX2Zsb2F0IGV4dGVuc2lvbiB0b1xuICAgIC8vIHN1cHBvcnQgZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgYnV0IG5vdCBhcyBhdHRhY2htZW50cyB0byBmcmFtZWJ1ZmZlciBvYmplY3RzLlxuICAgIGlmIChnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKSAhPT0gZ2wuRlJBTUVCVUZGRVJfQ09NUExFVEUpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gdXBcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgICBnbC5kZWxldGVUZXh0dXJlKHRleHR1cmUpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlRnJhbWVidWZmZXIoZnJhbWVidWZmZXIpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoZ2wsIHBpeGVsRm9ybWF0KSB7XG4gICAgbGV0IHJlc3VsdCA9IHRydWU7XG5cbiAgICAvLyBDcmVhdGUgYSAyeDIgdGV4dHVyZVxuICAgIGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICAgIC8vIHVwbG9hZCBzb21lIGRhdGEgLSBvbiBpT1MgcHJpb3IgdG8gYWJvdXQgTm92ZW1iZXIgMjAxOSwgcGFzc2luZyBkYXRhIHRvIGhhbGYgdGV4dHVyZSB3b3VsZCBmYWlsIGhlcmVcbiAgICAvLyBzZWUgZGV0YWlscyBoZXJlOiBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTY5OTk5XG4gICAgLy8gbm90ZSB0aGF0IGlmIG5vdCBzdXBwb3J0ZWQsIHRoaXMgcHJpbnRzIGFuIGVycm9yIHRvIGNvbnNvbGUsIHRoZSBlcnJvciBjYW4gYmUgc2FmZWx5IGlnbm9yZWQgYXMgaXQncyBoYW5kbGVkXG4gICAgY29uc3QgZGF0YSA9IG5ldyBVaW50MTZBcnJheSg0ICogMiAqIDIpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIGRhdGEpO1xuXG4gICAgaWYgKGdsLmdldEVycm9yKCkgIT09IGdsLk5PX0VSUk9SKSB7XG4gICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkFib3ZlIGVycm9yIHJlbGF0ZWQgdG8gSEFMRl9GTE9BVF9PRVMgY2FuIGJlIGlnbm9yZWQsIGl0IHdhcyB0cmlnZ2VyZWQgYnkgdGVzdGluZyBoYWxmIGZsb2F0IHRleHR1cmUgc3VwcG9ydFwiKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbihkZXZpY2UpIHtcbiAgICBpZiAoIWRldmljZS50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBzaGFkZXIxID0gbmV3IFNoYWRlcihkZXZpY2UsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24oZGV2aWNlLCB7XG4gICAgICAgIG5hbWU6ICdwdGVzdDEnLFxuICAgICAgICB2ZXJ0ZXhDb2RlOiBfZnVsbFNjcmVlblF1YWRWUyxcbiAgICAgICAgZnJhZ21lbnRDb2RlOiBfcHJlY2lzaW9uVGVzdDFQU1xuICAgIH0pKTtcblxuICAgIGNvbnN0IHNoYWRlcjIgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogJ3B0ZXN0MicsXG4gICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICBmcmFnbWVudENvZGU6IF9wcmVjaXNpb25UZXN0MlBTXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdGV4dHVyZU9wdGlvbnMgPSB7XG4gICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICAgICAgd2lkdGg6IDEsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG5hbWU6ICd0ZXN0RkhQJ1xuICAgIH07XG4gICAgY29uc3QgdGV4MSA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcxID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgxLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBxdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmcxLCBzaGFkZXIxKTtcblxuICAgIHRleHR1cmVPcHRpb25zLmZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgIGNvbnN0IHRleDIgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHRleHR1cmVPcHRpb25zKTtcbiAgICBjb25zdCB0YXJnMiA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICBjb2xvckJ1ZmZlcjogdGV4MixcbiAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgfSk7XG4gICAgZGV2aWNlLmNvbnN0YW50VGV4U291cmNlLnNldFZhbHVlKHRleDEpO1xuICAgIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzIsIHNoYWRlcjIpO1xuXG4gICAgY29uc3QgcHJldkZyYW1lYnVmZmVyID0gZGV2aWNlLmFjdGl2ZUZyYW1lYnVmZmVyO1xuICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcih0YXJnMi5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcblxuICAgIGNvbnN0IHBpeGVscyA9IG5ldyBVaW50OEFycmF5KDQpO1xuICAgIGRldmljZS5yZWFkUGl4ZWxzKDAsIDAsIDEsIDEsIHBpeGVscyk7XG5cbiAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIocHJldkZyYW1lYnVmZmVyKTtcblxuICAgIGNvbnN0IHggPSBwaXhlbHNbMF0gLyAyNTU7XG4gICAgY29uc3QgeSA9IHBpeGVsc1sxXSAvIDI1NTtcbiAgICBjb25zdCB6ID0gcGl4ZWxzWzJdIC8gMjU1O1xuICAgIGNvbnN0IHcgPSBwaXhlbHNbM10gLyAyNTU7XG4gICAgY29uc3QgZiA9IHggLyAoMjU2ICogMjU2ICogMjU2KSArIHkgLyAoMjU2ICogMjU2KSArIHogLyAyNTYgKyB3O1xuXG4gICAgdGV4MS5kZXN0cm95KCk7XG4gICAgdGFyZzEuZGVzdHJveSgpO1xuICAgIHRleDIuZGVzdHJveSgpO1xuICAgIHRhcmcyLmRlc3Ryb3koKTtcbiAgICBzaGFkZXIxLmRlc3Ryb3koKTtcbiAgICBzaGFkZXIyLmRlc3Ryb3koKTtcblxuICAgIHJldHVybiBmID09PSAwO1xufVxuXG4vKipcbiAqIFRoZSBncmFwaGljcyBkZXZpY2UgbWFuYWdlcyB0aGUgdW5kZXJseWluZyBncmFwaGljcyBjb250ZXh0LiBJdCBpcyByZXNwb25zaWJsZSBmb3Igc3VibWl0dGluZ1xuICogcmVuZGVyIHN0YXRlIGNoYW5nZXMgYW5kIGdyYXBoaWNzIHByaW1pdGl2ZXMgdG8gdGhlIGhhcmR3YXJlLiBBIGdyYXBoaWNzIGRldmljZSBpcyB0aWVkIHRvIGFcbiAqIHNwZWNpZmljIGNhbnZhcyBIVE1MIGVsZW1lbnQuIEl0IGlzIHZhbGlkIHRvIGhhdmUgbW9yZSB0aGFuIG9uZSBjYW52YXMgZWxlbWVudCBwZXIgcGFnZSBhbmRcbiAqIGNyZWF0ZSBhIG5ldyBncmFwaGljcyBkZXZpY2UgYWdhaW5zdCBlYWNoLlxuICpcbiAqIEBhdWdtZW50cyBHcmFwaGljc0RldmljZVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIFdlYmdsR3JhcGhpY3NEZXZpY2UgZXh0ZW5kcyBHcmFwaGljc0RldmljZSB7XG4gICAgLyoqXG4gICAgICogVGhlIFdlYkdMIGNvbnRleHQgbWFuYWdlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBUaGUgdHlwZSBjb3VsZCBhbHNvIHRlY2huaWNhbGx5IGJlXG4gICAgICogYFdlYkdMUmVuZGVyaW5nQ29udGV4dGAgaWYgV2ViR0wgMi4wIGlzIG5vdCBhdmFpbGFibGUuIEJ1dCBpbiBvcmRlciBmb3IgSW50ZWxsaVNlbnNlIHRvIGJlXG4gICAgICogYWJsZSB0byBmdW5jdGlvbiBmb3IgYWxsIFdlYkdMIGNhbGxzIGluIHRoZSBjb2RlYmFzZSwgd2Ugc3BlY2lmeSBgV2ViR0wyUmVuZGVyaW5nQ29udGV4dGBcbiAgICAgKiBoZXJlIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViR0wyUmVuZGVyaW5nQ29udGV4dH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2w7XG5cbiAgICAvKipcbiAgICAgKiBXZWJHTEZyYW1lYnVmZmVyIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgdGhlIGJhY2tidWZmZXIgb2YgdGhlIGRldmljZSBmb3IgYSByZW5kZXJpbmcgZnJhbWUuXG4gICAgICogV2hlbiBudWxsLCB0aGlzIGlzIGEgZnJhbWVidWZmZXIgY3JlYXRlZCB3aGVuIHRoZSBkZXZpY2Ugd2FzIGNyZWF0ZWQsIG90aGVyd2lzZSBpdCBpcyBhXG4gICAgICogZnJhbWVidWZmZXIgc3VwcGxpZWQgYnkgdGhlIFhSIHNlc3Npb24uXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2RlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBkZWZhdWx0IGZyYW1lYnVmZmVyIGhhcyBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9kZWZhdWx0RnJhbWVidWZmZXJDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFdlYmdsR3JhcGhpY3NEZXZpY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIHRvIHdoaWNoIHRoZSBncmFwaGljcyBkZXZpY2Ugd2lsbCByZW5kZXIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgcGFzc2VkIHdoZW4gY3JlYXRpbmcgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbHBoYV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIHRoZSBjYW52YXMgY29udGFpbnMgYW5cbiAgICAgKiBhbHBoYSBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXB0aF0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBkZXB0aCBidWZmZXIgb2YgYXQgbGVhc3QgMTYgYml0cy4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWxdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgc3RlbmNpbCBidWZmZXIgb2YgYXQgbGVhc3QgOCBiaXRzLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYW50aWFsaWFzXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgd2hldGhlciBvciBub3QgdG8gcGVyZm9ybVxuICAgICAqIGFudGktYWxpYXNpbmcgaWYgcG9zc2libGUuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVtdWx0aXBsaWVkQWxwaGFdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwYWdlXG4gICAgICogY29tcG9zaXRvciB3aWxsIGFzc3VtZSB0aGUgZHJhd2luZyBidWZmZXIgY29udGFpbnMgY29sb3JzIHdpdGggcHJlLW11bHRpcGxpZWQgYWxwaGEuXG4gICAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZXNlcnZlRHJhd2luZ0J1ZmZlcl0gLSBJZiB0aGUgdmFsdWUgaXMgdHJ1ZSB0aGUgYnVmZmVycyB3aWxsIG5vdFxuICAgICAqIGJlIGNsZWFyZWQgYW5kIHdpbGwgcHJlc2VydmUgdGhlaXIgdmFsdWVzIHVudGlsIGNsZWFyZWQgb3Igb3ZlcndyaXR0ZW4gYnkgdGhlIGF1dGhvci5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0geydkZWZhdWx0J3wnaGlnaC1wZXJmb3JtYW5jZSd8J2xvdy1wb3dlcid9IFtvcHRpb25zLnBvd2VyUHJlZmVyZW5jZV0gLSBBIGhpbnQgdG8gdGhlXG4gICAgICogdXNlciBhZ2VudCBpbmRpY2F0aW5nIHdoYXQgY29uZmlndXJhdGlvbiBvZiBHUFUgaXMgc3VpdGFibGUgZm9yIHRoZSBXZWJHTCBjb250ZXh0LiBQb3NzaWJsZVxuICAgICAqIHZhbHVlcyBhcmU6XG4gICAgICpcbiAgICAgKiAtICdkZWZhdWx0JzogTGV0IHRoZSB1c2VyIGFnZW50IGRlY2lkZSB3aGljaCBHUFUgY29uZmlndXJhdGlvbiBpcyBtb3N0IHN1aXRhYmxlLiBUaGlzIGlzIHRoZVxuICAgICAqIGRlZmF1bHQgdmFsdWUuXG4gICAgICogLSAnaGlnaC1wZXJmb3JtYW5jZSc6IFByaW9yaXRpemVzIHJlbmRlcmluZyBwZXJmb3JtYW5jZSBvdmVyIHBvd2VyIGNvbnN1bXB0aW9uLlxuICAgICAqIC0gJ2xvdy1wb3dlcic6IFByaW9yaXRpemVzIHBvd2VyIHNhdmluZyBvdmVyIHJlbmRlcmluZyBwZXJmb3JtYW5jZS5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvICdkZWZhdWx0Jy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZhaWxJZk1ham9yUGVyZm9ybWFuY2VDYXZlYXRdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiBhXG4gICAgICogY29udGV4dCB3aWxsIGJlIGNyZWF0ZWQgaWYgdGhlIHN5c3RlbSBwZXJmb3JtYW5jZSBpcyBsb3cgb3IgaWYgbm8gaGFyZHdhcmUgR1BVIGlzIGF2YWlsYWJsZS5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZWZlcldlYkdsMl0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIGEgV2ViR2wyIGNvbnRleHQgc2hvdWxkXG4gICAgICogYmUgcHJlZmVycmVkLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVzeW5jaHJvbml6ZWRdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRoZSB1c2VyIGFnZW50IHRvIHJlZHVjZSB0aGVcbiAgICAgKiBsYXRlbmN5IGJ5IGRlc3luY2hyb25pemluZyB0aGUgY2FudmFzIHBhaW50IGN5Y2xlIGZyb20gdGhlIGV2ZW50IGxvb3AuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMueHJDb21wYXRpYmxlXSAtIEJvb2xlYW4gdGhhdCBoaW50cyB0byB0aGUgdXNlciBhZ2VudCB0byB1c2UgYVxuICAgICAqIGNvbXBhdGlibGUgZ3JhcGhpY3MgYWRhcHRlciBmb3IgYW4gaW1tZXJzaXZlIFhSIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge1dlYkdMUmVuZGVyaW5nQ29udGV4dCB8IFdlYkdMMlJlbmRlcmluZ0NvbnRleHR9IFtvcHRpb25zLmdsXSAtIFRoZSByZW5kZXJpbmcgY29udGV4dFxuICAgICAqIHRvIHVzZS4gSWYgbm90IHNwZWNpZmllZCwgYSBuZXcgY29udGV4dCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoY2FudmFzLCBvcHRpb25zKTtcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMuaW5pdE9wdGlvbnM7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSB0aGlzIGJlZm9yZSByZWdpc3RlcmluZyBsb3N0IGNvbnRleHQgaGFuZGxlcnMgdG8gYXZvaWQgdW5kZWZpbmVkIGFjY2VzcyB3aGVuIHRoZSBkZXZpY2UgaXMgY3JlYXRlZCBsb3N0LlxuICAgICAgICB0aGlzLmluaXRUZXh0dXJlVW5pdHMoKTtcblxuICAgICAgICAvLyBBZGQgaGFuZGxlcnMgZm9yIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgbG9zdCBvciByZXN0b3JlZFxuICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmxvc2VDb250ZXh0KCk7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coJ3BjLkdyYXBoaWNzRGV2aWNlOiBXZWJHTCBjb250ZXh0IGxvc3QuJyk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZWxvc3QnKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCByZXN0b3JlZC4nKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZUNvbnRleHQoKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGV2aWNlcmVzdG9yZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyAjNDEzNiAtIHR1cm4gb2ZmIGFudGlhbGlhc2luZyBvbiBBcHBsZVdlYktpdCBicm93c2VycyAxNS40XG4gICAgICAgIGNvbnN0IHVhID0gKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKSAmJiBuYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgICB0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcgPSB1YSAmJiB1YS5pbmNsdWRlcygnQXBwbGVXZWJLaXQnKSAmJiAodWEuaW5jbHVkZXMoJzE1LjQnKSB8fCB1YS5pbmNsdWRlcygnMTVfNCcpKTtcbiAgICAgICAgaWYgKHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZykge1xuICAgICAgICAgICAgb3B0aW9ucy5hbnRpYWxpYXMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcIkFudGlhbGlhc2luZyBoYXMgYmVlbiB0dXJuZWQgb2ZmIGR1ZSB0byByZW5kZXJpbmcgaXNzdWVzIG9uIEFwcGxlV2ViS2l0IDE1LjRcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjNTg1NiAtIHR1cm4gb2ZmIGFudGlhbGlhc2luZyBvbiBXaW5kb3dzIEZpcmVmb3hcbiAgICAgICAgaWYgKHBsYXRmb3JtLmJyb3dzZXJOYW1lID09PSAnZmlyZWZveCcgJiYgcGxhdGZvcm0ubmFtZSA9PT0gJ3dpbmRvd3MnKSB7XG4gICAgICAgICAgICBjb25zdCB1YSA9ICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogJyc7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IHVhLm1hdGNoKC9GaXJlZm94XFwvKFxcZCsoXFwuXFxkKykqKS8pO1xuICAgICAgICAgICAgY29uc3QgZmlyZWZveFZlcnNpb24gPSBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgICAgICAgICAgIGlmIChmaXJlZm94VmVyc2lvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSBwYXJzZUZsb2F0KGZpcmVmb3hWZXJzaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAodmVyc2lvbiA+PSAxMjAgfHwgdmVyc2lvbiA9PT0gMTE1KSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYW50aWFsaWFzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmxvZyhcIkFudGlhbGlhc2luZyBoYXMgYmVlbiB0dXJuZWQgb2ZmIGR1ZSB0byByZW5kZXJpbmcgaXNzdWVzIG9uIFdpbmRvd3MgRmlyZWZveCBlc3IxMTUgYW5kIDEyMCsuIEN1cnJlbnQgdmVyc2lvbjogXCIgKyBmaXJlZm94VmVyc2lvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGdsID0gbnVsbDtcblxuICAgICAgICAvLyB3ZSBhbHdheXMgYWxsb2NhdGUgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXIgd2l0aG91dCBhbnRpYWxpYXNpbmcsIHNvIHJlbW92ZSB0aGF0IG9wdGlvblxuICAgICAgICB0aGlzLmJhY2tCdWZmZXJBbnRpYWxpYXMgPSBvcHRpb25zLmFudGlhbGlhcyA/PyBmYWxzZTtcbiAgICAgICAgb3B0aW9ucy5hbnRpYWxpYXMgPSBmYWxzZTtcblxuICAgICAgICAvLyBSZXRyaWV2ZSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICBpZiAob3B0aW9ucy5nbCkge1xuICAgICAgICAgICAgZ2wgPSBvcHRpb25zLmdsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcHJlZmVyV2ViR2wyID0gKG9wdGlvbnMucHJlZmVyV2ViR2wyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcmVmZXJXZWJHbDIgOiB0cnVlO1xuICAgICAgICAgICAgY29uc3QgbmFtZXMgPSBwcmVmZXJXZWJHbDIgPyBbXCJ3ZWJnbDJcIiwgXCJ3ZWJnbFwiLCBcImV4cGVyaW1lbnRhbC13ZWJnbFwiXSA6IFtcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQobmFtZXNbaV0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmIChnbCkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWdsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXZWJHTCBub3Qgc3VwcG9ydGVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5nbCA9IGdsO1xuICAgICAgICB0aGlzLmlzV2ViR0wyID0gdHlwZW9mIFdlYkdMMlJlbmRlcmluZ0NvbnRleHQgIT09ICd1bmRlZmluZWQnICYmIGdsIGluc3RhbmNlb2YgV2ViR0wyUmVuZGVyaW5nQ29udGV4dDtcbiAgICAgICAgdGhpcy5pc1dlYkdMMSA9ICF0aGlzLmlzV2ViR0wyO1xuICAgICAgICB0aGlzLl9kZXZpY2VUeXBlID0gdGhpcy5pc1dlYkdMMiA/IERFVklDRVRZUEVfV0VCR0wyIDogREVWSUNFVFlQRV9XRUJHTDE7XG5cbiAgICAgICAgLy8gcGl4ZWwgZm9ybWF0IG9mIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICB0aGlzLnVwZGF0ZUJhY2tidWZmZXJGb3JtYXQobnVsbCk7XG5cbiAgICAgICAgY29uc3QgaXNDaHJvbWUgPSBwbGF0Zm9ybS5icm93c2VyTmFtZSA9PT0gJ2Nocm9tZSc7XG4gICAgICAgIGNvbnN0IGlzU2FmYXJpID0gcGxhdGZvcm0uYnJvd3Nlck5hbWUgPT09ICdzYWZhcmknO1xuICAgICAgICBjb25zdCBpc01hYyA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSAhPT0gLTE7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gaXNTYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0bG9zdFwiLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRyZXN0b3JlZFwiLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplRXh0ZW5zaW9ucygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDYXBhYmlsaXRpZXMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplUmVuZGVyU3RhdGUoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlQmFja2J1ZmZlcihudWxsKTtcblxuICAgICAgICAvLyBvbmx5IGVuYWJsZSBJbWFnZUJpdG1hcCBvbiBjaHJvbWVcbiAgICAgICAgdGhpcy5zdXBwb3J0c0ltYWdlQml0bWFwID0gIWlzU2FmYXJpICYmIHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCc7XG5cbiAgICAgICAgdGhpcy5nbEFkZHJlc3MgPSBbXG4gICAgICAgICAgICBnbC5SRVBFQVQsXG4gICAgICAgICAgICBnbC5DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgZ2wuTUlSUk9SRURfUkVQRUFUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRXF1YXRpb24gPSBbXG4gICAgICAgICAgICBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIGdsLkZVTkNfU1VCVFJBQ1QsXG4gICAgICAgICAgICBnbC5GVU5DX1JFVkVSU0VfU1VCVFJBQ1QsXG4gICAgICAgICAgICB0aGlzLmlzV2ViR0wyID8gZ2wuTUlOIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUlOX0VYVCA6IGdsLkZVTkNfQURELFxuICAgICAgICAgICAgdGhpcy5pc1dlYkdMMiA/IGdsLk1BWCA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1BWF9FWFQgOiBnbC5GVU5DX0FERFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQ29sb3IgPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYSA9IFtcbiAgICAgICAgICAgIGdsLlpFUk8sXG4gICAgICAgICAgICBnbC5PTkUsXG4gICAgICAgICAgICBnbC5TUkNfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuRFNUX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQSxcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQV9TQVRVUkFURSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5EU1RfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FULFxuICAgICAgICAgICAgZ2wuSEFMRl9GTE9BVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZSA9IHt9O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF0gICAgICAgICA9IFVOSUZPUk1UWVBFX0JPT0w7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRdICAgICAgICAgID0gVU5JRk9STVRZUEVfSU5UO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRdICAgICAgICA9IFVOSUZPUk1UWVBFX0ZMT0FUO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDMl0gICA9IFVOSUZPUk1UWVBFX1ZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMzXSAgID0gVU5JRk9STVRZUEVfVkVDMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzRdICAgPSBVTklGT1JNVFlQRV9WRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzJdICAgICA9IFVOSUZPUk1UWVBFX0lWRUMyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzNdICAgICA9IFVOSUZPUk1UWVBFX0lWRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzRdICAgICA9IFVOSUZPUk1UWVBFX0lWRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUMyXSAgICA9IFVOSUZPUk1UWVBFX0JWRUMyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUMzXSAgICA9IFVOSUZPUk1UWVBFX0JWRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUM0XSAgICA9IFVOSUZPUk1UWVBFX0JWRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUMl0gICA9IFVOSUZPUk1UWVBFX01BVDI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQzXSAgID0gVU5JRk9STVRZUEVfTUFUMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDRdICAgPSBVTklGT1JNVFlQRV9NQVQ0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8yRF0gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfQ1VCRV0gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRTtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlVOU0lHTkVEX0lOVF0gICAgICAgICA9IFVOSUZPUk1UWVBFX1VJTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5VTlNJR05FRF9JTlRfVkVDMl0gICAgPSBVTklGT1JNVFlQRV9VVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlVOU0lHTkVEX0lOVF9WRUMzXSAgICA9IFVOSUZPUk1UWVBFX1VWRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuVU5TSUdORURfSU5UX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfVVZFQzQ7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8yRF9BUlJBWV0gICAgPSBVTklGT1JNVFlQRV9URVhUVVJFMkRfQVJSQVk7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG5cbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfU0FNUExFUl8yRF0gICAgICAgICAgID0gVU5JRk9STVRZUEVfSVRFWFRVUkUyRDtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5VTlNJR05FRF9JTlRfU0FNUExFUl8yRF0gID0gVU5JRk9STVRZUEVfVVRFWFRVUkUyRDtcblxuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF9TQU1QTEVSX0NVQkVdICAgICAgICAgPSBVTklGT1JNVFlQRV9JVEVYVFVSRUNVQkU7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuVU5TSUdORURfSU5UX1NBTVBMRVJfMkRdICA9IFVOSUZPUk1UWVBFX1VURVhUVVJFQ1VCRTtcblxuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF9TQU1QTEVSXzNEXSAgICAgICAgICAgPSBVTklGT1JNVFlQRV9JVEVYVFVSRTNEO1xuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlVOU0lHTkVEX0lOVF9TQU1QTEVSXzNEXSAgPSBVTklGT1JNVFlQRV9VVEVYVFVSRTNEO1xuXG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1NBTVBMRVJfMkRfQVJSQVldICAgICA9IFVOSUZPUk1UWVBFX0lURVhUVVJFMkRfQVJSQVk7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuVU5TSUdORURfSU5UX1NBTVBMRVJfMkRfQVJSQVldID0gVU5JRk9STVRZUEVfVVRFWFRVUkUyRF9BUlJBWTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90ID0ge307XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfMkRdID0gMDtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV9DVUJFX01BUF0gPSAxO1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzNEXSA9IDI7XG5cbiAgICAgICAgLy8gRGVmaW5lIHRoZSB1bmlmb3JtIGNvbW1pdCBmdW5jdGlvbnNcbiAgICAgICAgbGV0IHNjb3BlWCwgc2NvcGVZLCBzY29wZVosIHNjb3BlVztcbiAgICAgICAgbGV0IHVuaWZvcm1WYWx1ZTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbiA9IFtdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JPT0xdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS52YWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWkodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lOVF0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JPT0xdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0ZMT0FUXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFmKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMyXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTJmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzNdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWikge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNF0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgc2NvcGVXID0gdmFsdWVbM107XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVogfHwgdW5pZm9ybVZhbHVlWzNdICE9PSBzY29wZVcpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtNGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVszXSA9IHNjb3BlVztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDMl0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTJpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMyXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMzXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWikge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0zaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzNdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM107XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzRdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgc2NvcGVXID0gdmFsdWVbM107XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVogfHwgdW5pZm9ybVZhbHVlWzNdICE9PSBzY29wZVcpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtNGl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVszXSA9IHNjb3BlVztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDNF0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQyXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgyZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDNdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDNmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUNF0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4NGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVEFSUkFZXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTFmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMyQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTJmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTNmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUM0QVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1VJTlRdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS52YWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMXVpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9VVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0ydWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVVZFQzNdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWikge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0zdWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1VWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTR1aXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzNdID0gc2NvcGVXO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSU5UQVJSQVldID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtMWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1VJTlRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xdWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JPT0xBUlJBWV0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lOVEFSUkFZXTtcblxuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTJpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9VVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0ydWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMyQVJSQVldID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDMkFSUkFZXTtcblxuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMzQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTNpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9VVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zdWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzQVJSQVldID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM0FSUkFZXTtcblxuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0QVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9VVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00dWl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUM0QVJSQVldID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNEFSUkFZXTtcblxuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRBUlJBWV0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4NGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnN1cHBvcnRzQm9uZVRleHR1cmVzID0gdGhpcy5leHRUZXh0dXJlRmxvYXQgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+IDA7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGFuIGVzdGltYXRlIG9mIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IGNhbiBiZSB1cGxvYWRlZCB0byB0aGUgR1BVXG4gICAgICAgIC8vIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm1zIGFuZCB0aGUgbnVtYmVyIG9mIHVuaWZvcm1zIHJlcXVpcmVkIGZvciBub24tXG4gICAgICAgIC8vIGJvbmUgZGF0YS4gIFRoaXMgaXMgYmFzZWQgb2ZmIG9mIHRoZSBTdGFuZGFyZCBzaGFkZXIuICBBIHVzZXIgZGVmaW5lZCBzaGFkZXIgbWF5IGhhdmVcbiAgICAgICAgLy8gZXZlbiBsZXNzIHNwYWNlIGF2YWlsYWJsZSBmb3IgYm9uZXMgc28gdGhpcyBjYWxjdWxhdGVkIHZhbHVlIGNhbiBiZSBvdmVycmlkZGVuIHZpYVxuICAgICAgICAvLyBwYy5HcmFwaGljc0RldmljZS5zZXRCb25lTGltaXQuXG4gICAgICAgIGxldCBudW1Vbmlmb3JtcyA9IHRoaXMudmVydGV4VW5pZm9ybXNDb3VudDtcbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gNCAqIDQ7IC8vIE1vZGVsLCB2aWV3LCBwcm9qZWN0aW9uIGFuZCBzaGFkb3cgbWF0cmljZXNcbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gODsgICAgIC8vIDggbGlnaHRzIG1heCwgZWFjaCBzcGVjaWZ5aW5nIGEgcG9zaXRpb24gdmVjdG9yXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDE7ICAgICAvLyBFeWUgcG9zaXRpb25cbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gNCAqIDQ7IC8vIFVwIHRvIDQgdGV4dHVyZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gTWF0aC5mbG9vcihudW1Vbmlmb3JtcyAvIDMpOyAgIC8vIGVhY2ggYm9uZSB1c2VzIDMgdW5pZm9ybXNcblxuICAgICAgICAvLyBQdXQgYSBsaW1pdCBvbiB0aGUgbnVtYmVyIG9mIHN1cHBvcnRlZCBib25lcyBiZWZvcmUgc2tpbiBwYXJ0aXRpb25pbmcgbXVzdCBiZSBwZXJmb3JtZWRcbiAgICAgICAgLy8gU29tZSBHUFVzIGhhdmUgZGVtb25zdHJhdGVkIHBlcmZvcm1hbmNlIGlzc3VlcyBpZiB0aGUgbnVtYmVyIG9mIHZlY3RvcnMgYWxsb2NhdGVkIHRvIHRoZVxuICAgICAgICAvLyBza2luIG1hdHJpeCBwYWxldHRlIGlzIGxlZnQgdW5ib3VuZGVkXG4gICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gTWF0aC5taW4odGhpcy5ib25lTGltaXQsIDEyOCk7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrZWRSZW5kZXJlciA9PT0gJ01hbGktNDUwIE1QJykge1xuICAgICAgICAgICAgdGhpcy5ib25lTGltaXQgPSAzNDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uc3RhbnRUZXhTb3VyY2UgPSB0aGlzLnNjb3BlLnJlc29sdmUoXCJzb3VyY2VcIik7XG5cbiAgICAgICAgaWYgKHRoaXMuZXh0VGV4dHVyZUZsb2F0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pc1dlYkdMMikge1xuICAgICAgICAgICAgICAgIC8vIEluIFdlYkdMMiBmbG9hdCB0ZXh0dXJlIHJlbmRlcmFiaWxpdHkgaXMgZGljdGF0ZWQgYnkgdGhlIEVYVF9jb2xvcl9idWZmZXJfZmxvYXQgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEluIFdlYkdMMSB3ZSBzaG91bGQganVzdCB0cnkgcmVuZGVyaW5nIGludG8gYSBmbG9hdCB0ZXh0dXJlXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gdGVzdFJlbmRlcmFibGUoZ2wsIGdsLkZMT0FUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHdvIGV4dGVuc2lvbnMgYWxsb3cgdXMgdG8gcmVuZGVyIHRvIGhhbGYgZmxvYXQgYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy5leHRDb2xvckJ1ZmZlckhhbGZGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckhhbGZGbG9hdDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0RlcHRoU2hhZG93ID0gdGhpcy5pc1dlYkdMMjtcblxuICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIGFyZWEgbGlnaHQgTFVUIGZvcm1hdCAtIG9yZGVyIG9mIHByZWZlcmVuY2U6IGhhbGYsIGZsb2F0LCA4Yml0XG4gICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgJiYgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlICYmIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyKSB7XG4gICAgICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG4gICAgfVxuXG4gICAgcG9zdEluaXQoKSB7XG4gICAgICAgIHN1cGVyLnBvc3RJbml0KCk7XG5cbiAgICAgICAgdGhpcy5ncHVQcm9maWxlciA9IG5ldyBXZWJnbEdwdVByb2ZpbGVyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAodGhpcy5pc1dlYkdMMiAmJiB0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVUcmFuc2Zvcm1GZWVkYmFjayh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlKCk7XG5cbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0bG9zdCcsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJnbGNvbnRleHRyZXN0b3JlZCcsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdsID0gbnVsbDtcblxuICAgICAgICBzdXBlci5wb3N0RGVzdHJveSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJhY2tidWZmZXIoZnJhbWVCdWZmZXIpIHtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1N0ZW5jaWwgPSB0aGlzLmluaXRPcHRpb25zLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICBuYW1lOiAnV2ViZ2xGcmFtZWJ1ZmZlcicsXG4gICAgICAgICAgICBncmFwaGljc0RldmljZTogdGhpcyxcbiAgICAgICAgICAgIGRlcHRoOiB0aGlzLmluaXRPcHRpb25zLmRlcHRoLFxuICAgICAgICAgICAgc3RlbmNpbDogdGhpcy5zdXBwb3J0c1N0ZW5jaWwsXG4gICAgICAgICAgICBzYW1wbGVzOiB0aGlzLnNhbXBsZXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdXNlIHRoZSBkZWZhdWx0IFdlYkdMIGZyYW1lYnVmZmVyIGZvciByZW5kZXJpbmdcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLmltcGwuc3VwcGxpZWRDb2xvckZyYW1lYnVmZmVyID0gZnJhbWVCdWZmZXI7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGZyYW1lYnVmZmVyIGZvcm1hdCBiYXNlZCBvbiB0aGUgY3VycmVudCBmcmFtZWJ1ZmZlciwgYXMgdGhpcyBpcyB1c2UgdG8gY3JlYXRlIG1hdGNoaW5nIG11bHRpLXNhbXBsZWQgZnJhbWVidWZmZXJcbiAgICB1cGRhdGVCYWNrYnVmZmVyRm9ybWF0KGZyYW1lYnVmZmVyKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBmcmFtZWJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IGFscGhhQml0cyA9IHRoaXMuZ2wuZ2V0UGFyYW1ldGVyKHRoaXMuZ2wuQUxQSEFfQklUUyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlckZvcm1hdCA9IGFscGhhQml0cyA/IFBJWEVMRk9STUFUX1JHQkE4IDogUElYRUxGT1JNQVRfUkdCODtcbiAgICB9XG5cbiAgICB1cGRhdGVCYWNrYnVmZmVyKCkge1xuXG4gICAgICAgIGNvbnN0IHJlc29sdXRpb25DaGFuZ2VkID0gdGhpcy5jYW52YXMud2lkdGggIT09IHRoaXMuYmFja0J1ZmZlclNpemUueCB8fCB0aGlzLmNhbnZhcy5oZWlnaHQgIT09IHRoaXMuYmFja0J1ZmZlclNpemUueTtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlckNoYW5nZWQgfHwgcmVzb2x1dGlvbkNoYW5nZWQpIHtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXIgY2hhbmdlcyAoZW50ZXJpbmcgb3IgZXhpdGluZyBYUiBmb3IgZXhhbXBsZSlcbiAgICAgICAgICAgIGlmICh0aGlzLl9kZWZhdWx0RnJhbWVidWZmZXJDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVCYWNrYnVmZmVyRm9ybWF0KHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlckNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuYmFja0J1ZmZlclNpemUuc2V0KHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgICAgICAvLyByZWNyZWF0ZSB0aGUgYmFja2J1ZmZlciB3aXRoIG5ld2x5IHN1cHBsaWVkIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICB0aGlzLmJhY2tCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jcmVhdGVCYWNrYnVmZmVyKHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIGlmIChwbGF0Zm9ybS5icm93c2VyICYmIHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBjb25zdCBsYWJlbCA9IERlYnVnR3JhcGhpY3MudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcihgJHtsYWJlbH0gI2ApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9wTWFya2VyKCkge1xuICAgICAgICBpZiAocGxhdGZvcm0uYnJvd3NlciAmJiB3aW5kb3cuc3BlY3Rvcikge1xuICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBpZiAobGFiZWwubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcihgJHtsYWJlbH0gI2ApO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLmNsZWFyTWFya2VyKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBRdWVyeSB0aGUgcHJlY2lzaW9uIHN1cHBvcnRlZCBieSBpbnRzIGFuZCBmbG9hdHMgaW4gdmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzLiBOb3RlIHRoYXRcbiAgICAgKiBnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQgaXMgbm90IGd1YXJhbnRlZWQgdG8gYmUgcHJlc2VudCAoc3VjaCBhcyBzb21lIGluc3RhbmNlcyBvZiB0aGVcbiAgICAgKiBkZWZhdWx0IEFuZHJvaWQgYnJvd3NlcikuIEluIHRoaXMgY2FzZSwgYXNzdW1lIGhpZ2hwIGlzIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFwiaGlnaHBcIiwgXCJtZWRpdW1wXCIgb3IgXCJsb3dwXCJcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0UHJlY2lzaW9uKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBwcmVjaXNpb24gPSBcImhpZ2hwXCI7XG5cbiAgICAgICAgaWYgKGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdCkge1xuICAgICAgICAgICAgY29uc3QgdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5WRVJURVhfU0hBREVSLCBnbC5ISUdIX0ZMT0FUKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5WRVJURVhfU0hBREVSLCBnbC5NRURJVU1fRkxPQVQpO1xuXG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuRlJBR01FTlRfU0hBREVSLCBnbC5ISUdIX0ZMT0FUKTtcbiAgICAgICAgICAgIGNvbnN0IGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgaWYgKHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgJiYgdmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0ICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCAmJiBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCkge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgaGlnaHBBdmFpbGFibGUgPSB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0LnByZWNpc2lvbiA+IDAgJiYgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0LnByZWNpc2lvbiA+IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVkaXVtcEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDA7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWhpZ2hwQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZWRpdW1wQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcIm1lZGl1bXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBub3Qgc3VwcG9ydGVkLCB1c2luZyBtZWRpdW1wXCIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJsb3dwXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiV0FSTklORzogaGlnaHAgYW5kIG1lZGl1bXAgbm90IHN1cHBvcnRlZCwgdXNpbmcgbG93cFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVjaXNpb247XG4gICAgfVxuXG4gICAgZ2V0RXh0ZW5zaW9uKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3VwcG9ydGVkRXh0ZW5zaW9ucy5pbmRleE9mKGFyZ3VtZW50c1tpXSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZ2V0RXh0ZW5zaW9uKGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBnZXQgZXh0RGlzam9pbnRUaW1lclF1ZXJ5KCkge1xuICAgICAgICAvLyBsYXp5IGV2YWx1YXRpb24gYXMgdGhpcyBpcyBub3QgdHlwaWNhbGx5IHVzZWRcbiAgICAgICAgaWYgKCF0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgLy8gTm90ZSB0aGF0IEZpcmVmb3ggZXhwb3NlcyBFWFRfZGlzam9pbnRfdGltZXJfcXVlcnkgdW5kZXIgV2ViR0wyIHJhdGhlciB0aGFuIEVYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDJcbiAgICAgICAgICAgICAgICB0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMicsICdFWFRfZGlzam9pbnRfdGltZXJfcXVlcnknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZXh0RGlzam9pbnRUaW1lclF1ZXJ5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIGV4dGVuc2lvbnMgcHJvdmlkZWQgYnkgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgdGhpcy5zdXBwb3J0ZWRFeHRlbnNpb25zID0gZ2wuZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucygpID8/IFtdO1xuICAgICAgICB0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5kcmF3QnVmZmVycyA9IGdsLmRyYXdCdWZmZXJzLmJpbmQoZ2wpO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0RmlsdGVyYWJsZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfY29sb3JfYnVmZmVyX2Zsb2F0Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVSRzExQjEwUmVuZGVyYWJsZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfYmxlbmRfbWlubWF4XCIpO1xuICAgICAgICAgICAgdGhpcy5leHREcmF3QnVmZmVycyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiQU5HTEVfaW5zdGFuY2VkX2FycmF5c1wiKTtcbiAgICAgICAgICAgIHRoaXMuZHJhd0J1ZmZlcnMgPSB0aGlzLmV4dERyYXdCdWZmZXJzPy5kcmF3QnVmZmVyc1dFQkdMLmJpbmQodGhpcy5leHREcmF3QnVmZmVycyk7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfc3RhbmRhcmRfZGVyaXZhdGl2ZXNcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX3NoYWRlcl90ZXh0dXJlX2xvZCcpO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX2VsZW1lbnRfaW5kZXhfdWludFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfaGFsZl9mbG9hdFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhciA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfaGFsZl9mbG9hdF9saW5lYXJcIik7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRGaWx0ZXJhYmxlID0gISF0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3JlbmRlcmVyX2luZm8nKTtcblxuICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhciA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRfbGluZWFyXCIpO1xuICAgICAgICB0aGlzLnRleHR1cmVGbG9hdEZpbHRlcmFibGUgPSAhIXRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyO1xuXG4gICAgICAgIHRoaXMuZXh0RmxvYXRCbGVuZCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnLCAnV0VCS0lUX0VYVF90ZXh0dXJlX2ZpbHRlcl9hbmlzb3Ryb3BpYycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDMSA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfZXRjMScpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycsICdXRUJLSVRfV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3B2cnRjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJywgJ1dFQktJVF9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfczN0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlQVRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2FzdGMnKTtcbiAgICAgICAgdGhpcy5leHRQYXJhbGxlbFNoYWRlckNvbXBpbGUgPSB0aGlzLmdldEV4dGVuc2lvbignS0hSX3BhcmFsbGVsX3NoYWRlcl9jb21waWxlJyk7XG5cbiAgICAgICAgLy8gaU9TIGV4cG9zZXMgdGhpcyBmb3IgaGFsZiBwcmVjaXNpb24gcmVuZGVyIHRhcmdldHMgb24gYm90aCBXZWJnbDEgYW5kIDIgZnJvbSBpT1MgdiAxNC41YmV0YVxuICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnM/LmFudGlhbGlhcyA/PyBmYWxzZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1N0ZW5jaWwgPSBjb250ZXh0QXR0cmlicz8uc3RlbmNpbCA/PyBmYWxzZTtcblxuICAgICAgICB0aGlzLnN1cHBvcnRzSW5zdGFuY2luZyA9ICEhdGhpcy5leHRJbnN0YW5jaW5nO1xuXG4gICAgICAgIC8vIFF1ZXJ5IHBhcmFtZXRlciB2YWx1ZXMgZnJvbSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICB0aGlzLm1heFRleHR1cmVTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpO1xuICAgICAgICB0aGlzLm1heEN1YmVNYXBTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9DVUJFX01BUF9URVhUVVJFX1NJWkUpO1xuICAgICAgICB0aGlzLm1heFJlbmRlckJ1ZmZlclNpemUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1JFTkRFUkJVRkZFUl9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlcyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMubWF4Q29tYmluZWRUZXh0dXJlcyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ09NQklORURfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1ZFUlRFWF9URVhUVVJFX0lNQUdFX1VOSVRTKTtcbiAgICAgICAgdGhpcy52ZXJ0ZXhVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVU5JRk9STV9WRUNUT1JTKTtcbiAgICAgICAgdGhpcy5mcmFnbWVudFVuaWZvcm1zQ291bnQgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0ZSQUdNRU5UX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9EUkFXX0JVRkZFUlMpO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9DT0xPUl9BVFRBQ0hNRU5UUyk7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYXzNEX1RFWFRVUkVfU0laRSk7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzTXJ0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuc3VwcG9ydHNWb2x1bWVUZXh0dXJlcyA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHQgPSB0aGlzLmV4dERyYXdCdWZmZXJzO1xuICAgICAgICAgICAgdGhpcy5zdXBwb3J0c01ydCA9ICEhZXh0O1xuICAgICAgICAgICAgdGhpcy5tYXhEcmF3QnVmZmVycyA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX0RSQVdfQlVGRkVSU19XRUJHTCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfV0VCR0wpIDogMTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICBleHQgPSB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvO1xuICAgICAgICB0aGlzLnVubWFza2VkUmVuZGVyZXIgPSBleHQgPyBnbC5nZXRQYXJhbWV0ZXIoZXh0LlVOTUFTS0VEX1JFTkRFUkVSX1dFQkdMKSA6ICcnO1xuICAgICAgICB0aGlzLnVubWFza2VkVmVuZG9yID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9WRU5ET1JfV0VCR0wpIDogJyc7XG5cbiAgICAgICAgLy8gTWFsaS1HNTIgaGFzIHJlbmRlcmluZyBpc3N1ZXMgd2l0aCBHUFUgcGFydGljbGVzIGluY2x1ZGluZ1xuICAgICAgICAvLyBTTS1BMjI1TSwgTTIwMDNKMTVTQyBhbmQgS0ZSQVdJIChBbWF6b24gRmlyZSBIRCA4IDIwMjIpXG4gICAgICAgIGNvbnN0IG1hbGlSZW5kZXJlclJlZ2V4ID0gL1xcYk1hbGktRzUyKy87XG5cbiAgICAgICAgLy8gU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXIgaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSkgJiZcbiAgICAgICAgICAgICEodGhpcy51bm1hc2tlZFJlbmRlcmVyLm1hdGNoKG1hbGlSZW5kZXJlclJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgY29uc3QgYW50aWFsaWFzU3VwcG9ydGVkID0gdGhpcy5pc1dlYkdMMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSBhbnRpYWxpYXNTdXBwb3J0ZWQgPyBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1NBTVBMRVMpIDogMTtcblxuICAgICAgICAvLyBzb21lIGRldmljZXMgaW5jb3JyZWN0bHkgcmVwb3J0IG1heCBzYW1wbGVzIGxhcmdlciB0aGFuIDRcbiAgICAgICAgdGhpcy5tYXhTYW1wbGVzID0gTWF0aC5taW4odGhpcy5tYXhTYW1wbGVzLCA0KTtcblxuICAgICAgICAvLyB3ZSBoYW5kbGUgYW50aS1hbGlhc2luZyBpbnRlcm5hbGx5IGJ5IGFsbG9jYXRpbmcgbXVsdGktc2FtcGxlZCBiYWNrYnVmZmVyXG4gICAgICAgIHRoaXMuc2FtcGxlcyA9IGFudGlhbGlhc1N1cHBvcnRlZCAmJiB0aGlzLmJhY2tCdWZmZXJBbnRpYWxpYXMgPyB0aGlzLm1heFNhbXBsZXMgOiAxO1xuXG4gICAgICAgIC8vIERvbid0IGFsbG93IGFyZWEgbGlnaHRzIG9uIG9sZCBhbmRyb2lkIGRldmljZXMsIHRoZXkgb2Z0ZW4gZmFpbCB0byBjb21waWxlIHRoZSBzaGFkZXIsIHJ1biBpdCBpbmNvcnJlY3RseSBvciBhcmUgdmVyeSBzbG93LlxuICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IHRoaXMuaXNXZWJHTDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gc3VwcG9ydHMgdGV4dHVyZSBmZXRjaCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnN1cHBvcnRzVGV4dHVyZUZldGNoID0gdGhpcy5pc1dlYkdMMjtcblxuICAgICAgICAvLyBBbHNvIGRvIG5vdCBhbGxvdyB0aGVtIHdoZW4gd2Ugb25seSBoYXZlIHNtYWxsIG51bWJlciBvZiB0ZXh0dXJlIHVuaXRzXG4gICAgICAgIGlmICh0aGlzLm1heFRleHR1cmVzIDw9IDgpIHtcbiAgICAgICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGluaXRpYWwgcmVuZGVyIHN0YXRlIG9uIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRpYWxpemVSZW5kZXJTdGF0ZSgpIHtcbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG5cbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcmVuZGVyIHN0YXRlIHRvIGEga25vd24gc3RhcnQgc3RhdGVcblxuICAgICAgICAvLyBkZWZhdWx0IGJsZW5kIHN0YXRlXG4gICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIGdsLmVuYWJsZShnbC5DVUxMX0ZBQ0UpO1xuICAgICAgICBnbC5jdWxsRmFjZShnbC5CQUNLKTtcblxuICAgICAgICAvLyBkZWZhdWx0IGRlcHRoIHN0YXRlXG4gICAgICAgIGdsLmVuYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICAgICAgZ2wuZGVwdGhGdW5jKGdsLkxFUVVBTCk7XG4gICAgICAgIGdsLmRlcHRoTWFzayh0cnVlKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IDA7XG4gICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLCAwLCAweEZGKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSAweEZGO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsIGdsLktFRVAsIGdsLktFRVApO1xuICAgICAgICBnbC5zdGVuY2lsTWFzaygweEZGKTtcblxuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnJhc3RlciA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcblxuICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSAxO1xuICAgICAgICBnbC5jbGVhckRlcHRoKDEpO1xuXG4gICAgICAgIHRoaXMuY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgZ2wuY2xlYXJDb2xvcigwLCAwLCAwLCAwKTtcblxuICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IDA7XG4gICAgICAgIGdsLmNsZWFyU3RlbmNpbCgwKTtcblxuICAgICAgICBpZiAodGhpcy5pc1dlYkdMMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRUZXh0dXJlVW5pdHMoY291bnQgPSAxNikge1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzLnB1c2goW251bGwsIG51bGwsIG51bGxdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLmluaXRUZXh0dXJlVW5pdHModGhpcy5tYXhDb21iaW5lZFRleHR1cmVzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG5cbiAgICAgICAgLy8gZm9yY2UgdGhlIGJhY2tidWZmZXIgdG8gYmUgcmVjcmVhdGVkIG9uIHJlc3RvcmVcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyU2l6ZS5zZXQoLTEsIC0xKTtcblxuICAgICAgICAvLyByZWxlYXNlIHNoYWRlcnNcbiAgICAgICAgZm9yIChjb25zdCBzaGFkZXIgb2YgdGhpcy5zaGFkZXJzKSB7XG4gICAgICAgICAgICBzaGFkZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbGVhc2UgdGV4dHVyZXNcbiAgICAgICAgZm9yIChjb25zdCB0ZXh0dXJlIG9mIHRoaXMudGV4dHVyZXMpIHtcbiAgICAgICAgICAgIHRleHR1cmUubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbGVhc2UgdmVydGV4IGFuZCBpbmRleCBidWZmZXJzXG4gICAgICAgIGZvciAoY29uc3QgYnVmZmVyIG9mIHRoaXMuYnVmZmVycykge1xuICAgICAgICAgICAgYnVmZmVyLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNldCBhbGwgcmVuZGVyIHRhcmdldHMgc28gdGhleSdsbCBiZSByZWNyZWF0ZWQgYXMgcmVxdWlyZWQuXG4gICAgICAgIC8vIFRPRE86IGEgc29sdXRpb24gZm9yIHRoZSBjYXNlIHdoZXJlIGEgcmVuZGVyIHRhcmdldCBjb250YWlucyBzb21ldGhpbmdcbiAgICAgICAgLy8gdGhhdCB3YXMgcHJldmlvdXNseSBnZW5lcmF0ZWQgdGhhdCBuZWVkcyB0byBiZSByZS1yZW5kZXJlZC5cbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXRzKSB7XG4gICAgICAgICAgICB0YXJnZXQubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXI/Lmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXI/LnJlc3RvcmVDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIGFmdGVyIGEgYmF0Y2ggb2Ygc2hhZGVycyB3YXMgY3JlYXRlZCwgdG8gZ3VpZGUgaW4gdGhlaXIgb3B0aW1hbCBwcmVwYXJhdGlvbiBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFNoYWRlckJhdGNoKCkge1xuICAgICAgICBXZWJnbFNoYWRlci5lbmRTaGFkZXJCYXRjaCh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGFjdGl2ZSByZWN0YW5nbGUgZm9yIHJlbmRlcmluZyBvbiB0aGUgc3BlY2lmaWVkIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHBpeGVsIHNwYWNlIHgtY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSBwaXhlbCBzcGFjZSB5LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgdmlld3BvcnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHZpZXdwb3J0IGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHZpZXdwb3J0IGluIHBpeGVscy5cbiAgICAgKi9cbiAgICBzZXRWaWV3cG9ydCh4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy52eCAhPT0geCkgfHwgKHRoaXMudnkgIT09IHkpIHx8ICh0aGlzLnZ3ICE9PSB3KSB8fCAodGhpcy52aCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wudmlld3BvcnQoeCwgeSwgdywgaCk7XG4gICAgICAgICAgICB0aGlzLnZ4ID0geDtcbiAgICAgICAgICAgIHRoaXMudnkgPSB5O1xuICAgICAgICAgICAgdGhpcy52dyA9IHc7XG4gICAgICAgICAgICB0aGlzLnZoID0gaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHNjaXNzb3IgcmVjdGFuZ2xlIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFNjaXNzb3IoeCwgeSwgdywgaCkge1xuICAgICAgICBpZiAoKHRoaXMuc3ggIT09IHgpIHx8ICh0aGlzLnN5ICE9PSB5KSB8fCAodGhpcy5zdyAhPT0gdykgfHwgKHRoaXMuc2ggIT09IGgpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnNjaXNzb3IoeCwgeSwgdywgaCk7XG4gICAgICAgICAgICB0aGlzLnN4ID0geDtcbiAgICAgICAgICAgIHRoaXMuc3kgPSB5O1xuICAgICAgICAgICAgdGhpcy5zdyA9IHc7XG4gICAgICAgICAgICB0aGlzLnNoID0gaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJpbmRzIHRoZSBzcGVjaWZpZWQgZnJhbWVidWZmZXIgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtXZWJHTEZyYW1lYnVmZmVyIHwgbnVsbH0gZmIgLSBUaGUgZnJhbWVidWZmZXIgdG8gYmluZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RnJhbWVidWZmZXIoZmIpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlRnJhbWVidWZmZXIgIT09IGZiKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGZiKTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlRnJhbWVidWZmZXIgPSBmYjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBzb3VyY2UgcmVuZGVyIHRhcmdldCBpbnRvIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIE1vc3RseSB1c2VkIGJ5IHBvc3QtZWZmZWN0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbc291cmNlXSAtIFRoZSBzb3VyY2UgcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbZGVzdF0gLSBUaGUgZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NvbG9yXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBjb2xvciBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjb3B5IHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgY29weVJlbmRlclRhcmdldChzb3VyY2UsIGRlc3QsIGNvbG9yLCBkZXB0aCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgLy8gaWYgY29weWluZyBmcm9tIHRoZSBiYWNrYnVmZmVyXG4gICAgICAgIGlmIChzb3VyY2UgPT09IHRoaXMuYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgc291cmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5pc1dlYkdMMiAmJiBkZXB0aCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJEZXB0aCBpcyBub3QgY29weWFibGUgb24gV2ViR0wgMS4wXCIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgICAgaWYgKCFkZXN0KSB7XG4gICAgICAgICAgICAgICAgLy8gY29weWluZyB0byBiYWNrYnVmZmVyXG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBlbXB0eSBjb2xvciBidWZmZXIgdG8gYmFja2J1ZmZlclwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc291cmNlKSB7XG4gICAgICAgICAgICAgICAgLy8gY29weWluZyB0byByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2NvbG9yQnVmZmVyIHx8ICFkZXN0Ll9jb2xvckJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgY29sb3IgYnVmZmVyLCBiZWNhdXNlIG9uZSBvZiB0aGUgcmVuZGVyIHRhcmdldHMgZG9lc24ndCBoYXZlIGl0XCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UuX2NvbG9yQnVmZmVyLl9mb3JtYXQgIT09IGRlc3QuX2NvbG9yQnVmZmVyLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IHJlbmRlciB0YXJnZXRzIG9mIGRpZmZlcmVudCBjb2xvciBmb3JtYXRzXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZXB0aCAmJiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmICghc291cmNlLl9kZXB0aCkgeyAgIC8vIHdoZW4gZGVwdGggaXMgYXV0b21hdGljLCB3ZSBjYW5ub3QgdGVzdCB0aGUgYnVmZmVyIG5vciBpdHMgZm9ybWF0XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoQnVmZmVyIHx8ICFkZXN0Ll9kZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgZGVwdGggYnVmZmVyLCBiZWNhdXNlIG9uZSBvZiB0aGUgcmVuZGVyIHRhcmdldHMgZG9lc24ndCBoYXZlIGl0XCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UuX2RlcHRoQnVmZmVyLl9mb3JtYXQgIT09IGRlc3QuX2RlcHRoQnVmZmVyLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IHJlbmRlciB0YXJnZXRzIG9mIGRpZmZlcmVudCBkZXB0aCBmb3JtYXRzXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsICdDT1BZLVJUJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNXZWJHTDIgJiYgZGVzdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldlJ0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IGRlc3Q7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgZnJvbSBzaW5nbGUgc2FtcGxlZCBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc3JjID0gc291cmNlID8gc291cmNlLmltcGwuX2dsRnJhbWVCdWZmZXIgOiB0aGlzLmJhY2tCdWZmZXI/LmltcGwuX2dsRnJhbWVCdWZmZXI7XG5cbiAgICAgICAgICAgIGNvbnN0IGRzdCA9IGRlc3QuaW1wbC5fZ2xGcmFtZUJ1ZmZlcjtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzcmMgIT09IGRzdCwgJ1NvdXJjZSBhbmQgZGVzdGluYXRpb24gZnJhbWVidWZmZXJzIG11c3QgYmUgZGlmZmVyZW50IHdoZW4gYmxpdHRpbmcuJyk7XG5cbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5SRUFEX0ZSQU1FQlVGRkVSLCBzcmMpO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGRzdCk7XG4gICAgICAgICAgICBjb25zdCB3ID0gc291cmNlID8gc291cmNlLndpZHRoIDogZGVzdC53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGggPSBzb3VyY2UgPyBzb3VyY2UuaGVpZ2h0IDogZGVzdC5oZWlnaHQ7XG5cbiAgICAgICAgICAgIGdsLmJsaXRGcmFtZWJ1ZmZlcigwLCAwLCB3LCBoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNvbG9yID8gZ2wuQ09MT1JfQlVGRkVSX0JJVCA6IDApIHwgKGRlcHRoID8gZ2wuREVQVEhfQlVGRkVSX0JJVCA6IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLk5FQVJFU1QpO1xuXG4gICAgICAgICAgICAvLyBUT0RPOiBub3Qgc3VyZSB3ZSBuZWVkIHRvIHJlc3RvcmUgdGhlIHByZXYgdGFyZ2V0LCBhcyB0aGlzIG9ubHkgc2hvdWxkIHJ1biBpbi1iZXR3ZWVuIHJlbmRlciBwYXNzZXNcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcHJldlJ0O1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBwcmV2UnQgPyBwcmV2UnQuaW1wbC5fZ2xGcmFtZUJ1ZmZlciA6IG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5nZXRDb3B5U2hhZGVyKCk7XG4gICAgICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlLnNldFZhbHVlKHNvdXJjZS5fY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgcXVhZFdpdGhTaGFkZXIodGhpcywgZGVzdCwgc2hhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBjb3B5IHNoYWRlciBmb3IgZWZmaWNpZW50IHJlbmRlcmluZyBvZiBmdWxsc2NyZWVuLXF1YWQgd2l0aCB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NoYWRlcn0gVGhlIGNvcHkgc2hhZGVyIChiYXNlZCBvbiBgZnVsbHNjcmVlblF1YWRWU2AgYW5kIGBvdXRwdXRUZXgyRFBTYCBpblxuICAgICAqIGBzaGFkZXJDaHVua3NgKS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Q29weVNoYWRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb3B5U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9jb3B5U2hhZGVyID0gbmV3IFNoYWRlcih0aGlzLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKHRoaXMsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3V0cHV0VGV4MkQnLFxuICAgICAgICAgICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICAgICAgICAgIGZyYWdtZW50Q29kZTogX291dHB1dFRleHR1cmUyRFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb3B5U2hhZGVyO1xuICAgIH1cblxuICAgIGZyYW1lU3RhcnQoKSB7XG4gICAgICAgIHN1cGVyLmZyYW1lU3RhcnQoKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZUJhY2tidWZmZXIoKTtcblxuICAgICAgICB0aGlzLmdwdVByb2ZpbGVyLmZyYW1lU3RhcnQoKTtcbiAgICB9XG5cbiAgICBmcmFtZUVuZCgpIHtcbiAgICAgICAgc3VwZXIuZnJhbWVFbmQoKTtcbiAgICAgICAgdGhpcy5ncHVQcm9maWxlci5mcmFtZUVuZCgpO1xuICAgICAgICB0aGlzLmdwdVByb2ZpbGVyLnJlcXVlc3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBzdGFydC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhcnRSZW5kZXJQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYFNUQVJULVBBU1NgKTtcblxuICAgICAgICAvLyBzZXQgdXAgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCBydCA9IHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0ID8/IHRoaXMuYmFja0J1ZmZlcjtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBydDtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJ0KTtcblxuICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgLy8gdGhlIHBhc3MgYWx3YXlzIHN0YXJ0IHVzaW5nIGZ1bGwgc2l6ZSBvZiB0aGUgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gcnQ7XG4gICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICAvLyBjbGVhciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCBjb2xvck9wcyA9IHJlbmRlclBhc3MuY29sb3JPcHM7XG4gICAgICAgIGNvbnN0IGRlcHRoU3RlbmNpbE9wcyA9IHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzO1xuICAgICAgICBpZiAoY29sb3JPcHM/LmNsZWFyIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcblxuICAgICAgICAgICAgbGV0IGNsZWFyRmxhZ3MgPSAwO1xuICAgICAgICAgICAgY29uc3QgY2xlYXJPcHRpb25zID0ge307XG5cbiAgICAgICAgICAgIGlmIChjb2xvck9wcz8uY2xlYXIpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19DT0xPUjtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuY29sb3IgPSBbY29sb3JPcHMuY2xlYXJWYWx1ZS5yLCBjb2xvck9wcy5jbGVhclZhbHVlLmcsIGNvbG9yT3BzLmNsZWFyVmFsdWUuYiwgY29sb3JPcHMuY2xlYXJWYWx1ZS5hXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfREVQVEg7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLmRlcHRoID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19TVEVOQ0lMO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5zdGVuY2lsID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjbGVhciBpdFxuICAgICAgICAgICAgY2xlYXJPcHRpb25zLmZsYWdzID0gY2xlYXJGbGFncztcbiAgICAgICAgICAgIHRoaXMuY2xlYXIoY2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5zaWRlUmVuZGVyUGFzcykge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yT25jZSgnUmVuZGVyUGFzcyBjYW5ub3QgYmUgc3RhcnRlZCB3aGlsZSBpbnNpZGUgYW5vdGhlciByZW5kZXIgcGFzcy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIGVuZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kUmVuZGVyUGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBFTkQtUEFTU2ApO1xuXG4gICAgICAgIHRoaXMudW5iaW5kVmVydGV4QXJyYXkoKTtcblxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgY29uc3QgY29sb3JCdWZmZXJDb3VudCA9IHJlbmRlclBhc3MuY29sb3JBcnJheU9wcy5sZW5ndGg7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBidWZmZXJzIHRvIHN0b3AgdGhlbSBiZWluZyB3cml0dGVuIHRvIG9uIHRpbGVkIGFyY2hpdGVjdHVyZXNcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sb3IgYnVmZmVyc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JCdWZmZXJDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvckFycmF5T3BzW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoY29sb3JPcHMuc3RvcmUgfHwgY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLkNPTE9SX0FUVEFDSE1FTlQwICsgaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB3ZSBjYW5ub3QgaW52YWxpZGF0ZSBkZXB0aC9zdGVuY2lsIGJ1ZmZlcnMgb2YgdGhlIGJhY2tidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ICE9PSB0aGlzLmJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlQXR0YWNobWVudHMucHVzaChnbC5ERVBUSF9BVFRBQ0hNRU5UKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuU1RFTkNJTF9BVFRBQ0hNRU5UKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpbnZhbGlkYXRlQXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgdGhlIHdob2xlIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiB3ZSBjb3VsZCBoYW5kbGUgdmlld3BvcnQgaW52YWxpZGF0aW9uIGFzIHdlbGxcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuZnVsbFNpemVDbGVhclJlY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLmludmFsaWRhdGVGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBpbnZhbGlkYXRlQXR0YWNobWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXNvbHZlIHRoZSBjb2xvciBidWZmZXIgKHRoaXMgcmVzb2x2ZXMgYWxsIE1SVCBjb2xvciBidWZmZXJzIGF0IG9uY2UpXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcz8ucmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyICYmIHJlbmRlclBhc3Muc2FtcGxlcyA+IDEgJiYgdGFyZ2V0LmF1dG9SZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC5yZXNvbHZlKHRydWUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JCdWZmZXJDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yQXJyYXlPcHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGNvbG9yT3BzLm1pcG1hcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbG9yQnVmZmVyICYmIGNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSAmJiBjb2xvckJ1ZmZlci5taXBtYXBzICYmIChjb2xvckJ1ZmZlci5wb3QgfHwgdGhpcy5pc1dlYkdMMikpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBNSVBTJHtpfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlKGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZ2VuZXJhdGVNaXBtYXAoY29sb3JCdWZmZXIuaW1wbC5fZ2xUYXJnZXQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIHNldCBkZWZhdWx0RnJhbWVidWZmZXIodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlciAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRGcmFtZWJ1ZmZlciA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdEZyYW1lYnVmZmVyQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZGVmYXVsdEZyYW1lYnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdEZyYW1lYnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBiZWdpbm5pbmcgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIEludGVybmFsbHksIHRoaXMgZnVuY3Rpb24gYmluZHMgdGhlIHJlbmRlclxuICAgICAqIHRhcmdldCBjdXJyZW50bHkgc2V0IG9uIHRoZSBkZXZpY2UuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG1hdGNoZWQgd2l0aCBhIGNhbGwgdG9cbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfS4gQ2FsbHMgdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufSBhbmRcbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfSBtdXN0IG5vdCBiZSBuZXN0ZWQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlQmVnaW4oKSB7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCAnVVBEQVRFLUJFR0lOJyk7XG5cbiAgICAgICAgdGhpcy5ib3VuZFZhbyA9IG51bGw7XG5cbiAgICAgICAgLy8gY2xlYXIgdGV4dHVyZSB1bml0cyBvbmNlIGEgZnJhbWUgb24gZGVza3RvcCBzYWZhcmlcbiAgICAgICAgaWYgKHRoaXMuX3RlbXBFbmFibGVTYWZhcmlUZXh0dXJlVW5pdFdvcmthcm91bmQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHVuaXQgPSAwOyB1bml0IDwgdGhpcy50ZXh0dXJlVW5pdHMubGVuZ3RoOyArK3VuaXQpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBzbG90ID0gMDsgc2xvdCA8IDM7ICsrc2xvdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t1bml0XVtzbG90XSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0ID8/IHRoaXMuYmFja0J1ZmZlcjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRhcmdldCk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgY29uc3QgdGFyZ2V0SW1wbCA9IHRhcmdldC5pbXBsO1xuICAgICAgICBpZiAoIXRhcmdldEltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQmluZCB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXRJbXBsLl9nbEZyYW1lQnVmZmVyKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgZW5kIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjYWxsZWQgYWZ0ZXIgYSBtYXRjaGluZyBjYWxsXG4gICAgICogdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufS4gQ2FsbHMgdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufSBhbmRcbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfSBtdXN0IG5vdCBiZSBuZXN0ZWQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlRW5kKCkge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgVVBEQVRFLUVORGApO1xuXG4gICAgICAgIHRoaXMudW5iaW5kVmVydGV4QXJyYXkoKTtcblxuICAgICAgICAvLyBVbnNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCAmJiB0YXJnZXQgIT09IHRoaXMuYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gUmVzb2x2ZSBNU0FBIGlmIG5lZWRlZFxuICAgICAgICAgICAgaWYgKHRoaXMuaXNXZWJHTDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMuaXNXZWJHTDIpKSB7XG4gICAgICAgICAgICAgICAgLy8gRklYTUU6IGlmIGNvbG9yQnVmZmVyIGlzIGEgY3ViZW1hcCBjdXJyZW50bHkgd2UncmUgcmUtZ2VuZXJhdGluZyBtaXBtYXBzIGFmdGVyXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRpbmcgZWFjaCBmYWNlIVxuICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgLSAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlKGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYSB0ZXh0dXJlJ3MgdmVydGljYWwgZmxpcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmxpcFkgLSBUcnVlIHRvIGZsaXAgdGhlIHRleHR1cmUgdmVydGljYWxseS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VW5wYWNrRmxpcFkoZmxpcFkpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrRmxpcFkgIT09IGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLnVucGFja0ZsaXBZID0gZmxpcFk7XG5cbiAgICAgICAgICAgIC8vIE5vdGU6IHRoZSBXZWJHTCBzcGVjIHN0YXRlcyB0aGF0IFVOUEFDS19GTElQX1lfV0VCR0wgb25seSBhZmZlY3RzXG4gICAgICAgICAgICAvLyB0ZXhJbWFnZTJEIGFuZCB0ZXhTdWJJbWFnZTJELCBub3QgY29tcHJlc3NlZFRleEltYWdlMkRcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIGZsaXBZKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYSB0ZXh0dXJlIHRvIGhhdmUgaXRzIFJHQiBjaGFubmVscyBwcmVtdWx0aXBsaWVkIGJ5IGl0cyBhbHBoYSBjaGFubmVsIG9yIG5vdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlbXVsdGlwbHlBbHBoYSAtIFRydWUgdG8gcHJlbXVsdGlwbHkgdGhlIGFscGhhIGNoYW5uZWwgYWdhaW5zdCB0aGUgUkdCXG4gICAgICogY2hhbm5lbHMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja1ByZW11bHRpcGx5QWxwaGEocHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhICE9PSBwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgICAgICB0aGlzLnVucGFja1ByZW11bHRpcGx5QWxwaGEgPSBwcmVtdWx0aXBseUFscGhhO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wgb25seSBhZmZlY3RzXG4gICAgICAgICAgICAvLyB0ZXhJbWFnZTJEIGFuZCB0ZXhTdWJJbWFnZTJELCBub3QgY29tcHJlc3NlZFRleEltYWdlMkRcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY3RpdmF0ZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gYWN0aXZhdGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpIHtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXQgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICB0aGlzLmdsLmFjdGl2ZVRleHR1cmUodGhpcy5nbC5URVhUVVJFMCArIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRoZSB0ZXh0dXJlIGlzIG5vdCBhbHJlYWR5IGJvdW5kIG9uIHRoZSBjdXJyZW50bHkgYWN0aXZlIHRleHR1cmUgdW5pdCwgYmluZCBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIGJpbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJpbmRUZXh0dXJlKHRleHR1cmUpIHtcbiAgICAgICAgY29uc3QgaW1wbCA9IHRleHR1cmUuaW1wbDtcbiAgICAgICAgY29uc3QgdGV4dHVyZVRhcmdldCA9IGltcGwuX2dsVGFyZ2V0O1xuICAgICAgICBjb25zdCB0ZXh0dXJlT2JqZWN0ID0gaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVW5pdCA9IHRoaXMudGV4dHVyZVVuaXQ7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVGV4dHVyZSh0ZXh0dXJlVGFyZ2V0LCB0ZXh0dXJlT2JqZWN0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSA9IHRleHR1cmVPYmplY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYm91bmQgb24gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQsIGFjdGl2ZSB0aGUgdGV4dHVyZSB1bml0IGFuZCBiaW5kXG4gICAgICogdGhlIHRleHR1cmUgdG8gaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gYWN0aXZhdGUgYW5kIGJpbmQgdGhlIHRleHR1cmUgdG8uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJpbmRUZXh0dXJlT25Vbml0KHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMudGFyZ2V0VG9TbG90W3RleHR1cmVUYXJnZXRdO1xuICAgICAgICBpZiAodGhpcy50ZXh0dXJlVW5pdHNbdGV4dHVyZVVuaXRdW3Nsb3RdICE9PSB0ZXh0dXJlT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVGV4dHVyZSh0ZXh0dXJlVGFyZ2V0LCB0ZXh0dXJlT2JqZWN0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSA9IHRleHR1cmVPYmplY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIHRleHR1cmUgcGFyYW1ldGVycyBmb3IgYSBnaXZlbiB0ZXh0dXJlIGlmIHRoZXkgaGF2ZSBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gdXBkYXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgY29uc3QgZmxhZ3MgPSB0ZXh0dXJlLmltcGwuZGlydHlQYXJhbWV0ZXJGbGFncztcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGV4dHVyZS5pbXBsLl9nbFRhcmdldDtcblxuICAgICAgICBpZiAoZmxhZ3MgJiAxKSB7XG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGV4dHVyZS5fbWluRmlsdGVyO1xuICAgICAgICAgICAgaWYgKCghdGV4dHVyZS5wb3QgJiYgIXRoaXMuaXNXZWJHTDIpIHx8ICF0ZXh0dXJlLl9taXBtYXBzIHx8ICh0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPT09IDEpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbHRlciA9PT0gRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIHx8IGZpbHRlciA9PT0gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgdGhpcy5nbEZpbHRlcltmaWx0ZXJdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAyKSB7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCB0aGlzLmdsRmlsdGVyW3RleHR1cmUuX21hZ0ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9ULCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVl0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzViA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDE2KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pc1dlYkdMMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUiwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ddKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAzMikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfQ09NUEFSRV9GVU5DLCB0aGlzLmdsQ29tcGFyaXNvblt0ZXh0dXJlLl9jb21wYXJlRnVuY10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDEyOCkge1xuICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgICAgICBpZiAoZXh0KSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyZih0YXJnZXQsIGV4dC5URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCwgbWF0aC5jbGFtcChNYXRoLnJvdW5kKHRleHR1cmUuX2FuaXNvdHJvcHkpLCAxLCB0aGlzLm1heEFuaXNvdHJvcHkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gc2V0IHRoZSB0ZXh0dXJlIG9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG5cbiAgICAgICAgY29uc3QgaW1wbCA9IHRleHR1cmUuaW1wbDtcbiAgICAgICAgaWYgKCFpbXBsLl9nbFRleHR1cmUpXG4gICAgICAgICAgICBpbXBsLmluaXRpYWxpemUodGhpcywgdGV4dHVyZSk7XG5cbiAgICAgICAgaWYgKGltcGwuZGlydHlQYXJhbWV0ZXJGbGFncyA+IDAgfHwgdGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBpcyBhY3RpdmVcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBib3VuZCBvbiBjb3JyZWN0IHRhcmdldCBvZiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdFxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgICAgICAgICAgaWYgKGltcGwuZGlydHlQYXJhbWV0ZXJGbGFncykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgaW1wbC5kaXJ0eVBhcmFtZXRlckZsYWdzID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCkge1xuICAgICAgICAgICAgICAgIGltcGwudXBsb2FkKHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgY3VycmVudGx5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgICAgICAgIC8vIElmIHRoZSB0ZXh0dXJlIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdW5pdCwgdGhlcmUncyBubyBuZWVkXG4gICAgICAgICAgICAvLyB0byBhY3R1YWxseSBtYWtlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGFjdGl2ZSBiZWNhdXNlIHRoZSB0ZXh0dXJlIGl0c2VsZiBkb2VzIG5vdCBuZWVkXG4gICAgICAgICAgICAvLyB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjcmVhdGVzIFZlcnRleEFycmF5T2JqZWN0IGZyb20gbGlzdCBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgIGNyZWF0ZVZlcnRleEFycmF5KHZlcnRleEJ1ZmZlcnMpIHtcblxuICAgICAgICBsZXQga2V5LCB2YW87XG5cbiAgICAgICAgLy8gb25seSB1c2UgY2FjaGUgd2hlbiBtb3JlIHRoYW4gMSB2ZXJ0ZXggYnVmZmVyLCBvdGhlcndpc2UgaXQncyB1bmlxdWVcbiAgICAgICAgY29uc3QgdXNlQ2FjaGUgPSB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA+IDE7XG4gICAgICAgIGlmICh1c2VDYWNoZSkge1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB1bmlxdWUga2V5IGZvciB0aGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGtleSA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGtleSArPSB2ZXJ0ZXhCdWZmZXIuaWQgKyB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnJlbmRlcmluZ0hhc2g7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBnZXQgVkFPIGZyb20gY2FjaGVcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuX3Zhb01hcC5nZXQoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gY3JlYXRlIG5ldyB2YW9cbiAgICAgICAgaWYgKCF2YW8pIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIFZBIG9iamVjdFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgdmFvID0gZ2wuY3JlYXRlVmVydGV4QXJyYXkoKTtcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuXG4gICAgICAgICAgICAvLyBkb24ndCBjYXB0dXJlIGluZGV4IGJ1ZmZlciBpbiBWQU9cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICBsZXQgbG9jWmVybyA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUgPSBlbGVtZW50c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9jID0gc2VtYW50aWNUb0xvY2F0aW9uW2UubmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvYyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jWmVybyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5hc0ludCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliSVBvaW50ZXIobG9jLCBlLm51bUNvbXBvbmVudHMsIHRoaXMuZ2xUeXBlW2UuZGF0YVR5cGVdLCBlLnN0cmlkZSwgZS5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2MsIGUubnVtQ29tcG9uZW50cywgdGhpcy5nbFR5cGVbZS5kYXRhVHlwZV0sIGUubm9ybWFsaXplLCBlLnN0cmlkZSwgZS5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLmZvcm1hdC5pbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJEaXZpc29yKGxvYywgMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiBWQSBvYmplY3RcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheShudWxsKTtcblxuICAgICAgICAgICAgLy8gdW5iaW5kIGFueSBhcnJheSBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGNhY2hlXG4gICAgICAgICAgICBpZiAodXNlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl92YW9NYXAuc2V0KGtleSwgdmFvKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFsb2NaZXJvKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihcIk5vIHZlcnRleCBhdHRyaWJ1dGUgaXMgbWFwcGVkIHRvIGxvY2F0aW9uIDAsIHdoaWNoIG1pZ2h0IGNhdXNlIGNvbXBhdGliaWxpdHkgaXNzdWVzIG9uIFNhZmFyaSBvbiBNYWNPUyAtIHBsZWFzZSB1c2UgYXR0cmlidXRlIFNFTUFOVElDX1BPU0lUSU9OIG9yIFNFTUFOVElDX0FUVFIxNVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YW87XG4gICAgfVxuXG4gICAgdW5iaW5kVmVydGV4QXJyYXkoKSB7XG4gICAgICAgIC8vIHVuYmluZCBWQU8gZnJvbSBkZXZpY2UgdG8gcHJvdGVjdCBpdCBmcm9tIGJlaW5nIGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuYm91bmRWYW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRCdWZmZXJzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCB2YW87XG5cbiAgICAgICAgLy8gY3JlYXRlIFZBTyBmb3Igc3BlY2lmaWVkIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID09PSAxKSB7XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSBWQiBrZWVwcyBpdHMgVkFPXG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMF07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmVydGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgVmVydGV4QnVmZmVyIHdhcyBub3QgY3JlYXRlZCB1c2luZyBjdXJyZW50IEdyYXBoaWNzRGV2aWNlXCIpO1xuICAgICAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8pIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YW8gPSB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBvYnRhaW4gdGVtcG9yYXJ5IFZBTyBmb3IgbXVsdGlwbGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuY3JlYXRlVmVydGV4QXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBhY3RpdmUgVkFPXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvICE9PSB2YW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSB2YW87XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkodmFvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVtcHR5IGFycmF5IG9mIHZlcnRleCBidWZmZXJzXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIGluZGV4IGJ1ZmZlciBvYmplY3RcbiAgICAgICAgLy8gTm90ZTogd2UgZG9uJ3QgY2FjaGUgdGhpcyBzdGF0ZSBhbmQgc2V0IGl0IG9ubHkgd2hlbiBpdCBjaGFuZ2VzLCBhcyBWQU8gY2FwdHVyZXMgbGFzdCBiaW5kIGJ1ZmZlciBpbiBpdFxuICAgICAgICAvLyBhbmQgc28gd2UgZG9uJ3Qga25vdyB3aGF0IFZBTyBzZXRzIGl0IHRvLlxuICAgICAgICBjb25zdCBidWZmZXJJZCA9IHRoaXMuaW5kZXhCdWZmZXIgPyB0aGlzLmluZGV4QnVmZmVyLmltcGwuYnVmZmVySWQgOiBudWxsO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBidWZmZXJJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VibWl0cyBhIGdyYXBoaWNhbCBwcmltaXRpdmUgdG8gdGhlIGhhcmR3YXJlIGZvciBpbW1lZGlhdGUgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHByaW1pdGl2ZSAtIFByaW1pdGl2ZSBvYmplY3QgZGVzY3JpYmluZyBob3cgdG8gc3VibWl0IGN1cnJlbnQgdmVydGV4L2luZGV4XG4gICAgICogYnVmZmVycy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLnR5cGUgLSBUaGUgdHlwZSBvZiBwcmltaXRpdmUgdG8gcmVuZGVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfUE9JTlRTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORUxPT1B9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJRkFOfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5iYXNlIC0gVGhlIG9mZnNldCBvZiB0aGUgZmlyc3QgaW5kZXggb3IgdmVydGV4IHRvIGRpc3BhdGNoIGluIHRoZVxuICAgICAqIGRyYXcgY2FsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLmNvdW50IC0gVGhlIG51bWJlciBvZiBpbmRpY2VzIG9yIHZlcnRpY2VzIHRvIGRpc3BhdGNoIGluIHRoZSBkcmF3XG4gICAgICogY2FsbC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtwcmltaXRpdmUuaW5kZXhlZF0gLSBUcnVlIHRvIGludGVycHJldCB0aGUgcHJpbWl0aXZlIGFzIGluZGV4ZWQsIHRoZXJlYnlcbiAgICAgKiB1c2luZyB0aGUgY3VycmVudGx5IHNldCBpbmRleCBidWZmZXIgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bUluc3RhbmNlc10gLSBUaGUgbnVtYmVyIG9mIGluc3RhbmNlcyB0byByZW5kZXIgd2hlbiB1c2luZ1xuICAgICAqIEFOR0xFX2luc3RhbmNlZF9hcnJheXMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJ1ZmZlcnNdIC0gT3B0aW9uYWxseSBrZWVwIHRoZSBjdXJyZW50IHNldCBvZiB2ZXJ0ZXggLyBpbmRleCBidWZmZXJzIC9cbiAgICAgKiBWQU8uIFRoaXMgaXMgdXNlZCB3aGVuIHJlbmRlcmluZyBvZiBtdWx0aXBsZSB2aWV3cywgZm9yIGV4YW1wbGUgdW5kZXIgV2ViWFIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUsIHVuaW5kZXhlZCB0cmlhbmdsZVxuICAgICAqIGRldmljZS5kcmF3KHtcbiAgICAgKiAgICAgdHlwZTogcGMuUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAgKiAgICAgYmFzZTogMCxcbiAgICAgKiAgICAgY291bnQ6IDMsXG4gICAgICogICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcywga2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGxldCBzYW1wbGVyLCBzYW1wbGVyVmFsdWUsIHRleHR1cmUsIG51bVRleHR1cmVzOyAvLyBTYW1wbGVyc1xuICAgICAgICBsZXQgdW5pZm9ybSwgc2NvcGVJZCwgdW5pZm9ybVZlcnNpb24sIHByb2dyYW1WZXJzaW9uOyAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLnNoYWRlcjtcbiAgICAgICAgaWYgKCFzaGFkZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHNhbXBsZXJzID0gc2hhZGVyLmltcGwuc2FtcGxlcnM7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gc2hhZGVyLmltcGwudW5pZm9ybXM7XG5cbiAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKCFrZWVwQnVmZmVycykge1xuICAgICAgICAgICAgdGhpcy5zZXRCdWZmZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgdGhlIHNoYWRlciBwcm9ncmFtIHZhcmlhYmxlc1xuICAgICAgICBsZXQgdGV4dHVyZVVuaXQgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzYW1wbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgc2FtcGxlciA9IHNhbXBsZXJzW2ldO1xuICAgICAgICAgICAgc2FtcGxlclZhbHVlID0gc2FtcGxlci5zY29wZUlkLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFzYW1wbGVyVmFsdWUpIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBjb25zdCBzYW1wbGVyTmFtZSA9IHNhbXBsZXIuc2NvcGVJZC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZURlcHRoTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3VEZXB0aE1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZURlcHRoTWFwIC8gZW5hYmxlIERlcHRoIEdyYWJwYXNzIG9uIHRoZSBDYW1lcmEgQ29tcG9uZW50IHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lQ29sb3JNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndGV4dHVyZV9ncmFiUGFzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgY29sb3IgdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZUNvbG9yTWFwIC8gZW5hYmxlIENvbG9yIEdyYWJwYXNzIG9uIHRoZSBDYW1lcmEgQ29tcG9uZW50IHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvck9uY2UoYFNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSByZXF1aXJlcyB0ZXh0dXJlIHNhbXBsZXIgWyR7c2FtcGxlck5hbWV9XSB3aGljaCBoYXMgbm90IGJlZW4gc2V0LCB3aGlsZSByZW5kZXJpbmcgWyR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfV1gKTtcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBkcmF3IGNhbGwgdG8gYXZvaWQgaW5jb3JyZWN0IHJlbmRlcmluZyAvIHdlYmdsIGVycm9yc1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNhbXBsZXJWYWx1ZSBpbnN0YW5jZW9mIFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBicmVha3BvaW50IGhlcmUgdG8gZGVidWcgXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHRleHR1cmVzIG9mIHRoZSBkcmF3IGFyZSB0aGUgc2FtZVwiIGVycm9yc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuX3NhbXBsZXMgPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgY29sb3IgYnVmZmVyIGFzIGEgdGV4dHVyZVwiLCB7IHJlbmRlclRhcmdldDogdGhpcy5yZW5kZXJUYXJnZXQsIHRleHR1cmUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyICYmIHRoaXMucmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyID09PSB0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJUcnlpbmcgdG8gYmluZCBjdXJyZW50IGRlcHRoIGJ1ZmZlciBhcyBhIHRleHR1cmVcIiwgeyB0ZXh0dXJlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXIuc2xvdCAhPT0gdGV4dHVyZVVuaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHNhbXBsZXIubG9jYXRpb25JZCwgdGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLnNsb3QgPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGV4dHVyZVVuaXQrKztcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIEFycmF5XG4gICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIG51bVRleHR1cmVzID0gc2FtcGxlclZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bVRleHR1cmVzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZSA9IHNhbXBsZXJWYWx1ZVtqXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLmFycmF5W2pdID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaXYoc2FtcGxlci5sb2NhdGlvbklkLCBzYW1wbGVyLmFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbW1pdCBhbnkgdXBkYXRlZCB1bmlmb3Jtc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdW5pZm9ybXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHVuaWZvcm0gPSB1bmlmb3Jtc1tpXTtcbiAgICAgICAgICAgIHNjb3BlSWQgPSB1bmlmb3JtLnNjb3BlSWQ7XG4gICAgICAgICAgICB1bmlmb3JtVmVyc2lvbiA9IHVuaWZvcm0udmVyc2lvbjtcbiAgICAgICAgICAgIHByb2dyYW1WZXJzaW9uID0gc2NvcGVJZC52ZXJzaW9uT2JqZWN0LnZlcnNpb247XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRoZSB2YWx1ZSBpcyB2YWxpZFxuICAgICAgICAgICAgaWYgKHVuaWZvcm1WZXJzaW9uLmdsb2JhbElkICE9PSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZCB8fCB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiAhPT0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb24pIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCA9IHByb2dyYW1WZXJzaW9uLmdsb2JhbElkO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WZXJzaW9uLnJldmlzaW9uID0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb247XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0byBjb21taXQgdGhlIHVuaWZvcm0gdmFsdWVcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGVJZC52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW3VuaWZvcm0uZGF0YVR5cGVdKHVuaWZvcm0sIHNjb3BlSWQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbW1lbnRlZCBvdXQgdGlsbCBlbmdpbmUgaXNzdWUgIzQ5NzEgaXMgc29ydGVkIG91dFxuICAgICAgICAgICAgICAgICAgICAvLyBEZWJ1Zy53YXJuT25jZShgU2hhZGVyIFske3NoYWRlci5sYWJlbH1dIHJlcXVpcmVzIHVuaWZvcm0gWyR7dW5pZm9ybS5zY29wZUlkLm5hbWV9XSB3aGljaCBoYXMgbm90IGJlZW4gc2V0LCB3aGlsZSByZW5kZXJpbmcgWyR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfV1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pc1dlYkdMMiAmJiB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBFbmFibGUgVEYsIHN0YXJ0IHdyaXRpbmcgdG8gb3V0IGJ1ZmZlclxuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlckJhc2UoZ2wuVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiwgMCwgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcbiAgICAgICAgICAgIGdsLmJlZ2luVHJhbnNmb3JtRmVlZGJhY2soZ2wuUE9JTlRTKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdsUHJpbWl0aXZlW3ByaW1pdGl2ZS50eXBlXTtcbiAgICAgICAgY29uc3QgY291bnQgPSBwcmltaXRpdmUuY291bnQ7XG5cbiAgICAgICAgaWYgKHByaW1pdGl2ZS5pbmRleGVkKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoaW5kZXhCdWZmZXIuZGV2aWNlID09PSB0aGlzLCBcIlRoZSBJbmRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcblxuICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gaW5kZXhCdWZmZXIuaW1wbC5nbEZvcm1hdDtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldCA9IHByaW1pdGl2ZS5iYXNlICogaW5kZXhCdWZmZXIuYnl0ZXNQZXJJbmRleDtcblxuICAgICAgICAgICAgaWYgKG51bUluc3RhbmNlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHMobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ID0gcHJpbWl0aXZlLmJhc2U7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0FycmF5c0luc3RhbmNlZChtb2RlLCBmaXJzdCwgY291bnQsIG51bUluc3RhbmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXMobW9kZSwgZmlyc3QsIGNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wyICYmIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGRpc2FibGUgVEZcbiAgICAgICAgICAgIGdsLmVuZFRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyQmFzZShnbC5UUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSLCAwLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RyYXdDYWxsc1BlckZyYW1lKys7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lW3ByaW1pdGl2ZS50eXBlXSArPSBwcmltaXRpdmUuY291bnQgKiAobnVtSW5zdGFuY2VzID4gMSA/IG51bUluc3RhbmNlcyA6IDEpO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGZyYW1lIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgY29udHJvbHMgdGhlIGJlaGF2aW9yIG9mIHRoZSBjbGVhclxuICAgICAqIG9wZXJhdGlvbiBkZWZpbmVkIGFzIGZvbGxvd3M6XG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuY29sb3JdIC0gVGhlIGNvbG9yIHRvIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgdG8gaW4gdGhlIHJhbmdlIDAgdG9cbiAgICAgKiAxIGZvciBlYWNoIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZGVwdGhdIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRoZSBkZXB0aCBidWZmZXIgdG8gaW4gdGhlXG4gICAgICogcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mbGFnc10gLSBUaGUgYnVmZmVycyB0byBjbGVhciAodGhlIHR5cGVzIGJlaW5nIGNvbG9yLCBkZXB0aCBhbmRcbiAgICAgKiBzdGVuY2lsKS4gQ2FuIGJlIGFueSBiaXR3aXNlIGNvbWJpbmF0aW9uIG9mOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19ERVBUSH1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfU1RFTkNJTH1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGVuY2lsXSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB0by5cbiAgICAgKiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIGJsYWNrIGFuZCBkZXB0aCBidWZmZXIgdG8gMVxuICAgICAqIGRldmljZS5jbGVhcigpO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIganVzdCB0aGUgY29sb3IgYnVmZmVyIHRvIHJlZFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMCwgMCwgMV0sXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1JcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIENsZWFyIGNvbG9yIGJ1ZmZlciB0byB5ZWxsb3cgYW5kIGRlcHRoIHRvIDEuMFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMSwgMCwgMV0sXG4gICAgICogICAgIGRlcHRoOiAxLFxuICAgICAqICAgICBmbGFnczogcGMuQ0xFQVJGTEFHX0NPTE9SIHwgcGMuQ0xFQVJGTEFHX0RFUFRIXG4gICAgICogfSk7XG4gICAgICovXG4gICAgY2xlYXIob3B0aW9ucykge1xuICAgICAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgZGVmYXVsdE9wdGlvbnM7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSBvcHRpb25zLmZsYWdzID8/IGRlZmF1bHRPcHRpb25zLmZsYWdzO1xuICAgICAgICBpZiAoZmxhZ3MgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBjb2xvclxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0NPTE9SKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSBvcHRpb25zLmNvbG9yID8/IGRlZmF1bHRPcHRpb25zLmNvbG9yO1xuICAgICAgICAgICAgICAgIGNvbnN0IHIgPSBjb2xvclswXTtcbiAgICAgICAgICAgICAgICBjb25zdCBnID0gY29sb3JbMV07XG4gICAgICAgICAgICAgICAgY29uc3QgYiA9IGNvbG9yWzJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGEgPSBjb2xvclszXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGMgPSB0aGlzLmNsZWFyQ29sb3I7XG4gICAgICAgICAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJDb2xvcihyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckNvbG9yLnNldChyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBkZXB0aFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gb3B0aW9ucy5kZXB0aCA/PyBkZWZhdWx0T3B0aW9ucy5kZXB0aDtcblxuICAgICAgICAgICAgICAgIGlmIChkZXB0aCAhPT0gdGhpcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJEZXB0aChkZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJEZXB0aCA9IGRlcHRoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLldSSVRFREVQVEgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfU1RFTkNJTCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgc3RlbmNpbFxuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWwgPSBvcHRpb25zLnN0ZW5jaWwgPz8gZGVmYXVsdE9wdGlvbnMuc3RlbmNpbDtcbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbCAhPT0gdGhpcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5jbGVhclN0ZW5jaWwoc3RlbmNpbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gc3RlbmNpbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENsZWFyIHRoZSBmcmFtZSBidWZmZXJcbiAgICAgICAgICAgIGdsLmNsZWFyKHRoaXMuZ2xDbGVhckZsYWdbZmxhZ3NdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1Ym1pdCgpIHtcbiAgICAgICAgdGhpcy5nbC5mbHVzaCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYWRzIGEgYmxvY2sgb2YgcGl4ZWxzIGZyb20gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlIG9mIHRoZSBjdXJyZW50IGNvbG9yIGZyYW1lYnVmZmVyIGludG8gYW5cbiAgICAgKiBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBwaXhlbHMgLSBUaGUgQXJyYXlCdWZmZXJWaWV3IG9iamVjdCB0aGF0IGhvbGRzIHRoZSByZXR1cm5lZCBwaXhlbFxuICAgICAqIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlYWRQaXhlbHMoeCwgeSwgdywgaCwgcGl4ZWxzKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZ2wucmVhZFBpeGVscyh4LCB5LCB3LCBoLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBwaXhlbHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzeW5jaHJvbm91c2x5IHJlYWRzIGEgYmxvY2sgb2YgcGl4ZWxzIGZyb20gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlIG9mIHRoZSBjdXJyZW50IGNvbG9yIGZyYW1lYnVmZmVyXG4gICAgICogaW50byBhbiBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBwaXhlbHMgLSBUaGUgQXJyYXlCdWZmZXJWaWV3IG9iamVjdCB0aGF0IGhvbGRzIHRoZSByZXR1cm5lZCBwaXhlbFxuICAgICAqIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzeW5jIHJlYWRQaXhlbHNBc3luYyh4LCB5LCB3LCBoLCBwaXhlbHMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICghdGhpcy5pc1dlYkdMMikge1xuICAgICAgICAgICAgLy8gYXN5bmMgZmVuY2VzIGFyZW4ndCBzdXBwb3J0ZWQgb24gd2ViZ2wxXG4gICAgICAgICAgICB0aGlzLnJlYWRQaXhlbHMoeCwgeSwgdywgaCwgcGl4ZWxzKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNsaWVudFdhaXRBc3luYyA9IChmbGFncywgaW50ZXJ2YWxfbXMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN5bmMgPSBnbC5mZW5jZVN5bmMoZ2wuU1lOQ19HUFVfQ09NTUFORFNfQ09NUExFVEUsIDApO1xuICAgICAgICAgICAgdGhpcy5zdWJtaXQoKTtcblxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiB0ZXN0KCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnbC5jbGllbnRXYWl0U3luYyhzeW5jLCBmbGFncywgMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXMgPT09IGdsLldBSVRfRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5kZWxldGVTeW5jKHN5bmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignd2ViZ2wgY2xpZW50V2FpdFN5bmMgc3luYyBmYWlsZWQnKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzID09PSBnbC5USU1FT1VUX0VYUElSRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQodGVzdCwgaW50ZXJ2YWxfbXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuZGVsZXRlU3luYyhzeW5jKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0ZXN0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBpbXBsID0gdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXI/LmltcGw7XG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IGltcGw/Ll9nbEZvcm1hdCA/PyBnbC5SR0JBO1xuICAgICAgICBjb25zdCBwaXhlbFR5cGUgPSBpbXBsPy5fZ2xQaXhlbFR5cGUgPz8gZ2wuVU5TSUdORURfQllURTtcblxuICAgICAgICAvLyBjcmVhdGUgdGVtcG9yYXJ5IChncHUtc2lkZSkgYnVmZmVyIGFuZCBjb3B5IGRhdGEgaW50byBpdFxuICAgICAgICBjb25zdCBidWYgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5QSVhFTF9QQUNLX0JVRkZFUiwgYnVmKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5QSVhFTF9QQUNLX0JVRkZFUiwgcGl4ZWxzLmJ5dGVMZW5ndGgsIGdsLlNUUkVBTV9SRUFEKTtcbiAgICAgICAgZ2wucmVhZFBpeGVscyh4LCB5LCB3LCBoLCBmb3JtYXQsIHBpeGVsVHlwZSwgMCk7XG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuUElYRUxfUEFDS19CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgIC8vIGFzeW5jIHdhaXQgZm9yIHByZXZpb3VzIHJlYWQgdG8gZmluaXNoXG4gICAgICAgIGF3YWl0IGNsaWVudFdhaXRBc3luYygwLCAyMCk7XG5cbiAgICAgICAgLy8gY29weSB0aGUgcmVzdWx0aW5nIGRhdGEgb25jZSBpdCdzIGFycml2ZWRcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5QSVhFTF9QQUNLX0JVRkZFUiwgYnVmKTtcbiAgICAgICAgZ2wuZ2V0QnVmZmVyU3ViRGF0YShnbC5QSVhFTF9QQUNLX0JVRkZFUiwgMCwgcGl4ZWxzKTtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5QSVhFTF9QQUNLX0JVRkZFUiwgbnVsbCk7XG4gICAgICAgIGdsLmRlbGV0ZUJ1ZmZlcihidWYpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgYWxwaGEgdG8gY292ZXJhZ2UgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc3RhdGUgLSBUcnVlIHRvIGVuYWJsZSBhbHBoYSB0byBjb3ZlcmFnZSBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wxKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLmFscGhhVG9Db3ZlcmFnZSA9PT0gc3RhdGUpIHJldHVybjtcbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBzdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBvdXRwdXQgdmVydGV4IGJ1ZmZlci4gSXQgd2lsbCBiZSB3cml0dGVuIHRvIGJ5IGEgc2hhZGVyIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrXG4gICAgICogdmFyeWluZ3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcn0gdGYgLSBUaGUgb3V0cHV0IHZlcnRleCBidWZmZXIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKHRmKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID09PSB0ZilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID0gdGY7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNXZWJHTDIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmICh0Zikge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5mZWVkYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZlZWRiYWNrID0gZ2wuY3JlYXRlVHJhbnNmb3JtRmVlZGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ2wuYmluZFRyYW5zZm9ybUZlZWRiYWNrKGdsLlRSQU5TRk9STV9GRUVEQkFDSywgdGhpcy5mZWVkYmFjayk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmJpbmRUcmFuc2Zvcm1GZWVkYmFjayhnbC5UUkFOU0ZPUk1fRkVFREJBQ0ssIG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgcmFzdGVyaXphdGlvbiByZW5kZXIgc3RhdGUuIFVzZWZ1bCB3aXRoIHRyYW5zZm9ybSBmZWVkYmFjaywgd2hlbiB5b3Ugb25seSBuZWVkXG4gICAgICogdG8gcHJvY2VzcyB0aGUgZGF0YSB3aXRob3V0IGRyYXdpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9uIC0gVHJ1ZSB0byBlbmFibGUgcmFzdGVyaXphdGlvbiBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0UmFzdGVyKG9uKSB7XG4gICAgICAgIGlmICh0aGlzLnJhc3RlciA9PT0gb24pIHJldHVybjtcblxuICAgICAgICB0aGlzLnJhc3RlciA9IG9uO1xuXG4gICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICBpZiAob24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsVGVzdChlbmFibGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbCAhPT0gZW5hYmxlKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbCA9IGVuYWJsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxGdW5jKGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0Zyb250KGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuY1NlcGFyYXRlKGdsLkZST05ULCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0JhY2soZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuQkFDSywgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wKHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2sgfHwgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrKHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxGcm9udCAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3BTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJsZW5kU3RhdGUoYmxlbmRTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50QmxlbmRTdGF0ZS5lcXVhbHMoYmxlbmRTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gc3RhdGUgdmFsdWVzIHRvIHNldFxuICAgICAgICAgICAgY29uc3QgeyBibGVuZCwgY29sb3JPcCwgYWxwaGFPcCwgY29sb3JTcmNGYWN0b3IsIGNvbG9yRHN0RmFjdG9yLCBhbHBoYVNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IgfSA9IGJsZW5kU3RhdGU7XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBibGVuZFxuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmJsZW5kICE9PSBibGVuZCkge1xuICAgICAgICAgICAgICAgIGlmIChibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgb3BzXG4gICAgICAgICAgICBpZiAoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCAhPT0gY29sb3JPcCB8fCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wICE9PSBhbHBoYU9wKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xCbGVuZEVxdWF0aW9uID0gdGhpcy5nbEJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICAgICAgZ2wuYmxlbmRFcXVhdGlvblNlcGFyYXRlKGdsQmxlbmRFcXVhdGlvbltjb2xvck9wXSwgZ2xCbGVuZEVxdWF0aW9uW2FscGhhT3BdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgZmFjdG9yc1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yICE9PSBjb2xvclNyY0ZhY3RvciB8fCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvciAhPT0gY29sb3JEc3RGYWN0b3IgfHxcbiAgICAgICAgICAgICAgICBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciAhPT0gYWxwaGFTcmNGYWN0b3IgfHwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IgIT09IGFscGhhRHN0RmFjdG9yKSB7XG5cbiAgICAgICAgICAgICAgICBnbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbkNvbG9yW2NvbG9yU3JjRmFjdG9yXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25Db2xvcltjb2xvckRzdEZhY3Rvcl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYVthbHBoYVNyY0ZhY3Rvcl0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQWxwaGFbYWxwaGFEc3RGYWN0b3JdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY29sb3Igd3JpdGVcbiAgICAgICAgICAgIGlmIChjdXJyZW50QmxlbmRTdGF0ZS5hbGxXcml0ZSAhPT0gYmxlbmRTdGF0ZS5hbGxXcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuY29sb3JNYXNrKGJsZW5kU3RhdGUucmVkV3JpdGUsIGJsZW5kU3RhdGUuZ3JlZW5Xcml0ZSwgYmxlbmRTdGF0ZS5ibHVlV3JpdGUsIGJsZW5kU3RhdGUuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZVxuICAgICAgICAgICAgY3VycmVudEJsZW5kU3RhdGUuY29weShibGVuZFN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZGluZyBmYWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QmxlbmRDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmJsZW5kQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZENvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KHRydWUpO1xuICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCA9PT0gc3RlbmNpbEJhY2spIHtcblxuICAgICAgICAgICAgICAgIC8vIGlkZW50aWNhbCBmcm9udC9iYWNrIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxGdW5jKHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbihzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gZnJvbnRcbiAgICAgICAgICAgICAgICBzdGVuY2lsRnJvbnQgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0Zyb250KHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG5cbiAgICAgICAgICAgICAgICAvLyBiYWNrXG4gICAgICAgICAgICAgICAgc3RlbmNpbEJhY2sgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0JhY2soc3RlbmNpbEJhY2suZnVuYywgc3RlbmNpbEJhY2sucmVmLCBzdGVuY2lsQmFjay5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhzdGVuY2lsQmFjay5mYWlsLCBzdGVuY2lsQmFjay56ZmFpbCwgc3RlbmNpbEJhY2suenBhc3MsIHN0ZW5jaWxCYWNrLndyaXRlTWFzayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50RGVwdGhTdGF0ZSA9IHRoaXMuZGVwdGhTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50RGVwdGhTdGF0ZS5lcXVhbHMoZGVwdGhTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gd3JpdGVcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gZGVwdGhTdGF0ZS53cml0ZTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS53cml0ZSAhPT0gd3JpdGUpIHtcbiAgICAgICAgICAgICAgICBnbC5kZXB0aE1hc2sod3JpdGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgY2FzZSB3aGVyZSBkZXB0aCB0ZXN0aW5nIGlzIG9mZiwgYnV0IGRlcHRoIHdyaXRlIGlzIG9uID0+IGVuYWJsZSBhbHdheXMgdGVzdCB0byBkZXB0aCB3cml0ZVxuICAgICAgICAgICAgLy8gTm90ZSBvbiBXZWJHTCBBUEkgYmVoYXZpb3I6IFdoZW4gZGVwdGggdGVzdGluZyBpcyBkaXNhYmxlZCwgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIgYXJlIGFsc28gZGlzYWJsZWQuXG4gICAgICAgICAgICBsZXQgeyBmdW5jLCB0ZXN0IH0gPSBkZXB0aFN0YXRlO1xuICAgICAgICAgICAgaWYgKCF0ZXN0ICYmIHdyaXRlKSB7XG4gICAgICAgICAgICAgICAgdGVzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZnVuYyA9IEZVTkNfQUxXQVlTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudERlcHRoU3RhdGUuZnVuYyAhPT0gZnVuYykge1xuICAgICAgICAgICAgICAgIGdsLmRlcHRoRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS50ZXN0ICE9PSB0ZXN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZXB0aCBiaWFzXG4gICAgICAgICAgICBjb25zdCB7IGRlcHRoQmlhcywgZGVwdGhCaWFzU2xvcGUgfSA9IGRlcHRoU3RhdGU7XG4gICAgICAgICAgICBpZiAoZGVwdGhCaWFzIHx8IGRlcHRoQmlhc1Nsb3BlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBlbmFibGUgYmlhc1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZXB0aEJpYXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdmFsdWVzXG4gICAgICAgICAgICAgICAgZ2wucG9seWdvbk9mZnNldChkZXB0aEJpYXNTbG9wZSwgZGVwdGhCaWFzKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIC8vIGRpc2FibGUgYmlhc1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRlcHRoQmlhc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGludGVybmFsIHN0YXRlXG4gICAgICAgICAgICBjdXJyZW50RGVwdGhTdGF0ZS5jb3B5KGRlcHRoU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgIT09IGN1bGxNb2RlKSB7XG4gICAgICAgICAgICBpZiAoY3VsbE1vZGUgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5DVUxMX0ZBQ0UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZSA9IHRoaXMuZ2xDdWxsW2N1bGxNb2RlXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsRmFjZSAhPT0gbW9kZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmN1bGxGYWNlKG1vZGUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1bGxGYWNlID0gbW9kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1bGxNb2RlID0gY3VsbE1vZGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBhY3RpdmUgc2hhZGVyIHRvIGJlIHVzZWQgZHVyaW5nIHN1YnNlcXVlbnQgZHJhdyBjYWxscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIHNldCB0byBhc3NpZ24gdG8gdGhlIGRldmljZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2hhZGVyIHdhcyBzdWNjZXNzZnVsbHkgc2V0LCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2V0U2hhZGVyKHNoYWRlcikge1xuICAgICAgICBpZiAoc2hhZGVyICE9PSB0aGlzLnNoYWRlcikge1xuICAgICAgICAgICAgaWYgKHNoYWRlci5mYWlsZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFzaGFkZXIucmVhZHkgJiYgIXNoYWRlci5pbXBsLmZpbmFsaXplKHRoaXMsIHNoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBzaGFkZXJcbiAgICAgICAgICAgIHRoaXMuZ2wudXNlUHJvZ3JhbShzaGFkZXIuaW1wbC5nbFByb2dyYW0pO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lKys7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzSW52YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIG1lbW9yeSBmcm9tIGFsbCB2ZXJ0ZXggYXJyYXkgb2JqZWN0cyBldmVyIGFsbG9jYXRlZCB3aXRoIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICB0aGlzLl92YW9NYXAuZm9yRWFjaCgoaXRlbSwga2V5LCBtYXBPYmopID0+IHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5KGl0ZW0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl92YW9NYXAuY2xlYXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdWxsc2NyZWVuIG1vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZnVsbHNjcmVlbihmdWxsc2NyZWVuKSB7XG4gICAgICAgIGlmIChmdWxsc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcbiAgICAgICAgICAgIGNhbnZhcy5yZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmdWxsc2NyZWVuKCkge1xuICAgICAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBoaWdoIHByZWNpc2lvbiBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBhcmUgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPSB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbih0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0ZXh0dXJlIHdpdGggaGFsZiBmbG9hdCBmb3JtYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBkYXRhLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzV2ViR0wyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSh0aGlzLmdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlO1xuICAgIH1cblxuICAgIC8vICNpZiBfREVCVUdcbiAgICAvLyBkZWJ1ZyBoZWxwZXIgdG8gZm9yY2UgbG9zdCBjb250ZXh0XG4gICAgZGVidWdMb3NlQ29udGV4dChzbGVlcCA9IDEwMCkge1xuICAgICAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5nbC5nZXRFeHRlbnNpb24oJ1dFQkdMX2xvc2VfY29udGV4dCcpO1xuICAgICAgICBjb250ZXh0Lmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gY29udGV4dC5yZXN0b3JlQ29udGV4dCgpLCBzbGVlcCk7XG4gICAgfVxuICAgIC8vICNlbmRpZlxufVxuXG5leHBvcnQgeyBXZWJnbEdyYXBoaWNzRGV2aWNlIH07XG4iXSwibmFtZXMiOlsiaW52YWxpZGF0ZUF0dGFjaG1lbnRzIiwiX2Z1bGxTY3JlZW5RdWFkVlMiLCJfcHJlY2lzaW9uVGVzdDFQUyIsIl9wcmVjaXNpb25UZXN0MlBTIiwiX291dHB1dFRleHR1cmUyRCIsInF1YWRXaXRoU2hhZGVyIiwiZGV2aWNlIiwidGFyZ2V0Iiwic2hhZGVyIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJvbGRSdCIsInJlbmRlclRhcmdldCIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q3VsbE1vZGUiLCJDVUxMRkFDRV9OT05FIiwic2V0QmxlbmRTdGF0ZSIsIkJsZW5kU3RhdGUiLCJOT0JMRU5EIiwic2V0RGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJOT0RFUFRIIiwic2V0U3RlbmNpbFN0YXRlIiwic2V0VmVydGV4QnVmZmVyIiwicXVhZFZlcnRleEJ1ZmZlciIsInNldFNoYWRlciIsImRyYXciLCJ0eXBlIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsInVwZGF0ZUVuZCIsInBvcEdwdU1hcmtlciIsInRlc3RSZW5kZXJhYmxlIiwiZ2wiLCJwaXhlbEZvcm1hdCIsInJlc3VsdCIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiYmluZFRleHR1cmUiLCJURVhUVVJFXzJEIiwidGV4UGFyYW1ldGVyaSIsIlRFWFRVUkVfTUlOX0ZJTFRFUiIsIk5FQVJFU1QiLCJURVhUVVJFX01BR19GSUxURVIiLCJURVhUVVJFX1dSQVBfUyIsIkNMQU1QX1RPX0VER0UiLCJURVhUVVJFX1dSQVBfVCIsInRleEltYWdlMkQiLCJSR0JBIiwiZnJhbWVidWZmZXIiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsImJpbmRGcmFtZWJ1ZmZlciIsIkZSQU1FQlVGRkVSIiwiZnJhbWVidWZmZXJUZXh0dXJlMkQiLCJDT0xPUl9BVFRBQ0hNRU5UMCIsImNoZWNrRnJhbWVidWZmZXJTdGF0dXMiLCJGUkFNRUJVRkZFUl9DT01QTEVURSIsImRlbGV0ZVRleHR1cmUiLCJkZWxldGVGcmFtZWJ1ZmZlciIsInRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiZGF0YSIsIlVpbnQxNkFycmF5IiwiZ2V0RXJyb3IiLCJOT19FUlJPUiIsImNvbnNvbGUiLCJsb2ciLCJ0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJzaGFkZXIxIiwiU2hhZGVyIiwiU2hhZGVyVXRpbHMiLCJjcmVhdGVEZWZpbml0aW9uIiwibmFtZSIsInZlcnRleENvZGUiLCJmcmFnbWVudENvZGUiLCJzaGFkZXIyIiwidGV4dHVyZU9wdGlvbnMiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwid2lkdGgiLCJoZWlnaHQiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJ0ZXgxIiwiVGV4dHVyZSIsInRhcmcxIiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsIlBJWEVMRk9STUFUX1JHQkE4IiwidGV4MiIsInRhcmcyIiwiY29uc3RhbnRUZXhTb3VyY2UiLCJzZXRWYWx1ZSIsInByZXZGcmFtZWJ1ZmZlciIsImFjdGl2ZUZyYW1lYnVmZmVyIiwic2V0RnJhbWVidWZmZXIiLCJpbXBsIiwiX2dsRnJhbWVCdWZmZXIiLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsIngiLCJ5IiwieiIsInciLCJmIiwiZGVzdHJveSIsIldlYmdsR3JhcGhpY3NEZXZpY2UiLCJHcmFwaGljc0RldmljZSIsImNvbnN0cnVjdG9yIiwiY2FudmFzIiwib3B0aW9ucyIsIl9vcHRpb25zJGFudGlhbGlhcyIsIl9kZWZhdWx0RnJhbWVidWZmZXIiLCJfZGVmYXVsdEZyYW1lYnVmZmVyQ2hhbmdlZCIsImluaXRPcHRpb25zIiwidXBkYXRlQ2xpZW50UmVjdCIsImluaXRUZXh0dXJlVW5pdHMiLCJjb250ZXh0TG9zdCIsIl9jb250ZXh0TG9zdEhhbmRsZXIiLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwibG9zZUNvbnRleHQiLCJEZWJ1ZyIsImZpcmUiLCJfY29udGV4dFJlc3RvcmVkSGFuZGxlciIsInJlc3RvcmVDb250ZXh0IiwidWEiLCJuYXZpZ2F0b3IiLCJ1c2VyQWdlbnQiLCJmb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nIiwiaW5jbHVkZXMiLCJhbnRpYWxpYXMiLCJwbGF0Zm9ybSIsImJyb3dzZXJOYW1lIiwibWF0Y2giLCJmaXJlZm94VmVyc2lvbiIsInZlcnNpb24iLCJwYXJzZUZsb2F0IiwiYmFja0J1ZmZlckFudGlhbGlhcyIsInByZWZlcldlYkdsMiIsInVuZGVmaW5lZCIsIm5hbWVzIiwiaSIsImxlbmd0aCIsImdldENvbnRleHQiLCJFcnJvciIsImlzV2ViR0wyIiwiV2ViR0wyUmVuZGVyaW5nQ29udGV4dCIsImlzV2ViR0wxIiwiX2RldmljZVR5cGUiLCJERVZJQ0VUWVBFX1dFQkdMMiIsIkRFVklDRVRZUEVfV0VCR0wxIiwidXBkYXRlQmFja2J1ZmZlckZvcm1hdCIsImlzQ2hyb21lIiwiaXNTYWZhcmkiLCJpc01hYyIsImJyb3dzZXIiLCJhcHBWZXJzaW9uIiwiaW5kZXhPZiIsIl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kIiwiX3RlbXBNYWNDaHJvbWVCbGl0RnJhbWVidWZmZXJXb3JrYXJvdW5kIiwiYWxwaGEiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdGlhbGl6ZUV4dGVuc2lvbnMiLCJpbml0aWFsaXplQ2FwYWJpbGl0aWVzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJjcmVhdGVCYWNrYnVmZmVyIiwic3VwcG9ydHNJbWFnZUJpdG1hcCIsIkltYWdlQml0bWFwIiwiZ2xBZGRyZXNzIiwiUkVQRUFUIiwiTUlSUk9SRURfUkVQRUFUIiwiZ2xCbGVuZEVxdWF0aW9uIiwiRlVOQ19BREQiLCJGVU5DX1NVQlRSQUNUIiwiRlVOQ19SRVZFUlNFX1NVQlRSQUNUIiwiTUlOIiwiZXh0QmxlbmRNaW5tYXgiLCJNSU5fRVhUIiwiTUFYIiwiTUFYX0VYVCIsImdsQmxlbmRGdW5jdGlvbkNvbG9yIiwiWkVSTyIsIk9ORSIsIlNSQ19DT0xPUiIsIk9ORV9NSU5VU19TUkNfQ09MT1IiLCJEU1RfQ09MT1IiLCJPTkVfTUlOVVNfRFNUX0NPTE9SIiwiU1JDX0FMUEhBIiwiU1JDX0FMUEhBX1NBVFVSQVRFIiwiT05FX01JTlVTX1NSQ19BTFBIQSIsIkRTVF9BTFBIQSIsIk9ORV9NSU5VU19EU1RfQUxQSEEiLCJDT05TVEFOVF9DT0xPUiIsIk9ORV9NSU5VU19DT05TVEFOVF9DT0xPUiIsImdsQmxlbmRGdW5jdGlvbkFscGhhIiwiQ09OU1RBTlRfQUxQSEEiLCJPTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEiLCJnbENvbXBhcmlzb24iLCJORVZFUiIsIkxFU1MiLCJFUVVBTCIsIkxFUVVBTCIsIkdSRUFURVIiLCJOT1RFUVVBTCIsIkdFUVVBTCIsIkFMV0FZUyIsImdsU3RlbmNpbE9wIiwiS0VFUCIsIlJFUExBQ0UiLCJJTkNSIiwiSU5DUl9XUkFQIiwiREVDUiIsIkRFQ1JfV1JBUCIsIklOVkVSVCIsImdsQ2xlYXJGbGFnIiwiQ09MT1JfQlVGRkVSX0JJVCIsIkRFUFRIX0JVRkZFUl9CSVQiLCJTVEVOQ0lMX0JVRkZFUl9CSVQiLCJnbEN1bGwiLCJCQUNLIiwiRlJPTlQiLCJGUk9OVF9BTkRfQkFDSyIsImdsRmlsdGVyIiwiTElORUFSIiwiTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIk5FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkxJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkxJTkVBUl9NSVBNQVBfTElORUFSIiwiZ2xQcmltaXRpdmUiLCJQT0lOVFMiLCJMSU5FUyIsIkxJTkVfTE9PUCIsIkxJTkVfU1RSSVAiLCJUUklBTkdMRVMiLCJUUklBTkdMRV9TVFJJUCIsIlRSSUFOR0xFX0ZBTiIsImdsVHlwZSIsIkJZVEUiLCJVTlNJR05FRF9CWVRFIiwiU0hPUlQiLCJVTlNJR05FRF9TSE9SVCIsIklOVCIsIlVOU0lHTkVEX0lOVCIsIkZMT0FUIiwiSEFMRl9GTE9BVCIsInBjVW5pZm9ybVR5cGUiLCJCT09MIiwiVU5JRk9STVRZUEVfQk9PTCIsIlVOSUZPUk1UWVBFX0lOVCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiRkxPQVRfVkVDMiIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJGTE9BVF9WRUMzIiwiVU5JRk9STVRZUEVfVkVDMyIsIkZMT0FUX1ZFQzQiLCJVTklGT1JNVFlQRV9WRUM0IiwiSU5UX1ZFQzIiLCJVTklGT1JNVFlQRV9JVkVDMiIsIklOVF9WRUMzIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJJTlRfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUM0IiwiQk9PTF9WRUMyIiwiVU5JRk9STVRZUEVfQlZFQzIiLCJCT09MX1ZFQzMiLCJVTklGT1JNVFlQRV9CVkVDMyIsIkJPT0xfVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiRkxPQVRfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDIiLCJGTE9BVF9NQVQzIiwiVU5JRk9STVRZUEVfTUFUMyIsIkZMT0FUX01BVDQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiU0FNUExFUl8yRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlNBTVBMRVJfQ1VCRSIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiVU5JRk9STVRZUEVfVUlOVCIsIlVOU0lHTkVEX0lOVF9WRUMyIiwiVU5JRk9STVRZUEVfVVZFQzIiLCJVTlNJR05FRF9JTlRfVkVDMyIsIlVOSUZPUk1UWVBFX1VWRUMzIiwiVU5TSUdORURfSU5UX1ZFQzQiLCJVTklGT1JNVFlQRV9VVkVDNCIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyIsIlNBTVBMRVJfQ1VCRV9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1ciLCJTQU1QTEVSXzJEX0FSUkFZIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEX0FSUkFZIiwiU0FNUExFUl8zRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUzRCIsIklOVF9TQU1QTEVSXzJEIiwiVU5JRk9STVRZUEVfSVRFWFRVUkUyRCIsIlVOU0lHTkVEX0lOVF9TQU1QTEVSXzJEIiwiVU5JRk9STVRZUEVfVVRFWFRVUkUyRCIsIklOVF9TQU1QTEVSX0NVQkUiLCJVTklGT1JNVFlQRV9JVEVYVFVSRUNVQkUiLCJVTklGT1JNVFlQRV9VVEVYVFVSRUNVQkUiLCJJTlRfU0FNUExFUl8zRCIsIlVOSUZPUk1UWVBFX0lURVhUVVJFM0QiLCJVTlNJR05FRF9JTlRfU0FNUExFUl8zRCIsIlVOSUZPUk1UWVBFX1VURVhUVVJFM0QiLCJJTlRfU0FNUExFUl8yRF9BUlJBWSIsIlVOSUZPUk1UWVBFX0lURVhUVVJFMkRfQVJSQVkiLCJVTlNJR05FRF9JTlRfU0FNUExFUl8yRF9BUlJBWSIsIlVOSUZPUk1UWVBFX1VURVhUVVJFMkRfQVJSQVkiLCJ0YXJnZXRUb1Nsb3QiLCJURVhUVVJFX0NVQkVfTUFQIiwiVEVYVFVSRV8zRCIsInNjb3BlWCIsInNjb3BlWSIsInNjb3BlWiIsInNjb3BlVyIsInVuaWZvcm1WYWx1ZSIsImNvbW1pdEZ1bmN0aW9uIiwidW5pZm9ybSIsInZhbHVlIiwidW5pZm9ybTFpIiwibG9jYXRpb25JZCIsInVuaWZvcm0xZiIsInVuaWZvcm0yZnYiLCJ1bmlmb3JtM2Z2IiwidW5pZm9ybTRmdiIsInVuaWZvcm0yaXYiLCJ1bmlmb3JtM2l2IiwidW5pZm9ybTRpdiIsInVuaWZvcm1NYXRyaXgyZnYiLCJ1bmlmb3JtTWF0cml4M2Z2IiwidW5pZm9ybU1hdHJpeDRmdiIsIlVOSUZPUk1UWVBFX0ZMT0FUQVJSQVkiLCJ1bmlmb3JtMWZ2IiwiVU5JRk9STVRZUEVfVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfVkVDNEFSUkFZIiwidW5pZm9ybTF1aSIsInVuaWZvcm0ydWl2IiwidW5pZm9ybTN1aXYiLCJ1bmlmb3JtNHVpdiIsIlVOSUZPUk1UWVBFX0lOVEFSUkFZIiwidW5pZm9ybTFpdiIsIlVOSUZPUk1UWVBFX1VJTlRBUlJBWSIsInVuaWZvcm0xdWl2IiwiVU5JRk9STVRZUEVfQk9PTEFSUkFZIiwiVU5JRk9STVRZUEVfSVZFQzJBUlJBWSIsIlVOSUZPUk1UWVBFX1VWRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9CVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfSVZFQzNBUlJBWSIsIlVOSUZPUk1UWVBFX1VWRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9CVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfSVZFQzRBUlJBWSIsIlVOSUZPUk1UWVBFX1VWRUM0QVJSQVkiLCJVTklGT1JNVFlQRV9CVkVDNEFSUkFZIiwiVU5JRk9STVRZUEVfTUFUNEFSUkFZIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJtYXhWZXJ0ZXhUZXh0dXJlcyIsIm51bVVuaWZvcm1zIiwidmVydGV4VW5pZm9ybXNDb3VudCIsImJvbmVMaW1pdCIsIk1hdGgiLCJmbG9vciIsIm1pbiIsInVubWFza2VkUmVuZGVyZXIiLCJzY29wZSIsInJlc29sdmUiLCJleHRDb2xvckJ1ZmZlckZsb2F0IiwiZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsInN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUiLCJtYXhQcmVjaXNpb24iLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJfdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImFyZWFMaWdodEx1dEZvcm1hdCIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsInBvc3RJbml0IiwiZ3B1UHJvZmlsZXIiLCJXZWJnbEdwdVByb2ZpbGVyIiwiZmVlZGJhY2siLCJkZWxldGVUcmFuc2Zvcm1GZWVkYmFjayIsImNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJwb3N0RGVzdHJveSIsImZyYW1lQnVmZmVyIiwic3VwcG9ydHNTdGVuY2lsIiwic3RlbmNpbCIsImJhY2tCdWZmZXIiLCJncmFwaGljc0RldmljZSIsInNhbXBsZXMiLCJzdXBwbGllZENvbG9yRnJhbWVidWZmZXIiLCJhbHBoYUJpdHMiLCJnZXRQYXJhbWV0ZXIiLCJBTFBIQV9CSVRTIiwiYmFja0J1ZmZlckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQjgiLCJ1cGRhdGVCYWNrYnVmZmVyIiwicmVzb2x1dGlvbkNoYW5nZWQiLCJiYWNrQnVmZmVyU2l6ZSIsInNldCIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJnbFZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ2xJbmRleEJ1ZmZlciIsImNyZWF0ZVNoYWRlckltcGwiLCJXZWJnbFNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwiV2ViZ2xUZXh0dXJlIiwiY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCIsIldlYmdsUmVuZGVyVGFyZ2V0IiwicHVzaE1hcmtlciIsIndpbmRvdyIsInNwZWN0b3IiLCJsYWJlbCIsInRvU3RyaW5nIiwic2V0TWFya2VyIiwicG9wTWFya2VyIiwiY2xlYXJNYXJrZXIiLCJnZXRQcmVjaXNpb24iLCJwcmVjaXNpb24iLCJnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiVkVSVEVYX1NIQURFUiIsIkhJR0hfRkxPQVQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJNRURJVU1fRkxPQVQiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJGUkFHTUVOVF9TSEFERVIiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsImhpZ2hwQXZhaWxhYmxlIiwibWVkaXVtcEF2YWlsYWJsZSIsIndhcm4iLCJnZXRFeHRlbnNpb24iLCJhcmd1bWVudHMiLCJzdXBwb3J0ZWRFeHRlbnNpb25zIiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiX2V4dERpc2pvaW50VGltZXJRdWVyeSIsIl9nbCRnZXRTdXBwb3J0ZWRFeHRlbiIsImdldFN1cHBvcnRlZEV4dGVuc2lvbnMiLCJleHREcmF3QnVmZmVycyIsImRyYXdCdWZmZXJzIiwiYmluZCIsImV4dEluc3RhbmNpbmciLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwidGV4dHVyZUhhbGZGbG9hdEZpbHRlcmFibGUiLCJleHRUZXh0dXJlTG9kIiwiZXh0VWludEVsZW1lbnQiLCJleHRWZXJ0ZXhBcnJheU9iamVjdCIsImV4dERlcHRoVGV4dHVyZSIsInRleHR1cmVSRzExQjEwUmVuZGVyYWJsZSIsIl90aGlzJGV4dERyYXdCdWZmZXJzIiwiZHJhd0J1ZmZlcnNXRUJHTCIsImV4dCIsImRyYXdBcnJheXNJbnN0YW5jZWQiLCJkcmF3QXJyYXlzSW5zdGFuY2VkQU5HTEUiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWQiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWRBTkdMRSIsInZlcnRleEF0dHJpYkRpdmlzb3IiLCJ2ZXJ0ZXhBdHRyaWJEaXZpc29yQU5HTEUiLCJjcmVhdGVWZXJ0ZXhBcnJheSIsImNyZWF0ZVZlcnRleEFycmF5T0VTIiwiZGVsZXRlVmVydGV4QXJyYXkiLCJkZWxldGVWZXJ0ZXhBcnJheU9FUyIsImlzVmVydGV4QXJyYXkiLCJpc1ZlcnRleEFycmF5T0VTIiwiYmluZFZlcnRleEFycmF5IiwiYmluZFZlcnRleEFycmF5T0VTIiwiZXh0RGVidWdSZW5kZXJlckluZm8iLCJ0ZXh0dXJlRmxvYXRGaWx0ZXJhYmxlIiwiZXh0RmxvYXRCbGVuZCIsImV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDMSIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDIiwiZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlIiwiX2NvbnRleHRBdHRyaWJzJGFudGlhIiwiX2NvbnRleHRBdHRyaWJzJHN0ZW5jIiwiY29udGV4dEF0dHJpYnMiLCJnZXRDb250ZXh0QXR0cmlidXRlcyIsInN1cHBvcnRzTXNhYSIsInN1cHBvcnRzSW5zdGFuY2luZyIsIm1heFRleHR1cmVTaXplIiwiTUFYX1RFWFRVUkVfU0laRSIsIm1heEN1YmVNYXBTaXplIiwiTUFYX0NVQkVfTUFQX1RFWFRVUkVfU0laRSIsIm1heFJlbmRlckJ1ZmZlclNpemUiLCJNQVhfUkVOREVSQlVGRkVSX1NJWkUiLCJtYXhUZXh0dXJlcyIsIk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTIiwibWF4Q29tYmluZWRUZXh0dXJlcyIsIk1BWF9DT01CSU5FRF9URVhUVVJFX0lNQUdFX1VOSVRTIiwiTUFYX1ZFUlRFWF9URVhUVVJFX0lNQUdFX1VOSVRTIiwiTUFYX1ZFUlRFWF9VTklGT1JNX1ZFQ1RPUlMiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJNQVhfRlJBR01FTlRfVU5JRk9STV9WRUNUT1JTIiwibWF4RHJhd0J1ZmZlcnMiLCJNQVhfRFJBV19CVUZGRVJTIiwibWF4Q29sb3JBdHRhY2htZW50cyIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UUyIsIm1heFZvbHVtZVNpemUiLCJNQVhfM0RfVEVYVFVSRV9TSVpFIiwic3VwcG9ydHNNcnQiLCJzdXBwb3J0c1ZvbHVtZVRleHR1cmVzIiwiTUFYX0RSQVdfQlVGRkVSU19XRUJHTCIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UU19XRUJHTCIsIlVOTUFTS0VEX1JFTkRFUkVSX1dFQkdMIiwidW5tYXNrZWRWZW5kb3IiLCJVTk1BU0tFRF9WRU5ET1JfV0VCR0wiLCJtYWxpUmVuZGVyZXJSZWdleCIsInNhbXN1bmdNb2RlbFJlZ2V4Iiwic3VwcG9ydHNHcHVQYXJ0aWNsZXMiLCJtYXhBbmlzb3Ryb3B5IiwiTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwiYW50aWFsaWFzU3VwcG9ydGVkIiwibWF4U2FtcGxlcyIsIk1BWF9TQU1QTEVTIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwiYW5kcm9pZCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiZGlzYWJsZSIsIkJMRU5EIiwiYmxlbmRGdW5jIiwiYmxlbmRFcXVhdGlvbiIsImNvbG9yTWFzayIsImJsZW5kQ29sb3IiLCJlbmFibGUiLCJDVUxMX0ZBQ0UiLCJjdWxsRmFjZSIsIkRFUFRIX1RFU1QiLCJkZXB0aEZ1bmMiLCJkZXB0aE1hc2siLCJTVEVOQ0lMX1RFU1QiLCJzdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNCYWNrIiwiRlVOQ19BTFdBWVMiLCJzdGVuY2lsUmVmRnJvbnQiLCJzdGVuY2lsUmVmQmFjayIsInN0ZW5jaWxNYXNrRnJvbnQiLCJzdGVuY2lsTWFza0JhY2siLCJzdGVuY2lsRnVuYyIsInN0ZW5jaWxGYWlsRnJvbnQiLCJzdGVuY2lsRmFpbEJhY2siLCJTVEVOQ0lMT1BfS0VFUCIsInN0ZW5jaWxaZmFpbEZyb250Iiwic3RlbmNpbFpmYWlsQmFjayIsInN0ZW5jaWxacGFzc0Zyb250Iiwic3RlbmNpbFpwYXNzQmFjayIsInN0ZW5jaWxXcml0ZU1hc2tGcm9udCIsInN0ZW5jaWxXcml0ZU1hc2tCYWNrIiwic3RlbmNpbE9wIiwic3RlbmNpbE1hc2siLCJhbHBoYVRvQ292ZXJhZ2UiLCJyYXN0ZXIiLCJTQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UiLCJSQVNURVJJWkVSX0RJU0NBUkQiLCJkZXB0aEJpYXNFbmFibGVkIiwiUE9MWUdPTl9PRkZTRVRfRklMTCIsImNsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiQ29sb3IiLCJjbGVhclN0ZW5jaWwiLCJoaW50IiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVCIsIk5JQ0VTVCIsIkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTIiwiU0NJU1NPUl9URVNUIiwicGl4ZWxTdG9yZWkiLCJVTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMIiwiTk9ORSIsInVucGFja0ZsaXBZIiwiVU5QQUNLX0ZMSVBfWV9XRUJHTCIsInVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJVTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wiLCJVTlBBQ0tfQUxJR05NRU5UIiwidGV4dHVyZVVuaXRzIiwicHVzaCIsIl92YW9NYXAiLCJNYXAiLCJib3VuZFZhbyIsInRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGV4dHVyZVVuaXQiLCJfdGhpcyRncHVQcm9maWxlciIsInNoYWRlcnMiLCJ0ZXh0dXJlcyIsImJ1ZmZlciIsImJ1ZmZlcnMiLCJ0YXJnZXRzIiwiX3RoaXMkZ3B1UHJvZmlsZXIyIiwidW5sb2NrIiwiZW5kU2hhZGVyQmF0Y2giLCJzZXRWaWV3cG9ydCIsImgiLCJ2eCIsInZ5IiwidnciLCJ2aCIsInZpZXdwb3J0Iiwic2V0U2Npc3NvciIsInN4Iiwic3kiLCJzdyIsInNoIiwic2Npc3NvciIsImZiIiwiY29weVJlbmRlclRhcmdldCIsInNvdXJjZSIsImRlc3QiLCJjb2xvciIsImVycm9yIiwiX2NvbG9yQnVmZmVyIiwiX2Zvcm1hdCIsIl9kZXB0aCIsIl9kZXB0aEJ1ZmZlciIsIl90aGlzJGJhY2tCdWZmZXIiLCJwcmV2UnQiLCJzcmMiLCJkc3QiLCJhc3NlcnQiLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsImdldENvcHlTaGFkZXIiLCJfY29weVNoYWRlciIsImZyYW1lU3RhcnQiLCJmcmFtZUVuZCIsInJlcXVlc3QiLCJzdGFydFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwiX3JlbmRlclBhc3MkcmVuZGVyVGFyIiwicnQiLCJjb2xvck9wcyIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyIiwiY2xlYXJGbGFncyIsImNsZWFyT3B0aW9ucyIsIkNMRUFSRkxBR19DT0xPUiIsImNsZWFyVmFsdWUiLCJyIiwiZyIsImIiLCJhIiwiQ0xFQVJGTEFHX0RFUFRIIiwiY2xlYXJEZXB0aFZhbHVlIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJjbGVhclN0ZW5jaWxWYWx1ZSIsImZsYWdzIiwiY2FsbCIsImluc2lkZVJlbmRlclBhc3MiLCJlcnJvck9uY2UiLCJlbmRSZW5kZXJQYXNzIiwidW5iaW5kVmVydGV4QXJyYXkiLCJjb2xvckJ1ZmZlckNvdW50IiwiY29sb3JBcnJheU9wcyIsIl9yZW5kZXJQYXNzJGNvbG9yT3BzIiwic3RvcmUiLCJzdG9yZURlcHRoIiwiREVQVEhfQVRUQUNITUVOVCIsInN0b3JlU3RlbmNpbCIsIlNURU5DSUxfQVRUQUNITUVOVCIsImZ1bGxTaXplQ2xlYXJSZWN0IiwiaW52YWxpZGF0ZUZyYW1lYnVmZmVyIiwiYXV0b1Jlc29sdmUiLCJfY29sb3JCdWZmZXJzIiwiX2dsVGV4dHVyZSIsInBvdCIsImFjdGl2ZVRleHR1cmUiLCJnZW5lcmF0ZU1pcG1hcCIsIl9nbFRhcmdldCIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsIl90aGlzJHJlbmRlclRhcmdldCIsInVuaXQiLCJzbG90IiwidGFyZ2V0SW1wbCIsImluaXRpYWxpemVkIiwiaW5pdFJlbmRlclRhcmdldCIsIl9zYW1wbGVzIiwic2V0VW5wYWNrRmxpcFkiLCJmbGlwWSIsInNldFVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJwcmVtdWx0aXBseUFscGhhIiwiVEVYVFVSRTAiLCJ0ZXh0dXJlVGFyZ2V0IiwidGV4dHVyZU9iamVjdCIsImJpbmRUZXh0dXJlT25Vbml0Iiwic2V0VGV4dHVyZVBhcmFtZXRlcnMiLCJkaXJ0eVBhcmFtZXRlckZsYWdzIiwiZmlsdGVyIiwiX21pbkZpbHRlciIsIl9taXBtYXBzIiwiX2NvbXByZXNzZWQiLCJfbGV2ZWxzIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiX2FkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiX2FkZHJlc3NWIiwiVEVYVFVSRV9XUkFQX1IiLCJfYWRkcmVzc1ciLCJURVhUVVJFX0NPTVBBUkVfTU9ERSIsIl9jb21wYXJlT25SZWFkIiwiQ09NUEFSRV9SRUZfVE9fVEVYVFVSRSIsIlRFWFRVUkVfQ09NUEFSRV9GVU5DIiwiX2NvbXBhcmVGdW5jIiwidGV4UGFyYW1ldGVyZiIsIlRFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwibWF0aCIsImNsYW1wIiwicm91bmQiLCJfYW5pc290cm9weSIsInNldFRleHR1cmUiLCJpbml0aWFsaXplIiwiX25lZWRzVXBsb2FkIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsInVwbG9hZCIsInZlcnRleEJ1ZmZlcnMiLCJrZXkiLCJ2YW8iLCJ1c2VDYWNoZSIsImlkIiwicmVuZGVyaW5nSGFzaCIsImdldCIsImJpbmRCdWZmZXIiLCJFTEVNRU5UX0FSUkFZX0JVRkZFUiIsImxvY1plcm8iLCJBUlJBWV9CVUZGRVIiLCJidWZmZXJJZCIsImVsZW1lbnRzIiwiaiIsImUiLCJsb2MiLCJzZW1hbnRpY1RvTG9jYXRpb24iLCJhc0ludCIsInZlcnRleEF0dHJpYklQb2ludGVyIiwibnVtQ29tcG9uZW50cyIsImRhdGFUeXBlIiwic3RyaWRlIiwib2Zmc2V0IiwidmVydGV4QXR0cmliUG9pbnRlciIsIm5vcm1hbGl6ZSIsImVuYWJsZVZlcnRleEF0dHJpYkFycmF5IiwiaW5zdGFuY2luZyIsInNldEJ1ZmZlcnMiLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidmVyc2lvbk9iamVjdCIsImdsb2JhbElkIiwicmV2aXNpb24iLCJiaW5kQnVmZmVyQmFzZSIsIlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIiLCJiZWdpblRyYW5zZm9ybUZlZWRiYWNrIiwibW9kZSIsImdsRm9ybWF0IiwiYnl0ZXNQZXJJbmRleCIsImRyYXdFbGVtZW50cyIsImZpcnN0IiwiZHJhd0FycmF5cyIsImVuZFRyYW5zZm9ybUZlZWRiYWNrIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX3ByaW1zUGVyRnJhbWUiLCJfb3B0aW9ucyRmbGFncyIsImRlZmF1bHRPcHRpb25zIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsIl9vcHRpb25zJGNvbG9yIiwiYyIsIl9vcHRpb25zJGRlcHRoIiwiV1JJVEVERVBUSCIsIl9vcHRpb25zJHN0ZW5jaWwiLCJzdWJtaXQiLCJmbHVzaCIsInJlYWRQaXhlbHNBc3luYyIsIl90aGlzJHJlbmRlclRhcmdldCRjbyIsIl9pbXBsJF9nbEZvcm1hdCIsIl9pbXBsJF9nbFBpeGVsVHlwZSIsImNsaWVudFdhaXRBc3luYyIsImludGVydmFsX21zIiwic3luYyIsImZlbmNlU3luYyIsIlNZTkNfR1BVX0NPTU1BTkRTX0NPTVBMRVRFIiwiUHJvbWlzZSIsInJlamVjdCIsInRlc3QiLCJyZXMiLCJjbGllbnRXYWl0U3luYyIsIldBSVRfRkFJTEVEIiwiZGVsZXRlU3luYyIsIlRJTUVPVVRfRVhQSVJFRCIsInNldFRpbWVvdXQiLCJfZ2xGb3JtYXQiLCJwaXhlbFR5cGUiLCJfZ2xQaXhlbFR5cGUiLCJidWYiLCJjcmVhdGVCdWZmZXIiLCJQSVhFTF9QQUNLX0JVRkZFUiIsImJ1ZmZlckRhdGEiLCJieXRlTGVuZ3RoIiwiU1RSRUFNX1JFQUQiLCJnZXRCdWZmZXJTdWJEYXRhIiwiZGVsZXRlQnVmZmVyIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwic3RhdGUiLCJzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRmIiwiY3JlYXRlVHJhbnNmb3JtRmVlZGJhY2siLCJiaW5kVHJhbnNmb3JtRmVlZGJhY2siLCJUUkFOU0ZPUk1fRkVFREJBQ0siLCJzZXRSYXN0ZXIiLCJvbiIsInNldFN0ZW5jaWxUZXN0Iiwic2V0U3RlbmNpbEZ1bmMiLCJmdW5jIiwicmVmIiwibWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY1NlcGFyYXRlIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250Iiwic3RlbmNpbE9wU2VwYXJhdGUiLCJzdGVuY2lsTWFza1NlcGFyYXRlIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJibGVuZFN0YXRlIiwiY3VycmVudEJsZW5kU3RhdGUiLCJlcXVhbHMiLCJibGVuZCIsImNvbG9yT3AiLCJhbHBoYU9wIiwiY29sb3JTcmNGYWN0b3IiLCJjb2xvckRzdEZhY3RvciIsImFscGhhU3JjRmFjdG9yIiwiYWxwaGFEc3RGYWN0b3IiLCJibGVuZEVxdWF0aW9uU2VwYXJhdGUiLCJibGVuZEZ1bmNTZXBhcmF0ZSIsImFsbFdyaXRlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsImNvcHkiLCJzZXRCbGVuZENvbG9yIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJyZWFkTWFzayIsIl9zdGVuY2lsRnJvbnQiLCJfc3RlbmNpbEJhY2siLCJTdGVuY2lsUGFyYW1ldGVycyIsIkRFRkFVTFQiLCJkZXB0aFN0YXRlIiwiY3VycmVudERlcHRoU3RhdGUiLCJ3cml0ZSIsImRlcHRoQmlhcyIsImRlcHRoQmlhc1Nsb3BlIiwicG9seWdvbk9mZnNldCIsImN1bGxNb2RlIiwiZmFpbGVkIiwicmVhZHkiLCJmaW5hbGl6ZSIsInVzZVByb2dyYW0iLCJnbFByb2dyYW0iLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsImF0dHJpYnV0ZXNJbnZhbGlkYXRlZCIsImZvckVhY2giLCJpdGVtIiwibWFwT2JqIiwiZnVsbHNjcmVlbiIsInJlcXVlc3RGdWxsc2NyZWVuIiwiZG9jdW1lbnQiLCJleGl0RnVsbHNjcmVlbiIsImZ1bGxzY3JlZW5FbGVtZW50IiwidGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsImRlYnVnTG9zZUNvbnRleHQiLCJzbGVlcCIsImNvbnRleHQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWdEQSxNQUFNQSxxQkFBcUIsR0FBRyxFQUFFLENBQUE7QUFFaEMsTUFBTUMsaUJBQWlCLGFBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGlCQUFpQixhQUFjLENBQUE7QUFDckM7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsaUJBQWlCLGFBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGdCQUFnQixhQUFjLENBQUE7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELFNBQVNDLGNBQWNBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFFNUNDLEVBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDSixNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQTtBQUVyRCxFQUFBLE1BQU1LLEtBQUssR0FBR0wsTUFBTSxDQUFDTSxZQUFZLENBQUE7QUFDakNOLEVBQUFBLE1BQU0sQ0FBQ08sZUFBZSxDQUFDTixNQUFNLENBQUMsQ0FBQTtFQUM5QkQsTUFBTSxDQUFDUSxXQUFXLEVBQUUsQ0FBQTtBQUVwQlIsRUFBQUEsTUFBTSxDQUFDUyxXQUFXLENBQUNDLGFBQWEsQ0FBQyxDQUFBO0FBQ2pDVixFQUFBQSxNQUFNLENBQUNXLGFBQWEsQ0FBQ0MsVUFBVSxDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUN4Q2IsRUFBQUEsTUFBTSxDQUFDYyxhQUFhLENBQUNDLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7QUFDeENoQixFQUFBQSxNQUFNLENBQUNpQixlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO0VBRWxDakIsTUFBTSxDQUFDa0IsZUFBZSxDQUFDbEIsTUFBTSxDQUFDbUIsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDbERuQixFQUFBQSxNQUFNLENBQUNvQixTQUFTLENBQUNsQixNQUFNLENBQUMsQ0FBQTtFQUV4QkYsTUFBTSxDQUFDcUIsSUFBSSxDQUFDO0FBQ1JDLElBQUFBLElBQUksRUFBRUMsa0JBQWtCO0FBQ3hCQyxJQUFBQSxJQUFJLEVBQUUsQ0FBQztBQUNQQyxJQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxJQUFBQSxPQUFPLEVBQUUsS0FBQTtBQUNiLEdBQUMsQ0FBQyxDQUFBO0VBRUYxQixNQUFNLENBQUMyQixTQUFTLEVBQUUsQ0FBQTtBQUVsQjNCLEVBQUFBLE1BQU0sQ0FBQ08sZUFBZSxDQUFDRixLQUFLLENBQUMsQ0FBQTtFQUM3QkwsTUFBTSxDQUFDUSxXQUFXLEVBQUUsQ0FBQTtBQUVwQkwsRUFBQUEsYUFBYSxDQUFDeUIsWUFBWSxDQUFDNUIsTUFBTSxDQUFDLENBQUE7QUFDdEMsQ0FBQTtBQUVBLFNBQVM2QixjQUFjQSxDQUFDQyxFQUFFLEVBQUVDLFdBQVcsRUFBRTtFQUNyQyxJQUFJQyxNQUFNLEdBQUcsSUFBSSxDQUFBOztBQUVqQjtBQUNBLEVBQUEsTUFBTUMsT0FBTyxHQUFHSCxFQUFFLENBQUNJLGFBQWEsRUFBRSxDQUFBO0VBQ2xDSixFQUFFLENBQUNLLFdBQVcsQ0FBQ0wsRUFBRSxDQUFDTSxVQUFVLEVBQUVILE9BQU8sQ0FBQyxDQUFBO0FBQ3RDSCxFQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ1AsRUFBRSxDQUFDTSxVQUFVLEVBQUVOLEVBQUUsQ0FBQ1Esa0JBQWtCLEVBQUVSLEVBQUUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7QUFDbEVULEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDVSxrQkFBa0IsRUFBRVYsRUFBRSxDQUFDUyxPQUFPLENBQUMsQ0FBQTtBQUNsRVQsRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNXLGNBQWMsRUFBRVgsRUFBRSxDQUFDWSxhQUFhLENBQUMsQ0FBQTtBQUNwRVosRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNhLGNBQWMsRUFBRWIsRUFBRSxDQUFDWSxhQUFhLENBQUMsQ0FBQTtFQUNwRVosRUFBRSxDQUFDYyxVQUFVLENBQUNkLEVBQUUsQ0FBQ00sVUFBVSxFQUFFLENBQUMsRUFBRU4sRUFBRSxDQUFDZSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUVmLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFZCxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUE7O0FBRTdFO0FBQ0EsRUFBQSxNQUFNZSxXQUFXLEdBQUdoQixFQUFFLENBQUNpQixpQkFBaUIsRUFBRSxDQUFBO0VBQzFDakIsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFSCxXQUFXLENBQUMsQ0FBQTtBQUMvQ2hCLEVBQUFBLEVBQUUsQ0FBQ29CLG9CQUFvQixDQUFDcEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFbkIsRUFBRSxDQUFDcUIsaUJBQWlCLEVBQUVyQixFQUFFLENBQUNNLFVBQVUsRUFBRUgsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFBOztBQUV4RjtBQUNBO0FBQ0EsRUFBQSxJQUFJSCxFQUFFLENBQUNzQixzQkFBc0IsQ0FBQ3RCLEVBQUUsQ0FBQ21CLFdBQVcsQ0FBQyxLQUFLbkIsRUFBRSxDQUFDdUIsb0JBQW9CLEVBQUU7QUFDdkVyQixJQUFBQSxNQUFNLEdBQUcsS0FBSyxDQUFBO0FBQ2xCLEdBQUE7O0FBRUE7RUFDQUYsRUFBRSxDQUFDSyxXQUFXLENBQUNMLEVBQUUsQ0FBQ00sVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ25DTixFQUFBQSxFQUFFLENBQUN3QixhQUFhLENBQUNyQixPQUFPLENBQUMsQ0FBQTtFQUN6QkgsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3hDbkIsRUFBQUEsRUFBRSxDQUFDeUIsaUJBQWlCLENBQUNULFdBQVcsQ0FBQyxDQUFBO0FBRWpDLEVBQUEsT0FBT2QsTUFBTSxDQUFBO0FBQ2pCLENBQUE7QUFFQSxTQUFTd0IsNkJBQTZCQSxDQUFDMUIsRUFBRSxFQUFFQyxXQUFXLEVBQUU7RUFDcEQsSUFBSUMsTUFBTSxHQUFHLElBQUksQ0FBQTs7QUFFakI7QUFDQSxFQUFBLE1BQU1DLE9BQU8sR0FBR0gsRUFBRSxDQUFDSSxhQUFhLEVBQUUsQ0FBQTtFQUNsQ0osRUFBRSxDQUFDSyxXQUFXLENBQUNMLEVBQUUsQ0FBQ00sVUFBVSxFQUFFSCxPQUFPLENBQUMsQ0FBQTtBQUN0Q0gsRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNRLGtCQUFrQixFQUFFUixFQUFFLENBQUNTLE9BQU8sQ0FBQyxDQUFBO0FBQ2xFVCxFQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ1AsRUFBRSxDQUFDTSxVQUFVLEVBQUVOLEVBQUUsQ0FBQ1Usa0JBQWtCLEVBQUVWLEVBQUUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7QUFDbEVULEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDVyxjQUFjLEVBQUVYLEVBQUUsQ0FBQ1ksYUFBYSxDQUFDLENBQUE7QUFDcEVaLEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDYSxjQUFjLEVBQUViLEVBQUUsQ0FBQ1ksYUFBYSxDQUFDLENBQUE7O0FBRXBFO0FBQ0E7QUFDQTtFQUNBLE1BQU1lLElBQUksR0FBRyxJQUFJQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtFQUN2QzVCLEVBQUUsQ0FBQ2MsVUFBVSxDQUFDZCxFQUFFLENBQUNNLFVBQVUsRUFBRSxDQUFDLEVBQUVOLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFZixFQUFFLENBQUNlLElBQUksRUFBRWQsV0FBVyxFQUFFMEIsSUFBSSxDQUFDLENBQUE7RUFFN0UsSUFBSTNCLEVBQUUsQ0FBQzZCLFFBQVEsRUFBRSxLQUFLN0IsRUFBRSxDQUFDOEIsUUFBUSxFQUFFO0FBQy9CNUIsSUFBQUEsTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUNkNkIsSUFBQUEsT0FBTyxDQUFDQyxHQUFHLENBQUMsOEdBQThHLENBQUMsQ0FBQTtBQUMvSCxHQUFBOztBQUVBO0VBQ0FoQyxFQUFFLENBQUNLLFdBQVcsQ0FBQ0wsRUFBRSxDQUFDTSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkNOLEVBQUFBLEVBQUUsQ0FBQ3dCLGFBQWEsQ0FBQ3JCLE9BQU8sQ0FBQyxDQUFBO0FBRXpCLEVBQUEsT0FBT0QsTUFBTSxDQUFBO0FBQ2pCLENBQUE7QUFFQSxTQUFTK0IsNkJBQTZCQSxDQUFDL0QsTUFBTSxFQUFFO0FBQzNDLEVBQUEsSUFBSSxDQUFDQSxNQUFNLENBQUNnRSxzQkFBc0IsRUFDOUIsT0FBTyxLQUFLLENBQUE7QUFFaEIsRUFBQSxNQUFNQyxPQUFPLEdBQUcsSUFBSUMsTUFBTSxDQUFDbEUsTUFBTSxFQUFFbUUsV0FBVyxDQUFDQyxnQkFBZ0IsQ0FBQ3BFLE1BQU0sRUFBRTtBQUNwRXFFLElBQUFBLElBQUksRUFBRSxRQUFRO0FBQ2RDLElBQUFBLFVBQVUsRUFBRTNFLGlCQUFpQjtBQUM3QjRFLElBQUFBLFlBQVksRUFBRTNFLGlCQUFBQTtBQUNsQixHQUFDLENBQUMsQ0FBQyxDQUFBO0FBRUgsRUFBQSxNQUFNNEUsT0FBTyxHQUFHLElBQUlOLE1BQU0sQ0FBQ2xFLE1BQU0sRUFBRW1FLFdBQVcsQ0FBQ0MsZ0JBQWdCLENBQUNwRSxNQUFNLEVBQUU7QUFDcEVxRSxJQUFBQSxJQUFJLEVBQUUsUUFBUTtBQUNkQyxJQUFBQSxVQUFVLEVBQUUzRSxpQkFBaUI7QUFDN0I0RSxJQUFBQSxZQUFZLEVBQUUxRSxpQkFBQUE7QUFDbEIsR0FBQyxDQUFDLENBQUMsQ0FBQTtBQUVILEVBQUEsTUFBTTRFLGNBQWMsR0FBRztBQUNuQkMsSUFBQUEsTUFBTSxFQUFFQyxtQkFBbUI7QUFDM0JDLElBQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1JDLElBQUFBLE1BQU0sRUFBRSxDQUFDO0FBQ1RDLElBQUFBLE9BQU8sRUFBRSxLQUFLO0FBQ2RDLElBQUFBLFNBQVMsRUFBRUMsY0FBYztBQUN6QkMsSUFBQUEsU0FBUyxFQUFFRCxjQUFjO0FBQ3pCWCxJQUFBQSxJQUFJLEVBQUUsU0FBQTtHQUNULENBQUE7RUFDRCxNQUFNYSxJQUFJLEdBQUcsSUFBSUMsT0FBTyxDQUFDbkYsTUFBTSxFQUFFeUUsY0FBYyxDQUFDLENBQUE7QUFDaEQsRUFBQSxNQUFNVyxLQUFLLEdBQUcsSUFBSUMsWUFBWSxDQUFDO0FBQzNCQyxJQUFBQSxXQUFXLEVBQUVKLElBQUk7QUFDakJLLElBQUFBLEtBQUssRUFBRSxLQUFBO0FBQ1gsR0FBQyxDQUFDLENBQUE7QUFDRnhGLEVBQUFBLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFb0YsS0FBSyxFQUFFbkIsT0FBTyxDQUFDLENBQUE7RUFFdENRLGNBQWMsQ0FBQ0MsTUFBTSxHQUFHYyxpQkFBaUIsQ0FBQTtFQUN6QyxNQUFNQyxJQUFJLEdBQUcsSUFBSU4sT0FBTyxDQUFDbkYsTUFBTSxFQUFFeUUsY0FBYyxDQUFDLENBQUE7QUFDaEQsRUFBQSxNQUFNaUIsS0FBSyxHQUFHLElBQUlMLFlBQVksQ0FBQztBQUMzQkMsSUFBQUEsV0FBVyxFQUFFRyxJQUFJO0FBQ2pCRixJQUFBQSxLQUFLLEVBQUUsS0FBQTtBQUNYLEdBQUMsQ0FBQyxDQUFBO0FBQ0Z2RixFQUFBQSxNQUFNLENBQUMyRixpQkFBaUIsQ0FBQ0MsUUFBUSxDQUFDVixJQUFJLENBQUMsQ0FBQTtBQUN2Q25GLEVBQUFBLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFMEYsS0FBSyxFQUFFbEIsT0FBTyxDQUFDLENBQUE7QUFFdEMsRUFBQSxNQUFNcUIsZUFBZSxHQUFHN0YsTUFBTSxDQUFDOEYsaUJBQWlCLENBQUE7RUFDaEQ5RixNQUFNLENBQUMrRixjQUFjLENBQUNMLEtBQUssQ0FBQ00sSUFBSSxDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUVoRCxFQUFBLE1BQU1DLE1BQU0sR0FBRyxJQUFJQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaENuRyxFQUFBQSxNQUFNLENBQUNvRyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFRixNQUFNLENBQUMsQ0FBQTtBQUVyQ2xHLEVBQUFBLE1BQU0sQ0FBQytGLGNBQWMsQ0FBQ0YsZUFBZSxDQUFDLENBQUE7QUFFdEMsRUFBQSxNQUFNUSxDQUFDLEdBQUdILE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNSSxDQUFDLEdBQUdKLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNSyxDQUFDLEdBQUdMLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNTSxDQUFDLEdBQUdOLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7RUFDekIsTUFBTU8sQ0FBQyxHQUFHSixDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBR0MsQ0FBQyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBR0MsQ0FBQyxHQUFHLEdBQUcsR0FBR0MsQ0FBQyxDQUFBO0VBRS9EdEIsSUFBSSxDQUFDd0IsT0FBTyxFQUFFLENBQUE7RUFDZHRCLEtBQUssQ0FBQ3NCLE9BQU8sRUFBRSxDQUFBO0VBQ2ZqQixJQUFJLENBQUNpQixPQUFPLEVBQUUsQ0FBQTtFQUNkaEIsS0FBSyxDQUFDZ0IsT0FBTyxFQUFFLENBQUE7RUFDZnpDLE9BQU8sQ0FBQ3lDLE9BQU8sRUFBRSxDQUFBO0VBQ2pCbEMsT0FBTyxDQUFDa0MsT0FBTyxFQUFFLENBQUE7RUFFakIsT0FBT0QsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUNsQixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1FLG1CQUFtQixTQUFTQyxjQUFjLENBQUM7QUE0QjdDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxPQUFPLEdBQUcsRUFBRSxFQUFFO0FBQUEsSUFBQSxJQUFBQyxrQkFBQSxDQUFBO0FBQzlCLElBQUEsS0FBSyxDQUFDRixNQUFNLEVBQUVDLE9BQU8sQ0FBQyxDQUFBO0FBckUxQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFSSSxJQUFBLElBQUEsQ0FTQWpGLEVBQUUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVGO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTkksSUFPQW1GLENBQUFBLG1CQUFtQixHQUFHLElBQUksQ0FBQTtBQUUxQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsMEJBQTBCLEdBQUcsS0FBSyxDQUFBO0lBNkM5QkgsT0FBTyxHQUFHLElBQUksQ0FBQ0ksV0FBVyxDQUFBO0lBRTFCLElBQUksQ0FBQ0MsZ0JBQWdCLEVBQUUsQ0FBQTs7QUFFdkI7SUFDQSxJQUFJLENBQUNDLGdCQUFnQixFQUFFLENBQUE7O0FBRXZCO0lBQ0EsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSyxDQUFBO0FBRXhCLElBQUEsSUFBSSxDQUFDQyxtQkFBbUIsR0FBSUMsS0FBSyxJQUFLO01BQ2xDQSxLQUFLLENBQUNDLGNBQWMsRUFBRSxDQUFBO01BQ3RCLElBQUksQ0FBQ0gsV0FBVyxHQUFHLElBQUksQ0FBQTtNQUN2QixJQUFJLENBQUNJLFdBQVcsRUFBRSxDQUFBO0FBQ2xCQyxNQUFBQSxLQUFLLENBQUM3RCxHQUFHLENBQUMsd0NBQXdDLENBQUMsQ0FBQTtBQUNuRCxNQUFBLElBQUksQ0FBQzhELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQTtLQUMxQixDQUFBO0lBRUQsSUFBSSxDQUFDQyx1QkFBdUIsR0FBRyxNQUFNO0FBQ2pDRixNQUFBQSxLQUFLLENBQUM3RCxHQUFHLENBQUMsNENBQTRDLENBQUMsQ0FBQTtNQUN2RCxJQUFJLENBQUN3RCxXQUFXLEdBQUcsS0FBSyxDQUFBO01BQ3hCLElBQUksQ0FBQ1EsY0FBYyxFQUFFLENBQUE7QUFDckIsTUFBQSxJQUFJLENBQUNGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO0tBQzlCLENBQUE7O0FBRUQ7SUFDQSxNQUFNRyxFQUFFLEdBQUksT0FBT0MsU0FBUyxLQUFLLFdBQVcsSUFBS0EsU0FBUyxDQUFDQyxTQUFTLENBQUE7SUFDcEUsSUFBSSxDQUFDQyx5QkFBeUIsR0FBR0gsRUFBRSxJQUFJQSxFQUFFLENBQUNJLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBS0osRUFBRSxDQUFDSSxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUlKLEVBQUUsQ0FBQ0ksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUE7SUFDakgsSUFBSSxJQUFJLENBQUNELHlCQUF5QixFQUFFO01BQ2hDbkIsT0FBTyxDQUFDcUIsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUN6QlQsTUFBQUEsS0FBSyxDQUFDN0QsR0FBRyxDQUFDLDhFQUE4RSxDQUFDLENBQUE7QUFDN0YsS0FBQTs7QUFFQTtJQUNBLElBQUl1RSxRQUFRLENBQUNDLFdBQVcsS0FBSyxTQUFTLElBQUlELFFBQVEsQ0FBQ2hFLElBQUksS0FBSyxTQUFTLEVBQUU7TUFDbkUsTUFBTTBELEdBQUUsR0FBSSxPQUFPQyxTQUFTLEtBQUssV0FBVyxHQUFJQSxTQUFTLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFDeEUsTUFBQSxNQUFNTSxLQUFLLEdBQUdSLEdBQUUsQ0FBQ1EsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUE7TUFDaEQsTUFBTUMsY0FBYyxHQUFHRCxLQUFLLEdBQUdBLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDOUMsTUFBQSxJQUFJQyxjQUFjLEVBQUU7QUFDaEIsUUFBQSxNQUFNQyxPQUFPLEdBQUdDLFVBQVUsQ0FBQ0YsY0FBYyxDQUFDLENBQUE7QUFDMUMsUUFBQSxJQUFJQyxPQUFPLElBQUksR0FBRyxJQUFJQSxPQUFPLEtBQUssR0FBRyxFQUFFO1VBQ25DMUIsT0FBTyxDQUFDcUIsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUN6QlQsVUFBQUEsS0FBSyxDQUFDN0QsR0FBRyxDQUFDLGdIQUFnSCxHQUFHMEUsY0FBYyxDQUFDLENBQUE7QUFDaEosU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSTFHLEVBQUUsR0FBRyxJQUFJLENBQUE7O0FBRWI7SUFDQSxJQUFJLENBQUM2RyxtQkFBbUIsR0FBQSxDQUFBM0Isa0JBQUEsR0FBR0QsT0FBTyxDQUFDcUIsU0FBUyxLQUFBLElBQUEsR0FBQXBCLGtCQUFBLEdBQUksS0FBSyxDQUFBO0lBQ3JERCxPQUFPLENBQUNxQixTQUFTLEdBQUcsS0FBSyxDQUFBOztBQUV6QjtJQUNBLElBQUlyQixPQUFPLENBQUNqRixFQUFFLEVBQUU7TUFDWkEsRUFBRSxHQUFHaUYsT0FBTyxDQUFDakYsRUFBRSxDQUFBO0FBQ25CLEtBQUMsTUFBTTtBQUNILE1BQUEsTUFBTThHLFlBQVksR0FBSTdCLE9BQU8sQ0FBQzZCLFlBQVksS0FBS0MsU0FBUyxHQUFJOUIsT0FBTyxDQUFDNkIsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUN2RixNQUFBLE1BQU1FLEtBQUssR0FBR0YsWUFBWSxHQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLG9CQUFvQixDQUFDLENBQUE7QUFDeEcsTUFBQSxLQUFLLElBQUlHLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsS0FBSyxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO1FBQ25DakgsRUFBRSxHQUFHZ0YsTUFBTSxDQUFDbUMsVUFBVSxDQUFDSCxLQUFLLENBQUNDLENBQUMsQ0FBQyxFQUFFaEMsT0FBTyxDQUFDLENBQUE7QUFDekMsUUFBQSxJQUFJakYsRUFBRSxFQUFFO0FBQ0osVUFBQSxNQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDQSxFQUFFLEVBQUU7QUFDTCxNQUFBLE1BQU0sSUFBSW9ILEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO0FBQzFDLEtBQUE7SUFFQSxJQUFJLENBQUNwSCxFQUFFLEdBQUdBLEVBQUUsQ0FBQTtJQUNaLElBQUksQ0FBQ3FILFFBQVEsR0FBRyxPQUFPQyxzQkFBc0IsS0FBSyxXQUFXLElBQUl0SCxFQUFFLFlBQVlzSCxzQkFBc0IsQ0FBQTtBQUNyRyxJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDRixRQUFRLENBQUE7SUFDOUIsSUFBSSxDQUFDRyxXQUFXLEdBQUcsSUFBSSxDQUFDSCxRQUFRLEdBQUdJLGlCQUFpQixHQUFHQyxpQkFBaUIsQ0FBQTs7QUFFeEU7QUFDQSxJQUFBLElBQUksQ0FBQ0Msc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFakMsSUFBQSxNQUFNQyxRQUFRLEdBQUdyQixRQUFRLENBQUNDLFdBQVcsS0FBSyxRQUFRLENBQUE7QUFDbEQsSUFBQSxNQUFNcUIsUUFBUSxHQUFHdEIsUUFBUSxDQUFDQyxXQUFXLEtBQUssUUFBUSxDQUFBO0FBQ2xELElBQUEsTUFBTXNCLEtBQUssR0FBR3ZCLFFBQVEsQ0FBQ3dCLE9BQU8sSUFBSTdCLFNBQVMsQ0FBQzhCLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBOztBQUU1RTtJQUNBLElBQUksQ0FBQ0Msc0NBQXNDLEdBQUdMLFFBQVEsQ0FBQTs7QUFFdEQ7SUFDQSxJQUFJLENBQUNNLHVDQUF1QyxHQUFHTCxLQUFLLElBQUlGLFFBQVEsSUFBSSxDQUFDM0MsT0FBTyxDQUFDbUQsS0FBSyxDQUFBO0lBRWxGcEQsTUFBTSxDQUFDcUQsZ0JBQWdCLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDNUMsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFDNUVULE1BQU0sQ0FBQ3FELGdCQUFnQixDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQ3RDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxDQUFBO0lBRXBGLElBQUksQ0FBQ3VDLG9CQUFvQixFQUFFLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxzQkFBc0IsRUFBRSxDQUFBO0lBQzdCLElBQUksQ0FBQ0MscUJBQXFCLEVBQUUsQ0FBQTtJQUM1QixJQUFJLENBQUNDLHVCQUF1QixFQUFFLENBQUE7QUFFOUIsSUFBQSxJQUFJLENBQUNDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFBOztBQUUzQjtJQUNBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsQ0FBQ2QsUUFBUSxJQUFJLE9BQU9lLFdBQVcsS0FBSyxXQUFXLENBQUE7QUFFMUUsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxDQUNiN0ksRUFBRSxDQUFDOEksTUFBTSxFQUNUOUksRUFBRSxDQUFDWSxhQUFhLEVBQ2hCWixFQUFFLENBQUMrSSxlQUFlLENBQ3JCLENBQUE7SUFFRCxJQUFJLENBQUNDLGVBQWUsR0FBRyxDQUNuQmhKLEVBQUUsQ0FBQ2lKLFFBQVEsRUFDWGpKLEVBQUUsQ0FBQ2tKLGFBQWEsRUFDaEJsSixFQUFFLENBQUNtSixxQkFBcUIsRUFDeEIsSUFBSSxDQUFDOUIsUUFBUSxHQUFHckgsRUFBRSxDQUFDb0osR0FBRyxHQUFHLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQ0EsY0FBYyxDQUFDQyxPQUFPLEdBQUd0SixFQUFFLENBQUNpSixRQUFRLEVBQ3hGLElBQUksQ0FBQzVCLFFBQVEsR0FBR3JILEVBQUUsQ0FBQ3VKLEdBQUcsR0FBRyxJQUFJLENBQUNGLGNBQWMsR0FBRyxJQUFJLENBQUNBLGNBQWMsQ0FBQ0csT0FBTyxHQUFHeEosRUFBRSxDQUFDaUosUUFBUSxDQUMzRixDQUFBO0lBRUQsSUFBSSxDQUFDUSxvQkFBb0IsR0FBRyxDQUN4QnpKLEVBQUUsQ0FBQzBKLElBQUksRUFDUDFKLEVBQUUsQ0FBQzJKLEdBQUcsRUFDTjNKLEVBQUUsQ0FBQzRKLFNBQVMsRUFDWjVKLEVBQUUsQ0FBQzZKLG1CQUFtQixFQUN0QjdKLEVBQUUsQ0FBQzhKLFNBQVMsRUFDWjlKLEVBQUUsQ0FBQytKLG1CQUFtQixFQUN0Qi9KLEVBQUUsQ0FBQ2dLLFNBQVMsRUFDWmhLLEVBQUUsQ0FBQ2lLLGtCQUFrQixFQUNyQmpLLEVBQUUsQ0FBQ2tLLG1CQUFtQixFQUN0QmxLLEVBQUUsQ0FBQ21LLFNBQVMsRUFDWm5LLEVBQUUsQ0FBQ29LLG1CQUFtQixFQUN0QnBLLEVBQUUsQ0FBQ3FLLGNBQWMsRUFDakJySyxFQUFFLENBQUNzSyx3QkFBd0IsQ0FDOUIsQ0FBQTtJQUVELElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsQ0FDeEJ2SyxFQUFFLENBQUMwSixJQUFJLEVBQ1AxSixFQUFFLENBQUMySixHQUFHLEVBQ04zSixFQUFFLENBQUM0SixTQUFTLEVBQ1o1SixFQUFFLENBQUM2SixtQkFBbUIsRUFDdEI3SixFQUFFLENBQUM4SixTQUFTLEVBQ1o5SixFQUFFLENBQUMrSixtQkFBbUIsRUFDdEIvSixFQUFFLENBQUNnSyxTQUFTLEVBQ1poSyxFQUFFLENBQUNpSyxrQkFBa0IsRUFDckJqSyxFQUFFLENBQUNrSyxtQkFBbUIsRUFDdEJsSyxFQUFFLENBQUNtSyxTQUFTLEVBQ1puSyxFQUFFLENBQUNvSyxtQkFBbUIsRUFDdEJwSyxFQUFFLENBQUN3SyxjQUFjLEVBQ2pCeEssRUFBRSxDQUFDeUssd0JBQXdCLENBQzlCLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLENBQ2hCMUssRUFBRSxDQUFDMkssS0FBSyxFQUNSM0ssRUFBRSxDQUFDNEssSUFBSSxFQUNQNUssRUFBRSxDQUFDNkssS0FBSyxFQUNSN0ssRUFBRSxDQUFDOEssTUFBTSxFQUNUOUssRUFBRSxDQUFDK0ssT0FBTyxFQUNWL0ssRUFBRSxDQUFDZ0wsUUFBUSxFQUNYaEwsRUFBRSxDQUFDaUwsTUFBTSxFQUNUakwsRUFBRSxDQUFDa0wsTUFBTSxDQUNaLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2ZuTCxFQUFFLENBQUNvTCxJQUFJLEVBQ1BwTCxFQUFFLENBQUMwSixJQUFJLEVBQ1AxSixFQUFFLENBQUNxTCxPQUFPLEVBQ1ZyTCxFQUFFLENBQUNzTCxJQUFJLEVBQ1B0TCxFQUFFLENBQUN1TCxTQUFTLEVBQ1p2TCxFQUFFLENBQUN3TCxJQUFJLEVBQ1B4TCxFQUFFLENBQUN5TCxTQUFTLEVBQ1p6TCxFQUFFLENBQUMwTCxNQUFNLENBQ1osQ0FBQTtJQUVELElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2YsQ0FBQyxFQUNEM0wsRUFBRSxDQUFDNEwsZ0JBQWdCLEVBQ25CNUwsRUFBRSxDQUFDNkwsZ0JBQWdCLEVBQ25CN0wsRUFBRSxDQUFDNEwsZ0JBQWdCLEdBQUc1TCxFQUFFLENBQUM2TCxnQkFBZ0IsRUFDekM3TCxFQUFFLENBQUM4TCxrQkFBa0IsRUFDckI5TCxFQUFFLENBQUM4TCxrQkFBa0IsR0FBRzlMLEVBQUUsQ0FBQzRMLGdCQUFnQixFQUMzQzVMLEVBQUUsQ0FBQzhMLGtCQUFrQixHQUFHOUwsRUFBRSxDQUFDNkwsZ0JBQWdCLEVBQzNDN0wsRUFBRSxDQUFDOEwsa0JBQWtCLEdBQUc5TCxFQUFFLENBQUM0TCxnQkFBZ0IsR0FBRzVMLEVBQUUsQ0FBQzZMLGdCQUFnQixDQUNwRSxDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNFLE1BQU0sR0FBRyxDQUNWLENBQUMsRUFDRC9MLEVBQUUsQ0FBQ2dNLElBQUksRUFDUGhNLEVBQUUsQ0FBQ2lNLEtBQUssRUFDUmpNLEVBQUUsQ0FBQ2tNLGNBQWMsQ0FDcEIsQ0FBQTtJQUVELElBQUksQ0FBQ0MsUUFBUSxHQUFHLENBQ1puTSxFQUFFLENBQUNTLE9BQU8sRUFDVlQsRUFBRSxDQUFDb00sTUFBTSxFQUNUcE0sRUFBRSxDQUFDcU0sc0JBQXNCLEVBQ3pCck0sRUFBRSxDQUFDc00scUJBQXFCLEVBQ3hCdE0sRUFBRSxDQUFDdU0scUJBQXFCLEVBQ3hCdk0sRUFBRSxDQUFDd00sb0JBQW9CLENBQzFCLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2Z6TSxFQUFFLENBQUMwTSxNQUFNLEVBQ1QxTSxFQUFFLENBQUMyTSxLQUFLLEVBQ1IzTSxFQUFFLENBQUM0TSxTQUFTLEVBQ1o1TSxFQUFFLENBQUM2TSxVQUFVLEVBQ2I3TSxFQUFFLENBQUM4TSxTQUFTLEVBQ1o5TSxFQUFFLENBQUMrTSxjQUFjLEVBQ2pCL00sRUFBRSxDQUFDZ04sWUFBWSxDQUNsQixDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUNWak4sRUFBRSxDQUFDa04sSUFBSSxFQUNQbE4sRUFBRSxDQUFDbU4sYUFBYSxFQUNoQm5OLEVBQUUsQ0FBQ29OLEtBQUssRUFDUnBOLEVBQUUsQ0FBQ3FOLGNBQWMsRUFDakJyTixFQUFFLENBQUNzTixHQUFHLEVBQ050TixFQUFFLENBQUN1TixZQUFZLEVBQ2Z2TixFQUFFLENBQUN3TixLQUFLLEVBQ1J4TixFQUFFLENBQUN5TixVQUFVLENBQ2hCLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsYUFBYSxHQUFHLEVBQUUsQ0FBQTtJQUN2QixJQUFJLENBQUNBLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQzJOLElBQUksQ0FBQyxHQUFXQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUNGLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQ3NOLEdBQUcsQ0FBQyxHQUFZTyxlQUFlLENBQUE7SUFDckQsSUFBSSxDQUFDSCxhQUFhLENBQUMxTixFQUFFLENBQUN3TixLQUFLLENBQUMsR0FBVU0saUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDSixhQUFhLENBQUMxTixFQUFFLENBQUMrTixVQUFVLENBQUMsR0FBS0MsZ0JBQWdCLENBQUE7SUFDdEQsSUFBSSxDQUFDTixhQUFhLENBQUMxTixFQUFFLENBQUNpTyxVQUFVLENBQUMsR0FBS0MsZ0JBQWdCLENBQUE7SUFDdEQsSUFBSSxDQUFDUixhQUFhLENBQUMxTixFQUFFLENBQUNtTyxVQUFVLENBQUMsR0FBS0MsZ0JBQWdCLENBQUE7SUFDdEQsSUFBSSxDQUFDVixhQUFhLENBQUMxTixFQUFFLENBQUNxTyxRQUFRLENBQUMsR0FBT0MsaUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDWixhQUFhLENBQUMxTixFQUFFLENBQUN1TyxRQUFRLENBQUMsR0FBT0MsaUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDZCxhQUFhLENBQUMxTixFQUFFLENBQUN5TyxRQUFRLENBQUMsR0FBT0MsaUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDaEIsYUFBYSxDQUFDMU4sRUFBRSxDQUFDMk8sU0FBUyxDQUFDLEdBQU1DLGlCQUFpQixDQUFBO0lBQ3ZELElBQUksQ0FBQ2xCLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQzZPLFNBQVMsQ0FBQyxHQUFNQyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUNwQixhQUFhLENBQUMxTixFQUFFLENBQUMrTyxTQUFTLENBQUMsR0FBTUMsaUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDdEIsYUFBYSxDQUFDMU4sRUFBRSxDQUFDaVAsVUFBVSxDQUFDLEdBQUtDLGdCQUFnQixDQUFBO0lBQ3RELElBQUksQ0FBQ3hCLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQ21QLFVBQVUsQ0FBQyxHQUFLQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUMxQixhQUFhLENBQUMxTixFQUFFLENBQUNxUCxVQUFVLENBQUMsR0FBS0MsZ0JBQWdCLENBQUE7SUFDdEQsSUFBSSxDQUFDNUIsYUFBYSxDQUFDMU4sRUFBRSxDQUFDdVAsVUFBVSxDQUFDLEdBQUtDLHFCQUFxQixDQUFBO0lBQzNELElBQUksQ0FBQzlCLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQ3lQLFlBQVksQ0FBQyxHQUFHQyx1QkFBdUIsQ0FBQTtJQUM3RCxJQUFJLENBQUNoQyxhQUFhLENBQUMxTixFQUFFLENBQUN1TixZQUFZLENBQUMsR0FBV29DLGdCQUFnQixDQUFBO0lBQzlELElBQUksQ0FBQ2pDLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQzRQLGlCQUFpQixDQUFDLEdBQU1DLGlCQUFpQixDQUFBO0lBQy9ELElBQUksQ0FBQ25DLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQzhQLGlCQUFpQixDQUFDLEdBQU1DLGlCQUFpQixDQUFBO0lBQy9ELElBQUksQ0FBQ3JDLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQ2dRLGlCQUFpQixDQUFDLEdBQU1DLGlCQUFpQixDQUFBO0lBRS9ELElBQUksSUFBSSxDQUFDNUksUUFBUSxFQUFFO01BQ2YsSUFBSSxDQUFDcUcsYUFBYSxDQUFDMU4sRUFBRSxDQUFDa1EsaUJBQWlCLENBQUMsR0FBS0MsNEJBQTRCLENBQUE7TUFDekUsSUFBSSxDQUFDekMsYUFBYSxDQUFDMU4sRUFBRSxDQUFDb1EsbUJBQW1CLENBQUMsR0FBR0MsOEJBQThCLENBQUE7TUFDM0UsSUFBSSxDQUFDM0MsYUFBYSxDQUFDMU4sRUFBRSxDQUFDc1EsZ0JBQWdCLENBQUMsR0FBTUMsMkJBQTJCLENBQUE7TUFDeEUsSUFBSSxDQUFDN0MsYUFBYSxDQUFDMU4sRUFBRSxDQUFDd1EsVUFBVSxDQUFDLEdBQVlDLHFCQUFxQixDQUFBO01BRWxFLElBQUksQ0FBQy9DLGFBQWEsQ0FBQzFOLEVBQUUsQ0FBQzBRLGNBQWMsQ0FBQyxHQUFhQyxzQkFBc0IsQ0FBQTtNQUN4RSxJQUFJLENBQUNqRCxhQUFhLENBQUMxTixFQUFFLENBQUM0USx1QkFBdUIsQ0FBQyxHQUFJQyxzQkFBc0IsQ0FBQTtNQUV4RSxJQUFJLENBQUNuRCxhQUFhLENBQUMxTixFQUFFLENBQUM4USxnQkFBZ0IsQ0FBQyxHQUFXQyx3QkFBd0IsQ0FBQTtNQUMxRSxJQUFJLENBQUNyRCxhQUFhLENBQUMxTixFQUFFLENBQUM0USx1QkFBdUIsQ0FBQyxHQUFJSSx3QkFBd0IsQ0FBQTtNQUUxRSxJQUFJLENBQUN0RCxhQUFhLENBQUMxTixFQUFFLENBQUNpUixjQUFjLENBQUMsR0FBYUMsc0JBQXNCLENBQUE7TUFDeEUsSUFBSSxDQUFDeEQsYUFBYSxDQUFDMU4sRUFBRSxDQUFDbVIsdUJBQXVCLENBQUMsR0FBSUMsc0JBQXNCLENBQUE7TUFFeEUsSUFBSSxDQUFDMUQsYUFBYSxDQUFDMU4sRUFBRSxDQUFDcVIsb0JBQW9CLENBQUMsR0FBT0MsNEJBQTRCLENBQUE7TUFDOUUsSUFBSSxDQUFDNUQsYUFBYSxDQUFDMU4sRUFBRSxDQUFDdVIsNkJBQTZCLENBQUMsR0FBR0MsNEJBQTRCLENBQUE7QUFDdkYsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0EsWUFBWSxDQUFDelIsRUFBRSxDQUFDTSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDbVIsWUFBWSxDQUFDelIsRUFBRSxDQUFDMFIsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDMUMsSUFBSSxDQUFDRCxZQUFZLENBQUN6UixFQUFFLENBQUMyUixVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7O0FBRXBDO0FBQ0EsSUFBQSxJQUFJQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLENBQUE7QUFDbEMsSUFBQSxJQUFJQyxZQUFZLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0EsY0FBYyxDQUFDckUsZ0JBQWdCLENBQUMsR0FBRyxVQUFVc0UsT0FBTyxFQUFFQyxLQUFLLEVBQUU7QUFDOUQsTUFBQSxJQUFJRCxPQUFPLENBQUNDLEtBQUssS0FBS0EsS0FBSyxFQUFFO1FBQ3pCblMsRUFBRSxDQUFDb1MsU0FBUyxDQUFDRixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7UUFDdkNELE9BQU8sQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDekIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ3BFLGVBQWUsQ0FBQyxHQUFHLElBQUksQ0FBQ29FLGNBQWMsQ0FBQ3JFLGdCQUFnQixDQUFDLENBQUE7SUFDNUUsSUFBSSxDQUFDcUUsY0FBYyxDQUFDbkUsaUJBQWlCLENBQUMsR0FBRyxVQUFVb0UsT0FBTyxFQUFFQyxLQUFLLEVBQUU7QUFDL0QsTUFBQSxJQUFJRCxPQUFPLENBQUNDLEtBQUssS0FBS0EsS0FBSyxFQUFFO1FBQ3pCblMsRUFBRSxDQUFDc1MsU0FBUyxDQUFDSixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7UUFDdkNELE9BQU8sQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDekIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ2pFLGdCQUFnQixDQUFDLEdBQUksVUFBVWtFLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9ESCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakIsTUFBQSxJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLEVBQUU7UUFDMUQ3UixFQUFFLENBQUN1UyxVQUFVLENBQUNMLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN4Q0gsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSixNQUFNLENBQUE7QUFDeEJJLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0gsTUFBTSxDQUFBO0FBQzVCLE9BQUE7S0FDSCxDQUFBO0lBQ0QsSUFBSSxDQUFDSSxjQUFjLENBQUMvRCxnQkFBZ0IsQ0FBQyxHQUFJLFVBQVVnRSxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvREgsWUFBWSxHQUFHRSxPQUFPLENBQUNDLEtBQUssQ0FBQTtBQUM1QlAsTUFBQUEsTUFBTSxHQUFHTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJOLE1BQUFBLE1BQU0sR0FBR00sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTCxNQUFBQSxNQUFNLEdBQUdLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUNqQixJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLElBQUlHLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0YsTUFBTSxFQUFFO1FBQ3hGOVIsRUFBRSxDQUFDd1MsVUFBVSxDQUFDTixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7QUFDeENILFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0osTUFBTSxDQUFBO0FBQ3hCSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdILE1BQU0sQ0FBQTtBQUN4QkcsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRixNQUFNLENBQUE7QUFDNUIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNHLGNBQWMsQ0FBQzdELGdCQUFnQixDQUFDLEdBQUksVUFBVThELE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9ESCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJMLE1BQUFBLE1BQU0sR0FBR0ssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCSixNQUFBQSxNQUFNLEdBQUdJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUNqQixJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLElBQUlHLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0YsTUFBTSxJQUFJRSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtELE1BQU0sRUFBRTtRQUN0SC9SLEVBQUUsQ0FBQ3lTLFVBQVUsQ0FBQ1AsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0FBQ3hDSCxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdKLE1BQU0sQ0FBQTtBQUN4QkksUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSCxNQUFNLENBQUE7QUFDeEJHLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0YsTUFBTSxDQUFBO0FBQ3hCRSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdELE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0UsY0FBYyxDQUFDM0QsaUJBQWlCLENBQUMsR0FBRyxVQUFVNEQsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RILFlBQVksR0FBR0UsT0FBTyxDQUFDQyxLQUFLLENBQUE7QUFDNUJQLE1BQUFBLE1BQU0sR0FBR08sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTixNQUFBQSxNQUFNLEdBQUdNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQixNQUFBLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sRUFBRTtRQUMxRDdSLEVBQUUsQ0FBQzBTLFVBQVUsQ0FBQ1IsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0FBQ3hDSCxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdKLE1BQU0sQ0FBQTtBQUN4QkksUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSCxNQUFNLENBQUE7QUFDNUIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNJLGNBQWMsQ0FBQ3JELGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDcUQsY0FBYyxDQUFDM0QsaUJBQWlCLENBQUMsQ0FBQTtJQUMvRSxJQUFJLENBQUMyRCxjQUFjLENBQUN6RCxpQkFBaUIsQ0FBQyxHQUFHLFVBQVUwRCxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvREgsWUFBWSxHQUFHRSxPQUFPLENBQUNDLEtBQUssQ0FBQTtBQUM1QlAsTUFBQUEsTUFBTSxHQUFHTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJOLE1BQUFBLE1BQU0sR0FBR00sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTCxNQUFBQSxNQUFNLEdBQUdLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUNqQixJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLElBQUlHLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0YsTUFBTSxFQUFFO1FBQ3hGOVIsRUFBRSxDQUFDMlMsVUFBVSxDQUFDVCxPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7QUFDeENILFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0osTUFBTSxDQUFBO0FBQ3hCSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdILE1BQU0sQ0FBQTtBQUN4QkcsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRixNQUFNLENBQUE7QUFDNUIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNHLGNBQWMsQ0FBQ25ELGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDbUQsY0FBYyxDQUFDekQsaUJBQWlCLENBQUMsQ0FBQTtJQUMvRSxJQUFJLENBQUN5RCxjQUFjLENBQUN2RCxpQkFBaUIsQ0FBQyxHQUFHLFVBQVV3RCxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvREgsWUFBWSxHQUFHRSxPQUFPLENBQUNDLEtBQUssQ0FBQTtBQUM1QlAsTUFBQUEsTUFBTSxHQUFHTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJOLE1BQUFBLE1BQU0sR0FBR00sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTCxNQUFBQSxNQUFNLEdBQUdLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQkosTUFBQUEsTUFBTSxHQUFHSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7TUFDakIsSUFBSUgsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSixNQUFNLElBQUlJLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0gsTUFBTSxJQUFJRyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtGLE1BQU0sSUFBSUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLRCxNQUFNLEVBQUU7UUFDdEgvUixFQUFFLENBQUM0UyxVQUFVLENBQUNWLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN4Q0gsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSixNQUFNLENBQUE7QUFDeEJJLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0gsTUFBTSxDQUFBO0FBQ3hCRyxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdGLE1BQU0sQ0FBQTtBQUN4QkUsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRCxNQUFNLENBQUE7QUFDNUIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNFLGNBQWMsQ0FBQ2pELGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDaUQsY0FBYyxDQUFDdkQsaUJBQWlCLENBQUMsQ0FBQTtJQUMvRSxJQUFJLENBQUN1RCxjQUFjLENBQUMvQyxnQkFBZ0IsQ0FBQyxHQUFJLFVBQVVnRCxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvRG5TLEVBQUUsQ0FBQzZTLGdCQUFnQixDQUFDWCxPQUFPLENBQUNHLFVBQVUsRUFBRSxLQUFLLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0tBQ3hELENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQzdDLGdCQUFnQixDQUFDLEdBQUksVUFBVThDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9EblMsRUFBRSxDQUFDOFMsZ0JBQWdCLENBQUNaLE9BQU8sQ0FBQ0csVUFBVSxFQUFFLEtBQUssRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDeEQsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDM0MsZ0JBQWdCLENBQUMsR0FBSSxVQUFVNEMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RuUyxFQUFFLENBQUMrUyxnQkFBZ0IsQ0FBQ2IsT0FBTyxDQUFDRyxVQUFVLEVBQUUsS0FBSyxFQUFFRixLQUFLLENBQUMsQ0FBQTtLQUN4RCxDQUFBO0lBQ0QsSUFBSSxDQUFDRixjQUFjLENBQUNlLHNCQUFzQixDQUFDLEdBQUcsVUFBVWQsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDcEVuUyxFQUFFLENBQUNpVCxVQUFVLENBQUNmLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtLQUMzQyxDQUFBO0lBQ0QsSUFBSSxDQUFDRixjQUFjLENBQUNpQixxQkFBcUIsQ0FBQyxHQUFJLFVBQVVoQixPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUNwRW5TLEVBQUUsQ0FBQ3VTLFVBQVUsQ0FBQ0wsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0tBQzNDLENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ2tCLHFCQUFxQixDQUFDLEdBQUksVUFBVWpCLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3BFblMsRUFBRSxDQUFDd1MsVUFBVSxDQUFDTixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDbUIscUJBQXFCLENBQUMsR0FBSSxVQUFVbEIsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDcEVuUyxFQUFFLENBQUN5UyxVQUFVLENBQUNQLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtLQUMzQyxDQUFBO0lBRUQsSUFBSSxDQUFDRixjQUFjLENBQUN0QyxnQkFBZ0IsQ0FBQyxHQUFHLFVBQVV1QyxPQUFPLEVBQUVDLEtBQUssRUFBRTtBQUM5RCxNQUFBLElBQUlELE9BQU8sQ0FBQ0MsS0FBSyxLQUFLQSxLQUFLLEVBQUU7UUFDekJuUyxFQUFFLENBQUNxVCxVQUFVLENBQUNuQixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7UUFDeENELE9BQU8sQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDekIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ3BDLGlCQUFpQixDQUFDLEdBQUksVUFBVXFDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ2hFSCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakIsTUFBQSxJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLEVBQUU7UUFDMUQ3UixFQUFFLENBQUNzVCxXQUFXLENBQUNwQixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7QUFDekNILFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0osTUFBTSxDQUFBO0FBQ3hCSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdILE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0ksY0FBYyxDQUFDbEMsaUJBQWlCLENBQUMsR0FBSSxVQUFVbUMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDaEVILFlBQVksR0FBR0UsT0FBTyxDQUFDQyxLQUFLLENBQUE7QUFDNUJQLE1BQUFBLE1BQU0sR0FBR08sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTixNQUFBQSxNQUFNLEdBQUdNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQkwsTUFBQUEsTUFBTSxHQUFHSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7TUFDakIsSUFBSUgsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSixNQUFNLElBQUlJLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0gsTUFBTSxJQUFJRyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtGLE1BQU0sRUFBRTtRQUN4RjlSLEVBQUUsQ0FBQ3VULFdBQVcsQ0FBQ3JCLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN6Q0gsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSixNQUFNLENBQUE7QUFDeEJJLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0gsTUFBTSxDQUFBO0FBQ3hCRyxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdGLE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0csY0FBYyxDQUFDaEMsaUJBQWlCLENBQUMsR0FBRyxVQUFVaUMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RILFlBQVksR0FBR0UsT0FBTyxDQUFDQyxLQUFLLENBQUE7QUFDNUJQLE1BQUFBLE1BQU0sR0FBR08sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTixNQUFBQSxNQUFNLEdBQUdNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQkwsTUFBQUEsTUFBTSxHQUFHSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJKLE1BQUFBLE1BQU0sR0FBR0ksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQ2pCLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sSUFBSUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLRixNQUFNLElBQUlFLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0QsTUFBTSxFQUFFO1FBQ3RIL1IsRUFBRSxDQUFDd1QsV0FBVyxDQUFDdEIsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0FBQ3pDSCxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdKLE1BQU0sQ0FBQTtBQUN4QkksUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSCxNQUFNLENBQUE7QUFDeEJHLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0YsTUFBTSxDQUFBO0FBQ3hCRSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdELE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUVELElBQUksQ0FBQ0UsY0FBYyxDQUFDd0Isb0JBQW9CLENBQUMsR0FBRyxVQUFVdkIsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDbEVuUyxFQUFFLENBQUMwVCxVQUFVLENBQUN4QixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDMEIscUJBQXFCLENBQUMsR0FBRyxVQUFVekIsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDbkVuUyxFQUFFLENBQUM0VCxXQUFXLENBQUMxQixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDNUMsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDNEIscUJBQXFCLENBQUMsR0FBRyxJQUFJLENBQUM1QixjQUFjLENBQUN3QixvQkFBb0IsQ0FBQyxDQUFBO0lBRXRGLElBQUksQ0FBQ3hCLGNBQWMsQ0FBQzZCLHNCQUFzQixDQUFDLEdBQUksVUFBVTVCLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3JFblMsRUFBRSxDQUFDMFMsVUFBVSxDQUFDUixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDOEIsc0JBQXNCLENBQUMsR0FBSSxVQUFVN0IsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDckVuUyxFQUFFLENBQUNzVCxXQUFXLENBQUNwQixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDNUMsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDK0Isc0JBQXNCLENBQUMsR0FBRyxJQUFJLENBQUMvQixjQUFjLENBQUM2QixzQkFBc0IsQ0FBQyxDQUFBO0lBRXpGLElBQUksQ0FBQzdCLGNBQWMsQ0FBQ2dDLHNCQUFzQixDQUFDLEdBQUksVUFBVS9CLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3JFblMsRUFBRSxDQUFDMlMsVUFBVSxDQUFDVCxPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDaUMsc0JBQXNCLENBQUMsR0FBSSxVQUFVaEMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDckVuUyxFQUFFLENBQUN1VCxXQUFXLENBQUNyQixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDNUMsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDa0Msc0JBQXNCLENBQUMsR0FBRyxJQUFJLENBQUNsQyxjQUFjLENBQUNnQyxzQkFBc0IsQ0FBQyxDQUFBO0lBRXpGLElBQUksQ0FBQ2hDLGNBQWMsQ0FBQ21DLHNCQUFzQixDQUFDLEdBQUksVUFBVWxDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3JFblMsRUFBRSxDQUFDNFMsVUFBVSxDQUFDVixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDb0Msc0JBQXNCLENBQUMsR0FBSSxVQUFVbkMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDckVuUyxFQUFFLENBQUN3VCxXQUFXLENBQUN0QixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDNUMsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDcUMsc0JBQXNCLENBQUMsR0FBRyxJQUFJLENBQUNyQyxjQUFjLENBQUNtQyxzQkFBc0IsQ0FBQyxDQUFBO0lBRXpGLElBQUksQ0FBQ25DLGNBQWMsQ0FBQ3NDLHFCQUFxQixDQUFDLEdBQUksVUFBVXJDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3BFblMsRUFBRSxDQUFDK1MsZ0JBQWdCLENBQUNiLE9BQU8sQ0FBQ0csVUFBVSxFQUFFLEtBQUssRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDeEQsQ0FBQTtJQUVELElBQUksQ0FBQ3FDLG9CQUFvQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxJQUFJLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBOztBQUU5RTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBQSxJQUFJQyxXQUFXLEdBQUcsSUFBSSxDQUFDQyxtQkFBbUIsQ0FBQTtBQUMxQ0QsSUFBQUEsV0FBVyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckJBLFdBQVcsSUFBSSxDQUFDLENBQUM7SUFDakJBLFdBQVcsSUFBSSxDQUFDLENBQUM7QUFDakJBLElBQUFBLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLElBQUEsSUFBSSxDQUFDRSxTQUFTLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSixXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0FBRTdDO0FBQ0E7QUFDQTtBQUNBLElBQUEsSUFBSSxDQUFDRSxTQUFTLEdBQUdDLElBQUksQ0FBQ0UsR0FBRyxDQUFDLElBQUksQ0FBQ0gsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBRTlDLElBQUEsSUFBSSxJQUFJLENBQUNJLGdCQUFnQixLQUFLLGFBQWEsRUFBRTtNQUN6QyxJQUFJLENBQUNKLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFDdkIsS0FBQTtJQUVBLElBQUksQ0FBQ2hSLGlCQUFpQixHQUFHLElBQUksQ0FBQ3FSLEtBQUssQ0FBQ0MsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0lBRXJELElBQUksSUFBSSxDQUFDVixlQUFlLEVBQUU7TUFDdEIsSUFBSSxJQUFJLENBQUNwTixRQUFRLEVBQUU7QUFDZjtBQUNBLFFBQUEsSUFBSSxDQUFDbkYsc0JBQXNCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQ2tULG1CQUFtQixDQUFBO0FBQzVELE9BQUMsTUFBTTtBQUNIO1FBQ0EsSUFBSSxDQUFDbFQsc0JBQXNCLEdBQUduQyxjQUFjLENBQUNDLEVBQUUsRUFBRUEsRUFBRSxDQUFDd04sS0FBSyxDQUFDLENBQUE7QUFDOUQsT0FBQTtBQUNKLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQ3RMLHNCQUFzQixHQUFHLEtBQUssQ0FBQTtBQUN2QyxLQUFBOztBQUVBO0lBQ0EsSUFBSSxJQUFJLENBQUNtVCx1QkFBdUIsRUFBRTtBQUM5QixNQUFBLElBQUksQ0FBQ0MsMEJBQTBCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQ0QsdUJBQXVCLENBQUE7QUFDcEUsS0FBQyxNQUFNLElBQUksSUFBSSxDQUFDRSxtQkFBbUIsRUFBRTtNQUNqQyxJQUFJLElBQUksQ0FBQ2xPLFFBQVEsRUFBRTtBQUNmO0FBQ0EsUUFBQSxJQUFJLENBQUNpTywwQkFBMEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDRixtQkFBbUIsQ0FBQTtBQUNoRSxPQUFDLE1BQU07QUFDSDtBQUNBLFFBQUEsSUFBSSxDQUFDRSwwQkFBMEIsR0FBR3ZWLGNBQWMsQ0FBQ0MsRUFBRSxFQUFFLElBQUksQ0FBQ3VWLG1CQUFtQixDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUNqRyxPQUFBO0FBQ0osS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDRiwwQkFBMEIsR0FBRyxLQUFLLENBQUE7QUFDM0MsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDRywrQkFBK0IsR0FBSSxJQUFJLENBQUNDLFlBQVksS0FBSyxPQUFPLElBQUksSUFBSSxDQUFDaEIsaUJBQWlCLElBQUksQ0FBRSxDQUFBO0FBQ3JHLElBQUEsSUFBSSxDQUFDaUIsbUJBQW1CLEdBQUcsSUFBSSxDQUFDdE8sUUFBUSxDQUFBO0lBRXhDLElBQUksQ0FBQ3VPLDBCQUEwQixHQUFHN08sU0FBUyxDQUFBO0lBQzNDLElBQUksQ0FBQzhPLDBCQUEwQixHQUFHOU8sU0FBUyxDQUFBOztBQUUzQztJQUNBLElBQUksQ0FBQytPLGtCQUFrQixHQUFHcFMsaUJBQWlCLENBQUE7SUFDM0MsSUFBSSxJQUFJLENBQUM2UixtQkFBbUIsSUFBSSxJQUFJLENBQUNRLHlCQUF5QixJQUFJLElBQUksQ0FBQ0MseUJBQXlCLEVBQUU7TUFDOUYsSUFBSSxDQUFDRixrQkFBa0IsR0FBR0csbUJBQW1CLENBQUE7S0FDaEQsTUFBTSxJQUFJLElBQUksQ0FBQ3hCLGVBQWUsSUFBSSxJQUFJLENBQUN5QixxQkFBcUIsRUFBRTtNQUMzRCxJQUFJLENBQUNKLGtCQUFrQixHQUFHalQsbUJBQW1CLENBQUE7QUFDakQsS0FBQTtJQUVBLElBQUksQ0FBQ3NULFFBQVEsRUFBRSxDQUFBO0FBQ25CLEdBQUE7QUFFQUEsRUFBQUEsUUFBUUEsR0FBRztJQUNQLEtBQUssQ0FBQ0EsUUFBUSxFQUFFLENBQUE7QUFFaEIsSUFBQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNqRCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJelIsRUFBQUEsT0FBT0EsR0FBRztJQUNOLEtBQUssQ0FBQ0EsT0FBTyxFQUFFLENBQUE7QUFDZixJQUFBLE1BQU01RSxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFFbEIsSUFBQSxJQUFJLElBQUksQ0FBQ3FILFFBQVEsSUFBSSxJQUFJLENBQUNpUCxRQUFRLEVBQUU7QUFDaEN0VyxNQUFBQSxFQUFFLENBQUN1Vyx1QkFBdUIsQ0FBQyxJQUFJLENBQUNELFFBQVEsQ0FBQyxDQUFBO0FBQzdDLEtBQUE7SUFFQSxJQUFJLENBQUNFLDJCQUEyQixFQUFFLENBQUE7QUFFbEMsSUFBQSxJQUFJLENBQUN4UixNQUFNLENBQUN5UixtQkFBbUIsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUNoUixtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNwRixJQUFBLElBQUksQ0FBQ1QsTUFBTSxDQUFDeVIsbUJBQW1CLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDMVEsdUJBQXVCLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFFNUYsSUFBSSxDQUFDTixtQkFBbUIsR0FBRyxJQUFJLENBQUE7SUFDL0IsSUFBSSxDQUFDTSx1QkFBdUIsR0FBRyxJQUFJLENBQUE7SUFFbkMsSUFBSSxDQUFDL0YsRUFBRSxHQUFHLElBQUksQ0FBQTtJQUVkLEtBQUssQ0FBQzBXLFdBQVcsRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7RUFFQWhPLGdCQUFnQkEsQ0FBQ2lPLFdBQVcsRUFBRTtBQUMxQixJQUFBLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUksQ0FBQ3ZSLFdBQVcsQ0FBQ3dSLE9BQU8sQ0FBQTtBQUUvQyxJQUFBLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUl2VCxZQUFZLENBQUM7QUFDL0JoQixNQUFBQSxJQUFJLEVBQUUsa0JBQWtCO0FBQ3hCd1UsTUFBQUEsY0FBYyxFQUFFLElBQUk7QUFDcEJ0VCxNQUFBQSxLQUFLLEVBQUUsSUFBSSxDQUFDNEIsV0FBVyxDQUFDNUIsS0FBSztNQUM3Qm9ULE9BQU8sRUFBRSxJQUFJLENBQUNELGVBQWU7TUFDN0JJLE9BQU8sRUFBRSxJQUFJLENBQUNBLE9BQUFBO0FBQ2xCLEtBQUMsQ0FBQyxDQUFBOztBQUVGO0FBQ0EsSUFBQSxJQUFJLENBQUNGLFVBQVUsQ0FBQzVTLElBQUksQ0FBQytTLHdCQUF3QixHQUFHTixXQUFXLENBQUE7QUFDL0QsR0FBQTs7QUFFQTtFQUNBaFAsc0JBQXNCQSxDQUFDM0csV0FBVyxFQUFFO0FBQ2hDLElBQUEsTUFBTWhCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQkEsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFSCxXQUFXLENBQUMsQ0FBQTtBQUMvQyxJQUFBLE1BQU1rVyxTQUFTLEdBQUcsSUFBSSxDQUFDbFgsRUFBRSxDQUFDbVgsWUFBWSxDQUFDLElBQUksQ0FBQ25YLEVBQUUsQ0FBQ29YLFVBQVUsQ0FBQyxDQUFBO0FBQzFELElBQUEsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBR0gsU0FBUyxHQUFHeFQsaUJBQWlCLEdBQUc0VCxnQkFBZ0IsQ0FBQTtBQUM1RSxHQUFBO0FBRUFDLEVBQUFBLGdCQUFnQkEsR0FBRztJQUVmLE1BQU1DLGlCQUFpQixHQUFHLElBQUksQ0FBQ3hTLE1BQU0sQ0FBQ2xDLEtBQUssS0FBSyxJQUFJLENBQUMyVSxjQUFjLENBQUNsVCxDQUFDLElBQUksSUFBSSxDQUFDUyxNQUFNLENBQUNqQyxNQUFNLEtBQUssSUFBSSxDQUFDMFUsY0FBYyxDQUFDalQsQ0FBQyxDQUFBO0FBQ3JILElBQUEsSUFBSSxJQUFJLENBQUNZLDBCQUEwQixJQUFJb1MsaUJBQWlCLEVBQUU7QUFFdEQ7TUFDQSxJQUFJLElBQUksQ0FBQ3BTLDBCQUEwQixFQUFFO0FBQ2pDLFFBQUEsSUFBSSxDQUFDdUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDeEMsbUJBQW1CLENBQUMsQ0FBQTtBQUN6RCxPQUFBO01BRUEsSUFBSSxDQUFDQywwQkFBMEIsR0FBRyxLQUFLLENBQUE7QUFDdkMsTUFBQSxJQUFJLENBQUNxUyxjQUFjLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUMxUyxNQUFNLENBQUNsQyxLQUFLLEVBQUUsSUFBSSxDQUFDa0MsTUFBTSxDQUFDakMsTUFBTSxDQUFDLENBQUE7O0FBRTlEO0FBQ0EsTUFBQSxJQUFJLENBQUMrVCxVQUFVLENBQUNsUyxPQUFPLEVBQUUsQ0FBQTtBQUN6QixNQUFBLElBQUksQ0FBQzhELGdCQUFnQixDQUFDLElBQUksQ0FBQ3ZELG1CQUFtQixDQUFDLENBQUE7QUFDbkQsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQXdTLEVBQUFBLHNCQUFzQkEsQ0FBQ0MsWUFBWSxFQUFFaFYsTUFBTSxFQUFFO0lBQ3pDLE9BQU8sSUFBSWlWLGlCQUFpQixFQUFFLENBQUE7QUFDbEMsR0FBQTs7QUFFQTtFQUNBQyxxQkFBcUJBLENBQUNDLFdBQVcsRUFBRTtBQUMvQixJQUFBLE9BQU8sSUFBSUMsZ0JBQWdCLENBQUNELFdBQVcsQ0FBQyxDQUFBO0FBQzVDLEdBQUE7RUFFQUUsZ0JBQWdCQSxDQUFDN1osTUFBTSxFQUFFO0FBQ3JCLElBQUEsT0FBTyxJQUFJOFosV0FBVyxDQUFDOVosTUFBTSxDQUFDLENBQUE7QUFDbEMsR0FBQTtFQUVBK1osaUJBQWlCQSxDQUFDaFksT0FBTyxFQUFFO0lBQ3ZCLE9BQU8sSUFBSWlZLFlBQVksRUFBRSxDQUFBO0FBQzdCLEdBQUE7RUFFQUMsc0JBQXNCQSxDQUFDN1osWUFBWSxFQUFFO0lBQ2pDLE9BQU8sSUFBSThaLGlCQUFpQixFQUFFLENBQUE7QUFDbEMsR0FBQTtFQUdBQyxVQUFVQSxDQUFDaFcsSUFBSSxFQUFFO0FBQ2IsSUFBQSxJQUFJZ0UsUUFBUSxDQUFDd0IsT0FBTyxJQUFJeVEsTUFBTSxDQUFDQyxPQUFPLEVBQUU7QUFDcEMsTUFBQSxNQUFNQyxLQUFLLEdBQUdyYSxhQUFhLENBQUNzYSxRQUFRLEVBQUUsQ0FBQTtNQUN0Q0gsTUFBTSxDQUFDQyxPQUFPLENBQUNHLFNBQVMsQ0FBRSxDQUFFRixFQUFBQSxLQUFNLElBQUcsQ0FBQyxDQUFBO0FBQzFDLEtBQUE7QUFDSixHQUFBO0FBRUFHLEVBQUFBLFNBQVNBLEdBQUc7QUFDUixJQUFBLElBQUl0UyxRQUFRLENBQUN3QixPQUFPLElBQUl5USxNQUFNLENBQUNDLE9BQU8sRUFBRTtBQUNwQyxNQUFBLE1BQU1DLEtBQUssR0FBR3JhLGFBQWEsQ0FBQ3NhLFFBQVEsRUFBRSxDQUFBO01BQ3RDLElBQUlELEtBQUssQ0FBQ3hSLE1BQU0sRUFDWnNSLE1BQU0sQ0FBQ0MsT0FBTyxDQUFDRyxTQUFTLENBQUUsQ0FBQSxFQUFFRixLQUFNLENBQUcsRUFBQSxDQUFBLENBQUMsQ0FBQyxLQUV2Q0YsTUFBTSxDQUFDQyxPQUFPLENBQUNLLFdBQVcsRUFBRSxDQUFBO0FBQ3BDLEtBQUE7QUFDSixHQUFBOztBQUdBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsWUFBWUEsR0FBRztBQUNYLElBQUEsTUFBTS9ZLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQixJQUFJZ1osU0FBUyxHQUFHLE9BQU8sQ0FBQTtJQUV2QixJQUFJaFosRUFBRSxDQUFDaVosd0JBQXdCLEVBQUU7QUFDN0IsTUFBQSxNQUFNQywrQkFBK0IsR0FBR2xaLEVBQUUsQ0FBQ2laLHdCQUF3QixDQUFDalosRUFBRSxDQUFDbVosYUFBYSxFQUFFblosRUFBRSxDQUFDb1osVUFBVSxDQUFDLENBQUE7QUFDcEcsTUFBQSxNQUFNQyxpQ0FBaUMsR0FBR3JaLEVBQUUsQ0FBQ2laLHdCQUF3QixDQUFDalosRUFBRSxDQUFDbVosYUFBYSxFQUFFblosRUFBRSxDQUFDc1osWUFBWSxDQUFDLENBQUE7QUFFeEcsTUFBQSxNQUFNQyxpQ0FBaUMsR0FBR3ZaLEVBQUUsQ0FBQ2laLHdCQUF3QixDQUFDalosRUFBRSxDQUFDd1osZUFBZSxFQUFFeFosRUFBRSxDQUFDb1osVUFBVSxDQUFDLENBQUE7QUFDeEcsTUFBQSxNQUFNSyxtQ0FBbUMsR0FBR3paLEVBQUUsQ0FBQ2laLHdCQUF3QixDQUFDalosRUFBRSxDQUFDd1osZUFBZSxFQUFFeFosRUFBRSxDQUFDc1osWUFBWSxDQUFDLENBQUE7QUFFNUcsTUFBQSxJQUFJSiwrQkFBK0IsSUFBSUcsaUNBQWlDLElBQUlFLGlDQUFpQyxJQUFJRSxtQ0FBbUMsRUFBRTtBQUVsSixRQUFBLE1BQU1DLGNBQWMsR0FBR1IsK0JBQStCLENBQUNGLFNBQVMsR0FBRyxDQUFDLElBQUlPLGlDQUFpQyxDQUFDUCxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZILFFBQUEsTUFBTVcsZ0JBQWdCLEdBQUdOLGlDQUFpQyxDQUFDTCxTQUFTLEdBQUcsQ0FBQyxJQUFJUyxtQ0FBbUMsQ0FBQ1QsU0FBUyxHQUFHLENBQUMsQ0FBQTtRQUU3SCxJQUFJLENBQUNVLGNBQWMsRUFBRTtBQUNqQixVQUFBLElBQUlDLGdCQUFnQixFQUFFO0FBQ2xCWCxZQUFBQSxTQUFTLEdBQUcsU0FBUyxDQUFBO0FBQ3JCblQsWUFBQUEsS0FBSyxDQUFDK1QsSUFBSSxDQUFDLDZDQUE2QyxDQUFDLENBQUE7QUFDN0QsV0FBQyxNQUFNO0FBQ0haLFlBQUFBLFNBQVMsR0FBRyxNQUFNLENBQUE7QUFDbEJuVCxZQUFBQSxLQUFLLENBQUMrVCxJQUFJLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUN0RSxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPWixTQUFTLENBQUE7QUFDcEIsR0FBQTtBQUVBYSxFQUFBQSxZQUFZQSxHQUFHO0FBQ1gsSUFBQSxLQUFLLElBQUk1UyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc2UyxTQUFTLENBQUM1UyxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ3ZDLE1BQUEsSUFBSSxJQUFJLENBQUM4UyxtQkFBbUIsQ0FBQzlSLE9BQU8sQ0FBQzZSLFNBQVMsQ0FBQzdTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDdkQsT0FBTyxJQUFJLENBQUNqSCxFQUFFLENBQUM2WixZQUFZLENBQUNDLFNBQVMsQ0FBQzdTLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0MsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtFQUNBLElBQUkrUyxxQkFBcUJBLEdBQUc7QUFDeEI7QUFDQSxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNDLHNCQUFzQixFQUFFO01BQzlCLElBQUksSUFBSSxDQUFDNVMsUUFBUSxFQUFFO0FBQ2Y7UUFDQSxJQUFJLENBQUM0UyxzQkFBc0IsR0FBRyxJQUFJLENBQUNKLFlBQVksQ0FBQyxpQ0FBaUMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFBO0FBQ2xILE9BQUE7QUFDSixLQUFBO0lBQ0EsT0FBTyxJQUFJLENBQUNJLHNCQUFzQixDQUFBO0FBQ3RDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJM1IsRUFBQUEsb0JBQW9CQSxHQUFHO0FBQUEsSUFBQSxJQUFBNFIscUJBQUEsQ0FBQTtBQUNuQixJQUFBLE1BQU1sYSxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEIsSUFBQSxJQUFJLENBQUMrWixtQkFBbUIsR0FBQUcsQ0FBQUEscUJBQUEsR0FBR2xhLEVBQUUsQ0FBQ21hLHNCQUFzQixFQUFFLEtBQUFELElBQUFBLEdBQUFBLHFCQUFBLEdBQUksRUFBRSxDQUFBO0lBQzVELElBQUksQ0FBQ0Qsc0JBQXNCLEdBQUcsSUFBSSxDQUFBO0lBRWxDLElBQUksSUFBSSxDQUFDNVMsUUFBUSxFQUFFO01BQ2YsSUFBSSxDQUFDZ0MsY0FBYyxHQUFHLElBQUksQ0FBQTtNQUMxQixJQUFJLENBQUMrUSxjQUFjLEdBQUcsSUFBSSxDQUFBO01BQzFCLElBQUksQ0FBQ0MsV0FBVyxHQUFHcmEsRUFBRSxDQUFDcWEsV0FBVyxDQUFDQyxJQUFJLENBQUN0YSxFQUFFLENBQUMsQ0FBQTtNQUMxQyxJQUFJLENBQUN1YSxhQUFhLEdBQUcsSUFBSSxDQUFBO01BQ3pCLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsSUFBSSxDQUFBO01BQ2xDLElBQUksQ0FBQy9GLGVBQWUsR0FBRyxJQUFJLENBQUE7TUFDM0IsSUFBSSxDQUFDYyxtQkFBbUIsR0FBRyxJQUFJLENBQUE7TUFDL0IsSUFBSSxDQUFDa0YsMEJBQTBCLEdBQUcsSUFBSSxDQUFBO01BQ3RDLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTtNQUN6QixJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7TUFDMUIsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7TUFDaEMsSUFBSSxDQUFDeEYsbUJBQW1CLEdBQUcsSUFBSSxDQUFDeUUsWUFBWSxDQUFDLHdCQUF3QixDQUFDLENBQUE7TUFDdEUsSUFBSSxDQUFDZ0IsZUFBZSxHQUFHLElBQUksQ0FBQTtNQUMzQixJQUFJLENBQUNDLHdCQUF3QixHQUFHLElBQUksQ0FBQTtBQUN4QyxLQUFDLE1BQU07QUFBQSxNQUFBLElBQUFDLG9CQUFBLENBQUE7TUFDSCxJQUFJLENBQUMxUixjQUFjLEdBQUcsSUFBSSxDQUFDd1EsWUFBWSxDQUFDLGtCQUFrQixDQUFDLENBQUE7TUFDM0QsSUFBSSxDQUFDTyxjQUFjLEdBQUcsSUFBSSxDQUFDUCxZQUFZLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtNQUM3RCxJQUFJLENBQUNVLGFBQWEsR0FBRyxJQUFJLENBQUNWLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFBO0FBQ2hFLE1BQUEsSUFBSSxDQUFDUSxXQUFXLEdBQUEsQ0FBQVUsb0JBQUEsR0FBRyxJQUFJLENBQUNYLGNBQWMsS0FBQSxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQW5CVyxvQkFBQSxDQUFxQkMsZ0JBQWdCLENBQUNWLElBQUksQ0FBQyxJQUFJLENBQUNGLGNBQWMsQ0FBQyxDQUFBO01BQ2xGLElBQUksSUFBSSxDQUFDRyxhQUFhLEVBQUU7QUFDcEI7QUFDQSxRQUFBLE1BQU1VLEdBQUcsR0FBRyxJQUFJLENBQUNWLGFBQWEsQ0FBQTtRQUM5QnZhLEVBQUUsQ0FBQ2tiLG1CQUFtQixHQUFHRCxHQUFHLENBQUNFLHdCQUF3QixDQUFDYixJQUFJLENBQUNXLEdBQUcsQ0FBQyxDQUFBO1FBQy9EamIsRUFBRSxDQUFDb2IscUJBQXFCLEdBQUdILEdBQUcsQ0FBQ0ksMEJBQTBCLENBQUNmLElBQUksQ0FBQ1csR0FBRyxDQUFDLENBQUE7UUFDbkVqYixFQUFFLENBQUNzYixtQkFBbUIsR0FBR0wsR0FBRyxDQUFDTSx3QkFBd0IsQ0FBQ2pCLElBQUksQ0FBQ1csR0FBRyxDQUFDLENBQUE7QUFDbkUsT0FBQTtNQUVBLElBQUksQ0FBQ1Qsc0JBQXNCLEdBQUcsSUFBSSxDQUFDWCxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQTtNQUMzRSxJQUFJLENBQUNwRixlQUFlLEdBQUcsSUFBSSxDQUFDb0YsWUFBWSxDQUFDLG1CQUFtQixDQUFDLENBQUE7TUFDN0QsSUFBSSxDQUFDYSxhQUFhLEdBQUcsSUFBSSxDQUFDYixZQUFZLENBQUMsd0JBQXdCLENBQUMsQ0FBQTtNQUNoRSxJQUFJLENBQUNjLGNBQWMsR0FBRyxJQUFJLENBQUNkLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFBO01BQ2pFLElBQUksQ0FBQ2Usb0JBQW9CLEdBQUcsSUFBSSxDQUFDZixZQUFZLENBQUMseUJBQXlCLENBQUMsQ0FBQTtNQUN4RSxJQUFJLElBQUksQ0FBQ2Usb0JBQW9CLEVBQUU7QUFDM0I7QUFDQSxRQUFBLE1BQU1LLEdBQUcsR0FBRyxJQUFJLENBQUNMLG9CQUFvQixDQUFBO1FBQ3JDNWEsRUFBRSxDQUFDd2IsaUJBQWlCLEdBQUdQLEdBQUcsQ0FBQ1Esb0JBQW9CLENBQUNuQixJQUFJLENBQUNXLEdBQUcsQ0FBQyxDQUFBO1FBQ3pEamIsRUFBRSxDQUFDMGIsaUJBQWlCLEdBQUdULEdBQUcsQ0FBQ1Usb0JBQW9CLENBQUNyQixJQUFJLENBQUNXLEdBQUcsQ0FBQyxDQUFBO1FBQ3pEamIsRUFBRSxDQUFDNGIsYUFBYSxHQUFHWCxHQUFHLENBQUNZLGdCQUFnQixDQUFDdkIsSUFBSSxDQUFDVyxHQUFHLENBQUMsQ0FBQTtRQUNqRGpiLEVBQUUsQ0FBQzhiLGVBQWUsR0FBR2IsR0FBRyxDQUFDYyxrQkFBa0IsQ0FBQ3pCLElBQUksQ0FBQ1csR0FBRyxDQUFDLENBQUE7QUFDekQsT0FBQTtNQUNBLElBQUksQ0FBQzdGLG1CQUFtQixHQUFHLElBQUksQ0FBQTtNQUMvQixJQUFJLENBQUN5RixlQUFlLEdBQUc3YSxFQUFFLENBQUM2WixZQUFZLENBQUMscUJBQXFCLENBQUMsQ0FBQTtNQUU3RCxJQUFJLENBQUN0RSxtQkFBbUIsR0FBRyxJQUFJLENBQUNzRSxZQUFZLENBQUMsd0JBQXdCLENBQUMsQ0FBQTtNQUN0RSxJQUFJLENBQUM3RCx5QkFBeUIsR0FBRyxJQUFJLENBQUM2RCxZQUFZLENBQUMsK0JBQStCLENBQUMsQ0FBQTtBQUNuRixNQUFBLElBQUksQ0FBQ1ksMEJBQTBCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQ3pFLHlCQUF5QixDQUFBO0FBQ3RFLEtBQUE7SUFFQSxJQUFJLENBQUNnRyxvQkFBb0IsR0FBRyxJQUFJLENBQUNuQyxZQUFZLENBQUMsMkJBQTJCLENBQUMsQ0FBQTtJQUUxRSxJQUFJLENBQUMzRCxxQkFBcUIsR0FBRyxJQUFJLENBQUMyRCxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQTtBQUMxRSxJQUFBLElBQUksQ0FBQ29DLHNCQUFzQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMvRixxQkFBcUIsQ0FBQTtJQUUxRCxJQUFJLENBQUNnRyxhQUFhLEdBQUcsSUFBSSxDQUFDckMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUE7SUFDekQsSUFBSSxDQUFDc0MsMkJBQTJCLEdBQUcsSUFBSSxDQUFDdEMsWUFBWSxDQUFDLGdDQUFnQyxFQUFFLHVDQUF1QyxDQUFDLENBQUE7SUFDL0gsSUFBSSxDQUFDdUMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDdkMsWUFBWSxDQUFDLCtCQUErQixDQUFDLENBQUE7SUFDbEYsSUFBSSxDQUFDd0MsdUJBQXVCLEdBQUcsSUFBSSxDQUFDeEMsWUFBWSxDQUFDLDhCQUE4QixDQUFDLENBQUE7SUFDaEYsSUFBSSxDQUFDeUMseUJBQXlCLEdBQUcsSUFBSSxDQUFDekMsWUFBWSxDQUFDLGdDQUFnQyxFQUFFLHVDQUF1QyxDQUFDLENBQUE7SUFDN0gsSUFBSSxDQUFDMEMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDMUMsWUFBWSxDQUFDLCtCQUErQixFQUFFLHNDQUFzQyxDQUFDLENBQUE7SUFDMUgsSUFBSSxDQUFDMkMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDM0MsWUFBWSxDQUFDLDhCQUE4QixDQUFDLENBQUE7SUFDaEYsSUFBSSxDQUFDNEMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDNUMsWUFBWSxDQUFDLCtCQUErQixDQUFDLENBQUE7SUFDbEYsSUFBSSxDQUFDNkMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDN0MsWUFBWSxDQUFDLDZCQUE2QixDQUFDLENBQUE7O0FBRWhGO0lBQ0EsSUFBSSxDQUFDeEUsdUJBQXVCLEdBQUcsSUFBSSxDQUFDd0UsWUFBWSxDQUFDLDZCQUE2QixDQUFDLENBQUE7QUFDbkYsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0l0UixFQUFBQSxzQkFBc0JBLEdBQUc7SUFBQSxJQUFBb1UscUJBQUEsRUFBQUMscUJBQUEsQ0FBQTtBQUNyQixJQUFBLE1BQU01YyxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEIsSUFBQSxJQUFJaWIsR0FBRyxDQUFBO0lBRVAsTUFBTTlVLFNBQVMsR0FBRyxPQUFPRCxTQUFTLEtBQUssV0FBVyxHQUFHQSxTQUFTLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7SUFFN0UsSUFBSSxDQUFDdVAsWUFBWSxHQUFHLElBQUksQ0FBQ3NELFNBQVMsR0FBRyxJQUFJLENBQUNELFlBQVksRUFBRSxDQUFBO0FBRXhELElBQUEsTUFBTThELGNBQWMsR0FBRzdjLEVBQUUsQ0FBQzhjLG9CQUFvQixFQUFFLENBQUE7QUFDaEQsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBQUosQ0FBQUEscUJBQUEsR0FBR0UsY0FBYyxJQUFkQSxJQUFBQSxHQUFBQSxLQUFBQSxDQUFBQSxHQUFBQSxjQUFjLENBQUV2VyxTQUFTLEtBQUFxVyxJQUFBQSxHQUFBQSxxQkFBQSxHQUFJLEtBQUssQ0FBQTtBQUN0RCxJQUFBLElBQUksQ0FBQy9GLGVBQWUsR0FBQWdHLENBQUFBLHFCQUFBLEdBQUdDLGNBQWMsSUFBZEEsSUFBQUEsR0FBQUEsS0FBQUEsQ0FBQUEsR0FBQUEsY0FBYyxDQUFFaEcsT0FBTyxLQUFBK0YsSUFBQUEsR0FBQUEscUJBQUEsR0FBSSxLQUFLLENBQUE7QUFFdkQsSUFBQSxJQUFJLENBQUNJLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUN6QyxhQUFhLENBQUE7O0FBRTlDO0lBQ0EsSUFBSSxDQUFDMEMsY0FBYyxHQUFHamQsRUFBRSxDQUFDbVgsWUFBWSxDQUFDblgsRUFBRSxDQUFDa2QsZ0JBQWdCLENBQUMsQ0FBQTtJQUMxRCxJQUFJLENBQUNDLGNBQWMsR0FBR25kLEVBQUUsQ0FBQ21YLFlBQVksQ0FBQ25YLEVBQUUsQ0FBQ29kLHlCQUF5QixDQUFDLENBQUE7SUFDbkUsSUFBSSxDQUFDQyxtQkFBbUIsR0FBR3JkLEVBQUUsQ0FBQ21YLFlBQVksQ0FBQ25YLEVBQUUsQ0FBQ3NkLHFCQUFxQixDQUFDLENBQUE7SUFDcEUsSUFBSSxDQUFDQyxXQUFXLEdBQUd2ZCxFQUFFLENBQUNtWCxZQUFZLENBQUNuWCxFQUFFLENBQUN3ZCx1QkFBdUIsQ0FBQyxDQUFBO0lBQzlELElBQUksQ0FBQ0MsbUJBQW1CLEdBQUd6ZCxFQUFFLENBQUNtWCxZQUFZLENBQUNuWCxFQUFFLENBQUMwZCxnQ0FBZ0MsQ0FBQyxDQUFBO0lBQy9FLElBQUksQ0FBQ2hKLGlCQUFpQixHQUFHMVUsRUFBRSxDQUFDbVgsWUFBWSxDQUFDblgsRUFBRSxDQUFDMmQsOEJBQThCLENBQUMsQ0FBQTtJQUMzRSxJQUFJLENBQUMvSSxtQkFBbUIsR0FBRzVVLEVBQUUsQ0FBQ21YLFlBQVksQ0FBQ25YLEVBQUUsQ0FBQzRkLDBCQUEwQixDQUFDLENBQUE7SUFDekUsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRzdkLEVBQUUsQ0FBQ21YLFlBQVksQ0FBQ25YLEVBQUUsQ0FBQzhkLDRCQUE0QixDQUFDLENBQUE7SUFDN0UsSUFBSSxJQUFJLENBQUN6VyxRQUFRLEVBQUU7TUFDZixJQUFJLENBQUMwVyxjQUFjLEdBQUcvZCxFQUFFLENBQUNtWCxZQUFZLENBQUNuWCxFQUFFLENBQUNnZSxnQkFBZ0IsQ0FBQyxDQUFBO01BQzFELElBQUksQ0FBQ0MsbUJBQW1CLEdBQUdqZSxFQUFFLENBQUNtWCxZQUFZLENBQUNuWCxFQUFFLENBQUNrZSxxQkFBcUIsQ0FBQyxDQUFBO01BQ3BFLElBQUksQ0FBQ0MsYUFBYSxHQUFHbmUsRUFBRSxDQUFDbVgsWUFBWSxDQUFDblgsRUFBRSxDQUFDb2UsbUJBQW1CLENBQUMsQ0FBQTtNQUM1RCxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUE7TUFDdkIsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxJQUFJLENBQUE7QUFDdEMsS0FBQyxNQUFNO01BQ0hyRCxHQUFHLEdBQUcsSUFBSSxDQUFDYixjQUFjLENBQUE7QUFDekIsTUFBQSxJQUFJLENBQUNpRSxXQUFXLEdBQUcsQ0FBQyxDQUFDcEQsR0FBRyxDQUFBO0FBQ3hCLE1BQUEsSUFBSSxDQUFDOEMsY0FBYyxHQUFHOUMsR0FBRyxHQUFHamIsRUFBRSxDQUFDbVgsWUFBWSxDQUFDOEQsR0FBRyxDQUFDc0Qsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDM0UsTUFBQSxJQUFJLENBQUNOLG1CQUFtQixHQUFHaEQsR0FBRyxHQUFHamIsRUFBRSxDQUFDbVgsWUFBWSxDQUFDOEQsR0FBRyxDQUFDdUQsMkJBQTJCLENBQUMsR0FBRyxDQUFDLENBQUE7TUFDckYsSUFBSSxDQUFDTCxhQUFhLEdBQUcsQ0FBQyxDQUFBO0FBQzFCLEtBQUE7SUFFQWxELEdBQUcsR0FBRyxJQUFJLENBQUNlLG9CQUFvQixDQUFBO0FBQy9CLElBQUEsSUFBSSxDQUFDL0csZ0JBQWdCLEdBQUdnRyxHQUFHLEdBQUdqYixFQUFFLENBQUNtWCxZQUFZLENBQUM4RCxHQUFHLENBQUN3RCx1QkFBdUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUMvRSxJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHekQsR0FBRyxHQUFHamIsRUFBRSxDQUFDbVgsWUFBWSxDQUFDOEQsR0FBRyxDQUFDMEQscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUE7O0FBRTNFO0FBQ0E7SUFDQSxNQUFNQyxpQkFBaUIsR0FBRyxhQUFhLENBQUE7O0FBRXZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNBLE1BQU1DLGlCQUFpQixHQUFHLGlCQUFpQixDQUFBO0lBQzNDLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsRUFBRSxJQUFJLENBQUNKLGNBQWMsS0FBSyxLQUFLLElBQUl2WSxTQUFTLENBQUNNLEtBQUssQ0FBQ29ZLGlCQUFpQixDQUFDLENBQUMsSUFDOUYsQ0FBRSxJQUFJLENBQUM1SixnQkFBZ0IsQ0FBQ3hPLEtBQUssQ0FBQ21ZLGlCQUFpQixDQUFFLENBQUE7SUFFckQzRCxHQUFHLEdBQUcsSUFBSSxDQUFDa0IsMkJBQTJCLENBQUE7QUFDdEMsSUFBQSxJQUFJLENBQUM0QyxhQUFhLEdBQUc5RCxHQUFHLEdBQUdqYixFQUFFLENBQUNtWCxZQUFZLENBQUM4RCxHQUFHLENBQUMrRCw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUVsRixNQUFNQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM1WCxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUNqQix5QkFBeUIsQ0FBQTtBQUMzRSxJQUFBLElBQUksQ0FBQzhZLFVBQVUsR0FBR0Qsa0JBQWtCLEdBQUdqZixFQUFFLENBQUNtWCxZQUFZLENBQUNuWCxFQUFFLENBQUNtZixXQUFXLENBQUMsR0FBRyxDQUFDLENBQUE7O0FBRTFFO0FBQ0EsSUFBQSxJQUFJLENBQUNELFVBQVUsR0FBR3BLLElBQUksQ0FBQ0UsR0FBRyxDQUFDLElBQUksQ0FBQ2tLLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQTs7QUFFOUM7QUFDQSxJQUFBLElBQUksQ0FBQ2xJLE9BQU8sR0FBR2lJLGtCQUFrQixJQUFJLElBQUksQ0FBQ3BZLG1CQUFtQixHQUFHLElBQUksQ0FBQ3FZLFVBQVUsR0FBRyxDQUFDLENBQUE7O0FBRW5GO0lBQ0EsSUFBSSxDQUFDRSxrQkFBa0IsR0FBRyxJQUFJLENBQUMvWCxRQUFRLElBQUksQ0FBQ2QsUUFBUSxDQUFDOFksT0FBTyxDQUFBOztBQUU1RDtBQUNBLElBQUEsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUNqWSxRQUFRLENBQUE7O0FBRXpDO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQ2tXLFdBQVcsSUFBSSxDQUFDLEVBQUU7TUFDdkIsSUFBSSxDQUFDNkIsa0JBQWtCLEdBQUcsS0FBSyxDQUFBO0FBQ25DLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTVXLEVBQUFBLHFCQUFxQkEsR0FBRztJQUNwQixLQUFLLENBQUNBLHFCQUFxQixFQUFFLENBQUE7QUFFN0IsSUFBQSxNQUFNeEksRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztBQUVsQjs7QUFFQTtBQUNBQSxJQUFBQSxFQUFFLENBQUN1ZixPQUFPLENBQUN2ZixFQUFFLENBQUN3ZixLQUFLLENBQUMsQ0FBQTtJQUNwQnhmLEVBQUUsQ0FBQ3lmLFNBQVMsQ0FBQ3pmLEVBQUUsQ0FBQzJKLEdBQUcsRUFBRTNKLEVBQUUsQ0FBQzBKLElBQUksQ0FBQyxDQUFBO0FBQzdCMUosSUFBQUEsRUFBRSxDQUFDMGYsYUFBYSxDQUFDMWYsRUFBRSxDQUFDaUosUUFBUSxDQUFDLENBQUE7SUFDN0JqSixFQUFFLENBQUMyZixTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFFcEMzZixFQUFFLENBQUM0ZixVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFFekI1ZixJQUFBQSxFQUFFLENBQUM2ZixNQUFNLENBQUM3ZixFQUFFLENBQUM4ZixTQUFTLENBQUMsQ0FBQTtBQUN2QjlmLElBQUFBLEVBQUUsQ0FBQytmLFFBQVEsQ0FBQy9mLEVBQUUsQ0FBQ2dNLElBQUksQ0FBQyxDQUFBOztBQUVwQjtBQUNBaE0sSUFBQUEsRUFBRSxDQUFDNmYsTUFBTSxDQUFDN2YsRUFBRSxDQUFDZ2dCLFVBQVUsQ0FBQyxDQUFBO0FBQ3hCaGdCLElBQUFBLEVBQUUsQ0FBQ2lnQixTQUFTLENBQUNqZ0IsRUFBRSxDQUFDOEssTUFBTSxDQUFDLENBQUE7QUFDdkI5SyxJQUFBQSxFQUFFLENBQUNrZ0IsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBRWxCLElBQUksQ0FBQ3JKLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDcEI3VyxJQUFBQSxFQUFFLENBQUN1ZixPQUFPLENBQUN2ZixFQUFFLENBQUNtZ0IsWUFBWSxDQUFDLENBQUE7QUFFM0IsSUFBQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHQyxXQUFXLENBQUE7QUFDMUQsSUFBQSxJQUFJLENBQUNDLGVBQWUsR0FBRyxJQUFJLENBQUNDLGNBQWMsR0FBRyxDQUFDLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUksQ0FBQTtJQUNuRDFnQixFQUFFLENBQUMyZ0IsV0FBVyxDQUFDM2dCLEVBQUUsQ0FBQ2tMLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFFbEMsSUFBQSxJQUFJLENBQUMwVixnQkFBZ0IsR0FBRyxJQUFJLENBQUNDLGVBQWUsR0FBR0MsY0FBYyxDQUFBO0FBQzdELElBQUEsSUFBSSxDQUFDQyxpQkFBaUIsR0FBRyxJQUFJLENBQUNDLGdCQUFnQixHQUFHRixjQUFjLENBQUE7QUFDL0QsSUFBQSxJQUFJLENBQUNHLGlCQUFpQixHQUFHLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUdKLGNBQWMsQ0FBQTtJQUMvRCxJQUFJLENBQUNLLHFCQUFxQixHQUFHLElBQUksQ0FBQTtJQUNqQyxJQUFJLENBQUNDLG9CQUFvQixHQUFHLElBQUksQ0FBQTtBQUNoQ3BoQixJQUFBQSxFQUFFLENBQUNxaEIsU0FBUyxDQUFDcmhCLEVBQUUsQ0FBQ29MLElBQUksRUFBRXBMLEVBQUUsQ0FBQ29MLElBQUksRUFBRXBMLEVBQUUsQ0FBQ29MLElBQUksQ0FBQyxDQUFBO0FBQ3ZDcEwsSUFBQUEsRUFBRSxDQUFDc2hCLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUVwQixJQUFJLENBQUNDLGVBQWUsR0FBRyxLQUFLLENBQUE7SUFDNUIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksSUFBSSxDQUFDbmEsUUFBUSxFQUFFO0FBQ2ZySCxNQUFBQSxFQUFFLENBQUN1ZixPQUFPLENBQUN2ZixFQUFFLENBQUN5aEIsd0JBQXdCLENBQUMsQ0FBQTtBQUN2Q3poQixNQUFBQSxFQUFFLENBQUN1ZixPQUFPLENBQUN2ZixFQUFFLENBQUMwaEIsa0JBQWtCLENBQUMsQ0FBQTtBQUNyQyxLQUFBO0lBRUEsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7QUFDN0IzaEIsSUFBQUEsRUFBRSxDQUFDdWYsT0FBTyxDQUFDdmYsRUFBRSxDQUFDNGhCLG1CQUFtQixDQUFDLENBQUE7SUFFbEMsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0FBQ25CN2hCLElBQUFBLEVBQUUsQ0FBQzZoQixVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFaEIsSUFBQSxJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDdkMvaEIsRUFBRSxDQUFDOGhCLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUV6QixJQUFJLENBQUNFLFlBQVksR0FBRyxDQUFDLENBQUE7QUFDckJoaUIsSUFBQUEsRUFBRSxDQUFDZ2lCLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUVsQixJQUFJLElBQUksQ0FBQzNhLFFBQVEsRUFBRTtNQUNmckgsRUFBRSxDQUFDaWlCLElBQUksQ0FBQ2ppQixFQUFFLENBQUNraUIsK0JBQStCLEVBQUVsaUIsRUFBRSxDQUFDbWlCLE1BQU0sQ0FBQyxDQUFBO0FBQzFELEtBQUMsTUFBTTtNQUNILElBQUksSUFBSSxDQUFDM0gsc0JBQXNCLEVBQUU7QUFDN0J4YSxRQUFBQSxFQUFFLENBQUNpaUIsSUFBSSxDQUFDLElBQUksQ0FBQ3pILHNCQUFzQixDQUFDNEgsbUNBQW1DLEVBQUVwaUIsRUFBRSxDQUFDbWlCLE1BQU0sQ0FBQyxDQUFBO0FBQ3ZGLE9BQUE7QUFDSixLQUFBO0FBRUFuaUIsSUFBQUEsRUFBRSxDQUFDNmYsTUFBTSxDQUFDN2YsRUFBRSxDQUFDcWlCLFlBQVksQ0FBQyxDQUFBO0lBRTFCcmlCLEVBQUUsQ0FBQ3NpQixXQUFXLENBQUN0aUIsRUFBRSxDQUFDdWlCLGtDQUFrQyxFQUFFdmlCLEVBQUUsQ0FBQ3dpQixJQUFJLENBQUMsQ0FBQTtJQUU5RCxJQUFJLENBQUNDLFdBQVcsR0FBRyxLQUFLLENBQUE7SUFDeEJ6aUIsRUFBRSxDQUFDc2lCLFdBQVcsQ0FBQ3RpQixFQUFFLENBQUMwaUIsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFFN0MsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxLQUFLLENBQUE7SUFDbkMzaUIsRUFBRSxDQUFDc2lCLFdBQVcsQ0FBQ3RpQixFQUFFLENBQUM0aUIsOEJBQThCLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFFeEQ1aUIsRUFBRSxDQUFDc2lCLFdBQVcsQ0FBQ3RpQixFQUFFLENBQUM2aUIsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDMUMsR0FBQTtBQUVBdGQsRUFBQUEsZ0JBQWdCQSxDQUFDNUYsS0FBSyxHQUFHLEVBQUUsRUFBRTtJQUN6QixJQUFJLENBQUNtakIsWUFBWSxHQUFHLEVBQUUsQ0FBQTtJQUN0QixLQUFLLElBQUk3YixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd0SCxLQUFLLEVBQUVzSCxDQUFDLEVBQUUsRUFBRTtBQUM1QixNQUFBLElBQUksQ0FBQzZiLFlBQVksQ0FBQ0MsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQzlDLEtBQUE7QUFDSixHQUFBO0FBRUF0YSxFQUFBQSx1QkFBdUJBLEdBQUc7SUFDdEIsS0FBSyxDQUFDQSx1QkFBdUIsRUFBRSxDQUFBOztBQUUvQjtBQUNBLElBQUEsSUFBSSxDQUFDdWEsT0FBTyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0lBRXhCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNsZixpQkFBaUIsR0FBRyxJQUFJLENBQUE7SUFDN0IsSUFBSSxDQUFDc1MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUM2TSx1QkFBdUIsR0FBRyxJQUFJLENBQUE7SUFFbkMsSUFBSSxDQUFDQyxXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDN2QsZ0JBQWdCLENBQUMsSUFBSSxDQUFDa1ksbUJBQW1CLENBQUMsQ0FBQTtBQUNuRCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTdYLEVBQUFBLFdBQVdBLEdBQUc7QUFBQSxJQUFBLElBQUF5ZCxpQkFBQSxDQUFBO0FBRVY7SUFDQSxJQUFJLENBQUM1TCxjQUFjLENBQUNDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBOztBQUUvQjtBQUNBLElBQUEsS0FBSyxNQUFNdFosTUFBTSxJQUFJLElBQUksQ0FBQ2tsQixPQUFPLEVBQUU7TUFDL0JsbEIsTUFBTSxDQUFDd0gsV0FBVyxFQUFFLENBQUE7QUFDeEIsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxNQUFNekYsT0FBTyxJQUFJLElBQUksQ0FBQ29qQixRQUFRLEVBQUU7TUFDakNwakIsT0FBTyxDQUFDeUYsV0FBVyxFQUFFLENBQUE7QUFDekIsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxNQUFNNGQsTUFBTSxJQUFJLElBQUksQ0FBQ0MsT0FBTyxFQUFFO01BQy9CRCxNQUFNLENBQUM1ZCxXQUFXLEVBQUUsQ0FBQTtBQUN4QixLQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUEsS0FBSyxNQUFNekgsTUFBTSxJQUFJLElBQUksQ0FBQ3VsQixPQUFPLEVBQUU7TUFDL0J2bEIsTUFBTSxDQUFDeUgsV0FBVyxFQUFFLENBQUE7QUFDeEIsS0FBQTtJQUVBLENBQUF5ZCxpQkFBQSxPQUFJLENBQUNqTixXQUFXLGFBQWhCaU4saUJBQUEsQ0FBa0J6ZCxXQUFXLEVBQUUsQ0FBQTtBQUNuQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUksRUFBQUEsY0FBY0EsR0FBRztBQUFBLElBQUEsSUFBQTJkLGtCQUFBLENBQUE7SUFDYixJQUFJLENBQUNyYixvQkFBb0IsRUFBRSxDQUFBO0lBQzNCLElBQUksQ0FBQ0Msc0JBQXNCLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLHFCQUFxQixFQUFFLENBQUE7SUFDNUIsSUFBSSxDQUFDQyx1QkFBdUIsRUFBRSxDQUFBOztBQUU5QjtBQUNBLElBQUEsS0FBSyxNQUFNckssTUFBTSxJQUFJLElBQUksQ0FBQ2tsQixPQUFPLEVBQUU7TUFDL0JsbEIsTUFBTSxDQUFDNEgsY0FBYyxFQUFFLENBQUE7QUFDM0IsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxNQUFNd2QsTUFBTSxJQUFJLElBQUksQ0FBQ0MsT0FBTyxFQUFFO01BQy9CRCxNQUFNLENBQUNJLE1BQU0sRUFBRSxDQUFBO0FBQ25CLEtBQUE7SUFFQSxDQUFBRCxrQkFBQSxPQUFJLENBQUN2TixXQUFXLGFBQWhCdU4sa0JBQUEsQ0FBa0IzZCxjQUFjLEVBQUUsQ0FBQTtBQUN0QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTZkLEVBQUFBLGNBQWNBLEdBQUc7QUFDYjNMLElBQUFBLFdBQVcsQ0FBQzJMLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ3ZmLENBQUMsRUFBRUMsQ0FBQyxFQUFFRSxDQUFDLEVBQUVxZixDQUFDLEVBQUU7SUFDcEIsSUFBSyxJQUFJLENBQUNDLEVBQUUsS0FBS3pmLENBQUMsSUFBTSxJQUFJLENBQUMwZixFQUFFLEtBQUt6ZixDQUFFLElBQUssSUFBSSxDQUFDMGYsRUFBRSxLQUFLeGYsQ0FBRSxJQUFLLElBQUksQ0FBQ3lmLEVBQUUsS0FBS0osQ0FBRSxFQUFFO0FBQzFFLE1BQUEsSUFBSSxDQUFDL2pCLEVBQUUsQ0FBQ29rQixRQUFRLENBQUM3ZixDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxDQUFDLENBQUE7TUFDNUIsSUFBSSxDQUFDQyxFQUFFLEdBQUd6ZixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUMwZixFQUFFLEdBQUd6ZixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUMwZixFQUFFLEdBQUd4ZixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUN5ZixFQUFFLEdBQUdKLENBQUMsQ0FBQTtBQUNmLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSU0sVUFBVUEsQ0FBQzlmLENBQUMsRUFBRUMsQ0FBQyxFQUFFRSxDQUFDLEVBQUVxZixDQUFDLEVBQUU7SUFDbkIsSUFBSyxJQUFJLENBQUNPLEVBQUUsS0FBSy9mLENBQUMsSUFBTSxJQUFJLENBQUNnZ0IsRUFBRSxLQUFLL2YsQ0FBRSxJQUFLLElBQUksQ0FBQ2dnQixFQUFFLEtBQUs5ZixDQUFFLElBQUssSUFBSSxDQUFDK2YsRUFBRSxLQUFLVixDQUFFLEVBQUU7QUFDMUUsTUFBQSxJQUFJLENBQUMvakIsRUFBRSxDQUFDMGtCLE9BQU8sQ0FBQ25nQixDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxDQUFDLENBQUE7TUFDM0IsSUFBSSxDQUFDTyxFQUFFLEdBQUcvZixDQUFDLENBQUE7TUFDWCxJQUFJLENBQUNnZ0IsRUFBRSxHQUFHL2YsQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDZ2dCLEVBQUUsR0FBRzlmLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQytmLEVBQUUsR0FBR1YsQ0FBQyxDQUFBO0FBQ2YsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0k5ZixjQUFjQSxDQUFDMGdCLEVBQUUsRUFBRTtBQUNmLElBQUEsSUFBSSxJQUFJLENBQUMzZ0IsaUJBQWlCLEtBQUsyZ0IsRUFBRSxFQUFFO0FBQy9CLE1BQUEsTUFBTTNrQixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7TUFDbEJBLEVBQUUsQ0FBQ2tCLGVBQWUsQ0FBQ2xCLEVBQUUsQ0FBQ21CLFdBQVcsRUFBRXdqQixFQUFFLENBQUMsQ0FBQTtNQUN0QyxJQUFJLENBQUMzZ0IsaUJBQWlCLEdBQUcyZ0IsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxnQkFBZ0JBLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxLQUFLLEVBQUV0aEIsS0FBSyxFQUFFO0FBQ3pDLElBQUEsTUFBTXpELEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTs7QUFFbEI7QUFDQSxJQUFBLElBQUk2a0IsTUFBTSxLQUFLLElBQUksQ0FBQy9OLFVBQVUsRUFBRTtBQUM1QitOLE1BQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDakIsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3hkLFFBQVEsSUFBSTVELEtBQUssRUFBRTtBQUN6Qm9DLE1BQUFBLEtBQUssQ0FBQ21mLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFBO0FBQ2pELE1BQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsS0FBQTtBQUNBLElBQUEsSUFBSUQsS0FBSyxFQUFFO01BQ1AsSUFBSSxDQUFDRCxJQUFJLEVBQUU7QUFDUDtBQUNBLFFBQUEsSUFBSSxDQUFDRCxNQUFNLENBQUNJLFlBQVksRUFBRTtBQUN0QnBmLFVBQUFBLEtBQUssQ0FBQ21mLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFBO0FBQzFELFVBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsU0FBQTtPQUNILE1BQU0sSUFBSUgsTUFBTSxFQUFFO0FBQ2Y7UUFDQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0ksWUFBWSxJQUFJLENBQUNILElBQUksQ0FBQ0csWUFBWSxFQUFFO0FBQzVDcGYsVUFBQUEsS0FBSyxDQUFDbWYsS0FBSyxDQUFDLDRFQUE0RSxDQUFDLENBQUE7QUFDekYsVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixTQUFBO1FBQ0EsSUFBSUgsTUFBTSxDQUFDSSxZQUFZLENBQUNDLE9BQU8sS0FBS0osSUFBSSxDQUFDRyxZQUFZLENBQUNDLE9BQU8sRUFBRTtBQUMzRHJmLFVBQUFBLEtBQUssQ0FBQ21mLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFBO0FBQ25FLFVBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0lBQ0EsSUFBSXZoQixLQUFLLElBQUlvaEIsTUFBTSxFQUFFO0FBQ2pCLE1BQUEsSUFBSSxDQUFDQSxNQUFNLENBQUNNLE1BQU0sRUFBRTtBQUFJO1FBQ3BCLElBQUksQ0FBQ04sTUFBTSxDQUFDTyxZQUFZLElBQUksQ0FBQ04sSUFBSSxDQUFDTSxZQUFZLEVBQUU7QUFDNUN2ZixVQUFBQSxLQUFLLENBQUNtZixLQUFLLENBQUMsNEVBQTRFLENBQUMsQ0FBQTtBQUN6RixVQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLFNBQUE7UUFDQSxJQUFJSCxNQUFNLENBQUNPLFlBQVksQ0FBQ0YsT0FBTyxLQUFLSixJQUFJLENBQUNNLFlBQVksQ0FBQ0YsT0FBTyxFQUFFO0FBQzNEcmYsVUFBQUEsS0FBSyxDQUFDbWYsS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUE7QUFDbkUsVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFFQTNtQixJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUE7QUFFNUMsSUFBQSxJQUFJLElBQUksQ0FBQytJLFFBQVEsSUFBSXlkLElBQUksRUFBRTtBQUFBLE1BQUEsSUFBQU8sZ0JBQUEsQ0FBQTtBQUN2QixNQUFBLE1BQU1DLE1BQU0sR0FBRyxJQUFJLENBQUM5bUIsWUFBWSxDQUFBO01BQ2hDLElBQUksQ0FBQ0EsWUFBWSxHQUFHc21CLElBQUksQ0FBQTtNQUN4QixJQUFJLENBQUNwbUIsV0FBVyxFQUFFLENBQUE7O0FBRWxCO01BQ0EsTUFBTTZtQixHQUFHLEdBQUdWLE1BQU0sR0FBR0EsTUFBTSxDQUFDM2dCLElBQUksQ0FBQ0MsY0FBYyxHQUFBLENBQUFraEIsZ0JBQUEsR0FBRyxJQUFJLENBQUN2TyxVQUFVLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFmdU8sZ0JBQUEsQ0FBaUJuaEIsSUFBSSxDQUFDQyxjQUFjLENBQUE7QUFFdEYsTUFBQSxNQUFNcWhCLEdBQUcsR0FBR1YsSUFBSSxDQUFDNWdCLElBQUksQ0FBQ0MsY0FBYyxDQUFBO01BQ3BDMEIsS0FBSyxDQUFDNGYsTUFBTSxDQUFDRixHQUFHLEtBQUtDLEdBQUcsRUFBRSxzRUFBc0UsQ0FBQyxDQUFBO01BRWpHeGxCLEVBQUUsQ0FBQ2tCLGVBQWUsQ0FBQ2xCLEVBQUUsQ0FBQzBsQixnQkFBZ0IsRUFBRUgsR0FBRyxDQUFDLENBQUE7TUFDNUN2bEIsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDMmxCLGdCQUFnQixFQUFFSCxHQUFHLENBQUMsQ0FBQTtNQUM1QyxNQUFNOWdCLENBQUMsR0FBR21nQixNQUFNLEdBQUdBLE1BQU0sQ0FBQy9oQixLQUFLLEdBQUdnaUIsSUFBSSxDQUFDaGlCLEtBQUssQ0FBQTtNQUM1QyxNQUFNaWhCLENBQUMsR0FBR2MsTUFBTSxHQUFHQSxNQUFNLENBQUM5aEIsTUFBTSxHQUFHK2hCLElBQUksQ0FBQy9oQixNQUFNLENBQUE7QUFFOUMvQyxNQUFBQSxFQUFFLENBQUM0bEIsZUFBZSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUVsaEIsQ0FBQyxFQUFFcWYsQ0FBQyxFQUNWLENBQUMsRUFBRSxDQUFDLEVBQUVyZixDQUFDLEVBQUVxZixDQUFDLEVBQ1YsQ0FBQ2dCLEtBQUssR0FBRy9rQixFQUFFLENBQUM0TCxnQkFBZ0IsR0FBRyxDQUFDLEtBQUtuSSxLQUFLLEdBQUd6RCxFQUFFLENBQUM2TCxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsRUFDckU3TCxFQUFFLENBQUNTLE9BQU8sQ0FBQyxDQUFBOztBQUU5QjtNQUNBLElBQUksQ0FBQ2pDLFlBQVksR0FBRzhtQixNQUFNLENBQUE7QUFDMUJ0bEIsTUFBQUEsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFbWtCLE1BQU0sR0FBR0EsTUFBTSxDQUFDcGhCLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFBO0FBQ2xGLEtBQUMsTUFBTTtBQUNILE1BQUEsTUFBTS9GLE1BQU0sR0FBRyxJQUFJLENBQUN5bkIsYUFBYSxFQUFFLENBQUE7TUFDbkMsSUFBSSxDQUFDaGlCLGlCQUFpQixDQUFDQyxRQUFRLENBQUMrZ0IsTUFBTSxDQUFDSSxZQUFZLENBQUMsQ0FBQTtBQUNwRGhuQixNQUFBQSxjQUFjLENBQUMsSUFBSSxFQUFFNm1CLElBQUksRUFBRTFtQixNQUFNLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBRUFDLElBQUFBLGFBQWEsQ0FBQ3lCLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUVoQyxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJK2xCLEVBQUFBLGFBQWFBLEdBQUc7QUFDWixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNDLFdBQVcsRUFBRTtBQUNuQixNQUFBLElBQUksQ0FBQ0EsV0FBVyxHQUFHLElBQUkxakIsTUFBTSxDQUFDLElBQUksRUFBRUMsV0FBVyxDQUFDQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDbkVDLFFBQUFBLElBQUksRUFBRSxhQUFhO0FBQ25CQyxRQUFBQSxVQUFVLEVBQUUzRSxpQkFBaUI7QUFDN0I0RSxRQUFBQSxZQUFZLEVBQUV6RSxnQkFBQUE7QUFDbEIsT0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNQLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQzhuQixXQUFXLENBQUE7QUFDM0IsR0FBQTtBQUVBQyxFQUFBQSxVQUFVQSxHQUFHO0lBQ1QsS0FBSyxDQUFDQSxVQUFVLEVBQUUsQ0FBQTtJQUVsQixJQUFJLENBQUN4TyxnQkFBZ0IsRUFBRSxDQUFBO0FBRXZCLElBQUEsSUFBSSxDQUFDbkIsV0FBVyxDQUFDMlAsVUFBVSxFQUFFLENBQUE7QUFDakMsR0FBQTtBQUVBQyxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsS0FBSyxDQUFDQSxRQUFRLEVBQUUsQ0FBQTtBQUNoQixJQUFBLElBQUksQ0FBQzVQLFdBQVcsQ0FBQzRQLFFBQVEsRUFBRSxDQUFBO0FBQzNCLElBQUEsSUFBSSxDQUFDNVAsV0FBVyxDQUFDNlAsT0FBTyxFQUFFLENBQUE7QUFDOUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsZUFBZUEsQ0FBQ0MsVUFBVSxFQUFFO0FBQUEsSUFBQSxJQUFBQyxxQkFBQSxDQUFBO0FBRXhCL25CLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDLElBQUksRUFBRyxZQUFXLENBQUMsQ0FBQTs7QUFFL0M7QUFDQSxJQUFBLE1BQU0rbkIsRUFBRSxHQUFBLENBQUFELHFCQUFBLEdBQUdELFVBQVUsQ0FBQzNuQixZQUFZLEtBQUEsSUFBQSxHQUFBNG5CLHFCQUFBLEdBQUksSUFBSSxDQUFDdFAsVUFBVSxDQUFBO0lBQ3JELElBQUksQ0FBQ3RZLFlBQVksR0FBRzZuQixFQUFFLENBQUE7QUFDdEJ4Z0IsSUFBQUEsS0FBSyxDQUFDNGYsTUFBTSxDQUFDWSxFQUFFLENBQUMsQ0FBQTtJQUVoQixJQUFJLENBQUMzbkIsV0FBVyxFQUFFLENBQUE7O0FBRWxCO0lBQ0EsTUFBTTtNQUFFb0UsS0FBSztBQUFFQyxNQUFBQSxNQUFBQTtBQUFPLEtBQUMsR0FBR3NqQixFQUFFLENBQUE7SUFDNUIsSUFBSSxDQUFDdkMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUVoaEIsS0FBSyxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUNyQyxJQUFJLENBQUNzaEIsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUV2aEIsS0FBSyxFQUFFQyxNQUFNLENBQUMsQ0FBQTs7QUFFcEM7QUFDQSxJQUFBLE1BQU11akIsUUFBUSxHQUFHSCxVQUFVLENBQUNHLFFBQVEsQ0FBQTtBQUNwQyxJQUFBLE1BQU1DLGVBQWUsR0FBR0osVUFBVSxDQUFDSSxlQUFlLENBQUE7QUFDbEQsSUFBQSxJQUFJRCxRQUFRLElBQUEsSUFBQSxJQUFSQSxRQUFRLENBQUVFLEtBQUssSUFBSUQsZUFBZSxDQUFDMUUsVUFBVSxJQUFJMEUsZUFBZSxDQUFDdkUsWUFBWSxFQUFFO01BRS9FLElBQUl5RSxVQUFVLEdBQUcsQ0FBQyxDQUFBO01BQ2xCLE1BQU1DLFlBQVksR0FBRyxFQUFFLENBQUE7QUFFdkIsTUFBQSxJQUFJSixRQUFRLElBQUEsSUFBQSxJQUFSQSxRQUFRLENBQUVFLEtBQUssRUFBRTtBQUNqQkMsUUFBQUEsVUFBVSxJQUFJRSxlQUFlLENBQUE7UUFDN0JELFlBQVksQ0FBQzNCLEtBQUssR0FBRyxDQUFDdUIsUUFBUSxDQUFDTSxVQUFVLENBQUNDLENBQUMsRUFBRVAsUUFBUSxDQUFDTSxVQUFVLENBQUNFLENBQUMsRUFBRVIsUUFBUSxDQUFDTSxVQUFVLENBQUNHLENBQUMsRUFBRVQsUUFBUSxDQUFDTSxVQUFVLENBQUNJLENBQUMsQ0FBQyxDQUFBO0FBQ3JILE9BQUE7TUFFQSxJQUFJVCxlQUFlLENBQUMxRSxVQUFVLEVBQUU7QUFDNUI0RSxRQUFBQSxVQUFVLElBQUlRLGVBQWUsQ0FBQTtBQUM3QlAsUUFBQUEsWUFBWSxDQUFDampCLEtBQUssR0FBRzhpQixlQUFlLENBQUNXLGVBQWUsQ0FBQTtBQUN4RCxPQUFBO01BRUEsSUFBSVgsZUFBZSxDQUFDdkUsWUFBWSxFQUFFO0FBQzlCeUUsUUFBQUEsVUFBVSxJQUFJVSxpQkFBaUIsQ0FBQTtBQUMvQlQsUUFBQUEsWUFBWSxDQUFDN1AsT0FBTyxHQUFHMFAsZUFBZSxDQUFDYSxpQkFBaUIsQ0FBQTtBQUM1RCxPQUFBOztBQUVBO01BQ0FWLFlBQVksQ0FBQ1csS0FBSyxHQUFHWixVQUFVLENBQUE7QUFDL0IsTUFBQSxJQUFJLENBQUNELEtBQUssQ0FBQ0UsWUFBWSxDQUFDLENBQUE7QUFDNUIsS0FBQTtJQUVBN2dCLEtBQUssQ0FBQ3loQixJQUFJLENBQUMsTUFBTTtNQUNiLElBQUksSUFBSSxDQUFDQyxnQkFBZ0IsRUFBRTtBQUN2QjFoQixRQUFBQSxLQUFLLENBQUMyaEIsU0FBUyxDQUFDLGdFQUFnRSxDQUFDLENBQUE7QUFDckYsT0FBQTtBQUNKLEtBQUMsQ0FBQyxDQUFBO0lBQ0YsSUFBSSxDQUFDRCxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFFNUJscEIsSUFBQUEsYUFBYSxDQUFDeUIsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0kybkIsYUFBYUEsQ0FBQ3RCLFVBQVUsRUFBRTtBQUV0QjluQixJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUcsVUFBUyxDQUFDLENBQUE7SUFFN0MsSUFBSSxDQUFDb3BCLGlCQUFpQixFQUFFLENBQUE7QUFFeEIsSUFBQSxNQUFNdnBCLE1BQU0sR0FBRyxJQUFJLENBQUNLLFlBQVksQ0FBQTtBQUNoQyxJQUFBLE1BQU1tcEIsZ0JBQWdCLEdBQUd4QixVQUFVLENBQUN5QixhQUFhLENBQUMxZ0IsTUFBTSxDQUFBO0FBQ3hELElBQUEsSUFBSS9JLE1BQU0sRUFBRTtBQUFBLE1BQUEsSUFBQTBwQixvQkFBQSxDQUFBO0FBRVI7TUFDQSxJQUFJLElBQUksQ0FBQ3hnQixRQUFRLEVBQUU7UUFDZnpKLHFCQUFxQixDQUFDc0osTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUNoQyxRQUFBLE1BQU1sSCxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7O0FBRWxCO1FBQ0EsS0FBSyxJQUFJaUgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMGdCLGdCQUFnQixFQUFFMWdCLENBQUMsRUFBRSxFQUFFO0FBQ3ZDLFVBQUEsTUFBTXFmLFFBQVEsR0FBR0gsVUFBVSxDQUFDeUIsYUFBYSxDQUFDM2dCLENBQUMsQ0FBQyxDQUFBOztBQUU1QztVQUNBLElBQUksRUFBRXFmLFFBQVEsQ0FBQ3dCLEtBQUssSUFBSXhCLFFBQVEsQ0FBQ25SLE9BQU8sQ0FBQyxFQUFFO1lBQ3ZDdlgscUJBQXFCLENBQUNtbEIsSUFBSSxDQUFDL2lCLEVBQUUsQ0FBQ3FCLGlCQUFpQixHQUFHNEYsQ0FBQyxDQUFDLENBQUE7QUFDeEQsV0FBQTtBQUNKLFNBQUE7O0FBRUE7QUFDQSxRQUFBLElBQUk5SSxNQUFNLEtBQUssSUFBSSxDQUFDMlksVUFBVSxFQUFFO0FBQzVCLFVBQUEsSUFBSSxDQUFDcVAsVUFBVSxDQUFDSSxlQUFlLENBQUN3QixVQUFVLEVBQUU7QUFDeENucUIsWUFBQUEscUJBQXFCLENBQUNtbEIsSUFBSSxDQUFDL2lCLEVBQUUsQ0FBQ2dvQixnQkFBZ0IsQ0FBQyxDQUFBO0FBQ25ELFdBQUE7QUFDQSxVQUFBLElBQUksQ0FBQzdCLFVBQVUsQ0FBQ0ksZUFBZSxDQUFDMEIsWUFBWSxFQUFFO0FBQzFDcnFCLFlBQUFBLHFCQUFxQixDQUFDbWxCLElBQUksQ0FBQy9pQixFQUFFLENBQUNrb0Isa0JBQWtCLENBQUMsQ0FBQTtBQUNyRCxXQUFBO0FBQ0osU0FBQTtBQUVBLFFBQUEsSUFBSXRxQixxQkFBcUIsQ0FBQ3NKLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFFbEM7QUFDQTtVQUNBLElBQUlpZixVQUFVLENBQUNnQyxpQkFBaUIsRUFBRTtZQUM5Qm5vQixFQUFFLENBQUNvb0IscUJBQXFCLENBQUNwb0IsRUFBRSxDQUFDMmxCLGdCQUFnQixFQUFFL25CLHFCQUFxQixDQUFDLENBQUE7QUFDeEUsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBOztBQUVBO01BQ0EsSUFBQWlxQixDQUFBQSxvQkFBQSxHQUFJMUIsVUFBVSxDQUFDRyxRQUFRLEtBQW5CdUIsSUFBQUEsSUFBQUEsb0JBQUEsQ0FBcUIxUyxPQUFPLEVBQUU7QUFDOUIsUUFBQSxJQUFJLElBQUksQ0FBQzlOLFFBQVEsSUFBSThlLFVBQVUsQ0FBQ25QLE9BQU8sR0FBRyxDQUFDLElBQUk3WSxNQUFNLENBQUNrcUIsV0FBVyxFQUFFO0FBQy9EbHFCLFVBQUFBLE1BQU0sQ0FBQ2dYLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUE7QUFDL0IsU0FBQTtBQUNKLE9BQUE7O0FBRUE7TUFDQSxLQUFLLElBQUlsTyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcwZ0IsZ0JBQWdCLEVBQUUxZ0IsQ0FBQyxFQUFFLEVBQUU7QUFDdkMsUUFBQSxNQUFNcWYsUUFBUSxHQUFHSCxVQUFVLENBQUN5QixhQUFhLENBQUMzZ0IsQ0FBQyxDQUFDLENBQUE7UUFDNUMsSUFBSXFmLFFBQVEsQ0FBQ3RqQixPQUFPLEVBQUU7QUFDbEIsVUFBQSxNQUFNUSxXQUFXLEdBQUdyRixNQUFNLENBQUNtcUIsYUFBYSxDQUFDcmhCLENBQUMsQ0FBQyxDQUFBO1VBQzNDLElBQUl6RCxXQUFXLElBQUlBLFdBQVcsQ0FBQ1UsSUFBSSxDQUFDcWtCLFVBQVUsSUFBSS9rQixXQUFXLENBQUNSLE9BQU8sS0FBS1EsV0FBVyxDQUFDZ2xCLEdBQUcsSUFBSSxJQUFJLENBQUNuaEIsUUFBUSxDQUFDLEVBQUU7WUFFekdoSixhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUcsQ0FBTTJJLElBQUFBLEVBQUFBLENBQUUsRUFBQyxDQUFDLENBQUE7WUFFN0MsSUFBSSxDQUFDd2hCLGFBQWEsQ0FBQyxJQUFJLENBQUNoTCxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNoRCxZQUFBLElBQUksQ0FBQ3BkLFdBQVcsQ0FBQ21ELFdBQVcsQ0FBQyxDQUFBO1lBQzdCLElBQUksQ0FBQ3hELEVBQUUsQ0FBQzBvQixjQUFjLENBQUNsbEIsV0FBVyxDQUFDVSxJQUFJLENBQUN5a0IsU0FBUyxDQUFDLENBQUE7QUFFbER0cUIsWUFBQUEsYUFBYSxDQUFDeUIsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3BDLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUN5bkIsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBRTdCbHBCLElBQUFBLGFBQWEsQ0FBQ3lCLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNwQyxHQUFBO0VBRUEsSUFBSThvQixrQkFBa0JBLENBQUN6VyxLQUFLLEVBQUU7QUFDMUIsSUFBQSxJQUFJLElBQUksQ0FBQ2hOLG1CQUFtQixLQUFLZ04sS0FBSyxFQUFFO01BQ3BDLElBQUksQ0FBQ2hOLG1CQUFtQixHQUFHZ04sS0FBSyxDQUFBO01BQ2hDLElBQUksQ0FBQy9NLDBCQUEwQixHQUFHLElBQUksQ0FBQTtBQUMxQyxLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUl3akIsa0JBQWtCQSxHQUFHO0lBQ3JCLE9BQU8sSUFBSSxDQUFDempCLG1CQUFtQixDQUFBO0FBQ25DLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJekcsRUFBQUEsV0FBV0EsR0FBRztBQUFBLElBQUEsSUFBQW1xQixrQkFBQSxDQUFBO0FBQ1Z4cUIsSUFBQUEsYUFBYSxDQUFDQyxhQUFhLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFBO0lBRWpELElBQUksQ0FBQzRrQixRQUFRLEdBQUcsSUFBSSxDQUFBOztBQUVwQjtJQUNBLElBQUksSUFBSSxDQUFDaGIsc0NBQXNDLEVBQUU7QUFDN0MsTUFBQSxLQUFLLElBQUk0Z0IsSUFBSSxHQUFHLENBQUMsRUFBRUEsSUFBSSxHQUFHLElBQUksQ0FBQ2hHLFlBQVksQ0FBQzViLE1BQU0sRUFBRSxFQUFFNGhCLElBQUksRUFBRTtRQUN4RCxLQUFLLElBQUlDLElBQUksR0FBRyxDQUFDLEVBQUVBLElBQUksR0FBRyxDQUFDLEVBQUUsRUFBRUEsSUFBSSxFQUFFO1VBQ2pDLElBQUksQ0FBQ2pHLFlBQVksQ0FBQ2dHLElBQUksQ0FBQyxDQUFDQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDeEMsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUVBO0FBQ0EsSUFBQSxNQUFNNXFCLE1BQU0sR0FBQSxDQUFBMHFCLGtCQUFBLEdBQUcsSUFBSSxDQUFDcnFCLFlBQVksS0FBQSxJQUFBLEdBQUFxcUIsa0JBQUEsR0FBSSxJQUFJLENBQUMvUixVQUFVLENBQUE7QUFDbkRqUixJQUFBQSxLQUFLLENBQUM0ZixNQUFNLENBQUN0bkIsTUFBTSxDQUFDLENBQUE7O0FBRXBCO0FBQ0EsSUFBQSxNQUFNNnFCLFVBQVUsR0FBRzdxQixNQUFNLENBQUMrRixJQUFJLENBQUE7QUFDOUIsSUFBQSxJQUFJLENBQUM4a0IsVUFBVSxDQUFDQyxXQUFXLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNDLGdCQUFnQixDQUFDL3FCLE1BQU0sQ0FBQyxDQUFBO0FBQ2pDLEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUksQ0FBQzhGLGNBQWMsQ0FBQytrQixVQUFVLENBQUM3a0IsY0FBYyxDQUFDLENBQUE7QUFFOUM5RixJQUFBQSxhQUFhLENBQUN5QixZQUFZLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDcEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRCxFQUFBQSxTQUFTQSxHQUFHO0FBRVJ4QixJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUcsWUFBVyxDQUFDLENBQUE7SUFFL0MsSUFBSSxDQUFDb3BCLGlCQUFpQixFQUFFLENBQUE7O0FBRXhCO0FBQ0EsSUFBQSxNQUFNdnBCLE1BQU0sR0FBRyxJQUFJLENBQUNLLFlBQVksQ0FBQTtBQUNoQyxJQUFBLElBQUlMLE1BQU0sSUFBSUEsTUFBTSxLQUFLLElBQUksQ0FBQzJZLFVBQVUsRUFBRTtBQUN0QztBQUNBLE1BQUEsSUFBSSxJQUFJLENBQUN6UCxRQUFRLElBQUlsSixNQUFNLENBQUNnckIsUUFBUSxHQUFHLENBQUMsSUFBSWhyQixNQUFNLENBQUNrcUIsV0FBVyxFQUFFO1FBQzVEbHFCLE1BQU0sQ0FBQ2dYLE9BQU8sRUFBRSxDQUFBO0FBQ3BCLE9BQUE7O0FBRUE7QUFDQSxNQUFBLE1BQU0zUixXQUFXLEdBQUdyRixNQUFNLENBQUM4bUIsWUFBWSxDQUFBO01BQ3ZDLElBQUl6aEIsV0FBVyxJQUFJQSxXQUFXLENBQUNVLElBQUksQ0FBQ3FrQixVQUFVLElBQUkva0IsV0FBVyxDQUFDUixPQUFPLEtBQUtRLFdBQVcsQ0FBQ2dsQixHQUFHLElBQUksSUFBSSxDQUFDbmhCLFFBQVEsQ0FBQyxFQUFFO0FBQ3pHO0FBQ0E7UUFDQSxJQUFJLENBQUNvaEIsYUFBYSxDQUFDLElBQUksQ0FBQ2hMLG1CQUFtQixHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2hELFFBQUEsSUFBSSxDQUFDcGQsV0FBVyxDQUFDbUQsV0FBVyxDQUFDLENBQUE7UUFDN0IsSUFBSSxDQUFDeEQsRUFBRSxDQUFDMG9CLGNBQWMsQ0FBQ2xsQixXQUFXLENBQUNVLElBQUksQ0FBQ3lrQixTQUFTLENBQUMsQ0FBQTtBQUN0RCxPQUFBO0FBQ0osS0FBQTtBQUVBdHFCLElBQUFBLGFBQWEsQ0FBQ3lCLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJc3BCLGNBQWNBLENBQUNDLEtBQUssRUFBRTtBQUNsQixJQUFBLElBQUksSUFBSSxDQUFDNUcsV0FBVyxLQUFLNEcsS0FBSyxFQUFFO01BQzVCLElBQUksQ0FBQzVHLFdBQVcsR0FBRzRHLEtBQUssQ0FBQTs7QUFFeEI7QUFDQTtBQUNBLE1BQUEsTUFBTXJwQixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7TUFDbEJBLEVBQUUsQ0FBQ3NpQixXQUFXLENBQUN0aUIsRUFBRSxDQUFDMGlCLG1CQUFtQixFQUFFMkcsS0FBSyxDQUFDLENBQUE7QUFDakQsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMseUJBQXlCQSxDQUFDQyxnQkFBZ0IsRUFBRTtBQUN4QyxJQUFBLElBQUksSUFBSSxDQUFDNUcsc0JBQXNCLEtBQUs0RyxnQkFBZ0IsRUFBRTtNQUNsRCxJQUFJLENBQUM1RyxzQkFBc0IsR0FBRzRHLGdCQUFnQixDQUFBOztBQUU5QztBQUNBO0FBQ0EsTUFBQSxNQUFNdnBCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtNQUNsQkEsRUFBRSxDQUFDc2lCLFdBQVcsQ0FBQ3RpQixFQUFFLENBQUM0aUIsOEJBQThCLEVBQUUyRyxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3ZFLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJZCxhQUFhQSxDQUFDckYsV0FBVyxFQUFFO0FBQ3ZCLElBQUEsSUFBSSxJQUFJLENBQUNBLFdBQVcsS0FBS0EsV0FBVyxFQUFFO0FBQ2xDLE1BQUEsSUFBSSxDQUFDcGpCLEVBQUUsQ0FBQ3lvQixhQUFhLENBQUMsSUFBSSxDQUFDem9CLEVBQUUsQ0FBQ3dwQixRQUFRLEdBQUdwRyxXQUFXLENBQUMsQ0FBQTtNQUNyRCxJQUFJLENBQUNBLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJL2lCLFdBQVdBLENBQUNGLE9BQU8sRUFBRTtBQUNqQixJQUFBLE1BQU0rRCxJQUFJLEdBQUcvRCxPQUFPLENBQUMrRCxJQUFJLENBQUE7QUFDekIsSUFBQSxNQUFNdWxCLGFBQWEsR0FBR3ZsQixJQUFJLENBQUN5a0IsU0FBUyxDQUFBO0FBQ3BDLElBQUEsTUFBTWUsYUFBYSxHQUFHeGxCLElBQUksQ0FBQ3FrQixVQUFVLENBQUE7QUFDckMsSUFBQSxNQUFNbkYsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFBO0FBQ3BDLElBQUEsTUFBTTJGLElBQUksR0FBRyxJQUFJLENBQUN0WCxZQUFZLENBQUNnWSxhQUFhLENBQUMsQ0FBQTtJQUM3QyxJQUFJLElBQUksQ0FBQzNHLFlBQVksQ0FBQ00sV0FBVyxDQUFDLENBQUMyRixJQUFJLENBQUMsS0FBS1csYUFBYSxFQUFFO01BQ3hELElBQUksQ0FBQzFwQixFQUFFLENBQUNLLFdBQVcsQ0FBQ29wQixhQUFhLEVBQUVDLGFBQWEsQ0FBQyxDQUFBO01BQ2pELElBQUksQ0FBQzVHLFlBQVksQ0FBQ00sV0FBVyxDQUFDLENBQUMyRixJQUFJLENBQUMsR0FBR1csYUFBYSxDQUFBO0FBQ3hELEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsaUJBQWlCQSxDQUFDeHBCLE9BQU8sRUFBRWlqQixXQUFXLEVBQUU7QUFDcEMsSUFBQSxNQUFNbGYsSUFBSSxHQUFHL0QsT0FBTyxDQUFDK0QsSUFBSSxDQUFBO0FBQ3pCLElBQUEsTUFBTXVsQixhQUFhLEdBQUd2bEIsSUFBSSxDQUFDeWtCLFNBQVMsQ0FBQTtBQUNwQyxJQUFBLE1BQU1lLGFBQWEsR0FBR3hsQixJQUFJLENBQUNxa0IsVUFBVSxDQUFBO0FBQ3JDLElBQUEsTUFBTVEsSUFBSSxHQUFHLElBQUksQ0FBQ3RYLFlBQVksQ0FBQ2dZLGFBQWEsQ0FBQyxDQUFBO0lBQzdDLElBQUksSUFBSSxDQUFDM0csWUFBWSxDQUFDTSxXQUFXLENBQUMsQ0FBQzJGLElBQUksQ0FBQyxLQUFLVyxhQUFhLEVBQUU7QUFDeEQsTUFBQSxJQUFJLENBQUNqQixhQUFhLENBQUNyRixXQUFXLENBQUMsQ0FBQTtNQUMvQixJQUFJLENBQUNwakIsRUFBRSxDQUFDSyxXQUFXLENBQUNvcEIsYUFBYSxFQUFFQyxhQUFhLENBQUMsQ0FBQTtNQUNqRCxJQUFJLENBQUM1RyxZQUFZLENBQUNNLFdBQVcsQ0FBQyxDQUFDMkYsSUFBSSxDQUFDLEdBQUdXLGFBQWEsQ0FBQTtBQUN4RCxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUUsb0JBQW9CQSxDQUFDenBCLE9BQU8sRUFBRTtBQUMxQixJQUFBLE1BQU1ILEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixJQUFBLE1BQU1xbkIsS0FBSyxHQUFHbG5CLE9BQU8sQ0FBQytELElBQUksQ0FBQzJsQixtQkFBbUIsQ0FBQTtBQUM5QyxJQUFBLE1BQU0xckIsTUFBTSxHQUFHZ0MsT0FBTyxDQUFDK0QsSUFBSSxDQUFDeWtCLFNBQVMsQ0FBQTtJQUVyQyxJQUFJdEIsS0FBSyxHQUFHLENBQUMsRUFBRTtBQUNYLE1BQUEsSUFBSXlDLE1BQU0sR0FBRzNwQixPQUFPLENBQUM0cEIsVUFBVSxDQUFBO01BQy9CLElBQUssQ0FBQzVwQixPQUFPLENBQUNxb0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDbmhCLFFBQVEsSUFBSyxDQUFDbEgsT0FBTyxDQUFDNnBCLFFBQVEsSUFBSzdwQixPQUFPLENBQUM4cEIsV0FBVyxJQUFJOXBCLE9BQU8sQ0FBQytwQixPQUFPLENBQUNoakIsTUFBTSxLQUFLLENBQUUsRUFBRTtBQUNoSCxRQUFBLElBQUk0aUIsTUFBTSxLQUFLSyw2QkFBNkIsSUFBSUwsTUFBTSxLQUFLTSw0QkFBNEIsRUFBRTtBQUNyRk4sVUFBQUEsTUFBTSxHQUFHNW1CLGNBQWMsQ0FBQTtTQUMxQixNQUFNLElBQUk0bUIsTUFBTSxLQUFLTyw0QkFBNEIsSUFBSVAsTUFBTSxLQUFLUSwyQkFBMkIsRUFBRTtBQUMxRlIsVUFBQUEsTUFBTSxHQUFHUyxhQUFhLENBQUE7QUFDMUIsU0FBQTtBQUNKLE9BQUE7QUFDQXZxQixNQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQ1Esa0JBQWtCLEVBQUUsSUFBSSxDQUFDMkwsUUFBUSxDQUFDMmQsTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUMxRSxLQUFBO0lBQ0EsSUFBSXpDLEtBQUssR0FBRyxDQUFDLEVBQUU7QUFDWHJuQixNQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQ1Usa0JBQWtCLEVBQUUsSUFBSSxDQUFDeUwsUUFBUSxDQUFDaE0sT0FBTyxDQUFDcXFCLFVBQVUsQ0FBQyxDQUFDLENBQUE7QUFDdEYsS0FBQTtJQUNBLElBQUluRCxLQUFLLEdBQUcsQ0FBQyxFQUFFO01BQ1gsSUFBSSxJQUFJLENBQUNoZ0IsUUFBUSxFQUFFO0FBQ2ZySCxRQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQ1csY0FBYyxFQUFFLElBQUksQ0FBQ2tJLFNBQVMsQ0FBQzFJLE9BQU8sQ0FBQ3NxQixTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQ2xGLE9BQUMsTUFBTTtBQUNIO1FBQ0F6cUIsRUFBRSxDQUFDTyxhQUFhLENBQUNwQyxNQUFNLEVBQUU2QixFQUFFLENBQUNXLGNBQWMsRUFBRSxJQUFJLENBQUNrSSxTQUFTLENBQUMxSSxPQUFPLENBQUNxb0IsR0FBRyxHQUFHcm9CLE9BQU8sQ0FBQ3NxQixTQUFTLEdBQUdDLHFCQUFxQixDQUFDLENBQUMsQ0FBQTtBQUN4SCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUlyRCxLQUFLLEdBQUcsQ0FBQyxFQUFFO01BQ1gsSUFBSSxJQUFJLENBQUNoZ0IsUUFBUSxFQUFFO0FBQ2ZySCxRQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQ2EsY0FBYyxFQUFFLElBQUksQ0FBQ2dJLFNBQVMsQ0FBQzFJLE9BQU8sQ0FBQ3dxQixTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQ2xGLE9BQUMsTUFBTTtBQUNIO1FBQ0EzcUIsRUFBRSxDQUFDTyxhQUFhLENBQUNwQyxNQUFNLEVBQUU2QixFQUFFLENBQUNhLGNBQWMsRUFBRSxJQUFJLENBQUNnSSxTQUFTLENBQUMxSSxPQUFPLENBQUNxb0IsR0FBRyxHQUFHcm9CLE9BQU8sQ0FBQ3dxQixTQUFTLEdBQUdELHFCQUFxQixDQUFDLENBQUMsQ0FBQTtBQUN4SCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUlyRCxLQUFLLEdBQUcsRUFBRSxFQUFFO01BQ1osSUFBSSxJQUFJLENBQUNoZ0IsUUFBUSxFQUFFO0FBQ2ZySCxRQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQzRxQixjQUFjLEVBQUUsSUFBSSxDQUFDL2hCLFNBQVMsQ0FBQzFJLE9BQU8sQ0FBQzBxQixTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQ2xGLE9BQUE7QUFDSixLQUFBO0lBQ0EsSUFBSXhELEtBQUssR0FBRyxFQUFFLEVBQUU7TUFDWixJQUFJLElBQUksQ0FBQ2hnQixRQUFRLEVBQUU7UUFDZnJILEVBQUUsQ0FBQ08sYUFBYSxDQUFDcEMsTUFBTSxFQUFFNkIsRUFBRSxDQUFDOHFCLG9CQUFvQixFQUFFM3FCLE9BQU8sQ0FBQzRxQixjQUFjLEdBQUcvcUIsRUFBRSxDQUFDZ3JCLHNCQUFzQixHQUFHaHJCLEVBQUUsQ0FBQ3dpQixJQUFJLENBQUMsQ0FBQTtBQUNuSCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUk2RSxLQUFLLEdBQUcsRUFBRSxFQUFFO01BQ1osSUFBSSxJQUFJLENBQUNoZ0IsUUFBUSxFQUFFO0FBQ2ZySCxRQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3BDLE1BQU0sRUFBRTZCLEVBQUUsQ0FBQ2lyQixvQkFBb0IsRUFBRSxJQUFJLENBQUN2Z0IsWUFBWSxDQUFDdkssT0FBTyxDQUFDK3FCLFlBQVksQ0FBQyxDQUFDLENBQUE7QUFDOUYsT0FBQTtBQUNKLEtBQUE7SUFDQSxJQUFJN0QsS0FBSyxHQUFHLEdBQUcsRUFBRTtBQUNiLE1BQUEsTUFBTXBNLEdBQUcsR0FBRyxJQUFJLENBQUNrQiwyQkFBMkIsQ0FBQTtBQUM1QyxNQUFBLElBQUlsQixHQUFHLEVBQUU7QUFDTGpiLFFBQUFBLEVBQUUsQ0FBQ21yQixhQUFhLENBQUNodEIsTUFBTSxFQUFFOGMsR0FBRyxDQUFDbVEsMEJBQTBCLEVBQUVDLElBQUksQ0FBQ0MsS0FBSyxDQUFDeFcsSUFBSSxDQUFDeVcsS0FBSyxDQUFDcHJCLE9BQU8sQ0FBQ3FyQixXQUFXLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDek0sYUFBYSxDQUFDLENBQUMsQ0FBQTtBQUNoSSxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTBNLEVBQUFBLFVBQVVBLENBQUN0ckIsT0FBTyxFQUFFaWpCLFdBQVcsRUFBRTtBQUU3QixJQUFBLE1BQU1sZixJQUFJLEdBQUcvRCxPQUFPLENBQUMrRCxJQUFJLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNBLElBQUksQ0FBQ3FrQixVQUFVLEVBQ2hCcmtCLElBQUksQ0FBQ3duQixVQUFVLENBQUMsSUFBSSxFQUFFdnJCLE9BQU8sQ0FBQyxDQUFBO0FBRWxDLElBQUEsSUFBSStELElBQUksQ0FBQzJsQixtQkFBbUIsR0FBRyxDQUFDLElBQUkxcEIsT0FBTyxDQUFDd3JCLFlBQVksSUFBSXhyQixPQUFPLENBQUN5ckIsbUJBQW1CLEVBQUU7QUFFckY7QUFDQSxNQUFBLElBQUksQ0FBQ25ELGFBQWEsQ0FBQ3JGLFdBQVcsQ0FBQyxDQUFBOztBQUUvQjtBQUNBLE1BQUEsSUFBSSxDQUFDL2lCLFdBQVcsQ0FBQ0YsT0FBTyxDQUFDLENBQUE7TUFFekIsSUFBSStELElBQUksQ0FBQzJsQixtQkFBbUIsRUFBRTtBQUMxQixRQUFBLElBQUksQ0FBQ0Qsb0JBQW9CLENBQUN6cEIsT0FBTyxDQUFDLENBQUE7UUFDbEMrRCxJQUFJLENBQUMybEIsbUJBQW1CLEdBQUcsQ0FBQyxDQUFBO0FBQ2hDLE9BQUE7QUFFQSxNQUFBLElBQUkxcEIsT0FBTyxDQUFDd3JCLFlBQVksSUFBSXhyQixPQUFPLENBQUN5ckIsbUJBQW1CLEVBQUU7QUFDckQxbkIsUUFBQUEsSUFBSSxDQUFDMm5CLE1BQU0sQ0FBQyxJQUFJLEVBQUUxckIsT0FBTyxDQUFDLENBQUE7UUFDMUJBLE9BQU8sQ0FBQ3dyQixZQUFZLEdBQUcsS0FBSyxDQUFBO1FBQzVCeHJCLE9BQU8sQ0FBQ3lyQixtQkFBbUIsR0FBRyxLQUFLLENBQUE7QUFDdkMsT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBQSxJQUFJLENBQUNqQyxpQkFBaUIsQ0FBQ3hwQixPQUFPLEVBQUVpakIsV0FBVyxDQUFDLENBQUE7QUFDaEQsS0FBQTtBQUNKLEdBQUE7O0FBRUE7RUFDQTVILGlCQUFpQkEsQ0FBQ3NRLGFBQWEsRUFBRTtJQUU3QixJQUFJQyxHQUFHLEVBQUVDLEdBQUcsQ0FBQTs7QUFFWjtBQUNBLElBQUEsTUFBTUMsUUFBUSxHQUFHSCxhQUFhLENBQUM1a0IsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN6QyxJQUFBLElBQUkra0IsUUFBUSxFQUFFO0FBRVY7QUFDQUYsTUFBQUEsR0FBRyxHQUFHLEVBQUUsQ0FBQTtBQUNSLE1BQUEsS0FBSyxJQUFJOWtCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzZrQixhQUFhLENBQUM1a0IsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMzQyxRQUFBLE1BQU0yUSxZQUFZLEdBQUdrVSxhQUFhLENBQUM3a0IsQ0FBQyxDQUFDLENBQUE7UUFDckM4a0IsR0FBRyxJQUFJblUsWUFBWSxDQUFDc1UsRUFBRSxHQUFHdFUsWUFBWSxDQUFDaFYsTUFBTSxDQUFDdXBCLGFBQWEsQ0FBQTtBQUM5RCxPQUFBOztBQUVBO01BQ0FILEdBQUcsR0FBRyxJQUFJLENBQUNoSixPQUFPLENBQUNvSixHQUFHLENBQUNMLEdBQUcsQ0FBQyxDQUFBO0FBQy9CLEtBQUE7O0FBRUE7SUFDQSxJQUFJLENBQUNDLEdBQUcsRUFBRTtBQUVOO0FBQ0EsTUFBQSxNQUFNaHNCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQmdzQixNQUFBQSxHQUFHLEdBQUdoc0IsRUFBRSxDQUFDd2IsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QnhiLE1BQUFBLEVBQUUsQ0FBQzhiLGVBQWUsQ0FBQ2tRLEdBQUcsQ0FBQyxDQUFBOztBQUV2QjtNQUNBaHNCLEVBQUUsQ0FBQ3FzQixVQUFVLENBQUNyc0IsRUFBRSxDQUFDc3NCLG9CQUFvQixFQUFFLElBQUksQ0FBQyxDQUFBO01BRTVDLElBQUlDLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDbkIsTUFBQSxLQUFLLElBQUl0bEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNmtCLGFBQWEsQ0FBQzVrQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBRTNDO0FBQ0EsUUFBQSxNQUFNMlEsWUFBWSxHQUFHa1UsYUFBYSxDQUFDN2tCLENBQUMsQ0FBQyxDQUFBO0FBQ3JDakgsUUFBQUEsRUFBRSxDQUFDcXNCLFVBQVUsQ0FBQ3JzQixFQUFFLENBQUN3c0IsWUFBWSxFQUFFNVUsWUFBWSxDQUFDMVQsSUFBSSxDQUFDdW9CLFFBQVEsQ0FBQyxDQUFBOztBQUUxRDtBQUNBLFFBQUEsTUFBTUMsUUFBUSxHQUFHOVUsWUFBWSxDQUFDaFYsTUFBTSxDQUFDOHBCLFFBQVEsQ0FBQTtBQUM3QyxRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxRQUFRLENBQUN4bEIsTUFBTSxFQUFFeWxCLENBQUMsRUFBRSxFQUFFO0FBQ3RDLFVBQUEsTUFBTUMsQ0FBQyxHQUFHRixRQUFRLENBQUNDLENBQUMsQ0FBQyxDQUFBO0FBQ3JCLFVBQUEsTUFBTUUsR0FBRyxHQUFHQyxrQkFBa0IsQ0FBQ0YsQ0FBQyxDQUFDcnFCLElBQUksQ0FBQyxDQUFBO1VBRXRDLElBQUlzcUIsR0FBRyxLQUFLLENBQUMsRUFBRTtBQUNYTixZQUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ2xCLFdBQUE7VUFFQSxJQUFJSyxDQUFDLENBQUNHLEtBQUssRUFBRTtZQUNUL3NCLEVBQUUsQ0FBQ2d0QixvQkFBb0IsQ0FBQ0gsR0FBRyxFQUFFRCxDQUFDLENBQUNLLGFBQWEsRUFBRSxJQUFJLENBQUNoZ0IsTUFBTSxDQUFDMmYsQ0FBQyxDQUFDTSxRQUFRLENBQUMsRUFBRU4sQ0FBQyxDQUFDTyxNQUFNLEVBQUVQLENBQUMsQ0FBQ1EsTUFBTSxDQUFDLENBQUE7QUFDOUYsV0FBQyxNQUFNO0FBQ0hwdEIsWUFBQUEsRUFBRSxDQUFDcXRCLG1CQUFtQixDQUFDUixHQUFHLEVBQUVELENBQUMsQ0FBQ0ssYUFBYSxFQUFFLElBQUksQ0FBQ2hnQixNQUFNLENBQUMyZixDQUFDLENBQUNNLFFBQVEsQ0FBQyxFQUFFTixDQUFDLENBQUNVLFNBQVMsRUFBRVYsQ0FBQyxDQUFDTyxNQUFNLEVBQUVQLENBQUMsQ0FBQ1EsTUFBTSxDQUFDLENBQUE7QUFDMUcsV0FBQTtBQUVBcHRCLFVBQUFBLEVBQUUsQ0FBQ3V0Qix1QkFBdUIsQ0FBQ1YsR0FBRyxDQUFDLENBQUE7QUFFL0IsVUFBQSxJQUFJalYsWUFBWSxDQUFDaFYsTUFBTSxDQUFDNHFCLFVBQVUsRUFBRTtBQUNoQ3h0QixZQUFBQSxFQUFFLENBQUNzYixtQkFBbUIsQ0FBQ3VSLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNsQyxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7O0FBRUE7QUFDQTdzQixNQUFBQSxFQUFFLENBQUM4YixlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7O0FBRXhCO01BQ0E5YixFQUFFLENBQUNxc0IsVUFBVSxDQUFDcnNCLEVBQUUsQ0FBQ3dzQixZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUE7O0FBRXBDO0FBQ0EsTUFBQSxJQUFJUCxRQUFRLEVBQUU7UUFDVixJQUFJLENBQUNqSixPQUFPLENBQUN0TCxHQUFHLENBQUNxVSxHQUFHLEVBQUVDLEdBQUcsQ0FBQyxDQUFBO0FBQzlCLE9BQUE7TUFFQSxJQUFJLENBQUNPLE9BQU8sRUFBRTtBQUNWMW1CLFFBQUFBLEtBQUssQ0FBQytULElBQUksQ0FBQyxvS0FBb0ssQ0FBQyxDQUFBO0FBQ3BMLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPb1MsR0FBRyxDQUFBO0FBQ2QsR0FBQTtBQUVBdEUsRUFBQUEsaUJBQWlCQSxHQUFHO0FBQ2hCO0lBQ0EsSUFBSSxJQUFJLENBQUN4RSxRQUFRLEVBQUU7TUFDZixJQUFJLENBQUNBLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDcEIsTUFBQSxJQUFJLENBQUNsakIsRUFBRSxDQUFDOGIsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2pDLEtBQUE7QUFDSixHQUFBO0FBRUEyUixFQUFBQSxVQUFVQSxHQUFHO0FBQ1QsSUFBQSxNQUFNenRCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixJQUFBLElBQUlnc0IsR0FBRyxDQUFBOztBQUVQO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQ0YsYUFBYSxDQUFDNWtCLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFFakM7QUFDQSxNQUFBLE1BQU0wUSxZQUFZLEdBQUcsSUFBSSxDQUFDa1UsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQzFDam1CLEtBQUssQ0FBQzRmLE1BQU0sQ0FBQzdOLFlBQVksQ0FBQzFaLE1BQU0sS0FBSyxJQUFJLEVBQUUsK0RBQStELENBQUMsQ0FBQTtBQUMzRyxNQUFBLElBQUksQ0FBQzBaLFlBQVksQ0FBQzFULElBQUksQ0FBQzhuQixHQUFHLEVBQUU7QUFDeEJwVSxRQUFBQSxZQUFZLENBQUMxVCxJQUFJLENBQUM4bkIsR0FBRyxHQUFHLElBQUksQ0FBQ3hRLGlCQUFpQixDQUFDLElBQUksQ0FBQ3NRLGFBQWEsQ0FBQyxDQUFBO0FBQ3RFLE9BQUE7QUFDQUUsTUFBQUEsR0FBRyxHQUFHcFUsWUFBWSxDQUFDMVQsSUFBSSxDQUFDOG5CLEdBQUcsQ0FBQTtBQUMvQixLQUFDLE1BQU07QUFDSDtNQUNBQSxHQUFHLEdBQUcsSUFBSSxDQUFDeFEsaUJBQWlCLENBQUMsSUFBSSxDQUFDc1EsYUFBYSxDQUFDLENBQUE7QUFDcEQsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUM1SSxRQUFRLEtBQUs4SSxHQUFHLEVBQUU7TUFDdkIsSUFBSSxDQUFDOUksUUFBUSxHQUFHOEksR0FBRyxDQUFBO0FBQ25CaHNCLE1BQUFBLEVBQUUsQ0FBQzhiLGVBQWUsQ0FBQ2tRLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUksQ0FBQ0YsYUFBYSxDQUFDNWtCLE1BQU0sR0FBRyxDQUFDLENBQUE7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBLElBQUEsTUFBTXVsQixRQUFRLEdBQUcsSUFBSSxDQUFDMVUsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFDN1QsSUFBSSxDQUFDdW9CLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDekV6c0IsRUFBRSxDQUFDcXNCLFVBQVUsQ0FBQ3JzQixFQUFFLENBQUNzc0Isb0JBQW9CLEVBQUVHLFFBQVEsQ0FBQyxDQUFBO0FBQ3BELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWx0QixFQUFBQSxJQUFJQSxDQUFDbXVCLFNBQVMsRUFBRUMsWUFBWSxFQUFFQyxXQUFXLEVBQUU7QUFDdkMsSUFBQSxNQUFNNXRCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUVsQixJQUFJNnRCLE9BQU8sRUFBRUMsWUFBWSxFQUFFM3RCLE9BQU8sRUFBRTR0QixXQUFXLENBQUM7SUFDaEQsSUFBSTdiLE9BQU8sRUFBRThiLE9BQU8sRUFBRUMsY0FBYyxFQUFFQyxjQUFjLENBQUM7QUFDckQsSUFBQSxNQUFNOXZCLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtJQUMxQixJQUFJLENBQUNBLE1BQU0sRUFDUCxPQUFBO0FBQ0osSUFBQSxNQUFNK3ZCLFFBQVEsR0FBRy92QixNQUFNLENBQUM4RixJQUFJLENBQUNpcUIsUUFBUSxDQUFBO0FBQ3JDLElBQUEsTUFBTUMsUUFBUSxHQUFHaHdCLE1BQU0sQ0FBQzhGLElBQUksQ0FBQ2txQixRQUFRLENBQUE7O0FBRXJDO0lBQ0EsSUFBSSxDQUFDUixXQUFXLEVBQUU7TUFDZCxJQUFJLENBQUNILFVBQVUsRUFBRSxDQUFBO0FBQ3JCLEtBQUE7O0FBRUE7SUFDQSxJQUFJckssV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUVuQixJQUFBLEtBQUssSUFBSW5jLENBQUMsR0FBRyxDQUFDLEVBQUVvbkIsR0FBRyxHQUFHRixRQUFRLENBQUNqbkIsTUFBTSxFQUFFRCxDQUFDLEdBQUdvbkIsR0FBRyxFQUFFcG5CLENBQUMsRUFBRSxFQUFFO0FBQ2pENG1CLE1BQUFBLE9BQU8sR0FBR00sUUFBUSxDQUFDbG5CLENBQUMsQ0FBQyxDQUFBO0FBQ3JCNm1CLE1BQUFBLFlBQVksR0FBR0QsT0FBTyxDQUFDRyxPQUFPLENBQUM3YixLQUFLLENBQUE7TUFDcEMsSUFBSSxDQUFDMmIsWUFBWSxFQUFFO0FBR2YsUUFBQSxNQUFNUSxXQUFXLEdBQUdULE9BQU8sQ0FBQ0csT0FBTyxDQUFDenJCLElBQUksQ0FBQTtBQUN4QyxRQUFBLElBQUkrckIsV0FBVyxLQUFLLGdCQUFnQixJQUFJQSxXQUFXLEtBQUssV0FBVyxFQUFFO0FBQ2pFem9CLFVBQUFBLEtBQUssQ0FBQzBvQixRQUFRLENBQUUsQ0FBWUQsVUFBQUEsRUFBQUEsV0FBWSwyS0FBMEssQ0FBQyxDQUFBO0FBQ3ZOLFNBQUE7QUFDQSxRQUFBLElBQUlBLFdBQVcsS0FBSyxnQkFBZ0IsSUFBSUEsV0FBVyxLQUFLLGtCQUFrQixFQUFFO0FBQ3hFem9CLFVBQUFBLEtBQUssQ0FBQzBvQixRQUFRLENBQUUsQ0FBWUQsVUFBQUEsRUFBQUEsV0FBWSwyS0FBMEssQ0FBQyxDQUFBO0FBQ3ZOLFNBQUE7QUFHQXpvQixRQUFBQSxLQUFLLENBQUMyaEIsU0FBUyxDQUFFLENBQVVwcEIsUUFBQUEsRUFBQUEsTUFBTSxDQUFDc2EsS0FBTSxDQUFBLDRCQUFBLEVBQThCNFYsV0FBWSxDQUFBLDJDQUFBLEVBQTZDandCLGFBQWEsQ0FBQ3NhLFFBQVEsRUFBRyxHQUFFLENBQUMsQ0FBQTs7QUFFM0o7QUFDQSxRQUFBLE9BQUE7QUFDSixPQUFBO01BRUEsSUFBSW1WLFlBQVksWUFBWXpxQixPQUFPLEVBQUU7QUFDakNsRCxRQUFBQSxPQUFPLEdBQUcydEIsWUFBWSxDQUFBO0FBQ3RCLFFBQUEsSUFBSSxDQUFDckMsVUFBVSxDQUFDdHJCLE9BQU8sRUFBRWlqQixXQUFXLENBQUMsQ0FBQTtRQUdyQyxJQUFJLElBQUksQ0FBQzVrQixZQUFZLEVBQUU7QUFDbkI7QUFDQSxVQUFBLElBQUksSUFBSSxDQUFDQSxZQUFZLENBQUMycUIsUUFBUSxHQUFHLENBQUMsRUFBRTtBQUNoQyxZQUFBLElBQUksSUFBSSxDQUFDM3FCLFlBQVksQ0FBQ2dGLFdBQVcsSUFBSSxJQUFJLENBQUNoRixZQUFZLENBQUNnRixXQUFXLEtBQUtyRCxPQUFPLEVBQUU7QUFDNUUwRixjQUFBQSxLQUFLLENBQUNtZixLQUFLLENBQUMsa0RBQWtELEVBQUU7Z0JBQUV4bUIsWUFBWSxFQUFFLElBQUksQ0FBQ0EsWUFBWTtBQUFFMkIsZ0JBQUFBLE9BQUFBO0FBQVEsZUFBQyxDQUFDLENBQUE7QUFDakgsYUFBQyxNQUFNLElBQUksSUFBSSxDQUFDM0IsWUFBWSxDQUFDZ3dCLFdBQVcsSUFBSSxJQUFJLENBQUNod0IsWUFBWSxDQUFDZ3dCLFdBQVcsS0FBS3J1QixPQUFPLEVBQUU7QUFDbkYwRixjQUFBQSxLQUFLLENBQUNtZixLQUFLLENBQUMsa0RBQWtELEVBQUU7QUFBRTdrQixnQkFBQUEsT0FBQUE7QUFBUSxlQUFDLENBQUMsQ0FBQTtBQUNoRixhQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUE7QUFHQSxRQUFBLElBQUkwdEIsT0FBTyxDQUFDOUUsSUFBSSxLQUFLM0YsV0FBVyxFQUFFO1VBQzlCcGpCLEVBQUUsQ0FBQ29TLFNBQVMsQ0FBQ3liLE9BQU8sQ0FBQ3hiLFVBQVUsRUFBRStRLFdBQVcsQ0FBQyxDQUFBO1VBQzdDeUssT0FBTyxDQUFDOUUsSUFBSSxHQUFHM0YsV0FBVyxDQUFBO0FBQzlCLFNBQUE7QUFDQUEsUUFBQUEsV0FBVyxFQUFFLENBQUE7QUFDakIsT0FBQyxNQUFNO0FBQUU7QUFDTHlLLFFBQUFBLE9BQU8sQ0FBQ1ksS0FBSyxDQUFDdm5CLE1BQU0sR0FBRyxDQUFDLENBQUE7UUFDeEI2bUIsV0FBVyxHQUFHRCxZQUFZLENBQUM1bUIsTUFBTSxDQUFBO1FBQ2pDLEtBQUssSUFBSXlsQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdvQixXQUFXLEVBQUVwQixDQUFDLEVBQUUsRUFBRTtBQUNsQ3hzQixVQUFBQSxPQUFPLEdBQUcydEIsWUFBWSxDQUFDbkIsQ0FBQyxDQUFDLENBQUE7QUFDekIsVUFBQSxJQUFJLENBQUNsQixVQUFVLENBQUN0ckIsT0FBTyxFQUFFaWpCLFdBQVcsQ0FBQyxDQUFBO0FBRXJDeUssVUFBQUEsT0FBTyxDQUFDWSxLQUFLLENBQUM5QixDQUFDLENBQUMsR0FBR3ZKLFdBQVcsQ0FBQTtBQUM5QkEsVUFBQUEsV0FBVyxFQUFFLENBQUE7QUFDakIsU0FBQTtRQUNBcGpCLEVBQUUsQ0FBQzBULFVBQVUsQ0FBQ21hLE9BQU8sQ0FBQ3hiLFVBQVUsRUFBRXdiLE9BQU8sQ0FBQ1ksS0FBSyxDQUFDLENBQUE7QUFDcEQsT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLEtBQUssSUFBSXhuQixDQUFDLEdBQUcsQ0FBQyxFQUFFb25CLEdBQUcsR0FBR0QsUUFBUSxDQUFDbG5CLE1BQU0sRUFBRUQsQ0FBQyxHQUFHb25CLEdBQUcsRUFBRXBuQixDQUFDLEVBQUUsRUFBRTtBQUNqRGlMLE1BQUFBLE9BQU8sR0FBR2tjLFFBQVEsQ0FBQ25uQixDQUFDLENBQUMsQ0FBQTtNQUNyQittQixPQUFPLEdBQUc5YixPQUFPLENBQUM4YixPQUFPLENBQUE7TUFDekJDLGNBQWMsR0FBRy9iLE9BQU8sQ0FBQ3ZMLE9BQU8sQ0FBQTtBQUNoQ3VuQixNQUFBQSxjQUFjLEdBQUdGLE9BQU8sQ0FBQ1UsYUFBYSxDQUFDL25CLE9BQU8sQ0FBQTs7QUFFOUM7QUFDQSxNQUFBLElBQUlzbkIsY0FBYyxDQUFDVSxRQUFRLEtBQUtULGNBQWMsQ0FBQ1MsUUFBUSxJQUFJVixjQUFjLENBQUNXLFFBQVEsS0FBS1YsY0FBYyxDQUFDVSxRQUFRLEVBQUU7QUFDNUdYLFFBQUFBLGNBQWMsQ0FBQ1UsUUFBUSxHQUFHVCxjQUFjLENBQUNTLFFBQVEsQ0FBQTtBQUNqRFYsUUFBQUEsY0FBYyxDQUFDVyxRQUFRLEdBQUdWLGNBQWMsQ0FBQ1UsUUFBUSxDQUFBOztBQUVqRDtBQUNBLFFBQUEsSUFBSVosT0FBTyxDQUFDN2IsS0FBSyxLQUFLLElBQUksRUFBRTtBQUN4QixVQUFBLElBQUksQ0FBQ0YsY0FBYyxDQUFDQyxPQUFPLENBQUNnYixRQUFRLENBQUMsQ0FBQ2hiLE9BQU8sRUFBRThiLE9BQU8sQ0FBQzdiLEtBQUssQ0FBQyxDQUFBO0FBQ2pFLFNBRUk7QUFFUixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSSxJQUFJLENBQUM5SyxRQUFRLElBQUksSUFBSSxDQUFDOGIsdUJBQXVCLEVBQUU7QUFDL0M7QUFDQW5qQixNQUFBQSxFQUFFLENBQUM2dUIsY0FBYyxDQUFDN3VCLEVBQUUsQ0FBQzh1Qix5QkFBeUIsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDM0wsdUJBQXVCLENBQUNqZixJQUFJLENBQUN1b0IsUUFBUSxDQUFDLENBQUE7QUFDOUZ6c0IsTUFBQUEsRUFBRSxDQUFDK3VCLHNCQUFzQixDQUFDL3VCLEVBQUUsQ0FBQzBNLE1BQU0sQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7SUFFQSxNQUFNc2lCLElBQUksR0FBRyxJQUFJLENBQUN2aUIsV0FBVyxDQUFDaWhCLFNBQVMsQ0FBQ2x1QixJQUFJLENBQUMsQ0FBQTtBQUM3QyxJQUFBLE1BQU1HLEtBQUssR0FBRyt0QixTQUFTLENBQUMvdEIsS0FBSyxDQUFBO0lBRTdCLElBQUkrdEIsU0FBUyxDQUFDOXRCLE9BQU8sRUFBRTtBQUNuQixNQUFBLE1BQU1tWSxXQUFXLEdBQUcsSUFBSSxDQUFDQSxXQUFXLENBQUE7TUFDcENsUyxLQUFLLENBQUM0ZixNQUFNLENBQUMxTixXQUFXLENBQUM3WixNQUFNLEtBQUssSUFBSSxFQUFFLDhEQUE4RCxDQUFDLENBQUE7QUFFekcsTUFBQSxNQUFNMEUsTUFBTSxHQUFHbVYsV0FBVyxDQUFDN1QsSUFBSSxDQUFDK3FCLFFBQVEsQ0FBQTtNQUN4QyxNQUFNN0IsTUFBTSxHQUFHTSxTQUFTLENBQUNodUIsSUFBSSxHQUFHcVksV0FBVyxDQUFDbVgsYUFBYSxDQUFBO01BRXpELElBQUl2QixZQUFZLEdBQUcsQ0FBQyxFQUFFO0FBQ2xCM3RCLFFBQUFBLEVBQUUsQ0FBQ29iLHFCQUFxQixDQUFDNFQsSUFBSSxFQUFFcnZCLEtBQUssRUFBRWlELE1BQU0sRUFBRXdxQixNQUFNLEVBQUVPLFlBQVksQ0FBQyxDQUFBO0FBQ3ZFLE9BQUMsTUFBTTtRQUNIM3RCLEVBQUUsQ0FBQ212QixZQUFZLENBQUNILElBQUksRUFBRXJ2QixLQUFLLEVBQUVpRCxNQUFNLEVBQUV3cUIsTUFBTSxDQUFDLENBQUE7QUFDaEQsT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUNILE1BQUEsTUFBTWdDLEtBQUssR0FBRzFCLFNBQVMsQ0FBQ2h1QixJQUFJLENBQUE7TUFFNUIsSUFBSWl1QixZQUFZLEdBQUcsQ0FBQyxFQUFFO1FBQ2xCM3RCLEVBQUUsQ0FBQ2tiLG1CQUFtQixDQUFDOFQsSUFBSSxFQUFFSSxLQUFLLEVBQUV6dkIsS0FBSyxFQUFFZ3VCLFlBQVksQ0FBQyxDQUFBO0FBQzVELE9BQUMsTUFBTTtRQUNIM3RCLEVBQUUsQ0FBQ3F2QixVQUFVLENBQUNMLElBQUksRUFBRUksS0FBSyxFQUFFenZCLEtBQUssQ0FBQyxDQUFBO0FBQ3JDLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLElBQUksQ0FBQzBILFFBQVEsSUFBSSxJQUFJLENBQUM4Yix1QkFBdUIsRUFBRTtBQUMvQztNQUNBbmpCLEVBQUUsQ0FBQ3N2QixvQkFBb0IsRUFBRSxDQUFBO01BQ3pCdHZCLEVBQUUsQ0FBQzZ1QixjQUFjLENBQUM3dUIsRUFBRSxDQUFDOHVCLHlCQUF5QixFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUM1RCxLQUFBO0lBRUEsSUFBSSxDQUFDUyxrQkFBa0IsRUFBRSxDQUFBO0FBR3pCLElBQUEsSUFBSSxDQUFDQyxjQUFjLENBQUM5QixTQUFTLENBQUNsdUIsSUFBSSxDQUFDLElBQUlrdUIsU0FBUyxDQUFDL3RCLEtBQUssSUFBSWd1QixZQUFZLEdBQUcsQ0FBQyxHQUFHQSxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFbEcsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0luSCxLQUFLQSxDQUFDdmhCLE9BQU8sRUFBRTtBQUFBLElBQUEsSUFBQXdxQixjQUFBLENBQUE7QUFDWCxJQUFBLE1BQU1DLGNBQWMsR0FBRyxJQUFJLENBQUNDLG1CQUFtQixDQUFBO0lBQy9DMXFCLE9BQU8sR0FBR0EsT0FBTyxJQUFJeXFCLGNBQWMsQ0FBQTtBQUVuQyxJQUFBLE1BQU1ySSxLQUFLLEdBQUEsQ0FBQW9JLGNBQUEsR0FBR3hxQixPQUFPLENBQUNvaUIsS0FBSyxLQUFBLElBQUEsR0FBQW9JLGNBQUEsR0FBSUMsY0FBYyxDQUFDckksS0FBSyxDQUFBO0lBQ25ELElBQUlBLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFDYixNQUFBLE1BQU1ybkIsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztBQUVsQjtNQUNBLElBQUlxbkIsS0FBSyxHQUFHVixlQUFlLEVBQUU7QUFBQSxRQUFBLElBQUFpSixjQUFBLENBQUE7QUFDekIsUUFBQSxNQUFNN0ssS0FBSyxHQUFBLENBQUE2SyxjQUFBLEdBQUczcUIsT0FBTyxDQUFDOGYsS0FBSyxLQUFBLElBQUEsR0FBQTZLLGNBQUEsR0FBSUYsY0FBYyxDQUFDM0ssS0FBSyxDQUFBO0FBQ25ELFFBQUEsTUFBTThCLENBQUMsR0FBRzlCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsQixRQUFBLE1BQU0rQixDQUFDLEdBQUcvQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEIsUUFBQSxNQUFNZ0MsQ0FBQyxHQUFHaEMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCLFFBQUEsTUFBTWlDLENBQUMsR0FBR2pDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUVsQixRQUFBLE1BQU04SyxDQUFDLEdBQUcsSUFBSSxDQUFDL04sVUFBVSxDQUFBO1FBQ3pCLElBQUsrRSxDQUFDLEtBQUtnSixDQUFDLENBQUNoSixDQUFDLElBQU1DLENBQUMsS0FBSytJLENBQUMsQ0FBQy9JLENBQUUsSUFBS0MsQ0FBQyxLQUFLOEksQ0FBQyxDQUFDOUksQ0FBRSxJQUFLQyxDQUFDLEtBQUs2SSxDQUFDLENBQUM3SSxDQUFFLEVBQUU7QUFDMUQsVUFBQSxJQUFJLENBQUNobkIsRUFBRSxDQUFDOGhCLFVBQVUsQ0FBQytFLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsQ0FBQyxDQUFBO0FBQzlCLFVBQUEsSUFBSSxDQUFDbEYsVUFBVSxDQUFDcEssR0FBRyxDQUFDbVAsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDbkMsU0FBQTtBQUVBLFFBQUEsSUFBSSxDQUFDbm9CLGFBQWEsQ0FBQ0MsVUFBVSxDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUMxQyxPQUFBO01BRUEsSUFBSXNvQixLQUFLLEdBQUdKLGVBQWUsRUFBRTtBQUFBLFFBQUEsSUFBQTZJLGNBQUEsQ0FBQTtBQUN6QjtBQUNBLFFBQUEsTUFBTXJzQixLQUFLLEdBQUEsQ0FBQXFzQixjQUFBLEdBQUc3cUIsT0FBTyxDQUFDeEIsS0FBSyxLQUFBLElBQUEsR0FBQXFzQixjQUFBLEdBQUlKLGNBQWMsQ0FBQ2pzQixLQUFLLENBQUE7QUFFbkQsUUFBQSxJQUFJQSxLQUFLLEtBQUssSUFBSSxDQUFDb2UsVUFBVSxFQUFFO0FBQzNCLFVBQUEsSUFBSSxDQUFDN2hCLEVBQUUsQ0FBQzZoQixVQUFVLENBQUNwZSxLQUFLLENBQUMsQ0FBQTtVQUN6QixJQUFJLENBQUNvZSxVQUFVLEdBQUdwZSxLQUFLLENBQUE7QUFDM0IsU0FBQTtBQUVBLFFBQUEsSUFBSSxDQUFDekUsYUFBYSxDQUFDQyxVQUFVLENBQUM4d0IsVUFBVSxDQUFDLENBQUE7QUFDN0MsT0FBQTtNQUVBLElBQUkxSSxLQUFLLEdBQUdGLGlCQUFpQixFQUFFO0FBQUEsUUFBQSxJQUFBNkksZ0JBQUEsQ0FBQTtBQUMzQjtBQUNBLFFBQUEsTUFBTW5aLE9BQU8sR0FBQSxDQUFBbVosZ0JBQUEsR0FBRy9xQixPQUFPLENBQUM0UixPQUFPLEtBQUEsSUFBQSxHQUFBbVosZ0JBQUEsR0FBSU4sY0FBYyxDQUFDN1ksT0FBTyxDQUFBO0FBQ3pELFFBQUEsSUFBSUEsT0FBTyxLQUFLLElBQUksQ0FBQ21MLFlBQVksRUFBRTtBQUMvQixVQUFBLElBQUksQ0FBQ2hpQixFQUFFLENBQUNnaUIsWUFBWSxDQUFDbkwsT0FBTyxDQUFDLENBQUE7VUFDN0IsSUFBSSxDQUFDbUwsWUFBWSxHQUFHbkwsT0FBTyxDQUFBO0FBQy9CLFNBQUE7QUFDSixPQUFBOztBQUVBO01BQ0E3VyxFQUFFLENBQUN3bUIsS0FBSyxDQUFDLElBQUksQ0FBQzdhLFdBQVcsQ0FBQzBiLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDckMsS0FBQTtBQUNKLEdBQUE7QUFFQTRJLEVBQUFBLE1BQU1BLEdBQUc7QUFDTCxJQUFBLElBQUksQ0FBQ2p3QixFQUFFLENBQUNrd0IsS0FBSyxFQUFFLENBQUE7QUFDbkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSTVyQixVQUFVQSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxFQUFFM2YsTUFBTSxFQUFFO0FBQzNCLElBQUEsTUFBTXBFLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQkEsRUFBRSxDQUFDc0UsVUFBVSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxFQUFFL2pCLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFZixFQUFFLENBQUNtTixhQUFhLEVBQUUvSSxNQUFNLENBQUMsQ0FBQTtBQUNoRSxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLE1BQU0rckIsZUFBZUEsQ0FBQzVyQixDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxFQUFFM2YsTUFBTSxFQUFFO0FBQUEsSUFBQSxJQUFBZ3NCLHFCQUFBLEVBQUFDLGVBQUEsRUFBQUMsa0JBQUEsQ0FBQTtBQUN0QyxJQUFBLE1BQU10d0IsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBRWxCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3FILFFBQVEsRUFBRTtBQUNoQjtBQUNBLE1BQUEsSUFBSSxDQUFDL0MsVUFBVSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWYsQ0FBQyxFQUFFM2YsTUFBTSxDQUFDLENBQUE7QUFDbkMsTUFBQSxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsTUFBTW1zQixlQUFlLEdBQUdBLENBQUNsSixLQUFLLEVBQUVtSixXQUFXLEtBQUs7TUFDNUMsTUFBTUMsSUFBSSxHQUFHendCLEVBQUUsQ0FBQzB3QixTQUFTLENBQUMxd0IsRUFBRSxDQUFDMndCLDBCQUEwQixFQUFFLENBQUMsQ0FBQyxDQUFBO01BQzNELElBQUksQ0FBQ1YsTUFBTSxFQUFFLENBQUE7QUFFYixNQUFBLE9BQU8sSUFBSVcsT0FBTyxDQUFDLENBQUN6YixPQUFPLEVBQUUwYixNQUFNLEtBQUs7UUFDcEMsU0FBU0MsSUFBSUEsR0FBRztVQUNaLE1BQU1DLEdBQUcsR0FBRy93QixFQUFFLENBQUNneEIsY0FBYyxDQUFDUCxJQUFJLEVBQUVwSixLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDN0MsVUFBQSxJQUFJMEosR0FBRyxLQUFLL3dCLEVBQUUsQ0FBQ2l4QixXQUFXLEVBQUU7QUFDeEJqeEIsWUFBQUEsRUFBRSxDQUFDa3hCLFVBQVUsQ0FBQ1QsSUFBSSxDQUFDLENBQUE7QUFDbkJJLFlBQUFBLE1BQU0sQ0FBQyxJQUFJenBCLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDLENBQUE7QUFDekQsV0FBQyxNQUFNLElBQUkycEIsR0FBRyxLQUFLL3dCLEVBQUUsQ0FBQ214QixlQUFlLEVBQUU7QUFDbkNDLFlBQUFBLFVBQVUsQ0FBQ04sSUFBSSxFQUFFTixXQUFXLENBQUMsQ0FBQTtBQUNqQyxXQUFDLE1BQU07QUFDSHh3QixZQUFBQSxFQUFFLENBQUNreEIsVUFBVSxDQUFDVCxJQUFJLENBQUMsQ0FBQTtBQUNuQnRiLFlBQUFBLE9BQU8sRUFBRSxDQUFBO0FBQ2IsV0FBQTtBQUNKLFNBQUE7QUFDQTJiLFFBQUFBLElBQUksRUFBRSxDQUFBO0FBQ1YsT0FBQyxDQUFDLENBQUE7S0FDTCxDQUFBO0FBRUQsSUFBQSxNQUFNNXNCLElBQUksR0FBQSxDQUFBa3NCLHFCQUFBLEdBQUcsSUFBSSxDQUFDNXhCLFlBQVksQ0FBQ2dGLFdBQVcsS0FBQSxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQTdCNHNCLHFCQUFBLENBQStCbHNCLElBQUksQ0FBQTtBQUNoRCxJQUFBLE1BQU10QixNQUFNLEdBQUEsQ0FBQXl0QixlQUFBLEdBQUduc0IsSUFBSSxJQUFKQSxJQUFBQSxHQUFBQSxLQUFBQSxDQUFBQSxHQUFBQSxJQUFJLENBQUVtdEIsU0FBUyxLQUFBaEIsSUFBQUEsR0FBQUEsZUFBQSxHQUFJcndCLEVBQUUsQ0FBQ2UsSUFBSSxDQUFBO0FBQ3pDLElBQUEsTUFBTXV3QixTQUFTLEdBQUEsQ0FBQWhCLGtCQUFBLEdBQUdwc0IsSUFBSSxJQUFKQSxJQUFBQSxHQUFBQSxLQUFBQSxDQUFBQSxHQUFBQSxJQUFJLENBQUVxdEIsWUFBWSxLQUFBakIsSUFBQUEsR0FBQUEsa0JBQUEsR0FBSXR3QixFQUFFLENBQUNtTixhQUFhLENBQUE7O0FBRXhEO0FBQ0EsSUFBQSxNQUFNcWtCLEdBQUcsR0FBR3h4QixFQUFFLENBQUN5eEIsWUFBWSxFQUFFLENBQUE7SUFDN0J6eEIsRUFBRSxDQUFDcXNCLFVBQVUsQ0FBQ3JzQixFQUFFLENBQUMweEIsaUJBQWlCLEVBQUVGLEdBQUcsQ0FBQyxDQUFBO0FBQ3hDeHhCLElBQUFBLEVBQUUsQ0FBQzJ4QixVQUFVLENBQUMzeEIsRUFBRSxDQUFDMHhCLGlCQUFpQixFQUFFdHRCLE1BQU0sQ0FBQ3d0QixVQUFVLEVBQUU1eEIsRUFBRSxDQUFDNnhCLFdBQVcsQ0FBQyxDQUFBO0FBQ3RFN3hCLElBQUFBLEVBQUUsQ0FBQ3NFLFVBQVUsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEVBQUVFLENBQUMsRUFBRXFmLENBQUMsRUFBRW5oQixNQUFNLEVBQUUwdUIsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBQy9DdHhCLEVBQUUsQ0FBQ3FzQixVQUFVLENBQUNyc0IsRUFBRSxDQUFDMHhCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFBOztBQUV6QztBQUNBLElBQUEsTUFBTW5CLGVBQWUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7O0FBRTVCO0lBQ0F2d0IsRUFBRSxDQUFDcXNCLFVBQVUsQ0FBQ3JzQixFQUFFLENBQUMweEIsaUJBQWlCLEVBQUVGLEdBQUcsQ0FBQyxDQUFBO0lBQ3hDeHhCLEVBQUUsQ0FBQzh4QixnQkFBZ0IsQ0FBQzl4QixFQUFFLENBQUMweEIsaUJBQWlCLEVBQUUsQ0FBQyxFQUFFdHRCLE1BQU0sQ0FBQyxDQUFBO0lBQ3BEcEUsRUFBRSxDQUFDcXNCLFVBQVUsQ0FBQ3JzQixFQUFFLENBQUMweEIsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDekMxeEIsSUFBQUEsRUFBRSxDQUFDK3hCLFlBQVksQ0FBQ1AsR0FBRyxDQUFDLENBQUE7QUFDeEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSVEsa0JBQWtCQSxDQUFDQyxLQUFLLEVBQUU7SUFDdEIsSUFBSSxJQUFJLENBQUMxcUIsUUFBUSxFQUFFLE9BQUE7QUFDbkIsSUFBQSxJQUFJLElBQUksQ0FBQ2dhLGVBQWUsS0FBSzBRLEtBQUssRUFBRSxPQUFBO0lBQ3BDLElBQUksQ0FBQzFRLGVBQWUsR0FBRzBRLEtBQUssQ0FBQTtBQUU1QixJQUFBLElBQUlBLEtBQUssRUFBRTtNQUNQLElBQUksQ0FBQ2p5QixFQUFFLENBQUM2ZixNQUFNLENBQUMsSUFBSSxDQUFDN2YsRUFBRSxDQUFDeWhCLHdCQUF3QixDQUFDLENBQUE7QUFDcEQsS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDemhCLEVBQUUsQ0FBQ3VmLE9BQU8sQ0FBQyxJQUFJLENBQUN2ZixFQUFFLENBQUN5aEIsd0JBQXdCLENBQUMsQ0FBQTtBQUNyRCxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJeVEsMEJBQTBCQSxDQUFDQyxFQUFFLEVBQUU7QUFDM0IsSUFBQSxJQUFJLElBQUksQ0FBQ2hQLHVCQUF1QixLQUFLZ1AsRUFBRSxFQUNuQyxPQUFBO0lBRUosSUFBSSxDQUFDaFAsdUJBQXVCLEdBQUdnUCxFQUFFLENBQUE7SUFFakMsSUFBSSxJQUFJLENBQUM5cUIsUUFBUSxFQUFFO0FBQ2YsTUFBQSxNQUFNckgsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBQ2xCLE1BQUEsSUFBSW15QixFQUFFLEVBQUU7QUFDSixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUM3YixRQUFRLEVBQUU7QUFDaEIsVUFBQSxJQUFJLENBQUNBLFFBQVEsR0FBR3RXLEVBQUUsQ0FBQ295Qix1QkFBdUIsRUFBRSxDQUFBO0FBQ2hELFNBQUE7UUFDQXB5QixFQUFFLENBQUNxeUIscUJBQXFCLENBQUNyeUIsRUFBRSxDQUFDc3lCLGtCQUFrQixFQUFFLElBQUksQ0FBQ2hjLFFBQVEsQ0FBQyxDQUFBO0FBQ2xFLE9BQUMsTUFBTTtRQUNIdFcsRUFBRSxDQUFDcXlCLHFCQUFxQixDQUFDcnlCLEVBQUUsQ0FBQ3N5QixrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6RCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsU0FBU0EsQ0FBQ0MsRUFBRSxFQUFFO0FBQ1YsSUFBQSxJQUFJLElBQUksQ0FBQ2hSLE1BQU0sS0FBS2dSLEVBQUUsRUFBRSxPQUFBO0lBRXhCLElBQUksQ0FBQ2hSLE1BQU0sR0FBR2dSLEVBQUUsQ0FBQTtJQUVoQixJQUFJLElBQUksQ0FBQ25yQixRQUFRLEVBQUU7QUFDZixNQUFBLElBQUltckIsRUFBRSxFQUFFO1FBQ0osSUFBSSxDQUFDeHlCLEVBQUUsQ0FBQ3VmLE9BQU8sQ0FBQyxJQUFJLENBQUN2ZixFQUFFLENBQUMwaEIsa0JBQWtCLENBQUMsQ0FBQTtBQUMvQyxPQUFDLE1BQU07UUFDSCxJQUFJLENBQUMxaEIsRUFBRSxDQUFDNmYsTUFBTSxDQUFDLElBQUksQ0FBQzdmLEVBQUUsQ0FBQzBoQixrQkFBa0IsQ0FBQyxDQUFBO0FBQzlDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtFQUVBK1EsY0FBY0EsQ0FBQzVTLE1BQU0sRUFBRTtBQUNuQixJQUFBLElBQUksSUFBSSxDQUFDaEosT0FBTyxLQUFLZ0osTUFBTSxFQUFFO0FBQ3pCLE1BQUEsTUFBTTdmLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixNQUFBLElBQUk2ZixNQUFNLEVBQUU7QUFDUjdmLFFBQUFBLEVBQUUsQ0FBQzZmLE1BQU0sQ0FBQzdmLEVBQUUsQ0FBQ21nQixZQUFZLENBQUMsQ0FBQTtBQUM5QixPQUFDLE1BQU07QUFDSG5nQixRQUFBQSxFQUFFLENBQUN1ZixPQUFPLENBQUN2ZixFQUFFLENBQUNtZ0IsWUFBWSxDQUFDLENBQUE7QUFDL0IsT0FBQTtNQUNBLElBQUksQ0FBQ3RKLE9BQU8sR0FBR2dKLE1BQU0sQ0FBQTtBQUN6QixLQUFBO0FBQ0osR0FBQTtBQUVBNlMsRUFBQUEsY0FBY0EsQ0FBQ0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLElBQUksRUFBRTtBQUM1QixJQUFBLElBQUksSUFBSSxDQUFDelMsZ0JBQWdCLEtBQUt1UyxJQUFJLElBQUksSUFBSSxDQUFDcFMsZUFBZSxLQUFLcVMsR0FBRyxJQUFJLElBQUksQ0FBQ25TLGdCQUFnQixLQUFLb1MsSUFBSSxJQUNoRyxJQUFJLENBQUN4UyxlQUFlLEtBQUtzUyxJQUFJLElBQUksSUFBSSxDQUFDblMsY0FBYyxLQUFLb1MsR0FBRyxJQUFJLElBQUksQ0FBQ2xTLGVBQWUsS0FBS21TLElBQUksRUFBRTtBQUMvRixNQUFBLElBQUksQ0FBQzd5QixFQUFFLENBQUMyZ0IsV0FBVyxDQUFDLElBQUksQ0FBQ2pXLFlBQVksQ0FBQ2lvQixJQUFJLENBQUMsRUFBRUMsR0FBRyxFQUFFQyxJQUFJLENBQUMsQ0FBQTtBQUN2RCxNQUFBLElBQUksQ0FBQ3pTLGdCQUFnQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHc1MsSUFBSSxDQUFBO0FBQ25ELE1BQUEsSUFBSSxDQUFDcFMsZUFBZSxHQUFHLElBQUksQ0FBQ0MsY0FBYyxHQUFHb1MsR0FBRyxDQUFBO0FBQ2hELE1BQUEsSUFBSSxDQUFDblMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDQyxlQUFlLEdBQUdtUyxJQUFJLENBQUE7QUFDdkQsS0FBQTtBQUNKLEdBQUE7QUFFQUMsRUFBQUEsbUJBQW1CQSxDQUFDSCxJQUFJLEVBQUVDLEdBQUcsRUFBRUMsSUFBSSxFQUFFO0FBQ2pDLElBQUEsSUFBSSxJQUFJLENBQUN6UyxnQkFBZ0IsS0FBS3VTLElBQUksSUFBSSxJQUFJLENBQUNwUyxlQUFlLEtBQUtxUyxHQUFHLElBQUksSUFBSSxDQUFDblMsZ0JBQWdCLEtBQUtvUyxJQUFJLEVBQUU7QUFDbEcsTUFBQSxNQUFNN3lCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQkEsTUFBQUEsRUFBRSxDQUFDK3lCLG1CQUFtQixDQUFDL3lCLEVBQUUsQ0FBQ2lNLEtBQUssRUFBRSxJQUFJLENBQUN2QixZQUFZLENBQUNpb0IsSUFBSSxDQUFDLEVBQUVDLEdBQUcsRUFBRUMsSUFBSSxDQUFDLENBQUE7TUFDcEUsSUFBSSxDQUFDelMsZ0JBQWdCLEdBQUd1UyxJQUFJLENBQUE7TUFDNUIsSUFBSSxDQUFDcFMsZUFBZSxHQUFHcVMsR0FBRyxDQUFBO01BQzFCLElBQUksQ0FBQ25TLGdCQUFnQixHQUFHb1MsSUFBSSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBO0FBRUFHLEVBQUFBLGtCQUFrQkEsQ0FBQ0wsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLElBQUksRUFBRTtBQUNoQyxJQUFBLElBQUksSUFBSSxDQUFDeFMsZUFBZSxLQUFLc1MsSUFBSSxJQUFJLElBQUksQ0FBQ25TLGNBQWMsS0FBS29TLEdBQUcsSUFBSSxJQUFJLENBQUNsUyxlQUFlLEtBQUttUyxJQUFJLEVBQUU7QUFDL0YsTUFBQSxNQUFNN3lCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQkEsTUFBQUEsRUFBRSxDQUFDK3lCLG1CQUFtQixDQUFDL3lCLEVBQUUsQ0FBQ2dNLElBQUksRUFBRSxJQUFJLENBQUN0QixZQUFZLENBQUNpb0IsSUFBSSxDQUFDLEVBQUVDLEdBQUcsRUFBRUMsSUFBSSxDQUFDLENBQUE7TUFDbkUsSUFBSSxDQUFDeFMsZUFBZSxHQUFHc1MsSUFBSSxDQUFBO01BQzNCLElBQUksQ0FBQ25TLGNBQWMsR0FBR29TLEdBQUcsQ0FBQTtNQUN6QixJQUFJLENBQUNsUyxlQUFlLEdBQUdtUyxJQUFJLENBQUE7QUFDL0IsS0FBQTtBQUNKLEdBQUE7RUFFQUksbUJBQW1CQSxDQUFDQyxJQUFJLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxTQUFTLEVBQUU7QUFDL0MsSUFBQSxJQUFJLElBQUksQ0FBQ3pTLGdCQUFnQixLQUFLc1MsSUFBSSxJQUFJLElBQUksQ0FBQ25TLGlCQUFpQixLQUFLb1MsS0FBSyxJQUFJLElBQUksQ0FBQ2xTLGlCQUFpQixLQUFLbVMsS0FBSyxJQUN0RyxJQUFJLENBQUN2UyxlQUFlLEtBQUtxUyxJQUFJLElBQUksSUFBSSxDQUFDbFMsZ0JBQWdCLEtBQUttUyxLQUFLLElBQUksSUFBSSxDQUFDalMsZ0JBQWdCLEtBQUtrUyxLQUFLLEVBQUU7TUFDckcsSUFBSSxDQUFDcHpCLEVBQUUsQ0FBQ3FoQixTQUFTLENBQUMsSUFBSSxDQUFDbFcsV0FBVyxDQUFDK25CLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQy9uQixXQUFXLENBQUNnb0IsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDaG9CLFdBQVcsQ0FBQ2lvQixLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQzNGLE1BQUEsSUFBSSxDQUFDeFMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDQyxlQUFlLEdBQUdxUyxJQUFJLENBQUE7QUFDbkQsTUFBQSxJQUFJLENBQUNuUyxpQkFBaUIsR0FBRyxJQUFJLENBQUNDLGdCQUFnQixHQUFHbVMsS0FBSyxDQUFBO0FBQ3RELE1BQUEsSUFBSSxDQUFDbFMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBR2tTLEtBQUssQ0FBQTtBQUMxRCxLQUFBO0lBQ0EsSUFBSSxJQUFJLENBQUNqUyxxQkFBcUIsS0FBS2tTLFNBQVMsSUFBSSxJQUFJLENBQUNqUyxvQkFBb0IsS0FBS2lTLFNBQVMsRUFBRTtBQUNyRixNQUFBLElBQUksQ0FBQ3J6QixFQUFFLENBQUNzaEIsV0FBVyxDQUFDK1IsU0FBUyxDQUFDLENBQUE7TUFDOUIsSUFBSSxDQUFDbFMscUJBQXFCLEdBQUdrUyxTQUFTLENBQUE7TUFDdEMsSUFBSSxDQUFDalMsb0JBQW9CLEdBQUdpUyxTQUFTLENBQUE7QUFDekMsS0FBQTtBQUNKLEdBQUE7RUFFQUMsd0JBQXdCQSxDQUFDSixJQUFJLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxTQUFTLEVBQUU7QUFDcEQsSUFBQSxJQUFJLElBQUksQ0FBQ3pTLGdCQUFnQixLQUFLc1MsSUFBSSxJQUFJLElBQUksQ0FBQ25TLGlCQUFpQixLQUFLb1MsS0FBSyxJQUFJLElBQUksQ0FBQ2xTLGlCQUFpQixLQUFLbVMsS0FBSyxFQUFFO0FBQ3hHLE1BQUEsSUFBSSxDQUFDcHpCLEVBQUUsQ0FBQ3V6QixpQkFBaUIsQ0FBQyxJQUFJLENBQUN2ekIsRUFBRSxDQUFDaU0sS0FBSyxFQUFFLElBQUksQ0FBQ2QsV0FBVyxDQUFDK25CLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQy9uQixXQUFXLENBQUNnb0IsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDaG9CLFdBQVcsQ0FBQ2lvQixLQUFLLENBQUMsQ0FBQyxDQUFBO01BQ2xILElBQUksQ0FBQ3hTLGdCQUFnQixHQUFHc1MsSUFBSSxDQUFBO01BQzVCLElBQUksQ0FBQ25TLGlCQUFpQixHQUFHb1MsS0FBSyxDQUFBO01BQzlCLElBQUksQ0FBQ2xTLGlCQUFpQixHQUFHbVMsS0FBSyxDQUFBO0FBQ2xDLEtBQUE7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDalMscUJBQXFCLEtBQUtrUyxTQUFTLEVBQUU7QUFDMUMsTUFBQSxJQUFJLENBQUNyekIsRUFBRSxDQUFDd3pCLG1CQUFtQixDQUFDLElBQUksQ0FBQ3h6QixFQUFFLENBQUNpTSxLQUFLLEVBQUVvbkIsU0FBUyxDQUFDLENBQUE7TUFDckQsSUFBSSxDQUFDbFMscUJBQXFCLEdBQUdrUyxTQUFTLENBQUE7QUFDMUMsS0FBQTtBQUNKLEdBQUE7RUFFQUksdUJBQXVCQSxDQUFDUCxJQUFJLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxTQUFTLEVBQUU7QUFDbkQsSUFBQSxJQUFJLElBQUksQ0FBQ3hTLGVBQWUsS0FBS3FTLElBQUksSUFBSSxJQUFJLENBQUNsUyxnQkFBZ0IsS0FBS21TLEtBQUssSUFBSSxJQUFJLENBQUNqUyxnQkFBZ0IsS0FBS2tTLEtBQUssRUFBRTtBQUNyRyxNQUFBLElBQUksQ0FBQ3B6QixFQUFFLENBQUN1ekIsaUJBQWlCLENBQUMsSUFBSSxDQUFDdnpCLEVBQUUsQ0FBQ2dNLElBQUksRUFBRSxJQUFJLENBQUNiLFdBQVcsQ0FBQytuQixJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMvbkIsV0FBVyxDQUFDZ29CLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQ2hvQixXQUFXLENBQUNpb0IsS0FBSyxDQUFDLENBQUMsQ0FBQTtNQUNqSCxJQUFJLENBQUN2UyxlQUFlLEdBQUdxUyxJQUFJLENBQUE7TUFDM0IsSUFBSSxDQUFDbFMsZ0JBQWdCLEdBQUdtUyxLQUFLLENBQUE7TUFDN0IsSUFBSSxDQUFDalMsZ0JBQWdCLEdBQUdrUyxLQUFLLENBQUE7QUFDakMsS0FBQTtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUNoUyxvQkFBb0IsS0FBS2lTLFNBQVMsRUFBRTtBQUN6QyxNQUFBLElBQUksQ0FBQ3J6QixFQUFFLENBQUN3ekIsbUJBQW1CLENBQUMsSUFBSSxDQUFDeHpCLEVBQUUsQ0FBQ2dNLElBQUksRUFBRXFuQixTQUFTLENBQUMsQ0FBQTtNQUNwRCxJQUFJLENBQUNqUyxvQkFBb0IsR0FBR2lTLFNBQVMsQ0FBQTtBQUN6QyxLQUFBO0FBQ0osR0FBQTtFQUVBeDBCLGFBQWFBLENBQUM2MEIsVUFBVSxFQUFFO0FBQ3RCLElBQUEsTUFBTUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDRCxVQUFVLENBQUE7QUFDekMsSUFBQSxJQUFJLENBQUNDLGlCQUFpQixDQUFDQyxNQUFNLENBQUNGLFVBQVUsQ0FBQyxFQUFFO0FBQ3ZDLE1BQUEsTUFBTTF6QixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7O0FBRWxCO01BQ0EsTUFBTTtRQUFFNnpCLEtBQUs7UUFBRUMsT0FBTztRQUFFQyxPQUFPO1FBQUVDLGNBQWM7UUFBRUMsY0FBYztRQUFFQyxjQUFjO0FBQUVDLFFBQUFBLGNBQUFBO0FBQWUsT0FBQyxHQUFHVCxVQUFVLENBQUE7O0FBRTlHO0FBQ0EsTUFBQSxJQUFJQyxpQkFBaUIsQ0FBQ0UsS0FBSyxLQUFLQSxLQUFLLEVBQUU7QUFDbkMsUUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUDd6QixVQUFBQSxFQUFFLENBQUM2ZixNQUFNLENBQUM3ZixFQUFFLENBQUN3ZixLQUFLLENBQUMsQ0FBQTtBQUN2QixTQUFDLE1BQU07QUFDSHhmLFVBQUFBLEVBQUUsQ0FBQ3VmLE9BQU8sQ0FBQ3ZmLEVBQUUsQ0FBQ3dmLEtBQUssQ0FBQyxDQUFBO0FBQ3hCLFNBQUE7QUFDSixPQUFBOztBQUVBO01BQ0EsSUFBSW1VLGlCQUFpQixDQUFDRyxPQUFPLEtBQUtBLE9BQU8sSUFBSUgsaUJBQWlCLENBQUNJLE9BQU8sS0FBS0EsT0FBTyxFQUFFO0FBQ2hGLFFBQUEsTUFBTS9xQixlQUFlLEdBQUcsSUFBSSxDQUFDQSxlQUFlLENBQUE7QUFDNUNoSixRQUFBQSxFQUFFLENBQUNvMEIscUJBQXFCLENBQUNwckIsZUFBZSxDQUFDOHFCLE9BQU8sQ0FBQyxFQUFFOXFCLGVBQWUsQ0FBQytxQixPQUFPLENBQUMsQ0FBQyxDQUFBO0FBQ2hGLE9BQUE7O0FBRUE7TUFDQSxJQUFJSixpQkFBaUIsQ0FBQ0ssY0FBYyxLQUFLQSxjQUFjLElBQUlMLGlCQUFpQixDQUFDTSxjQUFjLEtBQUtBLGNBQWMsSUFDMUdOLGlCQUFpQixDQUFDTyxjQUFjLEtBQUtBLGNBQWMsSUFBSVAsaUJBQWlCLENBQUNRLGNBQWMsS0FBS0EsY0FBYyxFQUFFO0FBRTVHbjBCLFFBQUFBLEVBQUUsQ0FBQ3EwQixpQkFBaUIsQ0FBQyxJQUFJLENBQUM1cUIsb0JBQW9CLENBQUN1cUIsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDdnFCLG9CQUFvQixDQUFDd3FCLGNBQWMsQ0FBQyxFQUNwRixJQUFJLENBQUMxcEIsb0JBQW9CLENBQUMycEIsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDM3BCLG9CQUFvQixDQUFDNHBCLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDOUcsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSVIsaUJBQWlCLENBQUNXLFFBQVEsS0FBS1osVUFBVSxDQUFDWSxRQUFRLEVBQUU7UUFDcEQsSUFBSSxDQUFDdDBCLEVBQUUsQ0FBQzJmLFNBQVMsQ0FBQytULFVBQVUsQ0FBQ2EsUUFBUSxFQUFFYixVQUFVLENBQUNjLFVBQVUsRUFBRWQsVUFBVSxDQUFDZSxTQUFTLEVBQUVmLFVBQVUsQ0FBQ2dCLFVBQVUsQ0FBQyxDQUFBO0FBQzlHLE9BQUE7O0FBRUE7QUFDQWYsTUFBQUEsaUJBQWlCLENBQUNnQixJQUFJLENBQUNqQixVQUFVLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWtCLGFBQWFBLENBQUMvTixDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7QUFDdEIsSUFBQSxNQUFNNkksQ0FBQyxHQUFHLElBQUksQ0FBQ2pRLFVBQVUsQ0FBQTtJQUN6QixJQUFLaUgsQ0FBQyxLQUFLZ0osQ0FBQyxDQUFDaEosQ0FBQyxJQUFNQyxDQUFDLEtBQUsrSSxDQUFDLENBQUMvSSxDQUFFLElBQUtDLENBQUMsS0FBSzhJLENBQUMsQ0FBQzlJLENBQUUsSUFBS0MsQ0FBQyxLQUFLNkksQ0FBQyxDQUFDN0ksQ0FBRSxFQUFFO0FBQzFELE1BQUEsSUFBSSxDQUFDaG5CLEVBQUUsQ0FBQzRmLFVBQVUsQ0FBQ2lILENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsQ0FBQyxDQUFBO01BQzlCNkksQ0FBQyxDQUFDblksR0FBRyxDQUFDbVAsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDckIsS0FBQTtBQUNKLEdBQUE7QUFFQTduQixFQUFBQSxlQUFlQSxDQUFDMDFCLFlBQVksRUFBRUMsV0FBVyxFQUFFO0lBQ3ZDLElBQUlELFlBQVksSUFBSUMsV0FBVyxFQUFFO0FBQzdCLE1BQUEsSUFBSSxDQUFDckMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO01BQ3pCLElBQUlvQyxZQUFZLEtBQUtDLFdBQVcsRUFBRTtBQUU5QjtBQUNBLFFBQUEsSUFBSSxDQUFDcEMsY0FBYyxDQUFDbUMsWUFBWSxDQUFDbEMsSUFBSSxFQUFFa0MsWUFBWSxDQUFDakMsR0FBRyxFQUFFaUMsWUFBWSxDQUFDRSxRQUFRLENBQUMsQ0FBQTtBQUMvRSxRQUFBLElBQUksQ0FBQzlCLG1CQUFtQixDQUFDNEIsWUFBWSxDQUFDM0IsSUFBSSxFQUFFMkIsWUFBWSxDQUFDMUIsS0FBSyxFQUFFMEIsWUFBWSxDQUFDekIsS0FBSyxFQUFFeUIsWUFBWSxDQUFDeEIsU0FBUyxDQUFDLENBQUE7QUFFL0csT0FBQyxNQUFNO1FBQUEsSUFBQTJCLGFBQUEsRUFBQUMsWUFBQSxDQUFBO0FBRUg7UUFDQSxDQUFBRCxhQUFBLEdBQUFILFlBQVksS0FBQUcsSUFBQUEsR0FBQUEsYUFBQSxHQUFaSCxZQUFZLEdBQUtLLGlCQUFpQixDQUFDQyxPQUFPLENBQUE7QUFDMUMsUUFBQSxJQUFJLENBQUNyQyxtQkFBbUIsQ0FBQytCLFlBQVksQ0FBQ2xDLElBQUksRUFBRWtDLFlBQVksQ0FBQ2pDLEdBQUcsRUFBRWlDLFlBQVksQ0FBQ0UsUUFBUSxDQUFDLENBQUE7QUFDcEYsUUFBQSxJQUFJLENBQUN6Qix3QkFBd0IsQ0FBQ3VCLFlBQVksQ0FBQzNCLElBQUksRUFBRTJCLFlBQVksQ0FBQzFCLEtBQUssRUFBRTBCLFlBQVksQ0FBQ3pCLEtBQUssRUFBRXlCLFlBQVksQ0FBQ3hCLFNBQVMsQ0FBQyxDQUFBOztBQUVoSDtRQUNBLENBQUE0QixZQUFBLEdBQUFILFdBQVcsS0FBQUcsSUFBQUEsR0FBQUEsWUFBQSxHQUFYSCxXQUFXLEdBQUtJLGlCQUFpQixDQUFDQyxPQUFPLENBQUE7QUFDekMsUUFBQSxJQUFJLENBQUNuQyxrQkFBa0IsQ0FBQzhCLFdBQVcsQ0FBQ25DLElBQUksRUFBRW1DLFdBQVcsQ0FBQ2xDLEdBQUcsRUFBRWtDLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDLENBQUE7QUFDaEYsUUFBQSxJQUFJLENBQUN0Qix1QkFBdUIsQ0FBQ3FCLFdBQVcsQ0FBQzVCLElBQUksRUFBRTRCLFdBQVcsQ0FBQzNCLEtBQUssRUFBRTJCLFdBQVcsQ0FBQzFCLEtBQUssRUFBRTBCLFdBQVcsQ0FBQ3pCLFNBQVMsQ0FBQyxDQUFBO0FBQy9HLE9BQUE7QUFDSixLQUFDLE1BQU07QUFDSCxNQUFBLElBQUksQ0FBQ1osY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0VBRUF6ekIsYUFBYUEsQ0FBQ28yQixVQUFVLEVBQUU7QUFDdEIsSUFBQSxNQUFNQyxpQkFBaUIsR0FBRyxJQUFJLENBQUNELFVBQVUsQ0FBQTtBQUN6QyxJQUFBLElBQUksQ0FBQ0MsaUJBQWlCLENBQUN6QixNQUFNLENBQUN3QixVQUFVLENBQUMsRUFBRTtBQUN2QyxNQUFBLE1BQU1wMUIsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztBQUVsQjtBQUNBLE1BQUEsTUFBTXMxQixLQUFLLEdBQUdGLFVBQVUsQ0FBQ0UsS0FBSyxDQUFBO0FBQzlCLE1BQUEsSUFBSUQsaUJBQWlCLENBQUNDLEtBQUssS0FBS0EsS0FBSyxFQUFFO0FBQ25DdDFCLFFBQUFBLEVBQUUsQ0FBQ2tnQixTQUFTLENBQUNvVixLQUFLLENBQUMsQ0FBQTtBQUN2QixPQUFBOztBQUVBO0FBQ0E7TUFDQSxJQUFJO1FBQUUzQyxJQUFJO0FBQUU3QixRQUFBQSxJQUFBQTtBQUFLLE9BQUMsR0FBR3NFLFVBQVUsQ0FBQTtBQUMvQixNQUFBLElBQUksQ0FBQ3RFLElBQUksSUFBSXdFLEtBQUssRUFBRTtBQUNoQnhFLFFBQUFBLElBQUksR0FBRyxJQUFJLENBQUE7QUFDWDZCLFFBQUFBLElBQUksR0FBR3JTLFdBQVcsQ0FBQTtBQUN0QixPQUFBO0FBRUEsTUFBQSxJQUFJK1UsaUJBQWlCLENBQUMxQyxJQUFJLEtBQUtBLElBQUksRUFBRTtRQUNqQzN5QixFQUFFLENBQUNpZ0IsU0FBUyxDQUFDLElBQUksQ0FBQ3ZWLFlBQVksQ0FBQ2lvQixJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ3pDLE9BQUE7QUFFQSxNQUFBLElBQUkwQyxpQkFBaUIsQ0FBQ3ZFLElBQUksS0FBS0EsSUFBSSxFQUFFO0FBQ2pDLFFBQUEsSUFBSUEsSUFBSSxFQUFFO0FBQ045d0IsVUFBQUEsRUFBRSxDQUFDNmYsTUFBTSxDQUFDN2YsRUFBRSxDQUFDZ2dCLFVBQVUsQ0FBQyxDQUFBO0FBQzVCLFNBQUMsTUFBTTtBQUNIaGdCLFVBQUFBLEVBQUUsQ0FBQ3VmLE9BQU8sQ0FBQ3ZmLEVBQUUsQ0FBQ2dnQixVQUFVLENBQUMsQ0FBQTtBQUM3QixTQUFBO0FBQ0osT0FBQTs7QUFFQTtNQUNBLE1BQU07UUFBRXVWLFNBQVM7QUFBRUMsUUFBQUEsY0FBQUE7QUFBZSxPQUFDLEdBQUdKLFVBQVUsQ0FBQTtNQUNoRCxJQUFJRyxTQUFTLElBQUlDLGNBQWMsRUFBRTtBQUU3QjtBQUNBLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQzdULGdCQUFnQixFQUFFO1VBQ3hCLElBQUksQ0FBQ0EsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO1VBQzVCLElBQUksQ0FBQzNoQixFQUFFLENBQUM2ZixNQUFNLENBQUMsSUFBSSxDQUFDN2YsRUFBRSxDQUFDNGhCLG1CQUFtQixDQUFDLENBQUE7QUFDL0MsU0FBQTs7QUFFQTtBQUNBNWhCLFFBQUFBLEVBQUUsQ0FBQ3kxQixhQUFhLENBQUNELGNBQWMsRUFBRUQsU0FBUyxDQUFDLENBQUE7QUFFL0MsT0FBQyxNQUFNO0FBRUg7UUFDQSxJQUFJLElBQUksQ0FBQzVULGdCQUFnQixFQUFFO1VBQ3ZCLElBQUksQ0FBQ0EsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO1VBQzdCLElBQUksQ0FBQzNoQixFQUFFLENBQUN1ZixPQUFPLENBQUMsSUFBSSxDQUFDdmYsRUFBRSxDQUFDNGhCLG1CQUFtQixDQUFDLENBQUE7QUFDaEQsU0FBQTtBQUNKLE9BQUE7O0FBRUE7QUFDQXlULE1BQUFBLGlCQUFpQixDQUFDVixJQUFJLENBQUNTLFVBQVUsQ0FBQyxDQUFBO0FBQ3RDLEtBQUE7QUFDSixHQUFBO0VBRUF6MkIsV0FBV0EsQ0FBQysyQixRQUFRLEVBQUU7QUFDbEIsSUFBQSxJQUFJLElBQUksQ0FBQ0EsUUFBUSxLQUFLQSxRQUFRLEVBQUU7TUFDNUIsSUFBSUEsUUFBUSxLQUFLOTJCLGFBQWEsRUFBRTtRQUM1QixJQUFJLENBQUNvQixFQUFFLENBQUN1ZixPQUFPLENBQUMsSUFBSSxDQUFDdmYsRUFBRSxDQUFDOGYsU0FBUyxDQUFDLENBQUE7QUFDdEMsT0FBQyxNQUFNO0FBQ0gsUUFBQSxJQUFJLElBQUksQ0FBQzRWLFFBQVEsS0FBSzkyQixhQUFhLEVBQUU7VUFDakMsSUFBSSxDQUFDb0IsRUFBRSxDQUFDNmYsTUFBTSxDQUFDLElBQUksQ0FBQzdmLEVBQUUsQ0FBQzhmLFNBQVMsQ0FBQyxDQUFBO0FBQ3JDLFNBQUE7QUFFQSxRQUFBLE1BQU1rUCxJQUFJLEdBQUcsSUFBSSxDQUFDampCLE1BQU0sQ0FBQzJwQixRQUFRLENBQUMsQ0FBQTtBQUNsQyxRQUFBLElBQUksSUFBSSxDQUFDM1YsUUFBUSxLQUFLaVAsSUFBSSxFQUFFO0FBQ3hCLFVBQUEsSUFBSSxDQUFDaHZCLEVBQUUsQ0FBQytmLFFBQVEsQ0FBQ2lQLElBQUksQ0FBQyxDQUFBO1VBQ3RCLElBQUksQ0FBQ2pQLFFBQVEsR0FBR2lQLElBQUksQ0FBQTtBQUN4QixTQUFBO0FBQ0osT0FBQTtNQUNBLElBQUksQ0FBQzBHLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJcDJCLFNBQVNBLENBQUNsQixNQUFNLEVBQUU7QUFDZCxJQUFBLElBQUlBLE1BQU0sS0FBSyxJQUFJLENBQUNBLE1BQU0sRUFBRTtNQUN4QixJQUFJQSxNQUFNLENBQUN1M0IsTUFBTSxFQUFFO0FBQ2YsUUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixPQUFDLE1BQU0sSUFBSSxDQUFDdjNCLE1BQU0sQ0FBQ3czQixLQUFLLElBQUksQ0FBQ3gzQixNQUFNLENBQUM4RixJQUFJLENBQUMyeEIsUUFBUSxDQUFDLElBQUksRUFBRXozQixNQUFNLENBQUMsRUFBRTtRQUM3REEsTUFBTSxDQUFDdTNCLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDcEIsUUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixPQUFBO01BRUEsSUFBSSxDQUFDdjNCLE1BQU0sR0FBR0EsTUFBTSxDQUFBOztBQUVwQjtNQUNBLElBQUksQ0FBQzRCLEVBQUUsQ0FBQzgxQixVQUFVLENBQUMxM0IsTUFBTSxDQUFDOEYsSUFBSSxDQUFDNnhCLFNBQVMsQ0FBQyxDQUFBO01BR3pDLElBQUksQ0FBQ0MsdUJBQXVCLEVBQUUsQ0FBQTtNQUc5QixJQUFJLENBQUNDLHFCQUFxQixHQUFHLElBQUksQ0FBQTtBQUNyQyxLQUFBO0FBQ0EsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJemYsRUFBQUEsMkJBQTJCQSxHQUFHO0FBQzFCLElBQUEsTUFBTXhXLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQixJQUFJLENBQUNnakIsT0FBTyxDQUFDa1QsT0FBTyxDQUFDLENBQUNDLElBQUksRUFBRXBLLEdBQUcsRUFBRXFLLE1BQU0sS0FBSztBQUN4Q3AyQixNQUFBQSxFQUFFLENBQUMwYixpQkFBaUIsQ0FBQ3lhLElBQUksQ0FBQyxDQUFBO0FBQzlCLEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxJQUFJLENBQUNuVCxPQUFPLENBQUN3RCxLQUFLLEVBQUUsQ0FBQTtBQUN4QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJNlAsVUFBVUEsQ0FBQ0EsVUFBVSxFQUFFO0FBQ3ZCLElBQUEsSUFBSUEsVUFBVSxFQUFFO0FBQ1osTUFBQSxNQUFNcnhCLE1BQU0sR0FBRyxJQUFJLENBQUNoRixFQUFFLENBQUNnRixNQUFNLENBQUE7TUFDN0JBLE1BQU0sQ0FBQ3N4QixpQkFBaUIsRUFBRSxDQUFBO0FBQzlCLEtBQUMsTUFBTTtNQUNIQyxRQUFRLENBQUNDLGNBQWMsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUgsVUFBVUEsR0FBRztBQUNiLElBQUEsT0FBTyxDQUFDLENBQUNFLFFBQVEsQ0FBQ0UsaUJBQWlCLENBQUE7QUFDdkMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMseUJBQXlCQSxHQUFHO0FBQzVCLElBQUEsSUFBSSxJQUFJLENBQUM5Z0IsMEJBQTBCLEtBQUs3TyxTQUFTLEVBQUU7QUFDL0MsTUFBQSxJQUFJLENBQUM2TywwQkFBMEIsR0FBRzNULDZCQUE2QixDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3pFLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQzJULDBCQUEwQixDQUFBO0FBQzFDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlHLHlCQUF5QkEsR0FBRztBQUM1QixJQUFBLElBQUksSUFBSSxDQUFDRiwwQkFBMEIsS0FBSzlPLFNBQVMsRUFBRTtNQUMvQyxJQUFJLElBQUksQ0FBQ00sUUFBUSxFQUFFO1FBQ2YsSUFBSSxDQUFDd08sMEJBQTBCLEdBQUcsSUFBSSxDQUFBO0FBQzFDLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDQSwwQkFBMEIsR0FBR25VLDZCQUE2QixDQUFDLElBQUksQ0FBQzFCLEVBQUUsRUFBRSxJQUFJLENBQUN1VixtQkFBbUIsQ0FBQ0MsY0FBYyxDQUFDLENBQUE7QUFDckgsT0FBQTtBQUNKLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ0ssMEJBQTBCLENBQUE7QUFDMUMsR0FBQTs7QUFHQTtBQUNBOGdCLEVBQUFBLGdCQUFnQkEsQ0FBQ0MsS0FBSyxHQUFHLEdBQUcsRUFBRTtJQUMxQixNQUFNQyxPQUFPLEdBQUcsSUFBSSxDQUFDNzJCLEVBQUUsQ0FBQzZaLFlBQVksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0lBQzFEZ2QsT0FBTyxDQUFDanhCLFdBQVcsRUFBRSxDQUFBO0lBQ3JCd3JCLFVBQVUsQ0FBQyxNQUFNeUYsT0FBTyxDQUFDN3dCLGNBQWMsRUFBRSxFQUFFNHdCLEtBQUssQ0FBQyxDQUFBO0FBQ3JELEdBQUE7QUFFSjs7OzsifQ==
