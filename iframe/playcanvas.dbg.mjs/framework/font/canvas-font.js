import { string } from '../../core/string.js';
import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_RGBA8, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

const MAX_TEXTURE_SIZE = 4096;
const DEFAULT_TEXTURE_SIZE = 512;
class Atlas {
  constructor(device, width, height, name) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture = new Texture(device, {
      name: name,
      format: PIXELFORMAT_RGBA8,
      width: width,
      height: height,
      mipmaps: true,
      minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      levels: [this.canvas]
    });
    this.ctx = this.canvas.getContext('2d', {
      alpha: true
    });
  }
  destroy() {
    this.texture.destroy();
  }
  clear(clearColor) {
    const {
      width,
      height
    } = this.canvas;

    // clear to black first to remove everything as clear color is transparent
    this.ctx.clearRect(0, 0, width, height);

    // clear to color
    this.ctx.fillStyle = clearColor;
    this.ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Represents the resource of a canvas font asset.
 *
 * @augments EventHandler
 * @ignore
 */
class CanvasFont extends EventHandler {
  /**
   * Create a new CanvasFont instance.
   *
   * @param {import('../app-base.js').AppBase} app - The application.
   * @param {object} options - The font options.
   * @param {string} [options.fontName] - The name of the font. CSS font names are supported.
   * Defaults to 'Arial'.
   * @param {string} [options.fontWeight] - The weight of the font, e.g. 'normal', 'bold'.
   * Defaults to 'normal'.
   * @param {number} [options.fontSize] - The font size in pixels. Defaults to 32.
   * @param {Color} [options.color] - The font color.Defaults to white.
   * @param {number} [options.width] - The width of each texture atlas. Defaults to 512.
   * @param {number} [options.height] - The height of each texture atlas. Defaults to 512.
   * @param {number} [options.padding] - Amount of glyph padding in pixels that is added to each
   * glyph in the atlas. Defaults to 0.
   */
  constructor(app, options = {}) {
    super();
    this.type = 'bitmap';
    this.app = app;
    this.intensity = 0;
    this.fontWeight = options.fontWeight || 'normal';
    this.fontSize = parseInt(options.fontSize, 10);
    this.glyphSize = this.fontSize;
    this.fontName = options.fontName || 'Arial';
    this.color = options.color || new Color(1, 1, 1);
    this.padding = options.padding || 0;
    this.width = Math.min(MAX_TEXTURE_SIZE, options.width || DEFAULT_TEXTURE_SIZE);
    this.height = Math.min(MAX_TEXTURE_SIZE, options.height || DEFAULT_TEXTURE_SIZE);
    this.atlases = [];
    this.chars = '';
    this.data = {};
  }

  /**
   * Render the necessary textures for all characters in a string to be used for the canvas font.
   *
   * @param {string} text - The list of characters to render into the texture atlas.
   */
  createTextures(text) {
    const _chars = this._normalizeCharsSet(text);

    // different length so definitely update
    if (_chars.length !== this.chars.length) {
      this._renderAtlas(_chars);
      return;
    }

    // compare sorted characters for difference
    for (let i = 0; i < _chars.length; i++) {
      if (_chars[i] !== this.chars[i]) {
        this._renderAtlas(_chars);
        return;
      }
    }
  }

  /**
   * Update the list of characters to include in the atlas to include those provided and
   * re-render the texture atlas to include all the characters that have been supplied so far.
   *
   * @param {string} text - The list of characters to add to the texture atlas.
   */
  updateTextures(text) {
    const _chars = this._normalizeCharsSet(text);
    const newCharsSet = [];
    for (let i = 0; i < _chars.length; i++) {
      const char = _chars[i];
      if (!this.data.chars[char]) {
        newCharsSet.push(char);
      }
    }
    if (newCharsSet.length > 0) {
      this._renderAtlas(this.chars.concat(newCharsSet));
    }
  }

  /**
   * Destroys the font. This also destroys the textures owned by the font.
   */
  destroy() {
    this.atlases.forEach(atlas => atlas.destroy());

    // null instance variables to make it obvious this font is no longer valid
    this.chars = null;
    this.color = null;
    this.data = null;
    this.fontName = null;
    this.fontSize = null;
    this.glyphSize = null;
    this.intensity = null;
    this.atlases = null;
    this.type = null;
    this.fontWeight = null;
  }

  /**
   * @param {Color} color - The color to covert.
   * @param {boolean} alpha - Whether to include the alpha channel.
   * @returns {string} The hex string for the color.
   * @private
   */
  _colorToRgbString(color, alpha) {
    let str;
    const r = Math.round(255 * color.r);
    const g = Math.round(255 * color.g);
    const b = Math.round(255 * color.b);
    if (alpha) {
      str = `rgba(${r}, ${g}, ${b}, ${color.a})`;
    } else {
      str = `rgb(${r}, ${g}, ${b})`;
    }
    return str;
  }

  /**
   * @param {CanvasRenderingContext2D} context - The canvas 2D context.
   * @param {string} char - The character to render.
   * @param {number} x - The x position to render the character at.
   * @param {number} y - The y position to render the character at.
   * @param {string} color - The color to render the character in.
   * @ignore
   */
  renderCharacter(context, char, x, y, color) {
    context.fillStyle = color;
    context.fillText(char, x, y);
  }

  /**
   * Return the atlas at the specified index.
   *
   * @param {number} index - The atlas index
   * @private
   */
  _getAtlas(index) {
    if (index >= this.atlases.length) {
      this.atlases[index] = new Atlas(this.app.graphicsDevice, this.width, this.height, `font-atlas-${this.fontName}-${index}`);
    }
    return this.atlases[index];
  }

  /**
   * Renders an array of characters into one or more textures atlases.
   *
   * @param {string[]} charsArray - The list of characters to render.
   * @private
   */
  _renderAtlas(charsArray) {
    this.chars = charsArray;
    const w = this.width;
    const h = this.height;

    // fill color
    const color = this._colorToRgbString(this.color, false);

    // generate a "transparent" color for the background
    // browsers seem to optimize away all color data if alpha=0
    // so setting alpha to min value and hope this isn't noticeable
    const a = this.color.a;
    this.color.a = 1 / 255;
    const transparent = this._colorToRgbString(this.color, true);
    this.color.a = a;
    const TEXT_ALIGN = 'center';
    const TEXT_BASELINE = 'alphabetic';
    let atlasIndex = 0;
    let atlas = this._getAtlas(atlasIndex++);
    atlas.clear(transparent);
    this.data = this._createJson(this.chars, this.fontName, w, h);
    const symbols = string.getSymbols(this.chars.join(''));
    let maxHeight = 0;
    let maxDescent = 0;
    const metrics = {};
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      metrics[ch] = this._getTextMetrics(ch);
      maxHeight = Math.max(maxHeight, metrics[ch].height);
      maxDescent = Math.max(maxDescent, metrics[ch].descent);
    }
    this.glyphSize = Math.max(this.glyphSize, maxHeight);
    const sx = this.glyphSize + this.padding * 2;
    const sy = this.glyphSize + this.padding * 2;
    const _xOffset = this.glyphSize / 2 + this.padding;
    const _yOffset = sy - maxDescent - this.padding;
    let _x = 0;
    let _y = 0;
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      const code = string.getCodePoint(symbols[i]);
      let fs = this.fontSize;
      atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
      atlas.ctx.textAlign = TEXT_ALIGN;
      atlas.ctx.textBaseline = TEXT_BASELINE;
      let width = atlas.ctx.measureText(ch).width;
      if (width > fs) {
        fs = this.fontSize * this.fontSize / width;
        atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
        width = this.fontSize;
      }
      this.renderCharacter(atlas.ctx, ch, _x + _xOffset, _y + _yOffset, color);
      const xoffset = this.padding + (this.glyphSize - width) / 2;
      const yoffset = -this.padding + metrics[ch].descent - maxDescent;
      const xadvance = width;
      this._addChar(this.data, ch, code, _x, _y, sx, sy, xoffset, yoffset, xadvance, atlasIndex - 1, w, h);
      _x += sx;
      if (_x + sx > w) {
        // Wrap to the next row of this canvas if the right edge of the next glyph would overflow
        _x = 0;
        _y += sy;
        if (_y + sy > h) {
          // We ran out of space on this texture!
          atlas = this._getAtlas(atlasIndex++);
          atlas.clear(transparent);
          _y = 0;
        }
      }
    }

    // remove any unused characters
    this.atlases.splice(atlasIndex).forEach(atlas => atlas.destroy());

    // upload textures
    this.atlases.forEach(atlas => atlas.texture.upload());

    // alert text-elements that the font has been re-rendered
    this.fire('render');
  }

  /**
   * @param {string[]} chars - A list of characters.
   * @param {string} fontName - The font name.
   * @param {number} width - The width of the texture atlas.
   * @param {number} height - The height of the texture atlas.
   * @returns {object} The font JSON object.
   * @private
   */
  _createJson(chars, fontName, width, height) {
    const base = {
      'version': 3,
      'intensity': this.intensity,
      'info': {
        'face': fontName,
        'width': width,
        'height': height,
        'maps': [{
          'width': width,
          'height': height
        }]
      },
      'chars': {}
    };
    return base;
  }

  /**
   * @param {object} json - Font data.
   * @param {string} char - The character to add.
   * @param {number} charCode - The code point number of the character to add.
   * @param {number} x - The x position of the character.
   * @param {number} y - The y position of the character.
   * @param {number} w - The width of the character.
   * @param {number} h - The height of the character.
   * @param {number} xoffset - The x offset of the character.
   * @param {number} yoffset - The y offset of the character.
   * @param {number} xadvance - The x advance of the character.
   * @param {number} mapNum - The map number of the character.
   * @param {number} mapW - The width of the map.
   * @param {number} mapH - The height of the map.
   * @private
   */
  _addChar(json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
    if (json.info.maps.length < mapNum + 1) {
      json.info.maps.push({
        'width': mapW,
        'height': mapH
      });
    }
    const scale = this.fontSize / 32;
    json.chars[char] = {
      'id': charCode,
      'letter': char,
      'x': x,
      'y': y,
      'width': w,
      'height': h,
      'xadvance': xadvance / scale,
      'xoffset': xoffset / scale,
      'yoffset': (yoffset + this.padding) / scale,
      'scale': scale,
      'range': 1,
      'map': mapNum,
      'bounds': [0, 0, w / scale, h / scale]
    };
  }

  /**
   * Take a unicode string and produce the set of characters used to create that string.
   * e.g. "abcabcabc" -> ['a', 'b', 'c']
   *
   * @param {string} text - The unicode string to process.
   * @returns {string[]} The set of characters used to create the string.
   * @private
   */
  _normalizeCharsSet(text) {
    // normalize unicode if needed
    const unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
    if (unicodeConverterFunc) {
      text = unicodeConverterFunc(text);
    }
    // strip duplicates
    const set = {};
    const symbols = string.getSymbols(text);
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      if (set[ch]) continue;
      set[ch] = ch;
    }
    const chars = Object.keys(set);
    // sort
    return chars.sort();
  }

  /**
   * Calculate some metrics that aren't available via the browser API, notably character height
   * and descent size.
   *
   * @param {string} text - The text to measure.
   * @returns {{ascent: number, descent: number, height: number}} The metrics of the text.
   * @private
   */
  _getTextMetrics(text) {
    const textSpan = document.createElement('span');
    textSpan.id = 'content-span';
    textSpan.innerHTML = text;
    const block = document.createElement('div');
    block.id = 'content-block';
    block.style.display = 'inline-block';
    block.style.width = '1px';
    block.style.height = '0px';
    const div = document.createElement('div');
    div.appendChild(textSpan);
    div.appendChild(block);
    div.style.font = this.fontSize + 'px ' + this.fontName;
    const body = document.body;
    body.appendChild(div);
    let ascent = -1;
    let descent = -1;
    let height = -1;
    try {
      block.style['vertical-align'] = 'baseline';
      ascent = block.offsetTop - textSpan.offsetTop;
      block.style['vertical-align'] = 'bottom';
      height = block.offsetTop - textSpan.offsetTop;
      descent = height - ascent;
    } finally {
      document.body.removeChild(div);
    }
    return {
      ascent: ascent,
      descent: descent,
      height: height
    };
  }

  // nasty, other systems are accessing textures directly
  get textures() {
    return this.atlases.map(atlas => atlas.texture);
  }
}

export { CanvasFont };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FudmFzLWZvbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvZm9udC9jYW52YXMtZm9udC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi8uLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBQSVhFTEZPUk1BVF9SR0JBOFxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5jb25zdCBNQVhfVEVYVFVSRV9TSVpFID0gNDA5NjtcbmNvbnN0IERFRkFVTFRfVEVYVFVSRV9TSVpFID0gNTEyO1xuXG5jbGFzcyBBdGxhcyB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCB3aWR0aCwgaGVpZ2h0LCBuYW1lKSB7XG4gICAgICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgICB0aGlzLnRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBtaXBtYXBzOiB0cnVlLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGxldmVsczogW3RoaXMuY2FudmFzXVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoJzJkJywge1xuICAgICAgICAgICAgYWxwaGE6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy50ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBjbGVhcihjbGVhckNvbG9yKSB7XG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gdGhpcy5jYW52YXM7XG5cbiAgICAgICAgLy8gY2xlYXIgdG8gYmxhY2sgZmlyc3QgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcgYXMgY2xlYXIgY29sb3IgaXMgdHJhbnNwYXJlbnRcbiAgICAgICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICAgIC8vIGNsZWFyIHRvIGNvbG9yXG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNsZWFyQ29sb3I7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXNvdXJjZSBvZiBhIGNhbnZhcyBmb250IGFzc2V0LlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQ2FudmFzRm9udCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENhbnZhc0ZvbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBUaGUgZm9udCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb250TmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgZm9udC4gQ1NTIGZvbnQgbmFtZXMgYXJlIHN1cHBvcnRlZC5cbiAgICAgKiBEZWZhdWx0cyB0byAnQXJpYWwnLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb250V2VpZ2h0XSAtIFRoZSB3ZWlnaHQgb2YgdGhlIGZvbnQsIGUuZy4gJ25vcm1hbCcsICdib2xkJy5cbiAgICAgKiBEZWZhdWx0cyB0byAnbm9ybWFsJy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZm9udFNpemVdIC0gVGhlIGZvbnQgc2l6ZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDMyLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtvcHRpb25zLmNvbG9yXSAtIFRoZSBmb250IGNvbG9yLkRlZmF1bHRzIHRvIHdoaXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53aWR0aF0gLSBUaGUgd2lkdGggb2YgZWFjaCB0ZXh0dXJlIGF0bGFzLiBEZWZhdWx0cyB0byA1MTIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmhlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIGVhY2ggdGV4dHVyZSBhdGxhcy4gRGVmYXVsdHMgdG8gNTEyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5wYWRkaW5nXSAtIEFtb3VudCBvZiBnbHlwaCBwYWRkaW5nIGluIHBpeGVscyB0aGF0IGlzIGFkZGVkIHRvIGVhY2hcbiAgICAgKiBnbHlwaCBpbiB0aGUgYXRsYXMuIERlZmF1bHRzIHRvIDAuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLnR5cGUgPSAnYml0bWFwJztcblxuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcblxuICAgICAgICB0aGlzLmludGVuc2l0eSA9IDA7XG5cbiAgICAgICAgdGhpcy5mb250V2VpZ2h0ID0gb3B0aW9ucy5mb250V2VpZ2h0IHx8ICdub3JtYWwnO1xuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQob3B0aW9ucy5mb250U2l6ZSwgMTApO1xuICAgICAgICB0aGlzLmdseXBoU2l6ZSA9IHRoaXMuZm9udFNpemU7XG4gICAgICAgIHRoaXMuZm9udE5hbWUgPSBvcHRpb25zLmZvbnROYW1lIHx8ICdBcmlhbCc7XG4gICAgICAgIHRoaXMuY29sb3IgPSBvcHRpb25zLmNvbG9yIHx8IG5ldyBDb2xvcigxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5wYWRkaW5nID0gb3B0aW9ucy5wYWRkaW5nIHx8IDA7XG5cbiAgICAgICAgdGhpcy53aWR0aCA9IE1hdGgubWluKE1BWF9URVhUVVJFX1NJWkUsIG9wdGlvbnMud2lkdGggfHwgREVGQVVMVF9URVhUVVJFX1NJWkUpO1xuICAgICAgICB0aGlzLmhlaWdodCA9IE1hdGgubWluKE1BWF9URVhUVVJFX1NJWkUsIG9wdGlvbnMuaGVpZ2h0IHx8IERFRkFVTFRfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5hdGxhc2VzID0gW107XG5cbiAgICAgICAgdGhpcy5jaGFycyA9ICcnO1xuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGhlIG5lY2Vzc2FyeSB0ZXh0dXJlcyBmb3IgYWxsIGNoYXJhY3RlcnMgaW4gYSBzdHJpbmcgdG8gYmUgdXNlZCBmb3IgdGhlIGNhbnZhcyBmb250LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgbGlzdCBvZiBjaGFyYWN0ZXJzIHRvIHJlbmRlciBpbnRvIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqL1xuICAgIGNyZWF0ZVRleHR1cmVzKHRleHQpIHtcbiAgICAgICAgY29uc3QgX2NoYXJzID0gdGhpcy5fbm9ybWFsaXplQ2hhcnNTZXQodGV4dCk7XG5cbiAgICAgICAgLy8gZGlmZmVyZW50IGxlbmd0aCBzbyBkZWZpbml0ZWx5IHVwZGF0ZVxuICAgICAgICBpZiAoX2NoYXJzLmxlbmd0aCAhPT0gdGhpcy5jaGFycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckF0bGFzKF9jaGFycyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb21wYXJlIHNvcnRlZCBjaGFyYWN0ZXJzIGZvciBkaWZmZXJlbmNlXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2NoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoX2NoYXJzW2ldICE9PSB0aGlzLmNoYXJzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQXRsYXMoX2NoYXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGxpc3Qgb2YgY2hhcmFjdGVycyB0byBpbmNsdWRlIGluIHRoZSBhdGxhcyB0byBpbmNsdWRlIHRob3NlIHByb3ZpZGVkIGFuZFxuICAgICAqIHJlLXJlbmRlciB0aGUgdGV4dHVyZSBhdGxhcyB0byBpbmNsdWRlIGFsbCB0aGUgY2hhcmFjdGVycyB0aGF0IGhhdmUgYmVlbiBzdXBwbGllZCBzbyBmYXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIFRoZSBsaXN0IG9mIGNoYXJhY3RlcnMgdG8gYWRkIHRvIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqL1xuICAgIHVwZGF0ZVRleHR1cmVzKHRleHQpIHtcbiAgICAgICAgY29uc3QgX2NoYXJzID0gdGhpcy5fbm9ybWFsaXplQ2hhcnNTZXQodGV4dCk7XG4gICAgICAgIGNvbnN0IG5ld0NoYXJzU2V0ID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBfY2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSBfY2hhcnNbaV07XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGF0YS5jaGFyc1tjaGFyXSkge1xuICAgICAgICAgICAgICAgIG5ld0NoYXJzU2V0LnB1c2goY2hhcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3Q2hhcnNTZXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyQXRsYXModGhpcy5jaGFycy5jb25jYXQobmV3Q2hhcnNTZXQpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSBmb250LiBUaGlzIGFsc28gZGVzdHJveXMgdGhlIHRleHR1cmVzIG93bmVkIGJ5IHRoZSBmb250LlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuYXRsYXNlcy5mb3JFYWNoKGF0bGFzID0+IGF0bGFzLmRlc3Ryb3koKSk7XG5cbiAgICAgICAgLy8gbnVsbCBpbnN0YW5jZSB2YXJpYWJsZXMgdG8gbWFrZSBpdCBvYnZpb3VzIHRoaXMgZm9udCBpcyBubyBsb25nZXIgdmFsaWRcbiAgICAgICAgdGhpcy5jaGFycyA9IG51bGw7XG4gICAgICAgIHRoaXMuY29sb3IgPSBudWxsO1xuICAgICAgICB0aGlzLmRhdGEgPSBudWxsO1xuICAgICAgICB0aGlzLmZvbnROYW1lID0gbnVsbDtcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ2x5cGhTaXplID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnRlbnNpdHkgPSBudWxsO1xuICAgICAgICB0aGlzLmF0bGFzZXMgPSBudWxsO1xuICAgICAgICB0aGlzLnR5cGUgPSBudWxsO1xuICAgICAgICB0aGlzLmZvbnRXZWlnaHQgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IGNvbG9yIC0gVGhlIGNvbG9yIHRvIGNvdmVydC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGFscGhhIC0gV2hldGhlciB0byBpbmNsdWRlIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBoZXggc3RyaW5nIGZvciB0aGUgY29sb3IuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY29sb3JUb1JnYlN0cmluZyhjb2xvciwgYWxwaGEpIHtcbiAgICAgICAgbGV0IHN0cjtcbiAgICAgICAgY29uc3QgciA9IE1hdGgucm91bmQoMjU1ICogY29sb3Iucik7XG4gICAgICAgIGNvbnN0IGcgPSBNYXRoLnJvdW5kKDI1NSAqIGNvbG9yLmcpO1xuICAgICAgICBjb25zdCBiID0gTWF0aC5yb3VuZCgyNTUgKiBjb2xvci5iKTtcblxuICAgICAgICBpZiAoYWxwaGEpIHtcbiAgICAgICAgICAgIHN0ciA9IGByZ2JhKCR7cn0sICR7Z30sICR7Yn0sICR7Y29sb3IuYX0pYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0ciA9IGByZ2IoJHtyfSwgJHtnfSwgJHtifSlgO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0NhbnZhc1JlbmRlcmluZ0NvbnRleHQyRH0gY29udGV4dCAtIFRoZSBjYW52YXMgMkQgY29udGV4dC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhciAtIFRoZSBjaGFyYWN0ZXIgdG8gcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggcG9zaXRpb24gdG8gcmVuZGVyIHRoZSBjaGFyYWN0ZXIgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBwb3NpdGlvbiB0byByZW5kZXIgdGhlIGNoYXJhY3RlciBhdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sb3IgLSBUaGUgY29sb3IgdG8gcmVuZGVyIHRoZSBjaGFyYWN0ZXIgaW4uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlckNoYXJhY3Rlcihjb250ZXh0LCBjaGFyLCB4LCB5LCBjb2xvcikge1xuICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yO1xuICAgICAgICBjb250ZXh0LmZpbGxUZXh0KGNoYXIsIHgsIHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgYXRsYXMgYXQgdGhlIHNwZWNpZmllZCBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBhdGxhcyBpbmRleFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldEF0bGFzKGluZGV4KSB7XG4gICAgICAgIGlmIChpbmRleCA+PSB0aGlzLmF0bGFzZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmF0bGFzZXNbaW5kZXhdID0gbmV3IEF0bGFzKHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCwgYGZvbnQtYXRsYXMtJHt0aGlzLmZvbnROYW1lfS0ke2luZGV4fWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmF0bGFzZXNbaW5kZXhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJyYXkgb2YgY2hhcmFjdGVycyBpbnRvIG9uZSBvciBtb3JlIHRleHR1cmVzIGF0bGFzZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBjaGFyc0FycmF5IC0gVGhlIGxpc3Qgb2YgY2hhcmFjdGVycyB0byByZW5kZXIuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVuZGVyQXRsYXMoY2hhcnNBcnJheSkge1xuICAgICAgICB0aGlzLmNoYXJzID0gY2hhcnNBcnJheTtcblxuICAgICAgICBjb25zdCB3ID0gdGhpcy53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgICAgIC8vIGZpbGwgY29sb3JcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLl9jb2xvclRvUmdiU3RyaW5nKHRoaXMuY29sb3IsIGZhbHNlKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBhIFwidHJhbnNwYXJlbnRcIiBjb2xvciBmb3IgdGhlIGJhY2tncm91bmRcbiAgICAgICAgLy8gYnJvd3NlcnMgc2VlbSB0byBvcHRpbWl6ZSBhd2F5IGFsbCBjb2xvciBkYXRhIGlmIGFscGhhPTBcbiAgICAgICAgLy8gc28gc2V0dGluZyBhbHBoYSB0byBtaW4gdmFsdWUgYW5kIGhvcGUgdGhpcyBpc24ndCBub3RpY2VhYmxlXG4gICAgICAgIGNvbnN0IGEgPSB0aGlzLmNvbG9yLmE7XG4gICAgICAgIHRoaXMuY29sb3IuYSA9IDEgLyAyNTU7XG4gICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gdGhpcy5fY29sb3JUb1JnYlN0cmluZyh0aGlzLmNvbG9yLCB0cnVlKTtcbiAgICAgICAgdGhpcy5jb2xvci5hID0gYTtcblxuICAgICAgICBjb25zdCBURVhUX0FMSUdOID0gJ2NlbnRlcic7XG4gICAgICAgIGNvbnN0IFRFWFRfQkFTRUxJTkUgPSAnYWxwaGFiZXRpYyc7XG5cbiAgICAgICAgbGV0IGF0bGFzSW5kZXggPSAwO1xuICAgICAgICBsZXQgYXRsYXMgPSB0aGlzLl9nZXRBdGxhcyhhdGxhc0luZGV4KyspO1xuICAgICAgICBhdGxhcy5jbGVhcih0cmFuc3BhcmVudCk7XG5cbiAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5fY3JlYXRlSnNvbih0aGlzLmNoYXJzLCB0aGlzLmZvbnROYW1lLCB3LCBoKTtcblxuICAgICAgICBjb25zdCBzeW1ib2xzID0gc3RyaW5nLmdldFN5bWJvbHModGhpcy5jaGFycy5qb2luKCcnKSk7XG5cbiAgICAgICAgbGV0IG1heEhlaWdodCA9IDA7XG4gICAgICAgIGxldCBtYXhEZXNjZW50ID0gMDtcbiAgICAgICAgY29uc3QgbWV0cmljcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoID0gc3ltYm9sc1tpXTtcbiAgICAgICAgICAgIG1ldHJpY3NbY2hdID0gdGhpcy5fZ2V0VGV4dE1ldHJpY3MoY2gpO1xuICAgICAgICAgICAgbWF4SGVpZ2h0ID0gTWF0aC5tYXgobWF4SGVpZ2h0LCBtZXRyaWNzW2NoXS5oZWlnaHQpO1xuICAgICAgICAgICAgbWF4RGVzY2VudCA9IE1hdGgubWF4KG1heERlc2NlbnQsIG1ldHJpY3NbY2hdLmRlc2NlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5nbHlwaFNpemUgPSBNYXRoLm1heCh0aGlzLmdseXBoU2l6ZSwgbWF4SGVpZ2h0KTtcblxuICAgICAgICBjb25zdCBzeCA9IHRoaXMuZ2x5cGhTaXplICsgdGhpcy5wYWRkaW5nICogMjtcbiAgICAgICAgY29uc3Qgc3kgPSB0aGlzLmdseXBoU2l6ZSArIHRoaXMucGFkZGluZyAqIDI7XG4gICAgICAgIGNvbnN0IF94T2Zmc2V0ID0gdGhpcy5nbHlwaFNpemUgLyAyICsgdGhpcy5wYWRkaW5nO1xuICAgICAgICBjb25zdCBfeU9mZnNldCA9IHN5IC0gbWF4RGVzY2VudCAtIHRoaXMucGFkZGluZztcbiAgICAgICAgbGV0IF94ID0gMDtcbiAgICAgICAgbGV0IF95ID0gMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoID0gc3ltYm9sc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNvZGUgPSBzdHJpbmcuZ2V0Q29kZVBvaW50KHN5bWJvbHNbaV0pO1xuXG4gICAgICAgICAgICBsZXQgZnMgPSB0aGlzLmZvbnRTaXplO1xuICAgICAgICAgICAgYXRsYXMuY3R4LmZvbnQgPSB0aGlzLmZvbnRXZWlnaHQgKyAnICcgKyBmcy50b1N0cmluZygpICsgJ3B4ICcgKyB0aGlzLmZvbnROYW1lO1xuICAgICAgICAgICAgYXRsYXMuY3R4LnRleHRBbGlnbiA9IFRFWFRfQUxJR047XG4gICAgICAgICAgICBhdGxhcy5jdHgudGV4dEJhc2VsaW5lID0gVEVYVF9CQVNFTElORTtcblxuICAgICAgICAgICAgbGV0IHdpZHRoID0gYXRsYXMuY3R4Lm1lYXN1cmVUZXh0KGNoKS53aWR0aDtcblxuICAgICAgICAgICAgaWYgKHdpZHRoID4gZnMpIHtcbiAgICAgICAgICAgICAgICBmcyA9IHRoaXMuZm9udFNpemUgKiB0aGlzLmZvbnRTaXplIC8gd2lkdGg7XG4gICAgICAgICAgICAgICAgYXRsYXMuY3R4LmZvbnQgPSB0aGlzLmZvbnRXZWlnaHQgKyAnICcgKyBmcy50b1N0cmluZygpICsgJ3B4ICcgKyB0aGlzLmZvbnROYW1lO1xuICAgICAgICAgICAgICAgIHdpZHRoID0gdGhpcy5mb250U2l6ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5yZW5kZXJDaGFyYWN0ZXIoYXRsYXMuY3R4LCBjaCwgX3ggKyBfeE9mZnNldCwgX3kgKyBfeU9mZnNldCwgY29sb3IpO1xuXG4gICAgICAgICAgICBjb25zdCB4b2Zmc2V0ID0gdGhpcy5wYWRkaW5nICsgKHRoaXMuZ2x5cGhTaXplIC0gd2lkdGgpIC8gMjtcbiAgICAgICAgICAgIGNvbnN0IHlvZmZzZXQgPSAtdGhpcy5wYWRkaW5nICsgbWV0cmljc1tjaF0uZGVzY2VudCAtIG1heERlc2NlbnQ7XG4gICAgICAgICAgICBjb25zdCB4YWR2YW5jZSA9IHdpZHRoO1xuXG4gICAgICAgICAgICB0aGlzLl9hZGRDaGFyKHRoaXMuZGF0YSwgY2gsIGNvZGUsIF94LCBfeSwgc3gsIHN5LCB4b2Zmc2V0LCB5b2Zmc2V0LCB4YWR2YW5jZSwgYXRsYXNJbmRleCAtIDEsIHcsIGgpO1xuXG4gICAgICAgICAgICBfeCArPSBzeDtcbiAgICAgICAgICAgIGlmIChfeCArIHN4ID4gdykge1xuICAgICAgICAgICAgICAgIC8vIFdyYXAgdG8gdGhlIG5leHQgcm93IG9mIHRoaXMgY2FudmFzIGlmIHRoZSByaWdodCBlZGdlIG9mIHRoZSBuZXh0IGdseXBoIHdvdWxkIG92ZXJmbG93XG4gICAgICAgICAgICAgICAgX3ggPSAwO1xuICAgICAgICAgICAgICAgIF95ICs9IHN5O1xuICAgICAgICAgICAgICAgIGlmIChfeSArIHN5ID4gaCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBXZSByYW4gb3V0IG9mIHNwYWNlIG9uIHRoaXMgdGV4dHVyZSFcbiAgICAgICAgICAgICAgICAgICAgYXRsYXMgPSB0aGlzLl9nZXRBdGxhcyhhdGxhc0luZGV4KyspO1xuICAgICAgICAgICAgICAgICAgICBhdGxhcy5jbGVhcih0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIF95ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgYW55IHVudXNlZCBjaGFyYWN0ZXJzXG4gICAgICAgIHRoaXMuYXRsYXNlcy5zcGxpY2UoYXRsYXNJbmRleCkuZm9yRWFjaChhdGxhcyA9PiBhdGxhcy5kZXN0cm95KCkpO1xuXG4gICAgICAgIC8vIHVwbG9hZCB0ZXh0dXJlc1xuICAgICAgICB0aGlzLmF0bGFzZXMuZm9yRWFjaChhdGxhcyA9PiBhdGxhcy50ZXh0dXJlLnVwbG9hZCgpKTtcblxuICAgICAgICAvLyBhbGVydCB0ZXh0LWVsZW1lbnRzIHRoYXQgdGhlIGZvbnQgaGFzIGJlZW4gcmUtcmVuZGVyZWRcbiAgICAgICAgdGhpcy5maXJlKCdyZW5kZXInKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBjaGFycyAtIEEgbGlzdCBvZiBjaGFyYWN0ZXJzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmb250TmFtZSAtIFRoZSBmb250IG5hbWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBmb250IEpTT04gb2JqZWN0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZUpzb24oY2hhcnMsIGZvbnROYW1lLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGJhc2UgPSB7XG4gICAgICAgICAgICAndmVyc2lvbic6IDMsXG4gICAgICAgICAgICAnaW50ZW5zaXR5JzogdGhpcy5pbnRlbnNpdHksXG4gICAgICAgICAgICAnaW5mbyc6IHtcbiAgICAgICAgICAgICAgICAnZmFjZSc6IGZvbnROYW1lLFxuICAgICAgICAgICAgICAgICd3aWR0aCc6IHdpZHRoLFxuICAgICAgICAgICAgICAgICdoZWlnaHQnOiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgJ21hcHMnOiBbe1xuICAgICAgICAgICAgICAgICAgICAnd2lkdGgnOiB3aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgJ2hlaWdodCc6IGhlaWdodFxuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2NoYXJzJzoge31cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gYmFzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge29iamVjdH0ganNvbiAtIEZvbnQgZGF0YS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhciAtIFRoZSBjaGFyYWN0ZXIgdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaGFyQ29kZSAtIFRoZSBjb2RlIHBvaW50IG51bWJlciBvZiB0aGUgY2hhcmFjdGVyIHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IHBvc2l0aW9uIG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBwb3NpdGlvbiBvZiB0aGUgY2hhcmFjdGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHhvZmZzZXQgLSBUaGUgeCBvZmZzZXQgb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geW9mZnNldCAtIFRoZSB5IG9mZnNldCBvZiB0aGUgY2hhcmFjdGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4YWR2YW5jZSAtIFRoZSB4IGFkdmFuY2Ugb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFwTnVtIC0gVGhlIG1hcCBudW1iZXIgb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFwVyAtIFRoZSB3aWR0aCBvZiB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXBIIC0gVGhlIGhlaWdodCBvZiB0aGUgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZENoYXIoanNvbiwgY2hhciwgY2hhckNvZGUsIHgsIHksIHcsIGgsIHhvZmZzZXQsIHlvZmZzZXQsIHhhZHZhbmNlLCBtYXBOdW0sIG1hcFcsIG1hcEgpIHtcbiAgICAgICAgaWYgKGpzb24uaW5mby5tYXBzLmxlbmd0aCA8IG1hcE51bSArIDEpIHtcbiAgICAgICAgICAgIGpzb24uaW5mby5tYXBzLnB1c2goeyAnd2lkdGgnOiBtYXBXLCAnaGVpZ2h0JzogbWFwSCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5mb250U2l6ZSAvIDMyO1xuXG4gICAgICAgIGpzb24uY2hhcnNbY2hhcl0gPSB7XG4gICAgICAgICAgICAnaWQnOiBjaGFyQ29kZSxcbiAgICAgICAgICAgICdsZXR0ZXInOiBjaGFyLFxuICAgICAgICAgICAgJ3gnOiB4LFxuICAgICAgICAgICAgJ3knOiB5LFxuICAgICAgICAgICAgJ3dpZHRoJzogdyxcbiAgICAgICAgICAgICdoZWlnaHQnOiBoLFxuICAgICAgICAgICAgJ3hhZHZhbmNlJzogeGFkdmFuY2UgLyBzY2FsZSxcbiAgICAgICAgICAgICd4b2Zmc2V0JzogeG9mZnNldCAvIHNjYWxlLFxuICAgICAgICAgICAgJ3lvZmZzZXQnOiAoeW9mZnNldCArIHRoaXMucGFkZGluZykgLyBzY2FsZSxcbiAgICAgICAgICAgICdzY2FsZSc6IHNjYWxlLFxuICAgICAgICAgICAgJ3JhbmdlJzogMSxcbiAgICAgICAgICAgICdtYXAnOiBtYXBOdW0sXG4gICAgICAgICAgICAnYm91bmRzJzogWzAsIDAsIHcgLyBzY2FsZSwgaCAvIHNjYWxlXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2UgYSB1bmljb2RlIHN0cmluZyBhbmQgcHJvZHVjZSB0aGUgc2V0IG9mIGNoYXJhY3RlcnMgdXNlZCB0byBjcmVhdGUgdGhhdCBzdHJpbmcuXG4gICAgICogZS5nLiBcImFiY2FiY2FiY1wiIC0+IFsnYScsICdiJywgJ2MnXVxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgdW5pY29kZSBzdHJpbmcgdG8gcHJvY2Vzcy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119IFRoZSBzZXQgb2YgY2hhcmFjdGVycyB1c2VkIHRvIGNyZWF0ZSB0aGUgc3RyaW5nLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vcm1hbGl6ZUNoYXJzU2V0KHRleHQpIHtcbiAgICAgICAgLy8gbm9ybWFsaXplIHVuaWNvZGUgaWYgbmVlZGVkXG4gICAgICAgIGNvbnN0IHVuaWNvZGVDb252ZXJ0ZXJGdW5jID0gdGhpcy5hcHAuc3lzdGVtcy5lbGVtZW50LmdldFVuaWNvZGVDb252ZXJ0ZXIoKTtcbiAgICAgICAgaWYgKHVuaWNvZGVDb252ZXJ0ZXJGdW5jKSB7XG4gICAgICAgICAgICB0ZXh0ID0gdW5pY29kZUNvbnZlcnRlckZ1bmModGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3RyaXAgZHVwbGljYXRlc1xuICAgICAgICBjb25zdCBzZXQgPSB7fTtcbiAgICAgICAgY29uc3Qgc3ltYm9scyA9IHN0cmluZy5nZXRTeW1ib2xzKHRleHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoID0gc3ltYm9sc1tpXTtcbiAgICAgICAgICAgIGlmIChzZXRbY2hdKSBjb250aW51ZTtcbiAgICAgICAgICAgIHNldFtjaF0gPSBjaDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGFycyA9IE9iamVjdC5rZXlzKHNldCk7XG4gICAgICAgIC8vIHNvcnRcbiAgICAgICAgcmV0dXJuIGNoYXJzLnNvcnQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgc29tZSBtZXRyaWNzIHRoYXQgYXJlbid0IGF2YWlsYWJsZSB2aWEgdGhlIGJyb3dzZXIgQVBJLCBub3RhYmx5IGNoYXJhY3RlciBoZWlnaHRcbiAgICAgKiBhbmQgZGVzY2VudCBzaXplLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgdGV4dCB0byBtZWFzdXJlLlxuICAgICAqIEByZXR1cm5zIHt7YXNjZW50OiBudW1iZXIsIGRlc2NlbnQ6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9fSBUaGUgbWV0cmljcyBvZiB0aGUgdGV4dC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRUZXh0TWV0cmljcyh0ZXh0KSB7XG4gICAgICAgIGNvbnN0IHRleHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICB0ZXh0U3Bhbi5pZCA9ICdjb250ZW50LXNwYW4nO1xuICAgICAgICB0ZXh0U3Bhbi5pbm5lckhUTUwgPSB0ZXh0O1xuXG4gICAgICAgIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGJsb2NrLmlkID0gJ2NvbnRlbnQtYmxvY2snO1xuICAgICAgICBibG9jay5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgIGJsb2NrLnN0eWxlLndpZHRoID0gJzFweCc7XG4gICAgICAgIGJsb2NrLnN0eWxlLmhlaWdodCA9ICcwcHgnO1xuXG4gICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQodGV4dFNwYW4pO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoYmxvY2spO1xuICAgICAgICBkaXYuc3R5bGUuZm9udCA9IHRoaXMuZm9udFNpemUgKyAncHggJyArIHRoaXMuZm9udE5hbWU7XG5cbiAgICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICAgICAgICBsZXQgYXNjZW50ID0gLTE7XG4gICAgICAgIGxldCBkZXNjZW50ID0gLTE7XG4gICAgICAgIGxldCBoZWlnaHQgPSAtMTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYmxvY2suc3R5bGVbJ3ZlcnRpY2FsLWFsaWduJ10gPSAnYmFzZWxpbmUnO1xuICAgICAgICAgICAgYXNjZW50ID0gYmxvY2sub2Zmc2V0VG9wIC0gdGV4dFNwYW4ub2Zmc2V0VG9wO1xuICAgICAgICAgICAgYmxvY2suc3R5bGVbJ3ZlcnRpY2FsLWFsaWduJ10gPSAnYm90dG9tJztcbiAgICAgICAgICAgIGhlaWdodCA9IGJsb2NrLm9mZnNldFRvcCAtIHRleHRTcGFuLm9mZnNldFRvcDtcbiAgICAgICAgICAgIGRlc2NlbnQgPSBoZWlnaHQgLSBhc2NlbnQ7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpdik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXNjZW50OiBhc2NlbnQsXG4gICAgICAgICAgICBkZXNjZW50OiBkZXNjZW50LFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBuYXN0eSwgb3RoZXIgc3lzdGVtcyBhcmUgYWNjZXNzaW5nIHRleHR1cmVzIGRpcmVjdGx5XG4gICAgZ2V0IHRleHR1cmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hdGxhc2VzLm1hcChhdGxhcyA9PiBhdGxhcy50ZXh0dXJlKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENhbnZhc0ZvbnQgfTtcbiJdLCJuYW1lcyI6WyJNQVhfVEVYVFVSRV9TSVpFIiwiREVGQVVMVF9URVhUVVJFX1NJWkUiLCJBdGxhcyIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwid2lkdGgiLCJoZWlnaHQiLCJuYW1lIiwiY2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwidGV4dHVyZSIsIlRleHR1cmUiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJtYWdGaWx0ZXIiLCJGSUxURVJfTElORUFSIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImxldmVscyIsImN0eCIsImdldENvbnRleHQiLCJhbHBoYSIsImRlc3Ryb3kiLCJjbGVhciIsImNsZWFyQ29sb3IiLCJjbGVhclJlY3QiLCJmaWxsU3R5bGUiLCJmaWxsUmVjdCIsIkNhbnZhc0ZvbnQiLCJFdmVudEhhbmRsZXIiLCJhcHAiLCJvcHRpb25zIiwidHlwZSIsImludGVuc2l0eSIsImZvbnRXZWlnaHQiLCJmb250U2l6ZSIsInBhcnNlSW50IiwiZ2x5cGhTaXplIiwiZm9udE5hbWUiLCJjb2xvciIsIkNvbG9yIiwicGFkZGluZyIsIk1hdGgiLCJtaW4iLCJhdGxhc2VzIiwiY2hhcnMiLCJkYXRhIiwiY3JlYXRlVGV4dHVyZXMiLCJ0ZXh0IiwiX2NoYXJzIiwiX25vcm1hbGl6ZUNoYXJzU2V0IiwibGVuZ3RoIiwiX3JlbmRlckF0bGFzIiwiaSIsInVwZGF0ZVRleHR1cmVzIiwibmV3Q2hhcnNTZXQiLCJjaGFyIiwicHVzaCIsImNvbmNhdCIsImZvckVhY2giLCJhdGxhcyIsIl9jb2xvclRvUmdiU3RyaW5nIiwic3RyIiwiciIsInJvdW5kIiwiZyIsImIiLCJhIiwicmVuZGVyQ2hhcmFjdGVyIiwiY29udGV4dCIsIngiLCJ5IiwiZmlsbFRleHQiLCJfZ2V0QXRsYXMiLCJpbmRleCIsImdyYXBoaWNzRGV2aWNlIiwiY2hhcnNBcnJheSIsInciLCJoIiwidHJhbnNwYXJlbnQiLCJURVhUX0FMSUdOIiwiVEVYVF9CQVNFTElORSIsImF0bGFzSW5kZXgiLCJfY3JlYXRlSnNvbiIsInN5bWJvbHMiLCJzdHJpbmciLCJnZXRTeW1ib2xzIiwiam9pbiIsIm1heEhlaWdodCIsIm1heERlc2NlbnQiLCJtZXRyaWNzIiwiY2giLCJfZ2V0VGV4dE1ldHJpY3MiLCJtYXgiLCJkZXNjZW50Iiwic3giLCJzeSIsIl94T2Zmc2V0IiwiX3lPZmZzZXQiLCJfeCIsIl95IiwiY29kZSIsImdldENvZGVQb2ludCIsImZzIiwiZm9udCIsInRvU3RyaW5nIiwidGV4dEFsaWduIiwidGV4dEJhc2VsaW5lIiwibWVhc3VyZVRleHQiLCJ4b2Zmc2V0IiwieW9mZnNldCIsInhhZHZhbmNlIiwiX2FkZENoYXIiLCJzcGxpY2UiLCJ1cGxvYWQiLCJmaXJlIiwiYmFzZSIsImpzb24iLCJjaGFyQ29kZSIsIm1hcE51bSIsIm1hcFciLCJtYXBIIiwiaW5mbyIsIm1hcHMiLCJzY2FsZSIsInVuaWNvZGVDb252ZXJ0ZXJGdW5jIiwic3lzdGVtcyIsImVsZW1lbnQiLCJnZXRVbmljb2RlQ29udmVydGVyIiwic2V0IiwiT2JqZWN0Iiwia2V5cyIsInNvcnQiLCJ0ZXh0U3BhbiIsImlkIiwiaW5uZXJIVE1MIiwiYmxvY2siLCJzdHlsZSIsImRpc3BsYXkiLCJkaXYiLCJhcHBlbmRDaGlsZCIsImJvZHkiLCJhc2NlbnQiLCJvZmZzZXRUb3AiLCJyZW1vdmVDaGlsZCIsInRleHR1cmVzIiwibWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFZQSxNQUFNQSxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDN0IsTUFBTUMsb0JBQW9CLEdBQUcsR0FBRyxDQUFBO0FBRWhDLE1BQU1DLEtBQUssQ0FBQztFQUNSQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFQyxJQUFJLEVBQUU7SUFDckMsSUFBSSxDQUFDQyxNQUFNLEdBQUdDLFFBQVEsQ0FBQ0MsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQzlDLElBQUEsSUFBSSxDQUFDRixNQUFNLENBQUNILEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBQ3pCLElBQUEsSUFBSSxDQUFDRyxNQUFNLENBQUNGLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBRTNCLElBQUEsSUFBSSxDQUFDSyxPQUFPLEdBQUcsSUFBSUMsT0FBTyxDQUFDUixNQUFNLEVBQUU7QUFDL0JHLE1BQUFBLElBQUksRUFBRUEsSUFBSTtBQUNWTSxNQUFBQSxNQUFNLEVBQUVDLGlCQUFpQjtBQUN6QlQsTUFBQUEsS0FBSyxFQUFFQSxLQUFLO0FBQ1pDLE1BQUFBLE1BQU0sRUFBRUEsTUFBTTtBQUNkUyxNQUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiQyxNQUFBQSxTQUFTLEVBQUVDLDJCQUEyQjtBQUN0Q0MsTUFBQUEsU0FBUyxFQUFFQyxhQUFh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
