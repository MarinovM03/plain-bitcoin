import type { LevelSettings, Quality } from './degrade.ts';

export interface LoopState {
    visible: boolean;
    reduced: boolean;
    quality: Quality;
    /** Something changed that has not been drawn yet: a new scene, a resize, a chain update. */
    dirty: boolean;
    /** A morph, pulse, intro or pointer light is still moving. */
    animating: boolean;
    lost: boolean;
}

export type FrameMode = 'sleep' | 'once' | 'ambient' | 'active';

/**
 * Whether the stage draws, and how often. The weather always drifts while it can be seen; it sleeps when the page is
 * hidden, the context is lost or the canvas has been given up; under reduced motion or a still quality it draws
 * exactly once per change and never animates.
 */
export function frameMode(state: LoopState, settings: LevelSettings): FrameMode {
    if (!state.visible || state.lost || state.quality === 'plain') return 'sleep';
    const calm = state.reduced || state.quality === 'still' || settings.ambientFps <= 0;
    if (calm) return state.dirty ? 'once' : 'sleep';
    return state.dirty || state.animating ? 'active' : 'ambient';
}

export function frameInterval(mode: FrameMode, settings: LevelSettings): number {
    if (mode === 'active') return 1000 / settings.activeFps;
    if (mode === 'ambient') return 1000 / settings.ambientFps;
    return 0;
}

/** Longest step the clock may take between two frames, so a resumed tab never jumps the field forward. */
export const MAX_STEP_S = 0.1;

export function stepSeconds(lastDraw: number, now: number): number {
    if (!(lastDraw > 0) || !(now > lastDraw)) return 0;
    return Math.min(MAX_STEP_S, (now - lastDraw) / 1000);
}
