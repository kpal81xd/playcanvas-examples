import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * A render pass implementing rendering of a QuadRender.
 *
 * @ignore
 */
class RenderPassQuad extends RenderPass {
  constructor(device, quad, rect, scissorRect) {
    super(device);
    this.quad = quad;
    this.rect = rect;
    this.scissorRect = scissorRect;
  }
  execute() {
    const {
      device
    } = this;
    DebugGraphics.pushGpuMarker(device, "drawQuadWithShader");
    device.setCullMode(CULLFACE_NONE);
    device.setDepthState(DepthState.NODEPTH);
    device.setStencilState(null, null);
    this.quad.render(this.rect, this.scissorRect);
    DebugGraphics.popGpuMarker(device);
  }
}

export { RenderPassQuad };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MtcXVhZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoaWNzL3JlbmRlci1wYXNzLXF1YWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ1VMTEZBQ0VfTk9ORSB9IGZyb20gXCIuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanNcIjtcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVwdGgtc3RhdGUuanNcIjtcbmltcG9ydCB7IFJlbmRlclBhc3MgfSBmcm9tIFwiLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXBhc3MuanNcIjtcblxuLyoqXG4gKiBBIHJlbmRlciBwYXNzIGltcGxlbWVudGluZyByZW5kZXJpbmcgb2YgYSBRdWFkUmVuZGVyLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUmVuZGVyUGFzc1F1YWQgZXh0ZW5kcyBSZW5kZXJQYXNzIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHF1YWQsIHJlY3QsIHNjaXNzb3JSZWN0KSB7XG4gICAgICAgIHN1cGVyKGRldmljZSk7XG5cbiAgICAgICAgdGhpcy5xdWFkID0gcXVhZDtcbiAgICAgICAgdGhpcy5yZWN0ID0gcmVjdDtcbiAgICAgICAgdGhpcy5zY2lzc29yUmVjdCA9IHNjaXNzb3JSZWN0O1xuICAgIH1cblxuICAgIGV4ZWN1dGUoKSB7XG4gICAgICAgIGNvbnN0IHsgZGV2aWNlIH0gPSB0aGlzO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBcImRyYXdRdWFkV2l0aFNoYWRlclwiKTtcblxuICAgICAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUoQ1VMTEZBQ0VfTk9ORSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFN0YXRlKERlcHRoU3RhdGUuTk9ERVBUSCk7XG4gICAgICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUobnVsbCwgbnVsbCk7XG5cbiAgICAgICAgdGhpcy5xdWFkLnJlbmRlcih0aGlzLnJlY3QsIHRoaXMuc2Npc3NvclJlY3QpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyUGFzc1F1YWQgfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXJQYXNzUXVhZCIsIlJlbmRlclBhc3MiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsInF1YWQiLCJyZWN0Iiwic2Npc3NvclJlY3QiLCJleGVjdXRlIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIk5PREVQVEgiLCJzZXRTdGVuY2lsU3RhdGUiLCJyZW5kZXIiLCJwb3BHcHVNYXJrZXIiXSwibWFwcGluZ3MiOiI7Ozs7O0FBS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGNBQWMsU0FBU0MsVUFBVSxDQUFDO0VBQ3BDQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxXQUFXLEVBQUU7SUFDekMsS0FBSyxDQUFDSCxNQUFNLENBQUMsQ0FBQTtJQUViLElBQUksQ0FBQ0MsSUFBSSxHQUFHQSxJQUFJLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxJQUFJLEdBQUdBLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0FBQ2xDLEdBQUE7QUFFQUMsRUFBQUEsT0FBT0EsR0FBRztJQUNOLE1BQU07QUFBRUosTUFBQUEsTUFBQUE7QUFBTyxLQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCSyxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQ04sTUFBTSxFQUFFLG9CQUFvQixDQUFDLENBQUE7QUFFekRBLElBQUFBLE1BQU0sQ0FBQ08sV0FBVyxDQUFDQyxhQUFhLENBQUMsQ0FBQTtBQUNqQ1IsSUFBQUEsTUFBTSxDQUFDUyxhQUFhLENBQUNDLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7QUFDeENYLElBQUFBLE1BQU0sQ0FBQ1ksZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUVsQyxJQUFBLElBQUksQ0FBQ1gsSUFBSSxDQUFDWSxNQUFNLENBQUMsSUFBSSxDQUFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDQyxXQUFXLENBQUMsQ0FBQTtBQUM3Q0UsSUFBQUEsYUFBYSxDQUFDUyxZQUFZLENBQUNkLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7QUFDSjs7OzsifQ==