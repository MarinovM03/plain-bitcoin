import type { StageBus, StageChange, StageSnapshot } from './bus.ts';
import type { EngineMessage, EngineReply, Rect, StageTier, View } from './engine.ts';
import { detectTier, isForced } from './tier.ts';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PLATE = '[data-plate]';

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

/** Every mounted plate, in document CSS px: the body flows around them and darkens at their edges. */
export function measurePlates(root: ParentNode = document): Rect[] {
    const rects: Rect[] = [];
    for (const element of root.querySelectorAll<HTMLElement>(PLATE)) {
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) continue;
        rects.push([box.left, box.top + window.scrollY, box.width, box.height]);
    }
    return rects;
}

function samePlates(a: readonly Rect[], b: readonly Rect[]): boolean {
    return (
        a.length === b.length &&
        a.every((rect, i) => rect.every((value, k) => Math.abs(value - (b[i]?.[k] ?? 0)) < 0.5))
    );
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
    let plates: Rect[] = [];
    let plateFrame = 0;
    let pointerFrame = 0;
    let pointer = { x: 0, y: 0 };
    let resolution: MediaQueryList | null = null;

    root.dataset.frames = '0';

    const send: Send = (message, transfer) => driver?.send(message, transfer);

    function view(): View {
        return {
            width: root.clientWidth || window.innerWidth,
            height: root.clientHeight || window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
        };
    }

    function remeasure(): void {
        plateFrame = 0;
        const next = measurePlates();
        if (samePlates(next, plates)) return;
        plates = next;
        root.dataset.plates = String(plates.length);
        send({ type: 'plates', plates });
    }

    /** Plates move when a route mounts, a gauge flips in, fonts land or anything resizes: measure once per frame. */
    function soon(): void {
        if (!plateFrame) plateFrame = requestAnimationFrame(remeasure);
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

    const sizes = new ResizeObserver(soon);
    const mounts = new MutationObserver(() => {
        sizes.disconnect();
        sizes.observe(document.body);
        for (const element of document.querySelectorAll(PLATE)) sizes.observe(element);
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

    const onScroll = () => send({ type: 'scroll', y: window.scrollY });

    // The bend follows a mouse only: a tap on a touch screen never moves the body.
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
        if (change === 'chain' || change === 'pulse') rechain(snapshot, change);
        else soon();
    });

    function teardown(): void {
        stopped = true;
        cancelAnimationFrame(pointerFrame);
        cancelAnimationFrame(plateFrame);
        stopListening();
        sizes.disconnect();
        mounts.disconnect();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('animationend', soon);
        motionQuery.removeEventListener('change', onMotion);
        resolution?.removeEventListener('change', onResolution);
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
        send({ type: 'scroll', y: window.scrollY });
        rechain(bus.current(), 'chain');
        plates = [];
        remeasure();
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
                canvas.classList.add('is-ready');
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
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('animationend', soon);
    motionQuery.addEventListener('change', onMotion);
    sizes.observe(document.body);
    for (const element of document.querySelectorAll(PLATE)) sizes.observe(element);
    const main = document.getElementById('main');
    if (main) mounts.observe(main, { childList: true, subtree: true });
    watchResolution();
    void document.fonts?.ready.then(soon);

    // A forced tier is the test and debug override; only then can a test drop the GPU context or pin the mood.
    if (forced) {
        (
            window as unknown as {
                __stage?: { loseContext(): void; mock(minutes: number | null, pulse?: boolean): void };
            }
        ).__stage = {
            loseContext: () => send({ type: 'lose' }),
            mock: (minutes, pulse = false) =>
                send({ type: 'mock', mock: { minutes }, pulse: pulse ? pulseOrigin() : null }),
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
