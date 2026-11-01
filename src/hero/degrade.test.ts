import { describe, expect, it } from 'vitest';
import { createFrameMonitor, SLOW_FRAME_MS, SLOW_STILL_MS, WINDOW_MS } from './degrade.ts';

function feed(monitor: ReturnType<typeof createFrameMonitor>, frameMs: number, totalMs: number) {
    const steps = [];
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) steps.push(monitor.sample(frameMs));
    return steps.filter((step) => step !== null);
}

describe('frame monitor', () => {
    it('holds its quality while frames keep to the 30 fps budget', () => {
        const monitor = createFrameMonitor('full');
        expect(feed(monitor, 34, 10_000)).toEqual([]);
        expect(monitor.quality).toBe('full');
    });

    it('drops to half resolution after about two seconds of slow frames, then to a still frame', () => {
        const monitor = createFrameMonitor('full');
        expect(feed(monitor, SLOW_FRAME_MS + 10, WINDOW_MS)).toEqual(['half']);
        expect(feed(monitor, SLOW_FRAME_MS + 10, WINDOW_MS)).toEqual(['still']);
        expect(monitor.quality).toBe('still');
    });

    it('waits for a full window before judging, so one long frame never degrades', () => {
        const monitor = createFrameMonitor('half');
        expect(monitor.sample(400)).toBeNull();
        expect(feed(monitor, 34, WINDOW_MS)).toEqual([]);
        expect(monitor.quality).toBe('half');
    });

    it('treats a paused tab as a pause, not as a slow frame', () => {
        const monitor = createFrameMonitor('full');
        expect(monitor.sample(5_000)).toBeNull();
        expect(monitor.quality).toBe('full');
    });

    it('gives up on the canvas when even still frames take too long to land', () => {
        const monitor = createFrameMonitor('still');
        expect(monitor.sample(SLOW_STILL_MS + 50)).toBeNull();
        expect(monitor.sample(SLOW_STILL_MS + 50)).toBeNull();
        expect(monitor.sample(SLOW_STILL_MS + 50)).toBe('plain');
        expect(monitor.sample(10)).toBeNull();
    });
});
