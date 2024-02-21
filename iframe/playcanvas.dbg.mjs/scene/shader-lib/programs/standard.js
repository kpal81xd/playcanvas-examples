import { Debug } from '../../../core/debug.js';
import { SHADER_FORWARD, SHADER_FORWARDHDR, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, SPECULAR_PHONG, FRESNEL_SCHLICK, BLEND_NONE, DITHER_NONE, DITHER_BAYER8 } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ChunkUtils } from '../chunk-utils.js';
import { StandardMaterialOptions } from '../../materials/standard-material-options.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';

const _matTex2D = [];
const buildPropertiesList = options => {
  return Object.keys(options).filter(key => key !== "litOptions").sort();
};
class ShaderGeneratorStandard extends ShaderGenerator {
  constructor(...args) {
    super(...args);
    // Shared Standard Material option structures
    this.optionsContext = new StandardMaterialOptions();
    this.optionsContextMin = new StandardMaterialOptions();
  }
  generateKey(options) {
    let props;
    if (options === this.optionsContextMin) {
      if (!this.propsMin) this.propsMin = buildPropertiesList(options);
      props = this.propsMin;
    } else if (options === this.optionsContext) {
      if (!this.props) this.props = buildPropertiesList(options);
      props = this.props;
    } else {
      props = buildPropertiesList(options);
    }
    const key = "standard:\n" + props.map(prop => prop + options[prop]).join('\n') + LitOptionsUtils.generateKey(options.litOptions);
    return key;
  }

  // get the value to replace $UV with in Map Shader functions

  /**
   * Get the code with which to to replace '$UV' in the map shader functions.
   *
   * @param {string} transformPropName - Name of the transform id in the options block. Usually "basenameTransform".
   * @param {string} uVPropName - Name of the UV channel in the options block. Usually "basenameUv".
   * @param {object} options - The options passed into createShaderDefinition.
   * @returns {string} The code used to replace "$UV" in the shader code.
   * @private
   */
  _getUvSourceExpression(transformPropName, uVPropName, options) {
    const transformId = options[transformPropName];
    const uvChannel = options[uVPropName];
    const isMainPass = options.litOptions.pass === SHADER_FORWARD || options.litOptions.pass === SHADER_FORWARDHDR;
    let expression;
    if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
      expression = "nineSlicedUv";
    } else if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      expression = "nineSlicedUv";
    } else {
      if (transformId === 0) {
        expression = "vUv" + uvChannel;
      } else {
        // note: different capitalization!
        expression = "vUV" + uvChannel + "_" + transformId;
      }

      // if heightmap is enabled all maps except the heightmap are offset
      if (options.heightMap && transformPropName !== "heightMapTransform") {
        expression += " + dUvOffset";
      }
    }
    return expression;
  }
  _addMapDef(name, enabled) {
    return enabled ? `#define ${name}\n` : `#undef ${name}\n`;
  }
  _addMapDefs(float, color, vertex, map, invert) {
    return this._addMapDef("MAPFLOAT", float) + this._addMapDef("MAPCOLOR", color) + this._addMapDef("MAPVERTEX", vertex) + this._addMapDef("MAPTEXTURE", map) + this._addMapDef("MAPINVERT", invert);
  }

  /**
   * Add chunk for Map Types (used for all maps except Normal).
   *
   * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
   * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
   * @param {object} options - The options passed into to createShaderDefinition.
   * @param {object} chunks - The set of shader chunks to choose from.
   * @param {object} mapping - The mapping between chunk and sampler
   * @param {string} encoding - The texture's encoding
   * @returns {string} The shader code to support this map.
   * @private
   */
  _addMap(propName, chunkName, options, chunks, mapping, encoding = null) {
    const mapPropName = propName + "Map";
    const uVPropName = mapPropName + "Uv";
    const identifierPropName = mapPropName + "Identifier";
    const transformPropName = mapPropName + "Transform";
    const channelPropName = mapPropName + "Channel";
    const vertexColorChannelPropName = propName + "VertexColorChannel";
    const tintPropName = propName + "Tint";
    const vertexColorPropName = propName + "VertexColor";
    const detailModePropName = propName + "Mode";
    const invertName = propName + "Invert";
    const tintOption = options[tintPropName];
    const vertexColorOption = options[vertexColorPropName];
    const textureOption = options[mapPropName];
    const textureIdentifier = options[identifierPropName];
    const detailModeOption = options[detailModePropName];
    let subCode = chunks[chunkName];
    if (textureOption) {
      const uv = this._getUvSourceExpression(transformPropName, uVPropName, options);
      subCode = subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[channelPropName]);
      if (mapping && subCode.search(/\$SAMPLER/g) !== -1) {
        let samplerName = "texture_" + mapPropName;
        const alias = mapping[textureIdentifier];
        if (alias) {
          samplerName = alias;
        } else {
          mapping[textureIdentifier] = samplerName;
        }
        subCode = subCode.replace(/\$SAMPLER/g, samplerName);
      }
      if (encoding) {
        if (options[channelPropName] === 'aaa') {
          // completely skip decoding if the user has selected the alpha channel (since alpha
          // is never decoded).
          subCode = subCode.replace(/\$DECODE/g, 'passThrough');
        } else {
          subCode = subCode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(!options.litOptions.gamma && encoding === 'srgb' ? 'linear' : encoding));
        }

        // continue to support $texture2DSAMPLE
        if (subCode.indexOf('$texture2DSAMPLE')) {
          const decodeTable = {
            linear: 'texture2D',
            srgb: 'texture2DSRGB',
            rgbm: 'texture2DRGBM',
            rgbe: 'texture2DRGBE'
          };
          subCode = subCode.replace(/\$texture2DSAMPLE/g, decodeTable[encoding] || 'texture2D');
        }
      }
    }
    if (vertexColorOption) {
      subCode = subCode.replace(/\$VC/g, options[vertexColorChannelPropName]);
    }
    if (detailModeOption) {
      subCode = subCode.replace(/\$DETAILMODE/g, detailModeOption);
    }
    const isFloatTint = !!(tintOption & 1);
    const isVecTint = !!(tintOption & 2);
    const invertOption = !!options[invertName];
    subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption, invertOption) + subCode;
    return subCode.replace(/\$/g, "");
  }
  _correctChannel(p, chan, _matTex2D) {
    if (_matTex2D[p] > 0) {
      if (_matTex2D[p] < chan.length) {
        return chan.substring(0, _matTex2D[p]);
      } else if (_matTex2D[p] > chan.length) {
        let str = chan;
        const chr = str.charAt(str.length - 1);
        const addLen = _matTex2D[p] - str.length;
        for (let i = 0; i < addLen; i++) str += chr;
        return str;
      }
      return chan;
    }
  }

  /**
   * @param {import('../../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device.
   * @param {StandardMaterialOptions} options - The create options.
   * @returns {object} Returns the created shader definition.
   * @ignore
   */
  createShaderDefinition(device, options) {
    const shaderPassInfo = ShaderPass.get(device).getByIndex(options.litOptions.pass);
    const isForwardPass = shaderPassInfo.isForward;
    const litShader = new LitShader(device, options.litOptions);

    // generate vertex shader
    const useUv = [];
    const useUnmodifiedUv = [];
    const mapTransforms = [];
    const maxUvSets = 2;
    const textureMapping = {};
    for (const p in _matTex2D) {
      const mname = p + "Map";
      if (options[p + "VertexColor"]) {
        const cname = p + "VertexColorChannel";
        options[cname] = this._correctChannel(p, options[cname], _matTex2D);
      }
      if (options[mname]) {
        const cname = mname + "Channel";
        const tname = mname + "Transform";
        const uname = mname + "Uv";
        options[uname] = Math.min(options[uname], maxUvSets - 1);
        options[cname] = this._correctChannel(p, options[cname], _matTex2D);
        const uvSet = options[uname];
        useUv[uvSet] = true;
        useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || options[mname] && !options[tname];

        // create map transforms
        if (options[tname]) {
          mapTransforms.push({
            name: p,
            id: options[tname],
            uv: options[uname]
          });
        }
      }
    }
    if (options.forceUv1) {
      useUv[1] = true;
      useUnmodifiedUv[1] = useUnmodifiedUv[1] !== undefined ? useUnmodifiedUv[1] : true;
    }
    litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);

    // handle fragment shader
    if (options.litOptions.shadingModel === SPECULAR_PHONG) {
      options.litOptions.fresnelModel = 0;
      options.litOptions.ambientSH = false;
    } else {
      options.litOptions.fresnelModel = options.litOptions.fresnelModel === 0 ? FRESNEL_SCHLICK : options.litOptions.fresnelModel;
    }
    const decl = new ChunkBuilder();
    const code = new ChunkBuilder();
    const func = new ChunkBuilder();
    const args = new ChunkBuilder();
    let lightingUv = "";

    // global texture bias for standard textures
    if (options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      decl.append(`const float textureBias = -1000.0;`);
    } else {
      decl.append(`uniform float textureBias;`);
    }
    if (isForwardPass) {
      // parallax
      if (options.heightMap) {
        // if (!options.normalMap) {
        //     const transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
        //     if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
        //     code += tbn;
        // }
        decl.append("vec2 dUvOffset;");
        code.append(this._addMap("height", "parallaxPS", options, litShader.chunks, textureMapping));
        func.append("getParallax();");
      }

      // opacity
      if (options.litOptions.blendType !== BLEND_NONE || options.litOptions.alphaTest || options.litOptions.alphaToCoverage || options.litOptions.opacityDither !== DITHER_NONE) {
        decl.append("float dAlpha;");
        code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks, textureMapping));
        func.append("getOpacity();");
        args.append("litArgs_opacity = dAlpha;");
        if (options.litOptions.alphaTest) {
          code.append(litShader.chunks.alphaTestPS);
          func.append("alphaTest(dAlpha);");
        }
        const opacityDither = options.litOptions.opacityDither;
        if (opacityDither !== DITHER_NONE) {
          if (opacityDither === DITHER_BAYER8) decl.append(litShader.chunks.bayerPS);
          decl.append(`#define DITHER_${opacityDither.toUpperCase()}\n`);
          decl.append(litShader.chunks.opacityDitherPS);
          func.append("opacityDither(dAlpha, 0.0);");
        }
      } else {
        decl.append("float dAlpha = 1.0;");
      }

      // normal
      if (litShader.needsNormal) {
        if (options.normalMap || options.clearCoatNormalMap) {
          // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently decide which unpackNormal to use.
          code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);
          if (!options.litOptions.hasTangents) {
            // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
            const baseName = options.normalMap ? "normalMap" : "clearCoatNormalMap";
            lightingUv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
          }
        }
        decl.append("vec3 dNormalW;");
        code.append(this._addMap("normalDetail", "normalDetailMapPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("normal", "normalMapPS", options, litShader.chunks, textureMapping));
        func.append("getNormal();");
        args.append("litArgs_worldNormal = dNormalW;");
      }
      if (litShader.needsSceneColor) {
        decl.append("uniform sampler2D uSceneColorMap;");
      }
      if (litShader.needsScreenSize) {
        decl.append("uniform vec4 uScreenSize;");
      }
      if (litShader.needsTransforms) {
        decl.append("uniform mat4 matrix_viewProjection;");
        decl.append("uniform mat4 matrix_model;");
      }

      // support for diffuse & ao detail modes
      if (options.diffuseDetail || options.aoDetail) {
        code.append(litShader.chunks.detailModesPS);
      }

      // albedo
      decl.append("vec3 dAlbedo;");
      if (options.diffuseDetail) {
        code.append(this._addMap("diffuseDetail", "diffuseDetailMapPS", options, litShader.chunks, textureMapping, options.diffuseDetailEncoding));
      }
      code.append(this._addMap("diffuse", "diffusePS", options, litShader.chunks, textureMapping, options.diffuseEncoding));
      func.append("getAlbedo();");
      args.append("litArgs_albedo = dAlbedo;");
      if (options.litOptions.useRefraction) {
        decl.append("float dTransmission;");
        code.append(this._addMap("refraction", "transmissionPS", options, litShader.chunks, textureMapping));
        func.append("getRefraction();");
        args.append("litArgs_transmission = dTransmission;");
        decl.append("float dThickness;");
        code.append(this._addMap("thickness", "thicknessPS", options, litShader.chunks, textureMapping));
        func.append("getThickness();");
        args.append("litArgs_thickness = dThickness;");
      }
      if (options.litOptions.useIridescence) {
        decl.append("float dIridescence;");
        code.append(this._addMap("iridescence", "iridescencePS", options, litShader.chunks, textureMapping));
        func.append("getIridescence();");
        args.append("litArgs_iridescence_intensity = dIridescence;");
        decl.append("float dIridescenceThickness;");
        code.append(this._addMap("iridescenceThickness", "iridescenceThicknessPS", options, litShader.chunks, textureMapping));
        func.append("getIridescenceThickness();");
        args.append("litArgs_iridescence_thickness = dIridescenceThickness;");
      }

      // specularity & glossiness
      if (litShader.lighting && options.litOptions.useSpecular || litShader.reflections) {
        decl.append("vec3 dSpecularity;");
        decl.append("float dGlossiness;");
        if (options.litOptions.useSheen) {
          decl.append("vec3 sSpecularity;");
          code.append(this._addMap("sheen", "sheenPS", options, litShader.chunks, textureMapping, options.sheenEncoding));
          func.append("getSheen();");
          args.append("litArgs_sheen_specularity = sSpecularity;");
          decl.append("float sGlossiness;");
          code.append(this._addMap("sheenGloss", "sheenGlossPS", options, litShader.chunks, textureMapping));
          func.append("getSheenGlossiness();");
          args.append("litArgs_sheen_gloss = sGlossiness;");
        }
        if (options.litOptions.useMetalness) {
          decl.append("float dMetalness;");
          code.append(this._addMap("metalness", "metalnessPS", options, litShader.chunks, textureMapping));
          func.append("getMetalness();");
          args.append("litArgs_metalness = dMetalness;");
          decl.append("float dIor;");
          code.append(this._addMap("ior", "iorPS", options, litShader.chunks, textureMapping));
          func.append("getIor();");
          args.append("litArgs_ior = dIor;");
        }
        if (options.litOptions.useSpecularityFactor) {
          decl.append("float dSpecularityFactor;");
          code.append(this._addMap("specularityFactor", "specularityFactorPS", options, litShader.chunks, textureMapping));
          func.append("getSpecularityFactor();");
          args.append("litArgs_specularityFactor = dSpecularityFactor;");
        }
        if (options.useSpecularColor) {
          code.append(this._addMap("specular", "specularPS", options, litShader.chunks, textureMapping, options.specularEncoding));
        } else {
          code.append("void getSpecularity() { dSpecularity = vec3(1); }");
        }
        code.append(this._addMap("gloss", "glossPS", options, litShader.chunks, textureMapping));
        func.append("getGlossiness();");
        func.append("getSpecularity();");
        args.append("litArgs_specularity = dSpecularity;");
        args.append("litArgs_gloss = dGlossiness;");
      } else {
        decl.append("vec3 dSpecularity = vec3(0.0);");
        decl.append("float dGlossiness = 0.0;");
      }

      // ao
      if (options.aoDetail) {
        code.append(this._addMap("aoDetail", "aoDetailMapPS", options, litShader.chunks, textureMapping));
      }
      if (options.aoMap || options.aoVertexColor) {
        decl.append("float dAo;");
        code.append(this._addMap("ao", "aoPS", options, litShader.chunks, textureMapping));
        func.append("getAO();");
        args.append("litArgs_ao = dAo;");
      }

      // emission
      decl.append("vec3 dEmission;");
      code.append(this._addMap("emissive", "emissivePS", options, litShader.chunks, textureMapping, options.emissiveEncoding));
      func.append("getEmission();");
      args.append("litArgs_emission = dEmission;");

      // clearcoat
      if (options.litOptions.useClearCoat) {
        decl.append("float ccSpecularity;");
        decl.append("float ccGlossiness;");
        decl.append("vec3 ccNormalW;");
        code.append(this._addMap("clearCoat", "clearCoatPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("clearCoatGloss", "clearCoatGlossPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("clearCoatNormal", "clearCoatNormalPS", options, litShader.chunks, textureMapping));
        func.append("getClearCoat();");
        func.append("getClearCoatGlossiness();");
        func.append("getClearCoatNormal();");
        args.append("litArgs_clearcoat_specularity = ccSpecularity;");
        args.append("litArgs_clearcoat_gloss = ccGlossiness;");
        args.append("litArgs_clearcoat_worldNormal = ccNormalW;");
      }

      // lightmap
      if (options.lightMap || options.lightVertexColor) {
        const lightmapDir = options.dirLightMap && options.litOptions.useSpecular;
        const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
        decl.append("vec3 dLightmap;");
        if (lightmapDir) {
          decl.append("vec3 dLightmapDir;");
        }
        code.append(this._addMap("light", lightmapChunkPropName, options, litShader.chunks, textureMapping, options.lightMapEncoding));
        func.append("getLightMap();");
        args.append("litArgs_lightmap = dLightmap;");
        if (lightmapDir) {
          args.append("litArgs_lightmapDir = dLightmapDir;");
        }
      }

      // only add the legacy chunk if it's referenced
      if (code.code.indexOf('texture2DSRGB') !== -1 || code.code.indexOf('texture2DRGBM') !== -1 || code.code.indexOf('texture2DRGBE') !== -1) {
        Debug.deprecated('Shader chunk macro $texture2DSAMPLE(XXX) is deprecated. Please use $DECODE(texture2D(XXX)) instead.');
        code.prepend(litShader.chunks.textureSamplePS);
      }
    } else {
      // all other passes require only opacity
      const opacityShadowDither = options.litOptions.opacityShadowDither;
      if (options.litOptions.alphaTest || opacityShadowDither) {
        decl.append("float dAlpha;");
        code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks, textureMapping));
        func.append("getOpacity();");
        args.append("litArgs_opacity = dAlpha;");
        if (options.litOptions.alphaTest) {
          code.append(litShader.chunks.alphaTestPS);
          func.append("alphaTest(dAlpha);");
        }
        if (opacityShadowDither !== DITHER_NONE) {
          if (opacityShadowDither === DITHER_BAYER8) decl.append(litShader.chunks.bayerPS);
          decl.append(`#define DITHER_${opacityShadowDither.toUpperCase()}\n`);
          decl.append(litShader.chunks.opacityDitherPS);
          func.append("opacityDither(dAlpha, 0.0);");
        }
      }
    }
    decl.append(litShader.chunks.litShaderArgsPS);
    code.append(`void evaluateFrontend() { \n${func.code}\n${args.code}\n }\n`);
    func.code = `evaluateFrontend();`;
    for (const texture in textureMapping) {
      decl.append(`uniform sampler2D ${textureMapping[texture]};`);
    }

    // decl.append('//-------- frontend decl begin', decl.code, '//-------- frontend decl end');
    // code.append('//-------- frontend code begin', code.code, '//-------- frontend code end');
    // func.append('//-------- frontend func begin\n${func}//-------- frontend func end\n`;

    // format func
    func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
    litShader.generateFragmentShader(decl.code, code.code, func.code, lightingUv);
    return litShader.getDefinition();
  }
}
const standard = new ShaderGeneratorStandard();

export { _matTex2D, standard };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRElUSEVSX0JBWUVSOCwgRElUSEVSX05PTkUsIEZSRVNORUxfU0NITElDSyxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcbmltcG9ydCB7IExpdE9wdGlvbnNVdGlscyB9IGZyb20gJy4vbGl0LW9wdGlvbnMtdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyR2VuZXJhdG9yIH0gZnJvbSAnLi9zaGFkZXItZ2VuZXJhdG9yLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSAob3B0aW9ucykgPT4ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhvcHRpb25zKVxuICAgICAgICAuZmlsdGVyKGtleSA9PiBrZXkgIT09IFwibGl0T3B0aW9uc1wiKVxuICAgICAgICAuc29ydCgpO1xufTtcblxuY2xhc3MgU2hhZGVyR2VuZXJhdG9yU3RhbmRhcmQgZXh0ZW5kcyBTaGFkZXJHZW5lcmF0b3Ige1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0ID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCk7XG5cbiAgICBvcHRpb25zQ29udGV4dE1pbiA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucygpO1xuXG4gICAgZ2VuZXJhdGVLZXkob3B0aW9ucykge1xuICAgICAgICBsZXQgcHJvcHM7XG4gICAgICAgIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0TWluKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHNNaW4pIHRoaXMucHJvcHNNaW4gPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzTWluO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMgPT09IHRoaXMub3B0aW9uc0NvbnRleHQpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5wcm9wcykgdGhpcy5wcm9wcyA9IGJ1aWxkUHJvcGVydGllc0xpc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICBwcm9wcyA9IHRoaXMucHJvcHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9wcyA9IGJ1aWxkUHJvcGVydGllc0xpc3Qob3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBrZXkgPSBcInN0YW5kYXJkOlxcblwiICtcbiAgICAgICAgICAgIHByb3BzLm1hcChwcm9wID0+IHByb3AgKyBvcHRpb25zW3Byb3BdKS5qb2luKCdcXG4nKSArXG4gICAgICAgICAgICBMaXRPcHRpb25zVXRpbHMuZ2VuZXJhdGVLZXkob3B0aW9ucy5saXRPcHRpb25zKTtcblxuICAgICAgICByZXR1cm4ga2V5O1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbih0cmFuc2Zvcm1Qcm9wTmFtZSwgdVZQcm9wTmFtZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm1JZCA9IG9wdGlvbnNbdHJhbnNmb3JtUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB1dkNoYW5uZWwgPSBvcHRpb25zW3VWUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBpc01haW5QYXNzID0gb3B0aW9ucy5saXRPcHRpb25zLnBhc3MgPT09IFNIQURFUl9GT1JXQVJEIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5wYXNzID09PSBTSEFERVJfRk9SV0FSREhEUjtcblxuICAgICAgICBsZXQgZXhwcmVzc2lvbjtcbiAgICAgICAgaWYgKGlzTWFpblBhc3MgJiYgb3B0aW9ucy5saXRPcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcIm5pbmVTbGljZWRVdlwiO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTWFpblBhc3MgJiYgb3B0aW9ucy5saXRPcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHJhbnNmb3JtSWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gXCJ2VXZcIiArIHV2Q2hhbm5lbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogZGlmZmVyZW50IGNhcGl0YWxpemF0aW9uIVxuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcInZVVlwiICsgdXZDaGFubmVsICsgXCJfXCIgKyB0cmFuc2Zvcm1JZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgaGVpZ2h0bWFwIGlzIGVuYWJsZWQgYWxsIG1hcHMgZXhjZXB0IHRoZSBoZWlnaHRtYXAgYXJlIG9mZnNldFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwICYmIHRyYW5zZm9ybVByb3BOYW1lICE9PSBcImhlaWdodE1hcFRyYW5zZm9ybVwiKSB7XG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiArPSBcIiArIGRVdk9mZnNldFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgfVxuXG4gICAgX2FkZE1hcERlZihuYW1lLCBlbmFibGVkKSB7XG4gICAgICAgIHJldHVybiBlbmFibGVkID8gYCNkZWZpbmUgJHtuYW1lfVxcbmAgOiBgI3VuZGVmICR7bmFtZX1cXG5gO1xuICAgIH1cblxuICAgIF9hZGRNYXBEZWZzKGZsb2F0LCBjb2xvciwgdmVydGV4LCBtYXAsIGludmVydCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkTWFwRGVmKFwiTUFQRkxPQVRcIiwgZmxvYXQpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUENPTE9SXCIsIGNvbG9yKSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBWRVJURVhcIiwgdmVydGV4KSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBURVhUVVJFXCIsIG1hcCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQSU5WRVJUXCIsIGludmVydCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGNodW5rIGZvciBNYXAgVHlwZXMgKHVzZWQgZm9yIGFsbCBtYXBzIGV4Y2VwdCBOb3JtYWwpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb3BOYW1lIC0gVGhlIGJhc2UgbmFtZSBvZiB0aGUgbWFwOiBkaWZmdXNlIHwgZW1pc3NpdmUgfCBvcGFjaXR5IHwgbGlnaHQgfCBoZWlnaHQgfCBtZXRhbG5lc3MgfCBzcGVjdWxhciB8IGdsb3NzIHwgYW8uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNodW5rTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjaHVuayB0byB1c2UuIFVzdWFsbHkgXCJiYXNlbmFtZVBTXCIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBUaGUgb3B0aW9ucyBwYXNzZWQgaW50byB0byBjcmVhdGVTaGFkZXJEZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjaHVua3MgLSBUaGUgc2V0IG9mIHNoYWRlciBjaHVua3MgdG8gY2hvb3NlIGZyb20uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG1hcHBpbmcgLSBUaGUgbWFwcGluZyBiZXR3ZWVuIGNodW5rIGFuZCBzYW1wbGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nIC0gVGhlIHRleHR1cmUncyBlbmNvZGluZ1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzaGFkZXIgY29kZSB0byBzdXBwb3J0IHRoaXMgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZE1hcChwcm9wTmFtZSwgY2h1bmtOYW1lLCBvcHRpb25zLCBjaHVua3MsIG1hcHBpbmcsIGVuY29kaW5nID0gbnVsbCkge1xuICAgICAgICBjb25zdCBtYXBQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJNYXBcIjtcbiAgICAgICAgY29uc3QgdVZQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJVdlwiO1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiSWRlbnRpZmllclwiO1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm1Qcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgY29uc3QgY2hhbm5lbFByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JDaGFubmVsUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVmVydGV4Q29sb3JDaGFubmVsXCI7XG4gICAgICAgIGNvbnN0IHRpbnRQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJUaW50XCI7XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVmVydGV4Q29sb3JcIjtcbiAgICAgICAgY29uc3QgZGV0YWlsTW9kZVByb3BOYW1lID0gcHJvcE5hbWUgKyBcIk1vZGVcIjtcbiAgICAgICAgY29uc3QgaW52ZXJ0TmFtZSA9IHByb3BOYW1lICsgXCJJbnZlcnRcIjtcblxuICAgICAgICBjb25zdCB0aW50T3B0aW9uID0gb3B0aW9uc1t0aW50UHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvck9wdGlvbiA9IG9wdGlvbnNbdmVydGV4Q29sb3JQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHRleHR1cmVPcHRpb24gPSBvcHRpb25zW21hcFByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdGV4dHVyZUlkZW50aWZpZXIgPSBvcHRpb25zW2lkZW50aWZpZXJQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGRldGFpbE1vZGVPcHRpb24gPSBvcHRpb25zW2RldGFpbE1vZGVQcm9wTmFtZV07XG5cbiAgICAgICAgbGV0IHN1YkNvZGUgPSBjaHVua3NbY2h1bmtOYW1lXTtcblxuICAgICAgICBpZiAodGV4dHVyZU9wdGlvbikge1xuICAgICAgICAgICAgY29uc3QgdXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24odHJhbnNmb3JtUHJvcE5hbWUsIHVWUHJvcE5hbWUsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRVVi9nLCB1dikucmVwbGFjZSgvXFwkQ0gvZywgb3B0aW9uc1tjaGFubmVsUHJvcE5hbWVdKTtcblxuICAgICAgICAgICAgaWYgKG1hcHBpbmcgJiYgc3ViQ29kZS5zZWFyY2goL1xcJFNBTVBMRVIvZykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZXJOYW1lID0gXCJ0ZXh0dXJlX1wiICsgbWFwUHJvcE5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3QgYWxpYXMgPSBtYXBwaW5nW3RleHR1cmVJZGVudGlmaWVyXTtcbiAgICAgICAgICAgICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlck5hbWUgPSBhbGlhcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nW3RleHR1cmVJZGVudGlmaWVyXSA9IHNhbXBsZXJOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRTQU1QTEVSL2csIHNhbXBsZXJOYW1lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVuY29kaW5nKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNbY2hhbm5lbFByb3BOYW1lXSA9PT0gJ2FhYScpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29tcGxldGVseSBza2lwIGRlY29kaW5nIGlmIHRoZSB1c2VyIGhhcyBzZWxlY3RlZCB0aGUgYWxwaGEgY2hhbm5lbCAoc2luY2UgYWxwaGFcbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgbmV2ZXIgZGVjb2RlZCkuXG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFQ09ERS9nLCAncGFzc1Rocm91Z2gnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKCghb3B0aW9ucy5saXRPcHRpb25zLmdhbW1hICYmIGVuY29kaW5nID09PSAnc3JnYicpID8gJ2xpbmVhcicgOiBlbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIHRvIHN1cHBvcnQgJHRleHR1cmUyRFNBTVBMRVxuICAgICAgICAgICAgICAgIGlmIChzdWJDb2RlLmluZGV4T2YoJyR0ZXh0dXJlMkRTQU1QTEUnKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVUYWJsZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVhcjogJ3RleHR1cmUyRCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcmdiOiAndGV4dHVyZTJEU1JHQicsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JtOiAndGV4dHVyZTJEUkdCTScsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JlOiAndGV4dHVyZTJEUkdCRSdcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCR0ZXh0dXJlMkRTQU1QTEUvZywgZGVjb2RlVGFibGVbZW5jb2RpbmddIHx8ICd0ZXh0dXJlMkQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmVydGV4Q29sb3JPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFZDL2csIG9wdGlvbnNbdmVydGV4Q29sb3JDaGFubmVsUHJvcE5hbWVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXRhaWxNb2RlT3B0aW9uKSB7XG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERVRBSUxNT0RFL2csIGRldGFpbE1vZGVPcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNGbG9hdFRpbnQgPSAhISh0aW50T3B0aW9uICYgMSk7XG4gICAgICAgIGNvbnN0IGlzVmVjVGludCA9ICEhKHRpbnRPcHRpb24gJiAyKTtcbiAgICAgICAgY29uc3QgaW52ZXJ0T3B0aW9uID0gISEob3B0aW9uc1tpbnZlcnROYW1lXSk7XG5cbiAgICAgICAgc3ViQ29kZSA9IHRoaXMuX2FkZE1hcERlZnMoaXNGbG9hdFRpbnQsIGlzVmVjVGludCwgdmVydGV4Q29sb3JPcHRpb24sIHRleHR1cmVPcHRpb24sIGludmVydE9wdGlvbikgKyBzdWJDb2RlO1xuICAgICAgICByZXR1cm4gc3ViQ29kZS5yZXBsYWNlKC9cXCQvZywgXCJcIik7XG4gICAgfVxuXG4gICAgX2NvcnJlY3RDaGFubmVsKHAsIGNoYW4sIF9tYXRUZXgyRCkge1xuICAgICAgICBpZiAoX21hdFRleDJEW3BdID4gMCkge1xuICAgICAgICAgICAgaWYgKF9tYXRUZXgyRFtwXSA8IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoYW4uc3Vic3RyaW5nKDAsIF9tYXRUZXgyRFtwXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKF9tYXRUZXgyRFtwXSA+IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgbGV0IHN0ciA9IGNoYW47XG4gICAgICAgICAgICAgICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChzdHIubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkTGVuID0gX21hdFRleDJEW3BdIC0gc3RyLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKSBzdHIgKz0gY2hyO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2hhbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7U3RhbmRhcmRNYXRlcmlhbE9wdGlvbnN9IG9wdGlvbnMgLSBUaGUgY3JlYXRlIG9wdGlvbnMuXG4gICAgICogQHJldHVybnMge29iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBzaGFkZXIgZGVmaW5pdGlvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbihkZXZpY2UsIG9wdGlvbnMpIHtcblxuICAgICAgICBjb25zdCBzaGFkZXJQYXNzSW5mbyA9IFNoYWRlclBhc3MuZ2V0KGRldmljZSkuZ2V0QnlJbmRleChvcHRpb25zLmxpdE9wdGlvbnMucGFzcyk7XG4gICAgICAgIGNvbnN0IGlzRm9yd2FyZFBhc3MgPSBzaGFkZXJQYXNzSW5mby5pc0ZvcndhcmQ7XG4gICAgICAgIGNvbnN0IGxpdFNoYWRlciA9IG5ldyBMaXRTaGFkZXIoZGV2aWNlLCBvcHRpb25zLmxpdE9wdGlvbnMpO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIHZlcnRleCBzaGFkZXJcbiAgICAgICAgY29uc3QgdXNlVXYgPSBbXTtcbiAgICAgICAgY29uc3QgdXNlVW5tb2RpZmllZFV2ID0gW107XG4gICAgICAgIGNvbnN0IG1hcFRyYW5zZm9ybXMgPSBbXTtcbiAgICAgICAgY29uc3QgbWF4VXZTZXRzID0gMjtcbiAgICAgICAgY29uc3QgdGV4dHVyZU1hcHBpbmcgPSB7fTtcblxuICAgICAgICBmb3IgKGNvbnN0IHAgaW4gX21hdFRleDJEKSB7XG4gICAgICAgICAgICBjb25zdCBtbmFtZSA9IHAgKyBcIk1hcFwiO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9uc1twICsgXCJWZXJ0ZXhDb2xvclwiXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gcCArIFwiVmVydGV4Q29sb3JDaGFubmVsXCI7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbbW5hbWVdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY25hbWUgPSBtbmFtZSArIFwiQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRuYW1lID0gbW5hbWUgKyBcIlRyYW5zZm9ybVwiO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuYW1lID0gbW5hbWUgKyBcIlV2XCI7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zW3VuYW1lXSA9IE1hdGgubWluKG9wdGlvbnNbdW5hbWVdLCBtYXhVdlNldHMgLSAxKTtcbiAgICAgICAgICAgICAgICBvcHRpb25zW2NuYW1lXSA9IHRoaXMuX2NvcnJlY3RDaGFubmVsKHAsIG9wdGlvbnNbY25hbWVdLCBfbWF0VGV4MkQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXZTZXQgPSBvcHRpb25zW3VuYW1lXTtcbiAgICAgICAgICAgICAgICB1c2VVdlt1dlNldF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVzZVVubW9kaWZpZWRVdlt1dlNldF0gPSB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdIHx8IChvcHRpb25zW21uYW1lXSAmJiAhb3B0aW9uc1t0bmFtZV0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIG1hcCB0cmFuc2Zvcm1zXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNbdG5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcFRyYW5zZm9ybXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IG9wdGlvbnNbdG5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXY6IG9wdGlvbnNbdW5hbWVdXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmZvcmNlVXYxKSB7XG4gICAgICAgICAgICB1c2VVdlsxXSA9IHRydWU7XG4gICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbMV0gPSAodXNlVW5tb2RpZmllZFV2WzFdICE9PSB1bmRlZmluZWQpID8gdXNlVW5tb2RpZmllZFV2WzFdIDogdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpdFNoYWRlci5nZW5lcmF0ZVZlcnRleFNoYWRlcih1c2VVdiwgdXNlVW5tb2RpZmllZFV2LCBtYXBUcmFuc2Zvcm1zKTtcblxuICAgICAgICAvLyBoYW5kbGUgZnJhZ21lbnQgc2hhZGVyXG4gICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORykge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IDA7XG4gICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMuYW1iaWVudFNIID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID0gKG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPT09IDApID8gRlJFU05FTF9TQ0hMSUNLIDogb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlY2wgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGNvbnN0IGZ1bmMgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGxldCBsaWdodGluZ1V2ID0gXCJcIjtcblxuICAgICAgICAvLyBnbG9iYWwgdGV4dHVyZSBiaWFzIGZvciBzdGFuZGFyZCB0ZXh0dXJlc1xuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYGNvbnN0IGZsb2F0IHRleHR1cmVCaWFzID0gLTEwMDAuMDtgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIGZsb2F0IHRleHR1cmVCaWFzO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRm9yd2FyZFBhc3MpIHtcbiAgICAgICAgICAgIC8vIHBhcmFsbGF4XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXApIHtcbiAgICAgICAgICAgICAgICAvLyBpZiAoIW9wdGlvbnMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnN0IHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIiwgXCJoZWlnaHRNYXBVdlwiLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAvLyAgICAgaWYgKCFvcHRpb25zLmhhc1RhbmdlbnRzKSB0Ym4gPSB0Ym4ucmVwbGFjZSgvXFwkVVYvZywgdHJhbnNmb3JtZWRIZWlnaHRNYXBVdik7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvZGUgKz0gdGJuO1xuICAgICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzIgZFV2T2Zmc2V0O1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJoZWlnaHRcIiwgXCJwYXJhbGxheFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRQYXJhbGxheCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb3BhY2l0eVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5ibGVuZFR5cGUgIT09IEJMRU5EX05PTkUgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCB8fCBvcHRpb25zLmxpdE9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5vcGFjaXR5RGl0aGVyICE9PSBESVRIRVJfTk9ORSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19vcGFjaXR5ID0gZEFscGhhO1wiKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYWxwaGFUZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYWxwaGFUZXN0UFMpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImFscGhhVGVzdChkQWxwaGEpO1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvcGFjaXR5RGl0aGVyID0gb3B0aW9ucy5saXRPcHRpb25zLm9wYWNpdHlEaXRoZXI7XG4gICAgICAgICAgICAgICAgaWYgKG9wYWNpdHlEaXRoZXIgIT09IERJVEhFUl9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcGFjaXR5RGl0aGVyID09PSBESVRIRVJfQkFZRVI4KVxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5iYXllclBTKTtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoYCNkZWZpbmUgRElUSEVSXyR7b3BhY2l0eURpdGhlci50b1VwcGVyQ2FzZSgpfVxcbmApO1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLm9wYWNpdHlEaXRoZXJQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwib3BhY2l0eURpdGhlcihkQWxwaGEsIDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5saXRPcHRpb25zLmhhc1RhbmdlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmFsaXplIHRvIHN1cHBvcnQgZWFjaCBub3JtYWxtYXAgaW5wdXQgKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwLCBjbGVhckNvYXROb3JtYWxNYXApIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gb3B0aW9ucy5ub3JtYWxNYXAgPyBcIm5vcm1hbE1hcFwiIDogXCJjbGVhckNvYXROb3JtYWxNYXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0aW5nVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oYCR7YmFzZU5hbWV9VHJhbnNmb3JtYCwgYCR7YmFzZU5hbWV9VXZgLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsRGV0YWlsXCIsIFwibm9ybWFsRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxcIiwgXCJub3JtYWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc193b3JsZE5vcm1hbCA9IGROb3JtYWxXO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1NjZW5lQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gc2FtcGxlcjJEIHVTY2VuZUNvbG9yTWFwO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY3JlZW5TaXplKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1RyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHN1cHBvcnQgZm9yIGRpZmZ1c2UgJiBhbyBkZXRhaWwgbW9kZXNcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpZmZ1c2VEZXRhaWwgfHwgb3B0aW9ucy5hb0RldGFpbCkge1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuZGV0YWlsTW9kZXNQUyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFsYmVkb1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRBbGJlZG87XCIpO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZURldGFpbCkge1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImRpZmZ1c2VEZXRhaWxcIiwgXCJkaWZmdXNlRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZGlmZnVzZURldGFpbEVuY29kaW5nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlXCIsIFwiZGlmZnVzZVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VFbmNvZGluZykpO1xuICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRBbGJlZG8oKTtcIik7XG4gICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfYWxiZWRvID0gZEFsYmVkbztcIik7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlUmVmcmFjdGlvbikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRyYW5zbWlzc2lvbjtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwicmVmcmFjdGlvblwiLCBcInRyYW5zbWlzc2lvblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRSZWZyYWN0aW9uKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc190cmFuc21pc3Npb24gPSBkVHJhbnNtaXNzaW9uO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwidGhpY2tuZXNzXCIsIFwidGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfdGhpY2tuZXNzID0gZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlSXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRJcmlkZXNjZW5jZTtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaXJpZGVzY2VuY2VcIiwgXCJpcmlkZXNjZW5jZVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRJcmlkZXNjZW5jZSgpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfaXJpZGVzY2VuY2VfaW50ZW5zaXR5ID0gZElyaWRlc2NlbmNlO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZElyaWRlc2NlbmNlVGhpY2tuZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJpcmlkZXNjZW5jZVRoaWNrbmVzc1wiLCBcImlyaWRlc2NlbmNlVGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldElyaWRlc2NlbmNlVGhpY2tuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19pcmlkZXNjZW5jZV90aGlja25lc3MgPSBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhcml0eSAmIGdsb3NzaW5lc3NcbiAgICAgICAgICAgIGlmICgobGl0U2hhZGVyLmxpZ2h0aW5nICYmIG9wdGlvbnMubGl0T3B0aW9ucy51c2VTcGVjdWxhcikgfHwgbGl0U2hhZGVyLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VTaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgc1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5cIiwgXCJzaGVlblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNoZWVuRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbigpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX3NoZWVuX3NwZWN1bGFyaXR5ID0gc1NwZWN1bGFyaXR5O1wiKTtcblxuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IHNHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5HbG9zc1wiLCBcInNoZWVuR2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNoZWVuR2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX3NoZWVuX2dsb3NzID0gc0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZU1ldGFsbmVzcykge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRNZXRhbG5lc3M7XCIpO1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJtZXRhbG5lc3NcIiwgXCJtZXRhbG5lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE1ldGFsbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX21ldGFsbmVzcyA9IGRNZXRhbG5lc3M7XCIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZElvcjtcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlvclwiLCBcImlvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SW9yKCk7XCIpO1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfaW9yID0gZElvcjtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkU3BlY3VsYXJpdHlGYWN0b3I7XCIpO1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzcGVjdWxhcml0eUZhY3RvclwiLCBcInNwZWN1bGFyaXR5RmFjdG9yUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTcGVjdWxhcml0eUZhY3RvcigpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX3NwZWN1bGFyaXR5RmFjdG9yID0gZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXJDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzcGVjdWxhclwiLCBcInNwZWN1bGFyUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuc3BlY3VsYXJFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKFwidm9pZCBnZXRTcGVjdWxhcml0eSgpIHsgZFNwZWN1bGFyaXR5ID0gdmVjMygxKTsgfVwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZ2xvc3NcIiwgXCJnbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRHbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHkoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX3NwZWN1bGFyaXR5ID0gZFNwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfZ2xvc3MgPSBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9EZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJhb0RldGFpbFwiLCBcImFvRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmFvTWFwIHx8IG9wdGlvbnMuYW9WZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFvO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJhb1wiLCBcImFvUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEFPKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19hbyA9IGRBbztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVtaXNzaW9uXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEVtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImVtaXNzaXZlXCIsIFwiZW1pc3NpdmVQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5lbWlzc2l2ZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEVtaXNzaW9uKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX2VtaXNzaW9uID0gZEVtaXNzaW9uO1wiKTtcblxuICAgICAgICAgICAgLy8gY2xlYXJjb2F0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZUNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgY2NTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBjY05vcm1hbFc7XCIpO1xuXG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0XCIsIFwiY2xlYXJDb2F0UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRHbG9zc1wiLCBcImNsZWFyQ29hdEdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXROb3JtYWxcIiwgXCJjbGVhckNvYXROb3JtYWxQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuXG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXQoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXRHbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0Tm9ybWFsKCk7XCIpO1xuXG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJsaXRBcmdzX2NsZWFyY29hdF9zcGVjdWxhcml0eSA9IGNjU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19jbGVhcmNvYXRfZ2xvc3MgPSBjY0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19jbGVhcmNvYXRfd29ybGROb3JtYWwgPSBjY05vcm1hbFc7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsaWdodG1hcFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXAgfHwgb3B0aW9ucy5saWdodFZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBEaXIgPSAob3B0aW9ucy5kaXJMaWdodE1hcCAmJiBvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSA9IGxpZ2h0bWFwRGlyID8gJ2xpZ2h0bWFwRGlyUFMnIDogJ2xpZ2h0bWFwU2luZ2xlUFMnO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwRGlyO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibGlnaHRcIiwgbGlnaHRtYXBDaHVua1Byb3BOYW1lLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5saWdodE1hcEVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRMaWdodE1hcCgpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfbGlnaHRtYXAgPSBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcImxpdEFyZ3NfbGlnaHRtYXBEaXIgPSBkTGlnaHRtYXBEaXI7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWxsIG90aGVyIHBhc3NlcyByZXF1aXJlIG9ubHkgb3BhY2l0eVxuICAgICAgICAgICAgY29uc3Qgb3BhY2l0eVNoYWRvd0RpdGhlciA9IG9wdGlvbnMubGl0T3B0aW9ucy5vcGFjaXR5U2hhZG93RGl0aGVyO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QgfHwgb3BhY2l0eVNoYWRvd0RpdGhlcikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwibGl0QXJnc19vcGFjaXR5ID0gZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLmFscGhhVGVzdFBTKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJhbHBoYVRlc3QoZEFscGhhKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcGFjaXR5U2hhZG93RGl0aGVyICE9PSBESVRIRVJfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob3BhY2l0eVNoYWRvd0RpdGhlciA9PT0gRElUSEVSX0JBWUVSOClcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYmF5ZXJQUyk7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKGAjZGVmaW5lIERJVEhFUl8ke29wYWNpdHlTaGFkb3dEaXRoZXIudG9VcHBlckNhc2UoKX1cXG5gKTtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5vcGFjaXR5RGl0aGVyUFMpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcIm9wYWNpdHlEaXRoZXIoZEFscGhhLCAwLjApO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkZWNsLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLmxpdFNoYWRlckFyZ3NQUyk7XG4gICAgICAgIGNvZGUuYXBwZW5kKGB2b2lkIGV2YWx1YXRlRnJvbnRlbmQoKSB7IFxcbiR7ZnVuYy5jb2RlfVxcbiR7YXJncy5jb2RlfVxcbiB9XFxuYCk7XG4gICAgICAgIGZ1bmMuY29kZSA9IGBldmFsdWF0ZUZyb250ZW5kKCk7YDtcblxuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgaW4gdGV4dHVyZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIHNhbXBsZXIyRCAke3RleHR1cmVNYXBwaW5nW3RleHR1cmVdfTtgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlY2wuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgYmVnaW4nLCBkZWNsLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgZW5kJyk7XG4gICAgICAgIC8vIGNvZGUuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgYmVnaW4nLCBjb2RlLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgZW5kJyk7XG4gICAgICAgIC8vIGZ1bmMuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgYmVnaW5cXG4ke2Z1bmN9Ly8tLS0tLS0tLSBmcm9udGVuZCBmdW5jIGVuZFxcbmA7XG5cbiAgICAgICAgLy8gZm9ybWF0IGZ1bmNcbiAgICAgICAgZnVuYy5jb2RlID0gYFxcbiR7ZnVuYy5jb2RlLnNwbGl0KCdcXG4nKS5tYXAobCA9PiBgICAgICR7bH1gKS5qb2luKCdcXG4nKX1cXG5cXG5gO1xuXG4gICAgICAgIGxpdFNoYWRlci5nZW5lcmF0ZUZyYWdtZW50U2hhZGVyKGRlY2wuY29kZSwgY29kZS5jb2RlLCBmdW5jLmNvZGUsIGxpZ2h0aW5nVXYpO1xuXG4gICAgICAgIHJldHVybiBsaXRTaGFkZXIuZ2V0RGVmaW5pdGlvbigpO1xuICAgIH1cbn1cblxuY29uc3Qgc3RhbmRhcmQgPSBuZXcgU2hhZGVyR2VuZXJhdG9yU3RhbmRhcmQoKTtcblxuZXhwb3J0IHsgX21hdFRleDJELCBzdGFuZGFyZCB9O1xuIl0sIm5hbWVzIjpbIl9tYXRUZXgyRCIsImJ1aWxkUHJvcGVydGllc0xpc3QiLCJvcHRpb25zIiwiT2JqZWN0Iiwia2V5cyIsImZpbHRlciIsImtleSIsInNvcnQiLCJTaGFkZXJHZW5lcmF0b3JTdGFuZGFyZCIsIlNoYWRlckdlbmVyYXRvciIsImNvbnN0cnVjdG9yIiwiYXJncyIsIm9wdGlvbnNDb250ZXh0IiwiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMiLCJvcHRpb25zQ29udGV4dE1pbiIsImdlbmVyYXRlS2V5IiwicHJvcHMiLCJwcm9wc01pbiIsIm1hcCIsInByb3AiLCJqb2luIiwiTGl0T3B0aW9uc1V0aWxzIiwibGl0T3B0aW9ucyIsIl9nZXRVdlNvdXJjZUV4cHJlc3Npb24iLCJ0cmFuc2Zvcm1Qcm9wTmFtZSIsInVWUHJvcE5hbWUiLCJ0cmFuc2Zvcm1JZCIsInV2Q2hhbm5lbCIsImlzTWFpblBhc3MiLCJwYXNzIiwiU0hBREVSX0ZPUldBUkQiLCJTSEFERVJfRk9SV0FSREhEUiIsImV4cHJlc3Npb24iLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiaGVpZ2h0TWFwIiwiX2FkZE1hcERlZiIsIm5hbWUiLCJlbmFibGVkIiwiX2FkZE1hcERlZnMiLCJmbG9hdCIsImNvbG9yIiwidmVydGV4IiwiaW52ZXJ0IiwiX2FkZE1hcCIsInByb3BOYW1lIiwiY2h1bmtOYW1lIiwiY2h1bmtzIiwibWFwcGluZyIsImVuY29kaW5nIiwibWFwUHJvcE5hbWUiLCJpZGVudGlmaWVyUHJvcE5hbWUiLCJjaGFubmVsUHJvcE5hbWUiLCJ2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSIsInRpbnRQcm9wTmFtZSIsInZlcnRleENvbG9yUHJvcE5hbWUiLCJkZXRhaWxNb2RlUHJvcE5hbWUiLCJpbnZlcnROYW1lIiwidGludE9wdGlvbiIsInZlcnRleENvbG9yT3B0aW9uIiwidGV4dHVyZU9wdGlvbiIsInRleHR1cmVJZGVudGlmaWVyIiwiZGV0YWlsTW9kZU9wdGlvbiIsInN1YkNvZGUiLCJ1diIsInJlcGxhY2UiLCJzZWFyY2giLCJzYW1wbGVyTmFtZSIsImFsaWFzIiwiQ2h1bmtVdGlscyIsImRlY29kZUZ1bmMiLCJnYW1tYSIsImluZGV4T2YiLCJkZWNvZGVUYWJsZSIsImxpbmVhciIsInNyZ2IiLCJyZ2JtIiwicmdiZSIsImlzRmxvYXRUaW50IiwiaXNWZWNUaW50IiwiaW52ZXJ0T3B0aW9uIiwiX2NvcnJlY3RDaGFubmVsIiwicCIsImNoYW4iLCJsZW5ndGgiLCJzdWJzdHJpbmciLCJzdHIiLCJjaHIiLCJjaGFyQXQiLCJhZGRMZW4iLCJpIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsImRldmljZSIsInNoYWRlclBhc3NJbmZvIiwiU2hhZGVyUGFzcyIsImdldCIsImdldEJ5SW5kZXgiLCJpc0ZvcndhcmRQYXNzIiwiaXNGb3J3YXJkIiwibGl0U2hhZGVyIiwiTGl0U2hhZGVyIiwidXNlVXYiLCJ1c2VVbm1vZGlmaWVkVXYiLCJtYXBUcmFuc2Zvcm1zIiwibWF4VXZTZXRzIiwidGV4dHVyZU1hcHBpbmciLCJtbmFtZSIsImNuYW1lIiwidG5hbWUiLCJ1bmFtZSIsIk1hdGgiLCJtaW4iLCJ1dlNldCIsInB1c2giLCJpZCIsImZvcmNlVXYxIiwidW5kZWZpbmVkIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImZyZXNuZWxNb2RlbCIsImFtYmllbnRTSCIsIkZSRVNORUxfU0NITElDSyIsImRlY2wiLCJDaHVua0J1aWxkZXIiLCJjb2RlIiwiZnVuYyIsImxpZ2h0aW5nVXYiLCJhcHBlbmQiLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFUb0NvdmVyYWdlIiwib3BhY2l0eURpdGhlciIsIkRJVEhFUl9OT05FIiwiYWxwaGFUZXN0UFMiLCJESVRIRVJfQkFZRVI4IiwiYmF5ZXJQUyIsInRvVXBwZXJDYXNlIiwib3BhY2l0eURpdGhlclBTIiwibmVlZHNOb3JtYWwiLCJub3JtYWxNYXAiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJwYWNrZWROb3JtYWwiLCJub3JtYWxYWVBTIiwibm9ybWFsWFlaUFMiLCJoYXNUYW5nZW50cyIsImJhc2VOYW1lIiwibmVlZHNTY2VuZUNvbG9yIiwibmVlZHNTY3JlZW5TaXplIiwibmVlZHNUcmFuc2Zvcm1zIiwiZGlmZnVzZURldGFpbCIsImFvRGV0YWlsIiwiZGV0YWlsTW9kZXNQUyIsImRpZmZ1c2VEZXRhaWxFbmNvZGluZyIsImRpZmZ1c2VFbmNvZGluZyIsInVzZVJlZnJhY3Rpb24iLCJ1c2VJcmlkZXNjZW5jZSIsImxpZ2h0aW5nIiwidXNlU3BlY3VsYXIiLCJyZWZsZWN0aW9ucyIsInVzZVNoZWVuIiwic2hlZW5FbmNvZGluZyIsInVzZU1ldGFsbmVzcyIsInVzZVNwZWN1bGFyaXR5RmFjdG9yIiwidXNlU3BlY3VsYXJDb2xvciIsInNwZWN1bGFyRW5jb2RpbmciLCJhb01hcCIsImFvVmVydGV4Q29sb3IiLCJlbWlzc2l2ZUVuY29kaW5nIiwidXNlQ2xlYXJDb2F0IiwibGlnaHRNYXAiLCJsaWdodFZlcnRleENvbG9yIiwibGlnaHRtYXBEaXIiLCJkaXJMaWdodE1hcCIsImxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSIsImxpZ2h0TWFwRW5jb2RpbmciLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJwcmVwZW5kIiwidGV4dHVyZVNhbXBsZVBTIiwib3BhY2l0eVNoYWRvd0RpdGhlciIsImxpdFNoYWRlckFyZ3NQUyIsInRleHR1cmUiLCJzcGxpdCIsImwiLCJnZW5lcmF0ZUZyYWdtZW50U2hhZGVyIiwiZ2V0RGVmaW5pdGlvbiIsInN0YW5kYXJkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBZ0JNQSxNQUFBQSxTQUFTLEdBQUcsR0FBRTtBQUVwQixNQUFNQyxtQkFBbUIsR0FBSUMsT0FBTyxJQUFLO0FBQ3JDLEVBQUEsT0FBT0MsTUFBTSxDQUFDQyxJQUFJLENBQUNGLE9BQU8sQ0FBQyxDQUN0QkcsTUFBTSxDQUFDQyxHQUFHLElBQUlBLEdBQUcsS0FBSyxZQUFZLENBQUMsQ0FDbkNDLElBQUksRUFBRSxDQUFBO0FBQ2YsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsdUJBQXVCLFNBQVNDLGVBQWUsQ0FBQztBQUFBQyxFQUFBQSxXQUFBQSxDQUFBLEdBQUFDLElBQUEsRUFBQTtBQUFBLElBQUEsS0FBQSxDQUFBLEdBQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ2xEO0FBQUEsSUFBQSxJQUFBLENBQ0FDLGNBQWMsR0FBRyxJQUFJQyx1QkFBdUIsRUFBRSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBRTlDQyxpQkFBaUIsR0FBRyxJQUFJRCx1QkFBdUIsRUFBRSxDQUFBO0FBQUEsR0FBQTtFQUVqREUsV0FBV0EsQ0FBQ2IsT0FBTyxFQUFFO0FBQ2pCLElBQUEsSUFBSWMsS0FBSyxDQUFBO0FBQ1QsSUFBQSxJQUFJZCxPQUFPLEtBQUssSUFBSSxD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
