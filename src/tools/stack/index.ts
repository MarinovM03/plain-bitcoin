import type { PriceQuote } from '../../data/price.ts';
import { priceFeed } from '../../data/price.ts';
import { mountPicture } from '../../gauges/mount.ts';
import { type Parsed, parseBtc, parseSats } from '../../model/convert.ts';
import type { DailyCloses } from '../../model/dca.ts';
import { type Holding, type HoldingFiat, keep, type PriceMark, valueSeries, visited } from '../../model/holding.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { priceLabel, type StackText, stackText } from '../../postcard/words.ts';
import { CONVERT, DCA, PICTURE, STACK, TOOL_PAGE } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { STACK_ROWS } from '../../ui/stack-view.ts';
import { find } from '../../util/dom.ts';
import { btcParts, formatShortDay, isoDayMs } from '../../util/format.ts';
import { forgetHolding, readHolding, writeHolding } from '../../util/store.ts';

const YEAR_DAYS = 365;
const HOME_PENDING = '…';
const DAY_MS = 86_400_000;

interface DailySeries extends DailyCloses {
    url: string;
}

const LOADERS: Record<HoldingFiat, () => Promise<DailySeries>> = {
    GBP: () => import('../../data/prices/daily-gbp.ts').then((module) => module.default),
    USD: () => import('../../data/prices/daily-usd.ts').then((module) => module.default),
};

type Unit = 'btc' | 'sats';

const live = (quote: PriceQuote) => quote.source !== 'last close' && !quote.stale;

/** A reading from the shelf is dated to its close, so "since" never claims a day it was not read. */
function markOf(quote: PriceQuote, now: number): PriceMark {
    return { at: live(quote) ? now : quote.asOf, usd: quote.value.usd, gbp: quote.value.gbp };
}

function btcField(sats: number): string {
    const parts = btcParts(sats);
    return parts.fraction ? `${parts.whole}.${parts.fraction}` : parts.whole;
}

export function mountStack(root: HTMLElement, siteUrl: string): () => void {
    const prices = priceFeed();
    const form = find<HTMLFormElement>(root, '.tool__inputs');
    const more = find<HTMLFormElement>(root, '.tool__more');
    const amount = find<HTMLInputElement>(root, '#stack-amount');
    const keepButton = find<HTMLButtonElement>(root, '#stack-keep');
    const forgetButton = find<HTMLButtonElement>(root, '#stack-forget');
    const keepNote = find(root, '#stack-keep-note');
    const label = find(root, '#tool-result-label');
    const sentence = find(root, '#tool-result');
    const figure = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const panel = find(root, '#stack-detail');
    const picture = mountPicture(root);
    const loaded = new Map<HoldingFiat, DailySeries>();

    let holding: Holding | null = readHolding();
    let text: StackText | null = null;
    let disposed = false;

    const share = bindShareBar(root, {
        postcard: () => text?.postcard ?? null,
        site: siteAddress(siteUrl),
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    const unit = (): Unit =>
        form.querySelector<HTMLInputElement>('input[name="stack-unit"]:checked')?.value === 'sats' ? 'sats' : 'btc';
    const fiat = (): HoldingFiat =>
        more.querySelector<HTMLInputElement>('input[name="stack-currency"]:checked')?.value === 'GBP' ? 'GBP' : 'USD';
    const parsed = (): Parsed => (unit() === 'sats' ? parseSats(amount.value) : parseBtc(amount.value));

    function setUnit(next: Unit, sats: number | null): void {
        const radio = form.querySelector<HTMLInputElement>(`input[name="stack-unit"][value="${next}"]`);
        if (radio) radio.checked = true;
        amount.dataset.decimals = next === 'sats' ? '0' : '8';
        amount.inputMode = next === 'sats' ? 'numeric' : 'decimal';
        if (sats !== null) amount.value = next === 'sats' ? sats.toLocaleString('en-GB') : btcField(sats);
    }

    function showKeep(): void {
        forgetButton.hidden = holding === null;
        keepButton.hidden = holding !== null;
        if (holding) keepNote.textContent = STACK.kept(formatShortDay(holding.savedAt));
    }

    function save(next: Holding): void {
        holding = next;
        if (writeHolding(next)) return;
        holding = null;
        keepNote.textContent = STACK.keepFailed;
    }

    function say(message: string): void {
        text = null;
        label.textContent = TOOL_PAGE.resultLabel;
        const empty = document.createElement('span');
        empty.className = 'result__empty';
        empty.textContent = message;
        sentence.replaceChildren(empty);
        figure.textContent = EMPTY_FIGURE;
        detail.textContent = '';
        panel.hidden = true;
        keepButton.disabled = true;
        picture.set(
            { id: 'stack', fiat: fiat(), worth: '', alt: '', t: [], value: [], invested: [], lump: [] },
            PICTURE.stackEmpty,
        );
        share.setEnabled(false);
    }

    const MESSAGES: Record<Exclude<Parsed, { ok: true }>['reason'], string> = {
        empty: STACK.empty,
        invalid: CONVERT.invalid,
        'too-small': CONVERT.tooSmall,
        'too-big': CONVERT.tooBig,
        'no-price': STACK.empty,
    };

    function render(): void {
        const reading = parsed();
        if (!reading.ok || reading.value === 0) {
            say(reading.ok ? STACK.empty : MESSAGES[reading.reason]);
            return;
        }
        const sats = reading.value;
        const currency = fiat();
        if (holding && (holding.sats !== sats || holding.fiat !== currency)) save({ ...holding, sats, fiat: currency });
        const quote = prices.quote;
        const daily = loaded.get(currency) ?? null;
        const price = currency === 'GBP' ? quote.value.gbp : quote.value.usd;
        const closesTo = daily ? formatShortDay(isoDayMs(daily.start) + (daily.closes.length - 1) * DAY_MS) : null;
        text = stackText({
            sats,
            unit: unit(),
            fiat: currency,
            quote,
            series: daily ? valueSeries(sats, daily, YEAR_DAYS, { at: Date.now(), price }) : null,
            closesTo,
            holding,
        });
        label.textContent = `${TOOL_PAGE.resultLabel} · ${priceLabel(quote)}`;
        figure.textContent = text.figure;
        sentence.textContent = text.headline;
        detail.textContent = text.detail;
        keepButton.disabled = false;
        const { rows, chart } = text;
        if (rows) for (const row of STACK_ROWS) find(panel, `#stack-${row}`).textContent = rows[row];
        panel.hidden = rows === null;
        if (chart) {
            picture.set(
                { id: 'stack', fiat: currency, worth: text.figure, alt: text.chartAlt, ...chart },
                PICTURE.stack,
            );
        }
        const fx = currency === 'GBP' ? ` ${DCA.fxNote}` : '';
        source.textContent = `${STACK.source(priceLabel(quote), closesTo ?? HOME_PENDING)}${fx}`;
        share.setEnabled(true);
        share.refresh();
        status.textContent = `${text.headline} ${text.detail}`;
    }

    function load(currency: HoldingFiat): void {
        if (loaded.has(currency)) return;
        LOADERS[currency]()
            .then((series) => {
                if (disposed) return;
                loaded.set(currency, series);
                render();
            })
            .catch(() => {
                if (!disposed) source.textContent = DCA.loadFailed;
            });
    }

    function onPrice(): void {
        const quote = prices.quote;
        if (holding && live(quote)) {
            const next = visited(holding, markOf(quote, Date.now()));
            if (next !== holding) save(next);
        }
        render();
    }

    keepButton.addEventListener('click', () => {
        const reading = parsed();
        if (!reading.ok || reading.value === 0) return;
        const now = Date.now();
        save(keep(reading.value, fiat(), markOf(prices.quote, now), now));
        showKeep();
        render();
        if (holding) forgetButton.focus();
    });

    forgetButton.addEventListener('click', () => {
        forgetHolding();
        holding = null;
        showKeep();
        keepNote.textContent = STACK.forgotten;
        render();
        keepButton.focus();
    });

    form.addEventListener('input', render);
    form.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        if (target.name !== 'stack-unit') return;
        const before = target.value === 'sats' ? parseBtc(amount.value) : parseSats(amount.value);
        setUnit(target.value === 'sats' ? 'sats' : 'btc', before.ok ? before.value : null);
        render();
    });
    more.addEventListener('change', () => {
        load(fiat());
        render();
    });

    if (holding) {
        setUnit('btc', holding.sats);
        const radio = more.querySelector<HTMLInputElement>(`input[name="stack-currency"][value="${holding.fiat}"]`);
        if (radio) radio.checked = true;
    }
    showKeep();
    const stopPrices = prices.subscribe(onPrice);
    onPrice();
    load(fiat());

    return () => {
        disposed = true;
        stopPrices();
        share.dispose();
        picture.dispose();
    };
}
