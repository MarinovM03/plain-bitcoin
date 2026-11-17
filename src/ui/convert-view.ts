import type { FiatUnit, Unit } from '../model/convert.ts';
import type { Currency } from '../util/format.ts';
import { CONVERT, FIELDS, TOOL_PAGE, TOOLS } from './copy.ts';
import { amountField, segmentedControl } from './fields.ts';
import { html, type SafeHtml } from './html.ts';
import { resultBlock, shareSection, sourceLine } from './output.ts';

/** The three amounts on the page. The money one holds whichever currency is picked. */
export const CONVERT_SLOTS = ['sats', 'btc', 'fiat'] as const;

export type ConvertSlot = (typeof CONVERT_SLOTS)[number];

export const CONVERT_CURRENCIES = ['usd', 'eur', 'gbp'] as const satisfies readonly FiatUnit[];

export const CONVERT_CURRENCY_DEFAULT: FiatUnit = 'usd';

export const CURRENCY_CODE: Record<FiatUnit, Currency> = { usd: 'USD', eur: 'EUR', gbp: 'GBP' };

const CURRENCY_LABEL: Record<FiatUnit, string> = { usd: FIELDS.dollars, eur: FIELDS.euros, gbp: FIELDS.pounds };

export const CONVERT_DECIMALS: Record<Unit, number> = { sats: 0, btc: 8, usd: 2, eur: 2, gbp: 2 };

const START_SATS = '100,000';

/** The scrubber runs from 1 sat to 1 BTC in this many steps, each the same share bigger than the last. */
export const SCRUB_STEPS = 800;

function slotField(slot: ConvertSlot): SafeHtml {
    const unit: Unit = slot === 'fiat' ? CONVERT_CURRENCY_DEFAULT : slot;
    return amountField({
        id: `convert-${slot}`,
        label: CONVERT.fields[unit],
        decimals: CONVERT_DECIMALS[unit],
        placeholder: '0',
        inputmode: slot === 'sats' ? 'numeric' : 'decimal',
        ...(slot === 'sats' ? { value: START_SATS } : {}),
    });
}

/**
 * The converter as one column of type standing on the world: the amount you type, the answer, the same amount in
 * the other units, the money switch, and a line to drag from 1 sat to 1 BTC.
 */
export function renderConvert(head: SafeHtml): SafeHtml {
    return html`<article class="tool tool--convert play">
    <div class="play__top veil rise">
        ${head}
        <form class="play__amount" aria-label="${TOOL_PAGE.inputsLabel}" novalidate>${slotField('sats')}</form>
        ${resultBlock({ id: 'tool-result', label: TOOL_PAGE.resultLabel, empty: TOOL_PAGE.resultEmpty })}
    </div>
    <form class="play__controls rise" aria-label="${CONVERT.othersLabel}" novalidate>
        <div class="play__others">${slotField('btc')}${slotField('fiat')}</div>
        ${segmentedControl({
            name: 'convert-currency',
            legend: CONVERT.currencyLabel,
            choices: CONVERT_CURRENCIES.map((unit) => ({ value: unit, label: CURRENCY_LABEL[unit] })),
            selected: CONVERT_CURRENCY_DEFAULT,
        })}
        <p id="convert-note" class="note-line" role="status" hidden></p>
        <div class="scrub">
            <label class="field__label" for="convert-scrub">${CONVERT.scrub}</label>
            <input id="convert-scrub" class="scrub__range" type="range" min="0" max="${SCRUB_STEPS}" step="1" value="0" />
            <p class="scrub__ends" aria-hidden="true"><span>${CONVERT.scrubLow}</span><span>${CONVERT.scrubHigh}</span></p>
        </div>
        <p id="convert-point" class="play__point">${CONVERT.pointEmpty}</p>
    </form>
    <div class="play__below rise">
        ${shareSection()}
        <p class="convert-ref">${CONVERT.unitsLine}<span class="convert-ref__sep" aria-hidden="true"> · </span><span id="convert-ref-sat"></span></p>
        ${sourceLine(TOOLS.convert.privacy)}
    </div>
</article>`;
}
