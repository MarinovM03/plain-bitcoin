import type { Art } from './art.ts';
import type { SceneData, ScenePayload } from './scenes/types.ts';
import type { ChainState } from './weather.ts';

export type { Art } from './art.ts';
export type { CharRole, DcaMarks, SceneData, SceneId, ScenePayload } from './scenes/types.ts';
export type { ChainState } from './weather.ts';

export type StageChange = 'scene' | 'data' | 'chain' | 'pulse' | 'previews';

export interface StageSnapshot {
    /** The newest payload for the scene window; only this one is ever drawn. */
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

/** The scene window carries what it was last asked to show, so tests and the stage can agree on it. */
function markWindow(plot: HTMLElement | null, payload: ScenePayload): void {
    const scene = plot?.closest<HTMLElement>('.scene');
    if (!scene) return;
    scene.dataset.scene = payload.data.id;
    scene.dataset.rev = String(payload.rev);
}

/** Settled means the layer on screen shows the newest payload: the stage's points when it is live, else the still. */
export function syncSettled(scene: HTMLElement | null): void {
    if (!scene) return;
    const live = scene.dataset.live !== undefined;
    const settled = live ? scene.dataset.glRev : scene.dataset.stillRev;
    if (settled === undefined) delete scene.dataset.settled;
    else if (scene.dataset.settled !== settled) scene.dataset.settled = settled;
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

interface Painted {
    payload: ScenePayload;
    width: number;
    height: number;
}

const painted = new WeakMap<HTMLElement, Painted>();
const latest = new WeakMap<HTMLElement, ScenePayload>();
const queued = new Set<HTMLElement>();
let flushing = 0;
let resizes: ResizeObserver | null = null;

function sizeOf(element: HTMLElement): { width: number; height: number } {
    return { width: element.clientWidth, height: element.clientHeight };
}

async function flush(): Promise<void> {
    flushing = 0;
    const batch = [...queued];
    queued.clear();
    const [{ paintStill }, { loadLayout }] = await Promise.all([import('./still.ts'), import('./scenes/index.ts')]);
    for (const element of batch) {
        const payload = latest.get(element);
        if (!payload || !element.isConnected) continue;
        const build = await loadLayout(payload.data.id);
        // A newer payload may have arrived while the layout loaded; the newest one wins.
        if (latest.get(element) !== payload) continue;
        const { width, height } = sizeOf(element);
        const aspect = width > 0 && height > 0 ? width / height : 1.6;
        const last = painted.get(element);
        if (last && last.payload === payload && last.width === width && last.height === height) continue;
        const layout = build(payload.data, { aspect, pixels: height || 200 });
        const own = element.id === 'scene-plot';
        paintStill(element, layout, aspect, own);
        painted.set(element, { payload, width, height });
        const scene = own ? element.closest<HTMLElement>('.scene') : null;
        if (scene) {
            scene.dataset.stillRev = String(payload.rev);
            scene.dataset.summary = layout.summary;
            syncSettled(scene);
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
            const last = painted.get(element);
            if (!last || !element.isConnected) continue;
            const { width, height } = sizeOf(element);
            if (width !== last.width || height !== last.height) schedule(element);
        }
    });
    resizes.observe(element);
    schedule(element);
}

export const stage = createStageBus(paintLatest);

export async function sceneArt(data: SceneData, aspect: number, pixels = 400): Promise<Art> {
    const [{ layoutArt }, { loadLayout }] = await Promise.all([import('./art.ts'), import('./scenes/index.ts')]);
    return layoutArt((await loadLayout(data.id))(data, { aspect, pixels }), aspect);
}

export function startStage(root: HTMLElement, after: (task: () => void) => void): void {
    after(() => {
        import('./stage.ts')
            .then(({ runStage }) => runStage(root, stage))
            .catch(() => {
                root.dataset.tier = 'plain';
            });
    });
}
