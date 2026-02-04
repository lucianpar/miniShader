#version 330 core

in vec3 vPos;
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

const float TRACK_LENGTH = 255.0;  // updated to 255 seconds

// === Noise functions for sandy effect ===
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
        vec2 noiseOffset = vec2(fbm(uv * 4.0 + u_time * 0.2), fbm(uv * 4.0 + u_time * 0.2 + 50.0));
        chaosUV += chaosFactor * 0.4 * (noiseOffset - 0.5); // centered distortion
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

void main() {
    float t = u_time;

    // Timeline logic
    float orbOpacity = 1.0; // always visible
    float growthFactor = mix(0.001, 2.0, t / 255.0); // start super tiny, slow growth over entire track
    float sandIntensity = 0.0;
    float tendrilDensity = 0.0;
    bool isParticles = false;
    bool blueGlow = false; // flag for blueish glow in center

    // Sand fade in/out gradual, smoothed over longer periods
    if (t >= 28.0 && t <= 35.0) {
        float fadeIn = smoothstep(28.0, 30.0, t); // 2 seconds fade in
        float fadeOut = smoothstep(35.0, 33.0, t); // 2 seconds fade out
        sandIntensity = fadeIn * fadeOut;
        blueGlow = true;
    }
    if (t >= 43.0 && t <= 49.0) {
        float fadeIn = smoothstep(43.0, 45.0, t);
        float fadeOut = smoothstep(49.0, 47.0, t);
        sandIntensity = fadeIn * fadeOut;
        blueGlow = true;
    }
    if (t >= 75.0 && t <= 84.0) {
        float fadeIn = smoothstep(75.0, 77.0, t);
        float fadeOut = smoothstep(84.0, 82.0, t);
        sandIntensity = fadeIn * fadeOut;
        blueGlow = true;
    }
    if (t >= 91.0 && t <= 136.5) {
        float fadeIn = smoothstep(91.0, 93.0, t);
        float fadeOut = smoothstep(136.5, 134.5, t);
        sandIntensity = fadeIn * fadeOut;
        blueGlow = true;
    }
    if (t >= 141.0 && t <= 255.0) {
        float fadeIn = smoothstep(141.0, 143.0, t);
        sandIntensity = fadeIn;
        blueGlow = true;
    }

    // Tendril fade in/out gradual
    if (t >= 49.0 && t <= 66.0) {
        float fadeIn = smoothstep(49.0, 52.0, t);
        float fadeOut = smoothstep(66.0, 63.0, t);
        tendrilDensity = 0.6 * fadeIn * fadeOut;
    }
    if (t >= 93.0 && t <= 112.0) {
        float fadeIn = smoothstep(93.0, 96.0, t);
        float fadeOut = smoothstep(112.0, 109.0, t);
        tendrilDensity = 0.3 * fadeIn * fadeOut;
    }
    if (t >= 143.0 && t <= 173.0) {
        float fadeIn = smoothstep(143.0, 146.0, t);
        float fadeOut = smoothstep(173.0, 170.0, t);
        tendrilDensity = 0.6 * fadeIn * fadeOut;
    }
    if (t >= 173.0 && t <= 255.0) {
        isParticles = true;
        tendrilDensity = 1.0 - (t - 173.0) / (255.0 - 173.0);
    }

    // No more orb opacity phases, always visible

    // --- No pulsing ---

    // scale uv: smaller growthFactor → smaller object
    vec2 uv = (vPos.xy / 6.0) / growthFactor;
    float r = length(uv);

    // === Sun body mask ===
    float sunRadius = 1.0;
    float body = smoothstep(sunRadius, 0.0, r);

    // === Chaos factor increases over the track ===
    float chaosFactor = 1.0; // always max for now

    // === Modular rendering ===
    vec3 sunBase = renderSunBase(uv, r, body, chaosFactor, blueGlow);
    vec3 sunWithSand = renderSand(uv, r, body, sunBase, sandIntensity);
    vec3 finalSun = renderSunEffects(uv, r, sunWithSand, chaosFactor);
    
    // === Add Tendril Cloud over top ===
    vec3 tendrilCloud = renderTendrilCloud(uv, r, chaosFactor, tendrilDensity, isParticles);

    // === Combine ===
    vec3 color = finalSun + tendrilCloud;

    // keep background black
    color *= smoothstep(1.5, 0.9, r);

    fragColor = vec4(color, 1.0);
}
