import { approach, clamp } from './gfx/math.ts';

/** How far a scene is turned away from its home pose by the pointer, and whether a drag holds it there. */
export interface Orbit {
    yaw: number;
    pitch: number;
    dragging: boolean;
}

export const RADIANS_PER_PX = 0.0065;
/** Time constant of the ease back home after a release. */
export const RETURN_SECONDS = 0.38;
const REST = 0.0005;

export const HOME: Orbit = { yaw: 0, pitch: 0, dragging: false };

/** A drag of dx, dy CSS px. Touch turns only sideways: a vertical swipe belongs to the page scroll. */
export function dragOrbit(
    orbit: Orbit,
    dx: number,
    dy: number,
    limits: { maxYaw: number; maxPitch: number },
    allowPitch: boolean,
): Orbit {
    // A bad delta moves nothing; a huge one is capped, so one jump can never fling the scene.
    const step = (delta: number) => (Number.isFinite(delta) ? clamp(delta, -400, 400) * RADIANS_PER_PX : 0);
    return {
        yaw: clamp(orbit.yaw + step(dx), -limits.maxYaw, limits.maxYaw),
        pitch: allowPitch ? clamp(orbit.pitch + step(dy), -limits.maxPitch, limits.maxPitch) : orbit.pitch,
        dragging: true,
    };
}

/** Letting go eases home; under reduced motion it lands home at once, with no camera move of its own. */
export function releaseOrbit(orbit: Orbit, reduced: boolean): Orbit {
    return reduced ? HOME : { ...orbit, dragging: false };
}

export function stepOrbit(orbit: Orbit, dt: number): Orbit {
    if (orbit.dragging) return orbit;
    const yaw = approach(orbit.yaw, 0, dt, RETURN_SECONDS);
    const pitch = approach(orbit.pitch, 0, dt, RETURN_SECONDS);
    return {
        yaw: Math.abs(yaw) < REST ? 0 : yaw,
        pitch: Math.abs(pitch) < REST ? 0 : pitch,
        dragging: false,
    };
}

export function turned(orbit: Orbit): boolean {
    return orbit.dragging || Math.abs(orbit.yaw) > 0.02 || Math.abs(orbit.pitch) > 0.02;
}

export function moving(orbit: Orbit): boolean {
    return orbit.dragging || orbit.yaw !== 0 || orbit.pitch !== 0;
}
