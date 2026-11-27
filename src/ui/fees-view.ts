import { PAYMENT_TYPES, SPEEDS } from '../model/fees.ts';
import { FEES } from './copy.ts';
import { amountField, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine } from './output.ts';

export function renderFeesInputs(): SafeHtml {
    return html`${segmentedControl({
        name: 'fees-type',
        legend: FEES.type,
        choices: PAYMENT_TYPES.map((type) => ({ value: type, label: FEES.types[type] })),
        selected: 'segwit',
    })}
${amountField({ id: 'fees-inputs', label: FEES.inputs, decimals: 0, placeholder: '1', value: '1', inputmode: 'numeric' })}`;
}

export function renderFeesMore(): SafeHtml {
    return html`${amountField({ id: 'fees-outputs', label: FEES.outputs, decimals: 0, placeholder: '2', value: '2', inputmode: 'numeric' })}
${noteLine(FEES.outputsNote)}`;
}

export function renderFeesDetail(): SafeHtml {
    const rows = SPEEDS.map(
        (speed) => html`<div class="stat">
            <dt>${FEES.speeds[speed]}</dt>
            <dd id="fees-${speed}"></dd>
        </div>`,
    );
    return html`<div id="fees-detail" class="tool__more fees-detail" hidden>
    <section class="details" aria-labelledby="fees-table-label">
        <h2 id="fees-table-label" class="details__title">${FEES.tableHeading}</h2>
        <dl class="stats">${rows}</dl>
    </section>
    <section class="details" aria-labelledby="fees-how-label">
        <h2 id="fees-how-label" class="details__title">${FEES.howHeading}</h2>
        <p class="formula">${FEES.formula}</p>
        ${noteLine(FEES.caution)}
    </section>
</div>`;
}
