import { describe, expect, it } from 'vitest';
import { buyDays, type DailyCloses, type DcaInput, type DcaResult, dayNumber, dayString, dca } from './dca.ts';

function series(start: string, closes: number[]): DailyCloses {
    return { start, closes };
}

function days(count: number, price: (i: number) => number): number[] {
    return Array.from({ length: count }, (_, i) => price(i));
}

function solve(input: Partial<DcaInput>, data: DailyCloses): DcaResult {
    const outcome = dca({ amount: 100, frequency: 'weekly', start: data.start, feePercent: 0, ...input }, data);
    if (!outcome.ok) throw new Error(`expected a result, got ${outcome.reason}`);
    return outcome.result;
}

describe('days', () => {
    it('reads UTC calendar days only', () => {
        expect(dayString(dayNumber('2020-02-29') ?? 0)).toBe('2020-02-29');
        expect(dayNumber('2021-02-29')).toBeNull();
        expect(dayNumber('2020-1-1')).toBeNull();
    });

    it('buys every 7 or 14 days, or on the same day each month clamped to its end', () => {
        const first = dayNumber('2020-01-31') ?? 0;
        const last = dayNumber('2020-05-31') ?? 0;
        expect(buyDays('monthly', first, last).map(dayString)).toEqual([
            '2020-01-31',
            '2020-02-29',
            '2020-03-31',
            '2020-04-30',
            '2020-05-31',
        ]);
        expect(buyDays('weekly', first, first + 20).map((day) => day - first)).toEqual([0, 7, 14]);
        expect(buyDays('fortnightly', first, first + 28).map((day) => day - first)).toEqual([0, 14, 28]);
        expect(buyDays('monthly', dayNumber('2020-12-15') ?? 0, dayNumber('2021-02-15') ?? 0).map(dayString)).toEqual([
            '2020-12-15',
            '2021-01-15',
            '2021-02-15',
        ]);
    });
});

describe('dca', () => {
    it('at a flat price ends worth what was put in, as does the lump sum', () => {
        const result = solve(
            {},
            series(
                '2020-01-01',
                days(29, () => 10_000),
            ),
        );
        expect(result.buys).toBe(5);
        expect(result.invested).toBe(500);
        expect(result.sats).toBe(5_000_000);
        expect(result.valueNow).toBe(500);
        expect(result.averageCost).toBe(10_000);
        expect(result.lumpSum).toEqual({ sats: 5_000_000, price: 10_000, valueNow: 500 });
        expect(result.drawdown).toBe(0);
        expect(result.fall).toBeNull();
    });

    it('with a rising price, the lump sum on day one beats buying on the way up', () => {
        const result = solve(
            {},
            series(
                '2020-01-01',
                days(15, (i) => 10_000 + i * 1_000),
            ),
        );
        expect(result.buys).toBe(3);
        expect(result.invested).toBe(300);
        expect(result.sats).toBe(1_000_000 + 588_235 + 416_667);
        expect(result.valueNow).toBeCloseTo((2_004_902 * 24_000) / 1e8, 9);
        expect(result.averageCost).toBeCloseTo(300 / 0.02004902, 6);
        expect(result.lumpSum.sats).toBe(3_000_000);
        expect(result.lumpSum.valueNow).toBe(720);
        expect(result.lumpSum.valueNow).toBeGreaterThan(result.valueNow);
    });

    it('with a falling price, buying on the way down beats the lump sum and the fall is recorded', () => {
        const result = solve(
            {},
            series(
                '2020-01-01',
                days(15, (i) => 20_000 - i * 1_000),
            ),
        );
        expect(result.buys).toBe(3);
        expect(result.sats).toBe(500_000 + 769_231 + 1_666_667);
        expect(result.lumpSum.sats).toBe(1_500_000);
        expect(result.valueNow).toBeGreaterThan(result.lumpSum.valueNow);
        expect(result.fall?.peak.day).toBe('2020-01-08');
        expect(result.fall?.trough.day).toBe('2020-01-14');
        expect(result.drawdown).toBeCloseTo(1 - 7_000 / 13_000, 10);
    });

    it('counts the worst fall from a high to a later low', () => {
        const closes = [100, 200, 50, 300, 150, 300];
        const result = solve({ frequency: 'monthly' }, series('2020-01-01', closes));
        expect(result.buys).toBe(1);
        expect(result.drawdown).toBeCloseTo(0.75, 10);
        expect(result.fall).toEqual({
            peak: { day: '2020-01-02', value: 200 },
            trough: { day: '2020-01-03', value: 50 },
        });
    });

    it('clamps a start before the data to its first day and says so', () => {
        const result = solve(
            { start: '2010-07-01' },
            series(
                '2010-07-18',
                days(14, () => 0.05),
            ),
        );
        expect(result.clamped).toBe(true);
        expect(result.requestedStart).toBe('2010-07-01');
        expect(result.start).toBe('2010-07-18');
        expect(result.buys).toBe(2);
        expect(result.points).toHaveLength(14);
    });

    it('counts actual buys, not the total divided by the amount', () => {
        const result = solve(
            { amount: 33.33, frequency: 'fortnightly' },
            series(
                '2020-01-01',
                days(366, () => 7),
            ),
        );
        expect(result.buys).toBe(27);
        expect(result.lastBuy).toBe('2020-12-30');
        expect(result.invested).toBeCloseTo(899.91, 9);
    });

    it('takes a fee from each buy and from the lump sum alike', () => {
        const result = solve(
            { feePercent: 1.5 },
            series(
                '2020-01-01',
                days(8, () => 10_000),
            ),
        );
        expect(result.buys).toBe(2);
        expect(result.invested).toBe(200);
        expect(result.fees).toBeCloseTo(3, 10);
        expect(result.sats).toBe(2 * 985_000);
        expect(result.lumpSum.sats).toBe(1_970_000);
        expect(result.averageCost).toBeCloseTo(200 / 0.0197, 6);
    });

    it('tracks invested, value and the lump sum day by day for the chart', () => {
        const result = solve(
            {},
            series(
                '2020-01-01',
                days(8, (i) => (i < 4 ? 100 : 200)),
            ),
        );
        expect(result.points.map((point) => point.invested)).toEqual([100, 100, 100, 100, 100, 100, 100, 200]);
        expect(result.points[0]).toEqual({ invested: 100, value: 100, lumpValue: 200 });
        expect(result.points[7]).toEqual({ invested: 200, value: 300, lumpValue: 400 });
    });

    it('refuses no amount, a fee of 100% or more, and a start after the data', () => {
        const data = series(
            '2020-01-01',
            days(10, () => 1),
        );
        const input: DcaInput = { amount: 0, frequency: 'weekly', start: '2020-01-01', feePercent: 0 };
        expect(dca(input, data)).toEqual({ ok: false, reason: 'amount' });
        expect(dca({ ...input, amount: 50, feePercent: 100 }, data)).toEqual({ ok: false, reason: 'fee' });
        expect(dca({ ...input, amount: 50, feePercent: Number.NaN }, data)).toEqual({ ok: false, reason: 'fee' });
        expect(dca({ ...input, amount: 50, start: '2020-02-01' }, data)).toEqual({ ok: false, reason: 'after-data' });
        expect(dca({ ...input, amount: 50, start: 'soon' }, data)).toEqual({ ok: false, reason: 'date' });
    });
});
