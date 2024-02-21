import '../../../core/tracing.js';
import { BindGroup } from '../bind-group.js';

class WebgpuCompute {
  constructor(compute) {
    this.compute = compute;
    const {
      device,
      shader
    } = compute;
    const {
      computeBindGroupFormat
    } = shader.impl;
    this.bindGroup = new BindGroup(device, computeBindGroupFormat);
    this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
  }
  dispatch(x, y, z) {
    const device = this.compute.device;
    device.startComputePass();
    const {
      bindGroup
    } = this;
    bindGroup.update();
    device.setBindGroup(0, bindGroup);
    const passEncoder = device.passEncoder;
    passEncoder.setPipeline(this.pipeline);
    passEncoder.dispatchWorkgroups(x, y, z);
    device.endComputePass();
  }
}

export { WebgpuCompute };
