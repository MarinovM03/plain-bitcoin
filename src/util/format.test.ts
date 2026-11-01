import { describe, expect, it } from 'vitest';
import {
    btcParts,
    formatAge,
    formatAmount,
    formatBtc,
    formatBtcAmount,
    formatBtcExact,
    formatDay,
    formatFiat,
    formatMinutes,
    formatMoney,
    formatPercent,
    formatPpm,
    formatSats,
    formatUtcStamp,
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

describe('exact bitcoin', () => {
    it('splits whole coins from the fraction and drops trailing zeros', () => {
        expect(btcParts(89_420_310_190_000)).toEqual({ whole: '894,203', fraction: '1019' });
        expect(btcParts(5_000_000_000)).toEqual({ whole: '50', fraction: '' });
        expect(formatBtcExact(312_500_000)).toBe('3.125 BTC');
        expect(formatBtcExact(2_099_999_997_690_000)).toBe('20,999,999.9769 BTC');
        expect(formatBtcExact(1)).toBe('0.00000001 BTC');
    });

    it('rejects negative or fractional sats', () => {
        expect(() => btcParts(-1)).toThrow(RangeError);
        expect(() => btcParts(0.5)).toThrow(RangeError);
    });
});

describe('formatPpm', () => {
    it('shows parts per million as a percent with four decimals', () => {
        expect(formatPpm(957_418)).toBe('95.7418%');
        expect(formatPpm(5)).toBe('0.0005%');
        expect(formatPpm(1_000_000)).toBe('100.0000%');
    });
});

describe('time', () => {
    it('says how long ago in plain units', () => {
        expect(formatAge(0)).toBe('0 s');
        expect(formatAge(-5)).toBe('0 s');
        expect(formatAge(252)).toBe('4 min 12 s');
        expect(formatAge(3_780)).toBe('1 h 3 min');
    });

    it('rounds the time since a block down to whole minutes', () => {
        expect(formatMinutes(-20)).toBe('<1 min');
        expect(formatMinutes(59)).toBe('<1 min');
        expect(formatMinutes(372)).toBe('6 min');
        expect(formatMinutes(3_780)).toBe('1 h 3 min');
    });

    it('formats days and UTC stamps', () => {
        const ms = Date.UTC(2028, 3, 9, 7, 5);
        expect(formatDay(ms)).toBe('9 April 2028');
        expect(formatUtcStamp(ms)).toBe('9 Apr 2028, 07:05 UTC');
    });
});
