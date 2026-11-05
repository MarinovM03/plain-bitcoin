import { issued, MAX_SUPPLY } from '../../model/supply.ts';
import { HOME_SCENE } from '../../ui/scene-copy.ts';
import { compose, DEG, multiply, type Vec3 } from '../gfx/math.ts';
import { cellGrid, lathe, torus } from '../gfx/mesh.ts';
import { Beat, finite, INK, meshes, shade } from './kit.ts';
import type { CameraSpec, Frame, Item, Scene, Shadow } from './types.ts';

/** The last few blocks on the stack: the top one is the real tip, each below it one block older. */
export const STACK = 4;
const BLOCK = 0.62;
/** Everything stands on the table, the ground pool itself. */
const PLINTH_Y = 0;
const STACK_AT: Vec3 = [0, PLINTH_Y, -0.9];
const MINIS = ['left', 'power', 'convert', 'dca', 'address'] as const;
type Mini = (typeof MINIS)[number];
const MINI_AT: Record<Mini, Vec3> = {
    left: [-2.3, PLINTH_Y, 0.25],
    power: [-1.2, PLINTH_Y, 1.0],
    convert: [0, PLINTH_Y, 1.3],
    dca: [1.2, PLINTH_Y, 1.0],
    address: [2.3, PLINTH_Y, 0.25],
};
/** Miniatures are made at a small working size and set on the table at this scale. */
const MINI_SCALE = 1.3;

/** A fixed, small twist per block height, so the stack reads as stacked by hand. Same height, same twist. */
export function blockTwist(height: number): number {
    return (((height * 7919) % 13) - 6) * 0.9 * DEG;
}

export function createHome(): Scene {
    const m = meshes();
    const pan = lathe(
        [
            [0, 0],
            [0.2, 0],
            [0.26, 0.05],
            [0.2, 0.03],
            [0, 0.03],
        ],
        28,
    );
    const ring = torus(0.18, 0.05, 28, 10);
    const cube = cellGrid({ nx: 4, ny: 4, nz: 4, pitch: 0.15, size: 0.125 });
    let height = 0;
    const drop = new Beat(1.1);

    function mini(id: Mini, lift: number): Item[] {
        const [gx, gy, gz] = MINI_AT[id];
        const group = compose([gx, gy + lift, gz], [MINI_SCALE, MINI_SCALE, MINI_SCALE]);
        const x = 0;
        const y = 0;
        const z = 0;
        const items: Item[] = [];
        const add = (item: Omit<Item, 'part'>) => items.push({ ...item, model: multiply(group, item.model), part: id });
        switch (id) {
            case 'left': {
                // The ingot: issued share in bone, the rest to mine in orange, at the real height.
                const share = issued(height) / MAX_SUPPLY;
                const length = 1.0;
                add({
                    mesh: m.slab,
                    model: compose(
                        [x - length / 2 + (length * share) / 2, y + 0.11, z],
                        [length * share - 0.01, 0.22, 0.3],
                    ),
                    color: INK.warm,
                });
                const rest = length * (1 - share);
                add({
                    mesh: m.slab,
                    model: compose([x + length / 2 - rest / 2, y + 0.1, z], [Math.max(0.02, rest), 0.2, 0.27]),
                    color: INK.btc,
                });
                break;
            }
            case 'power': {
                add({ mesh: m.rod, model: compose([x, y + 0.32, z], [0.05, 0.64, 0.05]), color: INK.dim });
                add({
                    mesh: m.slab,
                    model: compose([x, y + 0.64, z], [0.9, 0.04, 0.05], 0, 0, -10 * DEG),
                    color: INK.ink,
                });
                add({ mesh: pan, model: compose([x - 0.44, y + 0.42, z], [1, 1, 1]), color: INK.warm });
                add({ mesh: m.slab, model: compose([x - 0.44, y + 0.48, z], [0.26, 0.08, 0.16]), color: INK.cool });
                add({ mesh: pan, model: compose([x + 0.44, y + 0.27, z], [1, 1, 1]), color: INK.warm });
                add({ mesh: m.coin, model: compose([x + 0.44, y + 0.36, z], [0.22, 0.16, 0.22]), color: INK.btc });
                add({
                    mesh: m.block,
                    model: compose([x, y + 0.02, z], [0.42, 0.04, 0.24]),
                    color: shade(INK.dim, 0.7),
                });
                break;
            }
            case 'convert':
                add({
                    mesh: cube,
                    model: compose([x, y, z], [1, 1, 1], 0, 0.6, 0),
                    color: shade(INK.dim, 0.45),
                    fill: { count: 22, color: INK.btc },
                });
                break;
            case 'dca': {
                const heights = [0.08, 0.12, 0.1, 0.18, 0.24, 0.2, 0.32, 0.42, 0.38, 0.52];
                for (const [k, h] of heights.entries()) {
                    add({
                        mesh: m.slab,
                        model: compose([x - 0.45 + k * 0.1, y + h / 2, z], [0.08, h, 0.2]),
                        color: k === heights.length - 1 ? INK.btc : shade(INK.edge, 1.5),
                    });
                }
                add({
                    mesh: m.slab,
                    model: compose([x, y + 0.3, z + 0.13], [1.0, 0.02, 0.02], 0, 0, 16 * DEG),
                    color: INK.ink,
                });
                break;
            }
            case 'address': {
                add({
                    mesh: ring,
                    model: compose([x - 0.42, y + 0.24, z], [1, 1, 1], Math.PI / 2, 0, 0),
                    color: shade(INK.warm, 0.92),
                });
                add({
                    mesh: m.slab,
                    model: compose([x + 0.12, y + 0.12, z], [0.78, 0.09, 0.06]),
                    color: shade(INK.warm, 0.92),
                });
                for (let k = 0; k < 6; k += 1) {
                    const h = 0.04 + ((k * 5) % 7) * 0.012;
                    add({
                        mesh: m.slab,
                        model: compose([x - 0.18 + k * 0.11, y + 0.165 + h / 2, z], [0.08, h, 0.06]),
                        color: shade(INK.warm, 0.92),
                    });
                }
                break;
            }
        }
        return items;
    }

    return {
        id: 'home',
        about: HOME_SCENE.description,
        camera(): CameraSpec {
            return {
                kind: 'perspective',
                target: [0, 0.9, 0.2],
                yaw: -0.26,
                pitch: 0.36,
                fov: 0.55,
                fit: { min: [-3.0, 0, -1.25], max: [3.0, PLINTH_Y + STACK * BLOCK + 0.1, 1.55] },
                fill: 1,
                maxYaw: 0.5,
                maxPitch: 0.2,
            };
        },
        set(data) {
            if (data.id !== 'home') return;
            height = Math.max(0, Math.floor(finite(data.height)));
        },
        step(dt) {
            return drop.step(dt);
        },
        frame(_view, hovered): Frame {
            const items: Item[] = [];
            // A real new block falls onto the stack; until it lands, the stack shows the blocks before it.
            const falling = drop.t >= 0;
            const fall = falling ? Math.min(1, drop.t / 0.7) : 1;
            const tip = falling ? height - 1 : height;
            for (let k = 0; k < STACK; k += 1) {
                const at = tip - (STACK - 1 - k);
                if (at < 0) continue;
                const top = k === STACK - 1;
                items.push({
                    mesh: m.block,
                    model: compose(
                        [STACK_AT[0], STACK_AT[1] + BLOCK * (k + 0.5) - (falling ? BLOCK * fall : 0), STACK_AT[2]],
                        [BLOCK * 0.94, BLOCK * 0.94, BLOCK * 0.94],
                        0,
                        blockTwist(at),
                        0,
                    ),
                    color: top && !falling ? INK.warm : shade(INK.dim, 0.75 + k * 0.06),
                    part: 'stack',
                });
            }
            if (falling) {
                const y = STACK_AT[1] + BLOCK * (STACK - 0.5) + 2.6 * (1 - fall * fall);
                items.push({
                    mesh: m.block,
                    model: compose(
                        [STACK_AT[0], y, STACK_AT[2]],
                        [BLOCK * 0.94, BLOCK * 0.94, BLOCK * 0.94],
                        0,
                        blockTwist(height),
                        0,
                    ),
                    color: INK.btc,
                    glow: 1 - fall,
                    part: 'stack',
                });
            }
            const shadows: Shadow[] = [{ x: STACK_AT[0], z: STACK_AT[2], rx: 0.75, rz: 0.75, strength: 0.85 }];
            for (const id of MINIS) {
                items.push(...mini(id, hovered === id ? 0.07 : 0));
                shadows.push({
                    x: MINI_AT[id][0],
                    z: MINI_AT[id][2],
                    rx: 0.7,
                    rz: 0.5,
                    strength: 0.6,
                });
            }
            return {
                items,
                tags: [
                    {
                        id: 'tip',
                        text: HOME_SCENE.tip(height),
                        at: [STACK_AT[0], STACK_AT[1] + BLOCK * STACK + 0.22, STACK_AT[2]],
                        tone: 'ink',
                    },
                ],
                shadows: shadows.slice(0, 6),
                ground: { y: PLINTH_Y, x: 0, z: 0.1, radius: 4.2 },
            };
        },
        parts() {
            return [
                { id: 'stack', label: HOME_SCENE.parts.stack ?? 'stack' },
                ...MINIS.map((id) => ({ id, label: HOME_SCENE.parts[id] ?? id })),
            ];
        },
        describe(part) {
            if (part === 'stack') return HOME_SCENE.stackCallout(height);
            return HOME_SCENE.miniCallout(part);
        },
        summary() {
            return `height=${height}`;
        },
        pulse() {
            drop.start();
        },
        tap(part) {
            return (MINIS as readonly string[]).includes(part) ? part : null;
        },
    };
}
