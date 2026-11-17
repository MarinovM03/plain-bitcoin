import { describe, expect, it } from 'vitest';
import { melt, meltYears, yearAverage } from './melt.ts';

const INDEX = { '2010-01': 100, '2010-07': 102, '2020-06': 150, '2026-03': 200 };

describe('melt', () => {
    it('averages a year and compares it with the newest month', () => {
        expect(yearAverage(INDEX, 2010)).toBe(101);
        const outcome = melt(100, 2010, INDEX);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.kept).toBeCloseTo(0.505);
        expect(outcome.result.buysNow).toBeCloseTo(50.5);
        expect(outcome.result.latest).toBe('2026-03');
    });

    it('lists the years with data, without the newest year', () => {
        expect(meltYears(INDEX)).toEqual([2010, 2020]);
    });

    it('refuses a missing year or an impossible amount', () => {
        expect(melt(100, 1990, INDEX)).toEqual({ ok: false, reason: 'no-data' });
        expect(melt(0, 2010, INDEX)).toEqual({ ok: false, reason: 'amount' });
        expect(melt(Number.NaN, 2010, INDEX)).toEqual({ ok: false, reason: 'amount' });
    });
});
