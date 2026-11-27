export const PAYMENT_TYPES = ['segwit', 'taproot', 'legacy'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SPEEDS = ['next', 'halfHour', 'hour', 'noRush'] as const;

export type Speed = (typeof SPEEDS)[number];

/** Fee rates in sats per virtual byte, as mempool.space recommends them for each wait. */
export type FeeRates = Readonly<Record<Speed, number>>;

/**
 * Virtual bytes per input and per output, and the fixed part of every transaction, for the common wallet types:
 * native SegWit (P2WPKH), Taproot key spends (P2TR) and legacy (P2PKH). The usual planning estimates.
 */
const SIZES: Record<PaymentType, { base: number; input: number; output: number }> = {
    segwit: { base: 10.5, input: 68, output: 31 },
    taproot: { base: 10.5, input: 57.5, output: 43 },
    legacy: { base: 10, input: 148, output: 34 },
};

export const MOST_COINS = 500;

function count(value: number): number {
    return Math.min(MOST_COINS, Math.max(1, Math.floor(Number.isFinite(value) ? value : 1)));
}

/** About how many virtual bytes a payment takes: what the fee rate is multiplied by. */
export function paymentSize(type: PaymentType, inputs: number, outputs: number): number {
    const size = SIZES[type];
    return Math.ceil(size.base + count(inputs) * size.input + count(outputs) * size.output);
}

function rate(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100_000 ? value : null;
}

/** Reads `/api/v1/fees/recommended`; null unless every wait has a sane rate. */
export function parseFees(json: unknown): FeeRates | null {
    if (typeof json !== 'object' || json === null) return null;
    const body = json as Record<string, unknown>;
    const next = rate(body.fastestFee);
    const halfHour = rate(body.halfHourFee);
    const hour = rate(body.hourFee);
    const noRush = rate(body.economyFee);
    if (next === null || halfHour === null || hour === null || noRush === null) return null;
    return { next, halfHour, hour, noRush };
}

export interface FeeCost {
    speed: Speed;
    rate: number;
    sats: number;
    /** In the money asked for, or null with no price. */
    money: number | null;
}

/** What the payment costs at each wait: the rate times its size, rounded up to whole sats. */
export function feeCosts(rates: FeeRates, vbytes: number, price: number | null): FeeCost[] {
    return SPEEDS.map((speed) => {
        const sats = Math.ceil(rates[speed] * vbytes);
        return { speed, rate: rates[speed], sats, money: price && price > 0 ? (sats / 100_000_000) * price : null };
    });
}
