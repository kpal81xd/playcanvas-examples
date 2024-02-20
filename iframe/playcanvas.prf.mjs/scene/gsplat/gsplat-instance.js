import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_DYNAMIC } from '../../platform/graphics/constants.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createBox } from '../procedural.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatSorter } from './gsplat-sorter.js';

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];
class GSplatInstance {
  constructor(splat, options) {
    this.splat = void 0;
    this.mesh = void 0;
    this.meshInstance = void 0;
    this.material = void 0;
    this.vb = void 0;
    this.options = {};
    this.sorter = null;
    this.lastCameraPosition = new Vec3();
    this.lastCameraDirection = new Vec3();
    this.cameras = [];
    this.splat = splat;
    options = Object.assign(this.options, options);
    const debugRender = options.debugRender;
    this.createMaterial(options);
    const device = splat.device;
    if (debugRender) {
      this.mesh = createBox(device, {
        halfExtents: new Vec3(1.0, 1.0, 1.0)
      });
    } else {
      this.mesh = new Mesh(device);
      this.mesh.setPositions(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), 2);
      this.mesh.update();
    }
    this.mesh.aabb.copy(splat.aabb);
    const numSplats = splat.numSplats;
    let indexData;
    if (!device.isWebGL1) {
      indexData = new Uint32Array(numSplats);
      for (let i = 0; i < numSplats; ++i) {
        indexData[i] = i;
      }
    } else {
      indexData = new Float32Array(numSplats);
      for (let i = 0; i < numSplats; ++i) {
        indexData[i] = i + 0.2;
      }
    }
    const vb = new VertexBuffer(device, splat.vertexFormat, numSplats, BUFFER_DYNAMIC, indexData.buffer);
    this.vb = vb;
    this.meshInstance = new MeshInstance(this.mesh, this.material);
    this.meshInstance.setInstancing(vb, true);
    this.meshInstance.gsplatInstance = this;
    this.centers = new Float32Array(splat.centers);
    if (!options.dither || options.dither === DITHER_NONE) {
      this.sorter = new GSplatSorter();
      this.sorter.init(this.vb, this.centers, !this.splat.device.isWebGL1);
    }
  }
  destroy() {
    var _this$sorter;
    this.material.destroy();
    this.vb.destroy();
    this.meshInstance.destroy();
    (_this$sorter = this.sorter) == null || _this$sorter.destroy();
  }
  clone() {
    return new GSplatInstance(this.splat, this.options);
  }
  createMaterial(options) {
    this.material = createGSplatMaterial(options);
    this.splat.setupMaterial(this.material);
    if (this.meshInstance) {
      this.meshInstance.material = this.material;
    }
  }
  updateViewport() {
    const device = this.splat.device;
    viewport[0] = device.width;
    viewport[1] = device.height;
    this.material.setParameter('viewport', viewport);
  }
  sort(cameraNode) {
    if (this.sorter) {
      const cameraMat = cameraNode.getWorldTransform();
      cameraMat.getTranslation(cameraPosition);
      cameraMat.getZ(cameraDirection);
      const modelMat = this.meshInstance.node.getWorldTransform();
      const invModelMat = mat.invert(modelMat);
      invModelMat.transformPoint(cameraPosition, cameraPosition);
      invModelMat.transformVector(cameraDirection, cameraDirection);
      if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
        this.lastCameraPosition.copy(cameraPosition);
        this.lastCameraDirection.copy(cameraDirection);
        this.sorter.setCamera(cameraPosition, cameraDirection);
      }
    }
    this.updateViewport();
  }
  update() {
    if (this.cameras.length > 0) {
      const camera = this.cameras[0];
      this.sort(camera._node);
      this.cameras.length = 0;
    }
  }
}

export { GSplatInstance };
