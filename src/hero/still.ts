import { type Guide, INKS, type Layout } from './scenes/types.ts';

const UNIT = 1000;

function num(value: number): string {
    return String(Math.round(value * UNIT * 10) / 10);
}

function dotsMarkup(layout: Layout): string {
    const paths = new Map<string, string[]>();
    for (let i = 0; i < layout.count; i += 1) {
        const r = layout.r[i] ?? 0;
        if (r <= 0) continue;
        const key = `${INKS[layout.ink[i] ?? 0] ?? 'faint'} ${num(r * 2)}`;
        const d = `M${num(layout.x[i] ?? 0)} ${num(layout.y[i] ?? 0)}h0`;
        const list = paths.get(key);
        if (list) list.push(d);
        else paths.set(key, [d]);
    }
    return [...paths]
        .map(([key, parts]) => {
            const [ink, width] = key.split(' ');
            return `<path class="still__dot still__dot--${ink}" stroke-width="${width}" d="${parts.join('')}"/>`;
        })
        .join('');
}

function linesMarkup(layout: Layout): string {
    return layout.paths
        .map(
            (path) =>
                `<polyline class="${path.className}" vector-effect="non-scaling-stroke" points="${path.points
                    .map(([x, y]) => `${num(x)},${num(y)}`)
                    .join(' ')}"/>`,
        )
        .join('');
}

function rulesMarkup(guides: readonly Guide[]): string {
    return guides
        .map((guide) =>
            guide.kind === 'rule'
                ? `<line class="guide-rule guide-rule--${guide.tone ?? 'muted'}" vector-effect="non-scaling-stroke" x1="${num(guide.x1)}" y1="${num(guide.y1)}" x2="${num(guide.x2)}" y2="${num(guide.y2)}"/>`
                : '',
        )
        .join('');
}

function escapeAttribute(text: string): string {
    return text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** The still frame as SVG markup: the same dots the stage draws, plus any lines a chart needs. */
export function stillSvg(layout: Layout, aspect: number): string {
    const still = layout.still;
    const className = still ? `still ${still.className}` : 'still';
    const label = still?.alt ? ` role="img" aria-label="${escapeAttribute(still.alt)}"` : ' aria-hidden="true"';
    return `<svg class="${className}" viewBox="0 0 ${num(aspect)} ${UNIT}" preserveAspectRatio="xMidYMid meet"${label} focusable="false">${linesMarkup(layout)}${dotsMarkup(layout)}</svg>`;
}

function percent(value: number, of: number): string {
    return `${((value / of) * 100).toFixed(3)}%`;
}

type TipHandler = (band: HTMLElement, kind: 'enter' | 'leave' | 'pin') => void;

function guideLayer(layout: Layout, aspect: number, onTip: TipHandler): HTMLElement {
    const layer = document.createElement('div');
    layer.className = 'guides';
    const rules = rulesMarkup(layout.guides);
    if (rules)
        layer.insertAdjacentHTML(
            'beforeend',
            `<svg class="guides__rules" viewBox="0 0 ${num(aspect)} ${UNIT}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rules}</svg>`,
        );
    for (const guide of layout.guides) {
        if (guide.kind === 'label') {
            const label = document.createElement('span');
            label.className = `guide-label guide-label--${guide.align} guide-label--${guide.tone ?? 'muted'}`;
            label.textContent = guide.text;
            label.style.left = percent(guide.x, aspect);
            label.style.top = percent(guide.y, 1);
            layer.append(label);
        } else if (guide.kind === 'band') {
            const band = document.createElement('span');
            band.className = 'guide-band';
            band.dataset.tip = guide.tip;
            band.style.left = percent(guide.x, aspect);
            band.style.top = percent(guide.y, 1);
            band.style.width = percent(guide.w, aspect);
            band.style.height = percent(guide.h, 1);
            band.addEventListener('pointerenter', (event) => {
                if (event.pointerType === 'mouse') onTip(band, 'enter');
            });
            band.addEventListener('pointerleave', (event) => {
                if (event.pointerType === 'mouse') onTip(band, 'leave');
            });
            band.addEventListener('click', () => onTip(band, 'pin'));
            layer.append(band);
        }
    }
    return layer;
}

/** Paints the still frame, and for a scene window its scale cues, into an element. The next paint replaces it. */
export function paintStill(element: HTMLElement, layout: Layout, aspect: number, guides: boolean): void {
    const callout = guides ? (element.closest('.scene')?.querySelector<HTMLElement>('.scene__callout') ?? null) : null;
    let shown: HTMLElement | null = null;
    let pinned: HTMLElement | null = null;
    const show = (band: HTMLElement | null) => {
        shown?.classList.remove('is-active');
        shown = band;
        shown?.classList.add('is-active');
        if (!callout) return;
        callout.textContent = band?.dataset.tip ?? '';
        callout.hidden = band === null;
    };
    // A mouse peeks by hovering; a click or a tap pins the reading, and a second one on the same band lets it go.
    const onTip: TipHandler = (band, kind) => {
        if (kind === 'enter') show(band);
        else if (kind === 'leave') show(pinned);
        else {
            pinned = pinned === band ? null : band;
            show(pinned);
        }
    };
    show(null);
    element.innerHTML = stillSvg(layout, aspect);
    if (guides && layout.guides.length > 0) element.append(guideLayer(layout, aspect, onTip));
}
