#version 330 core

in vec3 vPos;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

// === UTILITIES (kept, corrected) ===
float gyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbm(vec3 seed) {
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; ++i) {
        seed.z += result * 0.5;
        result += abs(gyroid(seed / a)) * a;
        a *= 0.5;
    }
    return clamp(result, 0.0, 1.0);
}

// === SMOKE 3 (HOLLOW MESH) ===
// Now takes rotation (radians) and speed multipliers as parameters.
vec4 shaderHollowMesh(vec2 uv, float t, float rotation, float speed) {
    // apply rotation around center
    float c = cos(rotation), s = sin(rotation);
    mat2 R = mat2(c, -s, s, c);
    vec2 uvR = (uv - 0.5) * R + 0.5;

    // SPEED: scale time
    float T = t * speed;

    float scale = 0.5;
    vec3 p = vec3(uvR * scale, T * 0.12);

    float field = fbm(p / 2.0);
    field += 0.35 * fbm(p * 4.4 + vec3(12.3, 4.1, T * 0.08));

    float center = 0.8;
    float thickness = 0.13;
    float hollow = 0.30;

    float outer = smoothstep(center - thickness * 0.5, center + thickness * 0.5, field);
    float inner = smoothstep(center - thickness * 0.5 + thickness * hollow,
                             center + thickness * 0.5 - thickness * hollow, field);
    float shell = clamp(outer - inner, 0.0, 1.0);

    // sample neighbors for gradient (used to detect edges/outlines)
    float eps = 0.005;
    float fx = fbm(vec3((uvR + vec2(eps, 0.0)) * scale * 2.0, T * 0.12));
    float bx = fbm(vec3((uvR - vec2(eps, 0.0)) * scale * 2.0, T * 0.12));
    float fy = fbm(vec3((uvR + vec2(0.0, eps)) * scale * 2.0, T * 0.12));
    float by = fbm(vec3((uvR - vec2(0.0, eps)) * scale * 2.0, T * 0.12));
    vec2 grad = vec2(fx - bx, fy - by) / (2.0 * eps);
    float g = length(grad);

    // high-contrast outline: detect strong gradients and modulate by shell/mesh presence
    float edgeLow = 0.008;
    float edgeHigh = 0.035;
    float edge = smoothstep(edgeLow, edgeHigh, g);
    // restrict outlines to regions where shells exist (avoid noise elsewhere)
    float meshMask = clamp(shell, 0.0, 1.0);
    float outline = edge * meshMask;
    // boost and sharpen the outline
    outline = pow(outline, 0.6) * 1.25;
    outline = clamp(outline, 0.0, 1.0);

    // lighting for outline (bright)
    vec3 n = normalize(vec3(grad, 0.02));
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.5));
    float diff = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - max(0.0, dot(n, vec3(0.0, 0.0, 1.0))), 2.0);

    // bright white outline color
    vec3 outlineCol = vec3(1.0) * (0.9 + 0.6 * diff) + 0.5 * rim;

    // non-outline (background) forced to pure black
    vec3 bgCol = vec3(0.0);

    // final: only show bright outlines (background fully black)
    vec3 finalCol = outlineCol * outline + bgCol * (1.0 - outline);

    // alpha follows outline (opaque on lines, transparent elsewhere)
    float alpha = outline;

    return vec4(finalCol, alpha);
}

// === MAIN ===
void main() {
    vec2 uv = vPos.xy / 2.0;
    float t = u_time;

    // primary (foreground) hollow mesh
    float rotationA = 0.0;
    float speedA = 10.0;
    vec4 layerA = shaderHollowMesh(uv, t, rotationA, speedA);

    // secondary (background) hollow mesh offset by 170 degrees for depth
    float rotOffset = 170.0 * 3.14159265359 / 180.0;
    float rotationB = rotOffset;
    float speedB = 5.2; // slightly different speed for parallax feel
    vec4 layerB = shaderHollowMesh(uv, t, rotationB, speedB);

    // composite: background darker and slightly dimmed, foreground on top
    vec3 bgBlend = layerB.rgb * 0.6;
    vec3 fgBlend = layerA.rgb * layerA.a;
    vec3 finalRGB = bgBlend * (1.0 - layerA.a) + fgBlend; // simple over with bg dimming
    float finalA = clamp(layerA.a + layerB.a * 0.5, 0.0, 1.0);

    // fade in/out
    float fadeIn = smoothstep(0.0, 3.0, t);
    float fadeOut = smoothstep(481.0, 491.0, t);

    finalRGB *= fadeIn;
    finalRGB = mix(finalRGB, vec3(1.0), fadeOut);
    finalA *= fadeIn;
    finalA = mix(finalA, 1.0, fadeOut);

    fragColor = vec4(finalRGB, finalA);
}