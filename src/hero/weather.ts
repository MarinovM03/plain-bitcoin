export interface ChainState {
    height: number;
    /** When the tip block was mined, in ms; null when no time is known. */
    blockTime: number | null;
    /** True when the height or time is an estimate rather than a live reading. */
    estimated: boolean;
}

/**
 * What the field is set to at a moment. Every value comes from the chain state and the clock, or is a constant:
 * nothing here is random, and nothing here is drawn as a number on screen.
 */
export interface Weather {
    /** The field's signature, from the block height: each block lays the field out differently. */
    seed: number;
    /** 0 right after a block, building towards 1 as minutes pass without one. */
    tension: number;
    /** Share of cells that carry a dot. */
    density: number;
    /** How strongly the field folds over itself. */
    warp: number;
    /** Spread between the smallest and largest dots. */
    contrast: number;
    /** Drift speed, in field units per second. */
    drift: number;
    /** 0 cool, 1 neutral: the dots warm slightly as the wait grows; orange is kept for the pulse alone. */
    warmth: number;
    minutes: number;
    estimated: boolean;
}

const SEED_STEP = 0.37;
const SEED_CYCLE = 997;
export const TENSION_MINUTES = 12;
export const UNKNOWN_MINUTES = 10;

export function minutesSince(blockTime: number | null, nowMs: number): number | null {
    if (blockTime === null || !Number.isFinite(blockTime) || !Number.isFinite(nowMs)) return null;
    return Math.max(0, (nowMs - blockTime) / 60_000);
}

export function tensionAt(minutes: number): number {
    return 1 - Math.exp(-Math.max(0, minutes) / TENSION_MINUTES);
}

/** The one mapping from the chain to the field. Pure: the same state and clock always give the same weather. */
export function chainWeather(chain: ChainState | null, nowMs: number): Weather {
    const known = chain !== null && Number.isSafeInteger(chain.height) && chain.height >= 0;
    const minutes = (known ? minutesSince(chain.blockTime, nowMs) : null) ?? UNKNOWN_MINUTES;
    const tension = tensionAt(minutes);
    return {
        seed: known ? (chain.height % SEED_CYCLE) * SEED_STEP : 0,
        tension,
        density: 0.34 + 0.26 * tension,
        warp: 1.3 + 2.3 * tension,
        contrast: 0.55 + 0.45 * tension,
        drift: 0.018 + 0.016 * tension,
        warmth: 0.25 + 0.6 * tension,
        minutes,
        estimated: !known || chain.estimated || chain.blockTime === null,
    };
}
