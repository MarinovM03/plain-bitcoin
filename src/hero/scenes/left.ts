import { issuedBeforeEra, SATS_PER_BTC, supplyAt } from '../../model/supply.ts';
import { emptyLayout, inkIndex, type Layout, plotBox, type SceneData } from './types.ts';

export const DOT_BTC = 10_000;
export const DOTS = 2100;
const GROUP = 10;
const DOT_SATS = DOT_BTC * SATS_PER_BTC;
const GROUPS = DOTS / (GROUP * GROUP);
const COLUMN_CHOICES = [1, 3, 4, 5, 6, 7, 11, 21];

export interface LeftFill {
    full: number;
    partial: number;
    eraStart: number;
}

export function leftFill(height: number): LeftFill {
    const supply = supplyAt(height);
    const dots = supply.issued / DOT_SATS;
    const full = Math.min(DOTS, Math.floor(dots));
    return {
        full,
        partial: full < DOTS ? dots - full : 0,
        eraStart: Math.floor(issuedBeforeEra(supply.era) / DOT_SATS),
    };
}

export function leftLayout(data: SceneData, aspect: number): Layout {
    const fill = leftFill(data.id === 'left' ? data.height : 0);
    const box = plotBox(aspect);
    let best = { cols: 7, rows: 3, cell: 0 };
    for (const cols of COLUMN_CHOICES) {
        const rows = Math.ceil(GROUPS / cols);
        const cell = Math.min(box.w / (cols * (GROUP + 1) - 1), box.h / (rows * (GROUP + 1) - 1));
        if (cell > best.cell) best = { cols, rows, cell };
    }
    const { cols, rows, cell } = best;
    const width = (cols * (GROUP + 1) - 1) * cell;
    const height = (rows * (GROUP + 1) - 1) * cell;
    const left = box.x + (box.w - width) / 2;
    const top = box.y + (box.h - height) / 2;
    const layout = emptyLayout(DOTS, `left:${cols}x${rows}`);
    for (let i = 0; i < DOTS; i += 1) {
        const group = Math.floor(i / (GROUP * GROUP));
        const inGroup = i % (GROUP * GROUP);
        const gx = group % cols;
        const gy = Math.floor(group / cols);
        layout.x[i] = left + (gx * (GROUP + 1) + (inGroup % GROUP) + 0.5) * cell;
        layout.y[i] = top + (gy * (GROUP + 1) + Math.floor(inGroup / GROUP) + 0.5) * cell;
        if (i < fill.full) {
            layout.ink[i] = inkIndex(i >= fill.eraStart ? 'btc' : 'paper');
            layout.r[i] = cell * 0.36;
        } else if (i === fill.full) {
            layout.ink[i] = inkIndex('ember');
            layout.r[i] = cell * (0.22 + 0.24 * fill.partial);
        } else {
            layout.ink[i] = inkIndex('faint');
            layout.r[i] = cell * 0.2;
        }
    }
    return layout;
}
