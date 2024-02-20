/**
 * Subtract the color of the source fragment from the destination fragment and write the result to
 * the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_SUBTRACTIVE = 0;

/**
 * Add the color of the source fragment to the destination fragment and write the result to the
 * frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_ADDITIVE = 1;

/**
 * Enable simple translucency for materials such as glass. This is equivalent to enabling a source
 * blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination blend mode of
 * {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_NORMAL = 2;

/**
 * Disable blending.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_NONE = 3;

/**
 * Similar to {@link BLEND_NORMAL} expect the source fragment is assumed to have already been
 * multiplied by the source alpha value.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_PREMULTIPLIED = 4;

/**
 * Multiply the color of the source fragment by the color of the destination fragment and write the
 * result to the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MULTIPLICATIVE = 5;

/**
 * Same as {@link BLEND_ADDITIVE} except the source RGB is multiplied by the source alpha.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_ADDITIVEALPHA = 6;

/**
 * Multiplies colors and doubles the result.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MULTIPLICATIVE2X = 7;

/**
 * Softer version of additive.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_SCREEN = 8;

/**
 * Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MIN = 9;

/**
 * Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MAX = 10;

/**
 * No fog is applied to the scene.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_NONE = 'none';

/**
 * Fog rises linearly from zero to 1 between a start and end depth.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_LINEAR = 'linear';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_EXP = 'exp';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_EXP2 = 'exp2';

/**
 * No Fresnel.
 *
 * @type {number}
 * @category Graphics
 */
const FRESNEL_NONE = 0;

/**
 * Schlick's approximation of Fresnel.
 *
 * @type {number}
 * @category Graphics
 */
const FRESNEL_SCHLICK = 2;

// Legacy
const LAYER_HUD = 0;
const LAYER_GIZMO = 1;
const LAYER_FX = 2;
// 3 - 14 are custom user layers
const LAYER_WORLD = 15;

// New layers
/**
 * The world layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_WORLD = 0;

/**
 * The depth layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_DEPTH = 1;

/**
 * The skybox layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_SKYBOX = 2;

/**
 * The immediate layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_IMMEDIATE = 3;

/**
 * The UI layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_UI = 4;

/**
 * Directional (global) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_DIRECTIONAL = 0;

/**
 * Omni-directional (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_OMNI = 1;

/**
 * Point (local) light source.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const LIGHTTYPE_POINT = LIGHTTYPE_OMNI;

/**
 * Spot (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_SPOT = 2;

// private - the number of light types
const LIGHTTYPE_COUNT = 3;

/**
 * Infinitesimally small point light source shape.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_PUNCTUAL = 0;

/**
 * Rectangle shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_RECT = 1;

/**
 * Disk shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_DISK = 2;

/**
 * Sphere shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_SPHERE = 3;

/**
 * Linear distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTFALLOFF_LINEAR = 0;

/**
 * Inverse squared distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF3 = 0;
const SHADOW_DEPTH = 0; // alias for SHADOW_PCF3 for backwards compatibility

/**
 * Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to
 * work correctly.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM8 = 1;

/**
 * Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls
 * back to {@link SHADOW_VSM8}, if not supported.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM16 = 2;

/**
 * Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back
 * to {@link SHADOW_VSM16}, if not supported.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM32 = 3;

/**
 * Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires
 * WebGL 2. Falls back to {@link SHADOW_PCF3} on WebGL 1.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF5 = 4;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 1x1 sampling.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF1 = 5;

/**
 * Render depth as color for PCSS software filtering.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCSS = 6;

/**
 * map of engine SHADOW__*** to a string representation
 *
 * @type {object}
 * @ignore
 * @category Graphics
 */
const shadowTypeToString = {};
shadowTypeToString[SHADOW_PCF3] = 'PCF3';
shadowTypeToString[SHADOW_VSM8] = 'VSM8';
shadowTypeToString[SHADOW_VSM16] = 'VSM16';
shadowTypeToString[SHADOW_VSM32] = 'VSM32';
shadowTypeToString[SHADOW_PCF5] = 'PCF5';
shadowTypeToString[SHADOW_PCF1] = 'PCF1';
shadowTypeToString[SHADOW_PCSS] = 'PCSS';

/**
 * Box filter.
 *
 * @type {number}
 * @category Graphics
 */
const BLUR_BOX = 0;

/**
 * Gaussian filter. May look smoother than box, but requires more samples.
 *
 * @type {number}
 * @category Graphics
 */
const BLUR_GAUSSIAN = 1;

/**
 * No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_NONE = 0;

/**
 * Sorting based on distance to the camera. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_DISTANCE = 1;

/**
 * Newer particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_NEWER_FIRST = 2;

/**
 * Older particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_OLDER_FIRST = 3;
const PARTICLEMODE_GPU = 0;
const PARTICLEMODE_CPU = 1;

/**
 * Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 *
 * @type {number}
 * @category Graphics
 */
const EMITTERSHAPE_BOX = 0;

/**
 * Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the
 * center.
 *
 * @type {number}
 * @category Graphics
 */
const EMITTERSHAPE_SPHERE = 1;

/**
 * Particles are facing camera.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_SCREEN = 0;

/**
 * User defines world space normal (particleNormal) to set planes orientation.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_WORLD = 1;

/**
 * Similar to previous, but the normal is affected by emitter(entity) transformation.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_EMITTER = 2;

/**
 * A perspective camera projection where the frustum shape is essentially pyramidal.
 *
 * @type {number}
 * @category Graphics
 */
const PROJECTION_PERSPECTIVE = 0;

/**
 * An orthographic camera projection where the frustum shape is essentially a cuboid.
 *
 * @type {number}
 * @category Graphics
 */
const PROJECTION_ORTHOGRAPHIC = 1;

/**
 * Render mesh instance as solid geometry.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_SOLID = 0;

/**
 * Render mesh instance as wireframe.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_WIREFRAME = 1;

/**
 * Render mesh instance as points.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_POINTS = 2;

/**
 * The cube map is treated as if it is infinitely far away.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEPROJ_NONE = 0;

/**
 * The cube map is box-projected based on a world space axis-aligned bounding box.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEPROJ_BOX = 1;

/**
 * Phong without energy conservation. You should only use it as a backwards compatibility with
 * older projects.
 *
 * @type {number}
 * @category Graphics
 */
const SPECULAR_PHONG = 0;

/**
 * Energy-conserving Blinn-Phong.
 *
 * @type {number}
 * @category Graphics
 */
const SPECULAR_BLINN = 1;

/**
 * Multiply together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MUL = 'mul';

/**
 * Add together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_ADD = 'add';

/**
 * Softer version of {@link DETAILMODE_ADD}.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_SCREEN = 'screen';

/**
 * Multiplies or screens the colors, depending on the primary color.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_OVERLAY = 'overlay';

/**
 * Select whichever of the primary and secondary colors is darker, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MIN = 'min';

/**
 * Select whichever of the primary and secondary colors is lighter, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MAX = 'max';

/**
 * No gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_NONE = 0;

/**
 * Apply sRGB gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_SRGB = 1;

/**
 * Apply sRGB (fast) gamma correction.
 *
 * @type {number}
 * @deprecated
 * @ignore
 * @category Graphics
 */
const GAMMA_SRGBFAST = 2; // deprecated

/**
 * Apply sRGB (HDR) gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_SRGBHDR = 3;

/**
 * Linear tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_LINEAR = 0;

/**
 * Filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_FILMIC = 1;

/**
 * Hejl filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_HEJL = 2;

/**
 * ACES filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_ACES = 3;

/**
 * ACES v2 filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_ACES2 = 4;

/**
 * No specular occlusion.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_NONE = 0;

/**
 * Use AO directly to occlude specular.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_AO = 1;

/**
 * Modify AO based on material glossiness/view angle to occlude specular.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_GLOSSDEPENDENT = 2;

// 16 bits for shader defs
const SHADERDEF_NOSHADOW = 1;
const SHADERDEF_SKIN = 2;
const SHADERDEF_UV0 = 4;
const SHADERDEF_UV1 = 8;
const SHADERDEF_VCOLOR = 16;
const SHADERDEF_INSTANCING = 32;
const SHADERDEF_LM = 64;
const SHADERDEF_DIRLM = 128;
const SHADERDEF_SCREENSPACE = 256;
const SHADERDEF_TANGENTS = 512;
const SHADERDEF_MORPH_POSITION = 1024;
const SHADERDEF_MORPH_NORMAL = 2048;
const SHADERDEF_MORPH_TEXTURE_BASED = 4096;
const SHADERDEF_LMAMBIENT = 8192; // lightmaps contain ambient

/**
 * The shadow map is not to be updated.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_NONE = 0;

/**
 * The shadow map is regenerated this frame and not on subsequent frames.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_THISFRAME = 1;

/**
 * The shadow map is regenerated every frame.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_REALTIME = 2;
const SORTKEY_FORWARD = 0;
const SORTKEY_DEPTH = 1;

// flags used on the mask property of the Light, and also on mask property of the MeshInstance
const MASK_AFFECT_DYNAMIC = 1;
const MASK_AFFECT_LIGHTMAPPED = 2;
const MASK_BAKE = 4;

/**
 * Render shaded materials with gamma correction and tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_FORWARD = 0;

/**
 * Render shaded materials without gamma correction and tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_FORWARDHDR = 1;

/**
 * Render RGBA-encoded depth value.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_DEPTH = 2;

// shader pass used by the Picker class to render mesh ID
const SHADER_PICK = 3;

// shadow pass used by the shadow rendering code
const SHADER_SHADOW = 4;

/**
 * Shader that performs forward rendering.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_FORWARD = 'forward';

/**
 * Shader used for debug rendering of albedo.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_ALBEDO = 'debug_albedo';

/**
 * Shader used for debug rendering of world normal.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_WORLDNORMAL = 'debug_world_normal';

/**
 * Shader used for debug rendering of opacity.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_OPACITY = 'debug_opacity';

/**
 * Shader used for debug rendering of specularity.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_SPECULARITY = 'debug_specularity';

/**
 * Shader used for debug rendering of gloss.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_GLOSS = 'debug_gloss';

/**
 * Shader used for debug rendering of metalness.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_METALNESS = 'debug_metalness';

/**
 * Shader used for debug rendering of ao.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_AO = 'debug_ao';

/**
 * Shader used for debug rendering of emission.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_EMISSION = 'debug_emission';

/**
 * Shader used for debug rendering of lighting.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_LIGHTING = 'debug_lighting';

/**
 * Shader used for debug rendering of UV0 texture coordinates.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_UV0 = 'debug_uv0';

/**
 * This mode renders a sprite as a simple quad.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the top and
 * bottom regions of the sprite horizontally, the left and right regions vertically and the middle
 * region both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_SLICED = 1;

/**
 * This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the top and bottom
 * regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_TILED = 2;

/**
 * Single color lightmap.
 *
 * @type {number}
 * @category Graphics
 */
const BAKE_COLOR = 0;

/**
 * Single color lightmap + dominant light direction (used for bump/specular).
 *
 * @type {number}
 * @category Graphics
 */
const BAKE_COLORDIR = 1;

/**
 * Center of view.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_CENTER = 0;

/**
 * Left of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_LEFT = 1;

/**
 * Right of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_RIGHT = 2;

/**
 * No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_NONE = 0;

/**
 * Mesh instances are sorted based on {@link MeshInstance#drawOrder}.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_MANUAL = 1;

/**
 * Mesh instances are sorted to minimize switching between materials and meshes to improve
 * rendering performance.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_MATERIALMESH = 2;

/**
 * Mesh instances are sorted back to front. This is the way to properly render many
 * semi-transparent objects on different depth, one is blended on top of another.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_BACK2FRONT = 3;

/**
 * Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give
 * better performance than {@link SORTMODE_MATERIALMESH} due to reduced overdraw.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_FRONT2BACK = 4;

/**
 * Provide custom functions for sorting drawcalls and calculating distance.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const SORTMODE_CUSTOM = 5;

/**
 * Automatically set aspect ratio to current render target's width divided by height.
 *
 * @type {number}
 * @category Graphics
 */
const ASPECT_AUTO = 0;

/**
 * Use the manual aspect ratio value.
 *
 * @type {number}
 * @category Graphics
 */
const ASPECT_MANUAL = 1;

/**
 * Horizontal orientation.
 *
 * @type {number}
 * @category Graphics
 */
const ORIENTATION_HORIZONTAL = 0;

/**
 * Vertical orientation.
 *
 * @type {number}
 * @category Graphics
 */
const ORIENTATION_VERTICAL = 1;

/**
 * A sky texture is rendered using an infinite projection.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_INFINITE = 'infinite';

/**
 * A sky texture is rendered using a box projection. This is generally suitable for interior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_BOX = 'box';

/**
 *  A sky texture is rendered using a dome projection. This is generally suitable for exterior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_DOME = 'dome';

/**
 * Opacity dithering is disabled.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_NONE = 'none';

/**
 * Opacity is dithered using a Bayer 8 matrix.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_BAYER8 = 'bayer8';

/**
 * Opacity is dithered using a blue noise texture.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_BLUENOISE = 'bluenoise';

export { ASPECT_AUTO, ASPECT_MANUAL, BAKE_COLOR, BAKE_COLORDIR, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MAX, BLEND_MIN, BLEND_MULTIPLICATIVE, BLEND_MULTIPLICATIVE2X, BLEND_NONE, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_SCREEN, BLEND_SUBTRACTIVE, BLUR_BOX, BLUR_GAUSSIAN, CUBEPROJ_BOX, CUBEPROJ_NONE, DETAILMODE_ADD, DETAILMODE_MAX, DETAILMODE_MIN, DETAILMODE_MUL, DETAILMODE_OVERLAY, DETAILMODE_SCREEN, DITHER_BAYER8, DITHER_BLUENOISE, DITHER_NONE, EMITTERSHAPE_BOX, EMITTERSHAPE_SPHERE, FOG_EXP, FOG_EXP2, FOG_LINEAR, FOG_NONE, FRESNEL_NONE, FRESNEL_SCHLICK, GAMMA_NONE, GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR, LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD, LAYER_FX, LAYER_GIZMO, LAYER_HUD, LAYER_WORLD, LIGHTFALLOFF_INVERSESQUARED, LIGHTFALLOFF_LINEAR, LIGHTSHAPE_DISK, LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE, LIGHTTYPE_COUNT, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_POINT, LIGHTTYPE_SPOT, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL, PARTICLEMODE_CPU, PARTICLEMODE_GPU, PARTICLEORIENTATION_EMITTER, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLESORT_DISTANCE, PARTICLESORT_NEWER_FIRST, PARTICLESORT_NONE, PARTICLESORT_OLDER_FIRST, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME, SHADERDEF_DIRLM, SHADERDEF_INSTANCING, SHADERDEF_LM, SHADERDEF_LMAMBIENT, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_NOSHADOW, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERPASS_ALBEDO, SHADERPASS_AO, SHADERPASS_EMISSION, SHADERPASS_FORWARD, SHADERPASS_GLOSS, SHADERPASS_LIGHTING, SHADERPASS_METALNESS, SHADERPASS_OPACITY, SHADERPASS_SPECULARITY, SHADERPASS_UV0, SHADERPASS_WORLDNORMAL, SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW, SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, SHADOW_DEPTH, SHADOW_PCF1, SHADOW_PCF3, SHADOW_PCF5, SHADOW_PCSS, SHADOW_VSM16, SHADOW_VSM32, SHADOW_VSM8, SKYTYPE_BOX, SKYTYPE_DOME, SKYTYPE_INFINITE, SORTKEY_DEPTH, SORTKEY_FORWARD, SORTMODE_BACK2FRONT, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTMODE_MANUAL, SORTMODE_MATERIALMESH, SORTMODE_NONE, SPECOCC_AO, SPECOCC_GLOSSDEPENDENT, SPECOCC_NONE, SPECULAR_BLINN, SPECULAR_PHONG, SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR, VIEW_CENTER, VIEW_LEFT, VIEW_RIGHT, shadowTypeToString };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU3VidHJhY3QgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgZnJvbSB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG9cbiAqIHRoZSBmcmFtZSBidWZmZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRfU1VCVFJBQ1RJVkUgPSAwO1xuXG4vKipcbiAqIEFkZCB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCB0byB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlXG4gKiBmcmFtZSBidWZmZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkxFTkRfQURESVRJVkUgPSAxO1xuXG4vKipcbiAqIEVuYWJsZSBzaW1wbGUgdHJhbnNsdWNlbmN5IGZvciBtYXRlcmlhbHMgc3VjaCBhcyBnbGFzcy4gVGhpcyBpcyBlcXVpdmFsZW50IHRvIGVuYWJsaW5nIGEgc291cmNlXG4gKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBfSBhbmQgYSBkZXN0aW5hdGlvbiBibGVuZCBtb2RlIG9mXG4gKiB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEF9LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX05PUk1BTCA9IDI7XG5cbi8qKlxuICogRGlzYWJsZSBibGVuZGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORF9OT05FID0gMztcblxuLyoqXG4gKiBTaW1pbGFyIHRvIHtAbGluayBCTEVORF9OT1JNQUx9IGV4cGVjdCB0aGUgc291cmNlIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gaGF2ZSBhbHJlYWR5IGJlZW5cbiAqIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORF9QUkVNVUxUSVBMSUVEID0gNDtcblxuLyoqXG4gKiBNdWx0aXBseSB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCBieSB0aGUgY29sb3Igb2YgdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZCB3cml0ZSB0aGVcbiAqIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX01VTFRJUExJQ0FUSVZFID0gNTtcblxuLyoqXG4gKiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORF9BRERJVElWRUFMUEhBID0gNjtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGNvbG9ycyBhbmQgZG91YmxlcyB0aGUgcmVzdWx0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX01VTFRJUExJQ0FUSVZFMlggPSA3O1xuXG4vKipcbiAqIFNvZnRlciB2ZXJzaW9uIG9mIGFkZGl0aXZlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX1NDUkVFTiA9IDg7XG5cbi8qKlxuICogTWluaW11bSBjb2xvci4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX01JTiA9IDk7XG5cbi8qKlxuICogTWF4aW11bSBjb2xvci4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX01BWCA9IDEwO1xuXG4vKipcbiAqIE5vIGZvZyBpcyBhcHBsaWVkIHRvIHRoZSBzY2VuZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGT0dfTk9ORSA9ICdub25lJztcblxuLyoqXG4gKiBGb2cgcmlzZXMgbGluZWFybHkgZnJvbSB6ZXJvIHRvIDEgYmV0d2VlbiBhIHN0YXJ0IGFuZCBlbmQgZGVwdGguXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRk9HX0xJTkVBUiA9ICdsaW5lYXInO1xuXG4vKipcbiAqIEZvZyByaXNlcyBhY2NvcmRpbmcgdG8gYW4gZXhwb25lbnRpYWwgY3VydmUgY29udHJvbGxlZCBieSBhIGRlbnNpdHkgdmFsdWUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRk9HX0VYUCA9ICdleHAnO1xuXG4vKipcbiAqIEZvZyByaXNlcyBhY2NvcmRpbmcgdG8gYW4gZXhwb25lbnRpYWwgY3VydmUgY29udHJvbGxlZCBieSBhIGRlbnNpdHkgdmFsdWUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRk9HX0VYUDIgPSAnZXhwMic7XG5cbi8qKlxuICogTm8gRnJlc25lbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBGUkVTTkVMX05PTkUgPSAwO1xuXG4vKipcbiAqIFNjaGxpY2sncyBhcHByb3hpbWF0aW9uIG9mIEZyZXNuZWwuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRlJFU05FTF9TQ0hMSUNLID0gMjtcblxuLy8gTGVnYWN5XG5leHBvcnQgY29uc3QgTEFZRVJfSFVEID0gMDtcbmV4cG9ydCBjb25zdCBMQVlFUl9HSVpNTyA9IDE7XG5leHBvcnQgY29uc3QgTEFZRVJfRlggPSAyO1xuLy8gMyAtIDE0IGFyZSBjdXN0b20gdXNlciBsYXllcnNcbmV4cG9ydCBjb25zdCBMQVlFUl9XT1JMRCA9IDE1O1xuXG4vLyBOZXcgbGF5ZXJzXG4vKipcbiAqIFRoZSB3b3JsZCBsYXllci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX1dPUkxEID0gMDtcblxuLyoqXG4gKiBUaGUgZGVwdGggbGF5ZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgTEFZRVJJRF9ERVBUSCA9IDE7XG5cbi8qKlxuICogVGhlIHNreWJveCBsYXllci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX1NLWUJPWCA9IDI7XG5cbi8qKlxuICogVGhlIGltbWVkaWF0ZSBsYXllci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX0lNTUVESUFURSA9IDM7XG5cbi8qKlxuICogVGhlIFVJIGxheWVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IExBWUVSSURfVUkgPSA0O1xuXG4vKipcbiAqIERpcmVjdGlvbmFsIChnbG9iYWwpIGxpZ2h0IHNvdXJjZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPSAwO1xuXG4vKipcbiAqIE9tbmktZGlyZWN0aW9uYWwgKGxvY2FsKSBsaWdodCBzb3VyY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgTElHSFRUWVBFX09NTkkgPSAxO1xuXG4vKipcbiAqIFBvaW50IChsb2NhbCkgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAaWdub3JlXG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hUVFlQRV9QT0lOVCA9IExJR0hUVFlQRV9PTU5JO1xuXG4vKipcbiAqIFNwb3QgKGxvY2FsKSBsaWdodCBzb3VyY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgTElHSFRUWVBFX1NQT1QgPSAyO1xuXG4vLyBwcml2YXRlIC0gdGhlIG51bWJlciBvZiBsaWdodCB0eXBlc1xuZXhwb3J0IGNvbnN0IExJR0hUVFlQRV9DT1VOVCA9IDM7XG5cbi8qKlxuICogSW5maW5pdGVzaW1hbGx5IHNtYWxsIHBvaW50IGxpZ2h0IHNvdXJjZSBzaGFwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFNIQVBFX1BVTkNUVUFMID0gMDtcblxuLyoqXG4gKiBSZWN0YW5nbGUgc2hhcGUgb2YgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hUU0hBUEVfUkVDVCA9IDE7XG5cbi8qKlxuICogRGlzayBzaGFwZSBvZiBsaWdodCBzb3VyY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgTElHSFRTSEFQRV9ESVNLID0gMjtcblxuLyoqXG4gKiBTcGhlcmUgc2hhcGUgb2YgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hUU0hBUEVfU1BIRVJFID0gMztcblxuLyoqXG4gKiBMaW5lYXIgZGlzdGFuY2UgZmFsbG9mZiBtb2RlbCBmb3IgbGlnaHQgYXR0ZW51YXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgTElHSFRGQUxMT0ZGX0xJTkVBUiA9IDA7XG5cbi8qKlxuICogSW52ZXJzZSBzcXVhcmVkIGRpc3RhbmNlIGZhbGxvZmYgbW9kZWwgZm9yIGxpZ2h0IGF0dGVudWF0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRCA9IDE7XG5cbi8qKlxuICogUmVuZGVyIGRlcHRoIChjb2xvci1wYWNrZWQgb24gV2ViR0wgMS4wKSwgY2FuIGJlIHVzZWQgZm9yIFBDRiAzeDMgc2FtcGxpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1BDRjMgPSAwO1xuZXhwb3J0IGNvbnN0IFNIQURPV19ERVBUSCA9IDA7IC8vIGFsaWFzIGZvciBTSEFET1dfUENGMyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcblxuLyoqXG4gKiBSZW5kZXIgcGFja2VkIHZhcmlhbmNlIHNoYWRvdyBtYXAuIEFsbCBzaGFkb3cgcmVjZWl2ZXJzIG11c3QgYWxzbyBjYXN0IHNoYWRvd3MgZm9yIHRoaXMgbW9kZSB0b1xuICogd29yayBjb3JyZWN0bHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1ZTTTggPSAxO1xuXG4vKipcbiAqIFJlbmRlciAxNi1iaXQgZXhwb25lbnRpYWwgdmFyaWFuY2Ugc2hhZG93IG1hcC4gUmVxdWlyZXMgT0VTX3RleHR1cmVfaGFsZl9mbG9hdCBleHRlbnNpb24uIEZhbGxzXG4gKiBiYWNrIHRvIHtAbGluayBTSEFET1dfVlNNOH0sIGlmIG5vdCBzdXBwb3J0ZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1ZTTTE2ID0gMjtcblxuLyoqXG4gKiBSZW5kZXIgMzItYml0IGV4cG9uZW50aWFsIHZhcmlhbmNlIHNoYWRvdyBtYXAuIFJlcXVpcmVzIE9FU190ZXh0dXJlX2Zsb2F0IGV4dGVuc2lvbi4gRmFsbHMgYmFja1xuICogdG8ge0BsaW5rIFNIQURPV19WU00xNn0sIGlmIG5vdCBzdXBwb3J0ZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1ZTTTMyID0gMztcblxuLyoqXG4gKiBSZW5kZXIgZGVwdGggYnVmZmVyIG9ubHksIGNhbiBiZSB1c2VkIGZvciBoYXJkd2FyZS1hY2NlbGVyYXRlZCBQQ0YgNXg1IHNhbXBsaW5nLiBSZXF1aXJlc1xuICogV2ViR0wgMi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1BDRjUgPSA0O1xuXG4vKipcbiAqIFJlbmRlciBkZXB0aCAoY29sb3ItcGFja2VkIG9uIFdlYkdMIDEuMCksIGNhbiBiZSB1c2VkIGZvciBQQ0YgMXgxIHNhbXBsaW5nLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURPV19QQ0YxID0gNTtcblxuLyoqXG4gKiBSZW5kZXIgZGVwdGggYXMgY29sb3IgZm9yIFBDU1Mgc29mdHdhcmUgZmlsdGVyaW5nLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURPV19QQ1NTID0gNjtcblxuLyoqXG4gKiBtYXAgb2YgZW5naW5lIFNIQURPV19fKioqIHRvIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uXG4gKlxuICogQHR5cGUge29iamVjdH1cbiAqIEBpZ25vcmVcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3Qgc2hhZG93VHlwZVRvU3RyaW5nID0ge307XG5zaGFkb3dUeXBlVG9TdHJpbmdbU0hBRE9XX1BDRjNdID0gJ1BDRjMnO1xuc2hhZG93VHlwZVRvU3RyaW5nW1NIQURPV19WU004XSA9ICdWU004JztcbnNoYWRvd1R5cGVUb1N0cmluZ1tTSEFET1dfVlNNMTZdID0gJ1ZTTTE2JztcbnNoYWRvd1R5cGVUb1N0cmluZ1tTSEFET1dfVlNNMzJdID0gJ1ZTTTMyJztcbnNoYWRvd1R5cGVUb1N0cmluZ1tTSEFET1dfUENGNV0gPSAnUENGNSc7XG5zaGFkb3dUeXBlVG9TdHJpbmdbU0hBRE9XX1BDRjFdID0gJ1BDRjEnO1xuc2hhZG93VHlwZVRvU3RyaW5nW1NIQURPV19QQ1NTXSA9ICdQQ1NTJztcblxuLyoqXG4gKiBCb3ggZmlsdGVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMVVJfQk9YID0gMDtcblxuLyoqXG4gKiBHYXVzc2lhbiBmaWx0ZXIuIE1heSBsb29rIHNtb290aGVyIHRoYW4gYm94LCBidXQgcmVxdWlyZXMgbW9yZSBzYW1wbGVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEJMVVJfR0FVU1NJQU4gPSAxO1xuXG4vKipcbiAqIE5vIHNvcnRpbmcsIHBhcnRpY2xlcyBhcmUgZHJhd24gaW4gYXJiaXRyYXJ5IG9yZGVyLiBDYW4gYmUgc2ltdWxhdGVkIG9uIEdQVS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQQVJUSUNMRVNPUlRfTk9ORSA9IDA7XG5cbi8qKlxuICogU29ydGluZyBiYXNlZCBvbiBkaXN0YW5jZSB0byB0aGUgY2FtZXJhLiBDUFUgb25seS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQQVJUSUNMRVNPUlRfRElTVEFOQ0UgPSAxO1xuXG4vKipcbiAqIE5ld2VyIHBhcnRpY2xlcyBhcmUgZHJhd24gZmlyc3QuIENQVSBvbmx5LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFU09SVF9ORVdFUl9GSVJTVCA9IDI7XG5cbi8qKlxuICogT2xkZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUEFSVElDTEVTT1JUX09MREVSX0ZJUlNUID0gMztcblxuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFTU9ERV9HUFUgPSAwO1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFTU9ERV9DUFUgPSAxO1xuXG4vKipcbiAqIEJveCBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJFeHRlbnRzLiBJbml0aWFsIHZlbG9jaXR5IGlzIGRpcmVjdGVkIHRvd2FyZHMgbG9jYWwgWiBheGlzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEVNSVRURVJTSEFQRV9CT1ggPSAwO1xuXG4vKipcbiAqIFNwaGVyZSBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJSYWRpdXMuIEluaXRpYWwgdmVsb2NpdHkgaXMgZGlyZWN0ZWQgb3V0d2FyZHMgZnJvbSB0aGVcbiAqIGNlbnRlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBFTUlUVEVSU0hBUEVfU1BIRVJFID0gMTtcblxuLyoqXG4gKiBQYXJ0aWNsZXMgYXJlIGZhY2luZyBjYW1lcmEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4gPSAwO1xuXG4vKipcbiAqIFVzZXIgZGVmaW5lcyB3b3JsZCBzcGFjZSBub3JtYWwgKHBhcnRpY2xlTm9ybWFsKSB0byBzZXQgcGxhbmVzIG9yaWVudGF0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQgPSAxO1xuXG4vKipcbiAqIFNpbWlsYXIgdG8gcHJldmlvdXMsIGJ1dCB0aGUgbm9ybWFsIGlzIGFmZmVjdGVkIGJ5IGVtaXR0ZXIoZW50aXR5KSB0cmFuc2Zvcm1hdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIgPSAyO1xuXG4vKipcbiAqIEEgcGVyc3BlY3RpdmUgY2FtZXJhIHByb2plY3Rpb24gd2hlcmUgdGhlIGZydXN0dW0gc2hhcGUgaXMgZXNzZW50aWFsbHkgcHlyYW1pZGFsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUgPSAwO1xuXG4vKipcbiAqIEFuIG9ydGhvZ3JhcGhpYyBjYW1lcmEgcHJvamVjdGlvbiB3aGVyZSB0aGUgZnJ1c3R1bSBzaGFwZSBpcyBlc3NlbnRpYWxseSBhIGN1Ym9pZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA9IDE7XG5cbi8qKlxuICogUmVuZGVyIG1lc2ggaW5zdGFuY2UgYXMgc29saWQgZ2VvbWV0cnkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgUkVOREVSU1RZTEVfU09MSUQgPSAwO1xuXG4vKipcbiAqIFJlbmRlciBtZXNoIGluc3RhbmNlIGFzIHdpcmVmcmFtZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJTVFlMRV9XSVJFRlJBTUUgPSAxO1xuXG4vKipcbiAqIFJlbmRlciBtZXNoIGluc3RhbmNlIGFzIHBvaW50cy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJTVFlMRV9QT0lOVFMgPSAyO1xuXG4vKipcbiAqIFRoZSBjdWJlIG1hcCBpcyB0cmVhdGVkIGFzIGlmIGl0IGlzIGluZmluaXRlbHkgZmFyIGF3YXkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQ1VCRVBST0pfTk9ORSA9IDA7XG5cbi8qKlxuICogVGhlIGN1YmUgbWFwIGlzIGJveC1wcm9qZWN0ZWQgYmFzZWQgb24gYSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IENVQkVQUk9KX0JPWCA9IDE7XG5cbi8qKlxuICogUGhvbmcgd2l0aG91dCBlbmVyZ3kgY29uc2VydmF0aW9uLiBZb3Ugc2hvdWxkIG9ubHkgdXNlIGl0IGFzIGEgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aFxuICogb2xkZXIgcHJvamVjdHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU1BFQ1VMQVJfUEhPTkcgPSAwO1xuXG4vKipcbiAqIEVuZXJneS1jb25zZXJ2aW5nIEJsaW5uLVBob25nLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNQRUNVTEFSX0JMSU5OID0gMTtcblxuLyoqXG4gKiBNdWx0aXBseSB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBERVRBSUxNT0RFX01VTCA9ICdtdWwnO1xuXG4vKipcbiAqIEFkZCB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBERVRBSUxNT0RFX0FERCA9ICdhZGQnO1xuXG4vKipcbiAqIFNvZnRlciB2ZXJzaW9uIG9mIHtAbGluayBERVRBSUxNT0RFX0FERH0uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgREVUQUlMTU9ERV9TQ1JFRU4gPSAnc2NyZWVuJztcblxuLyoqXG4gKiBNdWx0aXBsaWVzIG9yIHNjcmVlbnMgdGhlIGNvbG9ycywgZGVwZW5kaW5nIG9uIHRoZSBwcmltYXJ5IGNvbG9yLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IERFVEFJTE1PREVfT1ZFUkxBWSA9ICdvdmVybGF5JztcblxuLyoqXG4gKiBTZWxlY3Qgd2hpY2hldmVyIG9mIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzIGlzIGRhcmtlciwgY29tcG9uZW50LXdpc2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgREVUQUlMTU9ERV9NSU4gPSAnbWluJztcblxuLyoqXG4gKiBTZWxlY3Qgd2hpY2hldmVyIG9mIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzIGlzIGxpZ2h0ZXIsIGNvbXBvbmVudC13aXNlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IERFVEFJTE1PREVfTUFYID0gJ21heCc7XG5cbi8qKlxuICogTm8gZ2FtbWEgY29ycmVjdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBHQU1NQV9OT05FID0gMDtcblxuLyoqXG4gKiBBcHBseSBzUkdCIGdhbW1hIGNvcnJlY3Rpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgR0FNTUFfU1JHQiA9IDE7XG5cbi8qKlxuICogQXBwbHkgc1JHQiAoZmFzdCkgZ2FtbWEgY29ycmVjdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGRlcHJlY2F0ZWRcbiAqIEBpZ25vcmVcbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgR0FNTUFfU1JHQkZBU1QgPSAyOyAvLyBkZXByZWNhdGVkXG5cbi8qKlxuICogQXBwbHkgc1JHQiAoSERSKSBnYW1tYSBjb3JyZWN0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEdBTU1BX1NSR0JIRFIgPSAzO1xuXG4vKipcbiAqIExpbmVhciB0b25lbWFwcGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUT05FTUFQX0xJTkVBUiA9IDA7XG5cbi8qKlxuICogRmlsbWljIHRvbmVtYXBwaW5nIGN1cnZlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRPTkVNQVBfRklMTUlDID0gMTtcblxuLyoqXG4gKiBIZWpsIGZpbG1pYyB0b25lbWFwcGluZyBjdXJ2ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBUT05FTUFQX0hFSkwgPSAyO1xuXG4vKipcbiAqIEFDRVMgZmlsbWljIHRvbmVtYXBwaW5nIGN1cnZlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFRPTkVNQVBfQUNFUyA9IDM7XG5cbi8qKlxuICogQUNFUyB2MiBmaWxtaWMgdG9uZW1hcHBpbmcgY3VydmUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgVE9ORU1BUF9BQ0VTMiA9IDQ7XG5cbi8qKlxuICogTm8gc3BlY3VsYXIgb2NjbHVzaW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNQRUNPQ0NfTk9ORSA9IDA7XG5cbi8qKlxuICogVXNlIEFPIGRpcmVjdGx5IHRvIG9jY2x1ZGUgc3BlY3VsYXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU1BFQ09DQ19BTyA9IDE7XG5cbi8qKlxuICogTW9kaWZ5IEFPIGJhc2VkIG9uIG1hdGVyaWFsIGdsb3NzaW5lc3MvdmlldyBhbmdsZSB0byBvY2NsdWRlIHNwZWN1bGFyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQgPSAyO1xuXG4vLyAxNiBiaXRzIGZvciBzaGFkZXIgZGVmc1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9OT1NIQURPVyA9IDE7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX1NLSU4gPSAyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9VVjAgPSA0O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9VVjEgPSA4O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9WQ09MT1IgPSAxNjtcbmV4cG9ydCBjb25zdCBTSEFERVJERUZfSU5TVEFOQ0lORyA9IDMyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9MTSA9IDY0O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9ESVJMTSA9IDEyODtcbmV4cG9ydCBjb25zdCBTSEFERVJERUZfU0NSRUVOU1BBQ0UgPSAyNTY7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX1RBTkdFTlRTID0gNTEyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTiA9IDEwMjQ7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX01PUlBIX05PUk1BTCA9IDIwNDg7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQgPSA0MDk2O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9MTUFNQklFTlQgPSA4MTkyOyAvLyBsaWdodG1hcHMgY29udGFpbiBhbWJpZW50XG5cbi8qKlxuICogVGhlIHNoYWRvdyBtYXAgaXMgbm90IHRvIGJlIHVwZGF0ZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBRE9XVVBEQVRFX05PTkUgPSAwO1xuXG4vKipcbiAqIFRoZSBzaGFkb3cgbWFwIGlzIHJlZ2VuZXJhdGVkIHRoaXMgZnJhbWUgYW5kIG5vdCBvbiBzdWJzZXF1ZW50IGZyYW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FID0gMTtcblxuLyoqXG4gKiBUaGUgc2hhZG93IG1hcCBpcyByZWdlbmVyYXRlZCBldmVyeSBmcmFtZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTSEFET1dVUERBVEVfUkVBTFRJTUUgPSAyO1xuXG5leHBvcnQgY29uc3QgU09SVEtFWV9GT1JXQVJEID0gMDtcbmV4cG9ydCBjb25zdCBTT1JUS0VZX0RFUFRIID0gMTtcblxuLy8gZmxhZ3MgdXNlZCBvbiB0aGUgbWFzayBwcm9wZXJ0eSBvZiB0aGUgTGlnaHQsIGFuZCBhbHNvIG9uIG1hc2sgcHJvcGVydHkgb2YgdGhlIE1lc2hJbnN0YW5jZVxuZXhwb3J0IGNvbnN0IE1BU0tfQUZGRUNUX0RZTkFNSUMgPSAxO1xuZXhwb3J0IGNvbnN0IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEID0gMjtcbmV4cG9ydCBjb25zdCBNQVNLX0JBS0UgPSA0O1xuXG4vKipcbiAqIFJlbmRlciBzaGFkZWQgbWF0ZXJpYWxzIHdpdGggZ2FtbWEgY29ycmVjdGlvbiBhbmQgdG9uZW1hcHBpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSX0ZPUldBUkQgPSAwO1xuXG4vKipcbiAqIFJlbmRlciBzaGFkZWQgbWF0ZXJpYWxzIHdpdGhvdXQgZ2FtbWEgY29ycmVjdGlvbiBhbmQgdG9uZW1hcHBpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSX0ZPUldBUkRIRFIgPSAxO1xuXG4vKipcbiAqIFJlbmRlciBSR0JBLWVuY29kZWQgZGVwdGggdmFsdWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSX0RFUFRIID0gMjtcblxuLy8gc2hhZGVyIHBhc3MgdXNlZCBieSB0aGUgUGlja2VyIGNsYXNzIHRvIHJlbmRlciBtZXNoIElEXG5leHBvcnQgY29uc3QgU0hBREVSX1BJQ0sgPSAzO1xuXG4vLyBzaGFkb3cgcGFzcyB1c2VkIGJ5IHRoZSBzaGFkb3cgcmVuZGVyaW5nIGNvZGVcbmV4cG9ydCBjb25zdCBTSEFERVJfU0hBRE9XID0gNDtcblxuLyoqXG4gKiBTaGFkZXIgdGhhdCBwZXJmb3JtcyBmb3J3YXJkIHJlbmRlcmluZy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJQQVNTX0ZPUldBUkQgPSAnZm9yd2FyZCc7XG5cbi8qKlxuICogU2hhZGVyIHVzZWQgZm9yIGRlYnVnIHJlbmRlcmluZyBvZiBhbGJlZG8uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19BTEJFRE8gPSAnZGVidWdfYWxiZWRvJztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIHdvcmxkIG5vcm1hbC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJQQVNTX1dPUkxETk9STUFMID0gJ2RlYnVnX3dvcmxkX25vcm1hbCc7XG5cbi8qKlxuICogU2hhZGVyIHVzZWQgZm9yIGRlYnVnIHJlbmRlcmluZyBvZiBvcGFjaXR5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfT1BBQ0lUWSA9ICdkZWJ1Z19vcGFjaXR5JztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIHNwZWN1bGFyaXR5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfU1BFQ1VMQVJJVFkgPSAnZGVidWdfc3BlY3VsYXJpdHknO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgZ2xvc3MuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19HTE9TUyA9ICdkZWJ1Z19nbG9zcyc7XG5cbi8qKlxuICogU2hhZGVyIHVzZWQgZm9yIGRlYnVnIHJlbmRlcmluZyBvZiBtZXRhbG5lc3MuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19NRVRBTE5FU1MgPSAnZGVidWdfbWV0YWxuZXNzJztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIGFvLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfQU8gPSAnZGVidWdfYW8nO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgZW1pc3Npb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19FTUlTU0lPTiA9ICdkZWJ1Z19lbWlzc2lvbic7XG5cbi8qKlxuICogU2hhZGVyIHVzZWQgZm9yIGRlYnVnIHJlbmRlcmluZyBvZiBsaWdodGluZy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJQQVNTX0xJR0hUSU5HID0gJ2RlYnVnX2xpZ2h0aW5nJztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIFVWMCB0ZXh0dXJlIGNvb3JkaW5hdGVzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfVVYwID0gJ2RlYnVnX3V2MCc7XG5cbi8qKlxuICogVGhpcyBtb2RlIHJlbmRlcnMgYSBzcHJpdGUgYXMgYSBzaW1wbGUgcXVhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUgPSAwO1xuXG4vKipcbiAqIFRoaXMgbW9kZSByZW5kZXJzIGEgc3ByaXRlIHVzaW5nIDktc2xpY2luZyBpbiAnc2xpY2VkJyBtb2RlLiBTbGljZWQgbW9kZSBzdHJldGNoZXMgdGhlIHRvcCBhbmRcbiAqIGJvdHRvbSByZWdpb25zIG9mIHRoZSBzcHJpdGUgaG9yaXpvbnRhbGx5LCB0aGUgbGVmdCBhbmQgcmlnaHQgcmVnaW9ucyB2ZXJ0aWNhbGx5IGFuZCB0aGUgbWlkZGxlXG4gKiByZWdpb24gYm90aCBob3Jpem9udGFsbHkgYW5kIHZlcnRpY2FsbHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEID0gMTtcblxuLyoqXG4gKiBUaGlzIG1vZGUgcmVuZGVycyBhIHNwcml0ZSB1c2luZyA5LXNsaWNpbmcgaW4gJ3RpbGVkJyBtb2RlLiBUaWxlZCBtb2RlIHRpbGVzIHRoZSB0b3AgYW5kIGJvdHRvbVxuICogcmVnaW9ucyBvZiB0aGUgc3ByaXRlIGhvcml6b250YWxseSwgdGhlIGxlZnQgYW5kIHJpZ2h0IHJlZ2lvbnMgdmVydGljYWxseSBhbmQgdGhlIG1pZGRsZSByZWdpb25cbiAqIGJvdGggaG9yaXpvbnRhbGx5IGFuZCB2ZXJ0aWNhbGx5LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEID0gMjtcblxuLyoqXG4gKiBTaW5nbGUgY29sb3IgbGlnaHRtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgQkFLRV9DT0xPUiA9IDA7XG5cbi8qKlxuICogU2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvciBidW1wL3NwZWN1bGFyKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBCQUtFX0NPTE9SRElSID0gMTtcblxuLyoqXG4gKiBDZW50ZXIgb2Ygdmlldy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBWSUVXX0NFTlRFUiA9IDA7XG5cbi8qKlxuICogTGVmdCBvZiB2aWV3LiBPbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBWSUVXX0xFRlQgPSAxO1xuXG4vKipcbiAqIFJpZ2h0IG9mIHZpZXcuIE9ubHkgdXNlZCBpbiBzdGVyZW8gcmVuZGVyaW5nLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFZJRVdfUklHSFQgPSAyO1xuXG4vKipcbiAqIE5vIHNvcnRpbmcgaXMgYXBwbGllZC4gTWVzaCBpbnN0YW5jZXMgYXJlIHJlbmRlcmVkIGluIHRoZSBzYW1lIG9yZGVyIHRoZXkgd2VyZSBhZGRlZCB0byBhIGxheWVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNPUlRNT0RFX05PTkUgPSAwO1xuXG4vKipcbiAqIE1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgYmFzZWQgb24ge0BsaW5rIE1lc2hJbnN0YW5jZSNkcmF3T3JkZXJ9LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNPUlRNT0RFX01BTlVBTCA9IDE7XG5cbi8qKlxuICogTWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCB0byBtaW5pbWl6ZSBzd2l0Y2hpbmcgYmV0d2VlbiBtYXRlcmlhbHMgYW5kIG1lc2hlcyB0byBpbXByb3ZlXG4gKiByZW5kZXJpbmcgcGVyZm9ybWFuY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU09SVE1PREVfTUFURVJJQUxNRVNIID0gMjtcblxuLyoqXG4gKiBNZXNoIGluc3RhbmNlcyBhcmUgc29ydGVkIGJhY2sgdG8gZnJvbnQuIFRoaXMgaXMgdGhlIHdheSB0byBwcm9wZXJseSByZW5kZXIgbWFueVxuICogc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIG9uIGRpZmZlcmVudCBkZXB0aCwgb25lIGlzIGJsZW5kZWQgb24gdG9wIG9mIGFub3RoZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgU09SVE1PREVfQkFDSzJGUk9OVCA9IDM7XG5cbi8qKlxuICogTWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCBmcm9udCB0byBiYWNrLiBEZXBlbmRpbmcgb24gR1BVIGFuZCB0aGUgc2NlbmUsIHRoaXMgb3B0aW9uIG1heSBnaXZlXG4gKiBiZXR0ZXIgcGVyZm9ybWFuY2UgdGhhbiB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfSBkdWUgdG8gcmVkdWNlZCBvdmVyZHJhdy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTT1JUTU9ERV9GUk9OVDJCQUNLID0gNDtcblxuLyoqXG4gKiBQcm92aWRlIGN1c3RvbSBmdW5jdGlvbnMgZm9yIHNvcnRpbmcgZHJhd2NhbGxzIGFuZCBjYWxjdWxhdGluZyBkaXN0YW5jZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGlnbm9yZVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTT1JUTU9ERV9DVVNUT00gPSA1O1xuXG4vKipcbiAqIEF1dG9tYXRpY2FsbHkgc2V0IGFzcGVjdCByYXRpbyB0byBjdXJyZW50IHJlbmRlciB0YXJnZXQncyB3aWR0aCBkaXZpZGVkIGJ5IGhlaWdodC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBBU1BFQ1RfQVVUTyA9IDA7XG5cbi8qKlxuICogVXNlIHRoZSBtYW51YWwgYXNwZWN0IHJhdGlvIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IEFTUEVDVF9NQU5VQUwgPSAxO1xuXG4vKipcbiAqIEhvcml6b250YWwgb3JpZW50YXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCA9IDA7XG5cbi8qKlxuICogVmVydGljYWwgb3JpZW50YXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgT1JJRU5UQVRJT05fVkVSVElDQUwgPSAxO1xuXG4vKipcbiAqIEEgc2t5IHRleHR1cmUgaXMgcmVuZGVyZWQgdXNpbmcgYW4gaW5maW5pdGUgcHJvamVjdGlvbi5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBTS1lUWVBFX0lORklOSVRFID0gJ2luZmluaXRlJztcblxuLyoqXG4gKiBBIHNreSB0ZXh0dXJlIGlzIHJlbmRlcmVkIHVzaW5nIGEgYm94IHByb2plY3Rpb24uIFRoaXMgaXMgZ2VuZXJhbGx5IHN1aXRhYmxlIGZvciBpbnRlcmlvclxuICogZW52aXJvbm1lbnRzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNLWVRZUEVfQk9YID0gJ2JveCc7XG5cbi8qKlxuICogIEEgc2t5IHRleHR1cmUgaXMgcmVuZGVyZWQgdXNpbmcgYSBkb21lIHByb2plY3Rpb24uIFRoaXMgaXMgZ2VuZXJhbGx5IHN1aXRhYmxlIGZvciBleHRlcmlvclxuICogZW52aXJvbm1lbnRzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgR3JhcGhpY3NcbiAqL1xuZXhwb3J0IGNvbnN0IFNLWVRZUEVfRE9NRSA9ICdkb21lJztcblxuLyoqXG4gKiBPcGFjaXR5IGRpdGhlcmluZyBpcyBkaXNhYmxlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEdyYXBoaWNzXG4gKi9cbmV4cG9ydCBjb25zdCBESVRIRVJfTk9ORSA9ICdub25lJztcblxuLyoqXG4gKiBPcGFjaXR5IGlzIGRpdGhlcmVkIHVzaW5nIGEgQmF5ZXIgOCBtYXRyaXguXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRElUSEVSX0JBWUVSOCA9ICdiYXllcjgnO1xuXG4vKipcbiAqIE9wYWNpdHkgaXMgZGl0aGVyZWQgdXNpbmcgYSBibHVlIG5vaXNlIHRleHR1cmUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBHcmFwaGljc1xuICovXG5leHBvcnQgY29uc3QgRElUSEVSX0JMVUVOT0lTRSA9ICdibHVlbm9pc2UnO1xuIl0sIm5hbWVzIjpbIkJMRU5EX1NVQlRSQUNUSVZFIiwiQkxFTkRfQURESVRJVkUiLCJCTEVORF9OT1JNQUwiLCJCTEVORF9OT05FIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsIkJMRU5EX01VTFRJUExJQ0FUSVZFIiwiQkxFTkRfQURESVRJVkVBTFBIQSIsIkJMRU5EX01VTFRJUExJQ0FUSVZFMlgiLCJCTEVORF9TQ1JFRU4iLCJCTEVORF9NSU4iLCJCTEVORF9NQVgiLCJGT0dfTk9ORSIsIkZPR19MSU5FQVIiLCJGT0dfRVhQIiwiRk9HX0VYUDIiLCJGUkVTTkVMX05PTkUiLCJGUkVTTkVMX1NDSExJQ0siLCJMQVlFUl9IVUQiLCJMQVlFUl9HSVpNTyIsIkxBWUVSX0ZYIiwiTEFZRVJfV09STEQiLCJMQVlFUklEX1dPUkxEIiwiTEFZRVJJRF9ERVBUSCIsIkxBWUVSSURfU0tZQk9YIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJMQVlFUklEX1VJIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiTElHSFRUWVBFX09NTkkiLCJMSUdIVFRZUEVfUE9JTlQiLCJMSUdIVFRZUEVfU1BPVCIsIkxJR0hUVFlQRV9DT1VOVCIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJMSUdIVFNIQVBFX1JFQ1QiLCJMSUdIVFNIQVBFX0RJU0siLCJMSUdIVFNIQVBFX1NQSEVSRSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQiLCJTSEFET1dfUENGMyIsIlNIQURPV19ERVBUSCIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTE2IiwiU0hBRE9XX1ZTTTMyIiwiU0hBRE9XX1BDRjUiLCJTSEFET1dfUENGMSIsIlNIQURPV19QQ1NTIiwic2hhZG93VHlwZVRvU3RyaW5nIiwiQkxVUl9CT1giLCJCTFVSX0dBVVNTSUFOIiwiUEFSVElDTEVTT1JUX05PTkUiLCJQQVJUSUNMRVNPUlRfRElTVEFOQ0UiLCJQQVJUSUNMRVNPUlRfTkVXRVJfRklSU1QiLCJQQVJUSUNMRVNPUlRfT0xERVJfRklSU1QiLCJQQVJUSUNMRU1PREVfR1BVIiwiUEFSVElDTEVNT0RFX0NQVSIsIkVNSVRURVJTSEFQRV9CT1giLCJFTUlUVEVSU0hBUEVfU1BIRVJFIiwiUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4iLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEIiwiUEFSVElDTEVPUklFTlRBVElPTl9FTUlUVEVSIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUkVOREVSU1RZTEVfU09MSUQiLCJSRU5ERVJTVFlMRV9XSVJFRlJBTUUiLCJSRU5ERVJTVFlMRV9QT0lOVFMiLCJDVUJFUFJPSl9OT05FIiwiQ1VCRVBST0pfQk9YIiwiU1BFQ1VMQVJfUEhPTkciLCJTUEVDVUxBUl9CTElOTiIsIkRFVEFJTE1PREVfTVVMIiwiREVUQUlMTU9ERV9BREQiLCJERVRBSUxNT0RFX1NDUkVFTiIsIkRFVEFJTE1PREVfT1ZFUkxBWSIsIkRFVEFJTE1PREVfTUlOIiwiREVUQUlMTU9ERV9NQVgiLCJHQU1NQV9OT05FIiwiR0FNTUFfU1JHQiIsIkdBTU1BX1NSR0JGQVNUIiwiR0FNTUFfU1JHQkhEUiIsIlRPTkVNQVBfTElORUFSIiwiVE9ORU1BUF9GSUxNSUMiLCJUT05FTUFQX0hFSkwiLCJUT05FTUFQX0FDRVMiLCJUT05FTUFQX0FDRVMyIiwiU1BFQ09DQ19OT05FIiwiU1BFQ09DQ19BTyIsIlNQRUNPQ0NfR0xPU1NERVBFTkRFTlQiLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJERUZfU0tJTiIsIlNIQURFUkRFRl9VVjAiLCJTSEFERVJERUZfVVYxIiwiU0hBREVSREVGX1ZDT0xPUiIsIlNIQURFUkRFRl9JTlNUQU5DSU5HIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiU0hBREVSREVGX1NDUkVFTlNQQUNFIiwiU0hBREVSREVGX1RBTkdFTlRTIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwiU0hBREVSREVGX01PUlBIX05PUk1BTCIsIlNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEIiwiU0hBREVSREVGX0xNQU1CSUVOVCIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsIlNIQURPV1VQREFURV9SRUFMVElNRSIsIlNPUlRLRVlfRk9SV0FSRCIsIlNPUlRLRVlfREVQVEgiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJNQVNLX0JBS0UiLCJTSEFERVJfRk9SV0FSRCIsIlNIQURFUl9GT1JXQVJESERSIiwiU0hBREVSX0RFUFRIIiwiU0hBREVSX1BJQ0siLCJTSEFERVJfU0hBRE9XIiwiU0hBREVSUEFTU19GT1JXQVJEIiwiU0hBREVSUEFTU19BTEJFRE8iLCJTSEFERVJQQVNTX1dPUkxETk9STUFMIiwiU0hBREVSUEFTU19PUEFDSVRZIiwiU0hBREVSUEFTU19TUEVDVUxBUklUWSIsIlNIQURFUlBBU1NfR0xPU1MiLCJTSEFERVJQQVNTX01FVEFMTkVTUyIsIlNIQURFUlBBU1NfQU8iLCJTSEFERVJQQVNTX0VNSVNTSU9OIiwiU0hBREVSUEFTU19MSUdIVElORyIsIlNIQURFUlBBU1NfVVYwIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJCQUtFX0NPTE9SIiwiQkFLRV9DT0xPUkRJUiIsIlZJRVdfQ0VOVEVSIiwiVklFV19MRUZUIiwiVklFV19SSUdIVCIsIlNPUlRNT0RFX05PTkUiLCJTT1JUTU9ERV9NQU5VQUwiLCJTT1JUTU9ERV9NQVRFUklBTE1FU0giLCJTT1JUTU9ERV9CQUNLMkZST05UIiwiU09SVE1PREVfRlJPTlQyQkFDSyIsIlNPUlRNT0RFX0NVU1RPTSIsIkFTUEVDVF9BVVRPIiwiQVNQRUNUX01BTlVBTCIsIk9SSUVOVEFUSU9OX0hPUklaT05UQUwiLCJPUklFTlRBVElPTl9WRVJUSUNBTCIsIlNLWVRZUEVfSU5GSU5JVEUiLCJTS1lUWVBFX0JPWCIsIlNLWVRZUEVfRE9NRSIsIkRJVEhFUl9OT05FIiwiRElUSEVSX0JBWUVSOCIsIkRJVEhFUl9CTFVFTk9JU0UiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUEsaUJBQWlCLEdBQUcsRUFBQzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsRUFBQzs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
