import { SATS_PER_BTC } from '../../model/supply.ts';
import { CONVERT_SCENE } from '../../ui/scene-copy.ts';
import { compose, mixRgb, type Vec3 } from '../gfx/math.ts';
import { cellGrid, type GridSpec } from '../gfx/mesh.ts';
import { Beat, finite, INK, meshes, shade } from './kit.ts';
import type { CameraSpec, Frame, Item, PartInfo, Scene, Tag } from './types.ts';

/**
 * One bitcoin as one block of exactly 100,000,000 sats: 1,000 cells of 100,000 sats; each of those holds 1,000
 * cells of 100 sats; each of those a tray of 100 single sats. 1,000 × 1,000 × 100 = 100,000,000.
 */
export const LEVELS = [
    { perCell: 100_000, cells: 1000, unit: 'mBTC' },
    { perCell: 100, cells: 1000, unit: 'bit' },
    { perCell: 1, cells: 100, unit: 'sat' },
] as const;
export const FACTORS = [1000, 1000, 100] as const;

const GRID: GridSpec = { nx: 10, ny: 10, nz: 10, pitch: 0.3, size: 0.255 };
const CUBE = GRID.pitch * 10;
const CUBE_X = 0.55;

export interface SatView {
    level: 0 | 1 | 2;
    /** Whole coins before the one in the block. */
    whole: number;
    filled: number;
    /** Share of the next cell, 0..1. */
    partial: number;
    /** Cells drawn at this level. */
    cells: number;
    perCell: number;
}

export function autoLevel(sats: number): 0 | 1 | 2 {
    const s = Math.max(0, Math.floor(finite(sats)));
    return s >= 100_000 ? 0 : s >= 100 ? 1 : 2;
}

/** What one level of the block shows for an amount, pure. A full coin fills the block; extra coins stand beside it. */
export function satView(sats: number, level: 0 | 1 | 2): SatView {
    const s = Math.max(0, Math.floor(finite(sats)));
    let whole = Math.floor(s / SATS_PER_BTC);
    let rest = s - whole * SATS_PER_BTC;
    if (whole > 0 && rest === 0) {
        whole -= 1;
        rest = SATS_PER_BTC;
    }
    let content = rest;
    for (let k = 0; k < level; k += 1) content %= LEVELS[k]?.perCell ?? 1;
    const spec = LEVELS[level];
    const filled = Math.min(spec.cells, Math.floor(content / spec.perCell));
    const partial = filled < spec.cells ? (content - filled * spec.perCell) / spec.perCell : 0;
    return { level, whole, filled, partial, cells: spec.cells, perCell: spec.perCell };
}

function cellAt(index: number, level: number): Vec3 {
    const layer = level === 2 ? 1 : GRID.ny;
    const perLayer = GRID.nx * GRID.nz;
    const y = Math.floor(index / perLayer);
    const z = Math.floor((index % perLayer) / GRID.nx);
    const x = index % GRID.nx;
    const half = (GRID.nx - 1) / 2;
    return [
        CUBE_X + (x - half) * GRID.pitch,
        GRID.size / 2 + Math.min(y, layer - 1) * GRID.pitch,
        (half - z) * GRID.pitch,
    ];
}

/** Exact boxes for the filled and empty regions, so a pointer picks what it is really over. */
function regions(view: SatView): { part: string; from: number; to: number }[] {
    const perLayer = GRID.nx * GRID.nz;
    const out: { part: string; from: number; to: number }[] = [];
    let at = 0;
    const push = (part: string, to: number) => {
        if (to > at) out.push({ part, from: at, to });
        at = Math.max(at, to);
    };
    const layers = Math.floor(view.filled / perLayer) * perLayer;
    push('filled', layers);
    const rows = layers + Math.floor((view.filled - layers) / GRID.nx) * GRID.nx;
    push('filled', rows);
    push('filled', view.filled);
    if (view.filled < view.cells) push('focus', view.filled + 1);
    const rowEnd = Math.ceil(at / GRID.nx) * GRID.nx;
    push('empty', Math.min(view.cells, rowEnd));
    const layerEnd = Math.ceil(at / perLayer) * perLayer;
    push('empty', Math.min(view.cells, layerEnd));
    push('empty', view.cells);
    return out;
}

function regionBox(from: number, to: number, level: number): { centre: Vec3; size: Vec3 } {
    const a = cellAt(from, level);
    const b = cellAt(to - 1, level);
    const min: Vec3 = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
    const max: Vec3 = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
    // A run that wraps a row covers whole rows: widen it to the full row span.
    const perLayer = GRID.nx * GRID.nz;
    const half = (GRID.nx - 1) / 2;
    if (to - from > GRID.nx || Math.floor(from / GRID.nx) !== Math.floor((to - 1) / GRID.nx)) {
        min[0] = CUBE_X - half * GRID.pitch;
        max[0] = CUBE_X + half * GRID.pitch;
    }
    if (to - from > perLayer || Math.floor(from / perLayer) !== Math.floor((to - 1) / perLayer)) {
        min[2] = -half * GRID.pitch;
        max[2] = half * GRID.pitch;
    }
    const pad = GRID.size;
    return {
        centre: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
        size: [max[0] - min[0] + pad, max[1] - min[1] + pad, max[2] - min[2] + pad],
    };
}

export function createConvert(): Scene {
    const m = meshes();
    const grid = cellGrid(GRID);
    let sats = 0;
    let level: 0 | 1 | 2 = 0;
    let view = satView(0, 0);
    let shown = 0;
    /** Zoom between levels: +1 flies into the next cell, -1 backs out of it. */
    const zoom = new Beat(0.7);
    let direction = 0;
    let from: 0 | 1 | 2 = 0;

    function go(next: 0 | 1 | 2, animate: boolean): void {
        if (next === level) return;
        from = level;
        direction = next > level ? 1 : -1;
        level = next;
        view = satView(sats, level);
        if (animate) zoom.start();
    }

    return {
        id: 'convert',
        about: CONVERT_SCENE.description,
        camera(): CameraSpec {
            return {
                kind: 'perspective',
                target: [0, CUBE * 0.42, 0],
                yaw: -0.62,
                pitch: 0.5,
                fov: 0.6,
                fit: { min: [-2.4, 0, -CUBE / 2 - 0.1], max: [CUBE_X + CUBE / 2 + 0.1, CUBE + 0.1, CUBE / 2 + 0.1] },
                fill: 0.9,
                maxYaw: 0.55,
                maxPitch: 0.22,
            };
        },
        set(data, instant) {
            if (data.id !== 'convert') return;
            sats = Math.max(0, Math.floor(finite(data.sats)));
            // A new amount lands at the level it reads best at, straight away: the camera is never left on an old amount.
            level = autoLevel(sats);
            zoom.t = -1;
            view = satView(sats, level);
            if (instant) shown = view.filled;
        },
        step(dt) {
            const moving = zoom.step(dt);
            const gap = view.filled - shown;
            if (gap !== 0) {
                const stepCells = Math.max(1, Math.ceil(Math.abs(gap) * Math.min(1, dt * 9)));
                shown += Math.sign(gap) * Math.min(Math.abs(gap), stepCells);
            }
            return moving || shown !== view.filled;
        },
        frame(_view, hovered): Frame {
            const items: Item[] = [];
            // While zooming, the outgoing level grows tenfold around the cell being entered (or shrinks back to it).
            let drawLevel = level;
            let scale = 1;
            let fill = shown;
            let focusIndex = view.filled;
            if (zoom.t >= 0) {
                const t = zoom.t * zoom.t * (3 - 2 * zoom.t);
                if (direction > 0) {
                    drawLevel = from;
                    const outer = satView(sats, from);
                    fill = outer.filled;
                    focusIndex = outer.filled;
                    scale = 10 ** t;
                } else {
                    drawLevel = level;
                    const outer = satView(sats, level);
                    fill = outer.filled;
                    focusIndex = outer.filled;
                    scale = 10 ** (1 - t);
                }
            }
            const spec = LEVELS[drawLevel];
            const pivot = cellAt(Math.min(focusIndex, spec.cells - 1), drawLevel);
            const place = (p: Vec3, s: Vec3) =>
                compose(
                    [
                        pivot[0] + (p[0] - pivot[0]) * scale,
                        pivot[1] + (p[1] - pivot[1]) * scale,
                        pivot[2] + (p[2] - pivot[2]) * scale,
                    ],
                    [s[0] * scale, s[1] * scale, s[2] * scale],
                );
            // One merged mesh for every cell; a pointer lights the region it is over by its colour.
            const lit = (part: string) => zoom.t < 0 && hovered === part;
            items.push({
                mesh: grid,
                model: place([CUBE_X, 0, 0], [1, 1, 1]),
                color: shade(INK.dim, lit('empty') ? 0.62 : 0.42),
                fill: {
                    count: fill,
                    color: lit('filled') ? mixRgb(INK.btc, INK.warm, 0.35) : INK.btc,
                    visible: spec.cells,
                },
                glow: 0.15,
                part: 'block',
                inert: true,
            });
            if (lit('focus') && view.filled < view.cells) {
                const c = cellAt(view.filled, level);
                items.push({
                    mesh: m.slab,
                    model: compose([c[0], c[1] + 0.02, c[2]], [GRID.size * 1.08, GRID.size * 1.08, GRID.size * 1.08]),
                    color: shade(INK.btc, 0.6),
                    part: 'focus',
                    inert: true,
                });
            }
            const partial = zoom.t >= 0 ? satView(sats, drawLevel).partial : view.partial;
            if (partial > 0 && focusIndex < spec.cells) {
                const c = cellAt(focusIndex, drawLevel);
                const h = GRID.size * partial;
                items.push({
                    mesh: m.slab,
                    model: place(
                        [c[0], c[1] - GRID.size / 2 + h / 2 + 0.001, c[2]],
                        [GRID.size * 1.04, h, GRID.size * 1.04],
                    ),
                    color: INK.btc,
                    part: 'focus',
                    glow: 0.4,
                });
            }
            if (zoom.t < 0) {
                for (const region of regions(view)) {
                    const box = regionBox(region.from, region.to, level);
                    items.push({
                        mesh: m.slab,
                        model: compose(box.centre, box.size),
                        color: INK.btc,
                        part: region.part,
                        hidden: true,
                    });
                }
            }
            if (view.whole > 0 && level === 0 && zoom.t < 0) {
                const shownCoins = Math.min(3, view.whole);
                for (let k = 0; k < shownCoins; k += 1) {
                    const size = CUBE * 0.36;
                    items.push({
                        mesh: m.block,
                        model: compose([-1.75, size / 2 + k * (size + 0.04), 0.3], [size, size, size]),
                        color: k % 2 ? shade(INK.btc, 0.9) : INK.btc,
                        part: 'whole',
                    });
                }
            }
            const top = CUBE + 0.12;
            const tags: Tag[] = [
                {
                    id: 'level',
                    text: `${CONVERT_SCENE.levelTag(level)} ${CONVERT_SCENE.cellTag(level)}`,
                    at: [CUBE_X, top + 0.15, -CUBE / 2],
                    tone: 'dim',
                },
            ];
            if (view.whole > 0 && level === 0)
                tags.push({
                    id: 'whole',
                    text: CONVERT_SCENE.wholeTag(view.whole),
                    at: [-1.75, CUBE * 0.36 * Math.min(3, view.whole) + 0.25, 0.3],
                    tone: 'btc',
                });
            return {
                items,
                tags,
                shadows: [
                    { x: CUBE_X, z: 0, rx: CUBE * 0.62, rz: CUBE * 0.62, strength: 0.85 },
                    ...(view.whole > 0 ? [{ x: -1.75, z: 0.3, rx: 0.8, rz: 0.8, strength: 0.7 }] : []),
                ],
                ground: { y: 0, x: CUBE_X * 0.5, z: 0, radius: 4.6 },
            };
        },
        parts() {
            const list: PartInfo[] = [
                { id: 'filled', label: CONVERT_SCENE.parts.filled },
                { id: 'block', label: CONVERT_SCENE.parts.block },
            ];
            if (level < 2 && view.filled < view.cells) list.push({ id: 'focus', label: CONVERT_SCENE.parts.zoomIn });
            if (level > 0) list.push({ id: 'out', label: CONVERT_SCENE.parts.zoomOut });
            return list;
        },
        describe(part) {
            return CONVERT_SCENE.callout(part, view, sats);
        },
        summary() {
            return `sats=${sats};level=${level};filled=${view.filled};whole=${view.whole}`;
        },
        pulse() {},
        tap(part) {
            if (part === 'focus' && level < 2 && view.filled < view.cells) go((level + 1) as 1 | 2, true);
            else if ((part === 'out' || part === 'empty' || part === 'filled' || part === 'block') && level > 0)
                go((level - 1) as 0 | 1, true);
            return null;
        },
    };
}
