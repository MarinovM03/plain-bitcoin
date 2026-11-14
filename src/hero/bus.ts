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

export interface Field {
    /** The newest block's hash, or null while none is known: the squares then stay blank outlines. */
    setHash(hash: string | null): void;
    /** How strongly the field shows, 0 to 1: full on home, quieter behind a tool's plates. */
    setLevel(level: number): void;
}

/** The moving ground behind every page, loaded after first paint like the scene and handed one real hash. */
export function mountField(after: (task: () => void) => void): Field {
    let hash: string | null = null;
    let level = 1;
    let running: Field | null = null;

    after(() => {
        import('./field.ts')
            .then(({ runField }) => {
                running = runField();
                running.setLevel(level);
                running.setHash(hash);
            })
            .catch(() => {});
    });

    return {
        setHash(value) {
            hash = value;
            running?.setHash(value);
        },
        setLevel(value) {
            level = value;
            running?.setLevel(value);
        },
    };
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
