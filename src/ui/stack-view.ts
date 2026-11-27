import { FIELDS, STACK } from './copy.ts';
import { amountField, CURRENCY_CHOICES, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';

export const STACK_ROWS = ['yearAgo', 'high', 'low'] as const;

export function renderStackInputs(): SafeHtml {
    return html`${amountField({ id: 'stack-amount', label: STACK.amount, decimals: 8, placeholder: '0.01', value: '0.01' })}
${segmentedControl({
    name: 'stack-unit',
    legend: STACK.unit,
    choices: [
        { value: 'btc', label: STACK.units.btc },
        { value: 'sats', label: STACK.units.sats },
    ],
    selected: 'btc',
})}`;
}

/** Keeping is always a deliberate tap, right under the answer it keeps. */
export function renderStackKeep(): SafeHtml {
    return html`<div class="keep">
    <div class="keep__actions">
        <button id="stack-keep" class="button button--primary" type="button" disabled>${STACK.keep}</button>
        <button id="stack-forget" class="button" type="button" hidden>${STACK.forget}</button>
    </div>
    <p id="stack-keep-note" class="note-line" aria-live="polite">${STACK.notKept}</p>
</div>`;
}

export function renderStackMore(): SafeHtml {
    return segmentedControl({
        name: 'stack-currency',
        legend: FIELDS.currency,
        choices: CURRENCY_CHOICES,
        selected: 'USD',
    });
}

export function renderStackDetail(): SafeHtml {
    const rows = STACK_ROWS.map(
        (row) => html`<div class="stat">
            <dt>${STACK.rows[row]}</dt>
            <dd id="stack-${row}"></dd>
        </div>`,
    );
    return html`<div id="stack-detail" class="tool__more stack-detail" hidden>
    <section class="details" aria-labelledby="stack-numbers-label">
        <h2 id="stack-numbers-label" class="details__title">${STACK.numbersHeading}</h2>
        <dl class="stats">${rows}</dl>
    </section>
</div>`;
}
