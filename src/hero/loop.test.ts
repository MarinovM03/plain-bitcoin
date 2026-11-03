import { describe, expect, it } from 'vitest';
import { LITE, STILL, TIER_SETTINGS } from './degrade.ts';
import { easeToward, frameInterval, frameMode, MAX_STEP_S, moodSettling, stepSeconds } from './loop.ts';
import { tensionAt } from './weather.ts';

const base = { visible: true, reduced: false, quality: 'full', dirty: false, animating: false, lost: false } as const;
const full = TIER_SETTINGS.full;

describe('render loop gate', () => {
    it('keeps the weather drifting at the ambient rate while the page is visible and nothing else moves', () => {
        expect(frameMode(base, full)).toBe('ambient');
        expect(frameInterval('ambient', full)).toBeCloseTo(1000 / full.ambientFps);
        expect(frameMode({ ...base, quality: 'lite' }, LITE)).toBe('ambient');
    });

    it('raises to the active rate for a morph or a pulse, and never asks for 60 fps', () => {
        expect(frameMode({ ...base, animating: true }, full)).toBe('active');
        for (const settings of [full, TIER_SETTINGS.phone, LITE]) expect(settings.activeFps).toBeLessThanOrEqual(30);
    });

    it('sleeps when the page is hidden, the context is lost or the canvas was given up', () => {
        expect(frameMode({ ...base, visible: false, dirty: true }, full)).toBe('sleep');
        expect(frameMode({ ...base, lost: true, dirty: true }, full)).toBe('sleep');
        expect(frameMode({ ...base, quality: 'plain', dirty: true }, full)).toBe('sleep');
    });

    it('under reduced motion or a still quality, draws once per change and then sleeps', () => {
        expect(frameMode({ ...base, reduced: true, dirty: true }, full)).toBe('once');
        expect(frameMode({ ...base, reduced: true, animating: true }, full)).toBe('sleep');
        expect(frameMode({ ...base, quality: 'still', dirty: true }, STILL)).toBe('once');
        expect(frameMode({ ...base, quality: 'still' }, STILL)).toBe('sleep');
    });

    it('is time based and clamps the step, so a resumed tab never jumps the field', () => {
        expect(stepSeconds(0, 5_000)).toBe(0);
        expect(stepSeconds(1_000, 1_050)).toBeCloseTo(0.05);
        expect(stepSeconds(1_000, 60_000)).toBe(MAX_STEP_S);
    });

    it('treats the slow creep of the chain mood as ambient even at 6 fps, and a block reset as active', () => {
        // The CI case: estimated tip just after a block, so tension climbs at its steepest, on a slow software GPU.
        for (const fps of [6, 20, 30]) {
            const frame = 1000 / fps;
            let now = 0;
            let mood = tensionAt(0);
            for (let i = 0; i < fps * 30; i += 1) {
                now += frame;
                mood = easeToward(mood, tensionAt(now / 60_000), stepSeconds(now - frame, now));
            }
            expect(moodSettling(mood, tensionAt(now / 60_000)), `${fps} fps`).toBe(false);
        }
        expect(moodSettling(tensionAt(14), tensionAt(0))).toBe(true);
    });

    it('settles from the startup jump (10-minute fallback to a fresh block) within 6 s at any rate down to 4 fps', () => {
        for (const fps of [4, 6, 20]) {
            const frame = 1000 / fps;
            let now = 0;
            let mood = tensionAt(10);
            let ambientAt = Number.POSITIVE_INFINITY;
            for (let i = 0; i < fps * 20; i += 1) {
                now += frame;
                const goal = tensionAt(now / 60_000);
                mood = easeToward(mood, goal, stepSeconds(now - frame, now));
                if (!moodSettling(mood, goal)) ambientAt = Math.min(ambientAt, now);
                else ambientAt = Number.POSITIVE_INFINITY;
            }
            expect(ambientAt, `${fps} fps`).toBeLessThan(6_000);
        }
    });
});
