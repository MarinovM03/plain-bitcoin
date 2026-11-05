import {
    HALVING_INTERVAL,
    INITIAL_SUBSIDY,
    issued,
    issuedBeforeEra,
    MAX_SUPPLY,
    SATS_PER_BTC,
} from '../../model/supply.ts';
import { LEFT_SCENE } from '../../ui/scene-copy.ts';
import { compose, mixRgb } from '../gfx/math.ts';
import { Beat, finite, INK, meshes, shade, Tween } from './kit.ts';
import type { CameraSpec, Frame, Item, Scene, SceneData, Tag } from './types.ts';

/** World length of the bar that stands for all 21 million. */
export const BAR = 10;
const BAR_H = 1.05;
const BAR_D = 1.3;
const ZOOM_D = 0.9;
const ZOOM_H = 0.72;
/** The inset magnifies the last 2,000,000 BTC: 21M / 2M = 10.5 times longer than on the full bar. */
export const ZOOM_FROM = 19_000_000 * SATS_PER_BTC;
export const ZOOM_FACTOR = MAX_SUPPLY / (MAX_SUPPLY - ZOOM_FROM);
const MAIN_Z = -0.95;
const ZOOM_Z = 1.05;
/** Eras drawn one by one on the full bar; the rest are one tail block (each later era is under 1/128 of the bar). */
const MAIN_ERAS = 4;
const ZOOM_ERAS = 9;
const LAST_ERA = 33;
/** Cut between slabs, in world units. The cuts are seams, not volume: each slab keeps its true interval. */
const SEAM = 0.03;

export interface Slab {
    part: string;
    era: number;
    /** Interval along the bar, world units from the bar's left end. */
    x0: number;
    x1: number;
    /** Supply interval it stands for, in sats. */
    from: number;
    to: number;
    issued: boolean;
}

export function eraIssuance(era: number): number {
    if (era >= LAST_ERA) return 0;
    return HALVING_INTERVAL * Math.floor(INITIAL_SUBSIDY / 2 ** era);
}

/** Splits a supply interval at the issued amount, so a slab is either all issued or all still to mine. */
function split(part: string, era: number, from: number, to: number, issuedNow: number, toX: (sats: number) => number) {
    const out: Slab[] = [];
    const cut = Math.min(to, Math.max(from, issuedNow));
    if (cut > from) out.push({ part, era, from, to: cut, x0: toX(from), x1: toX(cut), issued: true });
    if (to > cut) out.push({ part, era, from: cut, to, x0: toX(cut), x1: toX(to), issued: false });
    return out;
}

/**
 * The bar and its inset, pure. Each slab's length is exactly its share of the 21 million (on the inset, its share
 * of the last 2 million): volume is supply, since every slab has the same cross-section.
 */
export function ingotLayout(height: number): { main: Slab[]; zoom: Slab[]; issued: number; era: number } {
    const safe = Number.isSafeInteger(height) && height >= 0 ? height : 0;
    const issuedNow = issued(safe);
    const era = Math.floor(safe / HALVING_INTERVAL);
    const mainX = (sats: number) => (sats / MAX_SUPPLY) * BAR;
    const zoomX = (sats: number) => ((sats - ZOOM_FROM) / (MAX_SUPPLY - ZOOM_FROM)) * BAR;
    const main: Slab[] = [];
    for (let e = 0; e < MAIN_ERAS; e += 1) {
        main.push(...split(`era-${e}`, e, issuedBeforeEra(e), issuedBeforeEra(e + 1), issuedNow, mainX));
    }
    main.push(...split('last', MAIN_ERAS, issuedBeforeEra(MAIN_ERAS), MAX_SUPPLY, issuedNow, mainX));
    const zoom: Slab[] = [];
    for (let e = 0; e < LAST_ERA; e += 1) {
        const from = Math.max(ZOOM_FROM, issuedBeforeEra(e));
        const to = e < ZOOM_ERAS - 1 ? issuedBeforeEra(e + 1) : MAX_SUPPLY;
        if (to <= ZOOM_FROM) continue;
        const part = e < ZOOM_ERAS - 1 ? `zoom-${e}` : 'zoom-tail';
        zoom.push(...split(part, e, from, to, issuedNow, zoomX));
        if (e >= ZOOM_ERAS - 1) break;
    }
    return { main, zoom, issued: issuedNow, era };
}

export function createLeft(): Scene {
    const m = meshes();
    let height = 0;
    let layout = ingotLayout(0);
    const grow = new Tween(0, 0.5);
    const sliver = new Beat(1.6);

    function slabs(list: readonly Slab[], z: number, h: number, d: number, factor: number) {
        const items: Item[] = [];
        for (const slab of list) {
            const length = Math.max(0.004, slab.x1 - slab.x0 - SEAM);
            const x = (slab.x0 + slab.x1) / 2 - BAR / 2;
            const tone = slab.issued ? (slab.era % 2 === 0 ? INK.warm : shade(INK.warm, 0.86)) : INK.btc;
            // Still-to-mine is cut a little lower and narrower: carved out of the bar, not added to it.
            const carve = slab.issued ? 1 : 0.9;
            items.push({
                mesh: m.slab,
                model: compose([x, (h * carve) / 2, z], [length, h * carve * factor, d * carve]),
                color: tone,
                part: slab.part,
            });
        }
        return items;
    }

    function now(list: readonly Slab[]): number {
        return list.find((slab) => !slab.issued)?.x0 ?? BAR;
    }

    return {
        id: 'left',
        about: LEFT_SCENE.description,
        camera(): CameraSpec {
            return {
                kind: 'perspective',
                target: [0, 0.35, 0.05],
                yaw: -0.36,
                pitch: 0.42,
                fov: 0.62,
                fit: {
                    min: [-BAR / 2 - 0.2, 0, MAIN_Z - BAR_D / 2],
                    max: [BAR / 2 + 0.2, BAR_H + 0.3, ZOOM_Z + ZOOM_D / 2 + 0.75],
                },
                fill: 0.9,
                maxYaw: 0.55,
                maxPitch: 0.22,
            };
        },
        set(data: SceneData, instant) {
            if (data.id !== 'left') return;
            const next = finite(data.height, 0);
            if (next === height && layout.main.length > 0) return;
            height = next;
            layout = ingotLayout(height);
            grow.to(1, instant);
        },
        step(dt) {
            return [grow.step(dt), sliver.step(dt)].some(Boolean);
        },
        frame(): Frame {
            const rise = 0.4 + 0.6 * grow.value;
            const items = [
                ...slabs(layout.main, MAIN_Z, BAR_H, BAR_D, rise),
                ...slabs(layout.zoom, ZOOM_Z, ZOOM_H, ZOOM_D, rise),
            ];
            const zoomNow = now(layout.zoom) - BAR / 2;
            // Leader rods tie the inset to the stretch of the bar it magnifies: an honest, labelled break of scale.
            const from = (ZOOM_FROM / MAX_SUPPLY) * BAR - BAR / 2;
            for (const [a, b] of [
                [from, -BAR / 2],
                [BAR / 2, BAR / 2],
            ] as const) {
                const back = MAIN_Z + BAR_D / 2;
                const front = ZOOM_Z - ZOOM_D / 2;
                const dx = b - a;
                const length = Math.hypot(dx, front - back);
                // A unit rod stands along y; tip it flat along z, then swing it toward its far end.
                items.push({
                    mesh: m.rod,
                    model: compose(
                        [(a + b) / 2, 0.012, (back + front) / 2],
                        [0.018, length, 0.018],
                        Math.PI / 2,
                        Math.atan2(dx, front - back),
                        0,
                    ),
                    color: INK.edge,
                });
            }
            // The seam where issuance stands now, on the inset where it is wide enough to see.
            items.push({
                mesh: m.slab,
                model: compose([zoomNow, ZOOM_H * 0.62 * rise, ZOOM_Z], [0.025, ZOOM_H * 1.32 * rise, ZOOM_D * 1.08]),
                color: INK.ink,
                part: 'now',
                glow: 0.6,
            });
            if (sliver.t >= 0) {
                // A real new block: the next 3.125 BTC drops onto the issued side. A marker, not to scale.
                const fall = Math.min(1, sliver.t / 0.55);
                const settle = Math.max(0, (sliver.t - 0.55) / 0.45);
                const y = ZOOM_H + 1.6 * (1 - fall * fall) + 0.02;
                items.push({
                    mesh: m.slab,
                    model: compose([zoomNow - 0.05, y, ZOOM_Z], [0.07 * (1 - settle * 0.9), 0.07, ZOOM_D * 0.9]),
                    color: mixRgb(INK.btc, INK.warm, fall),
                    glow: 1 - settle,
                });
            }
            const tags: Tag[] = [
                {
                    id: 'zero',
                    text: LEFT_SCENE.zero,
                    at: [-BAR / 2, BAR_H + 0.22, MAIN_Z],
                    tone: 'dim',
                    align: 'start',
                },
                { id: 'max', text: LEFT_SCENE.max, at: [BAR / 2, BAR_H + 0.22, MAIN_Z], tone: 'dim', align: 'end' },
                {
                    id: 'now',
                    text: LEFT_SCENE.now,
                    at: [zoomNow, ZOOM_H * 1.4 + 0.12, ZOOM_Z],
                    tone: 'btc',
                    align: 'middle',
                },
                {
                    id: 'zoom',
                    text: LEFT_SCENE.zoom,
                    at: [-BAR / 2, 0, ZOOM_Z + ZOOM_D / 2 + 0.7],
                    tone: 'dim',
                    align: 'start',
                },
                {
                    id: 'zoomEnd',
                    text: LEFT_SCENE.max,
                    at: [BAR / 2, 0, ZOOM_Z + ZOOM_D / 2 + 0.7],
                    tone: 'dim',
                    align: 'end',
                },
            ];
            if (sliver.t >= 0)
                tags.push({ id: 'sliver', text: LEFT_SCENE.sliver, at: [zoomNow, ZOOM_H + 1.0, ZOOM_Z], tone: 'btc' });
            return {
                items,
                tags,
                shadows: [
                    { x: 0, z: MAIN_Z, rx: BAR * 0.56, rz: BAR_D * 0.75, strength: 0.75 },
                    { x: 0, z: ZOOM_Z, rx: BAR * 0.56, rz: ZOOM_D * 0.75, strength: 0.7 },
                ],
                ground: { y: 0, x: 0, z: 0, radius: 7.5 },
            };
        },
        parts() {
            const ids = [...new Set([...layout.main, ...layout.zoom].map((slab) => slab.part)), 'now'];
            return ids.map((id) => ({ id, label: LEFT_SCENE.partLabel(id) }));
        },
        describe(part) {
            if (part === 'now') return LEFT_SCENE.nowCallout(layout.issued, height);
            const all = [...layout.main, ...layout.zoom].filter((slab) => slab.part === part);
            if (all.length === 0) return '';
            const era = all[0]?.era ?? 0;
            const tail = part === 'last' || part === 'zoom-tail';
            const from = Math.min(...all.map((slab) => slab.from));
            const to = Math.max(...all.map((slab) => slab.to));
            const issuedPart = all.filter((slab) => slab.issued).reduce((sum, slab) => sum + slab.to - slab.from, 0);
            return LEFT_SCENE.eraCallout({ era, tail, from, to, issued: issuedPart, height });
        },
        summary() {
            return `issued=${layout.issued};era=${layout.era}`;
        },
        pulse() {
            sliver.start();
        },
    };
}
