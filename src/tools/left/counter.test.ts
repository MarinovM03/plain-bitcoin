import { describe, expect, it } from 'vitest';
import type { Tip } from '../../data/height.ts';
import { arrivalLine, tipAge, tipLine } from './counter.ts';

const NOW = Date.UTC(2026, 9, 30, 18, 0, 0);

function tip(over: Partial<Tip>): Tip {
    return {
        height: 973_854,
        time: NOW / 1000 - 252,
        source: 'live',
        api: 'mempool.space',
        checkedAt: NOW,
        seenAt: NOW,
        ...over,
    };
}

describe('tipAge', () => {
    it('counts from the block timestamp', () => {
        expect(tipAge(tip({ seenAt: NOW }), NOW)).toBe('4 min 12 s');
    });

    it('counts from when the block was first seen if its timestamp is ahead of the clock', () => {
        expect(tipAge(tip({ time: NOW / 1000 + 600, seenAt: NOW - 30_000 }), NOW)).toBe('30 s');
    });

    it('has no age without a timestamp', () => {
        expect(tipAge(tip({ time: null }), NOW)).toBeNull();
    });
});

describe('tipLine', () => {
    it('labels live, checking and offline heights differently', () => {
        expect(tipLine(tip({}), NOW)).toBe('Block 973,854: 3.125 BTC issued, 4 min 12 s ago.');
        expect(tipLine(tip({ source: 'checking' }), NOW)).toBe('Estimated block 973,854. Checking the latest block.');
        expect(tipLine(tip({ source: 'offline' }), NOW)).toBe(
            'Estimated, offline: block 973,854, assuming a block every 10 minutes.',
        );
    });
});

describe('arrivalLine', () => {
    it('announces one block or a run of missed blocks', () => {
        expect(arrivalLine(973_855, 1)).toBe('Block 973,855: 3.125 BTC issued.');
        expect(arrivalLine(973_857, 3)).toBe('Blocks 973,855 to 973,857: 9.375 BTC issued.');
    });

    it('adds across a halving using each block’s own subsidy', () => {
        expect(arrivalLine(1_050_000, 2)).toBe('Blocks 1,049,999 to 1,050,000: 4.6875 BTC issued.');
    });
});
