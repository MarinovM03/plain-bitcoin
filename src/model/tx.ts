export interface TxFacts {
    txid: string;
    /** Sats paid to the miner. */
    fee: number;
    /** Size in virtual bytes: weight units divided by four. */
    vsize: number;
    confirmed: boolean;
    blockHeight: number | null;
    /** Seconds since the epoch. */
    blockTime: number | null;
}

export function isTxid(text: string): boolean {
    return /^[0-9a-f]{64}$/i.test(text.trim());
}

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Reads the public transaction format of mempool.space and Esplora. Anything that does not fit is refused. */
export function parseTx(json: unknown): TxFacts | null {
    const tx = record(json);
    const status = record(tx?.status);
    const fee = count(tx?.fee);
    const weight = count(tx?.weight);
    if (!tx || !status || typeof tx.txid !== 'string' || !isTxid(tx.txid) || fee === null || !weight) return null;
    const confirmed = status.confirmed === true;
    const blockHeight = confirmed ? count(status.block_height) : null;
    if (confirmed && blockHeight === null) return null;
    return {
        txid: tx.txid.toLowerCase(),
        fee,
        vsize: weight / 4,
        confirmed,
        blockHeight,
        blockTime: confirmed ? count(status.block_time) : null,
    };
}

/** Sats per virtual byte: what miners rank waiting transactions by. */
export function feeRate(tx: Pick<TxFacts, 'fee' | 'vsize'>): number {
    return tx.vsize > 0 ? tx.fee / tx.vsize : 0;
}

/** Transaction ids from the "recent mempool" list, newest first. */
export function parseRecent(json: unknown): string[] {
    if (!Array.isArray(json)) return [];
    return json.flatMap((entry) => {
        const txid = record(entry)?.txid;
        return typeof txid === 'string' && isTxid(txid) ? [txid.toLowerCase()] : [];
    });
}

/** The lowest fee rate in each projected next block, nearest block first. */
export function parseProjected(json: unknown): number[] {
    if (!Array.isArray(json)) return [];
    const floors: number[] = [];
    for (const entry of json) {
        const range = record(entry)?.feeRange;
        const floor = Array.isArray(range) ? count(range[0]) : null;
        if (floor === null) break;
        floors.push(floor);
    }
    return floors;
}

/**
 * Which of the projected next blocks this fee rate would fit in: 1 is the very next. Null when it pays less than
 * everything in the projection, so no honest guess can be made.
 */
export function blocksAway(rate: number, floors: readonly number[]): number | null {
    if (!(rate > 0)) return null;
    const index = floors.findIndex((floor) => rate >= floor);
    return index < 0 ? null : index + 1;
}

/** A block that holds the transaction is its first confirmation; every block after adds one. */
export function confirmations(tipHeight: number, blockHeight: number | null): number {
    if (blockHeight === null || !Number.isFinite(tipHeight)) return 0;
    return Math.max(0, Math.floor(tipHeight) - blockHeight + 1);
}

export function maskTxid(txid: string): string {
    return `${txid.slice(0, 8)}…${txid.slice(-8)}`;
}
