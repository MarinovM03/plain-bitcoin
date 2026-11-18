import {
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    CircleGeometry,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
    Vector3,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { SatsInput } from '../bus.ts';
import { disposeTree, ORANGE, WHITE } from '../glow.ts';
import { approach, type Frame, fitDistance, type Machine } from '../machine.ts';

const SATS_PER_BTC = 100_000_000;
/** One notch on the rim for every tenfold step from 1 sat to 1 BTC. */
const DECADES = 8;
const THICK = 0.13;
const MOST_COINS = 21;

/** How far an amount is from 1 sat to one whole bitcoin, in tenfold steps: 0 for 1 sat, 1 for 1 BTC or more. */
function share(sats: number): number {
    if (!(sats >= 1)) return 0;
    return Math.min(1, Math.log10(sats) / DECADES);
}

function faceTexture(): CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
        context.strokeStyle = TOKENS.ink;
        context.globalAlpha = 0.55;
        context.lineWidth = 6;
        context.beginPath();
        context.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 0.95;
        context.fillStyle = TOKENS.ink;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `700 ${Math.round(size * 0.52)}px ${TOKENS.fontDisplay}`;
        context.fillText('₿', size / 2, size * 0.53);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/**
 * One bitcoin as a coin. The lit wedge on its face is how far the amount has come from 1 sat towards the whole
 * coin, a notch for every tenfold step; from 1 BTC up, more whole coins stack behind it, one per bitcoin.
 */
export function createSats(first: SatsInput, page: boolean): Machine<SatsInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 32 : 30, 1, 0.1, 60);
    scene.add(new AmbientLight(0xffffff, 0.55));
    const key = new DirectionalLight(0xffffff, 2.6);
    key.position.set(2, 3, 5);
    const rim = new DirectionalLight(ORANGE, 2.4);
    rim.position.set(-4, 1, -2);
    scene.add(key, rim);

    const coin = new Group();
    scene.add(coin);
    const metal = new MeshStandardMaterial({ color: '#2a2e35', metalness: 0.75, roughness: 0.32 });
    const body = new Mesh(new CylinderGeometry(1, 1, THICK, 96), metal);
    body.rotation.x = Math.PI / 2;
    coin.add(body);

    const wedgeMaterial = new MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.25), toneMapped: false });
    const wedge = new Mesh(new CircleGeometry(0.96, 96, Math.PI / 2, 0.0001), wedgeMaterial);
    wedge.position.z = THICK / 2 + 0.002;
    coin.add(wedge);

    const face = new Mesh(
        new CircleGeometry(0.96, 96),
        new MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false, side: DoubleSide }),
    );
    face.position.z = THICK / 2 + 0.004;
    coin.add(face);

    const notches = new InstancedMesh(
        new BoxGeometry(0.035, 0.1, THICK * 1.1),
        new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        DECADES + 1,
    );
    coin.add(notches);

    const stack = new InstancedMesh(
        new CylinderGeometry(1, 1, THICK, 64),
        new MeshStandardMaterial({ color: ORANGE, metalness: 0.6, roughness: 0.35 }),
        MOST_COINS - 1,
    );
    scene.add(stack);

    const matrix = new Matrix4();
    const tint = new Color();
    let target = share(first.sats);
    let coins = Math.floor(first.sats / SATS_PER_BTC);
    let shown = 0;
    let drawn = -1;

    function set(next: SatsInput): void {
        target = share(next.sats);
        coins = Math.floor(Math.max(0, next.sats) / SATS_PER_BTC);
    }

    function drawWedge(value: number): void {
        if (Math.abs(value - drawn) < 0.0015) return;
        drawn = value;
        wedge.geometry.dispose();
        // The wedge grows clockwise from twelve o'clock, as a clock hand would.
        wedge.geometry = new CircleGeometry(
            0.96,
            96,
            Math.PI / 2 - value * Math.PI * 2,
            Math.max(0.0001, value * Math.PI * 2),
        );
    }

    function frame(frame: Frame): void {
        shown = frame.still ? target : approach(shown, target, 4, frame.delta);
        if (Math.abs(shown - target) < 0.004) shown = target;
        drawWedge(shown);

        for (let i = 0; i <= DECADES; i += 1) {
            const angle = Math.PI / 2 - (i / DECADES) * Math.PI * 2;
            matrix.makeRotationZ(angle - Math.PI / 2).setPosition(Math.cos(angle) * 1.02, Math.sin(angle) * 1.02, 0);
            notches.setMatrixAt(i, matrix);
            const reached = i / DECADES <= shown + 0.001;
            notches.setColorAt(i, tint.copy(reached ? ORANGE : WHITE).multiplyScalar(reached ? 1.4 : 0.35));
        }
        notches.instanceMatrix.needsUpdate = true;
        if (notches.instanceColor) notches.instanceColor.needsUpdate = true;

        const extra = Math.min(MOST_COINS - 1, Math.max(0, coins - 1));
        const sway = frame.still ? 0 : Math.sin(frame.seconds * 0.4) * 0.28;
        coin.rotation.y = sway + frame.turn * 0.6 + frame.pointer.x * 0.25;
        coin.rotation.x = -frame.pointer.y * 0.15;
        for (let i = 0; i < MOST_COINS - 1; i += 1) {
            const scale = i < extra ? 1 : 0;
            matrix.makeRotationX(Math.PI / 2).scale(new Vector3(scale, scale, scale));
            matrix.setPosition(0.12 * (i + 1), -0.04 * (i + 1), -(THICK + 0.03) * (i + 1));
            stack.setMatrixAt(i, matrix);
        }
        stack.instanceMatrix.needsUpdate = true;
        stack.rotation.copy(coin.rotation);

        const depth = extra * (THICK + 0.03);
        const distance = fitDistance(1.25 + extra * 0.04, camera.fov, frame.aspect) + depth * 0.5;
        camera.position.set(0.35, 0.25, distance);
        camera.lookAt(extra * 0.05, -extra * 0.015, -depth * 0.3);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            disposeTree(scene);
        },
    };
}
