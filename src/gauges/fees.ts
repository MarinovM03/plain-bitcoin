import { finite, gauge, label, labelSize, px, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

/**
 * The same payment at every wait, one bar each, nearest wait on top. A bar's length is its cost in sats against the
 * dearest, so a quiet mempool shows bars of nearly one length: waiting saves little.
 */
export function feesLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const rows = data.id === 'fees' ? data.rows : [];
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    const most = Math.max(1, ...rows.map((row) => finite(row.sats)));
    const pitch = rows.length > 0 ? h / rows.length : h;
    const bar = Math.min(mini ? pitch * 0.6 : 34, pitch * (mini ? 0.6 : 0.42));
    const marks: Mark[] = [];
    for (const [i, row] of rows.entries()) {
        const top = i * pitch + (mini ? (pitch - bar) / 2 : pitch - bar - size * 0.6);
        const share = Math.min(1, Math.max(0.01, finite(row.sats) / most));
        marks.push(rect(`well${i}`, 0, top, w, bar, 'g-well'));
        marks.push(rect(`bar${i}`, 0, top, w * share, bar, i === 0 ? 'g-fill--btc' : 'g-fill--cool'));
        if (mini) continue;
        const text = top - size * 0.55;
        marks.push(label(`name${i}`, 0, text, row.name, i === 0 ? 'g-label g-label--btc' : 'g-label'));
        marks.push(label(`value${i}`, w, text, row.value, 'g-label g-label--ink', 'end'));
    }
    return gauge(view, {
        marks,
        rebuild: `fees:${rows.length}`,
        className: 'gauge-fees',
        summary: rows.map((row) => `${row.name}=${px(finite(row.sats))}`).join(';'),
    });
}
