import { find } from '../util/dom.ts';
import type { SceneData } from './types.ts';

export interface Picture {
    /** Shows this data, with the caption that says in words what the drawing shows. */
    set(data: SceneData | (() => SceneData), caption: string): void;
    dispose(): void;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A tool's picture: a flat drawing on the page's own opaque surface, made from the same numbers as the answer.
 * The answer is written in the input handler; the picture follows on the next frame, once per frame, newest wins.
 */
export function mountPicture(root: ParentNode): Picture {
    const plot = find(root, '#picture-plot');
    const caption = find(root, '#picture-caption');
    const frame = plot.closest<HTMLElement>('.picture');
    const callout = frame?.querySelector<HTMLElement>('.picture__callout') ?? null;
    let pending: SceneData | (() => SceneData) | null = null;
    let latest: SceneData | null = null;
    let drawn: { rev: number; width: number; height: number } | null = null;
    let rev = 0;
    let raf = 0;
    let disposed = false;

    async function paint(): Promise<void> {
        const data = latest;
        const mine = rev;
        if (!data) return;
        const [{ paintGauge, bindTips }, { loadLayout }] = await Promise.all([
            import('./paint.ts'),
            import('./index.ts'),
        ]);
        const layout = await loadLayout(data.id);
        if (disposed || mine !== rev || !plot.isConnected) return;
        const width = plot.clientWidth;
        const height = plot.clientHeight;
        if (width <= 0 || height <= 0) return;
        if (drawn && drawn.rev === mine && drawn.width === width && drawn.height === height) return;
        const gauge = layout(data, { width, height, mini: false });
        paintGauge(plot, gauge, reducedMotion());
        drawn = { rev: mine, width, height };
        if (!frame) return;
        if (callout) bindTips(plot, callout);
        frame.dataset.summary = gauge.summary;
        frame.dataset.settled = String(mine);
    }

    function flush(): void {
        raf = 0;
        if (!pending) return;
        latest = typeof pending === 'function' ? pending() : pending;
        pending = null;
        rev += 1;
        if (frame) {
            delete frame.dataset.pending;
            frame.dataset.picture = latest.id;
            frame.dataset.rev = String(rev);
        }
        void paint();
    }

    const resizes = new ResizeObserver(() => {
        if (latest && drawn && (plot.clientWidth !== drawn.width || plot.clientHeight !== drawn.height)) void paint();
    });
    resizes.observe(plot);

    return {
        set(data, text) {
            caption.textContent = text;
            pending = data;
            // Marks the picture as behind the answer until it is drawn, so nothing reads it as settled.
            if (frame) frame.dataset.pending = '';
            raf ||= requestAnimationFrame(flush);
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(raf);
            raf = 0;
            pending = null;
            resizes.disconnect();
        },
    };
}
