var dilatePS = /* glsl */`

varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

void main(void) {
    vec4 c = texture2DLodEXT(source, vUv0, 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 - pixelOffset, 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(0, -pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(-pixelOffset.x, 0), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(pixelOffset.x, 0), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(0, pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + pixelOffset, 0.0);
    gl_FragColor = c;
}
`;

export { dilatePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlsYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGlnaHRtYXBwZXIvZnJhZy9kaWxhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnVuaWZvcm0gdmVjMiBwaXhlbE9mZnNldDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICB2ZWM0IGMgPSB0ZXh0dXJlMkRMb2RFWFQoc291cmNlLCB2VXYwLCAwLjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCAtIHBpeGVsT2Zmc2V0LCAwLjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCArIHZlYzIoMCwgLXBpeGVsT2Zmc2V0LnkpLCAwLjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCArIHZlYzIocGl4ZWxPZmZzZXQueCwgLXBpeGVsT2Zmc2V0LnkpLCAwLjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCArIHZlYzIoLXBpeGVsT2Zmc2V0LngsIDApLCAwLjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJETG9kRVhUKHNvdXJjZSwgdlV2MCArIHZlYzIocGl4ZWxPZmZzZXQueCwgMCksIDAuMCk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkRMb2RFWFQoc291cmNlLCB2VXYwICsgdmVjMigtcGl4ZWxPZmZzZXQueCwgcGl4ZWxPZmZzZXQueSksIDAuMCk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkRMb2RFWFQoc291cmNlLCB2VXYwICsgdmVjMigwLCBwaXhlbE9mZnNldC55KSwgMC4wKTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRExvZEVYVChzb3VyY2UsIHZVdjAgKyBwaXhlbE9mZnNldCwgMC4wKTtcbiAgICBnbF9GcmFnQ29sb3IgPSBjO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
