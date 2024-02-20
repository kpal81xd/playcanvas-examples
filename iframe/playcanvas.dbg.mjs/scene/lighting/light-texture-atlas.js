import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { PIXELFORMAT_RGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { SHADOW_PCF3, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _tempArray2 = [];
const _viewport = new Vec4();
const _scissor = new Vec4();
class Slot {
  constructor(rect) {
    this.size = Math.floor(rect.w * 1024); // size normalized to 1024 atlas
    this.used = false;
    this.lightId = -1; // id of the light using the slot
    this.rect = rect;
  }
}

// A class handling runtime allocation of slots in a texture. It is used to allocate slots in the shadow and cookie atlas.
class LightTextureAtlas {
  constructor(device) {
    this.device = device;
    this.version = 1; // incremented each time slot configuration changes

    this.shadowAtlasResolution = 2048;
    this.shadowAtlas = null;

    // number of additional pixels to render past the required shadow camera angle (90deg for omni, outer for spot) of the shadow camera for clustered lights.
    // This needs to be a pixel more than a shadow filter needs to access.
    this.shadowEdgePixels = 3;
    this.cookieAtlasResolution = 4;
    this.cookieAtlas = new Texture(this.device, {
      name: 'CookieAtlas',
      width: this.cookieAtlasResolution,
      height: this.cookieAtlasResolution,
      format: PIXELFORMAT_RGBA8,
      cubemap: false,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    this.cookieRenderTarget = new RenderTarget({
      colorBuffer: this.cookieAtlas,
      depth: false,
      flipY: true
    });

    // available slots (of type Slot)
    this.slots = [];

    // current subdivision strategy - matches format of LightingParams.atlasSplit
    this.atlasSplit = [];

    // offsets to individual faces of a cubemap inside 3x3 grid in an atlas slot
    this.cubeSlotsOffsets = [new Vec2(0, 0), new Vec2(0, 1), new Vec2(1, 0), new Vec2(1, 1), new Vec2(2, 0), new Vec2(2, 1)];

    // handles gap between slots
    this.scissorVec = new Vec4();
    this.allocateShadowAtlas(1); // placeholder as shader requires it
    this.allocateCookieAtlas(1); // placeholder as shader requires it
    this.allocateUniforms();
  }
  destroy() {
    this.destroyShadowAtlas();
    this.destroyCookieAtlas();
  }
  destroyShadowAtlas() {
    var _this$shadowAtlas;
    (_this$shadowAtlas = this.shadowAtlas) == null || _this$shadowAtlas.destroy();
    this.shadowAtlas = null;
  }
  destroyCookieAtlas() {
    var _this$cookieAtlas, _this$cookieRenderTar;
    (_this$cookieAtlas = this.cookieAtlas) == null || _this$cookieAtlas.destroy();
    this.cookieAtlas = null;
    (_this$cookieRenderTar = this.cookieRenderTarget) == null || _this$cookieRenderTar.destroy();
    this.cookieRenderTarget = null;
  }
  allocateShadowAtlas(resolution) {
    if (!this.shadowAtlas || this.shadowAtlas.texture.width !== resolution) {
      // content of atlas is lost, force re-render of static shadows
      this.version++;
      this.destroyShadowAtlas();
      this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);

      // avoid it being destroyed by lights
      this.shadowAtlas.cached = true;

      // leave gap between individual tiles to avoid shadow / cookie sampling other tiles (enough for PCF5)
      // note that this only fades / removes shadows on the edges, which is still not correct - a shader clipping is needed?
      const scissorOffset = 4 / this.shadowAtlasResolution;
      this.scissorVec.set(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);
    }
  }
  allocateCookieAtlas(resolution) {
    // resize atlas
    if (this.cookieAtlas.width !== resolution) {
      this.cookieRenderTarget.resize(resolution, resolution);

      // content of atlas is lost, force re-render of static cookies
      this.version++;
    }
  }
  allocateUniforms() {
    this._shadowAtlasTextureId = this.device.scope.resolve('shadowAtlasTexture');
    this._shadowAtlasParamsId = this.device.scope.resolve('shadowAtlasParams');
    this._shadowAtlasParams = new Float32Array(2);
    this._cookieAtlasTextureId = this.device.scope.resolve('cookieAtlasTexture');
  }
  updateUniforms() {
    // shadow atlas texture
    const isShadowFilterPcf = true;
    const rt = this.shadowAtlas.renderTargets[0];
    const isDepthShadow = !this.device.isWebGL1 && isShadowFilterPcf;
    const shadowBuffer = isDepthShadow ? rt.depthBuffer : rt.colorBuffer;
    this._shadowAtlasTextureId.setValue(shadowBuffer);

    // shadow atlas params
    this._shadowAtlasParams[0] = this.shadowAtlasResolution;
    this._shadowAtlasParams[1] = this.shadowEdgePixels;
    this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);

    // cookie atlas textures
    this._cookieAtlasTextureId.setValue(this.cookieAtlas);
  }
  subdivide(numLights, lightingParams) {
    let atlasSplit = lightingParams.atlasSplit;

    // if no user specified subdivision
    if (!atlasSplit) {
      // split to equal number of squares
      const gridSize = Math.ceil(Math.sqrt(numLights));
      atlasSplit = _tempArray2;
      atlasSplit[0] = gridSize;
      atlasSplit.length = 1;
    }

    // compare two arrays
    const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

    // if the split has changed, regenerate slots
    if (!arraysEqual(atlasSplit, this.atlasSplit)) {
      this.version++;
      this.slots.length = 0;

      // store current settings
      this.atlasSplit.length = 0;
      this.atlasSplit.push(...atlasSplit);

      // generate top level split
      const splitCount = this.atlasSplit[0];
      if (splitCount > 1) {
        const invSize = 1 / splitCount;
        for (let i = 0; i < splitCount; i++) {
          for (let j = 0; j < splitCount; j++) {
            const rect = new Vec4(i * invSize, j * invSize, invSize, invSize);
            const nextLevelSplit = this.atlasSplit[1 + i * splitCount + j];

            // if need to split again
            if (nextLevelSplit > 1) {
              for (let x = 0; x < nextLevelSplit; x++) {
                for (let y = 0; y < nextLevelSplit; y++) {
                  const invSizeNext = invSize / nextLevelSplit;
                  const rectNext = new Vec4(rect.x + x * invSizeNext, rect.y + y * invSizeNext, invSizeNext, invSizeNext);
                  this.slots.push(new Slot(rectNext));
                }
              }
            } else {
              this.slots.push(new Slot(rect));
            }
          }
        }
      } else {
        // single slot
        this.slots.push(new Slot(new Vec4(0, 0, 1, 1)));
      }

      // sort slots descending
      this.slots.sort((a, b) => {
        return b.size - a.size;
      });
    }
  }
  collectLights(localLights, lightingParams) {
    const cookiesEnabled = lightingParams.cookiesEnabled;
    const shadowsEnabled = lightingParams.shadowsEnabled;

    // get all lights that need shadows or cookies, if those are enabled
    let needsShadowAtlas = false;
    let needsCookieAtlas = false;
    const lights = _tempArray;
    lights.length = 0;
    const processLights = list => {
      for (let i = 0; i < list.length; i++) {
        const light = list[i];
        if (light.visibleThisFrame) {
          const lightShadow = shadowsEnabled && light.castShadows;
          const lightCookie = cookiesEnabled && !!light.cookie;
          needsShadowAtlas || (needsShadowAtlas = lightShadow);
          needsCookieAtlas || (needsCookieAtlas = lightCookie);
          if (lightShadow || lightCookie) {
            lights.push(light);
          }
        }
      }
    };
    if (cookiesEnabled || shadowsEnabled) {
      processLights(localLights);
    }

    // sort lights by maxScreenSize - to have them ordered by atlas slot size
    lights.sort((a, b) => {
      return b.maxScreenSize - a.maxScreenSize;
    });
    if (needsShadowAtlas) {
      this.allocateShadowAtlas(this.shadowAtlasResolution);
    }
    if (needsCookieAtlas) {
      this.allocateCookieAtlas(this.cookieAtlasResolution);
    }
    if (needsShadowAtlas || needsCookieAtlas) {
      this.subdivide(lights.length, lightingParams);
    }
    return lights;
  }

  // configure light to use assigned slot
  setupSlot(light, rect) {
    light.atlasViewport.copy(rect);
    const faceCount = light.numShadowFaces;
    for (let face = 0; face < faceCount; face++) {
      // setup slot for shadow and cookie
      if (light.castShadows || light._cookie) {
        _viewport.copy(rect);
        _scissor.copy(rect);

        // for spot lights in the atlas, make viewport slightly smaller to avoid sampling past the edges
        if (light._type === LIGHTTYPE_SPOT) {
          _viewport.add(this.scissorVec);
        }

        // for cube map, allocate part of the slot
        if (light._type === LIGHTTYPE_OMNI) {
          const smallSize = _viewport.z / 3;
          const offset = this.cubeSlotsOffsets[face];
          _viewport.x += smallSize * offset.x;
          _viewport.y += smallSize * offset.y;
          _viewport.z = smallSize;
          _viewport.w = smallSize;
          _scissor.copy(_viewport);
        }
        if (light.castShadows) {
          const lightRenderData = light.getRenderData(null, face);
          lightRenderData.shadowViewport.copy(_viewport);
          lightRenderData.shadowScissor.copy(_scissor);
        }
      }
    }
  }

  // assign a slot to the light
  assignSlot(light, slotIndex, slotReassigned) {
    light.atlasViewportAllocated = true;
    const slot = this.slots[slotIndex];
    slot.lightId = light.id;
    slot.used = true;

    // slot is reassigned (content needs to be updated)
    if (slotReassigned) {
      light.atlasSlotUpdated = true;
      light.atlasVersion = this.version;
      light.atlasSlotIndex = slotIndex;
    }
  }

  // update texture atlas for a list of lights
  update(localLights, lightingParams) {
    // update texture resolutions
    this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
    this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;

    // collect lights requiring atlas
    const lights = this.collectLights(localLights, lightingParams);
    if (lights.length > 0) {
      // mark all slots as unused
      const slots = this.slots;
      for (let i = 0; i < slots.length; i++) {
        slots[i].used = false;
      }

      // assign slots to lights
      // The slot to light assignment logic:
      // - internally the atlas slots are sorted in the descending order (done when atlas split changes)
      // - every frame all visible lights are sorted by their screen space size (this handles all cameras where lights
      //   are visible using max value)
      // - all lights in this order get a slot size from the slot list in the same order. Care is taken to not reassign
      //   slot if the size of it is the same and only index changes - this is done using two pass assignment
      const assignCount = Math.min(lights.length, slots.length);

      // first pass - preserve allocated slots for lights requiring slot of the same size
      for (let i = 0; i < assignCount; i++) {
        const light = lights[i];
        if (light.castShadows) light._shadowMap = this.shadowAtlas;

        // if currently assigned slot is the same size as what is needed, and was last used by this light, reuse it
        const previousSlot = slots[light.atlasSlotIndex];
        if (light.atlasVersion === this.version && light.id === (previousSlot == null ? void 0 : previousSlot.lightId)) {
          const _previousSlot = slots[light.atlasSlotIndex];
          if (_previousSlot.size === slots[i].size && !_previousSlot.used) {
            this.assignSlot(light, light.atlasSlotIndex, false);
          }
        }
      }

      // second pass - assign slots to unhandled lights
      let usedCount = 0;
      for (let i = 0; i < assignCount; i++) {
        // skip already used slots
        while (usedCount < slots.length && slots[usedCount].used) usedCount++;
        const light = lights[i];
        if (!light.atlasViewportAllocated) {
          this.assignSlot(light, usedCount, true);
        }

        // set up all slots
        const slot = slots[light.atlasSlotIndex];
        this.setupSlot(light, slot.rect);
      }
    }
    this.updateUniforms();
  }
}

export { LightTextureAtlas };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQtdGV4dHVyZS1hdGxhcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgRklMVEVSX05FQVJFU1QsIFBJWEVMRk9STUFUX1JHQkE4IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIFNIQURPV19QQ0YzIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRvd01hcCB9IGZyb20gJy4uL3JlbmRlcmVyL3NoYWRvdy1tYXAuanMnO1xuXG5jb25zdCBfdGVtcEFycmF5ID0gW107XG5jb25zdCBfdGVtcEFycmF5MiA9IFtdO1xuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcbmNvbnN0IF9zY2lzc29yID0gbmV3IFZlYzQoKTtcblxuY2xhc3MgU2xvdCB7XG4gICAgY29uc3RydWN0b3IocmVjdCkge1xuICAgICAgICB0aGlzLnNpemUgPSBNYXRoLmZsb29yKHJlY3QudyAqIDEwMjQpOyAgLy8gc2l6ZSBub3JtYWxpemVkIHRvIDEwMjQgYXRsYXNcbiAgICAgICAgdGhpcy51c2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGlnaHRJZCA9IC0xOyAgLy8gaWQgb2YgdGhlIGxpZ2h0IHVzaW5nIHRoZSBzbG90XG4gICAgICAgIHRoaXMucmVjdCA9IHJlY3Q7XG4gICAgfVxufVxuXG4vLyBBIGNsYXNzIGhhbmRsaW5nIHJ1bnRpbWUgYWxsb2NhdGlvbiBvZiBzbG90cyBpbiBhIHRleHR1cmUuIEl0IGlzIHVzZWQgdG8gYWxsb2NhdGUgc2xvdHMgaW4gdGhlIHNoYWRvdyBhbmQgY29va2llIGF0bGFzLlxuY2xhc3MgTGlnaHRUZXh0dXJlQXRsYXMge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnZlcnNpb24gPSAxOyAgIC8vIGluY3JlbWVudGVkIGVhY2ggdGltZSBzbG90IGNvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXG4gICAgICAgIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gMjA0ODtcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IG51bGw7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGFkZGl0aW9uYWwgcGl4ZWxzIHRvIHJlbmRlciBwYXN0IHRoZSByZXF1aXJlZCBzaGFkb3cgY2FtZXJhIGFuZ2xlICg5MGRlZyBmb3Igb21uaSwgb3V0ZXIgZm9yIHNwb3QpIG9mIHRoZSBzaGFkb3cgY2FtZXJhIGZvciBjbHVzdGVyZWQgbGlnaHRzLlxuICAgICAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGEgcGl4ZWwgbW9yZSB0aGFuIGEgc2hhZG93IGZpbHRlciBuZWVkcyB0byBhY2Nlc3MuXG4gICAgICAgIHRoaXMuc2hhZG93RWRnZVBpeGVscyA9IDM7XG5cbiAgICAgICAgdGhpcy5jb29raWVBdGxhc1Jlc29sdXRpb24gPSA0O1xuICAgICAgICB0aGlzLmNvb2tpZUF0bGFzID0gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICdDb29raWVBdGxhcycsXG4gICAgICAgICAgICB3aWR0aDogdGhpcy5jb29raWVBdGxhc1Jlc29sdXRpb24sXG4gICAgICAgICAgICBoZWlnaHQ6IHRoaXMuY29va2llQXRsYXNSZXNvbHV0aW9uLFxuICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuY29va2llUmVuZGVyVGFyZ2V0ID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcy5jb29raWVBdGxhcyxcbiAgICAgICAgICAgIGRlcHRoOiBmYWxzZSxcbiAgICAgICAgICAgIGZsaXBZOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGF2YWlsYWJsZSBzbG90cyAob2YgdHlwZSBTbG90KVxuICAgICAgICB0aGlzLnNsb3RzID0gW107XG5cbiAgICAgICAgLy8gY3VycmVudCBzdWJkaXZpc2lvbiBzdHJhdGVneSAtIG1hdGNoZXMgZm9ybWF0IG9mIExpZ2h0aW5nUGFyYW1zLmF0bGFzU3BsaXRcbiAgICAgICAgdGhpcy5hdGxhc1NwbGl0ID0gW107XG5cbiAgICAgICAgLy8gb2Zmc2V0cyB0byBpbmRpdmlkdWFsIGZhY2VzIG9mIGEgY3ViZW1hcCBpbnNpZGUgM3gzIGdyaWQgaW4gYW4gYXRsYXMgc2xvdFxuICAgICAgICB0aGlzLmN1YmVTbG90c09mZnNldHMgPSBbXG4gICAgICAgICAgICBuZXcgVmVjMigwLCAwKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDAsIDEpLFxuICAgICAgICAgICAgbmV3IFZlYzIoMSwgMCksXG4gICAgICAgICAgICBuZXcgVmVjMigxLCAxKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDIsIDApLFxuICAgICAgICAgICAgbmV3IFZlYzIoMiwgMSlcbiAgICAgICAgXTtcblxuICAgICAgICAvLyBoYW5kbGVzIGdhcCBiZXR3ZWVuIHNsb3RzXG4gICAgICAgIHRoaXMuc2Npc3NvclZlYyA9IG5ldyBWZWM0KCk7XG5cbiAgICAgICAgdGhpcy5hbGxvY2F0ZVNoYWRvd0F0bGFzKDEpOyAgLy8gcGxhY2Vob2xkZXIgYXMgc2hhZGVyIHJlcXVpcmVzIGl0XG4gICAgICAgIHRoaXMuYWxsb2NhdGVDb29raWVBdGxhcygxKTsgIC8vIHBsYWNlaG9sZGVyIGFzIHNoYWRlciByZXF1aXJlcyBpdFxuICAgICAgICB0aGlzLmFsbG9jYXRlVW5pZm9ybXMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICB0aGlzLmRlc3Ryb3lDb29raWVBdGxhcygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lTaGFkb3dBdGxhcygpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhcz8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNoYWRvd0F0bGFzID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95Q29va2llQXRsYXMoKSB7XG4gICAgICAgIHRoaXMuY29va2llQXRsYXM/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5jb29raWVBdGxhcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQ/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgIH1cblxuICAgIGFsbG9jYXRlU2hhZG93QXRsYXMocmVzb2x1dGlvbikge1xuXG4gICAgICAgIGlmICghdGhpcy5zaGFkb3dBdGxhcyB8fCB0aGlzLnNoYWRvd0F0bGFzLnRleHR1cmUud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgLy8gY29udGVudCBvZiBhdGxhcyBpcyBsb3N0LCBmb3JjZSByZS1yZW5kZXIgb2Ygc3RhdGljIHNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IFNoYWRvd01hcC5jcmVhdGVBdGxhcyh0aGlzLmRldmljZSwgcmVzb2x1dGlvbiwgU0hBRE9XX1BDRjMpO1xuXG4gICAgICAgICAgICAvLyBhdm9pZCBpdCBiZWluZyBkZXN0cm95ZWQgYnkgbGlnaHRzXG4gICAgICAgICAgICB0aGlzLnNoYWRvd0F0bGFzLmNhY2hlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGxlYXZlIGdhcCBiZXR3ZWVuIGluZGl2aWR1YWwgdGlsZXMgdG8gYXZvaWQgc2hhZG93IC8gY29va2llIHNhbXBsaW5nIG90aGVyIHRpbGVzIChlbm91Z2ggZm9yIFBDRjUpXG4gICAgICAgICAgICAvLyBub3RlIHRoYXQgdGhpcyBvbmx5IGZhZGVzIC8gcmVtb3ZlcyBzaGFkb3dzIG9uIHRoZSBlZGdlcywgd2hpY2ggaXMgc3RpbGwgbm90IGNvcnJlY3QgLSBhIHNoYWRlciBjbGlwcGluZyBpcyBuZWVkZWQ/XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yT2Zmc2V0ID0gNCAvIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICAgICAgdGhpcy5zY2lzc29yVmVjLnNldChzY2lzc29yT2Zmc2V0LCBzY2lzc29yT2Zmc2V0LCAtMiAqIHNjaXNzb3JPZmZzZXQsIC0yICogc2Npc3Nvck9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZUNvb2tpZUF0bGFzKHJlc29sdXRpb24pIHtcblxuICAgICAgICAvLyByZXNpemUgYXRsYXNcbiAgICAgICAgaWYgKHRoaXMuY29va2llQXRsYXMud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQucmVzaXplKHJlc29sdXRpb24sIHJlc29sdXRpb24pO1xuXG4gICAgICAgICAgICAvLyBjb250ZW50IG9mIGF0bGFzIGlzIGxvc3QsIGZvcmNlIHJlLXJlbmRlciBvZiBzdGF0aWMgY29va2llc1xuICAgICAgICAgICAgdGhpcy52ZXJzaW9uKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZVVuaWZvcm1zKCkge1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1RleHR1cmVJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ3NoYWRvd0F0bGFzVGV4dHVyZScpO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc0lkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnc2hhZG93QXRsYXNQYXJhbXMnKTtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUF0bGFzVGV4dHVyZUlkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY29va2llQXRsYXNUZXh0dXJlJyk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoKSB7XG5cbiAgICAgICAgLy8gc2hhZG93IGF0bGFzIHRleHR1cmVcbiAgICAgICAgY29uc3QgaXNTaGFkb3dGaWx0ZXJQY2YgPSB0cnVlO1xuICAgICAgICBjb25zdCBydCA9IHRoaXMuc2hhZG93QXRsYXMucmVuZGVyVGFyZ2V0c1swXTtcbiAgICAgICAgY29uc3QgaXNEZXB0aFNoYWRvdyA9ICF0aGlzLmRldmljZS5pc1dlYkdMMSAmJiBpc1NoYWRvd0ZpbHRlclBjZjtcbiAgICAgICAgY29uc3Qgc2hhZG93QnVmZmVyID0gaXNEZXB0aFNoYWRvdyA/IHJ0LmRlcHRoQnVmZmVyIDogcnQuY29sb3JCdWZmZXI7XG4gICAgICAgIHRoaXMuX3NoYWRvd0F0bGFzVGV4dHVyZUlkLnNldFZhbHVlKHNoYWRvd0J1ZmZlcik7XG5cbiAgICAgICAgLy8gc2hhZG93IGF0bGFzIHBhcmFtc1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc1swXSA9IHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc1sxXSA9IHRoaXMuc2hhZG93RWRnZVBpeGVscztcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXNJZC5zZXRWYWx1ZSh0aGlzLl9zaGFkb3dBdGxhc1BhcmFtcyk7XG5cbiAgICAgICAgLy8gY29va2llIGF0bGFzIHRleHR1cmVzXG4gICAgICAgIHRoaXMuX2Nvb2tpZUF0bGFzVGV4dHVyZUlkLnNldFZhbHVlKHRoaXMuY29va2llQXRsYXMpO1xuICAgIH1cblxuICAgIHN1YmRpdmlkZShudW1MaWdodHMsIGxpZ2h0aW5nUGFyYW1zKSB7XG5cbiAgICAgICAgbGV0IGF0bGFzU3BsaXQgPSBsaWdodGluZ1BhcmFtcy5hdGxhc1NwbGl0O1xuXG4gICAgICAgIC8vIGlmIG5vIHVzZXIgc3BlY2lmaWVkIHN1YmRpdmlzaW9uXG4gICAgICAgIGlmICghYXRsYXNTcGxpdCkge1xuXG4gICAgICAgICAgICAvLyBzcGxpdCB0byBlcXVhbCBudW1iZXIgb2Ygc3F1YXJlc1xuICAgICAgICAgICAgY29uc3QgZ3JpZFNpemUgPSBNYXRoLmNlaWwoTWF0aC5zcXJ0KG51bUxpZ2h0cykpO1xuICAgICAgICAgICAgYXRsYXNTcGxpdCA9IF90ZW1wQXJyYXkyO1xuICAgICAgICAgICAgYXRsYXNTcGxpdFswXSA9IGdyaWRTaXplO1xuICAgICAgICAgICAgYXRsYXNTcGxpdC5sZW5ndGggPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29tcGFyZSB0d28gYXJyYXlzXG4gICAgICAgIGNvbnN0IGFycmF5c0VxdWFsID0gKGEsIGIpID0+IGEubGVuZ3RoID09PSBiLmxlbmd0aCAmJiBhLmV2ZXJ5KCh2LCBpKSA9PiB2ID09PSBiW2ldKTtcblxuICAgICAgICAvLyBpZiB0aGUgc3BsaXQgaGFzIGNoYW5nZWQsIHJlZ2VuZXJhdGUgc2xvdHNcbiAgICAgICAgaWYgKCFhcnJheXNFcXVhbChhdGxhc1NwbGl0LCB0aGlzLmF0bGFzU3BsaXQpKSB7XG5cbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuICAgICAgICAgICAgdGhpcy5zbG90cy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSBjdXJyZW50IHNldHRpbmdzXG4gICAgICAgICAgICB0aGlzLmF0bGFzU3BsaXQubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHRoaXMuYXRsYXNTcGxpdC5wdXNoKC4uLmF0bGFzU3BsaXQpO1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB0b3AgbGV2ZWwgc3BsaXRcbiAgICAgICAgICAgIGNvbnN0IHNwbGl0Q291bnQgPSB0aGlzLmF0bGFzU3BsaXRbMF07XG4gICAgICAgICAgICBpZiAoc3BsaXRDb3VudCA+IDEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnZTaXplID0gMSAvIHNwbGl0Q291bnQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzcGxpdENvdW50OyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBuZXcgVmVjNChpICogaW52U2l6ZSwgaiAqIGludlNpemUsIGludlNpemUsIGludlNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dExldmVsU3BsaXQgPSB0aGlzLmF0bGFzU3BsaXRbMSArIGkgKiBzcGxpdENvdW50ICsgal07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIG5lZWQgdG8gc3BsaXQgYWdhaW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXh0TGV2ZWxTcGxpdCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB4ID0gMDsgeCA8IG5leHRMZXZlbFNwbGl0OyB4KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBuZXh0TGV2ZWxTcGxpdDsgeSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnZTaXplTmV4dCA9IGludlNpemUgLyBuZXh0TGV2ZWxTcGxpdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3ROZXh0ID0gbmV3IFZlYzQocmVjdC54ICsgeCAqIGludlNpemVOZXh0LCByZWN0LnkgKyB5ICogaW52U2l6ZU5leHQsIGludlNpemVOZXh0LCBpbnZTaXplTmV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNsb3RzLnB1c2gobmV3IFNsb3QocmVjdE5leHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zbG90cy5wdXNoKG5ldyBTbG90KHJlY3QpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gc2luZ2xlIHNsb3RcbiAgICAgICAgICAgICAgICB0aGlzLnNsb3RzLnB1c2gobmV3IFNsb3QobmV3IFZlYzQoMCwgMCwgMSwgMSkpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc29ydCBzbG90cyBkZXNjZW5kaW5nXG4gICAgICAgICAgICB0aGlzLnNsb3RzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5zaXplIC0gYS5zaXplO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb2xsZWN0TGlnaHRzKGxvY2FsTGlnaHRzLCBsaWdodGluZ1BhcmFtcykge1xuXG4gICAgICAgIGNvbnN0IGNvb2tpZXNFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuY29va2llc0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IHNoYWRvd3NFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBsaWdodHMgdGhhdCBuZWVkIHNoYWRvd3Mgb3IgY29va2llcywgaWYgdGhvc2UgYXJlIGVuYWJsZWRcbiAgICAgICAgbGV0IG5lZWRzU2hhZG93QXRsYXMgPSBmYWxzZTtcbiAgICAgICAgbGV0IG5lZWRzQ29va2llQXRsYXMgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgbGlnaHRzID0gX3RlbXBBcnJheTtcbiAgICAgICAgbGlnaHRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgY29uc3QgcHJvY2Vzc0xpZ2h0cyA9IChsaXN0KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpc3RbaV07XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRTaGFkb3cgPSBzaGFkb3dzRW5hYmxlZCAmJiBsaWdodC5jYXN0U2hhZG93cztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRDb29raWUgPSBjb29raWVzRW5hYmxlZCAmJiAhIWxpZ2h0LmNvb2tpZTtcblxuICAgICAgICAgICAgICAgICAgICBuZWVkc1NoYWRvd0F0bGFzIHx8PSBsaWdodFNoYWRvdztcbiAgICAgICAgICAgICAgICAgICAgbmVlZHNDb29raWVBdGxhcyB8fD0gbGlnaHRDb29raWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhZG93IHx8IGxpZ2h0Q29va2llKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodHMucHVzaChsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGNvb2tpZXNFbmFibGVkIHx8IHNoYWRvd3NFbmFibGVkKSB7XG4gICAgICAgICAgICBwcm9jZXNzTGlnaHRzKGxvY2FsTGlnaHRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvcnQgbGlnaHRzIGJ5IG1heFNjcmVlblNpemUgLSB0byBoYXZlIHRoZW0gb3JkZXJlZCBieSBhdGxhcyBzbG90IHNpemVcbiAgICAgICAgbGlnaHRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBiLm1heFNjcmVlblNpemUgLSBhLm1heFNjcmVlblNpemU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChuZWVkc1NoYWRvd0F0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlU2hhZG93QXRsYXModGhpcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzQ29va2llQXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuYWxsb2NhdGVDb29raWVBdGxhcyh0aGlzLmNvb2tpZUF0bGFzUmVzb2x1dGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmVlZHNTaGFkb3dBdGxhcyB8fCBuZWVkc0Nvb2tpZUF0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLnN1YmRpdmlkZShsaWdodHMubGVuZ3RoLCBsaWdodGluZ1BhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlnaHRzO1xuICAgIH1cblxuICAgIC8vIGNvbmZpZ3VyZSBsaWdodCB0byB1c2UgYXNzaWduZWQgc2xvdFxuICAgIHNldHVwU2xvdChsaWdodCwgcmVjdCkge1xuXG4gICAgICAgIGxpZ2h0LmF0bGFzVmlld3BvcnQuY29weShyZWN0KTtcblxuICAgICAgICBjb25zdCBmYWNlQ291bnQgPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAvLyBzZXR1cCBzbG90IGZvciBzaGFkb3cgYW5kIGNvb2tpZVxuICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzIHx8IGxpZ2h0Ll9jb29raWUpIHtcblxuICAgICAgICAgICAgICAgIF92aWV3cG9ydC5jb3B5KHJlY3QpO1xuICAgICAgICAgICAgICAgIF9zY2lzc29yLmNvcHkocmVjdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3Igc3BvdCBsaWdodHMgaW4gdGhlIGF0bGFzLCBtYWtlIHZpZXdwb3J0IHNsaWdodGx5IHNtYWxsZXIgdG8gYXZvaWQgc2FtcGxpbmcgcGFzdCB0aGUgZWRnZXNcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC5hZGQodGhpcy5zY2lzc29yVmVjKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgY3ViZSBtYXAsIGFsbG9jYXRlIHBhcnQgb2YgdGhlIHNsb3RcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc21hbGxTaXplID0gX3ZpZXdwb3J0LnogLyAzO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLmN1YmVTbG90c09mZnNldHNbZmFjZV07XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC54ICs9IHNtYWxsU2l6ZSAqIG9mZnNldC54O1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQueSArPSBzbWFsbFNpemUgKiBvZmZzZXQueTtcbiAgICAgICAgICAgICAgICAgICAgX3ZpZXdwb3J0LnogPSBzbWFsbFNpemU7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC53ID0gc21hbGxTaXplO1xuXG4gICAgICAgICAgICAgICAgICAgIF9zY2lzc29yLmNvcHkoX3ZpZXdwb3J0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCBmYWNlKTtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1ZpZXdwb3J0LmNvcHkoX3ZpZXdwb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1NjaXNzb3IuY29weShfc2Npc3Nvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYXNzaWduIGEgc2xvdCB0byB0aGUgbGlnaHRcbiAgICBhc3NpZ25TbG90KGxpZ2h0LCBzbG90SW5kZXgsIHNsb3RSZWFzc2lnbmVkKSB7XG5cbiAgICAgICAgbGlnaHQuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IHRydWU7XG5cbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2xvdHNbc2xvdEluZGV4XTtcbiAgICAgICAgc2xvdC5saWdodElkID0gbGlnaHQuaWQ7XG4gICAgICAgIHNsb3QudXNlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gc2xvdCBpcyByZWFzc2lnbmVkIChjb250ZW50IG5lZWRzIHRvIGJlIHVwZGF0ZWQpXG4gICAgICAgIGlmIChzbG90UmVhc3NpZ25lZCkge1xuICAgICAgICAgICAgbGlnaHQuYXRsYXNTbG90VXBkYXRlZCA9IHRydWU7XG4gICAgICAgICAgICBsaWdodC5hdGxhc1ZlcnNpb24gPSB0aGlzLnZlcnNpb247XG4gICAgICAgICAgICBsaWdodC5hdGxhc1Nsb3RJbmRleCA9IHNsb3RJbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZSB0ZXh0dXJlIGF0bGFzIGZvciBhIGxpc3Qgb2YgbGlnaHRzXG4gICAgdXBkYXRlKGxvY2FsTGlnaHRzLCBsaWdodGluZ1BhcmFtcykge1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0ZXh0dXJlIHJlc29sdXRpb25zXG4gICAgICAgIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICB0aGlzLmNvb2tpZUF0bGFzUmVzb2x1dGlvbiA9IGxpZ2h0aW5nUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAvLyBjb2xsZWN0IGxpZ2h0cyByZXF1aXJpbmcgYXRsYXNcbiAgICAgICAgY29uc3QgbGlnaHRzID0gdGhpcy5jb2xsZWN0TGlnaHRzKGxvY2FsTGlnaHRzLCBsaWdodGluZ1BhcmFtcyk7XG4gICAgICAgIGlmIChsaWdodHMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAvLyBtYXJrIGFsbCBzbG90cyBhcyB1bnVzZWRcbiAgICAgICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2xvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBzbG90c1tpXS51c2VkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFzc2lnbiBzbG90cyB0byBsaWdodHNcbiAgICAgICAgICAgIC8vIFRoZSBzbG90IHRvIGxpZ2h0IGFzc2lnbm1lbnQgbG9naWM6XG4gICAgICAgICAgICAvLyAtIGludGVybmFsbHkgdGhlIGF0bGFzIHNsb3RzIGFyZSBzb3J0ZWQgaW4gdGhlIGRlc2NlbmRpbmcgb3JkZXIgKGRvbmUgd2hlbiBhdGxhcyBzcGxpdCBjaGFuZ2VzKVxuICAgICAgICAgICAgLy8gLSBldmVyeSBmcmFtZSBhbGwgdmlzaWJsZSBsaWdodHMgYXJlIHNvcnRlZCBieSB0aGVpciBzY3JlZW4gc3BhY2Ugc2l6ZSAodGhpcyBoYW5kbGVzIGFsbCBjYW1lcmFzIHdoZXJlIGxpZ2h0c1xuICAgICAgICAgICAgLy8gICBhcmUgdmlzaWJsZSB1c2luZyBtYXggdmFsdWUpXG4gICAgICAgICAgICAvLyAtIGFsbCBsaWdodHMgaW4gdGhpcyBvcmRlciBnZXQgYSBzbG90IHNpemUgZnJvbSB0aGUgc2xvdCBsaXN0IGluIHRoZSBzYW1lIG9yZGVyLiBDYXJlIGlzIHRha2VuIHRvIG5vdCByZWFzc2lnblxuICAgICAgICAgICAgLy8gICBzbG90IGlmIHRoZSBzaXplIG9mIGl0IGlzIHRoZSBzYW1lIGFuZCBvbmx5IGluZGV4IGNoYW5nZXMgLSB0aGlzIGlzIGRvbmUgdXNpbmcgdHdvIHBhc3MgYXNzaWdubWVudFxuICAgICAgICAgICAgY29uc3QgYXNzaWduQ291bnQgPSBNYXRoLm1pbihsaWdodHMubGVuZ3RoLCBzbG90cy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAvLyBmaXJzdCBwYXNzIC0gcHJlc2VydmUgYWxsb2NhdGVkIHNsb3RzIGZvciBsaWdodHMgcmVxdWlyaW5nIHNsb3Qgb2YgdGhlIHNhbWUgc2l6ZVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NpZ25Db3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MpXG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0Ll9zaGFkb3dNYXAgPSB0aGlzLnNoYWRvd0F0bGFzO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgY3VycmVudGx5IGFzc2lnbmVkIHNsb3QgaXMgdGhlIHNhbWUgc2l6ZSBhcyB3aGF0IGlzIG5lZWRlZCwgYW5kIHdhcyBsYXN0IHVzZWQgYnkgdGhpcyBsaWdodCwgcmV1c2UgaXRcbiAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c1Nsb3QgPSBzbG90c1tsaWdodC5hdGxhc1Nsb3RJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmF0bGFzVmVyc2lvbiA9PT0gdGhpcy52ZXJzaW9uICYmIGxpZ2h0LmlkID09PSBwcmV2aW91c1Nsb3Q/LmxpZ2h0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNTbG90ID0gc2xvdHNbbGlnaHQuYXRsYXNTbG90SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNTbG90LnNpemUgPT09IHNsb3RzW2ldLnNpemUgJiYgIXByZXZpb3VzU2xvdC51c2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2lnblNsb3QobGlnaHQsIGxpZ2h0LmF0bGFzU2xvdEluZGV4LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNlY29uZCBwYXNzIC0gYXNzaWduIHNsb3RzIHRvIHVuaGFuZGxlZCBsaWdodHNcbiAgICAgICAgICAgIGxldCB1c2VkQ291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NpZ25Db3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIGFscmVhZHkgdXNlZCBzbG90c1xuICAgICAgICAgICAgICAgIHdoaWxlICh1c2VkQ291bnQgPCBzbG90cy5sZW5ndGggJiYgc2xvdHNbdXNlZENvdW50XS51c2VkKVxuICAgICAgICAgICAgICAgICAgICB1c2VkQ291bnQrKztcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghbGlnaHQuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2lnblNsb3QobGlnaHQsIHVzZWRDb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHVwIGFsbCBzbG90c1xuICAgICAgICAgICAgICAgIGNvbnN0IHNsb3QgPSBzbG90c1tsaWdodC5hdGxhc1Nsb3RJbmRleF07XG4gICAgICAgICAgICAgICAgdGhpcy5zZXR1cFNsb3QobGlnaHQsIHNsb3QucmVjdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVwZGF0ZVVuaWZvcm1zKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9O1xuIl0sIm5hbWVzIjpbIl90ZW1wQXJyYXkiLCJfdGVtcEFycmF5MiIsIl92aWV3cG9ydCIsIlZlYzQiLCJfc2Npc3NvciIsIlNsb3QiLCJjb25zdHJ1Y3RvciIsInJlY3QiLCJzaXplIiwiTWF0aCIsImZsb29yIiwidyIsInVzZWQiLCJsaWdodElkIiwiTGlnaHRUZXh0dXJlQXRsYXMiLCJkZXZpY2UiLCJ2ZXJzaW9uIiwic2hhZG93QXRsYXNSZXNvbHV0aW9uIiwic2hhZG93QXRsYXMiLCJzaGFkb3dFZGdlUGl4ZWxzIiwiY29va2llQXRsYXNSZXNvbHV0aW9uIiwiY29va2llQXRsYXMiLCJUZXh0dXJlIiwibmFtZSIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJjdWJlbWFwIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImNvb2tpZVJlbmRlclRhcmdldCIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJmbGlwWSIsInNsb3RzIiwiYXRsYXNTcGxpdCIsImN1YmVTbG90c09mZnNldHMiLCJWZWMyIiwic2Npc3NvclZlYyIsImFsbG9jYXRlU2hhZG93QXRsYXMiLCJhbGxvY2F0ZUNvb2tpZUF0bGFzIiwiYWxsb2NhdGVVbmlmb3JtcyIsImRlc3Ryb3kiLCJkZXN0cm95U2hhZG93QXRsYXMiLCJkZXN0cm95Q29va2llQXRsYXMiLCJfdGhpcyRzaGFkb3dBdGxhcyIsIl90aGlzJGNvb2tpZUF0bGFzIiwiX3RoaXMkY29va2llUmVuZGVyVGFyIiwicmVzb2x1dGlvbiIsInRleHR1cmUiLCJTaGFkb3dNYXAiLCJjcmVhdGVBdGxhcyIsIlNIQURPV19QQ0YzIiwiY2FjaGVkIiwic2Npc3Nvck9mZnNldCIsInNldCIsInJlc2l6ZSIsIl9zaGFkb3dBdGxhc1RleHR1cmVJZCIsInNjb3BlIiwicmVzb2x2ZSIsIl9zaGFkb3dBdGxhc1BhcmFtc0lkIiwiX3NoYWRvd0F0bGFzUGFyYW1zIiwiRmxvYXQzMkFycmF5IiwiX2Nvb2tpZUF0bGFzVGV4dHVyZUlkIiwidXBkYXRlVW5pZm9ybXMiLCJpc1NoYWRvd0ZpbHRlclBjZiIsInJ0IiwicmVuZGVyVGFyZ2V0cyIsImlzRGVwdGhTaGFkb3ciLCJpc1dlYkdMMSIsInNoYWRvd0J1ZmZlciIsImRlcHRoQnVmZmVyIiwic2V0VmFsdWUiLCJzdWJkaXZpZGUiLCJudW1MaWdodHMiLCJsaWdodGluZ1BhcmFtcyIsImdyaWRTaXplIiwiY2VpbCIsInNxcnQiLCJsZW5ndGgiLCJhcnJheXNFcXVhbCIsImEiLCJiIiwiZXZlcnkiLCJ2IiwiaSIsInB1c2giLCJzcGxpdENvdW50IiwiaW52U2l6ZSIsImoiLCJuZXh0TGV2ZWxTcGxpdCIsIngiLCJ5IiwiaW52U2l6ZU5leHQiLCJyZWN0TmV4dCIsInNvcnQiLCJjb2xsZWN0TGlnaHRzIiwibG9jYWxMaWdodHMiLCJjb29raWVzRW5hYmxlZCIsInNoYWRvd3NFbmFibGVkIiwibmVlZHNTaGFkb3dBdGxhcyIsIm5lZWRzQ29va2llQXRsYXMiLCJsaWdodHMiLCJwcm9jZXNzTGlnaHRzIiwibGlzdCIsImxpZ2h0IiwidmlzaWJsZVRoaXNGcmFtZSIsImxpZ2h0U2hhZG93IiwiY2FzdFNoYWRvd3MiLCJsaWdodENvb2tpZSIsImNvb2tpZSIsIm1heFNjcmVlblNpemUiLCJzZXR1cFNsb3QiLCJhdGxhc1ZpZXdwb3J0IiwiY29weSIsImZhY2VDb3VudCIsIm51bVNoYWRvd0ZhY2VzIiwiZmFjZSIsIl9jb29raWUiLCJfdHlwZSIsIkxJR0hUVFlQRV9TUE9UIiwiYWRkIiwiTElHSFRUWVBFX09NTkkiLCJzbWFsbFNpemUiLCJ6Iiwib2Zmc2V0IiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd1ZpZXdwb3J0Iiwic2hhZG93U2Npc3NvciIsImFzc2lnblNsb3QiLCJzbG90SW5kZXgiLCJzbG90UmVhc3NpZ25lZCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJzbG90IiwiaWQiLCJhdGxhc1Nsb3RVcGRhdGVkIiwiYXRsYXNWZXJzaW9uIiwiYXRsYXNTbG90SW5kZXgiLCJ1cGRhdGUiLCJhc3NpZ25Db3VudCIsIm1pbiIsIl9zaGFkb3dNYXAiLCJwcmV2aW91c1Nsb3QiLCJ1c2VkQ291bnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBVUEsTUFBTUEsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUNyQixNQUFNQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0FBQ3RCLE1BQU1DLFNBQVMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUM1QixNQUFNQyxRQUFRLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFFM0IsTUFBTUUsSUFBSSxDQUFDO0VBQ1BDLFdBQVdBLENBQUNDLElBQUksRUFBRTtBQUNkLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUNJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN0QyxJQUFJLENBQUNDLElBQUksR0FBRyxLQUFLLENB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
