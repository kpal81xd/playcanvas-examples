import { Debug } from '../../core/debug.js';
import { TRACEID_VRAM_VB } from '../../core/constants.js';
import { BUFFER_STATIC } from './constants.js';

let id = 0;

/**
 * A vertex buffer is the mechanism via which the application specifies vertex data to the graphics
 * hardware.
 *
 * @category Graphics
 */
class VertexBuffer {
  /**
   * Create a new VertexBuffer instance.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this vertex buffer.
   * @param {import('./vertex-format.js').VertexFormat} format - The vertex format of this vertex
   * buffer.
   * @param {number} numVertices - The number of vertices that this vertex buffer will hold.
   * @param {number} [usage] - The usage type of the vertex buffer (see BUFFER_*). Defaults to BUFFER_STATIC.
   * @param {ArrayBuffer} [initialData] - Initial data.
   */
  constructor(graphicsDevice, format, numVertices, usage = BUFFER_STATIC, initialData) {
    // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
    this.device = graphicsDevice;
    this.format = format;
    this.numVertices = numVertices;
    this.usage = usage;
    this.id = id++;
    this.impl = graphicsDevice.createVertexBufferImpl(this, format);

    // Calculate the size. If format contains verticesByteSize (non-interleaved format), use it
    this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
    this.adjustVramSizeTracking(graphicsDevice._vram, this.numBytes);

    // Allocate the storage
    if (initialData) {
      this.setData(initialData);
    } else {
      this.storage = new ArrayBuffer(this.numBytes);
    }
    this.device.buffers.push(this);
  }

  /**
   * Frees resources associated with this vertex buffer.
   */
  destroy() {
    // stop tracking the vertex buffer
    const device = this.device;
    const idx = device.buffers.indexOf(this);
    if (idx !== -1) {
      device.buffers.splice(idx, 1);
    }
    if (this.impl.initialized) {
      this.impl.destroy(device);
      this.adjustVramSizeTracking(device._vram, -this.storage.byteLength);
    }
  }
  adjustVramSizeTracking(vram, size) {
    Debug.trace(TRACEID_VRAM_VB, `${this.id} size: ${size} vram.vb: ${vram.vb} => ${vram.vb + size}`);
    vram.vb += size;
  }

  /**
   * Called when the rendering context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.impl.loseContext();
  }

  /**
   * Returns the data format of the specified vertex buffer.
   *
   * @returns {import('./vertex-format.js').VertexFormat} The data format of the specified vertex
   * buffer.
   */
  getFormat() {
    return this.format;
  }

  /**
   * Returns the usage type of the specified vertex buffer. This indicates whether the buffer can
   * be modified once and used many times {@link BUFFER_STATIC}, modified repeatedly and used
   * many times {@link BUFFER_DYNAMIC} or modified once and used at most a few times
   * {@link BUFFER_STREAM}.
   *
   * @returns {number} The usage type of the vertex buffer (see BUFFER_*).
   */
  getUsage() {
    return this.usage;
  }

  /**
   * Returns the number of vertices stored in the specified vertex buffer.
   *
   * @returns {number} The number of vertices stored in the vertex buffer.
   */
  getNumVertices() {
    return this.numVertices;
  }

  /**
   * Returns a mapped memory block representing the content of the vertex buffer.
   *
   * @returns {ArrayBuffer} An array containing the byte data stored in the vertex buffer.
   */
  lock() {
    return this.storage;
  }

  /**
   * Notifies the graphics engine that the client side copy of the vertex buffer's memory can be
   * returned to the control of the graphics driver.
   */
  unlock() {
    // Upload the new vertex data
    this.impl.unlock(this);
  }

  /**
   * Copies data into vertex buffer's memory.
   *
   * @param {ArrayBuffer} [data] - Source data to copy.
   * @returns {boolean} True if function finished successfully, false otherwise.
   */
  setData(data) {
    if (data.byteLength !== this.numBytes) {
      Debug.error(`VertexBuffer: wrong initial data size: expected ${this.numBytes}, got ${data.byteLength}`);
      return false;
    }
    this.storage = data;
    this.unlock();
    return true;
  }
}

export { VertexBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVydGV4LWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVlJBTV9WQiB9IGZyb20gJy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJVRkZFUl9TVEFUSUMgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB2ZXJ0ZXggYnVmZmVyIGlzIHRoZSBtZWNoYW5pc20gdmlhIHdoaWNoIHRoZSBhcHBsaWNhdGlvbiBzcGVjaWZpZXMgdmVydGV4IGRhdGEgdG8gdGhlIGdyYXBoaWNzXG4gKiBoYXJkd2FyZS5cbiAqXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgVmVydGV4QnVmZmVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVmVydGV4QnVmZmVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgdmVydGV4IGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZXJ0ZXgtZm9ybWF0LmpzJykuVmVydGV4Rm9ybWF0fSBmb3JtYXQgLSBUaGUgdmVydGV4IGZvcm1hdCBvZiB0aGlzIHZlcnRleFxuICAgICAqIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtVmVydGljZXMgLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRoYXQgdGhpcyB2ZXJ0ZXggYnVmZmVyIHdpbGwgaG9sZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3VzYWdlXSAtIFRoZSB1c2FnZSB0eXBlIG9mIHRoZSB2ZXJ0ZXggYnVmZmVyIChzZWUgQlVGRkVSXyopLiBEZWZhdWx0cyB0byBCVUZGRVJfU1RBVElDLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IFtpbml0aWFsRGF0YV0gLSBJbml0aWFsIGRhdGEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGZvcm1hdCwgbnVtVmVydGljZXMsIHVzYWdlID0gQlVGRkVSX1NUQVRJQywgaW5pdGlhbERhdGEpIHtcbiAgICAgICAgLy8gQnkgZGVmYXVsdCwgdmVydGV4IGJ1ZmZlcnMgYXJlIHN0YXRpYyAoYmV0dGVyIGZvciBwZXJmb3JtYW5jZSBzaW5jZSBidWZmZXIgZGF0YSBjYW4gYmUgY2FjaGVkIGluIFZSQU0pXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMuZm9ybWF0ID0gZm9ybWF0O1xuICAgICAgICB0aGlzLm51bVZlcnRpY2VzID0gbnVtVmVydGljZXM7XG4gICAgICAgIHRoaXMudXNhZ2UgPSB1c2FnZTtcblxuICAgICAgICB0aGlzLmlkID0gaWQrKztcblxuICAgICAgICB0aGlzLmltcGwgPSBncmFwaGljc0RldmljZS5jcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsKHRoaXMsIGZvcm1hdCk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBzaXplLiBJZiBmb3JtYXQgY29udGFpbnMgdmVydGljZXNCeXRlU2l6ZSAobm9uLWludGVybGVhdmVkIGZvcm1hdCksIHVzZSBpdFxuICAgICAgICB0aGlzLm51bUJ5dGVzID0gZm9ybWF0LnZlcnRpY2VzQnl0ZVNpemUgPyBmb3JtYXQudmVydGljZXNCeXRlU2l6ZSA6IGZvcm1hdC5zaXplICogbnVtVmVydGljZXM7XG4gICAgICAgIHRoaXMuYWRqdXN0VnJhbVNpemVUcmFja2luZyhncmFwaGljc0RldmljZS5fdnJhbSwgdGhpcy5udW1CeXRlcyk7XG5cbiAgICAgICAgLy8gQWxsb2NhdGUgdGhlIHN0b3JhZ2VcbiAgICAgICAgaWYgKGluaXRpYWxEYXRhKSB7XG4gICAgICAgICAgICB0aGlzLnNldERhdGEoaW5pdGlhbERhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdG9yYWdlID0gbmV3IEFycmF5QnVmZmVyKHRoaXMubnVtQnl0ZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXZpY2UuYnVmZmVycy5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIHJlc291cmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgLy8gc3RvcCB0cmFja2luZyB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgaWR4ID0gZGV2aWNlLmJ1ZmZlcnMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgIGRldmljZS5idWZmZXJzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW1wbC5pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3koZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuYWRqdXN0VnJhbVNpemVUcmFja2luZyhkZXZpY2UuX3ZyYW0sIC10aGlzLnN0b3JhZ2UuYnl0ZUxlbmd0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGp1c3RWcmFtU2l6ZVRyYWNraW5nKHZyYW0sIHNpemUpIHtcbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9WUkFNX1ZCLCBgJHt0aGlzLmlkfSBzaXplOiAke3NpemV9IHZyYW0udmI6ICR7dnJhbS52Yn0gPT4gJHt2cmFtLnZiICsgc2l6ZX1gKTtcbiAgICAgICAgdnJhbS52YiArPSBzaXplO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSByZW5kZXJpbmcgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW1wbC5sb3NlQ29udGV4dCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGRhdGEgZm9ybWF0IG9mIHRoZSBzcGVjaWZpZWQgdmVydGV4IGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vdmVydGV4LWZvcm1hdC5qcycpLlZlcnRleEZvcm1hdH0gVGhlIGRhdGEgZm9ybWF0IG9mIHRoZSBzcGVjaWZpZWQgdmVydGV4XG4gICAgICogYnVmZmVyLlxuICAgICAqL1xuICAgIGdldEZvcm1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHVzYWdlIHR5cGUgb2YgdGhlIHNwZWNpZmllZCB2ZXJ0ZXggYnVmZmVyLiBUaGlzIGluZGljYXRlcyB3aGV0aGVyIHRoZSBidWZmZXIgY2FuXG4gICAgICogYmUgbW9kaWZpZWQgb25jZSBhbmQgdXNlZCBtYW55IHRpbWVzIHtAbGluayBCVUZGRVJfU1RBVElDfSwgbW9kaWZpZWQgcmVwZWF0ZWRseSBhbmQgdXNlZFxuICAgICAqIG1hbnkgdGltZXMge0BsaW5rIEJVRkZFUl9EWU5BTUlDfSBvciBtb2RpZmllZCBvbmNlIGFuZCB1c2VkIGF0IG1vc3QgYSBmZXcgdGltZXNcbiAgICAgKiB7QGxpbmsgQlVGRkVSX1NUUkVBTX0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgdXNhZ2UgdHlwZSBvZiB0aGUgdmVydGV4IGJ1ZmZlciAoc2VlIEJVRkZFUl8qKS5cbiAgICAgKi9cbiAgICBnZXRVc2FnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXNhZ2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHN0b3JlZCBpbiB0aGUgc3BlY2lmaWVkIHZlcnRleCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHN0b3JlZCBpbiB0aGUgdmVydGV4IGJ1ZmZlci5cbiAgICAgKi9cbiAgICBnZXROdW1WZXJ0aWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubnVtVmVydGljZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG1hcHBlZCBtZW1vcnkgYmxvY2sgcmVwcmVzZW50aW5nIHRoZSBjb250ZW50IG9mIHRoZSB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0FycmF5QnVmZmVyfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBieXRlIGRhdGEgc3RvcmVkIGluIHRoZSB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqL1xuICAgIGxvY2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0b3JhZ2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTm90aWZpZXMgdGhlIGdyYXBoaWNzIGVuZ2luZSB0aGF0IHRoZSBjbGllbnQgc2lkZSBjb3B5IG9mIHRoZSB2ZXJ0ZXggYnVmZmVyJ3MgbWVtb3J5IGNhbiBiZVxuICAgICAqIHJldHVybmVkIHRvIHRoZSBjb250cm9sIG9mIHRoZSBncmFwaGljcyBkcml2ZXIuXG4gICAgICovXG4gICAgdW5sb2NrKCkge1xuXG4gICAgICAgIC8vIFVwbG9hZCB0aGUgbmV3IHZlcnRleCBkYXRhXG4gICAgICAgIHRoaXMuaW1wbC51bmxvY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIGRhdGEgaW50byB2ZXJ0ZXggYnVmZmVyJ3MgbWVtb3J5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gW2RhdGFdIC0gU291cmNlIGRhdGEgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBmdW5jdGlvbiBmaW5pc2hlZCBzdWNjZXNzZnVsbHksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXREYXRhKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEuYnl0ZUxlbmd0aCAhPT0gdGhpcy5udW1CeXRlcykge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYFZlcnRleEJ1ZmZlcjogd3JvbmcgaW5pdGlhbCBkYXRhIHNpemU6IGV4cGVjdGVkICR7dGhpcy5udW1CeXRlc30sIGdvdCAke2RhdGEuYnl0ZUxlbmd0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0b3JhZ2UgPSBkYXRhO1xuICAgICAgICB0aGlzLnVubG9jaygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFZlcnRleEJ1ZmZlciB9O1xuIl0sIm5hbWVzIjpbImlkIiwiVmVydGV4QnVmZmVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImZvcm1hdCIsIm51bVZlcnRpY2VzIiwidXNhZ2UiLCJCVUZGRVJfU1RBVElDIiwiaW5pdGlhbERhdGEiLCJkZXZpY2UiLCJpbXBsIiwiY3JlYXRlVmVydGV4QnVmZmVySW1wbCIsIm51bUJ5dGVzIiwidmVydGljZXNCeXRlU2l6ZSIsInNpemUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJzZXREYXRhIiwic3RvcmFnZSIsIkFycmF5QnVmZmVyIiwiYnVmZmVycyIsInB1c2giLCJkZXN0cm95IiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsImluaXRpYWxpemVkIiwiYnl0ZUxlbmd0aCIsInZyYW0iLCJEZWJ1ZyIsInRyYWNlIiwiVFJBQ0VJRF9WUkFNX1ZCIiwidmIiLCJsb3NlQ29udGV4dCIsImdldEZvcm1hdCIsImdldFVzYWdlIiwiZ2V0TnVtVmVydGljZXMiLCJsb2NrIiwidW5sb2NrIiwiZGF0YSIsImVycm9yIl0sIm1hcHBpbmdzIjoiOzs7O0FBSUEsSUFBSUEsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxZQUFZLENBQUM7QUFDZjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLGNBQWMsRUFBRUMsTUFBTSxFQUFFQyxXQUFXLEVBQUVDLEtBQUssR0FBR0MsYUFBYSxFQUFFQyxXQUFXLEVBQUU7QUFDakY7SUFDQSxJQUFJLENBQUNDLE1BQU0sR0FBR04sY0FBYyxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxXQUFXLEdBQUdBLFdBQVcsQ0FBQTtJQUM5QixJQUFJLENBQUNDLEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBRWxCLElBQUEsSUFBSSxDQUFDTixFQUFFLEdBQUdBLEVBQUUsRUFBRSxDQUFBO0lBRWQsSUFBSSxDQUFDVSxJQUFJLEdBQUdQLGNBQWMsQ0FBQ1Esc0JBQXNCLENBQUMsSUFBSSxFQUFFUCxNQUFNLENBQUMsQ0FBQTs7QUFFL0Q7QUFDQSxJQUFBLElBQUksQ0FBQ1EsUUFBUSxHQUFHUixNQUFNLENBQUNTLGdCQUFnQixHQUFHVCxNQUFNLENBQUNTLGdCQUFnQixHQUFHVCxNQUFNLENBQUNVLElBQUksR0FBR1QsV0FBVyxDQUFBO0lBQzdGLElBQUksQ0FBQ1Usc0JBQXNCLENBQUNaLGNBQWMsQ0FBQ2EsS0FBSyxFQUFFLElBQUksQ0FBQ0osUUFBUSxDQUFDLENBQUE7O0FBRWhFO0FBQ0EsSUFBQSxJQUFJSixXQUFXLEVBQUU7QUFDYixNQUFBLElBQUksQ0FBQ1MsT0FBTyxDQUFDVCxXQUFXLENBQUMsQ0FBQTtBQUM3QixLQUFDLE1B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
