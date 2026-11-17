import {
    AmbientLight,
    Color,
    CylinderGeometry,
    DirectionalLight,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
} from 'three';
import type { SatsInput } from '../bus.ts';
import { DIM, disposeTree, GlowPoints, ORANGE, WHITE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

/** Rods from single sats up to 10,000,000 BTC: every place value an amount of bitcoin can have. */
const RODS = 16;
const BEADS = 9;
const GAP = 0.42;
const BEAD = 0.15;
const ROD_HEIGHT = 2.6;
const BTC_ROD = 8;

function digits(sats: number): number[] {
    const out: number[] = [];
    let rest = Math.max(0, Math.floor(sats));
    for (let rod = 0; rod < RODS; rod += 1) {
        out.push(rest % 10);
        rest = Math.floor(rest / 10);
    }
    return out;
}

/**
 * An abacus counted in sats: each rod is one place value, from single sats on the right to whole bitcoin and
 * beyond on the left. The beads pushed up spell the amount.
 */
export function createSats(first: SatsInput, page: boolean): Machine<SatsInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 34 : 30, 1, 0.1, 60);
    scene.add(new AmbientLight(0xffffff, 0.5));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 5);
    scene.add(key);
    const rim = new DirectionalLight(ORANGE, 2);
    rim.position.set(-4, 1, -3);
    scene.add(rim);

    const rods = new InstancedMesh(
        new CylinderGeometry(0.012, 0.012, ROD_HEIGHT, 6),
        new MeshStandardMaterial({ color: DIM, metalness: 0.4, roughness: 0.6 }),
        RODS,
    );
    const beads = new InstancedMesh(
        new SphereGeometry(BEAD, 20, 14),
        new MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.28 }),
        RODS * BEADS,
    );
    scene.add(rods, beads);
    const glow = new GlowPoints(RODS * BEADS);
    scene.add(glow.points);

    const matrix = new Matrix4();
    const lit = new Color().copy(ORANGE);
    const unlit = new Color('#3a3e46');
    const coin = new Color().copy(WHITE);
    const heights = new Float32Array(RODS * BEADS).fill(-ROD_HEIGHT / 2 + BEAD);
    let target = digits(first.sats);
    let highest = 8;
    let span = BTC_ROD + 1;

    const rodX = (rod: number) => (span / 2 - rod - 0.5) * GAP;
    const restY = (bead: number, up: boolean) =>
        up ? ROD_HEIGHT / 2 - BEAD - bead * BEAD * 2.05 : -ROD_HEIGHT / 2 + BEAD + (BEADS - 1 - bead) * BEAD * 2.05;

    function set(next: SatsInput): void {
        target = digits(next.sats);
        let top = 0;
        target.forEach((digit, rod) => {
            if (digit > 0) top = rod;
        });
        highest = Math.max(BTC_ROD, top);
    }
    set(first);

    function frame(frame: Frame): void {
        span = frame.still ? highest + 1 : approach(span, highest + 1, 3, frame.delta);
        const width = span * GAP;
        const half = Math.tan((camera.fov * Math.PI) / 360);
        const distance = Math.max((ROD_HEIGHT * 0.68) / half, (width * 0.62) / (half * frame.aspect)) + 0.6;
        const swing = frame.turn + Math.sin(frame.seconds * 0.25) * 0.18 + frame.pointer.x * 0.2;
        camera.position.set(Math.sin(swing) * distance, 0.6 + frame.pointer.y * 0.4, Math.cos(swing) * distance);
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();

        for (let rod = 0; rod < RODS; rod += 1) {
            const shown = rod <= highest;
            matrix.makeScale(shown ? 1 : 0, 1, shown ? 1 : 0).setPosition(rodX(rod), 0, 0);
            rods.setMatrixAt(rod, matrix);
            const up = target[rod] ?? 0;
            for (let bead = 0; bead < BEADS; bead += 1) {
                const index = rod * BEADS + bead;
                const raised = bead < up;
                const goal = restY(bead, raised);
                const lag = frame.delta * (9 - Math.abs(rod - 4) * 0.4);
                const y = frame.still ? goal : approach(heights[index] ?? goal, goal, 1, lag * 1.2);
                heights[index] = y;
                const scale = shown ? (rod === BTC_ROD ? 1.25 : 1) : 0;
                matrix.makeScale(scale, scale, scale).setPosition(rodX(rod), y, 0);
                beads.setMatrixAt(index, matrix);
                beads.setColorAt(index, raised ? (rod >= BTC_ROD ? coin : lit) : unlit);
                if (raised && shown) glow.put(index, rodX(rod), y, 0.02, 0.5, rod >= BTC_ROD ? WHITE : ORANGE, 0.35);
                else glow.hide(index);
            }
        }
        rods.instanceMatrix.needsUpdate = true;
        beads.instanceMatrix.needsUpdate = true;
        if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
        glow.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            glow.dispose();
            disposeTree(scene);
        },
    };
}
