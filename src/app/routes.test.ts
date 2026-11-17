import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { hrefFor, parseHash, parsePath } from './routes.ts';

describe('parsePath', () => {
    it('treats the root as home and resolves every page', () => {
        for (const path of ['', '/', '//']) expect(parsePath(path)).toBe('home');
        for (const id of TOOL_IDS) expect(parsePath(`/${id}`)).toBe(id);
        expect(parsePath('/dca/')).toBe('dca');
    });

    it('returns null for anything unknown', () => {
        for (const path of ['/nope', '/POWER', '/power/extra', '/home', '/__proto__', '/index.html']) {
            expect(parsePath(path)).toBeNull();
        }
    });
});

describe('parseHash', () => {
    it('still reads the old #/ links', () => {
        for (const hash of ['', '#', '#/']) expect(parseHash(hash)).toBe('home');
        expect(parseHash('#/left')).toBe('left');
        expect(parseHash('#/power/')).toBe('power');
        expect(parseHash('#/nope')).toBeNull();
    });
});

describe('hrefFor', () => {
    it('round-trips through parsePath', () => {
        for (const route of ['home', ...TOOL_IDS] as const) expect(parsePath(hrefFor(route))).toBe(route);
    });
});
