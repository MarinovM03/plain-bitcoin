import { TOKENS } from '../styles/tokens.ts';
import { INKS, type Ink } from './scenes/types.ts';

export const INK_FILL: Record<Ink, readonly [string, number]> = {
    faint: [TOKENS.paper, 0.16],
    paper: [TOKENS.paper, 0.9],
    btc: [TOKENS.btc, 1],
    fiat: [TOKENS.fiat, 0.95],
    ghost: [TOKENS.muted, 0.45],
    ember: [TOKENS.btc, 1],
};

export function inkRgba(): [number, number, number, number][] {
    return INKS.map((ink) => {
        const [hex, alpha] = INK_FILL[ink];
        const value = Number.parseInt(hex.slice(1), 16);
        return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
    });
}
