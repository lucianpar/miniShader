#version 330 core

in vec3 vPos;
out vec4 fragColor;

uniform float u_time;

const float TRACK_LENGTH = 204.0;  // updated to 204 seconds

#define TWO_PI 6.283

// ---------------------
// Hash & Noise
// ---------------------
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i=0; i<3; i++) {  // Reduced from 5 to 3 octaves
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float gyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbmGyroid(vec3 seed) {
    float result = 0.0, a = 0.5;
    for (int i = 0; i < 2; ++i) {  // Reduced from 4 to 2 iterations
        seed.z += result * 0.3;
        result += abs(gyroid(seed / a)) * a;
        a *= 0.5;
    }
    return result;
}

// ---------------------
// Domain warp (Iñigo-style, cheap) ----------------------------------------
// iterative domain distortion using fbmGyroid to create pockets / blobs
vec2 domainWarp(in vec2 p, in float speed, in float amp){
    // iterative warping: low iteration count for efficiency
    float sc = 0.9;
    vec2 q = p;
    for(int i=0;i<2;i++){  // Reduced from 3 to 2 iterations
        // sample two orthogonal fbmGyroid-driven scalars
        float s1 = fbmGyroid(vec3(q * sc, u_time * speed + float(i)*12.7));
        float s2 = fbmGyroid(vec3(q * sc + vec2(9.3,4.1), u_time * speed + float(i)*8.3));
        // center around zero and apply smaller amplitude for stability
        vec2 w = vec2(s1 - 0.5, s2 - 0.5) * (amp * (0.6 + 0.4*float(i)));
        q += w;
        sc *= 1.8;
    }
    return q;
}

// ---------------------
// Voronoi Bugs
// ---------------------
float voronoi(vec2 uv, out float bugSize, out float twinklePhase, float sizePulse) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float minDist = 1.0;
    float chosenSize = 0.2;
    float chosenPhase = 0.0;

    for (int y = -1; y <= 0; y++) {  // Reduced to 2x2 neighborhood
        for (int x = -1; x <= 0; x++) {
            vec2 neighbor = vec2(x, y);
            float h = hash(i + neighbor);

            vec2 point = 0.5 + 0.5 * vec2(hash(i+neighbor*1.7),
                                      hash(i+neighbor*2.3));  // Simplified, removed sin/cos animation

            vec2 diff = neighbor + point - f;
            float d = length(diff);
            if (d < minDist) {
                minDist = d;
                chosenSize = (0.08 + 0.1 * hash(i + neighbor*3.1)) * sizePulse;
                chosenPhase = h * TWO_PI;
            }
        }
    }
    bugSize = chosenSize;
    twinklePhase = chosenPhase;
    return minDist;
}

// ---------------------
// Render Bug Swarm (modularized with parameters)
// ---------------------
vec3 renderBugSwarm(vec2 uv, vec3 colorMultiplier, float speed, float density, float thickness) {
    // domain-warp uv to create pockets / mold-like grouping
    vec2 warpedUV = domainWarp(uv * 0.18, speed, 0.9); // use speed parameter

    // === Bug Swarm ===
    vec2 flow = vec2(
        fbmGyroid(vec3(warpedUV*0.02, u_time*0.05)),
        fbmGyroid(vec3(warpedUV*0.02 + 50.0, u_time*0.05))
    ) * 4.0;  // Reduced amplitude from 8.0 to 4.0

    float dynamicScale = 0.03 + 0.015*sin(u_time * 0.17)
                       + 0.01*fbmGyroid(vec3(0.0,0.0,u_time*0.1));

    float ang = fbmGyroid(vec3(warpedUV*0.01, u_time*0.03)) * TWO_PI * 0.05;  // Reduced multiplier from 0.1 to 0.05
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));

    float gy = fbmGyroid(vec3(rot * warpedUV * dynamicScale + flow, u_time*0.02));
    float grouping = smoothstep(0.4, 0.65, gy);

    float densityWave = 0.6 + 0.4*fbmGyroid(vec3(0.0,0.0,u_time*0.05));
    grouping *= densityWave * density; // apply density parameter

    float sizePulse = 0.9 + 0.2*sin(u_time * 2.0);
    float bugSize, twinklePhase;
    float bugField = voronoi(warpedUV, bugSize, twinklePhase, sizePulse);

    bugSize *= thickness; // apply thickness parameter

    float bugs = smoothstep(bugSize, 0.0, bugField);
    float glow = smoothstep(bugSize*1.6, bugSize*1.2, bugField);
    bugs += glow * 0.3;

    float twinkle = 0.5 + 0.5*sin(u_time*3.0 + twinklePhase);
    bugs *= (0.7 + 0.3*twinkle);
    bugs *= grouping;

    vec3 base   = vec3(0.01, 0.0, 0.05);
    vec3 accent = vec3(0.12, 0.05, 0.3) * 1.2;
    vec3 glowC  = vec3(0.3, 0.2, 0.65) * 3.0;

    vec3 bugColor = mix(base, accent, bugs);
    bugColor = mix(bugColor, glowC, pow(bugs, 2.0));

    return bugColor * colorMultiplier; // apply color multiplier
}

// ---------------------
// Render All Bug Swarms (modularized into one function)
// ---------------------
vec3 renderBugSwarms(vec2 uv, float thickness1, float thickness2, float speedMult, vec3 colorMult1, float density1) {
    vec3 totalColor = vec3(0.0);
    
    // Swarm 1: default purple swarm with animated thickness, speed mult, color mult, density
    totalColor += renderBugSwarm(uv, colorMult1, 0.08 * speedMult, density1, thickness1);
    
    // Swarm 2: rotated, less dense, bright green, thicker with animated thickness, speed mult
    // float angle = u_time * 0.1 * speedMult; // slow rotation
    // mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    // vec2 rotatedUV = rot * uv;
    // totalColor += renderBugSwarm(rotatedUV, vec3(0.0, 3.0, 1.0), 0.08 * speedMult, 0.5, thickness2);
    totalColor += renderBugSwarm(uv, vec3(0.0, 3.0, 1.0), 0.08 * speedMult, 0.5, thickness2);
    
    return totalColor;
}

// ---------------------
// Main
// ---------------------
void main() {
    float t = u_time;
   

    // Timeline variables
    float swarm1Brightness = 1.0;
    float swarm2Brightness = 0.0;
    float speedMult = 2.0; // always normal, no speed changes
    vec3 colorMult1 = vec3(1.0); // additional color for swarm1 later
    float zoom = 1.0;
    float fadeToBlack = 1.0;
    float density1 = 1.0; // density for swarm1


    // base uv for the bug-field (higher frequency space)
    vec2 uv = vPos.xy * 2.0 * zoom; // apply zoom

    // Animate thickness parameters, start slightly less thick, full at 1:40 (100s), then decrease
    float thickness1 = mix(0.1, 3.0, t / 500.0); // start at 0.5
    // if (t > 100.0) thickness1 *= (204.0 - t) / 104.0;
    float thickness2 = 1.5 + t * 0.01; // faster increase

    vec3 finalColor = vec3(0.0);

    // Render swarms based on brightness
    if (swarm1Brightness > 0.0) {
        finalColor += renderBugSwarms(uv, thickness1, thickness2, speedMult, colorMult1, density1) * swarm1Brightness;
    }
    if (swarm2Brightness > 0.0) {
        // Unique thin green-white swarm for swarm2
        finalColor += renderBugSwarm(uv, vec3(0.3, 1.0, 0.1) + 0.2, 0.4 * speedMult, 0.8, 2.9) * swarm2Brightness;
        // Removed circular masking for simpler ending
    }

    finalColor *= fadeToBlack;

    fragColor = vec4(finalColor + 0.01, 1.0);
}