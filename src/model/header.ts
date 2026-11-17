import { createMiner, HEADER_BYTES, hashHex, leadingZeroBits } from './sha256.ts';

export interface BlockHeader {
    version: number;
    /** Written the way explorers show it, newest byte first. */
    previous: string;
    merkleRoot: string;
    /** Seconds since the epoch. */
    time: number;
    bits: number;
    nonce: number;
    bytes: Uint8Array;
}

function littleEndian(bytes: Uint8Array, at: number): number {
    return (
        ((bytes[at] ?? 0) |
            ((bytes[at + 1] ?? 0) << 8) |
            ((bytes[at + 2] ?? 0) << 16) |
            ((bytes[at + 3] ?? 0) << 24)) >>>
        0
    );
}

function reversedHex(bytes: Uint8Array, at: number, length: number): string {
    let hex = '';
    for (let i = at + length - 1; i >= at; i -= 1) hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
    return hex;
}

export function parseHeader(hex: string): BlockHeader | null {
    const text = hex.trim().toLowerCase();
    if (!/^[0-9a-f]{160}$/.test(text)) return null;
    const bytes = new Uint8Array(HEADER_BYTES);
    for (let i = 0; i < HEADER_BYTES; i += 1) bytes[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return {
        version: littleEndian(bytes, 0),
        previous: reversedHex(bytes, 4, 32),
        merkleRoot: reversedHex(bytes, 36, 32),
        time: littleEndian(bytes, 68),
        bits: littleEndian(bytes, 72),
        nonce: littleEndian(bytes, 76),
        bytes,
    };
}

/** The compact `bits` field as the full 256-bit target a block hash must be at or under. */
export function targetFromBits(bits: number): bigint {
    const exponent = bits >>> 24;
    const mantissa = BigInt(bits & 0x007fffff);
    return exponent <= 3 ? mantissa >> BigInt(8 * (3 - exponent)) : mantissa << BigInt(8 * (exponent - 3));
}

const DIFFICULTY_ONE = targetFromBits(0x1d00ffff);

export function difficultyFromBits(bits: number): number {
    const target = targetFromBits(bits);
    if (target === 0n) return 0;
    const scale = 1_000_000n;
    return Number((DIFFICULTY_ONE * scale) / target) / Number(scale);
}

/** How many zero bits every hash at or under the target starts with. */
export function targetZeroBits(bits: number): number {
    const target = targetFromBits(bits);
    return target === 0n ? 256 : 256 - target.toString(2).length;
}

export interface HeaderCheck {
    hash: string;
    zeros: number;
    meetsTarget: boolean;
}

/** Hashes the header exactly as it was mined, and says whether it beats its own target. */
export function checkHeader(header: BlockHeader): HeaderCheck {
    const digest = createMiner(header.bytes).hash(header.nonce);
    const hash = hashHex(digest);
    return { hash, zeros: leadingZeroBits(digest), meetsTarget: BigInt(`0x${hash}`) <= targetFromBits(header.bits) };
}
