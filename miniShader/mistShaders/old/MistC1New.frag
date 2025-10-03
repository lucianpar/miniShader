#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;
// uniform float onset;
// uniform float cent;
// uniform float flux;

#define TWO_PI 6.283

// === UTILITIES ===
float gyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbm(vec3 seed) {
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 10; ++i) {  // Further increased iterations for even more detail
        seed.z += result * 0.5;
        result += abs(gyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// === SMOKE 1 (Modified for grey misty effect) ===
float organismPresence(vec2 uv, float t) {
    vec2 center = vec2(0.2 * sin(t * 0.3), 0.2 * cos(t * 0.2));
    float radius = 0.45 + 0.15 * sin(t * 0.7);
    float d = length(uv - center);
    return smoothstep(radius * 1.2, radius, d);
}

float internalMembrane(vec2 uv, float t) {
    float pulse = sin(t * 0.6 + uv.x * 5.0) * cos(t * 0.4 + uv.y * 7.0);
    float band = smoothstep(0.2, 0.5, pulse);
    float fb = fbm(vec3(uv * 3.0, t * 0.1));
    return mix(0.0, fb, band);
}

vec4 shaderSmoke1(vec2 uv, float t) {
    uv = vPos.xy / 15.0;
    vec2 drift = vec2(
        sin(uv.y * 1.5 + t * 0.3),
        cos(uv.x * 1.3 - t * 0.25)
    );
    uv += 0.15 * drift * fbm(vec3(uv * 1.5, t * 0.1));

    float n1 = fbm(vec3(uv * 1.2, t * 0.07  * 0.001));
    float core1 = organismPresence(uv, t);

    vec3 normal1 = normalize(vec3(
        n1 - fbm(vec3(uv + vec2(0.01, 0.0), t * 0.07)),
        n1 - fbm(vec3(uv + vec2(0.0, 0.01), t * 0.07)),
        0.3 + (t / 140.0)
    ));

    // Modified for grey misty colors (subtle greys and whites)
    vec3 baseColor = mix(vec3(0.7, 0.7, 0.7), vec3(0.9, 0.9, 0.9), 0.5 + 0.5 * sin(t * 0.9 + n1 * 2.5));

    vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
    vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
    vec3 color1 = 0.3 * pow(dot(normal1, light1), 2.5)
                + 0.2 * pow(dot(normal1, light2), 4.5)
                + baseColor * n1 * core1;

    color1 *= n1 * core1;
    color1 += 0.02 * vec3(0.8, 0.8, 0.8);  // Grey tint
    float alpha1 = 0.12 + 0.4 * core1 * n1;

    float inner = internalMembrane(uv, t) * core1;
    vec3 finalColor = color1 + vec3(0.1, 0.1, 0.1) * inner * 0.4;  // Darker grey accents
    float finalAlpha = alpha1 + 0.2 * inner;

    return vec4(finalColor, finalAlpha);
}

// === SMOKE 2 (Modified for grey misty effect) ===
float smokePuff(vec2 uv, float t, int i) {
    float fi = float(i);
    vec2 center = 0.6 * vec2(
        sin(t * 0.4 + fi * 1.2),
        cos(t * 0.3 + fi * 1.7)
    );
    float radius = 0.15 + 0.05 * sin(t * 0.5 + fi * 0.7);
    float dist = length(uv - center);
    return smoothstep(radius, 0.0, dist);
}

vec4 shaderSmoke2(vec2 uv, float t) {
    uv = vPos.xy / 10.0;
    uv += 0.1 * vec2(sin(t * 0.2), cos(t * 0.25));

    float total = 0.0;
    for (int i = 0; i < 6; ++i) {
        total += smokePuff(uv, t, i);
    }

    vec2 drift = vec2(sin(total + t * 0.4), cos(total + t * 0.3));
    uv += 0.05 * total * drift;

    float n = fbm(vec3(uv * 1.5, t * 0.07));
    total *= n;

    // Modified for grey misty colors
    vec3 color = mix(vec3(0.6, 0.6, 0.6), vec3(0.8, 0.8, 0.8), 0.5 + 0.5 * sin(t + total * 2.0));
    float alpha = 0.05 + 0.3 * total;

    return vec4(color * total, alpha);
}

// === SMOKE 3 (REPLACED) -> Hollow mesh version ===
vec4 shaderHollowMesh(vec2 uv, float t) {
    // higher-frequency field for a fine mesh
    float scale =0.5;
    vec3 p = vec3(uv * scale, t * 0.03);

    // scalar density field (fbm already in file)
    float field = fbm(p /2.0);

    // add a secondary modulation to break regularity
    field += 0.35 * fbm(p * 4.4 + vec3(12.3,4.1,t*0.02));

    // band parameters control thickness and hollowness
    float center = 0.55;       // iso value for shell center
    float thickness = 0.13;    // overall band thickness
    float hollow = 0.30;       // fraction of thickness that is hollow (inner cutout)

    // smooth band (outer)
    float outer = smoothstep(center - thickness*0.5, center + thickness*0.5, field);
    // inner cutout band shifted inward
    float inner = smoothstep(center - thickness*0.5 + thickness*hollow, center + thickness*0.5 - thickness*hollow, field);
    // shell is outer minus inner -> hollow mesh
    float shell = clamp(outer - inner, 0.0, 1.0);

    // compute surface normal from the scalar field (finite differences)
    float eps = 0.005;
    float fx = fbm(vec3((uv + vec2(eps,0.0)) * scale * 2.0, t * 0.03));
    float bx = fbm(vec3((uv - vec2(eps,0.0)) * scale * 2.0, t * 0.03));
    float fy = fbm(vec3((uv + vec2(0.0,eps)) * scale * 2.0, t * 0.03));
    float by = fbm(vec3((uv - vec2(0.0,eps)) * scale * 2.0, t * 0.03));
    vec3 n = normalize(vec3(fx - bx, fy - by, 0.02));

    // lighting for shell: crisp highlight + subtle rim
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.5));
    float diff = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - max(0.0, dot(n, vec3(0.0,0.0,1.0))), 2.0);

    // color: monochrome mesh (slightly warm white)
    vec3 shellCol = vec3(0.95, 0.95, 0.9) * (0.5 + 0.6 * diff) + 0.35 * rim;

    // add faint ambient background from low-frequency field
    float bg = smoothstep(0.1, 0.6, fbm(vec3(uv * 1.2, t * 0.01)));
    vec3 bgCol = mix(vec3(0.15), vec3(0.25), bg) * 0.25;

    // animate subtle breathing / displacement of shell edges
    float pulse = 0.25 * sin(t * 0.6 + field * 6.0);
    float anim = smoothstep(0.0, 0.1, abs(pulse)) * 0.6;
    shell *= 1.0 + anim;

    // final composite
    vec3 col = bgCol + shellCol * shell;
    float alpha = clamp(shell * 1.0 + 0.02 * bg, 0.0, 1.0);

    return vec4(col, alpha);
}

// // === FOAM BUBBLE (Modified for grey misty effect) ===
// float metaballField(vec2 uv, float t) {
//     float field = 0.0;
//     for (int i = 0; i < 7; ++i) {
//         float fi = float(i);
//         vec2 center = 1.2 * vec2(
//             sin(t * 0.27 + fi * 1.3) + cos(fi + t * 0.11),
//             cos(t * 0.19 + fi * 1.6) + sin(fi * 0.4 + t * 0.29)
//         );
//         float radius = 0.35 + 0.25 * sin(t * 0.23 + fi * 0.8);
//         float dist = length(uv - center) + 0.003;
//         field += radius / dist;
//     }
//     return field;
// }

// vec4 shaderFoamBubble(vec2 uv, float t) {
//     uv = vPos.xy / 7.0;
//     float meta = metaballField(uv, t);
//     float warp = smoothstep(0.6, 3.5, meta);
//     float pulse = 1.0 + 0.2 * sin(t * 0.8 + meta * 2.0);

//     vec2 drift = vec2(
//         sin(meta * 1.5 + t * 0.6),
//         cos(meta * 1.7 + t * 0.5)
//     );
//     vec2 warpedUV = uv + 0.33 * warp * pulse * drift;

//     warpedUV += 0.05 * vec2(
//         sin(fbm(vec3(uv, t * 0.13)) * 8.0 + t),
//         cos(fbm(vec3(uv.yx, t * 0.11)) * 6.0 - t)
//     );

//     float n = fbm(vec3(warpedUV * 0.95, t * 0.07));
//     vec3 normal = normalize(vec3(
//         n - fbm(vec3(warpedUV + vec2(0.015, 0.0), t * 0.07)),
//         n - fbm(vec3(warpedUV + vec2(0.0, 0.015), t * 0.07)),
//         0.3 + (t / 140.0)
//     ));

//     // Modified for grey misty colors
//     vec3 baseColor = mix(vec3(0.6, 0.6, 0.6), vec3(0.8, 0.8, 0.8), 0.5 + 0.5 * sin(t * 0.9 + meta * 2.5));

//     vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
//     vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
//     vec3 color = 0.3 * pow(dot(normal, light1), 2.5)
//                + 0.2 * pow(dot(normal, light2), 4.5)
//                + baseColor * n;

//     color *= n * warp;
//     color += 0.02 * vec3(0.7, 0.7, 0.7);  // Grey tint

//     return vec4(color, 0.12 + 0.4 * warp);
// }
// // 
// === MAIN (use hollow mesh) ===
void main() {
    vec2 uv = vPos.xy / 2.0;
    float t = u_time;

    // render hollow mesh instead of the dense smoke
    vec4 finalColor = shaderHollowMesh(uv, t);

    // === FADE IN from black ===
    float fadeIn = smoothstep(0.0, 3.0, t);
    finalColor.rgb *= fadeIn;
    finalColor.a *= fadeIn;

    // === FADE OUT to white ===
    float fadeOut = smoothstep(481.0, 491.0, t);
    finalColor.rgb = mix(finalColor.rgb, vec3(1.0), fadeOut);
    finalColor.a = mix(finalColor.a, 1.0, fadeOut);

    fragColor = finalColor;
}