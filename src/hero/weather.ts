export interface ChainState {
    height: number;
    /** When the tip block was mined, in ms; null when no time is known. */
    blockTime: number | null;
    /** True when the height or time is an estimate rather than a live reading. */
    estimated: boolean;
}

/**
 * What the background is set to at a moment. Every value comes from the chain state and the clock, or is a
 * constant: nothing here is random, and nothing here is ever drawn as a number on screen.
 */
export interface Weather {
    /** Where in the field the drift starts, from the block height: each block lays the masses out differently. */
    seed: number;
    /** 0 right after a block, building towards 1 as minutes pass without one. */
    tension: number;
    /** How strongly the field folds over itself. */
    warp: number;
    /** Drift speed, in field units per second. Always above zero: the background never stands still while seen. */
    drift: number;
    /** How far the masses separate from the deep ground, 0..1 of the weather ceiling. */
    contrast: number;
    minutes: number;
    estimated: boolean;
}

const SEED_STEP = 0.37;
const SEED_CYCLE = 997;
export const TENSION_MINUTES = 12;
/** Used whenever the time since the last block is not known for real: a neutral mood, never a claimed wait. */
export const UNKNOWN_MINUTES = 10;

export function minutesSince(blockTime: number | null, nowMs: number): number | null {
    if (blockTime === null || !Number.isFinite(blockTime) || !Number.isFinite(nowMs)) return null;
    return Math.max(0, (nowMs - blockTime) / 60_000);
}

export function tensionAt(minutes: number): number {
    return 1 - Math.exp(-Math.max(0, Number.isFinite(minutes) ? minutes : UNKNOWN_MINUTES) / TENSION_MINUTES);
}

/** The field is shaped by these three, all from tension; exported so tests can sweep it. */
export function moodAt(tension: number): Pick<Weather, 'warp' | 'drift' | 'contrast'> {
    const t = Number.isFinite(tension) ? Math.min(1, Math.max(0, tension)) : 0.5;
    return {
        warp: 0.9 + 1.7 * t,
        drift: 0.075 + 0.065 * t,
        contrast: 0.5 + 0.5 * t,
    };
}

/**
 * The one mapping from the chain to the background. Pure: the same state and clock always give the same weather.
 * An estimated tip (no live reading) gets the neutral mood: it never pretends to know a wait it does not.
 */
export function chainWeather(chain: ChainState | null, nowMs: number): Weather {
    const known = chain !== null && Number.isSafeInteger(chain.height) && chain.height >= 0;
    const estimated = !known || chain.estimated || chain.blockTime === null;
    const minutes = (known && !estimated ? minutesSince(chain.blockTime, nowMs) : null) ?? UNKNOWN_MINUTES;
    const tension = tensionAt(minutes);
    return {
        seed: known ? (chain.height % SEED_CYCLE) * SEED_STEP : 0,
        tension,
        ...moodAt(tension),
        minutes,
        estimated,
    };
}
