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
