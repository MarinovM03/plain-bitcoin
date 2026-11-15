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
    /** Slides the whole picture on the screen, in normalised device units: x to the right, y up. */
    shift: { x: number; y: number };
}

const FOV_Y = (32 * Math.PI) / 180;
const EYE_DIRECTION: Vec3 = normalize([-0.52, 0.24, 1]);
const DISTANCE = 6.3;
const WIDE_ASPECT = 1.3;
/** The idle camera sways by at most this many scene units each way, and never moves what it looks at. */
export const DRIFT = { x: 0.2, y: 0.07 } as const;

/** The same camera a breath later: the eye sways slowly so the picture is never frozen. */
export function withDrift(camera: Camera, seconds: number): Camera {
    const t = Number.isFinite(seconds) ? seconds : 0;
    const { eye } = camera;
    return {
        ...camera,
        eye: [eye[0] + Math.sin(t * 0.13) * DRIFT.x, eye[1] + Math.sin(t * 0.09 + 1.1) * DRIFT.y, eye[2]],
    };
}

const WIDE_SCREEN = 1.25;
const HOME_FOCUS = 2.6;
/** The home shot stands at least this far back, so the whole chain clears the tools. */
const HOME_STEP_BACK = 1.45;

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value));
}

function reachOut(from: Vec3, direction: Vec3, distance: number): Vec3 {
    return [from[0] + direction[0] * distance, from[1] + direction[1] * distance, from[2] + direction[2] * distance];
}

/**
 * The one place the camera stands: the wide shot of the chain. Wide screens slide the picture to the right, clear
 * of the headline; narrow screens step back so the same run of tablets stays in frame.
 */
export function homeCamera(aspect: number): Camera {
    const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const far = clamp(WIDE_ASPECT / safe, 1, 2.4);
    const target: Vec3 = [CHAIN_DIRECTION[0] * HOME_FOCUS, 0.3, CHAIN_DIRECTION[2] * HOME_FOCUS];
    return {
        eye: reachOut(target, EYE_DIRECTION, DISTANCE * Math.max(far, HOME_STEP_BACK)),
        target,
        fovY: FOV_Y,
        aspect: safe,
        shift: safe >= WIDE_SCREEN ? { x: 0.3, y: 0.12 } : { x: 0, y: 0.22 },
    };
}

/** Where the camera starts on a first visit: low and close to the block being found, before it pulls back. */
export function arrivalCamera(aspect: number): Camera {
    const home = homeCamera(aspect);
    const target: Vec3 = [0.4, 0.35, -0.3];
    const near = clamp(0.95 / home.aspect, 1, 1.9);
    return { ...home, eye: reachOut(target, normalize([-0.9, 0.12, 1]), 3 * near), target };
}

export function mixCamera(from: Camera, to: Camera, share: number): Camera {
    const t = clamp(share, 0, 1);
    const blend = (a: number, b: number) => a + (b - a) * t;
    const blend3 = (a: Vec3, b: Vec3): Vec3 => [blend(a[0], b[0]), blend(a[1], b[1]), blend(a[2], b[2])];
    return {
        eye: blend3(from.eye, to.eye),
        target: blend3(from.target, to.target),
        fovY: blend(from.fovY, to.fovY),
        aspect: to.aspect,
        shift: { x: blend(from.shift.x, to.shift.x), y: blend(from.shift.y, to.shift.y) },
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
