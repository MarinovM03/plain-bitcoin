import { createHeightFeed, type HeightFeed, type Tip } from '../../data/height.ts';
import { type HeroHandle, type HeroShot, mountHero } from '../../hero/index.ts';
import { supplyAt } from '../../model/supply.ts';
import { HERO } from '../../ui/copy.ts';
import { afterFirstPaint } from '../../util/dom.ts';
import { btcParts, formatAge, formatBtcExact, formatWhole } from '../../util/format.ts';

let feed: HeightFeed | null = null;

export function heightFeed(): HeightFeed {
    feed ??= createHeightFeed({
        fetch: (url, init) => window.fetch(url, init),
        now: () => Date.now(),
        isOnline: () => navigator.onLine,
    });
    return feed;
}

export function tipAge(tip: Tip, now = Date.now()): string | null {
    if (tip.time === null) return null;
    return formatAge((now - Math.min(tip.time * 1000, tip.seenAt)) / 1000);
}

export function tipLine(tip: Tip, now = Date.now()): string {
    const height = formatWhole(tip.height);
    if (tip.source === 'checking') return HERO.checking(height);
    if (tip.source === 'offline') return HERO.offline(height);
    const reward = formatBtcExact(supplyAt(tip.height).subsidy);
    const age = tipAge(tip, now);
    return age === null ? HERO.live(height, reward) : HERO.liveAgo(height, reward, age);
}

export function arrivalLine(height: number, blocks: number): string {
    const added = formatBtcExact(supplyAt(height).issued - supplyAt(height - blocks).issued);
    if (blocks === 1) return HERO.live(formatWhole(height), added);
    return HERO.liveMany(formatWhole(height - blocks + 1), formatWhole(height), added);
}

function span(className: string, text: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
}

export function watchActive(target: Element, onChange: (active: boolean) => void): () => void {
    let onScreen = false;
    const sync = () => onChange(onScreen && !document.hidden);
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        sync();
    });
    observer.observe(target);
    document.addEventListener('visibilitychange', sync);
    return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
        onChange(false);
    };
}

export function mountCounter(root: HTMLElement, shot: HeroShot, announce: (message: string) => void): () => void {
    const hero = root.querySelector<HTMLElement>('.hero');
    const stage = root.querySelector<HTMLElement>('#hero-stage');
    const figure = root.querySelector<HTMLElement>('#hero-figure');
    const note = root.querySelector<HTMLElement>('#hero-note');
    if (!hero || !stage || !figure || !note) return () => {};

    const heights = heightFeed();
    const owner = {};
    let tip = heights.tip;
    let ticker = 0;

    function renderFigure(): void {
        const parts = btcParts(supplyAt(tip.height).left);
        figure?.replaceChildren(
            span('hero__whole', parts.whole),
            span('hero__fraction', parts.fraction ? `.${parts.fraction}` : ''),
            span('hero__unit', ' BTC'),
        );
    }

    function renderNote(): void {
        if (note) note.textContent = tipLine(tip);
    }

    function setTicking(on: boolean): void {
        window.clearInterval(ticker);
        ticker = on ? window.setInterval(renderNote, 1000) : 0;
    }

    renderFigure();
    renderNote();
    let shown = supplyAt(tip.height).issued;
    let disposed = false;
    let stop = () => {};

    // Live requests and the hero wait for the first paint, so neither competes with it on a slow phone.
    afterFirstPaint(() => {
        if (disposed) return;
        const scene: HeroHandle = mountHero(stage, shot, shown);
        const unsubscribe = heights.subscribe((next, change) => {
            tip = next;
            renderFigure();
            renderNote();
            const issued = supplyAt(next.height).issued;
            if (issued !== shown) scene.setIssued(issued, change.blocks > 0);
            shown = issued;
            if (change.blocks > 0) announce(arrivalLine(next.height, change.blocks));
        });
        const unwatch = watchActive(hero, (active) => {
            heights.setActive(owner, active);
            setTicking(active);
            if (active) renderNote();
        });
        stop = () => {
            unwatch();
            unsubscribe();
            scene.dispose();
        };
    });

    return () => {
        disposed = true;
        stop();
        setTicking(false);
    };
}
