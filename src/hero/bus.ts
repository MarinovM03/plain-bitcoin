import type { ChainEffect } from '../chain/machine.ts';
import type { Focus } from '../chain/view.ts';
import type { ChainBlock } from '../data/height.ts';

export interface HeroFrame {
    /** Newest first. */
    readonly blocks: readonly ChainBlock[];
    /** The newest block's timestamp in seconds when a live feed vouches for it; null draws no forming block. */
    readonly formingSince: number | null;
    readonly effect: ChainEffect;
}

/** An amount as a stack of points in the world. Only a count and a place on the screen: never what was typed. */
export interface Pile {
    readonly points: number;
    /** Where new points fly in from, in screen units: x from -1 at the left to 1, y from -1 at the bottom to 1. */
    readonly from: readonly [number, number];
}

export interface Hero {
    show(frame: HeroFrame): void;
    /** Turns the world towards the page that is open. */
    open(focus: Focus): void;
    pile(next: Pile | null): void;
}

let listener: ((next: Pile | null) => void) | null = null;

/** A tool hands the world the amount its stack is made from. */
export function pile(next: Pile | null): void {
    listener?.(next);
}

export function onPile(next: (pile: Pile | null) => void): void {
    listener = next;
}

/**
 * The one door between the page and the lit world behind it. The page hands over real blocks, says which page is
 * open and passes on a count of points; the world is loaded after first paint, draws only what it is handed, and
 * is never asked anything back.
 */
export function mountHero(host: HTMLElement, after: (task: () => void) => void): Hero {
    let latest: HeroFrame | null = null;
    let focus: Focus = 'home';
    let stack: Pile | null = null;
    let running: Hero | null = null;

    after(() => {
        import('./stage.ts')
            .then(({ runHero }) => {
                running = runHero(host);
                running.open(focus);
                running.pile(stack);
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
            focus = next;
            running?.open(next);
        },
        pile(next) {
            stack = next;
            running?.pile(next);
        },
    };
}
