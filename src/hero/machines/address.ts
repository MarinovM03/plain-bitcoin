import {
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    DirectionalLight,
    Group,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { AddressInput, AddressRole } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, WHITE } from '../glow.ts';
import { approach, type Frame, fitBox, type Machine } from '../machine.ts';

const MOST = 90;
const PER_ROW = 22;
const STEP = 0.16;
const ROW = 0.24;
const DEAL_SECONDS = 0.9;
const SWEEP_SECONDS = 1.6;
const REST_SECONDS = 2.4;

const INK: Record<AddressRole, string> = {
    hrp: TOKENS.btc,
    prefix: TOKENS.btc,
    separator: TOKENS.inkDim,
    version: TOKENS.inkCool,
    program: TOKENS.ink,
    body: TOKENS.ink,
    checksum: TOKENS.inkWarm,
    unknown: TOKENS.inkDim,
};

/**
 * An address as a row of tiles, one per character, each showing its character in the colour of its part: the
 * prefix orange, the version blue, the data white, the checksum warm. A new address deals its tiles in; a light
 * runs across as the checksum is worked out and, on a good address, the checksum tiles lock in. A likely typo
 * steps out of the row.
 */
export function createAddress(first: AddressInput, page: boolean): Machine<AddressInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 30 : 28, 1, 0.1, 40);
    scene.add(new AmbientLight(0xffffff, 0.75));
    const key = new DirectionalLight(0xffffff, 1.8);
    key.position.set(1, 3, 5);
    scene.add(key);

    const cache = new Map<string, MeshStandardMaterial>();
    function face(char: string, role: AddressRole): MeshStandardMaterial {
        const id = `${role}:${char}`;
        const known = cache.get(id);
        if (known) return known;
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 96;
        const c = canvas.getContext('2d');
        if (c) {
            c.fillStyle = '#16191e';
            c.fillRect(0, 0, 64, 96);
            c.fillStyle = INK[role];
            c.fillRect(0, 88, 64, 8);
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.font = `500 58px ${TOKENS.fontMono}`;
            c.fillText(char, 32, 44);
        }
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        const material = new MeshStandardMaterial({ map: texture, roughness: 0.5 });
        cache.set(id, material);
        return material;
    }

    const side = new MeshStandardMaterial({ color: '#2a2f37', roughness: 0.5 });
    const geometry = new BoxGeometry(STEP * 0.84, ROW * 0.84, 0.05);
    const row = new Group();
    scene.add(row);
    const tiles: Mesh[] = [];
    for (let i = 0; i < MOST; i += 1) {
        const tile = new Mesh(geometry, [side, side, side, side, side, side]);
        tile.visible = false;
        tiles.push(tile);
        row.add(tile);
    }
    const glow = new GlowPoints(MOST);
    scene.add(glow.points);

    let input = first;
    let clock = 0;
    let dealt = 0;
    const pops = new Float32Array(MOST);

    function place(index: number, count: number): { x: number; y: number } {
        const rows = Math.ceil(count / PER_ROW);
        const line = Math.floor(index / PER_ROW);
        const inRow = Math.min(PER_ROW, count - line * PER_ROW);
        const column = index - line * PER_ROW;
        return { x: (column - (inRow - 1) / 2) * STEP, y: ((rows - 1) / 2 - line) * ROW };
    }

    function dress(): void {
        const chars = [...input.chars];
        tiles.forEach((tile, i) => {
            const role = input.roles[i] ?? 'unknown';
            const char = chars[i] ?? '';
            tile.visible = i < chars.length;
            if (!tile.visible) return;
            const materials = tile.material as MeshStandardMaterial[];
            materials[4] = face(char, role);
        });
    }

    function set(next: AddressInput): void {
        const changed = next.chars !== input.chars || next.state !== input.state;
        input = next;
        if (!changed) return;
        dress();
        clock = 0;
        dealt = 0;
    }
    dress();

    function frame(frame: Frame): void {
        const count = Math.min(MOST, [...input.chars].length);
        dealt = frame.still ? DEAL_SECONDS : Math.min(DEAL_SECONDS, dealt + frame.delta);
        clock = frame.still ? SWEEP_SECONDS : (clock + frame.delta) % (SWEEP_SECONDS + REST_SECONDS);
        const sweep = dealt < DEAL_SECONDS ? 0 : Math.min(1, clock / SWEEP_SECONDS);
        const head = sweep * count;
        const settled = sweep >= 1;
        const valid = input.state === 'valid';

        for (let i = 0; i < count; i += 1) {
            const tile = tiles[i];
            if (!tile) continue;
            const { x, y } = place(i, count);
            const turn = Math.min(1, Math.max(0, (dealt / DEAL_SECONDS) * 1.8 - (i / Math.max(1, count)) * 0.8));
            const suspect = input.suspect === i;
            pops[i] = frame.still ? (suspect ? 1 : 0) : approach(pops[i] ?? 0, suspect ? 1 : 0, 6, frame.delta);
            const near = Math.max(0, 1 - Math.abs(i - head) / 2.5) * (settled ? 0 : 1);
            const pop = pops[i] ?? 0;
            tile.position.set(x, y + near * 0.03 + pop * 0.06, near * 0.04 + pop * 0.22);
            tile.rotation.set(-pop * 0.25, (1 - turn) * Math.PI, pop * 0.12);

            const role = input.roles[i] ?? 'unknown';
            const lockedIn = valid && settled && role === 'checksum';
            if (suspect) glow.put(i, x, y + 0.06, 0.32, 0.36, ORANGE, 0.9);
            else if (lockedIn) glow.put(i, x, y, 0.06, 0.16, WHITE, 0.5);
            else if (near > 0 && input.state !== 'empty') glow.put(i, x, y, 0.06, 0.2 * near, ORANGE, near);
            else glow.hide(i);
        }
        for (let i = count; i < MOST; i += 1) glow.hide(i);

        const rows = Math.max(1, Math.ceil(count / PER_ROW));
        const across = Math.min(PER_ROW, Math.max(count, 12)) * STEP;
        const swing =
            frame.turn * 0.5 + frame.pointer.x * 0.15 + (frame.still ? 0 : Math.sin(frame.seconds * 0.3) * 0.05);
        const distance = fitBox(across / 2 + STEP, (rows * ROW) / 2 + 0.2, camera.fov, frame.aspect) * 1.1;
        camera.position.set(Math.sin(swing) * distance, 0.25 + frame.pointer.y * 0.2, Math.cos(swing) * distance);
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
            for (const material of cache.values()) {
                material.map?.dispose();
                material.dispose();
            }
            glow.dispose();
            disposeTree(scene);
        },
    };
}
