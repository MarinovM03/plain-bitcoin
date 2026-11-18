import { hrefFor } from '../app/routes.ts';
import { savedHeader } from '../data/header.ts';
import { heightFeed, type Tip } from '../data/height.ts';
import { fetchLine } from '../data/mempool.ts';
import { priceFeed } from '../data/price.ts';
import { attach, type MachineId, type View } from '../hero/bus.ts';
import { targetZeroBits } from '../model/header.ts';
import { createMiner, leadingZeroBits } from '../model/sha256.ts';
import { scaleLines, stackLines } from '../model/stack.ts';
import { MAX_SUPPLY, SATS_PER_BTC, supplyAt } from '../model/supply.ts';
import type { ToolId } from '../tools/index.ts';
import { DEPTHS } from '../tools/miner/protocol.ts';
import { afterFirstPaint, find } from '../util/dom.ts';
import { formatAmount, formatMinutes, formatMoney, formatWhole } from '../util/format.ts';
import { prefersReducedMotion } from '../util/motion.ts';
import { HOME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { rollText } from './roll.ts';

const TILES: readonly { id: ToolId; machine: MachineId | null; size: 'hero' | 'wide' | 'small' }[] = [
    { id: 'miner', machine: 'miner', size: 'hero' },
    { id: 'left', machine: 'wall', size: 'small' },
    { id: 'halving', machine: 'halving', size: 'small' },
    { id: 'tx', machine: 'queue', size: 'wide' },
    { id: 'convert', machine: 'sats', size: 'small' },
    { id: 'power', machine: 'melt', size: 'small' },
    { id: 'dca', machine: 'stack', size: 'small' },
    { id: 'address', machine: null, size: 'small' },
];

const FACT_UNITS: Record<ToolId, string> = {
    miner: HOME.hashedNone,
    left: HOME.facts.left.unit,
    halving: HOME.facts.halving.unit,
    tx: HOME.facts.tx.unit,
    power: HOME.facts.power.unit(formatAmount(HOME.facts.power.amount, 'USD'), String(HOME.facts.power.year)),
    convert: HOME.facts.convert.unit,
    dca: HOME.facts.dca.unit(formatAmount(HOME.facts.dca.amount, 'USD')),
    address: HOME.facts.address.unit,
};

const STACK_MONTHS = 72;
const HASH_TICK_MS = 150;
const HASHES_PER_TICK = 400;

function renderTile({ id, machine, size }: (typeof TILES)[number]): SafeHtml {
    const scene = machine
        ? html`<div class="tile__scene" data-machine="${machine}" aria-hidden="true"></div>`
        : html`<div class="tile__scene tile__scene--type" aria-hidden="true"><span>bc1q</span><span>…</span><span>x0wlh</span></div>`;
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

/** Home: one line of promise, then every machine as a live tile. Each tile is a plain link; its scene only shows. */
export function renderHome(): SafeHtml {
    const head = HOME.headline.slice(0, -HOME.headlineAccent.length);
    return html`<div class="home">
    <section class="intro" aria-labelledby="home-heading">
        <h1 id="home-heading" class="intro__title" tabindex="-1">${head}<span class="intro__accent">${HOME.headlineAccent}</span></h1>
        <p class="intro__lead">${HOME.lead}</p>
        <p id="home-live" class="intro__live"><span class="intro__pulse" aria-hidden="true"></span><span id="home-live-text">${HOME.pending}</span></p>
    </section>
    <nav class="gallery" aria-label="${HOME.galleryLabel}">
        <ul class="gallery__grid">${TILES.map(renderTile)}</ul>
    </nav>
    <p class="gallery__source">${HOME.factsSource}</p>
    ${renderCautions()}
</div>`;
}

function liveLine(tip: Tip): string {
    const height = formatWhole(tip.height);
    if (tip.source !== 'live' || tip.time === null) return HOME.liveUnknown(height);
    return HOME.live(height, formatMinutes(Date.now() / 1000 - tip.time));
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

export function mountHome(root: HTMLElement): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const liveText = find(root, '#home-live-text');
    const fact = (id: ToolId) => root.querySelector<HTMLElement>(`[data-fact="${id}"]`);
    const unit = (id: ToolId) => root.querySelector<HTMLElement>(`[data-unit="${id}"]`);
    const views: View<MachineId>[] = [];
    const stops: (() => void)[] = [];
    let disposed = false;

    function setFact(id: ToolId, text: string): void {
        const target = fact(id);
        if (target) rollText(target, text);
    }

    function slot(machine: MachineId): HTMLElement | null {
        return root.querySelector<HTMLElement>(`[data-machine="${machine}"]`);
    }

    const wallSlot = slot('wall');
    const wall = wallSlot
        ? attach(wallSlot, 'wall', { issued: supplyAt(heights.tip.height).issued / MAX_SUPPLY })
        : null;
    const satsSlot = slot('sats');
    const sats = satsSlot ? attach(satsSlot, 'sats', { sats: 0 }) : null;
    const meltSlot = slot('melt');
    const melt = meltSlot ? attach(meltSlot, 'melt', { kept: 1, symbol: '$' }) : null;
    const halvingSlot = slot('halving');
    const halving = halvingSlot ? attach(halvingSlot, 'halving', { height: heights.tip.height }) : null;
    const queueSlot = slot('queue');
    const queue = queueSlot
        ? attach(queueSlot, 'queue', { floors: [], fills: [], counts: [], rate: null, slab: null, confirmed: false })
        : null;
    const stackSlot = slot('stack');
    const stack = stackSlot ? attach(stackSlot, 'stack', { value: [], invested: [] }) : null;
    const minerSlot = slot('miner');
    const miner = minerSlot
        ? attach(minerSlot, 'miner', { needed: 79, best: -1, real: null, tally: null, dive: 0 })
        : null;
    for (const view of [wall, halving, queue, sats, melt, stack, miner]) if (view) views.push(view as View<MachineId>);

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
        liveText.textContent = liveLine(tip);
        const supply = supplyAt(tip.height);
        setFact('left', formatWhole(Math.floor(supply.left / SATS_PER_BTC)));
        wall?.set({ issued: supply.issued / MAX_SUPPLY });
        halving?.set({ height: tip.height });
        setFact('halving', formatWhole(supply.blocksToHalving));
    }

    function onPrice(): void {
        const usd = prices.quote.value.usd;
        const satsFor = (dollars: number) => Math.round((dollars * SATS_PER_BTC) / usd);
        setFact('convert', formatWhole(satsFor(1)));
        setFact('dca', formatWhole(satsFor(HOME.facts.dca.amount)));
        sats?.set({ sats: satsFor(1) });
    }

    afterFirstPaint(() => {
        fetchLine((url, init) => window.fetch(url, init))
            .then((line) => {
                if (disposed) return;
                queue?.set({ ...line, rate: null, slab: null, confirmed: false });
                const floor = line.floors[0];
                if (floor !== undefined) setFact('tx', floor.toLocaleString('en-GB', { maximumFractionDigits: 1 }));
            })
            .catch(() => {});
        Promise.all([import('../data/power.ts'), import('../model/power.ts'), import('../model/melt.ts')])
            .then(([{ powerData }, { sortedMonths }, { melt: meltOf }]) => {
                if (disposed) return;
                const data = powerData('USD');
                const outcome = meltOf(HOME.facts.power.amount, HOME.facts.power.year, data.cpi);
                if (outcome.ok) {
                    setFact('power', formatMoney(outcome.result.buysNow, 'USD'));
                    melt?.set({ kept: outcome.result.kept, symbol: '$' });
                }
                const months = sortedMonths(data.closes).slice(-STACK_MONTHS);
                const closes = months.map((month) => data.closes[month] ?? 0);
                stack?.set(scaleLines(stackLines(closes, HOME.facts.dca.amount)));
            })
            .catch(() => {});
    });

    const ticker = window.setInterval(() => {
        if (!document.hidden) liveText.textContent = liveLine(heights.tip);
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
        for (const stop of stops) stop();
        for (const view of views) view.detach();
    };
}
