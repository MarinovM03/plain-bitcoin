import { describe, expect, it } from 'vitest';
import { createPoints, retarget, STRIDE } from './morph.ts';
import { emptyLayout, type Layout } from './scenes/types.ts';

const COLORS = [
    [1, 1, 1, 0.16],
    [1, 1, 1, 0.9],
    [1, 0.5, 0, 1],
] as const;

function grid(lit: number): Layout {
    const layout = emptyLayout(4, 'grid');
    for (let i = 0; i < 4; i += 1) {
        layout.x[i] = i * 0.2;
        layout.y[i] = 0.5;
        layout.r[i] = 0.05;
        layout.ink[i] = i < lit ? 2 : 0;
    }
    return layout;
}

const wave = (data: Float32Array, i: number) => data[i * STRIDE + 15];

describe('morph', () => {
    it('moves only the points whose target changed when the data changes', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, true);
        retarget(points, grid(2), 1, 0.06, COLORS, false);
        expect([0, 1, 2, 3].map((i) => wave(points.data, i))).toEqual([0, 1, 0, 0]);
    });

    it('moves every point when the scene is rebuilt', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, true);
        retarget(points, grid(1), 1, 0.3, COLORS, true);
        expect([0, 1, 2, 3].map((i) => wave(points.data, i))).toEqual([1, 1, 1, 1]);
    });

    it('starts from where a point is mid-flight, so a quick second change never jumps', () => {
        const points = createPoints();
        retarget(points, grid(1), 1, 0, COLORS, true);
        const moved = grid(1);
        moved.x[3] = 1;
        retarget(points, moved, 1, 0, COLORS, false);
        retarget(points, grid(1), 0.5, 0, COLORS, false);
        const from = points.data[3 * STRIDE] ?? 0;
        expect(from).toBeGreaterThan(0.6);
        expect(from).toBeLessThan(1);
    });

    it('fades out points the next layout does not use', () => {
        const points = createPoints();
        retarget(points, grid(4), 1, 0, COLORS, true);
        retarget(points, null, 1, 0, COLORS, true);
        expect(points.data[5]).toBe(0);
        expect(points.data[13]).toBe(0);
    });
});
