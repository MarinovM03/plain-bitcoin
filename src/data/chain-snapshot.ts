import snapshot from './blocks-snapshot.json' with { type: 'json' };
import { type ChainBlock, parseBlocks } from './height.ts';

/** Eight real blocks recorded by `scripts/update-blocks.mjs`: what the chain shows when no API has ever answered. */
export const SNAPSHOT: { readonly blocks: readonly ChainBlock[]; readonly asOf: string; readonly source: string } = {
    blocks: parseBlocks(snapshot.blocks, snapshot.blocks[0]?.height ?? 0),
    asOf: snapshot.asOf,
    source: snapshot.source,
};
