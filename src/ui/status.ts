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

/** The dial spans 20 minutes, twice the target block time, with a tick at 10. */
export const DIAL_MINUTES = 20;

export interface StatusView {
    block: string;
    /** 0..1 of the dial: real elapsed time since the block, or 0 when no time is known. */
    elapsed: number;
    estimated: boolean;
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

export function dialShare(tip: Pick<Tip, 'time'>, now: number): number {
    if (tip.time === null || !Number.isFinite(tip.time)) return 0;
    return Math.min(1, Math.max(0, (now / 1000 - tip.time) / 60 / DIAL_MINUTES));
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
        elapsed: dialShare(tip, now),
        estimated: tip.source !== 'live',
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
    return html`<div id="status" class="meters" role="group" aria-label="${STATUS.label}" aria-live="off" data-state="estimate">
    <p class="meter meter--block"><span class="meter__lamp" aria-hidden="true"></span><span id="status-block" class="meter__value" data-stage-origin>${view.block}</span></p>
    <p class="meter meter--price"><span class="visually-hidden">${STATUS.price}</span><span id="status-gbp" class="meter__value">${view.gbp}</span><span class="meter__usd"><span class="meter__sep" aria-hidden="true">·</span><span id="status-usd" class="meter__value">${view.usd}</span></span></p>
    <p class="meter meter--age"><span class="dial" role="img" aria-label="${STATUS.dial}" data-estimated><span id="status-dial" class="dial__fill"></span></span><span id="status-age" class="meter__age">${view.age}</span></p>
    <a id="status-source" class="meter__source" href="${view.sourceUrl}" rel="noopener noreferrer">${view.source}</a>
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
    const dial = find(root, '#status-dial');
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
        dial.style.setProperty('--elapsed', view.elapsed.toFixed(4));
        dial.parentElement?.toggleAttribute('data-estimated', view.estimated);
        source.textContent = view.source;
        source.href = view.sourceUrl;
        root.dataset.state = view.live ? 'live' : 'estimate';
        if (view.age !== shownAge && shownAge !== '') stage.chain(chainState(heights.tip), false);
        shownAge = view.age;
    }

    function tick(): void {
        ticks += 1;
        block.dataset.ticks = String(ticks);
        for (const element of [block, dial]) {
            element.classList.remove('is-tick');
            void element.offsetWidth;
            element.classList.add('is-tick');
        }
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
