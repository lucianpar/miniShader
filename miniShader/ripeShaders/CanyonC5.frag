#version 330 core

in vec3 vPos; //recieve from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;


#define TWO_PI 6.283

// took basics from -> https://www.shadertoy.com/view/MtVyWz

float D = 0.6;
const float STOP_FRACTAL = 20.0; // rate of chaos increase

// Gyroid function for cellular texture
float gyroid(vec3 seed)
{
    return dot(sin(seed), cos(seed.yzx));
}

// Fractal Brownian Motion using gyroid noise
float fbm(vec3 seed)
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
float noise(vec2 p)
{
    vec3 seed = vec3(p, length(p) - u_time * 0.1 / (u_time/1000.0)) * 1.0;
    return sin(fbm(seed) * 6.0 + u_time) * 0.5 + 0.5;
}

float wave(vec2 p, float speed)
{
  float v = sin(p.x + sin(p.y*2.) + sin(p.y * 0.43)) ;
  return (v * mod(v,p.x) / p.y) * 100.0 / (u_time * speed); // unravel over time based on speed
}

const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);

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
  vec2 distortedP = p + chaosFactor * 0.2 * vec2(noise(p * 2.0), noise(p * 2.0 + vec2(5.0, 5.0)));
  
  // Base structure from CanyonC2 on the fractal-processed coords
  float v = wave(distortedP, speed);
  distortedP.x += (u_time+0.01) * 0.224 ;  distortedP *= rot;  v += wave(distortedP, speed);
  distortedP.x += (u_time+0.01) * 0.333 / distortedP.y;  distortedP *= rot;  v += wave(distortedP, speed) / distortedP.x;
  
  return abs(1.5 - v + u_time / 10000);
}

vec3 Mucous_Membrane(vec2 pos, float speed, float thickness)
{
  // reflect outward from center by taking absolute value for symmetry
  vec2 p = abs(pos);
  p.y += (u_time+0.01) * 0.2;
  float v = map(p, speed);

  // base: mostly white
  vec3 base = vec3(0.1, 0.4, 0.1); // green ish base 

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
  vec3 n = normalize(vec3(v - map(vec2(p.x + D, p.y), speed), v - map(vec2(p.x, p.y + D), speed), -D));
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
  vec3 color = Mucous_Membrane(vPos.xy, 0.3, 1.0);  // try changing speed - 0.3, Pass thickness here. trying out different values - 0.5,1,10.0
  // keep a little global desaturation / tone like original
  color = color * 0.98 + vec3(0.01);
  fragColor = vec4(color, 1);
}