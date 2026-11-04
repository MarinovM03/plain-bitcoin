import { gauge, safeView } from './marks.ts';
import type { Gauge, GaugeLayout, SceneData, SceneId, Viewport } from './types.ts';

const home: GaugeLayout = (_, view) => gauge(safeView(view), { rebuild: 'home', summary: '' });

function load(id: SceneId): Promise<GaugeLayout> {
    switch (id) {
        case 'home':
            return Promise.resolve(home);
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
