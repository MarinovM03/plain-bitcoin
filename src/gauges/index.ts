import { gauge, safeView } from './marks.ts';
import type { Gauge, GaugeLayout, SceneData, SceneId, Viewport } from './types.ts';

function load(id: SceneId): Promise<GaugeLayout> {
    switch (id) {
        case 'power':
            return import('./power.ts').then((module) => module.powerLayout);
        case 'dca':
        case 'stack':
            return import('./dca.ts').then((module) => module.dcaLayout);
        case 'address':
            return import('./address.ts').then((module) => module.addressLayout);
        case 'fees':
            return import('./fees.ts').then((module) => module.feesLayout);
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
