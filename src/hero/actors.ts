import type { ChainEffect } from '../chain/machine.ts';
import { type SlabShape, slabShape } from '../chain/shape.ts';
import { FORMING } from '../chain/view.ts';
import type { ChainBlock } from '../data/height.ts';

export type Entrance = 'drop' | 'snap' | 'fade' | 'none';

export const TIMING = {
    dropStagger: 0.2,
    dropSeconds: 0.75,
    dropHeight: 0.8,
    snapSeconds: 0.55,
    fadeSeconds: 0.5,
    leaveSeconds: 0.7,
    /** How quickly a tablet closes on its place in the chain, per second. */
    follow: 3.2,
} as const;

export interface Actor {
    readonly key: string;
    readonly block: ChainBlock;
    readonly shape: SlabShape;
    readonly entrance: Entrance;
    /** Seconds since the entrance began; negative while it waits its turn. */
    age: number;
    /** Distance back along the chain right now, and where it is heading. */
    offset: number;
    target: number;
    /** Seconds since it began to leave, or null while it stays. */
    leaving: number | null;
}

export interface ActorPose {
    offset: number;
    lift: number;
    side: number;
    thick: number;
    /** 0 = not there, 1 = fully there. */
    presence: number;
    /** 1 at the moment a forming block turns solid, fading to 0. */
    flash: number;
}

function keyOf(block: ChainBlock): string {
    return `${block.height}:${block.hash ?? ''}`;
}

function ease(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return 1 - (1 - x) ** 3;
}

export function poseOf(actor: Actor): ActorPose {
    const { shape, entrance, age } = actor;
    const leave = actor.leaving === null ? 1 : 1 - Math.min(1, actor.leaving / TIMING.leaveSeconds);
    const pose: ActorPose = {
        offset: actor.offset,
        lift: 0,
        side: shape.side,
        thick: shape.thick,
        presence: leave,
        flash: 0,
    };
    if (entrance === 'drop') {
        const t = ease(age / TIMING.dropSeconds);
        pose.lift = (1 - t) * TIMING.dropHeight;
        pose.presence = leave * (age <= 0 ? 0 : Math.min(1, (age / TIMING.dropSeconds) * 2.5));
    } else if (entrance === 'snap') {
        const t = ease(age / TIMING.snapSeconds);
        pose.side = FORMING.side + (shape.side - FORMING.side) * t;
        pose.thick = FORMING.thick + (shape.thick - FORMING.thick) * t;
        pose.presence = leave * Math.min(1, Math.max(0, age / (TIMING.snapSeconds * 0.6)));
        pose.flash = age < 0 ? 0 : Math.exp(-age * 3.2);
    } else if (entrance === 'fade') {
        pose.presence = leave * Math.min(1, Math.max(0, age / TIMING.fadeSeconds));
    }
    return pose;
}

export interface Cast {
    readonly actors: readonly Actor[];
    /** Takes a new list of blocks (newest first) and where each should stand. */
    sync(blocks: readonly ChainBlock[], offsets: readonly number[], effect: ChainEffect): void;
    /** Moves every target without touching who is on stage (the gaps follow the clock). */
    retarget(offsets: readonly number[]): void;
    /** Advances time; returns true while anything is still moving. */
    step(seconds: number): boolean;
    /** Jumps every entrance, exit and slide to its end: the still frame. */
    settle(): void;
}

export function createCast(): Cast {
    let actors: Actor[] = [];
    let staying: Actor[] = [];

    function retarget(offsets: readonly number[]): void {
        staying.forEach((actor, index) => {
            const target = offsets[index];
            if (target !== undefined) actor.target = target;
        });
    }

    return {
        get actors() {
            return actors;
        },
        sync(blocks, offsets, effect) {
            const known = new Map(staying.map((actor) => [actor.key, actor]));
            const next: Actor[] = blocks.map((block, index) => {
                const key = keyOf(block);
                const target = offsets[index] ?? 0;
                const existing = known.get(key);
                if (existing) {
                    known.delete(key);
                    existing.target = target;
                    return existing;
                }
                const snap = effect === 'snap' && index === 0;
                const entrance: Entrance = effect === 'replay' ? 'drop' : snap ? 'snap' : 'fade';
                return {
                    key,
                    block,
                    shape: slabShape(block),
                    entrance,
                    age: entrance === 'drop' ? -(blocks.length - 1 - index) * TIMING.dropStagger : 0,
                    offset: snap ? 0 : target,
                    target,
                    leaving: null,
                };
            });
            for (const gone of known.values()) gone.leaving = 0;
            staying = next;
            actors = [...next, ...actors.filter((actor) => actor.leaving !== null)];
        },
        retarget,
        step(seconds) {
            let moving = false;
            const follow = 1 - Math.exp(-seconds * TIMING.follow);
            for (const actor of actors) {
                actor.age += seconds;
                // A block that has just turned solid holds its place until it is whole, then steps back.
                const held = actor.entrance === 'snap' && actor.age < TIMING.snapSeconds * 0.8;
                if (!held) actor.offset += (actor.target - actor.offset) * follow;
                if (actor.leaving !== null) actor.leaving += seconds;
                const entering =
                    actor.entrance !== 'none' && actor.age < Math.max(TIMING.dropSeconds, TIMING.snapSeconds) + 1;
                if (entering || held || actor.leaving !== null || Math.abs(actor.target - actor.offset) > 0.002)
                    moving = true;
            }
            actors = actors.filter((actor) => actor.leaving === null || actor.leaving < TIMING.leaveSeconds);
            return moving;
        },
        settle() {
            actors = staying;
            for (const actor of actors) {
                actor.age = 60;
                actor.offset = actor.target;
            }
        },
    };
}
