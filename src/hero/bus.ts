import type { BackdropData, BackdropId } from '../backdrop/types.ts';
import type { ChainEffect } from '../chain/machine.ts';
import type { ChainBlock } from '../data/height.ts';

/** One scene per page: the chain on home, and each tool's own picture. */
export type SceneId = 'home' | BackdropId;

export interface HeroFrame {
    /** Newest first. */
    readonly blocks: readonly ChainBlock[];
    /** The newest block's timestamp in seconds when a live feed vouches for it; null draws no forming block. */
    readonly formingSince: number | null;
    readonly effect: ChainEffect;
}

export interface Hero {
    show(frame: HeroFrame): void;
    /** Swaps to the scene that belongs to a page. */
    open(scene: SceneId): void;
    /** The open tool's own numbers, for its scene to draw. */
    backdrop(data: BackdropData | null): void;
}

let listener: ((data: BackdropData) => void) | null = null;

/** A tool hands the world the numbers its picture is made from. */
export function backdrop(data: BackdropData): void {
    listener?.(data);
}

export function onBackdrop(next: (data: BackdropData) => void): void {
    listener = next;
}

/**
 * The one door between the page and the lit world behind it. The page hands over real blocks, says which page is
 * open and passes on that page's numbers; the world is loaded after first paint, draws only what it is handed, and
 * is never asked anything back.
 */
export function mountHero(host: HTMLElement, after: (task: () => void) => void): Hero {
    let latest: HeroFrame | null = null;
    let scene: SceneId = 'home';
    let data: BackdropData | null = null;
    let running: Hero | null = null;

    after(() => {
        import('./stage.ts')
            .then(({ runHero }) => {
                running = runHero(host);
                running.open(scene);
                running.backdrop(data);
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
        open(next) {
            scene = next;
            running?.open(next);
        },
        backdrop(next) {
            data = next;
            running?.backdrop(next);
        },
    };
}
