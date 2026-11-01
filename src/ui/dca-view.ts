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

export const CHART_WIDTH = 300;
export const CHART_HEIGHT = 120;

export function renderDcaInputs(min: Month, max: Month): SafeHtml {
    const presets = DCA_PRESETS.map(
        (preset) =>
            html`<button class="chip" type="button" data-preset="${preset}" aria-pressed="false">${DCA.presets[preset]}</button>`,
    );
    return html`<div class="field-row">
    ${amountField({ id: 'dca-amount', label: FIELDS.eachBuy, decimals: 2, placeholder: FIELDS.examples.dca, value: '50' })}
    ${segmentedControl({ name: 'dca-currency', legend: FIELDS.currency, choices: CURRENCY_CHOICES, selected: 'GBP' })}
</div>
<div class="field-pair">
    ${segmentedControl({
        name: 'dca-often',
        legend: FIELDS.howOften,
        selected: 'weekly',
        choices: (Object.keys(DCA.frequencies) as Frequency[]).map((value) => ({
            value,
            label: DCA.frequencies[value],
        })),
    })}
    ${monthField({ id: 'dca-start', legend: FIELDS.starting, min, max, value: DCA_DEFAULT_START })}
</div>
<fieldset class="field presets">
    <legend class="field__label">${DCA.presetsLabel}</legend>
    <div class="presets__list">${presets}</div>
</fieldset>
${amountField({ id: 'dca-fee', label: DCA.fee, decimals: 2, placeholder: '0' })}`;
}

function legendItem(kind: string, label: string): SafeHtml {
    return html`<li class="chart-legend__item"><span class="chart-legend__key chart-legend__key--${kind}" aria-hidden="true"></span>${label}</li>`;
}

export function renderDcaDetail(): SafeHtml {
    const rows = DCA_ROWS.map(
        (row) => html`<div class="stat${SENTENCE_ROWS.has(row) ? ' stat--text' : ''}">
            <dt>${DCA.rows[row]}</dt>
            <dd id="dca-${row}"></dd>
        </div>`,
    );
    return html`<div id="dca-detail" class="tool__more dca-detail" hidden>
    <section class="details dca-detail__chart" aria-labelledby="dca-chart-label">
        <h2 id="dca-chart-label" class="details__title">${DCA.chartLabel}</h2>
        <svg id="dca-chart" class="dca-chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="">
            <line class="dca-chart__base" x1="0" x2="${CHART_WIDTH}" y1="${CHART_HEIGHT}" y2="${CHART_HEIGHT}" />
            <polyline class="dca-chart__line dca-chart__line--invested" points="" />
            <polyline class="dca-chart__line dca-chart__line--lump" points="" />
            <polyline class="dca-chart__line dca-chart__line--value" points="" />
        </svg>
        <ul class="chart-legend">
            ${legendItem('value', DCA.legend.value)}
            ${legendItem('invested', DCA.legend.invested)}
            ${legendItem('lump', DCA.legend.lump)}
        </ul>
    </section>
    <section class="details dca-detail__numbers" aria-labelledby="dca-numbers-label">
        <h2 id="dca-numbers-label" class="details__title">${DCA.numbersHeading}</h2>
        <dl class="stats">${rows}</dl>
    </section>
    <section class="details dca-detail__how" aria-labelledby="dca-how-label">
        <h2 id="dca-how-label" class="details__title">${POWER.howHeading}</h2>
        <div id="dca-notes" class="dca-detail__notes"></div>
        <p class="formula">${DCA.formula}</p>
        ${noteLine(POWER.caution)}
    </section>
</div>`;
}
