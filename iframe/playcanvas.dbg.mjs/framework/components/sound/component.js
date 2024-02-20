import { Debug } from '../../../core/debug.js';
import { DISTANCE_LINEAR } from '../../../platform/audio/constants.js';
import { Component } from '../component.js';
import { SoundSlot } from './slot.js';

/**
 * The Sound Component controls playback of {@link Sound}s.
 *
 * @augments Component
 * @category Sound
 */
class SoundComponent extends Component {
  /**
   * Create a new Sound Component.
   *
   * @param {import('./system.js').SoundComponentSystem} system - The ComponentSystem that
   * created this component.
   * @param {import('../../entity.js').Entity} entity - The entity that the Component is attached
   * to.
   */
  constructor(system, entity) {
    super(system, entity);

    /** @private */
    this._volume = 1;
    /** @private */
    this._pitch = 1;
    /** @private */
    this._positional = true;
    /** @private */
    this._refDistance = 1;
    /** @private */
    this._maxDistance = 10000;
    /** @private */
    this._rollOffFactor = 1;
    /** @private */
    this._distanceModel = DISTANCE_LINEAR;

    /**
     * @type {Object<string, SoundSlot>}
     * @private
     */
    this._slots = {};

    /** @private */
    this._playingBeforeDisable = {};
  }

  /**
   * Update the specified property on all sound instances.
   *
   * @param {string} property - The name of the SoundInstance property to update.
   * @param {string|number} value - The value to set the property to.
   * @param {boolean} isFactor - True if the value is a factor of the slot property or false
   * if it is an absolute value.
   * @private
   */
  _updateSoundInstances(property, value, isFactor) {
    const slots = this._slots;
    for (const key in slots) {
      const slot = slots[key];
      // only change value of non-overlapping instances
      if (!slot.overlap) {
        const instances = slot.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
          instances[i][property] = isFactor ? slot[property] * value : value;
        }
      }
    }
  }

  /**
   * Determines which algorithm to use to reduce the volume of the sound as it moves away from
   * the listener. Can be:
   *
   * - {@link DISTANCE_LINEAR}
   * - {@link DISTANCE_INVERSE}
   * - {@link DISTANCE_EXPONENTIAL}
   *
   * Defaults to {@link DISTANCE_LINEAR}.
   *
   * @type {string}
   */
  set distanceModel(value) {
    this._distanceModel = value;
    this._updateSoundInstances('distanceModel', value, false);
  }
  get distanceModel() {
    return this._distanceModel;
  }

  /**
   * The maximum distance from the listener at which audio falloff stops. Note the volume of the
   * audio is not 0 after this distance, but just doesn't fall off anymore. Defaults to 10000.
   *
   * @type {number}
   */
  set maxDistance(value) {
    this._maxDistance = value;
    this._updateSoundInstances('maxDistance', value, false);
  }
  get maxDistance() {
    return this._maxDistance;
  }

  /**
   * The reference distance for reducing volume as the sound source moves further from the
   * listener. Defaults to 1.
   *
   * @type {number}
   */
  set refDistance(value) {
    this._refDistance = value;
    this._updateSoundInstances('refDistance', value, false);
  }
  get refDistance() {
    return this._refDistance;
  }

  /**
   * The factor used in the falloff equation. Defaults to 1.
   *
   * @type {number}
   */
  set rollOffFactor(value) {
    this._rollOffFactor = value;
    this._updateSoundInstances('rollOffFactor', value, false);
  }
  get rollOffFactor() {
    return this._rollOffFactor;
  }

  /**
   * The pitch modifier to play the audio with. Must be larger than 0.01. Defaults to 1.
   *
   * @type {number}
   */
  set pitch(value) {
    this._pitch = value;
    this._updateSoundInstances('pitch', value, true);
  }
  get pitch() {
    return this._pitch;
  }

  /**
   * The volume modifier to play the audio with. In range 0-1. Defaults to 1.
   *
   * @type {number}
   */
  set volume(value) {
    this._volume = value;
    this._updateSoundInstances('volume', value, true);
  }
  get volume() {
    return this._volume;
  }

  /**
   * If true the audio will play back at the location of the Entity in space, so the audio will
   * be affected by the position of the {@link AudioListenerComponent}. Defaults to true.
   *
   * @type {boolean}
   */
  set positional(newValue) {
    this._positional = newValue;
    const slots = this._slots;
    for (const key in slots) {
      const slot = slots[key];
      // recreate non overlapping sounds
      if (!slot.overlap) {
        const instances = slot.instances;
        const oldLength = instances.length;

        // When the instance is stopped, it gets removed from the slot.instances array
        // so we are going backwards to compensate for that

        for (let i = oldLength - 1; i >= 0; i--) {
          const isPlaying = instances[i].isPlaying || instances[i].isSuspended;
          const currentTime = instances[i].currentTime;
          if (isPlaying) instances[i].stop();
          const instance = slot._createInstance();
          if (isPlaying) {
            instance.play();
            instance.currentTime = currentTime;
          }
          instances.push(instance);
        }
      }
    }
  }
  get positional() {
    return this._positional;
  }

  /**
   * A dictionary that contains the {@link SoundSlot}s managed by this SoundComponent.
   *
   * @type {Object<string, SoundSlot>}
   */
  set slots(newValue) {
    const oldValue = this._slots;

    // stop previous slots
    if (oldValue) {
      for (const key in oldValue) {
        oldValue[key].stop();
      }
    }
    const slots = {};

    // convert data to slots
    for (const key in newValue) {
      if (!(newValue[key] instanceof SoundSlot)) {
        if (newValue[key].name) {
          slots[newValue[key].name] = new SoundSlot(this, newValue[key].name, newValue[key]);
        }
      } else {
        slots[newValue[key].name] = newValue[key];
      }
    }
    this._slots = slots;

    // call onEnable in order to start autoPlay slots
    if (this.enabled && this.entity.enabled) this.onEnable();
  }
  get slots() {
    return this._slots;
  }
  onEnable() {
    // do not run if running in Editor
    if (this.system._inTools) {
      return;
    }
    const slots = this._slots;
    const playingBeforeDisable = this._playingBeforeDisable;
    for (const key in slots) {
      const slot = slots[key];
      // play if autoPlay is true or
      // if the slot was paused when the component
      // got disabled
      if (slot.autoPlay && slot.isStopped) {
        slot.play();
      } else if (playingBeforeDisable[key]) {
        slot.resume();
      } else if (!slot.isLoaded) {
        // start loading slots
        slot.load();
      }
    }
  }
  onDisable() {
    const slots = this._slots;
    const playingBeforeDisable = {};
    for (const key in slots) {
      // pause non-overlapping sounds
      if (!slots[key].overlap) {
        if (slots[key].isPlaying) {
          slots[key].pause();
          // remember sounds playing when we disable
          // so we can resume them on enable
          playingBeforeDisable[key] = true;
        }
      }
    }
    this._playingBeforeDisable = playingBeforeDisable;
  }
  onRemove() {
    this.off();
  }

  /**
   * Creates a new {@link SoundSlot} with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @param {object} [options] - Settings for the slot.
   * @param {number} [options.volume] - The playback volume, between 0 and 1. Defaults to 1.
   * @param {number} [options.pitch] - The relative pitch. Defaults to 1 (plays at normal pitch).
   * @param {boolean} [options.loop] - If true the sound will restart when it reaches the end.
   * Defaults to false.
   * @param {number} [options.startTime] - The start time from which the sound will start playing.
   * Defaults to 0 to start at the beginning.
   * @param {number} [options.duration] - The duration of the sound that the slot will play
   * starting from startTime. Defaults to `null` which means play to end of the sound.
   * @param {boolean} [options.overlap] - If true then sounds played from slot will be played
   * independently of each other. Otherwise the slot will first stop the current sound before
   * starting the new one. Defaults to false.
   * @param {boolean} [options.autoPlay] - If true the slot will start playing as soon as its
   * audio asset is loaded. Defaults to false.
   * @param {number} [options.asset] - The asset id of the audio asset that is going to be played
   * by this slot.
   * @returns {SoundSlot|null} The new slot or null if the slot already exists.
   * @example
   * // get an asset by id
   * const asset = app.assets.get(10);
   * // add a slot
   * this.entity.sound.addSlot('beep', {
   *     asset: asset
   * });
   * // play
   * this.entity.sound.play('beep');
   */
  addSlot(name, options) {
    const slots = this._slots;
    if (slots[name]) {
      Debug.warn(`A sound slot with name ${name} already exists on Entity ${this.entity.path}`);
      return null;
    }
    const slot = new SoundSlot(this, name, options);
    slots[name] = slot;
    if (slot.autoPlay && this.enabled && this.entity.enabled) {
      slot.play();
    }
    return slot;
  }

  /**
   * Removes the {@link SoundSlot} with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @example
   * // remove a slot called 'beep'
   * this.entity.sound.removeSlot('beep');
   */
  removeSlot(name) {
    const slots = this._slots;
    if (slots[name]) {
      slots[name].stop();
      delete slots[name];
    }
  }

  /**
   * Returns the slot with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @returns {SoundSlot|undefined} The slot.
   * @example
   * // get a slot and set its volume
   * this.entity.sound.slot('beep').volume = 0.5;
   *
   */
  slot(name) {
    return this._slots[name];
  }

  /**
   * Return a property from the slot with the specified name.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @param {string} property - The name of the property to look for.
   * @returns {*} The value from the looked property inside the slot with specified name. May be undefined if slot does not exist.
   * @private
   */
  _getSlotProperty(name, property) {
    if (!this.enabled || !this.entity.enabled) {
      return undefined;
    }
    const slot = this._slots[name];
    if (!slot) {
      Debug.warn(`Trying to get ${property} from sound slot with name ${name} which does not exist`);
      return undefined;
    }
    return slot[property];
  }

  /**
   * Returns true if the slot with the specified name is currently playing.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently playing.
   */
  isPlaying(name) {
    return this._getSlotProperty(name, 'isPlaying') || false;
  }

  /**
   * Returns true if the asset of the slot with the specified name is loaded..
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and its asset is loaded.
   */
  isLoaded(name) {
    return this._getSlotProperty(name, 'isLoaded') || false;
  }

  /**
   * Returns true if the slot with the specified name is currently paused.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently paused.
   */
  isPaused(name) {
    return this._getSlotProperty(name, 'isPaused') || false;
  }

  /**
   * Returns true if the slot with the specified name is currently stopped.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently stopped.
   */
  isStopped(name) {
    return this._getSlotProperty(name, 'isStopped') || false;
  }

  /**
   * Begins playing the sound slot with the specified name. The slot will restart playing if it
   * is already playing unless the overlap field is true in which case a new sound will be
   * created and played.
   *
   * @param {string} name - The name of the {@link SoundSlot} to play.
   * @returns {import('../../../platform/sound/instance.js').SoundInstance|null} The sound
   * instance that will be played. Returns null if the component or its parent entity is disabled
   * or if the SoundComponent has no slot with the specified name.
   * @example
   * // get asset by id
   * const asset = app.assets.get(10);
   * // create a slot and play it
   * this.entity.sound.addSlot('beep', {
   *     asset: asset
   * });
   * this.entity.sound.play('beep');
   */
  play(name) {
    if (!this.enabled || !this.entity.enabled) {
      return null;
    }
    const slot = this._slots[name];
    if (!slot) {
      Debug.warn(`Trying to play sound slot with name ${name} which does not exist`);
      return null;
    }
    return slot.play();
  }

  /**
   * Pauses playback of the slot with the specified name. If the name is undefined then all slots
   * currently played will be paused. The slots can be resumed by calling {@link SoundComponent#resume}.
   *
   * @param {string} [name] - The name of the slot to pause. Leave undefined to pause everything.
   * @example
   * // pause all sounds
   * this.entity.sound.pause();
   * // pause a specific sound
   * this.entity.sound.pause('beep');
   */
  pause(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to pause sound slot with name ${name} which does not exist`);
        return;
      }
      slot.pause();
    } else {
      for (const key in slots) {
        slots[key].pause();
      }
    }
  }

  /**
   * Resumes playback of the sound slot with the specified name if it's paused. If no name is
   * specified all slots will be resumed.
   *
   * @param {string} [name] - The name of the slot to resume. Leave undefined to resume everything.
   * @example
   * // resume all sounds
   * this.entity.sound.resume();
   * // resume a specific sound
   * this.entity.sound.resume('beep');
   */
  resume(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to resume sound slot with name ${name} which does not exist`);
        return;
      }
      if (slot.isPaused) {
        slot.resume();
      }
    } else {
      for (const key in slots) {
        slots[key].resume();
      }
    }
  }

  /**
   * Stops playback of the sound slot with the specified name if it's paused. If no name is
   * specified all slots will be stopped.
   *
   * @param {string} [name] - The name of the slot to stop. Leave undefined to stop everything.
   * @example
   * // stop all sounds
   * this.entity.sound.stop();
   * // stop a specific sound
   * this.entity.sound.stop('beep');
   */
  stop(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to stop sound slot with name ${name} which does not exist`);
        return;
      }
      slot.stop();
    } else {
      for (const key in slots) {
        slots[key].stop();
      }
    }
  }
}
/**
 * Fired when a sound instance starts playing. The handler is passed the {@link SoundSlot} and
 * the {@link SoundInstance} that started playing.
 *
 * @event
 * @example
 * entity.sound.on('play', (slot, instance) => {
 *     console.log(`Sound ${slot.name} started playing`);
 * });
 */
SoundComponent.EVENT_PLAY = 'play';
/**
 * Fired when a sound instance is paused. The handler is passed the {@link SoundSlot} and the
 * {@link SoundInstance} that was paused.
 *
 * @event
 * @example
 * entity.sound.on('pause', (slot, instance) => {
 *     console.log(`Sound ${slot.name} paused`);
 * });
 */
SoundComponent.EVENT_PAUSE = 'pause';
/**
 * Fired when a sound instance is resumed. The handler is passed the {@link SoundSlot} and the
 * {@link SoundInstance} that was resumed.
 *
 * @event
 * @example
 * entity.sound.on('resume', (slot, instance) => {
 *     console.log(`Sound ${slot.name} resumed`);
 * });
 */
SoundComponent.EVENT_RESUME = 'resume';
/**
 * Fired when a sound instance is stopped. The handler is passed the {@link SoundSlot} and the
 * {@link SoundInstance} that was stopped.
 *
 * @event
 * @example
 * entity.sound.on('stop', (slot, instance) => {
 *     console.log(`Sound ${slot.name} stopped`);
 * });
 */
SoundComponent.EVENT_STOP = 'stop';
/**
 * Fired when a sound instance stops playing because it reached its end. The handler is passed
 * the {@link SoundSlot} and the {@link SoundInstance} that ended.
 *
 * @event
 * @example
 * entity.sound.on('end', (slot, instance) => {
 *     console.log(`Sound ${slot.name} ended`);
 * });
 */
SoundComponent.EVENT_END = 'end';

export { SoundComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc291bmQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IERJU1RBTkNFX0xJTkVBUiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2F1ZGlvL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IFNvdW5kU2xvdCB9IGZyb20gJy4vc2xvdC5qcyc7XG5cbi8qKlxuICogVGhlIFNvdW5kIENvbXBvbmVudCBjb250cm9scyBwbGF5YmFjayBvZiB7QGxpbmsgU291bmR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAY2F0ZWdvcnkgU291bmRcbiAqL1xuY2xhc3MgU291bmRDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdGFydHMgcGxheWluZy4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSB7QGxpbmsgU291bmRTbG90fSBhbmRcbiAgICAgKiB0aGUge0BsaW5rIFNvdW5kSW5zdGFuY2V9IHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc291bmQub24oJ3BsYXknLCAoc2xvdCwgaW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFNvdW5kICR7c2xvdC5uYW1lfSBzdGFydGVkIHBsYXlpbmdgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUExBWSA9ICdwbGF5JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBpcyBwYXVzZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUge0BsaW5rIFNvdW5kU2xvdH0gYW5kIHRoZVxuICAgICAqIHtAbGluayBTb3VuZEluc3RhbmNlfSB0aGF0IHdhcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zb3VuZC5vbigncGF1c2UnLCAoc2xvdCwgaW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFNvdW5kICR7c2xvdC5uYW1lfSBwYXVzZWRgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUEFVU0UgPSAncGF1c2UnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHJlc3VtZWQuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUge0BsaW5rIFNvdW5kU2xvdH0gYW5kIHRoZVxuICAgICAqIHtAbGluayBTb3VuZEluc3RhbmNlfSB0aGF0IHdhcyByZXN1bWVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc291bmQub24oJ3Jlc3VtZScsIChzbG90LCBpbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgU291bmQgJHtzbG90Lm5hbWV9IHJlc3VtZWRgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUkVTVU1FID0gJ3Jlc3VtZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgc3RvcHBlZC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSB7QGxpbmsgU291bmRTbG90fSBhbmQgdGhlXG4gICAgICoge0BsaW5rIFNvdW5kSW5zdGFuY2V9IHRoYXQgd2FzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zb3VuZC5vbignc3RvcCcsIChzbG90LCBpbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgU291bmQgJHtzbG90Lm5hbWV9IHN0b3BwZWRgKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1RPUCA9ICdzdG9wJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kLiBUaGUgaGFuZGxlciBpcyBwYXNzZWRcbiAgICAgKiB0aGUge0BsaW5rIFNvdW5kU2xvdH0gYW5kIHRoZSB7QGxpbmsgU291bmRJbnN0YW5jZX0gdGhhdCBlbmRlZC5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNvdW5kLm9uKCdlbmQnLCAoc2xvdCwgaW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFNvdW5kICR7c2xvdC5uYW1lfSBlbmRlZGApO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9FTkQgPSAnZW5kJztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZCBDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5Tb3VuZENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoYXQgdGhlIENvbXBvbmVudCBpcyBhdHRhY2hlZFxuICAgICAqIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gMTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3BpdGNoID0gMTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uYWwgPSB0cnVlO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fcmVmRGlzdGFuY2UgPSAxO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fbWF4RGlzdGFuY2UgPSAxMDAwMDtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3JvbGxPZmZGYWN0b3IgPSAxO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGlzdGFuY2VNb2RlbCA9IERJU1RBTkNFX0xJTkVBUjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNvdW5kU2xvdD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zbG90cyA9IHt9O1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9wbGF5aW5nQmVmb3JlRGlzYWJsZSA9IHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgc3BlY2lmaWVkIHByb3BlcnR5IG9uIGFsbCBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHkgLSBUaGUgbmFtZSBvZiB0aGUgU291bmRJbnN0YW5jZSBwcm9wZXJ0eSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBzZXQgdGhlIHByb3BlcnR5IHRvLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNGYWN0b3IgLSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyBhIGZhY3RvciBvZiB0aGUgc2xvdCBwcm9wZXJ0eSBvciBmYWxzZVxuICAgICAqIGlmIGl0IGlzIGFuIGFic29sdXRlIHZhbHVlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKHByb3BlcnR5LCB2YWx1ZSwgaXNGYWN0b3IpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNsb3QgPSBzbG90c1trZXldO1xuICAgICAgICAgICAgLy8gb25seSBjaGFuZ2UgdmFsdWUgb2Ygbm9uLW92ZXJsYXBwaW5nIGluc3RhbmNlc1xuICAgICAgICAgICAgaWYgKCFzbG90Lm92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBzbG90Lmluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXVtwcm9wZXJ0eV0gPSBpc0ZhY3RvciA/IHNsb3RbcHJvcGVydHldICogdmFsdWUgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIHdoaWNoIGFsZ29yaXRobSB0byB1c2UgdG8gcmVkdWNlIHRoZSB2b2x1bWUgb2YgdGhlIHNvdW5kIGFzIGl0IG1vdmVzIGF3YXkgZnJvbVxuICAgICAqIHRoZSBsaXN0ZW5lci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRElTVEFOQ0VfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIERJU1RBTkNFX0lOVkVSU0V9XG4gICAgICogLSB7QGxpbmsgRElTVEFOQ0VfRVhQT05FTlRJQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgRElTVEFOQ0VfTElORUFSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGRpc3RhbmNlTW9kZWwodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGlzdGFuY2VNb2RlbCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVTb3VuZEluc3RhbmNlcygnZGlzdGFuY2VNb2RlbCcsIHZhbHVlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZ2V0IGRpc3RhbmNlTW9kZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kaXN0YW5jZU1vZGVsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIGRpc3RhbmNlIGZyb20gdGhlIGxpc3RlbmVyIGF0IHdoaWNoIGF1ZGlvIGZhbGxvZmYgc3RvcHMuIE5vdGUgdGhlIHZvbHVtZSBvZiB0aGVcbiAgICAgKiBhdWRpbyBpcyBub3QgMCBhZnRlciB0aGlzIGRpc3RhbmNlLCBidXQganVzdCBkb2Vzbid0IGZhbGwgb2ZmIGFueW1vcmUuIERlZmF1bHRzIHRvIDEwMDAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWF4RGlzdGFuY2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWF4RGlzdGFuY2UgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlU291bmRJbnN0YW5jZXMoJ21heERpc3RhbmNlJywgdmFsdWUsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBnZXQgbWF4RGlzdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhEaXN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVmZXJlbmNlIGRpc3RhbmNlIGZvciByZWR1Y2luZyB2b2x1bWUgYXMgdGhlIHNvdW5kIHNvdXJjZSBtb3ZlcyBmdXJ0aGVyIGZyb20gdGhlXG4gICAgICogbGlzdGVuZXIuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZWZEaXN0YW5jZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9yZWZEaXN0YW5jZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVTb3VuZEluc3RhbmNlcygncmVmRGlzdGFuY2UnLCB2YWx1ZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGdldCByZWZEaXN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlZkRpc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmYWN0b3IgdXNlZCBpbiB0aGUgZmFsbG9mZiBlcXVhdGlvbi4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJvbGxPZmZGYWN0b3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcm9sbE9mZkZhY3RvciA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVTb3VuZEluc3RhbmNlcygncm9sbE9mZkZhY3RvcicsIHZhbHVlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZ2V0IHJvbGxPZmZGYWN0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb2xsT2ZmRmFjdG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXRjaCBtb2RpZmllciB0byBwbGF5IHRoZSBhdWRpbyB3aXRoLiBNdXN0IGJlIGxhcmdlciB0aGFuIDAuMDEuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwaXRjaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9waXRjaCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVTb3VuZEluc3RhbmNlcygncGl0Y2gnLCB2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHBpdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHZvbHVtZSBtb2RpZmllciB0byBwbGF5IHRoZSBhdWRpbyB3aXRoLiBJbiByYW5nZSAwLTEuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB2b2x1bWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKCd2b2x1bWUnLCB2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhdWRpbyB3aWxsIHBsYXkgYmFjayBhdCB0aGUgbG9jYXRpb24gb2YgdGhlIEVudGl0eSBpbiBzcGFjZSwgc28gdGhlIGF1ZGlvIHdpbGxcbiAgICAgKiBiZSBhZmZlY3RlZCBieSB0aGUgcG9zaXRpb24gb2YgdGhlIHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50fS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBwb3NpdGlvbmFsKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uYWwgPSBuZXdWYWx1ZTtcblxuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW2tleV07XG4gICAgICAgICAgICAvLyByZWNyZWF0ZSBub24gb3ZlcmxhcHBpbmcgc291bmRzXG4gICAgICAgICAgICBpZiAoIXNsb3Qub3ZlcmxhcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHNsb3QuaW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9sZExlbmd0aCA9IGluc3RhbmNlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAvLyBXaGVuIHRoZSBpbnN0YW5jZSBpcyBzdG9wcGVkLCBpdCBnZXRzIHJlbW92ZWQgZnJvbSB0aGUgc2xvdC5pbnN0YW5jZXMgYXJyYXlcbiAgICAgICAgICAgICAgICAvLyBzbyB3ZSBhcmUgZ29pbmcgYmFja3dhcmRzIHRvIGNvbXBlbnNhdGUgZm9yIHRoYXRcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSBvbGRMZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1BsYXlpbmcgPSBpbnN0YW5jZXNbaV0uaXNQbGF5aW5nIHx8IGluc3RhbmNlc1tpXS5pc1N1c3BlbmRlZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBpbnN0YW5jZXNbaV0uY3VycmVudFRpbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1BsYXlpbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RvcCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlID0gc2xvdC5fY3JlYXRlSW5zdGFuY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UucGxheSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuY3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcG9zaXRpb25hbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBkaWN0aW9uYXJ5IHRoYXQgY29udGFpbnMgdGhlIHtAbGluayBTb3VuZFNsb3R9cyBtYW5hZ2VkIGJ5IHRoaXMgU291bmRDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgU291bmRTbG90Pn1cbiAgICAgKi9cbiAgICBzZXQgc2xvdHMobmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9zbG90cztcblxuICAgICAgICAvLyBzdG9wIHByZXZpb3VzIHNsb3RzXG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gb2xkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBvbGRWYWx1ZVtrZXldLnN0b3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNsb3RzID0ge307XG5cbiAgICAgICAgLy8gY29udmVydCBkYXRhIHRvIHNsb3RzXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoIShuZXdWYWx1ZVtrZXldIGluc3RhbmNlb2YgU291bmRTbG90KSkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZVtrZXldLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2xvdHNbbmV3VmFsdWVba2V5XS5uYW1lXSA9IG5ldyBTb3VuZFNsb3QodGhpcywgbmV3VmFsdWVba2V5XS5uYW1lLCBuZXdWYWx1ZVtrZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNsb3RzW25ld1ZhbHVlW2tleV0ubmFtZV0gPSBuZXdWYWx1ZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2xvdHMgPSBzbG90cztcblxuICAgICAgICAvLyBjYWxsIG9uRW5hYmxlIGluIG9yZGVyIHRvIHN0YXJ0IGF1dG9QbGF5IHNsb3RzXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgIHRoaXMub25FbmFibGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc2xvdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zbG90cztcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gZG8gbm90IHJ1biBpZiBydW5uaW5nIGluIEVkaXRvclxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uX2luVG9vbHMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5fc2xvdHM7XG4gICAgICAgIGNvbnN0IHBsYXlpbmdCZWZvcmVEaXNhYmxlID0gdGhpcy5fcGxheWluZ0JlZm9yZURpc2FibGU7XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNsb3QgPSBzbG90c1trZXldO1xuICAgICAgICAgICAgLy8gcGxheSBpZiBhdXRvUGxheSBpcyB0cnVlIG9yXG4gICAgICAgICAgICAvLyBpZiB0aGUgc2xvdCB3YXMgcGF1c2VkIHdoZW4gdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgLy8gZ290IGRpc2FibGVkXG4gICAgICAgICAgICBpZiAoc2xvdC5hdXRvUGxheSAmJiBzbG90LmlzU3RvcHBlZCkge1xuICAgICAgICAgICAgICAgIHNsb3QucGxheSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwbGF5aW5nQmVmb3JlRGlzYWJsZVtrZXldKSB7XG4gICAgICAgICAgICAgICAgc2xvdC5yZXN1bWUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXNsb3QuaXNMb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBzdGFydCBsb2FkaW5nIHNsb3RzXG4gICAgICAgICAgICAgICAgc2xvdC5sb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5fc2xvdHM7XG4gICAgICAgIGNvbnN0IHBsYXlpbmdCZWZvcmVEaXNhYmxlID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgIC8vIHBhdXNlIG5vbi1vdmVybGFwcGluZyBzb3VuZHNcbiAgICAgICAgICAgIGlmICghc2xvdHNba2V5XS5vdmVybGFwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNsb3RzW2tleV0uaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHNsb3RzW2tleV0ucGF1c2UoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtZW1iZXIgc291bmRzIHBsYXlpbmcgd2hlbiB3ZSBkaXNhYmxlXG4gICAgICAgICAgICAgICAgICAgIC8vIHNvIHdlIGNhbiByZXN1bWUgdGhlbSBvbiBlbmFibGVcbiAgICAgICAgICAgICAgICAgICAgcGxheWluZ0JlZm9yZURpc2FibGVba2V5XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcGxheWluZ0JlZm9yZURpc2FibGUgPSBwbGF5aW5nQmVmb3JlRGlzYWJsZTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IHtAbGluayBTb3VuZFNsb3R9IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2xvdC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gU2V0dGluZ3MgZm9yIHRoZSBzbG90LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWVdIC0gVGhlIHBsYXliYWNrIHZvbHVtZSwgYmV0d2VlbiAwIGFuZCAxLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5waXRjaF0gLSBUaGUgcmVsYXRpdmUgcGl0Y2guIERlZmF1bHRzIHRvIDEgKHBsYXlzIGF0IG5vcm1hbCBwaXRjaCkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5sb29wXSAtIElmIHRydWUgdGhlIHNvdW5kIHdpbGwgcmVzdGFydCB3aGVuIGl0IHJlYWNoZXMgdGhlIGVuZC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnRUaW1lXSAtIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnQgcGxheWluZy5cbiAgICAgKiBEZWZhdWx0cyB0byAwIHRvIHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uXSAtIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgc2xvdCB3aWxsIHBsYXlcbiAgICAgKiBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS4gRGVmYXVsdHMgdG8gYG51bGxgIHdoaWNoIG1lYW5zIHBsYXkgdG8gZW5kIG9mIHRoZSBzb3VuZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLm92ZXJsYXBdIC0gSWYgdHJ1ZSB0aGVuIHNvdW5kcyBwbGF5ZWQgZnJvbSBzbG90IHdpbGwgYmUgcGxheWVkXG4gICAgICogaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyLiBPdGhlcndpc2UgdGhlIHNsb3Qgd2lsbCBmaXJzdCBzdG9wIHRoZSBjdXJyZW50IHNvdW5kIGJlZm9yZVxuICAgICAqIHN0YXJ0aW5nIHRoZSBuZXcgb25lLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmF1dG9QbGF5XSAtIElmIHRydWUgdGhlIHNsb3Qgd2lsbCBzdGFydCBwbGF5aW5nIGFzIHNvb24gYXMgaXRzXG4gICAgICogYXVkaW8gYXNzZXQgaXMgbG9hZGVkLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYXNzZXRdIC0gVGhlIGFzc2V0IGlkIG9mIHRoZSBhdWRpbyBhc3NldCB0aGF0IGlzIGdvaW5nIHRvIGJlIHBsYXllZFxuICAgICAqIGJ5IHRoaXMgc2xvdC5cbiAgICAgKiBAcmV0dXJucyB7U291bmRTbG90fG51bGx9IFRoZSBuZXcgc2xvdCBvciBudWxsIGlmIHRoZSBzbG90IGFscmVhZHkgZXhpc3RzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gZ2V0IGFuIGFzc2V0IGJ5IGlkXG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMCk7XG4gICAgICogLy8gYWRkIGEgc2xvdFxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLmFkZFNsb3QoJ2JlZXAnLCB7XG4gICAgICogICAgIGFzc2V0OiBhc3NldFxuICAgICAqIH0pO1xuICAgICAqIC8vIHBsYXlcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5wbGF5KCdiZWVwJyk7XG4gICAgICovXG4gICAgYWRkU2xvdChuYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5fc2xvdHM7XG4gICAgICAgIGlmIChzbG90c1tuYW1lXSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgQSBzb3VuZCBzbG90IHdpdGggbmFtZSAke25hbWV9IGFscmVhZHkgZXhpc3RzIG9uIEVudGl0eSAke3RoaXMuZW50aXR5LnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNsb3QgPSBuZXcgU291bmRTbG90KHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICBzbG90c1tuYW1lXSA9IHNsb3Q7XG5cbiAgICAgICAgaWYgKHNsb3QuYXV0b1BsYXkgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHNsb3QucGxheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNsb3Q7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUge0BsaW5rIFNvdW5kU2xvdH0gd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gcmVtb3ZlIGEgc2xvdCBjYWxsZWQgJ2JlZXAnXG4gICAgICogdGhpcy5lbnRpdHkuc291bmQucmVtb3ZlU2xvdCgnYmVlcCcpO1xuICAgICAqL1xuICAgIHJlbW92ZVNsb3QobmFtZSkge1xuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuICAgICAgICBpZiAoc2xvdHNbbmFtZV0pIHtcbiAgICAgICAgICAgIHNsb3RzW25hbWVdLnN0b3AoKTtcbiAgICAgICAgICAgIGRlbGV0ZSBzbG90c1tuYW1lXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LlxuICAgICAqIEByZXR1cm5zIHtTb3VuZFNsb3R8dW5kZWZpbmVkfSBUaGUgc2xvdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGdldCBhIHNsb3QgYW5kIHNldCBpdHMgdm9sdW1lXG4gICAgICogdGhpcy5lbnRpdHkuc291bmQuc2xvdCgnYmVlcCcpLnZvbHVtZSA9IDAuNTtcbiAgICAgKlxuICAgICAqL1xuICAgIHNsb3QobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2xvdHNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGEgcHJvcGVydHkgZnJvbSB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHtAbGluayBTb3VuZFNsb3R9IHRvIGxvb2sgZm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSAtIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBsb29rIGZvci5cbiAgICAgKiBAcmV0dXJucyB7Kn0gVGhlIHZhbHVlIGZyb20gdGhlIGxvb2tlZCBwcm9wZXJ0eSBpbnNpZGUgdGhlIHNsb3Qgd2l0aCBzcGVjaWZpZWQgbmFtZS4gTWF5IGJlIHVuZGVmaW5lZCBpZiBzbG90IGRvZXMgbm90IGV4aXN0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNsb3RQcm9wZXJ0eShuYW1lLCBwcm9wZXJ0eSkge1xuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLl9zbG90c1tuYW1lXTtcbiAgICAgICAgaWYgKCFzbG90KSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gZ2V0ICR7cHJvcGVydHl9IGZyb20gc291bmQgc2xvdCB3aXRoIG5hbWUgJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdGApO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzbG90W3Byb3BlcnR5XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBsb29rIGZvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBleGlzdHMgYW5kIGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqL1xuICAgIGlzUGxheWluZyhuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTbG90UHJvcGVydHkobmFtZSwgJ2lzUGxheWluZycpIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYXNzZXQgb2YgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgaXMgbG9hZGVkLi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHtAbGluayBTb3VuZFNsb3R9IHRvIGxvb2sgZm9yLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGV4aXN0cyBhbmQgaXRzIGFzc2V0IGlzIGxvYWRlZC5cbiAgICAgKi9cbiAgICBpc0xvYWRlZChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTbG90UHJvcGVydHkobmFtZSwgJ2lzTG9hZGVkJykgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBsb29rIGZvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBleGlzdHMgYW5kIGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICovXG4gICAgaXNQYXVzZWQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2xvdFByb3BlcnR5KG5hbWUsICdpc1BhdXNlZCcpIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBpcyBjdXJyZW50bHkgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHtAbGluayBTb3VuZFNsb3R9IHRvIGxvb2sgZm9yLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGV4aXN0cyBhbmQgaXMgY3VycmVudGx5IHN0b3BwZWQuXG4gICAgICovXG4gICAgaXNTdG9wcGVkKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNsb3RQcm9wZXJ0eShuYW1lLCAnaXNTdG9wcGVkJykgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmVnaW5zIHBsYXlpbmcgdGhlIHNvdW5kIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuIFRoZSBzbG90IHdpbGwgcmVzdGFydCBwbGF5aW5nIGlmIGl0XG4gICAgICogaXMgYWxyZWFkeSBwbGF5aW5nIHVubGVzcyB0aGUgb3ZlcmxhcCBmaWVsZCBpcyB0cnVlIGluIHdoaWNoIGNhc2UgYSBuZXcgc291bmQgd2lsbCBiZVxuICAgICAqIGNyZWF0ZWQgYW5kIHBsYXllZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHtAbGluayBTb3VuZFNsb3R9IHRvIHBsYXkuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vc291bmQvaW5zdGFuY2UuanMnKS5Tb3VuZEluc3RhbmNlfG51bGx9IFRoZSBzb3VuZFxuICAgICAqIGluc3RhbmNlIHRoYXQgd2lsbCBiZSBwbGF5ZWQuIFJldHVybnMgbnVsbCBpZiB0aGUgY29tcG9uZW50IG9yIGl0cyBwYXJlbnQgZW50aXR5IGlzIGRpc2FibGVkXG4gICAgICogb3IgaWYgdGhlIFNvdW5kQ29tcG9uZW50IGhhcyBubyBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gZ2V0IGFzc2V0IGJ5IGlkXG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMCk7XG4gICAgICogLy8gY3JlYXRlIGEgc2xvdCBhbmQgcGxheSBpdFxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLmFkZFNsb3QoJ2JlZXAnLCB7XG4gICAgICogICAgIGFzc2V0OiBhc3NldFxuICAgICAqIH0pO1xuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnBsYXkoJ2JlZXAnKTtcbiAgICAgKi9cbiAgICBwbGF5KG5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuX3Nsb3RzW25hbWVdO1xuICAgICAgICBpZiAoIXNsb3QpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFRyeWluZyB0byBwbGF5IHNvdW5kIHNsb3Qgd2l0aCBuYW1lICR7bmFtZX0gd2hpY2ggZG9lcyBub3QgZXhpc3RgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNsb3QucGxheSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBwbGF5YmFjayBvZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZS4gSWYgdGhlIG5hbWUgaXMgdW5kZWZpbmVkIHRoZW4gYWxsIHNsb3RzXG4gICAgICogY3VycmVudGx5IHBsYXllZCB3aWxsIGJlIHBhdXNlZC4gVGhlIHNsb3RzIGNhbiBiZSByZXN1bWVkIGJ5IGNhbGxpbmcge0BsaW5rIFNvdW5kQ29tcG9uZW50I3Jlc3VtZX0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHNsb3QgdG8gcGF1c2UuIExlYXZlIHVuZGVmaW5lZCB0byBwYXVzZSBldmVyeXRoaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gcGF1c2UgYWxsIHNvdW5kc1xuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnBhdXNlKCk7XG4gICAgICogLy8gcGF1c2UgYSBzcGVjaWZpYyBzb3VuZFxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnBhdXNlKCdiZWVwJyk7XG4gICAgICovXG4gICAgcGF1c2UobmFtZSkge1xuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuXG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBzbG90ID0gc2xvdHNbbmFtZV07XG4gICAgICAgICAgICBpZiAoIXNsb3QpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGF1c2Ugc291bmQgc2xvdCB3aXRoIG5hbWUgJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdGApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2xvdC5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgICAgICBzbG90c1trZXldLnBhdXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHBsYXliYWNrIG9mIHRoZSBzb3VuZCBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGlmIGl0J3MgcGF1c2VkLiBJZiBubyBuYW1lIGlzXG4gICAgICogc3BlY2lmaWVkIGFsbCBzbG90cyB3aWxsIGJlIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHNsb3QgdG8gcmVzdW1lLiBMZWF2ZSB1bmRlZmluZWQgdG8gcmVzdW1lIGV2ZXJ5dGhpbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyByZXN1bWUgYWxsIHNvdW5kc1xuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnJlc3VtZSgpO1xuICAgICAqIC8vIHJlc3VtZSBhIHNwZWNpZmljIHNvdW5kXG4gICAgICogdGhpcy5lbnRpdHkuc291bmQucmVzdW1lKCdiZWVwJyk7XG4gICAgICovXG4gICAgcmVzdW1lKG5hbWUpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcblxuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFzbG90KSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHJlc3VtZSBzb3VuZCBzbG90IHdpdGggbmFtZSAke25hbWV9IHdoaWNoIGRvZXMgbm90IGV4aXN0YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2xvdC5pc1BhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNsb3QucmVzdW1lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgICAgIHNsb3RzW2tleV0ucmVzdW1lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiB0aGUgc291bmQgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBpZiBpdCdzIHBhdXNlZC4gSWYgbm8gbmFtZSBpc1xuICAgICAqIHNwZWNpZmllZCBhbGwgc2xvdHMgd2lsbCBiZSBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90IHRvIHN0b3AuIExlYXZlIHVuZGVmaW5lZCB0byBzdG9wIGV2ZXJ5dGhpbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBzdG9wIGFsbCBzb3VuZHNcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5zdG9wKCk7XG4gICAgICogLy8gc3RvcCBhIHNwZWNpZmljIHNvdW5kXG4gICAgICogdGhpcy5lbnRpdHkuc291bmQuc3RvcCgnYmVlcCcpO1xuICAgICAqL1xuICAgIHN0b3AobmFtZSkge1xuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuXG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBzbG90ID0gc2xvdHNbbmFtZV07XG4gICAgICAgICAgICBpZiAoIXNsb3QpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gc3RvcCBzb3VuZCBzbG90IHdpdGggbmFtZSAke25hbWV9IHdoaWNoIGRvZXMgbm90IGV4aXN0YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzbG90LnN0b3AoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHNsb3RzKSB7XG4gICAgICAgICAgICAgICAgc2xvdHNba2V5XS5zdG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFNvdW5kQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU291bmRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl92b2x1bWUiLCJfcGl0Y2giLCJfcG9zaXRpb25hbCIsIl9yZWZEaXN0YW5jZSIsIl9tYXhEaXN0YW5jZSIsIl9yb2xsT2ZmRmFjdG9yIiwiX2Rpc3RhbmNlTW9kZWwiLCJESVNUQU5DRV9MSU5FQVIiLCJfc2xvdHMiLCJfcGxheWluZ0JlZm9yZURpc2FibGUiLCJfdXBkYXRlU291bmRJbnN0YW5jZXMiLCJwcm9wZXJ0eSIsInZhbHVlIiwiaXNGYWN0b3IiLCJzbG90cyIsImtleSIsInNsb3QiLCJvdmVybGFwIiwiaW5zdGFuY2VzIiwiaSIsImxlbiIsImxlbmd0aCIsImRpc3RhbmNlTW9kZWwiLCJtYXhEaXN0YW5jZSIsInJlZkRpc3RhbmNlIiwicm9sbE9mZkZhY3RvciIsInBpdGNoIiwidm9sdW1lIiwicG9zaXRpb25hbCIsIm5ld1ZhbHVlIiwib2xkTGVuZ3RoIiwiaXNQbGF5aW5nIiwiaXNTdXNwZW5kZWQiLCJjdXJyZW50VGltZSIsInN0b3AiLCJpbnN0YW5jZSIsIl9jcmVhdGVJbnN0YW5jZSIsInBsYXkiLCJwdXNoIiwib2xkVmFsdWUiLCJTb3VuZFNsb3QiLCJuYW1lIiwiZW5hYmxlZCIsIm9uRW5hYmxlIiwiX2luVG9vbHMiLCJwbGF5aW5nQmVmb3JlRGlzYWJsZSIsImF1dG9QbGF5IiwiaXNTdG9wcGVkIiwicmVzdW1lIiwiaXNMb2FkZWQiLCJsb2FkIiwib25EaXNhYmxlIiwicGF1c2UiLCJvblJlbW92ZSIsIm9mZiIsImFkZFNsb3QiLCJvcHRpb25zIiwiRGVidWciLCJ3YXJuIiwicGF0aCIsInJlbW92ZVNsb3QiLCJfZ2V0U2xvdFByb3BlcnR5IiwidW5kZWZpbmVkIiwiaXNQYXVzZWQiLCJFVkVOVF9QTEFZIiwiRVZFTlRfUEFVU0UiLCJFVkVOVF9SRVNVTUUiLCJFVkVOVF9TVE9QIiwiRVZFTlRfRU5EIl0sIm1hcHBpbmdzIjoiOzs7OztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1B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
