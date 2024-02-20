import { EventHandler } from '../../core/event-handler.js';

// sort blind set of data
function SortWorker() {
  // number of bits used to store the distance in integer array. Smaller number gives it a smaller
  // precision but faster sorting. Could be dynamic for less precise sorting.
  // 16bit seems plenty of large scenes (train), 10bits is enough for sled.
  const compareBits = 16;

  // number of buckets for count sorting to represent each unique distance using compareBits bits
  const bucketCount = 2 ** compareBits + 1;
  let data;
  let centers;
  let cameraPosition;
  let cameraDirection;
  let intIndices;
  const lastCameraPosition = {
    x: 0,
    y: 0,
    z: 0
  };
  const lastCameraDirection = {
    x: 0,
    y: 0,
    z: 0
  };
  const boundMin = {
    x: 0,
    y: 0,
    z: 0
  };
  const boundMax = {
    x: 0,
    y: 0,
    z: 0
  };
  let distances;
  let indices;
  let target;
  let countBuffer;
  const update = () => {
    var _distances;
    if (!centers || !data || !cameraPosition || !cameraDirection) return;
    const px = cameraPosition.x;
    const py = cameraPosition.y;
    const pz = cameraPosition.z;
    const dx = cameraDirection.x;
    const dy = cameraDirection.y;
    const dz = cameraDirection.z;
    const epsilon = 0.001;
    if (Math.abs(px - lastCameraPosition.x) < epsilon && Math.abs(py - lastCameraPosition.y) < epsilon && Math.abs(pz - lastCameraPosition.z) < epsilon && Math.abs(dx - lastCameraDirection.x) < epsilon && Math.abs(dy - lastCameraDirection.y) < epsilon && Math.abs(dz - lastCameraDirection.z) < epsilon) {
      return;
    }
    lastCameraPosition.x = px;
    lastCameraPosition.y = py;
    lastCameraPosition.z = pz;
    lastCameraDirection.x = dx;
    lastCameraDirection.y = dy;
    lastCameraDirection.z = dz;

    // create distance buffer
    const numVertices = centers.length / 3;
    if (((_distances = distances) == null ? void 0 : _distances.length) !== numVertices) {
      distances = new Uint32Array(numVertices);
      indices = new Uint32Array(numVertices);
      target = new Float32Array(numVertices);
    }

    // calc min/max distance using bound
    let minDist;
    let maxDist;
    for (let i = 0; i < 8; ++i) {
      const x = i & 1 ? boundMin.x : boundMax.x;
      const y = i & 2 ? boundMin.y : boundMax.y;
      const z = i & 4 ? boundMin.z : boundMax.z;
      const d = (x - px) * dx + (y - py) * dy + (z - pz) * dz;
      if (i === 0) {
        minDist = maxDist = d;
      } else {
        minDist = Math.min(minDist, d);
        maxDist = Math.max(maxDist, d);
      }
    }
    if (!countBuffer) countBuffer = new Uint32Array(bucketCount);
    for (let i = 0; i < bucketCount; i++) countBuffer[i] = 0;

    // generate per vertex distance to camera
    const range = maxDist - minDist;
    const divider = 1 / range * 2 ** compareBits;
    for (let i = 0; i < numVertices; ++i) {
      const istride = i * 3;
      const d = (centers[istride + 0] - px) * dx + (centers[istride + 1] - py) * dy + (centers[istride + 2] - pz) * dz;
      const sortKey = Math.floor((d - minDist) * divider);
      distances[i] = sortKey;
      indices[i] = i;

      // count occurrences of each distance
      countBuffer[sortKey]++;
    }

    // Change countBuffer[i] so that it contains actual position of this digit in outputArray
    for (let i = 1; i < bucketCount; i++) countBuffer[i] += countBuffer[i - 1];

    // Build the output array
    const outputArray = intIndices ? new Uint32Array(target.buffer) : target;
    const offset = intIndices ? 0 : 0.2;
    for (let i = numVertices - 1; i >= 0; i--) {
      const distance = distances[i];
      const index = indices[i];
      outputArray[countBuffer[distance] - 1] = index + offset;
      countBuffer[distance]--;
    }

    // swap
    const tmp = data;
    data = target;
    target = tmp;

    // send results
    self.postMessage({
      data: data.buffer
    }, [data.buffer]);
    data = null;
  };
  self.onmessage = message => {
    if (message.data.data) {
      data = new Float32Array(message.data.data);
    }
    if (message.data.centers) {
      centers = new Float32Array(message.data.centers);

      // calculate bounds
      boundMin.x = boundMax.x = centers[0];
      boundMin.y = boundMax.y = centers[1];
      boundMin.z = boundMax.z = centers[2];
      const numVertices = centers.length / 3;
      for (let i = 1; i < numVertices; ++i) {
        const x = centers[i * 3 + 0];
        const y = centers[i * 3 + 1];
        const z = centers[i * 3 + 2];
        boundMin.x = Math.min(boundMin.x, x);
        boundMin.y = Math.min(boundMin.y, y);
        boundMin.z = Math.min(boundMin.z, z);
        boundMax.x = Math.max(boundMax.x, x);
        boundMax.y = Math.max(boundMax.y, y);
        boundMax.z = Math.max(boundMax.z, z);
      }
    }
    if (message.data.intIndices) {
      intIndices = message.data.intIndices;
    }
    if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
    if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;
    update();
  };
}
class GSplatSorter extends EventHandler {
  constructor() {
    super();
    this.worker = void 0;
    this.vertexBuffer = void 0;
    this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
      type: 'application/javascript'
    })));
    this.worker.onmessage = message => {
      const newData = message.data.data;
      const oldData = this.vertexBuffer.storage;

      // send vertex storage to worker to start the next frame
      this.worker.postMessage({
        data: oldData
      }, [oldData]);

      // update vertex buffer data in the next event cycle so the above postMesssage
      // call is queued before the relatively slow setData call below is invoked
      setTimeout(() => {
        this.vertexBuffer.setData(newData);
        this.fire('updated');
      });
    };
  }
  destroy() {
    this.worker.terminate();
    this.worker = null;
  }
  init(vertexBuffer, centers, intIndices) {
    this.vertexBuffer = vertexBuffer;

    // send the initial buffer to worker
    const buf = vertexBuffer.storage.slice(0);
    this.worker.postMessage({
      data: buf,
      centers: centers.buffer,
      intIndices: intIndices
    }, [buf, centers.buffer]);
  }
  setCamera(pos, dir) {
    this.worker.postMessage({
      cameraPosition: {
        x: pos.x,
        y: pos.y,
        z: pos.z
      },
      cameraDirection: {
        x: dir.x,
        y: dir.y,
        z: dir.z
      }
    });
  }
}

export { GSplatSorter };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3NwbGF0LXNvcnRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2dzcGxhdC9nc3BsYXQtc29ydGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gXCIuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanNcIjtcblxuLy8gc29ydCBibGluZCBzZXQgb2YgZGF0YVxuZnVuY3Rpb24gU29ydFdvcmtlcigpIHtcblxuICAgIC8vIG51bWJlciBvZiBiaXRzIHVzZWQgdG8gc3RvcmUgdGhlIGRpc3RhbmNlIGluIGludGVnZXIgYXJyYXkuIFNtYWxsZXIgbnVtYmVyIGdpdmVzIGl0IGEgc21hbGxlclxuICAgIC8vIHByZWNpc2lvbiBidXQgZmFzdGVyIHNvcnRpbmcuIENvdWxkIGJlIGR5bmFtaWMgZm9yIGxlc3MgcHJlY2lzZSBzb3J0aW5nLlxuICAgIC8vIDE2Yml0IHNlZW1zIHBsZW50eSBvZiBsYXJnZSBzY2VuZXMgKHRyYWluKSwgMTBiaXRzIGlzIGVub3VnaCBmb3Igc2xlZC5cbiAgICBjb25zdCBjb21wYXJlQml0cyA9IDE2O1xuXG4gICAgLy8gbnVtYmVyIG9mIGJ1Y2tldHMgZm9yIGNvdW50IHNvcnRpbmcgdG8gcmVwcmVzZW50IGVhY2ggdW5pcXVlIGRpc3RhbmNlIHVzaW5nIGNvbXBhcmVCaXRzIGJpdHNcbiAgICBjb25zdCBidWNrZXRDb3VudCA9ICgyICoqIGNvbXBhcmVCaXRzKSArIDE7XG5cbiAgICBsZXQgZGF0YTtcbiAgICBsZXQgY2VudGVycztcbiAgICBsZXQgY2FtZXJhUG9zaXRpb247XG4gICAgbGV0IGNhbWVyYURpcmVjdGlvbjtcbiAgICBsZXQgaW50SW5kaWNlcztcblxuICAgIGNvbnN0IGxhc3RDYW1lcmFQb3NpdGlvbiA9IHsgeDogMCwgeTogMCwgejogMCB9O1xuICAgIGNvbnN0IGxhc3RDYW1lcmFEaXJlY3Rpb24gPSB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcblxuICAgIGNvbnN0IGJvdW5kTWluID0geyB4OiAwLCB5OiAwLCB6OiAwIH07XG4gICAgY29uc3QgYm91bmRNYXggPSB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcblxuICAgIGxldCBkaXN0YW5jZXM7XG4gICAgbGV0IGluZGljZXM7XG4gICAgbGV0IHRhcmdldDtcbiAgICBsZXQgY291bnRCdWZmZXI7XG5cbiAgICBjb25zdCB1cGRhdGUgPSAoKSA9PiB7XG4gICAgICAgIGlmICghY2VudGVycyB8fCAhZGF0YSB8fCAhY2FtZXJhUG9zaXRpb24gfHwgIWNhbWVyYURpcmVjdGlvbikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHB4ID0gY2FtZXJhUG9zaXRpb24ueDtcbiAgICAgICAgY29uc3QgcHkgPSBjYW1lcmFQb3NpdGlvbi55O1xuICAgICAgICBjb25zdCBweiA9IGNhbWVyYVBvc2l0aW9uLno7XG4gICAgICAgIGNvbnN0IGR4ID0gY2FtZXJhRGlyZWN0aW9uLng7XG4gICAgICAgIGNvbnN0IGR5ID0gY2FtZXJhRGlyZWN0aW9uLnk7XG4gICAgICAgIGNvbnN0IGR6ID0gY2FtZXJhRGlyZWN0aW9uLno7XG5cbiAgICAgICAgY29uc3QgZXBzaWxvbiA9IDAuMDAxO1xuXG4gICAgICAgIGlmIChNYXRoLmFicyhweCAtIGxhc3RDYW1lcmFQb3NpdGlvbi54KSA8IGVwc2lsb24gJiZcbiAgICAgICAgICAgIE1hdGguYWJzKHB5IC0gbGFzdENhbWVyYVBvc2l0aW9uLnkpIDwgZXBzaWxvbiAmJlxuICAgICAgICAgICAgTWF0aC5hYnMocHogLSBsYXN0Q2FtZXJhUG9zaXRpb24ueikgPCBlcHNpbG9uICYmXG4gICAgICAgICAgICBNYXRoLmFicyhkeCAtIGxhc3RDYW1lcmFEaXJlY3Rpb24ueCkgPCBlcHNpbG9uICYmXG4gICAgICAgICAgICBNYXRoLmFicyhkeSAtIGxhc3RDYW1lcmFEaXJlY3Rpb24ueSkgPCBlcHNpbG9uICYmXG4gICAgICAgICAgICBNYXRoLmFicyhkeiAtIGxhc3RDYW1lcmFEaXJlY3Rpb24ueikgPCBlcHNpbG9uKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0Q2FtZXJhUG9zaXRpb24ueCA9IHB4O1xuICAgICAgICBsYXN0Q2FtZXJhUG9zaXRpb24ueSA9IHB5O1xuICAgICAgICBsYXN0Q2FtZXJhUG9zaXRpb24ueiA9IHB6O1xuICAgICAgICBsYXN0Q2FtZXJhRGlyZWN0aW9uLnggPSBkeDtcbiAgICAgICAgbGFzdENhbWVyYURpcmVjdGlvbi55ID0gZHk7XG4gICAgICAgIGxhc3RDYW1lcmFEaXJlY3Rpb24ueiA9IGR6O1xuXG4gICAgICAgIC8vIGNyZWF0ZSBkaXN0YW5jZSBidWZmZXJcbiAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSBjZW50ZXJzLmxlbmd0aCAvIDM7XG4gICAgICAgIGlmIChkaXN0YW5jZXM/Lmxlbmd0aCAhPT0gbnVtVmVydGljZXMpIHtcbiAgICAgICAgICAgIGRpc3RhbmNlcyA9IG5ldyBVaW50MzJBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQzMkFycmF5KG51bVZlcnRpY2VzKTtcbiAgICAgICAgICAgIHRhcmdldCA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydGljZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsYyBtaW4vbWF4IGRpc3RhbmNlIHVzaW5nIGJvdW5kXG4gICAgICAgIGxldCBtaW5EaXN0O1xuICAgICAgICBsZXQgbWF4RGlzdDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA4OyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBpICYgMSA/IGJvdW5kTWluLnggOiBib3VuZE1heC54O1xuICAgICAgICAgICAgY29uc3QgeSA9IGkgJiAyID8gYm91bmRNaW4ueSA6IGJvdW5kTWF4Lnk7XG4gICAgICAgICAgICBjb25zdCB6ID0gaSAmIDQgPyBib3VuZE1pbi56IDogYm91bmRNYXguejtcbiAgICAgICAgICAgIGNvbnN0IGQgPSAoeCAtIHB4KSAqIGR4ICsgKHkgLSBweSkgKiBkeSArICh6IC0gcHopICogZHo7XG4gICAgICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIG1pbkRpc3QgPSBtYXhEaXN0ID0gZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWluRGlzdCA9IE1hdGgubWluKG1pbkRpc3QsIGQpO1xuICAgICAgICAgICAgICAgIG1heERpc3QgPSBNYXRoLm1heChtYXhEaXN0LCBkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY291bnRCdWZmZXIpXG4gICAgICAgICAgICBjb3VudEJ1ZmZlciA9IG5ldyBVaW50MzJBcnJheShidWNrZXRDb3VudCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWNrZXRDb3VudDsgaSsrKVxuICAgICAgICAgICAgY291bnRCdWZmZXJbaV0gPSAwO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIHBlciB2ZXJ0ZXggZGlzdGFuY2UgdG8gY2FtZXJhXG4gICAgICAgIGNvbnN0IHJhbmdlID0gbWF4RGlzdCAtIG1pbkRpc3Q7XG4gICAgICAgIGNvbnN0IGRpdmlkZXIgPSAxIC8gcmFuZ2UgKiAoMiAqKiBjb21wYXJlQml0cyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVmVydGljZXM7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgaXN0cmlkZSA9IGkgKiAzO1xuICAgICAgICAgICAgY29uc3QgZCA9IChjZW50ZXJzW2lzdHJpZGUgKyAwXSAtIHB4KSAqIGR4ICtcbiAgICAgICAgICAgICAgICAgICAgICAoY2VudGVyc1tpc3RyaWRlICsgMV0gLSBweSkgKiBkeSArXG4gICAgICAgICAgICAgICAgICAgICAgKGNlbnRlcnNbaXN0cmlkZSArIDJdIC0gcHopICogZHo7XG4gICAgICAgICAgICBjb25zdCBzb3J0S2V5ID0gTWF0aC5mbG9vcigoZCAtIG1pbkRpc3QpICogZGl2aWRlcik7XG5cbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXSA9IHNvcnRLZXk7XG4gICAgICAgICAgICBpbmRpY2VzW2ldID0gaTtcblxuICAgICAgICAgICAgLy8gY291bnQgb2NjdXJyZW5jZXMgb2YgZWFjaCBkaXN0YW5jZVxuICAgICAgICAgICAgY291bnRCdWZmZXJbc29ydEtleV0rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoYW5nZSBjb3VudEJ1ZmZlcltpXSBzbyB0aGF0IGl0IGNvbnRhaW5zIGFjdHVhbCBwb3NpdGlvbiBvZiB0aGlzIGRpZ2l0IGluIG91dHB1dEFycmF5XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYnVja2V0Q291bnQ7IGkrKylcbiAgICAgICAgICAgIGNvdW50QnVmZmVyW2ldICs9IGNvdW50QnVmZmVyW2kgLSAxXTtcblxuICAgICAgICAvLyBCdWlsZCB0aGUgb3V0cHV0IGFycmF5XG4gICAgICAgIGNvbnN0IG91dHB1dEFycmF5ID0gaW50SW5kaWNlcyA/IG5ldyBVaW50MzJBcnJheSh0YXJnZXQuYnVmZmVyKSA6IHRhcmdldDtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gaW50SW5kaWNlcyA/IDAgOiAwLjI7XG4gICAgICAgIGZvciAobGV0IGkgPSBudW1WZXJ0aWNlcyAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBjb25zdCBkaXN0YW5jZSA9IGRpc3RhbmNlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gaW5kaWNlc1tpXTtcbiAgICAgICAgICAgIG91dHB1dEFycmF5W2NvdW50QnVmZmVyW2Rpc3RhbmNlXSAtIDFdID0gaW5kZXggKyBvZmZzZXQ7XG4gICAgICAgICAgICBjb3VudEJ1ZmZlcltkaXN0YW5jZV0tLTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN3YXBcbiAgICAgICAgY29uc3QgdG1wID0gZGF0YTtcbiAgICAgICAgZGF0YSA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gdG1wO1xuXG4gICAgICAgIC8vIHNlbmQgcmVzdWx0c1xuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGRhdGE6IGRhdGEuYnVmZmVyXG4gICAgICAgIH0sIFtkYXRhLmJ1ZmZlcl0pO1xuXG4gICAgICAgIGRhdGEgPSBudWxsO1xuICAgIH07XG5cbiAgICBzZWxmLm9ubWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICAgIGlmIChtZXNzYWdlLmRhdGEuZGF0YSkge1xuICAgICAgICAgICAgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkobWVzc2FnZS5kYXRhLmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXNzYWdlLmRhdGEuY2VudGVycykge1xuICAgICAgICAgICAgY2VudGVycyA9IG5ldyBGbG9hdDMyQXJyYXkobWVzc2FnZS5kYXRhLmNlbnRlcnMpO1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgYm91bmRzXG4gICAgICAgICAgICBib3VuZE1pbi54ID0gYm91bmRNYXgueCA9IGNlbnRlcnNbMF07XG4gICAgICAgICAgICBib3VuZE1pbi55ID0gYm91bmRNYXgueSA9IGNlbnRlcnNbMV07XG4gICAgICAgICAgICBib3VuZE1pbi56ID0gYm91bmRNYXgueiA9IGNlbnRlcnNbMl07XG5cbiAgICAgICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gY2VudGVycy5sZW5ndGggLyAzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBudW1WZXJ0aWNlczsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IGNlbnRlcnNbaSAqIDMgKyAwXTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gY2VudGVyc1tpICogMyArIDFdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBjZW50ZXJzW2kgKiAzICsgMl07XG5cbiAgICAgICAgICAgICAgICBib3VuZE1pbi54ID0gTWF0aC5taW4oYm91bmRNaW4ueCwgeCk7XG4gICAgICAgICAgICAgICAgYm91bmRNaW4ueSA9IE1hdGgubWluKGJvdW5kTWluLnksIHkpO1xuICAgICAgICAgICAgICAgIGJvdW5kTWluLnogPSBNYXRoLm1pbihib3VuZE1pbi56LCB6KTtcblxuICAgICAgICAgICAgICAgIGJvdW5kTWF4LnggPSBNYXRoLm1heChib3VuZE1heC54LCB4KTtcbiAgICAgICAgICAgICAgICBib3VuZE1heC55ID0gTWF0aC5tYXgoYm91bmRNYXgueSwgeSk7XG4gICAgICAgICAgICAgICAgYm91bmRNYXgueiA9IE1hdGgubWF4KGJvdW5kTWF4LnosIHopO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtZXNzYWdlLmRhdGEuaW50SW5kaWNlcykge1xuICAgICAgICAgICAgaW50SW5kaWNlcyA9IG1lc3NhZ2UuZGF0YS5pbnRJbmRpY2VzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZXNzYWdlLmRhdGEuY2FtZXJhUG9zaXRpb24pIGNhbWVyYVBvc2l0aW9uID0gbWVzc2FnZS5kYXRhLmNhbWVyYVBvc2l0aW9uO1xuICAgICAgICBpZiAobWVzc2FnZS5kYXRhLmNhbWVyYURpcmVjdGlvbikgY2FtZXJhRGlyZWN0aW9uID0gbWVzc2FnZS5kYXRhLmNhbWVyYURpcmVjdGlvbjtcblxuICAgICAgICB1cGRhdGUoKTtcbiAgICB9O1xufVxuXG5jbGFzcyBHU3BsYXRTb3J0ZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIHdvcmtlcjtcblxuICAgIHZlcnRleEJ1ZmZlcjtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMud29ya2VyID0gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFtgKCR7U29ydFdvcmtlci50b1N0cmluZygpfSkoKWBdLCB7XG4gICAgICAgICAgICB0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCdcbiAgICAgICAgfSkpKTtcblxuICAgICAgICB0aGlzLndvcmtlci5vbm1lc3NhZ2UgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV3RGF0YSA9IG1lc3NhZ2UuZGF0YS5kYXRhO1xuICAgICAgICAgICAgY29uc3Qgb2xkRGF0YSA9IHRoaXMudmVydGV4QnVmZmVyLnN0b3JhZ2U7XG5cbiAgICAgICAgICAgIC8vIHNlbmQgdmVydGV4IHN0b3JhZ2UgdG8gd29ya2VyIHRvIHN0YXJ0IHRoZSBuZXh0IGZyYW1lXG4gICAgICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgZGF0YTogb2xkRGF0YVxuICAgICAgICAgICAgfSwgW29sZERhdGFdKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIHZlcnRleCBidWZmZXIgZGF0YSBpbiB0aGUgbmV4dCBldmVudCBjeWNsZSBzbyB0aGUgYWJvdmUgcG9zdE1lc3NzYWdlXG4gICAgICAgICAgICAvLyBjYWxsIGlzIHF1ZXVlZCBiZWZvcmUgdGhlIHJlbGF0aXZlbHkgc2xvdyBzZXREYXRhIGNhbGwgYmVsb3cgaXMgaW52b2tlZFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIuc2V0RGF0YShuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3VwZGF0ZWQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMud29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgICAgICB0aGlzLndvcmtlciA9IG51bGw7XG4gICAgfVxuXG4gICAgaW5pdCh2ZXJ0ZXhCdWZmZXIsIGNlbnRlcnMsIGludEluZGljZXMpIHtcbiAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG5cbiAgICAgICAgLy8gc2VuZCB0aGUgaW5pdGlhbCBidWZmZXIgdG8gd29ya2VyXG4gICAgICAgIGNvbnN0IGJ1ZiA9IHZlcnRleEJ1ZmZlci5zdG9yYWdlLnNsaWNlKDApO1xuICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICBkYXRhOiBidWYsXG4gICAgICAgICAgICBjZW50ZXJzOiBjZW50ZXJzLmJ1ZmZlcixcbiAgICAgICAgICAgIGludEluZGljZXM6IGludEluZGljZXNcbiAgICAgICAgfSwgW2J1ZiwgY2VudGVycy5idWZmZXJdKTtcbiAgICB9XG5cbiAgICBzZXRDYW1lcmEocG9zLCBkaXIpIHtcbiAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgY2FtZXJhUG9zaXRpb246IHsgeDogcG9zLngsIHk6IHBvcy55LCB6OiBwb3MueiB9LFxuICAgICAgICAgICAgY2FtZXJhRGlyZWN0aW9uOiB7IHg6IGRpci54LCB5OiBkaXIueSwgejogZGlyLnogfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdTcGxhdFNvcnRlciB9O1xuIl0sIm5hbWVzIjpbIlNvcnRXb3JrZXIiLCJjb21wYXJlQml0cyIsImJ1Y2tldENvdW50IiwiZGF0YSIsImNlbnRlcnMiLCJjYW1lcmFQb3NpdGlvbiIsImNhbWVyYURpcmVjdGlvbiIsImludEluZGljZXMiLCJsYXN0Q2FtZXJhUG9zaXRpb24iLCJ4IiwieSIsInoiLCJsYXN0Q2FtZXJhRGlyZWN0aW9uIiwiYm91bmRNaW4iLCJib3VuZE1heCIsImRpc3RhbmNlcyIsImluZGljZXMiLCJ0YXJnZXQiLCJjb3VudEJ1ZmZlciIsInVwZGF0ZSIsIl9kaXN0YW5jZXMiLCJweCIsInB5IiwicHoiLCJkeCIsImR5IiwiZHoiLCJlcHNpbG9uIiwiTWF0aCIsImFicyIsIm51bVZlcnRpY2VzIiwibGVuZ3RoIiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJtaW5EaXN0IiwibWF4RGlzdCIsImkiLCJkIiwibWluIiwibWF4IiwicmFuZ2UiLCJkaXZpZGVyIiwiaXN0cmlkZSIsInNvcnRLZXkiLCJmbG9vciIsIm91dHB1dEFycmF5IiwiYnVmZmVyIiwib2Zmc2V0IiwiZGlzdGFuY2UiLCJpbmRleCIsInRtcCIsInNlbGYiLCJwb3N0TWVzc2FnZSIsIm9ubWVzc2FnZSIsIm1lc3NhZ2UiLCJHU3BsYXRTb3J0ZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIndvcmtlciIsInZlcnRleEJ1ZmZlciIsIldvcmtlciIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIkJsb2IiLCJ0b1N0cmluZyIsInR5cGUiLCJuZXdEYXRhIiwib2xkRGF0YSIsInN0b3JhZ2UiLCJzZXRUaW1lb3V0Iiwic2V0RGF0YSIsImZpcmUiLCJkZXN0cm95IiwidGVybWluYXRlIiwiaW5pdCIsImJ1ZiIsInNsaWNlIiwic2V0Q2FtZXJhIiwicG9zIiwiZGlyIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0EsU0FBU0EsVUFBVUEsR0FBRztBQUVsQjtBQUNBO0FBQ0E7RUFDQSxNQUFNQyxXQUFXLEdBQUcsRUFBRSxDQUFBOztBQUV0QjtBQUNBLEVBQUEsTUFBTUMsV0FBVyxHQUFJLENBQUMsSUFBSUQsV0FBVyxHQUFJLENBQUMsQ0FBQTtBQUUxQyxFQUFBLElBQUlFLElBQUksQ0FBQTtBQUNSLEVBQUEsSUFBSUMsT0FBTyxDQUFBO0FBQ1gsRUFBQSxJQUFJQyxjQUFjLENBQUE7QUFDbEIsRUFBQSxJQUFJQyxlQUFlLENBQUE7QUFDbkIsRUFBQSxJQUFJQyxVQUFVLENBQUE7QUFFZCxFQUFBLE1BQU1DLGtCQUFrQixHQUFHO0FBQUVDLElBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLElBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLElBQUFBLENBQUMsRUFBRSxDQUFBO0dBQUcsQ0FBQTtBQUMvQyxFQUFBLE1BQU1DLG1CQUFtQixHQUFHO0FBQUVILElBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLElBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLElBQUFBLENBQUMsRUFBRSxDQUFBO0dBQUcsQ0FBQTtBQUVoRCxFQUFBLE1BQU1FLFFBQVEsR0FBRztBQUFF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
