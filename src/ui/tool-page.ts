import { hrefFor } from '../app/routes.ts';
import type { ToolId } from '../tools/index.ts';
import type { Month } from '../util/month.ts';
import { renderAddressCardToggle, renderAddressDetail, renderAddressInputs } from './address-view.ts';
import { renderConvertInputs } from './convert-view.ts';
import { ADDRESS, LEFT_PAGE, TOOL_PAGE, TOOLS } from './copy.ts';
import { renderDcaDetail, renderDcaInputs } from './dca-view.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine, resultBlock, shareBar, sourceLine } from './output.ts';
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

function renderDetail(id: CalculatorId): SafeHtml | '' {
    if (id === 'power') return renderPowerDetail();
    if (id === 'dca') return renderDcaDetail();
    if (id === 'address') return renderAddressDetail();
    return '';
}

function renderHead(id: ToolId, heading: SafeHtml): SafeHtml {
    return html`<a class="back-link" href="${hrefFor('home')}"><span aria-hidden="true">←</span> ${TOOL_PAGE.back}</a>
${heading}
<p class="tool__question">${TOOLS[id].question}</p>`;
}

function renderCalculator(id: CalculatorId): SafeHtml {
    const title = html`<h1 class="tool__title" tabindex="-1">${TOOLS[id].name}</h1>`;
    return html`<article class="tool tool--${id}">
    ${renderHead(id, title)}
    <div class="tool__body">
        <form class="tool__inputs" aria-label="${TOOL_PAGE.inputsLabel}" novalidate>
            ${renderInputs(id)}
        </form>
        <section class="tool__output" aria-labelledby="tool-result-label">
            <div class="tool__dock">
                ${resultBlock({
                    id: 'tool-result',
                    label: id === 'address' ? ADDRESS.resultLabel : TOOL_PAGE.resultLabel,
                    empty: id === 'address' ? ADDRESS.empty : TOOL_PAGE.resultEmpty,
                    sentence: true,
                })}
                ${shareBar()}
                ${id === 'address' ? renderAddressCardToggle() : ''}
            </div>
            ${renderDetail(id)}
            ${sourceLine(id === 'address' ? ADDRESS.sourceIdle : TOOL_PAGE.sourcePending, 'tool-source')}
            <p class="privacy-line">${TOOLS[id].privacy}</p>
        </section>
    </div>
</article>`;
}

const LEFT_ROWS = [
    ['left', LEFT_PAGE.left],
    ['issued', LEFT_PAGE.issued],
    ['share', LEFT_PAGE.share],
    ['reward', LEFT_PAGE.reward],
    ['height', LEFT_PAGE.height],
    ['last', LEFT_PAGE.lastBlock],
    ['halving', LEFT_PAGE.nextHalving],
    ['next-reward', LEFT_PAGE.nextReward],
    ['halving-date', LEFT_PAGE.halvingDate],
    ['max', LEFT_PAGE.max],
] as const;

function renderLeft(): SafeHtml {
    const rows = LEFT_ROWS.map(
        ([id, label]) => html`<div class="numbers__row">
            <dt>${label}</dt>
            <dd id="left-${id}">${LEFT_PAGE.pending}</dd>
        </div>`,
    );
    return html`<article class="tool tool--left">
    ${renderHead('left', renderHero({ link: false }))}
    <section class="numbers" aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" class="numbers__heading">${LEFT_PAGE.numbersHeading}</h2>
        <dl id="numbers-panel" class="numbers__panel">${rows}</dl>
        ${noteLine(LEFT_PAGE.steps)}
        ${noteLine(LEFT_PAGE.honesty)}
        ${shareBar()}
        <p id="left-status" class="visually-hidden" aria-live="polite"></p>
        ${sourceLine(TOOL_PAGE.sourcePending, 'tool-source')}
        <p class="privacy-line">${TOOLS.left.privacy}</p>
    </section>
</article>`;
}

export function renderToolPage(id: ToolId): SafeHtml {
    return id === 'left' ? renderLeft() : renderCalculator(id);
}
