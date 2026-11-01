export const FULLSCREEN_VERTEX = `
attribute vec2 aCorner;
varying vec2 vUv;
void main() {
    vUv = aCorner * 0.5 + 0.5;
    gl_Position = vec4(aCorner, 0.0, 1.0);
}`;

export const WEATHER_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uView;
uniform float uScale;
uniform float uCell;
uniform float uFlow;
uniform float uSeed;
uniform float uTension;
uniform float uIntro;
uniform vec3 uPulse;
uniform vec3 uLight;
uniform vec4 uCalm;
uniform vec3 uInk;
uniform vec3 uDot;
uniform vec3 uFiat;
uniform vec3 uBtc;

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
    for (int i = 0; i < 3; i++) {
        value += amplitude * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        amplitude *= 0.5;
    }
    return value;
}

float field(vec2 p) {
    float warp = 1.6 + 2.4 * uTension;
    vec2 q = vec2(fbm(p + vec2(uSeed, uFlow * 0.05)), fbm(p + vec2(5.2 - uFlow * 0.04, 1.3 + uSeed)));
    vec2 r = vec2(fbm(p + warp * q + vec2(1.7, 9.2) + uFlow * 0.03), fbm(p + warp * q + vec2(8.3, 2.8)));
    return fbm(p + (1.2 + 1.8 * uTension) * r);
}

void main() {
    vec2 css = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
    vec2 cell = floor(css / uCell);
    vec2 center = (cell + 0.5) * uCell;
    float v = smoothstep(0.26 - 0.12 * uTension, 0.78, field(center / 240.0));

    float ring = 0.0;
    if (uPulse.z >= 0.0) {
        float front = uPulse.z * length(uView) * 1.15;
        float d = distance(center, uPulse.xy) - front;
        ring = exp(-(d * d) / 3600.0) * (1.0 - uPulse.z);
    }
    vec2 toLight = center - uLight.xy;
    float light = uLight.z * exp(-dot(toLight, toLight) / 28900.0);
    vec2 edge = abs(center - (uCalm.xy + uCalm.zw * 0.5)) - uCalm.zw * 0.5;
    float inside = 1.0 - smoothstep(-28.0, 28.0, max(edge.x, edge.y));

    float size = clamp((v * (1.0 - 0.35 * inside) + ring * 0.7 + light * 0.4) * uIntro, 0.0, 1.0);
    float radius = size * 0.46 * uCell;
    float aa = 0.8 / uScale;
    float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, distance(css, center));
    vec3 tint = mix(uFiat, uDot, 0.35 + 0.5 * v);
    vec3 color = mix(tint, uBtc, clamp(ring * 1.4 + light * 0.6, 0.0, 1.0));
    float alpha = dotMask * clamp(0.14 + 0.5 * v + 0.7 * ring + 0.3 * light, 0.0, 1.0);
    float lift = 1.0 - css.y / uView.y;
    vec3 base = uInk + vec3(0.010, 0.016, 0.028) * lift * lift;
    gl_FragColor = vec4(mix(base, color, alpha), 1.0);
}`;

export const BLIT_FRAGMENT = `
precision mediump float;
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
    gl_FragColor = texture2D(uTexture, vUv);
}`;

export const POINTS_VERTEX = `
attribute vec4 aPath;
attribute vec2 aRadius;
attribute vec4 aFrom;
attribute vec4 aTo;
attribute float aSeed;
attribute float aWave;
uniform vec2 uView;
uniform vec4 uPlot;
uniform float uScale;
uniform float uMorph;
uniform float uScatter;
uniform float uAlpha;
varying vec4 vColor;
varying float vRadius;
varying float vSize;

void main() {
    float t = clamp((uMorph - aSeed * 0.45) / 0.55, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    vec2 p = mix(aPath.xy, aPath.zw, e) + vec2(sin(aSeed * 91.7), cos(aSeed * 47.3)) * sin(3.14159265 * e) * uScatter * aWave;
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
