import { version, revision } from '../core/core.js';
import { string } from '../core/string.js';
import { now } from '../core/time.js';
import { Debug } from '../core/debug.js';
import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';
import { Frustum } from '../core/shape/frustum.js';
import { Plane } from '../core/shape/plane.js';
import { TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA, BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../platform/graphics/constants.js';
import { ShaderGenerator } from '../scene/shader-lib/programs/shader-generator.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';
import { shaderChunks } from '../scene/shader-lib/chunks/chunks.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { PostEffect } from '../scene/graphics/post-effect.js';
import { PostEffectQueue } from '../framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { getProgramLibrary, setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { ScopeId } from '../platform/graphics/scope-id.js';
import { Shader } from '../platform/graphics/shader.js';
import { WebglShaderInput } from '../platform/graphics/webgl/webgl-shader-input.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { ShaderUtils } from '../platform/graphics/shader-utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';
import { DepthState } from '../platform/graphics/depth-state.js';
import { LAYERID_WORLD, LAYERID_IMMEDIATE, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../scene/constants.js';
import { calculateTangents, createMesh, createTorus, createCylinder, createCapsule, createCone, createSphere, createPlane, createBox } from '../scene/procedural.js';
import { partitionSkin } from '../scene/skin-partition.js';
import { BasicMaterial } from '../scene/materials/basic-material.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { Material } from '../scene/materials/material.js';
import { Mesh } from '../scene/mesh.js';
import { Morph } from '../scene/morph.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { Model } from '../scene/model.js';
import { ParticleEmitter } from '../scene/particle-system/particle-emitter.js';
import { Picker } from '../framework/graphics/picker.js';
import { Scene } from '../scene/scene.js';
import { Skin } from '../scene/skin.js';
import { SkinInstance } from '../scene/skin-instance.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { Batch } from '../scene/batching/batch.js';
import { getDefaultMaterial } from '../scene/materials/default-material.js';
import { StandardMaterialOptions } from '../scene/materials/standard-material-options.js';
import { LitShaderOptions } from '../scene/shader-lib/programs/lit-shader-options.js';
import { Layer } from '../scene/layer.js';
import { Animation, Key, Node } from '../scene/animation/animation.js';
import { Skeleton } from '../scene/animation/skeleton.js';
import { Channel } from '../platform/audio/channel.js';
import { Channel3d } from '../platform/audio/channel3d.js';
import { Listener } from '../platform/sound/listener.js';
import { Sound } from '../platform/sound/sound.js';
import { SoundManager } from '../platform/sound/manager.js';
import { AssetRegistry } from '../framework/asset/asset-registry.js';
import { XrInputSource } from '../framework/xr/xr-input-source.js';
import { Controller } from '../platform/input/controller.js';
import { ElementInput } from '../framework/input/element-input.js';
import { GamePads } from '../platform/input/game-pads.js';
import { Keyboard } from '../platform/input/keyboard.js';
import { KeyboardEvent } from '../platform/input/keyboard-event.js';
import { Mouse } from '../platform/input/mouse.js';
import { MouseEvent } from '../platform/input/mouse-event.js';
import { TouchDevice } from '../platform/input/touch-device.js';
import { getTouchTargetCoords, Touch, TouchEvent } from '../platform/input/touch-event.js';
import { AppBase } from '../framework/app-base.js';
import { getApplication } from '../framework/globals.js';
import { CameraComponent } from '../framework/components/camera/component.js';
import { LightComponent } from '../framework/components/light/component.js';
import { ModelComponent } from '../framework/components/model/component.js';
import { RenderComponent } from '../framework/components/render/component.js';
import { BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYFLAG_STATIC_OBJECT, BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYSTATE_ACTIVE_TAG, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION } from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { basisInitialize } from '../framework/handlers/basis.js';
import { LitShader } from '../scene/shader-lib/programs/lit-shader.js';

// CORE
const LINEBATCH_WORLD = 0;
const LINEBATCH_OVERLAY = 1;
const LINEBATCH_GIZMO = 2;
const log = {
  write: function (text) {
    Debug.deprecated('pc.log.write is deprecated. Use console.log instead.');
    console.log(text);
  },
  open: function () {
    Debug.deprecated('pc.log.open is deprecated. Use console.log instead.');
    log.write('Powered by PlayCanvas ' + version + ' ' + revision);
  },
  info: function (text) {
    Debug.deprecated('pc.log.info is deprecated. Use console.info instead.');
    console.info('INFO:    ' + text);
  },
  debug: function (text) {
    Debug.deprecated('pc.log.debug is deprecated. Use console.debug instead.');
    console.debug('DEBUG:   ' + text);
  },
  error: function (text) {
    Debug.deprecated('pc.log.error is deprecated. Use console.error instead.');
    console.error('ERROR:   ' + text);
  },
  warning: function (text) {
    Debug.deprecated('pc.log.warning is deprecated. Use console.warn instead.');
    console.warn('WARNING: ' + text);
  },
  alert: function (text) {
    Debug.deprecated('pc.log.alert is deprecated. Use alert instead.');
    log.write('ALERT:   ' + text);
    alert(text); // eslint-disable-line no-alert
  },

  assert: function (condition, text) {
    Debug.deprecated('pc.log.assert is deprecated. Use a conditional plus console.log instead.');
    if (condition === false) {
      log.write('ASSERT:  ' + text);
    }
  }
};
string.endsWith = function (s, subs) {
  Debug.deprecated('pc.string.endsWith is deprecated. Use String#endsWith instead.');
  return s.endsWith(subs);
};
string.startsWith = function (s, subs) {
  Debug.deprecated('pc.string.startsWith is deprecated. Use String#startsWith instead.');
  return s.startsWith(subs);
};
class Timer {
  constructor() {
    this._isRunning = false;
    this._a = 0;
    this._b = 0;
  }
  start() {
    this._isRunning = true;
    this._a = now();
  }
  stop() {
    this._isRunning = false;
    this._b = now();
  }
  getMilliseconds() {
    return this._b - this._a;
  }
}
const time = {
  now: now,
  Timer: Timer
};
Object.defineProperty(Color.prototype, 'data', {
  get: function () {
    Debug.deprecated('pc.Color#data is not public API and should not be used. Access color components via their individual properties.');
    if (!this._data) {
      this._data = new Float32Array(4);
    }
    this._data[0] = this.r;
    this._data[1] = this.g;
    this._data[2] = this.b;
    this._data[3] = this.a;
    return this._data;
  }
});
Object.defineProperty(Color.prototype, 'data3', {
  get: function () {
    Debug.deprecated('pc.Color#data3 is not public API and should not be used. Access color components via their individual properties.');
    if (!this._data3) {
      this._data3 = new Float32Array(3);
    }
    this._data3[0] = this.r;
    this._data3[1] = this.g;
    this._data3[2] = this.b;
    return this._data3;
  }
});
function inherits(Self, Super) {
  const Temp = function Temp() {};
  const Func = function Func(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    Super.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
    Self.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
    // this.constructor = Self;
  };

  Func._super = Super.prototype;
  Temp.prototype = Super.prototype;
  Func.prototype = new Temp();
  return Func;
}
function makeArray(arr) {
  Debug.deprecated('pc.makeArray is not public API and should not be used. Use Array.prototype.slice.call instead.');
  return Array.prototype.slice.call(arr);
}
function createStyle(cssString) {
  const result = document.createElement('style');
  result.type = 'text/css';
  if (result.styleSheet) {
    result.styleSheet.cssText = cssString;
  } else {
    result.appendChild(document.createTextNode(cssString));
  }
  return result;
}

// MATH

math.INV_LOG2 = Math.LOG2E;
math.intToBytes = math.intToBytes32;
math.bytesToInt = math.bytesToInt32;
Object.defineProperty(Vec2.prototype, 'data', {
  get: function () {
    Debug.deprecated('pc.Vec2#data is not public API and should not be used. Access vector components via their individual properties.');
    if (!this._data) {
      this._data = new Float32Array(2);
    }
    this._data[0] = this.x;
    this._data[1] = this.y;
    return this._data;
  }
});
Vec2.prototype.scale = Vec2.prototype.mulScalar;
Object.defineProperty(Vec3.prototype, 'data', {
  get: function () {
    Debug.deprecated('pc.Vec3#data is not public API and should not be used. Access vector components via their individual properties.');
    if (!this._data) {
      this._data = new Float32Array(3);
    }
    this._data[0] = this.x;
    this._data[1] = this.y;
    this._data[2] = this.z;
    return this._data;
  }
});
Vec3.prototype.scale = Vec3.prototype.mulScalar;
Object.defineProperty(Vec4.prototype, 'data', {
  get: function () {
    Debug.deprecated('pc.Vec4#data is not public API and should not be used. Access vector components via their individual properties.');
    if (!this._data) {
      this._data = new Float32Array(4);
    }
    this._data[0] = this.x;
    this._data[1] = this.y;
    this._data[2] = this.z;
    this._data[3] = this.w;
    return this._data;
  }
});
Vec4.prototype.scale = Vec4.prototype.mulScalar;

// SHAPE

const shape = {
  Aabb: BoundingBox,
  Sphere: BoundingSphere,
  Plane: Plane
};
BoundingSphere.prototype.intersectRay = BoundingSphere.prototype.intersectsRay;
Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
  Debug.deprecated('pc.Frustum#update is deprecated. Use pc.Frustum#setFromMat4 instead.');
  const viewProj = new Mat4();
  viewProj.mul2(projectionMatrix, viewMatrix);
  this.setFromMat4(viewProj);
};

// GRAPHICS

const ELEMENTTYPE_INT8 = TYPE_INT8;
const ELEMENTTYPE_UINT8 = TYPE_UINT8;
const ELEMENTTYPE_INT16 = TYPE_INT16;
const ELEMENTTYPE_UINT16 = TYPE_UINT16;
const ELEMENTTYPE_INT32 = TYPE_INT32;
const ELEMENTTYPE_UINT32 = TYPE_UINT32;
const ELEMENTTYPE_FLOAT32 = TYPE_FLOAT32;
const PIXELFORMAT_L8_A8 = PIXELFORMAT_LA8;
const PIXELFORMAT_R5_G6_B5 = PIXELFORMAT_RGB565;
const PIXELFORMAT_R5_G5_B5_A1 = PIXELFORMAT_RGBA5551;
const PIXELFORMAT_R4_G4_B4_A4 = PIXELFORMAT_RGBA4;
const PIXELFORMAT_R8_G8_B8 = PIXELFORMAT_RGB8;
const PIXELFORMAT_R8_G8_B8_A8 = PIXELFORMAT_RGBA8;
const BLENDMODE_CONSTANT_COLOR = BLENDMODE_CONSTANT;
const BLENDMODE_ONE_MINUS_CONSTANT_COLOR = BLENDMODE_ONE_MINUS_CONSTANT;
const BLENDMODE_CONSTANT_ALPHA = BLENDMODE_CONSTANT;
const BLENDMODE_ONE_MINUS_CONSTANT_ALPHA = BLENDMODE_ONE_MINUS_CONSTANT;
function UnsupportedBrowserError(message) {
  this.name = 'UnsupportedBrowserError';
  this.message = message || '';
}
UnsupportedBrowserError.prototype = Error.prototype;
function ContextCreationError(message) {
  this.name = 'ContextCreationError';
  this.message = message || '';
}
ContextCreationError.prototype = Error.prototype;
const programlib = {
  begin: ShaderGenerator.begin,
  dummyFragmentCode: ShaderUtils.dummyFragmentCode,
  end: ShaderGenerator.end,
  fogCode: ShaderGenerator.fogCode,
  gammaCode: ShaderGenerator.gammaCode,
  precisionCode: ShaderUtils.precisionCode,
  skinCode: ShaderGenerator.skinCode,
  tonemapCode: ShaderGenerator.tonemapCode,
  versionCode: ShaderUtils.versionCode
};
const gfx = {
  ADDRESS_CLAMP_TO_EDGE: ADDRESS_CLAMP_TO_EDGE,
  ADDRESS_MIRRORED_REPEAT: ADDRESS_MIRRORED_REPEAT,
  ADDRESS_REPEAT: ADDRESS_REPEAT,
  BLENDMODE_ZERO: BLENDMODE_ZERO,
  BLENDMODE_ONE: BLENDMODE_ONE,
  BLENDMODE_SRC_COLOR: BLENDMODE_SRC_COLOR,
  BLENDMODE_ONE_MINUS_SRC_COLOR: BLENDMODE_ONE_MINUS_SRC_COLOR,
  BLENDMODE_DST_COLOR: BLENDMODE_DST_COLOR,
  BLENDMODE_ONE_MINUS_DST_COLOR: BLENDMODE_ONE_MINUS_DST_COLOR,
  BLENDMODE_SRC_ALPHA: BLENDMODE_SRC_ALPHA,
  BLENDMODE_SRC_ALPHA_SATURATE: BLENDMODE_SRC_ALPHA_SATURATE,
  BLENDMODE_ONE_MINUS_SRC_ALPHA: BLENDMODE_ONE_MINUS_SRC_ALPHA,
  BLENDMODE_DST_ALPHA: BLENDMODE_DST_ALPHA,
  BLENDMODE_ONE_MINUS_DST_ALPHA: BLENDMODE_ONE_MINUS_DST_ALPHA,
  BUFFER_STATIC: BUFFER_STATIC,
  BUFFER_DYNAMIC: BUFFER_DYNAMIC,
  BUFFER_STREAM: BUFFER_STREAM,
  CULLFACE_NONE: CULLFACE_NONE,
  CULLFACE_BACK: CULLFACE_BACK,
  CULLFACE_FRONT: CULLFACE_FRONT,
  CULLFACE_FRONTANDBACK: CULLFACE_FRONTANDBACK,
  ELEMENTTYPE_INT8: TYPE_INT8,
  ELEMENTTYPE_UINT8: TYPE_UINT8,
  ELEMENTTYPE_INT16: TYPE_INT16,
  ELEMENTTYPE_UINT16: TYPE_UINT16,
  ELEMENTTYPE_INT32: TYPE_INT32,
  ELEMENTTYPE_UINT32: TYPE_UINT32,
  ELEMENTTYPE_FLOAT32: TYPE_FLOAT32,
  FILTER_NEAREST: FILTER_NEAREST,
  FILTER_LINEAR: FILTER_LINEAR,
  FILTER_NEAREST_MIPMAP_NEAREST: FILTER_NEAREST_MIPMAP_NEAREST,
  FILTER_NEAREST_MIPMAP_LINEAR: FILTER_NEAREST_MIPMAP_LINEAR,
  FILTER_LINEAR_MIPMAP_NEAREST: FILTER_LINEAR_MIPMAP_NEAREST,
  FILTER_LINEAR_MIPMAP_LINEAR: FILTER_LINEAR_MIPMAP_LINEAR,
  INDEXFORMAT_UINT8: INDEXFORMAT_UINT8,
  INDEXFORMAT_UINT16: INDEXFORMAT_UINT16,
  INDEXFORMAT_UINT32: INDEXFORMAT_UINT32,
  PIXELFORMAT_RGB565: PIXELFORMAT_RGB565,
  PIXELFORMAT_RGB8: PIXELFORMAT_RGB8,
  PIXELFORMAT_RGBA8: PIXELFORMAT_RGBA8,
  PRIMITIVE_POINTS: PRIMITIVE_POINTS,
  PRIMITIVE_LINES: PRIMITIVE_LINES,
  PRIMITIVE_LINELOOP: PRIMITIVE_LINELOOP,
  PRIMITIVE_LINESTRIP: PRIMITIVE_LINESTRIP,
  PRIMITIVE_TRIANGLES: PRIMITIVE_TRIANGLES,
  PRIMITIVE_TRISTRIP: PRIMITIVE_TRISTRIP,
  PRIMITIVE_TRIFAN: PRIMITIVE_TRIFAN,
  SEMANTIC_POSITION: SEMANTIC_POSITION,
  SEMANTIC_NORMAL: SEMANTIC_NORMAL,
  SEMANTIC_COLOR: SEMANTIC_COLOR,
  SEMANTIC_TEXCOORD: SEMANTIC_TEXCOORD,
  SEMANTIC_TEXCOORD0: SEMANTIC_TEXCOORD0,
  SEMANTIC_TEXCOORD1: SEMANTIC_TEXCOORD1,
  SEMANTIC_ATTR0: SEMANTIC_ATTR0,
  SEMANTIC_ATTR1: SEMANTIC_ATTR1,
  SEMANTIC_ATTR2: SEMANTIC_ATTR2,
  SEMANTIC_ATTR3: SEMANTIC_ATTR3,
  TEXTURELOCK_READ: TEXTURELOCK_READ,
  TEXTURELOCK_WRITE: TEXTURELOCK_WRITE,
  drawQuadWithShader: drawQuadWithShader,
  programlib: programlib,
  shaderChunks: shaderChunks,
  ContextCreationError: ContextCreationError,
  Device: GraphicsDevice,
  IndexBuffer: IndexBuffer,
  ProgramLibrary: ProgramLibrary,
  RenderTarget: RenderTarget,
  ScopeId: ScopeId,
  Shader: Shader,
  ShaderInput: WebglShaderInput,
  Texture: Texture,
  UnsupportedBrowserError: UnsupportedBrowserError,
  VertexBuffer: VertexBuffer,
  VertexFormat: VertexFormat,
  VertexIterator: VertexIterator
};
const _viewport = new Vec4();
function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
  Debug.deprecated(`pc.drawFullscreenQuad is deprecated. When used as part of PostEffect, use PostEffect#drawQuad instead.`);

  // convert rect in normalized space to viewport in pixel space
  let viewport;
  if (rect) {
    const w = target ? target.width : device.width;
    const h = target ? target.height : device.height;
    viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
  }
  drawQuadWithShader(device, target, shader, viewport);
}
const posteffect = {
  createFullscreenQuad: device => {
    return device.quadVertexBuffer;
  },
  drawFullscreenQuad: drawFullscreenQuad,
  PostEffect: PostEffect,
  PostEffectQueue: PostEffectQueue
};
Object.defineProperty(shaderChunks, 'transformSkinnedVS', {
  get: function () {
    return '#define SKIN\n' + shaderChunks.transformVS;
  }
});
const deprecatedChunks = {
  'ambientPrefilteredCube.frag': 'ambientEnv.frag',
  'ambientPrefilteredCubeLod.frag': 'ambientEnv.frag',
  'dpAtlasQuad.frag': null,
  'genParaboloid.frag': null,
  'prefilterCubemap.frag': null,
  'reflectionDpAtlas.frag': 'reflectionEnv.frag',
  'reflectionPrefilteredCube.frag': 'reflectionEnv.frag',
  'reflectionPrefilteredCubeLod.frag': 'reflectionEnv.frag'
};
Object.keys(deprecatedChunks).forEach(chunkName => {
  const replacement = deprecatedChunks[chunkName];
  const useInstead = replacement ? ` Use pc.shaderChunks['${replacement}'] instead.` : '';
  const msg = `pc.shaderChunks['${chunkName}'] is deprecated.${useInstead}}`;
  Object.defineProperty(shaderChunks, chunkName, {
    get: function () {
      Debug.error(msg);
      return null;
    },
    set: function () {
      Debug.error(msg);
    }
  });
});

// We only provide backwards compatibility in debug builds, production builds have to be
// as fast and small as possible.

/**
 * Helper function to ensure a bit of backwards compatibility.
 *
 * @example
 * toLitArgs('litShaderArgs.sheen.specularity'); // Result: 'litArgs_sheen_specularity'
 * @param {string} src - The shader source which may generate shader errors.
 * @returns {string} The backwards compatible shader source.
 * @ignore
 */
function compatibilityForLitArgs(src) {
  if (src.includes('litShaderArgs')) {
    src = src.replace(/litShaderArgs([\.a-zA-Z]+)+/g, (a, b) => {
      const newSource = 'litArgs' + b.replace(/\./g, '_');
      Debug.deprecated(`Nested struct property access is deprecated, because it's crashing some devices. Please update your custom chunks manually. In particular ${a} should be ${newSource} now.`);
      return newSource;
    });
  }
  return src;
}

/**
 * Add more backwards compatibility functions as needed.
 */
LitShader.prototype.handleCompatibility = function () {
  this.fshader = compatibilityForLitArgs(this.fshader);
};

// Note: This was never public interface, but has been used in external scripts
Object.defineProperties(RenderTarget.prototype, {
  _glFrameBuffer: {
    get: function () {
      Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
      return this.impl._glFrameBuffer;
    },
    set: function (rgbm) {
      Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
    }
  }
});
Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
  get: function () {
    Debug.assert('pc.VertexFormat.defaultInstancingFormat is deprecated, use pc.VertexFormat.getDefaultInstancingFormat(graphicsDevice).');
    return null;
  }
});
Object.defineProperties(Texture.prototype, {
  rgbm: {
    get: function () {
      Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
      return this.type === TEXTURETYPE_RGBM;
    },
    set: function (rgbm) {
      Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
      this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
    }
  },
  swizzleGGGR: {
    get: function () {
      Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
      return this.type === TEXTURETYPE_SWIZZLEGGGR;
    },
    set: function (swizzleGGGR) {
      Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
      this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
    }
  },
  _glTexture: {
    get: function () {
      Debug.deprecated('pc.Texture#_glTexture is no longer available, use Use pc.Texture.impl._glTexture instead.');
      return this.impl._glTexture;
    }
  },
  autoMipmap: {
    get: function () {
      Debug.deprecated('pc.Texture#autoMipmap is deprecated, use pc.Texture#mipmaps instead.');
      return this._mipmaps;
    },
    set: function (value) {
      Debug.deprecated('pc.Texture#autoMipmap is deprecated, use pc.Texture#mipmaps instead.');
      this._mipmaps = value;
    }
  }
});
Object.defineProperty(GraphicsDevice.prototype, 'webgl2', {
  get: function () {
    Debug.deprecated('pc.GraphicsDevice#webgl2 is deprecated, use pc.GraphicsDevice#isWebGL2 instead.');
    return this.isWebGL2;
  }
});
GraphicsDevice.prototype.getProgramLibrary = function () {
  Debug.deprecated(`pc.GraphicsDevice#getProgramLibrary is deprecated.`);
  return getProgramLibrary(this);
};
GraphicsDevice.prototype.setProgramLibrary = function (lib) {
  Debug.deprecated(`pc.GraphicsDevice#setProgramLibrary is deprecated.`);
  setProgramLibrary(this, lib);
};
GraphicsDevice.prototype.removeShaderFromCache = function (shader) {
  Debug.deprecated(`pc.GraphicsDevice#removeShaderFromCache is deprecated.`);
  getProgramLibrary(this).removeFromCache(shader);
};
BlendState.DEFAULT = Object.freeze(new BlendState());
const _tempBlendState = new BlendState();
const _tempDepthState = new DepthState();
GraphicsDevice.prototype.setBlendFunction = function (blendSrc, blendDst) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendFunction is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
  _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrc, blendDst);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendFunctionSeparate = function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendFunctionSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
  _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrcAlpha, blendDstAlpha);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquation = function (blendEquation) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendEquation is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
  _tempBlendState.setAlphaBlend(blendEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquationSeparate = function (blendEquation, blendAlphaEquation) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendEquationSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
  _tempBlendState.setAlphaBlend(blendAlphaEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setColorWrite = function (redWrite, greenWrite, blueWrite, alphaWrite) {
  Debug.deprecated(`pc.GraphicsDevice#setColorWrite is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.getBlending = function () {
  return this.blendState.blend;
};
GraphicsDevice.prototype.setBlending = function (blending) {
  Debug.deprecated(`pc.GraphicsDevice#setBlending is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  _tempBlendState.copy(this.blendState);
  _tempBlendState.blend = blending;
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setDepthWrite = function (write) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthWrite is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.write = write;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthFunc = function (func) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthFunc is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.func = func;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthTest = function (test) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthTest is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.test = test;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.getCullMode = function () {
  return this.cullMode;
};

// SCENE

const PhongMaterial = StandardMaterial;
const LitOptions = LitShaderOptions;
const scene = {
  partitionSkin: partitionSkin,
  procedural: {
    calculateTangents: calculateTangents,
    createMesh: createMesh,
    createTorus: createTorus,
    createCylinder: createCylinder,
    createCapsule: createCapsule,
    createCone: createCone,
    createSphere: createSphere,
    createPlane: createPlane,
    createBox: createBox
  },
  BasicMaterial: BasicMaterial,
  ForwardRenderer: ForwardRenderer,
  GraphNode: GraphNode,
  Material: Material,
  Mesh: Mesh,
  MeshInstance: MeshInstance,
  Model: Model,
  ParticleEmitter: ParticleEmitter,
  PhongMaterial: StandardMaterial,
  Picker: Picker,
  Projection: {
    ORTHOGRAPHIC: PROJECTION_ORTHOGRAPHIC,
    PERSPECTIVE: PROJECTION_PERSPECTIVE
  },
  Scene: Scene,
  Skin: Skin,
  SkinInstance: SkinInstance
};
Object.defineProperty(Scene.prototype, 'defaultMaterial', {
  get: function () {
    Debug.deprecated('pc.Scene#defaultMaterial is deprecated.');
    return getDefaultMaterial(getApplication().graphicsDevice);
  }
});
Object.defineProperty(LayerComposition.prototype, '_meshInstances', {
  get: function () {
    Debug.deprecated('pc.LayerComposition#_meshInstances is deprecated.');
    return null;
  }
});
Object.defineProperty(Scene.prototype, 'drawCalls', {
  get: function () {
    Debug.deprecated('pc.Scene#drawCalls is deprecated and no longer provides mesh instances.');
    return null;
  }
});

// scene.skyboxPrefiltered**** are deprecated
['128', '64', '32', '16', '8', '4'].forEach((size, index) => {
  Object.defineProperty(Scene.prototype, `skyboxPrefiltered${size}`, {
    get: function () {
      Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
      return this._prefilteredCubemaps[index];
    },
    set: function (value) {
      Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
      this._prefilteredCubemaps[index] = value;
      this.updateShaders = true;
    }
  });
});
Object.defineProperty(Scene.prototype, 'models', {
  get: function () {
    if (!this._models) {
      this._models = [];
    }
    return this._models;
  }
});
Object.defineProperty(Layer.prototype, 'renderTarget', {
  set: function (rt) {
    Debug.deprecated(`pc.Layer#renderTarget is deprecated. Set the render target on the camera instead.`);
    this._renderTarget = rt;
    this._dirtyComposition = true;
  },
  get: function () {
    return this._renderTarget;
  }
});
Scene.prototype.addModel = function (model) {
  Debug.deprecated('pc.Scene#addModel is deprecated.');
  if (this.containsModel(model)) return;
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.addMeshInstances(model.meshInstances);
  this.models.push(model);
};
Scene.prototype.addShadowCaster = function (model) {
  Debug.deprecated('pc.Scene#addShadowCaster is deprecated.');
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.addShadowCasters(model.meshInstances);
};
Scene.prototype.removeModel = function (model) {
  Debug.deprecated('pc.Scene#removeModel is deprecated.');
  const index = this.models.indexOf(model);
  if (index !== -1) {
    const layer = this.layers.getLayerById(LAYERID_WORLD);
    if (!layer) return;
    layer.removeMeshInstances(model.meshInstances);
    this.models.splice(index, 1);
  }
};
Scene.prototype.removeShadowCasters = function (model) {
  Debug.deprecated('pc.Scene#removeShadowCasters is deprecated.');
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.removeShadowCasters(model.meshInstances);
};
Scene.prototype.containsModel = function (model) {
  Debug.deprecated('pc.Scene#containsModel is deprecated.');
  return this.models.indexOf(model) >= 0;
};
Scene.prototype.getModels = function (model) {
  Debug.deprecated('pc.Scene#getModels is deprecated.');
  return this.models;
};
Object.defineProperty(Batch.prototype, 'model', {
  get: function () {
    Debug.deprecated('pc.Batch#model is deprecated. Use pc.Batch#meshInstance to access batched mesh instead.');
    return null;
  }
});
ForwardRenderer.prototype.renderComposition = function (comp) {
  Debug.deprecated('pc.ForwardRenderer#renderComposition is deprecated. Use pc.AppBase.renderComposition instead.');
  getApplication().renderComposition(comp);
};
MeshInstance.prototype.syncAabb = function () {
  Debug.deprecated('pc.MeshInstance#syncAabb is deprecated.');
};
Morph.prototype.getTarget = function (index) {
  Debug.deprecated('pc.Morph#getTarget is deprecated. Use pc.Morph#targets instead.');
  return this.targets[index];
};
GraphNode.prototype._dirtify = function (local) {
  Debug.deprecated('pc.GraphNode#_dirtify is deprecated. Use pc.GraphNode#_dirtifyLocal or _dirtifyWorld respectively instead.');
  if (local) this._dirtifyLocal();else this._dirtifyWorld();
};
GraphNode.prototype.addLabel = function (label) {
  Debug.deprecated('pc.GraphNode#addLabel is deprecated. Use pc.GraphNode#tags instead.');
  this._labels[label] = true;
};
GraphNode.prototype.getLabels = function () {
  Debug.deprecated('pc.GraphNode#getLabels is deprecated. Use pc.GraphNode#tags instead.');
  return Object.keys(this._labels);
};
GraphNode.prototype.hasLabel = function (label) {
  Debug.deprecated('pc.GraphNode#hasLabel is deprecated. Use pc.GraphNode#tags instead.');
  return !!this._labels[label];
};
GraphNode.prototype.removeLabel = function (label) {
  Debug.deprecated('pc.GraphNode#removeLabel is deprecated. Use pc.GraphNode#tags instead.');
  delete this._labels[label];
};
GraphNode.prototype.findByLabel = function (label, results = []) {
  Debug.deprecated('pc.GraphNode#findByLabel is deprecated. Use pc.GraphNode#tags instead.');
  if (this.hasLabel(label)) {
    results.push(this);
  }
  for (let i = 0; i < this._children.length; ++i) {
    results = this._children[i].findByLabel(label, results);
  }
  return results;
};
GraphNode.prototype.getChildren = function () {
  Debug.deprecated('pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');
  return this.children;
};
GraphNode.prototype.getName = function () {
  Debug.deprecated('pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');
  return this.name;
};
GraphNode.prototype.getPath = function () {
  Debug.deprecated('pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');
  return this.path;
};
GraphNode.prototype.getRoot = function () {
  Debug.deprecated('pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');
  return this.root;
};
GraphNode.prototype.getParent = function () {
  Debug.deprecated('pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');
  return this.parent;
};
GraphNode.prototype.setName = function (name) {
  Debug.deprecated('pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');
  this.name = name;
};
Material.prototype.getName = function () {
  Debug.deprecated('pc.Material#getName is deprecated. Use pc.Material#name instead.');
  return this.name;
};
Material.prototype.setName = function (name) {
  Debug.deprecated('pc.Material#setName is deprecated. Use pc.Material#name instead.');
  this.name = name;
};
Material.prototype.getShader = function () {
  Debug.deprecated('pc.Material#getShader is deprecated. Use pc.Material#shader instead.');
  return this.shader;
};
Material.prototype.setShader = function (shader) {
  Debug.deprecated('pc.Material#setShader is deprecated. Use pc.Material#shader instead.');
  this.shader = shader;
};

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blend', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blend is deprecated, use pc.Material.blendState.`);
    this.blendState.blend = value;
  },
  get: function () {
    return this.blendState.blend;
  }
});

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blendSrc', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blendSrc is deprecated, use pc.Material.blendState.`);
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(currentBlendState.colorOp, value, currentBlendState.colorDstFactor);
    _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, value, currentBlendState.alphaDstFactor);
    this.blendState = _tempBlendState;
  },
  get: function () {
    return this.blendState.colorSrcFactor;
  }
});

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blendDst', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blendDst is deprecated, use pc.Material.blendState.`);
    const currentBlendState = this.blendState;
    _tempBlendState.copy(currentBlendState);
    _tempBlendState.setColorBlend(currentBlendState.colorOp, currentBlendState.colorSrcFactor, value);
    _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, currentBlendState.alphaSrcFactor, value);
    this.blendState = _tempBlendState;
  },
  get: function () {
    return this.blendState.colorDstFactor;
  }
});

// shininess (range 0..100) - maps to internal gloss value (range 0..1)
Object.defineProperty(StandardMaterial.prototype, 'shininess', {
  get: function () {
    return this.gloss * 100;
  },
  set: function (value) {
    this.gloss = value * 0.01;
  }
});
function _defineAlias(newName, oldName) {
  Object.defineProperty(StandardMaterial.prototype, oldName, {
    get: function () {
      Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
      return this[newName];
    },
    set: function (value) {
      Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
      this[newName] = value;
    }
  });
}
_defineAlias('diffuseTint', 'diffuseMapTint');
_defineAlias('specularTint', 'specularMapTint');
_defineAlias('emissiveTint', 'emissiveMapTint');
_defineAlias('aoVertexColor', 'aoMapVertexColor');
_defineAlias('diffuseVertexColor', 'diffuseMapVertexColor');
_defineAlias('specularVertexColor', 'specularMapVertexColor');
_defineAlias('emissiveVertexColor', 'emissiveMapVertexColor');
_defineAlias('metalnessVertexColor', 'metalnessMapVertexColor');
_defineAlias('glossVertexColor', 'glossMapVertexColor');
_defineAlias('opacityVertexColor', 'opacityMapVertexColor');
_defineAlias('lightVertexColor', 'lightMapVertexColor');
_defineAlias('sheenGloss', 'sheenGlossiess');
_defineAlias('clearCoatGloss', 'clearCostGlossiness');
function _defineOption(name, newName) {
  if (name !== 'pass') {
    Object.defineProperty(StandardMaterialOptions.prototype, name, {
      get: function () {
        Debug.deprecated(`Getting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitShaderOptions#${newName || name}.`);
        return this.litOptions[newName || name];
      },
      set: function (value) {
        Debug.deprecated(`Setting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitShaderOptions#${newName || name}.`);
        this.litOptions[newName || name] = value;
      }
    });
  }
}
_defineOption('refraction', 'useRefraction');
const tempOptions = new LitShaderOptions();
const litOptionProperties = Object.getOwnPropertyNames(tempOptions);
for (const litOption in litOptionProperties) {
  _defineOption(litOptionProperties[litOption]);
}

// ANIMATION

const anim = {
  Animation: Animation,
  Key: Key,
  Node: Node,
  Skeleton: Skeleton
};
Animation.prototype.getDuration = function () {
  Debug.deprecated('pc.Animation#getDuration is deprecated. Use pc.Animation#duration instead.');
  return this.duration;
};
Animation.prototype.getName = function () {
  Debug.deprecated('pc.Animation#getName is deprecated. Use pc.Animation#name instead.');
  return this.name;
};
Animation.prototype.getNodes = function () {
  Debug.deprecated('pc.Animation#getNodes is deprecated. Use pc.Animation#nodes instead.');
  return this.nodes;
};
Animation.prototype.setDuration = function (duration) {
  Debug.deprecated('pc.Animation#setDuration is deprecated. Use pc.Animation#duration instead.');
  this.duration = duration;
};
Animation.prototype.setName = function (name) {
  Debug.deprecated('pc.Animation#setName is deprecated. Use pc.Animation#name instead.');
  this.name = name;
};
Skeleton.prototype.getAnimation = function () {
  Debug.deprecated('pc.Skeleton#getAnimation is deprecated. Use pc.Skeleton#animation instead.');
  return this.animation;
};
Skeleton.prototype.getCurrentTime = function () {
  Debug.deprecated('pc.Skeleton#getCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
  return this.currentTime;
};
Skeleton.prototype.getLooping = function () {
  Debug.deprecated('pc.Skeleton#getLooping is deprecated. Use pc.Skeleton#looping instead.');
  return this.looping;
};
Skeleton.prototype.getNumNodes = function () {
  Debug.deprecated('pc.Skeleton#getNumNodes is deprecated. Use pc.Skeleton#numNodes instead.');
  return this.numNodes;
};
Skeleton.prototype.setAnimation = function (animation) {
  Debug.deprecated('pc.Skeleton#setAnimation is deprecated. Use pc.Skeleton#animation instead.');
  this.animation = animation;
};
Skeleton.prototype.setCurrentTime = function (time) {
  Debug.deprecated('pc.Skeleton#setCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
  this.currentTime = time;
};
Skeleton.prototype.setLooping = function (looping) {
  Debug.deprecated('pc.Skeleton#setLooping is deprecated. Use pc.Skeleton#looping instead.');
  this.looping = looping;
};

// SOUND

const audio = {
  AudioManager: SoundManager,
  Channel: Channel,
  Channel3d: Channel3d,
  Listener: Listener,
  Sound: Sound
};
SoundManager.prototype.getListener = function () {
  Debug.deprecated('pc.SoundManager#getListener is deprecated. Use pc.SoundManager#listener instead.');
  return this.listener;
};
SoundManager.prototype.getVolume = function () {
  Debug.deprecated('pc.SoundManager#getVolume is deprecated. Use pc.SoundManager#volume instead.');
  return this.volume;
};
SoundManager.prototype.setVolume = function (volume) {
  Debug.deprecated('pc.SoundManager#setVolume is deprecated. Use pc.SoundManager#volume instead.');
  this.volume = volume;
};

// ASSET

const asset = {
  ASSET_ANIMATION: 'animation',
  ASSET_AUDIO: 'audio',
  ASSET_IMAGE: 'image',
  ASSET_JSON: 'json',
  ASSET_MODEL: 'model',
  ASSET_MATERIAL: 'material',
  ASSET_TEXT: 'text',
  ASSET_TEXTURE: 'texture',
  ASSET_CUBEMAP: 'cubemap',
  ASSET_SCRIPT: 'script'
};
AssetRegistry.prototype.getAssetById = function (id) {
  Debug.deprecated('pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.');
  return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#ray is deprecated. Use pc.XrInputSource#getOrigin and pc.XrInputSource#getDirection instead.');
    return this._rayLocal;
  }
});
Object.defineProperty(XrInputSource.prototype, 'position', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#position is deprecated. Use pc.XrInputSource#getLocalPosition instead.');
    return this._localPosition;
  }
});
Object.defineProperty(XrInputSource.prototype, 'rotation', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#rotation is deprecated. Use pc.XrInputSource#getLocalRotation instead.');
    return this._localRotation;
  }
});

// INPUT

const input = {
  getTouchTargetCoords: getTouchTargetCoords,
  Controller: Controller,
  GamePads: GamePads,
  Keyboard: Keyboard,
  KeyboardEvent: KeyboardEvent,
  Mouse: Mouse,
  MouseEvent: MouseEvent,
  Touch: Touch,
  TouchDevice: TouchDevice,
  TouchEvent: TouchEvent
};
Object.defineProperty(ElementInput.prototype, 'wheel', {
  get: function () {
    return this.wheelDelta * -2;
  }
});
Object.defineProperty(MouseEvent.prototype, 'wheel', {
  get: function () {
    return this.wheelDelta * -2;
  }
});

// FRAMEWORK

const RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;
const RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;
const RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;
const RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;
const RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;
const RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;
const RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;
const RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;
const RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;
const RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;
const RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;
AppBase.prototype.isFullscreen = function () {
  Debug.deprecated('pc.AppBase#isFullscreen is deprecated. Use the Fullscreen API directly.');
  return !!document.fullscreenElement;
};
AppBase.prototype.enableFullscreen = function (element, success, error) {
  Debug.deprecated('pc.AppBase#enableFullscreen is deprecated. Use the Fullscreen API directly.');
  element = element || this.graphicsDevice.canvas;

  // success callback
  const s = function s() {
    success();
    document.removeEventListener('fullscreenchange', s);
  };

  // error callback
  const e = function e() {
    error();
    document.removeEventListener('fullscreenerror', e);
  };
  if (success) {
    document.addEventListener('fullscreenchange', s, false);
  }
  if (error) {
    document.addEventListener('fullscreenerror', e, false);
  }
  if (element.requestFullscreen) {
    element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  } else {
    error();
  }
};
AppBase.prototype.disableFullscreen = function (success) {
  Debug.deprecated('pc.AppBase#disableFullscreen is deprecated. Use the Fullscreen API directly.');

  // success callback
  const s = function s() {
    success();
    document.removeEventListener('fullscreenchange', s);
  };
  if (success) {
    document.addEventListener('fullscreenchange', s, false);
  }
  document.exitFullscreen();
};
AppBase.prototype.getSceneUrl = function (name) {
  Debug.deprecated('pc.AppBase#getSceneUrl is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#find instead.');
  const entry = this.scenes.find(name);
  if (entry) {
    return entry.url;
  }
  return null;
};
AppBase.prototype.loadScene = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadScene is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadScene instead.');
  this.scenes.loadScene(url, callback);
};
AppBase.prototype.loadSceneHierarchy = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadSceneHierarchy is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneHierarchy instead.');
  this.scenes.loadSceneHierarchy(url, callback);
};
AppBase.prototype.loadSceneSettings = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadSceneSettings is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneSettings instead.');
  this.scenes.loadSceneSettings(url, callback);
};
AppBase.prototype.renderMeshInstance = function (meshInstance, options) {
  Debug.deprecated('pc.AppBase.renderMeshInstance is deprecated. Use pc.AppBase.drawMeshInstance.');
  const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
  this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
};
AppBase.prototype.renderMesh = function (mesh, material, matrix, options) {
  Debug.deprecated('pc.AppBase.renderMesh is deprecated. Use pc.AppBase.drawMesh.');
  const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
  this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
};
AppBase.prototype._addLines = function (positions, colors, options) {
  const layer = options && options.layer ? options.layer : this.scene.layers.getLayerById(LAYERID_IMMEDIATE);
  const depthTest = options && options.depthTest !== undefined ? options.depthTest : true;
  const batch = this.scene.immediate.getBatch(layer, depthTest);
  batch.addLines(positions, colors);
};
AppBase.prototype.renderLine = function (start, end, color) {
  Debug.deprecated('pc.AppBase.renderLine is deprecated. Use pc.AppBase.drawLine.');
  let endColor = color;
  let options;
  const arg3 = arguments[3];
  const arg4 = arguments[4];
  if (arg3 instanceof Color) {
    // passed in end color
    endColor = arg3;
    if (typeof arg4 === 'number') {
      // compatibility: convert linebatch id into options
      if (arg4 === LINEBATCH_OVERLAY) {
        options = {
          layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
          depthTest: false
        };
      } else {
        options = {
          layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
          depthTest: true
        };
      }
    } else {
      // use passed in options
      options = arg4;
    }
  } else if (typeof arg3 === 'number') {
    endColor = color;

    // compatibility: convert linebatch id into options
    if (arg3 === LINEBATCH_OVERLAY) {
      options = {
        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
        depthTest: false
      };
    } else {
      options = {
        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
        depthTest: true
      };
    }
  } else if (arg3) {
    // options passed in
    options = arg3;
  }
  this._addLines([start, end], [color, endColor], options);
};
AppBase.prototype.renderLines = function (position, color, options) {
  Debug.deprecated('pc.AppBase.renderLines is deprecated. Use pc.AppBase.drawLines.');
  if (!options) {
    // default option
    options = {
      layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
      depthTest: true
    };
  } else if (typeof options === 'number') {
    // backwards compatibility, LINEBATCH_OVERLAY lines have depthtest disabled
    if (options === LINEBATCH_OVERLAY) {
      options = {
        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
        depthTest: false
      };
    } else {
      options = {
        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
        depthTest: true
      };
    }
  }
  const multiColor = !!color.length;
  if (multiColor) {
    if (position.length !== color.length) {
      console.error('renderLines: position/color arrays have different lengths');
      return;
    }
  }
  if (position.length % 2 !== 0) {
    console.error('renderLines: array length is not divisible by 2');
    return;
  }
  this._addLines(position, color, options);
};
AppBase.prototype.enableVr = function () {
  Debug.deprecated('pc.AppBase#enableVR is deprecated, and WebVR API is no longer supported.');
};
Object.defineProperty(CameraComponent.prototype, 'node', {
  get: function () {
    Debug.deprecated('pc.CameraComponent#node is deprecated. Use pc.CameraComponent#entity instead.');
    return this.entity;
  }
});
Object.defineProperty(LightComponent.prototype, 'enable', {
  get: function () {
    Debug.deprecated('pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.');
    return this.enabled;
  },
  set: function (value) {
    Debug.deprecated('pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.');
    this.enabled = value;
  }
});
ModelComponent.prototype.setVisible = function (visible) {
  Debug.deprecated('pc.ModelComponent#setVisible is deprecated. Use pc.ModelComponent#enabled instead.');
  this.enabled = visible;
};
Object.defineProperty(ModelComponent.prototype, 'aabb', {
  get: function () {
    Debug.deprecated('pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    return null;
  },
  set: function (type) {
    Debug.deprecated('pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
  }
});
Object.defineProperty(RenderComponent.prototype, 'aabb', {
  get: function () {
    Debug.deprecated('pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    return null;
  },
  set: function (type) {
    Debug.deprecated('pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
  }
});
Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
  get: function () {
    Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
    return this.type;
  },
  set: function (type) {
    Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
    this.type = type;
  }
});
RigidBodyComponent.prototype.syncBodyToEntity = function () {
  Debug.deprecated('pc.RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
  this._updateDynamic();
};
RigidBodyComponentSystem.prototype.setGravity = function () {
  Debug.deprecated('pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');
  if (arguments.length === 1) {
    this.gravity.copy(arguments[0]);
  } else {
    this.gravity.set(arguments[0], arguments[1], arguments[2]);
  }
};
function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
  Debug.deprecated('pc.basisSetDownloadConfig is deprecated. Use pc.basisInitialize instead.');
  basisInitialize({
    glueUrl: glueUrl,
    wasmUrl: wasmUrl,
    fallbackUrl: fallbackUrl,
    lazyInit: true
  });
}
function prefilterCubemap(options) {
  Debug.deprecated('pc.prefilterCubemap is deprecated. Use pc.envLighting instead.');
}

export { BLENDMODE_CONSTANT_ALPHA, BLENDMODE_CONSTANT_COLOR, BLENDMODE_ONE_MINUS_CONSTANT_ALPHA, BLENDMODE_ONE_MINUS_CONSTANT_COLOR, ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, LINEBATCH_GIZMO, LINEBATCH_OVERLAY, LINEBATCH_WORLD, LitOptions, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, createStyle, drawFullscreenQuad, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9mcnVzdHVtLmpzJztcbmltcG9ydCB7IFBsYW5lIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9wbGFuZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQkxFTkRNT0RFX1pFUk8sIEJMRU5ETU9ERV9PTkUsIEJMRU5ETU9ERV9TUkNfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLCBCTEVORE1PREVfU1JDX0FMUEhBLCBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBLCBCTEVORE1PREVfRFNUX0FMUEhBLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfQ09OU1RBTlQsIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQsXG4gICAgQlVGRkVSX1NUQVRJQywgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LCBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9MSU5FTE9PUCwgUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJU1RSSVAsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1RFWENPT1JELCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFELCBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUixcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkZXJHZW5lcmF0b3IgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3NoYWRlci1nZW5lcmF0b3IuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IExheWVyQ29tcG9zaXRpb24gfSBmcm9tICcuLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3N0RWZmZWN0IH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnksIHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2NvcGVJZCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3Njb3BlLWlkLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFNoYWRlcklucHV0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhJdGVyYXRvciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlcHRoLXN0YXRlLmpzJztcblxuaW1wb3J0IHsgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUsIExBWUVSSURfSU1NRURJQVRFLCBMQVlFUklEX1dPUkxEIH0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNhbGN1bGF0ZVRhbmdlbnRzLCBjcmVhdGVCb3gsIGNyZWF0ZUNhcHN1bGUsIGNyZWF0ZUNvbmUsIGNyZWF0ZUN5bGluZGVyLCBjcmVhdGVNZXNoLCBjcmVhdGVQbGFuZSwgY3JlYXRlU3BoZXJlLCBjcmVhdGVUb3J1cyB9IGZyb20gJy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuaW1wb3J0IHsgcGFydGl0aW9uU2tpbiB9IGZyb20gJy4uL3NjZW5lL3NraW4tcGFydGl0aW9uLmpzJztcbmltcG9ydCB7IEJhc2ljTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvYmFzaWMtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1vcnBoIH0gZnJvbSAnLi4vc2NlbmUvbW9ycGguanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uL3NjZW5lL21vZGVsLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcbmltcG9ydCB7IFBpY2tlciB9IGZyb20gJy4uL2ZyYW1ld29yay9ncmFwaGljcy9waWNrZXIuanMnO1xuaW1wb3J0IHsgU2NlbmUgfSBmcm9tICcuLi9zY2VuZS9zY2VuZS5qcyc7XG5pbXBvcnQgeyBTa2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi5qcyc7XG5pbXBvcnQgeyBTa2luSW5zdGFuY2UgfSBmcm9tICcuLi9zY2VuZS9za2luLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgQmF0Y2ggfSBmcm9tICcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcbmltcG9ydCB7IExpdFNoYWRlck9wdGlvbnMgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL2xpdC1zaGFkZXItb3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcblxuaW1wb3J0IHsgQW5pbWF0aW9uLCBLZXksIE5vZGUgfSBmcm9tICcuLi9zY2VuZS9hbmltYXRpb24vYW5pbWF0aW9uLmpzJztcbmltcG9ydCB7IFNrZWxldG9uIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL3NrZWxldG9uLmpzJztcblxuaW1wb3J0IHsgQ2hhbm5lbCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwuanMnO1xuaW1wb3J0IHsgQ2hhbm5lbDNkIH0gZnJvbSAnLi4vcGxhdGZvcm0vYXVkaW8vY2hhbm5lbDNkLmpzJztcbmltcG9ydCB7IExpc3RlbmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbGlzdGVuZXIuanMnO1xuaW1wb3J0IHsgU291bmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9zb3VuZC5qcyc7XG5pbXBvcnQgeyBTb3VuZE1hbmFnZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJztcblxuaW1wb3J0IHsgQXNzZXRSZWdpc3RyeSB9IGZyb20gJy4uL2ZyYW1ld29yay9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IFhySW5wdXRTb3VyY2UgfSBmcm9tICcuLi9mcmFtZXdvcmsveHIveHItaW5wdXQtc291cmNlLmpzJztcblxuaW1wb3J0IHsgQ29udHJvbGxlciB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWxlbWVudElucHV0IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnO1xuaW1wb3J0IHsgR2FtZVBhZHMgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9nYW1lLXBhZHMuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcyc7XG5pbXBvcnQgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQtZXZlbnQuanMnO1xuaW1wb3J0IHsgTW91c2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcyc7XG5pbXBvcnQgeyBNb3VzZUV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UtZXZlbnQuanMnO1xuaW1wb3J0IHsgVG91Y2hEZXZpY2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0VG91Y2hUYXJnZXRDb29yZHMsIFRvdWNoLCBUb3VjaEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZXZlbnQuanMnO1xuXG5pbXBvcnQgeyBBcHBCYXNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2FwcC1iYXNlLmpzJztcbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dsb2JhbHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMaWdodENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBNb2RlbENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL21vZGVsL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJztcbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QsIEJPRFlGTEFHX1NUQVRJQ19PQkpFQ1QsXG4gICAgQk9EWVNUQVRFX0FDVElWRV9UQUcsIEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiwgQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiwgQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORywgQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTixcbiAgICBCT0RZVFlQRV9EWU5BTUlDLCBCT0RZVFlQRV9LSU5FTUFUSUMsIEJPRFlUWVBFX1NUQVRJQ1xufSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L3N5c3RlbS5qcyc7XG5pbXBvcnQgeyBiYXNpc0luaXRpYWxpemUgfSBmcm9tICcuLi9mcmFtZXdvcmsvaGFuZGxlcnMvYmFzaXMuanMnO1xuaW1wb3J0IHsgTGl0U2hhZGVyIH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtcy9saXQtc2hhZGVyLmpzJztcblxuLy8gQ09SRVxuZXhwb3J0IGNvbnN0IExJTkVCQVRDSF9XT1JMRCA9IDA7XG5leHBvcnQgY29uc3QgTElORUJBVENIX09WRVJMQVkgPSAxO1xuZXhwb3J0IGNvbnN0IExJTkVCQVRDSF9HSVpNTyA9IDI7XG5cbmV4cG9ydCBjb25zdCBsb2cgPSB7XG4gICAgd3JpdGU6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53cml0ZSBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5sb2codGV4dCk7XG4gICAgfSxcblxuICAgIG9wZW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLm9wZW4gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnUG93ZXJlZCBieSBQbGF5Q2FudmFzICcgKyB2ZXJzaW9uICsgJyAnICsgcmV2aXNpb24pO1xuICAgIH0sXG5cbiAgICBpbmZvOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuaW5mbyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5pbmZvIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnSU5GTzogICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBkZWJ1ZzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmRlYnVnIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmRlYnVnIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoJ0RFQlVHOiAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZXJyb3I6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5lcnJvciBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5lcnJvciBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFUlJPUjogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIHdhcm5pbmc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53YXJuaW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLndhcm4gaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS53YXJuKCdXQVJOSU5HOiAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGFsZXJ0OiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuYWxlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGFsZXJ0IGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnQUxFUlQ6ICAgJyArIHRleHQpO1xuICAgICAgICBhbGVydCh0ZXh0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgIH0sXG5cbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFzc2VydCBpcyBkZXByZWNhdGVkLiBVc2UgYSBjb25kaXRpb25hbCBwbHVzIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGlmIChjb25kaXRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBsb2cud3JpdGUoJ0FTU0VSVDogICcgKyB0ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN0cmluZy5lbmRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLmVuZHNXaXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBTdHJpbmcjZW5kc1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5lbmRzV2l0aChzdWJzKTtcbn07XG5cbnN0cmluZy5zdGFydHNXaXRoID0gZnVuY3Rpb24gKHMsIHN1YnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5zdHJpbmcuc3RhcnRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI3N0YXJ0c1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5zdGFydHNXaXRoKHN1YnMpO1xufTtcblxuY2xhc3MgVGltZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYSA9IDA7XG4gICAgICAgIHRoaXMuX2IgPSAwO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9hID0gbm93KCk7XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5faXNSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2IgPSBub3coKTtcbiAgICB9XG5cbiAgICBnZXRNaWxsaXNlY29uZHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iIC0gdGhpcy5fYTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZShjc3NTdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHJlc3VsdC50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAocmVzdWx0LnN0eWxlU2hlZXQpIHtcbiAgICAgICAgcmVzdWx0LnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1N0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzU3RyaW5nKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gTUFUSFxuXG5tYXRoLklOVl9MT0cyID0gTWF0aC5MT0cyRTtcblxubWF0aC5pbnRUb0J5dGVzID0gbWF0aC5pbnRUb0J5dGVzMzI7XG5tYXRoLmJ5dGVzVG9JbnQgPSBtYXRoLmJ5dGVzVG9JbnQzMjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzIucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMiNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMyLnByb3RvdHlwZS5zY2FsZSA9IFZlYzIucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzMucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMyNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMzLnByb3RvdHlwZS5zY2FsZSA9IFZlYzMucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzQucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjNCNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHRoaXMuX2RhdGFbM10gPSB0aGlzLnc7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWM0LnByb3RvdHlwZS5zY2FsZSA9IFZlYzQucHJvdG90eXBlLm11bFNjYWxhcjtcblxuLy8gU0hBUEVcblxuZXhwb3J0IGNvbnN0IHNoYXBlID0ge1xuICAgIEFhYmI6IEJvdW5kaW5nQm94LFxuICAgIFNwaGVyZTogQm91bmRpbmdTcGhlcmUsXG4gICAgUGxhbmU6IFBsYW5lXG59O1xuXG5Cb3VuZGluZ1NwaGVyZS5wcm90b3R5cGUuaW50ZXJzZWN0UmF5ID0gQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdHNSYXk7XG5cbkZydXN0dW0ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChwcm9qZWN0aW9uTWF0cml4LCB2aWV3TWF0cml4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRnJ1c3R1bSN1cGRhdGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkZydXN0dW0jc2V0RnJvbU1hdDQgaW5zdGVhZC4nKTtcblxuICAgIGNvbnN0IHZpZXdQcm9qID0gbmV3IE1hdDQoKTtcblxuICAgIHZpZXdQcm9qLm11bDIocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCk7XG5cbiAgICB0aGlzLnNldEZyb21NYXQ0KHZpZXdQcm9qKTtcbn07XG5cbi8vIEdSQVBISUNTXG5cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQ4ID0gVFlQRV9JTlQ4O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQ4ID0gVFlQRV9VSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQxNiA9IFRZUEVfSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDE2ID0gVFlQRV9VSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMzIgPSBUWVBFX0lOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQzMiA9IFRZUEVfVUlOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0ZMT0FUMzIgPSBUWVBFX0ZMT0FUMzI7XG5cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOF9BOCA9IFBJWEVMRk9STUFUX0xBODtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNl9CNSA9IFBJWEVMRk9STUFUX1JHQjU2NTtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSA9IFBJWEVMRk9STUFUX1JHQkE1NTUxO1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0ID0gUElYRUxGT1JNQVRfUkdCQTQ7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjhfRzhfQjggPSBQSVhFTEZPUk1BVF9SR0I4O1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4ID0gUElYRUxGT1JNQVRfUkdCQTg7XG5cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfQ09OU1RBTlRfQ09MT1IgPSBCTEVORE1PREVfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9DT0xPUiA9IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBID0gQkxFTkRNT0RFX0NPTlNUQU5UO1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEgPSBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UO1xuXG5leHBvcnQgZnVuY3Rpb24gVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udGV4dENyZWF0aW9uRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdDb250ZXh0Q3JlYXRpb25FcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuQ29udGV4dENyZWF0aW9uRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgY29uc3QgcHJvZ3JhbWxpYiA9IHtcbiAgICBiZWdpbjogU2hhZGVyR2VuZXJhdG9yLmJlZ2luLFxuICAgIGR1bW15RnJhZ21lbnRDb2RlOiBTaGFkZXJVdGlscy5kdW1teUZyYWdtZW50Q29kZSxcbiAgICBlbmQ6IFNoYWRlckdlbmVyYXRvci5lbmQsXG4gICAgZm9nQ29kZTogU2hhZGVyR2VuZXJhdG9yLmZvZ0NvZGUsXG4gICAgZ2FtbWFDb2RlOiBTaGFkZXJHZW5lcmF0b3IuZ2FtbWFDb2RlLFxuICAgIHByZWNpc2lvbkNvZGU6IFNoYWRlclV0aWxzLnByZWNpc2lvbkNvZGUsXG4gICAgc2tpbkNvZGU6IFNoYWRlckdlbmVyYXRvci5za2luQ29kZSxcbiAgICB0b25lbWFwQ29kZTogU2hhZGVyR2VuZXJhdG9yLnRvbmVtYXBDb2RlLFxuICAgIHZlcnNpb25Db2RlOiBTaGFkZXJVdGlscy52ZXJzaW9uQ29kZVxufTtcblxuZXhwb3J0IGNvbnN0IGdmeCA9IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDogQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgQUREUkVTU19SRVBFQVQ6IEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPOiBCTEVORE1PREVfWkVSTyxcbiAgICBCTEVORE1PREVfT05FOiBCTEVORE1PREVfT05FLFxuICAgIEJMRU5ETU9ERV9TUkNfQ09MT1I6IEJMRU5ETU9ERV9TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1I6IEJMRU5ETU9ERV9EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEE6IEJMRU5ETU9ERV9TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURTogQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX0RTVF9BTFBIQTogQkxFTkRNT0RFX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQzogQlVGRkVSX1NUQVRJQyxcbiAgICBCVUZGRVJfRFlOQU1JQzogQlVGRkVSX0RZTkFNSUMsXG4gICAgQlVGRkVSX1NUUkVBTTogQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FOiBDVUxMRkFDRV9OT05FLFxuICAgIENVTExGQUNFX0JBQ0s6IENVTExGQUNFX0JBQ0ssXG4gICAgQ1VMTEZBQ0VfRlJPTlQ6IENVTExGQUNFX0ZST05ULFxuICAgIENVTExGQUNFX0ZST05UQU5EQkFDSzogQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEVMRU1FTlRUWVBFX0lOVDg6IFRZUEVfSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9VSU5UODogVFlQRV9VSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9JTlQxNjogVFlQRV9JTlQxNixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMTY6IFRZUEVfVUlOVDE2LFxuICAgIEVMRU1FTlRUWVBFX0lOVDMyOiBUWVBFX0lOVDMyLFxuICAgIEVMRU1FTlRUWVBFX1VJTlQzMjogVFlQRV9VSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfRkxPQVQzMjogVFlQRV9GTE9BVDMyLFxuICAgIEZJTFRFUl9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSOiBGSUxURVJfTElORUFSLFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDg6IElOREVYRk9STUFUX1VJTlQ4LFxuICAgIElOREVYRk9STUFUX1VJTlQxNjogSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIElOREVYRk9STUFUX1VJTlQzMjogSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX1JHQjU2NTogUElYRUxGT1JNQVRfUkdCNTY1LFxuICAgIFBJWEVMRk9STUFUX1JHQjg6IFBJWEVMRk9STUFUX1JHQjgsXG4gICAgUElYRUxGT1JNQVRfUkdCQTg6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgIFBSSU1JVElWRV9QT0lOVFM6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgUFJJTUlUSVZFX0xJTkVTOiBQUklNSVRJVkVfTElORVMsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QOiBQUklNSVRJVkVfTElORUxPT1AsXG4gICAgUFJJTUlUSVZFX0xJTkVTVFJJUDogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTOiBQUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUDogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklGQU46IFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT046IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgIFNFTUFOVElDX05PUk1BTDogU0VNQU5USUNfTk9STUFMLFxuICAgIFNFTUFOVElDX0NPTE9SOiBTRU1BTlRJQ19DT0xPUixcbiAgICBTRU1BTlRJQ19URVhDT09SRDogU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfQVRUUjA6IFNFTUFOVElDX0FUVFIwLFxuICAgIFNFTUFOVElDX0FUVFIxOiBTRU1BTlRJQ19BVFRSMSxcbiAgICBTRU1BTlRJQ19BVFRSMjogU0VNQU5USUNfQVRUUjIsXG4gICAgU0VNQU5USUNfQVRUUjM6IFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQ6IFRFWFRVUkVMT0NLX1JFQUQsXG4gICAgVEVYVFVSRUxPQ0tfV1JJVEU6IFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIGRyYXdRdWFkV2l0aFNoYWRlcjogZHJhd1F1YWRXaXRoU2hhZGVyLFxuICAgIHByb2dyYW1saWI6IHByb2dyYW1saWIsXG4gICAgc2hhZGVyQ2h1bmtzOiBzaGFkZXJDaHVua3MsXG4gICAgQ29udGV4dENyZWF0aW9uRXJyb3I6IENvbnRleHRDcmVhdGlvbkVycm9yLFxuICAgIERldmljZTogR3JhcGhpY3NEZXZpY2UsXG4gICAgSW5kZXhCdWZmZXI6IEluZGV4QnVmZmVyLFxuICAgIFByb2dyYW1MaWJyYXJ5OiBQcm9ncmFtTGlicmFyeSxcbiAgICBSZW5kZXJUYXJnZXQ6IFJlbmRlclRhcmdldCxcbiAgICBTY29wZUlkOiBTY29wZUlkLFxuICAgIFNoYWRlcjogU2hhZGVyLFxuICAgIFNoYWRlcklucHV0OiBXZWJnbFNoYWRlcklucHV0LFxuICAgIFRleHR1cmU6IFRleHR1cmUsXG4gICAgVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3I6IFVuc3VwcG9ydGVkQnJvd3NlckVycm9yLFxuICAgIFZlcnRleEJ1ZmZlcjogVmVydGV4QnVmZmVyLFxuICAgIFZlcnRleEZvcm1hdDogVmVydGV4Rm9ybWF0LFxuICAgIFZlcnRleEl0ZXJhdG9yOiBWZXJ0ZXhJdGVyYXRvclxufTtcblxuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdGdWxsc2NyZWVuUXVhZChkZXZpY2UsIHRhcmdldCwgdmVydGV4QnVmZmVyLCBzaGFkZXIsIHJlY3QpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLmRyYXdGdWxsc2NyZWVuUXVhZCBpcyBkZXByZWNhdGVkLiBXaGVuIHVzZWQgYXMgcGFydCBvZiBQb3N0RWZmZWN0LCB1c2UgUG9zdEVmZmVjdCNkcmF3UXVhZCBpbnN0ZWFkLmApO1xuXG4gICAgLy8gY29udmVydCByZWN0IGluIG5vcm1hbGl6ZWQgc3BhY2UgdG8gdmlld3BvcnQgaW4gcGl4ZWwgc3BhY2VcbiAgICBsZXQgdmlld3BvcnQ7XG4gICAgaWYgKHJlY3QpIHtcbiAgICAgICAgY29uc3QgdyA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IHRhcmdldCA/IHRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB2aWV3cG9ydCA9IF92aWV3cG9ydC5zZXQocmVjdC54ICogdywgcmVjdC55ICogaCwgcmVjdC56ICogdywgcmVjdC53ICogaCk7XG4gICAgfVxuXG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIsIHZpZXdwb3J0KTtcbn1cblxuZXhwb3J0IGNvbnN0IHBvc3RlZmZlY3QgPSB7XG4gICAgY3JlYXRlRnVsbHNjcmVlblF1YWQ6IChkZXZpY2UpID0+IHtcbiAgICAgICAgcmV0dXJuIGRldmljZS5xdWFkVmVydGV4QnVmZmVyO1xuICAgIH0sXG4gICAgZHJhd0Z1bGxzY3JlZW5RdWFkOiBkcmF3RnVsbHNjcmVlblF1YWQsXG4gICAgUG9zdEVmZmVjdDogUG9zdEVmZmVjdCxcbiAgICBQb3N0RWZmZWN0UXVldWU6IFBvc3RFZmZlY3RRdWV1ZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgJ3RyYW5zZm9ybVNraW5uZWRWUycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjZGVmaW5lIFNLSU5cXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgIH1cbn0pO1xuXG5jb25zdCBkZXByZWNhdGVkQ2h1bmtzID0ge1xuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZC5mcmFnJzogJ2FtYmllbnRFbnYuZnJhZycsXG4gICAgJ2RwQXRsYXNRdWFkLmZyYWcnOiBudWxsLFxuICAgICdnZW5QYXJhYm9sb2lkLmZyYWcnOiBudWxsLFxuICAgICdwcmVmaWx0ZXJDdWJlbWFwLmZyYWcnOiBudWxsLFxuICAgICdyZWZsZWN0aW9uRHBBdGxhcy5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnLFxuICAgICdyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJ1xufTtcblxuT2JqZWN0LmtleXMoZGVwcmVjYXRlZENodW5rcykuZm9yRWFjaCgoY2h1bmtOYW1lKSA9PiB7XG4gICAgY29uc3QgcmVwbGFjZW1lbnQgPSBkZXByZWNhdGVkQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgY29uc3QgdXNlSW5zdGVhZCA9IHJlcGxhY2VtZW50ID8gYCBVc2UgcGMuc2hhZGVyQ2h1bmtzWycke3JlcGxhY2VtZW50fSddIGluc3RlYWQuYCA6ICcnO1xuICAgIGNvbnN0IG1zZyA9IGBwYy5zaGFkZXJDaHVua3NbJyR7Y2h1bmtOYW1lfSddIGlzIGRlcHJlY2F0ZWQuJHt1c2VJbnN0ZWFkfX1gO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaGFkZXJDaHVua3MsIGNodW5rTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihtc2cpO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuLy8gV2Ugb25seSBwcm92aWRlIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGluIGRlYnVnIGJ1aWxkcywgcHJvZHVjdGlvbiBidWlsZHMgaGF2ZSB0byBiZVxuLy8gYXMgZmFzdCBhbmQgc21hbGwgYXMgcG9zc2libGUuXG5cbi8vICNpZiBfREVCVUdcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gZW5zdXJlIGEgYml0IG9mIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICpcbiAqIEBleGFtcGxlXG4gKiB0b0xpdEFyZ3MoJ2xpdFNoYWRlckFyZ3Muc2hlZW4uc3BlY3VsYXJpdHknKTsgLy8gUmVzdWx0OiAnbGl0QXJnc19zaGVlbl9zcGVjdWxhcml0eSdcbiAqIEBwYXJhbSB7c3RyaW5nfSBzcmMgLSBUaGUgc2hhZGVyIHNvdXJjZSB3aGljaCBtYXkgZ2VuZXJhdGUgc2hhZGVyIGVycm9ycy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBiYWNrd2FyZHMgY29tcGF0aWJsZSBzaGFkZXIgc291cmNlLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBjb21wYXRpYmlsaXR5Rm9yTGl0QXJncyhzcmMpIHtcbiAgICBpZiAoc3JjLmluY2x1ZGVzKCdsaXRTaGFkZXJBcmdzJykpIHtcbiAgICAgICAgc3JjID0gc3JjLnJlcGxhY2UoL2xpdFNoYWRlckFyZ3MoW1xcLmEtekEtWl0rKSsvZywgKGEsIGIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NvdXJjZSA9ICdsaXRBcmdzJyArIGIucmVwbGFjZSgvXFwuL2csICdfJyk7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBOZXN0ZWQgc3RydWN0IHByb3BlcnR5IGFjY2VzcyBpcyBkZXByZWNhdGVkLCBiZWNhdXNlIGl0J3MgY3Jhc2hpbmcgc29tZSBkZXZpY2VzLiBQbGVhc2UgdXBkYXRlIHlvdXIgY3VzdG9tIGNodW5rcyBtYW51YWxseS4gSW4gcGFydGljdWxhciAke2F9IHNob3VsZCBiZSAke25ld1NvdXJjZX0gbm93LmApO1xuICAgICAgICAgICAgcmV0dXJuIG5ld1NvdXJjZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBzcmM7XG59XG5cbi8qKlxuICogQWRkIG1vcmUgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgZnVuY3Rpb25zIGFzIG5lZWRlZC5cbiAqL1xuTGl0U2hhZGVyLnByb3RvdHlwZS5oYW5kbGVDb21wYXRpYmlsaXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnNoYWRlciA9IGNvbXBhdGliaWxpdHlGb3JMaXRBcmdzKHRoaXMuZnNoYWRlcik7XG59O1xuXG4vLyAjZW5kaWZcblxuLy8gTm90ZTogVGhpcyB3YXMgbmV2ZXIgcHVibGljIGludGVyZmFjZSwgYnV0IGhhcyBiZWVuIHVzZWQgaW4gZXh0ZXJuYWwgc2NyaXB0c1xuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoUmVuZGVyVGFyZ2V0LnByb3RvdHlwZSwge1xuICAgIF9nbEZyYW1lQnVmZmVyOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xGcmFtZUJ1ZmZlcjtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZXJ0ZXhGb3JtYXQsICdkZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCdwYy5WZXJ0ZXhGb3JtYXQuZGVmYXVsdEluc3RhbmNpbmdGb3JtYXQgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLlZlcnRleEZvcm1hdC5nZXREZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdChncmFwaGljc0RldmljZSkuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhUZXh0dXJlLnByb3RvdHlwZSwge1xuICAgIHJnYm06IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3JnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfUkdCTTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBzd2l6emxlR0dHUjoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1I7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHN3aXp6bGVHR0dSKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9nbFRleHR1cmU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI19nbFRleHR1cmUgaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZSwgdXNlIFVzZSBwYy5UZXh0dXJlLmltcGwuX2dsVGV4dHVyZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIGF1dG9NaXBtYXA6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI2F1dG9NaXBtYXAgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLlRleHR1cmUjbWlwbWFwcyBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI2F1dG9NaXBtYXAgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLlRleHR1cmUjbWlwbWFwcyBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHcmFwaGljc0RldmljZS5wcm90b3R5cGUsICd3ZWJnbDInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoaWNzRGV2aWNlI3dlYmdsMiBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2UjaXNXZWJHTDIgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNXZWJHTDI7XG4gICAgfVxufSk7XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5nZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNnZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHJldHVybiBnZXRQcm9ncmFtTGlicmFyeSh0aGlzKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uIChsaWIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHNldFByb2dyYW1MaWJyYXJ5KHRoaXMsIGxpYik7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUucmVtb3ZlU2hhZGVyRnJvbUNhY2hlID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3JlbW92ZVNoYWRlckZyb21DYWNoZSBpcyBkZXByZWNhdGVkLmApO1xuICAgIGdldFByb2dyYW1MaWJyYXJ5KHRoaXMpLnJlbW92ZUZyb21DYWNoZShzaGFkZXIpO1xufTtcblxuQmxlbmRTdGF0ZS5ERUZBVUxUID0gT2JqZWN0LmZyZWV6ZShuZXcgQmxlbmRTdGF0ZSgpKTtcblxuY29uc3QgX3RlbXBCbGVuZFN0YXRlID0gbmV3IEJsZW5kU3RhdGUoKTtcbmNvbnN0IF90ZW1wRGVwdGhTdGF0ZSA9IG5ldyBEZXB0aFN0YXRlKCk7XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZEZ1bmN0aW9uID0gZnVuY3Rpb24gKGJsZW5kU3JjLCBibGVuZERzdCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldEJsZW5kRnVuY3Rpb24gaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldEJsZW5kU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuY29weShjdXJyZW50QmxlbmRTdGF0ZSk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldENvbG9yQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCwgYmxlbmRTcmMsIGJsZW5kRHN0KTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0QWxwaGFCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wLCBibGVuZFNyYywgYmxlbmREc3QpO1xuICAgIHRoaXMuc2V0QmxlbmRTdGF0ZShfdGVtcEJsZW5kU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZSA9IGZ1bmN0aW9uIChibGVuZFNyYywgYmxlbmREc3QsIGJsZW5kU3JjQWxwaGEsIGJsZW5kRHN0QWxwaGEpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldEJsZW5kU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuY29weShjdXJyZW50QmxlbmRTdGF0ZSk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldENvbG9yQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCwgYmxlbmRTcmMsIGJsZW5kRHN0KTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0QWxwaGFCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wLCBibGVuZFNyY0FscGhhLCBibGVuZERzdEFscGhhKTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZEVxdWF0aW9uID0gZnVuY3Rpb24gKGJsZW5kRXF1YXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZEVxdWF0aW9uIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGJsZW5kRXF1YXRpb24sIGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3Rvcik7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoYmxlbmRFcXVhdGlvbiwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFTcmNGYWN0b3IsIGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhRHN0RmFjdG9yKTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUgPSBmdW5jdGlvbiAoYmxlbmRFcXVhdGlvbiwgYmxlbmRBbHBoYUVxdWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGJsZW5kRXF1YXRpb24sIGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3Rvcik7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoYmxlbmRBbHBoYUVxdWF0aW9uLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IpO1xuICAgIHRoaXMuc2V0QmxlbmRTdGF0ZShfdGVtcEJsZW5kU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnNldENvbG9yV3JpdGUgPSBmdW5jdGlvbiAocmVkV3JpdGUsIGdyZWVuV3JpdGUsIGJsdWVXcml0ZSwgYWxwaGFXcml0ZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldENvbG9yV3JpdGUgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldEJsZW5kU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuY29weShjdXJyZW50QmxlbmRTdGF0ZSk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldENvbG9yV3JpdGUocmVkV3JpdGUsIGdyZWVuV3JpdGUsIGJsdWVXcml0ZSwgYWxwaGFXcml0ZSk7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuZ2V0QmxlbmRpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxlbmRTdGF0ZS5ibGVuZDtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZGluZyA9IGZ1bmN0aW9uIChibGVuZGluZykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldEJsZW5kaW5nIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkodGhpcy5ibGVuZFN0YXRlKTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuYmxlbmQgPSBibGVuZGluZztcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXREZXB0aFdyaXRlID0gZnVuY3Rpb24gKHdyaXRlKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0RGVwdGhXcml0ZSBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0RGVwdGhTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS5jb3B5KHRoaXMuZGVwdGhTdGF0ZSk7XG4gICAgX3RlbXBEZXB0aFN0YXRlLndyaXRlID0gd3JpdGU7XG4gICAgdGhpcy5zZXREZXB0aFN0YXRlKF90ZW1wRGVwdGhTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0RGVwdGhGdW5jID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXREZXB0aEZ1bmMgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldERlcHRoU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuY29weSh0aGlzLmRlcHRoU3RhdGUpO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS5mdW5jID0gZnVuYztcbiAgICB0aGlzLnNldERlcHRoU3RhdGUoX3RlbXBEZXB0aFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXREZXB0aFRlc3QgPSBmdW5jdGlvbiAodGVzdCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldERlcHRoVGVzdCBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0RGVwdGhTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS5jb3B5KHRoaXMuZGVwdGhTdGF0ZSk7XG4gICAgX3RlbXBEZXB0aFN0YXRlLnRlc3QgPSB0ZXN0O1xuICAgIHRoaXMuc2V0RGVwdGhTdGF0ZShfdGVtcERlcHRoU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLmdldEN1bGxNb2RlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmN1bGxNb2RlO1xufTtcblxuLy8gU0NFTkVcblxuZXhwb3J0IGNvbnN0IFBob25nTWF0ZXJpYWwgPSBTdGFuZGFyZE1hdGVyaWFsO1xuZXhwb3J0IGNvbnN0IExpdE9wdGlvbnMgPSBMaXRTaGFkZXJPcHRpb25zO1xuXG5leHBvcnQgY29uc3Qgc2NlbmUgPSB7XG4gICAgcGFydGl0aW9uU2tpbjogcGFydGl0aW9uU2tpbixcbiAgICBwcm9jZWR1cmFsOiB7XG4gICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzOiBjYWxjdWxhdGVUYW5nZW50cyxcbiAgICAgICAgY3JlYXRlTWVzaDogY3JlYXRlTWVzaCxcbiAgICAgICAgY3JlYXRlVG9ydXM6IGNyZWF0ZVRvcnVzLFxuICAgICAgICBjcmVhdGVDeWxpbmRlcjogY3JlYXRlQ3lsaW5kZXIsXG4gICAgICAgIGNyZWF0ZUNhcHN1bGU6IGNyZWF0ZUNhcHN1bGUsXG4gICAgICAgIGNyZWF0ZUNvbmU6IGNyZWF0ZUNvbmUsXG4gICAgICAgIGNyZWF0ZVNwaGVyZTogY3JlYXRlU3BoZXJlLFxuICAgICAgICBjcmVhdGVQbGFuZTogY3JlYXRlUGxhbmUsXG4gICAgICAgIGNyZWF0ZUJveDogY3JlYXRlQm94XG4gICAgfSxcbiAgICBCYXNpY01hdGVyaWFsOiBCYXNpY01hdGVyaWFsLFxuICAgIEZvcndhcmRSZW5kZXJlcjogRm9yd2FyZFJlbmRlcmVyLFxuICAgIEdyYXBoTm9kZTogR3JhcGhOb2RlLFxuICAgIE1hdGVyaWFsOiBNYXRlcmlhbCxcbiAgICBNZXNoOiBNZXNoLFxuICAgIE1lc2hJbnN0YW5jZTogTWVzaEluc3RhbmNlLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBQYXJ0aWNsZUVtaXR0ZXI6IFBhcnRpY2xlRW1pdHRlcixcbiAgICBQaG9uZ01hdGVyaWFsOiBTdGFuZGFyZE1hdGVyaWFsLFxuICAgIFBpY2tlcjogUGlja2VyLFxuICAgIFByb2plY3Rpb246IHtcbiAgICAgICAgT1JUSE9HUkFQSElDOiBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyxcbiAgICAgICAgUEVSU1BFQ1RJVkU6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkVcbiAgICB9LFxuICAgIFNjZW5lOiBTY2VuZSxcbiAgICBTa2luOiBTa2luLFxuICAgIFNraW5JbnN0YW5jZTogU2tpbkluc3RhbmNlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnZGVmYXVsdE1hdGVyaWFsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNkZWZhdWx0TWF0ZXJpYWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICAgICAgcmV0dXJuIGdldERlZmF1bHRNYXRlcmlhbChnZXRBcHBsaWNhdGlvbigpLmdyYXBoaWNzRGV2aWNlKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExheWVyQ29tcG9zaXRpb24ucHJvdG90eXBlLCAnX21lc2hJbnN0YW5jZXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkxheWVyQ29tcG9zaXRpb24jX21lc2hJbnN0YW5jZXMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsICdkcmF3Q2FsbHMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2RyYXdDYWxscyBpcyBkZXByZWNhdGVkIGFuZCBubyBsb25nZXIgcHJvdmlkZXMgbWVzaCBpbnN0YW5jZXMuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG4vLyBzY2VuZS5za3lib3hQcmVmaWx0ZXJlZCoqKiogYXJlIGRlcHJlY2F0ZWRcblsnMTI4JywgJzY0JywgJzMyJywgJzE2JywgJzgnLCAnNCddLmZvckVhY2goKHNpemUsIGluZGV4KSA9PiB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgYHNreWJveFByZWZpbHRlcmVkJHtzaXplfWAsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI3ByZWZpbHRlcmVkQ3ViZW1hcHMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzW2luZGV4XTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI3NreWJveFByZWZpbHRlcmVkJHtzaXplfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjcHJlZmlsdGVyZWRDdWJlbWFwcyBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnbW9kZWxzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX21vZGVscykge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscztcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExheWVyLnByb3RvdHlwZSwgJ3JlbmRlclRhcmdldCcsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uIChydCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5MYXllciNyZW5kZXJUYXJnZXQgaXMgZGVwcmVjYXRlZC4gU2V0IHRoZSByZW5kZXIgdGFyZ2V0IG9uIHRoZSBjYW1lcmEgaW5zdGVhZC5gKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJUYXJnZXQ7XG4gICAgfVxufSk7XG5cblNjZW5lLnByb3RvdHlwZS5hZGRNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2FkZE1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgaWYgKHRoaXMuY29udGFpbnNNb2RlbChtb2RlbCkpIHJldHVybjtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5hZGRTaGFkb3dDYXN0ZXIgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNhZGRTaGFkb3dDYXN0ZXIgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5yZW1vdmVNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI3JlbW92ZU1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgICAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxufTtcblxuU2NlbmUucHJvdG90eXBlLnJlbW92ZVNoYWRvd0Nhc3RlcnMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNyZW1vdmVTaGFkb3dDYXN0ZXJzIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuY29udGFpbnNNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2NvbnRhaW5zTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCkgPj0gMDtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5nZXRNb2RlbHMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNnZXRNb2RlbHMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHM7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmF0Y2gucHJvdG90eXBlLCAnbW9kZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkJhdGNoI21vZGVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5CYXRjaCNtZXNoSW5zdGFuY2UgdG8gYWNjZXNzIGJhdGNoZWQgbWVzaCBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59KTtcblxuRm9yd2FyZFJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXJDb21wb3NpdGlvbiA9IGZ1bmN0aW9uIChjb21wKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRm9yd2FyZFJlbmRlcmVyI3JlbmRlckNvbXBvc2l0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLnJlbmRlckNvbXBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgZ2V0QXBwbGljYXRpb24oKS5yZW5kZXJDb21wb3NpdGlvbihjb21wKTtcbn07XG5cbk1lc2hJbnN0YW5jZS5wcm90b3R5cGUuc3luY0FhYmIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWVzaEluc3RhbmNlI3N5bmNBYWJiIGlzIGRlcHJlY2F0ZWQuJyk7XG59O1xuXG5Nb3JwaC5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9ycGgjZ2V0VGFyZ2V0IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb3JwaCN0YXJnZXRzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy50YXJnZXRzW2luZGV4XTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuX2RpcnRpZnkgPSBmdW5jdGlvbiAobG9jYWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjX2RpcnRpZnkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNfZGlydGlmeUxvY2FsIG9yIF9kaXJ0aWZ5V29ybGQgcmVzcGVjdGl2ZWx5IGluc3RlYWQuJyk7XG4gICAgaWYgKGxvY2FsKVxuICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICBlbHNlXG4gICAgICAgIHRoaXMuX2RpcnRpZnlXb3JsZCgpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5hZGRMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNhZGRMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMuX2xhYmVsc1tsYWJlbF0gPSB0cnVlO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRMYWJlbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldExhYmVscyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9sYWJlbHMpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5oYXNMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNoYXNMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiAhIXRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLnJlbW92ZUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI3JlbW92ZUxhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgZGVsZXRlIHRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmZpbmRCeUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsLCByZXN1bHRzID0gW10pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZmluZEJ5TGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICBpZiAodGhpcy5oYXNMYWJlbChsYWJlbCkpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgcmVzdWx0cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRCeUxhYmVsKGxhYmVsLCByZXN1bHRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0Q2hpbGRyZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldENoaWxkcmVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjY2hpbGRyZW4gaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjbmFtZSBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0UGF0aCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhdGggaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnBhdGg7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFJvb3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFJvb3QgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNyb290IGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5yb290O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRQYXJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFBhcmVudCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhcmVudCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI25hbWUgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjZ2V0U2hhZGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNzaGFkZXIgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5zaGFkZXI7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuc2V0U2hhZGVyID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI3NldFNoYWRlciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjc2hhZGVyIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG59O1xuXG4vLyBOb3RlOiB0aGlzIGlzIHVzZWQgYnkgdGhlIEVkaXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1hdGVyaWFsLnByb3RvdHlwZSwgJ2JsZW5kJywge1xuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLk1hdGVyaWFsI2JsZW5kIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NYXRlcmlhbC5ibGVuZFN0YXRlLmApO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGUuYmxlbmQgPSB2YWx1ZTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZFN0YXRlLmJsZW5kO1xuICAgIH1cbn0pO1xuXG4vLyBOb3RlOiB0aGlzIGlzIHVzZWQgYnkgdGhlIEVkaXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1hdGVyaWFsLnByb3RvdHlwZSwgJ2JsZW5kU3JjJywge1xuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLk1hdGVyaWFsI2JsZW5kU3JjIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NYXRlcmlhbC5ibGVuZFN0YXRlLmApO1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5jb2xvck9wLCB2YWx1ZSwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3IpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0QWxwaGFCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wLCB2YWx1ZSwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGUgPSBfdGVtcEJsZW5kU3RhdGU7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvcjtcbiAgICB9XG59KTtcblxuLy8gTm90ZTogdGhpcyBpcyB1c2VkIGJ5IHRoZSBFZGl0b3Jcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNYXRlcmlhbC5wcm90b3R5cGUsICdibGVuZERzdCcsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5NYXRlcmlhbCNibGVuZERzdCBpcyBkZXByZWNhdGVkLCB1c2UgcGMuTWF0ZXJpYWwuYmxlbmRTdGF0ZS5gKTtcbiAgICAgICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KGN1cnJlbnRCbGVuZFN0YXRlKTtcbiAgICAgICAgX3RlbXBCbGVuZFN0YXRlLnNldENvbG9yQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JTcmNGYWN0b3IsIHZhbHVlKTtcbiAgICAgICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuYWxwaGFPcCwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFTcmNGYWN0b3IsIHZhbHVlKTtcbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlID0gX3RlbXBCbGVuZFN0YXRlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3I7XG4gICAgfVxufSk7XG5cbi8vIHNoaW5pbmVzcyAocmFuZ2UgMC4uMTAwKSAtIG1hcHMgdG8gaW50ZXJuYWwgZ2xvc3MgdmFsdWUgKHJhbmdlIDAuLjEpXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsICdzaGluaW5lc3MnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsb3NzICogMTAwO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5nbG9zcyA9IHZhbHVlICogMC4wMTtcbiAgICB9XG59KTtcblxuZnVuY3Rpb24gX2RlZmluZUFsaWFzKG5ld05hbWUsIG9sZE5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsIG9sZE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbbmV3TmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpc1tuZXdOYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbl9kZWZpbmVBbGlhcygnZGlmZnVzZVRpbnQnLCAnZGlmZnVzZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJUaW50JywgJ3NwZWN1bGFyTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVRpbnQnLCAnZW1pc3NpdmVNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2FvVmVydGV4Q29sb3InLCAnYW9NYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdkaWZmdXNlVmVydGV4Q29sb3InLCAnZGlmZnVzZU1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ3NwZWN1bGFyVmVydGV4Q29sb3InLCAnc3BlY3VsYXJNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVZlcnRleENvbG9yJywgJ2VtaXNzaXZlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbWV0YWxuZXNzVmVydGV4Q29sb3InLCAnbWV0YWxuZXNzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnZ2xvc3NWZXJ0ZXhDb2xvcicsICdnbG9zc01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ29wYWNpdHlWZXJ0ZXhDb2xvcicsICdvcGFjaXR5TWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbGlnaHRWZXJ0ZXhDb2xvcicsICdsaWdodE1hcFZlcnRleENvbG9yJyk7XG5cbl9kZWZpbmVBbGlhcygnc2hlZW5HbG9zcycsICdzaGVlbkdsb3NzaWVzcycpO1xuX2RlZmluZUFsaWFzKCdjbGVhckNvYXRHbG9zcycsICdjbGVhckNvc3RHbG9zc2luZXNzJyk7XG5cbmZ1bmN0aW9uIF9kZWZpbmVPcHRpb24obmFtZSwgbmV3TmFtZSkge1xuICAgIGlmIChuYW1lICE9PSAncGFzcycpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgR2V0dGluZyBwYy5PcHRpb25zIyR7bmFtZX0gaGFzIGJlZW4gZGVwcmVjYXRlZCBhcyB0aGUgcHJvcGVydHkgaGFzIGJlZW4gbW92ZWQgdG8gcGMuT3B0aW9ucy5MaXRTaGFkZXJPcHRpb25zIyR7bmV3TmFtZSB8fCBuYW1lfS5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5saXRPcHRpb25zW25ld05hbWUgfHwgbmFtZV07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBTZXR0aW5nIHBjLk9wdGlvbnMjJHtuYW1lfSBoYXMgYmVlbiBkZXByZWNhdGVkIGFzIHRoZSBwcm9wZXJ0eSBoYXMgYmVlbiBtb3ZlZCB0byBwYy5PcHRpb25zLkxpdFNoYWRlck9wdGlvbnMjJHtuZXdOYW1lIHx8IG5hbWV9LmApO1xuICAgICAgICAgICAgICAgIHRoaXMubGl0T3B0aW9uc1tuZXdOYW1lIHx8IG5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbl9kZWZpbmVPcHRpb24oJ3JlZnJhY3Rpb24nLCAndXNlUmVmcmFjdGlvbicpO1xuXG5jb25zdCB0ZW1wT3B0aW9ucyA9IG5ldyBMaXRTaGFkZXJPcHRpb25zKCk7XG5jb25zdCBsaXRPcHRpb25Qcm9wZXJ0aWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVtcE9wdGlvbnMpO1xuZm9yIChjb25zdCBsaXRPcHRpb24gaW4gbGl0T3B0aW9uUHJvcGVydGllcykge1xuICAgIF9kZWZpbmVPcHRpb24obGl0T3B0aW9uUHJvcGVydGllc1tsaXRPcHRpb25dKTtcbn1cblxuLy8gQU5JTUFUSU9OXG5cbmV4cG9ydCBjb25zdCBhbmltID0ge1xuICAgIEFuaW1hdGlvbjogQW5pbWF0aW9uLFxuICAgIEtleTogS2V5LFxuICAgIE5vZGU6IE5vZGUsXG4gICAgU2tlbGV0b246IFNrZWxldG9uXG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXREdXJhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI2R1cmF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5vZGVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5ub2Rlcztcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0RHVyYXRpb24gPSBmdW5jdGlvbiAoZHVyYXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jc2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5hbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TG9vcGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRMb29waW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNsb29waW5nIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubG9vcGluZztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXROdW1Ob2RlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXROdW1Ob2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbnVtTm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5udW1Ob2Rlcztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoYW5pbWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmFuaW1hdGlvbiA9IGFuaW1hdGlvbjtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uICh0aW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5jdXJyZW50VGltZSA9IHRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0TG9vcGluZyA9IGZ1bmN0aW9uIChsb29waW5nKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHRoaXMubG9vcGluZyA9IGxvb3Bpbmc7XG59O1xuXG4vLyBTT1VORFxuXG5leHBvcnQgY29uc3QgYXVkaW8gPSB7XG4gICAgQXVkaW9NYW5hZ2VyOiBTb3VuZE1hbmFnZXIsXG4gICAgQ2hhbm5lbDogQ2hhbm5lbCxcbiAgICBDaGFubmVsM2Q6IENoYW5uZWwzZCxcbiAgICBMaXN0ZW5lcjogTGlzdGVuZXIsXG4gICAgU291bmQ6IFNvdW5kXG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNnZXRMaXN0ZW5lciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI2xpc3RlbmVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubGlzdGVuZXI7XG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0Vm9sdW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjdm9sdW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI3NldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xufTtcblxuLy8gQVNTRVRcblxuZXhwb3J0IGNvbnN0IGFzc2V0ID0ge1xuICAgIEFTU0VUX0FOSU1BVElPTjogJ2FuaW1hdGlvbicsXG4gICAgQVNTRVRfQVVESU86ICdhdWRpbycsXG4gICAgQVNTRVRfSU1BR0U6ICdpbWFnZScsXG4gICAgQVNTRVRfSlNPTjogJ2pzb24nLFxuICAgIEFTU0VUX01PREVMOiAnbW9kZWwnLFxuICAgIEFTU0VUX01BVEVSSUFMOiAnbWF0ZXJpYWwnLFxuICAgIEFTU0VUX1RFWFQ6ICd0ZXh0JyxcbiAgICBBU1NFVF9URVhUVVJFOiAndGV4dHVyZScsXG4gICAgQVNTRVRfQ1VCRU1BUDogJ2N1YmVtYXAnLFxuICAgIEFTU0VUX1NDUklQVDogJ3NjcmlwdCdcbn07XG5cbkFzc2V0UmVnaXN0cnkucHJvdG90eXBlLmdldEFzc2V0QnlJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFzc2V0UmVnaXN0cnkjZ2V0QXNzZXRCeUlkIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Bc3NldFJlZ2lzdHJ5I2dldCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmdldChpZCk7XG59O1xuXG4vLyBYUlxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyYXknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcmF5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldE9yaWdpbiBhbmQgcGMuWHJJbnB1dFNvdXJjZSNnZXREaXJlY3Rpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JheUxvY2FsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdwb3NpdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNwb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFBvc2l0aW9uO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyb3RhdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNyb3RhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFJvdGF0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFJvdGF0aW9uO1xuICAgIH1cbn0pO1xuXG4vLyBJTlBVVFxuXG5leHBvcnQgY29uc3QgaW5wdXQgPSB7XG4gICAgZ2V0VG91Y2hUYXJnZXRDb29yZHM6IGdldFRvdWNoVGFyZ2V0Q29vcmRzLFxuICAgIENvbnRyb2xsZXI6IENvbnRyb2xsZXIsXG4gICAgR2FtZVBhZHM6IEdhbWVQYWRzLFxuICAgIEtleWJvYXJkOiBLZXlib2FyZCxcbiAgICBLZXlib2FyZEV2ZW50OiBLZXlib2FyZEV2ZW50LFxuICAgIE1vdXNlOiBNb3VzZSxcbiAgICBNb3VzZUV2ZW50OiBNb3VzZUV2ZW50LFxuICAgIFRvdWNoOiBUb3VjaCxcbiAgICBUb3VjaERldmljZTogVG91Y2hEZXZpY2UsXG4gICAgVG91Y2hFdmVudDogVG91Y2hFdmVudFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnRJbnB1dC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW91c2VFdmVudC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG4vLyBGUkFNRVdPUktcblxuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX1NUQVRJQyA9IEJPRFlUWVBFX1NUQVRJQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9EWU5BTUlDID0gQk9EWVRZUEVfRFlOQU1JQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9LSU5FTUFUSUMgPSBCT0RZVFlQRV9LSU5FTUFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QgPSBCT0RZRkxBR19TVEFUSUNfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUID0gQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfTk9SRVNQT05TRV9PQkpFQ1QgPSBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQUNUSVZFX1RBRyA9IEJPRFlTVEFURV9BQ1RJVkVfVEFHO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkcgPSBCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9XQU5UU19ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfV0FOVFNfREVBQ1RJVkFUSU9OO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OID0gQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTjtcblxuQXBwQmFzZS5wcm90b3R5cGUuaXNGdWxsc2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjaXNGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmVuYWJsZUZ1bGxzY3JlZW4gPSBmdW5jdGlvbiAoZWxlbWVudCwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2VuYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIGVsZW1lbnQgPSBlbGVtZW50IHx8IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICAvLyBlcnJvciBjYWxsYmFja1xuICAgIGNvbnN0IGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChlcnJvcikge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQucmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbihFbGVtZW50LkFMTE9XX0tFWUJPQVJEX0lOUFVUKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvcigpO1xuICAgIH1cbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmRpc2FibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2Rpc2FibGVGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICAvLyBzdWNjZXNzIGNhbGxiYWNrXG4gICAgY29uc3QgcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3VjY2VzcygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcyk7XG4gICAgfTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmdldFNjZW5lVXJsID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2dldFNjZW5lVXJsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNmaW5kIGluc3RlYWQuJyk7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnNjZW5lcy5maW5kKG5hbWUpO1xuICAgIGlmIChlbnRyeSkge1xuICAgICAgICByZXR1cm4gZW50cnkudXJsO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZUhpZXJhcmNoeSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmVIaWVyYXJjaHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZUhpZXJhcmNoeSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZVNldHRpbmdzID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2xvYWRTY2VuZVNldHRpbmdzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5ncyBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZVNldHRpbmdzKHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTWVzaEluc3RhbmNlID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTWVzaEluc3RhbmNlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdNZXNoSW5zdGFuY2UuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJNZXNoID0gZnVuY3Rpb24gKG1lc2gsIG1hdGVyaWFsLCBtYXRyaXgsIG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlck1lc2ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd01lc2guJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuX2FkZExpbmVzID0gZnVuY3Rpb24gKHBvc2l0aW9ucywgY29sb3JzLCBvcHRpb25zKSB7XG4gICAgY29uc3QgbGF5ZXIgPSAob3B0aW9ucyAmJiBvcHRpb25zLmxheWVyKSA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpO1xuICAgIGNvbnN0IGRlcHRoVGVzdCA9IChvcHRpb25zICYmIG9wdGlvbnMuZGVwdGhUZXN0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aFRlc3QgOiB0cnVlO1xuXG4gICAgY29uc3QgYmF0Y2ggPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNvbG9yKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlckxpbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmUuJyk7XG5cbiAgICBsZXQgZW5kQ29sb3IgPSBjb2xvcjtcbiAgICBsZXQgb3B0aW9ucztcblxuICAgIGNvbnN0IGFyZzMgPSBhcmd1bWVudHNbM107XG4gICAgY29uc3QgYXJnNCA9IGFyZ3VtZW50c1s0XTtcblxuICAgIGlmIChhcmczIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgLy8gcGFzc2VkIGluIGVuZCBjb2xvclxuICAgICAgICBlbmRDb2xvciA9IGFyZzM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhcmc0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgICAgICBpZiAoYXJnNCA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdXNlIHBhc3NlZCBpbiBvcHRpb25zXG4gICAgICAgICAgICBvcHRpb25zID0gYXJnNDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZzMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGVuZENvbG9yID0gY29sb3I7XG5cbiAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgIGlmIChhcmczID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFyZzMpIHtcbiAgICAgICAgLy8gb3B0aW9ucyBwYXNzZWQgaW5cbiAgICAgICAgb3B0aW9ucyA9IGFyZzM7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGVuZENvbG9yXSwgb3B0aW9ucyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lcyA9IGZ1bmN0aW9uIChwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTGluZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmVzLicpO1xuXG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgIC8vIGRlZmF1bHQgb3B0aW9uXG4gICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBMSU5FQkFUQ0hfT1ZFUkxBWSBsaW5lcyBoYXZlIGRlcHRodGVzdCBkaXNhYmxlZFxuICAgICAgICBpZiAob3B0aW9ucyA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbXVsdGlDb2xvciA9ICEhY29sb3IubGVuZ3RoO1xuICAgIGlmIChtdWx0aUNvbG9yKSB7XG4gICAgICAgIGlmIChwb3NpdGlvbi5sZW5ndGggIT09IGNvbG9yLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IHBvc2l0aW9uL2NvbG9yIGFycmF5cyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAlIDIgIT09IDApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IGFycmF5IGxlbmd0aCBpcyBub3QgZGl2aXNpYmxlIGJ5IDInKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9hZGRMaW5lcyhwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZW5hYmxlVnIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNlbmFibGVWUiBpcyBkZXByZWNhdGVkLCBhbmQgV2ViVlIgQVBJIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuJyk7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FtZXJhQ29tcG9uZW50LnByb3RvdHlwZSwgJ25vZGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNhbWVyYUNvbXBvbmVudCNub2RlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5DYW1lcmFDb21wb25lbnQjZW50aXR5IGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVudGl0eTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExpZ2h0Q29tcG9uZW50LnByb3RvdHlwZSwgJ2VuYWJsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTGlnaHRDb21wb25lbnQjZW5hYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5MaWdodENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVuYWJsZWQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5MaWdodENvbXBvbmVudCNlbmFibGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbk1vZGVsQ29tcG9uZW50LnByb3RvdHlwZS5zZXRWaXNpYmxlID0gZnVuY3Rpb24gKHZpc2libGUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNzZXRWaXNpYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgdGhpcy5lbmFibGVkID0gdmlzaWJsZTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNb2RlbENvbXBvbmVudC5wcm90b3R5cGUsICdhYWJiJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZW5kZXJDb21wb25lbnQucHJvdG90eXBlLCAnYWFiYicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlckNvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmVuZGVyQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsICdib2R5VHlwZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I2JvZHlUeXBlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnQjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy50eXBlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjYm9keVR5cGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudCN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgfVxufSk7XG5cblJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUuc3luY0JvZHlUb0VudGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjc3luY0JvZHlUb0VudGl0eSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIHRoaXMuX3VwZGF0ZUR5bmFtaWMoKTtcbn07XG5cblJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5wcm90b3R5cGUuc2V0R3Jhdml0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jc2V0R3Jhdml0eSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2dyYXZpdHkgaW5zdGVhZC4nKTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRoaXMuZ3Jhdml0eS5jb3B5KGFyZ3VtZW50c1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ncmF2aXR5LnNldChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICB9XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBiYXNpc1NldERvd25sb2FkQ29uZmlnKGdsdWVVcmwsIHdhc21VcmwsIGZhbGxiYWNrVXJsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuYmFzaXNTZXREb3dubG9hZENvbmZpZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuYmFzaXNJbml0aWFsaXplIGluc3RlYWQuJyk7XG4gICAgYmFzaXNJbml0aWFsaXplKHtcbiAgICAgICAgZ2x1ZVVybDogZ2x1ZVVybCxcbiAgICAgICAgd2FzbVVybDogd2FzbVVybCxcbiAgICAgICAgZmFsbGJhY2tVcmw6IGZhbGxiYWNrVXJsLFxuICAgICAgICBsYXp5SW5pdDogdHJ1ZVxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlZmlsdGVyQ3ViZW1hcChvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMucHJlZmlsdGVyQ3ViZW1hcCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuZW52TGlnaHRpbmcgaW5zdGVhZC4nKTtcbn1cbiJdLCJuYW1lcyI6WyJMSU5FQkFUQ0hfV09STEQiLCJMSU5FQkFUQ0hfT1ZFUkxBWSIsIkxJTkVCQVRDSF9HSVpNTyIsImxvZyIsIndyaXRlIiwidGV4dCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImNvbnNvbGUiLCJvcGVuIiwidmVyc2lvbiIsInJldmlzaW9uIiwiaW5mbyIsImRlYnVnIiwiZXJyb3IiLCJ3YXJuaW5nIiwid2FybiIsImFsZXJ0IiwiYXNzZXJ0IiwiY29uZGl0aW9uIiwic3RyaW5nIiwiZW5kc1dpdGgiLCJzIiwic3VicyIsInN0YXJ0c1dpdGgiLCJUaW1lciIsImNvbnN0cnVjdG9yIiwiX2lzUnVubmluZyIsIl9hIiwiX2IiLCJzdGFydCIsIm5vdyIsInN0b3AiLCJnZXRNaWxsaXNlY29uZHMiLCJ0aW1lIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJDb2xvciIsInByb3RvdHlwZSIsImdldCIsIl9kYXRhIiwiRmxvYXQzMkFycmF5IiwiciIsImciLCJiIiwiYSIsIl9kYXRhMyIsImluaGVyaXRzIiwiU2VsZiIsIlN1cGVyIiwiVGVtcCIsIkZ1bmMiLCJhcmcxIiwiYXJnMiIsImFyZzMiLCJhcmc0IiwiYXJnNSIsImFyZzYiLCJhcmc3IiwiYXJnOCIsImNhbGwiLCJfc3VwZXIiLCJtYWtlQXJyYXkiLCJhcnIiLCJBcnJheSIsInNsaWNlIiwiY3JlYXRlU3R5bGUiLCJjc3NTdHJpbmciLCJyZXN1bHQiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJ0eXBlIiwic3R5bGVTaGVldCIsImNzc1RleHQiLCJhcHBlbmRDaGlsZCIsImNyZWF0ZVRleHROb2RlIiwibWF0aCIsIklOVl9MT0cyIiwiTWF0aCIsIkxPRzJFIiwiaW50VG9CeXRlcyIsImludFRvQnl0ZXMzMiIsImJ5dGVzVG9JbnQiLCJieXRlc1RvSW50MzIiLCJWZWMyIiwieCIsInkiLCJzY2FsZSIsIm11bFNjYWxhciIsIlZlYzMiLCJ6IiwiVmVjNCIsInciLCJzaGFwZSIsIkFhYmIiLCJCb3VuZGluZ0JveCIsIlNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiUGxhbmUiLCJpbnRlcnNlY3RSYXkiLCJpbnRlcnNlY3RzUmF5IiwiRnJ1c3R1bSIsInVwZGF0ZSIsInByb2plY3Rpb25NYXRyaXgiLCJ2aWV3TWF0cml4Iiwidmlld1Byb2oiLCJNYXQ0IiwibXVsMiIsInNldEZyb21NYXQ0IiwiRUxFTUVOVFRZUEVfSU5UOCIsIlRZUEVfSU5UOCIsIkVMRU1FTlRUWVBFX1VJTlQ4IiwiVFlQRV9VSU5UOCIsIkVMRU1FTlRUWVBFX0lOVDE2IiwiVFlQRV9JTlQxNiIsIkVMRU1FTlRUWVBFX1VJTlQxNiIsIlRZUEVfVUlOVDE2IiwiRUxFTUVOVFRZUEVfSU5UMzIiLCJUWVBFX0lOVDMyIiwiRUxFTUVOVFRZUEVfVUlOVDMyIiwiVFlQRV9VSU5UMzIiLCJFTEVNRU5UVFlQRV9GTE9BVDMyIiwiVFlQRV9GTE9BVDMyIiwiUElYRUxGT1JNQVRfTDhfQTgiLCJQSVhFTEZPUk1BVF9MQTgiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1I1X0c1X0I1X0ExIiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCIsIlBJWEVMRk9STUFUX1JHQkE0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjgiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIkJMRU5ETU9ERV9DT05TVEFOVF9DT0xPUiIsIkJMRU5ETU9ERV9DT05TVEFOVCIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UIiwiQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBIiwiQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9BTFBIQSIsIlVuc3VwcG9ydGVkQnJvd3NlckVycm9yIiwibWVzc2FnZSIsIm5hbWUiLCJFcnJvciIsIkNvbnRleHRDcmVhdGlvbkVycm9yIiwicHJvZ3JhbWxpYiIsImJlZ2luIiwiU2hhZGVyR2VuZXJhdG9yIiwiZHVtbXlGcmFnbWVudENvZGUiLCJTaGFkZXJVdGlscyIsImVuZCIsImZvZ0NvZGUiLCJnYW1tYUNvZGUiLCJwcmVjaXNpb25Db2RlIiwic2tpbkNvZGUiLCJ0b25lbWFwQ29kZSIsInZlcnNpb25Db2RlIiwiZ2Z4IiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIkJMRU5ETU9ERV9aRVJPIiwiQkxFTkRNT0RFX09ORSIsIkJMRU5ETU9ERV9TUkNfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9EU1RfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9TUkNfQUxQSEEiLCJCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEiLCJCTEVORE1PREVfRFNUX0FMUEhBIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEiLCJCVUZGRVJfU1RBVElDIiwiQlVGRkVSX0RZTkFNSUMiLCJCVUZGRVJfU1RSRUFNIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJDVUxMRkFDRV9GUk9OVCIsIkNVTExGQUNFX0ZST05UQU5EQkFDSyIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfVEVYQ09PUkQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19BVFRSMCIsIlNFTUFOVElDX0FUVFIxIiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlRFWFRVUkVMT0NLX1JFQUQiLCJURVhUVVJFTE9DS19XUklURSIsImRyYXdRdWFkV2l0aFNoYWRlciIsInNoYWRlckNodW5rcyIsIkRldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiSW5kZXhCdWZmZXIiLCJQcm9ncmFtTGlicmFyeSIsIlJlbmRlclRhcmdldCIsIlNjb3BlSWQiLCJTaGFkZXIiLCJTaGFkZXJJbnB1dCIsIldlYmdsU2hhZGVySW5wdXQiLCJUZXh0dXJlIiwiVmVydGV4QnVmZmVyIiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4SXRlcmF0b3IiLCJfdmlld3BvcnQiLCJkcmF3RnVsbHNjcmVlblF1YWQiLCJkZXZpY2UiLCJ0YXJnZXQiLCJ2ZXJ0ZXhCdWZmZXIiLCJzaGFkZXIiLCJyZWN0Iiwidmlld3BvcnQiLCJ3aWR0aCIsImgiLCJoZWlnaHQiLCJzZXQiLCJwb3N0ZWZmZWN0IiwiY3JlYXRlRnVsbHNjcmVlblF1YWQiLCJxdWFkVmVydGV4QnVmZmVyIiwiUG9zdEVmZmVjdCIsIlBvc3RFZmZlY3RRdWV1ZSIsInRyYW5zZm9ybVZTIiwiZGVwcmVjYXRlZENodW5rcyIsImtleXMiLCJmb3JFYWNoIiwiY2h1bmtOYW1lIiwicmVwbGFjZW1lbnQiLCJ1c2VJbnN0ZWFkIiwibXNnIiwiY29tcGF0aWJpbGl0eUZvckxpdEFyZ3MiLCJzcmMiLCJpbmNsdWRlcyIsInJlcGxhY2UiLCJuZXdTb3VyY2UiLCJMaXRTaGFkZXIiLCJoYW5kbGVDb21wYXRpYmlsaXR5IiwiZnNoYWRlciIsImRlZmluZVByb3BlcnRpZXMiLCJfZ2xGcmFtZUJ1ZmZlciIsImltcGwiLCJyZ2JtIiwiVEVYVFVSRVRZUEVfUkdCTSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJzd2l6emxlR0dHUiIsIlRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIiwiX2dsVGV4dHVyZSIsImF1dG9NaXBtYXAiLCJfbWlwbWFwcyIsInZhbHVlIiwiaXNXZWJHTDIiLCJnZXRQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwibGliIiwicmVtb3ZlU2hhZGVyRnJvbUNhY2hlIiwicmVtb3ZlRnJvbUNhY2hlIiwiQmxlbmRTdGF0ZSIsIkRFRkFVTFQiLCJmcmVlemUiLCJfdGVtcEJsZW5kU3RhdGUiLCJfdGVtcERlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwic2V0QmxlbmRGdW5jdGlvbiIsImJsZW5kU3JjIiwiYmxlbmREc3QiLCJjdXJyZW50QmxlbmRTdGF0ZSIsImJsZW5kU3RhdGUiLCJjb3B5Iiwic2V0Q29sb3JCbGVuZCIsImNvbG9yT3AiLCJzZXRBbHBoYUJsZW5kIiwiYWxwaGFPcCIsInNldEJsZW5kU3RhdGUiLCJzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUiLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNldEJsZW5kRXF1YXRpb24iLCJibGVuZEVxdWF0aW9uIiwiY29sb3JTcmNGYWN0b3IiLCJjb2xvckRzdEZhY3RvciIsImFscGhhU3JjRmFjdG9yIiwiYWxwaGFEc3RGYWN0b3IiLCJzZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUiLCJibGVuZEFscGhhRXF1YXRpb24iLCJzZXRDb2xvcldyaXRlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsImdldEJsZW5kaW5nIiwiYmxlbmQiLCJzZXRCbGVuZGluZyIsImJsZW5kaW5nIiwic2V0RGVwdGhXcml0ZSIsImRlcHRoU3RhdGUiLCJzZXREZXB0aFN0YXRlIiwic2V0RGVwdGhGdW5jIiwiZnVuYyIsInNldERlcHRoVGVzdCIsInRlc3QiLCJnZXRDdWxsTW9kZSIsImN1bGxNb2RlIiwiUGhvbmdNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJMaXRPcHRpb25zIiwiTGl0U2hhZGVyT3B0aW9ucyIsInNjZW5lIiwicGFydGl0aW9uU2tpbiIsInByb2NlZHVyYWwiLCJjYWxjdWxhdGVUYW5nZW50cyIsImNyZWF0ZU1lc2giLCJjcmVhdGVUb3J1cyIsImNyZWF0ZUN5bGluZGVyIiwiY3JlYXRlQ2Fwc3VsZSIsImNyZWF0ZUNvbmUiLCJjcmVhdGVTcGhlcmUiLCJjcmVhdGVQbGFuZSIsImNyZWF0ZUJveCIsIkJhc2ljTWF0ZXJpYWwiLCJGb3J3YXJkUmVuZGVyZXIiLCJHcmFwaE5vZGUiLCJNYXRlcmlhbCIsIk1lc2giLCJNZXNoSW5zdGFuY2UiLCJNb2RlbCIsIlBhcnRpY2xlRW1pdHRlciIsIlBpY2tlciIsIlByb2plY3Rpb24iLCJPUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlNjZW5lIiwiU2tpbiIsIlNraW5JbnN0YW5jZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImdldEFwcGxpY2F0aW9uIiwiZ3JhcGhpY3NEZXZpY2UiLCJMYXllckNvbXBvc2l0aW9uIiwic2l6ZSIsImluZGV4IiwiX3ByZWZpbHRlcmVkQ3ViZW1hcHMiLCJ1cGRhdGVTaGFkZXJzIiwiX21vZGVscyIsIkxheWVyIiwicnQiLCJfcmVuZGVyVGFyZ2V0IiwiX2RpcnR5Q29tcG9zaXRpb24iLCJhZGRNb2RlbCIsIm1vZGVsIiwiY29udGFpbnNNb2RlbCIsImxheWVyIiwibGF5ZXJzIiwiZ2V0TGF5ZXJCeUlkIiwiTEFZRVJJRF9XT1JMRCIsImFkZE1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzIiwibW9kZWxzIiwicHVzaCIsImFkZFNoYWRvd0Nhc3RlciIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZW1vdmVNb2RlbCIsImluZGV4T2YiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwic3BsaWNlIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImdldE1vZGVscyIsIkJhdGNoIiwicmVuZGVyQ29tcG9zaXRpb24iLCJjb21wIiwic3luY0FhYmIiLCJNb3JwaCIsImdldFRhcmdldCIsInRhcmdldHMiLCJfZGlydGlmeSIsImxvY2FsIiwiX2RpcnRpZnlMb2NhbCIsIl9kaXJ0aWZ5V29ybGQiLCJhZGRMYWJlbCIsImxhYmVsIiwiX2xhYmVscyIsImdldExhYmVscyIsImhhc0xhYmVsIiwicmVtb3ZlTGFiZWwiLCJmaW5kQnlMYWJlbCIsInJlc3VsdHMiLCJpIiwiX2NoaWxkcmVuIiwibGVuZ3RoIiwiZ2V0Q2hpbGRyZW4iLCJjaGlsZHJlbiIsImdldE5hbWUiLCJnZXRQYXRoIiwicGF0aCIsImdldFJvb3QiLCJyb290IiwiZ2V0UGFyZW50IiwicGFyZW50Iiwic2V0TmFtZSIsImdldFNoYWRlciIsInNldFNoYWRlciIsImdsb3NzIiwiX2RlZmluZUFsaWFzIiwibmV3TmFtZSIsIm9sZE5hbWUiLCJfZGVmaW5lT3B0aW9uIiwiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMiLCJsaXRPcHRpb25zIiwidGVtcE9wdGlvbnMiLCJsaXRPcHRpb25Qcm9wZXJ0aWVzIiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImxpdE9wdGlvbiIsImFuaW0iLCJBbmltYXRpb24iLCJLZXkiLCJOb2RlIiwiU2tlbGV0b24iLCJnZXREdXJhdGlvbiIsImR1cmF0aW9uIiwiZ2V0Tm9kZXMiLCJub2RlcyIsInNldER1cmF0aW9uIiwiZ2V0QW5pbWF0aW9uIiwiYW5pbWF0aW9uIiwiZ2V0Q3VycmVudFRpbWUiLCJjdXJyZW50VGltZSIsImdldExvb3BpbmciLCJsb29waW5nIiwiZ2V0TnVtTm9kZXMiLCJudW1Ob2RlcyIsInNldEFuaW1hdGlvbiIsInNldEN1cnJlbnRUaW1lIiwic2V0TG9vcGluZyIsImF1ZGlvIiwiQXVkaW9NYW5hZ2VyIiwiU291bmRNYW5hZ2VyIiwiQ2hhbm5lbCIsIkNoYW5uZWwzZCIsIkxpc3RlbmVyIiwiU291bmQiLCJnZXRMaXN0ZW5lciIsImxpc3RlbmVyIiwiZ2V0Vm9sdW1lIiwidm9sdW1lIiwic2V0Vm9sdW1lIiwiYXNzZXQiLCJBU1NFVF9BTklNQVRJT04iLCJBU1NFVF9BVURJTyIsIkFTU0VUX0lNQUdFIiwiQVNTRVRfSlNPTiIsIkFTU0VUX01PREVMIiwiQVNTRVRfTUFURVJJQUwiLCJBU1NFVF9URVhUIiwiQVNTRVRfVEVYVFVSRSIsIkFTU0VUX0NVQkVNQVAiLCJBU1NFVF9TQ1JJUFQiLCJBc3NldFJlZ2lzdHJ5IiwiZ2V0QXNzZXRCeUlkIiwiaWQiLCJYcklucHV0U291cmNlIiwiX3JheUxvY2FsIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxSb3RhdGlvbiIsImlucHV0IiwiZ2V0VG91Y2hUYXJnZXRDb29yZHMiLCJDb250cm9sbGVyIiwiR2FtZVBhZHMiLCJLZXlib2FyZCIsIktleWJvYXJkRXZlbnQiLCJNb3VzZSIsIk1vdXNlRXZlbnQiLCJUb3VjaCIsIlRvdWNoRGV2aWNlIiwiVG91Y2hFdmVudCIsIkVsZW1lbnRJbnB1dCIsIndoZWVsRGVsdGEiLCJSSUdJREJPRFlfVFlQRV9TVEFUSUMiLCJCT0RZVFlQRV9TVEFUSUMiLCJSSUdJREJPRFlfVFlQRV9EWU5BTUlDIiwiQk9EWVRZUEVfRFlOQU1JQyIsIlJJR0lEQk9EWV9UWVBFX0tJTkVNQVRJQyIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIlJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfU1RBVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9OT1JFU1BPTlNFX09CSkVDVCIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiUklHSURCT0RZX0FDVElWRV9UQUciLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsIlJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkciLCJCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HIiwiUklHSURCT0RZX1dBTlRTX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OIiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsIkFwcEJhc2UiLCJpc0Z1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsImVuYWJsZUZ1bGxzY3JlZW4iLCJlbGVtZW50Iiwic3VjY2VzcyIsImNhbnZhcyIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJlIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlcXVlc3RGdWxsc2NyZWVuIiwiRWxlbWVudCIsIkFMTE9XX0tFWUJPQVJEX0lOUFVUIiwiZGlzYWJsZUZ1bGxzY3JlZW4iLCJleGl0RnVsbHNjcmVlbiIsImdldFNjZW5lVXJsIiwiZW50cnkiLCJzY2VuZXMiLCJmaW5kIiwidXJsIiwibG9hZFNjZW5lIiwiY2FsbGJhY2siLCJsb2FkU2NlbmVIaWVyYXJjaHkiLCJsb2FkU2NlbmVTZXR0aW5ncyIsInJlbmRlck1lc2hJbnN0YW5jZSIsIm1lc2hJbnN0YW5jZSIsIm9wdGlvbnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiaW1tZWRpYXRlIiwiZHJhd01lc2giLCJyZW5kZXJNZXNoIiwibWVzaCIsIm1hdGVyaWFsIiwibWF0cml4IiwiX2FkZExpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZXB0aFRlc3QiLCJ1bmRlZmluZWQiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJyZW5kZXJMaW5lIiwiY29sb3IiLCJlbmRDb2xvciIsImFyZ3VtZW50cyIsInJlbmRlckxpbmVzIiwicG9zaXRpb24iLCJtdWx0aUNvbG9yIiwiZW5hYmxlVnIiLCJDYW1lcmFDb21wb25lbnQiLCJlbnRpdHkiLCJMaWdodENvbXBvbmVudCIsImVuYWJsZWQiLCJNb2RlbENvbXBvbmVudCIsInNldFZpc2libGUiLCJ2aXNpYmxlIiwiUmVuZGVyQ29tcG9uZW50IiwiUmlnaWRCb2R5Q29tcG9uZW50Iiwic3luY0JvZHlUb0VudGl0eSIsIl91cGRhdGVEeW5hbWljIiwiUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIiwic2V0R3Jhdml0eSIsImdyYXZpdHkiLCJiYXNpc1NldERvd25sb2FkQ29uZmlnIiwiZ2x1ZVVybCIsIndhc21VcmwiLCJmYWxsYmFja1VybCIsImJhc2lzSW5pdGlhbGl6ZSIsImxhenlJbml0IiwicHJlZmlsdGVyQ3ViZW1hcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXlIQTtBQUNPLE1BQU1BLGVBQWUsR0FBRyxFQUFDO0FBQ3pCLE1BQU1DLGlCQUFpQixHQUFHLEVBQUM7QUFDM0IsTUFBTUMsZUFBZSxHQUFHLEVBQUM7QUFFekIsTUFBTUMsR0FBRyxHQUFHO0FBQ2ZDLEVBQUFBLEtBQUss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
