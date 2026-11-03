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
 * Pass 1, one texel per halftone cell: a domain-warped fbm that never stops drifting. Two warp octaves move in
 * different directions at different speeds, so it never reads as a texture scrolling past.
 * r = front field, g = back field (larger and slower: depth), b = the warp itself (for a faint tint shift).
 */
export const FIELD_FRAGMENT = `${PRECISION}
uniform vec2 uCells;
uniform float uCell;
uniform float uTime;
uniform float uSeed;
uniform float uWarp;
uniform float uDrift;
uniform float uScroll;

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
    float t = uTime * uDrift;

    vec2 p = (css + vec2(0.0, uScroll * 0.18)) / 250.0 + vec2(uSeed, uSeed * 0.61);
    vec2 q = vec2(fbm(p + vec2(t, -0.6 * t)), fbm(p + vec2(5.2 - 0.7 * t, 1.3 + 0.9 * t)));
    vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7 + 0.45 * t, 9.2)), fbm(p + uWarp * q + vec2(8.3, 2.8 - 0.38 * t)));
    float front = fbm(p + (0.9 + 0.35 * uWarp) * r);

    vec2 b = (css + vec2(0.0, uScroll * 0.07)) / 560.0 + vec2(3.1 - uSeed * 0.43, 7.7);
    vec2 bq = vec2(fbm(b + vec2(0.35 * t, 0.2 * t)), fbm(b + vec2(4.1, 1.9 - 0.3 * t)));
    float back = fbm(b + 1.6 * bq);

    gl_FragColor = vec4(front, back, r.x, 1.0);
}`;

/**
 * Pass 2, at the canvas's own resolution: crisp dots on cells snapped to device pixels, so nothing shimmers as the
 * field drifts. A larger, dimmer back layer sits behind the front one, offset by half a cell, for print depth.
 */
export const HALFTONE_FRAGMENT = `${PRECISION}
uniform sampler2D uField;
uniform vec2 uCells;
uniform float uCellDev;
uniform vec2 uRes;
uniform float uScale;
uniform float uDensity;
uniform float uContrast;
uniform float uWarmth;
uniform float uIntro;
uniform vec3 uPulse;
uniform vec3 uLight;
uniform vec4 uCalm;
uniform vec3 uInk;
uniform vec3 uDot;
uniform vec3 uFiat;
uniform vec3 uBtc;

float grain(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
}

vec4 sampleAt(vec2 cell) {
    return texture2D(uField, (cell + 0.5) / uCells);
}

float disc(vec2 dev, vec2 centre, float radius) {
    float d = distance(dev, centre);
    return (1.0 - smoothstep(radius - 0.75, radius + 0.75, d)) * clamp(radius / 0.9, 0.0, 1.0);
}

float calmAt(vec2 css) {
    vec2 edge = abs(css - (uCalm.xy + uCalm.zw * 0.5)) - uCalm.zw * 0.5;
    return 1.0 - smoothstep(-28.0, 28.0, max(edge.x, edge.y));
}

void main() {
    vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 cssPx = dev / uScale;

    float lift = 1.0 - cssPx.y * uScale / uRes.y;
    vec3 color = uInk + vec3(0.010, 0.016, 0.028) * lift * lift + (grain(floor(dev)) - 0.5) * 0.012;

    // Back layer: twice the cell, half a cell over, sampled between front texels.
    float backDev = uCellDev * 2.0;
    vec2 backCell = floor((dev + uCellDev) / backDev);
    vec2 backCentre = (backCell + 0.5) * backDev - uCellDev;
    float back = texture2D(uField, (backCentre / uCellDev) / uCells).g;
    float backSize = smoothstep(0.5, 0.86, back) * uIntro;
    float backMask = disc(dev, backCentre, backSize * 0.4 * backDev);
    vec3 backInk = mix(uInk, uFiat, 0.38);
    color = mix(color, backInk, backMask * (0.06 + 0.1 * backSize) * (1.0 - 0.6 * calmAt(backCentre / uScale)));

    // Front layer.
    vec2 cell = floor(dev / uCellDev);
    vec2 centreDev = (cell + 0.5) * uCellDev;
    vec2 centre = centreDev / uScale;
    vec4 field = sampleAt(cell);
    // Density sets where dots begin: calm leaves wide dark gaps, a long wait fills them in.
    float low = 0.56 - 0.42 * uDensity;
    float v = smoothstep(low, low + 0.32, field.r);
    v = pow(v, mix(1.5, 0.9, uContrast));

    float ring = 0.0;
    if (uPulse.z >= 0.0) {
        float front = uPulse.z * length(uRes / uScale) * 1.15;
        float d = distance(centre, uPulse.xy) - front;
        ring = exp(-(d * d) / 3600.0) * (1.0 - uPulse.z);
    }
    vec2 toLight = centre - uLight.xy;
    float light = uLight.z * exp(-dot(toLight, toLight) / 28900.0);
    float inside = calmAt(centre);

    float size = clamp((v * (1.0 - 0.55 * inside) + ring * 0.7 + light * 0.35) * uIntro, 0.0, 1.0);
    float mask = disc(dev, centreDev, size * 0.46 * uCellDev);
    vec3 cool = mix(uFiat, uDot, 0.3 + 0.35 * v);
    vec3 tint = mix(cool, uDot, uWarmth * (0.55 + 0.3 * field.b));
    vec3 ink = mix(tint, uBtc, clamp(ring * 1.4 + light * 0.5, 0.0, 1.0));
    float alpha = mask * clamp(0.09 + (0.21 + 0.18 * uContrast) * v + 0.7 * ring + 0.3 * light, 0.0, 1.0) * (1.0 - 0.55 * inside);
    gl_FragColor = vec4(mix(color, ink, alpha), 1.0);
}`;

export const POINTS_VERTEX = `
attribute vec4 aPath;
attribute vec2 aRadius;
attribute vec4 aFrom;
attribute vec4 aTo;
attribute vec3 aSeed;
uniform vec2 uView;
uniform vec4 uPlot;
uniform float uScale;
uniform float uMorph;
uniform float uScatter;
uniform float uAlpha;
uniform float uStagger;
varying vec4 vColor;
varying float vRadius;
varying float vSize;

void main() {
    float t = clamp((uMorph - aSeed.z * uStagger) / (1.0 - uStagger), 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    vec2 p = mix(aPath.xy, aPath.zw, e) + vec2(sin(aSeed.x * 91.7), cos(aSeed.x * 47.3)) * sin(3.14159265 * e) * uScatter * aSeed.y;
    vec2 css = uPlot.xy + p * uPlot.w;
    gl_Position = vec4(css.x / uView.x * 2.0 - 1.0, 1.0 - css.y / uView.y * 2.0, 0.0, 1.0);
    vRadius = mix(aRadius.x, aRadius.y, e) * uPlot.w * uScale;
    vSize = vRadius * 2.0 + 2.0;
    gl_PointSize = vRadius > 0.0 ? vSize : 0.0;
    vColor = mix(aFrom, aTo, e);
    vColor.a *= uAlpha;
}`;

export const POINTS_FRAGMENT = `
precision mediump float;
varying vec4 vColor;
varying float vRadius;
varying float vSize;
void main() {
    float d = length(gl_PointCoord - 0.5) * vSize;
    float a = 1.0 - smoothstep(vRadius - 0.6, vRadius + 0.6, d);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;
