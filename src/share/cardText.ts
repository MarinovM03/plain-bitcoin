import type { PriceQuote } from '../data/price.ts';
import type { Address } from '../model/address.ts';
import { btcText, type Conversion, type Unit } from '../model/convert.ts';
import type { DcaResult } from '../model/dca.ts';
import type { PowerResult } from '../model/power.ts';
import type { Supply } from '../model/supply.ts';
import { ADDRESS, CONVERT, DCA, LEFT_PAGE, POWER } from '../ui/copy.ts';
import {
    type Fiat,
    formatAmount,
    formatBtcAmount,
    formatBtcExact,
    formatDay,
    formatFiatPrecise,
    formatMoney,
    formatPercent,
    formatSats,
    formatShortDay,
    formatUtcStamp,
    formatWhole,
    isoDayMs,
} from '../util/format.ts';
import { monthKeyLabel } from '../util/month.ts';
import type { ShareCard } from './index.ts';

export function cardFileName(tool: string, date: string): string {
    return `plain-bitcoin-${tool}-${date}.png`;
}

function utcDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

export interface PowerText {
    headline: string;
    bitcoin: string;
    asOf: string;
    cashValue: string;
    cashNote: string;
    bitcoinValue: string;
    bitcoinNote: string;
    path: string;
    card: ShareCard;
}

function pathLine(result: PowerResult, currency: Fiat, amount: string): string {
    if (result.worst === null) return POWER.noPath;
    const money = (value: number) => formatMoney(value, currency);
    const { fall, worst } = result;
    const fallLine =
        fall === null || formatPercent(result.maxDrawdown) === '0%'
            ? POWER.pathNoFall
            : POWER.pathFall(
                  formatPercent(result.maxDrawdown),
                  money(fall.peak.value),
                  monthKeyLabel(fall.peak.month),
                  money(fall.trough.value),
                  monthKeyLabel(fall.trough.month),
              );
    const belowLine =
        result.monthsBelow === 0
            ? POWER.pathNeverBelow(amount)
            : POWER.pathBelow(result.monthsBelow, amount, money(worst.value), monthKeyLabel(worst.month));
    return `${fallLine} ${belowLine}`;
}

export function powerText(result: PowerResult, currency: Fiat, site: string): PowerText {
    const amount = formatAmount(result.amount, currency);
    const headline = POWER.headline(amount, monthKeyLabel(result.start), formatMoney(result.equivalentNow, currency));
    const bitcoinValue = formatMoney(result.btcValueNow, currency);
    const fall = formatPercent(result.maxDrawdown);
    const detail = fall === '0%' ? POWER.cardDetail(bitcoinValue) : POWER.cardDetailFall(bitcoinValue, fall);
    return {
        headline,
        bitcoin: POWER.bitcoin(bitcoinValue, formatBtcAmount(result.btc)),
        asOf: POWER.asOf(monthKeyLabel(result.priceMonth)),
        cashValue: amount,
        cashNote: POWER.buysThen(formatMoney(result.cashBuysNow, currency)),
        bitcoinValue,
        bitcoinNote: POWER.buysThen(formatMoney(result.btcRealNow, currency)),
        path: pathLine(result, currency, amount),
        card: {
            headline,
            detail,
            source: POWER.cardSource(
                POWER.cpiShort[currency],
                monthKeyLabel(result.cpiMonth, 'short'),
                monthKeyLabel(result.priceMonth, 'short'),
            ),
            alt: `${headline} ${detail}`,
            copy: `${headline} ${detail}\n${site}`,
            fileName: cardFileName('power', result.priceMonth),
        },
    };
}

export function priceLabel(quote: PriceQuote): string {
    if (quote.source === 'last close') return CONVERT.lastClose(formatShortDay(quote.asOf));
    const stamp = formatUtcStamp(quote.asOf);
    return quote.stale ? CONVERT.notUpdating(quote.source, stamp) : CONVERT.live(quote.source, stamp);
}

export interface ConvertText {
    headline: string;
    detail: string;
    card: ShareCard;
}

export function convertText(unit: Unit, conversion: Conversion, quote: PriceQuote, site: string): ConvertText {
    const { sats, fiat } = conversion;
    const words: Record<Unit, string> = {
        sats: formatSats(sats),
        btc: `${btcText(sats)} BTC`,
        gbp: formatFiatPrecise(fiat.gbp, 'GBP'),
        usd: formatFiatPrecise(fiat.usd, 'USD'),
    };
    const target: Unit = unit === 'gbp' || unit === 'usd' ? 'sats' : 'gbp';
    const [first = '', second = ''] = (['sats', 'btc', 'gbp', 'usd'] as const)
        .filter((other) => other !== unit && other !== target)
        .map((other) => words[other]);
    const headline = CONVERT.headline(words[unit], words[target]);
    const detail = CONVERT.detail(first, second);
    return {
        headline,
        detail,
        card: {
            headline,
            detail,
            source: CONVERT.cardSource(priceLabel(quote)),
            alt: `${headline}. ${detail}`,
            copy: `${headline}. ${detail}\n${site}`,
            fileName: cardFileName('converter', utcDay(quote.asOf)),
        },
    };
}

export interface DcaText {
    headline: string;
    detail: string;
    asOf: string;
    rows: Record<keyof typeof DCA.rows, string>;
    notes: string[];
    chartAlt: string;
    card: ShareCard;
}

function fallPercent(result: DcaResult): string | null {
    const percent = formatPercent(result.drawdown);
    return result.fall === null || percent === '0%' ? null : percent;
}

export function dcaText(result: DcaResult, currency: Fiat, site: string): DcaText {
    const money = (value: number) => formatMoney(value, currency);
    const day = (iso: string) => formatDay(isoDayMs(iso));
    const shortDay = (iso: string) => formatShortDay(isoDayMs(iso));
    const amount = formatAmount(result.amount, currency);
    const invested = money(result.invested);
    const worth = money(result.valueNow);
    const lump = money(result.lumpSum.valueNow);
    const buys = DCA.buys(result.buys);
    const headline = DCA.headline(
        amount,
        DCA.every[result.frequency],
        monthKeyLabel(result.start.slice(0, 7), 'short'),
        worth,
        lump,
    );
    const fall = fallPercent(result);
    const percent = `${result.feePercent}%`;
    const fees = result.feePercent > 0 ? DCA.feesPaid(percent, money(result.fees)) : DCA.feesNone;
    const notes = [fees, ...(result.clamped ? [DCA.clamped(day(result.start))] : []), DCA.lumpNote];
    const detail = fall === null ? DCA.cardDetailNoFall(invested, buys) : DCA.cardDetail(invested, buys, fall);
    return {
        headline,
        detail: DCA.detail(invested, buys, formatBtcExact(result.sats)),
        asOf: DCA.asOf(day(result.end)),
        rows: {
            invested,
            bought: formatBtcExact(result.sats),
            worth,
            average: DCA.perBtc(money(result.averageCost)),
            buys: DCA.buysRange(buys, shortDay(result.start), shortDay(result.lastBuy)),
            fall:
                fall === null || result.fall === null
                    ? DCA.noFall
                    : DCA.fall(
                          fall,
                          money(result.fall.peak.value),
                          shortDay(result.fall.peak.day),
                          money(result.fall.trough.value),
                          shortDay(result.fall.trough.day),
                      ),
            lump: DCA.lump(lump, formatBtcExact(result.lumpSum.sats), shortDay(result.start)),
        },
        notes,
        chartAlt: DCA.chartAlt(worth, invested, lump),
        card: {
            headline,
            detail,
            source: DCA.cardSource(
                shortDay(result.end),
                result.feePercent > 0 ? DCA.cardFees(percent) : DCA.cardNoFees,
            ),
            alt: `${headline} ${detail}`,
            copy: `${headline} ${detail}\n${site}`,
            fileName: cardFileName('dca', result.end),
        },
    };
}

export function leftCard(supply: Supply, api: string, checkedAt: number, site: string): ShareCard {
    const headline = LEFT_PAGE.cardHeadline(formatBtcExact(supply.left), formatWhole(supply.height));
    const detail = LEFT_PAGE.cardDetail(formatBtcExact(supply.issued), formatWhole(supply.nextHalving));
    return {
        headline,
        detail,
        source: LEFT_PAGE.cardSource(api, formatUtcStamp(checkedAt)),
        alt: `${headline} ${detail}`,
        copy: `${headline} ${detail}
${site}`,
        fileName: cardFileName('left', utcDay(checkedAt)),
    };
}

export interface AddressText {
    headline: string;
    detail: string;
    card: ShareCard;
}

function groupsOfFour(text: string): string {
    return text.match(/.{1,4}/g)?.join(' ') ?? text;
}

export function addressText(address: Address, showAddress: boolean, checkedAt: number, site: string): AddressText {
    const headline = ADDRESS.headline(ADDRESS.types[address.type]);
    const detail = ADDRESS.detail(ADDRESS.networks[address.network], ADDRESS.encodings[address.encoding]);
    const cardDetail = showAddress ? groupsOfFour(address.text) : detail;
    return {
        headline,
        detail,
        card: {
            headline,
            detail: cardDetail,
            source: ADDRESS.cardSource(ADDRESS.specs[address.encoding]),
            alt: `${headline} ${cardDetail}`,
            copy: showAddress ? `${headline}\n${address.text}\n${site}` : `${headline} ${detail}\n${site}`,
            fileName: cardFileName('address', utcDay(checkedAt)),
        },
    };
}
