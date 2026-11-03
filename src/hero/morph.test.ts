import { describe, expect, it } from 'vitest';
import { createPoints, eased, type Morph, morphFor, retarget, STRIDE, zoomBetween } from './morph.ts';
import { emptyLayout, type Layout } from './scenes/types.ts';

const COLORS = [
    [1, 1, 1, 0.16],
    [1, 1, 1, 0.9],
    [1, 0.5, 0, 1],
] as const;

const TWEAK: Morph = { kind: 'tweak' };
const REBUILD: Morph = { kind: 'rebuild' };
const CUT: Morph = { kind: 'cut', zoom: 1 };

function grid(lit: number, key = 'grid'): Layout {
    const layout = emptyLayout(4, key);
    for (let i = 0; i < 4; i += 1) {
        layout.x[i] = i * 0.2;
        layout.y[i] = 0.5;
        layout.r[i] = 0.05;
        layout.ink[i] = i < lit ? 2 : 0;
        layout.order[i] = i / 3;
    }
    return layout;
}

const wave = (data: Float32Array, i: number) => data[i * STRIDE + 15];
const fromX = (data: Float32Array, i: number) => data[i * STRIDE] ?? 0;
const fromAlpha = (data: Float32Array, i: number) => data[i * STRIDE + 9] ?? 0;

describe('morph', () => {
    it('moves only the points whose target changed when the data changes', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, CUT);
        retarget(points, grid(2), 1, 0.06, COLORS, TWEAK);
        expect([0, 1, 2, 3].map((i) => wave(points.data, i))).toEqual([0, 1, 0, 0]);
    });

    it('moves every point when the scene is rebuilt', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, CUT);
        retarget(points, grid(1), 1, 0.3, COLORS, REBUILD);
        expect([0, 1, 2, 3].map((i) => wave(points.data, i))).toEqual([1, 1, 1, 1]);
    });

    it('starts from where a point is mid-flight, so a quick second change never jumps', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, CUT);
        const moved = grid(1);
        moved.x[3] = 1;
        retarget(points, moved, 1, 0, COLORS, TWEAK);
        retarget(points, grid(1), 0.5, 0, COLORS, TWEAK);
        const x = fromX(points.data, 3);
        const expected = 0.6 + (1 - 0.6) * eased(0.5, 1);
        expect(x).toBeCloseTo(expected, 5);
    });

    it('lands every point on its target, whatever happened before, once the morph completes', () => {
        const points = createPoints();
        const layouts = [grid(4), grid(1, 'other'), grid(3), grid(2, 'other')];
        for (const [k, layout] of layouts.entries()) retarget(points, layout, k * 0.3, 0.2, COLORS, REBUILD);
        const last = layouts.at(-1) as Layout;
        for (let i = 0; i < 4; i += 1) {
            expect(points.data[i * STRIDE + 2]).toBeCloseTo(last.x[i] ?? -1, 6);
            expect(points.data[i * STRIDE + 5]).toBeCloseTo(last.r[i] ?? -1, 6);
        }
    });

    it('fades out points the next layout does not use', () => {
        const points = createPoints();
        retarget(points, grid(4), 1, 0, COLORS, CUT);
        retarget(points, null, 1, 0, COLORS, REBUILD);
        expect(points.data[5]).toBe(0);
        expect(points.data[13]).toBe(0);
    });

    it('keeps nothing of the old scene on a cut: every point starts invisible beside its new target', () => {
        const points = createPoints();
        const old = grid(4);
        for (let i = 0; i < 4; i += 1) old.x[i] = 0.9;
        retarget(points, old, 1, 0, COLORS, CUT);
        retarget(points, grid(2), 1, 0, COLORS, CUT);
        for (let i = 0; i < 4; i += 1) {
            expect(fromAlpha(points.data, i)).toBe(0);
            expect(Math.abs(fromX(points.data, i) - i * 0.2)).toBeLessThan(0.15);
        }
    });

    it('chooses cut for a new scene, tweak for new data, rebuild for a new shape and zoom for a new power of ten', () => {
        const a = grid(1, 'a');
        const b = grid(1, 'b');
        expect(morphFor(a, a, true)).toEqual(CUT);
        expect(morphFor(null, a, false)).toEqual(CUT);
        expect(morphFor(a, grid(2, 'a'), false)).toEqual(TWEAK);
        expect(morphFor(a, b, false)).toEqual(REBUILD);
        a.entry = { x: 0, y: 0, k: 2 };
        b.entry = { x: 0, y: 0, k: 3 };
        expect(morphFor(a, b, false)).toEqual({ kind: 'cut', zoom: Math.sqrt(10) });
        expect(zoomBetween(b.entry, a.entry)).toBeCloseTo(1 / Math.sqrt(10));
        expect(zoomBetween({ x: 0, y: 0, k: 0 }, { x: 0, y: 0, k: 13 })).toBe(12);
    });
});
