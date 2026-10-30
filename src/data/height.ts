import { TARGET_BLOCK_SECONDS } from '../model/supply.ts';

// Block 973,854 as reported by mempool.space on 30 Oct 2026 (timestamp 2026-10-30T17:58:11Z).
export const HEIGHT_ANCHOR = { height: 973_854, time: 1_793_383_091 } as const;

export const HEIGHT_APIS = [
    { name: 'mempool.space', base: 'https://mempool.space/api' },
    { name: 'blockstream.info', base: 'https://blockstream.info/api' },
] as const;

export type HeightApi = (typeof HEIGHT_APIS)[number]['name'];

export const POLL_MS = 45_000;
export const TIMEOUT_MS = 6_000;

export type TipSource = 'checking' | 'live' | 'offline';

export interface Tip {
    height: number;
    time: number | null;
    source: TipSource;
    api: HeightApi | null;
    checkedAt: number;
    seenAt: number;
}

export interface TipChange {
    blocks: number;
}

interface BlockAt {
    height: number;
    time: number | null;
}

interface LiveTip extends BlockAt {
    api: HeightApi;
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

async function blockTime(fetchImpl: Fetch, base: string, height: number, timeoutMs: number): Promise<number | null> {
    try {
        return parseBlockTime(JSON.parse(await getText(fetchImpl, `${base}/blocks/${height}`, timeoutMs)), height);
    } catch {
        return null;
    }
}

export async function fetchTip(fetchImpl: Fetch, known: BlockAt | null, timeoutMs = TIMEOUT_MS): Promise<LiveTip> {
    let lastError: unknown = new Error('No height API answered');
    for (const api of HEIGHT_APIS) {
        try {
            const height = parseHeight(await getText(fetchImpl, `${api.base}/blocks/tip/height`, timeoutMs));
            if (height === null) throw new Error(`Unexpected height from ${api.name}`);
            const time =
                known?.height === height && known.time !== null
                    ? known.time
                    : await blockTime(fetchImpl, api.base, height, timeoutMs);
            return { height, time, api: api.name };
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
    let tip: Tip = { ...estimateTip(start), source: 'checking', api: null, checkedAt: start, seenAt: start };
    let seenAt = start;
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
            publish({ ...current, source: 'live', checkedAt: options.now(), seenAt }, { blocks });
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
