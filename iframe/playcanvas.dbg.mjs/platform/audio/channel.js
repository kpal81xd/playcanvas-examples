import { math } from '../../core/math/math.js';
import { hasAudioContext } from './capabilities.js';

/**
 * A channel is created when the {@link SoundManager} begins playback of a {@link Sound}. Usually
 * created internally by {@link SoundManager#playSound} or {@link SoundManager#playSound3d}.
 * Developers usually won't have to create Channels manually.
 *
 * @ignore
 */
class Channel {
  /**
   * Create a new Channel instance.
   *
   * @param {import('../sound/manager.js').SoundManager} manager - The SoundManager instance.
   * @param {import('../sound/sound.js').Sound} sound - The sound to playback.
   * @param {object} [options] - Optional options object.
   * @param {number} [options.volume] - The playback volume, between 0 and 1. Defaults to 1.
   * @param {number} [options.pitch] - The relative pitch. Defaults to 1 (plays at normal pitch).
   * @param {boolean} [options.loop] - Whether the sound should loop when it reaches the
   * end or not. Defaults to false.
   */
  constructor(manager, sound, options = {}) {
    var _options$volume, _options$loop, _options$pitch;
    this.volume = (_options$volume = options.volume) != null ? _options$volume : 1;
    this.loop = (_options$loop = options.loop) != null ? _options$loop : false;
    this.pitch = (_options$pitch = options.pitch) != null ? _options$pitch : 1;
    this.sound = sound;
    this.paused = false;
    this.suspended = false;
    this.manager = manager;
    this.source = null;
    if (hasAudioContext()) {
      this.startTime = 0;
      this.startOffset = 0;
      const context = manager.context;
      this.gain = context.createGain();
    } else if (sound.audio) {
      // handle the case where sound was
      this.source = sound.audio.cloneNode(false);
      this.source.pause(); // not initially playing
    }
  }

  /**
   * Get the current value for the volume. Between 0 and 1.
   *
   * @returns {number} The volume of the channel.
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Get the current looping state of the Channel.
   *
   * @returns {boolean} The loop property for the channel.
   */
  getLoop() {
    return this.loop;
  }

  /**
   * Enable/disable the loop property to make the sound restart from the beginning when it
   * reaches the end.
   *
   * @param {boolean} loop - True to loop the sound, false otherwise.
   */
  setLoop(loop) {
    this.loop = loop;
    if (this.source) {
      this.source.loop = loop;
    }
  }

  /**
   * Get the current pitch of the Channel.
   *
   * @returns {number} The pitch of the channel.
   */
  getPitch() {
    return this.pitch;
  }

  /**
   * Handle the manager's 'volumechange' event.
   */
  onManagerVolumeChange() {
    this.setVolume(this.getVolume());
  }

  /**
   * Handle the manager's 'suspend' event.
   */
  onManagerSuspend() {
    if (this.isPlaying() && !this.suspended) {
      this.suspended = true;
      this.pause();
    }
  }

  /**
   * Handle the manager's 'resume' event.
   */
  onManagerResume() {
    if (this.suspended) {
      this.suspended = false;
      this.unpause();
    }
  }

  /**
   * Begin playback of sound.
   */
  play() {
    if (this.source) {
      throw new Error('Call stop() before calling play()');
    }
    this._createSource();
    if (!this.source) {
      return;
    }
    this.startTime = this.manager.context.currentTime;
    this.source.start(0, this.startOffset % this.source.buffer.duration);

    // Initialize volume and loop - note moved to be after start() because of Chrome bug
    this.setVolume(this.volume);
    this.setLoop(this.loop);
    this.setPitch(this.pitch);
    this.manager.on('volumechange', this.onManagerVolumeChange, this);
    this.manager.on('suspend', this.onManagerSuspend, this);
    this.manager.on('resume', this.onManagerResume, this);

    // suspend immediately if manager is suspended
    if (this.manager.suspended) this.onManagerSuspend();
  }

  /**
   * Pause playback of sound. Call unpause() to resume playback from the same position.
   */
  pause() {
    if (this.source) {
      this.paused = true;
      this.startOffset += this.manager.context.currentTime - this.startTime;
      this.source.stop(0);
      this.source = null;
    }
  }

  /**
   * Resume playback of the sound. Playback resumes at the point that the audio was paused.
   */
  unpause() {
    if (this.source || !this.paused) {
      console.warn('Call pause() before unpausing.');
      return;
    }
    this._createSource();
    if (!this.source) {
      return;
    }
    this.startTime = this.manager.context.currentTime;
    this.source.start(0, this.startOffset % this.source.buffer.duration);

    // Initialize parameters
    this.setVolume(this.volume);
    this.setLoop(this.loop);
    this.setPitch(this.pitch);
    this.paused = false;
  }

  /**
   * Stop playback of sound. Calling play() again will restart playback from the beginning of the
   * sound.
   */
  stop() {
    if (this.source) {
      this.source.stop(0);
      this.source = null;
    }
    this.manager.off('volumechange', this.onManagerVolumeChange, this);
    this.manager.off('suspend', this.onManagerSuspend, this);
    this.manager.off('resume', this.onManagerResume, this);
  }

  /**
   * Set the volume of playback between 0 and 1.
   *
   * @param {number} volume - The volume of the sound. Will be clamped between 0 and 1.
   */
  setVolume(volume) {
    volume = math.clamp(volume, 0, 1);
    this.volume = volume;
    if (this.gain) {
      this.gain.gain.value = volume * this.manager.volume;
    }
  }
  setPitch(pitch) {
    this.pitch = pitch;
    if (this.source) {
      this.source.playbackRate.value = pitch;
    }
  }
  isPlaying() {
    return !this.paused && this.source.playbackState === this.source.PLAYING_STATE;
  }
  getDuration() {
    return this.source ? this.source.buffer.duration : 0;
  }
  _createSource() {
    const context = this.manager.context;
    if (this.sound.buffer) {
      this.source = context.createBufferSource();
      this.source.buffer = this.sound.buffer;

      // Connect up the nodes
      this.source.connect(this.gain);
      this.gain.connect(context.destination);
      if (!this.loop) {
        // mark source as paused when it ends
        this.source.onended = this.pause.bind(this);
      }
    }
  }
}
if (!hasAudioContext()) {
  Object.assign(Channel.prototype, {
    play: function () {
      if (this.source) {
        this.paused = false;
        this.setVolume(this.volume);
        this.setLoop(this.loop);
        this.setPitch(this.pitch);
        this.source.play();
      }
      this.manager.on('volumechange', this.onManagerVolumeChange, this);
      this.manager.on('suspend', this.onManagerSuspend, this);
      this.manager.on('resume', this.onManagerResume, this);

      // suspend immediately if manager is suspended
      if (this.manager.suspended) this.onManagerSuspend();
    },
    pause: function () {
      if (this.source) {
        this.paused = true;
        this.source.pause();
      }
    },
    unpause: function () {
      if (this.source) {
        this.paused = false;
        this.source.play();
      }
    },
    stop: function () {
      if (this.source) {
        this.source.pause();
      }
      this.manager.off('volumechange', this.onManagerVolumeChange, this);
      this.manager.off('suspend', this.onManagerSuspend, this);
      this.manager.off('resume', this.onManagerResume, this);
    },
    setVolume: function (volume) {
      volume = math.clamp(volume, 0, 1);
      this.volume = volume;
      if (this.source) {
        this.source.volume = volume * this.manager.volume;
      }
    },
    setPitch: function (pitch) {
      this.pitch = pitch;
      if (this.source) {
        this.source.playbackRate = pitch;
      }
    },
    getDuration: function () {
      return this.source && !isNaN(this.source.duration) ? this.source.duration : 0;
    },
    isPlaying: function () {
      return !this.source.paused;
    }
  });
}

export { Channel };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbm5lbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcblxuaW1wb3J0IHsgaGFzQXVkaW9Db250ZXh0IH0gZnJvbSAnLi9jYXBhYmlsaXRpZXMuanMnO1xuXG4vKipcbiAqIEEgY2hhbm5lbCBpcyBjcmVhdGVkIHdoZW4gdGhlIHtAbGluayBTb3VuZE1hbmFnZXJ9IGJlZ2lucyBwbGF5YmFjayBvZiBhIHtAbGluayBTb3VuZH0uIFVzdWFsbHlcbiAqIGNyZWF0ZWQgaW50ZXJuYWxseSBieSB7QGxpbmsgU291bmRNYW5hZ2VyI3BsYXlTb3VuZH0gb3Ige0BsaW5rIFNvdW5kTWFuYWdlciNwbGF5U291bmQzZH0uXG4gKiBEZXZlbG9wZXJzIHVzdWFsbHkgd29uJ3QgaGF2ZSB0byBjcmVhdGUgQ2hhbm5lbHMgbWFudWFsbHkuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBDaGFubmVsIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ2hhbm5lbCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfSBtYW5hZ2VyIC0gVGhlIFNvdW5kTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc291bmQvc291bmQuanMnKS5Tb3VuZH0gc291bmQgLSBUaGUgc291bmQgdG8gcGxheWJhY2suXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWVdIC0gVGhlIHBsYXliYWNrIHZvbHVtZSwgYmV0d2VlbiAwIGFuZCAxLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5waXRjaF0gLSBUaGUgcmVsYXRpdmUgcGl0Y2guIERlZmF1bHRzIHRvIDEgKHBsYXlzIGF0IG5vcm1hbCBwaXRjaCkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5sb29wXSAtIFdoZXRoZXIgdGhlIHNvdW5kIHNob3VsZCBsb29wIHdoZW4gaXQgcmVhY2hlcyB0aGVcbiAgICAgKiBlbmQgb3Igbm90LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCBzb3VuZCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHRoaXMudm9sdW1lID0gb3B0aW9ucy52b2x1bWUgPz8gMTtcbiAgICAgICAgdGhpcy5sb29wID0gb3B0aW9ucy5sb29wID8/IGZhbHNlO1xuICAgICAgICB0aGlzLnBpdGNoID0gb3B0aW9ucy5waXRjaCA/PyAxO1xuXG4gICAgICAgIHRoaXMuc291bmQgPSBzb3VuZDtcblxuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnN1c3BlbmRlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIGlmIChoYXNBdWRpb0NvbnRleHQoKSkge1xuICAgICAgICAgICAgdGhpcy5zdGFydFRpbWUgPSAwO1xuICAgICAgICAgICAgdGhpcy5zdGFydE9mZnNldCA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBtYW5hZ2VyLmNvbnRleHQ7XG4gICAgICAgICAgICB0aGlzLmdhaW4gPSBjb250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VuZC5hdWRpbykge1xuICAgICAgICAgICAgLy8gaGFuZGxlIHRoZSBjYXNlIHdoZXJlIHNvdW5kIHdhc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBzb3VuZC5hdWRpby5jbG9uZU5vZGUoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTsgLy8gbm90IGluaXRpYWxseSBwbGF5aW5nXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgdmFsdWUgZm9yIHRoZSB2b2x1bWUuIEJldHdlZW4gMCBhbmQgMS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSB2b2x1bWUgb2YgdGhlIGNoYW5uZWwuXG4gICAgICovXG4gICAgZ2V0Vm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy52b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjdXJyZW50IGxvb3Bpbmcgc3RhdGUgb2YgdGhlIENoYW5uZWwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVGhlIGxvb3AgcHJvcGVydHkgZm9yIHRoZSBjaGFubmVsLlxuICAgICAqL1xuICAgIGdldExvb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlL2Rpc2FibGUgdGhlIGxvb3AgcHJvcGVydHkgdG8gbWFrZSB0aGUgc291bmQgcmVzdGFydCBmcm9tIHRoZSBiZWdpbm5pbmcgd2hlbiBpdFxuICAgICAqIHJlYWNoZXMgdGhlIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbG9vcCAtIFRydWUgdG8gbG9vcCB0aGUgc291bmQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXRMb29wKGxvb3ApIHtcbiAgICAgICAgdGhpcy5sb29wID0gbG9vcDtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wID0gbG9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY3VycmVudCBwaXRjaCBvZiB0aGUgQ2hhbm5lbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBwaXRjaCBvZiB0aGUgY2hhbm5lbC5cbiAgICAgKi9cbiAgICBnZXRQaXRjaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ3ZvbHVtZWNoYW5nZScgZXZlbnQuXG4gICAgICovXG4gICAgb25NYW5hZ2VyVm9sdW1lQ2hhbmdlKCkge1xuICAgICAgICB0aGlzLnNldFZvbHVtZSh0aGlzLmdldFZvbHVtZSgpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAnc3VzcGVuZCcgZXZlbnQuXG4gICAgICovXG4gICAgb25NYW5hZ2VyU3VzcGVuZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKCkgJiYgIXRoaXMuc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLnN1c3BlbmRlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAncmVzdW1lJyBldmVudC5cbiAgICAgKi9cbiAgICBvbk1hbmFnZXJSZXN1bWUoKSB7XG4gICAgICAgIGlmICh0aGlzLnN1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5zdXNwZW5kZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMudW5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmVnaW4gcGxheWJhY2sgb2Ygc291bmQuXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGwgc3RvcCgpIGJlZm9yZSBjYWxsaW5nIHBsYXkoKScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgdGhpcy5zdGFydFRpbWUgPSB0aGlzLm1hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgdGhpcy5zdGFydE9mZnNldCAlIHRoaXMuc291cmNlLmJ1ZmZlci5kdXJhdGlvbik7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB2b2x1bWUgYW5kIGxvb3AgLSBub3RlIG1vdmVkIHRvIGJlIGFmdGVyIHN0YXJ0KCkgYmVjYXVzZSBvZiBDaHJvbWUgYnVnXG4gICAgICAgIHRoaXMuc2V0Vm9sdW1lKHRoaXMudm9sdW1lKTtcbiAgICAgICAgdGhpcy5zZXRMb29wKHRoaXMubG9vcCk7XG4gICAgICAgIHRoaXMuc2V0UGl0Y2godGhpcy5waXRjaCk7XG5cbiAgICAgICAgdGhpcy5tYW5hZ2VyLm9uKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLm9uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMubWFuYWdlci5vbignc3VzcGVuZCcsIHRoaXMub25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMubWFuYWdlci5vbigncmVzdW1lJywgdGhpcy5vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuXG4gICAgICAgIC8vIHN1c3BlbmQgaW1tZWRpYXRlbHkgaWYgbWFuYWdlciBpcyBzdXNwZW5kZWRcbiAgICAgICAgaWYgKHRoaXMubWFuYWdlci5zdXNwZW5kZWQpXG4gICAgICAgICAgICB0aGlzLm9uTWFuYWdlclN1c3BlbmQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZSBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbCB1bnBhdXNlKCkgdG8gcmVzdW1lIHBsYXliYWNrIGZyb20gdGhlIHNhbWUgcG9zaXRpb24uXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICB0aGlzLnN0YXJ0T2Zmc2V0ICs9IHRoaXMubWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lIC0gdGhpcy5zdGFydFRpbWU7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lIHBsYXliYWNrIG9mIHRoZSBzb3VuZC4gUGxheWJhY2sgcmVzdW1lcyBhdCB0aGUgcG9pbnQgdGhhdCB0aGUgYXVkaW8gd2FzIHBhdXNlZC5cbiAgICAgKi9cbiAgICB1bnBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UgfHwgIXRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0NhbGwgcGF1c2UoKSBiZWZvcmUgdW5wYXVzaW5nLicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhcnRUaW1lID0gdGhpcy5tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIHRoaXMuc3RhcnRPZmZzZXQgJSB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24pO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcGFyYW1ldGVyc1xuICAgICAgICB0aGlzLnNldFZvbHVtZSh0aGlzLnZvbHVtZSk7XG4gICAgICAgIHRoaXMuc2V0TG9vcCh0aGlzLmxvb3ApO1xuICAgICAgICB0aGlzLnNldFBpdGNoKHRoaXMucGl0Y2gpO1xuXG4gICAgICAgIHRoaXMucGF1c2VkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbGluZyBwbGF5KCkgYWdhaW4gd2lsbCByZXN0YXJ0IHBsYXliYWNrIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGVcbiAgICAgKiBzb3VuZC5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1hbmFnZXIub2ZmKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLm9uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMubWFuYWdlci5vZmYoJ3N1c3BlbmQnLCB0aGlzLm9uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLm1hbmFnZXIub2ZmKCdyZXN1bWUnLCB0aGlzLm9uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSB2b2x1bWUgb2YgcGxheWJhY2sgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZSAtIFRoZSB2b2x1bWUgb2YgdGhlIHNvdW5kLiBXaWxsIGJlIGNsYW1wZWQgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqL1xuICAgIHNldFZvbHVtZSh2b2x1bWUpIHtcbiAgICAgICAgdm9sdW1lID0gbWF0aC5jbGFtcCh2b2x1bWUsIDAsIDEpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgaWYgKHRoaXMuZ2Fpbikge1xuICAgICAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB2b2x1bWUgKiB0aGlzLm1hbmFnZXIudm9sdW1lO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0UGl0Y2gocGl0Y2gpIHtcbiAgICAgICAgdGhpcy5waXRjaCA9IHBpdGNoO1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXliYWNrUmF0ZS52YWx1ZSA9IHBpdGNoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaXNQbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gKCF0aGlzLnBhdXNlZCAmJiAodGhpcy5zb3VyY2UucGxheWJhY2tTdGF0ZSA9PT0gdGhpcy5zb3VyY2UuUExBWUlOR19TVEFURSkpO1xuICAgIH1cblxuICAgIGdldER1cmF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2UgPyB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24gOiAwO1xuICAgIH1cblxuICAgIF9jcmVhdGVTb3VyY2UoKSB7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLm1hbmFnZXIuY29udGV4dDtcblxuICAgICAgICBpZiAodGhpcy5zb3VuZC5idWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlID0gY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuc291bmQuYnVmZmVyO1xuXG4gICAgICAgICAgICAvLyBDb25uZWN0IHVwIHRoZSBub2Rlc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLmdhaW4pO1xuICAgICAgICAgICAgdGhpcy5nYWluLmNvbm5lY3QoY29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBzb3VyY2UgYXMgcGF1c2VkIHdoZW4gaXQgZW5kc1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLm9uZW5kZWQgPSB0aGlzLnBhdXNlLmJpbmQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmICghaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICBPYmplY3QuYXNzaWduKENoYW5uZWwucHJvdG90eXBlLCB7XG4gICAgICAgIHBsYXk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGF1c2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRWb2x1bWUodGhpcy52b2x1bWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TG9vcCh0aGlzLmxvb3ApO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGl0Y2godGhpcy5waXRjaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ3ZvbHVtZWNoYW5nZScsIHRoaXMub25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5vbignc3VzcGVuZCcsIHRoaXMub25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ3Jlc3VtZScsIHRoaXMub25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcblxuICAgICAgICAgICAgLy8gc3VzcGVuZCBpbW1lZGlhdGVseSBpZiBtYW5hZ2VyIGlzIHN1c3BlbmRlZFxuICAgICAgICAgICAgaWYgKHRoaXMubWFuYWdlci5zdXNwZW5kZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1hbmFnZXJTdXNwZW5kKCk7XG5cbiAgICAgICAgfSxcblxuICAgICAgICBwYXVzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgdW5wYXVzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLm9mZigndm9sdW1lY2hhbmdlJywgdGhpcy5vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLm9mZignc3VzcGVuZCcsIHRoaXMub25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub2ZmKCdyZXN1bWUnLCB0aGlzLm9uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0Vm9sdW1lOiBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgICAgICAgICB2b2x1bWUgPSBtYXRoLmNsYW1wKHZvbHVtZSwgMCwgMSk7XG4gICAgICAgICAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnZvbHVtZSA9IHZvbHVtZSAqIHRoaXMubWFuYWdlci52b2x1bWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0UGl0Y2g6IGZ1bmN0aW9uIChwaXRjaCkge1xuICAgICAgICAgICAgdGhpcy5waXRjaCA9IHBpdGNoO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheWJhY2tSYXRlID0gcGl0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0RHVyYXRpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNvdXJjZSAmJiAhaXNOYU4odGhpcy5zb3VyY2UuZHVyYXRpb24pID8gdGhpcy5zb3VyY2UuZHVyYXRpb24gOiAwO1xuICAgICAgICB9LFxuXG4gICAgICAgIGlzUGxheWluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICF0aGlzLnNvdXJjZS5wYXVzZWQ7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZXhwb3J0IHsgQ2hhbm5lbCB9O1xuIl0sIm5hbWVzIjpbIkNoYW5uZWwiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJzb3VuZCIsIm9wdGlvbnMiLCJfb3B0aW9ucyR2b2x1bWUiLCJfb3B0aW9ucyRsb29wIiwiX29wdGlvbnMkcGl0Y2giLCJ2b2x1bWUiLCJsb29wIiwicGl0Y2giLCJwYXVzZWQiLCJzdXNwZW5kZWQiLCJzb3VyY2UiLCJoYXNBdWRpb0NvbnRleHQiLCJzdGFydFRpbWUiLCJzdGFydE9mZnNldCIsImNvbnRleHQiLCJnYWluIiwiY3JlYXRlR2FpbiIsImF1ZGlvIiwiY2xvbmVOb2RlIiwicGF1c2UiLCJnZXRWb2x1bWUiLCJnZXRMb29wIiwic2V0TG9vcCIsImdldFBpdGNoIiwib25NYW5hZ2VyVm9sdW1lQ2hhbmdlIiwic2V0Vm9sdW1lIiwib25NYW5hZ2VyU3VzcGVuZCIsImlzUGxheWluZyIsIm9uTWFuYWdlclJlc3VtZSIsInVucGF1c2UiLCJwbGF5IiwiRXJyb3IiLCJfY3JlYXRlU291cmNlIiwiY3VycmVudFRpbWUiLCJzdGFydCIsImJ1ZmZlciIsImR1cmF0aW9uIiwic2V0UGl0Y2giLCJvbiIsInN0b3AiLCJjb25zb2xlIiwid2FybiIsIm9mZiIsIm1hdGgiLCJjbGFtcCIsInZhbHVlIiwicGxheWJhY2tSYXRlIiwicGxheWJhY2tTdGF0ZSIsIlBMQVlJTkdfU1RBVEUiLCJnZXREdXJhdGlvbiIsImNyZWF0ZUJ1ZmZlclNvdXJjZSIsImNvbm5lY3QiLCJkZXN0aW5hdGlvbiIsIm9uZW5kZWQiLCJiaW5kIiwiT2JqZWN0IiwiYXNzaWduIiwicHJvdG90eXBlIiwiaXNOYU4iXSwibWFwcGluZ3MiOiI7OztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsT0FBTyxDQUFDO0FBQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUVDLEtBQUssRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUFBLElBQUEsSUFBQUMsZUFBQSxFQUFBQyxhQUFBLEVBQUFDLGNBQUEsQ0FBQTtJQUN0QyxJQUFJLENBQUNDLE1BQU0sR0FBQSxDQUFBSCxlQUFBLEdBQUdELE9BQU8sQ0FBQ0ksTUFBTSxLQUFBLElBQUEsR0FBQUgsZUFBQSxHQUFJLENBQUMsQ0FBQTtJQUNqQyxJQUFJLENBQUNJLElBQUksR0FBQSxDQUFBSCxhQUFBLEdBQUdGLE9BQU8sQ0FBQ0ssSUFBSSxLQUFBLElBQUEsR0FBQUgsYUFBQSxHQUFJLEtBQUssQ0FBQTtJQUNqQyxJQUFJLENBQUNJLEtBQUssR0FBQSxDQUFBSCxjQUFBLEdBQUdILE9BQU8sQ0FBQ00sS0FBSyxLQUFBLElBQUEsR0FBQUgsY0FBQSxHQUFJLENBQUMsQ0FBQTtJQUUvQixJQUFJLENBQUNKLEtBQUssR0FBR0EsS0FBSyxDQUFBO0lBRWxCLElBQUksQ0FBQ1EsTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNDLFNBQVMsR0FBRyxLQUFLLENBQUE7SUFFdEIsSUFBSSxDQUFDVixPQUFPLEdBQUdBLE9BQU8sQ0FBQTtJQUV0QixJQUFJLENBQUNXLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFFbEIsSUFBSUMsZUFBZSxFQUFFLEVBQUU7TUFDbkIsSUFBSSxDQUFDQyxTQUFTLEdBQUcsQ0FBQyxDQUFBO01BQ2xCLElBQUks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