import { type DeleteDirection, deleteAcrossSeparator, formatAmountInput } from '../util/amount-input.ts';
import { clampMonth, monthLabel, monthsIn, parseMonth } from '../util/month.ts';

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

export function bindMonthField(fieldset: HTMLFieldSetElement): void {
    const min = parseMonth(fieldset.dataset.min ?? '');
    const max = parseMonth(fieldset.dataset.max ?? '');
    const monthSelect = fieldset.querySelector<HTMLSelectElement>('[data-part="month"]');
    const yearSelect = fieldset.querySelector<HTMLSelectElement>('[data-part="year"]');
    if (!min || !max || !monthSelect || !yearSelect) return;

    yearSelect.addEventListener('change', () => {
        const year = Number(yearSelect.value);
        const kept = clampMonth({ year, month: Number(monthSelect.value) }, min, max);
        const options = monthsIn(year, min, max).map((month) => {
            const option = document.createElement('option');
            option.value = String(month);
            option.textContent = monthLabel(month);
            option.selected = month === kept.month;
            return option;
        });
        monthSelect.replaceChildren(...options);
    });
}

export function bindFields(root: ParentNode): void {
    for (const form of root.querySelectorAll('form'))
        form.addEventListener('submit', (event) => event.preventDefault());
    for (const input of root.querySelectorAll<HTMLInputElement>('.field__input--amount')) bindAmountInput(input);
    for (const fieldset of root.querySelectorAll<HTMLFieldSetElement>('.month-field')) bindMonthField(fieldset);
}
