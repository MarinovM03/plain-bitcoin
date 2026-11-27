import { describe, expect, it } from 'vitest';
import { feeCosts, MOST_COINS, parseFees, paymentSize } from './fees.ts';

const RECOMMENDED = { fastestFee: 4, halfHourFee: 3, hourFee: 2, economyFee: 1, minimumFee: 1 };

describe('paymentSize', () => {
    it('gives the usual sizes of a one-input, two-output payment', () => {
        expect(paymentSize('segwit', 1, 2)).toBe(141);
        expect(paymentSize('taproot', 1, 2)).toBe(154);
        expect(paymentSize('legacy', 1, 2)).toBe(226);
    });

    it('grows with every coin spent and every output', () => {
        expect(paymentSize('segwit', 3, 2)).toBe(277);
        expect(paymentSize('segwit', 1, 1)).toBe(110);
    });

    it('treats nonsense counts as one, and caps huge ones', () => {
        expect(paymentSize('segwit', 0, 2)).toBe(paymentSize('segwit', 1, 2));
        expect(paymentSize('segwit', Number.NaN, 2)).toBe(paymentSize('segwit', 1, 2));
        expect(paymentSize('segwit', 1e9, 2)).toBe(paymentSize('segwit', MOST_COINS, 2));
    });
});

describe('parseFees', () => {
    it('reads the four waits', () => {
        expect(parseFees(RECOMMENDED)).toEqual({ next: 4, halfHour: 3, hour: 2, noRush: 1 });
    });

    it('keeps fractional rates', () => {
        expect(parseFees({ ...RECOMMENDED, economyFee: 0.1 })?.noRush).toBe(0.1);
    });

    it('refuses missing, zero, negative or absurd rates', () => {
        expect(parseFees(null)).toBeNull();
        expect(parseFees([])).toBeNull();
        expect(parseFees({ ...RECOMMENDED, hourFee: undefined })).toBeNull();
        expect(parseFees({ ...RECOMMENDED, fastestFee: 0 })).toBeNull();
        expect(parseFees({ ...RECOMMENDED, halfHourFee: -2 })).toBeNull();
        expect(parseFees({ ...RECOMMENDED, fastestFee: 1e9 })).toBeNull();
        expect(parseFees({ ...RECOMMENDED, economyFee: '1' })).toBeNull();
    });
});

describe('feeCosts', () => {
    it('multiplies each rate by the size, rounding up to whole sats, and prices it', () => {
        const costs = feeCosts({ next: 4, halfHour: 3, hour: 2.5, noRush: 0.1 }, 141, 80_000);
        expect(costs.map((cost) => cost.sats)).toEqual([564, 423, 353, 15]);
        expect(costs[0]?.money).toBeCloseTo(0.4512, 6);
        expect(costs.map((cost) => cost.speed)).toEqual(['next', 'halfHour', 'hour', 'noRush']);
    });

    it('leaves the money out with no price', () => {
        expect(feeCosts({ next: 1, halfHour: 1, hour: 1, noRush: 1 }, 141, null)[0]?.money).toBeNull();
    });
});
