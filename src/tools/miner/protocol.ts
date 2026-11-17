/** Hashes deeper than this many zero bits share the last slot of a batch's tally. */
export const DEPTHS = 96;

export type WorkerOrder = { type: 'start'; header: Uint8Array; nonce: number } | { type: 'stop' };

export interface HashBatch {
    type: 'batch';
    count: number;
    ms: number;
    /** How many of the batch's hashes started with each number of zero bits. */
    histogram: Uint32Array;
    /** Set only when the batch beat every earlier hash of this run. */
    best: { nonce: number; zeros: number; hash: string } | null;
    nextNonce: number;
}
