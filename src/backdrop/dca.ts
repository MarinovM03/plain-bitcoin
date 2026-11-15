import { type BackdropData, frameAspect, type Mark, SHAPE } from './types.ts';

export const PILE_COINS = 480;
const COIN_WIDTH = 0.2;
const COIN_FILL = 0.82;
const COIN_RISE = 0.22;
const PILE_HEIGHT = 1.3;
const FLOOR = -0.88;

/** How many coins stand for the buys: one each until the pile is full, then a whole number of buys per coin. */
export function coinScale(buys: number): { coins: number; perCoin: number } {
    const count = Number.isFinite(buys) ? Math.max(0, Math.floor(buys)) : 0;
    const perCoin = Math.max(1, Math.ceil(count / PILE_COINS));
    return { coins: Math.ceil(count / perCoin), perCoin };
}

/** Every buy as a coin, stacked left to right in the order they were made. */
export function plan(data: BackdropData | null, aspect: number): Mark[] {
    const { coins } = coinScale(data?.id === 'dca' ? data.buys : 0);
    const a = frameAspect(aspect);
    const room = 2 * a * 0.9;
    let columns = 1;
    let width = COIN_WIDTH;
    for (; columns <= coins; columns += 1) {
        width = Math.min(COIN_WIDTH, (room / columns) * COIN_FILL);
        if (Math.ceil(coins / columns) * width * COIN_RISE <= PILE_HEIGHT) break;
    }
    const tall = Math.ceil(coins / columns);
    const pitch = width / COIN_FILL;
    return Array.from({ length: coins }, (_, index) => {
        const floor = index % tall;
        return {
            x: (Math.floor(index / tall) - (columns - 1) / 2) * pitch,
            y: FLOOR + floor * width * COIN_RISE,
            w: width,
            h: width * 0.3,
            tone: 'btc',
            level: floor % 2 === 0 ? 0.9 : 0.7,
            shape: SHAPE.round,
        };
    });
}
