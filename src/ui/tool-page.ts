import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressCardToggle, renderAddressDetail, renderAddressInputs } from './address-view.ts';
import { renderConvertDetail, renderConvertInputs } from './convert-view.ts';
import { ADDRESS, LEFT_PAGE, SHARE, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs } from './dca-view.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine, postLink, resultBlock, shareBar, sourceLine } from './output.ts';
import { renderPowerDetail, renderPowerInputs } from './power-view.ts';

type CalculatorId = Exclude<ToolId, 'left'>;

const EARLIEST_MONTH: Month = { year: 2010, month: 7 };

function thisMonth(): Month {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function renderInputs(id: CalculatorId): SafeHtml {
    switch (id) {
        case 'power':
            return renderPowerInputs(EARLIEST_MONTH, thisMonth());
        case 'convert':
            return renderConvertInputs();
        case 'dca':
            return renderDcaInputs(EARLIEST_MONTH, thisMonth());
        case 'address':
            return renderAddressInputs();
    }
}

function renderDetail(id: CalculatorId): SafeHtml {
    switch (id) {
        case 'power':
            return renderPowerDetail();
        case 'convert':
            return renderConvertDetail();
        case 'dca':
            return renderDcaDetail();
        case 'address':
            return renderAddressDetail();
    }
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const address = id === 'address';
    return html`<article class="tool tool--${id}">
    <div class="tool__head">
        <h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>
        <p class="tool__question">${TOOLS[id].question}</p>
    </div>
    <form class="tool__inputs" aria-label="${address ? TOOL_PAGE.addressLabel : TOOL_PAGE.inputsLabel}" novalidate>
        ${renderInputs(id)}
    </form>
    ${resultBlock({
        id: 'tool-result',
        label: address ? ADDRESS.resultLabel : TOOL_PAGE.resultLabel,
        empty: address ? ADDRESS.empty : TOOL_PAGE.resultEmpty,
        extra: address ? renderAddressCardToggle() : '',
    })}
    ${renderDetail(id)}
    ${sourceLine(TOOLS[id].privacy, address ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending)}
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
    ${renderHero({ link: false })}
    <div class="tool__column">
        <section class="details" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" class="details__title">${TOOLS.left.question}</h2>
            <dl id="numbers-panel" class="stats">${cells}</dl>
        </section>
        <section class="left-share" aria-labelledby="left-share-heading">
            <h2 id="left-share-heading" class="details__title">${SHARE.label}</h2>
            <div class="result__actions">
                ${shareBar()}
                ${postLink()}
            </div>
            <p id="left-status" class="visually-hidden" aria-live="polite"></p>
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
