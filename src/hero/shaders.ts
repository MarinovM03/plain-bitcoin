export const MAX_PLATES = 12;

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
 * Pass 1, at a low resolution (one texel per few CSS pixels): a domain-warped fbm that never stops drifting. Two warp
 * octaves move in different directions at different speeds, over a slow advection, so it never reads as a texture
 * sliding past. Near a mounted plate the field is pushed outward, so the isobars wrap around the instrument.
 * r = front field (the isobars), g = back smoke (larger, slower: depth), b = distance to the nearest plate / 256.
 */
export const FIELD_FRAGMENT = `${PRECISION}
uniform vec2 uCells;
uniform float uCell;
uniform float uTime;
uniform float uSeed;
uniform float uWarp;
uniform float uDrift;
uniform float uScroll;
uniform vec3 uLight;
uniform vec4 uPlates[${MAX_PLATES}];
uniform float uPlateCount;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
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
    vec2 cell = vec2(floor(gl_FragCoord.x), uCells.y - 1.0 - floor(gl_FragCoord.y));
    vec2 css = (cell + 0.5) * uCell;
    vec2 doc = css + vec2(0.0, uScroll);

    float nearest = 4096.0;
    vec2 normal = vec2(0.0);
    for (int i = 0; i < ${MAX_PLATES}; i++) {
        if (float(i) >= uPlateCount) break;
        vec4 plate = uPlates[i];
        vec2 extent = plate.zw * 0.5;
        vec2 rel = doc - (plate.xy + extent);
        vec2 q = abs(rel) - extent;
        vec2 outside = max(q, 0.0);
        float d = length(outside) + min(max(q.x, q.y), 0.0);
        if (d < nearest) {
            nearest = d;
            normal = length(outside) > 0.0
                ? sign(rel) * outside / length(outside)
                : (q.x > q.y ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y)));
        }
    }
    vec2 flowed = css - normal * 54.0 * exp(-max(nearest, 0.0) / 80.0);
    vec2 toLight = uLight.xy - flowed;
    flowed += toLight * 0.16 * uLight.z * exp(-dot(toLight, toLight) / 52000.0);

    float t = uTime * uDrift;
    vec2 p = (flowed + vec2(0.0, uScroll * 0.22)) / 300.0 + vec2(uSeed, uSeed * 0.61) + vec2(t, -0.42 * t);
    vec2 q = vec2(fbm(p + vec2(0.9 * t, -0.6 * t)), fbm(p + vec2(5.2 - 0.7 * t, 1.3 + 0.8 * t)));
    vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7 + 0.45 * t, 9.2)), fbm(p + uWarp * q + vec2(8.3, 2.8 - 0.38 * t)));
    float front = fbm(p + (0.8 + 0.3 * uWarp) * r);

    vec2 b = (flowed + vec2(0.0, uScroll * 0.08)) / 620.0 + vec2(3.1 - uSeed * 0.43, 7.7) + vec2(0.35 * t, 0.12 * t);
    vec2 bq = vec2(fbm(b + vec2(0.3 * t, 0.2 * t)), fbm(b + vec2(4.1, 1.9 - 0.25 * t)));
    float back = fbm(b + 1.5 * bq);

    gl_FragColor = vec4(front, back, clamp(max(nearest, 0.0) / 256.0, 0.0, 1.0), 1.0);
}`;

/**
 * Pass 2, at the internal render resolution: isobar contours of the front field, a line every band and a brighter
 * index line every fifth, over a dim back smoke. Line width comes from the field's own gradient, so lines stay
 * thin however packed they get. Plates cast a soft contact shadow. Outside a real pulse nothing here can get brighter
 * than the isobar index colour; the pulse alone carries orange, as a front sweeping out from the block meter.
 */
export const CONTOUR_FRAGMENT = `${PRECISION}
uniform sampler2D uField;
uniform vec2 uCells;
uniform float uCell;
uniform vec2 uRes;
uniform float uScale;
uniform float uBands;
uniform float uGlow;
uniform float uIntro;
uniform vec3 uPulse;
uniform vec3 uLight;
uniform vec3 uVoid;
uniform vec3 uSmoke;
uniform vec3 uLine;
uniform vec3 uIndex;
uniform vec3 uBtc;

float grain(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
}

void main() {
    vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 css = dev / uScale;
    vec2 uv = (css / uCell) / uCells;
    vec2 texel = 1.0 / uCells;
    vec4 field = texture2D(uField, uv);
    float east = texture2D(uField, uv + vec2(texel.x, 0.0)).r - texture2D(uField, uv - vec2(texel.x, 0.0)).r;
    float south = texture2D(uField, uv + vec2(0.0, texel.y)).r - texture2D(uField, uv - vec2(0.0, texel.y)).r;
    float slope = length(vec2(east, south)) / (2.0 * uCell) * uBands;

    float v = field.r * uBands;
    float band = floor(v + 0.5);
    float index = 1.0 - step(0.5, mod(band, 5.0));
    float px = abs(fract(v + 0.5) - 0.5) / max(slope, 0.0008);
    float width = mix(0.7, 1.15, index);
    float soft = 0.8 / uScale;
    float line = 1.0 - smoothstep(width - soft, width + soft, px);

    float smoke = smoothstep(0.38, 0.86, field.g);
    vec3 color = mix(uVoid, uSmoke, smoke * 0.95);

    float pulse = 0.0;
    if (uPulse.z >= 0.0) {
        float reach = uPulse.z * length(uRes / uScale) * 1.2;
        float d = distance(css, uPulse.xy) - reach;
        pulse = exp(-(d * d) / 9800.0) * (1.0 - uPulse.z * uPulse.z);
    }
    vec2 toLight = css - uLight.xy;
    float light = uLight.z * exp(-dot(toLight, toLight) / 40000.0);

    vec3 ink = mix(uLine, uIndex, index);
    float strength = line * (0.62 + 0.38 * uGlow) * uIntro * (1.0 + 0.3 * light);
    color = mix(color, ink, clamp(strength, 0.0, 1.0));
    color = mix(color, uBtc, clamp(pulse * (0.18 + 0.82 * line), 0.0, 1.0));

    float plate = field.b * 256.0;
    color *= 1.0 - 0.62 * exp(-plate / 22.0);

    color += (grain(floor(dev)) - 0.5) * 0.006;
    gl_FragColor = vec4(color, 1.0);
}`;
