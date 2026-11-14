import { describe, expect, it } from 'vitest';
import { HASH_BITS } from '../chain/hash.ts';
import { fieldCell } from './field.ts';

const SIZES = [
    [390, 844],
    [844, 390],
    [1440, 900],
] as const;

describe('fieldCell', () => {
    it('keeps every square within reach of the viewport at any time', () => {
        for (const [width, height] of SIZES) {
            const cellH = height / 15;
            for (const seconds of [0, 17.3, 600, 86_400]) {
                for (let index = 0; index < HASH_BITS; index += 1) {
                    const cell = fieldCell(index, seconds, width, height);
                    expect(cell.x).toBeGreaterThan(-width / 16);
                    expect(cell.x).toBeLessThan(width + width / 16);
                    expect(cell.y).toBeGreaterThanOrEqual(-cellH);
                    expect(cell.y).toBeLessThanOrEqual(height + cellH);
                    expect(cell.size).toBeGreaterThanOrEqual(5.25);
                    expect(cell.size).toBeLessThanOrEqual(16.25);
                }
            }
        }
    });

    it('is the same on every visit and rises as time passes', () => {
        expect(fieldCell(40, 12, 390, 844)).toEqual(fieldCell(40, 12, 390, 844));
        const before = fieldCell(200, 0, 390, 844);
        const after = fieldCell(200, 1, 390, 844);
        expect(after.y).toBeLessThan(before.y);
        expect(before.y - after.y).toBeLessThan(10);
    });
});
