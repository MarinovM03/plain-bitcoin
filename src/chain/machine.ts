import type { ChainBlock } from '../data/height.ts';

/**
 * What the picture does with a new list: `replay` lands the first blocks in order, `snap` turns the forming block
 * solid and steps the chain back, `swap` replaces what is shown without ceremony.
 */
export type ChainEffect = 'none' | 'replay' | 'snap' | 'swap';

export interface ChainState {
    /** Newest first. */
    readonly blocks: readonly ChainBlock[];
    /** How many times the chain has stepped forward this visit. */
    readonly advances: number;
}

export const EMPTY_CHAIN: ChainState = { blocks: [], advances: 0 };

function sameBlock(a: ChainBlock | undefined, b: ChainBlock | undefined): boolean {
    return a !== undefined && b !== undefined && a.height === b.height && a.hash === b.hash;
}

function sameList(a: readonly ChainBlock[], b: readonly ChainBlock[]): boolean {
    return a.length === b.length && a.every((block, index) => sameBlock(block, b[index]));
}

/**
 * One step of the chain. A higher tip advances it exactly once, however many blocks arrived together (a tab that
 * was hidden for an hour steps once, not six times). A lower tip or a different hash at the same height is a
 * reorganisation or a lagging API: the list is replaced and nothing is celebrated. An empty answer changes nothing.
 */
export function advanceChain(
    state: ChainState,
    incoming: readonly ChainBlock[],
): { state: ChainState; effect: ChainEffect } {
    const next = incoming[0];
    if (!next) return { state, effect: 'none' };
    const current = state.blocks[0];
    if (!current) return { state: { blocks: incoming, advances: state.advances }, effect: 'replay' };
    if (next.height > current.height) {
        return { state: { blocks: incoming, advances: state.advances + 1 }, effect: 'snap' };
    }
    if (sameList(state.blocks, incoming)) return { state, effect: 'none' };
    return { state: { blocks: incoming, advances: state.advances }, effect: 'swap' };
}
