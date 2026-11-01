import { describe, expect, it } from 'vitest';
import { minutesSince, weather } from './weather.ts';

const NOW = Date.UTC(2026, 10, 1, 12, 0);

describe('weather', () => {
    it('is calm right after a block and builds tension as the gap grows', () => {
        const at = (minutes: number) =>
            weather({ height: 974_148, blockTime: NOW - minutes * 60_000, estimated: false }, NOW).tension;
        expect(at(0)).toBe(0);
        expect(at(10)).toBeGreaterThan(0.5);
        expect(at(10)).toBeLessThan(at(30));
        expect(at(120)).toBeLessThan(1);
    });

    it('takes its seed from the block height alone, so the same block always draws the same field', () => {
        const a = weather({ height: 974_148, blockTime: NOW, estimated: false }, NOW);
        const b = weather({ height: 974_148, blockTime: NOW - 500_000, estimated: true }, NOW + 9_000);
        const next = weather({ height: 974_149, blockTime: NOW, estimated: false }, NOW);
        expect(a.seed).toBe(b.seed);
        expect(next.seed).not.toBe(a.seed);
        expect(Math.abs(next.seed - a.seed)).toBeLessThan(1);
    });

    it('never reads a block time in the future as negative minutes', () => {
        expect(minutesSince(NOW + 60_000, NOW)).toBe(0);
        expect(minutesSince(null, NOW)).toBeNull();
    });

    it('falls back to a fixed, labelled-elsewhere ten minutes when no block time is known', () => {
        expect(weather(null, NOW)).toEqual(weather({ height: 0, blockTime: null, estimated: true }, NOW));
        expect(weather(null, NOW).minutes).toBe(10);
    });
});
