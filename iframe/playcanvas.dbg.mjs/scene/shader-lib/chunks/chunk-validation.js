import { CHUNKAPI_1_57, CHUNKAPI_1_60, CHUNKAPI_1_55, CHUNKAPI_1_62, CHUNKAPI_1_65, CHUNKAPI_1_51, CHUNKAPI_1_56 } from '../../../platform/graphics/constants.js';
import { Debug } from '../../../core/debug.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
  // frontend
  aoPS: CHUNKAPI_1_57,
  clearCoatPS: CHUNKAPI_1_57,
  clearCoatGlossPS: CHUNKAPI_1_60,
  clearCoatNormalPS: CHUNKAPI_1_57,
  diffusePS: CHUNKAPI_1_57,
  diffuseDetailMapPS: CHUNKAPI_1_57,
  emissivePS: CHUNKAPI_1_57,
  glossPS: CHUNKAPI_1_60,
  lightmapDirPS: CHUNKAPI_1_55,
  lightmapSinglePS: CHUNKAPI_1_55,
  metalnessPS: CHUNKAPI_1_57,
  normalMapPS: CHUNKAPI_1_57,
  normalDetailMapPS: CHUNKAPI_1_57,
  opacityPS: CHUNKAPI_1_57,
  parallaxPS: CHUNKAPI_1_57,
  sheenPS: CHUNKAPI_1_57,
  sheenGlossPS: CHUNKAPI_1_60,
  specularPS: CHUNKAPI_1_57,
  specularityFactorPS: CHUNKAPI_1_57,
  thicknessPS: CHUNKAPI_1_57,
  transmissionPS: CHUNKAPI_1_57,
  // backend
  normalVertexPS: CHUNKAPI_1_55,
  startPS: CHUNKAPI_1_55,
  ambientConstantPS: CHUNKAPI_1_62,
  ambientEnvPS: CHUNKAPI_1_62,
  ambientSHPS: CHUNKAPI_1_62,
  aoDiffuseOccPS: CHUNKAPI_1_62,
  aoSpecOccPS: CHUNKAPI_1_62,
  aoSpecOccConstPS: CHUNKAPI_1_62,
  aoSpecOccConstSimplePS: CHUNKAPI_1_62,
  aoSpecOccSimplePS: CHUNKAPI_1_62,
  clusteredLightPS: CHUNKAPI_1_62,
  clusteredLightShadowPS: CHUNKAPI_1_62,
  combinePS: CHUNKAPI_1_62,
  falloffInvSquaredPS: CHUNKAPI_1_62,
  falloffLinearPS: CHUNKAPI_1_62,
  lightDiffuseLambertPS: CHUNKAPI_1_62,
  lightSheenPS: CHUNKAPI_1_62,
  lightSpecularAnisoGGXPS: CHUNKAPI_1_62,
  lightSpecularBlinnPS: CHUNKAPI_1_62,
  lightSpecularPhongPS: CHUNKAPI_1_62,
  ltcPS: CHUNKAPI_1_62,
  reflDirPS: CHUNKAPI_1_62,
  reflDirAnisoPS: CHUNKAPI_1_62,
  reflectionCCPS: CHUNKAPI_1_62,
  reflectionCubePS: CHUNKAPI_1_62,
  reflectionEnvPS: CHUNKAPI_1_62,
  reflectionEnvHQPS: CHUNKAPI_1_62,
  reflectionSheenPS: CHUNKAPI_1_62,
  reflectionSpherePS: CHUNKAPI_1_62,
  shadowCommonPS: CHUNKAPI_1_62,
  shadowCoordPS: CHUNKAPI_1_62,
  shadowCoordPerspZBufferPS: CHUNKAPI_1_62,
  shadowEVSMPS: CHUNKAPI_1_62,
  shadowEVSMnPS: CHUNKAPI_1_62,
  shadowStandardPS: CHUNKAPI_1_62,
  shadowStandardGL2PS: CHUNKAPI_1_62,
  shadowVSM8PS: CHUNKAPI_1_62,
  spotPS: CHUNKAPI_1_62,
  TBNPS: CHUNKAPI_1_62,
  TBNObjectSpacePS: CHUNKAPI_1_62,
  TBNderivativePS: CHUNKAPI_1_62,
  TBNfastPS: CHUNKAPI_1_62,
  endPS: CHUNKAPI_1_65,
  metalnessModulatePS: CHUNKAPI_1_65,
  outputAlphaPS: CHUNKAPI_1_65,
  outputAlphaPremulPS: CHUNKAPI_1_65,
  fresnelSchlickPS: CHUNKAPI_1_65,
  iridescenceDiffractionPS: CHUNKAPI_1_65,
  lightmapAddPS: CHUNKAPI_1_65,
  lightmapDirAddPS: CHUNKAPI_1_65,
  refractionCubePS: CHUNKAPI_1_65,
  refractionDynamicPS: CHUNKAPI_1_65
};

// removed
const removedChunks = {
  ambientPrefilteredCubePS: CHUNKAPI_1_51,
  ambientPrefilteredCubeLodPS: CHUNKAPI_1_51,
  dpAtlasQuadPS: CHUNKAPI_1_51,
  genParaboloidPS: CHUNKAPI_1_51,
  prefilterCubemapPS: CHUNKAPI_1_51,
  reflectionDpAtlasPS: CHUNKAPI_1_51,
  reflectionPrefilteredCubePS: CHUNKAPI_1_51,
  reflectionPrefilteredCubeLodPS: CHUNKAPI_1_51,
  refractionPS: CHUNKAPI_1_56,
  combineClearCoatPS: CHUNKAPI_1_56,
  combineDiffusePS: CHUNKAPI_1_56,
  combineDiffuseSpecularPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoReflPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoReflSeparateAmbientPS: CHUNKAPI_1_56,
  combineDiffuseSpecularOldPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoConservePS: CHUNKAPI_1_55,
  lightmapSingleVertPS: CHUNKAPI_1_55,
  normalMapFastPS: CHUNKAPI_1_55,
  specularAaNonePS: CHUNKAPI_1_55,
  specularAaToksvigPS: CHUNKAPI_1_55,
  specularAaToksvigFastPS: CHUNKAPI_1_55
};

// compare two "major.minor" semantic version strings and return true if a is a smaller version than b.
const semverLess = (a, b) => {
  const aver = a.split('.').map(t => parseInt(t, 10));
  const bver = b.split('.').map(t => parseInt(t, 10));
  return aver[0] < bver[0] || aver[0] === bver[0] && aver[1] < bver[1];
};

// validate user chunks
const validateUserChunks = userChunks => {
  const userAPIVersion = userChunks.APIVersion;
  for (const chunkName in userChunks) {
    if (chunkName === 'APIVersion') {
      continue;
    }
    if (!shaderChunks.hasOwnProperty(chunkName)) {
      const removedVersion = removedChunks[chunkName];
      if (removedVersion) {
        Debug.warnOnce(`Shader chunk '${chunkName}' was removed in API ${removedVersion} and is no longer supported.`);
      } else {
        Debug.warnOnce(`Shader chunk '${chunkName}' is not supported.`);
      }
    } else {
      const engineAPIVersion = chunkVersions[chunkName];
      const chunkIsOutdated = engineAPIVersion && (!userAPIVersion || semverLess(userAPIVersion, engineAPIVersion));
      if (chunkIsOutdated) {
        Debug.warnOnce(`Shader chunk '${chunkName}' is API version ${engineAPIVersion}, but the supplied chunk is version ${userAPIVersion || '-'}. Please update to the latest API: https://developer.playcanvas.com/user-manual/graphics/shader-chunk-migrations/`);
      }
    }
  }
};

export { validateUserChunks };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2h1bmstdmFsaWRhdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rLXZhbGlkYXRpb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ0hVTktBUElfMV81MSwgQ0hVTktBUElfMV81NSwgQ0hVTktBUElfMV81NiwgQ0hVTktBUElfMV81NywgQ0hVTktBUElfMV82MCwgQ0hVTktBUElfMV82MiwgQ0hVTktBUElfMV82NSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi9jaHVua3MuanMnO1xuXG5jb25zdCBjaHVua1ZlcnNpb25zID0ge1xuICAgIC8vIGZyb250ZW5kXG4gICAgYW9QUzogQ0hVTktBUElfMV81NyxcbiAgICBjbGVhckNvYXRQUzogQ0hVTktBUElfMV81NyxcbiAgICBjbGVhckNvYXRHbG9zc1BTOiBDSFVOS0FQSV8xXzYwLFxuICAgIGNsZWFyQ29hdE5vcm1hbFBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIGRpZmZ1c2VQUzogQ0hVTktBUElfMV81NyxcbiAgICBkaWZmdXNlRGV0YWlsTWFwUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgZW1pc3NpdmVQUzogQ0hVTktBUElfMV81NyxcbiAgICBnbG9zc1BTOiBDSFVOS0FQSV8xXzYwLFxuICAgIGxpZ2h0bWFwRGlyUFM6IENIVU5LQVBJXzFfNTUsXG4gICAgbGlnaHRtYXBTaW5nbGVQUzogQ0hVTktBUElfMV81NSxcbiAgICBtZXRhbG5lc3NQUzogQ0hVTktBUElfMV81NyxcbiAgICBub3JtYWxNYXBQUzogQ0hVTktBUElfMV81NyxcbiAgICBub3JtYWxEZXRhaWxNYXBQUzogQ0hVTktBUElfMV81NyxcbiAgICBvcGFjaXR5UFM6IENIVU5LQVBJXzFfNTcsXG4gICAgcGFyYWxsYXhQUzogQ0hVTktBUElfMV81NyxcbiAgICBzaGVlblBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIHNoZWVuR2xvc3NQUzogQ0hVTktBUElfMV82MCxcbiAgICBzcGVjdWxhclBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIHNwZWN1bGFyaXR5RmFjdG9yUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgdGhpY2tuZXNzUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgdHJhbnNtaXNzaW9uUFM6IENIVU5LQVBJXzFfNTcsXG5cbiAgICAvLyBiYWNrZW5kXG4gICAgbm9ybWFsVmVydGV4UFM6IENIVU5LQVBJXzFfNTUsXG4gICAgc3RhcnRQUzogQ0hVTktBUElfMV81NSxcblxuICAgIGFtYmllbnRDb25zdGFudFBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGFtYmllbnRFbnZQUzogQ0hVTktBUElfMV82MixcbiAgICBhbWJpZW50U0hQUzogQ0hVTktBUElfMV82MixcbiAgICBhb0RpZmZ1c2VPY2NQUzogQ0hVTktBUElfMV82MixcbiAgICBhb1NwZWNPY2NQUzogQ0hVTktBUElfMV82MixcbiAgICBhb1NwZWNPY2NDb25zdFBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGFvU3BlY09jY0NvbnN0U2ltcGxlUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgYW9TcGVjT2NjU2ltcGxlUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgY2x1c3RlcmVkTGlnaHRQUzogQ0hVTktBUElfMV82MixcbiAgICBjbHVzdGVyZWRMaWdodFNoYWRvd1BTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGNvbWJpbmVQUzogQ0hVTktBUElfMV82MixcbiAgICBmYWxsb2ZmSW52U3F1YXJlZFBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGZhbGxvZmZMaW5lYXJQUzogQ0hVTktBUElfMV82MixcbiAgICBsaWdodERpZmZ1c2VMYW1iZXJ0UFM6IENIVU5LQVBJXzFfNjIsXG4gICAgbGlnaHRTaGVlblBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGxpZ2h0U3BlY3VsYXJBbmlzb0dHWFBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGxpZ2h0U3BlY3VsYXJCbGlublBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGxpZ2h0U3BlY3VsYXJQaG9uZ1BTOiBDSFVOS0FQSV8xXzYyLFxuICAgIGx0Y1BTOiBDSFVOS0FQSV8xXzYyLFxuICAgIHJlZmxEaXJQUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsRGlyQW5pc29QUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsZWN0aW9uQ0NQUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsZWN0aW9uQ3ViZVBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIHJlZmxlY3Rpb25FbnZQUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsZWN0aW9uRW52SFFQUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsZWN0aW9uU2hlZW5QUzogQ0hVTktBUElfMV82MixcbiAgICByZWZsZWN0aW9uU3BoZXJlUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgc2hhZG93Q29tbW9uUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgc2hhZG93Q29vcmRQUzogQ0hVTktBUElfMV82MixcbiAgICBzaGFkb3dDb29yZFBlcnNwWkJ1ZmZlclBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIHNoYWRvd0VWU01QUzogQ0hVTktBUElfMV82MixcbiAgICBzaGFkb3dFVlNNblBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIHNoYWRvd1N0YW5kYXJkUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgc2hhZG93U3RhbmRhcmRHTDJQUzogQ0hVTktBUElfMV82MixcbiAgICBzaGFkb3dWU004UFM6IENIVU5LQVBJXzFfNjIsXG4gICAgc3BvdFBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIFRCTlBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIFRCTk9iamVjdFNwYWNlUFM6IENIVU5LQVBJXzFfNjIsXG4gICAgVEJOZGVyaXZhdGl2ZVBTOiBDSFVOS0FQSV8xXzYyLFxuICAgIFRCTmZhc3RQUzogQ0hVTktBUElfMV82MixcblxuICAgIGVuZFBTOiBDSFVOS0FQSV8xXzY1LFxuICAgIG1ldGFsbmVzc01vZHVsYXRlUFM6IENIVU5LQVBJXzFfNjUsXG4gICAgb3V0cHV0QWxwaGFQUzogQ0hVTktBUElfMV82NSxcbiAgICBvdXRwdXRBbHBoYVByZW11bFBTOiBDSFVOS0FQSV8xXzY1LFxuICAgIGZyZXNuZWxTY2hsaWNrUFM6IENIVU5LQVBJXzFfNjUsXG4gICAgaXJpZGVzY2VuY2VEaWZmcmFjdGlvblBTOiBDSFVOS0FQSV8xXzY1LFxuICAgIGxpZ2h0bWFwQWRkUFM6IENIVU5LQVBJXzFfNjUsXG4gICAgbGlnaHRtYXBEaXJBZGRQUzogQ0hVTktBUElfMV82NSxcbiAgICByZWZyYWN0aW9uQ3ViZVBTOiBDSFVOS0FQSV8xXzY1LFxuICAgIHJlZnJhY3Rpb25EeW5hbWljUFM6IENIVU5LQVBJXzFfNjVcbn07XG5cbi8vIHJlbW92ZWRcbmNvbnN0IHJlbW92ZWRDaHVua3MgPSB7XG4gICAgYW1iaWVudFByZWZpbHRlcmVkQ3ViZVBTOiBDSFVOS0FQSV8xXzUxLFxuICAgIGFtYmllbnRQcmVmaWx0ZXJlZEN1YmVMb2RQUzogQ0hVTktBUElfMV81MSxcbiAgICBkcEF0bGFzUXVhZFBTOiBDSFVOS0FQSV8xXzUxLFxuICAgIGdlblBhcmFib2xvaWRQUzogQ0hVTktBUElfMV81MSxcbiAgICBwcmVmaWx0ZXJDdWJlbWFwUFM6IENIVU5LQVBJXzFfNTEsXG4gICAgcmVmbGVjdGlvbkRwQXRsYXNQUzogQ0hVTktBUElfMV81MSxcbiAgICByZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlUFM6IENIVU5LQVBJXzFfNTEsXG4gICAgcmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZUxvZFBTOiBDSFVOS0FQSV8xXzUxLFxuICAgIHJlZnJhY3Rpb25QUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lQ2xlYXJDb2F0UFM6IENIVU5LQVBJXzFfNTYsXG4gICAgY29tYmluZURpZmZ1c2VQUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lRGlmZnVzZVNwZWN1bGFyUFM6IENIVU5LQVBJXzFfNTYsXG4gICAgY29tYmluZURpZmZ1c2VTcGVjdWxhck5vUmVmbFBTOiBDSFVOS0FQSV8xXzU2LFxuICAgIGNvbWJpbmVEaWZmdXNlU3BlY3VsYXJOb1JlZmxTZXBhcmF0ZUFtYmllbnRQUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lRGlmZnVzZVNwZWN1bGFyT2xkUFM6IENIVU5LQVBJXzFfNTYsXG4gICAgY29tYmluZURpZmZ1c2VTcGVjdWxhck5vQ29uc2VydmVQUzogQ0hVTktBUElfMV81NSxcbiAgICBsaWdodG1hcFNpbmdsZVZlcnRQUzogQ0hVTktBUElfMV81NSxcbiAgICBub3JtYWxNYXBGYXN0UFM6IENIVU5LQVBJXzFfNTUsXG4gICAgc3BlY3VsYXJBYU5vbmVQUzogQ0hVTktBUElfMV81NSxcbiAgICBzcGVjdWxhckFhVG9rc3ZpZ1BTOiBDSFVOS0FQSV8xXzU1LFxuICAgIHNwZWN1bGFyQWFUb2tzdmlnRmFzdFBTOiBDSFVOS0FQSV8xXzU1XG59O1xuXG4vLyBjb21wYXJlIHR3byBcIm1ham9yLm1pbm9yXCIgc2VtYW50aWMgdmVyc2lvbiBzdHJpbmdzIGFuZCByZXR1cm4gdHJ1ZSBpZiBhIGlzIGEgc21hbGxlciB2ZXJzaW9uIHRoYW4gYi5cbmNvbnN0IHNlbXZlckxlc3MgPSAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGF2ZXIgPSBhLnNwbGl0KCcuJykubWFwKHQgPT4gcGFyc2VJbnQodCwgMTApKTtcbiAgICBjb25zdCBidmVyID0gYi5zcGxpdCgnLicpLm1hcCh0ID0+IHBhcnNlSW50KHQsIDEwKSk7XG4gICAgcmV0dXJuIChhdmVyWzBdIDwgYnZlclswXSkgfHwgKChhdmVyWzBdID09PSBidmVyWzBdKSAmJiAoYXZlclsxXSA8IGJ2ZXJbMV0pKTtcbn07XG5cbi8vIHZhbGlkYXRlIHVzZXIgY2h1bmtzXG5jb25zdCB2YWxpZGF0ZVVzZXJDaHVua3MgPSAodXNlckNodW5rcykgPT4ge1xuICAgIGNvbnN0IHVzZXJBUElWZXJzaW9uID0gdXNlckNodW5rcy5BUElWZXJzaW9uO1xuICAgIGZvciAoY29uc3QgY2h1bmtOYW1lIGluIHVzZXJDaHVua3MpIHtcbiAgICAgICAgaWYgKGNodW5rTmFtZSA9PT0gJ0FQSVZlcnNpb24nKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2hhZGVyQ2h1bmtzLmhhc093blByb3BlcnR5KGNodW5rTmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbW92ZWRWZXJzaW9uID0gcmVtb3ZlZENodW5rc1tjaHVua05hbWVdO1xuICAgICAgICAgICAgaWYgKHJlbW92ZWRWZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYFNoYWRlciBjaHVuayAnJHtjaHVua05hbWV9JyB3YXMgcmVtb3ZlZCBpbiBBUEkgJHtyZW1vdmVkVmVyc2lvbn0gYW5kIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKGBTaGFkZXIgY2h1bmsgJyR7Y2h1bmtOYW1lfScgaXMgbm90IHN1cHBvcnRlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGVuZ2luZUFQSVZlcnNpb24gPSBjaHVua1ZlcnNpb25zW2NodW5rTmFtZV07XG4gICAgICAgICAgICBjb25zdCBjaHVua0lzT3V0ZGF0ZWQgPSBlbmdpbmVBUElWZXJzaW9uICYmICghdXNlckFQSVZlcnNpb24gfHwgc2VtdmVyTGVzcyh1c2VyQVBJVmVyc2lvbiwgZW5naW5lQVBJVmVyc2lvbikpO1xuXG4gICAgICAgICAgICBpZiAoY2h1bmtJc091dGRhdGVkKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYFNoYWRlciBjaHVuayAnJHtjaHVua05hbWV9JyBpcyBBUEkgdmVyc2lvbiAke2VuZ2luZUFQSVZlcnNpb259LCBidXQgdGhlIHN1cHBsaWVkIGNodW5rIGlzIHZlcnNpb24gJHt1c2VyQVBJVmVyc2lvbiB8fCAnLSd9LiBQbGVhc2UgdXBkYXRlIHRvIHRoZSBsYXRlc3QgQVBJOiBodHRwczovL2RldmVsb3Blci5wbGF5Y2FudmFzLmNvbS91c2VyLW1hbnVhbC9ncmFwaGljcy9zaGFkZXItY2h1bmstbWlncmF0aW9ucy9gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbmV4cG9ydCB7XG4gICAgdmFsaWRhdGVVc2VyQ2h1bmtzXG59O1xuIl0sIm5hbWVzIjpbImNodW5rVmVyc2lvbnMiLCJhb1BTIiwiQ0hVTktBUElfMV81NyIsImNsZWFyQ29hdFBTIiwiY2xlYXJDb2F0R2xvc3NQUyIsIkNIVU5LQVBJXzFfNjAiLCJjbGVhckNvYXROb3JtYWxQUyIsImRpZmZ1c2VQUyIsImRpZmZ1c2VEZXRhaWxNYXBQUyIsImVtaXNzaXZlUFMiLCJnbG9zc1BTIiwibGlnaHRtYXBEaXJQUyIsIkNIVU5LQVBJXzFfNTUiLCJsaWdodG1hcFNpbmdsZVBTIiwibWV0YWxuZXNzUFMiLCJub3JtYWxNYXBQUyIsIm5vcm1hbERldGFpbE1hcFBTIiwib3BhY2l0eVBTIiwicGFyYWxsYXhQUyIsInNoZWVuUFMiLCJzaGVlbkdsb3NzUFMiLCJzcGVjdWxhclBTIiwic3BlY3VsYXJpdHlGYWN0b3JQUyIsInRoaWNrbmVzc1BTIiwidHJhbnNtaXNzaW9uUFMiLCJub3JtYWxWZXJ0ZXhQUyIsInN0YXJ0UFMiLCJhbWJpZW50Q29uc3RhbnRQUyIsIkNIVU5LQVBJXzFfNjIiLCJhbWJpZW50RW52UFMiLCJhbWJpZW50U0hQUyIsImFvRGlmZnVzZU9jY1BTIiwiYW9TcGVjT2NjUFMiLCJhb1NwZWNPY2NDb25zdFBTIiwiYW9TcGVjT2NjQ29uc3RTaW1wbGVQUyIsImFvU3BlY09jY1NpbXBsZVBTIiwiY2x1c3RlcmVkTGlnaHRQUyIsImNsdXN0ZXJlZExpZ2h0U2hhZG93UFMiLCJjb21iaW5lUFMiLCJmYWxsb2ZmSW52U3F1YXJlZFBTIiwiZmFsbG9mZkxpbmVhclBTIiwibGlnaHREaWZmdXNlTGFtYmVydFBTIiwibGlnaHRTaGVlblBTIiwibGlnaHRTcGVjdWxhckFuaXNvR0dYUFMiLCJsaWdodFNwZWN1bGFyQmxpbm5QUyIsImxpZ2h0U3BlY3VsYXJQaG9uZ1BTIiwibHRjUFMiLCJyZWZsRGlyUFMiLCJyZWZsRGlyQW5pc29QUyIsInJlZmxlY3Rpb25DQ1BTIiwicmVmbGVjdGlvbkN1YmVQUyIsInJlZmxlY3Rpb25FbnZQUyIsInJlZmxlY3Rpb25FbnZIUVBTIiwicmVmbGVjdGlvblNoZWVuUFMiLCJyZWZsZWN0aW9uU3BoZXJlUFMiLCJzaGFkb3dDb21tb25QUyIsInNoYWRvd0Nvb3JkUFMiLCJzaGFkb3dDb29yZFBlcnNwWkJ1ZmZlclBTIiwic2hhZG93RVZTTVBTIiwic2hhZG93RVZTTW5QUyIsInNoYWRvd1N0YW5kYXJkUFMiLCJzaGFkb3dTdGFuZGFyZEdMMlBTIiwic2hhZG93VlNNOFBTIiwic3BvdFBTIiwiVEJOUFMiLCJUQk5PYmplY3RTcGFjZVBTIiwiVEJOZGVyaXZhdGl2ZVBTIiwiVEJOZmFzdFBTIiwiZW5kUFMiLCJDSFVOS0FQSV8xXzY1IiwibWV0YWxuZXNzTW9kdWxhdGVQUyIsIm91dHB1dEFscGhhUFMiLCJvdXRwdXRBbHBoYVByZW11bFBTIiwiZnJlc25lbFNjaGxpY2tQUyIsImlyaWRlc2NlbmNlRGlmZnJhY3Rpb25QUyIsImxpZ2h0bWFwQWRkUFMiLCJsaWdodG1hcERpckFkZFBTIiwicmVmcmFjdGlvbkN1YmVQUyIsInJlZnJhY3Rpb25EeW5hbWljUFMiLCJyZW1vdmVkQ2h1bmtzIiwiYW1iaWVudFByZWZpbHRlcmVkQ3ViZVBTIiwiQ0hVTktBUElfMV81MSIsImFtYmllbnRQcmVmaWx0ZXJlZEN1YmVMb2RQUyIsImRwQXRsYXNRdWFkUFMiLCJnZW5QYXJhYm9sb2lkUFMiLCJwcmVmaWx0ZXJDdWJlbWFwUFMiLCJyZWZsZWN0aW9uRHBBdGxhc1BTIiwicmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZVBTIiwicmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZUxvZFBTIiwicmVmcmFjdGlvblBTIiwiQ0hVTktBUElfMV81NiIsImNvbWJpbmVDbGVhckNvYXRQUyIsImNvbWJpbmVEaWZmdXNlUFMiLCJjb21iaW5lRGlmZnVzZVNwZWN1bGFyUFMiLCJjb21iaW5lRGlmZnVzZVNwZWN1bGFyTm9SZWZsUFMiLCJjb21iaW5lRGlmZnVzZVNwZWN1bGFyTm9SZWZsU2VwYXJhdGVBbWJpZW50UFMiLCJjb21iaW5lRGlmZnVzZVNwZWN1bGFyT2xkUFMiLCJjb21iaW5lRGlmZnVzZVNwZWN1bGFyTm9Db25zZXJ2ZVBTIiwibGlnaHRtYXBTaW5nbGVWZXJ0UFMiLCJub3JtYWxNYXBGYXN0UFMiLCJzcGVjdWxhckFhTm9uZVBTIiwic3BlY3VsYXJBYVRva3N2aWdQUyIsInNwZWN1bGFyQWFUb2tzdmlnRmFzdFBTIiwic2VtdmVyTGVzcyIsImEiLCJiIiwiYXZlciIsInNwbGl0IiwibWFwIiwidCIsInBhcnNlSW50IiwiYnZlciIsInZhbGlkYXRlVXNlckNodW5rcyIsInVzZXJDaHVua3MiLCJ1c2VyQVBJVmVyc2lvbiIsIkFQSVZlcnNpb24iLCJjaHVua05hbWUiLCJzaGFkZXJDaHVua3MiLCJoYXNPd25Qcm9wZXJ0eSIsInJlbW92ZWRWZXJzaW9uIiwiRGVidWciLCJ3YXJuT25jZSIsImVuZ2luZUFQSVZlcnNpb24iLCJjaHVua0lzT3V0ZGF0ZWQiXSwibWFwcGluZ3MiOiI7Ozs7QUFJQSxNQUFNQSxhQUFhLEdBQUc7QUFDbEI7QUFDQUMsRUFBQUEsSUFBSSxFQUFFQyxhQUFhO0FBQ25CQyxFQUFBQSxXQUFXLEVBQUVELGFBQWE7QUFDMUJFLEVBQUFBLGdCQUFnQixFQUFFQyxhQUFhO0FBQy9CQyxFQUFBQSxpQkFBaUIsRUFBRUosYUFBYTtBQUNoQ0ssRUFBQUEsU0FBUyxFQUFFTCxhQUFhO0FBQ3hCTSxFQUFBQSxrQkFBa0IsRUFBRU4sYUFBYTtBQUNqQ08sRUFBQUEsVUFBVSxFQUFFUCxh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
