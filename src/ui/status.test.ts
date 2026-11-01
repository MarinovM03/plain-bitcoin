import { describe, expect, it } from 'vitest';
import { LAST_CLOSE, type PriceQuote } from '../data/price.ts';
import { blockAge, chainState, statusView } from './status.ts';

const NOW = Date.UTC(2026, 9, 30, 19, 26);
const LIVE: PriceQuote = {
    value: { gbp: 57_329, usd: 76_777 },
    source: 'mempool.space',
    asOf: Date.UTC(2026, 9, 30, 19, 20),
    stale: false,
};
const TIME = NOW / 1000 - 372;

describe('statusView', () => {
    it('shows a live block, price, time since the block and the source clock', () => {
        expect(statusView({ height: 921_034, source: 'live', time: TIME }, LIVE, false, NOW)).toEqual({
            block: 'Block 921,034',
            gbp: '£57,329',
            usd: '$76,777',
            age: '6 min since block',
            source: 'mempool.space 19:20 UTC',
            sourceUrl: 'https://mempool.space/',
            live: true,
        });
    });

    it('labels an estimated height and its time once', () => {
        for (const source of ['checking', 'offline'] as const) {
            const view = statusView({ height: 921_034, source, time: TIME }, LIVE, false, NOW);
            expect(view.block).toBe('Block 921,034 est.');
            expect(view.age).toBe('est. 6 min since block');
            expect(view.live).toBe(false);
        }
    });

    it('says when a price is no longer live', () => {
        const tip = { height: 1, source: 'live', time: TIME } as const;
        expect(statusView(tip, LIVE, true, NOW).source).toBe('mempool.space 19:20 UTC, not live');
        expect(statusView(tip, { ...LIVE, stale: true }, false, NOW)).toMatchObject({
            source: 'mempool.space 19:20 UTC, not live',
            live: false,
        });
    });

    it('names and links the bundled last close when no live price has answered', () => {
        const view = statusView({ height: 1, source: 'live', time: TIME }, LAST_CLOSE, false, NOW);
        expect(view.source).toMatch(/^last close \d{1,2} [A-Z][a-z]{2} \d{4}$/);
        expect(view.sourceUrl).toMatch(/^https:\/\//);
        expect(view.live).toBe(false);
    });
});

describe('blockAge', () => {
    it('says when the block time is unknown instead of guessing', () => {
        expect(blockAge({ source: 'live', time: null }, NOW)).toBe('block time unknown');
        expect(blockAge({ source: 'live', time: NOW / 1000 - 20 }, NOW)).toBe('<1 min since block');
    });
});

describe('chainState', () => {
    it('hands the stage the height, the block time in ms and whether it is an estimate', () => {
        expect(chainState({ height: 5, source: 'live', time: 100 })).toEqual({
            height: 5,
            blockTime: 100_000,
            estimated: false,
        });
        expect(chainState({ height: 5, source: 'offline', time: null })).toEqual({
            height: 5,
            blockTime: null,
            estimated: true,
        });
    });
});
