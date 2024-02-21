var webgpuVS = /* glsl */`

// texelFetch support and others
#extension GL_EXT_samplerless_texture_functions : require

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)
#define itexture2D(res, uv) texture(isampler2D(res, res ## _sampler), uv)
#define utexture2D(res, uv) texture(usampler2D(res, res ## _sampler), uv)

#define GL2
#define WEBGPU
#define VERTEXSHADER
`;

export { webgpuVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLWNodW5rcy92ZXJ0L3dlYmdwdS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG4vLyB0ZXhlbEZldGNoIHN1cHBvcnQgYW5kIG90aGVyc1xuI2V4dGVuc2lvbiBHTF9FWFRfc2FtcGxlcmxlc3NfdGV4dHVyZV9mdW5jdGlvbnMgOiByZXF1aXJlXG5cbiNkZWZpbmUgdGV4dHVyZTJEKHJlcywgdXYpIHRleHR1cmUoc2FtcGxlcjJEKHJlcywgcmVzICMjIF9zYW1wbGVyKSwgdXYpXG4jZGVmaW5lIGl0ZXh0dXJlMkQocmVzLCB1dikgdGV4dHVyZShpc2FtcGxlcjJEKHJlcywgcmVzICMjIF9zYW1wbGVyKSwgdXYpXG4jZGVmaW5lIHV0ZXh0dXJlMkQocmVzLCB1dikgdGV4dHVyZSh1c2FtcGxlcjJEKHJlcywgcmVzICMjIF9zYW1wbGVyKSwgdXYpXG5cbiNkZWZpbmUgR0wyXG4jZGVmaW5lIFdFQkdQVVxuI2RlZmluZSBWRVJURVhTSEFERVJcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZUFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
