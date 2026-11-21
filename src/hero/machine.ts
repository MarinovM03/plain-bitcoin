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
    /**
     * How far to orbit the camera for the pointer, -1 to 1 each way; 0, 0 when it is elsewhere. Orbiting by it
     * makes the object follow the mouse.
     */
    pointer: { x: number; y: number };
    /** Radians to orbit the camera for the person's drag; orbiting by it turns the object with the drag. */
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

/** How far back a camera must stand to keep a sphere of this radius inside the box, at any shape of box. */
export function fitDistance(radius: number, fovDegrees: number, aspect: number): number {
    const half = Math.tan((fovDegrees * Math.PI) / 360);
    return radius / half / Math.min(1, aspect);
}

/**
 * How far back a camera must stand to keep a box of this half width and half height inside the view: wide, flat
 * things are framed by their width, tall ones by their height.
 */
export function fitBox(halfWidth: number, halfHeight: number, fovDegrees: number, aspect: number): number {
    const half = Math.tan((fovDegrees * Math.PI) / 360);
    return Math.max(halfHeight / half, halfWidth / (half * aspect));
}

/** Moves `value` toward `target` at a rate that does not depend on the frame rate. */
export function approach(value: number, target: number, rate: number, delta: number): number {
    return value + (target - value) * (1 - Math.exp(-rate * delta));
}
