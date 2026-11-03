import { MAX_SATS } from '../../model/convert.ts';
import { formatWhole } from '../../util/format.ts';
import { GRID_DOTS, satsScale } from '../../util/sats-scale.ts';
import {
    emptyLayout,
    finite,
    type Guide,
    inkIndex,
    type Layout,
    plotBox,
    type SceneData,
    type Viewport,
} from './types.ts';

const BLOCK = 10;
const BLOCK_DOTS = BLOCK * BLOCK;
const BLOCKS = GRID_DOTS / BLOCK_DOTS;
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
 * A counting grid of 1,000 dots in ten blocks of 100. Each dot is a power of ten of sats, chosen so the amount
 * lights at most the whole grid; a change of ten zooms the grid in or out by the square root of ten.
 */
export function convertLayout(data: SceneData, view: Viewport): Layout {
    const sats = satsOf(data);
    const scale = satsScale(sats);
    const box = plotBox(view.aspect, { top: 0.14, bottom: 0.14 });
    let best = { across: 5, down: 2, cell: 0 };
    for (const [across, down] of ARRANGEMENTS) {
        const cell = Math.min(box.w / (across * (BLOCK + 1) - 1), box.h / (down * (BLOCK + 1) - 1));
        if (cell > best.cell) best = { across, down, cell };
    }
    const { across, down, cell } = best;
    const width = (across * (BLOCK + 1) - 1) * cell;
    const height = (down * (BLOCK + 1) - 1) * cell;
    const left = box.x + (box.w - width) / 2;
    const top = box.y + (box.h - height) / 2;
    const exponent = Math.round(Math.log10(scale.perDot));
    const layout = emptyLayout(GRID_DOTS, `convert:${across}:${exponent}`);
    for (let i = 0; i < GRID_DOTS; i += 1) {
        const block = Math.floor(i / BLOCK_DOTS);
        const inBlock = i % BLOCK_DOTS;
        const bx = block % across;
        const by = Math.floor(block / across);
        layout.x[i] = left + (bx * (BLOCK + 1) + (inBlock % BLOCK) + 0.5) * cell;
        layout.y[i] = top + (by * (BLOCK + 1) + Math.floor(inBlock / BLOCK) + 0.5) * cell;
        layout.order[i] = i / GRID_DOTS;
        if (i < scale.filled) {
            layout.ink[i] = inkIndex('btc');
            layout.r[i] = cell * 0.36;
        } else if (i === scale.filled && scale.partial > 0) {
            layout.ink[i] = inkIndex('ember');
            layout.r[i] = cell * (0.1 + 0.26 * scale.partial);
        } else {
            layout.ink[i] = inkIndex('faint');
            layout.r[i] = cell * 0.16;
        }
    }
    layout.entry = { x: left, y: top, k: exponent };
    const guides: Guide[] = [
        {
            kind: 'label',
            x: left,
            y: top - cell * 1.6,
            text: `1 dot = ${unitText(scale.perDot)}`,
            align: 'start',
            tone: 'btc',
        },
        {
            kind: 'label',
            x: left + width,
            y: top + height + cell * 1.6,
            text: `${BLOCKS} blocks of 100 = ${unitText(scale.perDot * GRID_DOTS)}`,
            align: 'end',
            tone: 'muted',
        },
    ];
    layout.guides = guides;
    layout.summary = `sats=${sats};perDot=${scale.perDot};lit=${scale.filled}`;
    return layout;
}
