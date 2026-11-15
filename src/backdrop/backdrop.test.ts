import { describe, expect, it } from 'vitest';
import { GRID_DOTS } from '../util/sats-scale.ts';
import { plan as addressPlan } from './address.ts';
import { plan as convertPlan, discCentre } from './convert.ts';
import { coinScale, plan as dcaPlan, PILE_COINS } from './dca.ts';
import { BTC_PER_DOT, FIELD_DOTS, plan as leftPlan } from './left.ts';
import { keptByYear, plan as powerPlan } from './power.ts';
import { planStill } from './still.ts';
import { type BackdropData, type Mark, type Plan, SHAPE } from './types.ts';

const SHAPES = [390 / 844, 360 / 780, 844 / 390, 1440 / 900];
const COLOURS = { btc: '#f7931a', warm: '#e4dccb', cool: '#8fbde6', good: '#7fd6a4', dim: '#a4a8af' };

const SAMPLES: [Plan, BackdropData][] = [
    [leftPlan, { id: 'left', mined: 0.95 }],
    [powerPlan, { id: 'power', kept: [1, 0.9, 0.8, 0.7, 0.6] }],
    [convertPlan, { id: 'convert', sats: 123_456 }],
    [dcaPlan, { id: 'dca', buys: 300 }],
    [addressPlan, { id: 'address', length: 62, verdict: 'good', suspect: null }],
];

function inFrame(marks: readonly Mark[], aspect: number): boolean {
    return marks.every(
        (mark) =>
            Math.abs(mark.x) + mark.w / 2 <= aspect + 1e-9 &&
            Math.abs(mark.y) + mark.h / 2 <= 1 + 1e-9 &&
            [mark.x, mark.y, mark.w, mark.h, mark.level].every(Number.isFinite),
    );
}

describe('tool pictures', () => {
    it('keeps every mark on the screen at phone, landscape and desktop shapes', () => {
        for (const aspect of SHAPES) {
            for (const [plan, data] of SAMPLES) {
                expect(inFrame(plan(data, aspect), aspect), `${data.id} at ${aspect.toFixed(2)}`).toBe(true);
            }
        }
    });

    it('draws something sane with no numbers yet, the wrong numbers or a broken screen shape', () => {
        for (const [plan, data] of SAMPLES) {
            for (const input of [null, SAMPLES.find(([, other]) => other.id !== data.id)?.[1] ?? null]) {
                for (const aspect of [Number.NaN, 0, 1]) {
                    const marks = plan(input, aspect);
                    expect(marks.every((mark) => Number.isFinite(mark.x + mark.y + mark.w + mark.h))).toBe(true);
                }
            }
        }
    });

    it('lights one dot of the field for every 10,000 BTC mined', () => {
        expect(FIELD_DOTS * BTC_PER_DOT).toBe(21_000_000);
        const marks = leftPlan({ id: 'left', mined: 19_950_000 / 21_000_000 }, 1);
        expect(marks).toHaveLength(FIELD_DOTS);
        expect(marks.filter((mark) => mark.tone === 'warm')).toHaveLength(1995);
        expect(marks.filter((mark) => mark.shape === SHAPE.roundOpen)).toHaveLength(FIELD_DOTS - 1996);
        expect(leftPlan({ id: 'left', mined: 7 }, 1).every((mark) => mark.tone === 'warm')).toBe(true);
    });

    it('fills the disc with one point per round number of sats', () => {
        const filled = (sats: number) =>
            convertPlan({ id: 'convert', sats }, 0.46).filter((mark) => mark.shape === SHAPE.round).length;
        expect(filled(0)).toBe(0);
        expect(filled(250)).toBe(250);
        expect(filled(1000)).toBe(GRID_DOTS);
        expect(filled(2500)).toBe(250);
        expect(discCentre(0.46)).toBe(0);
        expect(discCentre(1.6)).toBeGreaterThan(0.5);
    });

    it('stands one coin for each buy until the pile is full, then a whole number of buys per coin', () => {
        expect(coinScale(0)).toEqual({ coins: 0, perCoin: 1 });
        expect(coinScale(52)).toEqual({ coins: 52, perCoin: 1 });
        expect(coinScale(PILE_COINS + 1)).toEqual({ coins: Math.ceil((PILE_COINS + 1) / 2), perCoin: 2 });
        expect(coinScale(Number.NaN).coins).toBe(0);
        for (const buys of [1, 52, 300, 5000]) {
            expect(dcaPlan({ id: 'dca', buys }, 0.46)).toHaveLength(coinScale(buys).coins);
        }
    });

    it('gives the address one square per character and marks only the one that cannot be right', () => {
        const good = addressPlan({ id: 'address', length: 42, verdict: 'good', suspect: null }, 1.6);
        expect(good).toHaveLength(42);
        expect(good.every((mark) => mark.tone === 'good')).toBe(true);
        const bad = addressPlan({ id: 'address', length: 34, verdict: 'bad', suspect: 7 }, 0.46);
        expect(bad.map((mark, index) => (mark.tone === 'btc' ? index : -1)).filter((index) => index >= 0)).toEqual([7]);
        expect(addressPlan({ id: 'address', length: 4000, verdict: 'none', suspect: null }, 1)).toHaveLength(90);
        expect(addressPlan(null, 1).every((mark) => mark.tone === 'cool')).toBe(true);
    });

    it('shrinks each year of notes by what the money still buys', () => {
        const cpi = { '2015-03': 100, '2016-03': 110, '2017-03': 125, '2017-09': 130 };
        expect(keptByYear(cpi, '2015-03', '2017-09')).toEqual([1, 100 / 110, 100 / 125, 100 / 130]);
        expect(keptByYear(cpi, '2017-09', '2017-09')).toEqual([1, 1]);
        expect(keptByYear(cpi, '2019-01', '2017-09')).toEqual([]);
        const notes = powerPlan({ id: 'power', kept: [1, 0.5] }, 1).filter((mark) => mark.shape === SHAPE.square);
        const top = notes[0];
        const bottom = notes[notes.length - 1];
        expect(top && bottom && bottom.w * bottom.h).toBeCloseTo((top?.w ?? 0) * (top?.h ?? 0) * 0.5, 9);
        expect(powerPlan({ id: 'power', kept: Array.from({ length: 60 }, () => 0.9) }, 1).length).toBeLessThanOrEqual(
            24 * 14 * 2,
        );
    });

    it('draws the still from the same marks, without the ones that only exist in motion', () => {
        const marks = powerPlan({ id: 'power', kept: [1, 0.6] }, 390 / 844);
        const drawn = planStill('power', marks, { width: 390, height: 844 }, COLOURS);
        expect(drawn).toContain('data-backdrop="power"');
        expect(drawn).toContain('aria-hidden="true"');
        expect(drawn).not.toContain('NaN');
        expect(drawn.match(/<path /g)).toHaveLength(1);
        const field = planStill(
            'left',
            leftPlan({ id: 'left', mined: 0.5 }, 1.6),
            { width: 1440, height: 900 },
            COLOURS,
        );
        expect(field.match(/<path /g)?.length).toBeGreaterThanOrEqual(2);
        expect(field).toContain('stroke="#f7931a"');
    });
});
