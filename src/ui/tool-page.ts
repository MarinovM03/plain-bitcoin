import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressDetail, renderAddressInputs, renderAddressMore } from './address-view.ts';
import { renderConvert } from './convert-view.ts';
import { ADDRESS, FIELDS, PICTURE, POWER, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs, renderDcaKey, renderDcaMore } from './dca-view.ts';
import { renderFeesDetail, renderFeesInputs, renderFeesMore } from './fees-view.ts';
import { html, type SafeHtml } from './html.ts';
import { renderLeft } from './left-view.ts';
import { infoPanel, moreOptions, pictureFrame, resultBlock, shareSection, sourceLine } from './output.ts';
import { renderPowerDetail, renderPowerInputs, renderPowerMore, renderPowerYears } from './power-view.ts';
import { renderStackDetail, renderStackInputs, renderStackKeep, renderStackMore } from './stack-view.ts';

type CalculatorId = Exclude<ToolId, 'miner' | 'halving' | 'tx' | 'left' | 'convert'>;

interface Calculator {
    inputs: SafeHtml;
    more: [string, SafeHtml];
    detail: SafeHtml;
    caption: string;
    head?: { title: string; key?: SafeHtml };
    afterResult?: SafeHtml;
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
                head: { title: PICTURE.powerTitle },
                below: renderPowerYears(EARLIEST_MONTH, thisMonth()),
            };
        case 'dca':
            return {
                inputs: renderDcaInputs(EARLIEST_MONTH, thisMonth()),
                more: [FIELDS.more, renderDcaMore()],
                detail: renderDcaDetail(),
                caption: PICTURE.dcaEmpty,
                head: { title: PICTURE.dcaTitle, key: renderDcaKey() },
            };
        case 'fees':
            return {
                inputs: renderFeesInputs(),
                more: [FIELDS.more, renderFeesMore()],
                detail: renderFeesDetail(),
                caption: PICTURE.feesEmpty,
                head: { title: PICTURE.feesTitle },
            };
        case 'stack':
            return {
                inputs: renderStackInputs(),
                more: [FIELDS.more, renderStackMore()],
                detail: renderStackDetail(),
                caption: PICTURE.stackEmpty,
                head: { title: PICTURE.stackTitle },
                afterResult: renderStackKeep(),
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

/**
 * A calculator page, in reading order: its plain name, the inputs, the answer, the picture, then sharing and the
 * rest. On a wide screen the picture stands beside the calculator, in the room a scene takes on the machines.
 */
function page(id: CalculatorId, screen: SafeHtml, below: SafeHtml): SafeHtml {
    return html`<article class="tool tool--${id} machine">
    <div class="machine__body">
        <div class="tool__screen">${toolHead(id)}${screen}</div>
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
        ${parts.afterResult ?? ''}
        ${infoPanel(id)}
        ${pictureFrame(parts.caption, parts.head)}
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
