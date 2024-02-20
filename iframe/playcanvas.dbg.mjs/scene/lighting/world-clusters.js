import { Vec3 } from '../../core/math/vec3.js';
import { math } from '../../core/math/math.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_L8 } from '../../platform/graphics/constants.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL } from '../constants.js';
import { LightsBuffer } from './lights-buffer.js';
import { Debug } from '../../core/debug.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();
const epsilon = 0.000001;
const maxTextureSize = 4096; // maximum texture size allowed to work on all devices

// helper class to store properties of a light used by clustering
class ClusterLight {
  constructor() {
    // the light itself
    this.light = null;

    // bounding box
    this.min = new Vec3();
    this.max = new Vec3();
  }
}

// Main class implementing clustered lighting. Internally it organizes the omni / spot lights placement in world space 3d cell structure,
// and also uses LightsBuffer class to store light properties in textures
class WorldClusters {
  constructor(device) {
    /** @type {import('../../platform/graphics/texture.js').Texture} */
    this.clusterTexture = void 0;
    this.device = device;
    this.name = 'Untitled';

    // number of times a warning was reported
    this.reportCount = 0;

    // bounds of all light volumes (volume covered by the clusters)
    this.boundsMin = new Vec3();
    this.boundsMax = new Vec3();
    this.boundsDelta = new Vec3();

    // number of cells along 3 axes
    this._cells = new Vec3(1, 1, 1); // number of cells
    this._cellsLimit = new Vec3(); // number of cells minus one
    this.cells = this._cells;

    // number of lights each cell can store
    this.maxCellLightCount = 4;

    // limits on some light properties, used for compression to 8bit texture
    this._maxAttenuation = 0;
    this._maxColorValue = 0;

    // internal list of lights (of type ClusterLight)
    this._usedLights = [];

    // light 0 is always reserved for 'no light' index
    this._usedLights.push(new ClusterLight());

    // allocate textures to store lights
    this.lightsBuffer = new LightsBuffer(device);

    // register shader uniforms
    this.registerUniforms(device);
  }
  set maxCellLightCount(count) {
    if (count !== this._maxCellLightCount) {
      this._maxCellLightCount = count;
      this._cellsDirty = true;
    }
  }
  get maxCellLightCount() {
    return this._maxCellLightCount;
  }
  set cells(value) {
    // make sure we have whole numbers
    tempVec3.copy(value).floor();
    if (!this._cells.equals(tempVec3)) {
      this._cells.copy(tempVec3);
      this._cellsLimit.copy(tempVec3).sub(Vec3.ONE);
      this._cellsDirty = true;
    }
  }
  get cells() {
    return this._cells;
  }
  destroy() {
    this.lightsBuffer.destroy();
    this.releaseClusterTexture();
  }
  releaseClusterTexture() {
    if (this.clusterTexture) {
      this.clusterTexture.destroy();
      this.clusterTexture = null;
    }
  }
  registerUniforms(device) {
    this._clusterSkipId = device.scope.resolve('clusterSkip');
    this._clusterMaxCellsId = device.scope.resolve('clusterMaxCells');
    this._clusterWorldTextureId = device.scope.resolve('clusterWorldTexture');
    this._clusterTextureSizeId = device.scope.resolve('clusterTextureSize');
    this._clusterTextureSizeData = new Float32Array(3);
    this._clusterBoundsMinId = device.scope.resolve('clusterBoundsMin');
    this._clusterBoundsMinData = new Float32Array(3);
    this._clusterBoundsDeltaId = device.scope.resolve('clusterBoundsDelta');
    this._clusterBoundsDeltaData = new Float32Array(3);
    this._clusterCellsCountByBoundsSizeId = device.scope.resolve('clusterCellsCountByBoundsSize');
    this._clusterCellsCountByBoundsSizeData = new Float32Array(3);
    this._clusterCellsDotId = device.scope.resolve('clusterCellsDot');
    this._clusterCellsDotData = new Float32Array(3);

    // number of cells in each direction (vec3)
    this._clusterCellsMaxId = device.scope.resolve('clusterCellsMax');
    this._clusterCellsMaxData = new Float32Array(3);

    // compression limit 0
    this._clusterCompressionLimit0Id = device.scope.resolve('clusterCompressionLimit0');
    this._clusterCompressionLimit0Data = new Float32Array(2);
  }

  // updates itself based on parameters stored in the scene
  updateParams(lightingParams) {
    if (lightingParams) {
      this.cells = lightingParams.cells;
      this.maxCellLightCount = lightingParams.maxLightsPerCell;
      this.lightsBuffer.cookiesEnabled = lightingParams.cookiesEnabled;
      this.lightsBuffer.shadowsEnabled = lightingParams.shadowsEnabled;
      this.lightsBuffer.areaLightsEnabled = lightingParams.areaLightsEnabled;
    }
  }
  updateCells() {
    if (this._cellsDirty) {
      this._cellsDirty = false;
      const cx = this._cells.x;
      const cy = this._cells.y;
      const cz = this._cells.z;

      // storing 1 light per pixel
      const numCells = cx * cy * cz;
      const totalPixels = this.maxCellLightCount * numCells;

      // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
      let width = Math.ceil(Math.sqrt(totalPixels));
      width = math.roundUp(width, this.maxCellLightCount);
      const height = Math.ceil(totalPixels / width);

      // if the texture is allowed size
      Debug.assert(width <= maxTextureSize && height <= maxTextureSize, 'Clustered lights parameters cause the texture size to be over the limit, please adjust them.');

      // maximum range of cells
      this._clusterCellsMaxData[0] = cx;
      this._clusterCellsMaxData[1] = cy;
      this._clusterCellsMaxData[2] = cz;

      // vector to allow single dot product to convert from world coordinates to cluster index
      this._clusterCellsDotData[0] = this.maxCellLightCount;
      this._clusterCellsDotData[1] = cx * cz * this.maxCellLightCount;
      this._clusterCellsDotData[2] = cx * this.maxCellLightCount;

      // cluster data and number of lights per cell
      this.clusters = new Uint8ClampedArray(totalPixels);
      this.counts = new Int32Array(numCells);
      this._clusterTextureSizeData[0] = width;
      this._clusterTextureSizeData[1] = 1.0 / width;
      this._clusterTextureSizeData[2] = 1.0 / height;
      this.releaseClusterTexture();
      this.clusterTexture = this.lightsBuffer.createTexture(this.device, width, height, PIXELFORMAT_L8, 'ClusterTexture');
    }
  }
  uploadTextures() {
    this.clusterTexture.lock().set(this.clusters);
    this.clusterTexture.unlock();
    this.lightsBuffer.uploadTextures();
  }
  updateUniforms() {
    // skip clustered lights shader evaluation if only the dummy light exists
    this._clusterSkipId.setValue(this._usedLights.length > 1 ? 0 : 1);
    this.lightsBuffer.updateUniforms();

    // texture
    this._clusterWorldTextureId.setValue(this.clusterTexture);

    // uniform values
    this._clusterMaxCellsId.setValue(this.maxCellLightCount);
    const boundsDelta = this.boundsDelta;
    this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / boundsDelta.x;
    this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / boundsDelta.y;
    this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / boundsDelta.z;
    this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);
    this._clusterBoundsMinData[0] = this.boundsMin.x;
    this._clusterBoundsMinData[1] = this.boundsMin.y;
    this._clusterBoundsMinData[2] = this.boundsMin.z;
    this._clusterBoundsDeltaData[0] = boundsDelta.x;
    this._clusterBoundsDeltaData[1] = boundsDelta.y;
    this._clusterBoundsDeltaData[2] = boundsDelta.z;
    this._clusterCompressionLimit0Data[0] = this._maxAttenuation;
    this._clusterCompressionLimit0Data[1] = this._maxColorValue;

    // assign values
    this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
    this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
    this._clusterBoundsDeltaId.setValue(this._clusterBoundsDeltaData);
    this._clusterCellsDotId.setValue(this._clusterCellsDotData);
    this._clusterCellsMaxId.setValue(this._clusterCellsMaxData);
    this._clusterCompressionLimit0Id.setValue(this._clusterCompressionLimit0Data);
  }

  // evaluates min and max coordinates of AABB of the light in the cell space
  evalLightCellMinMax(clusteredLight, min, max) {
    // min point of AABB in cell space
    min.copy(clusteredLight.min);
    min.sub(this.boundsMin);
    min.div(this.boundsDelta);
    min.mul2(min, this.cells);
    min.floor();

    // max point of AABB in cell space
    max.copy(clusteredLight.max);
    max.sub(this.boundsMin);
    max.div(this.boundsDelta);
    max.mul2(max, this.cells);
    max.ceil();

    // clamp to limits
    min.max(Vec3.ZERO);
    max.min(this._cellsLimit);
  }
  collectLights(lights) {
    const maxLights = this.lightsBuffer.maxLights;

    // skip index 0 as that is used for unused light
    const usedLights = this._usedLights;
    let lightIndex = 1;
    lights.forEach(light => {
      const runtimeLight = !!(light.mask & (MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED));
      const zeroAngleSpotlight = light.type === LIGHTTYPE_SPOT && light._outerConeAngle === 0;
      if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0 && runtimeLight && !zeroAngleSpotlight) {
        // within light limit
        if (lightIndex < maxLights) {
          // reuse allocated spot
          let clusteredLight;
          if (lightIndex < usedLights.length) {
            clusteredLight = usedLights[lightIndex];
          } else {
            // allocate new spot
            clusteredLight = new ClusterLight();
            usedLights.push(clusteredLight);
          }

          // store light properties
          clusteredLight.light = light;
          light.getBoundingBox(tempBox);
          clusteredLight.min.copy(tempBox.getMin());
          clusteredLight.max.copy(tempBox.getMax());
          lightIndex++;
        } else {
          Debug.warnOnce(`Clustered lighting: more than ${maxLights - 1} lights in the frame, ignoring some.`);
        }
      }
    });
    usedLights.length = lightIndex;
  }

  // evaluate the area all lights cover
  evaluateBounds() {
    const usedLights = this._usedLights;

    // bounds of the area the lights cover
    const min = this.boundsMin;
    const max = this.boundsMax;

    // if at least one light (index 0 is null, so ignore that one)
    if (usedLights.length > 1) {
      // AABB of the first light
      min.copy(usedLights[1].min);
      max.copy(usedLights[1].max);
      for (let i = 2; i < usedLights.length; i++) {
        // expand by AABB of this light
        min.min(usedLights[i].min);
        max.max(usedLights[i].max);
      }
    } else {
      // any small volume if no lights
      min.set(0, 0, 0);
      max.set(1, 1, 1);
    }

    // bounds range
    this.boundsDelta.sub2(max, min);
    this.lightsBuffer.setBounds(min, this.boundsDelta);
  }

  // evaluate ranges of variables compressed to 8bit texture to allow their scaling to 0..1 range
  evaluateCompressionLimits(gammaCorrection) {
    let maxAttenuation = 0;
    let maxColorValue = 0;
    const usedLights = this._usedLights;
    for (let i = 1; i < usedLights.length; i++) {
      const light = usedLights[i].light;
      maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);
      const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
      maxColorValue = Math.max(color[0], maxColorValue);
      maxColorValue = Math.max(color[1], maxColorValue);
      maxColorValue = Math.max(color[2], maxColorValue);
    }

    // increase slightly as compression needs value < 1
    this._maxAttenuation = maxAttenuation + epsilon;
    this._maxColorValue = maxColorValue + epsilon;
    this.lightsBuffer.setCompressionRanges(this._maxAttenuation, this._maxColorValue);
  }
  updateClusters(gammaCorrection) {
    // clear clusters
    this.counts.fill(0);
    this.clusters.fill(0);

    // local accessors
    const divX = this._cells.x;
    const divZ = this._cells.z;
    const counts = this.counts;
    const limit = this._maxCellLightCount;
    const clusters = this.clusters;
    const pixelsPerCellCount = this.maxCellLightCount;
    let tooManyLights = false;

    // started from index 1, zero is "no-light" index
    const usedLights = this._usedLights;
    for (let i = 1; i < usedLights.length; i++) {
      const clusteredLight = usedLights[i];
      const light = clusteredLight.light;

      // add light data into textures
      this.lightsBuffer.addLightData(light, i, gammaCorrection);

      // light's bounds in cell space
      this.evalLightCellMinMax(clusteredLight, tempMin3, tempMax3);
      const xStart = tempMin3.x;
      const xEnd = tempMax3.x;
      const yStart = tempMin3.y;
      const yEnd = tempMax3.y;
      const zStart = tempMin3.z;
      const zEnd = tempMax3.z;

      // add the light to the cells
      for (let x = xStart; x <= xEnd; x++) {
        for (let z = zStart; z <= zEnd; z++) {
          for (let y = yStart; y <= yEnd; y++) {
            const clusterIndex = x + divX * (z + y * divZ);
            const count = counts[clusterIndex];
            if (count < limit) {
              clusters[pixelsPerCellCount * clusterIndex + count] = i;
              counts[clusterIndex] = count + 1;
            } else {
              tooManyLights = true;
            }
          }
        }
      }
    }
    if (tooManyLights) {
      const reportLimit = 5;
      if (this.reportCount < reportLimit) {
        console.warn('Too many lights in light cluster ' + this.name + ', please adjust parameters.' + (this.reportCount === reportLimit - 1 ? ' Giving up on reporting it.' : ''));
        this.reportCount++;
      }
    }
  }

  // internal update of the cluster data, executes once per frame
  update(lights, gammaCorrection, lightingParams) {
    this.updateParams(lightingParams);
    this.updateCells();
    this.collectLights(lights);
    this.evaluateBounds();
    this.evaluateCompressionLimits(gammaCorrection);
    this.updateClusters(gammaCorrection);
    this.uploadTextures();
  }

  // called on already updated clusters, activates for rendering by setting up uniforms / textures on the device
  activate() {
    this.updateUniforms();
  }
}

export { WorldClusters };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ybGQtY2x1c3RlcnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfTDggfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfU1BPVCwgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRzQnVmZmVyIH0gZnJvbSAnLi9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmNvbnN0IHRlbXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNaW4zID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNYXgzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBCb3ggPSBuZXcgQm91bmRpbmdCb3goKTtcblxuY29uc3QgZXBzaWxvbiA9IDAuMDAwMDAxO1xuY29uc3QgbWF4VGV4dHVyZVNpemUgPSA0MDk2OyAgICAvLyBtYXhpbXVtIHRleHR1cmUgc2l6ZSBhbGxvd2VkIHRvIHdvcmsgb24gYWxsIGRldmljZXNcblxuLy8gaGVscGVyIGNsYXNzIHRvIHN0b3JlIHByb3BlcnRpZXMgb2YgYSBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJpbmdcbmNsYXNzIENsdXN0ZXJMaWdodCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIHRoZSBsaWdodCBpdHNlbGZcbiAgICAgICAgdGhpcy5saWdodCA9IG51bGw7XG5cbiAgICAgICAgLy8gYm91bmRpbmcgYm94XG4gICAgICAgIHRoaXMubWluID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5tYXggPSBuZXcgVmVjMygpO1xuICAgIH1cbn1cblxuLy8gTWFpbiBjbGFzcyBpbXBsZW1lbnRpbmcgY2x1c3RlcmVkIGxpZ2h0aW5nLiBJbnRlcm5hbGx5IGl0IG9yZ2FuaXplcyB0aGUgb21uaSAvIHNwb3QgbGlnaHRzIHBsYWNlbWVudCBpbiB3b3JsZCBzcGFjZSAzZCBjZWxsIHN0cnVjdHVyZSxcbi8vIGFuZCBhbHNvIHVzZXMgTGlnaHRzQnVmZmVyIGNsYXNzIHRvIHN0b3JlIGxpZ2h0IHByb3BlcnRpZXMgaW4gdGV4dHVyZXNcbmNsYXNzIFdvcmxkQ2x1c3RlcnMge1xuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gKi9cbiAgICBjbHVzdGVyVGV4dHVyZTtcblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ1VudGl0bGVkJztcblxuICAgICAgICAvLyBudW1iZXIgb2YgdGltZXMgYSB3YXJuaW5nIHdhcyByZXBvcnRlZFxuICAgICAgICB0aGlzLnJlcG9ydENvdW50ID0gMDtcblxuICAgICAgICAvLyBib3VuZHMgb2YgYWxsIGxpZ2h0IHZvbHVtZXMgKHZvbHVtZSBjb3ZlcmVkIGJ5IHRoZSBjbHVzdGVycylcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLmJvdW5kc01heCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8vIG51bWJlciBvZiBjZWxscyBhbG9uZyAzIGF4ZXNcbiAgICAgICAgdGhpcy5fY2VsbHMgPSBuZXcgVmVjMygxLCAxLCAxKTsgICAgICAgLy8gbnVtYmVyIG9mIGNlbGxzXG4gICAgICAgIHRoaXMuX2NlbGxzTGltaXQgPSBuZXcgVmVjMygpOyAgLy8gbnVtYmVyIG9mIGNlbGxzIG1pbnVzIG9uZVxuICAgICAgICB0aGlzLmNlbGxzID0gdGhpcy5fY2VsbHM7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGxpZ2h0cyBlYWNoIGNlbGwgY2FuIHN0b3JlXG4gICAgICAgIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQgPSA0O1xuXG4gICAgICAgIC8vIGxpbWl0cyBvbiBzb21lIGxpZ2h0IHByb3BlcnRpZXMsIHVzZWQgZm9yIGNvbXByZXNzaW9uIHRvIDhiaXQgdGV4dHVyZVxuICAgICAgICB0aGlzLl9tYXhBdHRlbnVhdGlvbiA9IDA7XG4gICAgICAgIHRoaXMuX21heENvbG9yVmFsdWUgPSAwO1xuXG4gICAgICAgIC8vIGludGVybmFsIGxpc3Qgb2YgbGlnaHRzIChvZiB0eXBlIENsdXN0ZXJMaWdodClcbiAgICAgICAgdGhpcy5fdXNlZExpZ2h0cyA9IFtdO1xuXG4gICAgICAgIC8vIGxpZ2h0IDAgaXMgYWx3YXlzIHJlc2VydmVkIGZvciAnbm8gbGlnaHQnIGluZGV4XG4gICAgICAgIHRoaXMuX3VzZWRMaWdodHMucHVzaChuZXcgQ2x1c3RlckxpZ2h0KCkpO1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmVzIHRvIHN0b3JlIGxpZ2h0c1xuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlciA9IG5ldyBMaWdodHNCdWZmZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyByZWdpc3RlciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5yZWdpc3RlclVuaWZvcm1zKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0IG1heENlbGxMaWdodENvdW50KGNvdW50KSB7XG5cbiAgICAgICAgaWYgKGNvdW50ICE9PSB0aGlzLl9tYXhDZWxsTGlnaHRDb3VudCkge1xuICAgICAgICAgICAgdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQgPSBjb3VudDtcbiAgICAgICAgICAgIHRoaXMuX2NlbGxzRGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heENlbGxMaWdodENvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgfVxuXG4gICAgc2V0IGNlbGxzKHZhbHVlKSB7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgd2hvbGUgbnVtYmVyc1xuICAgICAgICB0ZW1wVmVjMy5jb3B5KHZhbHVlKS5mbG9vcigpO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2VsbHMuZXF1YWxzKHRlbXBWZWMzKSkge1xuICAgICAgICAgICAgdGhpcy5fY2VsbHMuY29weSh0ZW1wVmVjMyk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0xpbWl0LmNvcHkodGVtcFZlYzMpLnN1YihWZWMzLk9ORSk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjZWxscygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NlbGxzO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCk7XG4gICAgfVxuXG4gICAgcmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCkge1xuICAgICAgICBpZiAodGhpcy5jbHVzdGVyVGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2lzdGVyVW5pZm9ybXMoZGV2aWNlKSB7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlclNraXBJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyU2tpcCcpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJNYXhDZWxsc0lkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJNYXhDZWxscycpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJXb3JsZFRleHR1cmVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyV29ybGRUZXh0dXJlJyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlclRleHR1cmVTaXplSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3RlclRleHR1cmVTaXplJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5JZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQm91bmRzTWluJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQm91bmRzRGVsdGEnKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZScpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDZWxsc0RvdCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNEb3REYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICAvLyBudW1iZXIgb2YgY2VsbHMgaW4gZWFjaCBkaXJlY3Rpb24gKHZlYzMpXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDZWxsc01heCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICAvLyBjb21wcmVzc2lvbiBsaW1pdCAwXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIGl0c2VsZiBiYXNlZCBvbiBwYXJhbWV0ZXJzIHN0b3JlZCBpbiB0aGUgc2NlbmVcbiAgICB1cGRhdGVQYXJhbXMobGlnaHRpbmdQYXJhbXMpIHtcbiAgICAgICAgaWYgKGxpZ2h0aW5nUGFyYW1zKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxzID0gbGlnaHRpbmdQYXJhbXMuY2VsbHM7XG4gICAgICAgICAgICB0aGlzLm1heENlbGxMaWdodENvdW50ID0gbGlnaHRpbmdQYXJhbXMubWF4TGlnaHRzUGVyQ2VsbDtcblxuICAgICAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuY29va2llc0VuYWJsZWQgPSBsaWdodGluZ1BhcmFtcy5jb29raWVzRW5hYmxlZDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLnNoYWRvd3NFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLmFyZWFMaWdodHNFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDZWxscygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NlbGxzRGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NlbGxzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgY3ggPSB0aGlzLl9jZWxscy54O1xuICAgICAgICAgICAgY29uc3QgY3kgPSB0aGlzLl9jZWxscy55O1xuICAgICAgICAgICAgY29uc3QgY3ogPSB0aGlzLl9jZWxscy56O1xuXG4gICAgICAgICAgICAvLyBzdG9yaW5nIDEgbGlnaHQgcGVyIHBpeGVsXG4gICAgICAgICAgICBjb25zdCBudW1DZWxscyA9IGN4ICogY3kgKiBjejtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsUGl4ZWxzID0gdGhpcy5tYXhDZWxsTGlnaHRDb3VudCAqIG51bUNlbGxzO1xuXG4gICAgICAgICAgICAvLyBjbHVzdGVyIHRleHR1cmUgc2l6ZSAtIHJvdWdobHkgc3F1YXJlIHRoYXQgZml0cyBhbGwgY2VsbHMuIFRoZSB3aWR0aCBpcyBtdWx0aXBseSBvZiBudW1QaXhlbHMgdG8gc2ltcGxpZnkgc2hhZGVyIG1hdGhcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IE1hdGguY2VpbChNYXRoLnNxcnQodG90YWxQaXhlbHMpKTtcbiAgICAgICAgICAgIHdpZHRoID0gbWF0aC5yb3VuZFVwKHdpZHRoLCB0aGlzLm1heENlbGxMaWdodENvdW50KTtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGguY2VpbCh0b3RhbFBpeGVscyAvIHdpZHRoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHRleHR1cmUgaXMgYWxsb3dlZCBzaXplXG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQod2lkdGggPD0gbWF4VGV4dHVyZVNpemUgJiYgaGVpZ2h0IDw9IG1heFRleHR1cmVTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICdDbHVzdGVyZWQgbGlnaHRzIHBhcmFtZXRlcnMgY2F1c2UgdGhlIHRleHR1cmUgc2l6ZSB0byBiZSBvdmVyIHRoZSBsaW1pdCwgcGxlYXNlIGFkanVzdCB0aGVtLicpO1xuXG4gICAgICAgICAgICAvLyBtYXhpbXVtIHJhbmdlIG9mIGNlbGxzXG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzBdID0gY3g7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzFdID0gY3k7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzJdID0gY3o7XG5cbiAgICAgICAgICAgIC8vIHZlY3RvciB0byBhbGxvdyBzaW5nbGUgZG90IHByb2R1Y3QgdG8gY29udmVydCBmcm9tIHdvcmxkIGNvb3JkaW5hdGVzIHRvIGNsdXN0ZXIgaW5kZXhcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdERhdGFbMF0gPSB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YVsxXSA9IGN4ICogY3ogKiB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YVsyXSA9IGN4ICogdGhpcy5tYXhDZWxsTGlnaHRDb3VudDtcblxuICAgICAgICAgICAgLy8gY2x1c3RlciBkYXRhIGFuZCBudW1iZXIgb2YgbGlnaHRzIHBlciBjZWxsXG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJzID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KHRvdGFsUGl4ZWxzKTtcbiAgICAgICAgICAgIHRoaXMuY291bnRzID0gbmV3IEludDMyQXJyYXkobnVtQ2VsbHMpO1xuXG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzBdID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzFdID0gMS4wIC8gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzJdID0gMS4wIC8gaGVpZ2h0O1xuXG4gICAgICAgICAgICB0aGlzLnJlbGVhc2VDbHVzdGVyVGV4dHVyZSgpO1xuICAgICAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZSA9IHRoaXMubGlnaHRzQnVmZmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHdpZHRoLCBoZWlnaHQsIFBJWEVMRk9STUFUX0w4LCAnQ2x1c3RlclRleHR1cmUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwbG9hZFRleHR1cmVzKCkge1xuXG4gICAgICAgIHRoaXMuY2x1c3RlclRleHR1cmUubG9jaygpLnNldCh0aGlzLmNsdXN0ZXJzKTtcbiAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZS51bmxvY2soKTtcblxuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci51cGxvYWRUZXh0dXJlcygpO1xuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKCkge1xuXG4gICAgICAgIC8vIHNraXAgY2x1c3RlcmVkIGxpZ2h0cyBzaGFkZXIgZXZhbHVhdGlvbiBpZiBvbmx5IHRoZSBkdW1teSBsaWdodCBleGlzdHNcbiAgICAgICAgdGhpcy5fY2x1c3RlclNraXBJZC5zZXRWYWx1ZSh0aGlzLl91c2VkTGlnaHRzLmxlbmd0aCA+IDEgPyAwIDogMSk7XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIudXBkYXRlVW5pZm9ybXMoKTtcblxuICAgICAgICAvLyB0ZXh0dXJlXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJXb3JsZFRleHR1cmVJZC5zZXRWYWx1ZSh0aGlzLmNsdXN0ZXJUZXh0dXJlKTtcblxuICAgICAgICAvLyB1bmlmb3JtIHZhbHVlc1xuICAgICAgICB0aGlzLl9jbHVzdGVyTWF4Q2VsbHNJZC5zZXRWYWx1ZSh0aGlzLm1heENlbGxMaWdodENvdW50KTtcblxuICAgICAgICBjb25zdCBib3VuZHNEZWx0YSA9IHRoaXMuYm91bmRzRGVsdGE7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YVswXSA9IHRoaXMuX2NlbGxzLnggLyBib3VuZHNEZWx0YS54O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGFbMV0gPSB0aGlzLl9jZWxscy55IC8gYm91bmRzRGVsdGEueTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVEYXRhWzJdID0gdGhpcy5fY2VsbHMueiAvIGJvdW5kc0RlbHRhLno7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVEYXRhKTtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzTWluRGF0YVswXSA9IHRoaXMuYm91bmRzTWluLng7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhWzFdID0gdGhpcy5ib3VuZHNNaW4ueTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbkRhdGFbMl0gPSB0aGlzLmJvdW5kc01pbi56O1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNEZWx0YURhdGFbMF0gPSBib3VuZHNEZWx0YS54O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhWzFdID0gYm91bmRzRGVsdGEueTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YVsyXSA9IGJvdW5kc0RlbHRhLno7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YVswXSA9IHRoaXMuX21heEF0dGVudWF0aW9uO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBEYXRhWzFdID0gdGhpcy5fbWF4Q29sb3JWYWx1ZTtcblxuICAgICAgICAvLyBhc3NpZ24gdmFsdWVzXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZUlkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGEpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzTWluSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckJvdW5kc01pbkRhdGEpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90SWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YSk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heElkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJDZWxsc01heERhdGEpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBEYXRhKTtcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZXMgbWluIGFuZCBtYXggY29vcmRpbmF0ZXMgb2YgQUFCQiBvZiB0aGUgbGlnaHQgaW4gdGhlIGNlbGwgc3BhY2VcbiAgICBldmFsTGlnaHRDZWxsTWluTWF4KGNsdXN0ZXJlZExpZ2h0LCBtaW4sIG1heCkge1xuXG4gICAgICAgIC8vIG1pbiBwb2ludCBvZiBBQUJCIGluIGNlbGwgc3BhY2VcbiAgICAgICAgbWluLmNvcHkoY2x1c3RlcmVkTGlnaHQubWluKTtcbiAgICAgICAgbWluLnN1Yih0aGlzLmJvdW5kc01pbik7XG4gICAgICAgIG1pbi5kaXYodGhpcy5ib3VuZHNEZWx0YSk7XG4gICAgICAgIG1pbi5tdWwyKG1pbiwgdGhpcy5jZWxscyk7XG4gICAgICAgIG1pbi5mbG9vcigpO1xuXG4gICAgICAgIC8vIG1heCBwb2ludCBvZiBBQUJCIGluIGNlbGwgc3BhY2VcbiAgICAgICAgbWF4LmNvcHkoY2x1c3RlcmVkTGlnaHQubWF4KTtcbiAgICAgICAgbWF4LnN1Yih0aGlzLmJvdW5kc01pbik7XG4gICAgICAgIG1heC5kaXYodGhpcy5ib3VuZHNEZWx0YSk7XG4gICAgICAgIG1heC5tdWwyKG1heCwgdGhpcy5jZWxscyk7XG4gICAgICAgIG1heC5jZWlsKCk7XG5cbiAgICAgICAgLy8gY2xhbXAgdG8gbGltaXRzXG4gICAgICAgIG1pbi5tYXgoVmVjMy5aRVJPKTtcbiAgICAgICAgbWF4Lm1pbih0aGlzLl9jZWxsc0xpbWl0KTtcbiAgICB9XG5cbiAgICBjb2xsZWN0TGlnaHRzKGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IG1heExpZ2h0cyA9IHRoaXMubGlnaHRzQnVmZmVyLm1heExpZ2h0cztcblxuICAgICAgICAvLyBza2lwIGluZGV4IDAgYXMgdGhhdCBpcyB1c2VkIGZvciB1bnVzZWQgbGlnaHRcbiAgICAgICAgY29uc3QgdXNlZExpZ2h0cyA9IHRoaXMuX3VzZWRMaWdodHM7XG4gICAgICAgIGxldCBsaWdodEluZGV4ID0gMTtcblxuICAgICAgICBsaWdodHMuZm9yRWFjaCgobGlnaHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJ1bnRpbWVMaWdodCA9ICEhKGxpZ2h0Lm1hc2sgJiAoTUFTS19BRkZFQ1RfRFlOQU1JQyB8IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSk7XG4gICAgICAgICAgICBjb25zdCB6ZXJvQW5nbGVTcG90bGlnaHQgPSBsaWdodC50eXBlID09PSBMSUdIVFRZUEVfU1BPVCAmJiBsaWdodC5fb3V0ZXJDb25lQW5nbGUgPT09IDA7XG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCAmJiBsaWdodC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSAmJiBsaWdodC5pbnRlbnNpdHkgPiAwICYmIHJ1bnRpbWVMaWdodCAmJiAhemVyb0FuZ2xlU3BvdGxpZ2h0KSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3aXRoaW4gbGlnaHQgbGltaXRcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRJbmRleCA8IG1heExpZ2h0cykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJldXNlIGFsbG9jYXRlZCBzcG90XG4gICAgICAgICAgICAgICAgICAgIGxldCBjbHVzdGVyZWRMaWdodDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0SW5kZXggPCB1c2VkTGlnaHRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcmVkTGlnaHQgPSB1c2VkTGlnaHRzW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsb2NhdGUgbmV3IHNwb3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0ID0gbmV3IENsdXN0ZXJMaWdodCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXNlZExpZ2h0cy5wdXNoKGNsdXN0ZXJlZExpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHN0b3JlIGxpZ2h0IHByb3BlcnRpZXNcbiAgICAgICAgICAgICAgICAgICAgY2x1c3RlcmVkTGlnaHQubGlnaHQgPSBsaWdodDtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdCb3godGVtcEJveCk7XG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0Lm1pbi5jb3B5KHRlbXBCb3guZ2V0TWluKCkpO1xuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodC5tYXguY29weSh0ZW1wQm94LmdldE1heCgpKTtcblxuICAgICAgICAgICAgICAgICAgICBsaWdodEluZGV4Kys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYENsdXN0ZXJlZCBsaWdodGluZzogbW9yZSB0aGFuICR7bWF4TGlnaHRzIC0gMX0gbGlnaHRzIGluIHRoZSBmcmFtZSwgaWdub3Jpbmcgc29tZS5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHVzZWRMaWdodHMubGVuZ3RoID0gbGlnaHRJbmRleDtcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZSB0aGUgYXJlYSBhbGwgbGlnaHRzIGNvdmVyXG4gICAgZXZhbHVhdGVCb3VuZHMoKSB7XG5cbiAgICAgICAgY29uc3QgdXNlZExpZ2h0cyA9IHRoaXMuX3VzZWRMaWdodHM7XG5cbiAgICAgICAgLy8gYm91bmRzIG9mIHRoZSBhcmVhIHRoZSBsaWdodHMgY292ZXJcbiAgICAgICAgY29uc3QgbWluID0gdGhpcy5ib3VuZHNNaW47XG4gICAgICAgIGNvbnN0IG1heCA9IHRoaXMuYm91bmRzTWF4O1xuXG4gICAgICAgIC8vIGlmIGF0IGxlYXN0IG9uZSBsaWdodCAoaW5kZXggMCBpcyBudWxsLCBzbyBpZ25vcmUgdGhhdCBvbmUpXG4gICAgICAgIGlmICh1c2VkTGlnaHRzLmxlbmd0aCA+IDEpIHtcblxuICAgICAgICAgICAgLy8gQUFCQiBvZiB0aGUgZmlyc3QgbGlnaHRcbiAgICAgICAgICAgIG1pbi5jb3B5KHVzZWRMaWdodHNbMV0ubWluKTtcbiAgICAgICAgICAgIG1heC5jb3B5KHVzZWRMaWdodHNbMV0ubWF4KTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDI7IGkgPCB1c2VkTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBleHBhbmQgYnkgQUFCQiBvZiB0aGlzIGxpZ2h0XG4gICAgICAgICAgICAgICAgbWluLm1pbih1c2VkTGlnaHRzW2ldLm1pbik7XG4gICAgICAgICAgICAgICAgbWF4Lm1heCh1c2VkTGlnaHRzW2ldLm1heCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGFueSBzbWFsbCB2b2x1bWUgaWYgbm8gbGlnaHRzXG4gICAgICAgICAgICBtaW4uc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgbWF4LnNldCgxLCAxLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJvdW5kcyByYW5nZVxuICAgICAgICB0aGlzLmJvdW5kc0RlbHRhLnN1YjIobWF4LCBtaW4pO1xuXG4gICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLnNldEJvdW5kcyhtaW4sIHRoaXMuYm91bmRzRGVsdGEpO1xuICAgIH1cblxuICAgIC8vIGV2YWx1YXRlIHJhbmdlcyBvZiB2YXJpYWJsZXMgY29tcHJlc3NlZCB0byA4Yml0IHRleHR1cmUgdG8gYWxsb3cgdGhlaXIgc2NhbGluZyB0byAwLi4xIHJhbmdlXG4gICAgZXZhbHVhdGVDb21wcmVzc2lvbkxpbWl0cyhnYW1tYUNvcnJlY3Rpb24pIHtcblxuICAgICAgICBsZXQgbWF4QXR0ZW51YXRpb24gPSAwO1xuICAgICAgICBsZXQgbWF4Q29sb3JWYWx1ZSA9IDA7XG5cbiAgICAgICAgY29uc3QgdXNlZExpZ2h0cyA9IHRoaXMuX3VzZWRMaWdodHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdXNlZExpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSB1c2VkTGlnaHRzW2ldLmxpZ2h0O1xuICAgICAgICAgICAgbWF4QXR0ZW51YXRpb24gPSBNYXRoLm1heChsaWdodC5hdHRlbnVhdGlvbkVuZCwgbWF4QXR0ZW51YXRpb24pO1xuXG4gICAgICAgICAgICBjb25zdCBjb2xvciA9IGdhbW1hQ29ycmVjdGlvbiA/IGxpZ2h0Ll9saW5lYXJGaW5hbENvbG9yIDogbGlnaHQuX2ZpbmFsQ29sb3I7XG4gICAgICAgICAgICBtYXhDb2xvclZhbHVlID0gTWF0aC5tYXgoY29sb3JbMF0sIG1heENvbG9yVmFsdWUpO1xuICAgICAgICAgICAgbWF4Q29sb3JWYWx1ZSA9IE1hdGgubWF4KGNvbG9yWzFdLCBtYXhDb2xvclZhbHVlKTtcbiAgICAgICAgICAgIG1heENvbG9yVmFsdWUgPSBNYXRoLm1heChjb2xvclsyXSwgbWF4Q29sb3JWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbmNyZWFzZSBzbGlnaHRseSBhcyBjb21wcmVzc2lvbiBuZWVkcyB2YWx1ZSA8IDFcbiAgICAgICAgdGhpcy5fbWF4QXR0ZW51YXRpb24gPSBtYXhBdHRlbnVhdGlvbiArIGVwc2lsb247XG4gICAgICAgIHRoaXMuX21heENvbG9yVmFsdWUgPSBtYXhDb2xvclZhbHVlICsgZXBzaWxvbjtcblxuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5zZXRDb21wcmVzc2lvblJhbmdlcyh0aGlzLl9tYXhBdHRlbnVhdGlvbiwgdGhpcy5fbWF4Q29sb3JWYWx1ZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ2x1c3RlcnMoZ2FtbWFDb3JyZWN0aW9uKSB7XG5cbiAgICAgICAgLy8gY2xlYXIgY2x1c3RlcnNcbiAgICAgICAgdGhpcy5jb3VudHMuZmlsbCgwKTtcbiAgICAgICAgdGhpcy5jbHVzdGVycy5maWxsKDApO1xuXG4gICAgICAgIC8vIGxvY2FsIGFjY2Vzc29yc1xuICAgICAgICBjb25zdCBkaXZYID0gdGhpcy5fY2VsbHMueDtcbiAgICAgICAgY29uc3QgZGl2WiA9IHRoaXMuX2NlbGxzLno7XG4gICAgICAgIGNvbnN0IGNvdW50cyA9IHRoaXMuY291bnRzO1xuICAgICAgICBjb25zdCBsaW1pdCA9IHRoaXMuX21heENlbGxMaWdodENvdW50O1xuICAgICAgICBjb25zdCBjbHVzdGVycyA9IHRoaXMuY2x1c3RlcnM7XG4gICAgICAgIGNvbnN0IHBpeGVsc1BlckNlbGxDb3VudCA9IHRoaXMubWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgICAgIGxldCB0b29NYW55TGlnaHRzID0gZmFsc2U7XG5cbiAgICAgICAgLy8gc3RhcnRlZCBmcm9tIGluZGV4IDEsIHplcm8gaXMgXCJuby1saWdodFwiIGluZGV4XG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHVzZWRMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0ID0gdXNlZExpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY2x1c3RlcmVkTGlnaHQubGlnaHQ7XG5cbiAgICAgICAgICAgIC8vIGFkZCBsaWdodCBkYXRhIGludG8gdGV4dHVyZXNcbiAgICAgICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLmFkZExpZ2h0RGF0YShsaWdodCwgaSwgZ2FtbWFDb3JyZWN0aW9uKTtcblxuICAgICAgICAgICAgLy8gbGlnaHQncyBib3VuZHMgaW4gY2VsbCBzcGFjZVxuICAgICAgICAgICAgdGhpcy5ldmFsTGlnaHRDZWxsTWluTWF4KGNsdXN0ZXJlZExpZ2h0LCB0ZW1wTWluMywgdGVtcE1heDMpO1xuXG4gICAgICAgICAgICBjb25zdCB4U3RhcnQgPSB0ZW1wTWluMy54O1xuICAgICAgICAgICAgY29uc3QgeEVuZCA9IHRlbXBNYXgzLng7XG4gICAgICAgICAgICBjb25zdCB5U3RhcnQgPSB0ZW1wTWluMy55O1xuICAgICAgICAgICAgY29uc3QgeUVuZCA9IHRlbXBNYXgzLnk7XG4gICAgICAgICAgICBjb25zdCB6U3RhcnQgPSB0ZW1wTWluMy56O1xuICAgICAgICAgICAgY29uc3QgekVuZCA9IHRlbXBNYXgzLno7XG5cbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbGlnaHQgdG8gdGhlIGNlbGxzXG4gICAgICAgICAgICBmb3IgKGxldCB4ID0geFN0YXJ0OyB4IDw9IHhFbmQ7IHgrKykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHogPSB6U3RhcnQ7IHogPD0gekVuZDsgeisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHkgPSB5U3RhcnQ7IHkgPD0geUVuZDsgeSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJJbmRleCA9IHggKyBkaXZYICogKHogKyB5ICogZGl2Wik7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb3VudCA9IGNvdW50c1tjbHVzdGVySW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50IDwgbGltaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyc1twaXhlbHNQZXJDZWxsQ291bnQgKiBjbHVzdGVySW5kZXggKyBjb3VudF0gPSBpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50c1tjbHVzdGVySW5kZXhdID0gY291bnQgKyAxO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvb01hbnlMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodG9vTWFueUxpZ2h0cykge1xuICAgICAgICAgICAgY29uc3QgcmVwb3J0TGltaXQgPSA1O1xuICAgICAgICAgICAgaWYgKHRoaXMucmVwb3J0Q291bnQgPCByZXBvcnRMaW1pdCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignVG9vIG1hbnkgbGlnaHRzIGluIGxpZ2h0IGNsdXN0ZXIgJyArIHRoaXMubmFtZSArICcsIHBsZWFzZSBhZGp1c3QgcGFyYW1ldGVycy4nICtcbiAgICAgICAgICAgICAgICAodGhpcy5yZXBvcnRDb3VudCA9PT0gcmVwb3J0TGltaXQgLSAxID8gJyBHaXZpbmcgdXAgb24gcmVwb3J0aW5nIGl0LicgOiAnJykpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVwb3J0Q291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyBpbnRlcm5hbCB1cGRhdGUgb2YgdGhlIGNsdXN0ZXIgZGF0YSwgZXhlY3V0ZXMgb25jZSBwZXIgZnJhbWVcbiAgICB1cGRhdGUobGlnaHRzLCBnYW1tYUNvcnJlY3Rpb24sIGxpZ2h0aW5nUGFyYW1zKSB7XG4gICAgICAgIHRoaXMudXBkYXRlUGFyYW1zKGxpZ2h0aW5nUGFyYW1zKTtcbiAgICAgICAgdGhpcy51cGRhdGVDZWxscygpO1xuICAgICAgICB0aGlzLmNvbGxlY3RMaWdodHMobGlnaHRzKTtcbiAgICAgICAgdGhpcy5ldmFsdWF0ZUJvdW5kcygpO1xuICAgICAgICB0aGlzLmV2YWx1YXRlQ29tcHJlc3Npb25MaW1pdHMoZ2FtbWFDb3JyZWN0aW9uKTtcbiAgICAgICAgdGhpcy51cGRhdGVDbHVzdGVycyhnYW1tYUNvcnJlY3Rpb24pO1xuICAgICAgICB0aGlzLnVwbG9hZFRleHR1cmVzKCk7XG4gICAgfVxuXG4gICAgLy8gY2FsbGVkIG9uIGFscmVhZHkgdXBkYXRlZCBjbHVzdGVycywgYWN0aXZhdGVzIGZvciByZW5kZXJpbmcgYnkgc2V0dGluZyB1cCB1bmlmb3JtcyAvIHRleHR1cmVzIG9uIHRoZSBkZXZpY2VcbiAgICBhY3RpdmF0ZSgpIHtcbiAgICAgICAgdGhpcy51cGRhdGVVbmlmb3JtcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV29ybGRDbHVzdGVycyB9O1xuIl0sIm5hbWVzIjpbInRlbXBWZWMzIiwiVmVjMyIsInRlbXBNaW4zIiwidGVtcE1heDMiLCJ0ZW1wQm94IiwiQm91bmRpbmdCb3giLCJlcHNpbG9uIiwibWF4VGV4dHVyZVNpemUiLCJDbHVzdGVyTGlnaHQiLCJjb25zdHJ1Y3RvciIsImxpZ2h0IiwibWluIiwibWF4IiwiV29ybGRDbHVzdGVycyIsImRldmljZSIsImNsdXN0ZXJUZXh0dXJlIiwibmFtZSIsInJlcG9ydENvdW50IiwiYm91bmRzTWluIiwiYm91bmRzTWF4IiwiYm91bmRzRGVsdGEiLCJfY2VsbHMiLCJfY2VsbHNMaW1pdCIsImNlbGxzIiwibWF4Q2VsbExpZ2h0Q291bnQiLCJfbWF4QXR0ZW51YXRpb24iLCJfbWF4Q29sb3JWYWx1ZSIsIl91c2VkTGlnaHRzIiwicHVzaCIsImxpZ2h0c0J1ZmZlciIsIkxpZ2h0c0J1ZmZlciIsInJlZ2lzdGVyVW5pZm9ybXMiLCJjb3VudCIsIl9tYXhDZWxsTGlnaHRDb3VudCIsIl9jZWxsc0RpcnR5IiwidmFsdWUiLCJjb3B5IiwiZmxvb3IiLCJlcXVhbHMiLCJzdWIiLCJPTkUiLCJkZXN0cm95IiwicmVsZWFzZUNsdXN0ZXJUZXh0dXJlIiwiX2NsdXN0ZXJTa2lwSWQiLCJzY29wZSIsInJlc29sdmUiLCJfY2x1c3Rlck1heENlbGxzSWQiLCJfY2x1c3RlcldvcmxkVGV4dHVyZUlkIiwiX2NsdXN0ZXJUZXh0dXJlU2l6ZUlkIiwiX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGEiLCJGbG9hdDMyQXJyYXkiLCJfY2x1c3RlckJvdW5kc01pbklkIiwiX2NsdXN0ZXJCb3VuZHNNaW5EYXRhIiwiX2NsdXN0ZXJCb3VuZHNEZWx0YUlkIiwiX2NsdXN0ZXJCb3VuZHNEZWx0YURhdGEiLCJfY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVJZCIsIl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGEiLCJfY2x1c3RlckNlbGxzRG90SWQiLCJfY2x1c3RlckNlbGxzRG90RGF0YSIsIl9jbHVzdGVyQ2VsbHNNYXhJZCIsIl9jbHVzdGVyQ2VsbHNNYXhEYXRhIiwiX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MElkIiwiX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MERhdGEiLCJ1cGRhdGVQYXJhbXMiLCJsaWdodGluZ1BhcmFtcyIsIm1heExpZ2h0c1BlckNlbGwiLCJjb29raWVzRW5hYmxlZCIsInNoYWRvd3NFbmFibGVkIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJ1cGRhdGVDZWxscyIsImN4IiwieCIsImN5IiwieSIsImN6IiwieiIsIm51bUNlbGxzIiwidG90YWxQaXhlbHMiLCJ3aWR0aCIsIk1hdGgiLCJjZWlsIiwic3FydCIsIm1hdGgiLCJyb3VuZFVwIiwiaGVpZ2h0IiwiRGVidWciLCJhc3NlcnQiLCJjbHVzdGVycyIsIlVpbnQ4Q2xhbXBlZEFycmF5IiwiY291bnRzIiwiSW50MzJBcnJheSIsImNyZWF0ZVRleHR1cmUiLCJQSVhFTEZPUk1BVF9MOCIsInVwbG9hZFRleHR1cmVzIiwibG9jayIsInNldCIsInVubG9jayIsInVwZGF0ZVVuaWZvcm1zIiwic2V0VmFsdWUiLCJsZW5ndGgiLCJldmFsTGlnaHRDZWxsTWluTWF4IiwiY2x1c3RlcmVkTGlnaHQiLCJkaXYiLCJtdWwyIiwiWkVSTyIsImNvbGxlY3RMaWdodHMiLCJsaWdodHMiLCJtYXhMaWdodHMiLCJ1c2VkTGlnaHRzIiwibGlnaHRJbmRleCIsImZvckVhY2giLCJydW50aW1lTGlnaHQiLCJtYXNrIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiemVyb0FuZ2xlU3BvdGxpZ2h0IiwidHlwZSIsIkxJR0hUVFlQRV9TUE9UIiwiX291dGVyQ29uZUFuZ2xlIiwiZW5hYmxlZCIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsInZpc2libGVUaGlzRnJhbWUiLCJpbnRlbnNpdHkiLCJnZXRCb3VuZGluZ0JveCIsImdldE1pbiIsImdldE1heCIsIndhcm5PbmNlIiwiZXZhbHVhdGVCb3VuZHMiLCJpIiwic3ViMiIsInNldEJvdW5kcyIsImV2YWx1YXRlQ29tcHJlc3Npb25MaW1pdHMiLCJnYW1tYUNvcnJlY3Rpb24iLCJtYXhBdHRlbnVhdGlvbiIsIm1heENvbG9yVmFsdWUiLCJhdHRlbnVhdGlvbkVuZCIsImNvbG9yIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsInNldENvbXByZXNzaW9uUmFuZ2VzIiwidXBkYXRlQ2x1c3RlcnMiLCJmaWxsIiwiZGl2WCIsImRpdloiLCJsaW1pdCIsInBpeGVsc1BlckNlbGxDb3VudCIsInRvb01hbnlMaWdodHMiLCJhZGRMaWdodERhdGEiLCJ4U3RhcnQiLCJ4RW5kIiwieVN0YXJ0IiwieUVuZCIsInpTdGFydCIsInpFbmQiLCJjbHVzdGVySW5kZXgiLCJyZXBvcnRMaW1pdCIsImNvbnNvbGUiLCJ3YXJuIiwidXBkYXRlIiwiYWN0aXZhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBUUEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzNCLE1BQU1DLFFBQVEsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNRSxRQUFRLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTUcsT0FBTyxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBRWpDLE1BQU1DLE9BQU8sR0FBRyxRQUFRLENBQUE7QUFDeEIsTUFBTUMsY0FBYyxHQUFHLElBQUksQ0FBQzs7QUFFNUI7QUFDQSxNQUFNQyxZQUFZLENBQUM7QUFDZkMsRUFBQUEsV0FBV0EsR0FBRztBQUNWO0lBQ0EsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSSxDQUFBOztBQUVqQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxHQUFHLEdBQUcsSUFBSVYsSUFBSSxFQUFFLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNXLEdBQUcsR0FBRyxJQUFJWCxJQUFJLEVBQUUsQ0FBQTtBQUN6QixHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0EsTUFBTVksYUFBYSxDQUFDO0VBSWhCSixXQUFXQSxDQUFDSyxNQUFNLEVBQUU7QUFIcEI7QUFBQSxJQUFBLElBQUEsQ0FDQUMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBR1YsSUFBSSxDQUFDRCxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNFLElBQUksR0FBRyxVQUFVLENBQUE7O0FBRXRCO0lBQ0EsSUFBSSxDQUFDQyxXQUFXLEdBQUcsQ0FBQyxDQUFBOztBQUVwQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSWpCLElBQUksRUFBRSxDQUFBO0FBQzNCLElBQUEsSUFB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
