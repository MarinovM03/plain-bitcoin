import { describe, expect, it } from 'vitest';
import { baseline, change, keep, parseHolding, VISIT_GAP_MS, valueSeries, visited } from './holding.ts';

const mark = (at: number, usd = 100_000) => ({ at, usd, gbp: usd * 0.8 });

describe('holding', () => {
    it('reads back only a well-formed holding, and nothing that was tampered with', () => {
        const held = keep(5_000, 'GBP', mark(1_000), 1_000);
        expect(parseHolding(JSON.parse(JSON.stringify(held)))).toEqual(held);
        expect(parseHolding({ ...held, sats: -1 })).toBeNull();
        expect(parseHolding({ ...held, sats: 1.5 })).toBeNull();
        expect(parseHolding({ ...held, sats: 21_000_000 * 1e8 + 1 })).toBeNull();
        expect(parseHolding({ ...held, visit: { at: 1, usd: 'lots', gbp: 1 } })).toBeNull();
        expect(parseHolding({ ...held, previous: {} })).toBeNull();
        expect(parseHolding({ ...held, fiat: 'XYZ' })?.fiat).toBe('USD');
        expect(parseHolding('0.5')).toBeNull();
        expect(parseHolding(null)).toBeNull();
    });

    it('starts a new visit only once the last one is an hour old', () => {
        const held = keep(1, 'USD', mark(0), 0);
        expect(visited(held, mark(VISIT_GAP_MS - 1, 90_000))).toBe(held);
        const later = visited(held, mark(VISIT_GAP_MS, 90_000));
        expect(later.previous).toEqual(mark(0));
        expect(later.visit).toEqual(mark(VISIT_GAP_MS, 90_000));
        expect(baseline(held)).toEqual({ mark: mark(0), since: 'saved' });
        expect(baseline(later)).toEqual({ mark: mark(0), since: 'visit' });
    });

    it('prices the same coins at two prices', () => {
        expect(change(50_000_000, 80_000, 100_000)).toEqual({ money: 10_000, fraction: 0.25 });
        expect(change(1, 0, 100).fraction).toBe(0);
    });

    it('draws the last days of closes as worth and ends on the price now', () => {
        const closes = { start: '2026-01-01', closes: [100, 0, 300, 400, 500] };
        const now = { at: Date.UTC(2026, 0, 4, 12), price: 1_000 };
        const series = valueSeries(100_000_000, closes, 2, now);
        expect(series.t).toEqual([Date.UTC(2026, 0, 3), Date.UTC(2026, 0, 4), now.at]);
        expect(series.value).toEqual([300, 400, 1_000]);
    });
});
