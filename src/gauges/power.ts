import { barScale } from '../model/scale.ts';
import { GAUGE } from '../ui/copy.ts';
import { clamp, finite, gauge, label, labelSize, line, px, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

export interface PowerFills {
    /** Share of the column each value fills, 0..1, on the same scale as the bars below the fold. */
    fills: [number, number];
    log: boolean;
    decade: number;
}

export function powerFills(cash: number, bitcoin: number): PowerFills {
    const a = finite(cash);
    const b = finite(bitcoin);
    if (!(a > 0) || !(b > 0)) return { fills: [0, 0], log: false, decade: 0 };
    const scale = barScale([a, b]);
    const fill = (value: number | undefined) => clamp(finite(value ?? 0), 0.008, 1);
    return { fills: [fill(scale.widths[0]), fill(scale.widths[1])], log: scale.log, decade: scale.decade };
}

/** Then and now as two solid columns on one baseline: cash kept, and the same money put into bitcoin. */
export function powerLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const power = data.id === 'power' ? data : { id: 'power' as const, cash: 0, bitcoin: 0 };
    const { fills, log, decade } = powerFills(power.cash, power.bitcoin);
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    const top = mini ? h * 0.08 : size * 3.4;
    const base = mini ? h * 0.92 : h - size * 2.4;
    const span = Math.max(1, base - top);
    const column = Math.min(mini ? w * 0.3 : 128, Math.max(28, w * 0.24));
    const gap = Math.min(mini ? w * 0.14 : 96, Math.max(20, w * 0.12));
    const left = (w - (column * 2 + gap)) / 2;
    const xs = [left, left + column + gap];
    const inks = ['g-fill--cool', 'g-fill--btc'];
    const marks: Mark[] = [];
    for (const [i, x] of xs.entries()) {
        marks.push(rect(`well${i}`, x, top, column, span, 'g-well'));
        const fill = fills[i] ?? 0;
        // Drawn full height and scaled from the baseline, so a new value moves the same column smoothly.
        marks.push(
            rect(`col${i}`, x, top, column, span, `g-col ${inks[i]}`, {
                style: `transform: scaleY(${px(fill)})`,
            }),
        );
    }
    if (log && decade > 0) {
        for (let k = 1; k * decade < 1; k += 1) {
            const y = base - k * decade * span;
            marks.push(line(`tick${k}`, left - 6, y, left + column * 2 + gap + 6, y, 'g-rule g-rule--plate'));
        }
    }
    marks.push(line('base', left - 10, base, left + column * 2 + gap + 10, base, 'g-rule'));
    if (!mini) {
        const names = [GAUGE.power.cash, GAUGE.power.bitcoin];
        const values = [power.cashLabel ?? '', power.bitcoinLabel ?? ''];
        const tones = ['g-label g-label--cool g-label--value', 'g-label g-label--btc g-label--value'];
        for (const [i, x] of xs.entries()) {
            const centre = x + column / 2;
            marks.push(label(`name${i}`, centre, base + size * 1.6, names[i] ?? '', 'g-label', 'middle'));
            if (fills[i]) {
                const y = base - (fills[i] ?? 0) * span - size * 0.7;
                marks.push(
                    label(`value${i}`, 0, 0, values[i] ?? '', tones[i] ?? 'g-label', 'middle', {
                        style: `transform: translate(${px(centre)}px, ${px(y)}px)`,
                    }),
                );
            }
        }
        if (log) marks.push(label('log', 2, size * 1.1, GAUGE.power.log, 'g-label'));
    }
    return gauge(view, {
        marks,
        rebuild: `power:${log ? 'log' : 'linear'}:${fills[0] > 0 ? 'on' : 'off'}`,
        build: 'grow',
        origin: [0, base],
        className: 'gauge-power',
        summary: `cash=${px(fills[0])};bitcoin=${px(fills[1])};log=${log}`,
    });
}
