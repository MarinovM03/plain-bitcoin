import { PAST_HALVINGS } from '../../data/halvings.ts';
import { heightFeed } from '../../data/height.ts';
import { attach } from '../../hero/bus.ts';
import { halvingClock, recentBlockSeconds } from '../../model/halving.ts';
import { HALVING_INTERVAL, subsidy } from '../../model/supply.ts';
import { bindShareBar } from '../../postcard/bar.ts';
import { siteAddress } from '../../postcard/site.ts';
import { halvingPostcard } from '../../postcard/words.ts';
import { HALVING } from '../../ui/copy.ts';
import { halvingLines, SCRUB_ERAS, SCRUB_STEP, scrubLine } from '../../ui/halving-view.ts';
import { rollText } from '../../ui/roll.ts';
import { find } from '../../util/dom.ts';
import { formatBtcExact, formatUtcClock, formatWhole, isoDayMs } from '../../util/format.ts';

function cell(text: string): HTMLTableCellElement {
    const element = document.createElement('td');
    element.textContent = text;
    return element;
}

export function mountHalving(root: HTMLElement, siteUrl: string): () => void {
    const heights = heightFeed();
    const kicker = find(root, '#halving-kicker');
    const blocks = find(root, '#halving-blocks');
    const sentence = find(root, '#halving-sentence');
    const when = find(root, '#halving-when');
    const scrub = find<HTMLInputElement>(root, '#halving-scrub');
    const line = find(root, '#halving-scrub-line');
    const now = find<HTMLButtonElement>(root, '#halving-now');
    const eras = find(root, '#halving-eras');
    const source = find(root, '#tool-source');
    const status = find(root, '#halving-status');
    let tip = heights.tip;
    let scrubbing = false;

    const view = attach(find(root, '[data-machine="halving"]'), 'halving', { height: tip.height }, { page: true });

    const pace = () => (tip.source === 'live' ? recentBlockSeconds(tip.blocks.map((block) => block.time)) : null);
    const clock = () => halvingClock(tip.height, Date.now(), pace());

    const share = bindShareBar(root, {
        postcard: () =>
            halvingPostcard({
                clock: clock(),
                height: tip.height,
                live: tip.source === 'live',
                checkedAt: tip.checkedAt,
            }),
        site: siteAddress(siteUrl),
        onStatus: (message) => {
            status.textContent = message;
        },
    });

    function endOf(era: number, current: ReturnType<typeof clock>): string {
        const past = PAST_HALVINGS[era];
        if (past) return HALVING.endsDone(String(new Date(isoDayMs(past)).getUTCFullYear()));
        const eraNow = Math.floor(tip.height / HALVING_INTERVAL);
        const ms = current.estimatedAt + (era - eraNow) * HALVING_INTERVAL * current.pace * 1000;
        return HALVING.endsAbout(String(new Date(ms).getUTCFullYear()));
    }

    function renderEras(): void {
        const current = clock();
        const eraNow = Math.floor(tip.height / HALVING_INTERVAL);
        const rows = Array.from({ length: SCRUB_ERAS }, (_, era) => {
            const row = document.createElement('tr');
            if (era === eraNow) row.className = 'era-table__now';
            const first = era * HALVING_INTERVAL;
            row.append(
                cell(era === eraNow ? `${era + 1} · ${HALVING.eraNow}` : String(era + 1)),
                cell(`${formatWhole(first)} – ${formatWhole(first + HALVING_INTERVAL - 1)}`),
                cell(formatBtcExact(subsidy(first))),
                cell(endOf(era, current)),
            );
            return row;
        });
        eras.replaceChildren(...rows);
    }

    function render(): void {
        const current = clock();
        const height = formatWhole(tip.height);
        kicker.textContent = tip.source === 'live' ? HALVING.kicker(height) : HALVING.kickerEstimate(height);
        rollText(blocks, formatWhole(current.blocks));
        const lines = halvingLines(current);
        sentence.textContent = lines.sentence;
        when.textContent = lines.when;
        source.textContent =
            tip.source === 'live' && tip.api
                ? HALVING.source(tip.api, formatUtcClock(tip.checkedAt))
                : HALVING.sourceEstimate;
        if (!scrubbing) {
            scrub.value = String(Math.round(tip.height / SCRUB_STEP));
            showScrub(tip.height);
            view.set({ height: tip.height });
        }
        renderEras();
        share.refresh();
    }

    function showScrub(height: number): void {
        scrub.style.setProperty('--at', String(Number(scrub.value) / Number(scrub.max)));
        line.textContent = scrubLine(height);
    }

    scrub.addEventListener('input', () => {
        scrubbing = true;
        now.hidden = false;
        const height = Number(scrub.value) * SCRUB_STEP;
        showScrub(height);
        view.set({ height });
    });
    now.addEventListener('click', () => {
        scrubbing = false;
        now.hidden = true;
        render();
        scrub.focus();
    });

    const stop = heights.subscribe((next) => {
        tip = next;
        render();
    });
    render();
    share.setEnabled(true);

    return () => {
        stop();
        share.dispose();
        view.detach();
    };
}
