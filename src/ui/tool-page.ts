import type { MachineId } from '../hero/bus.ts';
import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressDetail, renderAddressInputs, renderAddressMore } from './address-view.ts';
import { renderConvert } from './convert-view.ts';
import { ADDRESS, FIELDS, LEFT_PAGE, PICTURE, POWER, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs, renderDcaMore } from './dca-view.ts';
import { html, type SafeHtml } from './html.ts';
import { moreOptions, noteLine, pictureFrame, resultBlock, shareSection, sourceLine } from './output.ts';
import { renderPowerDetail, renderPowerInputs, renderPowerMore } from './power-view.ts';

type CalculatorId = Exclude<ToolId, 'miner' | 'left' | 'convert'>;

interface Calculator {
    inputs: SafeHtml;
    more: [string, SafeHtml];
    detail: SafeHtml;
    caption: string;
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

/**
 * A tool page, in reading order: its plain name, the inputs, the answer, the picture, then sharing and the rest.
 * On a wide screen the picture stands beside the calculator instead of under the answer.
 */
const SCENES: Partial<Record<ToolId, MachineId>> = { left: 'wall', power: 'melt', dca: 'stack' };

function page(id: ToolId, screen: SafeHtml, below: SafeHtml): SafeHtml {
    const machine = SCENES[id];
    const stage = machine ? html`<div class="machine__stage" data-machine="${machine}" aria-hidden="true"></div>` : '';
    return html`<article class="tool tool--${id} machine${machine ? '' : ' machine--plain'}">
    <div class="machine__body">
        <div class="tool__screen">${toolHead(id)}${screen}</div>
        ${stage}
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
        ${shareSection()}
        <form class="tool__more" novalidate>${moreOptions(...parts.more)}</form>`,
        html`${parts.detail}
        ${sourceLine(TOOLS[id].privacy, address ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending)}`,
    );
}

const LEFT_CELLS = [
    ['left', LEFT_PAGE.left, ''],
    ['issued', LEFT_PAGE.issued, ''],
    ['share', LEFT_PAGE.share, ''],
    ['reward', LEFT_PAGE.reward, ''],
    ['height', LEFT_PAGE.height, ''],
    ['last', LEFT_PAGE.lastBlock, ' stat--text'],
    ['halving', LEFT_PAGE.nextHalving, ' stat--text'],
    ['next-reward', LEFT_PAGE.nextReward, ''],
    ['halving-date', LEFT_PAGE.halvingDate, ' stat--text'],
    ['max', LEFT_PAGE.max, ''],
] as const;

function renderLeft(): SafeHtml {
    const cells = LEFT_CELLS.map(
        ([id, label, modifier]) => html`<div class="stat${modifier}">
            <dt>${label}</dt>
            <dd id="left-${id}">${LEFT_PAGE.pending}</dd>
        </div>`,
    );
    return page(
        'left',
        html`<section class="result" aria-labelledby="left-label">
            <p id="left-label" class="result__label">${LEFT_PAGE.resultLabel}</p>
            <p id="left-figure" class="result__figure"><span class="result__empty">${LEFT_PAGE.figureEmpty}</span></p>
            <p id="left-supply" class="result__sentence"></p>
            <p id="left-note" class="result__detail"></p>
        </section>
        ${pictureFrame(PICTURE.left)}
        ${shareSection(html`<p id="left-status" class="visually-hidden" aria-live="polite"></p>`)}`,
        html`<section class="details" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" class="details__title">${LEFT_PAGE.numbersHeading}</h2>
            <dl id="numbers-panel" class="stats">${cells}</dl>
        </section>
        <div class="details notes">
            ${noteLine(LEFT_PAGE.steps)}
            ${noteLine(LEFT_PAGE.honesty)}
        </div>
        ${sourceLine(TOOLS.left.privacy)}`,
    );
}

export function renderToolPage(id: Exclude<ToolId, 'miner'>): SafeHtml {
    if (id === 'convert') return renderConvert(toolHead(id));
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
