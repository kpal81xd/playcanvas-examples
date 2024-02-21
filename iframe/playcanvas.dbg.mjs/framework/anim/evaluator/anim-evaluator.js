import { AnimTargetValue } from './anim-target-value.js';
import { AnimBlend } from './anim-blend.js';

/**
 * AnimEvaluator blends multiple sets of animation clips together.
 *
 * @ignore
 */
class AnimEvaluator {
  /**
   * Create a new animation evaluator.
   *
   * @param {import('../binder/anim-binder.js').AnimBinder} binder - interface resolves curve
   * paths to instances of {@link AnimTarget}.
   */
  constructor(binder) {
    this._binder = binder;
    this._clips = [];
    this._inputs = [];
    this._outputs = [];
    this._targets = {};
  }

  /**
   * The list of animation clips.
   *
   * @type {import('./anim-clip.js').AnimClip[]}
   */
  get clips() {
    return this._clips;
  }

  /**
   * Add a clip to the evaluator.
   *
   * @param {import('./anim-clip.js').AnimClip} clip - The clip to add to the evaluator.
   */
  addClip(clip) {
    const targets = this._targets;
    const binder = this._binder;

    // store list of input/output arrays
    const curves = clip.track.curves;
    const snapshot = clip.snapshot;
    const inputs = [];
    const outputs = [];
    for (let i = 0; i < curves.length; ++i) {
      const curve = curves[i];
      const paths = curve.paths;
      for (let j = 0; j < paths.length; ++j) {
        const path = paths[j];
        const resolved = binder.resolve(path);
        let target = targets[resolved && resolved.targetPath || null];

        // create new target if it doesn't exist yet
        if (!target && resolved) {
          target = {
            target: resolved,
            // resolved target instance
            value: [],
            // storage for calculated value
            curves: 0,
            // number of curves driving this target
            blendCounter: 0 // per-frame number of blends (used to identify first blend)
          };

          for (let k = 0; k < target.target.components; ++k) {
            target.value.push(0);
          }
          targets[resolved.targetPath] = target;
          if (binder.animComponent) {
            if (!binder.animComponent.targets[resolved.targetPath]) {
              let type;
              if (resolved.targetPath.substring(resolved.targetPath.length - 13) === 'localRotation') {
                type = AnimTargetValue.TYPE_QUAT;
              } else {
                type = AnimTargetValue.TYPE_VEC3;
              }
              binder.animComponent.targets[resolved.targetPath] = new AnimTargetValue(binder.animComponent, type);
            }
            binder.animComponent.targets[resolved.targetPath].layerCounter++;
            binder.animComponent.targets[resolved.targetPath].setMask(binder.layerIndex, 1);
          }
        }

        // binding may have failed
        // TODO: it may be worth storing quaternions and vector targets in separate
        // lists. this way the update code won't be forced to check target type before
        // setting/blending each target.
        if (target) {
          target.curves++;
          inputs.push(snapshot._results[i]);
          outputs.push(target);
        }
      }
    }
    this._clips.push(clip);
    this._inputs.push(inputs);
    this._outputs.push(outputs);
  }

  /**
   * Remove a clip from the evaluator.
   *
   * @param {number} index - Index of the clip to remove.
   */
  removeClip(index) {
    const targets = this._targets;
    const binder = this._binder;
    const clips = this._clips;
    const clip = clips[index];
    const curves = clip.track.curves;
    for (let i = 0; i < curves.length; ++i) {
      const curve = curves[i];
      const paths = curve.paths;
      for (let j = 0; j < paths.length; ++j) {
        const path = paths[j];
        const target = this._binder.resolve(path);
        if (target) {
          target.curves--;
          if (target.curves === 0) {
            binder.unresolve(path);
            delete targets[target.targetPath];
            if (binder.animComponent) {
              binder.animComponent.targets[target.targetPath].layerCounter--;
            }
          }
        }
      }
    }
    clips.splice(index, 1);
    this._inputs.splice(index, 1);
    this._outputs.splice(index, 1);
  }

  /**
   * Remove all clips from the evaluator.
   */
  removeClips() {
    while (this._clips.length > 0) {
      this.removeClip(0);
    }
  }
  updateClipTrack(name, animTrack) {
    this._clips.forEach(clip => {
      if (clip.name.includes(name)) {
        clip.track = animTrack;
      }
    });
    this.rebind();
  }

  /**
   * Returns the first clip which matches the given name, or null if no such clip was found.
   *
   * @param {string} name - Name of the clip to find.
   * @returns {import('./anim-clip.js').AnimClip|null} - The clip with the given name or null if no such clip was found.
   */
  findClip(name) {
    const clips = this._clips;
    for (let i = 0; i < clips.length; ++i) {
      const clip = clips[i];
      if (clip.name === name) {
        return clip;
      }
    }
    return null;
  }
  rebind() {
    this._binder.rebind();
    this._targets = {};
    const clips = [...this.clips];
    this.removeClips();
    clips.forEach(clip => {
      this.addClip(clip);
    });
  }
  assignMask(mask) {
    return this._binder.assignMask(mask);
  }

  /**
   * Evaluator frame update function. All the attached {@link AnimClip}s are evaluated, blended
   * and the results set on the {@link AnimTarget}.
   *
   * @param {number} deltaTime - The amount of time that has passed since the last update, in
   * seconds.
   * @param {boolean} [outputAnimation] - Whether the evaluator should output the results of the
   * update to the bound animation targets.
   */
  update(deltaTime, outputAnimation = true) {
    // copy clips
    const clips = this._clips;

    // stable sort order
    const order = clips.map(function (c, i) {
      return i;
    });
    AnimBlend.stableSort(order, function (a, b) {
      return clips[a].blendOrder < clips[b].blendOrder;
    });
    for (let i = 0; i < order.length; ++i) {
      const index = order[i];
      const clip = clips[index];
      const inputs = this._inputs[index];
      const outputs = this._outputs[index];
      const blendWeight = clip.blendWeight;

      // update clip
      if (blendWeight > 0.0) {
        clip._update(deltaTime);
      }
      if (!outputAnimation) break;
      let input;
      let output;
      let value;
      if (blendWeight >= 1.0) {
        for (let j = 0; j < inputs.length; ++j) {
          input = inputs[j];
          output = outputs[j];
          value = output.value;
          AnimBlend.set(value, input, output.target.type);
          output.blendCounter++;
        }
      } else if (blendWeight > 0.0) {
        for (let j = 0; j < inputs.length; ++j) {
          input = inputs[j];
          output = outputs[j];
          value = output.value;
          if (output.blendCounter === 0) {
            AnimBlend.set(value, input, output.target.type);
          } else {
            AnimBlend.blend(value, input, blendWeight, output.target.type);
          }
          output.blendCounter++;
        }
      }
    }

    // apply result to anim targets
    const targets = this._targets;
    const binder = this._binder;
    for (const path in targets) {
      if (targets.hasOwnProperty(path)) {
        const target = targets[path];
        // if this evaluator is associated with an anim component then we should blend the result of this evaluator with all other anim layer's evaluators
        if (binder.animComponent && target.target.isTransform) {
          const animTarget = binder.animComponent.targets[path];
          if (animTarget.counter === animTarget.layerCounter) {
            animTarget.counter = 0;
          }
          if (!animTarget.path) {
            animTarget.path = path;
            animTarget.baseValue = target.target.get();
            animTarget.setter = target.target.set;
          }
          // Add this layer's value onto the target value
          animTarget.updateValue(binder.layerIndex, target.value);
          animTarget.counter++;
        } else {
          target.target.set(target.value);
        }
        target.blendCounter = 0;
      }
    }
    // give the binder an opportunity to update itself
    // TODO: is this even necessary? binder could know when to update
    // itself without our help.
    this._binder.update(deltaTime);
  }
}

export { AnimEvaluator };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1ldmFsdWF0b3IuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQW5pbVRhcmdldFZhbHVlIH0gZnJvbSAnLi9hbmltLXRhcmdldC12YWx1ZS5qcyc7XG5pbXBvcnQgeyBBbmltQmxlbmQgfSBmcm9tICcuL2FuaW0tYmxlbmQuanMnO1xuXG4vKipcbiAqIEFuaW1FdmFsdWF0b3IgYmxlbmRzIG11bHRpcGxlIHNldHMgb2YgYW5pbWF0aW9uIGNsaXBzIHRvZ2V0aGVyLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbUV2YWx1YXRvciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGFuaW1hdGlvbiBldmFsdWF0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYmluZGVyL2FuaW0tYmluZGVyLmpzJykuQW5pbUJpbmRlcn0gYmluZGVyIC0gaW50ZXJmYWNlIHJlc29sdmVzIGN1cnZlXG4gICAgICogcGF0aHMgdG8gaW5zdGFuY2VzIG9mIHtAbGluayBBbmltVGFyZ2V0fS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihiaW5kZXIpIHtcbiAgICAgICAgdGhpcy5fYmluZGVyID0gYmluZGVyO1xuICAgICAgICB0aGlzLl9jbGlwcyA9IFtdO1xuICAgICAgICB0aGlzLl9pbnB1dHMgPSBbXTtcbiAgICAgICAgdGhpcy5fb3V0cHV0cyA9IFtdO1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGxpc3Qgb2YgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9hbmltLWNsaXAuanMnKS5BbmltQ2xpcFtdfVxuICAgICAqL1xuICAgIGdldCBjbGlwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNsaXAgdG8gdGhlIGV2YWx1YXRvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2FuaW0tY2xpcC5qcycpLkFuaW1DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdG8gYWRkIHRvIHRoZSBldmFsdWF0b3IuXG4gICAgICovXG4gICAgYWRkQ2xpcChjbGlwKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSB0aGlzLl90YXJnZXRzO1xuICAgICAgICBjb25zdCBiaW5kZXIgPSB0aGlzLl9iaW5kZXI7XG5cbiAgICAgICAgLy8gc3RvcmUgbGlzdCBvZiBpbnB1dC9vdXRwdXQgYXJyYXlzXG4gICAgICAgIGNvbnN0IGN1cnZlcyA9IGNsaXAudHJhY2suY3VydmVzO1xuICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGNsaXAuc25hcHNob3Q7XG4gICAgICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgICAgICBjb25zdCBvdXRwdXRzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VydmVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJ2ZSA9IGN1cnZlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHBhdGhzID0gY3VydmUucGF0aHM7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBhdGhzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhzW2pdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYmluZGVyLnJlc29sdmUocGF0aCk7XG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldCA9IHRhcmdldHNbcmVzb2x2ZWQgJiYgcmVzb2x2ZWQudGFyZ2V0UGF0aCB8fCBudWxsXTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBuZXcgdGFyZ2V0IGlmIGl0IGRvZXNuJ3QgZXhpc3QgeWV0XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQgJiYgcmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiByZXNvbHZlZCwgICAgICAgICAgIC8vIHJlc29sdmVkIHRhcmdldCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFtdLCAgICAgICAgICAgICAgICAgIC8vIHN0b3JhZ2UgZm9yIGNhbGN1bGF0ZWQgdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnZlczogMCwgICAgICAgICAgICAgICAgICAvLyBudW1iZXIgb2YgY3VydmVzIGRyaXZpbmcgdGhpcyB0YXJnZXRcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsZW5kQ291bnRlcjogMCAgICAgICAgICAgICAvLyBwZXItZnJhbWUgbnVtYmVyIG9mIGJsZW5kcyAodXNlZCB0byBpZGVudGlmeSBmaXJzdCBibGVuZClcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHRhcmdldC50YXJnZXQuY29tcG9uZW50czsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQudmFsdWUucHVzaCgwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldHNbcmVzb2x2ZWQudGFyZ2V0UGF0aF0gPSB0YXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiaW5kZXIuYW5pbUNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFiaW5kZXIuYW5pbUNvbXBvbmVudC50YXJnZXRzW3Jlc29sdmVkLnRhcmdldFBhdGhdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHR5cGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc29sdmVkLnRhcmdldFBhdGguc3Vic3RyaW5nKHJlc29sdmVkLnRhcmdldFBhdGgubGVuZ3RoIC0gMTMpID09PSAnbG9jYWxSb3RhdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IEFuaW1UYXJnZXRWYWx1ZS5UWVBFX1FVQVQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IEFuaW1UYXJnZXRWYWx1ZS5UWVBFX1ZFQzM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRlci5hbmltQ29tcG9uZW50LnRhcmdldHNbcmVzb2x2ZWQudGFyZ2V0UGF0aF0gPSBuZXcgQW5pbVRhcmdldFZhbHVlKGJpbmRlci5hbmltQ29tcG9uZW50LCB0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRlci5hbmltQ29tcG9uZW50LnRhcmdldHNbcmVzb2x2ZWQudGFyZ2V0UGF0aF0ubGF5ZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kZXIuYW5pbUNvbXBvbmVudC50YXJnZXRzW3Jlc29sdmVkLnRhcmdldFBhdGhdLnNldE1hc2soYmluZGVyLmxheWVySW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYmluZGluZyBtYXkgaGF2ZSBmYWlsZWRcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBpdCBtYXkgYmUgd29ydGggc3RvcmluZyBxdWF0ZXJuaW9ucyBhbmQgdmVjdG9yIHRhcmdldHMgaW4gc2VwYXJhdGVcbiAgICAgICAgICAgICAgICAvLyBsaXN0cy4gdGhpcyB3YXkgdGhlIHVwZGF0ZSBjb2RlIHdvbid0IGJlIGZvcmNlZCB0byBjaGVjayB0YXJnZXQgdHlwZSBiZWZvcmVcbiAgICAgICAgICAgICAgICAvLyBzZXR0aW5nL2JsZW5kaW5nIGVhY2ggdGFyZ2V0LlxuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LmN1cnZlcysrO1xuICAgICAgICAgICAgICAgICAgICBpbnB1dHMucHVzaChzbmFwc2hvdC5fcmVzdWx0c1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dHMucHVzaCh0YXJnZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NsaXBzLnB1c2goY2xpcCk7XG4gICAgICAgIHRoaXMuX2lucHV0cy5wdXNoKGlucHV0cyk7XG4gICAgICAgIHRoaXMuX291dHB1dHMucHVzaChvdXRwdXRzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYSBjbGlwIGZyb20gdGhlIGV2YWx1YXRvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIHRoZSBjbGlwIHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVDbGlwKGluZGV4KSB7XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSB0aGlzLl90YXJnZXRzO1xuICAgICAgICBjb25zdCBiaW5kZXIgPSB0aGlzLl9iaW5kZXI7XG5cbiAgICAgICAgY29uc3QgY2xpcHMgPSB0aGlzLl9jbGlwcztcbiAgICAgICAgY29uc3QgY2xpcCA9IGNsaXBzW2luZGV4XTtcbiAgICAgICAgY29uc3QgY3VydmVzID0gY2xpcC50cmFjay5jdXJ2ZXM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJ2ZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnZlID0gY3VydmVzW2ldO1xuICAgICAgICAgICAgY29uc3QgcGF0aHMgPSBjdXJ2ZS5wYXRocztcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcGF0aHMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gcGF0aHNbal07XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLl9iaW5kZXIucmVzb2x2ZShwYXRoKTtcblxuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LmN1cnZlcy0tO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0LmN1cnZlcyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGVyLnVucmVzb2x2ZShwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0YXJnZXRzW3RhcmdldC50YXJnZXRQYXRoXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiaW5kZXIuYW5pbUNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRlci5hbmltQ29tcG9uZW50LnRhcmdldHNbdGFyZ2V0LnRhcmdldFBhdGhdLmxheWVyQ291bnRlci0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2xpcHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy5faW5wdXRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHRoaXMuX291dHB1dHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYWxsIGNsaXBzIGZyb20gdGhlIGV2YWx1YXRvci5cbiAgICAgKi9cbiAgICByZW1vdmVDbGlwcygpIHtcbiAgICAgICAgd2hpbGUgKHRoaXMuX2NsaXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQ2xpcCgwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNsaXBUcmFjayhuYW1lLCBhbmltVHJhY2spIHtcbiAgICAgICAgdGhpcy5fY2xpcHMuZm9yRWFjaCgoY2xpcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGNsaXAubmFtZS5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICAgICAgICAgIGNsaXAudHJhY2sgPSBhbmltVHJhY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlYmluZCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGZpcnN0IGNsaXAgd2hpY2ggbWF0Y2hlcyB0aGUgZ2l2ZW4gbmFtZSwgb3IgbnVsbCBpZiBubyBzdWNoIGNsaXAgd2FzIGZvdW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBjbGlwIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi9hbmltLWNsaXAuanMnKS5BbmltQ2xpcHxudWxsfSAtIFRoZSBjbGlwIHdpdGggdGhlIGdpdmVuIG5hbWUgb3IgbnVsbCBpZiBubyBzdWNoIGNsaXAgd2FzIGZvdW5kLlxuICAgICAqL1xuICAgIGZpbmRDbGlwKG5hbWUpIHtcbiAgICAgICAgY29uc3QgY2xpcHMgPSB0aGlzLl9jbGlwcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGlwcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY2xpcCA9IGNsaXBzW2ldO1xuICAgICAgICAgICAgaWYgKGNsaXAubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjbGlwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlYmluZCgpIHtcbiAgICAgICAgdGhpcy5fYmluZGVyLnJlYmluZCgpO1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgICAgIGNvbnN0IGNsaXBzID0gWy4uLnRoaXMuY2xpcHNdO1xuICAgICAgICB0aGlzLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgIGNsaXBzLmZvckVhY2goKGNsaXApID0+IHtcbiAgICAgICAgICAgIHRoaXMuYWRkQ2xpcChjbGlwKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXNzaWduTWFzayhtYXNrKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iaW5kZXIuYXNzaWduTWFzayhtYXNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFdmFsdWF0b3IgZnJhbWUgdXBkYXRlIGZ1bmN0aW9uLiBBbGwgdGhlIGF0dGFjaGVkIHtAbGluayBBbmltQ2xpcH1zIGFyZSBldmFsdWF0ZWQsIGJsZW5kZWRcbiAgICAgKiBhbmQgdGhlIHJlc3VsdHMgc2V0IG9uIHRoZSB7QGxpbmsgQW5pbVRhcmdldH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVsdGFUaW1lIC0gVGhlIGFtb3VudCBvZiB0aW1lIHRoYXQgaGFzIHBhc3NlZCBzaW5jZSB0aGUgbGFzdCB1cGRhdGUsIGluXG4gICAgICogc2Vjb25kcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvdXRwdXRBbmltYXRpb25dIC0gV2hldGhlciB0aGUgZXZhbHVhdG9yIHNob3VsZCBvdXRwdXQgdGhlIHJlc3VsdHMgb2YgdGhlXG4gICAgICogdXBkYXRlIHRvIHRoZSBib3VuZCBhbmltYXRpb24gdGFyZ2V0cy5cbiAgICAgKi9cbiAgICB1cGRhdGUoZGVsdGFUaW1lLCBvdXRwdXRBbmltYXRpb24gPSB0cnVlKSB7XG4gICAgICAgIC8vIGNvcHkgY2xpcHNcbiAgICAgICAgY29uc3QgY2xpcHMgPSB0aGlzLl9jbGlwcztcblxuICAgICAgICAvLyBzdGFibGUgc29ydCBvcmRlclxuICAgICAgICBjb25zdCBvcmRlciA9IGNsaXBzLm1hcChmdW5jdGlvbiAoYywgaSkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH0pO1xuICAgICAgICBBbmltQmxlbmQuc3RhYmxlU29ydChvcmRlciwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBjbGlwc1thXS5ibGVuZE9yZGVyIDwgY2xpcHNbYl0uYmxlbmRPcmRlcjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcmRlci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBvcmRlcltpXTtcbiAgICAgICAgICAgIGNvbnN0IGNsaXAgPSBjbGlwc1tpbmRleF07XG4gICAgICAgICAgICBjb25zdCBpbnB1dHMgPSB0aGlzLl9pbnB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgY29uc3Qgb3V0cHV0cyA9IHRoaXMuX291dHB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgYmxlbmRXZWlnaHQgPSBjbGlwLmJsZW5kV2VpZ2h0O1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgY2xpcFxuICAgICAgICAgICAgaWYgKGJsZW5kV2VpZ2h0ID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgY2xpcC5fdXBkYXRlKGRlbHRhVGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW91dHB1dEFuaW1hdGlvbikgYnJlYWs7XG5cbiAgICAgICAgICAgIGxldCBpbnB1dDtcbiAgICAgICAgICAgIGxldCBvdXRwdXQ7XG4gICAgICAgICAgICBsZXQgdmFsdWU7XG5cbiAgICAgICAgICAgIGlmIChibGVuZFdlaWdodCA+PSAxLjApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGlucHV0cy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dCA9IGlucHV0c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvdXRwdXQudmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgQW5pbUJsZW5kLnNldCh2YWx1ZSwgaW5wdXQsIG91dHB1dC50YXJnZXQudHlwZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0LmJsZW5kQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYmxlbmRXZWlnaHQgPiAwLjApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGlucHV0cy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dCA9IGlucHV0c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvdXRwdXQudmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG91dHB1dC5ibGVuZENvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEFuaW1CbGVuZC5zZXQodmFsdWUsIGlucHV0LCBvdXRwdXQudGFyZ2V0LnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgQW5pbUJsZW5kLmJsZW5kKHZhbHVlLCBpbnB1dCwgYmxlbmRXZWlnaHQsIG91dHB1dC50YXJnZXQudHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuYmxlbmRDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXBwbHkgcmVzdWx0IHRvIGFuaW0gdGFyZ2V0c1xuICAgICAgICBjb25zdCB0YXJnZXRzID0gdGhpcy5fdGFyZ2V0cztcbiAgICAgICAgY29uc3QgYmluZGVyID0gdGhpcy5fYmluZGVyO1xuICAgICAgICBmb3IgKGNvbnN0IHBhdGggaW4gdGFyZ2V0cykge1xuICAgICAgICAgICAgaWYgKHRhcmdldHMuaGFzT3duUHJvcGVydHkocGF0aCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRzW3BhdGhdO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZXZhbHVhdG9yIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBhbmltIGNvbXBvbmVudCB0aGVuIHdlIHNob3VsZCBibGVuZCB0aGUgcmVzdWx0IG9mIHRoaXMgZXZhbHVhdG9yIHdpdGggYWxsIG90aGVyIGFuaW0gbGF5ZXIncyBldmFsdWF0b3JzXG4gICAgICAgICAgICAgICAgaWYgKGJpbmRlci5hbmltQ29tcG9uZW50ICYmIHRhcmdldC50YXJnZXQuaXNUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5pbVRhcmdldCA9IGJpbmRlci5hbmltQ29tcG9uZW50LnRhcmdldHNbcGF0aF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChhbmltVGFyZ2V0LmNvdW50ZXIgPT09IGFuaW1UYXJnZXQubGF5ZXJDb3VudGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmltVGFyZ2V0LmNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghYW5pbVRhcmdldC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmltVGFyZ2V0LnBhdGggPSBwYXRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5pbVRhcmdldC5iYXNlVmFsdWUgPSB0YXJnZXQudGFyZ2V0LmdldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5pbVRhcmdldC5zZXR0ZXIgPSB0YXJnZXQudGFyZ2V0LnNldDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBBZGQgdGhpcyBsYXllcidzIHZhbHVlIG9udG8gdGhlIHRhcmdldCB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICBhbmltVGFyZ2V0LnVwZGF0ZVZhbHVlKGJpbmRlci5sYXllckluZGV4LCB0YXJnZXQudmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGFuaW1UYXJnZXQuY291bnRlcisrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC50YXJnZXQuc2V0KHRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRhcmdldC5ibGVuZENvdW50ZXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGdpdmUgdGhlIGJpbmRlciBhbiBvcHBvcnR1bml0eSB0byB1cGRhdGUgaXRzZWxmXG4gICAgICAgIC8vIFRPRE86IGlzIHRoaXMgZXZlbiBuZWNlc3Nhcnk/IGJpbmRlciBjb3VsZCBrbm93IHdoZW4gdG8gdXBkYXRlXG4gICAgICAgIC8vIGl0c2VsZiB3aXRob3V0IG91ciBoZWxwLlxuICAgICAgICB0aGlzLl9iaW5kZXIudXBkYXRlKGRlbHRhVGltZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltRXZhbHVhdG9yIH07XG4iXSwibmFtZXMiOlsiQW5pbUV2YWx1YXRvciIsImNvbnN0cnVjdG9yIiwiYmluZGVyIiwiX2JpbmRlciIsIl9jbGlwcyIsIl9pbnB1dHMiLCJfb3V0cHV0cyIsIl90YXJnZXRzIiwiY2xpcHMiLCJhZGRDbGlwIiwiY2xpcCIsInRhcmdldHMiLCJjdXJ2ZXMiLCJ0cmFjayIsInNuYXBzaG90IiwiaW5wdXRzIiwib3V0cHV0cyIsImkiLCJsZW5ndGgiLCJjdXJ2ZSIsInBhdGhzIiwiaiIsInBhdGgiLCJyZXNvbHZlZCIsInJlc29sdmUiLCJ0YXJnZXQiLCJ0YXJnZXRQYXRoIiwidmFsdWUiLCJibGVuZENvdW50ZXIiLCJrIiwiY29tcG9uZW50cyIsInB1c2giLCJhbmltQ29tcG9uZW50IiwidHlwZSIsInN1YnN0cmluZyIsIkFuaW1UYXJnZXRWYWx1ZSIsIlRZUEVfUVVBVCIsIlRZUEVfVkVDMyIsImxheWVyQ291bnRlciIsInNldE1hc2siLCJsYXllckluZGV4IiwiX3Jlc3VsdHMiLCJyZW1vdmVDbGlwIiwiaW5kZXgiLCJ1bnJlc29sdmUiLCJzcGxpY2UiLCJyZW1vdmVDbGlwcyIsInVwZGF0ZUNsaXBUcmFjayIsIm5hbWUiLCJhbmltVHJhY2siLCJmb3JFYWNoIiwiaW5jbHVkZXMiLCJyZWJpbmQiLCJmaW5kQ2xpcCIsImFzc2lnbk1hc2siLCJtYXNrIiwidXBkYXRlIiwiZGVsdGFUaW1lIiwib3V0cHV0QW5pbWF0aW9uIiwib3JkZXIiLCJtYXAiLCJjIiwiQW5pbUJsZW5kIiwic3RhYmxlU29ydCIsImEiLCJiIiwiYmxlbmRPcmRlciIsImJsZW5kV2VpZ2h0IiwiX3VwZGF0ZSIsImlucHV0Iiwib3V0cHV0Iiwic2V0IiwiYmxlbmQiLCJoYXNPd25Qcm9wZXJ0eSIsImlzVHJhbnNmb3JtIiwiYW5pbVRhcmdldCIsImNvdW50ZXIiLCJiYXNlVmFsdWUiLCJnZXQiLCJzZXR0ZXIiLCJ1cGRhdGVWYWx1ZSJdLCJtYXBwaW5ncyI6Ijs7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFO0lBQ2hCLElBQUksQ0FBQ0MsT0FBTyxHQUFHRCxNQUFNLENBQUE7SUFDckIsSUFBSSxDQUFDRSxNQUFNLEdBQUcsRUFBRSxDQUFBO0lBQ2hCLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQUNqQixJQUFJLENBQUNDLFFBQVEsR0FBRyxFQUFFLENBQUE7QUFDbEIsSUFBQSxJQUFJLENBQUNDLFFBQVEsR0FBRyxFQUFFLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsS0FBS0EsR0FBRztJQUNSLE9BQU8sSUFBSSxDQUFDSixNQUFNLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lLLE9BQU9BLENBQUNDLElBQUksRUFBRTtBQUNWLElBQUEsTUFBTUMsT0FBTyxH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
