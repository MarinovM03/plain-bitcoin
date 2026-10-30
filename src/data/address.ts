export const ADDRESS_API = { name: 'mempool.space', origin: 'https://mempool.space' } as const;

export const ADDRESS_TIMEOUT_MS = 8_000;

export interface ChainStats {
    balance: number;
    received: number;
    sent: number;
    txCount: number;
    pendingTxCount: number;
    pendingChange: number;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function side(json: unknown) {
    if (typeof json !== 'object' || json === null) return null;
    const stats = json as Record<string, unknown>;
    const funded = count(stats.funded_txo_sum);
    const spent = count(stats.spent_txo_sum);
    const txs = count(stats.tx_count);
    return funded === null || spent === null || txs === null ? null : { funded, spent, txs };
}

export function parseChainStats(json: unknown): ChainStats | null {
    if (typeof json !== 'object' || json === null) return null;
    const body = json as Record<string, unknown>;
    const chain = side(body.chain_stats);
    const pending = side(body.mempool_stats);
    if (!chain || !pending || chain.spent > chain.funded) return null;
    return {
        balance: chain.funded - chain.spent,
        received: chain.funded,
        sent: chain.spent,
        txCount: chain.txs,
        pendingTxCount: pending.txs,
        pendingChange: pending.funded - pending.spent,
    };
}

export function explorerUrl(address: string): string {
    return `${ADDRESS_API.origin}/address/${encodeURIComponent(address)}`;
}

export async function fetchChainStats(
    fetchImpl: Fetch,
    address: string,
    signal: AbortSignal,
    timeoutMs = ADDRESS_TIMEOUT_MS,
): Promise<ChainStats> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    const timer = setTimeout(abort, timeoutMs);
    try {
        const response = await fetchImpl(`${ADDRESS_API.origin}/api/address/${encodeURIComponent(address)}`, {
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const stats = parseChainStats(await response.json());
        if (!stats) throw new Error('Unexpected answer');
        return stats;
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
}
