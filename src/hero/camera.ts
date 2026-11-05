import { invert, lookAt, type Mat4, multiply, ortho, perspective, transform, type Vec3 } from './gfx/math.ts';
import type { Bounds } from './gfx/mesh.ts';
import type { Orbit } from './orbit.ts';
import type { CameraSpec, Item, View } from './scenes/types.ts';

export interface Camera {
    viewProj: Mat4;
    inverse: Mat4;
    eye: Vec3;
    /** Direction toward the camera, for ortho lighting. */
    toward: Vec3;
}

function corners(box: Bounds): Vec3[] {
    const out: Vec3[] = [];
    for (const x of [box.min[0], box.max[0]])
        for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) out.push([x, y, z]);
    return out;
}

function direction(yaw: number, pitch: number): Vec3 {
    return [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
}

function safeAspect(view: View): number {
    const aspect = view.width / view.height;
    return Number.isFinite(aspect) && aspect > 0 ? Math.min(8, Math.max(0.125, aspect)) : 1;
}

/** Smallest distance at which the fit box lies inside ±fill of the frame, at the home pose: the honest reading. */
export function fitDistance(spec: CameraSpec, aspect: number): number {
    const dir = direction(spec.yaw, spec.pitch);
    const points = corners(spec.fit);
    const fits = (distance: number) => {
        const eye: Vec3 = [
            spec.target[0] + dir[0] * distance,
            spec.target[1] + dir[1] * distance,
            spec.target[2] + dir[2] * distance,
        ];
        const viewProj = multiply(
            perspective(spec.fov, aspect, distance * 0.02, distance * 6),
            lookAt(eye, spec.target),
        );
        return points.every((p) => {
            const [x, y, , w] = transform(viewProj, p);
            return w > 0 && Math.abs(x / w) <= spec.fill && Math.abs(y / w) <= spec.fill;
        });
    };
    let low = 0.01;
    let high = 1;
    while (!fits(high) && high < 1e6) high *= 2;
    for (let k = 0; k < 28; k += 1) {
        const mid = (low + high) / 2;
        if (fits(mid)) high = mid;
        else low = mid;
    }
    return high;
}

/** Ortho half extents that fit the box at the home pose. */
export function fitOrtho(spec: CameraSpec, aspect: number): { halfW: number; halfH: number } {
    const view = lookAt(direction(spec.yaw, spec.pitch), [0, 0, 0]);
    let maxX = 1e-6;
    let maxY = 1e-6;
    for (const p of corners(spec.fit)) {
        const [x, y] = transform(view, [p[0] - spec.target[0], p[1] - spec.target[1], p[2] - spec.target[2]]);
        maxX = Math.max(maxX, Math.abs(x));
        maxY = Math.max(maxY, Math.abs(y));
    }
    const halfH = Math.max(maxY, maxX / aspect) / spec.fill;
    return { halfW: halfH * aspect, halfH };
}

export function cameraFor(spec: CameraSpec, orbit: Orbit, view: View): Camera {
    const aspect = safeAspect(view);
    const yaw = spec.yaw + orbit.yaw;
    const pitch = spec.pitch + orbit.pitch;
    const dir = direction(yaw, pitch);
    let projection: Mat4;
    let distance: number;
    if (spec.kind === 'ortho') {
        const { halfW, halfH } = fitOrtho(spec, aspect);
        distance = Math.max(halfW, halfH) * 4;
        projection = ortho(-halfW, halfW, -halfH, halfH, 0.01, distance * 2);
    } else {
        distance = fitDistance(spec, aspect);
        projection = perspective(spec.fov, aspect, distance * 0.02, distance * 6);
    }
    const eye: Vec3 = [
        spec.target[0] + dir[0] * distance,
        spec.target[1] + dir[1] * distance,
        spec.target[2] + dir[2] * distance,
    ];
    const viewProj = multiply(projection, lookAt(eye, spec.target));
    return { viewProj, inverse: invert(viewProj) ?? viewProj, eye, toward: dir };
}

function unproject(camera: Camera, x: number, y: number, z: number): Vec3 {
    const [a, b, c, w] = transform(camera.inverse, [x, y, z]);
    return [a / w, b / w, c / w];
}

/** Ray against an axis-aligned box in the item's own space; distance along the ray, or null. */
function hitBox(origin: Vec3, dir: Vec3, box: Bounds): number | null {
    let near = -Infinity;
    let far = Infinity;
    for (let a = 0; a < 3; a += 1) {
        const o = origin[a] ?? 0;
        const d = dir[a] ?? 0;
        const lo = box.min[a] ?? 0;
        const hi = box.max[a] ?? 0;
        if (Math.abs(d) < 1e-12) {
            if (o < lo || o > hi) return null;
            continue;
        }
        let t0 = (lo - o) / d;
        let t1 = (hi - o) / d;
        if (t0 > t1) [t0, t1] = [t1, t0];
        near = Math.max(near, t0);
        far = Math.min(far, t1);
        if (near > far) return null;
    }
    return far < 0 ? null : Math.max(0, near);
}

/** The nearest part under scene NDC x, y, or null. World-space distance decides which part is in front. */
export function pickPart(camera: Camera, items: readonly Item[], ndcX: number, ndcY: number): string | null {
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
    const from = unproject(camera, ndcX, ndcY, -1);
    const to = unproject(camera, ndcX, ndcY, 1);
    let best: { part: string; t: number } | null = null;
    for (const item of items) {
        if (!item.part || item.inert) continue;
        const inverse = invert(item.model);
        if (!inverse) continue;
        const [ox, oy, oz] = transform(inverse, from);
        const [tx, ty, tz] = transform(inverse, to);
        const t = hitBox([ox, oy, oz], [tx - ox, ty - oy, tz - oz], item.mesh.bounds);
        if (t === null) continue;
        // Same parameter along the same world segment for every item, so t compares across items.
        if (!best || t < best.t) best = { part: item.part, t };
    }
    return best?.part ?? null;
}

/** Scene-local CSS px of a world point, or null when it is behind the camera. */
export function projectPoint(camera: Camera, p: Vec3, view: View): [number, number] | null {
    const [x, y, , w] = transform(camera.viewProj, p);
    if (!(w > 0)) return null;
    return [((x / w + 1) / 2) * view.width, ((1 - y / w) / 2) * view.height];
}

/** A part's screen box and the centre of its projected area, in scene-local CSS px: x, y, width, height, cx, cy. */
export type Rect = [number, number, number, number, number, number];

type Point = [number, number];

/** Convex hull of projected points (monotone chain). A box's silhouette is exactly the hull of its corners. */
export function hull(points: readonly Point[]): Point[] {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3) return sorted;
    const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Point[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2] as Point, lower[lower.length - 1] as Point, p) <= 0)
            lower.pop();
        lower.push(p);
    }
    const upper: Point[] = [];
    for (const p of [...sorted].reverse()) {
        while (upper.length >= 2 && cross(upper[upper.length - 2] as Point, upper[upper.length - 1] as Point, p) <= 0)
            upper.pop();
        upper.push(p);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area and area centroid of a simple polygon. */
export function centroid(polygon: readonly Point[]): { area: number; x: number; y: number } {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < polygon.length; i += 1) {
        const [x0, y0] = polygon[i] as Point;
        const [x1, y1] = polygon[(i + 1) % polygon.length] as Point;
        const f = x0 * y1 - x1 * y0;
        area += f;
        cx += (x0 + x1) * f;
        cy += (y0 + y1) * f;
    }
    if (Math.abs(area) < 1e-9) {
        const n = Math.max(1, polygon.length);
        return { area: 0, x: polygon.reduce((s, p) => s + p[0], 0) / n, y: polygon.reduce((s, p) => s + p[1], 0) / n };
    }
    return { area: Math.abs(area) / 2, x: cx / (3 * area), y: cy / (3 * area) };
}

/** Each part's screen box and visible centre in scene-local CSS px, from its items' projected silhouettes. */
export function partRects(camera: Camera, items: readonly Item[], view: View): Record<string, Rect> {
    const parts = new Map<string, { box: [number, number, number, number]; area: number; x: number; y: number }>();
    for (const item of items) {
        if (!item.part || item.inert) continue;
        const points: Point[] = [];
        for (const corner of corners(item.mesh.bounds)) {
            const [wx, wy, wz] = transform(item.model, corner);
            const at = projectPoint(camera, [wx, wy, wz], view);
            if (at) points.push(at);
        }
        if (points.length === 0) continue;
        const shape = centroid(hull(points));
        const weight = Math.max(shape.area, 1e-6);
        const entry = parts.get(item.part) ?? { box: [Infinity, Infinity, -Infinity, -Infinity], area: 0, x: 0, y: 0 };
        for (const [x, y] of points) {
            entry.box = [
                Math.min(entry.box[0], x),
                Math.min(entry.box[1], y),
                Math.max(entry.box[2], x),
                Math.max(entry.box[3], y),
            ];
        }
        entry.x += shape.x * weight;
        entry.y += shape.y * weight;
        entry.area += weight;
        parts.set(item.part, entry);
    }
    const out: Record<string, Rect> = {};
    for (const [part, { box, area, x, y }] of parts)
        out[part] = [box[0], box[1], box[2] - box[0], box[3] - box[1], x / area, y / area];
    return out;
}
