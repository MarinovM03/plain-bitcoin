import { hrefFor } from '../app/routes.ts';
import { heightFeed, type Tip } from '../data/height.ts';
import { priceFeed } from '../data/price.ts';
import { type SceneData, stage } from '../hero/bus.ts';
import { SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import { bindShareBar } from '../postcard/bar.ts';
import { siteAddress } from '../postcard/site.ts';
import { homePostcard } from '../postcard/words.ts';
import { TOOL_IDS, type ToolId } from '../tools/index.ts';
import { afterFirstPaint } from '../util/dom.ts';
import { formatFiatPrecise, formatMoney, formatWhole } from '../util/format.ts';
import { ADDRESS_SAMPLES } from './address-view.ts';
import { HOME, NAV, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { shareBar } from './output.ts';

function renderTile(id: ToolId, index: number): SafeHtml {
    return html`<li class="tiles__item tiles__item--${id}">
        <a class="tile" href="${hrefFor(id)}" data-plate>
            <span class="tile__kicker" aria-hidden="true">${String(index + 1).padStart(2, '0')} · ${NAV.short[id]}</span>
            <span class="tile__figure" data-tile-figure="${id}">${TOOLS[id].preview}</span>
            <span class="tile__preview" data-preview="${id}" aria-hidden="true"></span>
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
async function defaults(): Promise<{ power: SceneData & { id: 'power' }; dca: SceneData & { id: 'dca' } } | null> {
    const [{ powerData }, { purchasingPower }, { dca }, { dcaMarks }, daily] = await Promise.all([
        import('../data/power.ts'),
        import('../model/power.ts'),
        import('../model/dca.ts'),
        import('../tools/dca/marks.ts'),
        import('../data/prices/daily-gbp.json', { with: { type: 'json' } }),
    ]);
    const power = purchasingPower(1000, '2015-01', powerData('GBP'));
    const plan = dca({ amount: 50, frequency: 'weekly', start: '2020-01-01', feePercent: 0 }, daily.default);
    if (!power.ok || !plan.ok) return null;
    const worth = formatMoney(plan.result.valueNow, 'GBP');
    return {
        power: {
            id: 'power',
            cash: power.result.amount,
            bitcoin: power.result.btcValueNow,
            cashLabel: formatMoney(power.result.amount, 'GBP'),
            bitcoinLabel: formatMoney(power.result.btcValueNow, 'GBP'),
        },
        dca: { id: 'dca', fiat: 'GBP', worth, alt: '', ...dcaMarks(plan.result) },
    };
}

export function mountHome(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const site = siteAddress(siteUrl);
    const status = root.querySelector<HTMLElement>('#home-status');
    const figure = (id: ToolId) => root.querySelector<HTMLElement>(`[data-tile-figure="${id}"]`);
    const preview = (id: ToolId) => root.querySelector<HTMLElement>(`[data-preview="${id}"]`);
    let painted = false;
    let disposed = false;
    const share = bindShareBar(root, {
        postcard: () => homePostcard(readingOf(heights.tip)),
        site,
        onStatus: (message) => {
            if (status) status.textContent = message;
        },
    });
    share.setEnabled(true);

    function show(id: ToolId, data: SceneData): void {
        const element = preview(id);
        if (painted && element && !disposed) stage.preview(element, data);
    }

    function renderLeft(): void {
        const left = Math.floor(supplyAt(heights.tip.height).left / SATS_PER_BTC);
        const target = figure('left');
        if (target) target.textContent = HOME.leftFigure(`${formatWhole(left)} BTC`);
        show('left', { id: 'left', height: heights.tip.height });
        share.refresh();
    }

    function renderPrice(): void {
        const target = figure('convert');
        if (target)
            target.textContent = HOME.convertFigure(formatFiatPrecise(prices.quote.value.gbp / SATS_PER_BTC, 'GBP'));
    }

    const address = figure('address');
    if (address) address.textContent = HOME.addressFigure;
    const stopHeights = heights.subscribe(renderLeft);
    const stopPrices = prices.subscribe(renderPrice);
    renderLeft();
    renderPrice();
    afterFirstPaint(() => {
        if (disposed) return;
        painted = true;
        renderLeft();
        show('convert', { id: 'convert', sats: 1 });
        show('address', {
            id: 'address',
            text: ADDRESS_SAMPLES.p2tr,
            roles: [],
            state: 'valid',
            suspect: null,
            checksumBad: false,
        });
        defaults()
            .then((answers) => {
                if (!answers || disposed) return;
                const power = figure('power');
                const plan = figure('dca');
                if (power)
                    power.textContent = HOME.powerFigure(
                        answers.power.cashLabel ?? '',
                        answers.power.bitcoinLabel ?? '',
                    );
                if (plan) plan.textContent = HOME.dcaFigure(answers.dca.worth);
                show('power', answers.power);
                show('dca', answers.dca);
            })
            .catch(() => {});
    });

    return () => {
        disposed = true;
        stopHeights();
        stopPrices();
        share.dispose();
    };
}
