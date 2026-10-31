import { HEIGHT_ANCHOR, type Tip } from '../../data/height.ts';
import { drawFlatField } from '../../hero/flat.ts';
import { tokenState } from '../../hero/layout.ts';
import { estimatedHalvingTime, MAX_SUPPLY, supplyAt } from '../../model/supply.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { leftCard } from '../../share/cardText.ts';
import { type CardArt, type ShareCard, siteAddress } from '../../share/index.ts';
import { LEFT_PAGE } from '../../ui/copy.ts';
import { afterFirstPaint, find, link, whenIdle } from '../../util/dom.ts';
import { formatBtc, formatBtcExact, formatDay, formatPpm, formatUtcStamp, formatWhole } from '../../util/format.ts';
import { heightFeed, tipAge, watchActive } from './counter.ts';

const MEMPOOL = 'https://mempool.space/';

export function mountLeft(root: HTMLElement, siteUrl: string): () => void {
    const panel = find(root, '#numbers-panel');
    const source = find(root, '#tool-source');
    const status = find(root, '#left-status');
    const cell = (id: string) => find(panel, `#left-${id}`);
    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    const heights = heightFeed();
    const owner = {};
    let tip = heights.tip;
    let card: ShareCard | null = null;
    let art: CardArt | undefined;
    let ticker = 0;
    const share = bindShareBar(root, {
        files,
        card: () => card,
        art: () => art,
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

        const live = tip.source === 'live' && tip.api !== null;
        card = live && tip.api ? leftCard(supply, tip.api, tip.checkedAt, site) : null;
        const tokens = tokenState(supply.issued);
        art = (context, box) => drawFlatField(context, box, tokens);
        share.setEnabled(card !== null);
        if (!live && tip.source === 'offline') status.textContent = LEFT_PAGE.shareOffline;
    }

    function setTicking(on: boolean): void {
        window.clearInterval(ticker);
        ticker = on
            ? window.setInterval(() => {
                  cell('last').textContent = lastBlock();
              }, 1000)
            : 0;
    }

    let barVisible = false;
    const prepareCard = () => {
        if (!barVisible) return;
        whenIdle(() => {
            if (card) files.get(card, art).catch(() => {});
        });
    };
    const barWatch = new IntersectionObserver((entries) => {
        barVisible = entries.some((entry) => entry.isIntersecting);
        prepareCard();
    });
    barWatch.observe(find(root, '.share-bar'));

    render();
    const unsubscribe = heights.subscribe((next: Tip) => {
        tip = next;
        render();
        prepareCard();
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
        disposed = true;
        barWatch.disconnect();
        unwatch();
        unsubscribe();
        setTicking(false);
        share.dispose();
    };
}
