import { SATS_PER_BTC } from './convert.ts';

export const FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const;

export type Frequency = (typeof FREQUENCIES)[number];

const DAY_MS = 86_400_000;

const STEP_DAYS: Record<Exclude<Frequency, 'monthly'>, number> = { weekly: 7, fortnightly: 14 };

export interface DailyCloses {
    start: string;
    closes: readonly number[];
}

export interface DcaInput {
    amount: number;
    frequency: Frequency;
    start: string;
    feePercent: number;
}

export interface DayValue {
    day: string;
    value: number;
}

export interface DcaPoint {
    invested: number;
    value: number;
    lumpValue: number;
}

export interface DcaResult {
    amount: number;
    frequency: Frequency;
    feePercent: number;
    requestedStart: string;
    start: string;
    clamped: boolean;
    end: string;
    lastBuy: string;
    buys: number;
    invested: number;
    fees: number;
    sats: number;
    priceNow: number;
    valueNow: number;
    averageCost: number;
    drawdown: number;
    fall: { peak: DayValue; trough: DayValue } | null;
    lumpSum: { sats: number; price: number; valueNow: number };
    points: DcaPoint[];
}

export type DcaOutcome =
    | { ok: true; result: DcaResult }
    | { ok: false; reason: 'amount' | 'fee' | 'date' | 'after-data' };

export function dayNumber(day: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return null;
    const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Date(ms).toISOString().slice(0, 10) === day ? ms / DAY_MS : null;
}

export function dayString(number: number): string {
    return new Date(number * DAY_MS).toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function buyDays(frequency: Frequency, first: number, last: number): number[] {
    const days: number[] = [];
    if (frequency !== 'monthly') {
        for (let day = first; day <= last; day += STEP_DAYS[frequency]) days.push(day);
        return days;
    }
    const start = new Date(first * DAY_MS);
    const anchor = start.getUTCDate();
    for (let i = 0; ; i += 1) {
        const year = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + i) / 12);
        const month = (start.getUTCMonth() + i) % 12;
        const day = Date.UTC(year, month, Math.min(anchor, daysInMonth(year, month))) / DAY_MS;
        if (day > last) return days;
        days.push(day);
    }
}

function satsFor(spend: number, price: number): number {
    return Math.round((spend * SATS_PER_BTC) / price);
}

export function dca(input: DcaInput, data: DailyCloses): DcaOutcome {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, reason: 'amount' };
    if (!Number.isFinite(input.feePercent) || input.feePercent < 0 || input.feePercent >= 100) {
        return { ok: false, reason: 'fee' };
    }
    const requested = dayNumber(input.start);
    const dataStart = dayNumber(data.start);
    if (requested === null || dataStart === null) return { ok: false, reason: 'date' };
    const lastIndex = data.closes.length - 1;
    const first = Math.max(requested, dataStart);
    if (first > dataStart + lastIndex) return { ok: false, reason: 'after-data' };

    const close = (day: number) => data.closes[day - dataStart] as number;
    const keep = 1 - input.feePercent / 100;
    const schedule = buyDays(input.frequency, first, dataStart + lastIndex);
    const points: DcaPoint[] = [];
    let sats = 0;
    let buys = 0;
    let next = 0;
    let peak: DayValue | null = null;
    let fall: { peak: DayValue; trough: DayValue } | null = null;
    let drawdown = 0;

    for (let day = first; day <= dataStart + lastIndex; day += 1) {
        const price = close(day);
        if (schedule[next] === day) {
            sats += satsFor(input.amount * keep, price);
            buys += 1;
            next += 1;
        }
        const value = (sats * price) / SATS_PER_BTC;
        points.push({ invested: buys * input.amount, value, lumpValue: 0 });
        if (!peak || value >= peak.value) {
            peak = { day: dayString(day), value };
        } else if (1 - value / peak.value > drawdown) {
            drawdown = 1 - value / peak.value;
            fall = { peak, trough: { day: dayString(day), value } };
        }
    }

    const invested = buys * input.amount;
    const priceNow = close(dataStart + lastIndex);
    const startPrice = close(first);
    const lumpSats = satsFor(invested * keep, startPrice);
    points.forEach((point, i) => {
        point.lumpValue = (lumpSats * close(first + i)) / SATS_PER_BTC;
    });

    return {
        ok: true,
        result: {
            amount: input.amount,
            frequency: input.frequency,
            feePercent: input.feePercent,
            requestedStart: input.start,
            start: dayString(first),
            clamped: first > requested,
            end: dayString(dataStart + lastIndex),
            lastBuy: dayString(schedule.at(-1) ?? first),
            buys,
            invested,
            fees: invested * (1 - keep),
            sats,
            priceNow,
            valueNow: (sats * priceNow) / SATS_PER_BTC,
            averageCost: sats > 0 ? (invested * SATS_PER_BTC) / sats : 0,
            drawdown,
            fall,
            lumpSum: { sats: lumpSats, price: startPrice, valueNow: (lumpSats * priceNow) / SATS_PER_BTC },
            points,
        },
    };
}
