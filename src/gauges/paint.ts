import type { Attrs, Build, Gauge, Mark } from './types.ts';

const SVG = 'http://www.w3.org/2000/svg';
const BUILD_MS = 900;

interface Painted {
    rebuild: string;
    svg: SVGSVGElement;
    body: SVGGElement;
    nodes: Map<string, SVGElement>;
    attrs: Map<string, Attrs>;
}

const painted = new WeakMap<HTMLElement, Painted>();

/** Grows or shrinks the sat grid by the direction its unit moved: a bigger unit zooms out, a smaller one in. */
export function buildFor(previous: string | null, next: Gauge): Build {
    if (previous === null || next.build === 'none') return 'none';
    if (next.build !== 'zoom-in') return next.build;
    const [kind, , from] = previous.split(':');
    const [nextKind, , to] = next.rebuild.split(':');
    if (kind !== nextKind) return 'none';
    return Number(to) > Number(from) ? 'zoom-out' : 'zoom-in';
}

/** Inline styles go through CSSOM: the page's CSP forbids style attributes, but not script-set style properties. */
function setStyle(node: SVGElement, value: string): void {
    node.style.cssText = value;
}

function setAttrs(node: SVGElement, next: Attrs, previous: Attrs | undefined): void {
    for (const [name, value] of Object.entries(next)) {
        if (previous?.[name] === value) continue;
        if (name === 'style') setStyle(node, String(value));
        else node.setAttribute(name, String(value));
    }
    if (!previous) return;
    for (const name of Object.keys(previous)) {
        if (name in next) continue;
        if (name === 'style') setStyle(node, '');
        else node.removeAttribute(name);
    }
}

function create(mark: Mark): SVGElement {
    const node = document.createElementNS(SVG, mark.tag);
    setAttrs(node, mark.attrs, undefined);
    if (mark.text !== undefined) node.textContent = mark.text;
    return node;
}

function frameSvg(svg: SVGSVGElement, frame: Gauge): void {
    svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
    svg.setAttribute('class', `gauge-svg ${frame.className}`.trim());
    svg.style.setProperty('--ox', `${frame.origin[0]}px`);
    svg.style.setProperty('--oy', `${frame.origin[1]}px`);
    if (frame.alt) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', frame.alt);
        svg.removeAttribute('aria-hidden');
    } else {
        svg.removeAttribute('role');
        svg.removeAttribute('aria-label');
        svg.setAttribute('aria-hidden', 'true');
    }
}

function rebuildAll(element: HTMLElement, frame: Gauge, build: Build): Painted {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('focusable', 'false');
    const body = document.createElementNS(SVG, 'g');
    body.setAttribute('class', 'gauge-body');
    svg.append(body);
    frameSvg(svg, frame);
    const nodes = new Map<string, SVGElement>();
    const attrs = new Map<string, Attrs>();
    for (const mark of frame.marks) {
        const node = create(mark);
        nodes.set(mark.key, node);
        attrs.set(mark.key, mark.attrs);
        body.append(node);
    }
    if (build !== 'none') {
        svg.classList.add('is-build', `is-build--${build}`);
        window.setTimeout(() => svg.classList.remove('is-build', `is-build--${build}`), BUILD_MS);
    }
    element.replaceChildren(svg);
    return { rebuild: frame.rebuild, svg, body, nodes, attrs };
}

/** Same structure: every mark keeps its element, so values glide on CSS transitions instead of being redrawn. */
function patch(state: Painted, frame: Gauge): void {
    frameSvg(state.svg, frame);
    const seen = new Set<string>();
    let cursor: ChildNode | null = state.body.firstChild;
    for (const mark of frame.marks) {
        seen.add(mark.key);
        let node = state.nodes.get(mark.key);
        if (node) {
            setAttrs(node, mark.attrs, state.attrs.get(mark.key));
            if (mark.text !== undefined && node.textContent !== mark.text) node.textContent = mark.text;
        } else {
            node = create(mark);
            state.nodes.set(mark.key, node);
        }
        state.attrs.set(mark.key, mark.attrs);
        if (node !== cursor) state.body.insertBefore(node, cursor);
        else cursor = cursor.nextSibling;
    }
    for (const [key, node] of state.nodes) {
        if (seen.has(key)) continue;
        node.remove();
        state.nodes.delete(key);
        state.attrs.delete(key);
    }
}

/**
 * Draws a readout into its element. The first paint shows the finished frame at once (arriving never animates);
 * a new structure plays its build; the same structure morphs in place. Reduced motion never builds.
 */
export function paintGauge(element: HTMLElement, frame: Gauge, reduced: boolean): void {
    const previous = painted.get(element);
    const fresh = !previous || previous.rebuild !== frame.rebuild || previous.svg.parentNode !== element;
    if (fresh) {
        const build = reduced || !previous ? 'none' : buildFor(previous.rebuild, frame);
        painted.set(element, rebuildAll(element, frame, build));
        return;
    }
    patch(previous, frame);
}

type TipKind = 'enter' | 'leave' | 'pin';

/** A mouse peeks at a band by hovering; a click or tap pins its reading, and a second one lets it go. */
export function bindTips(element: HTMLElement, callout: HTMLElement): void {
    if (element.dataset.tips !== undefined) return;
    element.dataset.tips = '';
    let shown: Element | null = null;
    let pinned: Element | null = null;
    const show = (band: Element | null) => {
        shown?.classList.remove('is-active');
        shown = band;
        shown?.classList.add('is-active');
        callout.textContent = band?.getAttribute('data-tip') ?? '';
        callout.hidden = band === null;
    };
    const handle = (event: Event, kind: TipKind) => {
        const band = (event.target as Element | null)?.closest?.('[data-tip]') ?? null;
        if (kind === 'pin') {
            if (!band) return;
            pinned =
                pinned === band || pinned?.getAttribute('data-tip') === band.getAttribute('data-tip') ? null : band;
            show(pinned);
            return;
        }
        if ((event as PointerEvent).pointerType !== 'mouse') return;
        show(kind === 'enter' && band ? band : pinned);
    };
    element.addEventListener('pointerover', (event) => handle(event, 'enter'));
    element.addEventListener('pointerout', (event) => handle(event, 'leave'));
    element.addEventListener('click', (event) => handle(event, 'pin'));
    show(null);
}
