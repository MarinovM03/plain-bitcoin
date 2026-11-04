import { describe, expect, it } from 'vitest';
import { plateUniform, type Rect, surfaceFor } from './gl.ts';
import { MAX_PLATES } from './shaders.ts';

describe('plate uniform', () => {
    it('keeps the largest plates first, drops broken rects and caps at what the shader holds', () => {
        const plates: Rect[] = [
            [0, 0, 10, 10],
            [0, 0, 100, 100],
            [0, 0, Number.NaN, 5],
            [0, 0, 0, 5],
            ...Array.from({ length: 20 }, (_, i): Rect => [i, i, 20, 20]),
        ];
        const { data, count } = plateUniform(plates);
        expect(count).toBe(MAX_PLATES);
        expect([...data.slice(0, 4)]).toEqual([0, 0, 100, 100]);
        expect(data.every(Number.isFinite)).toBe(true);
    });
});

describe('surface', () => {
    it('draws below the device resolution and covers the whole view with field texels', () => {
        const surface = surfaceFor(1440, 900, 1.5 * 0.75);
        expect(surface.width).toBe(1620);
        expect(surface.cells[0] * surface.cell).toBeGreaterThanOrEqual(1440);
        expect(surface.cells[1] * surface.cell).toBeGreaterThanOrEqual(900);
        expect(surfaceFor(390, 844, Number.NaN).scale).toBe(1);
    });
});
