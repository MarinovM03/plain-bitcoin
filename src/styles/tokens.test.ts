/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, luminance } from './contrast.ts';
import { TOKENS, WEATHER_CEILING, WEATHER as WEATHER_FAMILY } from './tokens.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function cssTokens(source: string): Record<string, string> {
    const entries = [...source.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [
        name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        value.trim(),
    ]);
    return Object.fromEntries(entries);
}

const READOUT_TEXT = [TOKENS.ink, TOKENS.inkDim, TOKENS.inkCool, TOKENS.inkWarm, TOKENS.btc];
const SURFACES = [TOKENS.plate, TOKENS.well];
const WEATHER = Object.values(WEATHER_FAMILY);

describe('design tokens', () => {
    it('tokens.ts mirrors tokens.css exactly', () => {
        expect(cssTokens(css)).toEqual(TOKENS);
    });

    it('keeps every readout ink at AA body contrast on a plate and in a well', () => {
        for (const text of READOUT_TEXT) {
            for (const surface of SURFACES)
                expect(contrast(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps every graph line and filled cell at 3:1 against the plate, the well and each other series', () => {
        for (const ink of READOUT_TEXT)
            for (const surface of SURFACES) expect(contrast(ink, surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(TOKENS.edge, TOKENS.plate)).toBeGreaterThan(1.3);
    });

    it('holds the whole weather family under the luminance ceiling, darker than any readout ink', () => {
        for (const colour of WEATHER) expect(luminance(colour), colour).toBeLessThanOrEqual(WEATHER_CEILING);
        const brightestWeather = Math.max(...WEATHER.map(luminance));
        for (const ink of READOUT_TEXT) expect(luminance(ink)).toBeGreaterThan(brightestWeather * 2.5);
        // The plate is darker than the brightest weather crest, and its hairline edge lifts it off the deep ground.
        expect(luminance(TOKENS.plate)).toBeLessThan(luminance(TOKENS.weatherCrest));
        expect(contrast(TOKENS.edge, TOKENS.weatherDeep)).toBeGreaterThan(1.3);
        // Ink on the brightest weather still reads, so a label at a plate's edge never melts into the background.
        expect(contrast(TOKENS.ink, TOKENS.weatherCrest)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the three DCA series apart: orange value, white money put in, steel lump sum', () => {
        expect(contrast(TOKENS.btc, TOKENS.ink)).toBeGreaterThan(1.9);
        expect(contrast(TOKENS.ink, TOKENS.inkCool)).toBeGreaterThan(1.5);
        expect(new Set([TOKENS.btc, TOKENS.ink, TOKENS.inkCool]).size).toBe(3);
    });

    it('keeps ink readable on the orange and ink buttons', () => {
        expect(contrast(TOKENS.void, TOKENS.btc)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(TOKENS.void, TOKENS.ink)).toBeGreaterThanOrEqual(4.5);
    });
});
