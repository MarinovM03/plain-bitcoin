import { describe, expect, it } from 'vitest';
import { formatBtc, formatFiat, formatSats } from './format.ts';

describe('formatSats', () => {
    it('groups thousands and names the unit', () => {
        expect(formatSats(0)).toBe('0 sats');
        expect(formatSats(1)).toBe('1 sat');
        expect(formatSats(-1)).toBe('-1 sat');
        expect(formatSats(2_100_000_000_000_000)).toBe('2,100,000,000,000,000 sats');
    });

    it('rejects fractions of a sat', () => {
        expect(() => formatSats(1.5)).toThrow(RangeError);
        expect(() => formatSats(Number.NaN)).toThrow(RangeError);
    });
});

describe('formatBtc', () => {
    it('always shows eight decimals, exactly', () => {
        expect(formatBtc(0)).toBe('0.00000000 BTC');
        expect(formatBtc(1)).toBe('0.00000001 BTC');
        expect(formatBtc(123_456_789)).toBe('1.23456789 BTC');
        expect(formatBtc(2_100_000_000_000_000)).toBe('21,000,000.00000000 BTC');
    });

    it('keeps the sign on negative amounts', () => {
        expect(formatBtc(-50_000_000)).toBe('-0.50000000 BTC');
    });

    it('rejects fractions of a sat', () => {
        expect(() => formatBtc(0.1)).toThrow(RangeError);
    });
});

describe('formatFiat', () => {
    it('formats pounds and dollars with two decimals', () => {
        expect(formatFiat(1000, 'GBP')).toBe('£1,000.00');
        expect(formatFiat(1234.565, 'USD')).toBe('$1,234.57');
        expect(formatFiat(0.5, 'GBP')).toBe('£0.50');
    });

    it('rejects non-finite amounts', () => {
        expect(() => formatFiat(Number.POSITIVE_INFINITY, 'GBP')).toThrow(RangeError);
    });
});
