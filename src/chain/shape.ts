import type { ChainBlock } from '../data/height.ts';

export interface SlabShape {
    /** Width and height of the square face, in scene units. */
    side: number;
    /** Depth of the tablet, in scene units. */
    thick: number;
    /** True when a missing field forced a middling stand-in for the face or the depth. */
    nominal: boolean;
}

/**
 * Block data to tablet size. The face grows with the square root of the block's size in bytes (so its area follows
 * the bytes) up to a 2.2 MB block; the depth grows with the number of transactions up to 5,000. Both are clamped.
 */
export const SHAPE = {
    sideMin: 0.56,
    sideMax: 1,
    bytesFull: 2_200_000,
    thickMin: 0.07,
    thickMax: 0.34,
    txFull: 5000,
    sideNominal: 0.8,
    thickNominal: 0.16,
} as const;

/** Minutes between two blocks to the gap between their tablets: linear up to half an hour, then held. */
export const GAP = { min: 0.6, max: 1.8, secondsFull: 1800, nominal: 1 } as const;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function real(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function slabShape(block: Pick<ChainBlock, 'size' | 'txCount'>): SlabShape {
    const side = real(block.size)
        ? SHAPE.sideMin + (SHAPE.sideMax - SHAPE.sideMin) * clamp01(Math.sqrt(block.size / SHAPE.bytesFull))
        : SHAPE.sideNominal;
    const thick = real(block.txCount)
        ? SHAPE.thickMin + (SHAPE.thickMax - SHAPE.thickMin) * clamp01(block.txCount / SHAPE.txFull)
        : SHAPE.thickNominal;
    return { side, thick, nominal: !real(block.size) || !real(block.txCount) };
}

export function gapFor(seconds: number | null): number {
    if (seconds === null || !Number.isFinite(seconds)) return GAP.nominal;
    return GAP.min + (GAP.max - GAP.min) * clamp01(seconds / GAP.secondsFull);
}

/**
 * How far back each tablet stands from the spot where the next block is forming, newest first. The first gap is
 * the time since the newest block (when known); every other gap is the time between two neighbours. Miners' clocks
 * can run backwards, so a negative difference counts as zero.
 */
export function chainOffsets(
    blocks: readonly Pick<ChainBlock, 'time' | 'size' | 'txCount'>[],
    nowSeconds: number | null,
): number[] {
    const offsets: number[] = [];
    let offset = 0;
    let frontThick: number = SHAPE.thickNominal;
    let frontTime = nowSeconds;
    for (const block of blocks) {
        const { thick } = slabShape(block);
        const seconds = frontTime !== null && block.time !== null ? frontTime - block.time : null;
        offset += gapFor(seconds) + (frontThick + thick) / 2;
        offsets.push(offset);
        frontThick = thick;
        frontTime = block.time;
    }
    return offsets;
}
