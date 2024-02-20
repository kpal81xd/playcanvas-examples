import { LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';

/**
 * Enables an Entity to render a Gaussian Splat (asset of the 'gsplat' type).
 *
 * @augments Component
 * @category Graphics
 */
class GSplatComponent extends Component {
  /**
   * Create a new GSplatComponent.
   *
   * @param {import('./system.js').GSplatComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    // gsplat asset reference
    /** @private */
    this._layers = [LAYERID_WORLD];
    // assign to the default world layer
    /**
     * @type {import('../../../scene/gsplat/gsplat-instance.js').GSplatInstance|null}
     * @private
     */
    this._instance = null;
    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    this._customAabb = null;
    /**
     * @type {AssetReference}
     * @private
     */
    this._assetReference = void 0;
    /**
     * @type {import('../../../scene/gsplat/gsplat-material.js').SplatMaterialOptions|null}
     * @private
     */
    this._materialOptions = null;
    this._assetReference = new AssetReference('asset', this, system.app.assets, {
      add: this._onGSplatAssetAdded,
      load: this._onGSplatAssetLoad,
      remove: this._onGSplatAssetRemove,
      unload: this._onGSplatAssetUnload
    }, this);

    // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
    // added or removed from the parent
    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  /**
   * If set, the object space bounding box is used as a bounding box for visibility culling of
   * attached gsplat. This allows a custom bounding box to be specified.
   *
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox}
   */
  set customAabb(value) {
    var _this$_instance;
    this._customAabb = value;

    // set it on meshInstance
    (_this$_instance = this._instance) == null || _this$_instance.meshInstance.setCustomAabb(this._customAabb);
  }
  get customAabb() {
    return this._customAabb;
  }

  /**
   * A {@link GSplatInstance} contained in the component. If not set or loaded, it returns null.
   *
   * @ignore
   */
  set instance(value) {
    // destroy existing instance
    this.destroyInstance();
    this._instance = value;
    if (this._instance) {
      // if mesh instance was created without a node, assign it here
      const mi = this._instance.meshInstance;
      if (!mi.node) {
        mi.node = this.entity;
      }
      mi.setCustomAabb(this._customAabb);

      // if we have custom shader options, apply them
      if (this._materialOptions) {
        this._instance.createMaterial(this._materialOptions);
      }
      if (this.enabled && this.entity.enabled) {
        this.addToLayers();
      }
    }
  }
  get instance() {
    return this._instance;
  }
  set materialOptions(value) {
    this._materialOptions = Object.assign({}, value);

    // apply them on the instance if it exists
    if (this._instance) {
      this._instance.createMaterial(this._materialOptions);
    }
  }
  get materialOptions() {
    return this._materialOptions;
  }

  /**
   * Material used to render the gsplat.
   *
   * @type {import('../../../scene/materials/material.js').Material|undefined}
   */
  get material() {
    var _this$_instance2;
    return (_this$_instance2 = this._instance) == null ? void 0 : _this$_instance2.material;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which gsplats should belong. Don't push, pop,
   * splice or modify this array, if you want to change it - set a new one instead.
   *
   * @type {number[]}
   */
  set layers(value) {
    // remove the mesh instances from old layers
    this.removeFromLayers();

    // set the layer list
    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    // don't add into layers until we're enabled
    if (!this.enabled || !this.entity.enabled) return;

    // add the mesh instance to new layers
    this.addToLayers();
  }
  get layers() {
    return this._layers;
  }

  /**
   * The gsplat asset for the gsplat component - can also be an asset id.
   *
   * @type {Asset|number}
   */
  set asset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._assetReference.id === id) return;
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._onGSplatAssetRemove();
    }
    this._assetReference.id = id;
    if (this._assetReference.asset) {
      this._onGSplatAssetAdded();
    }
  }
  get asset() {
    return this._assetReference.id;
  }

  /**
   * Assign asset id to the component, without updating the component with the new asset.
   * This can be used to assign the asset id to already fully created component.
   *
   * @param {Asset|number} asset - The gsplat asset or asset id to assign.
   * @ignore
   */
  assignAsset(asset) {
    const id = asset instanceof Asset ? asset.id : asset;
    this._assetReference.id = id;
  }

  /** @private */
  destroyInstance() {
    if (this._instance) {
      var _this$_instance3;
      this.removeFromLayers();
      (_this$_instance3 = this._instance) == null || _this$_instance3.destroy();
      this._instance = null;
    }
  }

  /** @private */
  addToLayers() {
    var _this$instance;
    const meshInstance = (_this$instance = this.instance) == null ? void 0 : _this$instance.meshInstance;
    if (meshInstance) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        var _layers$getLayerById;
        (_layers$getLayerById = layers.getLayerById(this._layers[i])) == null || _layers$getLayerById.addMeshInstances([meshInstance]);
      }
    }
  }
  removeFromLayers() {
    var _this$instance2;
    const meshInstance = (_this$instance2 = this.instance) == null ? void 0 : _this$instance2.meshInstance;
    if (meshInstance) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        var _layers$getLayerById2;
        (_layers$getLayerById2 = layers.getLayerById(this._layers[i])) == null || _layers$getLayerById2.removeMeshInstances([meshInstance]);
      }
    }
  }

  /** @private */
  onRemoveChild() {
    this.removeFromLayers();
  }

  /** @private */
  onInsertChild() {
    if (this._instance && this.enabled && this.entity.enabled) {
      this.addToLayers();
    }
  }
  onRemove() {
    this.destroyInstance();
    this.asset = null;
    this._assetReference.id = null;
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
    if (this._instance) {
      layer.addMeshInstances(this._instance.meshInstance);
    }
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._instance) {
      layer.removeMeshInstances(this._instance.meshInstance);
    }
  }
  onEnable() {
    const scene = this.system.app.scene;
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    if (this._instance) {
      this.addToLayers();
    } else if (this.asset) {
      this._onGSplatAssetAdded();
    }
  }
  onDisable() {
    const scene = this.system.app.scene;
    scene.off('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this.onLayerAdded, this);
      scene.layers.off('remove', this.onLayerRemoved, this);
    }
    this.removeFromLayers();
  }

  /**
   * Stop rendering this component without removing its mesh instance from the scene hierarchy.
   */
  hide() {
    if (this._instance) {
      this._instance.meshInstance.visible = false;
    }
  }

  /**
   * Enable rendering of the component if hidden using {@link GSplatComponent#hide}.
   */
  show() {
    if (this._instance) {
      this._instance.meshInstance.visible = true;
    }
  }
  _onGSplatAssetAdded() {
    if (!this._assetReference.asset) return;
    if (this._assetReference.asset.resource) {
      this._onGSplatAssetLoad();
    } else if (this.enabled && this.entity.enabled) {
      this.system.app.assets.load(this._assetReference.asset);
    }
  }
  _onGSplatAssetLoad() {
    // remove existing instance
    this.destroyInstance();

    // create new instance
    const asset = this._assetReference.asset;
    if (asset) {
      this.instance = asset.resource.createInstance();
    }
  }
  _onGSplatAssetUnload() {
    // when unloading asset, only remove the instance
    this.destroyInstance();
  }
  _onGSplatAssetRemove() {
    this._onGSplatAssetUnload();
  }
}

export { GSplatComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZ3NwbGF0L2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxEIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQXNzZXRSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC1yZWZlcmVuY2UuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBHYXVzc2lhbiBTcGxhdCAoYXNzZXQgb2YgdGhlICdnc3BsYXQnIHR5cGUpLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5jbGFzcyBHU3BsYXRDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRF07IC8vIGFzc2lnbiB0byB0aGUgZGVmYXVsdCB3b3JsZCBsYXllclxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvZ3NwbGF0L2dzcGxhdC1pbnN0YW5jZS5qcycpLkdTcGxhdEluc3RhbmNlfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5zdGFuY2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0UmVmZXJlbmNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvZ3NwbGF0L2dzcGxhdC1tYXRlcmlhbC5qcycpLlNwbGF0TWF0ZXJpYWxPcHRpb25zfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxPcHRpb25zID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBHU3BsYXRDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5HU3BsYXRDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8vIGdzcGxhdCBhc3NldCByZWZlcmVuY2VcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UgPSBuZXcgQXNzZXRSZWZlcmVuY2UoXG4gICAgICAgICAgICAnYXNzZXQnLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHN5c3RlbS5hcHAuYXNzZXRzLCB7XG4gICAgICAgICAgICAgICAgYWRkOiB0aGlzLl9vbkdTcGxhdEFzc2V0QWRkZWQsXG4gICAgICAgICAgICAgICAgbG9hZDogdGhpcy5fb25HU3BsYXRBc3NldExvYWQsXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiB0aGlzLl9vbkdTcGxhdEFzc2V0UmVtb3ZlLFxuICAgICAgICAgICAgICAgIHVubG9hZDogdGhpcy5fb25HU3BsYXRBc3NldFVubG9hZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRoaXNcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBoYW5kbGUgZXZlbnRzIHdoZW4gdGhlIGVudGl0eSBpcyBkaXJlY3RseSAob3IgaW5kaXJlY3RseSBhcyBhIGNoaWxkIG9mIHN1Yi1oaWVyYXJjaHkpXG4gICAgICAgIC8vIGFkZGVkIG9yIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmVoaWVyYXJjaHknLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0aGllcmFyY2h5JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIGdzcGxhdC4gVGhpcyBhbGxvd3MgYSBjdXN0b20gYm91bmRpbmcgYm94IHRvIGJlIHNwZWNpZmllZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VcbiAgICAgICAgdGhpcy5faW5zdGFuY2U/Lm1lc2hJbnN0YW5jZS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBHU3BsYXRJbnN0YW5jZX0gY29udGFpbmVkIGluIHRoZSBjb21wb25lbnQuIElmIG5vdCBzZXQgb3IgbG9hZGVkLCBpdCByZXR1cm5zIG51bGwuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0IGluc3RhbmNlKHZhbHVlKSB7XG5cbiAgICAgICAgLy8gZGVzdHJveSBleGlzdGluZyBpbnN0YW5jZVxuICAgICAgICB0aGlzLmRlc3Ryb3lJbnN0YW5jZSgpO1xuXG4gICAgICAgIHRoaXMuX2luc3RhbmNlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX2luc3RhbmNlKSB7XG5cbiAgICAgICAgICAgIC8vIGlmIG1lc2ggaW5zdGFuY2Ugd2FzIGNyZWF0ZWQgd2l0aG91dCBhIG5vZGUsIGFzc2lnbiBpdCBoZXJlXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX2luc3RhbmNlLm1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgIGlmICghbWkubm9kZSkge1xuICAgICAgICAgICAgICAgIG1pLm5vZGUgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWkuc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcblxuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBjdXN0b20gc2hhZGVyIG9wdGlvbnMsIGFwcGx5IHRoZW1cbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbE9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YW5jZS5jcmVhdGVNYXRlcmlhbCh0aGlzLl9tYXRlcmlhbE9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaW5zdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWxPcHRpb25zKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHZhbHVlKTtcblxuICAgICAgICAvLyBhcHBseSB0aGVtIG9uIHRoZSBpbnN0YW5jZSBpZiBpdCBleGlzdHNcbiAgICAgICAgaWYgKHRoaXMuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnN0YW5jZS5jcmVhdGVNYXRlcmlhbCh0aGlzLl9tYXRlcmlhbE9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsT3B0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsT3B0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXRlcmlhbCB1c2VkIHRvIHJlbmRlciB0aGUgZ3NwbGF0LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx8dW5kZWZpbmVkfVxuICAgICAqL1xuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2luc3RhbmNlPy5tYXRlcmlhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIGdzcGxhdHMgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcblxuICAgICAgICAvLyByZW1vdmUgdGhlIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gYWRkIHRoZSBtZXNoIGluc3RhbmNlIHRvIG5ldyBsYXllcnNcbiAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGdzcGxhdCBhc3NldCBmb3IgdGhlIGdzcGxhdCBjb21wb25lbnQgLSBjYW4gYWxzbyBiZSBhbiBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFzc2V0KHZhbHVlKSB7XG5cbiAgICAgICAgY29uc3QgaWQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0ID8gdmFsdWUuaWQgOiB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID09PSBpZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCAmJiB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25HU3BsYXRBc3NldFJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBpZDtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX29uR1NwbGF0QXNzZXRBZGRlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIGFzc2V0IGlkIHRvIHRoZSBjb21wb25lbnQsIHdpdGhvdXQgdXBkYXRpbmcgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBuZXcgYXNzZXQuXG4gICAgICogVGhpcyBjYW4gYmUgdXNlZCB0byBhc3NpZ24gdGhlIGFzc2V0IGlkIHRvIGFscmVhZHkgZnVsbHkgY3JlYXRlZCBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fG51bWJlcn0gYXNzZXQgLSBUaGUgZ3NwbGF0IGFzc2V0IG9yIGFzc2V0IGlkIHRvIGFzc2lnbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXNzaWduQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgY29uc3QgaWQgPSBhc3NldCBpbnN0YW5jZW9mIEFzc2V0ID8gYXNzZXQuaWQgOiBhc3NldDtcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBpZDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBkZXN0cm95SW5zdGFuY2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgICAgICAgICB0aGlzLl9pbnN0YW5jZT8uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5faW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYWRkVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuaW5zdGFuY2U/Lm1lc2hJbnN0YW5jZTtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pPy5hZGRNZXNoSW5zdGFuY2VzKFttZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuaW5zdGFuY2U/Lm1lc2hJbnN0YW5jZTtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pPy5yZW1vdmVNZXNoSW5zdGFuY2VzKFttZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIG9uUmVtb3ZlQ2hpbGQoKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbUxheWVycygpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIG9uSW5zZXJ0Q2hpbGQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnN0YW5jZSAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveUluc3RhbmNlKCk7XG5cbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID0gbnVsbDtcblxuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5faW5zdGFuY2UubWVzaEluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX2luc3RhbmNlLm1lc2hJbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmU7XG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5faW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9vbkdTcGxhdEFzc2V0QWRkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmU7XG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHJlbmRlcmluZyB0aGlzIGNvbXBvbmVudCB3aXRob3V0IHJlbW92aW5nIGl0cyBtZXNoIGluc3RhbmNlIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeS5cbiAgICAgKi9cbiAgICBoaWRlKCkge1xuICAgICAgICBpZiAodGhpcy5faW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHRoZSBjb21wb25lbnQgaWYgaGlkZGVuIHVzaW5nIHtAbGluayBHU3BsYXRDb21wb25lbnQjaGlkZX0uXG4gICAgICovXG4gICAgc2hvdygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnN0YW5jZS5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25HU3BsYXRBc3NldEFkZGVkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25HU3BsYXRBc3NldExvYWQoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkdTcGxhdEFzc2V0TG9hZCgpIHtcblxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmcgaW5zdGFuY2VcbiAgICAgICAgdGhpcy5kZXN0cm95SW5zdGFuY2UoKTtcblxuICAgICAgICAvLyBjcmVhdGUgbmV3IGluc3RhbmNlXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQ7XG4gICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZSA9IGFzc2V0LnJlc291cmNlLmNyZWF0ZUluc3RhbmNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25HU3BsYXRBc3NldFVubG9hZCgpIHtcbiAgICAgICAgLy8gd2hlbiB1bmxvYWRpbmcgYXNzZXQsIG9ubHkgcmVtb3ZlIHRoZSBpbnN0YW5jZVxuICAgICAgICB0aGlzLmRlc3Ryb3lJbnN0YW5jZSgpO1xuICAgIH1cblxuICAgIF9vbkdTcGxhdEFzc2V0UmVtb3ZlKCkge1xuICAgICAgICB0aGlzLl9vbkdTcGxhdEFzc2V0VW5sb2FkKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHU3BsYXRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJHU3BsYXRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiX2luc3RhbmNlIiwiX2N1c3RvbUFhYmIiLCJfYXNzZXRSZWZlcmVuY2UiLCJfbWF0ZXJpYWxPcHRpb25zIiwiQXNzZXRSZWZlcmVuY2UiLCJhcHAiLCJhc3NldHMiLCJhZGQiLCJfb25HU3BsYXRBc3NldEFkZGVkIiwibG9hZCIsIl9vbkdTcGxhdEFzc2V0TG9hZCIsInJlbW92ZSIsIl9vbkdTcGxhdEFzc2V0UmVtb3ZlIiwidW5sb2FkIiwiX29uR1NwbGF0QXNzZXRVbmxvYWQiLCJvbiIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwiY3VzdG9tQWFiYiIsInZhbHVlIiwiX3RoaXMkX2luc3RhbmNlIiwibWVzaEluc3RhbmNlIiwic2V0Q3VzdG9tQWFiYiIsImluc3RhbmNlIiwiZGVzdHJveUluc3RhbmNlIiwibWkiLCJub2RlIiwiY3JlYXRlTWF0ZXJpYWwiLCJlbmFibGVkIiwiYWRkVG9MYXllcnMiLCJtYXRlcmlhbE9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJtYXRlcmlhbCIsIl90aGlzJF9pbnN0YW5jZTIiLCJsYXllcnMiLCJyZW1vdmVGcm9tTGF5ZXJzIiwibGVuZ3RoIiwiaSIsImFzc2V0IiwiaWQiLCJBc3NldCIsInJlc291cmNlIiwiYXNzaWduQXNzZXQiLCJfdGhpcyRfaW5zdGFuY2UzIiwiZGVzdHJveSIsIl90aGlzJGluc3RhbmNlIiwic2NlbmUiLCJfbGF5ZXJzJGdldExheWVyQnlJZCIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJfdGhpcyRpbnN0YW5jZTIiLCJfbGF5ZXJzJGdldExheWVyQnlJZDIiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwib25SZW1vdmUiLCJvZmYiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwibGF5ZXIiLCJpbmRleCIsImluZGV4T2YiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsImhpZGUiLCJ2aXNpYmxlIiwic2hvdyIsImNyZWF0ZUluc3RhbmNlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGVBQWUsU0FBU0MsU0FBUyxDQUFDO0FBNEJw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