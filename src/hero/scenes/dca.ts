import { coinScale, PILE_COINS, plan } from '../../backdrop/dca.ts';
import type { Layer } from '../kit.ts';
import { createField } from './field.ts';

const HOLD_SECONDS = 7;
const FADE_SECONDS = 1.2;

// uA: coins dropped so far, coins in the pile, how much of the pile shows. Each coin falls into its own place.
const MOTION = /* glsl */ `
    float coin = order * uA.y;
    float landed = clamp((uA.x - coin) / 2.5, 0.0, 1.0);
    float above = 1.0 - landed;
    at.y += above * above * 2.4 * uUnit;
    alpha *= step(0.0, uA.x - coin) * uA.z;
    glow *= 1.0 + 0.9 * (1.0 - smoothstep(0.0, 1.0, (uA.x - coin) / 8.0));
`;

export function create(): Layer {
    return createField({
        id: 'dca',
        capacity: PILE_COINS,
        plan,
        motion: MOTION,
        stagger: 0,
        dust: 0.16,
        extra: (tick, data) => {
            const { coins } = coinScale(data?.id === 'dca' ? data.buys : 0);
            if (tick.still || coins === 0) return [coins + 10, coins, 1, 0];
            const build = Math.min(18, Math.max(5, coins * 0.06));
            const at = tick.seconds % (build + HOLD_SECONDS + FADE_SECONDS);
            const leaving = Math.max(0, at - build - HOLD_SECONDS) / FADE_SECONDS;
            return [(at / build) * (coins + 3), coins, 1 - leaving, 0];
        },
    });
}
