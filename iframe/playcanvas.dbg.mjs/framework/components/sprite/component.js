import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { LAYERID_WORLD, SPRITE_RENDERMODE_TILED, SPRITE_RENDERMODE_SLICED } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { Component } from '../component.js';
import { SPRITETYPE_SIMPLE, SPRITETYPE_ANIMATED } from './constants.js';
import { SpriteAnimationClip } from './sprite-animation-clip.js';

const PARAM_EMISSIVE_MAP = 'texture_emissiveMap';
const PARAM_OPACITY_MAP = 'texture_opacityMap';
const PARAM_EMISSIVE = 'material_emissive';
const PARAM_OPACITY = 'material_opacity';
const PARAM_INNER_OFFSET = 'innerOffset';
const PARAM_OUTER_SCALE = 'outerScale';
const PARAM_ATLAS_RECT = 'atlasRect';

/**
 * Enables an Entity to render a simple static sprite or sprite animations.
 *
 * @augments Component
 * @category Graphics
 */
class SpriteComponent extends Component {
  /**
   * Create a new SpriteComponent instance.
   *
   * @param {import('./system.js').SpriteComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    this._type = SPRITETYPE_SIMPLE;
    this._material = system.defaultMaterial;
    this._color = new Color(1, 1, 1, 1);
    this._colorUniform = new Float32Array(3);
    this._speed = 1;
    this._flipX = false;
    this._flipY = false;
    this._width = 1;
    this._height = 1;
    this._drawOrder = 0;
    this._layers = [LAYERID_WORLD]; // assign to the default world layer

    // 9-slicing
    this._outerScale = new Vec2(1, 1);
    this._outerScaleUniform = new Float32Array(2);
    this._innerOffset = new Vec4();
    this._innerOffsetUniform = new Float32Array(4);
    this._atlasRect = new Vec4();
    this._atlasRectUniform = new Float32Array(4);

    // batch groups
    this._batchGroupId = -1;
    this._batchGroup = null;

    // node / mesh instance
    this._node = new GraphNode();
    this._model = new Model();
    this._model.graph = this._node;
    this._meshInstance = null;
    entity.addChild(this._model.graph);
    this._model._entity = entity;
    this._updateAabbFunc = this._updateAabb.bind(this);
    this._addedModel = false;

    // animated sprites
    this._autoPlayClip = null;

    /**
     * Dictionary of sprite animation clips.
     *
     * @type {Object<string, SpriteAnimationClip>}
     * @private
     */
    this._clips = {};

    // create default clip for simple sprite type
    this._defaultClip = new SpriteAnimationClip(this, {
      name: this.entity.name,
      fps: 0,
      loop: false,
      spriteAsset: null
    });

    /**
     * The sprite animation clip currently playing.
     *
     * @type {SpriteAnimationClip}
     * @private
     */
    this._currentClip = this._defaultClip;
  }

  /**
   * The type of the SpriteComponent. Can be:
   *
   * - {@link SPRITETYPE_SIMPLE}: The component renders a single frame from a sprite asset.
   * - {@link SPRITETYPE_ANIMATED}: The component can play sprite animation clips.
   *
   * Defaults to {@link SPRITETYPE_SIMPLE}.
   *
   * @type {string}
   */
  set type(value) {
    if (this._type === value) return;
    this._type = value;
    if (this._type === SPRITETYPE_SIMPLE) {
      this.stop();
      this._currentClip = this._defaultClip;
      if (this.enabled && this.entity.enabled) {
        this._currentClip.frame = this.frame;
        if (this._currentClip.sprite) {
          this._showModel();
        } else {
          this._hideModel();
        }
      }
    } else if (this._type === SPRITETYPE_ANIMATED) {
      this.stop();
      if (this._autoPlayClip) {
        this._tryAutoPlay();
      }
      if (this._currentClip && this._currentClip.isPlaying && this.enabled && this.entity.enabled) {
        this._showModel();
      } else {
        this._hideModel();
      }
    }
  }
  get type() {
    return this._type;
  }

  /**
   * The frame counter of the sprite. Specifies which frame from the current sprite asset to
   * render.
   *
   * @type {number}
   */
  set frame(value) {
    this._currentClip.frame = value;
  }
  get frame() {
    return this._currentClip.frame;
  }

  /**
   * The asset id or the {@link Asset} of the sprite to render. Only works for
   * {@link SPRITETYPE_SIMPLE} sprites.
   *
   * @type {number|import('../../asset/asset.js').Asset}
   */
  set spriteAsset(value) {
    this._defaultClip.spriteAsset = value;
  }
  get spriteAsset() {
    return this._defaultClip._spriteAsset;
  }

  /**
   * The current sprite.
   *
   * @type {import('../../../scene/sprite.js').Sprite}
   */
  set sprite(value) {
    this._currentClip.sprite = value;
  }
  get sprite() {
    return this._currentClip.sprite;
  }

  // (private) {pc.Material} material The material used to render a sprite.
  set material(value) {
    this._material = value;
    if (this._meshInstance) {
      this._meshInstance.material = value;
    }
  }
  get material() {
    return this._material;
  }

  /**
   * The color tint of the sprite.
   *
   * @type {Color}
   */
  set color(value) {
    this._color.r = value.r;
    this._color.g = value.g;
    this._color.b = value.b;
    if (this._meshInstance) {
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
    }
  }
  get color() {
    return this._color;
  }

  /**
   * The opacity of the sprite.
   *
   * @type {number}
   */
  set opacity(value) {
    this._color.a = value;
    if (this._meshInstance) {
      this._meshInstance.setParameter(PARAM_OPACITY, value);
    }
  }
  get opacity() {
    return this._color.a;
  }

  /**
   * A dictionary that contains {@link SpriteAnimationClip}s.
   *
   * @type {Object<string, SpriteAnimationClip>}
   */
  set clips(value) {
    // if value is null remove all clips
    if (!value) {
      for (const name in this._clips) {
        this.removeClip(name);
      }
      return;
    }

    // remove existing clips not in new value
    // and update clips in both objects
    for (const name in this._clips) {
      let found = false;
      for (const key in value) {
        if (value[key].name === name) {
          found = true;
          this._clips[name].fps = value[key].fps;
          this._clips[name].loop = value[key].loop;
          if (value[key].hasOwnProperty('sprite')) {
            this._clips[name].sprite = value[key].sprite;
          } else if (value[key].hasOwnProperty('spriteAsset')) {
            this._clips[name].spriteAsset = value[key].spriteAsset;
          }
          break;
        }
      }
      if (!found) {
        this.removeClip(name);
      }
    }

    // add clips that do not exist
    for (const key in value) {
      if (this._clips[value[key].name]) continue;
      this.addClip(value[key]);
    }

    // auto play clip
    if (this._autoPlayClip) {
      this._tryAutoPlay();
    }

    // if the current clip doesn't have a sprite then hide the model
    if (!this._currentClip || !this._currentClip.sprite) {
      this._hideModel();
    }
  }
  get clips() {
    return this._clips;
  }

  /**
   * The current clip being played.
   *
   * @type {SpriteAnimationClip}
   */
  get currentClip() {
    return this._currentClip;
  }

  /**
   * A global speed modifier used when playing sprite animation clips.
   *
   * @type {number}
   */
  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }

  /**
   * Flip the X axis when rendering a sprite.
   *
   * @type {boolean}
   */
  set flipX(value) {
    if (this._flipX === value) return;
    this._flipX = value;
    this._updateTransform();
  }
  get flipX() {
    return this._flipX;
  }

  /**
   * Flip the Y axis when rendering a sprite.
   *
   * @type {boolean}
   */
  set flipY(value) {
    if (this._flipY === value) return;
    this._flipY = value;
    this._updateTransform();
  }
  get flipY() {
    return this._flipY;
  }

  /**
   * The width of the sprite when rendering using 9-Slicing. The width and height are only used
   * when the render mode of the sprite asset is Sliced or Tiled.
   *
   * @type {number}
   */
  set width(value) {
    if (value === this._width) return;
    this._width = value;
    this._outerScale.x = this._width;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
      this._updateTransform();
    }
  }
  get width() {
    return this._width;
  }

  /**
   * The height of the sprite when rendering using 9-Slicing. The width and height are only used
   * when the render mode of the sprite asset is Sliced or Tiled.
   *
   * @type {number}
   */
  set height(value) {
    if (value === this._height) return;
    this._height = value;
    this._outerScale.y = this.height;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
      this._updateTransform();
    }
  }
  get height() {
    return this._height;
  }

  /**
   * Assign sprite to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
  set batchGroupId(value) {
    if (this._batchGroupId === value) return;
    const prev = this._batchGroupId;
    this._batchGroupId = value;
    if (this.entity.enabled && prev >= 0) {
      var _this$system$app$batc;
      (_this$system$app$batc = this.system.app.batcher) == null || _this$system$app$batc.remove(BatchGroup.SPRITE, prev, this.entity);
    }
    if (this.entity.enabled && value >= 0) {
      var _this$system$app$batc2;
      (_this$system$app$batc2 = this.system.app.batcher) == null || _this$system$app$batc2.insert(BatchGroup.SPRITE, value, this.entity);
    } else {
      // re-add model to scene in case it was removed by batching
      if (prev >= 0) {
        if (this._currentClip && this._currentClip.sprite && this.enabled && this.entity.enabled) {
          this._showModel();
        }
      }
    }
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  /**
   * The name of the clip to play automatically when the component is enabled and the clip exists.
   *
   * @type {string}
   */
  set autoPlayClip(value) {
    this._autoPlayClip = value instanceof SpriteAnimationClip ? value.name : value;
    this._tryAutoPlay();
  }
  get autoPlayClip() {
    return this._autoPlayClip;
  }

  /**
   * The draw order of the component. A higher value means that the component will be rendered on
   * top of other components in the same layer. This is not used unless the layer's sort order is
   * set to {@link SORTMODE_MANUAL}.
   *
   * @type {number}
   */
  set drawOrder(value) {
    this._drawOrder = value;
    if (this._meshInstance) {
      this._meshInstance.drawOrder = value;
    }
  }
  get drawOrder() {
    return this._drawOrder;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which this sprite should belong.
   *
   * @type {number[]}
   */
  set layers(value) {
    if (this._addedModel) {
      this._hideModel();
    }
    this._layers = value;

    // early out
    if (!this._meshInstance) {
      return;
    }
    if (this.enabled && this.entity.enabled) {
      this._showModel();
    }
  }
  get layers() {
    return this._layers;
  }
  get aabb() {
    if (this._meshInstance) {
      return this._meshInstance.aabb;
    }
    return null;
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.on('set:layers', this._onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this._onLayerAdded, this);
      scene.layers.on('remove', this._onLayerRemoved, this);
    }
    this._showModel();
    if (this._autoPlayClip) this._tryAutoPlay();
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null || _app$batcher.insert(BatchGroup.SPRITE, this._batchGroupId, this.entity);
    }
  }
  onDisable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.off('set:layers', this._onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this._onLayerAdded, this);
      scene.layers.off('remove', this._onLayerRemoved, this);
    }
    this.stop();
    this._hideModel();
    if (this._batchGroupId >= 0) {
      var _app$batcher2;
      (_app$batcher2 = app.batcher) == null || _app$batcher2.remove(BatchGroup.SPRITE, this._batchGroupId, this.entity);
    }
  }
  onDestroy() {
    var _this$_node;
    this._currentClip = null;
    if (this._defaultClip) {
      this._defaultClip._destroy();
      this._defaultClip = null;
    }
    for (const key in this._clips) {
      this._clips[key]._destroy();
    }
    this._clips = null;
    this._hideModel();
    this._model = null;
    (_this$_node = this._node) == null || _this$_node.remove();
    this._node = null;
    if (this._meshInstance) {
      // make sure we decrease the ref counts materials and meshes
      this._meshInstance.material = null;
      this._meshInstance.mesh = null;
      this._meshInstance = null;
    }
  }
  _showModel() {
    if (this._addedModel) return;
    if (!this._meshInstance) return;
    const meshInstances = [this._meshInstance];
    for (let i = 0, len = this._layers.length; i < len; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(meshInstances);
      }
    }
    this._addedModel = true;
  }
  _hideModel() {
    if (!this._addedModel || !this._meshInstance) return;
    const meshInstances = [this._meshInstance];
    for (let i = 0, len = this._layers.length; i < len; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.removeMeshInstances(meshInstances);
      }
    }
    this._addedModel = false;
  }

  // Set the desired mesh on the mesh instance
  _showFrame(frame) {
    if (!this.sprite) return;
    const mesh = this.sprite.meshes[frame];
    // if mesh is null then hide the mesh instance
    if (!mesh) {
      if (this._meshInstance) {
        this._meshInstance.mesh = null;
        this._meshInstance.visible = false;
      }
      return;
    }
    let material;
    if (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED) {
      material = this.system.default9SlicedMaterialSlicedMode;
    } else if (this.sprite.renderMode === SPRITE_RENDERMODE_TILED) {
      material = this.system.default9SlicedMaterialTiledMode;
    } else {
      material = this.system.defaultMaterial;
    }

    // create mesh instance if it doesn't exist yet
    if (!this._meshInstance) {
      this._meshInstance = new MeshInstance(mesh, this._material, this._node);
      this._meshInstance.castShadow = false;
      this._meshInstance.receiveShadow = false;
      this._meshInstance.drawOrder = this._drawOrder;
      this._model.meshInstances.push(this._meshInstance);

      // set overrides on mesh instance
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
      this._meshInstance.setParameter(PARAM_OPACITY, this._color.a);

      // now that we created the mesh instance, add the model to the scene
      if (this.enabled && this.entity.enabled) {
        this._showModel();
      }
    }

    // update material
    if (this._meshInstance.material !== material) {
      this._meshInstance.material = material;
    }

    // update mesh
    if (this._meshInstance.mesh !== mesh) {
      this._meshInstance.mesh = mesh;
      this._meshInstance.visible = true;
      // reset aabb
      this._meshInstance._aabbVer = -1;
    }

    // set texture params
    if (this.sprite.atlas && this.sprite.atlas.texture) {
      this._meshInstance.setParameter(PARAM_EMISSIVE_MAP, this.sprite.atlas.texture);
      this._meshInstance.setParameter(PARAM_OPACITY_MAP, this.sprite.atlas.texture);
    } else {
      // no texture so reset texture params
      this._meshInstance.deleteParameter(PARAM_EMISSIVE_MAP);
      this._meshInstance.deleteParameter(PARAM_OPACITY_MAP);
    }

    // for 9-sliced
    if (this.sprite.atlas && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      // set custom aabb function
      this._meshInstance._updateAabbFunc = this._updateAabbFunc;

      // calculate inner offset
      const frameData = this.sprite.atlas.frames[this.sprite.frameKeys[frame]];
      if (frameData) {
        const borderWidthScale = 2 / frameData.rect.z;
        const borderHeightScale = 2 / frameData.rect.w;
        this._innerOffset.set(frameData.border.x * borderWidthScale, frameData.border.y * borderHeightScale, frameData.border.z * borderWidthScale, frameData.border.w * borderHeightScale);
        const tex = this.sprite.atlas.texture;
        this._atlasRect.set(frameData.rect.x / tex.width, frameData.rect.y / tex.height, frameData.rect.z / tex.width, frameData.rect.w / tex.height);
      } else {
        this._innerOffset.set(0, 0, 0, 0);
      }

      // set inner offset and atlas rect on mesh instance
      this._innerOffsetUniform[0] = this._innerOffset.x;
      this._innerOffsetUniform[1] = this._innerOffset.y;
      this._innerOffsetUniform[2] = this._innerOffset.z;
      this._innerOffsetUniform[3] = this._innerOffset.w;
      this._meshInstance.setParameter(PARAM_INNER_OFFSET, this._innerOffsetUniform);
      this._atlasRectUniform[0] = this._atlasRect.x;
      this._atlasRectUniform[1] = this._atlasRect.y;
      this._atlasRectUniform[2] = this._atlasRect.z;
      this._atlasRectUniform[3] = this._atlasRect.w;
      this._meshInstance.setParameter(PARAM_ATLAS_RECT, this._atlasRectUniform);
    } else {
      this._meshInstance._updateAabbFunc = null;
    }
    this._updateTransform();
  }
  _updateTransform() {
    // flip
    let scaleX = this.flipX ? -1 : 1;
    let scaleY = this.flipY ? -1 : 1;

    // pivot
    let posX = 0;
    let posY = 0;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      let w = 1;
      let h = 1;
      if (this.sprite.atlas) {
        const frameData = this.sprite.atlas.frames[this.sprite.frameKeys[this.frame]];
        if (frameData) {
          // get frame dimensions
          w = frameData.rect.z;
          h = frameData.rect.w;

          // update pivot
          posX = (0.5 - frameData.pivot.x) * this._width;
          posY = (0.5 - frameData.pivot.y) * this._height;
        }
      }

      // scale: apply PPU
      const scaleMulX = w / this.sprite.pixelsPerUnit;
      const scaleMulY = h / this.sprite.pixelsPerUnit;

      // scale borders if necessary instead of overlapping
      this._outerScale.set(Math.max(this._width, this._innerOffset.x * scaleMulX), Math.max(this._height, this._innerOffset.y * scaleMulY));
      scaleX *= scaleMulX;
      scaleY *= scaleMulY;
      this._outerScale.x /= scaleMulX;
      this._outerScale.y /= scaleMulY;

      // scale: shrinking below 1
      scaleX *= math.clamp(this._width / (this._innerOffset.x * scaleMulX), 0.0001, 1);
      scaleY *= math.clamp(this._height / (this._innerOffset.y * scaleMulY), 0.0001, 1);

      // update outer scale
      if (this._meshInstance) {
        this._outerScaleUniform[0] = this._outerScale.x;
        this._outerScaleUniform[1] = this._outerScale.y;
        this._meshInstance.setParameter(PARAM_OUTER_SCALE, this._outerScaleUniform);
      }
    }

    // scale
    this._node.setLocalScale(scaleX, scaleY, 1);
    // pivot
    this._node.setLocalPosition(posX, posY, 0);
  }

  // updates AABB while 9-slicing
  _updateAabb(aabb) {
    // pivot
    aabb.center.set(0, 0, 0);
    // size
    aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
    // world transform
    aabb.setFromTransformedAabb(aabb, this._node.getWorldTransform());
    return aabb;
  }
  _tryAutoPlay() {
    if (!this._autoPlayClip) return;
    if (this.type !== SPRITETYPE_ANIMATED) return;
    const clip = this._clips[this._autoPlayClip];
    // if the clip exists and nothing else is playing play it
    if (clip && !clip.isPlaying && (!this._currentClip || !this._currentClip.isPlaying)) {
      if (this.enabled && this.entity.enabled) {
        this.play(clip.name);
      }
    }
  }
  _onLayersChanged(oldComp, newComp) {
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
    if (this.enabled && this.entity.enabled) {
      this._showModel();
    }
  }
  _onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._addedModel && this.enabled && this.entity.enabled && this._meshInstance) {
      layer.addMeshInstances([this._meshInstance]);
    }
  }
  _onLayerRemoved(layer) {
    if (!this._meshInstance) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances([this._meshInstance]);
  }
  removeModelFromLayers() {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this._meshInstance]);
    }
  }

  /**
   * Creates and adds a new {@link SpriteAnimationClip} to the component's clips.
   *
   * @param {object} data - Data for the new animation clip.
   * @param {string} [data.name] - The name of the new animation clip.
   * @param {number} [data.fps] - Frames per second for the animation clip.
   * @param {boolean} [data.loop] - Whether to loop the animation clip.
   * @param {number|import('../../asset/asset.js').Asset} [data.spriteAsset] - The asset id or
   * the {@link Asset} of the sprite that this clip will play.
   * @returns {SpriteAnimationClip} The new clip that was added.
   */
  addClip(data) {
    const clip = new SpriteAnimationClip(this, {
      name: data.name,
      fps: data.fps,
      loop: data.loop,
      spriteAsset: data.spriteAsset
    });
    this._clips[data.name] = clip;
    if (clip.name && clip.name === this._autoPlayClip) this._tryAutoPlay();
    return clip;
  }

  /**
   * Removes a clip by name.
   *
   * @param {string} name - The name of the animation clip to remove.
   */
  removeClip(name) {
    delete this._clips[name];
  }

  /**
   * Get an animation clip by name.
   *
   * @param {string} name - The name of the clip.
   * @returns {SpriteAnimationClip} The clip.
   */
  clip(name) {
    return this._clips[name];
  }

  /**
   * Plays a sprite animation clip by name. If the animation clip is already playing then this
   * will do nothing.
   *
   * @param {string} name - The name of the clip to play.
   * @returns {SpriteAnimationClip} The clip that started playing.
   */
  play(name) {
    const clip = this._clips[name];
    const current = this._currentClip;
    if (current && current !== clip) {
      current._playing = false;
    }
    this._currentClip = clip;
    if (this._currentClip) {
      this._currentClip = clip;
      this._currentClip.play();
    } else {
      Debug.warn(`Trying to play sprite animation ${name} which does not exist.`);
    }
    return clip;
  }

  /**
   * Pauses the current animation clip.
   */
  pause() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPlaying) {
      this._currentClip.pause();
    }
  }

  /**
   * Resumes the current paused animation clip.
   */
  resume() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPaused) {
      this._currentClip.resume();
    }
  }

  /**
   * Stops the current animation clip and resets it to the first frame.
   */
  stop() {
    if (this._currentClip === this._defaultClip) return;
    this._currentClip.stop();
  }
}
/**
 * Fired when an animation clip starts playing. The handler is passed the
 * {@link SpriteAnimationClip} that started playing.
 *
 * @event
 * @example
 * entity.sprite.on('play', (clip) => {
 *     console.log(`Animation clip ${clip.name} started playing.`);
 * });
 */
SpriteComponent.EVENT_PLAY = 'play';
/**
 * Fired when an animation clip is paused. The handler is passed the
 * {@link SpriteAnimationClip} that was paused.
 *
 * @event
 * @example
 * entity.sprite.on('pause', (clip) => {
 *     console.log(`Animation clip ${clip.name} paused.`);
 * });
 */
SpriteComponent.EVENT_PAUSE = 'pause';
/**
 * Fired when an animation clip is resumed. The handler is passed the
 * {@link SpriteAnimationClip} that was resumed.
 *
 * @event
 * @example
 * entity.sprite.on('resume', (clip) => {
 *     console.log(`Animation clip ${clip.name} resumed.`);
 * });
 */
SpriteComponent.EVENT_RESUME = 'resume';
/**
 * Fired when an animation clip is stopped. The handler is passed the
 * {@link SpriteAnimationClip} that was stopped.
 *
 * @event
 * @example
 * entity.sprite.on('stop', (clip) => {
 *     console.log(`Animation clip ${clip.name} stopped.`);
 * });
 */
SpriteComponent.EVENT_STOP = 'stop';
/**
 * Fired when an animation clip stops playing because it reached its end. The handler is passed
 * the {@link SpriteAnimationClip} that ended.
 *
 * @event
 * @example
 * entity.sprite.on('end', (clip) => {
 *     console.log(`Animation clip ${clip.name} ended.`);
 * });
 */
SpriteComponent.EVENT_END = 'end';
/**
 * Fired when an animation clip reached the end of its current loop. The handler is passed the
 * {@link SpriteAnimationClip} that looped.
 *
 * @event
 * @example
 * entity.sprite.on('loop', (clip) => {
 *     console.log(`Animation clip ${clip.name} looped.`);
 * });
 */
SpriteComponent.EVENT_LOOP = 'loop';

export { SpriteComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVUWVBFX1NJTVBMRSwgU1BSSVRFVFlQRV9BTklNQVRFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNwcml0ZUFuaW1hdGlvbkNsaXAgfSBmcm9tICcuL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyc7XG5cbmNvbnN0IFBBUkFNX0VNSVNTSVZFX01BUCA9ICd0ZXh0dXJlX2VtaXNzaXZlTWFwJztcbmNvbnN0IFBBUkFNX09QQUNJVFlfTUFQID0gJ3RleHR1cmVfb3BhY2l0eU1hcCc7XG5jb25zdCBQQVJBTV9FTUlTU0lWRSA9ICdtYXRlcmlhbF9lbWlzc2l2ZSc7XG5jb25zdCBQQVJBTV9PUEFDSVRZID0gJ21hdGVyaWFsX29wYWNpdHknO1xuY29uc3QgUEFSQU1fSU5ORVJfT0ZGU0VUID0gJ2lubmVyT2Zmc2V0JztcbmNvbnN0IFBBUkFNX09VVEVSX1NDQUxFID0gJ291dGVyU2NhbGUnO1xuY29uc3QgUEFSQU1fQVRMQVNfUkVDVCA9ICdhdGxhc1JlY3QnO1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIHNpbXBsZSBzdGF0aWMgc3ByaXRlIG9yIHNwcml0ZSBhbmltYXRpb25zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5jbGFzcyBTcHJpdGVDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgc3RhcnRzIHBsYXlpbmcuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGVcbiAgICAgKiB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH0gdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zcHJpdGUub24oJ3BsYXknLCAoY2xpcCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQW5pbWF0aW9uIGNsaXAgJHtjbGlwLm5hbWV9IHN0YXJ0ZWQgcGxheWluZy5gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUExBWSA9ICdwbGF5JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgaXMgcGF1c2VkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFNwcml0ZUFuaW1hdGlvbkNsaXB9IHRoYXQgd2FzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNwcml0ZS5vbigncGF1c2UnLCAoY2xpcCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQW5pbWF0aW9uIGNsaXAgJHtjbGlwLm5hbWV9IHBhdXNlZC5gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUEFVU0UgPSAncGF1c2UnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBpcyByZXN1bWVkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICoge0BsaW5rIFNwcml0ZUFuaW1hdGlvbkNsaXB9IHRoYXQgd2FzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zcHJpdGUub24oJ3Jlc3VtZScsIChjbGlwKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBBbmltYXRpb24gY2xpcCAke2NsaXAubmFtZX0gcmVzdW1lZC5gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVTVU1FID0gJ3Jlc3VtZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHN0b3BwZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGVcbiAgICAgKiB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH0gdGhhdCB3YXMgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNwcml0ZS5vbignc3RvcCcsIChjbGlwKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBBbmltYXRpb24gY2xpcCAke2NsaXAubmFtZX0gc3RvcHBlZC5gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1RPUCA9ICdzdG9wJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgc3RvcHMgcGxheWluZyBiZWNhdXNlIGl0IHJlYWNoZWQgaXRzIGVuZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkXG4gICAgICogdGhlIHtAbGluayBTcHJpdGVBbmltYXRpb25DbGlwfSB0aGF0IGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc3ByaXRlLm9uKCdlbmQnLCAoY2xpcCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQW5pbWF0aW9uIGNsaXAgJHtjbGlwLm5hbWV9IGVuZGVkLmApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9FTkQgPSAnZW5kJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgcmVhY2hlZCB0aGUgZW5kIG9mIGl0cyBjdXJyZW50IGxvb3AuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGVcbiAgICAgKiB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH0gdGhhdCBsb29wZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zcHJpdGUub24oJ2xvb3AnLCAoY2xpcCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgQW5pbWF0aW9uIGNsaXAgJHtjbGlwLm5hbWV9IGxvb3BlZC5gKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfTE9PUCA9ICdsb29wJztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTcHJpdGVDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5TcHJpdGVDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSBTUFJJVEVUWVBFX1NJTVBMRTtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBzeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5fc3BlZWQgPSAxO1xuICAgICAgICB0aGlzLl9mbGlwWCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mbGlwWSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl93aWR0aCA9IDE7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IDE7XG5cbiAgICAgICAgdGhpcy5fZHJhd09yZGVyID0gMDtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW0xBWUVSSURfV09STERdOyAvLyBhc3NpZ24gdG8gdGhlIGRlZmF1bHQgd29ybGQgbGF5ZXJcblxuICAgICAgICAvLyA5LXNsaWNpbmdcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZSA9IG5ldyBWZWMyKDEsIDEpO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgLy8gYmF0Y2ggZ3JvdXBzXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwID0gbnVsbDtcblxuICAgICAgICAvLyBub2RlIC8gbWVzaCBpbnN0YW5jZVxuICAgICAgICB0aGlzLl9ub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICB0aGlzLl9tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5ncmFwaCA9IHRoaXMuX25vZGU7XG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIGVudGl0eS5hZGRDaGlsZCh0aGlzLl9tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMuX21vZGVsLl9lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYi5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSBmYWxzZTtcblxuICAgICAgICAvLyBhbmltYXRlZCBzcHJpdGVzXG4gICAgICAgIHRoaXMuX2F1dG9QbGF5Q2xpcCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERpY3Rpb25hcnkgb2Ygc3ByaXRlIGFuaW1hdGlvbiBjbGlwcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNwcml0ZUFuaW1hdGlvbkNsaXA+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xpcHMgPSB7fTtcblxuICAgICAgICAvLyBjcmVhdGUgZGVmYXVsdCBjbGlwIGZvciBzaW1wbGUgc3ByaXRlIHR5cGVcbiAgICAgICAgdGhpcy5fZGVmYXVsdENsaXAgPSBuZXcgU3ByaXRlQW5pbWF0aW9uQ2xpcCh0aGlzLCB7XG4gICAgICAgICAgICBuYW1lOiB0aGlzLmVudGl0eS5uYW1lLFxuICAgICAgICAgICAgZnBzOiAwLFxuICAgICAgICAgICAgbG9vcDogZmFsc2UsXG4gICAgICAgICAgICBzcHJpdGVBc3NldDogbnVsbFxuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNwcml0ZSBhbmltYXRpb24gY2xpcCBjdXJyZW50bHkgcGxheWluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1Nwcml0ZUFuaW1hdGlvbkNsaXB9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IHRoaXMuX2RlZmF1bHRDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSBTcHJpdGVDb21wb25lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfTogVGhlIGNvbXBvbmVudCByZW5kZXJzIGEgc2luZ2xlIGZyYW1lIGZyb20gYSBzcHJpdGUgYXNzZXQuXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9BTklNQVRFRH06IFRoZSBjb21wb25lbnQgY2FuIHBsYXkgc3ByaXRlIGFuaW1hdGlvbiBjbGlwcy5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBTUFJJVEVUWVBFX1NJTVBMRSkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IHRoaXMuX2RlZmF1bHRDbGlwO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5mcmFtZSA9IHRoaXMuZnJhbWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuc3ByaXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfQU5JTUFURUQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b1BsYXlDbGlwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwICYmIHRoaXMuX2N1cnJlbnRDbGlwLmlzUGxheWluZyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJhbWUgY291bnRlciBvZiB0aGUgc3ByaXRlLiBTcGVjaWZpZXMgd2hpY2ggZnJhbWUgZnJvbSB0aGUgY3VycmVudCBzcHJpdGUgYXNzZXQgdG9cbiAgICAgKiByZW5kZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmFtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5mcmFtZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZCBvciB0aGUge0BsaW5rIEFzc2V0fSBvZiB0aGUgc3ByaXRlIHRvIHJlbmRlci4gT25seSB3b3JrcyBmb3JcbiAgICAgKiB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9IHNwcml0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfGltcG9ydCgnLi4vLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH1cbiAgICAgKi9cbiAgICBzZXQgc3ByaXRlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGVmYXVsdENsaXAuc3ByaXRlQXNzZXQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0Q2xpcC5fc3ByaXRlQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvc3ByaXRlLmpzJykuU3ByaXRlfVxuICAgICAqL1xuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZTtcbiAgICB9XG5cbiAgICAvLyAocHJpdmF0ZSkge3BjLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdXNlZCB0byByZW5kZXIgYSBzcHJpdGUuXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHRpbnQgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuciA9IHZhbHVlLnI7XG4gICAgICAgIHRoaXMuX2NvbG9yLmcgPSB2YWx1ZS5nO1xuICAgICAgICB0aGlzLl9jb2xvci5iID0gdmFsdWUuYjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wYWNpdHkgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuYSA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3IuYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBjb250YWlucyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH1zLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNwcml0ZUFuaW1hdGlvbkNsaXA+fVxuICAgICAqL1xuICAgIHNldCBjbGlwcyh2YWx1ZSkge1xuICAgICAgICAvLyBpZiB2YWx1ZSBpcyBudWxsIHJlbW92ZSBhbGwgY2xpcHNcbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGNsaXBzIG5vdCBpbiBuZXcgdmFsdWVcbiAgICAgICAgLy8gYW5kIHVwZGF0ZSBjbGlwcyBpbiBib3RoIG9iamVjdHNcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmZwcyA9IHZhbHVlW2tleV0uZnBzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5sb29wID0gdmFsdWVba2V5XS5sb29wO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlID0gdmFsdWVba2V5XS5zcHJpdGU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVba2V5XS5oYXNPd25Qcm9wZXJ0eSgnc3ByaXRlQXNzZXQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlQXNzZXQgPSB2YWx1ZVtrZXldLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGNsaXBzIHRoYXQgZG8gbm90IGV4aXN0XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2xpcHNbdmFsdWVba2V5XS5uYW1lXSkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuYWRkQ2xpcCh2YWx1ZVtrZXldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF1dG8gcGxheSBjbGlwXG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgY3VycmVudCBjbGlwIGRvZXNuJ3QgaGF2ZSBhIHNwcml0ZSB0aGVuIGhpZGUgdGhlIG1vZGVsXG4gICAgICAgIGlmICghdGhpcy5fY3VycmVudENsaXAgfHwgIXRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2xpcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBjbGlwIGJlaW5nIHBsYXllZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAqL1xuICAgIGdldCBjdXJyZW50Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZ2xvYmFsIHNwZWVkIG1vZGlmaWVyIHVzZWQgd2hlbiBwbGF5aW5nIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzcGVlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zcGVlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwZWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsaXAgdGhlIFggYXhpcyB3aGVuIHJlbmRlcmluZyBhIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFggPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmxpcFggPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWSBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSB3aGVuIHJlbmRlcmluZyB1c2luZyA5LVNsaWNpbmcuIFRoZSB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBvbmx5IHVzZWRcbiAgICAgKiB3aGVuIHRoZSByZW5kZXIgbW9kZSBvZiB0aGUgc3ByaXRlIGFzc2V0IGlzIFNsaWNlZCBvciBUaWxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHdpZHRoKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fd2lkdGgpIHJldHVybjtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggPSB0aGlzLl93aWR0aDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5faGVpZ2h0KSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueSA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBzcHJpdGUgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBwcmV2ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5TUFJJVEUsIHByZXYsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB2YWx1ZSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmUtYWRkIG1vZGVsIHRvIHNjZW5lIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmIChwcmV2ID49IDApIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheSBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkIGFuZCB0aGUgY2xpcCBleGlzdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheUNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXlDbGlwID0gdmFsdWUgaW5zdGFuY2VvZiBTcHJpdGVBbmltYXRpb25DbGlwID8gdmFsdWUubmFtZSA6IHZhbHVlO1xuICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheUNsaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvUGxheUNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRyYXcgb3JkZXIgb2YgdGhlIGNvbXBvbmVudC4gQSBoaWdoZXIgdmFsdWUgbWVhbnMgdGhhdCB0aGUgY29tcG9uZW50IHdpbGwgYmUgcmVuZGVyZWQgb25cbiAgICAgKiB0b3Agb2Ygb3RoZXIgY29tcG9uZW50cyBpbiB0aGUgc2FtZSBsYXllci4gVGhpcyBpcyBub3QgdXNlZCB1bmxlc3MgdGhlIGxheWVyJ3Mgc29ydCBvcmRlciBpc1xuICAgICAqIHNldCB0byB7QGxpbmsgU09SVE1PREVfTUFOVUFMfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRyYXdPcmRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYXdPcmRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgc3ByaXRlIHNob3VsZCBiZWxvbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICAvLyBlYXJseSBvdXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbWVzaEluc3RhbmNlLmFhYmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMuX29uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcblxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwLl9kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsaXBzW2tleV0uX2Rlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGlwcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9ub2RlPy5yZW1vdmUoKTtcbiAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGRlY3JlYXNlIHRoZSByZWYgY291bnRzIG1hdGVyaWFscyBhbmQgbWVzaGVzXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1lc2ggPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zaG93TW9kZWwoKSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRlZE1vZGVsKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IFt0aGlzLl9tZXNoSW5zdGFuY2VdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBfaGlkZU1vZGVsKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2FkZGVkTW9kZWwgfHwgIXRoaXMuX21lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbdGhpcy5fbWVzaEluc3RhbmNlXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFNldCB0aGUgZGVzaXJlZCBtZXNoIG9uIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgX3Nob3dGcmFtZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuc3ByaXRlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaCA9IHRoaXMuc3ByaXRlLm1lc2hlc1tmcmFtZV07XG4gICAgICAgIC8vIGlmIG1lc2ggaXMgbnVsbCB0aGVuIGhpZGUgdGhlIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgaWYgKCFtZXNoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1lc2ggPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtYXRlcmlhbDtcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0OVNsaWNlZE1hdGVyaWFsU2xpY2VkTW9kZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0OVNsaWNlZE1hdGVyaWFsVGlsZWRNb2RlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbWVzaCBpbnN0YW5jZSBpZiBpdCBkb2Vzbid0IGV4aXN0IHlldFxuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCB0aGlzLl9tYXRlcmlhbCwgdGhpcy5fbm9kZSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnJlY2VpdmVTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSB0aGlzLl9kcmF3T3JkZXI7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLnB1c2godGhpcy5fbWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgLy8gc2V0IG92ZXJyaWRlcyBvbiBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9PUEFDSVRZLCB0aGlzLl9jb2xvci5hKTtcblxuICAgICAgICAgICAgLy8gbm93IHRoYXQgd2UgY3JlYXRlZCB0aGUgbWVzaCBpbnN0YW5jZSwgYWRkIHRoZSBtb2RlbCB0byB0aGUgc2NlbmVcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1hdGVyaWFsXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UubWF0ZXJpYWwgIT09IG1hdGVyaWFsKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtZXNoXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCAhPT0gbWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgLy8gcmVzZXQgYWFiYlxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLmF0bGFzICYmIHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmUpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkVfTUFQLCB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWV9NQVAsIHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gdGV4dHVyZSBzbyByZXNldCB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRlbGV0ZVBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRV9NQVApO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRlbGV0ZVBhcmFtZXRlcihQQVJBTV9PUEFDSVRZX01BUCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgOS1zbGljZWRcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLmF0bGFzICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG4gICAgICAgICAgICAvLyBzZXQgY3VzdG9tIGFhYmIgZnVuY3Rpb25cbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSB0aGlzLl91cGRhdGVBYWJiRnVuYztcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGlubmVyIG9mZnNldFxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuc3ByaXRlLmZyYW1lS2V5c1tmcmFtZV1dO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvcmRlcldpZHRoU2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QuejtcbiAgICAgICAgICAgICAgICBjb25zdCBib3JkZXJIZWlnaHRTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC53O1xuXG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQuc2V0KFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnggKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnkgKiBib3JkZXJIZWlnaHRTY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci56ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci53ICogYm9yZGVySGVpZ2h0U2NhbGVcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3Quc2V0KGZyYW1lRGF0YS5yZWN0LnggLyB0ZXgud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC55IC8gdGV4LmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnogLyB0ZXgud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC53IC8gdGV4LmhlaWdodFxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQuc2V0KDAsIDAsIDAsIDApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgaW5uZXIgb2Zmc2V0IGFuZCBhdGxhcyByZWN0IG9uIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVswXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lng7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMV0gPSB0aGlzLl9pbm5lck9mZnNldC55O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzJdID0gdGhpcy5faW5uZXJPZmZzZXQuejtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVszXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnc7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0lOTkVSX09GRlNFVCwgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtKTtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMF0gPSB0aGlzLl9hdGxhc1JlY3QueDtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMV0gPSB0aGlzLl9hdGxhc1JlY3QueTtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMl0gPSB0aGlzLl9hdGxhc1JlY3QuejtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bM10gPSB0aGlzLl9hdGxhc1JlY3QudztcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fQVRMQVNfUkVDVCwgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIF91cGRhdGVUcmFuc2Zvcm0oKSB7XG4gICAgICAgIC8vIGZsaXBcbiAgICAgICAgbGV0IHNjYWxlWCA9IHRoaXMuZmxpcFggPyAtMSA6IDE7XG4gICAgICAgIGxldCBzY2FsZVkgPSB0aGlzLmZsaXBZID8gLTEgOiAxO1xuXG4gICAgICAgIC8vIHBpdm90XG4gICAgICAgIGxldCBwb3NYID0gMDtcbiAgICAgICAgbGV0IHBvc1kgPSAwO1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSkge1xuXG4gICAgICAgICAgICBsZXQgdyA9IDE7XG4gICAgICAgICAgICBsZXQgaCA9IDE7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLnNwcml0ZS5mcmFtZUtleXNbdGhpcy5mcmFtZV1dO1xuICAgICAgICAgICAgICAgIGlmIChmcmFtZURhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IGZyYW1lIGRpbWVuc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgdyA9IGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICAgICAgICAgIGggPSBmcmFtZURhdGEucmVjdC53O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBwaXZvdFxuICAgICAgICAgICAgICAgICAgICBwb3NYID0gKDAuNSAtIGZyYW1lRGF0YS5waXZvdC54KSAqIHRoaXMuX3dpZHRoO1xuICAgICAgICAgICAgICAgICAgICBwb3NZID0gKDAuNSAtIGZyYW1lRGF0YS5waXZvdC55KSAqIHRoaXMuX2hlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNjYWxlOiBhcHBseSBQUFVcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWCA9IHcgLyB0aGlzLnNwcml0ZS5waXhlbHNQZXJVbml0O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxZID0gaCAvIHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlIGJvcmRlcnMgaWYgbmVjZXNzYXJ5IGluc3RlYWQgb2Ygb3ZlcmxhcHBpbmdcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUuc2V0KE1hdGgubWF4KHRoaXMuX3dpZHRoLCB0aGlzLl9pbm5lck9mZnNldC54ICogc2NhbGVNdWxYKSwgTWF0aC5tYXgodGhpcy5faGVpZ2h0LCB0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSk7XG5cbiAgICAgICAgICAgIHNjYWxlWCAqPSBzY2FsZU11bFg7XG4gICAgICAgICAgICBzY2FsZVkgKj0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggLz0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS55IC89IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgLy8gc2NhbGU6IHNocmlua2luZyBiZWxvdyAxXG4gICAgICAgICAgICBzY2FsZVggKj0gbWF0aC5jbGFtcCh0aGlzLl93aWR0aCAvICh0aGlzLl9pbm5lck9mZnNldC54ICogc2NhbGVNdWxYKSwgMC4wMDAxLCAxKTtcbiAgICAgICAgICAgIHNjYWxlWSAqPSBtYXRoLmNsYW1wKHRoaXMuX2hlaWdodCAvICh0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSwgMC4wMDAxLCAxKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG91dGVyIHNjYWxlXG4gICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMF0gPSB0aGlzLl9vdXRlclNjYWxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMV0gPSB0aGlzLl9vdXRlclNjYWxlLnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9PVVRFUl9TQ0FMRSwgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2NhbGVcbiAgICAgICAgdGhpcy5fbm9kZS5zZXRMb2NhbFNjYWxlKHNjYWxlWCwgc2NhbGVZLCAxKTtcbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgdGhpcy5fbm9kZS5zZXRMb2NhbFBvc2l0aW9uKHBvc1gsIHBvc1ksIDApO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgQUFCQiB3aGlsZSA5LXNsaWNpbmdcbiAgICBfdXBkYXRlQWFiYihhYWJiKSB7XG4gICAgICAgIC8vIHBpdm90XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgLy8gc2l6ZVxuICAgICAgICBhYWJiLmhhbGZFeHRlbnRzLnNldCh0aGlzLl9vdXRlclNjYWxlLnggKiAwLjUsIHRoaXMuX291dGVyU2NhbGUueSAqIDAuNSwgMC4wMDEpO1xuICAgICAgICAvLyB3b3JsZCB0cmFuc2Zvcm1cbiAgICAgICAgYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIHRoaXMuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIHJldHVybiBhYWJiO1xuICAgIH1cblxuICAgIF90cnlBdXRvUGxheSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdXRvUGxheUNsaXApIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gU1BSSVRFVFlQRV9BTklNQVRFRCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLl9jbGlwc1t0aGlzLl9hdXRvUGxheUNsaXBdO1xuICAgICAgICAvLyBpZiB0aGUgY2xpcCBleGlzdHMgYW5kIG5vdGhpbmcgZWxzZSBpcyBwbGF5aW5nIHBsYXkgaXRcbiAgICAgICAgaWYgKGNsaXAgJiYgIWNsaXAuaXNQbGF5aW5nICYmICghdGhpcy5fY3VycmVudENsaXAgfHwgIXRoaXMuX2N1cnJlbnRDbGlwLmlzUGxheWluZykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMucGxheShjbGlwLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcblxuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWwgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5fbWVzaEluc3RhbmNlXSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5fbWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCBhZGRzIGEgbmV3IHtAbGluayBTcHJpdGVBbmltYXRpb25DbGlwfSB0byB0aGUgY29tcG9uZW50J3MgY2xpcHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIERhdGEgZm9yIHRoZSBuZXcgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtkYXRhLm5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIG5ldyBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2RhdGEuZnBzXSAtIEZyYW1lcyBwZXIgc2Vjb25kIGZvciB0aGUgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGF0YS5sb29wXSAtIFdoZXRoZXIgdG8gbG9vcCB0aGUgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbZGF0YS5zcHJpdGVBc3NldF0gLSBUaGUgYXNzZXQgaWQgb3JcbiAgICAgKiB0aGUge0BsaW5rIEFzc2V0fSBvZiB0aGUgc3ByaXRlIHRoYXQgdGhpcyBjbGlwIHdpbGwgcGxheS5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIG5ldyBjbGlwIHRoYXQgd2FzIGFkZGVkLlxuICAgICAqL1xuICAgIGFkZENsaXAoZGF0YSkge1xuICAgICAgICBjb25zdCBjbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogZGF0YS5uYW1lLFxuICAgICAgICAgICAgZnBzOiBkYXRhLmZwcyxcbiAgICAgICAgICAgIGxvb3A6IGRhdGEubG9vcCxcbiAgICAgICAgICAgIHNwcml0ZUFzc2V0OiBkYXRhLnNwcml0ZUFzc2V0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX2NsaXBzW2RhdGEubmFtZV0gPSBjbGlwO1xuXG4gICAgICAgIGlmIChjbGlwLm5hbWUgJiYgY2xpcC5uYW1lID09PSB0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIHJldHVybiBjbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBjbGlwIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltYXRpb24gY2xpcCB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlQ2xpcChuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jbGlwc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYW4gYW5pbWF0aW9uIGNsaXAgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNsaXAuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBjbGlwLlxuICAgICAqL1xuICAgIGNsaXAobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpcHNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGxheXMgYSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgYnkgbmFtZS4gSWYgdGhlIGFuaW1hdGlvbiBjbGlwIGlzIGFscmVhZHkgcGxheWluZyB0aGVuIHRoaXNcbiAgICAgKiB3aWxsIGRvIG5vdGhpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjbGlwIHRvIHBsYXkuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBjbGlwIHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqL1xuICAgIHBsYXkobmFtZSkge1xuICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5fY2xpcHNbbmFtZV07XG5cbiAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgICAgICBpZiAoY3VycmVudCAmJiBjdXJyZW50ICE9PSBjbGlwKSB7XG4gICAgICAgICAgICBjdXJyZW50Ll9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IGNsaXA7XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IGNsaXA7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5wbGF5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBzcHJpdGUgYW5pbWF0aW9uICR7bmFtZX0gd2hpY2ggZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIGNsaXAuXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyB0aGUgY3VycmVudCBwYXVzZWQgYW5pbWF0aW9uIGNsaXAuXG4gICAgICovXG4gICAgcmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwLmlzUGF1c2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5yZXN1bWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHRoZSBjdXJyZW50IGFuaW1hdGlvbiBjbGlwIGFuZCByZXNldHMgaXQgdG8gdGhlIGZpcnN0IGZyYW1lLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5zdG9wKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTcHJpdGVDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJQQVJBTV9FTUlTU0lWRV9NQVAiLCJQQVJBTV9PUEFDSVRZX01BUCIsIlBBUkFNX0VNSVNTSVZFIiwiUEFSQU1fT1BBQ0lUWSIsIlBBUkFNX0lOTkVSX09GRlNFVCIsIlBBUkFNX09VVEVSX1NDQUxFIiwiUEFSQU1fQVRMQVNfUkVDVCIsIlNwcml0ZUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3R5cGUiLCJTUFJJVEVUWVBFX1NJTVBMRSIsIl9tYXRlcmlhbCIsImRlZmF1bHRNYXRlcmlhbCIsIl9jb2xvciIsIkNvbG9yIiwiX2NvbG9yVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9zcGVlZCIsIl9mbGlwWCIsIl9mbGlwWSIsIl93aWR0aCIsIl9oZWlnaHQiLCJfZHJhd09yZGVyIiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJfb3V0ZXJTY2FsZSIsIlZlYzIiLCJfb3V0ZXJTY2FsZVVuaWZvcm0iLCJfaW5uZXJPZmZzZXQiLCJWZWM0IiwiX2lubmVyT2Zmc2V0VW5pZm9ybSIsIl9hdGxhc1JlY3QiLCJfYXRsYXNSZWN0VW5pZm9ybSIsIl9iYXRjaEdyb3VwSWQiLCJfYmF0Y2hHcm91cCIsIl9ub2RlIiwiR3JhcGhOb2RlIiwiX21vZGVsIiwiTW9kZWwiLCJncmFwaCIsIl9tZXNoSW5zdGFuY2UiLCJhZGRDaGlsZCIsIl9lbnRpdHkiLCJfdXBkYXRlQWFiYkZ1bmMiLCJfdXBkYXRlQWFiYiIsImJpbmQiLCJfYWRkZWRNb2RlbCIsIl9hdXRvUGxheUNsaXAiLCJfY2xpcHMiLCJfZGVmYXVsdENsaXAiLCJTcHJpdGVBbmltYXRpb25DbGlwIiwibmFtZSIsImZwcyIsImxvb3AiLCJzcHJpdGVBc3NldCIsIl9jdXJyZW50Q2xpcCIsInR5cGUiLCJ2YWx1ZSIsInN0b3AiLCJlbmFibGVkIiwiZnJhbWUiLCJzcHJpdGUiLCJfc2hvd01vZGVsIiwiX2hpZGVNb2RlbCIsIlNQUklURVRZUEVfQU5JTUFURUQiLCJfdHJ5QXV0b1BsYXkiLCJpc1BsYXlpbmciLCJfc3ByaXRlQXNzZXQiLCJtYXRlcmlhbCIsImNvbG9yIiwiciIsImciLCJiIiwic2V0UGFyYW1ldGVyIiwib3BhY2l0eSIsImEiLCJjbGlwcyIsInJlbW92ZUNsaXAiLCJmb3VuZCIsImtleSIsImhhc093blByb3BlcnR5IiwiYWRkQ2xpcCIsImN1cnJlbnRDbGlwIiwic3BlZWQiLCJmbGlwWCIsIl91cGRhdGVUcmFuc2Zvcm0iLCJmbGlwWSIsIndpZHRoIiwieCIsInJlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsImhlaWdodCIsInkiLCJiYXRjaEdyb3VwSWQiLCJwcmV2IiwiX3RoaXMkc3lzdGVtJGFwcCRiYXRjIiwiYXBwIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJTUFJJVEUiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGMyIiwiaW5zZXJ0IiwiYXV0b1BsYXlDbGlwIiwiZHJhd09yZGVyIiwibGF5ZXJzIiwiYWFiYiIsIm9uRW5hYmxlIiwic2NlbmUiLCJvbiIsIl9vbkxheWVyc0NoYW5nZWQiLCJfb25MYXllckFkZGVkIiwiX29uTGF5ZXJSZW1vdmVkIiwiX2FwcCRiYXRjaGVyIiwib25EaXNhYmxlIiwib2ZmIiwiX2FwcCRiYXRjaGVyMiIsIm9uRGVzdHJveSIsIl90aGlzJF9ub2RlIiwiX2Rlc3Ryb3kiLCJtZXNoIiwibWVzaEluc3RhbmNlcyIsImkiLCJsZW4iLCJsZW5ndGgiLCJsYXllciIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwiX3Nob3dGcmFtZSIsIm1lc2hlcyIsInZpc2libGUiLCJkZWZhdWx0OVNsaWNlZE1hdGVyaWFsU2xpY2VkTW9kZSIsImRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxUaWxlZE1vZGUiLCJNZXNoSW5zdGFuY2UiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsInB1c2giLCJfYWFiYlZlciIsImF0bGFzIiwidGV4dHVyZSIsImRlbGV0ZVBhcmFtZXRlciIsImZyYW1lRGF0YSIsImZyYW1lcyIsImZyYW1lS2V5cyIsImJvcmRlcldpZHRoU2NhbGUiLCJyZWN0IiwieiIsImJvcmRlckhlaWdodFNjYWxlIiwidyIsInNldCIsImJvcmRlciIsInRleCIsInNjYWxlWCIsInNjYWxlWSIsInBvc1giLCJwb3NZIiwiaCIsInBpdm90Iiwic2NhbGVNdWxYIiwicGl4ZWxzUGVyVW5pdCIsInNjYWxlTXVsWSIsIk1hdGgiLCJtYXgiLCJtYXRoIiwiY2xhbXAiLCJzZXRMb2NhbFNjYWxlIiwic2V0TG9jYWxQb3NpdGlvbiIsImNlbnRlciIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2xpcCIsInBsYXkiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiaWQiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJkYXRhIiwiY3VycmVudCIsIl9wbGF5aW5nIiwiRGVidWciLCJ3YXJuIiwicGF1c2UiLCJyZXN1bWUiLCJpc1BhdXNlZCIsIkVWRU5UX1BMQVkiLCJFVkVOVF9QQVVTRSIsIkVWRU5UX1JFU1VNRSIsIkVWRU5UX1NUT1AiLCJFVkVOVF9FTkQiLCJFVkVOVF9MT09QIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQTtBQUNoRCxNQUFNQyxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQTtBQUM5QyxN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
