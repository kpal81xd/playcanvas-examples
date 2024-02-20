import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { CUBEPROJ_BOX, SPECULAR_PHONG, SHADER_DEPTH, SHADER_PICK, SPECOCC_AO, SPECULAR_BLINN, FRESNEL_SCHLICK, CUBEPROJ_NONE, DITHER_NONE, DETAILMODE_MUL } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { EnvLighting } from '../graphics/env-lighting.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { _matTex2D, standard } from '../shader-lib/programs/standard.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { standardMaterialTextureParameters, standardMaterialCubemapParameters } from './standard-material-parameters.js';

// properties that get created on a standard material
const _props = {};

// special uniform functions on a standard material
const _uniforms = {};

// temporary set of params
let _params = new Set();

/**
 * Callback used by {@link StandardMaterial#onUpdateShader}.
 *
 * @callback UpdateShaderCallback
 * @param {import('./standard-material-options.js').StandardMaterialOptions} options - An object with shader generator settings (based on current
 * material and scene properties), that you can change and then return. Properties of the object passed
 * into this function are documented in {@link StandardMaterial}. Also contains a member named litOptions
 * which holds some of the options only used by the lit shader backend {@link LitShaderOptions}.
 * @returns {import('./standard-material-options.js').StandardMaterialOptions} Returned settings will be used by the shader.
 */

/**
 * A Standard material is the main, general purpose material that is most often used for rendering.
 * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
 * Most maps can use 3 types of input values in any combination: constant (color or number), mesh
 * vertex colors and a texture. All enabled inputs are multiplied together.
 *
 * @property {Color} ambient The ambient color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {Color} diffuse The diffuse color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines basic surface color (aka albedo).
 * @property {boolean} diffuseTint Multiply main (primary) diffuse map and/or diffuse vertex color
 * by the constant diffuse value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} diffuseMap The main
 * (primary) diffuse map of the material (default is null).
 * @property {number} diffuseMapUv Main (primary) diffuse map UV channel.
 * @property {Vec2} diffuseMapTiling Controls the 2D tiling of the main (primary) diffuse map.
 * @property {Vec2} diffuseMapOffset Controls the 2D offset of the main (primary) diffuse map. Each
 * component is between 0 and 1.
 * @property {number} diffuseMapRotation Controls the 2D rotation (in degrees) of the main
 * (primary) diffuse map.
 * @property {string} diffuseMapChannel Color channels of the main (primary) diffuse map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} diffuseVertexColor Use mesh vertex colors for diffuse. If diffuseMap or are
 * diffuseTint are set, they'll be multiplied by vertex colors.
 * @property {string} diffuseVertexColorChannel Vertex color channels to use for diffuse. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {import('../../platform/graphics/texture.js').Texture|null} diffuseDetailMap The
 * detail (secondary) diffuse map of the material (default is null). Will only be used if main
 * (primary) diffuse map is non-null.
 * @property {number} diffuseDetailMapUv Detail (secondary) diffuse map UV channel.
 * @property {Vec2} diffuseDetailMapTiling Controls the 2D tiling of the detail (secondary) diffuse
 * map.
 * @property {Vec2} diffuseDetailMapOffset Controls the 2D offset of the detail (secondary) diffuse
 * map. Each component is between 0 and 1.
 * @property {number} diffuseDetailMapRotation Controls the 2D rotation (in degrees) of the main
 * (secondary) diffuse map.
 * @property {string} diffuseDetailMapChannel Color channels of the detail (secondary) diffuse map
 * to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {string} diffuseDetailMode Determines how the main (primary) and detail (secondary)
 * diffuse maps are blended together. Can be:
 *
 * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
 * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
 * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
 * component-wise.
 * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
 * component-wise.
 *
 * Defaults to {@link DETAILMODE_MUL}.
 * @property {Color} specular The specular color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines surface reflection/specular color.
 * Affects specular intensity and tint.
 * @property {boolean} specularTint Multiply specular map and/or specular vertex color by the
 * constant specular value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} specularMap The specular
 * map of the material (default is null).
 * @property {number} specularMapUv Specular map UV channel.
 * @property {Vec2} specularMapTiling Controls the 2D tiling of the specular map.
 * @property {Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is
 * between 0 and 1.
 * @property {number} specularMapRotation Controls the 2D rotation (in degrees) of the specular map.
 * @property {string} specularMapChannel Color channels of the specular map to use. Can be "r", "g",
 * "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} specularVertexColor Use mesh vertex colors for specular. If specularMap or
 * are specularTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularVertexColorChannel Vertex color channels to use for specular. Can be
 * @property {boolean} specularityFactorTint Multiply specularity factor map and/or specular vertex color by the
 * constant specular value.
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {number} specularityFactor The factor of specular intensity, used to weight the fresnel and specularity. Default is 1.0.
 * @property {import('../../platform/graphics/texture.js').Texture|null} specularityFactorMap The
 * factor of specularity as a texture (default is null).
 * @property {number} specularityFactorMapUv Specularity factor map UV channel.
 * @property {Vec2} specularityFactorMapTiling Controls the 2D tiling of the specularity factor map.
 * @property {Vec2} specularityFactorMapOffset Controls the 2D offset of the specularity factor map. Each component is
 * between 0 and 1.
 * @property {number} specularityFactorMapRotation Controls the 2D rotation (in degrees) of the specularity factor map.
 * @property {string} specularityFactorMapChannel The channel used by the specularity factor texture to sample from (default is 'a').
 * @property {boolean} specularityFactorVertexColor Use mesh vertex colors for specularity factor. If specularityFactorMap or
 * are specularityFactorTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularityFactorVertexColorChannel Vertex color channels to use for specularity factor. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} enableGGXSpecular Enables GGX specular. Also enables
 * {@link StandardMaterial#anisotropy}  parameter to set material anisotropy.
 * @property {number} anisotropy Defines amount of anisotropy. Requires
 * {@link StandardMaterial#enableGGXSpecular} is set to true.
 *
 * - When anisotropy == 0, specular is isotropic.
 * - When anisotropy < 0, anisotropy direction aligns with the tangent, and specular anisotropy
 * increases as the anisotropy value decreases to minimum of -1.
 * - When anisotropy > 0, anisotropy direction aligns with the bi-normal, and specular anisotropy
 * increases as anisotropy value increases to maximum of 1.
 *
 * @property {number} clearCoat Defines intensity of clearcoat layer from 0 to 1. Clearcoat layer
 * is disabled when clearCoat == 0. Default value is 0 (disabled).
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatMap Monochrome
 * clearcoat intensity map (default is null). If specified, will be multiplied by normalized
 * 'clearCoat' value and/or vertex colors.
 * @property {number} clearCoatMapUv Clearcoat intensity map UV channel.
 * @property {Vec2} clearCoatMapTiling Controls the 2D tiling of the clearcoat intensity map.
 * @property {Vec2} clearCoatMapOffset Controls the 2D offset of the clearcoat intensity map. Each
 * component is between 0 and 1.
 * @property {number} clearCoatMapRotation Controls the 2D rotation (in degrees) of the clearcoat
 * intensity map.
 * @property {string} clearCoatMapChannel Color channel of the clearcoat intensity map to use. Can
 * be "r", "g", "b" or "a".
 * @property {boolean} clearCoatVertexColor Use mesh vertex colors for clearcoat intensity. If
 * clearCoatMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatVertexColorChannel Vertex color channel to use for clearcoat
 * intensity. Can be "r", "g", "b" or "a".
 * @property {number} clearCoatGloss Defines the clearcoat glossiness of the clearcoat layer
 * from 0 (rough) to 1 (mirror).
 * @property {boolean} clearCoatGlossInvert Invert the clearcoat gloss component (default is false).
 * Enabling this flag results in material treating the clear coat gloss members as roughness.
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatGlossMap Monochrome
 * clearcoat glossiness map (default is null). If specified, will be multiplied by normalized
 * 'clearCoatGloss' value and/or vertex colors.
 * @property {number} clearCoatGlossMapUv Clearcoat gloss map UV channel.
 * @property {Vec2} clearCoatGlossMapTiling Controls the 2D tiling of the clearcoat gloss map.
 * @property {Vec2} clearCoatGlossMapOffset Controls the 2D offset of the clearcoat gloss map.
 * Each component is between 0 and 1.
 * @property {number} clearCoatGlossMapRotation Controls the 2D rotation (in degrees) of the clear
 * coat gloss map.
 * @property {string} clearCoatGlossMapChannel Color channel of the clearcoat gloss map to use.
 * Can be "r", "g", "b" or "a".
 * @property {boolean} clearCoatGlossVertexColor Use mesh vertex colors for clearcoat glossiness.
 * If clearCoatGlossMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatGlossVertexColorChannel Vertex color channel to use for clearcoat
 * glossiness. Can be "r", "g", "b" or "a".
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatNormalMap The
 * clearcoat normal map of the material (default is null). The texture must contains normalized,
 * tangent space normals.
 * @property {number} clearCoatNormalMapUv Clearcoat normal map UV channel.
 * @property {Vec2} clearCoatNormalMapTiling Controls the 2D tiling of the main clearcoat normal
 * map.
 * @property {Vec2} clearCoatNormalMapOffset Controls the 2D offset of the main clearcoat normal
 * map. Each component is between 0 and 1.
 * @property {number} clearCoatNormalMapRotation Controls the 2D rotation (in degrees) of the main
 * clearcoat map.
 * @property {number} clearCoatBumpiness The bumpiness of the clearcoat layer. This value scales
 * the assigned main clearcoat normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {boolean} useIridescence Enable thin-film iridescence.
 * @property {import('../../platform/graphics/texture.js').Texture|null} iridescenceMap The
 * per-pixel iridescence intensity. Only used when useIridescence is enabled.
 * @property {number} iridescenceMapUv Iridescence map UV channel.
 * @property {Vec2} iridescenceMapTiling Controls the 2D tiling of the iridescence map.
 * @property {Vec2} iridescenceMapOffset Controls the 2D offset of the iridescence map. Each component is
 * between 0 and 1.
 * @property {number} iridescenceMapRotation Controls the 2D rotation (in degrees) of the iridescence
 * map.
 * @property {string} iridescenceMapChannel Color channels of the iridescence map to use. Can be "r",
 * "g", "b" or "a".
 * @property {import('../../platform/graphics/texture.js').Texture|null} iridescenceThicknessMap The
 * per-pixel iridescence thickness. Defines a gradient weight between iridescenceThicknessMin and
 * iridescenceThicknessMax. Only used when useIridescence is enabled.
 * @property {number} iridescenceThicknessMapUv Iridescence thickness map UV channel.
 * @property {Vec2} iridescenceThicknessMapTiling Controls the 2D tiling of the iridescence
 * thickness map.
 * @property {Vec2} iridescenceThicknessMapOffset Controls the 2D offset of the iridescence
 * thickness map. Each component is between 0 and 1.
 * @property {number} iridescenceThicknessMapRotation Controls the 2D rotation (in degrees)
 * of the iridescence map.
 * @property {string} iridescenceThicknessMapChannel Color channels of the iridescence thickness
 * map to use. Can be "r", "g", "b" or "a".
 * @property {number} iridescenceThicknessMin The minimum thickness for the iridescence layer.
 * Only used when an iridescence thickness map is used. The unit is in nm.
 * @property {number} iridescenceThicknessMax The maximum thickness for the iridescence layer.
 * Used as the 'base' thickness when no iridescence thickness map is defined. The unit is in nm.
 * @property {number} iridescenceRefractionIndex The index of refraction of the iridescent
 * thin-film. Affects the color phase shift as described here:
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence
 * @property {boolean} useMetalness Use metalness properties instead of specular. When enabled,
 * diffuse colors also affect specular instead of the dedicated specular map. This can be used as
 * alternative to specular color to save space. With metalness == 0, the pixel is assumed to be
 * dielectric, and diffuse color is used as normal. With metalness == 1, the pixel is fully
 * metallic, and diffuse color is used as specular color instead.
 * @property {boolean} useMetalnessSpecularColor When metalness is enabled, use the
 * specular map to apply color tint to specular reflections.
 * at direct angles.
 * @property {number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1
 * (metal).
 * @property {import('../../platform/graphics/texture.js').Texture|null} metalnessMap Monochrome
 * metalness map (default is null).
 * @property {number} metalnessMapUv Metalness map UV channel.
 * @property {Vec2} metalnessMapTiling Controls the 2D tiling of the metalness map.
 * @property {Vec2} metalnessMapOffset Controls the 2D offset of the metalness map. Each component
 * is between 0 and 1.
 * @property {number} metalnessMapRotation Controls the 2D rotation (in degrees) of the metalness
 * map.
 * @property {string} metalnessMapChannel Color channel of the metalness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} metalnessVertexColor Use mesh vertex colors for metalness. If metalnessMap
 * is set, it'll be multiplied by vertex colors.
 * @property {string} metalnessVertexColorChannel Vertex color channel to use for metalness. Can be
 * "r", "g", "b" or "a".
 * @property {number} gloss Defines the glossiness of the material from 0 (rough) to 1 (shiny).
 * @property {import('../../platform/graphics/texture.js').Texture|null} glossMap Gloss map
 * (default is null). If specified, will be multiplied by normalized gloss value and/or vertex
 * colors.
 * @property {boolean} glossInvert Invert the gloss component (default is false). Enabling this
 * flag results in material treating the gloss members as roughness.
 * @property {number} glossMapUv Gloss map UV channel.
 * @property {string} glossMapChannel Color channel of the gloss map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
 * @property {Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is
 * between 0 and 1.
 * @property {number} glossMapRotation Controls the 2D rotation (in degrees) of the gloss map.
 * @property {boolean} glossVertexColor Use mesh vertex colors for glossiness. If glossMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} glossVertexColorChannel Vertex color channel to use for glossiness. Can be
 * "r", "g", "b" or "a".
 * @property {number} refraction Defines the visibility of refraction. Material can refract the
 * same cube map as used for reflections.
 * @property {import('../../platform/graphics/texture.js').Texture|null} refractionMap The map of
 * the refraction visibility.
 * @property {number} refractionMapUv Refraction map UV channel.
 * @property {Vec2} refractionMapTiling Controls the 2D tiling of the refraction map.
 * @property {Vec2} refractionMapOffset Controls the 2D offset of the refraction map. Each component
 * is between 0 and 1.
 * @property {number} refractionMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} refractionMapChannel Color channels of the refraction map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} refractionVertexColor Use mesh vertex colors for refraction. If
 * refraction map is set, it will be be multiplied by vertex colors.
 * @property {boolean} refractionVertexColorChannel Vertex color channel to use for refraction.
 * Can be "r", "g", "b" or "a".
 * @property {number} refractionIndex Defines the index of refraction, i.e. The amount of
 * distortion. The value is calculated as (outerIor / surfaceIor), where inputs are measured
 * indices of refraction, the one around the object and the one of its own surface. In most
 * situations outer medium is air, so outerIor will be approximately 1. Then you only need to do
 * (1.0 / surfaceIor).
 * @property {boolean} useDynamicRefraction Enables higher quality refractions using the grab pass
 * instead of pre-computed cube maps for refractions.
 * @property {number} thickness The thickness of the medium, only used when useDynamicRefraction
 * is enabled. The unit is in base units, and scales with the size of the object.
 * @property {import('../../platform/graphics/texture.js').Texture|null} thicknessMap The
 * per-pixel thickness of the medium, only used when useDynamicRefraction is enabled.
 * @property {number} thicknessMapUv Thickness map UV channel.
 * @property {Vec2} thicknessMapTiling Controls the 2D tiling of the thickness map.
 * @property {Vec2} thicknessMapOffset Controls the 2D offset of the thickness map. Each component is
 * between 0 and 1.
 * @property {number} thicknessMapRotation Controls the 2D rotation (in degrees) of the thickness
 * map.
 * @property {string} thicknessMapChannel Color channels of the thickness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} thicknessVertexColor Use mesh vertex colors for thickness. If
 * thickness map is set, it will be be multiplied by vertex colors.
 * @property {Color} attenuation The attenuation color for refractive materials, only used when
 * useDynamicRefraction is enabled.
 * @property {number} attenuationDistance The distance defining the absorption rate of light
 * within the medium. Only used when useDynamicRefraction is enabled.
 * @property {Color} emissive The emissive color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {boolean} emissiveTint Multiply emissive map and/or emissive vertex color by the
 * constant emissive value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} emissiveMap The emissive
 * map of the material (default is null). Can be HDR.
 * @property {number} emissiveIntensity Emissive color multiplier.
 * @property {number} emissiveMapUv Emissive map UV channel.
 * @property {Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
 * @property {Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is
 * between 0 and 1.
 * @property {number} emissiveMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} emissiveMapChannel Color channels of the emissive map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} emissiveVertexColor Use mesh vertex colors for emission. If emissiveMap or
 * emissiveTint are set, they'll be multiplied by vertex colors.
 * @property {string} emissiveVertexColorChannel Vertex color channels to use for emission. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} useSheen Toggle sheen specular effect on/off.
 * @property {Color} sheen The specular color of the sheen (fabric) microfiber structure.
 * This color value is 3-component (RGB), where each component is between 0 and 1.
 * @property {boolean} sheenTint Multiply sheen map and/or sheen vertex color by the constant
 * sheen value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sheenMap The sheen
 * microstructure color map of the material (default is null).
 * @property {number} sheenMapUv Sheen map UV channel.
 * @property {Vec2} sheenMapTiling Controls the 2D tiling of the sheen map.
 * @property {Vec2} sheenMapOffset Controls the 2D offset of the sheen map. Each component is
 * between 0 and 1.
 * @property {number} sheenMapRotation Controls the 2D rotation (in degrees) of the sheen
 * map.
 * @property {string} sheenMapChannel Color channels of the sheen map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenVertexColor Use mesh vertex colors for sheen. If sheen map or
 * sheen tint are set, they'll be multiplied by vertex colors.
 * @property {number} sheenGloss The glossiness of the sheen (fabric) microfiber structure.
 * This color value is a single value between 0 and 1.
 * @property {boolean} sheenGlossInvert Invert the sheen gloss component (default is false).
 * Enabling this flag results in material treating the sheen gloss members as roughness.
 * @property {boolean} sheenGlossTint Multiply sheen glossiness map and/or sheen glossiness vertex
 * value by the scalar sheen glossiness value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sheenGlossMap The sheen
 * glossiness microstructure color map of the material (default is null).
 * @property {number} sheenGlossMapUv Sheen map UV channel.
 * @property {Vec2} sheenGlossMapTiling Controls the 2D tiling of the sheen glossiness map.
 * @property {Vec2} sheenGlossMapOffset Controls the 2D offset of the sheen glossiness map.
 * Each component is between 0 and 1.
 * @property {number} sheenGlossMapRotation Controls the 2D rotation (in degrees) of the sheen
 * glossiness map.
 * @property {string} sheenGlossMapChannel Color channels of the sheen glossiness map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenGlossVertexColor Use mesh vertex colors for sheen glossiness.
 * If sheen glossiness map or sheen glossiness tint are set, they'll be multiplied by vertex colors.
 * @property {string} sheenGlossVertexColorChannel Vertex color channels to use for sheen glossiness.
 * Can be "r", "g", "b" or "a".
 * @property {number} opacity The opacity of the material. This value can be between 0 and 1, where
 * 0 is fully transparent and 1 is fully opaque. If you want the material to be semi-transparent
 * you also need to set the {@link Material#blendType} to {@link BLEND_NORMAL},
 * {@link BLEND_ADDITIVE} or any other mode. Also note that for most semi-transparent objects you
 * want {@link Material#depthWrite} to be false, otherwise they can fully occlude objects behind
 * them.
 * @property {import('../../platform/graphics/texture.js').Texture|null} opacityMap The opacity map
 * of the material (default is null).
 * @property {number} opacityMapUv Opacity map UV channel.
 * @property {string} opacityMapChannel Color channel of the opacity map to use. Can be "r", "g",
 * "b" or "a".
 * @property {Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
 * @property {Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is
 * between 0 and 1.
 * @property {number} opacityMapRotation Controls the 2D rotation (in degrees) of the opacity map.
 * @property {boolean} opacityVertexColor Use mesh vertex colors for opacity. If opacityMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} opacityVertexColorChannel Vertex color channels to use for opacity. Can be
 * "r", "g", "b" or "a".
 * @property {boolean} opacityFadesSpecular Used to specify whether specular and reflections are
 * faded out using {@link StandardMaterial#opacity}. Default is true. When set to false use
 * {@link Material#alphaFade} to fade out materials.
 * @property {string} opacityDither Used to specify whether opacity is dithered, which allows
 * transparency without alpha blending. Can be:
 *
 * - {@link DITHER_NONE}: Opacity dithering is disabled.
 * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
 * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise texture.
 *
 * Defaults to {@link DITHER_NONE}.
 * @property {boolean} opacityShadowDither Used to specify whether shadow opacity is dithered, which
 * allows shadow transparency without alpha blending.  Can be:
 *
 * - {@link DITHER_NONE}: Opacity dithering is disabled.
 * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
 * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise texture.
 *
 * Defaults to {@link DITHER_NONE}.
 * @property {number} alphaFade Used to fade out materials when
 * {@link StandardMaterial#opacityFadesSpecular} is set to false.
 * @property {import('../../platform/graphics/texture.js').Texture|null} normalMap The main
 * (primary) normal map of the material (default is null). The texture must contains normalized,
 * tangent space normals.
 * @property {number} normalMapUv Main (primary) normal map UV channel.
 * @property {Vec2} normalMapTiling Controls the 2D tiling of the main (primary) normal map.
 * @property {Vec2} normalMapOffset Controls the 2D offset of the main (primary) normal map. Each
 * component is between 0 and 1.
 * @property {number} normalMapRotation Controls the 2D rotation (in degrees) of the main (primary)
 * normal map.
 * @property {number} bumpiness The bumpiness of the material. This value scales the assigned main
 * (primary) normal map. It should be normally between 0 (no bump mapping) and 1 (full bump
 * mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} normalDetailMap The detail
 * (secondary) normal map of the material (default is null). Will only be used if main (primary)
 * normal map is non-null.
 * @property {number} normalDetailMapUv Detail (secondary) normal map UV channel.
 * @property {Vec2} normalDetailMapTiling Controls the 2D tiling of the detail (secondary) normal
 * map.
 * @property {Vec2} normalDetailMapOffset Controls the 2D offset of the detail (secondary) normal
 * map. Each component is between 0 and 1.
 * @property {number} normalDetailMapRotation Controls the 2D rotation (in degrees) of the detail
 * (secondary) normal map.
 * @property {number} normalDetailMapBumpiness The bumpiness of the material. This value scales the
 * assigned detail (secondary) normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} heightMap The height map
 * of the material (default is null). Used for a view-dependent parallax effect. The texture must
 * represent the height of the surface where darker pixels are lower and lighter pixels are higher.
 * It is recommended to use it together with a normal map.
 * @property {number} heightMapUv Height map UV channel.
 * @property {string} heightMapChannel Color channel of the height map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} heightMapTiling Controls the 2D tiling of the height map.
 * @property {Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is
 * between 0 and 1.
 * @property {number} heightMapRotation Controls the 2D rotation (in degrees) of the height map.
 * @property {number} heightMapFactor Height map multiplier. Affects the strength of the parallax
 * effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} envAtlas The prefiltered
 * environment lighting atlas (default is null). This setting overrides cubeMap and sphereMap and
 * will replace the scene lighting environment.
 * @property {import('../../platform/graphics/texture.js').Texture|null} cubeMap The cubic
 * environment map of the material (default is null). This setting overrides sphereMap and will
 * replace the scene lighting environment.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sphereMap The spherical
 * environment map of the material (default is null). This will replace the scene lighting
 * environment.
 * @property {number} cubeMapProjection The type of projection applied to the cubeMap property:
 * - {@link CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.
 * - {@link CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.
 * Defaults to {@link CUBEPROJ_NONE}.
 * @property {import('../../core/shape/bounding-box.js').BoundingBox} cubeMapProjectionBox The
 * world space axis-aligned bounding box defining the box-projection used for the cubeMap property.
 * Only used when cubeMapProjection is set to {@link CUBEPROJ_BOX}.
 * @property {number} reflectivity Environment map intensity.
 * @property {import('../../platform/graphics/texture.js').Texture|null} lightMap A custom lightmap
 * of the material (default is null). Lightmaps are textures that contain pre-rendered lighting.
 * Can be HDR.
 * @property {number} lightMapUv Lightmap UV channel
 * @property {string} lightMapChannel Color channels of the lightmap to use. Can be "r", "g", "b",
 * "a", "rgb" or any swizzled combination.
 * @property {Vec2} lightMapTiling Controls the 2D tiling of the lightmap.
 * @property {Vec2} lightMapOffset Controls the 2D offset of the lightmap. Each component is
 * between 0 and 1.
 * @property {number} lightMapRotation Controls the 2D rotation (in degrees) of the lightmap.
 * @property {boolean} lightVertexColor Use baked vertex lighting. If lightMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} lightVertexColorChannel Vertex color channels to use for baked lighting. Can
 * be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} ambientTint Enables scene ambient multiplication by material ambient color.
 * @property {import('../../platform/graphics/texture.js').Texture|null} aoMap The main (primary) baked ambient
 * occlusion (AO) map (default is null). Modulates ambient color.
 * @property {number} aoMapUv Main (primary) AO map UV channel
 * @property {string} aoMapChannel Color channel of the main (primary) AO map to use. Can be "r", "g", "b" or "a".
 * @property {Vec2} aoMapTiling Controls the 2D tiling of the main (primary) AO map.
 * @property {Vec2} aoMapOffset Controls the 2D offset of the main (primary) AO map. Each component is between 0
 * and 1.
 * @property {number} aoMapRotation Controls the 2D rotation (in degrees) of the main (primary) AO map.
 * @property {boolean} aoVertexColor Use mesh vertex colors for AO. If aoMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} aoVertexColorChannel Vertex color channels to use for AO. Can be "r", "g",
 * "b" or "a".
 * @property {import('../../platform/graphics/texture.js').Texture|null} aoDetailMap The
 * detail (secondary) baked ambient occlusion (AO) map of the material (default is null). Will only be used if main
 * (primary) ao map is non-null.
 * @property {number} aoDetailMapUv Detail (secondary) AO map UV channel.
 * @property {Vec2} aoDetailMapTiling Controls the 2D tiling of the detail (secondary) AO
 * map.
 * @property {Vec2} aoDetailMapOffset Controls the 2D offset of the detail (secondary) AO
 * map. Each component is between 0 and 1.
 * @property {number} aoDetailMapRotation Controls the 2D rotation (in degrees) of the detail
 * (secondary) AO map.
 * @property {string} aoDetailMapChannel Color channels of the detail (secondary) AO map
 * to use. Can be "r", "g", "b" or "a" (default is "g").
 * @property {string} aoDetailMode Determines how the main (primary) and detail (secondary)
 * AO maps are blended together. Can be:
 *
 * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
 * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
 * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
 * component-wise.
 * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
 * component-wise.
 *
 * Defaults to {@link DETAILMODE_MUL}.
 * @property {number} occludeSpecular Uses ambient occlusion to darken specular/reflection. It's a
 * hack, because real specular occlusion is view-dependent. However, it can be better than nothing.
 *
 * - {@link SPECOCC_NONE}: No specular occlusion
 * - {@link SPECOCC_AO}: Use AO directly to occlude specular.
 * - {@link SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to occlude
 * specular.
 *
 * @property {number} occludeSpecularIntensity Controls visibility of specular occlusion.
 * @property {boolean} occludeDirect Tells if AO should darken directional lighting. Defaults to
 * false.
 * @property {boolean} conserveEnergy Defines how diffuse and specular components are combined when
 * Fresnel is on. It is recommended that you leave this option enabled, although you may want to
 * disable it in case when all reflection comes only from a few light sources, and you don't use an
 * environment map, therefore having mostly black reflection.
 * @property {number} shadingModel Defines the shading model.
 * - {@link SPECULAR_PHONG}: Phong without energy conservation. You should only use it as a
 * backwards compatibility with older projects.
 * - {@link SPECULAR_BLINN}: Energy-conserving Blinn-Phong.
 * @property {number} fresnelModel Defines the formula used for Fresnel effect.
 * As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components
 * are combined. When Fresnel is off, legacy non energy-conserving combining is used. When it is
 * on, combining behavior is defined by conserveEnergy parameter.
 *
 * - {@link FRESNEL_NONE}: No Fresnel.
 * - {@link FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by
 * specular color.
 *
 * @property {boolean} useFog Apply fogging (as configured in scene settings)
 * @property {boolean} useLighting Apply lighting
 * @property {boolean} useSkybox Apply scene skybox as prefiltered environment map
 * @property {boolean} useGammaTonemap Apply gamma correction and tonemapping (as configured in
 * scene settings).
 * @property {boolean} pixelSnap Align vertices to pixel coordinates when rendering. Useful for
 * pixel perfect 2D graphics.
 * @property {boolean} twoSidedLighting Calculate proper normals (and therefore lighting) on
 * backfaces.
 * @property {UpdateShaderCallback} onUpdateShader A custom function that will be called after all
 * shader generator properties are collected and before shader code is generated. This function
 * will receive an object with shader generator settings (based on current material and scene
 * properties), that you can change and then return. Returned value will be used instead. This is
 * mostly useful when rendering the same set of objects, but with different shader variations based
 * on the same material. For example, you may wish to render a depth or normal pass using textures
 * assigned to the material, a reflection pass with simpler shaders and so on. These properties are
 * split into two sections, generic standard material options and lit options. Properties of the
 * standard material options are {@link StandardMaterialOptions} and the options for the lit options
 * are {@link LitShaderOptions}.
 * @augments Material
 * @category Graphics
 */
class StandardMaterial extends Material {
  /**
   * Create a new StandardMaterial instance.
   *
   * @example
   * // Create a new Standard material
   * const material = new pc.StandardMaterial();
   *
   * // Update the material's diffuse and specular properties
   * material.diffuse.set(1, 0, 0);
   * material.specular.set(1, 1, 1);
   *
   * // Notify the material that it has been modified
   * material.update();
   * @example
   * // Create a new Standard material
   * const material = new pc.StandardMaterial();
   *
   * // Assign a texture to the diffuse slot
   * material.diffuseMap = texture;
   *
   * // Use the alpha channel of the texture for alpha testing with a reference value of 0.5
   * material.opacityMap = texture;
   * material.alphaTest = 0.5;
   *
   * // Notify the material that it has been modified
   * material.update();
   */
  constructor() {
    super();
    this.userAttributes = new Map();
    this._dirtyShader = true;

    // storage for texture and cubemap asset references
    this._assetReferences = {};
    this._activeParams = new Set();
    this._activeLightingParams = new Set();
    this.shaderOptBuilder = new StandardMaterialOptionsBuilder();
    this.reset();
  }
  reset() {
    // set default values
    Object.keys(_props).forEach(name => {
      this[`_${name}`] = _props[name].value();
    });

    /**
     * @type {Object<string, string>}
     * @private
     */
    this._chunks = {};
    this._uniformCache = {};
  }
  set shader(shader) {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
  }
  get shader() {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
    return null;
  }

  /**
   * Object containing custom shader chunks that will replace default ones.
   *
   * @type {Object<string, string>}
   */
  set chunks(value) {
    this._dirtyShader = true;
    this._chunks = value;
  }
  get chunks() {
    this._dirtyShader = true;
    return this._chunks;
  }

  /**
   * Copy a `StandardMaterial`.
   *
   * @param {StandardMaterial} source - The material to copy from.
   * @returns {StandardMaterial} The destination material.
   */
  copy(source) {
    super.copy(source);

    // set properties
    Object.keys(_props).forEach(k => {
      this[k] = source[k];
    });

    // clone chunks
    for (const p in source._chunks) {
      if (source._chunks.hasOwnProperty(p)) this._chunks[p] = source._chunks[p];
    }
    return this;
  }

  /**
   * Sets a vertex shader attribute on a material.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {string} semantic - Semantic to map the vertex data. Must match with the semantic set on vertex stream
   * of the mesh.
   * @example
   * mesh.setVertexStream(pc.SEMANTIC_ATTR15, offset, 3);
   * material.setAttribute('offset', pc.SEMANTIC_ATTR15);
   */
  setAttribute(name, semantic) {
    this.userAttributes.set(semantic, name);
  }
  _setParameter(name, value) {
    _params.add(name);
    this.setParameter(name, value);
  }
  _setParameters(parameters) {
    parameters.forEach(v => {
      this._setParameter(v.name, v.value);
    });
  }
  _processParameters(paramsName) {
    const prevParams = this[paramsName];
    prevParams.forEach(param => {
      if (!_params.has(param)) {
        delete this.parameters[param];
      }
    });
    this[paramsName] = _params;
    _params = prevParams;
    _params.clear();
  }
  _updateMap(p) {
    const mname = p + 'Map';
    const map = this[mname];
    if (map) {
      this._setParameter('texture_' + mname, map);
      const tname = mname + 'Transform';
      const uniform = this.getUniform(tname);
      if (uniform) {
        this._setParameters(uniform);
      }
    }
  }

  // allocate a uniform if it doesn't already exist in the uniform cache
  _allocUniform(name, allocFunc) {
    let uniform = this._uniformCache[name];
    if (!uniform) {
      uniform = allocFunc();
      this._uniformCache[name] = uniform;
    }
    return uniform;
  }
  getUniform(name, device, scene) {
    return _uniforms[name](this, device, scene);
  }
  updateUniforms(device, scene) {
    const getUniform = name => {
      return this.getUniform(name, device, scene);
    };
    this._setParameter('material_ambient', getUniform('ambient'));
    if (!this.diffuseMap || this.diffuseTint) {
      this._setParameter('material_diffuse', getUniform('diffuse'));
    }
    if (this.useMetalness) {
      if (!this.metalnessMap || this.metalness < 1) {
        this._setParameter('material_metalness', this.metalness);
      }
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
      if (!this.specularityFactorMap || this.specularityFactorTint) {
        this._setParameter('material_specularityFactor', this.specularityFactor);
      }
      if (!this.sheenMap || this.sheenTint) {
        this._setParameter('material_sheen', getUniform('sheen'));
      }
      if (!this.sheenGlossMap || this.sheenGlossTint) {
        this._setParameter('material_sheenGloss', this.sheenGloss);
      }
      this._setParameter('material_refractionIndex', this.refractionIndex);
    } else {
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
    }
    if (this.enableGGXSpecular) {
      this._setParameter('material_anisotropy', this.anisotropy);
    }
    if (this.clearCoat > 0) {
      this._setParameter('material_clearCoat', this.clearCoat);
      this._setParameter('material_clearCoatGloss', this.clearCoatGloss);
      this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
    }
    this._setParameter('material_gloss', getUniform('gloss'));
    if (!this.emissiveMap || this.emissiveTint) {
      this._setParameter('material_emissive', getUniform('emissive'));
    }
    if (this.emissiveIntensity !== 1) {
      this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
    }
    if (this.refraction > 0) {
      this._setParameter('material_refraction', this.refraction);
    }
    if (this.useDynamicRefraction) {
      this._setParameter('material_thickness', this.thickness);
      this._setParameter('material_attenuation', getUniform('attenuation'));
      this._setParameter('material_invAttenuationDistance', this.attenuationDistance === 0 ? 0 : 1.0 / this.attenuationDistance);
    }
    if (this.useIridescence) {
      this._setParameter('material_iridescence', this.iridescence);
      this._setParameter('material_iridescenceRefractionIndex', this.iridescenceRefractionIndex);
      this._setParameter('material_iridescenceThicknessMin', this.iridescenceThicknessMin);
      this._setParameter('material_iridescenceThicknessMax', this.iridescenceThicknessMax);
    }
    this._setParameter('material_opacity', this.opacity);
    if (this.opacityFadesSpecular === false) {
      this._setParameter('material_alphaFade', this.alphaFade);
    }
    if (this.occludeSpecular) {
      this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
    }
    if (this.cubeMapProjection === CUBEPROJ_BOX) {
      this._setParameter(getUniform('cubeMapProjectionBox'));
    }
    for (const p in _matTex2D) {
      this._updateMap(p);
    }
    if (this.ambientSH) {
      this._setParameter('ambientSH[0]', this.ambientSH);
    }
    if (this.normalMap) {
      this._setParameter('material_bumpiness', this.bumpiness);
    }
    if (this.normalMap && this.normalDetailMap) {
      this._setParameter('material_normalDetailMapBumpiness', this.normalDetailMapBumpiness);
    }
    if (this.heightMap) {
      this._setParameter('material_heightMapFactor', getUniform('heightMapFactor'));
    }
    const isPhong = this.shadingModel === SPECULAR_PHONG;

    // set overridden environment textures
    if (this.envAtlas && this.cubeMap && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);
      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.envAtlas && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);
    } else if (this.cubeMap) {
      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.sphereMap) {
      this._setParameter('texture_sphereMap', this.sphereMap);
    }
    this._setParameter('material_reflectivity', this.reflectivity);

    // remove unused params
    this._processParameters('_activeParams');
    if (this._dirtyShader) {
      this.clearVariants();
    }
  }
  updateEnvUniforms(device, scene) {
    const isPhong = this.shadingModel === SPECULAR_PHONG;
    const hasLocalEnvOverride = this.envAtlas && !isPhong || this.cubeMap || this.sphereMap;
    if (!hasLocalEnvOverride && this.useSkybox) {
      if (scene.envAtlas && scene.skybox && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);
        this._setParameter('texture_cubeMap', scene.skybox);
      } else if (scene.envAtlas && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);
      } else if (scene.skybox) {
        this._setParameter('texture_cubeMap', scene.skybox);
      }
    }
    this._processParameters('_activeLightingParams');
  }
  getShaderVariant(device, scene, objDefs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
    // update prefiltered lighting data
    this.updateEnvUniforms(device, scene);

    // Minimal options for Depth and Shadow passes
    const shaderPassInfo = ShaderPass.get(device).getByIndex(pass);
    const minimalOptions = pass === SHADER_DEPTH || pass === SHADER_PICK || shaderPassInfo.isShadow;
    let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;
    if (minimalOptions) this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, pass, sortedLights);else this.shaderOptBuilder.updateRef(options, scene, this, objDefs, pass, sortedLights);

    // execute user callback to modify the options
    if (this.onUpdateShader) {
      options = this.onUpdateShader(options);
    }
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
    const library = getProgramLibrary(device);
    library.register('standard', standard);
    const shader = library.getProgram('standard', options, processingOptions, this.userId);
    this._dirtyShader = false;
    return shader;
  }

  /**
   * Removes this material from the scene and possibly frees up memory from its shaders (if there
   * are no other materials using it).
   */
  destroy() {
    // unbind (texture) asset references
    for (const asset in this._assetReferences) {
      this._assetReferences[asset]._unbind();
    }
    this._assetReferences = null;
    super.destroy();
  }
}

// define a uniform get function
StandardMaterial.TEXTURE_PARAMETERS = standardMaterialTextureParameters;
StandardMaterial.CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;
const defineUniform = (name, getUniformFunc) => {
  _uniforms[name] = getUniformFunc;
};
const definePropInternal = (name, constructorFunc, setterFunc, getterFunc) => {
  Object.defineProperty(StandardMaterial.prototype, name, {
    get: getterFunc || function () {
      return this[`_${name}`];
    },
    set: setterFunc
  });
  _props[name] = {
    value: constructorFunc
  };
};

// define a simple value property (float, string etc)
const defineValueProp = prop => {
  const internalName = `_${prop.name}`;
  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);
  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];
    if (oldValue !== value) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = value;
    }
  };
  definePropInternal(prop.name, () => prop.defaultValue, setterFunc, prop.getterFunc);
};

// define an aggregate property (color, vec3 etc)
const defineAggProp = prop => {
  const internalName = `_${prop.name}`;
  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);
  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];
    if (!oldValue.equals(value)) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = oldValue.copy(value);
    }
  };
  definePropInternal(prop.name, () => prop.defaultValue.clone(), setterFunc, prop.getterFunc);
};

// define either a value or aggregate property
const defineProp = prop => {
  return prop.defaultValue && prop.defaultValue.clone ? defineAggProp(prop) : defineValueProp(prop);
};
function _defineTex2D(name, channel = "rgb", vertexColor = true, uv = 0) {
  // store texture name
  _matTex2D[name] = channel.length || -1;
  defineProp({
    name: `${name}Map`,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue !== !!newValue || oldValue && (oldValue.type !== newValue.type || oldValue.fixCubemapSeams !== newValue.fixCubemapSeams || oldValue.format !== newValue.format);
    }
  });
  defineProp({
    name: `${name}MapTiling`,
    defaultValue: new Vec2(1, 1)
  });
  defineProp({
    name: `${name}MapOffset`,
    defaultValue: new Vec2(0, 0)
  });
  defineProp({
    name: `${name}MapRotation`,
    defaultValue: 0
  });
  defineProp({
    name: `${name}MapUv`,
    defaultValue: uv
  });
  if (channel) {
    defineProp({
      name: `${name}MapChannel`,
      defaultValue: channel
    });
    if (vertexColor) {
      defineProp({
        name: `${name}VertexColor`,
        defaultValue: false
      });
      defineProp({
        name: `${name}VertexColorChannel`,
        defaultValue: channel
      });
    }
  }

  // construct the transform uniform
  const mapTiling = `${name}MapTiling`;
  const mapOffset = `${name}MapOffset`;
  const mapRotation = `${name}MapRotation`;
  const mapTransform = `${name}MapTransform`;
  defineUniform(mapTransform, (material, device, scene) => {
    const tiling = material[mapTiling];
    const offset = material[mapOffset];
    const rotation = material[mapRotation];
    if (tiling.x === 1 && tiling.y === 1 && offset.x === 0 && offset.y === 0 && rotation === 0) {
      return null;
    }
    const uniform = material._allocUniform(mapTransform, () => {
      return [{
        name: `texture_${mapTransform}0`,
        value: new Float32Array(3)
      }, {
        name: `texture_${mapTransform}1`,
        value: new Float32Array(3)
      }];
    });
    const cr = Math.cos(rotation * math.DEG_TO_RAD);
    const sr = Math.sin(rotation * math.DEG_TO_RAD);
    const uniform0 = uniform[0].value;
    uniform0[0] = cr * tiling.x;
    uniform0[1] = -sr * tiling.y;
    uniform0[2] = offset.x;
    const uniform1 = uniform[1].value;
    uniform1[0] = sr * tiling.x;
    uniform1[1] = cr * tiling.y;
    uniform1[2] = 1.0 - tiling.y - offset.y;
    return uniform;
  });
}
function _defineColor(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    getterFunc: function () {
      // HACK: since we can't detect whether a user is going to set a color property
      // after calling this getter (i.e doing material.ambient.r = 0.5) we must assume
      // the worst and flag the shader as dirty.
      // This means currently animating a material color is horribly slow.
      this._dirtyShader = true;
      return this[`_${name}`];
    }
  });
  defineUniform(name, (material, device, scene) => {
    const uniform = material._allocUniform(name, () => new Float32Array(3));
    const color = material[name];
    const gamma = material.useGammaTonemap && scene.gammaCorrection;
    if (gamma) {
      uniform[0] = Math.pow(color.r, 2.2);
      uniform[1] = Math.pow(color.g, 2.2);
      uniform[2] = Math.pow(color.b, 2.2);
    } else {
      uniform[0] = color.r;
      uniform[1] = color.g;
      uniform[2] = color.b;
    }
    return uniform;
  });
}
function _defineFloat(name, defaultValue, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    dirtyShaderFunc: (oldValue, newValue) => {
      // This is not always optimal and will sometimes trigger redundant shader
      // recompilation. However, no number property on a standard material
      // triggers a shader recompile if the previous and current values both
      // have a fractional part.
      return (oldValue === 0 || oldValue === 1) !== (newValue === 0 || newValue === 1);
    }
  });
  defineUniform(name, getUniformFunc);
}
function _defineObject(name, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue === !!newValue;
    }
  });
  defineUniform(name, getUniformFunc);
}
function _defineFlag(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue
  });
}
function _defineMaterialProps() {
  _defineColor('ambient', new Color(0.7, 0.7, 0.7));
  _defineColor('diffuse', new Color(1, 1, 1));
  _defineColor('specular', new Color(0, 0, 0));
  _defineColor('emissive', new Color(0, 0, 0));
  _defineColor('sheen', new Color(1, 1, 1));
  _defineColor('attenuation', new Color(1, 1, 1));
  _defineFloat('emissiveIntensity', 1);
  _defineFloat('specularityFactor', 1);
  _defineFloat('sheenGloss', 0.0);
  _defineFloat('gloss', 0.25, (material, device, scene) => {
    return material.shadingModel === SPECULAR_PHONG ?
    // legacy: expand back to specular power
    Math.pow(2, material.gloss * 11) : material.gloss;
  });
  _defineFloat('heightMapFactor', 1, (material, device, scene) => {
    return material.heightMapFactor * 0.025;
  });
  _defineFloat('opacity', 1);
  _defineFloat('alphaFade', 1);
  _defineFloat('alphaTest', 0); // NOTE: overwrites Material.alphaTest
  _defineFloat('bumpiness', 1);
  _defineFloat('normalDetailMapBumpiness', 1);
  _defineFloat('reflectivity', 1);
  _defineFloat('occludeSpecularIntensity', 1);
  _defineFloat('refraction', 0);
  _defineFloat('refractionIndex', 1.0 / 1.5); // approx. (air ior / glass ior)
  _defineFloat('thickness', 0);
  _defineFloat('attenuationDistance', 0);
  _defineFloat('metalness', 1);
  _defineFloat('anisotropy', 0);
  _defineFloat('clearCoat', 0);
  _defineFloat('clearCoatGloss', 1);
  _defineFloat('clearCoatBumpiness', 1);
  _defineFloat('aoUvSet', 0, null); // legacy

  _defineFloat('iridescence', 0);
  _defineFloat('iridescenceRefractionIndex', 1.0 / 1.5);
  _defineFloat('iridescenceThicknessMin', 0);
  _defineFloat('iridescenceThicknessMax', 0);
  _defineObject('ambientSH');
  _defineObject('cubeMapProjectionBox', (material, device, scene) => {
    const uniform = material._allocUniform('cubeMapProjectionBox', () => {
      return [{
        name: 'envBoxMin',
        value: new Float32Array(3)
      }, {
        name: 'envBoxMax',
        value: new Float32Array(3)
      }];
    });
    const bboxMin = material.cubeMapProjectionBox.getMin();
    const minUniform = uniform[0].value;
    minUniform[0] = bboxMin.x;
    minUniform[1] = bboxMin.y;
    minUniform[2] = bboxMin.z;
    const bboxMax = material.cubeMapProjectionBox.getMax();
    const maxUniform = uniform[1].value;
    maxUniform[0] = bboxMax.x;
    maxUniform[1] = bboxMax.y;
    maxUniform[2] = bboxMax.z;
    return uniform;
  });
  _defineFlag('ambientTint', false);
  _defineFlag('diffuseTint', false);
  _defineFlag('specularTint', false);
  _defineFlag('specularityFactorTint', false);
  _defineFlag('emissiveTint', false);
  _defineFlag('fastTbn', false);
  _defineFlag('useMetalness', false);
  _defineFlag('useMetalnessSpecularColor', false);
  _defineFlag('useSheen', false);
  _defineFlag('enableGGXSpecular', false);
  _defineFlag('occludeDirect', false);
  _defineFlag('normalizeNormalMap', true);
  _defineFlag('conserveEnergy', true);
  _defineFlag('opacityFadesSpecular', true);
  _defineFlag('occludeSpecular', SPECOCC_AO);
  _defineFlag('shadingModel', SPECULAR_BLINN);
  _defineFlag('fresnelModel', FRESNEL_SCHLICK); // NOTE: this has been made to match the default shading model (to fix a bug)
  _defineFlag('useDynamicRefraction', false);
  _defineFlag('cubeMapProjection', CUBEPROJ_NONE);
  _defineFlag('customFragmentShader', null);
  _defineFlag('useFog', true);
  _defineFlag('useLighting', true);
  _defineFlag('useGammaTonemap', true);
  _defineFlag('useSkybox', true);
  _defineFlag('forceUv1', false);
  _defineFlag('pixelSnap', false);
  _defineFlag('twoSidedLighting', false);
  _defineFlag('nineSlicedMode', undefined); // NOTE: this used to be SPRITE_RENDERMODE_SLICED but was undefined pre-Rollup
  _defineFlag('msdfTextAttribute', false);
  _defineFlag('useIridescence', false);
  _defineFlag('glossInvert', false);
  _defineFlag('sheenGlossInvert', false);
  _defineFlag('clearCoatGlossInvert', false);
  _defineFlag('opacityDither', DITHER_NONE);
  _defineFlag('opacityShadowDither', DITHER_NONE);
  _defineTex2D('diffuse');
  _defineTex2D('specular');
  _defineTex2D('emissive');
  _defineTex2D('thickness', 'g');
  _defineTex2D('specularityFactor', 'g');
  _defineTex2D('normal', '');
  _defineTex2D('metalness', 'g');
  _defineTex2D('gloss', 'g');
  _defineTex2D('opacity', 'a');
  _defineTex2D('refraction', 'g');
  _defineTex2D('height', 'g', false);
  _defineTex2D('ao', 'g');
  _defineTex2D('light', 'rgb', true, 1);
  _defineTex2D('msdf', '');
  _defineTex2D('diffuseDetail', 'rgb', false);
  _defineTex2D('normalDetail', '');
  _defineTex2D('aoDetail', 'g', false);
  _defineTex2D('clearCoat', 'g');
  _defineTex2D('clearCoatGloss', 'g');
  _defineTex2D('clearCoatNormal', '');
  _defineTex2D('sheen', 'rgb');
  _defineTex2D('sheenGloss', 'g');
  _defineTex2D('iridescence', 'g');
  _defineTex2D('iridescenceThickness', 'g');
  _defineFlag('diffuseDetailMode', DETAILMODE_MUL);
  _defineFlag('aoDetailMode', DETAILMODE_MUL);
  _defineObject('cubeMap');
  _defineObject('sphereMap');
  _defineObject('envAtlas');

  // prefiltered cubemap getter
  const getterFunc = function getterFunc() {
    return this._prefilteredCubemaps;
  };

  // prefiltered cubemap setter
  const setterFunc = function setterFunc(value) {
    const cubemaps = this._prefilteredCubemaps;
    value = value || [];
    let changed = false;
    let complete = true;
    for (let i = 0; i < 6; ++i) {
      const v = value[i] || null;
      if (cubemaps[i] !== v) {
        cubemaps[i] = v;
        changed = true;
      }
      complete = complete && !!cubemaps[i];
    }
    if (changed) {
      if (complete) {
        this.envAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
          target: this.envAtlas
        });
      } else {
        if (this.envAtlas) {
          this.envAtlas.destroy();
          this.envAtlas = null;
        }
      }
      this._dirtyShader = true;
    }
  };
  const empty = [null, null, null, null, null, null];
  definePropInternal('prefilteredCubemaps', () => empty.slice(), setterFunc, getterFunc);
}
_defineMaterialProps();

export { StandardMaterial };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuXG5pbXBvcnQgeyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzJztcblxuaW1wb3J0IHtcbiAgICBDVUJFUFJPSl9CT1gsIENVQkVQUk9KX05PTkUsXG4gICAgREVUQUlMTU9ERV9NVUwsXG4gICAgRElUSEVSX05PTkUsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU1BFQ09DQ19BTyxcbiAgICBTUEVDVUxBUl9CTElOTiwgU1BFQ1VMQVJfUEhPTkdcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBFbnZMaWdodGluZyB9IGZyb20gJy4uL2dyYXBoaWNzL2Vudi1saWdodGluZy5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBfbWF0VGV4MkQsIHN0YW5kYXJkIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9wcm9ncmFtcy9zdGFuZGFyZC5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIH0gZnJvbSAnLi9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLWJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgc3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzLCBzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnMgfSBmcm9tICcuL3N0YW5kYXJkLW1hdGVyaWFsLXBhcmFtZXRlcnMuanMnO1xuXG4vLyBwcm9wZXJ0aWVzIHRoYXQgZ2V0IGNyZWF0ZWQgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3Byb3BzID0ge307XG5cbi8vIHNwZWNpYWwgdW5pZm9ybSBmdW5jdGlvbnMgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3VuaWZvcm1zID0ge307XG5cbi8vIHRlbXBvcmFyeSBzZXQgb2YgcGFyYW1zXG5sZXQgX3BhcmFtcyA9IG5ldyBTZXQoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfS5cbiAqXG4gKiBAY2FsbGJhY2sgVXBkYXRlU2hhZGVyQ2FsbGJhY2tcbiAqIEBwYXJhbSB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gb3B0aW9ucyAtIEFuIG9iamVjdCB3aXRoIHNoYWRlciBnZW5lcmF0b3Igc2V0dGluZ3MgKGJhc2VkIG9uIGN1cnJlbnRcbiAqIG1hdGVyaWFsIGFuZCBzY2VuZSBwcm9wZXJ0aWVzKSwgdGhhdCB5b3UgY2FuIGNoYW5nZSBhbmQgdGhlbiByZXR1cm4uIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBwYXNzZWRcbiAqIGludG8gdGhpcyBmdW5jdGlvbiBhcmUgZG9jdW1lbnRlZCBpbiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbH0uIEFsc28gY29udGFpbnMgYSBtZW1iZXIgbmFtZWQgbGl0T3B0aW9uc1xuICogd2hpY2ggaG9sZHMgc29tZSBvZiB0aGUgb3B0aW9ucyBvbmx5IHVzZWQgYnkgdGhlIGxpdCBzaGFkZXIgYmFja2VuZCB7QGxpbmsgTGl0U2hhZGVyT3B0aW9uc30uXG4gKiBAcmV0dXJucyB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gUmV0dXJuZWQgc2V0dGluZ3Mgd2lsbCBiZSB1c2VkIGJ5IHRoZSBzaGFkZXIuXG4gKi9cblxuLyoqXG4gKiBBIFN0YW5kYXJkIG1hdGVyaWFsIGlzIHRoZSBtYWluLCBnZW5lcmFsIHB1cnBvc2UgbWF0ZXJpYWwgdGhhdCBpcyBtb3N0IG9mdGVuIHVzZWQgZm9yIHJlbmRlcmluZy5cbiAqIEl0IGNhbiBhcHByb3hpbWF0ZSBhIHdpZGUgdmFyaWV0eSBvZiBzdXJmYWNlIHR5cGVzIGFuZCBjYW4gc2ltdWxhdGUgZHluYW1pYyByZWZsZWN0ZWQgbGlnaHQuXG4gKiBNb3N0IG1hcHMgY2FuIHVzZSAzIHR5cGVzIG9mIGlucHV0IHZhbHVlcyBpbiBhbnkgY29tYmluYXRpb246IGNvbnN0YW50IChjb2xvciBvciBudW1iZXIpLCBtZXNoXG4gKiB2ZXJ0ZXggY29sb3JzIGFuZCBhIHRleHR1cmUuIEFsbCBlbmFibGVkIGlucHV0cyBhcmUgbXVsdGlwbGllZCB0b2dldGhlci5cbiAqXG4gKiBAcHJvcGVydHkge0NvbG9yfSBhbWJpZW50IFRoZSBhbWJpZW50IGNvbG9yIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyBjb2xvciB2YWx1ZSBpcyAzLWNvbXBvbmVudFxuICogKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGRpZmZ1c2UgVGhlIGRpZmZ1c2UgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIGJhc2ljIHN1cmZhY2UgY29sb3IgKGFrYSBhbGJlZG8pLlxuICogQHByb3BlcnR5IHtib29sZWFufSBkaWZmdXNlVGludCBNdWx0aXBseSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBhbmQvb3IgZGlmZnVzZSB2ZXJ0ZXggY29sb3JcbiAqIGJ5IHRoZSBjb25zdGFudCBkaWZmdXNlIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VNYXAgVGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFV2IE1haW4gKHByaW1hcnkpIGRpZmZ1c2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGlmZnVzZVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGRpZmZ1c2UuIElmIGRpZmZ1c2VNYXAgb3IgYXJlXG4gKiBkaWZmdXNlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIGRpZmZ1c2UuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VEZXRhaWxNYXAgVGhlXG4gKiBkZXRhaWwgKHNlY29uZGFyeSkgZGlmZnVzZSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluXG4gKiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgaXMgbm9uLW51bGwuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZURldGFpbE1hcFV2IERldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBkaWZmdXNlRGV0YWlsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGRldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VEZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2VcbiAqIG1hcC4gRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRpZmZ1c2VEZXRhaWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlRGV0YWlsTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2UgbWFwXG4gKiB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZGlmZnVzZURldGFpbE1vZGUgRGV0ZXJtaW5lcyBob3cgdGhlIG1haW4gKHByaW1hcnkpIGFuZCBkZXRhaWwgKHNlY29uZGFyeSlcbiAqIGRpZmZ1c2UgbWFwcyBhcmUgYmxlbmRlZCB0b2dldGhlci4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfTVVMfTogTXVsdGlwbHkgdG9nZXRoZXIgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX0FERH06IEFkZCB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfU0NSRUVOfTogU29mdGVyIHZlcnNpb24gb2Yge0BsaW5rIERFVEFJTE1PREVfQUREfS5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfT1ZFUkxBWX06IE11bHRpcGxpZXMgb3Igc2NyZWVucyB0aGUgY29sb3JzLCBkZXBlbmRpbmcgb24gdGhlIHByaW1hcnkgY29sb3IuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01JTn06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgZGFya2VyLFxuICogY29tcG9uZW50LXdpc2UuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01BWH06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgbGlnaHRlcixcbiAqIGNvbXBvbmVudC13aXNlLlxuICpcbiAqIERlZmF1bHRzIHRvIHtAbGluayBERVRBSUxNT0RFX01VTH0uXG4gKiBAcHJvcGVydHkge0NvbG9yfSBzcGVjdWxhciBUaGUgc3BlY3VsYXIgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIHN1cmZhY2UgcmVmbGVjdGlvbi9zcGVjdWxhciBjb2xvci5cbiAqIEFmZmVjdHMgc3BlY3VsYXIgaW50ZW5zaXR5IGFuZCB0aW50LlxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhclRpbnQgTXVsdGlwbHkgc3BlY3VsYXIgbWFwIGFuZC9vciBzcGVjdWxhciB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBzcGVjdWxhciB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBzcGVjdWxhck1hcCBUaGUgc3BlY3VsYXJcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBVdiBTcGVjdWxhciBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc3BlY3VsYXJNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgc3BlY3VsYXIgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhciBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzcGVjdWxhciBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBzcGVjdWxhciBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhci4gSWYgc3BlY3VsYXJNYXAgb3JcbiAqIGFyZSBzcGVjdWxhclRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc3BlY3VsYXIuIENhbiBiZVxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhcml0eUZhY3RvclRpbnQgTXVsdGlwbHkgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBhbmQvb3Igc3BlY3VsYXIgdmVydGV4IGNvbG9yIGJ5IHRoZVxuICogY29uc3RhbnQgc3BlY3VsYXIgdmFsdWUuXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3IgVGhlIGZhY3RvciBvZiBzcGVjdWxhciBpbnRlbnNpdHksIHVzZWQgdG8gd2VpZ2h0IHRoZSBmcmVzbmVsIGFuZCBzcGVjdWxhcml0eS4gRGVmYXVsdCBpcyAxLjAuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc3BlY3VsYXJpdHlGYWN0b3JNYXAgVGhlXG4gKiBmYWN0b3Igb2Ygc3BlY3VsYXJpdHkgYXMgYSB0ZXh0dXJlIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwVXYgU3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgVGhlIGNoYW5uZWwgdXNlZCBieSB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIHRleHR1cmUgdG8gc2FtcGxlIGZyb20gKGRlZmF1bHQgaXMgJ2EnKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJpdHlGYWN0b3JWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhcml0eSBmYWN0b3IuIElmIHNwZWN1bGFyaXR5RmFjdG9yTWFwIG9yXG4gKiBhcmUgc3BlY3VsYXJpdHlGYWN0b3JUaW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNwZWN1bGFyaXR5RmFjdG9yVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIHNwZWN1bGFyaXR5IGZhY3Rvci4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGVuYWJsZUdHWFNwZWN1bGFyIEVuYWJsZXMgR0dYIHNwZWN1bGFyLiBBbHNvIGVuYWJsZXNcbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2FuaXNvdHJvcHl9ICBwYXJhbWV0ZXIgdG8gc2V0IG1hdGVyaWFsIGFuaXNvdHJvcHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pc290cm9weSBEZWZpbmVzIGFtb3VudCBvZiBhbmlzb3Ryb3B5LiBSZXF1aXJlc1xuICoge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZW5hYmxlR0dYU3BlY3VsYXJ9IGlzIHNldCB0byB0cnVlLlxuICpcbiAqIC0gV2hlbiBhbmlzb3Ryb3B5ID09IDAsIHNwZWN1bGFyIGlzIGlzb3Ryb3BpYy5cbiAqIC0gV2hlbiBhbmlzb3Ryb3B5IDwgMCwgYW5pc290cm9weSBkaXJlY3Rpb24gYWxpZ25zIHdpdGggdGhlIHRhbmdlbnQsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgdGhlIGFuaXNvdHJvcHkgdmFsdWUgZGVjcmVhc2VzIHRvIG1pbmltdW0gb2YgLTEuXG4gKiAtIFdoZW4gYW5pc290cm9weSA+IDAsIGFuaXNvdHJvcHkgZGlyZWN0aW9uIGFsaWducyB3aXRoIHRoZSBiaS1ub3JtYWwsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgYW5pc290cm9weSB2YWx1ZSBpbmNyZWFzZXMgdG8gbWF4aW11bSBvZiAxLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXQgRGVmaW5lcyBpbnRlbnNpdHkgb2YgY2xlYXJjb2F0IGxheWVyIGZyb20gMCB0byAxLiBDbGVhcmNvYXQgbGF5ZXJcbiAqIGlzIGRpc2FibGVkIHdoZW4gY2xlYXJDb2F0ID09IDAuIERlZmF1bHQgdmFsdWUgaXMgMCAoZGlzYWJsZWQpLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGNsZWFyQ29hdE1hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgaW50ZW5zaXR5IG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZFxuICogJ2NsZWFyQ29hdCcgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwVXYgQ2xlYXJjb2F0IGludGVuc2l0eSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNsZWFyQ29hdE1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAgdG8gdXNlLiBDYW5cbiAqIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdFZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGNsZWFyY29hdCBpbnRlbnNpdHkuIElmXG4gKiBjbGVhckNvYXRNYXAgaXMgc2V0LCBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0VmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEdsb3NzIERlZmluZXMgdGhlIGNsZWFyY29hdCBnbG9zc2luZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXJcbiAqIGZyb20gMCAocm91Z2gpIHRvIDEgKG1pcnJvcikuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzSW52ZXJ0IEludmVydCB0aGUgY2xlYXJjb2F0IGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgY2xlYXIgY29hdCBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBjbGVhckNvYXRHbG9zc01hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgZ2xvc3NpbmVzcyBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuIElmIHNwZWNpZmllZCwgd2lsbCBiZSBtdWx0aXBsaWVkIGJ5IG5vcm1hbGl6ZWRcbiAqICdjbGVhckNvYXRHbG9zcycgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBVdiBDbGVhcmNvYXQgZ2xvc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBjbGVhclxuICogY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgY2xlYXJjb2F0IGdsb3NzaW5lc3MuXG4gKiBJZiBjbGVhckNvYXRHbG9zc01hcCBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjbGVhckNvYXRHbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGNsZWFyY29hdFxuICogZ2xvc3NpbmVzcy4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gY2xlYXJDb2F0Tm9ybWFsTWFwIFRoZVxuICogY2xlYXJjb2F0IG5vcm1hbCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBUaGUgdGV4dHVyZSBtdXN0IGNvbnRhaW5zIG5vcm1hbGl6ZWQsXG4gKiB0YW5nZW50IHNwYWNlIG5vcm1hbHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0Tm9ybWFsTWFwVXYgQ2xlYXJjb2F0IG5vcm1hbCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0Tm9ybWFsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG1haW4gY2xlYXJjb2F0IG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXROb3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiBjbGVhcmNvYXQgbm9ybWFsXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXROb3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiBjbGVhcmNvYXQgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXIuIFRoaXMgdmFsdWUgc2NhbGVzXG4gKiB0aGUgYXNzaWduZWQgbWFpbiBjbGVhcmNvYXQgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMVxuICogKGZ1bGwgYnVtcCBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZUlyaWRlc2NlbmNlIEVuYWJsZSB0aGluLWZpbG0gaXJpZGVzY2VuY2UuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gaXJpZGVzY2VuY2VNYXAgVGhlXG4gKiBwZXItcGl4ZWwgaXJpZGVzY2VuY2UgaW50ZW5zaXR5LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwVXYgSXJpZGVzY2VuY2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGlyaWRlc2NlbmNlTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2UgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpcmlkZXNjZW5jZU1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCBUaGVcbiAqIHBlci1waXhlbCBpcmlkZXNjZW5jZSB0aGlja25lc3MuIERlZmluZXMgYSBncmFkaWVudCB3ZWlnaHQgYmV0d2VlbiBpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiBhbmRcbiAqIGlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwVXYgSXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBpcmlkZXNjZW5jZVxuICogdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcylcbiAqIG9mIHRoZSBpcmlkZXNjZW5jZSBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBpcmlkZXNjZW5jZSB0aGlja25lc3NcbiAqIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIFRoZSBtaW5pbXVtIHRoaWNrbmVzcyBmb3IgdGhlIGlyaWRlc2NlbmNlIGxheWVyLlxuICogT25seSB1c2VkIHdoZW4gYW4gaXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBpcyB1c2VkLiBUaGUgdW5pdCBpcyBpbiBubS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01heCBUaGUgbWF4aW11bSB0aGlja25lc3MgZm9yIHRoZSBpcmlkZXNjZW5jZSBsYXllci5cbiAqIFVzZWQgYXMgdGhlICdiYXNlJyB0aGlja25lc3Mgd2hlbiBubyBpcmlkZXNjZW5jZSB0aGlja25lc3MgbWFwIGlzIGRlZmluZWQuIFRoZSB1bml0IGlzIGluIG5tLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IFRoZSBpbmRleCBvZiByZWZyYWN0aW9uIG9mIHRoZSBpcmlkZXNjZW50XG4gKiB0aGluLWZpbG0uIEFmZmVjdHMgdGhlIGNvbG9yIHBoYXNlIHNoaWZ0IGFzIGRlc2NyaWJlZCBoZXJlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL0tocm9ub3NHcm91cC9nbFRGL3RyZWUvbWFpbi9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tYXRlcmlhbHNfaXJpZGVzY2VuY2VcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzIFVzZSBtZXRhbG5lc3MgcHJvcGVydGllcyBpbnN0ZWFkIG9mIHNwZWN1bGFyLiBXaGVuIGVuYWJsZWQsXG4gKiBkaWZmdXNlIGNvbG9ycyBhbHNvIGFmZmVjdCBzcGVjdWxhciBpbnN0ZWFkIG9mIHRoZSBkZWRpY2F0ZWQgc3BlY3VsYXIgbWFwLiBUaGlzIGNhbiBiZSB1c2VkIGFzXG4gKiBhbHRlcm5hdGl2ZSB0byBzcGVjdWxhciBjb2xvciB0byBzYXZlIHNwYWNlLiBXaXRoIG1ldGFsbmVzcyA9PSAwLCB0aGUgcGl4ZWwgaXMgYXNzdW1lZCB0byBiZVxuICogZGllbGVjdHJpYywgYW5kIGRpZmZ1c2UgY29sb3IgaXMgdXNlZCBhcyBub3JtYWwuIFdpdGggbWV0YWxuZXNzID09IDEsIHRoZSBwaXhlbCBpcyBmdWxseVxuICogbWV0YWxsaWMsIGFuZCBkaWZmdXNlIGNvbG9yIGlzIHVzZWQgYXMgc3BlY3VsYXIgY29sb3IgaW5zdGVhZC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciBXaGVuIG1ldGFsbmVzcyBpcyBlbmFibGVkLCB1c2UgdGhlXG4gKiBzcGVjdWxhciBtYXAgdG8gYXBwbHkgY29sb3IgdGludCB0byBzcGVjdWxhciByZWZsZWN0aW9ucy5cbiAqIGF0IGRpcmVjdCBhbmdsZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWV0YWxuZXNzIERlZmluZXMgaG93IG11Y2ggdGhlIHN1cmZhY2UgaXMgbWV0YWxsaWMuIEZyb20gMCAoZGllbGVjdHJpYykgdG8gMVxuICogKG1ldGFsKS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBtZXRhbG5lc3NNYXAgTW9ub2Nocm9tZVxuICogbWV0YWxuZXNzIG1hcCAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBVdiBNZXRhbG5lc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG1ldGFsbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtZXRhbG5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBtZXRhbG5lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWV0YWxuZXNzIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtZXRhbG5lc3NcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG1ldGFsbmVzcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1ldGFsbmVzc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIG1ldGFsbmVzcy4gSWYgbWV0YWxuZXNzTWFwXG4gKiBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWwgdG8gdXNlIGZvciBtZXRhbG5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zcyBEZWZpbmVzIHRoZSBnbG9zc2luZXNzIG9mIHRoZSBtYXRlcmlhbCBmcm9tIDAgKHJvdWdoKSB0byAxIChzaGlueSkuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gZ2xvc3NNYXAgR2xvc3MgbWFwXG4gKiAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZCBnbG9zcyB2YWx1ZSBhbmQvb3IgdmVydGV4XG4gKiBjb2xvcnMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGdsb3NzSW52ZXJ0IEludmVydCB0aGUgZ2xvc3MgY29tcG9uZW50IChkZWZhdWx0IGlzIGZhbHNlKS4gRW5hYmxpbmcgdGhpc1xuICogZmxhZyByZXN1bHRzIGluIG1hdGVyaWFsIHRyZWF0aW5nIHRoZSBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zc01hcFV2IEdsb3NzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGdsb3NzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBnbG9zcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIlxuICogb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGdsb3NzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZ2xvc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZ2xvc3MgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGdsb3NzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZ2xvc3MgbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBnbG9zc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGdsb3NzaW5lc3MuIElmIGdsb3NzTWFwIGlzIHNldCxcbiAqIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBnbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGdsb3NzaW5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uIERlZmluZXMgdGhlIHZpc2liaWxpdHkgb2YgcmVmcmFjdGlvbi4gTWF0ZXJpYWwgY2FuIHJlZnJhY3QgdGhlXG4gKiBzYW1lIGN1YmUgbWFwIGFzIHVzZWQgZm9yIHJlZmxlY3Rpb25zLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHJlZnJhY3Rpb25NYXAgVGhlIG1hcCBvZlxuICogdGhlIHJlZnJhY3Rpb24gdmlzaWJpbGl0eS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwVXYgUmVmcmFjdGlvbiBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSByZWZyYWN0aW9uIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSByZWZyYWN0aW9uIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZW1pc3NpdmVcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSByZWZyYWN0aW9uTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcmVmcmFjdGlvbiBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gcmVmcmFjdGlvblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHJlZnJhY3Rpb24uIElmXG4gKiByZWZyYWN0aW9uIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtib29sZWFufSByZWZyYWN0aW9uVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgcmVmcmFjdGlvbi5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlZnJhY3Rpb25JbmRleCBEZWZpbmVzIHRoZSBpbmRleCBvZiByZWZyYWN0aW9uLCBpLmUuIFRoZSBhbW91bnQgb2ZcbiAqIGRpc3RvcnRpb24uIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGFzIChvdXRlcklvciAvIHN1cmZhY2VJb3IpLCB3aGVyZSBpbnB1dHMgYXJlIG1lYXN1cmVkXG4gKiBpbmRpY2VzIG9mIHJlZnJhY3Rpb24sIHRoZSBvbmUgYXJvdW5kIHRoZSBvYmplY3QgYW5kIHRoZSBvbmUgb2YgaXRzIG93biBzdXJmYWNlLiBJbiBtb3N0XG4gKiBzaXR1YXRpb25zIG91dGVyIG1lZGl1bSBpcyBhaXIsIHNvIG91dGVySW9yIHdpbGwgYmUgYXBwcm94aW1hdGVseSAxLiBUaGVuIHlvdSBvbmx5IG5lZWQgdG8gZG9cbiAqICgxLjAgLyBzdXJmYWNlSW9yKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlRHluYW1pY1JlZnJhY3Rpb24gRW5hYmxlcyBoaWdoZXIgcXVhbGl0eSByZWZyYWN0aW9ucyB1c2luZyB0aGUgZ3JhYiBwYXNzXG4gKiBpbnN0ZWFkIG9mIHByZS1jb21wdXRlZCBjdWJlIG1hcHMgZm9yIHJlZnJhY3Rpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHRoaWNrbmVzcyBUaGUgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uXG4gKiBpcyBlbmFibGVkLiBUaGUgdW5pdCBpcyBpbiBiYXNlIHVuaXRzLCBhbmQgc2NhbGVzIHdpdGggdGhlIHNpemUgb2YgdGhlIG9iamVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSB0aGlja25lc3NNYXAgVGhlXG4gKiBwZXItcGl4ZWwgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwVXYgVGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSB0aGlja25lc3NNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gdGhpY2tuZXNzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgdGhpY2tuZXNzXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGhpY2tuZXNzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgdGhpY2tuZXNzIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGhpY2tuZXNzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgdGhpY2tuZXNzLiBJZlxuICogdGhpY2tuZXNzIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtDb2xvcn0gYXR0ZW51YXRpb24gVGhlIGF0dGVudWF0aW9uIGNvbG9yIGZvciByZWZyYWN0aXZlIG1hdGVyaWFscywgb25seSB1c2VkIHdoZW5cbiAqIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYXR0ZW51YXRpb25EaXN0YW5jZSBUaGUgZGlzdGFuY2UgZGVmaW5pbmcgdGhlIGFic29ycHRpb24gcmF0ZSBvZiBsaWdodFxuICogd2l0aGluIHRoZSBtZWRpdW0uIE9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBlbWlzc2l2ZSBUaGUgZW1pc3NpdmUgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtib29sZWFufSBlbWlzc2l2ZVRpbnQgTXVsdGlwbHkgZW1pc3NpdmUgbWFwIGFuZC9vciBlbWlzc2l2ZSB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBlbWlzc2l2ZSB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBlbWlzc2l2ZU1hcCBUaGUgZW1pc3NpdmVcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pc3NpdmVJbnRlbnNpdHkgRW1pc3NpdmUgY29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFV2IEVtaXNzaXZlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBlbWlzc2l2ZU1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBlbWlzc2l2ZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGVtaXNzaXZlTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGVtaXNzaXZlIG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGVtaXNzaXZlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZW1pc3NpdmVNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBlbWlzc2l2ZSBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW1pc3NpdmVWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBlbWlzc2lvbi4gSWYgZW1pc3NpdmVNYXAgb3JcbiAqIGVtaXNzaXZlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBlbWlzc2lvbi4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZVNoZWVuIFRvZ2dsZSBzaGVlbiBzcGVjdWxhciBlZmZlY3Qgb24vb2ZmLlxuICogQHByb3BlcnR5IHtDb2xvcn0gc2hlZW4gVGhlIHNwZWN1bGFyIGNvbG9yIG9mIHRoZSBzaGVlbiAoZmFicmljKSBtaWNyb2ZpYmVyIHN0cnVjdHVyZS5cbiAqIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnQgKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5UaW50IE11bHRpcGx5IHNoZWVuIG1hcCBhbmQvb3Igc2hlZW4gdmVydGV4IGNvbG9yIGJ5IHRoZSBjb25zdGFudFxuICogc2hlZW4gdmFsdWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc2hlZW5NYXAgVGhlIHNoZWVuXG4gKiBtaWNyb3N0cnVjdHVyZSBjb2xvciBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwVXYgU2hlZW4gbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoZWVuTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hlZW5NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgc2hlZW4gbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc2hlZW5cbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzaGVlbk1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzaGVlblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHNoZWVuLiBJZiBzaGVlbiBtYXAgb3JcbiAqIHNoZWVuIHRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zcyBUaGUgZ2xvc3NpbmVzcyBvZiB0aGUgc2hlZW4gKGZhYnJpYykgbWljcm9maWJlciBzdHJ1Y3R1cmUuXG4gKiBUaGlzIGNvbG9yIHZhbHVlIGlzIGEgc2luZ2xlIHZhbHVlIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5HbG9zc0ludmVydCBJbnZlcnQgdGhlIHNoZWVuIGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgc2hlZW4gZ2xvc3MgbWVtYmVycyBhcyByb3VnaG5lc3MuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NUaW50IE11bHRpcGx5IHNoZWVuIGdsb3NzaW5lc3MgbWFwIGFuZC9vciBzaGVlbiBnbG9zc2luZXNzIHZlcnRleFxuICogdmFsdWUgYnkgdGhlIHNjYWxhciBzaGVlbiBnbG9zc2luZXNzIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHNoZWVuR2xvc3NNYXAgVGhlIHNoZWVuXG4gKiBnbG9zc2luZXNzIG1pY3Jvc3RydWN0dXJlIGNvbG9yIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zc01hcFV2IFNoZWVuIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuR2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzaGVlblxuICogZ2xvc3NpbmVzcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc2hlZW5HbG9zc01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwIHRvIHVzZS5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzaGVlbiBnbG9zc2luZXNzLlxuICogSWYgc2hlZW4gZ2xvc3NpbmVzcyBtYXAgb3Igc2hlZW4gZ2xvc3NpbmVzcyB0aW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNoZWVuR2xvc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc2hlZW4gZ2xvc3NpbmVzcy5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIG1hdGVyaWFsLiBUaGlzIHZhbHVlIGNhbiBiZSBiZXR3ZWVuIDAgYW5kIDEsIHdoZXJlXG4gKiAwIGlzIGZ1bGx5IHRyYW5zcGFyZW50IGFuZCAxIGlzIGZ1bGx5IG9wYXF1ZS4gSWYgeW91IHdhbnQgdGhlIG1hdGVyaWFsIHRvIGJlIHNlbWktdHJhbnNwYXJlbnRcbiAqIHlvdSBhbHNvIG5lZWQgdG8gc2V0IHRoZSB7QGxpbmsgTWF0ZXJpYWwjYmxlbmRUeXBlfSB0byB7QGxpbmsgQkxFTkRfTk9STUFMfSxcbiAqIHtAbGluayBCTEVORF9BRERJVElWRX0gb3IgYW55IG90aGVyIG1vZGUuIEFsc28gbm90ZSB0aGF0IGZvciBtb3N0IHNlbWktdHJhbnNwYXJlbnQgb2JqZWN0cyB5b3VcbiAqIHdhbnQge0BsaW5rIE1hdGVyaWFsI2RlcHRoV3JpdGV9IHRvIGJlIGZhbHNlLCBvdGhlcndpc2UgdGhleSBjYW4gZnVsbHkgb2NjbHVkZSBvYmplY3RzIGJlaGluZFxuICogdGhlbS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBvcGFjaXR5TWFwIFRoZSBvcGFjaXR5IG1hcFxuICogb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHlNYXBVdiBPcGFjaXR5IG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wYWNpdHlNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG9wYWNpdHkgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIixcbiAqIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBvcGFjaXR5TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG9wYWNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBvcGFjaXR5TWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIG9wYWNpdHkgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHlNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBvcGFjaXR5IG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gb3BhY2l0eVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIG9wYWNpdHkuIElmIG9wYWNpdHlNYXAgaXMgc2V0LFxuICogaXQnbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wYWNpdHlWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igb3BhY2l0eS4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtib29sZWFufSBvcGFjaXR5RmFkZXNTcGVjdWxhciBVc2VkIHRvIHNwZWNpZnkgd2hldGhlciBzcGVjdWxhciBhbmQgcmVmbGVjdGlvbnMgYXJlXG4gKiBmYWRlZCBvdXQgdXNpbmcge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb3BhY2l0eX0uIERlZmF1bHQgaXMgdHJ1ZS4gV2hlbiBzZXQgdG8gZmFsc2UgdXNlXG4gKiB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFGYWRlfSB0byBmYWRlIG91dCBtYXRlcmlhbHMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gb3BhY2l0eURpdGhlciBVc2VkIHRvIHNwZWNpZnkgd2hldGhlciBvcGFjaXR5IGlzIGRpdGhlcmVkLCB3aGljaCBhbGxvd3NcbiAqIHRyYW5zcGFyZW5jeSB3aXRob3V0IGFscGhhIGJsZW5kaW5nLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgRElUSEVSX05PTkV9OiBPcGFjaXR5IGRpdGhlcmluZyBpcyBkaXNhYmxlZC5cbiAqIC0ge0BsaW5rIERJVEhFUl9CQVlFUjh9OiBPcGFjaXR5IGlzIGRpdGhlcmVkIHVzaW5nIGEgQmF5ZXIgOCBtYXRyaXguXG4gKiAtIHtAbGluayBESVRIRVJfQkxVRU5PSVNFfTogT3BhY2l0eSBpcyBkaXRoZXJlZCB1c2luZyBhIGJsdWUgbm9pc2UgdGV4dHVyZS5cbiAqXG4gKiBEZWZhdWx0cyB0byB7QGxpbmsgRElUSEVSX05PTkV9LlxuICogQHByb3BlcnR5IHtib29sZWFufSBvcGFjaXR5U2hhZG93RGl0aGVyIFVzZWQgdG8gc3BlY2lmeSB3aGV0aGVyIHNoYWRvdyBvcGFjaXR5IGlzIGRpdGhlcmVkLCB3aGljaFxuICogYWxsb3dzIHNoYWRvdyB0cmFuc3BhcmVuY3kgd2l0aG91dCBhbHBoYSBibGVuZGluZy4gIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBESVRIRVJfTk9ORX06IE9wYWNpdHkgZGl0aGVyaW5nIGlzIGRpc2FibGVkLlxuICogLSB7QGxpbmsgRElUSEVSX0JBWUVSOH06IE9wYWNpdHkgaXMgZGl0aGVyZWQgdXNpbmcgYSBCYXllciA4IG1hdHJpeC5cbiAqIC0ge0BsaW5rIERJVEhFUl9CTFVFTk9JU0V9OiBPcGFjaXR5IGlzIGRpdGhlcmVkIHVzaW5nIGEgYmx1ZSBub2lzZSB0ZXh0dXJlLlxuICpcbiAqIERlZmF1bHRzIHRvIHtAbGluayBESVRIRVJfTk9ORX0uXG4gKiBAcHJvcGVydHkge251bWJlcn0gYWxwaGFGYWRlIFVzZWQgdG8gZmFkZSBvdXQgbWF0ZXJpYWxzIHdoZW5cbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29wYWNpdHlGYWRlc1NwZWN1bGFyfSBpcyBzZXQgdG8gZmFsc2UuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbm9ybWFsTWFwIFRoZSBtYWluXG4gKiAocHJpbWFyeSkgbm9ybWFsIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFRoZSB0ZXh0dXJlIG11c3QgY29udGFpbnMgbm9ybWFsaXplZCxcbiAqIHRhbmdlbnQgc3BhY2Ugbm9ybWFscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBVdiBNYWluIChwcmltYXJ5KSBub3JtYWwgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtYWluIChwcmltYXJ5KSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gRWFjaFxuICogY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluIChwcmltYXJ5KVxuICogbm9ybWFsIG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBidW1waW5lc3MgVGhlIGJ1bXBpbmVzcyBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgdmFsdWUgc2NhbGVzIHRoZSBhc3NpZ25lZCBtYWluXG4gKiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMSAoZnVsbCBidW1wXG4gKiBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbm9ybWFsRGV0YWlsTWFwIFRoZSBkZXRhaWxcbiAqIChzZWNvbmRhcnkpIG5vcm1hbCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluIChwcmltYXJ5KVxuICogbm9ybWFsIG1hcCBpcyBub24tbnVsbC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxEZXRhaWxNYXBVdiBEZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxEZXRhaWxNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxEZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIG5vcm1hbFxuICogbWFwLiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsRGV0YWlsTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZGV0YWlsXG4gKiAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbERldGFpbE1hcEJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyB2YWx1ZSBzY2FsZXMgdGhlXG4gKiBhc3NpZ25lZCBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMVxuICogKGZ1bGwgYnVtcCBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gaGVpZ2h0TWFwIFRoZSBoZWlnaHQgbWFwXG4gKiBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFVzZWQgZm9yIGEgdmlldy1kZXBlbmRlbnQgcGFyYWxsYXggZWZmZWN0LiBUaGUgdGV4dHVyZSBtdXN0XG4gKiByZXByZXNlbnQgdGhlIGhlaWdodCBvZiB0aGUgc3VyZmFjZSB3aGVyZSBkYXJrZXIgcGl4ZWxzIGFyZSBsb3dlciBhbmQgbGlnaHRlciBwaXhlbHMgYXJlIGhpZ2hlci5cbiAqIEl0IGlzIHJlY29tbWVuZGVkIHRvIHVzZSBpdCB0b2dldGhlciB3aXRoIGEgbm9ybWFsIG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBVdiBIZWlnaHQgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gaGVpZ2h0TWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBoZWlnaHQgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCJcbiAqIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBoZWlnaHRNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgaGVpZ2h0IG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaGVpZ2h0TWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGhlaWdodCBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaGVpZ2h0TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgaGVpZ2h0IG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBGYWN0b3IgSGVpZ2h0IG1hcCBtdWx0aXBsaWVyLiBBZmZlY3RzIHRoZSBzdHJlbmd0aCBvZiB0aGUgcGFyYWxsYXhcbiAqIGVmZmVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBlbnZBdGxhcyBUaGUgcHJlZmlsdGVyZWRcbiAqIGVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzIChkZWZhdWx0IGlzIG51bGwpLiBUaGlzIHNldHRpbmcgb3ZlcnJpZGVzIGN1YmVNYXAgYW5kIHNwaGVyZU1hcCBhbmRcbiAqIHdpbGwgcmVwbGFjZSB0aGUgc2NlbmUgbGlnaHRpbmcgZW52aXJvbm1lbnQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gY3ViZU1hcCBUaGUgY3ViaWNcbiAqIGVudmlyb25tZW50IG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFRoaXMgc2V0dGluZyBvdmVycmlkZXMgc3BoZXJlTWFwIGFuZCB3aWxsXG4gKiByZXBsYWNlIHRoZSBzY2VuZSBsaWdodGluZyBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBzcGhlcmVNYXAgVGhlIHNwaGVyaWNhbFxuICogZW52aXJvbm1lbnQgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gVGhpcyB3aWxsIHJlcGxhY2UgdGhlIHNjZW5lIGxpZ2h0aW5nXG4gKiBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjdWJlTWFwUHJvamVjdGlvbiBUaGUgdHlwZSBvZiBwcm9qZWN0aW9uIGFwcGxpZWQgdG8gdGhlIGN1YmVNYXAgcHJvcGVydHk6XG4gKiAtIHtAbGluayBDVUJFUFJPSl9OT05FfTogVGhlIGN1YmUgbWFwIGlzIHRyZWF0ZWQgYXMgaWYgaXQgaXMgaW5maW5pdGVseSBmYXIgYXdheS5cbiAqIC0ge0BsaW5rIENVQkVQUk9KX0JPWH06IEJveC1wcm9qZWN0aW9uIGJhc2VkIG9uIGEgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveC5cbiAqIERlZmF1bHRzIHRvIHtAbGluayBDVUJFUFJPSl9OT05FfS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fSBjdWJlTWFwUHJvamVjdGlvbkJveCBUaGVcbiAqIHdvcmxkIHNwYWNlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZGVmaW5pbmcgdGhlIGJveC1wcm9qZWN0aW9uIHVzZWQgZm9yIHRoZSBjdWJlTWFwIHByb3BlcnR5LlxuICogT25seSB1c2VkIHdoZW4gY3ViZU1hcFByb2plY3Rpb24gaXMgc2V0IHRvIHtAbGluayBDVUJFUFJPSl9CT1h9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlZmxlY3Rpdml0eSBFbnZpcm9ubWVudCBtYXAgaW50ZW5zaXR5LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGxpZ2h0TWFwIEEgY3VzdG9tIGxpZ2h0bWFwXG4gKiBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIExpZ2h0bWFwcyBhcmUgdGV4dHVyZXMgdGhhdCBjb250YWluIHByZS1yZW5kZXJlZCBsaWdodGluZy5cbiAqIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBVdiBMaWdodG1hcCBVViBjaGFubmVsXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBsaWdodG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLFxuICogXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtWZWMyfSBsaWdodE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbGlnaHRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbGlnaHRtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGlnaHRWZXJ0ZXhDb2xvciBVc2UgYmFrZWQgdmVydGV4IGxpZ2h0aW5nLiBJZiBsaWdodE1hcCBpcyBzZXQsIGl0J2xsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgYmFrZWQgbGlnaHRpbmcuIENhblxuICogYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbWJpZW50VGludCBFbmFibGVzIHNjZW5lIGFtYmllbnQgbXVsdGlwbGljYXRpb24gYnkgbWF0ZXJpYWwgYW1iaWVudCBjb2xvci5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBhb01hcCBUaGUgbWFpbiAocHJpbWFyeSkgYmFrZWQgYW1iaWVudFxuICogb2NjbHVzaW9uIChBTykgbWFwIChkZWZhdWx0IGlzIG51bGwpLiBNb2R1bGF0ZXMgYW1iaWVudCBjb2xvci5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhb01hcFV2IE1haW4gKHByaW1hcnkpIEFPIG1hcCBVViBjaGFubmVsXG4gKiBAcHJvcGVydHkge3N0cmluZ30gYW9NYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG1haW4gKHByaW1hcnkpIEFPIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBhb01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtYWluIChwcmltYXJ5KSBBTyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFvTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIG1haW4gKHByaW1hcnkpIEFPIG1hcC4gRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwXG4gKiBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhb01hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG1haW4gKHByaW1hcnkpIEFPIG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYW9WZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBBTy4gSWYgYW9NYXAgaXMgc2V0LCBpdCdsbCBiZVxuICogbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGFvVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIEFPLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gYW9EZXRhaWxNYXAgVGhlXG4gKiBkZXRhaWwgKHNlY29uZGFyeSkgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24gKEFPKSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluXG4gKiAocHJpbWFyeSkgYW8gbWFwIGlzIG5vbi1udWxsLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFvRGV0YWlsTWFwVXYgRGV0YWlsIChzZWNvbmRhcnkpIEFPIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBhb0RldGFpbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgQU9cbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gYW9EZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIEFPXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhb0RldGFpbE1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGRldGFpbFxuICogKHNlY29uZGFyeSkgQU8gbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGFvRGV0YWlsTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIEFPIG1hcFxuICogdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIiAoZGVmYXVsdCBpcyBcImdcIikuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gYW9EZXRhaWxNb2RlIERldGVybWluZXMgaG93IHRoZSBtYWluIChwcmltYXJ5KSBhbmQgZGV0YWlsIChzZWNvbmRhcnkpXG4gKiBBTyBtYXBzIGFyZSBibGVuZGVkIHRvZ2V0aGVyLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9NVUx9OiBNdWx0aXBseSB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfQUREfTogQWRkIHRvZ2V0aGVyIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzLlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9TQ1JFRU59OiBTb2Z0ZXIgdmVyc2lvbiBvZiB7QGxpbmsgREVUQUlMTU9ERV9BRER9LlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9PVkVSTEFZfTogTXVsdGlwbGllcyBvciBzY3JlZW5zIHRoZSBjb2xvcnMsIGRlcGVuZGluZyBvbiB0aGUgcHJpbWFyeSBjb2xvci5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfTUlOfTogU2VsZWN0IHdoaWNoZXZlciBvZiB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycyBpcyBkYXJrZXIsXG4gKiBjb21wb25lbnQtd2lzZS5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfTUFYfTogU2VsZWN0IHdoaWNoZXZlciBvZiB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycyBpcyBsaWdodGVyLFxuICogY29tcG9uZW50LXdpc2UuXG4gKlxuICogRGVmYXVsdHMgdG8ge0BsaW5rIERFVEFJTE1PREVfTVVMfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXIgVXNlcyBhbWJpZW50IG9jY2x1c2lvbiB0byBkYXJrZW4gc3BlY3VsYXIvcmVmbGVjdGlvbi4gSXQncyBhXG4gKiBoYWNrLCBiZWNhdXNlIHJlYWwgc3BlY3VsYXIgb2NjbHVzaW9uIGlzIHZpZXctZGVwZW5kZW50LiBIb3dldmVyLCBpdCBjYW4gYmUgYmV0dGVyIHRoYW4gbm90aGluZy5cbiAqXG4gKiAtIHtAbGluayBTUEVDT0NDX05PTkV9OiBObyBzcGVjdWxhciBvY2NsdXNpb25cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfQU99OiBVc2UgQU8gZGlyZWN0bHkgdG8gb2NjbHVkZSBzcGVjdWxhci5cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlR9OiBNb2RpZnkgQU8gYmFzZWQgb24gbWF0ZXJpYWwgZ2xvc3NpbmVzcy92aWV3IGFuZ2xlIHRvIG9jY2x1ZGVcbiAqIHNwZWN1bGFyLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkgQ29udHJvbHMgdmlzaWJpbGl0eSBvZiBzcGVjdWxhciBvY2NsdXNpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG9jY2x1ZGVEaXJlY3QgVGVsbHMgaWYgQU8gc2hvdWxkIGRhcmtlbiBkaXJlY3Rpb25hbCBsaWdodGluZy4gRGVmYXVsdHMgdG9cbiAqIGZhbHNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjb25zZXJ2ZUVuZXJneSBEZWZpbmVzIGhvdyBkaWZmdXNlIGFuZCBzcGVjdWxhciBjb21wb25lbnRzIGFyZSBjb21iaW5lZCB3aGVuXG4gKiBGcmVzbmVsIGlzIG9uLiBJdCBpcyByZWNvbW1lbmRlZCB0aGF0IHlvdSBsZWF2ZSB0aGlzIG9wdGlvbiBlbmFibGVkLCBhbHRob3VnaCB5b3UgbWF5IHdhbnQgdG9cbiAqIGRpc2FibGUgaXQgaW4gY2FzZSB3aGVuIGFsbCByZWZsZWN0aW9uIGNvbWVzIG9ubHkgZnJvbSBhIGZldyBsaWdodCBzb3VyY2VzLCBhbmQgeW91IGRvbid0IHVzZSBhblxuICogZW52aXJvbm1lbnQgbWFwLCB0aGVyZWZvcmUgaGF2aW5nIG1vc3RseSBibGFjayByZWZsZWN0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRpbmdNb2RlbCBEZWZpbmVzIHRoZSBzaGFkaW5nIG1vZGVsLlxuICogLSB7QGxpbmsgU1BFQ1VMQVJfUEhPTkd9OiBQaG9uZyB3aXRob3V0IGVuZXJneSBjb25zZXJ2YXRpb24uIFlvdSBzaG91bGQgb25seSB1c2UgaXQgYXMgYVxuICogYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBvbGRlciBwcm9qZWN0cy5cbiAqIC0ge0BsaW5rIFNQRUNVTEFSX0JMSU5OfTogRW5lcmd5LWNvbnNlcnZpbmcgQmxpbm4tUGhvbmcuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZnJlc25lbE1vZGVsIERlZmluZXMgdGhlIGZvcm11bGEgdXNlZCBmb3IgRnJlc25lbCBlZmZlY3QuXG4gKiBBcyBhIHNpZGUtZWZmZWN0LCBlbmFibGluZyBhbnkgRnJlc25lbCBtb2RlbCBjaGFuZ2VzIHRoZSB3YXkgZGlmZnVzZSBhbmQgcmVmbGVjdGlvbiBjb21wb25lbnRzXG4gKiBhcmUgY29tYmluZWQuIFdoZW4gRnJlc25lbCBpcyBvZmYsIGxlZ2FjeSBub24gZW5lcmd5LWNvbnNlcnZpbmcgY29tYmluaW5nIGlzIHVzZWQuIFdoZW4gaXQgaXNcbiAqIG9uLCBjb21iaW5pbmcgYmVoYXZpb3IgaXMgZGVmaW5lZCBieSBjb25zZXJ2ZUVuZXJneSBwYXJhbWV0ZXIuXG4gKlxuICogLSB7QGxpbmsgRlJFU05FTF9OT05FfTogTm8gRnJlc25lbC5cbiAqIC0ge0BsaW5rIEZSRVNORUxfU0NITElDS306IFNjaGxpY2sncyBhcHByb3hpbWF0aW9uIG9mIEZyZXNuZWwgKHJlY29tbWVuZGVkKS4gUGFyYW1ldGVyaXplZCBieVxuICogc3BlY3VsYXIgY29sb3IuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VGb2cgQXBwbHkgZm9nZ2luZyAoYXMgY29uZmlndXJlZCBpbiBzY2VuZSBzZXR0aW5ncylcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTGlnaHRpbmcgQXBwbHkgbGlnaHRpbmdcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlU2t5Ym94IEFwcGx5IHNjZW5lIHNreWJveCBhcyBwcmVmaWx0ZXJlZCBlbnZpcm9ubWVudCBtYXBcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlR2FtbWFUb25lbWFwIEFwcGx5IGdhbW1hIGNvcnJlY3Rpb24gYW5kIHRvbmVtYXBwaW5nIChhcyBjb25maWd1cmVkIGluXG4gKiBzY2VuZSBzZXR0aW5ncykuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHBpeGVsU25hcCBBbGlnbiB2ZXJ0aWNlcyB0byBwaXhlbCBjb29yZGluYXRlcyB3aGVuIHJlbmRlcmluZy4gVXNlZnVsIGZvclxuICogcGl4ZWwgcGVyZmVjdCAyRCBncmFwaGljcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdHdvU2lkZWRMaWdodGluZyBDYWxjdWxhdGUgcHJvcGVyIG5vcm1hbHMgKGFuZCB0aGVyZWZvcmUgbGlnaHRpbmcpIG9uXG4gKiBiYWNrZmFjZXMuXG4gKiBAcHJvcGVydHkge1VwZGF0ZVNoYWRlckNhbGxiYWNrfSBvblVwZGF0ZVNoYWRlciBBIGN1c3RvbSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGFmdGVyIGFsbFxuICogc2hhZGVyIGdlbmVyYXRvciBwcm9wZXJ0aWVzIGFyZSBjb2xsZWN0ZWQgYW5kIGJlZm9yZSBzaGFkZXIgY29kZSBpcyBnZW5lcmF0ZWQuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgcmVjZWl2ZSBhbiBvYmplY3Qgd2l0aCBzaGFkZXIgZ2VuZXJhdG9yIHNldHRpbmdzIChiYXNlZCBvbiBjdXJyZW50IG1hdGVyaWFsIGFuZCBzY2VuZVxuICogcHJvcGVydGllcyksIHRoYXQgeW91IGNhbiBjaGFuZ2UgYW5kIHRoZW4gcmV0dXJuLiBSZXR1cm5lZCB2YWx1ZSB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gVGhpcyBpc1xuICogbW9zdGx5IHVzZWZ1bCB3aGVuIHJlbmRlcmluZyB0aGUgc2FtZSBzZXQgb2Ygb2JqZWN0cywgYnV0IHdpdGggZGlmZmVyZW50IHNoYWRlciB2YXJpYXRpb25zIGJhc2VkXG4gKiBvbiB0aGUgc2FtZSBtYXRlcmlhbC4gRm9yIGV4YW1wbGUsIHlvdSBtYXkgd2lzaCB0byByZW5kZXIgYSBkZXB0aCBvciBub3JtYWwgcGFzcyB1c2luZyB0ZXh0dXJlc1xuICogYXNzaWduZWQgdG8gdGhlIG1hdGVyaWFsLCBhIHJlZmxlY3Rpb24gcGFzcyB3aXRoIHNpbXBsZXIgc2hhZGVycyBhbmQgc28gb24uIFRoZXNlIHByb3BlcnRpZXMgYXJlXG4gKiBzcGxpdCBpbnRvIHR3byBzZWN0aW9ucywgZ2VuZXJpYyBzdGFuZGFyZCBtYXRlcmlhbCBvcHRpb25zIGFuZCBsaXQgb3B0aW9ucy4gUHJvcGVydGllcyBvZiB0aGVcbiAqIHN0YW5kYXJkIG1hdGVyaWFsIG9wdGlvbnMgYXJlIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gYW5kIHRoZSBvcHRpb25zIGZvciB0aGUgbGl0IG9wdGlvbnNcbiAqIGFyZSB7QGxpbmsgTGl0U2hhZGVyT3B0aW9uc30uXG4gKiBAYXVnbWVudHMgTWF0ZXJpYWxcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5jbGFzcyBTdGFuZGFyZE1hdGVyaWFsIGV4dGVuZHMgTWF0ZXJpYWwge1xuICAgIHN0YXRpYyBURVhUVVJFX1BBUkFNRVRFUlMgPSBzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnM7XG5cbiAgICBzdGF0aWMgQ1VCRU1BUF9QQVJBTUVURVJTID0gc3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzO1xuXG4gICAgdXNlckF0dHJpYnV0ZXMgPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3RhbmRhcmRNYXRlcmlhbCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgbmV3IFN0YW5kYXJkIG1hdGVyaWFsXG4gICAgICogY29uc3QgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogLy8gVXBkYXRlIHRoZSBtYXRlcmlhbCdzIGRpZmZ1c2UgYW5kIHNwZWN1bGFyIHByb3BlcnRpZXNcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAwLCAwKTtcbiAgICAgKiBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICpcbiAgICAgKiAvLyBOb3RpZnkgdGhlIG1hdGVyaWFsIHRoYXQgaXQgaGFzIGJlZW4gbW9kaWZpZWRcbiAgICAgKiBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBTdGFuZGFyZCBtYXRlcmlhbFxuICAgICAqIGNvbnN0IG1hdGVyaWFsID0gbmV3IHBjLlN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgKlxuICAgICAqIC8vIEFzc2lnbiBhIHRleHR1cmUgdG8gdGhlIGRpZmZ1c2Ugc2xvdFxuICAgICAqIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAqXG4gICAgICogLy8gVXNlIHRoZSBhbHBoYSBjaGFubmVsIG9mIHRoZSB0ZXh0dXJlIGZvciBhbHBoYSB0ZXN0aW5nIHdpdGggYSByZWZlcmVuY2UgdmFsdWUgb2YgMC41XG4gICAgICogbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICogbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAqXG4gICAgICogLy8gTm90aWZ5IHRoZSBtYXRlcmlhbCB0aGF0IGl0IGhhcyBiZWVuIG1vZGlmaWVkXG4gICAgICogbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN0b3JhZ2UgZm9yIHRleHR1cmUgYW5kIGN1YmVtYXAgYXNzZXQgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZXMgPSB7fTtcblxuICAgICAgICB0aGlzLl9hY3RpdmVQYXJhbXMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zID0gbmV3IFNldCgpO1xuXG4gICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlciA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc0J1aWxkZXIoKTtcblxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIC8vIHNldCBkZWZhdWx0IHZhbHVlc1xuICAgICAgICBPYmplY3Qua2V5cyhfcHJvcHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgICAgIHRoaXNbYF8ke25hbWV9YF0gPSBfcHJvcHNbbmFtZV0udmFsdWUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBzdHJpbmc+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2h1bmtzID0geyB9O1xuICAgICAgICB0aGlzLl91bmlmb3JtQ2FjaGUgPSB7IH07XG4gICAgfVxuXG4gICAgc2V0IHNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgRGVidWcud2FybignU3RhbmRhcmRNYXRlcmlhbCNzaGFkZXIgcHJvcGVydHkgaXMgbm90IGltcGxlbWVudGVkLCBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIH1cblxuICAgIGdldCBzaGFkZXIoKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ1N0YW5kYXJkTWF0ZXJpYWwjc2hhZGVyIHByb3BlcnR5IGlzIG5vdCBpbXBsZW1lbnRlZCwgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IGNvbnRhaW5pbmcgY3VzdG9tIHNoYWRlciBjaHVua3MgdGhhdCB3aWxsIHJlcGxhY2UgZGVmYXVsdCBvbmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIHN0cmluZz59XG4gICAgICovXG4gICAgc2V0IGNodW5rcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NodW5rcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjaHVua3MoKSB7XG4gICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NodW5rcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgYFN0YW5kYXJkTWF0ZXJpYWxgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdGFuZGFyZE1hdGVyaWFsfSBzb3VyY2UgLSBUaGUgbWF0ZXJpYWwgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtTdGFuZGFyZE1hdGVyaWFsfSBUaGUgZGVzdGluYXRpb24gbWF0ZXJpYWwuXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc3VwZXIuY29weShzb3VyY2UpO1xuXG4gICAgICAgIC8vIHNldCBwcm9wZXJ0aWVzXG4gICAgICAgIE9iamVjdC5rZXlzKF9wcm9wcykuZm9yRWFjaCgoaykgPT4ge1xuICAgICAgICAgICAgdGhpc1trXSA9IHNvdXJjZVtrXTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY2xvbmUgY2h1bmtzXG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBzb3VyY2UuX2NodW5rcykge1xuICAgICAgICAgICAgaWYgKHNvdXJjZS5fY2h1bmtzLmhhc093blByb3BlcnR5KHApKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NodW5rc1twXSA9IHNvdXJjZS5fY2h1bmtzW3BdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHZlcnRleCBzaGFkZXIgYXR0cmlidXRlIG9uIGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZW1hbnRpYyAtIFNlbWFudGljIHRvIG1hcCB0aGUgdmVydGV4IGRhdGEuIE11c3QgbWF0Y2ggd2l0aCB0aGUgc2VtYW50aWMgc2V0IG9uIHZlcnRleCBzdHJlYW1cbiAgICAgKiBvZiB0aGUgbWVzaC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1lc2guc2V0VmVydGV4U3RyZWFtKHBjLlNFTUFOVElDX0FUVFIxNSwgb2Zmc2V0LCAzKTtcbiAgICAgKiBtYXRlcmlhbC5zZXRBdHRyaWJ1dGUoJ29mZnNldCcsIHBjLlNFTUFOVElDX0FUVFIxNSk7XG4gICAgICovXG4gICAgc2V0QXR0cmlidXRlKG5hbWUsIHNlbWFudGljKSB7XG4gICAgICAgIHRoaXMudXNlckF0dHJpYnV0ZXMuc2V0KHNlbWFudGljLCBuYW1lKTtcbiAgICB9XG5cbiAgICBfc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIF9wYXJhbXMuYWRkKG5hbWUpO1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgX3NldFBhcmFtZXRlcnMocGFyYW1ldGVycykge1xuICAgICAgICBwYXJhbWV0ZXJzLmZvckVhY2goKHYpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcih2Lm5hbWUsIHYudmFsdWUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfcHJvY2Vzc1BhcmFtZXRlcnMocGFyYW1zTmFtZSkge1xuICAgICAgICBjb25zdCBwcmV2UGFyYW1zID0gdGhpc1twYXJhbXNOYW1lXTtcbiAgICAgICAgcHJldlBhcmFtcy5mb3JFYWNoKChwYXJhbSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFfcGFyYW1zLmhhcyhwYXJhbSkpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5wYXJhbWV0ZXJzW3BhcmFtXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpc1twYXJhbXNOYW1lXSA9IF9wYXJhbXM7XG4gICAgICAgIF9wYXJhbXMgPSBwcmV2UGFyYW1zO1xuICAgICAgICBfcGFyYW1zLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hcChwKSB7XG4gICAgICAgIGNvbnN0IG1uYW1lID0gcCArICdNYXAnO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW21uYW1lXTtcbiAgICAgICAgaWYgKG1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlXycgKyBtbmFtZSwgbWFwKTtcblxuICAgICAgICAgICAgY29uc3QgdG5hbWUgPSBtbmFtZSArICdUcmFuc2Zvcm0nO1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybSA9IHRoaXMuZ2V0VW5pZm9ybSh0bmFtZSk7XG4gICAgICAgICAgICBpZiAodW5pZm9ybSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcnModW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhbGxvY2F0ZSBhIHVuaWZvcm0gaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0IGluIHRoZSB1bmlmb3JtIGNhY2hlXG4gICAgX2FsbG9jVW5pZm9ybShuYW1lLCBhbGxvY0Z1bmMpIHtcbiAgICAgICAgbGV0IHVuaWZvcm0gPSB0aGlzLl91bmlmb3JtQ2FjaGVbbmFtZV07XG4gICAgICAgIGlmICghdW5pZm9ybSkge1xuICAgICAgICAgICAgdW5pZm9ybSA9IGFsbG9jRnVuYygpO1xuICAgICAgICAgICAgdGhpcy5fdW5pZm9ybUNhY2hlW25hbWVdID0gdW5pZm9ybTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9XG5cbiAgICBnZXRVbmlmb3JtKG5hbWUsIGRldmljZSwgc2NlbmUpIHtcbiAgICAgICAgcmV0dXJuIF91bmlmb3Jtc1tuYW1lXSh0aGlzLCBkZXZpY2UsIHNjZW5lKTtcbiAgICB9XG5cbiAgICB1cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKSB7XG4gICAgICAgIGNvbnN0IGdldFVuaWZvcm0gPSAobmFtZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VW5pZm9ybShuYW1lLCBkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2FtYmllbnQnLCBnZXRVbmlmb3JtKCdhbWJpZW50JykpO1xuXG4gICAgICAgIGlmICghdGhpcy5kaWZmdXNlTWFwIHx8IHRoaXMuZGlmZnVzZVRpbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZGlmZnVzZScsIGdldFVuaWZvcm0oJ2RpZmZ1c2UnKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5tZXRhbG5lc3NNYXAgfHwgdGhpcy5tZXRhbG5lc3MgPCAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9tZXRhbG5lc3MnLCB0aGlzLm1ldGFsbmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJNYXAgfHwgdGhpcy5zcGVjdWxhclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyJywgZ2V0VW5pZm9ybSgnc3BlY3VsYXInKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJpdHlGYWN0b3JNYXAgfHwgdGhpcy5zcGVjdWxhcml0eUZhY3RvclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyaXR5RmFjdG9yJywgdGhpcy5zcGVjdWxhcml0eUZhY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5NYXAgfHwgdGhpcy5zaGVlblRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NoZWVuJywgZ2V0VW5pZm9ybSgnc2hlZW4nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5HbG9zc01hcCB8fCB0aGlzLnNoZWVuR2xvc3NUaW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9zaGVlbkdsb3NzJywgdGhpcy5zaGVlbkdsb3NzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgnLCB0aGlzLnJlZnJhY3Rpb25JbmRleCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJNYXAgfHwgdGhpcy5zcGVjdWxhclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyJywgZ2V0VW5pZm9ybSgnc3BlY3VsYXInKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVHR1hTcGVjdWxhcikge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbmlzb3Ryb3B5JywgdGhpcy5hbmlzb3Ryb3B5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNsZWFyQ29hdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0JywgdGhpcy5jbGVhckNvYXQpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9jbGVhckNvYXRHbG9zcycsIHRoaXMuY2xlYXJDb2F0R2xvc3MpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9jbGVhckNvYXRCdW1waW5lc3MnLCB0aGlzLmNsZWFyQ29hdEJ1bXBpbmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2dsb3NzJywgZ2V0VW5pZm9ybSgnZ2xvc3MnKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVtaXNzaXZlTWFwIHx8IHRoaXMuZW1pc3NpdmVUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgZ2V0VW5pZm9ybSgnZW1pc3NpdmUnKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pc3NpdmVJbnRlbnNpdHkgIT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmVJbnRlbnNpdHknLCB0aGlzLmVtaXNzaXZlSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlZnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3JlZnJhY3Rpb24nLCB0aGlzLnJlZnJhY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudXNlRHluYW1pY1JlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfdGhpY2tuZXNzJywgdGhpcy50aGlja25lc3MpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hdHRlbnVhdGlvbicsIGdldFVuaWZvcm0oJ2F0dGVudWF0aW9uJykpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlJywgdGhpcy5hdHRlbnVhdGlvbkRpc3RhbmNlID09PSAwID8gMCA6IDEuMCAvIHRoaXMuYXR0ZW51YXRpb25EaXN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy51c2VJcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZScsIHRoaXMuaXJpZGVzY2VuY2UpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCcsIHRoaXMuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVRoaWNrbmVzc01pbicsIHRoaXMuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4pO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVRoaWNrbmVzc01heCcsIHRoaXMuaXJpZGVzY2VuY2VUaGlja25lc3NNYXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5vcGFjaXR5KTtcblxuICAgICAgICBpZiAodGhpcy5vcGFjaXR5RmFkZXNTcGVjdWxhciA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYWxwaGFGYWRlJywgdGhpcy5hbHBoYUZhZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub2NjbHVkZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eScsIHRoaXMub2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmN1YmVNYXBQcm9qZWN0aW9uID09PSBDVUJFUFJPSl9CT1gpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcihnZXRVbmlmb3JtKCdjdWJlTWFwUHJvamVjdGlvbkJveCcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBfbWF0VGV4MkQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hcChwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmFtYmllbnRTSCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdhbWJpZW50U0hbMF0nLCB0aGlzLmFtYmllbnRTSCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYnVtcGluZXNzJywgdGhpcy5idW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubm9ybWFsTWFwICYmIHRoaXMubm9ybWFsRGV0YWlsTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcycsIHRoaXMubm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmhlaWdodE1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9oZWlnaHRNYXBGYWN0b3InLCBnZXRVbmlmb3JtKCdoZWlnaHRNYXBGYWN0b3InKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc1Bob25nID0gdGhpcy5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HO1xuXG4gICAgICAgIC8vIHNldCBvdmVycmlkZGVuIGVudmlyb25tZW50IHRleHR1cmVzXG4gICAgICAgIGlmICh0aGlzLmVudkF0bGFzICYmIHRoaXMuY3ViZU1hcCAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgdGhpcy5lbnZBdGxhcyk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHRoaXMuY3ViZU1hcCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbnZBdGxhcyAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgdGhpcy5lbnZBdGxhcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jdWJlTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHRoaXMuY3ViZU1hcCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcGhlcmVNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9zcGhlcmVNYXAnLCB0aGlzLnNwaGVyZU1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3JlZmxlY3Rpdml0eScsIHRoaXMucmVmbGVjdGl2aXR5KTtcblxuICAgICAgICAvLyByZW1vdmUgdW51c2VkIHBhcmFtc1xuICAgICAgICB0aGlzLl9wcm9jZXNzUGFyYW1ldGVycygnX2FjdGl2ZVBhcmFtcycpO1xuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVFbnZVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKSB7XG4gICAgICAgIGNvbnN0IGlzUGhvbmcgPSB0aGlzLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkc7XG4gICAgICAgIGNvbnN0IGhhc0xvY2FsRW52T3ZlcnJpZGUgPSAodGhpcy5lbnZBdGxhcyAmJiAhaXNQaG9uZykgfHwgdGhpcy5jdWJlTWFwIHx8IHRoaXMuc3BoZXJlTWFwO1xuXG4gICAgICAgIGlmICghaGFzTG9jYWxFbnZPdmVycmlkZSAmJiB0aGlzLnVzZVNreWJveCkge1xuICAgICAgICAgICAgaWYgKHNjZW5lLmVudkF0bGFzICYmIHNjZW5lLnNreWJveCAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9lbnZBdGxhcycsIHNjZW5lLmVudkF0bGFzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHNjZW5lLnNreWJveCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjZW5lLmVudkF0bGFzICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgc2NlbmUuZW52QXRsYXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzY2VuZS5za3lib3gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHNjZW5lLnNreWJveCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wcm9jZXNzUGFyYW1ldGVycygnX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zJyk7XG4gICAgfVxuXG4gICAgZ2V0U2hhZGVyVmFyaWFudChkZXZpY2UsIHNjZW5lLCBvYmpEZWZzLCB1bnVzZWQsIHBhc3MsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZlcnRleEZvcm1hdCkge1xuXG4gICAgICAgIC8vIHVwZGF0ZSBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhXG4gICAgICAgIHRoaXMudXBkYXRlRW52VW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG5cbiAgICAgICAgLy8gTWluaW1hbCBvcHRpb25zIGZvciBEZXB0aCBhbmQgU2hhZG93IHBhc3Nlc1xuICAgICAgICBjb25zdCBzaGFkZXJQYXNzSW5mbyA9IFNoYWRlclBhc3MuZ2V0KGRldmljZSkuZ2V0QnlJbmRleChwYXNzKTtcbiAgICAgICAgY29uc3QgbWluaW1hbE9wdGlvbnMgPSBwYXNzID09PSBTSEFERVJfREVQVEggfHwgcGFzcyA9PT0gU0hBREVSX1BJQ0sgfHwgc2hhZGVyUGFzc0luZm8uaXNTaGFkb3c7XG4gICAgICAgIGxldCBvcHRpb25zID0gbWluaW1hbE9wdGlvbnMgPyBzdGFuZGFyZC5vcHRpb25zQ29udGV4dE1pbiA6IHN0YW5kYXJkLm9wdGlvbnNDb250ZXh0O1xuXG4gICAgICAgIGlmIChtaW5pbWFsT3B0aW9ucylcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVNaW5SZWYob3B0aW9ucywgc2NlbmUsIHRoaXMsIG9iakRlZnMsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVSZWYob3B0aW9ucywgc2NlbmUsIHRoaXMsIG9iakRlZnMsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG5cbiAgICAgICAgLy8gZXhlY3V0ZSB1c2VyIGNhbGxiYWNrIHRvIG1vZGlmeSB0aGUgb3B0aW9uc1xuICAgICAgICBpZiAodGhpcy5vblVwZGF0ZVNoYWRlcikge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHRoaXMub25VcGRhdGVTaGFkZXIob3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9jZXNzaW5nT3B0aW9ucyA9IG5ldyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zKHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0LCB2ZXJ0ZXhGb3JtYXQpO1xuXG4gICAgICAgIGNvbnN0IGxpYnJhcnkgPSBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpO1xuICAgICAgICBsaWJyYXJ5LnJlZ2lzdGVyKCdzdGFuZGFyZCcsIHN0YW5kYXJkKTtcbiAgICAgICAgY29uc3Qgc2hhZGVyID0gbGlicmFyeS5nZXRQcm9ncmFtKCdzdGFuZGFyZCcsIG9wdGlvbnMsIHByb2Nlc3NpbmdPcHRpb25zLCB0aGlzLnVzZXJJZCk7XG5cbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoaXMgbWF0ZXJpYWwgZnJvbSB0aGUgc2NlbmUgYW5kIHBvc3NpYmx5IGZyZWVzIHVwIG1lbW9yeSBmcm9tIGl0cyBzaGFkZXJzIChpZiB0aGVyZVxuICAgICAqIGFyZSBubyBvdGhlciBtYXRlcmlhbHMgdXNpbmcgaXQpLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHVuYmluZCAodGV4dHVyZSkgYXNzZXQgcmVmZXJlbmNlc1xuICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IGluIHRoaXMuX2Fzc2V0UmVmZXJlbmNlcykge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzW2Fzc2V0XS5fdW5iaW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzID0gbnVsbDtcblxuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxufVxuXG4vLyBkZWZpbmUgYSB1bmlmb3JtIGdldCBmdW5jdGlvblxuY29uc3QgZGVmaW5lVW5pZm9ybSA9IChuYW1lLCBnZXRVbmlmb3JtRnVuYykgPT4ge1xuICAgIF91bmlmb3Jtc1tuYW1lXSA9IGdldFVuaWZvcm1GdW5jO1xufTtcblxuY29uc3QgZGVmaW5lUHJvcEludGVybmFsID0gKG5hbWUsIGNvbnN0cnVjdG9yRnVuYywgc2V0dGVyRnVuYywgZ2V0dGVyRnVuYykgPT4ge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICBnZXQ6IGdldHRlckZ1bmMgfHwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbYF8ke25hbWV9YF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogc2V0dGVyRnVuY1xuICAgIH0pO1xuXG4gICAgX3Byb3BzW25hbWVdID0ge1xuICAgICAgICB2YWx1ZTogY29uc3RydWN0b3JGdW5jXG4gICAgfTtcbn07XG5cbi8vIGRlZmluZSBhIHNpbXBsZSB2YWx1ZSBwcm9wZXJ0eSAoZmxvYXQsIHN0cmluZyBldGMpXG5jb25zdCBkZWZpbmVWYWx1ZVByb3AgPSAocHJvcCkgPT4ge1xuICAgIGNvbnN0IGludGVybmFsTmFtZSA9IGBfJHtwcm9wLm5hbWV9YDtcbiAgICBjb25zdCBkaXJ0eVNoYWRlckZ1bmMgPSBwcm9wLmRpcnR5U2hhZGVyRnVuYyB8fCAoKCkgPT4gdHJ1ZSk7XG5cbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpc1tpbnRlcm5hbE5hbWVdO1xuICAgICAgICBpZiAob2xkVmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRoaXMuX2RpcnR5U2hhZGVyIHx8IGRpcnR5U2hhZGVyRnVuYyhvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpc1tpbnRlcm5hbE5hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lUHJvcEludGVybmFsKHByb3AubmFtZSwgKCkgPT4gcHJvcC5kZWZhdWx0VmFsdWUsIHNldHRlckZ1bmMsIHByb3AuZ2V0dGVyRnVuYyk7XG59O1xuXG4vLyBkZWZpbmUgYW4gYWdncmVnYXRlIHByb3BlcnR5IChjb2xvciwgdmVjMyBldGMpXG5jb25zdCBkZWZpbmVBZ2dQcm9wID0gKHByb3ApID0+IHtcbiAgICBjb25zdCBpbnRlcm5hbE5hbWUgPSBgXyR7cHJvcC5uYW1lfWA7XG4gICAgY29uc3QgZGlydHlTaGFkZXJGdW5jID0gcHJvcC5kaXJ0eVNoYWRlckZ1bmMgfHwgKCgpID0+IHRydWUpO1xuXG4gICAgY29uc3Qgc2V0dGVyRnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXNbaW50ZXJuYWxOYW1lXTtcbiAgICAgICAgaWYgKCFvbGRWYWx1ZS5lcXVhbHModmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRoaXMuX2RpcnR5U2hhZGVyIHx8IGRpcnR5U2hhZGVyRnVuYyhvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpc1tpbnRlcm5hbE5hbWVdID0gb2xkVmFsdWUuY29weSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lUHJvcEludGVybmFsKHByb3AubmFtZSwgKCkgPT4gcHJvcC5kZWZhdWx0VmFsdWUuY2xvbmUoKSwgc2V0dGVyRnVuYywgcHJvcC5nZXR0ZXJGdW5jKTtcbn07XG5cbi8vIGRlZmluZSBlaXRoZXIgYSB2YWx1ZSBvciBhZ2dyZWdhdGUgcHJvcGVydHlcbmNvbnN0IGRlZmluZVByb3AgPSAocHJvcCkgPT4ge1xuICAgIHJldHVybiBwcm9wLmRlZmF1bHRWYWx1ZSAmJiBwcm9wLmRlZmF1bHRWYWx1ZS5jbG9uZSA/IGRlZmluZUFnZ1Byb3AocHJvcCkgOiBkZWZpbmVWYWx1ZVByb3AocHJvcCk7XG59O1xuXG5mdW5jdGlvbiBfZGVmaW5lVGV4MkQobmFtZSwgY2hhbm5lbCA9IFwicmdiXCIsIHZlcnRleENvbG9yID0gdHJ1ZSwgdXYgPSAwKSB7XG4gICAgLy8gc3RvcmUgdGV4dHVyZSBuYW1lXG4gICAgX21hdFRleDJEW25hbWVdID0gY2hhbm5lbC5sZW5ndGggfHwgLTE7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG51bGwsXG4gICAgICAgIGRpcnR5U2hhZGVyRnVuYzogKG9sZFZhbHVlLCBuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuICEhb2xkVmFsdWUgIT09ICEhbmV3VmFsdWUgfHxcbiAgICAgICAgICAgICAgICBvbGRWYWx1ZSAmJiAob2xkVmFsdWUudHlwZSAhPT0gbmV3VmFsdWUudHlwZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZS5maXhDdWJlbWFwU2VhbXMgIT09IG5ld1ZhbHVlLmZpeEN1YmVtYXBTZWFtcyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZS5mb3JtYXQgIT09IG5ld1ZhbHVlLmZvcm1hdCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcFRpbGluZ2AsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogbmV3IFZlYzIoMSwgMSlcbiAgICB9KTtcblxuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcE9mZnNldGAsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogbmV3IFZlYzIoMCwgMClcbiAgICB9KTtcblxuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcFJvdGF0aW9uYCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiAwXG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBVdmAsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdXZcbiAgICB9KTtcblxuICAgIGlmIChjaGFubmVsKSB7XG4gICAgICAgIGRlZmluZVByb3Aoe1xuICAgICAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBDaGFubmVsYCxcbiAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogY2hhbm5lbFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodmVydGV4Q29sb3IpIHtcbiAgICAgICAgICAgIGRlZmluZVByb3Aoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGAke25hbWV9VmVydGV4Q29sb3JgLFxuICAgICAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtuYW1lfVZlcnRleENvbG9yQ2hhbm5lbGAsXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBjaGFubmVsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbnN0cnVjdCB0aGUgdHJhbnNmb3JtIHVuaWZvcm1cbiAgICBjb25zdCBtYXBUaWxpbmcgPSBgJHtuYW1lfU1hcFRpbGluZ2A7XG4gICAgY29uc3QgbWFwT2Zmc2V0ID0gYCR7bmFtZX1NYXBPZmZzZXRgO1xuICAgIGNvbnN0IG1hcFJvdGF0aW9uID0gYCR7bmFtZX1NYXBSb3RhdGlvbmA7XG4gICAgY29uc3QgbWFwVHJhbnNmb3JtID0gYCR7bmFtZX1NYXBUcmFuc2Zvcm1gO1xuICAgIGRlZmluZVVuaWZvcm0obWFwVHJhbnNmb3JtLCAobWF0ZXJpYWwsIGRldmljZSwgc2NlbmUpID0+IHtcbiAgICAgICAgY29uc3QgdGlsaW5nID0gbWF0ZXJpYWxbbWFwVGlsaW5nXTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gbWF0ZXJpYWxbbWFwT2Zmc2V0XTtcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSBtYXRlcmlhbFttYXBSb3RhdGlvbl07XG5cbiAgICAgICAgaWYgKHRpbGluZy54ID09PSAxICYmIHRpbGluZy55ID09PSAxICYmXG4gICAgICAgICAgICBvZmZzZXQueCA9PT0gMCAmJiBvZmZzZXQueSA9PT0gMCAmJlxuICAgICAgICAgICAgcm90YXRpb24gPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdW5pZm9ybSA9IG1hdGVyaWFsLl9hbGxvY1VuaWZvcm0obWFwVHJhbnNmb3JtLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgICBuYW1lOiBgdGV4dHVyZV8ke21hcFRyYW5zZm9ybX0wYCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG5hbWU6IGB0ZXh0dXJlXyR7bWFwVHJhbnNmb3JtfTFgLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBuZXcgRmxvYXQzMkFycmF5KDMpXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY3IgPSBNYXRoLmNvcyhyb3RhdGlvbiAqIG1hdGguREVHX1RPX1JBRCk7XG4gICAgICAgIGNvbnN0IHNyID0gTWF0aC5zaW4ocm90YXRpb24gKiBtYXRoLkRFR19UT19SQUQpO1xuXG4gICAgICAgIGNvbnN0IHVuaWZvcm0wID0gdW5pZm9ybVswXS52YWx1ZTtcbiAgICAgICAgdW5pZm9ybTBbMF0gPSBjciAqIHRpbGluZy54O1xuICAgICAgICB1bmlmb3JtMFsxXSA9IC1zciAqIHRpbGluZy55O1xuICAgICAgICB1bmlmb3JtMFsyXSA9IG9mZnNldC54O1xuXG4gICAgICAgIGNvbnN0IHVuaWZvcm0xID0gdW5pZm9ybVsxXS52YWx1ZTtcbiAgICAgICAgdW5pZm9ybTFbMF0gPSBzciAqIHRpbGluZy54O1xuICAgICAgICB1bmlmb3JtMVsxXSA9IGNyICogdGlsaW5nLnk7XG4gICAgICAgIHVuaWZvcm0xWzJdID0gMS4wIC0gdGlsaW5nLnkgLSBvZmZzZXQueTtcblxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZUNvbG9yKG5hbWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZSxcbiAgICAgICAgZ2V0dGVyRnVuYzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gSEFDSzogc2luY2Ugd2UgY2FuJ3QgZGV0ZWN0IHdoZXRoZXIgYSB1c2VyIGlzIGdvaW5nIHRvIHNldCBhIGNvbG9yIHByb3BlcnR5XG4gICAgICAgICAgICAvLyBhZnRlciBjYWxsaW5nIHRoaXMgZ2V0dGVyIChpLmUgZG9pbmcgbWF0ZXJpYWwuYW1iaWVudC5yID0gMC41KSB3ZSBtdXN0IGFzc3VtZVxuICAgICAgICAgICAgLy8gdGhlIHdvcnN0IGFuZCBmbGFnIHRoZSBzaGFkZXIgYXMgZGlydHkuXG4gICAgICAgICAgICAvLyBUaGlzIG1lYW5zIGN1cnJlbnRseSBhbmltYXRpbmcgYSBtYXRlcmlhbCBjb2xvciBpcyBob3JyaWJseSBzbG93LlxuICAgICAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbYF8ke25hbWV9YF07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmluZVVuaWZvcm0obmFtZSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHVuaWZvcm0gPSBtYXRlcmlhbC5fYWxsb2NVbmlmb3JtKG5hbWUsICgpID0+IG5ldyBGbG9hdDMyQXJyYXkoMykpO1xuICAgICAgICBjb25zdCBjb2xvciA9IG1hdGVyaWFsW25hbWVdO1xuICAgICAgICBjb25zdCBnYW1tYSA9IG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCAmJiBzY2VuZS5nYW1tYUNvcnJlY3Rpb247XG5cbiAgICAgICAgaWYgKGdhbW1hKSB7XG4gICAgICAgICAgICB1bmlmb3JtWzBdID0gTWF0aC5wb3coY29sb3IuciwgMi4yKTtcbiAgICAgICAgICAgIHVuaWZvcm1bMV0gPSBNYXRoLnBvdyhjb2xvci5nLCAyLjIpO1xuICAgICAgICAgICAgdW5pZm9ybVsyXSA9IE1hdGgucG93KGNvbG9yLmIsIDIuMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmlmb3JtWzBdID0gY29sb3IucjtcbiAgICAgICAgICAgIHVuaWZvcm1bMV0gPSBjb2xvci5nO1xuICAgICAgICAgICAgdW5pZm9ybVsyXSA9IGNvbG9yLmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZUZsb2F0KG5hbWUsIGRlZmF1bHRWYWx1ZSwgZ2V0VW5pZm9ybUZ1bmMpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIGRpcnR5U2hhZGVyRnVuYzogKG9sZFZhbHVlLCBuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBub3QgYWx3YXlzIG9wdGltYWwgYW5kIHdpbGwgc29tZXRpbWVzIHRyaWdnZXIgcmVkdW5kYW50IHNoYWRlclxuICAgICAgICAgICAgLy8gcmVjb21waWxhdGlvbi4gSG93ZXZlciwgbm8gbnVtYmVyIHByb3BlcnR5IG9uIGEgc3RhbmRhcmQgbWF0ZXJpYWxcbiAgICAgICAgICAgIC8vIHRyaWdnZXJzIGEgc2hhZGVyIHJlY29tcGlsZSBpZiB0aGUgcHJldmlvdXMgYW5kIGN1cnJlbnQgdmFsdWVzIGJvdGhcbiAgICAgICAgICAgIC8vIGhhdmUgYSBmcmFjdGlvbmFsIHBhcnQuXG4gICAgICAgICAgICByZXR1cm4gKG9sZFZhbHVlID09PSAwIHx8IG9sZFZhbHVlID09PSAxKSAhPT0gKG5ld1ZhbHVlID09PSAwIHx8IG5ld1ZhbHVlID09PSAxKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmaW5lVW5pZm9ybShuYW1lLCBnZXRVbmlmb3JtRnVuYyk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVPYmplY3QobmFtZSwgZ2V0VW5pZm9ybUZ1bmMpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLFxuICAgICAgICBkaXJ0eVNoYWRlckZ1bmM6IChvbGRWYWx1ZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhIW9sZFZhbHVlID09PSAhIW5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVVbmlmb3JtKG5hbWUsIGdldFVuaWZvcm1GdW5jKTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZUZsYWcobmFtZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlXG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVNYXRlcmlhbFByb3BzKCkge1xuICAgIF9kZWZpbmVDb2xvcignYW1iaWVudCcsIG5ldyBDb2xvcigwLjcsIDAuNywgMC43KSk7XG4gICAgX2RlZmluZUNvbG9yKCdkaWZmdXNlJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lQ29sb3IoJ3NwZWN1bGFyJywgbmV3IENvbG9yKDAsIDAsIDApKTtcbiAgICBfZGVmaW5lQ29sb3IoJ2VtaXNzaXZlJywgbmV3IENvbG9yKDAsIDAsIDApKTtcbiAgICBfZGVmaW5lQ29sb3IoJ3NoZWVuJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lQ29sb3IoJ2F0dGVudWF0aW9uJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2VtaXNzaXZlSW50ZW5zaXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdzcGVjdWxhcml0eUZhY3RvcicsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnc2hlZW5HbG9zcycsIDAuMCk7XG5cbiAgICBfZGVmaW5lRmxvYXQoJ2dsb3NzJywgMC4yNSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIHJldHVybiBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HID9cbiAgICAgICAgICAgIC8vIGxlZ2FjeTogZXhwYW5kIGJhY2sgdG8gc3BlY3VsYXIgcG93ZXJcbiAgICAgICAgICAgIE1hdGgucG93KDIsIG1hdGVyaWFsLmdsb3NzICogMTEpIDpcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzO1xuICAgIH0pO1xuXG4gICAgX2RlZmluZUZsb2F0KCdoZWlnaHRNYXBGYWN0b3InLCAxLCAobWF0ZXJpYWwsIGRldmljZSwgc2NlbmUpID0+IHtcbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsLmhlaWdodE1hcEZhY3RvciAqIDAuMDI1O1xuICAgIH0pO1xuICAgIF9kZWZpbmVGbG9hdCgnb3BhY2l0eScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYWxwaGFGYWRlJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdhbHBoYVRlc3QnLCAwKTsgICAgICAgLy8gTk9URTogb3ZlcndyaXRlcyBNYXRlcmlhbC5hbHBoYVRlc3RcbiAgICBfZGVmaW5lRmxvYXQoJ2J1bXBpbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdyZWZsZWN0aXZpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ29jY2x1ZGVTcGVjdWxhckludGVuc2l0eScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgncmVmcmFjdGlvbicsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgncmVmcmFjdGlvbkluZGV4JywgMS4wIC8gMS41KTsgLy8gYXBwcm94LiAoYWlyIGlvciAvIGdsYXNzIGlvcilcbiAgICBfZGVmaW5lRmxvYXQoJ3RoaWNrbmVzcycsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnYXR0ZW51YXRpb25EaXN0YW5jZScsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnbWV0YWxuZXNzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdhbmlzb3Ryb3B5JywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdjbGVhckNvYXQnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2NsZWFyQ29hdEdsb3NzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdjbGVhckNvYXRCdW1waW5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FvVXZTZXQnLCAwLCBudWxsKTsgLy8gbGVnYWN5XG5cbiAgICBfZGVmaW5lRmxvYXQoJ2lyaWRlc2NlbmNlJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCcsIDEuMCAvIDEuNSk7XG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01pbicsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnaXJpZGVzY2VuY2VUaGlja25lc3NNYXgnLCAwKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2FtYmllbnRTSCcpO1xuXG4gICAgX2RlZmluZU9iamVjdCgnY3ViZU1hcFByb2plY3Rpb25Cb3gnLCAobWF0ZXJpYWwsIGRldmljZSwgc2NlbmUpID0+IHtcbiAgICAgICAgY29uc3QgdW5pZm9ybSA9IG1hdGVyaWFsLl9hbGxvY1VuaWZvcm0oJ2N1YmVNYXBQcm9qZWN0aW9uQm94JywgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2VudkJveE1pbicsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZW52Qm94TWF4JyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGJib3hNaW4gPSBtYXRlcmlhbC5jdWJlTWFwUHJvamVjdGlvbkJveC5nZXRNaW4oKTtcbiAgICAgICAgY29uc3QgbWluVW5pZm9ybSA9IHVuaWZvcm1bMF0udmFsdWU7XG4gICAgICAgIG1pblVuaWZvcm1bMF0gPSBiYm94TWluLng7XG4gICAgICAgIG1pblVuaWZvcm1bMV0gPSBiYm94TWluLnk7XG4gICAgICAgIG1pblVuaWZvcm1bMl0gPSBiYm94TWluLno7XG5cbiAgICAgICAgY29uc3QgYmJveE1heCA9IG1hdGVyaWFsLmN1YmVNYXBQcm9qZWN0aW9uQm94LmdldE1heCgpO1xuICAgICAgICBjb25zdCBtYXhVbmlmb3JtID0gdW5pZm9ybVsxXS52YWx1ZTtcbiAgICAgICAgbWF4VW5pZm9ybVswXSA9IGJib3hNYXgueDtcbiAgICAgICAgbWF4VW5pZm9ybVsxXSA9IGJib3hNYXgueTtcbiAgICAgICAgbWF4VW5pZm9ybVsyXSA9IGJib3hNYXguejtcblxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9KTtcblxuICAgIF9kZWZpbmVGbGFnKCdhbWJpZW50VGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZGlmZnVzZVRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3NwZWN1bGFyVGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnc3BlY3VsYXJpdHlGYWN0b3JUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdlbWlzc2l2ZVRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2Zhc3RUYm4nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZU1ldGFsbmVzcycsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvcicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlU2hlZW4nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2VuYWJsZUdHWFNwZWN1bGFyJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdvY2NsdWRlRGlyZWN0JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdub3JtYWxpemVOb3JtYWxNYXAnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnY29uc2VydmVFbmVyZ3knLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnb3BhY2l0eUZhZGVzU3BlY3VsYXInLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnb2NjbHVkZVNwZWN1bGFyJywgU1BFQ09DQ19BTyk7XG4gICAgX2RlZmluZUZsYWcoJ3NoYWRpbmdNb2RlbCcsIFNQRUNVTEFSX0JMSU5OKTtcbiAgICBfZGVmaW5lRmxhZygnZnJlc25lbE1vZGVsJywgRlJFU05FTF9TQ0hMSUNLKTsgLy8gTk9URTogdGhpcyBoYXMgYmVlbiBtYWRlIHRvIG1hdGNoIHRoZSBkZWZhdWx0IHNoYWRpbmcgbW9kZWwgKHRvIGZpeCBhIGJ1ZylcbiAgICBfZGVmaW5lRmxhZygndXNlRHluYW1pY1JlZnJhY3Rpb24nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2N1YmVNYXBQcm9qZWN0aW9uJywgQ1VCRVBST0pfTk9ORSk7XG4gICAgX2RlZmluZUZsYWcoJ2N1c3RvbUZyYWdtZW50U2hhZGVyJywgbnVsbCk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZUZvZycsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VMaWdodGluZycsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VHYW1tYVRvbmVtYXAnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlU2t5Ym94JywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ2ZvcmNlVXYxJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdwaXhlbFNuYXAnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3R3b1NpZGVkTGlnaHRpbmcnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ25pbmVTbGljZWRNb2RlJywgdW5kZWZpbmVkKTsgLy8gTk9URTogdGhpcyB1c2VkIHRvIGJlIFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCBidXQgd2FzIHVuZGVmaW5lZCBwcmUtUm9sbHVwXG4gICAgX2RlZmluZUZsYWcoJ21zZGZUZXh0QXR0cmlidXRlJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VJcmlkZXNjZW5jZScsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZ2xvc3NJbnZlcnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3NoZWVuR2xvc3NJbnZlcnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2NsZWFyQ29hdEdsb3NzSW52ZXJ0JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdvcGFjaXR5RGl0aGVyJywgRElUSEVSX05PTkUpO1xuICAgIF9kZWZpbmVGbGFnKCdvcGFjaXR5U2hhZG93RGl0aGVyJywgRElUSEVSX05PTkUpO1xuXG4gICAgX2RlZmluZVRleDJEKCdkaWZmdXNlJyk7XG4gICAgX2RlZmluZVRleDJEKCdzcGVjdWxhcicpO1xuICAgIF9kZWZpbmVUZXgyRCgnZW1pc3NpdmUnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3RoaWNrbmVzcycsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdzcGVjdWxhcml0eUZhY3RvcicsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdub3JtYWwnLCAnJyk7XG4gICAgX2RlZmluZVRleDJEKCdtZXRhbG5lc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnZ2xvc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnb3BhY2l0eScsICdhJyk7XG4gICAgX2RlZmluZVRleDJEKCdyZWZyYWN0aW9uJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2hlaWdodCcsICdnJywgZmFsc2UpO1xuICAgIF9kZWZpbmVUZXgyRCgnYW8nLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnbGlnaHQnLCAncmdiJywgdHJ1ZSwgMSk7XG4gICAgX2RlZmluZVRleDJEKCdtc2RmJywgJycpO1xuICAgIF9kZWZpbmVUZXgyRCgnZGlmZnVzZURldGFpbCcsICdyZ2InLCBmYWxzZSk7XG4gICAgX2RlZmluZVRleDJEKCdub3JtYWxEZXRhaWwnLCAnJyk7XG4gICAgX2RlZmluZVRleDJEKCdhb0RldGFpbCcsICdnJywgZmFsc2UpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0JywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2NsZWFyQ29hdEdsb3NzJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2NsZWFyQ29hdE5vcm1hbCcsICcnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3NoZWVuJywgJ3JnYicpO1xuICAgIF9kZWZpbmVUZXgyRCgnc2hlZW5HbG9zcycsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdpcmlkZXNjZW5jZScsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdpcmlkZXNjZW5jZVRoaWNrbmVzcycsICdnJyk7XG5cbiAgICBfZGVmaW5lRmxhZygnZGlmZnVzZURldGFpbE1vZGUnLCBERVRBSUxNT0RFX01VTCk7XG4gICAgX2RlZmluZUZsYWcoJ2FvRGV0YWlsTW9kZScsIERFVEFJTE1PREVfTVVMKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2N1YmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdzcGhlcmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdlbnZBdGxhcycpO1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBnZXR0ZXJcbiAgICBjb25zdCBnZXR0ZXJGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcbiAgICB9O1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBzZXR0ZXJcbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGN1YmVtYXBzID0gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcblxuICAgICAgICB2YWx1ZSA9IHZhbHVlIHx8IFtdO1xuXG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgIGxldCBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB2ID0gdmFsdWVbaV0gfHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChjdWJlbWFwc1tpXSAhPT0gdikge1xuICAgICAgICAgICAgICAgIGN1YmVtYXBzW2ldID0gdjtcbiAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbXBsZXRlID0gY29tcGxldGUgJiYgKCEhY3ViZW1hcHNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgIGlmIChjb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSBFbnZMaWdodGluZy5nZW5lcmF0ZVByZWZpbHRlcmVkQXRsYXMoY3ViZW1hcHMsIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLmVudkF0bGFzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVudkF0bGFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgZW1wdHkgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICBkZWZpbmVQcm9wSW50ZXJuYWwoJ3ByZWZpbHRlcmVkQ3ViZW1hcHMnLCAoKSA9PiBlbXB0eS5zbGljZSgpLCBzZXR0ZXJGdW5jLCBnZXR0ZXJGdW5jKTtcbn1cblxuX2RlZmluZU1hdGVyaWFsUHJvcHMoKTtcblxuZXhwb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9O1xuIl0sIm5hbWVzIjpbIl9wcm9wcyIsIl91bmlmb3JtcyIsIl9wYXJhbXMiLCJTZXQiLCJTdGFuZGFyZE1hdGVyaWFsIiwiTWF0ZXJpYWwiLCJjb25zdHJ1Y3RvciIsInVzZXJBdHRyaWJ1dGVzIiwiTWFwIiwiX2RpcnR5U2hhZGVyIiwiX2Fzc2V0UmVmZXJlbmNlcyIsIl9hY3RpdmVQYXJhbXMiLCJfYWN0aXZlTGlnaHRpbmdQYXJhbXMiLCJzaGFkZXJPcHRCdWlsZGVyIiwiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIiwicmVzZXQiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsIm5hbWUiLCJ2YWx1ZSIsIl9jaHVua3MiLCJfdW5pZm9ybUNhY2hlIiwic2hhZGVyIiwiRGVidWciLCJ3YXJuIiwiY2h1bmtzIiwiY29weSIsInNvdXJjZSIsImsiLCJwIiwiaGFzT3duUHJvcGVydHkiLCJzZXRBdHRyaWJ1dGUiLCJzZW1hbnRpYyIsInNldCIsIl9zZXRQYXJhbWV0ZXIiLCJhZGQiLCJzZXRQYXJhbWV0ZXIiLCJfc2V0UGFyYW1ldGVycyIsInBhcmFtZXRlcnMiLCJ2IiwiX3Byb2Nlc3NQYXJhbWV0ZXJzIiwicGFyYW1zTmFtZSIsInByZXZQYXJhbXMiLCJwYXJhbSIsImhhcyIsImNsZWFyIiwiX3VwZGF0ZU1hcCIsIm1uYW1lIiwibWFwIiwidG5hbWUiLCJ1bmlmb3JtIiwiZ2V0VW5pZm9ybSIsIl9hbGxvY1VuaWZvcm0iLCJhbGxvY0Z1bmMiLCJkZXZpY2UiLCJzY2VuZSIsInVwZGF0ZVVuaWZvcm1zIiwiZGlmZnVzZU1hcCIsImRpZmZ1c2VUaW50IiwidXNlTWV0YWxuZXNzIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzIiwic3BlY3VsYXJNYXAiLCJzcGVjdWxhclRpbnQiLCJzcGVjdWxhcml0eUZhY3Rvck1hcCIsInNwZWN1bGFyaXR5RmFjdG9yVGludCIsInNwZWN1bGFyaXR5RmFjdG9yIiwic2hlZW5NYXAiLCJzaGVlblRpbnQiLCJzaGVlbkdsb3NzTWFwIiwic2hlZW5HbG9zc1RpbnQiLCJzaGVlbkdsb3NzIiwicmVmcmFjdGlvbkluZGV4IiwiZW5hYmxlR0dYU3BlY3VsYXIiLCJhbmlzb3Ryb3B5IiwiY2xlYXJDb2F0IiwiY2xlYXJDb2F0R2xvc3MiLCJjbGVhckNvYXRCdW1waW5lc3MiLCJlbWlzc2l2ZU1hcCIsImVtaXNzaXZlVGludCIsImVtaXNzaXZlSW50ZW5zaXR5IiwicmVmcmFjdGlvbiIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwidGhpY2tuZXNzIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJvcGFjaXR5Iiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJhbHBoYUZhZGUiLCJvY2NsdWRlU3BlY3VsYXIiLCJvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkiLCJjdWJlTWFwUHJvamVjdGlvbiIsIkNVQkVQUk9KX0JPWCIsIl9tYXRUZXgyRCIsImFtYmllbnRTSCIsIm5vcm1hbE1hcCIsImJ1bXBpbmVzcyIsIm5vcm1hbERldGFpbE1hcCIsIm5vcm1hbERldGFpbE1hcEJ1bXBpbmVzcyIsImhlaWdodE1hcCIsImlzUGhvbmciLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImVudkF0bGFzIiwiY3ViZU1hcCIsInNwaGVyZU1hcCIsInJlZmxlY3Rpdml0eSIsImNsZWFyVmFyaWFudHMiLCJ1cGRhdGVFbnZVbmlmb3JtcyIsImhhc0xvY2FsRW52T3ZlcnJpZGUiLCJ1c2VTa3lib3giLCJza3lib3giLCJnZXRTaGFkZXJWYXJpYW50Iiwib2JqRGVmcyIsInVudXNlZCIsInBhc3MiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJzaGFkZXJQYXNzSW5mbyIsIlNoYWRlclBhc3MiLCJnZXQiLCJnZXRCeUluZGV4IiwibWluaW1hbE9wdGlvbnMiLCJTSEFERVJfREVQVEgiLCJTSEFERVJfUElDSyIsImlzU2hhZG93Iiwib3B0aW9ucyIsInN0YW5kYXJkIiwib3B0aW9uc0NvbnRleHRNaW4iLCJvcHRpb25zQ29udGV4dCIsInVwZGF0ZU1pblJlZiIsInVwZGF0ZVJlZiIsIm9uVXBkYXRlU2hhZGVyIiwicHJvY2Vzc2luZ09wdGlvbnMiLCJTaGFkZXJQcm9jZXNzb3JPcHRpb25zIiwibGlicmFyeSIsImdldFByb2dyYW1MaWJyYXJ5IiwicmVnaXN0ZXIiLCJnZXRQcm9ncmFtIiwidXNlcklkIiwiZGVzdHJveSIsImFzc2V0IiwiX3VuYmluZCIsIlRFWFRVUkVfUEFSQU1FVEVSUyIsInN0YW5kYXJkTWF0ZXJpYWxUZXh0dXJlUGFyYW1ldGVycyIsIkNVQkVNQVBfUEFSQU1FVEVSUyIsInN0YW5kYXJkTWF0ZXJpYWxDdWJlbWFwUGFyYW1ldGVycyIsImRlZmluZVVuaWZvcm0iLCJnZXRVbmlmb3JtRnVuYyIsImRlZmluZVByb3BJbnRlcm5hbCIsImNvbnN0cnVjdG9yRnVuYyIsInNldHRlckZ1bmMiLCJnZXR0ZXJGdW5jIiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiLCJkZWZpbmVWYWx1ZVByb3AiLCJwcm9wIiwiaW50ZXJuYWxOYW1lIiwiZGlydHlTaGFkZXJGdW5jIiwib2xkVmFsdWUiLCJkZWZhdWx0VmFsdWUiLCJkZWZpbmVBZ2dQcm9wIiwiZXF1YWxzIiwiY2xvbmUiLCJkZWZpbmVQcm9wIiwiX2RlZmluZVRleDJEIiwiY2hhbm5lbCIsInZlcnRleENvbG9yIiwidXYiLCJsZW5ndGgiLCJuZXdWYWx1ZSIsInR5cGUiLCJmaXhDdWJlbWFwU2VhbXMiLCJmb3JtYXQiLCJWZWMyIiwibWFwVGlsaW5nIiwibWFwT2Zmc2V0IiwibWFwUm90YXRpb24iLCJtYXBUcmFuc2Zvcm0iLCJtYXRlcmlhbCIsInRpbGluZyIsIm9mZnNldCIsInJvdGF0aW9uIiwieCIsInkiLCJGbG9hdDMyQXJyYXkiLCJjciIsIk1hdGgiLCJjb3MiLCJtYXRoIiwiREVHX1RPX1JBRCIsInNyIiwic2luIiwidW5pZm9ybTAiLCJ1bmlmb3JtMSIsIl9kZWZpbmVDb2xvciIsImNvbG9yIiwiZ2FtbWEiLCJ1c2VHYW1tYVRvbmVtYXAiLCJnYW1tYUNvcnJlY3Rpb24iLCJwb3ciLCJyIiwiZyIsImIiLCJfZGVmaW5lRmxvYXQiLCJfZGVmaW5lT2JqZWN0IiwiX2RlZmluZUZsYWciLCJfZGVmaW5lTWF0ZXJpYWxQcm9wcyIsIkNvbG9yIiwiZ2xvc3MiLCJoZWlnaHRNYXBGYWN0b3IiLCJiYm94TWluIiwiY3ViZU1hcFByb2plY3Rpb25Cb3giLCJnZXRNaW4iLCJtaW5Vbmlmb3JtIiwieiIsImJib3hNYXgiLCJnZXRNYXgiLCJtYXhVbmlmb3JtIiwiU1BFQ09DQ19BTyIsIlNQRUNVTEFSX0JMSU5OIiwiRlJFU05FTF9TQ0hMSUNLIiwiQ1VCRVBST0pfTk9ORSIsInVuZGVmaW5lZCIsIkRJVEhFUl9OT05FIiwiREVUQUlMTU9ERV9NVUwiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsImN1YmVtYXBzIiwiY2hhbmdlZCIsImNvbXBsZXRlIiwiaSIsIkVudkxpZ2h0aW5nIiwiZ2VuZXJhdGVQcmVmaWx0ZXJlZEF0bGFzIiwidGFyZ2V0IiwiZW1wdHkiLCJzbGljZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUF3QkE7QUFDQSxNQUFNQSxNQUFNLEdBQUcsRUFBRSxDQUFBOztBQUVqQjtBQUNBLE1BQU1DLFNBQVMsR0FBRyxFQUFFLENBQUE7O0FBRXBCO0FBQ0EsSUFBSUMsT0FBTyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFB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
