import type { DcaMarks } from '../../gauges/types.ts';
import { buyDays, type DcaResult, dayNumber } from '../../model/dca.ts';
import { isoDayMs } from '../../util/format.ts';

const DAY_MS = 86_400_000;

/** Index of each buy day in the result, plus the as-of day: the last mark is always today's value. */
export function buyIndices(result: DcaResult): number[] {
    const first = dayNumber(result.start);
    const last = dayNumber(result.lastBuy);
    if (first === null || last === null) return [];
    const indices = buyDays(result.frequency, first, last).map((day) => day - first);
    const end = result.points.length - 1;
    return indices.at(-1) === end ? indices : [...indices, end];
}

/** One mark per buy for every series: the gauge, the home tile and the postcard all draw from this. */
export function dcaMarks(result: DcaResult): DcaMarks {
    const first = isoDayMs(result.start);
    const marks = buyIndices(result);
    return {
        t: marks.map((i) => first + i * DAY_MS),
        value: marks.map((i) => result.points[i]?.value ?? 0),
        invested: marks.map((i) => result.points[i]?.invested ?? 0),
        lump: marks.map((i) => result.points[i]?.lumpValue ?? 0),
    };
}
