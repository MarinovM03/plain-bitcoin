import { describe, expect, it } from 'vitest';
import { issued, MAX_SUPPLY } from '../../model/supply.ts';
import { satsScale } from '../../util/sats-scale.ts';
import { addressLayout, bech32Roles, charLevels } from './address.ts';
import { convertLayout } from './convert.ts';
import { dcaLayout } from './dca.ts';
import { DOTS, leftFill, leftLayout } from './left.ts';
import { powerFills, powerLayout } from './power.ts';
import { inkIndex, type Layout, MAX_POINTS } from './types.ts';

function inBox(layout: Layout, aspect: number): boolean {
    for (let i = 0; i < layout.count; i += 1) {
        const x = layout.x[i] ?? -1;
        const y = layout.y[i] ?? -1;
        if (x < 0 || x > aspect || y < 0 || y > 1) return false;
    }
    return true;
}

function count(layout: Layout, ink: Parameters<typeof inkIndex>[0]): number {
    return layout.ink.filter((value, i) => value === inkIndex(ink) && (layout.r[i] ?? 0) > 0).length;
}

describe('left scene', () => {
    it('lights one dot per 10,000 BTC issued and marks the one being filled', () => {
        const fill = leftFill(974_148);
        expect(fill.full).toBe(Math.floor(issued(974_148) / 1e12));
        expect(fill.partial).toBeGreaterThan(0);
        const layout = leftLayout({ id: 'left', height: 974_148 }, 1.6);
        expect(layout.count).toBe(DOTS);
        expect(count(layout, 'faint')).toBe(DOTS - fill.full - 1);
        expect(count(layout, 'ember')).toBe(1);
        expect(count(layout, 'btc')).toBe(fill.full - fill.eraStart);
        expect(inBox(layout, 1.6)).toBe(true);
        expect(DOTS * 1e12).toBeGreaterThanOrEqual(MAX_SUPPLY);
    });

    it('fits the 21 groups to tall and wide windows', () => {
        for (const aspect of [0.6, 1, 2.4])
            expect(inBox(leftLayout({ id: 'left', height: 1 }, aspect), aspect)).toBe(true);
    });
});

describe('power scene', () => {
    it('sizes the two stacks with the same scale as the bars below', () => {
        const [cash, bitcoin] = powerFills(1_000, 2_000);
        expect(bitcoin).toBe(2 * cash);
        expect(powerFills(0, 5)).toEqual([0, 0]);
        const layout = powerLayout({ id: 'power', cash: 1_000, bitcoin: 2_000 }, 1.4);
        expect(count(layout, 'fiat')).toBe(cash);
        expect(count(layout, 'btc')).toBe(bitcoin);
    });

    it('draws a preview outline without claiming either value', () => {
        const layout = powerLayout({ id: 'power', cash: 1, bitcoin: 1, outline: true }, 1.4);
        expect(count(layout, 'btc') + count(layout, 'fiat')).toBe(0);
    });
});

describe('convert scene', () => {
    it('picks a power of ten per dot so the amount lights at most 1,000 dots', () => {
        expect(satsScale(1)).toEqual({ perDot: 1, filled: 1, partial: 0 });
        expect(satsScale(100_000)).toEqual({ perDot: 100, filled: 1000, partial: 0 });
        expect(satsScale(100_000_000).perDot).toBe(100_000);
        expect(satsScale(1_001)).toMatchObject({ perDot: 10, filled: 100 });
        const layout = convertLayout({ id: 'convert', sats: 1_234 }, 1.5);
        expect(count(layout, 'btc')).toBe(123);
        expect(count(layout, 'ember')).toBe(1);
    });
});

describe('dca scene', () => {
    it('draws one mark per buy for the schedule and stays within the point budget', () => {
        const buys = 850;
        const series = Array.from({ length: buys }, (_, i) => i + 1);
        const layout = dcaLayout({ id: 'dca', value: series, invested: series, lump: series }, 1.2, 300);
        expect(count(layout, 'btc')).toBe(buys);
        expect(layout.count).toBeLessThanOrEqual(MAX_POINTS);
        expect(inBox(layout, 1.2)).toBe(true);
    });

    it('keeps the mark size in pixels whatever the window height', () => {
        const data = { id: 'dca', value: [1, 2], invested: [1, 2], lump: [2, 2] } as const;
        const small = dcaLayout(data, 1, 100);
        const big = dcaLayout(data, 1, 600);
        expect((small.r[0] ?? 0) * 100).toBeCloseTo((big.r[0] ?? 0) * 600);
    });
});

describe('address scene', () => {
    it('reads each character as its place in the alphabet', () => {
        expect(charLevels('bc1q')).toEqual([0.5, 0.5, 0.15, 1 / 32]);
        expect(charLevels('1A0')[2]).toBe(-1);
        expect(bech32Roles('bc1qxyzqpzry9')).toEqual([
            'hrp',
            'hrp',
            'separator',
            'version',
            'program',
            'program',
            'program',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
        ]);
    });

    it('raises the suspect character and loosens a bad checksum', () => {
        const text = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        const base = {
            id: 'address',
            text,
            roles: bech32Roles(text),
            state: 'invalid',
            suspect: 7,
            checksumBad: true,
        } as const;
        const layout = addressLayout(base, 2);
        expect(count(layout, 'ember')).toBeGreaterThan(0);
        expect(count(layout, 'ghost')).toBeGreaterThan(0);
        expect(inBox(addressLayout({ ...base, state: 'valid', suspect: null, checksumBad: false }, 2), 2)).toBe(true);
    });
});
