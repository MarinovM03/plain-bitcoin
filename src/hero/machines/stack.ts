import {
    AmbientLight,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DirectionalLight,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    SRGBColorSpace,
    Vector3,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { StackInput } from '../bus.ts';
import { disposeTree, ORANGE } from '../glow.ts';
import { type Frame, fitBox, type Machine } from '../machine.ts';

const MOST_COINS = 900;
const MOST_COLUMNS = 14;
const RADIUS = 0.22;
const GAP = 0.56;
/** A coin is at least this thick, so a dear week still shows; the biggest buy is this much thicker. */
const THIN = 0.012;
const THICK = 0.05;
const DROP_SECONDS = 2.6;

/** What a year bought, short enough to stand over a coin: bitcoin to two places, or thousands of sats. */
export function boughtLabel(sats: number): string {
    if (sats >= 1_000_000) return `${(sats / 1e8).toFixed(2)} BTC`;
    return `${Math.max(1, Math.round(sats / 1000))}k sats`;
}

function label(text: string, colour: string = TOKENS.inkDim): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const c = canvas.getContext('2d');
    if (c) {
        c.fillStyle = colour;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `500 40px ${TOKENS.fontMono}`;
        c.fillText(text, 128, 34);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/**
 * Every buy as a coin, stacked in one column per year, with the year under it and what the year bought over it.
 * The same money buys a thicker coin when bitcoin is cheap, so the tall columns are the years when it was. The
 * coins drop in, oldest first, whenever the plan changes.
 */
export function createStack(first: StackInput, page: boolean): Machine<StackInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 32 : 30, 1, 0.1, 80);
    scene.add(new AmbientLight(0xffffff, 1.1));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 5, 4);
    const rim = new DirectionalLight(0xffffff, 0.9);
    rim.position.set(-4, 2, -3);
    scene.add(key, rim);

    const coins = new InstancedMesh(
        new CylinderGeometry(RADIUS, RADIUS, 1, 36),
        new MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.38 }),
        MOST_COINS,
    );
    scene.add(coins);
    const labelGeometry = new PlaneGeometry(0.64, 0.16);
    const labels: Mesh[] = [];
    const tops: Mesh[] = [];
    for (let i = 0; i < MOST_COLUMNS; i += 1) {
        const mesh = new Mesh(labelGeometry, new MeshBasicMaterial({ transparent: true, depthWrite: false }));
        mesh.rotation.x = -Math.PI / 2.6;
        labels.push(mesh);
        const top = new Mesh(labelGeometry, new MeshBasicMaterial({ transparent: true, depthWrite: false }));
        tops.push(top);
        scene.add(mesh, top);
    }

    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3(0, 1, 0);
    const size = new Vector3();
    const place = new Vector3();
    const tint = new Color();
    const gold = new Color('#ffb547');
    let input = first;
    let since = 0;
    let tallest = 1;
    let shownYears = '';
    let shownTops = '';

    function paint(mesh: Mesh | undefined, text: string, colour?: string): void {
        const material = mesh?.material as MeshBasicMaterial | undefined;
        if (!material) return;
        material.map?.dispose();
        material.map = label(text, colour);
        material.needsUpdate = true;
    }

    function set(next: StackInput): void {
        input = next;
        since = 0;
        const columns = next.columns.slice(-MOST_COLUMNS);
        const years = columns.map((column) => column.year).join(',');
        if (years !== shownYears) {
            shownYears = years;
            for (const [i, column] of columns.entries()) paint(labels[i], column.year);
        }
        const bought = columns.map((column) => boughtLabel(column.sats)).join(',');
        if (bought !== shownTops) {
            shownTops = bought;
            for (const [i, column] of columns.entries()) paint(tops[i], boughtLabel(column.sats), TOKENS.ink);
        }
    }
    set(first);

    function frame(frame: Frame): void {
        since = frame.still ? DROP_SECONDS : since + frame.delta;
        const columns = input.columns.slice(-MOST_COLUMNS);
        const total = Math.max(
            1,
            columns.reduce((sum, column) => sum + column.coins.length, 0),
        );
        const width = (columns.length - 1) * GAP;
        let index = 0;
        let order = 0;
        tallest = 0.4;
        columns.forEach((column, c) => {
            const x = c * GAP - width / 2;
            const z = -Math.abs(x) * 0.12;
            let y = 0;
            for (const share of column.coins) {
                if (index >= MOST_COINS) break;
                const thick = THIN + Math.max(0, share) * THICK;
                const landed = Math.min(1, Math.max(0, (since / DROP_SECONDS) * 1.6 - (order / total) * 0.6));
                const fall = (1 - landed) ** 2 * 2.2;
                place.set(x + Math.sin(order * 2.3) * 0.012, y + thick / 2 + fall, z + Math.cos(order * 1.7) * 0.012);
                turn.setFromAxisAngle(axis, order * 0.7);
                size.set(landed > 0 ? 1 : 0, thick, landed > 0 ? 1 : 0);
                matrix.compose(place, turn, size);
                coins.setMatrixAt(index, matrix);
                coins.setColorAt(index, tint.copy(order % 2 ? gold : ORANGE));
                y += thick;
                index += 1;
                order += 1;
            }
            tallest = Math.max(tallest, y);
            const tag = labels[c];
            if (tag) {
                tag.visible = true;
                tag.position.set(x, 0.005, z + 0.42);
            }
            const top = tops[c];
            if (top) {
                const shown = Math.min(1, Math.max(0, since / DROP_SECONDS - 0.4) * 2);
                top.visible = shown > 0;
                top.position.set(x, y + 0.16, z);
                top.quaternion.copy(camera.quaternion);
                (top.material as MeshBasicMaterial).opacity = shown;
            }
        });
        for (let i = columns.length; i < MOST_COLUMNS; i += 1) {
            const tag = labels[i];
            if (tag) tag.visible = false;
            const top = tops[i];
            if (top) top.visible = false;
        }
        for (; index < MOST_COINS; index += 1) {
            matrix.makeScale(0, 0, 0);
            coins.setMatrixAt(index, matrix);
        }
        coins.instanceMatrix.needsUpdate = true;
        if (coins.instanceColor) coins.instanceColor.needsUpdate = true;

        const swing =
            -0.25 + frame.turn * 0.6 + frame.pointer.x * 0.2 + (frame.still ? 0 : Math.sin(frame.seconds * 0.2) * 0.1);
        const distance = fitBox(width / 2 + RADIUS + 0.32, tallest * 0.55 + 0.4, camera.fov, frame.aspect) * 1.15;
        camera.position.set(
            Math.sin(swing) * distance,
            tallest * 0.5 + 0.9 + frame.pointer.y * 0.3,
            Math.cos(swing) * distance,
        );
        camera.lookAt(0, tallest * 0.42, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            for (const tag of [...labels, ...tops]) (tag.material as MeshBasicMaterial).map?.dispose();
            disposeTree(scene);
        },
    };
}
