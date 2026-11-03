import { type Entry, type Layout, MAX_POINTS, seedOf } from './scenes/types.ts';

export const MORPH_SECONDS = 1.3;
export const STAGGER = 0.45;
/** Floats per point: path (from x, y, to x, y), radius (from, to), colour from, colour to, seed, wave, order. */
export const STRIDE = 17;
const ENTRY = 0.45;
const MAX_ZOOM = 12;

export type Rgba = readonly [number, number, number, number];

/** How a new layout replaces the old one. */
export type Morph =
    /** Same scene, same structure: only the points whose target changed move, with a light scatter. */
    | { kind: 'tweak' }
    /** Same scene, new structure: every point moves from where it is now. */
    | { kind: 'rebuild' }
    /** A different scene, or the same one zoomed: nothing of the old frame is kept. */
    | { kind: 'cut'; zoom: number };

export interface Points {
    readonly data: Float32Array;
    count: number;
}

export function scatterDirection(seed: number): [number, number] {
    return [Math.sin(seed * 91.7), Math.cos(seed * 47.3)];
}

export function eased(progress: number, order: number): number {
    const t = Math.min(1, Math.max(0, (progress - order * STAGGER) / (1 - STAGGER)));
    return t * t * (3 - 2 * t);
}

export function createPoints(): Points {
    const data = new Float32Array(MAX_POINTS * STRIDE);
    for (let i = 0; i < MAX_POINTS; i += 1) data[i * STRIDE + 14] = seedOf(i);
    return { data, count: 0 };
}

/** Chooses how to replace one layout with the next: a new scene cuts, a new zoom level zooms, a new shape rebuilds. */
export function morphFor(previous: Layout | null, next: Layout | null, freshScene: boolean): Morph {
    if (freshScene || !previous || !next) return { kind: 'cut', zoom: 1 };
    if (previous.rebuild === next.rebuild) return { kind: 'tweak' };
    const zoom = zoomBetween(previous.entry, next.entry);
    return zoom === 1 ? { kind: 'rebuild' } : { kind: 'cut', zoom };
}

/** Zoom factor between two layouts that each name a zoom exponent (powers of ten): the square root of ten per step. */
export function zoomBetween(previous: Entry | null, next: Entry | null): number {
    if (!previous || !next || previous.k === next.k) return 1;
    return Math.min(MAX_ZOOM, Math.max(1 / MAX_ZOOM, Math.sqrt(10) ** (next.k - previous.k)));
}

/**
 * Points the buffer at a new layout. Each point starts from exactly where it is drawn at `progress`, so a second
 * change mid-flight never jumps; a cut starts every point afresh, so no trace of an older scene survives.
 */
export function retarget(
    points: Points,
    layout: Layout | null,
    progress: number,
    scatter: number,
    colors: readonly Rgba[],
    morph: Morph,
): void {
    const { data } = points;
    const target = Math.min(MAX_POINTS, layout?.count ?? 0);
    const cut = morph.kind === 'cut';
    const zoom = cut ? morph.zoom : 1;
    const origin = layout?.entry ?? null;
    let count = 0;
    for (let i = 0; i < MAX_POINTS; i += 1) {
        const o = i * STRIDE;
        const seed = data[o + 14] ?? 0;
        const order = data[o + 16] ?? 0;
        const e = cut ? 1 : eased(progress, order);
        const wave = Math.sin(Math.PI * e) * scatter * (data[o + 15] ?? 0);
        const [dx, dy] = scatterDirection(seed);
        const mix = (from: number, to: number) => (data[o + from] ?? 0) * (1 - e) + (data[o + to] ?? 0) * e;
        const x = mix(0, 2) + dx * wave;
        const y = mix(1, 3) + dy * wave;
        const r = cut ? 0 : mix(4, 5);
        const color = [mix(6, 10), mix(7, 11), mix(8, 12), cut ? 0 : mix(9, 13)];
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
            if (shown) {
                data[o] = x;
                data[o + 1] = y;
                data[o + 4] = r;
                data.set(color, o + 6);
            } else if (zoom !== 1 && origin) {
                data[o] = origin.x + (toX - origin.x) * zoom;
                data[o + 1] = origin.y + (toY - origin.y) * zoom;
                data[o + 4] = toR * Math.min(3, Math.max(0.3, zoom));
                data.set([to[0], to[1], to[2], (to[3] ?? 0) * 0.25], o + 6);
            } else {
                data[o] = toX + dx * ENTRY * 0.25;
                data[o + 1] = toY + dy * ENTRY * 0.25;
                data[o + 4] = 0;
                data.set([to[0], to[1], to[2], 0], o + 6);
            }
            data[o + 2] = toX;
            data[o + 3] = toY;
            data[o + 5] = toR;
            data.set(to, o + 10);
            data[o + 15] = morph.kind === 'tweak' && same ? 0 : 1;
            data[o + 16] = layout.order[i] ?? 0;
        } else {
            data[o] = x;
            data[o + 1] = y;
            data[o + 2] = x;
            data[o + 3] = y;
            data[o + 4] = r;
            data[o + 5] = 0;
            data.set(color, o + 6);
            data.set([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 0], o + 10);
            data[o + 15] = 0;
            data[o + 16] = 0;
        }
        if ((data[o + 4] ?? 0) > 0 || (data[o + 5] ?? 0) > 0) count = i + 1;
    }
    points.count = count;
}
