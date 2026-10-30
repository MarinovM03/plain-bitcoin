// Adapted from coin-table: frame-driven easing and frame-rate independent smoothing.
export type Ease = (t: number) => number;

export const ease = {
    inCubic: (t: number) => t * t * t,
    outCubic: (t: number) => 1 - (1 - t) ** 3,
    inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
} satisfies Record<string, Ease>;

export interface Tween {
    duration: number;
    delay?: number;
    ease?: Ease;
    update: (t: number) => void;
    done?: () => void;
}

export class Tweens {
    private active: { spec: Tween; elapsed: number }[] = [];

    run(spec: Tween): void {
        this.active.push({ spec, elapsed: -(spec.delay ?? 0) });
    }

    get busy(): boolean {
        return this.active.length > 0;
    }

    tick(dt: number): void {
        const list = this.active;
        this.active = [];
        const still: typeof list = [];
        for (const entry of list) {
            entry.elapsed += dt;
            if (entry.elapsed < 0) {
                still.push(entry);
                continue;
            }
            const raw = entry.spec.duration <= 0 ? 1 : Math.min(1, entry.elapsed / entry.spec.duration);
            entry.spec.update((entry.spec.ease ?? ease.inOutCubic)(raw));
            if (raw >= 1) entry.spec.done?.();
            else still.push(entry);
        }
        this.active = still.concat(this.active);
    }

    finish(): void {
        const list = this.active;
        this.active = [];
        for (const entry of list) {
            entry.spec.update(1);
            entry.spec.done?.();
        }
    }
}

export function damp(lambda: number, dt: number): number {
    return 1 - Math.exp(-lambda * dt);
}
