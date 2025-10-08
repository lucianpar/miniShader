#version 330 core

in vec3 vPos; //recieve from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;


#define TWO_PI 6.283

// took basics from -> https://www.shadertoy.com/view/MtVyWz

float D = 0.6;
const float STOP_FRACTAL = 5.0; // rate of chaos increase

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
        result += abs(gyroid(seed / a)) * a;
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
  // Replaced sine-based wave with gyroid-based noise for fractal behavior
  vec3 seed = vec3(p, u_time * speed);
  float v = fbm(seed) * 2.0 - 1.0; // scale to -1 to 1 range
  return v;
}

const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);

float map(vec2 p, float speed)
{
  // Chaos factor that increases over time to unravel the fractal
  float chaosFactor = u_time * 0.005; // slow accumulation of chaos
  
  // Apply chaotic distortion to p based on chaos factor
  vec2 distortedP = p + chaosFactor * 0.2 * vec2(noise(p * 2.0), noise(p * 2.0 + vec2(5.0, 5.0)));
  
  // Modified map to incorporate iterative folding similar to reference shader
  float t = u_time * speed * 0.1;
  // Smoothly decrease rotation angle with increasing u_time, starting strong and fading to none over STOP_FRACTAL
  float rotationFade = 1.0 - smoothstep(0.0, STOP_FRACTAL, u_time);
  float angle = t * rotationFade; // rotations start full and decrease to zero smoothly
  float k = cos(angle);
  float l = sin(angle);
  float s = 1.0;
  
  // Reduce iterations based on rotationFade to eliminate fractal behavior at the end
  int maxIter = int(15.0 * rotationFade);
  for(int i=0; i<maxIter; ++i) {  // iterative folding for fractal structure
      distortedP.x = abs(distortedP.x) - s;
      distortedP *= mat2(k*1.001, l*1.00001, l*0.9999999999999, -k*0.99); // subtle rotation
      s *= 0.95 - chaosFactor * 0.05; // scale down, but unravel with chaos
  }
  
  float v = wave(distortedP, speed);
  return abs(1.5 - v + u_time / 10000); // keep original structure but with new wave
}

vec3 Mucous_Membrane(vec2 pos, float speed, float thickness)
{
  // reflect outward from center by taking absolute value for symmetry
  vec2 p = pos; //formerly abs(pos);
  p.y += (u_time+0.01) * 0.2;
  float v = map(p, speed);

  // base: mostly white
  vec3 base = vec3(0.7, 0.9, 0.7); // green ish base 

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
  vec3 color = Mucous_Membrane(vPos.xy, 0.3, 1.0);  // Pass u_speed here
  // keep a little global desaturation / tone like original
  color = color * 0.98 + vec3(0.01);
  fragColor = vec4(color, 1);

}