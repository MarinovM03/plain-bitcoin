import type { Month } from '../util/month.ts';
import { FIELDS, POWER } from './copy.ts';
import { amountField, CURRENCY_CHOICES, monthField, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine } from './output.ts';

export const POWER_DEFAULT_START: Month = { year: 2015, month: 1 };

export const POWER_PRESETS = ['y2015', 'fiveYears', 'oneYear', 'worst'] as const;

export type PowerPreset = (typeof POWER_PRESETS)[number];

export function renderPowerInputs(min: Month, max: Month): SafeHtml {
    const presets = POWER_PRESETS.map(
        (preset) =>
            html`<button class="chip" type="button" data-preset="${preset}" aria-pressed="false">${POWER.presets[preset]}</button>`,
    );
    return html`<div class="field-row">
    ${amountField({ id: 'power-amount', label: FIELDS.amount, decimals: 2, placeholder: FIELDS.examples.power, value: '1,000' })}
    ${segmentedControl({ name: 'power-currency', legend: FIELDS.currency, choices: CURRENCY_CHOICES, selected: 'GBP' })}
</div>
${monthField({ id: 'power-when', legend: FIELDS.when, min, max, value: POWER_DEFAULT_START })}
<fieldset class="field presets">
    <legend class="field__label">${POWER.presetsLabel}</legend>
    <div class="presets__list">${presets}</div>
</fieldset>`;
}

function bar(kind: 'cash' | 'btc', name: string): SafeHtml {
    return html`<div class="bar bar--${kind}">
    <p class="bar__head"><span class="bar__name">${name}</span> <span id="power-${kind}-value" class="bar__value"></span></p>
    <div class="bar__track" aria-hidden="true"><div id="power-${kind}-fill" class="bar__fill"></div></div>
    <p id="power-${kind}-note" class="bar__note"></p>
</div>`;
}

export function renderPowerDetail(): SafeHtml {
    return html`<div id="power-detail" class="power-detail" hidden>
    <section class="power-detail__part" aria-labelledby="power-bars-label">
        <h2 id="power-bars-label" class="power-detail__label">${POWER.barsLabel}</h2>
        ${bar('cash', POWER.cash)}
        ${bar('btc', POWER.asBitcoin)}
        <p id="power-scale" class="power-detail__scale" hidden></p>
    </section>
    <div class="power-detail__part">
        <p id="power-path" class="power-detail__path"></p>
        <svg id="power-spark" class="spark" viewBox="0 0 300 48" preserveAspectRatio="none" role="img" aria-label="${POWER.pathLabel}">
            <line class="spark__base" x1="0" x2="300" y1="0" y2="0" />
            <polyline class="spark__line" points="" />
        </svg>
    </div>
    <p class="power-detail__formula">${POWER.formula}</p>
    ${noteLine(POWER.caution)}
</div>`;
}
