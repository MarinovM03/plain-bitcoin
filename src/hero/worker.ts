import type { TokenState } from './layout.ts';
import { createScene, type SceneControl, type SceneInit, type SceneSize, SoftwareRendererError } from './scene.ts';

export type HeroMessage =
    | { type: 'init'; canvas: OffscreenCanvas; init: SceneInit }
    | { type: 'resize'; size: SceneSize }
    | { type: 'tokens'; tokens: TokenState; arrived: boolean }
    | { type: 'tilt'; x: number; y: number }
    | { type: 'play'; running: boolean }
    | { type: 'dispose' };

export type HeroReply = { type: 'ready' } | { type: 'failed'; software: boolean };

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<HeroMessage>) => void) | null;
    postMessage(message: HeroReply): void;
    close(): void;
};

let control: SceneControl | null = null;
const queue: HeroMessage[] = [];

function apply(scene: SceneControl, message: HeroMessage): void {
    switch (message.type) {
        case 'resize':
            scene.resize(message.size);
            break;
        case 'tokens':
            scene.setTokens(message.tokens, message.arrived);
            break;
        case 'tilt':
            scene.setTilt(message.x, message.y);
            break;
        case 'play':
            if (message.running) scene.start();
            else scene.stop();
            break;
        case 'dispose':
            scene.dispose();
            scope.close();
            break;
        case 'init':
            break;
    }
}

scope.onmessage = (event) => {
    const message = event.data;
    if (message.type === 'init') {
        createScene(message.canvas, message.init).then(
            (scene) => {
                control = scene;
                for (const queued of queue.splice(0)) apply(scene, queued);
                scope.postMessage({ type: 'ready' });
            },
            (error: unknown) => scope.postMessage({ type: 'failed', software: error instanceof SoftwareRendererError }),
        );
        return;
    }
    if (control) apply(control, message);
    else queue.push(message);
};
