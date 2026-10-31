import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createHeightFeed,
    estimateTip,
    fetchTip,
    HEIGHT_ANCHOR,
    parseBlockTime,
    parseHeight,
    type Tip,
    type TipChange,
} from './height.ts';

const ANCHOR_MS = HEIGHT_ANCHOR.time * 1000;
const AHEAD = HEIGHT_ANCHOR.height + 46;

interface FakeChain {
    height: number;
    down: Set<string>;
    calls: string[];
}

function fakeFetch(chain: FakeChain) {
    return vi.fn(async (url: string) => {
        chain.calls.push(url);
        const host = new URL(url).hostname;
        if (chain.down.has(host)) throw new TypeError('Failed to fetch');
        if (url.endsWith('/blocks/tip/height')) return new Response(String(chain.height));
        const height = Number(url.split('/').at(-1));
        return Response.json([{ height, timestamp: HEIGHT_ANCHOR.time + (height - HEIGHT_ANCHOR.height) * 600 }]);
    });
}

describe('estimateTip', () => {
    it('adds one block per 600 seconds after the anchor', () => {
        expect(estimateTip(ANCHOR_MS)).toEqual(HEIGHT_ANCHOR);
        expect(estimateTip(ANCHOR_MS + 599_000).height).toBe(HEIGHT_ANCHOR.height);
        expect(estimateTip(ANCHOR_MS + 3_600_000)).toEqual({
            height: HEIGHT_ANCHOR.height + 6,
            time: HEIGHT_ANCHOR.time + 3_600,
        });
    });

    it('never goes below the anchor when the clock is behind', () => {
        expect(estimateTip(0)).toEqual(HEIGHT_ANCHOR);
    });
});

describe('parsing', () => {
    it('accepts a plain height at or above the anchor', () => {
        expect(parseHeight(`${AHEAD}\n`)).toBe(AHEAD);
        expect(parseHeight('12')).toBeNull();
        expect(parseHeight(`${AHEAD}.5`)).toBeNull();
        expect(parseHeight('<html>')).toBeNull();
    });

    it('reads the timestamp of the matching block only', () => {
        const blocks = [
            { height: AHEAD + 1, timestamp: 1_793_400_000 },
            { height: AHEAD, timestamp: 1_793_399_000 },
        ];
        expect(parseBlockTime(blocks, AHEAD)).toBe(1_793_399_000);
        expect(parseBlockTime(blocks, AHEAD + 2)).toBeNull();
        expect(parseBlockTime({ height: AHEAD }, AHEAD)).toBeNull();
        expect(parseBlockTime([{ height: AHEAD, timestamp: 'soon' }], AHEAD)).toBeNull();
    });
});

describe('fetchTip', () => {
    it('asks mempool.space first, then the block for its time', async () => {
        const chain = { height: AHEAD, down: new Set<string>(), calls: [] };
        const tip = await fetchTip(fakeFetch(chain), null);
        expect(tip).toEqual({ height: AHEAD, time: HEIGHT_ANCHOR.time + 46 * 600, api: 'mempool.space' });
        expect(chain.calls).toEqual([
            'https://mempool.space/api/blocks/tip/height',
            `https://mempool.space/api/blocks/${AHEAD}`,
        ]);
    });

    it('falls back to blockstream.info when mempool.space fails', async () => {
        const chain = { height: AHEAD, down: new Set(['mempool.space']), calls: [] };
        const tip = await fetchTip(fakeFetch(chain), null);
        expect(tip.api).toBe('blockstream.info');
        expect(tip.height).toBe(AHEAD);
    });

    it('skips the block request when the height has not moved', async () => {
        const chain = { height: AHEAD, down: new Set<string>(), calls: [] };
        await fetchTip(fakeFetch(chain), { height: AHEAD, time: 42 });
        expect(chain.calls).toEqual(['https://mempool.space/api/blocks/tip/height']);
    });

    it('throws when every API fails', async () => {
        const chain = { height: AHEAD, down: new Set(['mempool.space', 'blockstream.info']), calls: [] };
        await expect(fetchTip(fakeFetch(chain), null)).rejects.toThrow();
    });
});

describe('createHeightFeed', () => {
    let chain: FakeChain;
    let online: boolean;
    let seen: [Tip, TipChange][];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(ANCHOR_MS + 600_000 * 10);
        chain = { height: HEIGHT_ANCHOR.height + 8, down: new Set(), calls: [] };
        online = true;
        seen = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function feed() {
        const created = createHeightFeed({
            fetch: fakeFetch(chain),
            now: () => Date.now(),
            isOnline: () => online,
            pollMs: 45_000,
        });
        created.subscribe((tip, change) => seen.push([tip, change]));
        return created;
    }

    it('starts from the offline estimate, labelled as checking, without fetching', async () => {
        const heights = feed();
        expect(heights.tip).toMatchObject({ height: HEIGHT_ANCHOR.height + 10, source: 'checking' });
        await vi.advanceTimersByTimeAsync(120_000);
        expect(chain.calls).toEqual([]);
    });

    it('replaces the estimate with the live tip without calling it a new block', async () => {
        const heights = feed();
        heights.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(seen).toHaveLength(1);
        expect(seen[0]?.[0]).toMatchObject({ height: HEIGHT_ANCHOR.height + 8, source: 'live', api: 'mempool.space' });
        expect(seen[0]?.[1]).toEqual({ blocks: 0 });
    });

    it('reports a new block within one poll, once', async () => {
        const owner = {};
        const heights = feed();
        heights.setActive(owner, true);
        await vi.advanceTimersByTimeAsync(0);
        chain.height += 1;
        await vi.advanceTimersByTimeAsync(45_000);
        await vi.advanceTimersByTimeAsync(45_000);
        expect(seen.map(([tip, change]) => [tip.height, change.blocks])).toEqual([
            [HEIGHT_ANCHOR.height + 8, 0],
            [HEIGHT_ANCHOR.height + 9, 1],
            [HEIGHT_ANCHOR.height + 9, 0],
        ]);
    });

    it('stops polling while inactive and counts missed blocks once on return', async () => {
        const owner = {};
        const heights = feed();
        heights.setActive(owner, true);
        await vi.advanceTimersByTimeAsync(0);
        heights.setActive(owner, false);
        chain.height += 3;
        await vi.advanceTimersByTimeAsync(30 * 60_000);
        expect(seen).toHaveLength(1);

        heights.setActive(owner, true);
        heights.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(seen.map(([, change]) => change.blocks)).toEqual([0, 3]);
        expect(heights.tip.height).toBe(HEIGHT_ANCHOR.height + 11);
    });

    it('falls back to a labelled estimate when every API is unreachable', async () => {
        chain.down = new Set(['mempool.space', 'blockstream.info']);
        const heights = feed();
        heights.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(heights.tip).toMatchObject({ height: HEIGHT_ANCHOR.height + 10, source: 'offline', api: null });
    });

    it('does not fetch at all when the browser says it is offline', async () => {
        online = false;
        const heights = feed();
        heights.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(chain.calls).toEqual([]);
        expect(heights.tip.source).toBe('offline');
    });

    it('never moves backwards when going offline after a higher live tip', async () => {
        chain.height = HEIGHT_ANCHOR.height + 14;
        const heights = feed();
        heights.setActive({}, true);
        await vi.advanceTimersByTimeAsync(0);
        online = false;
        await vi.advanceTimersByTimeAsync(45_000);
        expect(heights.tip).toMatchObject({ height: HEIGHT_ANCHOR.height + 14, source: 'offline' });
    });
});
