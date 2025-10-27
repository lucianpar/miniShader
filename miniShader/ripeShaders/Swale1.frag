#version 330 core

in vec3 vPos; // receive from vert
in vec2 vUV;

out vec4 fragColor;

uniform float u_time;

// Random function from The Book of Shaders
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Noise function (simple value noise)
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// FBM for more fluid, organic noise
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Stroke function from The Book of Shaders chapter 8
float stroke(float x, float s, float w) {
    float d = step(s, x + w * 0.5) - step(s, x - w * 0.5);
    return clamp(d, 0.0, 1.0);
}

// Function to draw a line segment
float line(vec2 uv, vec2 p1, vec2 p2, float width) {
    vec2 dir = p2 - p1;
    vec2 perp = normalize(vec2(-dir.y, dir.x));
    vec2 toPoint = uv - p1;
    float proj = dot(toPoint, normalize(dir));
    float dist = abs(dot(toPoint, perp));
    float len = length(dir);
    proj = clamp(proj, 0.0, len);
    vec2 closest = p1 + normalize(dir) * proj;
    return stroke(distance(uv, closest), 0.0, width);
}

// Function to draw a line segment with wave and noise for fluidity
float line(vec2 uv, vec2 p1, vec2 p2, float width, float seed) {
    vec2 dir = p2 - p1;
    vec2 perp = normalize(vec2(-dir.y, dir.x));
    vec2 toPoint = uv - p1;
    float proj = dot(toPoint, normalize(dir));
    float dist = abs(dot(toPoint, perp));
    float len = length(dir);
    proj = clamp(proj, 0.0, len);
    vec2 closest = p1 + normalize(dir) * proj;
    
    // Add wave and noise for fluidity
    float wave = sin(proj * 5.0 + u_time * 0.01 + seed) * 0.1 + fbm(vec2(proj * 2.0, seed)) * 0.05;
    closest += perp * wave;
    
    return stroke(distance(uv, closest), 0.0, width);
}

// Function for a drip (curved line using fbm for fluidity)
float drip(vec2 uv, vec2 start, float length, float width, float seed) {
    float t = (uv.y - start.y) / length;
    if (t < 0.0 || t > 1.0) return 0.0;
    float xOffset = fbm(vec2(t * 5.0, seed + u_time * 0.001)) * 0.3; // even slower for fluidity
    vec2 pos = vec2(start.x + xOffset, start.y + t * length);
    return stroke(distance(uv, pos), 0.0, width);
}

// Main Pollock-style function, black and white
float pollockBW(vec2 uv) {
    float intensity = 0.0; // black background
    
    // Animate very slowly and fluidly by offsetting uv over time
    uv += vec2(u_time * 0.001, u_time * 0.0005); // much slower
    
    // Generate multiple elements
    for (int i = 0; i < 150; i++) { // increased for more density and fluidity
        float seed = float(i) + u_time * 0.001; // even slower seed change
        
        // Random type: line or drip
        if (random(vec2(seed, 0.0)) > 0.5) {
            // Draw a random line
            vec2 p1 = vec2(random(vec2(seed, 1.0)), random(vec2(seed, 2.0))) * 4.0 - 2.0;
            vec2 p2 = p1 + vec2(random(vec2(seed, 3.0)) - 0.5, random(vec2(seed, 4.0)) - 0.5) * 2.0;
            float width = random(vec2(seed, 5.0)) * 0.05 + 0.01;
            intensity = max(intensity, line(uv, p1, p2, width, seed));
        } else {
            // Draw a drip
            vec2 start = vec2(random(vec2(seed, 6.0)), random(vec2(seed, 7.0))) * 4.0 - 2.0;
            float len = random(vec2(seed, 8.0)) * 1.0 + 0.5;
            float width = random(vec2(seed, 9.0)) * 0.03 + 0.005;
            intensity = max(intensity, drip(uv, start, len, width, seed));
        }
    }
    
    return intensity;
}

void main() {
    vec2 uv = vPos.xy * 2.0; // scale uv
    
    float bw = pollockBW(uv);
    
    fragColor = vec4(vec3(bw), 1.0); // black and white
}