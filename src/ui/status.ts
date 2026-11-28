import { estimateTip, heightFeed, type Tip } from '../data/height.ts';
import { LAST_CLOSE, LAST_CLOSE_SOURCE, PRICE_STALE_MS, type PriceQuote, priceFeed } from '../data/price.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import { formatMinutes, formatMoney, formatShortDay, formatUtcClock, formatWhole } from '../util/format.ts';
import { FOOTER, STATUS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export const LIVE_ROUTES: ReadonlySet<string> = new Set([
    'home',
    'miner',
    'left',
    'halving',
    'tx',
    'fees',
    'convert',
    'stack',
]);

const AGE_TICK_MS = 15_000;
const BLOCK_SECONDS = 600;
const SOURCE_URLS: Record<PriceQuote['source'], string> = {
    'mempool.space': 'https://mempool.space/',
    CoinGecko: 'https://www.coingecko.com/',
    'last close': LAST_CLOSE_SOURCE.url,
};

export interface StatusView {
    block: string;
    estimated: boolean;
    usd: string;
    age: string;
    source: string;
    sourceUrl: string;
    live: boolean;
}

export function blockAge(tip: Pick<Tip, 'source' | 'time'>, now: number): string {
    if (tip.time === null) return STATUS.unknownTime;
    const age = formatMinutes(now / 1000 - tip.time);
    return tip.source === 'live' ? STATUS.since(age) : STATUS.estimatedSince(age);
}

/** Share of the ten-minute average block interval that has passed since the last block, 0..1; 0 when the time is unknown. */
export function blockProgress(tip: Pick<Tip, 'time'>, now: number): number {
    if (tip.time === null) return 0;
    return Math.min(1, Math.max(0, (now / 1000 - tip.time) / BLOCK_SECONDS));
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
        estimated: tip.source !== 'live',
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
        <span id="status-block" class="status__item status__figure status__block">${view.block}</span>
        <span class="status__item status__price"><span class="visually-hidden">${STATUS.price}</span><span id="status-usd" class="status__figure">${view.usd}</span></span>
        <span id="status-age" class="status__item status__age" title="${FOOTER.timer}">${view.age}</span>
        <a id="status-source" class="status__item status__source" href="${view.sourceUrl}" rel="noopener noreferrer">${view.source}</a>
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
    const usd = find(root, '#status-usd');
    const age = find(root, '#status-age');
    const source = find<HTMLAnchorElement>(root, '#status-source');
    const timer = document.getElementById('block-timer');
    let receivedAt = Number.NEGATIVE_INFINITY;
    let route = '';
    let started = false;
    let ticks = 0;
    let ticker = 0;
    let timerSource = '';

    function render(): void {
        const now = Date.now();
        const view = statusView(heights.tip, prices.quote, now - receivedAt > PRICE_STALE_MS, now);
        block.textContent = view.block;
        usd.textContent = view.usd;
        age.textContent = view.age;
        source.textContent = view.source;
        source.href = view.sourceUrl;
        root.dataset.state = view.live ? 'live' : 'estimate';
        if (!timer) return;
        if (heights.tip.source !== timerSource) {
            timerSource = heights.tip.source;
            timer.classList.remove('is-running');
        }
        const progress = heights.tip.source === 'live' ? blockProgress(heights.tip, now) : 0;
        timer.style.setProperty('--block-progress', String(progress));
        // The first value, a new source and the drop after a new block land at once; only the steady fill glides between ticks.
        if (progress > 0 && !timer.classList.contains('is-running')) {
            window.setTimeout(() => timer.classList.add('is-running'), 100);
        }
    }

    function tick(): void {
        ticks += 1;
        block.dataset.ticks = String(ticks);
        block.classList.remove('is-tick');
        void block.offsetWidth;
        block.classList.add('is-tick');
        if (!timer) return;
        timer.classList.remove('is-running', 'is-new');
        void timer.offsetWidth;
        timer.classList.add('is-new');
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
        if (change.blocks > 0 && tip.source === 'live') tick();
        render();
    });
    document.addEventListener('visibilitychange', sync);
    afterFirstPaint(() => {
        started = true;
        sync();
    });
    render();

    return {
        setRoute(next) {
            route = next;
            sync();
        },
    };
}
