import { hrefFor } from '../app/routes.ts';
import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressCardToggle, renderAddressDetail, renderAddressInputs } from './address-view.ts';
import { renderConvertInputs, renderConvertPrice, renderConvertReference } from './convert-view.ts';
import { ADDRESS, LEFT_PAGE, SHARE, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs } from './dca-view.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine, postLink, resultBlock, shareBar, sourceStrip } from './output.ts';
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

function renderSide(id: CalculatorId): SafeHtml | '' {
    return id === 'convert' ? renderConvertReference() : '';
}

function renderDetail(id: CalculatorId): SafeHtml | '' {
    switch (id) {
        case 'power':
            return renderPowerDetail();
        case 'convert':
            return '';
        case 'dca':
            return renderDcaDetail();
        case 'address':
            return renderAddressDetail();
    }
}

function backLink(): SafeHtml {
    return html`<a class="back-link" href="${hrefFor('home')}"><span aria-hidden="true">←</span> ${TOOL_PAGE.back}</a>`;
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const address = id === 'address';
    const side = renderSide(id);
    const inputsLabel = address ? TOOL_PAGE.addressLabel : TOOL_PAGE.inputsLabel;
    return html`<article class="tool tool--${id}">
    <div class="tool__head">
        ${backLink()}
        <p class="eyebrow">${TOOLS[id].kind}</p>
        <h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>
        <p class="tool__question">${TOOLS[id].question}</p>
    </div>
    ${id === 'convert' ? renderConvertPrice() : ''}
    <div class="tool__body${side ? ' tool__body--side' : ''}">
        <form class="tool__inputs panel" aria-label="${inputsLabel}" novalidate>
            <p class="panel__kicker" aria-hidden="true">${inputsLabel}</p>
            ${renderInputs(id)}
        </form>
        ${resultBlock({
            id: 'tool-result',
            label: address ? ADDRESS.resultLabel : TOOL_PAGE.resultLabel,
            empty: address ? ADDRESS.empty : TOOL_PAGE.resultEmpty,
            extra: address ? renderAddressCardToggle() : '',
        })}
        ${side}
    </div>
    ${renderDetail(id)}
    ${sourceStrip(TOOLS[id].privacy, address ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending)}
</article>`;
}

const LEFT_CELLS = [
    ['left', LEFT_PAGE.left, ' stat--lead'],
    ['issued', LEFT_PAGE.issued, ''],
    ['share', LEFT_PAGE.share, ''],
    ['max', LEFT_PAGE.max, ''],
    ['reward', LEFT_PAGE.reward, ''],
    ['height', LEFT_PAGE.height, ''],
    ['last', LEFT_PAGE.lastBlock, ' stat--text'],
    ['halving', LEFT_PAGE.nextHalving, ' stat--wide stat--text'],
    ['next-reward', LEFT_PAGE.nextReward, ''],
    ['halving-date', LEFT_PAGE.halvingDate, ' stat--text'],
] as const;

function renderLeft(): SafeHtml {
    const cells = LEFT_CELLS.map(
        ([id, label, modifier]) => html`<div class="stat${modifier}">
            <dt>${label}</dt>
            <dd id="left-${id}">${LEFT_PAGE.pending}</dd>
        </div>`,
    );
    return html`<article class="tool tool--left">
    <div class="tool__head tool__head--left">${backLink()}</div>
    ${renderHero({ link: false })}
    <section class="numbers panel" aria-labelledby="numbers-heading">
        <div class="panel__head">
            <p class="eyebrow">${LEFT_PAGE.numbersHeading}</p>
            <h2 id="numbers-heading" class="panel__title">${TOOLS.left.question}</h2>
        </div>
        <dl id="numbers-panel" class="stats stats--four">${cells}</dl>
    </section>
    <div class="left-foot">
        <section class="panel left-share" aria-labelledby="left-share-heading">
            <div class="result__head">
                <h2 id="left-share-heading" class="result__label">${SHARE.label}</h2>
                ${postLink()}
            </div>
            ${shareBar()}
            <p id="left-status" class="visually-hidden" aria-live="polite"></p>
        </section>
        <div class="panel panel--quiet notes">
            ${noteLine(LEFT_PAGE.steps)}
            ${noteLine(LEFT_PAGE.honesty)}
        </div>
    </div>
    ${sourceStrip(TOOLS.left.privacy)}
</article>`;
}

export function renderToolPage(id: ToolId): SafeHtml {
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
