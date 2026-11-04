import { issuedBeforeEra, MAX_SUPPLY, SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { GAUGE } from '../ui/copy.ts';
import { formatPpm, formatWhole } from '../util/format.ts';
import { gauge, label, labelSize, line, rect, safeView } from './marks.ts';
import type { Gauge, Mark, SceneData, Viewport } from './types.ts';

/** The loupe shows the last two million coins, ten and a half times larger than the full column. */
export const ZOOM_SATS = 2_000_000 * SATS_PER_BTC;
const ZOOM_FROM = MAX_SUPPLY - ZOOM_SATS;
/** Eras drawn one by one; everything after the last one listed is drawn as a single band. */
const FULL_ERAS = 5;
const ZOOM_ERAS = 7;

/** Halving days that have happened; later ones are not dated here because they have not happened. */
export const ERA_STARTS = ['3 Jan 2009', '28 Nov 2012', '9 Jul 2016', '11 May 2020', '20 Apr 2024'] as const;

export interface LeftFill {
    issued: number;
    left: number;
    era: number;
    ppm: number;
}

function safeHeight(height: number): number {
    return Number.isSafeInteger(height) && height >= 0 ? Math.min(height, 7_000_000) : 0;
}

export function leftFill(height: number): LeftFill {
    const supply = supplyAt(safeHeight(height));
    return { issued: supply.issued, left: supply.left, era: supply.era, ppm: supply.issuedPpm };
}

function subsidyBtc(era: number): string {
    return String(50 / 2 ** era);
}

export function eraTip(era: number, current: number): string {
    const reward = `${subsidyBtc(era)} BTC a block`;
    const total = `${formatWhole(((issuedBeforeEra(era + 1) - issuedBeforeEra(era)) / SATS_PER_BTC) | 0)} BTC in all`;
    if (era >= ERA_STARTS.length) {
        if (era > current)
            return `Era ${era + 1} onward · not mined yet · the reward keeps halving every 210,000 blocks`;
    }
    const since = ERA_STARTS[era] ?? '';
    if (era === current) return `Era ${era + 1} · since ${since} · ${reward} · being mined now`;
    if (era > current) return `Era ${era + 1} · ${reward} · ${total} · not mined yet`;
    const until = ERA_STARTS[era + 1] ?? '';
    return `Era ${era + 1} · ${since} to ${until} · ${reward} · ${total}`;
}

interface Band {
    era: number;
    from: number;
    to: number;
}

function bands(last: number, floor = 0): Band[] {
    const out: Band[] = [];
    for (let era = 0; era <= last; era += 1) {
        const from = issuedBeforeEra(era);
        const to = era === last ? MAX_SUPPLY : issuedBeforeEra(era + 1);
        if (to > floor) out.push({ era, from: Math.max(from, floor), to });
    }
    return out;
}

/** One column: each band split into its issued part (ink, strata alternating) and its unmined part (orange). */
function column(
    prefix: string,
    band: readonly Band[],
    issued: number,
    place: (value: number) => number,
    x: number,
    width: number,
    across: boolean,
): Mark[] {
    const marks: Mark[] = [];
    const gap = 0.75;
    for (const { era, from, to } of band) {
        const split = Math.min(to, Math.max(from, issued));
        const strata = era % 2 === 0 ? 'g-fill--ink' : 'g-fill--dim';
        const parts: [string, number, number, string][] = [
            [`${prefix}-i${era}`, from, split, strata],
            [`${prefix}-u${era}`, split, to, 'g-fill--btc'],
        ];
        for (const [key, a, b, className] of parts) {
            const p = place(a);
            const q = place(b);
            const lo = Math.min(p, q);
            const size = Math.abs(q - p);
            const inset = (edge: boolean) => (edge ? gap : 0);
            // The band's own edges are inset, so the plate shows between eras like an engraved line.
            const start = lo + inset(across ? a === from : b === to);
            const length = Math.max(0, size - inset(a === from) - inset(b === to));
            marks.push(
                across ? rect(key, start, x, length, width, className) : rect(key, x, start, width, length, className),
            );
        }
    }
    return marks;
}

function miniLayout(fill: LeftFill, view: Viewport): Gauge {
    const { width: w, height: h } = view;
    const bar = Math.max(6, h * 0.26);
    const yA = h * 0.18;
    const yB = h - h * 0.18 - bar;
    const x0 = 2;
    const span = w - 4;
    const placeA = (value: number) => x0 + (value / MAX_SUPPLY) * span;
    const placeB = (value: number) => x0 + ((value - ZOOM_FROM) / ZOOM_SATS) * span;
    const marks = [
        ...column('a', bands(FULL_ERAS), fill.issued, placeA, yA, bar, true),
        ...column('b', bands(ZOOM_ERAS, ZOOM_FROM), fill.issued, placeB, yB, bar, true),
        line('m1', placeA(ZOOM_FROM), yA + bar, x0, yB, 'g-rule g-rule--faint'),
        line('m2', placeA(MAX_SUPPLY), yA + bar, x0 + span, yB, 'g-rule g-rule--faint'),
    ];
    return gauge(view, {
        marks,
        rebuild: 'left:mini',
        className: 'gauge-left',
        summary: `issued=${fill.issued};max=${MAX_SUPPLY};left=${fill.left}`,
    });
}

/**
 * The 21 million as one hard-edged column, each halving era a band, issued coins in ink and the unmined ones in
 * orange; beside it a loupe on the last two million, where the coins still to come are big enough to read.
 */
export function leftLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const fill = leftFill(data.id === 'left' ? data.height : 0);
    if (view.mini) return miniLayout(fill, view);
    const { width: w, height: h } = view;
    const size = labelSize(view);
    const top = size * 2.4;
    const bottom = h - size * 1.9;
    const span = Math.max(1, bottom - top);
    const xA = Math.max(30, size * 2.8);
    const widthA = Math.min(64, Math.max(24, w * 0.11));
    const gapAB = Math.min(64, Math.max(22, w * 0.09));
    const xB = xA + widthA + gapAB;
    const widthB = Math.min(120, Math.max(46, w * 0.21));
    const labelX = xB + widthB + 12;
    const roomy = w - labelX >= 156;
    const placeA = (value: number) => bottom - (value / MAX_SUPPLY) * span;
    const placeB = (value: number) => bottom - ((Math.max(value, ZOOM_FROM) - ZOOM_FROM) / ZOOM_SATS) * span;

    const marks: Mark[] = [
        ...column('a', bands(FULL_ERAS), fill.issued, placeA, xA, widthA, false),
        ...column('b', bands(ZOOM_ERAS, ZOOM_FROM), fill.issued, placeB, xB, widthB, false),
        line('m1', xA + widthA, placeA(MAX_SUPPLY), xB, top, 'g-rule g-rule--faint'),
        line('m2', xA + widthA, placeA(ZOOM_FROM), xB, bottom, 'g-rule g-rule--faint'),
        label('l-a-top', xA + widthA / 2, top - size * 0.6, GAUGE.left.max, 'g-label', 'middle'),
        label('l-a-bottom', xA + widthA / 2, bottom + size * 1.35, '0', 'g-label', 'middle'),
        label('l-b-top', xB + widthB / 2, top - size * 0.6, GAUGE.left.max, 'g-label', 'middle'),
        label('l-b-bottom', xB + widthB / 2, bottom + size * 1.35, GAUGE.left.zoomFloor, 'g-label', 'middle'),
    ];

    const issuedY = placeB(fill.issued);
    marks.push(
        line('now-b', xB - 6, issuedY, xB + widthB + 6, issuedY, 'g-rule g-rule--btc'),
        line('now-a', xA - 4, placeA(fill.issued), xA + widthA + 4, placeA(fill.issued), 'g-rule g-rule--btc'),
    );
    const leftTop = top;
    if (issuedY - leftTop >= size * 1.7) {
        marks.push(
            label(
                'left-in',
                xB + widthB / 2,
                (leftTop + issuedY) / 2 + size * 0.36,
                formatWhole(Math.floor(fill.left / SATS_PER_BTC)),
                'g-label g-label--on-btc',
                'middle',
            ),
        );
    }

    const side: { key: string; y: number; text: string; className: string }[] = [];
    for (const { era, from, to } of bands(ZOOM_ERAS, ZOOM_FROM)) {
        const yTop = placeB(to);
        const yBottom = placeB(from);
        const current = era === fill.era;
        if (current)
            marks.push(rect('current', xB - 2.5, yTop - 0.5, widthB + 5, yBottom - yTop + 1, 'g-outline--btc'));
        if (yBottom - yTop < size * 1.15 && !current) continue;
        const reward = `${subsidyBtc(era)} BTC`;
        const name = era === ZOOM_ERAS ? GAUGE.left.eraOnward(era + 1) : GAUGE.left.era(era + 1, reward);
        side.push({
            key: `e${era}`,
            y: (yTop + yBottom) / 2 + size * 0.36,
            text: `${current ? '▸ ' : ''}${roomy ? name : reward}${current && roomy ? GAUGE.left.now : ''}`,
            className: current ? 'g-label g-label--btc' : 'g-label',
        });
    }
    side.sort((a, b) => a.y - b.y);
    let floor = Number.NEGATIVE_INFINITY;
    for (const entry of side) {
        const y = Math.max(entry.y, floor + size * 1.3);
        floor = y;
        marks.push(label(`l-${entry.key}`, labelX, y, entry.text, entry.className));
    }
    marks.push(label('mined', w - 4, size * 1.2, GAUGE.left.mined(formatPpm(fill.ppm)), 'g-label g-label--btc', 'end'));

    // Tap targets for the era readout: the full column's bands and the loupe's bands.
    for (const [prefix, band, place, x, width] of [
        ['ta', bands(FULL_ERAS), placeA, xA, widthA],
        ['tb', bands(ZOOM_ERAS, ZOOM_FROM), placeB, xB, widthB],
    ] as const) {
        for (const { era, from, to } of band) {
            const yTop = place(to);
            const height = place(from) - yTop;
            if (height < 2) continue;
            marks.push(
                rect(`${prefix}${era}`, x - 3, yTop, width + 6, height, 'g-band', {
                    'data-tip': eraTip(era, fill.era),
                }),
            );
        }
    }

    return gauge(view, {
        marks,
        rebuild: 'left',
        build: 'grow',
        origin: [0, bottom],
        className: 'gauge-left',
        summary: `issued=${fill.issued};max=${MAX_SUPPLY};left=${fill.left}`,
    });
}
