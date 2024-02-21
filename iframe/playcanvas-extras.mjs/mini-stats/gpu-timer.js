/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 62b0cffb3
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 */
class GpuTimer {
  constructor(device) {
    this.device = device;
    device.gpuProfiler.enabled = true;
    this.enabled = true;
    this.unitsName = 'ms';
    this.decimalPlaces = 1;
    this._timings = [];
  }
  get timings() {
    this._timings[0] = this.device.gpuProfiler._frameTime;
    return this._timings;
  }
}

export { GpuTimer };
