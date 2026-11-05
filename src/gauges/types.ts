import type { Fiat } from '../util/format.ts';

export type SceneId = 'home' | 'left' | 'power' | 'convert' | 'dca' | 'address';

export type CharRole = 'hrp' | 'separator' | 'version' | 'program' | 'checksum' | 'prefix' | 'body' | 'unknown';

export interface DcaMarks {
    /** Day of each mark, in ms since the epoch, oldest first; the last one is the as-of day. */
    readonly t: readonly number[];
    readonly value: readonly number[];
    readonly invested: readonly number[];
    readonly lump: readonly number[];
}

export type SceneData =
    | { id: 'home'; height: number }
    | { id: 'left'; height: number }
    | {
          id: 'power';
          cash: number;
          bitcoin: number;
          cashLabel?: string;
          bitcoinLabel?: string;
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

/** One payload on the bus: what a gauge shows, stamped so only the newest one is ever drawn. */
export interface ScenePayload {
    readonly rev: number;
    readonly data: SceneData;
}

export type MarkTag = 'rect' | 'line' | 'polyline' | 'text' | 'circle';

export type Attrs = Record<string, string | number>;

/** One solid-ink element of a gauge, keyed so a change of value moves the same element instead of a new one. */
export interface Mark {
    key: string;
    tag: MarkTag;
    attrs: Attrs;
    text?: string;
}

/**
 * How a gauge arrives when its structure changes: bars grow from the baseline, lines draw left to right, the sat grid
 * zooms by ten, address characters lock into place. Arriving on a route never animates: the flip carries that.
 */
export type Build = 'grow' | 'draw' | 'zoom-in' | 'zoom-out' | 'lock' | 'none';

export interface Gauge {
    /** Size in CSS px; the SVG's viewBox is exactly this, so one unit is one pixel. */
    width: number;
    height: number;
    marks: Mark[];
    /** Same key: the marks morph in place. New key: the gauge is rebuilt and plays its build. */
    rebuild: string;
    build: Build;
    /** Point the zoom grows from, in px. */
    origin: [number, number];
    className: string;
    /** Accessible name for a chart that carries its own meaning; empty means the DOM answer is the description. */
    alt: string;
    /** A short, plain summary of what is drawn, so tests can check the picture against the answer. */
    summary: string;
}

export interface Viewport {
    width: number;
    height: number;
    /** A home tile: no labels, just the shape. */
    mini: boolean;
}

export type GaugeLayout = (data: SceneData, view: Viewport) => Gauge;
