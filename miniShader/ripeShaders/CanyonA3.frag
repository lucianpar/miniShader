#version 330 core

in vec3 vPos; // receive from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;
uniform float onset;
uniform float flux;

#define T u_time
#define r(v,t) { float a = (t)*T, c=cos(a),s=sin(a); v*=mat2(c,s,-s,c); }
#define SQRT3_2  1.26
#define SQRT2_3  1.732
#define smin(a,b) (1./(1./(a)+1./(b)))

// --- noise functions from https://www.shadertoy.com/view/XslGRr
// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

const mat3 m = mat3( 0.00,  0.80,  0.60,
                       -0.80,  0.36, -0.48,
                     -0.60, -0.48,  0.64 );

float hash( float n ) {
    return fract(sin(n)*43758.5453);
}

float noise( in vec3 x ) { // in [0,1]
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f*f*(3.-2.*f);

    float n = p.x + p.y*57. + 113.*p.z;

    float res = mix(mix(mix( hash(n+  0.), hash(n+  1.),f.x),
                        mix( hash(n+ 57.), hash(n+ 58.),f.x),f.y),
                    mix(mix( hash(n+113.), hash(n+114.),f.x),
                        mix( hash(n+170.), hash(n+171.),f.x),f.y),f.z);
    return res;
}

float fbm( vec3 p ) { // in [0,1], reduced to 1 octave for max efficiency
    return 0.5 * noise(p);
}
// --- End of: Created by inigo quilez --------------------

// --- more noise

#define snoise(x) (2.*noise(x)-1.)

float sfbm( vec3 p ) { // in [-1,1], reduced to 1 octave
    return 0.5 * snoise(p);
}

#define sfbm3(p) vec3(sfbm(p), sfbm(p-327.67), sfbm(p+327.67))

// Adapted for 2D, using procedural color instead of texture, simplified
vec4 proceduralTexture(vec2 t) {
    float fb = fbm(vec3(t, T));
    return vec4(fb, fb, fb, 1.0); // simplified to single fbm
}

// Render Swirl (modularized)
vec4 renderSwirl(float speed, float size) {
    // efficient UV handling: assume vPos in [-1,1], scale and center with size parameter
    vec2 w = vPos.xy * 400.0 * size + vec2(400.0, 300.0); // scale UV with size
    vec4 p = vec4(w, 0, 1) / vec4(600.0, 600.0, 1.0, 1.0) - 0.5;
    p.x -= 0.4;
    vec4 d = p;
    p.z += 10.0;

    vec4 bg = vec4(0, 0, 0, 0);
    vec4 frag = bg;
    float x = 1e9;

    for (float i = 1.0; i > 0.0; i -= 0.05) {
        if (frag.x >= 0.99) break;

        vec4 u = 0.03 * floor(p / vec4(8, 8, 1, 1) + 3.5);
        vec4 t = p;
        r(t.xy, u.x);
        r(t.xz, u.y);

        // simplified displacement: scale with size
        vec3 disp = sfbm3(t.xyz / (2.0 * size) + vec3(0.5 * T * speed, 0, 0)) * (0.6 + 8.0 * (0.5 - 0.5 * cos(T * speed / 16.0)));
        t.xyz += disp;

        // simplified texture: single fbm call
        float tex = fbm(vec3(t.xy, T * speed));
        vec4 c = vec4(tex, tex, tex, 1.0) * 5.0;

        x = abs(mod(length(t.xyz), 1.0) - 0.5);
        float x1 = length(t.xyz) - 7.0;
        x = max(x, x1);
        if ((x1 > 0.1) && (p.z < 0.0)) break;

        if (x < 0.01) {
            frag += c * 1.0;
            x = 0.1;
        }

        p += d * x;
    }

    frag += vec4(0.05); // small ambient
    return frag;
}

void main() {
    fragColor = renderSwirl(5.0, 1.0); // default speed and size
}