import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { createShaderFromCode } from '../shader-lib/utils.js';

/**
 * A render pass that implements rendering a quad with a shader, and exposes controls over the
 * render state. This is typically used as a base class for render passes that render a quad with
 * a shader, but can be used directly as well by specifying a shader.
 *
 * @ignore
 */
class RenderPassShaderQuad extends RenderPass {
  constructor(...args) {
    super(...args);
    this._shader = null;
    this.quadRender = null;
    /**
     * The cull mode to use when rendering the quad. Defaults to {@link CULLFACE_NONE}.
     */
    this.cullMode = CULLFACE_NONE;
    /**
     * A blend state to use when rendering the quad. Defaults to {@link BlendState.NOBLEND}.
     *
     * @type {BlendState}
     */
    this.blendState = BlendState.NOBLEND;
    /**
     * A depth state to use when rendering the quad. Defaults to {@link DepthState.NODEPTH}.
     *
     * @type {DepthState}
     */
    this.depthState = DepthState.NODEPTH;
    /**
     * Stencil parameters for front faces to use when rendering the quad. Defaults to null.
     *
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    this.stencilFront = null;
    /**
     * Stencil parameters for back faces to use when rendering the quad. Defaults to null.
     *
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    this.stencilBack = null;
  }
  /**
   * Sets the shader used to render the quad.
   *
   * @type {import('../../platform/graphics/shader.js').Shader}
   * @ignore
   */
  set shader(shader) {
    var _this$quadRender, _this$_shader;
    // destroy old
    (_this$quadRender = this.quadRender) == null || _this$quadRender.destroy();
    this.quadRender = null;
    (_this$_shader = this._shader) == null || _this$_shader.destroy();

    // handle new
    this._shader = shader;
    if (shader) this.quadRender = new QuadRender(shader);
  }
  get shader() {
    return this._shader;
  }

  /**
   * Creates a quad shader from the supplied fragment shader code.
   *
   * @param {string} name - A name of the shader.
   * @param {string} fs - Fragment shader source code.
   * @param {object} [shaderDefinitionOptions] - Additional options that will be added to the
   * shader definition.
   * @param {boolean} [shaderDefinitionOptions.useTransformFeedback] - Whether to use transform
   * feedback. Defaults to false.
   * @param {string | string[]} [shaderDefinitionOptions.fragmentOutputTypes] - Fragment shader
   * output types, which default to vec4. Passing a string will set the output type for all color
   * attachments. Passing an array will set the output type for each color attachment.
   * @returns {object} Returns the created shader.
   */
  createQuadShader(name, fs, shaderDefinitionOptions = {}) {
    return createShaderFromCode(this.device, RenderPassShaderQuad.quadVertexShader, fs, name, {
      aPosition: SEMANTIC_POSITION
    }, shaderDefinitionOptions);
  }
  destroy() {
    var _this$shader;
    (_this$shader = this.shader) == null || _this$shader.destroy();
    this.shader = null;
  }
  execute() {
    // render state
    const device = this.device;
    device.setBlendState(this.blendState);
    device.setCullMode(this.cullMode);
    device.setDepthState(this.depthState);
    device.setStencilState(this.stencilFront, this.stencilBack);
    this.quadRender.render();
  }
}
/**
 * A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
 * buffer, and generates uv coordinates uv0 for use in the fragment shader.
 *
 * @type {string}
 */
RenderPassShaderQuad.quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 uv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

export { RenderPassShaderQuad };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3Mtc2hhZGVyLXF1YWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9yZW5kZXItcGFzcy1zaGFkZXItcXVhZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBRdWFkUmVuZGVyIH0gZnJvbSBcIi4vcXVhZC1yZW5kZXIuanNcIjtcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanNcIjtcbmltcG9ydCB7IENVTExGQUNFX05PTkUsIFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSBcIi4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gXCIuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qc1wiO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gXCIuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItcGFzcy5qc1wiO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tIFwiLi4vc2hhZGVyLWxpYi91dGlscy5qc1wiO1xuXG4vKipcbiAqIEEgcmVuZGVyIHBhc3MgdGhhdCBpbXBsZW1lbnRzIHJlbmRlcmluZyBhIHF1YWQgd2l0aCBhIHNoYWRlciwgYW5kIGV4cG9zZXMgY29udHJvbHMgb3ZlciB0aGVcbiAqIHJlbmRlciBzdGF0ZS4gVGhpcyBpcyB0eXBpY2FsbHkgdXNlZCBhcyBhIGJhc2UgY2xhc3MgZm9yIHJlbmRlciBwYXNzZXMgdGhhdCByZW5kZXIgYSBxdWFkIHdpdGhcbiAqIGEgc2hhZGVyLCBidXQgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYXMgd2VsbCBieSBzcGVjaWZ5aW5nIGEgc2hhZGVyLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUmVuZGVyUGFzc1NoYWRlclF1YWQgZXh0ZW5kcyBSZW5kZXJQYXNzIHtcbiAgICBfc2hhZGVyID0gbnVsbDtcblxuICAgIHF1YWRSZW5kZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGN1bGwgbW9kZSB0byB1c2Ugd2hlbiByZW5kZXJpbmcgdGhlIHF1YWQuIERlZmF1bHRzIHRvIHtAbGluayBDVUxMRkFDRV9OT05FfS5cbiAgICAgKi9cbiAgICBjdWxsTW9kZSA9IENVTExGQUNFX05PTkU7XG5cbiAgICAvKipcbiAgICAgKiBBIGJsZW5kIHN0YXRlIHRvIHVzZSB3aGVuIHJlbmRlcmluZyB0aGUgcXVhZC4gRGVmYXVsdHMgdG8ge0BsaW5rIEJsZW5kU3RhdGUuTk9CTEVORH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QmxlbmRTdGF0ZX1cbiAgICAgKi9cbiAgICBibGVuZFN0YXRlID0gQmxlbmRTdGF0ZS5OT0JMRU5EO1xuXG4gICAgLyoqXG4gICAgICogQSBkZXB0aCBzdGF0ZSB0byB1c2Ugd2hlbiByZW5kZXJpbmcgdGhlIHF1YWQuIERlZmF1bHRzIHRvIHtAbGluayBEZXB0aFN0YXRlLk5PREVQVEh9LlxuICAgICAqXG4gICAgICogQHR5cGUge0RlcHRoU3RhdGV9XG4gICAgICovXG4gICAgZGVwdGhTdGF0ZSA9IERlcHRoU3RhdGUuTk9ERVBUSDtcblxuICAgIC8qKlxuICAgICAqIFN0ZW5jaWwgcGFyYW1ldGVycyBmb3IgZnJvbnQgZmFjZXMgdG8gdXNlIHdoZW4gcmVuZGVyaW5nIHRoZSBxdWFkLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJykuU3RlbmNpbFBhcmFtZXRlcnN8bnVsbH1cbiAgICAgKi9cbiAgICBzdGVuY2lsRnJvbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogU3RlbmNpbCBwYXJhbWV0ZXJzIGZvciBiYWNrIGZhY2VzIHRvIHVzZSB3aGVuIHJlbmRlcmluZyB0aGUgcXVhZC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3N0ZW5jaWwtcGFyYW1ldGVycy5qcycpLlN0ZW5jaWxQYXJhbWV0ZXJzfG51bGx9XG4gICAgICovXG4gICAgc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQSBzaW1wbGUgdmVydGV4IHNoYWRlciB1c2VkIHRvIHJlbmRlciBhIHF1YWQsIHdoaWNoIHJlcXVpcmVzICd2ZWMyIGFQb3NpdGlvbicgaW4gdGhlIHZlcnRleFxuICAgICAqIGJ1ZmZlciwgYW5kIGdlbmVyYXRlcyB1diBjb29yZGluYXRlcyB1djAgZm9yIHVzZSBpbiB0aGUgZnJhZ21lbnQgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzdGF0aWMgcXVhZFZlcnRleFNoYWRlciA9IGBcbiAgICAgICAgYXR0cmlidXRlIHZlYzIgYVBvc2l0aW9uO1xuICAgICAgICB2YXJ5aW5nIHZlYzIgdXYwO1xuICAgICAgICB2b2lkIG1haW4odm9pZClcbiAgICAgICAge1xuICAgICAgICAgICAgZ2xfUG9zaXRpb24gPSB2ZWM0KGFQb3NpdGlvbiwgMC4wLCAxLjApO1xuICAgICAgICAgICAgdXYwID0gZ2V0SW1hZ2VFZmZlY3RVVigoYVBvc2l0aW9uLnh5ICsgMS4wKSAqIDAuNSk7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc2hhZGVyIHVzZWQgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXQgc2hhZGVyKHNoYWRlcikge1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgb2xkXG4gICAgICAgIHRoaXMucXVhZFJlbmRlcj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnF1YWRSZW5kZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXI/LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBoYW5kbGUgbmV3XG4gICAgICAgIHRoaXMuX3NoYWRlciA9IHNoYWRlcjtcbiAgICAgICAgaWYgKHNoYWRlcilcbiAgICAgICAgICAgIHRoaXMucXVhZFJlbmRlciA9IG5ldyBRdWFkUmVuZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgcXVhZCBzaGFkZXIgZnJvbSB0aGUgc3VwcGxpZWQgZnJhZ21lbnQgc2hhZGVyIGNvZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIEEgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmcyAtIEZyYWdtZW50IHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3NoYWRlckRlZmluaXRpb25PcHRpb25zXSAtIEFkZGl0aW9uYWwgb3B0aW9ucyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlXG4gICAgICogc2hhZGVyIGRlZmluaXRpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMudXNlVHJhbnNmb3JtRmVlZGJhY2tdIC0gV2hldGhlciB0byB1c2UgdHJhbnNmb3JtXG4gICAgICogZmVlZGJhY2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgc3RyaW5nW119IFtzaGFkZXJEZWZpbml0aW9uT3B0aW9ucy5mcmFnbWVudE91dHB1dFR5cGVzXSAtIEZyYWdtZW50IHNoYWRlclxuICAgICAqIG91dHB1dCB0eXBlcywgd2hpY2ggZGVmYXVsdCB0byB2ZWM0LiBQYXNzaW5nIGEgc3RyaW5nIHdpbGwgc2V0IHRoZSBvdXRwdXQgdHlwZSBmb3IgYWxsIGNvbG9yXG4gICAgICogYXR0YWNobWVudHMuIFBhc3NpbmcgYW4gYXJyYXkgd2lsbCBzZXQgdGhlIG91dHB1dCB0eXBlIGZvciBlYWNoIGNvbG9yIGF0dGFjaG1lbnQuXG4gICAgICogQHJldHVybnMge29iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBzaGFkZXIuXG4gICAgICovXG4gICAgY3JlYXRlUXVhZFNoYWRlcihuYW1lLCBmcywgc2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMgPSB7fSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlU2hhZGVyRnJvbUNvZGUoXG4gICAgICAgICAgICB0aGlzLmRldmljZSxcbiAgICAgICAgICAgIFJlbmRlclBhc3NTaGFkZXJRdWFkLnF1YWRWZXJ0ZXhTaGFkZXIsXG4gICAgICAgICAgICBmcyxcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICB7IGFQb3NpdGlvbjogU0VNQU5USUNfUE9TSVRJT04gfSxcbiAgICAgICAgICAgIHNoYWRlckRlZmluaXRpb25PcHRpb25zXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zaGFkZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zaGFkZXIgPSBudWxsO1xuICAgIH1cblxuICAgIGV4ZWN1dGUoKSB7XG5cbiAgICAgICAgLy8gcmVuZGVyIHN0YXRlXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZSh0aGlzLmJsZW5kU3RhdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUodGhpcy5jdWxsTW9kZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFN0YXRlKHRoaXMuZGVwdGhTdGF0ZSk7XG4gICAgICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUodGhpcy5zdGVuY2lsRnJvbnQsIHRoaXMuc3RlbmNpbEJhY2spO1xuXG4gICAgICAgIHRoaXMucXVhZFJlbmRlci5yZW5kZXIoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlbmRlclBhc3NTaGFkZXJRdWFkIH07XG4iXSwibmFtZXMiOlsiUmVuZGVyUGFzc1NoYWRlclF1YWQiLCJSZW5kZXJQYXNzIiwiY29uc3RydWN0b3IiLCJhcmdzIiwiX3NoYWRlciIsInF1YWRSZW5kZXIiLCJjdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJibGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIk5PQkxFTkQiLCJkZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIk5PREVQVEgiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInNoYWRlciIsIl90aGlzJHF1YWRSZW5kZXIiLCJfdGhpcyRfc2hhZGVyIiwiZGVzdHJveSIsIlF1YWRSZW5kZXIiLCJjcmVhdGVRdWFkU2hhZGVyIiwibmFtZSIsImZzIiwic2hhZGVyRGVmaW5pdGlvbk9wdGlvbnMiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsImRldmljZSIsInF1YWRWZXJ0ZXhTaGFkZXIiLCJhUG9zaXRpb24iLCJTRU1BTlRJQ19QT1NJVElPTiIsIl90aGlzJHNoYWRlciIsImV4ZWN1dGUiLCJzZXRCbGVuZFN0YXRlIiwic2V0Q3VsbE1vZGUiLCJzZXREZXB0aFN0YXRlIiwic2V0U3RlbmNpbFN0YXRlIiwicmVuZGVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxvQkFBb0IsU0FBU0MsVUFBVSxDQUFDO0FBQUFDLEVBQUFBLFdBQUFBLENBQUEsR0FBQUMsSUFBQSxFQUFBO0FBQUEsSUFBQSxLQUFBLENBQUEsR0FBQUEsSUFBQSxDQUFBLENBQUE7SUFBQSxJQUMxQ0MsQ0FBQUEsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUFBLElBRWRDLENBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFFakI7QUFDSjtBQUNBO0lBRkksSUFHQUMsQ0FBQUEsUUFBUSxHQUFHQyxhQUFhLENBQUE7QUFFeEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxVQUFVLEdBQUdDLFVBQVUsQ0FBQ0MsT0FBTyxDQUFBO0FBRS9CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsVUFBVSxHQUFHQyxVQUFVLENBQUNDLE9BQU8sQ0FBQTtBQUUvQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUVuQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsV0FBVyxHQUFHLElBQUksQ0FBQTtBQUFBLEdBQUE7QUFrQmxCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlDLE1BQU1BLENBQUNBLE1BQU0sRUFBRTtJQUFBLElBQUFDLGdCQUFBLEVBQUFDLGFBQUEsQ0FBQTtBQUVmO0lBQ0EsQ0FBQUQsZ0JBQUEsT0FBSSxDQUFDWixVQUFVLGFBQWZZLGdCQUFBLENBQWlCRSxPQUFPLEVBQUUsQ0FBQTtJQUMxQixJQUFJLENBQUNkLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFDdEIsQ0FBQWEsYUFBQSxPQUFJLENBQUNkLE9BQU8sYUFBWmMsYUFBQSxDQUFjQyxPQUFPLEVBQUUsQ0FBQTs7QUFFdkI7SUFDQSxJQUFJLENBQUNmLE9BQU8sR0FBR1ksTUFBTSxDQUFBO0lBQ3JCLElBQUlBLE1BQU0sRUFDTixJQUFJLENBQUNYLFVBQVUsR0FBRyxJQUFJZSxVQUFVLENBQUNKLE1BQU0sQ0FBQyxDQUFBO0FBQ2hELEdBQUE7RUFFQSxJQUFJQSxNQUFNQSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUNaLE9BQU8sQ0FBQTtBQUN2QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWlCLGdCQUFnQkEsQ0FBQ0MsSUFBSSxFQUFFQyxFQUFFLEVBQUVDLHVCQUF1QixHQUFHLEVBQUUsRUFBRTtBQUNyRCxJQUFBLE9BQU9DLG9CQUFvQixDQUN2QixJQUFJLENBQUNDLE1BQU0sRUFDWDFCLG9CQUFvQixDQUFDMkIsZ0JBQWdCLEVBQ3JDSixFQUFFLEVBQ0ZELElBQUksRUFDSjtBQUFFTSxNQUFBQSxTQUFTLEVBQUVDLGlCQUFBQTtLQUFtQixFQUNoQ0wsdUJBQ0osQ0FBQyxDQUFBO0FBQ0wsR0FBQTtBQUVBTCxFQUFBQSxPQUFPQSxHQUFHO0FBQUEsSUFBQSxJQUFBVyxZQUFBLENBQUE7SUFDTixDQUFBQSxZQUFBLE9BQUksQ0FBQ2QsTUFBTSxhQUFYYyxZQUFBLENBQWFYLE9BQU8sRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0gsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN0QixHQUFBO0FBRUFlLEVBQUFBLE9BQU9BLEdBQUc7QUFFTjtBQUNBLElBQUEsTUFBTUwsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0FBQzFCQSxJQUFBQSxNQUFNLENBQUNNLGFBQWEsQ0FBQyxJQUFJLENBQUN4QixVQUFVLENBQUMsQ0FBQTtBQUNyQ2tCLElBQUFBLE1BQU0sQ0FBQ08sV0FBVyxDQUFDLElBQUksQ0FBQzNCLFFBQVEsQ0FBQyxDQUFBO0FBQ2pDb0IsSUFBQUEsTUFBTSxDQUFDUSxhQUFhLENBQUMsSUFBSSxDQUFDdkIsVUFBVSxDQUFDLENBQUE7SUFDckNlLE1BQU0sQ0FBQ1MsZUFBZSxDQUFDLElBQUksQ0FBQ3JCLFlBQVksRUFBRSxJQUFJLENBQUNDLFdBQVcsQ0FBQyxDQUFBO0FBRTNELElBQUEsSUFBSSxDQUFDVixVQUFVLENBQUMrQixNQUFNLEVBQUUsQ0FBQTtBQUM1QixHQUFBO0FBQ0osQ0FBQTtBQWhGSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUEzQ01wQyxvQkFBb0IsQ0E0Q2YyQixnQkFBZ0IsR0FBSSxDQUFBO0FBQy9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSyxDQUFBOzs7OyJ9
