import { Debug } from '../core/debug.js';
import { hash32Fnv1a } from '../core/hash.js';
import { SORTMODE_MATERIALMESH, SORTMODE_BACK2FRONT, SHADER_FORWARD, LIGHTTYPE_DIRECTIONAL, LAYER_FX, SORTMODE_NONE, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTKEY_FORWARD } from './constants.js';
import { Material } from './materials/material.js';

function sortManual(drawCallA, drawCallB) {
  return drawCallA.drawOrder - drawCallB.drawOrder;
}
function sortMaterialMesh(drawCallA, drawCallB) {
  const keyA = drawCallA._key[SORTKEY_FORWARD];
  const keyB = drawCallB._key[SORTKEY_FORWARD];
  if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
    return drawCallB.mesh.id - drawCallA.mesh.id;
  }
  return keyB - keyA;
}
function sortBackToFront(drawCallA, drawCallB) {
  return drawCallB.zdist - drawCallA.zdist;
}
function sortFrontToBack(drawCallA, drawCallB) {
  return drawCallA.zdist - drawCallB.zdist;
}
const sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];

// Layers
let layerCounter = 0;
const lightKeys = [];
const _tempMaterials = new Set();
class CulledInstances {
  constructor() {
    /**
     * Visible opaque mesh instances.
     *
     * @type {import('./mesh-instance.js').MeshInstance[]}
     */
    this.opaque = [];
    /**
     * Visible transparent mesh instances.
     *
     * @type {import('./mesh-instance.js').MeshInstance[]}
     */
    this.transparent = [];
  }
}

/**
 * A Layer represents a renderable subset of the scene. It can contain a list of mesh instances,
 * lights and cameras, their render settings and also defines custom callbacks before, after or
 * during rendering. Layers are organized inside {@link LayerComposition} in a desired order.
 *
 * @category Graphics
 */
class Layer {
  /**
   * Create a new Layer instance.
   *
   * @param {object} options - Object for passing optional arguments. These arguments are the
   * same as properties of the Layer.
   */
  constructor(options = {}) {
    var _options$enabled, _options$opaqueSortMo, _options$transparentS, _options$shaderPass;
    /**
     * Mesh instances assigned to this layer.
     *
     * @type {import('./mesh-instance.js').MeshInstance[]}
     * @ignore
     */
    this.meshInstances = [];
    /**
     * Mesh instances assigned to this layer, stored in a set.
     *
     * @type {Set<import('./mesh-instance.js').MeshInstance>}
     * @ignore
     */
    this.meshInstancesSet = new Set();
    /**
     * Shadow casting instances assigned to this layer.
     *
     * @type {import('./mesh-instance.js').MeshInstance[]}
     * @ignore
     */
    this.shadowCasters = [];
    /**
     * Shadow casting instances assigned to this layer, stored in a set.
     *
     * @type {Set<import('./mesh-instance.js').MeshInstance>}
     * @ignore
     */
    this.shadowCastersSet = new Set();
    /**
     * Visible (culled) mesh instances assigned to this layer. Looked up by the Camera.
     *
     * @type {WeakMap<import('./camera.js').Camera, CulledInstances>}
     * @private
     */
    this._visibleInstances = new WeakMap();
    /**
     * All lights assigned to a layer.
     *
     * @type {import('./light.js').Light[]}
     * @private
     */
    this._lights = [];
    /**
     * All lights assigned to a layer stored in a set.
     *
     * @type {Set<import('./light.js').Light>}
     * @private
     */
    this._lightsSet = new Set();
    /**
     * Set of light used by clustered lighting (omni and spot, but no directional).
     *
     * @type {Set<import('./light.js').Light>}
     * @private
     */
    this._clusteredLightsSet = new Set();
    /**
     * Lights separated by light type. Lights in the individual arrays are sorted by the key,
     * to match their order in _lightIdHash, so that their order matches the order expected by the
     * generated shader code.
     *
     * @type {import('./light.js').Light[][]}
     * @private
     */
    this._splitLights = [[], [], []];
    /**
     * True if _splitLights needs to be updated, which means if lights were added or removed from
     * the layer, or their key changed.
     *
     * @type {boolean}
     * @private
     */
    this._splitLightsDirty = true;
    /**
     * True if the objects rendered on the layer require light cube (emitters with lighting do).
     *
     * @type {boolean}
     * @ignore
     */
    this.requiresLightCube = false;
    /**
     * @type {import('../framework/components/camera/component.js').CameraComponent[]}
     * @ignore
     */
    this.cameras = [];
    /**
     * @type {Set<import('./camera.js').Camera>}
     * @ignore
     */
    this.camerasSet = new Set();
    /**
     * True if the composition is invalidated.
     *
     * @ignore
     */
    this._dirtyComposition = false;
    if (options.id !== undefined) {
      /**
       * A unique ID of the layer. Layer IDs are stored inside {@link ModelComponent#layers},
       * {@link RenderComponent#layers}, {@link CameraComponent#layers},
       * {@link LightComponent#layers} and {@link ElementComponent#layers} instead of names.
       * Can be used in {@link LayerComposition#getLayerById}.
       *
       * @type {number}
       */
      this.id = options.id;
      layerCounter = Math.max(this.id + 1, layerCounter);
    } else {
      this.id = layerCounter++;
    }

    /**
     * Name of the layer. Can be used in {@link LayerComposition#getLayerByName}.
     *
     * @type {string}
     */
    this.name = options.name;

    /**
     * @type {boolean}
     * @private
     */
    this._enabled = (_options$enabled = options.enabled) != null ? _options$enabled : true;
    /**
     * @type {number}
     * @private
     */
    this._refCounter = this._enabled ? 1 : 0;

    /**
     * Defines the method used for sorting opaque (that is, not semi-transparent) mesh
     * instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_MATERIALMESH}.
     *
     * @type {number}
     */
    this.opaqueSortMode = (_options$opaqueSortMo = options.opaqueSortMode) != null ? _options$opaqueSortMo : SORTMODE_MATERIALMESH;

    /**
     * Defines the method used for sorting semi-transparent mesh instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_BACK2FRONT}.
     *
     * @type {number}
     */
    this.transparentSortMode = (_options$transparentS = options.transparentSortMode) != null ? _options$transparentS : SORTMODE_BACK2FRONT;
    if (options.renderTarget) {
      this.renderTarget = options.renderTarget;
    }

    /**
     * A type of shader to use during rendering. Possible values are:
     *
     * - {@link SHADER_FORWARD}
     * - {@link SHADER_FORWARDHDR}
     * - {@link SHADER_DEPTH}
     * - Your own custom value. Should be in 19 - 31 range. Use {@link StandardMaterial#onUpdateShader}
     * to apply shader modifications based on this value.
     *
     * Defaults to {@link SHADER_FORWARD}.
     *
     * @type {number}
     */
    this.shaderPass = (_options$shaderPass = options.shaderPass) != null ? _options$shaderPass : SHADER_FORWARD;

    // clear flags
    /**
     * @type {boolean}
     * @private
     */
    this._clearColorBuffer = !!options.clearColorBuffer;

    /**
     * @type {boolean}
     * @private
     */
    this._clearDepthBuffer = !!options.clearDepthBuffer;

    /**
     * @type {boolean}
     * @private
     */
    this._clearStencilBuffer = !!options.clearStencilBuffer;

    /**
     * Custom function that is called before visibility culling is performed for this layer.
     * Useful, for example, if you want to modify camera projection while still using the same
     * camera and make frustum culling work correctly with it (see
     * {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}).
     * This function will receive camera index as the only argument. You can get the actual
     * camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreCull = options.onPreCull;

    /**
     * Custom function that is called before this layer is rendered. Useful, for example, for
     * reacting on screen size changes. This function is called before the first occurrence of
     * this layer in {@link LayerComposition}. It will receive camera index as the only
     * argument. You can get the actual camera being used by looking up
     * {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreRender = options.onPreRender;

    /**
     * Custom function that is called before opaque mesh instances (not semi-transparent) in
     * this layer are rendered. This function will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPreRenderOpaque = options.onPreRenderOpaque;

    /**
     * Custom function that is called before semi-transparent mesh instances in this layer are
     * rendered. This function will receive camera index as the only argument. You can get the
     * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreRenderTransparent = options.onPreRenderTransparent;

    /**
     * Custom function that is called after visibility culling is performed for this layer.
     * Useful for reverting changes done in {@link Layer#onPreCull} and determining final mesh
     * instance visibility (see {@link MeshInstance#visibleThisFrame}). This function will
     * receive camera index as the only argument. You can get the actual camera being used by
     * looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPostCull = options.onPostCull;

    /**
     * Custom function that is called after this layer is rendered. Useful to revert changes
     * made in {@link Layer#onPreRender}. This function is called after the last occurrence of this
     * layer in {@link LayerComposition}. It will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPostRender = options.onPostRender;

    /**
     * Custom function that is called after opaque mesh instances (not semi-transparent) in
     * this layer are rendered. This function will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPostRenderOpaque = options.onPostRenderOpaque;

    /**
     * Custom function that is called after semi-transparent mesh instances in this layer are
     * rendered. This function will receive camera index as the only argument. You can get the
     * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPostRenderTransparent = options.onPostRenderTransparent;

    /**
     * Custom function that is called before every mesh instance in this layer is rendered. It
     * is not recommended to set this function when rendering many objects every frame due to
     * performance reasons.
     *
     * @type {Function}
     */
    this.onDrawCall = options.onDrawCall;

    /**
     * Custom function that is called after the layer has been enabled. This happens when:
     *
     * - The layer is created with {@link Layer#enabled} set to true (which is the default value).
     * - {@link Layer#enabled} was changed from false to true
     * - {@link Layer#incrementCounter} was called and incremented the counter above zero.
     *
     * Useful for allocating resources this layer will use (e.g. creating render targets).
     *
     * @type {Function}
     */
    this.onEnable = options.onEnable;

    /**
     * Custom function that is called after the layer has been disabled. This happens when:
     *
     * - {@link Layer#enabled} was changed from true to false
     * - {@link Layer#decrementCounter} was called and set the counter to zero.
     *
     * @type {Function}
     */
    this.onDisable = options.onDisable;
    if (this._enabled && this.onEnable) {
      this.onEnable();
    }

    /**
     * Make this layer render the same mesh instances that another layer does instead of having
     * its own mesh instance list. Both layers must share cameras. Frustum culling is only
     * performed for one layer. Useful for rendering multiple passes using different shaders.
     *
     * @type {Layer}
     */
    this.layerReference = options.layerReference; // should use the same camera

    /**
     * @type {Function|null}
     * @ignore
     */
    this.customSortCallback = null;
    /**
     * @type {Function|null}
     * @ignore
     */
    this.customCalculateSortValues = null;

    // light hash based on the light keys
    this._lightHash = 0;
    this._lightHashDirty = false;

    // light hash based on light ids
    this._lightIdHash = 0;
    this._lightIdHashDirty = false;
    this.skipRenderAfter = Number.MAX_VALUE;
    this._skipRenderCounter = 0;
    this._renderTime = 0;
    this._forwardDrawCalls = 0;
    this._shadowDrawCalls = 0; // deprecated, not useful on a layer anymore, could be moved to camera

    this._shaderVersion = -1;
  }

  /**
   * Enable the layer. Disabled layers are skipped. Defaults to true.
   *
   * @type {boolean}
   */
  set enabled(val) {
    if (val !== this._enabled) {
      this._dirtyComposition = true;
      this._enabled = val;
      if (val) {
        this.incrementCounter();
        if (this.onEnable) this.onEnable();
      } else {
        this.decrementCounter();
        if (this.onDisable) this.onDisable();
      }
    }
  }
  get enabled() {
    return this._enabled;
  }

  /**
   * If true, the camera will clear the color buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearColorBuffer(val) {
    this._clearColorBuffer = val;
    this._dirtyComposition = true;
  }
  get clearColorBuffer() {
    return this._clearColorBuffer;
  }

  /**
   * If true, the camera will clear the depth buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearDepthBuffer(val) {
    this._clearDepthBuffer = val;
    this._dirtyComposition = true;
  }
  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }

  /**
   * If true, the camera will clear the stencil buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearStencilBuffer(val) {
    this._clearStencilBuffer = val;
    this._dirtyComposition = true;
  }
  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }

  /**
   * True if the layer contains omni or spot lights
   *
   * @type {boolean}
   * @ignore
   */
  get hasClusteredLights() {
    return this._clusteredLightsSet.size > 0;
  }

  /**
   * Returns lights used by clustered lighting in a set.
   *
   * @type {Set<import('./light.js').Light>}
   * @ignore
   */
  get clusteredLightsSet() {
    return this._clusteredLightsSet;
  }

  /**
   * Increments the usage counter of this layer. By default, layers are created with counter set
   * to 1 (if {@link Layer.enabled} is true) or 0 (if it was false). Incrementing the counter
   * from 0 to 1 will enable the layer and call {@link Layer.onEnable}. Use this function to
   * "subscribe" multiple effects to the same layer. For example, if the layer is used to render
   * a reflection texture which is used by 2 mirrors, then each mirror can call this function
   * when visible and {@link Layer.decrementCounter} if invisible. In such case the reflection
   * texture won't be updated, when there is nothing to use it, saving performance.
   *
   * @ignore
   */
  incrementCounter() {
    if (this._refCounter === 0) {
      this._enabled = true;
      if (this.onEnable) this.onEnable();
    }
    this._refCounter++;
  }

  /**
   * Decrements the usage counter of this layer. Decrementing the counter from 1 to 0 will
   * disable the layer and call {@link Layer.onDisable}. See {@link Layer#incrementCounter} for
   * more details.
   *
   * @ignore
   */
  decrementCounter() {
    if (this._refCounter === 1) {
      this._enabled = false;
      if (this.onDisable) this.onDisable();
    } else if (this._refCounter === 0) {
      Debug.warn('Trying to decrement layer counter below 0');
      return;
    }
    this._refCounter--;
  }

  /**
   * Adds an array of mesh instances to this layer.
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}.
   * @param {boolean} [skipShadowCasters] - Set it to true if you don't want these mesh instances
   * to cast shadows in this layer. Defaults to false.
   */
  addMeshInstances(meshInstances, skipShadowCasters) {
    const destMeshInstances = this.meshInstances;
    const destMeshInstancesSet = this.meshInstancesSet;

    // add mesh instances to the layer's array and the set
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (!destMeshInstancesSet.has(mi)) {
        destMeshInstances.push(mi);
        destMeshInstancesSet.add(mi);
        _tempMaterials.add(mi.material);
      }
    }

    // shadow casters
    if (!skipShadowCasters) {
      this.addShadowCasters(meshInstances);
    }

    // clear old shader variants if necessary
    if (_tempMaterials.size > 0) {
      const sceneShaderVer = this._shaderVersion;
      _tempMaterials.forEach(mat => {
        if (sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
          // skip this for materials not using variants
          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            // clear shader variants on the material and also on mesh instances that use it
            mat.clearVariants();
          }
          mat._shaderVersion = sceneShaderVer;
        }
      });
      _tempMaterials.clear();
    }
  }

  /**
   * Removes multiple mesh instances from this layer.
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}. If they were added to this layer, they will be removed.
   * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
   * removed mesh instances or if they never did cast shadows before. Defaults to false.
   */
  removeMeshInstances(meshInstances, skipShadowCasters) {
    const destMeshInstances = this.meshInstances;
    const destMeshInstancesSet = this.meshInstancesSet;

    // mesh instances
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];

      // remove from mesh instances list
      if (destMeshInstancesSet.has(mi)) {
        destMeshInstancesSet.delete(mi);
        const j = destMeshInstances.indexOf(mi);
        if (j >= 0) {
          destMeshInstances.splice(j, 1);
        }
      }
    }

    // shadow casters
    if (!skipShadowCasters) {
      this.removeShadowCasters(meshInstances);
    }
  }

  /**
   * Adds an array of mesh instances to this layer, but only as shadow casters (they will not be
   * rendered anywhere, but only cast shadows on other objects).
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}.
   */
  addShadowCasters(meshInstances) {
    const shadowCasters = this.shadowCasters;
    const shadowCastersSet = this.shadowCastersSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (mi.castShadow && !shadowCastersSet.has(mi)) {
        shadowCastersSet.add(mi);
        shadowCasters.push(mi);
      }
    }
  }

  /**
   * Removes multiple mesh instances from the shadow casters list of this layer, meaning they
   * will stop casting shadows.
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}. If they were added to this layer, they will be removed.
   */
  removeShadowCasters(meshInstances) {
    const shadowCasters = this.shadowCasters;
    const shadowCastersSet = this.shadowCastersSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (shadowCastersSet.has(mi)) {
        shadowCastersSet.delete(mi);
        const j = shadowCasters.indexOf(mi);
        if (j >= 0) {
          shadowCasters.splice(j, 1);
        }
      }
    }
  }

  /**
   * Removes all mesh instances from this layer.
   *
   * @param {boolean} [skipShadowCasters] - Set it to true if you want to continue the existing mesh
   * instances to cast shadows. Defaults to false, which removes shadow casters as well.
   */
  clearMeshInstances(skipShadowCasters = false) {
    this.meshInstances.length = 0;
    this.meshInstancesSet.clear();
    if (!skipShadowCasters) {
      this.shadowCasters.length = 0;
      this.shadowCastersSet.clear();
    }
  }
  markLightsDirty() {
    this._lightHashDirty = true;
    this._lightIdHashDirty = true;
    this._splitLightsDirty = true;
  }

  /**
   * Adds a light to this layer.
   *
   * @param {import('../framework/components/light/component.js').LightComponent} light - A
   * {@link LightComponent}.
   */
  addLight(light) {
    // if the light is not in the layer already
    const l = light.light;
    if (!this._lightsSet.has(l)) {
      this._lightsSet.add(l);
      this._lights.push(l);
      this.markLightsDirty();
    }
    if (l.type !== LIGHTTYPE_DIRECTIONAL) {
      this._clusteredLightsSet.add(l);
    }
  }

  /**
   * Removes a light from this layer.
   *
   * @param {import('../framework/components/light/component.js').LightComponent} light - A
   * {@link LightComponent}.
   */
  removeLight(light) {
    const l = light.light;
    if (this._lightsSet.has(l)) {
      this._lightsSet.delete(l);
      this._lights.splice(this._lights.indexOf(l), 1);
      this.markLightsDirty();
    }
    if (l.type !== LIGHTTYPE_DIRECTIONAL) {
      this._clusteredLightsSet.delete(l);
    }
  }

  /**
   * Removes all lights from this layer.
   */
  clearLights() {
    // notify lights
    this._lightsSet.forEach(light => light.removeLayer(this));
    this._lightsSet.clear();
    this._clusteredLightsSet.clear();
    this._lights.length = 0;
    this.markLightsDirty();
  }
  get splitLights() {
    if (this._splitLightsDirty) {
      this._splitLightsDirty = false;
      const splitLights = this._splitLights;
      for (let i = 0; i < splitLights.length; i++) splitLights[i].length = 0;
      const lights = this._lights;
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        if (light.enabled) {
          splitLights[light._type].push(light);
        }
      }

      // sort the lights by their key, as the order of lights is used to generate shader generation key,
      // and this avoids new shaders being generated when lights are reordered
      for (let i = 0; i < splitLights.length; i++) splitLights[i].sort((a, b) => a.key - b.key);
    }
    return this._splitLights;
  }
  evaluateLightHash(localLights, directionalLights, useIds) {
    let hash = 0;

    // select local/directional lights based on request
    const lights = this._lights;
    for (let i = 0; i < lights.length; i++) {
      const isLocalLight = lights[i].type !== LIGHTTYPE_DIRECTIONAL;
      if (localLights && isLocalLight || directionalLights && !isLocalLight) {
        lightKeys.push(useIds ? lights[i].id : lights[i].key);
      }
    }
    if (lightKeys.length > 0) {
      // sort the keys to make sure the hash is the same for the same set of lights
      lightKeys.sort();
      hash = hash32Fnv1a(lightKeys);
      lightKeys.length = 0;
    }
    return hash;
  }
  getLightHash(isClustered) {
    if (this._lightHashDirty) {
      this._lightHashDirty = false;

      // Generate hash to check if layers have the same set of lights independent of their order.
      // Always use directional lights. Additionally use local lights if clustered lighting is disabled.
      // (only directional lights affect the shader generation for clustered lighting)
      this._lightHash = this.evaluateLightHash(!isClustered, true, false);
    }
    return this._lightHash;
  }

  // This is only used in clustered lighting mode
  getLightIdHash() {
    if (this._lightIdHashDirty) {
      this._lightIdHashDirty = false;

      // Generate hash based on Ids of lights sorted by ids, to check if the layers have the same set of lights
      // Only use local lights (directional lights are not used for clustered lighting)
      this._lightIdHash = this.evaluateLightHash(true, false, true);
    }
    return this._lightIdHash;
  }

  /**
   * Adds a camera to this layer.
   *
   * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
   * {@link CameraComponent}.
   */
  addCamera(camera) {
    if (!this.camerasSet.has(camera.camera)) {
      this.camerasSet.add(camera.camera);
      this.cameras.push(camera);
      this._dirtyComposition = true;
    }
  }

  /**
   * Removes a camera from this layer.
   *
   * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
   * {@link CameraComponent}.
   */
  removeCamera(camera) {
    if (this.camerasSet.has(camera.camera)) {
      this.camerasSet.delete(camera.camera);
      const index = this.cameras.indexOf(camera);
      this.cameras.splice(index, 1);
      this._dirtyComposition = true;
    }
  }

  /**
   * Removes all cameras from this layer.
   */
  clearCameras() {
    this.cameras.length = 0;
    this.camerasSet.clear();
    this._dirtyComposition = true;
  }

  /**
   * @param {import('./mesh-instance.js').MeshInstance[]} drawCalls - Array of mesh instances.
   * @param {number} drawCallsCount - Number of mesh instances.
   * @param {import('../core/math/vec3.js').Vec3} camPos - Camera position.
   * @param {import('../core/math/vec3.js').Vec3} camFwd - Camera forward vector.
   * @private
   */
  _calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.layer <= LAYER_FX) continue; // Only alpha sort mesh instances in the main world (backwards comp)
      if (drawCall.calculateSortDistance) {
        drawCall.zdist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
        continue;
      }
      const meshPos = drawCall.aabb.center;
      const tempx = meshPos.x - camPos.x;
      const tempy = meshPos.y - camPos.y;
      const tempz = meshPos.z - camPos.z;
      drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
    }
  }

  /**
   * Get access to culled mesh instances for the provided camera.
   *
   * @param {import('./camera.js').Camera} camera - The camera.
   * @returns {CulledInstances} The culled mesh instances.
   * @ignore
   */
  getCulledInstances(camera) {
    let instances = this._visibleInstances.get(camera);
    if (!instances) {
      instances = new CulledInstances();
      this._visibleInstances.set(camera, instances);
    }
    return instances;
  }

  /**
   * @param {import('./camera.js').Camera} camera - The camera to sort the visible mesh instances
   * for.
   * @param {boolean} transparent - True if transparent sorting should be used.
   * @ignore
   */
  sortVisible(camera, transparent) {
    const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
    if (sortMode === SORTMODE_NONE) return;
    const culledInstances = this.getCulledInstances(camera);
    const instances = transparent ? culledInstances.transparent : culledInstances.opaque;
    const cameraNode = camera.node;
    if (sortMode === SORTMODE_CUSTOM) {
      const sortPos = cameraNode.getPosition();
      const sortDir = cameraNode.forward;
      if (this.customCalculateSortValues) {
        this.customCalculateSortValues(instances, instances.length, sortPos, sortDir);
      }
      if (this.customSortCallback) {
        instances.sort(this.customSortCallback);
      }
    } else {
      if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
        const sortPos = cameraNode.getPosition();
        const sortDir = cameraNode.forward;
        this._calculateSortDistances(instances, instances.length, sortPos, sortDir);
      }
      instances.sort(sortCallbacks[sortMode]);
    }
  }
}

export { CulledInstances, Layer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9sYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgaGFzaDMyRm52MWEgfSBmcm9tICcuLi9jb3JlL2hhc2guanMnO1xuXG5pbXBvcnQge1xuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMQVlFUl9GWCxcbiAgICBTSEFERVJfRk9SV0FSRCxcbiAgICBTT1JUS0VZX0ZPUldBUkQsXG4gICAgU09SVE1PREVfQkFDSzJGUk9OVCwgU09SVE1PREVfQ1VTVE9NLCBTT1JUTU9ERV9GUk9OVDJCQUNLLCBTT1JUTU9ERV9NQVRFUklBTE1FU0gsIFNPUlRNT0RFX05PTkVcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuL21hdGVyaWFscy9tYXRlcmlhbC5qcyc7XG5cbmZ1bmN0aW9uIHNvcnRNYW51YWwoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG59XG5cbmZ1bmN0aW9uIHNvcnRNYXRlcmlhbE1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICBjb25zdCBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBjb25zdCBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICB9XG4gICAgcmV0dXJuIGtleUIgLSBrZXlBO1xufVxuXG5mdW5jdGlvbiBzb3J0QmFja1RvRnJvbnQoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0O1xufVxuXG5mdW5jdGlvbiBzb3J0RnJvbnRUb0JhY2soZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0IC0gZHJhd0NhbGxCLnpkaXN0O1xufVxuXG5jb25zdCBzb3J0Q2FsbGJhY2tzID0gW251bGwsIHNvcnRNYW51YWwsIHNvcnRNYXRlcmlhbE1lc2gsIHNvcnRCYWNrVG9Gcm9udCwgc29ydEZyb250VG9CYWNrXTtcblxuLy8gTGF5ZXJzXG5sZXQgbGF5ZXJDb3VudGVyID0gMDtcblxuY29uc3QgbGlnaHRLZXlzID0gW107XG5jb25zdCBfdGVtcE1hdGVyaWFscyA9IG5ldyBTZXQoKTtcblxuY2xhc3MgQ3VsbGVkSW5zdGFuY2VzIHtcbiAgICAvKipcbiAgICAgKiBWaXNpYmxlIG9wYXF1ZSBtZXNoIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfVxuICAgICAqL1xuICAgIG9wYXF1ZSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogVmlzaWJsZSB0cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfVxuICAgICAqL1xuICAgIHRyYW5zcGFyZW50ID0gW107XG59XG5cbi8qKlxuICogQSBMYXllciByZXByZXNlbnRzIGEgcmVuZGVyYWJsZSBzdWJzZXQgb2YgdGhlIHNjZW5lLiBJdCBjYW4gY29udGFpbiBhIGxpc3Qgb2YgbWVzaCBpbnN0YW5jZXMsXG4gKiBsaWdodHMgYW5kIGNhbWVyYXMsIHRoZWlyIHJlbmRlciBzZXR0aW5ncyBhbmQgYWxzbyBkZWZpbmVzIGN1c3RvbSBjYWxsYmFja3MgYmVmb3JlLCBhZnRlciBvclxuICogZHVyaW5nIHJlbmRlcmluZy4gTGF5ZXJzIGFyZSBvcmdhbml6ZWQgaW5zaWRlIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSBpbiBhIGRlc2lyZWQgb3JkZXIuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIExheWVyIHtcbiAgICAvKipcbiAgICAgKiBNZXNoIGluc3RhbmNlcyBhc3NpZ25lZCB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG1lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIE1lc2ggaW5zdGFuY2VzIGFzc2lnbmVkIHRvIHRoaXMgbGF5ZXIsIHN0b3JlZCBpbiBhIHNldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2U+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtZXNoSW5zdGFuY2VzU2V0ID0gbmV3IFNldCgpO1xuXG4gICAgLyoqXG4gICAgICogU2hhZG93IGNhc3RpbmcgaW5zdGFuY2VzIGFzc2lnbmVkIHRvIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2hhZG93Q2FzdGVycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogU2hhZG93IGNhc3RpbmcgaW5zdGFuY2VzIGFzc2lnbmVkIHRvIHRoaXMgbGF5ZXIsIHN0b3JlZCBpbiBhIHNldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2U+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzaGFkb3dDYXN0ZXJzU2V0ID0gbmV3IFNldCgpO1xuXG4gICAgLyoqXG4gICAgICogVmlzaWJsZSAoY3VsbGVkKSBtZXNoIGluc3RhbmNlcyBhc3NpZ25lZCB0byB0aGlzIGxheWVyLiBMb29rZWQgdXAgYnkgdGhlIENhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWFrTWFwPGltcG9ydCgnLi9jYW1lcmEuanMnKS5DYW1lcmEsIEN1bGxlZEluc3RhbmNlcz59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdmlzaWJsZUluc3RhbmNlcyA9IG5ldyBXZWFrTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBBbGwgbGlnaHRzIGFzc2lnbmVkIHRvIGEgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9saWdodHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFsbCBsaWdodHMgYXNzaWduZWQgdG8gYSBsYXllciBzdG9yZWQgaW4gYSBzZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgX2xpZ2h0c1NldCA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIFNldCBvZiBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZyAob21uaSBhbmQgc3BvdCwgYnV0IG5vIGRpcmVjdGlvbmFsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHQ+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NsdXN0ZXJlZExpZ2h0c1NldCA9IG5ldyBTZXQoKTtcblxuICAgIC8qKlxuICAgICAqIExpZ2h0cyBzZXBhcmF0ZWQgYnkgbGlnaHQgdHlwZS4gTGlnaHRzIGluIHRoZSBpbmRpdmlkdWFsIGFycmF5cyBhcmUgc29ydGVkIGJ5IHRoZSBrZXksXG4gICAgICogdG8gbWF0Y2ggdGhlaXIgb3JkZXIgaW4gX2xpZ2h0SWRIYXNoLCBzbyB0aGF0IHRoZWlyIG9yZGVyIG1hdGNoZXMgdGhlIG9yZGVyIGV4cGVjdGVkIGJ5IHRoZVxuICAgICAqIGdlbmVyYXRlZCBzaGFkZXIgY29kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodFtdW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3BsaXRMaWdodHMgPSBbW10sIFtdLCBbXV07XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIF9zcGxpdExpZ2h0cyBuZWVkcyB0byBiZSB1cGRhdGVkLCB3aGljaCBtZWFucyBpZiBsaWdodHMgd2VyZSBhZGRlZCBvciByZW1vdmVkIGZyb21cbiAgICAgKiB0aGUgbGF5ZXIsIG9yIHRoZWlyIGtleSBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3BsaXRMaWdodHNEaXJ0eSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBvYmplY3RzIHJlbmRlcmVkIG9uIHRoZSBsYXllciByZXF1aXJlIGxpZ2h0IGN1YmUgKGVtaXR0ZXJzIHdpdGggbGlnaHRpbmcgZG8pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlcXVpcmVzTGlnaHRDdWJlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50W119XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNhbWVyYXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL2NhbWVyYS5qcycpLkNhbWVyYT59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNhbWVyYXNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBjb21wb3NpdGlvbiBpcyBpbnZhbGlkYXRlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfZGlydHlDb21wb3NpdGlvbiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExheWVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLiBUaGVzZSBhcmd1bWVudHMgYXJlIHRoZVxuICAgICAqIHNhbWUgYXMgcHJvcGVydGllcyBvZiB0aGUgTGF5ZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBBIHVuaXF1ZSBJRCBvZiB0aGUgbGF5ZXIuIExheWVyIElEcyBhcmUgc3RvcmVkIGluc2lkZSB7QGxpbmsgTW9kZWxDb21wb25lbnQjbGF5ZXJzfSxcbiAgICAgICAgICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjbGF5ZXJzfSwge0BsaW5rIENhbWVyYUNvbXBvbmVudCNsYXllcnN9LFxuICAgICAgICAgICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50I2xheWVyc30gYW5kIHtAbGluayBFbGVtZW50Q29tcG9uZW50I2xheWVyc30gaW5zdGVhZCBvZiBuYW1lcy5cbiAgICAgICAgICAgICAqIENhbiBiZSB1c2VkIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2dldExheWVyQnlJZH0uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pZCA9IG9wdGlvbnMuaWQ7XG4gICAgICAgICAgICBsYXllckNvdW50ZXIgPSBNYXRoLm1heCh0aGlzLmlkICsgMSwgbGF5ZXJDb3VudGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBsYXllckNvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBOYW1lIG9mIHRoZSBsYXllci4gQ2FuIGJlIHVzZWQgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jZ2V0TGF5ZXJCeU5hbWV9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSBvcHRpb25zLmVuYWJsZWQgPz8gdHJ1ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9yZWZDb3VudGVyID0gdGhpcy5fZW5hYmxlZCA/IDEgOiAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZpbmVzIHRoZSBtZXRob2QgdXNlZCBmb3Igc29ydGluZyBvcGFxdWUgKHRoYXQgaXMsIG5vdCBzZW1pLXRyYW5zcGFyZW50KSBtZXNoXG4gICAgICAgICAqIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3BhcXVlU29ydE1vZGUgPSBvcHRpb25zLm9wYXF1ZVNvcnRNb2RlID8/IFNPUlRNT0RFX01BVEVSSUFMTUVTSDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50U29ydE1vZGUgPSBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGUgPz8gU09SVE1PREVfQkFDSzJGUk9OVDtcblxuICAgICAgICBpZiAob3B0aW9ucy5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gb3B0aW9ucy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQSB0eXBlIG9mIHNoYWRlciB0byB1c2UgZHVyaW5nIHJlbmRlcmluZy4gUG9zc2libGUgdmFsdWVzIGFyZTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgU0hBREVSX0ZPUldBUkR9XG4gICAgICAgICAqIC0ge0BsaW5rIFNIQURFUl9GT1JXQVJESERSfVxuICAgICAgICAgKiAtIHtAbGluayBTSEFERVJfREVQVEh9XG4gICAgICAgICAqIC0gWW91ciBvd24gY3VzdG9tIHZhbHVlLiBTaG91bGQgYmUgaW4gMTkgLSAzMSByYW5nZS4gVXNlIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfVxuICAgICAgICAgKiB0byBhcHBseSBzaGFkZXIgbW9kaWZpY2F0aW9ucyBiYXNlZCBvbiB0aGlzIHZhbHVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU0hBREVSX0ZPUldBUkR9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGFkZXJQYXNzID0gb3B0aW9ucy5zaGFkZXJQYXNzID8/IFNIQURFUl9GT1JXQVJEO1xuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJDb2xvckJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gISFvcHRpb25zLmNsZWFyRGVwdGhCdWZmZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gISFvcHRpb25zLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSB2aXNpYmlsaXR5IGN1bGxpbmcgaXMgcGVyZm9ybWVkIGZvciB0aGlzIGxheWVyLlxuICAgICAgICAgKiBVc2VmdWwsIGZvciBleGFtcGxlLCBpZiB5b3Ugd2FudCB0byBtb2RpZnkgY2FtZXJhIHByb2plY3Rpb24gd2hpbGUgc3RpbGwgdXNpbmcgdGhlIHNhbWVcbiAgICAgICAgICogY2FtZXJhIGFuZCBtYWtlIGZydXN0dW0gY3VsbGluZyB3b3JrIGNvcnJlY3RseSB3aXRoIGl0IChzZWVcbiAgICAgICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudCNjYWxjdWxhdGVUcmFuc2Zvcm19IGFuZCB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVByb2plY3Rpb259KS5cbiAgICAgICAgICogVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsXG4gICAgICAgICAqIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlQ3VsbCA9IG9wdGlvbnMub25QcmVDdWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIFVzZWZ1bCwgZm9yIGV4YW1wbGUsIGZvclxuICAgICAgICAgKiByZWFjdGluZyBvbiBzY3JlZW4gc2l6ZSBjaGFuZ2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2ZcbiAgICAgICAgICogdGhpcyBsYXllciBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uIEl0IHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHlcbiAgICAgICAgICogYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXIgPSBvcHRpb25zLm9uUHJlUmVuZGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIG9wYXF1ZSBtZXNoIGluc3RhbmNlcyAobm90IHNlbWktdHJhbnNwYXJlbnQpIGluXG4gICAgICAgICAqIHRoaXMgbGF5ZXIgYXJlIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuXG4gICAgICAgICAqIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfVxuICAgICAgICAgKiB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXJPcGFxdWUgPSBvcHRpb25zLm9uUHJlUmVuZGVyT3BhcXVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMgaW4gdGhpcyBsYXllciBhcmVcbiAgICAgICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlXG4gICAgICAgICAqIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblByZVJlbmRlclRyYW5zcGFyZW50ID0gb3B0aW9ucy5vblByZVJlbmRlclRyYW5zcGFyZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdmlzaWJpbGl0eSBjdWxsaW5nIGlzIHBlcmZvcm1lZCBmb3IgdGhpcyBsYXllci5cbiAgICAgICAgICogVXNlZnVsIGZvciByZXZlcnRpbmcgY2hhbmdlcyBkb25lIGluIHtAbGluayBMYXllciNvblByZUN1bGx9IGFuZCBkZXRlcm1pbmluZyBmaW5hbCBtZXNoXG4gICAgICAgICAqIGluc3RhbmNlIHZpc2liaWxpdHkgKHNlZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGVUaGlzRnJhbWV9KS4gVGhpcyBmdW5jdGlvbiB3aWxsXG4gICAgICAgICAqIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5XG4gICAgICAgICAqIGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdEN1bGwgPSBvcHRpb25zLm9uUG9zdEN1bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBVc2VmdWwgdG8gcmV2ZXJ0IGNoYW5nZXNcbiAgICAgICAgICogbWFkZSBpbiB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBhZnRlciB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIHRoaXNcbiAgICAgICAgICogbGF5ZXIgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb259LiBJdCB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlciA9IG9wdGlvbnMub25Qb3N0UmVuZGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgb3BhcXVlIG1lc2ggaW5zdGFuY2VzIChub3Qgc2VtaS10cmFuc3BhcmVudCkgaW5cbiAgICAgICAgICogdGhpcyBsYXllciBhcmUgcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC5cbiAgICAgICAgICogWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9XG4gICAgICAgICAqIHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RSZW5kZXJPcGFxdWUgPSBvcHRpb25zLm9uUG9zdFJlbmRlck9wYXF1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMgaW4gdGhpcyBsYXllciBhcmVcbiAgICAgICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlXG4gICAgICAgICAqIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RSZW5kZXJUcmFuc3BhcmVudCA9IG9wdGlvbnMub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgZXZlcnkgbWVzaCBpbnN0YW5jZSBpbiB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBJdFxuICAgICAgICAgKiBpcyBub3QgcmVjb21tZW5kZWQgdG8gc2V0IHRoaXMgZnVuY3Rpb24gd2hlbiByZW5kZXJpbmcgbWFueSBvYmplY3RzIGV2ZXJ5IGZyYW1lIGR1ZSB0b1xuICAgICAgICAgKiBwZXJmb3JtYW5jZSByZWFzb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRHJhd0NhbGwgPSBvcHRpb25zLm9uRHJhd0NhbGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgbGF5ZXIgaGFzIGJlZW4gZW5hYmxlZC4gVGhpcyBoYXBwZW5zIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gVGhlIGxheWVyIGlzIGNyZWF0ZWQgd2l0aCB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gc2V0IHRvIHRydWUgKHdoaWNoIGlzIHRoZSBkZWZhdWx0IHZhbHVlKS5cbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gd2FzIGNoYW5nZWQgZnJvbSBmYWxzZSB0byB0cnVlXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2luY3JlbWVudENvdW50ZXJ9IHdhcyBjYWxsZWQgYW5kIGluY3JlbWVudGVkIHRoZSBjb3VudGVyIGFib3ZlIHplcm8uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVzZWZ1bCBmb3IgYWxsb2NhdGluZyByZXNvdXJjZXMgdGhpcyBsYXllciB3aWxsIHVzZSAoZS5nLiBjcmVhdGluZyByZW5kZXIgdGFyZ2V0cykuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25FbmFibGUgPSBvcHRpb25zLm9uRW5hYmxlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGxheWVyIGhhcyBiZWVuIGRpc2FibGVkLiBUaGlzIGhhcHBlbnMgd2hlbjpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gd2FzIGNoYW5nZWQgZnJvbSB0cnVlIHRvIGZhbHNlXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2RlY3JlbWVudENvdW50ZXJ9IHdhcyBjYWxsZWQgYW5kIHNldCB0aGUgY291bnRlciB0byB6ZXJvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSA9IG9wdGlvbnMub25EaXNhYmxlO1xuXG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICYmIHRoaXMub25FbmFibGUpIHtcbiAgICAgICAgICAgIHRoaXMub25FbmFibGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWtlIHRoaXMgbGF5ZXIgcmVuZGVyIHRoZSBzYW1lIG1lc2ggaW5zdGFuY2VzIHRoYXQgYW5vdGhlciBsYXllciBkb2VzIGluc3RlYWQgb2YgaGF2aW5nXG4gICAgICAgICAqIGl0cyBvd24gbWVzaCBpbnN0YW5jZSBsaXN0LiBCb3RoIGxheWVycyBtdXN0IHNoYXJlIGNhbWVyYXMuIEZydXN0dW0gY3VsbGluZyBpcyBvbmx5XG4gICAgICAgICAqIHBlcmZvcm1lZCBmb3Igb25lIGxheWVyLiBVc2VmdWwgZm9yIHJlbmRlcmluZyBtdWx0aXBsZSBwYXNzZXMgdXNpbmcgZGlmZmVyZW50IHNoYWRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtMYXllcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubGF5ZXJSZWZlcmVuY2UgPSBvcHRpb25zLmxheWVyUmVmZXJlbmNlOyAvLyBzaG91bGQgdXNlIHRoZSBzYW1lIGNhbWVyYVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb258bnVsbH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2sgPSBudWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufG51bGx9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyA9IG51bGw7XG5cbiAgICAgICAgLy8gbGlnaHQgaGFzaCBiYXNlZCBvbiB0aGUgbGlnaHQga2V5c1xuICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICB0aGlzLl9saWdodEhhc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGxpZ2h0IGhhc2ggYmFzZWQgb24gbGlnaHQgaWRzXG4gICAgICAgIHRoaXMuX2xpZ2h0SWRIYXNoID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRJZEhhc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5za2lwUmVuZGVyQWZ0ZXIgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICB0aGlzLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG5cbiAgICAgICAgdGhpcy5fcmVuZGVyVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkb3dEcmF3Q2FsbHMgPSAwOyAgLy8gZGVwcmVjYXRlZCwgbm90IHVzZWZ1bCBvbiBhIGxheWVyIGFueW1vcmUsIGNvdWxkIGJlIG1vdmVkIHRvIGNhbWVyYVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLl9zaGFkZXJWZXJzaW9uID0gLTE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHRoZSBsYXllci4gRGlzYWJsZWQgbGF5ZXJzIGFyZSBza2lwcGVkLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGVuYWJsZWQodmFsKSB7XG4gICAgICAgIGlmICh2YWwgIT09IHRoaXMuX2VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbDtcbiAgICAgICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkVuYWJsZSkgdGhpcy5vbkVuYWJsZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkRpc2FibGUpIHRoaXMub25EaXNhYmxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgd2hlbiBpdCByZW5kZXJzIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJDb2xvckJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9IHZhbDtcbiAgICAgICAgdGhpcy5fZGlydHlDb21wb3NpdGlvbiA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckNvbG9yQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgZGVwdGggYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIodmFsKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXIgPSB2YWw7XG4gICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNvbXBvc2l0aW9uID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJTdGVuY2lsQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGxheWVyIGNvbnRhaW5zIG9tbmkgb3Igc3BvdCBsaWdodHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgaGFzQ2x1c3RlcmVkTGlnaHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LnNpemUgPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgbGlnaHRzIHVzZWQgYnkgY2x1c3RlcmVkIGxpZ2h0aW5nIGluIGEgc2V0LlxuICAgICAqXG4gICAgICogQHR5cGUge1NldDxpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBjbHVzdGVyZWRMaWdodHNTZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5jcmVtZW50cyB0aGUgdXNhZ2UgY291bnRlciBvZiB0aGlzIGxheWVyLiBCeSBkZWZhdWx0LCBsYXllcnMgYXJlIGNyZWF0ZWQgd2l0aCBjb3VudGVyIHNldFxuICAgICAqIHRvIDEgKGlmIHtAbGluayBMYXllci5lbmFibGVkfSBpcyB0cnVlKSBvciAwIChpZiBpdCB3YXMgZmFsc2UpLiBJbmNyZW1lbnRpbmcgdGhlIGNvdW50ZXJcbiAgICAgKiBmcm9tIDAgdG8gMSB3aWxsIGVuYWJsZSB0aGUgbGF5ZXIgYW5kIGNhbGwge0BsaW5rIExheWVyLm9uRW5hYmxlfS4gVXNlIHRoaXMgZnVuY3Rpb24gdG9cbiAgICAgKiBcInN1YnNjcmliZVwiIG11bHRpcGxlIGVmZmVjdHMgdG8gdGhlIHNhbWUgbGF5ZXIuIEZvciBleGFtcGxlLCBpZiB0aGUgbGF5ZXIgaXMgdXNlZCB0byByZW5kZXJcbiAgICAgKiBhIHJlZmxlY3Rpb24gdGV4dHVyZSB3aGljaCBpcyB1c2VkIGJ5IDIgbWlycm9ycywgdGhlbiBlYWNoIG1pcnJvciBjYW4gY2FsbCB0aGlzIGZ1bmN0aW9uXG4gICAgICogd2hlbiB2aXNpYmxlIGFuZCB7QGxpbmsgTGF5ZXIuZGVjcmVtZW50Q291bnRlcn0gaWYgaW52aXNpYmxlLiBJbiBzdWNoIGNhc2UgdGhlIHJlZmxlY3Rpb25cbiAgICAgKiB0ZXh0dXJlIHdvbid0IGJlIHVwZGF0ZWQsIHdoZW4gdGhlcmUgaXMgbm90aGluZyB0byB1c2UgaXQsIHNhdmluZyBwZXJmb3JtYW5jZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbmNyZW1lbnRDb3VudGVyKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVmQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICBpZiAodGhpcy5vbkVuYWJsZSkgdGhpcy5vbkVuYWJsZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlZkNvdW50ZXIrKztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWNyZW1lbnRzIHRoZSB1c2FnZSBjb3VudGVyIG9mIHRoaXMgbGF5ZXIuIERlY3JlbWVudGluZyB0aGUgY291bnRlciBmcm9tIDEgdG8gMCB3aWxsXG4gICAgICogZGlzYWJsZSB0aGUgbGF5ZXIgYW5kIGNhbGwge0BsaW5rIExheWVyLm9uRGlzYWJsZX0uIFNlZSB7QGxpbmsgTGF5ZXIjaW5jcmVtZW50Q291bnRlcn0gZm9yXG4gICAgICogbW9yZSBkZXRhaWxzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlY3JlbWVudENvdW50ZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5vbkRpc2FibGUpIHRoaXMub25EaXNhYmxlKCk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdUcnlpbmcgdG8gZGVjcmVtZW50IGxheWVyIGNvdW50ZXIgYmVsb3cgMCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlZkNvdW50ZXItLTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzIHRvIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBBcnJheSBvZlxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2V9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NraXBTaGFkb3dDYXN0ZXJzXSAtIFNldCBpdCB0byB0cnVlIGlmIHlvdSBkb24ndCB3YW50IHRoZXNlIG1lc2ggaW5zdGFuY2VzXG4gICAgICogdG8gY2FzdCBzaGFkb3dzIGluIHRoaXMgbGF5ZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqL1xuICAgIGFkZE1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcywgc2tpcFNoYWRvd0Nhc3RlcnMpIHtcblxuICAgICAgICBjb25zdCBkZXN0TWVzaEluc3RhbmNlcyA9IHRoaXMubWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgZGVzdE1lc2hJbnN0YW5jZXNTZXQgPSB0aGlzLm1lc2hJbnN0YW5jZXNTZXQ7XG5cbiAgICAgICAgLy8gYWRkIG1lc2ggaW5zdGFuY2VzIHRvIHRoZSBsYXllcidzIGFycmF5IGFuZCB0aGUgc2V0XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWkgPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgaWYgKCFkZXN0TWVzaEluc3RhbmNlc1NldC5oYXMobWkpKSB7XG4gICAgICAgICAgICAgICAgZGVzdE1lc2hJbnN0YW5jZXMucHVzaChtaSk7XG4gICAgICAgICAgICAgICAgZGVzdE1lc2hJbnN0YW5jZXNTZXQuYWRkKG1pKTtcbiAgICAgICAgICAgICAgICBfdGVtcE1hdGVyaWFscy5hZGQobWkubWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc3RlcnNcbiAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycykge1xuICAgICAgICAgICAgdGhpcy5hZGRTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xlYXIgb2xkIHNoYWRlciB2YXJpYW50cyBpZiBuZWNlc3NhcnlcbiAgICAgICAgaWYgKF90ZW1wTWF0ZXJpYWxzLnNpemUgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZVNoYWRlclZlciA9IHRoaXMuX3NoYWRlclZlcnNpb247XG4gICAgICAgICAgICBfdGVtcE1hdGVyaWFscy5mb3JFYWNoKChtYXQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc2NlbmVTaGFkZXJWZXIgPj0gMCAmJiBtYXQuX3NoYWRlclZlcnNpb24gIT09IHNjZW5lU2hhZGVyVmVyKSAge1xuICAgICAgICAgICAgICAgICAgICAvLyBza2lwIHRoaXMgZm9yIG1hdGVyaWFscyBub3QgdXNpbmcgdmFyaWFudHNcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBtYXQuX3NoYWRlclZlcnNpb24gPSBzY2VuZVNoYWRlclZlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF90ZW1wTWF0ZXJpYWxzLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIG11bHRpcGxlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZX0uIElmIHRoZXkgd2VyZSBhZGRlZCB0byB0aGlzIGxheWVyLCB0aGV5IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3Ugd2FudCB0byBzdGlsbCBjYXN0IHNoYWRvd3MgZnJvbVxuICAgICAqIHJlbW92ZWQgbWVzaCBpbnN0YW5jZXMgb3IgaWYgdGhleSBuZXZlciBkaWQgY2FzdCBzaGFkb3dzIGJlZm9yZS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICovXG4gICAgcmVtb3ZlTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzLCBza2lwU2hhZG93Q2FzdGVycykge1xuXG4gICAgICAgIGNvbnN0IGRlc3RNZXNoSW5zdGFuY2VzID0gdGhpcy5tZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBkZXN0TWVzaEluc3RhbmNlc1NldCA9IHRoaXMubWVzaEluc3RhbmNlc1NldDtcblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1pID0gbWVzaEluc3RhbmNlc1tpXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbWVzaCBpbnN0YW5jZXMgbGlzdFxuICAgICAgICAgICAgaWYgKGRlc3RNZXNoSW5zdGFuY2VzU2V0LmhhcyhtaSkpIHtcbiAgICAgICAgICAgICAgICBkZXN0TWVzaEluc3RhbmNlc1NldC5kZWxldGUobWkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGogPSBkZXN0TWVzaEluc3RhbmNlcy5pbmRleE9mKG1pKTtcbiAgICAgICAgICAgICAgICBpZiAoaiA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RNZXNoSW5zdGFuY2VzLnNwbGljZShqLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZVNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzIHRvIHRoaXMgbGF5ZXIsIGJ1dCBvbmx5IGFzIHNoYWRvdyBjYXN0ZXJzICh0aGV5IHdpbGwgbm90IGJlXG4gICAgICogcmVuZGVyZWQgYW55d2hlcmUsIGJ1dCBvbmx5IGNhc3Qgc2hhZG93cyBvbiBvdGhlciBvYmplY3RzKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZX0uXG4gICAgICovXG4gICAgYWRkU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IHNoYWRvd0Nhc3RlcnMgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG4gICAgICAgIGNvbnN0IHNoYWRvd0Nhc3RlcnNTZXQgPSB0aGlzLnNoYWRvd0Nhc3RlcnNTZXQ7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtaSA9IG1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICBpZiAobWkuY2FzdFNoYWRvdyAmJiAhc2hhZG93Q2FzdGVyc1NldC5oYXMobWkpKSB7XG4gICAgICAgICAgICAgICAgc2hhZG93Q2FzdGVyc1NldC5hZGQobWkpO1xuICAgICAgICAgICAgICAgIHNoYWRvd0Nhc3RlcnMucHVzaChtaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIG11bHRpcGxlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNoYWRvdyBjYXN0ZXJzIGxpc3Qgb2YgdGhpcyBsYXllciwgbWVhbmluZyB0aGV5XG4gICAgICogd2lsbCBzdG9wIGNhc3Rpbmcgc2hhZG93cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZX0uIElmIHRoZXkgd2VyZSBhZGRlZCB0byB0aGlzIGxheWVyLCB0aGV5IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICAgKi9cbiAgICByZW1vdmVTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FzdGVycyA9IHRoaXMuc2hhZG93Q2FzdGVycztcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FzdGVyc1NldCA9IHRoaXMuc2hhZG93Q2FzdGVyc1NldDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1pID0gbWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgIGlmIChzaGFkb3dDYXN0ZXJzU2V0LmhhcyhtaSkpIHtcbiAgICAgICAgICAgICAgICBzaGFkb3dDYXN0ZXJzU2V0LmRlbGV0ZShtaSk7XG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IHNoYWRvd0Nhc3RlcnMuaW5kZXhPZihtaSk7XG4gICAgICAgICAgICAgICAgaWYgKGogPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICBzaGFkb3dDYXN0ZXJzLnNwbGljZShqLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBtZXNoIGluc3RhbmNlcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3Ugd2FudCB0byBjb250aW51ZSB0aGUgZXhpc3RpbmcgbWVzaFxuICAgICAqIGluc3RhbmNlcyB0byBjYXN0IHNoYWRvd3MuIERlZmF1bHRzIHRvIGZhbHNlLCB3aGljaCByZW1vdmVzIHNoYWRvdyBjYXN0ZXJzIGFzIHdlbGwuXG4gICAgICovXG4gICAgY2xlYXJNZXNoSW5zdGFuY2VzKHNraXBTaGFkb3dDYXN0ZXJzID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlc1NldC5jbGVhcigpO1xuXG4gICAgICAgIGlmICghc2tpcFNoYWRvd0Nhc3RlcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzdGVycy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dDYXN0ZXJzU2V0LmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXJrTGlnaHRzRGlydHkoKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0SGFzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbGlnaHRJZEhhc2hEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzRGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBsaWdodCB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcycpLkxpZ2h0Q29tcG9uZW50fSBsaWdodCAtIEFcbiAgICAgKiB7QGxpbmsgTGlnaHRDb21wb25lbnR9LlxuICAgICAqL1xuICAgIGFkZExpZ2h0KGxpZ2h0KSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIGxpZ2h0IGlzIG5vdCBpbiB0aGUgbGF5ZXIgYWxyZWFkeVxuICAgICAgICBjb25zdCBsID0gbGlnaHQubGlnaHQ7XG4gICAgICAgIGlmICghdGhpcy5fbGlnaHRzU2V0LmhhcyhsKSkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmFkZChsKTtcblxuICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnB1c2gobCk7XG4gICAgICAgICAgICB0aGlzLm1hcmtMaWdodHNEaXJ0eSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGwudHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuYWRkKGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxpZ2h0IGZyb20gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9saWdodC9jb21wb25lbnQuanMnKS5MaWdodENvbXBvbmVudH0gbGlnaHQgLSBBXG4gICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50fS5cbiAgICAgKi9cbiAgICByZW1vdmVMaWdodChsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGwgPSBsaWdodC5saWdodDtcbiAgICAgICAgaWYgKHRoaXMuX2xpZ2h0c1NldC5oYXMobCkpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0c1NldC5kZWxldGUobCk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0cy5zcGxpY2UodGhpcy5fbGlnaHRzLmluZGV4T2YobCksIDEpO1xuICAgICAgICAgICAgdGhpcy5tYXJrTGlnaHRzRGlydHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsLnR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LmRlbGV0ZShsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGxpZ2h0cyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICovXG4gICAgY2xlYXJMaWdodHMoKSB7XG5cbiAgICAgICAgLy8gbm90aWZ5IGxpZ2h0c1xuICAgICAgICB0aGlzLl9saWdodHNTZXQuZm9yRWFjaChsaWdodCA9PiBsaWdodC5yZW1vdmVMYXllcih0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5tYXJrTGlnaHRzRGlydHkoKTtcbiAgICB9XG5cbiAgICBnZXQgc3BsaXRMaWdodHMoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3NwbGl0TGlnaHRzRGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3Qgc3BsaXRMaWdodHMgPSB0aGlzLl9zcGxpdExpZ2h0cztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3BsaXRMaWdodHMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgc3BsaXRMaWdodHNbaV0ubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gdGhpcy5fbGlnaHRzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBzcGxpdExpZ2h0c1tsaWdodC5fdHlwZV0ucHVzaChsaWdodCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzb3J0IHRoZSBsaWdodHMgYnkgdGhlaXIga2V5LCBhcyB0aGUgb3JkZXIgb2YgbGlnaHRzIGlzIHVzZWQgdG8gZ2VuZXJhdGUgc2hhZGVyIGdlbmVyYXRpb24ga2V5LFxuICAgICAgICAgICAgLy8gYW5kIHRoaXMgYXZvaWRzIG5ldyBzaGFkZXJzIGJlaW5nIGdlbmVyYXRlZCB3aGVuIGxpZ2h0cyBhcmUgcmVvcmRlcmVkXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwbGl0TGlnaHRzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgICAgIHNwbGl0TGlnaHRzW2ldLnNvcnQoKGEsIGIpID0+IGEua2V5IC0gYi5rZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwbGl0TGlnaHRzO1xuICAgIH1cblxuICAgIGV2YWx1YXRlTGlnaHRIYXNoKGxvY2FsTGlnaHRzLCBkaXJlY3Rpb25hbExpZ2h0cywgdXNlSWRzKSB7XG5cbiAgICAgICAgbGV0IGhhc2ggPSAwO1xuXG4gICAgICAgIC8vIHNlbGVjdCBsb2NhbC9kaXJlY3Rpb25hbCBsaWdodHMgYmFzZWQgb24gcmVxdWVzdFxuICAgICAgICBjb25zdCBsaWdodHMgPSB0aGlzLl9saWdodHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGlzTG9jYWxMaWdodCA9IGxpZ2h0c1tpXS50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUw7XG5cbiAgICAgICAgICAgIGlmICgobG9jYWxMaWdodHMgJiYgaXNMb2NhbExpZ2h0KSB8fCAoZGlyZWN0aW9uYWxMaWdodHMgJiYgIWlzTG9jYWxMaWdodCkpIHtcbiAgICAgICAgICAgICAgICBsaWdodEtleXMucHVzaCh1c2VJZHMgPyBsaWdodHNbaV0uaWQgOiBsaWdodHNbaV0ua2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsaWdodEtleXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRoZSBrZXlzIHRvIG1ha2Ugc3VyZSB0aGUgaGFzaCBpcyB0aGUgc2FtZSBmb3IgdGhlIHNhbWUgc2V0IG9mIGxpZ2h0c1xuICAgICAgICAgICAgbGlnaHRLZXlzLnNvcnQoKTtcblxuICAgICAgICAgICAgaGFzaCA9IGhhc2gzMkZudjFhKGxpZ2h0S2V5cyk7XG4gICAgICAgICAgICBsaWdodEtleXMubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBoYXNoO1xuICAgIH1cblxuXG4gICAgZ2V0TGlnaHRIYXNoKGlzQ2x1c3RlcmVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9saWdodEhhc2hEaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRIYXNoRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gR2VuZXJhdGUgaGFzaCB0byBjaGVjayBpZiBsYXllcnMgaGF2ZSB0aGUgc2FtZSBzZXQgb2YgbGlnaHRzIGluZGVwZW5kZW50IG9mIHRoZWlyIG9yZGVyLlxuICAgICAgICAgICAgLy8gQWx3YXlzIHVzZSBkaXJlY3Rpb25hbCBsaWdodHMuIEFkZGl0aW9uYWxseSB1c2UgbG9jYWwgbGlnaHRzIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAgIC8vIChvbmx5IGRpcmVjdGlvbmFsIGxpZ2h0cyBhZmZlY3QgdGhlIHNoYWRlciBnZW5lcmF0aW9uIGZvciBjbHVzdGVyZWQgbGlnaHRpbmcpXG4gICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSB0aGlzLmV2YWx1YXRlTGlnaHRIYXNoKCFpc0NsdXN0ZXJlZCwgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0SGFzaDtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIG9ubHkgdXNlZCBpbiBjbHVzdGVyZWQgbGlnaHRpbmcgbW9kZVxuICAgIGdldExpZ2h0SWRIYXNoKCkge1xuICAgICAgICBpZiAodGhpcy5fbGlnaHRJZEhhc2hEaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRJZEhhc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBoYXNoIGJhc2VkIG9uIElkcyBvZiBsaWdodHMgc29ydGVkIGJ5IGlkcywgdG8gY2hlY2sgaWYgdGhlIGxheWVycyBoYXZlIHRoZSBzYW1lIHNldCBvZiBsaWdodHNcbiAgICAgICAgICAgIC8vIE9ubHkgdXNlIGxvY2FsIGxpZ2h0cyAoZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBub3QgdXNlZCBmb3IgY2x1c3RlcmVkIGxpZ2h0aW5nKVxuICAgICAgICAgICAgdGhpcy5fbGlnaHRJZEhhc2ggPSB0aGlzLmV2YWx1YXRlTGlnaHRIYXNoKHRydWUsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodElkSGFzaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgY2FtZXJhIHRvIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gQVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9LlxuICAgICAqL1xuICAgIGFkZENhbWVyYShjYW1lcmEpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhbWVyYXNTZXQuaGFzKGNhbWVyYS5jYW1lcmEpKSB7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYXNTZXQuYWRkKGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmFzLnB1c2goY2FtZXJhKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNhbWVyYSBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gQVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9LlxuICAgICAqL1xuICAgIHJlbW92ZUNhbWVyYShjYW1lcmEpIHtcbiAgICAgICAgaWYgKHRoaXMuY2FtZXJhc1NldC5oYXMoY2FtZXJhLmNhbWVyYSkpIHtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhc1NldC5kZWxldGUoY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgY2FtZXJhcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICovXG4gICAgY2xlYXJDYW1lcmFzKCkge1xuICAgICAgICB0aGlzLmNhbWVyYXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5jYW1lcmFzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2RpcnR5Q29tcG9zaXRpb24gPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gQXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRyYXdDYWxsc0NvdW50IC0gTnVtYmVyIG9mIG1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbVBvcyAtIENhbWVyYSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBjYW1Gd2QgLSBDYW1lcmEgZm9yd2FyZCB2ZWN0b3IuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FsY3VsYXRlU29ydERpc3RhbmNlcyhkcmF3Q2FsbHMsIGRyYXdDYWxsc0NvdW50LCBjYW1Qb3MsIGNhbUZ3ZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmxheWVyIDw9IExBWUVSX0ZYKSBjb250aW51ZTsgLy8gT25seSBhbHBoYSBzb3J0IG1lc2ggaW5zdGFuY2VzIGluIHRoZSBtYWluIHdvcmxkIChiYWNrd2FyZHMgY29tcClcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jYWxjdWxhdGVTb3J0RGlzdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC56ZGlzdCA9IGRyYXdDYWxsLmNhbGN1bGF0ZVNvcnREaXN0YW5jZShkcmF3Q2FsbCwgY2FtUG9zLCBjYW1Gd2QpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWVzaFBvcyA9IGRyYXdDYWxsLmFhYmIuY2VudGVyO1xuICAgICAgICAgICAgY29uc3QgdGVtcHggPSBtZXNoUG9zLnggLSBjYW1Qb3MueDtcbiAgICAgICAgICAgIGNvbnN0IHRlbXB5ID0gbWVzaFBvcy55IC0gY2FtUG9zLnk7XG4gICAgICAgICAgICBjb25zdCB0ZW1weiA9IG1lc2hQb3MueiAtIGNhbVBvcy56O1xuICAgICAgICAgICAgZHJhd0NhbGwuemRpc3QgPSB0ZW1weCAqIGNhbUZ3ZC54ICsgdGVtcHkgKiBjYW1Gd2QueSArIHRlbXB6ICogY2FtRndkLno7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYWNjZXNzIHRvIGN1bGxlZCBtZXNoIGluc3RhbmNlcyBmb3IgdGhlIHByb3ZpZGVkIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2NhbWVyYS5qcycpLkNhbWVyYX0gY2FtZXJhIC0gVGhlIGNhbWVyYS5cbiAgICAgKiBAcmV0dXJucyB7Q3VsbGVkSW5zdGFuY2VzfSBUaGUgY3VsbGVkIG1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDdWxsZWRJbnN0YW5jZXMoY2FtZXJhKSB7XG4gICAgICAgIGxldCBpbnN0YW5jZXMgPSB0aGlzLl92aXNpYmxlSW5zdGFuY2VzLmdldChjYW1lcmEpO1xuICAgICAgICBpZiAoIWluc3RhbmNlcykge1xuICAgICAgICAgICAgaW5zdGFuY2VzID0gbmV3IEN1bGxlZEluc3RhbmNlcygpO1xuICAgICAgICAgICAgdGhpcy5fdmlzaWJsZUluc3RhbmNlcy5zZXQoY2FtZXJhLCBpbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnN0YW5jZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vY2FtZXJhLmpzJykuQ2FtZXJhfSBjYW1lcmEgLSBUaGUgY2FtZXJhIHRvIHNvcnQgdGhlIHZpc2libGUgbWVzaCBpbnN0YW5jZXNcbiAgICAgKiBmb3IuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc3BhcmVudCAtIFRydWUgaWYgdHJhbnNwYXJlbnQgc29ydGluZyBzaG91bGQgYmUgdXNlZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc29ydFZpc2libGUoY2FtZXJhLCB0cmFuc3BhcmVudCkge1xuICAgICAgICBjb25zdCBzb3J0TW9kZSA9IHRyYW5zcGFyZW50ID8gdGhpcy50cmFuc3BhcmVudFNvcnRNb2RlIDogdGhpcy5vcGFxdWVTb3J0TW9kZTtcbiAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9OT05FKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGN1bGxlZEluc3RhbmNlcyA9IHRoaXMuZ2V0Q3VsbGVkSW5zdGFuY2VzKGNhbWVyYSk7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRyYW5zcGFyZW50ID8gY3VsbGVkSW5zdGFuY2VzLnRyYW5zcGFyZW50IDogY3VsbGVkSW5zdGFuY2VzLm9wYXF1ZTtcbiAgICAgICAgY29uc3QgY2FtZXJhTm9kZSA9IGNhbWVyYS5ub2RlO1xuXG4gICAgICAgIGlmIChzb3J0TW9kZSA9PT0gU09SVE1PREVfQ1VTVE9NKSB7XG4gICAgICAgICAgICBjb25zdCBzb3J0UG9zID0gY2FtZXJhTm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3Qgc29ydERpciA9IGNhbWVyYU5vZGUuZm9yd2FyZDtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMoaW5zdGFuY2VzLCBpbnN0YW5jZXMubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VzdG9tU29ydENhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzLnNvcnQodGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9CQUNLMkZST05UIHx8IHNvcnRNb2RlID09PSBTT1JUTU9ERV9GUk9OVDJCQUNLKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc29ydFBvcyA9IGNhbWVyYU5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzb3J0RGlyID0gY2FtZXJhTm9kZS5mb3J3YXJkO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZXMoaW5zdGFuY2VzLCBpbnN0YW5jZXMubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5zdGFuY2VzLnNvcnQoc29ydENhbGxiYWNrc1tzb3J0TW9kZV0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXllciwgQ3VsbGVkSW5zdGFuY2VzIH07XG4iXSwibmFtZXMiOlsic29ydE1hbnVhbCIsImRyYXdDYWxsQSIsImRyYXdDYWxsQiIsImRyYXdPcmRlciIsInNvcnRNYXRlcmlhbE1lc2giLCJrZXlBIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsImtleUIiLCJtZXNoIiwiaWQiLCJzb3J0QmFja1RvRnJvbnQiLCJ6ZGlzdCIsInNvcnRGcm9udFRvQmFjayIsInNvcnRDYWxsYmFja3MiLCJsYXllckNvdW50ZXIiLCJsaWdodEtleXMiLCJfdGVtcE1hdGVyaWFscyIsIlNldCIsIkN1bGxlZEluc3RhbmNlcyIsImNvbnN0cnVjdG9yIiwib3BhcXVlIiwidHJhbnNwYXJlbnQiLCJMYXllciIsIm9wdGlvbnMiLCJfb3B0aW9ucyRlbmFibGVkIiwiX29wdGlvbnMkb3BhcXVlU29ydE1vIiwiX29wdGlvbnMkdHJhbnNwYXJlbnRTIiwiX29wdGlvbnMkc2hhZGVyUGFzcyIsIm1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzU2V0Iiwic2hhZG93Q2FzdGVycyIsInNoYWRvd0Nhc3RlcnNTZXQiLCJfdmlzaWJsZUluc3RhbmNlcyIsIldlYWtNYXAiLCJfbGlnaHRzIiwiX2xpZ2h0c1NldCIsIl9jbHVzdGVyZWRMaWdodHNTZXQiLCJfc3BsaXRMaWdodHMiLCJfc3BsaXRMaWdodHNEaXJ0eSIsInJlcXVpcmVzTGlnaHRDdWJlIiwiY2FtZXJhcyIsImNhbWVyYXNTZXQiLCJfZGlydHlDb21wb3NpdGlvbiIsInVuZGVmaW5lZCIsIk1hdGgiLCJtYXgiLCJuYW1lIiwiX2VuYWJsZWQiLCJlbmFibGVkIiwiX3JlZkNvdW50ZXIiLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX01BVEVSSUFMTUVTSCIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9CQUNLMkZST05UIiwicmVuZGVyVGFyZ2V0Iiwic2hhZGVyUGFzcyIsIlNIQURFUl9GT1JXQVJEIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckNvbG9yQnVmZmVyIiwiX2NsZWFyRGVwdGhCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsIm9uUHJlQ3VsbCIsIm9uUHJlUmVuZGVyIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblByZVJlbmRlclRyYW5zcGFyZW50Iiwib25Qb3N0Q3VsbCIsIm9uUG9zdFJlbmRlciIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50Iiwib25EcmF3Q2FsbCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwibGF5ZXJSZWZlcmVuY2UiLCJjdXN0b21Tb3J0Q2FsbGJhY2siLCJjdXN0b21DYWxjdWxhdGVTb3J0VmFsdWVzIiwiX2xpZ2h0SGFzaCIsIl9saWdodEhhc2hEaXJ0eSIsIl9saWdodElkSGFzaCIsIl9saWdodElkSGFzaERpcnR5Iiwic2tpcFJlbmRlckFmdGVyIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX3JlbmRlclRpbWUiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2hhZGVyVmVyc2lvbiIsInZhbCIsImluY3JlbWVudENvdW50ZXIiLCJkZWNyZW1lbnRDb3VudGVyIiwiaGFzQ2x1c3RlcmVkTGlnaHRzIiwic2l6ZSIsImNsdXN0ZXJlZExpZ2h0c1NldCIsIkRlYnVnIiwid2FybiIsImFkZE1lc2hJbnN0YW5jZXMiLCJza2lwU2hhZG93Q2FzdGVycyIsImRlc3RNZXNoSW5zdGFuY2VzIiwiZGVzdE1lc2hJbnN0YW5jZXNTZXQiLCJpIiwibGVuZ3RoIiwibWkiLCJoYXMiLCJwdXNoIiwiYWRkIiwibWF0ZXJpYWwiLCJhZGRTaGFkb3dDYXN0ZXJzIiwic2NlbmVTaGFkZXJWZXIiLCJmb3JFYWNoIiwibWF0IiwiZ2V0U2hhZGVyVmFyaWFudCIsIk1hdGVyaWFsIiwicHJvdG90eXBlIiwiY2xlYXJWYXJpYW50cyIsImNsZWFyIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsImRlbGV0ZSIsImoiLCJpbmRleE9mIiwic3BsaWNlIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImNhc3RTaGFkb3ciLCJjbGVhck1lc2hJbnN0YW5jZXMiLCJtYXJrTGlnaHRzRGlydHkiLCJhZGRMaWdodCIsImxpZ2h0IiwibCIsInR5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJyZW1vdmVMaWdodCIsImNsZWFyTGlnaHRzIiwicmVtb3ZlTGF5ZXIiLCJzcGxpdExpZ2h0cyIsImxpZ2h0cyIsIl90eXBlIiwic29ydCIsImEiLCJiIiwia2V5IiwiZXZhbHVhdGVMaWdodEhhc2giLCJsb2NhbExpZ2h0cyIsImRpcmVjdGlvbmFsTGlnaHRzIiwidXNlSWRzIiwiaGFzaCIsImlzTG9jYWxMaWdodCIsImhhc2gzMkZudjFhIiwiZ2V0TGlnaHRIYXNoIiwiaXNDbHVzdGVyZWQiLCJnZXRMaWdodElkSGFzaCIsImFkZENhbWVyYSIsImNhbWVyYSIsInJlbW92ZUNhbWVyYSIsImluZGV4IiwiY2xlYXJDYW1lcmFzIiwiX2NhbGN1bGF0ZVNvcnREaXN0YW5jZXMiLCJkcmF3Q2FsbHMiLCJkcmF3Q2FsbHNDb3VudCIsImNhbVBvcyIsImNhbUZ3ZCIsImRyYXdDYWxsIiwibGF5ZXIiLCJMQVlFUl9GWCIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsIm1lc2hQb3MiLCJhYWJiIiwiY2VudGVyIiwidGVtcHgiLCJ4IiwidGVtcHkiLCJ5IiwidGVtcHoiLCJ6IiwiZ2V0Q3VsbGVkSW5zdGFuY2VzIiwiaW5zdGFuY2VzIiwiZ2V0Iiwic2V0Iiwic29ydFZpc2libGUiLCJzb3J0TW9kZSIsIlNPUlRNT0RFX05PTkUiLCJjdWxsZWRJbnN0YW5jZXMiLCJjYW1lcmFOb2RlIiwibm9kZSIsIlNPUlRNT0RFX0NVU1RPTSIsInNvcnRQb3MiLCJnZXRQb3NpdGlvbiIsInNvcnREaXIiLCJmb3J3YXJkIiwiU09SVE1PREVfRlJPTlQyQkFDSyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFZQSxTQUFTQSxVQUFVQSxDQUFDQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUN0QyxFQUFBLE9BQU9ELFNBQVMsQ0FBQ0UsU0FBUyxHQUFHRCxTQUFTLENBQUNDLFNBQVMsQ0FBQTtBQUNwRCxDQUFBO0FBRUEsU0FBU0MsZ0JBQWdCQSxDQUFDSCxTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUM1QyxFQUFBLE1BQU1HLElBQUksR0FBR0osU0FBUyxDQUFDSyxJQUFJLENBQUNDLGVBQWUsQ0FBQyxDQUFBO0FBQzVDLEVBQUEsTUFBTUMsSUFBSSxHQUFHTixTQUFTLENBQUNJLElBQUksQ0FBQ0MsZUFBZSxDQUFDLENBQUE7RUFDNUMsSUFBSUYsSUFBSSxLQUFLRyxJQUFJLElBQUlQLFNBQVMsQ0FBQ1EsSUFBSSxJQUFJUCxTQUFTLENBQUNPLElBQUksRUFBRTtJQUNuRCxPQUFPUCxTQUFTLENBQUNPLElBQUksQ0FBQ0MsRUFBRSxHQUFHVCxTQUFTLENBQUNRLElBQUksQ0FBQ0MsRUFBRSxDQUFBO0FBQ2hELEdBQUE7RUFDQSxPQUFPRixJQUFJLEdBQUdILElBQUksQ0FBQTtBQUN0QixDQUFBO0FBRUEsU0FBU00sZUFBZUEsQ0FBQ1YsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDM0MsRUFBQSxPQUFPQSxTQUFTLENBQUNVLEtBQUssR0FBR1gsU0FBUyxDQUFDVyxLQUFLLENBQUE7QUFDNUMsQ0FBQTtBQUVBLFNBQVNDLGVBQWVBLENBQUNaLFNBQVMsRUFBRUMsU0FBUyxFQUFFO0FBQzNDLEVBQUEsT0FBT0QsU0FBUyxDQUFDVyxLQUFLLEdBQUdWLFNBQVMsQ0FBQ1UsS0FBSyxDQUFBO0FBQzVDLENBQUE7QUFFQSxNQUFNRSxhQUFhLEdBQUcsQ0FBQyxJQUFJLEVBQUVkLFVBQVUsRUFBRUksZ0JBQWdCLEVBQUVP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
