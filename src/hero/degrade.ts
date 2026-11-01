export const QUALITIES = ['full', 'half', 'still', 'plain'] as const;

export type Quality = (typeof QUALITIES)[number];

export const SLOW_FRAME_MS = 40;
export const WINDOW_MS = 2000;
export const SLOW_STILL_MS = 120;
const STILL_SAMPLES = 3;
const PAUSE_MS = 1000;
const SPIKE_MS = 100;

export interface FrameMonitor {
    readonly quality: Quality;
    sample(frameMs: number): Quality | null;
}

export function createFrameMonitor(start: Quality): FrameMonitor {
    let quality = start;
    let total = 0;
    let count = 0;

    function step(): Quality {
        quality = QUALITIES[Math.min(QUALITIES.length - 1, QUALITIES.indexOf(quality) + 1)] ?? 'plain';
        total = 0;
        count = 0;
        return quality;
    }

    return {
        get quality() {
            return quality;
        },
        sample(frameMs) {
            if (quality === 'plain' || !(frameMs >= 0) || frameMs > PAUSE_MS) return null;
            const still = quality === 'still';
            total += Math.min(frameMs, still ? frameMs : SPIKE_MS);
            count += 1;
            if (still ? count < STILL_SAMPLES : total < WINDOW_MS) return null;
            const slow = total / count > (still ? SLOW_STILL_MS : SLOW_FRAME_MS);
            if (slow) return step();
            total = 0;
            count = 0;
            return null;
        },
    };
}
