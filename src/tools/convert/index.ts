import { LAST_CLOSE_SOURCE, type PriceQuote, priceFeed } from '../../data/price.ts';
import { convert, type ParseFailure, parseToSats, pasteFits, SATS_PER_BTC, type Unit } from '../../model/convert.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { type ConvertText, convertText, priceLabel } from '../../share/cardText.ts';
import { siteAddress } from '../../share/index.ts';
import {
    CONVERT_PRESETS,
    CONVERT_UNITS,
    type ConvertPreset,
    CONVERT_DECIMALS as DECIMALS,
} from '../../ui/convert-view.ts';
import { CONVERT, SCENE, TOOL_PAGE } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { afterFirstPaint, find, link } from '../../util/dom.ts';
import {
    formatFiatPrecise,
    formatSats,
    formatShortDay,
    formatUtcClock,
    formatUtcStamp,
    isoDayMs,
} from '../../util/format.ts';
import { satsScale } from '../../util/sats-scale.ts';
import { linkScene } from '../scene.ts';

const SETTLE_MS = 700;
const MEMPOOL = 'https://mempool.space/';

const FAILURES: Record<Exclude<ParseFailure, 'empty'>, string> = {
    invalid: CONVERT.invalid,
    'too-small': CONVERT.tooSmall,
    'too-big': CONVERT.tooBig,
};

export function mountConvert(root: HTMLElement, siteUrl: string): () => void {
    const inputs = Object.fromEntries(
        CONVERT_UNITS.map((unit) => [unit, find<HTMLInputElement>(root, `#convert-${unit}`)]),
    ) as Record<Unit, HTMLInputElement>;
    const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
    const refSat = find(root, '#convert-ref-sat');
    const note = find(root, '#convert-note');
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const big = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');

    const scene = linkScene(root);
    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    const prices = priceFeed();
    const owner = {};
    let quote: PriceQuote = prices.quote;
    let unit: Unit = CONVERT_UNITS.find((current) => inputs[current].value !== inputs[current].defaultValue) ?? 'sats';
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
        const { gbp, usd } = quote.value;
        refSat.textContent = CONVERT.perSat(
            formatFiatPrecise(gbp / SATS_PER_BTC, 'GBP'),
            formatFiatPrecise(usd / SATS_PER_BTC, 'USD'),
        );
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
        scene.set({ id: 'convert', sats: 0 }, SCENE.convertEmpty);
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
        big.textContent = text.figure;
        detail.textContent = text.detail;
        scene.set(
            { id: 'convert', sats: parsed.value },
            SCENE.convert(formatSats(satsScale(parsed.value).perDot), formatSats(parsed.value)),
        );
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
    };
}
