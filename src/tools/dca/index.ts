import { MAX_SATS } from '../../model/convert.ts';
import {
    buyDays,
    type DailyCloses,
    type DcaOutcome,
    type DcaResult,
    dayNumber,
    dca,
    FREQUENCIES,
    type Frequency,
} from '../../model/dca.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { type DcaText, dcaText } from '../../share/cardText.ts';
import { siteAddress } from '../../share/index.ts';
import { DCA, SCENE, TOOL_PAGE } from '../../ui/copy.ts';
import { DCA_DEFAULT_START, DCA_ROWS, type DcaPreset } from '../../ui/dca-view.ts';
import { readMonthField, setMonthField } from '../../ui/field-behaviour.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { parseAmount } from '../../util/amount-input.ts';
import { find, link } from '../../util/dom.ts';
import { type Fiat, formatDay, isoDayMs } from '../../util/format.ts';
import { type Month, monthValue, parseMonth, shiftMonth } from '../../util/month.ts';
import { linkScene } from '../scene.ts';

const SETTLE_MS = 700;
const DAY_MS = 86_400_000;

interface DailySeries extends DailyCloses {
    url: string;
}

const LOADERS: Record<Fiat, () => Promise<DailySeries>> = {
    GBP: () => import('../../data/prices/daily-gbp.json').then((module) => module.default),
    USD: () => import('../../data/prices/daily-usd.json').then((module) => module.default),
};

function buyIndices(result: DcaResult): number[] {
    const first = dayNumber(result.start);
    const last = dayNumber(result.lastBuy);
    if (first === null || last === null) return [];
    const indices = buyDays(result.frequency, first, last).map((day) => day - first);
    const end = result.points.length - 1;
    return indices.at(-1) === end ? indices : [...indices, end];
}

function lastDayMs(series: DailyCloses): number {
    return isoDayMs(series.start) + (series.closes.length - 1) * DAY_MS;
}

function endMonth(series: DailyCloses): Month {
    const last = new Date(lastDayMs(series));
    return { year: last.getUTCFullYear(), month: last.getUTCMonth() + 1 };
}

export function mountDca(root: HTMLElement, siteUrl: string): () => void {
    const form = find<HTMLFormElement>(root, '.tool__inputs');
    const amountInput = find<HTMLInputElement>(root, '#dca-amount');
    const feeInput = find<HTMLInputElement>(root, '#dca-fee');
    const monthFieldset = find<HTMLFieldSetElement>(root, '.month-field');
    const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
    const label = find(root, '#tool-result-label');
    const figure = find(root, '#tool-result');
    const big = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const panel = find(root, '#dca-detail');
    const notes = find(root, '#dca-notes');

    const scene = linkScene(root);
    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    const loaded = new Map<Fiat, DailySeries>();
    let text: DcaText | null = null;
    let settleTimer = 0;
    let request = 0;
    let disposed = false;
    const share = bindShareBar(root, {
        files,
        card: () => text?.card ?? null,
        onStatus: (message) => {
            window.clearTimeout(settleTimer);
            status.textContent = message;
        },
    });

    const currency = (): Fiat =>
        form.querySelector<HTMLInputElement>('input[name="dca-currency"]:checked')?.value === 'USD' ? 'USD' : 'GBP';

    const frequency = (): Frequency => {
        const value = form.querySelector<HTMLInputElement>('input[name="dca-often"]:checked')?.value;
        return FREQUENCIES.find((option) => option === value) ?? 'weekly';
    };

    function presetMonth(preset: DcaPreset, last: Month): Month {
        switch (preset) {
            case 'y2020':
                return DCA_DEFAULT_START;
            case 'fiveYears':
                return shiftMonth(last, -60);
            case 'oneYear':
                return shiftMonth(last, -12);
        }
    }

    function markPresets(start: Month, last: Month): void {
        for (const button of presetButtons) {
            const month = presetMonth(button.dataset.preset as DcaPreset, last);
            button.setAttribute('aria-pressed', String(monthValue(month) === monthValue(start)));
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
        big.textContent = EMPTY_FIGURE;
        detail.textContent = '';
        panel.hidden = true;
        scene.set(
            { id: 'dca', fiat: currency(), worth: '', alt: '', t: [], value: [], invested: [], lump: [] },
            SCENE.dcaEmpty,
        );
        share.setEnabled(false);
        settle(message);
    }

    function messageFor(outcome: Exclude<DcaOutcome, { ok: true }>, series: DailyCloses): string {
        if (outcome.reason === 'fee') return DCA.badFee;
        if (outcome.reason === 'after-data') return DCA.afterData(formatDay(lastDayMs(series)));
        return DCA.empty;
    }

    // The chart and the answer read the same result: one payload, the last mark is the figure above.
    function renderChart(words: DcaText, outcome: Extract<DcaOutcome, { ok: true }>, fiat: Fiat): void {
        const { result } = outcome;
        const { points } = result;
        const first = isoDayMs(result.start);
        scene.set(() => {
            const marks = buyIndices(result);
            return {
                id: 'dca',
                fiat,
                worth: words.rows.worth,
                alt: words.chartAlt,
                t: marks.map((i) => first + i * DAY_MS),
                value: marks.map((i) => points[i]?.value ?? 0),
                invested: marks.map((i) => points[i]?.invested ?? 0),
                lump: marks.map((i) => points[i]?.lumpValue ?? 0),
            };
        }, SCENE.dca);
    }

    function renderNotes(words: DcaText): void {
        notes.replaceChildren(
            ...words.notes.map((line) => {
                const paragraph = document.createElement('p');
                paragraph.className = 'note-line';
                paragraph.textContent = line;
                return paragraph;
            }),
        );
    }

    function renderSource(series: DailySeries, fiat: Fiat): void {
        const parts: (string | Node)[] = [
            DCA.sourceLabel,
            link(DCA.source, series.url),
            DCA.sourceTo(formatDay(lastDayMs(series))),
        ];
        if (fiat === 'GBP') parts.push(` ${DCA.fxNote}`);
        source.replaceChildren(...parts);
    }

    function render(series: DailySeries, fiat: Fiat): void {
        const last = endMonth(series);
        const start = readMonthField(monthFieldset) ?? DCA_DEFAULT_START;
        markPresets(start, last);
        const fee = feeInput.value.trim() === '' ? 0 : (parseAmount(feeInput.value) ?? Number.NaN);
        const outcome = dca(
            {
                amount: parseAmount(amountInput.value) ?? 0,
                frequency: frequency(),
                start: `${monthValue(start)}-01`,
                feePercent: fee,
            },
            series,
        );
        if (!outcome.ok) {
            showMessage(messageFor(outcome, series));
            return;
        }
        // More sats than can ever exist cannot be written down honestly, and would not fit a safe integer.
        if (outcome.result.sats > MAX_SATS || outcome.result.lumpSum.sats > MAX_SATS) {
            showMessage(DCA.tooBig);
            return;
        }
        text = dcaText(outcome.result, fiat, site);
        label.textContent = `${TOOL_PAGE.resultLabel} · ${text.asOf}`;
        figure.textContent = text.headline;
        big.textContent = text.rows.worth;
        detail.textContent = text.detail;
        for (const row of DCA_ROWS) find(panel, `#dca-${row}`).textContent = text.rows[row];
        renderChart(text, outcome, fiat);
        renderNotes(text);
        renderSource(series, fiat);
        panel.hidden = false;
        share.setEnabled(true);
        settle(`${text.headline} ${text.detail}`);
    }

    async function seriesFor(fiat: Fiat): Promise<DailySeries> {
        const cached = loaded.get(fiat);
        if (cached) return cached;
        const series = await LOADERS[fiat]();
        loaded.set(fiat, series);
        const first = parseMonth(series.start.slice(0, 7));
        if (first) {
            setMonthField(monthFieldset, readMonthField(monthFieldset) ?? DCA_DEFAULT_START, {
                min: first,
                max: endMonth(series),
            });
        }
        return series;
    }

    function update(): void {
        const fiat = currency();
        const mine = ++request;
        const cached = loaded.get(fiat);
        if (cached) {
            render(cached, fiat);
            return;
        }
        seriesFor(fiat)
            .then((series) => {
                if (!disposed && mine === request) render(series, fiat);
            })
            .catch(() => {
                if (!disposed && mine === request) showMessage(DCA.loadFailed);
            });
    }

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const series = loaded.get(currency());
            if (!series) return;
            setMonthField(monthFieldset, presetMonth(button.dataset.preset as DcaPreset, endMonth(series)));
            update();
        });
    }
    update();

    return () => {
        disposed = true;
        window.clearTimeout(settleTimer);
        share.dispose();
        scene.dispose();
    };
}
