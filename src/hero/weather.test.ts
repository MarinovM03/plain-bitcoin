import { describe, expect, it } from 'vitest';
import { chainWeather, minutesSince, moodAt, UNKNOWN_MINUTES } from './weather.ts';

const NOW = Date.UTC(2026, 10, 1, 12, 0);
const at = (minutes: number, estimated = false) =>
    chainWeather({ height: 974_148, blockTime: NOW - minutes * 60_000, estimated }, NOW);

describe('chainWeather', () => {
    it('is calm right after a block and builds tension monotonically from 1 to 25 minutes', () => {
        const keys = ['tension', 'bands', 'warp', 'drift', 'glow'] as const;
        let previous = at(1);
        for (let minutes = 2; minutes <= 25; minutes += 1) {
            const next = at(minutes);
            for (const key of keys) expect(next[key], `${key} at ${minutes} min`).toBeGreaterThan(previous[key]);
            previous = next;
        }
        expect(at(0).tension).toBe(0);
        expect(at(1).tension).toBeLessThan(0.1);
        expect(at(25).tension).toBeGreaterThan(0.85);
        expect(at(240).tension).toBeLessThan(1);
        expect(at(25).bands).toBeGreaterThan(at(1).bands * 2);
    });

    it('always drifts: even the calmest body moves, so it reads as alive within two seconds', () => {
        const calm = at(0);
        // One field unit is about 300 CSS px, so this is at least 15 px a second of plain advection.
        expect(calm.drift * 300 * 2).toBeGreaterThan(25);
        expect(moodAt(Number.NaN).drift).toBeGreaterThan(0);
    });

    it('takes its signature from the block height alone, so the same block always draws the same field', () => {
        const a = chainWeather({ height: 974_148, blockTime: NOW, estimated: false }, NOW);
        const b = chainWeather({ height: 974_148, blockTime: NOW - 500_000, estimated: true }, NOW + 9_000);
        const next = chainWeather({ height: 974_149, blockTime: NOW, estimated: false }, NOW);
        expect(a.seed).toBe(b.seed);
        expect(next.seed).not.toBe(a.seed);
    });

    it('is pure: the same state and clock give the same weather every time', () => {
        expect(at(7)).toEqual(at(7));
    });

    it('gives an estimated tip the neutral mood, never a claimed wait, and never reads a future block as negative', () => {
        expect(at(5, true).estimated).toBe(true);
        expect(at(5, true).minutes).toBe(UNKNOWN_MINUTES);
        expect(at(25, true).tension).toBe(at(2, true).tension);
        expect(at(5).estimated).toBe(false);
        expect(minutesSince(NOW + 60_000, NOW)).toBe(0);
        expect(minutesSince(null, NOW)).toBeNull();
        expect(minutesSince(Number.NaN, NOW)).toBeNull();
    });

    it('falls back to a fixed ten minutes, flagged as estimated, when nothing is known', () => {
        expect(chainWeather(null, NOW)).toEqual(chainWeather({ height: 0, blockTime: null, estimated: true }, NOW));
        expect(chainWeather(null, NOW).minutes).toBe(UNKNOWN_MINUTES);
        expect(chainWeather(null, NOW).estimated).toBe(true);
        const broken = chainWeather({ height: Number.NaN, blockTime: Number.NaN, estimated: false }, NOW);
        expect(Object.values(broken).every((value) => typeof value === 'boolean' || Number.isFinite(value))).toBe(true);
    });
});
