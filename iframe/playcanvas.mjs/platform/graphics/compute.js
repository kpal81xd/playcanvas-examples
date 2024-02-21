class Compute {
  constructor(graphicsDevice, shader) {
    this.shader = null;
    this.device = graphicsDevice;
    this.shader = shader;
    if (graphicsDevice.supportsCompute) {
      this.impl = graphicsDevice.createComputeImpl(this);
    }
  }
  dispatch(x, y, z) {
    var _this$impl;
    (_this$impl = this.impl) == null || _this$impl.dispatch(x, y, z);
  }
}

export { Compute };
