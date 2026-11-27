import type { Tip } from '../data/height.ts';
import type { PriceQuote } from '../data/price.ts';
import { baseline, change, priceIn, visited, worth } from '../model/holding.ts';
import { bindShareBar } from '../postcard/bar.ts';
import { siteAddress } from '../postcard/site.ts';
import { todayPostcard } from '../postcard/words.ts';
import { formatBtcExact, formatMoney, formatSats } from '../util/format.ts';
import { readHolding, writeHolding } from '../util/store.ts';
import { HOME } from './copy.ts';

export interface HomeReadings {
    tip(): Tip;
    quote(): PriceQuote;
    /** What a usual payment costs for the next block, as the strip shows it; null until the rates load. */
    fee(): string | null;
    /** The kept stack in sats, or null when nothing is kept, so its tile can draw it. */
    held(sats: number | null): void;
}

export interface HomeExtras {
    update(): void;
    dispose(): void;
}

type SetNow = (key: 'stack', figure: string, unit: string) => void;
type SetFact = (id: 'stack', figure: string) => void;

const live = (quote: PriceQuote) => quote.source !== 'last close' && !quote.stale;

/**
 * The parts of home that wait for first paint: the visitor's own stack, read from this browser only, and today's
 * card, printed only from live readings.
 */
export function mountHomeExtras(
    root: HTMLElement,
    site: string,
    read: HomeReadings,
    setNow: SetNow,
    setFact: SetFact,
): HomeExtras {
    let holding = readHolding();
    const status = root.querySelector<HTMLElement>('#now-status');
    const bar = bindShareBar(root.querySelector('.now') ?? root, {
        postcard: () => {
            const tip = read.tip();
            const quote = read.quote();
            if (tip.source !== 'live' || !live(quote)) return null;
            return todayPostcard({ height: tip.height, usd: quote.value.usd, fee: read.fee(), readAt: Date.now() });
        },
        site: siteAddress(site),
        onStatus: (message) => {
            if (status) status.textContent = message;
        },
    });

    function showStack(): void {
        if (!holding) {
            setNow('stack', HOME.stack.unset, HOME.now.stack.unit);
            setFact('stack', HOME.stack.unset);
            return;
        }
        const quote = read.quote();
        if (live(quote)) {
            const next = visited(holding, { at: Date.now(), usd: quote.value.usd, gbp: quote.value.gbp });
            if (next !== holding && writeHolding(next)) holding = next;
        }
        const { sats, fiat } = holding;
        const price = priceIn(quote.value, fiat);
        const amount = sats >= 1e6 ? formatBtcExact(sats) : formatSats(sats);
        const from = baseline(holding);
        const move = change(sats, priceIn(from.mark, fiat), price).money;
        setFact('stack', formatMoney(worth(sats, price), fiat));
        setNow(
            'stack',
            formatMoney(worth(sats, price), fiat),
            from.since === 'visit' && Math.abs(move) >= 0.005
                ? HOME.stack.moved(amount, move > 0, formatMoney(Math.abs(move), fiat))
                : HOME.stack.kept(amount),
        );
    }

    bar.setEnabled(true);
    showStack();
    read.held(holding?.sats ?? null);
    return {
        update() {
            showStack();
            bar.refresh();
        },
        dispose: bar.dispose,
    };
}
