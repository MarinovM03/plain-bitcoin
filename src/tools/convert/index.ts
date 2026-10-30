import { LAST_CLOSE_SOURCE, type PriceQuote, priceFeed } from '../../data/price.ts';
import { convert, type ParseFailure, parseToSats, pasteFits, type Unit } from '../../model/convert.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { type ConvertText, convertText, priceLabel, rateLine } from '../../share/cardText.ts';
import { siteAddress } from '../../share/index.ts';
import {
    CONVERT_PRESETS,
    CONVERT_UNITS,
    type ConvertPreset,
    CONVERT_DECIMALS as DECIMALS,
} from '../../ui/convert-view.ts';
import { CONVERT, TOOL_PAGE } from '../../ui/copy.ts';
import { formatShortDay, formatUtcClock, formatUtcStamp, isoDayMs } from '../../util/format.ts';

const SETTLE_MS = 700;
const MEMPOOL = 'https://mempool.space/';

const FAILURES: Record<Exclude<ParseFailure, 'empty'>, string> = {
    invalid: CONVERT.invalid,
    'too-small': CONVERT.tooSmall,
    'too-big': CONVERT.tooBig,
};

function find<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
}

function link(text: string, href: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = text;
    anchor.rel = 'noopener noreferrer';
    return anchor;
}

export function mountConvert(root: HTMLElement, siteUrl: string): () => void {
    const inputs = Object.fromEntries(
        CONVERT_UNITS.map((unit) => [unit, find<HTMLInputElement>(root, `#convert-${unit}`)]),
    ) as Record<Unit, HTMLInputElement>;
    const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
    const priceLine = find(root, '#convert-price');
    const note = find(root, '#convert-note');
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');

    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    const prices = priceFeed();
    const owner = {};
    let quote: PriceQuote = prices.quote;
    let unit: Unit = 'sats';
    let text: ConvertText | null = null;
    let settleTimer = 0;
    const share = bindShareBar(root, {
        files,
        card: () => text?.card ?? null,
        onStatus: (message) => {
            window.clearTimeout(settleTimer);
            status.textContent = message;
        },
    });

    function settle(message: string): void {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            status.textContent = message;
            if (text) files.get(text.card).catch(() => {});
        }, SETTLE_MS);
    }

    function showNote(message: string | null): void {
        note.hidden = message === null;
        note.textContent = message ?? '';
    }

    function renderPrice(): void {
        priceLine.textContent = `${rateLine(quote)} · ${priceLabel(quote)}`;
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
        detail.textContent = '';
        share.setEnabled(false);
        settle(message);
    }

    function markPresets(): void {
        for (const button of presetButtons) {
            const preset = CONVERT_PRESETS[button.dataset.preset as ConvertPreset];
            const pressed = preset.unit === unit && preset.value === inputs[unit].value;
            button.setAttribute('aria-pressed', String(pressed));
        }
    }

    function update(): void {
        const parsed = parseToSats(unit, inputs[unit].value, quote.value);
        markPresets();
        label.textContent = `${TOOL_PAGE.resultLabel} · ${
            quote.source === 'last close' ? priceLabel(quote) : CONVERT.labelLive(formatUtcClock(quote.asOf))
        }`;
        renderSource();
        if (!parsed.ok) {
            for (const other of CONVERT_UNITS) if (other !== unit) inputs[other].value = '';
            showNote(parsed.reason === 'empty' ? null : FAILURES[parsed.reason]);
            showEmpty(parsed.reason === 'empty' ? CONVERT.empty : FAILURES[parsed.reason]);
            return;
        }
        showNote(null);
        const conversion = convert(parsed.value, quote.value);
        for (const other of CONVERT_UNITS) if (other !== unit) inputs[other].value = conversion.fields[other];
        text = convertText(unit, conversion, quote, site);
        figure.textContent = text.headline;
        detail.textContent = text.detail;
        share.setEnabled(true);
        settle(`${text.headline}. ${text.detail}`);
    }

    function onPaste(event: InputEvent, current: Unit): void {
        if (event.inputType !== 'insertFromPaste') return;
        const pasted = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
        if (pasteFits(pasted, DECIMALS[current])) return;
        event.preventDefault();
        showNote(CONVERT.invalid);
    }

    for (const current of CONVERT_UNITS) {
        const input = inputs[current];
        input.addEventListener('input', () => {
            unit = current;
            update();
        });
        input.addEventListener('beforeinput', (event) => onPaste(event, current));
    }
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const preset = CONVERT_PRESETS[button.dataset.preset as ConvertPreset];
            unit = preset.unit;
            inputs[unit].value = preset.value;
            update();
        });
    }

    const unsubscribe = prices.subscribe((next) => {
        quote = next;
        renderPrice();
        update();
    });
    const sync = () => prices.setActive(owner, !document.hidden);
    document.addEventListener('visibilitychange', sync);
    sync();
    renderPrice();
    update();

    return () => {
        unsubscribe();
        document.removeEventListener('visibilitychange', sync);
        prices.setActive(owner, false);
        window.clearTimeout(settleTimer);
        share.dispose();
    };
}
