import { hrefFor } from '../app/routes.ts';
import { heightFeed } from '../data/height.ts';
import { priceFeed } from '../data/price.ts';
import { type SceneData, stage } from '../hero/bus.ts';
import { SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { TOOL_IDS, type ToolId } from '../tools/index.ts';
import { afterFirstPaint } from '../util/dom.ts';
import { formatFiatPrecise, formatWhole } from '../util/format.ts';
import { ADDRESS_SAMPLES } from './address-view.ts';
import { HOME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

const WEEKS = 52;

function renderTile(id: ToolId): SafeHtml {
    return html`<li class="tiles__item tiles__item--${id}">
        <a class="tile" href="${hrefFor(id)}">
            <span class="tile__preview" data-preview="${id}" aria-hidden="true"></span>
            <span class="tile__figure" data-tile-figure="${id}">${TOOLS[id].preview}</span>
            <span class="tile__text">
                <span class="tile__name">${TOOLS[id].name}</span>
                <span class="tile__question">${TOOLS[id].question}</span>
            </span>
        </a>
    </li>`;
}

function renderCautions(): SafeHtml {
    const lines = HOME.cautions.map((line) => html`<li class="cautions__item">${line}</li>`);
    return html`<section class="cautions" aria-labelledby="cautions-heading">
    <h2 id="cautions-heading" class="cautions__heading">${HOME.cautionsHeading}</h2>
    <ul class="cautions__list">${lines}</ul>
</section>`;
}

export function renderHome(): SafeHtml {
    return html`<div class="home">
    <section class="intro" aria-labelledby="home-heading">
        <h1 id="home-heading" class="intro__heading" tabindex="-1">${HOME.headline}</h1>
        <p class="intro__lead">${HOME.lead}</p>
    </section>
    <section class="tiles" aria-label="${HOME.toolsLabel}">
        <ul class="tiles__grid">${TOOL_IDS.map(renderTile)}</ul>
    </section>
    ${renderCautions()}
</div>`;
}

function previewData(id: ToolId, height: number): SceneData {
    switch (id) {
        case 'left':
            return { id, height };
        case 'power':
            return { id, cash: 1, bitcoin: 1, outline: true };
        case 'convert':
            return { id, sats: 100_000 };
        case 'dca':
            return {
                id,
                value: [],
                invested: Array.from({ length: WEEKS }, (_, week) => week + 1),
                lump: Array.from({ length: WEEKS }, () => WEEKS),
            };
        case 'address':
            return {
                id,
                text: ADDRESS_SAMPLES.p2tr,
                roles: [],
                state: 'valid',
                suspect: null,
                checksumBad: false,
            };
    }
}

export function mountHome(root: HTMLElement): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const figure = (id: ToolId) => root.querySelector<HTMLElement>(`[data-tile-figure="${id}"]`);
    const preview = (id: ToolId) => root.querySelector<HTMLElement>(`[data-preview="${id}"]`);
    let painted = false;
    let disposed = false;

    function renderLeft(): void {
        const left = Math.floor(supplyAt(heights.tip.height).left / SATS_PER_BTC);
        const target = figure('left');
        if (target) target.textContent = HOME.leftFigure(`${formatWhole(left)} BTC`);
        const element = preview('left');
        if (painted && element) stage.preview(element, previewData('left', heights.tip.height));
    }

    function renderPrice(): void {
        const target = figure('convert');
        if (target)
            target.textContent = HOME.convertFigure(formatFiatPrecise(prices.quote.value.gbp / SATS_PER_BTC, 'GBP'));
    }

    const stopHeights = heights.subscribe(renderLeft);
    const stopPrices = prices.subscribe(renderPrice);
    renderLeft();
    renderPrice();
    afterFirstPaint(() => {
        if (disposed) return;
        painted = true;
        for (const id of TOOL_IDS) {
            const element = preview(id);
            if (element) stage.preview(element, previewData(id, heights.tip.height));
        }
    });

    return () => {
        disposed = true;
        stopHeights();
        stopPrices();
    };
}
