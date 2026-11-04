import { MAX_SATS } from '../model/convert.ts';
import { GAUGE } from '../ui/copy.ts';
import { formatWhole } from '../util/format.ts';
import { GRID_DOTS, satsScale } from '../util/sats-scale.ts';
import { finite, gauge, label, labelSize, px, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

const BLOCK = 10;
const BLOCK_CELLS = BLOCK * BLOCK;
const BLOCKS = GRID_DOTS / BLOCK_CELLS;
const ARRANGEMENTS = [
    [10, 1],
    [5, 2],
    [2, 5],
    [1, 10],
] as const;

export function satsOf(data: SceneData): number {
    if (data.id !== 'convert') return 0;
    const sats = Math.floor(finite(data.sats));
    return sats > 0 ? Math.min(sats, MAX_SATS) : 0;
}

/** A plain unit name for an amount of sats: sats below 0.001 BTC, bitcoin from there up. */
export function unitText(sats: number): string {
    if (sats < 100_000) return `${formatWhole(sats)} ${sats === 1 ? 'sat' : 'sats'}`;
    const btc = sats / 100_000_000;
    if (btc < 1) return `${String(Number(btc.toFixed(8)))} BTC`;
    return `${formatWhole(btc)} BTC`;
}

/**
 * A counting grid of 1,000 square cells in ten blocks of 100. Each cell is a power of ten of sats, chosen so the
 * amount fills at most the whole grid; a change of ten zooms the grid in or out.
 */
export function convertLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const sats = satsOf(data);
    const scale = satsScale(sats);
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    const padTop = mini ? 4 : size * 2.4;
    const padBottom = mini ? 4 : size * 2.2;
    const boxW = w - 8;
    const boxH = Math.max(1, h - padTop - padBottom);
    let best = { across: 5, down: 2, cell: 0 };
    for (const [across, down] of ARRANGEMENTS) {
        const cell = Math.min(boxW / (across * (BLOCK + 1) - 1), boxH / (down * (BLOCK + 1) - 1));
        if (cell > best.cell) best = { across, down, cell };
    }
    const { across, down, cell } = best;
    const gridW = (across * (BLOCK + 1) - 1) * cell;
    const gridH = (down * (BLOCK + 1) - 1) * cell;
    const left = (w - gridW) / 2;
    const top = padTop + (boxH - gridH) / 2;
    const exponent = Math.round(Math.log10(scale.perDot));
    const square = Math.max(1, cell - Math.max(1, cell * 0.16));
    const marks: Mark[] = [];
    for (let i = 0; i < GRID_DOTS; i += 1) {
        const block = Math.floor(i / BLOCK_CELLS);
        const inBlock = i % BLOCK_CELLS;
        const x = left + ((block % across) * (BLOCK + 1) + (inBlock % BLOCK)) * cell;
        const y = top + (Math.floor(block / across) * (BLOCK + 1) + Math.floor(inBlock / BLOCK)) * cell;
        const filled = i < scale.filled;
        const partial = i === scale.filled && scale.partial > 0;
        marks.push(rect(`c${i}`, x, y, square, square, filled ? 'g-cell g-cell--btc' : 'g-cell'));
        if (partial) {
            marks.push(
                rect('partial', x, y, square, square, 'g-cell g-cell--btc g-cell--part', {
                    style: `transform: scaleY(${px(scale.partial)})`,
                }),
            );
        }
    }
    if (!mini) {
        marks.push(
            label(
                'unit',
                left,
                top - size * 0.9,
                GAUGE.convert.perCell(unitText(scale.perDot)),
                'g-label g-label--btc',
            ),
            label(
                'blocks',
                left + gridW,
                top + gridH + size * 1.6,
                GAUGE.convert.blocks(BLOCKS, unitText(scale.perDot * GRID_DOTS)),
                'g-label',
                'end',
            ),
        );
    }
    return gauge(view, {
        marks,
        rebuild: `convert:${across}:${exponent}`,
        build: 'zoom-in',
        origin: [left, top],
        className: 'gauge-convert',
        summary: `sats=${sats};perDot=${scale.perDot};lit=${scale.filled}`,
    });
}
