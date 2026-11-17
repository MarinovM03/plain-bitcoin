import {
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
} from 'three';
import type { QueueInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, seeds, WHITE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

const SLABS = 8;
const GAP = 0.9;
const WIDTH = 1.6;
const DEPTH = 0.5;
const TALL = 1.2;
/** One dot for this many waiting transactions. */
export const TXS_PER_DOT = 25;
const DOTS_PER_SLAB = 160;

/**
 * The waiting line: each slab is one block the mempool would fill right now, nearest first, as tall as it is full
 * and as hot as its lowest fee. Dots are waiting transactions. The bead is the followed transaction, at the slab
 * its fee rate reaches; once confirmed it moves to the front and turns white.
 */
export function createQueue(first: QueueInput, page: boolean): Machine<QueueInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 36 : 32, 1, 0.1, 60);
    scene.add(new AmbientLight(0xffffff, 0.4));
    const key = new DirectionalLight(0xffffff, 2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const slabs = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({
            color: '#9aa7b6',
            metalness: 0.1,
            roughness: 0.35,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
        }),
        SLABS,
    );
    const caps = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        SLABS,
    );
    scene.add(slabs, caps);
    const dots = new GlowPoints(SLABS * DOTS_PER_SLAB + 1);
    scene.add(dots.points);
    const scatter = seeds(SLABS * DOTS_PER_SLAB * 3, 29);
    const matrix = new Matrix4();
    const tint = new Color();
    const heights = new Float32Array(SLABS);
    const bead = { x: 0, y: 0, z: 0, ready: false };
    let input = first;

    const zOf = (index: number) => -index * GAP;

    function heat(floor: number): number {
        const top = Math.max(2, ...input.floors);
        return Math.min(1, Math.log(1 + floor) / Math.log(1 + top));
    }

    function frame(frame: Frame): void {
        const count = Math.min(SLABS, input.floors.length);
        let dot = 0;
        for (let i = 0; i < SLABS; i += 1) {
            const goal = i < count ? Math.max(0.04, Math.min(1, input.fills[i] ?? 0)) * TALL : 0.0001;
            heights[i] = frame.still ? goal : approach(heights[i] ?? 0, goal, 3, frame.delta);
            const h = heights[i] ?? 0;
            matrix.makeScale(i < count ? WIDTH : 0, h, DEPTH).setPosition(0, h / 2, zOf(i));
            slabs.setMatrixAt(i, matrix);
            matrix.makeScale(i < count ? WIDTH : 0, 0.022, DEPTH).setPosition(0, h, zOf(i));
            caps.setMatrixAt(i, matrix);
            caps.setColorAt(i, tint.copy(ORANGE).multiplyScalar(0.55 + heat(input.floors[i] ?? 0) * 1.6));
            const shown = i < count ? Math.min(DOTS_PER_SLAB, Math.ceil((input.counts[i] ?? 0) / TXS_PER_DOT)) : 0;
            for (let d = 0; d < DOTS_PER_SLAB; d += 1, dot += 1) {
                if (d >= shown) {
                    dots.hide(dot);
                    continue;
                }
                const a = scatter[dot * 3] ?? 0;
                const b = scatter[dot * 3 + 1] ?? 0;
                const c = scatter[dot * 3 + 2] ?? 0;
                const drift = frame.still ? 0 : Math.sin(frame.seconds * (0.6 + c) + a * 9) * 0.02;
                dots.put(
                    dot,
                    (a - 0.5) * WIDTH * 0.92,
                    b * h + drift,
                    zOf(i) + (c - 0.5) * DEPTH * 0.8,
                    0.035,
                    WHITE,
                    0.5,
                );
            }
        }
        slabs.instanceMatrix.needsUpdate = true;
        caps.instanceMatrix.needsUpdate = true;
        if (caps.instanceColor) caps.instanceColor.needsUpdate = true;

        const target = (() => {
            if (input.rate === null) return null;
            if (input.confirmed) return { x: 0, y: 0.25, z: GAP * 1.4 };
            const index = input.slab === null ? Math.max(count, 1) : input.slab - 1;
            const floor = input.floors[index] ?? 0;
            const top = Math.max(floor + 1, input.floors[index - 1] ?? floor * 2 + 1);
            const within = Math.min(1, Math.max(0, (input.rate - floor) / (top - floor)));
            return { x: 0, y: (heights[index] ?? 0.3) * (0.15 + within * 0.75) + 0.08, z: zOf(index) };
        })();
        if (target) {
            if (!bead.ready || frame.still) {
                bead.x = target.x;
                bead.y = target.y + (frame.still ? 0 : 1.5);
                bead.z = target.z;
                bead.ready = true;
            }
            bead.x = approach(bead.x, target.x, 3, frame.delta);
            bead.y = frame.still ? target.y : approach(bead.y, target.y, 3, frame.delta);
            bead.z = frame.still ? target.z : approach(bead.z, target.z, 2, frame.delta);
            const pulse = frame.still ? 1 : 0.8 + Math.sin(frame.seconds * 4) * 0.2;
            dots.put(SLABS * DOTS_PER_SLAB, bead.x, bead.y, bead.z, 0.5 * pulse, input.confirmed ? WHITE : ORANGE, 1);
        } else {
            bead.ready = false;
            dots.hide(SLABS * DOTS_PER_SLAB);
        }

        const swing =
            -0.62 + frame.turn + frame.pointer.x * 0.25 + (frame.still ? 0 : Math.sin(frame.seconds * 0.15) * 0.12);
        const distance = frame.aspect < 1 ? 9.5 : 7;
        const middle = -((Math.max(count, 1) - 1) * GAP) / 2;
        camera.position.set(
            Math.sin(swing) * distance,
            2.6 + frame.pointer.y * 0.5,
            middle + Math.cos(swing) * distance,
        );
        camera.lookAt(0, 0.35, middle);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        dots.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set(next) {
            input = next;
        },
        frame,
        dispose() {
            dots.dispose();
            disposeTree(scene);
        },
    };
}
