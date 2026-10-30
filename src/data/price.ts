import type { Prices } from '../model/convert.ts';
import latest from './prices/latest.json';

export const PRICE_APIS = [
    { name: 'mempool.space', url: 'https://mempool.space/api/v1/prices' },
    {
        name: 'CoinGecko',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp,usd&include_last_updated_at=true',
    },
] as const;

export type PriceApi = (typeof PRICE_APIS)[number]['name'];

export type PriceSource = PriceApi | 'last close';

export const PRICE_CACHE_MS = 60_000;
export const PRICE_TIMEOUT_MS = 6_000;
export const PRICE_STALE_MS = 5 * 60_000;

export interface PriceQuote {
    value: Prices;
    source: PriceSource;
    asOf: number;
    stale: boolean;
}

export const LAST_CLOSE: PriceQuote = {
    value: { gbp: latest.GBP, usd: latest.USD },
    source: 'last close',
    asOf: Date.parse(`${latest.day}T00:00:00Z`),
    stale: true,
};

export const LAST_CLOSE_SOURCE = { name: latest.source, url: latest.url, day: latest.day } as const;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function positive(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function record(json: unknown): Record<string, unknown> | null {
    return typeof json === 'object' && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
}

function quoteFields(api: PriceApi, body: Record<string, unknown>) {
    if (api === 'mempool.space') return { gbp: body.GBP, usd: body.USD, time: body.time };
    const coin = record(body.bitcoin);
    return { gbp: coin?.gbp, usd: coin?.usd, time: coin?.last_updated_at };
}

export function parseQuote(api: PriceApi, json: unknown): { value: Prices; asOf: number } | null {
    const body = record(json);
    if (!body) return null;
    const fields = quoteFields(api, body);
    if (!positive(fields.gbp) || !positive(fields.usd) || !positive(fields.time)) return null;
    return { value: { gbp: fields.gbp, usd: fields.usd }, asOf: fields.time * 1000 };
}

async function getJson(fetchImpl: Fetch, url: string, timeoutMs: number): Promise<unknown> {
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
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchQuote(fetchImpl: Fetch, now: number, timeoutMs = PRICE_TIMEOUT_MS): Promise<PriceQuote> {
    let lastError: unknown = new Error('No price API answered');
    for (const api of PRICE_APIS) {
        try {
            const quote = parseQuote(api.name, await getJson(fetchImpl, api.url, timeoutMs));
            if (!quote) throw new Error(`Unexpected price from ${api.name}`);
            return { ...quote, asOf: Math.min(quote.asOf, now), source: api.name, stale: false };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

export interface PriceFeed {
    readonly quote: PriceQuote;
    subscribe(listener: (quote: PriceQuote) => void): () => void;
    setActive(owner: object, active: boolean): void;
}

export interface PriceFeedOptions {
    fetch: Fetch;
    now: () => number;
    isOnline: () => boolean;
    cacheMs?: number;
    timeoutMs?: number;
}

export function createPriceFeed(options: PriceFeedOptions): PriceFeed {
    const cacheMs = options.cacheMs ?? PRICE_CACHE_MS;
    const timeoutMs = options.timeoutMs ?? PRICE_TIMEOUT_MS;
    const listeners = new Set<(quote: PriceQuote) => void>();
    const owners = new Set<object>();
    let quote = LAST_CLOSE;
    let fetchedAt = Number.NEGATIVE_INFINITY;
    let lastCheck = Number.NEGATIVE_INFINITY;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function publish(next: PriceQuote): void {
        quote = next;
        for (const listener of listeners) listener(quote);
    }

    function schedule(): void {
        clearTimeout(timer);
        timer = undefined;
        if (owners.size === 0 || inFlight) return;
        timer = setTimeout(poll, Math.max(0, lastCheck + cacheMs - options.now()));
    }

    async function poll(): Promise<void> {
        if (inFlight) return;
        inFlight = true;
        lastCheck = options.now();
        try {
            if (!options.isOnline()) throw new Error('Offline');
            const live = await fetchQuote(options.fetch, options.now(), timeoutMs);
            fetchedAt = options.now();
            publish(live);
        } catch {
            const keep = quote.source !== 'last close' && options.now() - fetchedAt < PRICE_STALE_MS;
            publish(keep || quote.source === 'last close' ? quote : { ...quote, stale: true });
        } finally {
            inFlight = false;
            schedule();
        }
    }

    return {
        get quote() {
            return quote;
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

let feed: PriceFeed | null = null;

export function priceFeed(): PriceFeed {
    feed ??= createPriceFeed({
        fetch: (url, init) => window.fetch(url, init),
        now: () => Date.now(),
        isOnline: () => navigator.onLine,
    });
    return feed;
}
