import { sampleIndices } from '../../model/scale.ts';
import { emptyLayout, type Ink, inkIndex, type Layout, plotBox, type SceneData } from './types.ts';

export const BUY_MARKS = 1000;
export const LINE_SAMPLES = 600;
const DOT_PX = 2;

interface Series {
    values: readonly number[];
    ink: Ink;
    size: number;
    samples: number;
}

function seriesOf(data: SceneData): Series[] {
    if (data.id !== 'dca') return [];
    const all: Series[] = [
        { values: data.lump, ink: 'ghost', size: 0.8, samples: LINE_SAMPLES },
        { values: data.invested, ink: 'paper', size: 0.6, samples: LINE_SAMPLES },
        { values: data.value, ink: 'btc', size: 1.3, samples: BUY_MARKS },
    ];
    return all.filter((series) => series.values.length > 0);
}

export function dcaLayout(data: SceneData, aspect: number, pixels: number): Layout {
    const series = seriesOf(data).map((entry) => ({
        ...entry,
        indices: sampleIndices(entry.values.length, entry.samples),
    }));
    const max = Math.max(0, ...series.flatMap(({ values }) => values)) || 1;
    const box = plotBox(aspect);
    const count = series.reduce((total, entry) => total + entry.indices.length, 0);
    const layout = emptyLayout(count, `dca:${series.length}`);
    let i = 0;
    for (const { values, ink, size, indices } of series) {
        const span = Math.max(1, values.length - 1);
        for (const index of indices) {
            layout.x[i] = box.x + (index / span) * box.w;
            layout.y[i] = box.y + box.h - ((values[index] ?? 0) / max) * box.h;
            layout.ink[i] = inkIndex(ink);
            layout.r[i] = (DOT_PX * size) / Math.max(1, pixels);
            i += 1;
        }
    }
    return layout;
}
