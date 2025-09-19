#version 330 core

in vec3 vPos;
in vec2 vUV;
out vec4 fragColor;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);
uniform float u_time;
const vec3 color0 = vec3(0.95, 0.85, 0.2);
const vec3 color1 = vec3(0.1, 0.55, 0.95);
const vec3 color2 = vec3(0.98, 0.2, 0.35);
// Quasicrystal from multiple rotated cos waves
float quasicrystal_0(vec2 p) {
  const int N = 7; // number of directions
  float sum = 0.0;
  for (int i = 0; i < N; i++) {
    float ang = (float(i) / float(N)) * PI; // half rotations avoid duplicates
    vec2 dir = vec2(cos(ang), sin(ang));
    sum += cos(dot(p * 6.0, dir) + u_time * 0.2);
  }
  sum /= float(N);
  return sum; // in [-1,1]
}
// texture: fbm tone-map (placeholder)
float fbmTone_0(float x){ return 0.5 + 0.5*sin(6.28318*x + 2.0*x); }
// Mandala-like radial kaleidoscope
float mandalaRadial_1(vec2 p) {
  float sectors = 10.0;
  float a = atan(p.y, p.x);
  float r = length(p);
  // fold angle into wedge and mirror for kaleidoscope
  float wedge = TWO_PI / sectors;
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5);
  // ring pattern + angular sin modulation
  float ring = 0.5 + 0.5 * sin(12.0 * r - u_time * 0.6);
  float petals = 0.5 + 0.5 * sin(8.0 * a + r * 6.0);
  return (ring * petals) - 0.5; // signed-ish value
}
vec3 blendOverlay_1(vec3 b, vec3 s) {
  vec3 lo = 2.0 * b * s;
  vec3 hi = 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
  return mix(lo, hi, step(0.5, b));
}
// Branch-like field via angular warping + ridged fbm
float n2hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p);
  float a=n2hash(i), b=n2hash(i+vec2(1,0)), c=n2hash(i+vec2(0,1)), d=n2hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float ridged(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*(1.0-abs(2.0*n2(p)-1.0)); p*=2.03; a*=0.5;} return s; }
float branchNoise_2(vec2 p) {
  float r = length(p) + 1e-3;
  float a = atan(p.y, p.x);
  // create preferred growth directions
  float forks = 5.0;
  float dir = cos(a * forks) * 0.5 + 0.5;
  float bark = ridged(p * vec2(2.0, 4.0) + vec2(0.0, u_time*0.15));
  float veins = ridged(vec2(a * 1.5, r * 3.0));
  float trunk = (0.35 / r) * dir; // stronger near center and branch angles
  return trunk + 0.5 * veins + 0.3 * bark - 0.8;
}

void main() {
    vec2 uv = vPos.xy;
    float t = u_time;
    vec3 col = vec3(0.0);

vec2 uv_0 = uv;
float val_0 = quasicrystal_0(uv_0);
val_0 = fbmTone_0(val_0);
// color usage: primary -> layerCol_i
vec3 layerCol_0 = mix(color0, color1, val_0);
col = mix(col, 1.0 - (1.0 - col)*(1.0 - layerCol_0), val_0);
vec2 uv_1 = uv;
// size for element 1
uv_1 = uv_1 / 0.720000;
float val_1 = mandalaRadial_1(uv_1);
// color usage: secondary -> layerCol_i
vec3 layerCol_1 = mix(color1, color2, val_1);
col = mix(col, blendOverlay_1(col, layerCol_1), val_1);
// Apply vertical symmetry to UVs
uv.y = abs(uv.y);
vec2 uv_2 = uv;
// size for element 2
uv_2 = uv_2 / 0.950000;
float val_2 = branchNoise_2(uv_2);
// color usage: default (grayscale) -> layerCol_i
vec3 layerCol_2 = vec3(val_2);
col = mix(col, col * layerCol_2, val_2);
    col = mix(col, vec3(0.02, 0.02, 0.04), 0.1);
    fragColor = vec4(col, 1.0);
}
