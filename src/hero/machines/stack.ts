import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { StackInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, WHITE } from '../glow.ts';
import { type Frame, fitDistance, type Machine } from '../machine.ts';

const SAMPLES = 240;
const WIDTH = 4.4;
const TALL = 1.9;
const DRAW_SECONDS = 2.4;

/** Reads a series at a share of its length, 0 to 1, between its points. */
function at(series: readonly number[], t: number): number {
    if (series.length === 0) return 0;
    const x = t * (series.length - 1);
    const i = Math.floor(x);
    const a = series[i] ?? 0;
    const b = series[Math.min(series.length - 1, i + 1)] ?? a;
    return a + (b - a) * (x - i);
}

/**
 * The stack as its own chart, standing in space: the glowing orange line and the area under it are what the
 * buys are worth, the white line is the money put in. It draws itself left to right whenever the numbers change.
 */
export function createStack(first: StackInput, page: boolean): Machine<StackInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 34 : 30, 1, 0.1, 60);

    const area = new BufferGeometry();
    const position = new Float32Array(SAMPLES * 2 * 3);
    const color = new Float32Array(SAMPLES * 2 * 3);
    const index: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i += 1) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    area.setAttribute('position', new BufferAttribute(position, 3));
    area.setAttribute('color', new BufferAttribute(color, 3));
    area.setIndex(index);
    scene.add(
        new Mesh(
            area,
            new MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                side: DoubleSide,
                depthWrite: false,
            }),
        ),
    );
    const lines = new GlowPoints(SAMPLES * 2 + 1);
    scene.add(lines.points);

    let input = first;
    let drawn = 0;
    const deep = new Color(TOKENS.void);
    const glow = new Color();

    function set(next: StackInput): void {
        input = next;
        drawn = 0;
    }

    function frame(frame: Frame): void {
        drawn = frame.still ? 1 : Math.min(1, drawn + frame.delta / DRAW_SECONDS);
        const has = input.value.length > 1;
        for (let i = 0; i < SAMPLES; i += 1) {
            const t = i / (SAMPLES - 1);
            const x = -WIDTH / 2 + t * WIDTH;
            const shown = has && t <= drawn;
            const value = shown ? at(input.value, t) * TALL : 0;
            position.set([x, value, 0], i * 6);
            position.set([x, 0, 0], i * 6 + 3);
            glow.copy(ORANGE).multiplyScalar(0.8);
            color.set([glow.r, glow.g, glow.b], i * 6);
            color.set([deep.r, deep.g, deep.b], i * 6 + 3);
            if (shown) {
                lines.put(i, x, value, 0.01, 0.075, ORANGE, 1);
                lines.put(SAMPLES + i, x, at(input.invested, t) * TALL, 0.02, 0.035, WHITE, 0.7);
            } else {
                lines.hide(i);
                lines.hide(SAMPLES + i);
            }
        }
        (area.getAttribute('position') as BufferAttribute).needsUpdate = true;
        (area.getAttribute('color') as BufferAttribute).needsUpdate = true;
        const head = SAMPLES * 2;
        if (has) {
            const pulse = frame.still ? 1 : 0.85 + Math.sin(frame.seconds * 3) * 0.15;
            lines.put(head, -WIDTH / 2 + drawn * WIDTH, at(input.value, drawn) * TALL, 0.03, 0.22 * pulse, ORANGE, 1);
        } else {
            lines.hide(head);
        }

        const swing =
            -0.32 + frame.turn * 0.6 + frame.pointer.x * 0.2 + (frame.still ? 0 : Math.sin(frame.seconds * 0.2) * 0.1);
        const distance = fitDistance(WIDTH * 0.5, camera.fov, frame.aspect) * 0.78;
        camera.position.set(
            Math.sin(swing) * distance,
            TALL * 0.55 + 0.6 + frame.pointer.y * 0.3,
            Math.cos(swing) * distance,
        );
        camera.lookAt(0, TALL * 0.42, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        lines.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            lines.dispose();
            disposeTree(scene);
        },
    };
}
