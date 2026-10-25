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

describe('design tokens', () => {
    it('tokens.ts mirrors tokens.css exactly', () => {
        expect(cssTokens(css)).toEqual(TOKENS);
    });
});
