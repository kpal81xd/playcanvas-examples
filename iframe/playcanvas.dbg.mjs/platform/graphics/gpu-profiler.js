import { TRACEID_GPU_TIMINGS } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';

/**
 * Base class of a simple GPU profiler.
 */
class GpuProfiler {
  constructor() {
    /**
     * Profiling slots allocated for the current frame, storing the names of the slots.
     *
     * @type {string[]}
     * @ignore
     */
    this.frameAllocations = [];
    /**
     * Map of past frame allocations, indexed by renderVersion
     *
     * @type {Map<number, string[]>}
     * @ignore
     */
    this.pastFrameAllocations = new Map();
    /**
     * The if enabled in the current frame.
     * @ignore
     */
    this._enabled = false;
    /**
     * The enable request for the next frame.
     * @ignore
     */
    this._enableRequest = false;
    /**
     * The time it took to render the last frame on GPU, or 0 if the profiler is not enabled
     * @ignore
     */
    this._frameTime = 0;
  }
  loseContext() {
    this.pastFrameAllocations.clear();
  }

  /**
   * True to enable the profiler.
   *
   * @type {boolean}
   */
  set enabled(value) {
    this._enableRequest = value;
  }
  get enabled() {
    return this._enableRequest;
  }
  processEnableRequest() {
    if (this._enableRequest !== this._enabled) {
      this._enabled = this._enableRequest;
      if (!this._enabled) {
        this._frameTime = 0;
      }
    }
  }
  request(renderVersion) {
    this.pastFrameAllocations.set(renderVersion, this.frameAllocations);
    this.frameAllocations = [];
  }
  report(renderVersion, timings) {
    if (timings) {
      const allocations = this.pastFrameAllocations.get(renderVersion);
      Debug.assert(allocations.length === timings.length);

      // store frame duration
      if (timings.length > 0) {
        this._frameTime = timings[0];
      }

      // log out timings
      if (Tracing.get(TRACEID_GPU_TIMINGS)) {
        for (let i = 0; i < allocations.length; ++i) {
          const name = allocations[i];
          Debug.trace(TRACEID_GPU_TIMINGS, `${timings[i].toFixed(2)} ms ${name}`);
        }
      }
    }

    // remove frame info
    this.pastFrameAllocations.delete(renderVersion);
  }

  /**
   * Allocate a slot for GPU timing during the frame. This slot is valid only for the current
   * frame. This allows multiple timers to be used during the frame, each with a unique name.
   * @param {string} name - The name of the slot.
   * @returns {number} The assigned slot index.
   * @ignore
   */
  getSlot(name) {
    const slot = this.frameAllocations.length;
    this.frameAllocations.push(name);
    return slot;
  }

  /**
   * Number of slots allocated during the frame.
   *
   * @ignore
   */
  get slotCount() {
    return this.frameAllocations.length;
  }
}

export { GpuProfiler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3B1LXByb2ZpbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZ3B1LXByb2ZpbGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfR1BVX1RJTUlOR1MgfSBmcm9tIFwiLi4vLi4vY29yZS9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcbmltcG9ydCB7IFRyYWNpbmcgfSBmcm9tIFwiLi4vLi4vY29yZS90cmFjaW5nLmpzXCI7XG5cbi8qKlxuICogQmFzZSBjbGFzcyBvZiBhIHNpbXBsZSBHUFUgcHJvZmlsZXIuXG4gKi9cbmNsYXNzIEdwdVByb2ZpbGVyIHtcbiAgICAvKipcbiAgICAgKiBQcm9maWxpbmcgc2xvdHMgYWxsb2NhdGVkIGZvciB0aGUgY3VycmVudCBmcmFtZSwgc3RvcmluZyB0aGUgbmFtZXMgb2YgdGhlIHNsb3RzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmcmFtZUFsbG9jYXRpb25zID0gW107XG5cbiAgICAvKipcbiAgICAgKiBNYXAgb2YgcGFzdCBmcmFtZSBhbGxvY2F0aW9ucywgaW5kZXhlZCBieSByZW5kZXJWZXJzaW9uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWFwPG51bWJlciwgc3RyaW5nW10+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBwYXN0RnJhbWVBbGxvY2F0aW9ucyA9IG5ldyBNYXAoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBpZiBlbmFibGVkIGluIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGVuYWJsZSByZXF1ZXN0IGZvciB0aGUgbmV4dCBmcmFtZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2VuYWJsZVJlcXVlc3QgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0aW1lIGl0IHRvb2sgdG8gcmVuZGVyIHRoZSBsYXN0IGZyYW1lIG9uIEdQVSwgb3IgMCBpZiB0aGUgcHJvZmlsZXIgaXMgbm90IGVuYWJsZWRcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2ZyYW1lVGltZSA9IDA7XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5wYXN0RnJhbWVBbGxvY2F0aW9ucy5jbGVhcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgdG8gZW5hYmxlIHRoZSBwcm9maWxlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2VuYWJsZVJlcXVlc3QgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZVJlcXVlc3Q7XG4gICAgfVxuXG4gICAgcHJvY2Vzc0VuYWJsZVJlcXVlc3QoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVSZXF1ZXN0ICE9PSB0aGlzLl9lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlUmVxdWVzdDtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZyYW1lVGltZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXF1ZXN0KHJlbmRlclZlcnNpb24pIHtcbiAgICAgICAgdGhpcy5wYXN0RnJhbWVBbGxvY2F0aW9ucy5zZXQocmVuZGVyVmVyc2lvbiwgdGhpcy5mcmFtZUFsbG9jYXRpb25zKTtcbiAgICAgICAgdGhpcy5mcmFtZUFsbG9jYXRpb25zID0gW107XG4gICAgfVxuXG4gICAgcmVwb3J0KHJlbmRlclZlcnNpb24sIHRpbWluZ3MpIHtcblxuICAgICAgICBpZiAodGltaW5ncykge1xuICAgICAgICAgICAgY29uc3QgYWxsb2NhdGlvbnMgPSB0aGlzLnBhc3RGcmFtZUFsbG9jYXRpb25zLmdldChyZW5kZXJWZXJzaW9uKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChhbGxvY2F0aW9ucy5sZW5ndGggPT09IHRpbWluZ3MubGVuZ3RoKTtcblxuICAgICAgICAgICAgLy8gc3RvcmUgZnJhbWUgZHVyYXRpb25cbiAgICAgICAgICAgIGlmICh0aW1pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9mcmFtZVRpbWUgPSB0aW1pbmdzWzBdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsb2cgb3V0IHRpbWluZ3NcbiAgICAgICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX0dQVV9USU1JTkdTKSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsb2NhdGlvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IGFsbG9jYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX0dQVV9USU1JTkdTLCBgJHt0aW1pbmdzW2ldLnRvRml4ZWQoMil9IG1zICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZnJhbWUgaW5mb1xuICAgICAgICB0aGlzLnBhc3RGcmFtZUFsbG9jYXRpb25zLmRlbGV0ZShyZW5kZXJWZXJzaW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbGxvY2F0ZSBhIHNsb3QgZm9yIEdQVSB0aW1pbmcgZHVyaW5nIHRoZSBmcmFtZS4gVGhpcyBzbG90IGlzIHZhbGlkIG9ubHkgZm9yIHRoZSBjdXJyZW50XG4gICAgICogZnJhbWUuIFRoaXMgYWxsb3dzIG11bHRpcGxlIHRpbWVycyB0byBiZSB1c2VkIGR1cmluZyB0aGUgZnJhbWUsIGVhY2ggd2l0aCBhIHVuaXF1ZSBuYW1lLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHNsb3QuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGFzc2lnbmVkIHNsb3QgaW5kZXguXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFNsb3QobmFtZSkge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5mcmFtZUFsbG9jYXRpb25zLmxlbmd0aDtcbiAgICAgICAgdGhpcy5mcmFtZUFsbG9jYXRpb25zLnB1c2gobmFtZSk7XG4gICAgICAgIHJldHVybiBzbG90O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE51bWJlciBvZiBzbG90cyBhbGxvY2F0ZWQgZHVyaW5nIHRoZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgc2xvdENvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcmFtZUFsbG9jYXRpb25zLmxlbmd0aDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdwdVByb2ZpbGVyIH07XG4iXSwibmFtZXMiOlsiR3B1UHJvZmlsZXIiLCJjb25zdHJ1Y3RvciIsImZyYW1lQWxsb2NhdGlvbnMiLCJwYXN0RnJhbWVBbGxvY2F0aW9ucyIsIk1hcCIsIl9lbmFibGVkIiwiX2VuYWJsZVJlcXVlc3QiLCJfZnJhbWVUaW1lIiwibG9zZUNvbnRleHQiLCJjbGVhciIsImVuYWJsZWQiLCJ2YWx1ZSIsInByb2Nlc3NFbmFibGVSZXF1ZXN0IiwicmVxdWVzdCIsInJlbmRlclZlcnNpb24iLCJzZXQiLCJyZXBvcnQiLCJ0aW1pbmdzIiwiYWxsb2NhdGlvbnMiLCJnZXQiLCJEZWJ1ZyIsImFzc2VydCIsImxlbmd0aCIsIlRyYWNpbmciLCJUUkFDRUlEX0dQVV9USU1JTkdTIiwiaSIsIm5hbWUi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
