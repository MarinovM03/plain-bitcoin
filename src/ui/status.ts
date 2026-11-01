import { estimateTip, heightFeed, type Tip } from '../data/height.ts';
import { LAST_CLOSE, LAST_CLOSE_SOURCE, PRICE_STALE_MS, type PriceQuote, priceFeed } from '../data/price.ts';
import { type ChainState, stage } from '../hero/bus.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import { formatMinutes, formatMoney, formatShortDay, formatUtcClock, formatWhole } from '../util/format.ts';
import { STATUS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export const LIVE_ROUTES: ReadonlySet<string> = new Set(['home', 'left', 'convert']);

const AGE_TICK_MS = 15_000;
const SOURCE_URLS: Record<PriceQuote['source'], string> = {
    'mempool.space': 'https://mempool.space/',
    CoinGecko: 'https://www.coingecko.com/',
    'last close': LAST_CLOSE_SOURCE.url,
};

export interface StatusView {
    block: string;
    gbp: string;
    usd: string;
    age: string;
    source: string;
    sourceUrl: string;
    live: boolean;
}

export function chainState(tip: Pick<Tip, 'height' | 'source' | 'time'>): ChainState {
    return {
        height: tip.height,
        blockTime: tip.time === null ? null : tip.time * 1000,
        estimated: tip.source !== 'live',
    };
}

export function blockAge(tip: Pick<Tip, 'source' | 'time'>, now: number): string {
    if (tip.time === null) return STATUS.unknownTime;
    const age = formatMinutes(now / 1000 - tip.time);
    return tip.source === 'live' ? STATUS.since(age) : STATUS.estimatedSince(age);
}

export function statusView(
    tip: Pick<Tip, 'height' | 'source' | 'time'>,
    quote: PriceQuote,
    stale: boolean,
    now: number,
): StatusView {
    const block = STATUS.block(formatWhole(tip.height)) + (tip.source === 'live' ? '' : STATUS.estimated);
    const common = {
        block,
        gbp: formatMoney(quote.value.gbp, 'GBP'),
        usd: formatMoney(quote.value.usd, 'USD'),
        age: blockAge(tip, now),
        sourceUrl: SOURCE_URLS[quote.source],
    };
    if (quote.source === 'last close') {
        return { ...common, source: STATUS.lastClose(formatShortDay(quote.asOf)), live: false };
    }
    const clock = formatUtcClock(quote.asOf);
    const old = stale || quote.stale;
    return {
        ...common,
        source: old ? STATUS.stale(quote.source, clock) : STATUS.live(quote.source, clock),
        live: !old && tip.source === 'live',
    };
}

export function renderStatus(now = Date.now()): SafeHtml {
    const view = statusView({ ...estimateTip(now), source: 'checking' }, LAST_CLOSE, true, now);
    return html`<div id="status" class="status" role="group" aria-label="${STATUS.label}" aria-live="off" data-state="estimate">
    <p class="status__line">
        <span class="status__dot" aria-hidden="true"></span>
        <span id="status-block" class="status__figure status__block" data-stage-origin>${view.block}</span>
        <span class="status__price"><span class="visually-hidden">${STATUS.price}</span><span id="status-gbp" class="status__figure">${view.gbp}</span><span class="status__usd"><span class="status__sep" aria-hidden="true">·</span><span id="status-usd" class="status__figure">${view.usd}</span></span></span>
        <span class="status__break" aria-hidden="true"></span>
        <span id="status-age" class="status__age">${view.age}</span>
        <a id="status-source" class="status__source" href="${view.sourceUrl}" rel="noopener noreferrer">${view.source}</a>
    </p>
</div>`;
}

export interface StatusLine {
    setRoute(route: string): void;
}

export function mountStatus(root: HTMLElement): StatusLine {
    const prices = priceFeed();
    const heights = heightFeed();
    const owner = {};
    const block = find(root, '#status-block');
    const gbp = find(root, '#status-gbp');
    const usd = find(root, '#status-usd');
    const age = find(root, '#status-age');
    const source = find<HTMLAnchorElement>(root, '#status-source');
    let receivedAt = Number.NEGATIVE_INFINITY;
    let route = '';
    let started = false;
    let ticks = 0;
    let ticker = 0;
    let shownAge = '';

    function render(): void {
        const now = Date.now();
        const view = statusView(heights.tip, prices.quote, now - receivedAt > PRICE_STALE_MS, now);
        block.textContent = view.block;
        gbp.textContent = view.gbp;
        usd.textContent = view.usd;
        age.textContent = view.age;
        source.textContent = view.source;
        source.href = view.sourceUrl;
        root.dataset.state = view.live ? 'live' : 'estimate';
        if (view.age !== shownAge && shownAge !== '') stage.chain(chainState(heights.tip), false);
        shownAge = view.age;
    }

    function tick(): void {
        ticks += 1;
        block.dataset.ticks = String(ticks);
        block.classList.remove('is-tick');
        void block.offsetWidth;
        block.classList.add('is-tick');
    }

    function sync(): void {
        const visible = !document.hidden;
        const active = started && LIVE_ROUTES.has(route) && visible;
        prices.setActive(owner, active);
        heights.setActive(owner, active);
        window.clearInterval(ticker);
        ticker = visible ? window.setInterval(render, AGE_TICK_MS) : 0;
        if (visible) render();
    }

    prices.subscribe((quote) => {
        if (quote.source !== 'last close' && !quote.stale) receivedAt = Date.now();
        render();
    });
    heights.subscribe((tip, change) => {
        const arrived = change.blocks > 0 && tip.source === 'live';
        if (arrived) tick();
        render();
        stage.chain(chainState(tip), arrived);
    });
    document.addEventListener('visibilitychange', sync);
    afterFirstPaint(() => {
        started = true;
        sync();
    });
    render();
    stage.chain(chainState(heights.tip), false);

    return {
        setRoute(next) {
            route = next;
            sync();
        },
    };
}
