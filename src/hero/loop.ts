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

/** Longest step the clock may take between two frames: real time down to 4 fps, so a slow GPU samples the drift less often but never slows it; a resumed tab restarts the clock and never jumps. */
export const MAX_STEP_S = 0.25;

export function stepSeconds(lastDraw: number, now: number): number {
    if (!(lastDraw > 0) || !(now > lastDraw)) return 0;
    return Math.min(MAX_STEP_S, (now - lastDraw) / 1000);
}

/** Time constant of the field's mood easing towards what the chain state asks for. */
export const MOOD_SECONDS = 0.83;
/**
 * How far, in tension (0..1), the eased mood may trail its goal and still count as ambient. The goal itself creeps
 * as minutes pass; trailing that creep is the ambient state, at any frame rate. Only a real jump, such as the reset
 * after a new block or the first chain reading, is an animation worth the active rate.
 */
export const MOOD_EPSILON = 0.02;

export function easeToward(current: number, goal: number, dt: number): number {
    return current + (goal - current) * (1 - Math.exp(-Math.max(0, dt) / MOOD_SECONDS));
}

export function moodSettling(currentTension: number, goalTension: number): boolean {
    return Math.abs(goalTension - currentTension) > MOOD_EPSILON;
}
