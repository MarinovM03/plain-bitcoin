import { barScale } from '../../model/scale.ts';
import { emptyLayout, type Ink, inkIndex, type Layout, plotBox, type SceneData } from './types.ts';

const COLS = 14;
const ROWS = 40;
const GAP = 5;

export function powerFills(cash: number, bitcoin: number): [number, number] {
    if (!(cash > 0) || !(bitcoin > 0)) return [0, 0];
    const { widths } = barScale([cash, bitcoin]);
    const slots = COLS * ROWS;
    return [Math.max(1, Math.round((widths[0] ?? 0) * slots)), Math.max(1, Math.round((widths[1] ?? 0) * slots))];
}

export function powerLayout(data: SceneData, aspect: number): Layout {
    const power = data.id === 'power' ? data : { cash: 0, bitcoin: 0, outline: false };
    const fills = powerFills(power.cash, power.bitcoin);
    const inks: [Ink, Ink] = power.outline ? ['ghost', 'ghost'] : ['fiat', 'btc'];
    const box = plotBox(aspect);
    const cell = Math.min(box.w / (COLS * 2 + GAP), box.h / ROWS);
    const width = (COLS * 2 + GAP) * cell;
    const left = box.x + (box.w - width) / 2;
    const bottom = box.y + box.h - (box.h - ROWS * cell) / 2;
    const slots = COLS * ROWS;
    const layout = emptyLayout(slots * 2, 'power');
    for (let stack = 0; stack < 2; stack += 1) {
        const x0 = left + stack * (COLS + GAP) * cell;
        for (let slot = 0; slot < slots; slot += 1) {
            const i = stack * slots + slot;
            layout.x[i] = x0 + ((slot % COLS) + 0.5) * cell;
            layout.y[i] = bottom - (Math.floor(slot / COLS) + 0.5) * cell;
            const filled = slot < (fills[stack] ?? 0);
            layout.ink[i] = inkIndex(filled ? (inks[stack] ?? 'faint') : 'faint');
            layout.r[i] = cell * (filled ? 0.36 : 0.16);
        }
    }
    return layout;
}
