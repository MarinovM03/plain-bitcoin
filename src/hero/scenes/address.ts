import { plan } from '../../backdrop/address.ts';
import type { Layer } from '../kit.ts';
import { createField } from './field.ts';

const SWEEP_SECONDS = 5.5;

// uA.x is where the reading light stands, in screen units: the squares under it lift and brighten.
const MOTION = /* glsl */ `
    float under = exp(-pow((aPlan.x - uA.x) / 0.16, 2.0));
    glow *= 1.0 + 1.5 * under;
    alpha = min(1.0, alpha + 0.3 * under * step(0.01, alpha));
    size *= 1.0 + 0.1 * under;
`;

export function create(): Layer {
    return createField({
        id: 'address',
        capacity: 90,
        plan,
        motion: MOTION,
        stagger: 0.6,
        dust: 0.16,
        extra: (tick, _data, aspect) => {
            if (tick.still) return [99, 0, 0, 0];
            const along = (tick.seconds % SWEEP_SECONDS) / SWEEP_SECONDS;
            return [(along * 2.6 - 1.3) * Math.max(1, aspect), 0, 0, 0];
        },
    });
}
