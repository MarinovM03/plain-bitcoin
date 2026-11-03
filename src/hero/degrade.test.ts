import { describe, expect, it } from 'vitest';
import { createLadder, type Ladder, MAX_FAILS, SLOW_RATIO, SLOW_STILL_MS, UPGRADE_MS, WINDOW_MS } from './degrade.ts';

const TARGET = 1000 / 24;

function feed(ladder: Ladder, intervalMs: number, totalMs: number) {
    const steps = [];
    for (let elapsed = 0; elapsed < totalMs; elapsed += intervalMs) steps.push(ladder.sample(intervalMs, TARGET));
    return steps.filter((step) => step !== null);
}

describe('degrade ladder', () => {
    it('holds its level while frames keep to the ambient rate', () => {
        const ladder = createLadder('full');
        expect(feed(ladder, TARGET * 1.1, 10_000)).toEqual([]);
        expect(ladder.quality).toBe('full');
    });

    it('steps down one level after a window of slow frames: full, then lite, then a still frame', () => {
        const ladder = createLadder('full');
        const slow = TARGET * (SLOW_RATIO + 0.3);
        expect(feed(ladder, slow, WINDOW_MS)).toEqual(['lite']);
        expect(feed(ladder, slow, WINDOW_MS)).toEqual(['still']);
        expect(ladder.quality).toBe('still');
    });

    it('waits for a whole window before judging, so one long frame never degrades', () => {
        const ladder = createLadder('full');
        expect(ladder.sample(400, TARGET)).toBeNull();
        expect(feed(ladder, TARGET, WINDOW_MS)).toEqual([]);
        expect(ladder.quality).toBe('full');
    });

    it('treats a paused tab as a pause, not as a slow frame', () => {
        const ladder = createLadder('full');
        expect(ladder.sample(5_000, TARGET)).toBeNull();
        expect(ladder.quality).toBe('full');
    });

    it('earns a step back up only after a long run of good frames, and never above where it started', () => {
        const ladder = createLadder('full');
        feed(ladder, TARGET * 2, WINDOW_MS);
        expect(ladder.quality).toBe('lite');
        expect(feed(ladder, TARGET, UPGRADE_MS - WINDOW_MS)).toEqual([]);
        expect(feed(ladder, TARGET, WINDOW_MS * 2)).toEqual(['full']);
        expect(feed(ladder, TARGET, UPGRADE_MS * 2)).toEqual([]);
        expect(ladder.quality).toBe('full');
    });

    it('does not flap: a level that fails twice is never tried again', () => {
        const ladder = createLadder('full');
        for (let round = 0; round < MAX_FAILS; round += 1) {
            feed(ladder, TARGET * 2, WINDOW_MS);
            expect(ladder.quality).toBe('lite');
            feed(ladder, TARGET, UPGRADE_MS + WINDOW_MS);
        }
        expect(ladder.quality).toBe('lite');
        expect(feed(ladder, TARGET, UPGRADE_MS * 3)).toEqual([]);
        expect(ladder.quality).toBe('lite');
    });

    it('gives the canvas up when even still frames take too long to land', () => {
        const ladder = createLadder('still');
        expect(ladder.still(SLOW_STILL_MS + 50)).toBeNull();
        expect(ladder.still(SLOW_STILL_MS + 50)).toBeNull();
        expect(ladder.still(SLOW_STILL_MS + 50)).toBe('plain');
        expect(ladder.sample(10, TARGET)).toBeNull();
    });
});
