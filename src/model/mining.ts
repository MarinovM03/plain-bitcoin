import { TARGET_BLOCK_SECONDS } from './supply.ts';

/** At difficulty 1 a block takes 2^32 tries on average; difficulty scales that. */
const TRIES_AT_ONE = 2 ** 32;
const YEAR_SECONDS = 365.25 * 24 * 3600;

function positive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

/** The average number of hashes behind one block at this difficulty. */
export function triesPerBlock(difficulty: number): number | null {
    return positive(difficulty) ? difficulty * TRIES_AT_ONE : null;
}

/** The whole network's speed in hashes a second, implied by the difficulty and the ten-minute target. */
export function networkHashrate(difficulty: number): number | null {
    const tries = triesPerBlock(difficulty);
    return tries === null ? null : tries / TARGET_BLOCK_SECONDS;
}

/** How long one machine at this speed would need, on average, to find a block alone. In years. */
export function soloYears(difficulty: number, hashesPerSecond: number): number | null {
    const tries = triesPerBlock(difficulty);
    if (tries === null || !positive(hashesPerSecond)) return null;
    return tries / hashesPerSecond / YEAR_SECONDS;
}

/** About how many zero bits a block hash must start with at this difficulty. */
export function zeroBitsNeeded(difficulty: number): number | null {
    return positive(difficulty) ? Math.floor(32 + Math.log2(difficulty)) : null;
}

const RATE_UNITS = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s', 'ZH/s'] as const;

/** 812_000_000_000_000_000_000 -> "812 EH/s". */
export function formatHashrate(hashesPerSecond: number): string {
    if (!positive(hashesPerSecond)) return `0 ${RATE_UNITS[0]}`;
    const step = Math.min(RATE_UNITS.length - 1, Math.floor(Math.log10(hashesPerSecond) / 3));
    const scaled = hashesPerSecond / 1000 ** step;
    const digits = scaled >= 100 || step === 0 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toLocaleString('en-GB', { maximumFractionDigits: digits })} ${RATE_UNITS[step]}`;
}

const BIG = [
    [1e18, 'quintillion'],
    [1e15, 'quadrillion'],
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
] as const;

/** A count in plain words: 3_400_000_000 -> "3.4 billion", 5200 -> "5,200". */
export function formatBigCount(value: number): string {
    if (!positive(value)) return '0';
    for (const [size, name] of BIG) {
        if (value >= size) {
            const scaled = value / size;
            return `${scaled.toLocaleString('en-GB', { maximumFractionDigits: scaled >= 100 ? 0 : 1 })} ${name}`;
        }
    }
    return Math.round(value).toLocaleString('en-GB');
}
