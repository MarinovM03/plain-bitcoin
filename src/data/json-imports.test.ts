import { describe, expect, it } from 'vitest';
import { POWER_SERIES } from './power.ts';

/** The JSON files load through import attributes; these values pin that every file still loads as the same data. */
describe('bundled JSON data loads with import attributes', () => {
    it('loads the four monthly series power.ts imports', () => {
        expect(POWER_SERIES.GBP.cpi.months['2015-01']).toBe(99.3);
        expect(POWER_SERIES.USD.cpi.months['2015-01']).toBe(233.707);
        expect(POWER_SERIES.GBP.prices.months['2015-01']).toBe(144.6374);
        expect(POWER_SERIES.USD.prices.months['2015-01']).toBe(217.33216);
    });

    it('loads the daily GBP closes home.ts imports lazily', async () => {
        const daily = await import('./prices/daily-gbp.json', { with: { type: 'json' } });
        expect(daily.default.start).toBe('2010-07-18');
        expect(daily.default.closes.length).toBeGreaterThan(5000);
    });
});
