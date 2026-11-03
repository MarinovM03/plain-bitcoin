import { type SceneData, stage } from '../hero/bus.ts';
import { find } from '../util/dom.ts';

export interface SceneLink {
    set(data: SceneData | (() => SceneData), caption: string): void;
    dispose(): void;
}

export function linkScene(root: ParentNode): SceneLink {
    const plot = find(root, '#scene-plot');
    const caption = find(root, '#scene-caption');
    const scene = plot.closest<HTMLElement>('.scene');
    let shown = false;
    let pending: SceneData | (() => SceneData) | null = null;
    let frame = 0;

    // The answer is written in the input handler; the picture follows on the next frame, once per frame.
    function flush(): void {
        frame = 0;
        if (!pending) return;
        const data = typeof pending === 'function' ? pending() : pending;
        pending = null;
        if (scene) delete scene.dataset.pending;
        if (shown) stage.update(data);
        else stage.show(plot, data);
        shown = true;
    }

    return {
        set(data, text) {
            caption.textContent = text;
            pending = data;
            // Marks the window as behind the answer until the payload goes out, so nothing reads it as settled.
            if (scene) scene.dataset.pending = '';
            frame ||= requestAnimationFrame(flush);
        },
        dispose() {
            cancelAnimationFrame(frame);
            frame = 0;
            pending = null;
        },
    };
}
