import { describe, expect, it } from 'vitest';
import { halvingClock, recentBlockSeconds } from './halving.ts';

describe('halving clock', () => {
    it('counts the blocks to the next halving and the rewards either side', () => {
        const clock = halvingClock(1_000_000, 0, null);
        expect(clock.at).toBe(1_050_000);
        expect(clock.blocks).toBe(50_000);
        expect(clock.reward).toBe(312_500_000);
        expect(clock.nextReward).toBe(156_250_000);
        expect(clock.progress).toBeCloseTo(160_000 / 210_000);
        expect(clock.measured).toBe(false);
        expect(clock.estimatedAt).toBe(50_000 * 600 * 1000);
    });

    it('uses the recent pace when there is one', () => {
        const clock = halvingClock(1_049_999, 1000, 540);
        expect(clock.blocks).toBe(1);
        expect(clock.estimatedAt).toBe(1000 + 540_000);
        expect(clock.measured).toBe(true);
    });

    it('measures the pace from block times and refuses unbelievable ones', () => {
        expect(recentBlockSeconds([1_200, 600, 0])).toBe(600);
        expect(recentBlockSeconds([10, 0])).toBeNull();
        expect(recentBlockSeconds([5000, null])).toBeNull();
    });
});
