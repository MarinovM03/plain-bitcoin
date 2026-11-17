import { MINER, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { shareSection, sourceLine } from './output.ts';

const STAT_IDS = ['count', 'rate', 'network', 'odds'] as const;
const FIELD_IDS = ['version', 'previous', 'merkle', 'time', 'bits', 'nonce'] as const;

export type HeaderField = (typeof FIELD_IDS)[number];

function stat(id: (typeof STAT_IDS)[number]): SafeHtml {
    return html`<div class="stat-line"><dt>${MINER.stats[id]}</dt><dd id="miner-${id}">—</dd></div>`;
}

function field(id: HeaderField): SafeHtml {
    return html`<div class="header-field header-field--${id}"><dt>${MINER.fields[id]}</dt><dd id="header-${id}">—</dd></div>`;
}

function step(item: (typeof MINER.steps)[number], index: number): SafeHtml {
    const extra =
        item.id === 'header'
            ? html`<dl class="header-fields">${FIELD_IDS.map(field)}</dl>`
            : item.id === 'hash'
              ? html`<div class="real-check">
                    <button id="miner-check" class="button" type="button">${MINER.check}</button>
                    <p id="real-label" class="real-check__label" hidden></p>
                    <p id="real-hash" class="hash-text" hidden></p>
                    <p id="real-verdict" class="real-check__verdict" role="status"></p>
                </div>`
              : '';
    return html`<li class="step" data-step="${item.id}">
        <span class="step__number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="step__title">${item.title}</h3>
        <p class="step__body">${item.body}</p>
        ${extra}
    </li>`;
}

/**
 * The miner's page: the well fills one side of the screen and stays put while the words scroll beside it. The
 * answer and the Start button sit above the fold; the how-it-works steps follow and turn the camera as they pass.
 */
export function renderMiner(): SafeHtml {
    return html`<article class="machine machine--miner">
    <div class="machine__stage" data-machine="miner" aria-hidden="true"></div>
    <div class="machine__body">
        <header class="machine__head rise">
            <p id="miner-kicker" class="machine__kicker"><span class="intro__pulse" aria-hidden="true"></span><span id="miner-kicker-text">${MINER.loading}</span></p>
            <h1 class="machine__title" tabindex="-1">${TOOLS.miner.name}</h1>
        </header>
        <section class="miner-answer rise" aria-labelledby="miner-best-label">
            <p id="miner-best-label" class="miner-answer__label">${MINER.resultLabel}</p>
            <p class="miner-answer__figure"><span id="miner-best" class="miner-answer__number">${MINER.none}</span> <span id="miner-best-unit" class="miner-answer__unit" hidden>${MINER.zeroBits}</span></p>
            <p id="miner-needs" class="miner-answer__needs"></p>
            <div class="miner-answer__actions">
                <button id="miner-run" class="button button--primary" type="button" aria-pressed="false" disabled>${MINER.start}</button>
            </div>
        </section>
        <p class="machine__lead">${MINER.lead}</p>
        <dl class="miner-stats rise">${STAT_IDS.map(stat)}</dl>
        <div class="best-hash rise">
            <p class="best-hash__label">${MINER.bestHash}</p>
            <p id="miner-hash" class="hash-text">—</p>
        </div>
        <p class="machine__note">${MINER.sparks}</p>
        <div class="machine__share">${shareSection(html`<p id="miner-status" class="visually-hidden" aria-live="polite"></p>`)}</div>
        <section class="steps" aria-labelledby="steps-heading">
            <h2 id="steps-heading" class="steps__heading">${MINER.howHeading}</h2>
            <ol class="steps__list">${MINER.steps.map(step)}</ol>
        </section>
        ${sourceLine(TOOLS.miner.privacy, MINER.loading)}
    </div>
</article>`;
}
