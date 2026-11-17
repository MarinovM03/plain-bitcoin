import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    Fog,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    TorusGeometry,
} from 'three';
import type { MinerInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, seeds, VOID, WHITE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

/** One ring per possible count of leading zero bits; a hash lands on the ring of its own count. */
const LEVELS = 96;
const STEP = 0.34;
const SEGMENTS = 72;
const SPARKS = 1400;
/** The most new sparks a single hand-over may light, however many hashes it carried. */
const BUDGET = 90;
/** Every hash at least this deep gets a spark of its own. */
const RARE = 12;

const depthOf = (zeros: number) => -zeros * STEP;

interface Spark {
    angle: number;
    radius: number;
    y: number;
    speed: number;
    goal: number;
    zeros: number;
    age: number;
    life: number;
}

function ringGeometry(): BufferGeometry {
    const position = new Float32Array(LEVELS * SEGMENTS * 2 * 3);
    let at = 0;
    for (let level = 0; level < LEVELS; level += 1) {
        const y = depthOf(level);
        for (let i = 0; i < SEGMENTS; i += 1) {
            for (const step of [i, i + 1]) {
                const angle = (step / SEGMENTS) * Math.PI * 2;
                position[at] = Math.cos(angle);
                position[at + 1] = y;
                position[at + 2] = Math.sin(angle);
                at += 3;
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(LEVELS * SEGMENTS * 2 * 3), 3));
    return geometry;
}

function torus(radius: number, color: Color, strength: number): Mesh {
    const material = new MeshBasicMaterial({
        color: color.clone().multiplyScalar(strength),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
    });
    const mesh = new Mesh(new TorusGeometry(radius, 0.014, 6, 128), material);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
}

/**
 * The well: every ring is one more leading zero bit. Each spark is a real hash from this browser, dropped to the
 * ring of its own zero count; the orange ring far below is the depth the network needs for a block.
 */
export function createMiner(first: MinerInput, page: boolean): Machine<MinerInput> {
    const scene = new Scene();
    scene.fog = new Fog(VOID, 3, page ? 30 : 26);
    const camera = new PerspectiveCamera(page ? 44 : 40, 1, 0.05, 80);

    const ringsGeometry = ringGeometry();
    const rings = new LineSegments(
        ringsGeometry,
        new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    );
    scene.add(rings);

    const target = torus(1.002, ORANGE, 2.2);
    const best = torus(1.0, WHITE, 1.4);
    const real = torus(0.18, ORANGE, 3);
    scene.add(target, best, real);

    const HALO = 48;
    const glow = new GlowPoints(SPARKS + 1 + HALO);
    scene.add(glow.points);
    const scatter = seeds(SPARKS * 2, 61);
    const sparks: (Spark | null)[] = new Array(SPARKS).fill(null);
    let cursor = 0;

    let input = first;
    let cameraY = 1.6;
    let pulse = 0;
    let lastBest = first.best;
    let realY = 0.8;
    let realShown = 0;
    const tint = new Color();

    function paintRings(): void {
        const colors = ringsGeometry.getAttribute('color') as BufferAttribute;
        const array = colors.array as Float32Array;
        const floor = Math.max(input.needed, input.real ?? 0) + 4;
        let at = 0;
        for (let level = 0; level < LEVELS; level += 1) {
            const byte = level % 8 === 0;
            const fade = level > floor ? 0 : 1 - (level / floor) * 0.55;
            const strength = (byte ? 0.34 : 0.12) * fade;
            tint.copy(level === input.needed ? ORANGE : WHITE).multiplyScalar(strength);
            for (let i = 0; i < SEGMENTS * 2; i += 1) {
                array[at] = tint.r;
                array[at + 1] = tint.g;
                array[at + 2] = tint.b;
                at += 3;
            }
        }
        colors.needsUpdate = true;
        target.position.y = depthOf(input.needed);
    }

    function spawn(zeros: number): void {
        const index = cursor;
        cursor = (cursor + 1) % SPARKS;
        const a = scatter[index * 2] ?? 0;
        const b = scatter[index * 2 + 1] ?? 0;
        sparks[index] = {
            angle: a * Math.PI * 2 + Math.random() * 0.4,
            radius: 0.25 + Math.sqrt(b) * 0.68,
            y: 0.9,
            speed: 0,
            goal: depthOf(zeros),
            zeros,
            age: 0,
            life: 1.6 + Math.min(zeros, 40) * 0.12,
        };
    }

    function take(tally: readonly number[]): void {
        let total = 0;
        for (const count of tally) total += count;
        if (total === 0) return;
        let budget = BUDGET;
        for (let zeros = tally.length - 1; zeros >= RARE; zeros -= 1) {
            const count = Math.min(tally[zeros] ?? 0, 20);
            for (let i = 0; i < count && budget > 0; i += 1, budget -= 1) spawn(zeros);
        }
        const common = budget;
        for (let zeros = 0; zeros < Math.min(RARE, tally.length); zeros += 1) {
            const share = ((tally[zeros] ?? 0) / total) * common;
            const count = Math.floor(share) + (Math.random() < share % 1 ? 1 : 0);
            for (let i = 0; i < count; i += 1) spawn(zeros);
        }
    }

    function set(next: MinerInput): void {
        const repaint = next.needed !== input.needed || next.real !== input.real;
        input = next;
        if (repaint) paintRings();
        if (next.best > lastBest) pulse = 1;
        lastBest = next.best;
        if (next.tally) take(next.tally);
    }

    paintRings();

    function drawSparks(frame: Frame): void {
        for (let i = 0; i < SPARKS; i += 1) {
            const spark = sparks[i];
            if (!spark) {
                glow.hide(i);
                continue;
            }
            if (frame.still) {
                spark.y = spark.goal;
            } else {
                spark.age += frame.delta;
                if (spark.y > spark.goal) {
                    spark.speed += frame.delta * (5 + spark.zeros * 0.4);
                    spark.y = Math.max(spark.goal, spark.y - spark.speed * frame.delta);
                }
            }
            if (spark.age > spark.life) {
                sparks[i] = null;
                glow.hide(i);
                continue;
            }
            const fade = 1 - Math.max(0, spark.age - spark.life * 0.6) / (spark.life * 0.4);
            const heat = Math.min(1, spark.zeros / 14);
            tint.copy(WHITE).lerp(ORANGE, heat);
            glow.put(
                i,
                Math.cos(spark.angle) * spark.radius,
                spark.y,
                Math.sin(spark.angle) * spark.radius,
                0.03 + Math.min(spark.zeros, 40) * 0.005,
                tint,
                fade * (0.45 + heat * 0.55),
            );
        }
    }

    function drawReal(frame: Frame): void {
        const slot = SPARKS;
        if (input.real === null) {
            real.visible = false;
            glow.hide(slot);
            realY = 0.8;
            realShown = 0;
            return;
        }
        const goal = depthOf(input.real);
        realY = frame.still ? goal : Math.max(goal, realY - frame.delta * 7.5);
        realShown = frame.still ? 1 : Math.min(1, realShown + frame.delta * 2);
        real.visible = true;
        real.position.y = realY;
        real.scale.setScalar(0.6 + realShown * 0.4);
        glow.put(slot, 0, realY, 0, 0.42, ORANGE, realShown);
    }

    function frame(frame: Frame): void {
        const floor = depthOf(input.needed);
        const goalY = input.dive ? floor + 3.6 : page ? 3.4 : 3.6;
        cameraY = frame.still ? goalY : approach(cameraY, goalY, 1.6, frame.delta);
        const swing = frame.turn + (page ? 0 : frame.seconds * 0.12) + frame.pointer.x * 0.25;
        const lean = 0.55 + frame.pointer.y * 0.12;
        camera.position.set(Math.sin(swing) * lean, cameraY, Math.cos(swing) * lean);
        camera.lookAt(0, cameraY - 12, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();

        best.visible = input.best >= 0;
        best.position.y = depthOf(Math.max(0, input.best));
        pulse = frame.still ? 0 : Math.max(0, pulse - frame.delta * 1.4);
        best.scale.setScalar(1 + pulse * 0.25);
        (best.material as MeshBasicMaterial).color.copy(WHITE).multiplyScalar(1.2 + pulse * 2);
        const breathe = frame.still ? 1 : 0.85 + Math.sin(frame.seconds * 2.2) * 0.15;
        (target.material as MeshBasicMaterial).color.copy(ORANGE).multiplyScalar(2.2 * breathe);

        drawSparks(frame);
        drawReal(frame);
        for (let i = 0; i < HALO; i += 1) {
            const angle = (i / HALO) * Math.PI * 2 + frame.seconds * 0.05;
            glow.put(SPARKS + 1 + i, Math.cos(angle), floor, Math.sin(angle), 0.22, ORANGE, 0.55 * breathe);
        }
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
