import { INK_FILL } from './inks.ts';
import { INKS, type Layout } from './scenes/types.ts';

export type Art = (context: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void;

export function layoutArt(layout: Layout, aspect: number): Art {
    return (context, box) => {
        const scale = Math.min(box.w / aspect, box.h);
        const left = box.x + (box.w - aspect * scale) / 2;
        const top = box.y + (box.h - scale) / 2;
        context.save();
        for (let i = 0; i < layout.count; i += 1) {
            const r = (layout.r[i] ?? 0) * scale;
            if (r <= 0) continue;
            const [color, alpha] = INK_FILL[INKS[layout.ink[i] ?? 0] ?? 'faint'];
            context.globalAlpha = alpha;
            context.fillStyle = color;
            context.beginPath();
            context.arc(left + (layout.x[i] ?? 0) * scale, top + (layout.y[i] ?? 0) * scale, r, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    };
}
