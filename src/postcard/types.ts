import type { DcaMarks } from '../gauges/types.ts';

export type PostcardTool = 'home' | 'left' | 'power' | 'convert' | 'dca' | 'address';

export type PostcardFormat = 'wide' | 'square';

/** The small drawing on a postcard: made from the same numbers as the answer, never from the weather. */
export type Signature =
    | { kind: 'supply'; issued: number; max: number; undated?: boolean }
    | { kind: 'columns'; cash: number; bitcoin: number; cashLabel: string; bitcoinLabel: string }
    | { kind: 'cells'; sats: number }
    | ({ kind: 'lines' } & DcaMarks)
    | { kind: 'stamp'; type: string; encoding: string; shown: string };

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
