import { TARGET_BLOCK_SECONDS } from '../model/supply.ts';
import anchor from './height-anchor.json' with { type: 'json' };

export const HEIGHT_ANCHOR: { readonly height: number; readonly time: number } = {
    height: anchor.height,
    time: anchor.time,
};

export const HEIGHT_APIS = [
    { name: 'mempool.space', base: 'https://mempool.space/api' },
    { name: 'blockstream.info', base: 'https://blockstream.info/api' },
] as const;

export type HeightApi = (typeof HEIGHT_APIS)[number]['name'];

export const POLL_MS = 45_000;
export const TIMEOUT_MS = 6_000;

export const CHAIN_LENGTH = 8;

export type TipSource = 'checking' | 'live' | 'offline';

/** One recent block as the API reports it; a field the API left out or mangled is null, never guessed. */
export interface ChainBlock {
    height: number;
    hash: string | null;
    time: number | null;
    txCount: number | null;
    size: number | null;
    weight: number | null;
}

export interface Tip {
    height: number;
    time: number | null;
    source: TipSource;
    api: HeightApi | null;
    checkedAt: number;
    seenAt: number;
    /** The newest blocks, newest first, as last read from the API; empty until one answer has arrived. */
    blocks: readonly ChainBlock[];
    blocksAt: number | null;
}

export interface TipChange {
    blocks: number;
}

interface BlockAt {
    height: number;
    time: number | null;
    blocks?: readonly ChainBlock[];
}

interface LiveTip extends BlockAt {
    api: HeightApi;
    blocks: readonly ChainBlock[];
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function estimateTip(nowMs: number, anchor: BlockAt & { time: number } = HEIGHT_ANCHOR): BlockAt {
    const blocks = Math.max(0, Math.floor((nowMs / 1000 - anchor.time) / TARGET_BLOCK_SECONDS));
    return { height: anchor.height + blocks, time: anchor.time + blocks * TARGET_BLOCK_SECONDS };
}

export function parseHeight(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d{1,9}$/.test(trimmed)) return null;
    const height = Number(trimmed);
    return height >= HEIGHT_ANCHOR.height ? height : null;
}

export function parseBlockTime(json: unknown, height: number): number | null {
    if (!Array.isArray(json)) return null;
    for (const block of json as unknown[]) {
        if (typeof block !== 'object' || block === null) continue;
        const { height: h, timestamp } = block as { height?: unknown; timestamp?: unknown };
        if (h !== height) continue;
        return typeof timestamp === 'number' && Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null;
    }
    return null;
}

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** The run of blocks from the tip downwards, newest first, stopping at the first height the answer leaves out. */
export function parseBlocks(json: unknown, tip: number, length = CHAIN_LENGTH): ChainBlock[] {
    if (!Array.isArray(json)) return [];
    const byHeight = new Map<number, ChainBlock>();
    for (const entry of json as unknown[]) {
        if (typeof entry !== 'object' || entry === null) continue;
        const raw = entry as Record<string, unknown>;
        const height = raw.height;
        if (typeof height !== 'number' || !Number.isSafeInteger(height) || height < 0 || byHeight.has(height)) continue;
        byHeight.set(height, {
            height,
            hash: typeof raw.id === 'string' && /^[0-9a-f]{64}$/.test(raw.id) ? raw.id : null,
            time: count(raw.timestamp),
            txCount: count(raw.tx_count),
            size: count(raw.size),
            weight: count(raw.weight),
        });
    }
    const blocks: ChainBlock[] = [];
    for (let height = tip; blocks.length < length; height -= 1) {
        const block = byHeight.get(height);
        if (!block) break;
        blocks.push(block);
    }
    return blocks;
}

async function getText(fetchImpl: Fetch, url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, {
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
        return await response.text();
    } finally {
        clearTimeout(timer);
    }
}

interface TipDetail {
    time: number | null;
    blocks: readonly ChainBlock[];
}

// One request answers both: the tip's timestamp and the recent blocks the chain is drawn from.
async function tipDetail(fetchImpl: Fetch, base: string, height: number, timeoutMs: number): Promise<TipDetail> {
    try {
        const json: unknown = JSON.parse(await getText(fetchImpl, `${base}/blocks/${height}`, timeoutMs));
        return { time: parseBlockTime(json, height), blocks: parseBlocks(json, height) };
    } catch {
        return { time: null, blocks: [] };
    }
}

export async function fetchTip(fetchImpl: Fetch, known: BlockAt | null, timeoutMs = TIMEOUT_MS): Promise<LiveTip> {
    let lastError: unknown = new Error('No height API answered');
    for (const api of HEIGHT_APIS) {
        try {
            const height = parseHeight(await getText(fetchImpl, `${api.base}/blocks/tip/height`, timeoutMs));
            if (height === null) throw new Error(`Unexpected height from ${api.name}`);
            const detail =
                known?.height === height && known.time !== null
                    ? { time: known.time, blocks: known.blocks ?? [] }
                    : await tipDetail(fetchImpl, api.base, height, timeoutMs);
            return { height, ...detail, api: api.name };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

export interface HeightFeed {
    readonly tip: Tip;
    subscribe(listener: (tip: Tip, change: TipChange) => void): () => void;
    setActive(owner: object, active: boolean): void;
}

export interface FeedOptions {
    fetch: Fetch;
    now: () => number;
    isOnline: () => boolean;
    pollMs?: number;
    timeoutMs?: number;
}

export function createHeightFeed(options: FeedOptions): HeightFeed {
    const pollMs = options.pollMs ?? POLL_MS;
    const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    const listeners = new Set<(tip: Tip, change: TipChange) => void>();
    const owners = new Set<object>();
    const start = options.now();
    let tip: Tip = {
        ...estimateTip(start),
        source: 'checking',
        api: null,
        checkedAt: start,
        seenAt: start,
        blocks: [],
        blocksAt: null,
    };
    let seenAt = start;
    let blocksAt: number | null = null;
    let lastLive: LiveTip | null = null;
    let lastCheck = Number.NEGATIVE_INFINITY;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function publish(next: Tip, change: TipChange): void {
        tip = next;
        for (const listener of listeners) listener(tip, change);
    }

    function schedule(): void {
        clearTimeout(timer);
        timer = undefined;
        if (owners.size === 0 || inFlight) return;
        timer = setTimeout(poll, Math.max(0, lastCheck + pollMs - options.now()));
    }

    async function poll(): Promise<void> {
        if (inFlight) return;
        inFlight = true;
        lastCheck = options.now();
        try {
            if (!options.isOnline()) throw new Error('Offline');
            const live = await fetchTip(options.fetch, lastLive, timeoutMs);
            const previous = lastLive;
            if (!previous || live.height >= previous.height) lastLive = live;
            const current = lastLive ?? live;
            const blocks = previous ? current.height - previous.height : 0;
            if (!previous || blocks > 0) seenAt = options.now();
            if (current.blocks.length > 0 && current.blocks !== previous?.blocks) blocksAt = options.now();
            publish(
                {
                    height: current.height,
                    time: current.time,
                    api: current.api,
                    source: 'live',
                    checkedAt: options.now(),
                    seenAt,
                    blocks: current.blocks.length > 0 ? current.blocks : tip.blocks,
                    blocksAt,
                },
                { blocks },
            );
        } catch {
            const estimate = estimateTip(options.now());
            const keep = tip.height > estimate.height;
            publish(
                {
                    height: keep ? tip.height : estimate.height,
                    time: keep ? tip.time : estimate.time,
                    source: 'offline',
                    api: null,
                    checkedAt: options.now(),
                    seenAt: options.now(),
                    blocks: tip.blocks,
                    blocksAt: tip.blocksAt,
                },
                { blocks: 0 },
            );
        } finally {
            inFlight = false;
            schedule();
        }
    }

    return {
        get tip() {
            return tip;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        setActive(owner, active) {
            const before = owners.size;
            if (active) owners.add(owner);
            else owners.delete(owner);
            if (owners.size === 0) {
                clearTimeout(timer);
                timer = undefined;
            } else if (before === 0) {
                schedule();
            }
        },
    };
}

let feed: HeightFeed | null = null;

export function heightFeed(): HeightFeed {
    feed ??= createHeightFeed({
        fetch: (url, init) => window.fetch(url, init),
        now: () => Date.now(),
        isOnline: () => navigator.onLine,
    });
    return feed;
}
