import type { Vec3 } from './math.ts';

/** Interleaved vertex layout: position xyz, normal xyz, cell index (or -1). */
export const STRIDE = 7;

export interface Bounds {
    min: Vec3;
    max: Vec3;
}

/**
 * A procedural mesh: geometry built in code once, uploaded once. A dynamic mesh bumps `version` when its data is
 * rewritten in place, and the renderer re-uploads only then.
 */
export interface Mesh {
    readonly id: number;
    data: Float32Array;
    indices: Uint16Array;
    bounds: Bounds;
    version: number;
}

let nextId = 1;

export class MeshBuilder {
    readonly v: number[] = [];
    readonly i: number[] = [];

    vertex(p: Vec3, n: Vec3, cell = -1): number {
        this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], cell);
        return this.v.length / STRIDE - 1;
    }

    quad(a: number, b: number, c: number, d: number): void {
        this.i.push(a, b, c, a, c, d);
    }

    /** An axis-aligned box from its centre and size, flat-shaded. */
    box(c: Vec3, size: Vec3): void {
        const half: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2];
        for (const face of FACES) {
            const corner = (s: number, t: number): Vec3 => [
                c[0] + (face.n[0] + face.u[0] * s + face.v[0] * t) * half[0],
                c[1] + (face.n[1] + face.u[1] * s + face.v[1] * t) * half[1],
                c[2] + (face.n[2] + face.u[2] * s + face.v[2] * t) * half[2],
            ];
            const a = this.vertex(corner(-1, -1), face.n);
            this.vertex(corner(1, -1), face.n);
            this.vertex(corner(1, 1), face.n);
            this.vertex(corner(-1, 1), face.n);
            this.quad(a, a + 1, a + 2, a + 3);
        }
    }

    /**
     * A flat ribbon through points in the xy plane: `thickness` across the line, from z0 to z1 in depth. With a dash
     * length, it is cut into dashes and gaps of that length along the line.
     */
    ribbon(points: readonly (readonly [number, number])[], thickness: number, z0: number, z1: number, dash = 0): void {
        // Dashes are cut by distance along the line, so a steep stretch gets the same rhythm as a flat one.
        let travelled = 0;
        for (let k = 0; k + 1 < points.length; k += 1) {
            const [ax, ay] = points[k] ?? [0, 0];
            const [bx, by] = points[k + 1] ?? [0, 0];
            const length = Math.hypot(bx - ax, by - ay);
            if (!(length > 1e-6)) continue;
            const pieces: [number, number][] = [];
            if (dash <= 0) {
                pieces.push([0, 1]);
            } else {
                let at = 0;
                while (at < length) {
                    const phase = (travelled + at) % (dash * 2);
                    const on = phase < dash;
                    const next = Math.min(length, at + (on ? dash - phase : dash * 2 - phase));
                    if (on) pieces.push([at / length, next / length]);
                    at = next;
                }
            }
            travelled += length;
            const nx = (-(by - ay) / length) * (thickness / 2);
            const ny = ((bx - ax) / length) * (thickness / 2);
            const up: Vec3 = [nx / (thickness / 2), ny / (thickness / 2), 0];
            const front: Vec3 = [0, 0, 1];
            for (const [t0, t1] of pieces) {
                const sx = ax + (bx - ax) * t0;
                const sy = ay + (by - ay) * t0;
                const ex = ax + (bx - ax) * t1;
                const ey = ay + (by - ay) * t1;
                const f = this.vertex([sx - nx, sy - ny, z1], front);
                this.vertex([ex - nx, ey - ny, z1], front);
                this.vertex([ex + nx, ey + ny, z1], front);
                this.vertex([sx + nx, sy + ny, z1], front);
                this.quad(f, f + 1, f + 2, f + 3);
                const t = this.vertex([sx + nx, sy + ny, z1], up);
                this.vertex([ex + nx, ey + ny, z1], up);
                this.vertex([ex + nx, ey + ny, z0], up);
                this.vertex([sx + nx, sy + ny, z0], up);
                this.quad(t, t + 1, t + 2, t + 3);
            }
        }
    }

    build(): Mesh {
        const mesh: Mesh = {
            id: nextId++,
            data: new Float32Array(0),
            indices: new Uint16Array(0),
            bounds: boundsOf(new Float32Array(0)),
            version: 0,
        };
        return this.into(mesh);
    }

    /** Rewrites an existing mesh with this geometry; the renderer re-uploads it on the next draw. */
    into(mesh: Mesh): Mesh {
        if (this.v.length / STRIDE > 65_535) throw new RangeError('Mesh too large for 16-bit indices');
        mesh.data = new Float32Array(this.v);
        mesh.indices = new Uint16Array(this.i);
        mesh.bounds = boundsOf(mesh.data);
        mesh.version += 1;
        return mesh;
    }
}

export function boundsOf(data: Float32Array): Bounds {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < data.length; k += STRIDE) {
        for (let a = 0; a < 3; a += 1) {
            const value = data[k + a] ?? 0;
            if (value < (min[a] ?? 0)) min[a] = value;
            if (value > (max[a] ?? 0)) max[a] = value;
        }
    }
    if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
    return { min, max };
}

const FACES: readonly { n: Vec3; u: Vec3; v: Vec3 }[] = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

/**
 * A box with softly rounded edges, centred on the origin: a subdivided cube whose every vertex is pulled onto the
 * rounded hull. The rounding catches the key light along each edge, which is most of what makes it read as an object.
 */
export function roundedBox(w: number, h: number, d: number, radius: number, segments = 3): Mesh {
    const b = new MeshBuilder();
    const half: Vec3 = [w / 2, h / 2, d / 2];
    const r = Math.max(0, Math.min(radius, ...half));
    const inner: Vec3 = [half[0] - r, half[1] - r, half[2] - r];
    const n = Math.max(1, segments * 2);
    for (const face of FACES) {
        const start = b.v.length / STRIDE;
        for (let y = 0; y <= n; y += 1) {
            for (let x = 0; x <= n; x += 1) {
                const s = (x / n) * 2 - 1;
                const t = (y / n) * 2 - 1;
                const cube: Vec3 = [
                    face.n[0] + face.u[0] * s + face.v[0] * t,
                    face.n[1] + face.u[1] * s + face.v[1] * t,
                    face.n[2] + face.u[2] * s + face.v[2] * t,
                ];
                const p: Vec3 = [cube[0] * half[0], cube[1] * half[1], cube[2] * half[2]];
                const core: Vec3 = [
                    Math.max(-inner[0], Math.min(inner[0], p[0])),
                    Math.max(-inner[1], Math.min(inner[1], p[1])),
                    Math.max(-inner[2], Math.min(inner[2], p[2])),
                ];
                const off: Vec3 = [p[0] - core[0], p[1] - core[1], p[2] - core[2]];
                const length = Math.hypot(...off);
                const normal: Vec3 = length > 1e-9 ? [off[0] / length, off[1] / length, off[2] / length] : face.n;
                b.vertex(
                    r > 0 && length > 1e-9
                        ? [core[0] + normal[0] * r, core[1] + normal[1] * r, core[2] + normal[2] * r]
                        : p,
                    r > 0 ? normal : face.n,
                );
            }
        }
        for (let y = 0; y < n; y += 1) {
            for (let x = 0; x < n; x += 1) {
                const a = start + y * (n + 1) + x;
                b.quad(a, a + 1, a + n + 2, a + n + 1);
            }
        }
    }
    return b.build();
}

/**
 * A surface of revolution around the y axis from a profile of [radius, y] points, bottom to top. Each profile segment
 * gets its own normals, so a step in the profile stays a crisp edge.
 */
export function lathe(profile: readonly (readonly [number, number])[], segments = 40): Mesh {
    const b = new MeshBuilder();
    for (let k = 0; k + 1 < profile.length; k += 1) {
        const [r0, y0] = profile[k] ?? [0, 0];
        const [r1, y1] = profile[k + 1] ?? [0, 0];
        const dr = r1 - r0;
        const dy = y1 - y0;
        const length = Math.hypot(dr, dy) || 1;
        // Outward normal of the segment in the profile plane.
        const nr = dy / length;
        const ny = -dr / length;
        const start = b.v.length / STRIDE;
        for (let s = 0; s <= segments; s += 1) {
            const angle = (s / segments) * Math.PI * 2;
            const c = Math.cos(angle);
            const sn = Math.sin(angle);
            b.vertex([r0 * c, y0, r0 * sn], [nr * c, ny, nr * sn]);
            b.vertex([r1 * c, y1, r1 * sn], [nr * c, ny, nr * sn]);
        }
        for (let s = 0; s < segments; s += 1) {
            const a = start + s * 2;
            b.quad(a, a + 2, a + 3, a + 1);
        }
    }
    return b.build();
}

/** A solid cylinder of radius r and height h, centred on the origin, with a small bevel on both rims. */
export function cylinder(r: number, h: number, segments = 40, bevel = Math.min(r, h) * 0.12): Mesh {
    const y = h / 2;
    const e = Math.max(0, Math.min(bevel, r * 0.5, y * 0.9));
    return lathe(
        [
            [0, -y],
            [r - e, -y],
            [r, -y + e],
            [r, y - e],
            [r - e, y],
            [0, y],
        ],
        segments,
    );
}

/** A torus around the y axis: ring radius R, tube radius r. */
export function torus(R: number, r: number, segments = 48, tube = 14): Mesh {
    const b = new MeshBuilder();
    for (let s = 0; s <= segments; s += 1) {
        const u = (s / segments) * Math.PI * 2;
        for (let t = 0; t <= tube; t += 1) {
            const v = (t / tube) * Math.PI * 2;
            const normal: Vec3 = [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
            b.vertex(
                [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)],
                normal,
            );
        }
    }
    for (let s = 0; s < segments; s += 1) {
        for (let t = 0; t < tube; t += 1) {
            const a = s * (tube + 1) + t;
            b.quad(a, a + tube + 1, a + tube + 2, a + 1);
        }
    }
    return b.build();
}

export interface GridSpec {
    /** Cells along x, y (layers) and z. */
    nx: number;
    ny: number;
    nz: number;
    /** Distance between cell centres and the solid size of a cell. */
    pitch: number;
    size: number;
}

/** Index of a cell in fill order: along x, then back from the front row, then up a layer, the way you fill a box. */
export function cellIndex(spec: GridSpec, x: number, y: number, z: number): number {
    return y * spec.nx * spec.nz + z * spec.nx + x;
}

/**
 * Every cell of a grid as one mesh. Each vertex carries its cell's fill-order index, so one draw call shows any
 * count of filled cells (a uniform), and cells past a count can be hidden, with no geometry rebuilt.
 */
export function cellGrid(spec: GridSpec): Mesh {
    const b = new MeshBuilder();
    const half = spec.size / 2;
    const origin: Vec3 = [(-(spec.nx - 1) * spec.pitch) / 2, 0, (-(spec.nz - 1) * spec.pitch) / 2];
    for (let y = 0; y < spec.ny; y += 1) {
        for (let z = 0; z < spec.nz; z += 1) {
            for (let x = 0; x < spec.nx; x += 1) {
                const cell = cellIndex(spec, x, y, z);
                // Row 0 is the front row (+z), so the first cells filled are the ones facing the viewer.
                const c: Vec3 = [origin[0] + x * spec.pitch, half + y * spec.pitch, -(origin[2] + z * spec.pitch)];
                for (const face of FACES) {
                    const corner = (s: number, t: number): Vec3 => [
                        c[0] + (face.n[0] + face.u[0] * s + face.v[0] * t) * half,
                        c[1] + (face.n[1] + face.u[1] * s + face.v[1] * t) * half,
                        c[2] + (face.n[2] + face.u[2] * s + face.v[2] * t) * half,
                    ];
                    const a = b.vertex(corner(-1, -1), face.n, cell);
                    b.vertex(corner(1, -1), face.n, cell);
                    b.vertex(corner(1, 1), face.n, cell);
                    b.vertex(corner(-1, 1), face.n, cell);
                    b.quad(a, a + 1, a + 2, a + 3);
                }
            }
        }
    }
    return b.build();
}
