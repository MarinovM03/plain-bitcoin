import type { StageBus, StageChange, StageSnapshot } from './bus.ts';
import type { EngineMessage, EngineReply, PointerKind, Rect, SceneReport, StageTier, View } from './engine.ts';
import { type ClientRect, pointerToScene } from './pointer.ts';
import { detectTier, isForced } from './tier.ts';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PLATE = '[data-plate]';
const WINDOW = '[data-scene-window]';

type Send = (message: EngineMessage, transfer?: Transferable[]) => void;

interface Driver {
    send: Send;
    stop(): void;
}

function newCanvas(root: HTMLElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'stage__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.append(canvas);
    return canvas;
}

// The worker keeps context creation, shader compiles and every frame off the main thread.
function workerDriver(onReply: (reply: EngineReply) => void): Driver | null {
    if (typeof Worker !== 'function' || !('transferControlToOffscreen' in HTMLCanvasElement.prototype)) return null;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<EngineReply>) => onReply(event.data));
    worker.addEventListener('error', () => onReply({ type: 'failed', software: false }));
    return {
        send: (message, transfer = []) => worker.postMessage(message, transfer),
        stop: () => worker.terminate(),
    };
}

async function directDriver(onReply: (reply: EngineReply) => void): Promise<Driver> {
    const { createEngine } = await import('./engine.ts');
    const handle = createEngine(onReply);
    return { send: (message) => handle(message), stop: () => {} };
}

function clientRect(element: Element): ClientRect {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/** Every mounted plate, in viewport CSS px: the weather paints the plate colour under each, never weather. */
export function measurePlates(root: ParentNode = document): Rect[] {
    const rects: Rect[] = [];
    for (const element of root.querySelectorAll<HTMLElement>(PLATE)) {
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) continue;
        rects.push([box.left, box.top, box.width, box.height]);
    }
    return rects;
}

function sameLayout(a: string, b: string): boolean {
    return a === b;
}

function layoutKey(canvas: ClientRect, plates: readonly Rect[], window: ClientRect | null): string {
    const round = (value: number) => Math.round(value * 2) / 2;
    const rect = (r: ClientRect | null) => (r ? [r.left, r.top, r.width, r.height].map(round).join(',') : '-');
    return `${rect(canvas)}|${plates.map((p) => p.map(round).join(',')).join(';')}|${rect(window)}`;
}

/** Writes what the scene shows into the DOM beside it: the callout, engraved tags and the keyboard part list. */
function applyReport(
    report: SceneReport,
    host: HTMLElement | null,
    onPart: (part: string | null, tap?: boolean) => void,
): void {
    if (!host) return;
    const scene = host.closest<HTMLElement>('.scene');
    const target = scene ?? host;
    const matches = report.id !== null && report.id === target.dataset.scene;
    target.toggleAttribute('data-gl', matches && report.rev >= 0);
    if (!matches) return;
    target.dataset.glRev = String(report.rev);
    if (report.settled >= 0) target.dataset.glSettled = String(report.settled);
    else delete target.dataset.glSettled;
    target.dataset.glSummary = report.summary;
    target.toggleAttribute('data-turned', report.turned);
    if (report.hovered) host.dataset.hoveredPart = report.hovered;
    else delete host.dataset.hoveredPart;
    if (report.active) host.dataset.activePart = report.active;
    else delete host.dataset.activePart;

    const about = target.querySelector<HTMLElement>('.scene__about');
    if (about && about.textContent !== report.about) about.textContent = report.about;

    const callout = target.querySelector<HTMLElement>('.scene__callout');
    if (callout) {
        callout.textContent = report.callout;
        callout.hidden = report.callout === '';
    }

    const tags = target.querySelector<HTMLElement>('.scene__tags');
    if (tags) {
        const existing = new Map([...tags.children].map((child) => [(child as HTMLElement).dataset.tag, child]));
        const seen = new Set<string>();
        for (const tag of report.tags) {
            seen.add(tag.id);
            let element = existing.get(tag.id) as HTMLElement | undefined;
            if (!element) {
                element = document.createElement('span');
                element.className = 'scene__tag';
                element.dataset.tag = tag.id;
                tags.append(element);
            }
            if (element.textContent !== tag.text) element.textContent = tag.text;
            element.dataset.tone = tag.tone;
            element.dataset.align = tag.align;
            element.style.transform = `translate(${tag.x}px, ${tag.y}px)`;
        }
        for (const [id, element] of existing) if (id && !seen.has(id)) element.remove();
    }

    const list = target.querySelector<HTMLElement>('.scene__parts');
    if (list) {
        const key = report.parts.map((part) => `${part.id}:${part.label}`).join('|');
        if (list.dataset.key !== key) {
            list.dataset.key = key;
            list.replaceChildren(
                ...report.parts.map((part) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'scene__part';
                    button.dataset.part = part.id;
                    button.textContent = part.label;
                    button.addEventListener('focus', () => onPart(part.id));
                    button.addEventListener('click', () => onPart(part.id, true));
                    button.addEventListener('blur', () => onPart(null));
                    return button;
                }),
            );
        }
        for (const button of list.querySelectorAll<HTMLElement>('.scene__part'))
            button.toggleAttribute('aria-pressed', button.dataset.part === report.active);
    }
}

export function runStage(root: HTMLElement, bus: StageBus): void {
    const syncPulses = (snapshot: StageSnapshot) => {
        const pulses = String(snapshot.pulses);
        if (root.dataset.pulses !== pulses) root.dataset.pulses = pulses;
    };
    syncPulses(bus.current());
    bus.subscribe(syncPulses);
    const detected = detectTier();
    root.dataset.tier = detected;
    if (detected === 'plain') return;
    const tier: StageTier = detected;
    const forced = isForced();

    const motionQuery = window.matchMedia(REDUCED_MOTION);
    let canvas = newCanvas(root);
    let driver: Driver | null = null;
    let usingWorker = false;
    let stopped = false;
    let layoutFrame = 0;
    let lastLayout = '';
    let scale = 1;
    let resolution: MediaQueryList | null = null;
    let host: HTMLElement | null = null;
    let report: SceneReport | null = null;

    root.dataset.frames = '0';

    const send: Send = (message, transfer) => driver?.send(message, transfer);

    function view(): View {
        return {
            width: root.clientWidth || window.innerWidth,
            height: root.clientHeight || window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
        };
    }

    function sceneHost(): HTMLElement | null {
        const plot = bus.current().plot;
        return plot?.closest<HTMLElement>(WINDOW) ?? null;
    }

    function relayout(): void {
        layoutFrame = 0;
        const plates = measurePlates();
        const windowRect = host?.isConnected ? clientRect(host) : null;
        const canvasRect = clientRect(canvas);
        const key = layoutKey(canvasRect, plates, windowRect);
        if (sameLayout(key, lastLayout)) return;
        lastLayout = key;
        root.dataset.plates = String(plates.length);
        send({ type: 'layout', canvas: canvasRect, plates, window: windowRect });
    }

    /** Plates and the scene window move with every scroll, mount, font load and resize: measure once per frame. */
    function soon(): void {
        if (!layoutFrame) layoutFrame = requestAnimationFrame(relayout);
    }

    function pulseOrigin(): [number, number] {
        const anchor = document.querySelector('[data-stage-origin]');
        if (!anchor) return [root.clientWidth / 2, 0];
        const box = anchor.getBoundingClientRect();
        return [box.left + box.width / 2, box.top + box.height / 2];
    }

    function rechain(snapshot: StageSnapshot, change: StageChange): void {
        send({ type: 'chain', chain: snapshot.chain, pulse: change === 'pulse' ? pulseOrigin() : null });
    }

    function onPart(part: string | null, tap = false): void {
        send({ type: 'focus', part, tap });
    }

    function pointer(kind: PointerKind, event: PointerEvent): void {
        if (!host) return;
        const point = pointerToScene(event, clientRect(host), clientRect(canvas), scale, 1);
        send({
            type: 'pointer',
            kind,
            cssX: point.cssX,
            cssY: point.cssY,
            ndcX: point.ndcX,
            ndcY: point.ndcY,
            inside: point.inside,
            mouse: event.pointerType === 'mouse',
        });
    }

    const onMove = (event: PointerEvent) => pointer('move', event);
    const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        host?.setPointerCapture?.(event.pointerId);
        pointer('down', event);
    };
    const onUp = (event: PointerEvent) => pointer('up', event);
    const onLeave = (event: PointerEvent) => pointer('leave', event);
    const onCancel = (event: PointerEvent) => pointer('cancel', event);

    function bindHost(next: HTMLElement | null): void {
        if (next === host) return;
        if (host) {
            host.removeEventListener('pointermove', onMove);
            host.removeEventListener('pointerdown', onDown);
            host.removeEventListener('pointerup', onUp);
            host.removeEventListener('pointerleave', onLeave);
            host.removeEventListener('pointercancel', onCancel);
            delete host.dataset.hoveredPart;
        }
        host = next;
        if (host) {
            host.addEventListener('pointermove', onMove, { passive: true });
            host.addEventListener('pointerdown', onDown);
            host.addEventListener('pointerup', onUp, { passive: true });
            host.addEventListener('pointerleave', onLeave, { passive: true });
            host.addEventListener('pointercancel', onCancel, { passive: true });
        }
        soon();
    }

    function sendScene(snapshot: StageSnapshot): void {
        bindHost(sceneHost());
        send({ type: 'scene', payload: snapshot.plot ? snapshot.scene : null });
        soon();
    }

    const sizes = new ResizeObserver(soon);
    const mounts = new MutationObserver(() => {
        sizes.disconnect();
        sizes.observe(document.body);
        for (const element of document.querySelectorAll(`${PLATE}, ${WINDOW}`)) sizes.observe(element);
        soon();
    });

    const onResize = () => {
        send({ type: 'view', view: view() });
        soon();
    };

    function watchResolution(): void {
        resolution?.removeEventListener('change', onResolution);
        resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        resolution.addEventListener('change', onResolution);
    }

    function onResolution(): void {
        watchResolution();
        onResize();
    }

    const onVisibility = () => send({ type: 'visible', visible: !document.hidden });
    const onMotion = () => send({ type: 'reduced', reduced: motionQuery.matches });

    const stopListening = bus.subscribe((snapshot, change) => {
        if (change === 'chain' || change === 'pulse') rechain(snapshot, change);
        else if (change === 'focus') onPart(snapshot.focus);
        else sendScene(snapshot);
    });

    function teardown(): void {
        stopped = true;
        cancelAnimationFrame(layoutFrame);
        stopListening();
        sizes.disconnect();
        mounts.disconnect();
        bindHost(null);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', soon);
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('transitionend', soon);
        motionQuery.removeEventListener('change', onMotion);
        resolution?.removeEventListener('change', onResolution);
        driver?.stop();
        canvas.remove();
        for (const scene of document.querySelectorAll('.scene[data-gl]')) scene.removeAttribute('data-gl');
        document.documentElement.removeAttribute('data-stage');
        root.dataset.tier = 'plain';
    }

    function start(next: Driver, surface: HTMLCanvasElement): void {
        driver = next;
        const drawn = usingWorker ? surface.transferControlToOffscreen() : surface;
        const transfer: Transferable[] = usingWorker ? [drawn as OffscreenCanvas] : [];
        send(
            {
                type: 'init',
                canvas: drawn,
                allowSoftware: forced,
                tier,
                pinned: forced,
                reduced: motionQuery.matches,
                view: view(),
            },
            transfer,
        );
        send({ type: 'visible', visible: !document.hidden });
        rechain(bus.current(), 'chain');
        lastLayout = '';
        sendScene(bus.current());
        relayout();
    }

    async function fallBack(): Promise<void> {
        driver?.stop();
        canvas.remove();
        canvas = newCanvas(root);
        usingWorker = false;
        start(await directDriver(onReply), canvas);
    }

    function onReply(reply: EngineReply): void {
        if (stopped) return;
        switch (reply.type) {
            case 'drawn':
                root.dataset.frames = String(reply.frames);
                root.dataset.fps = String(reply.fps);
                root.dataset.mode = reply.mode;
                root.dataset.surface = `${reply.width}x${reply.height}`;
                root.toggleAttribute('data-pulsing', reply.pulsing);
                scale = reply.width / Math.max(1, canvas.getBoundingClientRect().width || view().width);
                if (!canvas.classList.contains('is-ready')) {
                    canvas.classList.add('is-ready');
                    document.documentElement.dataset.stage = 'gl';
                }
                return;
            case 'scene':
                report = reply;
                applyReport(reply, host, onPart);
                if (reply.navigate) window.location.hash = `#/${reply.navigate}`;
                return;
            case 'quality':
                root.dataset.quality = reply.quality;
                if (reply.quality === 'plain') teardown();
                return;
            case 'failed':
                if (usingWorker && !reply.software) void fallBack().catch(teardown);
                else teardown();
                return;
        }
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', soon, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('transitionend', soon);
    motionQuery.addEventListener('change', onMotion);
    sizes.observe(document.body);
    for (const element of document.querySelectorAll(`${PLATE}, ${WINDOW}`)) sizes.observe(element);
    const main = document.getElementById('main');
    if (main) mounts.observe(main, { childList: true, subtree: true });
    watchResolution();
    void document.fonts?.ready.then(soon);

    // A forced tier is the test and debug override; only then are the test probes and mood pins exposed.
    if (forced) {
        (window as unknown as { __pbStage?: unknown }).__pbStage = {
            loseContext: () => send({ type: 'lose' }),
            mock: (minutes: number | null, pulse = false) =>
                send({ type: 'mock', mock: { minutes }, pulse: pulse ? pulseOrigin() : null }),
            /** A part's box in client CSS px, from the same projection the renderer drew with. */
            partRect: (id: string) => {
                const rect = report?.rects?.[id];
                if (!rect || !host) return null;
                const box = host.getBoundingClientRect();
                return {
                    x: box.left + rect[0],
                    y: box.top + rect[1],
                    width: rect[2],
                    height: rect[3],
                    cx: box.left + rect[4],
                    cy: box.top + rect[5],
                };
            },
            parts: () => Object.keys(report?.rects ?? {}),
            hovered: () => report?.hovered ?? null,
        };
    }

    const worker = workerDriver(onReply);
    if (worker) {
        usingWorker = true;
        start(worker, canvas);
    } else {
        void directDriver(onReply)
            .then((direct) => start(direct, canvas))
            .catch(teardown);
    }
}
