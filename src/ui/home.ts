import { hrefFor } from '../app/routes.ts';
import { heightFeed, type Tip } from '../data/height.ts';
import { priceFeed } from '../data/price.ts';
import { stage } from '../hero/bus.ts';
import { SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { bindShareBar } from '../postcard/bar.ts';
import { siteAddress } from '../postcard/site.ts';
import { homePostcard } from '../postcard/words.ts';
import { TOOL_IDS, type ToolId } from '../tools/index.ts';
import { afterFirstPaint } from '../util/dom.ts';
import { formatFiatPrecise, formatMoney, formatWhole } from '../util/format.ts';
import { HOME, NAV, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { sceneWindow, shareBar } from './output.ts';
import { HOME_SCENE } from './scene-copy.ts';

function renderTile(id: ToolId, index: number): SafeHtml {
    return html`<li class="tiles__item tiles__item--${id}">
        <a class="tile" href="${hrefFor(id)}" data-tile="${id}" data-plate>
            <span class="tile__kicker" aria-hidden="true">${String(index + 1).padStart(2, '0')} · ${NAV.short[id]}</span>
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
    return html`<section class="cautions" aria-labelledby="cautions-heading" data-plate>
    <h2 id="cautions-heading" class="cautions__heading">${HOME.cautionsHeading}</h2>
    <ul class="cautions__list">${lines}</ul>
</section>`;
}

export function renderHome(): SafeHtml {
    return html`<div class="home">
    <section class="overview" aria-labelledby="home-heading" data-plate>
        <p class="overview__kicker">${HOME.kicker}</p>
        <h1 id="home-heading" class="overview__heading" tabindex="-1">${HOME.headline}</h1>
        <p class="overview__lead">${HOME.lead}</p>
        <div class="overview__print">${shareBar()}<p id="home-status" class="visually-hidden" aria-live="polite"></p></div>
    </section>
    <section class="home__stage" aria-label="${HOME.sceneLabel}" data-plate>
        ${sceneWindow({ head: '', caption: HOME_SCENE.description })}
    </section>
    <section class="tiles" aria-label="${HOME.toolsLabel}">
        <ul class="tiles__grid">${TOOL_IDS.map(renderTile)}</ul>
    </section>
    ${renderCautions()}
</div>`;
}

function readingOf(tip: Tip) {
    return { supply: supplyAt(tip.height), api: tip.source === 'live' ? tip.api : null, checkedAt: tip.checkedAt };
}

/** The default questions, answered with the same model math the gauges use; loaded after first paint. */
async function defaults(): Promise<{ cash: string; bitcoin: string; worth: string } | null> {
    const [{ powerData }, { purchasingPower }, { dca }, daily] = await Promise.all([
        import('../data/power.ts'),
        import('../model/power.ts'),
        import('../model/dca.ts'),
        import('../data/prices/daily-gbp.json', { with: { type: 'json' } }),
    ]);
    const power = purchasingPower(1000, '2015-01', powerData('GBP'));
    const plan = dca({ amount: 50, frequency: 'weekly', start: '2020-01-01', feePercent: 0 }, daily.default);
    if (!power.ok || !plan.ok) return null;
    return {
        cash: formatMoney(power.result.amount, 'GBP'),
        bitcoin: formatMoney(power.result.btcValueNow, 'GBP'),
        worth: formatMoney(plan.result.valueNow, 'GBP'),
    };
}

export function mountHome(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const site = siteAddress(siteUrl);
    const status = root.querySelector<HTMLElement>('#home-status');
    const plot = root.querySelector<HTMLElement>('#scene-plot');
    const figure = (id: ToolId) => root.querySelector<HTMLElement>(`[data-tile-figure="${id}"]`);
    let shownHeight = -1;
    let disposed = false;
    const share = bindShareBar(root, {
        postcard: () => homePostcard(readingOf(heights.tip)),
        site,
        onStatus: (message) => {
            if (status) status.textContent = message;
        },
    });
    share.setEnabled(true);

    function renderLeft(): void {
        const left = Math.floor(supplyAt(heights.tip.height).left / SATS_PER_BTC);
        const target = figure('left');
        if (target) target.textContent = HOME.leftFigure(`${formatWhole(left)} BTC`);
        const height = heights.tip.height;
        if (plot && height !== shownHeight) {
            if (shownHeight < 0) stage.show(plot, { id: 'home', height });
            else stage.update({ id: 'home', height });
            shownHeight = height;
        }
        share.refresh();
    }

    function renderPrice(): void {
        const target = figure('convert');
        if (target)
            target.textContent = HOME.convertFigure(formatFiatPrecise(prices.quote.value.gbp / SATS_PER_BTC, 'GBP'));
    }

    // A tile in hand lifts its miniature on the table, the same as pointing at the miniature lights the tile.
    const tiles = [...root.querySelectorAll<HTMLElement>('.tile[data-tile]')];
    const lift = (event: Event) => stage.focus((event.currentTarget as HTMLElement).dataset.tile ?? null);
    const drop = () => stage.focus(null);
    for (const tile of tiles) {
        tile.addEventListener('pointerenter', lift);
        tile.addEventListener('focus', lift);
        tile.addEventListener('pointerleave', drop);
        tile.addEventListener('blur', drop);
    }

    const address = figure('address');
    if (address) address.textContent = HOME.addressFigure;
    const stopHeights = heights.subscribe(renderLeft);
    const stopPrices = prices.subscribe(renderPrice);
    renderLeft();
    renderPrice();
    afterFirstPaint(() => {
        if (disposed) return;
        defaults()
            .then((answers) => {
                if (!answers || disposed) return;
                const power = figure('power');
                const plan = figure('dca');
                if (power) power.textContent = HOME.powerFigure(answers.cash, answers.bitcoin);
                if (plan) plan.textContent = HOME.dcaFigure(answers.worth);
            })
            .catch(() => {});
    });

    return () => {
        disposed = true;
        stopHeights();
        stopPrices();
        share.dispose();
        for (const tile of tiles) {
            tile.removeEventListener('pointerenter', lift);
            tile.removeEventListener('focus', lift);
            tile.removeEventListener('pointerleave', drop);
            tile.removeEventListener('blur', drop);
        }
    };
}
