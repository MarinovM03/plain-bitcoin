import { describe, expect, it } from 'vitest';
import { LAST_CLOSE, type PriceQuote } from '../data/price.ts';
import { statusView } from './status.ts';

const LIVE: PriceQuote = {
    value: { gbp: 57_329, usd: 76_777 },
    source: 'mempool.space',
    asOf: Date.UTC(2026, 9, 30, 19, 20),
    stale: false,
};

describe('statusView', () => {
    it('shows a live block and price with thousands separators and the source clock', () => {
        expect(statusView({ height: 921_034, source: 'live' }, LIVE, false)).toEqual({
            block: 'Block 921,034',
            gbp: '£57,329',
            usd: '$76,777',
            source: 'mempool.space 19:20 UTC',
            live: true,
        });
    });

    it('labels an estimated height once', () => {
        for (const source of ['checking', 'offline'] as const) {
            const view = statusView({ height: 921_034, source }, LIVE, false);
            expect(view.block).toBe('Block 921,034 est.');
            expect(view.live).toBe(false);
        }
    });

    it('says when a price is no longer live', () => {
        expect(statusView({ height: 1, source: 'live' }, LIVE, true).source).toBe('mempool.space 19:20 UTC, not live');
        expect(statusView({ height: 1, source: 'live' }, { ...LIVE, stale: true }, false)).toMatchObject({
            source: 'mempool.space 19:20 UTC, not live',
            live: false,
        });
    });

    it('names the bundled last close when no live price has answered', () => {
        const view = statusView({ height: 1, source: 'live' }, LAST_CLOSE, false);
        expect(view.source).toMatch(/^last close \d{1,2} [A-Z][a-z]{2} \d{4}$/);
        expect(view.live).toBe(false);
    });
});
