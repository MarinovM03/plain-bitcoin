import { describe, expect, it } from 'vitest';
import { barScale, lineChart, sampleIndices, sparkline } from './scale.ts';

describe('barScale', () => {
    it('stays linear up to ten times', () => {
        expect(barScale([1000, 4000])).toEqual({ log: false, ratio: 4, widths: [0.25, 1], decade: 0 });
        expect(barScale([1000, 10_000]).log).toBe(false);
    });

    it('switches to a log scale beyond ten times, with the smaller bar a decade wide', () => {
        const scale = barScale([1000, 1_000_000]);
        expect(scale.log).toBe(true);
        expect(scale.ratio).toBe(1000);
        expect(scale.widths[0]).toBeCloseTo(0.25, 10);
        expect(scale.widths[1]).toBeCloseTo(1, 10);
        expect(scale.decade).toBeCloseTo(0.25, 10);
    });

    it('works whichever bar is larger', () => {
        expect(barScale([800, 400]).widths).toEqual([1, 0.5]);
    });

    it('rejects values that are not positive', () => {
        expect(() => barScale([0, 10])).toThrow(RangeError);
    });
});

describe('sparkline', () => {
    it('spreads points across the width and maps the base line', () => {
        const line = sparkline([100, 200, 0], 100, 100, 50);
        expect(line.points).toBe('0,25 50,0 100,50');
        expect(line.baseY).toBe(25);
        expect(line.log).toBe(false);
    });

    it('uses a log scale when the path spans more than ten times', () => {
        const line = sparkline([1, 10, 100], 1, 100, 40);
        expect(line.log).toBe(true);
        expect(line.points).toBe('0,40 50,20 100,0');
    });

    it('draws a single point at the left edge', () => {
        expect(sparkline([100], 100, 100, 40).points).toBe('0,40');
    });
});

describe('lineChart', () => {
    it('samples evenly and always keeps the first and last day', () => {
        expect(sampleIndices(5, 240)).toEqual([0, 1, 2, 3, 4]);
        expect(sampleIndices(1_000, 3)).toEqual([0, 500, 999]);
        expect(sampleIndices(1, 240)).toEqual([0]);
        expect(sampleIndices(0, 240)).toEqual([]);
    });

    it('draws every series on one scale from zero', () => {
        const chart = lineChart(
            [
                [0, 50, 100],
                [0, 100, 200],
            ],
            100,
            40,
            240,
        );
        expect(chart.max).toBe(200);
        expect(chart.lines).toEqual(['0,40 50,30 100,20', '0,40 50,20 100,0']);
    });
});
