import { powerFills } from '../../gauges/power.ts';
import { POWER_SCENE } from '../../ui/scene-copy.ts';
import { clamp, compose, DEG } from '../gfx/math.ts';
import { lathe, type Mesh } from '../gfx/mesh.ts';
import { finite, INK, meshes, Spring, shade, Tween } from './kit.ts';
import type { CameraSpec, Frame, Item, Scene, SceneData, Tag } from './types.ts';

/** The beam turns this far for every tenfold between the two pans, on a labelled log dial. */
export const TILT_PER_DECADE = 8 * DEG;
/** Beyond a thousandfold the beam stops at its end stop, marked as such on the dial. */
export const MAX_DECADES = 3;
const PIVOT_Y = 2.55;
const ARM = 2.15;
const HANG = 1.25;
const STACK_MAX = 1.15;
const DIAL_R = 0.95;

export interface Balance {
    /** Stack heights in world units, from the same scale as the bars below the fold. */
    cash: number;
    bitcoin: number;
    log: boolean;
    /** Beam angle in radians: positive tips the bitcoin pan down. */
    tilt: number;
    /** bitcoin ÷ cash; 1 when there is no answer. */
    ratio: number;
    clamped: boolean;
}

/** The honest reading, pure: stack heights on the shared bar scale, and a tilt of 8° per ×10, stopping at ×1000. */
export function balanceLayout(cash: number, bitcoin: number): Balance {
    const a = finite(cash);
    const b = finite(bitcoin);
    if (!(a > 0) || !(b > 0)) return { cash: 0, bitcoin: 0, log: false, tilt: 0, ratio: 1, clamped: false };
    const { fills, log } = powerFills(a, b);
    const decades = Math.log10(b / a);
    const kept = clamp(decades, -MAX_DECADES, MAX_DECADES);
    return {
        cash: 0.08 + STACK_MAX * fills[0],
        bitcoin: 0.08 + STACK_MAX * fills[1],
        log,
        tilt: kept * TILT_PER_DECADE,
        ratio: b / a,
        clamped: kept !== decades,
    };
}

function dish(): Mesh {
    return lathe(
        [
            [0, 0],
            [0.62, 0],
            [0.78, 0.1],
            [0.8, 0.13],
            [0.74, 0.13],
            [0.6, 0.05],
            [0, 0.05],
        ],
        48,
    );
}

export function createPower(): Scene {
    const m = meshes();
    const pan = dish();
    let data: Extract<SceneData, { id: 'power' }> = { id: 'power', cash: 0, bitcoin: 0 };
    let layout = balanceLayout(0, 0);
    const beam = new Spring(0);
    const cash = new Tween(0, 0.32);
    const bitcoin = new Tween(0, 0.32);

    function stack(parts: Item[], part: string, x: number, y: number, height: number, coin: boolean): void {
        if (!(height > 0.001)) return;
        // Discrete notes or coins for the eye, but the stack's total height is the exact value.
        const count = Math.max(1, Math.min(14, Math.round(height / 0.11)));
        const each = height / count;
        for (let k = 0; k < count; k += 1) {
            const top = y + each * (k + 0.5);
            const turn = ((k * 37) % 11) * 0.03 - 0.15;
            parts.push(
                coin
                    ? {
                          mesh: m.coin,
                          model: compose([x, top, 0], [0.74, each * 0.94, 0.74], 0, turn, 0),
                          color: k % 2 ? INK.btc : shade(INK.btc, 0.95),
                          glow: 0.3,
                          part,
                      }
                    : {
                          mesh: m.slab,
                          model: compose([x, top, 0], [0.98, each * 0.9, 0.56], 0, turn, 0),
                          color: k % 2 ? INK.cool : shade(INK.cool, 0.92),
                          part,
                      },
            );
        }
    }

    return {
        id: 'power',
        about: POWER_SCENE.description,
        camera(): CameraSpec {
            return {
                kind: 'perspective',
                target: [0, 1.75, 0],
                yaw: -0.2,
                pitch: 0.16,
                fov: 0.6,
                fit: { min: [-ARM - 0.9, 0, -0.8], max: [ARM + 0.9, PIVOT_Y + DIAL_R + 0.25, 0.8] },
                fill: 0.92,
                maxYaw: 0.52,
                maxPitch: 0.2,
            };
        },
        set(next, instant) {
            if (next.id !== 'power') return;
            data = next;
            layout = balanceLayout(next.cash, next.bitcoin);
            beam.to(layout.tilt, instant);
            cash.to(layout.cash, instant);
            bitcoin.to(layout.bitcoin, instant);
        },
        step(dt) {
            return [beam.step(dt), cash.step(dt), bitcoin.step(dt)].some(Boolean);
        },
        frame(): Frame {
            const items: Item[] = [];
            const angle = beam.value;
            // Plinth and post.
            items.push({ mesh: m.block, model: compose([0, 0.09, 0], [2.4, 0.18, 1.2]), color: shade(INK.dim, 0.7) });
            items.push({
                mesh: m.rod,
                model: compose([0, 0.18 + PIVOT_Y / 2, 0], [0.13, PIVOT_Y, 0.13]),
                color: INK.dim,
            });
            // The dial: one tick per tenfold, ×1 straight up, a longer tick at the end stops.
            for (let k = -MAX_DECADES; k <= MAX_DECADES; k += 1) {
                const a = k * TILT_PER_DECADE;
                const long = k === 0 || Math.abs(k) === MAX_DECADES;
                const r = DIAL_R + (long ? 0.06 : 0);
                items.push({
                    mesh: m.slab,
                    model: compose(
                        [Math.sin(a) * r, PIVOT_Y + Math.cos(a) * r, -0.1],
                        [0.035, long ? 0.2 : 0.12, 0.03],
                        0,
                        0,
                        -a,
                    ),
                    color: k === 0 ? INK.ink : INK.dim,
                    part: 'beam',
                });
            }
            // Beam, pivot cap and the needle that reads the dial.
            items.push({
                mesh: m.block,
                model: compose([0, PIVOT_Y, 0], [ARM * 2 + 0.2, 0.11, 0.15], 0, 0, -angle),
                color: INK.ink,
                part: 'beam',
            });
            items.push({
                mesh: m.slab,
                model: compose(
                    [Math.sin(angle) * 0.45, PIVOT_Y + Math.cos(angle) * 0.45, 0.02],
                    [0.04, 0.9, 0.04],
                    0,
                    0,
                    -angle,
                ),
                color: INK.btc,
                part: 'beam',
            });
            items.push({
                mesh: m.coin,
                model: compose([0, PIVOT_Y, 0.09], [0.2, 0.06, 0.2], Math.PI / 2, 0, 0),
                color: INK.warm,
                part: 'beam',
            });
            // Pans hang plumb from the beam ends, whatever the tilt.
            const sides = [
                { part: 'pan-cash', x: -ARM, height: cash.value, coin: false },
                { part: 'pan-btc', x: ARM, height: bitcoin.value, coin: true },
            ] as const;
            const shadows = [];
            for (const side of sides) {
                const ex = side.x * Math.cos(angle);
                const ey = PIVOT_Y - side.x * Math.sin(angle);
                const panY = ey - HANG;
                for (const dz of [-0.36, 0.36]) {
                    const length = Math.hypot(HANG - 0.1, dz);
                    items.push({
                        mesh: m.rod,
                        model: compose(
                            [ex, ey - (HANG - 0.1) / 2, dz / 2],
                            [0.016, length, 0.016],
                            Math.atan2(-dz, HANG - 0.1),
                            0,
                            0,
                        ),
                        color: INK.dim,
                    });
                }
                items.push({ mesh: pan, model: compose([ex, panY, 0], [1, 1, 1]), color: INK.warm, part: side.part });
                stack(items, side.part, ex, panY + 0.05, side.height, side.coin);
                shadows.push({ x: ex, z: 0, rx: 0.9, rz: 0.75, strength: clamp(0.85 - panY * 0.25, 0.2, 0.7) });
            }
            shadows.push({ x: 0, z: 0, rx: 1.6, rz: 0.9, strength: 0.8 });
            const tags: Tag[] = [
                { id: 'one', text: '×1', at: [0, PIVOT_Y + DIAL_R + 0.22, -0.1], tone: 'dim' },
                {
                    id: 'up',
                    text: '×1000',
                    at: [
                        Math.sin(MAX_DECADES * TILT_PER_DECADE) * (DIAL_R + 0.3),
                        PIVOT_Y + Math.cos(MAX_DECADES * TILT_PER_DECADE) * (DIAL_R + 0.3),
                        -0.1,
                    ],
                    tone: 'dim',
                    align: 'start',
                },
                {
                    id: 'down',
                    text: '÷1000',
                    at: [
                        -Math.sin(MAX_DECADES * TILT_PER_DECADE) * (DIAL_R + 0.3),
                        PIVOT_Y + Math.cos(MAX_DECADES * TILT_PER_DECADE) * (DIAL_R + 0.3),
                        -0.1,
                    ],
                    tone: 'dim',
                    align: 'end',
                },
            ];
            if (data.cashLabel && data.bitcoinLabel && layout.ratio !== 1) {
                const low = PIVOT_Y - HANG - 0.35;
                tags.push({
                    id: 'cash',
                    text: data.cashLabel,
                    at: [-ARM * Math.cos(angle), low + ARM * Math.sin(angle), 0.5],
                    tone: 'cool',
                });
                tags.push({
                    id: 'btc',
                    text: data.bitcoinLabel,
                    at: [ARM * Math.cos(angle), low - ARM * Math.sin(angle), 0.5],
                    tone: 'btc',
                });
            }
            return { items, tags, shadows, ground: { y: 0, x: 0, z: 0, radius: 4.2 } };
        },
        parts() {
            return [
                { id: 'pan-cash', label: POWER_SCENE.parts.cash },
                { id: 'pan-btc', label: POWER_SCENE.parts.bitcoin },
                { id: 'beam', label: POWER_SCENE.parts.beam },
            ];
        },
        describe(part) {
            if (!(data.cash > 0) || !(data.bitcoin > 0)) return POWER_SCENE.empty;
            if (part === 'pan-cash') return POWER_SCENE.cashCallout(data.cashLabel ?? '', layout.log);
            if (part === 'pan-btc') return POWER_SCENE.bitcoinCallout(data.bitcoinLabel ?? '', layout.log);
            if (part === 'beam') return POWER_SCENE.beamCallout(layout.ratio, layout.clamped);
            return '';
        },
        summary() {
            return `ratio=${layout.ratio.toFixed(4)};tilt=${(layout.tilt / DEG).toFixed(2)};log=${layout.log}`;
        },
        pulse() {},
    };
}
