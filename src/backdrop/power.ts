import { type BackdropData, frameAspect, type Mark, SHAPE, share } from './types.ts';

const MAX_ROWS = 24;

/** What a unit of money still buys at the start of each year, from the start month to the newest CPI month. */
export function keptByYear(cpi: Readonly<Record<string, number>>, start: string, latest: string): number[] {
    const base = cpi[start];
    const last = cpi[latest];
    if (base === undefined || last === undefined || !(base > 0) || start > latest) return [];
    const kept = [1];
    const [year = '', month = ''] = start.split('-');
    for (let next = Number(year) + 1; `${next}-${month}` < latest; next += 1) {
        const index = cpi[`${next}-${month}`];
        if (index !== undefined && index > 0) kept.push(base / index);
    }
    kept.push(base / last);
    return kept;
}

function sample(kept: readonly number[]): number[] {
    if (kept.length <= MAX_ROWS) return [...kept];
    return Array.from(
        { length: MAX_ROWS },
        (_, row) => kept[Math.round((row * (kept.length - 1)) / (MAX_ROWS - 1))] ?? 1,
    );
}

/** A row of notes per year, the start year on top: each row is as large as what the money still buys. */
export function plan(data: BackdropData | null, aspect: number): Mark[] {
    const kept = sample(data?.id === 'power' && data.kept.length > 0 ? data.kept : [1]);
    const a = frameAspect(aspect);
    const perRow = a < 1 ? 6 : 14;
    const cellWide = (2 * a * 0.94) / perRow;
    const cellTall = Math.min(1.8 / kept.length, cellWide * 0.6);
    const marks: Mark[] = [];
    kept.forEach((value, row) => {
        const scale = Math.sqrt(share(value));
        const y = ((kept.length - 1) / 2 - row) * cellTall;
        for (let column = 0; column < perRow; column += 1) {
            const x = (column - (perRow - 1) / 2) * cellWide;
            const tall = cellTall * 0.68 * scale;
            marks.push(
                { x, y, w: cellWide * 0.8 * scale, h: tall, tone: 'cool', level: 0.7, shape: SHAPE.square },
                {
                    x: x + (((column * 7 + row * 3) % 5) - 2) * cellWide * 0.1 * scale,
                    y: y - tall / 2,
                    w: cellWide * 0.07,
                    h: cellWide * 0.07,
                    tone: 'cool',
                    level: value < 0.985 ? 0.7 : 0,
                    shape: SHAPE.drip,
                },
            );
        }
    });
    return marks;
}
