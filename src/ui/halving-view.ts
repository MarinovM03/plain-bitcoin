import { estimateTip } from '../data/height.ts';
import { type HalvingClock, halvingClock } from '../model/halving.ts';
import { MAX_SUPPLY, supplyAt } from '../model/supply.ts';
import { formatAge, formatBtcExact, formatDay, formatPpm, formatWhole } from '../util/format.ts';
import { HALVING, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { shareSection, sourceLine } from './output.ts';

/** The scrubber runs through the eras the clock draws. */
export const SCRUB_ERAS = 9;
export const SCRUB_STEP = 1000;

export function halvingLines(clock: HalvingClock): { sentence: string; when: string } {
    const date = formatDay(clock.estimatedAt);
    return {
        sentence: HALVING.sentence(
            formatBtcExact(clock.reward),
            formatBtcExact(clock.nextReward),
            formatWhole(clock.at),
        ),
        when: clock.measured ? HALVING.when(date, formatAge(clock.pace)) : HALVING.whenTarget(date),
    };
}

export function scrubLine(height: number): string {
    const supply = supplyAt(height);
    return HALVING.scrubLine(
        formatWhole(height),
        formatBtcExact(supply.subsidy),
        formatPpm(Number((BigInt(supply.issued) * 1_000_000n) / BigInt(MAX_SUPPLY))),
    );
}

/**
 * The halving clock's page: the rings on one side, the countdown, a line to drag through every era, and a table of
 * the eras with their real or estimated end dates.
 */
export function renderHalving(now = Date.now()): SafeHtml {
    const { height } = estimateTip(now);
    const clock = halvingClock(height, now, null);
    const lines = halvingLines(clock);
    return html`<article class="machine machine--halving">
    <div class="machine__stage" data-machine="halving" aria-hidden="true"></div>
    <div class="machine__body">
        <header class="machine__head rise">
            <p class="machine__kicker"><span class="intro__pulse" aria-hidden="true"></span><span id="halving-kicker">${HALVING.kickerEstimate(formatWhole(height))}</span></p>
            <h1 class="machine__title" tabindex="-1">${TOOLS.halving.name}</h1>
        </header>
        <section class="miner-answer rise" aria-labelledby="halving-label">
            <p id="halving-label" class="miner-answer__label">${HALVING.resultLabel}</p>
            <p class="miner-answer__figure"><span id="halving-blocks" class="miner-answer__number">${formatWhole(clock.blocks)}</span> <span class="miner-answer__unit">${HALVING.unit}</span></p>
            <p id="halving-sentence" class="miner-answer__needs">${lines.sentence}</p>
            <p id="halving-when" class="miner-answer__needs">${lines.when}</p>
        </section>
        <div class="scrub rise">
            <label class="field__label" for="halving-scrub">${HALVING.scrub}</label>
            <input id="halving-scrub" class="scrub__range" type="range" min="0" max="${String(SCRUB_ERAS * 210)}" step="1" value="${String(Math.round(height / SCRUB_STEP))}" />
            <p id="halving-scrub-line" class="machine__note" aria-live="polite">${scrubLine(height)}</p>
            <button id="halving-now" class="button" type="button" hidden>${HALVING.scrubNow}</button>
        </div>
        <p class="machine__lead">${HALVING.explain}</p>
        <div class="machine__share">${shareSection(html`<p id="halving-status" class="visually-hidden" aria-live="polite"></p>`)}</div>
        <section class="steps" aria-labelledby="eras-heading">
            <h2 id="eras-heading" class="steps__heading">${HALVING.erasHeading}</h2>
            <div class="table-scroll" tabindex="0" role="region" aria-label="${HALVING.tableLabel}">
                <table class="era-table">
                    <thead><tr><th scope="col">${HALVING.columns.era}</th><th scope="col">${HALVING.columns.blocks}</th><th scope="col">${HALVING.columns.reward}</th><th scope="col">${HALVING.columns.ends}</th></tr></thead>
                    <tbody id="halving-eras"></tbody>
                </table>
            </div>
        </section>
        ${sourceLine(TOOLS.halving.privacy, '')}
    </div>
</article>`;
}
