import { latestMonth, type MonthlyValues } from './power.ts';

export interface MeltResult {
    amount: number;
    year: number;
    /** The share of its buying power the money still has, 1 = all of it. */
    kept: number;
    /** What the amount buys today, in the prices of the chosen year. */
    buysNow: number;
    /** The newest month of the price index. */
    latest: string;
}

export type MeltOutcome = { ok: true; result: MeltResult } | { ok: false; reason: 'amount' | 'no-data' };

/** The average of a year's monthly index values; null when the year has no months. */
export function yearAverage(index: MonthlyValues, year: number): number | null {
    const values = Object.entries(index)
        .filter(([month, value]) => month.startsWith(`${year}-`) && value > 0)
        .map(([, value]) => value);
    return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The years that have index values, oldest first, without the newest month's own year. */
export function meltYears(index: MonthlyValues): number[] {
    const last = Number(latestMonth(index).slice(0, 4));
    const years = new Set(Object.keys(index).map((month) => Number(month.slice(0, 4))));
    return [...years].filter((year) => year < last).sort((a, b) => a - b);
}

/** What money held since a year still buys: that year's average price level over the newest month's. */
export function melt(amount: number, year: number, index: MonthlyValues): MeltOutcome {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'amount' };
    const then = yearAverage(index, year);
    const latest = latestMonth(index);
    const now = index[latest];
    if (then === null || now === undefined || !(now > 0)) return { ok: false, reason: 'no-data' };
    const kept = then / now;
    return { ok: true, result: { amount, year, kept, buysNow: amount * kept, latest } };
}
