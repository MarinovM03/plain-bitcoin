import { hrefFor } from '../app/routes.ts';
import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { FIELDS, LEFT_PAGE, TOOL_PAGE, TOOLS } from './copy.ts';
import { amountField, monthField, segmentedControl, selectField, textField } from './fields.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine, resultBlock, shareBar, sourceLine } from './output.ts';

type CalculatorId = Exclude<ToolId, 'left'>;

const EARLIEST_MONTH: Month = { year: 2010, month: 7 };

const CURRENCIES = [
    { value: 'GBP', label: FIELDS.pounds },
    { value: 'USD', label: FIELDS.dollars },
] as const;

function thisMonth(): Month {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function renderInputs(id: CalculatorId): SafeHtml {
    switch (id) {
        case 'power':
            return html`${amountField({ id: 'power-amount', label: FIELDS.amount, decimals: 2, placeholder: FIELDS.examples.power })}
${segmentedControl({ name: 'power-currency', legend: FIELDS.currency, choices: CURRENCIES, selected: 'GBP' })}
${monthField({ id: 'power-when', legend: FIELDS.when, min: EARLIEST_MONTH, max: thisMonth(), value: { year: 2015, month: 1 } })}`;
        case 'convert':
            return html`${amountField({ id: 'convert-amount', label: FIELDS.amount, decimals: 8, placeholder: FIELDS.examples.convert })}
${selectField({
    id: 'convert-unit',
    label: FIELDS.unit,
    selected: 'sats',
    choices: Object.entries(FIELDS.units).map(([value, label]) => ({ value, label })),
})}`;
        case 'dca':
            return html`${amountField({ id: 'dca-amount', label: FIELDS.eachBuy, decimals: 2, placeholder: FIELDS.examples.dca })}
${segmentedControl({
    name: 'dca-often',
    legend: FIELDS.howOften,
    selected: 'weekly',
    choices: [
        { value: 'weekly', label: FIELDS.weekly },
        { value: 'monthly', label: FIELDS.monthly },
    ],
})}
${monthField({ id: 'dca-start', legend: FIELDS.starting, min: EARLIEST_MONTH, max: thisMonth(), value: { year: 2020, month: 1 } })}`;
        case 'address':
            return html`${textField({ id: 'address-input', label: FIELDS.address, placeholder: FIELDS.examples.address })}
<button class="button button--block" type="submit" disabled>${FIELDS.lookUp}</button>
${noteLine(FIELDS.lookUpNote)}`;
    }
}

function renderHead(id: ToolId, heading: SafeHtml): SafeHtml {
    return html`<a class="back-link" href="${hrefFor('home')}"><span aria-hidden="true">←</span> ${TOOL_PAGE.back}</a>
${heading}
<p class="tool__question">${TOOLS[id].question}</p>`;
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const title = html`<h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>`;
    return html`<article class="tool">
    ${renderHead(id, title)}
    <div class="tool__body">
        <form class="tool__inputs" aria-label="${TOOL_PAGE.inputsLabel}" novalidate>
            ${noteLine(TOOL_PAGE.pending)}
            ${renderInputs(id)}
        </form>
        <section class="tool__output" aria-labelledby="tool-result-label">
            <div class="tool__dock">
                ${resultBlock({ id: 'tool-result', label: TOOL_PAGE.resultLabel, empty: TOOL_PAGE.resultEmpty })}
                ${shareBar()}
            </div>
            ${sourceLine()}
            <p class="privacy-line">${TOOLS[id].privacy}</p>
        </section>
    </div>
</article>`;
}

function renderLeft(): SafeHtml {
    return html`<article class="tool tool--left">
    ${renderHead('left', renderHero())}
    <section class="numbers" aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" class="numbers__heading">${LEFT_PAGE.numbersHeading}</h2>
        <div id="numbers-panel" class="numbers__panel">
            <p class="numbers__empty">${LEFT_PAGE.numbersEmpty}</p>
        </div>
        ${shareBar()}
        ${sourceLine()}
        <p class="privacy-line">${TOOLS.left.privacy}</p>
    </section>
</article>`;
}

export function renderToolPage(id: ToolId): SafeHtml {
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
