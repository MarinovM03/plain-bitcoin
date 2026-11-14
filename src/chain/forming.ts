/** The forming block never fills past this by itself; only a real block completes it. */
export const FILL_CAP = 0.85;

/** Seconds for the fill to cover about 63% of the way to its cap: one average block interval. */
export const FILL_SECONDS = 600;

/**
 * How gathered the forming block looks, from the time since the last block. It is texture, not a forecast: it
 * rises quickly at first, flattens, and stops at the cap however long the wait.
 */
export function formingFill(secondsSinceBlock: number | null): number {
    if (secondsSinceBlock === null || !Number.isFinite(secondsSinceBlock) || secondsSinceBlock <= 0) return 0;
    return FILL_CAP * (1 - Math.exp(-secondsSinceBlock / FILL_SECONDS));
}
