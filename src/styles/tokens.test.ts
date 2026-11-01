/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS } from './tokens.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function cssTokens(source: string): Record<string, string> {
    const entries = [...source.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [
        name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        value.trim(),
    ]);
    return Object.fromEntries(entries);
}

function channels(hex: string): number[] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function luminance(hex: string): number {
    const [r = 0, g = 0, b = 0] = channels(hex).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (light + 0.05) / (dark + 0.05);
}

function mix(base: string, over: string, amount: number): string {
    const a = channels(base);
    const b = channels(over);
    return `#${a
        .map((value, i) =>
            Math.round(value * (1 - amount) + (b[i] ?? 0) * amount)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

const TEXT = [TOKENS.paper, TOKENS.muted, TOKENS.btc, TOKENS.fiat];
const glass = Number.parseFloat(TOKENS.glass) / 100;

describe('design tokens', () => {
    it('tokens.ts mirrors tokens.css exactly', () => {
        expect(cssTokens(css)).toEqual(TOKENS);
    });

    it('keeps every text colour at AA body contrast on both surfaces', () => {
        for (const text of TEXT) {
            for (const surface of [TOKENS.ink, TOKENS.raised]) {
                expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('keeps text AA on a glass panel even over the brightest frame of the live field', () => {
        for (const brightest of [TOKENS.paper, TOKENS.btc, TOKENS.fiat]) {
            const panel = mix(TOKENS.raised, brightest, 1 - glass);
            for (const text of TEXT) expect(contrast(text, panel)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps ink readable on the orange and paper buttons', () => {
        expect(contrast(TOKENS.ink, TOKENS.btc)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
    });
});
