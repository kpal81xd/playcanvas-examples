import { GpuProfiler } from '../gpu-profiler.js';

/**
 * Class holding information about the queries for a single frame.
 *
 * @ignore
 */
class FrameQueriesInfo {
  constructor() {
    /**
     * The render version of the frame.
     *
     * @type {number[]}
     */
    this.renderVersion = void 0;
    /**
     * The queries for the frame.
     *
     * @type {WebGLQuery[]}
     */
    this.queries = [];
  }
  destroy(gl) {
    this.queries.forEach(query => gl.deleteQuery(query));
    this.queries = null;
  }
}

/**
 * @ignore
 */
class WebglGpuProfiler extends GpuProfiler {
  constructor(device) {
    super();
    this.device = void 0;
    /**
     * The pool of unused queries.
     *
     * @type {WebGLQuery[]}
     */
    this.freeQueries = [];
    /**
     * The pool of queries for the current frame.
     *
     * @type {WebGLQuery[]}
     */
    this.frameQueries = [];
    /**
     * A list of queries from the previous frames which are waiting for results.
     *
     * @type {FrameQueriesInfo[]}
     */
    this.previousFrameQueries = [];
    /**
     * Temporary array to storing the timings.
     *
     * @type {number[]}
     */
    this.timings = [];
    this.device = device;
    this.ext = device.extDisjointTimerQuery;
  }
  destroy() {
    this.freeQueries.forEach(query => this.device.gl.deleteQuery(query));
    this.frameQueries.forEach(query => this.device.gl.deleteQuery(query));
    this.previousFrameQueries.forEach(frameQueriesInfo => frameQueriesInfo.destroy(this.device.gl));
    this.freeQueries = null;
    this.frameQueries = null;
    this.previousFrameQueries = null;
  }

  /**
   * Called when the WebGL context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    super.loseContext();
    this.freeQueries = [];
    this.frameQueries = [];
    this.previousFrameQueries = [];
  }
  restoreContext() {
    this.ext = this.device.extDisjointTimerQuery;
  }
  getQuery() {
    var _this$freeQueries$pop;
    return (_this$freeQueries$pop = this.freeQueries.pop()) != null ? _this$freeQueries$pop : this.device.gl.createQuery();
  }
  start(name) {
    if (this.ext) {
      const slot = this.getSlot(name);
      const query = this.getQuery();
      this.frameQueries[slot] = query;
      this.device.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
      return slot;
    }
    return undefined;
  }
  end(slot) {
    if (slot !== undefined) {
      this.device.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    }
  }
  frameStart() {
    this.processEnableRequest();
    if (this._enabled) {
      this.frameGPUMarkerSlot = this.start('GpuFrame');
    }
  }
  frameEnd() {
    if (this._enabled) {
      this.end(this.frameGPUMarkerSlot);
    }
  }
  request() {
    if (this._enabled) {
      const ext = this.ext;
      const gl = this.device.gl;
      const renderVersion = this.device.renderVersion;

      // add current frame queries to the end of frames list
      const frameQueries = this.frameQueries;
      if (frameQueries.length > 0) {
        this.frameQueries = [];
        const frameQueriesInfo = new FrameQueriesInfo();
        frameQueriesInfo.queries = frameQueries;
        frameQueriesInfo.renderVersion = renderVersion;
        this.previousFrameQueries.push(frameQueriesInfo);
      }

      // try to resolve the oldest frame
      if (this.previousFrameQueries.length > 0) {
        const previousQueriesInfo = this.previousFrameQueries[0];
        const previousQueries = previousQueriesInfo.queries;
        const lastQuery = previousQueries[previousQueries.length - 1];
        const available = gl.getQueryParameter(lastQuery, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

        // valid results
        if (available && !disjoint) {
          // remove the oldest frame from the list
          this.previousFrameQueries.shift();

          // get timings
          const timings = this.timings;
          timings.length = 0;
          for (let i = 0; i < previousQueries.length; i++) {
            const query = previousQueries[i];
            const duration = gl.getQueryParameter(query, gl.QUERY_RESULT);
            timings[i] = duration * 0.000001;

            // return queries to the pool
            this.freeQueries.push(query);
          }

          // report timings
          this.report(previousQueriesInfo.renderVersion, timings);
        }

        // GPU was interrupted, discard all in-flight queries
        if (disjoint) {
          this.previousFrameQueries.forEach(frameQueriesInfo => {
            this.report(frameQueriesInfo.renderVersion, null);
            frameQueriesInfo.destroy(gl);
          });
          this.previousFrameQueries.length = 0;
        }
      }
      super.request(renderVersion);
    }
  }
}

export { WebglGpuProfiler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3B1LXByb2ZpbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3B1LXByb2ZpbGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEdwdVByb2ZpbGVyIH0gZnJvbSBcIi4uL2dwdS1wcm9maWxlci5qc1wiO1xuXG4vKipcbiAqIENsYXNzIGhvbGRpbmcgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHF1ZXJpZXMgZm9yIGEgc2luZ2xlIGZyYW1lLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRnJhbWVRdWVyaWVzSW5mbyB7XG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciB2ZXJzaW9uIG9mIHRoZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICByZW5kZXJWZXJzaW9uO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHF1ZXJpZXMgZm9yIHRoZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJHTFF1ZXJ5W119XG4gICAgICovXG4gICAgcXVlcmllcyA9IFtdO1xuXG4gICAgZGVzdHJveShnbCkge1xuICAgICAgICB0aGlzLnF1ZXJpZXMuZm9yRWFjaChxdWVyeSA9PiBnbC5kZWxldGVRdWVyeShxdWVyeSkpO1xuICAgICAgICB0aGlzLnF1ZXJpZXMgPSBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdsR3B1UHJvZmlsZXIgZXh0ZW5kcyBHcHVQcm9maWxlciB7XG4gICAgZGV2aWNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHBvb2wgb2YgdW51c2VkIHF1ZXJpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViR0xRdWVyeVtdfVxuICAgICAqL1xuICAgIGZyZWVRdWVyaWVzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcG9vbCBvZiBxdWVyaWVzIGZvciB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJHTFF1ZXJ5W119XG4gICAgICovXG4gICAgZnJhbWVRdWVyaWVzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBBIGxpc3Qgb2YgcXVlcmllcyBmcm9tIHRoZSBwcmV2aW91cyBmcmFtZXMgd2hpY2ggYXJlIHdhaXRpbmcgZm9yIHJlc3VsdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnJhbWVRdWVyaWVzSW5mb1tdfVxuICAgICAqL1xuICAgIHByZXZpb3VzRnJhbWVRdWVyaWVzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBUZW1wb3JhcnkgYXJyYXkgdG8gc3RvcmluZyB0aGUgdGltaW5ncy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICB0aW1pbmdzID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMuZXh0ID0gZGV2aWNlLmV4dERpc2pvaW50VGltZXJRdWVyeTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmZyZWVRdWVyaWVzLmZvckVhY2gocXVlcnkgPT4gdGhpcy5kZXZpY2UuZ2wuZGVsZXRlUXVlcnkocXVlcnkpKTtcbiAgICAgICAgdGhpcy5mcmFtZVF1ZXJpZXMuZm9yRWFjaChxdWVyeSA9PiB0aGlzLmRldmljZS5nbC5kZWxldGVRdWVyeShxdWVyeSkpO1xuICAgICAgICB0aGlzLnByZXZpb3VzRnJhbWVRdWVyaWVzLmZvckVhY2goZnJhbWVRdWVyaWVzSW5mbyA9PiBmcmFtZVF1ZXJpZXNJbmZvLmRlc3Ryb3kodGhpcy5kZXZpY2UuZ2wpKTtcblxuICAgICAgICB0aGlzLmZyZWVRdWVyaWVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcmFtZVF1ZXJpZXMgPSBudWxsO1xuICAgICAgICB0aGlzLnByZXZpb3VzRnJhbWVRdWVyaWVzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHN1cGVyLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHRoaXMuZnJlZVF1ZXJpZXMgPSBbXTtcbiAgICAgICAgdGhpcy5mcmFtZVF1ZXJpZXMgPSBbXTtcbiAgICAgICAgdGhpcy5wcmV2aW91c0ZyYW1lUXVlcmllcyA9IFtdO1xuICAgIH1cblxuICAgIHJlc3RvcmVDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmV4dCA9IHRoaXMuZGV2aWNlLmV4dERpc2pvaW50VGltZXJRdWVyeTtcbiAgICB9XG5cbiAgICBnZXRRdWVyeSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJlZVF1ZXJpZXMucG9wKCkgPz8gdGhpcy5kZXZpY2UuZ2wuY3JlYXRlUXVlcnkoKTtcbiAgICB9XG5cbiAgICBzdGFydChuYW1lKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZXh0KSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmdldFNsb3QobmFtZSk7XG4gICAgICAgICAgICBjb25zdCBxdWVyeSA9IHRoaXMuZ2V0UXVlcnkoKTtcbiAgICAgICAgICAgIHRoaXMuZnJhbWVRdWVyaWVzW3Nsb3RdID0gcXVlcnk7XG4gICAgICAgICAgICB0aGlzLmRldmljZS5nbC5iZWdpblF1ZXJ5KHRoaXMuZXh0LlRJTUVfRUxBUFNFRF9FWFQsIHF1ZXJ5KTtcblxuICAgICAgICAgICAgcmV0dXJuIHNsb3Q7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGVuZChzbG90KSB7XG5cbiAgICAgICAgaWYgKHNsb3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UuZ2wuZW5kUXVlcnkodGhpcy5leHQuVElNRV9FTEFQU0VEX0VYVCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVN0YXJ0KCkge1xuXG4gICAgICAgIHRoaXMucHJvY2Vzc0VuYWJsZVJlcXVlc3QoKTtcblxuICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5mcmFtZUdQVU1hcmtlclNsb3QgPSB0aGlzLnN0YXJ0KCdHcHVGcmFtZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnJhbWVFbmQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmVuZCh0aGlzLmZyYW1lR1BVTWFya2VyU2xvdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXF1ZXN0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0O1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmRldmljZS5nbDtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclZlcnNpb24gPSB0aGlzLmRldmljZS5yZW5kZXJWZXJzaW9uO1xuXG4gICAgICAgICAgICAvLyBhZGQgY3VycmVudCBmcmFtZSBxdWVyaWVzIHRvIHRoZSBlbmQgb2YgZnJhbWVzIGxpc3RcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lUXVlcmllcyA9IHRoaXMuZnJhbWVRdWVyaWVzO1xuICAgICAgICAgICAgaWYgKGZyYW1lUXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFtZVF1ZXJpZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lUXVlcmllc0luZm8gPSBuZXcgRnJhbWVRdWVyaWVzSW5mbygpO1xuICAgICAgICAgICAgICAgIGZyYW1lUXVlcmllc0luZm8ucXVlcmllcyA9IGZyYW1lUXVlcmllcztcbiAgICAgICAgICAgICAgICBmcmFtZVF1ZXJpZXNJbmZvLnJlbmRlclZlcnNpb24gPSByZW5kZXJWZXJzaW9uO1xuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNGcmFtZVF1ZXJpZXMucHVzaChmcmFtZVF1ZXJpZXNJbmZvKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdHJ5IHRvIHJlc29sdmUgdGhlIG9sZGVzdCBmcmFtZVxuICAgICAgICAgICAgaWYgKHRoaXMucHJldmlvdXNGcmFtZVF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzUXVlcmllc0luZm8gPSB0aGlzLnByZXZpb3VzRnJhbWVRdWVyaWVzWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzUXVlcmllcyA9IHByZXZpb3VzUXVlcmllc0luZm8ucXVlcmllcztcbiAgICAgICAgICAgICAgICBjb25zdCBsYXN0UXVlcnkgPSBwcmV2aW91c1F1ZXJpZXNbcHJldmlvdXNRdWVyaWVzLmxlbmd0aCAtIDFdO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gZ2wuZ2V0UXVlcnlQYXJhbWV0ZXIobGFzdFF1ZXJ5LCBnbC5RVUVSWV9SRVNVTFRfQVZBSUxBQkxFKTtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXNqb2ludCA9IGdsLmdldFBhcmFtZXRlcihleHQuR1BVX0RJU0pPSU5UX0VYVCk7XG5cbiAgICAgICAgICAgICAgICAvLyB2YWxpZCByZXN1bHRzXG4gICAgICAgICAgICAgICAgaWYgKGF2YWlsYWJsZSAmJiAhZGlzam9pbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgdGhlIG9sZGVzdCBmcmFtZSBmcm9tIHRoZSBsaXN0XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNGcmFtZVF1ZXJpZXMuc2hpZnQoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBnZXQgdGltaW5nc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1pbmdzID0gdGhpcy50aW1pbmdzO1xuICAgICAgICAgICAgICAgICAgICB0aW1pbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJldmlvdXNRdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBxdWVyeSA9IHByZXZpb3VzUXVlcmllc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uID0gZ2wuZ2V0UXVlcnlQYXJhbWV0ZXIocXVlcnksIGdsLlFVRVJZX1JFU1VMVCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1pbmdzW2ldID0gZHVyYXRpb24gKiAwLjAwMDAwMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmV0dXJuIHF1ZXJpZXMgdG8gdGhlIHBvb2xcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnJlZVF1ZXJpZXMucHVzaChxdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyByZXBvcnQgdGltaW5nc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlcG9ydChwcmV2aW91c1F1ZXJpZXNJbmZvLnJlbmRlclZlcnNpb24sIHRpbWluZ3MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEdQVSB3YXMgaW50ZXJydXB0ZWQsIGRpc2NhcmQgYWxsIGluLWZsaWdodCBxdWVyaWVzXG4gICAgICAgICAgICAgICAgaWYgKGRpc2pvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNGcmFtZVF1ZXJpZXMuZm9yRWFjaCgoZnJhbWVRdWVyaWVzSW5mbykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXBvcnQoZnJhbWVRdWVyaWVzSW5mby5yZW5kZXJWZXJzaW9uLCBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lUXVlcmllc0luZm8uZGVzdHJveShnbCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzRnJhbWVRdWVyaWVzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzdXBlci5yZXF1ZXN0KHJlbmRlclZlcnNpb24pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJnbEdwdVByb2ZpbGVyIH07XG4iXSwibmFtZXMiOlsiRnJhbWVRdWVyaWVzSW5mbyIsImNvbnN0cnVjdG9yIiwicmVuZGVyVmVyc2lvbiIsInF1ZXJpZXMiLCJkZXN0cm95IiwiZ2wiLCJmb3JFYWNoIiwicXVlcnkiLCJkZWxldGVRdWVyeSIsIldlYmdsR3B1UHJvZmlsZXIiLCJHcHVQcm9maWxlciIsImRldmljZSIsImZyZWVRdWVyaWVzIiwiZnJhbWVRdWVyaWVzIiwicHJldmlvdXNGcmFtZVF1ZXJpZXMiLCJ0aW1pbmdzIiwiZXh0IiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiZnJhbWVRdWVyaWVzSW5mbyIsImxvc2VDb250ZXh0IiwicmVzdG9yZUNvbnRleHQiLCJnZXRRdWVyeSIsIl90aGlzJGZyZWVRdWVyaWVzJHBvcCIsInBvcCIsImNyZWF0ZVF1ZXJ5Iiwic3RhcnQiLCJuYW1lIiwic2xvdCIsImdldFNsb3QiLCJiZWdpblF1ZXJ5IiwiVElNRV9FTEFQU0VEX0VYVCIsInVuZGVmaW5lZCIsImVuZCIsImVuZFF1ZXJ5IiwiZnJhbWVTdGFydCIsInByb2Nlc3NFbmFibGVSZXF1ZXN0IiwiX2VuYWJsZWQiLCJmcmFtZUdQVU1hcmtlclNsb3QiLCJmcmFtZUVuZCIsInJlcXVlc3QiLCJsZW5ndGgiLCJwdXNoIiwicHJldmlvdXNRdWVyaWVzSW5mbyIsInByZXZpb3VzUXVlcmllcyIsImxhc3RRdWVyeSIsImF2YWlsYWJsZSIsImdldFF1ZXJ5UGFyYW1ldGVyIiwiUVVFUllfUkVTVUxUX0FWQUlMQUJMRSIsImRpc2pvaW50IiwiZ2V0UGFyYW1ldGVyIiwiR1BVX0RJU0pPSU5UX0VYVCIsInNoaWZ0IiwiaSIsImR1cmF0aW9uIiwiUVVFUllfUkVTVUxUIiwicmVwb3J0Il0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxnQkFBZ0IsQ0FBQztFQUFBQyxXQUFBLEdBQUE7QUFDbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUFBLEdBQUE7RUFFWkMsT0FBT0EsQ0FBQ0MsRUFBRSxFQUFFO0FBQ1IsSUFBQSxJQUFJLENBQUNGLE9BQU8sQ0FBQ0csT0FBTyxDQUFDQyxLQUFLLElBQUlGLEVBQUUsQ0FBQ0csV0FBVyxDQUFDRCxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBQ3BELElBQUksQ0FBQ0osT0FBTyxHQUFHLElBQUksQ0FBQTtBQUN2QixHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFNTSxnQkFBZ0IsU0FBU0MsV0FBVyxDQUFDO0VBK0J2Q1QsV0FBV0EsQ0FBQ1UsTUFBTSxFQUFFO0FBQ2hCLElBQUEsS0FBSyxFQUFFLENBQUE7QUFBQyxJQUFBLElBQUEsQ0EvQlpBLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxXQUFXLEdBQUcsRUFBRSxDQUFBO0FBRWhCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxZQUFZLEdBQUcsRUFBRSxDQUFBO0FBRWpCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxvQkFBb0IsR0FBRyxFQUFFLENBQUE7QUFFekI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFJUixJQUFJLENBQUNKLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDSyxHQUFHLEdBQUdMLE1BQU0sQ0FBQ00scUJBQXFCLENBQUE7QUFDM0MsR0FBQTtBQUVBYixFQUFBQSxPQUFPQSxHQUFHO0FBQ04sSUFBQSxJQUFJLENBQUNRLFdBQVcsQ0FBQ04sT0FBTyxDQUFDQyxLQUFLLElBQUksSUFBSSxDQUFDSSxNQUFNLENBQUNOLEVBQUUsQ0FBQ0csV0FBVyxDQUFDRCxLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQ3BFLElBQUEsSUFBSSxDQUFDTSxZQUFZLENBQUNQLE9BQU8sQ0FBQ0MsS0FBSyxJQUFJLElBQUksQ0FBQ0ksTUFBTSxDQUFDTixFQUFFLENBQUNHLFdBQVcsQ0FBQ0QsS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUNyRSxJQUFBLElBQUksQ0FBQ08sb0JBQW9CLENBQUNSLE9BQU8sQ0FBQ1ksZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDZCxPQUFPLENBQUMsSUFBSSxDQUFDTyxNQUFNLENBQUNOLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFFL0YsSUFBSSxDQUFDTyxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLElBQUksQ0FBQTtBQUNwQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUssRUFBQUEsV0FBV0EsR0FBRztJQUNWLEtBQUssQ0FBQ0EsV0FBVyxFQUFFLENBQUE7SUFDbkIsSUFBSSxDQUFDUCxXQUFXLEdBQUcsRUFBRSxDQUFBO0lBQ3JCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTtJQUN0QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLEVBQUUsQ0FBQTtBQUNsQyxHQUFBO0FBRUFNLEVBQUFBLGNBQWNBLEdBQUc7QUFDYixJQUFBLElBQUksQ0FBQ0osR0FBRyxHQUFHLElBQUksQ0FBQ0wsTUFBTSxDQUFDTSxxQkFBcUIsQ0FBQTtBQUNoRCxHQUFBO0FBRUFJLEVBQUFBLFFBQVFBLEdBQUc7QUFBQSxJQUFBLElBQUFDLHFCQUFBLENBQUE7SUFDUCxPQUFBQSxDQUFBQSxxQkFBQSxHQUFPLElBQUksQ0FBQ1YsV0FBVyxDQUFDVyxHQUFHLEVBQUUsS0FBQSxJQUFBLEdBQUFELHFCQUFBLEdBQUksSUFBSSxDQUFDWCxNQUFNLENBQUNOLEVBQUUsQ0FBQ21CLFdBQVcsRUFBRSxDQUFBO0FBQ2pFLEdBQUE7RUFFQUMsS0FBS0EsQ0FBQ0MsSUFBSSxFQUFFO0lBRVIsSUFBSSxJQUFJLENBQUNWLEdBQUcsRUFBRTtBQUVWLE1BQUEsTUFBTVcsSUFBSSxHQUFHLElBQUksQ0FBQ0MsT0FBTyxDQUFDRixJQUFJLENBQUMsQ0FBQTtBQUMvQixNQUFBLE1BQU1uQixLQUFLLEdBQUcsSUFBSSxDQUFDYyxRQUFRLEVBQUUsQ0FBQTtBQUM3QixNQUFBLElBQUksQ0FBQ1IsWUFBWSxDQUFDYyxJQUFJLENBQUMsR0FBR3BCLEtBQUssQ0FBQTtBQUMvQixNQUFBLElBQUksQ0FBQ0ksTUFBTSxDQUFDTixFQUFFLENBQUN3QixVQUFVLENBQUMsSUFBSSxDQUFDYixHQUFHLENBQUNjLGdCQUFnQixFQUFFdkIsS0FBSyxDQUFDLENBQUE7QUFFM0QsTUFBQSxPQUFPb0IsSUFBSSxDQUFBO0FBQ2YsS0FBQTtBQUVBLElBQUEsT0FBT0ksU0FBUyxDQUFBO0FBQ3BCLEdBQUE7RUFFQUMsR0FBR0EsQ0FBQ0wsSUFBSSxFQUFFO0lBRU4sSUFBSUEsSUFBSSxLQUFLSSxTQUFTLEVBQUU7QUFDcEIsTUFBQSxJQUFJLENBQUNwQixNQUFNLENBQUNOLEVBQUUsQ0FBQzRCLFFBQVEsQ0FBQyxJQUFJLENBQUNqQixHQUFHLENBQUNjLGdCQUFnQixDQUFDLENBQUE7QUFDdEQsS0FBQTtBQUNKLEdBQUE7QUFFQUksRUFBQUEsVUFBVUEsR0FBRztJQUVULElBQUksQ0FBQ0Msb0JBQW9CLEVBQUUsQ0FBQTtJQUUzQixJQUFJLElBQUksQ0FBQ0MsUUFBUSxFQUFFO01BQ2YsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxJQUFJLENBQUNaLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUNwRCxLQUFBO0FBQ0osR0FBQTtBQUVBYSxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsSUFBSSxJQUFJLENBQUNGLFFBQVEsRUFBRTtBQUNmLE1BQUEsSUFBSSxDQUFDSixHQUFHLENBQUMsSUFBSSxDQUFDSyxrQkFBa0IsQ0FBQyxDQUFBO0FBQ3JDLEtBQUE7QUFDSixHQUFBO0FBRUFFLEVBQUFBLE9BQU9BLEdBQUc7SUFFTixJQUFJLElBQUksQ0FBQ0gsUUFBUSxFQUFFO0FBRWYsTUFBQSxNQUFNcEIsR0FBRyxHQUFHLElBQUksQ0FBQ0EsR0FBRyxDQUFBO0FBQ3BCLE1BQUEsTUFBTVgsRUFBRSxHQUFHLElBQUksQ0FBQ00sTUFBTSxDQUFDTixFQUFFLENBQUE7QUFDekIsTUFBQSxNQUFNSCxhQUFhLEdBQUcsSUFBSSxDQUFDUyxNQUFNLENBQUNULGFBQWEsQ0FBQTs7QUFFL0M7QUFDQSxNQUFBLE1BQU1XLFlBQVksR0FBRyxJQUFJLENBQUNBLFlBQVksQ0FBQTtBQUN0QyxNQUFBLElBQUlBLFlBQVksQ0FBQzJCLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDekIsSUFBSSxDQUFDM0IsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUV0QixRQUFBLE1BQU1LLGdCQUFnQixHQUFHLElBQUlsQixnQkFBZ0IsRUFBRSxDQUFBO1FBQy9Da0IsZ0JBQWdCLENBQUNmLE9BQU8sR0FBR1UsWUFBWSxDQUFBO1FBQ3ZDSyxnQkFBZ0IsQ0FBQ2hCLGFBQWEsR0FBR0EsYUFBYSxDQUFBO0FBQzlDLFFBQUEsSUFBSSxDQUFDWSxvQkFBb0IsQ0FBQzJCLElBQUksQ0FBQ3ZCLGdCQUFnQixDQUFDLENBQUE7QUFDcEQsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSSxJQUFJLENBQUNKLG9CQUFvQixDQUFDMEIsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUN0QyxRQUFBLE1BQU1FLG1CQUFtQixHQUFHLElBQUksQ0FBQzVCLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hELFFBQUEsTUFBTTZCLGVBQWUsR0FBR0QsbUJBQW1CLENBQUN2QyxPQUFPLENBQUE7UUFDbkQsTUFBTXlDLFNBQVMsR0FBR0QsZUFBZSxDQUFDQSxlQUFlLENBQUNILE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUU3RCxNQUFNSyxTQUFTLEdBQUd4QyxFQUFFLENBQUN5QyxpQkFBaUIsQ0FBQ0YsU0FBUyxFQUFFdkMsRUFBRSxDQUFDMEMsc0JBQXNCLENBQUMsQ0FBQTtRQUM1RSxNQUFNQyxRQUFRLEdBQUczQyxFQUFFLENBQUM0QyxZQUFZLENBQUNqQyxHQUFHLENBQUNrQyxnQkFBZ0IsQ0FBQyxDQUFBOztBQUV0RDtBQUNBLFFBQUEsSUFBSUwsU0FBUyxJQUFJLENBQUNHLFFBQVEsRUFBRTtBQUV4QjtBQUNBLFVBQUEsSUFBSSxDQUFDbEMsb0JBQW9CLENBQUNxQyxLQUFLLEVBQUUsQ0FBQTs7QUFFakM7QUFDQSxVQUFBLE1BQU1wQyxPQUFPLEdBQUcsSUFBSSxDQUFDQSxPQUFPLENBQUE7VUFDNUJBLE9BQU8sQ0FBQ3lCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbEIsVUFBQSxLQUFLLElBQUlZLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1QsZUFBZSxDQUFDSCxNQUFNLEVBQUVZLENBQUMsRUFBRSxFQUFFO0FBQzdDLFlBQUEsTUFBTTdDLEtBQUssR0FBR29DLGVBQWUsQ0FBQ1MsQ0FBQyxDQUFDLENBQUE7WUFDaEMsTUFBTUMsUUFBUSxHQUFHaEQsRUFBRSxDQUFDeUMsaUJBQWlCLENBQUN2QyxLQUFLLEVBQUVGLEVBQUUsQ0FBQ2lELFlBQVksQ0FBQyxDQUFBO0FBQzdEdkMsWUFBQUEsT0FBTyxDQUFDcUMsQ0FBQyxDQUFDLEdBQUdDLFFBQVEsR0FBRyxRQUFRLENBQUE7O0FBRWhDO0FBQ0EsWUFBQSxJQUFJLENBQUN6QyxXQUFXLENBQUM2QixJQUFJLENBQUNsQyxLQUFLLENBQUMsQ0FBQTtBQUNoQyxXQUFBOztBQUVBO1VBQ0EsSUFBSSxDQUFDZ0QsTUFBTSxDQUFDYixtQkFBbUIsQ0FBQ3hDLGFBQWEsRUFBRWEsT0FBTyxDQUFDLENBQUE7QUFDM0QsU0FBQTs7QUFFQTtBQUNBLFFBQUEsSUFBSWlDLFFBQVEsRUFBRTtBQUNWLFVBQUEsSUFBSSxDQUFDbEMsb0JBQW9CLENBQUNSLE9BQU8sQ0FBRVksZ0JBQWdCLElBQUs7WUFDcEQsSUFBSSxDQUFDcUMsTUFBTSxDQUFDckMsZ0JBQWdCLENBQUNoQixhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDakRnQixZQUFBQSxnQkFBZ0IsQ0FBQ2QsT0FBTyxDQUFDQyxFQUFFLENBQUMsQ0FBQTtBQUNoQyxXQUFDLENBQUMsQ0FBQTtBQUNGLFVBQUEsSUFBSSxDQUFDUyxvQkFBb0IsQ0FBQzBCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDeEMsU0FBQTtBQUNKLE9BQUE7QUFFQSxNQUFBLEtBQUssQ0FBQ0QsT0FBTyxDQUFDckMsYUFBYSxDQUFDLENBQUE7QUFDaEMsS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==