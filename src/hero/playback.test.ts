import { describe, expect, it } from 'vitest';
import { createPlayback, type Scene } from './playback.ts';

function recordingScene() {
    const calls: string[] = [];
    const scene: Scene = {
        start: () => calls.push('start'),
        stop: () => calls.push('stop'),
        dispose: () => calls.push('dispose'),
    };
    return { scene, calls };
}

describe('createPlayback', () => {
    it('runs only while on screen and the tab is visible', () => {
        const { scene, calls } = recordingScene();
        const playback = createPlayback(scene, true);
        expect(playback.running).toBe(false);

        playback.setOnScreen(true);
        playback.setPageVisible(false);
        playback.setPageVisible(true);
        playback.setOnScreen(false);

        expect(calls).toEqual(['start', 'stop', 'start', 'stop']);
        expect(playback.running).toBe(false);
    });

    it('never starts in a hidden tab until it becomes visible', () => {
        const { scene, calls } = recordingScene();
        const playback = createPlayback(scene, false);
        playback.setOnScreen(true);
        expect(calls).toEqual([]);
        playback.setPageVisible(true);
        expect(calls).toEqual(['start']);
    });

    it('ignores repeated signals', () => {
        const { scene, calls } = recordingScene();
        const playback = createPlayback(scene, true);
        playback.setOnScreen(true);
        playback.setOnScreen(true);
        playback.setPageVisible(true);
        expect(calls).toEqual(['start']);
    });

    it('stops before disposing, once, and stays dead', () => {
        const { scene, calls } = recordingScene();
        const playback = createPlayback(scene, true);
        playback.setOnScreen(true);
        playback.dispose();
        playback.dispose();
        playback.setOnScreen(true);
        expect(calls).toEqual(['start', 'stop', 'dispose']);
    });
});
