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
    float fadeIn = smoothstep(0.0, 3.0, t);
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

vec4 cellNoiseMain(vec2 uv, float t){
    vec2 newUV = uv / 3.0;
    vec4 outColor = CellNoiseCloud(newUV, t);
    vec4 finalColor;

    // black background when no contribution
    if(outColor.a < 0.001){
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

// === MAIN ===
void main() {
    vec2 uv = vPos.xy / 10.0;
    float t = u_time;

    //SECTION 1

    // 0:00 – 1:04 (64s): Smoke with gradual acceleration
    if (t >= 0.0 && t < 64.0) {
        // We'll build the zoom as cumulative decreases so each phase continues
        // smoothly from the previous one (no jumps at 28s or 58s).
        float zoom = 1.0;

        // cumulative decreases
        float dec1 = smoothstep(0.0, 28.0, t) * 0.4;          // 0 -> 28s: up to -0.4
        float dec2 = smoothstep(28.0, 58.0, t) * 0.2;         // 28 -> 58s: additional -0.2
        float dec3 = smoothstep(58.0, 64.0, t) * 0.3;         // 58 -> 64s: final quick -0.3

        zoom = zoom - dec1 - dec2 - dec3;
        zoom = clamp(zoom, 0.05, 1.0);

        // speed multiplier: continuous ramps between the same phase boundaries
        float speedMult = 0.005; // base very slow

        if (t < 28.0) {
            speedMult = 0.005; // Very slow movement (0:00 - 0:28)
        } else if (t < 58.0) {
            // Gradually accelerate (0:28 - 0:58)
            float phase = (t - 28.0) / 30.0; // 0 -> 1
            speedMult = mix(0.005, 0.03, smoothstep(0.0, 1.0, phase));
        } else {
            // Fast and intense (0:58 - 1:04)
            float phase = (t - 58.0) / 6.0; // 0 -> 1
            speedMult = mix(0.03, 0.08, smoothstep(0.0, 1.0, phase));
        }

        vec2 zoomedUV = uv * zoom;
        fragColor = SmokeMain(zoomedUV, t, speedMult);
    }

    //SECTION 2
    // 1:04 – 1:42 (64-102s): Grey background with progressive black movements
    else if (t >= 64.0 && t < 102.0) {
        float localT = t - 64.0;

        // Static grey background
        vec4 greyBg = vec4(0.5, 0.5, 0.5, 1.0);
        vec4 blackMotion = NoisySmokeFinal(uv, localT);

        // Progressive introduction of black movements
        float movementIntensity = 0.0;

        // Sync with audio onsets
        if ((localT >= 14.0 && localT < 18.0) ||  // 1:18–1:22
            (localT >= 20.0 && localT < 23.0) ||  // 1:24–1:27
            (localT >= 24.0 && localT < 38.0)) {  // 1:28–1:42
            movementIntensity = smoothstep(0.0, 1.0, fract(localT * 0.5)); // React to audio events
        }

        // Subtle visual shifts to match quiet sonic textures
        vec2 subtleShift = vec2(
            sin(localT * 0.3) * 0.01, // Horizontal subtle motion
            cos(localT * 0.2) * 0.01  // Vertical subtle motion
        );
        vec2 shiftedUV = uv + subtleShift;

        // Combine grey background and black motion with intensity
        fragColor = mix(greyBg, NoisySmokeFinal(shiftedUV, localT), movementIntensity);
    }
    //SECTION 3
    // 1:42 – 2:18 (102-138s): White movements with cross-cuts and blackout
    else if (t >= 102.0 && t < 138.0) {
        float localT = t - 102.0;
        
        // White cross-cuts at 1:55–1:56 (13-14s) and 2:13–2:14 (31-32s)
        if ((localT >= 13.0 && localT < 14.0) || (localT >= 31.0 && localT < 32.0)) {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
        // White still image during silence 2:14–2:17 (32-35s)
        else if (localT >= 32.0 && localT < 35.0) {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
        // Blackout at 2:17–2:18 (35-36s)
        else if (localT >= 35.0 && localT < 36.0) {
            fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
        else {
            // Determine speed from onset events: when there's an onset -> use default (1.0),
            // otherwise run very slowly (0.1).
            // isOnsetAt expects a global time, so pass `t` (u_time).
            float eventSpeed = isOnsetAt(t) ? 1.0 : 0.1;
            fragColor = PointLineMain(uv, localT, eventSpeed);
        }
    }
    //SECTION 4
    // 2:18 – 2:48 (138-168s): Gradual zoom with irregular movements
    else if (t >= 138.0 && t < 168.0) {
        float localT = t - 138.0;

        // Gradual zoom-in with smooth interpolation
        float zoomProgress = localT / 30.0;
        float zoom = 1.0 - smoothstep(0.0, 1.0, zoomProgress) * 0.3;

        // Audio-reactive onset for Section 4: when an onset is active, use full motion;
        // otherwise run very slowly.
        bool onset = isOnsetSection4(t); // pass global time
        float ampFactor  = onset ? 1.0 : 0.08;  // amplitude multiplier (small when idle)
        float freqFactor = onset ? 1.0 : 0.25;  // frequency multiplier (slower when idle)

        // Irregular movement (different speeds for x and y), now audio-reactive
        vec2 offset = vec2(
            sin(localT * 0.7 * freqFactor) * 0.02 * ampFactor,
            cos(localT * 0.5 * freqFactor) * 0.015 * ampFactor
        );

        vec2 zoomedUV = (uv + offset) * zoom;

        // Extreme zoom-in at 2:48 (end of section)
        if (localT >= 28.0) {
            float extremeZoom = smoothstep(28.0, 30.0, localT);
            zoom = mix(zoom, 0.3, extremeZoom); // Black hole effect
            zoomedUV = uv * zoom;
        }

        fragColor = SmokeMain(zoomedUV, localT + 138.0, 0.02);
    }
    //SECTION 5
    // 2:48 – End (168s+): Irregular rhythm with distortions and flashes
    else if (t >= 168.0) {
        float localT = t - 168.0;
        
        // Gradual zoom-in with smooth interpolation
        float zoomProgress = localT / 60.0;
        float zoom = 1.0 - smoothstep(0.0, 1.0, zoomProgress) * 0.4;
        
        vec2 zoomedUV = uv * zoom;
        
        // Brief distortions synced with bass hits
        float distortion = 0.0;
        
        // Single bass hits (brief distortions)
        if ((localT >= 2.0 && localT < 2.2) ||    // 2:50
            (localT >= 4.0 && localT < 4.2) ||    // 2:52
            (localT >= 6.0 && localT < 6.2) ||    // 2:54
            (localT >= 10.0 && localT < 10.2) ||  // 2:58
            (localT >= 12.0 && localT < 12.2) ||  // 3:00
            (localT >= 17.0 && localT < 17.2) ||  // 3:05
            (localT >= 19.0 && localT < 19.2) ||  // 3:07
            (localT >= 23.0 && localT < 23.2) ||  // 3:11
            (localT >= 25.0 && localT < 25.2)) {  // 3:13
            distortion = 0.05;
        }
        
        // Longer bass sequences (longer distortions)
        if ((localT >= 7.0 && localT < 8.0) ||    // 2:55–2:56
            (localT >= 13.0 && localT < 15.0) ||  // 3:01–3:03
            (localT >= 20.0 && localT < 22.0) ||  // 3:08–3:10
            (localT >= 27.0 && localT < 29.0)) {  // 3:15–3:17
            distortion = 0.08;
        }
        
        // Even longer distortions
        if ((localT >= 33.0 && localT < 36.0) ||  // 3:21–3:24
            (localT >= 40.0 && localT < 44.0) ||  // 3:28–3:32
            (localT >= 48.0 && localT < 55.0)) {  // 3:36–3:43
            distortion = 0.12;
        }
        
        // Apply smooth distortion
        if (distortion > 0.0) {
            vec2 distortUV = zoomedUV + vec2(
                sin(localT * 20.0 + zoomedUV.y * 10.0) * distortion,
                cos(localT * 15.0 + zoomedUV.x * 10.0) * distortion
            );
            zoomedUV = distortUV;
        }
        
        // White cross-cut flashes around 3:44–4:45 (56-117s)
        bool isFlash = false;
        if (localT >= 56.0 && localT < 117.0) {
            // Flash every 2 seconds for 0.1 seconds
            float flashCycle = mod(localT - 56.0, 2.0);
            if (flashCycle < 0.1) {
                isFlash = true;
            }
        }
        
        if (isFlash) {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        } else {
            fragColor = cellNoiseMain(zoomedUV * 7.0, localT);
        }
    }
}
