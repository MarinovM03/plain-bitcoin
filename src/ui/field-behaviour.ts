import { type DeleteDirection, deleteAcrossSeparator, formatAmountInput } from '../util/amount-input.ts';
import { clampMonth, type Month, monthLabel, monthsIn, monthValue, parseMonth, yearsBetween } from '../util/month.ts';

const DELETES: Partial<Record<string, DeleteDirection>> = {
    deleteContentBackward: 'backward',
    deleteContentForward: 'forward',
};

function applyAmount(input: HTMLInputElement, raw: string, caret: number): void {
    const decimals = Number(input.dataset.decimals ?? '0');
    const next = formatAmountInput(raw, caret, decimals);
    input.value = next.text;
    if (document.activeElement === input) input.setSelectionRange(next.caret, next.caret);
}

export function bindAmountInput(input: HTMLInputElement): void {
    input.addEventListener('beforeinput', (event) => {
        const direction = DELETES[event.inputType];
        const caret = input.selectionStart;
        if (!direction || caret === null || caret !== input.selectionEnd) return;
        const deleted = deleteAcrossSeparator(input.value, caret, direction);
        if (!deleted) return;
        event.preventDefault();
        applyAmount(input, deleted.text, deleted.caret);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', () => applyAmount(input, input.value, input.selectionStart ?? input.value.length));
}

function monthParts(fieldset: HTMLFieldSetElement) {
    const min = parseMonth(fieldset.dataset.min ?? '');
    const max = parseMonth(fieldset.dataset.max ?? '');
    const monthSelect = fieldset.querySelector<HTMLSelectElement>('[data-part="month"]');
    const yearSelect = fieldset.querySelector<HTMLSelectElement>('[data-part="year"]');
    return min && max && monthSelect && yearSelect ? { min, max, monthSelect, yearSelect } : null;
}

function options(values: number[], label: (value: number) => string, selected: number): HTMLOptionElement[] {
    return values.map((value) => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = label(value);
        option.selected = value === selected;
        return option;
    });
}

export function readMonthField(fieldset: HTMLFieldSetElement): Month | null {
    const parts = monthParts(fieldset);
    if (!parts) return null;
    return { year: Number(parts.yearSelect.value), month: Number(parts.monthSelect.value) };
}

export function setMonthField(fieldset: HTMLFieldSetElement, value: Month, range?: { min: Month; max: Month }): void {
    if (range) {
        fieldset.dataset.min = monthValue(range.min);
        fieldset.dataset.max = monthValue(range.max);
    }
    const parts = monthParts(fieldset);
    if (!parts) return;
    const kept = clampMonth(value, parts.min, parts.max);
    parts.yearSelect.replaceChildren(...options(yearsBetween(parts.min, parts.max), String, kept.year));
    parts.monthSelect.replaceChildren(...options(monthsIn(kept.year, parts.min, parts.max), monthLabel, kept.month));
}

export function bindMonthField(fieldset: HTMLFieldSetElement): void {
    const parts = monthParts(fieldset);
    if (!parts) return;
    parts.yearSelect.addEventListener('change', () => {
        const current = readMonthField(fieldset);
        if (current) setMonthField(fieldset, current);
    });
}

export function bindFields(root: ParentNode): void {
    for (const form of root.querySelectorAll('form'))
        form.addEventListener('submit', (event) => event.preventDefault());
    for (const input of root.querySelectorAll<HTMLInputElement>('.field__input--amount')) bindAmountInput(input);
    for (const fieldset of root.querySelectorAll<HTMLFieldSetElement>('.month-field')) bindMonthField(fieldset);
}
