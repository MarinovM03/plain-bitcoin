import { discCentre, plan } from '../../backdrop/convert.ts';
import { GRID_DOTS } from '../../util/sats-scale.ts';
import type { Layer } from '../kit.ts';
import { createField } from './field.ts';

// The disc turns slowly about its own middle and breathes along its radius.
const MOTION = /* glsl */ `
    vec2 centre = vec2(uA.x, 0.0);
    vec2 arm = aPlan.xy - centre;
    float reach = length(arm);
    float turn = uTime * 0.03 + 0.12 * sin(uTime * 0.25 - reach * 3.0);
    arm = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * arm;
    at.xy = (centre + arm * (1.0 + 0.02 * sin(uTime * 0.7 + reach * 9.0))) * uUnit;
    glow *= 0.88 + 0.22 * sin(uTime * 1.3 + seed * 6.2832);
`;

export function create(): Layer {
    return createField({
        id: 'convert',
        capacity: GRID_DOTS,
        plan,
        motion: MOTION,
        stagger: 0.35,
        dust: 0.16,
        extra: (_tick, _data, aspect) => [discCentre(aspect), 0, 0, 0],
    });
}
