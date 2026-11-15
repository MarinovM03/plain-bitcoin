import { HALVING_INTERVAL, supplyAt, TARGET_BLOCK_SECONDS } from './supply.ts';

const SLOWEST = 3600;
const FASTEST = 60;

/**
 * The average seconds between the given blocks, newest first. Null when there are too few times to say, or when
 * the answer is not a believable block pace.
 */
export function recentBlockSeconds(times: readonly (number | null)[]): number | null {
    const known = times.filter((time): time is number => time !== null && Number.isFinite(time));
    if (known.length < 2) return null;
    const pace = (Math.max(...known) - Math.min(...known)) / (known.length - 1);
    return pace >= FASTEST && pace <= SLOWEST ? pace : null;
}

export interface HalvingClock {
    blocks: number;
    /** The block that pays the smaller reward first. */
    at: number;
    /** Sats each block pays now, and after the halving. */
    reward: number;
    nextReward: number;
    /** How far through the 210,000 blocks between halvings the chain is, 0 to 1. */
    progress: number;
    /** When the halving lands at the given pace, in ms since the epoch. */
    estimatedAt: number;
    /** Seconds per block the estimate assumes, and whether that came from recent blocks. */
    pace: number;
    measured: boolean;
}

export function halvingClock(height: number, nowMs: number, recentPace: number | null): HalvingClock {
    const supply = supplyAt(height);
    const pace = recentPace ?? TARGET_BLOCK_SECONDS;
    return {
        blocks: supply.blocksToHalving,
        at: supply.nextHalving,
        reward: supply.subsidy,
        nextReward: supply.nextSubsidy,
        progress: 1 - supply.blocksToHalving / HALVING_INTERVAL,
        estimatedAt: nowMs + supply.blocksToHalving * pace * 1000,
        pace,
        measured: recentPace !== null,
    };
}
