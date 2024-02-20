import { EventHandler } from '../../../core/event-handler.js';
import { math } from '../../../core/math/math.js';
import { Asset } from '../../asset/asset.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';

/**
 * Handles playing of sprite animations and loading of relevant sprite assets.
 *
 * @augments EventHandler
 * @category Graphics
 */
class SpriteAnimationClip extends EventHandler {
  /**
   * Create a new SpriteAnimationClip instance.
   *
   * @param {import('./component.js').SpriteComponent} component - The sprite component managing
   * this clip.
   * @param {object} data - Data for the new animation clip.
   * @param {number} [data.fps] - Frames per second for the animation clip.
   * @param {boolean} [data.loop] - Whether to loop the animation clip.
   * @param {string} [data.name] - The name of the new animation clip.
   * @param {number} [data.spriteAsset] - The id of the sprite asset that this clip will play.
   */
  constructor(component, data) {
    super();
    this._component = component;
    this._frame = 0;
    this._sprite = null;
    this._spriteAsset = null;
    this.spriteAsset = data.spriteAsset;
    this.name = data.name;
    this.fps = data.fps || 0;
    this.loop = data.loop || false;
    this._playing = false;
    this._paused = false;
    this._time = 0;
  }

  /**
   * The total duration of the animation in seconds.
   *
   * @type {number}
   */
  get duration() {
    if (this._sprite) {
      const fps = this.fps || Number.MIN_VALUE;
      return this._sprite.frameKeys.length / Math.abs(fps);
    }
    return 0;
  }

  /**
   * The index of the frame of the {@link Sprite} currently being rendered.
   *
   * @type {number}
   */
  set frame(value) {
    this._setFrame(value);

    // update time to start of frame
    const fps = this.fps || Number.MIN_VALUE;
    this._setTime(this._frame / fps);
  }
  get frame() {
    return this._frame;
  }

  /**
   * Whether the animation is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * Whether the animation is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    return this._playing;
  }

  /**
   * The current sprite used to play the animation.
   *
   * @type {import('../../../scene/sprite.js').Sprite}
   */
  set sprite(value) {
    if (this._sprite) {
      this._sprite.off('set:meshes', this._onSpriteMeshesChange, this);
      this._sprite.off('set:pixelsPerUnit', this._onSpritePpuChanged, this);
      this._sprite.off('set:atlas', this._onSpriteMeshesChange, this);
      if (this._sprite.atlas) {
        this._sprite.atlas.off('set:texture', this._onSpriteMeshesChange, this);
      }
    }
    this._sprite = value;
    if (this._sprite) {
      this._sprite.on('set:meshes', this._onSpriteMeshesChange, this);
      this._sprite.on('set:pixelsPerUnit', this._onSpritePpuChanged, this);
      this._sprite.on('set:atlas', this._onSpriteMeshesChange, this);
      if (this._sprite.atlas) {
        this._sprite.atlas.on('set:texture', this._onSpriteMeshesChange, this);
      }
    }
    if (this._component.currentClip === this) {
      let mi;

      // if we are clearing the sprite clear old mesh instance parameters
      if (!value || !value.atlas) {
        mi = this._component._meshInstance;
        if (mi) {
          mi.deleteParameter('texture_emissiveMap');
          mi.deleteParameter('texture_opacityMap');
        }
        this._component._hideModel();
      } else {
        // otherwise show sprite

        // update texture
        if (value.atlas.texture) {
          mi = this._component._meshInstance;
          if (mi) {
            mi.setParameter('texture_emissiveMap', value.atlas.texture);
            mi.setParameter('texture_opacityMap', value.atlas.texture);
          }
          if (this._component.enabled && this._component.entity.enabled) {
            this._component._showModel();
          }
        }

        // if we have a time then force update
        // frame based on the time (check if fps is not 0 otherwise time will be Infinity)

        /* eslint-disable no-self-assign */
        if (this.time && this.fps) {
          this.time = this.time;
        } else {
          // if we don't have a time
          // then force update frame counter
          this.frame = this.frame;
        }
        /* eslint-enable no-self-assign */
      }
    }
  }

  get sprite() {
    return this._sprite;
  }

  /**
   * The id of the sprite asset used to play the animation.
   *
   * @type {number}
   */
  set spriteAsset(value) {
    const assets = this._component.system.app.assets;
    let id = value;
    if (value instanceof Asset) {
      id = value.id;
    }
    if (this._spriteAsset !== id) {
      if (this._spriteAsset) {
        // clean old event listeners
        const prev = assets.get(this._spriteAsset);
        if (prev) {
          this._unbindSpriteAsset(prev);
        }
      }
      this._spriteAsset = id;

      // bind sprite asset
      if (this._spriteAsset) {
        const asset = assets.get(this._spriteAsset);
        if (!asset) {
          this.sprite = null;
          assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
        } else {
          this._bindSpriteAsset(asset);
        }
      } else {
        this.sprite = null;
      }
    }
  }
  get spriteAsset() {
    return this._spriteAsset;
  }

  /**
   * The current time of the animation in seconds.
   *
   * @type {number}
   */
  set time(value) {
    this._setTime(value);
    if (this._sprite) {
      this.frame = Math.min(this._sprite.frameKeys.length - 1, Math.floor(this._time * Math.abs(this.fps)));
    } else {
      this.frame = 0;
    }
  }
  get time() {
    return this._time;
  }

  // When sprite asset is added bind it
  _onSpriteAssetAdded(asset) {
    this._component.system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
    if (this._spriteAsset === asset.id) {
      this._bindSpriteAsset(asset);
    }
  }

  // Hook up event handlers on sprite asset
  _bindSpriteAsset(asset) {
    asset.on('load', this._onSpriteAssetLoad, this);
    asset.on('remove', this._onSpriteAssetRemove, this);
    if (asset.resource) {
      this._onSpriteAssetLoad(asset);
    } else {
      this._component.system.app.assets.load(asset);
    }
  }
  _unbindSpriteAsset(asset) {
    if (!asset) {
      return;
    }
    asset.off('load', this._onSpriteAssetLoad, this);
    asset.off('remove', this._onSpriteAssetRemove, this);

    // unbind atlas
    if (asset.resource && !asset.resource.atlas) {
      this._component.system.app.assets.off('load:' + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
    }
  }

  // When sprite asset is loaded make sure the texture atlas asset is loaded too
  // If so then set the sprite, otherwise wait for the atlas to be loaded first
  _onSpriteAssetLoad(asset) {
    if (!asset.resource) {
      this.sprite = null;
    } else {
      if (!asset.resource.atlas) {
        const atlasAssetId = asset.data.textureAtlasAsset;
        const assets = this._component.system.app.assets;
        assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
        assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
      } else {
        this.sprite = asset.resource;
      }
    }
  }

  // When atlas is loaded try to reset the sprite asset
  _onTextureAtlasLoad(atlasAsset) {
    const spriteAsset = this._spriteAsset;
    if (spriteAsset instanceof Asset) {
      this._onSpriteAssetLoad(spriteAsset);
    } else {
      this._onSpriteAssetLoad(this._component.system.app.assets.get(spriteAsset));
    }
  }
  _onSpriteAssetRemove(asset) {
    this.sprite = null;
  }

  // If the meshes are re-created make sure
  // we update them in the mesh instance
  _onSpriteMeshesChange() {
    if (this._component.currentClip === this) {
      this._component._showFrame(this.frame);
    }
  }

  // Update frame if ppu changes for 9-sliced sprites
  _onSpritePpuChanged() {
    if (this._component.currentClip === this) {
      if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE) {
        this._component._showFrame(this.frame);
      }
    }
  }

  /**
   * Advances the animation, looping if necessary.
   *
   * @param {number} dt - The delta time.
   * @private
   */
  _update(dt) {
    if (this.fps === 0) return;
    if (!this._playing || this._paused || !this._sprite) return;
    const dir = this.fps < 0 ? -1 : 1;
    const time = this._time + dt * this._component.speed * dir;
    const duration = this.duration;
    const end = time > duration || time < 0;
    this._setTime(time);
    let frame = this.frame;
    if (this._sprite) {
      frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
    } else {
      frame = 0;
    }
    if (frame !== this._frame) {
      this._setFrame(frame);
    }
    if (end) {
      if (this.loop) {
        this.fire('loop');
        this._component.fire('loop', this);
      } else {
        this._playing = false;
        this._paused = false;
        this.fire('end');
        this._component.fire('end', this);
      }
    }
  }
  _setTime(value) {
    this._time = value;
    const duration = this.duration;
    if (this._time < 0) {
      if (this.loop) {
        this._time = this._time % duration + duration;
      } else {
        this._time = 0;
      }
    } else if (this._time > duration) {
      if (this.loop) {
        this._time %= duration;
      } else {
        this._time = duration;
      }
    }
  }
  _setFrame(value) {
    if (this._sprite) {
      // clamp frame
      this._frame = math.clamp(value, 0, this._sprite.frameKeys.length - 1);
    } else {
      this._frame = value;
    }
    if (this._component.currentClip === this) {
      this._component._showFrame(this._frame);
    }
  }
  _destroy() {
    // cleanup events
    if (this._spriteAsset) {
      const assets = this._component.system.app.assets;
      this._unbindSpriteAsset(assets.get(this._spriteAsset));
    }

    // remove sprite
    if (this._sprite) {
      this.sprite = null;
    }

    // remove sprite asset
    if (this._spriteAsset) {
      this.spriteAsset = null;
    }
  }

  /**
   * Plays the animation. If it's already playing then this does nothing.
   */
  play() {
    if (this._playing) return;
    this._playing = true;
    this._paused = false;
    this.frame = 0;
    this.fire('play');
    this._component.fire('play', this);
  }

  /**
   * Pauses the animation.
   */
  pause() {
    if (!this._playing || this._paused) return;
    this._paused = true;
    this.fire('pause');
    this._component.fire('pause', this);
  }

  /**
   * Resumes the paused animation.
   */
  resume() {
    if (!this._paused) return;
    this._paused = false;
    this.fire('resume');
    this._component.fire('resume', this);
  }

  /**
   * Stops the animation and resets the animation to the first frame.
   */
  stop() {
    if (!this._playing) return;
    this._playing = false;
    this._paused = false;
    this._time = 0;
    this.frame = 0;
    this.fire('stop');
    this._component.fire('stop', this);
  }
}
/**
 * Fired when the clip starts playing.
 *
 * @event
 * @example
 * clip.on('play', () => {
 *     console.log('Clip started playing');
 * });
 */
SpriteAnimationClip.EVENT_PLAY = 'play';
/**
 * Fired when the clip is paused.
 *
 * @event
 * @example
 * clip.on('pause', () => {
 *     console.log('Clip paused');
 * });
 */
SpriteAnimationClip.EVENT_PAUSE = 'pause';
/**
 * Fired when the clip is resumed.
 *
 * @event
 * @example
 * clip.on('resume', () => {
 *     console.log('Clip resumed');
 * });
 */
SpriteAnimationClip.EVENT_RESUME = 'resume';
/**
 * Fired when the clip is stopped.
 *
 * @event
 * @example
 * clip.on('stop', () => {
 *     console.log('Clip stopped');
 * });
 */
SpriteAnimationClip.EVENT_STOP = 'stop';
/**
 * Fired when the clip stops playing because it reached its end.
 *
 * @event
 * @example
 * clip.on('end', () => {
 *     console.log('Clip ended');
 * });
 */
SpriteAnimationClip.EVENT_END = 'end';
/**
 * Fired when the clip reached the end of its current loop.
 *
 * @event
 * @example
 * clip.on('loop', () => {
 *     console.log('Clip looped');
 * });
 */
SpriteAnimationClip.EVENT_LOOP = 'loop';

export { SpriteAnimationClip };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ByaXRlLWFuaW1hdGlvbi1jbGlwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBIYW5kbGVzIHBsYXlpbmcgb2Ygc3ByaXRlIGFuaW1hdGlvbnMgYW5kIGxvYWRpbmcgb2YgcmVsZXZhbnQgc3ByaXRlIGFzc2V0cy5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgU3ByaXRlQW5pbWF0aW9uQ2xpcCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY2xpcCBzdGFydHMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY2xpcC5vbigncGxheScsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0NsaXAgc3RhcnRlZCBwbGF5aW5nJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1BMQVkgPSAncGxheSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjbGlwIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY2xpcC5vbigncGF1c2UnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdDbGlwIHBhdXNlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9QQVVTRSA9ICdwYXVzZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjbGlwIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNsaXAub24oJ3Jlc3VtZScsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0NsaXAgcmVzdW1lZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRVNVTUUgPSAncmVzdW1lJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGNsaXAgaXMgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY2xpcC5vbignc3RvcCcsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0NsaXAgc3RvcHBlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9TVE9QID0gJ3N0b3AnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY2xpcCBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjbGlwLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdDbGlwIGVuZGVkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VORCA9ICdlbmQnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY2xpcCByZWFjaGVkIHRoZSBlbmQgb2YgaXRzIGN1cnJlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogY2xpcC5vbignbG9vcCcsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0NsaXAgbG9vcGVkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0xPT1AgPSAnbG9vcCc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3ByaXRlQW5pbWF0aW9uQ2xpcCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2NvbXBvbmVudC5qcycpLlNwcml0ZUNvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIHNwcml0ZSBjb21wb25lbnQgbWFuYWdpbmdcbiAgICAgKiB0aGlzIGNsaXAuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBEYXRhIGZvciB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YS5mcHNdIC0gRnJhbWVzIHBlciBzZWNvbmQgZm9yIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkYXRhLmxvb3BdIC0gV2hldGhlciB0byBsb29wIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RhdGEubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YS5zcHJpdGVBc3NldF0gLSBUaGUgaWQgb2YgdGhlIHNwcml0ZSBhc3NldCB0aGF0IHRoaXMgY2xpcCB3aWxsIHBsYXkuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fY29tcG9uZW50ID0gY29tcG9uZW50O1xuXG4gICAgICAgIHRoaXMuX2ZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5fc3ByaXRlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gZGF0YS5zcHJpdGVBc3NldDtcblxuICAgICAgICB0aGlzLm5hbWUgPSBkYXRhLm5hbWU7XG4gICAgICAgIHRoaXMuZnBzID0gZGF0YS5mcHMgfHwgMDtcbiAgICAgICAgdGhpcy5sb29wID0gZGF0YS5sb29wIHx8IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcGF1c2VkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fdGltZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHRvdGFsIGR1cmF0aW9uIG9mIHRoZSBhbmltYXRpb24gaW4gc2Vjb25kcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICBjb25zdCBmcHMgPSB0aGlzLmZwcyB8fCBOdW1iZXIuTUlOX1ZBTFVFO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC8gTWF0aC5hYnMoZnBzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaW5kZXggb2YgdGhlIGZyYW1lIG9mIHRoZSB7QGxpbmsgU3ByaXRlfSBjdXJyZW50bHkgYmVpbmcgcmVuZGVyZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmFtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zZXRGcmFtZSh2YWx1ZSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRpbWUgdG8gc3RhcnQgb2YgZnJhbWVcbiAgICAgICAgY29uc3QgZnBzID0gdGhpcy5mcHMgfHwgTnVtYmVyLk1JTl9WQUxVRTtcbiAgICAgICAgdGhpcy5fc2V0VGltZSh0aGlzLl9mcmFtZSAvIGZwcyk7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJhbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgYW5pbWF0aW9uIGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQYXVzZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXVzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgYW5pbWF0aW9uIGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BsYXlpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgc3ByaXRlIHVzZWQgdG8gcGxheSB0aGUgYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvc3ByaXRlLmpzJykuU3ByaXRlfVxuICAgICAqL1xuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5vZmYoJ3NldDpwaXhlbHNQZXJVbml0JywgdGhpcy5fb25TcHJpdGVQcHVDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5vZmYoJ3NldDphdGxhcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zcHJpdGUuYXRsYXMub2ZmKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Nwcml0ZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5vbignc2V0OnBpeGVsc1BlclVuaXQnLCB0aGlzLl9vblNwcml0ZVBwdUNoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9uKCdzZXQ6YXRsYXMnLCB0aGlzLl9vblNwcml0ZU1lc2hlc0NoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zcHJpdGUuYXRsYXMub24oJ3NldDp0ZXh0dXJlJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudC5jdXJyZW50Q2xpcCA9PT0gdGhpcykge1xuICAgICAgICAgICAgbGV0IG1pO1xuXG4gICAgICAgICAgICAvLyBpZiB3ZSBhcmUgY2xlYXJpbmcgdGhlIHNwcml0ZSBjbGVhciBvbGQgbWVzaCBpbnN0YW5jZSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICBpZiAoIXZhbHVlIHx8ICF2YWx1ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIG1pID0gdGhpcy5fY29tcG9uZW50Ll9tZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgICAgICAgICBtaS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5faGlkZU1vZGVsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBzaG93IHNwcml0ZVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIHRleHR1cmVcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICBtaSA9IHRoaXMuX2NvbXBvbmVudC5fbWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHZhbHVlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB2YWx1ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jb21wb25lbnQuZW5hYmxlZCAmJiB0aGlzLl9jb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgdGltZSB0aGVuIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgICAgIC8vIGZyYW1lIGJhc2VkIG9uIHRoZSB0aW1lIChjaGVjayBpZiBmcHMgaXMgbm90IDAgb3RoZXJ3aXNlIHRpbWUgd2lsbCBiZSBJbmZpbml0eSlcblxuICAgICAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudGltZSAmJiB0aGlzLmZwcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRpbWUgPSB0aGlzLnRpbWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgd2UgZG9uJ3QgaGF2ZSBhIHRpbWVcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlbiBmb3JjZSB1cGRhdGUgZnJhbWUgY291bnRlclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZyYW1lID0gdGhpcy5mcmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaWQgb2YgdGhlIHNwcml0ZSBhc3NldCB1c2VkIHRvIHBsYXkgdGhlIGFuaW1hdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNwcml0ZUFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX2NvbXBvbmVudC5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IGlkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIGlkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQgIT09IGlkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBjbGVhbiBvbGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgICAgICAgICAgY29uc3QgcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChwcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZFNwcml0ZUFzc2V0KHByZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fc3ByaXRlQXNzZXQgPSBpZDtcblxuICAgICAgICAgICAgLy8gYmluZCBzcHJpdGUgYXNzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgdGltZSBvZiB0aGUgYW5pbWF0aW9uIGluIHNlY29uZHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB0aW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldFRpbWUodmFsdWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhbWUgPSBNYXRoLm1pbih0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEsIE1hdGguZmxvb3IodGhpcy5fdGltZSAqIE1hdGguYWJzKHRoaXMuZnBzKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbWU7XG4gICAgfVxuXG4gICAgLy8gV2hlbiBzcHJpdGUgYXNzZXQgaXMgYWRkZWQgYmluZCBpdFxuICAgIF9vblNwcml0ZUFzc2V0QWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGVBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICAvLyB1bmJpbmQgYXRsYXNcbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlICYmICFhc3NldC5yZXNvdXJjZS5hdGxhcykge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzLm9mZignbG9hZDonICsgYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gc3ByaXRlIGFzc2V0IGlzIGxvYWRlZCBtYWtlIHN1cmUgdGhlIHRleHR1cmUgYXRsYXMgYXNzZXQgaXMgbG9hZGVkIHRvb1xuICAgIC8vIElmIHNvIHRoZW4gc2V0IHRoZSBzcHJpdGUsIG90aGVyd2lzZSB3YWl0IGZvciB0aGUgYXRsYXMgdG8gYmUgbG9hZGVkIGZpcnN0XG4gICAgX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhc0Fzc2V0SWQgPSBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0O1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX2NvbXBvbmVudC5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdsb2FkOicgKyBhdGxhc0Fzc2V0SWQsIHRoaXMuX29uVGV4dHVyZUF0bGFzTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gYXRsYXMgaXMgbG9hZGVkIHRyeSB0byByZXNldCB0aGUgc3ByaXRlIGFzc2V0XG4gICAgX29uVGV4dHVyZUF0bGFzTG9hZChhdGxhc0Fzc2V0KSB7XG4gICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgICAgIGlmIChzcHJpdGVBc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZChzcHJpdGVBc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZCh0aGlzLl9jb21wb25lbnQuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHNwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25TcHJpdGVBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIG1lc2hlcyBhcmUgcmUtY3JlYXRlZCBtYWtlIHN1cmVcbiAgICAvLyB3ZSB1cGRhdGUgdGhlbSBpbiB0aGUgbWVzaCBpbnN0YW5jZVxuICAgIF9vblNwcml0ZU1lc2hlc0NoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudC5jdXJyZW50Q2xpcCA9PT0gdGhpcykge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Ll9zaG93RnJhbWUodGhpcy5mcmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgZnJhbWUgaWYgcHB1IGNoYW5nZXMgZm9yIDktc2xpY2VkIHNwcml0ZXNcbiAgICBfb25TcHJpdGVQcHVDaGFuZ2VkKCkge1xuICAgICAgICBpZiAodGhpcy5fY29tcG9uZW50LmN1cnJlbnRDbGlwID09PSB0aGlzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSAhPT0gU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Ll9zaG93RnJhbWUodGhpcy5mcmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZHZhbmNlcyB0aGUgYW5pbWF0aW9uLCBsb29waW5nIGlmIG5lY2Vzc2FyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSBkZWx0YSB0aW1lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZShkdCkge1xuICAgICAgICBpZiAodGhpcy5mcHMgPT09IDApIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl9wbGF5aW5nIHx8IHRoaXMuX3BhdXNlZCB8fCAhdGhpcy5fc3ByaXRlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZGlyID0gdGhpcy5mcHMgPCAwID8gLTEgOiAxO1xuICAgICAgICBjb25zdCB0aW1lID0gdGhpcy5fdGltZSArIGR0ICogdGhpcy5fY29tcG9uZW50LnNwZWVkICogZGlyO1xuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IHRoaXMuZHVyYXRpb247XG4gICAgICAgIGNvbnN0IGVuZCA9ICh0aW1lID4gZHVyYXRpb24gfHwgdGltZSA8IDApO1xuXG4gICAgICAgIHRoaXMuX3NldFRpbWUodGltZSk7XG5cbiAgICAgICAgbGV0IGZyYW1lID0gdGhpcy5mcmFtZTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgZnJhbWUgPSBNYXRoLmZsb29yKHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoICogdGhpcy5fdGltZSAvIGR1cmF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyYW1lID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmcmFtZSAhPT0gdGhpcy5fZnJhbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldEZyYW1lKGZyYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbmQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2xvb3AnKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgnbG9vcCcsIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGF1c2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlbmQnKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgnZW5kJywgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0VGltZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl90aW1lID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gdGhpcy5kdXJhdGlvbjtcbiAgICAgICAgaWYgKHRoaXMuX3RpbWUgPCAwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZSA9IHRoaXMuX3RpbWUgJSBkdXJhdGlvbiArIGR1cmF0aW9uO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90aW1lID4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lICU9IGR1cmF0aW9uO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lID0gZHVyYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0RnJhbWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX2ZyYW1lID0gbWF0aC5jbGFtcCh2YWx1ZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2ZyYW1lID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fY29tcG9uZW50LmN1cnJlbnRDbGlwID09PSB0aGlzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wb25lbnQuX3Nob3dGcmFtZSh0aGlzLl9mcmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZGVzdHJveSgpIHtcbiAgICAgICAgLy8gY2xlYW51cCBldmVudHNcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9jb21wb25lbnQuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGVBc3NldChhc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgc3ByaXRlXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBzcHJpdGUgYXNzZXRcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBsYXlzIHRoZSBhbmltYXRpb24uIElmIGl0J3MgYWxyZWFkeSBwbGF5aW5nIHRoZW4gdGhpcyBkb2VzIG5vdGhpbmcuXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3BsYXlpbmcpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLmZpcmUoJ3BsYXknKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BsYXknLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgdGhlIGFuaW1hdGlvbi5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wbGF5aW5nIHx8IHRoaXMuX3BhdXNlZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9wYXVzZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuZmlyZSgncGF1c2UnKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BhdXNlJywgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyB0aGUgcGF1c2VkIGFuaW1hdGlvbi5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcGF1c2VkKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcGF1c2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZmlyZSgncmVzdW1lJyk7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdyZXN1bWUnLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgYW5pbWF0aW9uIGFuZCByZXNldHMgdGhlIGFuaW1hdGlvbiB0byB0aGUgZmlyc3QgZnJhbWUuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wbGF5aW5nKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdGltZSA9IDA7XG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc3RvcCcpO1xuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgnc3RvcCcsIHRoaXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU3ByaXRlQW5pbWF0aW9uQ2xpcCB9O1xuIl0sIm5hbWVzIjpbIlNwcml0ZUFuaW1hdGlvbkNsaXAiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImNvbXBvbmVudCIsImRhdGEiLCJfY29tcG9uZW50IiwiX2ZyYW1lIiwiX3Nwcml0ZSIsIl9zcHJpdGVBc3NldCIsInNwcml0ZUFzc2V0IiwibmFtZSIsImZwcyIsImxvb3AiLCJfcGxheWluZyIsIl9wYXVzZWQiLCJfdGltZSIsImR1cmF0aW9uIiwiTnVtYmVyIiwiTUlOX1ZBTFVFIiwiZnJhbWVLZXlzIiwibGVuZ3RoIiwiTWF0aCIsImFicyIsImZyYW1lIiwidmFsdWUiLCJfc2V0RnJhbWUiLCJfc2V0VGltZSIsImlzUGF1c2VkIiwiaXNQbGF5aW5nIiwic3ByaXRlIiwib2ZmIiwiX29uU3ByaXRlTWVzaGVzQ2hhbmdlIiwiX29uU3ByaXRlUHB1Q2hhbmdlZCIsImF0bGFzIiwib24iLCJjdXJyZW50Q2xpcCIsIm1pIiwiX21lc2hJbnN0YW5jZSIsImRlbGV0ZVBhcmFtZXRlciIsIl9oaWRlTW9kZWwiLCJ0ZXh0dXJlIiwic2V0UGFyYW1ldGVyIiwiZW5hYmxlZCIsImVudGl0eSIsIl9zaG93TW9kZWwiLCJ0aW1lIiwiYXNzZXRzIiwic3lzdGVtIiwiYXBwIiwiaWQiLCJBc3NldCIsInByZXYiLCJnZXQiLCJfdW5iaW5kU3ByaXRlQXNzZXQiLCJhc3NldCIsIl9vblNwcml0ZUFzc2V0QWRkZWQiLCJfYmluZFNwcml0ZUFzc2V0IiwibWluIiwiZmxvb3IiLCJfb25TcHJpdGVBc3NldExvYWQiLCJfb25TcHJpdGVBc3NldFJlbW92ZSIsInJlc291cmNlIiwibG9hZCIsInRleHR1cmVBdGxhc0Fzc2V0IiwiX29uVGV4dHVyZUF0bGFzTG9hZCIsImF0bGFzQXNzZXRJZCIsIm9uY2UiLCJhdGxhc0Fzc2V0IiwiX3Nob3dGcmFtZSIsInJlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUiLCJfdXBkYXRlIiwiZHQiLCJkaXIiLCJzcGVlZCIsImVuZCIsImZpcmUiLCJtYXRoIiwiY2xhbXAiLCJfZGVzdHJveSIsInBsYXkiLCJwYXVzZSIsInJlc3VtZSIsInN0b3AiLCJFVkVOVF9QTEFZIiwiRVZFTlRfUEFVU0UiLCJFVkVOVF9SRVNVTUUiLCJFVkVOVF9TVE9QIiwiRVZFTlRfRU5EIiwiRVZFTlRfTE9PUCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxtQkFBbUIsU0FBU0MsWUFBWSxDQUFDO0FBbUUzQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxFQUFFO0FBQ3pCLElBQUEsS0FBSyxFQUFFLENBQUE7SUFFUCxJQUFJLENBQUNDLFVBQVUsR0FBR0YsU0FBUyxD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
