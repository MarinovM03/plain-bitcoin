import { HERO } from '../ui/copy.ts';
import { createPlayback, type Scene } from './playback.ts';
import { createScene } from './scene.ts';

function attach(stage: HTMLElement, scene: Scene): () => void {
    stage.removeAttribute('aria-hidden');
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', HERO.sceneLabel);

    const playback = createPlayback(scene, !document.hidden);
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) playback.setOnScreen(entry.isIntersecting);
    });
    const onVisibility = () => playback.setPageVisible(!document.hidden);
    observer.observe(stage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        playback.dispose();
    };
}

export function mountHero(stage: HTMLElement): () => void {
    let detach: (() => void) | null = null;
    let cancelled = false;

    void createScene(stage).then((scene) => {
        if (!scene) return;
        if (cancelled || !stage.isConnected) {
            scene.dispose();
            return;
        }
        detach = attach(stage, scene);
    });

    return () => {
        cancelled = true;
        detach?.();
    };
}
