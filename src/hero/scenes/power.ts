import { barScale } from '../../model/scale.ts';
import {
    emptyLayout,
    finite,
    type Guide,
    type Ink,
    inkIndex,
    type Layout,
    plotBox,
    type SceneData,
    type Viewport,
} from './types.ts';

export const COLS = 20;
export const ROWS = 28;
const GAP = 8;
const SLOTS = COLS * ROWS;

export interface PowerFills {
    fills: [number, number];
    log: boolean;
    decade: number;
}

/** Slots lit per stack, on the same scale as the bars below the fold: linear, or log once one is ten times the other. */
export function powerFills(cash: number, bitcoin: number): PowerFills {
    const a = finite(cash);
    const b = finite(bitcoin);
    if (!(a > 0) || !(b > 0)) return { fills: [0, 0], log: false, decade: 0 };
    const scale = barScale([a, b]);
    const lit = (width: number | undefined) => Math.min(SLOTS, Math.max(1, Math.round(finite(width ?? 0) * SLOTS)));
    return { fills: [lit(scale.widths[0]), lit(scale.widths[1])], log: scale.log, decade: scale.decade };
}

/** Two stacks, cash and bitcoin, each filled from the bottom to today's value; the gap between them is the answer. */
export function powerLayout(data: SceneData, view: Viewport): Layout {
    const power = data.id === 'power' ? data : { id: 'power' as const, cash: 0, bitcoin: 0, outline: false };
    const { fills, log, decade } = powerFills(power.cash, power.bitcoin);
    const outline = power.outline === true;
    const inks: [Ink, Ink] = outline ? ['ghost', 'ghost'] : ['fiat', 'btc'];
    const labelled = !outline && fills[0] > 0;
    const box = plotBox(view.aspect, labelled ? { top: 0.15, bottom: 0.13 } : {});
    const cell = Math.min(box.w / (COLS * 2 + GAP), box.h / ROWS);
    const width = (COLS * 2 + GAP) * cell;
    const left = box.x + (box.w - width) / 2;
    const bottom = box.y + box.h - (box.h - ROWS * cell) / 2;
    const layout = emptyLayout(SLOTS * 2, `power:${log ? 'log' : 'linear'}`);
    for (let stack = 0; stack < 2; stack += 1) {
        const x0 = left + stack * (COLS + GAP) * cell;
        for (let slot = 0; slot < SLOTS; slot += 1) {
            const i = stack * SLOTS + slot;
            const row = Math.floor(slot / COLS);
            layout.x[i] = x0 + ((slot % COLS) + 0.5) * cell;
            layout.y[i] = bottom - (row + 0.5) * cell;
            layout.order[i] = row / ROWS;
            const filled = slot < (fills[stack] ?? 0);
            layout.ink[i] = inkIndex(filled ? (inks[stack] ?? 'faint') : 'faint');
            layout.r[i] = cell * (filled ? 0.36 : 0.16);
        }
    }
    if (labelled) {
        const guides: Guide[] = [];
        const centre = (stack: number) => left + stack * (COLS + GAP) * cell + (COLS * cell) / 2;
        const topOf = (stack: number) => bottom - Math.ceil((fills[stack] ?? 0) / COLS) * cell;
        const stacks = [
            { name: 'Cash', value: power.cashLabel ?? '' },
            { name: 'Bitcoin', value: power.bitcoinLabel ?? '' },
        ];
        for (const [stack, { name, value }] of stacks.entries()) {
            guides.push(
                { kind: 'label', x: centre(stack), y: bottom + cell * 2.2, text: name, align: 'middle', tone: 'muted' },
                {
                    kind: 'label',
                    x: centre(stack),
                    y: topOf(stack) - cell * 2,
                    text: value,
                    align: 'middle',
                    tone: stack === 1 ? 'btc' : 'paper',
                },
            );
        }
        guides.push({ kind: 'rule', x1: left - cell, y1: bottom, x2: left + width + cell, y2: bottom, tone: 'muted' });
        if (log && decade > 0) {
            for (let k = 1; k * decade < 1; k += 1) {
                const y = bottom - k * decade * ROWS * cell;
                guides.push({
                    kind: 'rule',
                    x1: left - cell * 0.6,
                    y1: y,
                    x2: left + width + cell * 0.6,
                    y2: y,
                    tone: 'muted',
                });
            }
            guides.push({
                kind: 'label',
                x: left,
                y: bottom - ROWS * cell - cell,
                text: 'log ×10/line',
                align: 'start',
                tone: 'muted',
            });
        }
        layout.guides = guides;
    }
    layout.summary = `cash=${fills[0]};bitcoin=${fills[1]};log=${log}`;
    return layout;
}
