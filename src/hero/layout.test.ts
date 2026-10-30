import { describe, expect, it } from 'vitest';
import { issued, MAX_SUPPLY } from '../model/supply.ts';
import { fieldLayout, firstTokenOfEra, TOKEN_COUNT, TOKEN_SATS, tokenState, tokensBounds } from './layout.ts';

describe('tokens', () => {
    it('cuts the whole schedule into 21,000 tokens of 1,000 BTC', () => {
        expect(TOKEN_COUNT).toBe(21_000);
        expect(firstTokenOfEra(1)).toBe(10_500);
        expect(firstTokenOfEra(4)).toBe(19_688);
        expect(firstTokenOfEra(64)).toBe(TOKEN_COUNT);
    });

    it('splits issued sats into full tokens and the one being filled', () => {
        expect(tokenState(0)).toEqual({ full: 0, partial: 0 });
        expect(tokenState(issued(973_854))).toEqual({ full: 20_105, partial: 0.796875 });
        expect(tokenState(TOKEN_SATS * 3)).toEqual({ full: 3, partial: 0 });
        expect(tokenState(MAX_SUPPLY)).toEqual({ full: TOKEN_COUNT, partial: 0 });
    });

    it('measures the last, smaller token against its own size', () => {
        const lastStart = (TOKEN_COUNT - 1) * TOKEN_SATS;
        const lastSize = MAX_SUPPLY - lastStart;
        expect(tokenState(lastStart + lastSize / 2)).toEqual({ full: TOKEN_COUNT - 1, partial: 0.5 });
    });
});

describe('fieldLayout', () => {
    const layout = fieldLayout();

    it('gives every token to exactly one era block, in order', () => {
        const total = layout.blocks.reduce((sum, block) => sum + block.count, 0);
        expect(total).toBe(TOKEN_COUNT);
        expect(layout.blocks[0]?.count).toBe(10_500);
        expect(layout.blocks[1]?.count).toBe(5_250);
        for (const [i, block] of layout.blocks.entries()) {
            const next = layout.blocks[i + 1];
            if (next) expect(next.first).toBe(block.first + block.count);
        }
    });

    it('halves the area of each era block and steps it up a terrace', () => {
        for (let era = 1; era < 8; era += 1) {
            const before = layout.blocks[era - 1];
            const block = layout.blocks[era];
            if (!before || !block) throw new Error('missing block');
            const ratio = ((block.w + 0.9) * (block.d + 0.9)) / ((before.w + 0.9) * (before.d + 0.9));
            expect(ratio).toBeGreaterThan(0.45);
            expect(ratio).toBeLessThan(0.55);
            expect(block.top).toBeGreaterThan(before.top);
        }
    });

    it('places each token inside its own block', () => {
        for (const block of layout.blocks) {
            for (let i = block.first; i < block.first + block.count; i += 1) {
                const x = layout.positions[i * 2] ?? Number.NaN;
                const z = layout.positions[i * 2 + 1] ?? Number.NaN;
                expect(x).toBeGreaterThanOrEqual(block.x);
                expect(x).toBeLessThanOrEqual(block.x + block.w);
                expect(z).toBeGreaterThanOrEqual(block.z);
                expect(z).toBeLessThanOrEqual(block.z + block.d);
                expect(layout.eras[i]).toBe(block.era);
            }
        }
    });

    it('keeps the unissued tail inside a small corner of the field', () => {
        const tail = tokensBounds(layout, firstTokenOfEra(4));
        expect(tail.w * tail.d).toBeLessThan(layout.width * layout.depth * 0.08);
    });
});
