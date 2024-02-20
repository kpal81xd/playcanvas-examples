var tonemappingAces2PS = /* glsl */`
uniform float exposure;

// ACES approximation by Stephen Hill

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInputMat = mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

vec3 toneMap(vec3 color) {
    color *= exposure / 0.6;
    color = color * ACESInputMat;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);
    color = color * ACESOutputMat;

    // Clamp to [0, 1]
    color = clamp(color, 0.0, 1.0);

    return color;
}
`;

export { tonemappingAces2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdBY2VzMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3RvbmVtYXBwaW5nQWNlczIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgZXhwb3N1cmU7XG5cbi8vIEFDRVMgYXBwcm94aW1hdGlvbiBieSBTdGVwaGVuIEhpbGxcblxuLy8gc1JHQiA9PiBYWVogPT4gRDY1XzJfRDYwID0+IEFQMSA9PiBSUlRfU0FUXG5jb25zdCBtYXQzIEFDRVNJbnB1dE1hdCA9IG1hdDMoXG4gICAgMC41OTcxOSwgMC4zNTQ1OCwgMC4wNDgyMyxcbiAgICAwLjA3NjAwLCAwLjkwODM0LCAwLjAxNTY2LFxuICAgIDAuMDI4NDAsIDAuMTMzODMsIDAuODM3Nzdcbik7XG5cbi8vIE9EVF9TQVQgPT4gWFlaID0+IEQ2MF8yX0Q2NSA9PiBzUkdCXG5jb25zdCBtYXQzIEFDRVNPdXRwdXRNYXQgPSBtYXQzKFxuICAgICAxLjYwNDc1LCAtMC41MzEwOCwgLTAuMDczNjcsXG4gICAgLTAuMTAyMDgsICAxLjEwODEzLCAtMC4wMDYwNSxcbiAgICAtMC4wMDMyNywgLTAuMDcyNzYsICAxLjA3NjAyXG4pO1xuXG52ZWMzIFJSVEFuZE9EVEZpdCh2ZWMzIHYpIHtcbiAgICB2ZWMzIGEgPSB2ICogKHYgKyAwLjAyNDU3ODYpIC0gMC4wMDAwOTA1Mzc7XG4gICAgdmVjMyBiID0gdiAqICgwLjk4MzcyOSAqIHYgKyAwLjQzMjk1MTApICsgMC4yMzgwODE7XG4gICAgcmV0dXJuIGEgLyBiO1xufVxuXG52ZWMzIHRvbmVNYXAodmVjMyBjb2xvcikge1xuICAgIGNvbG9yICo9IGV4cG9zdXJlIC8gMC42O1xuICAgIGNvbG9yID0gY29sb3IgKiBBQ0VTSW5wdXRNYXQ7XG5cbiAgICAvLyBBcHBseSBSUlQgYW5kIE9EVFxuICAgIGNvbG9yID0gUlJUQW5kT0RURml0KGNvbG9yKTtcbiAgICBjb2xvciA9IGNvbG9yICogQUNFU091dHB1dE1hdDtcblxuICAgIC8vIENsYW1wIHRvIFswLCAxXVxuICAgIGNvbG9yID0gY2xhbXAoY29sb3IsIDAuMCwgMS4wKTtcblxuICAgIHJldHVybiBjb2xvcjtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
