import { describe, expect, it } from 'vitest';
import { cameraFor, centroid, fitDistance, hull, partRects, pickPart } from './camera.ts';
import { compose } from './gfx/math.ts';
import { roundedBox } from './gfx/mesh.ts';
import { HOME } from './orbit.ts';
import type { CameraSpec, Item } from './scenes/types.ts';

const spec: CameraSpec = {
    kind: 'perspective',
    target: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    fov: 0.8,
    fit: { min: [-1, -1, -1], max: [1, 1, 1] },
    fill: 0.9,
    maxYaw: 0.5,
    maxPitch: 0.2,
};
const view = { width: 400, height: 300 };

describe('camera', () => {
    it('fits the box inside the frame at the home pose and never returns a bad distance', () => {
        const distance = fitDistance(spec, view.width / view.height);
        expect(distance).toBeGreaterThan(1);
        expect(Number.isFinite(distance)).toBe(true);
    });

    it('picks the nearest part under the pointer, and nothing off it', () => {
        const box = roundedBox(1, 1, 1, 0.1);
        const items: Item[] = [
            { mesh: box, model: compose([0, 0, 0.6]), color: [1, 1, 1], part: 'front' },
            { mesh: box, model: compose([0, 0, -0.6]), color: [1, 1, 1], part: 'back' },
            { mesh: box, model: compose([0, 0, 0.9], [3, 3, 0.1]), color: [1, 1, 1], part: 'skip', inert: true },
        ];
        const camera = cameraFor(spec, HOME, view);
        expect(pickPart(camera, items, 0, 0)).toBe('front');
        expect(pickPart(camera, items, 0.98, 0.98)).toBeNull();
        expect(pickPart(camera, items, Number.NaN, 0)).toBeNull();
    });

    it('reports a part box whose visible centre is the centre of a box facing the camera', () => {
        const items: Item[] = [
            { mesh: roundedBox(1, 1, 1, 0), model: compose([0, 0, 0]), color: [1, 1, 1], part: 'p' },
        ];
        const [x, y, w, h, cx, cy] = partRects(cameraFor(spec, HOME, view), items, view).p ?? [];
        expect(cx).toBeCloseTo((x ?? 0) + (w ?? 0) / 2, 3);
        expect(cy).toBeCloseTo((y ?? 0) + (h ?? 0) / 2, 3);
        expect(cx).toBeCloseTo(200, 3);
        expect(cy).toBeCloseTo(150, 3);
    });
});

describe('hull and centroid', () => {
    it('finds the silhouette of scattered points and its area centre', () => {
        const shape = hull([
            [0, 0],
            [4, 0],
            [4, 2],
            [0, 2],
            [2, 1],
        ]);
        expect(shape).toHaveLength(4);
        const c = centroid(shape);
        expect(c.area).toBeCloseTo(8);
        expect(c.x).toBeCloseTo(2);
        expect(c.y).toBeCloseTo(1);
    });

    it('falls back to the mean for a degenerate shape', () => {
        expect(centroid([[1, 1]])).toEqual({ area: 0, x: 1, y: 1 });
    });
});
