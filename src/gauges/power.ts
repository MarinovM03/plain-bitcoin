import { barScale } from '../model/scale.ts';
import { GAUGE } from '../ui/copy.ts';
import { clamp, finite, gauge, label, labelSize, line, px, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

export interface PowerFills {
    /** Share of the column each value fills, 0..1; the same scale as the bars below the fold unless the outline is tallest. */
    fills: [number, number];
    /** The dashed outline: what the cash would need to be today, 0 when unknown. */
    ghost: number;
    log: boolean;
    decade: number;
}

export function powerFills(cash: number, bitcoin: number, needed = 0): PowerFills {
    const a = finite(cash);
    const b = finite(bitcoin);
    const c = finite(needed);
    if (!(a > 0) || !(b > 0)) return { fills: [0, 0], ghost: 0, log: false, decade: 0 };
    const scale = barScale(c > 0 ? [a, b, c] : [a, b]);
    const fill = (value: number | undefined) => clamp(finite(value ?? 0), 0.008, 1);
    return {
        fills: [fill(scale.widths[0]), fill(scale.widths[1])],
        ghost: c > 0 ? fill(scale.widths[2]) : 0,
        log: scale.log,
        decade: scale.decade,
    };
}

/** Then and now as two solid columns on one baseline: cash kept, and the same money put into bitcoin. */
export function powerLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const power = data.id === 'power' ? data : { id: 'power' as const, cash: 0, bitcoin: 0 };
    const { fills, ghost, log, decade } = powerFills(power.cash, power.bitcoin, power.needed);
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    const thenLines = !mini && Boolean(power.cashThen);
    const top = mini ? h * 0.08 : size * 3.4;
    const base = mini ? h * 0.92 : h - size * (thenLines ? 5.2 : 2.4);
    const span = Math.max(1, base - top);
    const column = Math.min(mini ? w * 0.3 : 200, Math.max(28, w * 0.24));
    const gap = Math.min(mini ? w * 0.14 : 128, Math.max(20, w * 0.12));
    const left = (w - (column * 2 + gap)) / 2;
    const xs = [left, left + column + gap];
    const inks = ['g-fill--cool', 'g-fill--btc'];
    const marks: Mark[] = [];
    for (const [i, x] of xs.entries()) {
        marks.push(rect(`well${i}`, x, top, column, span, 'g-well'));
        if (i === 0 && ghost > fills[0] && !mini) {
            marks.push(
                rect('ghost', x, top, column, span, 'g-col g-ghost', {
                    style: `transform: scaleY(${px(ghost)})`,
                }),
            );
        }
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
        const thens = [power.cashThen ?? '', power.bitcoinThen ?? ''];
        const tones = ['g-label g-label--cool g-label--value', 'g-label g-label--btc g-label--value'];
        const outlined = ghost > fills[0];
        const ghostTop = base - ghost * span;
        // With the outline above it, the cash figure moves inside its own column so it never reads as the outline's value.
        const inside = outlined && fills[0] * span >= size * 2.6;
        for (const [i, x] of xs.entries()) {
            const centre = x + column / 2;
            marks.push(label(`name${i}`, centre, base + size * 1.6, names[i] ?? '', 'g-label', 'middle'));
            if (thenLines) {
                marks.push(label(`then${i}`, centre, base + size * 3, thens[i] ?? '', 'g-label', 'middle'));
                marks.push(label(`year${i}`, centre, base + size * 4.3, power.thenNote ?? '', 'g-label', 'middle'));
            }
            if (!fills[i]) continue;
            const top = base - (fills[i] ?? 0) * span;
            const cashInside = i === 0 && inside;
            const y = cashInside ? top + size * 1.6 : i === 0 && outlined ? ghostTop - size * 0.7 : top - size * 0.7;
            const tone = cashInside ? 'g-label g-label--on-btc g-label--value' : (tones[i] ?? 'g-label');
            marks.push(
                label(`value${i}`, 0, 0, values[i] ?? '', tone, 'middle', {
                    style: `transform: translate(${px(centre)}px, ${px(y)}px)`,
                }),
            );
        }
        if (inside && power.neededLabel) {
            marks.push(
                label(
                    'needed',
                    0,
                    0,
                    GAUGE.power.needed(power.neededLabel),
                    'g-label g-label--cool g-label--value',
                    'middle',
                    {
                        style: `transform: translate(${px(left + column / 2)}px, ${px(ghostTop - size * 0.7)}px)`,
                    },
                ),
            );
        }
        if (log) marks.push(label('log', 2, size * 1.1, GAUGE.power.log, 'g-label'));
    }
    return gauge(view, {
        marks,
        // Both columns scale with the amount, so a new amount keeps their shape; it regrows them instead.
        rebuild: `power:${log ? 'log' : 'linear'}:${fills[0] > 0 ? 'on' : 'off'}:${px(power.cash)}`,
        build: 'grow',
        origin: [0, base],
        className: 'gauge-power',
        summary: `cash=${px(fills[0])};bitcoin=${px(fills[1])};ghost=${px(ghost)};log=${log}`,
    });
}
