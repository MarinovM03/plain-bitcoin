import type { SceneFactory, SceneId } from './types.ts';

/** Each route's scene is its own chunk: only the scene on screen is ever fetched. */
export function loadScene(id: SceneId): Promise<SceneFactory> {
    switch (id) {
        case 'home':
            return import('./home.ts').then((module) => module.createHome);
        case 'left':
            return import('./left.ts').then((module) => module.createLeft);
        case 'power':
            return import('./power.ts').then((module) => module.createPower);
        case 'convert':
            return import('./convert.ts').then((module) => module.createConvert);
        case 'dca':
            return import('./dca.ts').then((module) => module.createDca);
        case 'address':
            return import('./address.ts').then((module) => module.createAddress);
    }
}
