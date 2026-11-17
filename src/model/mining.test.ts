import { describe, expect, it } from 'vitest';
import { formatBigCount, formatHashrate, networkHashrate, soloYears, triesPerBlock, zeroBitsNeeded } from './mining.ts';

describe('mining odds', () => {
    it('takes 2^32 tries a block at difficulty 1 and scales with difficulty', () => {
        expect(triesPerBlock(1)).toBe(2 ** 32);
        expect(triesPerBlock(1000)).toBe(1000 * 2 ** 32);
        expect(networkHashrate(1)).toBeCloseTo(2 ** 32 / 600);
    });

    it('says how long one machine alone would need for a block', () => {
        const years = soloYears(1, 2 ** 32 / (365.25 * 24 * 3600));
        expect(years).toBeCloseTo(1);
        expect(soloYears(1, 0)).toBeNull();
    });

    it('needs about 32 zero bits at difficulty 1 and one more each time difficulty doubles', () => {
        expect(zeroBitsNeeded(1)).toBe(32);
        expect(zeroBitsNeeded(2)).toBe(33);
        expect(zeroBitsNeeded(0)).toBeNull();
    });

    it('refuses impossible inputs', () => {
        for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(triesPerBlock(bad)).toBeNull();
            expect(networkHashrate(bad)).toBeNull();
        }
    });
});

describe('mining words', () => {
    it('names a hash rate in the largest unit that keeps it readable', () => {
        expect(formatHashrate(946_000)).toBe('946 kH/s');
        expect(formatHashrate(1_250_000)).toBe('1.25 MH/s');
        expect(formatHashrate(812e18)).toBe('812 EH/s');
        expect(formatHashrate(0)).toBe('0 H/s');
    });

    it('says big counts in words', () => {
        expect(formatBigCount(19_400_000_000)).toBe('19.4 billion');
        expect(formatBigCount(5200)).toBe('5,200');
        expect(formatBigCount(-3)).toBe('0');
    });
});
