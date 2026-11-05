import { describe, expect, it } from 'vitest';
import { bufferScale, ndcToClient, pointerToScene, sceneViewport } from './pointer.ts';

const canvas = { left: 0, top: 0, width: 1440, height: 900 };
const scene = { left: 300, top: 200, width: 400, height: 200 };

describe('pointerToScene', () => {
    for (const dpr of [1, 1.5, 2, 3]) {
        for (const render of [0.5, 0.75, 1]) {
            it(`maps the scene centre to NDC 0,0 at DPR ${dpr}, render scale ${render}`, () => {
                const point = pointerToScene({ clientX: 500, clientY: 300 }, scene, canvas, dpr, render);
                expect(point.inside).toBe(true);
                expect(point.cssX).toBe(200);
                expect(point.cssY).toBe(100);
                // Rounding the viewport to whole device px may move the centre by under one device px.
                const tolerance = 2 / (scene.width * dpr * render);
                expect(Math.abs(point.ndcX)).toBeLessThanOrEqual(tolerance);
                expect(Math.abs(point.ndcY)).toBeLessThanOrEqual(2 / (scene.height * dpr * render));
            });

            it(`flips y for GL and lands each edge on ±1 at DPR ${dpr}, render scale ${render}`, () => {
                const topLeft = pointerToScene({ clientX: 300, clientY: 200 }, scene, canvas, dpr, render);
                const bottomRight = pointerToScene({ clientX: 700, clientY: 400 }, scene, canvas, dpr, render);
                expect(topLeft.ndcX).toBeCloseTo(-1, 1);
                expect(topLeft.ndcY).toBeCloseTo(1, 1);
                expect(bottomRight.ndcX).toBeCloseTo(1, 1);
                expect(bottomRight.ndcY).toBeCloseTo(-1, 1);
                const scale = dpr * render;
                expect(topLeft.bufferY).toBeCloseTo(Math.round(900 * scale) - 200 * scale, 6);
            });
        }
    }

    it('takes client coordinates, so a scrolled page maps through the window rect it measured after the scroll', () => {
        // After scrolling 200 px the same window sits 200 px higher in the viewport.
        const scrolled = { ...scene, top: scene.top - 200 };
        const point = pointerToScene({ clientX: 500, clientY: 100 }, scrolled, canvas, 2, 1);
        expect(point.inside).toBe(true);
        expect(point.cssY).toBe(100);
        expect(Math.abs(point.ndcY)).toBeLessThan(0.01);
    });

    it('handles a scene window offset inside a larger canvas that is itself offset', () => {
        const shifted = { left: 10, top: -40, width: 1440, height: 980 };
        const point = pointerToScene({ clientX: 300, clientY: 400 }, scene, shifted, 1.5, 0.75);
        expect(point.ndcX).toBeCloseTo(-1, 1);
        expect(point.ndcY).toBeCloseTo(-1, 1);
    });

    it('reports outside, with no NDC, for any point off the window', () => {
        for (const [x, y] of [
            [299, 300],
            [701, 300],
            [500, 199],
            [500, 401],
            [Number.NaN, 300],
        ] as const) {
            const point = pointerToScene({ clientX: x, clientY: y }, scene, canvas, 2, 1);
            expect(point.inside).toBe(false);
            expect(Number.isNaN(point.ndcX)).toBe(true);
        }
    });

    it('caps the DPR and never lets a bad ratio through', () => {
        expect(bufferScale(3, 1.5, 1)).toBe(1.5);
        expect(bufferScale(Number.NaN, 1.5, 1)).toBe(1);
        expect(bufferScale(2, 2, 0)).toBe(2);
        const capped = pointerToScene({ clientX: 500, clientY: 300 }, scene, canvas, 3, 1, 1.5);
        expect(capped.bufferX).toBe(750);
    });

    it('round-trips through ndcToClient', () => {
        const point = pointerToScene({ clientX: 412, clientY: 333 }, scene, canvas, 1, 1);
        const back = ndcToClient(point.ndcX, point.ndcY, scene);
        expect(back.x).toBeCloseTo(412, 6);
        expect(back.y).toBeCloseTo(333, 6);
    });
});

describe('sceneViewport', () => {
    it('is the scissor box: whole device px, GL origin at the bottom', () => {
        expect(sceneViewport(scene, canvas, 2)).toEqual({ x: 600, y: 1000, width: 800, height: 400 });
        expect(sceneViewport(scene, canvas, 1)).toEqual({ x: 300, y: 500, width: 400, height: 200 });
    });
});
