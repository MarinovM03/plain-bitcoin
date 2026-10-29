export type Fiat = 'GBP' | 'USD';

const SATS_PER_BTC = 100_000_000;

const FIAT_LOCALE: Record<Fiat, string> = { GBP: 'en-GB', USD: 'en-US' };

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

function assertSats(sats: number): void {
    if (!Number.isSafeInteger(sats)) throw new RangeError(`Sats must be a safe integer, got ${sats}`);
}

export function formatSats(sats: number): string {
    assertSats(sats);
    return `${whole.format(sats)} ${Math.abs(sats) === 1 ? 'sat' : 'sats'}`;
}

export function formatBtc(sats: number): string {
    assertSats(sats);
    const sign = sats < 0 ? '-' : '';
    const abs = Math.abs(sats);
    const coins = whole.format(Math.trunc(abs / SATS_PER_BTC));
    const fraction = String(abs % SATS_PER_BTC).padStart(8, '0');
    return `${sign}${coins}.${fraction} BTC`;
}

export function formatFiat(amount: number, currency: Fiat): string {
    if (!Number.isFinite(amount)) throw new RangeError(`Amount must be finite, got ${amount}`);
    return new Intl.NumberFormat(FIAT_LOCALE[currency], {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

const LARGE = [
    { at: 1e12, word: 'trillion' },
    { at: 1e9, word: 'billion' },
    { at: 1e6, word: 'million' },
] as const;

function fiatFormat(currency: Fiat, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    return new Intl.NumberFormat(FIAT_LOCALE[currency], { style: 'currency', currency, ...options });
}

export function formatMoney(amount: number, currency: Fiat): string {
    if (!Number.isFinite(amount)) throw new RangeError(`Amount must be finite, got ${amount}`);
    const abs = Math.abs(amount);
    const large = LARGE.find(({ at }) => abs >= at);
    if (large)
        return `${fiatFormat(currency, { maximumSignificantDigits: 3 }).format(amount / large.at)} ${large.word}`;
    if (abs >= 100) return fiatFormat(currency, { maximumFractionDigits: 0 }).format(amount);
    return formatFiat(amount, currency);
}

export function formatAmount(amount: number, currency: Fiat): string {
    if (Number.isInteger(amount)) return fiatFormat(currency, { maximumFractionDigits: 0 }).format(amount);
    return formatFiat(amount, currency);
}

export function formatBtcAmount(btc: number): string {
    const sats = Math.round(btc * SATS_PER_BTC);
    if (btc < 1000 && Number.isSafeInteger(sats)) return formatBtc(sats);
    return `${whole.format(btc)} BTC`;
}

export function formatPercent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`;
}

export function formatWhole(value: number): string {
    return whole.format(Math.round(value));
}
