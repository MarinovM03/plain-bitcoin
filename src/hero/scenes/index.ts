import { emptyLayout, type SceneId, type SceneLayout } from './types.ts';

const home: SceneLayout = () => emptyLayout(0, 'home');

export function loadLayout(id: SceneId): Promise<SceneLayout> {
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
