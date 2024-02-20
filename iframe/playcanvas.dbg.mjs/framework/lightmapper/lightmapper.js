import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, CHUNKAPI_1_65, CULLFACE_NONE, TEXHINT_LIGHTMAP, TEXTURETYPE_DEFAULT, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { LightingParams } from '../../scene/lighting/lighting-params.js';
import { WorldClusters } from '../../scene/lighting/world-clusters.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';
import { PROJECTION_ORTHOGRAPHIC, MASK_AFFECT_LIGHTMAPPED, BAKE_COLORDIR, MASK_BAKE, MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, FOG_NONE, LIGHTTYPE_SPOT, PROJECTION_PERSPECTIVE, LIGHTTYPE_OMNI, SHADER_FORWARDHDR, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from '../../scene/constants.js';
import { Camera } from '../../scene/camera.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from '../../scene/graphics/lightmap-cache.js';
import { LightmapFilters } from './lightmap-filters.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPassLightmapper } from './render-pass-lightmapper.js';

const MAX_LIGHTMAP_SIZE = 2048;
const PASS_COLOR = 0;
const PASS_DIR = 1;
const tempVec = new Vec3();

/**
 * The lightmapper is used to bake scene lights into textures.
 *
 * @category Graphics
 */
class Lightmapper {
  /**
   * Create a new Lightmapper instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device used by the lightmapper.
   * @param {import('../entity.js').Entity} root - The root entity of the scene.
   * @param {import('../../scene/scene.js').Scene} scene - The scene to lightmap.
   * @param {import('../../scene/renderer/forward-renderer.js').ForwardRenderer} renderer - The
   * renderer.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - Registry of assets to
   * lightmap.
   * @hideconstructor
   */
  constructor(device, root, scene, renderer, assets) {
    this.device = device;
    this.root = root;
    this.scene = scene;
    this.renderer = renderer;
    this.assets = assets;
    this.shadowMapCache = renderer.shadowMapCache;
    this._tempSet = new Set();
    this._initCalled = false;

    // internal materials used by baking
    this.passMaterials = [];
    this.ambientAOMaterial = null;
    this.fog = '';
    this.ambientLight = new Color();

    // dictionary of spare render targets with color buffer for each used size
    this.renderTargets = new Map();
    this.stats = {
      renderPasses: 0,
      lightmapCount: 0,
      totalRenderTime: 0,
      forwardTime: 0,
      fboTime: 0,
      shadowMapTime: 0,
      compileTime: 0,
      shadersLinked: 0
    };
  }
  destroy() {
    var _this$camera;
    // release reference to the texture
    LightmapCache.decRef(this.blackTex);
    this.blackTex = null;

    // destroy all lightmaps
    LightmapCache.destroy();
    this.device = null;
    this.root = null;
    this.scene = null;
    this.renderer = null;
    this.assets = null;
    (_this$camera = this.camera) == null || _this$camera.destroy();
    this.camera = null;
  }
  initBake(device) {
    // only initialize one time
    if (!this._initCalled) {
      this._initCalled = true;

      // lightmap filtering shaders
      this.lightmapFilters = new LightmapFilters(device);

      // shader related
      this.constantBakeDir = device.scope.resolve('bakeDir');
      this.materials = [];

      // small black texture
      this.blackTex = new Texture(this.device, {
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGBA8,
        type: TEXTURETYPE_RGBM,
        name: 'lightmapBlack'
      });

      // incref black texture in the cache to avoid it being destroyed
      LightmapCache.incRef(this.blackTex);

      // camera used for baking
      const camera = new Camera();
      camera.clearColor.set(0, 0, 0, 0);
      camera.clearColorBuffer = true;
      camera.clearDepthBuffer = false;
      camera.clearStencilBuffer = false;
      camera.frustumCulling = false;
      camera.projection = PROJECTION_ORTHOGRAPHIC;
      camera.aspectRatio = 1;
      camera.node = new GraphNode();
      this.camera = camera;
    }

    // create light cluster structure
    if (this.scene.clusteredLightingEnabled) {
      // create light params, and base most parameters on the lighting params of the scene
      const lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, () => {});
      this.lightingParams = lightingParams;
      const srcParams = this.scene.lighting;
      lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
      lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;
      lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
      lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;
      lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;

      // some custom lightmapping params - we bake single light a time
      lightingParams.cells = new Vec3(3, 3, 3);
      lightingParams.maxLightsPerCell = 4;
      this.worldClusters = new WorldClusters(device);
      this.worldClusters.name = 'ClusterLightmapper';
    }
  }
  finishBake(bakeNodes) {
    this.materials = [];
    function destroyRT(rt) {
      // this can cause ref count to be 0 and texture destroyed
      LightmapCache.decRef(rt.colorBuffer);

      // destroy render target itself
      rt.destroy();
    }

    // spare render targets including color buffer
    this.renderTargets.forEach(rt => {
      destroyRT(rt);
    });
    this.renderTargets.clear();

    // destroy render targets from nodes (but not color buffer)
    bakeNodes.forEach(node => {
      node.renderTargets.forEach(rt => {
        destroyRT(rt);
      });
      node.renderTargets.length = 0;
    });

    // this shader is only valid for specific brightness and contrast values, dispose it
    this.ambientAOMaterial = null;

    // delete light cluster
    if (this.worldClusters) {
      this.worldClusters.destroy();
      this.worldClusters = null;
    }
  }
  createMaterialForPass(device, scene, pass, addAmbient) {
    const material = new StandardMaterial();
    material.name = `lmMaterial-pass:${pass}-ambient:${addAmbient}`;
    material.chunks.APIVersion = CHUNKAPI_1_65;
    const transformDefines = '#define UV1LAYOUT\n';
    material.chunks.transformVS = transformDefines + shaderChunks.transformVS; // draw into UV1 texture space

    if (pass === PASS_COLOR) {
      let bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS; // encode to RGBM
      if (addAmbient) {
        // diffuse light stores accumulated AO, apply contrast and brightness to it
        // and multiply ambient light color by the AO
        bakeLmEndChunk = `
                    dDiffuseLight = ((dDiffuseLight - 0.5) * max(${scene.ambientBakeOcclusionContrast.toFixed(1)} + 1.0, 0.0)) + 0.5;
                    dDiffuseLight += vec3(${scene.ambientBakeOcclusionBrightness.toFixed(1)});
                    dDiffuseLight = saturate(dDiffuseLight);
                    dDiffuseLight *= dAmbientLight;
                ` + bakeLmEndChunk;
      } else {
        material.ambient = new Color(0, 0, 0); // don't bake ambient
        material.ambientTint = true;
      }
      material.chunks.basePS = shaderChunks.basePS + (scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? '\n#define LIGHTMAP_RGBM\n' : '');
      material.chunks.endPS = bakeLmEndChunk;
      material.lightMap = this.blackTex;
    } else {
      material.chunks.basePS = shaderChunks.basePS + '\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n';
      material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
    }

    // avoid writing unrelated things to alpha
    material.chunks.outputAlphaPS = '\n';
    material.chunks.outputAlphaOpaquePS = '\n';
    material.chunks.outputAlphaPremulPS = '\n';
    material.cull = CULLFACE_NONE;
    material.forceUv1 = true; // provide data to xformUv1
    material.update();
    return material;
  }
  createMaterials(device, scene, passCount) {
    for (let pass = 0; pass < passCount; pass++) {
      if (!this.passMaterials[pass]) {
        this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
      }
    }

    // material used on last render of ambient light to multiply accumulated AO in lightmap by ambient light
    if (!this.ambientAOMaterial) {
      this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
      this.ambientAOMaterial.onUpdateShader = function (options) {
        // mark LM as without ambient, to add it
        options.litOptions.lightMapWithoutAmbient = true;
        // don't add ambient to diffuse directly but keep it separate, to allow AO to be multiplied in
        options.litOptions.separateAmbient = true;
        return options;
      };
    }
  }
  createTexture(size, name) {
    return new Texture(this.device, {
      profilerHint: TEXHINT_LIGHTMAP,
      width: size,
      height: size,
      format: this.scene.lightmapPixelFormat,
      mipmaps: false,
      type: this.scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      name: name
    });
  }

  // recursively walk the hierarchy of nodes starting at the specified node
  // collect all nodes that need to be lightmapped to bakeNodes array
  // collect all nodes with geometry to allNodes array
  collectModels(node, bakeNodes, allNodes) {
    var _node$model, _node$model2, _node$render;
    if (!node.enabled) return;

    // mesh instances from model component
    let meshInstances;
    if ((_node$model = node.model) != null && _node$model.model && (_node$model2 = node.model) != null && _node$model2.enabled) {
      if (allNodes) allNodes.push(new BakeMeshNode(node));
      if (node.model.lightmapped) {
        if (bakeNodes) {
          meshInstances = node.model.model.meshInstances;
        }
      }
    }

    // mesh instances from render component
    if ((_node$render = node.render) != null && _node$render.enabled) {
      if (allNodes) allNodes.push(new BakeMeshNode(node));
      if (node.render.lightmapped) {
        if (bakeNodes) {
          meshInstances = node.render.meshInstances;
        }
      }
    }
    if (meshInstances) {
      let hasUv1 = true;
      for (let i = 0; i < meshInstances.length; i++) {
        if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
          Debug.log(`Lightmapper - node [${node.name}] contains meshes without required uv1, excluding it from baking.`);
          hasUv1 = false;
          break;
        }
      }
      if (hasUv1) {
        const notInstancedMeshInstances = [];
        for (let i = 0; i < meshInstances.length; i++) {
          const mesh = meshInstances[i].mesh;

          // is this mesh an instance of already used mesh in this node
          if (this._tempSet.has(mesh)) {
            // collect each instance (object with shared VB) as separate "node"
            bakeNodes.push(new BakeMeshNode(node, [meshInstances[i]]));
          } else {
            notInstancedMeshInstances.push(meshInstances[i]);
          }
          this._tempSet.add(mesh);
        }
        this._tempSet.clear();

        // collect all non-shared objects as one "node"
        if (notInstancedMeshInstances.length > 0) {
          bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
        }
      }
    }
    for (let i = 0; i < node._children.length; i++) {
      this.collectModels(node._children[i], bakeNodes, allNodes);
    }
  }

  // prepare all meshInstances that cast shadows into lightmaps
  prepareShadowCasters(nodes) {
    const casters = [];
    for (let n = 0; n < nodes.length; n++) {
      const component = nodes[n].component;
      component.castShadows = component.castShadowsLightmap;
      if (component.castShadowsLightmap) {
        const meshes = nodes[n].meshInstances;
        for (let i = 0; i < meshes.length; i++) {
          meshes[i].visibleThisFrame = true;
          casters.push(meshes[i]);
        }
      }
    }
    return casters;
  }

  // updates world transform for nodes
  updateTransforms(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      for (let j = 0; j < meshInstances.length; j++) {
        meshInstances[j].node.getWorldTransform();
      }
    }
  }

  // Note: this function is also called by the Editor to display estimated LM size in the inspector,
  // do not change its signature.
  calculateLightmapSize(node) {
    let data;
    const sizeMult = this.scene.lightmapSizeMultiplier || 16;
    const scale = tempVec;
    let srcArea, lightmapSizeMultiplier;
    if (node.model) {
      lightmapSizeMultiplier = node.model.lightmapSizeMultiplier;
      if (node.model.asset) {
        data = this.assets.get(node.model.asset).data;
        if (data.area) {
          srcArea = data.area;
        }
      } else if (node.model._area) {
        data = node.model;
        if (data._area) {
          srcArea = data._area;
        }
      }
    } else if (node.render) {
      lightmapSizeMultiplier = node.render.lightmapSizeMultiplier;
      if (node.render.type !== 'asset') {
        if (node.render._area) {
          data = node.render;
          if (data._area) {
            srcArea = data._area;
          }
        }
      }
    }

    // copy area
    const area = {
      x: 1,
      y: 1,
      z: 1,
      uv: 1
    };
    if (srcArea) {
      area.x = srcArea.x;
      area.y = srcArea.y;
      area.z = srcArea.z;
      area.uv = srcArea.uv;
    }
    const areaMult = lightmapSizeMultiplier || 1;
    area.x *= areaMult;
    area.y *= areaMult;
    area.z *= areaMult;

    // bounds of the component
    const component = node.render || node.model;
    const bounds = this.computeNodeBounds(component.meshInstances);

    // total area in the lightmap is based on the world space bounds of the mesh
    scale.copy(bounds.halfExtents);
    let totalArea = area.x * scale.y * scale.z + area.y * scale.x * scale.z + area.z * scale.x * scale.y;
    totalArea /= area.uv;
    totalArea = Math.sqrt(totalArea);
    const lightmapSize = Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);
    return lightmapSize;
  }
  setLightmapping(nodes, value, passCount, shaderDefs) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const meshInstances = node.meshInstances;
      for (let j = 0; j < meshInstances.length; j++) {
        const meshInstance = meshInstances[j];
        meshInstance.setLightmapped(value);
        if (value) {
          if (shaderDefs) {
            meshInstance._shaderDefs |= shaderDefs;
          }

          // only lights that affect lightmapped objects are used on this mesh now that it is baked
          meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;

          // textures
          for (let pass = 0; pass < passCount; pass++) {
            const tex = node.renderTargets[pass].colorBuffer;
            tex.minFilter = FILTER_LINEAR;
            tex.magFilter = FILTER_LINEAR;
            meshInstance.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tex);
          }
        }
      }
    }
  }

  /**
   * Generates and applies the lightmaps.
   *
   * @param {import('../entity.js').Entity[]|null} nodes - An array of entities (with model or
   * render components) to render lightmaps for. If not supplied, the entire scene will be baked.
   * @param {number} [mode] - Baking mode. Can be:
   *
   * - {@link BAKE_COLOR}: single color lightmap
   * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
   * bump/specular)
   *
   * Only lights with bakeDir=true will be used for generating the dominant light direction.
   * Defaults to {@link BAKE_COLORDIR}.
   */
  bake(nodes, mode = BAKE_COLORDIR) {
    const device = this.device;
    const startTime = now();

    // update skybox
    this.scene._updateSkyMesh();
    device.fire('lightmapper:start', {
      timestamp: startTime,
      target: this
    });
    this.stats.renderPasses = 0;
    this.stats.shadowMapTime = 0;
    this.stats.forwardTime = 0;
    const startShaders = device._shaderStats.linked;
    const startFboTime = device._renderTargetCreationTime;
    const startCompileTime = device._shaderStats.compileTime;

    // BakeMeshNode objects for baking
    const bakeNodes = [];

    // all BakeMeshNode objects
    const allNodes = [];

    // collect nodes / meshInstances for baking
    if (nodes) {
      // collect nodes for baking based on specified list of nodes
      for (let i = 0; i < nodes.length; i++) {
        this.collectModels(nodes[i], bakeNodes, null);
      }

      // collect all nodes from the scene
      this.collectModels(this.root, null, allNodes);
    } else {
      // collect nodes from the root of the scene
      this.collectModels(this.root, bakeNodes, allNodes);
    }
    DebugGraphics.pushGpuMarker(this.device, 'LMBake');

    // bake nodes
    if (bakeNodes.length > 0) {
      this.renderer.shadowRenderer.frameUpdate();

      // disable lightmapping
      const passCount = mode === BAKE_COLORDIR ? 2 : 1;
      this.setLightmapping(bakeNodes, false, passCount);
      this.initBake(device);
      this.bakeInternal(passCount, bakeNodes, allNodes);

      // Enable new lightmaps
      let shaderDefs = SHADERDEF_LM;
      if (mode === BAKE_COLORDIR) {
        shaderDefs |= SHADERDEF_DIRLM;
      }

      // mark lightmap as containing ambient lighting
      if (this.scene.ambientBake) {
        shaderDefs |= SHADERDEF_LMAMBIENT;
      }
      this.setLightmapping(bakeNodes, true, passCount, shaderDefs);

      // clean up memory
      this.finishBake(bakeNodes);
    }
    DebugGraphics.popGpuMarker(this.device);
    const nowTime = now();
    this.stats.totalRenderTime = nowTime - startTime;
    this.stats.shadersLinked = device._shaderStats.linked - startShaders;
    this.stats.compileTime = device._shaderStats.compileTime - startCompileTime;
    this.stats.fboTime = device._renderTargetCreationTime - startFboTime;
    this.stats.lightmapCount = bakeNodes.length;
    device.fire('lightmapper:end', {
      timestamp: nowTime,
      target: this
    });
  }

  // this allocates lightmap textures and render targets.
  allocateTextures(bakeNodes, passCount) {
    for (let i = 0; i < bakeNodes.length; i++) {
      // required lightmap size
      const bakeNode = bakeNodes[i];
      const size = this.calculateLightmapSize(bakeNode.node);

      // texture and render target for each pass, stored per node
      for (let pass = 0; pass < passCount; pass++) {
        const tex = this.createTexture(size, 'lightmapper_lightmap_' + i);
        LightmapCache.incRef(tex);
        bakeNode.renderTargets[pass] = new RenderTarget({
          colorBuffer: tex,
          depth: false
        });
      }

      // single temporary render target of each size
      if (!this.renderTargets.has(size)) {
        const tex = this.createTexture(size, 'lightmapper_temp_lightmap_' + size);
        LightmapCache.incRef(tex);
        this.renderTargets.set(size, new RenderTarget({
          colorBuffer: tex,
          depth: false
        }));
      }
    }
  }
  prepareLightsToBake(layerComposition, allLights, bakeLights) {
    // ambient light
    if (this.scene.ambientBake) {
      const ambientLight = new BakeLightAmbient(this.scene);
      bakeLights.push(ambientLight);
    }

    // scene lights
    const sceneLights = this.renderer.lights;
    for (let i = 0; i < sceneLights.length; i++) {
      const light = sceneLights[i];

      // store all lights and their original settings we need to temporarily modify
      const bakeLight = new BakeLightSimple(this.scene, light);
      allLights.push(bakeLight);

      // bake light
      if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
        light.mask = MASK_BAKE | MASK_AFFECT_LIGHTMAPPED | MASK_AFFECT_DYNAMIC;
        light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
        bakeLights.push(bakeLight);
      }
    }

    // sort bake lights by type to minimize shader switches
    bakeLights.sort();
  }
  restoreLights(allLights) {
    for (let i = 0; i < allLights.length; i++) {
      allLights[i].restore();
    }
  }
  setupScene() {
    // backup
    this.fog = this.scene.fog;
    this.ambientLight.copy(this.scene.ambientLight);

    // set up scene
    this.scene.fog = FOG_NONE;

    // if not baking ambient, set it to black
    if (!this.scene.ambientBake) {
      this.scene.ambientLight.set(0, 0, 0);
    }

    // apply scene settings
    this.renderer.setSceneConstants();
  }
  restoreScene() {
    this.scene.fog = this.fog;
    this.scene.ambientLight.copy(this.ambientLight);
  }

  // compute bounding box for a single node
  computeNodeBounds(meshInstances) {
    const bounds = new BoundingBox();
    if (meshInstances.length > 0) {
      bounds.copy(meshInstances[0].aabb);
      for (let m = 1; m < meshInstances.length; m++) {
        bounds.add(meshInstances[m].aabb);
      }
    }
    return bounds;
  }

  // compute bounding box for each node
  computeNodesBounds(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      nodes[i].bounds = this.computeNodeBounds(meshInstances);
    }
  }

  // compute compound bounding box for an array of mesh instances
  computeBounds(meshInstances) {
    const bounds = new BoundingBox();
    for (let i = 0; i < meshInstances.length; i++) {
      bounds.copy(meshInstances[0].aabb);
      for (let m = 1; m < meshInstances.length; m++) {
        bounds.add(meshInstances[m].aabb);
      }
    }
    return bounds;
  }
  backupMaterials(meshInstances) {
    for (let i = 0; i < meshInstances.length; i++) {
      this.materials[i] = meshInstances[i].material;
    }
  }
  restoreMaterials(meshInstances) {
    for (let i = 0; i < meshInstances.length; i++) {
      meshInstances[i].material = this.materials[i];
    }
  }
  lightCameraPrepare(device, bakeLight) {
    const light = bakeLight.light;
    let shadowCam;

    // only prepare camera for spot light, other cameras need to be adjusted per cubemap face / per node later
    if (light.type === LIGHTTYPE_SPOT) {
      const lightRenderData = light.getRenderData(null, 0);
      shadowCam = lightRenderData.shadowCamera;
      shadowCam._node.setPosition(light._node.getPosition());
      shadowCam._node.setRotation(light._node.getRotation());
      shadowCam._node.rotateLocal(-90, 0, 0);
      shadowCam.projection = PROJECTION_PERSPECTIVE;
      shadowCam.nearClip = light.attenuationEnd / 1000;
      shadowCam.farClip = light.attenuationEnd;
      shadowCam.aspectRatio = 1;
      shadowCam.fov = light._outerConeAngle * 2;
      this.renderer.updateCameraFrustum(shadowCam);
    }
    return shadowCam;
  }

  // prepares camera / frustum of the light for rendering the bakeNode
  // returns true if light affects the bakeNode
  lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {
    const light = bakeLight.light;
    let lightAffectsNode = true;
    if (light.type === LIGHTTYPE_DIRECTIONAL) {
      // tweak directional light camera to fully see all casters and they are fully inside the frustum
      tempVec.copy(casterBounds.center);
      tempVec.y += casterBounds.halfExtents.y;
      this.camera.node.setPosition(tempVec);
      this.camera.node.setEulerAngles(-90, 0, 0);
      this.camera.nearClip = 0;
      this.camera.farClip = casterBounds.halfExtents.y * 2;
      const frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
      this.camera.orthoHeight = frustumSize;
    } else {
      // for other light types, test if light affects the node
      if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
        lightAffectsNode = false;
      }
    }

    // per meshInstance culling for spot light only
    // (omni lights cull per face later, directional lights don't cull)
    if (light.type === LIGHTTYPE_SPOT) {
      let nodeVisible = false;
      const meshInstances = bakeNode.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        if (meshInstances[i]._isVisible(shadowCam)) {
          nodeVisible = true;
          break;
        }
      }
      if (!nodeVisible) {
        lightAffectsNode = false;
      }
    }
    return lightAffectsNode;
  }

  // set up light array for a single light
  setupLightArray(lightArray, light) {
    lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
    lightArray[LIGHTTYPE_OMNI].length = 0;
    lightArray[LIGHTTYPE_SPOT].length = 0;
    lightArray[light.type][0] = light;
    light.visibleThisFrame = true;
  }
  renderShadowMap(comp, shadowMapRendered, casters, bakeLight) {
    const light = bakeLight.light;
    const isClustered = this.scene.clusteredLightingEnabled;
    const castShadow = light.castShadows && (!isClustered || this.scene.lighting.shadowsEnabled);
    if (!shadowMapRendered && castShadow) {
      // allocate shadow map from the cache to avoid per light allocation
      if (!light.shadowMap && !isClustered) {
        light.shadowMap = this.shadowMapCache.get(this.device, light);
      }
      if (light.type === LIGHTTYPE_DIRECTIONAL) {
        this.renderer._shadowRendererDirectional.cull(light, comp, this.camera, casters);
        const shadowPass = this.renderer._shadowRendererDirectional.getLightRenderPass(light, this.camera);
        shadowPass == null || shadowPass.render();
      } else {
        // TODO: lightmapper on WebGPU does not yet support spot and omni shadows
        if (this.device.isWebGPU) {
          Debug.warnOnce('Lightmapper on WebGPU does not yet support spot and omni shadows.');
          return true;
        }
        this.renderer._shadowRendererLocal.cull(light, comp, casters);

        // TODO: this needs to use render passes to work on WebGPU
        const insideRenderPass = false;
        this.renderer.shadowRenderer.render(light, this.camera, insideRenderPass);
      }
    }
    return true;
  }
  postprocessTextures(device, bakeNodes, passCount) {
    const numDilates2x = 1; // 1 or 2 dilates (depending on filter being enabled)
    const dilateShader = this.lightmapFilters.shaderDilate;

    // bilateral denoise filter - runs as a first pass, before dilate
    const filterLightmap = this.scene.lightmapFilterEnabled;
    if (filterLightmap) {
      this.lightmapFilters.prepareDenoise(this.scene.lightmapFilterRange, this.scene.lightmapFilterSmoothness);
    }
    device.setBlendState(BlendState.NOBLEND);
    device.setDepthState(DepthState.NODEPTH);
    device.setStencilState(null, null);
    for (let node = 0; node < bakeNodes.length; node++) {
      const bakeNode = bakeNodes[node];
      DebugGraphics.pushGpuMarker(this.device, `LMPost:${node}`);
      for (let pass = 0; pass < passCount; pass++) {
        const nodeRT = bakeNode.renderTargets[pass];
        const lightmap = nodeRT.colorBuffer;
        const tempRT = this.renderTargets.get(lightmap.width);
        const tempTex = tempRT.colorBuffer;
        this.lightmapFilters.prepare(lightmap.width, lightmap.height);

        // bounce dilate between textures, execute denoise on the first pass
        for (let i = 0; i < numDilates2x; i++) {
          this.lightmapFilters.setSourceTexture(lightmap);
          const bilateralFilterEnabled = filterLightmap && pass === 0 && i === 0;
          drawQuadWithShader(device, tempRT, bilateralFilterEnabled ? this.lightmapFilters.shaderDenoise : dilateShader);
          this.lightmapFilters.setSourceTexture(tempTex);
          drawQuadWithShader(device, nodeRT, dilateShader);
        }
      }
      DebugGraphics.popGpuMarker(this.device);
    }
  }
  bakeInternal(passCount, bakeNodes, allNodes) {
    const scene = this.scene;
    const comp = scene.layers;
    const device = this.device;
    const clusteredLightingEnabled = scene.clusteredLightingEnabled;
    this.createMaterials(device, scene, passCount);
    this.setupScene();

    // update layer composition
    comp._update();

    // compute bounding boxes for nodes
    this.computeNodesBounds(bakeNodes);

    // Calculate lightmap sizes and allocate textures
    this.allocateTextures(bakeNodes, passCount);

    // Collect bakeable lights, and also keep allLights along with their properties we change to restore them later
    this.renderer.collectLights(comp);
    const allLights = [],
      bakeLights = [];
    this.prepareLightsToBake(comp, allLights, bakeLights);

    // update transforms
    this.updateTransforms(allNodes);

    // get all meshInstances that cast shadows into lightmap and set them up for realtime shadow casting
    const casters = this.prepareShadowCasters(allNodes);

    // update skinned and morphed meshes
    this.renderer.updateCpuSkinMatrices(casters);
    this.renderer.gpuUpdate(casters);

    // compound bounding box for all casters, used to compute shared directional light shadow
    const casterBounds = this.computeBounds(casters);
    let i, j, rcv, m;

    // Prepare models
    for (i = 0; i < bakeNodes.length; i++) {
      const bakeNode = bakeNodes[i];
      rcv = bakeNode.meshInstances;
      for (j = 0; j < rcv.length; j++) {
        // patch meshInstance
        m = rcv[j];
        m.setLightmapped(false);
        m.mask = MASK_BAKE; // only affected by LM lights

        // patch material
        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], m.material.lightMap ? m.material.lightMap : this.blackTex);
        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
      }
    }

    // Disable all bakeable lights
    for (j = 0; j < bakeLights.length; j++) {
      bakeLights[j].light.enabled = false;
    }
    const lightArray = [[], [], []];
    let pass, node;
    let shadersUpdatedOn1stPass = false;

    // Accumulate lights into RGBM textures
    for (i = 0; i < bakeLights.length; i++) {
      const bakeLight = bakeLights[i];
      const isAmbientLight = bakeLight instanceof BakeLightAmbient;
      const isDirectional = bakeLight.light.type === LIGHTTYPE_DIRECTIONAL;

      // light can be baked using many virtual lights to create soft effect
      let numVirtualLights = bakeLight.numVirtualLights;

      // direction baking is not currently compatible with virtual lights, as we end up with no valid direction in lights penumbra
      if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
        numVirtualLights = 1;
        Debug.warn('Lightmapper\'s BAKE_COLORDIR mode is not compatible with Light\'s bakeNumSamples larger than one. Forcing it to one.');
      }
      for (let virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++) {
        DebugGraphics.pushGpuMarker(device, `Light:${bakeLight.light._node.name}:${virtualLightIndex}`);

        // prepare virtual light
        if (numVirtualLights > 1) {
          bakeLight.prepareVirtualLight(virtualLightIndex, numVirtualLights);
        }
        bakeLight.startBake();
        let shadowMapRendered = false;
        const shadowCam = this.lightCameraPrepare(device, bakeLight);
        for (node = 0; node < bakeNodes.length; node++) {
          const bakeNode = bakeNodes[node];
          rcv = bakeNode.meshInstances;
          const lightAffectsNode = this.lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds);
          if (!lightAffectsNode) {
            continue;
          }
          this.setupLightArray(lightArray, bakeLight.light);
          const clusterLights = isDirectional ? [] : [bakeLight.light];
          if (clusteredLightingEnabled) {
            this.renderer.lightTextureAtlas.update(clusterLights, this.lightingParams);
          }

          // render light shadow map needs to be rendered
          shadowMapRendered = this.renderShadowMap(comp, shadowMapRendered, casters, bakeLight);
          if (clusteredLightingEnabled) {
            this.worldClusters.update(clusterLights, this.scene.gammaCorrection, this.lightingParams);
          }

          // Store original materials
          this.backupMaterials(rcv);
          for (pass = 0; pass < passCount; pass++) {
            // only bake first virtual light for pass 1, as it does not handle overlapping lights
            if (pass > 0 && virtualLightIndex > 0) {
              break;
            }

            // don't bake ambient light in pass 1, as there's no main direction
            if (isAmbientLight && pass > 0) {
              break;
            }
            DebugGraphics.pushGpuMarker(device, `LMPass:${pass}`);

            // lightmap size
            const nodeRT = bakeNode.renderTargets[pass];
            const lightmapSize = bakeNode.renderTargets[pass].colorBuffer.width;

            // get matching temp render target to render to
            const tempRT = this.renderTargets.get(lightmapSize);
            const tempTex = tempRT.colorBuffer;
            if (pass === 0) {
              shadersUpdatedOn1stPass = scene.updateShaders;
            } else if (shadersUpdatedOn1stPass) {
              scene.updateShaders = true;
            }
            let passMaterial = this.passMaterials[pass];
            if (isAmbientLight) {
              // for last virtual light of ambient light, multiply accumulated AO lightmap with ambient light
              const lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
              if (lastVirtualLightForPass && pass === 0) {
                passMaterial = this.ambientAOMaterial;
              }
            }

            // set up material for baking a pass
            for (j = 0; j < rcv.length; j++) {
              rcv[j].material = passMaterial;
            }

            // update shader
            this.renderer.updateShaders(rcv);

            // render receivers to the tempRT
            if (pass === PASS_DIR) {
              this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
            }
            if (device.isWebGPU) {
              // TODO: On WebGPU we use a render pass, but this has some issue it seems,
              // and needs to be investigated and fixed. In the LightsBaked example, edges of
              // some geometry are not lit correctly, especially visible on boxes. Most likely
              // some global per frame / per camera constants are not set up or similar, that
              // renderForward sets up.
              const renderPass = new RenderPassLightmapper(device, this.renderer, this.camera, clusteredLightingEnabled ? this.worldClusters : null, rcv, lightArray);
              renderPass.init(tempRT);
              renderPass.render();
              renderPass.destroy();
            } else {
              // use the old path for WebGL till the render pass way above is fixed

              // ping-ponging output
              this.renderer.setCamera(this.camera, tempRT, true);

              // prepare clustered lighting
              if (clusteredLightingEnabled) {
                this.worldClusters.activate();
              }
              this.renderer._forwardTime = 0;
              this.renderer._shadowMapTime = 0;
              this.renderer.renderForward(this.camera, rcv, lightArray, SHADER_FORWARDHDR);
              device.updateEnd();
            }
            this.stats.shadowMapTime += this.renderer._shadowMapTime;
            this.stats.forwardTime += this.renderer._forwardTime;
            this.stats.renderPasses++;

            // temp render target now has lightmap, store it for the node
            bakeNode.renderTargets[pass] = tempRT;

            // and release previous lightmap into temp render target pool
            this.renderTargets.set(lightmapSize, nodeRT);
            for (j = 0; j < rcv.length; j++) {
              m = rcv[j];
              m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex); // ping-ponging input
              m._shaderDefs |= SHADERDEF_LM; // force using LM even if material doesn't have it
            }

            DebugGraphics.popGpuMarker(device);
          }

          // Revert to original materials
          this.restoreMaterials(rcv);
        }
        bakeLight.endBake(this.shadowMapCache);
        DebugGraphics.popGpuMarker(device);
      }
    }
    this.postprocessTextures(device, bakeNodes, passCount);

    // restore changes
    for (node = 0; node < allNodes.length; node++) {
      allNodes[node].restore();
    }
    this.restoreLights(allLights);
    this.restoreScene();

    // empty cache to minimize persistent memory use .. if some cached textures are needed,
    // they will be allocated again as needed
    if (!clusteredLightingEnabled) {
      this.shadowMapCache.clear();
    }
  }
}

export { Lightmapper };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBDSFVOS0FQSV8xXzY1LFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaGljcy9xdWFkLXJlbmRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTGlnaHRpbmdQYXJhbXMgfSBmcm9tICcuLi8uLi9zY2VuZS9saWdodGluZy9saWdodGluZy1wYXJhbXMuanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3NMaWdodG1hcHBlciB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy1saWdodG1hcHBlci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkFLRV9DT0xPUkRJUixcbiAgICBGT0dfTk9ORSxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCxcbiAgICBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQywgUFJPSkVDVElPTl9QRVJTUEVDVElWRSxcbiAgICBTSEFERVJERUZfRElSTE0sIFNIQURFUkRFRl9MTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBNQVNLX0JBS0UsIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLFxuICAgIFNIQURPV1VQREFURV9SRUFMVElNRSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSwgU0hBREVSX0ZPUldBUkRIRFJcbn0gZnJvbSAnLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENhbWVyYSB9IGZyb20gJy4uLy4uL3NjZW5lL2NhbWVyYS5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi8uLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBCYWtlTGlnaHRTaW1wbGUgfSBmcm9tICcuL2Jha2UtbGlnaHQtc2ltcGxlLmpzJztcbmltcG9ydCB7IEJha2VMaWdodEFtYmllbnQgfSBmcm9tICcuL2Jha2UtbGlnaHQtYW1iaWVudC5qcyc7XG5pbXBvcnQgeyBCYWtlTWVzaE5vZGUgfSBmcm9tICcuL2Jha2UtbWVzaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwQ2FjaGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcEZpbHRlcnMgfSBmcm9tICcuL2xpZ2h0bWFwLWZpbHRlcnMuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJQYXNzTGlnaHRtYXBwZXIgfSBmcm9tICcuL3JlbmRlci1wYXNzLWxpZ2h0bWFwcGVyLmpzJztcblxuY29uc3QgTUFYX0xJR0hUTUFQX1NJWkUgPSAyMDQ4O1xuXG5jb25zdCBQQVNTX0NPTE9SID0gMDtcbmNvbnN0IFBBU1NfRElSID0gMTtcblxuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbi8qKlxuICogVGhlIGxpZ2h0bWFwcGVyIGlzIHVzZWQgdG8gYmFrZSBzY2VuZSBsaWdodHMgaW50byB0ZXh0dXJlcy5cbiAqXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgTGlnaHRtYXBwZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBMaWdodG1hcHBlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3QgLSBUaGUgcm9vdCBlbnRpdHkgb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY2VuZS9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSB0byBsaWdodG1hcC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcycpLkZvcndhcmRSZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGVcbiAgICAgKiByZW5kZXJlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBSZWdpc3RyeSBvZiBhc3NldHMgdG9cbiAgICAgKiBsaWdodG1hcC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCByb290LCBzY2VuZSwgcmVuZGVyZXIsIGFzc2V0cykge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5yb290ID0gcm9vdDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG4gICAgICAgIHRoaXMuYXNzZXRzID0gYXNzZXRzO1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gcmVuZGVyZXIuc2hhZG93TWFwQ2FjaGU7XG5cbiAgICAgICAgdGhpcy5fdGVtcFNldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5faW5pdENhbGxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGludGVybmFsIG1hdGVyaWFscyB1c2VkIGJ5IGJha2luZ1xuICAgICAgICB0aGlzLnBhc3NNYXRlcmlhbHMgPSBbXTtcbiAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5mb2cgPSAnJztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQgPSBuZXcgQ29sb3IoKTtcblxuICAgICAgICAvLyBkaWN0aW9uYXJ5IG9mIHNwYXJlIHJlbmRlciB0YXJnZXRzIHdpdGggY29sb3IgYnVmZmVyIGZvciBlYWNoIHVzZWQgc2l6ZVxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgICAgICAgIHJlbmRlclBhc3NlczogMCxcbiAgICAgICAgICAgIGxpZ2h0bWFwQ291bnQ6IDAsXG4gICAgICAgICAgICB0b3RhbFJlbmRlclRpbWU6IDAsXG4gICAgICAgICAgICBmb3J3YXJkVGltZTogMCxcbiAgICAgICAgICAgIGZib1RpbWU6IDAsXG4gICAgICAgICAgICBzaGFkb3dNYXBUaW1lOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDAsXG4gICAgICAgICAgICBzaGFkZXJzTGlua2VkOiAwXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICAvLyByZWxlYXNlIHJlZmVyZW5jZSB0byB0aGUgdGV4dHVyZVxuICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZih0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgdGhpcy5ibGFja1RleCA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgbGlnaHRtYXBzXG4gICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jYW1lcmE/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5jYW1lcmEgPSBudWxsO1xuICAgIH1cblxuICAgIGluaXRCYWtlKGRldmljZSkge1xuXG4gICAgICAgIC8vIG9ubHkgaW5pdGlhbGl6ZSBvbmUgdGltZVxuICAgICAgICBpZiAoIXRoaXMuX2luaXRDYWxsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luaXRDYWxsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBsaWdodG1hcCBmaWx0ZXJpbmcgc2hhZGVyc1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMgPSBuZXcgTGlnaHRtYXBGaWx0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIHNoYWRlciByZWxhdGVkXG4gICAgICAgICAgICB0aGlzLmNvbnN0YW50QmFrZURpciA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdiYWtlRGlyJyk7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgICAgICAvLyBzbWFsbCBibGFjayB0ZXh0dXJlXG4gICAgICAgICAgICB0aGlzLmJsYWNrVGV4ID0gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogNCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDQsXG4gICAgICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgICAgICB0eXBlOiBURVhUVVJFVFlQRV9SR0JNLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdsaWdodG1hcEJsYWNrJ1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGluY3JlZiBibGFjayB0ZXh0dXJlIGluIHRoZSBjYWNoZSB0byBhdm9pZCBpdCBiZWluZyBkZXN0cm95ZWRcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRoaXMuYmxhY2tUZXgpO1xuXG4gICAgICAgICAgICAvLyBjYW1lcmEgdXNlZCBmb3IgYmFraW5nXG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBuZXcgQ2FtZXJhKCk7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJDb2xvci5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJDb2xvckJ1ZmZlciA9IHRydWU7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJEZXB0aEJ1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW1DdWxsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEucHJvamVjdGlvbiA9IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDO1xuICAgICAgICAgICAgY2FtZXJhLmFzcGVjdFJhdGlvID0gMTtcbiAgICAgICAgICAgIGNhbWVyYS5ub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbGlnaHQgY2x1c3RlciBzdHJ1Y3R1cmVcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBsaWdodCBwYXJhbXMsIGFuZCBiYXNlIG1vc3QgcGFyYW1ldGVycyBvbiB0aGUgbGlnaHRpbmcgcGFyYW1zIG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgY29uc3QgbGlnaHRpbmdQYXJhbXMgPSBuZXcgTGlnaHRpbmdQYXJhbXMoZGV2aWNlLnN1cHBvcnRzQXJlYUxpZ2h0cywgZGV2aWNlLm1heFRleHR1cmVTaXplLCAoKSA9PiB7fSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0aW5nUGFyYW1zID0gbGlnaHRpbmdQYXJhbXM7XG5cbiAgICAgICAgICAgIGNvbnN0IHNyY1BhcmFtcyA9IHRoaXMuc2NlbmUubGlnaHRpbmc7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5zaGFkb3dzRW5hYmxlZCA9IHNyY1BhcmFtcy5zaGFkb3dzRW5hYmxlZDtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLnNoYWRvd0F0bGFzUmVzb2x1dGlvbiA9IHNyY1BhcmFtcy5zaGFkb3dBdGxhc1Jlc29sdXRpb247XG5cbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNvb2tpZXNFbmFibGVkID0gc3JjUGFyYW1zLmNvb2tpZXNFbmFibGVkO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY29va2llQXRsYXNSZXNvbHV0aW9uID0gc3JjUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQgPSBzcmNQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQ7XG5cbiAgICAgICAgICAgIC8vIHNvbWUgY3VzdG9tIGxpZ2h0bWFwcGluZyBwYXJhbXMgLSB3ZSBiYWtlIHNpbmdsZSBsaWdodCBhIHRpbWVcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNlbGxzID0gbmV3IFZlYzMoMywgMywgMyk7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5tYXhMaWdodHNQZXJDZWxsID0gNDtcblxuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzID0gbmV3IFdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXJMaWdodG1hcHBlcic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmaW5pc2hCYWtlKGJha2VOb2Rlcykge1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gW107XG5cbiAgICAgICAgZnVuY3Rpb24gZGVzdHJveVJUKHJ0KSB7XG4gICAgICAgICAgICAvLyB0aGlzIGNhbiBjYXVzZSByZWYgY291bnQgdG8gYmUgMCBhbmQgdGV4dHVyZSBkZXN0cm95ZWRcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKHJ0LmNvbG9yQnVmZmVyKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSByZW5kZXIgdGFyZ2V0IGl0c2VsZlxuICAgICAgICAgICAgcnQuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3BhcmUgcmVuZGVyIHRhcmdldHMgaW5jbHVkaW5nIGNvbG9yIGJ1ZmZlclxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuZm9yRWFjaCgocnQpID0+IHtcbiAgICAgICAgICAgIGRlc3Ryb3lSVChydCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuY2xlYXIoKTtcblxuICAgICAgICAvLyBkZXN0cm95IHJlbmRlciB0YXJnZXRzIGZyb20gbm9kZXMgKGJ1dCBub3QgY29sb3IgYnVmZmVyKVxuICAgICAgICBiYWtlTm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXJUYXJnZXRzLmZvckVhY2goKHJ0KSA9PiB7XG4gICAgICAgICAgICAgICAgZGVzdHJveVJUKHJ0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgbm9kZS5yZW5kZXJUYXJnZXRzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRoaXMgc2hhZGVyIGlzIG9ubHkgdmFsaWQgZm9yIHNwZWNpZmljIGJyaWdodG5lc3MgYW5kIGNvbnRyYXN0IHZhbHVlcywgZGlzcG9zZSBpdFxuICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gbnVsbDtcblxuICAgICAgICAvLyBkZWxldGUgbGlnaHQgY2x1c3RlclxuICAgICAgICBpZiAodGhpcy53b3JsZENsdXN0ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCBwYXNzLCBhZGRBbWJpZW50KSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IGBsbU1hdGVyaWFsLXBhc3M6JHtwYXNzfS1hbWJpZW50OiR7YWRkQW1iaWVudH1gO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3MuQVBJVmVyc2lvbiA9IENIVU5LQVBJXzFfNjU7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybURlZmluZXMgPSAnI2RlZmluZSBVVjFMQVlPVVRcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3MudHJhbnNmb3JtVlMgPSB0cmFuc2Zvcm1EZWZpbmVzICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTOyAvLyBkcmF3IGludG8gVVYxIHRleHR1cmUgc3BhY2VcblxuICAgICAgICBpZiAocGFzcyA9PT0gUEFTU19DT0xPUikge1xuICAgICAgICAgICAgbGV0IGJha2VMbUVuZENodW5rID0gc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIuYmFrZUxtRW5kUFM7IC8vIGVuY29kZSB0byBSR0JNXG4gICAgICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgICAgIC8vIGRpZmZ1c2UgbGlnaHQgc3RvcmVzIGFjY3VtdWxhdGVkIEFPLCBhcHBseSBjb250cmFzdCBhbmQgYnJpZ2h0bmVzcyB0byBpdFxuICAgICAgICAgICAgICAgIC8vIGFuZCBtdWx0aXBseSBhbWJpZW50IGxpZ2h0IGNvbG9yIGJ5IHRoZSBBT1xuICAgICAgICAgICAgICAgIGJha2VMbUVuZENodW5rID0gYFxuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gKChkRGlmZnVzZUxpZ2h0IC0gMC41KSAqIG1heCgke3NjZW5lLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QudG9GaXhlZCgxKX0gKyAxLjAsIDAuMCkpICsgMC41O1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IHZlYzMoJHtzY2VuZS5hbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MudG9GaXhlZCgxKX0pO1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gc2F0dXJhdGUoZERpZmZ1c2VMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKj0gZEFtYmllbnRMaWdodDtcbiAgICAgICAgICAgICAgICBgICsgYmFrZUxtRW5kQ2h1bms7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnQgPSBuZXcgQ29sb3IoMCwgMCwgMCk7ICAgIC8vIGRvbid0IGJha2UgYW1iaWVudFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnRUaW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5iYXNlUFMgPSBzaGFkZXJDaHVua3MuYmFzZVBTICsgKHNjZW5lLmxpZ2h0bWFwUGl4ZWxGb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE4ID8gJ1xcbiNkZWZpbmUgTElHSFRNQVBfUkdCTVxcbicgOiAnJyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuZW5kUFMgPSBiYWtlTG1FbmRDaHVuaztcbiAgICAgICAgICAgIG1hdGVyaWFsLmxpZ2h0TWFwID0gdGhpcy5ibGFja1RleDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5iYXNlUFMgPSBzaGFkZXJDaHVua3MuYmFzZVBTICsgJ1xcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZGlyTGlnaHRNYXA7XFxudW5pZm9ybSBmbG9hdCBiYWtlRGlyO1xcbic7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuZW5kUFMgPSBzaGFkZXJDaHVua3NMaWdodG1hcHBlci5iYWtlRGlyTG1FbmRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF2b2lkIHdyaXRpbmcgdW5yZWxhdGVkIHRoaW5ncyB0byBhbHBoYVxuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFPcGFxdWVQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFQcmVtdWxQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgbWF0ZXJpYWwuZm9yY2VVdjEgPSB0cnVlOyAvLyBwcm92aWRlIGRhdGEgdG8geGZvcm1VdjFcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIGNyZWF0ZU1hdGVyaWFscyhkZXZpY2UsIHNjZW5lLCBwYXNzQ291bnQpIHtcbiAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc10pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc10gPSB0aGlzLmNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCBwYXNzLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYXRlcmlhbCB1c2VkIG9uIGxhc3QgcmVuZGVyIG9mIGFtYmllbnQgbGlnaHQgdG8gbXVsdGlwbHkgYWNjdW11bGF0ZWQgQU8gaW4gbGlnaHRtYXAgYnkgYW1iaWVudCBsaWdodFxuICAgICAgICBpZiAoIXRoaXMuYW1iaWVudEFPTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwgPSB0aGlzLmNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCAwLCB0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwub25VcGRhdGVTaGFkZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgTE0gYXMgd2l0aG91dCBhbWJpZW50LCB0byBhZGQgaXRcbiAgICAgICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgYWRkIGFtYmllbnQgdG8gZGlmZnVzZSBkaXJlY3RseSBidXQga2VlcCBpdCBzZXBhcmF0ZSwgdG8gYWxsb3cgQU8gdG8gYmUgbXVsdGlwbGllZCBpblxuICAgICAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5zZXBhcmF0ZUFtYmllbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmUoc2l6ZSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHByb2ZpbGVySGludDogVEVYSElOVF9MSUdIVE1BUCxcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgd2lkdGg6IHNpemUsXG4gICAgICAgICAgICBoZWlnaHQ6IHNpemUsXG4gICAgICAgICAgICBmb3JtYXQ6IHRoaXMuc2NlbmUubGlnaHRtYXBQaXhlbEZvcm1hdCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgdHlwZTogdGhpcy5zY2VuZS5saWdodG1hcFBpeGVsRm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxULFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcmVjdXJzaXZlbHkgd2FsayB0aGUgaGllcmFyY2h5IG9mIG5vZGVzIHN0YXJ0aW5nIGF0IHRoZSBzcGVjaWZpZWQgbm9kZVxuICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIHRoYXQgbmVlZCB0byBiZSBsaWdodG1hcHBlZCB0byBiYWtlTm9kZXMgYXJyYXlcbiAgICAvLyBjb2xsZWN0IGFsbCBub2RlcyB3aXRoIGdlb21ldHJ5IHRvIGFsbE5vZGVzIGFycmF5XG4gICAgY29sbGVjdE1vZGVscyhub2RlLCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG4gICAgICAgIGlmICghbm9kZS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgLy8gbWVzaCBpbnN0YW5jZXMgZnJvbSBtb2RlbCBjb21wb25lbnRcbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChub2RlLm1vZGVsPy5tb2RlbCAmJiBub2RlLm1vZGVsPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5tb2RlbC5saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgICAgIGlmIChiYWtlTm9kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcyA9IG5vZGUubW9kZWwubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlcyBmcm9tIHJlbmRlciBjb21wb25lbnRcbiAgICAgICAgaWYgKG5vZGUucmVuZGVyPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIubGlnaHRtYXBwZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoYmFrZU5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMgPSBub2RlLnJlbmRlci5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBsZXQgaGFzVXYxID0gdHJ1ZTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2VzW2ldLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcubG9nKGBMaWdodG1hcHBlciAtIG5vZGUgWyR7bm9kZS5uYW1lfV0gY29udGFpbnMgbWVzaGVzIHdpdGhvdXQgcmVxdWlyZWQgdXYxLCBleGNsdWRpbmcgaXQgZnJvbSBiYWtpbmcuYCk7XG4gICAgICAgICAgICAgICAgICAgIGhhc1V2MSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNVdjEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhpcyBtZXNoIGFuIGluc3RhbmNlIG9mIGFscmVhZHkgdXNlZCBtZXNoIGluIHRoaXMgbm9kZVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fdGVtcFNldC5oYXMobWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgZWFjaCBpbnN0YW5jZSAob2JqZWN0IHdpdGggc2hhcmVkIFZCKSBhcyBzZXBhcmF0ZSBcIm5vZGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlLCBbbWVzaEluc3RhbmNlc1tpXV0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmFkZChtZXNoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IGFsbCBub24tc2hhcmVkIG9iamVjdHMgYXMgb25lIFwibm9kZVwiXG4gICAgICAgICAgICAgICAgaWYgKG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUsIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZS5fY2hpbGRyZW5baV0sIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZSBhbGwgbWVzaEluc3RhbmNlcyB0aGF0IGNhc3Qgc2hhZG93cyBpbnRvIGxpZ2h0bWFwc1xuICAgIHByZXBhcmVTaGFkb3dDYXN0ZXJzKG5vZGVzKSB7XG5cbiAgICAgICAgY29uc3QgY2FzdGVycyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IG5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2Rlc1tuXS5jb21wb25lbnQ7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5jYXN0U2hhZG93cyA9IGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBub2Rlc1tuXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlc1tpXS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FzdGVycy5wdXNoKG1lc2hlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNhc3RlcnM7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyB3b3JsZCB0cmFuc2Zvcm0gZm9yIG5vZGVzXG4gICAgdXBkYXRlVHJhbnNmb3Jtcyhub2Rlcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2Rlc1tpXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tqXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3RlOiB0aGlzIGZ1bmN0aW9uIGlzIGFsc28gY2FsbGVkIGJ5IHRoZSBFZGl0b3IgdG8gZGlzcGxheSBlc3RpbWF0ZWQgTE0gc2l6ZSBpbiB0aGUgaW5zcGVjdG9yLFxuICAgIC8vIGRvIG5vdCBjaGFuZ2UgaXRzIHNpZ25hdHVyZS5cbiAgICBjYWxjdWxhdGVMaWdodG1hcFNpemUobm9kZSkge1xuICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgY29uc3Qgc2l6ZU11bHQgPSB0aGlzLnNjZW5lLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgfHwgMTY7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGVtcFZlYztcblxuICAgICAgICBsZXQgc3JjQXJlYSwgbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcblxuICAgICAgICBpZiAobm9kZS5tb2RlbCkge1xuICAgICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IG5vZGUubW9kZWwubGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmFzc2V0KSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHRoaXMuYXNzZXRzLmdldChub2RlLm1vZGVsLmFzc2V0KS5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmFyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG5vZGUubW9kZWwuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gbm9kZS5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5fYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5yZW5kZXIpIHtcbiAgICAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSBub2RlLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLnR5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG5vZGUucmVuZGVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuX2FyZWE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb3B5IGFyZWFcbiAgICAgICAgY29uc3QgYXJlYSA9IHsgeDogMSwgeTogMSwgejogMSwgdXY6IDEgfTtcbiAgICAgICAgaWYgKHNyY0FyZWEpIHtcbiAgICAgICAgICAgIGFyZWEueCA9IHNyY0FyZWEueDtcbiAgICAgICAgICAgIGFyZWEueSA9IHNyY0FyZWEueTtcbiAgICAgICAgICAgIGFyZWEueiA9IHNyY0FyZWEuejtcbiAgICAgICAgICAgIGFyZWEudXYgPSBzcmNBcmVhLnV2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJlYU11bHQgPSBsaWdodG1hcFNpemVNdWx0aXBsaWVyIHx8IDE7XG4gICAgICAgIGFyZWEueCAqPSBhcmVhTXVsdDtcbiAgICAgICAgYXJlYS55ICo9IGFyZWFNdWx0O1xuICAgICAgICBhcmVhLnogKj0gYXJlYU11bHQ7XG5cbiAgICAgICAgLy8gYm91bmRzIG9mIHRoZSBjb21wb25lbnRcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5yZW5kZXIgfHwgbm9kZS5tb2RlbDtcbiAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5jb21wdXRlTm9kZUJvdW5kcyhjb21wb25lbnQubWVzaEluc3RhbmNlcyk7XG5cbiAgICAgICAgLy8gdG90YWwgYXJlYSBpbiB0aGUgbGlnaHRtYXAgaXMgYmFzZWQgb24gdGhlIHdvcmxkIHNwYWNlIGJvdW5kcyBvZiB0aGUgbWVzaFxuICAgICAgICBzY2FsZS5jb3B5KGJvdW5kcy5oYWxmRXh0ZW50cyk7XG4gICAgICAgIGxldCB0b3RhbEFyZWEgPSBhcmVhLnggKiBzY2FsZS55ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnkgKiBzY2FsZS54ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnogKiBzY2FsZS54ICogc2NhbGUueTtcbiAgICAgICAgdG90YWxBcmVhIC89IGFyZWEudXY7XG4gICAgICAgIHRvdGFsQXJlYSA9IE1hdGguc3FydCh0b3RhbEFyZWEpO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0bWFwU2l6ZSA9IE1hdGgubWluKG1hdGgubmV4dFBvd2VyT2ZUd28odG90YWxBcmVhICogc2l6ZU11bHQpLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiB8fCBNQVhfTElHSFRNQVBfU0laRSk7XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0bWFwU2l6ZTtcbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBpbmcobm9kZXMsIHZhbHVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZS5tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbal07XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZGVyRGVmcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9zaGFkZXJEZWZzIHw9IHNoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGxpZ2h0cyB0aGF0IGFmZmVjdCBsaWdodG1hcHBlZCBvYmplY3RzIGFyZSB1c2VkIG9uIHRoaXMgbWVzaCBub3cgdGhhdCBpdCBpcyBiYWtlZFxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWFzayA9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IG5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXS5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleC5taW5GaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Lm1hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzW3Bhc3NdLCB0ZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGFuZCBhcHBsaWVzIHRoZSBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5W118bnVsbH0gbm9kZXMgLSBBbiBhcnJheSBvZiBlbnRpdGllcyAod2l0aCBtb2RlbCBvclxuICAgICAqIHJlbmRlciBjb21wb25lbnRzKSB0byByZW5kZXIgbGlnaHRtYXBzIGZvci4gSWYgbm90IHN1cHBsaWVkLCB0aGUgZW50aXJlIHNjZW5lIHdpbGwgYmUgYmFrZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttb2RlXSAtIEJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3JcbiAgICAgKiBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJBS0VfQ09MT1JESVJ9LlxuICAgICAqL1xuICAgIGJha2Uobm9kZXMsIG1vZGUgPSBCQUtFX0NPTE9SRElSKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBza3lib3hcbiAgICAgICAgdGhpcy5zY2VuZS5fdXBkYXRlU2t5TWVzaCgpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgZGV2aWNlLmZpcmUoJ2xpZ2h0bWFwcGVyOnN0YXJ0Jywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBzdGFydFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0U2hhZGVycyA9IGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkO1xuICAgICAgICBjb25zdCBzdGFydEZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZTtcbiAgICAgICAgY29uc3Qgc3RhcnRDb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWU7XG5cbiAgICAgICAgLy8gQmFrZU1lc2hOb2RlIG9iamVjdHMgZm9yIGJha2luZ1xuICAgICAgICBjb25zdCBiYWtlTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBhbGwgQmFrZU1lc2hOb2RlIG9iamVjdHNcbiAgICAgICAgY29uc3QgYWxsTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIC8gbWVzaEluc3RhbmNlcyBmb3IgYmFraW5nXG4gICAgICAgIGlmIChub2Rlcykge1xuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIGZvciBiYWtpbmcgYmFzZWQgb24gc3BlY2lmaWVkIGxpc3Qgb2Ygbm9kZXNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZXNbaV0sIGJha2VOb2RlcywgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIGZyb20gdGhlIHNjZW5lXG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHModGhpcy5yb290LCBudWxsLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gY29sbGVjdCBub2RlcyBmcm9tIHRoZSByb290IG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKHRoaXMucm9vdCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgJ0xNQmFrZScpO1xuXG4gICAgICAgIC8vIGJha2Ugbm9kZXNcbiAgICAgICAgaWYgKGJha2VOb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93UmVuZGVyZXIuZnJhbWVVcGRhdGUoKTtcblxuICAgICAgICAgICAgLy8gZGlzYWJsZSBsaWdodG1hcHBpbmdcbiAgICAgICAgICAgIGNvbnN0IHBhc3NDb3VudCA9IG1vZGUgPT09IEJBS0VfQ09MT1JESVIgPyAyIDogMTtcbiAgICAgICAgICAgIHRoaXMuc2V0TGlnaHRtYXBwaW5nKGJha2VOb2RlcywgZmFsc2UsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgICAgIHRoaXMuaW5pdEJha2UoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuYmFrZUludGVybmFsKHBhc3NDb3VudCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgICAgIC8vIEVuYWJsZSBuZXcgbGlnaHRtYXBzXG4gICAgICAgICAgICBsZXQgc2hhZGVyRGVmcyA9IFNIQURFUkRFRl9MTTtcblxuICAgICAgICAgICAgaWYgKG1vZGUgPT09IEJBS0VfQ09MT1JESVIpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9ESVJMTTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbWFyayBsaWdodG1hcCBhcyBjb250YWluaW5nIGFtYmllbnQgbGlnaHRpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfTE1BTUJJRU5UO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZXRMaWdodG1hcHBpbmcoYmFrZU5vZGVzLCB0cnVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpO1xuXG4gICAgICAgICAgICAvLyBjbGVhbiB1cCBtZW1vcnlcbiAgICAgICAgICAgIHRoaXMuZmluaXNoQmFrZShiYWtlTm9kZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IG5vd1RpbWUgPSBub3coKTtcbiAgICAgICAgdGhpcy5zdGF0cy50b3RhbFJlbmRlclRpbWUgPSBub3dUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLnNoYWRlcnNMaW5rZWQgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZCAtIHN0YXJ0U2hhZGVycztcbiAgICAgICAgdGhpcy5zdGF0cy5jb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWUgLSBzdGFydENvbXBpbGVUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLmZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSAtIHN0YXJ0RmJvVGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5saWdodG1hcENvdW50ID0gYmFrZU5vZGVzLmxlbmd0aDtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGRldmljZS5maXJlKCdsaWdodG1hcHBlcjplbmQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vd1RpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHRoaXMgYWxsb2NhdGVzIGxpZ2h0bWFwIHRleHR1cmVzIGFuZCByZW5kZXIgdGFyZ2V0cy5cbiAgICBhbGxvY2F0ZVRleHR1cmVzKGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWtlTm9kZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLy8gcmVxdWlyZWQgbGlnaHRtYXAgc2l6ZVxuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gdGhpcy5jYWxjdWxhdGVMaWdodG1hcFNpemUoYmFrZU5vZGUubm9kZSk7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmUgYW5kIHJlbmRlciB0YXJnZXQgZm9yIGVhY2ggcGFzcywgc3RvcmVkIHBlciBub2RlXG4gICAgICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5jcmVhdGVUZXh0dXJlKHNpemUsICgnbGlnaHRtYXBwZXJfbGlnaHRtYXBfJyArIGkpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10gPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRleCxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSB0ZW1wb3JhcnkgcmVuZGVyIHRhcmdldCBvZiBlYWNoIHNpemVcbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXRzLmhhcyhzaXplKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuY3JlYXRlVGV4dHVyZShzaXplLCAoJ2xpZ2h0bWFwcGVyX3RlbXBfbGlnaHRtYXBfJyArIHNpemUpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5zZXQoc2l6ZSwgbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXBhcmVMaWdodHNUb0Jha2UobGF5ZXJDb21wb3NpdGlvbiwgYWxsTGlnaHRzLCBiYWtlTGlnaHRzKSB7XG5cbiAgICAgICAgLy8gYW1iaWVudCBsaWdodFxuICAgICAgICBpZiAodGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgY29uc3QgYW1iaWVudExpZ2h0ID0gbmV3IEJha2VMaWdodEFtYmllbnQodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICBiYWtlTGlnaHRzLnB1c2goYW1iaWVudExpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjZW5lIGxpZ2h0c1xuICAgICAgICBjb25zdCBzY2VuZUxpZ2h0cyA9IHRoaXMucmVuZGVyZXIubGlnaHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjZW5lTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IHNjZW5lTGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSBhbGwgbGlnaHRzIGFuZCB0aGVpciBvcmlnaW5hbCBzZXR0aW5ncyB3ZSBuZWVkIHRvIHRlbXBvcmFyaWx5IG1vZGlmeVxuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gbmV3IEJha2VMaWdodFNpbXBsZSh0aGlzLnNjZW5lLCBsaWdodCk7XG4gICAgICAgICAgICBhbGxMaWdodHMucHVzaChiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAvLyBiYWtlIGxpZ2h0XG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCAmJiAobGlnaHQubWFzayAmIE1BU0tfQkFLRSkgIT09IDApIHtcbiAgICAgICAgICAgICAgICBsaWdodC5tYXNrID0gTUFTS19CQUtFIHwgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfCBNQVNLX0FGRkVDVF9EWU5BTUlDO1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBTSEFET1dVUERBVEVfUkVBTFRJTUUgOiBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgIGJha2VMaWdodHMucHVzaChiYWtlTGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBiYWtlIGxpZ2h0cyBieSB0eXBlIHRvIG1pbmltaXplIHNoYWRlciBzd2l0Y2hlc1xuICAgICAgICBiYWtlTGlnaHRzLnNvcnQoKTtcbiAgICB9XG5cbiAgICByZXN0b3JlTGlnaHRzKGFsbExpZ2h0cykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhbGxMaWdodHNbaV0ucmVzdG9yZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBTY2VuZSgpIHtcblxuICAgICAgICAvLyBiYWNrdXBcbiAgICAgICAgdGhpcy5mb2cgPSB0aGlzLnNjZW5lLmZvZztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQuY29weSh0aGlzLnNjZW5lLmFtYmllbnRMaWdodCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIHNjZW5lXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gRk9HX05PTkU7XG5cbiAgICAgICAgLy8gaWYgbm90IGJha2luZyBhbWJpZW50LCBzZXQgaXQgdG8gYmxhY2tcbiAgICAgICAgaWYgKCF0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmFtYmllbnRMaWdodC5zZXQoMCwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcHBseSBzY2VuZSBzZXR0aW5nc1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFNjZW5lQ29uc3RhbnRzKCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZVNjZW5lKCkge1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gdGhpcy5mb2c7XG4gICAgICAgIHRoaXMuc2NlbmUuYW1iaWVudExpZ2h0LmNvcHkodGhpcy5hbWJpZW50TGlnaHQpO1xuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94IGZvciBhIHNpbmdsZSBub2RlXG4gICAgY29tcHV0ZU5vZGVCb3VuZHMobWVzaEluc3RhbmNlcykge1xuXG4gICAgICAgIGNvbnN0IGJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGJvdW5kcy5jb3B5KG1lc2hJbnN0YW5jZXNbMF0uYWFiYik7XG4gICAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICBib3VuZHMuYWRkKG1lc2hJbnN0YW5jZXNbbV0uYWFiYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm91bmRzO1xuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94IGZvciBlYWNoIG5vZGVcbiAgICBjb21wdXRlTm9kZXNCb3VuZHMobm9kZXMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZXNbaV0ubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIG5vZGVzW2ldLmJvdW5kcyA9IHRoaXMuY29tcHV0ZU5vZGVCb3VuZHMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGNvbXBvdW5kIGJvdW5kaW5nIGJveCBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBjb21wdXRlQm91bmRzKG1lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICBjb25zdCBib3VuZHMgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGJvdW5kcy5jb3B5KG1lc2hJbnN0YW5jZXNbMF0uYWFiYik7XG4gICAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICBib3VuZHMuYWRkKG1lc2hJbnN0YW5jZXNbbV0uYWFiYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm91bmRzO1xuICAgIH1cblxuICAgIGJhY2t1cE1hdGVyaWFscyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbHNbaV0gPSBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzdG9yZU1hdGVyaWFscyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWxzW2ldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGlnaHRDYW1lcmFQcmVwYXJlKGRldmljZSwgYmFrZUxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGxldCBzaGFkb3dDYW07XG5cbiAgICAgICAgLy8gb25seSBwcmVwYXJlIGNhbWVyYSBmb3Igc3BvdCBsaWdodCwgb3RoZXIgY2FtZXJhcyBuZWVkIHRvIGJlIGFkanVzdGVkIHBlciBjdWJlbWFwIGZhY2UgLyBwZXIgbm9kZSBsYXRlclxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcblxuICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5zZXRQb3NpdGlvbihsaWdodC5fbm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5zZXRSb3RhdGlvbihsaWdodC5fbm9kZS5nZXRSb3RhdGlvbigpKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5yb3RhdGVMb2NhbCgtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW0ucHJvamVjdGlvbiA9IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgICAgICAgICBzaGFkb3dDYW0ubmVhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZCAvIDEwMDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZmFyQ2xpcCA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmFzcGVjdFJhdGlvID0gMTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5mb3YgPSBsaWdodC5fb3V0ZXJDb25lQW5nbGUgKiAyO1xuXG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnVwZGF0ZUNhbWVyYUZydXN0dW0oc2hhZG93Q2FtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGNhbWVyYSAvIGZydXN0dW0gb2YgdGhlIGxpZ2h0IGZvciByZW5kZXJpbmcgdGhlIGJha2VOb2RlXG4gICAgLy8gcmV0dXJucyB0cnVlIGlmIGxpZ2h0IGFmZmVjdHMgdGhlIGJha2VOb2RlXG4gICAgbGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbChiYWtlTGlnaHQsIGJha2VOb2RlLCBzaGFkb3dDYW0sIGNhc3RlckJvdW5kcykge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBsZXQgbGlnaHRBZmZlY3RzTm9kZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuXG4gICAgICAgICAgICAvLyB0d2VhayBkaXJlY3Rpb25hbCBsaWdodCBjYW1lcmEgdG8gZnVsbHkgc2VlIGFsbCBjYXN0ZXJzIGFuZCB0aGV5IGFyZSBmdWxseSBpbnNpZGUgdGhlIGZydXN0dW1cbiAgICAgICAgICAgIHRlbXBWZWMuY29weShjYXN0ZXJCb3VuZHMuY2VudGVyKTtcbiAgICAgICAgICAgIHRlbXBWZWMueSArPSBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueTtcblxuICAgICAgICAgICAgdGhpcy5jYW1lcmEubm9kZS5zZXRQb3NpdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5vZGUuc2V0RXVsZXJBbmdsZXMoLTkwLCAwLCAwKTtcblxuICAgICAgICAgICAgdGhpcy5jYW1lcmEubmVhckNsaXAgPSAwO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEuZmFyQ2xpcCA9IGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy55ICogMjtcblxuICAgICAgICAgICAgY29uc3QgZnJ1c3R1bVNpemUgPSBNYXRoLm1heChjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueCwgY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnopO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEub3J0aG9IZWlnaHQgPSBmcnVzdHVtU2l6ZTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBmb3Igb3RoZXIgbGlnaHQgdHlwZXMsIHRlc3QgaWYgbGlnaHQgYWZmZWN0cyB0aGUgbm9kZVxuICAgICAgICAgICAgaWYgKCFiYWtlTGlnaHQubGlnaHRCb3VuZHMuaW50ZXJzZWN0cyhiYWtlTm9kZS5ib3VuZHMpKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRBZmZlY3RzTm9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcGVyIG1lc2hJbnN0YW5jZSBjdWxsaW5nIGZvciBzcG90IGxpZ2h0IG9ubHlcbiAgICAgICAgLy8gKG9tbmkgbGlnaHRzIGN1bGwgcGVyIGZhY2UgbGF0ZXIsIGRpcmVjdGlvbmFsIGxpZ2h0cyBkb24ndCBjdWxsKVxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGxldCBub2RlVmlzaWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gYmFrZU5vZGUubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzW2ldLl9pc1Zpc2libGUoc2hhZG93Q2FtKSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlVmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbm9kZVZpc2libGUpIHtcbiAgICAgICAgICAgICAgICBsaWdodEFmZmVjdHNOb2RlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlnaHRBZmZlY3RzTm9kZTtcbiAgICB9XG5cbiAgICAvLyBzZXQgdXAgbGlnaHQgYXJyYXkgZm9yIGEgc2luZ2xlIGxpZ2h0XG4gICAgc2V0dXBMaWdodEFycmF5KGxpZ2h0QXJyYXksIGxpZ2h0KSB7XG5cbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfRElSRUNUSU9OQUxdLmxlbmd0aCA9IDA7XG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX09NTkldLmxlbmd0aCA9IDA7XG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgbGlnaHRBcnJheVtsaWdodC50eXBlXVswXSA9IGxpZ2h0O1xuICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZW5kZXJTaGFkb3dNYXAoY29tcCwgc2hhZG93TWFwUmVuZGVyZWQsIGNhc3RlcnMsIGJha2VMaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBjYXN0U2hhZG93ID0gbGlnaHQuY2FzdFNoYWRvd3MgJiYgKCFpc0NsdXN0ZXJlZCB8fCB0aGlzLnNjZW5lLmxpZ2h0aW5nLnNoYWRvd3NFbmFibGVkKTtcblxuICAgICAgICBpZiAoIXNoYWRvd01hcFJlbmRlcmVkICYmIGNhc3RTaGFkb3cpIHtcblxuICAgICAgICAgICAgLy8gYWxsb2NhdGUgc2hhZG93IG1hcCBmcm9tIHRoZSBjYWNoZSB0byBhdm9pZCBwZXIgbGlnaHQgYWxsb2NhdGlvblxuICAgICAgICAgICAgaWYgKCFsaWdodC5zaGFkb3dNYXAgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93TWFwID0gdGhpcy5zaGFkb3dNYXBDYWNoZS5nZXQodGhpcy5kZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuY3VsbChsaWdodCwgY29tcCwgdGhpcy5jYW1lcmEsIGNhc3RlcnMpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93UGFzcyA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuZ2V0TGlnaHRSZW5kZXJQYXNzKGxpZ2h0LCB0aGlzLmNhbWVyYSk7XG4gICAgICAgICAgICAgICAgc2hhZG93UGFzcz8ucmVuZGVyKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBsaWdodG1hcHBlciBvbiBXZWJHUFUgZG9lcyBub3QgeWV0IHN1cHBvcnQgc3BvdCBhbmQgb21uaSBzaGFkb3dzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdMaWdodG1hcHBlciBvbiBXZWJHUFUgZG9lcyBub3QgeWV0IHN1cHBvcnQgc3BvdCBhbmQgb21uaSBzaGFkb3dzLicpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlckxvY2FsLmN1bGwobGlnaHQsIGNvbXAsIGNhc3RlcnMpO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBuZWVkcyB0byB1c2UgcmVuZGVyIHBhc3NlcyB0byB3b3JrIG9uIFdlYkdQVVxuICAgICAgICAgICAgICAgIGNvbnN0IGluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNoYWRvd1JlbmRlcmVyLnJlbmRlcihsaWdodCwgdGhpcy5jYW1lcmEsIGluc2lkZVJlbmRlclBhc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcG9zdHByb2Nlc3NUZXh0dXJlcyhkZXZpY2UsIGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgY29uc3QgbnVtRGlsYXRlczJ4ID0gMTsgLy8gMSBvciAyIGRpbGF0ZXMgKGRlcGVuZGluZyBvbiBmaWx0ZXIgYmVpbmcgZW5hYmxlZClcbiAgICAgICAgY29uc3QgZGlsYXRlU2hhZGVyID0gdGhpcy5saWdodG1hcEZpbHRlcnMuc2hhZGVyRGlsYXRlO1xuXG4gICAgICAgIC8vIGJpbGF0ZXJhbCBkZW5vaXNlIGZpbHRlciAtIHJ1bnMgYXMgYSBmaXJzdCBwYXNzLCBiZWZvcmUgZGlsYXRlXG4gICAgICAgIGNvbnN0IGZpbHRlckxpZ2h0bWFwID0gdGhpcy5zY2VuZS5saWdodG1hcEZpbHRlckVuYWJsZWQ7XG4gICAgICAgIGlmIChmaWx0ZXJMaWdodG1hcCkge1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZURlbm9pc2UodGhpcy5zY2VuZS5saWdodG1hcEZpbHRlclJhbmdlLCB0aGlzLnNjZW5lLmxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLk5PQkxFTkQpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLk5PREVQVEgpO1xuICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFN0YXRlKG51bGwsIG51bGwpO1xuXG4gICAgICAgIGZvciAobGV0IG5vZGUgPSAwOyBub2RlIDwgYmFrZU5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tub2RlXTtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCBgTE1Qb3N0OiR7bm9kZX1gKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVJUID0gYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcCA9IG5vZGVSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBSVCA9IHRoaXMucmVuZGVyVGFyZ2V0cy5nZXQobGlnaHRtYXAud2lkdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBUZXggPSB0ZW1wUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5wcmVwYXJlKGxpZ2h0bWFwLndpZHRoLCBsaWdodG1hcC5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgLy8gYm91bmNlIGRpbGF0ZSBiZXR3ZWVuIHRleHR1cmVzLCBleGVjdXRlIGRlbm9pc2Ugb24gdGhlIGZpcnN0IHBhc3NcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bURpbGF0ZXMyeDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMuc2V0U291cmNlVGV4dHVyZShsaWdodG1hcCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbGF0ZXJhbEZpbHRlckVuYWJsZWQgPSBmaWx0ZXJMaWdodG1hcCAmJiBwYXNzID09PSAwICYmIGkgPT09IDA7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRlbXBSVCwgYmlsYXRlcmFsRmlsdGVyRW5hYmxlZCA/IHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNoYWRlckRlbm9pc2UgOiBkaWxhdGVTaGFkZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNldFNvdXJjZVRleHR1cmUodGVtcFRleCk7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIG5vZGVSVCwgZGlsYXRlU2hhZGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJha2VJbnRlcm5hbChwYXNzQ291bnQsIGJha2VOb2RlcywgYWxsTm9kZXMpIHtcblxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IGNvbXAgPSBzY2VuZS5sYXllcnM7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSBzY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgdGhpcy5jcmVhdGVNYXRlcmlhbHMoZGV2aWNlLCBzY2VuZSwgcGFzc0NvdW50KTtcbiAgICAgICAgdGhpcy5zZXR1cFNjZW5lKCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGNvbXAuX3VwZGF0ZSgpO1xuXG4gICAgICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94ZXMgZm9yIG5vZGVzXG4gICAgICAgIHRoaXMuY29tcHV0ZU5vZGVzQm91bmRzKGJha2VOb2Rlcyk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGxpZ2h0bWFwIHNpemVzIGFuZCBhbGxvY2F0ZSB0ZXh0dXJlc1xuICAgICAgICB0aGlzLmFsbG9jYXRlVGV4dHVyZXMoYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIENvbGxlY3QgYmFrZWFibGUgbGlnaHRzLCBhbmQgYWxzbyBrZWVwIGFsbExpZ2h0cyBhbG9uZyB3aXRoIHRoZWlyIHByb3BlcnRpZXMgd2UgY2hhbmdlIHRvIHJlc3RvcmUgdGhlbSBsYXRlclxuICAgICAgICB0aGlzLnJlbmRlcmVyLmNvbGxlY3RMaWdodHMoY29tcCk7XG4gICAgICAgIGNvbnN0IGFsbExpZ2h0cyA9IFtdLCBiYWtlTGlnaHRzID0gW107XG4gICAgICAgIHRoaXMucHJlcGFyZUxpZ2h0c1RvQmFrZShjb21wLCBhbGxMaWdodHMsIGJha2VMaWdodHMpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMudXBkYXRlVHJhbnNmb3JtcyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXAgYW5kIHNldCB0aGVtIHVwIGZvciByZWFsdGltZSBzaGFkb3cgY2FzdGluZ1xuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5wcmVwYXJlU2hhZG93Q2FzdGVycyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHNraW5uZWQgYW5kIG1vcnBoZWQgbWVzaGVzXG4gICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKGNhc3RlcnMpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmdwdVVwZGF0ZShjYXN0ZXJzKTtcblxuICAgICAgICAvLyBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFsbCBjYXN0ZXJzLCB1c2VkIHRvIGNvbXB1dGUgc2hhcmVkIGRpcmVjdGlvbmFsIGxpZ2h0IHNoYWRvd1xuICAgICAgICBjb25zdCBjYXN0ZXJCb3VuZHMgPSB0aGlzLmNvbXB1dGVCb3VuZHMoY2FzdGVycyk7XG5cbiAgICAgICAgbGV0IGksIGosIHJjdiwgbTtcblxuICAgICAgICAvLyBQcmVwYXJlIG1vZGVsc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tpXTtcbiAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvLyBwYXRjaCBtZXNoSW5zdGFuY2VcbiAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuXG4gICAgICAgICAgICAgICAgbS5zZXRMaWdodG1hcHBlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgbS5tYXNrID0gTUFTS19CQUtFOyAvLyBvbmx5IGFmZmVjdGVkIGJ5IExNIGxpZ2h0c1xuXG4gICAgICAgICAgICAgICAgLy8gcGF0Y2ggbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbS5tYXRlcmlhbC5saWdodE1hcCA/IG0ubWF0ZXJpYWwubGlnaHRNYXAgOiB0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgdGhpcy5ibGFja1RleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBiYWtlYWJsZSBsaWdodHNcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IGJha2VMaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGJha2VMaWdodHNbal0ubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGlnaHRBcnJheSA9IFtbXSwgW10sIFtdXTtcbiAgICAgICAgbGV0IHBhc3MsIG5vZGU7XG4gICAgICAgIGxldCBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIEFjY3VtdWxhdGUgbGlnaHRzIGludG8gUkdCTSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gYmFrZUxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzQW1iaWVudExpZ2h0ID0gYmFrZUxpZ2h0IGluc3RhbmNlb2YgQmFrZUxpZ2h0QW1iaWVudDtcbiAgICAgICAgICAgIGNvbnN0IGlzRGlyZWN0aW9uYWwgPSBiYWtlTGlnaHQubGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMO1xuXG4gICAgICAgICAgICAvLyBsaWdodCBjYW4gYmUgYmFrZWQgdXNpbmcgbWFueSB2aXJ0dWFsIGxpZ2h0cyB0byBjcmVhdGUgc29mdCBlZmZlY3RcbiAgICAgICAgICAgIGxldCBudW1WaXJ0dWFsTGlnaHRzID0gYmFrZUxpZ2h0Lm51bVZpcnR1YWxMaWdodHM7XG5cbiAgICAgICAgICAgIC8vIGRpcmVjdGlvbiBiYWtpbmcgaXMgbm90IGN1cnJlbnRseSBjb21wYXRpYmxlIHdpdGggdmlydHVhbCBsaWdodHMsIGFzIHdlIGVuZCB1cCB3aXRoIG5vIHZhbGlkIGRpcmVjdGlvbiBpbiBsaWdodHMgcGVudW1icmFcbiAgICAgICAgICAgIGlmIChwYXNzQ291bnQgPiAxICYmIG51bVZpcnR1YWxMaWdodHMgPiAxICYmIGJha2VMaWdodC5saWdodC5iYWtlRGlyKSB7XG4gICAgICAgICAgICAgICAgbnVtVmlydHVhbExpZ2h0cyA9IDE7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignTGlnaHRtYXBwZXJcXCdzIEJBS0VfQ09MT1JESVIgbW9kZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIExpZ2h0XFwncyBiYWtlTnVtU2FtcGxlcyBsYXJnZXIgdGhhbiBvbmUuIEZvcmNpbmcgaXQgdG8gb25lLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCB2aXJ0dWFsTGlnaHRJbmRleCA9IDA7IHZpcnR1YWxMaWdodEluZGV4IDwgbnVtVmlydHVhbExpZ2h0czsgdmlydHVhbExpZ2h0SW5kZXgrKykge1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExpZ2h0OiR7YmFrZUxpZ2h0LmxpZ2h0Ll9ub2RlLm5hbWV9OiR7dmlydHVhbExpZ2h0SW5kZXh9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIHZpcnR1YWwgbGlnaHRcbiAgICAgICAgICAgICAgICBpZiAobnVtVmlydHVhbExpZ2h0cyA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYmFrZUxpZ2h0LnByZXBhcmVWaXJ0dWFsTGlnaHQodmlydHVhbExpZ2h0SW5kZXgsIG51bVZpcnR1YWxMaWdodHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJha2VMaWdodC5zdGFydEJha2UoKTtcbiAgICAgICAgICAgICAgICBsZXQgc2hhZG93TWFwUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IHRoaXMubGlnaHRDYW1lcmFQcmVwYXJlKGRldmljZSwgYmFrZUxpZ2h0KTtcblxuICAgICAgICAgICAgICAgIGZvciAobm9kZSA9IDA7IG5vZGUgPCBiYWtlTm9kZXMubGVuZ3RoOyBub2RlKyspIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tub2RlXTtcbiAgICAgICAgICAgICAgICAgICAgcmN2ID0gYmFrZU5vZGUubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEFmZmVjdHNOb2RlID0gdGhpcy5saWdodENhbWVyYVByZXBhcmVBbmRDdWxsKGJha2VMaWdodCwgYmFrZU5vZGUsIHNoYWRvd0NhbSwgY2FzdGVyQm91bmRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodEFmZmVjdHNOb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBMaWdodEFycmF5KGxpZ2h0QXJyYXksIGJha2VMaWdodC5saWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJMaWdodHMgPSBpc0RpcmVjdGlvbmFsID8gW10gOiBbYmFrZUxpZ2h0LmxpZ2h0XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShjbHVzdGVyTGlnaHRzLCB0aGlzLmxpZ2h0aW5nUGFyYW1zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbmRlciBsaWdodCBzaGFkb3cgbWFwIG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd01hcFJlbmRlcmVkID0gdGhpcy5yZW5kZXJTaGFkb3dNYXAoY29tcCwgc2hhZG93TWFwUmVuZGVyZWQsIGNhc3RlcnMsIGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLnVwZGF0ZShjbHVzdGVyTGlnaHRzLCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrdXBNYXRlcmlhbHMocmN2KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSBiYWtlIGZpcnN0IHZpcnR1YWwgbGlnaHQgZm9yIHBhc3MgMSwgYXMgaXQgZG9lcyBub3QgaGFuZGxlIG92ZXJsYXBwaW5nIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPiAwICYmIHZpcnR1YWxMaWdodEluZGV4ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb24ndCBiYWtlIGFtYmllbnQgbGlnaHQgaW4gcGFzcyAxLCBhcyB0aGVyZSdzIG5vIG1haW4gZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQgJiYgcGFzcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExNUGFzczoke3Bhc3N9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcFNpemUgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyLndpZHRoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgbWF0Y2hpbmcgdGVtcCByZW5kZXIgdGFyZ2V0IHRvIHJlbmRlciB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFJUID0gdGhpcy5yZW5kZXJUYXJnZXRzLmdldChsaWdodG1hcFNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFRleCA9IHRlbXBSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IHNjZW5lLnVwZGF0ZVNoYWRlcnM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwYXNzTWF0ZXJpYWwgPSB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgbGFzdCB2aXJ0dWFsIGxpZ2h0IG9mIGFtYmllbnQgbGlnaHQsIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGxpZ2h0bWFwIHdpdGggYW1iaWVudCBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzID0gdmlydHVhbExpZ2h0SW5kZXggKyAxID09PSBudW1WaXJ0dWFsTGlnaHRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyAmJiBwYXNzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhc3NNYXRlcmlhbCA9IHRoaXMuYW1iaWVudEFPTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdXAgbWF0ZXJpYWwgZm9yIGJha2luZyBhIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByY3Zbal0ubWF0ZXJpYWwgPSBwYXNzTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBzaGFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlU2hhZGVycyhyY3YpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgcmVjZWl2ZXJzIHRvIHRoZSB0ZW1wUlRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzID09PSBQQVNTX0RJUikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRCYWtlRGlyLnNldFZhbHVlKGJha2VMaWdodC5saWdodC5iYWtlRGlyID8gMSA6IDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLmlzV2ViR1BVKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBPbiBXZWJHUFUgd2UgdXNlIGEgcmVuZGVyIHBhc3MsIGJ1dCB0aGlzIGhhcyBzb21lIGlzc3VlIGl0IHNlZW1zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZWVkcyB0byBiZSBpbnZlc3RpZ2F0ZWQgYW5kIGZpeGVkLiBJbiB0aGUgTGlnaHRzQmFrZWQgZXhhbXBsZSwgZWRnZXMgb2ZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzb21lIGdlb21ldHJ5IGFyZSBub3QgbGl0IGNvcnJlY3RseSwgZXNwZWNpYWxseSB2aXNpYmxlIG9uIGJveGVzLiBNb3N0IGxpa2VseVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNvbWUgZ2xvYmFsIHBlciBmcmFtZSAvIHBlciBjYW1lcmEgY29uc3RhbnRzIGFyZSBub3Qgc2V0IHVwIG9yIHNpbWlsYXIsIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXJGb3J3YXJkIHNldHMgdXAuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzTGlnaHRtYXBwZXIoZGV2aWNlLCB0aGlzLnJlbmRlcmVyLCB0aGlzLmNhbWVyYSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPyB0aGlzLndvcmxkQ2x1c3RlcnMgOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJjdiwgbGlnaHRBcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5pbml0KHRlbXBSVCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgICAgLy8gdXNlIHRoZSBvbGQgcGF0aCBmb3IgV2ViR0wgdGlsbCB0aGUgcmVuZGVyIHBhc3Mgd2F5IGFib3ZlIGlzIGZpeGVkXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwaW5nLXBvbmdpbmcgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRDYW1lcmEodGhpcy5jYW1lcmEsIHRlbXBSVCwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIGNsdXN0ZXJlZCBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXJGb3J3YXJkKHRoaXMuY2FtZXJhLCByY3YsIGxpZ2h0QXJyYXksIFNIQURFUl9GT1JXQVJESERSKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS51cGRhdGVFbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lICs9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLmZvcndhcmRUaW1lICs9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5yZW5kZXJQYXNzZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wIHJlbmRlciB0YXJnZXQgbm93IGhhcyBsaWdodG1hcCwgc3RvcmUgaXQgZm9yIHRoZSBub2RlXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdID0gdGVtcFJUO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgcmVsZWFzZSBwcmV2aW91cyBsaWdodG1hcCBpbnRvIHRlbXAgcmVuZGVyIHRhcmdldCBwb29sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuc2V0KGxpZ2h0bWFwU2l6ZSwgbm9kZVJUKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJjdi5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0gPSByY3Zbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbcGFzc10sIHRlbXBUZXgpOyAvLyBwaW5nLXBvbmdpbmcgaW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLl9zaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9MTTsgLy8gZm9yY2UgdXNpbmcgTE0gZXZlbiBpZiBtYXRlcmlhbCBkb2Vzbid0IGhhdmUgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJldmVydCB0byBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXN0b3JlTWF0ZXJpYWxzKHJjdik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYmFrZUxpZ2h0LmVuZEJha2UodGhpcy5zaGFkb3dNYXBDYWNoZSk7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0cHJvY2Vzc1RleHR1cmVzKGRldmljZSwgYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIHJlc3RvcmUgY2hhbmdlc1xuICAgICAgICBmb3IgKG5vZGUgPSAwOyBub2RlIDwgYWxsTm9kZXMubGVuZ3RoOyBub2RlKyspIHtcbiAgICAgICAgICAgIGFsbE5vZGVzW25vZGVdLnJlc3RvcmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVzdG9yZUxpZ2h0cyhhbGxMaWdodHMpO1xuICAgICAgICB0aGlzLnJlc3RvcmVTY2VuZSgpO1xuXG4gICAgICAgIC8vIGVtcHR5IGNhY2hlIHRvIG1pbmltaXplIHBlcnNpc3RlbnQgbWVtb3J5IHVzZSAuLiBpZiBzb21lIGNhY2hlZCB0ZXh0dXJlcyBhcmUgbmVlZGVkLFxuICAgICAgICAvLyB0aGV5IHdpbGwgYmUgYWxsb2NhdGVkIGFnYWluIGFzIG5lZWRlZFxuICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMaWdodG1hcHBlciB9O1xuIl0sIm5hbWVzIjpbIk1BWF9MSUdIVE1BUF9TSVpFIiwiUEFTU19DT0xPUiIsIlBBU1NfRElSIiwidGVtcFZlYyIsIlZlYzMiLCJMaWdodG1hcHBlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwicm9vdCIsInNjZW5lIiwicmVuZGVyZXIiLCJhc3NldHMiLCJzaGFkb3dNYXBDYWNoZSIsIl90ZW1wU2V0IiwiU2V0IiwiX2luaXRDYWxsZWQiLCJwYXNzTWF0ZXJpYWxzIiwiYW1iaWVudEFPTWF0ZXJpYWwiLCJmb2ciLCJhbWJpZW50TGlnaHQiLCJDb2xvciIsInJlbmRlclRhcmdldHMiLCJNYXAiLCJzdGF0cyIsInJlbmRlclBhc3NlcyIsImxpZ2h0bWFwQ291bnQiLCJ0b3RhbFJlbmRlclRpbWUiLCJmb3J3YXJkVGltZSIsImZib1RpbWUiLCJzaGFkb3dNYXBUaW1lIiwiY29tcGlsZVRpbWUiLCJzaGFkZXJzTGlua2VkIiwiZGVzdHJveSIsIl90aGlzJGNhbWVyYSIsIkxpZ2h0bWFwQ2FjaGUiLCJkZWNSZWYiLCJibGFja1RleCIsImNhbWVyYSIsImluaXRCYWtlIiwibGlnaHRtYXBGaWx0ZXJzIiwiTGlnaHRtYXBGaWx0ZXJzIiwiY29uc3RhbnRCYWtlRGlyIiwic2NvcGUiLCJyZXNvbHZlIiwibWF0ZXJpYWxzIiwiVGV4dHVyZSIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfUkdCTSIsIm5hbWUiLCJpbmNSZWYiLCJDYW1lcmEiLCJjbGVhckNvbG9yIiwic2V0IiwiY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJmcnVzdHVtQ3VsbGluZyIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsImFzcGVjdFJhdGlvIiwibm9kZSIsIkdyYXBoTm9kZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0aW5nUGFyYW1zIiwiTGlnaHRpbmdQYXJhbXMiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJtYXhUZXh0dXJlU2l6ZSIsInNyY1BhcmFtcyIsImxpZ2h0aW5nIiwic2hhZG93c0VuYWJsZWQiLCJzaGFkb3dBdGxhc1Jlc29sdXRpb24iLCJjb29raWVzRW5hYmxlZCIsImNvb2tpZUF0bGFzUmVzb2x1dGlvbiIsImFyZWFMaWdodHNFbmFibGVkIiwiY2VsbHMiLCJtYXhMaWdodHNQZXJDZWxsIiwid29ybGRDbHVzdGVycyIsIldvcmxkQ2x1c3RlcnMiLCJmaW5pc2hCYWtlIiwiYmFrZU5vZGVzIiwiZGVzdHJveVJUIiwicnQiLCJjb2xvckJ1ZmZlciIsImZvckVhY2giLCJjbGVhciIsImxlbmd0aCIsImNyZWF0ZU1hdGVyaWFsRm9yUGFzcyIsInBhc3MiLCJhZGRBbWJpZW50IiwibWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwiY2h1bmtzIiwiQVBJVmVyc2lvbiIsIkNIVU5LQVBJXzFfNjUiLCJ0cmFuc2Zvcm1EZWZpbmVzIiwidHJhbnNmb3JtVlMiLCJzaGFkZXJDaHVua3MiLCJiYWtlTG1FbmRDaHVuayIsInNoYWRlckNodW5rc0xpZ2h0bWFwcGVyIiwiYmFrZUxtRW5kUFMiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IiwidG9GaXhlZCIsImFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyIsImFtYmllbnQiLCJhbWJpZW50VGludCIsImJhc2VQUyIsImxpZ2h0bWFwUGl4ZWxGb3JtYXQiLCJlbmRQUyIsImxpZ2h0TWFwIiwiYmFrZURpckxtRW5kUFMiLCJvdXRwdXRBbHBoYVBTIiwib3V0cHV0QWxwaGFPcGFxdWVQUyIsIm91dHB1dEFscGhhUHJlbXVsUFMiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsImZvcmNlVXYxIiwidXBkYXRlIiwiY3JlYXRlTWF0ZXJpYWxzIiwicGFzc0NvdW50Iiwib25VcGRhdGVTaGFkZXIiLCJvcHRpb25zIiwibGl0T3B0aW9ucyIsImxpZ2h0TWFwV2l0aG91dEFtYmllbnQiLCJzZXBhcmF0ZUFtYmllbnQiLCJjcmVhdGVUZXh0dXJlIiwic2l6ZSIsInByb2ZpbGVySGludCIsIlRFWEhJTlRfTElHSFRNQVAiLCJtaXBtYXBzIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImNvbGxlY3RNb2RlbHMiLCJhbGxOb2RlcyIsIl9ub2RlJG1vZGVsIiwiX25vZGUkbW9kZWwyIiwiX25vZGUkcmVuZGVyIiwiZW5hYmxlZCIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbCIsInB1c2giLCJCYWtlTWVzaE5vZGUiLCJsaWdodG1hcHBlZCIsInJlbmRlciIsImhhc1V2MSIsImkiLCJtZXNoIiwidmVydGV4QnVmZmVyIiwiRGVidWciLCJsb2ciLCJub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzIiwiaGFzIiwiYWRkIiwiX2NoaWxkcmVuIiwicHJlcGFyZVNoYWRvd0Nhc3RlcnMiLCJub2RlcyIsImNhc3RlcnMiLCJuIiwiY29tcG9uZW50IiwiY2FzdFNoYWRvd3MiLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibWVzaGVzIiwidmlzaWJsZVRoaXNGcmFtZSIsInVwZGF0ZVRyYW5zZm9ybXMiLCJqIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjYWxjdWxhdGVMaWdodG1hcFNpemUiLCJkYXRhIiwic2l6ZU11bHQiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwic2NhbGUiLCJzcmNBcmVhIiwiYXNzZXQiLCJnZXQiLCJhcmVhIiwiX2FyZWEiLCJ4IiwieSIsInoiLCJ1diIsImFyZWFNdWx0IiwiYm91bmRzIiwiY29tcHV0ZU5vZGVCb3VuZHMiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJ0b3RhbEFyZWEiLCJNYXRoIiwic3FydCIsImxpZ2h0bWFwU2l6ZSIsIm1pbiIsIm1hdGgiLCJuZXh0UG93ZXJPZlR3byIsImxpZ2h0bWFwTWF4UmVzb2x1dGlvbiIsInNldExpZ2h0bWFwcGluZyIsInZhbHVlIiwic2hhZGVyRGVmcyIsIm1lc2hJbnN0YW5jZSIsInNldExpZ2h0bWFwcGVkIiwiX3NoYWRlckRlZnMiLCJtYXNrIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJ0ZXgiLCJGSUxURVJfTElORUFSIiwic2V0UmVhbHRpbWVMaWdodG1hcCIsIk1lc2hJbnN0YW5jZSIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsImJha2UiLCJtb2RlIiwiQkFLRV9DT0xPUkRJUiIsInN0YXJ0VGltZSIsIm5vdyIsIl91cGRhdGVTa3lNZXNoIiwiZmlyZSIsInRpbWVzdGFtcCIsInRhcmdldCIsInN0YXJ0U2hhZGVycyIsIl9zaGFkZXJTdGF0cyIsImxpbmtlZCIsInN0YXJ0RmJvVGltZSIsIl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUiLCJzdGFydENvbXBpbGVUaW1lIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzaGFkb3dSZW5kZXJlciIsImZyYW1lVXBkYXRlIiwiYmFrZUludGVybmFsIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiYW1iaWVudEJha2UiLCJTSEFERVJERUZfTE1BTUJJRU5UIiwicG9wR3B1TWFya2VyIiwibm93VGltZSIsImFsbG9jYXRlVGV4dHVyZXMiLCJiYWtlTm9kZSIsIlJlbmRlclRhcmdldCIsImRlcHRoIiwicHJlcGFyZUxpZ2h0c1RvQmFrZSIsImxheWVyQ29tcG9zaXRpb24iLCJhbGxMaWdodHMiLCJiYWtlTGlnaHRzIiwiQmFrZUxpZ2h0QW1iaWVudCIsInNjZW5lTGlnaHRzIiwibGlnaHRzIiwibGlnaHQiLCJiYWtlTGlnaHQiLCJCYWtlTGlnaHRTaW1wbGUiLCJNQVNLX0JBS0UiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwic2hhZG93VXBkYXRlTW9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIlNIQURPV1VQREFURV9SRUFMVElNRSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJzb3J0IiwicmVzdG9yZUxpZ2h0cyIsInJlc3RvcmUiLCJzZXR1cFNjZW5lIiwiRk9HX05PTkUiLCJzZXRTY2VuZUNvbnN0YW50cyIsInJlc3RvcmVTY2VuZSIsIkJvdW5kaW5nQm94IiwiYWFiYiIsIm0iLCJjb21wdXRlTm9kZXNCb3VuZHMiLCJjb21wdXRlQm91bmRzIiwiYmFja3VwTWF0ZXJpYWxzIiwicmVzdG9yZU1hdGVyaWFscyIsImxpZ2h0Q2FtZXJhUHJlcGFyZSIsInNoYWRvd0NhbSIsIkxJR0hUVFlQRV9TUE9UIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd0NhbWVyYSIsIl9ub2RlIiwic2V0UG9zaXRpb24iLCJnZXRQb3NpdGlvbiIsInNldFJvdGF0aW9uIiwiZ2V0Um90YXRpb24iLCJyb3RhdGVMb2NhbCIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsImZvdiIsIl9vdXRlckNvbmVBbmdsZSIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsIiwiY2FzdGVyQm91bmRzIiwibGlnaHRBZmZlY3RzTm9kZSIsImNlbnRlciIsInNldEV1bGVyQW5nbGVzIiwiZnJ1c3R1bVNpemUiLCJtYXgiLCJvcnRob0hlaWdodCIsImxpZ2h0Qm91bmRzIiwiaW50ZXJzZWN0cyIsIm5vZGVWaXNpYmxlIiwiX2lzVmlzaWJsZSIsInNldHVwTGlnaHRBcnJheSIsImxpZ2h0QXJyYXkiLCJMSUdIVFRZUEVfT01OSSIsInJlbmRlclNoYWRvd01hcCIsImNvbXAiLCJzaGFkb3dNYXBSZW5kZXJlZCIsImlzQ2x1c3RlcmVkIiwiY2FzdFNoYWRvdyIsInNoYWRvd01hcCIsIl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwic2hhZG93UGFzcyIsImdldExpZ2h0UmVuZGVyUGFzcyIsImlzV2ViR1BVIiwid2Fybk9uY2UiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsImluc2lkZVJlbmRlclBhc3MiLCJwb3N0cHJvY2Vzc1RleHR1cmVzIiwibnVtRGlsYXRlczJ4IiwiZGlsYXRlU2hhZGVyIiwic2hhZGVyRGlsYXRlIiwiZmlsdGVyTGlnaHRtYXAiLCJsaWdodG1hcEZpbHRlckVuYWJsZWQiLCJwcmVwYXJlRGVub2lzZSIsImxpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJsaWdodG1hcEZpbHRlclNtb290aG5lc3MiLCJzZXRCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIk5PQkxFTkQiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIk5PREVQVEgiLCJzZXRTdGVuY2lsU3RhdGUiLCJub2RlUlQiLCJsaWdodG1hcCIsInRlbXBSVCIsInRlbXBUZXgiLCJwcmVwYXJlIiwic2V0U291cmNlVGV4dHVyZSIsImJpbGF0ZXJhbEZpbHRlckVuYWJsZWQiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJEZW5vaXNlIiwibGF5ZXJzIiwiX3VwZGF0ZSIsImNvbGxlY3RMaWdodHMiLCJ1cGRhdGVDcHVTa2luTWF0cmljZXMiLCJncHVVcGRhdGUiLCJyY3YiLCJzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyIsImlzQW1iaWVudExpZ2h0IiwiaXNEaXJlY3Rpb25hbCIsIm51bVZpcnR1YWxMaWdodHMiLCJiYWtlRGlyIiwid2FybiIsInZpcnR1YWxMaWdodEluZGV4IiwicHJlcGFyZVZpcnR1YWxMaWdodCIsInN0YXJ0QmFrZSIsImNsdXN0ZXJMaWdodHMiLCJsaWdodFRleHR1cmVBdGxhcyIsImdhbW1hQ29ycmVjdGlvbiIsInVwZGF0ZVNoYWRlcnMiLCJwYXNzTWF0ZXJpYWwiLCJsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyIsInNldFZhbHVlIiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3NMaWdodG1hcHBlciIsImluaXQiLCJzZXRDYW1lcmEiLCJhY3RpdmF0ZSIsIl9mb3J3YXJkVGltZSIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyRm9yd2FyZCIsIlNIQURFUl9GT1JXQVJESERSIiwidXBkYXRlRW5kIiwiZW5kQmFr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
