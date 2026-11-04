import { describe, expect, it } from 'vitest';
import { clip, FORMATS, fitSize, layoutPostcard, type Measure, wrap } from './layout.ts';
import type { Postcard } from './types.ts';

/** A stand-in for canvas text metrics: each character is 0.6 em wide. Deterministic, so the layout is too. */
const measure: Measure = (text, font) => text.length * Number(/(\d+)px/.exec(font)?.[1] ?? 16) * 0.6;

const CARD: Postcard = {
    tool: 'dca',
    route: 'dca',
    kicker: 'Buying on a schedule · to 29 Oct 2026',
    number: '£229,527',
    line: '£250 a week since Jan 2020 is worth £229,527 today. One lump sum: £812,334.',
    source: 'Bitcoin: Coin Metrics daily closes to 29 Oct 2026 · fees not included · calculated in your browser',
    signature: { kind: 'cells', sats: 1000 },
    alt: '',
};

function inside(layout: ReturnType<typeof layoutPostcard>): void {
    const { width, height, margin } = layout;
    for (const box of [layout.kicker, layout.number, ...layout.lines, layout.brand, layout.source]) {
        const w = measure(box.text, `${box.size}px`);
        const left = box.align === 'right' ? box.x - w : box.x;
        expect(left, box.text).toBeGreaterThanOrEqual(margin - 0.5);
        expect(left + w, box.text).toBeLessThanOrEqual(width - margin + 0.5);
        expect(box.y, box.text).toBeLessThanOrEqual(height - margin + 0.5);
        expect(box.y - box.size, box.text).toBeGreaterThanOrEqual(margin - 0.5);
    }
    const s = layout.signature;
    expect(s.x).toBeGreaterThanOrEqual(margin);
    expect(s.x + s.w).toBeLessThanOrEqual(width - margin + 0.5);
    expect(s.y + s.h).toBeLessThanOrEqual(layout.rule.y);
}

describe('layoutPostcard', () => {
    it('lays the wide card out at 1200 x 628 and the square at 1080 x 1080, inside generous margins', () => {
        for (const format of ['wide', 'square'] as const) {
            const layout = layoutPostcard(CARD, format, measure, 'plainbitcoin.org');
            expect([layout.width, layout.height]).toEqual([FORMATS[format].width, FORMATS[format].height]);
            expect(layout.margin).toBeGreaterThanOrEqual(64);
            inside(layout);
        }
    });

    it('prints the number exactly as given, as the biggest thing on the card', () => {
        const layout = layoutPostcard(CARD, 'wide', measure, 'plainbitcoin.org');
        expect(layout.number.text).toBe('£229,527');
        expect(layout.number.tone).toBe('btc');
        for (const other of [layout.kicker, ...layout.lines, layout.brand, layout.source])
            expect(layout.number.size).toBeGreaterThan(other.size * 2);
    });

    it('shrinks a huge number to fit and never lets it overflow, in both shapes', () => {
        for (const number of ['£1,234,567,890,123,456', '20,999,999.9769 BTC', '9'.repeat(40)]) {
            for (const format of ['wide', 'square'] as const) {
                const layout = layoutPostcard({ ...CARD, number }, format, measure, 'plainbitcoin.org');
                expect(layout.number.text).toBe(number);
                inside(layout);
            }
        }
        const small = layoutPostcard({ ...CARD, number: '£1' }, 'wide', measure, 'x');
        const big = layoutPostcard({ ...CARD, number: '£1,234,567,890' }, 'wide', measure, 'x');
        expect(big.number.size).toBeLessThan(small.number.size);
    });

    it('wraps the line to at most three lines, and cuts a long source at a word', () => {
        const long = layoutPostcard(
            { ...CARD, line: 'word '.repeat(90), source: 'source '.repeat(60) },
            'wide',
            measure,
            'x',
        );
        expect(long.lines.length).toBeLessThanOrEqual(3);
        expect(long.source.text.endsWith('…')).toBe(true);
        inside(long);
    });

    it('carries the quiet brand rail: the mark, the site and the handle', () => {
        const layout = layoutPostcard(CARD, 'square', measure, 'plainbitcoin.org');
        expect(layout.brand.text).toBe('Plain Bitcoin');
        expect(layout.handle.text).toBe('plainbitcoin.org · @PlainBTC');
        expect(layout.kicker.text).toBe('BUYING ON A SCHEDULE · TO 29 OCT 2026');
    });

    it('is pure: the same card and metrics give the same layout', () => {
        expect(layoutPostcard(CARD, 'wide', measure, 'x')).toEqual(layoutPostcard(CARD, 'wide', measure, 'x'));
    });
});

describe('text fitting', () => {
    it('finds the largest size that fits, and wraps and clips at words', () => {
        expect(fitSize(measure, 'abcd', 'display', 100, 100, 10)).toBe(40);
        expect(fitSize(measure, 'x'.repeat(1000), 'display', 100, 100, 10)).toBe(1);
        expect(fitSize(measure, 'x'.repeat(20), 'display', 100, 100, 10)).toBe(8);
        expect(wrap(measure, 'aa bb cc', '10px', 29)).toEqual(['aa', 'bb', 'cc']);
        expect(wrap(measure, 'aa bb cc', '10px', 30)).toEqual(['aa bb', 'cc']);
        expect(clip(measure, 'one two three', '10px', 50)).toBe('one two…');
        expect(clip(measure, 'one two three', '10px', 40)).toBe('one…');
    });
});
