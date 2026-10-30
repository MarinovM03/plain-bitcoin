import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

export interface CoinShape {
    radius: number;
    height: number;
    chamfer: number;
    segments: number;
}

interface ProfilePoint {
    r: number;
    y: number;
    nr: number;
    ny: number;
}

class Builder {
    readonly positions: number[] = [];
    readonly normals: number[] = [];
    readonly uvs: number[] = [];
    private readonly a = new Vector3();
    private readonly b = new Vector3();

    constructor(private readonly radius: number) {}

    get count(): number {
        return this.positions.length / 3;
    }

    triangle(points: [Vector3, Vector3, Vector3], normals: [Vector3, Vector3, Vector3]): void {
        this.a.subVectors(points[1], points[0]);
        this.b.subVectors(points[2], points[0]);
        const facing = this.a.cross(this.b).dot(normals[0]);
        const order = facing >= 0 ? [0, 1, 2] : [0, 2, 1];
        for (const i of order) {
            const p = points[i] as Vector3;
            const n = normals[i] as Vector3;
            this.positions.push(p.x, p.y, p.z);
            this.normals.push(n.x, n.y, n.z);
            this.uvs.push(0.5 + p.x / (2 * this.radius), 0.5 - p.z / (2 * this.radius));
        }
    }

    build(groups: { start: number; count: number; material: number }[]): BufferGeometry {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
        geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
        for (const group of groups) geometry.addGroup(group.start, group.count, group.material);
        geometry.computeBoundingSphere();
        return geometry;
    }
}

function at(r: number, y: number, angle: number): Vector3 {
    return new Vector3(r * Math.sin(angle), y, r * Math.cos(angle));
}

function normalAt(nr: number, ny: number, angle: number): Vector3 {
    return new Vector3(nr * Math.sin(angle), ny, nr * Math.cos(angle)).normalize();
}

function profile(shape: CoinShape): ProfilePoint[] {
    const top = shape.height / 2;
    const { radius, chamfer } = shape;
    const points: ProfilePoint[] = [];
    if (chamfer > 0) {
        points.push({ r: radius - chamfer, y: top, nr: 1, ny: 1 }, { r: radius, y: top - chamfer, nr: 1, ny: 1 });
    }
    points.push(
        { r: radius, y: chamfer > 0 ? top - chamfer : top, nr: 1, ny: 0 },
        { r: radius, y: -top, nr: 1, ny: 0 },
    );
    return points;
}

function lathe(builder: Builder, shape: CoinShape, from: number, sweep: number): number {
    const steps = Math.max(1, Math.ceil((shape.segments * sweep) / (Math.PI * 2)));
    const top = shape.height / 2;
    const face = shape.radius - shape.chamfer;
    const up = new Vector3(0, 1, 0);
    const start = builder.count;
    for (let s = 0; s < steps; s += 1) {
        const a0 = from + (sweep * s) / steps;
        const a1 = from + (sweep * (s + 1)) / steps;
        builder.triangle([new Vector3(0, top, 0), at(face, top, a0), at(face, top, a1)], [up, up, up]);
    }
    const capCount = builder.count - start;
    const edges = profile(shape);
    for (let k = 0; k + 1 < edges.length; k += 2) {
        const p0 = edges[k] as ProfilePoint;
        const p1 = edges[k + 1] as ProfilePoint;
        for (let s = 0; s < steps; s += 1) {
            const a0 = from + (sweep * s) / steps;
            const a1 = from + (sweep * (s + 1)) / steps;
            const n00 = normalAt(p0.nr, p0.ny, a0);
            const n01 = normalAt(p0.nr, p0.ny, a1);
            const n10 = normalAt(p1.nr, p1.ny, a0);
            const n11 = normalAt(p1.nr, p1.ny, a1);
            builder.triangle([at(p0.r, p0.y, a0), at(p1.r, p1.y, a0), at(p1.r, p1.y, a1)], [n00, n10, n11]);
            builder.triangle([at(p0.r, p0.y, a0), at(p1.r, p1.y, a1), at(p0.r, p0.y, a1)], [n00, n11, n01]);
        }
    }
    return capCount;
}

function cutFace(builder: Builder, shape: CoinShape, angle: number, outward: number): void {
    const top = shape.height / 2;
    const normal = new Vector3(Math.cos(angle) * outward, 0, -Math.sin(angle) * outward);
    const outline = [at(0, top, angle), ...profile(shape).map((p) => at(p.r, p.y, angle)), at(0, -top, angle)].filter(
        (p, i, all) => i === 0 || !p.equals(all[i - 1] as Vector3),
    );
    const origin = outline[0] as Vector3;
    for (let i = 1; i + 1 < outline.length; i += 1) {
        builder.triangle([origin, outline[i] as Vector3, outline[i + 1] as Vector3], [normal, normal, normal]);
    }
}

export function coinGeometry(shape: CoinShape): BufferGeometry {
    const builder = new Builder(shape.radius);
    const cap = lathe(builder, shape, 0, Math.PI * 2);
    return builder.build([
        { start: 0, count: cap, material: 0 },
        { start: cap, count: builder.count - cap, material: 1 },
    ]);
}

export function wedgeGeometry(shape: CoinShape, from: number, sweep: number): BufferGeometry {
    const builder = new Builder(shape.radius);
    const cap = lathe(builder, shape, from, sweep);
    if (sweep < Math.PI * 2 - 1e-6) {
        cutFace(builder, shape, from, -1);
        cutFace(builder, shape, from + sweep, 1);
    }
    return builder.build([
        { start: 0, count: cap, material: 0 },
        { start: cap, count: builder.count - cap, material: 1 },
    ]);
}
