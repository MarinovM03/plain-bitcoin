export type Vec3 = readonly [number, number, number];

/** Column-major 4 x 4, the layout a shader uniform takes. */
export type Mat4 = Float32Array;

function normalize([x, y, z]: Vec3): Vec3 {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The chain runs back and to the right from the forming block at the origin. */
export const CHAIN_DIRECTION: Vec3 = normalize([1, 0, -0.8]);

/** Every tablet is turned a little towards the camera, in radians about the vertical axis. */
export const SLAB_YAW = -0.36;

/** The forming block has no real size yet, so it stands at a middling one. */
export const FORMING = { side: 0.86, thick: 0.18 } as const;

export interface Camera {
    eye: Vec3;
    target: Vec3;
    fovY: number;
    aspect: number;
}

const FOV_Y = (32 * Math.PI) / 180;
const EYE_DIRECTION: Vec3 = normalize([-0.52, 0.24, 1]);
const DISTANCE = 6.3;
const WIDE_ASPECT = 1.3;
/** How far along the chain the camera looks. */
const FOCUS = 2.2;

/**
 * Where the camera stands for a canvas of this shape. A narrow canvas steps back so the same run of tablets stays
 * in frame; the pointer shifts the eye by at most `PARALLAX` scene units and never the target.
 */
export const PARALLAX = { x: 0.55, y: 0.22 } as const;

export function cameraFor(aspect: number, pointer: { x: number; y: number } = { x: 0, y: 0 }): Camera {
    const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const distance = DISTANCE * Math.min(2.4, Math.max(1, WIDE_ASPECT / safe));
    const px = Number.isFinite(pointer.x) ? Math.min(1, Math.max(-1, pointer.x)) : 0;
    const py = Number.isFinite(pointer.y) ? Math.min(1, Math.max(-1, pointer.y)) : 0;
    const target: Vec3 = [CHAIN_DIRECTION[0] * FOCUS, 0.3, CHAIN_DIRECTION[2] * FOCUS];
    return {
        eye: [
            target[0] + EYE_DIRECTION[0] * distance + px * PARALLAX.x,
            target[1] + EYE_DIRECTION[1] * distance + py * PARALLAX.y,
            target[2] + EYE_DIRECTION[2] * distance,
        ],
        target,
        fovY: FOV_Y,
        aspect: safe,
    };
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < 4; row += 1) {
            let sum = 0;
            for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
            out[column * 4 + row] = sum;
        }
    }
    return out;
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
}

export function lookAt(eye: Vec3, target: Vec3): Mat4 {
    const forward = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    const right = normalize(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const out = new Float32Array(16);
    out.set([right[0], up[0], -forward[0], 0, right[1], up[1], -forward[1], 0, right[2], up[2], -forward[2], 0]);
    out[12] = -dot(right, eye);
    out[13] = -dot(up, eye);
    out[14] = dot(forward, eye);
    out[15] = 1;
    return out;
}

export function viewProjection(camera: Camera): Mat4 {
    return multiply(perspective(camera.fovY, camera.aspect, 0.1, 60), lookAt(camera.eye, camera.target));
}

/** A world point in normalised device coordinates; `w` is its distance along the view, positive in front. */
export function project(matrix: Mat4, [x, y, z]: Vec3): { x: number; y: number; w: number } {
    const at = (row: number) =>
        (matrix[row] ?? 0) * x + (matrix[4 + row] ?? 0) * y + (matrix[8 + row] ?? 0) * z + (matrix[12 + row] ?? 0);
    const w = at(3);
    return { x: at(0) / w, y: at(1) / w, w };
}

/** The point on the floor under the middle of a tablet standing `offset` back along the chain. */
export function slabBase(offset: number): Vec3 {
    return [CHAIN_DIRECTION[0] * offset, 0, CHAIN_DIRECTION[2] * offset];
}

/** A point given in a tablet's own frame (x across the face, y up, z out of the face) in world space. */
export function slabPoint(base: Vec3, [x, y, z]: Vec3): Vec3 {
    const cos = Math.cos(SLAB_YAW);
    const sin = Math.sin(SLAB_YAW);
    return [base[0] + x * cos + z * sin, base[1] + y, base[2] - x * sin + z * cos];
}
