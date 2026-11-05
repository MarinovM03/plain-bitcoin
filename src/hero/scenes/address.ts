import { foreignChars } from '../../gauges/address.ts';
import type { CharRole } from '../../gauges/types.ts';
import { ADDRESS_SCENE } from '../../ui/scene-copy.ts';
import { compose, type Vec3 } from '../gfx/math.ts';
import { cylinder, torus } from '../gfx/mesh.ts';
import { Beat, INK, meshes, shade, Tween } from './kit.ts';
import type { CameraSpec, Frame, Item, PartInfo, Scene, SceneData, Tag } from './types.ts';

export const MAX_TEETH = 90;
/** A blade always has room for this many teeth, so a short address does not cut absurdly wide ones. */
const MIN_SLOTS = 34;
const BLADE_X = -2.6;
const BLADE_L = 7.4;
const SPINE_Y = 0.25;
const SPINE_H = 0.36;
const BLANK = 0.72;
const SHEAR = SPINE_Y + SPINE_H + BLANK + 0.32;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

type AddressData = Extract<SceneData, { id: 'address' }>;

export type PinState = 'seated' | 'short' | 'stuck';

export interface Tooth {
    char: string;
    role: CharRole;
    /** Height of the cut above the spine, world units: one of eight depths, set by the character itself. */
    cut: number;
    pin: PinState;
}

/** Eight cut depths, like a real key's bitting: each character always cuts the same depth. */
export function cutDepth(char: string): number {
    const index = ALPHABET.indexOf(char);
    const code = index >= 0 ? index % 8 : 7;
    return 0.14 + (BLANK - 0.14) * (code / 7);
}

/**
 * The key for an address, pure. Every tooth is one typed character. When the validator proves the address, every
 * pin seats at the shear line and the plug turns; a character that cannot belong leaves its pin stuck up; anything
 * short of a proven address leaves the pins short of the line.
 */
export function keyLayout(data: AddressData): { teeth: Tooth[]; total: number; valid: boolean } {
    const text = [...(data.text ?? '')];
    const total = text.length;
    const foreign = foreignChars(data.text ?? '');
    const teeth = text.slice(0, MAX_TEETH).map((char, i): Tooth => {
        const role = data.roles[i] ?? 'unknown';
        const stuck = i === data.suspect || foreign[i] === true;
        const pin: PinState = data.state === 'valid' ? 'seated' : stuck ? 'stuck' : 'short';
        return { char, role, cut: cutDepth(char), pin };
    });
    return { teeth, total, valid: data.state === 'valid' };
}

const ROLE_COLOUR: Record<CharRole, Vec3> = {
    hrp: INK.cool,
    prefix: INK.cool,
    separator: INK.dim,
    version: INK.dim,
    program: INK.warm,
    body: INK.warm,
    checksum: INK.ink,
    unknown: shade(INK.warm, 0.8),
};

export function createAddress(): Scene {
    const m = meshes();
    const bow = torus(0.72, 0.17, 48, 16);
    const plugMesh = cylinder(0.72, 0.2, 48, 0.04);
    let data: AddressData = { id: 'address', text: '', roles: [], state: 'empty', suspect: null, checksumBad: false };
    let layout = keyLayout(data);
    let cuts: Tween[] = [];
    let pins: Tween[] = [];
    const turn = new Tween(0, 0.12);
    const click = new Beat(0.5);

    function slot(): number {
        return BLADE_L / Math.max(MIN_SLOTS, layout.teeth.length);
    }

    function pinLength(tooth: Tooth, top: number): number {
        const reach = SHEAR - top - 0.03;
        if (tooth.pin === 'seated') return reach;
        if (tooth.pin === 'stuck') return 0.42;
        return reach * 0.72;
    }

    return {
        id: 'address',
        about: ADDRESS_SCENE.description,
        camera(): CameraSpec {
            return {
                kind: 'perspective',
                target: [0.3, 1.0, 0],
                yaw: -0.28,
                pitch: 0.2,
                fov: 0.55,
                fit: { min: [-4.4, 0, -0.75], max: [BLADE_X + BLADE_L + 0.7, SHEAR + 0.5, 0.75] },
                fill: 0.94,
                maxYaw: 0.6,
                maxPitch: 0.26,
            };
        },
        set(next, instant) {
            if (next.id !== 'address') return;
            const wasValid = layout.valid;
            data = next;
            layout = keyLayout(next);
            const count = layout.teeth.length;
            // Teeth already cut keep their tween; a newly typed one is cut from the blank.
            cuts = layout.teeth.map((tooth, i) => {
                const tween = cuts[i] ?? new Tween(BLANK, 0.09);
                tween.to(tooth.cut, instant);
                return tween;
            });
            pins = layout.teeth.map((tooth, i) => {
                const tween = pins[i] ?? new Tween(0.3, 0.1);
                tween.to(pinLength(tooth, SPINE_Y + SPINE_H + tooth.cut), instant);
                return tween;
            });
            cuts.length = count;
            pins.length = count;
            turn.to(layout.valid ? Math.PI / 2 : 0, instant);
            if (layout.valid && !wasValid && !instant) click.start();
        },
        step(dt) {
            return [...cuts.map((t) => t.step(dt)), ...pins.map((t) => t.step(dt)), turn.step(dt), click.step(dt)].some(
                Boolean,
            );
        },
        frame(_view, hovered): Frame {
            const items: Item[] = [];
            const w = slot();
            const steel = shade(INK.warm, 0.92);
            // Bow, shoulder and the spine of the blade.
            items.push({
                mesh: bow,
                model: compose([-3.62, 0.95, 0], [1, 1, 1], Math.PI / 2, 0, 0),
                color: steel,
                part: 'bow',
            });
            items.push({
                mesh: m.slab,
                model: compose([-3.62, 0.95, 0], [1.2, 1.2, 0.08]),
                color: shade(INK.warm, 0.55),
                part: 'bow',
            });
            items.push({
                mesh: m.block,
                model: compose([BLADE_X - 0.25, 0.75, 0], [0.5, 1.0, 0.3]),
                color: steel,
            });
            items.push({
                mesh: m.slab,
                model: compose([BLADE_X + BLADE_L / 2, SPINE_Y + SPINE_H / 2, 0], [BLADE_L, SPINE_H, 0.22]),
                color: steel,
            });
            const typed = layout.teeth.length;
            const slots = Math.max(MIN_SLOTS, typed);
            for (let i = 0; i < slots; i += 1) {
                const x = BLADE_X + (i + 0.5) * w;
                const tooth = layout.teeth[i];
                const cut = i < typed ? (cuts[i]?.value ?? BLANK) : BLANK;
                const top = SPINE_Y + SPINE_H + cut;
                const part = tooth ? `tooth-${i}` : undefined;
                const lift = part && hovered === part ? 0.05 : 0;
                items.push({
                    mesh: m.slab,
                    model: compose([x, SPINE_Y + SPINE_H + cut / 2 + lift, 0], [w * 0.9, cut, 0.2]),
                    color: tooth ? (tooth.pin === 'stuck' ? INK.btc : ROLE_COLOUR[tooth.role]) : shade(INK.warm, 0.5),
                    ...(part ? { part } : {}),
                });
                if (!tooth) continue;
                const length = Math.max(0.05, pins[i]?.value ?? 0.3);
                const bottom = tooth.pin === 'stuck' ? top + 0.34 : top + 0.03;
                items.push({
                    mesh: m.rod,
                    model: compose([x, bottom + length / 2 + lift, 0], [w * 0.58, length, w * 0.58]),
                    color: tooth.pin === 'stuck' ? INK.btc : tooth.pin === 'seated' ? INK.ink : INK.dim,
                    glow: tooth.pin === 'seated' ? 0.25 : 0,
                    ...(part ? { part } : {}),
                });
            }
            // The shear line the pins must reach, and the plug that turns when they all do.
            items.push({
                mesh: m.slab,
                model: compose([BLADE_X + BLADE_L / 2, SHEAR + 0.03, -0.02], [BLADE_L, 0.04, 0.34]),
                color: layout.valid ? INK.btc : INK.edge,
                glow: layout.valid ? 0.5 : 0,
                part: 'plug',
            });
            const kick = click.t >= 0 ? Math.sin(click.t * Math.PI) * 0.12 : 0;
            const angle = turn.value + kick;
            const plugX = BLADE_X + BLADE_L + 0.32;
            items.push({
                mesh: plugMesh,
                model: compose([plugX, 0.95, 0], [1, 1, 1], 0, 0, Math.PI / 2),
                color: shade(INK.dim, 0.85),
                part: 'plug',
            });
            items.push({
                mesh: m.block,
                model: compose(
                    [plugX + 0.02, 0.95 + Math.cos(angle) * 0.52, Math.sin(angle) * 0.52],
                    [0.26, 0.3, 0.16],
                    angle,
                    0,
                    0,
                ),
                color: layout.valid ? INK.btc : INK.ink,
                part: 'plug',
            });
            const stamp = layout.valid
                ? (data.kind ?? '').toUpperCase()
                : typed > 0
                  ? ADDRESS_SCENE.notYet
                  : ADDRESS_SCENE.blank;
            const tags: Tag[] = [
                { id: 'stamp', text: stamp, at: [-3.62, 0.95, 0.12], tone: layout.valid ? 'btc' : 'dim' },
                {
                    id: 'count',
                    text: ADDRESS_SCENE.count(layout.total, typed),
                    at: [BLADE_X + BLADE_L, SPINE_Y - 0.12, 0.2],
                    tone: 'dim',
                    align: 'end',
                },
            ];
            return {
                items,
                tags,
                shadows: [
                    { x: 0.9, z: 0, rx: BLADE_L * 0.62, rz: 0.6, strength: 0.7 },
                    { x: -3.6, z: 0, rx: 0.9, rz: 0.5, strength: 0.6 },
                ],
                ground: { y: 0, x: 0.6, z: 0, radius: 6.4 },
            };
        },
        parts() {
            const list: PartInfo[] = [
                { id: 'bow', label: ADDRESS_SCENE.parts.bow },
                { id: 'plug', label: ADDRESS_SCENE.parts.plug },
            ];
            const stuck = layout.teeth.findIndex((tooth) => tooth.pin === 'stuck');
            if (stuck >= 0) list.push({ id: `tooth-${stuck}`, label: ADDRESS_SCENE.parts.stuck(stuck + 1) });
            return list;
        },
        describe(part) {
            if (part === 'bow') return ADDRESS_SCENE.bowCallout(layout.valid, data.kind ?? '', layout.total);
            if (part === 'plug') return ADDRESS_SCENE.plugCallout(data.state, data.checksumBad);
            if (part.startsWith('tooth-')) {
                const i = Number(part.slice(6));
                const tooth = layout.teeth[i];
                return tooth ? ADDRESS_SCENE.toothCallout(i + 1, tooth.char, tooth.role, tooth.pin) : '';
            }
            return '';
        },
        summary() {
            const stuck = layout.teeth.filter((tooth) => tooth.pin === 'stuck').length;
            return `teeth=${layout.teeth.length};state=${data.state};stuck=${stuck};turned=${layout.valid}`;
        },
        pulse() {},
    };
}
