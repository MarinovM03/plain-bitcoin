import { estimateTip, heightFeed, type Tip } from '../data/height.ts';
import { LAST_CLOSE, PRICE_STALE_MS, type PriceQuote, priceFeed } from '../data/price.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import { formatMoney, formatShortDay, formatUtcClock, formatWhole } from '../util/format.ts';
import { STATUS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export const LIVE_ROUTES: ReadonlySet<string> = new Set(['home', 'left', 'convert']);

export interface StatusView {
    block: string;
    gbp: string;
    usd: string;
    source: string;
    live: boolean;
}

export function statusView(tip: Pick<Tip, 'height' | 'source'>, quote: PriceQuote, stale: boolean): StatusView {
    const block = STATUS.block(formatWhole(tip.height)) + (tip.source === 'live' ? '' : STATUS.estimated);
    const gbp = formatMoney(quote.value.gbp, 'GBP');
    const usd = formatMoney(quote.value.usd, 'USD');
    if (quote.source === 'last close') {
        return { block, gbp, usd, source: STATUS.lastClose(formatShortDay(quote.asOf)), live: false };
    }
    const clock = formatUtcClock(quote.asOf);
    const old = stale || quote.stale;
    return {
        block,
        gbp,
        usd,
        source: old ? STATUS.stale(quote.source, clock) : STATUS.live(quote.source, clock),
        live: !old && tip.source === 'live',
    };
}

export function renderStatus(now = Date.now()): SafeHtml {
    const view = statusView({ ...estimateTip(now), source: 'checking' }, LAST_CLOSE, true);
    return html`<div id="status" class="status" role="group" aria-label="${STATUS.label}" aria-live="off" data-state="estimate">
    <p class="status__line">
        <span class="status__dot" aria-hidden="true"></span>
        <span id="status-block" class="status__figure">${view.block}</span>
        <span class="status__price"><span class="visually-hidden">${STATUS.price}</span><span id="status-gbp" class="status__figure">${view.gbp}</span><span class="status__usd"><span class="status__sep" aria-hidden="true">·</span><span id="status-usd" class="status__figure">${view.usd}</span></span></span>
        <span id="status-source" class="status__source">${view.source}</span>
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
    const source = find(root, '#status-source');
    let receivedAt = Number.NEGATIVE_INFINITY;
    let route = '';
    let started = false;

    function render(): void {
        const view = statusView(heights.tip, prices.quote, Date.now() - receivedAt > PRICE_STALE_MS);
        block.textContent = view.block;
        gbp.textContent = view.gbp;
        usd.textContent = view.usd;
        source.textContent = view.source;
        root.dataset.state = view.live ? 'live' : 'estimate';
    }

    function sync(): void {
        const active = started && LIVE_ROUTES.has(route) && !document.hidden;
        prices.setActive(owner, active);
        heights.setActive(owner, active);
    }

    prices.subscribe((quote) => {
        if (quote.source !== 'last close' && !quote.stale) receivedAt = Date.now();
        render();
    });
    heights.subscribe(render);
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
            render();
        },
    };
}
