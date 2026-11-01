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

function luminance(hex: string): number {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
        const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (light + 0.05) / (dark + 0.05);
}

describe('design tokens', () => {
    it('tokens.ts mirrors tokens.css exactly', () => {
        expect(cssTokens(css)).toEqual(TOKENS);
    });

    it('keeps every text colour at AA body contrast on both surfaces', () => {
        for (const text of [TOKENS.paper, TOKENS.muted, TOKENS.btc, TOKENS.fiat]) {
            for (const surface of [TOKENS.ink, TOKENS.raised]) {
                expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('keeps ink readable on the orange and paper buttons', () => {
        expect(contrast(TOKENS.ink, TOKENS.btc)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
    });
});
