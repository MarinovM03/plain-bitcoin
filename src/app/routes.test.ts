import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { hrefFor, parseHash } from './routes.ts';

describe('parseHash', () => {
    it('treats an empty or root hash as home', () => {
        for (const hash of ['', '#', '#/', '#//']) expect(parseHash(hash)).toBe('home');
    });

    it('resolves every tool route', () => {
        expect(parseHash('#/power')).toBe('power');
        expect(parseHash('#/left')).toBe('left');
        expect(parseHash('#/convert')).toBe('convert');
        expect(parseHash('#/dca')).toBe('dca');
        expect(parseHash('#/address')).toBe('address');
    });

    it('tolerates a trailing slash', () => {
        expect(parseHash('#/dca/')).toBe('dca');
    });

    it('returns null for anything unknown', () => {
        for (const hash of ['#/nope', '#/POWER', '#/power/extra', '#/power?x=1', '#/home', '#/__proto__']) {
            expect(parseHash(hash)).toBeNull();
        }
    });
});

describe('hrefFor', () => {
    it('round-trips through parseHash', () => {
        for (const route of ['home', ...TOOL_IDS] as const) expect(parseHash(hrefFor(route))).toBe(route);
    });
});
