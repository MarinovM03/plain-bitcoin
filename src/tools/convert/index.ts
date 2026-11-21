import { LAST_CLOSE_SOURCE, type PriceQuote, priceFeed } from '../../data/price.ts';
import { attach } from '../../hero/bus.ts';
import {
    convert,
    type FiatUnit,
    type ParseFailure,
    parseToSats,
    pasteFits,
    SATS_PER_BTC,
    satsText,
    satsToFiat,
    type Unit,
} from '../../model/convert.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { type ConvertText, convertText, priceLabel } from '../../postcard/words.ts';
import {
    CONVERT_CURRENCIES,
    CONVERT_CURRENCY_DEFAULT,
    CONVERT_SLOTS,
    type ConvertSlot,
    CURRENCY_CODE,
    CONVERT_DECIMALS as DECIMALS,
    SCRUB_STEPS,
} from '../../ui/convert-view.ts';
import { CONVERT, TOOL_PAGE } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { rollText } from '../../ui/roll.ts';
import { afterFirstPaint, find, link } from '../../util/dom.ts';
import {
    formatFiatPrecise,
    formatSats,
    formatShortDay,
    formatUtcClock,
    formatUtcStamp,
    isoDayMs,
} from '../../util/format.ts';

const SETTLE_MS = 700;
const SYMBOLS: Record<FiatUnit, '$' | '€' | '£'> = { usd: '$', eur: '€', gbp: '£' };
const MEMPOOL = 'https://mempool.space/';
const SCRUB_DECADES = Math.log10(SATS_PER_BTC);

const FAILURES: Record<Exclude<ParseFailure, 'empty'>, string> = {
    invalid: CONVERT.invalid,
    'too-small': CONVERT.tooSmall,
    'too-big': CONVERT.tooBig,
    'no-price': CONVERT.noEuro,
};

/** A place on the scrubber as sats: each step is the same share bigger, rounded to two leading digits. */
function scrubToSats(step: number): number {
    const raw = 10 ** ((step / SCRUB_STEPS) * SCRUB_DECADES);
    return Math.min(SATS_PER_BTC, Math.max(1, Number(raw.toPrecision(2))));
}

function satsToScrub(sats: number): number {
    if (!(sats > 1)) return 0;
    return Math.min(SCRUB_STEPS, Math.round((Math.log10(sats) / SCRUB_DECADES) * SCRUB_STEPS));
}

export function mountConvert(root: HTMLElement, siteUrl: string): () => void {
    const inputs = Object.fromEntries(
        CONVERT_SLOTS.map((slot) => [slot, find<HTMLInputElement>(root, `#convert-${slot}`)]),
    ) as Record<ConvertSlot, HTMLInputElement>;
    const fiatLabel = find(root, 'label[for="convert-fiat"]');
    const currencyChoices = [...root.querySelectorAll<HTMLInputElement>('input[name="convert-currency"]')];
    const scrub = find<HTMLInputElement>(root, '#convert-scrub');
    const point = find(root, '#convert-point');
    const refSat = find(root, '#convert-ref-sat');
    const note = find(root, '#convert-note');
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const big = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');

    const site = siteAddress(siteUrl);
    const prices = priceFeed();
    const owner = {};
    let quote: PriceQuote = prices.quote;
    let slot: ConvertSlot =
        CONVERT_SLOTS.find((current) => inputs[current].value !== inputs[current].defaultValue) ?? 'sats';
    let currency: FiatUnit =
        CONVERT_CURRENCIES.find((unit) => currencyChoices.some((choice) => choice.checked && choice.value === unit)) ??
        CONVERT_CURRENCY_DEFAULT;
    const unitOf = (current: ConvertSlot): Unit => (current === 'fiat' ? currency : current);
    let text: ConvertText | null = null;
    let settleTimer = 0;
    let drawnKey = '';
    const counter = attach(
        find(root, '[data-machine="sats"]'),
        'sats',
        { sats: 0, money: 0, symbol: '$' },
        { page: true },
    );
    const share = bindShareBar(root, {
        postcard: () => text?.postcard ?? null,
        site,
        onStatus: (message) => {
            window.clearTimeout(settleTimer);
            status.textContent = message;
        },
    });

    function settle(message: string): void {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            status.textContent = message;
        }, SETTLE_MS);
    }

    function showWorld(sats: number): void {
        const price = quote.value[currency];
        const money = price === null ? null : satsToFiat(sats, price);
        const key = `${sats}|${currency}|${money}`;
        if (key === drawnKey) return;
        drawnKey = key;
        counter.set({ sats, money, symbol: SYMBOLS[currency] });
        scrub.style.setProperty('--at', String(satsToScrub(sats) / SCRUB_STEPS));
        point.textContent = sats > 0 ? CONVERT.counter : CONVERT.pointEmpty;
    }

    function showNote(message: string | null): void {
        note.hidden = message === null;
        note.textContent = message ?? '';
    }

    function renderPrice(): void {
        const price = quote.value[currency];
        refSat.textContent =
            price === null ? '' : CONVERT.perSat(formatFiatPrecise(price / SATS_PER_BTC, CURRENCY_CODE[currency]));
    }

    function renderSource(): void {
        const parts: (string | Node)[] = [CONVERT.sourceLabel];
        if (quote.source === 'last close') {
            parts.push(
                link(LAST_CLOSE_SOURCE.name, LAST_CLOSE_SOURCE.url),
                CONVERT.sourceClose(formatShortDay(isoDayMs(LAST_CLOSE_SOURCE.day))),
            );
        } else {
            parts.push(link(CONVERT.sourceFallback, MEMPOOL), CONVERT.sourceLive(formatUtcStamp(quote.asOf)));
        }
        parts.push(CONVERT.sourceUnits);
        source.replaceChildren(...parts);
    }

    function showEmpty(message: string): void {
        text = null;
        const empty = document.createElement('span');
        empty.className = 'result__empty';
        empty.textContent = message;
        figure.replaceChildren(empty);
        rollText(big, EMPTY_FIGURE);
        detail.textContent = '';
        showWorld(0);
        share.setEnabled(false);
        settle(message);
    }

    function update(): void {
        const unit = unitOf(slot);
        const parsed = parseToSats(unit, inputs[slot].value, quote.value);
        const noEuro = currency === 'eur' && quote.value.eur === null;
        label.textContent = `${TOOL_PAGE.resultLabel} · ${
            quote.source === 'last close' ? priceLabel(quote) : CONVERT.labelLive(formatUtcClock(quote.asOf))
        }`;
        renderSource();
        if (!parsed.ok) {
            for (const other of CONVERT_SLOTS) if (other !== slot) inputs[other].value = '';
            showNote(parsed.reason === 'empty' ? (noEuro ? CONVERT.noEuro : null) : FAILURES[parsed.reason]);
            showEmpty(parsed.reason === 'empty' ? CONVERT.empty : FAILURES[parsed.reason]);
            return;
        }
        showNote(noEuro ? CONVERT.noEuro : null);
        const conversion = convert(parsed.value, quote.value);
        for (const other of CONVERT_SLOTS) if (other !== slot) inputs[other].value = conversion.fields[unitOf(other)];
        text = convertText(unit, conversion, quote, currency);
        figure.textContent = text.headline;
        rollText(big, text.figure);
        detail.textContent = text.detail;
        if (document.activeElement !== scrub) scrub.value = String(satsToScrub(parsed.value));
        scrub.setAttribute('aria-valuetext', formatSats(parsed.value));
        showWorld(parsed.value);
        share.setEnabled(true);
        settle(`${text.headline}. ${text.detail}`);
    }

    function onPaste(event: InputEvent, current: ConvertSlot): void {
        if (event.inputType !== 'insertFromPaste') return;
        const pasted = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
        if (pasteFits(pasted, DECIMALS[unitOf(current)])) return;
        event.preventDefault();
        showNote(CONVERT.invalid);
    }

    for (const current of CONVERT_SLOTS) {
        const input = inputs[current];
        input.addEventListener('input', () => {
            slot = current;
            update();
        });
        input.addEventListener('beforeinput', (event) => onPaste(event, current));
    }
    scrub.addEventListener('input', () => {
        slot = 'sats';
        inputs.sats.value = satsText(scrubToSats(Number(scrub.value)));
        update();
    });
    for (const choice of currencyChoices) {
        choice.addEventListener('change', () => {
            if (!choice.checked) return;
            // The amount of bitcoin stays; only the money it is shown in changes.
            if (slot === 'fiat' && inputs.sats.value !== '') slot = 'sats';
            currency = choice.value as FiatUnit;
            fiatLabel.textContent = CONVERT.fields[currency];
            renderPrice();
            update();
        });
    }
    fiatLabel.textContent = CONVERT.fields[currency];

    const unsubscribe = prices.subscribe((next) => {
        quote = next;
        renderPrice();
        update();
    });
    let started = false;
    let disposed = false;
    const sync = () => {
        if (started) prices.setActive(owner, !document.hidden);
    };
    document.addEventListener('visibilitychange', sync);
    afterFirstPaint(() => {
        started = !disposed;
        sync();
    });
    renderPrice();
    update();

    return () => {
        disposed = true;
        unsubscribe();
        document.removeEventListener('visibilitychange', sync);
        prices.setActive(owner, false);
        window.clearTimeout(settleTimer);
        counter.detach();
        share.dispose();
    };
}
