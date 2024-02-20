import { EventHandler } from '../../../core/event-handler.js';
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { SoundInstance } from '../../../platform/sound/instance.js';
import { SoundInstance3d } from '../../../platform/sound/instance3d.js';

// temporary object for creating instances
const instanceOptions = {
  volume: 0,
  pitch: 0,
  loop: false,
  startTime: 0,
  duration: 0,
  position: new Vec3(),
  maxDistance: 0,
  refDistance: 0,
  rollOffFactor: 0,
  distanceModel: 0,
  onPlay: null,
  onPause: null,
  onResume: null,
  onStop: null,
  onEnd: null
};

/**
 * The SoundSlot controls playback of an audio asset.
 *
 * @augments EventHandler
 * @category Sound
 */
class SoundSlot extends EventHandler {
  /**
   * Create a new SoundSlot.
   *
   * @param {import('./component.js').SoundComponent} component - The Component that created this
   * slot.
   * @param {string} [name] - The name of the slot. Defaults to 'Untitled'.
   * @param {object} [options] - Settings for the slot.
   * @param {number} [options.volume] - The playback volume, between 0 and 1.
   * @param {number} [options.pitch] - The relative pitch, default of 1, plays at normal pitch.
   * @param {boolean} [options.loop] - If true the sound will restart when it reaches the end.
   * @param {number} [options.startTime] - The start time from which the sound will start
   * playing.
   * @param {number} [options.duration] - The duration of the sound that the slot will play
   * starting from startTime.
   * @param {boolean} [options.overlap] - If true then sounds played from slot will be played
   * independently of each other. Otherwise the slot will first stop the current sound before
   * starting the new one.
   * @param {boolean} [options.autoPlay] - If true the slot will start playing as soon as its
   * audio asset is loaded.
   * @param {number} [options.asset] - The asset id of the audio asset that is going to be played
   * by this slot.
   */
  constructor(component, name = 'Untitled', options = {}) {
    super();
    /**
     * The name of the slot.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * An array that contains all the {@link SoundInstance}s currently being played by the slot.
     *
     * @type {SoundInstance[]}
     */
    this.instances = [];
    this._component = component;
    this._assets = component.system.app.assets;
    this._manager = component.system.manager;
    this.name = name;
    this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;
    this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
    this._loop = !!(options.loop !== undefined ? options.loop : false);
    this._duration = options.duration > 0 ? options.duration : null;
    this._startTime = Math.max(0, Number(options.startTime) || 0);
    this._overlap = !!options.overlap;
    this._autoPlay = !!options.autoPlay;
    this._firstNode = null;
    this._lastNode = null;
    this._asset = options.asset;
    if (this._asset instanceof Asset) {
      this._asset = this._asset.id;
    }
    this._onInstancePlayHandler = this._onInstancePlay.bind(this);
    this._onInstancePauseHandler = this._onInstancePause.bind(this);
    this._onInstanceResumeHandler = this._onInstanceResume.bind(this);
    this._onInstanceStopHandler = this._onInstanceStop.bind(this);
    this._onInstanceEndHandler = this._onInstanceEnd.bind(this);
  }

  /**
   * Plays a sound. If {@link SoundSlot#overlap} is true the new sound instance will be played
   * independently of any other instances already playing. Otherwise existing sound instances
   * will stop before playing the new sound.
   *
   * @returns {SoundInstance} The new sound instance.
   */
  play() {
    // stop if overlap is false
    if (!this.overlap) {
      this.stop();
    }

    // If not loaded and doesn't have asset - then we cannot play it.  Warn and exit.
    if (!this.isLoaded && !this._hasAsset()) {
      Debug.warn(`Trying to play SoundSlot ${this.name} but it is not loaded and doesn't have an asset.`);
      return undefined;
    }
    const instance = this._createInstance();
    this.instances.push(instance);

    // if not loaded then load first
    // and then set sound resource on the created instance
    if (!this.isLoaded) {
      const onLoad = function onLoad(sound) {
        const playWhenLoaded = instance._playWhenLoaded;
        instance.sound = sound;
        if (playWhenLoaded) {
          instance.play();
        }
      };
      this.off('load', onLoad);
      this.once('load', onLoad);
      this.load();
    } else {
      instance.play();
    }
    return instance;
  }

  /**
   * Pauses all sound instances. To continue playback call {@link SoundSlot#resume}.
   *
   * @returns {boolean} True if the sound instances paused successfully, false otherwise.
   */
  pause() {
    let paused = false;
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].pause()) {
        paused = true;
      }
    }
    return paused;
  }

  /**
   * Resumes playback of all paused sound instances.
   *
   * @returns {boolean} True if any instances were resumed.
   */
  resume() {
    let resumed = false;
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].resume()) resumed = true;
    }
    return resumed;
  }

  /**
   * Stops playback of all sound instances.
   *
   * @returns {boolean} True if any instances were stopped.
   */
  stop() {
    let stopped = false;
    const instances = this.instances;
    let i = instances.length;
    // do this in reverse order because as each instance
    // is stopped it will be removed from the instances array
    // by the instance stop event handler
    while (i--) {
      instances[i].stop();
      stopped = true;
    }
    instances.length = 0;
    return stopped;
  }

  /**
   * Loads the asset assigned to this slot.
   */
  load() {
    if (!this._hasAsset()) return;
    const asset = this._assets.get(this._asset);
    if (!asset) {
      this._assets.off('add:' + this._asset, this._onAssetAdd, this);
      this._assets.once('add:' + this._asset, this._onAssetAdd, this);
      return;
    }
    asset.off('remove', this._onAssetRemoved, this);
    asset.on('remove', this._onAssetRemoved, this);
    if (!asset.resource) {
      asset.off('load', this._onAssetLoad, this);
      asset.once('load', this._onAssetLoad, this);
      this._assets.load(asset);
      return;
    }
    this.fire('load', asset.resource);
  }

  /**
   * Connect external Web Audio API nodes. Any sound played by this slot will automatically
   * attach the specified nodes to the source that plays the sound. You need to pass the first
   * node of the node graph that you created externally and the last node of that graph. The
   * first node will be connected to the audio source and the last node will be connected to the
   * destination of the AudioContext (e.g. speakers).
   *
   * @param {AudioNode} firstNode - The first node that will be connected to the audio source of
   * sound instances.
   * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of
   * the AudioContext. If unspecified then the firstNode will be connected to the destination
   * instead.
   * @example
   * const context = app.systems.sound.context;
   * const analyzer = context.createAnalyzer();
   * const distortion = context.createWaveShaper();
   * const filter = context.createBiquadFilter();
   * analyzer.connect(distortion);
   * distortion.connect(filter);
   * slot.setExternalNodes(analyzer, filter);
   */
  setExternalNodes(firstNode, lastNode) {
    if (!firstNode) {
      console.error('The firstNode must have a valid AudioNode');
      return;
    }
    if (!lastNode) {
      lastNode = firstNode;
    }
    this._firstNode = firstNode;
    this._lastNode = lastNode;

    // update instances if not overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].setExternalNodes(firstNode, lastNode);
      }
    }
  }

  /**
   * Clears any external nodes set by {@link SoundSlot#setExternalNodes}.
   */
  clearExternalNodes() {
    this._firstNode = null;
    this._lastNode = null;

    // update instances if not overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].clearExternalNodes();
      }
    }
  }

  /**
   * Gets an array that contains the two external nodes set by {@link SoundSlot#setExternalNodes}.
   *
   * @returns {AudioNode[]} An array of 2 elements that contains the first and last nodes set by
   * {@link SoundSlot#setExternalNodes}.
   */
  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  /**
   * Reports whether an asset is set on this slot.
   *
   * @returns {boolean} Returns true if the slot has an asset assigned.
   * @private
   */
  _hasAsset() {
    // != intentional
    return this._asset != null;
  }

  /**
   * Creates a new {@link SoundInstance} with the properties of the slot.
   *
   * @returns {SoundInstance} The new instance.
   * @private
   */
  _createInstance() {
    let instance = null;
    const component = this._component;
    let sound = null;

    // get sound resource
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        sound = asset.resource;
      }
    }

    // initialize instance options
    const data = instanceOptions;
    data.volume = this._volume * component.volume;
    data.pitch = this._pitch * component.pitch;
    data.loop = this._loop;
    data.startTime = this._startTime;
    data.duration = this._duration;
    data.onPlay = this._onInstancePlayHandler;
    data.onPause = this._onInstancePauseHandler;
    data.onResume = this._onInstanceResumeHandler;
    data.onStop = this._onInstanceStopHandler;
    data.onEnd = this._onInstanceEndHandler;
    if (component.positional) {
      data.position.copy(component.entity.getPosition());
      data.maxDistance = component.maxDistance;
      data.refDistance = component.refDistance;
      data.rollOffFactor = component.rollOffFactor;
      data.distanceModel = component.distanceModel;
      instance = new SoundInstance3d(this._manager, sound, data);
    } else {
      instance = new SoundInstance(this._manager, sound, data);
    }

    // hook external audio nodes
    if (this._firstNode) {
      instance.setExternalNodes(this._firstNode, this._lastNode);
    }
    return instance;
  }
  _onInstancePlay(instance) {
    // propagate event to slot
    this.fire('play', instance);

    // propagate event to component
    this._component.fire('play', this, instance);
  }
  _onInstancePause(instance) {
    // propagate event to slot
    this.fire('pause', instance);

    // propagate event to component
    this._component.fire('pause', this, instance);
  }
  _onInstanceResume(instance) {
    // propagate event to slot
    this.fire('resume', instance);

    // propagate event to component
    this._component.fire('resume', this, instance);
  }
  _onInstanceStop(instance) {
    // remove instance that stopped
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    // propagate event to slot
    this.fire('stop', instance);

    // propagate event to component
    this._component.fire('stop', this, instance);
  }
  _onInstanceEnd(instance) {
    // remove instance that ended
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    // propagate event to slot
    this.fire('end', instance);

    // propagate event to component
    this._component.fire('end', this, instance);
  }
  _onAssetAdd(asset) {
    this.load();
  }
  _onAssetLoad(asset) {
    this.load();
  }
  _onAssetRemoved(asset) {
    asset.off('remove', this._onAssetRemoved, this);
    this._assets.off('add:' + asset.id, this._onAssetAdd, this);
    this.stop();
  }
  updatePosition(position) {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      instances[i].position = position;
    }
  }

  /**
   * The asset id.
   *
   * @type {number|null}
   */
  set asset(value) {
    const old = this._asset;
    if (old) {
      this._assets.off('add:' + old, this._onAssetAdd, this);
      const oldAsset = this._assets.get(old);
      if (oldAsset) {
        oldAsset.off('remove', this._onAssetRemoved, this);
      }
    }
    this._asset = value;
    if (this._asset instanceof Asset) {
      this._asset = this._asset.id;
    }

    // load asset if component and entity are enabled
    if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
      this.load();
    }
  }
  get asset() {
    return this._asset;
  }

  /**
   * If true the slot will begin playing as soon as it is loaded.
   *
   * @type {boolean}
   */
  set autoPlay(value) {
    this._autoPlay = !!value;
  }
  get autoPlay() {
    return this._autoPlay;
  }

  /**
   * The duration of the sound that the slot will play starting from startTime.
   *
   * @type {number}
   */
  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0) || null;

    // update instances if non overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].duration = this._duration;
      }
    }
  }
  get duration() {
    let assetDuration = 0;
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      assetDuration = asset != null && asset.resource ? asset.resource.duration : 0;
    }

    // != intentional
    if (this._duration != null) {
      return this._duration % (assetDuration || 1);
    }
    return assetDuration;
  }

  /**
   * Returns true if the asset of the slot is loaded.
   *
   * @type {boolean}
   */
  get isLoaded() {
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        return !!asset.resource;
      }
    }
    return false;
  }

  /**
   * Returns true if the slot is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    const instances = this.instances;
    const len = instances.length;
    if (len === 0) return false;
    for (let i = 0; i < len; i++) {
      if (!instances[i].isPaused) return false;
    }
    return true;
  }

  /**
   * Returns true if the slot is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].isPlaying) return true;
    }
    return false;
  }

  /**
   * Returns true if the slot is currently stopped.
   *
   * @type {boolean}
   */
  get isStopped() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (!instances[i].isStopped) return false;
    }
    return true;
  }

  /**
   * If true the slot will restart when it finishes playing.
   *
   * @type {boolean}
   */
  set loop(value) {
    this._loop = !!value;

    // update instances if non overlapping
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      instances[i].loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  /**
   * If true then sounds played from slot will be played independently of each other. Otherwise
   * the slot will first stop the current sound before starting the new one.
   *
   * @type {boolean}
   */
  set overlap(value) {
    this._overlap = !!value;
  }
  get overlap() {
    return this._overlap;
  }

  /**
   * The pitch modifier to play the sound with. Must be larger than 0.01.
   *
   * @type {number}
   */
  set pitch(value) {
    this._pitch = Math.max(Number(value) || 0, 0.01);

    // update instances if non overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].pitch = this.pitch * this._component.pitch;
      }
    }
  }
  get pitch() {
    return this._pitch;
  }

  /**
   * The start time from which the sound will start playing.
   *
   * @type {number}
   */
  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    // update instances if non overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].startTime = this._startTime;
      }
    }
  }
  get startTime() {
    return this._startTime;
  }

  /**
   * The volume modifier to play the sound with. In range 0-1.
   *
   * @type {number}
   */
  set volume(value) {
    this._volume = math.clamp(Number(value) || 0, 0, 1);

    // update instances if non overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].volume = this._volume * this._component.volume;
      }
    }
  }
  get volume() {
    return this._volume;
  }
}
/**
 * Fired when a {@link SoundInstance} starts playing on a slot. The handler is passed the sound
 * instance that started playing.
 *
 * @event
 * @example
 * slot.on('play', (instance) => {
 *     console.log('Sound instance started playing');
 * });
 */
SoundSlot.EVENT_PLAY = 'play';
/**
 * Fired when a {@link SoundInstance} is paused on a slot. The handler is passed the sound
 * instance that is paused.
 *
 * @event
 * @example
 * slot.on('pause', (instance) => {
 *     console.log('Sound instance paused');
 * });
 */
SoundSlot.EVENT_PAUSE = 'pause';
/**
 * Fired when a {@link SoundInstance} is resumed on a slot. The handler is passed the sound
 * instance that is resumed.
 *
 * @event
 * @example
 * slot.on('resume', (instance) => {
 *     console.log('Sound instance resumed');
 * });
 */
SoundSlot.EVENT_RESUME = 'resume';
/**
 * Fired when a {@link SoundInstance} is stopped on a slot. The handler is passed the sound
 * instance that is stopped.
 *
 * @event
 * @example
 * slot.on('stop', (instance) => {
 *     console.log('Sound instance stopped');
 * });
 */
SoundSlot.EVENT_STOP = 'stop';
/**
 * Fired when the sound {@link Asset} assigned to the slot is loaded. The handler is passed the
 * loaded {@link Sound} resource.
 *
 * @event
 * @example
 * slot.on('load', (sound) => {
 *     console.log('Sound resource loaded');
 * });
 */
SoundSlot.EVENT_LOAD = 'load';

export { SoundSlot };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3NvdW5kL3Nsb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU291bmRJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJztcbmltcG9ydCB7IFNvdW5kSW5zdGFuY2UzZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlM2QuanMnO1xuXG4vLyB0ZW1wb3Jhcnkgb2JqZWN0IGZvciBjcmVhdGluZyBpbnN0YW5jZXNcbmNvbnN0IGluc3RhbmNlT3B0aW9ucyA9IHtcbiAgICB2b2x1bWU6IDAsXG4gICAgcGl0Y2g6IDAsXG4gICAgbG9vcDogZmFsc2UsXG4gICAgc3RhcnRUaW1lOiAwLFxuICAgIGR1cmF0aW9uOiAwLFxuICAgIHBvc2l0aW9uOiBuZXcgVmVjMygpLFxuICAgIG1heERpc3RhbmNlOiAwLFxuICAgIHJlZkRpc3RhbmNlOiAwLFxuICAgIHJvbGxPZmZGYWN0b3I6IDAsXG4gICAgZGlzdGFuY2VNb2RlbDogMCxcbiAgICBvblBsYXk6IG51bGwsXG4gICAgb25QYXVzZTogbnVsbCxcbiAgICBvblJlc3VtZTogbnVsbCxcbiAgICBvblN0b3A6IG51bGwsXG4gICAgb25FbmQ6IG51bGxcbn07XG5cbi8qKlxuICogVGhlIFNvdW5kU2xvdCBjb250cm9scyBwbGF5YmFjayBvZiBhbiBhdWRpbyBhc3NldC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKiBAY2F0ZWdvcnkgU291bmRcbiAqL1xuY2xhc3MgU291bmRTbG90IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEge0BsaW5rIFNvdW5kSW5zdGFuY2V9IHN0YXJ0cyBwbGF5aW5nIG9uIGEgc2xvdC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSBzb3VuZFxuICAgICAqIGluc3RhbmNlIHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBzbG90Lm9uKCdwbGF5JywgKGluc3RhbmNlKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdTb3VuZCBpbnN0YW5jZSBzdGFydGVkIHBsYXlpbmcnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfUExBWSA9ICdwbGF5JztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgU291bmRJbnN0YW5jZX0gaXMgcGF1c2VkIG9uIGEgc2xvdC4gVGhlIGhhbmRsZXIgaXMgcGFzc2VkIHRoZSBzb3VuZFxuICAgICAqIGluc3RhbmNlIHRoYXQgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBzbG90Lm9uKCdwYXVzZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnU291bmQgaW5zdGFuY2UgcGF1c2VkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1BBVVNFID0gJ3BhdXNlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgU291bmRJbnN0YW5jZX0gaXMgcmVzdW1lZCBvbiBhIHNsb3QuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUgc291bmRcbiAgICAgKiBpbnN0YW5jZSB0aGF0IGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNsb3Qub24oJ3Jlc3VtZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnU291bmQgaW5zdGFuY2UgcmVzdW1lZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRVNVTUUgPSAncmVzdW1lJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgU291bmRJbnN0YW5jZX0gaXMgc3RvcHBlZCBvbiBhIHNsb3QuIFRoZSBoYW5kbGVyIGlzIHBhc3NlZCB0aGUgc291bmRcbiAgICAgKiBpbnN0YW5jZSB0aGF0IGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNsb3Qub24oJ3N0b3AnLCAoaW5zdGFuY2UpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1NvdW5kIGluc3RhbmNlIHN0b3BwZWQnKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGF0aWMgRVZFTlRfU1RPUCA9ICdzdG9wJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIHNvdW5kIHtAbGluayBBc3NldH0gYXNzaWduZWQgdG8gdGhlIHNsb3QgaXMgbG9hZGVkLiBUaGUgaGFuZGxlciBpcyBwYXNzZWQgdGhlXG4gICAgICogbG9hZGVkIHtAbGluayBTb3VuZH0gcmVzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNsb3Qub24oJ2xvYWQnLCAoc291bmQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1NvdW5kIHJlc291cmNlIGxvYWRlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9MT0FEID0gJ2xvYWQnO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHNsb3QuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUge0BsaW5rIFNvdW5kSW5zdGFuY2V9cyBjdXJyZW50bHkgYmVpbmcgcGxheWVkIGJ5IHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHR5cGUge1NvdW5kSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBpbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZFNsb3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Tb3VuZENvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIENvbXBvbmVudCB0aGF0IGNyZWF0ZWQgdGhpc1xuICAgICAqIHNsb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBTZXR0aW5ncyBmb3IgdGhlIHNsb3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoXSAtIFRoZSByZWxhdGl2ZSBwaXRjaCwgZGVmYXVsdCBvZiAxLCBwbGF5cyBhdCBub3JtYWwgcGl0Y2guXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5sb29wXSAtIElmIHRydWUgdGhlIHNvdW5kIHdpbGwgcmVzdGFydCB3aGVuIGl0IHJlYWNoZXMgdGhlIGVuZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnRUaW1lXSAtIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnRcbiAgICAgKiBwbGF5aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kdXJhdGlvbl0gLSBUaGUgZHVyYXRpb24gb2YgdGhlIHNvdW5kIHRoYXQgdGhlIHNsb3Qgd2lsbCBwbGF5XG4gICAgICogc3RhcnRpbmcgZnJvbSBzdGFydFRpbWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5vdmVybGFwXSAtIElmIHRydWUgdGhlbiBzb3VuZHMgcGxheWVkIGZyb20gc2xvdCB3aWxsIGJlIHBsYXllZFxuICAgICAqIGluZGVwZW5kZW50bHkgb2YgZWFjaCBvdGhlci4gT3RoZXJ3aXNlIHRoZSBzbG90IHdpbGwgZmlyc3Qgc3RvcCB0aGUgY3VycmVudCBzb3VuZCBiZWZvcmVcbiAgICAgKiBzdGFydGluZyB0aGUgbmV3IG9uZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmF1dG9QbGF5XSAtIElmIHRydWUgdGhlIHNsb3Qgd2lsbCBzdGFydCBwbGF5aW5nIGFzIHNvb24gYXMgaXRzXG4gICAgICogYXVkaW8gYXNzZXQgaXMgbG9hZGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hc3NldF0gLSBUaGUgYXNzZXQgaWQgb2YgdGhlIGF1ZGlvIGFzc2V0IHRoYXQgaXMgZ29pbmcgdG8gYmUgcGxheWVkXG4gICAgICogYnkgdGhpcyBzbG90LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbXBvbmVudCwgbmFtZSA9ICdVbnRpdGxlZCcsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gY29tcG9uZW50LnN5c3RlbS5tYW5hZ2VyO1xuXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gb3B0aW9ucy5waXRjaCAhPT0gdW5kZWZpbmVkID8gTWF0aC5tYXgoMC4wMSwgTnVtYmVyKG9wdGlvbnMucGl0Y2gpIHx8IDApIDogMTtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gPiAwID8gb3B0aW9ucy5kdXJhdGlvbiA6IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXAgPSAhIShvcHRpb25zLm92ZXJsYXApO1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhKG9wdGlvbnMuYXV0b1BsYXkpO1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSBvcHRpb25zLmFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXQgPSB0aGlzLl9hc3NldC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VQbGF5LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUGF1c2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25JbnN0YW5jZVJlc3VtZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VTdG9wLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZUVuZC5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBsYXlzIGEgc291bmQuIElmIHtAbGluayBTb3VuZFNsb3Qjb3ZlcmxhcH0gaXMgdHJ1ZSB0aGUgbmV3IHNvdW5kIGluc3RhbmNlIHdpbGwgYmUgcGxheWVkXG4gICAgICogaW5kZXBlbmRlbnRseSBvZiBhbnkgb3RoZXIgaW5zdGFuY2VzIGFscmVhZHkgcGxheWluZy4gT3RoZXJ3aXNlIGV4aXN0aW5nIHNvdW5kIGluc3RhbmNlc1xuICAgICAqIHdpbGwgc3RvcCBiZWZvcmUgcGxheWluZyB0aGUgbmV3IHNvdW5kLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NvdW5kSW5zdGFuY2V9IFRoZSBuZXcgc291bmQgaW5zdGFuY2UuXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgLy8gc3RvcCBpZiBvdmVybGFwIGlzIGZhbHNlXG4gICAgICAgIGlmICghdGhpcy5vdmVybGFwKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIG5vdCBsb2FkZWQgYW5kIGRvZXNuJ3QgaGF2ZSBhc3NldCAtIHRoZW4gd2UgY2Fubm90IHBsYXkgaXQuICBXYXJuIGFuZCBleGl0LlxuICAgICAgICBpZiAoIXRoaXMuaXNMb2FkZWQgJiYgIXRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFRyeWluZyB0byBwbGF5IFNvdW5kU2xvdCAke3RoaXMubmFtZX0gYnV0IGl0IGlzIG5vdCBsb2FkZWQgYW5kIGRvZXNuJ3QgaGF2ZSBhbiBhc3NldC5gKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXMuX2NyZWF0ZUluc3RhbmNlKCk7XG4gICAgICAgIHRoaXMuaW5zdGFuY2VzLnB1c2goaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIGlmIG5vdCBsb2FkZWQgdGhlbiBsb2FkIGZpcnN0XG4gICAgICAgIC8vIGFuZCB0aGVuIHNldCBzb3VuZCByZXNvdXJjZSBvbiB0aGUgY3JlYXRlZCBpbnN0YW5jZVxuICAgICAgICBpZiAoIXRoaXMuaXNMb2FkZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChzb3VuZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXlXaGVuTG9hZGVkID0gaW5zdGFuY2UuX3BsYXlXaGVuTG9hZGVkO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLnNvdW5kID0gc291bmQ7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXlXaGVuTG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnBsYXkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0aGlzLm9mZignbG9hZCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnN0YW5jZS5wbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGF1c2VzIGFsbCBzb3VuZCBpbnN0YW5jZXMuIFRvIGNvbnRpbnVlIHBsYXliYWNrIGNhbGwge0BsaW5rIFNvdW5kU2xvdCNyZXN1bWV9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNvdW5kIGluc3RhbmNlcyBwYXVzZWQgc3VjY2Vzc2Z1bGx5LCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIGxldCBwYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlc1tpXS5wYXVzZSgpKSB7XG4gICAgICAgICAgICAgICAgcGF1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwYXVzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBwbGF5YmFjayBvZiBhbGwgcGF1c2VkIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGFueSBpbnN0YW5jZXMgd2VyZSByZXN1bWVkLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgbGV0IHJlc3VtZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlc1tpXS5yZXN1bWUoKSlcbiAgICAgICAgICAgICAgICByZXN1bWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHBsYXliYWNrIG9mIGFsbCBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbnkgaW5zdGFuY2VzIHdlcmUgc3RvcHBlZC5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBsZXQgc3RvcHBlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBsZXQgaSA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIC8vIGRvIHRoaXMgaW4gcmV2ZXJzZSBvcmRlciBiZWNhdXNlIGFzIGVhY2ggaW5zdGFuY2VcbiAgICAgICAgLy8gaXMgc3RvcHBlZCBpdCB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgaW5zdGFuY2VzIGFycmF5XG4gICAgICAgIC8vIGJ5IHRoZSBpbnN0YW5jZSBzdG9wIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnN0b3AoKTtcbiAgICAgICAgICAgIHN0b3BwZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5zdGFuY2VzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgcmV0dXJuIHN0b3BwZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZHMgdGhlIGFzc2V0IGFzc2lnbmVkIHRvIHRoaXMgc2xvdC5cbiAgICAgKi9cbiAgICBsb2FkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2hhc0Fzc2V0KCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9hc3NldHMub25jZSgnYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcblxuICAgICAgICBpZiAoIWFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbkFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgdGhpcy5fb25Bc3NldExvYWQsIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLl9hc3NldHMubG9hZChhc3NldCk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnbG9hZCcsIGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IGV4dGVybmFsIFdlYiBBdWRpbyBBUEkgbm9kZXMuIEFueSBzb3VuZCBwbGF5ZWQgYnkgdGhpcyBzbG90IHdpbGwgYXV0b21hdGljYWxseVxuICAgICAqIGF0dGFjaCB0aGUgc3BlY2lmaWVkIG5vZGVzIHRvIHRoZSBzb3VyY2UgdGhhdCBwbGF5cyB0aGUgc291bmQuIFlvdSBuZWVkIHRvIHBhc3MgdGhlIGZpcnN0XG4gICAgICogbm9kZSBvZiB0aGUgbm9kZSBncmFwaCB0aGF0IHlvdSBjcmVhdGVkIGV4dGVybmFsbHkgYW5kIHRoZSBsYXN0IG5vZGUgb2YgdGhhdCBncmFwaC4gVGhlXG4gICAgICogZmlyc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIGFuZCB0aGUgbGFzdCBub2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZVxuICAgICAqIGRlc3RpbmF0aW9uIG9mIHRoZSBBdWRpb0NvbnRleHQgKGUuZy4gc3BlYWtlcnMpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IGZpcnN0Tm9kZSAtIFRoZSBmaXJzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBvZlxuICAgICAqIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gW2xhc3ROb2RlXSAtIFRoZSBsYXN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gb2ZcbiAgICAgKiB0aGUgQXVkaW9Db250ZXh0LiBJZiB1bnNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdE5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICogaW5zdGVhZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGNvbnRleHQgPSBhcHAuc3lzdGVtcy5zb3VuZC5jb250ZXh0O1xuICAgICAqIGNvbnN0IGFuYWx5emVyID0gY29udGV4dC5jcmVhdGVBbmFseXplcigpO1xuICAgICAqIGNvbnN0IGRpc3RvcnRpb24gPSBjb250ZXh0LmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgKiBjb25zdCBmaWx0ZXIgPSBjb250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAqIGFuYWx5emVyLmNvbm5lY3QoZGlzdG9ydGlvbik7XG4gICAgICogZGlzdG9ydGlvbi5jb25uZWN0KGZpbHRlcik7XG4gICAgICogc2xvdC5zZXRFeHRlcm5hbE5vZGVzKGFuYWx5emVyLCBmaWx0ZXIpO1xuICAgICAqL1xuICAgIHNldEV4dGVybmFsTm9kZXMoZmlyc3ROb2RlLCBsYXN0Tm9kZSkge1xuICAgICAgICBpZiAoIShmaXJzdE5vZGUpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgZmlyc3ROb2RlIG11c3QgaGF2ZSBhIHZhbGlkIEF1ZGlvTm9kZScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFsYXN0Tm9kZSkge1xuICAgICAgICAgICAgbGFzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbGFzdE5vZGU7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub3Qgb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyBhbnkgZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZFNsb3Qjc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgY2xlYXJFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub3Qgb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uY2xlYXJFeHRlcm5hbE5vZGVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHR3byBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kU2xvdCNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb05vZGVbXX0gQW4gYXJyYXkgb2YgMiBlbGVtZW50cyB0aGF0IGNvbnRhaW5zIHRoZSBmaXJzdCBhbmQgbGFzdCBub2RlcyBzZXQgYnlcbiAgICAgKiB7QGxpbmsgU291bmRTbG90I3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqL1xuICAgIGdldEV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIHJldHVybiBbdGhpcy5fZmlyc3ROb2RlLCB0aGlzLl9sYXN0Tm9kZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIGFuIGFzc2V0IGlzIHNldCBvbiB0aGlzIHNsb3QuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGhhcyBhbiBhc3NldCBhc3NpZ25lZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYXNBc3NldCgpIHtcbiAgICAgICAgLy8gIT0gaW50ZW50aW9uYWxcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0ICE9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyB7QGxpbmsgU291bmRJbnN0YW5jZX0gd2l0aCB0aGUgcHJvcGVydGllcyBvZiB0aGUgc2xvdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTb3VuZEluc3RhbmNlfSBUaGUgbmV3IGluc3RhbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZUluc3RhbmNlKCkge1xuICAgICAgICBsZXQgaW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudDtcblxuICAgICAgICBsZXQgc291bmQgPSBudWxsO1xuXG4gICAgICAgIC8vIGdldCBzb3VuZCByZXNvdXJjZVxuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHNvdW5kID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbml0aWFsaXplIGluc3RhbmNlIG9wdGlvbnNcbiAgICAgICAgY29uc3QgZGF0YSA9IGluc3RhbmNlT3B0aW9ucztcbiAgICAgICAgZGF0YS52b2x1bWUgPSB0aGlzLl92b2x1bWUgKiBjb21wb25lbnQudm9sdW1lO1xuICAgICAgICBkYXRhLnBpdGNoID0gdGhpcy5fcGl0Y2ggKiBjb21wb25lbnQucGl0Y2g7XG4gICAgICAgIGRhdGEubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIGRhdGEuc3RhcnRUaW1lID0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICBkYXRhLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG5cbiAgICAgICAgZGF0YS5vblBsYXkgPSB0aGlzLl9vbkluc3RhbmNlUGxheUhhbmRsZXI7XG4gICAgICAgIGRhdGEub25QYXVzZSA9IHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXI7XG4gICAgICAgIGRhdGEub25SZXN1bWUgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblN0b3AgPSB0aGlzLl9vbkluc3RhbmNlU3RvcEhhbmRsZXI7XG4gICAgICAgIGRhdGEub25FbmQgPSB0aGlzLl9vbkluc3RhbmNlRW5kSGFuZGxlcjtcblxuICAgICAgICBpZiAoY29tcG9uZW50LnBvc2l0aW9uYWwpIHtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24uY29weShjb21wb25lbnQuZW50aXR5LmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgZGF0YS5tYXhEaXN0YW5jZSA9IGNvbXBvbmVudC5tYXhEaXN0YW5jZTtcbiAgICAgICAgICAgIGRhdGEucmVmRGlzdGFuY2UgPSBjb21wb25lbnQucmVmRGlzdGFuY2U7XG4gICAgICAgICAgICBkYXRhLnJvbGxPZmZGYWN0b3IgPSBjb21wb25lbnQucm9sbE9mZkZhY3RvcjtcbiAgICAgICAgICAgIGRhdGEuZGlzdGFuY2VNb2RlbCA9IGNvbXBvbmVudC5kaXN0YW5jZU1vZGVsO1xuXG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBTb3VuZEluc3RhbmNlM2QodGhpcy5fbWFuYWdlciwgc291bmQsIGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgU291bmRJbnN0YW5jZSh0aGlzLl9tYW5hZ2VyLCBzb3VuZCwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBob29rIGV4dGVybmFsIGF1ZGlvIG5vZGVzXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgIGluc3RhbmNlLnNldEV4dGVybmFsTm9kZXModGhpcy5fZmlyc3ROb2RlLCB0aGlzLl9sYXN0Tm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VQbGF5KGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgncGxheScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdwbGF5JywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlUGF1c2UoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdwYXVzZScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdwYXVzZScsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVJlc3VtZShpbnN0YW5jZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3Jlc3VtZScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdyZXN1bWUnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VTdG9wKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHJlbW92ZSBpbnN0YW5jZSB0aGF0IHN0b3BwZWRcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5pbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgnc3RvcCcsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdzdG9wJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlRW5kKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHJlbW92ZSBpbnN0YW5jZSB0aGF0IGVuZGVkXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuaW5zdGFuY2VzLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ2VuZCcsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdlbmQnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubG9hZCgpO1xuICAgIH1cblxuICAgIF9vbkFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZVBvc2l0aW9uKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXNbaV0ucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgYXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fYXNzZXQ7XG5cbiAgICAgICAgaWYgKG9sZCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyBvbGQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgY29uc3Qgb2xkQXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KG9sZCk7XG4gICAgICAgICAgICBpZiAob2xkQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBvbGRBc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0ID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldCA9IHRoaXMuX2Fzc2V0LmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9hZCBhc3NldCBpZiBjb21wb25lbnQgYW5kIGVudGl0eSBhcmUgZW5hYmxlZFxuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSAmJiB0aGlzLl9jb21wb25lbnQuZW5hYmxlZCAmJiB0aGlzLl9jb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgc2xvdCB3aWxsIGJlZ2luIHBsYXlpbmcgYXMgc29vbiBhcyBpdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgYXV0b1BsYXkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXkgPSAhIXZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9QbGF5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgc2xvdCB3aWxsIHBsYXkgc3RhcnRpbmcgZnJvbSBzdGFydFRpbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkdXJhdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCkgfHwgbnVsbDtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBsZXQgYXNzZXREdXJhdGlvbiA9IDA7XG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXREdXJhdGlvbiA9IGFzc2V0Py5yZXNvdXJjZSA/IGFzc2V0LnJlc291cmNlLmR1cmF0aW9uIDogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICE9IGludGVudGlvbmFsXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZHVyYXRpb24gJSAoYXNzZXREdXJhdGlvbiB8fCAxKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXNzZXREdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGFzc2V0IG9mIHRoZSBzbG90IGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc0xvYWRlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gISFhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaXMgY3VycmVudGx5IHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BhdXNlZCgpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGlmIChsZW4gPT09IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCFpbnN0YW5jZXNbaV0uaXNQYXVzZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGxheWluZygpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0uaXNQbGF5aW5nKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBpcyBjdXJyZW50bHkgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N0b3BwZWQoKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlc1tpXS5pc1N0b3BwZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgc2xvdCB3aWxsIHJlc3RhcnQgd2hlbiBpdCBmaW5pc2hlcyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxvb3AodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhdmFsdWU7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb29wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZW4gc291bmRzIHBsYXllZCBmcm9tIHNsb3Qgd2lsbCBiZSBwbGF5ZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyLiBPdGhlcndpc2VcbiAgICAgKiB0aGUgc2xvdCB3aWxsIGZpcnN0IHN0b3AgdGhlIGN1cnJlbnQgc291bmQgYmVmb3JlIHN0YXJ0aW5nIHRoZSBuZXcgb25lLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IG92ZXJsYXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fb3ZlcmxhcCA9ICEhdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG92ZXJsYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdmVybGFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXRjaCBtb2RpZmllciB0byBwbGF5IHRoZSBzb3VuZCB3aXRoLiBNdXN0IGJlIGxhcmdlciB0aGFuIDAuMDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwaXRjaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9waXRjaCA9IE1hdGgubWF4KE51bWJlcih2YWx1ZSkgfHwgMCwgMC4wMSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0ucGl0Y2ggPSB0aGlzLnBpdGNoICogdGhpcy5fY29tcG9uZW50LnBpdGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBpdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3RhcnRUaW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RhcnRUaW1lID0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YXJ0VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdm9sdW1lIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIEluIHJhbmdlIDAtMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHZvbHVtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl92b2x1bWUgPSBtYXRoLmNsYW1wKE51bWJlcih2YWx1ZSkgfHwgMCwgMCwgMSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udm9sdW1lID0gdGhpcy5fdm9sdW1lICogdGhpcy5fY29tcG9uZW50LnZvbHVtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTb3VuZFNsb3QgfTtcbiJdLCJuYW1lcyI6WyJpbnN0YW5jZU9wdGlvbnMiLCJ2b2x1bWUiLCJwaXRjaCIsImxvb3AiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInBvc2l0aW9uIiwiVmVjMyIsIm1heERpc3RhbmNlIiwicmVmRGlzdGFuY2UiLCJyb2xsT2ZmRmFjdG9yIiwiZGlzdGFuY2VNb2RlbCIsIm9uUGxheSIsIm9uUGF1c2UiLCJvblJlc3VtZSIsIm9uU3RvcCIsIm9uRW5kIiwiU291bmRTbG90IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJjb21wb25lbnQiLCJuYW1lIiwib3B0aW9ucyIsImluc3RhbmNlcyIsIl9jb21wb25lbnQiLCJfYXNzZXRzIiwic3lzdGVtIiwiYXBwIiwiYXNzZXRzIiwiX21hbmFnZXIiLCJtYW5hZ2VyIiwiX3ZvbHVtZSIsInVuZGVmaW5lZCIsIm1hdGgiLCJjbGFtcCIsIk51bWJlciIsIl9waXRjaCIsIk1hdGgiLCJtYXgiLCJfbG9vcCIsIl9kdXJhdGlvbiIsIl9zdGFydFRpbWUiLCJfb3ZlcmxhcCIsIm92ZXJsYXAiLCJfYXV0b1BsYXkiLCJhdXRvUGxheSIsIl9maXJzdE5vZGUiLCJfbGFzdE5vZGUiLCJfYXNzZXQiLCJhc3NldCIsIkFzc2V0IiwiaWQiLCJfb25JbnN0YW5jZVBsYXlIYW5kbGVyIiwiX29uSW5zdGFuY2VQbGF5IiwiYmluZCIsIl9vbkluc3RhbmNlUGF1c2VIYW5kbGVyIiwiX29uSW5zdGFuY2VQYXVzZSIsIl9vbkluc3RhbmNlUmVzdW1lSGFuZGxlciIsIl9vbkluc3RhbmNlUmVzdW1lIiwiX29uSW5zdGFuY2VTdG9wSGFuZGxlciIsIl9vbkluc3RhbmNlU3RvcCIsIl9vbkluc3RhbmNlRW5kSGFuZGxlciIsIl9vbkluc3RhbmNlRW5kIiwicGxheSIsInN0b3AiLCJpc0xvYWRlZCIsIl9oYXNBc3NldCIsIkRlYnVnIiwid2FybiIsImluc3RhbmNlIiwiX2NyZWF0ZUluc3RhbmNlIiwicHVzaCIsIm9uTG9hZCIsInNvdW5kIiwicGxheVdoZW5Mb2FkZWQiLCJfcGxheVdoZW5Mb2FkZWQiLCJvZmYiLCJvbmNlIiwibG9hZCIsInBhdXNlIiwicGF1c2VkIiwiaSIsImxlbiIsImxlbmd0aCIsInJlc3VtZSIsInJlc3VtZWQiLCJzdG9wcGVkIiwiZ2V0IiwiX29uQXNzZXRBZGQiLCJfb25Bc3NldFJlbW92ZWQiLCJvbiIsInJlc291cmNlIiwiX29uQXNzZXRMb2FkIiwiZmlyZSIsInNldEV4dGVybmFsTm9kZXMiLCJmaXJzdE5vZGUiLCJsYXN0Tm9kZSIsImNvbnNvbGUiLCJlcnJvciIsImNsZWFyRXh0ZXJuYWxOb2RlcyIsImdldEV4dGVybmFsTm9kZXMiLCJkYXRhIiwicG9zaXRpb25hbCIsImNvcHkiLCJlbnRpdHkiLCJnZXRQb3NpdGlvbiIsIlNvdW5kSW5zdGFuY2UzZCIsIlNvdW5kSW5zdGFuY2UiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwidXBkYXRlUG9zaXRpb24iLCJ2YWx1ZSIsIm9sZCIsIm9sZEFzc2V0IiwiZW5hYmxlZCIsImFzc2V0RHVyYXRpb24iLCJpc1BhdXNlZCIsImlzUGxheWluZyIsImlzU3RvcHBlZCIsIkVWRU5UX1BMQVkiLCJFVkVOVF9QQVVTRSIsIkVWRU5UX1JFU1VNRSIsIkVWRU5UX1NUT1AiLCJFVkVOVF9MT0FEIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQVdBO0FBQ0EsTUFBTUEsZUFBZSxHQUFHO0FBQ3BCQyxFQUFBQSxNQUFNLEVBQUUsQ0FBQztBQUNUQyxFQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxFQUFBQSxJQUFJLEVBQUUsS0FBSztBQUNYQyxFQUFBQSxTQUFTLEVBQUUsQ0FBQztBQUNaQyxFQUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNYQyxFQUFBQSxRQUFRLEVBQUUsSUFBSUMsSUFBSSxFQUFFO0FBQ3BCQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztBQUNkQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztBQUNkQyxFQUFBQSxhQUFhLEVBQUUsQ0FBQztBQUNoQkMsRUFBQUEsYUFBYSxFQUFFLENBQUM7QUFDaEJDLEVBQUFBLE1BQU0sRUFBRSxJQUFJO0FBQ1pDLEVBQUFBLE9BQU8sRUFBRSxJQUFJO0FBQ2JDLEVBQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2RDLEVBQUFBLE1BQU0sRUFBRSxJQUFJO0FBQ1pDLEVBQUFBLEtBQUssRUFBRSxJQUFBO0FBQ1gsQ0FBQyxDQUFBOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFNBQVMsU0FBU0MsWUFBWSxDQUFDO0FBMkVqQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxTQUFTLEVBQUVDLElBQUksR0FBRyxVQUFVLEVBQUVDLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFDcEQsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQXJDWDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FELElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVK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
