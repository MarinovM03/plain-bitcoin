import { createMiner, hashHex, leadingZeroBits } from '../../model/sha256.ts';
import { DEPTHS, type HashBatch, type WorkerOrder } from './protocol.ts';

const CHUNK_MS = 60;

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function mine(header: Uint8Array, firstNonce: number): void {
    const miner = createMiner(header);
    let nonce = firstNonce >>> 0;
    let chunk = 2000;
    let bestZeros = -1;

    const run = () => {
        if (!running) return;
        const started = performance.now();
        const histogram = new Uint32Array(DEPTHS);
        let best: HashBatch['best'] = null;
        for (let i = 0; i < chunk; i += 1) {
            const digest = miner.hash(nonce);
            const zeros = leadingZeroBits(digest);
            const slot = Math.min(DEPTHS - 1, zeros);
            histogram[slot] = (histogram[slot] ?? 0) + 1;
            if (zeros > bestZeros) {
                bestZeros = zeros;
                best = { nonce, zeros, hash: hashHex(digest) };
            }
            nonce = (nonce + 1) >>> 0;
        }
        const ms = performance.now() - started;
        const batch: HashBatch = { type: 'batch', count: chunk, ms, histogram, best, nextNonce: nonce };
        postMessage(batch, { transfer: [histogram.buffer] });
        chunk = Math.max(500, Math.min(400_000, Math.round(chunk * (CHUNK_MS / Math.max(1, ms)))));
        timer = setTimeout(run, 0);
    };
    run();
}

addEventListener('message', (event: MessageEvent<WorkerOrder>) => {
    const order = event.data;
    clearTimeout(timer);
    running = order.type === 'start';
    if (order.type === 'start') mine(order.header, order.nonce);
});
