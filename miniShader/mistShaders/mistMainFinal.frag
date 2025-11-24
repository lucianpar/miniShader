#version 330 core

in vec3 vPos;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

// === smoke utilities ===
float SmokeGyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbm(vec3 seed) {  // Renamed from SmokeFBM to match calls
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 10; ++i) {  // Further increased iterations for even more detail
        seed.z += result * 0.5;
        result += abs(SmokeGyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// === SMOKE 1 (Modified for grey misty effect) ===
float smokeOrganismPresence(vec2 uv, float t) {
    vec2 center = vec2(0.2 * sin(t * 0.3), 0.2 * cos(t * 0.2));
    float radius = 0.45 + 0.15 * sin(t * 0.7);
    float d = length(uv - center);
    return smoothstep(radius * 1.2, radius, d);
}

float smokeInternalMembrane(vec2 uv, float t) {
    float pulse = sin(t * 0.6 + uv.x * 5.0) * cos(t * 0.4 + uv.y * 7.0);
    float band = smoothstep(0.2, 0.5, pulse);
    float fb = fbm(vec3(uv * 3.0, t * 0.1));  // Now matches definition
    return mix(0.0, fb, band);
}

// === SMOKE 3 (Further refined for even more detail, starting from outside and merging into one structure) ===
vec4 SmokeSrc(vec2 uv, float t, float s) {
    // Finer scaling for more detail and less shapely forms
    uv *= 0.3;  // Further increased scaling for finer details and merging

    // Reduced and slower drift for less movement
    uv += 0.05 * vec2(
        sin(uv.y * 1.5 + t * 0.05),  // Even slower time multiplier
        cos(uv.x * 1.3 - t * 0.04)  // Even slower time multiplier
    ) * fbm(vec3(uv * 2.5, t * 0.02));  // Higher frequency for detail, slower time

    // Even higher frequency fbm for more detail
    float smoke = fbm(vec3(uv * 6.0, t * s)) * 2.0;  // Now matches definition

    // Adjusted masking to start from outside and merge towards center
    float dist = length(uv);
    float outerMask = smoothstep(0.0, 1.5, dist);  // Stronger at edges
    float innerMask = 1.0 - smoothstep(0.0, 0.5, dist);  // Weaker in center
    float ambientMask = mix(outerMask, innerMask, 0.5);  // Blend for merging effect

    float intensity = pow(smoke, 1.2) * ambientMask;  // Adjusted power for finer, merging texture

    // Grey misty colors with subtle variations
    vec3 color = mix(vec3(0.5, 0.5, 0.5), vec3(0.7, 0.7, 0.7), 0.5 + 0.2 * sin(t * 0.03 + smoke * 1.5));  // Slower color variation

    return vec4(color * intensity, 0.03 + 0.5 * intensity);  // Adjusted alpha for finer mist
}

// === FOAM BUBBLE (Modified for grey misty effect) ===
float smokeMetaballField(vec2 uv, float t) {
    float field = 0.0;
    for (int i = 0; i < 7; ++i) {
        float fi = float(i);
        vec2 center = 1.2 * vec2(
            sin(t * 0.27 + fi * 1.3) + cos(fi + t * 0.11),
            cos(t * 0.19 + fi * 1.6) + sin(fi * 0.4 + t * 0.29)
        );
        float radius = 0.35 + 0.25 * sin(t * 0.23 + fi * 0.8);
        float dist = length(uv - center) + 0.003;
        field += radius / dist;
    }
    return field;
}

vec4 smokeFoamBubble(vec2 uv, float t) {
    uv = vPos.xy / 7.0;
    float meta = smokeMetaballField(uv, t);
    float warp = smoothstep(0.6, 3.5, meta);
    float pulse = 1.0 + 0.2 * sin(t * 0.8 + meta * 2.0);

    vec2 drift = vec2(
        sin(meta * 1.5 + t * 0.6),
        cos(meta * 1.7 + t * 0.5)
    );
    vec2 warpedUV = uv + 0.33 * warp * pulse * drift;

    warpedUV += 0.05 * vec2(
        sin(fbm(vec3(uv, t * 0.13)) * 8.0 + t),  // Now matches definition
        cos(fbm(vec3(uv.yx, t * 0.11)) * 6.0 - t)  // Now matches definition
    );

    float n = fbm(vec3(warpedUV * 0.95, t * 0.07));
    vec3 normal = normalize(vec3(
        n - fbm(vec3(warpedUV + vec2(0.015, 0.0), t * 0.07)),
        n - fbm(vec3(warpedUV + vec2(0.0, 0.015), t * 0.07)),
        0.3 + (t / 140.0)
    ));

    // Modified for grey misty colors
    vec3 baseColor = mix(vec3(0.6, 0.6, 0.6), vec3(0.8, 0.8, 0.8), 0.5 + 0.5 * sin(t * 0.9 + meta * 2.5));

    vec3 light1 = normalize(vec3(0.4, 0.8, 1.0));
    vec3 light2 = normalize(vec3(-0.3, -0.5, 1.0));
    vec3 color = 0.3 * pow(dot(normal, light1), 2.5)
               + 0.2 * pow(dot(normal, light2), 4.5)
               + baseColor * n;

    color *= n * warp;
    color += 0.02 * vec3(0.7, 0.7, 0.7);  // Grey tint

    return vec4(color, 0.12 + 0.4 * warp);
}

vec4 SmokeMain(vec2 uv, float t, float s) {
    // Removed redundant newUV scaling (uv is already scaled in main())
    // Use SmokeSrc for a grey misty mountaintop effect
    uv = uv * 3.0;
    vec4 finalColor = SmokeSrc(uv, t, s);

    // === FADE IN from black ===
    float fadeIn = smoothstep(0.0, 23.0, t);
    finalColor.rgb *= fadeIn;
    finalColor.a *= fadeIn;

    // === FADE OUT to white ===
    float fadeOut = smoothstep(481.0, 491.0, t);
    finalColor.rgb = mix(finalColor.rgb, vec3(1.0), fadeOut);
    finalColor.a = mix(finalColor.a, 1.0, fadeOut);
    return finalColor;

}

//end smoke utilities//


// === pooint line utilities ===
float NoisySmokeGyroidUtil(vec3 seed) {
    return dot(cos(seed), sin(seed.yzx)) * dot(cos(seed), sin(seed.yzx)) * cos(seed.x) - cos(seed.y) + cos(seed.z);
    // * cos(seed.x) * cos(seed.y) * cos(seed.z); // very cool result but too dark
}

float NoisySmokefbm(vec3 seed) {
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 30; ++i) {
        seed.z += result * 0.5;
        result += abs(NoisySmokeGyroidUtil(seed / a)) * a;
        a *= 0.6;
    }
    return result;
}

float NoisySmokeGrainNoise(vec2 uv, float t) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + t * 0.1); //last number is grain movement speed
}

// === SMOKE 3 (Mist as a collection of little cloud dots) ===
vec4 NoisySmokeSrc(vec2 uv, float t) {
    // Scale down for smaller, distinct cloud dots
    uv *= 0.5;

    // Use NoisySmokefbm for base structure, with smaller scale for distinct dots
    float mist = NoisySmokefbm(vec3(uv * 10.0, t * 0.1)); // Higher frequency for smaller structures

    // Sharpen and isolate the cloud dots
    float cloudDots = smoothstep(0.3, 0.8, mist); // Isolate brighter regions
    cloudDots = pow(cloudDots, 30.0); // Sharpen the dots

    // Add grain for texture, but keep it subtle
    float grain = NoisySmokeGrainNoise(uv * 2.0, t); // Moderate frequency for grain
    mist = mix(cloudDots, grain, 0.2); // Blend grain lightly with the cloud dots (reduced grain influence to make clouds more visible)

    // Mask for forming inward from outside
    float dist = length(uv);
    float formInward = 1.0 - smoothstep(0.0, 1.5 - t * 0.005, dist); // Starts at edges, forms towards center over time

    // Intensity with inward formation
    float intensity = mist * 0.8 * formInward;

    // Grey misty colors
    vec3 color = mix(vec3(0.4, 0.4, 0.4), vec3(0.8, 0.8, 0.8), 0.5 + 0.2 * sin(t * 0.005 + mist * 0.5));

    return vec4(color * intensity, 0.1 + 0.6 * intensity); // Higher alpha for visibility
}

 vec4 NoisySmokeFinal(vec2 uv, float t) {
    vec2 newUV = uv/20.0;
    // Use NoisySmokeSrc for a collection of little cloud dots
    vec4 finalColor = NoisySmokeSrc(newUV, t);

    // === FADE IN from black ===
    float fadeIn = smoothstep(0.0, 3.0, t);
    finalColor.rgb *= fadeIn;
    finalColor.a *= fadeIn;

    // === FADE OUT to white ===
    float fadeOut = smoothstep(481.0, 491.0, t);
    finalColor.rgb = mix(finalColor.rgb, vec3(1.0), fadeOut);
    finalColor.a = mix(finalColor.a, 1.0, fadeOut);
    // Use NoisySmokeSrc for a collection of little cloud dots
    return finalColor;
}

// === UTILITIES (kept, corrected) ===
float PointLineGyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float PointLineFbm(vec3 seed) {
    float result = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; ++i) {
        seed.z += result * 0.5;
        result += abs(PointLineGyroid(seed / a)) * a;
        a *= 0.5;
    }
    return clamp(result, 0.0, 1.0);
}

// === SMOKE 3 (HOLLOW MESH) ===
// Now takes rotation (radians) and speed multipliers as parameters.
vec4 PointLineShaderHollowMesh(vec2 uv, float t, float rotation, float speed) {
    // apply rotation around center
    float c = cos(rotation), s = sin(rotation);
    mat2 R = mat2(c, -s, s, c);
    vec2 uvR = (uv - 0.5) * R + 0.5;

    // SPEED: scale time
    float T = t * speed;

    float scale = 0.5;
    vec3 p = vec3(uvR * scale, T * 0.12);

    float field = PointLineFbm(p / 2.0);
    field += 0.35 * PointLineFbm(p * 4.4 + vec3(12.3, 4.1, T * 0.08));

    float center = 0.8;
    float thickness = 0.13;
    float hollow = 0.30;

    float outer = smoothstep(center - thickness * 0.5, center + thickness * 0.5, field);
    float inner = smoothstep(center - thickness * 0.5 + thickness * hollow,
                             center + thickness * 0.5 - thickness * hollow, field);
    float shell = clamp(outer - inner, 0.0, 1.0);

    // sample neighbors for gradient (used to detect edges/outlines)
    float eps = 0.005;
    float fx = PointLineFbm(vec3((uvR + vec2(eps, 0.0)) * scale * 2.0, T * 0.12));
    float bx = PointLineFbm(vec3((uvR - vec2(eps, 0.0)) * scale * 2.0, T * 0.12));
    float fy = PointLineFbm(vec3((uvR + vec2(0.0, eps)) * scale * 2.0, T * 0.12));
    float by = PointLineFbm(vec3((uvR - vec2(0.0, eps)) * scale * 2.0, T * 0.12));
    vec2 grad = vec2(fx - bx, fy - by) / (2.0 * eps);
    float g = length(grad);

    // high-contrast outline: detect strong gradients and modulate by shell/mesh presence
    float edgeLow = 0.008;
    float edgeHigh = 0.035;
    float edge = smoothstep(edgeLow, edgeHigh, g);
    // restrict outlines to regions where shells exist (avoid noise elsewhere)
    float meshMask = clamp(shell, 0.0, 1.0);
    float outline = edge * meshMask;
    // boost and sharpen the outline
    outline = pow(outline, 0.6) * 1.25;
    outline = clamp(outline, 0.0, 1.0);

    // lighting for outline (bright)
    vec3 n = normalize(vec3(grad, 0.02));
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.5));
    float diff = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - max(0.0, dot(n, vec3(0.0, 0.0, 1.0))), 2.0);

    // bright white outline color
    vec3 outlineCol = vec3(1.0) * (0.9 + 0.6 * diff) + 0.5 * rim;

    // non-outline (background) forced to pure black
    vec3 bgCol = vec3(0.0);

    // final: only show bright outlines (background fully black)
    vec3 finalCol = outlineCol * outline + bgCol * (1.0 - outline);

    // alpha follows outline (opaque on lines, transparent elsewhere)
    float alpha = outline;

    return vec4(finalCol, alpha);
}

// === MAIN LOGIC ===
vec4 PointLineMain(vec2 uv, float t, float speed) {
    // primary (foreground) hollow mesh
    vec2 newUV = uv / 2.0; // scale down for more detail
    float rotationA = 0.0;
    float speedA = 10.0 * speed; // Apply caller-provided speed multiplier
    vec4 layerA = PointLineShaderHollowMesh(newUV, t, rotationA, speedA);

    // secondary (background) hollow mesh offset by 170 degrees for depth
    float rotOffset = 170.0 * 3.14159265359 / 180.0;
    float rotationB = rotOffset;
    float speedB = 5.2 * speed; // Apply caller-provided speed multiplier
    vec4 layerB = PointLineShaderHollowMesh(uv, t, rotationB, speedB);

    // composite: background darker and slightly dimmed, foreground on top
    vec3 bgBlend = layerB.rgb * 0.6;
    vec3 fgBlend = layerA.rgb * layerA.a;
    vec3 finalRGB = bgBlend * (1.0 - layerA.a) + fgBlend; // simple over with bg dimming
    float finalA = clamp(layerA.a + layerB.a * 0.5, 0.0, 1.0);

    // fade in/out
    float fadeIn = smoothstep(0.0, 3.0, t);
    float fadeOut = smoothstep(481.0, 491.0, t);

    finalRGB *= fadeIn;
    finalRGB = mix(finalRGB, vec3(1.0), fadeOut);
    finalA *= fadeIn;
    finalA = mix(finalA, 1.0, fadeOut);

    return vec4(finalRGB, finalA);
}

// === cell noise utilities ===
#define r(v,t) { float a = (t)*T, c=cos(a),s=sin(a); v*=mat2(c,s,-s,c); }

// --- hash / random helpers ---
float CellNoiseHashFloat(float n){ return fract(sin(n)*43758.5453123); }
float CellNoiseHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
vec2  CellNoiseHash2(vec2 p){ return vec2(CellNoiseHash(p), CellNoiseHash(p+1.234)); }

// 2D rotation
mat2 CellNoiseRot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// safe distance from point p to segment a-b
float CellNoiseSegDist(vec2 p, vec2 a, vec2 b){
    vec2 pa = p - a;
    vec2 ba = b - a;
    float denom = dot(ba,ba);
    if(denom < 1e-6) return length(pa);
    float t = clamp(dot(pa,ba)/denom, 0.0, 1.0);
    vec2 proj = a + ba * t;
    return length(p - proj);
}

// soft line mask
float CellNoiseSoftLineMask(vec2 p, vec2 a, vec2 b, float width, float fall){
    float d = CellNoiseSegDist(p,a,b);
    return 1.0 - smoothstep(width, width + fall, d);
}

// fractal-ish noise (cheap)
float CellNoiseFbm2(vec2 p){
    float v = 0.0;
    float a = 0.6;
    vec2 shift = vec2(37.0, 17.0);
    for(int i=0;i<5;i++){
        v += a * CellNoiseHash(p + float(i)*shift);
        p = p*1.9 + vec2(0.7,0.3);
        a *= 0.5;
    }
    return v;
}

// Simplified noise from provided code
const mat3 m = mat3( 0.00,  0.80,  0.60,
                     -0.80,  0.36, -0.48,
                     -0.60, -0.48,  0.64 );

float CellNoiseNoise( in vec3 x ) { // in [0,1]
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.-2.*f);
    float n = p.x + p.y*57. + 113.*p.z;
    float res = mix(mix(mix( CellNoiseHashFloat(n+  0.), CellNoiseHashFloat(n+  1.),f.x),
                        mix( CellNoiseHashFloat(n+ 57.), CellNoiseHashFloat(n+ 58.),f.x),f.y),
                    mix(mix( CellNoiseHashFloat(n+113.), CellNoiseHashFloat(n+114.),f.x),
                        mix( CellNoiseHashFloat(n+170.), CellNoiseHashFloat(n+171.),f.x),f.y),f.z);
    return res;
}

#define CellNoiseSnoise(x) (2.*CellNoiseNoise(x)-1.)

float CellNoiseSfbm( vec3 p ) { // in [-1,1]
    float f;
    f  = 0.5000*CellNoiseSnoise( p ); p = m*p*2.02;
    f += 0.2500*CellNoiseSnoise( p ); p = m*p*2.03;
    f += 0.1250*CellNoiseSnoise( p ); p = m*p*2.01;
    f += 0.0625*CellNoiseSnoise( p );
    return f;
}

#define CellNoiseSfbm3(p) vec3(CellNoiseSfbm(p), CellNoiseSfbm(p-327.67), CellNoiseSfbm(p+327.67))

// Simplified point line cloud: grid points with swirling displacement
vec4 CellNoiseCloud(vec2 uv, float t){
    // density and coordinate setup
    float scale = 70.0; // increased for more sparsity (fewer points)
    vec2 g = uv * scale;
    vec2 id = floor(g);
    vec2 cell = fract(g);

    // base seed from cell id + small jitter
    vec2 seed = fract(vec2(CellNoiseHash(id), CellNoiseHash(id.yx + 7.3)));

    // get point inside cell with more organic noise (increased multiplier for more noise)
    vec2 pt = clamp(vec2(CellNoiseFbm2(seed * 5.0 + t * 2.0), CellNoiseFbm2(seed * 5.0 + t * 2.0 + 10.0)) * 0.3 + seed, vec2(0.0), vec2(1.0)); // more noise and motion

    // world position (centered)
    vec2 worldPt = (id + pt) / scale - vec2(0.5);

    // apply swirling displacement (increased for more motion)
    vec3 swirlDisp = CellNoiseSfbm3(vec3(worldPt * 10.0, t * 2.0)) * 0.05; // more motion
    worldPt += swirlDisp.xy;

    // fragment position in same centered space
    vec2 fragWorld = uv - vec2(0.5);

    // point contribution: finer, smaller dot
    float d = length(fragWorld - worldPt);
    float point = 1.0 - smoothstep(0.005, 0.015, d); // finer detail

    // line to neighbors (simplified, finer)
    vec2 idR = id + vec2(1.0, 0.0);
    vec2 seedR = fract(vec2(CellNoiseHash(idR), CellNoiseHash(idR.yx + 3.7)));
    vec2 ptR = clamp(vec2(CellNoiseFbm2(seedR * 5.0 + t * 2.0), CellNoiseFbm2(seedR * 5.0 + t * 2.0 + 10.0)) * 0.3 + seedR, vec2(0.0), vec2(1.0));
    vec2 worldR = (idR + ptR) / scale - vec2(0.5);
    vec3 swirlDispR = CellNoiseSfbm3(vec3(worldR * 10.0, t * 2.0)) * 0.05;
    worldR += swirlDispR.xy;

    float line = CellNoiseSoftLineMask(fragWorld, worldPt, worldR, 0.001, 0.003); // finer lines

    // accumulate
    float sum = point + line * 0.5;

    // per-cell brightness variation (more variation for noise)
    float bright = mix(0.4, 1.2, CellNoiseHash(id*1.37)); // wider range
    sum *= bright;

    // clamp and greyscale mapping (more noise in grey)
    sum = clamp(sum, 0.0, 1.0);
    float grey = mix(0.96, 0.3, CellNoiseHash(id + vec2(1.23))); // darker for more contrast

    vec3 col = vec3(grey) * sum;

    return vec4(col, sum);
}

vec4 cellNoiseMain(vec2 uv, float t, float speed){
    // scale time according to caller-provided speed
    float scaledT = t * speed;

    // maintain previous uv scaling for density control
    vec2 newUV = uv / 3.0;

    // pass scaled time into the cloud generator
    vec4 outColor = CellNoiseCloud(newUV, scaledT);
    vec4 finalColor;

    // black background when no contribution (keep previous behaviour)
    if (outColor.a < 0.001){
        finalColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        finalColor = outColor;
    }
    return finalColor;
}

// Helper: quick onset lookup (small subset of ranges from mist-onsets.json).
// Returns true if global time `time` falls inside any onset range.
bool isOnsetAt(float time) {
    // compact list of onset ranges relevant to the middle sections (from mist-onsets.json)
    const int ONSET_COUNT = 8;
    const vec2 ranges[ONSET_COUNT] = vec2[](
        vec2( 92.24126984, 105.43020408), // long cluster that overlaps Section 3 start
        vec2( 99.95410431, 105.92943311),
        vec2(100.18249433, 104.80326531),
        vec2(104.33886621, 104.57106576),
        vec2(117.88770975, 118.61913832),
        vec2(118.23600907, 118.59591837),
        vec2(136.71909297, 137.26476190),
        vec2(139.98149660, 238.50376417)   // long region that begins just after Section 3
    );

    for (int i = 0; i < ONSET_COUNT; ++i) {
        if (time >= ranges[i].x && time <= ranges[i].y) return true;
    }
    return false;
}

// Helper: onset lookup specifically for Section 4 (global time).
// Returns true if global time `time` falls inside any onset range relevant to Section 4.
bool isOnsetSection4(float time) {
    // Ranges taken from mist-onsets.json that intersect Section 4 (138-168s).
    const int ONSET4_COUNT = 5;
    const vec2 ranges[ONSET4_COUNT] = vec2[](
        vec2(139.98149660, 238.50376417), // long region that covers 140s+
        vec2(140.35301587, 140.63165533),
        vec2(156.03809524, 160.42666667),
        vec2(162.13333333, 162.42358277),
        vec2(163.73551020, 175.78666667)  // overlaps end of Section 4 (163.7.. -> >168)
    );

    for (int i = 0; i < ONSET4_COUNT; ++i) {
        if (time >= ranges[i].x && time <= ranges[i].y) return true;
    }
    return false;
}

// Helper: onset lookup specifically for Section 2 (global time).
// Uses ranges from mist-onsets.json that overlap Section 2 (64-102s).
bool isOnsetSection2(float time) {
    const int ONSET2_COUNT = 14;
    const vec2 ranges[ONSET2_COUNT] = vec2[](
        vec2(65.68925170, 65.93306122),
        vec2(70.34485261, 70.86730159),
        vec2(71.87736961, 71.95863946),
        vec2(72.73650794, 73.65369615),
        vec2(74.08326531, 74.61732426),
        vec2(75.54612245, 128.02321995),   // long cluster starting in section
        vec2(76.05696145, 113.38303855),
        vec2(80.29460317, 82.62820862),
        vec2(83.75437642, 85.20562358),
        vec2(86.08798186, 108.10049887),
        vec2(89.95410431, 105.92943311),
        vec2(92.24126984, 105.43020408),
        vec2(99.55555556, 104.95419501),
        vec2(100.18249433, 104.80326531)
    );

    for (int i = 0; i < ONSET2_COUNT; ++i) {
        if (time >= ranges[i].x && time <= ranges[i].y) return true;
    }
    return false;
}

// === MAIN ===
void main() {
    vec2 uv = vPos.xy / 10.0;
    float t = u_time;

    //SECTION 1: 0:00 – 1:04 (0-64s)
    // Slower fade-in, continuous speed-up aligned to percussive at 1:02
    if (t >= 0.0 && t < 64.0) {
        float zoom = 1.0;

        // Cumulative zoom decreases (same as before)
        float dec1 = smoothstep(0.0, 28.0, t) * 0.4;
        float dec2 = smoothstep(28.0, 58.0, t) * 0.2;
        float dec3 = smoothstep(58.0, 64.0, t) * 0.3;
        zoom = zoom - dec1 - dec2 - dec3;
        zoom = clamp(zoom, 0.05, 1.0);

        // UPDATED: Continuous speed-up from 0:57 (57s) to 1:02 (62s) for percussive alignment
        float speedMult = 0.005; // base very slow
        
        if (t < 57.0) {
            speedMult = 0.005; // Very slow movement (0:00 - 0:57)
        } else {
            // Continuous acceleration from 0:57 to 1:04 (percussive at 1:02)
            float phase = (t - 57.0) / 7.0; // 0 -> 1 over 7 seconds
            speedMult = mix(0.005, 0.1, smoothstep(0.0, 1.0, phase)); // Faster end speed for impact
        }

        vec2 zoomedUV = uv * zoom;
        fragColor = SmokeMain(zoomedUV, t, speedMult);
    }
    
    // SECTION 2: 1:04 – 1:42 (64-104s)
    // Grey background blended in until 82s, then pure NoisySmokeFinal
    else if (t >= 64.0 && t < 104.0) {
        float localT = t - 64.0;

        // Static grey background
        vec4 greyBg = vec4(0.5, 0.5, 0.5, 1.0);

        // Subtle global shift (always present)
        vec2 subtleShift = vec2(
            sin(localT * 0.3) * 0.01,
            cos(localT * 0.2) * 0.01
        );
        vec2 shiftedUV = uv + subtleShift;

        // Noisy layer (reactive)
        vec4 noisyLayer = NoisySmokeFinal(shiftedUV, localT);

        // Blend grey -> noisy between t=64 (1:04) and t=82 (1:22)
        if (t < 82.0) {
            float blendT = smoothstep(64.0, 82.0, t); // 0 at 64s, 1 at 82s
            fragColor = mix(greyBg, noisyLayer, blendT);
        } else {
            // After 82s, just the noisy layer
            fragColor = noisyLayer;
        }
    }
    
    // SECTION 3: 1:42 – 2:19 (102-139s)
    // UPDATED: Remove white-screen cuts, keep black background with white elements
    // Only sudden-black at 2:19
    else if (t >= 104.0 && t < 140.2) {
        float localT = t - 104.0;

        // Sudden blackout at 2:19 (localT 35s = 2:19 global)
        if (localT >= 33.0) {
            fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
        else {
            // White elements on black background
            float eventSpeed = isOnsetAt(t) ? 1.0 : 0.1;
            fragColor = PointLineMain(uv, localT, eventSpeed);
        }
    }
    
    // SECTION 4: 2:20 – 2:49 (140-169s)
    // UPDATED: More dynamic mist motion, delayed zoom, white at end, different seed
    else if (t >= 140.2 && t < 170.0) {
        float localT = t - 140.2;

        // UPDATED: Delayed zoom-in to align with musical transition
        // Start zoom later (at localT 5s instead of 0s)
        float zoomProgress = clamp((localT - 5.0) / 24.0, 0.0, 1.0); // Delayed by 5s
        float zoom = 1.0 - smoothstep(0.0, 1.0, zoomProgress) * 0.7; // Zoom in more (like Section 1)

        // More dynamic mist motion
        bool onset = isOnsetSection4(t);
        float ampFactor  = onset ? 1.5 : 0.1;  // INCREASED for more dynamic motion
        float freqFactor = onset ? 1.2 : 0.3;  // INCREASED for more dynamic motion

        vec2 offset = vec2(
            sin(localT * 0.7 * freqFactor) * 0.03 * ampFactor, // Increased amplitude
            cos(localT * 0.5 * freqFactor) * 0.02 * ampFactor
        );

        vec2 zoomedUV = (uv + offset) * zoom / 2.0;

        // UPDATED: Bright white at 2:49 (end of section at localT 29)
        if (localT >= 28.5) {
            float toWhite = smoothstep(28.5, 30.0, localT);
            vec4 mistCol = SmokeMain(zoomedUV, localT + 200.0, 0.03); // CHANGED SEED (+200 instead of +140)
            fragColor = mix(mistCol, vec4(1.0, 1.0, 1.0, 1.0), toWhite);
        } else {
            fragColor = SmokeMain(zoomedUV, localT + 200.0, 0.03); // Different seed
        }
    }
    
    // SECTION 5: 2:49 – End (170s+)
    // Smooth zoom progression with fade-out
    else if (t >= 170.0) {
        float localT = t - 170.0;

        // Transition from Section 4's white
        float fromWhite = 1.0 - smoothstep(0.0, 2.0, localT);

        // Base gradual zoom
        float zoomProgress = localT / 60.0;
        float baseZoom = 1.0 - smoothstep(0.0, 1.0, zoomProgress) * 0.4;

        vec2 initialOffset = vec2(0.0);
        float initialZoom = 0.5; // Match Section 4's end zoom

        float transition = smoothstep(0.0, 3.0, localT);
        vec2 offset = mix(initialOffset, vec2(0.0), transition);
        float zoom = mix(initialZoom, baseZoom, transition);

        vec2 zoomedUV = (uv + offset) * zoom;

        // Cell noise zoom - continuous progression throughout entire section
        float cellStartMult = 7.0;
        float cellEndMult   = 0.5;  // Zoom further (instead of stopping at 1.0)
        float cellMult = mix(cellStartMult, cellEndMult, clamp(localT / 75.0, 0.0, 1.0));  // Continue to 75s (fadeEnd)

        vec2 cellUV = zoomedUV * cellMult;

        // Hit groups with envelopes
        const int SMALL_COUNT = 9;
        const vec2 smallRanges[SMALL_COUNT] = vec2[](
            vec2(2.0, 2.2), vec2(4.0, 4.2), vec2(6.0, 6.2),
            vec2(10.0, 10.2), vec2(12.0, 12.2), vec2(17.0, 17.2),
            vec2(19.0, 19.2), vec2(23.0, 23.2), vec2(25.0, 25.2)
        );
        const int MED_COUNT = 4;
        const vec2 medRanges[MED_COUNT] = vec2[](
            vec2(7.0, 8.0), vec2(13.0, 15.0),
            vec2(20.0, 22.0), vec2(27.0, 29.0)
        );
        const int LARGE_COUNT = 3;
        const vec2 largeRanges[LARGE_COUNT] = vec2[](
            vec2(33.0, 36.0), vec2(40.0, 44.0), vec2(48.0, 55.0)
        );

        float atkSmall = 0.02, relSmall = 0.08;
        float atkMed   = 0.10, relMed   = 0.20;
        float atkLarge = 0.25, relLarge = 0.50;

        float smallEnv = 0.0;
        for (int i = 0; i < SMALL_COUNT; ++i) {
            float rs = smallRanges[i].x, re = smallRanges[i].y;
            float inE  = smoothstep(rs - atkSmall, rs + atkSmall, localT);
            float outE = 1.0 - smoothstep(re - relSmall, re + relSmall, localT);
            smallEnv = max(smallEnv, inE * outE);
        }

        float medEnv = 0.0;
        for (int i = 0; i < MED_COUNT; ++i) {
            float rs = medRanges[i].x, re = medRanges[i].y;
            float inE  = smoothstep(rs - atkMed, rs + atkMed, localT);
            float outE = 1.0 - smoothstep(re - relMed, re + relMed, localT);
            medEnv = max(medEnv, inE * outE);
        }

        float largeEnv = 0.0;
        for (int i = 0; i < LARGE_COUNT; ++i) {
            float rs = largeRanges[i].x, re = largeRanges[i].y;
            float inE  = smoothstep(rs - atkLarge, rs + atkLarge, localT);
            float outE = 1.0 - smoothstep(re - relLarge, re + relLarge, localT);
            largeEnv = max(largeEnv, inE * outE);
        }

        // Normal speed control with hit envelopes
        float cellDefaultSpeed = 0.5;
        float smallTargetMult  = 2.0;
        float medTargetMult    = 3.0;
        float largeTargetMult  = 4.0;

        float speedSmall = cellDefaultSpeed * mix(1.0, smallTargetMult, smallEnv);
        float speedMed   = cellDefaultSpeed * mix(1.0, medTargetMult,   medEnv);
        float speedLarge = cellDefaultSpeed * mix(1.0, largeTargetMult, largeEnv);

        float cellSpeed = max(max(speedSmall, speedMed), speedLarge);

        // Sample cell noise
        vec4 cellCol = cellNoiseMain(cellUV, localT, cellSpeed);

        // Gradual fade-out starting at 57.5s (3:49), ending at 75s
        float fadeStart = 57.5;
        float fadeEnd = 75.0;
        float fadeOutAlpha = 1.0 - smoothstep(fadeStart, fadeEnd, localT);

        // Apply white transition at start, then fade out at end
        vec3 finalRGB = mix(cellCol.rgb, vec3(1.0), fromWhite);
        finalRGB *= fadeOutAlpha;
        float finalA = cellCol.a * fadeOutAlpha;

        fragColor = vec4(finalRGB, finalA);
    }
}
