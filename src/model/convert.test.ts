import { describe, expect, it } from 'vitest';
import {
    btcText,
    centsToSats,
    convert,
    fiatText,
    MAX_SATS,
    parseBtc,
    parseCents,
    parseSats,
    parseToSats,
    pasteFits,
    satsText,
    satsToFiat,
} from './convert.ts';

const PRICES = { gbp: 57_329, usd: 76_777 };

function sats(text: string, parse = parseBtc): number {
    const parsed = parse(text);
    if (!parsed.ok) throw new Error(`expected a value for ${text}, got ${parsed.reason}`);
    return parsed.value;
}

describe('parseBtc', () => {
    it('turns BTC strings into whole sats with no float drift', () => {
        expect(sats('0.1')).toBe(10_000_000);
        expect(sats('0.3')).toBe(30_000_000);
        expect(sats('1.1')).toBe(110_000_000);
        expect(sats('0.00000001')).toBe(1);
        expect(sats('.5')).toBe(50_000_000);
        expect(sats('0.12345678')).toBe(12_345_678);
        expect(sats('21000000')).toBe(MAX_SATS);
        expect(Number.isSafeInteger(MAX_SATS)).toBe(true);
    });

    it('accepts commas, spaces and trailing zeros', () => {
        expect(sats('10,000')).toBe(1_000_000_000_000);
        expect(sats('10 000')).toBe(1_000_000_000_000);
        expect(sats('1 000.5')).toBe(100_050_000_000);
        expect(sats('0.100000000')).toBe(10_000_000);
        expect(sats('007')).toBe(700_000_000);
    });

    it('rejects empty, negative, garbage, below 1 sat and above 21 million calmly', () => {
        expect(parseBtc('')).toEqual({ ok: false, reason: 'empty' });
        expect(parseBtc('   ')).toEqual({ ok: false, reason: 'empty' });
        expect(parseBtc('-1')).toEqual({ ok: false, reason: 'invalid' });
        expect(parseBtc('1e3')).toEqual({ ok: false, reason: 'invalid' });
        expect(parseBtc('abc')).toEqual({ ok: false, reason: 'invalid' });
        expect(parseBtc('1.2.3')).toEqual({ ok: false, reason: 'invalid' });
        expect(parseBtc('.')).toEqual({ ok: false, reason: 'invalid' });
        expect(parseBtc('0.000000001')).toEqual({ ok: false, reason: 'too-small' });
        expect(parseBtc('21000000.00000001')).toEqual({ ok: false, reason: 'too-big' });
        expect(parseBtc('99999999999999999999')).toEqual({ ok: false, reason: 'too-big' });
    });
});

describe('parseSats and parseCents', () => {
    it('reads whole sats only', () => {
        expect(sats('1', parseSats)).toBe(1);
        expect(sats('100,000', parseSats)).toBe(100_000);
        expect(sats('5.0', parseSats)).toBe(5);
        expect(parseSats('1.5')).toEqual({ ok: false, reason: 'too-small' });
        expect(parseSats('2,100,000,000,000,001')).toEqual({ ok: false, reason: 'too-big' });
        expect(parseSats('-5')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('reads money to the penny as whole cents', () => {
        expect(sats('58.46', parseCents)).toBe(5_846);
        expect(sats('0.1', parseCents)).toBe(10);
        expect(sats('1,000', parseCents)).toBe(100_000);
        expect(parseCents('0.001')).toEqual({ ok: false, reason: 'too-small' });
    });
});

describe('conversion', () => {
    it('round-trips BTC and sats exactly', () => {
        for (const text of ['0.1', '1', '0.00000001', '21,000,000', '0.12345678', '10,000']) {
            expect(btcText(sats(text))).toBe(text);
        }
        expect(satsText(sats('100,000', parseSats))).toBe('100,000');
    });

    it('converts 1 sat and 1 BTC at the price', () => {
        expect(satsToFiat(1, PRICES.gbp)).toBeCloseTo(0.00057329, 12);
        expect(fiatText(satsToFiat(1, PRICES.gbp))).toBe('0.00057');
        expect(convert(100_000_000, PRICES).fields).toEqual({
            sats: '100,000,000',
            btc: '1',
            gbp: '57,329.00',
            usd: '76,777.00',
        });
        expect(convert(100_000, PRICES).fields.gbp).toBe('57.33');
    });

    it('converts money to the nearest sat and back within half a sat', () => {
        const fromPounds = centsToSats(5_000, PRICES.gbp);
        expect(fromPounds).toBe(87_216);
        expect(Math.abs(satsToFiat(fromPounds, PRICES.gbp) - 50)).toBeLessThan(satsToFiat(0.5, PRICES.gbp));
    });

    it('drives every unit from any field', () => {
        expect(parseToSats('sats', '100,000', PRICES)).toEqual({ ok: true, value: 100_000 });
        expect(parseToSats('btc', '0.001', PRICES)).toEqual({ ok: true, value: 100_000 });
        expect(parseToSats('usd', '76.78', PRICES)).toEqual({ ok: true, value: 100_004 });
        expect(parseToSats('gbp', '', PRICES)).toEqual({ ok: false, reason: 'empty' });
        expect(parseToSats('gbp', '9,999,999,999,999', PRICES)).toEqual({ ok: false, reason: 'too-big' });
    });
});

describe('pasteFits', () => {
    it('lets numbers through with separators, symbols and units', () => {
        expect(pasteFits(' 100 000 ', 0)).toBe(true);
        expect(pasteFits('£1,250.50', 2)).toBe(true);
        expect(pasteFits('0.01 BTC', 8)).toBe(true);
        expect(pasteFits('21,000 sats', 0)).toBe(true);
        expect(pasteFits('5.00', 0)).toBe(true);
    });

    it('stops negative numbers, garbage and more decimals than the field holds', () => {
        expect(pasteFits('-5', 0)).toBe(false);
        expect(pasteFits('bc1qxyz', 8)).toBe(false);
        expect(pasteFits('1e8', 8)).toBe(false);
        expect(pasteFits('', 2)).toBe(false);
        expect(pasteFits('1.5', 0)).toBe(false);
        expect(pasteFits('0.001', 2)).toBe(false);
    });
});
