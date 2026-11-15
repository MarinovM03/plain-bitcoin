import { plan } from '../../backdrop/power.ts';
import type { Layer } from '../kit.ts';
import { createField } from './field.ts';

// A drip falls from the foot of its note and thins out; the notes themselves only sway. uA.x is 0 in a still frame.
const MOTION = /* glsl */ `
    if (shape > 3.5) {
        float fallen = fract(uTime * (0.1 + 0.08 * seed) + seed);
        at.y -= fallen * fallen * 0.55 * uUnit;
        alpha *= (1.0 - fallen) * uA.x;
        shape = 1.0;
    } else {
        at.x += sin(uTime * 0.4 + seed * 6.2832) * 0.006 * uUnit;
        glow *= 0.82 + 0.18 * sin(uTime * 0.5 + aPlan.y * 4.0);
    }
`;

export function create(): Layer {
    return createField({
        id: 'power',
        capacity: 24 * 14 * 2,
        plan,
        motion: MOTION,
        stagger: 0.8,
        dust: 0.16,
        extra: (tick) => [tick.still ? 0 : 1, 0, 0, 0],
    });
}
