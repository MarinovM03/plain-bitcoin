import { type StageBus, type StageChange, type StageSnapshot, syncSettled } from './bus.ts';
import type { EngineMessage, EngineReply, Rect, StageTier, View } from './engine.ts';
import { loadLayout } from './scenes/index.ts';
import type { ScenePayload } from './scenes/types.ts';
import { detectTier, isForced } from './tier.ts';

const AWAY_PX = 8;
const NOWHERE: Rect = [-1e5, -1e5, 0, 0];
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PREVIEW_MS = 4500;

type Send = (message: EngineMessage, transfer?: Transferable[]) => void;

interface Driver {
    send: Send;
    stop(): void;
}

/** What the points are drawn into right now: the tool's scene window, or one home tile's preview. */
interface Target {
    element: HTMLElement;
    /** Element that carries data-live while the stage draws over it. */
    marker: HTMLElement;
    payload: ScenePayload;
    preview: boolean;
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

function sameRect(a: Rect, b: Rect): boolean {
    return a.every((value, i) => Math.abs(value - (b[i] ?? 0)) < 0.5);
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
    let target: Target | null = null;
    let liveMarker: HTMLElement | null = null;
    let engineLive = false;
    let docRect: Rect = [...NOWHERE];
    let calmRect: Rect = [...NOWHERE];
    let layoutToken = 0;
    let pointerFrame = 0;
    let pointer = { x: 0, y: 0 };
    let previewTimer = 0;
    let previewIndex = -1;
    let resolution: MediaQueryList | null = null;

    root.dataset.frames = '0';

    const send: Send = (message, transfer) => driver?.send(message, transfer);
    const away = () => window.scrollY > AWAY_PX;

    function view(): View {
        return {
            width: root.clientWidth || window.innerWidth,
            height: root.clientHeight || window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
        };
    }

    function rectOf(element: HTMLElement | null): Rect {
        if (!element?.isConnected) return [...NOWHERE];
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return [...NOWHERE];
        return [box.left, box.top + window.scrollY, box.width, box.height];
    }

    function setMarker(next: HTMLElement | null): void {
        if (next === liveMarker) return;
        if (liveMarker) {
            delete liveMarker.dataset.live;
            syncSettled(liveMarker);
        }
        if (next) next.dataset.live = '';
        liveMarker = next;
        syncSettled(next);
    }

    function syncLive(): void {
        setMarker(engineLive && !away() && target ? target.marker : null);
    }

    /** Keeps the points pinned to their window whenever anything moves it: resize, fonts, the bar, a new answer. */
    function remeasure(): void {
        if (!target || away()) return;
        const next = rectOf(target.element);
        const calm = rectOf(target.marker);
        const previous = docRect;
        if (sameRect(next, previous) && sameRect(calm, calmRect)) return;
        docRect = next;
        calmRect = calm;
        root.dataset.plotRect = docRect.map((value) => Math.round(value)).join(',');
        if (Math.abs(next[2] - previous[2]) >= 0.5 || Math.abs(next[3] - previous[3]) >= 0.5) void relayout(false);
        else send({ type: 'rect', rect: docRect, calm: calmRect });
    }

    async function relayout(fresh: boolean, snap = false): Promise<void> {
        const token = ++layoutToken;
        const current = target;
        if (!current) {
            docRect = [...NOWHERE];
            calmRect = [...NOWHERE];
            send({ type: 'scene', layout: null, rev: 0, fresh: true, snap: true, rect: docRect, calm: calmRect });
            return;
        }
        docRect = rectOf(current.element);
        calmRect = rectOf(current.marker);
        root.dataset.plotRect = docRect.map((value) => Math.round(value)).join(',');
        const build = await loadLayout(current.payload.data.id);
        // Only the newest request may draw: a slow layout for an older payload is dropped here.
        if (token !== layoutToken || stopped || target !== current) return;
        const height = docRect[3];
        const layout = height > 0 ? build(current.payload.data, { aspect: docRect[2] / height, pixels: height }) : null;
        send({ type: 'scene', layout, rev: current.payload.rev, fresh, snap, rect: docRect, calm: calmRect });
        syncLive();
    }

    function toolTarget(snapshot: StageSnapshot): Target | null {
        const plot = snapshot.plot;
        const payload = snapshot.scene;
        if (!plot || !payload || payload.data.id === 'home') return null;
        return { element: plot, marker: plot.closest<HTMLElement>('.scene') ?? plot, payload, preview: false };
    }

    function inView(element: HTMLElement): boolean {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.top >= 0 && box.bottom <= window.innerHeight && box.right <= window.innerWidth;
    }

    function stopPreviews(): void {
        window.clearTimeout(previewTimer);
        previewTimer = 0;
    }

    /** Home: one tile at a time re-forms through the same renderer, then holds its still; then the next one. */
    function nextPreview(): void {
        previewTimer = 0;
        const snapshot = bus.current();
        if (snapshot.scene?.data.id !== 'home' || snapshot.previews.size === 0) return;
        const calm = motionQuery.matches || root.dataset.quality === 'still';
        if (!calm && !document.hidden && !away()) {
            const tiles = [...snapshot.previews].filter(([element]) => element.isConnected && inView(element));
            if (tiles.length > 0) {
                previewIndex = (previewIndex + 1) % tiles.length;
                const [element, payload] = tiles[previewIndex] ?? [];
                if (element && payload) {
                    setMarker(null);
                    target = { element, marker: element, payload, preview: true };
                    void relayout(true);
                }
            }
        }
        previewTimer = window.setTimeout(nextPreview, PREVIEW_MS);
    }

    function retarget(snapshot: StageSnapshot, change: StageChange): void {
        sizes.disconnect();
        observeLayout();
        if (snapshot.scene?.data.id === 'home') {
            if (change === 'scene') {
                target = null;
                setMarker(null);
                void relayout(true);
                previewIndex = -1;
            }
            if (!previewTimer && snapshot.previews.size > 0) previewTimer = window.setTimeout(nextPreview, 600);
            return;
        }
        stopPreviews();
        const next = toolTarget(snapshot);
        const fresh =
            change === 'scene' || target?.preview === true || target?.payload.data.id !== next?.payload.data.id;
        if (fresh) setMarker(null);
        target = next;
        if (next) sizes.observe(next.element);
        void relayout(fresh);
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

    const sizes = new ResizeObserver(() => remeasure());
    function observeLayout(): void {
        sizes.observe(document.body);
        const bar = document.querySelector('.topbar');
        if (bar) sizes.observe(bar);
        if (target) sizes.observe(target.element);
    }

    const onResize = () => {
        send({ type: 'view', view: view() });
        remeasure();
        send({ type: 'rect', rect: docRect, calm: calmRect });
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

    const onScroll = () => {
        const isAway = away();
        if (!isAway) remeasure();
        send({ type: 'scroll', y: window.scrollY, away: isAway });
        syncLive();
    };

    // The light follows a mouse only: a tap on a touch screen never lights the field.
    const onPointer = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        pointer = { x: event.clientX, y: event.clientY };
        if (pointerFrame) return;
        pointerFrame = requestAnimationFrame(() => {
            pointerFrame = 0;
            send({ type: 'pointer', ...pointer });
        });
    };

    const onVisibility = () => send({ type: 'visible', visible: !document.hidden });
    const onMotion = () => send({ type: 'reduced', reduced: motionQuery.matches });

    const stopListening = bus.subscribe((snapshot, change) => {
        if (change === 'scene' || change === 'data' || change === 'previews') retarget(snapshot, change);
        else rechain(snapshot, change);
    });

    function teardown(): void {
        stopped = true;
        cancelAnimationFrame(pointerFrame);
        stopPreviews();
        stopListening();
        sizes.disconnect();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        motionQuery.removeEventListener('change', onMotion);
        resolution?.removeEventListener('change', onResolution);
        engineLive = false;
        syncLive();
        driver?.stop();
        canvas.remove();
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
        send({ type: 'scroll', y: window.scrollY, away: away() });
        const initial = bus.current();
        rechain(initial, 'chain');
        target = toolTarget(initial);
        observeLayout();
        if (initial.scene?.data.id === 'home') retarget(initial, 'scene');
        else void relayout(true, true);
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
            case 'drawn': {
                root.dataset.frames = String(reply.frames);
                root.dataset.fps = String(reply.fps);
                root.dataset.mode = reply.mode;
                canvas.classList.add('is-ready');
                engineLive = reply.live;
                const marker = target?.marker ?? null;
                if (marker && target && !target.preview) {
                    if (reply.settled === target.payload.rev) marker.dataset.glRev = String(reply.settled);
                    else delete marker.dataset.glRev;
                }
                syncLive();
                syncSettled(target && !target.preview ? target.marker : null);
                remeasure();
                return;
            }
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotion);
    watchResolution();
    void document.fonts?.ready.then(() => remeasure());

    // A forced tier is the test and debug override; only then can a test drop the GPU context on purpose.
    if (forced) {
        (window as unknown as { __stage?: { loseContext(): void } }).__stage = {
            loseContext: () => send({ type: 'lose' }),
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
