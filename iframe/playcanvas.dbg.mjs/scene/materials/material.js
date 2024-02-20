import { Debug } from '../../core/debug.js';
import { CULLFACE_BACK, BLENDMODE_ONE, BLENDEQUATION_REVERSE_SUBTRACT, BLENDMODE_ZERO, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDEQUATION_MIN, BLENDEQUATION_MAX } from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, BLEND_SUBTRACTIVE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MULTIPLICATIVE, BLEND_MIN, BLEND_MAX } from '../constants.js';
import { processShader } from '../shader-lib/utils.js';
import { getDefaultMaterial } from './default-material.js';

// blend mode mapping to op, srcBlend and dstBlend
const blendModes = [];
blendModes[BLEND_SUBTRACTIVE] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_REVERSE_SUBTRACT
};
blendModes[BLEND_NONE] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ZERO,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_NORMAL] = {
  src: BLENDMODE_SRC_ALPHA,
  dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_PREMULTIPLIED] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVE] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVEALPHA] = {
  src: BLENDMODE_SRC_ALPHA,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE2X] = {
  src: BLENDMODE_DST_COLOR,
  dst: BLENDMODE_SRC_COLOR,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_SCREEN] = {
  src: BLENDMODE_ONE_MINUS_DST_COLOR,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE] = {
  src: BLENDMODE_DST_COLOR,
  dst: BLENDMODE_ZERO,
  op: BLENDEQUATION_ADD
};
blendModes[BLEND_MIN] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_MIN
};
blendModes[BLEND_MAX] = {
  src: BLENDMODE_ONE,
  dst: BLENDMODE_ONE,
  op: BLENDEQUATION_MAX
};
let id = 0;

/**
 * A material determines how a particular mesh instance is rendered. It specifies the shader and
 * render state that is set before the mesh instance is submitted to the graphics device.
 *
 * @category Graphics
 */
class Material {
  constructor() {
    /**
     * A shader used to render the material. Note that this is used only by materials where the
     * user specifies the shader. Most material types generate multiple shader variants, and do not
     * set this.
     *
     * @type {import('../../platform/graphics/shader.js').Shader}
     * @private
     */
    this._shader = null;
    /**
     * The mesh instances referencing this material
     *
     * @type {import('../mesh-instance.js').MeshInstance[]}
     * @private
     */
    this.meshInstances = [];
    /**
     * The name of the material.
     *
     * @type {string}
     */
    this.name = 'Untitled';
    /**
     * A unique id the user can assign to the material. The engine internally does not use this for
     * anything, and the user can assign a value to this id for any purpose they like. Defaults to
     * an empty string.
     *
     * @type {string}
     */
    this.userId = '';
    this.id = id++;
    /**
     * The cache of shader variants generated for this material. The key represents the unique
     * variant, the value is the shader.
     *
     * @type {Map<string, import('../../platform/graphics/shader.js').Shader>}
     * @ignore
     */
    this.variants = new Map();
    this.parameters = {};
    /**
     * The alpha test reference value to control which fragments are written to the currently
     * active render target based on alpha value. All fragments with an alpha value of less than
     * the alphaTest reference value will be discarded. alphaTest defaults to 0 (all fragments
     * pass).
     *
     * @type {number}
     */
    this.alphaTest = 0;
    /**
     * Enables or disables alpha to coverage (WebGL2 only). When enabled, and if hardware
     * anti-aliasing is on, limited order-independent transparency can be achieved. Quality depends
     * on the number of MSAA samples of the current render target. It can nicely soften edges of
     * otherwise sharp alpha cutouts, but isn't recommended for large area semi-transparent
     * surfaces. Note, that you don't need to enable blending to make alpha to coverage work. It
     * will work without it, just like alphaTest.
     *
     * @type {boolean}
     */
    this.alphaToCoverage = false;
    /** @ignore */
    this._blendState = new BlendState();
    /** @ignore */
    this._depthState = new DepthState();
    /**
     * Controls how triangles are culled based on their face direction with respect to the
     * viewpoint. Can be:
     *
     * - {@link CULLFACE_NONE}: Do not cull triangles based on face direction.
     * - {@link CULLFACE_BACK}: Cull the back faces of triangles (do not render triangles facing
     * away from the view point).
     * - {@link CULLFACE_FRONT}: Cull the front faces of triangles (do not render triangles facing
     * towards the view point).
     *
     * Defaults to {@link CULLFACE_BACK}.
     *
     * @type {number}
     */
    this.cull = CULLFACE_BACK;
    /**
     * Stencil parameters for front faces (default is null).
     *
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    this.stencilFront = null;
    /**
     * Stencil parameters for back faces (default is null).
     *
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    this.stencilBack = null;
    this._shaderVersion = 0;
    this._scene = null;
    this.dirty = true;
  }
  /**
   * Offsets the output depth buffer value. Useful for decals to prevent z-fighting. Typically
   * a small negative value (-0.1) is used to render the mesh slightly closer to the camera.
   *
   * @type {number}
   */
  set depthBias(value) {
    this._depthState.depthBias = value;
  }
  get depthBias() {
    return this._depthState.depthBias;
  }

  /**
   * Same as {@link Material#depthBias}, but also depends on the slope of the triangle relative
   * to the camera.
   *
   * @type {number}
   */
  set slopeDepthBias(value) {
    this._depthState.depthBiasSlope = value;
  }
  get slopeDepthBias() {
    return this._depthState.depthBiasSlope;
  }
  /**
   * If true, the red component of fragments generated by the shader of this material is written
   * to the color buffer of the currently active render target. If false, the red component will
   * not be written. Defaults to true.
   *
   * @type {boolean}
   */
  set redWrite(value) {
    this._blendState.redWrite = value;
  }
  get redWrite() {
    return this._blendState.redWrite;
  }

  /**
   * If true, the green component of fragments generated by the shader of this material is
   * written to the color buffer of the currently active render target. If false, the green
   * component will not be written. Defaults to true.
   *
   * @type {boolean}
   */
  set greenWrite(value) {
    this._blendState.greenWrite = value;
  }
  get greenWrite() {
    return this._blendState.greenWrite;
  }

  /**
   * If true, the blue component of fragments generated by the shader of this material is
   * written to the color buffer of the currently active render target. If false, the blue
   * component will not be written. Defaults to true.
   *
   * @type {boolean}
   */
  set blueWrite(value) {
    this._blendState.blueWrite = value;
  }
  get blueWrite() {
    return this._blendState.blueWrite;
  }

  /**
   * If true, the alpha component of fragments generated by the shader of this material is
   * written to the color buffer of the currently active render target. If false, the alpha
   * component will not be written. Defaults to true.
   *
   * @type {boolean}
   */
  set alphaWrite(value) {
    this._blendState.alphaWrite = value;
  }
  get alphaWrite() {
    return this._blendState.alphaWrite;
  }

  /**
   * The shader used by this material to render mesh instances (default is null).
   *
   * @type {import('../../platform/graphics/shader.js').Shader|null}
   */
  set shader(shader) {
    this._shader = shader;
  }
  get shader() {
    return this._shader;
  }

  // returns boolean depending on material being transparent
  get transparent() {
    return this._blendState.blend;
  }
  _updateTransparency() {
    const transparent = this.transparent;
    const meshInstances = this.meshInstances;
    for (let i = 0; i < meshInstances.length; i++) {
      meshInstances[i].transparent = transparent;
    }
  }

  /**
   * Controls how fragment shader outputs are blended when being written to the currently active
   * render target. This overwrites blending type set using {@link Material#blendType}, and
   * offers more control over blending.
   *
   * @type { BlendState }
   */
  set blendState(value) {
    this._blendState.copy(value);
    this._updateTransparency();
  }
  get blendState() {
    return this._blendState;
  }

  /**
   * Controls how fragment shader outputs are blended when being written to the currently active
   * render target. Can be:
   *
   * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
   * fragment and write the result to the frame buffer.
   * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment
   * and write the result to the frame buffer.
   * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
   * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
   * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
   * - {@link BLEND_NONE}: Disable blending.
   * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect the source fragment is
   * assumed to have already been multiplied by the source alpha value.
   * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
   * destination fragment and write the result to the frame buffer.
   * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except the source RGB is
   * multiplied by the source alpha.
   * - {@link BLEND_MULTIPLICATIVE2X}: Multiplies colors and doubles the result.
   * - {@link BLEND_SCREEN}: Softer version of additive.
   * - {@link BLEND_MIN}: Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
   * - {@link BLEND_MAX}: Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
   *
   * Defaults to {@link BLEND_NONE}.
   *
   * @type {number}
   */
  set blendType(type) {
    const blendMode = blendModes[type];
    Debug.assert(blendMode, `Unknown blend mode ${type}`);
    this._blendState.setColorBlend(blendMode.op, blendMode.src, blendMode.dst);
    this._blendState.setAlphaBlend(blendMode.op, blendMode.src, blendMode.dst);
    const blend = type !== BLEND_NONE;
    if (this._blendState.blend !== blend) {
      this._blendState.blend = blend;
      this._updateTransparency();
    }
    this._updateMeshInstanceKeys();
  }
  get blendType() {
    if (!this.transparent) {
      return BLEND_NONE;
    }
    const {
      colorOp,
      colorSrcFactor,
      colorDstFactor,
      alphaOp,
      alphaSrcFactor,
      alphaDstFactor
    } = this._blendState;
    for (let i = 0; i < blendModes.length; i++) {
      const blendMode = blendModes[i];
      if (blendMode.src === colorSrcFactor && blendMode.dst === colorDstFactor && blendMode.op === colorOp && blendMode.src === alphaSrcFactor && blendMode.dst === alphaDstFactor && blendMode.op === alphaOp) {
        return i;
      }
    }
    return BLEND_NORMAL;
  }

  /**
   * Sets the depth state. Note that this can also be done by using {@link Material#depthTest},
   * {@link Material#depthFunc} and {@link Material#depthWrite}.
   *
   * @type { DepthState }
   */
  set depthState(value) {
    this._depthState.copy(value);
  }
  get depthState() {
    return this._depthState;
  }

  /**
   * If true, fragments generated by the shader of this material are only written to the current
   * render target if they pass the depth test. If false, fragments generated by the shader of
   * this material are written to the current render target regardless of what is in the depth
   * buffer. Defaults to true.
   *
   * @type {boolean}
   */
  set depthTest(value) {
    this._depthState.test = value;
  }
  get depthTest() {
    return this._depthState.test;
  }

  /**
   * Controls how the depth of new fragments is compared against the current depth contained in
   * the depth buffer. Can be:
   *
   * - {@link FUNC_NEVER}: don't draw
   * - {@link FUNC_LESS}: draw if new depth < depth buffer
   * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
   * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
   * - {@link FUNC_GREATER}: draw if new depth > depth buffer
   * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
   * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
   * - {@link FUNC_ALWAYS}: always draw
   *
   * Defaults to {@link FUNC_LESSEQUAL}.
   *
   * @type {number}
   */
  set depthFunc(value) {
    this._depthState.func = value;
  }
  get depthFunc() {
    return this._depthState.func;
  }

  /**
   * If true, fragments generated by the shader of this material write a depth value to the depth
   * buffer of the currently active render target. If false, no depth value is written. Defaults
   * to true.
   *
   * @type {boolean}
   */
  set depthWrite(value) {
    this._depthState.write = value;
  }
  get depthWrite() {
    return this._depthState.write;
  }

  /**
   * Copy a material.
   *
   * @param {Material} source - The material to copy.
   * @returns {Material} The destination material.
   */
  copy(source) {
    var _source$stencilFront;
    this.name = source.name;
    this._shader = source._shader;

    // Render states
    this.alphaTest = source.alphaTest;
    this.alphaToCoverage = source.alphaToCoverage;
    this._blendState.copy(source._blendState);
    this._depthState.copy(source._depthState);
    this.cull = source.cull;
    this.stencilFront = (_source$stencilFront = source.stencilFront) == null ? void 0 : _source$stencilFront.clone();
    if (source.stencilBack) {
      this.stencilBack = source.stencilFront === source.stencilBack ? this.stencilFront : source.stencilBack.clone();
    }
    return this;
  }

  /**
   * Clone a material.
   *
   * @returns {this} A newly cloned material.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
  _updateMeshInstanceKeys() {
    const meshInstances = this.meshInstances;
    for (let i = 0; i < meshInstances.length; i++) {
      meshInstances[i].updateKey();
    }
  }
  updateUniforms(device, scene) {}

  // TODO: unused parameter should be removed, but the Editor still uses this function
  getShaderVariant(device, scene, objDefs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
    // generate shader variant - its the same shader, but with different processing options
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
    return processShader(this._shader, processingOptions);
  }

  /**
   * Applies any changes made to the material's properties.
   */
  update() {
    this.dirty = true;
    if (this._shader) this._shader.failed = false;
  }

  // Parameter management
  clearParameters() {
    this.parameters = {};
  }
  getParameters() {
    return this.parameters;
  }
  clearVariants() {
    // clear variants on the material
    this.variants.clear();

    // but also clear them from all materials that reference them
    const meshInstances = this.meshInstances;
    const count = meshInstances.length;
    for (let i = 0; i < count; i++) {
      meshInstances[i].clearShaders();
    }
  }

  /**
   * Retrieves the specified shader parameter from a material.
   *
   * @param {string} name - The name of the parameter to query.
   * @returns {object} The named parameter.
   */
  getParameter(name) {
    return this.parameters[name];
  }

  /**
   * Sets a shader parameter on a material.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number|number[]|Float32Array|import('../../platform/graphics/texture.js').Texture} data -
   * The value for the specified parameter.
   */
  setParameter(name, data) {
    if (data === undefined && typeof name === 'object') {
      const uniformObject = name;
      if (uniformObject.length) {
        for (let i = 0; i < uniformObject.length; i++) {
          this.setParameter(uniformObject[i]);
        }
        return;
      }
      name = uniformObject.name;
      data = uniformObject.value;
    }
    const param = this.parameters[name];
    if (param) {
      param.data = data;
    } else {
      this.parameters[name] = {
        scopeId: null,
        data: data
      };
    }
  }

  /**
   * Deletes a shader parameter on a material.
   *
   * @param {string} name - The name of the parameter to delete.
   */
  deleteParameter(name) {
    if (this.parameters[name]) {
      delete this.parameters[name];
    }
  }

  // used to apply parameters from this material into scope of uniforms, called internally by forward-renderer
  // optional list of parameter names to be set can be specified, otherwise all parameters are set
  setParameters(device, names) {
    const parameters = this.parameters;
    if (names === undefined) names = parameters;
    for (const paramName in names) {
      const parameter = parameters[paramName];
      if (parameter) {
        if (!parameter.scopeId) {
          parameter.scopeId = device.scope.resolve(paramName);
        }
        parameter.scopeId.setValue(parameter.data);
      }
    }
  }

  /**
   * Removes this material from the scene and possibly frees up memory from its shaders (if there
   * are no other materials using it).
   */
  destroy() {
    this.variants.clear();
    this._shader = null;
    for (let i = 0; i < this.meshInstances.length; i++) {
      const meshInstance = this.meshInstances[i];
      meshInstance.clearShaders();
      meshInstance._material = null;
      if (meshInstance.mesh) {
        const defaultMaterial = getDefaultMaterial(meshInstance.mesh.device);
        if (this !== defaultMaterial) {
          meshInstance.material = defaultMaterial;
        }
      } else {
        Debug.warn('pc.Material: MeshInstance.mesh is null, default material cannot be assigned to the MeshInstance');
      }
    }
    this.meshInstances.length = 0;
  }

  /**
   * Registers mesh instance as referencing the material.
   *
   * @param {import('../mesh-instance.js').MeshInstance} meshInstance - The mesh instance to
   * de-register.
   * @ignore
   */
  addMeshInstanceRef(meshInstance) {
    this.meshInstances.push(meshInstance);
  }

  /**
   * De-registers mesh instance as referencing the material.
   *
   * @param {import('../mesh-instance.js').MeshInstance} meshInstance - The mesh instance to
   * de-register.
   * @ignore
   */
  removeMeshInstanceRef(meshInstance) {
    const meshInstances = this.meshInstances;
    const i = meshInstances.indexOf(meshInstance);
    if (i !== -1) {
      meshInstances.splice(i, 1);
    }
  }
}

export { Material };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSwgQkxFTkRNT0RFX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfRFNUX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiwgQkxFTkRNT0RFX1NSQ19BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCwgQkxFTkRFUVVBVElPTl9SRVZFUlNFX1NVQlRSQUNULFxuICAgIEJMRU5ERVFVQVRJT05fTUlOLCBCTEVOREVRVUFUSU9OX01BWCxcbiAgICBDVUxMRkFDRV9CQUNLXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlcHRoLXN0YXRlLmpzJztcbmltcG9ydCB7IFNoYWRlclByb2Nlc3Nvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX0FERElUSVZFLCBCTEVORF9OT1JNQUwsIEJMRU5EX05PTkUsIEJMRU5EX1BSRU1VTFRJUExJRUQsXG4gICAgQkxFTkRfTVVMVElQTElDQVRJVkUsIEJMRU5EX0FERElUSVZFQUxQSEEsIEJMRU5EX01VTFRJUExJQ0FUSVZFMlgsIEJMRU5EX1NDUkVFTixcbiAgICBCTEVORF9NSU4sIEJMRU5EX01BWCwgQkxFTkRfU1VCVFJBQ1RJVkVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHByb2Nlc3NTaGFkZXIgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4vZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbi8vIGJsZW5kIG1vZGUgbWFwcGluZyB0byBvcCwgc3JjQmxlbmQgYW5kIGRzdEJsZW5kXG5jb25zdCBibGVuZE1vZGVzID0gW107XG5ibGVuZE1vZGVzW0JMRU5EX1NVQlRSQUNUSVZFXSA9IHsgc3JjOiBCTEVORE1PREVfT05FLCBkc3Q6IEJMRU5ETU9ERV9PTkUsIG9wOiBCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1QgfTtcbmJsZW5kTW9kZXNbQkxFTkRfTk9ORV0gPSB7IHNyYzogQkxFTkRNT0RFX09ORSwgZHN0OiBCTEVORE1PREVfWkVSTywgb3A6IEJMRU5ERVFVQVRJT05fQUREIH07XG5ibGVuZE1vZGVzW0JMRU5EX05PUk1BTF0gPSB7IHNyYzogQkxFTkRNT0RFX1NSQ19BTFBIQSwgZHN0OiBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSwgb3A6IEJMRU5ERVFVQVRJT05fQUREIH07XG5ibGVuZE1vZGVzW0JMRU5EX1BSRU1VTFRJUExJRURdID0geyBzcmM6IEJMRU5ETU9ERV9PTkUsIGRzdDogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsIG9wOiBCTEVOREVRVUFUSU9OX0FERCB9O1xuYmxlbmRNb2Rlc1tCTEVORF9BRERJVElWRV0gPSB7IHNyYzogQkxFTkRNT0RFX09ORSwgZHN0OiBCTEVORE1PREVfT05FLCBvcDogQkxFTkRFUVVBVElPTl9BREQgfTtcbmJsZW5kTW9kZXNbQkxFTkRfQURESVRJVkVBTFBIQV0gPSB7IHNyYzogQkxFTkRNT0RFX1NSQ19BTFBIQSwgZHN0OiBCTEVORE1PREVfT05FLCBvcDogQkxFTkRFUVVBVElPTl9BREQgfTtcbmJsZW5kTW9kZXNbQkxFTkRfTVVMVElQTElDQVRJVkUyWF0gPSB7IHNyYzogQkxFTkRNT0RFX0RTVF9DT0xPUiwgZHN0OiBCTEVORE1PREVfU1JDX0NPTE9SLCBvcDogQkxFTkRFUVVBVElPTl9BREQgfTtcbmJsZW5kTW9kZXNbQkxFTkRfU0NSRUVOXSA9IHsgc3JjOiBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiwgZHN0OiBCTEVORE1PREVfT05FLCBvcDogQkxFTkRFUVVBVElPTl9BREQgfTtcbmJsZW5kTW9kZXNbQkxFTkRfTVVMVElQTElDQVRJVkVdID0geyBzcmM6IEJMRU5ETU9ERV9EU1RfQ09MT1IsIGRzdDogQkxFTkRNT0RFX1pFUk8sIG9wOiBCTEVOREVRVUFUSU9OX0FERCB9O1xuYmxlbmRNb2Rlc1tCTEVORF9NSU5dID0geyBzcmM6IEJMRU5ETU9ERV9PTkUsIGRzdDogQkxFTkRNT0RFX09ORSwgb3A6IEJMRU5ERVFVQVRJT05fTUlOIH07XG5ibGVuZE1vZGVzW0JMRU5EX01BWF0gPSB7IHNyYzogQkxFTkRNT0RFX09ORSwgZHN0OiBCTEVORE1PREVfT05FLCBvcDogQkxFTkRFUVVBVElPTl9NQVggfTtcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIG1hdGVyaWFsIGRldGVybWluZXMgaG93IGEgcGFydGljdWxhciBtZXNoIGluc3RhbmNlIGlzIHJlbmRlcmVkLiBJdCBzcGVjaWZpZXMgdGhlIHNoYWRlciBhbmRcbiAqIHJlbmRlciBzdGF0ZSB0aGF0IGlzIHNldCBiZWZvcmUgdGhlIG1lc2ggaW5zdGFuY2UgaXMgc3VibWl0dGVkIHRvIHRoZSBncmFwaGljcyBkZXZpY2UuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIE1hdGVyaWFsIHtcbiAgICAvKipcbiAgICAgKiBBIHNoYWRlciB1c2VkIHRvIHJlbmRlciB0aGUgbWF0ZXJpYWwuIE5vdGUgdGhhdCB0aGlzIGlzIHVzZWQgb25seSBieSBtYXRlcmlhbHMgd2hlcmUgdGhlXG4gICAgICogdXNlciBzcGVjaWZpZXMgdGhlIHNoYWRlci4gTW9zdCBtYXRlcmlhbCB0eXBlcyBnZW5lcmF0ZSBtdWx0aXBsZSBzaGFkZXIgdmFyaWFudHMsIGFuZCBkbyBub3RcbiAgICAgKiBzZXQgdGhpcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcycpLlNoYWRlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1lc2ggaW5zdGFuY2VzIHJlZmVyZW5jaW5nIHRoaXMgbWF0ZXJpYWxcbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG1lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgbmFtZSA9ICdVbnRpdGxlZCc7XG5cbiAgICAvKipcbiAgICAgKiBBIHVuaXF1ZSBpZCB0aGUgdXNlciBjYW4gYXNzaWduIHRvIHRoZSBtYXRlcmlhbC4gVGhlIGVuZ2luZSBpbnRlcm5hbGx5IGRvZXMgbm90IHVzZSB0aGlzIGZvclxuICAgICAqIGFueXRoaW5nLCBhbmQgdGhlIHVzZXIgY2FuIGFzc2lnbiBhIHZhbHVlIHRvIHRoaXMgaWQgZm9yIGFueSBwdXJwb3NlIHRoZXkgbGlrZS4gRGVmYXVsdHMgdG9cbiAgICAgKiBhbiBlbXB0eSBzdHJpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVzZXJJZCA9ICcnO1xuXG4gICAgaWQgPSBpZCsrO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhY2hlIG9mIHNoYWRlciB2YXJpYW50cyBnZW5lcmF0ZWQgZm9yIHRoaXMgbWF0ZXJpYWwuIFRoZSBrZXkgcmVwcmVzZW50cyB0aGUgdW5pcXVlXG4gICAgICogdmFyaWFudCwgdGhlIHZhbHVlIGlzIHRoZSBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWFwPHN0cmluZywgaW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXI+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB2YXJpYW50cyA9IG5ldyBNYXAoKTtcblxuICAgIHBhcmFtZXRlcnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhbHBoYSB0ZXN0IHJlZmVyZW5jZSB2YWx1ZSB0byBjb250cm9sIHdoaWNoIGZyYWdtZW50cyBhcmUgd3JpdHRlbiB0byB0aGUgY3VycmVudGx5XG4gICAgICogYWN0aXZlIHJlbmRlciB0YXJnZXQgYmFzZWQgb24gYWxwaGEgdmFsdWUuIEFsbCBmcmFnbWVudHMgd2l0aCBhbiBhbHBoYSB2YWx1ZSBvZiBsZXNzIHRoYW5cbiAgICAgKiB0aGUgYWxwaGFUZXN0IHJlZmVyZW5jZSB2YWx1ZSB3aWxsIGJlIGRpc2NhcmRlZC4gYWxwaGFUZXN0IGRlZmF1bHRzIHRvIDAgKGFsbCBmcmFnbWVudHNcbiAgICAgKiBwYXNzKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYWxwaGFUZXN0ID0gMDtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgYWxwaGEgdG8gY292ZXJhZ2UgKFdlYkdMMiBvbmx5KS4gV2hlbiBlbmFibGVkLCBhbmQgaWYgaGFyZHdhcmVcbiAgICAgKiBhbnRpLWFsaWFzaW5nIGlzIG9uLCBsaW1pdGVkIG9yZGVyLWluZGVwZW5kZW50IHRyYW5zcGFyZW5jeSBjYW4gYmUgYWNoaWV2ZWQuIFF1YWxpdHkgZGVwZW5kc1xuICAgICAqIG9uIHRoZSBudW1iZXIgb2YgTVNBQSBzYW1wbGVzIG9mIHRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQuIEl0IGNhbiBuaWNlbHkgc29mdGVuIGVkZ2VzIG9mXG4gICAgICogb3RoZXJ3aXNlIHNoYXJwIGFscGhhIGN1dG91dHMsIGJ1dCBpc24ndCByZWNvbW1lbmRlZCBmb3IgbGFyZ2UgYXJlYSBzZW1pLXRyYW5zcGFyZW50XG4gICAgICogc3VyZmFjZXMuIE5vdGUsIHRoYXQgeW91IGRvbid0IG5lZWQgdG8gZW5hYmxlIGJsZW5kaW5nIHRvIG1ha2UgYWxwaGEgdG8gY292ZXJhZ2Ugd29yay4gSXRcbiAgICAgKiB3aWxsIHdvcmsgd2l0aG91dCBpdCwganVzdCBsaWtlIGFscGhhVGVzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBfYmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIF9kZXB0aFN0YXRlID0gbmV3IERlcHRoU3RhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0cmlhbmdsZXMgYXJlIGN1bGxlZCBiYXNlZCBvbiB0aGVpciBmYWNlIGRpcmVjdGlvbiB3aXRoIHJlc3BlY3QgdG8gdGhlXG4gICAgICogdmlld3BvaW50LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9OT05FfTogRG8gbm90IGN1bGwgdHJpYW5nbGVzIGJhc2VkIG9uIGZhY2UgZGlyZWN0aW9uLlxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0JBQ0t9OiBDdWxsIHRoZSBiYWNrIGZhY2VzIG9mIHRyaWFuZ2xlcyAoZG8gbm90IHJlbmRlciB0cmlhbmdsZXMgZmFjaW5nXG4gICAgICogYXdheSBmcm9tIHRoZSB2aWV3IHBvaW50KS5cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVH06IEN1bGwgdGhlIGZyb250IGZhY2VzIG9mIHRyaWFuZ2xlcyAoZG8gbm90IHJlbmRlciB0cmlhbmdsZXMgZmFjaW5nXG4gICAgICogdG93YXJkcyB0aGUgdmlldyBwb2ludCkuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQ1VMTEZBQ0VfQkFDS30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuXG4gICAgLyoqXG4gICAgICogU3RlbmNpbCBwYXJhbWV0ZXJzIGZvciBmcm9udCBmYWNlcyAoZGVmYXVsdCBpcyBudWxsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3N0ZW5jaWwtcGFyYW1ldGVycy5qcycpLlN0ZW5jaWxQYXJhbWV0ZXJzfG51bGx9XG4gICAgICovXG4gICAgc3RlbmNpbEZyb250ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFN0ZW5jaWwgcGFyYW1ldGVycyBmb3IgYmFjayBmYWNlcyAoZGVmYXVsdCBpcyBudWxsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3N0ZW5jaWwtcGFyYW1ldGVycy5qcycpLlN0ZW5jaWxQYXJhbWV0ZXJzfG51bGx9XG4gICAgICovXG4gICAgc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogT2Zmc2V0cyB0aGUgb3V0cHV0IGRlcHRoIGJ1ZmZlciB2YWx1ZS4gVXNlZnVsIGZvciBkZWNhbHMgdG8gcHJldmVudCB6LWZpZ2h0aW5nLiBUeXBpY2FsbHlcbiAgICAgKiBhIHNtYWxsIG5lZ2F0aXZlIHZhbHVlICgtMC4xKSBpcyB1c2VkIHRvIHJlbmRlciB0aGUgbWVzaCBzbGlnaHRseSBjbG9zZXIgdG8gdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRlcHRoQmlhcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZXB0aFN0YXRlLmRlcHRoQmlhcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBkZXB0aEJpYXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aFN0YXRlLmRlcHRoQmlhcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTYW1lIGFzIHtAbGluayBNYXRlcmlhbCNkZXB0aEJpYXN9LCBidXQgYWxzbyBkZXBlbmRzIG9uIHRoZSBzbG9wZSBvZiB0aGUgdHJpYW5nbGUgcmVsYXRpdmVcbiAgICAgKiB0byB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2xvcGVEZXB0aEJpYXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGVwdGhTdGF0ZS5kZXB0aEJpYXNTbG9wZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzbG9wZURlcHRoQmlhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoU3RhdGUuZGVwdGhCaWFzU2xvcGU7XG4gICAgfVxuXG4gICAgX3NoYWRlclZlcnNpb24gPSAwO1xuXG4gICAgX3NjZW5lID0gbnVsbDtcblxuICAgIGRpcnR5ID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSByZWQgY29tcG9uZW50IG9mIGZyYWdtZW50cyBnZW5lcmF0ZWQgYnkgdGhlIHNoYWRlciBvZiB0aGlzIG1hdGVyaWFsIGlzIHdyaXR0ZW5cbiAgICAgKiB0byB0aGUgY29sb3IgYnVmZmVyIG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIHJlbmRlciB0YXJnZXQuIElmIGZhbHNlLCB0aGUgcmVkIGNvbXBvbmVudCB3aWxsXG4gICAgICogbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgcmVkV3JpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYmxlbmRTdGF0ZS5yZWRXcml0ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCByZWRXcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JsZW5kU3RhdGUucmVkV3JpdGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGdyZWVuIGNvbXBvbmVudCBvZiBmcmFnbWVudHMgZ2VuZXJhdGVkIGJ5IHRoZSBzaGFkZXIgb2YgdGhpcyBtYXRlcmlhbCBpc1xuICAgICAqIHdyaXR0ZW4gdG8gdGhlIGNvbG9yIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBJZiBmYWxzZSwgdGhlIGdyZWVuXG4gICAgICogY29tcG9uZW50IHdpbGwgbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZ3JlZW5Xcml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9ibGVuZFN0YXRlLmdyZWVuV3JpdGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZ3JlZW5Xcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JsZW5kU3RhdGUuZ3JlZW5Xcml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgYmx1ZSBjb21wb25lbnQgb2YgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mIHRoaXMgbWF0ZXJpYWwgaXNcbiAgICAgKiB3cml0dGVuIHRvIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgZmFsc2UsIHRoZSBibHVlXG4gICAgICogY29tcG9uZW50IHdpbGwgbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgYmx1ZVdyaXRlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2JsZW5kU3RhdGUuYmx1ZVdyaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGJsdWVXcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JsZW5kU3RhdGUuYmx1ZVdyaXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBhbHBoYSBjb21wb25lbnQgb2YgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mIHRoaXMgbWF0ZXJpYWwgaXNcbiAgICAgKiB3cml0dGVuIHRvIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgZmFsc2UsIHRoZSBhbHBoYVxuICAgICAqIGNvbXBvbmVudCB3aWxsIG5vdCBiZSB3cml0dGVuLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGFscGhhV3JpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYmxlbmRTdGF0ZS5hbHBoYVdyaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFscGhhV3JpdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ibGVuZFN0YXRlLmFscGhhV3JpdGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNoYWRlciB1c2VkIGJ5IHRoaXMgbWF0ZXJpYWwgdG8gcmVuZGVyIG1lc2ggaW5zdGFuY2VzIChkZWZhdWx0IGlzIG51bGwpLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IHNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgdGhpcy5fc2hhZGVyID0gc2hhZGVyO1xuICAgIH1cblxuICAgIGdldCBzaGFkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkZXI7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBib29sZWFuIGRlcGVuZGluZyBvbiBtYXRlcmlhbCBiZWluZyB0cmFuc3BhcmVudFxuICAgIGdldCB0cmFuc3BhcmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JsZW5kU3RhdGUuYmxlbmQ7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zcGFyZW5jeSgpIHtcbiAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnRyYW5zcGFyZW50O1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5tZXNoSW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0udHJhbnNwYXJlbnQgPSB0cmFuc3BhcmVudDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyBmcmFnbWVudCBzaGFkZXIgb3V0cHV0cyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseSBhY3RpdmVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBUaGlzIG92ZXJ3cml0ZXMgYmxlbmRpbmcgdHlwZSBzZXQgdXNpbmcge0BsaW5rIE1hdGVyaWFsI2JsZW5kVHlwZX0sIGFuZFxuICAgICAqIG9mZmVycyBtb3JlIGNvbnRyb2wgb3ZlciBibGVuZGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHsgQmxlbmRTdGF0ZSB9XG4gICAgICovXG4gICAgc2V0IGJsZW5kU3RhdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYmxlbmRTdGF0ZS5jb3B5KHZhbHVlKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbmN5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGJsZW5kU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ibGVuZFN0YXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyBmcmFnbWVudCBzaGFkZXIgb3V0cHV0cyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseSBhY3RpdmVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gICAgICogZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiAtIHtAbGluayBCTEVORF9BRERJVElWRX06IEFkZCB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCB0byB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnRcbiAgICAgKiBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX05PUk1BTH06IEVuYWJsZSBzaW1wbGUgdHJhbnNsdWNlbmN5IGZvciBtYXRlcmlhbHMgc3VjaCBhcyBnbGFzcy4gVGhpcyBpc1xuICAgICAqIGVxdWl2YWxlbnQgdG8gZW5hYmxpbmcgYSBzb3VyY2UgYmxlbmQgbW9kZSBvZiB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX0gYW5kIGEgZGVzdGluYXRpb25cbiAgICAgKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gICAgICogLSB7QGxpbmsgQkxFTkRfTk9ORX06IERpc2FibGUgYmxlbmRpbmcuXG4gICAgICogLSB7QGxpbmsgQkxFTkRfUFJFTVVMVElQTElFRH06IFNpbWlsYXIgdG8ge0BsaW5rIEJMRU5EX05PUk1BTH0gZXhwZWN0IHRoZSBzb3VyY2UgZnJhZ21lbnQgaXNcbiAgICAgKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAgICAgKiAtIHtAbGluayBCTEVORF9NVUxUSVBMSUNBVElWRX06IE11bHRpcGx5IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGJ5IHRoZSBjb2xvciBvZiB0aGVcbiAgICAgKiBkZXN0aW5hdGlvbiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gICAgICogbXVsdGlwbGllZCBieSB0aGUgc291cmNlIGFscGhhLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFMlh9OiBNdWx0aXBsaWVzIGNvbG9ycyBhbmQgZG91YmxlcyB0aGUgcmVzdWx0LlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX1NDUkVFTn06IFNvZnRlciB2ZXJzaW9uIG9mIGFkZGl0aXZlLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX01JTn06IE1pbmltdW0gY29sb3IuIENoZWNrIGFwcC5ncmFwaGljc0RldmljZS5leHRCbGVuZE1pbm1heCBmb3Igc3VwcG9ydC5cbiAgICAgKiAtIHtAbGluayBCTEVORF9NQVh9OiBNYXhpbXVtIGNvbG9yLiBDaGVjayBhcHAuZ3JhcGhpY3NEZXZpY2UuZXh0QmxlbmRNaW5tYXggZm9yIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQkxFTkRfTk9ORX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBibGVuZFR5cGUodHlwZSkge1xuXG4gICAgICAgIGNvbnN0IGJsZW5kTW9kZSA9IGJsZW5kTW9kZXNbdHlwZV07XG4gICAgICAgIERlYnVnLmFzc2VydChibGVuZE1vZGUsIGBVbmtub3duIGJsZW5kIG1vZGUgJHt0eXBlfWApO1xuICAgICAgICB0aGlzLl9ibGVuZFN0YXRlLnNldENvbG9yQmxlbmQoYmxlbmRNb2RlLm9wLCBibGVuZE1vZGUuc3JjLCBibGVuZE1vZGUuZHN0KTtcbiAgICAgICAgdGhpcy5fYmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGJsZW5kTW9kZS5vcCwgYmxlbmRNb2RlLnNyYywgYmxlbmRNb2RlLmRzdCk7XG5cbiAgICAgICAgY29uc3QgYmxlbmQgPSB0eXBlICE9PSBCTEVORF9OT05FO1xuICAgICAgICBpZiAodGhpcy5fYmxlbmRTdGF0ZS5ibGVuZCAhPT0gYmxlbmQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JsZW5kU3RhdGUuYmxlbmQgPSBibGVuZDtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW5jeSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1lc2hJbnN0YW5jZUtleXMoKTtcbiAgICB9XG5cbiAgICBnZXQgYmxlbmRUeXBlKCkge1xuICAgICAgICBpZiAoIXRoaXMudHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBCTEVORF9OT05FO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBjb2xvck9wLCBjb2xvclNyY0ZhY3RvciwgY29sb3JEc3RGYWN0b3IsIGFscGhhT3AsIGFscGhhU3JjRmFjdG9yLCBhbHBoYURzdEZhY3RvciB9ID0gdGhpcy5fYmxlbmRTdGF0ZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJsZW5kTW9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJsZW5kTW9kZSA9IGJsZW5kTW9kZXNbaV07XG4gICAgICAgICAgICBpZiAoYmxlbmRNb2RlLnNyYyA9PT0gY29sb3JTcmNGYWN0b3IgJiYgYmxlbmRNb2RlLmRzdCA9PT0gY29sb3JEc3RGYWN0b3IgJiYgYmxlbmRNb2RlLm9wID09PSBjb2xvck9wICYmXG4gICAgICAgICAgICAgICAgYmxlbmRNb2RlLnNyYyA9PT0gYWxwaGFTcmNGYWN0b3IgJiYgYmxlbmRNb2RlLmRzdCA9PT0gYWxwaGFEc3RGYWN0b3IgJiYgYmxlbmRNb2RlLm9wID09PSBhbHBoYU9wKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gQkxFTkRfTk9STUFMO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGRlcHRoIHN0YXRlLiBOb3RlIHRoYXQgdGhpcyBjYW4gYWxzbyBiZSBkb25lIGJ5IHVzaW5nIHtAbGluayBNYXRlcmlhbCNkZXB0aFRlc3R9LFxuICAgICAqIHtAbGluayBNYXRlcmlhbCNkZXB0aEZ1bmN9IGFuZCB7QGxpbmsgTWF0ZXJpYWwjZGVwdGhXcml0ZX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7IERlcHRoU3RhdGUgfVxuICAgICAqL1xuICAgIHNldCBkZXB0aFN0YXRlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2RlcHRoU3RhdGUuY29weSh2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGRlcHRoU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aFN0YXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIGZyYWdtZW50cyBnZW5lcmF0ZWQgYnkgdGhlIHNoYWRlciBvZiB0aGlzIG1hdGVyaWFsIGFyZSBvbmx5IHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRcbiAgICAgKiByZW5kZXIgdGFyZ2V0IGlmIHRoZXkgcGFzcyB0aGUgZGVwdGggdGVzdC4gSWYgZmFsc2UsIGZyYWdtZW50cyBnZW5lcmF0ZWQgYnkgdGhlIHNoYWRlciBvZlxuICAgICAqIHRoaXMgbWF0ZXJpYWwgYXJlIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldCByZWdhcmRsZXNzIG9mIHdoYXQgaXMgaW4gdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGRlcHRoVGVzdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZXB0aFN0YXRlLnRlc3QgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZGVwdGhUZXN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGhTdGF0ZS50ZXN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0aGUgZGVwdGggb2YgbmV3IGZyYWdtZW50cyBpcyBjb21wYXJlZCBhZ2FpbnN0IHRoZSBjdXJyZW50IGRlcHRoIGNvbnRhaW5lZCBpblxuICAgICAqIHRoZSBkZXB0aCBidWZmZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBkb24ndCBkcmF3XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogZHJhdyBpZiBuZXcgZGVwdGggPCBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA8PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBkcmF3IGlmIG5ldyBkZXB0aCA+IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCAhPSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID49IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIGRyYXdcbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1NFUVVBTH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkZXB0aEZ1bmModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGVwdGhTdGF0ZS5mdW5jID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGRlcHRoRnVuYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoU3RhdGUuZnVuYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBmcmFnbWVudHMgZ2VuZXJhdGVkIGJ5IHRoZSBzaGFkZXIgb2YgdGhpcyBtYXRlcmlhbCB3cml0ZSBhIGRlcHRoIHZhbHVlIHRvIHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBJZiBmYWxzZSwgbm8gZGVwdGggdmFsdWUgaXMgd3JpdHRlbi4gRGVmYXVsdHNcbiAgICAgKiB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGRlcHRoV3JpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGVwdGhTdGF0ZS53cml0ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBkZXB0aFdyaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGhTdGF0ZS53cml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBzb3VyY2UgLSBUaGUgbWF0ZXJpYWwgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7TWF0ZXJpYWx9IFRoZSBkZXN0aW5hdGlvbiBtYXRlcmlhbC5cbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBzb3VyY2UubmFtZTtcbiAgICAgICAgdGhpcy5fc2hhZGVyID0gc291cmNlLl9zaGFkZXI7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRlc1xuICAgICAgICB0aGlzLmFscGhhVGVzdCA9IHNvdXJjZS5hbHBoYVRlc3Q7XG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gc291cmNlLmFscGhhVG9Db3ZlcmFnZTtcblxuICAgICAgICB0aGlzLl9ibGVuZFN0YXRlLmNvcHkoc291cmNlLl9ibGVuZFN0YXRlKTtcbiAgICAgICAgdGhpcy5fZGVwdGhTdGF0ZS5jb3B5KHNvdXJjZS5fZGVwdGhTdGF0ZSk7XG5cbiAgICAgICAgdGhpcy5jdWxsID0gc291cmNlLmN1bGw7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsRnJvbnQgPSBzb3VyY2Uuc3RlbmNpbEZyb250Py5jbG9uZSgpO1xuICAgICAgICBpZiAoc291cmNlLnN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxCYWNrID0gc291cmNlLnN0ZW5jaWxGcm9udCA9PT0gc291cmNlLnN0ZW5jaWxCYWNrID8gdGhpcy5zdGVuY2lsRnJvbnQgOiBzb3VyY2Uuc3RlbmNpbEJhY2suY2xvbmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBuZXdseSBjbG9uZWQgbWF0ZXJpYWwuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGNsb25lLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1lc2hJbnN0YW5jZUtleXMoKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB1bnVzZWQgcGFyYW1ldGVyIHNob3VsZCBiZSByZW1vdmVkLCBidXQgdGhlIEVkaXRvciBzdGlsbCB1c2VzIHRoaXMgZnVuY3Rpb25cbiAgICBnZXRTaGFkZXJWYXJpYW50KGRldmljZSwgc2NlbmUsIG9iakRlZnMsIHVudXNlZCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCwgdmVydGV4Rm9ybWF0KSB7XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgc2hhZGVyIHZhcmlhbnQgLSBpdHMgdGhlIHNhbWUgc2hhZGVyLCBidXQgd2l0aCBkaWZmZXJlbnQgcHJvY2Vzc2luZyBvcHRpb25zXG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZlcnRleEZvcm1hdCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzU2hhZGVyKHRoaXMuX3NoYWRlciwgcHJvY2Vzc2luZ09wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgYW55IGNoYW5nZXMgbWFkZSB0byB0aGUgbWF0ZXJpYWwncyBwcm9wZXJ0aWVzLlxuICAgICAqL1xuICAgIHVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkZXIpIHRoaXMuX3NoYWRlci5mYWlsZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBQYXJhbWV0ZXIgbWFuYWdlbWVudFxuICAgIGNsZWFyUGFyYW1ldGVycygpIHtcbiAgICAgICAgdGhpcy5wYXJhbWV0ZXJzID0ge307XG4gICAgfVxuXG4gICAgZ2V0UGFyYW1ldGVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyYW1ldGVycztcbiAgICB9XG5cbiAgICBjbGVhclZhcmlhbnRzKCkge1xuXG4gICAgICAgIC8vIGNsZWFyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbFxuICAgICAgICB0aGlzLnZhcmlhbnRzLmNsZWFyKCk7XG5cbiAgICAgICAgLy8gYnV0IGFsc28gY2xlYXIgdGhlbSBmcm9tIGFsbCBtYXRlcmlhbHMgdGhhdCByZWZlcmVuY2UgdGhlbVxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5tZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBjb3VudCA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uY2xlYXJTaGFkZXJzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIHNwZWNpZmllZCBzaGFkZXIgcGFyYW1ldGVyIGZyb20gYSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBxdWVyeS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgbmFtZWQgcGFyYW1ldGVyLlxuICAgICAqL1xuICAgIGdldFBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW118RmxvYXQzMkFycmF5fGltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IGRhdGEgLVxuICAgICAqIFRoZSB2YWx1ZSBmb3IgdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXIuXG4gICAgICovXG4gICAgc2V0UGFyYW1ldGVyKG5hbWUsIGRhdGEpIHtcblxuICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybU9iamVjdCA9IG5hbWU7XG4gICAgICAgICAgICBpZiAodW5pZm9ybU9iamVjdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaWZvcm1PYmplY3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIodW5pZm9ybU9iamVjdFtpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSB1bmlmb3JtT2JqZWN0Lm5hbWU7XG4gICAgICAgICAgICBkYXRhID0gdW5pZm9ybU9iamVjdC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmFtID0gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0pIHtcbiAgICAgICAgICAgIHBhcmFtLmRhdGEgPSBkYXRhO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wYXJhbWV0ZXJzW25hbWVdID0ge1xuICAgICAgICAgICAgICAgIHNjb3BlSWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlbGV0ZXMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gZGVsZXRlLlxuICAgICAqL1xuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmFtZXRlcnNbbmFtZV0pIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1c2VkIHRvIGFwcGx5IHBhcmFtZXRlcnMgZnJvbSB0aGlzIG1hdGVyaWFsIGludG8gc2NvcGUgb2YgdW5pZm9ybXMsIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IGZvcndhcmQtcmVuZGVyZXJcbiAgICAvLyBvcHRpb25hbCBsaXN0IG9mIHBhcmFtZXRlciBuYW1lcyB0byBiZSBzZXQgY2FuIGJlIHNwZWNpZmllZCwgb3RoZXJ3aXNlIGFsbCBwYXJhbWV0ZXJzIGFyZSBzZXRcbiAgICBzZXRQYXJhbWV0ZXJzKGRldmljZSwgbmFtZXMpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVycztcbiAgICAgICAgaWYgKG5hbWVzID09PSB1bmRlZmluZWQpIG5hbWVzID0gcGFyYW1ldGVycztcbiAgICAgICAgZm9yIChjb25zdCBwYXJhbU5hbWUgaW4gbmFtZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHBhcmFtZXRlcnNbcGFyYW1OYW1lXTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtZXRlci5zY29wZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlci5zY29wZUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUocGFyYW1OYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQuc2V0VmFsdWUocGFyYW1ldGVyLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGlzIG1hdGVyaWFsIGZyb20gdGhlIHNjZW5lIGFuZCBwb3NzaWJseSBmcmVlcyB1cCBtZW1vcnkgZnJvbSBpdHMgc2hhZGVycyAoaWYgdGhlcmVcbiAgICAgKiBhcmUgbm8gb3RoZXIgbWF0ZXJpYWxzIHVzaW5nIGl0KS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnZhcmlhbnRzLmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX3NoYWRlciA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5fbWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlLm1lc2gpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0TWF0ZXJpYWwgPSBnZXREZWZhdWx0TWF0ZXJpYWwobWVzaEluc3RhbmNlLm1lc2guZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcyAhPT0gZGVmYXVsdE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IGRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ3BjLk1hdGVyaWFsOiBNZXNoSW5zdGFuY2UubWVzaCBpcyBudWxsLCBkZWZhdWx0IG1hdGVyaWFsIGNhbm5vdCBiZSBhc3NpZ25lZCB0byB0aGUgTWVzaEluc3RhbmNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgbWVzaCBpbnN0YW5jZSBhcyByZWZlcmVuY2luZyB0aGUgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UgdG9cbiAgICAgKiBkZS1yZWdpc3Rlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRkTWVzaEluc3RhbmNlUmVmKG1lc2hJbnN0YW5jZSkge1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdGFuY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlLXJlZ2lzdGVycyBtZXNoIGluc3RhbmNlIGFzIHJlZmVyZW5jaW5nIHRoZSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZSB0b1xuICAgICAqIGRlLXJlZ2lzdGVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VSZWYobWVzaEluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGkgPSBtZXNoSW5zdGFuY2VzLmluZGV4T2YobWVzaEluc3RhbmNlKTtcbiAgICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTWF0ZXJpYWwgfTtcbiJdLCJuYW1lcyI6WyJibGVuZE1vZGVzIiwiQkxFTkRfU1VCVFJBQ1RJVkUiLCJzcmMiLCJCTEVORE1PREVfT05FIiwiZHN0Iiwib3AiLCJCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1QiLCJCTEVORF9OT05FIiwiQkxFTkRNT0RFX1pFUk8iLCJCTEVOREVRVUFUSU9OX0FERCIsIkJMRU5EX05PUk1BTCIsIkJMRU5ETU9ERV9TUkNfQUxQSEEiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSIsIkJMRU5EX1BSRU1VTFRJUExJRUQiLCJCTEVORF9BRERJVElWRSIsIkJMRU5EX0FERElUSVZFQUxQSEEiLCJCTEVORF9NVUxUSVBMSUNBVElWRTJYIiwiQkxFTkRNT0RFX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9TUkNfQ09MT1IiLCJCTEVORF9TQ1JFRU4iLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiIsIkJMRU5EX01VTFRJUExJQ0FUSVZFIiwiQkxFTkRfTUlOIiwiQkxFTkRFUVVBVElPTl9NSU4iLCJCTEVORF9NQVgiLCJCTEVOREVRVUFUSU9OX01BWCIsImlkIiwiTWF0ZXJpYWwiLCJjb25zdHJ1Y3RvciIsIl9zaGFkZXIiLCJtZXNoSW5zdGFuY2VzIiwibmFtZSIsInVzZXJJZCIsInZhcmlhbnRzIiwiTWFwIiwicGFyYW1ldGVycyIsImFscGhhVGVzdCIsImFscGhhVG9Db3ZlcmFnZSIsIl9ibGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIl9kZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsImN1bGwiLCJDVUxMRkFDRV9CQUNLIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJfc2hhZGVyVmVyc2lvbiIsIl9zY2VuZSIsImRpcnR5IiwiZGVwdGhCaWFzIiwidmFsdWUiLCJzbG9wZURlcHRoQmlhcyIsImRlcHRoQmlhc1Nsb3BlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsInNoYWRlciIsInRyYW5zcGFyZW50IiwiYmxlbmQiLCJfdXBkYXRlVHJhbnNwYXJlbmN5IiwiaSIsImxlbmd0aCIsImJsZW5kU3RhdGUiLCJjb3B5IiwiYmxlbmRUeXBlIiwidHlwZSIsImJsZW5kTW9kZSIsIkRlYnVnIiwiYXNzZXJ0Iiwic2V0Q29sb3JCbGVuZCIsInNldEFscGhhQmxlbmQiLCJfdXBkYXRlTWVzaEluc3RhbmNlS2V5cyIsImNvbG9yT3AiLCJjb2xvclNyY0ZhY3RvciIsImNvbG9yRHN0RmFjdG9yIiwiYWxwaGFPcCIsImFscGhhU3JjRmFjdG9yIiwiYWxwaGFEc3RGYWN0b3IiLCJkZXB0aFN0YXRlIiwiZGVwdGhUZXN0IiwidGVzdCIsImRlcHRoRnVuYyIsImZ1bmMiLCJkZXB0aFdyaXRlIiwid3JpdGUiLCJzb3VyY2UiLCJfc291cmNlJHN0ZW5jaWxGcm9udCIsImNsb25lIiwidXBkYXRlS2V5IiwidXBkYXRlVW5pZm9ybXMiLCJkZXZpY2UiLCJzY2VuZSIsImdldFNoYWRlclZhcmlhbnQiLCJvYmpEZWZzIiwidW51c2VkIiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInZlcnRleEZvcm1hdCIsInByb2Nlc3NpbmdPcHRpb25zIiwiU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyIsInByb2Nlc3NTaGFkZXIiLCJ1cGRhdGUiLCJmYWlsZWQiLCJjbGVhclBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXJzIiwiY2xlYXJWYXJpYW50cyIsImNsZWFyIiwiY291bnQiLCJjbGVhclNoYWRlcnMiLCJnZXRQYXJhbWV0ZXIiLCJzZXRQYXJhbWV0ZXIiLCJkYXRhIiwidW5kZWZpbmVkIiwidW5pZm9ybU9iamVjdCIsInBhcmFtIiwic2NvcGVJZCIsImRlbGV0ZVBhcmFtZXRlciIsInNldFBhcmFtZXRlcnMiLCJuYW1lcyIsInBhcmFtTmFtZSIsInBhcmFtZXRlciIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwiZGVzdHJveSIsIm1lc2hJbnN0YW5jZSIsIl9tYXRlcmlhbCIsIm1lc2giLCJkZWZhdWx0TWF0ZXJpYWwiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJtYXRlcmlhbCIsIndhcm4iLCJhZGRNZXNoSW5zdGFuY2VSZWYiLCJwdXNoIiwicmVtb3ZlTWVzaEluc3RhbmNlUmVmIiwiaW5kZXhPZiIsInNwbGljZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBc0JBO0FBQ0EsTUFBTUEsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUNyQkEsVUFBVSxDQUFDQyxpQkFBaUIsQ0FBQyxHQUFHO0FBQUVDLEVB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
