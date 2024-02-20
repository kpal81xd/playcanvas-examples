import { Color } from '../../../core/math/color.js';
import { PIXELFORMAT_RGBA8, CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { BLEND_PREMULTIPLIED, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from '../../../scene/constants.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { SpriteComponent } from './component.js';
import { SpriteComponentData } from './data.js';

const _schema = ['enabled'];
class SpriteComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'sprite';
    this.ComponentType = SpriteComponent;
    this.DataType = SpriteComponentData;
    this.schema = _schema;
    this._defaultTexture = null;
    this._defaultMaterial = null;
    this._default9SlicedMaterialSlicedMode = null;
    this._default9SlicedMaterialTiledMode = null;
    this.app.systems.on('update', this.onUpdate, this);
    this.on('beforeremove', this.onBeforeRemove, this);
  }
  set defaultMaterial(material) {
    this._defaultMaterial = material;
  }
  get defaultMaterial() {
    if (!this._defaultMaterial) {
      const texture = new Texture(this.app.graphicsDevice, {
        width: 1,
        height: 1,
        format: PIXELFORMAT_RGBA8,
        name: 'sprite'
      });
      const pixels = new Uint8Array(texture.lock());
      pixels[0] = pixels[1] = pixels[2] = pixels[3] = 255;
      texture.unlock();
      const material = new StandardMaterial();
      material.diffuse.set(0, 0, 0);
      material.emissive.set(0.5, 0.5, 0.5);
      material.emissiveMap = texture;
      material.emissiveTint = true;
      material.opacityMap = texture;
      material.opacityMapChannel = 'a';
      material.opacityTint = true;
      material.opacity = 0;
      material.useLighting = false;
      material.useGammaTonemap = false;
      material.useFog = false;
      material.useSkybox = false;
      material.blendType = BLEND_PREMULTIPLIED;
      material.depthWrite = false;
      material.pixelSnap = false;
      material.cull = CULLFACE_NONE;
      material.update();
      this._defaultTexture = texture;
      this._defaultMaterial = material;
    }
    return this._defaultMaterial;
  }
  set default9SlicedMaterialSlicedMode(material) {
    this._default9SlicedMaterialSlicedMode = material;
  }
  get default9SlicedMaterialSlicedMode() {
    if (!this._default9SlicedMaterialSlicedMode) {
      const material = this.defaultMaterial.clone();
      material.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
      material.update();
      this._default9SlicedMaterialSlicedMode = material;
    }
    return this._default9SlicedMaterialSlicedMode;
  }
  set default9SlicedMaterialTiledMode(material) {
    this._default9SlicedMaterialTiledMode = material;
  }
  get default9SlicedMaterialTiledMode() {
    if (!this._default9SlicedMaterialTiledMode) {
      const material = this.defaultMaterial.clone();
      material.nineSlicedMode = SPRITE_RENDERMODE_TILED;
      material.update();
      this._default9SlicedMaterialTiledMode = material;
    }
    return this._default9SlicedMaterialTiledMode;
  }
  destroy() {
    super.destroy();
    this.app.systems.off('update', this.onUpdate, this);
    if (this._defaultTexture) {
      this._defaultTexture.destroy();
      this._defaultTexture = null;
    }
  }
  initializeComponentData(component, data, properties) {
    if (data.enabled !== undefined) {
      component.enabled = data.enabled;
    }
    component.type = data.type;
    if (data.layers && Array.isArray(data.layers)) {
      component.layers = data.layers.slice(0);
    }
    if (data.drawOrder !== undefined) {
      component.drawOrder = data.drawOrder;
    }
    if (data.color !== undefined) {
      if (data.color instanceof Color) {
        var _data$opacity;
        component.color.set(data.color.r, data.color.g, data.color.b, (_data$opacity = data.opacity) != null ? _data$opacity : 1);
      } else {
        var _data$opacity2;
        component.color.set(data.color[0], data.color[1], data.color[2], (_data$opacity2 = data.opacity) != null ? _data$opacity2 : 1);
      }
      component.color = component.color;
    }
    if (data.opacity !== undefined) {
      component.opacity = data.opacity;
    }
    if (data.flipX !== undefined) {
      component.flipX = data.flipX;
    }
    if (data.flipY !== undefined) {
      component.flipY = data.flipY;
    }
    if (data.width !== undefined) {
      component.width = data.width;
    }
    if (data.height !== undefined) {
      component.height = data.height;
    }
    if (data.spriteAsset !== undefined) {
      component.spriteAsset = data.spriteAsset;
    }
    if (data.sprite) {
      component.sprite = data.sprite;
    }
    if (data.frame !== undefined) {
      component.frame = data.frame;
    }
    if (data.clips) {
      for (const name in data.clips) {
        component.addClip(data.clips[name]);
      }
    }
    if (data.speed !== undefined) {
      component.speed = data.speed;
    }
    if (data.autoPlayClip) {
      component.autoPlayClip = data.autoPlayClip;
    }
    component.batchGroupId = data.batchGroupId === undefined || data.batchGroupId === null ? -1 : data.batchGroupId;
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    const source = entity.sprite;
    return this.addComponent(clone, {
      enabled: source.enabled,
      type: source.type,
      spriteAsset: source.spriteAsset,
      sprite: source.sprite,
      width: source.width,
      height: source.height,
      frame: source.frame,
      color: source.color.clone(),
      opacity: source.opacity,
      flipX: source.flipX,
      flipY: source.flipY,
      speed: source.speed,
      clips: source.clips,
      autoPlayClip: source.autoPlayClip,
      batchGroupId: source.batchGroupId,
      drawOrder: source.drawOrder,
      layers: source.layers.slice(0)
    });
  }
  onUpdate(dt) {
    const components = this.store;
    for (const id in components) {
      if (components.hasOwnProperty(id)) {
        const component = components[id];
        if (component.data.enabled && component.entity.enabled) {
          const sprite = component.entity.sprite;
          if (sprite._currentClip) {
            sprite._currentClip._update(dt);
          }
        }
      }
    }
  }
  onBeforeRemove(entity, component) {
    component.onDestroy();
  }
}
Component._buildAccessors(SpriteComponent.prototype, _schema);

export { SpriteComponentSystem };