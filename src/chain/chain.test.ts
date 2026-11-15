import { describe, expect, it } from 'vitest';
import { type ChainBlock, parseBlocks } from '../data/height.ts';
import { contrast } from '../styles/contrast.ts';
import { TOKENS } from '../styles/tokens.ts';
import { FILL_CAP, formingFill } from './forming.ts';
import { barcodePath, facePath, HASH_BITS, hashBits, isBlockHash, leadingZeroBits } from './hash.ts';
import { advanceChain, EMPTY_CHAIN } from './machine.ts';
import { BLANK, hashMaterial, MIN_INLAY_CONTRAST, SHADE_RANGE, shade, TONE_ORDER, TONES, toneFor } from './material.ts';
import { chainOffsets, GAP, gapFor, SHAPE, slabShape } from './shape.ts';
import { chainStill } from './still.ts';
import { arrivalCamera, DRIFT, homeCamera, mixCamera, project, viewProjection, withDrift } from './view.ts';

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

const list = (tip: number, length = 8) => Array.from({ length }, (_, index) => block(tip - index));

function seededHashes(count: number): string[] {
    let state = 12345;
    return Array.from({ length: count }, () => {
        let hex = '0'.repeat(18);
        while (hex.length < 64) {
            state = (Math.imul(state, 1103515245) + 12345) >>> 0;
            hex += (state >>> 16).toString(16).padStart(4, '0');
        }
        return hex.slice(0, 64);
    });
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

describe('slabShape and gaps', () => {
    it('grows the face with the bytes and the depth with the transactions, inside its clamps', () => {
        const small = slabShape({ size: 300, txCount: 1 });
        const usual = slabShape({ size: 1_500_000, txCount: 3000 });
        const huge = slabShape({ size: 4_000_000_000, txCount: 9_000_000 });
        expect(small.side).toBeGreaterThanOrEqual(SHAPE.sideMin);
        expect(small.side).toBeLessThan(usual.side);
        expect(small.thick).toBeLessThan(usual.thick);
        expect(huge).toEqual({ side: SHAPE.sideMax, thick: SHAPE.thickMax, nominal: false });
    });

    it('stands in a middling, flagged size for NaN, zero, negative or missing fields', () => {
        for (const bad of [Number.NaN, 0, -5, null, Number.POSITIVE_INFINITY]) {
            expect(slabShape({ size: bad, txCount: bad })).toEqual({
                side: SHAPE.sideNominal,
                thick: SHAPE.thickNominal,
                nominal: true,
            });
        }
    });

    it('maps minutes to a clamped gap, and unknown or backwards time to safe values', () => {
        expect(gapFor(0)).toBe(GAP.min);
        expect(gapFor(-900)).toBe(GAP.min);
        expect(gapFor(900)).toBeCloseTo((GAP.min + GAP.max) / 2, 6);
        expect(gapFor(86_400)).toBeCloseTo(GAP.max, 9);
        expect(gapFor(null)).toBe(GAP.nominal);
        expect(gapFor(Number.NaN)).toBe(GAP.nominal);
    });

    it('stands each tablet further back than the one before it', () => {
        const blocks = list(100);
        const offsets = chainOffsets(blocks, (blocks[0]?.time ?? 0) + 300);
        expect(offsets).toHaveLength(8);
        offsets.forEach((offset, index) => {
            expect(offset).toBeGreaterThan(index === 0 ? 0 : (offsets[index - 1] ?? 0));
        });
        expect(chainOffsets(blocks, null)[0]).toBeGreaterThan(0);
        expect(chainOffsets([], 5)).toEqual([]);
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

describe('hashMaterial', () => {
    it('is deterministic and pins known hashes to known stones', () => {
        expect(hashMaterial(HASH_A)).toEqual(hashMaterial(HASH_A));
        expect(hashMaterial(HASH_A).tone).toBe(toneFor(0x4a));
        expect(hashMaterial(HASH_A).tone).toBe('bone');
        expect(hashMaterial(HASH_B).tone).toBe('steel');
        expect(hashMaterial(HASH_A).body).not.toBe(hashMaterial(HASH_B).body);
    });

    it('covers all 256 last bytes with exactly the five tones', () => {
        expect(TONE_ORDER.reduce((total, tone) => total + TONES[tone].share, 0)).toBe(256);
        const seen = new Set(Array.from({ length: 256 }, (_, byte) => toneFor(byte)));
        expect([...seen].sort()).toEqual([...TONE_ORDER].sort());
    });

    it('keeps every stone inside its shade range, its cells readable, and both off the page colour', () => {
        for (const hash of seededHashes(400)) {
            const material = hashMaterial(hash);
            const base = TONES[material.tone as keyof typeof TONES];
            expect(material.inlay).toBe(base.inlay);
            expect([shade(base.body, -SHADE_RANGE), shade(base.body, SHADE_RANGE)].sort()).toSatisfy(
                ([low, high]: string[]) => contrast(material.body, base.body) <= contrast(low ?? '', high ?? ''),
            );
            expect(contrast(material.body, material.inlay)).toBeGreaterThanOrEqual(MIN_INLAY_CONTRAST);
            expect(contrast(material.body, TOKENS.void)).toBeGreaterThan(1.6);
        }
    });

    it('makes neighbouring hashes visibly different and gives a missing hash an uncut blank', () => {
        const stones = new Set(seededHashes(60).map((hash) => hashMaterial(hash).body));
        expect(stones.size).toBeGreaterThan(40);
        expect(hashMaterial(null)).toBe(BLANK);
        expect(BLANK.body).toBe(BLANK.inlay);
    });
});

describe('formingFill', () => {
    it('starts empty, rises with the wait and never passes its cap', () => {
        expect(formingFill(0)).toBe(0);
        expect(formingFill(600)).toBeCloseTo(FILL_CAP * (1 - 1 / Math.E), 6);
        expect(formingFill(60)).toBeLessThan(formingFill(600));
        for (const seconds of [3_600, 86_400, 1e12, Number.MAX_VALUE]) {
            expect(formingFill(seconds)).toBeLessThanOrEqual(FILL_CAP);
        }
        expect(FILL_CAP).toBeLessThan(1);
    });

    it('shows nothing for an unknown, negative or broken time', () => {
        for (const bad of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(formingFill(bad)).toBe(0);
    });
});

describe('advanceChain', () => {
    const first = advanceChain(EMPTY_CHAIN, list(100));

    it('replays the first list and counts no advance', () => {
        expect(first.effect).toBe('replay');
        expect(first.state.advances).toBe(0);
        expect(advanceChain(EMPTY_CHAIN, []).effect).toBe('none');
    });

    it('snaps once for one new block', () => {
        const next = advanceChain(first.state, list(101));
        expect(next.effect).toBe('snap');
        expect(next.state.advances).toBe(1);
        expect(next.state.blocks[0]?.height).toBe(101);
    });

    it('snaps exactly once when several blocks arrive together after a hidden tab', () => {
        const next = advanceChain(first.state, list(106));
        expect(next.effect).toBe('snap');
        expect(next.state.advances).toBe(1);
    });

    it('changes nothing for the same list or an empty answer', () => {
        expect(advanceChain(first.state, list(100))).toEqual({ state: first.state, effect: 'none' });
        expect(advanceChain(first.state, [])).toEqual({ state: first.state, effect: 'none' });
    });

    it('swaps without ceremony on a lower tip or a different hash at the same height', () => {
        const lower = advanceChain(first.state, list(99));
        expect(lower.effect).toBe('swap');
        expect(lower.state.advances).toBe(0);
        const reorg = advanceChain(first.state, [block(100, { hash: HASH_A }), ...list(99, 7)]);
        expect(reorg.effect).toBe('swap');
        expect(reorg.state.blocks[0]?.hash).toBe(HASH_A);
    });

    it('carries a block with a missing hash, and treats it as the same block next time', () => {
        const blank = [block(101, { hash: null }), ...list(100, 7)];
        const next = advanceChain(first.state, blank);
        expect(next.effect).toBe('snap');
        expect(advanceChain(next.state, blank).effect).toBe('none');
    });
});

describe('view and still', () => {
    const SHAPES = [390 / 844, 360 / 780, 844 / 390, 1440 / 900];

    it('keeps the forming block in the home frame at phone and desktop shapes', () => {
        for (const aspect of SHAPES) {
            const camera = homeCamera(aspect);
            const origin = project(viewProjection(camera), [0, 0.4, 0]);
            expect(Math.abs(origin.x + camera.shift.x)).toBeLessThan(1);
            expect(Math.abs(origin.y + camera.shift.y)).toBeLessThan(1);
            expect(origin.w).toBeGreaterThan(0);
        }
    });

    it('stands in one place above the floor and survives a bad screen shape', () => {
        for (const aspect of [...SHAPES, Number.NaN, 0, -1]) {
            const camera = homeCamera(aspect);
            expect(camera.eye[1]).toBeGreaterThan(0.2);
            expect([...camera.eye, ...camera.target].every(Number.isFinite)).toBe(true);
        }
        expect(homeCamera(1440 / 900).shift.x).toBeGreaterThan(0.2);
        expect(homeCamera(390 / 844).shift.x).toBe(0);
    });

    it('travels from the arrival shot to the home shot without overshooting either', () => {
        const from = arrivalCamera(1.6);
        const to = homeCamera(1.6);
        expect(mixCamera(from, to, 0).eye).toEqual(from.eye);
        expect(mixCamera(from, to, 7).eye).toEqual(to.eye);
        const half = mixCamera(from, to, 0.5);
        expect(half.eye[2]).toBeCloseTo((from.eye[2] + to.eye[2]) / 2, 9);
        expect(half.shift.x).toBeCloseTo((from.shift.x + to.shift.x) / 2, 9);
    });

    it('lets the idle camera sway a little, never what it looks at, and never far', () => {
        const still = homeCamera(1.3);
        const moved = new Set<string>();
        for (let seconds = 0; seconds < 120; seconds += 1.7) {
            const drifted = withDrift(still, seconds);
            expect(Math.abs(drifted.eye[0] - still.eye[0])).toBeLessThanOrEqual(DRIFT.x);
            expect(Math.abs(drifted.eye[1] - still.eye[1])).toBeLessThanOrEqual(DRIFT.y);
            expect(drifted.eye[2]).toBe(still.eye[2]);
            expect(drifted.target).toEqual(still.target);
            moved.add(drifted.eye[0].toFixed(3));
        }
        expect(moved.size).toBeGreaterThan(20);
        expect(withDrift(still, Number.NaN).eye.every(Number.isFinite)).toBe(true);
    });

    it('draws every block from the same data, with the forming outline only when asked', () => {
        const blocks = [block(100, { hash: HASH_A }), block(99, { hash: null }), ...list(98, 6)];
        const options = { width: 390, height: 340, nowSeconds: null, ink: TOKENS.void };
        const drawn = chainStill(blocks, { ...options, forming: true });
        expect(drawn.match(/<polygon[^>]*fill="#/g)).toHaveLength(blocks.length * 3);
        expect(drawn.match(/<path /g)).toHaveLength(blocks.length - 1);
        expect(drawn).toContain('stroke-dasharray');
        expect(drawn).toContain('aria-hidden="true"');
        expect(drawn).not.toContain('NaN');
        expect(chainStill(blocks, { ...options, forming: false })).not.toContain('stroke-dasharray');
    });
});
