/**
 * Callback used by {@link ResourceHandler#load} when a resource is loaded (or an error occurs).
 *
 * @callback ResourceHandlerCallback
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [response] - The raw data that has been successfully loaded.
 */

/**
 * Base class for ResourceHandlers used by {@link ResourceLoader}.
 */
class ResourceHandler {
  /**
   * @param {import('../app-base').AppBase} app - The running {@link AppBase}.
   * @param {string} handlerType - The type of the resource the handler handles.
   */
  constructor(app, handlerType) {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    this.handlerType = '';
    /**
     * The running app instance.
     *
     * @type {import('../app-base').AppBase}
     */
    this._app = void 0;
    /** @private */
    this._maxRetries = 0;
    this._app = app;
    this.handlerType = handlerType;
  }

  /**
   * The number of times to retry a failed request for the resource.
   *
   * @type {number}
   */
  set maxRetries(value) {
    this._maxRetries = value;
  }
  get maxRetries() {
    return this._maxRetries;
  }

  /**
   * Load a resource from a remote URL. The base implementation does nothing.
   *
   * @param {string|object} url - Either the URL of the resource to load or a structure
   * containing the load and original URL.
   * @param {string} [url.load] - The URL to be used for loading the resource.
   * @param {string} [url.original] - The original URL to be used for identifying the resource
   * format. This is necessary when loading, for example from blob.
   * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
   * an error occurs.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   */
  load(url, callback, asset) {
    // do nothing
  }

  /**
   * The open function is passed the raw resource data. The handler can then process the data
   * into a format that can be used at runtime. The base implementation simply returns the data.
   *
   * @param {string} url - The URL of the resource to open.
   * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   * @returns {*} The parsed resource data.
   */
  open(url, data, asset) {
    return data;
  }

  /**
   * The patch function performs any operations on a resource that requires a dependency on its
   * asset data or any other asset data. The base implementation does nothing.
   *
   * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
   */
  patch(asset, assets) {
    // do nothing
  }
}

export { ResourceHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9oYW5kbGVycy9oYW5kbGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9IHdoZW4gYSByZXNvdXJjZSBpcyBsb2FkZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIFJlc291cmNlSGFuZGxlckNhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZCBmYWlscy5cbiAqIEBwYXJhbSB7Kn0gW3Jlc3BvbnNlXSAtIFRoZSByYXcgZGF0YSB0aGF0IGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBsb2FkZWQuXG4gKi9cblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBSZXNvdXJjZUhhbmRsZXJzIHVzZWQgYnkge0BsaW5rIFJlc291cmNlTG9hZGVyfS5cbiAqL1xuY2xhc3MgUmVzb3VyY2VIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9ICcnO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJ1bm5pbmcgYXBwIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vYXBwLWJhc2UnKS5BcHBCYXNlfVxuICAgICAqL1xuICAgIF9hcHA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWF4UmV0cmllcyA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UnKS5BcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGhhbmRsZXJUeXBlIC0gVGhlIHR5cGUgb2YgdGhlIHJlc291cmNlIHRoZSBoYW5kbGVyIGhhbmRsZXMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCBoYW5kbGVyVHlwZSkge1xuICAgICAgICB0aGlzLl9hcHAgPSBhcHA7XG4gICAgICAgIHRoaXMuaGFuZGxlclR5cGUgPSBoYW5kbGVyVHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIHJldHJ5IGEgZmFpbGVkIHJlcXVlc3QgZm9yIHRoZSByZXNvdXJjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1heFJldHJpZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWF4UmV0cmllcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBtYXhSZXRyaWVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4UmV0cmllcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGEgcmVzb3VyY2UgZnJvbSBhIHJlbW90ZSBVUkwuIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIGRvZXMgbm90aGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gdXJsIC0gRWl0aGVyIHRoZSBVUkwgb2YgdGhlIHJlc291cmNlIHRvIGxvYWQgb3IgYSBzdHJ1Y3R1cmVcbiAgICAgKiBjb250YWluaW5nIHRoZSBsb2FkIGFuZCBvcmlnaW5hbCBVUkwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt1cmwubG9hZF0gLSBUaGUgVVJMIHRvIGJlIHVzZWQgZm9yIGxvYWRpbmcgdGhlIHJlc291cmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbdXJsLm9yaWdpbmFsXSAtIFRoZSBvcmlnaW5hbCBVUkwgdG8gYmUgdXNlZCBmb3IgaWRlbnRpZnlpbmcgdGhlIHJlc291cmNlXG4gICAgICogZm9ybWF0LiBUaGlzIGlzIG5lY2Vzc2FyeSB3aGVuIGxvYWRpbmcsIGZvciBleGFtcGxlIGZyb20gYmxvYi5cbiAgICAgKiBAcGFyYW0ge1Jlc291cmNlSGFuZGxlckNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc291cmNlIGlzIGxvYWRlZCBvclxuICAgICAqIGFuIGVycm9yIG9jY3Vycy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gW2Fzc2V0XSAtIE9wdGlvbmFsIGFzc2V0IHRoYXQgaXMgcGFzc2VkIGJ5XG4gICAgICogUmVzb3VyY2VMb2FkZXIuXG4gICAgICovXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wZW4gZnVuY3Rpb24gaXMgcGFzc2VkIHRoZSByYXcgcmVzb3VyY2UgZGF0YS4gVGhlIGhhbmRsZXIgY2FuIHRoZW4gcHJvY2VzcyB0aGUgZGF0YVxuICAgICAqIGludG8gYSBmb3JtYXQgdGhhdCBjYW4gYmUgdXNlZCBhdCBydW50aW1lLiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBzaW1wbHkgcmV0dXJucyB0aGUgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSByZXNvdXJjZSB0byBvcGVuLlxuICAgICAqIEBwYXJhbSB7Kn0gZGF0YSAtIFRoZSByYXcgcmVzb3VyY2UgZGF0YSBwYXNzZWQgYnkgY2FsbGJhY2sgZnJvbSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbYXNzZXRdIC0gT3B0aW9uYWwgYXNzZXQgdGhhdCBpcyBwYXNzZWQgYnlcbiAgICAgKiBSZXNvdXJjZUxvYWRlci5cbiAgICAgKiBAcmV0dXJucyB7Kn0gVGhlIHBhcnNlZCByZXNvdXJjZSBkYXRhLlxuICAgICAqL1xuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGF0Y2ggZnVuY3Rpb24gcGVyZm9ybXMgYW55IG9wZXJhdGlvbnMgb24gYSByZXNvdXJjZSB0aGF0IHJlcXVpcmVzIGEgZGVwZW5kZW5jeSBvbiBpdHNcbiAgICAgKiBhc3NldCBkYXRhIG9yIGFueSBvdGhlciBhc3NldCBkYXRhLiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdGhpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdG8gcGF0Y2guXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LXJlZ2lzdHJ5LmpzJykuQXNzZXRSZWdpc3RyeX0gYXNzZXRzIC0gVGhlIGFzc2V0IHJlZ2lzdHJ5LlxuICAgICAqL1xuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICAgICAgLy8gZG8gbm90aGluZ1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVzb3VyY2VIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiUmVzb3VyY2VIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIl9hcHAiLCJfbWF4UmV0cmllcyIsIm1heFJldHJpZXMiLCJ2YWx1ZSIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsImFzc2V0Iiwib3BlbiIsImRhdGEiLCJwYXRjaCIsImFzc2V0cyJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0FBa0JsQjtBQUNKO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxHQUFHLEVBQUVDLFdBQVcsRUFBRTtBQXJCOUI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FBLENBQUFBLFdBQVcsR0FBRyxFQUFFLENBQUE7QUFFaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFSjtJQUFBLElBQ0FDLENBQUFBLFdBQVcsR0FBRyxDQUFDLENBQUE7SUFPWCxJQUFJLENBQUNELElBQUksR0FBR0YsR0FBRyxDQUFBO0lBQ2YsSUFBSSxDQUFDQyxXQUFXLEdBQUdBLFdBQVcsQ0FBQTtBQUNsQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJRyxVQUFVQSxDQUFDQyxLQUFLLEVBQUU7SUFDbEIsSUFBSSxDQUFDRixXQUFXLEdBQUdFLEtBQUssQ0FBQTtBQUM1QixHQUFBO0VBRUEsSUFBSUQsVUFBVUEsR0FBRztJQUNiLE9BQU8sSUFBSSxDQUFDRCxXQUFXLENBQUE7QUFDM0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRyxFQUFBQSxJQUFJQSxDQUFDQyxHQUFHLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFO0FBQ3ZCO0FBQUEsR0FBQTs7QUFHSjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxJQUFJQSxDQUFDSCxHQUFHLEVBQUVJLElBQUksRUFBRUYsS0FBSyxFQUFFO0FBQ25CLElBQUEsT0FBT0UsSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxLQUFLQSxDQUFDSCxLQUFLLEVBQUVJLE1BQU0sRUFBRTtBQUNqQjtBQUFBLEdBQUE7QUFFUjs7OzsifQ==
