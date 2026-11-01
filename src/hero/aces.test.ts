import { describe, expect, it } from 'vitest';
import { TOKENS } from '../styles/tokens.ts';
import { aces, hexToSrgb, inverseAces, srgbToLinear } from './aces.ts';

describe('inverseAces', () => {
    it('finds the scene colour that tone-maps back to the page background', () => {
        for (const hex of [TOKENS.ink, TOKENS.raised, TOKENS.line]) {
            const target = hexToSrgb(hex).map(srgbToLinear) as [number, number, number];
            const mapped = aces(inverseAces(target));
            for (let c = 0; c < 3; c += 1) expect(mapped[c]).toBeCloseTo(target[c] ?? 0, 5);
        }
    });

    it('maps black to black and keeps the curve below one', () => {
        expect(aces([0, 0, 0])).toEqual([0, 0, 0]);
        expect(Math.max(...aces([100, 100, 100]))).toBeLessThanOrEqual(1);
    });
});
