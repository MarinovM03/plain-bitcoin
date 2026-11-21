import { heightFeed } from '../../data/height.ts';
import { fetchLine, fetchRecentTxid, fetchTx, minedFills, NotFound } from '../../data/mempool.ts';
import { attach } from '../../hero/bus.ts';
import { blocksAway, confirmations, feeRate, isTxid, type TxFacts, type WaitingLine } from '../../model/tx.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { txPostcard } from '../../postcard/words.ts';
import { TX } from '../../ui/copy.ts';
import { rollText } from '../../ui/roll.ts';
import { find } from '../../util/dom.ts';
import { formatUtcClock, formatWhole } from '../../util/format.ts';

const REFRESH_MS = 30_000;
const EMPTY_LINE = {
    floors: [],
    fills: [],
    counts: [],
    rate: null,
    slab: null,
    confirmed: false,
    confirmedDepth: null,
} as const;

const fetcher = (url: string, init?: RequestInit) => window.fetch(url, init);

function rateText(rate: number): string {
    return rate.toLocaleString('en-GB', { maximumFractionDigits: rate < 10 ? 1 : 0 });
}

export function mountTx(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const form = find<HTMLFormElement>(root, '#tx-form');
    const input = find<HTMLInputElement>(root, '#tx-id');
    const pick = find<HTMLButtonElement>(root, '#tx-pick');
    const rate = find(root, '#tx-rate');
    const unit = find(root, '#tx-unit');
    const sentence = find(root, '#tx-sentence');
    const detail = find(root, '#tx-detail');
    const hash = find(root, '#tx-hash');
    const list = find(root, '#tx-line');
    const source = find(root, '#tool-source');
    const status = find(root, '#tx-status');

    let line: WaitingLine | null = null;
    let lineAt = 0;
    let tx: TxFacts | null = null;
    let txAt = 0;
    let asking = 0;
    let disposed = false;

    const view = attach(
        find(root, '[data-machine="queue"]'),
        'queue',
        { ...EMPTY_LINE, mined: minedFills(heights.tip), height: heights.tip.height },
        { page: true },
    );

    const slab = () => (tx && line ? blocksAway(feeRate(tx), line.floors) : null);

    function place(): string {
        const at = slab();
        if (at === 1) return TX.next;
        return at === null ? TX.behind : TX.away(String(at));
    }

    const share = bindShareBar(root, {
        postcard: () =>
            tx
                ? txPostcard({
                      txid: tx.txid,
                      rate: feeRate(tx),
                      place: place(),
                      confirmedIn: tx.blockHeight,
                      confirmations: confirmations(heights.tip.height, tx.blockHeight),
                      readAt: txAt,
                      floors: line?.floors ?? [],
                      slab: slab(),
                  })
                : null,
        site: siteAddress(siteUrl),
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    function push(): void {
        view.set({
            floors: line?.floors ?? [],
            fills: line?.fills ?? [],
            counts: line?.counts ?? [],
            rate: tx ? feeRate(tx) : null,
            slab: slab(),
            confirmed: tx?.confirmed === true,
            confirmedDepth: tx?.blockHeight == null ? null : heights.tip.height - tx.blockHeight,
            mined: minedFills(heights.tip),
            height: heights.tip.height,
        });
    }

    function renderLine(): void {
        if (!line) return;
        const items = line.floors.map((floor, index) => {
            const item = document.createElement('li');
            item.textContent = TX.lineLabel(String(index + 1), rateText(floor), formatWhole(line?.counts[index] ?? 0));
            if (slab() === index + 1 && tx && !tx.confirmed) item.className = 'line-list__mine';
            return item;
        });
        list.replaceChildren(...items);
        source.textContent = TX.source(formatUtcClock(lineAt));
    }

    function renderTx(): void {
        if (!tx) return;
        unit.hidden = false;
        rollText(rate, rateText(feeRate(tx)));
        if (tx.confirmed && tx.blockHeight !== null) {
            const count = confirmations(heights.tip.height, tx.blockHeight);
            sentence.textContent =
                count <= 1
                    ? TX.confirmedOne(formatWhole(tx.blockHeight))
                    : TX.confirmed(formatWhole(tx.blockHeight), formatWhole(count));
        } else {
            sentence.textContent = place();
        }
        detail.textContent = TX.detail(formatWhole(tx.fee), formatWhole(Math.round(tx.vsize)));
        hash.textContent = tx.txid;
        hash.hidden = false;
        share.setEnabled(true);
        share.refresh();
    }

    function say(message: string): void {
        sentence.textContent = message;
    }

    async function refreshLine(): Promise<void> {
        try {
            const next = await fetchLine(fetcher);
            if (disposed) return;
            line = next;
            lineAt = Date.now();
            renderLine();
            renderTx();
            push();
        } catch {
            if (!line && !disposed)
                list.replaceChildren(Object.assign(document.createElement('li'), { textContent: TX.failed }));
        }
    }

    async function follow(txid: string, quiet = false): Promise<void> {
        const ask = ++asking;
        if (!quiet) say(TX.looking);
        try {
            const next = await fetchTx(fetcher, txid);
            if (disposed || ask !== asking) return;
            tx = next;
            txAt = Date.now();
            renderTx();
            renderLine();
            push();
        } catch (error) {
            if (disposed || ask !== asking) return;
            say(error instanceof NotFound ? TX.notFound : TX.failed);
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!isTxid(text)) {
            say(TX.invalid);
            return;
        }
        void follow(text.toLowerCase());
    });

    pick.addEventListener('click', async () => {
        say(TX.looking);
        try {
            const txid = await fetchRecentTxid(fetcher);
            if (disposed) return;
            input.value = txid;
            await follow(txid);
        } catch {
            if (!disposed) say(TX.failed);
        }
    });

    const timer = window.setInterval(() => {
        if (document.hidden) return;
        void refreshLine();
        if (tx && !tx.confirmed) void follow(tx.txid, true);
    }, REFRESH_MS);
    const stopTip = heights.subscribe(() => {
        renderTx();
        push();
    });
    void refreshLine();

    return () => {
        disposed = true;
        window.clearInterval(timer);
        stopTip();
        share.dispose();
        view.detach();
    };
}
