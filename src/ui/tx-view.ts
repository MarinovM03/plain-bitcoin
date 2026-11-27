import { TOOLS, TX } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { shareSection, sourceLine } from './output.ts';

export const TX_ZOOM_STEPS = 100;

/**
 * Follow a transaction: the waiting line on one side, a box for a transaction id, the answer, and the same line in
 * words for anyone who cannot see the scene.
 */
export function renderTx(): SafeHtml {
    return html`<article class="machine machine--tx">
    <div class="machine__stage" data-machine="queue" aria-hidden="true"></div>
    <div class="machine__body">
        <header class="machine__head rise">
            <p class="machine__kicker"><span class="intro__pulse" aria-hidden="true"></span><span>${TX.kicker}</span></p>
            <h1 class="machine__title" tabindex="-1">${TOOLS.tx.name}</h1>
        </header>
        <form id="tx-form" class="tx-form rise" novalidate>
            <label class="field__label" for="tx-id">${TX.field}</label>
            <div class="field__control"><input id="tx-id" class="field__input tx-form__input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="${TX.placeholder}" maxlength="80" /></div>
            <div class="tx-form__actions">
                <button class="button button--primary" type="submit">${TX.follow}</button>
                <button id="tx-pick" class="button" type="button">${TX.pick}</button>
            </div>
        </form>
        <section class="miner-answer rise" aria-labelledby="tx-label" aria-live="polite">
            <p id="tx-label" class="miner-answer__label">${TX.resultLabel}</p>
            <p class="miner-answer__figure"><span id="tx-rate" class="miner-answer__number">—</span> <span id="tx-unit" class="miner-answer__unit" hidden>${TX.unit}</span></p>
            <p id="tx-sentence" class="miner-answer__needs">${TX.empty}</p>
            <p id="tx-detail" class="miner-answer__needs"></p>
            <p id="tx-hash" class="hash-text" hidden></p>
        </section>
        <div class="scrub rise">
            <label class="field__label" for="tx-zoom">${TX.zoom}</label>
            <input id="tx-zoom" class="scrub__range" type="range" min="0" max="${String(TX_ZOOM_STEPS)}" step="1" value="0" />
            <p id="tx-zoom-line" class="machine__note" aria-live="polite">${TX.zoomAll}</p>
        </div>
        <p class="machine__note">${TX.consent}</p>
        <p class="machine__lead">${TX.explain}</p>
        <div class="machine__share">${shareSection(html`<p id="tx-status" class="visually-hidden" aria-live="polite"></p>`)}</div>
        <section class="steps" aria-labelledby="line-heading">
            <h2 id="line-heading" class="steps__heading">${TX.lineHeading}</h2>
            <ol id="tx-line" class="line-list"><li>${TX.linePending}</li></ol>
        </section>
        ${sourceLine(TOOLS.tx.privacy, '')}
    </div>
</article>`;
}
