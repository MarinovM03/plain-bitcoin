import { describe, expect, it } from 'vitest';
import { scaleLines, stackLines } from './stack.ts';

describe('stack lines', () => {
    it('buys the same amount at each price and values everything at the latest one', () => {
        const lines = stackLines([100, 50, 200], 10);
        expect(lines.invested).toEqual([10, 20, 30]);
        expect(lines.value[0]).toBe(10);
        expect(lines.value[1]).toBeCloseTo(0.3 * 50);
        expect(lines.value[2]).toBeCloseTo(0.35 * 200);
    });

    it('skips bad prices and refuses an empty or impossible plan', () => {
        expect(stackLines([0, Number.NaN, 100], 10).invested).toEqual([10]);
        expect(stackLines([], 10).value).toEqual([]);
        expect(stackLines([100], 0).value).toEqual([]);
    });

    it('puts both lines on one axis', () => {
        const scaled = scaleLines(stackLines([100, 50, 200], 10));
        expect(scaled.value[2]).toBe(1);
        expect(scaled.invested[2]).toBeCloseTo(30 / 70);
    });
});
