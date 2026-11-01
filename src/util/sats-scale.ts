export const GRID_DOTS = 1000;

export interface SatsScale {
    perDot: number;
    filled: number;
    partial: number;
}

export function satsScale(sats: number): SatsScale {
    if (!(sats > 0)) return { perDot: 1, filled: 0, partial: 0 };
    const exponent = Math.max(0, Math.ceil(Math.log10(sats / GRID_DOTS) - 1e-9));
    const perDot = 10 ** exponent;
    const dots = sats / perDot;
    const filled = Math.min(GRID_DOTS, Math.floor(dots));
    return { perDot, filled, partial: filled < GRID_DOTS ? dots - filled : 0 };
}
