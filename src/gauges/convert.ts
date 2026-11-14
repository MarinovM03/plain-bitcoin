import { btcText, MAX_SATS, SATS_PER_BTC } from '../model/convert.ts';
import { GAUGE } from '../ui/copy.ts';
import { formatFiatPrecise, formatWhole } from '../util/format.ts';
import { finite, gauge, label, line, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

/** Round amounts every reader knows, smallest first: one sat up to one whole bitcoin. */
export const RUNGS = [1, 1_000, 100_000, 1_000_000, SATS_PER_BTC] as const;

export function satsOf(data: SceneData): number {
    if (data.id !== 'convert') return 0;
    const sats = Math.floor(finite(data.sats));
    return sats > 0 ? Math.min(sats, MAX_SATS) : 0;
}

/** A plain unit name for an amount of sats: sats below 0.01 BTC, bitcoin from there up. */
export function unitText(sats: number): string {
    if (sats < 1_000_000) return `${formatWhole(sats)} ${sats === 1 ? 'sat' : 'sats'}`;
    return `${btcText(sats)} BTC`;
}

/** Matches `.g-rung-text` in convert.css. */
const TEXT_PX = 14;

interface Rung {
    sats: number;
    yours: boolean;
}

export function rungsFor(sats: number): Rung[] {
    const rungs: Rung[] = RUNGS.map((amount) => ({ sats: amount, yours: amount === sats }));
    if (sats > 0 && !rungs.some((rung) => rung.yours)) rungs.push({ sats, yours: true });
    return rungs.sort((a, b) => a.sats - b.sats);
}

/**
 * A price ladder: round amounts of bitcoin, smallest at the top, each with what it costs now. The amount typed in
 * takes its place among them as the one orange row.
 */
export function convertLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const sats = satsOf(data);
    const price = data.id === 'convert' && finite(data.price) > 0 ? data.price : 0;
    const currency = data.id === 'convert' ? data.currency : 'USD';
    const { width: w, height: h, mini } = view;
    const rungs = rungsFor(sats);
    const rowH = Math.min(52, h / rungs.length);
    const top = (h - rowH * rungs.length) / 2;
    const pad = mini ? 0 : 12;
    const marks: Mark[] = [];
    rungs.forEach((rung, index) => {
        const y = top + index * rowH;
        const key = rung.yours ? 'yours' : `r${rung.sats}`;
        if (rung.yours) marks.push(rect('yours-row', 0, y + 2, w, rowH - 4, 'g-rung g-rung--yours', { rx: 6 }));
        else if (index > 0 && !rungs[index - 1]?.yours) marks.push(line(`${key}-rule`, 0, y, w, y, 'g-rung-rule'));
        if (mini) return;
        const tone = rung.yours ? 'g-label g-label--on-btc g-rung-text' : 'g-label g-label--ink g-rung-text';
        const baseline = y + rowH / 2 + TEXT_PX * 0.36;
        const name = rung.yours && !RUNGS.some((amount) => amount === rung.sats) ? `${GAUGE.convert.yours}: ` : '';
        marks.push(
            label(`${key}-amount`, pad, baseline, `${name}${unitText(rung.sats)}`, tone),
            label(
                `${key}-worth`,
                w - pad,
                baseline,
                price > 0 ? formatFiatPrecise((rung.sats * price) / SATS_PER_BTC, currency) : '',
                tone,
                'end',
            ),
        );
    });
    return gauge(view, {
        marks,
        rebuild: `convert:${rungs.length}`,
        className: 'gauge-convert',
        summary: `sats=${sats};rungs=${rungs.length};yours=${rungs.findIndex((rung) => rung.yours)};currency=${currency}`,
    });
}
