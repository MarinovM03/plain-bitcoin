import {
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    DirectionalLight,
    EdgesGeometry,
    Group,
    LineBasicMaterial,
    LineSegments,
    type Material,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
    Vector3,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { MeltInput } from '../bus.ts';
import { disposeTree, GlowPoints, seeds, WHITE } from '../glow.ts';
import { approach, type Frame, fitPoints, type Machine } from '../machine.ts';

/** A banknote's length and width; loose notes are drawn a little thicker than paper so they read as notes. */
const LENGTH = 2.1;
const WIDTH = 0.9;
const NOTE = 0.014;
/** A strap of 100 notes, and how many straps make one pile. */
const BUNDLE = 0.24;
const PER_BUNDLE = 100;
const PILE = 5;
/** Up to this many notes are dealt out loose as a fan; more are strapped into bundles. */
const LOOSE_MOST = 30;
const MOST = 50;
const DUST = 48;
/** The biggest note in everyday use: the US $100 and the Bank of England £50. */
export const FACE_VALUE = { $: 100, '£': 50 } as const;

export function notesIn(amount: number, symbol: MeltInput['symbol']): number {
    return Math.max(1, Math.round(Math.max(0, amount) / FACE_VALUE[symbol]));
}

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

/** The face of one note: frame, rosette, portrait seal, the currency's sign and its value. */
function faceTexture(symbol: MeltInput['symbol'], scale: number): CanvasTexture {
    const width = 1024;
    const height = Math.round(width * (WIDTH / LENGTH));
    const value = `${symbol}${FACE_VALUE[symbol]}`;
    return canvasTexture(width * scale, height * scale, (c) => {
        c.scale(scale, scale);
        const paper = c.createLinearGradient(0, 0, width, height);
        paper.addColorStop(0, '#dfe8ee');
        paper.addColorStop(1, '#b7c8d6');
        c.fillStyle = paper;
        c.fillRect(0, 0, width, height);
        c.strokeStyle = '#4b6174';
        c.lineWidth = 3;
        for (let inset = 16; inset <= 32; inset += 8) c.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        c.globalAlpha = 0.28;
        c.lineWidth = 1.2;
        for (let ring = 0; ring < 34; ring += 1) {
            c.beginPath();
            c.ellipse(width * 0.62, height / 2, 30 + ring * 4.2, 24 + ring * 3, ring * 0.08, 0, Math.PI * 2);
            c.stroke();
        }
        c.globalAlpha = 1;
        c.fillStyle = '#8aa0b3';
        c.beginPath();
        c.ellipse(width * 0.3, height * 0.52, height * 0.24, height * 0.3, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = TOKENS.inkCool;
        c.fillRect(width * 0.47, 0, 18, height);
        c.fillStyle = '#2f4254';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `700 ${Math.round(height * 0.32)}px ${TOKENS.fontDisplay}`;
        c.fillText(symbol, width * 0.3, height * 0.55);
        c.textAlign = 'right';
        c.font = `700 ${Math.round(height * 0.19)}px ${TOKENS.fontMono}`;
        c.fillText(value, width - 60, height * 0.24);
        c.textAlign = 'left';
        c.fillText(value, 60, height * 0.8);
    });
}

/** The edge of a strap of notes: a few fine lines, few enough not to shimmer at a distance. */
function edgeTexture(): CanvasTexture {
    return canvasTexture(64, 64, (c) => {
        c.fillStyle = '#cbd6df';
        c.fillRect(0, 0, 64, 64);
        c.fillStyle = '#a3b4c2';
        for (let y = 0; y < 64; y += 4) c.fillRect(0, y, 64, 1);
    });
}

interface Slot {
    group: Group;
    body: Mesh;
    band: Mesh;
    ghost: LineSegments;
    appear: number;
}

/**
 * The money as notes on a table: one note for each $100 (or £50) typed, fanned out, or strapped in bundles when
 * there are many. Inflation eats the top of it: the notes the money can no longer buy are only an outline, the
 * note on the edge is cut to the share it still buys, and the lost value drifts up as dust.
 */
export function createMelt(first: MeltInput, page: boolean): Machine<MeltInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 80);
    scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xffffff, 1.9);
    key.position.set(2, 5, 3);
    scene.add(key);

    let symbol = first.symbol;
    const scale = page ? 1 : 0.5;
    let face = faceTexture(symbol, scale);
    let faceCut = face.clone();
    const edges = edgeTexture();
    const edgesCut = edges.clone();
    const top = new MeshStandardMaterial({ map: face, roughness: 0.65 });
    const topCut = new MeshStandardMaterial({ map: faceCut, roughness: 0.65 });
    const back = new MeshStandardMaterial({ color: '#a7b8c6', roughness: 0.8 });
    const paper = new MeshStandardMaterial({ color: '#c9d4dd', roughness: 0.8 });
    const side = new MeshStandardMaterial({ map: edges, roughness: 0.85 });
    const sideCut = new MeshStandardMaterial({ map: edgesCut, roughness: 0.85 });
    const looks: Record<'note' | 'noteCut' | 'bundle' | 'bundleCut', Material[]> = {
        note: [paper, paper, top, back, paper, paper],
        noteCut: [paper, paper, topCut, back, paper, paper],
        bundle: [side, side, top, back, side, side],
        bundleCut: [sideCut, sideCut, top, back, sideCut, sideCut],
    };
    const strap = new MeshStandardMaterial({ color: TOKENS.inkCool, roughness: 0.5 });
    const outline = new LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.4 });

    // Every piece grows from one end and from the floor, so a cut keeps the near end and a bundle keeps its base.
    const box = new BoxGeometry(1, 1, 1);
    box.translate(0.5, 0.5, 0);
    const edgeLines = new EdgesGeometry(box);
    const strapBox = new BoxGeometry(1, 1, 1);
    strapBox.translate(0, 0.5, 0);

    const slots: Slot[] = [];
    for (let i = 0; i < MOST; i += 1) {
        const group = new Group();
        const body = new Mesh(box, looks.note);
        const band = new Mesh(strapBox, strap);
        const ghost = new LineSegments(edgeLines, outline);
        group.add(body, band, ghost);
        group.visible = false;
        scene.add(group);
        slots.push({ group, body, band, ghost, appear: 0 });
    }

    const dust = new GlowPoints(DUST);
    scene.add(dust.points);
    const scatter = seeds(DUST * 3, 23);
    const lost: Vector3[] = Array.from({ length: MOST }, () => new Vector3());

    const lowest = new Vector3();
    const highest = new Vector3();
    const corners = Array.from({ length: 8 }, () => new Vector3());
    const centre = new Vector3();
    const aim = new Vector3();
    const direction = new Vector3();
    let input = first;
    let kept = 1;
    let distance = 0;

    function set(next: MeltInput): void {
        input = next;
        if (next.symbol === symbol) return;
        symbol = next.symbol;
        face.dispose();
        faceCut.dispose();
        face = faceTexture(symbol, scale);
        faceCut = face.clone();
        top.map = face;
        topCut.map = faceCut;
        top.needsUpdate = true;
        topCut.needsUpdate = true;
    }

    function stretch(x: number, y: number, z: number): void {
        lowest.set(Math.min(lowest.x, x), Math.min(lowest.y, y), Math.min(lowest.z, z));
        highest.set(Math.max(highest.x, x), Math.max(highest.y, y), Math.max(highest.z, z));
    }

    /** Loose notes fan out from one corner, the first at the bottom; returns where the lost part of each sits. */
    function fan(total: number, solid: number, frame: Frame): number {
        const step = total > 1 ? Math.min(0.11, 2.9 / (total - 1)) : 0;
        let losses = 0;
        for (let i = 0; i < MOST; i += 1) {
            const slot = slots[i];
            if (!slot) continue;
            slot.group.visible = i < total;
            if (i >= total) {
                slot.appear = 0;
                continue;
            }
            slot.appear = frame.still ? 1 : approach(slot.appear, 1, 9, frame.delta);
            const cut = Math.min(1, Math.max(0, solid - i));
            const angle = (i - (total - 1) / 2) * step;
            slot.group.position.set(-LENGTH * 0.42, i * NOTE * 1.1 + (1 - slot.appear) * 0.5, WIDTH * 0.3);
            slot.group.rotation.set(0, angle, 0);
            slot.body.visible = cut > 0.002;
            slot.body.material = cut < 1 ? looks.noteCut : looks.note;
            slot.body.scale.set(LENGTH * Math.max(0.002, cut), NOTE, WIDTH);
            if (cut > 0 && cut < 1) faceCut.repeat.set(cut, 1);
            slot.band.visible = false;
            slot.ghost.visible = cut < 0.998;
            slot.ghost.scale.set(LENGTH, NOTE, WIDTH);
            const ax = Math.cos(angle);
            const az = -Math.sin(angle);
            const at = slot.group.position;
            for (const [l, w] of [
                [0, -0.5],
                [0, 0.5],
                [1, -0.5],
                [1, 0.5],
            ] as const) {
                stretch(at.x + ax * LENGTH * l - az * WIDTH * w, at.y + NOTE, at.z + az * LENGTH * l + ax * WIDTH * w);
            }
            stretch(at.x, 0, at.z);
            if (cut < 0.998) {
                const middle = (LENGTH * (cut + 1)) / 2;
                lost[losses]?.set(at.x + ax * middle, at.y + NOTE, at.z + az * middle);
                losses += 1;
            }
        }
        return losses;
    }

    /** Bundles of 100 stand in piles of five, in rows; the last bundle may be part full. */
    function piles(total: number, solid: number, frame: Frame): number {
        const bundles = Math.min(MOST, Math.ceil(total / PER_BUNDLE));
        const count = Math.ceil(bundles / PILE);
        const columns = Math.min(4, Math.ceil(Math.sqrt(count * 2)));
        const rows = Math.ceil(count / columns);
        let losses = 0;
        for (let i = 0; i < MOST; i += 1) {
            const slot = slots[i];
            if (!slot) continue;
            slot.group.visible = i < bundles;
            if (i >= bundles) {
                slot.appear = 0;
                continue;
            }
            slot.appear = frame.still ? 1 : approach(slot.appear, 1, 9, frame.delta);
            const full = Math.min(1, total / PER_BUNDLE - i);
            const cut = Math.min(full, Math.max(0, solid / PER_BUNDLE - i));
            const pile = Math.floor(i / PILE);
            const column = pile % columns;
            const row = Math.floor(pile / columns);
            const x = (column - (columns - 1) / 2) * (LENGTH + 0.2);
            const z = (row - (rows - 1) / 2) * (WIDTH + 0.24);
            const y = (i % PILE) * BUNDLE * 1.02 + (1 - slot.appear) * 0.6;
            slot.group.position.set(x - LENGTH / 2, y, z);
            slot.group.rotation.set(0, 0, 0);
            slot.body.visible = cut > 0.002;
            slot.body.material = cut < 1 ? looks.bundleCut : looks.bundle;
            slot.body.scale.set(LENGTH, BUNDLE * Math.max(0.002, cut), WIDTH);
            if (cut > 0 && cut < 1) edgesCut.repeat.set(1, cut);
            slot.band.visible = cut > 0.002;
            slot.band.position.x = LENGTH / 2;
            slot.band.scale.set(0.34, BUNDLE * cut * 1.01, WIDTH * 1.02);
            slot.ghost.visible = cut < full - 0.002;
            slot.ghost.scale.set(LENGTH, BUNDLE * full, WIDTH);
            stretch(x - LENGTH / 2, 0, z - WIDTH / 2);
            stretch(x + LENGTH / 2, y + BUNDLE * full, z + WIDTH / 2);
            if (cut < full - 0.002) {
                lost[losses]?.set(x, y + BUNDLE * cut, z);
                losses += 1;
            }
        }
        return losses;
    }

    function frame(frame: Frame): void {
        const goal = Math.min(1, Math.max(0, input.kept));
        kept = frame.still ? goal : approach(kept, goal, 2.4, frame.delta);
        const total = notesIn(input.amount, input.symbol);
        lowest.set(Infinity, Infinity, Infinity);
        highest.set(-Infinity, -Infinity, -Infinity);
        const losses = total <= LOOSE_MOST ? fan(total, total * kept, frame) : piles(total, total * kept, frame);

        for (let i = 0; i < DUST; i += 1) {
            const from = lost[i % Math.max(1, losses)];
            if (losses === 0 || frame.still || !from) {
                dust.hide(i);
                continue;
            }
            const a = scatter[i * 3] ?? 0;
            const b = scatter[i * 3 + 1] ?? 0;
            const c = scatter[i * 3 + 2] ?? 0;
            const life = (frame.seconds * (0.12 + c * 0.1) + a) % 1;
            const reach = total <= LOOSE_MOST ? LENGTH * 0.25 : LENGTH * 0.45;
            dust.put(
                i,
                from.x + (a - 0.5) * reach * 2,
                from.y + life * 0.9,
                from.z + (b - 0.5) * WIDTH * 0.8,
                0.025 + c * 0.03,
                WHITE,
                (1 - life) * 0.55,
            );
        }

        corners.forEach((corner, i) => {
            corner.set(i & 1 ? highest.x : lowest.x, i & 2 ? highest.y + 0.25 : lowest.y, i & 4 ? highest.z : lowest.z);
        });
        centre.addVectors(lowest, highest).multiplyScalar(0.5);
        const swing =
            -0.42 +
            frame.turn * 0.8 +
            frame.pointer.x * 0.25 +
            (frame.still ? 0 : Math.sin(frame.seconds * 0.25) * 0.08);
        const rise = (total <= LOOSE_MOST ? 0.95 : 0.6) + frame.pointer.y * 0.12;
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        direction.set(Math.sin(swing) * Math.cos(rise), Math.sin(rise), Math.cos(swing) * Math.cos(rise));
        const fit = fitPoints(camera, corners, centre, direction, page ? 0.84 : 0.8);
        const settled = frame.still || distance === 0;
        distance = settled ? fit : approach(distance, fit, 4, frame.delta);
        if (settled) aim.copy(centre);
        else aim.lerp(centre, 1 - Math.exp(-4 * frame.delta));
        camera.position.copy(aim).addScaledVector(direction, distance);
        camera.lookAt(aim);
        dust.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            face.dispose();
            faceCut.dispose();
            edges.dispose();
            edgesCut.dispose();
            for (const material of [top, topCut, back, paper, side, sideCut, strap, outline]) material.dispose();
            for (const geometry of [box, edgeLines, strapBox]) geometry.dispose();
            dust.dispose();
            disposeTree(scene);
        },
    };
}
