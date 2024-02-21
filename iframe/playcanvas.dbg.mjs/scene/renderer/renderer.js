import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { LightCube } from '../graphics/light-cube.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_FRONT, CULLFACE_BACK, CULLFACE_NONE, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT3, UNIFORMTYPE_VEC3, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_INT, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, BINDGROUP_VIEW, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindBufferFormat, BindTextureFormat, BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { ShadowRenderer } from './shadow-renderer.js';
import { WorldClustersAllocator } from './world-clusters-allocator.js';
import { RenderPassUpdateClustered } from './render-pass-update-clustered.js';
import { getBlueNoiseTexture } from '../graphics/blue-noise-texture.js';
import { BlueNoise } from '../../core/math/blue-noise.js';

let _skinUpdateIndex = 0;
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const tempSphere = new BoundingSphere();
const _flipYMat = new Mat4().setScale(1, -1, 1);
const _tempLightSet = new Set();
const _tempLayerSet = new Set();
const _tempVec4 = new Vec4();

// Converts a projection matrix in OpenGL style (depth range of -1..1) to a DirectX style (depth range of 0..1).
const _fixProjRangeMat = new Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);

// helton sequence of 2d offsets for jittering
const _haltonSequence = [new Vec2(0.5, 0.333333), new Vec2(0.25, 0.666667), new Vec2(0.75, 0.111111), new Vec2(0.125, 0.444444), new Vec2(0.625, 0.777778), new Vec2(0.375, 0.222222), new Vec2(0.875, 0.555556), new Vec2(0.0625, 0.888889), new Vec2(0.5625, 0.037037), new Vec2(0.3125, 0.370370), new Vec2(0.8125, 0.703704), new Vec2(0.1875, 0.148148), new Vec2(0.6875, 0.481481), new Vec2(0.4375, 0.814815), new Vec2(0.9375, 0.259259), new Vec2(0.03125, 0.592593)];
const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempProjMat4 = new Mat4();
const _tempProjMat5 = new Mat4();
const _tempSet = new Set();
const _tempMeshInstances = [];
const _tempMeshInstancesSkinned = [];

/**
 * The base renderer functionality to allow implementation of specialized renderers.
 *
 * @ignore
 */
class Renderer {
  /**
   * Create a new instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device used by the renderer.
   */
  constructor(graphicsDevice) {
    /** @type {boolean} */
    this.clustersDebugRendered = false;
    /**
     * A set of visible mesh instances which need further processing before being rendered, e.g.
     * skinning or morphing. Extracted during culling.
     *
     * @type {Set<import('../mesh-instance.js').MeshInstance>}
     * @private
     */
    this.processingMeshInstances = new Set();
    /**
     * @type {WorldClustersAllocator}
     * @ignore
     */
    this.worldClustersAllocator = void 0;
    /**
     * A list of all unique lights in the layer composition.
     *
     * @type {import('../light.js').Light[]}
     */
    this.lights = [];
    /**
     * A list of all unique local lights (spot & omni) in the layer composition.
     *
     * @type {import('../light.js').Light[]}
     */
    this.localLights = [];
    /**
     * A list of unique directional shadow casting lights for each enabled camera. This is generated
     * each frame during light culling.
     *
     * @type {Map<import('../camera.js').Camera, Array<import('../light.js').Light>>}
     */
    this.cameraDirShadowLights = new Map();
    /**
     * A mapping of a directional light to a camera, for which the shadow is currently valid. This
     * is cleared each frame, and updated each time a directional light shadow is rendered for a
     * camera, and allows us to manually schedule shadow passes when a new camera needs a shadow.
     *
     * @type {Map<import('../light.js').Light, import('../camera.js').Camera>}
     */
    this.dirLightShadows = new Map();
    this.blueNoise = new BlueNoise(123);
    this.device = graphicsDevice;

    /** @type {import('../scene.js').Scene|null} */
    this.scene = null;

    // TODO: allocate only when the scene has clustered lighting enabled
    this.worldClustersAllocator = new WorldClustersAllocator(graphicsDevice);

    // texture atlas managing shadow map / cookie texture atlassing for omni and spot lights
    this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);

    // shadows
    this.shadowMapCache = new ShadowMapCache();
    this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
    this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
    this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);

    // clustered passes
    this._renderPassUpdateClustered = new RenderPassUpdateClustered(this.device, this, this.shadowRenderer, this._shadowRendererLocal, this.lightTextureAtlas);

    // view bind group format with its uniform buffer format
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;

    // timing
    this._skinTime = 0;
    this._morphTime = 0;
    this._cullTime = 0;
    this._shadowMapTime = 0;
    this._lightClustersTime = 0;
    this._layerCompositionUpdateTime = 0;

    // stats
    this._shadowDrawCalls = 0;
    this._skinDrawCalls = 0;
    this._instancedDrawCalls = 0;
    this._shadowMapUpdates = 0;
    this._numDrawCallsCulled = 0;
    this._camerasRendered = 0;
    this._lightClusters = 0;

    // Uniforms
    const scope = graphicsDevice.scope;
    this.boneTextureId = scope.resolve('texture_poseMap');
    this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
    this.poseMatrixId = scope.resolve('matrix_pose[0]');
    this.modelMatrixId = scope.resolve('matrix_model');
    this.normalMatrixId = scope.resolve('matrix_normal');
    this.viewInvId = scope.resolve('matrix_viewInverse');
    this.viewPos = new Float32Array(3);
    this.viewPosId = scope.resolve('view_position');
    this.projId = scope.resolve('matrix_projection');
    this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
    this.viewId = scope.resolve('matrix_view');
    this.viewId3 = scope.resolve('matrix_view3');
    this.viewProjId = scope.resolve('matrix_viewProjection');
    this.flipYId = scope.resolve('projectionFlipY');
    this.tbnBasis = scope.resolve('tbnBasis');
    this.nearClipId = scope.resolve('camera_near');
    this.farClipId = scope.resolve('camera_far');
    this.cameraParams = new Float32Array(4);
    this.cameraParamsId = scope.resolve('camera_params');
    this.viewIndexId = scope.resolve('view_index');
    this.blueNoiseJitterId = scope.resolve('blueNoiseJitter');
    this.blueNoiseTextureId = scope.resolve('blueNoiseTex32');
    this.alphaTestId = scope.resolve('alpha_ref');
    this.opacityMapId = scope.resolve('texture_opacityMap');
    this.exposureId = scope.resolve('exposure');
    this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');
    this.twoSidedLightingNegScaleFactorId.setValue(0);
    this.morphWeightsA = scope.resolve('morph_weights_a');
    this.morphWeightsB = scope.resolve('morph_weights_b');
    this.morphPositionTex = scope.resolve('morphPositionTex');
    this.morphNormalTex = scope.resolve('morphNormalTex');
    this.morphTexParams = scope.resolve('morph_tex_params');

    // a single instance of light cube
    this.lightCube = new LightCube();
    this.constantLightCube = scope.resolve('lightCube[0]');
  }
  destroy() {
    this.shadowRenderer = null;
    this._shadowRendererLocal = null;
    this._shadowRendererDirectional = null;
    this.shadowMapCache.destroy();
    this.shadowMapCache = null;
    this._renderPassUpdateClustered.destroy();
    this._renderPassUpdateClustered = null;
    this.lightTextureAtlas.destroy();
    this.lightTextureAtlas = null;
  }
  sortCompare(drawCallA, drawCallB) {
    if (drawCallA.layer === drawCallB.layer) {
      if (drawCallA.drawOrder && drawCallB.drawOrder) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
      } else if (drawCallA.zdist && drawCallB.zdist) {
        return drawCallB.zdist - drawCallA.zdist; // back to front
      } else if (drawCallA.zdist2 && drawCallB.zdist2) {
        return drawCallA.zdist2 - drawCallB.zdist2; // front to back
      }
    }

    return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
  }
  sortCompareMesh(drawCallA, drawCallB) {
    if (drawCallA.layer === drawCallB.layer) {
      if (drawCallA.drawOrder && drawCallB.drawOrder) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
      } else if (drawCallA.zdist && drawCallB.zdist) {
        return drawCallB.zdist - drawCallA.zdist; // back to front
      }
    }

    const keyA = drawCallA._key[SORTKEY_FORWARD];
    const keyB = drawCallB._key[SORTKEY_FORWARD];
    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
  }
  sortCompareDepth(drawCallA, drawCallB) {
    const keyA = drawCallA._key[SORTKEY_DEPTH];
    const keyB = drawCallB._key[SORTKEY_DEPTH];
    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
  }

  /**
   * Set up the viewport and the scissor for camera rendering.
   *
   * @param {import('../camera.js').Camera} camera - The camera containing the viewport
   * information.
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} [renderTarget] - The
   * render target. NULL for the default one.
   */
  setupViewport(camera, renderTarget) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'SETUP-VIEWPORT');
    const pixelWidth = renderTarget ? renderTarget.width : device.width;
    const pixelHeight = renderTarget ? renderTarget.height : device.height;
    const rect = camera.rect;
    let x = Math.floor(rect.x * pixelWidth);
    let y = Math.floor(rect.y * pixelHeight);
    let w = Math.floor(rect.z * pixelWidth);
    let h = Math.floor(rect.w * pixelHeight);
    device.setViewport(x, y, w, h);

    // use viewport rectangle by default. Use scissor rectangle when required.
    if (camera._scissorRectClear) {
      const scissorRect = camera.scissorRect;
      x = Math.floor(scissorRect.x * pixelWidth);
      y = Math.floor(scissorRect.y * pixelHeight);
      w = Math.floor(scissorRect.z * pixelWidth);
      h = Math.floor(scissorRect.w * pixelHeight);
    }
    device.setScissor(x, y, w, h);
    DebugGraphics.popGpuMarker(device);
  }
  setCameraUniforms(camera, target) {
    // flipping proj matrix
    const flipY = target == null ? void 0 : target.flipY;
    let viewCount = 1;
    if (camera.xr && camera.xr.session) {
      var _camera$_node;
      const transform = ((_camera$_node = camera._node) == null || (_camera$_node = _camera$_node.parent) == null ? void 0 : _camera$_node.getWorldTransform()) || null;
      const views = camera.xr.views;
      viewCount = views.list.length;
      for (let v = 0; v < viewCount; v++) {
        const view = views.list[v];
        view.updateTransforms(transform);
        camera.frustum.setFromMat4(view.projViewOffMat);
      }
    } else {
      // Projection Matrix
      let projMat = camera.projectionMatrix;
      if (camera.calculateProjection) {
        camera.calculateProjection(projMat, VIEW_CENTER);
      }
      let projMatSkybox = camera.getProjectionMatrixSkybox();

      // flip projection matrices
      if (flipY) {
        projMat = _tempProjMat0.mul2(_flipYMat, projMat);
        projMatSkybox = _tempProjMat1.mul2(_flipYMat, projMatSkybox);
      }

      // update depth range of projection matrices (-1..1 to 0..1)
      if (this.device.isWebGPU) {
        projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
        projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
      }

      // camera jitter
      const {
        jitter
      } = camera;
      let noise = Vec4.ZERO;
      if (jitter > 0) {
        // render target size
        const targetWidth = target ? target.width : this.device.width;
        const targetHeight = target ? target.height : this.device.height;

        // offsets
        const offset = _haltonSequence[this.device.renderVersion % _haltonSequence.length];
        const offsetX = jitter * (offset.x * 2 - 1) / targetWidth;
        const offsetY = jitter * (offset.y * 2 - 1) / targetHeight;

        // apply offset to projection matrix
        projMat = _tempProjMat4.copy(projMat);
        projMat.data[8] = offsetX;
        projMat.data[9] = offsetY;

        // apply offset to skybox projection matrix
        projMatSkybox = _tempProjMat5.copy(projMatSkybox);
        projMatSkybox.data[8] = offsetX;
        projMatSkybox.data[9] = offsetY;

        // blue noise vec4 - only set when jitter is enabled
        noise = this.blueNoise.vec4(_tempVec4);
      }
      this.blueNoiseJitterId.setValue([noise.x, noise.y, noise.z, noise.w]);
      this.projId.setValue(projMat.data);
      this.projSkyboxId.setValue(projMatSkybox.data);

      // ViewInverse Matrix
      if (camera.calculateTransform) {
        camera.calculateTransform(viewInvMat, VIEW_CENTER);
      } else {
        const pos = camera._node.getPosition();
        const rot = camera._node.getRotation();
        viewInvMat.setTRS(pos, rot, Vec3.ONE);
      }
      this.viewInvId.setValue(viewInvMat.data);

      // View Matrix
      viewMat.copy(viewInvMat).invert();
      this.viewId.setValue(viewMat.data);

      // View 3x3
      viewMat3.setFromMat4(viewMat);
      this.viewId3.setValue(viewMat3.data);

      // ViewProjection Matrix
      viewProjMat.mul2(projMat, viewMat);
      this.viewProjId.setValue(viewProjMat.data);
      this.flipYId.setValue(flipY ? -1 : 1);

      // View Position (world space)
      this.dispatchViewPos(camera._node.getPosition());
      camera.frustum.setFromMat4(viewProjMat);
    }
    this.tbnBasis.setValue(flipY ? -1 : 1);

    // Near and far clip values
    const n = camera._nearClip;
    const f = camera._farClip;
    this.nearClipId.setValue(n);
    this.farClipId.setValue(f);

    // camera params
    this.cameraParams[0] = 1 / f;
    this.cameraParams[1] = f;
    this.cameraParams[2] = n;
    this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
    this.cameraParamsId.setValue(this.cameraParams);

    // exposure
    this.exposureId.setValue(this.scene.physicalUnits ? camera.getExposure() : this.scene.exposure);
    return viewCount;
  }

  /**
   * Clears the active render target. If the viewport is already set up, only its area is cleared.
   *
   * @param {import('../camera.js').Camera} camera - The camera supplying the value to clear to.
   * @param {boolean} [clearColor] - True if the color buffer should be cleared. Uses the value
   * from the camera if not supplied.
   * @param {boolean} [clearDepth] - True if the depth buffer should be cleared. Uses the value
   * from the camera if not supplied.
   * @param {boolean} [clearStencil] - True if the stencil buffer should be cleared. Uses the
   * value from the camera if not supplied.
   */
  clear(camera, clearColor, clearDepth, clearStencil) {
    const flags = ((clearColor != null ? clearColor : camera._clearColorBuffer) ? CLEARFLAG_COLOR : 0) | ((clearDepth != null ? clearDepth : camera._clearDepthBuffer) ? CLEARFLAG_DEPTH : 0) | ((clearStencil != null ? clearStencil : camera._clearStencilBuffer) ? CLEARFLAG_STENCIL : 0);
    if (flags) {
      const device = this.device;
      DebugGraphics.pushGpuMarker(device, 'CLEAR');
      device.clear({
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        stencil: camera._clearStencil,
        flags: flags
      });
      DebugGraphics.popGpuMarker(device);
    }
  }

  // make sure colorWrite is set to true to all channels, if you want to fully clear the target
  // TODO: this function is only used from outside of forward renderer, and should be deprecated
  // when the functionality moves to the render passes. Note that Editor uses it as well.
  setCamera(camera, target, clear, renderAction = null) {
    this.setCameraUniforms(camera, target);
    this.clearView(camera, target, clear, false);
  }

  // TODO: this is currently used by the lightmapper and the Editor,
  // and will be removed when those call are removed.
  clearView(camera, target, clear, forceWrite) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEW');
    device.setRenderTarget(target);
    device.updateBegin();
    if (forceWrite) {
      device.setColorWrite(true, true, true, true);
      device.setDepthWrite(true);
    }
    this.setupViewport(camera, target);
    if (clear) {
      // use camera clear options if any
      const options = camera._clearOptions;
      device.clear(options ? options : {
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) | (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) | (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
        stencil: camera._clearStencil
      });
    }
    DebugGraphics.popGpuMarker(device);
  }
  setupCullMode(cullFaces, flipFactor, drawCall) {
    const material = drawCall.material;
    let mode = CULLFACE_NONE;
    if (cullFaces) {
      let flipFaces = 1;
      if (material.cull === CULLFACE_FRONT || material.cull === CULLFACE_BACK) {
        flipFaces = flipFactor * drawCall.flipFacesFactor * drawCall.node.worldScaleSign;
      }
      if (flipFaces < 0) {
        mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
      } else {
        mode = material.cull;
      }
    }
    this.device.setCullMode(mode);
    if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
      this.twoSidedLightingNegScaleFactorId.setValue(drawCall.node.worldScaleSign);
    }
  }
  updateCameraFrustum(camera) {
    if (camera.xr && camera.xr.views.list.length) {
      // calculate frustum based on XR view
      const view = camera.xr.views.list[0];
      viewProjMat.mul2(view.projMat, view.viewOffMat);
      camera.frustum.setFromMat4(viewProjMat);
      return;
    }
    const projMat = camera.projectionMatrix;
    if (camera.calculateProjection) {
      camera.calculateProjection(projMat, VIEW_CENTER);
    }
    if (camera.calculateTransform) {
      camera.calculateTransform(viewInvMat, VIEW_CENTER);
    } else {
      const pos = camera._node.getPosition();
      const rot = camera._node.getRotation();
      viewInvMat.setTRS(pos, rot, Vec3.ONE);
      this.viewInvId.setValue(viewInvMat.data);
    }
    viewMat.copy(viewInvMat).invert();
    viewProjMat.mul2(projMat, viewMat);
    camera.frustum.setFromMat4(viewProjMat);
  }
  setBaseConstants(device, material) {
    // Cull mode
    device.setCullMode(material.cull);

    // Alpha test
    if (material.opacityMap) {
      this.opacityMapId.setValue(material.opacityMap);
    }
    if (material.opacityMap || material.alphaTest > 0) {
      this.alphaTestId.setValue(material.alphaTest);
    }
  }
  updateCpuSkinMatrices(drawCalls) {
    _skinUpdateIndex++;
    const drawCallsCount = drawCalls.length;
    if (drawCallsCount === 0) return;
    const skinTime = now();
    for (let i = 0; i < drawCallsCount; i++) {
      const si = drawCalls[i].skinInstance;
      if (si) {
        si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
        si._dirty = true;
      }
    }
    this._skinTime += now() - skinTime;
  }

  /**
   * Update skin matrices ahead of rendering.
   *
   * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
   * containing skinInstance.
   * @ignore
   */
  updateGpuSkinMatrices(drawCalls) {
    const skinTime = now();
    for (const drawCall of drawCalls) {
      const skin = drawCall.skinInstance;
      if (skin && skin._dirty) {
        skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
        skin._dirty = false;
      }
    }
    this._skinTime += now() - skinTime;
  }

  /**
   * Update morphing ahead of rendering.
   *
   * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
   * containing morphInstance.
   * @ignore
   */
  updateMorphing(drawCalls) {
    const morphTime = now();
    for (const drawCall of drawCalls) {
      const morphInst = drawCall.morphInstance;
      if (morphInst && morphInst._dirty) {
        morphInst.update();
      }
    }
    this._morphTime += now() - morphTime;
  }

  /**
   * Update gsplats ahead of rendering.
   *
   * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
   * containing gsplatInstances.
   * @ignore
   */
  updateGSplats(drawCalls) {
    for (const drawCall of drawCalls) {
      var _drawCall$gsplatInsta;
      (_drawCall$gsplatInsta = drawCall.gsplatInstance) == null || _drawCall$gsplatInsta.update();
    }
  }

  /**
   * Update draw calls ahead of rendering.
   *
   * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
   * requiring updates.
   * @ignore
   */
  gpuUpdate(drawCalls) {
    // Note that drawCalls can be either a Set or an Array and contains mesh instances
    // that are visible in this frame
    this.updateGpuSkinMatrices(drawCalls);
    this.updateMorphing(drawCalls);
    this.updateGSplats(drawCalls);
  }
  setVertexBuffers(device, mesh) {
    // main vertex buffer
    device.setVertexBuffer(mesh.vertexBuffer);
  }
  setMorphing(device, morphInstance) {
    if (morphInstance) {
      if (morphInstance.morph.useTextureMorph) {
        // vertex buffer with vertex ids
        device.setVertexBuffer(morphInstance.morph.vertexBufferIds);

        // textures
        this.morphPositionTex.setValue(morphInstance.texturePositions);
        this.morphNormalTex.setValue(morphInstance.textureNormals);

        // texture params
        this.morphTexParams.setValue(morphInstance._textureParams);
      } else {
        // vertex attributes based morphing

        for (let t = 0; t < morphInstance._activeVertexBuffers.length; t++) {
          const vb = morphInstance._activeVertexBuffers[t];
          if (vb) {
            // patch semantic for the buffer to current ATTR slot (using ATTR8 - ATTR15 range)
            const semantic = SEMANTIC_ATTR + (t + 8);
            vb.format.elements[0].name = semantic;
            vb.format.elements[0].scopeId = device.scope.resolve(semantic);
            vb.format.update();
            device.setVertexBuffer(vb);
          }
        }

        // set all 8 weights
        this.morphWeightsA.setValue(morphInstance._shaderMorphWeightsA);
        this.morphWeightsB.setValue(morphInstance._shaderMorphWeightsB);
      }
    }
  }
  setSkinning(device, meshInstance) {
    const skinInstance = meshInstance.skinInstance;
    if (skinInstance) {
      this._skinDrawCalls++;
      if (device.supportsBoneTextures) {
        const boneTexture = skinInstance.boneTexture;
        this.boneTextureId.setValue(boneTexture);
        this.boneTextureSizeId.setValue(skinInstance.boneTextureSize);
      } else {
        this.poseMatrixId.setValue(skinInstance.matrixPalette);
      }
    }
  }

  // sets Vec3 camera position uniform
  dispatchViewPos(position) {
    const vp = this.viewPos; // note that this reuses an array
    vp[0] = position.x;
    vp[1] = position.y;
    vp[2] = position.z;
    this.viewPosId.setValue(vp);
  }
  initViewBindGroupFormat(isClustered) {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      // format of the view uniform buffer
      const uniforms = [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4), new UniformFormat("cubeMapRotationMatrix", UNIFORMTYPE_MAT3), new UniformFormat("view_position", UNIFORMTYPE_VEC3), new UniformFormat("skyboxIntensity", UNIFORMTYPE_FLOAT), new UniformFormat("exposure", UNIFORMTYPE_FLOAT), new UniformFormat("textureBias", UNIFORMTYPE_FLOAT)];
      if (isClustered) {
        uniforms.push(...[new UniformFormat("clusterCellsCountByBoundsSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterTextureSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsMin", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsDelta", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsDot", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsMax", UNIFORMTYPE_VEC3), new UniformFormat("clusterCompressionLimit0", UNIFORMTYPE_VEC2), new UniformFormat("shadowAtlasParams", UNIFORMTYPE_VEC2), new UniformFormat("clusterMaxCells", UNIFORMTYPE_INT), new UniformFormat("clusterSkip", UNIFORMTYPE_FLOAT)]);
      }
      this.viewUniformFormat = new UniformBufferFormat(this.device, uniforms);

      // format of the view bind group - contains single uniform buffer, and some textures
      const buffers = [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)];
      const textures = [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('shadowAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH), new BindTextureFormat('cookieAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex1', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex2', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT)];
      if (isClustered) {
        textures.push(...[new BindTextureFormat('clusterWorldTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
      }
      this.viewBindGroupFormat = new BindGroupFormat(this.device, buffers, textures);
    }
  }
  setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {
    Debug.assert(Array.isArray(viewBindGroups), "viewBindGroups must be an array");
    const device = this.device;
    Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");
    while (viewBindGroups.length < viewCount) {
      const ub = new UniformBuffer(device, viewUniformFormat, false);
      const bg = new BindGroup(device, viewBindGroupFormat, ub);
      DebugHelper.setName(bg, `ViewBindGroup_${bg.id}`);
      viewBindGroups.push(bg);
    }

    // update view bind group / uniforms
    const viewBindGroup = viewBindGroups[0];
    viewBindGroup.defaultUniformBuffer.update();
    viewBindGroup.update();

    // TODO; this needs to be moved to drawInstance functions to handle XR
    device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
  }
  setupMeshUniformBuffers(shaderInstance, meshInstance) {
    const device = this.device;
    if (device.supportsUniformBuffers) {
      // TODO: model matrix setup is part of the drawInstance call, but with uniform buffer it's needed
      // earlier here. This needs to be refactored for multi-view anyways.
      this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
      this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);

      // update mesh bind group / uniform buffer
      const meshBindGroup = shaderInstance.getBindGroup(device);
      meshBindGroup.defaultUniformBuffer.update();
      meshBindGroup.update();
      device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
    }
  }
  drawInstance(device, meshInstance, mesh, style, normal) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    const modelMatrix = meshInstance.node.worldTransform;
    this.modelMatrixId.setValue(modelMatrix.data);
    if (normal) {
      this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
    }
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.setVertexBuffer(instancingData.vertexBuffer);
        device.draw(mesh.primitive[style], instancingData.count);
      }
    } else {
      device.draw(mesh.primitive[style]);
    }
    DebugGraphics.popGpuMarker(device);
  }

  // used for stereo
  drawInstance2(device, meshInstance, mesh, style) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.draw(mesh.primitive[style], instancingData.count, true);
      }
    } else {
      // matrices are already set
      device.draw(mesh.primitive[style], undefined, true);
    }
    DebugGraphics.popGpuMarker(device);
  }

  /**
   * @param {import('../camera.js').Camera} camera - The camera used for culling.
   * @param {import('../mesh-instance.js').MeshInstance[]} drawCalls - Draw calls to cull.
   * @param {import('../layer.js').CulledInstances} culledInstances - Stores culled instances.
   */
  cull(camera, drawCalls, culledInstances) {
    const cullTime = now();
    const opaque = culledInstances.opaque;
    opaque.length = 0;
    const transparent = culledInstances.transparent;
    transparent.length = 0;
    const doCull = camera.frustumCulling;
    const count = drawCalls.length;
    for (let i = 0; i < count; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.visible) {
        const visible = !doCull || !drawCall.cull || drawCall._isVisible(camera);
        if (visible) {
          drawCall.visibleThisFrame = true;

          // sort mesh instance into the right bucket based on its transparency
          const bucket = drawCall.transparent ? transparent : opaque;
          bucket.push(drawCall);
          if (drawCall.skinInstance || drawCall.morphInstance || drawCall.gsplatInstance) {
            this.processingMeshInstances.add(drawCall);

            // register visible cameras
            if (drawCall.gsplatInstance) {
              drawCall.gsplatInstance.cameras.push(camera);
            }
          }
        }
      }
    }
    this._cullTime += now() - cullTime;
    this._numDrawCallsCulled += doCull ? count : 0;
  }
  collectLights(comp) {
    // build a list and of all unique lights from all layers
    this.lights.length = 0;
    this.localLights.length = 0;

    // stats
    const stats = this.scene._stats;
    stats.dynamicLights = 0;
    stats.bakedLights = 0;
    const count = comp.layerList.length;
    for (let i = 0; i < count; i++) {
      const layer = comp.layerList[i];

      // layer can be in the list two times (opaque, transp), process it only one time
      if (!_tempLayerSet.has(layer)) {
        _tempLayerSet.add(layer);
        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          const light = lights[j];

          // add new light
          if (!_tempLightSet.has(light)) {
            _tempLightSet.add(light);
            this.lights.push(light);
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {
              this.localLights.push(light);
            }

            // if affects dynamic or baked objects in real-time
            if (light.mask & MASK_AFFECT_DYNAMIC || light.mask & MASK_AFFECT_LIGHTMAPPED) {
              stats.dynamicLights++;
            }

            // bake lights
            if (light.mask & MASK_BAKE) {
              stats.bakedLights++;
            }
          }
        }
      }
    }
    stats.lights = this.lights.length;
    _tempLightSet.clear();
    _tempLayerSet.clear();
  }
  cullLights(camera, lights) {
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    const physicalUnits = this.scene.physicalUnits;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (light.enabled) {
        // directional lights are marked visible at the start of the frame
        if (light._type !== LIGHTTYPE_DIRECTIONAL) {
          light.getBoundingSphere(tempSphere);
          if (camera.frustum.containsSphere(tempSphere)) {
            light.visibleThisFrame = true;
            light.usePhysicalUnits = physicalUnits;

            // maximum screen area taken by the light
            const screenSize = camera.getScreenSize(tempSphere);
            light.maxScreenSize = Math.max(light.maxScreenSize, screenSize);
          } else {
            // if shadow casting light does not have shadow map allocated, mark it visible to allocate shadow map
            // Note: This won't be needed when clustered shadows are used, but at the moment even culled out lights
            // are used for rendering, and need shadow map to be allocated
            // TODO: delete this code when clusteredLightingEnabled is being removed and is on by default.
            if (!clusteredLightingEnabled) {
              if (light.castShadows && !light.shadowMap) {
                light.visibleThisFrame = true;
              }
            }
          }
        } else {
          light.usePhysicalUnits = this.scene.physicalUnits;
        }
      }
    }
  }

  /**
   * Shadow map culling for directional and visible local lights
   * visible meshInstances are collected into light._renderData, and are marked as visible
   * for directional lights also shadow camera matrix is set up
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  cullShadowmaps(comp) {
    const isClustered = this.scene.clusteredLightingEnabled;

    // shadow casters culling for local (point and spot) lights
    for (let i = 0; i < this.localLights.length; i++) {
      const light = this.localLights[i];
      if (light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (isClustered) {
          // if atlas slot is reassigned, make sure to update the shadow map, including the culling
          if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
          }
        } else {
          // force rendering shadow at least once to allocate the shadow map needed by the shaders
          if (light.shadowUpdateMode === SHADOWUPDATE_NONE && light.castShadows) {
            if (!light.getRenderData(null, 0).shadowCamera.renderTarget) {
              light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            }
          }
        }
        if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
          this._shadowRendererLocal.cull(light, comp);
        }
      }
    }

    // shadow casters culling for directional lights - start with none and collect lights for cameras
    this.cameraDirShadowLights.clear();
    const cameras = comp.cameras;
    for (let i = 0; i < cameras.length; i++) {
      const cameraComponent = cameras[i];
      if (cameraComponent.enabled) {
        const camera = cameraComponent.camera;

        // get directional lights from all layers of the camera
        let lightList;
        const cameraLayers = camera.layers;
        for (let l = 0; l < cameraLayers.length; l++) {
          const cameraLayer = comp.getLayerById(cameraLayers[l]);
          if (cameraLayer) {
            const layerDirLights = cameraLayer.splitLights[LIGHTTYPE_DIRECTIONAL];
            for (let j = 0; j < layerDirLights.length; j++) {
              const light = layerDirLights[j];

              // unique shadow casting lights
              if (light.castShadows && !_tempSet.has(light)) {
                var _lightList;
                _tempSet.add(light);
                lightList = (_lightList = lightList) != null ? _lightList : [];
                lightList.push(light);

                // frustum culling for the directional shadow when rendering the camera
                this._shadowRendererDirectional.cull(light, comp, camera);
              }
            }
          }
        }
        if (lightList) {
          this.cameraDirShadowLights.set(camera, lightList);
        }
        _tempSet.clear();
      }
    }
  }

  /**
   * visibility culling of lights, meshInstances, shadows casters
   * Also applies meshInstance.visible
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  cullComposition(comp) {
    const cullTime = now();
    this.processingMeshInstances.clear();

    // for all cameras
    const numCameras = comp.cameras.length;
    for (let i = 0; i < numCameras; i++) {
      const camera = comp.cameras[i];
      let currentRenderTarget;
      let cameraChanged = true;
      this._camerasRendered++;

      // for all of its enabled layers
      const layerIds = camera.layers;
      for (let j = 0; j < layerIds.length; j++) {
        const layer = comp.getLayerById(layerIds[j]);
        if (layer && layer.enabled) {
          var _camera$renderTarget;
          // update camera and frustum when the render target changes
          // TODO: This is done here to handle the backwards compatibility with the deprecated Layer.renderTarget,
          // when this is no longer needed, this code can be moved up to execute once per camera.
          const renderTarget = (_camera$renderTarget = camera.renderTarget) != null ? _camera$renderTarget : layer.renderTarget;
          if (cameraChanged || renderTarget !== currentRenderTarget) {
            cameraChanged = false;
            currentRenderTarget = renderTarget;
            camera.frameUpdate(renderTarget);
            this.updateCameraFrustum(camera.camera);
          }

          // cull each layer's non-directional lights once with each camera
          // lights aren't collected anywhere, but marked as visible
          this.cullLights(camera.camera, layer._lights);

          // cull mesh instances
          layer.onPreCull == null || layer.onPreCull(comp.camerasMap.get(camera));
          const culledInstances = layer.getCulledInstances(camera.camera);
          this.cull(camera.camera, layer.meshInstances, culledInstances);
          layer.onPostCull == null || layer.onPostCull(comp.camerasMap.get(camera));
        }
      }
    }

    // update shadow / cookie atlas allocation for the visible lights. Update it after the ligthts were culled,
    // but before shadow maps were culling, as it might force some 'update once' shadows to cull.
    if (this.scene.clusteredLightingEnabled) {
      this.updateLightTextureAtlas();
    }

    // cull shadow casters for all lights
    this.cullShadowmaps(comp);
    this._cullTime += now() - cullTime;
  }

  /**
   * @param {import('../mesh-instance.js').MeshInstance[]} drawCalls - Mesh instances.
   * @param {boolean} onlyLitShaders - Limits the update to shaders affected by lighting.
   */
  updateShaders(drawCalls, onlyLitShaders) {
    const count = drawCalls.length;
    for (let i = 0; i < count; i++) {
      const mat = drawCalls[i].material;
      if (mat) {
        // material not processed yet
        if (!_tempSet.has(mat)) {
          _tempSet.add(mat);

          // skip this for materials not using variants
          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            if (onlyLitShaders) {
              // skip materials not using lighting
              if (!mat.useLighting || mat.emitter && !mat.emitter.lighting) continue;
            }

            // clear shader variants on the material and also on mesh instances that use it
            mat.clearVariants();
          }
        }
      }
    }

    // keep temp set empty
    _tempSet.clear();
  }
  updateFrameUniforms() {
    // blue noise texture
    this.blueNoiseTextureId.setValue(getBlueNoiseTexture(this.device));
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition to update.
   */
  beginFrame(comp) {
    const scene = this.scene;
    const updateShaders = scene.updateShaders;
    let totalMeshInstances = 0;
    const layers = comp.layerList;
    const layerCount = layers.length;
    for (let i = 0; i < layerCount; i++) {
      const layer = layers[i];
      const meshInstances = layer.meshInstances;
      const count = meshInstances.length;
      totalMeshInstances += count;
      for (let j = 0; j < count; j++) {
        const meshInst = meshInstances[j];

        // clear visibility
        meshInst.visibleThisFrame = false;

        // collect all mesh instances if we need to update their shaders. Note that there could
        // be duplicates, which is not a problem for the shader updates, so we do not filter them out.
        if (updateShaders) {
          _tempMeshInstances.push(meshInst);
        }

        // collect skinned mesh instances
        if (meshInst.skinInstance) {
          _tempMeshInstancesSkinned.push(meshInst);
        }
      }
    }
    scene._stats.meshInstances = totalMeshInstances;

    // update shaders if needed
    if (updateShaders) {
      const onlyLitShaders = !scene.updateShaders;
      this.updateShaders(_tempMeshInstances, onlyLitShaders);
      scene.updateShaders = false;
      scene._shaderVersion++;
    }
    this.updateFrameUniforms();

    // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
    this.updateCpuSkinMatrices(_tempMeshInstancesSkinned);

    // clear light arrays
    _tempMeshInstances.length = 0;
    _tempMeshInstancesSkinned.length = 0;

    // clear light visibility
    const lights = this.lights;
    const lightCount = lights.length;
    for (let i = 0; i < lightCount; i++) {
      lights[i].beginFrame();
    }
  }
  updateLightTextureAtlas() {
    this.lightTextureAtlas.update(this.localLights, this.scene.lighting);
  }

  /**
   * Updates the layer composition for rendering.
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition to update.
   */
  updateLayerComposition(comp) {
    const layerCompositionUpdateTime = now();
    const len = comp.layerList.length;
    for (let i = 0; i < len; i++) {
      comp.layerList[i]._postRenderCounter = 0;
    }
    const scene = this.scene;
    const shaderVersion = scene._shaderVersion;
    for (let i = 0; i < len; i++) {
      const layer = comp.layerList[i];
      layer._shaderVersion = shaderVersion;
      layer._skipRenderCounter = 0;
      layer._forwardDrawCalls = 0;
      layer._shadowDrawCalls = 0;
      layer._renderTime = 0;
      layer._preRenderCalledForCameras = 0;
      layer._postRenderCalledForCameras = 0;
      const transparent = comp.subLayerList[i];
      if (transparent) {
        layer._postRenderCounter |= 2;
      } else {
        layer._postRenderCounter |= 1;
      }
      layer._postRenderCounterMax = layer._postRenderCounter;
    }

    // update composition
    comp._update();
    this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
  }
  frameUpdate() {
    this.clustersDebugRendered = false;
    this.initViewBindGroupFormat(this.scene.clusteredLightingEnabled);

    // no valid shadows at the start of the frame
    this.dirLightShadows.clear();
  }
}

export { Renderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuXG5pbXBvcnQge1xuICAgIFNPUlRLRVlfREVQVEgsIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBWSUVXX0NFTlRFUiwgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCwgTUFTS19CQUtFLFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTGlnaHRDdWJlIH0gZnJvbSAnLi4vZ3JhcGhpY3MvbGlnaHQtY3ViZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQ0xFQVJGTEFHX0NPTE9SLCBDTEVBUkZMQUdfREVQVEgsIENMRUFSRkxBR19TVEVOQ0lMLFxuICAgIEJJTkRHUk9VUF9NRVNILCBCSU5ER1JPVVBfVklFVywgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsXG4gICAgVU5JRk9STVRZUEVfTUFUNCwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfVkVDMywgVU5JRk9STVRZUEVfVkVDMiwgVU5JRk9STVRZUEVfRkxPQVQsIFVOSUZPUk1UWVBFX0lOVCxcbiAgICBTSEFERVJTVEFHRV9WRVJURVgsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULFxuICAgIFNFTUFOVElDX0FUVFIsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX05PTkUsXG4gICAgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQsIFNBTVBMRVRZUEVfRkxPQVQsIFNBTVBMRVRZUEVfREVQVEhcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgQmluZEdyb3VwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtRm9ybWF0LCBVbmlmb3JtQnVmZmVyRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5cbmltcG9ydCB7IFNoYWRvd01hcENhY2hlIH0gZnJvbSAnLi9zaGFkb3ctbWFwLWNhY2hlLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyTG9jYWwgfSBmcm9tICcuL3NoYWRvdy1yZW5kZXJlci1sb2NhbC5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXItZGlyZWN0aW9uYWwuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXIgfSBmcm9tICcuL3NoYWRvdy1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzQWxsb2NhdG9yIH0gZnJvbSAnLi93b3JsZC1jbHVzdGVycy1hbGxvY2F0b3IuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzc1VwZGF0ZUNsdXN0ZXJlZCB9IGZyb20gJy4vcmVuZGVyLXBhc3MtdXBkYXRlLWNsdXN0ZXJlZC5qcyc7XG5pbXBvcnQgeyBnZXRCbHVlTm9pc2VUZXh0dXJlIH0gZnJvbSAnLi4vZ3JhcGhpY3MvYmx1ZS1ub2lzZS10ZXh0dXJlLmpzJztcbmltcG9ydCB7IEJsdWVOb2lzZSB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9ibHVlLW5vaXNlLmpzJztcblxubGV0IF9za2luVXBkYXRlSW5kZXggPSAwO1xuY29uc3Qgdmlld1Byb2pNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld0ludk1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3TWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdNYXQzID0gbmV3IE1hdDMoKTtcbmNvbnN0IHRlbXBTcGhlcmUgPSBuZXcgQm91bmRpbmdTcGhlcmUoKTtcbmNvbnN0IF9mbGlwWU1hdCA9IG5ldyBNYXQ0KCkuc2V0U2NhbGUoMSwgLTEsIDEpO1xuY29uc3QgX3RlbXBMaWdodFNldCA9IG5ldyBTZXQoKTtcbmNvbnN0IF90ZW1wTGF5ZXJTZXQgPSBuZXcgU2V0KCk7XG5jb25zdCBfdGVtcFZlYzQgPSBuZXcgVmVjNCgpO1xuXG4vLyBDb252ZXJ0cyBhIHByb2plY3Rpb24gbWF0cml4IGluIE9wZW5HTCBzdHlsZSAoZGVwdGggcmFuZ2Ugb2YgLTEuLjEpIHRvIGEgRGlyZWN0WCBzdHlsZSAoZGVwdGggcmFuZ2Ugb2YgMC4uMSkuXG5jb25zdCBfZml4UHJvalJhbmdlTWF0ID0gbmV3IE1hdDQoKS5zZXQoW1xuICAgIDEsIDAsIDAsIDAsXG4gICAgMCwgMSwgMCwgMCxcbiAgICAwLCAwLCAwLjUsIDAsXG4gICAgMCwgMCwgMC41LCAxXG5dKTtcblxuLy8gaGVsdG9uIHNlcXVlbmNlIG9mIDJkIG9mZnNldHMgZm9yIGppdHRlcmluZ1xuY29uc3QgX2hhbHRvblNlcXVlbmNlID0gW1xuICAgIG5ldyBWZWMyKDAuNSwgMC4zMzMzMzMpLFxuICAgIG5ldyBWZWMyKDAuMjUsIDAuNjY2NjY3KSxcbiAgICBuZXcgVmVjMigwLjc1LCAwLjExMTExMSksXG4gICAgbmV3IFZlYzIoMC4xMjUsIDAuNDQ0NDQ0KSxcbiAgICBuZXcgVmVjMigwLjYyNSwgMC43Nzc3NzgpLFxuICAgIG5ldyBWZWMyKDAuMzc1LCAwLjIyMjIyMiksXG4gICAgbmV3IFZlYzIoMC44NzUsIDAuNTU1NTU2KSxcbiAgICBuZXcgVmVjMigwLjA2MjUsIDAuODg4ODg5KSxcbiAgICBuZXcgVmVjMigwLjU2MjUsIDAuMDM3MDM3KSxcbiAgICBuZXcgVmVjMigwLjMxMjUsIDAuMzcwMzcwKSxcbiAgICBuZXcgVmVjMigwLjgxMjUsIDAuNzAzNzA0KSxcbiAgICBuZXcgVmVjMigwLjE4NzUsIDAuMTQ4MTQ4KSxcbiAgICBuZXcgVmVjMigwLjY4NzUsIDAuNDgxNDgxKSxcbiAgICBuZXcgVmVjMigwLjQzNzUsIDAuODE0ODE1KSxcbiAgICBuZXcgVmVjMigwLjkzNzUsIDAuMjU5MjU5KSxcbiAgICBuZXcgVmVjMigwLjAzMTI1LCAwLjU5MjU5Mylcbl07XG5cbmNvbnN0IF90ZW1wUHJvak1hdDAgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MSA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQyID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDMgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0NCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQ1ID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wU2V0ID0gbmV3IFNldCgpO1xuXG5jb25zdCBfdGVtcE1lc2hJbnN0YW5jZXMgPSBbXTtcbmNvbnN0IF90ZW1wTWVzaEluc3RhbmNlc1NraW5uZWQgPSBbXTtcblxuLyoqXG4gKiBUaGUgYmFzZSByZW5kZXJlciBmdW5jdGlvbmFsaXR5IHRvIGFsbG93IGltcGxlbWVudGF0aW9uIG9mIHNwZWNpYWxpemVkIHJlbmRlcmVycy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFJlbmRlcmVyIHtcbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBBIHNldCBvZiB2aXNpYmxlIG1lc2ggaW5zdGFuY2VzIHdoaWNoIG5lZWQgZnVydGhlciBwcm9jZXNzaW5nIGJlZm9yZSBiZWluZyByZW5kZXJlZCwgZS5nLlxuICAgICAqIHNraW5uaW5nIG9yIG1vcnBoaW5nLiBFeHRyYWN0ZWQgZHVyaW5nIGN1bGxpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZT59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwcm9jZXNzaW5nTWVzaEluc3RhbmNlcyA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtXb3JsZENsdXN0ZXJzQWxsb2NhdG9yfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB3b3JsZENsdXN0ZXJzQWxsb2NhdG9yO1xuXG4gICAgLyoqXG4gICAgICogQSBsaXN0IG9mIGFsbCB1bmlxdWUgbGlnaHRzIGluIHRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHRbXX1cbiAgICAgKi9cbiAgICBsaWdodHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEEgbGlzdCBvZiBhbGwgdW5pcXVlIGxvY2FsIGxpZ2h0cyAoc3BvdCAmIG9tbmkpIGluIHRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHRbXX1cbiAgICAgKi9cbiAgICBsb2NhbExpZ2h0cyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQSBsaXN0IG9mIHVuaXF1ZSBkaXJlY3Rpb25hbCBzaGFkb3cgY2FzdGluZyBsaWdodHMgZm9yIGVhY2ggZW5hYmxlZCBjYW1lcmEuIFRoaXMgaXMgZ2VuZXJhdGVkXG4gICAgICogZWFjaCBmcmFtZSBkdXJpbmcgbGlnaHQgY3VsbGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmEsIEFycmF5PGltcG9ydCgnLi4vbGlnaHQuanMnKS5MaWdodD4+fVxuICAgICAqL1xuICAgIGNhbWVyYURpclNoYWRvd0xpZ2h0cyA9IG5ldyBNYXAoKTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiBhIGRpcmVjdGlvbmFsIGxpZ2h0IHRvIGEgY2FtZXJhLCBmb3Igd2hpY2ggdGhlIHNoYWRvdyBpcyBjdXJyZW50bHkgdmFsaWQuIFRoaXNcbiAgICAgKiBpcyBjbGVhcmVkIGVhY2ggZnJhbWUsIGFuZCB1cGRhdGVkIGVhY2ggdGltZSBhIGRpcmVjdGlvbmFsIGxpZ2h0IHNoYWRvdyBpcyByZW5kZXJlZCBmb3IgYVxuICAgICAqIGNhbWVyYSwgYW5kIGFsbG93cyB1cyB0byBtYW51YWxseSBzY2hlZHVsZSBzaGFkb3cgcGFzc2VzIHdoZW4gYSBuZXcgY2FtZXJhIG5lZWRzIGEgc2hhZG93LlxuICAgICAqXG4gICAgICogQHR5cGUge01hcDxpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHQsIGltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhPn1cbiAgICAgKi9cbiAgICBkaXJMaWdodFNoYWRvd3MgPSBuZXcgTWFwKCk7XG5cbiAgICBibHVlTm9pc2UgPSBuZXcgQmx1ZU5vaXNlKDEyMyk7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIHJlbmRlcmVyLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL3NjZW5lLmpzJykuU2NlbmV8bnVsbH0gKi9cbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG5cbiAgICAgICAgLy8gVE9ETzogYWxsb2NhdGUgb25seSB3aGVuIHRoZSBzY2VuZSBoYXMgY2x1c3RlcmVkIGxpZ2h0aW5nIGVuYWJsZWRcbiAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzQWxsb2NhdG9yID0gbmV3IFdvcmxkQ2x1c3RlcnNBbGxvY2F0b3IoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIC8vIHRleHR1cmUgYXRsYXMgbWFuYWdpbmcgc2hhZG93IG1hcCAvIGNvb2tpZSB0ZXh0dXJlIGF0bGFzc2luZyBmb3Igb21uaSBhbmQgc3BvdCBsaWdodHNcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG5ldyBMaWdodFRleHR1cmVBdGxhcyhncmFwaGljc0RldmljZSk7XG5cbiAgICAgICAgLy8gc2hhZG93c1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbmV3IFNoYWRvd01hcENhY2hlKCk7XG4gICAgICAgIHRoaXMuc2hhZG93UmVuZGVyZXIgPSBuZXcgU2hhZG93UmVuZGVyZXIodGhpcywgdGhpcy5saWdodFRleHR1cmVBdGxhcyk7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJMb2NhbCh0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyKTtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCA9IG5ldyBTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsKHRoaXMsIHRoaXMuc2hhZG93UmVuZGVyZXIpO1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBwYXNzZXNcbiAgICAgICAgdGhpcy5fcmVuZGVyUGFzc1VwZGF0ZUNsdXN0ZXJlZCA9IG5ldyBSZW5kZXJQYXNzVXBkYXRlQ2x1c3RlcmVkKHRoaXMuZGV2aWNlLCB0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbCwgdGhpcy5saWdodFRleHR1cmVBdGxhcyk7XG5cbiAgICAgICAgLy8gdmlldyBiaW5kIGdyb3VwIGZvcm1hdCB3aXRoIGl0cyB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG51bGw7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG51bGw7XG5cbiAgICAgICAgLy8gdGltaW5nXG4gICAgICAgIHRoaXMuX3NraW5UaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbW9ycGhUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSA9IDA7XG5cbiAgICAgICAgLy8gc3RhdHNcbiAgICAgICAgdGhpcy5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2tpbkRyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFVwZGF0ZXMgPSAwO1xuICAgICAgICB0aGlzLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gMDtcblxuICAgICAgICAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzY29wZSA9IGdyYXBoaWNzRGV2aWNlLnNjb3BlO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX3Bvc2VNYXAnKTtcbiAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcFNpemUnKTtcbiAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcG9zZVswXScpO1xuXG4gICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9tb2RlbCcpO1xuICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X25vcm1hbCcpO1xuICAgICAgICB0aGlzLnZpZXdJbnZJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3SW52ZXJzZScpO1xuICAgICAgICB0aGlzLnZpZXdQb3MgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLnZpZXdQb3NJZCA9IHNjb3BlLnJlc29sdmUoJ3ZpZXdfcG9zaXRpb24nKTtcbiAgICAgICAgdGhpcy5wcm9qSWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pTa3lib3hJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uU2t5Ym94Jyk7XG4gICAgICAgIHRoaXMudmlld0lkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXcnKTtcbiAgICAgICAgdGhpcy52aWV3SWQzID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXczJyk7XG4gICAgICAgIHRoaXMudmlld1Byb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3UHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLmZsaXBZSWQgPSBzY29wZS5yZXNvbHZlKCdwcm9qZWN0aW9uRmxpcFknKTtcbiAgICAgICAgdGhpcy50Ym5CYXNpcyA9IHNjb3BlLnJlc29sdmUoJ3RibkJhc2lzJyk7XG4gICAgICAgIHRoaXMubmVhckNsaXBJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9uZWFyJyk7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX2ZhcicpO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfcGFyYW1zJyk7XG4gICAgICAgIHRoaXMudmlld0luZGV4SWQgPSBzY29wZS5yZXNvbHZlKCd2aWV3X2luZGV4Jyk7XG5cbiAgICAgICAgdGhpcy5ibHVlTm9pc2VKaXR0ZXJJZCA9IHNjb3BlLnJlc29sdmUoJ2JsdWVOb2lzZUppdHRlcicpO1xuICAgICAgICB0aGlzLmJsdWVOb2lzZVRleHR1cmVJZCA9IHNjb3BlLnJlc29sdmUoJ2JsdWVOb2lzZVRleDMyJyk7XG5cbiAgICAgICAgdGhpcy5hbHBoYVRlc3RJZCA9IHNjb3BlLnJlc29sdmUoJ2FscGhhX3JlZicpO1xuICAgICAgICB0aGlzLm9wYWNpdHlNYXBJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuXG4gICAgICAgIHRoaXMuZXhwb3N1cmVJZCA9IHNjb3BlLnJlc29sdmUoJ2V4cG9zdXJlJyk7XG4gICAgICAgIHRoaXMudHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9ySWQgPSBzY29wZS5yZXNvbHZlKCd0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3InKTtcbiAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSgwKTtcblxuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0EgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2EnKTtcbiAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfd2VpZ2h0c19iJyk7XG4gICAgICAgIHRoaXMubW9ycGhQb3NpdGlvblRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoUG9zaXRpb25UZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoTm9ybWFsVGV4Jyk7XG4gICAgICAgIHRoaXMubW9ycGhUZXhQYXJhbXMgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF90ZXhfcGFyYW1zJyk7XG5cbiAgICAgICAgLy8gYSBzaW5nbGUgaW5zdGFuY2Ugb2YgbGlnaHQgY3ViZVxuICAgICAgICB0aGlzLmxpZ2h0Q3ViZSA9IG5ldyBMaWdodEN1YmUoKTtcbiAgICAgICAgdGhpcy5jb25zdGFudExpZ2h0Q3ViZSA9IHNjb3BlLnJlc29sdmUoJ2xpZ2h0Q3ViZVswXScpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuc2hhZG93UmVuZGVyZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlclBhc3NVcGRhdGVDbHVzdGVyZWQuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9yZW5kZXJQYXNzVXBkYXRlQ2x1c3RlcmVkID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QyICYmIGRyYXdDYWxsQi56ZGlzdDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0MiAtIGRyYXdDYWxsQi56ZGlzdDI7IC8vIGZyb250IHRvIGJhY2tcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdIC0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZU1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgICAgIGNvbnN0IGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZURlcHRoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGNvbnN0IGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0RFUFRIXTtcbiAgICAgICAgY29uc3Qga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfREVQVEhdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgdGhlIHZpZXdwb3J0IGFuZCB0aGUgc2Npc3NvciBmb3IgY2FtZXJhIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29udGFpbmluZyB0aGUgdmlld3BvcnRcbiAgICAgKiBpbmZvcm1hdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBOVUxMIGZvciB0aGUgZGVmYXVsdCBvbmUuXG4gICAgICovXG4gICAgc2V0dXBWaWV3cG9ydChjYW1lcmEsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnU0VUVVAtVklFV1BPUlQnKTtcblxuICAgICAgICBjb25zdCBwaXhlbFdpZHRoID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBwaXhlbEhlaWdodCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlY3QgPSBjYW1lcmEucmVjdDtcbiAgICAgICAgbGV0IHggPSBNYXRoLmZsb29yKHJlY3QueCAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgeSA9IE1hdGguZmxvb3IocmVjdC55ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBsZXQgdyA9IE1hdGguZmxvb3IocmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgIGxldCBoID0gTWF0aC5mbG9vcihyZWN0LncgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh4LCB5LCB3LCBoKTtcblxuICAgICAgICAvLyB1c2Ugdmlld3BvcnQgcmVjdGFuZ2xlIGJ5IGRlZmF1bHQuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpIHtcblxuICAgICAgICAvLyBmbGlwcGluZyBwcm9qIG1hdHJpeFxuICAgICAgICBjb25zdCBmbGlwWSA9IHRhcmdldD8uZmxpcFk7XG5cbiAgICAgICAgbGV0IHZpZXdDb3VudCA9IDE7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IGNhbWVyYS5fbm9kZT8ucGFyZW50Py5nZXRXb3JsZFRyYW5zZm9ybSgpIHx8IG51bGw7XG4gICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcbiAgICAgICAgICAgIHZpZXdDb3VudCA9IHZpZXdzLmxpc3QubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3Q291bnQ7IHYrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB2aWV3cy5saXN0W3ZdO1xuICAgICAgICAgICAgICAgIHZpZXcudXBkYXRlVHJhbnNmb3Jtcyh0cmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXcucHJvalZpZXdPZmZNYXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBQcm9qZWN0aW9uIE1hdHJpeFxuICAgICAgICAgICAgbGV0IHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKHByb2pNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBwcm9qTWF0U2t5Ym94ID0gY2FtZXJhLmdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKTtcblxuICAgICAgICAgICAgLy8gZmxpcCBwcm9qZWN0aW9uIG1hdHJpY2VzXG4gICAgICAgICAgICBpZiAoZmxpcFkpIHtcbiAgICAgICAgICAgICAgICBwcm9qTWF0ID0gX3RlbXBQcm9qTWF0MC5tdWwyKF9mbGlwWU1hdCwgcHJvak1hdCk7XG4gICAgICAgICAgICAgICAgcHJvak1hdFNreWJveCA9IF90ZW1wUHJvak1hdDEubXVsMihfZmxpcFlNYXQsIHByb2pNYXRTa3lib3gpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgZGVwdGggcmFuZ2Ugb2YgcHJvamVjdGlvbiBtYXRyaWNlcyAoLTEuLjEgdG8gMC4uMSlcbiAgICAgICAgICAgIGlmICh0aGlzLmRldmljZS5pc1dlYkdQVSkge1xuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQyLm11bDIoX2ZpeFByb2pSYW5nZU1hdCwgcHJvak1hdCk7XG4gICAgICAgICAgICAgICAgcHJvak1hdFNreWJveCA9IF90ZW1wUHJvak1hdDMubXVsMihfZml4UHJvalJhbmdlTWF0LCBwcm9qTWF0U2t5Ym94KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FtZXJhIGppdHRlclxuICAgICAgICAgICAgY29uc3QgeyBqaXR0ZXIgfSA9IGNhbWVyYTtcbiAgICAgICAgICAgIGxldCBub2lzZSA9IFZlYzQuWkVSTztcbiAgICAgICAgICAgIGlmIChqaXR0ZXIgPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGFyZ2V0IHNpemVcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRXaWR0aCA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IHRoaXMuZGV2aWNlLndpZHRoO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEhlaWdodCA9IHRhcmdldCA/IHRhcmdldC5oZWlnaHQgOiB0aGlzLmRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICAvLyBvZmZzZXRzXG4gICAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gX2hhbHRvblNlcXVlbmNlW3RoaXMuZGV2aWNlLnJlbmRlclZlcnNpb24gJSBfaGFsdG9uU2VxdWVuY2UubGVuZ3RoXTtcbiAgICAgICAgICAgICAgICBjb25zdCBvZmZzZXRYID0gaml0dGVyICogKG9mZnNldC54ICogMiAtIDEpIC8gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0WSA9IGppdHRlciAqIChvZmZzZXQueSAqIDIgLSAxKSAvIHRhcmdldEhlaWdodDtcblxuICAgICAgICAgICAgICAgIC8vIGFwcGx5IG9mZnNldCB0byBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQ0LmNvcHkocHJvak1hdCk7XG4gICAgICAgICAgICAgICAgcHJvak1hdC5kYXRhWzhdID0gb2Zmc2V0WDtcbiAgICAgICAgICAgICAgICBwcm9qTWF0LmRhdGFbOV0gPSBvZmZzZXRZO1xuXG4gICAgICAgICAgICAgICAgLy8gYXBwbHkgb2Zmc2V0IHRvIHNreWJveCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgICAgIHByb2pNYXRTa3lib3ggPSBfdGVtcFByb2pNYXQ1LmNvcHkocHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICAgICAgcHJvak1hdFNreWJveC5kYXRhWzhdID0gb2Zmc2V0WDtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94LmRhdGFbOV0gPSBvZmZzZXRZO1xuXG4gICAgICAgICAgICAgICAgLy8gYmx1ZSBub2lzZSB2ZWM0IC0gb25seSBzZXQgd2hlbiBqaXR0ZXIgaXMgZW5hYmxlZFxuICAgICAgICAgICAgICAgIG5vaXNlID0gdGhpcy5ibHVlTm9pc2UudmVjNChfdGVtcFZlYzQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmJsdWVOb2lzZUppdHRlcklkLnNldFZhbHVlKFtub2lzZS54LCBub2lzZS55LCBub2lzZS56LCBub2lzZS53XSk7XG5cbiAgICAgICAgICAgIHRoaXMucHJvaklkLnNldFZhbHVlKHByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZShwcm9qTWF0U2t5Ym94LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3SW52ZXJzZSBNYXRyaXhcbiAgICAgICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcyA9IGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgICAgIHZpZXdJbnZNYXQuc2V0VFJTKHBvcywgcm90LCBWZWMzLk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3SW52TWF0LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IE1hdHJpeFxuICAgICAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlld01hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyAzeDNcbiAgICAgICAgICAgIHZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXdNYXQzLmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3UHJvamVjdGlvbiBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlld1Byb2pNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIHRoaXMuZmxpcFlJZC5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgUG9zaXRpb24gKHdvcmxkIHNwYWNlKVxuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFZpZXdQb3MoY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCkpO1xuXG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRibkJhc2lzLnNldFZhbHVlKGZsaXBZID8gLTEgOiAxKTtcblxuICAgICAgICAvLyBOZWFyIGFuZCBmYXIgY2xpcCB2YWx1ZXNcbiAgICAgICAgY29uc3QgbiA9IGNhbWVyYS5fbmVhckNsaXA7XG4gICAgICAgIGNvbnN0IGYgPSBjYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgIHRoaXMubmVhckNsaXBJZC5zZXRWYWx1ZShuKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQuc2V0VmFsdWUoZik7XG5cbiAgICAgICAgLy8gY2FtZXJhIHBhcmFtc1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1swXSA9IDEgLyBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1sxXSA9IGY7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzJdID0gbjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbM10gPSBjYW1lcmEucHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyAxIDogMDtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZC5zZXRWYWx1ZSh0aGlzLmNhbWVyYVBhcmFtcyk7XG5cbiAgICAgICAgLy8gZXhwb3N1cmVcbiAgICAgICAgdGhpcy5leHBvc3VyZUlkLnNldFZhbHVlKHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cyA/IGNhbWVyYS5nZXRFeHBvc3VyZSgpIDogdGhpcy5zY2VuZS5leHBvc3VyZSk7XG5cbiAgICAgICAgcmV0dXJuIHZpZXdDb3VudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBJZiB0aGUgdmlld3BvcnQgaXMgYWxyZWFkeSBzZXQgdXAsIG9ubHkgaXRzIGFyZWEgaXMgY2xlYXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgc3VwcGx5aW5nIHRoZSB2YWx1ZSB0byBjbGVhciB0by5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjbGVhckNvbG9yXSAtIFRydWUgaWYgdGhlIGNvbG9yIGJ1ZmZlciBzaG91bGQgYmUgY2xlYXJlZC4gVXNlcyB0aGUgdmFsdWVcbiAgICAgKiBmcm9tIHRoZSBjYW1lcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NsZWFyRGVwdGhdIC0gVHJ1ZSBpZiB0aGUgZGVwdGggYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLiBVc2VzIHRoZSB2YWx1ZVxuICAgICAqIGZyb20gdGhlIGNhbWVyYSBpZiBub3Qgc3VwcGxpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY2xlYXJTdGVuY2lsXSAtIFRydWUgaWYgdGhlIHN0ZW5jaWwgYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLiBVc2VzIHRoZVxuICAgICAqIHZhbHVlIGZyb20gdGhlIGNhbWVyYSBpZiBub3Qgc3VwcGxpZWQuXG4gICAgICovXG4gICAgY2xlYXIoY2FtZXJhLCBjbGVhckNvbG9yLCBjbGVhckRlcHRoLCBjbGVhclN0ZW5jaWwpIHtcblxuICAgICAgICBjb25zdCBmbGFncyA9ICgoY2xlYXJDb2xvciA/PyBjYW1lcmEuX2NsZWFyQ29sb3JCdWZmZXIpID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICgoY2xlYXJEZXB0aCA/PyBjYW1lcmEuX2NsZWFyRGVwdGhCdWZmZXIpID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICgoY2xlYXJTdGVuY2lsID8/IGNhbWVyYS5fY2xlYXJTdGVuY2lsQnVmZmVyKSA/IENMRUFSRkxBR19TVEVOQ0lMIDogMCk7XG5cbiAgICAgICAgaWYgKGZsYWdzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUicpO1xuXG4gICAgICAgICAgICBkZXZpY2UuY2xlYXIoe1xuICAgICAgICAgICAgICAgIGNvbG9yOiBbY2FtZXJhLl9jbGVhckNvbG9yLnIsIGNhbWVyYS5fY2xlYXJDb2xvci5nLCBjYW1lcmEuX2NsZWFyQ29sb3IuYiwgY2FtZXJhLl9jbGVhckNvbG9yLmFdLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogY2FtZXJhLl9jbGVhclN0ZW5jaWwsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IGZsYWdzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG1ha2Ugc3VyZSBjb2xvcldyaXRlIGlzIHNldCB0byB0cnVlIHRvIGFsbCBjaGFubmVscywgaWYgeW91IHdhbnQgdG8gZnVsbHkgY2xlYXIgdGhlIHRhcmdldFxuICAgIC8vIFRPRE86IHRoaXMgZnVuY3Rpb24gaXMgb25seSB1c2VkIGZyb20gb3V0c2lkZSBvZiBmb3J3YXJkIHJlbmRlcmVyLCBhbmQgc2hvdWxkIGJlIGRlcHJlY2F0ZWRcbiAgICAvLyB3aGVuIHRoZSBmdW5jdGlvbmFsaXR5IG1vdmVzIHRvIHRoZSByZW5kZXIgcGFzc2VzLiBOb3RlIHRoYXQgRWRpdG9yIHVzZXMgaXQgYXMgd2VsbC5cbiAgICBzZXRDYW1lcmEoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCByZW5kZXJBY3Rpb24gPSBudWxsKSB7XG5cbiAgICAgICAgdGhpcy5zZXRDYW1lcmFVbmlmb3JtcyhjYW1lcmEsIHRhcmdldCk7XG4gICAgICAgIHRoaXMuY2xlYXJWaWV3KGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHRoaXMgaXMgY3VycmVudGx5IHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyIGFuZCB0aGUgRWRpdG9yLFxuICAgIC8vIGFuZCB3aWxsIGJlIHJlbW92ZWQgd2hlbiB0aG9zZSBjYWxsIGFyZSByZW1vdmVkLlxuICAgIGNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZvcmNlV3JpdGUpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ0NMRUFSLVZJRVcnKTtcblxuICAgICAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIGlmIChmb3JjZVdyaXRlKSB7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYSwgdGFyZ2V0KTtcblxuICAgICAgICBpZiAoY2xlYXIpIHtcblxuICAgICAgICAgICAgLy8gdXNlIGNhbWVyYSBjbGVhciBvcHRpb25zIGlmIGFueVxuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IGNhbWVyYS5fY2xlYXJPcHRpb25zO1xuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKG9wdGlvbnMgPyBvcHRpb25zIDoge1xuICAgICAgICAgICAgICAgIGNvbG9yOiBbY2FtZXJhLl9jbGVhckNvbG9yLnIsIGNhbWVyYS5fY2xlYXJDb2xvci5nLCBjYW1lcmEuX2NsZWFyQ29sb3IuYiwgY2FtZXJhLl9jbGVhckNvbG9yLmFdLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IChjYW1lcmEuX2NsZWFyQ29sb3JCdWZmZXIgPyBDTEVBUkZMQUdfQ09MT1IgOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyRGVwdGhCdWZmZXIgPyBDTEVBUkZMQUdfREVQVEggOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlciA/IENMRUFSRkxBR19TVEVOQ0lMIDogMCksXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogY2FtZXJhLl9jbGVhclN0ZW5jaWxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG5cbiAgICBzZXR1cEN1bGxNb2RlKGN1bGxGYWNlcywgZmxpcEZhY3RvciwgZHJhd0NhbGwpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgbGV0IG1vZGUgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICBpZiAoY3VsbEZhY2VzKSB7XG4gICAgICAgICAgICBsZXQgZmxpcEZhY2VzID0gMTtcblxuICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UIHx8IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0JBQ0spIHtcbiAgICAgICAgICAgICAgICBmbGlwRmFjZXMgPSBmbGlwRmFjdG9yICogZHJhd0NhbGwuZmxpcEZhY2VzRmFjdG9yICogZHJhd0NhbGwubm9kZS53b3JsZFNjYWxlU2lnbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsaXBGYWNlcyA8IDApIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbCA9PT0gQ1VMTEZBQ0VfRlJPTlQgPyBDVUxMRkFDRV9CQUNLIDogQ1VMTEZBQ0VfRlJPTlQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1vZGUgPSBtYXRlcmlhbC5jdWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGV2aWNlLnNldEN1bGxNb2RlKG1vZGUpO1xuXG4gICAgICAgIGlmIChtb2RlID09PSBDVUxMRkFDRV9OT05FICYmIG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMudHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9ySWQuc2V0VmFsdWUoZHJhd0NhbGwubm9kZS53b3JsZFNjYWxlU2lnbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYSkge1xuXG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnZpZXdzLmxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgZnJ1c3R1bSBiYXNlZCBvbiBYUiB2aWV3XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gY2FtZXJhLnhyLnZpZXdzLmxpc3RbMF07XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgdmlld0ludk1hdC5zZXRUUlMocG9zLCByb3QsIFZlYzMuT05FKTtcbiAgICAgICAgICAgIHRoaXMudmlld0ludklkLnNldFZhbHVlKHZpZXdJbnZNYXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuXG4gICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICB9XG5cbiAgICBzZXRCYXNlQ29uc3RhbnRzKGRldmljZSwgbWF0ZXJpYWwpIHtcblxuICAgICAgICAvLyBDdWxsIG1vZGVcbiAgICAgICAgZGV2aWNlLnNldEN1bGxNb2RlKG1hdGVyaWFsLmN1bGwpO1xuXG4gICAgICAgIC8vIEFscGhhIHRlc3RcbiAgICAgICAgaWYgKG1hdGVyaWFsLm9wYWNpdHlNYXApIHtcbiAgICAgICAgICAgIHRoaXMub3BhY2l0eU1hcElkLnNldFZhbHVlKG1hdGVyaWFsLm9wYWNpdHlNYXApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwIHx8IG1hdGVyaWFsLmFscGhhVGVzdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBza2luIG1hdHJpY2VzIGFoZWFkIG9mIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW118U2V0PGltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZT59IGRyYXdDYWxscyAtIE1lc2hJbnN0YW5jZXNcbiAgICAgKiBjb250YWluaW5nIHNraW5JbnN0YW5jZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlR3B1U2tpbk1hdHJpY2VzKGRyYXdDYWxscykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAoY29uc3QgZHJhd0NhbGwgb2YgZHJhd0NhbGxzKSB7XG4gICAgICAgICAgICBjb25zdCBza2luID0gZHJhd0NhbGwuc2tpbkluc3RhbmNlO1xuXG4gICAgICAgICAgICBpZiAoc2tpbiAmJiBza2luLl9kaXJ0eSkge1xuICAgICAgICAgICAgICAgIHNraW4udXBkYXRlTWF0cml4UGFsZXR0ZShkcmF3Q2FsbC5ub2RlLCBfc2tpblVwZGF0ZUluZGV4KTtcbiAgICAgICAgICAgICAgICBza2luLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9za2luVGltZSArPSBub3coKSAtIHNraW5UaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgbW9ycGhpbmcgYWhlYWQgb2YgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXXxTZXQ8aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlPn0gZHJhd0NhbGxzIC0gTWVzaEluc3RhbmNlc1xuICAgICAqIGNvbnRhaW5pbmcgbW9ycGhJbnN0YW5jZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlTW9ycGhpbmcoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbW9ycGhUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAoY29uc3QgZHJhd0NhbGwgb2YgZHJhd0NhbGxzKSB7XG4gICAgICAgICAgICBjb25zdCBtb3JwaEluc3QgPSBkcmF3Q2FsbC5tb3JwaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdCAmJiBtb3JwaEluc3QuX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgbW9ycGhJbnN0LnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgKz0gbm93KCkgLSBtb3JwaFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBnc3BsYXRzIGFoZWFkIG9mIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW118U2V0PGltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZT59IGRyYXdDYWxscyAtIE1lc2hJbnN0YW5jZXNcbiAgICAgKiBjb250YWluaW5nIGdzcGxhdEluc3RhbmNlcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlR1NwbGF0cyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgZm9yIChjb25zdCBkcmF3Q2FsbCBvZiBkcmF3Q2FsbHMpIHtcbiAgICAgICAgICAgIGRyYXdDYWxsLmdzcGxhdEluc3RhbmNlPy51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBkcmF3IGNhbGxzIGFoZWFkIG9mIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW118U2V0PGltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZT59IGRyYXdDYWxscyAtIE1lc2hJbnN0YW5jZXNcbiAgICAgKiByZXF1aXJpbmcgdXBkYXRlcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ3B1VXBkYXRlKGRyYXdDYWxscykge1xuICAgICAgICAvLyBOb3RlIHRoYXQgZHJhd0NhbGxzIGNhbiBiZSBlaXRoZXIgYSBTZXQgb3IgYW4gQXJyYXkgYW5kIGNvbnRhaW5zIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIC8vIHRoYXQgYXJlIHZpc2libGUgaW4gdGhpcyBmcmFtZVxuICAgICAgICB0aGlzLnVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscyk7XG4gICAgICAgIHRoaXMudXBkYXRlR1NwbGF0cyhkcmF3Q2FsbHMpO1xuICAgIH1cblxuICAgIHNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKSB7XG5cbiAgICAgICAgLy8gbWFpbiB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobWVzaC52ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHNldE1vcnBoaW5nKGRldmljZSwgbW9ycGhJbnN0YW5jZSkge1xuXG4gICAgICAgIGlmIChtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgIGlmIChtb3JwaEluc3RhbmNlLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkge1xuXG4gICAgICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlciB3aXRoIHZlcnRleCBpZHNcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKG1vcnBoSW5zdGFuY2UubW9ycGgudmVydGV4QnVmZmVySWRzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZVBvc2l0aW9ucyk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleC5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLnRleHR1cmVOb3JtYWxzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcy5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl90ZXh0dXJlUGFyYW1zKTtcblxuICAgICAgICAgICAgfSBlbHNlIHsgICAgLy8gdmVydGV4IGF0dHJpYnV0ZXMgYmFzZWQgbW9ycGhpbmdcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHQgPSAwOyB0IDwgbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVycy5sZW5ndGg7IHQrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZiID0gbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVyc1t0XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhdGNoIHNlbWFudGljIGZvciB0aGUgYnVmZmVyIHRvIGN1cnJlbnQgQVRUUiBzbG90ICh1c2luZyBBVFRSOCAtIEFUVFIxNSByYW5nZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gU0VNQU5USUNfQVRUUiArICh0ICsgOCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0ubmFtZSA9IHNlbWFudGljO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIuZm9ybWF0LmVsZW1lbnRzWzBdLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShzZW1hbnRpYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIodmIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGFsbCA4IHdlaWdodHNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Euc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3NoYWRlck1vcnBoV2VpZ2h0c0IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2tpbm5pbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3Qgc2tpbkluc3RhbmNlID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZTtcbiAgICAgICAgaWYgKHNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkRyYXdDYWxscysrO1xuICAgICAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c0JvbmVUZXh0dXJlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVUZXh0dXJlID0gc2tpbkluc3RhbmNlLmJvbmVUZXh0dXJlO1xuICAgICAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmVJZC5zZXRWYWx1ZShib25lVGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZC5zZXRWYWx1ZShza2luSW5zdGFuY2UuYm9uZVRleHR1cmVTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQuc2V0VmFsdWUoc2tpbkluc3RhbmNlLm1hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0cyBWZWMzIGNhbWVyYSBwb3NpdGlvbiB1bmlmb3JtXG4gICAgZGlzcGF0Y2hWaWV3UG9zKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZwID0gdGhpcy52aWV3UG9zOyAgICAvLyBub3RlIHRoYXQgdGhpcyByZXVzZXMgYW4gYXJyYXlcbiAgICAgICAgdnBbMF0gPSBwb3NpdGlvbi54O1xuICAgICAgICB2cFsxXSA9IHBvc2l0aW9uLnk7XG4gICAgICAgIHZwWzJdID0gcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodnApO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgJiYgIXRoaXMudmlld1VuaWZvcm1Gb3JtYXQpIHtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtcyA9IFtcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcIm1hdHJpeF92aWV3UHJvamVjdGlvblwiLCBVTklGT1JNVFlQRV9NQVQ0KSxcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcImN1YmVNYXBSb3RhdGlvbk1hdHJpeFwiLCBVTklGT1JNVFlQRV9NQVQzKSxcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcInZpZXdfcG9zaXRpb25cIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJza3lib3hJbnRlbnNpdHlcIiwgVU5JRk9STVRZUEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiZXhwb3N1cmVcIiwgVU5JRk9STVRZUEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwidGV4dHVyZUJpYXNcIiwgVU5JRk9STVRZUEVfRkxPQVQpXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICB1bmlmb3Jtcy5wdXNoKC4uLltcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZVwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyVGV4dHVyZVNpemVcIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlckJvdW5kc01pblwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQm91bmRzRGVsdGFcIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlckNlbGxzRG90XCIsIFVOSUZPUk1UWVBFX1ZFQzMpLFxuICAgICAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcImNsdXN0ZXJDZWxsc01heFwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBcIiwgVU5JRk9STVRZUEVfVkVDMiksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwic2hhZG93QXRsYXNQYXJhbXNcIiwgVU5JRk9STVRZUEVfVkVDMiksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3Rlck1heENlbGxzXCIsIFVOSUZPUk1UWVBFX0lOVCksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlclNraXBcIiwgVU5JRk9STVRZUEVfRkxPQVQpXG4gICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCh0aGlzLmRldmljZSwgdW5pZm9ybXMpO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIHNvbWUgdGV4dHVyZXNcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlcnMgPSBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdsaWdodHNUZXh0dXJlRmxvYXQnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZTgnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnc2hhZG93QXRsYXNUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfREVQVEgpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnY29va2llQXRsYXNUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfRkxPQVQpLFxuXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdhcmVhTGlnaHRzTHV0VGV4MScsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBURVhUVVJFRElNRU5TSU9OXzJELCBTQU1QTEVUWVBFX0ZMT0FUKSxcbiAgICAgICAgICAgICAgICBuZXcgQmluZFRleHR1cmVGb3JtYXQoJ2FyZWFMaWdodHNMdXRUZXgyJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfRkxPQVQpXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlcy5wdXNoKC4uLltcbiAgICAgICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdjbHVzdGVyV29ybGRUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKVxuICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBidWZmZXJzLCB0ZXh0dXJlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyh2aWV3QmluZEdyb3Vwcywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZpZXdDb3VudCkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChBcnJheS5pc0FycmF5KHZpZXdCaW5kR3JvdXBzKSwgXCJ2aWV3QmluZEdyb3VwcyBtdXN0IGJlIGFuIGFycmF5XCIpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodmlld0NvdW50ID09PSAxLCBcIlRoaXMgY29kZSBkb2VzIG5vdCBoYW5kbGUgdGhlIHZpZXdDb3VudCB5ZXRcIik7XG5cbiAgICAgICAgd2hpbGUgKHZpZXdCaW5kR3JvdXBzLmxlbmd0aCA8IHZpZXdDb3VudCkge1xuICAgICAgICAgICAgY29uc3QgdWIgPSBuZXcgVW5pZm9ybUJ1ZmZlcihkZXZpY2UsIHZpZXdVbmlmb3JtRm9ybWF0LCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBiZyA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCB2aWV3QmluZEdyb3VwRm9ybWF0LCB1Yik7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKGJnLCBgVmlld0JpbmRHcm91cF8ke2JnLmlkfWApO1xuICAgICAgICAgICAgdmlld0JpbmRHcm91cHMucHVzaChiZyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgdmlldyBiaW5kIGdyb3VwIC8gdW5pZm9ybXNcbiAgICAgICAgY29uc3Qgdmlld0JpbmRHcm91cCA9IHZpZXdCaW5kR3JvdXBzWzBdO1xuICAgICAgICB2aWV3QmluZEdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyLnVwZGF0ZSgpO1xuICAgICAgICB2aWV3QmluZEdyb3VwLnVwZGF0ZSgpO1xuXG4gICAgICAgIC8vIFRPRE87IHRoaXMgbmVlZHMgdG8gYmUgbW92ZWQgdG8gZHJhd0luc3RhbmNlIGZ1bmN0aW9ucyB0byBoYW5kbGUgWFJcbiAgICAgICAgZGV2aWNlLnNldEJpbmRHcm91cChCSU5ER1JPVVBfVklFVywgdmlld0JpbmRHcm91cCk7XG4gICAgfVxuXG4gICAgc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMoc2hhZGVySW5zdGFuY2UsIG1lc2hJbnN0YW5jZSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcblxuICAgICAgICAgICAgLy8gVE9ETzogbW9kZWwgbWF0cml4IHNldHVwIGlzIHBhcnQgb2YgdGhlIGRyYXdJbnN0YW5jZSBjYWxsLCBidXQgd2l0aCB1bmlmb3JtIGJ1ZmZlciBpdCdzIG5lZWRlZFxuICAgICAgICAgICAgLy8gZWFybGllciBoZXJlLiBUaGlzIG5lZWRzIHRvIGJlIHJlZmFjdG9yZWQgZm9yIG11bHRpLXZpZXcgYW55d2F5cy5cbiAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS53b3JsZFRyYW5zZm9ybS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbWVzaCBiaW5kIGdyb3VwIC8gdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG1lc2hCaW5kR3JvdXAgPSBzaGFkZXJJbnN0YW5jZS5nZXRCaW5kR3JvdXAoZGV2aWNlKTtcblxuICAgICAgICAgICAgbWVzaEJpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAudXBkYXRlKCk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0QmluZEdyb3VwKEJJTkRHUk9VUF9NRVNILCBtZXNoQmluZEdyb3VwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRyYXdJbnN0YW5jZShkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUsIG5vcm1hbCkge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIG1lc2hJbnN0YW5jZS5ub2RlLm5hbWUpO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShtb2RlbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgaWYgKG5vcm1hbCkge1xuICAgICAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS5ub3JtYWxNYXRyaXguZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihpbnN0YW5jaW5nRGF0YS52ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgaW5zdGFuY2luZ0RhdGEuY291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NhbWVyYS5qcycpLkNhbWVyYX0gY2FtZXJhIC0gVGhlIGNhbWVyYSB1c2VkIGZvciBjdWxsaW5nLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IGRyYXdDYWxscyAtIERyYXcgY2FsbHMgdG8gY3VsbC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5DdWxsZWRJbnN0YW5jZXN9IGN1bGxlZEluc3RhbmNlcyAtIFN0b3JlcyBjdWxsZWQgaW5zdGFuY2VzLlxuICAgICAqL1xuICAgIGN1bGwoY2FtZXJhLCBkcmF3Q2FsbHMsIGN1bGxlZEluc3RhbmNlcykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IG9wYXF1ZSA9IGN1bGxlZEluc3RhbmNlcy5vcGFxdWU7XG4gICAgICAgIG9wYXF1ZS5sZW5ndGggPSAwO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGN1bGxlZEluc3RhbmNlcy50cmFuc3BhcmVudDtcbiAgICAgICAgdHJhbnNwYXJlbnQubGVuZ3RoID0gMDtcblxuICAgICAgICBjb25zdCBkb0N1bGwgPSBjYW1lcmEuZnJ1c3R1bUN1bGxpbmc7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLnZpc2libGUpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGUgPSAhZG9DdWxsIHx8ICFkcmF3Q2FsbC5jdWxsIHx8IGRyYXdDYWxsLl9pc1Zpc2libGUoY2FtZXJhKTtcbiAgICAgICAgICAgICAgICBpZiAodmlzaWJsZSkge1xuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzb3J0IG1lc2ggaW5zdGFuY2UgaW50byB0aGUgcmlnaHQgYnVja2V0IGJhc2VkIG9uIGl0cyB0cmFuc3BhcmVuY3lcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVja2V0ID0gZHJhd0NhbGwudHJhbnNwYXJlbnQgPyB0cmFuc3BhcmVudCA6IG9wYXF1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0LnB1c2goZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5za2luSW5zdGFuY2UgfHwgZHJhd0NhbGwubW9ycGhJbnN0YW5jZSB8fCBkcmF3Q2FsbC5nc3BsYXRJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzaW5nTWVzaEluc3RhbmNlcy5hZGQoZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZWdpc3RlciB2aXNpYmxlIGNhbWVyYXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5nc3BsYXRJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLmdzcGxhdEluc3RhbmNlLmNhbWVyYXMucHVzaChjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9jdWxsVGltZSArPSBub3coKSAtIGN1bGxUaW1lO1xuICAgICAgICB0aGlzLl9udW1EcmF3Q2FsbHNDdWxsZWQgKz0gZG9DdWxsID8gY291bnQgOiAwO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBjb2xsZWN0TGlnaHRzKGNvbXApIHtcblxuICAgICAgICAvLyBidWlsZCBhIGxpc3QgYW5kIG9mIGFsbCB1bmlxdWUgbGlnaHRzIGZyb20gYWxsIGxheWVyc1xuICAgICAgICB0aGlzLmxpZ2h0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxvY2FsTGlnaHRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gc3RhdHNcbiAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLnNjZW5lLl9zdGF0cztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG5cbiAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cyA9IDA7XG4gICAgICAgIHN0YXRzLmJha2VkTGlnaHRzID0gMDtcblxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBjb3VudCA9IGNvbXAubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2ldO1xuXG4gICAgICAgICAgICAvLyBsYXllciBjYW4gYmUgaW4gdGhlIGxpc3QgdHdvIHRpbWVzIChvcGFxdWUsIHRyYW5zcCksIHByb2Nlc3MgaXQgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgaWYgKCFfdGVtcExheWVyU2V0LmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgICAgICBfdGVtcExheWVyU2V0LmFkZChsYXllcik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodHMgPSBsYXllci5fbGlnaHRzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGlnaHRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2pdO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCBuZXcgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFfdGVtcExpZ2h0U2V0LmhhcyhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90ZW1wTGlnaHRTZXQuYWRkKGxpZ2h0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5saWdodHMucHVzaChsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2NhbExpZ2h0cy5wdXNoKGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBhZmZlY3RzIGR5bmFtaWMgb3IgYmFrZWQgb2JqZWN0cyBpbiByZWFsLXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgobGlnaHQubWFzayAmIE1BU0tfQUZGRUNUX0RZTkFNSUMpIHx8IChsaWdodC5tYXNrICYgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBiYWtlIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Lm1hc2sgJiBNQVNLX0JBS0UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRzLmxpZ2h0cyA9IHRoaXMubGlnaHRzLmxlbmd0aDtcblxuICAgICAgICBfdGVtcExpZ2h0U2V0LmNsZWFyKCk7XG4gICAgICAgIF90ZW1wTGF5ZXJTZXQuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBjdWxsTGlnaHRzKGNhbWVyYSwgbGlnaHRzKSB7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IHBoeXNpY2FsVW5pdHMgPSB0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBsaWdodHMgYXJlIG1hcmtlZCB2aXNpYmxlIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWVcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC5nZXRCb3VuZGluZ1NwaGVyZSh0ZW1wU3BoZXJlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5mcnVzdHVtLmNvbnRhaW5zU3BoZXJlKHRlbXBTcGhlcmUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnVzZVBoeXNpY2FsVW5pdHMgPSBwaHlzaWNhbFVuaXRzO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXhpbXVtIHNjcmVlbiBhcmVhIHRha2VuIGJ5IHRoZSBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuU2l6ZSA9IGNhbWVyYS5nZXRTY3JlZW5TaXplKHRlbXBTcGhlcmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQubWF4U2NyZWVuU2l6ZSA9IE1hdGgubWF4KGxpZ2h0Lm1heFNjcmVlblNpemUsIHNjcmVlblNpemUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgc2hhZG93IGNhc3RpbmcgbGlnaHQgZG9lcyBub3QgaGF2ZSBzaGFkb3cgbWFwIGFsbG9jYXRlZCwgbWFyayBpdCB2aXNpYmxlIHRvIGFsbG9jYXRlIHNoYWRvdyBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoaXMgd29uJ3QgYmUgbmVlZGVkIHdoZW4gY2x1c3RlcmVkIHNoYWRvd3MgYXJlIHVzZWQsIGJ1dCBhdCB0aGUgbW9tZW50IGV2ZW4gY3VsbGVkIG91dCBsaWdodHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFyZSB1c2VkIGZvciByZW5kZXJpbmcsIGFuZCBuZWVkIHNoYWRvdyBtYXAgdG8gYmUgYWxsb2NhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBkZWxldGUgdGhpcyBjb2RlIHdoZW4gY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIGlzIGJlaW5nIHJlbW92ZWQgYW5kIGlzIG9uIGJ5IGRlZmF1bHQuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhbGlnaHQuc2hhZG93TWFwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LnVzZVBoeXNpY2FsVW5pdHMgPSB0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hhZG93IG1hcCBjdWxsaW5nIGZvciBkaXJlY3Rpb25hbCBhbmQgdmlzaWJsZSBsb2NhbCBsaWdodHNcbiAgICAgKiB2aXNpYmxlIG1lc2hJbnN0YW5jZXMgYXJlIGNvbGxlY3RlZCBpbnRvIGxpZ2h0Ll9yZW5kZXJEYXRhLCBhbmQgYXJlIG1hcmtlZCBhcyB2aXNpYmxlXG4gICAgICogZm9yIGRpcmVjdGlvbmFsIGxpZ2h0cyBhbHNvIHNoYWRvdyBjYW1lcmEgbWF0cml4IGlzIHNldCB1cFxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxTaGFkb3dtYXBzKGNvbXApIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGxvY2FsIChwb2ludCBhbmQgc3BvdCkgbGlnaHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sb2NhbExpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSB0aGlzLmxvY2FsTGlnaHRzW2ldO1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcblxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBhdGxhcyBzbG90IGlzIHJlYXNzaWduZWQsIG1ha2Ugc3VyZSB0byB1cGRhdGUgdGhlIHNoYWRvdyBtYXAsIGluY2x1ZGluZyB0aGUgY3VsbGluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvcmNlIHJlbmRlcmluZyBzaGFkb3cgYXQgbGVhc3Qgb25jZSB0byBhbGxvY2F0ZSB0aGUgc2hhZG93IG1hcCBuZWVkZWQgYnkgdGhlIHNoYWRlcnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCkuc2hhZG93Q2FtZXJhLnJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbC5jdWxsKGxpZ2h0LCBjb21wKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVycyBjdWxsaW5nIGZvciBkaXJlY3Rpb25hbCBsaWdodHMgLSBzdGFydCB3aXRoIG5vbmUgYW5kIGNvbGxlY3QgbGlnaHRzIGZvciBjYW1lcmFzXG4gICAgICAgIHRoaXMuY2FtZXJhRGlyU2hhZG93TGlnaHRzLmNsZWFyKCk7XG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSBjb21wLmNhbWVyYXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FtZXJhcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhQ29tcG9uZW50ID0gY2FtZXJhc1tpXTtcbiAgICAgICAgICAgIGlmIChjYW1lcmFDb21wb25lbnQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGNhbWVyYUNvbXBvbmVudC5jYW1lcmE7XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgZGlyZWN0aW9uYWwgbGlnaHRzIGZyb20gYWxsIGxheWVycyBvZiB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IGxpZ2h0TGlzdDtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmFMYXllcnMgPSBjYW1lcmEubGF5ZXJzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgY2FtZXJhTGF5ZXJzLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUxheWVyID0gY29tcC5nZXRMYXllckJ5SWQoY2FtZXJhTGF5ZXJzW2xdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYUxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllckRpckxpZ2h0cyA9IGNhbWVyYUxheWVyLnNwbGl0TGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXJEaXJMaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxheWVyRGlyTGlnaHRzW2pdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdW5pcXVlIHNoYWRvdyBjYXN0aW5nIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhX3RlbXBTZXQuaGFzKGxpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQobGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0TGlzdCA9IGxpZ2h0TGlzdCA/PyBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRMaXN0LnB1c2gobGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZydXN0dW0gY3VsbGluZyBmb3IgdGhlIGRpcmVjdGlvbmFsIHNoYWRvdyB3aGVuIHJlbmRlcmluZyB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuY3VsbChsaWdodCwgY29tcCwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRMaXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhRGlyU2hhZG93TGlnaHRzLnNldChjYW1lcmEsIGxpZ2h0TGlzdCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAqIEFsc28gYXBwbGllcyBtZXNoSW5zdGFuY2UudmlzaWJsZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxDb21wb3NpdGlvbihjb21wKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLnByb2Nlc3NpbmdNZXNoSW5zdGFuY2VzLmNsZWFyKCk7XG5cbiAgICAgICAgLy8gZm9yIGFsbCBjYW1lcmFzXG4gICAgICAgIGNvbnN0IG51bUNhbWVyYXMgPSBjb21wLmNhbWVyYXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUNhbWVyYXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gY29tcC5jYW1lcmFzW2ldO1xuXG4gICAgICAgICAgICBsZXQgY3VycmVudFJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIGxldCBjYW1lcmFDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCsrO1xuXG4gICAgICAgICAgICAvLyBmb3IgYWxsIG9mIGl0cyBlbmFibGVkIGxheWVyc1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJJZHMgPSBjYW1lcmEubGF5ZXJzO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllcklkcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllckJ5SWQobGF5ZXJJZHNbal0pO1xuICAgICAgICAgICAgICAgIGlmIChsYXllciAmJiBsYXllci5lbmFibGVkKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhbWVyYSBhbmQgZnJ1c3R1bSB3aGVuIHRoZSByZW5kZXIgdGFyZ2V0IGNoYW5nZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogVGhpcyBpcyBkb25lIGhlcmUgdG8gaGFuZGxlIHRoZSBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBkZXByZWNhdGVkIExheWVyLnJlbmRlclRhcmdldCxcbiAgICAgICAgICAgICAgICAgICAgLy8gd2hlbiB0aGlzIGlzIG5vIGxvbmdlciBuZWVkZWQsIHRoaXMgY29kZSBjYW4gYmUgbW92ZWQgdXAgdG8gZXhlY3V0ZSBvbmNlIHBlciBjYW1lcmEuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclRhcmdldCA9IGNhbWVyYS5yZW5kZXJUYXJnZXQgPz8gbGF5ZXIucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhQ2hhbmdlZCB8fCByZW5kZXJUYXJnZXQgIT09IGN1cnJlbnRSZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYUNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRSZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmEuZnJhbWVVcGRhdGUocmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2FtZXJhRnJ1c3R1bShjYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGN1bGwgZWFjaCBsYXllcidzIG5vbi1kaXJlY3Rpb25hbCBsaWdodHMgb25jZSB3aXRoIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0cyBhcmVuJ3QgY29sbGVjdGVkIGFueXdoZXJlLCBidXQgbWFya2VkIGFzIHZpc2libGVcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdWxsTGlnaHRzKGNhbWVyYS5jYW1lcmEsIGxheWVyLl9saWdodHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGN1bGwgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25QcmVDdWxsPy4oY29tcC5jYW1lcmFzTWFwLmdldChjYW1lcmEpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjdWxsZWRJbnN0YW5jZXMgPSBsYXllci5nZXRDdWxsZWRJbnN0YW5jZXMoY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VsbChjYW1lcmEuY2FtZXJhLCBsYXllci5tZXNoSW5zdGFuY2VzLCBjdWxsZWRJbnN0YW5jZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdEN1bGw/Lihjb21wLmNhbWVyYXNNYXAuZ2V0KGNhbWVyYSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBzaGFkb3cgLyBjb29raWUgYXRsYXMgYWxsb2NhdGlvbiBmb3IgdGhlIHZpc2libGUgbGlnaHRzLiBVcGRhdGUgaXQgYWZ0ZXIgdGhlIGxpZ3RodHMgd2VyZSBjdWxsZWQsXG4gICAgICAgIC8vIGJ1dCBiZWZvcmUgc2hhZG93IG1hcHMgd2VyZSBjdWxsaW5nLCBhcyBpdCBtaWdodCBmb3JjZSBzb21lICd1cGRhdGUgb25jZScgc2hhZG93cyB0byBjdWxsLlxuICAgICAgICBpZiAodGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1bGwgc2hhZG93IGNhc3RlcnMgZm9yIGFsbCBsaWdodHNcbiAgICAgICAgdGhpcy5jdWxsU2hhZG93bWFwcyhjb21wKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2N1bGxUaW1lICs9IG5vdygpIC0gY3VsbFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IGRyYXdDYWxscyAtIE1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb25seUxpdFNoYWRlcnMgLSBMaW1pdHMgdGhlIHVwZGF0ZSB0byBzaGFkZXJzIGFmZmVjdGVkIGJ5IGxpZ2h0aW5nLlxuICAgICAqL1xuICAgIHVwZGF0ZVNoYWRlcnMoZHJhd0NhbGxzLCBvbmx5TGl0U2hhZGVycykge1xuICAgICAgICBjb25zdCBjb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWF0ID0gZHJhd0NhbGxzW2ldLm1hdGVyaWFsO1xuICAgICAgICAgICAgaWYgKG1hdCkge1xuICAgICAgICAgICAgICAgIC8vIG1hdGVyaWFsIG5vdCBwcm9jZXNzZWQgeWV0XG4gICAgICAgICAgICAgICAgaWYgKCFfdGVtcFNldC5oYXMobWF0KSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQobWF0KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBza2lwIHRoaXMgZm9yIG1hdGVyaWFscyBub3QgdXNpbmcgdmFyaWFudHNcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob25seUxpdFNoYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBza2lwIG1hdGVyaWFscyBub3QgdXNpbmcgbGlnaHRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW1hdC51c2VMaWdodGluZyB8fCAobWF0LmVtaXR0ZXIgJiYgIW1hdC5lbWl0dGVyLmxpZ2h0aW5nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFyIHNoYWRlciB2YXJpYW50cyBvbiB0aGUgbWF0ZXJpYWwgYW5kIGFsc28gb24gbWVzaCBpbnN0YW5jZXMgdGhhdCB1c2UgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdC5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBrZWVwIHRlbXAgc2V0IGVtcHR5XG4gICAgICAgIF90ZW1wU2V0LmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlRnJhbWVVbmlmb3JtcygpIHtcbiAgICAgICAgLy8gYmx1ZSBub2lzZSB0ZXh0dXJlXG4gICAgICAgIHRoaXMuYmx1ZU5vaXNlVGV4dHVyZUlkLnNldFZhbHVlKGdldEJsdWVOb2lzZVRleHR1cmUodGhpcy5kZXZpY2UpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqL1xuICAgIGJlZ2luRnJhbWUoY29tcCkge1xuXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgdXBkYXRlU2hhZGVycyA9IHNjZW5lLnVwZGF0ZVNoYWRlcnM7XG5cbiAgICAgICAgbGV0IHRvdGFsTWVzaEluc3RhbmNlcyA9IDA7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IGNvbXAubGF5ZXJMaXN0O1xuICAgICAgICBjb25zdCBsYXllckNvdW50ID0gbGF5ZXJzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzW2ldO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbGF5ZXIubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgICAgICB0b3RhbE1lc2hJbnN0YW5jZXMgKz0gY291bnQ7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0ID0gbWVzaEluc3RhbmNlc1tqXTtcblxuICAgICAgICAgICAgICAgIC8vIGNsZWFyIHZpc2liaWxpdHlcbiAgICAgICAgICAgICAgICBtZXNoSW5zdC52aXNpYmxlVGhpc0ZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IGFsbCBtZXNoIGluc3RhbmNlcyBpZiB3ZSBuZWVkIHRvIHVwZGF0ZSB0aGVpciBzaGFkZXJzLiBOb3RlIHRoYXQgdGhlcmUgY291bGRcbiAgICAgICAgICAgICAgICAvLyBiZSBkdXBsaWNhdGVzLCB3aGljaCBpcyBub3QgYSBwcm9ibGVtIGZvciB0aGUgc2hhZGVyIHVwZGF0ZXMsIHNvIHdlIGRvIG5vdCBmaWx0ZXIgdGhlbSBvdXQuXG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZVNoYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBNZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3QpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3Qgc2tpbm5lZCBtZXNoIGluc3RhbmNlc1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdC5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBNZXNoSW5zdGFuY2VzU2tpbm5lZC5wdXNoKG1lc2hJbnN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHNjZW5lLl9zdGF0cy5tZXNoSW5zdGFuY2VzID0gdG90YWxNZXNoSW5zdGFuY2VzO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyB1cGRhdGUgc2hhZGVycyBpZiBuZWVkZWRcbiAgICAgICAgaWYgKHVwZGF0ZVNoYWRlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IG9ubHlMaXRTaGFkZXJzID0gIXNjZW5lLnVwZGF0ZVNoYWRlcnM7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMoX3RlbXBNZXNoSW5zdGFuY2VzLCBvbmx5TGl0U2hhZGVycyk7XG4gICAgICAgICAgICBzY2VuZS51cGRhdGVTaGFkZXJzID0gZmFsc2U7XG4gICAgICAgICAgICBzY2VuZS5fc2hhZGVyVmVyc2lvbisrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVGcmFtZVVuaWZvcm1zKCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBza2luIG1hdHJpY2VzIHRvIHByb3Blcmx5IGN1bGwgc2tpbm5lZCBvYmplY3RzIChidXQgZG9uJ3QgdXBkYXRlIHJlbmRlcmluZyBkYXRhIHlldClcbiAgICAgICAgdGhpcy51cGRhdGVDcHVTa2luTWF0cmljZXMoX3RlbXBNZXNoSW5zdGFuY2VzU2tpbm5lZCk7XG5cbiAgICAgICAgLy8gY2xlYXIgbGlnaHQgYXJyYXlzXG4gICAgICAgIF90ZW1wTWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICBfdGVtcE1lc2hJbnN0YW5jZXNTa2lubmVkLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gY2xlYXIgbGlnaHQgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBsaWdodHMgPSB0aGlzLmxpZ2h0cztcbiAgICAgICAgY29uc3QgbGlnaHRDb3VudCA9IGxpZ2h0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBsaWdodHNbaV0uYmVnaW5GcmFtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoKSB7XG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMudXBkYXRlKHRoaXMubG9jYWxMaWdodHMsIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIGxheWVyIGNvbXBvc2l0aW9uIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqL1xuICAgIHVwZGF0ZUxheWVyQ29tcG9zaXRpb24oY29tcCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgbGVuID0gY29tcC5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wLmxheWVyTGlzdFtpXS5fcG9zdFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBzaGFkZXJWZXJzaW9uID0gc2NlbmUuX3NoYWRlclZlcnNpb247XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbaV07XG4gICAgICAgICAgICBsYXllci5fc2hhZGVyVmVyc2lvbiA9IHNoYWRlclZlcnNpb247XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgICAgICBsYXllci5fcmVuZGVyVGltZSA9IDA7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbaV07XG4gICAgICAgICAgICBpZiAodHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgfD0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXggPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgY29tcG9zaXRpb25cbiAgICAgICAgY29tcC5fdXBkYXRlKCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSArPSBub3coKSAtIGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcblxuICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQodGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuXG4gICAgICAgIC8vIG5vIHZhbGlkIHNoYWRvd3MgYXQgdGhlIHN0YXJ0IG9mIHRoZSBmcmFtZVxuICAgICAgICB0aGlzLmRpckxpZ2h0U2hhZG93cy5jbGVhcigpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJfc2tpblVwZGF0ZUluZGV4Iiwidmlld1Byb2pNYXQiLCJNYXQ0Iiwidmlld0ludk1hdCIsInZpZXdNYXQiLCJ2aWV3TWF0MyIsIk1hdDMiLCJ0ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfZmxpcFlNYXQiLCJzZXRTY2FsZSIsIl90ZW1wTGlnaHRTZXQiLCJTZXQiLCJfdGVtcExheWVyU2V0IiwiX3RlbXBWZWM0IiwiVmVjNCIsIl9maXhQcm9qUmFuZ2VNYXQiLCJzZXQiLCJfaGFsdG9uU2VxdWVuY2UiLCJWZWMyIiwiX3RlbXBQcm9qTWF0MCIsIl90ZW1wUHJvak1hdDEiLCJfdGVtcFByb2pNYXQyIiwiX3RlbXBQcm9qTWF0MyIsIl90ZW1wUHJvak1hdDQiLCJfdGVtcFByb2pNYXQ1IiwiX3RlbXBTZXQiLCJfdGVtcE1lc2hJbnN0YW5jZXMiLCJfdGVtcE1lc2hJbnN0YW5jZXNTa2lubmVkIiwiUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwicHJvY2Vzc2luZ01lc2hJbnN0YW5jZXMiLCJ3b3JsZENsdXN0ZXJzQWxsb2NhdG9yIiwibGlnaHRzIiwibG9jYWxMaWdodHMiLCJjYW1lcmFEaXJTaGFkb3dMaWdodHMiLCJNYXAiLCJkaXJMaWdodFNoYWRvd3MiLCJibHVlTm9pc2UiLCJCbHVlTm9pc2UiLCJkZXZpY2UiLCJzY2VuZSIsIldvcmxkQ2x1c3RlcnNBbGxvY2F0b3IiLCJsaWdodFRleHR1cmVBdGxhcyIsIkxpZ2h0VGV4dHVyZUF0bGFzIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsInNoYWRvd1JlbmRlcmVyIiwiU2hhZG93UmVuZGVyZXIiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsIlNoYWRvd1JlbmRlcmVyTG9jYWwiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIlNoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJfcmVuZGVyUGFzc1VwZGF0ZUNsdXN0ZXJlZCIsIlJlbmRlclBhc3NVcGRhdGVDbHVzdGVyZWQiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJfc2tpblRpbWUiLCJfbW9ycGhUaW1lIiwiX2N1bGxUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJfc2hhZG93RHJhd0NhbGxzIiwiX3NraW5EcmF3Q2FsbHMiLCJfaW5zdGFuY2VkRHJhd0NhbGxzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiX2NhbWVyYXNSZW5kZXJlZCIsIl9saWdodENsdXN0ZXJzIiwic2NvcGUiLCJib25lVGV4dHVyZUlkIiwicmVzb2x2ZSIsImJvbmVUZXh0dXJlU2l6ZUlkIiwicG9zZU1hdHJpeElkIiwibW9kZWxNYXRyaXhJZCIsIm5vcm1hbE1hdHJpeElkIiwidmlld0ludklkIiwidmlld1BvcyIsIkZsb2F0MzJBcnJheSIsInZpZXdQb3NJZCIsInByb2pJZCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdJZDMiLCJ2aWV3UHJvaklkIiwiZmxpcFlJZCIsInRibkJhc2lzIiwibmVhckNsaXBJZCIsImZhckNsaXBJZCIsImNhbWVyYVBhcmFtcyIsImNhbWVyYVBhcmFtc0lkIiwidmlld0luZGV4SWQiLCJibHVlTm9pc2VKaXR0ZXJJZCIsImJsdWVOb2lzZVRleHR1cmVJZCIsImFscGhhVGVzdElkIiwib3BhY2l0eU1hcElkIiwiZXhwb3N1cmVJZCIsInR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkIiwic2V0VmFsdWUiLCJtb3JwaFdlaWdodHNBIiwibW9ycGhXZWlnaHRzQiIsIm1vcnBoUG9zaXRpb25UZXgiLCJtb3JwaE5vcm1hbFRleCIsIm1vcnBoVGV4UGFyYW1zIiwibGlnaHRDdWJlIiwiTGlnaHRDdWJlIiwiY29uc3RhbnRMaWdodEN1YmUiLCJkZXN0cm95Iiwic29ydENvbXBhcmUiLCJkcmF3Q2FsbEEiLCJkcmF3Q2FsbEIiLCJsYXllciIsImRyYXdPcmRlciIsInpkaXN0IiwiemRpc3QyIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsInNvcnRDb21wYXJlTWVzaCIsImtleUEiLCJrZXlCIiwibWVzaCIsImlkIiwic29ydENvbXBhcmVEZXB0aCIsIlNPUlRLRVlfREVQVEgiLCJzZXR1cFZpZXdwb3J0IiwiY2FtZXJhIiwicmVuZGVyVGFyZ2V0IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwaXhlbFdpZHRoIiwid2lkdGgiLCJwaXhlbEhlaWdodCIsImhlaWdodCIsInJlY3QiLCJ4IiwiTWF0aCIsImZsb29yIiwieSIsInciLCJ6IiwiaCIsInNldFZpZXdwb3J0IiwiX3NjaXNzb3JSZWN0Q2xlYXIiLCJzY2lzc29yUmVjdCIsInNldFNjaXNzb3IiLCJwb3BHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInRhcmdldCIsImZsaXBZIiwidmlld0NvdW50IiwieHIiLCJzZXNzaW9uIiwiX2NhbWVyYSRfbm9kZSIsInRyYW5zZm9ybSIsIl9ub2RlIiwicGFyZW50IiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJ2aWV3cyIsImxpc3QiLCJsZW5ndGgiLCJ2IiwidmlldyIsInVwZGF0ZVRyYW5zZm9ybXMiLCJmcnVzdHVtIiwic2V0RnJvbU1hdDQiLCJwcm9qVmlld09mZk1hdCIsInByb2pNYXQiLCJwcm9qZWN0aW9uTWF0cml4IiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsIlZJRVdfQ0VOVEVSIiwicHJvak1hdFNreWJveCIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJtdWwyIiwiaXNXZWJHUFUiLCJqaXR0ZXIiLCJub2lzZSIsIlpFUk8iLCJ0YXJnZXRXaWR0aCIsInRhcmdldEhlaWdodCIsIm9mZnNldCIsInJlbmRlclZlcnNpb24iLCJvZmZzZXRYIiwib2Zmc2V0WSIsImNvcHkiLCJkYXRhIiwidmVjNCIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRUUlMiLCJWZWMzIiwiT05FIiwiaW52ZXJ0IiwiZGlzcGF0Y2hWaWV3UG9zIiwibiIsIl9uZWFyQ2xpcCIsImYiLCJfZmFyQ2xpcCIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsInBoeXNpY2FsVW5pdHMiLCJnZXRFeHBvc3VyZSIsImV4cG9zdXJlIiwiY2xlYXIiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsImZsYWdzIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJDTEVBUkZMQUdfQ09MT1IiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIkNMRUFSRkxBR19ERVBUSCIsIl9jbGVhclN0ZW5jaWxCdWZmZXIiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNvbG9yIiwiX2NsZWFyQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiZGVwdGgiLCJfY2xlYXJEZXB0aCIsInN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsIiwic2V0Q2FtZXJhIiwicmVuZGVyQWN0aW9uIiwiY2xlYXJWaWV3IiwiZm9yY2VXcml0ZSIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q29sb3JXcml0ZSIsInNldERlcHRoV3JpdGUiLCJvcHRpb25zIiwiX2NsZWFyT3B0aW9ucyIsInNldHVwQ3VsbE1vZGUiLCJjdWxsRmFjZXMiLCJmbGlwRmFjdG9yIiwiZHJhd0NhbGwiLCJtYXRlcmlhbCIsIm1vZGUiLCJDVUxMRkFDRV9OT05FIiwiZmxpcEZhY2VzIiwiY3VsbCIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfQkFDSyIsImZsaXBGYWNlc0ZhY3RvciIsIm5vZGUiLCJ3b3JsZFNjYWxlU2lnbiIsInNldEN1bGxNb2RlIiwidXBkYXRlQ2FtZXJhRnJ1c3R1bSIsInZpZXdPZmZNYXQiLCJzZXRCYXNlQ29uc3RhbnRzIiwib3BhY2l0eU1hcCIsImFscGhhVGVzdCIsInVwZGF0ZUNwdVNraW5NYXRyaWNlcyIsImRyYXdDYWxscyIsImRyYXdDYWxsc0NvdW50Iiwic2tpblRpbWUiLCJub3ciLCJpIiwic2kiLCJza2luSW5zdGFuY2UiLCJ1cGRhdGVNYXRyaWNlcyIsIl9kaXJ0eSIsInVwZGF0ZUdwdVNraW5NYXRyaWNlcyIsInNraW4iLCJ1cGRhdGVNYXRyaXhQYWxldHRlIiwidXBkYXRlTW9ycGhpbmciLCJtb3JwaFRpbWUiLCJtb3JwaEluc3QiLCJtb3JwaEluc3RhbmNlIiwidXBkYXRlIiwidXBkYXRlR1NwbGF0cyIsIl9kcmF3Q2FsbCRnc3BsYXRJbnN0YSIsImdzcGxhdEluc3RhbmNlIiwiZ3B1VXBkYXRlIiwic2V0VmVydGV4QnVmZmVycyIsInNldFZlcnRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlciIsInNldE1vcnBoaW5nIiwibW9ycGgiLCJ1c2VUZXh0dXJlTW9ycGgiLCJ2ZXJ0ZXhCdWZmZXJJZHMiLCJ0ZXh0dXJlUG9zaXRpb25zIiwidGV4dHVyZU5vcm1hbHMiLCJfdGV4dHVyZVBhcmFtcyIsInQiLCJfYWN0aXZlVmVydGV4QnVmZmVycyIsInZiIiwic2VtYW50aWMiLCJTRU1BTlRJQ19BVFRSIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJuYW1lIiwic2NvcGVJZCIsIl9zaGFkZXJNb3JwaFdlaWdodHNBIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0IiLCJzZXRTa2lubmluZyIsIm1lc2hJbnN0YW5jZSIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiYm9uZVRleHR1cmUiLCJib25lVGV4dHVyZVNpemUiLCJtYXRyaXhQYWxldHRlIiwicG9zaXRpb24iLCJ2cCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiaXNDbHVzdGVyZWQiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwidW5pZm9ybXMiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIlVOSUZPUk1UWVBFX01BVDMiLCJVTklGT1JNVFlQRV9WRUMzIiwiVU5JRk9STVRZUEVfRkxPQVQiLCJwdXNoIiwiVU5JRk9STVRZUEVfVkVDMiIsIlVOSUZPUk1UWVBFX0lOVCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJidWZmZXJzIiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJ0ZXh0dXJlcyIsIkJpbmRUZXh0dXJlRm9ybWF0IiwiVEVYVFVSRURJTUVOU0lPTl8yRCIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwiU0FNUExFVFlQRV9ERVBUSCIsIlNBTVBMRVRZUEVfRkxPQVQiLCJCaW5kR3JvdXBGb3JtYXQiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJ1YiIsIlVuaWZvcm1CdWZmZXIiLCJiZyIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsInZpZXdCaW5kR3JvdXAiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsInNldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9WSUVXIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJzaGFkZXJJbnN0YW5jZSIsIndvcmxkVHJhbnNmb3JtIiwibm9ybWFsTWF0cml4IiwibWVzaEJpbmRHcm91cCIsImdldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9NRVNIIiwiZHJhd0luc3RhbmNlIiwic3R5bGUiLCJub3JtYWwiLCJtb2RlbE1hdHJpeCIsImluc3RhbmNpbmdEYXRhIiwiY291bnQiLCJkcmF3IiwicHJpbWl0aXZlIiwiZHJhd0luc3RhbmNlMiIsInVuZGVmaW5lZCIsImN1bGxlZEluc3RhbmNlcyIsImN1bGxUaW1lIiwib3BhcXVlIiwidHJhbnNwYXJlbnQiLCJkb0N1bGwiLCJmcnVzdHVtQ3VsbGluZyIsInZpc2libGUiLCJfaXNWaXNpYmxlIiwidmlzaWJsZVRoaXNGcmFtZSIsImJ1Y2tldCIsImFkZCIsImNhbWVyYXMiLCJjb2xsZWN0TGlnaHRzIiwiY29tcCIsInN0YXRzIiwiX3N0YXRzIiwiZHluYW1pY0xpZ2h0cyIsImJha2VkTGlnaHRzIiwibGF5ZXJMaXN0IiwiaGFzIiwiX2xpZ2h0cyIsImoiLCJsaWdodCIsIl90eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsImN1bGxMaWdodHMiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJlbmFibGVkIiwiZ2V0Qm91bmRpbmdTcGhlcmUiLCJjb250YWluc1NwaGVyZSIsInVzZVBoeXNpY2FsVW5pdHMiLCJzY3JlZW5TaXplIiwiZ2V0U2NyZWVuU2l6ZSIsIm1heFNjcmVlblNpemUiLCJtYXgiLCJjYXN0U2hhZG93cyIsInNoYWRvd01hcCIsImN1bGxTaGFkb3dtYXBzIiwiYXRsYXNTbG90VXBkYXRlZCIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJnZXRSZW5kZXJEYXRhIiwic2hhZG93Q2FtZXJhIiwiY2FtZXJhQ29tcG9uZW50IiwibGlnaHRMaXN0IiwiY2FtZXJhTGF5ZXJzIiwibGF5ZXJzIiwibCIsImNhbWVyYUxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwibGF5ZXJEaXJMaWdodHMiLCJzcGxpdExpZ2h0cyIsIl9saWdodExpc3QiLCJjdWxsQ29tcG9zaXRpb24iLCJudW1DYW1lcmFzIiwiY3VycmVudFJlbmRlclRhcmdldCIsImNhbWVyYUNoYW5nZWQiLCJsYXllcklkcyIsIl9jYW1lcmEkcmVuZGVyVGFyZ2V0IiwiZnJhbWVVcGRhdGUiLCJvblByZUN1bGwiLCJjYW1lcmFzTWFwIiwiZ2V0IiwiZ2V0Q3VsbGVkSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsIm9uUG9zdEN1bGwiLCJ1cGRhdGVMaWdodFRleHR1cmVBdGxhcyIsInVwZGF0ZVNoYWRlcnMiLCJvbmx5TGl0U2hhZGVycyIsIm1hdCIsImdldFNoYWRlclZhcmlhbnQiLCJNYXRlcmlhbCIsInByb3RvdHlwZSIsInVzZUxpZ2h0aW5nIiwiZW1pdHRlciIsImxpZ2h0aW5nIiwiY2xlYXJWYXJpYW50cyIsInVwZGF0ZUZyYW1lVW5pZm9ybXMiLCJnZXRCbHVlTm9pc2VUZXh0dXJlIiwiYmVnaW5GcmFtZSIsInRvdGFsTWVzaEluc3RhbmNlcyIsImxheWVyQ291bnQiLCJtZXNoSW5zdCIsIl9zaGFkZXJWZXJzaW9uIiwibGlnaHRDb3VudCIsInVwZGF0ZUxheWVyQ29tcG9zaXRpb24iLCJsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsImxlbiIsIl9wb3N0UmVuZGVyQ291bnRlciIsInNoYWRlclZlcnNpb24iLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9yZW5kZXJUaW1lIiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJzdWJMYXllckxpc3QiLCJfcG9zdFJlbmRlckNvdW50ZXJNYXgiLCJfdXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyQ0EsSUFBSUEsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0FBQ3hCLE1BQU1DLFdBQVcsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUM5QixNQUFNQyxVQUFVLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDN0IsTUFBTUUsT0FBTyxHQUFHLElBQUlGLElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1HLFFBQVEsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNQyxVQUFVLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFDdkMsTUFBTUMsU0FBUyxHQUFHLElBQUlQLElBQUksRUFBRSxDQUFDUSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQy9DLE1BQU1DLGFBQWEsR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTtBQUMvQixNQUFNQyxhQUFhLEdBQUcsSUFBSUQsR0FBRyxFQUFFLENBQUE7QUFDL0IsTUFBTUUsU0FBUyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUU1QjtBQUNBLE1BQU1DLGdCQUFnQixHQUFHLElBQUlkLElBQUksRUFBRSxDQUFDZSxHQUFHLENBQUMsQ0FDcEMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUNWLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFDVixDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQ1osQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUNmLENBQUMsQ0FBQTs7QUFFRjtBQUNBLE1BQU1DLGVBQWUsR0FBRyxDQUNwQixJQUFJQyxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxFQUN2QixJQUFJQSxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUN4QixJQUFJQSxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUN4QixJQUFJQSxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUN6QixJQUFJQSxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUN6QixJQUFJQSxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUN6QixJQUFJQSxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUN6QixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUMxQixJQUFJQSxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUM5QixDQUFBO0FBRUQsTUFBTUMsYUFBYSxHQUFHLElBQUlsQixJQUFJLEVBQUUsQ0FBQTtBQUNoQyxNQUFNbUIsYUFBYSxHQUFHLElBQUluQixJQUFJLEVBQUUsQ0FBQTtBQUNoQyxNQUFNb0IsYUFBYSxHQUFHLElBQUlwQixJQUFJLEVBQUUsQ0FBQTtBQUNoQyxNQUFNcUIsYUFBYSxHQUFHLElBQUlyQixJQUFJLEVBQUUsQ0FBQTtBQUNo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
