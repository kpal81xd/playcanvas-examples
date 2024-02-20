import { TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Tracing } from '../../core/tracing.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderAction } from '../composition/render-action.js';

/**
 * A render pass used render a set of layers using a camera.
 *
 * @ignore
 */
class RenderPassForward extends RenderPass {
  constructor(device, layerComposition, scene, renderer) {
    super(device);
    /**
     * @type {import('../composition/layer-composition.js').LayerComposition}
     */
    this.layerComposition = void 0;
    /**
     * @type {import('../scene.js').Scene}
     */
    this.scene = void 0;
    /**
     * @type {import('./renderer.js').Renderer}
     */
    this.renderer = void 0;
    /**
     * @type {import('../composition/render-action.js').RenderAction[]}
     */
    this.renderActions = [];
    /**
     * If true, do not clear the depth buffer before rendering, as it was already primed by a depth
     * pre-pass.
     *
     * @type {boolean}
     */
    this.noDepthClear = false;
    this.layerComposition = layerComposition;
    this.scene = scene;
    this.renderer = renderer;
  }
  addRenderAction(renderAction) {
    this.renderActions.push(renderAction);
  }

  /**
   * Adds a layer to be rendered by this render pass.
   *
   * @param {import('../../framework/components/camera/component.js').CameraComponent} cameraComponent -
   * The camera component that is used to render the layers.
   * @param {import('../layer.js').Layer} layer - The layer to be added.
   * @param {boolean} transparent - True if the layer is transparent.
   * @param {boolean} autoClears - True if the render target should be cleared based on the camera
   * and layer clear flags. Defaults to true.
   */
  addLayer(cameraComponent, layer, transparent, autoClears = true) {
    Debug.assert(cameraComponent);
    Debug.assert(this.renderTarget !== undefined, `Render pass needs to be initialized before adding layers`);
    Debug.assert(cameraComponent.camera.layersSet.has(layer.id), `Camera ${cameraComponent.entity.name} does not render layer ${layer.name}.`);
    const ra = new RenderAction();
    ra.renderTarget = this.renderTarget;
    ra.camera = cameraComponent;
    ra.layer = layer;
    ra.transparent = transparent;

    // camera / layer clear flags
    if (autoClears) {
      const firstRa = this.renderActions.length === 0;
      ra.setupClears(firstRa ? cameraComponent : undefined, layer);
    }
    this.addRenderAction(ra);
  }

  /**
   * Adds layers to be rendered by this render pass, starting from the given index of the layer
   * in the layer composition, till the end of the layer list, or till the last layer with the
   * given id and transparency is reached (inclusive). Note that only layers that are enabled
   * and are rendered by the specified camera are added.
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} composition - The
   * layer composition containing the layers to be added, typically the scene layer composition.
   * @param {import('../../framework/components/camera/component.js').CameraComponent} cameraComponent -
   * The camera component that is used to render the layers.
   * @param {number} startIndex - The index of the first layer to be considered for adding.
   * @param {boolean} firstLayerClears - True if the first layer added should clear the render
   * target.
   * @param {number} [lastLayerId] - The id of the last layer to be added. If not specified, all
   * layers till the end of the layer list are added.
   * @param {boolean} [lastLayerIsTransparent] - True if the last layer to be added is transparent.
   * Defaults to true.
   * @returns {number} Returns the index of last layer added.
   */
  addLayers(composition, cameraComponent, startIndex, firstLayerClears, lastLayerId, lastLayerIsTransparent = true) {
    const {
      layerList,
      subLayerEnabled,
      subLayerList
    } = composition;
    let clearRenderTarget = firstLayerClears;
    let index = startIndex;
    while (index < layerList.length) {
      const layer = layerList[index];
      const isTransparent = subLayerList[index];
      const enabled = layer.enabled && subLayerEnabled[index];
      const renderedbyCamera = cameraComponent.camera.layersSet.has(layer.id);

      // add it for rendering
      if (enabled && renderedbyCamera) {
        this.addLayer(cameraComponent, layer, isTransparent, clearRenderTarget);
        clearRenderTarget = false;
      }
      index++;

      // stop at last requested layer
      if (layer.id === lastLayerId && isTransparent === lastLayerIsTransparent) {
        break;
      }
    }
    return index;
  }
  updateDirectionalShadows() {
    // add directional shadow passes if needed for the cameras used in this render pass
    const {
      renderer,
      renderActions
    } = this;
    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const cameraComp = renderAction.camera;
      const camera = cameraComp.camera;

      // if this camera uses directional shadow lights
      const shadowDirLights = this.renderer.cameraDirShadowLights.get(camera);
      if (shadowDirLights) {
        for (let l = 0; l < shadowDirLights.length; l++) {
          const light = shadowDirLights[l];

          // the the shadow map is not already rendered for this light
          if (renderer.dirLightShadows.get(light) !== camera) {
            renderer.dirLightShadows.set(light, camera);

            // render the shadow before this render pass
            const shadowPass = renderer._shadowRendererDirectional.getLightRenderPass(light, camera);
            if (shadowPass) {
              this.beforePasses.push(shadowPass);
            }
          }
        }
      }
    }
  }
  updateClears() {
    // based on the first render action
    const renderAction = this.renderActions[0];
    if (renderAction) {
      // set up clear params if the camera covers the full viewport
      const cameraComponent = renderAction.camera;
      const camera = cameraComponent.camera;
      const fullSizeClearRect = camera.fullSizeClearRect;
      this.setClearColor(fullSizeClearRect && renderAction.clearColor ? camera.clearColor : undefined);
      this.setClearDepth(fullSizeClearRect && renderAction.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
      this.setClearStencil(fullSizeClearRect && renderAction.clearStencil ? camera.clearStencil : undefined);
    }
  }
  frameUpdate() {
    super.frameUpdate();
    this.updateDirectionalShadows();
    this.updateClears();
  }
  before() {
    const {
      renderActions
    } = this;
    if (renderActions.length) {
      // callback on the camera component before rendering with this camera for the first time
      const ra = renderActions[0];
      if (ra.camera.onPreRender && ra.firstCameraUse) {
        ra.camera.onPreRender();
      }
    }
  }
  execute() {
    const {
      layerComposition,
      renderActions
    } = this;
    for (let i = 0; i < renderActions.length; i++) {
      const ra = renderActions[i];
      if (layerComposition.isEnabled(ra.layer, ra.transparent)) {
        this.renderRenderAction(ra, i === 0);
      }
    }
  }
  after() {
    const {
      renderActions
    } = this;
    if (renderActions.length) {
      // callback on the camera component when we're done rendering with this camera
      const ra = renderActions[renderActions.length - 1];
      if (ra.camera.onPostRender && ra.lastCameraUse) {
        ra.camera.onPostRender();
      }
    }

    // remove shadow before-passes
    this.beforePasses.length = 0;
  }

  /**
   * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
   * action.
   * @param {boolean} firstRenderAction - True if this is the first render action in the render pass.
   */
  renderRenderAction(renderAction, firstRenderAction) {
    const {
      renderer,
      layerComposition
    } = this;
    const device = renderer.device;

    // layer
    const {
      layer,
      transparent,
      camera
    } = renderAction;
    const cameraPass = layerComposition.camerasMap.get(camera);
    DebugGraphics.pushGpuMarker(this.device, camera ? camera.entity.name : 'noname');
    DebugGraphics.pushGpuMarker(this.device, `${layer.name}(${transparent ? 'TRANSP' : 'OPAQUE'})`);
    const drawTime = now();

    // Call pre-render callback if there's one
    if (!transparent && layer.onPreRenderOpaque) {
      layer.onPreRenderOpaque(cameraPass);
    } else if (transparent && layer.onPreRenderTransparent) {
      layer.onPreRenderTransparent(cameraPass);
    }

    // Called for the first sublayer and for every camera
    if (!(layer._preRenderCalledForCameras & 1 << cameraPass)) {
      if (layer.onPreRender) {
        layer.onPreRender(cameraPass);
      }
      layer._preRenderCalledForCameras |= 1 << cameraPass;
    }
    if (camera) {
      var _camera$camera$shader, _camera$camera$shader2;
      const options = {
        lightClusters: renderAction.lightClusters
      };

      // shader pass - use setting from camera if available, otherwise use layer setting
      const shaderPass = (_camera$camera$shader = (_camera$camera$shader2 = camera.camera.shaderPassInfo) == null ? void 0 : _camera$camera$shader2.index) != null ? _camera$camera$shader : layer.shaderPass;

      // if this is not a first render action to the render target, or if the render target was not
      // fully cleared on pass start, we need to execute clears here
      if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
        options.clearColor = renderAction.clearColor;
        options.clearDepth = renderAction.clearDepth;
        options.clearStencil = renderAction.clearStencil;
      }
      renderer.renderForwardLayer(camera.camera, renderAction.renderTarget, layer, transparent, shaderPass, renderAction.viewBindGroups, options);

      // Revert temp frame stuff
      // TODO: this should not be here, as each rendering / clearing should explicitly set up what
      // it requires (the properties are part of render pipeline on WebGPU anyways)
      device.setBlendState(BlendState.NOBLEND);
      device.setStencilState(null, null);
      device.setAlphaToCoverage(false);
    }

    // Call layer's post-render callback if there's one
    if (!transparent && layer.onPostRenderOpaque) {
      layer.onPostRenderOpaque(cameraPass);
    } else if (transparent && layer.onPostRenderTransparent) {
      layer.onPostRenderTransparent(cameraPass);
    }
    if (layer.onPostRender && !(layer._postRenderCalledForCameras & 1 << cameraPass)) {
      layer._postRenderCounter &= ~(transparent ? 2 : 1);
      if (layer._postRenderCounter === 0) {
        layer.onPostRender(cameraPass);
        layer._postRenderCalledForCameras |= 1 << cameraPass;
        layer._postRenderCounter = layer._postRenderCounterMax;
      }
    }
    DebugGraphics.popGpuMarker(this.device);
    DebugGraphics.popGpuMarker(this.device);
    layer._renderTime += now() - drawTime;
  }
  log(device, index) {
    super.log(device, index);
    if (Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {
      const {
        layerComposition
      } = this;
      this.renderActions.forEach((ra, index) => {
        const layer = ra.layer;
        const enabled = layer.enabled && layerComposition.isEnabled(layer, ra.transparent);
        const camera = ra.camera;
        Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    ${index}:` + (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') + (' Lay: ' + layer.name).padEnd(22, ' ') + (ra.transparent ? ' TRANSP' : ' OPAQUE') + (enabled ? ' ENABLED' : ' DISABLED') + (' Meshes: ' + layer.meshInstances.length).padEnd(5, ' '));
      });
    }
  }
}

export { RenderPassForward };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MtZm9yd2FyZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL3JlbmRlci1wYXNzLWZvcndhcmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfUEFTU19ERVRBSUwgfSBmcm9tIFwiLi4vLi4vY29yZS9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcbmltcG9ydCB7IG5vdyB9IGZyb20gXCIuLi8uLi9jb3JlL3RpbWUuanNcIjtcbmltcG9ydCB7IFRyYWNpbmcgfSBmcm9tIFwiLi4vLi4vY29yZS90cmFjaW5nLmpzXCI7XG5cbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanNcIjtcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanNcIjtcbmltcG9ydCB7IFJlbmRlclBhc3MgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXBhc3MuanNcIjtcbmltcG9ydCB7IFJlbmRlckFjdGlvbiB9IGZyb20gXCIuLi9jb21wb3NpdGlvbi9yZW5kZXItYWN0aW9uLmpzXCI7XG5cbi8qKlxuICogQSByZW5kZXIgcGFzcyB1c2VkIHJlbmRlciBhIHNldCBvZiBsYXllcnMgdXNpbmcgYSBjYW1lcmEuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJQYXNzRm9yd2FyZCBleHRlbmRzIFJlbmRlclBhc3Mge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn1cbiAgICAgKi9cbiAgICBsYXllckNvbXBvc2l0aW9uO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX1cbiAgICAgKi9cbiAgICBzY2VuZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn1cbiAgICAgKi9cbiAgICByZW5kZXJlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb25bXX1cbiAgICAgKi9cbiAgICByZW5kZXJBY3Rpb25zID0gW107XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBkbyBub3QgY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciBiZWZvcmUgcmVuZGVyaW5nLCBhcyBpdCB3YXMgYWxyZWFkeSBwcmltZWQgYnkgYSBkZXB0aFxuICAgICAqIHByZS1wYXNzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbm9EZXB0aENsZWFyID0gZmFsc2U7XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIGxheWVyQ29tcG9zaXRpb24sIHNjZW5lLCByZW5kZXJlcikge1xuICAgICAgICBzdXBlcihkZXZpY2UpO1xuXG4gICAgICAgIHRoaXMubGF5ZXJDb21wb3NpdGlvbiA9IGxheWVyQ29tcG9zaXRpb247XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuICAgIH1cblxuICAgIGFkZFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5yZW5kZXJBY3Rpb25zLnB1c2gocmVuZGVyQWN0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGF5ZXIgdG8gYmUgcmVuZGVyZWQgYnkgdGhpcyByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmFDb21wb25lbnQgLVxuICAgICAqIFRoZSBjYW1lcmEgY29tcG9uZW50IHRoYXQgaXMgdXNlZCB0byByZW5kZXIgdGhlIGxheWVycy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdG8gYmUgYWRkZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc3BhcmVudCAtIFRydWUgaWYgdGhlIGxheWVyIGlzIHRyYW5zcGFyZW50LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXV0b0NsZWFycyAtIFRydWUgaWYgdGhlIHJlbmRlciB0YXJnZXQgc2hvdWxkIGJlIGNsZWFyZWQgYmFzZWQgb24gdGhlIGNhbWVyYVxuICAgICAqIGFuZCBsYXllciBjbGVhciBmbGFncy4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBhZGRMYXllcihjYW1lcmFDb21wb25lbnQsIGxheWVyLCB0cmFuc3BhcmVudCwgYXV0b0NsZWFycyA9IHRydWUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoY2FtZXJhQ29tcG9uZW50KTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMucmVuZGVyVGFyZ2V0ICE9PSB1bmRlZmluZWQsIGBSZW5kZXIgcGFzcyBuZWVkcyB0byBiZSBpbml0aWFsaXplZCBiZWZvcmUgYWRkaW5nIGxheWVyc2ApO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoY2FtZXJhQ29tcG9uZW50LmNhbWVyYS5sYXllcnNTZXQuaGFzKGxheWVyLmlkKSwgYENhbWVyYSAke2NhbWVyYUNvbXBvbmVudC5lbnRpdHkubmFtZX0gZG9lcyBub3QgcmVuZGVyIGxheWVyICR7bGF5ZXIubmFtZX0uYCk7XG5cbiAgICAgICAgY29uc3QgcmEgPSBuZXcgUmVuZGVyQWN0aW9uKCk7XG4gICAgICAgIHJhLnJlbmRlclRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICByYS5jYW1lcmEgPSBjYW1lcmFDb21wb25lbnQ7XG4gICAgICAgIHJhLmxheWVyID0gbGF5ZXI7XG4gICAgICAgIHJhLnRyYW5zcGFyZW50ID0gdHJhbnNwYXJlbnQ7XG5cbiAgICAgICAgLy8gY2FtZXJhIC8gbGF5ZXIgY2xlYXIgZmxhZ3NcbiAgICAgICAgaWYgKGF1dG9DbGVhcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0UmEgPSB0aGlzLnJlbmRlckFjdGlvbnMubGVuZ3RoID09PSAwO1xuICAgICAgICAgICAgcmEuc2V0dXBDbGVhcnMoZmlyc3RSYSA/IGNhbWVyYUNvbXBvbmVudCA6IHVuZGVmaW5lZCwgbGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRSZW5kZXJBY3Rpb24ocmEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgbGF5ZXJzIHRvIGJlIHJlbmRlcmVkIGJ5IHRoaXMgcmVuZGVyIHBhc3MsIHN0YXJ0aW5nIGZyb20gdGhlIGdpdmVuIGluZGV4IG9mIHRoZSBsYXllclxuICAgICAqIGluIHRoZSBsYXllciBjb21wb3NpdGlvbiwgdGlsbCB0aGUgZW5kIG9mIHRoZSBsYXllciBsaXN0LCBvciB0aWxsIHRoZSBsYXN0IGxheWVyIHdpdGggdGhlXG4gICAgICogZ2l2ZW4gaWQgYW5kIHRyYW5zcGFyZW5jeSBpcyByZWFjaGVkIChpbmNsdXNpdmUpLiBOb3RlIHRoYXQgb25seSBsYXllcnMgdGhhdCBhcmUgZW5hYmxlZFxuICAgICAqIGFuZCBhcmUgcmVuZGVyZWQgYnkgdGhlIHNwZWNpZmllZCBjYW1lcmEgYXJlIGFkZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcG9zaXRpb24gLSBUaGVcbiAgICAgKiBsYXllciBjb21wb3NpdGlvbiBjb250YWluaW5nIHRoZSBsYXllcnMgdG8gYmUgYWRkZWQsIHR5cGljYWxseSB0aGUgc2NlbmUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IGNhbWVyYUNvbXBvbmVudCAtXG4gICAgICogVGhlIGNhbWVyYSBjb21wb25lbnQgdGhhdCBpcyB1c2VkIHRvIHJlbmRlciB0aGUgbGF5ZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydEluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBmaXJzdCBsYXllciB0byBiZSBjb25zaWRlcmVkIGZvciBhZGRpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdExheWVyQ2xlYXJzIC0gVHJ1ZSBpZiB0aGUgZmlyc3QgbGF5ZXIgYWRkZWQgc2hvdWxkIGNsZWFyIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtsYXN0TGF5ZXJJZF0gLSBUaGUgaWQgb2YgdGhlIGxhc3QgbGF5ZXIgdG8gYmUgYWRkZWQuIElmIG5vdCBzcGVjaWZpZWQsIGFsbFxuICAgICAqIGxheWVycyB0aWxsIHRoZSBlbmQgb2YgdGhlIGxheWVyIGxpc3QgYXJlIGFkZGVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2xhc3RMYXllcklzVHJhbnNwYXJlbnRdIC0gVHJ1ZSBpZiB0aGUgbGFzdCBsYXllciB0byBiZSBhZGRlZCBpcyB0cmFuc3BhcmVudC5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIGxhc3QgbGF5ZXIgYWRkZWQuXG4gICAgICovXG4gICAgYWRkTGF5ZXJzKGNvbXBvc2l0aW9uLCBjYW1lcmFDb21wb25lbnQsIHN0YXJ0SW5kZXgsIGZpcnN0TGF5ZXJDbGVhcnMsIGxhc3RMYXllcklkLCBsYXN0TGF5ZXJJc1RyYW5zcGFyZW50ID0gdHJ1ZSkge1xuXG4gICAgICAgIGNvbnN0IHsgbGF5ZXJMaXN0LCBzdWJMYXllckVuYWJsZWQsIHN1YkxheWVyTGlzdCB9ID0gY29tcG9zaXRpb247XG4gICAgICAgIGxldCBjbGVhclJlbmRlclRhcmdldCA9IGZpcnN0TGF5ZXJDbGVhcnM7XG5cbiAgICAgICAgbGV0IGluZGV4ID0gc3RhcnRJbmRleDtcbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGF5ZXJMaXN0Lmxlbmd0aCkge1xuXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyTGlzdFtpbmRleF07XG4gICAgICAgICAgICBjb25zdCBpc1RyYW5zcGFyZW50ID0gc3ViTGF5ZXJMaXN0W2luZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSBsYXllci5lbmFibGVkICYmIHN1YkxheWVyRW5hYmxlZFtpbmRleF07XG4gICAgICAgICAgICBjb25zdCByZW5kZXJlZGJ5Q2FtZXJhID0gY2FtZXJhQ29tcG9uZW50LmNhbWVyYS5sYXllcnNTZXQuaGFzKGxheWVyLmlkKTtcblxuICAgICAgICAgICAgLy8gYWRkIGl0IGZvciByZW5kZXJpbmdcbiAgICAgICAgICAgIGlmIChlbmFibGVkICYmIHJlbmRlcmVkYnlDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExheWVyKGNhbWVyYUNvbXBvbmVudCwgbGF5ZXIsIGlzVHJhbnNwYXJlbnQsIGNsZWFyUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICBjbGVhclJlbmRlclRhcmdldCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICAvLyBzdG9wIGF0IGxhc3QgcmVxdWVzdGVkIGxheWVyXG4gICAgICAgICAgICBpZiAobGF5ZXIuaWQgPT09IGxhc3RMYXllcklkICYmIGlzVHJhbnNwYXJlbnQgPT09IGxhc3RMYXllcklzVHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICB9XG5cbiAgICB1cGRhdGVEaXJlY3Rpb25hbFNoYWRvd3MoKSB7XG4gICAgICAgIC8vIGFkZCBkaXJlY3Rpb25hbCBzaGFkb3cgcGFzc2VzIGlmIG5lZWRlZCBmb3IgdGhlIGNhbWVyYXMgdXNlZCBpbiB0aGlzIHJlbmRlciBwYXNzXG4gICAgICAgIGNvbnN0IHsgcmVuZGVyZXIsIHJlbmRlckFjdGlvbnMgfSA9IHRoaXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYUNvbXAgPSByZW5kZXJBY3Rpb24uY2FtZXJhO1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gY2FtZXJhQ29tcC5jYW1lcmE7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgY2FtZXJhIHVzZXMgZGlyZWN0aW9uYWwgc2hhZG93IGxpZ2h0c1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93RGlyTGlnaHRzID0gdGhpcy5yZW5kZXJlci5jYW1lcmFEaXJTaGFkb3dMaWdodHMuZ2V0KGNhbWVyYSk7XG4gICAgICAgICAgICBpZiAoc2hhZG93RGlyTGlnaHRzKSB7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsID0gMDsgbCA8IHNoYWRvd0RpckxpZ2h0cy5sZW5ndGg7IGwrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IHNoYWRvd0RpckxpZ2h0c1tsXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgdGhlIHNoYWRvdyBtYXAgaXMgbm90IGFscmVhZHkgcmVuZGVyZWQgZm9yIHRoaXMgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmRlcmVyLmRpckxpZ2h0U2hhZG93cy5nZXQobGlnaHQpICE9PSBjYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbmRlcmVyLmRpckxpZ2h0U2hhZG93cy5zZXQobGlnaHQsIGNhbWVyYSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbmRlciB0aGUgc2hhZG93IGJlZm9yZSB0aGlzIHJlbmRlciBwYXNzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gcmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuZ2V0TGlnaHRSZW5kZXJQYXNzKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoYWRvd1Bhc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZm9yZVBhc3Nlcy5wdXNoKHNoYWRvd1Bhc3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlQ2xlYXJzKCkge1xuXG4gICAgICAgIC8vIGJhc2VkIG9uIHRoZSBmaXJzdCByZW5kZXIgYWN0aW9uXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHRoaXMucmVuZGVyQWN0aW9uc1swXTtcbiAgICAgICAgaWYgKHJlbmRlckFjdGlvbikge1xuXG4gICAgICAgICAgICAvLyBzZXQgdXAgY2xlYXIgcGFyYW1zIGlmIHRoZSBjYW1lcmEgY292ZXJzIHRoZSBmdWxsIHZpZXdwb3J0XG4gICAgICAgICAgICBjb25zdCBjYW1lcmFDb21wb25lbnQgPSByZW5kZXJBY3Rpb24uY2FtZXJhO1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gY2FtZXJhQ29tcG9uZW50LmNhbWVyYTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxTaXplQ2xlYXJSZWN0ID0gY2FtZXJhLmZ1bGxTaXplQ2xlYXJSZWN0O1xuXG4gICAgICAgICAgICB0aGlzLnNldENsZWFyQ29sb3IoZnVsbFNpemVDbGVhclJlY3QgJiYgcmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IgPyBjYW1lcmEuY2xlYXJDb2xvciA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB0aGlzLnNldENsZWFyRGVwdGgoZnVsbFNpemVDbGVhclJlY3QgJiYgcmVuZGVyQWN0aW9uLmNsZWFyRGVwdGggJiYgIXRoaXMubm9EZXB0aENsZWFyID8gY2FtZXJhLmNsZWFyRGVwdGggOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgdGhpcy5zZXRDbGVhclN0ZW5jaWwoZnVsbFNpemVDbGVhclJlY3QgJiYgcmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCA/IGNhbWVyYS5jbGVhclN0ZW5jaWwgOiB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnJhbWVVcGRhdGUoKSB7XG4gICAgICAgIHN1cGVyLmZyYW1lVXBkYXRlKCk7XG4gICAgICAgIHRoaXMudXBkYXRlRGlyZWN0aW9uYWxTaGFkb3dzKCk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2xlYXJzKCk7XG4gICAgfVxuXG4gICAgYmVmb3JlKCkge1xuICAgICAgICBjb25zdCB7IHJlbmRlckFjdGlvbnMgfSA9IHRoaXM7XG4gICAgICAgIGlmIChyZW5kZXJBY3Rpb25zLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBvbiB0aGUgY2FtZXJhIGNvbXBvbmVudCBiZWZvcmUgcmVuZGVyaW5nIHdpdGggdGhpcyBjYW1lcmEgZm9yIHRoZSBmaXJzdCB0aW1lXG4gICAgICAgICAgICBjb25zdCByYSA9IHJlbmRlckFjdGlvbnNbMF07XG4gICAgICAgICAgICBpZiAocmEuY2FtZXJhLm9uUHJlUmVuZGVyICYmIHJhLmZpcnN0Q2FtZXJhVXNlKSB7XG4gICAgICAgICAgICAgICAgcmEuY2FtZXJhLm9uUHJlUmVuZGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBleGVjdXRlKCkge1xuICAgICAgICBjb25zdCB7IGxheWVyQ29tcG9zaXRpb24sIHJlbmRlckFjdGlvbnMgfSA9IHRoaXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmEgPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgaWYgKGxheWVyQ29tcG9zaXRpb24uaXNFbmFibGVkKHJhLmxheWVyLCByYS50cmFuc3BhcmVudCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlbmRlckFjdGlvbihyYSwgaSA9PT0gMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZnRlcigpIHtcbiAgICAgICAgY29uc3QgeyByZW5kZXJBY3Rpb25zIH0gPSB0aGlzO1xuICAgICAgICBpZiAocmVuZGVyQWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIG9uIHRoZSBjYW1lcmEgY29tcG9uZW50IHdoZW4gd2UncmUgZG9uZSByZW5kZXJpbmcgd2l0aCB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgY29uc3QgcmEgPSByZW5kZXJBY3Rpb25zW3JlbmRlckFjdGlvbnMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBpZiAocmEuY2FtZXJhLm9uUG9zdFJlbmRlciAmJiByYS5sYXN0Q2FtZXJhVXNlKSB7XG4gICAgICAgICAgICAgICAgcmEuY2FtZXJhLm9uUG9zdFJlbmRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIHNoYWRvdyBiZWZvcmUtcGFzc2VzXG4gICAgICAgIHRoaXMuYmVmb3JlUGFzc2VzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXJcbiAgICAgKiBhY3Rpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdFJlbmRlckFjdGlvbiAtIFRydWUgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBpbiB0aGUgcmVuZGVyIHBhc3MuXG4gICAgICovXG4gICAgcmVuZGVyUmVuZGVyQWN0aW9uKHJlbmRlckFjdGlvbiwgZmlyc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBjb25zdCB7IHJlbmRlcmVyLCBsYXllckNvbXBvc2l0aW9uIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSByZW5kZXJlci5kZXZpY2U7XG5cbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgY29uc3QgeyBsYXllciwgdHJhbnNwYXJlbnQsIGNhbWVyYSB9ID0gcmVuZGVyQWN0aW9uO1xuICAgICAgICBjb25zdCBjYW1lcmFQYXNzID0gbGF5ZXJDb21wb3NpdGlvbi5jYW1lcmFzTWFwLmdldChjYW1lcmEpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJ25vbmFtZScpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGAke2xheWVyLm5hbWV9KCR7dHJhbnNwYXJlbnQgPyAnVFJBTlNQJyA6ICdPUEFRVUUnfSlgKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGRyYXdUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIENhbGwgcHJlLXJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUHJlUmVuZGVyT3BhcXVlKSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlck9wYXF1ZShjYW1lcmFQYXNzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KGNhbWVyYVBhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGVkIGZvciB0aGUgZmlyc3Qgc3VibGF5ZXIgYW5kIGZvciBldmVyeSBjYW1lcmFcbiAgICAgICAgaWYgKCEobGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgJiAoMSA8PCBjYW1lcmFQYXNzKSkpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlUmVuZGVyKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgfD0gMSA8PCBjYW1lcmFQYXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxpZ2h0Q2x1c3RlcnM6IHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBzaGFkZXIgcGFzcyAtIHVzZSBzZXR0aW5nIGZyb20gY2FtZXJhIGlmIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIHVzZSBsYXllciBzZXR0aW5nXG4gICAgICAgICAgICBjb25zdCBzaGFkZXJQYXNzID0gY2FtZXJhLmNhbWVyYS5zaGFkZXJQYXNzSW5mbz8uaW5kZXggPz8gbGF5ZXIuc2hhZGVyUGFzcztcblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBub3QgYSBmaXJzdCByZW5kZXIgYWN0aW9uIHRvIHRoZSByZW5kZXIgdGFyZ2V0LCBvciBpZiB0aGUgcmVuZGVyIHRhcmdldCB3YXMgbm90XG4gICAgICAgICAgICAvLyBmdWxseSBjbGVhcmVkIG9uIHBhc3Mgc3RhcnQsIHdlIG5lZWQgdG8gZXhlY3V0ZSBjbGVhcnMgaGVyZVxuICAgICAgICAgICAgaWYgKCFmaXJzdFJlbmRlckFjdGlvbiB8fCAhY2FtZXJhLmNhbWVyYS5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuY2xlYXJDb2xvciA9IHJlbmRlckFjdGlvbi5jbGVhckNvbG9yO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuY2xlYXJEZXB0aCA9IHJlbmRlckFjdGlvbi5jbGVhckRlcHRoO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuY2xlYXJTdGVuY2lsID0gcmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVuZGVyZXIucmVuZGVyRm9yd2FyZExheWVyKGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQsIGxheWVyLCB0cmFuc3BhcmVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJQYXNzLCByZW5kZXJBY3Rpb24udmlld0JpbmRHcm91cHMsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAvLyBSZXZlcnQgdGVtcCBmcmFtZSBzdHVmZlxuICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgbm90IGJlIGhlcmUsIGFzIGVhY2ggcmVuZGVyaW5nIC8gY2xlYXJpbmcgc2hvdWxkIGV4cGxpY2l0bHkgc2V0IHVwIHdoYXRcbiAgICAgICAgICAgIC8vIGl0IHJlcXVpcmVzICh0aGUgcHJvcGVydGllcyBhcmUgcGFydCBvZiByZW5kZXIgcGlwZWxpbmUgb24gV2ViR1BVIGFueXdheXMpXG4gICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLk5PQkxFTkQpO1xuICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShudWxsLCBudWxsKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRBbHBoYVRvQ292ZXJhZ2UoZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbCBsYXllcidzIHBvc3QtcmVuZGVyIGNhbGxiYWNrIGlmIHRoZXJlJ3Mgb25lXG4gICAgICAgIGlmICghdHJhbnNwYXJlbnQgJiYgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KGNhbWVyYVBhc3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsYXllci5vblBvc3RSZW5kZXIgJiYgIShsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgJiAoMSA8PCBjYW1lcmFQYXNzKSkpIHtcbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciAmPSB+KHRyYW5zcGFyZW50ID8gMiA6IDEpO1xuICAgICAgICAgICAgaWYgKGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgfD0gMSA8PCBjYW1lcmFQYXNzO1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciA9IGxheWVyLl9wb3N0UmVuZGVyQ291bnRlck1heDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgbGF5ZXIuX3JlbmRlclRpbWUgKz0gbm93KCkgLSBkcmF3VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gI2lmIF9ERUJVR1xuICAgIGxvZyhkZXZpY2UsIGluZGV4KSB7XG4gICAgICAgIHN1cGVyLmxvZyhkZXZpY2UsIGluZGV4KTtcblxuICAgICAgICBpZiAoVHJhY2luZy5nZXQoVFJBQ0VJRF9SRU5ERVJfUEFTU19ERVRBSUwpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgbGF5ZXJDb21wb3NpdGlvbiB9ID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQWN0aW9ucy5mb3JFYWNoKChyYSwgaW5kZXgpID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gcmEubGF5ZXI7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGxheWVyLmVuYWJsZWQgJiYgbGF5ZXJDb21wb3NpdGlvbi5pc0VuYWJsZWQobGF5ZXIsIHJhLnRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSByYS5jYW1lcmE7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9QQVNTX0RFVEFJTCwgYCAgICAke2luZGV4fTpgICtcbiAgICAgICAgICAgICAgICAgICAgKCcgQ2FtOiAnICsgKGNhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJykpLnBhZEVuZCgyMiwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICgnIExheTogJyArIGxheWVyLm5hbWUpLnBhZEVuZCgyMiwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgIChyYS50cmFuc3BhcmVudCA/ICcgVFJBTlNQJyA6ICcgT1BBUVVFJykgK1xuICAgICAgICAgICAgICAgICAgICAoZW5hYmxlZCA/ICcgRU5BQkxFRCcgOiAnIERJU0FCTEVEJykgK1xuICAgICAgICAgICAgICAgICAgICAoJyBNZXNoZXM6ICcgKyBsYXllci5tZXNoSW5zdGFuY2VzLmxlbmd0aCkucGFkRW5kKDUsICcgJylcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gI2VuZGlmXG59XG5cbmV4cG9ydCB7IFJlbmRlclBhc3NGb3J3YXJkIH07XG4iXSwibmFtZXMiOlsiUmVuZGVyUGFzc0ZvcndhcmQiLCJSZW5kZXJQYXNzIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJsYXllckNvbXBvc2l0aW9uIiwic2NlbmUiLCJyZW5kZXJlciIsInJlbmRlckFjdGlvbnMiLCJub0RlcHRoQ2xlYXIiLCJhZGRSZW5kZXJBY3Rpb24iLCJyZW5kZXJBY3Rpb24iLCJwdXNoIiwiYWRkTGF5ZXIiLCJjYW1lcmFDb21wb25lbnQiLCJsYXllciIsInRyYW5zcGFyZW50IiwiYXV0b0NsZWFycyIsIkRlYnVnIiwiYXNzZXJ0IiwicmVuZGVyVGFyZ2V0IiwidW5kZWZpbmVkIiwiY2FtZXJhIiwibGF5ZXJzU2V0IiwiaGFzIiwiaWQiLCJlbnRpdHkiLCJuYW1lIiwicmEiLCJSZW5kZXJBY3Rpb24iLCJmaXJzdFJhIiwibGVuZ3RoIiwic2V0dXBDbGVhcnMiLCJhZGRMYXllcnMiLCJjb21wb3NpdGlvbiIsInN0YXJ0SW5kZXgiLCJmaXJzdExheWVyQ2xlYXJzIiwibGFzdExheWVySWQiLCJsYXN0TGF5ZXJJc1RyYW5zcGFyZW50IiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwic3ViTGF5ZXJMaXN0IiwiY2xlYXJSZW5kZXJUYXJnZXQiLCJpbmRleCIsImlzVHJhbnNwYXJlbnQiLCJlbmFibGVkIiwicmVuZGVyZWRieUNhbWVyYSIsInVwZGF0ZURpcmVjdGlvbmFsU2hhZG93cyIsImkiLCJjYW1lcmFDb21wIiwic2hhZG93RGlyTGlnaHRzIiwiY2FtZXJhRGlyU2hhZG93TGlnaHRzIiwiZ2V0IiwibCIsImxpZ2h0IiwiZGlyTGlnaHRTaGFkb3dzIiwic2V0Iiwic2hhZG93UGFzcyIsIl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwiZ2V0TGlnaHRSZW5kZXJQYXNzIiwiYmVmb3JlUGFzc2VzIiwidXBkYXRlQ2xlYXJzIiwiZnVsbFNpemVDbGVhclJlY3QiLCJzZXRDbGVhckNvbG9yIiwiY2xlYXJDb2xvciIsInNldENsZWFyRGVwdGgiLCJjbGVhckRlcHRoIiwic2V0Q2xlYXJTdGVuY2lsIiwiY2xlYXJTdGVuY2lsIiwiZnJhbWVVcGRhdGUiLCJiZWZvcmUiLCJvblByZVJlbmRlciIsImZpcnN0Q2FtZXJhVXNlIiwiZXhlY3V0ZSIsImlzRW5hYmxlZCIsInJlbmRlclJlbmRlckFjdGlvbiIsImFmdGVyIiwib25Qb3N0UmVuZGVyIiwibGFzdENhbWVyYVVzZSIsImZpcnN0UmVuZGVyQWN0aW9uIiwiY2FtZXJhUGFzcyIsImNhbWVyYXNNYXAiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImRyYXdUaW1lIiwibm93Iiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblByZVJlbmRlclRyYW5zcGFyZW50IiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfY2FtZXJhJGNhbWVyYSRzaGFkZXIiLCJfY2FtZXJhJGNhbWVyYSRzaGFkZXIyIiwib3B0aW9ucyIsImxpZ2h0Q2x1c3RlcnMiLCJzaGFkZXJQYXNzIiwic2hhZGVyUGFzc0luZm8iLCJyZW5kZXJGb3J3YXJkTGF5ZXIiLCJ2aWV3QmluZEdyb3VwcyIsInNldEJsZW5kU3RhdGUiLCJCbGVuZFN0YXRlIiwiTk9CTEVORCIsInNldFN0ZW5jaWxTdGF0ZSIsInNldEFscGhhVG9Db3ZlcmFnZSIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50IiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwicG9wR3B1TWFya2VyIiwiX3JlbmRlclRpbWUiLCJsb2ciLCJUcmFjaW5nIiwiVFJBQ0VJRF9SRU5ERVJfUEFTU19ERVRBSUwiLCJmb3JFYWNoIiwidHJhY2UiLCJwYWRFbmQiLCJtZXNoSW5zdGFuY2VzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsaUJBQWlCLFNBQVNDLFVBQVUsQ0FBQztFQTZCdkNDLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsZ0JBQWdCLEVBQUVDLEtBQUssRUFBRUMsUUFBUSxFQUFFO0lBQ25ELEtBQUssQ0FBQ0gsTUFBTSxDQUFDLENBQUE7QUE3QmpCO0FBQ0o7QUFDQTtBQUZJLElBQUEsSUFBQSxDQUdBQyxnQkFBZ0IsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVoQjtBQUNKO0FBQ0E7QUFGSSxJQUFBLElBQUEsQ0FHQUMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUw7QUFDSjtBQUNBO0FBRkksSUFBQSxJQUFBLENBR0FDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVSO0FBQ0o7QUFDQTtJQUZJLElBR0FDLENBQUFBLGFBQWEsR0FBRyxFQUFFLENBQUE7QUFFbEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUtoQixJQUFJLENBQUNKLGdCQUFnQixHQUFHQSxnQkFBZ0IsQ0FBQTtJQUN4QyxJQUFJLENBQUNDLEtBQUssR0FBR0EsS0FBSyxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsUUFBUSxHQUFHQSxRQUFRLENBQUE7QUFDNUIsR0FBQTtFQUVBRyxlQUFlQSxDQUFDQyxZQUFZLEVBQUU7QUFDMUIsSUFBQSxJQUFJLENBQUNILGFBQWEsQ0FBQ0ksSUFBSSxDQUFDRCxZQUFZLENBQUMsQ0FBQTtBQUN6QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lFLFFBQVFBLENBQUNDLGVBQWUsRUFBRUMsS0FBSyxFQUFFQyxXQUFXLEVBQUVDLFVBQVUsR0FBRyxJQUFJLEVBQUU7QUFFN0RDLElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDTCxlQUFlLENBQUMsQ0FBQTtJQUM3QkksS0FBSyxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDQyxZQUFZLEtBQUtDLFNBQVMsRUFBRyxDQUFBLHdEQUFBLENBQXlELENBQUMsQ0FBQTtJQUN6R0gsS0FBSyxDQUFDQyxNQUFNLENBQUNMLGVBQWUsQ0FBQ1EsTUFBTSxDQUFDQyxTQUFTLENBQUNDLEdBQUcsQ0FBQ1QsS0FBSyxDQUFDVSxFQUFFLENBQUMsRUFBRyxDQUFBLE9BQUEsRUFBU1gsZUFBZSxDQUFDWSxNQUFNLENBQUNDLElBQUssQ0FBQSx1QkFBQSxFQUF5QlosS0FBSyxDQUFDWSxJQUFLLENBQUEsQ0FBQSxDQUFFLENBQUMsQ0FBQTtBQUUxSSxJQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJQyxZQUFZLEVBQUUsQ0FBQTtBQUM3QkQsSUFBQUEsRUFBRSxDQUFDUixZQUFZLEdBQUcsSUFBSSxDQUFDQSxZQUFZLENBQUE7SUFDbkNRLEVBQUUsQ0FBQ04sTUFBTSxHQUFHUixlQUFlLENBQUE7SUFDM0JjLEVBQUUsQ0FBQ2IsS0FBSyxHQUFHQSxLQUFLLENBQUE7SUFDaEJhLEVBQUUsQ0FBQ1osV0FBVyxHQUFHQSxXQUFXLENBQUE7O0FBRTVCO0FBQ0EsSUFBQSxJQUFJQyxVQUFVLEVBQUU7TUFDWixNQUFNYSxPQUFPLEdBQUcsSUFBSSxDQUFDdEIsYUFBYSxDQUFDdUIsTUFBTSxLQUFLLENBQUMsQ0FBQTtNQUMvQ0gsRUFBRSxDQUFDSSxXQUFXLENBQUNGLE9BQU8sR0FBR2hCLGVBQWUsR0FBR08sU0FBUyxFQUFFTixLQUFLLENBQUMsQ0FBQTtBQUNoRSxLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUNMLGVBQWUsQ0FBQ2tCLEVBQUUsQ0FBQyxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUssRUFBQUEsU0FBU0EsQ0FBQ0MsV0FBVyxFQUFFcEIsZUFBZSxFQUFFcUIsVUFBVSxFQUFFQyxnQkFBZ0IsRUFBRUMsV0FBVyxFQUFFQyxzQkFBc0IsR0FBRyxJQUFJLEVBQUU7SUFFOUcsTUFBTTtNQUFFQyxTQUFTO01BQUVDLGVBQWU7QUFBRUMsTUFBQUEsWUFBQUE7QUFBYSxLQUFDLEdBQUdQLFdBQVcsQ0FBQTtJQUNoRSxJQUFJUSxpQkFBaUIsR0FBR04sZ0JBQWdCLENBQUE7SUFFeEMsSUFBSU8sS0FBSyxHQUFHUixVQUFVLENBQUE7QUFDdEIsSUFBQSxPQUFPUSxLQUFLLEdBQUdKLFNBQVMsQ0FBQ1IsTUFBTSxFQUFFO0FBRTdCLE1BQUEsTUFBTWhCLEtBQUssR0FBR3dCLFNBQVMsQ0FBQ0ksS0FBSyxDQUFDLENBQUE7QUFDOUIsTUFBQSxNQUFNQyxhQUFhLEdBQUdILFlBQVksQ0FBQ0UsS0FBSyxDQUFDLENBQUE7TUFDekMsTUFBTUUsT0FBTyxHQUFHOUIsS0FBSyxDQUFDOEIsT0FBTyxJQUFJTCxlQUFlLENBQUNHLEtBQUssQ0FBQyxDQUFBO0FBQ3ZELE1BQUEsTUFBTUcsZ0JBQWdCLEdBQUdoQyxlQUFlLENBQUNRLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxHQUFHLENBQUNULEtBQUssQ0FBQ1UsRUFBRSxDQUFDLENBQUE7O0FBRXZFO01BQ0EsSUFBSW9CLE9BQU8sSUFBSUMsZ0JBQWdCLEVBQUU7UUFDN0IsSUFBSSxDQUFDakMsUUFBUSxDQUFDQyxlQUFlLEVBQUVDLEtBQUssRUFBRTZCLGFBQWEsRUFBRUYsaUJBQWlCLENBQUMsQ0FBQTtBQUN2RUEsUUFBQUEsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO0FBQzdCLE9BQUE7QUFFQUMsTUFBQUEsS0FBSyxFQUFFLENBQUE7O0FBRVA7TUFDQSxJQUFJNUIsS0FBSyxDQUFDVSxFQUFFLEtBQUtZLFdBQVcsSUFBSU8sYUFBYSxLQUFLTixzQkFBc0IsRUFBRTtBQUN0RSxRQUFBLE1BQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsT0FBT0ssS0FBSyxDQUFBO0FBQ2hCLEdBQUE7QUFFQUksRUFBQUEsd0JBQXdCQSxHQUFHO0FBQ3ZCO0lBQ0EsTUFBTTtNQUFFeEMsUUFBUTtBQUFFQyxNQUFBQSxhQUFBQTtBQUFjLEtBQUMsR0FBRyxJQUFJLENBQUE7QUFDeEMsSUFBQSxLQUFLLElBQUl3QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd4QyxhQUFhLENBQUN1QixNQUFNLEVBQUVpQixDQUFDLEVBQUUsRUFBRTtBQUMzQyxNQUFBLE1BQU1yQyxZQUFZLEdBQUdILGFBQWEsQ0FBQ3dDLENBQUMsQ0FBQyxDQUFBO0FBQ3JDLE1BQUEsTUFBTUMsVUFBVSxHQUFHdEMsWUFBWSxDQUFDVyxNQUFNLENBQUE7QUFDdEMsTUFBQSxNQUFNQSxNQUFNLEdBQUcyQixVQUFVLENBQUMzQixNQUFNLENBQUE7O0FBRWhDO01BQ0EsTUFBTTRCLGVBQWUsR0FBRyxJQUFJLENBQUMzQyxRQUFRLENBQUM0QyxxQkFBcUIsQ0FBQ0MsR0FBRyxDQUFDOUIsTUFBTSxDQUFDLENBQUE7QUFDdkUsTUFBQSxJQUFJNEIsZUFBZSxFQUFFO0FBRWpCLFFBQUEsS0FBSyxJQUFJRyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdILGVBQWUsQ0FBQ25CLE1BQU0sRUFBRXNCLENBQUMsRUFBRSxFQUFFO0FBQzdDLFVBQUEsTUFBTUMsS0FBSyxHQUFHSixlQUFlLENBQUNHLENBQUMsQ0FBQyxDQUFBOztBQUVoQztVQUNBLElBQUk5QyxRQUFRLENBQUNnRCxlQUFlLENBQUNILEdBQUcsQ0FBQ0UsS0FBSyxDQUFDLEtBQUtoQyxNQUFNLEVBQUU7WUFDaERmLFFBQVEsQ0FBQ2dELGVBQWUsQ0FBQ0MsR0FBRyxDQUFDRixLQUFLLEVBQUVoQyxNQUFNLENBQUMsQ0FBQTs7QUFFM0M7WUFDQSxNQUFNbUMsVUFBVSxHQUFHbEQsUUFBUSxDQUFDbUQsMEJBQTBCLENBQUNDLGtCQUFrQixDQUFDTCxLQUFLLEVBQUVoQyxNQUFNLENBQUMsQ0FBQTtBQUN4RixZQUFBLElBQUltQyxVQUFVLEVBQUU7QUFDWixjQUFBLElBQUksQ0FBQ0csWUFBWSxDQUFDaEQsSUFBSSxDQUFDNkMsVUFBVSxDQUFDLENBQUE7QUFDdEMsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUFJLEVBQUFBLFlBQVlBLEdBQUc7QUFFWDtBQUNBLElBQUEsTUFBTWxELFlBQVksR0FBRyxJQUFJLENBQUNILGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMxQyxJQUFBLElBQUlHLFlBQVksRUFBRTtBQUVkO0FBQ0EsTUFBQSxNQUFNRyxlQUFlLEdBQUdILFlBQVksQ0FBQ1csTUFBTSxDQUFBO0FBQzNDLE1BQUEsTUFBTUEsTUFBTSxHQUFHUixlQUFlLENBQUNRLE1BQU0sQ0FBQTtBQUNyQyxNQUFBLE1BQU13QyxpQkFBaUIsR0FBR3hDLE1BQU0sQ0FBQ3dDLGlCQUFpQixDQUFBO0FBRWxELE1BQUEsSUFBSSxDQUFDQyxhQUFhLENBQUNELGlCQUFpQixJQUFJbkQsWUFBWSxDQUFDcUQsVUFBVSxHQUFHMUMsTUFBTSxDQUFDMEMsVUFBVSxHQUFHM0MsU0FBUyxDQUFDLENBQUE7QUFDaEcsTUFBQSxJQUFJLENBQUM0QyxhQUFhLENBQUNILGlCQUFpQixJQUFJbkQsWUFBWSxDQUFDdUQsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDekQsWUFBWSxHQUFHYSxNQUFNLENBQUM0QyxVQUFVLEdBQUc3QyxTQUFTLENBQUMsQ0FBQTtBQUN0SCxNQUFBLElBQUksQ0FBQzhDLGVBQWUsQ0FBQ0wsaUJBQWlCLElBQUluRCxZQUFZLENBQUN5RCxZQUFZLEdBQUc5QyxNQUFNLENBQUM4QyxZQUFZLEdBQUcvQyxTQUFTLENBQUMsQ0FBQTtBQUMxRyxLQUFBO0FBQ0osR0FBQTtBQUVBZ0QsRUFBQUEsV0FBV0EsR0FBRztJQUNWLEtBQUssQ0FBQ0EsV0FBVyxFQUFFLENBQUE7SUFDbkIsSUFBSSxDQUFDdEIsd0JBQXdCLEVBQUUsQ0FBQTtJQUMvQixJQUFJLENBQUNjLFlBQVksRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7QUFFQVMsRUFBQUEsTUFBTUEsR0FBRztJQUNMLE1BQU07QUFBRTlELE1BQUFBLGFBQUFBO0FBQWMsS0FBQyxHQUFHLElBQUksQ0FBQTtJQUM5QixJQUFJQSxhQUFhLENBQUN1QixNQUFNLEVBQUU7QUFFdEI7QUFDQSxNQUFBLE1BQU1ILEVBQUUsR0FBR3BCLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUMzQixJQUFJb0IsRUFBRSxDQUFDTixNQUFNLENBQUNpRCxXQUFXLElBQUkzQyxFQUFFLENBQUM0QyxjQUFjLEVBQUU7QUFDNUM1QyxRQUFBQSxFQUFFLENBQUNOLE1BQU0sQ0FBQ2lELFdBQVcsRUFBRSxDQUFBO0FBQzNCLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBRSxFQUFBQSxPQUFPQSxHQUFHO0lBQ04sTUFBTTtNQUFFcEUsZ0JBQWdCO0FBQUVHLE1BQUFBLGFBQUFBO0FBQWMsS0FBQyxHQUFHLElBQUksQ0FBQTtBQUNoRCxJQUFBLEtBQUssSUFBSXdDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3hDLGFBQWEsQ0FBQ3VCLE1BQU0sRUFBRWlCLENBQUMsRUFBRSxFQUFFO0FBQzNDLE1BQUEsTUFBTXBCLEVBQUUsR0FBR3BCLGFBQWEsQ0FBQ3dDLENBQUMsQ0FBQyxDQUFBO0FBQzNCLE1BQUEsSUFBSTNDLGdCQUFnQixDQUFDcUUsU0FBUyxDQUFDOUMsRUFBRSxDQUFDYixLQUFLLEVBQUVhLEVBQUUsQ0FBQ1osV0FBVyxDQUFDLEVBQUU7UUFDdEQsSUFBSSxDQUFDMkQsa0JBQWtCLENBQUMvQyxFQUFFLEVBQUVvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDeEMsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUE0QixFQUFBQSxLQUFLQSxHQUFHO0lBQ0osTUFBTTtBQUFFcEUsTUFBQUEsYUFBQUE7QUFBYyxLQUFDLEdBQUcsSUFBSSxDQUFBO0lBQzlCLElBQUlBLGFBQWEsQ0FBQ3VCLE1BQU0sRUFBRTtBQUN0QjtNQUNBLE1BQU1ILEVBQUUsR0FBR3BCLGFBQWEsQ0FBQ0EsYUFBYSxDQUFDdUIsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO01BQ2xELElBQUlILEVBQUUsQ0FBQ04sTUFBTSxDQUFDdUQsWUFBWSxJQUFJakQsRUFBRSxDQUFDa0QsYUFBYSxFQUFFO0FBQzVDbEQsUUFBQUEsRUFBRSxDQUFDTixNQUFNLENBQUN1RCxZQUFZLEVBQUUsQ0FBQTtBQUM1QixPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDakIsWUFBWSxDQUFDN0IsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTRDLEVBQUFBLGtCQUFrQkEsQ0FBQ2hFLFlBQVksRUFBRW9FLGlCQUFpQixFQUFFO0lBRWhELE1BQU07TUFBRXhFLFFBQVE7QUFBRUYsTUFBQUEsZ0JBQUFBO0FBQWlCLEtBQUMsR0FBRyxJQUFJLENBQUE7QUFDM0MsSUFBQSxNQUFNRCxNQUFNLEdBQUdHLFFBQVEsQ0FBQ0gsTUFBTSxDQUFBOztBQUU5QjtJQUNBLE1BQU07TUFBRVcsS0FBSztNQUFFQyxXQUFXO0FBQUVNLE1BQUFBLE1BQUFBO0FBQU8sS0FBQyxHQUFHWCxZQUFZLENBQUE7SUFDbkQsTUFBTXFFLFVBQVUsR0FBRzNFLGdCQUFnQixDQUFDNEUsVUFBVSxDQUFDN0IsR0FBRyxDQUFDOUIsTUFBTSxDQUFDLENBQUE7QUFFMUQ0RCxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLENBQUMvRSxNQUFNLEVBQUVrQixNQUFNLEdBQUdBLE1BQU0sQ0FBQ0ksTUFBTSxDQUFDQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUE7QUFDaEZ1RCxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLENBQUMvRSxNQUFNLEVBQUcsQ0FBRVcsRUFBQUEsS0FBSyxDQUFDWSxJQUFLLElBQUdYLFdBQVcsR0FBRyxRQUFRLEdBQUcsUUFBUyxHQUFFLENBQUMsQ0FBQTtBQUcvRixJQUFBLE1BQU1vRSxRQUFRLEdBQUdDLEdBQUcsRUFBRSxDQUFBOztBQUd0QjtBQUNBLElBQUEsSUFBSSxDQUFDckUsV0FBVyxJQUFJRCxLQUFLLENBQUN1RSxpQkFBaUIsRUFBRTtBQUN6Q3ZFLE1BQUFBLEtBQUssQ0FBQ3VFLGlCQUFpQixDQUFDTixVQUFVLENBQUMsQ0FBQTtBQUN2QyxLQUFDLE1BQU0sSUFBSWhFLFdBQVcsSUFBSUQsS0FBSyxDQUFDd0Usc0JBQXNCLEVBQUU7QUFDcER4RSxNQUFBQSxLQUFLLENBQUN3RSxzQkFBc0IsQ0FBQ1AsVUFBVSxDQUFDLENBQUE7QUFDNUMsS0FBQTs7QUFFQTtJQUNBLElBQUksRUFBRWpFLEtBQUssQ0FBQ3lFLDBCQUEwQixHQUFJLENBQUMsSUFBSVIsVUFBVyxDQUFDLEVBQUU7TUFDekQsSUFBSWpFLEtBQUssQ0FBQ3dELFdBQVcsRUFBRTtBQUNuQnhELFFBQUFBLEtBQUssQ0FBQ3dELFdBQVcsQ0FBQ1MsVUFBVSxDQUFDLENBQUE7QUFDakMsT0FBQTtBQUNBakUsTUFBQUEsS0FBSyxDQUFDeUUsMEJBQTBCLElBQUksQ0FBQyxJQUFJUixVQUFVLENBQUE7QUFDdkQsS0FBQTtBQUVBLElBQUEsSUFBSTFELE1BQU0sRUFBRTtNQUFBLElBQUFtRSxxQkFBQSxFQUFBQyxzQkFBQSxDQUFBO0FBRVIsTUFBQSxNQUFNQyxPQUFPLEdBQUc7UUFDWkMsYUFBYSxFQUFFakYsWUFBWSxDQUFDaUYsYUFBQUE7T0FDL0IsQ0FBQTs7QUFFRDtNQUNBLE1BQU1DLFVBQVUsSUFBQUoscUJBQUEsR0FBQSxDQUFBQyxzQkFBQSxHQUFHcEUsTUFBTSxDQUFDQSxNQUFNLENBQUN3RSxjQUFjLEtBQTVCSixJQUFBQSxHQUFBQSxLQUFBQSxDQUFBQSxHQUFBQSxzQkFBQSxDQUE4Qi9DLEtBQUssS0FBQSxJQUFBLEdBQUE4QyxxQkFBQSxHQUFJMUUsS0FBSyxDQUFDOEUsVUFBVSxDQUFBOztBQUUxRTtBQUNBO01BQ0EsSUFBSSxDQUFDZCxpQkFBaUIsSUFBSSxDQUFDekQsTUFBTSxDQUFDQSxNQUFNLENBQUN3QyxpQkFBaUIsRUFBRTtBQUN4RDZCLFFBQUFBLE9BQU8sQ0FBQzNCLFVBQVUsR0FBR3JELFlBQVksQ0FBQ3FELFVBQVUsQ0FBQTtBQUM1QzJCLFFBQUFBLE9BQU8sQ0FBQ3pCLFVBQVUsR0FBR3ZELFlBQVksQ0FBQ3VELFVBQVUsQ0FBQTtBQUM1Q3lCLFFBQUFBLE9BQU8sQ0FBQ3ZCLFlBQVksR0FBR3pELFlBQVksQ0FBQ3lELFlBQVksQ0FBQTtBQUNwRCxPQUFBO01BRUE3RCxRQUFRLENBQUN3RixrQkFBa0IsQ0FBQ3pFLE1BQU0sQ0FBQ0EsTUFBTSxFQUFFWCxZQUFZLENBQUNTLFlBQVksRUFBRUwsS0FBSyxFQUFFQyxXQUFXLEVBQzVENkUsVUFBVSxFQUFFbEYsWUFBWSxDQUFDcUYsY0FBYyxFQUFFTCxPQUFPLENBQUMsQ0FBQTs7QUFFN0U7QUFDQTtBQUNBO0FBQ0F2RixNQUFBQSxNQUFNLENBQUM2RixhQUFhLENBQUNDLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7QUFDeEMvRixNQUFBQSxNQUFNLENBQUNnRyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2xDaEcsTUFBQUEsTUFBTSxDQUFDaUcsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDcEMsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDckYsV0FBVyxJQUFJRCxLQUFLLENBQUN1RixrQkFBa0IsRUFBRTtBQUMxQ3ZGLE1BQUFBLEtBQUssQ0FBQ3VGLGtCQUFrQixDQUFDdEIsVUFBVSxDQUFDLENBQUE7QUFDeEMsS0FBQyxNQUFNLElBQUloRSxXQUFXLElBQUlELEtBQUssQ0FBQ3dGLHVCQUF1QixFQUFFO0FBQ3JEeEYsTUFBQUEsS0FBSyxDQUFDd0YsdUJBQXVCLENBQUN2QixVQUFVLENBQUMsQ0FBQTtBQUM3QyxLQUFBO0FBQ0EsSUFBQSxJQUFJakUsS0FBSyxDQUFDOEQsWUFBWSxJQUFJLEVBQUU5RCxLQUFLLENBQUN5RiwyQkFBMkIsR0FBSSxDQUFDLElBQUl4QixVQUFXLENBQUMsRUFBRTtNQUNoRmpFLEtBQUssQ0FBQzBGLGtCQUFrQixJQUFJLEVBQUV6RixXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2xELE1BQUEsSUFBSUQsS0FBSyxDQUFDMEYsa0JBQWtCLEtBQUssQ0FBQyxFQUFFO0FBQ2hDMUYsUUFBQUEsS0FBSyxDQUFDOEQsWUFBWSxDQUFDRyxVQUFVLENBQUMsQ0FBQTtBQUM5QmpFLFFBQUFBLEtBQUssQ0FBQ3lGLDJCQUEyQixJQUFJLENBQUMsSUFBSXhCLFVBQVUsQ0FBQTtBQUNwRGpFLFFBQUFBLEtBQUssQ0FBQzBGLGtCQUFrQixHQUFHMUYsS0FBSyxDQUFDMkYscUJBQXFCLENBQUE7QUFDMUQsT0FBQTtBQUNKLEtBQUE7QUFFQXhCLElBQUFBLGFBQWEsQ0FBQ3lCLFlBQVksQ0FBQyxJQUFJLENBQUN2RyxNQUFNLENBQUMsQ0FBQTtBQUN2QzhFLElBQUFBLGFBQWEsQ0FBQ3lCLFlBQVksQ0FBQyxJQUFJLENBQUN2RyxNQUFNLENBQUMsQ0FBQTtBQUd2Q1csSUFBQUEsS0FBSyxDQUFDNkYsV0FBVyxJQUFJdkIsR0FBRyxFQUFFLEdBQUdELFFBQVEsQ0FBQTtBQUV6QyxHQUFBO0FBR0F5QixFQUFBQSxHQUFHQSxDQUFDekcsTUFBTSxFQUFFdUMsS0FBSyxFQUFFO0FBQ2YsSUFBQSxLQUFLLENBQUNrRSxHQUFHLENBQUN6RyxNQUFNLEVBQUV1QyxLQUFLLENBQUMsQ0FBQTtBQUV4QixJQUFBLElBQUltRSxPQUFPLENBQUMxRCxHQUFHLENBQUMyRCwwQkFBMEIsQ0FBQyxFQUFFO01BRXpDLE1BQU07QUFBRTFHLFFBQUFBLGdCQUFBQTtBQUFpQixPQUFDLEdBQUcsSUFBSSxDQUFBO01BQ2pDLElBQUksQ0FBQ0csYUFBYSxDQUFDd0csT0FBTyxDQUFDLENBQUNwRixFQUFFLEVBQUVlLEtBQUssS0FBSztBQUV0QyxRQUFBLE1BQU01QixLQUFLLEdBQUdhLEVBQUUsQ0FBQ2IsS0FBSyxDQUFBO0FBQ3RCLFFBQUEsTUFBTThCLE9BQU8sR0FBRzlCLEtBQUssQ0FBQzhCLE9BQU8sSUFBSXhDLGdCQUFnQixDQUFDcUUsU0FBUyxDQUFDM0QsS0FBSyxFQUFFYSxFQUFFLENBQUNaLFdBQVcsQ0FBQyxDQUFBO0FBQ2xGLFFBQUEsTUFBTU0sTUFBTSxHQUFHTSxFQUFFLENBQUNOLE1BQU0sQ0FBQTtBQUV4QkosUUFBQUEsS0FBSyxDQUFDK0YsS0FBSyxDQUFDRiwwQkFBMEIsRUFBRyxDQUFNcEUsSUFBQUEsRUFBQUEsS0FBTSxDQUFFLENBQUEsQ0FBQSxHQUNuRCxDQUFDLFFBQVEsSUFBSXJCLE1BQU0sR0FBR0EsTUFBTSxDQUFDSSxNQUFNLENBQUNDLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRXVGLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQ2hFLENBQUMsUUFBUSxHQUFHbkcsS0FBSyxDQUFDWSxJQUFJLEVBQUV1RixNQUFNLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxJQUN0Q3RGLEVBQUUsQ0FBQ1osV0FBVyxHQUFHLFNBQVMsR0FBRyxTQUFTLENBQUMsSUFDdkM2QixPQUFPLEdBQUcsVUFBVSxHQUFHLFdBQVcsQ0FBQyxHQUNwQyxDQUFDLFdBQVcsR0FBRzlCLEtBQUssQ0FBQ29HLGFBQWEsQ0FBQ3BGLE1BQU0sRUFBRW1GLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUM1RCxDQUFDLENBQUE7QUFDTCxPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFDSixHQUFBO0FBRUo7Ozs7In0=
