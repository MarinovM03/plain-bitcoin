import { type SceneData, stage } from '../hero/bus.ts';
import { find } from '../util/dom.ts';

export interface SceneLink {
    set(data: SceneData, caption: string): void;
}

export function linkScene(root: ParentNode): SceneLink {
    const plot = find(root, '#scene-plot');
    const caption = find(root, '#scene-caption');
    let shown = false;
    return {
        set(data, text) {
            caption.textContent = text;
            if (shown) stage.update(data);
            else stage.show(plot, data);
            shown = true;
        },
    };
}
