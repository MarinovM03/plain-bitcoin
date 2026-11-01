import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import {
    renderAddressCardToggle,
    renderAddressDetail,
    renderAddressInputs,
    renderAddressMore,
} from './address-view.ts';
import { renderConvertDetail, renderConvertInputs, renderConvertMore } from './convert-view.ts';
import { ADDRESS, CONVERT, FIELDS, LEFT_PAGE, POWER, SCENE, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaChart, renderDcaDetail, renderDcaInputs, renderDcaMore } from './dca-view.ts';
import { html, type SafeHtml } from './html.ts';
import { moreOptions, noteLine, resultBlock, sceneWindow, shareSection, sourceLine } from './output.ts';
import { renderPowerDetail, renderPowerInputs, renderPowerMore } from './power-view.ts';

type CalculatorId = Exclude<ToolId, 'left'>;

interface Calculator {
    inputs: SafeHtml;
    more: [string, SafeHtml];
    detail: SafeHtml;
    caption: string;
    still?: SafeHtml;
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
                caption: SCENE.powerEmpty,
            };
        case 'convert':
            return {
                inputs: renderConvertInputs(),
                more: [CONVERT.presetsLabel, renderConvertMore()],
                detail: renderConvertDetail(),
                caption: SCENE.convertEmpty,
            };
        case 'dca':
            return {
                inputs: renderDcaInputs(),
                more: [FIELDS.more, renderDcaMore(EARLIEST_MONTH, thisMonth())],
                detail: renderDcaDetail(),
                caption: SCENE.dcaEmpty,
                still: renderDcaChart(),
            };
        case 'address':
            return {
                inputs: renderAddressInputs(),
                more: [ADDRESS.samplesLabel, renderAddressMore()],
                detail: renderAddressDetail(),
                caption: SCENE.addressEmpty,
            };
    }
}

function head(id: ToolId): SafeHtml {
    return html`<div class="tool__head">
    <h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>
    <p class="tool__question">${TOOLS[id].question}</p>
</div>`;
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const address = id === 'address';
    const parts = calculator(id);
    return html`<article class="tool tool--${id}">
    <div class="tool__screen">
        ${sceneWindow({ head: head(id), caption: parts.caption, ...(parts.still ? { still: parts.still } : {}) })}
        <form class="tool__panel tool__inputs" aria-label="${address ? TOOL_PAGE.addressLabel : TOOL_PAGE.inputsLabel}" novalidate>
            <div class="tool__fields">${parts.inputs}</div>
            ${resultBlock({
                id: 'tool-result',
                label: address ? ADDRESS.resultLabel : TOOL_PAGE.resultLabel,
                empty: address ? ADDRESS.empty : TOOL_PAGE.resultEmpty,
            })}
            ${moreOptions(...parts.more)}
        </form>
    </div>
    <div class="tool__below">
        ${shareSection(address ? renderAddressCardToggle() : '')}
        ${parts.detail}
        ${sourceLine(TOOLS[id].privacy, address ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending)}
    </div>
</article>`;
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
    return html`<article class="tool tool--left">
    <div class="tool__screen">
        ${sceneWindow({ head: head('left'), caption: SCENE.left })}
        <div class="tool__panel">
            <section class="result" aria-labelledby="left-label">
                <p id="left-label" class="result__label">${LEFT_PAGE.resultLabel}</p>
                <p id="left-figure" class="result__figure"><span class="result__empty">${LEFT_PAGE.figureEmpty}</span></p>
                <p id="left-supply" class="result__sentence"></p>
                <p id="left-note" class="result__detail"></p>
            </section>
        </div>
    </div>
    <div class="tool__below">
        ${shareSection(html`<p id="left-status" class="visually-hidden" aria-live="polite"></p>`)}
        <section class="details" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" class="details__title">${LEFT_PAGE.numbersHeading}</h2>
            <dl id="numbers-panel" class="stats">${cells}</dl>
        </section>
        <div class="details notes">
            ${noteLine(LEFT_PAGE.steps)}
            ${noteLine(LEFT_PAGE.honesty)}
        </div>
        ${sourceLine(TOOLS.left.privacy)}
    </div>
</article>`;
}

export function renderToolPage(id: ToolId): SafeHtml {
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
