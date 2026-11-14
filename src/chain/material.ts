import { hashByte, isBlockHash } from './hash.ts';

export type Tone = 'orange' | 'bone' | 'limestone' | 'steel' | 'graphite';

export interface Material {
    tone: Tone | 'blank';
    /** The tablet's stone, #rrggbb. */
    body: string;
    /** The colour set into its cut cells, #rrggbb. */
    inlay: string;
}

interface ToneSpec {
    body: string;
    inlay: string;
    /** Out of 256: how many values of the hash's last byte choose this tone. */
    share: number;
}

/** Five minerals, in the order the hash's last byte walks them. Light stones take dark cells, graphite takes orange. */
export const TONES: Record<Tone, ToneSpec> = {
    orange: { body: '#e8871a', inlay: '#1a130d', share: 66 },
    bone: { body: '#e4dccb', inlay: '#26221d', share: 62 },
    graphite: { body: '#3b4047', inlay: '#f7931a', share: 56 },
    limestone: { body: '#cdb98a', inlay: '#1d1810', share: 36 },
    steel: { body: '#7f93a8', inlay: '#0f141a', share: 36 },
};

export const TONE_ORDER: readonly Tone[] = ['orange', 'bone', 'graphite', 'limestone', 'steel'];

/** How far the second-to-last byte may lighten or darken the stone, as a share of the way to white or black. */
export const SHADE_RANGE = 0.07;

/** Cut cells stay at least this far from the stone in contrast, whatever the shade. */
export const MIN_INLAY_CONTRAST = 3;

/** A block with no hash: an uncut, unlit blank. It claims nothing. */
export const BLANK: Material = { tone: 'blank', body: '#2c3037', inlay: '#2c3037' };

function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
}

export function shade(hex: string, amount: number): string {
    const target = amount >= 0 ? 255 : 0;
    const share = Math.min(1, Math.abs(amount));
    return `#${channels(hex)
        .map((channel) =>
            Math.round(channel + (target - channel) * share)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

export function toneFor(byte: number): Tone {
    let edge = 0;
    for (const tone of TONE_ORDER) {
        edge += TONES[tone].share;
        if (byte < edge) return tone;
    }
    return 'steel';
}

/**
 * The same hash always gives the same stone. The last byte picks the mineral and the one before it the shade; both
 * sit at the far end of the hash from the proof-of-work zeros, so neighbouring blocks differ.
 */
export function hashMaterial(hash: string | null): Material {
    if (!isBlockHash(hash)) return BLANK;
    const tone = toneFor(hashByte(hash, 31));
    const amount = (hashByte(hash, 30) / 255 - 0.5) * 2 * SHADE_RANGE;
    return { tone, body: shade(TONES[tone].body, amount), inlay: TONES[tone].inlay };
}
