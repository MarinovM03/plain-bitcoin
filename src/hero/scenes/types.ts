import type { Fiat } from '../../util/format.ts';

export type SceneId = 'home' | 'left' | 'power' | 'convert' | 'dca' | 'address';

export const INKS = ['faint', 'paper', 'btc', 'fiat', 'ghost', 'ember', 'dim'] as const;

export type Ink = (typeof INKS)[number];

export type CharRole = 'hrp' | 'separator' | 'version' | 'program' | 'checksum' | 'prefix' | 'body' | 'unknown';

export interface DcaMarks {
    /** Day of each mark, in ms since the epoch, oldest first; the last one is the as-of day. */
    readonly t: readonly number[];
    readonly value: readonly number[];
    readonly invested: readonly number[];
    readonly lump: readonly number[];
}

export type SceneData =
    | { id: 'home' }
    | { id: 'left'; height: number }
    | {
          id: 'power';
          cash: number;
          bitcoin: number;
          cashLabel?: string;
          bitcoinLabel?: string;
          outline?: boolean;
      }
    | { id: 'convert'; sats: number }
    | ({ id: 'dca'; fiat: Fiat; worth: string; alt: string } & DcaMarks)
    | {
          id: 'address';
          text: string;
          roles: readonly CharRole[];
          state: 'empty' | 'valid' | 'invalid';
          suspect: number | null;
          checksumBad: boolean;
          kind?: string;
      };

/** One payload on the bus: what a scene shows, stamped so only the newest one is ever drawn. */
export interface ScenePayload {
    readonly rev: number;
    readonly data: SceneData;
}

/** A scale cue drawn in the DOM over the plot, in plot units (x 0..aspect, y 0..1, measured in plot heights). */
export type Guide =
    | {
          kind: 'label';
          x: number;
          y: number;
          text: string;
          align: 'start' | 'middle' | 'end';
          tone?: 'muted' | 'btc' | 'paper';
      }
    | { kind: 'rule'; x1: number; y1: number; x2: number; y2: number; tone?: 'muted' | 'btc' }
    | { kind: 'band'; x: number; y: number; w: number; h: number; tip: string };

export interface StillPath {
    className: string;
    points: readonly (readonly [number, number])[];
}

/** Where a rebuilt scene's points fly in from: a zoom about (x, y) by k, or a light scatter when absent. */
export interface Entry {
    x: number;
    y: number;
    k: number;
}

export interface Layout {
    count: number;
    x: Float32Array;
    y: Float32Array;
    r: Float32Array;
    ink: Uint8Array;
    /** 0..1: when each point starts to move during a morph, so a scene can build left to right or bottom up. */
    order: Float32Array;
    rebuild: string;
    guides: Guide[];
    paths: StillPath[];
    still: { className: string; alt: string } | null;
    entry: Entry | null;
    /** A short, plain summary of what the layout shows, so tests can check it against the answer. */
    summary: string;
}

export const MAX_POINTS = 2400;

export interface Viewport {
    aspect: number;
    /** Plot height in CSS pixels. */
    pixels: number;
}

export type SceneLayout = (data: SceneData, view: Viewport) => Layout;

export function emptyLayout(count: number, rebuild: string): Layout {
    const size = Math.max(0, Math.min(MAX_POINTS, Math.floor(count)));
    return {
        count: size,
        x: new Float32Array(size),
        y: new Float32Array(size),
        r: new Float32Array(size),
        ink: new Uint8Array(size),
        order: new Float32Array(size),
        rebuild,
        guides: [],
        paths: [],
        still: null,
        entry: null,
        summary: '',
    };
}

export function inkIndex(ink: Ink): number {
    return INKS.indexOf(ink);
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export const PAD = 0.06;
export const MIN_ASPECT = 0.3;
export const MAX_ASPECT = 6;

export function safeAspect(aspect: number): number {
    return Number.isFinite(aspect) && aspect > 0 ? Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect)) : 1.6;
}

export function plotBox(
    aspect: number,
    pad: Partial<{ top: number; right: number; bottom: number; left: number }> = {},
): Box {
    const a = safeAspect(aspect);
    const top = pad.top ?? PAD;
    const left = pad.left ?? PAD;
    const right = pad.right ?? PAD;
    const bottom = pad.bottom ?? PAD;
    return { x: left, y: top, w: Math.max(0.1, a - left - right), h: Math.max(0.1, 1 - top - bottom) };
}

export function fitGrid(count: number, box: Box): { cols: number; rows: number; cell: number } {
    let best = { cols: Math.max(1, count), rows: 1, cell: 0 };
    for (let cols = 1; cols <= count; cols += 1) {
        const rows = Math.ceil(count / cols);
        const cell = Math.min(box.w / cols, box.h / rows);
        if (cell > best.cell) best = { cols, rows, cell };
    }
    return best;
}

export function finite(value: number, fallback = 0): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, finite(value, low)));
}

/** Every layout passes through here: no NaN, no Infinity and nothing outside the plot reaches the GPU or the SVG. */
export function sanitize(layout: Layout, aspect: number): Layout {
    const a = safeAspect(aspect);
    for (let i = 0; i < layout.count; i += 1) {
        layout.x[i] = clamp(layout.x[i] ?? 0, 0, a);
        layout.y[i] = clamp(layout.y[i] ?? 0, 0, 1);
        layout.r[i] = clamp(layout.r[i] ?? 0, 0, 0.5);
        layout.order[i] = clamp(layout.order[i] ?? 0, 0, 1);
        if ((layout.ink[i] ?? 0) >= INKS.length) layout.ink[i] = 0;
    }
    layout.guides = layout.guides.filter((guide) =>
        guide.kind === 'rule'
            ? [guide.x1, guide.y1, guide.x2, guide.y2].every(Number.isFinite)
            : guide.kind === 'band'
              ? [guide.x, guide.y, guide.w, guide.h].every(Number.isFinite) && guide.w > 0 && guide.h > 0
              : Number.isFinite(guide.x) && Number.isFinite(guide.y),
    );
    layout.paths = layout.paths.map((path) => ({
        className: path.className,
        points: path.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    }));
    if (layout.entry && ![layout.entry.x, layout.entry.y, layout.entry.k].every(Number.isFinite)) layout.entry = null;
    return layout;
}

/** A stable 0..1 hash per index, for scatter directions and stagger. */
export function seedOf(i: number): number {
    const x = Math.sin((i + 1) * 78.233) * 43758.5453;
    return x - Math.floor(x);
}
