export const FACE_CELLS = 16;
export const HASH_BITS = FACE_CELLS * FACE_CELLS;

const HASH = /^[0-9a-f]{64}$/;

export function isBlockHash(value: unknown): value is string {
    return typeof value === 'string' && HASH.test(value);
}

export function hashByte(hash: string, index: number): number {
    return Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16);
}

/**
 * The hash as 256 cells, read like text: the first hex digit fills the top-left cells. A block hash starts with a
 * long run of zeros (the proof of work), so the top rows of every real face are blank. No hash: no cells.
 */
export function hashBits(hash: string | null): Uint8Array {
    const bits = new Uint8Array(HASH_BITS);
    if (!isBlockHash(hash)) return bits;
    for (let byte = 0; byte < 32; byte += 1) {
        const value = hashByte(hash, byte);
        for (let bit = 0; bit < 8; bit += 1) bits[byte * 8 + bit] = (value >> (7 - bit)) & 1;
    }
    return bits;
}

export function leadingZeroBits(hash: string | null): number {
    if (!isBlockHash(hash)) return 0;
    const bits = hashBits(hash);
    const first = bits.indexOf(1);
    return first < 0 ? HASH_BITS : first;
}

/** The hash as one row of 256 cells: runs of set bits as rectangles in a 256 x 1 box. */
export function barcodePath(hash: string | null): string {
    const bits = hashBits(hash);
    let path = '';
    for (let start = 0; start < HASH_BITS; start += 1) {
        if (bits[start] !== 1) continue;
        let end = start;
        while (end + 1 < HASH_BITS && bits[end + 1] === 1) end += 1;
        path += `M${start} 0h${end - start + 1}v1h-${end - start + 1}z`;
        start = end;
    }
    return path;
}

/** The face as a path in a 16 x 16 box: one inset square per set bit, row 0 at the top. */
export function facePath(hash: string | null, inset = 0.14): string {
    const bits = hashBits(hash);
    const side = (1 - inset * 2).toFixed(2);
    let path = '';
    for (let index = 0; index < HASH_BITS; index += 1) {
        if (bits[index] !== 1) continue;
        const x = (index % FACE_CELLS) + inset;
        const y = Math.floor(index / FACE_CELLS) + inset;
        path += `M${x.toFixed(2)} ${y.toFixed(2)}h${side}v${side}h-${side}z`;
    }
    return path;
}
