import { describe, expect, it } from 'vitest';
import { type PowerData, type PowerResult, purchasingPower, worstStart } from './power.ts';

function solve(amount: number, start: string, data: PowerData): PowerResult {
    const outcome = purchasingPower(amount, start, data);
    if (!outcome.ok) throw new Error(`expected a result, got ${outcome.reason}`);
    return outcome.result;
}

const FLAT_CPI = { '2020-01': 100, '2020-02': 100, '2020-03': 100, '2020-04': 100 };
const RISING_CPI = { '2020-01': 100, '2020-02': 105, '2020-03': 110, '2020-04': 125 };

const CRASH_CLOSES = {
    '2020-01': 100,
    '2020-02': 200,
    '2020-03': 60,
    '2020-04': 150,
};

describe('purchasingPower', () => {
    it('leaves money unchanged when CPI is flat', () => {
        const result = solve(1000, '2020-01', { cpi: FLAT_CPI, closes: CRASH_CLOSES });
        expect(result.equivalentNow).toBe(1000);
        expect(result.cashBuysNow).toBe(1000);
    });

    it('scales both ways with rising CPI', () => {
        const result = solve(1000, '2020-01', { cpi: RISING_CPI, closes: CRASH_CLOSES });
        expect(result.equivalentNow).toBeCloseTo(1250, 10);
        expect(result.cashBuysNow).toBeCloseTo(800, 10);
    });

    it('values bitcoin bought at the start close in nominal and real money', () => {
        const result = solve(1000, '2020-01', { cpi: RISING_CPI, closes: CRASH_CLOSES });
        expect(result.btc).toBe(10);
        expect(result.btcValueNow).toBe(1500);
        expect(result.btcRealNow).toBeCloseTo(1200, 10);
        expect(result.priceMonth).toBe('2020-04');
        expect(result.cpiMonth).toBe('2020-04');
    });

    it('measures a 70% drawdown from the peak, the worst month and months below the start', () => {
        const result = solve(1000, '2020-01', { cpi: FLAT_CPI, closes: CRASH_CLOSES });
        expect(result.path.map((point) => point.month)).toEqual(['2020-02', '2020-03', '2020-04']);
        expect(result.maxDrawdown).toBeCloseTo(0.7, 10);
        expect(result.fall).toEqual({
            peak: { month: '2020-02', value: 2000 },
            trough: { month: '2020-03', value: 600 },
        });
        expect(result.worst).toEqual({ month: '2020-03', value: 600 });
        expect(result.monthsBelow).toBe(1);
    });

    it('keeps the biggest fall apart from the lowest month-end when they differ', () => {
        const closes = { '2020-01': 100, '2020-02': 90, '2020-03': 1000, '2020-04': 400 };
        const result = solve(1000, '2020-01', { cpi: FLAT_CPI, closes });
        expect(result.maxDrawdown).toBeCloseTo(0.6, 10);
        expect(result.fall?.peak.month).toBe('2020-03');
        expect(result.fall?.trough.month).toBe('2020-04');
        expect(result.worst).toEqual({ month: '2020-02', value: 900 });
    });

    it('counts a fall straight after the start against the starting amount', () => {
        const result = solve(100, '2020-02', { cpi: FLAT_CPI, closes: CRASH_CLOSES });
        expect(result.maxDrawdown).toBeCloseTo(0.7, 10);
        expect(result.fall?.peak).toEqual({ month: '2020-02', value: 100 });
        expect(result.monthsBelow).toBe(2);
    });

    it('handles a start at the latest month with an empty path', () => {
        const result = solve(1000, '2020-04', { cpi: RISING_CPI, closes: CRASH_CLOSES });
        expect(result.equivalentNow).toBe(1000);
        expect(result.btcValueNow).toBe(1000);
        expect(result.path).toEqual([]);
        expect(result.maxDrawdown).toBe(0);
        expect(result.fall).toBeNull();
        expect(result.worst).toBeNull();
        expect(result.monthsBelow).toBe(0);
    });

    it('uses the latest CPI month when recent CPI is not published yet', () => {
        const cpi = { '2020-01': 100, '2020-02': 110 };
        const result = solve(1000, '2020-04', { cpi, closes: CRASH_CLOSES });
        expect(result.cpiMonth).toBe('2020-02');
        expect(result.equivalentNow).toBe(1000);
        expect(solve(1000, '2020-01', { cpi, closes: CRASH_CLOSES }).equivalentNow).toBeCloseTo(1100, 10);
    });

    it('treats a missing CPI month as a gap, not an interpolation', () => {
        const cpi = { '2020-01': 100, '2020-03': 110, '2020-04': 120 };
        expect(purchasingPower(1000, '2020-02', { cpi, closes: CRASH_CLOSES })).toEqual({
            ok: false,
            reason: 'no-cpi',
            month: '2020-02',
        });
    });

    it('skips missing price months in the path and refuses a start without a close', () => {
        const closes = { '2020-01': 100, '2020-03': 50, '2020-04': 120 };
        const result = solve(1000, '2020-01', { cpi: FLAT_CPI, closes });
        expect(result.path.map((point) => point.month)).toEqual(['2020-03', '2020-04']);
        expect(purchasingPower(1000, '2020-02', { cpi: FLAT_CPI, closes })).toMatchObject({ reason: 'no-price' });
    });

    it('rejects an empty or non-positive amount', () => {
        for (const amount of [0, -5, Number.NaN]) {
            expect(purchasingPower(amount, '2020-01', { cpi: FLAT_CPI, closes: CRASH_CLOSES })).toMatchObject({
                ok: false,
                reason: 'amount',
            });
        }
    });
});

describe('worstStart', () => {
    it('finds the start month with the worst real bitcoin result', () => {
        expect(worstStart({ cpi: FLAT_CPI, closes: CRASH_CLOSES })).toBe('2020-02');
    });

    it('lets inflation decide between equal nominal results', () => {
        const closes = { '2020-01': 100, '2020-02': 100, '2020-03': 50, '2020-04': 100 };
        expect(worstStart({ cpi: RISING_CPI, closes })).toBe('2020-01');
    });

    it('never picks the latest month or a month without CPI', () => {
        const cpi = { '2020-01': 100, '2020-03': 100, '2020-04': 100 };
        expect(worstStart({ cpi, closes: CRASH_CLOSES })).toBe('2020-01');
    });
});
