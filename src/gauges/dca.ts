import { sampleIndices } from '../model/scale.ts';
import { DCA, GAUGE } from '../ui/copy.ts';
import { formatMoney } from '../util/format.ts';
import { circle, finite, gauge, label, labelSize, line, polyline, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

export const PATH_SAMPLES = 360;
const MAX_YEAR_TICKS = 6;
export const SERIES = ['lump', 'invested', 'value'] as const;
export type SeriesKey = (typeof SERIES)[number];

export interface DcaFrame {
    t0: number;
    t1: number;
    max: number;
    length: number;
}

/** One domain for the lines and the axes: first mark to the as-of day, zero to the highest value of any series. */
export function dcaFrame(data: SceneData): DcaFrame | null {
    if (data.id !== 'dca') return null;
    // A series may be left out (a home preview has no lump line); every series drawn has one mark per t.
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

const LINE_CLASS: Record<SeriesKey, string> = {
    lump: 'dca-chart__line dca-chart__line--lump',
    invested: 'dca-chart__line dca-chart__line--invested',
    value: 'dca-chart__line dca-chart__line--value',
};

function legend(view: Viewport, size: number): Mark[] {
    const narrow = view.width < 430;
    const words = narrow ? GAUGE.dca.short : DCA.legend;
    const order: SeriesKey[] = ['value', 'invested', 'lump'];
    const marks: Mark[] = [];
    let x = 2;
    const y = size * 1.15;
    for (const key of order) {
        marks.push(
            line(`key-${key}`, x, y - size * 0.32, x + 14, y - size * 0.32, `dca-chart__key dca-chart__key--${key}`),
        );
        marks.push(
            label(`legend-${key}`, x + 19, y, words[key], `g-label dca-chart__legend dca-chart__legend--${key}`),
        );
        x += 19 + words[key].length * size * 0.6 + size * 1.3;
    }
    return marks;
}

/**
 * Buys accumulating along time: orange for what the stack was worth at each buy, a thin white line for the money
 * put in and a dashed steel line for one lump sum on the first day. The last orange point is the answer.
 */
export function dcaLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const frame = dcaFrame(data);
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    if (!frame || data.id !== 'dca') {
        return gauge(view, {
            marks: SERIES.map((key) => polyline(key, [], LINE_CLASS[key])),
            rebuild: 'dca:empty',
            className: 'dca-chart dca-chart--empty',
            summary: 'marks=0;end=0;worth=',
        });
    }
    const top = mini ? 4 : size * 3.6;
    const base = mini ? h - 4 : h - size * 2.1;
    const left = mini ? 2 : 4;
    const right = w - (mini ? 4 : 8);
    const x = (t: number) => left + ((finite(t) - frame.t0) / (frame.t1 - frame.t0)) * (right - left);
    const y = (value: number) => base - (Math.max(0, finite(value)) / frame.max) * (base - top);
    const marks: Mark[] = [];
    if (!mini) {
        marks.push(...legend(view, size));
        const step = niceStep(frame.max);
        for (let value = step, k = 0; value < frame.max * 0.98; value += step, k += 1) {
            marks.push(
                line(`grid${k}`, left, y(value), right, y(value), 'g-rule g-rule--plate'),
                label(`ytick${k}`, left + 2, y(value) - 4, formatMoney(value, data.fiat), 'g-label g-label--small'),
            );
        }
        for (const year of yearTicks(frame.t0, frame.t1)) {
            const at = x(Date.UTC(year, 0, 1));
            marks.push(
                line(`yt${year}`, at, base, at, base + 4, 'g-rule'),
                label(`year${year}`, at, base + size * 1.5, String(year), 'g-label dca-chart__year', 'middle'),
            );
        }
    }
    marks.push(line('base', left, base, right, base, 'g-rule'));
    const indices = sampleIndices(frame.length, PATH_SAMPLES);
    const series: Record<SeriesKey, readonly number[]> = {
        lump: data.lump,
        invested: data.invested,
        value: data.value,
    };
    for (const key of SERIES) {
        const values = series[key];
        marks.push(
            polyline(
                key,
                values.length > 0 ? indices.map((i) => [x(data.t[i] ?? frame.t0), y(values[i] ?? 0)] as const) : [],
                LINE_CLASS[key],
            ),
        );
    }
    const last = frame.length - 1;
    const endX = x(data.t[last] ?? frame.t1);
    const endY = y(data.value[last] ?? 0);
    if (data.value.length > 0) {
        marks.push(circle('end-dot', endX, endY, mini ? 2 : 3.5, 'g-dot--btc'));
        if (!mini)
            marks.push(
                label('end', endX, Math.max(size * 2.6, endY - 9), data.worth, 'g-label g-label--btc g-end', 'end'),
            );
    }
    return gauge(view, {
        marks,
        rebuild: `dca:${frame.t0}:${frame.t1}:${frame.length}`,
        build: 'draw',
        className: 'dca-chart',
        alt: data.alt,
        summary: `marks=${frame.length};end=${finite(data.value[last] ?? 0).toFixed(2)};worth=${data.worth}`,
    });
}
