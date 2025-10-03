#version 330 core

in vec3 vPos;
out vec4 fragColor;

uniform float u_time;

// placeholders (replace with real uniforms when needed)
const vec2 RES = vec2(800.0, 600.0);
const vec2 MOUSE = vec2(0.0);

// Raymarch settings
#define MIN_DIST 0.001
#define MAX_DIST 12.0
#define MAX_STEPS 96
#define STEP_MULT 0.5
#define NORMAL_OFFS 0.002

// Scene settings
#define QUADS_PER_UNIT 8.0
#define GRID_LINE_RADIUS 2.0

// Derived
#define QUAD_SIZE (1.0/QUADS_PER_UNIT)

float pi = 3.14159265359;
float tau = 6.28318530718;

struct MarchResult {
    vec3 position;
    vec3 normal;
    float dist;
    float steps;
};

// Procedural height (static, no spinning)
float Height(vec2 p) {
    p *= QUAD_SIZE;
    float base = 0.25 * (sin(length(p) * 2.0) * 0.5 + 0.5);
    float detail = 0.15 * sin(p.x * 3.0 + p.y * 1.7);
    float jitter = 0.05 * sin(dot(p, vec2(12.9898,78.233)));
    float h = base * 0.5 + detail + jitter;
    return h;
}

mat3 Rotate(vec3 angles) {
    vec3 c = cos(angles);
    vec3 s = sin(angles);
    mat3 rotX = mat3( 1.0, 0.0, 0.0,
                      0.0, c.x, s.x,
                      0.0,-s.x, c.x);
    mat3 rotY = mat3( c.y, 0.0,-s.y,
                      0.0, 1.0, 0.0,
                      s.y, 0.0, c.y);
    mat3 rotZ = mat3( c.z, s.z, 0.0,
                     -s.z, c.z, 0.0,
                      0.0, 0.0, 1.0);
    return rotX * rotY * rotZ;
}

// SDF helpers
float opU(float d1, float d2) { return min(d1,d2); }
float opS(float d1, float d2) { return max(-d1, d2); }
float sdSphere(vec3 p, float s) { return length(p) - s; }
float sdPlane(vec3 p, vec3 p0, vec3 p1, vec3 p2) {
    return dot(p - p0, normalize(cross(p0 - p1, p0 - p2)));
}

float sdVQuad(vec3 p, float h0, float h1, float h2, float h3) {
    float s = QUAD_SIZE;
    float diag = sdPlane(p, vec3(0,0,0), vec3(s,s,0), vec3(0,0,s));
    float tri0 = sdPlane(p, vec3(0,0,-h0), vec3(0,s,-h1), vec3(s,s,-h2));
    tri0 = opS(-diag, tri0);
    float tri1 = sdPlane(p, vec3(0,0,-h0), vec3(s,s,-h2), vec3(s,0,-h3));
    tri1 = opS(diag, tri1);
    return min(tri0, tri1);
}

float Scene(vec3 p) {
    float d = MAX_DIST;
    vec3 pm = vec3(mod(p.xy, vec2(QUAD_SIZE)), p.z);
    vec2 uv = floor(p.xy / QUAD_SIZE);
    float v0 = Height(uv + vec2(0,0));
    float v1 = Height(uv + vec2(0,1));
    float v2 = Height(uv + vec2(1,1));
    float v3 = Height(uv + vec2(1,0));
    d = sdVQuad(pm - vec3(0.0,0.0,0.0), v0, v1, v2, v3);
    d = opU(d, -sdSphere(p, MAX_DIST - 1.0));
    return d;
}

vec3 Normal(vec3 p) {
    vec3 off = vec3(NORMAL_OFFS, 0, 0);
    return normalize(vec3(
        Scene(p + off.xyz) - Scene(p - off.xyz),
        Scene(p + off.zxy) - Scene(p - off.zxy),
        Scene(p + off.yzx) - Scene(p - off.yzx)
    ));
}

MarchResult MarchRay(vec3 orig, vec3 dir) {
    float steps = 0.0;
    float dist = 0.0;
    for(int i = 0; i < MAX_STEPS; ++i) {
        float sceneDist = Scene(orig + dir * dist);
        dist += sceneDist * STEP_MULT;
        steps += 1.0;
        if (abs(sceneDist) < MIN_DIST) break;
        if (dist > MAX_DIST) break;
    }
    MarchResult result;
    result.position = orig + dir * dist;
    result.normal = Normal(result.position);
    result.dist = dist;
    result.steps = steps;
    return result;
}

// Black & white mesh shade (no color, no spin)
vec3 ShadeBW(MarchResult hit, vec3 direction) {
    // triangle grid pattern (sharp BW lines)
    vec2 gridRep = mod(hit.position.xy, vec2(QUAD_SIZE)) / QUAD_SIZE - vec2(0.5);
    float grid = 0.5 - max(abs(gridRep.x), abs(gridRep.y));
    grid = min(grid, abs(dot(gridRep.xy, normalize(vec2(-1.0,1.0)))));
    float lineSize = GRID_LINE_RADIUS * hit.dist / RES.y / QUAD_SIZE;

    // create crisp line mask
    float lineMask = 1.0 - smoothstep(lineSize * 0.7, lineSize, grid);

    // use normal to add slight shading to non-line areas
    float nl = clamp(dot(hit.normal, vec3(0.0,0.0,1.0)) * 0.5 + 0.5, 0.0, 1.0);
    float base = mix(0.07, 0.35, nl); // base grey for faces

    // final: lines are white, faces are dark grey
    vec3 col = mix(vec3(base), vec3(1.0), lineMask);

    return col;
}

void main() {
    // derive uv from vPos (correct, stable mapping)
    vec2 uv = (vPos.xy * 0.5) + 0.5;
    uv = clamp(uv, vec2(0.0), vec2(1.0));
    vec2 fragCoord = uv * RES;

    vec2 res = RES.xy / RES.y;
    vec2 uvn = fragCoord.xy / RES.y;

    // static camera (no spin)
    vec3 angles = vec3(0.0);
    angles.y = tau * (1.5 / 8.0); // fixed yaw
    angles.x = 0.0;               // no pitch animation
    mat3 rotate = Rotate(angles.yzx);

    vec3 orig = vec3(0.0, 0.0, -2.0) * rotate;
    orig -= vec3(0.0, 0.0, 1.0);

    vec3 dir = normalize(vec3(uvn - res / 2.0, 0.5)) * rotate;

    MarchResult hit = MarchRay(orig, dir);
    vec3 color = ShadeBW(hit, dir);

    fragColor = vec4(color, 1.0);
}