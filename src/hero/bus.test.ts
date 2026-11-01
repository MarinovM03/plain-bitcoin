import { describe, expect, it, vi } from 'vitest';
import { createStageBus, type StageChange } from './bus.ts';
import type { SceneData } from './scenes/types.ts';

const plot = {} as HTMLElement;
const chain = { height: 900_000, blockTime: 1_000, estimated: false };

describe('stage bus', () => {
    it('keeps the latest state before any stage is listening, so a late stage starts from it', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'convert', sats: 1 });
        bus.update({ id: 'convert', sats: 2 });
        bus.update({ id: 'convert', sats: 3 });
        bus.chain(chain, false);
        expect(bus.current()).toEqual({ scene: { id: 'convert', sats: 3 }, plot, chain, pulses: 0 });
    });

    it('ignores an update meant for another scene', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'power', cash: 1, bitcoin: 2 });
        bus.update({ id: 'convert', sats: 5 });
        expect(bus.current().scene).toEqual({ id: 'power', cash: 1, bitcoin: 2 });
    });

    it('counts a pulse only for a real arrival, and tells listeners which change happened', () => {
        const bus = createStageBus(() => {});
        const changes: StageChange[] = [];
        bus.subscribe((_, change) => changes.push(change));
        bus.chain(chain, false);
        bus.chain({ ...chain, height: chain.height + 1 }, true);
        bus.chain({ ...chain, height: chain.height + 1 }, false);
        expect(bus.current().pulses).toBe(1);
        expect(changes).toEqual(['chain', 'pulse', 'chain']);
    });

    it('paints a still for every scene it is shown or updated with, and for previews', () => {
        const paint = vi.fn<(element: HTMLElement, data: SceneData) => void>();
        const bus = createStageBus(paint);
        bus.show(plot, { id: 'left', height: 1 });
        bus.update({ id: 'left', height: 2 });
        bus.preview(plot, { id: 'convert', sats: 9 });
        bus.show(null, { id: 'home' });
        expect(paint.mock.calls.map(([, data]) => data)).toEqual([
            { id: 'left', height: 1 },
            { id: 'left', height: 2 },
            { id: 'convert', sats: 9 },
        ]);
    });

    it('clears back to the empty home scene with no plot', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'convert', sats: 1 });
        bus.clear();
        expect(bus.current()).toMatchObject({ scene: { id: 'home' }, plot: null });
    });

    it('stops telling a listener once it unsubscribes', () => {
        const bus = createStageBus(() => {});
        const listener = vi.fn();
        const stop = bus.subscribe(listener);
        stop();
        bus.chain(chain, true);
        expect(listener).not.toHaveBeenCalled();
    });
});
