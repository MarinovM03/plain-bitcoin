import { FIELD_DOTS, plan } from '../../backdrop/left.ts';
import type { Layer } from '../kit.ts';
import { createField } from './field.ts';

// The field is a floor tipped towards the eye: the first coins mined are the far rows, the last the near ones.
const MOTION = /* glsl */ `
    float wide = 4.1 * max(0.45, uAspect);
    float back = aPlan.y * 7.2;
    vec3 slope = vec3(0.0, 0.574, -0.819);
    at = vec3(aPlan.x / uAspect * wide, 0.6, -8.0) + slope * back;
    right = vec3(1.0, 0.0, 0.0);
    up = slope;
    size = vec2(aPlan.z / uAspect * wide, aPlan.w * 7.2);
    float away = distance(at, cameraPosition);
    alpha *= 1.0 - 0.75 * smoothstep(14.0, 26.0, away);
    if (shape > 1.5) {
        alpha *= 0.55 + 0.45 * sin(uTime * 0.9 + seed * 6.2832);
    } else if (level > 0.95) {
        glow *= 1.2 + 0.5 * sin(uTime * 2.2);
        size *= 1.25;
    } else {
        glow *= 0.82 + 0.3 * sin(uTime * 0.5 + aPlan.y * 7.0 + aPlan.x * 2.0);
    }
`;

export function create(): Layer {
    return createField({ id: 'left', capacity: FIELD_DOTS, plan, motion: MOTION, stagger: 1.4, dust: 0.16 });
}
