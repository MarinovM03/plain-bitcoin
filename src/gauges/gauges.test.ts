import { describe, expect, it } from 'vitest';
import { addressLayout, foreignChars } from './address.ts';
import { dcaFrame, dcaLayout, niceStep, yearTicks } from './dca.ts';
import { feesLayout } from './fees.ts';
import { loadLayout } from './index.ts';
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

describe('power gauge', () => {
    it('fills two columns on the same scale as the bars, switching to log at ten times', () => {
        expect(powerFills(1000, 2000)).toEqual({ fills: [0.5, 1], ghost: 0, log: false, decade: 0 });
        const big = powerFills(1000, 435_560);
        expect(big.log).toBe(true);
        expect(big.fills[1]).toBe(1);
        expect(big.fills[0]).toBeGreaterThan(0);
        expect(powerFills(0, 5)).toEqual({ fills: [0, 0], ghost: 0, log: false, decade: 0 });
    });

    it('outlines what the cash would need to be today above the cash column, on the same scale', () => {
        expect(powerFills(1000, 2000, 1300)).toEqual({ fills: [0.5, 1], ghost: 0.65, log: false, decade: 0 });
        const lost = powerFills(1000, 900, 1300);
        expect(lost.ghost).toBe(1);
        expect(lost.fills[0]).toBeCloseTo(1000 / 1300);
        const data = {
            id: 'power',
            cash: 1000,
            bitcoin: 2000,
            cashLabel: '$1,000',
            needed: 1300,
            neededLabel: '$1,300',
            cashThen: '= $769',
            bitcoinThen: '= $1,538',
            thenNote: 'in 2020 money',
        } as const;
        const layout = powerLayout(data, VIEW);
        sane(layout);
        const mark = (gauge: Gauge, key: string) => gauge.marks.find((each) => each.key === key);
        expect(mark(layout, 'ghost')?.attrs.style).toBe('transform: scaleY(0.65)');
        expect(text(layout, 'then0')).toBe('= $769');
        expect(text(layout, 'then1')).toBe('= $1,538');
        expect(text(layout, 'year0')).toBe('in 2020 money');
        expect(text(layout, 'needed')).toBe('$1,300 to keep up');
        expect(mark(layout, 'value0')?.attrs.class).toContain('g-label--on-btc');
        const short = powerLayout({ ...data, cash: 250, needed: 300 }, VIEW);
        expect(short.marks.some((each) => each.key === 'needed')).toBe(false);
        expect(mark(short, 'value0')?.attrs.class).toContain('g-label--cool');
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

    it('regrows the columns for a new amount, whose shape alone would not change', () => {
        const data = { id: 'power', cash: 1000, bitcoin: 3000 } as const;
        const more = powerLayout({ ...data, cash: 50_000, bitcoin: 150_000 }, VIEW);
        expect(more.rebuild).not.toBe(powerLayout(data, VIEW).rebuild);
        expect(more.build).toBe('grow');
    });

    it('survives Infinity and NaN inputs', () => {
        for (const view of SIZES)
            sane(powerLayout({ id: 'power', cash: Number.POSITIVE_INFINITY, bitcoin: Number.NaN }, view));
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
    it('draws three series in three inks, ending on the answer', () => {
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
        for (const id of ['power', 'dca', 'address'] as const) {
            const layout = await loadLayout(id);
            sane(layout({ id } as SceneData, VIEW));
        }
        const power = await loadLayout('power');
        const broken = power(
            {
                id: 'power',
                get cash(): number {
                    throw new Error('boom');
                },
            } as SceneData,
            VIEW,
        );
        expect(broken.summary).toBe('error');
    });
});

describe('fees gauge', () => {
    const rows = [
        { name: 'Next block', value: '$0.45 · 564 sats', sats: 564 },
        { name: 'About 30 minutes', value: '$0.34 · 423 sats', sats: 423 },
        { name: 'About an hour', value: '$0.28 · 353 sats', sats: 353 },
        { name: 'No rush', value: '$0.01 · 15 sats', sats: 15 },
    ];

    it('draws one bar per wait, as long as its cost against the dearest, with its name and cost', () => {
        const gauge = feesLayout({ id: 'fees', rows }, VIEW);
        sane(gauge);
        const width = (key: string) => Number(gauge.marks.find((mark) => mark.key === key)?.attrs.width);
        expect(width('bar0')).toBe(VIEW.width);
        expect(width('bar2') / width('bar0')).toBeCloseTo(353 / 564, 2);
        expect(width('bar3')).toBeGreaterThan(0);
        expect(text(gauge, 'name0')).toBe('Next block');
        expect(text(gauge, 'value3')).toBe('$0.01 · 15 sats');
    });

    it('stays sane at every size and with no rows', () => {
        for (const size of SIZES) sane(feesLayout({ id: 'fees', rows }, size));
        expect(feesLayout({ id: 'fees', rows: [] }, VIEW).marks).toEqual([]);
    });
});
