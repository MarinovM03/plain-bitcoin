import { gauge, safeView } from './marks.ts';
import type { Gauge, GaugeLayout, SceneData, SceneId, Viewport } from './types.ts';

/** Home's readout without the 3D stage is the supply bar at the real height: the same truth the diorama's stack holds. */
const home = (): Promise<GaugeLayout> =>
    import('./left.ts').then(
        ({ leftLayout }): GaugeLayout =>
            (data, view) =>
                leftLayout({ id: 'left', height: data.id === 'home' ? data.height : 0 }, view),
    );

function load(id: SceneId): Promise<GaugeLayout> {
    switch (id) {
        case 'home':
            return home();
        case 'left':
            return import('./left.ts').then((module) => module.leftLayout);
        case 'power':
            return import('./power.ts').then((module) => module.powerLayout);
        case 'convert':
            return import('./convert.ts').then((module) => module.convertLayout);
        case 'dca':
            return import('./dca.ts').then((module) => module.dcaLayout);
        case 'address':
            return import('./address.ts').then((module) => module.addressLayout);
    }
}

/** Every gauge's layout, guarded: a bad size or a NaN in the data draws an empty gauge, never a broken one. */
export function loadLayout(id: SceneId): Promise<(data: SceneData, view: Viewport) => Gauge> {
    return load(id).then((layout) => (data, view) => {
        const safe = safeView(view);
        try {
            return layout(data, safe);
        } catch {
            return gauge(safe, { rebuild: `${id}:error`, summary: 'error' });
        }
    });
}
