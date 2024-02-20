import { path } from '../../core/path.js';
import { GlbContainerParser } from '../parsers/glb-container-parser.js';
import { ResourceHandler } from './handler.js';

/**
 * @interface
 * @name ContainerResource
 * @description Container for a list of animations, textures, materials, renders and a model.
 * @property {import('../asset/asset.js').Asset[]} renders An array of the Render assets.
 * @property {import('../asset/asset.js').Asset[]} materials An array of {@link Material} and/or {@link StandardMaterial} assets.
 * @property {import('../asset/asset.js').Asset[]} textures An array of the {@link Texture} assets.
 * @property {import('../asset/asset.js').Asset[]} animations An array of the {@link Animation} assets.
 * @category Graphics
 */
class ContainerResource {
  /**
   * Instantiates an entity with a model component.
   *
   * @param {object} [options] - The initialization data for the model component type
   * {@link ModelComponent}.
   * @returns {import('../entity.js').Entity} A single entity with a model component. Model
   * component internally contains a hierarchy based on {@link GraphNode}.
   * @example
   * // load a glb file and instantiate an entity with a model component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     const entity = asset.resource.instantiateModelEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   * });
   */
  instantiateModelEntity(options) {
    return null;
  }

  /**
   * Instantiates an entity with a render component.
   *
   * @param {object} [options] - The initialization data for the render component type
   * {@link RenderComponent}.
   * @returns {import('../entity.js').Entity} A hierarchy of entities with render components on
   * entities containing renderable geometry.
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *
   *     // find all render components containing mesh instances, and change blend mode on their materials
   *     const renders = entity.findComponents("render");
   *     renders.forEach(function (render) {
   *         render.meshInstances.forEach(function (meshInstance) {
   *             meshInstance.material.blendType = pc.BLEND_MULTIPLICATIVE;
   *             meshInstance.material.update();
   *         });
   *     });
   * });
   */
  instantiateRenderEntity(options) {
    return null;
  }

  /**
   * Queries the list of available material variants.
   *
   * @returns {string[]} An array of variant names.
   */
  getMaterialVariants() {
    return null;
  }

  /**
   * Applies a material variant to an entity hierarchy.
   *
   * @param {import('../entity.js').Entity} entity - The entity root to which material variants
   * will be applied.
   * @param {string} [name] - The name of the variant, as queried from getMaterialVariants,
   * if null the variant will be reset to the default.
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     const materialVariants = asset.resource.getMaterialVariants();
   *     asset.resource.applyMaterialVariant(entity, materialVariants[0]);
   */
  applyMaterialVariant(entity, name) {}

  /**
   * Applies a material variant to a set of mesh instances. Compared to the applyMaterialVariant,
   * this method allows for setting the variant on a specific set of mesh instances instead of the
   * whole entity.
   *
   * @param {import('../../scene/mesh-instance').MeshInstance[]} instances - An array of mesh
   * instances.
   * @param {string} [name] - The name of the variant, as queried by getMaterialVariants. If
   * null, the variant will be reset to the default.
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     const materialVariants = asset.resource.getMaterialVariants();
   *     const renders = entity.findComponents("render");
   *     for (let i = 0; i < renders.length; i++) {
   *         const renderComponent = renders[i];
   *         asset.resource.applyMaterialVariantInstances(renderComponent.meshInstances, materialVariants[0]);
   *     }
   */
  applyMaterialVariantInstances(instances, name) {}
}

/**
 * Loads files that contain multiple resources. For example glTF files can contain textures, models
 * and animations.
 *
 * For glTF files, the asset options object can be used to pass load time callbacks for handling
 * the various resources at different stages of loading. The table below lists the resource types
 * and the corresponding supported process functions.
 *
 * | resource   | preprocess | process | processAsync | postprocess |
 * | ---------- | :--------: | :-----: | :----------: | :---------: |
 * | global     |      √     |         |              |      √      |
 * | node       |      √     |    √    |              |      √      |
 * | light      |      √     |    √    |              |      √      |
 * | camera     |      √     |    √    |              |      √      |
 * | animation  |      √     |         |              |      √      |
 * | material   |      √     |    √    |              |      √      |
 * | image      |      √     |         |      √       |      √      |
 * | texture    |      √     |         |      √       |      √      |
 * | buffer     |      √     |         |      √       |      √      |
 * | bufferView |      √     |         |      √       |      √      |
 *
 * Additional options that can be passed for glTF files:
 * [options.morphPreserveData] - When true, the morph target keeps its data passed using the options,
 * allowing the clone operation.
 * [options.morphPreferHighPrecision] - When true, high precision storage for morph targets should
 * be preferred. This is faster to create and allows higher precision, but takes more memory and
 * might be slower to render. Defaults to false.
 * [options.skipMeshes] - When true, the meshes from the container are not created. This can be
 * useful if you only need access to textures or animations and similar.
 *
 * For example, to receive a texture preprocess callback:
 *
 * ```javascript
 * const containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess: (gltfTexture) => {
 *             console.log("texture preprocess");
 *         }
 *     }
 * });
 * ```
 *
 * @category Graphics
 */
class ContainerHandler extends ResourceHandler {
  /**
   * Create a new ContainerResource instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @ignore
   */
  constructor(app) {
    super(app, 'container');
    this.glbContainerParser = new GlbContainerParser(app.graphicsDevice, app.assets, 0);
    this.parsers = {};
  }
  set maxRetries(value) {
    this.glbContainerParser.maxRetries = value;
    for (const parser in this.parsers) {
      if (this.parsers.hasOwnProperty(parser)) {
        this.parsers[parser].maxRetries = value;
      }
    }
  }
  get maxRetries() {
    return this.glbContainerParser.maxRetries;
  }

  /**
   * @param {string} url - The resource URL.
   * @returns {string} The URL with query parameters removed.
   * @private
   */
  _getUrlWithoutParams(url) {
    return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
  }

  /**
   * @param {string} url - The resource URL.
   * @returns {*} A suitable parser to parse the resource.
   * @private
   */
  _getParser(url) {
    const ext = url ? path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '') : null;
    return this.parsers[ext] || this.glbContainerParser;
  }

  /**
   * @param {string|object} url - Either the URL of the resource to load or a structure
   * containing the load and original URL.
   * @param {string} [url.load] - The URL to be used for loading the resource.
   * @param {string} [url.original] - The original URL to be used for identifying the resource
   * format. This is necessary when loading, for example from blob.
   * @param {import('./handler.js').ResourceHandlerCallback} callback - The callback used when
   * the resource is loaded or an error occurs.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   */
  load(url, callback, asset) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    this._getParser(url.original).load(url, callback, asset);
  }

  /**
   * @param {string} url - The URL of the resource to open.
   * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   * @returns {*} The parsed resource data.
   */
  open(url, data, asset) {
    return this._getParser(url).open(url, data, asset);
  }
}

export { ContainerHandler, ContainerResource };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2NvbnRhaW5lci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcblxuaW1wb3J0IHsgR2xiQ29udGFpbmVyUGFyc2VyIH0gZnJvbSAnLi4vcGFyc2Vycy9nbGItY29udGFpbmVyLXBhcnNlci5qcyc7XG5cbmltcG9ydCB7IFJlc291cmNlSGFuZGxlciB9IGZyb20gJy4vaGFuZGxlci5qcyc7XG5cbi8qKlxuICogQGludGVyZmFjZVxuICogQG5hbWUgQ29udGFpbmVyUmVzb3VyY2VcbiAqIEBkZXNjcmlwdGlvbiBDb250YWluZXIgZm9yIGEgbGlzdCBvZiBhbmltYXRpb25zLCB0ZXh0dXJlcywgbWF0ZXJpYWxzLCByZW5kZXJzIGFuZCBhIG1vZGVsLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXRbXX0gcmVuZGVycyBBbiBhcnJheSBvZiB0aGUgUmVuZGVyIGFzc2V0cy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0W119IG1hdGVyaWFscyBBbiBhcnJheSBvZiB7QGxpbmsgTWF0ZXJpYWx9IGFuZC9vciB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbH0gYXNzZXRzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXRbXX0gdGV4dHVyZXMgQW4gYXJyYXkgb2YgdGhlIHtAbGluayBUZXh0dXJlfSBhc3NldHMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldFtdfSBhbmltYXRpb25zIEFuIGFycmF5IG9mIHRoZSB7QGxpbmsgQW5pbWF0aW9ufSBhc3NldHMuXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgQ29udGFpbmVyUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIEluc3RhbnRpYXRlcyBhbiBlbnRpdHkgd2l0aCBhIG1vZGVsIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgaW5pdGlhbGl6YXRpb24gZGF0YSBmb3IgdGhlIG1vZGVsIGNvbXBvbmVudCB0eXBlXG4gICAgICoge0BsaW5rIE1vZGVsQ29tcG9uZW50fS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IEEgc2luZ2xlIGVudGl0eSB3aXRoIGEgbW9kZWwgY29tcG9uZW50LiBNb2RlbFxuICAgICAqIGNvbXBvbmVudCBpbnRlcm5hbGx5IGNvbnRhaW5zIGEgaGllcmFyY2h5IGJhc2VkIG9uIHtAbGluayBHcmFwaE5vZGV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gbG9hZCBhIGdsYiBmaWxlIGFuZCBpbnN0YW50aWF0ZSBhbiBlbnRpdHkgd2l0aCBhIG1vZGVsIGNvbXBvbmVudCBiYXNlZCBvbiBpdFxuICAgICAqIGFwcC5hc3NldHMubG9hZEZyb21VcmwoXCJzdGF0dWUuZ2xiXCIsIFwiY29udGFpbmVyXCIsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnN0IGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlTW9kZWxFbnRpdHkoe1xuICAgICAqICAgICAgICAgY2FzdFNoYWRvd3M6IHRydWVcbiAgICAgKiAgICAgfSk7XG4gICAgICogICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5zdGFudGlhdGVNb2RlbEVudGl0eShvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc3RhbnRpYXRlcyBhbiBlbnRpdHkgd2l0aCBhIHJlbmRlciBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIGluaXRpYWxpemF0aW9uIGRhdGEgZm9yIHRoZSByZW5kZXIgY29tcG9uZW50IHR5cGVcbiAgICAgKiB7QGxpbmsgUmVuZGVyQ29tcG9uZW50fS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IEEgaGllcmFyY2h5IG9mIGVudGl0aWVzIHdpdGggcmVuZGVyIGNvbXBvbmVudHMgb25cbiAgICAgKiBlbnRpdGllcyBjb250YWluaW5nIHJlbmRlcmFibGUgZ2VvbWV0cnkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBsb2FkIGEgZ2xiIGZpbGUgYW5kIGluc3RhbnRpYXRlIGFuIGVudGl0eSB3aXRoIGEgcmVuZGVyIGNvbXBvbmVudCBiYXNlZCBvbiBpdFxuICAgICAqIGFwcC5hc3NldHMubG9hZEZyb21VcmwoXCJzdGF0dWUuZ2xiXCIsIFwiY29udGFpbmVyXCIsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnN0IGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlUmVuZGVyRW50aXR5KHtcbiAgICAgKiAgICAgICAgIGNhc3RTaGFkb3dzOiB0cnVlXG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqXG4gICAgICogICAgIC8vIGZpbmQgYWxsIHJlbmRlciBjb21wb25lbnRzIGNvbnRhaW5pbmcgbWVzaCBpbnN0YW5jZXMsIGFuZCBjaGFuZ2UgYmxlbmQgbW9kZSBvbiB0aGVpciBtYXRlcmlhbHNcbiAgICAgKiAgICAgY29uc3QgcmVuZGVycyA9IGVudGl0eS5maW5kQ29tcG9uZW50cyhcInJlbmRlclwiKTtcbiAgICAgKiAgICAgcmVuZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChyZW5kZXIpIHtcbiAgICAgKiAgICAgICAgIHJlbmRlci5tZXNoSW5zdGFuY2VzLmZvckVhY2goZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSkge1xuICAgICAqICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbC5ibGVuZFR5cGUgPSBwYy5CTEVORF9NVUxUSVBMSUNBVElWRTtcbiAgICAgKiAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICogICAgICAgICB9KTtcbiAgICAgKiAgICAgfSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5zdGFudGlhdGVSZW5kZXJFbnRpdHkob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBsaXN0IG9mIGF2YWlsYWJsZSBtYXRlcmlhbCB2YXJpYW50cy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmdbXX0gQW4gYXJyYXkgb2YgdmFyaWFudCBuYW1lcy5cbiAgICAgKi9cbiAgICBnZXRNYXRlcmlhbFZhcmlhbnRzKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIGEgbWF0ZXJpYWwgdmFyaWFudCB0byBhbiBlbnRpdHkgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSByb290IHRvIHdoaWNoIG1hdGVyaWFsIHZhcmlhbnRzXG4gICAgICogd2lsbCBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgdmFyaWFudCwgYXMgcXVlcmllZCBmcm9tIGdldE1hdGVyaWFsVmFyaWFudHMsXG4gICAgICogaWYgbnVsbCB0aGUgdmFyaWFudCB3aWxsIGJlIHJlc2V0IHRvIHRoZSBkZWZhdWx0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gbG9hZCBhIGdsYiBmaWxlIGFuZCBpbnN0YW50aWF0ZSBhbiBlbnRpdHkgd2l0aCBhIHJlbmRlciBjb21wb25lbnQgYmFzZWQgb24gaXRcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwic3RhdHVlLmdsYlwiLCBcImNvbnRhaW5lclwiLCBmdW5jdGlvbiAoZXJyLCBhc3NldCkge1xuICAgICAqICAgICBjb25zdCBlbnRpdHkgPSBhc3NldC5yZXNvdXJjZS5pbnN0YW50aWF0ZVJlbmRlckVudGl0eSh7XG4gICAgICogICAgICAgICBjYXN0U2hhZG93czogdHJ1ZVxuICAgICAqICAgICB9KTtcbiAgICAgKiAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKiAgICAgY29uc3QgbWF0ZXJpYWxWYXJpYW50cyA9IGFzc2V0LnJlc291cmNlLmdldE1hdGVyaWFsVmFyaWFudHMoKTtcbiAgICAgKiAgICAgYXNzZXQucmVzb3VyY2UuYXBwbHlNYXRlcmlhbFZhcmlhbnQoZW50aXR5LCBtYXRlcmlhbFZhcmlhbnRzWzBdKTtcbiAgICAgKi9cbiAgICBhcHBseU1hdGVyaWFsVmFyaWFudChlbnRpdHksIG5hbWUpIHt9XG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIGEgbWF0ZXJpYWwgdmFyaWFudCB0byBhIHNldCBvZiBtZXNoIGluc3RhbmNlcy4gQ29tcGFyZWQgdG8gdGhlIGFwcGx5TWF0ZXJpYWxWYXJpYW50LFxuICAgICAqIHRoaXMgbWV0aG9kIGFsbG93cyBmb3Igc2V0dGluZyB0aGUgdmFyaWFudCBvbiBhIHNwZWNpZmljIHNldCBvZiBtZXNoIGluc3RhbmNlcyBpbnN0ZWFkIG9mIHRoZVxuICAgICAqIHdob2xlIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlJykuTWVzaEluc3RhbmNlW119IGluc3RhbmNlcyAtIEFuIGFycmF5IG9mIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB2YXJpYW50LCBhcyBxdWVyaWVkIGJ5IGdldE1hdGVyaWFsVmFyaWFudHMuIElmXG4gICAgICogbnVsbCwgdGhlIHZhcmlhbnQgd2lsbCBiZSByZXNldCB0byB0aGUgZGVmYXVsdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSByZW5kZXIgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc3QgZW50aXR5ID0gYXNzZXQucmVzb3VyY2UuaW5zdGFudGlhdGVSZW5kZXJFbnRpdHkoe1xuICAgICAqICAgICAgICAgY2FzdFNoYWRvd3M6IHRydWVcbiAgICAgKiAgICAgfSk7XG4gICAgICogICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gICAgICogICAgIGNvbnN0IG1hdGVyaWFsVmFyaWFudHMgPSBhc3NldC5yZXNvdXJjZS5nZXRNYXRlcmlhbFZhcmlhbnRzKCk7XG4gICAgICogICAgIGNvbnN0IHJlbmRlcnMgPSBlbnRpdHkuZmluZENvbXBvbmVudHMoXCJyZW5kZXJcIik7XG4gICAgICogICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICAgICAgY29uc3QgcmVuZGVyQ29tcG9uZW50ID0gcmVuZGVyc1tpXTtcbiAgICAgKiAgICAgICAgIGFzc2V0LnJlc291cmNlLmFwcGx5TWF0ZXJpYWxWYXJpYW50SW5zdGFuY2VzKHJlbmRlckNvbXBvbmVudC5tZXNoSW5zdGFuY2VzLCBtYXRlcmlhbFZhcmlhbnRzWzBdKTtcbiAgICAgKiAgICAgfVxuICAgICAqL1xuICAgIGFwcGx5TWF0ZXJpYWxWYXJpYW50SW5zdGFuY2VzKGluc3RhbmNlcywgbmFtZSkge31cbn1cblxuLyoqXG4gKiBMb2FkcyBmaWxlcyB0aGF0IGNvbnRhaW4gbXVsdGlwbGUgcmVzb3VyY2VzLiBGb3IgZXhhbXBsZSBnbFRGIGZpbGVzIGNhbiBjb250YWluIHRleHR1cmVzLCBtb2RlbHNcbiAqIGFuZCBhbmltYXRpb25zLlxuICpcbiAqIEZvciBnbFRGIGZpbGVzLCB0aGUgYXNzZXQgb3B0aW9ucyBvYmplY3QgY2FuIGJlIHVzZWQgdG8gcGFzcyBsb2FkIHRpbWUgY2FsbGJhY2tzIGZvciBoYW5kbGluZ1xuICogdGhlIHZhcmlvdXMgcmVzb3VyY2VzIGF0IGRpZmZlcmVudCBzdGFnZXMgb2YgbG9hZGluZy4gVGhlIHRhYmxlIGJlbG93IGxpc3RzIHRoZSByZXNvdXJjZSB0eXBlc1xuICogYW5kIHRoZSBjb3JyZXNwb25kaW5nIHN1cHBvcnRlZCBwcm9jZXNzIGZ1bmN0aW9ucy5cbiAqXG4gKiB8IHJlc291cmNlICAgfCBwcmVwcm9jZXNzIHwgcHJvY2VzcyB8IHByb2Nlc3NBc3luYyB8IHBvc3Rwcm9jZXNzIHxcbiAqIHwgLS0tLS0tLS0tLSB8IDotLS0tLS0tLTogfCA6LS0tLS06IHwgOi0tLS0tLS0tLS06IHwgOi0tLS0tLS0tLTogfFxuICogfCBnbG9iYWwgICAgIHwgICAgICDiiJogICAgIHwgICAgICAgICB8ICAgICAgICAgICAgICB8ICAgICAg4oiaICAgICAgfFxuICogfCBub2RlICAgICAgIHwgICAgICDiiJogICAgIHwgICAg4oiaICAgIHwgICAgICAgICAgICAgIHwgICAgICDiiJogICAgICB8XG4gKiB8IGxpZ2h0ICAgICAgfCAgICAgIOKImiAgICAgfCAgICDiiJogICAgfCAgICAgICAgICAgICAgfCAgICAgIOKImiAgICAgIHxcbiAqIHwgY2FtZXJhICAgICB8ICAgICAg4oiaICAgICB8ICAgIOKImiAgICB8ICAgICAgICAgICAgICB8ICAgICAg4oiaICAgICAgfFxuICogfCBhbmltYXRpb24gIHwgICAgICDiiJogICAgIHwgICAgICAgICB8ICAgICAgICAgICAgICB8ICAgICAg4oiaICAgICAgfFxuICogfCBtYXRlcmlhbCAgIHwgICAgICDiiJogICAgIHwgICAg4oiaICAgIHwgICAgICAgICAgICAgIHwgICAgICDiiJogICAgICB8XG4gKiB8IGltYWdlICAgICAgfCAgICAgIOKImiAgICAgfCAgICAgICAgIHwgICAgICDiiJogICAgICAgfCAgICAgIOKImiAgICAgIHxcbiAqIHwgdGV4dHVyZSAgICB8ICAgICAg4oiaICAgICB8ICAgICAgICAgfCAgICAgIOKImiAgICAgICB8ICAgICAg4oiaICAgICAgfFxuICogfCBidWZmZXIgICAgIHwgICAgICDiiJogICAgIHwgICAgICAgICB8ICAgICAg4oiaICAgICAgIHwgICAgICDiiJogICAgICB8XG4gKiB8IGJ1ZmZlclZpZXcgfCAgICAgIOKImiAgICAgfCAgICAgICAgIHwgICAgICDiiJogICAgICAgfCAgICAgIOKImiAgICAgIHxcbiAqXG4gKiBBZGRpdGlvbmFsIG9wdGlvbnMgdGhhdCBjYW4gYmUgcGFzc2VkIGZvciBnbFRGIGZpbGVzOlxuICogW29wdGlvbnMubW9ycGhQcmVzZXJ2ZURhdGFdIC0gV2hlbiB0cnVlLCB0aGUgbW9ycGggdGFyZ2V0IGtlZXBzIGl0cyBkYXRhIHBhc3NlZCB1c2luZyB0aGUgb3B0aW9ucyxcbiAqIGFsbG93aW5nIHRoZSBjbG9uZSBvcGVyYXRpb24uXG4gKiBbb3B0aW9ucy5tb3JwaFByZWZlckhpZ2hQcmVjaXNpb25dIC0gV2hlbiB0cnVlLCBoaWdoIHByZWNpc2lvbiBzdG9yYWdlIGZvciBtb3JwaCB0YXJnZXRzIHNob3VsZFxuICogYmUgcHJlZmVycmVkLiBUaGlzIGlzIGZhc3RlciB0byBjcmVhdGUgYW5kIGFsbG93cyBoaWdoZXIgcHJlY2lzaW9uLCBidXQgdGFrZXMgbW9yZSBtZW1vcnkgYW5kXG4gKiBtaWdodCBiZSBzbG93ZXIgdG8gcmVuZGVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIFtvcHRpb25zLnNraXBNZXNoZXNdIC0gV2hlbiB0cnVlLCB0aGUgbWVzaGVzIGZyb20gdGhlIGNvbnRhaW5lciBhcmUgbm90IGNyZWF0ZWQuIFRoaXMgY2FuIGJlXG4gKiB1c2VmdWwgaWYgeW91IG9ubHkgbmVlZCBhY2Nlc3MgdG8gdGV4dHVyZXMgb3IgYW5pbWF0aW9ucyBhbmQgc2ltaWxhci5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdG8gcmVjZWl2ZSBhIHRleHR1cmUgcHJlcHJvY2VzcyBjYWxsYmFjazpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBjb250YWluZXJBc3NldCA9IG5ldyBwYy5Bc3NldChmaWxlbmFtZSwgJ2NvbnRhaW5lcicsIHsgdXJsOiB1cmwsIGZpbGVuYW1lOiBmaWxlbmFtZSB9LCBudWxsLCB7XG4gKiAgICAgdGV4dHVyZToge1xuICogICAgICAgICBwcmVwcm9jZXNzOiAoZ2x0ZlRleHR1cmUpID0+IHtcbiAqICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidGV4dHVyZSBwcmVwcm9jZXNzXCIpO1xuICogICAgICAgICB9XG4gKiAgICAgfVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuY2xhc3MgQ29udGFpbmVySGFuZGxlciBleHRlbmRzIFJlc291cmNlSGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhaW5lclJlc291cmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwLCAnY29udGFpbmVyJyk7XG5cbiAgICAgICAgdGhpcy5nbGJDb250YWluZXJQYXJzZXIgPSBuZXcgR2xiQ29udGFpbmVyUGFyc2VyKGFwcC5ncmFwaGljc0RldmljZSwgYXBwLmFzc2V0cywgMCk7XG4gICAgICAgIHRoaXMucGFyc2VycyA9IHsgfTtcbiAgICB9XG5cbiAgICBzZXQgbWF4UmV0cmllcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLmdsYkNvbnRhaW5lclBhcnNlci5tYXhSZXRyaWVzID0gdmFsdWU7XG4gICAgICAgIGZvciAoY29uc3QgcGFyc2VyIGluIHRoaXMucGFyc2Vycykge1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyc2Vycy5oYXNPd25Qcm9wZXJ0eShwYXJzZXIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZXJzW3BhcnNlcl0ubWF4UmV0cmllcyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heFJldHJpZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsYkNvbnRhaW5lclBhcnNlci5tYXhSZXRyaWVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgcmVzb3VyY2UgVVJMLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBVUkwgd2l0aCBxdWVyeSBwYXJhbWV0ZXJzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwpIHtcbiAgICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPj0gMCA/IHVybC5zcGxpdCgnPycpWzBdIDogdXJsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgcmVzb3VyY2UgVVJMLlxuICAgICAqIEByZXR1cm5zIHsqfSBBIHN1aXRhYmxlIHBhcnNlciB0byBwYXJzZSB0aGUgcmVzb3VyY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0UGFyc2VyKHVybCkge1xuICAgICAgICBjb25zdCBleHQgPSB1cmwgPyBwYXRoLmdldEV4dGVuc2lvbih0aGlzLl9nZXRVcmxXaXRob3V0UGFyYW1zKHVybCkpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgnLicsICcnKSA6IG51bGw7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlcnNbZXh0XSB8fCB0aGlzLmdsYkNvbnRhaW5lclBhcnNlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHVybCAtIEVpdGhlciB0aGUgVVJMIG9mIHRoZSByZXNvdXJjZSB0byBsb2FkIG9yIGEgc3RydWN0dXJlXG4gICAgICogY29udGFpbmluZyB0aGUgbG9hZCBhbmQgb3JpZ2luYWwgVVJMLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbdXJsLmxvYWRdIC0gVGhlIFVSTCB0byBiZSB1c2VkIGZvciBsb2FkaW5nIHRoZSByZXNvdXJjZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3VybC5vcmlnaW5hbF0gLSBUaGUgb3JpZ2luYWwgVVJMIHRvIGJlIHVzZWQgZm9yIGlkZW50aWZ5aW5nIHRoZSByZXNvdXJjZVxuICAgICAqIGZvcm1hdC4gVGhpcyBpcyBuZWNlc3Nhcnkgd2hlbiBsb2FkaW5nLCBmb3IgZXhhbXBsZSBmcm9tIGJsb2IuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlckNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW5cbiAgICAgKiB0aGUgcmVzb3VyY2UgaXMgbG9hZGVkIG9yIGFuIGVycm9yIG9jY3Vycy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gW2Fzc2V0XSAtIE9wdGlvbmFsIGFzc2V0IHRoYXQgaXMgcGFzc2VkIGJ5XG4gICAgICogUmVzb3VyY2VMb2FkZXIuXG4gICAgICovXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHVybCA9IHtcbiAgICAgICAgICAgICAgICBsb2FkOiB1cmwsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWw6IHVybFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2dldFBhcnNlcih1cmwub3JpZ2luYWwpLmxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSByZXNvdXJjZSB0byBvcGVuLlxuICAgICAqIEBwYXJhbSB7Kn0gZGF0YSAtIFRoZSByYXcgcmVzb3VyY2UgZGF0YSBwYXNzZWQgYnkgY2FsbGJhY2sgZnJvbSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbYXNzZXRdIC0gT3B0aW9uYWwgYXNzZXQgdGhhdCBpcyBwYXNzZWQgYnlcbiAgICAgKiBSZXNvdXJjZUxvYWRlci5cbiAgICAgKiBAcmV0dXJucyB7Kn0gVGhlIHBhcnNlZCByZXNvdXJjZSBkYXRhLlxuICAgICAqL1xuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0UGFyc2VyKHVybCkub3Blbih1cmwsIGRhdGEsIGFzc2V0KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENvbnRhaW5lclJlc291cmNlLCBDb250YWluZXJIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiQ29udGFpbmVyUmVzb3VyY2UiLCJpbnN0YW50aWF0ZU1vZGVsRW50aXR5Iiwib3B0aW9ucyIsImluc3RhbnRpYXRlUmVuZGVyRW50aXR5IiwiZ2V0TWF0ZXJpYWxWYXJpYW50cyIsImFwcGx5TWF0ZXJpYWxWYXJpYW50IiwiZW50aXR5IiwibmFtZSIsImFwcGx5TWF0ZXJpYWxWYXJpYW50SW5zdGFuY2VzIiwiaW5zdGFuY2VzIiwiQ29udGFpbmVySGFuZGxlciIsIlJlc291cmNlSGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiZ2xiQ29udGFpbmVyUGFyc2VyIiwiR2xiQ29udGFpbmVyUGFyc2VyIiwiZ3JhcGhpY3NEZXZpY2UiLCJhc3NldHMiLCJwYXJzZXJzIiwibWF4UmV0cmllcyIsInZhbHVlIiwicGFyc2VyIiwiaGFzT3duUHJvcGVydHkiLCJfZ2V0VXJsV2l0aG91dFBhcmFtcyIsInVybCIsImluZGV4T2YiLCJzcGxpdCIsIl9nZXRQYXJzZXIiLCJleHQiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwidG9Mb3dlckNhc2UiLCJyZXBsYWNlIiwibG9hZCIsImNhbGxiYWNrIiwiYXNzZXQiLCJvcmlnaW5hbCIsIm9wZW4iLCJkYXRhIl0sIm1hcHBpbmdzIjoiOzs7O0FBTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxpQkFBaUIsQ0FBQztBQUNwQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxzQkFBc0JBLENBQUNDLE9BQU8sRUFBRTtBQUM1QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyx1QkFBdUJBLENBQUNELE9BQU8sRUFBRTtBQUM3QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLG1CQUFtQkEsR0FBRztBQUNsQixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLG9CQUFvQkEsQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUUsRUFBQzs7QUFFcEM7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
