#version 330 core

in vec3 vPos;
out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.283

float sceneBrightness = 0.0;

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
    for (int i=0; i<5; i++) {
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

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(x, y);
            float h = hash(i + neighbor);

            vec2 point = vec2(
                sin(u_time*0.25 + h*6.28),
                cos(u_time*0.2 + h*6.28)
            ) * 0.25;

            point += 0.5 + 0.5 * vec2(hash(i+neighbor*1.7),
                                      hash(i+neighbor*2.3));

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
// Tangled Arms Creature (SDF-like)
// ---------------------
float tangleSDF(vec2 pos, float timeShift) {
    float r = length(pos);
    float a = atan(pos.y,pos.x);

    float base = 0.22 + 0.04*sin(u_time*0.7 + timeShift);

    float arms = 0.05*sin(5.0*a + u_time*0.8 + fbm(pos*1.5+u_time))
               + 0.04*sin(7.0*a - u_time*0.6 + fbm(pos*2.5-u_time*0.3))
               + 0.03*sin(11.0*a + u_time*1.1 + fbm(pos*3.7+u_time*0.5))
               + 0.02*sin(17.0*a - u_time*0.4 + fbm(pos*4.2-u_time*0.8));

    arms += 0.03 * (fbm(pos*3.0 + u_time*0.2) - 0.5);

    float radius = base + arms;
    return r - radius;
}

vec3 renderCreature(vec2 uv, vec2 offset, float timeShift, float appearPhase) {
    vec2 pos = uv - offset;
    pos.x += 0.3*sin(u_time*0.1 + timeShift);
    pos.y += 0.3*cos(u_time*0.07 + timeShift*1.3);

    float d = tangleSDF(pos, timeShift);

    float glow = exp(-40.0*abs(d));
    glow *= 0.6 + 0.4*sin(u_time*2.0 + timeShift);

    // Dissolve in/out factor
    float cycle = fract((u_time + appearPhase) / 12.0); // 12s cycle
    float life = smoothstep(0.0, 0.2, cycle) * (1.0 - smoothstep(0.7, 1.0, cycle));

    return vec3(0.4, 0.7, 1.0) * glow * life;
}

// ---------------------
// Render Bug Swarm (modularized with parameters)
// ---------------------
vec3 renderBugSwarm(vec2 uv, vec3 colorMultiplier, float speed, float density, float thickness) {
    // domain-warp uv to create pockets / mold-like grouping
    vec2 warpedUV = domainWarp(uv * 0.18, speed, 0.9) * 5.5; // use speed parameter

    // === Bug Swarm ===
    vec2 flow = vec2(
        fbmGyroid(vec3(warpedUV*0.02, u_time*0.05)),
        fbmGyroid(vec3(warpedUV*0.02 + 50.0, u_time*0.05))
    ) * 8.0;

    float dynamicScale = 0.03 + 0.015*sin(u_time * 0.17)
                       + 0.01*fbmGyroid(vec3(0.0,0.0,u_time*0.1));

    float ang = fbmGyroid(vec3(warpedUV*0.01, u_time*0.03)) * TWO_PI * 0.1;
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
// Main
// ---------------------
void main() {
    // base uv for the bug-field (higher frequency space)
    sceneBrightness = float(sin(u_time)); // brightness oscillates between 0 and 1); //change pulsing behaviour timeq
    vec2 uv = vPos.xy * 2.0;

    // first swarm: default
    vec3 bugColor1 = renderBugSwarm(uv, vec3(1.0), 0.08, 1.0, 1.0);

    // second swarm: rotated, less dense, bright green, thicker
    float angle = u_time * 0.1; // slow rotation
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotatedUV = rot * uv;
    vec3 bugColor2 = renderBugSwarm(rotatedUV, vec3(0.0, 3.0, 1.0), 0.08, 0.5, 1.5); // green, less dense, thicker

    // === One Creature at a Time ===
    // vec2 uvCreature = vPos.xy;
    // vec3 creatureColor = renderCreature(uvCreature, vec2(0.2, -0.1), 1.7, 0.0);

    // === Combine ===
    vec3 finalColor = bugColor1 + bugColor2 ;//+ creatureColor;

    fragColor = vec4( sceneBrightness * finalColor + 0.01, 1.0);
}