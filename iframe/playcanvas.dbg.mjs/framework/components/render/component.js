import { Debug } from '../../../core/debug.js';
import { LAYERID_WORLD, RENDERSTYLE_SOLID } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { MorphInstance } from '../../../scene/morph-instance.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { SkinInstanceCache } from '../../../scene/skin-instance-cache.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';
import { EntityReference } from '../../utils/entity-reference.js';

/**
 * Enables an Entity to render a {@link Mesh} or a primitive shape. This component attaches
 * {@link MeshInstance} geometry to the Entity.
 *
 * @property {import('../../entity.js').Entity} rootBone A reference to the entity to be used as
 * the root bone for any skinned meshes that are rendered by this component.
 * @augments Component
 * @category Graphics
 */
class RenderComponent extends Component {
  /**
   * Create a new RenderComponent.
   *
   * @param {import('./system.js').RenderComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    // the entity that represents the root bone if this render component has skinned meshes
    /** @private */
    this._type = 'asset';
    /** @private */
    this._castShadows = true;
    /** @private */
    this._receiveShadows = true;
    /** @private */
    this._castShadowsLightmap = true;
    /** @private */
    this._lightmapped = false;
    /** @private */
    this._lightmapSizeMultiplier = 1;
    /**
     * Mark meshes as non-movable (optimization).
     *
     * @type {boolean}
     */
    this.isStatic = false;
    /** @private */
    this._batchGroupId = -1;
    /** @private */
    this._layers = [LAYERID_WORLD];
    // assign to the default world layer
    /** @private */
    this._renderStyle = RENDERSTYLE_SOLID;
    /**
     * @type {MeshInstance[]}
     * @private
     */
    this._meshInstances = [];
    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    this._customAabb = null;
    /**
     * Used by lightmapper.
     *
     * @type {{x: number, y: number, z: number, uv: number}|null}
     * @ignore
     */
    this._area = null;
    /**
     * @type {AssetReference}
     * @private
     */
    this._assetReference = void 0;
    /**
     * @type {AssetReference[]}
     * @private
     */
    this._materialReferences = [];
    /**
     * Material used to render meshes other than asset type. It gets priority when set to
     * something else than defaultMaterial, otherwise materialASsets[0] is used.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     * @private
     */
    this._material = void 0;
    /**
     * @type {EntityReference}
     * @private
     */
    this._rootBone = void 0;
    this._rootBone = new EntityReference(this, 'rootBone');
    this._rootBone.on('set:entity', this._onSetRootBone, this);

    // render asset reference
    this._assetReference = new AssetReference('asset', this, system.app.assets, {
      add: this._onRenderAssetAdded,
      load: this._onRenderAssetLoad,
      remove: this._onRenderAssetRemove,
      unload: this._onRenderAssetUnload
    }, this);
    this._material = system.defaultMaterial;

    // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
    // added or removed from the parent
    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  /**
   * Set rendering of all {@link MeshInstance}s to the specified render style. Can be:
   *
   * - {@link RENDERSTYLE_SOLID}
   * - {@link RENDERSTYLE_WIREFRAME}
   * - {@link RENDERSTYLE_POINTS}
   *
   * Defaults to {@link RENDERSTYLE_SOLID}.
   *
   * @type {number}
   */
  set renderStyle(renderStyle) {
    if (this._renderStyle !== renderStyle) {
      this._renderStyle = renderStyle;
      MeshInstance._prepareRenderStyleForArray(this._meshInstances, renderStyle);
    }
  }
  get renderStyle() {
    return this._renderStyle;
  }

  /**
   * If set, the object space bounding box is used as a bounding box for visibility culling of
   * attached mesh instances. This is an optimization, allowing oversized bounding box to be
   * specified for skinned characters in order to avoid per frame bounding box computations based
   * on bone positions.
   *
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox}
   */
  set customAabb(value) {
    this._customAabb = value;

    // set it on meshInstances
    const mi = this._meshInstances;
    if (mi) {
      for (let i = 0; i < mi.length; i++) {
        mi[i].setCustomAabb(this._customAabb);
      }
    }
  }
  get customAabb() {
    return this._customAabb;
  }

  /**
   * The type of the render. Can be one of the following:
   *
   * - "asset": The component will render a render asset
   * - "box": The component will render a box (1 unit in each dimension)
   * - "capsule": The component will render a capsule (radius 0.5, height 2)
   * - "cone": The component will render a cone (radius 0.5, height 1)
   * - "cylinder": The component will render a cylinder (radius 0.5, height 1)
   * - "plane": The component will render a plane (1 unit in each dimension)
   * - "sphere": The component will render a sphere (radius 0.5)
   * - "torus": The component will render a torus (tubeRadius: 0.2, ringRadius: 0.3)
   *
   * @type {string}
   */
  set type(value) {
    if (this._type !== value) {
      this._area = null;
      this._type = value;
      this.destroyMeshInstances();
      if (value !== 'asset') {
        let material = this._material;
        if (!material || material === this.system.defaultMaterial) {
          material = this._materialReferences[0] && this._materialReferences[0].asset && this._materialReferences[0].asset.resource;
        }
        const primData = getShapePrimitive(this.system.app.graphicsDevice, value);
        this._area = primData.area;
        this.meshInstances = [new MeshInstance(primData.mesh, material || this.system.defaultMaterial, this.entity)];
      }
    }
  }
  get type() {
    return this._type;
  }

  /**
   * An array of meshInstances contained in the component. If meshes are not set or loaded for
   * component it will return null.
   *
   * @type {MeshInstance[]}
   */
  set meshInstances(value) {
    Debug.assert(Array.isArray(value), `MeshInstances set to a Render component must be an array.`);
    this.destroyMeshInstances();
    this._meshInstances = value;
    if (this._meshInstances) {
      const mi = this._meshInstances;
      for (let i = 0; i < mi.length; i++) {
        // if mesh instance was created without a node, assign it here
        if (!mi[i].node) {
          mi[i].node = this.entity;
        }
        mi[i].castShadow = this._castShadows;
        mi[i].receiveShadow = this._receiveShadows;
        mi[i].renderStyle = this._renderStyle;
        mi[i].setLightmapped(this._lightmapped);
        mi[i].setCustomAabb(this._customAabb);
      }
      if (this.enabled && this.entity.enabled) {
        this.addToLayers();
      }
    }
  }
  get meshInstances() {
    return this._meshInstances;
  }

  /**
   * If true, the meshes will be lightmapped after using lightmapper.bake().
   *
   * @type {boolean}
   */
  set lightmapped(value) {
    if (value !== this._lightmapped) {
      this._lightmapped = value;
      const mi = this._meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].setLightmapped(value);
        }
      }
    }
  }
  get lightmapped() {
    return this._lightmapped;
  }

  /**
   * If true, attached meshes will cast shadows for lights that have shadow casting enabled.
   *
   * @type {boolean}
   */
  set castShadows(value) {
    if (this._castShadows !== value) {
      const mi = this._meshInstances;
      if (mi) {
        const layers = this.layers;
        const scene = this.system.app.scene;
        if (this._castShadows && !value) {
          for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(this.layers[i]);
            if (layer) {
              layer.removeShadowCasters(mi);
            }
          }
        }
        for (let i = 0; i < mi.length; i++) {
          mi[i].castShadow = value;
        }
        if (!this._castShadows && value) {
          for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
              layer.addShadowCasters(mi);
            }
          }
        }
      }
      this._castShadows = value;
    }
  }
  get castShadows() {
    return this._castShadows;
  }

  /**
   * If true, shadows will be cast on attached meshes.
   *
   * @type {boolean}
   */
  set receiveShadows(value) {
    if (this._receiveShadows !== value) {
      this._receiveShadows = value;
      const mi = this._meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].receiveShadow = value;
        }
      }
    }
  }
  get receiveShadows() {
    return this._receiveShadows;
  }

  /**
   * If true, the meshes will cast shadows when rendering lightmaps.
   *
   * @type {boolean}
   */
  set castShadowsLightmap(value) {
    this._castShadowsLightmap = value;
  }
  get castShadowsLightmap() {
    return this._castShadowsLightmap;
  }

  /**
   * Lightmap resolution multiplier.
   *
   * @type {number}
   */
  set lightmapSizeMultiplier(value) {
    this._lightmapSizeMultiplier = value;
  }
  get lightmapSizeMultiplier() {
    return this._lightmapSizeMultiplier;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which the meshes should belong. Don't push, pop,
   * splice or modify this array, if you want to change it - set a new one instead.
   *
   * @type {number[]}
   */
  set layers(value) {
    const layers = this.system.app.scene.layers;
    let layer;
    if (this._meshInstances) {
      // remove all mesh instances from old layers
      for (let i = 0; i < this._layers.length; i++) {
        layer = layers.getLayerById(this._layers[i]);
        if (layer) {
          layer.removeMeshInstances(this._meshInstances);
        }
      }
    }

    // set the layer list
    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    // don't add into layers until we're enabled
    if (!this.enabled || !this.entity.enabled || !this._meshInstances) return;

    // add all mesh instances to new layers
    for (let i = 0; i < this._layers.length; i++) {
      layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this._meshInstances);
      }
    }
  }
  get layers() {
    return this._layers;
  }

  /**
   * Assign meshes to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
  set batchGroupId(value) {
    if (this._batchGroupId !== value) {
      if (this.entity.enabled && this._batchGroupId >= 0) {
        var _this$system$app$batc;
        (_this$system$app$batc = this.system.app.batcher) == null || _this$system$app$batc.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
      }
      if (this.entity.enabled && value >= 0) {
        var _this$system$app$batc2;
        (_this$system$app$batc2 = this.system.app.batcher) == null || _this$system$app$batc2.insert(BatchGroup.RENDER, value, this.entity);
      }
      if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
        // re-add render to scene, in case it was removed by batching
        this.addToLayers();
      }
      this._batchGroupId = value;
    }
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  /**
   * The material {@link Material} that will be used to render the meshes (not used on renders of
   * type 'asset').
   *
   * @type {import('../../../scene/materials/material.js').Material}
   */
  set material(value) {
    if (this._material !== value) {
      this._material = value;
      if (this._meshInstances && this._type !== 'asset') {
        for (let i = 0; i < this._meshInstances.length; i++) {
          this._meshInstances[i].material = value;
        }
      }
    }
  }
  get material() {
    return this._material;
  }

  /**
   * The material assets that will be used to render the meshes. Each material corresponds to the
   * respective mesh instance.
   *
   * @type {Asset[]|number[]}
   */
  set materialAssets(value = []) {
    if (this._materialReferences.length > value.length) {
      for (let i = value.length; i < this._materialReferences.length; i++) {
        this._materialReferences[i].id = null;
      }
      this._materialReferences.length = value.length;
    }
    for (let i = 0; i < value.length; i++) {
      if (!this._materialReferences[i]) {
        this._materialReferences.push(new AssetReference(i, this, this.system.app.assets, {
          add: this._onMaterialAdded,
          load: this._onMaterialLoad,
          remove: this._onMaterialRemove,
          unload: this._onMaterialUnload
        }, this));
      }
      if (value[i]) {
        const id = value[i] instanceof Asset ? value[i].id : value[i];
        if (this._materialReferences[i].id !== id) {
          this._materialReferences[i].id = id;
        }
        if (this._materialReferences[i].asset) {
          this._onMaterialAdded(i, this, this._materialReferences[i].asset);
        }
      } else {
        this._materialReferences[i].id = null;
        if (this._meshInstances[i]) {
          this._meshInstances[i].material = this.system.defaultMaterial;
        }
      }
    }
  }
  get materialAssets() {
    return this._materialReferences.map(function (ref) {
      return ref.id;
    });
  }

  /**
   * The render asset for the render component (only applies to type 'asset') - can also be an
   * asset id.
   *
   * @type {Asset|number}
   */
  set asset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._assetReference.id === id) return;
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._onRenderAssetRemove();
    }
    this._assetReference.id = id;
    if (this._assetReference.asset) {
      this._onRenderAssetAdded();
    }
  }
  get asset() {
    return this._assetReference.id;
  }

  /**
   * Assign asset id to the component, without updating the component with the new asset.
   * This can be used to assign the asset id to already fully created component.
   *
   * @param {Asset|number} asset - The render asset or asset id to assign.
   * @ignore
   */
  assignAsset(asset) {
    const id = asset instanceof Asset ? asset.id : asset;
    this._assetReference.id = id;
  }

  /**
   * @param {import('../../entity.js').Entity} entity - The entity set as the root bone.
   * @private
   */
  _onSetRootBone(entity) {
    if (entity) {
      this._onRootBoneChanged();
    }
  }

  /** @private */
  _onRootBoneChanged() {
    // remove existing skin instances and create new ones, connected to new root bone
    this._clearSkinInstances();
    if (this.enabled && this.entity.enabled) {
      this._cloneSkinInstances();
    }
  }

  /** @private */
  destroyMeshInstances() {
    const meshInstances = this._meshInstances;
    if (meshInstances) {
      this.removeFromLayers();

      // destroy mesh instances separately to allow them to be removed from the cache
      this._clearSkinInstances();
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].destroy();
      }
      this._meshInstances.length = 0;
    }
  }

  /** @private */
  addToLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this._meshInstances);
      }
    }
  }
  removeFromLayers() {
    if (this._meshInstances && this._meshInstances.length) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        const layer = layers.getLayerById(this._layers[i]);
        if (layer) {
          layer.removeMeshInstances(this._meshInstances);
        }
      }
    }
  }

  /** @private */
  onRemoveChild() {
    this.removeFromLayers();
  }

  /** @private */
  onInsertChild() {
    if (this._meshInstances && this.enabled && this.entity.enabled) {
      this.addToLayers();
    }
  }
  onRemove() {
    this.destroyMeshInstances();
    this.asset = null;
    this.materialAsset = null;
    this._assetReference.id = null;
    for (let i = 0; i < this._materialReferences.length; i++) {
      this._materialReferences[i].id = null;
    }
    this.entity.off('remove', this.onRemoveChild, this);
    this.entity.off('insert', this.onInsertChild, this);
  }
  onLayersChanged(oldComp, newComp) {
    this.addToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this._meshInstances);
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances(this._meshInstances);
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    this._rootBone.onParentComponentEnable();
    this._cloneSkinInstances();
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    const isAsset = this._type === 'asset';
    if (this._meshInstances && this._meshInstances.length) {
      this.addToLayers();
    } else if (isAsset && this.asset) {
      this._onRenderAssetAdded();
    }

    // load materials
    for (let i = 0; i < this._materialReferences.length; i++) {
      if (this._materialReferences[i].asset) {
        this.system.app.assets.load(this._materialReferences[i].asset);
      }
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null || _app$batcher.insert(BatchGroup.RENDER, this.batchGroupId, this.entity);
    }
  }
  onDisable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.off('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this.onLayerAdded, this);
      scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher2;
      (_app$batcher2 = app.batcher) == null || _app$batcher2.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
    }
    this.removeFromLayers();
  }

  /**
   * Stop rendering {@link MeshInstance}s without removing them from the scene hierarchy. This
   * method sets the {@link MeshInstance#visible} property of every MeshInstance to false. Note,
   * this does not remove the mesh instances from the scene hierarchy or draw call list. So the
   * render component still incurs some CPU overhead.
   */
  hide() {
    if (this._meshInstances) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        this._meshInstances[i].visible = false;
      }
    }
  }

  /**
   * Enable rendering of the component's {@link MeshInstance}s if hidden using
   * {@link RenderComponent#hide}. This method sets the {@link MeshInstance#visible} property on
   * all mesh instances to true.
   */
  show() {
    if (this._meshInstances) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        this._meshInstances[i].visible = true;
      }
    }
  }
  _onRenderAssetAdded() {
    if (!this._assetReference.asset) return;
    if (this._assetReference.asset.resource) {
      this._onRenderAssetLoad();
    } else if (this.enabled && this.entity.enabled) {
      this.system.app.assets.load(this._assetReference.asset);
    }
  }
  _onRenderAssetLoad() {
    // remove existing instances
    this.destroyMeshInstances();
    if (this._assetReference.asset) {
      const render = this._assetReference.asset.resource;
      render.off('set:meshes', this._onSetMeshes, this);
      render.on('set:meshes', this._onSetMeshes, this);
      if (render.meshes) {
        this._onSetMeshes(render.meshes);
      }
    }
  }
  _onSetMeshes(meshes) {
    this._cloneMeshes(meshes);
  }
  _clearSkinInstances() {
    for (let i = 0; i < this._meshInstances.length; i++) {
      const meshInstance = this._meshInstances[i];

      // remove it from the cache
      SkinInstanceCache.removeCachedSkinInstance(meshInstance.skinInstance);
      meshInstance.skinInstance = null;
    }
  }
  _cloneSkinInstances() {
    if (this._meshInstances.length && this._rootBone.entity instanceof GraphNode) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        const meshInstance = this._meshInstances[i];
        const mesh = meshInstance.mesh;

        // if skinned but does not have instance created yet
        if (mesh.skin && !meshInstance.skinInstance) {
          meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(mesh.skin, this._rootBone.entity, this.entity);
        }
      }
    }
  }
  _cloneMeshes(meshes) {
    if (meshes && meshes.length) {
      // cloned mesh instances
      const meshInstances = [];
      for (let i = 0; i < meshes.length; i++) {
        // mesh instance
        const mesh = meshes[i];
        const material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
        const meshInst = new MeshInstance(mesh, material || this.system.defaultMaterial, this.entity);
        meshInstances.push(meshInst);

        // morph instance
        if (mesh.morph) {
          meshInst.morphInstance = new MorphInstance(mesh.morph);
        }
      }
      this.meshInstances = meshInstances;

      // try to create skin instances if rootBone has been set, otherwise this executes when rootBone is set later
      this._cloneSkinInstances();
    }
  }
  _onRenderAssetUnload() {
    // when unloading asset, only remove asset mesh instances (type could have been already changed to 'box' or similar)
    if (this._type === 'asset') {
      this.destroyMeshInstances();
    }
  }
  _onRenderAssetRemove() {
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._assetReference.asset.resource.off('set:meshes', this._onSetMeshes, this);
    }
    this._onRenderAssetUnload();
  }
  _onMaterialAdded(index, component, asset) {
    if (asset.resource) {
      this._onMaterialLoad(index, component, asset);
    } else {
      if (this.enabled && this.entity.enabled) {
        this.system.app.assets.load(asset);
      }
    }
  }
  _updateMainMaterial(index, material) {
    // first material for primitives can be accessed using material property, so set it up
    if (index === 0) {
      this.material = material;
    }
  }
  _onMaterialLoad(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = asset.resource;
    }
    this._updateMainMaterial(index, asset.resource);
  }
  _onMaterialRemove(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = this.system.defaultMaterial;
    }
    this._updateMainMaterial(index, this.system.defaultMaterial);
  }
  _onMaterialUnload(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = this.system.defaultMaterial;
    }
    this._updateMainMaterial(index, this.system.defaultMaterial);
  }
  resolveDuplicatedEntityReferenceProperties(oldRender, duplicatedIdsMap) {
    if (oldRender.rootBone && duplicatedIdsMap[oldRender.rootBone]) {
      this.rootBone = duplicatedIdsMap[oldRender.rootBone];
    }
    this._clearSkinInstances();
  }
}

export { RenderComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgTEFZRVJJRF9XT1JMRCwgUkVOREVSU1RZTEVfU09MSUQgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLWdyb3VwLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9ycGhJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vcnBoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IGdldFNoYXBlUHJpbWl0aXZlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvc2tpbi1pbnN0YW5jZS1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQXNzZXRSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC1yZWZlcmVuY2UuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSB7QGxpbmsgTWVzaH0gb3IgYSBwcmltaXRpdmUgc2hhcGUuIFRoaXMgY29tcG9uZW50IGF0dGFjaGVzXG4gKiB7QGxpbmsgTWVzaEluc3RhbmNlfSBnZW9tZXRyeSB0byB0aGUgRW50aXR5LlxuICpcbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3RCb25lIEEgcmVmZXJlbmNlIHRvIHRoZSBlbnRpdHkgdG8gYmUgdXNlZCBhc1xuICogdGhlIHJvb3QgYm9uZSBmb3IgYW55IHNraW5uZWQgbWVzaGVzIHRoYXQgYXJlIHJlbmRlcmVkIGJ5IHRoaXMgY29tcG9uZW50LlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIFJlbmRlckNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3R5cGUgPSAnYXNzZXQnO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2Nhc3RTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY2FzdFNoYWRvd3NMaWdodG1hcCA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saWdodG1hcFNpemVNdWx0aXBsaWVyID0gMTtcblxuICAgIC8qKlxuICAgICAqIE1hcmsgbWVzaGVzIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9iYXRjaEdyb3VwSWQgPSAtMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRF07IC8vIGFzc2lnbiB0byB0aGUgZGVmYXVsdCB3b3JsZCBsYXllclxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JlbmRlclN0eWxlID0gUkVOREVSU1RZTEVfU09MSUQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWVzaEluc3RhbmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVXNlZCBieSBsaWdodG1hcHBlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHt7eDogbnVtYmVyLCB5OiBudW1iZXIsIHo6IG51bWJlciwgdXY6IG51bWJlcn18bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0UmVmZXJlbmNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxSZWZlcmVuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBNYXRlcmlhbCB1c2VkIHRvIHJlbmRlciBtZXNoZXMgb3RoZXIgdGhhbiBhc3NldCB0eXBlLiBJdCBnZXRzIHByaW9yaXR5IHdoZW4gc2V0IHRvXG4gICAgICogc29tZXRoaW5nIGVsc2UgdGhhbiBkZWZhdWx0TWF0ZXJpYWwsIG90aGVyd2lzZSBtYXRlcmlhbEFTc2V0c1swXSBpcyB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RW50aXR5UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Jvb3RCb25lO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJlbmRlckNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJlbmRlckNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgLy8gdGhlIGVudGl0eSB0aGF0IHJlcHJlc2VudHMgdGhlIHJvb3QgYm9uZSBpZiB0aGlzIHJlbmRlciBjb21wb25lbnQgaGFzIHNraW5uZWQgbWVzaGVzXG4gICAgICAgIHRoaXMuX3Jvb3RCb25lID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAncm9vdEJvbmUnKTtcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUub24oJ3NldDplbnRpdHknLCB0aGlzLl9vblNldFJvb3RCb25lLCB0aGlzKTtcblxuICAgICAgICAvLyByZW5kZXIgYXNzZXQgcmVmZXJlbmNlXG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlID0gbmV3IEFzc2V0UmVmZXJlbmNlKFxuICAgICAgICAgICAgJ2Fzc2V0JyxcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBzeXN0ZW0uYXBwLmFzc2V0cywge1xuICAgICAgICAgICAgICAgIGFkZDogdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkLFxuICAgICAgICAgICAgICAgIGxvYWQ6IHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkLFxuICAgICAgICAgICAgICAgIHJlbW92ZTogdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSxcbiAgICAgICAgICAgICAgICB1bmxvYWQ6IHRoaXMuX29uUmVuZGVyQXNzZXRVbmxvYWRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0aGlzXG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBzeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuXG4gICAgICAgIC8vIGhhbmRsZSBldmVudHMgd2hlbiB0aGUgZW50aXR5IGlzIGRpcmVjdGx5IChvciBpbmRpcmVjdGx5IGFzIGEgY2hpbGQgb2Ygc3ViLWhpZXJhcmNoeSlcbiAgICAgICAgLy8gYWRkZWQgb3IgcmVtb3ZlZCBmcm9tIHRoZSBwYXJlbnRcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnRoaWVyYXJjaHknLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCByZW5kZXJpbmcgb2YgYWxsIHtAbGluayBNZXNoSW5zdGFuY2V9cyB0byB0aGUgc3BlY2lmaWVkIHJlbmRlciBzdHlsZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1BPSU5UU31cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdHlsZShyZW5kZXJTdHlsZSkge1xuICAgICAgICBpZiAodGhpcy5fcmVuZGVyU3R5bGUgIT09IHJlbmRlclN0eWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuICAgICAgICAgICAgTWVzaEluc3RhbmNlLl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSh0aGlzLl9tZXNoSW5zdGFuY2VzLCByZW5kZXJTdHlsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3R5bGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIG1lc2ggaW5zdGFuY2VzLiBUaGlzIGlzIGFuIG9wdGltaXphdGlvbiwgYWxsb3dpbmcgb3ZlcnNpemVkIGJvdW5kaW5nIGJveCB0byBiZVxuICAgICAqIHNwZWNpZmllZCBmb3Igc2tpbm5lZCBjaGFyYWN0ZXJzIGluIG9yZGVyIHRvIGF2b2lkIHBlciBmcmFtZSBib3VuZGluZyBib3ggY29tcHV0YXRpb25zIGJhc2VkXG4gICAgICogb24gYm9uZSBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBjdXN0b21BYWJiKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSB2YWx1ZTtcblxuICAgICAgICAvLyBzZXQgaXQgb24gbWVzaEluc3RhbmNlc1xuICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1pW2ldLnNldEN1c3RvbUFhYmIodGhpcy5fY3VzdG9tQWFiYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY3VzdG9tQWFiYigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIHJlbmRlci4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSBcImFzc2V0XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSByZW5kZXIgYXNzZXRcbiAgICAgKiAtIFwiYm94XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBib3ggKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwiY2Fwc3VsZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY2Fwc3VsZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDIpXG4gICAgICogLSBcImNvbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNvbmUgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJjeWxpbmRlclwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY3lsaW5kZXIgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJwbGFuZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcGxhbmUgKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwic3BoZXJlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBzcGhlcmUgKHJhZGl1cyAwLjUpXG4gICAgICogLSBcInRvcnVzXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSB0b3J1cyAodHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMpXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hcmVhID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICAgICAgdGhpcy5kZXN0cm95TWVzaEluc3RhbmNlcygpO1xuXG4gICAgICAgICAgICBpZiAodmFsdWUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBsZXQgbWF0ZXJpYWwgPSB0aGlzLl9tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGVyaWFsIHx8IG1hdGVyaWFsID09PSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwgPSB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbMF0gJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzWzBdLmFzc2V0ICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1swXS5hc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcmltRGF0YSA9IGdldFNoYXBlUHJpbWl0aXZlKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FyZWEgPSBwcmltRGF0YS5hcmVhO1xuICAgICAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlcyA9IFtuZXcgTWVzaEluc3RhbmNlKHByaW1EYXRhLm1lc2gsIG1hdGVyaWFsIHx8IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCwgdGhpcy5lbnRpdHkpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBtZXNoSW5zdGFuY2VzIGNvbnRhaW5lZCBpbiB0aGUgY29tcG9uZW50LiBJZiBtZXNoZXMgYXJlIG5vdCBzZXQgb3IgbG9hZGVkIGZvclxuICAgICAqIGNvbXBvbmVudCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge01lc2hJbnN0YW5jZVtdfVxuICAgICAqL1xuICAgIHNldCBtZXNoSW5zdGFuY2VzKHZhbHVlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KEFycmF5LmlzQXJyYXkodmFsdWUpLCBgTWVzaEluc3RhbmNlcyBzZXQgdG8gYSBSZW5kZXIgY29tcG9uZW50IG11c3QgYmUgYW4gYXJyYXkuYCk7XG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgbWVzaCBpbnN0YW5jZSB3YXMgY3JlYXRlZCB3aXRob3V0IGEgbm9kZSwgYXNzaWduIGl0IGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoIW1pW2ldLm5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0ubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1pW2ldLmNhc3RTaGFkb3cgPSB0aGlzLl9jYXN0U2hhZG93cztcbiAgICAgICAgICAgICAgICBtaVtpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWlbaV0ucmVuZGVyU3R5bGUgPSB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRMaWdodG1hcHBlZCh0aGlzLl9saWdodG1hcHBlZCk7XG4gICAgICAgICAgICAgICAgbWlbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2hJbnN0YW5jZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBtZXNoZXMgd2lsbCBiZSBsaWdodG1hcHBlZCBhZnRlciB1c2luZyBsaWdodG1hcHBlci5iYWtlKCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBwZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRtYXBwZWQgPSB2YWx1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRMaWdodG1hcHBlZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBwZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgYXR0YWNoZWQgbWVzaGVzIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMubGF5ZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAmJiAhdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVTaGFkb3dDYXN0ZXJzKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0uY2FzdFNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChsYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuYWRkU2hhZG93Q2FzdGVycyhtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiBhdHRhY2hlZCBtZXNoZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgcmVjZWl2ZVNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlY2VpdmVTaGFkb3dzICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnJlY2VpdmVTaGFkb3cgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVjZWl2ZVNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWNlaXZlU2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgbWVzaGVzIHdpbGwgY2FzdCBzaGFkb3dzIHdoZW4gcmVuZGVyaW5nIGxpZ2h0bWFwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjYXN0U2hhZG93c0xpZ2h0bWFwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3NMaWdodG1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzTGlnaHRtYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlnaHRtYXAgcmVzb2x1dGlvbiBtdWx0aXBsaWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBTaXplTXVsdGlwbGllcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9saWdodG1hcFNpemVNdWx0aXBsaWVyID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhlIG1lc2hlcyBzaG91bGQgYmVsb25nLiBEb24ndCBwdXNoLCBwb3AsXG4gICAgICogc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsZXQgbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBhbGwgbWVzaCBpbnN0YW5jZXMgZnJvbSBvbGQgbGF5ZXJzXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0aGUgbGF5ZXIgbGlzdFxuICAgICAgICB0aGlzLl9sYXllcnMubGVuZ3RoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldID0gdmFsdWVbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb24ndCBhZGQgaW50byBsYXllcnMgdW50aWwgd2UncmUgZW5hYmxlZFxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gbWVzaGVzIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5SRU5ERVIsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyByZS1hZGQgcmVuZGVyIHRvIHNjZW5lLCBpbiBjYXNlIGl0IHdhcyByZW1vdmVkIGJ5IGJhdGNoaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoZXMgKG5vdCB1c2VkIG9uIHJlbmRlcnMgb2ZcbiAgICAgKiB0eXBlICdhc3NldCcpLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzICYmIHRoaXMuX3R5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCBhc3NldHMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoZXMuIEVhY2ggbWF0ZXJpYWwgY29ycmVzcG9uZHMgdG8gdGhlXG4gICAgICogcmVzcGVjdGl2ZSBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0W118bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXRzKHZhbHVlID0gW10pIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSB2YWx1ZS5sZW5ndGg7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIG5ldyBBc3NldFJlZmVyZW5jZShcbiAgICAgICAgICAgICAgICAgICAgICAgIGksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZDogdGhpcy5fb25NYXRlcmlhbEFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvYWQ6IHRoaXMuX29uTWF0ZXJpYWxMb2FkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZTogdGhpcy5fb25NYXRlcmlhbFJlbW92ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmxvYWQ6IHRoaXMuX29uTWF0ZXJpYWxVbmxvYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWVbaV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHZhbHVlW2ldIGluc3RhbmNlb2YgQXNzZXQgPyB2YWx1ZVtpXS5pZCA6IHZhbHVlW2ldO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgIT09IGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IGlkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFkZGVkKGksIHRoaXMsIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubWFwKGZ1bmN0aW9uIChyZWYpIHtcbiAgICAgICAgICAgIHJldHVybiByZWYuaWQ7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW5kZXIgYXNzZXQgZm9yIHRoZSByZW5kZXIgY29tcG9uZW50IChvbmx5IGFwcGxpZXMgdG8gdHlwZSAnYXNzZXQnKSAtIGNhbiBhbHNvIGJlIGFuXG4gICAgICogYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBpZCA9IHZhbHVlIGluc3RhbmNlb2YgQXNzZXQgPyB2YWx1ZS5pZCA6IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPT09IGlkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0ICYmIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IGlkO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gYXNzZXQgaWQgdG8gdGhlIGNvbXBvbmVudCwgd2l0aG91dCB1cGRhdGluZyB0aGUgY29tcG9uZW50IHdpdGggdGhlIG5ldyBhc3NldC5cbiAgICAgKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGFzc2lnbiB0aGUgYXNzZXQgaWQgdG8gYWxyZWFkeSBmdWxseSBjcmVhdGVkIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR8bnVtYmVyfSBhc3NldCAtIFRoZSByZW5kZXIgYXNzZXQgb3IgYXNzZXQgaWQgdG8gYXNzaWduLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhc3NpZ25Bc3NldChhc3NldCkge1xuICAgICAgICBjb25zdCBpZCA9IGFzc2V0IGluc3RhbmNlb2YgQXNzZXQgPyBhc3NldC5pZCA6IGFzc2V0O1xuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IGlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgc2V0IGFzIHRoZSByb290IGJvbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TZXRSb290Qm9uZShlbnRpdHkpIHtcbiAgICAgICAgaWYgKGVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fb25Sb290Qm9uZUNoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblJvb3RCb25lQ2hhbmdlZCgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIHNraW4gaW5zdGFuY2VzIGFuZCBjcmVhdGUgbmV3IG9uZXMsIGNvbm5lY3RlZCB0byBuZXcgcm9vdCBib25lXG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZGVzdHJveU1lc2hJbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBtZXNoIGluc3RhbmNlcyBzZXBhcmF0ZWx5IHRvIGFsbG93IHRoZW0gdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSBjYWNoZVxuICAgICAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYWRkVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25SZW1vdmVDaGlsZCgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgdGhpcy5fcm9vdEJvbmUub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcblxuICAgICAgICB0aGlzLl9jbG9uZVNraW5JbnN0YW5jZXMoKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNBc3NldCA9ICh0aGlzLl90eXBlID09PSAnYXNzZXQnKTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0Fzc2V0ICYmIHRoaXMuYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRBZGRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9hZCBtYXRlcmlhbHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlJFTkRFUiwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCByZW5kZXJpbmcge0BsaW5rIE1lc2hJbnN0YW5jZX1zIHdpdGhvdXQgcmVtb3ZpbmcgdGhlbSBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkuIFRoaXNcbiAgICAgKiBtZXRob2Qgc2V0cyB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvZiBldmVyeSBNZXNoSW5zdGFuY2UgdG8gZmFsc2UuIE5vdGUsXG4gICAgICogdGhpcyBkb2VzIG5vdCByZW1vdmUgdGhlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeSBvciBkcmF3IGNhbGwgbGlzdC4gU28gdGhlXG4gICAgICogcmVuZGVyIGNvbXBvbmVudCBzdGlsbCBpbmN1cnMgc29tZSBDUFUgb3ZlcmhlYWQuXG4gICAgICovXG4gICAgaGlkZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHJlbmRlcmluZyBvZiB0aGUgY29tcG9uZW50J3Mge0BsaW5rIE1lc2hJbnN0YW5jZX1zIGlmIGhpZGRlbiB1c2luZ1xuICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjaGlkZX0uIFRoaXMgbWV0aG9kIHNldHMgdGhlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb25cbiAgICAgKiBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBzaG93KCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0QWRkZWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoKSB7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGluc3RhbmNlc1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXIgPSB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIHJlbmRlci5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICBpZiAocmVuZGVyLm1lc2hlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9jbG9uZU1lc2hlcyhtZXNoZXMpO1xuICAgIH1cblxuICAgIF9jbGVhclNraW5JbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgICAgIFNraW5JbnN0YW5jZUNhY2hlLnJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lU2tpbkluc3RhbmNlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggJiYgdGhpcy5fcm9vdEJvbmUuZW50aXR5IGluc3RhbmNlb2YgR3JhcGhOb2RlKSB7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuX21lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgc2tpbm5lZCBidXQgZG9lcyBub3QgaGF2ZSBpbnN0YW5jZSBjcmVhdGVkIHlldFxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnNraW4gJiYgIW1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IFNraW5JbnN0YW5jZUNhY2hlLmNyZWF0ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoLnNraW4sIHRoaXMuX3Jvb3RCb25lLmVudGl0eSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jbG9uZU1lc2hlcyhtZXNoZXMpIHtcblxuICAgICAgICBpZiAobWVzaGVzICYmIG1lc2hlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgLy8gY2xvbmVkIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW107XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXSAmJiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQgJiYgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0ID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCB8fCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3QpO1xuXG4gICAgICAgICAgICAgICAgLy8gbW9ycGggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBpZiAobWVzaC5tb3JwaCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdC5tb3JwaEluc3RhbmNlID0gbmV3IE1vcnBoSW5zdGFuY2UobWVzaC5tb3JwaCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAvLyB0cnkgdG8gY3JlYXRlIHNraW4gaW5zdGFuY2VzIGlmIHJvb3RCb25lIGhhcyBiZWVuIHNldCwgb3RoZXJ3aXNlIHRoaXMgZXhlY3V0ZXMgd2hlbiByb290Qm9uZSBpcyBzZXQgbGF0ZXJcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRVbmxvYWQoKSB7XG5cbiAgICAgICAgLy8gd2hlbiB1bmxvYWRpbmcgYXNzZXQsIG9ubHkgcmVtb3ZlIGFzc2V0IG1lc2ggaW5zdGFuY2VzICh0eXBlIGNvdWxkIGhhdmUgYmVlbiBhbHJlYWR5IGNoYW5nZWQgdG8gJ2JveCcgb3Igc2ltaWxhcilcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0UmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQgJiYgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRVbmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbEFkZGVkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIG1hdGVyaWFsKSB7XG4gICAgICAgIC8vIGZpcnN0IG1hdGVyaWFsIGZvciBwcmltaXRpdmVzIGNhbiBiZSBhY2Nlc3NlZCB1c2luZyBtYXRlcmlhbCBwcm9wZXJ0eSwgc28gc2V0IGl0IHVwXG4gICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxMb2FkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZShpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFVubG9hZChpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkUmVuZGVyLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChvbGRSZW5kZXIucm9vdEJvbmUgJiYgZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3RCb25lID0gZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiUmVuZGVyQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIl9jYXN0U2hhZG93cyIsIl9yZWNlaXZlU2hhZG93cyIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJpc1N0YXRpYyIsIl9iYXRjaEdyb3VwSWQiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiX21lc2hJbnN0YW5jZXMiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX2Fzc2V0UmVmZXJlbmNlIiwiX21hdGVyaWFsUmVmZXJlbmNlcyIsIl9tYXRlcmlhbCIsIl9yb290Qm9uZSIsIkVudGl0eVJlZmVyZW5jZSIsIm9uIiwiX29uU2V0Um9vdEJvbmUiLCJBc3NldFJlZmVyZW5jZSIsImFwcCIsImFzc2V0cyIsImFkZCIsIl9vblJlbmRlckFzc2V0QWRkZWQiLCJsb2FkIiwiX29uUmVuZGVyQXNzZXRMb2FkIiwicmVtb3ZlIiwiX29uUmVuZGVyQXNzZXRSZW1vdmUiLCJ1bmxvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsImRlZmF1bHRNYXRlcmlhbCIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwicmVuZGVyU3R5bGUiLCJNZXNoSW5zdGFuY2UiLCJfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkiLCJjdXN0b21BYWJiIiwidmFsdWUiLCJtaSIsImkiLCJsZW5ndGgiLCJzZXRDdXN0b21BYWJiIiwidHlwZSIsImRlc3Ryb3lNZXNoSW5zdGFuY2VzIiwibWF0ZXJpYWwiLCJhc3NldCIsInJlc291cmNlIiwicHJpbURhdGEiLCJnZXRTaGFwZVByaW1pdGl2ZSIsImdyYXBoaWNzRGV2aWNlIiwiYXJlYSIsIm1lc2hJbnN0YW5jZXMiLCJtZXNoIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJub2RlIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJzZXRMaWdodG1hcHBlZCIsImVuYWJsZWQiLCJhZGRUb0xheWVycyIsImxpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsImFkZE1lc2hJbnN0YW5jZXMiLCJiYXRjaEdyb3VwSWQiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGMiLCJiYXRjaGVyIiwiQmF0Y2hHcm91cCIsIlJFTkRFUiIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YzIiLCJpbnNlcnQiLCJtYXRlcmlhbEFzc2V0cyIsImlkIiwicHVzaCIsIl9vbk1hdGVyaWFsQWRkZWQiLCJfb25NYXRlcmlhbExvYWQiLCJfb25NYXRlcmlhbFJlbW92ZSIsIl9vbk1hdGVyaWFsVW5sb2FkIiwiQXNzZXQiLCJtYXAiLCJyZWYiLCJhc3NpZ25Bc3NldCIsIl9vblJvb3RCb25lQ2hhbmdlZCIsIl9jbGVhclNraW5JbnN0YW5jZXMiLCJfY2xvbmVTa2luSW5zdGFuY2VzIiwicmVtb3ZlRnJvbUxheWVycyIsImRlc3Ryb3kiLCJvblJlbW92ZSIsIm1hdGVyaWFsQXNzZXQiLCJvZmYiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsImlzQXNzZXQiLCJfYXBwJGJhdGNoZXIiLCJvbkRpc2FibGUiLCJfYXBwJGJhdGNoZXIyIiwiaGlkZSIsInZpc2libGUiLCJzaG93IiwicmVuZGVyIiwiX29uU2V0TWVzaGVzIiwibWVzaGVzIiwiX2Nsb25lTWVzaGVzIiwibWVzaEluc3RhbmNlIiwiU2tpbkluc3RhbmNlQ2FjaGUiLCJyZW1vdmVDYWNoZWRTa2luSW5zdGFuY2UiLCJza2luSW5zdGFuY2UiLCJHcmFwaE5vZGUiLCJza2luIiwiY3JlYXRlQ2FjaGVkU2tpbkluc3RhbmNlIiwibWVzaEluc3QiLCJtb3JwaCIsIm1vcnBoSW5zdGFuY2UiLCJNb3JwaEluc3RhbmNlIiwiY29tcG9uZW50IiwiX3VwZGF0ZU1haW5NYXRlcmlhbCIsInJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyIsIm9sZFJlbmRlciIsImR1cGxpY2F0ZWRJZHNNYXAiLCJyb290Qm9uZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQWtGcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTs7QUFFckI7QUE1Rko7SUFBQSxJQUNBQyxDQUFBQSxLQUFLLEdBQUcsT0FBTyxDQUFBO0FBRWY7SUFBQSxJQUNBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5CO0lBQUEsSUFDQUMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUV0QjtJQUFBLElBQ0FDLENBQUFBLG9CQUFvQixHQUFHLElBQUksQ0FBQTtBQUUzQjtJQUFBLElBQ0FDLENBQUFBLFlBQVksR0FBRyxLQUFLLENBQUE7QUFFcEI7SUFBQSxJQUNBQyxDQUFBQSx1QkFBdUIsR0FBRyxDQUFDLENBQUE7QUFFM0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFFaEI7SUFBQSxJQUNBQyxDQUFBQSxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFbEI7QUFBQSxJQUFBLElBQUEsQ0FDQUMsT0FBTyxHQUFHLENBQUNDLGFBQWEsQ0FBQyxDQUFBO0FBQUU7QUFFM0I7SUFBQSxJQUNBQyxDQUFBQSxZQUFZLEdBQUdDLGlCQUFpQixDQUFBO0FBRWhDO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsY0FBYyxHQUFHLEVBQUUsQ0FBQTtBQUVuQjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFdBQVcsR0FBRyxJQUFJLENBQUE7QUFFbEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUVaO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLGVBQWUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVmO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsbUJBQW1CLEdBQUcsRUFBRSxDQUFBO0FBRXhCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTkksSUFBQSxJQUFBLENBT0FDLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVUO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQWNMLElBQUksQ0FBQ0EsU0FBUyxHQUFHLElBQUlDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUE7QUFDdEQsSUFBQSxJQUFJLENBQUNELFNBQVMsQ0FBQ0UsRUFBRSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTs7QUFFMUQ7QUFDQSxJQUFBLElBQUksQ0FBQ04sZUFBZSxHQUFHLElBQUlPLGNBQWMsQ0FDckMsT0FBTyxFQUNQLElBQUksRUFDSnhCLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxFQUFFO01BQ2ZDLEdBQUcsRUFBRSxJQUFJLENBQUNDLG1CQUFtQjtNQUM3QkMsSUFBSSxFQUFFLElBQUksQ0FBQ0Msa0JBQWtCO01BQzdCQyxNQUFNLEVBQUUsSUFBSSxDQUFDQyxvQkFBb0I7TUFDakNDLE1BQU0sRUFBRSxJQUFJLENBQUNDLG9CQUFBQTtLQUNoQixFQUNELElBQ0osQ0FBQyxDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNmLFNBQVMsR0FBR25CLE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQTs7QUFFdkM7QUFDQTtJQUNBbEMsTUFBTSxDQUFDcUIsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNjLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUM3Q25DLE1BQU0sQ0FBQ3FCLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUNjLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUN0RG5DLE1BQU0sQ0FBQ3FCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDZSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDN0NwQyxNQUFNLENBQUNxQixFQUFFLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDZSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDMUQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsV0FBV0EsQ0FBQ0EsV0FBVyxFQUFFO0FBQ3pCLElBQUEsSUFBSSxJQUFJLENBQUMxQixZQUFZLEtBQUswQixXQUFXLEVBQUU7TUFDbkMsSUFBSSxDQUFDMUIsWUFBWSxHQUFHMEIsV0FBVyxDQUFBO01BQy9CQyxZQUFZLENBQUNDLDJCQUEyQixDQUFDLElBQUksQ0FBQzFCLGNBQWMsRUFBRXdCLFdBQVcsQ0FBQyxDQUFBO0FBQzlFLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUEsV0FBV0EsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDMUIsWUFBWSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUk2QixVQUFVQSxDQUFDQyxLQUFLLEVBQUU7SUFDbEIsSUFBSSxDQUFDM0IsV0FBVyxHQUFHMkIsS0FBSyxDQUFBOztBQUV4QjtBQUNBLElBQUEsTUFBTUMsRUFBRSxHQUFHLElBQUksQ0FBQzdCLGNBQWMsQ0FBQTtBQUM5QixJQUFBLElBQUk2QixFQUFFLEVBQUU7QUFDSixNQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxFQUFFLENBQUNFLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7UUFDaENELEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNFLGFBQWEsQ0FBQyxJQUFJLENBQUMvQixXQUFXLENBQUMsQ0FBQTtBQUN6QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJMEIsVUFBVUEsR0FBRztJQUNiLE9BQU8sSUFBSSxDQUFDMUIsV0FBVyxDQUFBO0FBQzNCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlnQyxJQUFJQSxDQUFDTCxLQUFLLEVBQUU7QUFFWixJQUFBLElBQUksSUFBSSxDQUFDeEMsS0FBSyxLQUFLd0MsS0FBSyxFQUFFO01BQ3RCLElBQUksQ0FBQzFCLEtBQUssR0FBRyxJQUFJLENBQUE7TUFDakIsSUFBSSxDQUFDZCxLQUFLLEdBQUd3QyxLQUFLLENBQUE7TUFFbEIsSUFBSSxDQUFDTSxvQkFBb0IsRUFBRSxDQUFBO01BRTNCLElBQUlOLEtBQUssS0FBSyxPQUFPLEVBQUU7QUFDbkIsUUFBQSxJQUFJTyxRQUFRLEdBQUcsSUFBSSxDQUFDOUIsU0FBUyxDQUFBO1FBQzdCLElBQUksQ0FBQzhCLFFBQVEsSUFBSUEsUUFBUSxLQUFLLElBQUksQ0FBQ2pELE1BQU0sQ0FBQ21DLGVBQWUsRUFBRTtVQUN2RGMsUUFBUSxHQUFHLElBQUksQ0FBQy9CLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxJQUMxQixJQUFJLENBQUNBLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDZ0MsS0FBSyxJQUNqQyxJQUFJLENBQUNoQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ2dDLEtBQUssQ0FBQ0MsUUFBUSxDQUFBO0FBQzFELFNBQUE7QUFFQSxRQUFBLE1BQU1DLFFBQVEsR0FBR0MsaUJBQWlCLENBQUMsSUFBSSxDQUFDckQsTUFBTSxDQUFDeUIsR0FBRyxDQUFDNkIsY0FBYyxFQUFFWixLQUFLLENBQUMsQ0FBQTtBQUN6RSxRQUFBLElBQUksQ0FBQzFCLEtBQUssR0FBR29DLFFBQVEsQ0FBQ0csSUFBSSxDQUFBO1FBQzFCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLENBQUMsSUFBSWpCLFlBQVksQ0FBQ2EsUUFBUSxDQUFDSyxJQUFJLEVBQUVSLFFBQVEsSUFBSSxJQUFJLENBQUNqRCxNQUFNLENBQUNtQyxlQUFlLEVBQUUsSUFBSSxDQUFDbEMsTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUNoSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJOEMsSUFBSUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDN0MsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXNELGFBQWFBLENBQUNkLEtBQUssRUFBRTtJQUVyQmdCLEtBQUssQ0FBQ0MsTUFBTSxDQUFDQyxLQUFLLENBQUNDLE9BQU8sQ0FBQ25CLEtBQUssQ0FBQyxFQUFHLENBQUEseURBQUEsQ0FBMEQsQ0FBQyxDQUFBO0lBQy9GLElBQUksQ0FBQ00sb0JBQW9CLEVBQUUsQ0FBQTtJQUUzQixJQUFJLENBQUNsQyxjQUFjLEdBQUc0QixLQUFLLENBQUE7SUFFM0IsSUFBSSxJQUFJLENBQUM1QixjQUFjLEVBQUU7QUFFckIsTUFBQSxNQUFNNkIsRUFBRSxHQUFHLElBQUksQ0FBQzdCLGNBQWMsQ0FBQTtBQUM5QixNQUFBLEtBQUssSUFBSThCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsRUFBRSxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBRWhDO0FBQ0EsUUFBQSxJQUFJLENBQUNELEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNrQixJQUFJLEVBQUU7VUFDYm5CLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNrQixJQUFJLEdBQUcsSUFBSSxDQUFDN0QsTUFBTSxDQUFBO0FBQzVCLFNBQUE7UUFFQTBDLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNtQixVQUFVLEdBQUcsSUFBSSxDQUFDNUQsWUFBWSxDQUFBO1FBQ3BDd0MsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ29CLGFBQWEsR0FBRyxJQUFJLENBQUM1RCxlQUFlLENBQUE7UUFDMUN1QyxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDTixXQUFXLEdBQUcsSUFBSSxDQUFDMUIsWUFBWSxDQUFBO1FBQ3JDK0IsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ3FCLGNBQWMsQ0FBQyxJQUFJLENBQUMzRCxZQUFZLENBQUMsQ0FBQTtRQUN2Q3FDLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNFLGFBQWEsQ0FBQyxJQUFJLENBQUMvQixXQUFXLENBQUMsQ0FBQTtBQUN6QyxPQUFBO01BRUEsSUFBSSxJQUFJLENBQUNtRCxPQUFPLElBQUksSUFBSSxDQUFDakUsTUFBTSxDQUFDaUUsT0FBTyxFQUFFO1FBQ3JDLElBQUksQ0FBQ0MsV0FBVyxFQUFFLENBQUE7QUFDdEIsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSVgsYUFBYUEsR0FBRztJQUNoQixPQUFPLElBQUksQ0FBQzFDLGNBQWMsQ0FBQTtBQUM5QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJc0QsV0FBV0EsQ0FBQzFCLEtBQUssRUFBRTtBQUNuQixJQUFBLElBQUlBLEtBQUssS0FBSyxJQUFJLENBQUNwQyxZQUFZLEVBQUU7TUFDN0IsSUFBSSxDQUFDQSxZQUFZLEdBQUdvQyxLQUFLLENBQUE7QUFFekIsTUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBQzlCLE1BQUEsSUFBSTZCLEVBQUUsRUFBRTtBQUNKLFFBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEVBQUUsQ0FBQ0UsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNoQ0QsVUFBQUEsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ3FCLGNBQWMsQ0FBQ3ZCLEtBQUssQ0FBQyxDQUFBO0FBQy9CLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJMEIsV0FBV0EsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDOUQsWUFBWSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUkrRCxXQUFXQSxDQUFDM0IsS0FBSyxFQUFFO0FBQ25CLElBQUEsSUFBSSxJQUFJLENBQUN2QyxZQUFZLEtBQUt1QyxLQUFLLEVBQUU7QUFFN0IsTUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBRTlCLE1BQUEsSUFBSTZCLEVBQUUsRUFBRTtBQUNKLFFBQUEsTUFBTTJCLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtRQUMxQixNQUFNQyxLQUFLLEdBQUcsSUFBSSxDQUFDdkUsTUFBTSxDQUFDeUIsR0FBRyxDQUFDOEMsS0FBSyxDQUFBO0FBQ25DLFFBQUEsSUFBSSxJQUFJLENBQUNwRSxZQUFZLElBQUksQ0FBQ3VDLEtBQUssRUFBRTtBQUM3QixVQUFBLEtBQUssSUFBSUUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMEIsTUFBTSxDQUFDekIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNwQyxZQUFBLE1BQU00QixLQUFLLEdBQUdELEtBQUssQ0FBQ0QsTUFBTSxDQUFDRyxZQUFZLENBQUMsSUFBSSxDQUFDSCxNQUFNLENBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3ZELFlBQUEsSUFBSTRCLEtBQUssRUFBRTtBQUNQQSxjQUFBQSxLQUFLLENBQUNFLG1CQUFtQixDQUFDL0IsRUFBRSxDQUFDLENBQUE7QUFDakMsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsRUFBRSxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ2hDRCxVQUFBQSxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDbUIsVUFBVSxHQUFHckIsS0FBSyxDQUFBO0FBQzVCLFNBQUE7QUFFQSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUN2QyxZQUFZLElBQUl1QyxLQUFLLEVBQUU7QUFDN0IsVUFBQSxLQUFLLElBQUlFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBCLE1BQU0sQ0FBQ3pCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsWUFBQSxNQUFNNEIsS0FBSyxHQUFHRCxLQUFLLENBQUNELE1BQU0sQ0FBQ0csWUFBWSxDQUFDSCxNQUFNLENBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xELFlBQUEsSUFBSTRCLEtBQUssRUFBRTtBQUNQQSxjQUFBQSxLQUFLLENBQUNHLGdCQUFnQixDQUFDaEMsRUFBRSxDQUFDLENBQUE7QUFDOUIsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtNQUVBLElBQUksQ0FBQ3hDLFlBQVksR0FBR3VDLEtBQUssQ0FBQTtBQUM3QixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUkyQixXQUFXQSxHQUFHO0lBQ2QsT0FBTyxJQUFJLENBQUNsRSxZQUFZLENBQUE7QUFDNUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXlFLGNBQWNBLENBQUNsQyxLQUFLLEVBQUU7QUFDdEIsSUFBQSxJQUFJLElBQUksQ0FBQ3RDLGVBQWUsS0FBS3NDLEtBQUssRUFBRTtNQUVoQyxJQUFJLENBQUN0QyxlQUFlLEdBQUdzQyxLQUFLLENBQUE7QUFFNUIsTUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBQzlCLE1BQUEsSUFBSTZCLEVBQUUsRUFBRTtBQUNKLFFBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEVBQUUsQ0FBQ0UsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNoQ0QsVUFBQUEsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ29CLGFBQWEsR0FBR3RCLEtBQUssQ0FBQTtBQUMvQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSWtDLGNBQWNBLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUN4RSxlQUFlLENBQUE7QUFDL0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXlFLG1CQUFtQkEsQ0FBQ25DLEtBQUssRUFBRTtJQUMzQixJQUFJLENBQUNyQyxvQkFBb0IsR0FBR3FDLEtBQUssQ0FBQTtBQUNyQyxHQUFBO0VBRUEsSUFBSW1DLG1CQUFtQkEsR0FBRztJQUN0QixPQUFPLElBQUksQ0FBQ3hFLG9CQUFvQixDQUFBO0FBQ3BDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUl5RSxzQkFBc0JBLENBQUNwQyxLQUFLLEVBQUU7SUFDOUIsSUFBSSxDQUFDbkMsdUJBQXVCLEdBQUdtQyxLQUFLLENBQUE7QUFDeEMsR0FBQTtFQUVBLElBQUlvQyxzQkFBc0JBLEdBQUc7SUFDekIsT0FBTyxJQUFJLENBQUN2RSx1QkFBdUIsQ0FBQTtBQUN2QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUkrRCxNQUFNQSxDQUFDNUIsS0FBSyxFQUFFO0lBQ2QsTUFBTTRCLE1BQU0sR0FBRyxJQUFJLENBQUN0RSxNQUFNLENBQUN5QixHQUFHLENBQUM4QyxLQUFLLENBQUNELE1BQU0sQ0FBQTtBQUMzQyxJQUFBLElBQUlFLEtBQUssQ0FBQTtJQUVULElBQUksSUFBSSxDQUFDMUQsY0FBYyxFQUFFO0FBQ3JCO0FBQ0EsTUFBQSxLQUFLLElBQUk4QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbEMsT0FBTyxDQUFDbUMsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtRQUMxQzRCLEtBQUssR0FBR0YsTUFBTSxDQUFDRyxZQUFZLENBQUMsSUFBSSxDQUFDL0QsT0FBTyxDQUFDa0MsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1QyxRQUFBLElBQUk0QixLQUFLLEVBQUU7QUFDUEEsVUFBQUEsS0FBSyxDQUFDTyxtQkFBbUIsQ0FBQyxJQUFJLENBQUNqRSxjQUFjLENBQUMsQ0FBQTtBQUNsRCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUksQ0FBQ0osT0FBTyxDQUFDbUMsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN2QixJQUFBLEtBQUssSUFBSUQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRixLQUFLLENBQUNHLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7TUFDbkMsSUFBSSxDQUFDbEMsT0FBTyxDQUFDa0MsQ0FBQyxDQUFDLEdBQUdGLEtBQUssQ0FBQ0UsQ0FBQyxDQUFDLENBQUE7QUFDOUIsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3NCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQ2pFLE1BQU0sQ0FBQ2lFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQ3BELGNBQWMsRUFBRSxPQUFBOztBQUVuRTtBQUNBLElBQUEsS0FBSyxJQUFJOEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ21DLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7TUFDMUM0QixLQUFLLEdBQUdGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDLElBQUksQ0FBQy9ELE9BQU8sQ0FBQ2tDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDNUMsTUFBQSxJQUFJNEIsS0FBSyxFQUFFO0FBQ1BBLFFBQUFBLEtBQUssQ0FBQ1EsZ0JBQWdCLENBQUMsSUFBSSxDQUFDbEUsY0FBYyxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSXdELE1BQU1BLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQzVELE9BQU8sQ0FBQTtBQUN2QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJdUUsWUFBWUEsQ0FBQ3ZDLEtBQUssRUFBRTtBQUNwQixJQUFBLElBQUksSUFBSSxDQUFDakMsYUFBYSxLQUFLaUMsS0FBSyxFQUFFO01BRTlCLElBQUksSUFBSSxDQUFDekMsTUFBTSxDQUFDaUUsT0FBTyxJQUFJLElBQUksQ0FBQ3pELGFBQWEsSUFBSSxDQUFDLEVBQUU7QUFBQSxRQUFBLElBQUF5RSxxQkFBQSxDQUFBO1FBQ2hELENBQUFBLHFCQUFBLEdBQUksSUFBQSxDQUFDbEYsTUFBTSxDQUFDeUIsR0FBRyxDQUFDMEQsT0FBTyxLQUF2QkQsSUFBQUEsSUFBQUEscUJBQUEsQ0FBeUJuRCxNQUFNLENBQUNxRCxVQUFVLENBQUNDLE1BQU0sRUFBRSxJQUFJLENBQUNKLFlBQVksRUFBRSxJQUFJLENBQUNoRixNQUFNLENBQUMsQ0FBQTtBQUN0RixPQUFBO01BQ0EsSUFBSSxJQUFJLENBQUNBLE1BQU0sQ0FBQ2lFLE9BQU8sSUFBSXhCLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFBQSxRQUFBLElBQUE0QyxzQkFBQSxDQUFBO1FBQ25DLENBQUFBLHNCQUFBLE9BQUksQ0FBQ3RGLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzBELE9BQU8sS0FBQSxJQUFBLElBQXZCRyxzQkFBQSxDQUF5QkMsTUFBTSxDQUFDSCxVQUFVLENBQUNDLE1BQU0sRUFBRTNDLEtBQUssRUFBRSxJQUFJLENBQUN6QyxNQUFNLENBQUMsQ0FBQTtBQUMxRSxPQUFBO0FBRUEsTUFBQSxJQUFJeUMsS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUNqQyxhQUFhLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQ3lELE9BQU8sSUFBSSxJQUFJLENBQUNqRSxNQUFNLENBQUNpRSxPQUFPLEVBQUU7QUFDN0U7UUFDQSxJQUFJLENBQUNDLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLE9BQUE7TUFFQSxJQUFJLENBQUMxRCxhQUFhLEdBQUdpQyxLQUFLLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJdUMsWUFBWUEsR0FBRztJQUNmLE9BQU8sSUFBSSxDQUFDeEUsYUFBYSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXdDLFFBQVFBLENBQUNQLEtBQUssRUFBRTtBQUNoQixJQUFBLElBQUksSUFBSSxDQUFDdkIsU0FBUyxLQUFLdUIsS0FBSyxFQUFFO01BQzFCLElBQUksQ0FBQ3ZCLFNBQVMsR0FBR3VCLEtBQUssQ0FBQTtNQUV0QixJQUFJLElBQUksQ0FBQzVCLGNBQWMsSUFBSSxJQUFJLENBQUNaLEtBQUssS0FBSyxPQUFPLEVBQUU7QUFDL0MsUUFBQSxLQUFLLElBQUkwQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDOUIsY0FBYyxDQUFDK0IsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtVQUNqRCxJQUFJLENBQUM5QixjQUFjLENBQUM4QixDQUFDLENBQUMsQ0FBQ0ssUUFBUSxHQUFHUCxLQUFLLENBQUE7QUFDM0MsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlPLFFBQVFBLEdBQUc7SUFDWCxPQUFPLElBQUksQ0FBQzlCLFNBQVMsQ0FBQTtBQUN6QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsSUFBSXFFLGNBQWNBLENBQUM5QyxLQUFLLEdBQUcsRUFBRSxFQUFFO0lBQzNCLElBQUksSUFBSSxDQUFDeEIsbUJBQW1CLENBQUMyQixNQUFNLEdBQUdILEtBQUssQ0FBQ0csTUFBTSxFQUFFO0FBQ2hELE1BQUEsS0FBSyxJQUFJRCxDQUFDLEdBQUdGLEtBQUssQ0FBQ0csTUFBTSxFQUFFRCxDQUFDLEdBQUcsSUFBSSxDQUFDMUIsbUJBQW1CLENBQUMyQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO1FBQ2pFLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUM2QyxFQUFFLEdBQUcsSUFBSSxDQUFBO0FBQ3pDLE9BQUE7QUFDQSxNQUFBLElBQUksQ0FBQ3ZFLG1CQUFtQixDQUFDMkIsTUFBTSxHQUFHSCxLQUFLLENBQUNHLE1BQU0sQ0FBQTtBQUNsRCxLQUFBO0FBRUEsSUFBQSxLQUFLLElBQUlELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsS0FBSyxDQUFDRyxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ25DLE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLEVBQUU7QUFDOUIsUUFBQSxJQUFJLENBQUMxQixtQkFBbUIsQ0FBQ3dFLElBQUksQ0FDekIsSUFBSWxFLGNBQWMsQ0FDZG9CLENBQUMsRUFDRCxJQUFJLEVBQ0osSUFBSSxDQUFDNUMsTUFBTSxDQUFDeUIsR0FBRyxDQUFDQyxNQUFNLEVBQUU7VUFDcEJDLEdBQUcsRUFBRSxJQUFJLENBQUNnRSxnQkFBZ0I7VUFDMUI5RCxJQUFJLEVBQUUsSUFBSSxDQUFDK0QsZUFBZTtVQUMxQjdELE1BQU0sRUFBRSxJQUFJLENBQUM4RCxpQkFBaUI7VUFDOUI1RCxNQUFNLEVBQUUsSUFBSSxDQUFDNkQsaUJBQUFBO1NBQ2hCLEVBQ0QsSUFDSixDQUNKLENBQUMsQ0FBQTtBQUNMLE9BQUE7QUFFQSxNQUFBLElBQUlwRCxLQUFLLENBQUNFLENBQUMsQ0FBQyxFQUFFO0FBQ1YsUUFBQSxNQUFNNkMsRUFBRSxHQUFHL0MsS0FBSyxDQUFDRSxDQUFDLENBQUMsWUFBWW1ELEtBQUssR0FBR3JELEtBQUssQ0FBQ0UsQ0FBQyxDQUFDLENBQUM2QyxFQUFFLEdBQUcvQyxLQUFLLENBQUNFLENBQUMsQ0FBQyxDQUFBO1FBQzdELElBQUksSUFBSSxDQUFDMUIsbUJBQW1CLENBQUMwQixDQUFDLENBQUMsQ0FBQzZDLEVBQUUsS0FBS0EsRUFBRSxFQUFFO1VBQ3ZDLElBQUksQ0FBQ3ZFLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUM2QyxFQUFFLEdBQUdBLEVBQUUsQ0FBQTtBQUN2QyxTQUFBO1FBRUEsSUFBSSxJQUFJLENBQUN2RSxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDTSxLQUFLLEVBQUU7QUFDbkMsVUFBQSxJQUFJLENBQUN5QyxnQkFBZ0IsQ0FBQy9DLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDMUIsbUJBQW1CLENBQUMwQixDQUFDLENBQUMsQ0FBQ00sS0FBSyxDQUFDLENBQUE7QUFDckUsU0FBQTtBQUNKLE9BQUMsTUFBTTtRQUNILElBQUksQ0FBQ2hDLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUM2QyxFQUFFLEdBQUcsSUFBSSxDQUFBO0FBRXJDLFFBQUEsSUFBSSxJQUFJLENBQUMzRSxjQUFjLENBQUM4QixDQUFDLENBQUMsRUFBRTtBQUN4QixVQUFBLElBQUksQ0FBQzlCLGNBQWMsQ0FBQzhCLENBQUMsQ0FBQyxDQUFDSyxRQUFRLEdBQUcsSUFBSSxDQUFDakQsTUFBTSxDQUFDbUMsZUFBZSxDQUFBO0FBQ2pFLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJcUQsY0FBY0EsR0FBRztJQUNqQixPQUFPLElBQUksQ0FBQ3RFLG1CQUFtQixDQUFDOEUsR0FBRyxDQUFDLFVBQVVDLEdBQUcsRUFBRTtNQUMvQyxPQUFPQSxHQUFHLENBQUNSLEVBQUUsQ0FBQTtBQUNqQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXZDLEtBQUtBLENBQUNSLEtBQUssRUFBRTtJQUNiLE1BQU0rQyxFQUFFLEdBQUcvQyxLQUFLLFlBQVlxRCxLQUFLLEdBQUdyRCxLQUFLLENBQUMrQyxFQUFFLEdBQUcvQyxLQUFLLENBQUE7QUFDcEQsSUFBQSxJQUFJLElBQUksQ0FBQ3pCLGVBQWUsQ0FBQ3dFLEVBQUUsS0FBS0EsRUFBRSxFQUFFLE9BQUE7QUFFcEMsSUFBQSxJQUFJLElBQUksQ0FBQ3hFLGVBQWUsQ0FBQ2lDLEtBQUssSUFBSSxJQUFJLENBQUNqQyxlQUFlLENBQUNpQyxLQUFLLENBQUNDLFFBQVEsRUFBRTtNQUNuRSxJQUFJLENBQUNuQixvQkFBb0IsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ2YsZUFBZSxDQUFDd0UsRUFBRSxHQUFHQSxFQUFFLENBQUE7QUFFNUIsSUFBQSxJQUFJLElBQUksQ0FBQ3hFLGVBQWUsQ0FBQ2lDLEtBQUssRUFBRTtNQUM1QixJQUFJLENBQUN0QixtQkFBbUIsRUFBRSxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSXNCLEtBQUtBLEdBQUc7QUFDUixJQUFBLE9BQU8sSUFBSSxDQUFDakMsZUFBZSxDQUFDd0UsRUFBRSxDQUFBO0FBQ2xDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSVMsV0FBV0EsQ0FBQ2hELEtBQUssRUFBRTtJQUNmLE1BQU11QyxFQUFFLEdBQUd2QyxLQUFLLFlBQVk2QyxLQUFLLEdBQUc3QyxLQUFLLENBQUN1QyxFQUFFLEdBQUd2QyxLQUFLLENBQUE7QUFDcEQsSUFBQSxJQUFJLENBQUNqQyxlQUFlLENBQUN3RSxFQUFFLEdBQUdBLEVBQUUsQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ0lsRSxjQUFjQSxDQUFDdEIsTUFBTSxFQUFFO0FBQ25CLElBQUEsSUFBSUEsTUFBTSxFQUFFO01BQ1IsSUFBSSxDQUFDa0csa0JBQWtCLEVBQUUsQ0FBQTtBQUM3QixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBQSxFQUFBQSxrQkFBa0JBLEdBQUc7QUFDakI7SUFDQSxJQUFJLENBQUNDLG1CQUFtQixFQUFFLENBQUE7SUFDMUIsSUFBSSxJQUFJLENBQUNsQyxPQUFPLElBQUksSUFBSSxDQUFDakUsTUFBTSxDQUFDaUUsT0FBTyxFQUFFO01BQ3JDLElBQUksQ0FBQ21DLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQXJELEVBQUFBLG9CQUFvQkEsR0FBRztBQUVuQixJQUFBLE1BQU1RLGFBQWEsR0FBRyxJQUFJLENBQUMxQyxjQUFjLENBQUE7QUFDekMsSUFBQSxJQUFJMEMsYUFBYSxFQUFFO01BQ2YsSUFBSSxDQUFDOEMsZ0JBQWdCLEVBQUUsQ0FBQTs7QUFFdkI7TUFDQSxJQUFJLENBQUNGLG1CQUFtQixFQUFFLENBQUE7QUFFMUIsTUFBQSxLQUFLLElBQUl4RCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdZLGFBQWEsQ0FBQ1gsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMzQ1ksUUFBQUEsYUFBYSxDQUFDWixDQUFDLENBQUMsQ0FBQzJELE9BQU8sRUFBRSxDQUFBO0FBQzlCLE9BQUE7QUFDQSxNQUFBLElBQUksQ0FBQ3pGLGNBQWMsQ0FBQytCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbEMsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQXNCLEVBQUFBLFdBQVdBLEdBQUc7SUFDVixNQUFNRyxNQUFNLEdBQUcsSUFBSSxDQUFDdEUsTUFBTSxDQUFDeUIsR0FBRyxDQUFDOEMsS0FBSyxDQUFDRCxNQUFNLENBQUE7QUFDM0MsSUFBQSxLQUFLLElBQUkxQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbEMsT0FBTyxDQUFDbUMsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMxQyxNQUFBLE1BQU00QixLQUFLLEdBQUdGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDLElBQUksQ0FBQy9ELE9BQU8sQ0FBQ2tDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEQsTUFBQSxJQUFJNEIsS0FBSyxFQUFFO0FBQ1BBLFFBQUFBLEtBQUssQ0FBQ1EsZ0JBQWdCLENBQUMsSUFBSSxDQUFDbEUsY0FBYyxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUF3RixFQUFBQSxnQkFBZ0JBLEdBQUc7SUFDZixJQUFJLElBQUksQ0FBQ3hGLGNBQWMsSUFBSSxJQUFJLENBQUNBLGNBQWMsQ0FBQytCLE1BQU0sRUFBRTtNQUNuRCxNQUFNeUIsTUFBTSxHQUFHLElBQUksQ0FBQ3RFLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzhDLEtBQUssQ0FBQ0QsTUFBTSxDQUFBO0FBQzNDLE1BQUEsS0FBSyxJQUFJMUIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ21DLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsUUFBQSxNQUFNNEIsS0FBSyxHQUFHRixNQUFNLENBQUNHLFlBQVksQ0FBQyxJQUFJLENBQUMvRCxPQUFPLENBQUNrQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xELFFBQUEsSUFBSTRCLEtBQUssRUFBRTtBQUNQQSxVQUFBQSxLQUFLLENBQUNPLG1CQUFtQixDQUFDLElBQUksQ0FBQ2pFLGNBQWMsQ0FBQyxDQUFBO0FBQ2xELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQXNCLEVBQUFBLGFBQWFBLEdBQUc7SUFDWixJQUFJLENBQUNrRSxnQkFBZ0IsRUFBRSxDQUFBO0FBQzNCLEdBQUE7O0FBRUE7QUFDQWpFLEVBQUFBLGFBQWFBLEdBQUc7QUFDWixJQUFBLElBQUksSUFBSSxDQUFDdkIsY0FBYyxJQUFJLElBQUksQ0FBQ29ELE9BQU8sSUFBSSxJQUFJLENBQUNqRSxNQUFNLENBQUNpRSxPQUFPLEVBQUU7TUFDNUQsSUFBSSxDQUFDQyxXQUFXLEVBQUUsQ0FBQTtBQUN0QixLQUFBO0FBQ0osR0FBQTtBQUVBcUMsRUFBQUEsUUFBUUEsR0FBRztJQUNQLElBQUksQ0FBQ3hELG9CQUFvQixFQUFFLENBQUE7SUFFM0IsSUFBSSxDQUFDRSxLQUFLLEdBQUcsSUFBSSxDQUFBO0lBQ2pCLElBQUksQ0FBQ3VELGFBQWEsR0FBRyxJQUFJLENBQUE7QUFFekIsSUFBQSxJQUFJLENBQUN4RixlQUFlLENBQUN3RSxFQUFFLEdBQUcsSUFBSSxDQUFBO0FBRTlCLElBQUEsS0FBSyxJQUFJN0MsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMkIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtNQUN0RCxJQUFJLENBQUMxQixtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDNkMsRUFBRSxHQUFHLElBQUksQ0FBQTtBQUN6QyxLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUN4RixNQUFNLENBQUN5RyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ3RFLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNuRCxJQUFBLElBQUksQ0FBQ25DLE1BQU0sQ0FBQ3lHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDckUsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3ZELEdBQUE7QUFFQXNFLEVBQUFBLGVBQWVBLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxFQUFFO0lBQzlCLElBQUksQ0FBQzFDLFdBQVcsRUFBRSxDQUFBO0lBQ2xCeUMsT0FBTyxDQUFDRixHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ0ksWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQzNDRixPQUFPLENBQUNGLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDSyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDaERGLE9BQU8sQ0FBQ3ZGLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDd0YsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQzFDRCxPQUFPLENBQUN2RixFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ3lGLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNuRCxHQUFBO0VBRUFELFlBQVlBLENBQUN0QyxLQUFLLEVBQUU7SUFDaEIsTUFBTXdDLEtBQUssR0FBRyxJQUFJLENBQUMxQyxNQUFNLENBQUMyQyxPQUFPLENBQUN6QyxLQUFLLENBQUNpQixFQUFFLENBQUMsQ0FBQTtJQUMzQyxJQUFJdUIsS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFBO0FBQ2Z4QyxJQUFBQSxLQUFLLENBQUNRLGdCQUFnQixDQUFDLElBQUksQ0FBQ2xFLGNBQWMsQ0FBQyxDQUFBO0FBQy9DLEdBQUE7RUFFQWlHLGNBQWNBLENBQUN2QyxLQUFLLEVBQUU7SUFDbEIsTUFBTXdDLEtBQUssR0FBRyxJQUFJLENBQUMxQyxNQUFNLENBQUMyQyxPQUFPLENBQUN6QyxLQUFLLENBQUNpQixFQUFFLENBQUMsQ0FBQTtJQUMzQyxJQUFJdUIsS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFBO0FBQ2Z4QyxJQUFBQSxLQUFLLENBQUNPLG1CQUFtQixDQUFDLElBQUksQ0FBQ2pFLGNBQWMsQ0FBQyxDQUFBO0FBQ2xELEdBQUE7QUFFQW9HLEVBQUFBLFFBQVFBLEdBQUc7QUFDUCxJQUFBLE1BQU16RixHQUFHLEdBQUcsSUFBSSxDQUFDekIsTUFBTSxDQUFDeUIsR0FBRyxDQUFBO0FBQzNCLElBQUEsTUFBTThDLEtBQUssR0FBRzlDLEdBQUcsQ0FBQzhDLEtBQUssQ0FBQTtBQUV2QixJQUFBLElBQUksQ0FBQ25ELFNBQVMsQ0FBQytGLHVCQUF1QixFQUFFLENBQUE7SUFFeEMsSUFBSSxDQUFDZCxtQkFBbUIsRUFBRSxDQUFBO0lBRTFCOUIsS0FBSyxDQUFDakQsRUFBRSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNxRixlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDbEQsSUFBSXBDLEtBQUssQ0FBQ0QsTUFBTSxFQUFFO0FBQ2RDLE1BQUFBLEtBQUssQ0FBQ0QsTUFBTSxDQUFDaEQsRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUN3RixZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDL0N2QyxNQUFBQSxLQUFLLENBQUNELE1BQU0sQ0FBQ2hELEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDeUYsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3hELEtBQUE7QUFFQSxJQUFBLE1BQU1LLE9BQU8sR0FBSSxJQUFJLENBQUNsSCxLQUFLLEtBQUssT0FBUSxDQUFBO0lBQ3hDLElBQUksSUFBSSxDQUFDWSxjQUFjLElBQUksSUFBSSxDQUFDQSxjQUFjLENBQUMrQixNQUFNLEVBQUU7TUFDbkQsSUFBSSxDQUFDc0IsV0FBVyxFQUFFLENBQUE7QUFDdEIsS0FBQyxNQUFNLElBQUlpRCxPQUFPLElBQUksSUFBSSxDQUFDbEUsS0FBSyxFQUFFO01BQzlCLElBQUksQ0FBQ3RCLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxJQUFJZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMkIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtNQUN0RCxJQUFJLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUNNLEtBQUssRUFBRTtBQUNuQyxRQUFBLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxDQUFDRyxJQUFJLENBQUMsSUFBSSxDQUFDWCxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDTSxLQUFLLENBQUMsQ0FBQTtBQUNsRSxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSSxJQUFJLENBQUN6QyxhQUFhLElBQUksQ0FBQyxFQUFFO0FBQUEsTUFBQSxJQUFBNEcsWUFBQSxDQUFBO01BQ3pCLENBQUFBLFlBQUEsR0FBQTVGLEdBQUcsQ0FBQzBELE9BQU8sS0FBWGtDLElBQUFBLElBQUFBLFlBQUEsQ0FBYTlCLE1BQU0sQ0FBQ0gsVUFBVSxDQUFDQyxNQUFNLEVBQUUsSUFBSSxDQUFDSixZQUFZLEVBQUUsSUFBSSxDQUFDaEYsTUFBTSxDQUFDLENBQUE7QUFDMUUsS0FBQTtBQUNKLEdBQUE7QUFFQXFILEVBQUFBLFNBQVNBLEdBQUc7QUFDUixJQUFBLE1BQU03RixHQUFHLEdBQUcsSUFBSSxDQUFDekIsTUFBTSxDQUFDeUIsR0FBRyxDQUFBO0FBQzNCLElBQUEsTUFBTThDLEtBQUssR0FBRzlDLEdBQUcsQ0FBQzhDLEtBQUssQ0FBQTtJQUV2QkEsS0FBSyxDQUFDbUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNDLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNuRCxJQUFJcEMsS0FBSyxDQUFDRCxNQUFNLEVBQUU7QUFDZEMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUNvQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ0ksWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2hEdkMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUNvQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0ssY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3pELEtBQUE7QUFFQSxJQUFBLElBQUksSUFBSSxDQUFDdEcsYUFBYSxJQUFJLENBQUMsRUFBRTtBQUFBLE1BQUEsSUFBQThHLGFBQUEsQ0FBQTtNQUN6QixDQUFBQSxhQUFBLEdBQUE5RixHQUFHLENBQUMwRCxPQUFPLEtBQVhvQyxJQUFBQSxJQUFBQSxhQUFBLENBQWF4RixNQUFNLENBQUNxRCxVQUFVLENBQUNDLE1BQU0sRUFBRSxJQUFJLENBQUNKLFlBQVksRUFBRSxJQUFJLENBQUNoRixNQUFNLENBQUMsQ0FBQTtBQUMxRSxLQUFBO0lBRUEsSUFBSSxDQUFDcUcsZ0JBQWdCLEVBQUUsQ0FBQTtBQUMzQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJa0IsRUFBQUEsSUFBSUEsR0FBRztJQUNILElBQUksSUFBSSxDQUFDMUcsY0FBYyxFQUFFO0FBQ3JCLE1BQUEsS0FBSyxJQUFJOEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlCLGNBQWMsQ0FBQytCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7UUFDakQsSUFBSSxDQUFDOUIsY0FBYyxDQUFDOEIsQ0FBQyxDQUFDLENBQUM2RSxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQzFDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLElBQUlBLEdBQUc7SUFDSCxJQUFJLElBQUksQ0FBQzVHLGNBQWMsRUFBRTtBQUNyQixNQUFBLEtBQUssSUFBSThCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUM5QixjQUFjLENBQUMrQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO1FBQ2pELElBQUksQ0FBQzlCLGNBQWMsQ0FBQzhCLENBQUMsQ0FBQyxDQUFDNkUsT0FBTyxHQUFHLElBQUksQ0FBQTtBQUN6QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQTdGLEVBQUFBLG1CQUFtQkEsR0FBRztBQUNsQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNYLGVBQWUsQ0FBQ2lDLEtBQUssRUFBRSxPQUFBO0FBRWpDLElBQUEsSUFBSSxJQUFJLENBQUNqQyxlQUFlLENBQUNpQyxLQUFLLENBQUNDLFFBQVEsRUFBRTtNQUNyQyxJQUFJLENBQUNyQixrQkFBa0IsRUFBRSxDQUFBO0tBQzVCLE1BQU0sSUFBSSxJQUFJLENBQUNvQyxPQUFPLElBQUksSUFBSSxDQUFDakUsTUFBTSxDQUFDaUUsT0FBTyxFQUFFO0FBQzVDLE1BQUEsSUFBSSxDQUFDbEUsTUFBTSxDQUFDeUIsR0FBRyxDQUFDQyxNQUFNLENBQUNHLElBQUksQ0FBQyxJQUFJLENBQUNaLGVBQWUsQ0FBQ2lDLEtBQUssQ0FBQyxDQUFBO0FBQzNELEtBQUE7QUFDSixHQUFBO0FBRUFwQixFQUFBQSxrQkFBa0JBLEdBQUc7QUFFakI7SUFDQSxJQUFJLENBQUNrQixvQkFBb0IsRUFBRSxDQUFBO0FBRTNCLElBQUEsSUFBSSxJQUFJLENBQUMvQixlQUFlLENBQUNpQyxLQUFLLEVBQUU7TUFDNUIsTUFBTXlFLE1BQU0sR0FBRyxJQUFJLENBQUMxRyxlQUFlLENBQUNpQyxLQUFLLENBQUNDLFFBQVEsQ0FBQTtNQUNsRHdFLE1BQU0sQ0FBQ2pCLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDa0IsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO01BQ2pERCxNQUFNLENBQUNyRyxFQUFFLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQ3NHLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtNQUNoRCxJQUFJRCxNQUFNLENBQUNFLE1BQU0sRUFBRTtBQUNmLFFBQUEsSUFBSSxDQUFDRCxZQUFZLENBQUNELE1BQU0sQ0FBQ0UsTUFBTSxDQUFDLENBQUE7QUFDcEMsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUFELFlBQVlBLENBQUNDLE1BQU0sRUFBRTtBQUNqQixJQUFBLElBQUksQ0FBQ0MsWUFBWSxDQUFDRCxNQUFNLENBQUMsQ0FBQTtBQUM3QixHQUFBO0FBRUF6QixFQUFBQSxtQkFBbUJBLEdBQUc7QUFFbEIsSUFBQSxLQUFLLElBQUl4RCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDOUIsY0FBYyxDQUFDK0IsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNqRCxNQUFBLE1BQU1tRixZQUFZLEdBQUcsSUFBSSxDQUFDakgsY0FBYyxDQUFDOEIsQ0FBQyxDQUFDLENBQUE7O0FBRTNDO0FBQ0FvRixNQUFBQSxpQkFBaUIsQ0FBQ0Msd0JBQXdCLENBQUNGLFlBQVksQ0FBQ0csWUFBWSxDQUFDLENBQUE7TUFDckVILFlBQVksQ0FBQ0csWUFBWSxHQUFHLElBQUksQ0FBQTtBQUNwQyxLQUFBO0FBQ0osR0FBQTtBQUVBN0IsRUFBQUEsbUJBQW1CQSxHQUFHO0FBRWxCLElBQUEsSUFBSSxJQUFJLENBQUN2RixjQUFjLENBQUMrQixNQUFNLElBQUksSUFBSSxDQUFDekIsU0FBUyxDQUFDbkIsTUFBTSxZQUFZa0ksU0FBUyxFQUFFO0FBRTFFLE1BQUEsS0FBSyxJQUFJdkYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlCLGNBQWMsQ0FBQytCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDakQsUUFBQSxNQUFNbUYsWUFBWSxHQUFHLElBQUksQ0FBQ2pILGNBQWMsQ0FBQzhCLENBQUMsQ0FBQyxDQUFBO0FBQzNDLFFBQUEsTUFBTWEsSUFBSSxHQUFHc0UsWUFBWSxDQUFDdEUsSUFBSSxDQUFBOztBQUU5QjtRQUNBLElBQUlBLElBQUksQ0FBQzJFLElBQUksSUFBSSxDQUFDTCxZQUFZLENBQUNHLFlBQVksRUFBRTtVQUN6Q0gsWUFBWSxDQUFDRyxZQUFZLEdBQUdGLGlCQUFpQixDQUFDSyx3QkFBd0IsQ0FBQzVFLElBQUksQ0FBQzJFLElBQUksRUFBRSxJQUFJLENBQUNoSCxTQUFTLENBQUNuQixNQUFNLEVBQUUsSUFBSSxDQUFDQSxNQUFNLENBQUMsQ0FBQTtBQUN6SCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUE2SCxZQUFZQSxDQUFDRCxNQUFNLEVBQUU7QUFFakIsSUFBQSxJQUFJQSxNQUFNLElBQUlBLE1BQU0sQ0FBQ2hGLE1BQU0sRUFBRTtBQUV6QjtNQUNBLE1BQU1XLGFBQWEsR0FBRyxFQUFFLENBQUE7QUFFeEIsTUFBQSxLQUFLLElBQUlaLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2lGLE1BQU0sQ0FBQ2hGLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFFcEM7QUFDQSxRQUFBLE1BQU1hLElBQUksR0FBR29FLE1BQU0sQ0FBQ2pGLENBQUMsQ0FBQyxDQUFBO1FBQ3RCLE1BQU1LLFFBQVEsR0FBRyxJQUFJLENBQUMvQixtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUNNLEtBQUssSUFBSSxJQUFJLENBQUNoQyxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDTSxLQUFLLENBQUNDLFFBQVEsQ0FBQTtBQUMvSCxRQUFBLE1BQU1tRixRQUFRLEdBQUcsSUFBSS9GLFlBQVksQ0FBQ2tCLElBQUksRUFBRVIsUUFBUSxJQUFJLElBQUksQ0FBQ2pELE1BQU0sQ0FBQ21DLGVBQWUsRUFBRSxJQUFJLENBQUNsQyxNQUFNLENBQUMsQ0FBQTtBQUM3RnVELFFBQUFBLGFBQWEsQ0FBQ2tDLElBQUksQ0FBQzRDLFFBQVEsQ0FBQyxDQUFBOztBQUU1QjtRQUNBLElBQUk3RSxJQUFJLENBQUM4RSxLQUFLLEVBQUU7VUFDWkQsUUFBUSxDQUFDRSxhQUFhLEdBQUcsSUFBSUMsYUFBYSxDQUFDaEYsSUFBSSxDQUFDOEUsS0FBSyxDQUFDLENBQUE7QUFDMUQsU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLENBQUMvRSxhQUFhLEdBQUdBLGFBQWEsQ0FBQTs7QUFFbEM7TUFDQSxJQUFJLENBQUM2QyxtQkFBbUIsRUFBRSxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0FBRUFuRSxFQUFBQSxvQkFBb0JBLEdBQUc7QUFFbkI7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDaEMsS0FBSyxLQUFLLE9BQU8sRUFBRTtNQUN4QixJQUFJLENBQUM4QyxvQkFBb0IsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBO0FBRUFoQixFQUFBQSxvQkFBb0JBLEdBQUc7QUFDbkIsSUFBQSxJQUFJLElBQUksQ0FBQ2YsZUFBZSxDQUFDaUMsS0FBSyxJQUFJLElBQUksQ0FBQ2pDLGVBQWUsQ0FBQ2lDLEtBQUssQ0FBQ0MsUUFBUSxFQUFFO0FBQ25FLE1BQUEsSUFBSSxDQUFDbEMsZUFBZSxDQUFDaUMsS0FBSyxDQUFDQyxRQUFRLENBQUN1RCxHQUFHLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQ2tCLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNsRixLQUFBO0lBRUEsSUFBSSxDQUFDMUYsb0JBQW9CLEVBQUUsQ0FBQTtBQUMvQixHQUFBO0FBRUF5RCxFQUFBQSxnQkFBZ0JBLENBQUNxQixLQUFLLEVBQUUwQixTQUFTLEVBQUV4RixLQUFLLEVBQUU7SUFDdEMsSUFBSUEsS0FBSyxDQUFDQyxRQUFRLEVBQUU7TUFDaEIsSUFBSSxDQUFDeUMsZUFBZSxDQUFDb0IsS0FBSyxFQUFFMEIsU0FBUyxFQUFFeEYsS0FBSyxDQUFDLENBQUE7QUFDakQsS0FBQyxNQUFNO01BQ0gsSUFBSSxJQUFJLENBQUNnQixPQUFPLElBQUksSUFBSSxDQUFDakUsTUFBTSxDQUFDaUUsT0FBTyxFQUFFO1FBQ3JDLElBQUksQ0FBQ2xFLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxDQUFDRyxJQUFJLENBQUNxQixLQUFLLENBQUMsQ0FBQTtBQUN0QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQXlGLEVBQUFBLG1CQUFtQkEsQ0FBQzNCLEtBQUssRUFBRS9ELFFBQVEsRUFBRTtBQUNqQztJQUNBLElBQUkrRCxLQUFLLEtBQUssQ0FBQyxFQUFFO01BQ2IsSUFBSSxDQUFDL0QsUUFBUSxHQUFHQSxRQUFRLENBQUE7QUFDNUIsS0FBQTtBQUNKLEdBQUE7QUFFQTJDLEVBQUFBLGVBQWVBLENBQUNvQixLQUFLLEVBQUUwQixTQUFTLEVBQUV4RixLQUFLLEVBQUU7QUFDckMsSUFBQSxJQUFJLElBQUksQ0FBQ3BDLGNBQWMsQ0FBQ2tHLEtBQUssQ0FBQyxFQUFFO01BQzVCLElBQUksQ0FBQ2xHLGNBQWMsQ0FBQ2tHLEtBQUssQ0FBQyxDQUFDL0QsUUFBUSxHQUFHQyxLQUFLLENBQUNDLFFBQVEsQ0FBQTtBQUN4RCxLQUFBO0lBQ0EsSUFBSSxDQUFDd0YsbUJBQW1CLENBQUMzQixLQUFLLEVBQUU5RCxLQUFLLENBQUNDLFFBQVEsQ0FBQyxDQUFBO0FBQ25ELEdBQUE7QUFFQTBDLEVBQUFBLGlCQUFpQkEsQ0FBQ21CLEtBQUssRUFBRTBCLFNBQVMsRUFBRXhGLEtBQUssRUFBRTtBQUN2QyxJQUFBLElBQUksSUFBSSxDQUFDcEMsY0FBYyxDQUFDa0csS0FBSyxDQUFDLEVBQUU7QUFDNUIsTUFBQSxJQUFJLENBQUNsRyxjQUFjLENBQUNrRyxLQUFLLENBQUMsQ0FBQy9ELFFBQVEsR0FBRyxJQUFJLENBQUNqRCxNQUFNLENBQUNtQyxlQUFlLENBQUE7QUFDckUsS0FBQTtJQUNBLElBQUksQ0FBQ3dHLG1CQUFtQixDQUFDM0IsS0FBSyxFQUFFLElBQUksQ0FBQ2hILE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQyxDQUFBO0FBQ2hFLEdBQUE7QUFFQTJELEVBQUFBLGlCQUFpQkEsQ0FBQ2tCLEtBQUssRUFBRTBCLFNBQVMsRUFBRXhGLEtBQUssRUFBRTtBQUN2QyxJQUFBLElBQUksSUFBSSxDQUFDcEMsY0FBYyxDQUFDa0csS0FBSyxDQUFDLEVBQUU7QUFDNUIsTUFBQSxJQUFJLENBQUNsRyxjQUFjLENBQUNrRyxLQUFLLENBQUMsQ0FBQy9ELFFBQVEsR0FBRyxJQUFJLENBQUNqRCxNQUFNLENBQUNtQyxlQUFlLENBQUE7QUFDckUsS0FBQTtJQUNBLElBQUksQ0FBQ3dHLG1CQUFtQixDQUFDM0IsS0FBSyxFQUFFLElBQUksQ0FBQ2hILE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQyxDQUFBO0FBQ2hFLEdBQUE7QUFFQXlHLEVBQUFBLDBDQUEwQ0EsQ0FBQ0MsU0FBUyxFQUFFQyxnQkFBZ0IsRUFBRTtJQUNwRSxJQUFJRCxTQUFTLENBQUNFLFFBQVEsSUFBSUQsZ0JBQWdCLENBQUNELFNBQVMsQ0FBQ0UsUUFBUSxDQUFDLEVBQUU7TUFDNUQsSUFBSSxDQUFDQSxRQUFRLEdBQUdELGdCQUFnQixDQUFDRCxTQUFTLENBQUNFLFFBQVEsQ0FBQyxDQUFBO0FBQ3hELEtBQUE7SUFDQSxJQUFJLENBQUMzQyxtQkFBbUIsRUFBRSxDQUFBO0FBQzlCLEdBQUE7QUFDSjs7OzsifQ==
