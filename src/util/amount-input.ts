export interface FieldText {
    text: string;
    caret: number;
}

export type DeleteDirection = 'backward' | 'forward';

const SEPARATOR = ',';

function isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
}

function groupThousands(digits: string): string {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR);
}

export function parseAmount(text: string): number | null {
    const plain = text.replaceAll(SEPARATOR, '').trim();
    if (!/^(\d+\.?\d*|\.\d+)$/.test(plain)) return null;
    const value = Number(plain);
    return Number.isFinite(value) ? value : null;
}

export function formatAmountInput(raw: string, caret: number, maxDecimals: number): FieldText {
    let kept = '';
    let keptBeforeCaret = 0;
    for (let i = 0; i < raw.length; i += 1) {
        const char = raw.charAt(i);
        const allowed = isDigit(char) || (char === '.' && maxDecimals > 0 && !kept.includes('.'));
        if (!allowed) continue;
        kept += char;
        if (i < caret) keptBeforeCaret += 1;
    }

    const dot = kept.indexOf('.');
    const rawInteger = dot === -1 ? kept : kept.slice(0, dot);
    const rawFraction = dot === -1 ? null : kept.slice(dot + 1);

    const zeros = rawInteger.length - rawInteger.replace(/^0+/, '').length;
    let integer = rawInteger.slice(zeros);
    let significantBeforeCaret = keptBeforeCaret - Math.min(zeros, keptBeforeCaret);
    if (integer === '' && (zeros > 0 || rawFraction !== null)) {
        integer = '0';
        if (keptBeforeCaret > 0) significantBeforeCaret += 1;
    }

    const fraction = rawFraction === null ? null : rawFraction.slice(0, maxDecimals);
    const significant = integer.length + (fraction === null ? 0 : fraction.length + 1);
    significantBeforeCaret = Math.min(significantBeforeCaret, significant);

    const text = groupThousands(integer) + (fraction === null ? '' : `.${fraction}`);
    return { text, caret: caretAfter(text, significantBeforeCaret) };
}

function caretAfter(text: string, significant: number): number {
    if (significant === 0) return 0;
    let seen = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text.charAt(i) !== SEPARATOR) seen += 1;
        if (seen === significant) return i + 1;
    }
    return text.length;
}

export function deleteAcrossSeparator(text: string, caret: number, direction: DeleteDirection): FieldText | null {
    if (direction === 'backward') {
        if (caret < 2 || text.charAt(caret - 1) !== SEPARATOR) return null;
        return { text: text.slice(0, caret - 2) + text.slice(caret), caret: caret - 2 };
    }
    if (text.charAt(caret) !== SEPARATOR) return null;
    return { text: text.slice(0, caret) + text.slice(caret + 2), caret };
}
