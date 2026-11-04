import type { Attrs, Build, Gauge, Mark, Viewport } from './types.ts';

export function finite(value: number, fallback = 0): number {
    return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, finite(value, low)));
}

/** Two decimals, never NaN or Infinity: everything written into the SVG goes through here. */
export function px(value: number): number {
    return Math.round(finite(value) * 100) / 100;
}

export function rect(
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    className: string,
    extra: Attrs = {},
): Mark {
    return {
        key,
        tag: 'rect',
        attrs: {
            class: className,
            x: px(x),
            y: px(y),
            width: px(Math.max(0, w)),
            height: px(Math.max(0, h)),
            ...extra,
        },
    };
}

export function line(key: string, x1: number, y1: number, x2: number, y2: number, className: string): Mark {
    return { key, tag: 'line', attrs: { class: className, x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2) } };
}

export function label(
    key: string,
    x: number,
    y: number,
    value: string,
    className: string,
    anchor: 'start' | 'middle' | 'end' = 'start',
    extra: Attrs = {},
): Mark {
    return {
        key,
        tag: 'text',
        attrs: { class: className, x: px(x), y: px(y), 'text-anchor': anchor, ...extra },
        text: value,
    };
}

export function polyline(
    key: string,
    points: readonly (readonly [number, number])[],
    className: string,
    extra: Attrs = {},
): Mark {
    return {
        key,
        tag: 'polyline',
        attrs: { class: className, points: points.map(([x, y]) => `${px(x)},${px(y)}`).join(' '), ...extra },
    };
}

export function circle(key: string, cx: number, cy: number, r: number, className: string): Mark {
    return { key, tag: 'circle', attrs: { class: className, cx: px(cx), cy: px(cy), r: px(Math.max(0, r)) } };
}

/** A safe drawing size: a gauge never lays out into a zero, negative or absurd box. */
export function safeView(view: Viewport): Viewport {
    const width = Number.isFinite(view.width) && view.width > 0 ? Math.min(view.width, 4000) : 320;
    const height = Number.isFinite(view.height) && view.height > 0 ? Math.min(view.height, 4000) : 200;
    return { width, height, mini: view.mini };
}

export function gauge(view: Viewport, parts: Partial<Gauge> & Pick<Gauge, 'rebuild' | 'summary'>): Gauge {
    return {
        width: view.width,
        height: view.height,
        marks: [],
        build: 'none' as Build,
        origin: [0, 0],
        className: '',
        alt: '',
        ...parts,
    };
}

/** Label size in px: readable on a phone, a touch larger on a big plot. */
export function labelSize(view: Viewport): number {
    return view.width >= 560 && view.height >= 300 ? 12 : 11;
}
