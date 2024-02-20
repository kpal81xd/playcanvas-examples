/**
 * A representation of a compute shader with the associated data, that can be executed on the GPU.
 *
 * @ignore
 */
class Compute {
  /**
   * Create a compute instance. Note that this is supported on WebGPU only and is a no-op on
   * other platforms.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device.
   * @param {import('./shader.js').Shader} shader - The compute shader.
   */
  constructor(graphicsDevice, shader) {
    /**
     * A compute shader.
     *
     * @type {import('./shader.js').Shader|null}
     * @ignore
     */
    this.shader = null;
    this.device = graphicsDevice;
    this.shader = shader;
    if (graphicsDevice.supportsCompute) {
      this.impl = graphicsDevice.createComputeImpl(this);
    }
  }

  /**
   * Dispatch the compute work.
   *
   * @param {number} x - X dimension of the grid of work-groups to dispatch.
   * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
   * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
   */
  dispatch(x, y, z) {
    var _this$impl;
    (_this$impl = this.impl) == null || _this$impl.dispatch(x, y, z);
  }
}

export { Compute };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL2NvbXB1dGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIHJlcHJlc2VudGF0aW9uIG9mIGEgY29tcHV0ZSBzaGFkZXIgd2l0aCB0aGUgYXNzb2NpYXRlZCBkYXRhLCB0aGF0IGNhbiBiZSBleGVjdXRlZCBvbiB0aGUgR1BVLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQ29tcHV0ZSB7XG4gICAgLyoqXG4gICAgICogQSBjb21wdXRlIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyfG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNoYWRlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBjb21wdXRlIGluc3RhbmNlLiBOb3RlIHRoYXQgdGhpcyBpcyBzdXBwb3J0ZWQgb24gV2ViR1BVIG9ubHkgYW5kIGlzIGEgbm8tb3Agb25cbiAgICAgKiBvdGhlciBwbGF0Zm9ybXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLVxuICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgY29tcHV0ZSBzaGFkZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIHNoYWRlcikge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICBpZiAoZ3JhcGhpY3NEZXZpY2Uuc3VwcG9ydHNDb21wdXRlKSB7XG4gICAgICAgICAgICB0aGlzLmltcGwgPSBncmFwaGljc0RldmljZS5jcmVhdGVDb21wdXRlSW1wbCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpc3BhdGNoIHRoZSBjb21wdXRlIHdvcmsuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFggZGltZW5zaW9uIG9mIHRoZSBncmlkIG9mIHdvcmstZ3JvdXBzIHRvIGRpc3BhdGNoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZIGRpbWVuc2lvbiBvZiB0aGUgZ3JpZCBvZiB3b3JrLWdyb3VwcyB0byBkaXNwYXRjaC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWiBkaW1lbnNpb24gb2YgdGhlIGdyaWQgb2Ygd29yay1ncm91cHMgdG8gZGlzcGF0Y2guXG4gICAgICovXG4gICAgZGlzcGF0Y2goeCwgeSwgeikge1xuICAgICAgICB0aGlzLmltcGw/LmRpc3BhdGNoKHgsIHksIHopO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQ29tcHV0ZSB9O1xuIl0sIm5hbWVzIjpbIkNvbXB1dGUiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwic2hhZGVyIiwiZGV2aWNlIiwic3VwcG9ydHNDb21wdXRlIiwiaW1wbCIsImNyZWF0ZUNvbXB1dGVJbXBsIiwiZGlzcGF0Y2giLCJ4IiwieSIsInoiLCJfdGhpcyRpbXBsIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsT0FBTyxDQUFDO0FBU1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxjQUFjLEVBQUVDLE1BQU0sRUFBRTtBQWhCcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUEsQ0FBQUEsTUFBTSxHQUFHLElBQUksQ0FBQTtJQVdULElBQUksQ0FBQ0MsTUFBTSxHQUFHRixjQUFjLENBQUE7SUFDNUIsSUFBSSxDQUFDQyxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUVwQixJQUFJRCxjQUFjLENBQUNHLGVBQWUsRUFBRTtNQUNoQyxJQUFJLENBQUNDLElBQUksR0FBR0osY0FBYyxDQUFDSyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUN0RCxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxRQUFRQSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQUEsSUFBQSxJQUFBQyxVQUFBLENBQUE7QUFDZCxJQUFBLENBQUFBLFVBQUEsR0FBQSxJQUFJLENBQUNOLElBQUksYUFBVE0sVUFBQSxDQUFXSixRQUFRLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLENBQUMsQ0FBQTtBQUNoQyxHQUFBO0FBQ0o7Ozs7In0=
