#version 330 core

in vec3 vPos; // receive from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

float swirlSize = 1.0; // initial value, but will be overridden

#define T u_time
#define r(v,t) { float a = (t)*T, c=cos(a),s=sin(a); v*=mat2(c,s,-s,c); }

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

// Render Swirl (modularized)
vec4 renderSwirl(float speed, float size, float pzIn, vec4 bg, float thickness) {
    // efficient UV handling: assume vPos in [-1,1], scale and center with size parameter
    vec2 w = vPos.xy * 400 * size + vec2(400.0, 300.0); // scale UV with size
    vec4 p = vec4(w, 0, 1) / vec4(600.0, 600.0, 1.0, 1.0) - 0.5;
    vec4 d = p;
    p.z += 20.0 - pzIn; // reduced forward motion for better effect
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
        vec4 c = vec4(tex, tex, tex, 1.0) * thickness; // use thickness parameter

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

// --- Functions from CanyonC5 ---

#define TWO_PI 6.283

float D_c5 = 0.6;
const float STOP_FRACTAL = 20.0; // rate of chaos increase

// Gyroid function for cellular texture
float gyroid(vec3 seed)
{
    return dot(sin(seed), cos(seed.yzx));
}

// Fractal Brownian Motion using gyroid noise
float fbm_c5(vec3 seed)
{
    float result = 0.0, a = 0.5;
    for (int i = 0; i < 6; ++i)
    {
        seed.z += result * 0.5;
        result += (gyroid(seed / a)) * a; // formerly abs(gyroid(...))
        a /= 2.0;
    }
    return result;
}

// Sliding noise texture based on gyroid fbm
float noise_c5(vec2 p)
{
    vec3 seed = vec3(p, length(p) - u_time * 0.1 / (u_time/1000.0)) * 1.0;
    return sin(fbm_c5(seed) * 6.0 + u_time) * 0.5 + 0.5;
}

float wave_c5(vec2 p, float speed)
{
  float v = sin(p.x + sin(p.y*2.) + sin(p.y * 0.43)) ;
  return (v * mod(v,p.x) / p.y) * 100.0 / (u_time * speed); // unravel over time based on speed
}

const mat2 rot_c5 = mat2(0.5, 0.86, -0.86, 0.5);

float map(vec2 p, float speed)
{
  // Process uv coords with matrix math fractal
  float t = u_time * speed * 0.1;
  // Old fractal angle changing: slowly stops turning over time
  float angle = t / (1.0 + u_time * 0.05); // rotations slow down and approach zero. crazy results when increasing!
  float k = cos(angle);
  float l = sin(angle);
  float s = 1.0;
  // Chaos factor that increases over time to unravel the fractal
  float chaosFactor = u_time * 0.005; // slow accumulation of chaos // play with / change this value, 0riginally 0.005
  
  for(int i=0; i<15; ++i) {  // iterative folding for fractal structure
      p.x = abs(p.x) - s; //experiment here
      p *= mat2(k*1.001, l*1.00001, l*0.9999999999999, -k*0.99); // subtle rotation
      s *= 0.95 - chaosFactor * 0.05; // scale down, but unravel with chaos
  }
  
  // Apply chaotic distortion to p based on chaos factor
  vec2 distortedP = p + chaosFactor * 0.2 * vec2(noise_c5(p * 2.0), noise_c5(p * 2.0 + vec2(5.0, 5.0)));
  
  // Base structure from CanyonC2 on the fractal-processed coords
  float v = wave_c5(distortedP, speed);
  distortedP.x += (u_time+0.01) * 0.224 ;  distortedP *= rot_c5;  v += wave_c5(distortedP, speed);
  distortedP.x += (u_time+0.01) * 0.333 / distortedP.y;  distortedP *= rot_c5;  v += wave_c5(distortedP, speed) / distortedP.x;
  
  return abs(1.5 - v + u_time / 10000);
}

vec3 Mucous_Membrane(vec2 pos, float speed, float thickness)
{
  // reflect outward from center by taking absolute value for symmetry
  vec2 p = abs(pos);
  p.y += (u_time+0.01) * 0.2;
  float v = map(p, speed);

  // base: mostly white
  vec3 base = vec3(1.0, 0.855, 0.0); // gold ish base 

  // streak color (blue-green cyan family), modulated by a lower-frequency map for variation
  float modf = map(p * 0.12, speed);
  vec3 streakCol = vec3(0.4, 0.6, 1.00) * (0.6 + 0.6 * modf);

  // streak mask derived from the main field to keep structure intact
  float streakMask = smoothstep(0.35, 0.8 * thickness, v);

  // combine: mostly white with streaks where mask is strong
  vec3 c = mix(base, streakCol, streakMask);

  // subtle additional local tint from a secondary low-frequency sample
  c = mix(c, vec3(0.85, 0.98, 1.0) * (0.85 + 0.15*modf), 0.12);

  // compute normal / lighting as before (keeps original shading behavior)
  vec3 n = normalize(vec3(v - map(vec2(p.x + D_c5, p.y), speed), v - map(vec2(p.x, p.y + D_c5), speed), -D_c5));
  vec3 l = normalize(vec3(0.1, 0.2, -0.5));
  float shade = dot(l, n) + pow(max(dot(l, n), 0.0), 40.0);

  // emphasize streaks under lighting: boost blue/green channels where lighting is strong
  c.g += 0.25 * streakMask * shade;
  c.b += 0.35 * streakMask * shade;

  // small contrast tweak and desaturation to keep whites dominant
  c = clamp(c * (0.92 + 0.16 * shade), 0.0, 1.0);

  return c;
}

void main() {
    float t = u_time;
    if (t < 88.0) {
        // PART A - swirl, mimicking CanyonA3 behavior with slowed growth
        if (t < 5.0) {
            swirlSize = 0.05 * t; // start even smaller, barely visible
        } else {
            swirlSize = 0.35 * (t - 5.0); // then start growth
        }
        float swirlSpeed = 4.0;
        if (t > 6.0 && t < 41.0) {
            // begin unraveling
            swirlSpeed = 4.0 + (t - 6.0) / (41.0 - 6.0) * 2.0; // 4 to 6
        } else if (t > 41.0 && t < 70.0) {
            // unraveling speeds up to 70
            swirlSpeed = 6.0 + (t - 41.0) / (70.0 - 41.0) * 4.0; // 6 to 10 at 70
        } else if (t > 70.0 && t < 88.0) {
            // begin slowing down much slower
            swirlSpeed = 10.0 - (t - 70.0) / (88.0 - 70.0) * 5.0; // 10 to 5.0, slower reversal
        }

        float opacity = 1.0;
        if (t < 6.0) {
            opacity = t / 6.0; // fade in
        }

        // Golden transition: subtle yellow tint from 70, gradually white background from 76, keep orb-like
        vec4 bg = vec4(0, 0, 0, 0);
        vec3 tint = vec3(1.0);
        float size = 1.0;
        float thickness = 5.0;
        if (t > 70.0 && t < 88.0) {
            float tintFactor = (t - 70.0) / (88.0 - 70.0);
            tint = mix(vec3(1.0), vec3(1.0, 0.95, 0.9), tintFactor); // subtle yellow tint
        }
        if (t > 76.0 && t < 88.0) {
            float bgFactor = (t - 76.0) / (88.0 - 76.0);
            bg = mix(vec4(0, 0, 0, 0), vec4(1.0, 1.0, 1.0, 0), bgFactor); // gradually white background
            // fade out swirl as white fades in
            opacity *= (1.0 - bgFactor);
        }

        vec4 swirlColor = renderSwirl(swirlSpeed, size, swirlSize, bg, thickness); // keep size and thickness constant

        swirlColor.rgb *= tint;
        swirlColor.rgb *= opacity; // apply fade in

        fragColor = swirlColor;
    } else if (t < 242.0) {
        // PART B - mucous membrane fractal
        float localT = t - 89.0;
        float speed = 0.3;
        if (localT < 24.0) { // 1:29 to 1:53, starts slow
            speed = 0.3;
        } else if (localT < 106.0) { // 1:53 to 3:15, speeds up
            speed = 0.3 + (localT - 24.0) / (106.0 - 24.0) * 0.7; // 0.3 to 1.0
        } else if (localT < 131.0) { // 3:15 to 3:40, slows down
            speed = 1.0 - (localT - 106.0) / (131.0 - 106.0) * 0.7; // 1.0 to 0.3
        } else {
            speed = 0.3; // very slow, cease fractal motion
        }

        vec3 color = Mucous_Membrane(vPos.xy, speed, 1.0);
        color = color * 0.98 + vec3(0.01);
        fragColor = vec4(color, 1);
    } else {
        // 3:50 to 4:02, fade to black
        float fade = 1.0 - (t - 230.0) / (242.0 - 230.0);
        fade = clamp(fade, 0.0, 1.0);
        fragColor = vec4(0.0, 0.0, 0.0, fade);
    }

    // Smooth fade from golden swirl to membrane, ended at 88s to avoid lingering white
    if (t >= 76.0 && t < 88.0) {
        vec3 membraneColor = Mucous_Membrane(vPos.xy, 0.3, 1.0);
        float blend = (t - 76.0) / 12.0; // adjusted duration to 12 seconds
        fragColor.rgb = mix(fragColor.rgb, membraneColor, blend);
    }
}