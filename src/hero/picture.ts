import { HALVING_INTERVAL, subsidy } from '../model/supply.ts';
import { formatBtcExact } from '../util/format.ts';
import { type FieldLayout, type Rect, TOKEN_COUNT, type TokenState, tokensBounds } from './layout.ts';

export type PictureView = 'edge' | 'field';

export interface PictureBlock extends Rect {
    era: number;
    state: 'issued' | 'unissued' | 'current';
    label: string;
}

export interface PictureCoin {
    x: number;
    z: number;
    issued: boolean;
}

export interface Picture {
    view: Rect;
    blocks: PictureBlock[];
    coins: PictureCoin[];
    partial: { x: number; z: number; fraction: number } | null;
}

const PAD = 1.5;

export function picture(layout: FieldLayout, tokens: TokenState, view: PictureView): Picture {
    const current = Math.min(TOKEN_COUNT - 1, tokens.full);
    const currentEra = tokens.full >= TOKEN_COUNT ? -1 : (layout.eras[current] ?? 0);
    const blocks: PictureBlock[] = layout.blocks
        .filter((block) => block.w > 0.05 && block.d > 0.05)
        .map((block) => ({
            x: block.x,
            z: block.z,
            w: block.w,
            d: block.d,
            era: block.era,
            state:
                block.era === currentEra
                    ? 'current'
                    : block.count > 0 && block.first + block.count <= tokens.full
                      ? 'issued'
                      : 'unissued',
            label: formatBtcExact(subsidy(block.era * HALVING_INTERVAL)),
        }));

    const coins: PictureCoin[] = [];
    const eraBlock = layout.blocks[currentEra];
    if (eraBlock) {
        for (let i = eraBlock.first; i < eraBlock.first + eraBlock.count; i += 1) {
            if (i === tokens.full) continue;
            coins.push({
                x: layout.positions[i * 2] ?? 0,
                z: layout.positions[i * 2 + 1] ?? 0,
                issued: i < tokens.full,
            });
        }
    }
    const partial =
        tokens.full < TOKEN_COUNT
            ? {
                  x: layout.positions[tokens.full * 2] ?? 0,
                  z: layout.positions[tokens.full * 2 + 1] ?? 0,
                  fraction: tokens.partial,
              }
            : null;

    const region =
        view === 'field' || !eraBlock
            ? { x: -layout.width / 2, z: -layout.depth / 2, w: layout.width, d: layout.depth }
            : tokensBounds(layout, eraBlock.first);
    return {
        view: { x: region.x - PAD, z: region.z - PAD, w: region.w + PAD * 2, d: region.d + PAD * 2 },
        blocks,
        coins,
        partial,
    };
}
