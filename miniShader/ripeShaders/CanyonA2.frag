// ...existing code...
#version 330 core

in vec3 vPos; // receive from vert

out vec4 fragColor;

uniform float u_time;
uniform float onset;
uniform float flux;

#define T u_time
#define r(v,t) { float a = (t)*T, c=cos(a),s=sin(a); v*=mat2(c,s,-s,c); }

// --- optimized noise (IQ) ---------------------------------------------------
const mat3 m = mat3( 0.00,  0.80,  0.60,
                    -0.80,  0.36, -0.48,
                    -0.60, -0.48,  0.64 );

float hash(float n){ return fract(sin(n)*43758.5453); }
float noise(in vec3 x){
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0 - 2.0*f);
  float n = p.x + p.y*57.0 + 113.0*p.z;
  return mix(
    mix(mix(hash(n+0.), hash(n+1.), f.x),
        mix(hash(n+57.), hash(n+58.), f.x), f.y),
    mix(mix(hash(n+113.), hash(n+114.), f.x),
        mix(hash(n+170.), hash(n+171.), f.x), f.y),
    f.z
  );
}

// 2-octave fbm (cheaper)
float fbm2(in vec3 p){
  float f = 0.5 * noise(p);
  p = m * p * 2.02;
  f += 0.25 * noise(p);
  return f;
}
#define snoise(x) (2.0*noise(x)-1.0)

// 2-octave signed fbm (cheaper)
float sfbm2(in vec3 p){
  float f = 0.5 * snoise(p);
  p = m * p * 2.02;
  f += 0.25 * snoise(p);
  return f;
}

// approximate 3-channel sfbm with offsets to avoid 3 full calls per iter
vec3 sfbm3_approx(in vec3 p){
  return vec3(sfbm2(p), sfbm2(p + 37.0), sfbm2(p - 17.0));
}

// small dot-heavy noise field inspired by reference (cheap, "dot" based)
// ...existing code...
float dotNoise(in vec3 p){
 // a few rotated probing directions using sines of time to vary field
float t = T * 0.15;
 float s = 0.0;
 // three probing directions
 vec3 d0 = normalize(vec3(cos(t+0.1), sin(t+0.7), 0.5));
vec3 d1 = normalize(vec3(cos(t*1.3+1.2), sin(t*0.9+0.3), 0.4));
 vec3 d2 = normalize(vec3(cos(-t*0.7+2.0), sin(t*1.1+0.9), 0.6));
 s += abs(dot(p, d0));
 s += abs(dot(p*1.3, d1)) * 0.8;
 s += abs(dot(p*0.7, d2)) * 0.6;
// add a low-cost fbm modulation to break regularity
 s += 0.6 * sfbm2(p * 0.35 + vec3(t, -t, t*0.5));
 // compress and return in [0,1]
-  return clamp(pow(fract(s * 0.5 + 0.1), 0.9), 0.0, 1.0);
+  // dotted / cellular-ish effect: probing directions + thresholding -> visible dots
+  float t = T * 0.18;
+  float s = 0.0;
+  vec3 d0 = normalize(vec3(cos(t+0.1), sin(t+0.7), 0.5));
+  vec3 d1 = normalize(vec3(cos(t*1.25+1.3), sin(t*0.85+0.4), 0.4));
+  vec3 d2 = normalize(vec3(cos(-t*0.65+2.0), sin(t*1.05+0.95), 0.6));
+  s += abs(dot(p, d0));
+  s += abs(dot(p * 1.35, d1)) * 0.8;
+  s += abs(dot(p * 0.75, d2)) * 0.6;
+  // low-cost fbm to break strict regularity
+  s += 0.45 * sfbm2(p * 0.38 + vec3(t, -t, t*0.45));
+  // build a sharper dot mask from the probe value
+  float freq = 6.0; // controls dot density
+  float mask = fract(s * freq);
+  // sharpen and threshold into circular-ish dots
+  float dotMask = smoothstep(0.82, 0.92, 1.0 - abs(mask - 0.5) * 2.0);
+  // combine subtle base noise and the sharp dot mask
+  float base = clamp(pow(fract(s * 0.45 + 0.12), 0.9), 0.0, 1.0);
+  return mix(base, dotMask, 0.78);
 }
 // ...existing code...

// procedural texture value (single cheap fbm) — uses dotNoise to add character
float procTex(in vec2 t){
  vec3 p = vec3(t * 0.8, T * 0.25);
  float base = fbm2(p);
  float dn = dotNoise(vec3(t, T*0.05));
  return clamp(base * 0.8 + dn * 0.6, 0.0, 1.0);
}

// small trace function: performs light-weight marching-like accumulation
vec3 traceScene(in vec2 uv){
  // map uv to working space (no resolution dependency)
  uv *= 1.8;
  uv.x -= 0.4;

  // view direction and initial point
  vec3 p = vec3(uv, 6.0);
  vec3 d = normalize(vec3(uv * 0.5, -1.0));

  vec3 accum = vec3(0.0);
  float alpha = 0.0;

  const int ITER = 10;               // low iteration count
  const float HIT_THRESH = 0.015;    // hit threshold
  const float MAX_ALPHA = 0.98;

  for (int i = 0; i < ITER; ++i){
    // small tiled rotation offsets (cheap)
    vec3 u = 0.03 * floor(vec3(p.x/8.0, p.y/8.0, p.z/1.0) + 3.5);
    vec3 t = p;
    r(t.xy, u.x);
    r(t.xz, u.y);

    // cheaper displacement with approximated sfbm3 and dotNoise to add dot-heavy detail
    t += sfbm3_approx(t * 0.5 + vec3(0.5 * T, 0.0, 0.0))
         * (0.45 + 4.0 * (0.5 - 0.5 * cos(T * 0.0625)));

    // inject dot-field perturbation (small)
    float dn = dotNoise(t * 0.6);
-    t += 0.6 * dn * normalize(vec3(sin(T*0.12), cos(T*0.07), 0.3));
+    // inject dot-field perturbation and compute dot intensity
+    float dn = dotNoise(t * 0.6);
+    // a small spatial perturbation driven by dot field (keeps shape organic)
+    t += 0.35 * dn * normalize(vec3(sin(T*0.12), cos(T*0.07), 0.3));
+    // create a local dot accent value (used for coloring / emission)
+    float dotAccent = smoothstep(0.5, 0.95, dn);
...
-    if (step < HIT_THRESH){
-      float cval = procTex(t.xy) * 4.0;
-      vec3 col = vec3(cval * 0.95, cval * 0.6, cval * 0.35); // subtle warm toning
-      float w = 0.22 * (1.0 - alpha);
-      accum += col * w;
+    if (step < HIT_THRESH){
+      float cval = procTex(t.xy) * 4.0;
+      // apply dot accent as a bright spot multiplier
+      float spot = 1.0 + 2.0 * dotAccent; // boost when dot present
+      vec3 col = vec3(cval * 0.95, cval * 0.6, cval * 0.35) * spot;
+      float w = 0.22 * (1.0 - alpha);
+      accum += col * w;
       alpha += w;
       if (alpha > MAX_ALPHA) break;
       step = 0.12;
    }

    // advance with a safe minimum step to avoid stalls
    p += d * max(step, 0.05);
  }

  // if nothing hit, return an indicator (alpha will be 0)
  if (alpha < 1e-4) return vec3(-1.0); // sentinel for background
  // return accumulated color normalized by alpha (pre-toned)
  return accum / max(alpha, 1e-5);
}

// small background generator — return black as requested
vec3 backgroundField(in vec2 uv){
  return vec3(0.0);
}

// -------------------- main (minimal) ---------------------------------------
void main(){
  // keep your uv fix: use vPos mapped to -1..1 (works for this pipeline)
  vec2 uv = vPos.xy * 2.0 - 1.0;

  // subtle motion warp
  uv += 0.02 * vec2(sin(T*0.18 + uv.y*2.0), cos(T*0.12 + uv.x*1.6));

  vec3 col = traceScene(uv);

  // if trace returned sentinel -> use background (black)
  if (col.x < 0.0){
    col = backgroundField(uv);
  } else {
    // light tone mapping and tiny rim/fresnel
    float rim = 0.02; // tiny effect
    col = pow(col * (0.95 + rim), vec3(1.0 / 1.05));
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
// ...existing code...