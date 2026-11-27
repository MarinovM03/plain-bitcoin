import type { DcaMarks } from '../gauges/types.ts';

export type PostcardTool =
    | 'home'
    | 'miner'
    | 'left'
    | 'halving'
    | 'tx'
    | 'fees'
    | 'power'
    | 'convert'
    | 'dca'
    | 'stack'
    | 'address';

export type PostcardFormat = 'wide' | 'square';

/** The small drawing on a postcard: made from the same numbers as the answer. */
export type Signature =
    | { kind: 'supply'; issued: number; max: number; undated?: boolean }
    | { kind: 'columns'; cash: number; bitcoin: number; cashLabel: string; bitcoinLabel: string }
    | { kind: 'cells'; sats: number }
    | ({ kind: 'lines' } & DcaMarks)
    | { kind: 'stamp'; type: string; encoding: string; shown: string }
    | { kind: 'well'; best: number; needed: number }
    /** `slab` 0 means confirmed; null means it pays less than every projected block. */
    | { kind: 'queue'; floors: number[]; slab: number | null }
    /** The same payment at every wait, nearest first. */
    | { kind: 'fees'; rows: { name: string; value: string; sats: number }[] }
    | { kind: 'blank' };

/** One printed answer. Every field is text the page already shows, or data it already drew. */
export interface Postcard {
    tool: PostcardTool;
    /** The route the postcard links back to, e.g. 'dca', or '' for home. */
    route: string;
    kicker: string;
    /** The one huge number, formatted exactly as the page shows it. */
    number: string;
    /** One plain sentence of truth. */
    line: string;
    /** Where every number came from, and as of when. */
    source: string;
    signature: Signature;
    alt: string;
}
