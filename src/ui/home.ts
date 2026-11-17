import { hrefFor } from '../app/routes.ts';
import { type ChainBlock, heightFeed } from '../data/height.ts';
import { priceFeed } from '../data/price.ts';
import { SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { bindShareBar } from '../postcard/bar.ts';
import { siteAddress } from '../postcard/site.ts';
import { homePostcard } from '../postcard/words.ts';
import { TOOL_IDS, type ToolId } from '../tools/index.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import {
    formatAmount,
    formatMinutes,
    formatMoney,
    formatShortDay,
    formatUtcClock,
    formatWhole,
    isoDayMs,
} from '../util/format.ts';
import { CHAIN, HOME, SHARE, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { shareBar } from './output.ts';
import { rollText } from './roll.ts';
import type { ChainView, World } from './world.ts';

const LEGEND_TICK_MS = 15_000;
const FACT_START = '2015-01';

const FACT_UNITS: Record<ToolId, string> = {
    left: HOME.facts.left.unit,
    power: HOME.facts.power.unit(formatAmount(HOME.facts.power.amount, 'USD'), String(HOME.facts.power.year)),
    convert: HOME.facts.convert.unit,
    dca: HOME.facts.dca.unit(formatAmount(HOME.facts.dca.amount, 'USD')),
    address: HOME.facts.address.unit,
};

/**
 * A tool as one line of the menu: its name set large, one line that explains it, and one real number. The number's
 * place is held from the first paint, so nothing shifts when it arrives.
 */
function renderRow(id: ToolId): SafeHtml {
    return html`<li class="tool-list__item">
        <a class="tool-row" href="${hrefFor(id)}" data-tool="${id}">
            <span class="tool-row__words">
                <span class="tool-row__name">${TOOLS[id].name}</span>
                <span class="tool-row__description">${TOOLS[id].description}</span>
            </span>
            <span class="tool-row__fact">
                <span class="tool-row__figure" data-fact="${id}">${id === 'address' ? HOME.facts.address.figure : HOME.pending}</span>
                <span class="tool-row__unit">${FACT_UNITS[id]}</span>
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

/**
 * Home: the headline over the world, then the five tools as plain links with one live number each. The chain stands
 * behind the page (decoration for the eye, never clickable); the lines above the tools and the list further down
 * say the same in words.
 */
export function renderHome(): SafeHtml {
    const columns = Object.values(CHAIN.columns).map((name) => html`<th scope="col">${name}</th>`);
    return html`<div class="home">
    <section class="hero" aria-labelledby="home-heading">
        <div class="hero__intro veil rise">
            <h1 id="home-heading" class="hero__heading" tabindex="-1">${HOME.headline.slice(0, -HOME.headlineAccent.length)}<span class="hero__accent">${HOME.headlineAccent}</span></h1>
            <p class="hero__lead">${HOME.lead}</p>
        </div>
        <div class="hero__tools veil">
            <nav class="tool-list" aria-label="${HOME.toolsHeading}">
                <ul class="tool-list__rows rise">${TOOL_IDS.map(renderRow)}</ul>
            </nav>
            <div class="chain__legend">
                <p id="chain-forming" class="chain__forming">${CHAIN.waiting}</p>
                <p id="chain-newest" class="chain__newest"></p>
            </div>
            <p class="tool-list__source">${HOME.factsSource}</p>
        </div>
    </section>
    <section class="chain-about" aria-label="${CHAIN.label}">
        <p class="chain-about__explain">${CHAIN.explain}</p>
        <details class="chain-about__list">
            <summary class="chain-about__summary">${CHAIN.listSummary}</summary>
            <div class="chain-about__scroll" tabindex="0" role="region" aria-label="${CHAIN.tableLabel}">
                <table class="chain-table">
                    <thead><tr>${columns}</tr></thead>
                    <tbody id="chain-rows"></tbody>
                </table>
            </div>
        </details>
        <p id="chain-source" class="source-line"></p>
    </section>
    <section class="home__share" aria-labelledby="share-heading">
        <h2 id="share-heading" class="home__share-heading">${HOME.shareHeading}</h2>
        <p class="share__title">${SHARE.title} <span class="share__tag">${SHARE.titleTag}</span></p>
        ${shareBar()}
        <p id="home-status" class="visually-hidden" aria-live="polite"></p>
    </section>
    ${renderCautions()}
</div>`;
}

function megabytes(bytes: number): string {
    return CHAIN.megabytes((bytes / 1_000_000).toFixed(2));
}

function cell(text: string, className = ''): HTMLTableCellElement {
    const element = document.createElement('td');
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function blockRow(block: ChainBlock, nowSeconds: number, dated: boolean): HTMLTableRowElement {
    const row = document.createElement('tr');
    const found =
        block.time === null
            ? CHAIN.unknown
            : dated
              ? CHAIN.ago(formatMinutes(nowSeconds - block.time))
              : formatUtcClock(block.time * 1000);
    row.append(
        cell(formatWhole(block.height), 'chain-table__figure'),
        cell(found),
        cell(block.txCount === null ? CHAIN.unknown : formatWhole(block.txCount), 'chain-table__figure'),
        cell(block.size === null ? CHAIN.unknown : megabytes(block.size), 'chain-table__figure'),
        cell(block.hash === null ? CHAIN.unknown : `…${block.hash.slice(-12)}`, 'chain-table__figure'),
    );
    return row;
}

export function mountHome(root: HTMLElement, siteUrl: string, world: World): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const site = siteAddress(siteUrl);
    const forming = find(root, '#chain-forming');
    const newest = find(root, '#chain-newest');
    const rows = find(root, '#chain-rows');
    const source = find(root, '#chain-source');
    const status = find(root, '#home-status');
    const fact = (id: ToolId) => root.querySelector<HTMLElement>(`[data-fact="${id}"]`);
    let chain: ChainView | null = null;
    let disposed = false;

    const share = bindShareBar(root, {
        postcard: () => {
            const tip = heights.tip;
            return homePostcard({
                supply: supplyAt(tip.height),
                api: tip.source === 'live' ? tip.api : null,
                checkedAt: tip.checkedAt,
            });
        },
        site,
        onStatus: (message) => {
            status.textContent = message;
        },
    });
    share.setEnabled(true);

    function renderLegend(): void {
        if (!chain) return;
        const { blocks, savedOn, formingSince: since, tip } = chain;
        const now = Date.now() / 1000;
        const first = blocks[0];
        const last = blocks[blocks.length - 1];
        if (!first || !last) {
            rollText(forming, CHAIN.waiting);
            newest.textContent = '';
            return;
        }
        if (savedOn !== null) {
            rollText(
                forming,
                CHAIN.saved(formatWhole(last.height), formatWhole(first.height), formatShortDay(isoDayMs(savedOn))),
            );
        } else if (since === null) {
            rollText(
                forming,
                tip.source === 'offline' && tip.blocksAt !== null
                    ? CHAIN.lastSeen(formatUtcClock(tip.blocksAt))
                    : CHAIN.formingUnknown,
            );
        } else {
            rollText(forming, CHAIN.forming(formatMinutes(now - since)));
        }
        const height = formatWhole(first.height);
        const headline =
            since === null || first.time === null
                ? CHAIN.newestUnknown(height)
                : CHAIN.newest(height, formatMinutes(now - first.time));
        const contents =
            first.txCount !== null && first.size !== null
                ? ` ${CHAIN.contents(formatWhole(first.txCount), megabytes(first.size))}`
                : '';
        newest.textContent = headline + contents;
        rows.replaceChildren(...blocks.map((block) => blockRow(block, now, since !== null)));
        source.textContent =
            savedOn !== null
                ? ''
                : tip.blocksAt !== null
                  ? CHAIN.source(tip.api ?? 'mempool.space', formatUtcClock(tip.blocksAt))
                  : '';
    }

    function setFact(id: ToolId, text: string): void {
        const target = fact(id);
        if (target) rollText(target, text);
    }

    function onChain(view: ChainView): void {
        chain = view;
        renderLegend();
        setFact('left', formatWhole(Math.floor(supplyAt(view.tip.height).left / SATS_PER_BTC)));
        share.refresh();
    }

    function renderPrice(): void {
        const satsFor = (dollars: number) => Math.round((dollars * SATS_PER_BTC) / prices.quote.value.usd);
        setFact('convert', HOME.sats(formatWhole(satsFor(1))));
        setFact('dca', HOME.sats(formatWhole(satsFor(HOME.facts.dca.amount))));
    }

    afterFirstPaint(() => {
        Promise.all([import('../data/power.ts'), import('../model/power.ts')])
            .then(([{ powerData }, { purchasingPower }]) => {
                if (disposed) return;
                const outcome = purchasingPower(HOME.facts.power.amount, FACT_START, powerData('USD'));
                if (outcome.ok) setFact('power', formatMoney(outcome.result.equivalentNow, 'USD'));
            })
            .catch(() => {});
    });

    const ticker = window.setInterval(() => {
        if (!document.hidden) renderLegend();
    }, LEGEND_TICK_MS);
    const stopChain = world.subscribe(onChain);
    const stopPrices = prices.subscribe(renderPrice);
    renderPrice();

    return () => {
        disposed = true;
        window.clearInterval(ticker);
        stopChain();
        stopPrices();
        share.dispose();
    };
}
