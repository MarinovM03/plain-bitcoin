import { MAX_SATS, SATS_PER_BTC } from './convert.ts';

export type HoldingFiat = 'USD' | 'GBP';

/** One price reading, kept so the next visit can say how far the price has moved since. */
export interface PriceMark {
    at: number;
    usd: number;
    gbp: number;
}

export interface Holding {
    sats: number;
    fiat: HoldingFiat;
    savedAt: number;
    /** The price when this visit began. */
    visit: PriceMark;
    /** The price when the visit before began; null until a second visit. */
    previous: PriceMark | null;
}

/** A page opened again within this long is the same visit, so a reload does not reset the change to zero. */
export const VISIT_GAP_MS = 60 * 60 * 1000;

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

function parseMark(value: unknown): PriceMark | null {
    if (typeof value !== 'object' || value === null) return null;
    const { at, usd, gbp } = value as Record<string, unknown>;
    return positive(at) && positive(usd) && positive(gbp) ? { at, usd, gbp } : null;
}

export function validSats(sats: unknown): sats is number {
    return typeof sats === 'number' && Number.isSafeInteger(sats) && sats > 0 && sats <= MAX_SATS;
}

/** Reads what this browser kept; anything malformed or tampered with reads as nothing kept. */
export function parseHolding(json: unknown): Holding | null {
    if (typeof json !== 'object' || json === null) return null;
    const raw = json as Record<string, unknown>;
    const visit = parseMark(raw.visit);
    const previous = raw.previous === null ? null : parseMark(raw.previous);
    if (!validSats(raw.sats) || !positive(raw.savedAt) || !visit) return null;
    if (raw.previous !== null && previous === null) return null;
    const fiat = raw.fiat === 'GBP' ? 'GBP' : 'USD';
    return { sats: raw.sats, fiat, savedAt: raw.savedAt, visit, previous };
}

export function keep(sats: number, fiat: HoldingFiat, mark: PriceMark, savedAt: number): Holding {
    return { sats, fiat, savedAt, visit: mark, previous: null };
}

/** A new visit starts once the last one is an hour old; until then the holding is left as it is. */
export function visited(holding: Holding, mark: PriceMark): Holding {
    if (mark.at - holding.visit.at < VISIT_GAP_MS) return holding;
    return { ...holding, visit: mark, previous: holding.visit };
}

/** The reading the change is measured from: the last visit, or the day it was kept before there was one. */
export function baseline(holding: Holding): { mark: PriceMark; since: 'visit' | 'saved' } {
    return holding.previous ? { mark: holding.previous, since: 'visit' } : { mark: holding.visit, since: 'saved' };
}

export function priceIn(mark: Pick<PriceMark, 'usd' | 'gbp'>, fiat: HoldingFiat): number {
    return fiat === 'GBP' ? mark.gbp : mark.usd;
}

export function worth(sats: number, price: number): number {
    return (sats / SATS_PER_BTC) * price;
}

export interface Change {
    money: number;
    fraction: number;
}

/** The same coins at two prices: the change in money and as a share of the earlier value. */
export function change(sats: number, then: number, now: number): Change {
    return { money: worth(sats, now) - worth(sats, then), fraction: then > 0 ? now / then - 1 : 0 };
}

export interface ValueSeries {
    t: number[];
    value: number[];
}

const DAY_MS = 86_400_000;

/**
 * What these coins were worth at each daily close of the last `days` days, ending at today's price. Only the
 * closes before today's own reading are drawn, so the line never doubles back.
 */
export function valueSeries(
    sats: number,
    closes: { start: string; closes: readonly number[] },
    days: number,
    now: { at: number; price: number },
): ValueSeries {
    const t: number[] = [];
    const value: number[] = [];
    const start = Date.parse(`${closes.start}T00:00:00Z`);
    const from = now.at - days * DAY_MS;
    for (const [i, close] of closes.closes.entries()) {
        const day = start + i * DAY_MS;
        if (day < from || day >= now.at || !(close > 0)) continue;
        t.push(day);
        value.push(worth(sats, close));
    }
    t.push(now.at);
    value.push(worth(sats, now.price));
    return { t, value };
}
