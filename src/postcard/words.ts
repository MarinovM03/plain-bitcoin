import type { PriceQuote } from '../data/price.ts';
import type { DcaMarks } from '../gauges/types.ts';
import type { Address } from '../model/address.ts';
import { btcText, type Conversion, type Unit } from '../model/convert.ts';
import type { DcaResult } from '../model/dca.ts';
import type { PowerResult } from '../model/power.ts';
import { MAX_SUPPLY, SATS_PER_BTC, type Supply } from '../model/supply.ts';
import { ADDRESS, CONVERT, DCA, HOME, POSTCARD, POWER, SHARE } from '../ui/copy.ts';
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
import type { Postcard, PostcardTool } from './types.ts';

export const COMPOSE_LIMIT = 200;

/** plain-bitcoin-<tool>-<yyyy-mm-dd>.png, dated the day it was printed (UTC). */
export function postcardFileName(tool: PostcardTool, printedAt: number): string {
    return `plain-bitcoin-${tool}-${new Date(printedAt).toISOString().slice(0, 10)}.png`;
}

/**
 * The words that go with the image on X: the line of truth, the link back to this gauge and the handle. Never more
 * than 200 characters; a line that would overflow is cut at a word, never mid-number.
 */
export function composeText(postcard: Pick<Postcard, 'line' | 'route'>, site: string): string {
    const tail = ` ${site}/#/${postcard.route} ${SHARE.via}`;
    const room = COMPOSE_LIMIT - tail.length;
    let line = postcard.line;
    if (line.length > room) {
        const cut = line.slice(0, room - 1);
        line = `${cut.slice(0, Math.max(0, cut.lastIndexOf(' ')))}…`;
    }
    return `${line}${tail}`;
}

/** A typed address is never printed in full: its first and last four characters only. */
export function maskAddress(text: string): string {
    return text.length <= 10 ? text : `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function card(parts: Omit<Postcard, 'alt'>): Postcard {
    return { ...parts, alt: `${parts.number}. ${parts.line} ${parts.source}` };
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
    postcard: Postcard;
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

export function powerText(result: PowerResult, currency: Fiat): PowerText {
    const amount = formatAmount(result.amount, currency);
    const worth = formatMoney(result.equivalentNow, currency);
    const headline = POWER.headline(amount, monthKeyLabel(result.start), worth);
    const bitcoinValue = formatMoney(result.btcValueNow, currency);
    return {
        headline,
        bitcoin: POWER.bitcoin(bitcoinValue, formatBtcAmount(result.btc)),
        asOf: POWER.asOf(monthKeyLabel(result.priceMonth)),
        cashValue: amount,
        cashNote: POWER.buysThen(formatMoney(result.cashBuysNow, currency)),
        bitcoinValue,
        bitcoinNote: POWER.buysThen(formatMoney(result.btcRealNow, currency)),
        path: pathLine(result, currency, amount),
        postcard: card({
            tool: 'power',
            route: 'power',
            kicker: POSTCARD.power.kicker(monthKeyLabel(result.priceMonth, 'short')),
            number: worth,
            line: POSTCARD.power.line(headline, bitcoinValue),
            source: POSTCARD.power.source(
                POWER.cpiShort[currency],
                monthKeyLabel(result.cpiMonth, 'short'),
                monthKeyLabel(result.priceMonth, 'short'),
            ),
            signature: {
                kind: 'columns',
                cash: result.amount,
                bitcoin: result.btcValueNow,
                cashLabel: amount,
                bitcoinLabel: bitcoinValue,
            },
        }),
    };
}

export function priceLabel(quote: PriceQuote): string {
    if (quote.source === 'last close') return CONVERT.lastClose(formatShortDay(quote.asOf));
    const stamp = formatUtcStamp(quote.asOf);
    return quote.stale ? CONVERT.notUpdating(quote.source, stamp) : CONVERT.live(quote.source, stamp);
}

export interface ConvertText {
    headline: string;
    figure: string;
    detail: string;
    postcard: Postcard;
}

export function convertText(unit: Unit, conversion: Conversion, quote: PriceQuote): ConvertText {
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
    return {
        headline,
        figure: words[target],
        detail: CONVERT.detail(first, second),
        postcard: card({
            tool: 'convert',
            route: 'convert',
            kicker: POSTCARD.convert.kicker(words[unit]),
            number: words[target],
            line: `${headline}.`,
            source: POSTCARD.convert.source(priceLabel(quote)),
            signature: { kind: 'cells', sats },
        }),
    };
}

export interface DcaText {
    headline: string;
    detail: string;
    asOf: string;
    rows: Record<keyof typeof DCA.rows, string>;
    notes: string[];
    chartAlt: string;
    postcard: Postcard;
}

function fallPercent(result: DcaResult): string | null {
    const percent = formatPercent(result.drawdown);
    return result.fall === null || percent === '0%' ? null : percent;
}

export function dcaText(result: DcaResult, currency: Fiat, marks: DcaMarks): DcaText {
    const money = (value: number) => formatMoney(value, currency);
    const day = (iso: string) => formatDay(isoDayMs(iso));
    const shortDay = (iso: string) => formatShortDay(isoDayMs(iso));
    const amount = formatAmount(result.amount, currency);
    const invested = money(result.invested);
    const worth = money(result.valueNow);
    const lump = money(result.lumpSum.valueNow);
    const buys = DCA.buys(result.buys);
    const since = monthKeyLabel(result.start.slice(0, 7), 'short');
    const headline = DCA.headline(amount, DCA.every[result.frequency], since, worth, lump);
    const fall = fallPercent(result);
    const percent = `${result.feePercent}%`;
    const fees = result.feePercent > 0 ? DCA.feesPaid(percent, money(result.fees)) : DCA.feesNone;
    const notes = [fees, ...(result.clamped ? [DCA.clamped(day(result.start))] : []), DCA.lumpNote];
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
        postcard: card({
            tool: 'dca',
            route: 'dca',
            kicker: POSTCARD.dca.kicker(shortDay(result.end)),
            number: worth,
            line: POSTCARD.dca.line(amount, DCA.every[result.frequency], since, worth, lump),
            source: POSTCARD.dca.source(
                shortDay(result.end),
                result.feePercent > 0 ? POSTCARD.dca.fees(percent) : POSTCARD.dca.noFees,
            ),
            signature: { kind: 'lines', ...marks },
        }),
    };
}

export interface LeftReading {
    supply: Supply;
    /** The API that answered, or null for an estimate from the schedule. */
    api: string | null;
    checkedAt: number;
}

export function leftPostcard({ supply, api, checkedAt }: LeftReading): Postcard {
    const height = `${formatWhole(supply.height)}${api ? '' : POSTCARD.estimated}`;
    return card({
        tool: 'left',
        route: 'left',
        kicker: POSTCARD.left.kicker(height),
        number: formatBtcExact(supply.left),
        line: POSTCARD.left.line(formatWhole(Math.floor(supply.left / SATS_PER_BTC))),
        source: api ? POSTCARD.left.source(height, api, formatUtcStamp(checkedAt)) : POSTCARD.left.estimate(height),
        signature: { kind: 'supply', issued: supply.issued, max: MAX_SUPPLY },
    });
}

export function homePostcard(reading: LeftReading): Postcard {
    const { supply, api, checkedAt } = reading;
    const height = `${formatWhole(supply.height)}${api ? '' : POSTCARD.estimated}`;
    return card({
        tool: 'home',
        route: '',
        kicker: POSTCARD.home.kicker,
        number: height,
        line: HOME.postcardLine(formatWhole(Math.floor(supply.issued / SATS_PER_BTC))),
        source: api ? POSTCARD.left.source(height, api, formatUtcStamp(checkedAt)) : POSTCARD.left.estimate(height),
        signature: { kind: 'supply', issued: supply.issued, max: MAX_SUPPLY },
    });
}

export interface AddressText {
    headline: string;
    detail: string;
    postcard: Postcard;
}

export function addressText(address: Address, sample: boolean): AddressText {
    const headline = ADDRESS.headline(ADDRESS.types[address.type]);
    const detail = ADDRESS.detail(ADDRESS.networks[address.network], ADDRESS.encodings[address.encoding]);
    const figure = ADDRESS.figures[address.type];
    return {
        headline,
        detail,
        postcard: card({
            tool: 'address',
            route: 'address',
            kicker: POSTCARD.address.kicker(ADDRESS.encodings[address.encoding]),
            number: figure,
            line: POSTCARD.address.line(figure, ADDRESS.networks[address.network]),
            source: ADDRESS.cardSource(ADDRESS.specs[address.encoding]),
            signature: {
                kind: 'stamp',
                type: figure,
                encoding: ADDRESS.encodings[address.encoding],
                shown: sample ? address.text : maskAddress(address.text),
            },
        }),
    };
}
