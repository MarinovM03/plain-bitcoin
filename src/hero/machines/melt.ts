import {
    AdditiveBlending,
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    DirectionalLight,
    EdgesGeometry,
    Group,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { MeltInput } from '../bus.ts';
import { disposeTree, GlowPoints, seeds, WHITE } from '../glow.ts';
import { approach, type Frame, fitDistance, type Machine } from '../machine.ts';

/** A bundle of notes, as long and wide as a banknote; a full bundle stands this tall. */
const LENGTH = 2;
const WIDTH = 0.9;
const TALL = 1.25;
const DUST = 90;

function canvasTexture(width: number, height: number, draw: (c: CanvasRenderingContext2D) => void): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context) draw(context);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

/** The top note of the bundle: frame, rosette, seal, the currency's sign and its value. */
function faceTexture(symbol: string, scale: number): CanvasTexture {
    const width = 1024;
    const height = Math.round(width * (WIDTH / LENGTH));
    return canvasTexture(width * scale, height * scale, (c) => {
        c.scale(scale, scale);
        const paper = c.createLinearGradient(0, 0, width, height);
        paper.addColorStop(0, '#d7e1e9');
        paper.addColorStop(1, '#aebfcd');
        c.fillStyle = paper;
        c.fillRect(0, 0, width, height);
        c.strokeStyle = '#4b6174';
        c.lineWidth = 3;
        for (let inset = 18; inset <= 34; inset += 8) c.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        c.globalAlpha = 0.3;
        c.lineWidth = 1.2;
        for (let ring = 0; ring < 40; ring += 1) {
            c.beginPath();
            c.ellipse(width * 0.68, height / 2, 36 + ring * 4.4, 28 + ring * 3.2, ring * 0.07, 0, Math.PI * 2);
            c.stroke();
        }
        c.globalAlpha = 1;
        c.fillStyle = '#7d93a6';
        c.beginPath();
        c.arc(width * 0.22, height * 0.52, height * 0.26, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2f4254';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `700 ${Math.round(height * 0.36)}px ${TOKENS.fontDisplay}`;
        c.fillText(symbol, width * 0.22, height * 0.55);
        c.textAlign = 'right';
        c.font = `700 ${Math.round(height * 0.2)}px ${TOKENS.fontMono}`;
        c.fillText(`${symbol}100`, width - 64, height * 0.24);
        c.fillText(`${symbol}100`, width - 64, height * 0.8);
    });
}

/** The edges of many notes pressed together, with the paper band round the middle. */
function edgeTexture(): CanvasTexture {
    return canvasTexture(256, 256, (c) => {
        c.fillStyle = '#c3cfd9';
        c.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 3) {
            c.fillStyle = y % 6 === 0 ? '#9fb0be' : '#d4dee6';
            c.fillRect(0, y, 256, 1);
        }
    });
}

/**
 * A bundle of banknotes in the money's own currency. Inflation shrinks it: the solid bundle is as tall as the
 * buying power the money still has; the outline above is the bundle it was in its year. The notes that are gone
 * rise off the top as dust.
 */
export function createMelt(first: MeltInput, page: boolean): Machine<MeltInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 40);
    scene.add(new AmbientLight(0xffffff, 0.9));
    const key = new DirectionalLight(0xffffff, 1.8);
    key.position.set(2, 4, 3);
    scene.add(key);

    const bundle = new Group();
    scene.add(bundle);
    const edges = edgeTexture();
    let symbol = first.symbol;
    let face = faceTexture(symbol, page ? 1 : 0.5);
    const side = new MeshStandardMaterial({ map: edges, roughness: 0.8 });
    const top = new MeshStandardMaterial({ map: face, roughness: 0.6 });
    const bottom = new MeshStandardMaterial({ color: '#9aaab8', roughness: 0.8 });
    const stack = new Mesh(new BoxGeometry(LENGTH, 1, WIDTH), [side, side, top, bottom, side, side]);
    stack.geometry.translate(0, 0.5, 0);
    bundle.add(stack);

    const band = new Mesh(
        new BoxGeometry(0.34, 1, WIDTH * 1.01),
        new MeshStandardMaterial({ color: TOKENS.inkCool, roughness: 0.5 }),
    );
    band.geometry.translate(0, 0.5, 0);
    bundle.add(band);

    const ghost = new LineSegments(
        new EdgesGeometry(new BoxGeometry(LENGTH, TALL, WIDTH)),
        new LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.45 }),
    );
    ghost.position.y = TALL / 2;
    const ghostFill = new Mesh(
        new BoxGeometry(LENGTH, TALL, WIDTH),
        new MeshBasicMaterial({
            color: WHITE,
            transparent: true,
            opacity: 0.035,
            depthWrite: false,
            blending: AdditiveBlending,
        }),
    );
    ghostFill.position.y = TALL / 2;
    bundle.add(ghost, ghostFill);

    const dust = new GlowPoints(DUST);
    bundle.add(dust.points);
    const scatter = seeds(DUST * 3, 23);

    let input = first;
    let kept = 1;

    function set(next: MeltInput): void {
        input = next;
        if (next.symbol === symbol) return;
        symbol = next.symbol;
        face.dispose();
        face = faceTexture(symbol, page ? 1 : 0.5);
        top.map = face;
        top.needsUpdate = true;
    }

    function frame(frame: Frame): void {
        const goal = Math.min(1, Math.max(0.02, input.kept));
        kept = frame.still ? goal : approach(kept, goal, 2.2, frame.delta);
        const height = TALL * kept;
        stack.scale.y = height;
        band.scale.y = height * 1.002;
        const gone = 1 - kept;

        for (let i = 0; i < DUST; i += 1) {
            const a = scatter[i * 3] ?? 0;
            const b = scatter[i * 3 + 1] ?? 0;
            const c = scatter[i * 3 + 2] ?? 0;
            if (gone < 0.02 || frame.still) {
                dust.hide(i);
                continue;
            }
            const life = (frame.seconds * (0.1 + c * 0.08) + a) % 1;
            const y = height + life * (TALL - height + 0.5);
            dust.put(i, (a - 0.5) * LENGTH * 0.9, y, (b - 0.5) * WIDTH * 0.9, 0.03 + c * 0.03, WHITE, (1 - life) * 0.6);
        }

        bundle.rotation.y =
            -0.5 + frame.turn * 0.8 + frame.pointer.x * 0.25 + (frame.still ? 0 : Math.sin(frame.seconds * 0.3) * 0.08);
        const distance = fitDistance(1.25, camera.fov, frame.aspect) * (page ? 1.05 : 0.95);
        camera.position.set(0, 1.55 + frame.pointer.y * 0.3, distance);
        camera.lookAt(0, TALL * 0.42, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        dust.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            face.dispose();
            edges.dispose();
            dust.dispose();
            disposeTree(scene);
        },
    };
}
