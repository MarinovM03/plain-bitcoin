import { GRID_DOTS, satsScale } from '../util/sats-scale.ts';
import { type BackdropData, frameAspect, type Mark, SHAPE } from './types.ts';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** On a wide screen the disc stands to the right, clear of the panel. */
export function discCentre(aspect: number): number {
    const a = frameAspect(aspect);
    return a > 1.25 ? a * 0.55 : 0;
}

/** The amount as points on a disc that fills from the middle out; each point is a round number of sats. */
export function plan(data: BackdropData | null, aspect: number): Mark[] {
    const { filled, partial } = satsScale(data?.id === 'convert' ? data.sats : 0);
    const a = frameAspect(aspect);
    const centre = discCentre(a);
    const radius = centre > 0 ? Math.min(0.72, (a - centre) * 0.94) : Math.min(a, 1) * 0.9;
    const dot = radius * 0.04;
    return Array.from({ length: GRID_DOTS }, (_, index) => {
        const reach = radius * Math.sqrt((index + 0.5) / GRID_DOTS);
        const turn = index * GOLDEN_ANGLE;
        const whole = index < filled;
        const part = index === filled && partial > 0;
        return {
            x: centre + Math.cos(turn) * reach,
            y: Math.sin(turn) * reach,
            w: dot,
            h: dot,
            tone: whole || part ? 'btc' : 'dim',
            level: whole ? 1 : part ? 0.3 + 0.7 * partial : 0.45,
            shape: whole || part ? SHAPE.round : SHAPE.roundOpen,
        };
    });
}
