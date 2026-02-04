#version 330 core

in vec3 vPos;
in vec2 vUV;
out vec4 fragColor;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);
uniform float u_time;


float wave(vec2 p) {
    return sin(p.x + sin(p.y * 2.0) + sin(p.y * 0.43));
}


void main() {
    vec2 uv = vPos.xy;
    float t = u_time;
    vec3 col = vec3(0.0);

    // example element call:
    float v = wave(uv);
    col = mix(vec3(0.8, 0.9, 1.0), vec3(0.2, 0.6, 0.9), v);

    col = mix(col, vec3(0.9, 0.03, 0.07), 0.1);

    fragColor = vec4(col, 1.0);
}
