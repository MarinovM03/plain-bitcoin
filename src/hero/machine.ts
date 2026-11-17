import type { PerspectiveCamera, Scene } from 'three';

export interface Frame {
    seconds: number;
    /** 0 on a single still frame. */
    delta: number;
    aspect: number;
    /** Height of the box in device pixels. */
    pixels: number;
    /** Reduced motion: everything must be drawn at rest. */
    still: boolean;
    /** The pointer over the box, -1 to 1 each way; 0, 0 when it is elsewhere. */
    pointer: { x: number; y: number };
    /** Radians the person has turned the scene by dragging it. */
    turn: number;
    /** A machine's own page rather than a gallery tile. */
    page: boolean;
}

export interface Machine<I> {
    readonly scene: Scene;
    readonly camera: PerspectiveCamera;
    set(input: I): void;
    frame(frame: Frame): void;
    dispose(): void;
}

export type MachineFactory<I> = (input: I, page: boolean) => Machine<I>;

/** Moves `value` toward `target` at a rate that does not depend on the frame rate. */
export function approach(value: number, target: number, rate: number, delta: number): number {
    return value + (target - value) * (1 - Math.exp(-rate * delta));
}
