import { blueNoiseData } from '../../core/math/blue-noise.js';
import { PIXELFORMAT_RGBA8, ADDRESS_REPEAT, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { Texture } from '../../platform/graphics/texture.js';

const deviceCache = new DeviceCache();
function getBlueNoiseTexture(device) {
  return deviceCache.get(device, () => {
    const data = blueNoiseData();
    const size = Math.sqrt(data.length / 4);
    const texture = new Texture(device, {
      name: `BlueNoise${size}`,
      width: size,
      height: size,
      format: PIXELFORMAT_RGBA8,
      addressU: ADDRESS_REPEAT,
      addressV: ADDRESS_REPEAT,
      type: TEXTURETYPE_DEFAULT,
      magFilter: FILTER_NEAREST,
      minFilter: FILTER_NEAREST,
      anisotropy: 1,
      mipmaps: false
    });
    texture.lock().set(data);
    texture.unlock();
    return texture;
  });
}

export { getBlueNoiseTexture };
