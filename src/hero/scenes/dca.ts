import { sampleIndices } from '../../model/scale.ts';
import { formatMoney } from '../../util/format.ts';
import {
    emptyLayout,
    finite,
    type Guide,
    type Ink,
    inkIndex,
    type Layout,
    plotBox,
    type SceneData,
    type StillPath,
    type Viewport,
} from './types.ts';

export const BUY_MARKS = 1000;
export const LINE_SAMPLES = 600;
export const PATH_SAMPLES = 360;
const DOT_PX = 2;
const MAX_YEAR_TICKS = 6;

interface Series {
    key: 'lump' | 'invested' | 'value';
    values: readonly number[];
    ink: Ink;
    size: number;
    samples: number;
}

export interface DcaFrame {
    t0: number;
    t1: number;
    max: number;
    length: number;
}

/** One domain for the dots, the SVG and the axes: first mark to the as-of day, zero to the highest value of any series. */
export function dcaFrame(data: SceneData): DcaFrame | null {
    if (data.id !== 'dca') return null;
    // A series may be left out (a home preview has no value line); every series that is drawn has one mark per t.
    const drawn = [data.value, data.invested, data.lump].filter((values) => values.length > 0);
    const length = drawn.length > 0 ? Math.min(data.t.length, ...drawn.map((values) => values.length)) : 0;
    if (length === 0) return null;
    const t0 = finite(data.t[0] ?? 0);
    const t1 = finite(data.t[length - 1] ?? 0);
    let max = 0;
    for (let i = 0; i < length; i += 1)
        max = Math.max(max, finite(data.value[i] ?? 0), finite(data.invested[i] ?? 0), finite(data.lump[i] ?? 0));
    return { t0, t1: t1 > t0 ? t1 : t0 + 1, max: max > 0 ? max : 1, length };
}

export function niceStep(max: number, ticks = 3): number {
    const raw = max / ticks;
    const power = 10 ** Math.floor(Math.log10(raw));
    const unit = raw / power;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function yearTicks(t0: number, t1: number): number[] {
    const first = new Date(t0).getUTCFullYear() + 1;
    const last = new Date(t1).getUTCFullYear();
    const years: number[] = [];
    for (let year = first; year <= last; year += 1) years.push(year);
    const step = Math.ceil(years.length / MAX_YEAR_TICKS) || 1;
    return years.filter((year) => (year - first) % step === 0);
}

/**
 * Buys accumulating along time: an orange mark for what the stack was worth at each buy, a white line for the money
 * put in and a grey ghost for one lump sum on the first day. The last mark is the answer.
 */
export function dcaLayout(data: SceneData, view: Viewport): Layout {
    const frame = dcaFrame(data);
    if (!frame || data.id !== 'dca') {
        const empty = emptyLayout(0, 'dca:0');
        empty.still = { className: 'dca-chart dca-chart--empty', alt: '' };
        empty.paths = ['lump', 'invested', 'value'].map((key) => ({
            className: `dca-chart__line dca-chart__line--${key}`,
            points: [],
        }));
        return empty;
    }
    const box = plotBox(view.aspect, { top: 0.16, bottom: 0.13, left: 0.04, right: 0.04 });
    const x = (t: number) => box.x + ((finite(t) - frame.t0) / (frame.t1 - frame.t0)) * box.w;
    const y = (value: number) => box.y + box.h - (Math.max(0, finite(value)) / frame.max) * box.h;
    const series: Series[] = [
        { key: 'lump', values: data.lump, ink: 'ghost', size: 0.8, samples: LINE_SAMPLES },
        { key: 'invested', values: data.invested, ink: 'paper', size: 0.6, samples: LINE_SAMPLES },
        { key: 'value', values: data.value, ink: 'btc', size: 1.3, samples: BUY_MARKS },
    ];
    const sampled = series.map((entry) => ({
        ...entry,
        indices: entry.values.length > 0 ? sampleIndices(frame.length, entry.samples) : [],
    }));
    const count = sampled.reduce((total, entry) => total + entry.indices.length, 0);
    const layout = emptyLayout(count, 'dca');
    const pixels = Math.max(1, finite(view.pixels, 200));
    let i = 0;
    for (const { values, ink, size, indices } of sampled) {
        for (const index of indices) {
            const px = x(data.t[index] ?? frame.t0);
            layout.x[i] = px;
            layout.y[i] = y(values[index] ?? 0);
            layout.order[i] = (px - box.x) / box.w;
            layout.ink[i] = inkIndex(ink);
            layout.r[i] = (DOT_PX * size) / pixels;
            i += 1;
        }
    }

    const pathIndices = sampleIndices(frame.length, PATH_SAMPLES);
    layout.paths = series.map(
        ({ key, values }): StillPath => ({
            className: `dca-chart__line dca-chart__line--${key}`,
            points:
                values.length > 0
                    ? pathIndices.map((index) => [x(data.t[index] ?? frame.t0), y(values[index] ?? 0)] as const)
                    : [],
        }),
    );
    layout.still = { className: 'dca-chart', alt: data.alt };

    const guides: Guide[] = [];
    const base = box.y + box.h;
    guides.push({ kind: 'rule', x1: box.x, y1: base, x2: box.x + box.w, y2: base, tone: 'muted' });
    const step = niceStep(frame.max);
    for (let value = step; value < frame.max * 0.98; value += step) {
        guides.push(
            { kind: 'rule', x1: box.x, y1: y(value), x2: box.x + box.w, y2: y(value), tone: 'muted' },
            {
                kind: 'label',
                x: box.x,
                y: y(value) - 0.035,
                text: formatMoney(value, data.fiat),
                align: 'start',
                tone: 'muted',
            },
        );
    }
    for (const year of yearTicks(frame.t0, frame.t1)) {
        const at = x(Date.UTC(year, 0, 1));
        guides.push({ kind: 'label', x: at, y: base + 0.065, text: String(year), align: 'middle', tone: 'muted' });
    }
    const last = frame.length - 1;
    const endX = x(data.t[last] ?? frame.t1);
    const endY = y(data.value[last] ?? 0);
    guides.push({
        kind: 'label',
        x: endX,
        y: Math.max(0.06, endY - 0.075),
        text: data.worth,
        align: 'end',
        tone: 'btc',
    });
    layout.guides = guides;
    layout.summary = `marks=${frame.length};end=${finite(data.value[last] ?? 0).toFixed(2)};worth=${data.worth}`;
    return layout;
}
