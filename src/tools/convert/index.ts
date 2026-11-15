import { LAST_CLOSE_SOURCE, type PriceQuote, priceFeed } from '../../data/price.ts';
import { mountPicture } from '../../gauges/mount.ts';
import { backdrop } from '../../hero/bus.ts';
import {
    convert,
    type FiatUnit,
    type ParseFailure,
    parseToSats,
    pasteFits,
    SATS_PER_BTC,
    type Unit,
} from '../../model/convert.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { type ConvertText, convertText, priceLabel } from '../../postcard/words.ts';
import {
    CONVERT_CURRENCIES,
    CONVERT_CURRENCY_DEFAULT,
    CONVERT_PRESETS,
    CONVERT_SLOTS,
    type ConvertPreset,
    type ConvertSlot,
    CURRENCY_CODE,
    CONVERT_DECIMALS as DECIMALS,
} from '../../ui/convert-view.ts';
import { CONVERT, PICTURE, TOOL_PAGE, WORLD } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { afterFirstPaint, find, link } from '../../util/dom.ts';
import {
    formatFiatPrecise,
    formatMoney,
    formatSats,
    formatShortDay,
    formatUtcClock,
    formatUtcStamp,
    isoDayMs,
} from '../../util/format.ts';
import { satsScale } from '../../util/sats-scale.ts';

const SETTLE_MS = 700;
const MEMPOOL = 'https://mempool.space/';

const FAILURES: Record<Exclude<ParseFailure, 'empty'>, string> = {
    invalid: CONVERT.invalid,
    'too-small': CONVERT.tooSmall,
    'too-big': CONVERT.tooBig,
    'no-price': CONVERT.noEuro,
};

export function mountConvert(root: HTMLElement, siteUrl: string): () => void {
    const inputs = Object.fromEntries(
        CONVERT_SLOTS.map((slot) => [slot, find<HTMLInputElement>(root, `#convert-${slot}`)]),
    ) as Record<ConvertSlot, HTMLInputElement>;
    const fiatLabel = find(root, 'label[for="convert-fiat"]');
    const currencyChoices = [...root.querySelectorAll<HTMLInputElement>('input[name="convert-currency"]')];
    const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
    const refSat = find(root, '#convert-ref-sat');
    const note = find(root, '#convert-note');
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const big = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const worldLine = find(root, '#world-line');

    const picture = mountPicture(root);
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
    let drawnSats = -1;
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
        if (sats === drawnSats) return;
        drawnSats = sats;
        backdrop({ id: 'convert', sats });
        worldLine.textContent = sats > 0 ? WORLD.convert(formatSats(satsScale(sats).perDot)) : WORLD.convertEmpty;
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
        big.textContent = EMPTY_FIGURE;
        detail.textContent = '';
        picture.set(pictureData(0), PICTURE.convertEmpty);
        showWorld(0);
        share.setEnabled(false);
        settle(message);
    }

    /** The ladder is priced in the picked money; with no euro price yet it shows dollars and says so. */
    function pictureData(sats: number): {
        id: 'convert';
        sats: number;
        price: number;
        currency: 'USD' | 'EUR' | 'GBP';
    } {
        const shown: FiatUnit = quote.value[currency] === null ? 'usd' : currency;
        return { id: 'convert', sats, price: quote.value[shown] ?? 0, currency: CURRENCY_CODE[shown] };
    }

    function markPresets(): void {
        for (const button of presetButtons) {
            const preset = CONVERT_PRESETS[button.dataset.preset as ConvertPreset];
            const pressed = preset.unit === slot && preset.value === inputs[slot].value;
            button.setAttribute('aria-pressed', String(pressed));
        }
    }

    function update(): void {
        const unit = unitOf(slot);
        const parsed = parseToSats(unit, inputs[slot].value, quote.value);
        const noEuro = currency === 'eur' && quote.value.eur === null;
        markPresets();
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
        big.textContent = text.figure;
        detail.textContent = text.detail;
        const drawn = pictureData(parsed.value);
        showWorld(parsed.value);
        picture.set(drawn, PICTURE.convert(`1 BTC = ${formatMoney(drawn.price, drawn.currency)}`));
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
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const preset = CONVERT_PRESETS[button.dataset.preset as ConvertPreset];
            slot = preset.unit;
            inputs[slot].value = preset.value;
            update();
        });
    }
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
        share.dispose();
        picture.dispose();
    };
}
