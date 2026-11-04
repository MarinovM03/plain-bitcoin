import type { SceneData, ScenePayload } from '../gauges/types.ts';
import type { ChainState } from './weather.ts';

export type { CharRole, DcaMarks, SceneData, SceneId, ScenePayload } from '../gauges/types.ts';
export type { ChainState } from './weather.ts';

export type StageChange = 'scene' | 'data' | 'chain' | 'pulse' | 'previews';

export interface StageSnapshot {
    /** The newest payload for the gauge on screen; only this one is ever drawn. */
    readonly scene: ScenePayload | null;
    readonly plot: HTMLElement | null;
    readonly chain: ChainState | null;
    readonly pulses: number;
    readonly previews: ReadonlyMap<HTMLElement, ScenePayload>;
}

export type StageListener = (snapshot: StageSnapshot, change: StageChange) => void;

export type Painter = (element: HTMLElement, payload: ScenePayload) => void;

export interface StageBus {
    show(plot: HTMLElement | null, data: SceneData): void;
    update(data: SceneData): void;
    clear(): void;
    chain(state: ChainState, arrived: boolean): void;
    preview(element: HTMLElement, data: SceneData): void;
    current(): StageSnapshot;
    subscribe(listener: StageListener): () => void;
}

/** The gauge window carries what it was last asked to show, so tests and the painter can agree on it. */
function markWindow(plot: HTMLElement | null, payload: ScenePayload): void {
    const scene = plot?.closest<HTMLElement>('.scene');
    if (!scene) return;
    scene.dataset.scene = payload.data.id;
    scene.dataset.rev = String(payload.rev);
}

export function createStageBus(paint: Painter): StageBus {
    const listeners = new Set<StageListener>();
    let rev = 0;
    let snapshot: StageSnapshot = { scene: null, plot: null, chain: null, pulses: 0, previews: new Map() };

    function emit(next: StageSnapshot, change: StageChange): void {
        snapshot = next;
        for (const listener of listeners) listener(snapshot, change);
    }

    function stamp(data: SceneData): ScenePayload {
        rev += 1;
        return Object.freeze({ rev, data });
    }

    return {
        show(plot, data) {
            const payload = stamp(data);
            markWindow(plot, payload);
            emit({ ...snapshot, scene: payload, plot }, 'scene');
            if (plot) paint(plot, payload);
        },
        update(data) {
            if (snapshot.scene?.data.id !== data.id) return;
            const payload = stamp(data);
            markWindow(snapshot.plot, payload);
            emit({ ...snapshot, scene: payload }, 'data');
            if (snapshot.plot) paint(snapshot.plot, payload);
        },
        clear() {
            emit({ ...snapshot, scene: stamp({ id: 'home' }), plot: null, previews: new Map() }, 'scene');
        },
        chain(state, arrived) {
            emit(
                { ...snapshot, chain: state, pulses: snapshot.pulses + (arrived ? 1 : 0) },
                arrived ? 'pulse' : 'chain',
            );
        },
        preview(element, data) {
            const payload = stamp(data);
            const previews = new Map(snapshot.previews);
            previews.set(element, payload);
            emit({ ...snapshot, previews }, 'previews');
            paint(element, payload);
        },
        current() {
            return snapshot;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

interface Drawn {
    payload: ScenePayload;
    width: number;
    height: number;
}

const drawn = new WeakMap<HTMLElement, Drawn>();
const latest = new WeakMap<HTMLElement, ScenePayload>();
const queued = new Set<HTMLElement>();
let flushing = 0;
let resizes: ResizeObserver | null = null;

function sizeOf(element: HTMLElement): { width: number; height: number } {
    return { width: element.clientWidth, height: element.clientHeight };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function flush(): Promise<void> {
    flushing = 0;
    const batch = [...queued];
    queued.clear();
    const [{ paintGauge, bindTips }, { loadLayout }] = await Promise.all([
        import('../gauges/paint.ts'),
        import('../gauges/index.ts'),
    ]);
    for (const element of batch) {
        const payload = latest.get(element);
        if (!payload || !element.isConnected) continue;
        const layout = await loadLayout(payload.data.id);
        // A newer payload may have arrived while the layout loaded; the newest one wins.
        if (latest.get(element) !== payload || !element.isConnected) continue;
        const { width, height } = sizeOf(element);
        if (width <= 0 || height <= 0) continue;
        const last = drawn.get(element);
        if (last && last.payload === payload && last.width === width && last.height === height) continue;
        const own = element.id === 'scene-plot';
        const frame = layout(payload.data, { width, height, mini: !own });
        paintGauge(element, frame, reducedMotion());
        drawn.set(element, { payload, width, height });
        const scene = own ? element.closest<HTMLElement>('.scene') : null;
        if (scene) {
            const callout = scene.querySelector<HTMLElement>('.scene__callout');
            if (callout) bindTips(element, callout);
            scene.dataset.summary = frame.summary;
            scene.dataset.settled = String(payload.rev);
        }
    }
}

function schedule(element: HTMLElement): void {
    queued.add(element);
    if (flushing === 0) flushing = window.setTimeout(() => void flush(), 0);
}

function paintLatest(element: HTMLElement, payload: ScenePayload): void {
    latest.set(element, payload);
    resizes ??= new ResizeObserver((entries) => {
        for (const { target } of entries) {
            const element = target as HTMLElement;
            if (!element.isConnected || !latest.has(element)) continue;
            const last = drawn.get(element);
            const { width, height } = sizeOf(element);
            if (!last || width !== last.width || height !== last.height) schedule(element);
        }
    });
    resizes.observe(element);
    schedule(element);
}

export const stage = createStageBus(paintLatest);

export function startStage(root: HTMLElement, after: (task: () => void) => void): void {
    after(() => {
        import('./stage.ts')
            .then(({ runStage }) => runStage(root, stage))
            .catch(() => {
                root.dataset.tier = 'plain';
            });
    });
}
