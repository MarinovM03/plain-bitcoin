import { type BackdropData, frameAspect, type Mark, SHAPE, share } from './types.ts';

export const FIELD_DOTS = 2100;
export const BTC_PER_DOT = 10_000;

/** All 21 million as 2,100 dots in the order they are mined: lit once mined, open rings while still to come. */
export function plan(data: BackdropData | null, aspect: number): Mark[] {
    const mined = data?.id === 'left' ? share(data.mined) : 0;
    const a = frameAspect(aspect);
    const columns = Math.max(12, Math.round(Math.sqrt(FIELD_DOTS * a)));
    const rows = Math.ceil(FIELD_DOTS / columns);
    const cell = Math.min((2 * a * 0.94) / columns, 1.8 / rows);
    const lit = Math.floor(mined * FIELD_DOTS);
    return Array.from({ length: FIELD_DOTS }, (_, index) => {
        const done = index < lit;
        return {
            x: ((index % columns) - (columns - 1) / 2) * cell,
            y: ((rows - 1) / 2 - Math.floor(index / columns)) * cell,
            w: cell * 0.5,
            h: cell * 0.5,
            tone: done ? 'warm' : 'btc',
            level: done ? 0.5 : index === lit && lit > 0 ? 1 : 0.8,
            shape: done || (index === lit && lit > 0) ? SHAPE.round : SHAPE.roundOpen,
        };
    });
}
