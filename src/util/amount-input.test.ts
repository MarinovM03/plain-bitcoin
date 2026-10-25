import { describe, expect, it } from 'vitest';
import { deleteAcrossSeparator, formatAmountInput, parseAmount } from './amount-input.ts';

function typed(withCaret: string, maxDecimals = 2): string {
    const caret = withCaret.indexOf('|');
    const { text, caret: next } = formatAmountInput(withCaret.replace('|', ''), caret, maxDecimals);
    return `${text.slice(0, next)}|${text.slice(next)}`;
}

describe('parseAmount', () => {
    it('reads grouped and plain decimals', () => {
        expect(parseAmount('1,234.5')).toBe(1234.5);
        expect(parseAmount('0.00000001')).toBe(0.00000001);
        expect(parseAmount('12.')).toBe(12);
        expect(parseAmount('.5')).toBe(0.5);
    });

    it('rejects empty and malformed text', () => {
        for (const text of ['', ' ', '.', '1.2.3', '-5', '1e3', 'abc', '£10']) expect(parseAmount(text)).toBeNull();
    });
});

describe('formatAmountInput', () => {
    it('groups thousands as you type and keeps the caret after the typed digit', () => {
        expect(typed('1234|')).toBe('1,234|');
        expect(typed('1,2345|')).toBe('12,345|');
        expect(typed('12|,345')).toBe('12|,345');
        expect(typed('1,0|0,000')).toBe('10|0,000');
    });

    it('keeps the caret in place when a digit is inserted mid-number', () => {
        expect(typed('1,29|34')).toBe('12,9|34');
        expect(typed('9|1,234')).toBe('9|1,234');
    });

    it('drops anything that is not a digit or the first decimal point', () => {
        expect(typed('£1a2|')).toBe('12|');
        expect(typed('1.2.3|')).toBe('1.23|');
        expect(typed('1 000|')).toBe('1,000|');
    });

    it('limits decimals to the unit', () => {
        expect(typed('1.239|')).toBe('1.23|');
        expect(typed('0.123456789|', 8)).toBe('0.12345678|');
        expect(typed('12.5|', 0)).toBe('125|');
    });

    it('trims leading zeros and keeps a lone zero before the point', () => {
        expect(typed('007|')).toBe('7|');
        expect(typed('0|')).toBe('0|');
        expect(typed('.|')).toBe('0.|');
        expect(typed('.5|')).toBe('0.5|');
        expect(typed('0|1,234')).toBe('|1,234');
    });

    it('re-groups after a delete', () => {
        expect(typed('1,23|')).toBe('123|');
        expect(typed('|,234')).toBe('|234');
    });

    it('handles an empty field', () => {
        expect(formatAmountInput('', 0, 2)).toEqual({ text: '', caret: 0 });
    });
});

describe('deleteAcrossSeparator', () => {
    it('removes the digit on the far side of a separator', () => {
        expect(deleteAcrossSeparator('1,234', 2, 'backward')).toEqual({ text: '234', caret: 0 });
        expect(deleteAcrossSeparator('12,345,678', 2, 'forward')).toEqual({ text: '1245,678', caret: 2 });
    });

    it('leaves ordinary deletes to the browser', () => {
        expect(deleteAcrossSeparator('1,234', 3, 'backward')).toBeNull();
        expect(deleteAcrossSeparator('1,234', 3, 'forward')).toBeNull();
        expect(deleteAcrossSeparator(',1', 1, 'backward')).toBeNull();
    });
});
