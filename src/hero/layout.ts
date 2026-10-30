import { issuedBeforeEra, MAX_SUPPLY, SATS_PER_BTC } from '../model/supply.ts';

export const TOKEN_BTC = 1_000;
export const TOKEN_SATS = TOKEN_BTC * SATS_PER_BTC;
export const TOKEN_COUNT = Number(ceilDiv(BigInt(MAX_SUPPLY), BigInt(TOKEN_SATS)));
export const TOKEN_RADIUS = 0.4;
export const TOKEN_HEIGHT = 0.14;
export const TERRACE_STEP = 0.45;
export const BASE_DEPTH = 0.6;
export const SLAB_ERAS = 18;

type Side = 'left' | 'back' | 'right' | 'front';

const SIDES: readonly Side[] = ['left', 'back', 'right', 'front'];

export interface Rect {
    x: number;
    z: number;
    w: number;
    d: number;
}

export interface EraBlock extends Rect {
    era: number;
    top: number;
    first: number;
    count: number;
}

export interface FieldLayout {
    width: number;
    depth: number;
    blocks: EraBlock[];
    positions: Float32Array;
    heights: Float32Array;
    eras: Uint8Array;
}

export interface TokenState {
    full: number;
    partial: number;
}

function ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b;
}

export function firstTokenOfEra(era: number): number {
    return Math.min(TOKEN_COUNT, Number(ceilDiv(BigInt(issuedBeforeEra(era)), BigInt(TOKEN_SATS))));
}

export function tokenState(issuedSats: number): TokenState {
    const full = Math.floor(issuedSats / TOKEN_SATS);
    if (issuedSats >= MAX_SUPPLY) return { full: TOKEN_COUNT, partial: 0 };
    const rest = issuedSats - full * TOKEN_SATS;
    const size = Math.min(TOKEN_SATS, MAX_SUPPLY - full * TOKEN_SATS);
    return { full, partial: rest / size };
}

function split(rect: Rect, side: Side): { taken: Rect; rest: Rect } {
    const halfW = rect.w / 2;
    const halfD = rect.d / 2;
    switch (side) {
        case 'left':
            return { taken: { ...rect, w: halfW }, rest: { ...rect, x: rect.x + halfW, w: halfW } };
        case 'right':
            return { taken: { ...rect, x: rect.x + halfW, w: halfW }, rest: { ...rect, w: halfW } };
        case 'back':
            return { taken: { ...rect, d: halfD }, rest: { ...rect, z: rect.z + halfD, d: halfD } };
        case 'front':
            return { taken: { ...rect, z: rect.z + halfD, d: halfD }, rest: { ...rect, d: halfD } };
    }
}

function inset(rect: Rect): Rect {
    const gap = Math.min(0.9, 0.12 * Math.min(rect.w, rect.d));
    return { x: rect.x + gap / 2, z: rect.z + gap / 2, w: rect.w - gap, d: rect.d - gap };
}

function placeTokens(block: EraBlock, side: Side, positions: Float32Array): void {
    const acrossX = side === 'left' || side === 'right';
    const along = acrossX ? block.d : block.w;
    const across = acrossX ? block.w : block.d;
    const spacing = Math.sqrt((block.w * block.d) / block.count);
    const perLine = Math.max(1, Math.round(along / spacing));
    const lines = Math.ceil(block.count / perLine);
    const step = along / perLine;
    const lineStep = across / lines;
    const fromEnd = side === 'right' || side === 'front';
    for (let k = 0; k < block.count; k += 1) {
        const line = Math.floor(k / perLine);
        const slot = k % perLine;
        const a = (slot + 0.5) * step;
        const c = (line + 0.5) * lineStep;
        const acrossPos = fromEnd ? across - c : c;
        const x = block.x + (acrossX ? acrossPos : a);
        const z = block.z + (acrossX ? a : acrossPos);
        const i = block.first + k;
        positions[i * 2] = x;
        positions[i * 2 + 1] = z;
    }
}

export function fieldLayout(): FieldLayout {
    const width = Math.sqrt(TOKEN_COUNT * Math.SQRT2);
    const depth = width / Math.SQRT2;
    const positions = new Float32Array(TOKEN_COUNT * 2);
    const heights = new Float32Array(TOKEN_COUNT);
    const eras = new Uint8Array(TOKEN_COUNT);
    const blocks: EraBlock[] = [];
    let rest: Rect = { x: -width / 2, z: -depth / 2, w: width, d: depth };

    for (let era = 0; era < SLAB_ERAS; era += 1) {
        const side = SIDES[era % SIDES.length] ?? 'left';
        const parts = split(rest, side);
        rest = parts.rest;
        const first = firstTokenOfEra(era);
        const block: EraBlock = {
            ...inset(parts.taken),
            era,
            top: era * TERRACE_STEP,
            first,
            count: firstTokenOfEra(era + 1) - first,
        };
        blocks.push(block);
        if (block.count === 0) continue;
        placeTokens(block, side, positions);
        heights.fill(block.top, first, first + block.count);
        eras.fill(era, first, first + block.count);
    }
    return { width, depth, blocks, positions, heights, eras };
}

export function tokensBounds(layout: FieldLayout, from: number, to = TOKEN_COUNT): Rect {
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let i = Math.max(0, from); i < Math.min(TOKEN_COUNT, to); i += 1) {
        const x = layout.positions[i * 2] ?? 0;
        const z = layout.positions[i * 2 + 1] ?? 0;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }
    return { x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ };
}
