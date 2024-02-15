export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform float uTime;\n            uniform sampler2D uTexture;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n\n            void main(void)\n            {\n                // 3 scrolling texture coordinates with different direction and speed\n                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);\n                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);\n                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);\n\n                // sample the fog texture to have elevation for this vertex\n                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);\n                float offset = texture2D(uTexture, offsetTexCoord).r;\n\n                // vertex in the world space\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n\n                // move it up based on the offset\n                pos.y += offset * 25.0;\n\n                // position in projected (screen) space\n                vec4 projPos = matrix_viewProjection * pos;\n                gl_Position = projPos;\n\n                // the linear depth of the vertex (in camera space)\n                depth = getLinearDepth(pos.xyz);\n\n                // screen fragment position, used to sample the depth texture\n                screenPos = projPos;\n            }\n        ",
        "shader.frag": "\n            uniform sampler2D uTexture;\n            uniform float uSoftening;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n            \n            void main(void)\n            {\n                // sample the texture 3 times and compute average intensity of the fog\n                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);\n                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);\n                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);\n                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);\n\n                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords\n                vec2 screenCoord = getGrabScreenPos(screenPos);\n\n                // read the depth from the depth buffer\n                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;\n\n                // depth of the current fragment (on the fog plane)\n                float fragmentDepth = depth * camera_params.x;\n\n                // difference between these two depths is used to adjust the alpha, to fade out\n                // the fog near the geometry\n                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);\n                alpha *= smoothstep(0.0, 1.0, depthDiff);\n\n                // final color\n                vec3 fogColor = vec3(1.0, 1.0, 1.0);\n                gl_FragColor = vec4(fogColor, alpha);\n            }\n        "
    }
};
