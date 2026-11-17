/** Every scene is handed plain numbers only, never anything a person typed. */
export interface MinerInput {
    /** Zero bits a hash needs to win a block today. */
    readonly needed: number;
    /** The deepest hash of this visit so far, or -1. */
    readonly best: number;
    /** The real block's own hash depth, once it has been checked. */
    readonly real: number | null;
    /** How many fresh hashes landed at each depth since the last hand-over. */
    readonly tally: readonly number[] | null;
    /** Turns the camera down the shaft to the target ring. */
    readonly dive: boolean;
}

export interface SatsInput {
    readonly sats: number;
}

export interface WallInput {
    /** Share of all 21 million already issued, 0 to 1. */
    readonly issued: number;
}

export interface MeltInput {
    /** Share of its buying power the money still has, 0 to 1. */
    readonly kept: number;
}

export interface StackInput {
    /** One bar per buy or per mark, oldest first, scaled so the tallest is 1. */
    readonly buys: readonly number[];
}

export interface MachineInputs {
    miner: MinerInput;
    sats: SatsInput;
    wall: WallInput;
    melt: MeltInput;
    stack: StackInput;
}

export type MachineId = keyof MachineInputs;

export interface ViewOptions {
    /** A machine's own page: bigger detail and the pointer turns it. A gallery tile only drifts. */
    readonly page?: boolean;
}

export interface View<K extends MachineId> {
    set(input: MachineInputs[K]): void;
    detach(): void;
}

export interface Handle {
    set(input: unknown): void;
    remove(): void;
}

export interface Stage {
    add(slot: HTMLElement, id: MachineId, input: unknown, options: ViewOptions): Handle;
}

let stage: Promise<Stage | null> | null = null;
let deferred: ((task: () => void) => void) | null = null;

/** The page says when the scenes may load: after first paint, so they never hold up the words. */
export function startStage(after: (task: () => void) => void): void {
    deferred = after;
}

function loadStage(): Promise<Stage | null> {
    stage ??= new Promise<void>((resolve) => (deferred ?? ((task) => task()))(resolve))
        .then(() => import('./stage.ts'))
        .then(({ runStage }) => runStage())
        .catch(() => {
            document.documentElement.dataset.scene = 'still';
            return null;
        });
    return stage;
}

/**
 * The one door between the page and the scenes. A page lends the stage an empty box and plain numbers; the stage
 * draws into that box and is never asked anything back.
 */
export function attach<K extends MachineId>(
    slot: HTMLElement,
    id: K,
    input: MachineInputs[K],
    options: ViewOptions = {},
): View<K> {
    let latest: unknown = input;
    let handle: Handle | null = null;
    let gone = false;
    loadStage().then((running) => {
        if (gone || !running) return;
        handle = running.add(slot, id, latest, options);
    });
    return {
        set(next) {
            latest = next;
            handle?.set(next);
        },
        detach() {
            gone = true;
            handle?.remove();
            handle = null;
        },
    };
}
