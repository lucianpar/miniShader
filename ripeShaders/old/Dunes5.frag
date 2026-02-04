#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

const float TRACK_LENGTH = 60.0;  // fixed track length in seconds

// === Noise functions for sandy effect ===
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i=0; i<5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// === Plasma noise functions ===
float wave(vec2 p) {
    float v = sin(p.x + sin(p.y * 2.0) + sin(p.y * 0.43));
    v += 0.7 * sin(p.y * 1.5 + u_time * 0.2);
    v += 0.5 * cos(p.x * 1.7 - u_time * 0.15);
    return v;
}

float wave2(vec2 p) {
    p = mat2(cos(0.7), -sin(0.7), sin(0.7), cos(0.7)) * p;
    float v = cos(p.y + sin(p.x * 2.1) + sin(p.x * 0.37));
    v += 0.7 * cos(p.x * 1.3 - u_time * 0.23);
    v += 0.5 * sin(p.y * 1.9 + u_time * 0.18);
    return v;
}

// === Base plasma coloring ===
vec3 Solar_Plasma(vec2 p) {
    float v1 = wave(p * 2.0 + u_time * 0.05);
    float v2 = wave2(p * 2.2 - u_time * 0.03);

    vec3 core = vec3(1.0, 0.95, 0.7);
    vec3 mid  = vec3(1.0, 0.5, 0.1);
    vec3 edge = vec3(0.4, 0.0, 0.0);

    float t = 0.5 + 0.5 * (v1 + v2) * 0.5;
    vec3 color = mix(core, mid, smoothstep(0.0, 1.0, t));
    color = mix(color, edge, pow(t, 3.0));

    return color;
}

// === Render Sun Base (body, purple tendrils, decay cells) ===
vec3 renderSunBase(vec2 uv, float r, float body, float chaosFactor) {
    // Apply chaotic distortion to UV based on chaos factor
    vec2 chaosUV = uv;
    if (chaosFactor > 0.0) {
        vec2 noiseOffset = vec2(fbm(uv * 4.0 + u_time * 0.2), fbm(uv * 4.0 + u_time * 0.2 + 50.0));
        chaosUV += chaosFactor * 0.4 * (noiseOffset - 0.5); // centered distortion
    }

    vec3 plasma = Solar_Plasma(chaosUV * 3.0);
    vec3 sunColor = plasma * body;

    // Dark purple inner tendrils - intensify with chaos
    float tW1 = wave(chaosUV * 6.0 + u_time * 0.2);
    float tW2 = wave2(chaosUV * 6.5 - u_time * 0.15);
    float tendrilField = abs(tW1 - tW2);
    float purpleMask = smoothstep(0.3, 0.7, tendrilField);
    vec3 purpleTendrils = vec3(0.15, 0.0, 0.25) * (1.0 - purpleMask) * 0.35 * (1.0 + chaosFactor * 2.0);
    sunColor -= purpleTendrils;

    // Decay cells - intensify with chaos
    float decayField = wave(chaosUV * 3.5 + u_time * 0.4) * wave2(chaosUV * 4.0 - u_time * 0.3);
    float decayMask = smoothstep(0.75, 0.9, abs(decayField));
    vec3 decayCells = vec3(0.05, 0.1, 0.4) * decayMask * 0.6 * (1.0 + chaosFactor * 3.0);
    sunColor -= decayCells * body;

    return sunColor;
}

// === Render Sun Effects (halo, tendrils) ===
vec3 renderSunEffects(vec2 uv, float r, vec3 sunColor, float chaosFactor) {
    // Glow halo - make it more chaotic
    float haloDistortion = chaosFactor * 0.2 * fbm(uv * 2.0 + u_time * 0.1);
    float glow = exp(-3.0 * max(r + haloDistortion - 0.5, 0.0));
    vec3 halo = vec3(1.0, 0.7, 0.3) * glow;

    // Subtle tendrils near edge - intensify with chaos
    float m1 = wave(uv * 4.0 + u_time * 0.2);
    float m2 = wave2(uv * 3.5 - u_time * 0.15);
    float edgeRegion = smoothstep(0.45, 0.55, r);
    float tendrilMask = (m1 - m2) * edgeRegion * 0.3 * (1.0 + chaosFactor * 1.5);
    vec3 plasma = Solar_Plasma(uv * 3.0); // needed for tendrils
    vec3 tendrils = vec3(1.0, 0.6, 0.2) * tendrilMask * plasma;

    return sunColor + halo + tendrils;
}

// === Render Sand (reddish grainy obscuring effect extending around the orb) ===
vec3 renderSand(vec2 uv, float r, float body, vec3 sunColor) {
    // Sandy noise that obscures the sun like blowing sand
    float sandPeriod = 4.0; // every 4 seconds for more frequent effect
    float sandCycle = fract(u_time / sandPeriod);
    float sandIntensity = smoothstep(0.0, 0.2, sandCycle) * (1.0 - smoothstep(0.8, 1.0, sandCycle)); // fade in/out
    
    // Scrolling sandy noise that blows across
    vec2 sandUV = uv + vec2(u_time * 0.5, sin(u_time * 0.3) * 0.2); // faster scroll with more vertical movement
    float sandGrain = fbm(sandUV * 20.0); // higher frequency for finer, grainier sand
    
    // Subtractive obscuring effect - even darker sand (only on sun body)
    float darkenAmount = sandGrain * sandIntensity * 1.8;
    sunColor *= (1.0 - darkenAmount * body);
    
    // Reddish sandy tint extending around the orb
    vec3 sandTint = vec3(0.6, 0.3, 0.2) * sandGrain * sandIntensity * 0.1; // reddish tint
    float sandMask = smoothstep(1.5, 0.5, r); // extends from r=0.5 to 1.5
    sunColor += sandTint * sandMask;

    return sunColor;
}

void main() {
    // --- Growth factor over track ---
    float startTime = 0.0; // seconds
    float growT = clamp((u_time - startTime) / TRACK_LENGTH, 0.0, 1.0);
    // small at start (0.1) → fills screen (2.0)
    float growthFactor = mix(0.1, 2.0, growT);

    // --- Pulsing (breathing every 8s) ---
    float pulseAmount = 1.5 * (u_time / TRACK_LENGTH); // increase over time
    float pulse = 1.0 + pulseAmount * sin(u_time * 6.28318 / 8.0);

    // scale uv: smaller growthFactor → smaller object
    vec2 uv = (vPos.xy / 6.0) / growthFactor * pulse ; // removing pulse for now. / pulse;
    float r = length(uv);

    // === Sun body mask ===
    float sunRadius = 1.0;
    float body = smoothstep(sunRadius, 0.0, r);

    // === Chaos factor increases over the track ===
    float chaosFactor = growT; // 0 at start, 1 at end

    // === Modular rendering ===
    vec3 sunBase = renderSunBase(uv, r, body, chaosFactor);
    vec3 sunWithSand = renderSand(uv, r, body, sunBase);
    vec3 finalSun = renderSunEffects(uv, r, sunWithSand, chaosFactor);

    // === Combine ===
    vec3 color = finalSun;

    // keep background black
    color *= smoothstep(1.5, 0.9, r);

    fragColor = vec4(color, 1.0);
}
