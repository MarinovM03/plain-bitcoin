import { hrefFor } from '../app/routes.ts';
import { advanceChain, type ChainEffect, EMPTY_CHAIN } from '../chain/machine.ts';
import { stripPath } from '../chain/hash.ts';
import { chainStill } from '../chain/still.ts';
import { type ChainBlock, heightFeed, type Tip } from '../data/height.ts';
import { priceFeed } from '../data/price.ts';
import { mountHero } from '../hero/bus.ts';
import { SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { bindShareBar } from '../postcard/bar.ts';
import { siteAddress } from '../postcard/site.ts';
import { homePostcard } from '../postcard/words.ts';
import { TOKENS } from '../styles/tokens.ts';
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

const LEGEND_TICK_MS = 15_000;

const STRIP = { columns: 2, rows: 16 } as const;
/** Each tile shows its own 32 bits from the tail of the hash; the head is the blank proof-of-work run. */
const STRIP_FROM = 96;
const FACT_START = '2015-01';

const FACT_UNITS: Record<ToolId, string> = {
    left: HOME.facts.left.unit,
    power: HOME.facts.power.unit(formatAmount(HOME.facts.power.amount, 'USD'), String(HOME.facts.power.year)),
    convert: HOME.facts.convert.unit,
    dca: HOME.facts.dca.unit(formatAmount(HOME.facts.dca.amount, 'USD')),
    address: HOME.facts.address.unit,
};

/**
 * A tool as a tile: its short name, one line that explains it, and one real number. The number's place is held
 * from the first paint, so nothing shifts when it arrives. The strip on the edge is 32 bits of the newest block.
 */
function renderRow(id: ToolId): SafeHtml {
    return html`<li class="tool-list__item">
        <a class="tool-row" href="${hrefFor(id)}" data-tool="${id}">
            <svg class="tool-row__bits" viewBox="0 0 ${STRIP.columns} ${STRIP.rows}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d=""/></svg>
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
 * Home: the headline and the five tools as plain links, beside the chain. The chain's picture is decoration for the
 * eye (hidden from assistive tech and never clickable); the lines under it and the list below say the same in words.
 */
export function renderHome(): SafeHtml {
    const columns = Object.values(CHAIN.columns).map((name) => html`<th scope="col">${name}</th>`);
    return html`<div class="home">
    <section class="hero" aria-labelledby="home-heading">
        <div class="hero__intro">
            <h1 id="home-heading" class="hero__heading" tabindex="-1">${HOME.headline.slice(0, -HOME.headlineAccent.length)}<span class="hero__accent">${HOME.headlineAccent}</span></h1>
            <p class="hero__lead">${HOME.lead}</p>
            <nav class="tool-list" aria-label="${HOME.toolsHeading}">
                <ul class="tool-list__rows">${TOOL_IDS.map(renderRow)}</ul>
            </nav>
            <p class="tool-list__source">${HOME.factsSource}</p>
        </div>
        <div class="hero__stage">
            <div id="chain" class="chain" data-hero="still" aria-hidden="true">
                <div id="chain-still" class="chain__still"></div>
            </div>
            <div class="chain__legend">
                <p id="chain-forming" class="chain__forming">${CHAIN.waiting}</p>
                <p id="chain-newest" class="chain__newest"></p>
            </div>
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

export function mountHome(root: HTMLElement, siteUrl: string, announce: (message: string) => void): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const site = siteAddress(siteUrl);
    const host = find(root, '#chain');
    const stillLayer = find(root, '#chain-still');
    const forming = find(root, '#chain-forming');
    const newest = find(root, '#chain-newest');
    const rows = find(root, '#chain-rows');
    const source = find(root, '#chain-source');
    const status = find(root, '#home-status');
    const fact = (id: ToolId) => root.querySelector<HTMLElement>(`[data-fact="${id}"]`);
    const strips = [...root.querySelectorAll<SVGPathElement>('.tool-row__bits path')];
    let stripHash: string | null = null;
    const hero = mountHero(host, afterFirstPaint);
    let chain = EMPTY_CHAIN;
    /** Where the shown blocks came from when no API vouches for them right now: a saved day, or nothing. */
    let savedOn: string | null = null;
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

    /** The newest block's own timestamp, only while a live feed stands behind it. */
    function formingSince(tip: Tip): number | null {
        const first = chain.blocks[0];
        if (savedOn !== null || tip.source !== 'live' || !first || first.height !== tip.height) return null;
        return first.time ?? tip.time;
    }

    function renderStill(): void {
        const { clientWidth: width, clientHeight: height } = host;
        if (width < 2 || height < 2 || chain.blocks.length === 0) return;
        const since = formingSince(heights.tip);
        stillLayer.innerHTML = chainStill(chain.blocks, {
            width,
            height,
            nowSeconds: since === null ? null : Date.now() / 1000,
            forming: since !== null,
            ink: TOKENS.void,
        });
    }

    function renderLegend(): void {
        const tip = heights.tip;
        const now = Date.now() / 1000;
        const first = chain.blocks[0];
        const last = chain.blocks[chain.blocks.length - 1];
        const since = formingSince(tip);
        if (!first || !last) {
            forming.textContent = CHAIN.waiting;
            newest.textContent = '';
            return;
        }
        if (savedOn !== null) {
            forming.textContent = CHAIN.saved(
                formatWhole(last.height),
                formatWhole(first.height),
                formatShortDay(isoDayMs(savedOn)),
            );
        } else if (since === null) {
            forming.textContent =
                tip.source === 'offline' && tip.blocksAt !== null
                    ? CHAIN.lastSeen(formatUtcClock(tip.blocksAt))
                    : CHAIN.formingUnknown;
        } else {
            forming.textContent = CHAIN.forming(formatMinutes(now - since));
        }
        host.dataset.state = savedOn !== null ? 'saved' : since === null ? 'stale' : 'live';
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
        rows.replaceChildren(...chain.blocks.map((block) => blockRow(block, now, since !== null)));
        source.textContent =
            savedOn !== null
                ? ''
                : tip.blocksAt !== null
                  ? CHAIN.source(tip.api ?? 'mempool.space', formatUtcClock(tip.blocksAt))
                  : '';
    }

    function show(effect: ChainEffect): void {
        hero.show({ blocks: chain.blocks, formingSince: formingSince(heights.tip), effect });
        host.dataset.advances = String(chain.advances);
        host.dataset.tip = String(chain.blocks[0]?.height ?? '');
        renderStill();
    }

    function take(blocks: readonly ChainBlock[]): void {
        const { state, effect } = advanceChain(chain, blocks);
        chain = state;
        show(effect);
    }

    function onTip(tip: Tip): void {
        if (tip.blocks.length > 0) {
            // Live blocks replace a saved set outright: nothing was "just found".
            if (savedOn !== null) chain = EMPTY_CHAIN;
            savedOn = null;
            const before = chain.advances;
            take(tip.blocks);
            if (chain.advances > before) announce(CHAIN.arrived(formatWhole(tip.height)));
        } else if (tip.source === 'offline' && chain.blocks.length === 0) {
            import('../data/chain-snapshot.ts')
                .then(({ SNAPSHOT }) => {
                    if (disposed || chain.blocks.length > 0) return;
                    savedOn = SNAPSHOT.asOf;
                    take(SNAPSHOT.blocks);
                    renderLegend();
                })
                .catch(() => {});
        }
        renderLegend();
        const left = Math.floor(supplyAt(tip.height).left / SATS_PER_BTC);
        setFact('left', formatWhole(left));
        const hash = chain.blocks[0]?.hash ?? null;
        if (hash !== stripHash) {
            stripHash = hash;
            strips.forEach((path, index) => {
                path.setAttribute(
                    'd',
                    stripPath(hash, STRIP_FROM + index * STRIP.columns * STRIP.rows, STRIP.columns, STRIP.rows),
                );
            });
        }
        share.refresh();
    }

    function setFact(id: ToolId, text: string): void {
        const target = fact(id);
        if (target) target.textContent = text;
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

    const resizes = new ResizeObserver(renderStill);
    resizes.observe(host);
    const ticker = window.setInterval(() => {
        if (!document.hidden) renderLegend();
    }, LEGEND_TICK_MS);
    const stopHeights = heights.subscribe(onTip);
    const stopPrices = prices.subscribe(renderPrice);
    onTip(heights.tip);
    renderPrice();

    return () => {
        disposed = true;
        window.clearInterval(ticker);
        resizes.disconnect();
        stopHeights();
        stopPrices();
        share.dispose();
        hero.dispose();
    };
}
