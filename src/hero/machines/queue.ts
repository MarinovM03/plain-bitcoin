import {
    AdditiveBlending,
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    EdgesGeometry,
    InstancedMesh,
    LineBasicMaterial,
    LineSegments,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    Vector3,
} from 'three';
import type { QueueInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, seeds, WHITE } from '../glow.ts';
import { approach, type Frame, fitPoints, type Machine } from '../machine.ts';

const WAITING = 7;
const MINED = 4;
const SIZE = 0.82;
const PITCH = 1.08;
/** One dot for this many waiting transactions. */
export const TXS_PER_DOT = 25;
const DOTS = 150;
const SLIDE_SECONDS = 1.4;

/** Waiting blocks stand left of the line, nearest first; mined blocks stand right of it, newest first. */
const waitingX = (index: number) => -(index + 0.5) * PITCH - 0.15;
const minedX = (index: number) => (index + 0.5) * PITCH + 0.15;

/**
 * The waiting line laid out as mempool.space draws it. Left of the glowing line: the blocks the waiting
 * transactions would fill right now, as full as they are, the orange top hotter the higher their lowest fee.
 * Right of it: the real blocks just mined. The followed transaction is the bead in the block its fee reaches;
 * when a new block is found the whole line slides across.
 */
export function createQueue(first: QueueInput, page: boolean): Machine<QueueInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 34 : 30, 1, 0.1, 80);
    scene.add(new AmbientLight(0xffffff, 0.5));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 5, 4);
    scene.add(key);

    const cube = new BoxGeometry(1, 1, 1);
    cube.translate(0, 0.5, 0);
    const glass = new InstancedMesh(
        cube,
        new MeshBasicMaterial({
            color: '#8fa3b8',
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
            blending: AdditiveBlending,
        }),
        WAITING,
    );
    const fill = new InstancedMesh(
        cube,
        new MeshStandardMaterial({
            color: '#4a5260',
            transparent: true,
            opacity: 0.55,
            roughness: 0.4,
            depthWrite: false,
        }),
        WAITING,
    );
    const caps = new InstancedMesh(cube, new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), WAITING);
    const mined = new InstancedMesh(
        cube,
        new MeshStandardMaterial({ color: '#6b7380', metalness: 0.35, roughness: 0.4 }),
        MINED,
    );
    const outline = new LineSegments(
        new EdgesGeometry(new BoxGeometry(SIZE, SIZE, SIZE)),
        new LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.3 }),
    );
    scene.add(glass, fill, caps, mined);
    const outlines: LineSegments[] = [];
    for (let i = 0; i < WAITING + MINED; i += 1) {
        const line = outline.clone();
        outlines.push(line);
        scene.add(line);
    }
    const divider = new Mesh(
        new BoxGeometry(0.03, SIZE * 1.5, 0.03),
        new MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.6), toneMapped: false }),
    );
    divider.position.y = SIZE * 0.75;
    scene.add(divider);

    const dots = new GlowPoints(WAITING * DOTS + 1);
    scene.add(dots.points);
    const scatter = seeds(WAITING * DOTS * 3, 29);
    const matrix = new Matrix4();
    const tint = new Color();
    const fills = new Float32Array(WAITING);
    const bead = { y: 0, x: 0, grow: 0, ready: false };
    const corners = Array.from({ length: 8 }, () => new Vector3());
    const near = Array.from({ length: 8 }, () => new Vector3());
    const aim = new Vector3();
    const centre = new Vector3();
    const direction = new Vector3();
    let zoom = 0;
    let input = first;
    let slide = 0;
    let height = first.height;

    function heat(floor: number): number {
        const top = Math.max(2, ...input.floors);
        return Math.min(1, Math.log(1 + floor) / Math.log(1 + top));
    }

    function set(next: QueueInput): void {
        if (next.height > height && height > 0) slide = 1;
        height = next.height;
        input = next;
    }

    function frame(frame: Frame): void {
        slide = frame.still ? 0 : Math.max(0, slide - frame.delta / SLIDE_SECONDS);
        const shift = (1 - (1 - slide) ** 3) * PITCH * (slide > 0 ? 1 : 0);
        const count = Math.min(WAITING, input.floors.length);
        let dot = 0;
        for (let i = 0; i < WAITING; i += 1) {
            const on = i < count;
            const x = waitingX(i) + shift;
            const goal = on ? Math.max(0.05, Math.min(1, input.fills[i] ?? 0)) : 0;
            fills[i] = frame.still ? goal : approach(fills[i] ?? 0, goal, 3, frame.delta);
            const h = (fills[i] ?? 0) * SIZE;
            matrix.makeScale(on ? SIZE : 0, SIZE, on ? SIZE : 0).setPosition(x, 0, 0);
            glass.setMatrixAt(i, matrix);
            matrix.makeScale(on ? SIZE * 0.96 : 0, Math.max(0.001, h), on ? SIZE * 0.96 : 0).setPosition(x, 0, 0);
            fill.setMatrixAt(i, matrix);
            matrix.makeScale(on ? SIZE * 0.96 : 0, 0.02, on ? SIZE * 0.96 : 0).setPosition(x, h, 0);
            caps.setMatrixAt(i, matrix);
            caps.setColorAt(i, tint.copy(ORANGE).multiplyScalar(0.45 + heat(input.floors[i] ?? 0) * 1.4));
            const line = outlines[i];
            if (line) {
                line.visible = on;
                line.position.set(x, SIZE / 2, 0);
            }
            const shown = on ? Math.min(DOTS, Math.ceil((input.counts[i] ?? 0) / TXS_PER_DOT)) : 0;
            for (let d = 0; d < DOTS; d += 1, dot += 1) {
                if (d >= shown) {
                    dots.hide(dot);
                    continue;
                }
                const a = scatter[dot * 3] ?? 0;
                const b = scatter[dot * 3 + 1] ?? 0;
                const c = scatter[dot * 3 + 2] ?? 0;
                const drift = frame.still ? 0 : Math.sin(frame.seconds * (0.5 + c) + a * 9) * 0.015;
                dots.put(
                    dot,
                    x + (a - 0.5) * SIZE * 0.85,
                    b * h * 0.95 + drift,
                    (c - 0.5) * SIZE * 0.85,
                    0.028,
                    WHITE,
                    0.55,
                );
            }
        }
        for (let i = 0; i < MINED; i += 1) {
            const on = i < input.mined.length;
            const x = minedX(i) + shift;
            const h = SIZE * Math.max(0.2, Math.min(1, input.mined[i] ?? 0));
            matrix.makeScale(on ? SIZE : 0, h, on ? SIZE : 0).setPosition(x, 0, 0);
            mined.setMatrixAt(i, matrix);
            const line = outlines[WAITING + i];
            if (line) {
                line.visible = on;
                line.position.set(x, SIZE / 2, 0);
            }
        }
        for (const mesh of [glass, fill, caps, mined]) mesh.instanceMatrix.needsUpdate = true;
        if (caps.instanceColor) caps.instanceColor.needsUpdate = true;

        const target = (() => {
            if (input.rate === null) return null;
            if (input.confirmed) return { x: minedX(Math.max(0, input.confirmedDepth ?? 0)) + shift, y: SIZE + 0.18 };
            const index = input.slab === null ? count : input.slab - 1;
            const floor = input.floors[index] ?? 0;
            const top = Math.max(floor + 1, input.floors[index - 1] ?? floor * 2 + 1);
            const within = Math.min(1, Math.max(0, (input.rate - floor) / (top - floor)));
            const h = (fills[Math.min(index, WAITING - 1)] ?? 0.3) * SIZE;
            return { x: waitingX(Math.min(index, WAITING)) + shift, y: h * (0.2 + within * 0.75) };
        })();
        const beadIndex = WAITING * DOTS;
        if (target) {
            if (!bead.ready || frame.still) {
                bead.x = target.x;
                bead.y = target.y;
                bead.grow = frame.still ? 1 : 0;
                bead.ready = true;
            }
            bead.grow = Math.min(1, bead.grow + frame.delta * 2.5);
            bead.x = approach(bead.x, target.x, 3, frame.delta);
            bead.y = approach(bead.y, target.y, 3, frame.delta);
            const pulse = frame.still ? 1 : 0.85 + Math.sin(frame.seconds * 4) * 0.15;
            const sizeNow = 0.42 * pulse * (1 - (1 - bead.grow) ** 3);
            dots.put(beadIndex, bead.x, bead.y, SIZE / 2 + 0.06, sizeNow, input.confirmed ? WHITE : ORANGE, 1);
        } else {
            bead.ready = false;
            dots.hide(beadIndex);
        }

        const left = waitingX(Math.max(count, 3) - 1) - SIZE / 2;
        const right = minedX(Math.max(input.mined.length, 1) - 1) + SIZE / 2;
        const half = SIZE / 2 + 0.05;
        corners.forEach((corner, i) => {
            corner.set(i & 1 ? right : left, i & 2 ? SIZE * 1.5 : 0, i & 4 ? half : -half);
        });
        centre.set((left + right) / 2, SIZE * 0.55, 0);
        const wanted = Math.min(1, Math.max(0, input.zoom ?? 0));
        zoom = frame.still ? wanted : approach(zoom, wanted, 6, frame.delta);
        // The line is seen from a corner on the page, so the nearest blocks come forward and fill the box.
        const swing =
            (page ? -0.75 : -0.2) +
            frame.turn * 0.7 +
            frame.pointer.x * 0.2 +
            (frame.still ? 0 : Math.sin(frame.seconds * 0.15) * 0.06);
        const rise = (page ? 0.55 : 0.36) + frame.pointer.y * 0.12;
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        direction.set(Math.sin(swing) * Math.cos(rise), Math.sin(rise), Math.cos(swing) * Math.cos(rise));
        const fit = fitPoints(camera, corners, centre, direction, page ? 0.94 : 0.9);
        const focusX = input.rate === null ? waitingX(0) + shift : bead.x;
        const focusY = input.rate === null ? SIZE * 0.5 : bead.y;
        aim.set(centre.x + (focusX - centre.x) * zoom, centre.y + (focusY - centre.y) * zoom, 0);
        let distance = fit;
        if (zoom > 0.001) {
            // Close up is the focused block and a little of its neighbours, never so close that the block is cut.
            near.forEach((corner, i) => {
                corner.set(focusX + (i & 1 ? 1 : -1) * PITCH, i & 2 ? SIZE * 1.1 : 0, i & 4 ? half : -half);
            });
            const close = fitPoints(camera, near, aim, direction, 0.9);
            distance = fit * (Math.min(fit, close) / fit) ** zoom;
        }
        camera.position.copy(aim).addScaledVector(direction, distance);
        camera.lookAt(aim);
        dots.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            dots.dispose();
            disposeTree(scene);
        },
    };
}
