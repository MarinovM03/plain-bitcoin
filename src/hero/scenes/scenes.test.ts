import { describe, expect, it } from 'vitest';
import { MAX_SATS } from '../../model/convert.ts';
import { barScale } from '../../model/scale.ts';
import { issued, MAX_SUPPLY } from '../../model/supply.ts';
import { satsScale } from '../../util/sats-scale.ts';
import { addressLayout, bech32Roles, charLevels } from './address.ts';
import { convertLayout, unitText } from './convert.ts';
import { dcaFrame, dcaLayout, niceStep, yearTicks } from './dca.ts';
import { loadLayout } from './index.ts';
import { DOTS, eraStarts, eraTip, leftFill, leftLayout } from './left.ts';
import { COLS, powerFills, powerLayout, ROWS } from './power.ts';
import { type Guide, inkIndex, type Layout, MAX_POINTS, type SceneData, type SceneId } from './types.ts';

const view = (aspect: number, pixels = 240) => ({ aspect, pixels });

function inBox(layout: Layout, aspect: number): boolean {
    for (let i = 0; i < layout.count; i += 1) {
        const x = layout.x[i] ?? -1;
        const y = layout.y[i] ?? -1;
        if (!(x >= 0 && x <= aspect && y >= 0 && y <= 1)) return false;
    }
    return true;
}

function allFinite(layout: Layout): boolean {
    for (const array of [layout.x, layout.y, layout.r, layout.order])
        for (const value of array) if (!Number.isFinite(value)) return false;
    return true;
}

function count(layout: Layout, ink: Parameters<typeof inkIndex>[0]): number {
    return layout.ink.filter((value, i) => value === inkIndex(ink) && (layout.r[i] ?? 0) > 0).length;
}

function labels(layout: Layout): string[] {
    return layout.guides.flatMap((guide: Guide) => (guide.kind === 'label' ? [guide.text] : []));
}

const DCA_DAY = 86_400_000;
function dcaData(values: number[], extra: Partial<Extract<SceneData, { id: 'dca' }>> = {}): SceneData {
    return {
        id: 'dca',
        fiat: 'GBP',
        worth: '£9',
        alt: 'Line chart.',
        t: values.map((_, i) => Date.UTC(2020, 0, 1) + i * 7 * DCA_DAY),
        value: values,
        invested: values.map((_, i) => i + 1),
        lump: values.map(() => 3),
        ...extra,
    };
}

describe('left scene', () => {
    it('lights one dot per 10,000 BTC issued, fills the volume from the bottom and marks the dot being filled', () => {
        const fill = leftFill(974_148);
        expect(fill.full).toBe(Math.floor(issued(974_148) / 1e12));
        expect(fill.partial).toBeGreaterThan(0);
        const layout = leftLayout({ id: 'left', height: 974_148 }, view(1.6));
        expect(layout.count).toBe(DOTS);
        expect(count(layout, 'faint')).toBe(DOTS - fill.full - 1);
        expect(count(layout, 'ember')).toBe(1);
        const lit = count(layout, 'paper') + count(layout, 'dim') + count(layout, 'btc');
        expect(lit).toBe(fill.full);
        expect(inBox(layout, 1.6)).toBe(true);
        expect(DOTS * 1e12).toBeGreaterThanOrEqual(MAX_SUPPLY);
        expect(layout.y[0]).toBeGreaterThan(layout.y[DOTS - 1] ?? 1);
    });

    it('draws each halving era as a stratum: the first holds half of all coins, each later one half the one before', () => {
        const starts = eraStarts();
        expect(starts[1]).toBe(1050);
        expect((starts[2] ?? 0) - (starts[1] ?? 0)).toBe(525);
        const layout = leftLayout({ id: 'left', height: 974_148 }, view(1.6));
        const bands = layout.guides.filter((guide) => guide.kind === 'band');
        expect(bands.length).toBe(6);
        expect(labels(layout)).toContain('▸ 3.125 BTC');
        expect(eraTip(0, 4)).toBe('Era 1 · 3 Jan 2009 to 28 Nov 2012 · 50 BTC a block · 10,500,000 BTC in all');
        expect(eraTip(4, 4)).toMatch(/^Era 5 · since 20 Apr 2024 · 3\.125 BTC a block · being mined now$/);
    });

    it('fits tall and wide windows and survives a bad height', () => {
        for (const aspect of [0.6, 1, 2.4])
            expect(inBox(leftLayout({ id: 'left', height: 1 }, view(aspect)), aspect)).toBe(true);
        for (const height of [Number.NaN, -5, Number.POSITIVE_INFINITY, 1.5]) {
            const layout = leftLayout({ id: 'left', height }, view(1.2));
            expect(allFinite(layout)).toBe(true);
            expect(count(layout, 'btc') + count(layout, 'paper')).toBeLessThanOrEqual(1);
        }
    });
});

describe('power scene', () => {
    it('sizes the two stacks with the same scale as the bars below and labels each with the answer text', () => {
        const { fills } = powerFills(1_000, 2_000);
        expect(fills[1]).toBe(2 * fills[0]);
        expect(powerFills(0, 5).fills).toEqual([0, 0]);
        const data = { id: 'power', cash: 1_000, bitcoin: 2_000, cashLabel: '£1,000', bitcoinLabel: '£2,000' } as const;
        const layout = powerLayout(data, view(1.4));
        expect(count(layout, 'fiat')).toBe(fills[0]);
        expect(count(layout, 'btc')).toBe(fills[1]);
        expect(labels(layout)).toEqual(expect.arrayContaining(['£1,000', '£2,000', 'Cash', 'Bitcoin']));
    });

    it('switches to a labelled log scale once one stack is ten times the other, matching barScale', () => {
        const { fills, log } = powerFills(1_000, 900_000);
        const widths = barScale([1_000, 900_000]).widths;
        expect(log).toBe(true);
        expect(fills[1]).toBe(Math.round((widths[1] ?? 0) * COLS * ROWS));
        expect(
            labels(powerLayout({ id: 'power', cash: 1_000, bitcoin: 900_000, cashLabel: 'a' }, view(1.4))),
        ).toContain('log ×10/line');
    });

    it('draws a preview outline without claiming either value, and survives NaN and Infinity', () => {
        const layout = powerLayout({ id: 'power', cash: 1, bitcoin: 1, outline: true }, view(1.4));
        expect(count(layout, 'btc') + count(layout, 'fiat')).toBe(0);
        expect(layout.guides).toEqual([]);
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
            const broken = powerLayout({ id: 'power', cash: bad, bitcoin: 5 }, view(1.4));
            expect(allFinite(broken)).toBe(true);
            expect(count(broken, 'btc')).toBe(0);
        }
        expect(powerFills(1e-300, 1e300).fills.every((fill) => fill >= 1 && fill <= COLS * ROWS)).toBe(true);
    });
});

describe('convert scene', () => {
    it('picks a power of ten per dot so the amount lights at most 1,000 dots, and says so', () => {
        expect(satsScale(1)).toEqual({ perDot: 1, filled: 1, partial: 0 });
        expect(satsScale(100_000)).toEqual({ perDot: 100, filled: 1000, partial: 0 });
        expect(satsScale(100_000_000).perDot).toBe(100_000);
        const layout = convertLayout({ id: 'convert', sats: 1_234 }, view(1.5));
        expect(count(layout, 'btc')).toBe(123);
        expect(count(layout, 'ember')).toBe(1);
        expect(labels(layout)).toEqual(['1 dot = 10 sats', '10 blocks of 100 = 10,000 sats']);
    });

    it('names the unit as it zooms: sats, then bitcoin', () => {
        expect(unitText(1)).toBe('1 sat');
        expect(unitText(500)).toBe('500 sats');
        expect(unitText(100_000)).toBe('0.001 BTC');
        expect(unitText(100_000_000)).toBe('1 BTC');
        expect(unitText(1e15)).toBe('10,000,000 BTC');
        const one = convertLayout({ id: 'convert', sats: 100_000_000 }, view(1.5));
        expect(labels(one)[0]).toBe('1 dot = 0.001 BTC');
        expect(one.entry?.k).toBe(5);
    });

    it('clamps nonsense: empty, negative, NaN and more than all bitcoin', () => {
        for (const sats of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, MAX_SATS * 10]) {
            const layout = convertLayout({ id: 'convert', sats }, view(1.5));
            expect(allFinite(layout)).toBe(true);
            expect(inBox(layout, 1.5)).toBe(true);
            expect(count(layout, 'btc')).toBeLessThanOrEqual(1000);
        }
    });
});

describe('dca scene', () => {
    it('draws one mark per buy for the schedule and stays within the point budget', () => {
        const buys = 850;
        const series = Array.from({ length: buys }, (_, i) => i + 1);
        const layout = dcaLayout(dcaData(series), view(1.2, 300));
        expect(count(layout, 'btc')).toBe(buys);
        expect(layout.count).toBeLessThanOrEqual(MAX_POINTS);
        expect(inBox(layout, 1.2)).toBe(true);
    });

    it('shares one domain between the dots and the SVG lines: the last value sits at the right end, under its label', () => {
        const values = [1, 5, 2, 9];
        const layout = dcaLayout(dcaData(values), view(1.6));
        const line = layout.paths.find((path) => path.className.endsWith('--value'));
        const marks = [...layout.ink.keys()].filter((i) => layout.ink[i] === inkIndex('btc'));
        const lastMark = marks.at(-1) ?? -1;
        expect(line?.points.at(-1)?.[0]).toBeCloseTo(layout.x[lastMark] ?? -1, 5);
        expect(line?.points.at(-1)?.[1]).toBeCloseTo(layout.y[lastMark] ?? -1, 5);
        expect(labels(layout)).toContain('£9');
        expect(layout.paths.map((path) => path.className)).toContain('dca-chart__line dca-chart__line--lump');
        expect(Math.min(...[...layout.y])).toBeGreaterThan(0.1);
    });

    it('places marks by date, not by index, so an uneven last step is drawn as it was', () => {
        const data = dcaData([1, 2, 3]);
        if (data.id !== 'dca') throw new Error('dca');
        const t = [Date.UTC(2020, 0, 1), Date.UTC(2020, 0, 8), Date.UTC(2020, 0, 11)];
        const layout = dcaLayout({ ...data, t }, view(1));
        const span = (layout.x[2] ?? 0) - (layout.x[0] ?? 0);
        expect(((layout.x[1] ?? 0) - (layout.x[0] ?? 0)) / span).toBeCloseTo(0.7, 5);
    });

    it('draws a home preview that has no value line: the money put in and the lump sum only', () => {
        const preview = dcaLayout(dcaData([1, 2, 3], { value: [] }), view(1.4));
        expect(preview.count).toBeGreaterThan(0);
        expect(count(preview, 'btc')).toBe(0);
        expect(count(preview, 'paper')).toBe(3);
    });

    it('keeps the mark size in pixels whatever the window height', () => {
        const data = dcaData([1, 2]);
        const small = dcaLayout(data, view(1, 100));
        const big = dcaLayout(data, view(1, 600));
        expect((small.r[0] ?? 0) * 100).toBeCloseTo((big.r[0] ?? 0) * 600);
    });

    it('labels axes with honest ticks and survives empty, NaN, Infinity and huge series', () => {
        expect(niceStep(45_905)).toBe(20_000);
        expect(yearTicks(Date.UTC(2020, 0, 1), Date.UTC(2026, 9, 29))).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
        expect(yearTicks(Date.UTC(2010, 6, 1), Date.UTC(2026, 9, 29)).length).toBeLessThanOrEqual(6);
        const empty = dcaLayout(dcaData([]), view(1.4));
        expect(empty.count).toBe(0);
        expect(empty.still?.className).toContain('dca-chart--empty');
        expect(dcaFrame(dcaData([0, 0], { invested: [0, 0], lump: [0, 0] }))?.max).toBe(1);
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e300]) {
            const layout = dcaLayout(dcaData([1, bad, 3]), view(1.4));
            expect(allFinite(layout)).toBe(true);
        }
    });
});

describe('address scene', () => {
    it('reads each character as its place in the alphabet', () => {
        expect(charLevels('bc1q')).toEqual([0.5, 0.5, 0.15, 1 / 32]);
        expect(charLevels('1A0')[2]).toBe(-1);
        expect(bech32Roles('bc1qxyzqpzry9')).toEqual([
            'hrp',
            'hrp',
            'separator',
            'version',
            'program',
            'program',
            'program',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
        ]);
    });

    it('raises the suspect character, loosens a bad checksum and rebuilds when the state changes', () => {
        const text = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        const base = {
            id: 'address',
            text,
            roles: bech32Roles(text),
            state: 'invalid',
            suspect: 7,
            checksumBad: true,
            kind: 'Invalid',
        } as const;
        const layout = addressLayout(base, view(2));
        expect(count(layout, 'ember')).toBeGreaterThan(0);
        expect(count(layout, 'ghost')).toBeGreaterThan(0);
        const valid = addressLayout(
            { ...base, state: 'valid', suspect: null, checksumBad: false, kind: 'Native SegWit' },
            view(2),
        );
        expect(inBox(valid, 2)).toBe(true);
        expect(valid.rebuild).not.toBe(layout.rebuild);
        expect(labels(valid)).toEqual(['Native SegWit', '42 characters']);
    });
});

describe('every scene through the guarded loader', () => {
    const cases: [SceneId, SceneData][] = [
        ['left', { id: 'left', height: Number.NaN }],
        ['power', { id: 'power', cash: Number.NaN, bitcoin: Number.NaN }],
        ['convert', { id: 'convert', sats: Number.NaN }],
        ['dca', dcaData([Number.NaN, 2])],
        [
            'address',
            { id: 'address', text: '\u0000'.repeat(500), roles: [], state: 'invalid', suspect: 9e9, checksumBad: true },
        ],
    ];

    it('never lets NaN, Infinity or an off-plot point through, at any viewport', async () => {
        for (const [id, data] of cases) {
            const build = await loadLayout(id);
            for (const [aspect, pixels] of [
                [Number.NaN, 0],
                [0, 100],
                [Number.POSITIVE_INFINITY, 300],
                [1e-9, -5],
                [1.5, 240],
            ] as const) {
                const layout = build(data, { aspect, pixels });
                expect(allFinite(layout), `${id} at ${aspect}`).toBe(true);
                expect(layout.count).toBeLessThanOrEqual(MAX_POINTS);
            }
        }
    });

    it('gives the home scene no points', async () => {
        expect((await loadLayout('home'))({ id: 'home' }, view(1)).count).toBe(0);
    });
});
