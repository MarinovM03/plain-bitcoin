export type SceneId = 'home' | 'left' | 'power' | 'convert' | 'dca' | 'address';

export const INKS = ['faint', 'paper', 'btc', 'fiat', 'ghost', 'ember'] as const;

export type Ink = (typeof INKS)[number];

export type CharRole = 'hrp' | 'separator' | 'version' | 'program' | 'checksum' | 'prefix' | 'body' | 'unknown';

export type SceneData =
    | { id: 'home' }
    | { id: 'left'; height: number }
    | { id: 'power'; cash: number; bitcoin: number; outline?: boolean }
    | { id: 'convert'; sats: number }
    | { id: 'dca'; value: readonly number[]; invested: readonly number[]; lump: readonly number[] }
    | {
          id: 'address';
          text: string;
          roles: readonly CharRole[];
          state: 'empty' | 'valid' | 'invalid';
          suspect: number | null;
          checksumBad: boolean;
      };

export interface Layout {
    count: number;
    x: Float32Array;
    y: Float32Array;
    r: Float32Array;
    ink: Uint8Array;
    rebuild: string;
}

export const MAX_POINTS = 2400;

export type SceneLayout = (data: SceneData, aspect: number, pixels: number) => Layout;

export function emptyLayout(count: number, rebuild: string): Layout {
    return {
        count,
        x: new Float32Array(count),
        y: new Float32Array(count),
        r: new Float32Array(count),
        ink: new Uint8Array(count),
        rebuild,
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

export function plotBox(aspect: number): Box {
    return { x: PAD, y: PAD, w: Math.max(0.1, aspect - PAD * 2), h: 1 - PAD * 2 };
}

export function fitGrid(count: number, box: Box): { cols: number; rows: number; cell: number } {
    let best = { cols: count, rows: 1, cell: 0 };
    for (let cols = 1; cols <= count; cols += 1) {
        const rows = Math.ceil(count / cols);
        const cell = Math.min(box.w / cols, box.h / rows);
        if (cell > best.cell) best = { cols, rows, cell };
    }
    return best;
}
