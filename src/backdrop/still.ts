import { type BackdropId, type Mark, SHAPE, type Tone } from './types.ts';

const LEVELS = 4;

function outline(mark: Mark, half: number, width: number, height: number): string {
    const cx = width / 2 + mark.x * half;
    const cy = height / 2 - mark.y * half;
    const rx = (mark.w * half) / 2;
    const ry = (mark.h * half) / 2;
    const n = (value: number) => value.toFixed(1);
    if (mark.shape === SHAPE.round || mark.shape === SHAPE.roundOpen) {
        return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(rx * 2)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-rx * 2)} 0z`;
    }
    return `M${n(cx - rx)} ${n(cy - ry)}h${n(rx * 2)}v${n(ry * 2)}h${n(-rx * 2)}z`;
}

/**
 * A tool's picture as a flat drawing, from the same marks the lit scene moves. It stands in wherever the scene
 * cannot run. Marks that share a colour and a strength share one path.
 */
export function planStill(
    id: BackdropId,
    marks: readonly Mark[],
    size: { width: number; height: number },
    colours: Readonly<Record<Tone, string>>,
): string {
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    const paths = new Map<string, string[]>();
    for (const mark of marks) {
        if (mark.shape === SHAPE.drip || !(mark.level > 0)) continue;
        const open = mark.shape === SHAPE.squareOpen || mark.shape === SHAPE.roundOpen;
        const level = Math.max(1, Math.round(Math.min(1, mark.level) * LEVELS));
        const key = `${mark.tone}|${open ? 1 : 0}|${level}`;
        const list = paths.get(key) ?? [];
        list.push(outline(mark, height / 2, width, height));
        paths.set(key, list);
    }
    const drawn = [...paths].map(([key, list]) => {
        const [tone = 'dim', open, level] = key.split('|');
        const colour = colours[tone as Tone];
        const opacity = ((Number(level) / LEVELS) * 0.7).toFixed(2);
        const paint =
            open === '1'
                ? `fill="none" stroke="${colour}" stroke-width="1" stroke-opacity="${opacity}"`
                : `fill="${colour}" fill-opacity="${opacity}"`;
        return `<path d="${list.join('')}" ${paint}/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" focusable="false" aria-hidden="true" data-backdrop="${id}">${drawn.join('')}</svg>`;
}
