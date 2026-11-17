import { describe, expect, it } from 'vitest';
import { type ChainBlock, parseBlocks } from '../data/height.ts';
import { barcodePath, facePath, HASH_BITS, hashBits, isBlockHash, leadingZeroBits } from './hash.ts';

const HASH_A = '00000000000000000001c33f086ba1e886c500583137053f8ce211691671624a';
const HASH_B = `${'0'.repeat(20)}${'b'.repeat(42)}ff`;

function block(height: number, over: Partial<ChainBlock> = {}): ChainBlock {
    return {
        height,
        hash: `${'0'.repeat(20)}${height.toString(16).padStart(44, 'a')}`,
        time: 1_794_000_000 + height * 600,
        txCount: 3000,
        size: 1_500_000,
        weight: 3_990_000,
        ...over,
    };
}

describe('parseBlocks', () => {
    const raw = (height: number) => ({
        height,
        id: block(height).hash,
        timestamp: 1_794_000_000,
        tx_count: 10,
        size: 500,
        weight: 2000,
    });

    it('reads the run from the tip downwards and stops at the first gap', () => {
        const blocks = parseBlocks([raw(98), raw(100), raw(99), raw(96)], 100);
        expect(blocks.map((entry) => entry.height)).toEqual([100, 99, 98]);
        expect(blocks[0]).toEqual({ ...block(100), time: 1_794_000_000, txCount: 10, size: 500, weight: 2000 });
    });

    it('keeps a block whose fields are missing or mangled, with nulls instead of guesses', () => {
        const [entry] = parseBlocks(
            [{ height: 7, id: 'not-a-hash', timestamp: -1, tx_count: 'many', size: Number.NaN }],
            7,
        );
        expect(entry).toEqual({ height: 7, hash: null, time: null, txCount: null, size: null, weight: null });
    });

    it('returns nothing for a wrong shape, a missing tip or junk entries', () => {
        expect(parseBlocks('nope', 5)).toEqual([]);
        expect(parseBlocks([raw(4)], 5)).toEqual([]);
        expect(parseBlocks([null, 3, { height: 1.5 }], 5)).toEqual([]);
        expect(
            parseBlocks(
                Array.from({ length: 12 }, (_, index) => raw(50 - index)),
                50,
            ),
        ).toHaveLength(8);
    });
});

describe('hash bits', () => {
    it('reads the hash like text: the leading zeros are the blank top of the face', () => {
        const bits = hashBits(HASH_A);
        expect(bits).toHaveLength(HASH_BITS);
        expect(leadingZeroBits(HASH_A)).toBe(79);
        expect([...bits.slice(0, 79)].every((bit) => bit === 0)).toBe(true);
        expect(bits[79]).toBe(1);
        expect([...bits.slice(248)]).toEqual([0, 1, 0, 0, 1, 0, 1, 0]);
    });

    it('gives the same bits for the same hash and different bits for a different one', () => {
        expect([...hashBits(HASH_A)]).toEqual([...hashBits(HASH_A)]);
        expect([...hashBits(HASH_A)]).not.toEqual([...hashBits(HASH_B)]);
    });

    it('draws nothing for a missing or malformed hash', () => {
        for (const bad of [null, '', 'abc', HASH_A.toUpperCase(), `${HASH_A}0`]) {
            expect(isBlockHash(bad)).toBe(false);
            expect([...hashBits(bad as string | null)].some((bit) => bit === 1)).toBe(false);
            expect(barcodePath(bad as string | null)).toBe('');
            expect(facePath(bad as string | null)).toBe('');
            expect(leadingZeroBits(bad as string | null)).toBe(0);
        }
    });

    it('draws one mark per run in the barcode and one square per set bit on the face', () => {
        expect(barcodePath(`${'0'.repeat(62)}f0`)).toBe('M248 0h4v1h-4z');
        const set = [...hashBits(HASH_A)].filter((bit) => bit === 1).length;
        expect(facePath(HASH_A).match(/M/g)).toHaveLength(set);
    });
});
