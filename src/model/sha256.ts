const K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
]);

const INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

export const HEADER_BYTES = 80;

/** One round of SHA-256 over a 64-byte block given as 16 big-endian words; `state` is updated in place. */
function compress(state: Int32Array, block: Int32Array, w: Int32Array): void {
    for (let i = 0; i < 16; i += 1) w[i] = block[i] ?? 0;
    for (let i = 16; i < 64; i += 1) {
        const x = w[i - 15] ?? 0;
        const y = w[i - 2] ?? 0;
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0;
    }
    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;
    for (let i = 0; i < 64; i += 1) {
        const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + s1 + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + (w[i] ?? 0)) | 0;
        const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
    }
    state[0] = ((state[0] ?? 0) + a) | 0;
    state[1] = ((state[1] ?? 0) + b) | 0;
    state[2] = ((state[2] ?? 0) + c) | 0;
    state[3] = ((state[3] ?? 0) + d) | 0;
    state[4] = ((state[4] ?? 0) + e) | 0;
    state[5] = ((state[5] ?? 0) + f) | 0;
    state[6] = ((state[6] ?? 0) + g) | 0;
    state[7] = ((state[7] ?? 0) + h) | 0;
}

function word(bytes: Uint8Array, at: number): number {
    return ((bytes[at] ?? 0) << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
}

function swap(value: number): number {
    return ((value & 0xff) << 24) | ((value & 0xff00) << 8) | ((value >>> 8) & 0xff00) | (value >>> 24);
}

export interface Miner {
    /** The double SHA-256 of the header with this nonce: eight words in the order SHA-256 writes them. */
    hash(nonce: number): Int32Array;
}

/**
 * Real proof-of-work hashing for one 80-byte block header. The first 64 bytes never change, so they are hashed
 * once; every try then costs two rounds: the last 16 bytes with the new nonce, and the hash of that hash.
 */
export function createMiner(header: Uint8Array): Miner {
    if (header.length !== HEADER_BYTES) throw new RangeError('A block header is 80 bytes');
    const w = new Int32Array(64);
    const head = new Int32Array(16);
    for (let i = 0; i < 16; i += 1) head[i] = word(header, i * 4);
    const midstate = Int32Array.from(INITIAL);
    compress(midstate, head, w);

    const tail = new Int32Array(16);
    for (let i = 0; i < 3; i += 1) tail[i] = word(header, 64 + i * 4);
    tail[4] = 0x80000000 | 0;
    tail[15] = HEADER_BYTES * 8;
    const second = new Int32Array(16);
    second[8] = 0x80000000 | 0;
    second[15] = 256;
    const state = new Int32Array(8);
    const out = new Int32Array(8);

    return {
        hash(nonce) {
            tail[3] = swap(nonce | 0);
            state.set(midstate);
            compress(state, tail, w);
            second.set(state);
            for (let i = 0; i < 8; i += 1) out[i] = INITIAL[i] ?? 0;
            compress(out, second, w);
            return out;
        },
    };
}

/** A block hash is written back to front: the last byte SHA-256 produced comes first. */
export function hashHex(digest: Int32Array): string {
    let hex = '';
    for (let i = 7; i >= 0; i -= 1) hex += (swap(digest[i] ?? 0) >>> 0).toString(16).padStart(8, '0');
    return hex;
}

/** How many zero bits the written hash starts with: the proof of work. */
export function leadingZeroBits(digest: Int32Array): number {
    let zeros = 0;
    for (let i = 7; i >= 0; i -= 1) {
        const value = swap(digest[i] ?? 0);
        if (value !== 0) return zeros + Math.clz32(value);
        zeros += 32;
    }
    return zeros;
}

/** The first block's header, as it sits on every node, with room for a nonce in its last four bytes. */
export function sampleHeader(): Uint8Array {
    const header = new Uint8Array(HEADER_BYTES);
    header[0] = 1;
    const merkle = '3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a';
    for (let i = 0; i < 32; i += 1) header[36 + i] = Number.parseInt(merkle.slice(i * 2, i * 2 + 2), 16);
    header.set([0x29, 0xab, 0x5f, 0x49, 0xff, 0xff, 0x00, 0x1d], 68);
    return header;
}

export const SAMPLE_NONCE = 2_083_236_893;
export const SAMPLE_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
