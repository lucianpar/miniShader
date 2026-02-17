#version 330 core

in vec3 vPos;
out vec4 fragColor;

uniform float u_time;


#define TWO_PI 6.283

/////SUN CODE BELOW


// === Noise functions for sandy effect ===
float SUNhash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

float SUN1noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = SUNhash(i);
    float b = SUNhash(i + vec2(1.0,0.0));
    float c = SUNhash(i + vec2(0.0,1.0));
    float d = SUNhash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i=0; i<5; i++) {
        v += a * SUN1noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// === Plasma noise functions ===
float wave(vec2 p) {
    float v = sin(p.x + sin(p.y * 2.0) + sin(p.y * 0.43));
    v += 0.7 * sin(p.y * 1.5 + u_time * 0.2);
    v += 0.5 * cos(p.x * 1.7 - u_time * 0.15);
    return v;
}

float wave2(vec2 p) {
    p = mat2(cos(0.7), -sin(0.7), sin(0.7), cos(0.7)) * p;
    float v = cos(p.y + sin(p.x * 2.1) + sin(p.x * 0.37));
    v += 0.7 * cos(p.x * 1.3 - u_time * 0.23);
    v += 0.5 * sin(p.y * 1.9 + u_time * 0.18);
    return v;
}

// === Base plasma coloring ===
vec3 Solar_Plasma(vec2 p) {
    float v1 = wave(p * 2.0 + u_time * 0.05);
    float v2 = wave2(p * 2.2 - u_time * 0.03);

    vec3 core = vec3(1.0, 0.95, 0.7);
    vec3 mid  = vec3(1.0, 0.5, 0.1);
    vec3 edge = vec3(0.4, 0.0, 0.0);

    float t = 0.5 + 0.5 * (v1 + v2) * 0.5;
    vec3 color = mix(core, mid, smoothstep(0.0, 1.0, t));
    color = mix(color, edge, pow(t, 3.0));

    return color;
}

// === Render Sun Base (body, purple tendrils, decay cells) ===
vec3 renderSunBase(vec2 uv, float r, float body, float chaosFactor, bool blueGlow) {
    // Apply chaotic distortion to UV based on chaos factor
    vec2 chaosUV = uv;
    if (chaosFactor > 0.0) {
        vec2 SUNnoiseOffset = vec2(fbm(uv * 4.0 + u_time * 0.2), fbm(uv * 4.0 + u_time * 0.2 + 50.0));
        chaosUV += chaosFactor * 0.4 * (SUNnoiseOffset - 0.5); // centered distortion
    }

    vec3 plasma = Solar_Plasma(chaosUV * 3.0);
    vec3 sunColor = plasma * body;

    // Blueish glow in center during blueGlow periods
    if (blueGlow) {
        float centerMask = smoothstep(0.5, 0.0, r); // stronger in center
        vec3 blueGlowColor = vec3(0.2, 0.5, 1.0) * centerMask * 0.8;
        sunColor = mix(sunColor, blueGlowColor, centerMask);
    }

    // Dark purple inner tendrils - intensify with chaos
    float tW1 = wave(chaosUV * 6.0 + u_time * 0.2);
    float tW2 = wave2(chaosUV * 6.5 - u_time * 0.15);
    float tendrilField = abs(tW1 - tW2);
    float purpleMask = smoothstep(0.3, 0.7, tendrilField);
    vec3 purpleTendrils = vec3(0.15, 0.0, 0.25) * (1.0 - purpleMask) * 0.35 * (1.0 + chaosFactor * 2.0);
    sunColor -= purpleTendrils;

    // Decay cells - intensify with chaos
    float decayField = wave(chaosUV * 3.5 + u_time * 0.4) * wave2(chaosUV * 4.0 - u_time * 0.3);
    float decayMask = smoothstep(0.75, 0.9, abs(decayField));
    vec3 decayCells = vec3(0.05, 0.1, 0.4) * decayMask * 0.6 * (1.0 + chaosFactor * 3.0);
    sunColor -= decayCells * body;

    return sunColor;
}

// === Render Sun Effects (halo, tendrils) ===
vec3 renderSunEffects(vec2 uv, float r, vec3 sunColor, float chaosFactor) {
    // Glow halo - make it more chaotic
    float haloDistortion = chaosFactor * 0.2 * fbm(uv * 2.0 + u_time * 0.1);
    float glow = exp(-3.0 * max(r + haloDistortion - 0.5, 0.0));
    vec3 halo = vec3(1.0, 0.7, 0.3) * glow;

    // Subtle tendrils near edge - intensify with chaos
    float m1 = wave(uv * 4.0 + u_time * 0.2);
    float m2 = wave2(uv * 3.5 - u_time * 0.15);
    float edgeRegion = smoothstep(0.45, 0.55, r);
    float tendrilMask = (m1 - m2) * edgeRegion * 0.3 * (1.0 + chaosFactor * 1.5);
    vec3 plasma = Solar_Plasma(uv * 3.0); // needed for tendrils
    vec3 tendrils = vec3(1.0, 0.6, 0.2) * tendrilMask * plasma;

    return sunColor + halo + tendrils;
}

// === Render Sand (reddish grainy obscuring effect extending around the orb) ===
vec3 renderSand(vec2 uv, float r, float body, vec3 sunColor, float sandIntensity) {
    // Sandy noise that obscures the sun like blowing sand from all directions
    // Use rotating and noisy offset for irregular, multi-directional movement
    float angle = u_time * 0.3;
    vec2 rotateOffset = vec2(cos(angle), sin(angle)) * 0.3;
    vec2 noiseOffset = vec2(fbm(uv * 3.0 + u_time * 0.2), fbm(uv * 3.0 + u_time * 0.2 + 10.0)) * 0.5;
    vec2 sandUV = uv + rotateOffset + noiseOffset; // irregular, rotating movement
    
    float sandGrain = fbm(sandUV * 20.0); // higher frequency for finer, grainier sand
    
    // Subtractive obscuring effect - even darker sand (only on sun body)
    float darkenAmount = sandGrain * sandIntensity * 1.8;
    sunColor *= (1.0 - darkenAmount * body);
    
    // Reddish sandy tint extending around the orb
    vec3 sandTint = vec3(0.6, 0.3, 0.2) * sandGrain * sandIntensity * 0.1; // reddish tint
    float sandMask = smoothstep(1.5, 0.5, r); // extends from r=0.5 to 1.5
    sunColor += sandTint * sandMask;

    return sunColor;
}

// === Render Tendril Cloud (wispy tendrils over top) ===
vec3 renderTendrilCloud(vec2 uv, float r, float chaosFactor, float density, bool isParticles) {
    if (isParticles) {
        // Small particles mode
        vec2 particleUV = uv * 10.0 + u_time * 0.1;
        float particles = fbm(particleUV) * density;
        particles = smoothstep(0.3, 0.7, particles);
        return vec3(1.0, 1.0, 1.0) * particles * 0.5;
    } else {
        // Offset UV to move the cloud to the left
        vec2 offsetUV = uv + vec2(-0.5, 0.0); // shift left by 0.5 units
        
        // Use wave functions to create elongated tendrils
        float t1 = wave(offsetUV * 1.5 + u_time * 0.1);
        float t2 = wave2(offsetUV * 1.7 - u_time * 0.08);
        float cloudDensity = (t1 + t2) * 0.5;
        cloudDensity = smoothstep(0.0, 0.5, cloudDensity); // adjusted for more density
        
        // Intensify with chaos
        cloudDensity *= (1.0 + chaosFactor * 0.5);
        
        // White cloud color, adjusted brightness
        vec3 cloudColor = vec3(1.0, 1.0, 1.0) * cloudDensity * density; // use density parameter
        
        // Mask to appear over the sun, starting from center
        float mask = smoothstep(0.0, 1.0, r); // visible from center
        cloudColor *= mask;
        
        return cloudColor;
    }
}


//////BRIGHT BUGS CODE BELOW 

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

float gyroid(vec3 seed) {
    return dot(sin(seed), cos(seed.yzx));
}

float fbmGyroid(vec3 seed) {
    float result = 0.0, a = 0.5;
    for (int i = 0; i < 4; ++i) {
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
    for(int i=0;i<3;i++){
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

    for (int y = -1; y <= 0; y++) {  // Reduced to 2x2 neighborhood for performance
        for (int x = -1; x <= 0; x++) {
            vec2 neighbor = vec2(x, y);
            float h = hash(i + neighbor);

            vec2 point = 0.5 + 0.5 * vec2(h, h);  // Simplified to use single hash for both components

            vec2 diff = neighbor + point - f;
            float d = length(diff);
            if (d < minDist) {
                minDist = d;
                chosenSize = 0.1 * sizePulse;  // Simplified to remove hash call for performance
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
    ) * 4.0;  // Reduced amplitude for performance

    float dynamicScale = 0.03 + 0.015*sin(u_time * 0.17);  // Removed fbmGyroid for performance

    // float ang = 0.0;  // Removed fbmGyroid call for performance, disabling rotation
    // mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));

    float gy = fbmGyroid(vec3(warpedUV * dynamicScale + flow, u_time*0.02));
    float grouping = smoothstep(0.4, 0.65, gy);

    grouping *= density;  // Simplified densityWave to 1.0 for performance

    float sizePulse = 0.9 + 0.2*sin(u_time * 2.0);
    float bugSize, twinklePhase;
    float bugField = voronoi(warpedUV, bugSize, twinklePhase, sizePulse);

    bugSize *= thickness; // apply thickness parameter

    float bugs = smoothstep(bugSize, 0.0, bugField);
    float glow = smoothstep(bugSize*1.6, bugSize*1.2, bugField);
    bugs += glow * 0.3;

    float twinkle = 0.5 + 0.5*sin(u_time*3.0 + twinklePhase);
    bugs *= (0.7 + 0.2*twinkle);
    bugs *= grouping;

    vec3 base   = vec3(0.01, 0.0, 0.05);
    vec3 accent = vec3(0.12, 0.05, 0.3) * 8.2;
    vec3 glowC  = vec3(0.3, 0.2, 0.65) * 20.0;

    vec3 bugColor = mix(base, accent, bugs);
    bugColor = mix(bugColor, glowC, bugs * bugs);  // Replaced pow(bugs, 2.0) with bugs*bugs for performance

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
    //BUGS CODE
     float t = u_time;
   

    // Timeline variables
    float swarm1Brightness = 0.8;
    float swarm2Brightness = 0.0;
    float speedMult = 0.3; // always normal, no speed changes
    vec3 colorMult1 = vec3(1.5, 1.2, 1.0); // additional color for swarm1 later
    float zoom = 1.0;
    float fadeToBlack = 1.0;
    float density1 = 2.0; // density for swarm1


    // base uv for the bug-field (higher frequency space)
    vec2 uv = vPos.xy * 2.0 * zoom; // apply zoom

    // Animate thickness parameters, start slightly less thick, full at 1:40 (100s), then decrease
    float thickness1 = mix(0.01, 3.0, t / 500.0); // start at 0.5
    // if (t > 100.0) thickness1 *= (204.0 - t) / 104.0;
    float thickness2 = 1.5 + t * 0.01; // faster increase

    vec3 warpScene = vec3(0.0);

    warpScene += renderBugSwarms(uv, thickness1, thickness2, speedMult, colorMult1, density1) * swarm1Brightness;

    // // Render swarms based on brightness
  
    
    // if (swarm2Brightness > 0.0) {
    //     // Unique thin green-white swarm for swarm2
    //     finalColor += renderBugSwarm(uv, vec3(0.3, 1.0, 0.1) + 0.2, 0.4 * speedMult, 0.8, 2.9) * swarm2Brightness;
    //     // Removed circular masking for simpler ending
    // }

    warpScene *= fadeToBlack;

    fragColor = vec4(warpScene + 0.01, 1.0);
}