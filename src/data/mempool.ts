import { isTxid, parseLine, parseRecent, parseTx, type TxFacts, type WaitingLine } from '../model/tx.ts';

export const MEMPOOL_API = { name: 'mempool.space', origin: 'https://mempool.space' } as const;

const TIMEOUT_MS = 6_000;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class NotFound extends Error {}

async function get(fetchImpl: Fetch, path: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetchImpl(`${MEMPOOL_API.origin}${path}`, {
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (response.status === 404 || response.status === 400) throw new NotFound(`HTTP ${response.status}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

/** The blocks the waiting transactions would fill right now. Nothing about the visitor is sent. */
export async function fetchLine(fetchImpl: Fetch): Promise<WaitingLine> {
    const line = parseLine(await get(fetchImpl, '/api/v1/fees/mempool-blocks'));
    if (line.floors.length === 0) throw new Error('Empty waiting line');
    return line;
}

/** A transaction that has just entered the waiting line, for someone with none of their own to follow. */
export async function fetchRecentTxid(fetchImpl: Fetch): Promise<string> {
    const [txid] = parseRecent(await get(fetchImpl, '/api/mempool/recent'));
    if (!txid) throw new Error('No recent transactions');
    return txid;
}

export async function fetchTx(fetchImpl: Fetch, txid: string): Promise<TxFacts> {
    if (!isTxid(txid)) throw new Error('Not a transaction id');
    const facts = parseTx(await get(fetchImpl, `/api/tx/${txid.trim().toLowerCase()}`));
    if (!facts) throw new Error('Malformed transaction');
    return facts;
}
