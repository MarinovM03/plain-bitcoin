import type { ChainBlock } from '../data/height.ts';
import { FACE_CELLS, facePath } from './hash.ts';
import { hashMaterial, shade } from './material.ts';
import { chainOffsets, slabShape } from './shape.ts';
import {
    FORMING,
    project,
    type Station,
    slabBase,
    slabPoint,
    stationCamera,
    type Vec3,
    viewProjection,
} from './view.ts';

export interface StillOptions {
    width: number;
    height: number;
    /** Seconds since the epoch, or null when the time since the newest block is not known. */
    nowSeconds: number | null;
    /** Draw the outline of the block being found in front of the chain. */
    forming: boolean;
    /** The page colour the far tablets fade into, #rrggbb. */
    ink: string;
    /** Where the camera stands; the wide home shot when left out. */
    station?: Station;
}

const FACE_MARGIN = 0.085;
const FOG_REACH = 13;

type Point = readonly [number, number];

function mix(a: string, b: string, share: number): string {
    const read = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
    const from = read(a);
    const to = read(b);
    return `#${from
        .map((channel, index) =>
            Math.round(channel + ((to[index] ?? 0) - channel) * share)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

function points(list: readonly Point[]): string {
    return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/**
 * The chain as a flat drawing, from the same blocks, sizes, gaps, stones and camera as the lit scene. It stands in
 * wherever the scene cannot run, and is the first thing painted while the scene loads.
 */
export function chainStill(blocks: readonly ChainBlock[], options: StillOptions): string {
    const width = Math.max(1, Math.round(options.width));
    const height = Math.max(1, Math.round(options.height));
    const offsets = chainOffsets(blocks, options.nowSeconds);
    const camera = stationCamera(options.station ?? 'home', width / height, {
        first: offsets[0] ?? 1.2,
        last: offsets[offsets.length - 1] ?? 9,
    });
    const matrix = viewProjection(camera);
    const toScreen = (point: Vec3): Point => {
        const { x, y } = project(matrix, point);
        return [((x + camera.shift.x + 1) / 2) * width, ((1 - y - camera.shift.y) / 2) * height];
    };
    const parts: string[] = [];

    const box = (offset: number, side: number, thick: number) => {
        const base = slabBase(offset);
        const corner = (x: number, y: number, z: number) => toScreen(slabPoint(base, [x * side, y * side, z * thick]));
        return {
            front: [corner(-0.5, 1, 0.5), corner(0.5, 1, 0.5), corner(0.5, 0, 0.5), corner(-0.5, 0, 0.5)] as const,
            top: [corner(-0.5, 1, -0.5), corner(0.5, 1, -0.5), corner(0.5, 1, 0.5), corner(-0.5, 1, 0.5)] as const,
            left: [corner(-0.5, 1, -0.5), corner(-0.5, 1, 0.5), corner(-0.5, 0, 0.5), corner(-0.5, 0, -0.5)] as const,
            foot: toScreen(slabPoint(base, [0, 0, 0])),
        };
    };

    for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const block = blocks[index];
        const offset = offsets[index];
        if (!block || offset === undefined) continue;
        const { side, thick } = slabShape(block);
        const material = hashMaterial(block.hash);
        const fog = Math.min(0.9, (offset / FOG_REACH) ** 1.4);
        const tone = (hex: string) => mix(hex, options.ink, fog);
        const shape = box(offset, side, thick);
        const [topLeft, topRight, , bottomLeft] = shape.front;
        const reach = Math.hypot(topRight[0] - topLeft[0], topRight[1] - topLeft[1]);
        parts.push(
            `<ellipse cx="${shape.foot[0].toFixed(1)}" cy="${shape.foot[1].toFixed(1)}" rx="${(reach * 0.78).toFixed(1)}" ry="${(reach * 0.13).toFixed(1)}" fill="url(#still-shadow)"/>`,
            `<polygon points="${points(shape.top)}" fill="${tone(shade(material.body, 0.22))}"/>`,
            `<polygon points="${points(shape.left)}" fill="${tone(shade(material.body, -0.42))}"/>`,
            `<polygon points="${points(shape.front)}" fill="${tone(material.body)}"/>`,
        );
        const cells = facePath(block.hash);
        if (cells) {
            const inner = (1 - FACE_MARGIN * 2) / FACE_CELLS;
            const ax = (topRight[0] - topLeft[0]) * inner;
            const ay = (topRight[1] - topLeft[1]) * inner;
            const bx = (bottomLeft[0] - topLeft[0]) * inner;
            const by = (bottomLeft[1] - topLeft[1]) * inner;
            const ox = topLeft[0] + (ax + bx) * FACE_MARGIN * FACE_CELLS;
            const oy = topLeft[1] + (ay + by) * FACE_MARGIN * FACE_CELLS;
            const numbers = [ax, ay, bx, by, ox, oy].map((value) => value.toFixed(3)).join(' ');
            parts.push(`<path transform="matrix(${numbers})" d="${cells}" fill="${tone(material.inlay)}"/>`);
        }
    }

    if (options.forming) {
        const shape = box(0, FORMING.side, FORMING.thick);
        for (const face of [shape.top, shape.left, shape.front]) {
            parts.push(
                `<polygon points="${points(face)}" fill="none" stroke="#f7931a" stroke-opacity="0.75" stroke-width="1.25" stroke-dasharray="3 5" stroke-linejoin="round"/>`,
            );
        }
    }

    const pool = toScreen(slabBase(1.6));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" focusable="false" aria-hidden="true"><defs><radialGradient id="still-pool"><stop offset="0" stop-color="#f1efe9" stop-opacity="0.1"/><stop offset="1" stop-color="#f1efe9" stop-opacity="0"/></radialGradient><radialGradient id="still-shadow"><stop offset="0" stop-color="#000000" stop-opacity="0.7"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${pool[0].toFixed(1)}" cy="${pool[1].toFixed(1)}" rx="${(width * 0.62).toFixed(1)}" ry="${(height * 0.26).toFixed(1)}" fill="url(#still-pool)"/>${parts.join('')}</svg>`;
}
