#version 330 core

in vec3 vPos;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

// === UTILITIES ===
float SmokeGyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbm(vec3 seed) {  // Renamed from SmokeFBM to match calls
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 10; ++i) {  // Further increased iterations for even more detail
        seed.z += result * 0.5;
        result += abs(SmokeGyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// === SMOKE 1 (Modified for grey misty effect) ===
float smokeOrganismPresence(vec2 uv, float t) {
    vec2 center = vec2(0.2 * sin(t * 0.3), 0.2 * cos(t * 0.2));
    float radius = 0.45 + 0.15 * sin(t * 0.7);
    float d = length(uv - center);
    return smoothstep(radius * 1.2, radius, d);
}

float smokeInternalMembrane(vec2 uv, float t) {
    float pulse = sin(t * 0.6 + uv.x * 5.0) * cos(t * 0.4 + uv.y * 7.0);
    float band = smoothstep(0.2, 0.5, pulse);
    float fb = fbm(vec3(uv * 3.0, t * 0.1));  // Now matches definition
    return mix(0.0, fb, band);
}

// === SMOKE 3 (Further refined for even more detail, starting from outside and merging into one structure) ===
vec4 SmokeSrc(vec2 uv, float t) {
    // Finer scaling for more detail and less shapely forms
    uv *= 0.3;  // Further increased scaling for finer details and merging

    // Reduced and slower drift for less movement
    uv += 0.05 * vec2(
        sin(uv.y * 1.5 + t * 0.05),  // Even slower time multiplier
        cos(uv.x * 1.3 - t * 0.04)  // Even slower time multiplier
    ) * fbm(vec3(uv * 2.5, t * 0.02));  // Higher frequency for detail, slower time

    // Even higher frequency fbm for more detail
    float smoke = fbm(vec3(uv * 6.0, t * 0.015)) * 2.0;  // Now matches definition

    // Adjusted masking to start from outside and merge towards center
    float dist = length(uv);
    float outerMask = smoothstep(0.0, 1.5, dist);  // Stronger at edges
    float innerMask = 1.0 - smoothstep(0.0, 0.5, dist);  // Weaker in center
    float ambientMask = mix(outerMask, innerMask, 0.5);  // Blend for merging effect

    float intensity = pow(smoke, 1.2) * ambientMask;  // Adjusted power for finer, merging texture

    // Grey misty colors with subtle variations
    vec3 color = mix(vec3(0.5, 0.5, 0.5), vec3(0.7, 0.7, 0.7), 0.5 + 0.2 * sin(t * 0.03 + smoke * 1.5));  // Slower color variation

    return vec4(color * intensity, 0.03 + 0.5 * intensity);  // Adjusted alpha for finer mist
}

// === FOAM BUBBLE (Modified for grey misty effect) ===
float smokeMetaballField(vec2 uv, float t) {
    float field = 0.0;
    for (int i = 0; i < 7; ++i) {
        float fi = float(i);
        vec2 center = 1.2 * vec2(
            sin(t * 0.27 + fi * 1.3) + cos(fi + t * 0.11),
            cos(t * 0.19 + fi * 1.6) + sin(fi * 0.4 + t * 0.29)
        );
        float radius = 0.35 + 0.25 * sin(t * 0.23 + fi * 0.8);
        float dist = length(uv - center) + 0.003;
        field += radius / dist;
    }
    return field;
}

vec4 smokeFoamBubble(vec2 uv, float t) {
    uv = vPos.xy / 7.0;
    float meta = smokeMetaballField(uv, t);
    float warp = smoothstep(0.6, 3.5, meta);
    float pulse = 1.0 + 0.2 * sin(t * 0.8 + meta * 2.0);

    vec2 drift = vec2(
        sin(meta * 1.5 + t * 0.6),
        cos(meta * 1.7 + t * 0.5)
    );
    vec2 warpedUV = uv + 0.33 * warp * pulse * drift;

    warpedUV += 0.05 * vec2(
        sin(fbm(vec3(uv, t * 0.13)) * 8.0 + t),  // Now matches definition
        cos(fbm(vec3(uv.yx, t * 0.11)) * 6.0 - t)  // Now matches definition
    );

    float n = fbm(vec3(warpedUV * 0.95, t * 0.07));
    vec3 normal = normalize(vec3(
        n - fbm(vec3(warpedUV + vec2(0.015, 0.0), t * 0.07)),
        n - fbm(vec3(warpedUV + vec2(0.0, 0.015), t * 0.07)),
        0.3 + (t / 140.0)
    ));

    // Modified for grey misty colors
    vec3 baseColor = mix(vec3(0.6, 0.6, 0.6), vec3(0.8, 0.8, 0.8), 0.5 + 0.5 * sin(t * 0.9 + meta * 2.5));

    vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
    vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
    vec3 color = 0.3 * pow(dot(normal, light1), 2.5)
               + 0.2 * pow(dot(normal, light2), 4.5)
               + baseColor * n;

    color *= n * warp;
    color += 0.02 * vec3(0.7, 0.7, 0.7);  // Grey tint

    return vec4(color, 0.12 + 0.4 * warp);
}

vec4 SmokeMain(vec2 uv, float t) {
    // Removed redundant newUV scaling (uv is already scaled in main())
    // Use SmokeSrc for a grey misty mountaintop effect
    vec4 finalColor = SmokeSrc(uv, t);

    // === FADE IN from black ===
    float fadeIn = smoothstep(0.0, 3.0, t);
    finalColor.rgb *= fadeIn;
    finalColor.a *= fadeIn;

    // === FADE OUT to white ===
    float fadeOut = smoothstep(481.0, 491.0, t);
    finalColor.rgb = mix(finalColor.rgb, vec3(1.0), fadeOut);
    finalColor.a = mix(finalColor.a, 1.0, fadeOut);
    return finalColor;

}

// === MAIN ===
// Commented out the event structure (blending logic) as requested
void main() {
    vec2 uv = vPos.xy / 10.0;  // Added semicolon and scaling to match SmokeSrc expectations
    float t = u_time;

    fragColor = SmokeMain(uv, t);
}