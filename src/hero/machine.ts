import { type PerspectiveCamera, type Scene, Vector3 } from 'three';

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

const projected = new Vector3();

/**
 * How far back along `direction` from `aim` the camera must stand for every point to be in view, leaving `margin`
 * of the half view free at the edges. Perspective is included, so the corners nearest the camera are never cut.
 * The camera's aspect and projection must already be set.
 */
export function fitPoints(
    camera: PerspectiveCamera,
    points: readonly Vector3[],
    aim: Vector3,
    direction: Vector3,
    margin = 0.92,
): number {
    let near = 0.1;
    let far = 100;
    for (let step = 0; step < 18; step += 1) {
        const middle = (near + far) / 2;
        camera.position.copy(aim).addScaledVector(direction, middle);
        camera.lookAt(aim);
        camera.updateMatrixWorld();
        const inside = points.every((point) => {
            projected.copy(point).project(camera);
            return projected.z < 1 && Math.abs(projected.x) <= margin && Math.abs(projected.y) <= margin;
        });
        if (inside) far = middle;
        else near = middle;
    }
    return far;
}

/** Moves `value` toward `target` at a rate that does not depend on the frame rate. */
export function approach(value: number, target: number, rate: number, delta: number): number {
    return value + (target - value) * (1 - Math.exp(-rate * delta));
}
