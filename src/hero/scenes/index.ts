import {
    emptyLayout,
    type SceneData,
    type SceneId,
    type SceneLayout,
    safeAspect,
    sanitize,
    type Viewport,
} from './types.ts';

type Raw = (data: SceneData, view: Viewport) => ReturnType<SceneLayout>;

const home: Raw = () => emptyLayout(0, 'home');

function load(id: SceneId): Promise<Raw> {
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

/** Every scene's layout, guarded: a bad viewport or a NaN in the data can never reach the GPU or the SVG. */
export function loadLayout(id: SceneId): Promise<SceneLayout> {
    return load(id).then((raw) => (data, view) => {
        const safe = {
            aspect: safeAspect(view.aspect),
            pixels: Number.isFinite(view.pixels) && view.pixels > 0 ? view.pixels : 200,
        };
        try {
            return sanitize(raw(data, safe), safe.aspect);
        } catch {
            return emptyLayout(0, `${id}:error`);
        }
    });
}
