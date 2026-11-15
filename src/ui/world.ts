import type { RouteId } from '../app/routes.ts';
import { knownPlan, loadPlan } from '../backdrop/index.ts';
import { planStill } from '../backdrop/still.ts';
import type { BackdropData } from '../backdrop/types.ts';
import { hashBits } from '../chain/hash.ts';
import { advanceChain, type ChainEffect, EMPTY_CHAIN } from '../chain/machine.ts';
import { chainStill } from '../chain/still.ts';
import { type ChainBlock, heightFeed, type Tip } from '../data/height.ts';
import { mountHero, onBackdrop } from '../hero/bus.ts';
import { TOKENS } from '../styles/tokens.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import { formatWhole } from '../util/format.ts';
import { CHAIN } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { LIVE_ROUTES } from './status.ts';

export interface ChainView {
    /** Newest first. */
    readonly blocks: readonly ChainBlock[];
    /** The day the shown blocks were saved, when no API vouches for them on this visit. */
    readonly savedOn: string | null;
    /** The newest block's own timestamp, only while a live feed stands behind it. */
    readonly formingSince: number | null;
    readonly tip: Tip;
}

export interface World {
    setRoute(route: RouteId): void;
    /** Calls back now and on every change to the blocks behind the page. */
    subscribe(listener: (view: ChainView) => void): () => void;
}

const STILL_COLOURS = {
    btc: TOKENS.btc,
    warm: TOKENS.inkWarm,
    cool: TOKENS.inkCool,
    good: TOKENS.good,
    dim: TOKENS.inkDim,
} as const;

/**
 * The world's place in the page: fixed behind everything, hidden from assistive tech and from every pointer. The
 * drawn still sits in it from the first paint; the lit scene's canvas covers the still once it runs.
 */
export function renderWorld(): SafeHtml {
    return html`<div id="chain" class="world" data-hero="still" aria-hidden="true"><div id="chain-still" class="world__still"></div></div>`;
}

/**
 * Runs the world behind every page: the chain on home, and each tool's own picture, drawn from the numbers the
 * tool hands over. Live blocks come from the shared height feed on the pages that poll it; a page that fetches
 * nothing uses a saved set of real blocks instead.
 */
export function mountWorld(host: HTMLElement, announce: (message: string) => void): World {
    const heights = heightFeed();
    const stillLayer = find(host, '#chain-still');
    const hero = mountHero(host, afterFirstPaint);
    const listeners = new Set<(view: ChainView) => void>();
    let chain = EMPTY_CHAIN;
    let savedOn: string | null = null;
    let savedAsked = false;
    let started = false;
    let route: RouteId = 'home';
    let numbers: BackdropData | null = null;

    function formingSince(tip: Tip): number | null {
        const first = chain.blocks[0];
        if (savedOn !== null || tip.source !== 'live' || !first || first.height !== tip.height) return null;
        return first.time ?? tip.time;
    }

    const view = (): ChainView => ({
        blocks: chain.blocks,
        savedOn,
        formingSince: formingSince(heights.tip),
        tip: heights.tip,
    });

    function renderStill(): void {
        const { clientWidth: width, clientHeight: height } = host;
        if (width < 2 || height < 2) return;
        if (route !== 'home') {
            const id = route;
            const plan = knownPlan(id);
            if (!plan) {
                stillLayer.replaceChildren();
                loadPlan(id).then(renderStill, () => {});
                return;
            }
            stillLayer.innerHTML = planStill(id, plan(numbers, width / height), { width, height }, STILL_COLOURS);
            return;
        }
        if (chain.blocks.length === 0) return;
        const since = formingSince(heights.tip);
        stillLayer.innerHTML = chainStill(chain.blocks, {
            width,
            height,
            nowSeconds: since === null ? null : Date.now() / 1000,
            forming: since !== null,
            ink: TOKENS.void,
        });
    }

    function take(blocks: readonly ChainBlock[]): ChainEffect {
        const { state, effect } = advanceChain(chain, blocks);
        chain = state;
        const since = formingSince(heights.tip);
        hero.show({ blocks: chain.blocks, formingSince: since, effect });
        host.dataset.advances = String(chain.advances);
        host.dataset.tip = String(chain.blocks[0]?.height ?? '');
        host.dataset.bits = String(hashBits(chain.blocks[0]?.hash ?? null).reduce((count, bit) => count + bit, 0));
        renderStill();
        return effect;
    }

    function publish(): void {
        const now = view();
        if (now.blocks.length > 0) {
            host.dataset.state = now.savedOn !== null ? 'saved' : now.formingSince === null ? 'stale' : 'live';
        }
        for (const listener of listeners) listener(now);
    }

    function askSaved(): void {
        if (!started || savedAsked || chain.blocks.length > 0) return;
        if (LIVE_ROUTES.has(route) && heights.tip.source !== 'offline') return;
        savedAsked = true;
        import('../data/chain-snapshot.ts')
            .then(({ SNAPSHOT }) => {
                if (chain.blocks.length > 0) return;
                savedOn = SNAPSHOT.asOf;
                take(SNAPSHOT.blocks);
                publish();
            })
            .catch(() => {});
    }

    function onTip(tip: Tip): void {
        if (tip.blocks.length > 0) {
            // Live blocks replace a saved set outright: nothing was "just found".
            if (savedOn !== null) chain = EMPTY_CHAIN;
            savedOn = null;
            const effect = take(tip.blocks);
            if (effect === 'snap' && route === 'home') announce(CHAIN.arrived(formatWhole(tip.height)));
        }
        askSaved();
        publish();
    }

    new ResizeObserver(renderStill).observe(host);
    onBackdrop((data) => {
        if (data.id !== route) return;
        numbers = data;
        hero.backdrop(data);
        renderStill();
    });
    heights.subscribe(onTip);
    onTip(heights.tip);
    afterFirstPaint(() => {
        started = true;
        askSaved();
    });

    return {
        setRoute(next) {
            if (next !== route) {
                numbers = null;
                hero.backdrop(null);
            }
            route = next;
            hero.open(next);
            renderStill();
            askSaved();
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(view());
            return () => listeners.delete(listener);
        },
    };
}
