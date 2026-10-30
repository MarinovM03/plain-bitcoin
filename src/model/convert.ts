export const SATS_PER_BTC = 100_000_000;

export const MAX_SATS = 21_000_000 * SATS_PER_BTC;

export type Unit = 'sats' | 'btc' | 'gbp' | 'usd';

export type FiatUnit = Exclude<Unit, 'sats' | 'btc'>;

export interface Prices {
    gbp: number;
    usd: number;
}

export type ParseFailure = 'empty' | 'invalid' | 'too-small' | 'too-big';

export type Parsed = { ok: true; value: number } | { ok: false; reason: ParseFailure };

const GAPS = /[\s,  ]/g;

function plainNumber(text: string): { integer: string; fraction: string } | null {
    const plain = text.replace(GAPS, '');
    const match = /^(\d*)(?:\.(\d*))?$/.exec(plain);
    if (!match || plain === '.' || plain === '') return null;
    return { integer: (match[1] ?? '').replace(/^0+(?=\d)/, ''), fraction: match[2] ?? '' };
}

function parse(text: string, decimals: number, toUnits: (integer: string, fraction: string) => number): Parsed {
    if (text.replace(GAPS, '') === '') return { ok: false, reason: 'empty' };
    const number = plainNumber(text);
    if (!number) return { ok: false, reason: 'invalid' };
    const fraction = number.fraction.replace(/0+$/, '');
    if (fraction.length > decimals) return { ok: false, reason: 'too-small' };
    if (number.integer.length > 16) return { ok: false, reason: 'too-big' };
    return { ok: true, value: toUnits(number.integer || '0', fraction.padEnd(decimals, '0')) };
}

function capped(parsed: Parsed): Parsed {
    return parsed.ok && parsed.value > MAX_SATS ? { ok: false, reason: 'too-big' } : parsed;
}

export function parseBtc(text: string): Parsed {
    return capped(parse(text, 8, (integer, fraction) => Number(integer) * SATS_PER_BTC + Number(fraction)));
}

export function parseSats(text: string): Parsed {
    return capped(parse(text, 0, (integer) => Number(integer)));
}

export function parseCents(text: string): Parsed {
    return parse(text, 2, (integer, fraction) => Number(integer) * 100 + Number(fraction));
}

export function centsToSats(cents: number, price: number): number {
    return Math.round((cents * (SATS_PER_BTC / 100)) / price);
}

export function satsToFiat(sats: number, price: number): number {
    return (sats * price) / SATS_PER_BTC;
}

export function parseToSats(unit: Unit, text: string, prices: Prices): Parsed {
    if (unit === 'sats') return parseSats(text);
    if (unit === 'btc') return parseBtc(text);
    const cents = parseCents(text);
    if (!cents.ok) return cents;
    const sats = centsToSats(cents.value, prices[unit]);
    if (sats > MAX_SATS) return { ok: false, reason: 'too-big' };
    if (sats === 0 && cents.value > 0) return { ok: false, reason: 'too-small' };
    return { ok: true, value: sats };
}

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

export function satsText(sats: number): string {
    return grouped.format(sats);
}

export function btcText(sats: number): string {
    const fraction = String(sats % SATS_PER_BTC)
        .padStart(8, '0')
        .replace(/0+$/, '');
    return `${grouped.format(Math.trunc(sats / SATS_PER_BTC))}${fraction ? `.${fraction}` : ''}`;
}

const cents = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fiatText(value: number): string {
    if (value > 0 && value < 0.01) return String(Number(value.toPrecision(2)));
    return cents.format(value);
}

export interface Conversion {
    sats: number;
    fields: Record<Unit, string>;
    fiat: Prices;
}

export function convert(sats: number, prices: Prices): Conversion {
    const fiat = { gbp: satsToFiat(sats, prices.gbp), usd: satsToFiat(sats, prices.usd) };
    return {
        sats,
        fiat,
        fields: { sats: satsText(sats), btc: btcText(sats), gbp: fiatText(fiat.gbp), usd: fiatText(fiat.usd) },
    };
}

const PASTE_UNIT = /\s*(btc|sats?|gbp|usd)$/i;

export function pasteFits(text: string, decimals: number): boolean {
    const stripped = text
        .trim()
        .replace(PASTE_UNIT, '')
        .replace(/^[£$₿]\s*/, '');
    const number = plainNumber(stripped);
    return number !== null && number.fraction.replace(/0+$/, '').length <= decimals;
}
