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
    for (int i = 0; i < 5; ++i) {
        seed.z += result * 0.5;
        result += abs(gyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// === SMOKE 1 ===
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

    vec3 baseColor = mix(vec3(0.1, 0.4, 0.9), vec3(0.6, 0.1, 0.15), 0.5 + 0.5 * sin(t * 0.9 + n1 * 2.5));

    vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
    vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
    vec3 color1 = 0.3 * pow(dot(normal1, light1), 2.5)
                + 0.2 * pow(dot(normal1, light2), 4.5)
                + baseColor * n1 * core1;

    color1 *= n1 * core1;
    color1 += 0.02 * vec3(cos(t), 0.0, sin(t * 0.3));
    float alpha1 = 0.12 + 0.4 * core1 * n1;

    float inner = internalMembrane(uv, t) * core1;
    vec3 finalColor = color1 + vec3(0.2, 0.05, 0.1) * inner * 0.4;
    float finalAlpha = alpha1 + 0.2 * inner;

    return vec4(finalColor, finalAlpha);
}

// === SMOKE 2 ===
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

    vec3 color = mix(vec3(0.15, 0.2, 0.3), vec3(0.5, 0.1, 0.2), 0.5 + 0.5 * sin(t + total * 2.0));
    float alpha = 0.05 + 0.3 * total;

    return vec4(color * total, alpha);
}

// === SMOKE 3 ===
float engulfMask(vec2 uv, float t) {
    float s = 0.5 + 0.5 * sin(t * 0.2);
    return smoothstep(s, s - 0.3, length(uv - vec2(-0.6, 0.0)));
}

vec4 shaderSmoke3(vec2 uv, float t) {
    // Fullscreen scaling
    uv *= 0.25;

    // Gentle organic drift
    uv += 0.25 * vec2(
        sin(uv.y * 1.5 + t * 0.3),
        cos(uv.x * 1.3 - t * 0.25)
    ) * fbm(vec3(uv * 1.5, t * 0.1));

    float smoke = fbm(vec3(uv * 2.5, t * 0.08)) * 1.2;

    // Soften previous masking — now more ambient and always active
    float pulse = 0.6 + 0.3 * sin(t * 0.15);
    float ambientMask = smoothstep(pulse + 0.4, pulse - 0.2, length(uv - vec2(0.0)));

    float intensity = pow(smoke, 2.0) * ambientMask;

    vec3 color = mix(vec3(0.2, 0.3, 0.4), vec3(0.4, 0.1, 0.1), 0.5 + 0.5 * sin(t * 0.15 + smoke * 4.0));

    return vec4(color * intensity, 0.08 + 0.5 * intensity);
}


// === FOAM BUBBLE ===
float metaballField(vec2 uv, float t) {
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

vec4 shaderFoamBubble(vec2 uv, float t) {
    uv = vPos.xy / 7.0;
    float meta = metaballField(uv, t);
    float warp = smoothstep(0.6, 3.5, meta);
    float pulse = 1.0 + 0.2 * sin(t * 0.8 + meta * 2.0);

    vec2 drift = vec2(
        sin(meta * 1.5 + t * 0.6),
        cos(meta * 1.7 + t * 0.5)
    );
    vec2 warpedUV = uv + 0.33 * warp * pulse * drift;

    warpedUV += 0.05 * vec2(
        sin(fbm(vec3(uv, t * 0.13)) * 8.0 + t),
        cos(fbm(vec3(uv.yx, t * 0.11)) * 6.0 - t)
    );

    float n = fbm(vec3(warpedUV * 0.95, t * 0.07));
    vec3 normal = normalize(vec3(
        n - fbm(vec3(warpedUV + vec2(0.015, 0.0), t * 0.07)),
        n - fbm(vec3(warpedUV + vec2(0.0, 0.015), t * 0.07)),
        0.3 + (t / 140.0)
    ));

    vec3 baseColor = mix(vec3(0.08, 0.15, 0.4), vec3(0.2, 0.05, 0.02), 0.5 + 0.5 * sin(t * 0.9 + meta * 2.5));

    vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
    vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
    vec3 color = 0.3 * pow(dot(normal, light1), 2.5)
               + 0.2 * pow(dot(normal, light2), 4.5)
               + baseColor * n;

    color *= n * warp;
    color += 0.02 * vec3(cos(t), 0.0, sin(t * 0.3));

    return vec4(color, 0.12 + 0.4 * warp);
}

// === MAIN ===
void main() {
    vec2 uv = vPos.xy / 10.0; // have tried 15 also
    float t = u_time;

    float rampUp = smoothstep(0.0, 300.0, t);
    float rampDown = 1.0 - smoothstep(300.0, 491.0, t);
    float speedScale = mix(0.2, 2.5, rampUp);
    speedScale = mix(speedScale, 0.05, 1.0 - rampDown);
    float modulatedTime = t * speedScale;

    float sectionTime = 491.0 / 4.0;
    float segment = mod(t, 491.0);
    float blend = 0.0;

    vec4 c1, c2;

    if (segment < sectionTime) {
        c1 = shaderSmoke1(uv, modulatedTime);
        c2 = shaderSmoke2(uv, modulatedTime);
        blend = smoothstep(sectionTime - 6.0, sectionTime, segment);
    } else if (segment < 2.0 * sectionTime) {
        c1 = shaderSmoke2(uv, modulatedTime);
        c2 = shaderSmoke3(uv, modulatedTime);
        blend = smoothstep(2.0 * sectionTime - 6.0, 2.0 * sectionTime, segment);
    } else if (segment < 3.0 * sectionTime) {
        c1 = shaderSmoke3(uv, modulatedTime);
        c2 = shaderFoamBubble(uv, modulatedTime);
        blend = smoothstep(3.0 * sectionTime - 6.0, 3.0 * sectionTime, segment);
    } else {
        c1 = shaderFoamBubble(uv, modulatedTime);
        c2 = shaderSmoke1(uv, modulatedTime);
        blend = smoothstep(491.0 - 6.0, 491.0, segment);
    }

    vec4 finalColor = mix(c1, c2, blend);

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
