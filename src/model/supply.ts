export const SATS_PER_BTC = 100_000_000;
export const HALVING_INTERVAL = 210_000;
export const INITIAL_SUBSIDY = 5_000_000_000;
export const MAX_SUPPLY = 2_099_999_997_690_000;
export const TARGET_BLOCK_SECONDS = 600;

const HALVINGS_TO_ZERO = 64;
const INTERVAL = BigInt(HALVING_INTERVAL);
const INITIAL = BigInt(INITIAL_SUBSIDY);

function assertHeight(height: number): void {
    if (!Number.isSafeInteger(height) || height < 0)
        throw new RangeError(`Height must be a whole number >= 0, got ${height}`);
}

function eraSubsidy(era: number): bigint {
    return era >= HALVINGS_TO_ZERO ? 0n : INITIAL >> BigInt(era);
}

function issuedBeforeEraBig(era: number): bigint {
    let total = 0n;
    for (let e = 0; e < Math.min(era, HALVINGS_TO_ZERO); e += 1) total += INTERVAL * eraSubsidy(e);
    return total;
}

export function eraOf(height: number): number {
    assertHeight(height);
    return Math.floor(height / HALVING_INTERVAL);
}

export function subsidy(height: number): number {
    return Number(eraSubsidy(eraOf(height)));
}

export function issuedBeforeEra(era: number): number {
    if (!Number.isSafeInteger(era) || era < 0) throw new RangeError(`Era must be a whole number >= 0, got ${era}`);
    return Number(issuedBeforeEraBig(era));
}

export function issued(height: number): number {
    const era = eraOf(height);
    const inEra = BigInt(height - era * HALVING_INTERVAL + 1);
    return Number(issuedBeforeEraBig(era) + inEra * eraSubsidy(era));
}

export function nextHalvingHeight(height: number): number {
    return (eraOf(height) + 1) * HALVING_INTERVAL;
}

export interface Supply {
    height: number;
    era: number;
    issued: number;
    left: number;
    issuedPpm: number;
    subsidy: number;
    nextSubsidy: number;
    nextHalving: number;
    blocksToHalving: number;
}

export function supplyAt(height: number): Supply {
    const total = issued(height);
    const nextHalving = nextHalvingHeight(height);
    return {
        height,
        era: eraOf(height),
        issued: total,
        left: MAX_SUPPLY - total,
        issuedPpm: Number((BigInt(total) * 1_000_000n) / BigInt(MAX_SUPPLY)),
        subsidy: subsidy(height),
        nextSubsidy: subsidy(nextHalving),
        nextHalving,
        blocksToHalving: nextHalving - height,
    };
}

export function estimatedHalvingTime(blocksToHalving: number, nowMs: number): number {
    return nowMs + blocksToHalving * TARGET_BLOCK_SECONDS * 1000;
}
