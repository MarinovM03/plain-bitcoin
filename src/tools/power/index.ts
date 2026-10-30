import { POWER_SERIES, powerData } from '../../data/power.ts';
import { type PowerOutcome, type PowerResult, purchasingPower, sortedMonths, worstStart } from '../../model/power.ts';
import { barScale, sparkline } from '../../model/scale.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { type PowerText, powerText } from '../../share/cardText.ts';
import { siteAddress } from '../../share/index.ts';
import { POWER, TOOL_PAGE } from '../../ui/copy.ts';
import { readMonthField, setMonthField } from '../../ui/field-behaviour.ts';
import { POWER_DEFAULT_START, type PowerPreset } from '../../ui/power-view.ts';
import { parseAmount } from '../../util/amount-input.ts';
import { type Fiat, formatWhole } from '../../util/format.ts';
import { type Month, monthKeyLabel, monthValue, parseMonth, shiftMonth } from '../../util/month.ts';

const SETTLE_MS = 700;
const SPARK_WIDTH = 300;
const SPARK_HEIGHT = 48;

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

export function mountPower(root: HTMLElement, siteUrl: string): () => void {
    const form = find<HTMLFormElement>(root, '.tool__inputs');
    const amountInput = find<HTMLInputElement>(root, '#power-amount');
    const monthFieldset = find<HTMLFieldSetElement>(root, '.month-field');
    const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const panel = find(root, '#power-detail');
    const scaleNote = find(root, '#power-scale');
    const pathLine = find(root, '#power-path');
    const spark = find<SVGSVGElement>(root, '#power-spark');
    const sparkBase = find<SVGLineElement>(spark, '.spark__base');
    const sparkLine = find<SVGPolylineElement>(spark, '.spark__line');

    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    const months = sortedMonths(POWER_SERIES.USD.prices.months);
    const firstMonth = parseMonth(months[0] ?? '');
    const lastMonth = parseMonth(months.at(-1) ?? '');
    if (!firstMonth || !lastMonth) throw new Error('Bundled prices have no months');
    const first: Month = firstMonth;
    const last: Month = lastMonth;
    setMonthField(monthFieldset, readMonthField(monthFieldset) ?? POWER_DEFAULT_START, { min: first, max: last });

    const worstMonths = new Map<Fiat, Month | null>();
    let text: PowerText | null = null;
    let settleTimer = 0;
    const share = bindShareBar(root, {
        files,
        card: () => text?.card ?? null,
        onStatus: (message) => {
            window.clearTimeout(settleTimer);
            status.textContent = message;
        },
    });

    const currency = (): Fiat =>
        form.querySelector<HTMLInputElement>('input[name="power-currency"]:checked')?.value === 'USD' ? 'USD' : 'GBP';

    function presetMonth(preset: PowerPreset, fiat: Fiat): Month | null {
        switch (preset) {
            case 'y2015':
                return POWER_DEFAULT_START;
            case 'fiveYears':
                return shiftMonth(last, -60);
            case 'oneYear':
                return shiftMonth(last, -12);
            case 'worst':
                if (!worstMonths.has(fiat)) worstMonths.set(fiat, parseMonth(worstStart(powerData(fiat)) ?? ''));
                return worstMonths.get(fiat) ?? null;
        }
    }

    function markPresets(start: Month, fiat: Fiat): void {
        for (const button of presetButtons) {
            const month = presetMonth(button.dataset.preset as PowerPreset, fiat);
            const pressed = month !== null && monthValue(month) === monthValue(start);
            button.setAttribute('aria-pressed', String(pressed));
        }
    }

    function settle(message: string): void {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            status.textContent = message;
            if (text) files.get(text.card).catch(() => {});
        }, SETTLE_MS);
    }

    function showMessage(message: string): void {
        text = null;
        label.textContent = TOOL_PAGE.resultLabel;
        const empty = document.createElement('span');
        empty.className = 'result__empty';
        empty.textContent = message;
        figure.replaceChildren(empty);
        detail.textContent = '';
        panel.hidden = true;
        share.setEnabled(false);
        settle(message);
    }

    function renderBars(result: PowerResult, words: PowerText): void {
        const scale = barScale([result.amount, result.btcValueNow]);
        const parts = [
            ['cash', words.cashValue, words.cashNote],
            ['btc', words.bitcoinValue, words.bitcoinNote],
        ] as const;
        parts.forEach(([kind, value, note], i) => {
            find(panel, `#power-${kind}-value`).textContent = value;
            find(panel, `#power-${kind}-note`).textContent = note;
            const fill = find(panel, `#power-${kind}-fill`);
            fill.style.setProperty('--fill', String(scale.widths[i] ?? 0));
            fill.parentElement?.style.setProperty('--decade', String(scale.decade));
        });
        panel.classList.toggle('power-detail--log', scale.log);
        scaleNote.hidden = !scale.log;
        scaleNote.textContent = scale.log ? POWER.logScale(formatWhole(scale.ratio)) : '';
    }

    function renderPath(result: PowerResult, words: PowerText): void {
        pathLine.textContent = words.path;
        spark.classList.toggle('spark--empty', result.path.length === 0);
        const values = [result.amount, ...result.path.map((point) => point.value)];
        const line = sparkline(values, result.amount, SPARK_WIDTH, SPARK_HEIGHT);
        sparkLine.setAttribute('points', line.points);
        sparkBase.setAttribute('y1', String(line.baseY));
        sparkBase.setAttribute('y2', String(line.baseY));
    }

    function renderSources(result: PowerResult, fiat: Fiat): void {
        const { cpi, prices } = POWER_SERIES[fiat];
        const parts: (string | Node)[] = [
            POWER.cpiLabel,
            link(POWER.cpiSource[fiat], cpi.url),
            POWER.cpiTo(monthKeyLabel(result.cpiMonth)),
            POWER.priceLabel,
            link(POWER.priceSource, prices.url),
            POWER.priceTo(monthKeyLabel(result.priceMonth)),
        ];
        if (fiat === 'GBP') parts.push(` ${POWER.fxNote}`);
        source.replaceChildren(...parts);
    }

    function messageFor(outcome: Exclude<PowerOutcome, { ok: true }>, fiat: Fiat): string {
        const month = monthKeyLabel(outcome.month);
        if (outcome.reason === 'no-cpi') return POWER.noCpi(month, fiat);
        if (outcome.reason === 'no-price') return POWER.noPrice(month);
        return POWER.empty;
    }

    function update(): void {
        const fiat = currency();
        const start = readMonthField(monthFieldset) ?? POWER_DEFAULT_START;
        markPresets(start, fiat);
        const outcome = purchasingPower(parseAmount(amountInput.value) ?? 0, monthValue(start), powerData(fiat));
        if (!outcome.ok) {
            showMessage(messageFor(outcome, fiat));
            return;
        }
        const { result } = outcome;
        text = powerText(result, fiat, site);
        label.textContent = `${TOOL_PAGE.resultLabel} · ${text.asOf}`;
        figure.textContent = text.headline;
        detail.textContent = text.bitcoin;
        renderBars(result, text);
        renderPath(result, text);
        renderSources(result, fiat);
        panel.hidden = false;
        share.setEnabled(true);
        settle(`${text.headline} ${text.bitcoin}`);
    }

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const month = presetMonth(button.dataset.preset as PowerPreset, currency());
            if (!month) return;
            setMonthField(monthFieldset, month);
            update();
        });
    }
    update();

    return () => {
        window.clearTimeout(settleTimer);
        share.dispose();
    };
}
