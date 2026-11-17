import { LEFT_PAGE, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine, shareSection, sourceLine } from './output.ts';

const CELLS = [
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

export const ZOOM_STEPS = 100;

/** Bitcoin left: the 21 million block on one side, the counting answer, a zoom down to single coins, every number. */
export function renderLeft(): SafeHtml {
    const cells = CELLS.map(
        ([id, label, modifier]) => html`<div class="stat${modifier}">
            <dt>${label}</dt>
            <dd id="left-${id}">${LEFT_PAGE.pending}</dd>
        </div>`,
    );
    return html`<article class="machine machine--left tool--left">
    <div class="machine__stage" data-machine="wall" aria-hidden="true"></div>
    <div class="machine__body">
        <header class="machine__head rise">
            <p class="machine__kicker"><span class="intro__pulse" aria-hidden="true"></span><span id="left-kicker">…</span></p>
            <h1 class="machine__title" tabindex="-1">${TOOLS.left.name}</h1>
        </header>
        <section class="result rise" aria-labelledby="left-label">
            <p id="left-label" class="result__label">${LEFT_PAGE.resultLabel}</p>
            <p id="left-figure" class="result__figure"><span class="result__empty">${LEFT_PAGE.figureEmpty}</span></p>
            <p id="left-supply" class="result__sentence"></p>
            <p id="left-note" class="result__detail"></p>
        </section>
        <div class="scrub rise">
            <label class="field__label" for="left-zoom">${LEFT_PAGE.zoom}</label>
            <input id="left-zoom" class="scrub__range" type="range" min="0" max="${String(ZOOM_STEPS)}" step="1" value="0" />
            <p id="left-zoom-line" class="machine__note" aria-live="polite">${LEFT_PAGE.zoomAll}</p>
        </div>
        <p class="machine__lead">${LEFT_PAGE.explain}</p>
        <div class="machine__share">${shareSection(html`<p id="left-status" class="visually-hidden" aria-live="polite"></p>`)}</div>
        <section class="details steps" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" class="steps__heading">${LEFT_PAGE.numbersHeading}</h2>
            <dl id="numbers-panel" class="stats">${cells}</dl>
            ${noteLine(LEFT_PAGE.steps)}
            ${noteLine(LEFT_PAGE.honesty)}
        </section>
        ${sourceLine(TOOLS.left.privacy)}
    </div>
</article>`;
}
