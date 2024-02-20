import { GSplatData } from '../../scene/gsplat/gsplat-data.js';
import { GSplatResource } from './gsplat-resource.js';

const magicBytes = new Uint8Array([112, 108, 121, 10]); // ply\n
const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]); // \nend_header\n

const dataTypeMap = new Map([['char', Int8Array], ['uchar', Uint8Array], ['short', Int16Array], ['ushort', Uint16Array], ['int', Int32Array], ['uint', Uint32Array], ['float', Float32Array], ['double', Float64Array]]);

/**
 * @typedef {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array} DataType
 */

/**
 * @typedef {object} PlyProperty
 * @property {string} type - E.g. 'float'.
 * @property {string} name - E.g. 'x', 'y', 'z', 'f_dc_0' etc.
 * @property {DataType} storage - Data type, e.g. instance of Float32Array.
 * @property {number} byteSize - BYTES_PER_ELEMENT of given data type.
 */

/**
 * @typedef {object} PlyElement
 * @property {string} name - E.g. 'vertex'.
 * @property {number} count - Given count.
 * @property {PlyProperty[]} properties - The properties.
 */

/**
 * asynchronously read a ply file data
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader - The reader.
 * @param {Function|null} propertyFilter - Function to filter properties with.
 * @returns {Promise<PlyElement[]>} The ply file data.
 */
const readPly = async (reader, propertyFilter = null) => {
  const concat = (a, b) => {
    const c = new Uint8Array(a.byteLength + b.byteLength);
    c.set(a);
    c.set(b, a.byteLength);
    return c;
  };

  /**
   * Searches for the first occurrence of a sequence within a buffer.
   * @example
   * find(new Uint8Array([1, 2, 3, 4]), new Uint8Array([3, 4])); // 2
   * @param {Uint8Array} buf - The buffer in which to search.
   * @param {Uint8Array} search - The sequence to search for.
   * @returns {number} The index of the first occurrence of the search sequence in the buffer, or -1 if not found.
   */
  const find = (buf, search) => {
    const endIndex = buf.length - search.length;
    let i, j;
    for (i = 0; i <= endIndex; ++i) {
      for (j = 0; j < search.length; ++j) {
        if (buf[i + j] !== search[j]) {
          break;
        }
      }
      if (j === search.length) {
        return i;
      }
    }
    return -1;
  };

  /**
   * Checks if array 'a' starts with the same elements as array 'b'.
   * @example
   * startsWith(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2])); // true
   * @param {Uint8Array} a - The array to check against.
   * @param {Uint8Array} b - The array of elements to look for at the start of 'a'.
   * @returns {boolean} - True if 'a' starts with all elements of 'b', otherwise false.
   */
  const startsWith = (a, b) => {
    if (a.length < b.length) {
      return false;
    }
    for (let i = 0; i < b.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  };

  /** @type {Uint8Array|undefined} */
  let buf;
  /** @type {number} */
  let endHeaderIndex;
  while (true) {
    // get the next chunk
    /* eslint-disable no-await-in-loop */
    const {
      value,
      done
    } = await reader.read();
    if (done) {
      throw new Error('Stream finished before end of header');
    }

    // combine new chunk with the previous
    buf = buf ? concat(buf, value) : value;

    // check magic bytes
    if (buf.length >= magicBytes.length && !startsWith(buf, magicBytes)) {
      throw new Error('Invalid ply header');
    }

    // check if we can find the end-of-header marker
    endHeaderIndex = find(buf, endHeaderBytes);
    if (endHeaderIndex !== -1) {
      break;
    }
  }

  // decode buffer header text
  const headerText = new TextDecoder('ascii').decode(buf.slice(0, endHeaderIndex));

  // split into lines and remove comments
  const headerLines = headerText.split('\n').filter(line => !line.startsWith('comment '));

  // decode header and allocate data storage
  const elements = [];
  for (let i = 1; i < headerLines.length; ++i) {
    const words = headerLines[i].split(' ');
    switch (words[0]) {
      case 'format':
        if (words[1] !== 'binary_little_endian') {
          throw new Error('Unsupported ply format');
        }
        break;
      case 'element':
        elements.push({
          name: words[1],
          count: parseInt(words[2], 10),
          properties: []
        });
        break;
      case 'property':
        {
          if (!dataTypeMap.has(words[1])) {
            throw new Error(`Unrecognized property data type '${words[1]}' in ply header`);
          }
          const element = elements[elements.length - 1];
          const storageType = dataTypeMap.get(words[1]);
          const storage = !propertyFilter || propertyFilter(words[2]) ? new storageType(element.count) : null;
          element.properties.push({
            type: words[1],
            name: words[2],
            storage: storage,
            byteSize: storageType.BYTES_PER_ELEMENT
          });
          break;
        }
      default:
        throw new Error(`Unrecognized header value '${words[0]}' in ply header`);
    }
  }

  // read data
  let readIndex = endHeaderIndex + endHeaderBytes.length;
  let remaining = buf.length - readIndex;
  let dataView = new DataView(buf.buffer);
  for (let i = 0; i < elements.length; ++i) {
    const element = elements[i];
    for (let e = 0; e < element.count; ++e) {
      for (let j = 0; j < element.properties.length; ++j) {
        const property = element.properties[j];

        // if we've run out of data, load the next chunk
        while (remaining < property.byteSize) {
          const {
            value,
            done
          } = await reader.read();
          if (done) {
            throw new Error('Stream finished before end of data');
          }

          // create buffer with left-over data from previous chunk and the new data
          const tmp = new Uint8Array(remaining + value.byteLength);
          tmp.set(buf.slice(readIndex));
          tmp.set(value, remaining);
          buf = tmp;
          dataView = new DataView(buf.buffer);
          readIndex = 0;
          remaining = buf.length;
        }
        if (property.storage) {
          switch (property.type) {
            case 'char':
              property.storage[e] = dataView.getInt8(readIndex);
              break;
            case 'uchar':
              property.storage[e] = dataView.getUint8(readIndex);
              break;
            case 'short':
              property.storage[e] = dataView.getInt16(readIndex, true);
              break;
            case 'ushort':
              property.storage[e] = dataView.getUint16(readIndex, true);
              break;
            case 'int':
              property.storage[e] = dataView.getInt32(readIndex, true);
              break;
            case 'uint':
              property.storage[e] = dataView.getUint32(readIndex, true);
              break;
            case 'float':
              property.storage[e] = dataView.getFloat32(readIndex, true);
              break;
            case 'double':
              property.storage[e] = dataView.getFloat64(readIndex, true);
              break;
          }
        }
        readIndex += property.byteSize;
        remaining -= property.byteSize;
      }
    }
  }

  // console.log(elements);

  return elements;
};

// filter out element data we're not going to use
const defaultElements = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2',
// compressed format elements
'min_x', 'min_y', 'min_z', 'max_x', 'max_y', 'max_z', 'min_scale_x', 'min_scale_y', 'min_scale_z', 'max_scale_x', 'max_scale_y', 'max_scale_z', 'packed_position', 'packed_rotation', 'packed_scale', 'packed_color'];
const defaultElementsSet = new Set(defaultElements);
const defaultElementFilter = val => defaultElementsSet.has(val);
class PlyParser {
  /**
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
   * @param {number} maxRetries - Maximum amount of retries.
   */
  constructor(device, assets, maxRetries) {
    /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
    this.device = void 0;
    /** @type {import('../asset/asset-registry.js').AssetRegistry} */
    this.assets = void 0;
    /** @type {number} */
    this.maxRetries = void 0;
    this.device = device;
    this.assets = assets;
    this.maxRetries = maxRetries;
  }

  /**
   * @param {object} url - The URL of the resource to load.
   * @param {string} url.load - The URL to use for loading the resource.
   * @param {string} url.original - The original URL useful for identifying the resource type.
   * @param {import('../handlers/handler.js').ResourceHandlerCallback} callback - The callback used when
   * the resource is loaded or an error occurs.
   * @param {import('../asset/asset.js').Asset} asset - Container asset.
   */
  async load(url, callback, asset) {
    const response = await fetch(url.load);
    if (!response || !response.body) {
      callback("Error loading resource", null);
    } else {
      var _asset$data$elementFi;
      readPly(response.body.getReader(), (_asset$data$elementFi = asset.data.elementFilter) != null ? _asset$data$elementFi : defaultElementFilter).then(response => {
        callback(null, new GSplatResource(this.device, new GSplatData(response)));
      }).catch(err => {
        callback(err, null);
      });
    }
  }

  /**
   * @param {string} url - The URL.
   * @param {GSplatResource} data - The data.
   * @returns {GSplatResource} Return the data.
   */
  open(url, data) {
    return data;
  }
}

export { PlyParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGx5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvcGx5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEdTcGxhdERhdGEgfSBmcm9tICcuLi8uLi9zY2VuZS9nc3BsYXQvZ3NwbGF0LWRhdGEuanMnO1xuaW1wb3J0IHsgR1NwbGF0UmVzb3VyY2UgfSBmcm9tICcuL2dzcGxhdC1yZXNvdXJjZS5qcyc7XG5cbmNvbnN0IG1hZ2ljQnl0ZXMgPSBuZXcgVWludDhBcnJheShbMTEyLCAxMDgsIDEyMSwgMTBdKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGx5XFxuXG5jb25zdCBlbmRIZWFkZXJCeXRlcyA9IG5ldyBVaW50OEFycmF5KFsxMCwgMTAxLCAxMTAsIDEwMCwgOTUsIDEwNCwgMTAxLCA5NywgMTAwLCAxMDEsIDExNCwgMTBdKTsgICAgICAgIC8vIFxcbmVuZF9oZWFkZXJcXG5cblxuY29uc3QgZGF0YVR5cGVNYXAgPSBuZXcgTWFwKFtcbiAgICBbJ2NoYXInLCBJbnQ4QXJyYXldLFxuICAgIFsndWNoYXInLCBVaW50OEFycmF5XSxcbiAgICBbJ3Nob3J0JywgSW50MTZBcnJheV0sXG4gICAgWyd1c2hvcnQnLCBVaW50MTZBcnJheV0sXG4gICAgWydpbnQnLCBJbnQzMkFycmF5XSxcbiAgICBbJ3VpbnQnLCBVaW50MzJBcnJheV0sXG4gICAgWydmbG9hdCcsIEZsb2F0MzJBcnJheV0sXG4gICAgWydkb3VibGUnLCBGbG9hdDY0QXJyYXldXG5dKTtcblxuLyoqXG4gKiBAdHlwZWRlZiB7SW50OEFycmF5fFVpbnQ4QXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheXxGbG9hdDY0QXJyYXl9IERhdGFUeXBlXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7b2JqZWN0fSBQbHlQcm9wZXJ0eVxuICogQHByb3BlcnR5IHtzdHJpbmd9IHR5cGUgLSBFLmcuICdmbG9hdCcuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtIEUuZy4gJ3gnLCAneScsICd6JywgJ2ZfZGNfMCcgZXRjLlxuICogQHByb3BlcnR5IHtEYXRhVHlwZX0gc3RvcmFnZSAtIERhdGEgdHlwZSwgZS5nLiBpbnN0YW5jZSBvZiBGbG9hdDMyQXJyYXkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYnl0ZVNpemUgLSBCWVRFU19QRVJfRUxFTUVOVCBvZiBnaXZlbiBkYXRhIHR5cGUuXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7b2JqZWN0fSBQbHlFbGVtZW50XG4gKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtIEUuZy4gJ3ZlcnRleCcuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY291bnQgLSBHaXZlbiBjb3VudC5cbiAqIEBwcm9wZXJ0eSB7UGx5UHJvcGVydHlbXX0gcHJvcGVydGllcyAtIFRoZSBwcm9wZXJ0aWVzLlxuICovXG5cbi8qKlxuICogYXN5bmNocm9ub3VzbHkgcmVhZCBhIHBseSBmaWxlIGRhdGFcbiAqXG4gKiBAcGFyYW0ge1JlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlcjxVaW50OEFycmF5Pn0gcmVhZGVyIC0gVGhlIHJlYWRlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb258bnVsbH0gcHJvcGVydHlGaWx0ZXIgLSBGdW5jdGlvbiB0byBmaWx0ZXIgcHJvcGVydGllcyB3aXRoLlxuICogQHJldHVybnMge1Byb21pc2U8UGx5RWxlbWVudFtdPn0gVGhlIHBseSBmaWxlIGRhdGEuXG4gKi9cbmNvbnN0IHJlYWRQbHkgPSBhc3luYyAocmVhZGVyLCBwcm9wZXJ0eUZpbHRlciA9IG51bGwpID0+IHtcbiAgICBjb25zdCBjb25jYXQgPSAoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBjID0gbmV3IFVpbnQ4QXJyYXkoYS5ieXRlTGVuZ3RoICsgYi5ieXRlTGVuZ3RoKTtcbiAgICAgICAgYy5zZXQoYSk7XG4gICAgICAgIGMuc2V0KGIsIGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIHJldHVybiBjO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYSBzZXF1ZW5jZSB3aXRoaW4gYSBidWZmZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBmaW5kKG5ldyBVaW50OEFycmF5KFsxLCAyLCAzLCA0XSksIG5ldyBVaW50OEFycmF5KFszLCA0XSkpOyAvLyAyXG4gICAgICogQHBhcmFtIHtVaW50OEFycmF5fSBidWYgLSBUaGUgYnVmZmVyIGluIHdoaWNoIHRvIHNlYXJjaC5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IHNlYXJjaCAtIFRoZSBzZXF1ZW5jZSB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiB0aGUgc2VhcmNoIHNlcXVlbmNlIGluIHRoZSBidWZmZXIsIG9yIC0xIGlmIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBjb25zdCBmaW5kID0gKGJ1Ziwgc2VhcmNoKSA9PiB7XG4gICAgICAgIGNvbnN0IGVuZEluZGV4ID0gYnVmLmxlbmd0aCAtIHNlYXJjaC5sZW5ndGg7XG4gICAgICAgIGxldCBpLCBqO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDw9IGVuZEluZGV4OyArK2kpIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBzZWFyY2gubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmW2kgKyBqXSAhPT0gc2VhcmNoW2pdKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChqID09PSBzZWFyY2gubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYXJyYXkgJ2EnIHN0YXJ0cyB3aXRoIHRoZSBzYW1lIGVsZW1lbnRzIGFzIGFycmF5ICdiJy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHN0YXJ0c1dpdGgobmV3IFVpbnQ4QXJyYXkoWzEsIDIsIDMsIDRdKSwgbmV3IFVpbnQ4QXJyYXkoWzEsIDJdKSk7IC8vIHRydWVcbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGEgLSBUaGUgYXJyYXkgdG8gY2hlY2sgYWdhaW5zdC5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGIgLSBUaGUgYXJyYXkgb2YgZWxlbWVudHMgdG8gbG9vayBmb3IgYXQgdGhlIHN0YXJ0IG9mICdhJy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUcnVlIGlmICdhJyBzdGFydHMgd2l0aCBhbGwgZWxlbWVudHMgb2YgJ2InLCBvdGhlcndpc2UgZmFsc2UuXG4gICAgICovXG4gICAgY29uc3Qgc3RhcnRzV2l0aCA9IChhLCBiKSA9PiB7XG4gICAgICAgIGlmIChhLmxlbmd0aCA8IGIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIC8qKiBAdHlwZSB7VWludDhBcnJheXx1bmRlZmluZWR9ICovXG4gICAgbGV0IGJ1ZjtcbiAgICAvKiogQHR5cGUge251bWJlcn0gKi9cbiAgICBsZXQgZW5kSGVhZGVySW5kZXg7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAvLyBnZXQgdGhlIG5leHQgY2h1bmtcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tYXdhaXQtaW4tbG9vcCAqL1xuICAgICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuXG4gICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0cmVhbSBmaW5pc2hlZCBiZWZvcmUgZW5kIG9mIGhlYWRlcicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29tYmluZSBuZXcgY2h1bmsgd2l0aCB0aGUgcHJldmlvdXNcbiAgICAgICAgYnVmID0gYnVmID8gY29uY2F0KGJ1ZiwgdmFsdWUpIDogdmFsdWU7XG5cbiAgICAgICAgLy8gY2hlY2sgbWFnaWMgYnl0ZXNcbiAgICAgICAgaWYgKGJ1Zi5sZW5ndGggPj0gbWFnaWNCeXRlcy5sZW5ndGggJiYgIXN0YXJ0c1dpdGgoYnVmLCBtYWdpY0J5dGVzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBseSBoZWFkZXInKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIHdlIGNhbiBmaW5kIHRoZSBlbmQtb2YtaGVhZGVyIG1hcmtlclxuICAgICAgICBlbmRIZWFkZXJJbmRleCA9IGZpbmQoYnVmLCBlbmRIZWFkZXJCeXRlcyk7XG5cbiAgICAgICAgaWYgKGVuZEhlYWRlckluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkZWNvZGUgYnVmZmVyIGhlYWRlciB0ZXh0XG4gICAgY29uc3QgaGVhZGVyVGV4dCA9IG5ldyBUZXh0RGVjb2RlcignYXNjaWknKS5kZWNvZGUoYnVmLnNsaWNlKDAsIGVuZEhlYWRlckluZGV4KSk7XG5cbiAgICAvLyBzcGxpdCBpbnRvIGxpbmVzIGFuZCByZW1vdmUgY29tbWVudHNcbiAgICBjb25zdCBoZWFkZXJMaW5lcyA9IGhlYWRlclRleHQuc3BsaXQoJ1xcbicpXG4gICAgICAgIC5maWx0ZXIobGluZSA9PiAhbGluZS5zdGFydHNXaXRoKCdjb21tZW50ICcpKTtcblxuICAgIC8vIGRlY29kZSBoZWFkZXIgYW5kIGFsbG9jYXRlIGRhdGEgc3RvcmFnZVxuICAgIGNvbnN0IGVsZW1lbnRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBoZWFkZXJMaW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCB3b3JkcyA9IGhlYWRlckxpbmVzW2ldLnNwbGl0KCcgJyk7XG5cbiAgICAgICAgc3dpdGNoICh3b3Jkc1swXSkge1xuICAgICAgICAgICAgY2FzZSAnZm9ybWF0JzpcbiAgICAgICAgICAgICAgICBpZiAod29yZHNbMV0gIT09ICdiaW5hcnlfbGl0dGxlX2VuZGlhbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBwbHkgZm9ybWF0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZWxlbWVudCc6XG4gICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHdvcmRzWzFdLFxuICAgICAgICAgICAgICAgICAgICBjb3VudDogcGFyc2VJbnQod29yZHNbMl0sIDEwKSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogW11cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3Byb3BlcnR5Jzoge1xuICAgICAgICAgICAgICAgIGlmICghZGF0YVR5cGVNYXAuaGFzKHdvcmRzWzFdKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwcm9wZXJ0eSBkYXRhIHR5cGUgJyR7d29yZHNbMV19JyBpbiBwbHkgaGVhZGVyYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tlbGVtZW50cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yYWdlVHlwZSA9IGRhdGFUeXBlTWFwLmdldCh3b3Jkc1sxXSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmFnZSA9ICghcHJvcGVydHlGaWx0ZXIgfHwgcHJvcGVydHlGaWx0ZXIod29yZHNbMl0pKSA/IG5ldyBzdG9yYWdlVHlwZShlbGVtZW50LmNvdW50KSA6IG51bGw7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5wcm9wZXJ0aWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB3b3Jkc1sxXSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogd29yZHNbMl0sXG4gICAgICAgICAgICAgICAgICAgIHN0b3JhZ2U6IHN0b3JhZ2UsXG4gICAgICAgICAgICAgICAgICAgIGJ5dGVTaXplOiBzdG9yYWdlVHlwZS5CWVRFU19QRVJfRUxFTUVOVFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBoZWFkZXIgdmFsdWUgJyR7d29yZHNbMF19JyBpbiBwbHkgaGVhZGVyYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZWFkIGRhdGFcbiAgICBsZXQgcmVhZEluZGV4ID0gZW5kSGVhZGVySW5kZXggKyBlbmRIZWFkZXJCeXRlcy5sZW5ndGg7XG4gICAgbGV0IHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSByZWFkSW5kZXg7XG4gICAgbGV0IGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KGJ1Zi5idWZmZXIpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gZWxlbWVudHNbaV07XG5cbiAgICAgICAgZm9yIChsZXQgZSA9IDA7IGUgPCBlbGVtZW50LmNvdW50OyArK2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZWxlbWVudC5wcm9wZXJ0aWVzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBlbGVtZW50LnByb3BlcnRpZXNbal07XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB3ZSd2ZSBydW4gb3V0IG9mIGRhdGEsIGxvYWQgdGhlIG5leHQgY2h1bmtcbiAgICAgICAgICAgICAgICB3aGlsZSAocmVtYWluaW5nIDwgcHJvcGVydHkuYnl0ZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyB2YWx1ZSwgZG9uZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdHJlYW0gZmluaXNoZWQgYmVmb3JlIGVuZCBvZiBkYXRhJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYnVmZmVyIHdpdGggbGVmdC1vdmVyIGRhdGEgZnJvbSBwcmV2aW91cyBjaHVuayBhbmQgdGhlIG5ldyBkYXRhXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRtcCA9IG5ldyBVaW50OEFycmF5KHJlbWFpbmluZyArIHZhbHVlLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGJ1Zi5zbGljZShyZWFkSW5kZXgpKTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldCh2YWx1ZSwgcmVtYWluaW5nKTtcblxuICAgICAgICAgICAgICAgICAgICBidWYgPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KGJ1Zi5idWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICByZWFkSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICByZW1haW5pbmcgPSBidWYubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eS5zdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAocHJvcGVydHkudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnY2hhcic6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkuc3RvcmFnZVtlXSA9IGRhdGFWaWV3LmdldEludDgocmVhZEluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3VjaGFyJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdG9yYWdlW2VdID0gZGF0YVZpZXcuZ2V0VWludDgocmVhZEluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3Nob3J0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdG9yYWdlW2VdID0gZGF0YVZpZXcuZ2V0SW50MTYocmVhZEluZGV4LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3VzaG9ydCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkuc3RvcmFnZVtlXSA9IGRhdGFWaWV3LmdldFVpbnQxNihyZWFkSW5kZXgsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW50JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdG9yYWdlW2VdID0gZGF0YVZpZXcuZ2V0SW50MzIocmVhZEluZGV4LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3VpbnQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5LnN0b3JhZ2VbZV0gPSBkYXRhVmlldy5nZXRVaW50MzIocmVhZEluZGV4LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdG9yYWdlW2VdID0gZGF0YVZpZXcuZ2V0RmxvYXQzMihyZWFkSW5kZXgsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnZG91YmxlJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdG9yYWdlW2VdID0gZGF0YVZpZXcuZ2V0RmxvYXQ2NChyZWFkSW5kZXgsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVhZEluZGV4ICs9IHByb3BlcnR5LmJ5dGVTaXplO1xuICAgICAgICAgICAgICAgIHJlbWFpbmluZyAtPSBwcm9wZXJ0eS5ieXRlU2l6ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbnNvbGUubG9nKGVsZW1lbnRzKTtcblxuICAgIHJldHVybiBlbGVtZW50cztcbn07XG5cbi8vIGZpbHRlciBvdXQgZWxlbWVudCBkYXRhIHdlJ3JlIG5vdCBnb2luZyB0byB1c2VcbmNvbnN0IGRlZmF1bHRFbGVtZW50cyA9IFtcbiAgICAneCcsICd5JywgJ3onLFxuICAgICdmX2RjXzAnLCAnZl9kY18xJywgJ2ZfZGNfMicsICdvcGFjaXR5JyxcbiAgICAncm90XzAnLCAncm90XzEnLCAncm90XzInLCAncm90XzMnLFxuICAgICdzY2FsZV8wJywgJ3NjYWxlXzEnLCAnc2NhbGVfMicsXG4gICAgLy8gY29tcHJlc3NlZCBmb3JtYXQgZWxlbWVudHNcbiAgICAnbWluX3gnLCAnbWluX3knLCAnbWluX3onLFxuICAgICdtYXhfeCcsICdtYXhfeScsICdtYXhfeicsXG4gICAgJ21pbl9zY2FsZV94JywgJ21pbl9zY2FsZV95JywgJ21pbl9zY2FsZV96JyxcbiAgICAnbWF4X3NjYWxlX3gnLCAnbWF4X3NjYWxlX3knLCAnbWF4X3NjYWxlX3onLFxuICAgICdwYWNrZWRfcG9zaXRpb24nLCAncGFja2VkX3JvdGF0aW9uJywgJ3BhY2tlZF9zY2FsZScsICdwYWNrZWRfY29sb3InXG5dO1xuXG5jb25zdCBkZWZhdWx0RWxlbWVudHNTZXQgPSBuZXcgU2V0KGRlZmF1bHRFbGVtZW50cyk7XG5jb25zdCBkZWZhdWx0RWxlbWVudEZpbHRlciA9IHZhbCA9PiBkZWZhdWx0RWxlbWVudHNTZXQuaGFzKHZhbCk7XG5cbmNsYXNzIFBseVBhcnNlciB7XG4gICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSAqL1xuICAgIGRldmljZTtcblxuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl9ICovXG4gICAgYXNzZXRzO1xuXG4gICAgLyoqIEB0eXBlIHtudW1iZXJ9ICovXG4gICAgbWF4UmV0cmllcztcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBUaGUgYXNzZXQgcmVnaXN0cnkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heFJldHJpZXMgLSBNYXhpbXVtIGFtb3VudCBvZiByZXRyaWVzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgYXNzZXRzLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IGFzc2V0cztcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gbWF4UmV0cmllcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gdXJsIC0gVGhlIFVSTCBvZiB0aGUgcmVzb3VyY2UgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsLmxvYWQgLSBUaGUgVVJMIHRvIHVzZSBmb3IgbG9hZGluZyB0aGUgcmVzb3VyY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybC5vcmlnaW5hbCAtIFRoZSBvcmlnaW5hbCBVUkwgdXNlZnVsIGZvciBpZGVudGlmeWluZyB0aGUgcmVzb3VyY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vaGFuZGxlcnMvaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlckNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW5cbiAgICAgKiB0aGUgcmVzb3VyY2UgaXMgbG9hZGVkIG9yIGFuIGVycm9yIG9jY3Vycy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gYXNzZXQgLSBDb250YWluZXIgYXNzZXQuXG4gICAgICovXG4gICAgYXN5bmMgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybC5sb2FkKTtcbiAgICAgICAgaWYgKCFyZXNwb25zZSB8fCAhcmVzcG9uc2UuYm9keSkge1xuICAgICAgICAgICAgY2FsbGJhY2soXCJFcnJvciBsb2FkaW5nIHJlc291cmNlXCIsIG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVhZFBseShyZXNwb25zZS5ib2R5LmdldFJlYWRlcigpLCBhc3NldC5kYXRhLmVsZW1lbnRGaWx0ZXIgPz8gZGVmYXVsdEVsZW1lbnRGaWx0ZXIpXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG5ldyBHU3BsYXRSZXNvdXJjZSh0aGlzLmRldmljZSwgbmV3IEdTcGxhdERhdGEocmVzcG9uc2UpKSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwuXG4gICAgICogQHBhcmFtIHtHU3BsYXRSZXNvdXJjZX0gZGF0YSAtIFRoZSBkYXRhLlxuICAgICAqIEByZXR1cm5zIHtHU3BsYXRSZXNvdXJjZX0gUmV0dXJuIHRoZSBkYXRhLlxuICAgICAqL1xuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUGx5UGFyc2VyIH07XG4iXSwibmFtZXMiOlsibWFnaWNCeXRlcyIsIlVpbnQ4QXJyYXkiLCJlbmRIZWFkZXJCeXRlcyIsImRhdGFUeXBlTWFwIiwiTWFwIiwiSW50OEFycmF5IiwiSW50MTZBcnJheSIsIlVpbnQxNkFycmF5IiwiSW50MzJBcnJheSIsIlVpbnQzMkFycmF5IiwiRmxvYXQzMkFycmF5IiwiRmxvYXQ2NEFycmF5IiwicmVhZFBseSIsInJlYWRlciIsInByb3BlcnR5RmlsdGVyIiwiY29uY2F0IiwiYSIsImIiLCJjIiwiYnl0ZUxlbmd0aCIsInNldCIsImZpbmQiLCJidWYiLCJzZWFyY2giLCJlbmRJbmRleCIsImxlbmd0aCIsImkiLCJqIiwic3RhcnRzV2l0aCIsImVuZEhlYWRlckluZGV4IiwidmFsdWUiLCJkb25lIiwicmVhZCIsIkVycm9yIiwiaGVhZGVyVGV4dCIsIlRleHREZWNvZGVyIiwiZGVjb2RlIiwic2xpY2UiLCJoZWFkZXJMaW5lcyIsInNwbGl0IiwiZmlsdGVyIiwibGluZSIsImVsZW1lbnRzIiwid29yZHMiLCJwdXNoIiwibmFtZSIsImNvdW50IiwicGFyc2VJbnQiLCJwcm9wZXJ0aWVzIiwiaGFzIiwiZWxlbWVudCIsInN0b3JhZ2VUeXBlIiwiZ2V0Iiwic3RvcmFnZSIsInR5cGUiLCJieXRlU2l6ZSIsIkJZVEVTX1BFUl9FTEVNRU5UIiwicmVhZEluZGV4IiwicmVtYWluaW5nIiwiZGF0YVZpZXciLCJEYXRhVmlldyIsImJ1ZmZlciIsImUiLCJwcm9wZXJ0eSIsInRtcCIsImdldEludDgiLCJnZXRVaW50OCIsImdldEludDE2IiwiZ2V0VWludDE2IiwiZ2V0SW50MzIiLCJnZXRVaW50MzIiLCJnZXRGbG9hdDMyIiwiZ2V0RmxvYXQ2NCIsImRlZmF1bHRFbGVtZW50cyIsImRlZmF1bHRFbGVtZW50c1NldCIsIlNldCIsImRlZmF1bHRFbGVtZW50RmlsdGVyIiwidmFsIiwiUGx5UGFyc2VyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJhc3NldHMiLCJtYXhSZXRyaWVzIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJyZXNwb25zZSIsImZldGNoIiwiYm9keSIsIl9hc3NldCRkYXRhJGVsZW1lbnRGaSIsImdldFJlYWRlciIsImRhdGEiLCJlbGVtZW50RmlsdGVyIiwidGhlbiIsIkdTcGxhdFJlc291cmNlIiwiR1NwbGF0RGF0YSIsImNhdGNoIiwiZXJyIiwib3BlbiJdLCJtYXBwaW5ncyI6Ijs7O0FBR0EsTUFBTUEsVUFBVSxHQUFHLElBQUlDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsTUFBTUMsY0FBYyxHQUFHLElBQUlELFVBQVUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzs7QUFFaEcsTUFBTUUsV0FBVyxHQUFHLElBQUlDLEdBQUcsQ0FBQyxDQUN4QixDQUFDLE1BQU0sRUFBRUMsU0FBUyxDQUFDLEVBQ25CLENBQUMsT0FBTyxFQUFFSixVQUFVLENBQUMsRUFDckIsQ0FBQyxPQUFPLEVBQUVLLFVBQVUsQ0FBQyxFQUNyQixDQUFDLFFBQVEsRUFBRUMsV0FBVyxDQUFDLEVBQ3ZCLENBQUMsS0FBSyxFQUFFQyxVQUFVLENBQUMsRUFDbkIsQ0FBQyxNQUFNLEVBQUVDLFdBQVcsQ0FBQyxFQUNyQixDQUFDLE9BQU8sRUFBRUMsWUFBWSxDQUFDLEVBQ3ZCLENBQUMsUUFBUSxFQUFFQyxZQUFZLENBQUMsQ0FDM0IsQ0FBQyxDQUFBOztBQUVGO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxPQUFPLEdBQUcsT0FBT0MsTUFBTSxFQUFFQyxjQUFjLEdBQUcsSUFBSSxLQUFLO0FBQ3JELEVBQUEsTUFBTUMsTUFBTSxHQUFHQSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsS0FBSztBQUNyQixJQUFBLE1BQU1DLENBQUMsR0FBRyxJQUFJakIsVUFBVSxDQUFDZSxDQUFDLENBQUNHLFVBQVUsR0FBR0YsQ0FBQyxDQUFDRSxVQUFVLENBQUMsQ0FBQTtBQUNyREQsSUFBQUEsQ0FBQyxDQUFDRSxHQUFHLENBQUNKLENBQUMsQ0FBQyxDQUFBO0lBQ1JFLENBQUMsQ0FBQ0UsR0FBRyxDQUFDSCxDQUFDLEVBQUVELENBQUMsQ0FBQ0csVUFBVSxDQUFDLENBQUE7QUFDdEIsSUFBQSxPQUFPRCxDQUFDLENBQUE7R0FDWCxDQUFBOztBQUVEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSSxFQUFBLE1BQU1HLElBQUksR0FBR0EsQ0FBQ0MsR0FBRyxFQUFFQyxNQUFNLEtBQUs7SUFDMUIsTUFBTUMsUUFBUSxHQUFHRixHQUFHLENBQUNHLE1BQU0sR0FBR0YsTUFBTSxDQUFDRSxNQUFNLENBQUE7SUFDM0MsSUFBSUMsQ0FBQyxFQUFFQyxDQUFDLENBQUE7SUFDUixLQUFLRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLElBQUlGLFFBQVEsRUFBRSxFQUFFRSxDQUFDLEVBQUU7QUFDNUIsTUFBQSxLQUFLQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdKLE1BQU0sQ0FBQ0UsTUFBTSxFQUFFLEVBQUVFLENBQUMsRUFBRTtRQUNoQyxJQUFJTCxHQUFHLENBQUNJLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sQ0FBQ0ksQ0FBQyxDQUFDLEVBQUU7QUFDMUIsVUFBQSxNQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDQSxNQUFBLElBQUlBLENBQUMsS0FBS0osTUFBTSxDQUFDRSxNQUFNLEVBQUU7QUFDckIsUUFBQSxPQUFPQyxDQUFDLENBQUE7QUFDWixPQUFBO0FBQ0osS0FBQTtBQUNBLElBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQTtHQUNaLENBQUE7O0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsTUFBTUUsVUFBVSxHQUFHQSxDQUFDWixDQUFDLEVBQUVDLENBQUMsS0FBSztBQUN6QixJQUFBLElBQUlELENBQUMsQ0FBQ1MsTUFBTSxHQUFHUixDQUFDLENBQUNRLE1BQU0sRUFBRTtBQUNyQixNQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLEtBQUE7QUFFQSxJQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHVCxDQUFDLENBQUNRLE1BQU0sRUFBRSxFQUFFQyxDQUFDLEVBQUU7TUFDL0IsSUFBSVYsQ0FBQyxDQUFDVSxDQUFDLENBQUMsS0FBS1QsQ0FBQyxDQUFDUyxDQUFDLENBQUMsRUFBRTtBQUNmLFFBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0dBQ2QsQ0FBQTs7QUFFRDtBQUNBLEVBQUEsSUFBSUosR0FBRyxDQUFBO0FBQ1A7QUFDQSxFQUFBLElBQUlPLGNBQWMsQ0FBQTtBQUVsQixFQUFBLE9BQU8sSUFBSSxFQUFFO0FBQ1Q7QUFDQTtJQUNBLE1BQU07TUFBRUMsS0FBSztBQUFFQyxNQUFBQSxJQUFBQTtBQUFLLEtBQUMsR0FBRyxNQUFNbEIsTUFBTSxDQUFDbUIsSUFBSSxFQUFFLENBQUE7QUFFM0MsSUFBQSxJQUFJRCxJQUFJLEVBQUU7QUFDTixNQUFBLE1BQU0sSUFBSUUsS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUE7QUFDM0QsS0FBQTs7QUFFQTtJQUNBWCxHQUFHLEdBQUdBLEdBQUcsR0FBR1AsTUFBTSxDQUFDTyxHQUFHLEVBQUVRLEtBQUssQ0FBQyxHQUFHQSxLQUFLLENBQUE7O0FBRXRDO0FBQ0EsSUFBQSxJQUFJUixHQUFHLENBQUNHLE1BQU0sSUFBSXpCLFVBQVUsQ0FBQ3lCLE1BQU0sSUFBSSxDQUFDRyxVQUFVLENBQUNOLEdBQUcsRUFBRXRCLFVBQVUsQ0FBQyxFQUFFO0FBQ2pFLE1BQUEsTUFBTSxJQUFJaUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUE7QUFDekMsS0FBQTs7QUFFQTtBQUNBSixJQUFBQSxjQUFjLEdBQUdSLElBQUksQ0FBQ0MsR0FBRyxFQUFFcEIsY0FBYyxDQUFDLENBQUE7QUFFMUMsSUFBQSxJQUFJMkIsY0FBYyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ3ZCLE1BQUEsTUFBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0EsRUFBQSxNQUFNSyxVQUFVLEdBQUcsSUFBSUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDQyxNQUFNLENBQUNkLEdBQUcsQ0FBQ2UsS0FBSyxDQUFDLENBQUMsRUFBRVIsY0FBYyxDQUFDLENBQUMsQ0FBQTs7QUFFaEY7RUFDQSxNQUFNUyxXQUFXLEdBQUdKLFVBQVUsQ0FBQ0ssS0FBSyxDQUFDLElBQUksQ0FBQyxDQUNyQ0MsTUFBTSxDQUFDQyxJQUFJLElBQUksQ0FBQ0EsSUFBSSxDQUFDYixVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQTs7QUFFakQ7RUFDQSxNQUFNYyxRQUFRLEdBQUcsRUFBRSxDQUFBO0FBQ25CLEVBQUEsS0FBSyxJQUFJaEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHWSxXQUFXLENBQUNiLE1BQU0sRUFBRSxFQUFFQyxDQUFDLEVBQUU7SUFDekMsTUFBTWlCLEtBQUssR0FBR0wsV0FBVyxDQUFDWixDQUFDLENBQUMsQ0FBQ2EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBRXZDLFFBQVFJLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDWixNQUFBLEtBQUssUUFBUTtBQUNULFFBQUEsSUFBSUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLHNCQUFzQixFQUFFO0FBQ3JDLFVBQUEsTUFBTSxJQUFJVixLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQTtBQUM3QyxTQUFBO0FBQ0EsUUFBQSxNQUFBO0FBQ0osTUFBQSxLQUFLLFNBQVM7UUFDVlMsUUFBUSxDQUFDRSxJQUFJLENBQUM7QUFDVkMsVUFBQUEsSUFBSSxFQUFFRixLQUFLLENBQUMsQ0FBQyxDQUFDO1VBQ2RHLEtBQUssRUFBRUMsUUFBUSxDQUFDSixLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQzdCSyxVQUFBQSxVQUFVLEVBQUUsRUFBQTtBQUNoQixTQUFDLENBQUMsQ0FBQTtBQUNGLFFBQUEsTUFBQTtBQUNKLE1BQUEsS0FBSyxVQUFVO0FBQUUsUUFBQTtVQUNiLElBQUksQ0FBQzdDLFdBQVcsQ0FBQzhDLEdBQUcsQ0FBQ04sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDNUIsTUFBTSxJQUFJVixLQUFLLENBQUUsQ0FBQSxpQ0FBQSxFQUFtQ1UsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFBLGVBQUEsQ0FBZ0IsQ0FBQyxDQUFBO0FBQ2xGLFdBQUE7VUFDQSxNQUFNTyxPQUFPLEdBQUdSLFFBQVEsQ0FBQ0EsUUFBUSxDQUFDakIsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO1VBQzdDLE1BQU0wQixXQUFXLEdBQUdoRCxXQUFXLENBQUNpRCxHQUFHLENBQUNULEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1VBQzdDLE1BQU1VLE9BQU8sR0FBSSxDQUFDdkMsY0FBYyxJQUFJQSxjQUFjLENBQUM2QixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBSSxJQUFJUSxXQUFXLENBQUNELE9BQU8sQ0FBQ0osS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3JHSSxVQUFBQSxPQUFPLENBQUNGLFVBQVUsQ0FBQ0osSUFBSSxDQUFDO0FBQ3BCVSxZQUFBQSxJQUFJLEVBQUVYLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDZEUsWUFBQUEsSUFBSSxFQUFFRixLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2RVLFlBQUFBLE9BQU8sRUFBRUEsT0FBTztZQUNoQkUsUUFBUSxFQUFFSixXQUFXLENBQUNLLGlCQUFBQTtBQUMxQixXQUFDLENBQUMsQ0FBQTtBQUNGLFVBQUEsTUFBQTtBQUNKLFNBQUE7QUFDQSxNQUFBO1FBQ0ksTUFBTSxJQUFJdkIsS0FBSyxDQUFFLENBQUEsMkJBQUEsRUFBNkJVLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQSxlQUFBLENBQWdCLENBQUMsQ0FBQTtBQUNoRixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBLEVBQUEsSUFBSWMsU0FBUyxHQUFHNUIsY0FBYyxHQUFHM0IsY0FBYyxDQUFDdUIsTUFBTSxDQUFBO0FBQ3RELEVBQUEsSUFBSWlDLFNBQVMsR0FBR3BDLEdBQUcsQ0FBQ0csTUFBTSxHQUFHZ0MsU0FBUyxDQUFBO0VBQ3RDLElBQUlFLFFBQVEsR0FBRyxJQUFJQyxRQUFRLENBQUN0QyxHQUFHLENBQUN1QyxNQUFNLENBQUMsQ0FBQTtBQUV2QyxFQUFBLEtBQUssSUFBSW5DLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2dCLFFBQVEsQ0FBQ2pCLE1BQU0sRUFBRSxFQUFFQyxDQUFDLEVBQUU7QUFDdEMsSUFBQSxNQUFNd0IsT0FBTyxHQUFHUixRQUFRLENBQUNoQixDQUFDLENBQUMsQ0FBQTtBQUUzQixJQUFBLEtBQUssSUFBSW9DLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1osT0FBTyxDQUFDSixLQUFLLEVBQUUsRUFBRWdCLENBQUMsRUFBRTtBQUNwQyxNQUFBLEtBQUssSUFBSW5DLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3VCLE9BQU8sQ0FBQ0YsVUFBVSxDQUFDdkIsTUFBTSxFQUFFLEVBQUVFLENBQUMsRUFBRTtBQUNoRCxRQUFBLE1BQU1vQyxRQUFRLEdBQUdiLE9BQU8sQ0FBQ0YsVUFBVSxDQUFDckIsQ0FBQyxDQUFDLENBQUE7O0FBRXRDO0FBQ0EsUUFBQSxPQUFPK0IsU0FBUyxHQUFHSyxRQUFRLENBQUNSLFFBQVEsRUFBRTtVQUNsQyxNQUFNO1lBQUV6QixLQUFLO0FBQUVDLFlBQUFBLElBQUFBO0FBQUssV0FBQyxHQUFHLE1BQU1sQixNQUFNLENBQUNtQixJQUFJLEVBQUUsQ0FBQTtBQUUzQyxVQUFBLElBQUlELElBQUksRUFBRTtBQUNOLFlBQUEsTUFBTSxJQUFJRSxLQUFLLENBQUMsb0NBQW9DLENBQUMsQ0FBQTtBQUN6RCxXQUFBOztBQUVBO1VBQ0EsTUFBTStCLEdBQUcsR0FBRyxJQUFJL0QsVUFBVSxDQUFDeUQsU0FBUyxHQUFHNUIsS0FBSyxDQUFDWCxVQUFVLENBQUMsQ0FBQTtVQUN4RDZDLEdBQUcsQ0FBQzVDLEdBQUcsQ0FBQ0UsR0FBRyxDQUFDZSxLQUFLLENBQUNvQixTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQzdCTyxVQUFBQSxHQUFHLENBQUM1QyxHQUFHLENBQUNVLEtBQUssRUFBRTRCLFNBQVMsQ0FBQyxDQUFBO0FBRXpCcEMsVUFBQUEsR0FBRyxHQUFHMEMsR0FBRyxDQUFBO0FBQ1RMLFVBQUFBLFFBQVEsR0FBRyxJQUFJQyxRQUFRLENBQUN0QyxHQUFHLENBQUN1QyxNQUFNLENBQUMsQ0FBQTtBQUNuQ0osVUFBQUEsU0FBUyxHQUFHLENBQUMsQ0FBQTtVQUNiQyxTQUFTLEdBQUdwQyxHQUFHLENBQUNHLE1BQU0sQ0FBQTtBQUMxQixTQUFBO1FBRUEsSUFBSXNDLFFBQVEsQ0FBQ1YsT0FBTyxFQUFFO1VBQ2xCLFFBQVFVLFFBQVEsQ0FBQ1QsSUFBSTtBQUNqQixZQUFBLEtBQUssTUFBTTtjQUNQUyxRQUFRLENBQUNWLE9BQU8sQ0FBQ1MsQ0FBQyxDQUFDLEdBQUdILFFBQVEsQ0FBQ00sT0FBTyxDQUFDUixTQUFTLENBQUMsQ0FBQTtBQUNqRCxjQUFBLE1BQUE7QUFDSixZQUFBLEtBQUssT0FBTztjQUNSTSxRQUFRLENBQUNWLE9BQU8sQ0FBQ1MsQ0FBQyxDQUFDLEdBQUdILFFBQVEsQ0FBQ08sUUFBUSxDQUFDVCxTQUFTLENBQUMsQ0FBQTtBQUNsRCxjQUFBLE1BQUE7QUFDSixZQUFBLEtBQUssT0FBTztBQUNSTSxjQUFBQSxRQUFRLENBQUNWLE9BQU8sQ0FBQ1MsQ0FBQyxDQUFDLEdBQUdILFFBQVEsQ0FBQ1EsUUFBUSxDQUFDVixTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDeEQsY0FBQSxNQUFBO0FBQ0osWUFBQSxLQUFLLFFBQVE7QUFDVE0sY0FBQUEsUUFBUSxDQUFDVixPQUFPLENBQUNTLENBQUMsQ0FBQyxHQUFHSCxRQUFRLENBQUNTLFNBQVMsQ0FBQ1gsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3pELGNBQUEsTUFBQTtBQUNKLFlBQUEsS0FBSyxLQUFLO0FBQ05NLGNBQUFBLFFBQVEsQ0FBQ1YsT0FBTyxDQUFDUyxDQUFDLENBQUMsR0FBR0gsUUFBUSxDQUFDVSxRQUFRLENBQUNaLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN4RCxjQUFBLE1BQUE7QUFDSixZQUFBLEtBQUssTUFBTTtBQUNQTSxjQUFBQSxRQUFRLENBQUNWLE9BQU8sQ0FBQ1MsQ0FBQyxDQUFDLEdBQUdILFFBQVEsQ0FBQ1csU0FBUyxDQUFDYixTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDekQsY0FBQSxNQUFBO0FBQ0osWUFBQSxLQUFLLE9BQU87QUFDUk0sY0FBQUEsUUFBUSxDQUFDVixPQUFPLENBQUNTLENBQUMsQ0FBQyxHQUFHSCxRQUFRLENBQUNZLFVBQVUsQ0FBQ2QsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQzFELGNBQUEsTUFBQTtBQUNKLFlBQUEsS0FBSyxRQUFRO0FBQ1RNLGNBQUFBLFFBQVEsQ0FBQ1YsT0FBTyxDQUFDUyxDQUFDLENBQUMsR0FBR0gsUUFBUSxDQUFDYSxVQUFVLENBQUNmLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMxRCxjQUFBLE1BQUE7QUFDUixXQUFBO0FBQ0osU0FBQTtRQUVBQSxTQUFTLElBQUlNLFFBQVEsQ0FBQ1IsUUFBUSxDQUFBO1FBQzlCRyxTQUFTLElBQUlLLFFBQVEsQ0FBQ1IsUUFBUSxDQUFBO0FBQ2xDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTs7QUFFQSxFQUFBLE9BQU9iLFFBQVEsQ0FBQTtBQUNuQixDQUFDLENBQUE7O0FBRUQ7QUFDQSxNQUFNK0IsZUFBZSxHQUFHLENBQ3BCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUNiLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFDdkMsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUNsQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVM7QUFDL0I7QUFDQSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFDekIsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQ3pCLGFBQWEsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUMzQyxhQUFhLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFDM0MsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FDdkUsQ0FBQTtBQUVELE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLEdBQUcsQ0FBQ0YsZUFBZSxDQUFDLENBQUE7QUFDbkQsTUFBTUcsb0JBQW9CLEdBQUdDLEdBQUcsSUFBSUgsa0JBQWtCLENBQUN6QixHQUFHLENBQUM0QixHQUFHLENBQUMsQ0FBQTtBQUUvRCxNQUFNQyxTQUFTLENBQUM7QUFVWjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxVQUFVLEVBQUU7QUFkeEM7QUFBQSxJQUFBLElBQUEsQ0FDQUYsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFBQSxJQUFBLElBQUEsQ0FDQUMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFBQSxJQUFBLElBQUEsQ0FDQUMsVUFBVSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBUU4sSUFBSSxDQUFDRixNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsVUFBVSxHQUFHQSxVQUFVLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ksRUFBQSxNQUFNQyxJQUFJQSxDQUFDQyxHQUFHLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFO0lBQzdCLE1BQU1DLFFBQVEsR0FBRyxNQUFNQyxLQUFLLENBQUNKLEdBQUcsQ0FBQ0QsSUFBSSxDQUFDLENBQUE7QUFDdEMsSUFBQSxJQUFJLENBQUNJLFFBQVEsSUFBSSxDQUFDQSxRQUFRLENBQUNFLElBQUksRUFBRTtBQUM3QkosTUFBQUEsUUFBUSxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQzVDLEtBQUMsTUFBTTtBQUFBLE1BQUEsSUFBQUsscUJBQUEsQ0FBQTtNQUNIOUUsT0FBTyxDQUFDMkUsUUFBUSxDQUFDRSxJQUFJLENBQUNFLFNBQVMsRUFBRSxFQUFBRCxDQUFBQSxxQkFBQSxHQUFFSixLQUFLLENBQUNNLElBQUksQ0FBQ0MsYUFBYSxLQUFBLElBQUEsR0FBQUgscUJBQUEsR0FBSWQsb0JBQW9CLENBQUMsQ0FDL0VrQixJQUFJLENBQUVQLFFBQVEsSUFBSztBQUNoQkYsUUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJVSxjQUFjLENBQUMsSUFBSSxDQUFDZixNQUFNLEVBQUUsSUFBSWdCLFVBQVUsQ0FBQ1QsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzdFLE9BQUMsQ0FBQyxDQUNEVSxLQUFLLENBQUVDLEdBQUcsSUFBSztBQUNaYixRQUFBQSxRQUFRLENBQUNhLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN2QixPQUFDLENBQUMsQ0FBQTtBQUNWLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsSUFBSUEsQ0FBQ2YsR0FBRyxFQUFFUSxJQUFJLEVBQUU7QUFDWixJQUFBLE9BQU9BLElBQUksQ0FBQTtBQUNmLEdBQUE7QUFDSjs7OzsifQ==
