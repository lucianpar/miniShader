#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

#define PI 3.14159265359
#define T u_time
#define r(v,t) { float a = (t)*T, c=cos(a),s=sin(a); v*=mat2(c,s,-s,c); }

// --- hash / random helpers ---
float hash(float n){ return fract(sin(n)*43758.5453123); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
vec2  hash2(vec2 p){ return vec2(hash(p), hash(p+1.234)); }

// 2D rotation
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// safe distance from point p to segment a-b
float segDist(vec2 p, vec2 a, vec2 b){
    vec2 pa = p - a;
    vec2 ba = b - a;
    float denom = dot(ba,ba);
    if(denom < 1e-6) return length(pa);
    float t = clamp(dot(pa,ba)/denom, 0.0, 1.0);
    vec2 proj = a + ba * t;
    return length(p - proj);
}

// soft line mask
float softLineMask(vec2 p, vec2 a, vec2 b, float width, float fall){
    float d = segDist(p,a,b);
    return 1.0 - smoothstep(width, width + fall, d);
}

// fractal-ish noise (cheap)
float fbm2(vec2 p){
    float v = 0.0;
    float a = 0.6;
    vec2 shift = vec2(37.0, 17.0);
    for(int i=0;i<5;i++){
        v += a * hash(p + float(i)*shift);
        p = p*1.9 + vec2(0.7,0.3);
        a *= 0.5;
    }
    return v;
}

// Simplified noise from provided code
const mat3 m = mat3( 0.00,  0.80,  0.60,
                     -0.80,  0.36, -0.48,
                     -0.60, -0.48,  0.64 );

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

#define snoise(x) (2.*noise(x)-1.)

float sfbm( vec3 p ) { // in [-1,1]
    float f;
    f  = 0.5000*snoise( p ); p = m*p*2.02;
    f += 0.2500*snoise( p ); p = m*p*2.03;
    f += 0.1250*snoise( p ); p = m*p*2.01;
    f += 0.0625*snoise( p );
    return f;
}

#define sfbm3(p) vec3(sfbm(p), sfbm(p-327.67), sfbm(p+327.67))

// Simplified point line cloud: grid points with swirling displacement
vec4 cloud(vec2 uv, float t){
    // density and coordinate setup
    float scale = 70.0; // increased for more sparsity (fewer points)
    vec2 g = uv * scale;
    vec2 id = floor(g);
    vec2 cell = fract(g);

    // base seed from cell id + small jitter
    vec2 seed = fract(vec2(hash(id), hash(id.yx + 7.3)));

    // get point inside cell with more organic noise (increased multiplier for more noise)
    vec2 pt = clamp(vec2(fbm2(seed * 5.0 + t * 2.0), fbm2(seed * 5.0 + t * 2.0 + 10.0)) * 0.3 + seed, vec2(0.0), vec2(1.0)); // more noise and motion

    // world position (centered)
    vec2 worldPt = (id + pt) / scale - vec2(0.5);

    // apply swirling displacement (increased for more motion)
    vec3 swirlDisp = sfbm3(vec3(worldPt * 10.0, t * 2.0)) * 0.05; // more motion
    worldPt += swirlDisp.xy;

    // fragment position in same centered space
    vec2 fragWorld = uv - vec2(0.5);

    // point contribution: finer, smaller dot
    float d = length(fragWorld - worldPt);
    float point = 1.0 - smoothstep(0.005, 0.015, d); // finer detail

    // line to neighbors (simplified, finer)
    vec2 idR = id + vec2(1.0, 0.0);
    vec2 seedR = fract(vec2(hash(idR), hash(idR.yx + 3.7)));
    vec2 ptR = clamp(vec2(fbm2(seedR * 5.0 + t * 2.0), fbm2(seedR * 5.0 + t * 2.0 + 10.0)) * 0.3 + seedR, vec2(0.0), vec2(1.0));
    vec2 worldR = (idR + ptR) / scale - vec2(0.5);
    vec3 swirlDispR = sfbm3(vec3(worldR * 10.0, t * 2.0)) * 0.05;
    worldR += swirlDispR.xy;

    float line = softLineMask(fragWorld, worldPt, worldR, 0.001, 0.003); // finer lines

    // accumulate
    float sum = point + line * 0.5;

    // per-cell brightness variation (more variation for noise)
    float bright = mix(0.4, 1.2, hash(id*1.37)); // wider range
    sum *= bright;

    // clamp and greyscale mapping (more noise in grey)
    sum = clamp(sum, 0.0, 1.0);
    float grey = mix(0.96, 0.3, hash(id + vec2(1.23))); // darker for more contrast

    vec3 col = vec3(grey) * sum;

    return vec4(col, sum);
}

void main(){
    // use the fixed coordinate that produced dense mesh previously
    vec2 uv = vPos.xy / 3.0;
    float t = u_time;

    vec4 outColor = cloud(uv, t);

    // black background when no contribution
    if(outColor.a < 0.001){
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        fragColor = outColor;
    }
}