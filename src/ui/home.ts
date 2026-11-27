import { hrefFor } from '../app/routes.ts';
import { savedHeader } from '../data/header.ts';
import { heightFeed, type Tip } from '../data/height.ts';
import { fetchFees, fetchLine, minedFills } from '../data/mempool.ts';
import { priceFeed } from '../data/price.ts';
import type { SceneData, SceneId } from '../gauges/types.ts';
import { attach, type MachineId, type QueueInput, type View } from '../hero/bus.ts';
import { type FeeRates, feeCosts, paymentSize } from '../model/fees.ts';
import { targetZeroBits } from '../model/header.ts';
import { createMiner, leadingZeroBits } from '../model/sha256.ts';
import { MAX_SUPPLY, SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import type { WaitingLine } from '../model/tx.ts';
import type { ToolId } from '../tools/index.ts';
import { DEPTHS } from '../tools/miner/protocol.ts';
import { afterFirstPaint } from '../util/dom.ts';
import { formatAmount, formatMinutes, formatMoney, formatWhole } from '../util/format.ts';
import { prefersReducedMotion } from '../util/motion.ts';
import { SAMPLE_PARTS } from './address-view.ts';
import { HOME, SHARE, TOOLS } from './copy.ts';
import type { HomeExtras } from './home-extras.ts';
import { html, type SafeHtml } from './html.ts';
import { rollText } from './roll.ts';

/** A machine shows its live scene; a calculator shows its own chart, drawn from the same model as its page. */
type TileId = Exclude<ToolId, 'stack'>;

type Tile = { id: TileId; size: 'hero' | 'wide' | 'small' } & ({ machine: MachineId } | { chart: SceneId });

const TILES: readonly Tile[] = [
    { id: 'miner', machine: 'miner', size: 'hero' },
    { id: 'left', machine: 'wall', size: 'small' },
    { id: 'halving', machine: 'halving', size: 'small' },
    { id: 'tx', machine: 'queue', size: 'small' },
    { id: 'fees', chart: 'fees', size: 'small' },
    { id: 'convert', machine: 'sats', size: 'small' },
    { id: 'power', chart: 'power', size: 'small' },
    { id: 'dca', chart: 'dca', size: 'small' },
    { id: 'address', chart: 'address', size: 'small' },
];

const FACT_UNITS: Record<TileId, string> = {
    miner: HOME.hashedNone,
    left: HOME.facts.left.unit,
    halving: HOME.facts.halving.unit,
    tx: HOME.facts.tx.unit,
    fees: HOME.facts.fees.unit,
    power: HOME.facts.power.unit(formatAmount(HOME.facts.power.amount, 'USD'), String(HOME.facts.power.year)),
    convert: HOME.facts.convert.unit,
    dca: HOME.facts.dca.unit(formatAmount(HOME.facts.dca.amount, 'USD')),
    address: HOME.facts.address.unit,
};

const PLAN_MONTHS = 72;
const HASH_TICK_MS = 150;
const HASHES_PER_TICK = 400;

function renderTile(tile: Tile): SafeHtml {
    const { id, size } = tile;
    const scene =
        'machine' in tile
            ? html`<div class="tile__scene" data-machine="${tile.machine}" aria-hidden="true"></div>`
            : html`<div class="tile__scene tile__chart" data-chart="${tile.chart}" aria-hidden="true"></div>`;
    const badge = id === 'miner' ? html`<span class="tile__badge">${HOME.fresh}</span>` : '';
    return html`<li class="tile tile--${size}">
        <a class="tile__link" href="${hrefFor(id)}" data-tool="${id}">
            ${scene}
            ${badge}
            <span class="tile__text">
                <span class="tile__name">${TOOLS[id].name}</span>
                <span class="tile__line">${TOOLS[id].description}</span>
                <span class="tile__fact"><span class="tile__figure" data-fact="${id}">${id === 'address' ? HOME.facts.address.figure : HOME.pending}</span> <span class="tile__unit" data-unit="${id}">${FACT_UNITS[id]}</span></span>
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

/** The strip of live numbers under the headline, each one a door into the machine it comes from. */
const NOW: readonly { key: keyof typeof HOME.now; tool: ToolId; unit: string }[] = [
    { key: 'block', tool: 'miner', unit: HOME.now.block.unitUnknown },
    { key: 'price', tool: 'convert', unit: HOME.now.price.unit },
    { key: 'fees', tool: 'fees', unit: HOME.now.fees.unit },
    { key: 'halving', tool: 'halving', unit: HOME.now.halving.unit },
    { key: 'left', tool: 'left', unit: HOME.now.left.unit },
    { key: 'stack', tool: 'stack', unit: HOME.now.stack.unit },
];

function renderNow(): SafeHtml {
    const items = NOW.map(
        ({ key, tool, unit }) => html`<li class="now__cell">
            <a class="now__item" href="${hrefFor(tool)}">
                <span class="now__label">${key === 'block' ? html`<span class="intro__pulse" aria-hidden="true"></span>` : ''}${HOME.now[key].label}</span>
                <span class="now__figure" data-now="${key}">${HOME.pending}</span>
                <span class="now__unit" data-now-unit="${key}">${unit}</span>
            </a>
        </li>`,
    );
    return html`<section class="now" aria-labelledby="now-heading">
    <div class="now__head">
        <h2 id="now-heading" class="now__heading">${HOME.nowLabel}</h2>
        <div class="share-bar now__share" role="group" aria-label="${SHARE.label}">
            <button class="button now__print" type="button" data-share="print" disabled>${HOME.today}</button>
        </div>
    </div>
    <ul class="now__list">${items}</ul>
    <p id="now-status" class="visually-hidden" aria-live="polite"></p>
</section>`;
}

/** Home: one line of promise, what Bitcoin is doing right now, then every machine as a tile. Every tile is a link. */
export function renderHome(): SafeHtml {
    const head = HOME.headline.slice(0, -HOME.headlineAccent.length);
    return html`<div class="home">
    <section class="intro" aria-labelledby="home-heading">
        <h1 id="home-heading" class="intro__title" tabindex="-1">${head}<span class="intro__accent">${HOME.headlineAccent}</span></h1>
        <p class="intro__lead">${HOME.lead}</p>
    </section>
    ${renderNow()}
    <nav class="gallery" aria-label="${HOME.galleryLabel}">
        <ul class="gallery__grid">${TILES.map(renderTile)}</ul>
    </nav>
    <p class="gallery__source">${HOME.factsSource}</p>
    ${renderCautions()}
</div>`;
}

function blockAge(tip: Tip): string {
    if (tip.source !== 'live' || tip.time === null) return HOME.now.block.unitUnknown;
    return HOME.now.block.unit(formatMinutes(Date.now() / 1000 - tip.time));
}

/**
 * The miner tile hashes for real while it is on screen: the saved header, a few thousand nonces at a time, so the
 * sparks in its well are this browser's own work.
 */
function hashOnTile(slot: HTMLElement, view: View<'miner'>, onCount: (count: number) => void): () => void {
    const reading = savedHeader();
    const miner = createMiner(reading.header.bytes);
    const needed = targetZeroBits(reading.header.bits);
    let nonce = 0;
    let count = 0;
    let best = -1;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting === true;
    });
    observer.observe(slot);
    const timer = window.setInterval(() => {
        if (!visible || document.hidden || prefersReducedMotion()) return;
        const tally = new Array<number>(DEPTHS).fill(0);
        for (let i = 0; i < HASHES_PER_TICK; i += 1) {
            const zeros = Math.min(DEPTHS - 1, leadingZeroBits(miner.hash(nonce)));
            tally[zeros] = (tally[zeros] ?? 0) + 1;
            if (zeros > best) best = zeros;
            nonce = (nonce + 1) >>> 0;
        }
        count += HASHES_PER_TICK;
        view.set({ needed, best, real: null, tally, dive: 0 });
        onCount(count);
    }, HASH_TICK_MS);
    view.set({ needed, best, real: null, tally: null, dive: 0 });
    return () => {
        observer.disconnect();
        window.clearInterval(timer);
    };
}

/** The home preview of a buying plan: the tile's own amount every month for six years, at month-end closes. */
function monthlyPlan(months: readonly string[], closes: Readonly<Record<string, number>>): SceneData {
    const t: number[] = [];
    const value: number[] = [];
    const invested: number[] = [];
    let coins = 0;
    for (const [i, month] of months.entries()) {
        const close = closes[month] ?? 0;
        if (close > 0) coins += HOME.facts.dca.amount / close;
        t.push(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
        value.push(coins * close);
        invested.push((i + 1) * HOME.facts.dca.amount);
    }
    return { id: 'dca', fiat: 'USD', worth: '', alt: '', t, value, invested, lump: [] };
}

interface TileCharts {
    set(data: SceneData): void;
    stop(): void;
}

/** Paints each calculator tile's chart once its data is in, and again whenever its tile changes size. */
function tileCharts(root: HTMLElement): TileCharts {
    const charts: Partial<Record<SceneId, SceneData>> = {};
    const boxes = [...root.querySelectorAll<HTMLElement>('[data-chart]')];
    let stopped = false;
    const ready = Promise.all([import('../gauges/paint.ts'), import('../gauges/index.ts')]);
    const paint = (box: HTMLElement) => {
        const data = charts[box.dataset.chart as SceneId];
        if (!data || box.clientWidth <= 0 || box.clientHeight <= 0) return;
        ready
            .then(async ([{ paintGauge }, { loadLayout }]) => {
                const layout = await loadLayout(data.id);
                if (stopped) return;
                paintGauge(box, layout(data, { width: box.clientWidth, height: box.clientHeight, mini: false }), true);
            })
            .catch(() => {});
    };
    const resizes = new ResizeObserver((entries) => {
        for (const entry of entries) paint(entry.target as HTMLElement);
    });
    for (const box of boxes) resizes.observe(box);
    return {
        set(data) {
            charts[data.id] = data;
            for (const box of boxes) if (box.dataset.chart === data.id) paint(box);
        },
        stop() {
            stopped = true;
            resizes.disconnect();
        },
    };
}

export function mountHome(root: HTMLElement, site: string): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const fact = (id: ToolId) => root.querySelector<HTMLElement>(`[data-fact="${id}"]`);
    const charts = tileCharts(root);
    let rates: FeeRates | null = null;
    let ratesHeight = -1;
    let feeFigure: string | null = null;
    let extras: HomeExtras | null = null;
    const unit = (id: ToolId) => root.querySelector<HTMLElement>(`[data-unit="${id}"]`);
    const views: View<MachineId>[] = [];
    const stops: (() => void)[] = [];
    let disposed = false;

    function setFact(id: ToolId, text: string): void {
        const target = fact(id);
        if (target) rollText(target, text);
    }

    function setNow(key: keyof typeof HOME.now, figure: string, unitText?: string): void {
        const target = root.querySelector<HTMLElement>(`[data-now="${key}"]`);
        if (target) rollText(target, figure);
        const unitTarget = root.querySelector<HTMLElement>(`[data-now-unit="${key}"]`);
        if (unitTarget && unitText !== undefined) unitTarget.textContent = unitText;
    }

    /** What a usual payment costs right now: one SegWit coin to two outputs, as on the Send now? page. */
    function showFees(): void {
        const current = rates;
        if (!current) return;
        import('../postcard/words.ts')
            .then(({ feesText }) => {
                if (disposed) return;
                const vbytes = paymentSize('segwit', 1, 2);
                const costs = feeCosts(current, vbytes, prices.quote.value.usd);
                const text = feesText({
                    type: 'segwit',
                    vbytes,
                    costs,
                    height: heights.tip.height,
                    readAt: Date.now(),
                });
                if (!text) return;
                feeFigure = text.figure;
                setNow('fees', text.figure);
                setFact('fees', text.figure);
                extras?.update();
                charts.set({ id: 'fees', rows: text.rows });
            })
            .catch(() => {});
    }

    function readFees(): void {
        if (ratesHeight === heights.tip.height) return;
        ratesHeight = heights.tip.height;
        fetchFees((url, init) => window.fetch(url, init))
            .then((next) => {
                if (disposed) return;
                rates = next;
                showFees();
            })
            .catch(() => {
                ratesHeight = -1;
            });
    }

    function slot(machine: MachineId): HTMLElement | null {
        return root.querySelector<HTMLElement>(`[data-machine="${machine}"]`);
    }

    const wallSlot = slot('wall');
    const wall = wallSlot
        ? attach(wallSlot, 'wall', { issued: supplyAt(heights.tip.height).issued / MAX_SUPPLY })
        : null;
    const satsSlot = slot('sats');
    const sats = satsSlot ? attach(satsSlot, 'sats', { sats: 0, money: 0, symbol: '$' }) : null;
    const halvingSlot = slot('halving');
    const halving = halvingSlot ? attach(halvingSlot, 'halving', { height: heights.tip.height }) : null;
    const queueSlot = slot('queue');
    let waiting: WaitingLine = { floors: [], fills: [], counts: [] };
    const queueInput = (): QueueInput => ({
        ...waiting,
        rate: null,
        slab: null,
        confirmed: false,
        confirmedDepth: null,
        mined: minedFills(heights.tip),
        height: heights.tip.height,
    });
    const queue = queueSlot ? attach(queueSlot, 'queue', queueInput()) : null;
    const minerSlot = slot('miner');
    const miner = minerSlot
        ? attach(minerSlot, 'miner', { needed: 79, best: -1, real: null, tally: null, dive: 0 })
        : null;
    for (const view of [wall, halving, queue, sats, miner]) if (view) views.push(view as View<MachineId>);

    if (minerSlot && miner) {
        stops.push(
            hashOnTile(minerSlot, miner, (count) => {
                setFact('miner', formatWhole(count));
                const target = unit('miner');
                if (target) target.textContent = HOME.hashed;
            }),
        );
    }

    function onTip(tip: Tip): void {
        const supply = supplyAt(tip.height);
        setNow('block', formatWhole(tip.height), blockAge(tip));
        setNow('halving', formatWhole(supply.blocksToHalving));
        setNow('left', formatWhole(Math.floor(supply.left / SATS_PER_BTC)));
        if (started) readFees();
        extras?.update();
        setFact('left', formatWhole(Math.floor(supply.left / SATS_PER_BTC)));
        wall?.set({ issued: supply.issued / MAX_SUPPLY });
        halving?.set({ height: tip.height });
        queue?.set(queueInput());
        setFact('halving', formatWhole(supply.blocksToHalving));
    }

    function onPrice(): void {
        const usd = prices.quote.value.usd;
        const satsFor = (dollars: number) => Math.round((dollars * SATS_PER_BTC) / usd);
        setFact('convert', formatWhole(satsFor(1)));
        setFact('dca', formatWhole(satsFor(HOME.facts.dca.amount)));
        sats?.set({ sats: satsFor(1), money: 1, symbol: '$' });
        setNow('price', formatMoney(usd, 'USD'));
        showFees();
        extras?.update();
    }

    let started = false;
    afterFirstPaint(() => {
        started = true;
        readFees();
        import('./home-extras.ts')
            .then(({ mountHomeExtras }) => {
                if (disposed) return;
                extras = mountHomeExtras(
                    root,
                    site,
                    { tip: () => heights.tip, quote: () => prices.quote, fee: () => feeFigure },
                    setNow,
                );
            })
            .catch(() => {});
        fetchLine((url, init) => window.fetch(url, init))
            .then((line) => {
                if (disposed) return;
                waiting = line;
                queue?.set(queueInput());
                const floor = line.floors[0];
                if (floor !== undefined) setFact('tx', floor.toLocaleString('en-GB', { maximumFractionDigits: 1 }));
            })
            .catch(() => {});
        Promise.all([import('../data/power.ts'), import('../model/power.ts'), import('../model/melt.ts')])
            .then(([{ powerData }, { purchasingPower, sortedMonths }, { melt: meltOf }]) => {
                if (disposed) return;
                const data = powerData('USD');
                const kept = meltOf(HOME.facts.power.amount, HOME.facts.power.year, data.cpi);
                if (kept.ok) setFact('power', formatMoney(kept.result.buysNow, 'USD'));
                const months = sortedMonths(data.closes);
                charts.set(monthlyPlan(months.slice(-PLAN_MONTHS), data.closes));
                charts.set({ id: 'address', ...SAMPLE_PARTS, state: 'valid', suspect: null, checksumBad: false });
                // Bitcoin has no close before mid-2010, so the tile's year starts at its first close.
                const asked = `${HOME.facts.power.year}-01`;
                const start = months[0] && months[0] > asked ? months[0] : asked;
                const power = purchasingPower(HOME.facts.power.amount, start, data);
                if (power.ok) charts.set({ id: 'power', cash: power.result.amount, bitcoin: power.result.btcValueNow });
            })
            .catch(() => {});
    });

    const ticker = window.setInterval(() => {
        if (document.hidden) return;
        const target = root.querySelector<HTMLElement>('[data-now-unit="block"]');
        if (target) target.textContent = blockAge(heights.tip);
    }, 15_000);
    const stopTip = heights.subscribe(onTip);
    const stopPrices = prices.subscribe(onPrice);
    onTip(heights.tip);
    onPrice();

    return () => {
        disposed = true;
        window.clearInterval(ticker);
        stopTip();
        stopPrices();
        charts.stop();
        extras?.dispose();
        for (const stop of stops) stop();
        for (const view of views) view.detach();
    };
}
