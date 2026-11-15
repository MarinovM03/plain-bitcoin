export const TONES = ['btc', 'warm', 'cool', 'good', 'dim'] as const;

export type Tone = (typeof TONES)[number];

/** How a mark is drawn. A drip only exists in motion: the still leaves it out. */
export const SHAPE = { square: 0, round: 1, squareOpen: 2, roundOpen: 3, drip: 4 } as const;

export type Shape = (typeof SHAPE)[keyof typeof SHAPE];

/**
 * One mark of a tool's picture, in screen units: y runs from -1 at the bottom to 1 at the top, x from -aspect to
 * aspect. `level` is how strongly it shows, 0 to 1.
 */
export interface Mark {
    x: number;
    y: number;
    w: number;
    h: number;
    tone: Tone;
    level: number;
    shape: Shape;
}

/** The numbers a tool hands the world. Only counts and shares: never what was typed. */
export type BackdropData =
    | { id: 'left'; mined: number }
    | { id: 'power'; kept: readonly number[] }
    | { id: 'convert'; sats: number }
    | { id: 'dca'; buys: number }
    | { id: 'address'; length: number; verdict: 'none' | 'good' | 'bad'; suspect: number | null };

export type BackdropId = BackdropData['id'];

export type Plan = (data: BackdropData | null, aspect: number) => Mark[];

export function frameAspect(aspect: number): number {
    return Number.isFinite(aspect) ? Math.min(2.4, Math.max(0.4, aspect)) : 1;
}

export function share(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
