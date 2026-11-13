import type { ChainEffect } from '../chain/machine.ts';
import type { ChainBlock } from '../data/height.ts';

export interface HeroFrame {
    /** Newest first. */
    readonly blocks: readonly ChainBlock[];
    /** The newest block's timestamp in seconds when a live feed vouches for it; null draws no forming block. */
    readonly formingSince: number | null;
    readonly effect: ChainEffect;
}

export interface Hero {
    show(frame: HeroFrame): void;
    dispose(): void;
}

/**
 * The one door between the page and the lit scene. The page hands over real blocks; the scene is loaded after
 * first paint, draws only what it is handed, and is never asked anything back.
 */
export function mountHero(host: HTMLElement, after: (task: () => void) => void): Hero {
    let latest: HeroFrame | null = null;
    let running: Hero | null = null;
    let disposed = false;

    after(() => {
        if (disposed) return;
        import('./stage.ts')
            .then(({ runHero }) => {
                if (disposed) return;
                running = runHero(host);
                if (latest) running.show({ ...latest, effect: 'replay' });
            })
            .catch(() => {
                host.dataset.hero = 'still';
            });
    });

    return {
        show(frame) {
            latest = frame;
            running?.show(frame);
        },
        dispose() {
            disposed = true;
            running?.dispose();
            running = null;
        },
    };
}
