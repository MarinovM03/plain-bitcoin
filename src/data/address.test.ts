import { describe, expect, it, vi } from 'vitest';
import { explorerUrl, fetchChainStats, parseChainStats } from './address.ts';

const ANSWER = {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    chain_stats: { funded_txo_count: 3, funded_txo_sum: 7_000, spent_txo_count: 1, spent_txo_sum: 2_000, tx_count: 4 },
    mempool_stats: { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 1, spent_txo_sum: 500, tx_count: 1 },
};

describe('parseChainStats', () => {
    it('reads balance, totals and waiting transactions in sats', () => {
        expect(parseChainStats(ANSWER)).toEqual({
            balance: 5_000,
            received: 7_000,
            sent: 2_000,
            txCount: 4,
            pendingTxCount: 1,
            pendingChange: -500,
        });
    });

    it('refuses answers that are missing fields or do not add up', () => {
        expect(parseChainStats(null)).toBeNull();
        expect(parseChainStats({ chain_stats: ANSWER.chain_stats })).toBeNull();
        expect(parseChainStats({ ...ANSWER, chain_stats: { ...ANSWER.chain_stats, funded_txo_sum: 1.5 } })).toBeNull();
        expect(parseChainStats({ ...ANSWER, chain_stats: { ...ANSWER.chain_stats, spent_txo_sum: 9_000 } })).toBeNull();
    });
});

describe('fetchChainStats', () => {
    it('asks mempool.space once, without credentials or referrer', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify(ANSWER)));
        const stats = await fetchChainStats(fetchImpl, ANSWER.address, new AbortController().signal);
        expect(stats.balance).toBe(5_000);
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(fetchImpl).toHaveBeenCalledWith(
            `https://mempool.space/api/address/${ANSWER.address}`,
            expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }),
        );
    });

    it('fails on an error status or a strange answer', async () => {
        const signal = new AbortController().signal;
        await expect(fetchChainStats(async () => new Response('', { status: 429 }), 'x', signal)).rejects.toThrow();
        await expect(fetchChainStats(async () => new Response('{}'), 'x', signal)).rejects.toThrow();
    });

    it('stops when the page moves on', async () => {
        const controller = new AbortController();
        const fetchImpl = (_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            });
        const pending = fetchChainStats(fetchImpl, 'x', controller.signal);
        controller.abort();
        await expect(pending).rejects.toThrow('Aborted');
    });
});

describe('explorerUrl', () => {
    it('links to the address page on mempool.space', () => {
        expect(explorerUrl('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(
            'https://mempool.space/address/bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        );
    });
});
