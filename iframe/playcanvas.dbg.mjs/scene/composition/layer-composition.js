import { TRACEID_RENDER_ACTION } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { sortPriority } from '../../core/sort.js';
import { LAYERID_DEPTH } from '../constants.js';
import { RenderAction } from './render-action.js';

/**
 * Layer Composition is a collection of {@link Layer} that is fed to {@link Scene#layers} to define
 * rendering order.
 *
 * @augments EventHandler
 * @category Graphics
 */
class LayerComposition extends EventHandler {
  /**
   * Create a new layer composition.
   *
   * @param {string} [name] - Optional non-unique name of the layer composition. Defaults to
   * "Untitled" if not specified.
   */
  constructor(name = 'Untitled') {
    super();
    // Composition can hold only 2 sublayers of each layer
    /**
     * A read-only array of {@link Layer} sorted in the order they will be rendered.
     *
     * @type {import('../layer.js').Layer[]}
     */
    this.layerList = [];
    /**
     * A mapping of {@link Layer#id} to {@link Layer}.
     *
     * @type {Map<number, import('../layer.js').Layer>}
     * @ignore
     */
    this.layerIdMap = new Map();
    /**
     * A mapping of {@link Layer#name} to {@link Layer}.
     *
     * @type {Map<string, import('../layer.js').Layer>}
     * @ignore
     */
    this.layerNameMap = new Map();
    /**
     * A mapping of {@link Layer} to its opaque index in {@link LayerComposition#layerList}.
     *
     * @type {Map<import('../layer.js').Layer, number>}
     * @ignore
     */
    this.layerOpaqueIndexMap = new Map();
    /**
     * A mapping of {@link Layer} to its transparent index in {@link LayerComposition#layerList}.
     *
     * @type {Map<import('../layer.js').Layer, number>}
     * @ignore
     */
    this.layerTransparentIndexMap = new Map();
    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means only
     * semi-transparent objects are rendered, and false means opaque.
     *
     * @type {boolean[]}
     * @ignore
     */
    this.subLayerList = [];
    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means the
     * layer is rendered, false means it's skipped.
     *
     * @type {boolean[]}
     */
    this.subLayerEnabled = [];
    // more granular control on top of layer.enabled (ANDed)
    /**
     * A read-only array of {@link CameraComponent} that can be used during rendering. e.g.
     * Inside {@link Layer#onPreCull}, {@link Layer#onPostCull}, {@link Layer#onPreRender},
     * {@link Layer#onPostRender}.
     *
     * @type {import('../../framework/components/camera/component.js').CameraComponent[]}
     */
    this.cameras = [];
    /**
     * A mapping of {@link CameraComponent} to its index in {@link LayerComposition#cameras}.
     *
     * @type {Map<import('../../framework/components/camera/component.js').CameraComponent, number>}
     * @ignore
     */
    this.camerasMap = new Map();
    /**
     * The actual rendering sequence, generated based on layers and cameras
     *
     * @type {RenderAction[]}
     * @ignore
     */
    this._renderActions = [];
    /**
     * True if the composition needs to be updated before rendering.
     *
     * @ignore
     */
    this._dirty = false;
    this.name = name;
    this._opaqueOrder = {};
    this._transparentOrder = {};
  }
  destroy() {
    this.destroyRenderActions();
  }
  destroyRenderActions() {
    this._renderActions.forEach(ra => ra.destroy());
    this._renderActions.length = 0;
  }
  _update() {
    const len = this.layerList.length;

    // if composition dirty flag is not set, test if layers are marked dirty
    if (!this._dirty) {
      for (let i = 0; i < len; i++) {
        if (this.layerList[i]._dirtyComposition) {
          this._dirty = true;
          break;
        }
      }
    }
    if (this._dirty) {
      this._dirty = false;

      // walk the layers and build an array of unique cameras from all layers
      this.cameras.length = 0;
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        layer._dirtyComposition = false;

        // for all cameras in the layer
        for (let j = 0; j < layer.cameras.length; j++) {
          const camera = layer.cameras[j];
          const index = this.cameras.indexOf(camera);
          if (index < 0) {
            this.cameras.push(camera);
          }
        }
      }

      // sort cameras by priority
      if (this.cameras.length > 1) {
        sortPriority(this.cameras);
      }

      // update camera map
      this.camerasMap.clear();
      for (let i = 0; i < this.cameras.length; i++) {
        this.camerasMap.set(this.cameras[i], i);
      }

      // render in order of cameras sorted by priority
      let renderActionCount = 0;
      this.destroyRenderActions();
      for (let i = 0; i < this.cameras.length; i++) {
        const camera = this.cameras[i];

        // if the camera uses custom render passes, only add a dummy render action to mark
        // the place where to add them during building of the frame graph
        if (camera.camera.renderPasses.length > 0) {
          this.addDummyRenderAction(renderActionCount, camera);
          renderActionCount++;
          continue;
        }

        // first render action for this camera
        let cameraFirstRenderAction = true;
        const cameraFirstRenderActionIndex = renderActionCount;

        // last render action for the camera
        let lastRenderAction = null;

        // true if post processing stop layer was found for the camera
        let postProcessMarked = false;

        // walk all global sorted list of layers (sublayers) to check if camera renders it
        // this adds both opaque and transparent sublayers if camera renders the layer
        for (let j = 0; j < len; j++) {
          const layer = this.layerList[j];
          const isLayerEnabled = layer.enabled && this.subLayerEnabled[j];
          if (isLayerEnabled) {
            // if layer needs to be rendered
            if (layer.cameras.length > 0) {
              // if the camera renders this layer
              if (camera.layers.indexOf(layer.id) >= 0) {

                // if this layer is the stop layer for postprocessing
                if (!postProcessMarked && layer.id === camera.disablePostEffectsLayer) {
                  postProcessMarked = true;

                  // the previously added render action is the last post-processed layer
                  if (lastRenderAction) {
                    // mark it to trigger postprocessing callback
                    lastRenderAction.triggerPostprocess = true;
                  }
                }

                // add render action to describe rendering step
                const isTransparent = this.subLayerList[j];
                lastRenderAction = this.addRenderAction(renderActionCount, layer, isTransparent, camera, cameraFirstRenderAction, postProcessMarked);
                renderActionCount++;
                cameraFirstRenderAction = false;
              }
            }
          }
        }

        // if the camera renders any layers.
        if (cameraFirstRenderActionIndex < renderActionCount) {
          // mark the last render action as last one using the camera
          lastRenderAction.lastCameraUse = true;
        }

        // if no render action for this camera was marked for end of postprocessing, mark last one
        if (!postProcessMarked && lastRenderAction) {
          lastRenderAction.triggerPostprocess = true;
        }

        // handle camera stacking if this render action has postprocessing enabled
        if (camera.renderTarget && camera.postEffectsEnabled) {
          // process previous render actions starting with previous camera
          this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera);
        }
      }
      this._logRenderActions();
    }
  }
  getNextRenderAction(renderActionIndex) {
    Debug.assert(this._renderActions.length === renderActionIndex);
    const renderAction = new RenderAction();
    this._renderActions.push(renderAction);
    return renderAction;
  }
  addDummyRenderAction(renderActionIndex, camera) {
    const renderAction = this.getNextRenderAction(renderActionIndex);
    renderAction.camera = camera;
    renderAction.useCameraPasses = true;
  }

  // function adds new render action to a list, while trying to limit allocation and reuse already allocated objects
  addRenderAction(renderActionIndex, layer, isTransparent, camera, cameraFirstRenderAction, postProcessMarked) {
    // render target from the camera takes precedence over the render target from the layer
    let rt = layer.renderTarget;
    if (camera && camera.renderTarget) {
      if (layer.id !== LAYERID_DEPTH) {
        // ignore depth layer
        rt = camera.renderTarget;
      }
    }

    // was camera and render target combo used already
    let used = false;
    const renderActions = this._renderActions;
    for (let i = renderActionIndex - 1; i >= 0; i--) {
      if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
        used = true;
        break;
      }
    }

    // for cameras with post processing enabled, on layers after post processing has been applied already (so UI and similar),
    // don't render them to render target anymore
    if (postProcessMarked && camera.postEffectsEnabled) {
      rt = null;
    }

    // store the properties
    const renderAction = this.getNextRenderAction(renderActionIndex);
    renderAction.triggerPostprocess = false;
    renderAction.layer = layer;
    renderAction.transparent = isTransparent;
    renderAction.camera = camera;
    renderAction.renderTarget = rt;
    renderAction.firstCameraUse = cameraFirstRenderAction;
    renderAction.lastCameraUse = false;

    // clear flags - use camera clear flags in the first render action for each camera,
    // or when render target (from layer) was not yet cleared by this camera
    const needsCameraClear = cameraFirstRenderAction || !used;
    const needsLayerClear = layer.clearColorBuffer || layer.clearDepthBuffer || layer.clearStencilBuffer;
    if (needsCameraClear || needsLayerClear) {
      renderAction.setupClears(needsCameraClear ? camera : undefined, layer);
    }
    return renderAction;
  }

  // executes when post-processing camera's render actions were created to propagate rendering to
  // render targets to previous camera as needed
  propagateRenderTarget(startIndex, fromCamera) {
    for (let a = startIndex; a >= 0; a--) {
      const ra = this._renderActions[a];
      const layer = ra.layer;

      // if we hit render action with a render target (other than depth layer), that marks the end of camera stack
      // TODO: refactor this as part of depth layer refactoring
      if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
        break;
      }

      // skip over depth layer
      if (layer.id === LAYERID_DEPTH) {
        continue;
      }

      // end of stacking if camera with custom render passes
      if (ra.useCameraPasses) {
        break;
      }

      // camera stack ends when viewport or scissor of the camera changes
      const thisCamera = ra == null ? void 0 : ra.camera.camera;
      if (thisCamera) {
        if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
          break;
        }
      }

      // render it to render target
      ra.renderTarget = fromCamera.renderTarget;
    }
  }

  // logs render action and their properties
  _logRenderActions() {
    if (Tracing.get(TRACEID_RENDER_ACTION)) {
      Debug.trace(TRACEID_RENDER_ACTION, 'Render Actions for composition: ' + this.name);
      for (let i = 0; i < this._renderActions.length; i++) {
        const ra = this._renderActions[i];
        const camera = ra.camera;
        if (ra.useCameraPasses) {
          Debug.trace(TRACEID_RENDER_ACTION, i + ('CustomPasses Cam: ' + (camera ? camera.entity.name : '-')));
        } else {
          const layer = ra.layer;
          const enabled = layer.enabled && this.isEnabled(layer, ra.transparent);
          const clear = (ra.clearColor ? 'Color ' : '..... ') + (ra.clearDepth ? 'Depth ' : '..... ') + (ra.clearStencil ? 'Stencil' : '.......');
          Debug.trace(TRACEID_RENDER_ACTION, i + (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') + (' Lay: ' + layer.name).padEnd(22, ' ') + (ra.transparent ? ' TRANSP' : ' OPAQUE') + (enabled ? ' ENABLED ' : ' DISABLED') + (' RT: ' + (ra.renderTarget ? ra.renderTarget.name : '-')).padEnd(30, ' ') + ' Clear: ' + clear + (ra.firstCameraUse ? ' CAM-FIRST' : '') + (ra.lastCameraUse ? ' CAM-LAST' : '') + (ra.triggerPostprocess ? ' POSTPROCESS' : ''));
        }
      }
    }
  }
  _isLayerAdded(layer) {
    const found = this.layerIdMap.get(layer.id) === layer;
    Debug.assert(!found, `Layer is already added: ${layer.name}`);
    return found;
  }
  _isSublayerAdded(layer, transparent) {
    const map = transparent ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
    if (map.get(layer) !== undefined) {
      Debug.error(`Sublayer ${layer.name}, transparent: ${transparent} is already added.`);
      return true;
    }
    return false;
  }

  // Whole layer API

  /**
   * Adds a layer (both opaque and semi-transparent parts) to the end of the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  push(layer) {
    // add both opaque and transparent to the end of the array
    if (this._isLayerAdded(layer)) return;
    this.layerList.push(layer);
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this.subLayerEnabled.push(true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Inserts a layer (both opaque and semi-transparent parts) at the chosen index in the
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insert(layer, index) {
    // insert both opaque and transparent at the index
    if (this._isLayerAdded(layer)) return;
    this.layerList.splice(index, 0, layer, layer);
    this.subLayerList.splice(index, 0, false, true);
    const count = this.layerList.length;
    this._updateOpaqueOrder(index, count - 1);
    this._updateTransparentOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true, true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Removes a layer (both opaque and semi-transparent parts) from {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  remove(layer) {
    // remove all occurrences of a layer
    let id = this.layerList.indexOf(layer);
    delete this._opaqueOrder[id];
    delete this._transparentOrder[id];
    while (id >= 0) {
      this.layerList.splice(id, 1);
      this.subLayerList.splice(id, 1);
      this.subLayerEnabled.splice(id, 1);
      id = this.layerList.indexOf(layer);
      this._dirty = true;
      this.fire('remove', layer);
    }

    // update both orders
    const count = this.layerList.length;
    this._updateOpaqueOrder(0, count - 1);
    this._updateTransparentOrder(0, count - 1);
    this._updateLayerMaps();
  }

  // Sublayer API

  /**
   * Adds part of the layer with opaque (non semi-transparent) objects to the end of the
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  pushOpaque(layer) {
    // add opaque to the end of the array
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this.subLayerEnabled.push(true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Inserts an opaque part of the layer (non semi-transparent mesh instances) at the chosen
   * index in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insertOpaque(layer, index) {
    // insert opaque at index
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.splice(index, 0, layer);
    this.subLayerList.splice(index, 0, false);
    const count = this.subLayerList.length;
    this._updateOpaqueOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Removes an opaque part of the layer (non semi-transparent mesh instances) from
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  removeOpaque(layer) {
    // remove opaque occurrences of a layer
    for (let i = 0, len = this.layerList.length; i < len; i++) {
      if (this.layerList[i] === layer && !this.subLayerList[i]) {
        this.layerList.splice(i, 1);
        this.subLayerList.splice(i, 1);
        len--;
        this._updateOpaqueOrder(i, len - 1);
        this.subLayerEnabled.splice(i, 1);
        this._dirty = true;
        if (this.layerList.indexOf(layer) < 0) {
          this.fire('remove', layer); // no sublayers left
        }

        break;
      }
    }
    this._updateLayerMaps();
  }

  /**
   * Adds part of the layer with semi-transparent objects to the end of the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  pushTransparent(layer) {
    // add transparent to the end of the array
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.push(layer);
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Inserts a semi-transparent part of the layer at the chosen index in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insertTransparent(layer, index) {
    // insert transparent at index
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.splice(index, 0, layer);
    this.subLayerList.splice(index, 0, true);
    const count = this.subLayerList.length;
    this._updateTransparentOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true);
    this._updateLayerMaps();
    this._dirty = true;
    this.fire('add', layer);
  }

  /**
   * Removes a transparent part of the layer from {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  removeTransparent(layer) {
    // remove transparent occurrences of a layer
    for (let i = 0, len = this.layerList.length; i < len; i++) {
      if (this.layerList[i] === layer && this.subLayerList[i]) {
        this.layerList.splice(i, 1);
        this.subLayerList.splice(i, 1);
        len--;
        this._updateTransparentOrder(i, len - 1);
        this.subLayerEnabled.splice(i, 1);
        this._dirty = true;
        if (this.layerList.indexOf(layer) < 0) {
          this.fire('remove', layer); // no sublayers left
        }

        break;
      }
    }
    this._updateLayerMaps();
  }

  /**
   * Gets index of the opaque part of the supplied layer in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
   * @returns {number} The index of the opaque part of the specified layer, or -1 if it is not
   * part of the composition.
   */
  getOpaqueIndex(layer) {
    var _this$layerOpaqueInde;
    return (_this$layerOpaqueInde = this.layerOpaqueIndexMap.get(layer)) != null ? _this$layerOpaqueInde : -1;
  }

  /**
   * Gets index of the semi-transparent part of the supplied layer in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
   * @returns {number} The index of the semi-transparent part of the specified layer, or -1 if it
   * is not part of the composition.
   */
  getTransparentIndex(layer) {
    var _this$layerTransparen;
    return (_this$layerTransparen = this.layerTransparentIndexMap.get(layer)) != null ? _this$layerTransparen : -1;
  }
  isEnabled(layer, transparent) {
    const index = transparent ? this.getTransparentIndex(layer) : this.getOpaqueIndex(layer);
    Debug.assert(index >= 0, `${transparent ? 'Transparent' : 'Opaque'} layer ${layer.name} is not part of the composition.`);
    return this.subLayerEnabled[index];
  }

  /**
   * Update maps of layer IDs and names to match the layer list.
   *
   * @private
   */
  _updateLayerMaps() {
    this.layerIdMap.clear();
    this.layerNameMap.clear();
    this.layerOpaqueIndexMap.clear();
    this.layerTransparentIndexMap.clear();
    for (let i = 0; i < this.layerList.length; i++) {
      const layer = this.layerList[i];
      this.layerIdMap.set(layer.id, layer);
      this.layerNameMap.set(layer.name, layer);
      const subLayerIndexMap = this.subLayerList[i] ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
      subLayerIndexMap.set(layer, i);
    }
  }

  /**
   * Finds a layer inside this composition by its ID. Null is returned, if nothing is found.
   *
   * @param {number} id - An ID of the layer to find.
   * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified ID.
   * Returns null if layer is not found.
   */
  getLayerById(id) {
    var _this$layerIdMap$get;
    return (_this$layerIdMap$get = this.layerIdMap.get(id)) != null ? _this$layerIdMap$get : null;
  }

  /**
   * Finds a layer inside this composition by its name. Null is returned, if nothing is found.
   *
   * @param {string} name - The name of the layer to find.
   * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified name.
   * Returns null if layer is not found.
   */
  getLayerByName(name) {
    var _this$layerNameMap$ge;
    return (_this$layerNameMap$ge = this.layerNameMap.get(name)) != null ? _this$layerNameMap$ge : null;
  }
  _updateOpaqueOrder(startIndex, endIndex) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.subLayerList[i] === false) {
        this._opaqueOrder[this.layerList[i].id] = i;
      }
    }
  }
  _updateTransparentOrder(startIndex, endIndex) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.subLayerList[i] === true) {
        this._transparentOrder[this.layerList[i].id] = i;
      }
    }
  }

  // Used to determine which array of layers has any sublayer that is
  // on top of all the sublayers in the other array. The order is a dictionary
  // of <layerId, index>.
  _sortLayersDescending(layersA, layersB, order) {
    let topLayerA = -1;
    let topLayerB = -1;

    // search for which layer is on top in layersA
    for (let i = 0, len = layersA.length; i < len; i++) {
      const id = layersA[i];
      if (order.hasOwnProperty(id)) {
        topLayerA = Math.max(topLayerA, order[id]);
      }
    }

    // search for which layer is on top in layersB
    for (let i = 0, len = layersB.length; i < len; i++) {
      const id = layersB[i];
      if (order.hasOwnProperty(id)) {
        topLayerB = Math.max(topLayerB, order[id]);
      }
    }

    // if the layers of layersA or layersB do not exist at all
    // in the composition then return early with the other.
    if (topLayerA === -1 && topLayerB !== -1) {
      return 1;
    } else if (topLayerB === -1 && topLayerA !== -1) {
      return -1;
    }

    // sort in descending order since we want
    // the higher order to be first
    return topLayerB - topLayerA;
  }

  /**
   * Used to determine which array of layers has any transparent sublayer that is on top of all
   * the transparent sublayers in the other array.
   *
   * @param {number[]} layersA - IDs of layers.
   * @param {number[]} layersB - IDs of layers.
   * @returns {number} Returns a negative number if any of the transparent sublayers in layersA
   * is on top of all the transparent sublayers in layersB, or a positive number if any of the
   * transparent sublayers in layersB is on top of all the transparent sublayers in layersA, or 0
   * otherwise.
   * @private
   */
  sortTransparentLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
  }

  /**
   * Used to determine which array of layers has any opaque sublayer that is on top of all the
   * opaque sublayers in the other array.
   *
   * @param {number[]} layersA - IDs of layers.
   * @param {number[]} layersB - IDs of layers.
   * @returns {number} Returns a negative number if any of the opaque sublayers in layersA is on
   * top of all the opaque sublayers in layersB, or a positive number if any of the opaque
   * sublayers in layersB is on top of all the opaque sublayers in layersA, or 0 otherwise.
   * @private
   */
  sortOpaqueLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
  }
}

export { LayerComposition };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXItY29tcG9zaXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9BQ1RJT04gfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcbmltcG9ydCB7IExBWUVSSURfREVQVEggfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgUmVuZGVyQWN0aW9uIH0gZnJvbSAnLi9yZW5kZXItYWN0aW9uLmpzJztcblxuLyoqXG4gKiBMYXllciBDb21wb3NpdGlvbiBpcyBhIGNvbGxlY3Rpb24gb2Yge0BsaW5rIExheWVyfSB0aGF0IGlzIGZlZCB0byB7QGxpbmsgU2NlbmUjbGF5ZXJzfSB0byBkZWZpbmVcbiAqIHJlbmRlcmluZyBvcmRlci5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgTGF5ZXJDb21wb3NpdGlvbiBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLy8gQ29tcG9zaXRpb24gY2FuIGhvbGQgb25seSAyIHN1YmxheWVycyBvZiBlYWNoIGxheWVyXG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiB7QGxpbmsgTGF5ZXJ9IHNvcnRlZCBpbiB0aGUgb3JkZXIgdGhleSB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcltdfVxuICAgICAqL1xuICAgIGxheWVyTGlzdCA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQSBtYXBwaW5nIG9mIHtAbGluayBMYXllciNpZH0gdG8ge0BsaW5rIExheWVyfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8bnVtYmVyLCBpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXI+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsYXllcklkTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQSBtYXBwaW5nIG9mIHtAbGluayBMYXllciNuYW1lfSB0byB7QGxpbmsgTGF5ZXJ9LlxuICAgICAqXG4gICAgICogQHR5cGUge01hcDxzdHJpbmcsIGltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxheWVyTmFtZU1hcCA9IG5ldyBNYXAoKTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiB7QGxpbmsgTGF5ZXJ9IHRvIGl0cyBvcGFxdWUgaW5kZXggaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyLCBudW1iZXI+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsYXllck9wYXF1ZUluZGV4TWFwID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQSBtYXBwaW5nIG9mIHtAbGluayBMYXllcn0gdG8gaXRzIHRyYW5zcGFyZW50IGluZGV4IGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWFwPGltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllciwgbnVtYmVyPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbGF5ZXJUcmFuc3BhcmVudEluZGV4TWFwID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2YgYm9vbGVhbiB2YWx1ZXMsIG1hdGNoaW5nIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uIFRydWUgbWVhbnMgb25seVxuICAgICAqIHNlbWktdHJhbnNwYXJlbnQgb2JqZWN0cyBhcmUgcmVuZGVyZWQsIGFuZCBmYWxzZSBtZWFucyBvcGFxdWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdWJMYXllckxpc3QgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IGFycmF5IG9mIGJvb2xlYW4gdmFsdWVzLCBtYXRjaGluZyB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LiBUcnVlIG1lYW5zIHRoZVxuICAgICAqIGxheWVyIGlzIHJlbmRlcmVkLCBmYWxzZSBtZWFucyBpdCdzIHNraXBwZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAqL1xuICAgIHN1YkxheWVyRW5hYmxlZCA9IFtdOyAvLyBtb3JlIGdyYW51bGFyIGNvbnRyb2wgb24gdG9wIG9mIGxheWVyLmVuYWJsZWQgKEFORGVkKVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gdGhhdCBjYW4gYmUgdXNlZCBkdXJpbmcgcmVuZGVyaW5nLiBlLmcuXG4gICAgICogSW5zaWRlIHtAbGluayBMYXllciNvblByZUN1bGx9LCB7QGxpbmsgTGF5ZXIjb25Qb3N0Q3VsbH0sIHtAbGluayBMYXllciNvblByZVJlbmRlcn0sXG4gICAgICoge0BsaW5rIExheWVyI29uUG9zdFJlbmRlcn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50W119XG4gICAgICovXG4gICAgY2FtZXJhcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQSBtYXBwaW5nIG9mIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHRvIGl0cyBpbmRleCBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50LCBudW1iZXI+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjYW1lcmFzTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFjdHVhbCByZW5kZXJpbmcgc2VxdWVuY2UsIGdlbmVyYXRlZCBiYXNlZCBvbiBsYXllcnMgYW5kIGNhbWVyYXNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtSZW5kZXJBY3Rpb25bXX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3JlbmRlckFjdGlvbnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGNvbXBvc2l0aW9uIG5lZWRzIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfZGlydHkgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBPcHRpb25hbCBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGxheWVyIGNvbXBvc2l0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIFwiVW50aXRsZWRcIiBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlciA9IHt9O1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyID0ge307XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5kZXN0cm95UmVuZGVyQWN0aW9ucygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lSZW5kZXJBY3Rpb25zKCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLmZvckVhY2gocmEgPT4gcmEuZGVzdHJveSgpKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIF91cGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcblxuICAgICAgICAvLyBpZiBjb21wb3NpdGlvbiBkaXJ0eSBmbGFnIGlzIG5vdCBzZXQsIHRlc3QgaWYgbGF5ZXJzIGFyZSBtYXJrZWQgZGlydHlcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXS5fZGlydHlDb21wb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eSkge1xuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyB3YWxrIHRoZSBsYXllcnMgYW5kIGJ1aWxkIGFuIGFycmF5IG9mIHVuaXF1ZSBjYW1lcmFzIGZyb20gYWxsIGxheWVyc1xuICAgICAgICAgICAgdGhpcy5jYW1lcmFzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBsYXllci5fZGlydHlDb21wb3NpdGlvbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGFsbCBjYW1lcmFzIGluIHRoZSBsYXllclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2pdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNvcnQgY2FtZXJhcyBieSBwcmlvcml0eVxuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgc29ydFByaW9yaXR5KHRoaXMuY2FtZXJhcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBjYW1lcmEgbWFwXG4gICAgICAgICAgICB0aGlzLmNhbWVyYXNNYXAuY2xlYXIoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jYW1lcmFzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYW1lcmFzTWFwLnNldCh0aGlzLmNhbWVyYXNbaV0sIGkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IGEgbGlzdCBvZiBsYXllcnMgdGhpcyBjYW1lcmEgcmVuZGVyc1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhTGF5ZXJzID0gW107XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBpbiBvcmRlciBvZiBjYW1lcmFzIHNvcnRlZCBieSBwcmlvcml0eVxuICAgICAgICAgICAgbGV0IHJlbmRlckFjdGlvbkNvdW50ID0gMDtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveVJlbmRlckFjdGlvbnMoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNhbWVyYXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbaV07XG4gICAgICAgICAgICAgICAgY2FtZXJhTGF5ZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHVzZXMgY3VzdG9tIHJlbmRlciBwYXNzZXMsIG9ubHkgYWRkIGEgZHVtbXkgcmVuZGVyIGFjdGlvbiB0byBtYXJrXG4gICAgICAgICAgICAgICAgLy8gdGhlIHBsYWNlIHdoZXJlIHRvIGFkZCB0aGVtIGR1cmluZyBidWlsZGluZyBvZiB0aGUgZnJhbWUgZ3JhcGhcbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLmNhbWVyYS5yZW5kZXJQYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZER1bW15UmVuZGVyQWN0aW9uKHJlbmRlckFjdGlvbkNvdW50LCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb25Db3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCByZW5kZXIgYWN0aW9uIGZvciB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgICAgIGxldCBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA9IHJlbmRlckFjdGlvbkNvdW50O1xuXG4gICAgICAgICAgICAgICAgLy8gbGFzdCByZW5kZXIgYWN0aW9uIGZvciB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RSZW5kZXJBY3Rpb24gPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJ1ZSBpZiBwb3N0IHByb2Nlc3Npbmcgc3RvcCBsYXllciB3YXMgZm91bmQgZm9yIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBsZXQgcG9zdFByb2Nlc3NNYXJrZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIHdhbGsgYWxsIGdsb2JhbCBzb3J0ZWQgbGlzdCBvZiBsYXllcnMgKHN1YmxheWVycykgdG8gY2hlY2sgaWYgY2FtZXJhIHJlbmRlcnMgaXRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGFkZHMgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IHN1YmxheWVycyBpZiBjYW1lcmEgcmVuZGVycyB0aGUgbGF5ZXJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNMYXllckVuYWJsZWQgPSBsYXllci5lbmFibGVkICYmIHRoaXMuc3ViTGF5ZXJFbmFibGVkW2pdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNMYXllckVuYWJsZWQpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgbGF5ZXIgbmVlZHMgdG8gYmUgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5jYW1lcmFzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBjYW1lcmEgcmVuZGVycyB0aGlzIGxheWVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5sYXllcnMuaW5kZXhPZihsYXllci5pZCkgPj0gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYUxheWVycy5wdXNoKGxheWVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGlzIGxheWVyIGlzIHRoZSBzdG9wIGxheWVyIGZvciBwb3N0cHJvY2Vzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXBvc3RQcm9jZXNzTWFya2VkICYmIGxheWVyLmlkID09PSBjYW1lcmEuZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RQcm9jZXNzTWFya2VkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHByZXZpb3VzbHkgYWRkZWQgcmVuZGVyIGFjdGlvbiBpcyB0aGUgbGFzdCBwb3N0LXByb2Nlc3NlZCBsYXllclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgaXQgdG8gdHJpZ2dlciBwb3N0cHJvY2Vzc2luZyBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCByZW5kZXIgYWN0aW9uIHRvIGRlc2NyaWJlIHJlbmRlcmluZyBzdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtqXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFJlbmRlckFjdGlvbiA9IHRoaXMuYWRkUmVuZGVyQWN0aW9uKHJlbmRlckFjdGlvbkNvdW50LCBsYXllciwgaXNUcmFuc3BhcmVudCwgY2FtZXJhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQWN0aW9uQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgYW55IGxheWVycy5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA8IHJlbmRlckFjdGlvbkNvdW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbWFyayB0aGUgbGFzdCByZW5kZXIgYWN0aW9uIGFzIGxhc3Qgb25lIHVzaW5nIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICAgICAgbGFzdFJlbmRlckFjdGlvbi5sYXN0Q2FtZXJhVXNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBubyByZW5kZXIgYWN0aW9uIGZvciB0aGlzIGNhbWVyYSB3YXMgbWFya2VkIGZvciBlbmQgb2YgcG9zdHByb2Nlc3NpbmcsIG1hcmsgbGFzdCBvbmVcbiAgICAgICAgICAgICAgICBpZiAoIXBvc3RQcm9jZXNzTWFya2VkICYmIGxhc3RSZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgbGFzdFJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBjYW1lcmEgc3RhY2tpbmcgaWYgdGhpcyByZW5kZXIgYWN0aW9uIGhhcyBwb3N0cHJvY2Vzc2luZyBlbmFibGVkXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJUYXJnZXQgJiYgY2FtZXJhLnBvc3RFZmZlY3RzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcm9jZXNzIHByZXZpb3VzIHJlbmRlciBhY3Rpb25zIHN0YXJ0aW5nIHdpdGggcHJldmlvdXMgY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvcGFnYXRlUmVuZGVyVGFyZ2V0KGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uSW5kZXggLSAxLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbG9nUmVuZGVyQWN0aW9ucygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0TmV4dFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25JbmRleCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGggPT09IHJlbmRlckFjdGlvbkluZGV4KTtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gbmV3IFJlbmRlckFjdGlvbigpO1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLnB1c2gocmVuZGVyQWN0aW9uKTtcbiAgICAgICAgcmV0dXJuIHJlbmRlckFjdGlvbjtcbiAgICB9XG5cbiAgICBhZGREdW1teVJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25JbmRleCwgY2FtZXJhKSB7XG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHRoaXMuZ2V0TmV4dFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25JbmRleCk7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jYW1lcmEgPSBjYW1lcmE7XG4gICAgICAgIHJlbmRlckFjdGlvbi51c2VDYW1lcmFQYXNzZXMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIGFkZHMgbmV3IHJlbmRlciBhY3Rpb24gdG8gYSBsaXN0LCB3aGlsZSB0cnlpbmcgdG8gbGltaXQgYWxsb2NhdGlvbiBhbmQgcmV1c2UgYWxyZWFkeSBhbGxvY2F0ZWQgb2JqZWN0c1xuICAgIGFkZFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25JbmRleCwgbGF5ZXIsIGlzVHJhbnNwYXJlbnQsIGNhbWVyYSwgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKSB7XG5cbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldCBmcm9tIHRoZSBjYW1lcmEgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSByZW5kZXIgdGFyZ2V0IGZyb20gdGhlIGxheWVyXG4gICAgICAgIGxldCBydCA9IGxheWVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKGNhbWVyYSAmJiBjYW1lcmEucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAobGF5ZXIuaWQgIT09IExBWUVSSURfREVQVEgpIHsgICAvLyBpZ25vcmUgZGVwdGggbGF5ZXJcbiAgICAgICAgICAgICAgICBydCA9IGNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3YXMgY2FtZXJhIGFuZCByZW5kZXIgdGFyZ2V0IGNvbWJvIHVzZWQgYWxyZWFkeVxuICAgICAgICBsZXQgdXNlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gdGhpcy5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IHJlbmRlckFjdGlvbkluZGV4IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb25zW2ldLmNhbWVyYSA9PT0gY2FtZXJhICYmIHJlbmRlckFjdGlvbnNbaV0ucmVuZGVyVGFyZ2V0ID09PSBydCkge1xuICAgICAgICAgICAgICAgIHVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIGNhbWVyYXMgd2l0aCBwb3N0IHByb2Nlc3NpbmcgZW5hYmxlZCwgb24gbGF5ZXJzIGFmdGVyIHBvc3QgcHJvY2Vzc2luZyBoYXMgYmVlbiBhcHBsaWVkIGFscmVhZHkgKHNvIFVJIGFuZCBzaW1pbGFyKSxcbiAgICAgICAgLy8gZG9uJ3QgcmVuZGVyIHRoZW0gdG8gcmVuZGVyIHRhcmdldCBhbnltb3JlXG4gICAgICAgIGlmIChwb3N0UHJvY2Vzc01hcmtlZCAmJiBjYW1lcmEucG9zdEVmZmVjdHNFbmFibGVkKSB7XG4gICAgICAgICAgICBydCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB0aGUgcHJvcGVydGllc1xuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSB0aGlzLmdldE5leHRSZW5kZXJBY3Rpb24ocmVuZGVyQWN0aW9uSW5kZXgpO1xuICAgICAgICByZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gZmFsc2U7XG4gICAgICAgIHJlbmRlckFjdGlvbi5sYXllciA9IGxheWVyO1xuICAgICAgICByZW5kZXJBY3Rpb24udHJhbnNwYXJlbnQgPSBpc1RyYW5zcGFyZW50O1xuICAgICAgICByZW5kZXJBY3Rpb24uY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSA9IGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uO1xuICAgICAgICByZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzIC0gdXNlIGNhbWVyYSBjbGVhciBmbGFncyBpbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgZWFjaCBjYW1lcmEsXG4gICAgICAgIC8vIG9yIHdoZW4gcmVuZGVyIHRhcmdldCAoZnJvbSBsYXllcikgd2FzIG5vdCB5ZXQgY2xlYXJlZCBieSB0aGlzIGNhbWVyYVxuICAgICAgICBjb25zdCBuZWVkc0NhbWVyYUNsZWFyID0gY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gfHwgIXVzZWQ7XG4gICAgICAgIGNvbnN0IG5lZWRzTGF5ZXJDbGVhciA9IGxheWVyLmNsZWFyQ29sb3JCdWZmZXIgfHwgbGF5ZXIuY2xlYXJEZXB0aEJ1ZmZlciB8fCBsYXllci5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgICAgIGlmIChuZWVkc0NhbWVyYUNsZWFyIHx8IG5lZWRzTGF5ZXJDbGVhcikge1xuICAgICAgICAgICAgcmVuZGVyQWN0aW9uLnNldHVwQ2xlYXJzKG5lZWRzQ2FtZXJhQ2xlYXIgPyBjYW1lcmEgOiB1bmRlZmluZWQsIGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZW5kZXJBY3Rpb247XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZXMgd2hlbiBwb3N0LXByb2Nlc3NpbmcgY2FtZXJhJ3MgcmVuZGVyIGFjdGlvbnMgd2VyZSBjcmVhdGVkIHRvIHByb3BhZ2F0ZSByZW5kZXJpbmcgdG9cbiAgICAvLyByZW5kZXIgdGFyZ2V0cyB0byBwcmV2aW91cyBjYW1lcmEgYXMgbmVlZGVkXG4gICAgcHJvcGFnYXRlUmVuZGVyVGFyZ2V0KHN0YXJ0SW5kZXgsIGZyb21DYW1lcmEpIHtcblxuICAgICAgICBmb3IgKGxldCBhID0gc3RhcnRJbmRleDsgYSA+PSAwOyBhLS0pIHtcblxuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2FdO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSByYS5sYXllcjtcblxuICAgICAgICAgICAgLy8gaWYgd2UgaGl0IHJlbmRlciBhY3Rpb24gd2l0aCBhIHJlbmRlciB0YXJnZXQgKG90aGVyIHRoYW4gZGVwdGggbGF5ZXIpLCB0aGF0IG1hcmtzIHRoZSBlbmQgb2YgY2FtZXJhIHN0YWNrXG4gICAgICAgICAgICAvLyBUT0RPOiByZWZhY3RvciB0aGlzIGFzIHBhcnQgb2YgZGVwdGggbGF5ZXIgcmVmYWN0b3JpbmdcbiAgICAgICAgICAgIGlmIChyYS5yZW5kZXJUYXJnZXQgJiYgbGF5ZXIuaWQgIT09IExBWUVSSURfREVQVEgpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2tpcCBvdmVyIGRlcHRoIGxheWVyXG4gICAgICAgICAgICBpZiAobGF5ZXIuaWQgPT09IExBWUVSSURfREVQVEgpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW5kIG9mIHN0YWNraW5nIGlmIGNhbWVyYSB3aXRoIGN1c3RvbSByZW5kZXIgcGFzc2VzXG4gICAgICAgICAgICBpZiAocmEudXNlQ2FtZXJhUGFzc2VzKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSBzdGFjayBlbmRzIHdoZW4gdmlld3BvcnQgb3Igc2Npc3NvciBvZiB0aGUgY2FtZXJhIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHRoaXNDYW1lcmEgPSByYT8uY2FtZXJhLmNhbWVyYTtcbiAgICAgICAgICAgIGlmICh0aGlzQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcm9tQ2FtZXJhLmNhbWVyYS5yZWN0LmVxdWFscyh0aGlzQ2FtZXJhLnJlY3QpIHx8ICFmcm9tQ2FtZXJhLmNhbWVyYS5zY2lzc29yUmVjdC5lcXVhbHModGhpc0NhbWVyYS5zY2lzc29yUmVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgaXQgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgcmEucmVuZGVyVGFyZ2V0ID0gZnJvbUNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBsb2dzIHJlbmRlciBhY3Rpb24gYW5kIHRoZWlyIHByb3BlcnRpZXNcbiAgICBfbG9nUmVuZGVyQWN0aW9ucygpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX1JFTkRFUl9BQ1RJT04pKSB7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9BQ1RJT04sICdSZW5kZXIgQWN0aW9ucyBmb3IgY29tcG9zaXRpb246ICcgKyB0aGlzLm5hbWUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHJhLmNhbWVyYTtcbiAgICAgICAgICAgICAgICBpZiAocmEudXNlQ2FtZXJhUGFzc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0FDVElPTiwgaSArXG4gICAgICAgICAgICAgICAgICAgICAgICAoJ0N1c3RvbVBhc3NlcyBDYW06ICcgKyAoY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJy0nKSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gcmEubGF5ZXI7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSBsYXllci5lbmFibGVkICYmIHRoaXMuaXNFbmFibGVkKGxheWVyLCByYS50cmFuc3BhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFyID0gKHJhLmNsZWFyQ29sb3IgPyAnQ29sb3IgJyA6ICcuLi4uLiAnKSArIChyYS5jbGVhckRlcHRoID8gJ0RlcHRoICcgOiAnLi4uLi4gJykgKyAocmEuY2xlYXJTdGVuY2lsID8gJ1N0ZW5jaWwnIDogJy4uLi4uLi4nKTtcblxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9BQ1RJT04sIGkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgKCcgQ2FtOiAnICsgKGNhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJykpLnBhZEVuZCgyMiwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAoJyBMYXk6ICcgKyBsYXllci5uYW1lKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgKHJhLnRyYW5zcGFyZW50ID8gJyBUUkFOU1AnIDogJyBPUEFRVUUnKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAoZW5hYmxlZCA/ICcgRU5BQkxFRCAnIDogJyBESVNBQkxFRCcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICgnIFJUOiAnICsgKHJhLnJlbmRlclRhcmdldCA/IHJhLnJlbmRlclRhcmdldC5uYW1lIDogJy0nKSkucGFkRW5kKDMwLCAnICcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICcgQ2xlYXI6ICcgKyBjbGVhciArXG4gICAgICAgICAgICAgICAgICAgICAgICAocmEuZmlyc3RDYW1lcmFVc2UgPyAnIENBTS1GSVJTVCcgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgKHJhLmxhc3RDYW1lcmFVc2UgPyAnIENBTS1MQVNUJyA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAocmEudHJpZ2dlclBvc3Rwcm9jZXNzID8gJyBQT1NUUFJPQ0VTUycgOiAnJylcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2lzTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMubGF5ZXJJZE1hcC5nZXQobGF5ZXIuaWQpID09PSBsYXllcjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCFmb3VuZCwgYExheWVyIGlzIGFscmVhZHkgYWRkZWQ6ICR7bGF5ZXIubmFtZX1gKTtcbiAgICAgICAgcmV0dXJuIGZvdW5kO1xuICAgIH1cblxuICAgIF9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRyYW5zcGFyZW50KSB7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRyYW5zcGFyZW50ID8gdGhpcy5sYXllclRyYW5zcGFyZW50SW5kZXhNYXAgOiB0aGlzLmxheWVyT3BhcXVlSW5kZXhNYXA7XG4gICAgICAgIGlmIChtYXAuZ2V0KGxheWVyKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgU3VibGF5ZXIgJHtsYXllci5uYW1lfSwgdHJhbnNwYXJlbnQ6ICR7dHJhbnNwYXJlbnR9IGlzIGFscmVhZHkgYWRkZWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gV2hvbGUgbGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSB0byB0aGUgZW5kIG9mIHRoZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoKGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzTGF5ZXJBZGRlZChsYXllcikpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKGZhbHNlKSAtIDE7XG4gICAgICAgIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaCh0cnVlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlTGF5ZXJNYXBzKCk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBhIGxheWVyIChib3RoIG9wYXF1ZSBhbmQgc2VtaS10cmFuc3BhcmVudCBwYXJ0cykgYXQgdGhlIGNob3NlbiBpbmRleCBpbiB0aGVcbiAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbnNlcnRpb24gcG9zaXRpb24uXG4gICAgICovXG4gICAgaW5zZXJ0KGxheWVyLCBpbmRleCkge1xuICAgICAgICAvLyBpbnNlcnQgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IGF0IHRoZSBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNMYXllckFkZGVkKGxheWVyKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGxheWVyLCBsYXllcik7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgZmFsc2UsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcihpbmRleCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihpbmRleCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQuc3BsaWNlKGluZGV4LCAwLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVMYXllck1hcHMoKTtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSBmcm9tIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZShsYXllcikge1xuICAgICAgICAvLyByZW1vdmUgYWxsIG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgbGV0IGlkID0gdGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcik7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX29wYXF1ZU9yZGVyW2lkXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbaWRdO1xuXG4gICAgICAgIHdoaWxlIChpZCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaWQsIDEpO1xuICAgICAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpZCwgMSk7XG4gICAgICAgICAgICBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgYm90aCBvcmRlcnNcbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKDAsIGNvdW50IC0gMSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoMCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTGF5ZXJNYXBzKCk7XG4gICAgfVxuXG4gICAgLy8gU3VibGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHBhcnQgb2YgdGhlIGxheWVyIHdpdGggb3BhcXVlIChub24gc2VtaS10cmFuc3BhcmVudCkgb2JqZWN0cyB0byB0aGUgZW5kIG9mIHRoZVxuICAgICAqIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1c2hPcGFxdWUobGF5ZXIpIHtcbiAgICAgICAgLy8gYWRkIG9wYXF1ZSB0byB0aGUgZW5kIG9mIHRoZSBhcnJheVxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCBmYWxzZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2goZmFsc2UpIC0gMTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQucHVzaCh0cnVlKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVMYXllck1hcHMoKTtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGFuIG9wYXF1ZSBwYXJ0IG9mIHRoZSBsYXllciAobm9uIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMpIGF0IHRoZSBjaG9zZW5cbiAgICAgKiBpbmRleCBpbiB0aGUge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5zZXJ0aW9uIHBvc2l0aW9uLlxuICAgICAqL1xuICAgIGluc2VydE9wYXF1ZShsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IG9wYXF1ZSBhdCBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCBmYWxzZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBsYXllcik7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgZmFsc2UpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcihpbmRleCwgY291bnQgLSAxKTtcblxuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUxheWVyTWFwcygpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYW4gb3BhcXVlIHBhcnQgb2YgdGhlIGxheWVyIChub24gc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcykgZnJvbVxuICAgICAqIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZU9wYXF1ZShsYXllcikge1xuICAgICAgICAvLyByZW1vdmUgb3BhcXVlIG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmICF0aGlzLnN1YkxheWVyTGlzdFtpXSkge1xuICAgICAgICAgICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaSwgMSk7XG5cbiAgICAgICAgICAgICAgICBsZW4tLTtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcihpLCBsZW4gLSAxKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGxheWVyKTsgLy8gbm8gc3VibGF5ZXJzIGxlZnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdXBkYXRlTGF5ZXJNYXBzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBwYXJ0IG9mIHRoZSBsYXllciB3aXRoIHNlbWktdHJhbnNwYXJlbnQgb2JqZWN0cyB0byB0aGUgZW5kIG9mIHRoZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gYWRkIHRyYW5zcGFyZW50IHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRydWUpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2godHJ1ZSkgLSAxO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5wdXNoKHRydWUpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUxheWVyTWFwcygpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydHMgYSBzZW1pLXRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIGxheWVyIGF0IHRoZSBjaG9zZW4gaW5kZXggaW4gdGhlIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluc2VydGlvbiBwb3NpdGlvbi5cbiAgICAgKi9cbiAgICBpbnNlcnRUcmFuc3BhcmVudChsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IHRyYW5zcGFyZW50IGF0IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRydWUpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgbGF5ZXIpO1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlTGF5ZXJNYXBzKCk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIHRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIGxheWVyIGZyb20ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIHRyYW5zcGFyZW50IG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmIHRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaSwgbGVuIC0gMSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7IC8vIG5vIHN1YmxheWVycyBsZWZ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZUxheWVyTWFwcygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5kZXggb2YgdGhlIG9wYXF1ZSBwYXJ0IG9mIHRoZSBzdXBwbGllZCBsYXllciBpbiB0aGUge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBmaW5kIGluZGV4IG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCBvZiB0aGUgb3BhcXVlIHBhcnQgb2YgdGhlIHNwZWNpZmllZCBsYXllciwgb3IgLTEgaWYgaXQgaXMgbm90XG4gICAgICogcGFydCBvZiB0aGUgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgZ2V0T3BhcXVlSW5kZXgobGF5ZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF5ZXJPcGFxdWVJbmRleE1hcC5nZXQobGF5ZXIpID8/IC0xO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5kZXggb2YgdGhlIHNlbWktdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgc3VwcGxpZWQgbGF5ZXIgaW4gdGhlIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gZmluZCBpbmRleCBvZi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaW5kZXggb2YgdGhlIHNlbWktdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgc3BlY2lmaWVkIGxheWVyLCBvciAtMSBpZiBpdFxuICAgICAqIGlzIG5vdCBwYXJ0IG9mIHRoZSBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBnZXRUcmFuc3BhcmVudEluZGV4KGxheWVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxheWVyVHJhbnNwYXJlbnRJbmRleE1hcC5nZXQobGF5ZXIpID8/IC0xO1xuICAgIH1cblxuICAgIGlzRW5hYmxlZChsYXllciwgdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0cmFuc3BhcmVudCA/IHRoaXMuZ2V0VHJhbnNwYXJlbnRJbmRleChsYXllcikgOiB0aGlzLmdldE9wYXF1ZUluZGV4KGxheWVyKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4ID49IDAsIGAke3RyYW5zcGFyZW50ID8gJ1RyYW5zcGFyZW50JyA6ICdPcGFxdWUnfSBsYXllciAke2xheWVyLm5hbWV9IGlzIG5vdCBwYXJ0IG9mIHRoZSBjb21wb3NpdGlvbi5gKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3ViTGF5ZXJFbmFibGVkW2luZGV4XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgbWFwcyBvZiBsYXllciBJRHMgYW5kIG5hbWVzIHRvIG1hdGNoIHRoZSBsYXllciBsaXN0LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlTGF5ZXJNYXBzKCkge1xuICAgICAgICB0aGlzLmxheWVySWRNYXAuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5sYXllck5hbWVNYXAuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5sYXllck9wYXF1ZUluZGV4TWFwLmNsZWFyKCk7XG4gICAgICAgIHRoaXMubGF5ZXJUcmFuc3BhcmVudEluZGV4TWFwLmNsZWFyKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJJZE1hcC5zZXQobGF5ZXIuaWQsIGxheWVyKTtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJOYW1lTWFwLnNldChsYXllci5uYW1lLCBsYXllcik7XG5cbiAgICAgICAgICAgIGNvbnN0IHN1YkxheWVySW5kZXhNYXAgPSB0aGlzLnN1YkxheWVyTGlzdFtpXSA/IHRoaXMubGF5ZXJUcmFuc3BhcmVudEluZGV4TWFwIDogdGhpcy5sYXllck9wYXF1ZUluZGV4TWFwO1xuICAgICAgICAgICAgc3ViTGF5ZXJJbmRleE1hcC5zZXQobGF5ZXIsIGkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgSUQuIE51bGwgaXMgcmV0dXJuZWQsIGlmIG5vdGhpbmcgaXMgZm91bmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBBbiBJRCBvZiB0aGUgbGF5ZXIgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfG51bGx9IFRoZSBsYXllciBjb3JyZXNwb25kaW5nIHRvIHRoZSBzcGVjaWZpZWQgSUQuXG4gICAgICogUmV0dXJucyBudWxsIGlmIGxheWVyIGlzIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRMYXllckJ5SWQoaWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF5ZXJJZE1hcC5nZXQoaWQpID8/IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgbmFtZS4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcnxudWxsfSBUaGUgbGF5ZXIgY29ycmVzcG9uZGluZyB0byB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICogUmV0dXJucyBudWxsIGlmIGxheWVyIGlzIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRMYXllckJ5TmFtZShuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxheWVyTmFtZU1hcC5nZXQobmFtZSkgPz8gbnVsbDtcbiAgICB9XG5cbiAgICBfdXBkYXRlT3BhcXVlT3JkZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihzdGFydEluZGV4LCBlbmRJbmRleCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBzdWJsYXllciB0aGF0IGlzXG4gICAgLy8gb24gdG9wIG9mIGFsbCB0aGUgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS4gVGhlIG9yZGVyIGlzIGEgZGljdGlvbmFyeVxuICAgIC8vIG9mIDxsYXllcklkLCBpbmRleD4uXG4gICAgX3NvcnRMYXllcnNEZXNjZW5kaW5nKGxheWVyc0EsIGxheWVyc0IsIG9yZGVyKSB7XG4gICAgICAgIGxldCB0b3BMYXllckEgPSAtMTtcbiAgICAgICAgbGV0IHRvcExheWVyQiA9IC0xO1xuXG4gICAgICAgIC8vIHNlYXJjaCBmb3Igd2hpY2ggbGF5ZXIgaXMgb24gdG9wIGluIGxheWVyc0FcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheWVyc0EubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gbGF5ZXJzQVtpXTtcbiAgICAgICAgICAgIGlmIChvcmRlci5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICB0b3BMYXllckEgPSBNYXRoLm1heCh0b3BMYXllckEsIG9yZGVyW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWFyY2ggZm9yIHdoaWNoIGxheWVyIGlzIG9uIHRvcCBpbiBsYXllcnNCXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXllcnNCLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGxheWVyc0JbaV07XG4gICAgICAgICAgICBpZiAob3JkZXIuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgdG9wTGF5ZXJCID0gTWF0aC5tYXgodG9wTGF5ZXJCLCBvcmRlcltpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGxheWVycyBvZiBsYXllcnNBIG9yIGxheWVyc0IgZG8gbm90IGV4aXN0IGF0IGFsbFxuICAgICAgICAvLyBpbiB0aGUgY29tcG9zaXRpb24gdGhlbiByZXR1cm4gZWFybHkgd2l0aCB0aGUgb3RoZXIuXG4gICAgICAgIGlmICh0b3BMYXllckEgPT09IC0xICYmIHRvcExheWVyQiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHRvcExheWVyQiA9PT0gLTEgJiYgdG9wTGF5ZXJBICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBpbiBkZXNjZW5kaW5nIG9yZGVyIHNpbmNlIHdlIHdhbnRcbiAgICAgICAgLy8gdGhlIGhpZ2hlciBvcmRlciB0byBiZSBmaXJzdFxuICAgICAgICByZXR1cm4gdG9wTGF5ZXJCIC0gdG9wTGF5ZXJBO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGFycmF5IG9mIGxheWVycyBoYXMgYW55IHRyYW5zcGFyZW50IHN1YmxheWVyIHRoYXQgaXMgb24gdG9wIG9mIGFsbFxuICAgICAqIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIHRyYW5zcGFyZW50IHN1YmxheWVycyBpbiBsYXllcnNBXG4gICAgICogaXMgb24gdG9wIG9mIGFsbCB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0IsIG9yIGEgcG9zaXRpdmUgbnVtYmVyIGlmIGFueSBvZiB0aGVcbiAgICAgKiB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQSwgb3IgMFxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNvcnRUcmFuc3BhcmVudExheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl90cmFuc3BhcmVudE9yZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBvcGFxdWUgc3VibGF5ZXIgdGhhdCBpcyBvbiB0b3Agb2YgYWxsIHRoZVxuICAgICAqIG9wYXF1ZSBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQSBpcyBvblxuICAgICAqIHRvcCBvZiBhbGwgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQiwgb3IgYSBwb3NpdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSBvcGFxdWVcbiAgICAgKiBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0EsIG9yIDAgb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc29ydE9wYXF1ZUxheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl9vcGFxdWVPcmRlcik7XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXllckNvbXBvc2l0aW9uIH07XG4iXSwibmFtZXMiOlsiTGF5ZXJDb21wb3NpdGlvbiIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsImxheWVyTGlzdCIsImxheWVySWRNYXAiLCJNYXAiLCJsYXllck5hbWVNYXAiLCJsYXllck9wYXF1ZUluZGV4TWFwIiwibGF5ZXJUcmFuc3BhcmVudEluZGV4TWFwIiwic3ViTGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwiY2FtZXJhcyIsImNhbWVyYXNNYXAiLCJfcmVuZGVyQWN0aW9ucyIsIl9kaXJ0eSIsIl9vcGFxdWVPcmRlciIsIl90cmFuc3BhcmVudE9yZGVyIiwiZGVzdHJveSIsImRlc3Ryb3lSZW5kZXJBY3Rpb25zIiwiZm9yRWFjaCIsInJhIiwibGVuZ3RoIiwiX3VwZGF0ZSIsImxlbiIsImkiLCJfZGlydHlDb21wb3NpdGlvbiIsImxheWVyIiwiaiIsImNhbWVyYSIsImluZGV4IiwiaW5kZXhPZiIsInB1c2giLCJzb3J0UHJpb3JpdHkiLCJjbGVhciIsInNldCIsInJlbmRlckFjdGlvbkNvdW50IiwicmVuZGVyUGFzc2VzIiwiYWRkRHVtbXlSZW5kZXJBY3Rpb24iLCJjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiIsImNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uSW5kZXgiLCJsYXN0UmVuZGVyQWN0aW9uIiwicG9zdFByb2Nlc3NNYXJrZWQiLCJpc0xheWVyRW5hYmxlZCIsImVuYWJsZWQiLCJsYXllcnMiLCJpZCIsImRpc2FibGVQb3N0RWZmZWN0c0xheWVyIiwidHJpZ2dlclBvc3Rwcm9jZXNzIiwiaXNUcmFuc3BhcmVudCIsImFkZFJlbmRlckFjdGlvbiIsImxhc3RDYW1lcmFVc2UiLCJyZW5kZXJUYXJnZXQiLCJwb3N0RWZmZWN0c0VuYWJsZWQiLCJwcm9wYWdhdGVSZW5kZXJUYXJnZXQiLCJfbG9nUmVuZGVyQWN0aW9ucyIsImdldE5leHRSZW5kZXJBY3Rpb24iLCJyZW5kZXJBY3Rpb25JbmRleCIsIkRlYnVnIiwiYXNzZXJ0IiwicmVuZGVyQWN0aW9uIiwiUmVuZGVyQWN0aW9uIiwidXNlQ2FtZXJhUGFzc2VzIiwicnQiLCJMQVlFUklEX0RFUFRIIiwidXNlZCIsInJlbmRlckFjdGlvbnMiLCJ0cmFuc3BhcmVudCIsImZpcnN0Q2FtZXJhVXNlIiwibmVlZHNDYW1lcmFDbGVhciIsIm5lZWRzTGF5ZXJDbGVhciIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwic2V0dXBDbGVhcnMiLCJ1bmRlZmluZWQiLCJzdGFydEluZGV4IiwiZnJvbUNhbWVyYSIsImEiLCJ0aGlzQ2FtZXJhIiwicmVjdCIsImVxdWFscyIsInNjaXNzb3JSZWN0IiwiVHJhY2luZyIsImdldCIsIlRSQUNFSURfUkVOREVSX0FDVElPTiIsInRyYWNlIiwiZW50aXR5IiwiaXNFbmFibGVkIiwiY2xlYXJDb2xvciIsImNsZWFyRGVwdGgiLCJjbGVhclN0ZW5jaWwiLCJwYWRFbmQiLCJfaXNMYXllckFkZGVkIiwiZm91bmQiLCJfaXNTdWJsYXllckFkZGVkIiwibWFwIiwiZXJyb3IiLCJfdXBkYXRlTGF5ZXJNYXBzIiwiZmlyZSIsImluc2VydCIsInNwbGljZSIsImNvdW50IiwiX3VwZGF0ZU9wYXF1ZU9yZGVyIiwiX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIiLCJyZW1vdmUiLCJwdXNoT3BhcXVlIiwiaW5zZXJ0T3BhcXVlIiwicmVtb3ZlT3BhcXVlIiwicHVzaFRyYW5zcGFyZW50IiwiaW5zZXJ0VHJhbnNwYXJlbnQiLCJyZW1vdmVUcmFuc3BhcmVudCIsImdldE9wYXF1ZUluZGV4IiwiX3RoaXMkbGF5ZXJPcGFxdWVJbmRlIiwiZ2V0VHJhbnNwYXJlbnRJbmRleCIsIl90aGlzJGxheWVyVHJhbnNwYXJlbiIsInN1YkxheWVySW5kZXhNYXAiLCJnZXRMYXllckJ5SWQiLCJfdGhpcyRsYXllcklkTWFwJGdldCIsImdldExheWVyQnlOYW1lIiwiX3RoaXMkbGF5ZXJOYW1lTWFwJGdlIiwiZW5kSW5kZXgiLCJfc29ydExheWVyc0Rlc2NlbmRpbmciLCJsYXllcnNBIiwibGF5ZXJzQiIsIm9yZGVyIiwidG9wTGF5ZXJBIiwidG9wTGF5ZXJCIiwiaGFzT3duUHJvcGVydHkiLCJNYXRoIiwibWF4Iiwic29ydFRyYW5zcGFyZW50TGF5ZXJzIiwic29ydE9wYXF1ZUxheWVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGdCQUFnQixTQUFTQyxZQUFZLENBQUM7QUEyRnhDO0FBQ0o7QUFD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
