import { describe, expect, it } from 'vitest';
import { dragOrbit, HOME, moving, releaseOrbit, stepOrbit, turned } from './orbit.ts';

const limits = { maxYaw: 0.5, maxPitch: 0.2 };

describe('orbit', () => {
    it('turns with a drag, inside its limits, and only tilts for a mouse', () => {
        const far = dragOrbit(HOME, 5000, 5000, limits, true);
        expect(far.yaw).toBe(0.5);
        expect(far.pitch).toBe(0.2);
        const touch = dragOrbit(HOME, 40, 300, limits, false);
        expect(touch.pitch).toBe(0);
        expect(touch.yaw).toBeGreaterThan(0);
        expect(dragOrbit(HOME, Number.NaN, Number.NaN, limits, true)).toMatchObject({ yaw: 0, pitch: 0 });
    });

    it('eases back home after a release, and lands at once under reduced motion', () => {
        let orbit = releaseOrbit(dragOrbit(HOME, 60, 20, limits, true), false);
        expect(turned(orbit)).toBe(true);
        for (let i = 0; i < 120; i += 1) orbit = stepOrbit(orbit, 1 / 30);
        expect(orbit).toEqual(HOME);
        expect(moving(orbit)).toBe(false);
        expect(releaseOrbit(dragOrbit(HOME, 60, 20, limits, true), true)).toEqual(HOME);
    });

    it('holds still while it is being dragged', () => {
        const held = dragOrbit(HOME, 60, 0, limits, true);
        expect(stepOrbit(held, 1)).toEqual(held);
    });
});
