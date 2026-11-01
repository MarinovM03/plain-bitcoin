/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

const files = sources(SRC).map((path) => ({
    path: relative(SRC, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
}));

describe('stage boundaries', () => {
    it('keeps every WebGL call and shader inside src/hero', () => {
        const outside = files.filter(
            ({ path, text }) => !path.startsWith('hero/') && /webgl|gl_Frag|from 'three/i.test(text),
        );
        expect(outside.map(({ path }) => path)).toEqual([]);
    });

    it('lets tools and the UI reach the stage only through the bus', () => {
        const reaches = files
            .filter(({ path }) => !path.startsWith('hero/'))
            .flatMap(({ path, text }) =>
                [...text.matchAll(/from '((?:\.\.\/)+hero\/[^']+)'/g)].map(([, target]) => `${path} -> ${target}`),
            )
            .filter((edge) => !edge.endsWith('hero/bus.ts'));
        expect(reaches).toEqual([]);
    });

    it('never fetches from the stage', () => {
        const fetching = files.filter(
            ({ path, text }) => path.startsWith('hero/') && /\bfetch\(|XMLHttpRequest/.test(text),
        );
        expect(fetching.map(({ path }) => path)).toEqual([]);
    });
});
