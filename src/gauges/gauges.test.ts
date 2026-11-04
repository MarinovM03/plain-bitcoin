import { describe, expect, it } from 'vitest';
import { MAX_SUPPLY, SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { addressLayout, foreignChars } from './address.ts';
import { convertLayout, unitText } from './convert.ts';
import { dcaFrame, dcaLayout, niceStep, yearTicks } from './dca.ts';
import { loadLayout } from './index.ts';
import { leftFill, leftLayout } from './left.ts';
import { buildFor } from './paint.ts';
import { powerFills, powerLayout } from './power.ts';
import type { Gauge, Mark, SceneData } from './types.ts';

const VIEW = { width: 520, height: 320, mini: false };
const SIZES = [
    { width: 320, height: 160, mini: false },
    { width: 820, height: 560, mini: false },
    { width: 110, height: 70, mini: true },
];

function numbers(mark: Mark): number[] {
    return Object.entries(mark.attrs)
        .filter(([name]) => ['x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r'].includes(name))
        .map(([, value]) => Number(value));
}

/** Every number written into the SVG is finite and every key is unique, whatever the input. */
function sane(gauge: Gauge): void {
    const keys = new Set<string>();
    for (const mark of gauge.marks) {
        expect(keys.has(mark.key), `duplicate ${mark.key}`).toBe(false);
        keys.add(mark.key);
        for (const value of numbers(mark)) expect(Number.isFinite(value), `${mark.key} ${value}`).toBe(true);
        if (mark.tag === 'polyline') expect(String(mark.attrs.points)).not.toMatch(/NaN|Infinity/);
        expect(String(mark.attrs.style ?? '')).not.toMatch(/NaN|Infinity/);
    }
}

const text = (gauge: Gauge, key: string) => gauge.marks.find((mark) => mark.key === key)?.text;

describe('left gauge', () => {
    it('splits the 21 million at the real issued amount, in ink and orange', () => {
        const height = 974_569;
        const gauge = leftLayout({ id: 'left', height }, VIEW);
        sane(gauge);
        const supply = supplyAt(height);
        expect(gauge.summary).toBe(`issued=${supply.issued};max=${MAX_SUPPLY};left=${supply.left}`);
        expect(text(gauge, 'left-in')).toBe('891,968');
        expect(gauge.marks.filter((mark) => mark.attrs.class === 'g-outline--btc')).toHaveLength(1);
        expect(text(gauge, 'mined')).toBe('95.7525% mined');
    });

    it('offers every era as a tap target whose reading names its dates and reward', () => {
        const gauge = leftLayout({ id: 'left', height: 974_569 }, VIEW);
        const tips = gauge.marks.filter((mark) => mark.attrs['data-tip']).map((mark) => String(mark.attrs['data-tip']));
        expect(tips[0]).toMatch(/^Era 1 · 3 Jan 2009 to 28 Nov 2012 · 50 BTC a block/);
        expect(tips.some((tip) => /^Era 5 · since 20 Apr 2024 · 3\.125 BTC a block · being mined now$/.test(tip))).toBe(
            true,
        );
    });

    it('never draws NaN or a broken box for a bad height or size', () => {
        for (const height of [Number.NaN, -1, 0, 1.5, 10_000_000]) {
            for (const view of SIZES) sane(leftLayout({ id: 'left', height }, view));
        }
        expect(leftFill(Number.NaN).issued).toBe(supplyAt(0).issued);
        sane(leftLayout({ id: 'left', height: 1 }, { width: Number.NaN, height: -4, mini: false }));
    });
});

describe('power gauge', () => {
    it('fills two columns on the same scale as the bars, switching to log at ten times', () => {
        expect(powerFills(1000, 2000)).toEqual({ fills: [0.5, 1], log: false, decade: 0 });
        const big = powerFills(1000, 435_560);
        expect(big.log).toBe(true);
        expect(big.fills[1]).toBe(1);
        expect(big.fills[0]).toBeGreaterThan(0);
        expect(powerFills(0, 5)).toEqual({ fills: [0, 0], log: false, decade: 0 });
    });

    it('labels each column with the answer text and moves the same column for a new value', () => {
        const data = { id: 'power', cash: 1000, bitcoin: 1500, cashLabel: '£1,000', bitcoinLabel: '£1,500' } as const;
        const a = powerLayout(data, VIEW);
        const b = powerLayout({ ...data, bitcoin: 1800, bitcoinLabel: '£1,800' }, VIEW);
        sane(a);
        expect(text(a, 'value1')).toBe('£1,500');
        expect(text(b, 'value1')).toBe('£1,800');
        expect(a.rebuild).toBe(b.rebuild);
        expect(a.marks.find((mark) => mark.key === 'col1')?.attrs.style).toBe('transform: scaleY(1)');
    });

    it('survives Infinity and NaN inputs', () => {
        for (const view of SIZES)
            sane(powerLayout({ id: 'power', cash: Number.POSITIVE_INFINITY, bitcoin: Number.NaN }, view));
    });
});

describe('converter gauge', () => {
    it('fills one cell per unit of the grid and names the unit', () => {
        const gauge = convertLayout({ id: 'convert', sats: 2000 }, VIEW);
        sane(gauge);
        expect(gauge.summary).toBe('sats=2000;perDot=10;lit=200');
        expect(text(gauge, 'unit')).toBe('1 cell = 10 sats');
        expect(gauge.marks.filter((mark) => String(mark.attrs.class).includes('g-cell--btc'))).toHaveLength(200);
    });

    it('rebuilds by zoom only when the unit changes by ten', () => {
        const a = convertLayout({ id: 'convert', sats: 2000 }, VIEW);
        const b = convertLayout({ id: 'convert', sats: 3000 }, VIEW);
        const c = convertLayout({ id: 'convert', sats: 30_000 }, VIEW);
        expect(a.rebuild).toBe(b.rebuild);
        expect(buildFor(a.rebuild, c)).toBe('zoom-out');
        expect(buildFor(c.rebuild, a)).toBe('zoom-in');
        expect(buildFor(null, a)).toBe('none');
    });

    it('names units plainly and clamps impossible amounts', () => {
        expect(unitText(1)).toBe('1 sat');
        expect(unitText(100_000)).toBe('0.001 BTC');
        expect(unitText(SATS_PER_BTC * 10)).toBe('10 BTC');
        for (const sats of [Number.NaN, -5, Number.POSITIVE_INFINITY])
            sane(convertLayout({ id: 'convert', sats }, VIEW));
    });
});

const DAY = 86_400_000;
const T0 = Date.UTC(2020, 0, 1);
function dcaData(length: number, scale = 1): SceneData {
    return {
        id: 'dca',
        fiat: 'GBP',
        worth: '£9,999',
        alt: 'Line chart.',
        t: Array.from({ length }, (_, i) => T0 + i * 7 * DAY),
        value: Array.from({ length }, (_, i) => (i + 1) * 60 * scale),
        invested: Array.from({ length }, (_, i) => (i + 1) * 50 * scale),
        lump: Array.from({ length }, (_, i) => 50 * length * (1 + i / length) * scale),
    };
}

describe('dca gauge', () => {
    it('draws three series in three inks, ending on the answer, with a legend in plain words', () => {
        const gauge = dcaLayout(dcaData(300), VIEW);
        sane(gauge);
        const lines = gauge.marks.filter((mark) => mark.tag === 'polyline');
        expect(lines.map((mark) => mark.attrs.class)).toEqual([
            'dca-chart__line dca-chart__line--lump',
            'dca-chart__line dca-chart__line--invested',
            'dca-chart__line dca-chart__line--value',
        ]);
        for (const line of lines) expect(String(line.attrs.points).split(' ').length).toBeGreaterThan(50);
        expect(text(gauge, 'end')).toBe('£9,999');
        expect(text(gauge, 'legend-value')).toBe('Buying on a schedule');
        expect(gauge.alt).toBe('Line chart.');
    });

    it('puts the end point inside the plot, never clipped, and on the last value', () => {
        const gauge = dcaLayout(dcaData(300), VIEW);
        const dot = gauge.marks.find((mark) => mark.key === 'end-dot');
        const value = String(gauge.marks.find((mark) => mark.key === 'value')?.attrs.points)
            .split(' ')
            .at(-1);
        expect(`${dot?.attrs.cx},${dot?.attrs.cy}`).toBe(value);
        expect(Number(dot?.attrs.cx)).toBeLessThanOrEqual(VIEW.width - 3.5);
    });

    it('keeps its structure when only the amount changes, so the lines do not replay', () => {
        expect(dcaLayout(dcaData(300), VIEW).rebuild).toBe(dcaLayout(dcaData(300, 3), VIEW).rebuild);
        expect(dcaLayout(dcaData(300), VIEW).rebuild).not.toBe(dcaLayout(dcaData(120), VIEW).rebuild);
    });

    it('draws an honest empty chart with no answer, and labels axes in money and years', () => {
        const empty = dcaLayout({ ...dcaData(0) }, VIEW);
        expect(empty.className).toBe('dca-chart dca-chart--empty');
        expect(dcaFrame(dcaData(0))).toBeNull();
        expect(niceStep(229_000)).toBe(100_000);
        expect(yearTicks(T0, Date.UTC(2026, 9, 1))).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    });
});

describe('address gauge', () => {
    const segwit = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const valid = {
        id: 'address',
        text: segwit,
        roles: [],
        state: 'valid',
        suspect: null,
        checksumBad: false,
        kind: 'SegWit',
    } as const;

    it('stands each character in its own cell and stamps the type once valid', () => {
        const gauge = addressLayout(valid, VIEW);
        sane(gauge);
        expect(gauge.summary).toBe('state=valid;chars=42');
        expect(gauge.marks.filter((mark) => mark.tag === 'text' && mark.key.startsWith('t'))).toHaveLength(42);
        expect(text(gauge, 'kind')).toBe('SegWit · checksum valid');
        expect(gauge.build).toBe('lock');
    });

    it('marks a foreign character and leaves a bad checksum loose', () => {
        expect(foreignChars('bc1qb0').slice(4)).toEqual([true, false]);
        const bad = addressLayout(
            { ...valid, text: `${segwit.slice(0, 10)}b${segwit.slice(11)}`, state: 'invalid' },
            VIEW,
        );
        expect(bad.marks.find((mark) => mark.key === 'c10')?.attrs.class).toContain('g-char--bad');
        const loose = addressLayout({ ...valid, state: 'invalid', checksumBad: true }, VIEW);
        expect(loose.marks.find((mark) => mark.key === 'c41')?.attrs.class).toContain('g-char--loose');
    });

    it('shows placeholder cells when empty, and survives absurd input', () => {
        expect(addressLayout({ ...valid, text: '', state: 'empty' }, VIEW).summary).toBe('state=empty;chars=0');
        sane(
            addressLayout({ ...valid, text: 'x'.repeat(500), state: 'invalid' }, { width: 1, height: 1, mini: false }),
        );
    });
});

describe('loadLayout', () => {
    it('loads every gauge and turns a throw into an empty gauge, never a broken one', async () => {
        for (const id of ['home', 'left', 'power', 'convert', 'dca', 'address'] as const) {
            const layout = await loadLayout(id);
            sane(layout({ id } as SceneData, VIEW));
        }
        const left = await loadLayout('left');
        const broken = left(
            {
                id: 'left',
                get height(): number {
                    throw new Error('boom');
                },
            } as SceneData,
            VIEW,
        );
        expect(broken.summary).toBe('error');
    });
});
