import { HEIGHT_ANCHOR, heightFeed, type Tip } from '../../data/height.ts';
import { attach } from '../../hero/bus.ts';
import { estimatedHalvingTime, MAX_SUPPLY, supplyAt } from '../../model/supply.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { leftPostcard } from '../../postcard/words.ts';
import { LEFT_PAGE } from '../../ui/copy.ts';
import { ZOOM_STEPS } from '../../ui/left-view.ts';
import { afterFirstPaint, find, link } from '../../util/dom.ts';
import { formatBtc, formatBtcExact, formatDay, formatPpm, formatUtcStamp, formatWhole } from '../../util/format.ts';
import { tipAge, watchActive } from './counter.ts';

const MEMPOOL = 'https://mempool.space/';

export function mountLeft(root: HTMLElement, siteUrl: string): () => void {
    const panel = find(root, '#numbers-panel');
    const source = find(root, '#tool-source');
    const status = find(root, '#left-status');
    const cell = (id: string) => find(panel, `#left-${id}`);
    const kicker = find(root, '#left-kicker');
    const zoom = find<HTMLInputElement>(root, '#left-zoom');
    const zoomLine = find(root, '#left-zoom-line');
    const site = siteAddress(siteUrl);
    const heights = heightFeed();
    const owner = {};
    let tip = heights.tip;
    let held: number | null = null;
    const wall = attach(
        find(root, '[data-machine="wall"]'),
        'wall',
        { issued: supplyAt(tip.height).issued / MAX_SUPPLY, zoom: null },
        { page: true },
    );
    const showWall = () => wall.set({ issued: supplyAt(tip.height).issued / MAX_SUPPLY, zoom: held });
    zoom.addEventListener('input', () => {
        held = Number(zoom.value) / ZOOM_STEPS;
        zoom.style.setProperty('--at', String(held));
        zoomLine.textContent = held === 0 ? LEFT_PAGE.zoomAll : LEFT_PAGE.zoomCoins;
        showWall();
    });
    let ticker = 0;
    const share = bindShareBar(root, {
        postcard: () =>
            leftPostcard({
                supply: supplyAt(tip.height),
                api: tip.source === 'live' ? tip.api : null,
                checkedAt: tip.checkedAt,
            }),
        site,
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    function lastBlock(now = Date.now()): string {
        const age = tipAge(tip, now);
        if (age === null) return LEFT_PAGE.unknownTime;
        return tip.source === 'live' ? LEFT_PAGE.ago(age) : LEFT_PAGE.estimatedTime(age);
    }

    function renderSource(): void {
        const parts: (string | Node)[] = [LEFT_PAGE.heightLabel];
        if (tip.source === 'live' && tip.api) {
            parts.push(link(tip.api, `https://${tip.api}/`), LEFT_PAGE.heightLive(formatUtcStamp(tip.checkedAt)));
        } else if (tip.source === 'offline') {
            parts.push(
                LEFT_PAGE.heightOffline(formatWhole(HEIGHT_ANCHOR.height), formatUtcStamp(HEIGHT_ANCHOR.time * 1000)),
            );
        } else {
            parts.push(link(LEFT_PAGE.heightFallback, MEMPOOL), '. ');
        }
        parts.push(LEFT_PAGE.supplyLabel, LEFT_PAGE.supplySource);
        source.replaceChildren(...parts);
    }

    function render(): void {
        const supply = supplyAt(tip.height);
        cell('left').textContent = formatBtc(supply.left);
        cell('issued').textContent = formatBtc(supply.issued);
        cell('share').textContent = formatPpm(supply.issuedPpm);
        cell('reward').textContent = formatBtcExact(supply.subsidy);
        cell('height').textContent = formatWhole(supply.height);
        cell('last').textContent = lastBlock();
        cell('halving').textContent = LEFT_PAGE.halvingAt(
            formatWhole(supply.nextHalving),
            formatWhole(supply.blocksToHalving),
        );
        cell('next-reward').textContent = formatBtcExact(supply.nextSubsidy);
        cell('halving-date').textContent = LEFT_PAGE.halvingDay(
            formatDay(estimatedHalvingTime(supply.blocksToHalving, Date.now())),
        );
        cell('max').textContent = formatBtcExact(MAX_SUPPLY);
        panel.dataset.source = tip.source;
        renderSource();

        const height = formatWhole(supply.height);
        kicker.textContent = tip.source === 'live' ? LEFT_PAGE.kicker(height) : LEFT_PAGE.kickerEstimate(height);
        showWall();
        share.setEnabled(true);
    }

    function setTicking(on: boolean): void {
        window.clearInterval(ticker);
        ticker = on
            ? window.setInterval(() => {
                  cell('last').textContent = lastBlock();
              }, 1000)
            : 0;
    }

    render();
    const unsubscribe = heights.subscribe((next: Tip) => {
        tip = next;
        render();
    });
    let disposed = false;
    let unwatch = () => {};
    afterFirstPaint(() => {
        if (disposed) return;
        unwatch = watchActive(panel, (active) => {
            heights.setActive(owner, active);
            setTicking(active);
        });
    });

    return () => {
        wall.detach();
        disposed = true;
        unwatch();
        unsubscribe();
        setTicking(false);
        share.dispose();
    };
}
