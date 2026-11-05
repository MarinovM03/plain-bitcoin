import { describe, expect, it } from 'vitest';
import { issued, MAX_SUPPLY, SATS_PER_BTC } from '../../model/supply.ts';
import { createAddress, cutDepth, keyLayout, MAX_TEETH } from './address.ts';
import { autoLevel, createConvert, FACTORS, LEVELS, satView } from './convert.ts';
import { createDca, MAX_STEPS, ridgeLayout } from './dca.ts';
import { blockTwist, createHome } from './home.ts';
import { BAR, createLeft, eraIssuance, ingotLayout, ZOOM_FACTOR } from './left.ts';
import { balanceLayout, createPower, MAX_DECADES, TILT_PER_DECADE } from './power.ts';
import type { Scene, SceneData } from './types.ts';

const VIEW = { width: 640, height: 360 };

function settle(scene: Scene, data: SceneData, instant = false): void {
    scene.set(data, instant);
    for (let i = 0; i < 400 && scene.step(1 / 30); i += 1);
}

function finiteFrame(scene: Scene): boolean {
    const frame = scene.frame(VIEW, null);
    return frame.items.every((item) => Array.from(item.model).every(Number.isFinite));
}

describe('the 21 million ingot', () => {
    it('cuts the bar so every slab is exactly its share of the supply, summing to all of it', () => {
        const { main, zoom } = ingotLayout(974_000);
        const supply = main.reduce((sum, slab) => sum + slab.to - slab.from, 0);
        expect(supply).toBe(MAX_SUPPLY);
        const length = main.reduce((sum, slab) => sum + slab.x1 - slab.x0, 0);
        expect(length).toBeCloseTo(BAR, 9);
        for (const slab of main) expect((slab.x1 - slab.x0) / BAR).toBeCloseTo((slab.to - slab.from) / MAX_SUPPLY, 12);
        const zoomed = zoom.reduce((sum, slab) => sum + slab.x1 - slab.x0, 0);
        expect(zoomed).toBeCloseTo(BAR, 9);
        expect(ZOOM_FACTOR).toBeCloseTo(10.5, 6);
    });

    it('halves each era, and splits issued from still-to-mine at the real issued amount', () => {
        expect(eraIssuance(0)).toBe(10_500_000 * SATS_PER_BTC);
        expect(eraIssuance(1)).toBe(eraIssuance(0) / 2);
        const layout = ingotLayout(974_000);
        expect(layout.issued).toBe(issued(974_000));
        const cut = layout.main.find((slab) => !slab.issued);
        expect(cut?.from).toBe(issued(974_000));
        expect(layout.era).toBe(4);
    });

    it('survives a broken height and draws nothing that is not finite', () => {
        expect(ingotLayout(Number.NaN).issued).toBe(issued(0));
        const scene = createLeft();
        settle(scene, { id: 'left', height: 974_000 }, true);
        expect(finiteFrame(scene)).toBe(true);
        expect(scene.summary()).toBe(`issued=${issued(974_000)};era=4`);
    });
});

describe('the balance', () => {
    it('tips 8° for every tenfold, toward the heavier pan, and stops at a thousandfold', () => {
        expect(balanceLayout(100, 1000).tilt).toBeCloseTo(TILT_PER_DECADE, 9);
        expect(balanceLayout(1000, 100).tilt).toBeCloseTo(-TILT_PER_DECADE, 9);
        expect(balanceLayout(1, 1).tilt).toBe(0);
        const huge = balanceLayout(1, 1e9);
        expect(huge.tilt).toBeCloseTo(MAX_DECADES * TILT_PER_DECADE, 9);
        expect(huge.clamped).toBe(true);
        expect(huge.log).toBe(true);
    });

    it('keeps the stacks on the shared bar scale and lands empty for no answer or bad numbers', () => {
        const even = balanceLayout(500, 500);
        expect(even.cash).toBeCloseTo(even.bitcoin, 9);
        for (const [a, b] of [
            [0, 5],
            [Number.NaN, 5],
            [5, Number.POSITIVE_INFINITY],
        ] as const)
            expect(balanceLayout(a, b)).toMatchObject({ cash: 0, bitcoin: 0, tilt: 0 });
    });

    it('settles to the honest angle after its swing, and reports it', () => {
        const scene = createPower();
        settle(scene, { id: 'power', cash: 1000, bitcoin: 435_559, cashLabel: '£1,000', bitcoinLabel: '£435,559' });
        expect(scene.summary()).toMatch(/^ratio=435\.5590;tilt=21\.11;log=true$/);
        expect(finiteFrame(scene)).toBe(true);
    });
});

describe('the sat cube', () => {
    it('is exactly 100,000,000 sats: 1,000 × 1,000 × 100, each level a tenth-cubed of the last', () => {
        expect(FACTORS.reduce((product, factor) => product * factor, 1)).toBe(SATS_PER_BTC);
        expect(LEVELS[0].perCell * LEVELS[0].cells).toBe(SATS_PER_BTC);
        expect(LEVELS[1].perCell * LEVELS[1].cells).toBe(LEVELS[0].perCell);
        expect(LEVELS[2].perCell * LEVELS[2].cells).toBe(LEVELS[1].perCell);
    });

    it('fills the right cells at each level, and stands whole coins beside the block', () => {
        expect(satView(123_456, 0)).toMatchObject({ filled: 1, whole: 0 });
        expect(satView(123_456, 1)).toMatchObject({ filled: 234 });
        expect(satView(123_456, 2)).toMatchObject({ filled: 56, partial: 0 });
        expect(satView(SATS_PER_BTC, 0)).toMatchObject({ filled: 1000, whole: 0, partial: 0 });
        expect(satView(2.5 * SATS_PER_BTC, 0)).toMatchObject({ filled: 500, whole: 2 });
        expect(satView(Number.NaN, 0)).toMatchObject({ filled: 0, whole: 0 });
        expect(autoLevel(150_000)).toBe(0);
        expect(autoLevel(2_000)).toBe(1);
        expect(autoLevel(7)).toBe(2);
    });

    it('lands on the newest amount at once, however fast it changes', () => {
        const scene = createConvert();
        for (const sats of [1, 999_999_999, 0, 2_000]) scene.set({ id: 'convert', sats }, false);
        for (let i = 0; i < 400 && scene.step(1 / 30); i += 1);
        expect(scene.summary()).toBe('sats=2000;level=1;filled=20;whole=0');
        expect(finiteFrame(scene)).toBe(true);
    });
});

const marks = (count: number) => ({
    id: 'dca' as const,
    fiat: 'GBP' as const,
    worth: '£2,000',
    alt: '',
    t: Array.from({ length: count }, (_, i) => Date.UTC(2020, 0, 1) + i * 7 * 86_400_000),
    value: Array.from({ length: count }, (_, i) => 50 * (i + 1) * (1 + i / count)),
    invested: Array.from({ length: count }, (_, i) => 50 * (i + 1)),
    lump: Array.from({ length: count }, () => 3000),
});

describe('the ridge', () => {
    it('frames the series in the same box the SVG axes use, and samples many buys to a fixed step count', () => {
        const ridge = ridgeLayout(marks(400), VIEW);
        expect(ridge?.x).toHaveLength(MAX_STEPS);
        expect(ridge?.x[0]).toBeCloseTo(4, 6);
        expect(ridge?.x.at(-1)).toBeCloseTo(VIEW.width - 8, 6);
        expect(ridgeLayout(marks(20), VIEW)?.x).toHaveLength(20);
        expect(ridgeLayout({ ...marks(0) }, VIEW)).toBeNull();
    });

    it('ends on the answer and morphs to the newest payload', () => {
        const scene = createDca();
        settle(scene, marks(30), true);
        settle(scene, { ...marks(30), worth: '£9' });
        expect(scene.summary()).toMatch(/worth=£9$/);
        expect(finiteFrame(scene)).toBe(true);
    });
});

describe('the key', () => {
    it('cuts one of eight depths per character, the same depth every time', () => {
        const depths = new Set([...'0123456789abcdefghijklmnopqrstuvwxyz'].map(cutDepth));
        expect(depths.size).toBe(8);
        expect(cutDepth('q')).toBe(cutDepth('q'));
    });

    it('seats every pin for a proven address, sticks the pin of a character that cannot be there', () => {
        const valid = keyLayout({
            id: 'address',
            text: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
            roles: [],
            state: 'valid',
            suspect: null,
            checksumBad: false,
        });
        expect(valid.teeth.every((tooth) => tooth.pin === 'seated')).toBe(true);
        const bad = keyLayout({
            id: 'address',
            text: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3tO',
            roles: [],
            state: 'invalid',
            suspect: null,
            checksumBad: false,
        });
        expect(bad.teeth.at(-1)?.pin).toBe('stuck');
        const huge = keyLayout({
            id: 'address',
            text: 'x'.repeat(5000),
            roles: [],
            state: 'invalid',
            suspect: null,
            checksumBad: false,
        });
        expect(huge.teeth).toHaveLength(MAX_TEETH);
        expect(huge.total).toBe(5000);
    });

    it('turns the plug only for a valid address', () => {
        const scene = createAddress();
        settle(scene, {
            id: 'address',
            text: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
            roles: [],
            state: 'valid',
            suspect: null,
            checksumBad: false,
            kind: 'SegWit',
        });
        expect(scene.summary()).toBe('teeth=42;state=valid;stuck=0;turned=true');
        expect(finiteFrame(scene)).toBe(true);
    });
});

describe('the chain on the table', () => {
    it('stacks by the real tip, the same twist for the same block, and opens a tool from its miniature', () => {
        expect(blockTwist(100)).toBe(blockTwist(100));
        const scene = createHome();
        settle(scene, { id: 'home', height: 974_000 }, true);
        expect(scene.summary()).toBe('height=974000');
        expect(scene.tap?.('dca')).toBe('dca');
        expect(scene.tap?.('stack')).toBeNull();
        expect(finiteFrame(scene)).toBe(true);
    });
});

describe('honesty', () => {
    it('no scene state depends on chance: the same payload always draws the same frame', () => {
        const a = createPower();
        const b = createPower();
        const data = { id: 'power', cash: 10, bitcoin: 70 } as const;
        settle(a, data, true);
        settle(b, data, true);
        expect(a.frame(VIEW, null).items.map((item) => Array.from(item.model))).toEqual(
            b.frame(VIEW, null).items.map((item) => Array.from(item.model)),
        );
    });
});

describe('scene callouts', () => {
    it('read BTC at a glance, with no trailing zeros, and stay exact', async () => {
        const { plainBtc, LEFT_SCENE } = await import('../../ui/scene-copy.ts');
        expect(plainBtc(5_000_000_000)).toBe('50 BTC');
        expect(plainBtc(312_500_000)).toBe('3.125 BTC');
        expect(plainBtc(1_050_000_000_000_000)).toBe('10,500,000 BTC');
        expect(plainBtc(1)).toBe('0.00000001 BTC');
        expect(
            LEFT_SCENE.eraCallout({
                era: 0,
                tail: false,
                from: 0,
                to: 1_050_000_000_000_000,
                issued: 1_050_000_000_000_000,
                height: 1,
            }),
        ).toBe('Era 0 · from 2009 · 50 BTC a block · 10,500,000 BTC · all issued');
    });
});
