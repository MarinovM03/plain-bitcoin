export interface ChainState {
    height: number;
    blockTime: number | null;
    estimated: boolean;
}

export interface Weather {
    seed: number;
    tension: number;
    minutes: number;
}

const SEED_STEP = 0.37;
const SEED_CYCLE = 997;
const TENSION_MINUTES = 12;
const UNKNOWN_MINUTES = 10;

export function minutesSince(blockTime: number | null, nowMs: number): number | null {
    if (blockTime === null) return null;
    return Math.max(0, (nowMs - blockTime) / 60_000);
}

export function weather(chain: ChainState | null, nowMs: number): Weather {
    if (!chain) return { seed: 0, tension: 1 - Math.exp(-UNKNOWN_MINUTES / TENSION_MINUTES), minutes: UNKNOWN_MINUTES };
    const minutes = minutesSince(chain.blockTime, nowMs) ?? UNKNOWN_MINUTES;
    return {
        seed: (chain.height % SEED_CYCLE) * SEED_STEP,
        tension: 1 - Math.exp(-minutes / TENSION_MINUTES),
        minutes,
    };
}
