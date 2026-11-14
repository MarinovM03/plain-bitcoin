import type { ChainEffect } from '../chain/machine.ts';
import type { Station } from '../chain/view.ts';
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
    /** Sends the camera to the place that belongs to a page. */
    travel(station: Station): void;
    /** How far down the home page the reader is, 0 to 1: the camera walks the chain with them. */
    scroll(progress: number): void;
}

/**
 * The one door between the page and the lit world behind it. The page hands over real blocks and says which page
 * is open; the world is loaded after first paint, draws only what it is handed, and is never asked anything back.
 */
export function mountHero(host: HTMLElement, after: (task: () => void) => void): Hero {
    let latest: HeroFrame | null = null;
    let station: Station = 'home';
    let progress = 0;
    let running: Hero | null = null;

    after(() => {
        import('./stage.ts')
            .then(({ runHero }) => {
                running = runHero(host);
                running.travel(station);
                running.scroll(progress);
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
        travel(next) {
            station = next;
            running?.travel(next);
        },
        scroll(next) {
            progress = next;
            running?.scroll(next);
        },
    };
}
