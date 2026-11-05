import { dcaFrame, dcaPlotBox } from '../../gauges/dca.ts';
import { sampleIndices } from '../../model/scale.ts';
import { DCA_SCENE } from '../../ui/scene-copy.ts';
import { identity, mix, smoothstep } from '../gfx/math.ts';
import { type Mesh, MeshBuilder } from '../gfx/mesh.ts';
import { finite, INK, shade, Tween } from './kit.ts';
import type { CameraSpec, Frame, Item, Scene, SceneData, View } from './types.ts';

/** Buys drawn as their own step; more buys than this are sampled evenly, and the description says so. */
export const MAX_STEPS = 160;
/** Half the ridge's depth, in CSS px of the front view. */
const DEPTH = 10;

type DcaData = Extract<SceneData, { id: 'dca' }>;

export interface Ridge {
    /** Sampled mark indices into the payload. */
    indices: number[];
    /** Per step, in the chart's own CSS px with y up from the window's bottom. */
    x: number[];
    value: number[];
    invested: number[];
    lump: number[];
    base: number;
    width: number;
    /** Structure key: a new key rebuilds left to right, the same key morphs in place. */
    key: string;
}

/**
 * The ridge in the front view's own pixels, pure. The front camera is orthographic over exactly the window, so this
 * is the same frame the SVG axes are drawn in: the first frame is the honest chart.
 */
export function ridgeLayout(data: SceneData, view: View): Ridge | null {
    const frame = dcaFrame(data);
    if (!frame || data.id !== 'dca') return null;
    const box = dcaPlotBox({ width: view.width, height: view.height, mini: false });
    const h = view.height;
    const x = (t: number) => box.left + ((finite(t) - frame.t0) / (frame.t1 - frame.t0)) * (box.right - box.left);
    const y = (value: number) => h - (box.base - (Math.max(0, finite(value)) / frame.max) * (box.base - box.top));
    const indices = sampleIndices(frame.length, MAX_STEPS);
    const pick = (values: readonly number[]) => indices.map((i) => y(values[i] ?? 0));
    return {
        indices,
        x: indices.map((i) => x(data.t[i] ?? frame.t0)),
        value: pick(data.value),
        invested: pick(data.invested),
        lump: data.lump.length > 0 ? pick(data.lump) : [],
        base: h - box.base,
        width: Math.max(1, ((box.right - box.left) / Math.max(1, indices.length)) * 0.78),
        key: `${frame.t0}:${frame.t1}:${frame.length}:${Math.round(view.width)}x${Math.round(view.height)}`,
    };
}

export function createDca(): Scene {
    let data: DcaData | null = null;
    let target: Ridge | null = null;
    let from: Ridge | null = null;
    let size: View = { width: 1, height: 1 };
    const morph = new Tween(1, 0.16);
    const build = new Tween(1, 0.3);
    let instantNext = true;
    const steps: Mesh = new MeshBuilder().build();
    const crest: Mesh = new MeshBuilder().build();
    const invested: Mesh = new MeshBuilder().build();
    const lump: Mesh = new MeshBuilder().build();
    const mark: Mesh = new MeshBuilder().build();
    let drawnKey = '';
    let markedKey = '';

    function relayout(view: View): void {
        if (!data) return;
        const next = ridgeLayout(data, view);
        if (!next) {
            target = null;
            from = null;
            return;
        }
        const structural = !target || target.key !== next.key;
        if (structural) {
            from = null;
            if (
                !instantNext &&
                target &&
                target.key.split(':').slice(0, 3).join(':') !== next.key.split(':').slice(0, 3).join(':')
            ) {
                build.value = 0;
                build.to(1, false);
            }
        } else {
            from = current();
            morph.value = 0;
            morph.to(1, instantNext);
        }
        target = next;
        instantNext = false;
    }

    function current(): Ridge | null {
        if (!target) return null;
        if (!from || morph.value >= 1) return target;
        const t = smoothstep(morph.value);
        const lerp = (a: number[], b: number[]) => b.map((value, i) => mix(a[i] ?? value, value, t));
        return {
            ...target,
            value: lerp(from.value, target.value),
            invested: lerp(from.invested, target.invested),
            lump: lerp(from.lump, target.lump),
        };
    }

    function rebuild(ridge: Ridge): void {
        const reveal = build.value;
        const count = ridge.x.length;
        const grown = (k: number) => smoothstep((reveal * (count + 12) - k) / 12);
        const stepsMesh = new MeshBuilder();
        for (let k = 0; k < count; k += 1) {
            const top = ridge.base + ((ridge.value[k] ?? ridge.base) - ridge.base) * grown(k);
            const height = Math.max(0.5, top - ridge.base);
            stepsMesh.box([ridge.x[k] ?? 0, ridge.base + height / 2, -1], [ridge.width, height, DEPTH * 2 - 2]);
        }
        stepsMesh.into(steps);
        const upTo = (values: number[]) => {
            const shown = Math.max(2, Math.ceil(count * Math.min(1, reveal * 1.08)));
            return values.slice(0, shown).map((value, k) => [ridge.x[k] ?? 0, value] as const);
        };
        const crestMesh = new MeshBuilder();
        crestMesh.ribbon(
            upTo(ridge.value.map((value, k) => ridge.base + (value - ridge.base) * grown(k))),
            3,
            -DEPTH,
            DEPTH,
        );
        crestMesh.into(crest);
        const investedMesh = new MeshBuilder();
        investedMesh.ribbon(upTo(ridge.invested), 1.6, DEPTH, DEPTH + 6);
        investedMesh.into(invested);
        const lumpMesh = new MeshBuilder();
        if (ridge.lump.length > 0) lumpMesh.ribbon(upTo(ridge.lump), 2, DEPTH + 8, DEPTH + 14, 6);
        lumpMesh.into(lump);
    }

    return {
        id: 'dca',
        about: DCA_SCENE.description,
        camera(view): CameraSpec {
            return {
                kind: 'ortho',
                target: [view.width / 2, view.height / 2, 0],
                yaw: 0,
                pitch: 0,
                fov: 0,
                fit: { min: [0, 0, -DEPTH], max: [view.width, view.height, DEPTH + 14] },
                fill: 1,
                maxYaw: 0.62,
                maxPitch: 0.38,
            };
        },
        set(next, instant) {
            if (next.id !== 'dca') return;
            data = next;
            instantNext = instant || instantNext;
            relayout(size);
        },
        step(dt) {
            return [morph.step(dt), build.step(dt)].some(Boolean);
        },
        frame(view, hovered): Frame {
            if (
                Math.round(view.width) !== Math.round(size.width) ||
                Math.round(view.height) !== Math.round(size.height)
            ) {
                size = view;
                instantNext = true;
                relayout(view);
            }
            const ridge = current();
            if (!ridge) return { items: [], tags: [], shadows: [], ground: null };
            const key = `${ridge.key}|${morph.value}|${build.value}`;
            if (key !== drawnKey) {
                rebuild(ridge);
                drawnKey = key;
            }
            const model = identity();
            const items: Item[] = [
                { mesh: steps, model, color: shade(INK.edge, 1.25), part: 'steps', inert: true },
                // The lines light from their keyboard buttons; a pointer picks buys, never a line's bounding box.
                { mesh: crest, model, color: INK.btc, part: 'value', glow: 0.8, inert: true },
                { mesh: invested, model, color: INK.ink, part: 'invested', glow: 0.55, inert: true },
                { mesh: lump, model, color: INK.cool, part: 'lump', glow: 0.7, inert: true },
            ];
            // Each buy is picked as its own step, through an exact box over its column.
            for (let k = 0; k < ridge.x.length; k += 1) {
                const top = Math.max(ridge.base + 6, (ridge.value[k] ?? ridge.base) + 4);
                items.push({
                    mesh: stepBox(ridge.x[k] ?? 0, ridge.width, ridge.base, top),
                    model,
                    color: INK.btc,
                    part: `buy-${k}`,
                    hidden: true,
                });
            }
            const lit = hovered?.startsWith('buy-') ? Number(hovered.slice(4)) : -1;
            if (lit >= 0 && lit < ridge.x.length) {
                const top = ridge.value[lit] ?? ridge.base;
                const markKey = `${key}|${lit}`;
                if (markKey !== markedKey) {
                    const builder = new MeshBuilder();
                    builder.box(
                        [ridge.x[lit] ?? 0, ridge.base + (top - ridge.base) / 2, 0],
                        [Math.max(2, ridge.width), Math.max(1, top - ridge.base), DEPTH * 2 + 1],
                    );
                    builder.into(mark);
                    markedKey = markKey;
                }
                items.push({ mesh: mark, model, color: INK.warm, part: hovered ?? '', inert: true });
            }
            return { items, tags: [], shadows: [], ground: null };
        },
        parts() {
            return [
                { id: 'value', label: DCA_SCENE.parts.value },
                { id: 'invested', label: DCA_SCENE.parts.invested },
                { id: 'lump', label: DCA_SCENE.parts.lump },
                ...(target ? [{ id: `buy-${target.x.length - 1}`, label: DCA_SCENE.parts.today }] : []),
            ];
        },
        describe(part) {
            if (!data || !target) return '';
            if (part.startsWith('buy-')) {
                const index = target.indices[Number(part.slice(4))];
                if (index === undefined) return '';
                return DCA_SCENE.buyCallout(data, index, index === (target.indices.at(-1) ?? -1));
            }
            return DCA_SCENE.seriesCallout(part, data, target.indices.length);
        },
        summary() {
            if (!data || !target) return 'marks=0';
            return `marks=${data.t.length};steps=${target.indices.length};end=${finite(data.value.at(-1)).toFixed(2)};worth=${data.worth}`;
        },
        pulse() {},
    };
}

const boxes = new Map<string, Mesh>();

/** A pick box over one step's column, cached by its geometry (the boxes only change when the ridge does). */
function stepBox(x: number, width: number, base: number, top: number): Mesh {
    const key = `${x.toFixed(1)}:${width.toFixed(1)}:${base.toFixed(1)}:${top.toFixed(1)}`;
    let mesh = boxes.get(key);
    if (!mesh) {
        if (boxes.size > 2000) boxes.clear();
        const builder = new MeshBuilder();
        builder.box([x, (base + top) / 2, 0], [Math.max(2, width / 0.78), Math.max(2, top - base), DEPTH * 2]);
        mesh = builder.build();
        boxes.set(key, mesh);
    }
    return mesh;
}
