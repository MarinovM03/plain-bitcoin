import {
    AmbientLight,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DirectionalLight,
    Group,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    SRGBColorSpace,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { SatsInput } from '../bus.ts';
import { disposeTree, ORANGE } from '../glow.ts';
import { approach, type Frame, fitBox, type Machine } from '../machine.ts';

/** One drum per digit: the largest amount, 21 million BTC, has 8 whole digits and 8 after the point. */
const SAT_DRUMS = 16;
const MONEY_DRUMS = 16;
const RADIUS = 0.42;
const FACE = 2 * RADIUS * Math.tan(Math.PI / 10);
const PITCH = 0.3;
const STEP = (Math.PI * 2) / 10;

type Look = 'sats' | 'coin' | 'money';

const LOOKS: Record<Look, { ink: string; face: string }> = {
    sats: { ink: TOKENS.ink, face: '#1b1e24' },
    coin: { ink: TOKENS.void, face: TOKENS.btc },
    money: { ink: TOKENS.void, face: TOKENS.inkCool },
};

function glyph(text: string, look: { ink: string; face: string } | null, size = 1): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 112;
    canvas.height = 120;
    const c = canvas.getContext('2d');
    if (c) {
        if (look) {
            c.fillStyle = look.face;
            c.fillRect(0, 0, canvas.width, canvas.height);
        }
        c.fillStyle = look?.ink ?? TOKENS.ink;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `500 ${Math.round(92 * size)}px ${TOKENS.fontMono}`;
        c.fillText(text, 56, 64);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

interface Drum {
    group: Group;
    angle: number;
    goal: number;
    look: Look;
    faces: Mesh[];
}

/**
 * The amount on a mechanical counter. The top row is bitcoin written out in full: whole coins on orange drums,
 * a glowing point, then the eight digits that are sats. The row under it is the same amount in money. Every
 * drum rolls the short way round to its new digit.
 */
export function createSats(first: SatsInput, page: boolean): Machine<SatsInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(page ? 30 : 28, 1, 0.1, 60);
    scene.add(new AmbientLight(0xffffff, 0.9));
    const key = new DirectionalLight(0xffffff, 1.8);
    key.position.set(1, 3, 5);
    scene.add(key);

    const materials: Record<Look, MeshStandardMaterial[]> = { sats: [], coin: [], money: [] };
    for (const look of Object.keys(LOOKS) as Look[]) {
        for (let digit = 0; digit < 10; digit += 1) {
            materials[look].push(
                new MeshStandardMaterial({ map: glyph(String(digit), LOOKS[look]), roughness: 0.55, metalness: 0.1 }),
            );
        }
    }
    const cap = new MeshStandardMaterial({ color: '#2a2e35', metalness: 0.7, roughness: 0.35 });
    const capGeometry = new CylinderGeometry(RADIUS * 1.03, RADIUS * 1.03, 0.02, 20);
    const faceGeometry = new PlaneGeometry(PITCH * 0.86, FACE * 1.01);

    function drum(look: Look): Drum {
        const group = new Group();
        const faces: Mesh[] = [];
        for (let digit = 0; digit < 10; digit += 1) {
            const face = new Mesh(faceGeometry, materials[look][digit]);
            const angle = -digit * STEP;
            face.position.set(
                0,
                Math.sin(-angle) * RADIUS * Math.cos(Math.PI / 10),
                Math.cos(angle) * RADIUS * Math.cos(Math.PI / 10),
            );
            face.rotation.x = angle;
            group.add(face);
            faces.push(face);
        }
        for (const side of [-1, 1]) {
            const disc = new Mesh(capGeometry, cap);
            disc.rotation.z = Math.PI / 2;
            disc.position.x = side * PITCH * 0.45;
            group.add(disc);
        }
        return { group, angle: 0, goal: 0, look, faces };
    }

    function restyle(item: Drum, look: Look): void {
        if (item.look === look) return;
        item.look = look;
        item.faces.forEach((face, digit) => {
            face.material = materials[look][digit] as MeshStandardMaterial;
        });
    }

    const satsRow = new Group();
    const moneyRow = new Group();
    scene.add(satsRow, moneyRow);
    const satDrums = Array.from({ length: SAT_DRUMS }, () => drum('sats'));
    const moneyDrums = Array.from({ length: MONEY_DRUMS }, () => drum('money'));
    for (const item of satDrums) satsRow.add(item.group);
    for (const item of moneyDrums) moneyRow.add(item.group);

    const pointTexture = glyph('.', null, 1.2);
    const point = new Mesh(
        new PlaneGeometry(PITCH * 0.5, FACE),
        new MeshStandardMaterial({
            map: pointTexture,
            transparent: true,
            emissive: new Color(ORANGE),
            emissiveIntensity: 0.6,
        }),
    );
    satsRow.add(point);
    const centPoint = new Mesh(point.geometry, point.material);
    moneyRow.add(centPoint);
    let symbolTexture = glyph(first.symbol, null);
    const symbol = new Mesh(
        new PlaneGeometry(PITCH * 0.9, FACE * 1.2),
        new MeshStandardMaterial({ map: symbolTexture, transparent: true }),
    );
    moneyRow.add(symbol);

    let input = first;
    let shownSats = 9;
    let shownMoney = 0;

    /** Turns the drums to their digits, right-aligned; unused drums on the left are hidden. */
    function setRow(drums: Drum[], digits: string, decimals: number, row: Group, dot: Mesh, lead: Mesh | null): number {
        const used = Math.max(decimals + 1, digits.length);
        const padded = digits.padStart(used, '0');
        let x = 0;
        const positions: number[] = [];
        for (let i = 0; i < used; i += 1) {
            if (i === used - decimals) x += PITCH * 0.5;
            positions.push(x);
            x += PITCH;
        }
        const width = x - PITCH;
        drums.forEach((item, index) => {
            const at = index - (drums.length - used);
            item.group.visible = at >= 0;
            if (at < 0) return;
            const digit = Number(padded[at] ?? 0);
            const turns = Math.round((item.goal - digit * STEP) / (Math.PI * 2));
            item.goal = digit * STEP + turns * Math.PI * 2;
            item.group.position.x = (positions[at] ?? 0) - width / 2;
            if (row === satsRow) restyle(item, at < used - decimals ? 'coin' : 'sats');
        });
        dot.position.set((positions[used - decimals] ?? 0) - width / 2 - PITCH * 0.75, -FACE * 0.32, RADIUS * 0.95);
        if (lead) lead.position.set((positions[0] ?? 0) - width / 2 - PITCH * 0.95, 0, RADIUS * 0.9);
        return width;
    }

    function set(next: SatsInput): void {
        if (next.symbol !== input.symbol) {
            symbolTexture.dispose();
            symbolTexture = glyph(next.symbol, null);
            (symbol.material as MeshStandardMaterial).map = symbolTexture;
            (symbol.material as MeshStandardMaterial).needsUpdate = true;
        }
        input = next;
        const sats = Math.max(0, Math.round(next.sats));
        shownSats = setRow(satDrums, String(sats), 8, satsRow, point, null);
        const cents = next.money === null ? 0 : Math.round(next.money * 100);
        moneyRow.visible = next.money !== null && sats > 0;
        shownMoney = setRow(moneyDrums, String(cents), 2, moneyRow, centPoint, symbol);
    }
    set(first);

    function frame(frame: Frame): void {
        for (const [index, item] of [...satDrums, ...moneyDrums].entries()) {
            const rate = 7 - (index % SAT_DRUMS) * 0.18;
            item.angle = frame.still ? item.goal : approach(item.angle, item.goal, rate, frame.delta);
            item.group.rotation.x = item.angle;
        }
        satsRow.position.y = moneyRow.visible ? 0.32 : 0;
        moneyRow.position.y = -0.42;
        moneyRow.scale.setScalar(0.72);

        const wide = Math.max(shownSats, shownMoney * 0.72, PITCH * 9) / 2 + PITCH;
        const swing =
            -0.22 +
            frame.turn * 0.6 +
            frame.pointer.x * 0.2 +
            (frame.still ? 0 : Math.sin(frame.seconds * 0.35) * 0.06);
        const distance = fitBox(wide, moneyRow.visible ? 0.95 : 0.6, camera.fov, frame.aspect) * 1.08;
        camera.position.set(Math.sin(swing) * distance, 0.25 + frame.pointer.y * 0.3, Math.cos(swing) * distance);
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            for (const list of Object.values(materials)) for (const material of list) material.map?.dispose();
            pointTexture.dispose();
            symbolTexture.dispose();
            disposeTree(scene);
        },
    };
}
