import type { FiatUnit, Unit } from '../model/convert.ts';
import type { Currency } from '../util/format.ts';
import { CONVERT, FIELDS } from './copy.ts';
import { amountField, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';

/** The three boxes on the page. The money box holds whichever currency is picked. */
export const CONVERT_SLOTS = ['sats', 'btc', 'fiat'] as const;

export type ConvertSlot = (typeof CONVERT_SLOTS)[number];

export const CONVERT_CURRENCIES = ['usd', 'eur', 'gbp'] as const satisfies readonly FiatUnit[];

export const CONVERT_CURRENCY_DEFAULT: FiatUnit = 'usd';

export const CURRENCY_CODE: Record<FiatUnit, Currency> = { usd: 'USD', eur: 'EUR', gbp: 'GBP' };

const CURRENCY_LABEL: Record<FiatUnit, string> = { usd: FIELDS.dollars, eur: FIELDS.euros, gbp: FIELDS.pounds };

export const CONVERT_DECIMALS: Record<Unit, number> = { sats: 0, btc: 8, usd: 2, eur: 2, gbp: 2 };

export type ConvertPreset = keyof typeof CONVERT.presets;

export const CONVERT_PRESETS: Record<ConvertPreset, { unit: 'sats' | 'btc'; value: string }> = {
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

function slotField(slot: ConvertSlot): SafeHtml {
    const start = CONVERT_PRESETS[CONVERT_DEFAULT];
    const unit: Unit = slot === 'fiat' ? CONVERT_CURRENCY_DEFAULT : slot;
    return amountField({
        id: `convert-${slot}`,
        label: CONVERT.fields[unit],
        decimals: CONVERT_DECIMALS[unit],
        placeholder: '0',
        inputmode: slot === 'sats' ? 'numeric' : 'decimal',
        ...(slot === start.unit ? { value: start.value } : {}),
    });
}

export function renderConvertInputs(): SafeHtml {
    return html`<div class="convert-fields">
    ${slotField('sats')}${slotField('btc')}
    <div class="convert-fields__money">
        ${slotField('fiat')}
        ${segmentedControl({
            name: 'convert-currency',
            legend: CONVERT.currencyLabel,
            choices: CONVERT_CURRENCIES.map((unit) => ({ value: unit, label: CURRENCY_LABEL[unit] })),
            selected: CONVERT_CURRENCY_DEFAULT,
        })}
    </div>
</div>
<p id="convert-note" class="note-line" role="status" hidden></p>`;
}

export function renderConvertMore(): SafeHtml {
    const presets = (Object.keys(CONVERT_PRESETS) as ConvertPreset[]).map(presetButton);
    return html`<fieldset class="presets">
    <legend class="visually-hidden">${CONVERT.presetsLabel}</legend>
    <div class="presets__list">${presets}</div>
</fieldset>`;
}

export function renderConvertDetail(): SafeHtml {
    return html`<p class="convert-ref">${CONVERT.unitsLine}<span class="convert-ref__sep" aria-hidden="true"> · </span><span id="convert-ref-sat"></span></p>`;
}
