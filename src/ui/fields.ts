import { type Month, monthLabel, monthsIn, monthValue, yearsBetween } from '../util/month.ts';
import { FIELDS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export interface Choice {
    value: string;
    label: string;
}

export const CURRENCY_CHOICES = [
    { value: 'GBP', label: FIELDS.pounds },
    { value: 'USD', label: FIELDS.dollars },
] as const;

export function amountField(options: {
    id: string;
    label: string;
    decimals: number;
    placeholder?: string;
    value?: string;
    inputmode?: 'decimal' | 'numeric';
}): SafeHtml {
    return html`<div class="field">
    <label class="field__label" for="${options.id}">${options.label}</label>
    <div class="field__control">
        <input id="${options.id}" class="field__input field__input--amount" type="text" inputmode="${options.inputmode ?? 'decimal'}" autocomplete="off" spellcheck="false" enterkeyhint="done" data-decimals="${options.decimals}" placeholder="${options.placeholder ?? ''}" value="${options.value ?? ''}" />
    </div>
</div>`;
}

export function textField(options: { id: string; label: string; placeholder?: string }): SafeHtml {
    return html`<div class="field">
    <label class="field__label" for="${options.id}">${options.label}</label>
    <div class="field__control">
        <input id="${options.id}" class="field__input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="${options.placeholder ?? ''}" />
    </div>
</div>`;
}

export function segmentedControl(options: {
    name: string;
    legend: string;
    choices: readonly Choice[];
    selected: string;
}): SafeHtml {
    const segments = options.choices.map(
        (choice) => html`<label class="segmented__option">
            <input class="segmented__input" type="radio" name="${options.name}" value="${choice.value}"${choice.value === options.selected ? html` checked` : ''} />
            <span class="segmented__text">${choice.label}</span>
        </label>`,
    );
    return html`<fieldset class="field segmented">
    <legend class="field__label">${options.legend}</legend>
    <div class="segmented__track">${segments}</div>
</fieldset>`;
}

function selectControl(id: string, choices: readonly Choice[], selected: string, extra: SafeHtml | '' = ''): SafeHtml {
    const items = choices.map(
        (choice) =>
            html`<option value="${choice.value}"${choice.value === selected ? html` selected` : ''}>${choice.label}</option>`,
    );
    return html`<div class="field__control field__control--select">
        <select id="${id}" class="field__select"${extra}>${items}</select>
    </div>`;
}

export function monthField(options: { id: string; legend: string; min: Month; max: Month; value: Month }): SafeHtml {
    const months = monthsIn(options.value.year, options.min, options.max).map((month) => ({
        value: String(month),
        label: monthLabel(month),
    }));
    const years = yearsBetween(options.min, options.max).map((year) => ({ value: String(year), label: String(year) }));
    return html`<fieldset class="field month-field" data-min="${monthValue(options.min)}" data-max="${monthValue(options.max)}">
    <legend class="field__label">${options.legend}</legend>
    <div class="month-field__parts">
        <div class="month-field__part">
            <label class="visually-hidden" for="${options.id}-month">${FIELDS.month}</label>
            ${selectControl(`${options.id}-month`, months, String(options.value.month), html` data-part="month"`)}
        </div>
        <div class="month-field__part">
            <label class="visually-hidden" for="${options.id}-year">${FIELDS.year}</label>
            ${selectControl(`${options.id}-year`, years, String(options.value.year), html` data-part="year"`)}
        </div>
    </div>
</fieldset>`;
}
