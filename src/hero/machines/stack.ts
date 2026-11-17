import {
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
} from 'three';
import type { StackInput } from '../bus.ts';
import { disposeTree, ORANGE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

const MOST = 520;
const RISE_SECONDS = 2.4;

/**
 * Every buy is one bar, oldest at the back: the same money each time, so a tall bar is a week when bitcoin was
 * cheap and the money bought more sats.
 */
export function createStack(first: StackInput, page: boolean): Machine<StackInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 34 : 30, 1, 0.1, 60);
    scene.add(new AmbientLight(0xffffff, 0.45));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new DirectionalLight(ORANGE, 1.6);
    rim.position.set(-4, 2, -4);
    scene.add(rim);

    const bars = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.4 }),
        MOST,
    );
    scene.add(bars);
    const matrix = new Matrix4();
    const color = new Color();
    const low = new Color('#3a3e46');
    let buys = first.buys.slice(-MOST);
    let grown = 0;

    function frame(frame: Frame): void {
        grown = frame.still ? 1 : approach(grown, 1, (1 / RISE_SECONDS) * 2.2, frame.delta);
        const count = buys.length;
        const width = 4.2 / Math.max(1, count);
        for (let i = 0; i < MOST; i += 1) {
            const value = i < count ? (buys[i] ?? 0) : 0;
            const reveal = Math.min(1, Math.max(0, grown * 1.4 - (i / Math.max(1, count)) * 0.4));
            const h = Math.max(0.0001, value * 1.6 * reveal);
            const x = -2.1 + (i + 0.5) * width;
            matrix
                .makeScale(i < count ? width * 0.78 : 0, h, i < count ? width * 0.78 : 0)
                .setPosition(x, h / 2 - 0.7, 0);
            bars.setMatrixAt(i, matrix);
            bars.setColorAt(i, color.copy(low).lerp(ORANGE, Math.min(1, value * 1.1)));
        }
        bars.instanceMatrix.needsUpdate = true;
        if (bars.instanceColor) bars.instanceColor.needsUpdate = true;

        const swing =
            -0.5 + frame.turn + frame.pointer.x * 0.25 + (frame.still ? 0 : Math.sin(frame.seconds * 0.2) * 0.15);
        const distance = frame.aspect < 1 ? 6.4 : 5;
        camera.position.set(Math.sin(swing) * distance, 1.4 + frame.pointer.y * 0.4, Math.cos(swing) * distance);
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
    }

    return {
        scene,
        camera,
        set(next) {
            buys = next.buys.slice(-MOST);
            grown = 0;
        },
        frame,
        dispose() {
            disposeTree(scene);
        },
    };
}
