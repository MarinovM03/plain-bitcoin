export const MAX_BOXES = 10;

const COMMON = /* glsl */ `#version 300 es
precision highp float;

uniform vec3 uEye;
uniform vec3 uInk;
uniform vec2 uViewport;
uniform vec2 uYaw;
uniform vec3 uKey;
uniform vec3 uKeySlab;
uniform float uFogStart;
uniform int uBoxCount;
uniform vec3 uBoxCentre[${MAX_BOXES}];
uniform vec3 uBoxHalf[${MAX_BOXES}];
uniform float uBoxPresence[${MAX_BOXES}];

const vec3 KEY_COLOUR = vec3(1.0, 0.86, 0.68) * 3.1;
const vec3 FILL_COLOUR = vec3(0.34, 0.48, 0.74) * 0.42;
const vec3 FILL = vec3(0.874, 0.243, 0.42);
const vec3 SKY = vec3(0.085, 0.105, 0.145);
const vec3 GROUND = vec3(0.07, 0.05, 0.036);

// World to the frame every tablet shares: x across the face, y up, z out of the face.
vec3 toSlab(vec3 p) {
    return vec3(p.x * uYaw.x - p.z * uYaw.y, p.y, p.x * uYaw.y + p.z * uYaw.x);
}

// How much key light reaches a point, past every tablet except its own. The edge softens with distance.
float keyLight(vec3 slabPoint, int self) {
    float lit = 1.0;
    vec3 inverse = 1.0 / uKeySlab;
    for (int i = 0; i < ${MAX_BOXES}; i++) {
        if (i >= uBoxCount) break;
        if (i == self) continue;
        vec3 t0 = (uBoxCentre[i] - uBoxHalf[i] - slabPoint) * inverse;
        vec3 t1 = (uBoxCentre[i] + uBoxHalf[i] - slabPoint) * inverse;
        vec3 lo = min(t0, t1);
        vec3 hi = max(t0, t1);
        float enter = max(max(lo.x, lo.y), lo.z);
        float leave = min(min(hi.x, hi.y), hi.z);
        float inside = leave - max(enter, 0.0);
        float soft = 0.05 + 0.1 * max(enter, 0.0);
        lit = min(lit, 1.0 - smoothstep(0.0, soft, inside) * uBoxPresence[i]);
    }
    return lit;
}

float fogAt(vec3 world) {
    float beyond = max(distance(uEye, world) - uFogStart, 0.0);
    return 1.0 - exp(-pow(beyond * 0.12, 1.5));
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Smooth value noise, 0 to 1: the grain in a stone and the unevenness of a floor.
float grain(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float dither() {
    vec2 p = gl_FragCoord.xy;
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5;
}

// Linear light to the screen: a soft shoulder, then gamma.
vec3 encode(vec3 colour) {
    return pow(1.0 - exp(-colour * 1.3), vec3(1.0 / 2.2));
}

// The canvas melts into the page: every pass lands on the page colour at the frame's edge.
vec3 finish(vec3 encoded, float fog) {
    vec2 uv = gl_FragCoord.xy / uViewport;
    float frame = smoothstep(0.0, 0.1, uv.x) * smoothstep(0.0, 0.1, 1.0 - uv.x)
        * smoothstep(0.0, 0.07, uv.y) * smoothstep(0.0, 0.1, 1.0 - uv.y);
    float keep = (1.0 - fog) * frame;
    return mix(uInk, encoded + dither() / 255.0, keep);
}
`;

export const SLAB_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uViewProjection;
uniform vec3 uBase;
uniform vec3 uSize;
uniform vec2 uYaw;
uniform float uMirror;

out vec3 vLocal;
out vec3 vFace;
out vec3 vNormal;
out vec3 vWorld;

void main() {
    vec3 local = aPosition * uSize;
    vec3 turned = vec3(local.x * uYaw.x + local.z * uYaw.y, local.y, -local.x * uYaw.y + local.z * uYaw.x);
    vec3 world = uBase + turned;
    vLocal = aPosition;
    vFace = aNormal;
    vNormal = vec3(aNormal.x * uYaw.x + aNormal.z * uYaw.y, aNormal.y, -aNormal.x * uYaw.y + aNormal.z * uYaw.x);
    vWorld = world;
    gl_Position = uViewProjection * vec4(world.x, world.y * uMirror, world.z, 1.0);
}
`;

export const SLAB_FRAGMENT = /* glsl */ `${COMMON}
uniform sampler2D uBits;
uniform vec3 uSize;
uniform vec3 uBody;
uniform vec3 uInlay;
uniform float uSeed;
uniform float uCut;
uniform float uInlayGloss;
uniform float uPresence;
uniform float uFlash;
uniform float uMirror;
uniform int uSelf;

in vec3 vLocal;
in vec3 vFace;
in vec3 vNormal;
in vec3 vWorld;

out vec4 outColour;

const float MARGIN = 0.085;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 albedo = uBody;
    float gloss = 0.22;
    float occlusion = 1.0;

    if (vFace.z > 0.5 && uCut > 0.5) {
        vec2 grid = (vec2(vLocal.x + 0.5, vLocal.y) - MARGIN) / (1.0 - 2.0 * MARGIN);
        if (grid.x > 0.0 && grid.x < 1.0 && grid.y > 0.0 && grid.y < 1.0) {
            vec2 cells = grid * 16.0;
            vec2 cell = floor(cells);
            vec2 f = fract(cells) - 0.5;
            float bit = texelFetch(uBits, ivec2(int(cell.x), 15 - int(cell.y)), 0).r;
            float average = texture(uBits, vec2(grid.x, 1.0 - grid.y)).r;
            // Cells per pixel: past about one, single cells cannot be drawn, so the face eases to their average.
            float density = max(fwidth(cells.x), fwidth(cells.y));
            float sharp = clamp(1.7 - density * 1.9, 0.0, 1.0);
            float d = max(abs(f.x), abs(f.y));
            float edge = density * 0.75 + 0.012;
            float pit = bit * smoothstep(0.4 + edge, 0.4 - edge, d);
            float wall = bit * smoothstep(0.31, 0.38, d) * smoothstep(0.45, 0.4, d) * sharp;
            vec2 outward = abs(f.x) > abs(f.y) ? vec2(sign(f.x), 0.0) : vec2(0.0, sign(f.y));
            vec3 across = vec3(uYaw.x, 0.0, -uYaw.y);
            normal = normalize(normal - (across * outward.x + vec3(0.0, outward.y, 0.0)) * wall * 1.5);
            float cut = mix(average * 0.62, pit, sharp);
            albedo = mix(uBody, uInlay, cut);
            gloss = mix(gloss, uInlayGloss, cut);
            occlusion = 1.0 - 0.3 * pit * sharp * smoothstep(0.16, 0.4, d);
        }
    }

    // Where on this face, in scene units, and how near its rim: stone grain, and an edge that catches the light.
    vec3 centred = vec3(vLocal.x, vLocal.y - 0.5, vLocal.z);
    vec3 reach = (0.5 - abs(centred)) * uSize;
    vec3 face = abs(vFace);
    vec2 onFace = face.x > 0.5 ? centred.zy * uSize.zy : face.y > 0.5 ? centred.xz * uSize.xz : centred.xy * uSize.xy;
    float rim = face.x > 0.5 ? min(reach.y, reach.z) : face.y > 0.5 ? min(reach.x, reach.z) : min(reach.x, reach.y);
    float mottle = grain(onFace * 5.0 + uSeed) * 0.6 + grain(onFace * 23.0 + uSeed) * 0.4;
    albedo *= 0.86 + 0.26 * mottle;
    float chamfer = 1.0 - smoothstep(0.0, 0.022, rim);

    vec3 view = normalize(uEye - vWorld);
    float shadow = keyLight(toSlab(vWorld) + toSlab(normalize(vNormal)) * 0.012, uSelf);
    float facing = max(dot(normal, uKey), 0.0);
    vec3 halfway = normalize(uKey + view);
    float shine = pow(max(dot(normal, halfway), 0.0), mix(14.0, 90.0, gloss)) * gloss * 1.6;
    float grounded = mix(0.35, 1.0, smoothstep(0.0, 0.3, vWorld.y));
    vec3 ambient = mix(GROUND, SKY, normal.y * 0.5 + 0.5) * grounded * occlusion;
    vec3 colour = albedo * (ambient + KEY_COLOUR * facing * shadow);
    colour += albedo * FILL_COLOUR * max(dot(normal, FILL), 0.0);
    colour += KEY_COLOUR * shine * shadow * mix(vec3(0.06), albedo, 0.5);
    colour += albedo * KEY_COLOUR * chamfer * 0.22 * (0.25 + 0.75 * shadow);
    colour += SKY * pow(1.0 - max(dot(normal, view), 0.0), 4.0) * 0.7;
    colour += vec3(1.0, 0.6, 0.22) * uFlash * 0.55;

    float fog = fogAt(vWorld);
    float presence = uPresence;
    // A reflection keeps only what stands near the floor.
    if (uMirror < 0.0) presence *= exp(-vWorld.y * 2.0) * 0.7;
    outColour = vec4(finish(encode(colour), 1.0 - (1.0 - fog) * presence), 1.0);
}
`;

export const FLOOR_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;
uniform mat4 uViewProjection;
out vec3 vWorld;

void main() {
    vWorld = vec3(aCorner.x, 0.0, aCorner.y);
    gl_Position = uViewProjection * vec4(vWorld, 1.0);
}
`;

export const FLOOR_FRAGMENT = /* glsl */ `${COMMON}
uniform vec2 uPool;

in vec3 vWorld;
out vec4 outColour;

void main() {
    vec3 view = normalize(uEye - vWorld);
    vec3 slabPoint = toSlab(vWorld);
    float shadow = keyLight(slabPoint, -1);

    // Where a tablet meets the floor the light cannot reach under it.
    float contact = 1.0;
    for (int i = 0; i < ${MAX_BOXES}; i++) {
        if (i >= uBoxCount) break;
        float resting = 1.0 - smoothstep(0.02, 0.3, uBoxCentre[i].y - uBoxHalf[i].y);
        vec2 q = abs(slabPoint.xz - uBoxCentre[i].xz) - uBoxHalf[i].xz;
        float away = length(max(q, 0.0));
        contact *= 1.0 - (1.0 - smoothstep(0.0, 0.34, away)) * 0.62 * uBoxPresence[i] * resting;
    }

    // One pool of light on a dark floor: it falls away by itself, long before the frame's edge.
    float reach = distance(vWorld.xz, uPool);
    float pool = exp(-reach * reach / 6.5);
    float uneven = grain(vWorld.xz * 1.7) * 0.6 + grain(vWorld.xz * 9.0) * 0.4;
    vec3 albedo = vec3(0.013, 0.014, 0.017) * (0.8 + 0.4 * uneven);
    vec3 colour = albedo * (SKY * 0.2 + KEY_COLOUR * uKey.y * pool * shadow) * contact;
    vec3 halfway = normalize(uKey + view);
    colour += KEY_COLOUR * pow(max(halfway.y, 0.0), 90.0) * 0.035 * pool * shadow;

    // The floor exists only where the pool lights it; past that it is the page itself, so no box shows on any screen.
    float lit = smoothstep(0.02, 0.4, pool);
    float fog = 1.0 - (1.0 - fogAt(vWorld)) * lit;
    float glance = pow(1.0 - max(view.y, 0.0), 2.5);
    float mirror = (0.06 + 0.7 * glance) * (0.85 + 0.15 * uneven) * (1.0 - fog);
    outColour = vec4(finish(encode(colour), fog), 1.0 - clamp(mirror, 0.0, 0.62));
}
`;

export const GHOST_FRAGMENT = /* glsl */ `${COMMON}
uniform vec3 uSize;
uniform float uGhost;

in vec3 vLocal;
in vec3 vFace;
in vec3 vNormal;
in vec3 vWorld;

out vec4 outColour;

void main() {
    vec3 p = vec3(vLocal.x, vLocal.y - 0.5, vLocal.z);
    vec3 reach = (0.5 - abs(p)) * uSize;
    vec3 face = abs(vFace);
    // Distance to the nearest edge of this face, in scene units.
    float edge = face.x > 0.5 ? min(reach.y, reach.z) : face.y > 0.5 ? min(reach.x, reach.z) : min(reach.x, reach.y);
    float width = fwidth(edge) * 1.25 + 0.004;
    float line = 1.0 - smoothstep(0.0, width, edge);
    float glow = exp(-edge * 16.0) * 0.22;
    float alpha = (line * 0.85 + glow + 0.035) * uGhost;
    vec3 colour = mix(vec3(0.97, 0.58, 0.1), vec3(1.0, 0.86, 0.66), line);
    vec2 uv = gl_FragCoord.xy / uViewport;
    float frame = smoothstep(0.0, 0.1, uv.x) * smoothstep(0.0, 0.1, 1.0 - uv.x)
        * smoothstep(0.0, 0.07, uv.y) * smoothstep(0.0, 0.1, 1.0 - uv.y);
    outColour = vec4(colour, alpha * frame * (1.0 - fogAt(vWorld)));
}
`;

export const MOTE_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aSeed;

uniform mat4 uViewProjection;
uniform vec3 uSize;
uniform vec2 uYaw;
uniform float uTime;
uniform float uFill;
uniform float uPixels;

out float vSettled;
out float vAlpha;

void main() {
    float pick = aSeed.x;
    vec2 q = aSeed.yz - 0.5;
    vec3 onBlock;
    if (pick < 0.46) onBlock = vec3(q.x, q.y + 0.5, 0.5);
    else if (pick < 0.8) onBlock = vec3(q.x, q.y + 0.5, -0.5);
    else if (pick < 0.88) onBlock = vec3(q.x, 1.0, q.y);
    else if (pick < 0.94) onBlock = vec3(-0.5, q.x + 0.5, q.y);
    else onBlock = vec3(0.5, q.x + 0.5, q.y);
    onBlock *= uSize;

    // Loose motes keep close: a slow ring of dust around the block, thinning with distance from it.
    float turn = aSeed.y * 6.2831853 + uTime * (0.05 + aSeed.w * 0.12);
    float far = aSeed.z * aSeed.z;
    float radius = 0.32 + far * 0.95;
    float height = 0.05 + fract(aSeed.x * 13.7) * 1.05 + sin(uTime * 0.31 + aSeed.w * 40.0) * 0.05;
    vec3 adrift = vec3(cos(turn) * radius, height, sin(turn) * radius * 0.6);

    float settled = smoothstep(0.0, 1.0, clamp((uFill - aSeed.w) / 0.07, 0.0, 1.0));
    vec3 local = mix(adrift, onBlock, settled);
    vec3 world = vec3(local.x * uYaw.x + local.z * uYaw.y, local.y, -local.x * uYaw.y + local.z * uYaw.x);
    gl_Position = uViewProjection * vec4(world, 1.0);
    float size = mix(0.0075, 0.0052, settled) * (0.6 + fract(aSeed.x * 91.7));
    gl_PointSize = max(1.0, uPixels * size / gl_Position.w);
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.6 + aSeed.z) + aSeed.w * 90.0);
    vSettled = settled;
    vAlpha = mix(0.4 * (1.0 - far * 0.7), 0.95, settled) * twinkle;
}
`;

export const MOTE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uViewport;
uniform float uGhost;

in float vSettled;
in float vAlpha;
out vec4 outColour;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.12, d);
    vec2 uv = gl_FragCoord.xy / uViewport;
    float frame = smoothstep(0.0, 0.1, uv.x) * smoothstep(0.0, 0.1, 1.0 - uv.x)
        * smoothstep(0.0, 0.07, uv.y) * smoothstep(0.0, 0.1, 1.0 - uv.y);
    vec3 colour = mix(vec3(0.97, 0.58, 0.1), vec3(1.0, 0.8, 0.52), vSettled);
    outColour = vec4(colour, disc * vAlpha * uGhost * frame);
}
`;
