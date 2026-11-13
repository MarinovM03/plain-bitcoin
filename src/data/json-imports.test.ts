/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SNAPSHOT } from './chain-snapshot.ts';
import { POWER_SERIES } from './power.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

/** The JSON files load through import attributes; these values pin that every file still loads as the same data. */
describe('bundled JSON data loads with import attributes', () => {
    it('loads the four monthly series power.ts imports', () => {
        expect(POWER_SERIES.GBP.cpi.months['2015-01']).toBe(99.3);
        expect(POWER_SERIES.USD.cpi.months['2015-01']).toBe(233.707);
        expect(POWER_SERIES.GBP.prices.months['2015-01']).toBe(144.6374);
        expect(POWER_SERIES.USD.prices.months['2015-01']).toBe(217.33216);
    });

    it('loads the daily closes the DCA tool imports lazily', async () => {
        const daily = await import('./prices/daily-gbp.ts');
        expect(daily.default.start).toBe('2010-07-18');
        expect(daily.default.closes.length).toBeGreaterThan(5000);
    });

    it('loads eight whole, consecutive blocks for the offline chain', () => {
        expect(SNAPSHOT.blocks).toHaveLength(8);
        SNAPSHOT.blocks.forEach((block, index) => {
            expect(block.height).toBe((SNAPSHOT.blocks[0]?.height ?? 0) - index);
            expect(block.hash).toMatch(/^0{8}[0-9a-f]{56}$/);
            expect(block.time).not.toBeNull();
        });
        expect(SNAPSHOT.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('never loads a JSON file with a dynamic import, which a dev server cannot serve as JSON', () => {
        const dynamic = sources(SRC).filter((path) => /import\([^)]*\.json/.test(readFileSync(path, 'utf8')));
        expect(dynamic).toEqual([]);
    });
});
