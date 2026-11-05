/** Column-major 4×4 matrices and small vector helpers: just what the scenes need, nothing more. */
export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export const DEG = Math.PI / 180;

export function identity(): Mat4 {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 4; r += 1) {
            let sum = 0;
            for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0);
            out[c * 4 + r] = sum;
        }
    }
    return out;
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
}

export function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const m = new Float32Array(16);
    m[0] = 2 / (right - left);
    m[5] = 2 / (top - bottom);
    m[10] = -2 / (far - near);
    m[12] = -(right + left) / (right - left);
    m[13] = -(top + bottom) / (top - bottom);
    m[14] = -(far + near) / (far - near);
    m[15] = 1;
    return m;
}

export function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(a: Vec3): Vec3 {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
    const z = normalize(sub(eye, target));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    const m = new Float32Array(16);
    m[0] = x[0];
    m[1] = y[0];
    m[2] = z[0];
    m[4] = x[1];
    m[5] = y[1];
    m[6] = z[1];
    m[8] = x[2];
    m[9] = y[2];
    m[10] = z[2];
    m[12] = -dot(x, eye);
    m[13] = -dot(y, eye);
    m[14] = -dot(z, eye);
    m[15] = 1;
    return m;
}

/** T · Rz · Ry · Rx · S, the only transform the scenes build. */
export function compose(t: Vec3, s: Vec3 = [1, 1, 1], rx = 0, ry = 0, rz = 0): Mat4 {
    const [cx, sx] = [Math.cos(rx), Math.sin(rx)];
    const [cy, sy] = [Math.cos(ry), Math.sin(ry)];
    const [cz, sz] = [Math.cos(rz), Math.sin(rz)];
    // Rotation R = Rz · Ry · Rx, columns scaled by S.
    const r00 = cz * cy;
    const r10 = sz * cy;
    const r20 = -sy;
    const r01 = cz * sy * sx - sz * cx;
    const r11 = sz * sy * sx + cz * cx;
    const r21 = cy * sx;
    const r02 = cz * sy * cx + sz * sx;
    const r12 = sz * sy * cx - cz * sx;
    const r22 = cy * cx;
    const m = new Float32Array(16);
    m[0] = r00 * s[0];
    m[1] = r10 * s[0];
    m[2] = r20 * s[0];
    m[4] = r01 * s[1];
    m[5] = r11 * s[1];
    m[6] = r21 * s[1];
    m[8] = r02 * s[2];
    m[9] = r12 * s[2];
    m[10] = r22 * s[2];
    m[12] = t[0];
    m[13] = t[1];
    m[14] = t[2];
    m[15] = 1;
    return m;
}

export function invert(m: Mat4): Mat4 | null {
    const a = Array.from(m);
    const inv = new Float32Array(16);
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a as number[] as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
    ];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det || !Number.isFinite(det)) return null;
    const d = 1 / det;
    inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d;
    inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d;
    inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d;
    inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d;
    inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d;
    inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d;
    inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d;
    inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d;
    inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return inv;
}

/** Inverse-transpose of the upper 3×3, for normals under non-uniform scale. */
export function normalMatrix(m: Mat4): Float32Array {
    const inv = invert(m) ?? identity();
    return new Float32Array([
        inv[0] ?? 0,
        inv[4] ?? 0,
        inv[8] ?? 0,
        inv[1] ?? 0,
        inv[5] ?? 0,
        inv[9] ?? 0,
        inv[2] ?? 0,
        inv[6] ?? 0,
        inv[10] ?? 0,
    ]);
}

export function transform(m: Mat4, p: Vec3, w = 1): [number, number, number, number] {
    const x = (m[0] ?? 0) * p[0] + (m[4] ?? 0) * p[1] + (m[8] ?? 0) * p[2] + (m[12] ?? 0) * w;
    const y = (m[1] ?? 0) * p[0] + (m[5] ?? 0) * p[1] + (m[9] ?? 0) * p[2] + (m[13] ?? 0) * w;
    const z = (m[2] ?? 0) * p[0] + (m[6] ?? 0) * p[1] + (m[10] ?? 0) * p[2] + (m[14] ?? 0) * w;
    const v = (m[3] ?? 0) * p[0] + (m[7] ?? 0) * p[1] + (m[11] ?? 0) * p[2] + (m[15] ?? 0) * w;
    return [x, y, z, v];
}

export function clamp(value: number, low: number, high: number): number {
    if (!Number.isFinite(value)) return low;
    return Math.min(high, Math.max(low, value));
}

export function mix(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Exponential ease toward a goal with a time constant in seconds: frame-rate independent. */
export function approach(current: number, goal: number, dt: number, seconds: number): number {
    if (!Number.isFinite(current)) return goal;
    if (!(seconds > 0)) return goal;
    return current + (goal - current) * (1 - Math.exp(-Math.max(0, dt) / seconds));
}

export function smoothstep(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

export function hexRgb(hex: string): Vec3 {
    const value = Number.parseInt(hex.slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function mixRgb(a: Vec3, b: Vec3, t: number): Vec3 {
    return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
