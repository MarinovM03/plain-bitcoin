import type { Frequency } from '../model/dca.ts';
import type { Month } from '../util/month.ts';
import { DCA, FIELDS, POWER } from './copy.ts';
import { amountField, CURRENCY_CHOICES, monthField, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine } from './output.ts';

export const DCA_DEFAULT_START: Month = { year: 2020, month: 1 };

export const DCA_PRESETS = ['y2020', 'fiveYears', 'oneYear'] as const;

export type DcaPreset = (typeof DCA_PRESETS)[number];

export const DCA_ROWS = ['invested', 'bought', 'worth', 'average', 'buys', 'fall', 'lump'] as const;

const SENTENCE_ROWS: ReadonlySet<string> = new Set(['buys', 'fall', 'lump']);

/** The amount, the money and when the buying started: the start decides the answer more than anything else. */
export function renderDcaInputs(min: Month, max: Month): SafeHtml {
    return html`<div class="field-row">
    ${amountField({ id: 'dca-amount', label: FIELDS.eachBuy, decimals: 2, placeholder: FIELDS.examples.dca, value: '50' })}
    ${segmentedControl({ name: 'dca-currency', legend: FIELDS.currency, choices: CURRENCY_CHOICES, selected: 'USD' })}
</div>
${monthField({ id: 'dca-start', legend: FIELDS.starting, min, max, value: DCA_DEFAULT_START })}`;
}

export function renderDcaMore(): SafeHtml {
    const presets = DCA_PRESETS.map(
        (preset) =>
            html`<button class="chip" type="button" data-preset="${preset}" aria-pressed="false">${DCA.presets[preset]}</button>`,
    );
    return html`<fieldset class="presets">
    <legend class="visually-hidden">${DCA.presetsLabel}</legend>
    <div class="presets__list">${presets}</div>
</fieldset>
${segmentedControl({
    name: 'dca-often',
    legend: FIELDS.howOften,
    selected: 'weekly',
    choices: (Object.keys(DCA.frequencies) as Frequency[]).map((value) => ({
        value,
        label: DCA.frequencies[value],
    })),
})}
${amountField({ id: 'dca-fee', label: DCA.fee, decimals: 2, placeholder: '0' })}`;
}

/** The chart's key, in words a first-time reader can follow, with the same strokes the lines use. */
export function renderDcaKey(): SafeHtml {
    const items = (['value', 'invested', 'lump'] as const).map(
        (key) => html`<li class="picture__key-item picture__key-item--${key}">${DCA.key[key]}</li>`,
    );
    return html`<ul class="picture__key">${items}</ul>`;
}

export function renderDcaDetail(): SafeHtml {
    const rows = DCA_ROWS.map(
        (row) => html`<div class="stat${SENTENCE_ROWS.has(row) ? ' stat--text' : ''}">
            <dt>${DCA.rows[row]}</dt>
            <dd id="dca-${row}"></dd>
        </div>`,
    );
    return html`<div id="dca-detail" class="tool__more dca-detail" hidden>
    <section class="details" aria-labelledby="dca-numbers-label">
        <h2 id="dca-numbers-label" class="details__title">${DCA.numbersHeading}</h2>
        <dl class="stats">${rows}</dl>
    </section>
    <section class="details" aria-labelledby="dca-how-label">
        <h2 id="dca-how-label" class="details__title">${POWER.howHeading}</h2>
        <div id="dca-notes" class="dca-detail__notes"></div>
        <p class="formula">${DCA.formula}</p>
        ${noteLine(POWER.caution)}
    </section>
</div>`;
}
