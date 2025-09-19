#version 330 core

in vec3 vPos;
in vec2 vUV;
out vec4 fragColor;

uniform float u_time;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);

// === Utility ===
float wave(vec2 p) {
    return sin(p.x + sin(p.y * 2.0) + sin(p.y * 0.43));
}

float easeInOut(float x) {
    return x * x * (3.0 - 2.0 * x);
}

float whiteout(float t, float trigger, float duration) {
    float fadeIn = clamp((t - trigger) / (duration * 0.5), 0.0, 1.0);
    float fadeOut = clamp((t - trigger - duration * 0.5) / (duration * 0.5), 0.0, 1.0);
    return easeInOut(fadeIn) * (1.0 - easeInOut(fadeOut));
}

// === Crushed 1 ===
float mapCrushed1(vec2 p, float time) {
    float v = wave(p);
    p.x += time * 0.224; p *= rot; v += wave(p);
    p.x += time * 0.333 / p.y; p *= rot; v += wave(p) / p.x;
    return abs(1.5 - v + time / 10000.0);
}

vec3 renderCrushed1(vec2 pos, float time, float fade) {
    pos.y += time * 0.2;
    float v = mapCrushed1(pos, time);
    vec3 base = mix(vec3(0.8, 0.9, 1.0), vec3(0.2, 0.6, 0.9), v);
    vec3 accent = vec3(0.5, 0.9, 0.7);
    vec3 c = mix(base, accent, 0.1 * mapCrushed1(pos * 0.1, time));
    vec3 n = normalize(vec3(
        v - mapCrushed1(vec2(pos.x + 0.6, pos.y), time),
        v - mapCrushed1(vec2(pos.x, pos.y + 0.6), time),
        -0.6
    ));
    vec3 l = normalize(vec3(0.1, 0.2, -0.5));
    float shade = dot(l, n) + pow(dot(l, n), 40.0);
    c *= shade * shade;
    return mix(vec3(1.0), c, fade);
}

// === Crushed 2 ===
float mapCrushed2(vec2 p, float time, float decay) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float swirl = (
        sin(radius * 6.0 - time * 1.5 + sin(p.y * 3.0)) * 0.15 +
        cos(radius * 3.5 + time * 0.9 + sin(p.x * 2.0)) * 0.07
    ) * decay;

    p = vec2(cos(angle + swirl) * radius, sin(angle + swirl) * radius);
    p *= rot;
    p += 0.2 * sin(p.yx * 1.5 + time * 0.3);

    float v = wave(p + sin(p * 0.7 + time * 0.4));
    return abs(1.6 - v + sin(time * 0.1));
}

vec3 renderCrushed2(vec2 pos, float time, float fade, float decay) {
    pos.y += time * 0.15;
    float v = mapCrushed2(pos, time, decay);
    vec3 base = mix(vec3(0.8, 0.9, 1.0), vec3(0.2, 0.6, 0.9), v);
    vec3 accent = vec3(0.5, 0.9, 0.7);
    vec3 c = mix(base, accent, 0.1 * mapCrushed2(pos * 0.12, time, decay));
    vec3 n = normalize(vec3(
        v - mapCrushed2(vec2(pos.x + 0.6, pos.y), time, decay),
        v - mapCrushed2(vec2(pos.x, pos.y + 0.6), time, decay),
        -0.6
    ));
    vec3 l = normalize(vec3(-0.2, 0.3, -0.6));
    float shade = dot(l, n) + pow(dot(l, n), 35.0);
    c *= shade * shade;
    return mix(vec3(1.0), c, fade);
}

// === Crushed 3 ===
float mapCrushed3(vec2 p, float time) {
    float v = wave(p);
    p.x += time * 0.3; p *= rot; v += wave(p);
    p.x += time * 0.28 / p.y; p *= rot; v += wave(p) / p.x;
    return abs(1.4 - v + time / 9000.0);
}

vec3 renderCrushed3(vec2 pos, float time, float fade, float darkness) {
    time *= 3.0;
    pos.y += time * 0.25;
    float v = mapCrushed3(pos, time);
    vec3 base = mix(vec3(0.2, 0.3, 0.4), vec3(0.02, 0.03, 0.07), darkness);
    vec3 accent = vec3(0.2, 0.5, 0.7);
    vec3 c = mix(base, accent, 0.1 * mapCrushed3(pos * 0.1, time));
    vec3 n = normalize(vec3(
        v - mapCrushed3(vec2(pos.x + 0.6, pos.y), time),
        v - mapCrushed3(vec2(pos.x, pos.y + 0.6), time),
        -0.6
    ));
    vec3 l = normalize(vec3(0.1, 0.2, -0.5));
    float shade = dot(l, n) + pow(dot(l, n), 38.0);
    c *= shade * shade;
    return mix(vec3(1.0), c, fade);
}

// === MAIN ===
void main() {
    vec2 uv = vPos.xy;
    float t = u_time;

    float fadeIn = smoothstep(0.0, 10.0, t);
    float fadeOutToNavy = smoothstep(153.0, 168.0, t); // fade starts 10 seconds earlier

    float speed = (t < 47.0) ? mix(0.05, 2.5, t / 47.0) :
                  (t < 77.0) ? mix(0.2, 2.8, (t - 47.0) / 30.0) :
                               mix(3.0, 0.05, (t - 77.0) / (168.0 - 77.0));
    float time = t * speed;

    vec3 col;
    float decay = 1.0 - smoothstep(47.0, 77.0, t);
    float darken = smoothstep(77.0, 168.0, t);

    float t1 = 47.0;
    float t2 = 77.0;
    float transitionDur = 2.0;

    float w1 = whiteout(t, t1, transitionDur);
    float w2 = whiteout(t, t2, transitionDur);

    if (t < t1) {
        col = renderCrushed1(uv, time, fadeIn);
    } else if (t < t1 + transitionDur) {
        float blend = easeInOut((t - t1) / transitionDur);
        vec3 a = renderCrushed1(uv, time, fadeIn);
        vec3 b = renderCrushed2(uv, time, fadeIn, decay);
        col = mix(mix(a, b, blend), vec3(1.0), w1 * 0.7);
    } else if (t < t2) {
        col = renderCrushed2(uv, time, fadeIn, decay);
    } else if (t < t2 + transitionDur) {
        float blend = easeInOut((t - t2) / transitionDur);
        vec3 a = renderCrushed2(uv, time, fadeIn, decay);
        vec3 b = renderCrushed3(uv, time, fadeIn, darken);
        col = mix(mix(a, b, blend), vec3(1.0), w2 * 0.7);
    } else {
        col = renderCrushed3(uv, time, fadeIn, darken);
    }

    vec3 navy = vec3(0.02, 0.03, 0.07);
    col = mix(col, navy, fadeOutToNavy);

    fragColor = vec4(col, 1.0);
}
