import { describe, expect, it } from 'vitest';
import { LITE, STILL, TIER_SETTINGS } from './degrade.ts';
import { frameInterval, frameMode, MAX_STEP_S, stepSeconds } from './loop.ts';

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
});
