import type { Art } from './art.ts';
import type { SceneData } from './scenes/types.ts';
import type { ChainState } from './weather.ts';

export type { Art } from './art.ts';
export type { CharRole, SceneData, SceneId } from './scenes/types.ts';
export type { ChainState } from './weather.ts';

export type StageChange = 'scene' | 'data' | 'chain' | 'pulse';

export interface StageSnapshot {
    readonly scene: SceneData | null;
    readonly plot: HTMLElement | null;
    readonly chain: ChainState | null;
    readonly pulses: number;
}

export type StageListener = (snapshot: StageSnapshot, change: StageChange) => void;

export type Painter = (element: HTMLElement, data: SceneData) => void;

export interface StageBus {
    show(plot: HTMLElement | null, data: SceneData): void;
    update(data: SceneData): void;
    clear(): void;
    chain(state: ChainState, arrived: boolean): void;
    preview(element: HTMLElement, data: SceneData): void;
    current(): StageSnapshot;
    subscribe(listener: StageListener): () => void;
}

export function createStageBus(paint: Painter): StageBus {
    const listeners = new Set<StageListener>();
    let snapshot: StageSnapshot = { scene: null, plot: null, chain: null, pulses: 0 };

    function emit(next: StageSnapshot, change: StageChange): void {
        snapshot = next;
        for (const listener of listeners) listener(snapshot, change);
    }

    return {
        show(plot, data) {
            emit({ ...snapshot, scene: data, plot }, 'scene');
            if (plot) paint(plot, data);
        },
        update(data) {
            if (snapshot.scene?.id !== data.id) return;
            emit({ ...snapshot, scene: data }, 'data');
            if (snapshot.plot) paint(snapshot.plot, data);
        },
        clear() {
            emit({ ...snapshot, scene: { id: 'home' }, plot: null }, 'scene');
        },
        chain(state, arrived) {
            emit(
                { ...snapshot, chain: state, pulses: snapshot.pulses + (arrived ? 1 : 0) },
                arrived ? 'pulse' : 'chain',
            );
        },
        preview(element, data) {
            paint(element, data);
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

const painted = new WeakMap<HTMLElement, { data: SceneData; key: string; aspect: number }>();
const queued = new Map<HTMLElement, SceneData>();
let flushing = 0;
let resizes: ResizeObserver | null = null;

function aspectOf(element: HTMLElement): number {
    const { clientWidth: width, clientHeight: height } = element;
    return width > 0 && height > 0 ? width / height : 1.6;
}

async function flush(): Promise<void> {
    flushing = 0;
    const batch = [...queued];
    queued.clear();
    const [{ stillSvg }, { loadLayout }] = await Promise.all([import('./still.ts'), import('./scenes/index.ts')]);
    for (const [element, data] of batch) {
        const aspect = aspectOf(element);
        const key = JSON.stringify(data);
        const last = painted.get(element);
        if (last && last.key === key && Math.abs(aspect / last.aspect - 1) <= 0.04) continue;
        const layout = (await loadLayout(data.id))(data, aspect, element.clientHeight || 200);
        element.innerHTML = stillSvg(layout, aspect);
        painted.set(element, { data, key, aspect });
    }
}

function paintStill(element: HTMLElement, data: SceneData): void {
    if (element.dataset.still === 'own') return;
    queued.set(element, data);
    resizes ??= new ResizeObserver((entries) => {
        for (const { target } of entries) {
            const element = target as HTMLElement;
            const last = painted.get(element);
            if (last && element.isConnected && Math.abs(aspectOf(element) / last.aspect - 1) > 0.04)
                paintStill(element, last.data);
        }
    });
    resizes.observe(element);
    if (flushing === 0) flushing = window.setTimeout(() => void flush(), 0);
}

export const stage = createStageBus(paintStill);

export async function sceneArt(data: SceneData, aspect: number, pixels = 400): Promise<Art> {
    const [{ layoutArt }, { loadLayout }] = await Promise.all([import('./art.ts'), import('./scenes/index.ts')]);
    return layoutArt((await loadLayout(data.id))(data, aspect, pixels), aspect);
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
