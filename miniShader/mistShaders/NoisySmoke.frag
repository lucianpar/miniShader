#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

// === UTILITIES ===
float NoisySmokeGyroidUtil(vec3 seed) {
    return dot(cos(seed), sin(seed.yzx)) * dot(cos(seed), sin(seed.yzx)) * cos(seed.x) - cos(seed.y) + cos(seed.z);
    // * cos(seed.x) * cos(seed.y) * cos(seed.z); // very cool result but too dark
}

float NoisySmokefbm(vec3 seed) {
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 30; ++i) {
        seed.z += result * 0.5;
        result += abs(NoisySmokeGyroidUtil(seed / a)) * a;
        a *= 0.6;
    }
    return result;
}

float NoisySmokeGrainNoise(vec2 uv, float t) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + t * 0.1); //last number is grain movement speed
}

// === SMOKE 3 (Mist as a collection of little cloud dots) ===
vec4 NoisySmokeSrc(vec2 uv, float t) {
    // Scale down for smaller, distinct cloud dots
    uv *= 0.5;

    // Use NoisySmokefbm for base structure, with smaller scale for distinct dots
    float mist = NoisySmokefbm(vec3(uv * 10.0, t * 0.1)); // Higher frequency for smaller structures

    // Sharpen and isolate the cloud dots
    float cloudDots = smoothstep(0.3, 0.8, mist); // Isolate brighter regions
    cloudDots = pow(cloudDots, 30.0); // Sharpen the dots

    // Add grain for texture, but keep it subtle
    float grain = NoisySmokeGrainNoise(uv * 2.0, t); // Moderate frequency for grain
    mist = mix(cloudDots, grain, 0.2); // Blend grain lightly with the cloud dots (reduced grain influence to make clouds more visible)

    // Mask for forming inward from outside
    float dist = length(uv);
    float formInward = 1.0 - smoothstep(0.0, 1.5 - t * 0.005, dist); // Starts at edges, forms towards center over time

    // Intensity with inward formation
    float intensity = mist * 0.8 * formInward;

    // Grey misty colors
    vec3 color = mix(vec3(0.4, 0.4, 0.4), vec3(0.8, 0.8, 0.8), 0.5 + 0.2 * sin(t * 0.005 + mist * 0.5));

    return vec4(color * intensity, 0.1 + 0.6 * intensity); // Higher alpha for visibility
}

 vec4 NoisySmokeFinal(vec2 uv, float t) {
    vec2 newUV = uv/20.0;
    // Use NoisySmokeSrc for a collection of little cloud dots
    vec4 finalColor = NoisySmokeSrc(newUV, t);

    // === FADE IN from black ===
    float fadeIn = smoothstep(0.0, 3.0, t);
    finalColor.rgb *= fadeIn;
    finalColor.a *= fadeIn;

    // === FADE OUT to white ===
    float fadeOut = smoothstep(481.0, 491.0, t);
    finalColor.rgb = mix(finalColor.rgb, vec3(1.0), fadeOut);
    finalColor.a = mix(finalColor.a, 1.0, fadeOut);
    // Use NoisySmokeSrc for a collection of little cloud dots
    return finalColor;
}

// === MAIN ===
void main() {
    fragColor = NoisySmokeFinal(vPos.xy, u_time);
}