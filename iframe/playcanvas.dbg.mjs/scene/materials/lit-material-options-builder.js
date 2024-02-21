import { SHADER_FORWARDHDR, GAMMA_SRGBHDR, TONEMAP_LINEAR, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_TANGENTS, SPRITE_RENDERMODE_SIMPLE, CUBEPROJ_NONE, SPECULAR_BLINN, GAMMA_NONE, MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADERDEF_NOSHADOW } from '../constants.js';

class LitMaterialOptionsBuilder {
  static update(litOptions, material, scene, objDefs, pass, sortedLights) {
    LitMaterialOptionsBuilder.updateSharedOptions(litOptions, material, scene, objDefs, pass);
    LitMaterialOptionsBuilder.updateMaterialOptions(litOptions, material);
    LitMaterialOptionsBuilder.updateEnvOptions(litOptions, material, scene);
    LitMaterialOptionsBuilder.updateLightingOptions(litOptions, material, objDefs, sortedLights);
    if (pass === SHADER_FORWARDHDR) {
      litOptions.gamma = GAMMA_SRGBHDR;
      litOptions.toneMap = TONEMAP_LINEAR;
    }
  }
  static updateSharedOptions(litOptions, material, scene, objDefs, pass) {
    litOptions.chunks = material.chunks;
    litOptions.pass = pass;
    litOptions.alphaTest = material.alphaTest > 0;
    litOptions.blendType = material.blendType;
    litOptions.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
    litOptions.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
    litOptions.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
    litOptions.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
    litOptions.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
    litOptions.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;
    litOptions.hasTangents = objDefs && (objDefs & SHADERDEF_TANGENTS) !== 0;
    litOptions.nineSlicedMode = material.nineSlicedMode || SPRITE_RENDERMODE_SIMPLE;

    // clustered lighting features (in shared options as shadow pass needs this too)
    if (material.useLighting && scene.clusteredLightingEnabled) {
      litOptions.clusteredLightingEnabled = true;
      litOptions.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
      litOptions.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
      litOptions.clusteredLightingShadowType = scene.lighting.shadowType;
      litOptions.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
    } else {
      litOptions.clusteredLightingEnabled = false;
      litOptions.clusteredLightingCookiesEnabled = false;
      litOptions.clusteredLightingShadowsEnabled = false;
      litOptions.clusteredLightingAreaLightsEnabled = false;
    }
  }
  static updateMaterialOptions(litOptions, material) {
    litOptions.useAmbientTint = false;
    litOptions.separateAmbient = false; // store ambient light color in separate variable, instead of adding it to diffuse directly
    litOptions.customFragmentShader = null;
    litOptions.pixelSnap = material.pixelSnap;
    litOptions.shadingModel = material.shadingModel;
    litOptions.ambientSH = material.ambientSH;
    litOptions.fastTbn = material.fastTbn;
    litOptions.twoSidedLighting = material.twoSidedLighting;
    litOptions.occludeDirect = material.occludeDirect;
    litOptions.occludeSpecular = material.occludeSpecular;
    litOptions.occludeSpecularFloat = material.occludeSpecularIntensity !== 1.0;
    litOptions.useMsdf = false;
    litOptions.msdfTextAttribute = false;
    litOptions.alphaToCoverage = material.alphaToCoverage;
    litOptions.opacityFadesSpecular = material.opacityFadesSpecular;
    litOptions.opacityDither = material.opacityDither;
    litOptions.opacityShadowDither = material.opacityShadowDither;
    litOptions.cubeMapProjection = CUBEPROJ_NONE;
    litOptions.conserveEnergy = material.conserveEnergy && material.shadingModel === SPECULAR_BLINN;
    litOptions.useSpecular = material.hasSpecular;
    litOptions.useSpecularityFactor = material.hasSpecularityFactor;
    litOptions.enableGGXSpecular = material.ggxSpecular;
    litOptions.fresnelModel = material.fresnelModel;
    litOptions.useRefraction = material.hasRefraction;
    litOptions.useClearCoat = material.hasClearCoat;
    litOptions.useSheen = material.hasSheen;
    litOptions.useIridescence = material.hasIrridescence;
    litOptions.useMetalness = material.hasMetalness;
    litOptions.useDynamicRefraction = material.dynamicRefraction;
    litOptions.vertexColors = false;
    litOptions.lightMapEnabled = material.hasLighting;
    litOptions.dirLightMapEnabled = material.dirLightMap;
    litOptions.useHeights = material.hasHeights;
    litOptions.useNormals = material.hasNormals;
    litOptions.useClearCoatNormals = material.hasClearCoatNormals;
    litOptions.useAo = material.hasAo;
    litOptions.diffuseMapEnabled = material.hasDiffuseMap;
  }
  static updateEnvOptions(litOptions, material, scene) {
    litOptions.fog = material.useFog ? scene.fog : 'none';
    litOptions.gamma = material.useGammaTonemap ? scene.gammaCorrection : GAMMA_NONE;
    litOptions.toneMap = material.useGammaTonemap ? scene.toneMapping : -1;
    litOptions.fixSeams = false;

    // source of reflections
    if (material.useSkybox && scene.envAtlas && scene.skybox) {
      litOptions.reflectionSource = 'envAtlasHQ';
      litOptions.reflectionEncoding = scene.envAtlas.encoding;
      litOptions.reflectionCubemapEncoding = scene.skybox.encoding;
    } else if (material.useSkybox && scene.envAtlas) {
      litOptions.reflectionSource = 'envAtlas';
      litOptions.reflectionEncoding = scene.envAtlas.encoding;
    } else if (material.useSkybox && scene.skybox) {
      litOptions.reflectionSource = 'cubeMap';
      litOptions.reflectionEncoding = scene.skybox.encoding;
    } else {
      litOptions.reflectionSource = null;
      litOptions.reflectionEncoding = null;
    }

    // source of environment ambient is as follows:
    if (material.ambientSH) {
      litOptions.ambientSource = 'ambientSH';
      litOptions.ambientEncoding = null;
    } else if (litOptions.reflectionSource && scene.envAtlas) {
      litOptions.ambientSource = 'envAtlas';
      litOptions.ambientEncoding = scene.envAtlas.encoding;
    } else {
      litOptions.ambientSource = 'constant';
      litOptions.ambientEncoding = null;
    }
    const hasSkybox = !!litOptions.reflectionSource;
    litOptions.skyboxIntensity = hasSkybox && (scene.skyboxIntensity !== 1 || scene.physicalUnits);
    litOptions.useCubeMapRotation = hasSkybox && scene._skyboxRotationShaderInclude;
  }
  static updateLightingOptions(litOptions, material, objDefs, sortedLights) {
    litOptions.lightMapWithoutAmbient = false;
    if (material.useLighting) {
      const lightsFiltered = [];
      const mask = objDefs ? objDefs >> 16 : MASK_AFFECT_DYNAMIC;

      // mask to select lights (dynamic vs lightmapped) when using clustered lighting
      litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);
      litOptions.lightMapWithoutAmbient = false;
      if (sortedLights) {
        LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
        LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask);
        LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask);
      }
      litOptions.lights = lightsFiltered;
    } else {
      litOptions.lights = [];
    }
    if (litOptions.lights.length === 0 || (objDefs & SHADERDEF_NOSHADOW) !== 0) {
      litOptions.noShadow = true;
    }
  }
  static collectLights(lType, lights, lightsFiltered, mask) {
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (light.enabled) {
        if (light.mask & mask) {
          lightsFiltered.push(light);
        }
      }
    }
  }
}

export { LitMaterialOptionsBuilder };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LW1hdGVyaWFsLW9wdGlvbnMtYnVpbGRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL21hdGVyaWFscy9saXQtbWF0ZXJpYWwtb3B0aW9ucy1idWlsZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENVQkVQUk9KX05PTkUsIEdBTU1BX1NSR0JIRFIsIEdBTU1BX05PTkUsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBTSEFERVJfRk9SV0FSREhEUiwgVE9ORU1BUF9MSU5FQVIsIFNIQURFUkRFRl9JTlNUQU5DSU5HLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04sIFNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VELCBTSEFERVJERUZfU0NSRUVOU1BBQ0UsIFNIQURFUkRFRl9TS0lOLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9UQU5HRU5UUywgU1BFQ1VMQVJfQkxJTk4sIFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcblxuY2xhc3MgTGl0TWF0ZXJpYWxPcHRpb25zQnVpbGRlciB7XG4gICAgc3RhdGljIHVwZGF0ZShsaXRPcHRpb25zLCBtYXRlcmlhbCwgc2NlbmUsIG9iakRlZnMsIHBhc3MsIHNvcnRlZExpZ2h0cykge1xuICAgICAgICBMaXRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyLnVwZGF0ZVNoYXJlZE9wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwsIHNjZW5lLCBvYmpEZWZzLCBwYXNzKTtcbiAgICAgICAgTGl0TWF0ZXJpYWxPcHRpb25zQnVpbGRlci51cGRhdGVNYXRlcmlhbE9wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwpO1xuICAgICAgICBMaXRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyLnVwZGF0ZUVudk9wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwsIHNjZW5lKTtcbiAgICAgICAgTGl0TWF0ZXJpYWxPcHRpb25zQnVpbGRlci51cGRhdGVMaWdodGluZ09wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwsIG9iakRlZnMsIHNvcnRlZExpZ2h0cyk7XG5cbiAgICAgICAgaWYgKHBhc3MgPT09IFNIQURFUl9GT1JXQVJESERSKSB7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmdhbW1hID0gR0FNTUFfU1JHQkhEUjtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMudG9uZU1hcCA9IFRPTkVNQVBfTElORUFSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIHVwZGF0ZVNoYXJlZE9wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwsIHNjZW5lLCBvYmpEZWZzLCBwYXNzKSB7XG4gICAgICAgIGxpdE9wdGlvbnMuY2h1bmtzID0gbWF0ZXJpYWwuY2h1bmtzO1xuICAgICAgICBsaXRPcHRpb25zLnBhc3MgPSBwYXNzO1xuICAgICAgICBsaXRPcHRpb25zLmFscGhhVGVzdCA9IG1hdGVyaWFsLmFscGhhVGVzdCA+IDA7XG4gICAgICAgIGxpdE9wdGlvbnMuYmxlbmRUeXBlID0gbWF0ZXJpYWwuYmxlbmRUeXBlO1xuXG4gICAgICAgIGxpdE9wdGlvbnMuc2NyZWVuU3BhY2UgPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX1NDUkVFTlNQQUNFKSAhPT0gMDtcbiAgICAgICAgbGl0T3B0aW9ucy5za2luID0gb2JqRGVmcyAmJiAob2JqRGVmcyAmIFNIQURFUkRFRl9TS0lOKSAhPT0gMDtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VJbnN0YW5jaW5nID0gb2JqRGVmcyAmJiAob2JqRGVmcyAmIFNIQURFUkRFRl9JTlNUQU5DSU5HKSAhPT0gMDtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VNb3JwaFBvc2l0aW9uID0gb2JqRGVmcyAmJiAob2JqRGVmcyAmIFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTikgIT09IDA7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlTW9ycGhOb3JtYWwgPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX01PUlBIX05PUk1BTCkgIT09IDA7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlTW9ycGhUZXh0dXJlQmFzZWQgPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpICE9PSAwO1xuICAgICAgICBsaXRPcHRpb25zLmhhc1RhbmdlbnRzID0gb2JqRGVmcyAmJiAoKG9iakRlZnMgJiBTSEFERVJERUZfVEFOR0VOVFMpICE9PSAwKTtcblxuICAgICAgICBsaXRPcHRpb25zLm5pbmVTbGljZWRNb2RlID0gbWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgfHwgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFO1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZyBmZWF0dXJlcyAoaW4gc2hhcmVkIG9wdGlvbnMgYXMgc2hhZG93IHBhc3MgbmVlZHMgdGhpcyB0b28pXG4gICAgICAgIGlmIChtYXRlcmlhbC51c2VMaWdodGluZyAmJiBzY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdDb29raWVzRW5hYmxlZCA9IHNjZW5lLmxpZ2h0aW5nLmNvb2tpZXNFbmFibGVkO1xuICAgICAgICAgICAgbGl0T3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkID0gc2NlbmUubGlnaHRpbmcuc2hhZG93c0VuYWJsZWQ7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSA9IHNjZW5lLmxpZ2h0aW5nLnNoYWRvd1R5cGU7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQgPSBzY2VuZS5saWdodGluZy5hcmVhTGlnaHRzRW5hYmxlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgbGl0T3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgdXBkYXRlTWF0ZXJpYWxPcHRpb25zKGxpdE9wdGlvbnMsIG1hdGVyaWFsKSB7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlQW1iaWVudFRpbnQgPSBmYWxzZTtcbiAgICAgICAgbGl0T3B0aW9ucy5zZXBhcmF0ZUFtYmllbnQgPSBmYWxzZTsgICAgLy8gc3RvcmUgYW1iaWVudCBsaWdodCBjb2xvciBpbiBzZXBhcmF0ZSB2YXJpYWJsZSwgaW5zdGVhZCBvZiBhZGRpbmcgaXQgdG8gZGlmZnVzZSBkaXJlY3RseVxuICAgICAgICBsaXRPcHRpb25zLmN1c3RvbUZyYWdtZW50U2hhZGVyID0gbnVsbDtcbiAgICAgICAgbGl0T3B0aW9ucy5waXhlbFNuYXAgPSBtYXRlcmlhbC5waXhlbFNuYXA7XG5cbiAgICAgICAgbGl0T3B0aW9ucy5zaGFkaW5nTW9kZWwgPSBtYXRlcmlhbC5zaGFkaW5nTW9kZWw7XG4gICAgICAgIGxpdE9wdGlvbnMuYW1iaWVudFNIID0gbWF0ZXJpYWwuYW1iaWVudFNIO1xuICAgICAgICBsaXRPcHRpb25zLmZhc3RUYm4gPSBtYXRlcmlhbC5mYXN0VGJuO1xuICAgICAgICBsaXRPcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcgPSBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nO1xuICAgICAgICBsaXRPcHRpb25zLm9jY2x1ZGVEaXJlY3QgPSBtYXRlcmlhbC5vY2NsdWRlRGlyZWN0O1xuICAgICAgICBsaXRPcHRpb25zLm9jY2x1ZGVTcGVjdWxhciA9IG1hdGVyaWFsLm9jY2x1ZGVTcGVjdWxhcjtcbiAgICAgICAgbGl0T3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA9IChtYXRlcmlhbC5vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkgIT09IDEuMCk7XG5cbiAgICAgICAgbGl0T3B0aW9ucy51c2VNc2RmID0gZmFsc2U7XG4gICAgICAgIGxpdE9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUgPSBmYWxzZTtcblxuICAgICAgICBsaXRPcHRpb25zLmFscGhhVG9Db3ZlcmFnZSA9IG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZTtcbiAgICAgICAgbGl0T3B0aW9ucy5vcGFjaXR5RmFkZXNTcGVjdWxhciA9IG1hdGVyaWFsLm9wYWNpdHlGYWRlc1NwZWN1bGFyO1xuICAgICAgICBsaXRPcHRpb25zLm9wYWNpdHlEaXRoZXIgPSBtYXRlcmlhbC5vcGFjaXR5RGl0aGVyO1xuICAgICAgICBsaXRPcHRpb25zLm9wYWNpdHlTaGFkb3dEaXRoZXIgPSBtYXRlcmlhbC5vcGFjaXR5U2hhZG93RGl0aGVyO1xuXG4gICAgICAgIGxpdE9wdGlvbnMuY3ViZU1hcFByb2plY3Rpb24gPSBDVUJFUFJPSl9OT05FO1xuXG4gICAgICAgIGxpdE9wdGlvbnMuY29uc2VydmVFbmVyZ3kgPSBtYXRlcmlhbC5jb25zZXJ2ZUVuZXJneSAmJiBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX0JMSU5OO1xuICAgICAgICBsaXRPcHRpb25zLnVzZVNwZWN1bGFyID0gbWF0ZXJpYWwuaGFzU3BlY3VsYXI7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IgPSBtYXRlcmlhbC5oYXNTcGVjdWxhcml0eUZhY3RvcjtcbiAgICAgICAgbGl0T3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhciA9IG1hdGVyaWFsLmdneFNwZWN1bGFyO1xuICAgICAgICBsaXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IG1hdGVyaWFsLmZyZXNuZWxNb2RlbDtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VSZWZyYWN0aW9uID0gbWF0ZXJpYWwuaGFzUmVmcmFjdGlvbjtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VDbGVhckNvYXQgPSBtYXRlcmlhbC5oYXNDbGVhckNvYXQ7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlU2hlZW4gPSBtYXRlcmlhbC5oYXNTaGVlbjtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VJcmlkZXNjZW5jZSA9IG1hdGVyaWFsLmhhc0lycmlkZXNjZW5jZTtcbiAgICAgICAgbGl0T3B0aW9ucy51c2VNZXRhbG5lc3MgPSBtYXRlcmlhbC5oYXNNZXRhbG5lc3M7XG4gICAgICAgIGxpdE9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb24gPSBtYXRlcmlhbC5keW5hbWljUmVmcmFjdGlvbjtcblxuICAgICAgICBsaXRPcHRpb25zLnZlcnRleENvbG9ycyA9IGZhbHNlO1xuICAgICAgICBsaXRPcHRpb25zLmxpZ2h0TWFwRW5hYmxlZCA9IG1hdGVyaWFsLmhhc0xpZ2h0aW5nO1xuICAgICAgICBsaXRPcHRpb25zLmRpckxpZ2h0TWFwRW5hYmxlZCA9IG1hdGVyaWFsLmRpckxpZ2h0TWFwO1xuICAgICAgICBsaXRPcHRpb25zLnVzZUhlaWdodHMgPSBtYXRlcmlhbC5oYXNIZWlnaHRzO1xuICAgICAgICBsaXRPcHRpb25zLnVzZU5vcm1hbHMgPSBtYXRlcmlhbC5oYXNOb3JtYWxzO1xuICAgICAgICBsaXRPcHRpb25zLnVzZUNsZWFyQ29hdE5vcm1hbHMgPSBtYXRlcmlhbC5oYXNDbGVhckNvYXROb3JtYWxzO1xuICAgICAgICBsaXRPcHRpb25zLnVzZUFvID0gbWF0ZXJpYWwuaGFzQW87XG4gICAgICAgIGxpdE9wdGlvbnMuZGlmZnVzZU1hcEVuYWJsZWQgPSBtYXRlcmlhbC5oYXNEaWZmdXNlTWFwO1xuICAgIH1cblxuICAgIHN0YXRpYyB1cGRhdGVFbnZPcHRpb25zKGxpdE9wdGlvbnMsIG1hdGVyaWFsLCBzY2VuZSkge1xuICAgICAgICBsaXRPcHRpb25zLmZvZyA9IG1hdGVyaWFsLnVzZUZvZyA/IHNjZW5lLmZvZyA6ICdub25lJztcbiAgICAgICAgbGl0T3B0aW9ucy5nYW1tYSA9IG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCA/IHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA6IEdBTU1BX05PTkU7XG4gICAgICAgIGxpdE9wdGlvbnMudG9uZU1hcCA9IG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCA/IHNjZW5lLnRvbmVNYXBwaW5nIDogLTE7XG4gICAgICAgIGxpdE9wdGlvbnMuZml4U2VhbXMgPSBmYWxzZTtcblxuICAgICAgICAvLyBzb3VyY2Ugb2YgcmVmbGVjdGlvbnNcbiAgICAgICAgaWYgKG1hdGVyaWFsLnVzZVNreWJveCAmJiBzY2VuZS5lbnZBdGxhcyAmJiBzY2VuZS5za3lib3gpIHtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9ICdlbnZBdGxhc0hRJztcbiAgICAgICAgICAgIGxpdE9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nID0gc2NlbmUuZW52QXRsYXMuZW5jb2Rpbmc7XG4gICAgICAgICAgICBsaXRPcHRpb25zLnJlZmxlY3Rpb25DdWJlbWFwRW5jb2RpbmcgPSBzY2VuZS5za3lib3guZW5jb2Rpbmc7XG4gICAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWwudXNlU2t5Ym94ICYmIHNjZW5lLmVudkF0bGFzKSB7XG4gICAgICAgICAgICBsaXRPcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPSAnZW52QXRsYXMnO1xuICAgICAgICAgICAgbGl0T3B0aW9ucy5yZWZsZWN0aW9uRW5jb2RpbmcgPSBzY2VuZS5lbnZBdGxhcy5lbmNvZGluZztcbiAgICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbC51c2VTa3lib3ggJiYgc2NlbmUuc2t5Ym94KSB7XG4gICAgICAgICAgICBsaXRPcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPSAnY3ViZU1hcCc7XG4gICAgICAgICAgICBsaXRPcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZyA9IHNjZW5lLnNreWJveC5lbmNvZGluZztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9IG51bGw7XG4gICAgICAgICAgICBsaXRPcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzb3VyY2Ugb2YgZW52aXJvbm1lbnQgYW1iaWVudCBpcyBhcyBmb2xsb3dzOlxuICAgICAgICBpZiAobWF0ZXJpYWwuYW1iaWVudFNIKSB7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmFtYmllbnRTb3VyY2UgPSAnYW1iaWVudFNIJztcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuYW1iaWVudEVuY29kaW5nID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmIChsaXRPcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgJiYgc2NlbmUuZW52QXRsYXMpIHtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuYW1iaWVudFNvdXJjZSA9ICdlbnZBdGxhcyc7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmFtYmllbnRFbmNvZGluZyA9IHNjZW5lLmVudkF0bGFzLmVuY29kaW5nO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGl0T3B0aW9ucy5hbWJpZW50U291cmNlID0gJ2NvbnN0YW50JztcbiAgICAgICAgICAgIGxpdE9wdGlvbnMuYW1iaWVudEVuY29kaW5nID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhhc1NreWJveCA9ICEhbGl0T3B0aW9ucy5yZWZsZWN0aW9uU291cmNlO1xuICAgICAgICBsaXRPcHRpb25zLnNreWJveEludGVuc2l0eSA9IGhhc1NreWJveCAmJiAoc2NlbmUuc2t5Ym94SW50ZW5zaXR5ICE9PSAxIHx8IHNjZW5lLnBoeXNpY2FsVW5pdHMpO1xuICAgICAgICBsaXRPcHRpb25zLnVzZUN1YmVNYXBSb3RhdGlvbiA9IGhhc1NreWJveCAmJiBzY2VuZS5fc2t5Ym94Um90YXRpb25TaGFkZXJJbmNsdWRlO1xuICAgIH1cblxuICAgIHN0YXRpYyB1cGRhdGVMaWdodGluZ09wdGlvbnMobGl0T3B0aW9ucywgbWF0ZXJpYWwsIG9iakRlZnMsIHNvcnRlZExpZ2h0cykge1xuICAgICAgICBsaXRPcHRpb25zLmxpZ2h0TWFwV2l0aG91dEFtYmllbnQgPSBmYWxzZTtcblxuICAgICAgICBpZiAobWF0ZXJpYWwudXNlTGlnaHRpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0c0ZpbHRlcmVkID0gW107XG4gICAgICAgICAgICBjb25zdCBtYXNrID0gb2JqRGVmcyA/IChvYmpEZWZzID4+IDE2KSA6IE1BU0tfQUZGRUNUX0RZTkFNSUM7XG5cbiAgICAgICAgICAgIC8vIG1hc2sgdG8gc2VsZWN0IGxpZ2h0cyAoZHluYW1pYyB2cyBsaWdodG1hcHBlZCkgd2hlbiB1c2luZyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgICAgIGxpdE9wdGlvbnMubGlnaHRNYXNrRHluYW1pYyA9ICEhKG1hc2sgJiBNQVNLX0FGRkVDVF9EWU5BTUlDKTtcbiAgICAgICAgICAgIGxpdE9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoc29ydGVkTGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgTGl0TWF0ZXJpYWxPcHRpb25zQnVpbGRlci5jb2xsZWN0TGlnaHRzKExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0sIGxpZ2h0c0ZpbHRlcmVkLCBtYXNrKTtcbiAgICAgICAgICAgICAgICBMaXRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyLmNvbGxlY3RMaWdodHMoTElHSFRUWVBFX09NTkksIHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfT01OSV0sIGxpZ2h0c0ZpbHRlcmVkLCBtYXNrKTtcbiAgICAgICAgICAgICAgICBMaXRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyLmNvbGxlY3RMaWdodHMoTElHSFRUWVBFX1NQT1QsIHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIGxpZ2h0c0ZpbHRlcmVkLCBtYXNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpdE9wdGlvbnMubGlnaHRzID0gbGlnaHRzRmlsdGVyZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaXRPcHRpb25zLmxpZ2h0cyA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aCA9PT0gMCB8fCAoKG9iakRlZnMgJiBTSEFERVJERUZfTk9TSEFET1cpICE9PSAwKSkge1xuICAgICAgICAgICAgbGl0T3B0aW9ucy5ub1NoYWRvdyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgY29sbGVjdExpZ2h0cyhsVHlwZSwgbGlnaHRzLCBsaWdodHNGaWx0ZXJlZCwgbWFzaykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5tYXNrICYgbWFzaykge1xuICAgICAgICAgICAgICAgICAgICBsaWdodHNGaWx0ZXJlZC5wdXNoKGxpZ2h0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExpdE1hdGVyaWFsT3B0aW9uc0J1aWxkZXIgfTtcbiJdLCJuYW1lcyI6WyJMaXRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIiwidXBkYXRlIiwibGl0T3B0aW9ucyIsIm1hdGVyaWFsIiwic2NlbmUiLCJvYmpEZWZzIiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInVwZGF0ZVNoYXJlZE9wdGlvbnMiLCJ1cGRhdGVNYXRlcmlhbE9wdGlvbnMiLCJ1cGRhdGVFbnZPcHRpb25zIiwidXBkYXRlTGlnaHRpbmdPcHRpb25zIiwiU0hBREVSX0ZPUldBUkRIRFIiLCJnYW1tYSIsIkdBTU1BX1NSR0JIRFIiLCJ0b25lTWFwIiwiVE9ORU1BUF9MSU5FQVIiLCJjaHVua3MiLCJhbHBoYVRlc3QiLCJibGVuZFR5cGUiLCJzY3JlZW5TcGFjZSIsIlNIQURFUkRFRl9TQ1JFRU5TUEFDRSIsInNraW4iLCJTSEFERVJERUZfU0tJTiIsInVzZUluc3RhbmNpbmciLCJTSEFERVJERUZfSU5TVEFOQ0lORyIsInVzZU1vcnBoUG9zaXRpb24iLCJTSEFERVJERUZfTU9SUEhfUE9TSVRJT04iLCJ1c2VNb3JwaE5vcm1hbCIsIlNIQURFUkRFRl9NT1JQSF9OT1JNQUwiLCJ1c2VNb3JwaFRleHR1cmVCYXNlZCIsIlNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEIiwiaGFzVGFuZ2VudHMiLCJTSEFERVJERUZfVEFOR0VOVFMiLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSIsInVzZUxpZ2h0aW5nIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwiY2x1c3RlcmVkTGlnaHRpbmdDb29raWVzRW5hYmxlZCIsImxpZ2h0aW5nIiwiY29va2llc0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkIiwic2hhZG93c0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodGluZ1NoYWRvd1R5cGUiLCJzaGFkb3dUeXBlIiwiY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCIsImFyZWFMaWdodHNFbmFibGVkIiwidXNlQW1iaWVudFRpbnQiLCJzZXBhcmF0ZUFtYmllbnQiLCJjdXN0b21GcmFnbWVudFNoYWRlciIsInBpeGVsU25hcCIsInNoYWRpbmdNb2RlbCIsImFtYmllbnRTSCIsImZhc3RUYm4iLCJ0d29TaWRlZExpZ2h0aW5nIiwib2NjbHVkZURpcmVjdCIsIm9jY2x1ZGVTcGVjdWxhciIsIm9jY2x1ZGVTcGVjdWxhckZsb2F0Iiwib2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5IiwidXNlTXNkZiIsIm1zZGZUZXh0QXR0cmlidXRlIiwiYWxwaGFUb0NvdmVyYWdlIiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJvcGFjaXR5RGl0aGVyIiwib3BhY2l0eVNoYWRvd0RpdGhlciIsImN1YmVNYXBQcm9qZWN0aW9uIiwiQ1VCRVBST0pfTk9ORSIsImNvbnNlcnZlRW5lcmd5IiwiU1BFQ1VMQVJfQkxJTk4iLCJ1c2VTcGVjdWxhciIsImhhc1NwZWN1bGFyIiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJoYXNTcGVjdWxhcml0eUZhY3RvciIsImVuYWJsZUdHWFNwZWN1bGFyIiwiZ2d4U3BlY3VsYXIiLCJmcmVzbmVsTW9kZWwiLCJ1c2VSZWZyYWN0aW9uIiwiaGFzUmVmcmFjdGlvbiIsInVzZUNsZWFyQ29hdCIsImhhc0NsZWFyQ29hdCIsInVzZVNoZWVuIiwiaGFzU2hlZW4iLCJ1c2VJcmlkZXNjZW5jZSIsImhhc0lycmlkZXNjZW5jZSIsInVzZU1ldGFsbmVzcyIsImhhc01ldGFsbmVzcyIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwiZHluYW1pY1JlZnJhY3Rpb24iLCJ2ZXJ0ZXhDb2xvcnMiLCJsaWdodE1hcEVuYWJsZWQiLCJoYXNMaWdodGluZyIsImRpckxpZ2h0TWFwRW5hYmxlZCIsImRpckxpZ2h0TWFwIiwidXNlSGVpZ2h0cyIsImhhc0hlaWdodHMiLCJ1c2VOb3JtYWxzIiwiaGFzTm9ybWFscyIsInVzZUNsZWFyQ29hdE5vcm1hbHMiLCJoYXNDbGVhckNvYXROb3JtYWxzIiwidXNlQW8iLCJoYXNBbyIsImRpZmZ1c2VNYXBFbmFibGVkIiwiaGFzRGlmZnVzZU1hcCIsImZvZyIsInVzZUZvZyIsInVzZUdhbW1hVG9uZW1hcCIsImdhbW1hQ29ycmVjdGlvbiIsIkdBTU1BX05PTkUiLCJ0b25lTWFwcGluZyIsImZpeFNlYW1zIiwidXNlU2t5Ym94IiwiZW52QXRsYXMiLCJza3lib3giLCJyZWZsZWN0aW9uU291cmNlIiwicmVmbGVjdGlvbkVuY29kaW5nIiwiZW5jb2RpbmciLCJyZWZsZWN0aW9uQ3ViZW1hcEVuY29kaW5nIiwiYW1iaWVudFNvdXJjZSIsImFtYmllbnRFbmNvZGluZyIsImhhc1NreWJveCIsInNreWJveEludGVuc2l0eSIsInBoeXNpY2FsVW5pdHMiLCJ1c2VDdWJlTWFwUm90YXRpb24iLCJfc2t5Ym94Um90YXRpb25TaGFkZXJJbmNsdWRlIiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsImxpZ2h0c0ZpbHRlcmVkIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJsaWdodE1hc2tEeW5hbWljIiwiY29sbGVjdExpZ2h0cyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJsaWdodHMiLCJsZW5ndGgiLCJTSEFERVJERUZfTk9TSEFET1ciLCJub1NoYWRvdyIsImxUeXBlIiwiaSIsImxpZ2h0IiwiZW5hYmxlZCIsInB1c2giXSwibWFwcGluZ3MiOiI7O0FBRUEsTUFBTUEseUJBQXlCLENBQUM7QUFDNUIsRUFBQSxPQUFPQyxNQUFNQSxDQUFDQyxVQUFVLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFQyxPQUFPLEVBQUVDLElBQUksRUFBRUMsWUFBWSxFQUFFO0FBQ3BFUCxJQUFBQSx5QkFBeUIsQ0FBQ1EsbUJBQW1CLENBQUNOLFVBQVUsRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUVDLE9BQU8sRUFBRUMsSUFBSSxDQUFDLENBQUE7QUFDekZOLElBQUFBLHlCQUF5QixDQUFDUyxxQkFBcUIsQ0FBQ1AsVUFBVSxFQUFFQyxRQUFRLENBQUMsQ0FBQTtJQUNyRUgseUJBQXlCLENBQUNVLGdCQUFnQixDQUFDUixVQUFVLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxD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
