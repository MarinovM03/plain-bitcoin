import { describe, expect, it } from 'vitest';
import { clampMonth, monthLabel, monthsIn, monthValue, parseMonth, yearsBetween } from './month.ts';

const MIN = { year: 2010, month: 7 };
const MAX = { year: 2026, month: 9 };

describe('parseMonth and monthValue', () => {
    it('round-trips a YYYY-MM value', () => {
        expect(parseMonth('2015-03')).toEqual({ year: 2015, month: 3 });
        expect(monthValue({ year: 2015, month: 3 })).toBe('2015-03');
    });

    it('rejects anything else', () => {
        for (const value of ['', '2015-3', '2015-00', '2015-13', '15-03', '2015-03-01']) {
            expect(parseMonth(value)).toBeNull();
        }
    });
});

describe('clampMonth', () => {
    it('keeps a month inside the range', () => {
        expect(clampMonth({ year: 2009, month: 1 }, MIN, MAX)).toEqual(MIN);
        expect(clampMonth({ year: 2010, month: 6 }, MIN, MAX)).toEqual(MIN);
        expect(clampMonth({ year: 2026, month: 10 }, MIN, MAX)).toEqual(MAX);
        expect(clampMonth({ year: 2015, month: 1 }, MIN, MAX)).toEqual({ year: 2015, month: 1 });
    });
});

describe('yearsBetween and monthsIn', () => {
    it('lists years newest first', () => {
        const years = yearsBetween(MIN, MAX);
        expect(years[0]).toBe(2026);
        expect(years.at(-1)).toBe(2010);
        expect(years).toHaveLength(17);
    });

    it('only offers months inside the range', () => {
        expect(monthsIn(2010, MIN, MAX)).toEqual([7, 8, 9, 10, 11, 12]);
        expect(monthsIn(2026, MIN, MAX)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(monthsIn(2015, MIN, MAX)).toHaveLength(12);
    });
});

describe('monthLabel', () => {
    it('names the month in English', () => {
        expect(monthLabel(1)).toBe('January');
        expect(monthLabel(12)).toBe('December');
    });
});
