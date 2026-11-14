/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TONES } from '../chain/material.ts';
import { contrast } from './contrast.ts';
import { TOKENS } from './tokens.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function cssTokens(source: string): Record<string, string> {
    const entries = [...source.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [
        name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        value.trim(),
    ]);
    return Object.fromEntries(entries);
}

const TEXT = [TOKENS.ink, TOKENS.inkDim, TOKENS.inkCool, TOKENS.inkWarm, TOKENS.btc];
const SURFACES = [TOKENS.void, TOKENS.plate, TOKENS.well];

describe('design tokens', () => {
    it('tokens.ts mirrors tokens.css exactly', () => {
        expect(cssTokens(css)).toEqual(TOKENS);
    });

    it('keeps every ink at AA body contrast on the page, a plate and a well', () => {
        for (const text of TEXT) {
            for (const surface of SURFACES)
                expect(contrast(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps the big answer at AAA on every surface', () => {
        for (const surface of SURFACES) expect(contrast(TOKENS.btc, surface)).toBeGreaterThanOrEqual(7);
    });

    it('keeps every ink at AA on glass, even with the palest stone pressed against the back of it', () => {
        const [, red = '', green = '', blue = '', alpha = ''] =
            /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(TOKENS.glass) ?? [];
        const tint = [red, green, blue].map(Number);
        const palest = TONES.bone.body;
        const behind = [1, 3, 5].map((start) => Number.parseInt(palest.slice(start, start + 2), 16));
        const seen = `#${tint
            .map((channel, index) =>
                Math.round(channel * Number(alpha) + (behind[index] ?? 0) * (1 - Number(alpha)))
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')}`;
        expect(Number(alpha)).toBeGreaterThanOrEqual(0.8);
        for (const text of TEXT) expect(contrast(text, seen), `${text} on glass`).toBeGreaterThanOrEqual(4.5);
    });

    it('lifts a plate edge off the page and off the plate', () => {
        expect(contrast(TOKENS.edge, TOKENS.plate)).toBeGreaterThan(1.3);
        expect(contrast(TOKENS.edge, TOKENS.void)).toBeGreaterThan(1.3);
    });

    it('keeps the three DCA series apart: orange value, white money put in, steel lump sum', () => {
        expect(contrast(TOKENS.btc, TOKENS.ink)).toBeGreaterThan(1.9);
        expect(contrast(TOKENS.ink, TOKENS.inkCool)).toBeGreaterThan(1.5);
        expect(new Set([TOKENS.btc, TOKENS.ink, TOKENS.inkCool]).size).toBe(3);
    });

    it('keeps dark text readable on the orange and the light buttons', () => {
        expect(contrast(TOKENS.void, TOKENS.btc)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(TOKENS.void, TOKENS.ink)).toBeGreaterThanOrEqual(4.5);
    });
});
