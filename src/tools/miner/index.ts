import { fetchHeader, type HeaderReading, SAVED_HEADER, savedHeader } from '../../data/header.ts';
import { heightFeed, type Tip } from '../../data/height.ts';
import { attach } from '../../hero/bus.ts';
import { checkHeader, difficultyFromBits, targetZeroBits } from '../../model/header.ts';
import { formatBigCount, formatHashrate, networkHashrate, soloYears } from '../../model/mining.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { minerPostcard } from '../../postcard/words.ts';
import { MINER } from '../../ui/copy.ts';
import type { HeaderField } from '../../ui/miner-view.ts';
import { rollText } from '../../ui/roll.ts';
import { find } from '../../util/dom.ts';
import { formatShortDay, formatUtcClock, formatUtcStamp, formatWhole, isoDayMs } from '../../util/format.ts';
import type { HashBatch, WorkerOrder } from './protocol.ts';

/** How long to wait for the live tip before hashing the saved block instead. */
const LIVE_WAIT_MS = 6_000;
/** Below this many zero bits a new best hash is too common to buzz the phone for. */
const BUZZ_FROM = 16;

function hashMarkup(target: HTMLElement, hash: string): void {
    const zeros = /^0*/.exec(hash)?.[0].length ?? 0;
    const lead = document.createElement('span');
    lead.className = 'hash-text__zeros';
    lead.textContent = hash.slice(0, zeros);
    target.replaceChildren(lead, document.createTextNode(hash.slice(zeros)));
    target.hidden = false;
}

function headerFields(reading: HeaderReading): Record<HeaderField, string> {
    const { header } = reading;
    return {
        version: `0x${header.version.toString(16)}`,
        previous: header.previous,
        merkle: header.merkleRoot,
        time: formatUtcStamp(header.time * 1000),
        bits: `0x${header.bits.toString(16)}`,
        nonce: formatWhole(header.nonce),
    };
}

export function mountMiner(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const stage = find(root, '[data-machine="miner"]');
    const kicker = find(root, '#miner-kicker-text');
    const best = find(root, '#miner-best');
    const bestUnit = find(root, '#miner-best-unit');
    const needs = find(root, '#miner-needs');
    const run = find<HTMLButtonElement>(root, '#miner-run');
    const check = find<HTMLButtonElement>(root, '#miner-check');
    const bestHash = find(root, '#miner-hash');
    const source = find(root, '#tool-source');
    const status = find(root, '#miner-status');
    const stat = (id: string) => find(root, `#miner-${id}`);

    let reading: HeaderReading | null = null;
    let needed = 0;
    let worker: Worker | null = null;
    let running = false;
    let tries = 0;
    let bestZeros = -1;
    let nextNonce = 0;
    let rate = 0;
    let realZeros: number | null = null;
    let dive = false;
    let disposed = false;
    let fallback = 0;

    const view = attach(stage, 'miner', { needed: 79, best: -1, real: null, tally: null, dive: false }, { page: true });
    const push = (tally: readonly number[] | null) =>
        view.set({ needed: needed || 79, best: bestZeros, real: realZeros, tally, dive });

    const share = bindShareBar(root, {
        postcard: () =>
            reading && bestZeros >= 0
                ? minerPostcard({
                      height: reading.height,
                      tries,
                      best: bestZeros,
                      needed,
                      readAt: reading.readAt,
                      savedOn: formatShortDay(isoDayMs(SAVED_HEADER.asOf)),
                  })
                : null,
        site: siteAddress(siteUrl),
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    function showStats(): void {
        stat('count').textContent = formatWhole(tries);
        stat('rate').textContent = rate > 0 ? formatHashrate(rate) : '—';
        if (!reading) return;
        const difficulty = difficultyFromBits(reading.header.bits);
        const network = networkHashrate(difficulty);
        stat('network').textContent = network ? formatHashrate(network) : '—';
        const years = rate > 0 ? soloYears(difficulty, rate) : null;
        stat('odds').textContent = years ? MINER.years(formatBigCount(years)) : '—';
    }

    function use(next: HeaderReading): void {
        if (running) return;
        reading = next;
        needed = targetZeroBits(next.header.bits);
        nextNonce = 0;
        realZeros = null;
        const height = formatWhole(next.height);
        kicker.textContent = next.readAt === null ? MINER.kickerSaved(height) : MINER.kicker(height);
        needs.textContent = MINER.needs(String(needed));
        source.textContent =
            next.readAt === null
                ? `${MINER.offline(formatShortDay(isoDayMs(SAVED_HEADER.asOf)))} ${MINER.sourceSaved(formatShortDay(isoDayMs(SAVED_HEADER.asOf)))}`
                : MINER.source(SAVED_HEADER.source, formatUtcClock(next.readAt));
        const fields = headerFields(next);
        for (const [id, value] of Object.entries(fields)) {
            const target = root.querySelector<HTMLElement>(`#header-${id}`);
            if (target) target.textContent = value;
        }
        for (const id of ['real-label', 'real-hash'])
            root.querySelector<HTMLElement>(`#${id}`)?.setAttribute('hidden', '');
        find(root, '#real-verdict').textContent = '';
        run.disabled = false;
        showStats();
        push(null);
    }

    function onTip(tip: Tip): void {
        const newest = tip.blocks[0];
        if (tip.source !== 'live' || !newest?.hash || newest.hash === reading?.hash || running) return;
        fetchHeader((url, init) => window.fetch(url, init), newest.hash, newest.height, Date.now())
            .then((next) => {
                if (!disposed) {
                    window.clearTimeout(fallback);
                    use(next);
                }
            })
            .catch(() => {
                if (!disposed && !reading) use(savedHeader());
            });
    }

    function onBatch(batch: HashBatch): void {
        tries += batch.count;
        nextNonce = batch.nextNonce;
        const now = (batch.count / Math.max(0.5, batch.ms)) * 1000;
        rate = rate === 0 ? now : rate * 0.85 + now * 0.15;
        if (batch.best && batch.best.zeros > bestZeros) {
            if (batch.best.zeros >= BUZZ_FROM && bestZeros >= 0) navigator.vibrate?.(14);
            bestZeros = batch.best.zeros;
            bestUnit.hidden = false;
            rollText(best, String(bestZeros));
            hashMarkup(bestHash, batch.best.hash);
            share.refresh();
        }
        push(Array.from(batch.histogram));
        showStats();
    }

    function stop(): void {
        running = false;
        worker?.postMessage({ type: 'stop' } satisfies WorkerOrder);
        run.textContent = MINER.start;
        run.setAttribute('aria-pressed', 'false');
    }

    function start(): void {
        if (!reading) return;
        worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<HashBatch>) => {
            if (running) onBatch(event.data);
        };
        running = true;
        worker.postMessage({ type: 'start', header: reading.header.bytes, nonce: nextNonce } satisfies WorkerOrder);
        run.textContent = MINER.stop;
        run.setAttribute('aria-pressed', 'true');
    }

    run.addEventListener('click', () => (running ? stop() : start()));

    check.addEventListener('click', () => {
        if (!reading) return;
        const result = checkHeader(reading.header);
        realZeros = result.zeros;
        const label = find(root, '#real-label');
        label.textContent = MINER.realHash(formatWhole(reading.height));
        label.hidden = false;
        hashMarkup(find(root, '#real-hash'), result.hash);
        find(root, '#real-verdict').textContent = result.meetsTarget
            ? MINER.realOk(String(result.zeros), String(needed))
            : MINER.realBad;
        push(null);
    });

    const hidden = () => {
        if (document.hidden && running) stop();
    };
    document.addEventListener('visibilitychange', hidden);

    const steps = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const id = (entry.target as HTMLElement).dataset.step;
                if (id !== 'target' && id !== 'network') continue;
                if (entry.isIntersecting) dive = true;
                else if (id === 'target' && entry.boundingClientRect.top > 0) dive = false;
                push(null);
            }
        },
        { rootMargin: '-35% 0px -35% 0px' },
    );
    for (const item of root.querySelectorAll('.step')) steps.observe(item);

    const stopTip = heights.subscribe(onTip);
    onTip(heights.tip);
    fallback = window.setTimeout(() => {
        if (!reading && !disposed) use(savedHeader());
    }, LIVE_WAIT_MS);
    share.setEnabled(true);

    return () => {
        disposed = true;
        window.clearTimeout(fallback);
        stop();
        worker?.terminate();
        worker = null;
        steps.disconnect();
        stopTip();
        document.removeEventListener('visibilitychange', hidden);
        share.dispose();
        view.detach();
    };
}
