import { BLEND_NONE, DITHER_NONE, FOG_NONE, GAMMA_NONE } from '../../constants.js';

/**
 * The lit shader options determines how the lit-shader gets generated. It specifies a set of
 * parameters which triggers different fragment and vertex shader generation in the backend.
 *
 * @category Graphics
 */
class LitShaderOptions {
  constructor() {
    this.hasTangents = false;
    /**
     * Object containing custom shader chunks that will replace default ones.
     *
     * @type {Object<string, string>}
     */
    this.chunks = {};
    // one of the SHADER_ constants
    this.pass = 0;
    /**
     * Enable alpha testing. See {@link Material#alphaTest}.
     *
     * @type {boolean}
     */
    this.alphaTest = false;
    /**
     * The value of {@link Material#blendType}.
     *
     * @type {number}
     */
    this.blendType = BLEND_NONE;
    this.separateAmbient = false;
    this.screenSpace = false;
    this.skin = false;
    /**
     * If hardware instancing compatible shader should be generated. Transform is read from
     * per-instance {@link VertexBuffer} instead of shader's uniforms.
     *
     * @type {boolean}
     */
    this.useInstancing = false;
    /**
     * If morphing code should be generated to morph positions.
     *
     * @type {boolean}
     */
    this.useMorphPosition = false;
    /**
     * If morphing code should be generated to morph normals.
     *
     * @type {boolean}
     */
    this.useMorphNormal = false;
    this.useMorphTextureBased = false;
    this.nineSlicedMode = 0;
    this.clusteredLightingEnabled = true;
    this.clusteredLightingCookiesEnabled = false;
    this.clusteredLightingShadowsEnabled = false;
    this.clusteredLightingShadowType = 0;
    this.clusteredLightingAreaLightsEnabled = false;
    this.vertexColors = false;
    this.lightMapEnabled = false;
    this.dirLightMapEnabled = false;
    this.useHeights = false;
    this.useNormals = false;
    this.useClearCoatNormals = false;
    this.useAo = false;
    this.diffuseMapEnabled = false;
    this.useAmbientTint = false;
    /**
     * Replaced the whole fragment shader with this string.
     *
     * @type {string}
     */
    this.customFragmentShader = null;
    this.pixelSnap = false;
    /**
     * The value of {@link StandardMaterial#shadingModel}.
     *
     * @type {number}
     */
    this.shadingModel = 0;
    /**
     * If ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap ambient on
     * certain platforms (mostly Android) for performance reasons.
     *
     * @type {boolean}
     */
    this.ambientSH = false;
    /**
     * Use slightly cheaper normal mapping code (skip tangent space normalization). Can look buggy
     * sometimes.
     *
     * @type {boolean}
     */
    this.fastTbn = false;
    /**
     * The value of {@link StandardMaterial#twoSidedLighting}.
     *
     * @type {boolean}
     */
    this.twoSidedLighting = false;
    /**
     * The value of {@link StandardMaterial#occludeDirect}.
     *
     * @type {boolean}
     */
    this.occludeDirect = false;
    /**
     * The value of {@link StandardMaterial#occludeSpecular}.
     *
     * @type {number}
     */
    this.occludeSpecular = 0;
    /**
     * Defines if {@link StandardMaterial#occludeSpecularIntensity} constant should affect specular
     * occlusion.
     *
     * @type {boolean}
     */
    this.occludeSpecularFloat = false;
    this.useMsdf = false;
    this.msdfTextAttribute = false;
    /**
     * Enable alpha to coverage. See {@link Material#alphaToCoverage}.
     *
     * @type {boolean}
     */
    this.alphaToCoverage = false;
    /**
     * Enable specular fade. See {@link StandardMaterial#opacityFadesSpecular}.
     *
     * @type {boolean}
     */
    this.opacityFadesSpecular = false;
    /**
     * Enable opacity dithering. See {@link StandardMaterial#opacityDither}.
     *
     * @type {string}
     */
    this.opacityDither = DITHER_NONE;
    /**
     * Enable opacity shadow dithering. See {@link StandardMaterial#opacityShadowDither}.
     *
     * @type {string}
     */
    this.opacityShadowDither = DITHER_NONE;
    /**
     * The value of {@link StandardMaterial#cubeMapProjection}.
     *
     * @type {number}
     */
    this.cubeMapProjection = 0;
    /**
     * The value of {@link StandardMaterial#conserveEnergy}.
     *
     * @type {boolean}
     */
    this.conserveEnergy = false;
    /**
     * If any specular or reflections are needed at all.
     *
     * @type {boolean}
     */
    this.useSpecular = false;
    this.useSpecularityFactor = false;
    this.enableGGXSpecular = false;
    /**
     * The value of {@link StandardMaterial#fresnelModel}.
     *
     * @type {number}
     */
    this.fresnelModel = 0;
    /**
     * If refraction is used.
     *
     * @type {boolean}
     */
    this.useRefraction = false;
    this.useClearCoat = false;
    this.useSheen = false;
    this.useIridescence = false;
    /**
     * The value of {@link StandardMaterial#useMetalness}.
     *
     * @type {boolean}
     */
    this.useMetalness = false;
    this.useDynamicRefraction = false;
    /**
     * The type of fog being applied in the shader. See {@link Scene#fog} for the list of possible
     * values.
     *
     * @type {string}
     */
    this.fog = FOG_NONE;
    /**
     * The type of gamma correction being applied in the shader. See {@link Scene#gammaCorrection}
     * for the list of possible values.
     *
     * @type {number}
     */
    this.gamma = GAMMA_NONE;
    /**
     * The type of tone mapping being applied in the shader. See {@link Scene#toneMapping} for the
     * list of possible values.
     *
     * @type {number}
     */
    this.toneMap = -1;
    /**
     * If cubemaps require seam fixing (see the `fixCubemapSeams` property of the options object
     * passed to the {@link Texture} constructor).
     *
     * @type {boolean}
     */
    this.fixSeams = false;
    /**
     * One of "envAtlasHQ", "envAtlas", "cubeMap", "sphereMap".
     *
     * @type {string}
     */
    this.reflectionSource = null;
    this.reflectionEncoding = null;
    this.reflectionCubemapEncoding = null;
    /**
     * One of "ambientSH", "envAtlas", "constant".
     *
     * @type {string}
     */
    this.ambientSource = 'constant';
    this.ambientEncoding = null;
    // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now
    // assume no non-skybox cubemap rotation
    /**
     * Skybox intensity factor.
     *
     * @type {number}
     */
    this.skyboxIntensity = 1.0;
    /**
     * If cube map rotation is enabled.
     *
     * @type {boolean}
     */
    this.useCubeMapRotation = false;
    this.lightMapWithoutAmbient = false;
    this.lights = [];
    this.noShadow = false;
    this.lightMaskDynamic = 0x0;
    /**
     * Object containing a map of user defined vertex attributes to attached shader semantics.
     *
     * @type {Object<string, string>}
     */
    this.userAttributes = {};
  }
}

export { LitShaderOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LXNoYWRlci1vcHRpb25zLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtcy9saXQtc2hhZGVyLW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQkxFTkRfTk9ORSwgRElUSEVSX05PTkUsIEZPR19OT05FLCBHQU1NQV9OT05FIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBUaGUgbGl0IHNoYWRlciBvcHRpb25zIGRldGVybWluZXMgaG93IHRoZSBsaXQtc2hhZGVyIGdldHMgZ2VuZXJhdGVkLiBJdCBzcGVjaWZpZXMgYSBzZXQgb2ZcbiAqIHBhcmFtZXRlcnMgd2hpY2ggdHJpZ2dlcnMgZGlmZmVyZW50IGZyYWdtZW50IGFuZCB2ZXJ0ZXggc2hhZGVyIGdlbmVyYXRpb24gaW4gdGhlIGJhY2tlbmQuXG4gKlxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmNsYXNzIExpdFNoYWRlck9wdGlvbnMge1xuICAgIGhhc1RhbmdlbnRzID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBPYmplY3QgY29udGFpbmluZyBjdXN0b20gc2hhZGVyIGNodW5rcyB0aGF0IHdpbGwgcmVwbGFjZSBkZWZhdWx0IG9uZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgKi9cbiAgICBjaHVua3MgPSB7fTtcblxuICAgIC8vIG9uZSBvZiB0aGUgU0hBREVSXyBjb25zdGFudHNcbiAgICBwYXNzID0gMDtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBhbHBoYSB0ZXN0aW5nLiBTZWUge0BsaW5rIE1hdGVyaWFsI2FscGhhVGVzdH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbHBoYVRlc3QgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB2YWx1ZSBvZiB7QGxpbmsgTWF0ZXJpYWwjYmxlbmRUeXBlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcblxuICAgIHNlcGFyYXRlQW1iaWVudCA9IGZhbHNlO1xuXG4gICAgc2NyZWVuU3BhY2UgPSBmYWxzZTtcblxuICAgIHNraW4gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIElmIGhhcmR3YXJlIGluc3RhbmNpbmcgY29tcGF0aWJsZSBzaGFkZXIgc2hvdWxkIGJlIGdlbmVyYXRlZC4gVHJhbnNmb3JtIGlzIHJlYWQgZnJvbVxuICAgICAqIHBlci1pbnN0YW5jZSB7QGxpbmsgVmVydGV4QnVmZmVyfSBpbnN0ZWFkIG9mIHNoYWRlcidzIHVuaWZvcm1zLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgdXNlSW5zdGFuY2luZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSWYgbW9ycGhpbmcgY29kZSBzaG91bGQgYmUgZ2VuZXJhdGVkIHRvIG1vcnBoIHBvc2l0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZU1vcnBoUG9zaXRpb24gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIElmIG1vcnBoaW5nIGNvZGUgc2hvdWxkIGJlIGdlbmVyYXRlZCB0byBtb3JwaCBub3JtYWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgdXNlTW9ycGhOb3JtYWwgPSBmYWxzZTtcblxuICAgIHVzZU1vcnBoVGV4dHVyZUJhc2VkID0gZmFsc2U7XG5cbiAgICBuaW5lU2xpY2VkTW9kZSA9IDA7XG5cbiAgICBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0cnVlO1xuXG4gICAgY2x1c3RlcmVkTGlnaHRpbmdDb29raWVzRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dUeXBlID0gMDtcblxuICAgIGNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQgPSBmYWxzZTtcblxuICAgIHZlcnRleENvbG9ycyA9IGZhbHNlO1xuXG4gICAgbGlnaHRNYXBFbmFibGVkID0gZmFsc2U7XG5cbiAgICBkaXJMaWdodE1hcEVuYWJsZWQgPSBmYWxzZTtcblxuICAgIHVzZUhlaWdodHMgPSBmYWxzZTtcblxuICAgIHVzZU5vcm1hbHMgPSBmYWxzZTtcblxuICAgIHVzZUNsZWFyQ29hdE5vcm1hbHMgPSBmYWxzZTtcblxuICAgIHVzZUFvID0gZmFsc2U7XG5cbiAgICBkaWZmdXNlTWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgdXNlQW1iaWVudFRpbnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFJlcGxhY2VkIHRoZSB3aG9sZSBmcmFnbWVudCBzaGFkZXIgd2l0aCB0aGlzIHN0cmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgY3VzdG9tRnJhZ21lbnRTaGFkZXIgPSBudWxsO1xuXG4gICAgcGl4ZWxTbmFwID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjc2hhZGluZ01vZGVsfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2hhZGluZ01vZGVsID0gMDtcblxuICAgIC8qKlxuICAgICAqIElmIGFtYmllbnQgc3BoZXJpY2FsIGhhcm1vbmljcyBhcmUgdXNlZC4gQW1iaWVudCBTSCByZXBsYWNlIHByZWZpbHRlcmVkIGN1YmVtYXAgYW1iaWVudCBvblxuICAgICAqIGNlcnRhaW4gcGxhdGZvcm1zIChtb3N0bHkgQW5kcm9pZCkgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbWJpZW50U0ggPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFVzZSBzbGlnaHRseSBjaGVhcGVyIG5vcm1hbCBtYXBwaW5nIGNvZGUgKHNraXAgdGFuZ2VudCBzcGFjZSBub3JtYWxpemF0aW9uKS4gQ2FuIGxvb2sgYnVnZ3lcbiAgICAgKiBzb21ldGltZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmYXN0VGJuID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjdHdvU2lkZWRMaWdodGluZ30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb2NjbHVkZURpcmVjdH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvY2NsdWRlRGlyZWN0ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb2NjbHVkZVNwZWN1bGFyfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgb2NjbHVkZVNwZWN1bGFyID0gMDtcblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5fSBjb25zdGFudCBzaG91bGQgYWZmZWN0IHNwZWN1bGFyXG4gICAgICogb2NjbHVzaW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgb2NjbHVkZVNwZWN1bGFyRmxvYXQgPSBmYWxzZTtcblxuICAgIHVzZU1zZGYgPSBmYWxzZTtcblxuICAgIG1zZGZUZXh0QXR0cmlidXRlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UuIFNlZSB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFUb0NvdmVyYWdlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHNwZWN1bGFyIGZhZGUuIFNlZSB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvcGFjaXR5RmFkZXNTcGVjdWxhcn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvcGFjaXR5RmFkZXNTcGVjdWxhciA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIG9wYWNpdHkgZGl0aGVyaW5nLiBTZWUge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb3BhY2l0eURpdGhlcn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG9wYWNpdHlEaXRoZXIgPSBESVRIRVJfTk9ORTtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBvcGFjaXR5IHNoYWRvdyBkaXRoZXJpbmcuIFNlZSB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvcGFjaXR5U2hhZG93RGl0aGVyfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgb3BhY2l0eVNoYWRvd0RpdGhlciA9IERJVEhFUl9OT05FO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2N1YmVNYXBQcm9qZWN0aW9ufS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgY3ViZU1hcFByb2plY3Rpb24gPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2NvbnNlcnZlRW5lcmd5fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGNvbnNlcnZlRW5lcmd5ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJZiBhbnkgc3BlY3VsYXIgb3IgcmVmbGVjdGlvbnMgYXJlIG5lZWRlZCBhdCBhbGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB1c2VTcGVjdWxhciA9IGZhbHNlO1xuXG4gICAgdXNlU3BlY3VsYXJpdHlGYWN0b3IgPSBmYWxzZTtcblxuICAgIGVuYWJsZUdHWFNwZWN1bGFyID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZnJlc25lbE1vZGVsfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZnJlc25lbE1vZGVsID0gMDtcblxuICAgIC8qKlxuICAgICAqIElmIHJlZnJhY3Rpb24gaXMgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZVJlZnJhY3Rpb24gPSBmYWxzZTtcblxuICAgIHVzZUNsZWFyQ29hdCA9IGZhbHNlO1xuXG4gICAgdXNlU2hlZW4gPSBmYWxzZTtcblxuICAgIHVzZUlyaWRlc2NlbmNlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjdXNlTWV0YWxuZXNzfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZU1ldGFsbmVzcyA9IGZhbHNlO1xuXG4gICAgdXNlRHluYW1pY1JlZnJhY3Rpb24gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIGZvZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjZm9nfSBmb3IgdGhlIGxpc3Qgb2YgcG9zc2libGVcbiAgICAgKiB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZvZyA9IEZPR19OT05FO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgZ2FtbWEgY29ycmVjdGlvbiBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjZ2FtbWFDb3JyZWN0aW9ufVxuICAgICAqIGZvciB0aGUgbGlzdCBvZiBwb3NzaWJsZSB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdhbW1hID0gR0FNTUFfTk9ORTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRvbmUgbWFwcGluZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjdG9uZU1hcHBpbmd9IGZvciB0aGVcbiAgICAgKiBsaXN0IG9mIHBvc3NpYmxlIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdG9uZU1hcCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogSWYgY3ViZW1hcHMgcmVxdWlyZSBzZWFtIGZpeGluZyAoc2VlIHRoZSBgZml4Q3ViZW1hcFNlYW1zYCBwcm9wZXJ0eSBvZiB0aGUgb3B0aW9ucyBvYmplY3RcbiAgICAgKiBwYXNzZWQgdG8gdGhlIHtAbGluayBUZXh0dXJlfSBjb25zdHJ1Y3RvcikuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmaXhTZWFtcyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogT25lIG9mIFwiZW52QXRsYXNIUVwiLCBcImVudkF0bGFzXCIsIFwiY3ViZU1hcFwiLCBcInNwaGVyZU1hcFwiLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICByZWZsZWN0aW9uU291cmNlID0gbnVsbDtcblxuICAgIHJlZmxlY3Rpb25FbmNvZGluZyA9IG51bGw7XG5cbiAgICByZWZsZWN0aW9uQ3ViZW1hcEVuY29kaW5nID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIE9uZSBvZiBcImFtYmllbnRTSFwiLCBcImVudkF0bGFzXCIsIFwiY29uc3RhbnRcIi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgYW1iaWVudFNvdXJjZSA9ICdjb25zdGFudCc7XG5cbiAgICBhbWJpZW50RW5jb2RpbmcgPSBudWxsO1xuXG4gICAgLy8gVE9ETzogYWRkIGEgdGVzdCBmb3IgaWYgbm9uIHNreWJveCBjdWJlbWFwcyBoYXZlIHJvdGF0aW9uICh3aGVuIHRoaXMgaXMgc3VwcG9ydGVkKSAtIGZvciBub3dcbiAgICAvLyBhc3N1bWUgbm8gbm9uLXNreWJveCBjdWJlbWFwIHJvdGF0aW9uXG5cbiAgICAvKipcbiAgICAgKiBTa3lib3ggaW50ZW5zaXR5IGZhY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2t5Ym94SW50ZW5zaXR5ID0gMS4wO1xuXG4gICAgLyoqXG4gICAgICogSWYgY3ViZSBtYXAgcm90YXRpb24gaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZUN1YmVNYXBSb3RhdGlvbiA9IGZhbHNlO1xuXG4gICAgbGlnaHRNYXBXaXRob3V0QW1iaWVudCA9IGZhbHNlO1xuXG4gICAgbGlnaHRzID0gW107XG5cbiAgICBub1NoYWRvdyA9IGZhbHNlO1xuXG4gICAgbGlnaHRNYXNrRHluYW1pYyA9IDB4MDtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCBjb250YWluaW5nIGEgbWFwIG9mIHVzZXIgZGVmaW5lZCB2ZXJ0ZXggYXR0cmlidXRlcyB0byBhdHRhY2hlZCBzaGFkZXIgc2VtYW50aWNzLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIHN0cmluZz59XG4gICAgICovXG4gICAgdXNlckF0dHJpYnV0ZXMgPSB7fTtcbn1cblxuZXhwb3J0IHsgTGl0U2hhZGVyT3B0aW9ucyB9O1xuIl0sIm5hbWVzIjpbIkxpdFNoYWRlck9wdGlvbnMiLCJjb25zdHJ1Y3RvciIsImhhc1RhbmdlbnRzIiwiY2h1bmtzIiwicGFzcyIsImFscGhhVGVzdCIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJzZXBhcmF0ZUFtYmllbnQiLCJzY3JlZW5TcGFjZSIsInNraW4iLCJ1c2VJbnN0YW5jaW5nIiwidXNlTW9ycGhQb3NpdGlvbiIsInVzZU1vcnBoTm9ybWFsIiwidXNlTW9ycGhUZXh0dXJlQmFzZWQiLCJuaW5lU2xpY2VkTW9kZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkIiwiY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dUeXBlIiwiY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCIsInZlcnRleENvbG9ycyIsImxpZ2h0TWFwRW5hYmxlZCIsImRpckxpZ2h0TWFwRW5hYmxlZCIsInVzZUhlaWdodHMiLCJ1c2VOb3JtYWxzIiwidXNlQ2xlYXJDb2F0Tm9ybWFscyIsInVzZUFvIiwiZGlmZnVzZU1hcEVuYWJsZWQiLCJ1c2VBbWJpZW50VGludCIsImN1c3RvbUZyYWdtZW50U2hhZGVyIiwicGl4ZWxTbmFwIiwic2hhZGluZ01vZGVsIiwiYW1iaWVudFNIIiwiZmFzdFRibiIsInR3b1NpZGVkTGlnaHRpbmciLCJvY2NsdWRlRGlyZWN0Iiwib2NjbHVkZVNwZWN1bGFyIiwib2NjbHVkZVNwZWN1bGFyRmxvYXQiLCJ1c2VNc2RmIiwibXNkZlRleHRBdHRyaWJ1dGUiLCJhbHBoYVRvQ292ZXJhZ2UiLCJvcGFjaXR5RmFkZXNTcGVjdWxhciIsIm9wYWNpdHlEaXRoZXIiLCJESVRIRVJfTk9ORSIsIm9wYWNpdHlTaGFkb3dEaXRoZXIiLCJjdWJlTWFwUHJvamVjdGlvbiIsImNvbnNlcnZlRW5lcmd5IiwidXNlU3BlY3VsYXIiLCJ1c2VTcGVjdWxhcml0eUZhY3RvciIsImVuYWJsZUdHWFNwZWN1bGFyIiwiZnJlc25lbE1vZGVsIiwidXNlUmVmcmFjdGlvbiIsInVzZUNsZWFyQ29hdCIsInVzZVNoZWVuIiwidXNlSXJpZGVzY2VuY2UiLCJ1c2VNZXRhbG5lc3MiLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsImZvZyIsIkZPR19OT05FIiwiZ2FtbWEiLCJHQU1NQV9OT05FIiwidG9uZU1hcCIsImZpeFNlYW1zIiwicmVmbGVjdGlvblNvdXJjZSIsInJlZmxlY3Rpb25FbmNvZGluZyIsInJlZmxlY3Rpb25DdWJlbWFwRW5jb2RpbmciLCJhbWJpZW50U291cmNlIiwiYW1iaWVudEVuY29kaW5nIiwic2t5Ym94SW50ZW5zaXR5IiwidXNlQ3ViZU1hcFJvdGF0aW9uIiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsImxpZ2h0cyIsIm5vU2hhZG93IiwibGlnaHRNYXNrRHluYW1pYyIsInVzZXJBdHRyaWJ1dGVzIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGdCQUFnQixDQUFDO0VBQUFDLFdBQUEsR0FBQTtJQUFBLElBQ25CQyxDQUFBQSxXQUFXLEdBQUcsS0FBSyxDQUFBO0FBRW5CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxNQUFNLEdBQUcsRUFBRSxDQUFBO0FBRVg7SUFBQSxJQUNBQyxDQUFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFBO0FBRVI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFFakI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFNBQVMsR0FBR0MsVUFBVSxDQUFBO0lBQUEsSUFFdEJDLENBQUFBLGVBQWUsR0FBRyxLQUFLLENBQUE7SUFBQSxJQUV2QkMsQ0FBQUEsV0FBVyxHQUFHLEtBQUssQ0FBQTtJQUFBLElBRW5CQyxDQUFB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
