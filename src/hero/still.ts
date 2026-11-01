import { INKS, type Layout } from './scenes/types.ts';

const UNIT = 1000;

function num(value: number): string {
    return String(Math.round(value * UNIT * 10) / 10);
}

export function stillSvg(layout: Layout, aspect: number): string {
    const paths = new Map<string, string[]>();
    for (let i = 0; i < layout.count; i += 1) {
        const r = layout.r[i] ?? 0;
        if (r <= 0) continue;
        const key = `${INKS[layout.ink[i] ?? 0] ?? 'faint'} ${num(r * 2)}`;
        const d = `M${num(layout.x[i] ?? 0)} ${num(layout.y[i] ?? 0)}h0`;
        const list = paths.get(key);
        if (list) list.push(d);
        else paths.set(key, [d]);
    }
    const body = [...paths]
        .map(([key, parts]) => {
            const [ink, width] = key.split(' ');
            return `<path class="still__dot still__dot--${ink}" stroke-width="${width}" d="${parts.join('')}"/>`;
        })
        .join('');
    return `<svg class="still" viewBox="0 0 ${num(aspect)} ${UNIT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
}
