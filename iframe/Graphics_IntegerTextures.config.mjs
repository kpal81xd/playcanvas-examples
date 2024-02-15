export default {
    WEBGPU_ENABLED: true,
    DESCRIPTION: "<ul><li>Click to add sand<li>Shift-click to remove sand<li>Press space to reset.</ul>",
    FILES: {
        "sandSimulation.frag": "\n            precision highp usampler2D;\n\n            uniform usampler2D sourceTexture;\n            uniform vec2 mousePosition;\n            uniform uint mouseButton;\n            uniform uint passNum;\n            uniform uint brush;\n            uniform float randomVal;\n            uniform float brushRadius;\n\n            varying vec2 uv0;\n\n            const uint AIR = 0u;\n            const uint SAND = 1u;\n            const uint ORANGESAND = 2u;\n            const uint GRAYSAND = 3u;\n            const uint WALL = 4u;\n                                    \n            bool isInBounds(ivec2 c, ivec2 size) {\n                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;\n            }\n            \n            struct Particle {\n                uint element;        // 3 bits\n                bool movedThisFrame; // 1 bit\n                uint shade;          // 4 bits\n                uint waterMass;      // 8 bits\n            };\n\n            float rand(vec2 pos, float val) {\n                return fract(pos.x * pos.y * val * 1000.0);\n            }\n            \n            uint pack(Particle particle) {\n                uint packed = 0u;\n                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits\n                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit\n                packed |= (particle.shade << 4);          // Store shade in the next 4 bits\n            \n                return packed; // Second component is reserved/unused\n            }\n            \n            Particle unpack(uint packed) {\n                Particle particle;\n                particle.element = packed & 0x7u;                         // Extract lowest 3 bits\n                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit\n                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            \n                return particle;\n            }\n\n            Particle getParticle(ivec2 c) {\n                uint val = texelFetch(sourceTexture, c, 0).r;\n                return unpack(val);\n            }\n                        \n            void main() {\n\n                ivec2 size = textureSize(sourceTexture, 0);\n                ivec2 coord = ivec2(uv0 * vec2(size));\n\n                if (!isInBounds(coord, size)) {\n                    gl_FragColor = WALL;\n                    return;\n                }\n            \n                float mouseDist = distance(mousePosition, uv0);\n                int dir = int(passNum % 3u) - 1;\n\n                Particle currentParticle = getParticle(coord);\n                Particle nextState = currentParticle;\n\n                if (mouseButton == 1u && mouseDist < brushRadius) {\n                    nextState.element = brush;\n                    nextState.movedThisFrame = true;\n                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);\n                } else if (mouseButton == 2u && mouseDist < brushRadius) {\n                    nextState.element = AIR;\n                    nextState.movedThisFrame = false;\n                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);\n                }\n                \n                currentParticle.movedThisFrame = false;\n                if (currentParticle.element == AIR) {\n                    Particle above = getParticle(coord + ivec2(dir, -1));\n                    if (above.element != AIR && above.element != WALL) {\n                        nextState = above;\n                        nextState.movedThisFrame = true;\n                    }\n                } else if (currentParticle.element != WALL) {\n                    Particle below = getParticle(coord + ivec2(-dir, 1));\n                    if (below.element == AIR && !below.movedThisFrame) {\n                        nextState = below;\n                        nextState.movedThisFrame = false;\n                    }\n                }\n\n                gl_FragColor = pack(nextState);\n            }\n        ",
        "renderOutput.frag": "\n            precision highp usampler2D;\n            uniform usampler2D sourceTexture;\n            uniform vec2 mousePosition;\n            uniform float brushRadius;\n            varying vec2 uv0;\n\n            vec3 whiteColor = vec3(1.0);\n            vec3 skyBlueColor = vec3(0.2, 0.2, 0.2);\n            vec3 yellowSandColor = vec3(0.73, 0.58, 0.26);\n            vec3 orangeSandColor = vec3(0.87, 0.43, 0.22);\n            vec3 graySandColor = vec3(0.13, 0.16, 0.17);\n            vec3 grayWallColor = vec3(0.5, 0.5, 0.5);\n            vec3 waterBlueColor = vec3(0.2, 0.3, 0.8);\n\n            float circle( vec2 p, float r ) {\n                return length(p) - r;\n            }\n\n            const float circleOutline = 0.0025;\n\n            const uint AIR = 0u;\n            const uint SAND = 1u;\n            const uint ORANGESAND = 2u;\n            const uint GRAYSAND = 3u;\n            const uint WALL = 4u;\n                                    \n            bool isInBounds(ivec2 c, ivec2 size) {\n                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;\n            }\n            \n            struct Particle {\n                uint element;        // 3 bits\n                bool movedThisFrame; // 1 bit\n                uint shade;          // 4 bits\n                uint waterMass;      // 8 bits\n            };\n\n            float rand(vec2 pos, float val) {\n                return fract(pos.x * pos.y * val * 1000.0);\n            }\n            \n            uint pack(Particle particle) {\n                uint packed = 0u;\n                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits\n                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit\n                packed |= (particle.shade << 4);          // Store shade in the next 4 bits\n            \n                return packed; // Second component is reserved/unused\n            }\n            \n            Particle unpack(uint packed) {\n                Particle particle;\n                particle.element = packed & 0x7u;                         // Extract lowest 3 bits\n                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit\n                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            \n                return particle;\n            }\n\n            Particle getParticle(ivec2 c) {\n                uint val = texelFetch(sourceTexture, c, 0).r;\n                return unpack(val);\n            }\n\n            void main() {\n                ivec2 size = textureSize(sourceTexture, 0);\n                ivec2 coord = ivec2(uv0 * vec2(size));\n                Particle particle = getParticle(coord);\n                \n                vec3 gameColor = skyBlueColor;\n                if (particle.element == SAND) {\n                    gameColor = mix(yellowSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                } else if (particle.element == WALL) {\n                    gameColor = grayWallColor;\n                } else if (particle.element == ORANGESAND) {\n                    gameColor = mix(orangeSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                } else if (particle.element == GRAYSAND) {\n                    gameColor = mix(graySandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                }\n\n                // Render a brush circle\n                float d = length(uv0 - mousePosition);\n                float wd = fwidth(d);\n                float circle = smoothstep(brushRadius + wd, brushRadius, d);\n                float circleInner = smoothstep(brushRadius - circleOutline + wd, brushRadius - circleOutline, d);\n                float brush = max(circle - circleInner, 0.0) * 0.5;\n\n                vec3 outColor = mix(gameColor, vec3(1.0), brush);\n\n                gl_FragColor = vec4(outColor, 1.0);\n            }\n        "
    }
};