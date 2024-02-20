import { EventHandler } from '../../core/event-handler.js';
import { math } from '../../core/math/math.js';
import { hasAudioContext } from '../audio/capabilities.js';

const STATE_PLAYING = 0;
const STATE_PAUSED = 1;
const STATE_STOPPED = 2;

/**
 * Return time % duration but always return a number instead of NaN when duration is 0.
 *
 * @param {number} time - The time.
 * @param {number} duration - The duration.
 * @returns {number} The time % duration.
 * @ignore
 */
function capTime(time, duration) {
  return time % duration || 0;
}

/**
 * A SoundInstance plays a {@link Sound}.
 *
 * @augments EventHandler
 * @category Sound
 */
class SoundInstance extends EventHandler {
  /**
   * Create a new SoundInstance instance.
   *
   * @param {import('./manager.js').SoundManager} manager - The sound manager.
   * @param {import('./sound.js').Sound} sound - The sound to play.
   * @param {object} options - Options for the instance.
   * @param {number} [options.volume] - The playback volume, between 0 and 1. Defaults to 1.
   * @param {number} [options.pitch] - The relative pitch. Defaults to 1 (plays at normal pitch).
   * @param {boolean} [options.loop] - Whether the sound should loop when it reaches the end or
   * not. Defaults to false.
   * @param {number} [options.startTime] - The time from which the playback will start in
   * seconds. Default is 0 to start at the beginning. Defaults to 0.
   * @param {number} [options.duration] - The total time after the startTime in seconds when
   * playback will stop or restart if loop is true. Defaults to 0.
   * @param {Function} [options.onPlay] - Function called when the instance starts playing.
   * @param {Function} [options.onPause] - Function called when the instance is paused.
   * @param {Function} [options.onResume] - Function called when the instance is resumed.
   * @param {Function} [options.onStop] - Function called when the instance is stopped.
   * @param {Function} [options.onEnd] - Function called when the instance ends.
   */
  constructor(manager, sound, options) {
    super();

    /**
     * @type {import('./manager.js').SoundManager}
     * @private
     */
    /**
     * Gets the source that plays the sound resource. If the Web Audio API is not supported the
     * type of source is [Audio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio).
     * Source is only available after calling play.
     *
     * @type {AudioBufferSourceNode}
     */
    this.source = null;
    this._manager = manager;

    /**
     * @type {number}
     * @private
     */
    this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;

    /**
     * @type {number}
     * @private
     */
    this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;

    /**
     * @type {boolean}
     * @private
     */
    this._loop = !!(options.loop !== undefined ? options.loop : false);

    /**
     * @type {import('./sound.js').Sound}
     * @private
     */
    this._sound = sound;

    /**
     * Start at 'stopped'.
     *
     * @type {number}
     * @private
     */
    this._state = STATE_STOPPED;

    /**
     * True if the manager was suspended.
     *
     * @type {boolean}
     * @private
     */
    this._suspended = false;

    /**
     * Greater than 0 if we want to suspend the event handled to the 'onended' event.
     * When an 'onended' event is suspended, this counter is decremented by 1.
     * When a future 'onended' event is to be suspended, this counter is incremented by 1.
     *
     * @type {number}
     * @private
     */
    this._suspendEndEvent = 0;

    /**
     * True if we want to suspend firing instance events.
     *
     * @type {boolean}
     * @private
     */
    this._suspendInstanceEvents = false;

    /**
     * If true then the instance will start playing its source when its created.
     *
     * @type {boolean}
     * @private
     */
    this._playWhenLoaded = true;

    /**
     * @type {number}
     * @private
     */
    this._startTime = Math.max(0, Number(options.startTime) || 0);

    /**
     * @type {number}
     * @private
     */
    this._duration = Math.max(0, Number(options.duration) || 0);

    /**
     * @type {number|null}
     * @private
     */
    this._startOffset = null;

    // external event handlers
    /** @private */
    this._onPlayCallback = options.onPlay;
    /** @private */
    this._onPauseCallback = options.onPause;
    /** @private */
    this._onResumeCallback = options.onResume;
    /** @private */
    this._onStopCallback = options.onStop;
    /** @private */
    this._onEndCallback = options.onEnd;
    if (hasAudioContext()) {
      /**
       * @type {number}
       * @private
       */
      this._startedAt = 0;

      /**
       * Manually keep track of the playback position because the Web Audio API does not
       * provide a way to do this accurately if the playbackRate is not 1.
       *
       * @type {number}
       * @private
       */
      this._currentTime = 0;

      /**
       * @type {number}
       * @private
       */
      this._currentOffset = 0;

      /**
       * The input node is the one that is connected to the source.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._inputNode = null;

      /**
       * The connected node is the one that is connected to the destination (speakers). Any
       * external nodes will be connected to this node.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._connectorNode = null;

      /**
       * The first external node set by a user.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._firstNode = null;

      /**
       * The last external node set by a user.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._lastNode = null;

      /**
       * Set to true if a play() request was issued when the AudioContext was still suspended,
       * and will therefore wait until it is resumed to play the audio.
       *
       * @type {boolean}
       * @private
       */
      this._waitingContextSuspension = false;
      this._initializeNodes();

      /** @private */
      this._endedHandler = this._onEnded.bind(this);
    } else {
      /** @private */
      this._isReady = false;

      /** @private */
      this._loadedMetadataHandler = this._onLoadedMetadata.bind(this);
      /** @private */
      this._timeUpdateHandler = this._onTimeUpdate.bind(this);
      /** @private */
      this._endedHandler = this._onEnded.bind(this);
      this._createSource();
    }
  }

  /**
   * Gets or sets the current time of the sound that is playing. If the value provided is bigger
   * than the duration of the instance it will wrap from the beginning.
   *
   * @type {number}
   */
  set currentTime(value) {
    if (value < 0) return;
    if (this._state === STATE_PLAYING) {
      const suspend = this._suspendInstanceEvents;
      this._suspendInstanceEvents = true;

      // stop first which will set _startOffset to null
      this.stop();

      // set _startOffset and play
      this._startOffset = value;
      this.play();
      this._suspendInstanceEvents = suspend;
    } else {
      // set _startOffset which will be used when the instance will start playing
      this._startOffset = value;
      // set _currentTime
      this._currentTime = value;
    }
  }
  get currentTime() {
    // if the user has set the currentTime and we have not used it yet
    // then just return that
    if (this._startOffset !== null) {
      return this._startOffset;
    }

    // if the sound is paused return the currentTime calculated when
    // pause() was called
    if (this._state === STATE_PAUSED) {
      return this._currentTime;
    }

    // if the sound is stopped or we don't have a source
    // return 0
    if (this._state === STATE_STOPPED || !this.source) {
      return 0;
    }

    // recalculate current time
    this._updateCurrentTime();
    return this._currentTime;
  }

  /**
   * The duration of the sound that the instance will play starting from startTime.
   *
   * @type {number}
   */
  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0);

    // restart
    const isPlaying = this._state === STATE_PLAYING;
    this.stop();
    if (isPlaying) {
      this.play();
    }
  }
  get duration() {
    if (!this._sound) {
      return 0;
    }
    if (this._duration) {
      return capTime(this._duration, this._sound.duration);
    }
    return this._sound.duration;
  }

  /**
   * Returns true if the instance is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    return this._state === STATE_PAUSED;
  }

  /**
   * Returns true if the instance is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    return this._state === STATE_PLAYING;
  }

  /**
   * Returns true if the instance is currently stopped.
   *
   * @type {boolean}
   */
  get isStopped() {
    return this._state === STATE_STOPPED;
  }

  /**
   * Returns true if the instance is currently suspended because the window is not focused.
   *
   * @type {boolean}
   */
  get isSuspended() {
    return this._suspended;
  }

  /**
   * If true the instance will restart when it finishes playing.
   *
   * @type {boolean}
   */
  set loop(value) {
    this._loop = !!value;
    if (this.source) {
      this.source.loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  /**
   * The pitch modifier to play the sound with. Must be larger than 0.01.
   *
   * @type {number}
   */
  set pitch(pitch) {
    // set offset to current time so that
    // we calculate the rest of the time with the new pitch
    // from now on
    this._currentOffset = this.currentTime;
    this._startedAt = this._manager.context.currentTime;
    this._pitch = Math.max(Number(pitch) || 0, 0.01);
    if (this.source) {
      this.source.playbackRate.value = this._pitch;
    }
  }
  get pitch() {
    return this._pitch;
  }

  /**
   * The sound resource that the instance will play.
   *
   * @type {import('./sound.js').Sound}
   */
  set sound(value) {
    this._sound = value;
    if (this._state !== STATE_STOPPED) {
      this.stop();
    } else {
      this._createSource();
    }
  }
  get sound() {
    return this._sound;
  }

  /**
   * The start time from which the sound will start playing.
   *
   * @type {number}
   */
  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    // restart
    const isPlaying = this._state === STATE_PLAYING;
    this.stop();
    if (isPlaying) {
      this.play();
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
  set volume(volume) {
    volume = math.clamp(volume, 0, 1);
    this._volume = volume;
    if (this.gain) {
      this.gain.gain.value = volume * this._manager.volume;
    }
  }
  get volume() {
    return this._volume;
  }

  /** @private */
  _onPlay() {
    this.fire('play');
    if (this._onPlayCallback) this._onPlayCallback(this);
  }

  /** @private */
  _onPause() {
    this.fire('pause');
    if (this._onPauseCallback) this._onPauseCallback(this);
  }

  /** @private */
  _onResume() {
    this.fire('resume');
    if (this._onResumeCallback) this._onResumeCallback(this);
  }

  /** @private */
  _onStop() {
    this.fire('stop');
    if (this._onStopCallback) this._onStopCallback(this);
  }

  /** @private */
  _onEnded() {
    // the callback is not fired synchronously
    // so only decrement _suspendEndEvent when the
    // callback is fired
    if (this._suspendEndEvent > 0) {
      this._suspendEndEvent--;
      return;
    }
    this.fire('end');
    if (this._onEndCallback) this._onEndCallback(this);
    this.stop();
  }

  /**
   * Handle the manager's 'volumechange' event.
   *
   * @private
   */
  _onManagerVolumeChange() {
    this.volume = this._volume;
  }

  /**
   * Handle the manager's 'suspend' event.
   *
   * @private
   */
  _onManagerSuspend() {
    if (this._state === STATE_PLAYING && !this._suspended) {
      this._suspended = true;
      this.pause();
    }
  }

  /**
   * Handle the manager's 'resume' event.
   *
   * @private
   */
  _onManagerResume() {
    if (this._suspended) {
      this._suspended = false;
      this.resume();
    }
  }

  /**
   * Creates internal audio nodes and connects them.
   *
   * @private
   */
  _initializeNodes() {
    // create gain node for volume control
    this.gain = this._manager.context.createGain();
    this._inputNode = this.gain;
    // the gain node is also the connector node for 2D sound instances
    this._connectorNode = this.gain;
    this._connectorNode.connect(this._manager.context.destination);
  }

  /**
   * Attempt to begin playback the sound.
   * If the AudioContext is suspended, the audio will only start once it's resumed.
   * If the sound is already playing, this will restart the sound.
   *
   * @returns {boolean} True if the sound was started immediately.
   */
  play() {
    if (this._state !== STATE_STOPPED) {
      this.stop();
    }
    // set state to playing
    this._state = STATE_PLAYING;
    // no need for this anymore
    this._playWhenLoaded = false;

    // play() was already issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return false;
    }

    // manager is suspended so audio cannot start now - wait for manager to resume
    if (this._manager.suspended) {
      this._manager.once('resume', this._playAudioImmediate, this);
      this._waitingContextSuspension = true;
      return false;
    }
    this._playAudioImmediate();
    return true;
  }

  /**
   * Immediately play the sound.
   * This method assumes the AudioContext is ready (not suspended or locked).
   *
   * @private
   */
  _playAudioImmediate() {
    this._waitingContextSuspension = false;

    // between play() and the manager being ready to play, a stop() or pause() call was made
    if (this._state !== STATE_PLAYING) {
      return;
    }
    if (!this.source) {
      this._createSource();
    }

    // calculate start offset
    let offset = capTime(this._startOffset, this.duration);
    offset = capTime(this._startTime + offset, this._sound.duration);
    // reset start offset now that we started the sound
    this._startOffset = null;

    // start source with specified offset and duration
    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }

    // reset times
    this._startedAt = this._manager.context.currentTime;
    this._currentTime = 0;
    this._currentOffset = offset;

    // Initialize volume and loop - note moved to be after start() because of Chrome bug
    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;

    // handle suspend events / volumechange events
    this._manager.on('volumechange', this._onManagerVolumeChange, this);
    this._manager.on('suspend', this._onManagerSuspend, this);
    this._manager.on('resume', this._onManagerResume, this);
    this._manager.on('destroy', this._onManagerDestroy, this);
    if (!this._suspendInstanceEvents) {
      this._onPlay();
    }
  }

  /**
   * Pauses playback of sound. Call resume() to resume playback from the same position.
   *
   * @returns {boolean} Returns true if the sound was paused.
   */
  pause() {
    // no need for this anymore
    this._playWhenLoaded = false;
    if (this._state !== STATE_PLAYING) return false;

    // set state to paused
    this._state = STATE_PAUSED;

    // play() was issued but hasn't actually started yet.
    if (this._waitingContextSuspension) {
      return true;
    }

    // store current time
    this._updateCurrentTime();

    // Stop the source and re-create it because we cannot reuse the same source.
    // Suspend the end event as we are manually stopping the source
    this._suspendEndEvent++;
    this.source.stop(0);
    this.source = null;

    // reset user-set start offset
    this._startOffset = null;
    if (!this._suspendInstanceEvents) this._onPause();
    return true;
  }

  /**
   * Resumes playback of the sound. Playback resumes at the point that the audio was paused.
   *
   * @returns {boolean} Returns true if the sound was resumed.
   */
  resume() {
    if (this._state !== STATE_PAUSED) {
      return false;
    }

    // start at point where sound was paused
    let offset = this.currentTime;

    // set state back to playing
    this._state = STATE_PLAYING;

    // play() was issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return true;
    }
    if (!this.source) {
      this._createSource();
    }

    // if the user set the 'currentTime' property while the sound
    // was paused then use that as the offset instead
    if (this._startOffset !== null) {
      offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);

      // reset offset
      this._startOffset = null;
    }

    // start source
    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }
    this._startedAt = this._manager.context.currentTime;
    this._currentOffset = offset;

    // Initialize parameters
    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;
    this._playWhenLoaded = false;
    if (!this._suspendInstanceEvents) this._onResume();
    return true;
  }

  /**
   * Stops playback of sound. Calling play() again will restart playback from the beginning of
   * the sound.
   *
   * @returns {boolean} Returns true if the sound was stopped.
   */
  stop() {
    this._playWhenLoaded = false;
    if (this._state === STATE_STOPPED) return false;

    // set state to stopped
    const wasPlaying = this._state === STATE_PLAYING;
    this._state = STATE_STOPPED;

    // play() was issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return true;
    }

    // unsubscribe from manager events
    this._manager.off('volumechange', this._onManagerVolumeChange, this);
    this._manager.off('suspend', this._onManagerSuspend, this);
    this._manager.off('resume', this._onManagerResume, this);
    this._manager.off('destroy', this._onManagerDestroy, this);

    // reset stored times
    this._startedAt = 0;
    this._currentTime = 0;
    this._currentOffset = 0;
    this._startOffset = null;
    this._suspendEndEvent++;
    if (wasPlaying && this.source) {
      this.source.stop(0);
    }
    this.source = null;
    if (!this._suspendInstanceEvents) this._onStop();
    return true;
  }

  /**
   * Connects external Web Audio API nodes. You need to pass the first node of the node graph
   * that you created externally and the last node of that graph. The first node will be
   * connected to the audio source and the last node will be connected to the destination of the
   * AudioContext (e.g. speakers). Requires Web Audio API support.
   *
   * @param {AudioNode} firstNode - The first node that will be connected to the audio source of sound instances.
   * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of the AudioContext.
   * If unspecified then the firstNode will be connected to the destination instead.
   * @example
   * const context = app.systems.sound.context;
   * const analyzer = context.createAnalyzer();
   * const distortion = context.createWaveShaper();
   * const filter = context.createBiquadFilter();
   * analyzer.connect(distortion);
   * distortion.connect(filter);
   * instance.setExternalNodes(analyzer, filter);
   */
  setExternalNodes(firstNode, lastNode) {
    if (!firstNode) {
      console.error('The firstNode must be a valid Audio Node');
      return;
    }
    if (!lastNode) {
      lastNode = firstNode;
    }

    // connections are:
    // source -> inputNode -> connectorNode -> [firstNode -> ... -> lastNode] -> speakers

    const speakers = this._manager.context.destination;
    if (this._firstNode !== firstNode) {
      if (this._firstNode) {
        // if firstNode already exists means the connector node
        // is connected to it so disconnect it
        this._connectorNode.disconnect(this._firstNode);
      } else {
        // if firstNode does not exist means that its connected
        // to the speakers so disconnect it
        this._connectorNode.disconnect(speakers);
      }

      // set first node and connect with connector node
      this._firstNode = firstNode;
      this._connectorNode.connect(firstNode);
    }
    if (this._lastNode !== lastNode) {
      if (this._lastNode) {
        // if last node exists means it's connected to the speakers so disconnect it
        this._lastNode.disconnect(speakers);
      }

      // set last node and connect with speakers
      this._lastNode = lastNode;
      this._lastNode.connect(speakers);
    }
  }

  /**
   * Clears any external nodes set by {@link SoundInstance#setExternalNodes}.
   */
  clearExternalNodes() {
    const speakers = this._manager.context.destination;

    // break existing connections
    if (this._firstNode) {
      this._connectorNode.disconnect(this._firstNode);
      this._firstNode = null;
    }
    if (this._lastNode) {
      this._lastNode.disconnect(speakers);
      this._lastNode = null;
    }

    // reset connect to speakers
    this._connectorNode.connect(speakers);
  }

  /**
   * Gets any external nodes set by {@link SoundInstance#setExternalNodes}.
   *
   * @returns {AudioNode[]} Returns an array that contains the two nodes set by
   * {@link SoundInstance#setExternalNodes}.
   */
  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  /**
   * Creates the source for the instance.
   *
   * @returns {AudioBufferSourceNode|null} Returns the created source or null if the sound
   * instance has no {@link Sound} associated with it.
   * @private
   */
  _createSource() {
    if (!this._sound) {
      return null;
    }
    const context = this._manager.context;
    if (this._sound.buffer) {
      this.source = context.createBufferSource();
      this.source.buffer = this._sound.buffer;

      // Connect up the nodes
      this.source.connect(this._inputNode);

      // set events
      this.source.onended = this._endedHandler;

      // set loopStart and loopEnd so that the source starts and ends at the correct user-set times
      this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
      if (this._duration) {
        this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
      }
    }
    return this.source;
  }

  /**
   * Sets the current time taking into account the time the instance started playing, the current
   * pitch and the current time offset.
   *
   * @private
   */
  _updateCurrentTime() {
    this._currentTime = capTime((this._manager.context.currentTime - this._startedAt) * this._pitch + this._currentOffset, this.duration);
  }

  /**
   * Handle the manager's 'destroy' event.
   *
   * @private
   */
  _onManagerDestroy() {
    if (this.source && this._state === STATE_PLAYING) {
      this.source.stop(0);
      this.source = null;
    }
  }
}
/**
 * Fired when the instance starts playing its source.
 *
 * @event
 * @example
 * instance.on('play', () => {
 *     console.log('Instance started playing');
 * });
 */
SoundInstance.EVENT_PLAY = 'play';
/**
 * Fired when the instance is paused.
 *
 * @event
 * @example
 * instance.on('pause', () => {
 *     console.log('Instance paused');
 * });
 */
SoundInstance.EVENT_PAUSE = 'pause';
/**
 * Fired when the instance is resumed.
 *
 * @event
 * @example
 * instance.on('resume', () => {
 *     console.log('Instance resumed');
 * });
 */
SoundInstance.EVENT_RESUME = 'resume';
/**
 * Fired when the instance is stopped.
 *
 * @event
 * @example
 * instance.on('stop', () => {
 *     console.log('Instance stopped');
 * });
 */
SoundInstance.EVENT_STOP = 'stop';
/**
 * Fired when the sound currently played by the instance ends.
 *
 * @event
 * @example
 * instance.on('end', () => {
 *     console.log('Instance ended');
 * });
 */
SoundInstance.EVENT_END = 'end';
if (!hasAudioContext()) {
  Object.assign(SoundInstance.prototype, {
    play: function () {
      if (this._state !== STATE_STOPPED) {
        this.stop();
      }
      if (!this.source) {
        if (!this._createSource()) {
          return false;
        }
      }
      this.volume = this._volume;
      this.pitch = this._pitch;
      this.loop = this._loop;
      this.source.play();
      this._state = STATE_PLAYING;
      this._playWhenLoaded = false;
      this._manager.on('volumechange', this._onManagerVolumeChange, this);
      this._manager.on('suspend', this._onManagerSuspend, this);
      this._manager.on('resume', this._onManagerResume, this);
      this._manager.on('destroy', this._onManagerDestroy, this);

      // suspend immediately if manager is suspended
      if (this._manager.suspended) this._onManagerSuspend();
      if (!this._suspendInstanceEvents) this._onPlay();
      return true;
    },
    pause: function () {
      if (!this.source || this._state !== STATE_PLAYING) return false;
      this._suspendEndEvent++;
      this.source.pause();
      this._playWhenLoaded = false;
      this._state = STATE_PAUSED;
      this._startOffset = null;
      if (!this._suspendInstanceEvents) this._onPause();
      return true;
    },
    resume: function () {
      if (!this.source || this._state !== STATE_PAUSED) return false;
      this._state = STATE_PLAYING;
      this._playWhenLoaded = false;
      if (this.source.paused) {
        this.source.play();
        if (!this._suspendInstanceEvents) this._onResume();
      }
      return true;
    },
    stop: function () {
      if (!this.source || this._state === STATE_STOPPED) return false;
      this._manager.off('volumechange', this._onManagerVolumeChange, this);
      this._manager.off('suspend', this._onManagerSuspend, this);
      this._manager.off('resume', this._onManagerResume, this);
      this._manager.off('destroy', this._onManagerDestroy, this);
      this._suspendEndEvent++;
      this.source.pause();
      this._playWhenLoaded = false;
      this._state = STATE_STOPPED;
      this._startOffset = null;
      if (!this._suspendInstanceEvents) this._onStop();
      return true;
    },
    setExternalNodes: function () {
      // not supported
    },
    clearExternalNodes: function () {
      // not supported
    },
    getExternalNodes: function () {
      // not supported but return same type of result
      return [null, null];
    },
    // Sets start time after loadedmetadata is fired which is required by most browsers
    _onLoadedMetadata: function () {
      this.source.removeEventListener('loadedmetadata', this._loadedMetadataHandler);
      this._isReady = true;

      // calculate start time for source
      let offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);
      // reset currentTime
      this._startOffset = null;

      // set offset on source
      this.source.currentTime = offset;
    },
    _createSource: function () {
      if (this._sound && this._sound.audio) {
        this._isReady = false;
        this.source = this._sound.audio.cloneNode(true);

        // set events
        this.source.addEventListener('loadedmetadata', this._loadedMetadataHandler);
        this.source.addEventListener('timeupdate', this._timeUpdateHandler);
        this.source.onended = this._endedHandler;
      }
      return this.source;
    },
    // called every time the 'currentTime' is changed
    _onTimeUpdate: function () {
      if (!this._duration) return;

      // if the currentTime passes the end then if looping go back to the beginning
      // otherwise manually stop
      if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
        if (this.loop) {
          this.source.currentTime = capTime(this._startTime, this.source.duration);
        } else {
          // remove listener to prevent multiple calls
          this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
          this.source.pause();

          // call this manually because it doesn't work in all browsers in this case
          this._onEnded();
        }
      }
    },
    _onManagerDestroy: function () {
      if (this.source) {
        this.source.pause();
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'volume', {
    get: function () {
      return this._volume;
    },
    set: function (volume) {
      volume = math.clamp(volume, 0, 1);
      this._volume = volume;
      if (this.source) {
        this.source.volume = volume * this._manager.volume;
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'pitch', {
    get: function () {
      return this._pitch;
    },
    set: function (pitch) {
      this._pitch = Math.max(Number(pitch) || 0, 0.01);
      if (this.source) {
        this.source.playbackRate = this._pitch;
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'sound', {
    get: function () {
      return this._sound;
    },
    set: function (value) {
      this.stop();
      this._sound = value;
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'currentTime', {
    get: function () {
      if (this._startOffset !== null) {
        return this._startOffset;
      }
      if (this._state === STATE_STOPPED || !this.source) {
        return 0;
      }
      return this.source.currentTime - this._startTime;
    },
    set: function (value) {
      if (value < 0) return;
      this._startOffset = value;
      if (this.source && this._isReady) {
        this.source.currentTime = capTime(this._startTime + capTime(value, this.duration), this._sound.duration);
        this._startOffset = null;
      }
    }
  });
}

export { SoundInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuLi9hdWRpby9jYXBhYmlsaXRpZXMuanMnO1xuXG5jb25zdCBTVEFURV9QTEFZSU5HID0gMDtcbmNvbnN0IFNUQVRFX1BBVVNFRCA9IDE7XG5jb25zdCBTVEFURV9TVE9QUEVEID0gMjtcblxuLyoqXG4gKiBSZXR1cm4gdGltZSAlIGR1cmF0aW9uIGJ1dCBhbHdheXMgcmV0dXJuIGEgbnVtYmVyIGluc3RlYWQgb2YgTmFOIHdoZW4gZHVyYXRpb24gaXMgMC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZSAtIFRoZSB0aW1lLlxuICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gVGhlIGR1cmF0aW9uLlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHRpbWUgJSBkdXJhdGlvbi5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gY2FwVGltZSh0aW1lLCBkdXJhdGlvbikge1xuICAgIHJldHVybiAodGltZSAlIGR1cmF0aW9uKSB8fCAwO1xufVxuXG4vKipcbiAqIEEgU291bmRJbnN0YW5jZSBwbGF5cyBhIHtAbGluayBTb3VuZH0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGNhdGVnb3J5IFNvdW5kXG4gKi9cbmNsYXNzIFNvdW5kSW5zdGFuY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIHN0YXJ0cyBwbGF5aW5nIGl0cyBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGluc3RhbmNlLm9uKCdwbGF5JywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnSW5zdGFuY2Ugc3RhcnRlZCBwbGF5aW5nJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1BMQVkgPSAncGxheSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGluc3RhbmNlLm9uKCdwYXVzZScsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0luc3RhbmNlIHBhdXNlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9QQVVTRSA9ICdwYXVzZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyByZXN1bWVkLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpbnN0YW5jZS5vbigncmVzdW1lJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnSW5zdGFuY2UgcmVzdW1lZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9SRVNVTUUgPSAncmVzdW1lJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGluc3RhbmNlLm9uKCdzdG9wJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnSW5zdGFuY2Ugc3RvcHBlZCcpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBFVkVOVF9TVE9QID0gJ3N0b3AnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgc291bmQgY3VycmVudGx5IHBsYXllZCBieSB0aGUgaW5zdGFuY2UgZW5kcy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5zdGFuY2Uub24oJ2VuZCcsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0luc3RhbmNlIGVuZGVkJyk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VORCA9ICdlbmQnO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgc291cmNlIHRoYXQgcGxheXMgdGhlIHNvdW5kIHJlc291cmNlLiBJZiB0aGUgV2ViIEF1ZGlvIEFQSSBpcyBub3Qgc3VwcG9ydGVkIHRoZVxuICAgICAqIHR5cGUgb2Ygc291cmNlIGlzIFtBdWRpb10oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSFRNTC9FbGVtZW50L2F1ZGlvKS5cbiAgICAgKiBTb3VyY2UgaXMgb25seSBhdmFpbGFibGUgYWZ0ZXIgY2FsbGluZyBwbGF5LlxuICAgICAqXG4gICAgICogQHR5cGUge0F1ZGlvQnVmZmVyU291cmNlTm9kZX1cbiAgICAgKi9cbiAgICBzb3VyY2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNvdW5kSW5zdGFuY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfSBtYW5hZ2VyIC0gVGhlIHNvdW5kIG1hbmFnZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc291bmQuanMnKS5Tb3VuZH0gc291bmQgLSBUaGUgc291bmQgdG8gcGxheS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIE9wdGlvbnMgZm9yIHRoZSBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMudm9sdW1lXSAtIFRoZSBwbGF5YmFjayB2b2x1bWUsIGJldHdlZW4gMCBhbmQgMS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMucGl0Y2hdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLiBEZWZhdWx0cyB0byAxIChwbGF5cyBhdCBub3JtYWwgcGl0Y2gpLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubG9vcF0gLSBXaGV0aGVyIHRoZSBzb3VuZCBzaG91bGQgbG9vcCB3aGVuIGl0IHJlYWNoZXMgdGhlIGVuZCBvclxuICAgICAqIG5vdC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZV0gLSBUaGUgdGltZSBmcm9tIHdoaWNoIHRoZSBwbGF5YmFjayB3aWxsIHN0YXJ0IGluXG4gICAgICogc2Vjb25kcy4gRGVmYXVsdCBpcyAwIHRvIHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uXSAtIFRoZSB0b3RhbCB0aW1lIGFmdGVyIHRoZSBzdGFydFRpbWUgaW4gc2Vjb25kcyB3aGVuXG4gICAgICogcGxheWJhY2sgd2lsbCBzdG9wIG9yIHJlc3RhcnQgaWYgbG9vcCBpcyB0cnVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uUGxheV0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25QYXVzZV0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uUmVzdW1lXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyByZXN1bWVkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uU3RvcF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgc3RvcHBlZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vbkVuZF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgZW5kcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCBzb3VuZCwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IG9wdGlvbnMudm9sdW1lICE9PSB1bmRlZmluZWQgPyBtYXRoLmNsYW1wKE51bWJlcihvcHRpb25zLnZvbHVtZSkgfHwgMCwgMCwgMSkgOiAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcGl0Y2ggPSBvcHRpb25zLnBpdGNoICE9PSB1bmRlZmluZWQgPyBNYXRoLm1heCgwLjAxLCBOdW1iZXIob3B0aW9ucy5waXRjaCkgfHwgMCkgOiAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xvb3AgPSAhIShvcHRpb25zLmxvb3AgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubG9vcCA6IGZhbHNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9zb3VuZC5qcycpLlNvdW5kfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc291bmQgPSBzb3VuZDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgYXQgJ3N0b3BwZWQnLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9TVE9QUEVEO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtYW5hZ2VyIHdhcyBzdXNwZW5kZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdyZWF0ZXIgdGhhbiAwIGlmIHdlIHdhbnQgdG8gc3VzcGVuZCB0aGUgZXZlbnQgaGFuZGxlZCB0byB0aGUgJ29uZW5kZWQnIGV2ZW50LlxuICAgICAgICAgKiBXaGVuIGFuICdvbmVuZGVkJyBldmVudCBpcyBzdXNwZW5kZWQsIHRoaXMgY291bnRlciBpcyBkZWNyZW1lbnRlZCBieSAxLlxuICAgICAgICAgKiBXaGVuIGEgZnV0dXJlICdvbmVuZGVkJyBldmVudCBpcyB0byBiZSBzdXNwZW5kZWQsIHRoaXMgY291bnRlciBpcyBpbmNyZW1lbnRlZCBieSAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50ID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB3ZSB3YW50IHRvIHN1c3BlbmQgZmlyaW5nIGluc3RhbmNlIGV2ZW50cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgdHJ1ZSB0aGVuIHRoZSBpbnN0YW5jZSB3aWxsIHN0YXJ0IHBsYXlpbmcgaXRzIHNvdXJjZSB3aGVuIGl0cyBjcmVhdGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLmR1cmF0aW9uKSB8fCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcnxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGV4dGVybmFsIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblBsYXlDYWxsYmFjayA9IG9wdGlvbnMub25QbGF5O1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25QYXVzZUNhbGxiYWNrID0gb3B0aW9ucy5vblBhdXNlO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25SZXN1bWVDYWxsYmFjayA9IG9wdGlvbnMub25SZXN1bWU7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblN0b3BDYWxsYmFjayA9IG9wdGlvbnMub25TdG9wO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25FbmRDYWxsYmFjayA9IG9wdGlvbnMub25FbmQ7XG5cbiAgICAgICAgaWYgKGhhc0F1ZGlvQ29udGV4dCgpKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1hbnVhbGx5IGtlZXAgdHJhY2sgb2YgdGhlIHBsYXliYWNrIHBvc2l0aW9uIGJlY2F1c2UgdGhlIFdlYiBBdWRpbyBBUEkgZG9lcyBub3RcbiAgICAgICAgICAgICAqIHByb3ZpZGUgYSB3YXkgdG8gZG8gdGhpcyBhY2N1cmF0ZWx5IGlmIHRoZSBwbGF5YmFja1JhdGUgaXMgbm90IDEuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGlucHV0IG5vZGUgaXMgdGhlIG9uZSB0aGF0IGlzIGNvbm5lY3RlZCB0byB0aGUgc291cmNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2lucHV0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGNvbm5lY3RlZCBub2RlIGlzIHRoZSBvbmUgdGhhdCBpcyBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIChzcGVha2VycykuIEFueVxuICAgICAgICAgICAgICogZXh0ZXJuYWwgbm9kZXMgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhpcyBub2RlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBmaXJzdCBleHRlcm5hbCBub2RlIHNldCBieSBhIHVzZXIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgbGFzdCBleHRlcm5hbCBub2RlIHNldCBieSBhIHVzZXIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFNldCB0byB0cnVlIGlmIGEgcGxheSgpIHJlcXVlc3Qgd2FzIGlzc3VlZCB3aGVuIHRoZSBBdWRpb0NvbnRleHQgd2FzIHN0aWxsIHN1c3BlbmRlZCxcbiAgICAgICAgICAgICAqIGFuZCB3aWxsIHRoZXJlZm9yZSB3YWl0IHVudGlsIGl0IGlzIHJlc3VtZWQgdG8gcGxheSB0aGUgYXVkaW8uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24gPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5faW5pdGlhbGl6ZU5vZGVzKCk7XG5cbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fZW5kZWRIYW5kbGVyID0gdGhpcy5fb25FbmRlZC5iaW5kKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fbG9hZGVkTWV0YWRhdGFIYW5kbGVyID0gdGhpcy5fb25Mb2FkZWRNZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl90aW1lVXBkYXRlSGFuZGxlciA9IHRoaXMuX29uVGltZVVwZGF0ZS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9lbmRlZEhhbmRsZXIgPSB0aGlzLl9vbkVuZGVkLmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSBjdXJyZW50IHRpbWUgb2YgdGhlIHNvdW5kIHRoYXQgaXMgcGxheWluZy4gSWYgdGhlIHZhbHVlIHByb3ZpZGVkIGlzIGJpZ2dlclxuICAgICAqIHRoYW4gdGhlIGR1cmF0aW9uIG9mIHRoZSBpbnN0YW5jZSBpdCB3aWxsIHdyYXAgZnJvbSB0aGUgYmVnaW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY3VycmVudFRpbWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlIDwgMCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORykge1xuICAgICAgICAgICAgY29uc3Qgc3VzcGVuZCA9IHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cztcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIHN0b3AgZmlyc3Qgd2hpY2ggd2lsbCBzZXQgX3N0YXJ0T2Zmc2V0IHRvIG51bGxcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuXG4gICAgICAgICAgICAvLyBzZXQgX3N0YXJ0T2Zmc2V0IGFuZCBwbGF5XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMgPSBzdXNwZW5kO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gc2V0IF9zdGFydE9mZnNldCB3aGljaCB3aWxsIGJlIHVzZWQgd2hlbiB0aGUgaW5zdGFuY2Ugd2lsbCBzdGFydCBwbGF5aW5nXG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IHZhbHVlO1xuICAgICAgICAgICAgLy8gc2V0IF9jdXJyZW50VGltZVxuICAgICAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICAgICAgLy8gaWYgdGhlIHVzZXIgaGFzIHNldCB0aGUgY3VycmVudFRpbWUgYW5kIHdlIGhhdmUgbm90IHVzZWQgaXQgeWV0XG4gICAgICAgIC8vIHRoZW4ganVzdCByZXR1cm4gdGhhdFxuICAgICAgICBpZiAodGhpcy5fc3RhcnRPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdGFydE9mZnNldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBzb3VuZCBpcyBwYXVzZWQgcmV0dXJuIHRoZSBjdXJyZW50VGltZSBjYWxjdWxhdGVkIHdoZW5cbiAgICAgICAgLy8gcGF1c2UoKSB3YXMgY2FsbGVkXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUEFVU0VEKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudFRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgc291bmQgaXMgc3RvcHBlZCBvciB3ZSBkb24ndCBoYXZlIGEgc291cmNlXG4gICAgICAgIC8vIHJldHVybiAwXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRCB8fCAhdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVjYWxjdWxhdGUgY3VycmVudCB0aW1lXG4gICAgICAgIHRoaXMuX3VwZGF0ZUN1cnJlbnRUaW1lKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJyZW50VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHVyYXRpb24gb2YgdGhlIHNvdW5kIHRoYXQgdGhlIGluc3RhbmNlIHdpbGwgcGxheSBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGR1cmF0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyByZXN0YXJ0XG4gICAgICAgIGNvbnN0IGlzUGxheWluZyA9IHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fc291bmQpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGNhcFRpbWUodGhpcy5fZHVyYXRpb24sIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc291bmQuZHVyYXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGF1c2VkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BBVVNFRDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNTdG9wcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgc3VzcGVuZGVkIGJlY2F1c2UgdGhlIHdpbmRvdyBpcyBub3QgZm9jdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N1c3BlbmRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1c3BlbmRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBpbnN0YW5jZSB3aWxsIHJlc3RhcnQgd2hlbiBpdCBmaW5pc2hlcyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxvb3AodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbG9vcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdGNoIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIE11c3QgYmUgbGFyZ2VyIHRoYW4gMC4wMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHBpdGNoKHBpdGNoKSB7XG4gICAgICAgIC8vIHNldCBvZmZzZXQgdG8gY3VycmVudCB0aW1lIHNvIHRoYXRcbiAgICAgICAgLy8gd2UgY2FsY3VsYXRlIHRoZSByZXN0IG9mIHRoZSB0aW1lIHdpdGggdGhlIG5ldyBwaXRjaFxuICAgICAgICAvLyBmcm9tIG5vdyBvblxuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gdGhpcy5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHBpdGNoKSB8fCAwLCAwLjAxKTtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5YmFja1JhdGUudmFsdWUgPSB0aGlzLl9waXRjaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwaXRjaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BpdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBzb3VuZCByZXNvdXJjZSB0aGF0IHRoZSBpbnN0YW5jZSB3aWxsIHBsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NvdW5kLmpzJykuU291bmR9XG4gICAgICovXG4gICAgc2V0IHNvdW5kKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NvdW5kID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNvdW5kKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291bmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3RhcnRUaW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCk7XG5cbiAgICAgICAgLy8gcmVzdGFydFxuICAgICAgICBjb25zdCBpc1BsYXlpbmcgPSB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIGlmIChpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YXJ0VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdm9sdW1lIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIEluIHJhbmdlIDAtMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHZvbHVtZSh2b2x1bWUpIHtcbiAgICAgICAgdm9sdW1lID0gbWF0aC5jbGFtcCh2b2x1bWUsIDAsIDEpO1xuICAgICAgICB0aGlzLl92b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgIGlmICh0aGlzLmdhaW4pIHtcbiAgICAgICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdm9sdW1lICogdGhpcy5fbWFuYWdlci52b2x1bWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblBsYXkoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncGxheScpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblBsYXlDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUGxheUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblBhdXNlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3BhdXNlJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUGF1c2VDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUGF1c2VDYWxsYmFjayh0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25SZXN1bWUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVzdW1lJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUmVzdW1lQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vblJlc3VtZUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblN0b3AoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnc3RvcCcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblN0b3BDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uU3RvcENhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vbkVuZGVkKCkge1xuICAgICAgICAvLyB0aGUgY2FsbGJhY2sgaXMgbm90IGZpcmVkIHN5bmNocm9ub3VzbHlcbiAgICAgICAgLy8gc28gb25seSBkZWNyZW1lbnQgX3N1c3BlbmRFbmRFdmVudCB3aGVuIHRoZVxuICAgICAgICAvLyBjYWxsYmFjayBpcyBmaXJlZFxuICAgICAgICBpZiAodGhpcy5fc3VzcGVuZEVuZEV2ZW50ID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50LS07XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2VuZCcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vbkVuZENhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25FbmRDYWxsYmFjayh0aGlzKTtcblxuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAndm9sdW1lY2hhbmdlJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlclZvbHVtZUNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ3N1c3BlbmQnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyU3VzcGVuZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HICYmICF0aGlzLl9zdXNwZW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAncmVzdW1lJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlclJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBpbnRlcm5hbCBhdWRpbyBub2RlcyBhbmQgY29ubmVjdHMgdGhlbS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luaXRpYWxpemVOb2RlcygpIHtcbiAgICAgICAgLy8gY3JlYXRlIGdhaW4gbm9kZSBmb3Igdm9sdW1lIGNvbnRyb2xcbiAgICAgICAgdGhpcy5nYWluID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5faW5wdXROb2RlID0gdGhpcy5nYWluO1xuICAgICAgICAvLyB0aGUgZ2FpbiBub2RlIGlzIGFsc28gdGhlIGNvbm5lY3RvciBub2RlIGZvciAyRCBzb3VuZCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZSA9IHRoaXMuZ2FpbjtcbiAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5jb25uZWN0KHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBiZWdpbiBwbGF5YmFjayB0aGUgc291bmQuXG4gICAgICogSWYgdGhlIEF1ZGlvQ29udGV4dCBpcyBzdXNwZW5kZWQsIHRoZSBhdWRpbyB3aWxsIG9ubHkgc3RhcnQgb25jZSBpdCdzIHJlc3VtZWQuXG4gICAgICogSWYgdGhlIHNvdW5kIGlzIGFscmVhZHkgcGxheWluZywgdGhpcyB3aWxsIHJlc3RhcnQgdGhlIHNvdW5kLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNvdW5kIHdhcyBzdGFydGVkIGltbWVkaWF0ZWx5LlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfU1RPUFBFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IHN0YXRlIHRvIHBsYXlpbmdcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAvLyBubyBuZWVkIGZvciB0aGlzIGFueW1vcmVcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGFscmVhZHkgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXRcbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFuYWdlciBpcyBzdXNwZW5kZWQgc28gYXVkaW8gY2Fubm90IHN0YXJ0IG5vdyAtIHdhaXQgZm9yIG1hbmFnZXIgdG8gcmVzdW1lXG4gICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnN1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbmNlKCdyZXN1bWUnLCB0aGlzLl9wbGF5QXVkaW9JbW1lZGlhdGUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uID0gdHJ1ZTtcblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcGxheUF1ZGlvSW1tZWRpYXRlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlbHkgcGxheSB0aGUgc291bmQuXG4gICAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGUgQXVkaW9Db250ZXh0IGlzIHJlYWR5IChub3Qgc3VzcGVuZGVkIG9yIGxvY2tlZCkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wbGF5QXVkaW9JbW1lZGlhdGUoKSB7XG4gICAgICAgIHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGJldHdlZW4gcGxheSgpIGFuZCB0aGUgbWFuYWdlciBiZWluZyByZWFkeSB0byBwbGF5LCBhIHN0b3AoKSBvciBwYXVzZSgpIGNhbGwgd2FzIG1hZGVcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9QTEFZSU5HKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTb3VyY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBzdGFydCBvZmZzZXRcbiAgICAgICAgbGV0IG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIG9mZnNldCwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICAvLyByZXNldCBzdGFydCBvZmZzZXQgbm93IHRoYXQgd2Ugc3RhcnRlZCB0aGUgc291bmRcbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIHN0YXJ0IHNvdXJjZSB3aXRoIHNwZWNpZmllZCBvZmZzZXQgYW5kIGR1cmF0aW9uXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0LCB0aGlzLl9kdXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgdGltZXNcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSBvZmZzZXQ7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB2b2x1bWUgYW5kIGxvb3AgLSBub3RlIG1vdmVkIHRvIGJlIGFmdGVyIHN0YXJ0KCkgYmVjYXVzZSBvZiBDaHJvbWUgYnVnXG4gICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgICAgICB0aGlzLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB0aGlzLnBpdGNoID0gdGhpcy5fcGl0Y2g7XG5cbiAgICAgICAgLy8gaGFuZGxlIHN1c3BlbmQgZXZlbnRzIC8gdm9sdW1lY2hhbmdlIGV2ZW50c1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cykge1xuICAgICAgICAgICAgdGhpcy5fb25QbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgcGxheWJhY2sgb2Ygc291bmQuIENhbGwgcmVzdW1lKCkgdG8gcmVzdW1lIHBsYXliYWNrIGZyb20gdGhlIHNhbWUgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VuZCB3YXMgcGF1c2VkLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICAvLyBubyBuZWVkIGZvciB0aGlzIGFueW1vcmVcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BMQVlJTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gc2V0IHN0YXRlIHRvIHBhdXNlZFxuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BBVVNFRDtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0LlxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIGN1cnJlbnQgdGltZVxuICAgICAgICB0aGlzLl91cGRhdGVDdXJyZW50VGltZSgpO1xuXG4gICAgICAgIC8vIFN0b3AgdGhlIHNvdXJjZSBhbmQgcmUtY3JlYXRlIGl0IGJlY2F1c2Ugd2UgY2Fubm90IHJldXNlIHRoZSBzYW1lIHNvdXJjZS5cbiAgICAgICAgLy8gU3VzcGVuZCB0aGUgZW5kIGV2ZW50IGFzIHdlIGFyZSBtYW51YWxseSBzdG9wcGluZyB0aGUgc291cmNlXG4gICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdXNlci1zZXQgc3RhcnQgb2Zmc2V0XG4gICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uUGF1c2UoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHBsYXliYWNrIG9mIHRoZSBzb3VuZC4gUGxheWJhY2sgcmVzdW1lcyBhdCB0aGUgcG9pbnQgdGhhdCB0aGUgYXVkaW8gd2FzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyByZXN1bWVkLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9QQVVTRUQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IGF0IHBvaW50IHdoZXJlIHNvdW5kIHdhcyBwYXVzZWRcbiAgICAgICAgbGV0IG9mZnNldCA9IHRoaXMuY3VycmVudFRpbWU7XG5cbiAgICAgICAgLy8gc2V0IHN0YXRlIGJhY2sgdG8gcGxheWluZ1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG5cbiAgICAgICAgLy8gcGxheSgpIHdhcyBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldFxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIHVzZXIgc2V0IHRoZSAnY3VycmVudFRpbWUnIHByb3BlcnR5IHdoaWxlIHRoZSBzb3VuZFxuICAgICAgICAvLyB3YXMgcGF1c2VkIHRoZW4gdXNlIHRoYXQgYXMgdGhlIG9mZnNldCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIG9mZnNldCwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuXG4gICAgICAgICAgICAvLyByZXNldCBvZmZzZXRcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IHNvdXJjZVxuICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCwgdGhpcy5fZHVyYXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IG9mZnNldDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHBhcmFtZXRlcnNcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgcGxheWJhY2sgb2Ygc291bmQuIENhbGxpbmcgcGxheSgpIGFnYWluIHdpbGwgcmVzdGFydCBwbGF5YmFjayBmcm9tIHRoZSBiZWdpbm5pbmcgb2ZcbiAgICAgKiB0aGUgc291bmQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VuZCB3YXMgc3RvcHBlZC5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gc3RvcHBlZFxuICAgICAgICBjb25zdCB3YXNQbGF5aW5nID0gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfU1RPUFBFRDtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0XG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBtYW5hZ2VyIGV2ZW50c1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgLy8gcmVzZXQgc3RvcmVkIHRpbWVzXG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IDA7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IDA7XG5cbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICBpZiAod2FzUGxheWluZyAmJiB0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgwKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9vblN0b3AoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0cyBleHRlcm5hbCBXZWIgQXVkaW8gQVBJIG5vZGVzLiBZb3UgbmVlZCB0byBwYXNzIHRoZSBmaXJzdCBub2RlIG9mIHRoZSBub2RlIGdyYXBoXG4gICAgICogdGhhdCB5b3UgY3JlYXRlZCBleHRlcm5hbGx5IGFuZCB0aGUgbGFzdCBub2RlIG9mIHRoYXQgZ3JhcGguIFRoZSBmaXJzdCBub2RlIHdpbGwgYmVcbiAgICAgKiBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBhbmQgdGhlIGxhc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gb2YgdGhlXG4gICAgICogQXVkaW9Db250ZXh0IChlLmcuIHNwZWFrZXJzKS4gUmVxdWlyZXMgV2ViIEF1ZGlvIEFQSSBzdXBwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IGZpcnN0Tm9kZSAtIFRoZSBmaXJzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBvZiBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IFtsYXN0Tm9kZV0gLSBUaGUgbGFzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mIHRoZSBBdWRpb0NvbnRleHQuXG4gICAgICogSWYgdW5zcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3ROb2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBpbnN0ZWFkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgY29udGV4dCA9IGFwcC5zeXN0ZW1zLnNvdW5kLmNvbnRleHQ7XG4gICAgICogY29uc3QgYW5hbHl6ZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5emVyKCk7XG4gICAgICogY29uc3QgZGlzdG9ydGlvbiA9IGNvbnRleHQuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAqIGNvbnN0IGZpbHRlciA9IGNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICogYW5hbHl6ZXIuY29ubmVjdChkaXN0b3J0aW9uKTtcbiAgICAgKiBkaXN0b3J0aW9uLmNvbm5lY3QoZmlsdGVyKTtcbiAgICAgKiBpbnN0YW5jZS5zZXRFeHRlcm5hbE5vZGVzKGFuYWx5emVyLCBmaWx0ZXIpO1xuICAgICAqL1xuICAgIHNldEV4dGVybmFsTm9kZXMoZmlyc3ROb2RlLCBsYXN0Tm9kZSkge1xuICAgICAgICBpZiAoIWZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVGhlIGZpcnN0Tm9kZSBtdXN0IGJlIGEgdmFsaWQgQXVkaW8gTm9kZScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFsYXN0Tm9kZSkge1xuICAgICAgICAgICAgbGFzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb25uZWN0aW9ucyBhcmU6XG4gICAgICAgIC8vIHNvdXJjZSAtPiBpbnB1dE5vZGUgLT4gY29ubmVjdG9yTm9kZSAtPiBbZmlyc3ROb2RlIC0+IC4uLiAtPiBsYXN0Tm9kZV0gLT4gc3BlYWtlcnNcblxuICAgICAgICBjb25zdCBzcGVha2VycyA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbjtcblxuICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlICE9PSBmaXJzdE5vZGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBmaXJzdE5vZGUgYWxyZWFkeSBleGlzdHMgbWVhbnMgdGhlIGNvbm5lY3RvciBub2RlXG4gICAgICAgICAgICAgICAgLy8gaXMgY29ubmVjdGVkIHRvIGl0IHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3QodGhpcy5fZmlyc3ROb2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3ROb2RlIGRvZXMgbm90IGV4aXN0IG1lYW5zIHRoYXQgaXRzIGNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIC8vIHRvIHRoZSBzcGVha2VycyBzbyBkaXNjb25uZWN0IGl0XG4gICAgICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5kaXNjb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGZpcnN0IG5vZGUgYW5kIGNvbm5lY3Qgd2l0aCBjb25uZWN0b3Igbm9kZVxuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gZmlyc3ROb2RlO1xuICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5jb25uZWN0KGZpcnN0Tm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUgIT09IGxhc3ROb2RlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBsYXN0IG5vZGUgZXhpc3RzIG1lYW5zIGl0J3MgY29ubmVjdGVkIHRvIHRoZSBzcGVha2VycyBzbyBkaXNjb25uZWN0IGl0XG4gICAgICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuZGlzY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBsYXN0IG5vZGUgYW5kIGNvbm5lY3Qgd2l0aCBzcGVha2Vyc1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBsYXN0Tm9kZTtcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlLmNvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIGFueSBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kSW5zdGFuY2Ujc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgY2xlYXJFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICBjb25zdCBzcGVha2VycyA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbjtcblxuICAgICAgICAvLyBicmVhayBleGlzdGluZyBjb25uZWN0aW9uc1xuICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3QodGhpcy5fZmlyc3ROb2RlKTtcbiAgICAgICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlLmRpc2Nvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgY29ubmVjdCB0byBzcGVha2Vyc1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3Qoc3BlYWtlcnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYW55IGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb05vZGVbXX0gUmV0dXJucyBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB0d28gbm9kZXMgc2V0IGJ5XG4gICAgICoge0BsaW5rIFNvdW5kSW5zdGFuY2Ujc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgZ2V0RXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBzb3VyY2UgZm9yIHRoZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb0J1ZmZlclNvdXJjZU5vZGV8bnVsbH0gUmV0dXJucyB0aGUgY3JlYXRlZCBzb3VyY2Ugb3IgbnVsbCBpZiB0aGUgc291bmRcbiAgICAgKiBpbnN0YW5jZSBoYXMgbm8ge0BsaW5rIFNvdW5kfSBhc3NvY2lhdGVkIHdpdGggaXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3JlYXRlU291cmNlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NvdW5kKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX3NvdW5kLmJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5fc291bmQuYnVmZmVyO1xuXG4gICAgICAgICAgICAvLyBDb25uZWN0IHVwIHRoZSBub2Rlc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLl9pbnB1dE5vZGUpO1xuXG4gICAgICAgICAgICAvLyBzZXQgZXZlbnRzXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5vbmVuZGVkID0gdGhpcy5fZW5kZWRIYW5kbGVyO1xuXG4gICAgICAgICAgICAvLyBzZXQgbG9vcFN0YXJ0IGFuZCBsb29wRW5kIHNvIHRoYXQgdGhlIHNvdXJjZSBzdGFydHMgYW5kIGVuZHMgYXQgdGhlIGNvcnJlY3QgdXNlci1zZXQgdGltZXNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmxvb3BTdGFydCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lLCB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24pO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcEVuZCA9IE1hdGgubWF4KHRoaXMuc291cmNlLmxvb3BTdGFydCwgY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyB0aGlzLl9kdXJhdGlvbiwgdGhpcy5zb3VyY2UuYnVmZmVyLmR1cmF0aW9uKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCB0aW1lIHRha2luZyBpbnRvIGFjY291bnQgdGhlIHRpbWUgdGhlIGluc3RhbmNlIHN0YXJ0ZWQgcGxheWluZywgdGhlIGN1cnJlbnRcbiAgICAgKiBwaXRjaCBhbmQgdGhlIGN1cnJlbnQgdGltZSBvZmZzZXQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSBjYXBUaW1lKCh0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWUgLSB0aGlzLl9zdGFydGVkQXQpICogdGhpcy5fcGl0Y2ggKyB0aGlzLl9jdXJyZW50T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAnZGVzdHJveScgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJEZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmICghaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICBPYmplY3QuYXNzaWduKFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgICAgIHBsYXk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfU1RPUFBFRCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jcmVhdGVTb3VyY2UoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcbiAgICAgICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG5cbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXkoKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgICAgICAvLyBzdXNwZW5kIGltbWVkaWF0ZWx5IGlmIG1hbmFnZXIgaXMgc3VzcGVuZGVkXG4gICAgICAgICAgICBpZiAodGhpcy5fbWFuYWdlci5zdXNwZW5kZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLl9vblBsYXkoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgfSxcblxuICAgICAgICBwYXVzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUExBWUlORylcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BBVVNFRDtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25QYXVzZSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICByZXN1bWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UgfHwgdGhpcy5fc3RhdGUgIT09IFNUQVRFX1BBVVNFRClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UgfHwgdGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1NUT1BQRUQ7XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uU3RvcCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXRFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkXG4gICAgICAgIH0sXG5cbiAgICAgICAgY2xlYXJFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkXG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0RXh0ZXJuYWxOb2RlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBidXQgcmV0dXJuIHNhbWUgdHlwZSBvZiByZXN1bHRcbiAgICAgICAgICAgIHJldHVybiBbbnVsbCwgbnVsbF07XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gU2V0cyBzdGFydCB0aW1lIGFmdGVyIGxvYWRlZG1ldGFkYXRhIGlzIGZpcmVkIHdoaWNoIGlzIHJlcXVpcmVkIGJ5IG1vc3QgYnJvd3NlcnNcbiAgICAgICAgX29uTG9hZGVkTWV0YWRhdGE6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5fbG9hZGVkTWV0YWRhdGFIYW5kbGVyKTtcblxuICAgICAgICAgICAgdGhpcy5faXNSZWFkeSA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBzdGFydCB0aW1lIGZvciBzb3VyY2VcbiAgICAgICAgICAgIGxldCBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgICAgICAvLyByZXNldCBjdXJyZW50VGltZVxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBzZXQgb2Zmc2V0IG9uIHNvdXJjZVxuICAgICAgICAgICAgdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPSBvZmZzZXQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2NyZWF0ZVNvdXJjZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kICYmIHRoaXMuX3NvdW5kLmF1ZGlvKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSB0aGlzLl9zb3VuZC5hdWRpby5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgZXZlbnRzXG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB0aGlzLl90aW1lVXBkYXRlSGFuZGxlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2Uub25lbmRlZCA9IHRoaXMuX2VuZGVkSGFuZGxlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIGNhbGxlZCBldmVyeSB0aW1lIHRoZSAnY3VycmVudFRpbWUnIGlzIGNoYW5nZWRcbiAgICAgICAgX29uVGltZVVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9kdXJhdGlvbilcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBjdXJyZW50VGltZSBwYXNzZXMgdGhlIGVuZCB0aGVuIGlmIGxvb3BpbmcgZ28gYmFjayB0byB0aGUgYmVnaW5uaW5nXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgbWFudWFsbHkgc3RvcFxuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID4gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyB0aGlzLl9kdXJhdGlvbiwgdGhpcy5zb3VyY2UuZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lLCB0aGlzLnNvdXJjZS5kdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxsIHRoaXMgbWFudWFsbHkgYmVjYXVzZSBpdCBkb2Vzbid0IHdvcmsgaW4gYWxsIGJyb3dzZXJzIGluIHRoaXMgY2FzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkVuZGVkKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9vbk1hbmFnZXJEZXN0cm95OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICd2b2x1bWUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2b2x1bWUpIHtcbiAgICAgICAgICAgIHZvbHVtZSA9IG1hdGguY2xhbXAodm9sdW1lLCAwLCAxKTtcbiAgICAgICAgICAgIHRoaXMuX3ZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnZvbHVtZSA9IHZvbHVtZSAqIHRoaXMuX21hbmFnZXIudm9sdW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdwaXRjaCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocGl0Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHBpdGNoKSB8fCAwLCAwLjAxKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXliYWNrUmF0ZSA9IHRoaXMuX3BpdGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdzb3VuZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc291bmQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgdGhpcy5fc291bmQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3RhcnRPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRCB8fCAhdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lIC0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPCAwKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5faXNSZWFkeSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBjYXBUaW1lKHZhbHVlLCB0aGlzLmR1cmF0aW9uKSwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5leHBvcnQgeyBTb3VuZEluc3RhbmNlIH07XG4iXSwibmFtZXMiOlsiU1RBVEVfUExBWUlORyIsIlNUQVRFX1BBVVNFRCIsIlNUQVRFX1NUT1BQRUQiLCJjYXBUaW1lIiwidGltZSIsImR1cmF0aW9uIiwiU291bmRJbnN0YW5jZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsInNvdW5kIiwib3B0aW9ucyIsInNvdXJjZSIsIl9tYW5hZ2VyIiwiX3ZvbHVtZSIsInZvbHVtZSIsInVuZGVmaW5lZCIsIm1hdGgiLCJjbGFtcCIsIk51bWJlciIsIl9waXRjaCIsInBpdGNoIiwiTWF0aCIsIm1heCIsIl9sb29wIiwibG9vcCIsIl9zb3VuZCIsIl9zdGF0ZSIsIl9zdXNwZW5kZWQiLCJfc3VzcGVuZEVuZEV2ZW50IiwiX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyIsIl9wbGF5V2hlbkxvYWRlZCIsIl9zdGFydFRpbWUiLCJzdGFydFRpbWUiLCJfZHVyYXRpb24iLCJfc3RhcnRPZmZzZXQiLCJfb25QbGF5Q2FsbGJhY2siLCJvblBsYXkiLCJfb25QYXVzZUNhbGxiYWNrIiwib25QYXVzZSIsIl9vblJlc3VtZUNhbGxiYWNrIiwib25SZXN1bWUiLCJfb25TdG9wQ2FsbGJhY2siLCJvblN0b3AiLCJfb25FbmRDYWxsYmFjayIsIm9uRW5kIiwiaGFzQXVkaW9Db250ZXh0IiwiX3N0YXJ0ZWRBdCIsIl9jdXJyZW50VGltZSIsIl9jdXJyZW50T2Zmc2V0IiwiX2lucHV0Tm9kZSIsIl9jb25uZWN0b3JOb2RlIiwiX2ZpcnN0Tm9kZSIsIl9sYXN0Tm9kZSIsIl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24iLCJfaW5pdGlhbGl6ZU5vZGVzIiwiX2VuZGVkSGFuZGxlciIsIl9vbkVuZGVkIiwiYmluZCIsIl9pc1JlYWR5IiwiX2xvYWRlZE1ldGFkYXRhSGFuZGxlciIsIl9vbkxvYWRlZE1ldGFkYXRhIiwiX3RpbWVVcGRhdGVIYW5kbGVyIiwiX29uVGltZVVwZGF0ZSIsIl9jcmVhdGVTb3VyY2UiLCJjdXJyZW50VGltZSIsInZhbHVlIiwic3VzcGVuZCIsInN0b3AiLCJwbGF5IiwiX3VwZGF0ZUN1cnJlbnRUaW1lIiwiaXNQbGF5aW5nIiwiaXNQYXVzZWQiLCJpc1N0b3BwZWQiLCJpc1N1c3BlbmRlZCIsImNvbnRleHQiLCJwbGF5YmFja1JhdGUiLCJnYWluIiwiX29uUGxheSIsImZpcmUiLCJfb25QYXVzZSIsIl9vblJlc3VtZSIsIl9vblN0b3AiLCJfb25NYW5hZ2VyVm9sdW1lQ2hhbmdlIiwiX29uTWFuYWdlclN1c3BlbmQiLCJwYXVzZSIsIl9vbk1hbmFnZXJSZXN1bWUiLCJyZXN1bWUiLCJjcmVhdGVHYWluIiwiY29ubmVjdCIsImRlc3RpbmF0aW9uIiwic3VzcGVuZGVkIiwib25jZSIsIl9wbGF5QXVkaW9JbW1lZGlhdGUiLCJvZmZzZXQiLCJzdGFydCIsIm9uIiwiX29uTWFuYWdlckRlc3Ryb3kiLCJ3YXNQbGF5aW5nIiwib2ZmIiwic2V0RXh0ZXJuYWxOb2RlcyIsImZpcnN0Tm9kZSIsImxhc3ROb2RlIiwiY29uc29sZSIsImVycm9yIiwic3BlYWtlcnMiLCJkaXNjb25uZWN0IiwiY2xlYXJFeHRlcm5hbE5vZGVzIiwiZ2V0RXh0ZXJuYWxOb2RlcyIsImJ1ZmZlciIsImNyZWF0ZUJ1ZmZlclNvdXJjZSIsIm9uZW5kZWQiLCJsb29wU3RhcnQiLCJsb29wRW5kIiwiRVZFTlRfUExBWSIsIkVWRU5UX1BBVVNFIiwiRVZFTlRfUkVTVU1FIiwiRVZFTlRfU1RPUCIsIkVWRU5UX0VORCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsInBhdXNlZCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJhdWRpbyIsImNsb25lTm9kZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsInNldCJdLCJtYXBwaW5ncyI6Ijs7OztBQU1BLE1BQU1BLGFBQWEsR0FBRyxDQUFDLENBQUE7QUFDdkIsTUFBTUMsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUN0QixNQUFNQyxhQUFhLEdBQUcsQ0FBQyxDQUFBOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsT0FBT0EsQ0FBQ0MsSUFBSSxFQUFFQyxRQUFRLEVBQUU7QUFDN0IsRUFBQSxPQUFRRCxJQUFJLEdBQUdDLFFBQVEsSUFBSyxDQUFDLENBQUE7QUFDakMsQ0FBQTs7QUFF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
