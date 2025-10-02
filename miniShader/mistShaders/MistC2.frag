#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

#define PI 3.14159265359

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

// Clifford-style strange attractor (fast, stable)
vec2 cliffordAttractor(vec2 seed, float t){
    // parameters vary slowly with time for animation
    float a = 1.7 + 0.4 * sin(t*0.08 + seed.x*3.2);
    float b = -1.8 + 0.35 * cos(t*0.06 + seed.y*2.7);
    float c = 1.9 + 0.3 * sin(t*0.09 + seed.x*1.9);
    float d = -2.0 + 0.25 * cos(t*0.07 + seed.y*2.1);

    vec2 z = seed * 0.2; // small start
    for(int i=0;i<12;i++){
        float nx = sin(a * z.y) + c * cos(a * z.x);
        float ny = sin(b * z.x) + d * cos(b * z.y);
        z = vec2(nx, ny);
    }
    // normalize into 0..1 space robustly
    z = z * 0.25 * z;            // shrink
    z += vec2(0.5);          // shift
    return fract(z);
}

// Organic noise-based attractor (more natural than Clifford)
vec2 organicAttractor(vec2 seed, float t){
    // base position with fractal noise displacement
    vec2 disp = vec2(fbm2(seed * 5.0 + t), fbm2(seed * 5.0 + t + 10.0)) * 0.2;
    return seed + disp;
}

// main: dense mesh of noisy lines, geometry driven by attractor
vec4 cloud(vec2 uv, float t){
    // density and coordinate setup
    float scale = 70.0;             // increase => more points/lines
    vec2 g = uv * scale;
    vec2 id = floor(g);
    vec2 cell = fract(g);

    // base seed from cell id + small jitter
    vec2 seed = fract(vec2(hash(id), hash(id.yx + 7.3)));

    // get attractor-derived point inside the cell
    vec2 attractPt = organicAttractor(seed + cell*0.13, t);
    // map attractor result to a position inside the cell (0..1)
    vec2 pt = clamp(attractPt, vec2(0.0), vec2(1.0));

    // world position (centered)
    vec2 worldPt = (id + pt) / scale - vec2(0.5);

    // neighbors to connect to (right, up, diagonal)
    vec2 idR = id + vec2(1.0, 0.0);
    vec2 idU = id + vec2(0.0, 1.0);
    vec2 idRU = id + vec2(1.0, 1.0);

    vec2 seedR = fract(vec2(hash(idR), hash(idR.yx + 3.7)));
    vec2 seedU = fract(vec2(hash(idU), hash(idU.yx + 5.1)));
    vec2 seedRU= fract(vec2(hash(idRU),hash(idRU.yx + 9.2)));

    vec2 ptR = clamp(organicAttractor(seedR + vec2(0.23), t), vec2(0.0), vec2(1.0));
    vec2 ptU = clamp(organicAttractor(seedU + vec2(0.47), t), vec2(0.0), vec2(1.0));
    vec2 ptRU= clamp(organicAttractor(seedRU + vec2(0.71), t), vec2(0.0), vec2(1.0));

    vec2 worldR = (idR + ptR) / scale - vec2(0.5);
    vec2 worldU = (idU + ptU) / scale - vec2(0.5);
    vec2 worldRU= (idRU + ptRU)/ scale - vec2(0.5);

    // small attractor-driven local wobble (makes lines noisy)
    float n = fbm2(id * 0.11 + t * 0.04);
    vec2 wobble = 0.03 * vec2(sin((id.x+id.y)*0.5 + t*0.9), cos((id.x-id.y)*0.7 - t*0.6)) * n;

    // apply a mild global swirl that decays with distance
    vec2 center = vec2(0.0);
    float swirl = 1.4 * exp(-length(worldPt)*3.0);
    float ang = swirl * sin(t*0.5 + id.x*0.09 + id.y*0.07);
    vec2 swPt = center + (rot(ang) * (worldPt + wobble));

    vec2 swR = center + (rot(swirl * sin(t*0.5 + idR.x*0.09 + idR.y*0.07)) * (worldR + wobble*0.9));
    vec2 swU = center + (rot(swirl * sin(t*0.5 + idU.x*0.09 + idU.y*0.07)) * (worldU + wobble*0.9));
    vec2 swRU= center + (rot(swirl * sin(t*0.5 + idRU.x*0.09 + idRU.y*0.07)) * (worldRU + wobble*0.9));

    // fragment position in same centered space
    vec2 fragWorld = uv - vec2(0.5);

    // accumulate thin, noisy line contributions
    float width = 0.0028;   // base thinness
    float fall = 0.0062;
    float sum = 0.0;

    sum += softLineMask(fragWorld, swPt, swR, width, fall);
    sum += softLineMask(fragWorld, swPt, swU, width, fall);
    sum += softLineMask(fragWorld, swPt, swRU, width * 1.05, fall * 1.05);

    // add fine noise modulation on lines
    float lineNoise = fbm2((fragWorld + vec2(t*0.02))*12.0) * 0.5;
    sum *= (0.75 + lineNoise);

    // faint halo for thicker feel
    sum += 0.12 * softLineMask(fragWorld, swPt, swR, width*3.2, fall*2.8);

    // per-cell brightness variation
    float bright = mix(0.6, 1.0, hash(id*1.37));
    sum *= bright;

    // clamp and greyscale mapping
    sum = clamp(sum, 0.0, 1.0);
    float grey = mix(0.96, 0.5, hash(id + vec2(1.23)));

    vec3 col = vec3(grey) * sum;

    return vec4(col, sum);
}

void main(){
    // use the fixed coordinate that produced dense mesh previously
    vec2 uv = vPos.xy / 20.0;
    float t = u_time;

    vec4 outColor = cloud(uv, t);

    // black background when no contribution
    if(outColor.a < 0.001){
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        fragColor = outColor;
    }
}