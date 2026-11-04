/**
 * Quality levels, best first. `full` and `lite` drift continuously; `still` draws only when something changes;
 * `plain` gives the canvas up for the CSS field.
 */
export const LEVELS = ['full', 'lite', 'still', 'plain'] as const;

export type Quality = (typeof LEVELS)[number];

export interface LevelSettings {
    /** Ambient frame rate while nothing but the weather moves. 0 = no ambient frames. */
    ambientFps: number;
    /** Frame rate while a block pulse travels, the mood resets or the pointer bend eases out. */
    activeFps: number;
    /** Highest device pixel ratio honoured. */
    dprCap: number;
    /** Internal render scale on top of that: the body is drawn smaller and upscaled, which also keeps it soft. */
    renderScale: number;
}

export const TIER_SETTINGS: Record<'full' | 'phone', LevelSettings> = {
    full: { ambientFps: 30, activeFps: 30, dprCap: 1.5, renderScale: 0.75 },
    phone: { ambientFps: 20, activeFps: 24, dprCap: 1.25, renderScale: 0.6 },
};

export const LITE: LevelSettings = { ambientFps: 15, activeFps: 20, dprCap: 1, renderScale: 0.5 };
export const STILL: LevelSettings = { ambientFps: 0, activeFps: 30, dprCap: 1, renderScale: 0.5 };

export function settingsFor(quality: Quality, tier: 'full' | 'phone'): LevelSettings {
    if (quality === 'full') return TIER_SETTINGS[tier];
    if (quality === 'lite') return LITE;
    return STILL;
}

/** Frames this much slower than asked for, on average over a window, step the quality down. */
export const SLOW_RATIO = 1.5;
export const WINDOW_MS = 2000;
/** A still frame that takes longer than this to land, three times running, gives the canvas up. */
export const SLOW_STILL_MS = 120;
/** Good frames for this long earn one step back up. */
export const UPGRADE_MS = 20_000;
/** A level that had to be left twice is never tried again this visit. */
export const MAX_FAILS = 2;
const STILL_SAMPLES = 3;
const PAUSE_MS = 1000;

export interface Ladder {
    readonly quality: Quality;
    /** One drawn frame: how long since the last one, and how long was asked for. Returns a new level, or null. */
    sample(intervalMs: number, targetMs: number): Quality | null;
    /** A still frame's latency from request to draw. */
    still(latencyMs: number): Quality | null;
    reset(): void;
}

/**
 * Pure degrade/upgrade ladder with hysteresis: down one level after a window of slow frames, back up one level only
 * after a long run of good ones, and never back to a level that has already failed twice.
 */
export function createLadder(start: Quality, ceiling: Quality = start): Ladder {
    let quality = start;
    let total = 0;
    let count = 0;
    let goodMs = 0;
    let stillSlow = 0;
    const fails = new Map<Quality, number>();

    const index = (level: Quality) => LEVELS.indexOf(level);

    function clearWindow(): void {
        total = 0;
        count = 0;
    }

    function step(delta: 1 | -1): Quality {
        if (delta === 1) fails.set(quality, (fails.get(quality) ?? 0) + 1);
        quality = LEVELS[Math.min(LEVELS.length - 1, Math.max(index(ceiling), index(quality) + delta))] ?? 'plain';
        clearWindow();
        goodMs = 0;
        stillSlow = 0;
        return quality;
    }

    function canUpgrade(): boolean {
        if (index(quality) <= index(ceiling)) return false;
        const above = LEVELS[index(quality) - 1];
        return above !== undefined && (fails.get(above) ?? 0) < MAX_FAILS;
    }

    return {
        get quality() {
            return quality;
        },
        sample(intervalMs, targetMs) {
            if (quality === 'plain' || quality === 'still') return null;
            if (!(intervalMs > 0) || !(targetMs > 0) || intervalMs > PAUSE_MS) return null;
            total += Math.min(intervalMs, targetMs * 4);
            count += 1;
            if (total < WINDOW_MS) return null;
            const slow = total / count > targetMs * SLOW_RATIO;
            if (slow) return step(1);
            goodMs += total;
            clearWindow();
            if (goodMs >= UPGRADE_MS && canUpgrade()) return step(-1);
            return null;
        },
        still(latencyMs) {
            if (quality !== 'still' || !(latencyMs >= 0) || latencyMs > PAUSE_MS * 5) return null;
            stillSlow = latencyMs > SLOW_STILL_MS ? stillSlow + 1 : 0;
            return stillSlow >= STILL_SAMPLES ? step(1) : null;
        },
        reset() {
            clearWindow();
            goodMs = 0;
        },
    };
}
