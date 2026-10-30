import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPriceFeed, fetchQuote, LAST_CLOSE, PRICE_APIS, type PriceQuote, parseQuote } from './price.ts';
import dailyGbp from './prices/daily-gbp.json';
import dailyUsd from './prices/daily-usd.json';
import latest from './prices/latest.json';

const NOW = Date.UTC(2026, 9, 30, 19, 20);

interface FakeApis {
    down: Set<string>;
    calls: string[];
}

function fakeFetch(apis: FakeApis) {
    return vi.fn(async (url: string) => {
        apis.calls.push(url);
        const host = new URL(url).hostname;
        if (apis.down.has(host)) throw new TypeError('Failed to fetch');
        if (host === 'mempool.space') return Response.json({ time: NOW / 1000 - 30, USD: 76_777, GBP: 57_329 });
        return Response.json({ bitcoin: { gbp: 57_384, usd: 76_872, last_updated_at: NOW / 1000 - 60 } });
    });
}

describe('bundled closes', () => {
    it('cover the same days in both currencies, and the latest close is their last day', () => {
        expect(dailyGbp.start).toBe(dailyUsd.start);
        expect(dailyGbp.closes).toHaveLength(dailyUsd.closes.length);
        for (const close of [...dailyGbp.closes, ...dailyUsd.closes]) expect(close).toBeGreaterThan(0);
        const last = new Date(Date.parse(`${dailyUsd.start}T00:00:00Z`) + (dailyUsd.closes.length - 1) * 86_400_000);
        expect(latest.day).toBe(last.toISOString().slice(0, 10));
        expect(latest.GBP).toBe(dailyGbp.closes.at(-1));
        expect(latest.USD).toBe(dailyUsd.closes.at(-1));
        expect(LAST_CLOSE).toMatchObject({ source: 'last close', stale: true });
    });
});

describe('parseQuote', () => {
    it('reads both shapes and refuses anything else', () => {
        expect(parseQuote('mempool.space', { time: 1_793_390_411, USD: 76_777, GBP: 57_329 })).toEqual({
            value: { gbp: 57_329, usd: 76_777 },
            asOf: 1_793_390_411_000,
        });
        expect(
            parseQuote('CoinGecko', { bitcoin: { gbp: 57_384, usd: 76_872, last_updated_at: 1_793_390_708 } }),
        ).toEqual({ value: { gbp: 57_384, usd: 76_872 }, asOf: 1_793_390_708_000 });
        expect(parseQuote('mempool.space', { time: 1, USD: 0, GBP: 1 })).toBeNull();
        expect(parseQuote('mempool.space', { time: 1, USD: '76777', GBP: 1 })).toBeNull();
        expect(parseQuote('CoinGecko', { bitcoin: null })).toBeNull();
        expect(parseQuote('CoinGecko', [1, 2])).toBeNull();
    });
});

describe('fetchQuote', () => {
    it('asks mempool.space first', async () => {
        const apis = { down: new Set<string>(), calls: [] };
        const quote = await fetchQuote(fakeFetch(apis), NOW);
        expect(quote).toEqual({
            value: { gbp: 57_329, usd: 76_777 },
            source: 'mempool.space',
            asOf: NOW - 30_000,
            stale: false,
        });
        expect(apis.calls).toEqual([PRICE_APIS[0].url]);
    });

    it('falls back to CoinGecko, and throws when both fail', async () => {
        const apis = { down: new Set(['mempool.space']), calls: [] };
        expect((await fetchQuote(fakeFetch(apis), NOW)).source).toBe('CoinGecko');
        apis.down.add('api.coingecko.com');
        await expect(fetchQuote(fakeFetch(apis), NOW)).rejects.toThrow();
    });

    it('never dates a price in the future', async () => {
        const apis = { down: new Set<string>(), calls: [] };
        expect((await fetchQuote(fakeFetch(apis), NOW - 60_000)).asOf).toBe(NOW - 60_000);
    });

    it('gives up on a slow API after the timeout', async () => {
        vi.useFakeTimers();
        const hang = vi.fn(
            (_url: string, init?: RequestInit) =>
                new Promise<Response>((_, reject) =>
                    init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
                ),
        );
        const quote = fetchQuote(hang, NOW, 6_000);
        const settled = expect(quote).rejects.toThrow('aborted');
        await vi.advanceTimersByTimeAsync(12_000);
        await settled;
        expect(hang).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });
});

describe('createPriceFeed', () => {
    let apis: FakeApis;
    let online: boolean;
    let seen: PriceQuote[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        apis = { down: new Set(), calls: [] };
        online = true;
        seen = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function feed() {
        const created = createPriceFeed({ fetch: fakeFetch(apis), now: () => Date.now(), isOnline: () => online });
        created.subscribe((quote) => seen.push(quote));
        return created;
    }

    it('starts from the last close and fetches nothing until a tool is open', async () => {
        const prices = feed();
        expect(prices.quote).toBe(LAST_CLOSE);
        await vi.advanceTimersByTimeAsync(5 * 60_000);
        expect(apis.calls).toEqual([]);
    });

    it('fetches at once, then at most once a minute while open, and stops when closed', async () => {
        const owner = {};
        const prices = feed();
        prices.setActive(owner, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(prices.quote.source).toBe('mempool.space');
        await vi.advanceTimersByTimeAsync(59_000);
        expect(apis.calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(apis.calls).toHaveLength(2);
        prices.setActive(owner, false);
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        expect(apis.calls).toHaveLength(2);
    });

    it('serves the cache when reopened within a minute', async () => {
        const owner = {};
        const prices = feed();
        prices.setActive(owner, true);
        await vi.advanceTimersByTimeAsync(0);
        prices.setActive(owner, false);
        await vi.advanceTimersByTimeAsync(20_000);
        prices.setActive(owner, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(apis.calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(40_000);
        expect(apis.calls).toHaveLength(2);
    });

    it('keeps the last close, labelled stale, when offline', async () => {
        online = false;
        const prices = feed();
        prices.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(apis.calls).toEqual([]);
        expect(prices.quote).toBe(LAST_CLOSE);
    });

    it('keeps a live price through a short outage, then marks it stale', async () => {
        const prices = feed();
        prices.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        apis.down = new Set(['mempool.space', 'api.coingecko.com']);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(prices.quote).toMatchObject({ source: 'mempool.space', stale: false });
        await vi.advanceTimersByTimeAsync(5 * 60_000);
        expect(prices.quote).toMatchObject({ source: 'mempool.space', stale: true });
        expect(seen.at(-1)?.stale).toBe(true);
    });
});
