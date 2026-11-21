import type { MachineId } from '../hero/bus.ts';
import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressDetail, renderAddressInputs, renderAddressMore } from './address-view.ts';
import { renderConvert } from './convert-view.ts';
import { ADDRESS, FIELDS, PICTURE, POWER, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs, renderDcaMore } from './dca-view.ts';
import { html, type SafeHtml } from './html.ts';
import { renderLeft } from './left-view.ts';
import { moreOptions, pictureFrame, resultBlock, shareSection, sourceLine } from './output.ts';
import { renderPowerDetail, renderPowerInputs, renderPowerMore, renderPowerYears } from './power-view.ts';

type CalculatorId = Exclude<ToolId, 'miner' | 'halving' | 'tx' | 'left' | 'convert'>;

interface Calculator {
    inputs: SafeHtml;
    more: [string, SafeHtml];
    detail: SafeHtml;
    caption: string;
    below?: SafeHtml;
}

const EARLIEST_MONTH: Month = { year: 2010, month: 7 };

function thisMonth(): Month {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function calculator(id: CalculatorId): Calculator {
    switch (id) {
        case 'power':
            return {
                inputs: renderPowerInputs(EARLIEST_MONTH, thisMonth()),
                more: [POWER.presetsLabel, renderPowerMore()],
                detail: renderPowerDetail(),
                caption: PICTURE.powerEmpty,
                below: renderPowerYears(EARLIEST_MONTH, thisMonth()),
            };
        case 'dca':
            return {
                inputs: renderDcaInputs(),
                more: [FIELDS.more, renderDcaMore(EARLIEST_MONTH, thisMonth())],
                detail: renderDcaDetail(),
                caption: PICTURE.dcaEmpty,
            };
        case 'address':
            return {
                inputs: renderAddressInputs(),
                more: [ADDRESS.samplesLabel, renderAddressMore()],
                detail: renderAddressDetail(),
                caption: PICTURE.addressEmpty,
            };
    }
}

export function toolHead(id: ToolId): SafeHtml {
    return html`<header class="tool__head">
    <h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>
    <p class="tool__description">${TOOLS[id].description}</p>
</header>`;
}

const SCENES: Record<CalculatorId, MachineId> = { power: 'melt', dca: 'stack', address: 'address' };

/**
 * A calculator page, in reading order: its plain name, the inputs, the answer, the picture, its scene, then
 * sharing and the rest. On a wide screen the scene stands beside the calculator.
 */
function page(id: CalculatorId, screen: SafeHtml, below: SafeHtml): SafeHtml {
    return html`<article class="tool tool--${id} machine">
    <div class="machine__body">
        <div class="tool__screen">${toolHead(id)}${screen}</div>
        <div class="machine__stage" data-machine="${SCENES[id]}" aria-hidden="true"></div>
        <div class="tool__below">${below}</div>
    </div>
</article>`;
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const address = id === 'address';
    const parts = calculator(id);
    return page(
        id,
        html`<form class="tool__inputs" aria-label="${address ? TOOL_PAGE.addressLabel : TOOL_PAGE.inputsLabel}" novalidate>
            <div class="tool__fields">${parts.inputs}</div>
        </form>
        ${resultBlock({
            id: 'tool-result',
            label: address ? ADDRESS.resultLabel : TOOL_PAGE.resultLabel,
            empty: address ? ADDRESS.empty : TOOL_PAGE.resultEmpty,
        })}
        ${pictureFrame(parts.caption)}
        ${parts.below ?? ''}
        ${shareSection()}
        <form class="tool__more" novalidate>${moreOptions(...parts.more)}</form>`,
        html`${parts.detail}
        ${sourceLine(TOOLS[id].privacy, address ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending)}`,
    );
}

export function renderToolPage(id: Exclude<ToolId, 'miner' | 'halving' | 'tx'>): SafeHtml {
    if (id === 'convert') return renderConvert(toolHead(id));
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
