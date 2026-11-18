import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, TorusGeometry } from 'three';
import { HALVING_INTERVAL } from '../../model/supply.ts';
import type { HalvingInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, WHITE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

/** The first eras drawn; by the ninth the reward is under a fifth of a bitcoin and the ring a hair. */
const ERAS = 9;
const INNER = 0.42;
const SPACING = 0.19;
const TICK_SECONDS = 1.6;

const radiusOf = (era: number) => INNER + era * SPACING;
const tubeOf = (era: number) => Math.max(0.006, 0.07 / 2 ** era);

function material(strength: number, color = ORANGE): MeshBasicMaterial {
    return new MeshBasicMaterial({
        color: color.clone().multiplyScalar(strength),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

/**
 * The halving clock: one ring per era of 210,000 blocks, each half as thick as the one inside it because the
 * reward halves. Finished eras are lit, the current ring is lit up to the shown block, and a bead marks it.
 */
export function createHalving(first: HalvingInput, page: boolean): Machine<HalvingInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 40);
    const dial = new Group();
    dial.rotation.z = -Math.PI / 2;
    dial.scale.set(1, -1, 1);
    scene.add(dial);

    for (let era = 0; era < ERAS; era += 1) {
        dial.add(new Mesh(new TorusGeometry(radiusOf(era), tubeOf(era) * 0.5, 6, 128), material(0.16, WHITE)));
    }
    const lit: Mesh[] = [];
    for (let era = 0; era < ERAS; era += 1) {
        const mesh = new Mesh(new TorusGeometry(radiusOf(era), tubeOf(era), 8, 144), material(1.1));
        mesh.visible = false;
        lit.push(mesh);
        dial.add(mesh);
    }
    const current = new Mesh(new TorusGeometry(1, 0.1, 4, 8), material(2));
    dial.add(current);
    const glow = new GlowPoints(2);
    dial.add(glow.points);

    let height = first.height;
    let shown = first.height;
    let drawn = -1;
    let sinceTick = TICK_SECONDS;

    function set(next: HalvingInput): void {
        if (next.height === height + 1) sinceTick = 0;
        height = next.height;
    }

    function arc(at: number): void {
        const era = Math.min(ERAS - 1, Math.floor(at / HALVING_INTERVAL));
        const progress = (at % HALVING_INTERVAL) / HALVING_INTERVAL;
        for (const [index, mesh] of lit.entries()) mesh.visible = index < era;
        const key = era * 10_000 + Math.round(progress * 600);
        if (key === drawn) return;
        drawn = key;
        current.geometry.dispose();
        current.geometry = new TorusGeometry(
            radiusOf(era),
            tubeOf(era),
            8,
            144,
            Math.max(0.001, progress) * Math.PI * 2,
        );
    }

    function frame(frame: Frame): void {
        shown = frame.still ? height : approach(shown, height, 3.2, frame.delta);
        if (Math.abs(shown - height) < 1) shown = height;
        sinceTick += frame.delta;
        arc(shown);

        const era = Math.min(ERAS - 1, Math.floor(shown / HALVING_INTERVAL));
        const angle = ((shown % HALVING_INTERVAL) / HALVING_INTERVAL) * Math.PI * 2;
        const r = radiusOf(era);
        const pulse = frame.still ? 0 : Math.max(0, 1 - sinceTick / TICK_SECONDS);
        glow.put(0, Math.cos(angle) * r, Math.sin(angle) * r, 0, 0.32 + pulse * 0.5, WHITE, 0.9);
        glow.put(1, 0, 0, 0, 0.5, ORANGE, 0.35 + pulse * 0.4);

        const tilt = 0.55 + frame.pointer.y * 0.2;
        const swing = frame.turn + frame.pointer.x * 0.3 + (frame.still ? 0 : Math.sin(frame.seconds * 0.18) * 0.35);
        // The outer ring, seen tilted, is about as tall as it is wide times the sine of the tilt.
        const outer = radiusOf(ERAS - 1) + 0.12;
        const half = Math.tan((camera.fov * Math.PI) / 360);
        const distance =
            Math.max((outer * Math.sin(tilt) + 0.35) / half, outer / (half * frame.aspect)) * (page ? 1.06 : 1);
        camera.position.set(
            Math.sin(swing) * distance * Math.cos(tilt),
            -Math.sin(tilt) * distance,
            Math.cos(swing) * distance * Math.cos(tilt),
        );
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
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
