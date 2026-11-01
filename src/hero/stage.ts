import type { StageBus, StageChange, StageSnapshot } from './bus.ts';
import type { EngineMessage, EngineReply, Rect, View } from './engine.ts';
import { loadLayout } from './scenes/index.ts';
import { detectTier, isForced } from './tier.ts';
import { weather } from './weather.ts';

const AWAY_PX = 8;
const NOWHERE: Rect = [-1e5, -1e5, 0, 0];
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

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

// The worker keeps context creation and shader compiles off the main thread, so the page stays responsive.
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

export function runStage(root: HTMLElement, bus: StageBus): void {
    const syncPulses = (snapshot: StageSnapshot) => {
        root.dataset.pulses = String(snapshot.pulses);
    };
    syncPulses(bus.current());
    bus.subscribe(syncPulses);
    const tier = detectTier();
    root.dataset.tier = tier;
    if (tier === 'plain') return;

    const motionQuery = window.matchMedia(REDUCED_MOTION);
    let canvas = newCanvas(root);
    let driver: Driver | null = null;
    let usingWorker = false;
    let stopped = false;
    let plot: HTMLElement | null = null;
    let liveScene: HTMLElement | null = null;
    let engineLive = false;
    let docRect: Rect = [...NOWHERE];
    let layoutKey = '';
    let layoutToken = 0;
    let pointerFrame = 0;
    let pointer = { x: 0, y: 0 };

    root.dataset.quality = tier === 'phone' ? 'half' : 'full';
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

    function syncLive(): void {
        const scene = plot?.closest<HTMLElement>('.scene') ?? null;
        const next = engineLive && !away() ? scene : null;
        if (next === liveScene) return;
        if (liveScene) delete liveScene.dataset.live;
        if (next) next.dataset.live = '';
        liveScene = next;
    }

    function measurePlot(): void {
        if (!plot?.isConnected) {
            docRect = [...NOWHERE];
            return;
        }
        const box = plot.getBoundingClientRect();
        docRect = [box.left, box.top + window.scrollY, box.width, box.height];
    }

    async function relayout(snapshot: StageSnapshot, change: StageChange, snap = false): Promise<void> {
        plot = snapshot.plot;
        measurePlot();
        const token = ++layoutToken;
        const data = snapshot.scene;
        const build = data && plot ? await loadLayout(data.id) : null;
        if (token !== layoutToken || stopped) return;
        const layout = build && data ? build(data, docRect[3] > 0 ? docRect[2] / docRect[3] : 1, docRect[3]) : null;
        const key = layout?.rebuild ?? '';
        send({ type: 'scene', layout, rebuild: change === 'scene' || key !== layoutKey, snap, rect: docRect });
        layoutKey = key;
        syncLive();
    }

    function pulseOrigin(): [number, number] {
        const anchor = document.querySelector('[data-stage-origin]');
        if (!anchor) return [root.clientWidth / 2, 0];
        const box = anchor.getBoundingClientRect();
        return [box.left + box.width / 2, box.top + box.height / 2];
    }

    function rechain(snapshot: StageSnapshot, change: StageChange): void {
        send({
            type: 'chain',
            weather: weather(snapshot.chain, Date.now()),
            pulse: change === 'pulse' ? pulseOrigin() : null,
        });
    }

    const sizes = new ResizeObserver(() => {
        const previous = docRect;
        measurePlot();
        if (previous[2] !== docRect[2] || previous[3] !== docRect[3]) void relayout(bus.current(), 'data');
        else send({ type: 'rect', rect: docRect });
    });

    const onResize = () => {
        send({ type: 'view', view: view() });
        if (!away()) measurePlot();
        send({ type: 'rect', rect: docRect });
    };

    const onScroll = () => {
        const isAway = away();
        if (!isAway) measurePlot();
        send({ type: 'scroll', y: window.scrollY, away: isAway });
        syncLive();
    };

    const onPointer = (event: PointerEvent) => {
        if (event.type === 'pointermove' && event.pointerType !== 'mouse') return;
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
        if (change === 'scene' || change === 'data') {
            sizes.disconnect();
            if (snapshot.plot) sizes.observe(snapshot.plot);
            void relayout(snapshot, change);
        } else {
            rechain(snapshot, change);
        }
    });

    function teardown(): void {
        stopped = true;
        cancelAnimationFrame(pointerFrame);
        stopListening();
        sizes.disconnect();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        motionQuery.removeEventListener('change', onMotion);
        engineLive = false;
        syncLive();
        driver?.stop();
        canvas.remove();
        root.dataset.tier = 'plain';
    }

    function start(next: Driver, target: HTMLCanvasElement): void {
        driver = next;
        const surface = usingWorker ? target.transferControlToOffscreen() : target;
        const transfer: Transferable[] = usingWorker ? [surface as OffscreenCanvas] : [];
        send(
            {
                type: 'init',
                canvas: surface,
                allowSoftware: isForced(),
                quality: tier === 'phone' ? 'half' : 'full',
                reduced: motionQuery.matches,
                view: view(),
            },
            transfer,
        );
        send({ type: 'visible', visible: !document.hidden });
        send({ type: 'scroll', y: window.scrollY, away: away() });
        const initial = bus.current();
        rechain(initial, 'chain');
        if (initial.plot) sizes.observe(initial.plot);
        void relayout(initial, 'scene', true);
    }

    async function fallBack(): Promise<void> {
        driver?.stop();
        canvas.remove();
        canvas = newCanvas(root);
        usingWorker = false;
        layoutKey = '';
        start(await directDriver(onReply), canvas);
    }

    function onReply(reply: EngineReply): void {
        if (stopped) return;
        switch (reply.type) {
            case 'drawn':
                root.dataset.frames = String(reply.frames);
                canvas.classList.add('is-ready');
                engineLive = reply.live;
                syncLive();
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotion);

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
