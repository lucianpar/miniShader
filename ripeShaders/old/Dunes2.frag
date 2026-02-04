#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

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

void main() {
    // --- Pulsing scale factor (10s cycle) ---
    float pulse = 1.0 + 0.1 * sin(u_time * 6.28318 / 10.0);
    vec2 uv = (vPos.xy / 3.5) / pulse;
    float r = length(uv);

    // === Sun body ===
    float sunRadius = 1.0;
    float body = smoothstep(sunRadius, 0.0, r);
    vec3 plasma = Solar_Plasma(uv * 3.0);
    vec3 sunColor = plasma * body;

    // === Glow halo ===
    float glow = exp(-3.0 * max(r - 0.5, 0.0));
    vec3 halo = vec3(1.0, 0.7, 0.3) * glow;

    // === Subtle tendrils near edge ===
    float m1 = wave(uv * 4.0 + u_time * 0.2);
    float m2 = wave2(uv * 3.5 - u_time * 0.15);
    float edgeRegion = smoothstep(0.45, 0.55, r);
    float tendrilMask = (m1 - m2) * edgeRegion * 0.3;
    vec3 tendrils = vec3(1.0, 0.6, 0.2) * tendrilMask * plasma;

  // === New: dark purple inner tendrils (organic, not grid) ===
float tW1 = wave(uv * 6.0 + u_time * 0.2);
float tW2 = wave2(uv * 6.5 - u_time * 0.15);
float tendrilField = abs(tW1 - tW2); // interaction field
float purpleMask = smoothstep(0.3, 0.7, tendrilField);
vec3 purpleTendrils = vec3(0.15, 0.0, 0.25) * (1.0 - purpleMask) * 0.35;

// subtract into the plasma so they carve thin filaments
sunColor -= purpleTendrils;

// === Decay cells (dark blue, sparse) ===
// lower frequency so only a few show up
float decayField = wave(uv * 3.5 + u_time * 0.4) * wave2(uv * 4.0 - u_time * 0.3);

// emphasize only the strongest pockets
float decayMask = smoothstep(0.75, 0.9, abs(decayField));

// dark blue, muted contribution
vec3 decayCells = vec3(0.05, 0.1, 0.4) * decayMask * 0.6;

// subtract into plasma → looks like eroded patches
sunColor -= decayCells * body;


    // === Combine ===
    vec3 color = sunColor + halo + tendrils;

    // keep background black
    color *= smoothstep(1.5, 0.9, r);

    fragColor = vec4(color, 1.0);
}
