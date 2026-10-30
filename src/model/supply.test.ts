import { describe, expect, it } from 'vitest';
import {
    eraOf,
    estimatedHalvingTime,
    issued,
    issuedBeforeEra,
    MAX_SUPPLY,
    nextHalvingHeight,
    SATS_PER_BTC,
    subsidy,
    supplyAt,
} from './supply.ts';

const btc = (coins: number) => coins * SATS_PER_BTC;
const LAST_SUBSIDY_HEIGHT = 33 * 210_000 - 1;

describe('subsidy', () => {
    it('halves every 210,000 blocks', () => {
        expect(subsidy(0)).toBe(btc(50));
        expect(subsidy(209_999)).toBe(btc(50));
        expect(subsidy(210_000)).toBe(btc(25));
        expect(subsidy(840_000)).toBe(312_500_000);
        expect(subsidy(1_050_000)).toBe(156_250_000);
    });

    it('rounds down to whole sats and reaches zero', () => {
        expect(subsidy(32 * 210_000)).toBe(1);
        expect(subsidy(LAST_SUBSIDY_HEIGHT + 1)).toBe(0);
        expect(subsidy(64 * 210_000)).toBe(0);
        expect(subsidy(100 * 210_000)).toBe(0);
    });

    it('rejects heights that are not whole blocks', () => {
        expect(() => subsidy(-1)).toThrow(RangeError);
        expect(() => subsidy(1.5)).toThrow(RangeError);
    });
});

describe('issued', () => {
    it('counts the genesis block', () => {
        expect(issued(0)).toBe(btc(50));
    });

    it('matches the schedule at era ends', () => {
        expect(issued(209_999)).toBe(btc(10_500_000));
        expect(issued(419_999)).toBe(btc(15_750_000));
        expect(issued(839_999)).toBe(btc(19_687_500));
    });

    it('adds the current subsidy once per block', () => {
        expect(issued(840_000) - issued(839_999)).toBe(subsidy(840_000));
        expect(issued(973_854)).toBe(btc(19_687_500) + 133_855 * 312_500_000);
    });

    it('reaches the maximum at the last block with a subsidy and stays there', () => {
        expect(issued(LAST_SUBSIDY_HEIGHT)).toBe(MAX_SUPPLY);
        expect(issued(LAST_SUBSIDY_HEIGHT + 1)).toBe(MAX_SUPPLY);
        expect(issued(64 * 210_000)).toBe(MAX_SUPPLY);
        expect(issuedBeforeEra(64)).toBe(MAX_SUPPLY);
    });

    it('stays a safe integer everywhere', () => {
        for (const height of [0, 1, 209_999, 973_854, LAST_SUBSIDY_HEIGHT, 20_000_000]) {
            expect(Number.isSafeInteger(issued(height))).toBe(true);
        }
    });
});

describe('halvings', () => {
    it('finds the next halving height and era', () => {
        expect(eraOf(839_999)).toBe(3);
        expect(eraOf(840_000)).toBe(4);
        expect(nextHalvingHeight(973_854)).toBe(1_050_000);
        expect(nextHalvingHeight(1_049_999)).toBe(1_050_000);
        expect(nextHalvingHeight(1_050_000)).toBe(1_260_000);
    });

    it('estimates the date at ten minutes a block', () => {
        expect(estimatedHalvingTime(6, 1_000)).toBe(1_000 + 3_600_000);
    });
});

describe('supplyAt', () => {
    it('summarises one height with whole sats', () => {
        const supply = supplyAt(973_854);
        expect(supply).toEqual({
            height: 973_854,
            era: 4,
            issued: 2_010_579_687_500_000,
            left: 89_420_310_190_000,
            issuedPpm: 957_418,
            subsidy: 312_500_000,
            nextSubsidy: 156_250_000,
            nextHalving: 1_050_000,
            blocksToHalving: 76_146,
        });
        expect(supply.issued + supply.left).toBe(MAX_SUPPLY);
    });
});
