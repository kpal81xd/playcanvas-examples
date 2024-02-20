import { Debug } from '../../core/debug.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * A render pass used to render post-effects.
 *
 * @ignore
 */
class RenderPassPostprocessing extends RenderPass {
  constructor(device, renderer, renderAction) {
    super(device);
    this.renderer = renderer;
    this.renderAction = renderAction;
    this.requiresCubemaps = false;
  }
  execute() {
    const renderAction = this.renderAction;
    const camera = renderAction.camera;
    Debug.assert(renderAction.triggerPostprocess && camera.onPostprocessing);

    // trigger postprocessing for camera
    camera.onPostprocessing();
  }
}

export { RenderPassPostprocessing };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MtcG9zdHByb2Nlc3NpbmcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXItcGFzcy1wb3N0cHJvY2Vzc2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gXCIuLi8uLi9jb3JlL2RlYnVnLmpzXCI7XG5pbXBvcnQgeyBSZW5kZXJQYXNzIH0gZnJvbSBcIi4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzXCI7XG5cbi8qKlxuICogQSByZW5kZXIgcGFzcyB1c2VkIHRvIHJlbmRlciBwb3N0LWVmZmVjdHMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcgZXh0ZW5kcyBSZW5kZXJQYXNzIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHJlbmRlcmVyLCByZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgc3VwZXIoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuICAgICAgICB0aGlzLnJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbjtcblxuICAgICAgICB0aGlzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBleGVjdXRlKCkge1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHRoaXMucmVuZGVyQWN0aW9uO1xuICAgICAgICBjb25zdCBjYW1lcmEgPSByZW5kZXJBY3Rpb24uY2FtZXJhO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyAmJiBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZyk7XG5cbiAgICAgICAgLy8gdHJpZ2dlciBwb3N0cHJvY2Vzc2luZyBmb3IgY2FtZXJhXG4gICAgICAgIGNhbWVyYS5vblBvc3Rwcm9jZXNzaW5nKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcgfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJSZW5kZXJQYXNzIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJyZW5kZXJlciIsInJlbmRlckFjdGlvbiIsInJlcXVpcmVzQ3ViZW1hcHMiLCJleGVjdXRlIiwiY2FtZXJhIiwiRGVidWciLCJhc3NlcnQiLCJ0cmlnZ2VyUG9zdHByb2Nlc3MiLCJvblBvc3Rwcm9jZXNzaW5nIl0sIm1hcHBpbmdzIjoiOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsd0JBQXdCLFNBQVNDLFVBQVUsQ0FBQztBQUM5Q0MsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLFlBQVksRUFBRTtJQUN4QyxLQUFLLENBQUNGLE1BQU0sQ0FBQyxDQUFBO0lBQ2IsSUFBSSxDQUFDQyxRQUFRLEdBQUdBLFFBQVEsQ0FBQTtJQUN4QixJQUFJLENBQUNDLFlBQVksR0FBR0EsWUFBWSxDQUFBO0lBRWhDLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLEdBQUE7QUFFQUMsRUFBQUEsT0FBT0EsR0FBRztBQUVOLElBQUEsTUFBTUYsWUFBWSxHQUFHLElBQUksQ0FBQ0EsWUFBWSxDQUFBO0FBQ3RDLElBQUEsTUFBTUcsTUFBTSxHQUFHSCxZQUFZLENBQUNHLE1BQU0sQ0FBQTtJQUNsQ0MsS0FBSyxDQUFDQyxNQUFNLENBQUNMLFlBQVksQ0FBQ00sa0JBQWtCLElBQUlILE1BQU0sQ0FBQ0ksZ0JBQWdCLENBQUMsQ0FBQTs7QUFFeEU7SUFDQUosTUFBTSxDQUFDSSxnQkFBZ0IsRUFBRSxDQUFBO0FBQzdCLEdBQUE7QUFDSjs7OzsifQ==