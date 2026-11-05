import { TOKENS } from '../../styles/tokens.ts';
import { approach, hexRgb, type Vec3 } from '../gfx/math.ts';
import { cylinder, type Mesh, roundedBox } from '../gfx/mesh.ts';

/** Scene colours come only from the readout inks. */
export const INK = {
    ink: hexRgb(TOKENS.ink),
    dim: hexRgb(TOKENS.inkDim),
    cool: hexRgb(TOKENS.inkCool),
    warm: hexRgb(TOKENS.inkWarm),
    btc: hexRgb(TOKENS.btc),
    edge: hexRgb(TOKENS.edge),
    well: hexRgb(TOKENS.well),
    plate: hexRgb(TOKENS.plate),
} satisfies Record<string, Vec3>;

/** A darker take on an ink, for the shadowed faces of a made object (still the same ink family). */
export function shade(colour: Vec3, amount: number): Vec3 {
    return [colour[0] * amount, colour[1] * amount, colour[2] * amount];
}

let shared: { block: Mesh; slab: Mesh; coin: Mesh; rod: Mesh } | null = null;

/** Unit meshes every scene scales into place, built once per worker. */
export function meshes(): { block: Mesh; slab: Mesh; coin: Mesh; rod: Mesh } {
    shared ??= {
        block: roundedBox(1, 1, 1, 0.08, 3),
        slab: roundedBox(1, 1, 1, 0.035, 2),
        coin: cylinder(0.5, 1, 40, 0.08),
        rod: cylinder(0.5, 1, 14, 0),
    };
    return shared;
}

/** Eases a value to its target with a time constant; reports whether it still moves. */
export class Tween {
    value: number;
    target: number;

    constructor(
        initial: number,
        private readonly seconds: number,
    ) {
        this.value = initial;
        this.target = initial;
    }

    to(target: number, instant: boolean): void {
        this.target = Number.isFinite(target) ? target : this.target;
        if (instant) this.value = this.target;
    }

    step(dt: number): boolean {
        this.value = approach(this.value, this.target, dt, this.seconds);
        const span = Math.max(1e-6, Math.abs(this.target) * 1e-4);
        if (Math.abs(this.value - this.target) <= span) {
            this.value = this.target;
            return false;
        }
        return true;
    }
}

/**
 * A damped spring: an underdamped settle, the same every time for the same change. Used for the balance beam, so it
 * swings once or twice and comes to rest at the honest angle. Nothing here is random.
 */
export class Spring {
    value: number;
    target: number;
    private velocity = 0;

    constructor(
        initial: number,
        private readonly stiffness = 42,
        private readonly damping = 5.2,
    ) {
        this.value = initial;
        this.target = initial;
    }

    to(target: number, instant: boolean): void {
        this.target = Number.isFinite(target) ? target : this.target;
        if (instant) {
            this.value = this.target;
            this.velocity = 0;
        }
    }

    step(dt: number): boolean {
        let left = Math.min(0.25, Math.max(0, dt));
        while (left > 0) {
            const h = Math.min(left, 1 / 120);
            const force = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
            this.velocity += force * h;
            this.value += this.velocity * h;
            left -= h;
        }
        if (Math.abs(this.target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-3) {
            this.value = this.target;
            this.velocity = 0;
            return false;
        }
        return true;
    }
}

/** A one-shot progress 0..1 (a falling sliver, a turning cylinder); -1 when idle. */
export class Beat {
    t = -1;

    constructor(private readonly seconds: number) {}

    start(): void {
        this.t = 0;
    }

    step(dt: number): boolean {
        if (this.t < 0) return false;
        this.t += dt / this.seconds;
        if (this.t >= 1) {
            this.t = -1;
            return false;
        }
        return true;
    }
}

export function finite(value: number | undefined, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
