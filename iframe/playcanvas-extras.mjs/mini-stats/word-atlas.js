/**
 * @license
 * PlayCanvas Engine v0.0.0 revision e3db93de2
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 */
import { math, Texture, FILTER_NEAREST } from 'playcanvas';

class WordAtlas {
  constructor(device, words) {
    const initContext = context => {
      context.font = '10px "Lucida Console", Monaco, monospace';
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
    };
    const isNumber = word => {
      return word === '.' || word.length === 1 && word.charCodeAt(0) >= 48 && word.charCodeAt(0) <= 57;
    };
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {
      alpha: true
    });
    initContext(context);
    const placements = new Map();
    const padding = 5;
    const width = 512;
    let x = padding;
    let y = padding;
    words.forEach(word => {
      const measurement = context.measureText(word);
      const l = Math.ceil(-measurement.actualBoundingBoxLeft);
      const r = Math.ceil(measurement.actualBoundingBoxRight);
      const a = Math.ceil(measurement.actualBoundingBoxAscent);
      const d = Math.ceil(measurement.actualBoundingBoxDescent);
      const w = l + r;
      const h = a + d;
      if (x + w + padding >= width) {
        x = padding;
        y += 16;
      }
      placements.set(word, {
        l,
        r,
        a,
        d,
        w,
        h,
        x: x,
        y: y
      });
      x += w + padding;
    });
    canvas.width = 512;
    canvas.height = math.nextPowerOfTwo(y + 16 + padding);
    initContext(context);
    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    placements.forEach((m, word) => {
      context.fillStyle = isNumber(word) ? 'rgb(255, 255, 255)' : 'rgb(170, 170, 170)';
      context.fillText(word, m.x - m.l, m.y + m.a);
    });
    this.placements = placements;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = data[i + 0];
      data[i + 0] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
    this.texture = new Texture(device, {
      name: 'mini-stats-word-atlas',
      width: canvas.width,
      height: canvas.height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      levels: [data]
    });
  }
  destroy() {
    this.texture.destroy();
    this.texture = null;
  }
  render(render2d, word, x, y) {
    const p = this.placements.get(word);
    if (p) {
      const padding = 1;
      render2d.quad(x + p.l - padding, y - p.d + padding, p.w + padding * 2, p.h + padding * 2, p.x - padding, this.texture.height - p.y - p.h - padding, undefined, undefined, this.texture, 1);
      return p.w;
    }
    return 0;
  }
}

export { WordAtlas };