#version 330 core

in vec3 vPos; //recieve from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;


#define TWO_PI 6.283

// took basics from -> https://www.shadertoy.com/view/MtVyWz

float D = 0.6;

float wave(vec2 p, float speed)
{
  float v = sin(p.x + sin(p.y*2.) + sin(p.y * 0.43)) ;
  return (v * mod(v,p.x) / p.y) * 100.0 / (u_time * speed); // unravel over time based on speed
}

const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);

float map(vec2 p, float speed)
{
  float v = wave(p, speed);
  p.x += (u_time+0.01) * 0.224 ;  p *= rot;  v += wave(p, speed);
  p.x += (u_time+0.01) * 0.333 / p.y;  p *= rot;  v += wave(p, speed) / p.x;
  return abs(1.5 - v + u_time / 10000);
}

vec3 Mucous_Membrane(vec2 pos, float speed)
{
  pos.y += (u_time+0.01) * 0.2;
  float v = map(pos, speed);

  // base: mostly white
  vec3 base = vec3(0.7, 0.9, 0.7); // green ish base 

  // streak color (blue-green cyan family), modulated by a lower-frequency map for variation
  float modf = map(pos * 0.12, speed);
  vec3 streakCol = vec3(0.4, 0.6, 1.00) * (0.6 + 0.6 * modf);

  // streak mask derived from the main field to keep structure intact
  float streakMask = smoothstep(0.35, 0.75, v);

  // combine: mostly white with streaks where mask is strong
  vec3 c = mix(base, streakCol, streakMask);

  // subtle additional local tint from a secondary low-frequency sample
  c = mix(c, vec3(0.85, 0.98, 1.0) * (0.85 + 0.15*modf), 0.12);

  // compute normal / lighting as before (keeps original shading behavior)
  vec3 n = normalize(vec3(v - map(vec2(pos.x + D, pos.y), speed), v - map(vec2(pos.x, pos.y + D), speed), -D));
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
  vec3 color = Mucous_Membrane(vPos.xy, 0.3);  // Pass u_speed here
  // keep a little global desaturation / tone like original
  color = color * 0.98 + vec3(0.01);
  fragColor = vec4(color, 1);
}