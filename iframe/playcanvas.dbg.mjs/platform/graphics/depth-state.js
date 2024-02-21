import { BitPacking } from '../../core/math/bit-packing.js';
import { StringIds } from '../../core/string-ids.js';
import { FUNC_ALWAYS, FUNC_LESSEQUAL } from './constants.js';

var _class;
const stringIds = new StringIds();

// masks (to only keep relevant bits)
const funcMask = 0b111;

// shifts values to where individual parts are stored
const funcShift = 0; // 00 - 02 (3bits)
const writeShift = 3; // 03 - 03 (1bit)

/**
 * DepthState is a descriptor that defines how the depth value of the fragment is used by the
 * rendering pipeline. A depth state can be set on a material using {@link Material#depthState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setDepthState}.
 *
 * For the best performance, do not modify depth state after it has been created, but create
 * multiple depth states and assign them to the material or graphics device as needed.
 *
 * @category Graphics
 */
class DepthState {
  /**
   * Create a new Depth State instance.
   *
   * @param {number} func - Controls how the depth of the fragment is compared against the
   * current depth contained in the depth buffer. See {@link DepthState#func} for details.
   * Defaults to {@link FUNC_LESSEQUAL}.
   * @param {boolean} write - If true, depth values are written to the depth buffer of the
   * currently active render target. Defaults to true.
   */
  constructor(func = FUNC_LESSEQUAL, write = true) {
    /**
     * Bitfield representing the depth state.
     *
     * @private
     */
    this.data = 0;
    this._depthBias = 0;
    this._depthBiasSlope = 0;
    /**
     * A unique number representing the depth state. You can use this number to quickly compare
     * two depth states for equality. The key is always maintained valid without a dirty flag,
     * to avoid condition check at runtime, considering these change rarely.
     *
     * @type {number}
     */
    this.key = 0;
    this.func = func;
    this.write = write;
  }

  /**
   * If true, a shader fragment is only written to the current render target if it passes the depth
   * test. If false, it is written regardless of what is in the depth buffer. Note that when depth
   * testing is disabled, writes to the depth buffer are also disabled. Defaults to true.
   *
   * @type {boolean}
   */
  set test(value) {
    this.func = value ? FUNC_LESSEQUAL : FUNC_ALWAYS;
    this.updateKey();
  }
  get test() {
    return this.func !== FUNC_ALWAYS;
  }

  /**
   * If true, shader write a depth value to the depth buffer of the currently active render
   * target. If false, no depth value is written.
   *
   * @type {boolean}
   */
  set write(value) {
    this.data = BitPacking.set(this.data, value ? 1 : 0, writeShift);
    this.updateKey();
  }
  get write() {
    return BitPacking.all(this.data, writeShift);
  }

  /**
   * Controls how the depth of the fragment is compared against the current depth contained in
   * the depth buffer. Can be:
   *
   * - {@link FUNC_NEVER}: don't draw
   * - {@link FUNC_LESS}: draw if new depth < depth buffer
   * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
   * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
   * - {@link FUNC_GREATER}: draw if new depth > depth buffer
   * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
   * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
   * - {@link FUNC_ALWAYS}: always draw
   *
   * @type {number}
   */
  set func(value) {
    this.data = BitPacking.set(this.data, value, funcShift, funcMask);
    this.updateKey();
  }
  get func() {
    return BitPacking.get(this.data, funcShift, funcMask);
  }

  /**
   * Constant depth bias added to each fragment's depth. Useful for decals to prevent z-fighting.
   * Typically a small negative value (-0.1) is used to render the mesh slightly closer to the
   * camera. Defaults to 0.
   *
   * @type {number}
   */
  set depthBias(value) {
    this._depthBias = value;
    this.updateKey();
  }
  get depthBias() {
    return this._depthBias;
  }

  /**
   * Depth bias that scales with the fragment’s slope. Defaults to 0.
   *
   * @type {number}
   */
  set depthBiasSlope(value) {
    this._depthBiasSlope = value;
    this.updateKey();
  }
  get depthBiasSlope() {
    return this._depthBiasSlope;
  }

  /**
   * Copies the contents of a source depth state to this depth state.
   *
   * @param {DepthState} rhs - A depth state to copy from.
   * @returns {DepthState} Self for chaining.
   */
  copy(rhs) {
    this.data = rhs.data;
    this._depthBias = rhs._depthBias;
    this._depthBiasSlope = rhs._depthBiasSlope;
    this.key = rhs.key;
    return this;
  }

  /**
   * Returns an identical copy of the specified depth state.
   *
   * @returns {this} The result of the cloning.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
  updateKey() {
    const {
      data,
      _depthBias,
      _depthBiasSlope
    } = this;
    const key = `${data}-${_depthBias}-${_depthBiasSlope}`;

    // convert string to a unique number
    this.key = stringIds.get(key);
  }

  /**
   * Reports whether two DepthStates are equal.
   *
   * @param {DepthState} rhs - The depth state to compare to.
   * @returns {boolean} True if the depth states are equal and false otherwise.
   */
  equals(rhs) {
    return this.key === rhs.key;
  }

  /**
   * A default depth state that has the depth testing function set to {@link FUNC_LESSEQUAL} and depth writes enabled.
   *
   * @type {DepthState}
   * @readonly
   */
}
_class = DepthState;
DepthState.DEFAULT = Object.freeze(new _class());
/**
 * A depth state that always passes the fragment but does not write depth to the depth buffer.
 *
 * @type {DepthState}
 * @readonly
 */
DepthState.NODEPTH = Object.freeze(new _class(FUNC_ALWAYS, false));
/**
 * A depth state that always passes the fragment and writes depth to the depth buffer.
 *
 * @type {DepthState}
 * @readonly
 */
DepthState.WRITEDEPTH = Object.freeze(new _class(FUNC_ALWAYS, true));

export { DepthState };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwdGgtc3RhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCaXRQYWNraW5nIH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC9iaXQtcGFja2luZy5qc1wiO1xuaW1wb3J0IHsgU3RyaW5nSWRzIH0gZnJvbSBcIi4uLy4uL2NvcmUvc3RyaW5nLWlkcy5qc1wiO1xuaW1wb3J0IHtcbiAgICBGVU5DX0xFU1NFUVVBTCwgRlVOQ19BTFdBWVNcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5jb25zdCBzdHJpbmdJZHMgPSBuZXcgU3RyaW5nSWRzKCk7XG5cbi8vIG1hc2tzICh0byBvbmx5IGtlZXAgcmVsZXZhbnQgYml0cylcbmNvbnN0IGZ1bmNNYXNrID0gMGIxMTE7XG5cbi8vIHNoaWZ0cyB2YWx1ZXMgdG8gd2hlcmUgaW5kaXZpZHVhbCBwYXJ0cyBhcmUgc3RvcmVkXG5jb25zdCBmdW5jU2hpZnQgPSAwOyAgICAgICAvLyAwMCAtIDAyICgzYml0cylcbmNvbnN0IHdyaXRlU2hpZnQgPSAzOyAgICAgIC8vIDAzIC0gMDMgKDFiaXQpXG5cbi8qKlxuICogRGVwdGhTdGF0ZSBpcyBhIGRlc2NyaXB0b3IgdGhhdCBkZWZpbmVzIGhvdyB0aGUgZGVwdGggdmFsdWUgb2YgdGhlIGZyYWdtZW50IGlzIHVzZWQgYnkgdGhlXG4gKiByZW5kZXJpbmcgcGlwZWxpbmUuIEEgZGVwdGggc3RhdGUgY2FuIGJlIHNldCBvbiBhIG1hdGVyaWFsIHVzaW5nIHtAbGluayBNYXRlcmlhbCNkZXB0aFN0YXRlfSxcbiAqIG9yIGluIHNvbWUgY2FzZXMgb24gdGhlIGdyYXBoaWNzIGRldmljZSB1c2luZyB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0RGVwdGhTdGF0ZX0uXG4gKlxuICogRm9yIHRoZSBiZXN0IHBlcmZvcm1hbmNlLCBkbyBub3QgbW9kaWZ5IGRlcHRoIHN0YXRlIGFmdGVyIGl0IGhhcyBiZWVuIGNyZWF0ZWQsIGJ1dCBjcmVhdGVcbiAqIG11bHRpcGxlIGRlcHRoIHN0YXRlcyBhbmQgYXNzaWduIHRoZW0gdG8gdGhlIG1hdGVyaWFsIG9yIGdyYXBoaWNzIGRldmljZSBhcyBuZWVkZWQuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIERlcHRoU3RhdGUge1xuICAgIC8qKlxuICAgICAqIEJpdGZpZWxkIHJlcHJlc2VudGluZyB0aGUgZGVwdGggc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGRhdGEgPSAwO1xuXG4gICAgX2RlcHRoQmlhcyA9IDA7XG5cbiAgICBfZGVwdGhCaWFzU2xvcGUgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQSB1bmlxdWUgbnVtYmVyIHJlcHJlc2VudGluZyB0aGUgZGVwdGggc3RhdGUuIFlvdSBjYW4gdXNlIHRoaXMgbnVtYmVyIHRvIHF1aWNrbHkgY29tcGFyZVxuICAgICAqIHR3byBkZXB0aCBzdGF0ZXMgZm9yIGVxdWFsaXR5LiBUaGUga2V5IGlzIGFsd2F5cyBtYWludGFpbmVkIHZhbGlkIHdpdGhvdXQgYSBkaXJ0eSBmbGFnLFxuICAgICAqIHRvIGF2b2lkIGNvbmRpdGlvbiBjaGVjayBhdCBydW50aW1lLCBjb25zaWRlcmluZyB0aGVzZSBjaGFuZ2UgcmFyZWx5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBrZXkgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IERlcHRoIFN0YXRlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBDb250cm9scyBob3cgdGhlIGRlcHRoIG9mIHRoZSBmcmFnbWVudCBpcyBjb21wYXJlZCBhZ2FpbnN0IHRoZVxuICAgICAqIGN1cnJlbnQgZGVwdGggY29udGFpbmVkIGluIHRoZSBkZXB0aCBidWZmZXIuIFNlZSB7QGxpbmsgRGVwdGhTdGF0ZSNmdW5jfSBmb3IgZGV0YWlscy5cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGUgLSBJZiB0cnVlLCBkZXB0aCB2YWx1ZXMgYXJlIHdyaXR0ZW4gdG8gdGhlIGRlcHRoIGJ1ZmZlciBvZiB0aGVcbiAgICAgKiBjdXJyZW50bHkgYWN0aXZlIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZnVuYyA9IEZVTkNfTEVTU0VRVUFMLCB3cml0ZSA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5mdW5jID0gZnVuYztcbiAgICAgICAgdGhpcy53cml0ZSA9IHdyaXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIGEgc2hhZGVyIGZyYWdtZW50IGlzIG9ubHkgd3JpdHRlbiB0byB0aGUgY3VycmVudCByZW5kZXIgdGFyZ2V0IGlmIGl0IHBhc3NlcyB0aGUgZGVwdGhcbiAgICAgKiB0ZXN0LiBJZiBmYWxzZSwgaXQgaXMgd3JpdHRlbiByZWdhcmRsZXNzIG9mIHdoYXQgaXMgaW4gdGhlIGRlcHRoIGJ1ZmZlci4gTm90ZSB0aGF0IHdoZW4gZGVwdGhcbiAgICAgKiB0ZXN0aW5nIGlzIGRpc2FibGVkLCB3cml0ZXMgdG8gdGhlIGRlcHRoIGJ1ZmZlciBhcmUgYWxzbyBkaXNhYmxlZC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCB0ZXN0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZnVuYyA9IHZhbHVlID8gRlVOQ19MRVNTRVFVQUwgOiBGVU5DX0FMV0FZUztcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgdGVzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnVuYyAhPT0gRlVOQ19BTFdBWVM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgc2hhZGVyIHdyaXRlIGEgZGVwdGggdmFsdWUgdG8gdGhlIGRlcHRoIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXJcbiAgICAgKiB0YXJnZXQuIElmIGZhbHNlLCBubyBkZXB0aCB2YWx1ZSBpcyB3cml0dGVuLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHdyaXRlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IEJpdFBhY2tpbmcuc2V0KHRoaXMuZGF0YSwgdmFsdWUgPyAxIDogMCwgd3JpdGVTaGlmdCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IHdyaXRlKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5hbGwodGhpcy5kYXRhLCB3cml0ZVNoaWZ0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgdGhlIGRlcHRoIG9mIHRoZSBmcmFnbWVudCBpcyBjb21wYXJlZCBhZ2FpbnN0IHRoZSBjdXJyZW50IGRlcHRoIGNvbnRhaW5lZCBpblxuICAgICAqIHRoZSBkZXB0aCBidWZmZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBkb24ndCBkcmF3XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogZHJhdyBpZiBuZXcgZGVwdGggPCBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA8PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBkcmF3IGlmIG5ldyBkZXB0aCA+IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCAhPSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID49IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIGRyYXdcbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZ1bmModmFsdWUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gQml0UGFja2luZy5zZXQodGhpcy5kYXRhLCB2YWx1ZSwgZnVuY1NoaWZ0LCBmdW5jTWFzayk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGZ1bmMoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmdldCh0aGlzLmRhdGEsIGZ1bmNTaGlmdCwgZnVuY01hc2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnN0YW50IGRlcHRoIGJpYXMgYWRkZWQgdG8gZWFjaCBmcmFnbWVudCdzIGRlcHRoLiBVc2VmdWwgZm9yIGRlY2FscyB0byBwcmV2ZW50IHotZmlnaHRpbmcuXG4gICAgICogVHlwaWNhbGx5IGEgc21hbGwgbmVnYXRpdmUgdmFsdWUgKC0wLjEpIGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoIHNsaWdodGx5IGNsb3NlciB0byB0aGVcbiAgICAgKiBjYW1lcmEuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkZXB0aEJpYXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGVwdGhCaWFzID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGRlcHRoQmlhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoQmlhcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXB0aCBiaWFzIHRoYXQgc2NhbGVzIHdpdGggdGhlIGZyYWdtZW504oCZcyBzbG9wZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRlcHRoQmlhc1Nsb3BlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2RlcHRoQmlhc1Nsb3BlID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGRlcHRoQmlhc1Nsb3BlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGhCaWFzU2xvcGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSBkZXB0aCBzdGF0ZSB0byB0aGlzIGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtEZXB0aFN0YXRlfSByaHMgLSBBIGRlcHRoIHN0YXRlIHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7RGVwdGhTdGF0ZX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gcmhzLmRhdGE7XG4gICAgICAgIHRoaXMuX2RlcHRoQmlhcyA9IHJocy5fZGVwdGhCaWFzO1xuICAgICAgICB0aGlzLl9kZXB0aEJpYXNTbG9wZSA9IHJocy5fZGVwdGhCaWFzU2xvcGU7XG4gICAgICAgIHRoaXMua2V5ID0gcmhzLmtleTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IFRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGNsb25lLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgdXBkYXRlS2V5KCkge1xuICAgICAgICBjb25zdCB7IGRhdGEsIF9kZXB0aEJpYXMsIF9kZXB0aEJpYXNTbG9wZSB9ID0gdGhpcztcbiAgICAgICAgY29uc3Qga2V5ID0gYCR7ZGF0YX0tJHtfZGVwdGhCaWFzfS0ke19kZXB0aEJpYXNTbG9wZX1gO1xuXG4gICAgICAgIC8vIGNvbnZlcnQgc3RyaW5nIHRvIGEgdW5pcXVlIG51bWJlclxuICAgICAgICB0aGlzLmtleSA9IHN0cmluZ0lkcy5nZXQoa2V5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIERlcHRoU3RhdGVzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RGVwdGhTdGF0ZX0gcmhzIC0gVGhlIGRlcHRoIHN0YXRlIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGRlcHRoIHN0YXRlcyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmtleSA9PT0gcmhzLmtleTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRlZmF1bHQgZGVwdGggc3RhdGUgdGhhdCBoYXMgdGhlIGRlcHRoIHRlc3RpbmcgZnVuY3Rpb24gc2V0IHRvIHtAbGluayBGVU5DX0xFU1NFUVVBTH0gYW5kIGRlcHRoIHdyaXRlcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge0RlcHRoU3RhdGV9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIERFRkFVTFQgPSBPYmplY3QuZnJlZXplKG5ldyBEZXB0aFN0YXRlKCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBkZXB0aCBzdGF0ZSB0aGF0IGFsd2F5cyBwYXNzZXMgdGhlIGZyYWdtZW50IGJ1dCBkb2VzIG5vdCB3cml0ZSBkZXB0aCB0byB0aGUgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge0RlcHRoU3RhdGV9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIE5PREVQVEggPSBPYmplY3QuZnJlZXplKG5ldyBEZXB0aFN0YXRlKEZVTkNfQUxXQVlTLCBmYWxzZSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBkZXB0aCBzdGF0ZSB0aGF0IGFsd2F5cyBwYXNzZXMgdGhlIGZyYWdtZW50IGFuZCB3cml0ZXMgZGVwdGggdG8gdGhlIGRlcHRoIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtEZXB0aFN0YXRlfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBXUklURURFUFRIID0gT2JqZWN0LmZyZWV6ZShuZXcgRGVwdGhTdGF0ZShGVU5DX0FMV0FZUywgdHJ1ZSkpO1xufVxuXG5leHBvcnQgeyBEZXB0aFN0YXRlIH07XG4iXSwibmFtZXMiOlsic3RyaW5nSWRzIiwiU3RyaW5nSWRzIiwiZnVuY01hc2siLCJmdW5jU2hpZnQiLCJ3cml0ZVNoaWZ0IiwiRGVwdGhTdGF0ZSIsImNvbnN0cnVjdG9yIiwiZnVuYyIsIkZVTkNfTEVTU0VRVUFMIiwid3JpdGUiLCJkYXRhIiwiX2RlcHRoQmlhcyIsIl9kZXB0aEJpYXNTbG9wZSIsImtleSIsInRlc3QiLCJ2YWx1ZSIsIkZVTkNfQUxXQVlTIiwidXBkYXRlS2V5IiwiQml0UGFja2luZyIsInNldCIsImFsbCIsImdldCIsImRlcHRoQmlhcyIsImRlcHRoQmlhc1Nsb3BlIiwiY29weSIsInJocyIsImNsb25lIiwiZXF1YWxzIiwiX2NsYXNzIiwiREVGQVVMVCIsIk9iamVjdCIsImZyZWV6ZSIsIk5PREVQVEgiLCJXUklURURFUFRIIl0sIm1hcHBpbmdzIjoiOzs7OztBQU1BLE1BQU1BLFNBQVMsR0FBRyxJQUFJQyxTQUFTLEVBQUUsQ0FBQTs7QUFFakM7QUFDQSxNQUFNQyxRQUFRLEdBQUcsS0FBSyxDQUFBOztBQUV0QjtBQUNBLE1BQU1DLFNB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
