/**
 * AppOptions is an object that holds configuration settings utilized in the creation of AppBase. It
 * allows functionality to be included or excluded from the AppBase instance.
 */
class AppOptions {
  constructor() {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    this.elementInput = void 0;
    /**
     * Keyboard handler for input.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    this.keyboard = void 0;
    /**
     * Mouse handler for input.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    this.mouse = void 0;
    /**
     * TouchDevice handler for input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    this.touch = void 0;
    /**
     * Gamepad handler for input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
     */
    this.gamepads = void 0;
    /**
     * Prefix to apply to script urls before loading.
     *
     * @type {string}
     */
    this.scriptPrefix = void 0;
    /**
     * Prefix to apply to asset urls before loading.
     *
     * @type {string}
     */
    this.assetPrefix = void 0;
    /**
     * Scripts in order of loading first.
     *
     * @type {string[]}
     */
    this.scriptsOrder = void 0;
    /**
     * The sound manager
     *
     * @type {import('../platform/sound/manager.js').SoundManager}
     */
    this.soundManager = void 0;
    /**
     * The graphics device.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.graphicsDevice = void 0;
    /**
     * The lightmapper.
     *
     * @type {typeof import('./lightmapper/lightmapper.js').Lightmapper}
     */
    this.lightmapper = void 0;
    /**
     * The BatchManager.
     *
     * @type {typeof import('../scene/batching/batch-manager.js').BatchManager}
     */
    this.batchManager = void 0;
    /**
     * The XrManager.
     *
     * @type {typeof import('./xr/xr-manager.js').XrManager}
     */
    this.xr = void 0;
    /**
     * The component systems the app requires.
     *
     * @type {typeof import('./components/system.js').ComponentSystem[]}
     */
    this.componentSystems = [];
    /**
     * The resource handlers the app requires.
     *
     * @type {typeof import('./handlers/handler.js').ResourceHandler[]}
     */
    this.resourceHandlers = [];
  }
}

export { AppOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLW9wdGlvbnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBcHBPcHRpb25zIGlzIGFuIG9iamVjdCB0aGF0IGhvbGRzIGNvbmZpZ3VyYXRpb24gc2V0dGluZ3MgdXRpbGl6ZWQgaW4gdGhlIGNyZWF0aW9uIG9mIEFwcEJhc2UuIEl0XG4gKiBhbGxvd3MgZnVuY3Rpb25hbGl0eSB0byBiZSBpbmNsdWRlZCBvciBleGNsdWRlZCBmcm9tIHRoZSBBcHBCYXNlIGluc3RhbmNlLlxuICovXG5jbGFzcyBBcHBPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBJbnB1dCBoYW5kbGVyIGZvciB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudElucHV0fVxuICAgICAqL1xuICAgIGVsZW1lbnRJbnB1dDtcblxuICAgIC8qKlxuICAgICAqIEtleWJvYXJkIGhhbmRsZXIgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQuanMnKS5LZXlib2FyZH1cbiAgICAgKi9cbiAgICBrZXlib2FyZDtcblxuICAgIC8qKlxuICAgICAqIE1vdXNlIGhhbmRsZXIgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnKS5Nb3VzZX1cbiAgICAgKi9cbiAgICBtb3VzZTtcblxuICAgIC8qKlxuICAgICAqIFRvdWNoRGV2aWNlIGhhbmRsZXIgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZGV2aWNlLmpzJykuVG91Y2hEZXZpY2V9XG4gICAgICovXG4gICAgdG91Y2g7XG5cbiAgICAvKipcbiAgICAgKiBHYW1lcGFkIGhhbmRsZXIgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzJykuR2FtZVBhZHN9XG4gICAgICovXG4gICAgZ2FtZXBhZHM7XG5cbiAgICAvKipcbiAgICAgKiBQcmVmaXggdG8gYXBwbHkgdG8gc2NyaXB0IHVybHMgYmVmb3JlIGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNjcmlwdFByZWZpeDtcblxuICAgIC8qKlxuICAgICAqIFByZWZpeCB0byBhcHBseSB0byBhc3NldCB1cmxzIGJlZm9yZSBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBhc3NldFByZWZpeDtcblxuICAgIC8qKlxuICAgICAqIFNjcmlwdHMgaW4gb3JkZXIgb2YgbG9hZGluZyBmaXJzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBzY3JpcHRzT3JkZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc291bmQgbWFuYWdlclxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgKi9cbiAgICBzb3VuZE1hbmFnZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9XG4gICAgICovXG4gICAgZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlnaHRtYXBwZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7dHlwZW9mIGltcG9ydCgnLi9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfVxuICAgICAqL1xuICAgIGxpZ2h0bWFwcGVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIEJhdGNoTWFuYWdlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHt0eXBlb2YgaW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAqL1xuICAgIGJhdGNoTWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBYck1hbmFnZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7dHlwZW9mIGltcG9ydCgnLi94ci94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfVxuICAgICAqL1xuICAgIHhyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbXBvbmVudCBzeXN0ZW1zIHRoZSBhcHAgcmVxdWlyZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7dHlwZW9mIGltcG9ydCgnLi9jb21wb25lbnRzL3N5c3RlbS5qcycpLkNvbXBvbmVudFN5c3RlbVtdfVxuICAgICAqL1xuICAgIGNvbXBvbmVudFN5c3RlbXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNvdXJjZSBoYW5kbGVycyB0aGUgYXBwIHJlcXVpcmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3R5cGVvZiBpbXBvcnQoJy4vaGFuZGxlcnMvaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlcltdfVxuICAgICAqL1xuICAgIHJlc291cmNlSGFuZGxlcnMgPSBbXTtcbn1cblxuZXhwb3J0IHsgQXBwT3B0aW9ucyB9O1xuIl0sIm5hbWVzIjpbIkFwcE9wdGlvbnMiLCJjb25zdHJ1Y3RvciIsImVsZW1lbnRJbnB1dCIsImtleWJvYXJkIiwibW91c2UiLCJ0b3VjaCIsImdhbWVwYWRzIiwic2NyaXB0UHJlZml4IiwiYXNzZXRQcmVmaXgiLCJzY3JpcHRzT3JkZXIiLCJzb3VuZE1hbmFnZXIiLCJncmFwaGljc0RldmljZSIsImxpZ2h0bWFwcGVyIiwiYmF0Y2hNYW5hZ2VyIiwieHIiLCJjb21wb25lbnRTeXN0ZW1zIiwicmVzb3VyY2VIYW5kbGVycyJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxVQUFVLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQ2I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUw7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFlBQVksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVaO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFZDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxFQUFFLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFRjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0FBRXJCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7QUFBQSxHQUFBO0FBQ3pCOzs7OyJ9
