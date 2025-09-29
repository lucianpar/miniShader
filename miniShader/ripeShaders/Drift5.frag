#version 330 core

in vec3 vPos; // receive from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;
uniform float onset;
uniform float flux;

#define TWO_PI 6.283

float D = 0.6;

// Expansion/contraction period (0.83s)
const float period = 12.8;
const float osc_speed = TWO_PI / period;

// Animated scale factor for membranes
float membrane_scale() {
    // Oscillates between ~1.2 and ~1.8
    return  1.0+ 0.2 * sin(u_time * osc_speed);
}

float wave(vec2 p)
{
    p *= membrane_scale(); // animated scale up
    float v = sin(p.x + sin(p.y * 2.0) + sin(p.y * 0.43));
    v += 0.7 * sin(p.y * 1.5 + u_time * 0.2); // increased amplitude
    v += 0.5 * cos(p.x * 1.7 - u_time * 0.7); // increased amplitude
    // Removed mod to make waves continuous and flowing
    v *= 0.5; // Scale down to keep values reasonable
    return v;
}

float wave2(vec2 p)
{
    p *= membrane_scale(); // animated scale up
    // Offset, rotate, and time-warp for a complementary membrane
    p = mat2(cos(0.7), -sin(0.7), sin(0.7), cos(0.7)) * p;
    p += vec2(0.7, -0.4);
    float v = cos(p.y + sin(p.x * 2.1) + sin(p.x * 0.37));
    v += 0.7 * cos(p.x * 1.3 - u_time * 0.23); // increased amplitude
    v += 0.5 * sin(p.y * 1.9 + u_time * 0.18); // increased amplitude
    // Removed mod to make waves continuous and flowing
    v *= 0.5; // Scale down to keep values reasonable
    return v;
}

const mat2 rot = mat2(0.5, 0.86, -0.86, 0.5);

float map(vec2 p)
{
    float v = wave(p);
    p.x += u_time * 0.224;  p *= rot;  v += wave(p);
    p.x += u_time * 0.333 / (p.y + 1.2);  p *= rot;  v += wave(p) / (p.x + 1.2);
    return abs(1.5 - v + u_time / 10000.0);
}

float map2(vec2 p)
{
    float v = wave2(p);
    p.y -= u_time * 0.18;  p *= rot;  v += wave2(p);
    p.y -= u_time * 0.29 / (p.x + 1.3);  p *= rot;  v += wave2(p) / (p.y + 1.3);
    return abs(1.5 - v + u_time / 9000.0);
}

vec3 Oceanic_Membrane(vec2 pos)
{
    pos.y += u_time * 0.;
    float v1 = map(pos);
    float v2 = map2(pos * 1.1 - 0.5);

    // Original palette
    vec3 deepBlue = vec3(0.08, 0.18, 0.38);
    vec3 turquoise = vec3(0.1, 0.7, 0.8);
    vec3 foam = vec3(0.85, 0.95, 1.0);

    // Second membrane palette (slightly greenish for depth)
    vec3 kelp = vec3(0.18, 0.5, 0.28);

    // Blend between deep blue and turquoise based on v1, then add foam highlights
    vec3 c1 = mix(deepBlue, turquoise, smoothstep(0.2, 0.8, v1));
    c1 = mix(c1, foam, pow(v1, 8.0));

    // Second membrane: greenish highlights, more subtle
    vec3 c2 = mix(deepBlue, kelp, smoothstep(0.18, 0.7, v2));
    c2 = mix(c2, foam, pow(v2, 10.0));

    // Lighting for both membranes
    vec3 n1 = normalize(vec3(v1 - map(vec2(pos.x + D, pos.y)), v1 - map(vec2(pos.x, pos.y + D)), -D));
    vec3 n2 = normalize(vec3(v2 - map2(vec2(pos.x + D, pos.y)), v2 - map2(vec2(pos.x, pos.y + D)), -D));
    vec3 l = normalize(vec3(0.1, 0.2, -0.5));
    float light1 = dot(l, n1) + pow(dot(l, n1), 40.0);
    float light2 = dot(l, n2) + pow(dot(l, n2), 40.0);

    c1 *= 0.7 + 0.3 * light1;
    c2 *= 0.5 + 0.5 * light2;

    // Subtle underwater caustics effect
    float caustics = 0.15 * sin(pos.x * 3.0 + u_time * 0.7) * sin(pos.y * 4.0 - u_time * 0.5);
    c1 += caustics * vec3(0.2, 0.4, 0.5);
    c2 += caustics * vec3(0.1, 0.3, 0.2);

    // Invert both, bias toward white to avoid black
    c1 = 1.0 - c1;
    c1 = mix(c1, vec3(1.0), 0.08);
    c2 = 1.0 - c2;
    c2 = mix(c2, vec3(1.0), 0.12);

    // Blend the two membranes, with c2 "deeper" (darker, more transparent)
    float blend = smoothstep(0.18, 0.7, v2) * 0.6;
    vec3 c = mix(c1, c2, blend);

    // Add a little extra white at intersections
    float intersection = smoothstep(0., 0.0, abs(v1 - v2));
    c = mix(c, vec3(1.0), intersection * 0.25);

    return c;
}

// Self-contained portal function: shimmery, thicker, organic membrane-like portal
vec4 portal(vec2 pos, float t, float startTime) {
    if (t < startTime) return vec4(0.0); // No portal before startTime

    float elapsed = t - startTime;
    // Portal center drifts outward in a spiral
    vec2 center = vec2(0.0) + vec2(sin(elapsed * 0.5), cos(elapsed * 0.5)) * elapsed * 0.1;
    // Radius grows over time, even thicker
    float radius = elapsed * 0.5;
    // Inner radius for thicker ring effect
    float innerRadius = max(0.0, radius - 1.0); // Increased thickness to 1.0

    vec2 relPos = pos - center;
    float dist = length(relPos);

    // Add organic distortion using a simple wave-like function
    float distortion = 0.1 * sin(relPos.x * 2.0 + elapsed * 0.3) * cos(relPos.y * 2.0 - elapsed * 0.4);
    dist += distortion;

    // Portal is a thicker ring: between innerRadius and radius
    float alpha = smoothstep(innerRadius - 0.3, innerRadius, dist) * (1.0 - smoothstep(radius, radius + 0.3, dist)); // Adjusted falloff for thickness
    // Color: white center, blue edge, with shimmer
    vec3 baseColor = mix(vec3(1.0), vec3(0.2, 0.5, 1.0), smoothstep(innerRadius, radius, dist));
    // Add shimmer using noise
    float shimmer = 0.3 * sin(dist * 10.0 + elapsed * 5.0) * sin(relPos.x * 5.0 + relPos.y * 5.0 + elapsed * 3.0);
    baseColor += shimmer * vec3(0.5, 0.5, 0.5);
    baseColor = clamp(baseColor, 0.0, 1.0);

    // Membrane-like quality: modulate alpha with wave
    float waveMod = 0.5 + 0.5 * sin(dist * 3.0 + elapsed * 2.0);
    alpha *= waveMod;

    return vec4(baseColor, alpha);
}

// Self-contained mandala function: recursive structure with wavy membrane texture around central flower starting at startTime
vec4 mandala(vec2 pos, float t, float startTime) {
    if (t < startTime) return vec4(0.0); // No mandala before startTime

    float elapsed = t - startTime;
    // Mandala center
    vec2 center = vec2(0.0);

    vec2 relPos = pos - center;
    float sectors = 10.0;
    float a = atan(relPos.y, relPos.x);
    float r = length(relPos);
    // fold angle into wedge and mirror for kaleidoscope
    float wedge = TWO_PI / sectors;
    a = mod(a, wedge);
    a = abs(a - wedge * 0.5);
    // ring pattern + angular sin modulation
    float ring = 0.5 + 0.5 * sin(12.0 * r - elapsed * 0.6);
    float petals = 0.5 + 0.5 * sin(8.0 * a + r * 6.0);
    // use wave functions for texture instead of fractal noise
    float waveDetail = (wave(relPos * 2.0) + wave2(relPos * 2.0)) * 0.5;
    petals = mix(petals, waveDetail * 0.5 + 0.5, 0.3);
    // recursive structure: multiple layers with wave texture
    float mask = ring * petals;
    for (int i = 1; i < 4; i++) { // increased to 4 layers for more recursion
        float scale = 1.0 + float(i) * 0.5;
        float subR = r * scale;
        float subA = a * (1.0 + float(i) * 0.2); // vary angle for recursion
        float subRing = 0.5 + 0.5 * sin(12.0 * subR - elapsed * 0.6);
        float subPetals = 0.5 + 0.5 * sin(8.0 * subA + subR * 6.0);
        float subWave = (wave(relPos * scale * 2.0) + wave2(relPos * scale * 2.0)) * 0.5;
        subPetals = mix(subPetals, subWave * 0.5 + 0.5, 0.3);
        mask += subRing * subPetals * (0.5 / float(i + 1)); // diminish with distance
    }
    mask = mask - 0.5; // signed-ish value

    // Unraveling effect
    float unravel = smoothstep(0.0, 2.0, elapsed - r * 0.5);
    mask *= unravel;

    // Color: golden/orange with wave variation
    vec3 color = mix(vec3(1.0, 0.8, 0.4), vec3(0.8, 0.4, 0.1), petals);
    color += (wave(relPos * 3.0) + wave2(relPos * 3.0)) * 0.1 * vec3(0.2, 0.1, 0.0);
    color = clamp(color, 0.0, 1.0);
    float alpha = mask * 1.2;

    return vec4(color, alpha);
}

void main() {
    vec3 color = Oceanic_Membrane(vPos.xy);
    color = color * 0.97 + vec3(0.03, 0.03, 0.03); // keep it bright, no black

    // Add the portal at 3 seconds
    vec4 portalColor = portal(vPos.xy, u_time, 3.0);
    color = mix(color, portalColor.rgb, portalColor.a);

    // Add the central mandala at 7 seconds
    vec4 mandalaColor = mandala(vPos.xy, u_time, 7.0);
    color = mix(color, mandalaColor.rgb, mandalaColor.a);

    // Add additional wavelike mandala agents at 7 seconds, moving like wave membranes
    // Agent centers based on wave functions for movement
    vec2 agent1Center = vec2(wave(vec2(u_time * 0.5, 0.0)), wave2(vec2(0.0, u_time * 0.3))) * 0.8;
    vec2 agent2Center = vec2(wave(vec2(u_time * 0.4 + 1.0, 1.0)), wave2(vec2(1.0, u_time * 0.6 + 1.0))) * 0.8;
    vec2 agent3Center = vec2(wave(vec2(u_time * 0.3 + 2.0, 2.0)), wave2(vec2(2.0, u_time * 0.5 + 2.0))) * 0.8;

    vec4 agent1Color = mandala(vPos.xy - agent1Center, u_time, 7.0);
    vec4 agent2Color = mandala(vPos.xy - agent2Center, u_time, 7.0);
    vec4 agent3Color = mandala(vPos.xy - agent3Center, u_time, 7.0);

    // Blend agents with reduced alpha for subtlety
    color = mix(color, agent1Color.rgb, agent1Color.a * 0.7);
    color = mix(color, agent2Color.rgb, agent2Color.a * 0.7);
    color = mix(color, agent3Color.rgb, agent3Color.a * 0.7);

    fragColor = vec4(color, 1.0);
}