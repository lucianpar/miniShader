#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

// hash for pseudo-random numbers
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// gyroid-like noise
float gyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

// FBM gyroid
float fbmGyroid(vec3 seed) {
    float result = 0.0, a = 0.5;
    for (int i = 0; i < 3; ++i) {
        seed.z += result * 0.3;
        result += abs(gyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// Voronoi bug placement
float voronoi(vec2 uv, out float bugSize, out float twinklePhase, float sizePulse) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float minDist = 1.0;
    float chosenSize = 0.2;
    float chosenPhase = 0.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(x, y);
            float h = hash(i + neighbor);

            // wiggle bug positions
            vec2 point = vec2(
                sin(u_time*0.25 + h*6.28),
                cos(u_time*0.2 + h*6.28)
            ) * 0.2;

            point += 0.5 + 0.5 * vec2(hash(i+neighbor*1.7),
                                      hash(i+neighbor*2.3));

            vec2 diff = neighbor + point - f;
            float d = length(diff);
            if (d < minDist) {
                minDist = d;
                chosenSize = (0.08 + 0.1 * hash(i + neighbor*3.1)) * sizePulse;
                chosenPhase = h * TWO_PI;
            }
        }
    }
    bugSize = chosenSize;
    twinklePhase = chosenPhase;
    return minDist;
}

void main() {
    vec2 uv = vPos.xy * 8.0;

    // === Moving gyroid field ===
    // Drift across UV space slowly → clouds shift
    vec2 drift = vec2(sin(u_time*0.05), cos(u_time*0.04)) * 5.0;
    float gy = fbmGyroid(vec3(uv*0.04 + drift, u_time*0.01));
    float grouping = smoothstep(0.35, 0.6, gy);

    // === Global size pulsing ===
    float sizePulse = 0.9 + 0.2 * sin(u_time * 2.0);

    // === Bug agents ===
    float bugSize, twinklePhase;
    float bugField = voronoi(uv, bugSize, twinklePhase, sizePulse);

    float bugs = smoothstep(bugSize, 0.0, bugField);

    // glow
    float glow = smoothstep(bugSize*1.6, bugSize*1.2, bugField);
    bugs += glow * 0.3;

    // twinkle modulation per bug
    float twinkle = 0.5 + 0.5 * sin(u_time*3.0 + twinklePhase);
    bugs *= (0.7 + 0.3 * twinkle);

    // apply grouping → clusters now move
    bugs *= grouping;

    // === Colors ===
    vec3 base   = vec3(0.01, 0.0, 0.05);
    vec3 accent = vec3(0.12, 0.05, 0.3);
    vec3 glowC  = vec3(0.3, 0.2, 0.65);

    vec3 bugColor = mix(base, accent, bugs);
    bugColor = mix(bugColor, glowC, pow(bugs, 2.0));

    fragColor = vec4(bugColor, 1.0);
}
