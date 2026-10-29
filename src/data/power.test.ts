import { describe, expect, it } from 'vitest';
import { POWER_SERIES } from './power.ts';

const ALL = Object.entries(POWER_SERIES).flatMap(([currency, { cpi, prices }]) => [
    [`${currency} CPI`, cpi] as const,
    [`${currency} prices`, prices] as const,
]);

describe('bundled power data', () => {
    for (const [name, data] of ALL) {
        it(`${name} names its source and holds only real monthly values`, () => {
            expect(data.source).not.toBe('');
            expect(data.url).toMatch(/^https:\/\//);
            expect(data.licence).not.toBe('');
            expect(data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const months = Object.keys(data.months);
            expect(months.length).toBeGreaterThan(100);
            expect(months).toEqual([...months].sort());
            for (const [month, value] of Object.entries(data.months)) {
                expect(month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
                expect(value).toBeGreaterThan(0);
            }
        });
    }

    it('prices cover the same months in both currencies', () => {
        expect(Object.keys(POWER_SERIES.GBP.prices.months)).toEqual(Object.keys(POWER_SERIES.USD.prices.months));
    });

    it('starts in July 2010, when the daily reference price begins', () => {
        expect(Object.keys(POWER_SERIES.USD.prices.months)[0]).toBe('2010-07');
    });
});
