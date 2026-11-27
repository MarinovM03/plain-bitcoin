import { heightFeed } from '../../data/height.ts';
import { fetchFees } from '../../data/mempool.ts';
import { priceFeed } from '../../data/price.ts';
import { mountPicture } from '../../gauges/mount.ts';
import { type FeeRates, feeCosts, PAYMENT_TYPES, type PaymentType, paymentSize, SPEEDS } from '../../model/fees.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { type FeesText, feesText } from '../../postcard/words.ts';
import { FEES, PICTURE, TOOL_PAGE } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { parseAmount } from '../../util/amount-input.ts';
import { find } from '../../util/dom.ts';
import { formatUtcClock } from '../../util/format.ts';

const REFRESH_MS = 30_000;

const fetcher = (url: string, init?: RequestInit) => window.fetch(url, init);

export function mountFees(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const prices = priceFeed();
    const form = find<HTMLFormElement>(root, '.tool__inputs');
    const inputsField = find<HTMLInputElement>(root, '#fees-inputs');
    const outputsField = find<HTMLInputElement>(root, '#fees-outputs');
    const label = find(root, '#tool-result-label');
    const sentence = find(root, '#tool-result');
    const figure = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const panel = find(root, '#fees-detail');
    const picture = mountPicture(root);

    let rates: FeeRates | null = null;
    let readAt = 0;
    let text: FeesText | null = null;
    let disposed = false;

    const share = bindShareBar(root, {
        postcard: () => text?.postcard ?? null,
        site: siteAddress(siteUrl),
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    const type = (): PaymentType => {
        const value = form.querySelector<HTMLInputElement>('input[name="fees-type"]:checked')?.value;
        return PAYMENT_TYPES.find((option) => option === value) ?? 'segwit';
    };

    function say(message: string): void {
        text = null;
        const empty = document.createElement('span');
        empty.className = 'result__empty';
        empty.textContent = message;
        sentence.replaceChildren(empty);
        figure.textContent = EMPTY_FIGURE;
        detail.textContent = '';
        panel.hidden = true;
        share.setEnabled(false);
    }

    function render(): void {
        if (!rates) return;
        const vbytes = paymentSize(type(), parseAmount(inputsField.value) ?? 1, parseAmount(outputsField.value) ?? 2);
        const quote = prices.quote;
        const costs = feeCosts(rates, vbytes, quote.value.usd);
        const next = feesText({ type: type(), vbytes, costs, height: heights.tip.height, readAt });
        if (!next) return;
        text = next;
        label.textContent = `${TOOL_PAGE.resultLabel} · ${formatUtcClock(readAt)}`;
        figure.textContent = next.figure;
        sentence.textContent = next.headline;
        detail.textContent = next.detail;
        for (const [i, speed] of SPEEDS.entries()) {
            const cell = root.querySelector(`#fees-${speed}`);
            if (cell) cell.textContent = next.rows[i]?.line ?? '';
        }
        const flat = next.rows.every((row) => row.sats === next.rows[0]?.sats);
        picture.set({ id: 'fees', rows: next.rows }, flat ? PICTURE.feesFlat : PICTURE.fees);
        source.textContent = FEES.source(formatUtcClock(readAt), quote.source);
        panel.hidden = false;
        share.setEnabled(true);
        share.refresh();
        status.textContent = next.headline;
    }

    async function refresh(): Promise<void> {
        try {
            const next = await fetchFees(fetcher);
            if (disposed) return;
            rates = next;
            readAt = Date.now();
            render();
        } catch {
            if (!disposed && !rates) say(FEES.failed);
        }
    }

    form.addEventListener('input', render);
    form.addEventListener('change', render);
    const more = find<HTMLFormElement>(root, '.tool__more');
    more.addEventListener('input', render);
    more.addEventListener('change', render);
    const timer = window.setInterval(() => {
        if (!document.hidden) void refresh();
    }, REFRESH_MS);
    const stopTip = heights.subscribe((_tip, change) => {
        if (change.blocks > 0) void refresh();
    });
    const stopPrices = prices.subscribe(render);
    say(FEES.loading);
    void refresh();

    return () => {
        disposed = true;
        window.clearInterval(timer);
        stopTip();
        stopPrices();
        share.dispose();
        picture.dispose();
    };
}
