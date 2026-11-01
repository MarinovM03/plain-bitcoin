import { type Layout, MAX_POINTS } from './scenes/types.ts';

export const MORPH_SECONDS = 1.3;
export const STAGGER = 0.45;
export const STRIDE = 16;
const ENTRY = 0.45;

export type Rgba = readonly [number, number, number, number];

export interface Points {
    readonly data: Float32Array;
    count: number;
}

export function seedOf(i: number): number {
    const x = Math.sin((i + 1) * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

export function scatterDirection(seed: number): [number, number] {
    return [Math.sin(seed * 91.7), Math.cos(seed * 47.3)];
}

export function eased(progress: number, seed: number): number {
    const t = Math.min(1, Math.max(0, (progress - seed * STAGGER) / (1 - STAGGER)));
    return t * t * (3 - 2 * t);
}

export function createPoints(): Points {
    const data = new Float32Array(MAX_POINTS * STRIDE);
    for (let i = 0; i < MAX_POINTS; i += 1) data[i * STRIDE + 14] = seedOf(i);
    return { data, count: 0 };
}

export function retarget(
    points: Points,
    layout: Layout | null,
    progress: number,
    scatter: number,
    colors: readonly Rgba[],
    rebuild: boolean,
): void {
    const { data } = points;
    const target = Math.min(MAX_POINTS, layout?.count ?? 0);
    let count = 0;
    for (let i = 0; i < MAX_POINTS; i += 1) {
        const o = i * STRIDE;
        const seed = data[o + 14] ?? 0;
        const e = eased(progress, seed);
        const wave = Math.sin(Math.PI * e) * scatter * (data[o + 15] ?? 0);
        const [dx, dy] = scatterDirection(seed);
        const mix = (from: number, to: number) => (data[o + from] ?? 0) * (1 - e) + (data[o + to] ?? 0) * e;
        const x = mix(0, 2) + dx * wave;
        const y = mix(1, 3) + dy * wave;
        const r = mix(4, 5);
        const color = [mix(6, 10), mix(7, 11), mix(8, 12), mix(9, 13)];
        const shown = r > 0 && (color[3] ?? 0) > 0;
        if (layout && i < target) {
            const toX = layout.x[i] ?? 0;
            const toY = layout.y[i] ?? 0;
            const to = colors[layout.ink[i] ?? 0] ?? [0, 0, 0, 0];
            const toR = layout.r[i] ?? 0;
            const same =
                shown &&
                data[o + 2] === toX &&
                data[o + 3] === toY &&
                data[o + 5] === toR &&
                to.every((value, k) => data[o + 10 + k] === Math.fround(value));
            data[o] = shown ? x : toX + dx * ENTRY;
            data[o + 1] = shown ? y : toY + dy * ENTRY;
            data[o + 4] = shown ? r : 0;
            data.set(shown ? color : [to[0], to[1], to[2], 0], o + 6);
            data[o + 2] = toX;
            data[o + 3] = toY;
            data[o + 5] = toR;
            data.set(to, o + 10);
            data[o + 15] = rebuild || !same ? 1 : 0;
        } else {
            data[o] = x;
            data[o + 1] = y;
            data[o + 2] = x;
            data[o + 3] = y;
            data[o + 4] = r;
            data[o + 5] = 0;
            data.set(color, o + 6);
            data.set([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 0], o + 10);
            data[o + 15] = 1;
        }
        if ((data[o + 4] ?? 0) > 0 || (data[o + 5] ?? 0) > 0) count = i + 1;
    }
    points.count = count;
}
