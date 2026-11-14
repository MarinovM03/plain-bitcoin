import { describe, expect, it } from 'vitest';
import { FORMING } from '../chain/view.ts';
import type { ChainBlock } from '../data/height.ts';
import { createCast, poseOf, TIMING } from './actors.ts';

function block(height: number): ChainBlock {
    return { height, hash: null, time: height * 600, txCount: 2500, size: 1_400_000, weight: 3_900_000 };
}

const list = (tip: number, length = 4) => Array.from({ length }, (_, index) => block(tip - index));
const offsets = [1, 2, 3, 4, 5];

describe('cast', () => {
    it('lands the first blocks oldest first, then stands still', () => {
        const cast = createCast();
        cast.sync(list(10), offsets, 'replay');
        const [newest, , , oldest] = cast.actors;
        expect(oldest?.age).toBeCloseTo(0, 9);
        expect(newest?.age).toBeCloseTo(-3 * TIMING.dropStagger, 6);
        expect(poseOf(newest as never).presence).toBe(0);
        let moving = true;
        for (let step = 0; step < 400 && moving; step += 1) moving = cast.step(1 / 60);
        expect(moving).toBe(false);
        for (const actor of cast.actors) expect(poseOf(actor)).toMatchObject({ lift: 0, presence: 1, flash: 0 });
    });

    it('turns the forming block solid in place, then steps it back, and lets the oldest go', () => {
        const cast = createCast();
        cast.sync(list(10), offsets, 'replay');
        cast.settle();
        cast.sync(list(11), offsets, 'snap');
        const fresh = cast.actors[0];
        expect(fresh?.entrance).toBe('snap');
        expect(fresh?.offset).toBe(0);
        expect(poseOf(fresh as never).side).toBeCloseTo(FORMING.side, 6);
        cast.step(0.01);
        expect(fresh?.offset).toBe(0);
        expect(poseOf(fresh as never).flash).toBeGreaterThan(0.9);
        expect(cast.actors.filter((actor) => actor.leaving !== null)).toHaveLength(1);
        for (let step = 0; step < 400; step += 1) cast.step(1 / 60);
        expect(cast.actors).toHaveLength(4);
        expect(fresh?.offset).toBeCloseTo(1, 2);
        expect(poseOf(fresh as never).side).toBeCloseTo(fresh?.shape.side ?? 0, 6);
    });

    it('settles straight to the finished frame for reduced motion', () => {
        const cast = createCast();
        cast.sync(list(10), offsets, 'replay');
        cast.sync(list(13), offsets, 'snap');
        cast.settle();
        expect(cast.actors.map((actor) => actor.block.height)).toEqual([13, 12, 11, 10]);
        cast.actors.forEach((actor, index) => {
            expect(actor.offset).toBe(offsets[index]);
            expect(poseOf(actor)).toMatchObject({ lift: 0, presence: 1 });
        });
        expect(cast.step(0)).toBe(false);
    });

    it('keeps the same tablets when only the gaps move with the clock', () => {
        const cast = createCast();
        cast.sync(list(10), offsets, 'replay');
        cast.settle();
        const before = [...cast.actors];
        cast.retarget([1.5, 2.5, 3.5, 4.5]);
        expect(cast.actors).toEqual(before);
        expect(cast.actors[0]?.target).toBe(1.5);
    });
});
