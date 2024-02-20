/**
 * @license
 * PlayCanvas Engine v0.0.0 revision e3db93de2
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 */
import { RenderPass, RenderTarget, LAYERID_DEPTH, SHADER_DEPTH } from 'playcanvas';

const tempMeshInstances = [];
const DEPTH_UNIFORM_NAME = 'uSceneDepthMap';
class RenderPassPrepass extends RenderPass {
  constructor(device, scene, renderer, camera, depthBuffer, options) {
    super(device);
    this.viewBindGroups = [];
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.setupRenderTarget(depthBuffer, options);
  }
  destroy() {
    super.destroy();
    this.releaseRenderTarget(this.renderTarget);
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }
  setupRenderTarget(depthBuffer, options) {
    const renderTarget = new RenderTarget({
      name: 'PrepassRT',
      depthBuffer: depthBuffer
    });
    this.init(renderTarget, options);
    this.depthStencilOps.storeDepth = true;
  }
  before() {
    this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.renderTarget.depthBuffer);
  }
  execute() {
    const {
      renderer,
      scene,
      renderTarget
    } = this;
    const camera = this.camera.camera;
    const layers = scene.layers.layerList;
    const subLayerEnabled = scene.layers.subLayerEnabled;
    const isTransparent = scene.layers.subLayerList;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.enabled && subLayerEnabled[i]) {
        if (layer.camerasSet.has(camera)) {
          if (layer.id === LAYERID_DEPTH) break;
          const culledInstances = layer.getCulledInstances(camera);
          const meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;
          for (let j = 0; j < meshInstances.length; j++) {
            var _meshInstance$materia;
            const meshInstance = meshInstances[j];
            if ((_meshInstance$materia = meshInstance.material) != null && _meshInstance$materia.depthWrite) {
              tempMeshInstances.push(meshInstance);
            }
          }
          renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_DEPTH, this.viewBindGroups, {
            meshInstances: tempMeshInstances
          });
          tempMeshInstances.length = 0;
        }
      }
    }
  }
  frameUpdate() {
    const {
      camera
    } = this;
    this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);
  }
}

export { RenderPassPrepass };
