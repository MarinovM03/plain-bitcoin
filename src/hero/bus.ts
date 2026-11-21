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
    /** How far the camera has gone down the shaft, 0 at the top to 1 at the target ring. */
    readonly dive: number;
}

export interface SatsInput {
    readonly sats: number;
    /** The same amount in money, or null when there is no price for the chosen currency. */
    readonly money: number | null;
    readonly symbol: '$' | '€' | '£';
}

export interface WallInput {
    /** Share of all 21 million already issued, 0 to 1. */
    readonly issued: number;
    /** How far the camera has dived, 0 for the whole block to 1 for single coins; null lets it dive on its own. */
    readonly zoom?: number | null;
}

export interface HalvingInput {
    readonly height: number;
}

export interface QueueInput {
    /** The lowest fee rate in each projected next block, nearest first, in sats per virtual byte. */
    readonly floors: readonly number[];
    /** How full each projected block is, 0 to 1. */
    readonly fills: readonly number[];
    /** Transactions waiting in each projected block. */
    readonly counts: readonly number[];
    /** The followed transaction's fee rate, or null when none is followed. */
    readonly rate: number | null;
    /** Which projected block it reaches, 1 for the next; null when it pays less than all of them. */
    readonly slab: number | null;
    readonly confirmed: boolean;
    /** How many blocks back from the newest the confirmed transaction sits, 0 for the newest. */
    readonly confirmedDepth: number | null;
    /** How full each of the newest mined blocks is, newest first, 0 to 1 of the weight limit. */
    readonly mined: readonly number[];
    /** The newest block's height: when it grows the line slides across. */
    readonly height: number;
}

export interface MeltInput {
    /** Share of its buying power the money still has, 0 to 1. */
    readonly kept: number;
    /** The sign printed on the notes. */
    readonly symbol: '$' | '£';
}

/** One column per year of a buying plan: each coin is one buy, as a share of the biggest single buy. */
export interface StackInput {
    readonly columns: readonly { readonly year: string; readonly coins: readonly number[] }[];
}

export type AddressRole = 'hrp' | 'separator' | 'version' | 'program' | 'checksum' | 'prefix' | 'body' | 'unknown';

/** An address's characters, the part each one is, and how the check came out. */
export interface AddressInput {
    readonly chars: string;
    readonly roles: readonly AddressRole[];
    readonly state: 'empty' | 'valid' | 'invalid';
    /** The place of a likely typo, when the checker can tell. */
    readonly suspect: number | null;
    readonly checksumBad: boolean;
}

export interface MachineInputs {
    miner: MinerInput;
    sats: SatsInput;
    wall: WallInput;
    halving: HalvingInput;
    queue: QueueInput;
    melt: MeltInput;
    stack: StackInput;
    address: AddressInput;
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
