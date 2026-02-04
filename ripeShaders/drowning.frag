#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

#define TWO_PI 6.28318530718
#define PI 3.14159265359

// --- Shared hash / noise / fbm ---
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

// --- Gyroid / fbmGyroid (from drowning.frag) ---
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
// Domain warp (cheap Iñigo-style)
vec2 domainWarp(in vec2 p, in float speed, in float amp){
    float sc = 0.9;
    vec2 q = p;
    for(int i=0;i<3;i++){
        float s1 = fbmGyroid(vec3(q * sc, u_time * speed + float(i)*12.7));
        float s2 = fbmGyroid(vec3(q * sc + vec2(9.3,4.1), u_time * speed + float(i)*8.3));
        vec2 w = vec2(s1 - 0.5, s2 - 0.5) * (amp * (0.6 + 0.4*float(i)));
        q += w;
        sc *= 1.8;
    }
    return q;
}

// ---------------------
// Voronoi helper used by drowning
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
// drowning.frag rendering (bug swarms + creature)
float swarm1Brightness = 0.0;
float swarm2Brightness = 0.0;

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

    float cycle = fract((u_time + appearPhase) / 12.0);
    float life = smoothstep(0.0, 0.2, cycle) * (1.0 - smoothstep(0.7, 1.0, cycle));

    return vec3(0.4, 0.7, 1.0) * glow * life;
}

vec3 renderBugSwarm(vec2 uv, vec3 colorMultiplier, float speed, float density, float thickness) {
    vec2 warpedUV = domainWarp(uv * 0.18, speed, 0.9) * 5.5;

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
    grouping *= densityWave * density;

    // removed oscillating size for "sun" related bugs — fixed size pulse
    float sizePulse = 1.0;
    float bugSize, twinklePhase;
    float bugField = voronoi(warpedUV, bugSize, twinklePhase, sizePulse);

    bugSize *= thickness;

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

    return bugColor * colorMultiplier;
}

vec3 renderBugSwarms(vec2 uv, float thickness1, float thickness2) {
    vec3 totalColor = vec3(0.0);
    totalColor += renderBugSwarm(uv, vec3(1.0), 0.08, 1.0, thickness1);
    float angle = u_time * 0.1;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotatedUV = rot * uv;
    totalColor += renderBugSwarm(rotatedUV, vec3(0.0, 3.0, 1.0), 0.08, 0.5, thickness2);
    return totalColor;
}

// Renderer A (drowning)
vec3 renderA(vec2 uv) {
    swarm1Brightness = sin(u_time);
    float thickness1 = 1.0 + u_time * 0.02;
    float thickness2 = 1.5 + u_time * 0.03;

    vec3 finalColor = vec3(0.0);
    if (swarm1Brightness > 0.0) {
        finalColor = renderBugSwarms(uv, thickness1, thickness2) * swarm1Brightness;
    } else {
        swarm2Brightness = -1.0 * sin(u_time);
        finalColor = renderBugSwarm(uv, vec3(0.3, 1.0, 0.1) + 0.1, 0.4, 0.8, 2.9) * swarm2Brightness;
        float dist = length(uv);
        float mask = 1.0 - smoothstep(3.0, 8.0, dist);
        finalColor *= mask;
    }

    // small base
    return finalColor + vec3(0.01);
}

// ---------------------
// Dunes6-like functions (simplified, no long-term zoom, keep pulsing)
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

vec3 renderSunBase(vec2 uv, float r, float body, float chaosFactor) {
    vec2 chaosUV = uv;
    if (chaosFactor > 0.0) {
        vec2 noiseOffset = vec2(fbm(uv * 4.0 + u_time * 0.2), fbm(uv * 4.0 + u_time * 0.2 + 50.0));
        chaosUV += chaosFactor * 0.4 * (noiseOffset - 0.5);
    }
    vec3 plasma = Solar_Plasma(chaosUV * 3.0);
    vec3 sunColor = plasma * body;
    float tW1 = wave(chaosUV * 6.0 + u_time * 0.2);
    float tW2 = wave2(chaosUV * 6.5 - u_time * 0.15);
    float tendrilField = abs(tW1 - tW2);
    float purpleMask = smoothstep(0.3, 0.7, tendrilField);
    vec3 purpleTendrils = vec3(0.15, 0.0, 0.25) * (1.0 - purpleMask) * 0.35 * (1.0 + chaosFactor * 2.0);
    sunColor -= purpleTendrils;
    float decayField = wave(chaosUV * 3.5 + u_time * 0.4) * wave2(chaosUV * 4.0 - u_time * 0.3);
    float decayMask = smoothstep(0.75, 0.9, abs(decayField));
    vec3 decayCells = vec3(0.05, 0.1, 0.4) * decayMask * 0.6 * (1.0 + chaosFactor * 3.0);
    sunColor -= decayCells * body;
    return sunColor;
}

vec3 renderSunEffects(vec2 uv, float r, vec3 sunColor, float chaosFactor) {
    // remove fbm-based halo distortion to eliminate grain on sun
    float haloDistortion = 0.0;
    float glow = exp(-3.0 * max(r + haloDistortion - 0.5, 0.0));
    vec3 halo = vec3(1.0, 0.7, 0.3) * glow;

    float m1 = wave(uv * 4.0 + u_time * 0.2);
    float m2 = wave2(uv * 3.5 - u_time * 0.15);
    float edgeRegion = smoothstep(0.45, 0.55, r);
    float tendrilMask = (m1 - m2) * edgeRegion * 0.3 * (1.0 + chaosFactor * 1.5);
    vec3 plasma = Solar_Plasma(uv * 3.0);
    vec3 tendrils = vec3(1.0, 0.6, 0.2) * tendrilMask * plasma;

    return sunColor + halo + tendrils;
}

vec3 renderSand(vec2 uv, float r, float body, vec3 sunColor) {
    // remove grain: disable fbm-based sand grain and darkening
    // keep a very subtle uniform tint optionally (or return sunColor unchanged)
    // float sandGrain = fbm(sandUV * 20.0);
    // set to zero to remove grain
    // also avoid darkenAmount-based subtraction
    return sunColor;
}

vec3 renderTendrilCloud(vec2 uv, float r, float chaosFactor) {
    vec2 offsetUV = uv + vec2(-0.5, 0.0);
    float t1 = wave(offsetUV * 1.5 + u_time * 0.1);
    float t2 = wave2(offsetUV * 1.7 - u_time * 0.08);
    float cloudDensity = (t1 + t2) * 0.5;
    cloudDensity = smoothstep(0.0, 0.5, cloudDensity);
    cloudDensity *= (1.0 + chaosFactor * 0.5);
    vec3 cloudColor = vec3(1.0, 1.0, 1.0) * cloudDensity * 0.6;
    float mask = smoothstep(0.0, 1.0, r);
    cloudColor *= mask;
    return cloudColor;
}

// Renderer B (dunes6-derived), no long-term zoom, keep pulsing size
vec3 renderB(vec2 uv) {
    float r = length(uv);
    // disable size oscillation: keep pulse fixed at 1.0
    float pulse = 1.0;
    // apply pulse to uv scale (no long-term growth or oscillation)
    vec2 uvScaled = uv / 6.0 / pulse;
    float r2 = length(uvScaled);
    float body = smoothstep(1.0, 0.0, r2); // sun body mask
    float chaosFactor = 0.0; // keep subtle; could be animated
    vec3 sunBase = renderSunBase(uvScaled, r2, body, chaosFactor);
    vec3 sunWithSand = renderSand(uvScaled, r2, body, sunBase);
    vec3 finalSun = renderSunEffects(uvScaled, r2, sunWithSand, chaosFactor);
    vec3 tendrilCloud = renderTendrilCloud(uvScaled, r2, chaosFactor);
    vec3 color = finalSun + tendrilCloud;
    color *= smoothstep(1.5, 0.9, r2);
    return color;
}

// ---------------------
// Main: show A and B, but never render both at once — fade to black in between.
// Period: 60s per swap. Timeline per minute:
// 0..28s     -> A full
// 28..30s    -> A fades to black
// 30..32s    -> B fades in from black
// 32..60s    -> B full
void main() {
    vec2 uvA = vPos.xy * 2.0;
    vec2 uvB = vPos.xy;

    float phase = mod(u_time, 60.0);
    vec3 finalCol = vec3(0.0);

    if (phase < 28.0) {
        // A full
        finalCol = renderA(uvA);
    } else if (phase < 30.0) {
        // A -> black
        float a = 1.0 - (phase - 28.0) / 2.0;
        finalCol = renderA(uvA) * a;
    } else if (phase < 32.0) {
        // black -> B
        float a = (phase - 30.0) / 2.0;
        finalCol = renderB(uvB) * a;
    } else {
        // B full
        finalCol = renderB(uvB);
    }

    fragColor = vec4(finalCol, 1.0);
}