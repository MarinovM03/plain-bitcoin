export const MAX_PLATES = 16;
export const MAX_SHADOWS = 6;
/** CSS px per field unit: the size of one soft mass of the background. */
export const FIELD_PX = 420;

export const FULLSCREEN_VERTEX = `
attribute vec2 aCorner;
void main() {
    gl_Position = vec4(aCorner, 0.0, 1.0);
}`;

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/**
 * Background pass 1, at a low internal resolution (one texel per few CSS px): a soft domain-warped fbm. Two warp
 * octaves travel in different directions at different speeds over a slow advection, so the field breathes and never
 * reads as a texture sliding past or a loop. Continuous tone only: no lines, contours, dots or cells come out of it.
 * r = density, g = which cool family the mass leans to (ink blue or teal).
 *
 * Rows are written top-down in CSS space (row 0 of the texture is the bottom of the screen) and pass 2 reads them
 * back the same way, so a point on the field and the pixel showing it can never be mirrored.
 */
export const FIELD_FRAGMENT = `${PRECISION}
uniform vec2 uCells;
uniform float uCell;
uniform float uTime;
uniform float uSeed;
uniform float uWarp;
uniform float uDrift;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 css = vec2(gl_FragCoord.x, uCells.y - gl_FragCoord.y) * uCell;
    float t = uTime * uDrift;
    vec2 p = css / ${FIELD_PX.toFixed(1)} + vec2(uSeed, uSeed * 0.61) + vec2(t, -0.35 * t);
    vec2 q = vec2(fbm(p + vec2(0.7 * t, -0.5 * t)), fbm(p + vec2(5.2 - 0.6 * t, 1.3 + 0.7 * t)));
    vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7 + 0.4 * t, 9.2)), fbm(p + uWarp * q + vec2(8.3, 2.8 - 0.33 * t)));
    float density = fbm(p + uWarp * r);
    float family = fbm(p * 0.5 + vec2(3.1 - 0.2 * t, 7.7 + 0.15 * t));
    gl_FragColor = vec4(density, family, 0.0, 1.0);
}`;

/**
 * Background pass 2, at the canvas resolution: the field upscaled smoothly and toned into the cool family, between
 * the deep ground and the brightest crest token. Every colour here is a blend of weather tokens, so outside a real
 * block pulse nothing can be brighter than the crest. Plates are filled with the exact plate colour (so a frame of
 * scroll lag can never show weather inside one) and cast a soft shadow onto the field around them. The pulse alone
 * carries orange: a soft bloom rolling out from the status line's block number.
 */
export const COMPOSITE_FRAGMENT = `${PRECISION}
uniform sampler2D uField;
uniform vec2 uCells;
uniform float uCell;
uniform vec2 uRes;
uniform float uScale;
uniform float uContrast;
uniform float uIntro;
uniform vec3 uPulse;
uniform vec4 uPlates[${MAX_PLATES}];
uniform float uPlateCount;
uniform vec3 uVoid;
uniform vec3 uDeep;
uniform vec3 uMass;
uniform vec3 uTeal;
uniform vec3 uCrest;
uniform vec3 uPlate;
uniform vec3 uBtc;

float grain(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
}

void main() {
    vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 css = dev / uScale;

    float nearest = 4096.0;
    for (int i = 0; i < ${MAX_PLATES}; i++) {
        if (float(i) >= uPlateCount) break;
        vec4 plate = uPlates[i];
        vec2 extent = plate.zw * 0.5;
        vec2 q = abs(css - (plate.xy + extent)) - extent + 8.0;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 8.0;
        nearest = min(nearest, d);
    }
    if (nearest <= 0.0) {
        gl_FragColor = vec4(uPlate, 1.0);
        return;
    }

    vec2 uv = vec2(css.x / (uCell * uCells.x), 1.0 - css.y / (uCell * uCells.y));
    vec4 field = texture2D(uField, uv);
    float d = field.r;
    vec3 mass = mix(uMass, uTeal, smoothstep(0.35, 0.7, field.g));
    vec3 color = mix(uVoid, uDeep, smoothstep(0.18, 0.5, d));
    color = mix(color, mass, smoothstep(0.42, 0.72, d) * uContrast);
    color = mix(color, uCrest, smoothstep(0.6, 0.86, d) * uContrast * 0.9);
    color = mix(uVoid, color, uIntro);

    if (uPulse.z >= 0.0) {
        float reach = uPulse.z * length(uRes / uScale) * 1.1;
        float ring = distance(css, uPulse.xy) - reach;
        float bloom = exp(-(ring * ring) / 16200.0) * (1.0 - uPulse.z) * (1.0 - uPulse.z);
        color = mix(color, uBtc, clamp(bloom * (0.3 + 0.4 * d), 0.0, 1.0));
    }

    color *= 1.0 - 0.55 * exp(-nearest / 18.0);
    color += (grain(floor(dev)) - 0.5) * 0.004;
    gl_FragColor = vec4(max(color, 0.0), 1.0);
}`;

export const SOLID_VERTEX = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute float aCell;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat3 uNormalM;
uniform float uFill;
uniform float uVisible;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFilled;
void main() {
    vFilled = (aCell >= 0.0 && aCell < uFill) ? 1.0 : 0.0;
    vec3 p = aCell >= uVisible ? vec3(0.0) : aPos;
    vec4 world = uModel * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = uNormalM * aNormal;
    gl_Position = uViewProj * world;
}`;

/**
 * Solid parts: a cool sky and dark ground hemisphere, one warm key light, a soft rim and a little specular on the
 * rounded edges, with a baked ambient occlusion that darkens toward the ground. Matte and calm, so the object reads
 * as a made thing rather than a render. A hovered part lifts evenly in light, warmed toward orange.
 */
export const SOLID_FRAGMENT = `${PRECISION}
uniform vec3 uColor;
uniform vec3 uFillColor;
uniform vec3 uEye;
uniform vec3 uKey;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uBtc;
uniform float uGroundY;
uniform float uLift;
uniform float uGlow;
uniform float uOrtho;
uniform vec3 uToward;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFilled;
void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 base = mix(uColor, uFillColor, vFilled);
    vec3 v = uOrtho > 0.5 ? uToward : normalize(uEye - vWorld);
    vec3 ambient = mix(uGround, uSky, 0.5 + 0.5 * n.y);
    float key = max(dot(n, uKey), 0.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 h = normalize(uKey + v);
    float spec = pow(max(dot(n, h), 0.0), 48.0) * 0.22;
    float ao = mix(0.62, 1.0, smoothstep(0.0, 0.45, vWorld.y - uGroundY));
    // A raised light floor keeps every face in its own ink: a shadowed orange stays orange, never brown.
    vec3 light = vec3(0.4) + ambient * 0.42 + key * 0.5;
    vec3 color = base * light * ao + spec + rim * 0.1 * uSky;
    color += base * uGlow * 0.35;
    color += uLift * (base * 0.26 + uBtc * 0.1 + uBtc * rim * 0.3);
    gl_FragColor = vec4(color, 1.0);
}`;

/**
 * The table the object stands on: a pool of the well colour fading into the plate, so the scene's edges meet the
 * plate with no seam, darkened under each object by a baked soft contact shadow.
 */
export const GROUND_FRAGMENT = `${PRECISION}
uniform vec3 uWell;
uniform vec3 uPlate;
uniform vec4 uPool;
uniform vec4 uShadows[${MAX_SHADOWS}];
uniform float uShadowK[${MAX_SHADOWS}];
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFilled;
void main() {
    float r = length(vWorld.xz - uPool.xy) / uPool.z;
    vec3 color = mix(uWell, uPlate, smoothstep(0.25, 1.0, r));
    float shade = 0.0;
    for (int i = 0; i < ${MAX_SHADOWS}; i++) {
        vec2 q = (vWorld.xz - uShadows[i].xy) / max(uShadows[i].zw, vec2(0.0001));
        shade = max(shade, uShadowK[i] * exp(-dot(q, q) * 2.4));
    }
    gl_FragColor = vec4(color * (1.0 - 0.7 * shade), 1.0);
}`;
