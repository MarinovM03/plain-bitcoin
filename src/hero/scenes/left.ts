import { issuedBeforeEra, MAX_SUPPLY, SATS_PER_BTC, supplyAt } from '../../model/supply.ts';
import { formatPpm, formatWhole } from '../../util/format.ts';
import {
    emptyLayout,
    type Guide,
    type Ink,
    inkIndex,
    type Layout,
    plotBox,
    type SceneData,
    type Viewport,
} from './types.ts';

export const DOT_BTC = 10_000;
export const DOTS = 2100;
const DOT_SATS = DOT_BTC * SATS_PER_BTC;
/** Ways to lay 2,100 dots out as a full rectangle, so the volume has no ragged top. */
const COLUMN_CHOICES = [30, 35, 42, 50, 60, 70, 75, 84, 100, 105, 140, 150];
const LABELLED_ERAS = 5;
const MIN_BAND = 0.055;

/** Halving days that have happened; later ones are not dated here because they have not happened. */
export const ERA_STARTS = ['3 Jan 2009', '28 Nov 2012', '9 Jul 2016', '11 May 2020', '20 Apr 2024'] as const;

export interface LeftFill {
    full: number;
    partial: number;
    era: number;
    issued: number;
    ppm: number;
}

function safeHeight(height: number): number {
    return Number.isSafeInteger(height) && height >= 0 ? Math.min(height, 7_000_000) : 0;
}

export function leftFill(height: number): LeftFill {
    const supply = supplyAt(safeHeight(height));
    const dots = supply.issued / DOT_SATS;
    const full = Math.min(DOTS, Math.floor(dots));
    return {
        full,
        partial: full < DOTS ? dots - full : 0,
        era: supply.era,
        issued: supply.issued,
        ppm: supply.issuedPpm,
    };
}

/** Dot index where each era starts; era k spans [starts[k], starts[k + 1]). */
export function eraStarts(): number[] {
    const starts: number[] = [];
    for (let era = 0; era <= 33; era += 1) starts.push(issuedBeforeEra(era) / DOT_SATS);
    return starts;
}

function subsidyBtc(era: number): string {
    return String(50 / 2 ** era);
}

export function eraTip(era: number, current: number): string {
    const reward = `${subsidyBtc(era)} BTC a block`;
    const total = `${formatWhole(((issuedBeforeEra(era + 1) - issuedBeforeEra(era)) / SATS_PER_BTC) | 0)} BTC in all`;
    if (era >= LABELLED_ERAS)
        return `Era ${LABELLED_ERAS + 1} onward · not mined yet · the reward keeps halving every 210,000 blocks`;
    const since = ERA_STARTS[era] ?? '';
    if (era === current) return `Era ${era + 1} · since ${since} · ${reward} · being mined now`;
    if (era > current) return `Era ${era + 1} · ${reward} · ${total} · not mined yet`;
    const until = ERA_STARTS[era + 1] ?? '';
    return `Era ${era + 1} · ${since} to ${until} · ${reward} · ${total}`;
}

/**
 * The 21 million coins as one volume of 2,100 dots, filled from the bottom to the real issued share.
 * Each halving era is a stratum: the first holds half of all coins, each one after holds half the one before.
 */
export function leftLayout(data: SceneData, view: Viewport): Layout {
    const fill = leftFill(data.id === 'left' ? data.height : 0);
    const wide = view.aspect >= 1.1;
    const box = plotBox(view.aspect, { right: wide ? 0.34 : 0.26, top: 0.08, bottom: 0.08 });
    let best = { cols: 42, rows: 50, cell: 0 };
    for (const cols of COLUMN_CHOICES) {
        const rows = DOTS / cols;
        const cell = Math.min(box.w / cols, box.h / rows);
        if (cell > best.cell) best = { cols, rows, cell };
    }
    const { cols, rows, cell } = best;
    const width = cols * cell;
    const height = rows * cell;
    const left = box.x + (box.w - width) / 2;
    const bottom = box.y + (box.h + height) / 2;
    const starts = eraStarts();
    const eraOfDot = (i: number) => {
        let era = 0;
        while (era < starts.length - 1 && i >= (starts[era + 1] ?? Number.POSITIVE_INFINITY)) era += 1;
        return era;
    };
    const layout = emptyLayout(DOTS, `left:${cols}`);
    for (let i = 0; i < DOTS; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        layout.x[i] = left + (col + 0.5) * cell;
        layout.y[i] = bottom - (row + 0.5) * cell;
        layout.order[i] = row / rows;
        const era = eraOfDot(i);
        let ink: Ink;
        let r = cell * 0.36;
        if (i < fill.full) ink = era === fill.era ? 'btc' : era % 2 === 0 ? 'paper' : 'dim';
        else if (i === fill.full) {
            ink = 'ember';
            r = cell * (0.16 + 0.24 * fill.partial);
        } else {
            ink = 'faint';
            r = cell * 0.2;
        }
        layout.ink[i] = inkIndex(ink);
        layout.r[i] = r;
    }

    const guides: Guide[] = [];
    const rowY = (dot: number) => bottom - (dot / cols) * cell;
    const labelX = left + width + cell * 1.4;
    const side: { y: number; text: string; tone: 'muted' | 'btc' | 'paper' }[] = [
        { y: rowY(DOTS), text: '21M', tone: 'paper' },
    ];
    for (let era = 0; era < LABELLED_ERAS + 1; era += 1) {
        const from = starts[era] ?? DOTS;
        const to = era === LABELLED_ERAS ? DOTS : (starts[era + 1] ?? DOTS);
        const top = rowY(Math.ceil(to / cols) * cols);
        const base = rowY(Math.floor(from / cols) * cols);
        guides.push({
            kind: 'band',
            x: left,
            y: top,
            w: width + (wide ? 0.3 : 0.2),
            h: Math.max(cell, base - top),
            tip: eraTip(era, fill.era),
        });
        const current = era === fill.era;
        if (era < LABELLED_ERAS && (current || rowY(from) - rowY(to) >= MIN_BAND))
            side.push({
                y: (rowY(from) + rowY(to)) / 2,
                text: `${current ? '▸ ' : ''}${subsidyBtc(era)} BTC`,
                tone: current ? 'btc' : 'muted',
            });
    }
    // Labels never overlap: each one sits at least one label height below the one above it.
    side.sort((a, b) => a.y - b.y);
    let floor = Number.NEGATIVE_INFINITY;
    for (const label of side) {
        const y = Math.max(label.y, floor + MIN_BAND);
        floor = y;
        guides.push({ kind: 'label', x: labelX, y, text: label.text, align: 'start', tone: label.tone });
    }
    const filledY = rowY(fill.full + fill.partial);
    guides.push(
        { kind: 'rule', x1: left, y1: rowY(DOTS), x2: left + width + cell, y2: rowY(DOTS), tone: 'muted' },
        { kind: 'rule', x1: left + width, y1: filledY, x2: left + width + cell, y2: filledY, tone: 'btc' },
        {
            kind: 'label',
            x: left,
            y: rowY(DOTS) - cell * 1.4 - 0.02,
            text: `${formatPpm(fill.ppm)} mined`,
            align: 'start',
            tone: 'btc',
        },
    );
    layout.guides = guides;
    layout.summary = `issued=${fill.issued};max=${MAX_SUPPLY};lit=${fill.full}`;
    return layout;
}
