import { describe, expect, it } from 'vitest';
import {
    formatAmount,
    formatBtc,
    formatBtcAmount,
    formatFiat,
    formatMoney,
    formatPercent,
    formatSats,
} from './format.ts';

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

describe('formatMoney', () => {
    it('rounds to whole units from 100 up and keeps pence below', () => {
        expect(formatMoney(1435.5, 'GBP')).toBe('£1,436');
        expect(formatMoney(100, 'USD')).toBe('$100');
        expect(formatMoney(69.574, 'GBP')).toBe('£69.57');
        expect(formatMoney(0.004, 'USD')).toBe('$0.00');
    });

    it('names millions, billions and trillions with three significant digits', () => {
        expect(formatMoney(1_234_567, 'GBP')).toBe('£1.23 million');
        expect(formatMoney(987_654_321, 'USD')).toBe('$988 million');
        expect(formatMoney(1_134_000_000, 'GBP')).toBe('£1.13 billion');
        expect(formatMoney(2.5e12, 'USD')).toBe('$2.5 trillion');
    });
});

describe('formatAmount', () => {
    it('shows a whole amount without pence and a fractional one with two decimals', () => {
        expect(formatAmount(1000, 'GBP')).toBe('£1,000');
        expect(formatAmount(1234.5, 'USD')).toBe('$1,234.50');
    });
});

describe('formatBtcAmount', () => {
    it('shows eight decimals below 1,000 BTC and whole coins above', () => {
        expect(formatBtcAmount(0.0119646)).toBe('0.01196460 BTC');
        expect(formatBtcAmount(14_804.7)).toBe('14,805 BTC');
    });
});

describe('formatPercent', () => {
    it('rounds to a whole percent', () => {
        expect(formatPercent(0.7749)).toBe('77%');
        expect(formatPercent(0)).toBe('0%');
    });
});
