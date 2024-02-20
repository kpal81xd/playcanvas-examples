import { Vec4 } from '../../core/math/vec4.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from './quad-render-utils.js';

const _viewport = new Vec4();

/**
 * Base class for all post effects. Post effects take a a render target as input apply effects to
 * it and then render the result to an output render target or the screen if no output is
 * specified.
 *
 * @category Graphics
 */
class PostEffect {
  /**
   * Create a new PostEffect instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device of the application.
   */
  constructor(graphicsDevice) {
    /**
     * The graphics device of the application.
     *
     * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.device = graphicsDevice;

    /**
     * The property that should to be set to `true` (by the custom post effect) if a depth map
     * is necessary (default is false).
     *
     * @type {boolean}
     */
    this.needsDepthBuffer = false;
  }

  /**
   * A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
   * buffer, and generates uv coordinates vUv0 for use in the fragment shader.
   *
   * @type {string}
   */

  /**
   * Render the post effect using the specified inputTarget to the specified outputTarget.
   *
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} inputTarget - The
   * input render target.
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} outputTarget - The
   * output render target. If null then this will be the screen.
   * @param {import('../../core/math/vec4.js').Vec4} [rect] - The rect of the current camera. If
   * not specified, it will default to [0, 0, 1, 1].
   */
  render(inputTarget, outputTarget, rect) {}

  /**
   * Draw a screen-space rectangle in a render target, using a specified shader.
   *
   * @param {import('../../platform/graphics/render-target.js').RenderTarget|null} target - The
   * output render target.
   * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader to be used
   * for drawing the rectangle.
   * @param {import('../../core/math/vec4.js').Vec4} [rect] - The normalized screen-space position
   * (rect.x, rect.y) and size (rect.z, rect.w) of the rectangle. Default is [0, 0, 1, 1].
   */
  drawQuad(target, shader, rect) {
    let viewport;
    if (rect) {
      // convert rect in normalized space to viewport in pixel space
      const w = target ? target.width : this.device.width;
      const h = target ? target.height : this.device.height;
      viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
    }
    this.device.setBlendState(BlendState.NOBLEND);
    drawQuadWithShader(this.device, target, shader, viewport);
  }
}
PostEffect.quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 vUv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

export { PostEffect };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdC1lZmZlY3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9wb3N0LWVmZmVjdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5jb25zdCBfdmlld3BvcnQgPSBuZXcgVmVjNCgpO1xuXG4vKipcbiAqIEJhc2UgY2xhc3MgZm9yIGFsbCBwb3N0IGVmZmVjdHMuIFBvc3QgZWZmZWN0cyB0YWtlIGEgYSByZW5kZXIgdGFyZ2V0IGFzIGlucHV0IGFwcGx5IGVmZmVjdHMgdG9cbiAqIGl0IGFuZCB0aGVuIHJlbmRlciB0aGUgcmVzdWx0IHRvIGFuIG91dHB1dCByZW5kZXIgdGFyZ2V0IG9yIHRoZSBzY3JlZW4gaWYgbm8gb3V0cHV0IGlzXG4gKiBzcGVjaWZpZWQuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIFBvc3RFZmZlY3Qge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBQb3N0RWZmZWN0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2Ugb2YgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwcm9wZXJ0eSB0aGF0IHNob3VsZCB0byBiZSBzZXQgdG8gYHRydWVgIChieSB0aGUgY3VzdG9tIHBvc3QgZWZmZWN0KSBpZiBhIGRlcHRoIG1hcFxuICAgICAgICAgKiBpcyBuZWNlc3NhcnkgKGRlZmF1bHQgaXMgZmFsc2UpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmVlZHNEZXB0aEJ1ZmZlciA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgc2ltcGxlIHZlcnRleCBzaGFkZXIgdXNlZCB0byByZW5kZXIgYSBxdWFkLCB3aGljaCByZXF1aXJlcyAndmVjMiBhUG9zaXRpb24nIGluIHRoZSB2ZXJ0ZXhcbiAgICAgKiBidWZmZXIsIGFuZCBnZW5lcmF0ZXMgdXYgY29vcmRpbmF0ZXMgdlV2MCBmb3IgdXNlIGluIHRoZSBmcmFnbWVudCBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHN0YXRpYyBxdWFkVmVydGV4U2hhZGVyID0gYFxuICAgICAgICBhdHRyaWJ1dGUgdmVjMiBhUG9zaXRpb247XG4gICAgICAgIHZhcnlpbmcgdmVjMiB2VXYwO1xuICAgICAgICB2b2lkIG1haW4odm9pZClcbiAgICAgICAge1xuICAgICAgICAgICAgZ2xfUG9zaXRpb24gPSB2ZWM0KGFQb3NpdGlvbiwgMC4wLCAxLjApO1xuICAgICAgICAgICAgdlV2MCA9IGdldEltYWdlRWZmZWN0VVYoKGFQb3NpdGlvbi54eSArIDEuMCkgKiAwLjUpO1xuICAgICAgICB9XG4gICAgYDtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0aGUgcG9zdCBlZmZlY3QgdXNpbmcgdGhlIHNwZWNpZmllZCBpbnB1dFRhcmdldCB0byB0aGUgc3BlY2lmaWVkIG91dHB1dFRhcmdldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSBpbnB1dFRhcmdldCAtIFRoZVxuICAgICAqIGlucHV0IHJlbmRlciB0YXJnZXQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IG91dHB1dFRhcmdldCAtIFRoZVxuICAgICAqIG91dHB1dCByZW5kZXIgdGFyZ2V0LiBJZiBudWxsIHRoZW4gdGhpcyB3aWxsIGJlIHRoZSBzY3JlZW4uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gW3JlY3RdIC0gVGhlIHJlY3Qgb2YgdGhlIGN1cnJlbnQgY2FtZXJhLiBJZlxuICAgICAqIG5vdCBzcGVjaWZpZWQsIGl0IHdpbGwgZGVmYXVsdCB0byBbMCwgMCwgMSwgMV0uXG4gICAgICovXG4gICAgcmVuZGVyKGlucHV0VGFyZ2V0LCBvdXRwdXRUYXJnZXQsIHJlY3QpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IGEgc2NyZWVuLXNwYWNlIHJlY3RhbmdsZSBpbiBhIHJlbmRlciB0YXJnZXQsIHVzaW5nIGEgc3BlY2lmaWVkIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fG51bGx9IHRhcmdldCAtIFRoZVxuICAgICAqIG91dHB1dCByZW5kZXIgdGFyZ2V0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gYmUgdXNlZFxuICAgICAqIGZvciBkcmF3aW5nIHRoZSByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gW3JlY3RdIC0gVGhlIG5vcm1hbGl6ZWQgc2NyZWVuLXNwYWNlIHBvc2l0aW9uXG4gICAgICogKHJlY3QueCwgcmVjdC55KSBhbmQgc2l6ZSAocmVjdC56LCByZWN0LncpIG9mIHRoZSByZWN0YW5nbGUuIERlZmF1bHQgaXMgWzAsIDAsIDEsIDFdLlxuICAgICAqL1xuICAgIGRyYXdRdWFkKHRhcmdldCwgc2hhZGVyLCByZWN0KSB7XG4gICAgICAgIGxldCB2aWV3cG9ydDtcbiAgICAgICAgaWYgKHJlY3QpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgcmVjdCBpbiBub3JtYWxpemVkIHNwYWNlIHRvIHZpZXdwb3J0IGluIHBpeGVsIHNwYWNlXG4gICAgICAgICAgICBjb25zdCB3ID0gdGFyZ2V0ID8gdGFyZ2V0LndpZHRoIDogdGhpcy5kZXZpY2Uud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoID0gdGFyZ2V0ID8gdGFyZ2V0LmhlaWdodCA6IHRoaXMuZGV2aWNlLmhlaWdodDtcbiAgICAgICAgICAgIHZpZXdwb3J0ID0gX3ZpZXdwb3J0LnNldChyZWN0LnggKiB3LCByZWN0LnkgKiBoLCByZWN0LnogKiB3LCByZWN0LncgKiBoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKHRoaXMuZGV2aWNlLCB0YXJnZXQsIHNoYWRlciwgdmlld3BvcnQpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUG9zdEVmZmVjdCB9O1xuIl0sIm5hbWVzIjpbIl92aWV3cG9ydCIsIlZlYzQiLCJQb3N0RWZmZWN0IiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImRldmljZSIsIm5lZWRzRGVwdGhCdWZmZXIiLCJyZW5kZXIiLCJpbnB1dFRhcmdldCIsIm91dHB1dFRhcmdldCIsInJlY3QiLCJkcmF3UXVhZCIsInRhcmdldCIsInNoYWRlciIsInZpZXdwb3J0IiwidyIsIndpZHRoIiwiaCIsImhlaWdodCIsInNldCIsIngiLCJ5IiwieiIsInNldEJsZW5kU3RhdGUiLCJCbGVuZFN0YXRlIiwiTk9CTEVORCIsImRyYXdRdWFkV2l0aFNoYWRlciIsInF1YWRWZXJ0ZXhTaGFkZXIiXSwibWFwcGluZ3MiOiI7Ozs7QUFJQSxNQUFNQSxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsVUFBVSxDQUFDO0FBQ2I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLGNBQWMsRUFBRTtBQUN4QjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxNQUFNLEdBQUdELGNBQWMsQ0FBQTs7QUFFNUI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDRSxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7QUFDakMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBV0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsTUFBTUEsQ0FBQ0MsV0FBVyxFQUFFQyxZQUFZLEVBQUVDLElBQUksRUFBRSxFQUN4Qzs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxRQUFRQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUgsSUFBSSxFQUFFO0FBQzNCLElBQUEsSUFBSUksUUFBUSxDQUFBO0FBQ1osSUFBQSxJQUFJSixJQUFJLEVBQUU7QUFDTjtBQUNBLE1BQUEsTUFBTUssQ0FBQyxHQUFHSCxNQUFNLEdBQUdBLE1BQU0sQ0FBQ0ksS0FBSyxHQUFHLElBQUksQ0FBQ1gsTUFBTSxDQUFDVyxLQUFLLENBQUE7QUFDbkQsTUFBQSxNQUFNQyxDQUFDLEdBQUdMLE1BQU0sR0FBR0EsTUFBTSxDQUFDTSxNQUFNLEdBQUcsSUFBSSxDQUFDYixNQUFNLENBQUNhLE1BQU0sQ0FBQTtBQUNyREosTUFBQUEsUUFBUSxHQUFHZCxTQUFTLENBQUNtQixHQUFHLENBQUNULElBQUksQ0FBQ1UsQ0FBQyxHQUFHTCxDQUFDLEVBQUVMLElBQUksQ0FBQ1csQ0FBQyxHQUFHSixDQUFDLEVBQUVQLElBQUksQ0FBQ1ksQ0FBQyxHQUFHUCxDQUFDLEVBQUVMLElBQUksQ0FBQ0ssQ0FBQyxHQUFHRSxDQUFDLENBQUMsQ0FBQTtBQUM1RSxLQUFBO0lBRUEsSUFBSSxDQUFDWixNQUFNLENBQUNrQixhQUFhLENBQUNDLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7SUFDN0NDLGtCQUFrQixDQUFDLElBQUksQ0FBQ3JCLE1BQU0sRUFBRU8sTUFBTSxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsQ0FBQyxDQUFBO0FBQzdELEdBQUE7QUFDSixDQUFBO0FBM0VNWixVQUFVLENBOEJMeUIsZ0JBQWdCLEdBQUksQ0FBQTtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUssQ0FBQTs7OzsifQ==
