import { heightFeed, type Tip } from '../../data/height.ts';
import { SATS_PER_BTC, supplyAt } from '../../model/supply.ts';
import { LEFT_PAGE } from '../../ui/copy.ts';
import { btcParts, formatAge, formatBtcExact, formatWhole } from '../../util/format.ts';

export function supplyLines(height: number): [string, string] {
    const supply = supplyAt(height);
    return [
        LEFT_PAGE.mined(formatWhole(Math.floor(supply.issued / SATS_PER_BTC))),
        LEFT_PAGE.halving(supply.blocksToHalving),
    ];
}

export function tipAge(tip: Tip, now = Date.now()): string | null {
    if (tip.time === null) return null;
    return formatAge((now - Math.min(tip.time * 1000, tip.seenAt)) / 1000);
}

export function tipLine(tip: Tip, now = Date.now()): string {
    const height = formatWhole(tip.height);
    if (tip.source === 'checking') return LEFT_PAGE.checking(height);
    if (tip.source === 'offline') return LEFT_PAGE.offline(height);
    const reward = formatBtcExact(supplyAt(tip.height).subsidy);
    const age = tipAge(tip, now);
    return age === null ? LEFT_PAGE.live(height, reward) : LEFT_PAGE.liveAgo(height, reward, age);
}

export function arrivalLine(height: number, blocks: number): string {
    const added = formatBtcExact(supplyAt(height).issued - supplyAt(height - blocks).issued);
    if (blocks === 1) return LEFT_PAGE.live(formatWhole(height), added);
    return LEFT_PAGE.liveMany(formatWhole(height - blocks + 1), formatWhole(height), added);
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

export function mountCounter(root: HTMLElement, announce: (message: string) => void): () => void {
    const figure = root.querySelector<HTMLElement>('#left-figure');
    const supply = root.querySelector<HTMLElement>('#left-supply');
    const note = root.querySelector<HTMLElement>('#left-note');
    const heights = heightFeed();
    let tip = heights.tip;
    let ticker = 0;

    function renderFigure(): void {
        if (!figure || !supply) return;
        const parts = btcParts(supplyAt(tip.height).left);
        figure.replaceChildren(
            span('result__whole', parts.whole),
            span('result__fraction', parts.fraction ? `.${parts.fraction}` : ''),
            span('result__unit', LEFT_PAGE.unit),
        );
        supply.replaceChildren(...supplyLines(tip.height).map((line) => span('result__line', line)));
    }

    function renderNote(): void {
        if (note) note.textContent = tipLine(tip);
    }

    function setTicking(): void {
        window.clearInterval(ticker);
        ticker = note && !document.hidden ? window.setInterval(renderNote, 1000) : 0;
    }

    renderFigure();
    renderNote();
    setTicking();
    document.addEventListener('visibilitychange', setTicking);
    const unsubscribe = heights.subscribe((next, change) => {
        tip = next;
        renderFigure();
        renderNote();
        if (change.blocks > 0) announce(arrivalLine(next.height, change.blocks));
    });

    return () => {
        unsubscribe();
        document.removeEventListener('visibilitychange', setTicking);
        window.clearInterval(ticker);
    };
}
