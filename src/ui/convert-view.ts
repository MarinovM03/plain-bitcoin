import type { Unit } from '../model/convert.ts';
import { CONVERT } from './copy.ts';
import { amountField } from './fields.ts';
import { html, type SafeHtml } from './html.ts';

export const CONVERT_UNITS = ['sats', 'btc', 'gbp', 'usd'] as const satisfies readonly Unit[];

export const CONVERT_DECIMALS: Record<Unit, number> = { sats: 0, btc: 8, gbp: 2, usd: 2 };

export type ConvertPreset = keyof typeof CONVERT.presets;

export const CONVERT_PRESETS: Record<ConvertPreset, { unit: Unit; value: string }> = {
    sat: { unit: 'sats', value: '1' },
    thousand: { unit: 'sats', value: '1,000' },
    hundredThousand: { unit: 'sats', value: '100,000' },
    cent: { unit: 'btc', value: '0.01' },
    coin: { unit: 'btc', value: '1' },
    pizza: { unit: 'btc', value: '10,000' },
};

export const CONVERT_DEFAULT: ConvertPreset = 'hundredThousand';

function presetButton(preset: ConvertPreset): SafeHtml {
    const hint = CONVERT.presetHints[preset];
    return html`<button class="chip${hint ? ' chip--hint' : ''}" type="button" data-preset="${preset}" aria-pressed="${String(preset === CONVERT_DEFAULT)}">${CONVERT.presets[preset]}${hint ? html`<span class="chip__hint">${hint}</span>` : ''}</button>`;
}

export function renderConvertInputs(): SafeHtml {
    const start = CONVERT_PRESETS[CONVERT_DEFAULT];
    const fields = CONVERT_UNITS.map((unit) =>
        amountField({
            id: `convert-${unit}`,
            label: CONVERT.fields[unit],
            decimals: CONVERT_DECIMALS[unit],
            placeholder: '0',
            inputmode: unit === 'sats' ? 'numeric' : 'decimal',
            ...(unit === start.unit ? { value: start.value } : {}),
        }),
    );
    const presets = (Object.keys(CONVERT_PRESETS) as ConvertPreset[]).map(presetButton);
    return html`<div class="convert-fields">${fields}</div>
<p id="convert-note" class="note-line" role="status" hidden></p>
<fieldset class="field presets">
    <legend class="field__label">${CONVERT.presetsLabel}</legend>
    <div class="presets__list">${presets}</div>
</fieldset>`;
}

export function renderConvertDetail(): SafeHtml {
    return html`<p class="convert-ref">${CONVERT.unitsLine}<span class="convert-ref__sep" aria-hidden="true"> · </span><span id="convert-ref-sat"></span></p>`;
}
