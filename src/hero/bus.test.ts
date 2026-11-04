import { describe, expect, it, vi } from 'vitest';
import type { ScenePayload } from '../gauges/types.ts';
import { createStageBus, type StageChange } from './bus.ts';

const plot = { closest: () => null } as unknown as HTMLElement;
const chain = { height: 900_000, blockTime: 1_000, estimated: false };

describe('stage bus', () => {
    it('keeps the latest payload before any stage is listening, so a late stage starts from it', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'convert', sats: 1 });
        bus.update({ id: 'convert', sats: 2 });
        bus.update({ id: 'convert', sats: 3 });
        bus.chain(chain, false);
        const now = bus.current();
        expect(now.scene?.data).toEqual({ id: 'convert', sats: 3 });
        expect(now.plot).toBe(plot);
        expect(now.chain).toEqual(chain);
        expect(now.pulses).toBe(0);
    });

    it('stamps every payload with a rising rev and freezes it, so older ones can always be told apart', () => {
        const bus = createStageBus(() => {});
        const revs: number[] = [];
        bus.subscribe((snapshot) => revs.push(snapshot.scene?.rev ?? -1));
        bus.show(plot, { id: 'convert', sats: 1 });
        bus.update({ id: 'convert', sats: 2 });
        bus.clear();
        bus.show(plot, { id: 'dca', fiat: 'GBP', worth: '', alt: '', t: [], value: [], invested: [], lump: [] });
        expect(revs).toEqual([...revs].sort((a, b) => a - b));
        expect(new Set(revs).size).toBe(revs.length);
        expect(Object.isFrozen(bus.current().scene)).toBe(true);
    });

    it('ignores an update meant for another scene', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'power', cash: 1, bitcoin: 2 });
        bus.update({ id: 'convert', sats: 5 });
        expect(bus.current().scene?.data).toEqual({ id: 'power', cash: 1, bitcoin: 2 });
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

    it('paints the newest payload for every scene it is shown or updated with, and for previews', () => {
        const paint = vi.fn<(element: HTMLElement, payload: ScenePayload) => void>();
        const bus = createStageBus(paint);
        bus.show(plot, { id: 'left', height: 1 });
        bus.update({ id: 'left', height: 2 });
        bus.preview(plot, { id: 'convert', sats: 9 });
        bus.show(null, { id: 'home' });
        expect(paint.mock.calls.map(([, payload]) => payload.data)).toEqual([
            { id: 'left', height: 1 },
            { id: 'left', height: 2 },
            { id: 'convert', sats: 9 },
        ]);
        expect(bus.current().previews.size).toBe(1);
    });

    it('clears back to the empty home scene with no plot and no previews', () => {
        const bus = createStageBus(() => {});
        bus.show(plot, { id: 'convert', sats: 1 });
        bus.preview(plot, { id: 'convert', sats: 1 });
        bus.clear();
        expect(bus.current()).toMatchObject({ scene: { data: { id: 'home' } }, plot: null });
        expect(bus.current().previews.size).toBe(0);
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
