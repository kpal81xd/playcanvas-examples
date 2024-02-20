var bilateralDeNoisePS = /* glsl */`
// bilateral filter, based on https://www.shadertoy.com/view/4dfGDH# and
// http://people.csail.mit.edu/sparis/bf_course/course_notes.pdf

// A bilateral filter is a non-linear, edge-preserving, and noise-reducing smoothing filter for images.
// It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.
// This weight can be based on a Gaussian distribution. Crucially, the weights depend not only on
// Euclidean distance of pixels, but also on the radiometric differences (e.g., range differences, such
// as color intensity, depth distance, etc.). This preserves sharp edges.

float normpdf3(in vec3 v, in float sigma) {
    return 0.39894 * exp(-0.5 * dot(v, v) / (sigma * sigma)) / sigma;
}

vec3 decodeRGBM(vec4 rgbm) {
    vec3 color = (8.0 * rgbm.a) * rgbm.rgb;
    return color * color;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 encodeRGBM(vec3 color) { // modified RGBM
    vec4 encoded;
    encoded.rgb = pow(color.rgb, vec3(0.5));
    encoded.rgb *= 1.0 / 8.0;

    encoded.a = saturate( max( max( encoded.r, encoded.g ), max( encoded.b, 1.0 / 255.0 ) ) );
    encoded.a = ceil(encoded.a * 255.0) / 255.0;

    encoded.rgb /= encoded.a;
    return encoded;
}

// filter size
#define MSIZE 15

varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;
uniform vec2 sigmas;
uniform float bZnorm;
uniform float kernel[MSIZE];

void main(void) {
    
    vec4 pixelRgbm = texture2DLodEXT(source, vUv0, 0.0);

    // lightmap specific optimization - skip pixels that were not baked
    // this also allows dilate filter that work on the output of this to work correctly, as it depends on .a being zero
    // to dilate, which the following blur filter would otherwise modify
    if (pixelRgbm.a <= 0.0) {
        gl_FragColor = pixelRgbm;
        return ;
    }

    // range sigma - controls blurriness based on a pixel distance
    float sigma = sigmas.x;

    // domain sigma - controls blurriness based on a pixel similarity (to preserve edges)
    float bSigma = sigmas.y;

    vec3 pixelHdr = decodeRGBM(pixelRgbm);
    vec3 accumulatedHdr = vec3(0.0);
    float accumulatedFactor = 0.0;

    // read out the texels
    const int kSize = (MSIZE-1)/2;
    for (int i = -kSize; i <= kSize; ++i) {
        for (int j = -kSize; j <= kSize; ++j) {
            
            // sample the pixel with offset
            vec2 coord = vUv0 + vec2(float(i), float(j)) * pixelOffset;
            vec4 rgbm = texture2DLodEXT(source, coord, 0.0);

            // lightmap - only use baked pixels
            if (rgbm.a > 0.0) {
                vec3 hdr = decodeRGBM(rgbm);

                // bilateral factors
                float factor = kernel[kSize + j] * kernel[kSize + i];
                factor *= normpdf3(hdr - pixelHdr, bSigma) * bZnorm;

                // accumulate
                accumulatedHdr += factor * hdr;
                accumulatedFactor += factor;
            }
        }
    }

    gl_FragColor = encodeRGBM(accumulatedHdr / accumulatedFactor);
}
`;

export { bilateralDeNoisePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmlsYXRlcmFsRGVOb2lzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpZ2h0bWFwcGVyL2ZyYWcvYmlsYXRlcmFsRGVOb2lzZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gYmlsYXRlcmFsIGZpbHRlciwgYmFzZWQgb24gaHR0cHM6Ly93d3cuc2hhZGVydG95LmNvbS92aWV3LzRkZkdESCMgYW5kXG4vLyBodHRwOi8vcGVvcGxlLmNzYWlsLm1pdC5lZHUvc3BhcmlzL2JmX2NvdXJzZS9jb3Vyc2Vfbm90ZXMucGRmXG5cbi8vIEEgYmlsYXRlcmFsIGZpbHRlciBpcyBhIG5vbi1saW5lYXIsIGVkZ2UtcHJlc2VydmluZywgYW5kIG5vaXNlLXJlZHVjaW5nIHNtb290aGluZyBmaWx0ZXIgZm9yIGltYWdlcy5cbi8vIEl0IHJlcGxhY2VzIHRoZSBpbnRlbnNpdHkgb2YgZWFjaCBwaXhlbCB3aXRoIGEgd2VpZ2h0ZWQgYXZlcmFnZSBvZiBpbnRlbnNpdHkgdmFsdWVzIGZyb20gbmVhcmJ5IHBpeGVscy5cbi8vIFRoaXMgd2VpZ2h0IGNhbiBiZSBiYXNlZCBvbiBhIEdhdXNzaWFuIGRpc3RyaWJ1dGlvbi4gQ3J1Y2lhbGx5LCB0aGUgd2VpZ2h0cyBkZXBlbmQgbm90IG9ubHkgb25cbi8vIEV1Y2xpZGVhbiBkaXN0YW5jZSBvZiBwaXhlbHMsIGJ1dCBhbHNvIG9uIHRoZSByYWRpb21ldHJpYyBkaWZmZXJlbmNlcyAoZS5nLiwgcmFuZ2UgZGlmZmVyZW5jZXMsIHN1Y2hcbi8vIGFzIGNvbG9yIGludGVuc2l0eSwgZGVwdGggZGlzdGFuY2UsIGV0Yy4pLiBUaGlzIHByZXNlcnZlcyBzaGFycCBlZGdlcy5cblxuZmxvYXQgbm9ybXBkZjMoaW4gdmVjMyB2LCBpbiBmbG9hdCBzaWdtYSkge1xuICAgIHJldHVybiAwLjM5ODk0ICogZXhwKC0wLjUgKiBkb3QodiwgdikgLyAoc2lnbWEgKiBzaWdtYSkpIC8gc2lnbWE7XG59XG5cbnZlYzMgZGVjb2RlUkdCTSh2ZWM0IHJnYm0pIHtcbiAgICB2ZWMzIGNvbG9yID0gKDguMCAqIHJnYm0uYSkgKiByZ2JtLnJnYjtcbiAgICByZXR1cm4gY29sb3IgKiBjb2xvcjtcbn1cblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbnZlYzQgZW5jb2RlUkdCTSh2ZWMzIGNvbG9yKSB7IC8vIG1vZGlmaWVkIFJHQk1cbiAgICB2ZWM0IGVuY29kZWQ7XG4gICAgZW5jb2RlZC5yZ2IgPSBwb3coY29sb3IucmdiLCB2ZWMzKDAuNSkpO1xuICAgIGVuY29kZWQucmdiICo9IDEuMCAvIDguMDtcblxuICAgIGVuY29kZWQuYSA9IHNhdHVyYXRlKCBtYXgoIG1heCggZW5jb2RlZC5yLCBlbmNvZGVkLmcgKSwgbWF4KCBlbmNvZGVkLmIsIDEuMCAvIDI1NS4wICkgKSApO1xuICAgIGVuY29kZWQuYSA9IGNlaWwoZW5jb2RlZC5hICogMjU1LjApIC8gMjU1LjA7XG5cbiAgICBlbmNvZGVkLnJnYiAvPSBlbmNvZGVkLmE7XG4gICAgcmV0dXJuIGVuY29kZWQ7XG59XG5cbi8vIGZpbHRlciBzaXplXG4jZGVmaW5lIE1TSVpFIDE1XG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudW5pZm9ybSB2ZWMyIHBpeGVsT2Zmc2V0O1xudW5pZm9ybSB2ZWMyIHNpZ21hcztcbnVuaWZvcm0gZmxvYXQgYlpub3JtO1xudW5pZm9ybSBmbG9hdCBrZXJuZWxbTVNJWkVdO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIFxuICAgIHZlYzQgcGl4ZWxSZ2JtID0gdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCwgMC4wKTtcblxuICAgIC8vIGxpZ2h0bWFwIHNwZWNpZmljIG9wdGltaXphdGlvbiAtIHNraXAgcGl4ZWxzIHRoYXQgd2VyZSBub3QgYmFrZWRcbiAgICAvLyB0aGlzIGFsc28gYWxsb3dzIGRpbGF0ZSBmaWx0ZXIgdGhhdCB3b3JrIG9uIHRoZSBvdXRwdXQgb2YgdGhpcyB0byB3b3JrIGNvcnJlY3RseSwgYXMgaXQgZGVwZW5kcyBvbiAuYSBiZWluZyB6ZXJvXG4gICAgLy8gdG8gZGlsYXRlLCB3aGljaCB0aGUgZm9sbG93aW5nIGJsdXIgZmlsdGVyIHdvdWxkIG90aGVyd2lzZSBtb2RpZnlcbiAgICBpZiAocGl4ZWxSZ2JtLmEgPD0gMC4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHBpeGVsUmdibTtcbiAgICAgICAgcmV0dXJuIDtcbiAgICB9XG5cbiAgICAvLyByYW5nZSBzaWdtYSAtIGNvbnRyb2xzIGJsdXJyaW5lc3MgYmFzZWQgb24gYSBwaXhlbCBkaXN0YW5jZVxuICAgIGZsb2F0IHNpZ21hID0gc2lnbWFzLng7XG5cbiAgICAvLyBkb21haW4gc2lnbWEgLSBjb250cm9scyBibHVycmluZXNzIGJhc2VkIG9uIGEgcGl4ZWwgc2ltaWxhcml0eSAodG8gcHJlc2VydmUgZWRnZXMpXG4gICAgZmxvYXQgYlNpZ21hID0gc2lnbWFzLnk7XG5cbiAgICB2ZWMzIHBpeGVsSGRyID0gZGVjb2RlUkdCTShwaXhlbFJnYm0pO1xuICAgIHZlYzMgYWNjdW11bGF0ZWRIZHIgPSB2ZWMzKDAuMCk7XG4gICAgZmxvYXQgYWNjdW11bGF0ZWRGYWN0b3IgPSAwLjA7XG5cbiAgICAvLyByZWFkIG91dCB0aGUgdGV4ZWxzXG4gICAgY29uc3QgaW50IGtTaXplID0gKE1TSVpFLTEpLzI7XG4gICAgZm9yIChpbnQgaSA9IC1rU2l6ZTsgaSA8PSBrU2l6ZTsgKytpKSB7XG4gICAgICAgIGZvciAoaW50IGogPSAta1NpemU7IGogPD0ga1NpemU7ICsraikge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzYW1wbGUgdGhlIHBpeGVsIHdpdGggb2Zmc2V0XG4gICAgICAgICAgICB2ZWMyIGNvb3JkID0gdlV2MCArIHZlYzIoZmxvYXQoaSksIGZsb2F0KGopKSAqIHBpeGVsT2Zmc2V0O1xuICAgICAgICAgICAgdmVjNCByZ2JtID0gdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgY29vcmQsIDAuMCk7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwIC0gb25seSB1c2UgYmFrZWQgcGl4ZWxzXG4gICAgICAgICAgICBpZiAocmdibS5hID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgdmVjMyBoZHIgPSBkZWNvZGVSR0JNKHJnYm0pO1xuXG4gICAgICAgICAgICAgICAgLy8gYmlsYXRlcmFsIGZhY3RvcnNcbiAgICAgICAgICAgICAgICBmbG9hdCBmYWN0b3IgPSBrZXJuZWxba1NpemUgKyBqXSAqIGtlcm5lbFtrU2l6ZSArIGldO1xuICAgICAgICAgICAgICAgIGZhY3RvciAqPSBub3JtcGRmMyhoZHIgLSBwaXhlbEhkciwgYlNpZ21hKSAqIGJabm9ybTtcblxuICAgICAgICAgICAgICAgIC8vIGFjY3VtdWxhdGVcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZEhkciArPSBmYWN0b3IgKiBoZHI7XG4gICAgICAgICAgICAgICAgYWNjdW11bGF0ZWRGYWN0b3IgKz0gZmFjdG9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2xfRnJhZ0NvbG9yID0gZW5jb2RlUkdCTShhY2N1bXVsYXRlZEhkciAvIGFjY3VtdWxhdGVkRmFjdG9yKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
