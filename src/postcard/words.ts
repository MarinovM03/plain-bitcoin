import type { PriceQuote } from '../data/price.ts';
import type { DcaMarks } from '../gauges/types.ts';
import type { Address } from '../model/address.ts';
import { btcText, type Conversion, type FiatUnit, type Unit } from '../model/convert.ts';
import type { DcaResult } from '../model/dca.ts';
import type { FeeCost, PaymentType } from '../model/fees.ts';
import type { HalvingClock } from '../model/halving.ts';
import {
    baseline,
    type Change,
    change,
    type Holding,
    type HoldingFiat,
    priceIn,
    type ValueSeries,
    worth,
} from '../model/holding.ts';
import type { PowerResult } from '../model/power.ts';
import { MAX_SUPPLY, SATS_PER_BTC, type Supply, supplyAt } from '../model/supply.ts';
import { maskTxid } from '../model/tx.ts';
import { ADDRESS, CONVERT, DCA, FEES, POWER, SHARE, STACK } from '../ui/copy.ts';
import { POSTCARD } from '../ui/copy-postcard.ts';
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
    const tail = ` ${site}/${postcard.route} ${SHARE.via}`;
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

/** The answer in words. `currency` is the money picked on the page; without a euro price it falls back to dollars. */
export function convertText(unit: Unit, conversion: Conversion, quote: PriceQuote, currency: FiatUnit): ConvertText {
    const { sats, fiat } = conversion;
    const money: FiatUnit = currency === 'eur' && fiat.eur === null ? 'usd' : currency;
    const words: Record<Unit, string> = {
        sats: formatSats(sats),
        btc: `${btcText(sats)} BTC`,
        gbp: formatFiatPrecise(fiat.gbp, 'GBP'),
        usd: formatFiatPrecise(fiat.usd, 'USD'),
        eur: fiat.eur === null ? '' : formatFiatPrecise(fiat.eur, 'EUR'),
    };
    const typedMoney = unit !== 'sats' && unit !== 'btc';
    const target: Unit = typedMoney ? 'sats' : money;
    const other: Unit = typedMoney ? 'btc' : unit === 'sats' ? 'btc' : 'sats';
    const headline = CONVERT.headline(words[unit], words[target]);
    return {
        headline,
        figure: words[target],
        detail: CONVERT.detail(words[other]),
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

export interface TodayReading {
    height: number;
    usd: number;
    /** What a usual payment costs for the next block, as the strip shows it, or null before the fee rates load. */
    fee: string | null;
    readAt: number;
}

/** The home strip as one postcard, made to post once a day. Only ever printed from live readings. */
export function todayPostcard({ height, usd, fee, readAt }: TodayReading): Postcard {
    const supply = supplyAt(height);
    return card({
        tool: 'home',
        route: '',
        kicker: POSTCARD.today.kicker(formatShortDay(readAt)),
        number: POSTCARD.today.number(formatMoney(usd, 'USD')),
        line: POSTCARD.today.line(
            formatWhole(height),
            fee,
            formatWhole(supply.blocksToHalving),
            formatWhole(Math.floor(supply.left / SATS_PER_BTC)),
        ),
        source: POSTCARD.today.source(formatUtcStamp(readAt)),
        signature: { kind: 'supply', issued: supply.issued, max: MAX_SUPPLY },
    });
}

export interface MinerReading {
    height: number;
    tries: number;
    best: number;
    needed: number;
    /** When the header was read live, or null for the saved one. */
    readAt: number | null;
    savedOn: string;
}

export function minerPostcard(reading: MinerReading): Postcard {
    const height = formatWhole(reading.height);
    const best = String(reading.best);
    const needed = String(reading.needed);
    return card({
        tool: 'miner',
        route: 'miner',
        kicker: POSTCARD.miner.kicker(height),
        number: POSTCARD.miner.number(best),
        line: POSTCARD.miner.line(formatWhole(reading.tries), height, best, needed),
        source:
            reading.readAt === null
                ? POSTCARD.miner.sourceSaved(reading.savedOn)
                : POSTCARD.miner.source(formatUtcStamp(reading.readAt)),
        signature: { kind: 'well', best: reading.best, needed: reading.needed },
    });
}

export interface HalvingReading {
    clock: HalvingClock;
    height: number;
    live: boolean;
    checkedAt: number;
}

export function halvingPostcard({ clock, height, live, checkedAt }: HalvingReading): Postcard {
    const at = `${formatWhole(height)}${live ? '' : POSTCARD.estimated}`;
    const blocks = formatWhole(clock.blocks);
    return card({
        tool: 'halving',
        route: 'halving',
        kicker: POSTCARD.halving.kicker(at),
        number: POSTCARD.halving.number(blocks),
        line: POSTCARD.halving.line(
            blocks,
            formatBtcExact(clock.reward),
            formatBtcExact(clock.nextReward),
            formatShortDay(clock.estimatedAt),
        ),
        source: live ? POSTCARD.halving.source(at, formatUtcStamp(checkedAt)) : POSTCARD.halving.estimate(at),
        signature: { kind: 'supply', issued: supplyAt(height).issued, max: MAX_SUPPLY },
    });
}

export interface TxReading {
    txid: string;
    rate: number;
    place: string;
    confirmedIn: number | null;
    confirmations: number;
    readAt: number;
    floors: readonly number[];
    slab: number | null;
}

export function txPostcard(reading: TxReading): Postcard {
    const rate = reading.rate.toLocaleString('en-GB', { maximumFractionDigits: 1 });
    return card({
        tool: 'tx',
        route: 'tx',
        kicker: POSTCARD.tx.kicker(maskTxid(reading.txid)),
        number: POSTCARD.tx.number(rate),
        line:
            reading.confirmedIn === null
                ? POSTCARD.tx.waiting(rate, reading.place)
                : POSTCARD.tx.confirmed(formatWhole(reading.confirmedIn), formatWhole(reading.confirmations)),
        source: POSTCARD.tx.source(formatUtcStamp(reading.readAt)),
        signature: {
            kind: 'queue',
            floors: [...reading.floors],
            slab: reading.confirmedIn === null ? reading.slab : 0,
        },
    });
}

export interface FeesReading {
    type: PaymentType;
    vbytes: number;
    costs: readonly FeeCost[];
    height: number;
    readAt: number;
}

export interface FeesText {
    figure: string;
    headline: string;
    detail: string;
    /** One line per wait for the table: rate, sats and money. */
    rows: { name: string; value: string; sats: number; line: string }[];
    postcard: Postcard;
}

function rateText(rate: number): string {
    return rate.toLocaleString('en-GB', { maximumFractionDigits: rate < 10 ? 2 : 0 });
}

export function feesText(reading: FeesReading): FeesText | null {
    const next = reading.costs[0];
    const last = reading.costs.at(-1);
    if (!next || !last) return null;
    const type = FEES.types[reading.type];
    const money = (cost: FeeCost) => (cost.money === null ? null : formatFiatPrecise(cost.money, 'USD'));
    const sats = (cost: FeeCost) => formatWhole(cost.sats);
    const nextMoney = money(next);
    const lastMoney = money(last);
    const rows = reading.costs.map((cost) => {
        const priced = money(cost);
        const value = priced === null ? `${sats(cost)} sats` : `${priced} · ${sats(cost)} sats`;
        return {
            name: FEES.speeds[cost.speed],
            value,
            sats: cost.sats,
            line: `${rateText(cost.rate)} sat/vB · ${value}`,
        };
    });
    const wait = lastMoney === null ? FEES.waitNoPrice(sats(last)) : FEES.wait(sats(last), lastMoney);
    return {
        figure: nextMoney ?? `${sats(next)} sats`,
        headline:
            nextMoney === null ? FEES.headlineNoPrice(type, sats(next)) : FEES.headline(type, sats(next), nextMoney),
        detail: FEES.detail(rateText(next.rate), formatWhole(reading.vbytes), wait),
        rows,
        postcard: card({
            tool: 'fees',
            route: 'fees',
            kicker: POSTCARD.fees.kicker(formatWhole(reading.height)),
            number: nextMoney ?? `${sats(next)} sats`,
            line: POSTCARD.fees.line(type, sats(next), nextMoney ?? `${sats(next)} sats`),
            source: POSTCARD.fees.source(formatUtcStamp(reading.readAt)),
            signature: { kind: 'fees', rows: rows.map(({ name, value, sats: cost }) => ({ name, value, sats: cost })) },
        }),
    };
}

export interface StackReading {
    sats: number;
    unit: 'btc' | 'sats';
    fiat: HoldingFiat;
    quote: PriceQuote;
    /** The last year of daily closes as worth, ending at the price now; null until the history loads. */
    series: ValueSeries | null;
    closesTo: string | null;
    holding: Holding | null;
}

export interface StackText {
    figure: string;
    headline: string;
    detail: string;
    rows: Record<keyof typeof STACK.rows, string> | null;
    chart: DcaMarks | null;
    chartAlt: string;
    postcard: Postcard;
}

function percentText(fraction: number): string {
    return `${Math.abs(fraction * 100).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
}

/** A move in words: up or down, the money and the share. Under a cent is no change. */
export function moveText(move: Change, fiat: HoldingFiat): string {
    if (Math.abs(move.money) < 0.005) return STACK.flat;
    const money = formatFiatPrecise(Math.abs(move.money), fiat);
    return move.money > 0 ? STACK.up(money, percentText(move.fraction)) : STACK.down(money, percentText(move.fraction));
}

function sinceText(reading: StackReading, price: number): string {
    const { holding } = reading;
    if (!holding) return STACK.notKeptDetail;
    const from = baseline(holding);
    const move = moveText(change(reading.sats, priceIn(from.mark, reading.fiat), price), reading.fiat);
    const day = formatShortDay(from.mark.at);
    return from.since === 'visit' ? STACK.sinceVisit(move, day) : STACK.sinceSaved(move, day);
}

export function stackText(reading: StackReading): StackText {
    const { sats, fiat, quote, series } = reading;
    const price = fiat === 'GBP' ? quote.value.gbp : quote.value.usd;
    const amount = reading.unit === 'sats' ? formatSats(sats) : formatBtcExact(sats);
    const worthNow = formatFiatPrecise(worth(sats, price), fiat);
    const headline = STACK.headline(amount, worthNow);
    const points = series?.value.length ?? 0;
    let rows: StackText['rows'] = null;
    let yearAgo: string | null = null;
    if (series && points > 1) {
        const money = (i: number) => formatFiatPrecise(series.value[i] ?? 0, fiat);
        const day = (i: number) => formatShortDay(series.t[i] ?? 0);
        let high = 0;
        let low = 0;
        for (let i = 0; i < points - 1; i += 1) {
            if ((series.value[i] ?? 0) > (series.value[high] ?? 0)) high = i;
            if ((series.value[i] ?? 0) < (series.value[low] ?? 0)) low = i;
        }
        yearAgo = money(0);
        rows = {
            yearAgo: STACK.rowValue(yearAgo, day(0)),
            high: STACK.rowValue(money(high), day(high)),
            low: STACK.rowValue(money(low), day(low)),
        };
    }
    const chart = series && points > 1 ? { t: series.t, value: series.value, invested: [], lump: [] } : null;
    const chartAlt = yearAgo ? `${amount}: ${yearAgo} a year ago, ${worthNow} now.` : headline;
    const asOf = reading.closesTo ?? formatShortDay(quote.asOf);
    return {
        figure: worthNow,
        headline,
        detail: sinceText(reading, price),
        rows,
        chart,
        chartAlt,
        postcard: card({
            tool: 'stack',
            route: 'stack',
            kicker: POSTCARD.stack.kicker(formatShortDay(quote.asOf)),
            number: worthNow,
            line: POSTCARD.stack.line(amount, worthNow, yearAgo),
            source: POSTCARD.stack.source(priceLabel(quote), asOf),
            signature: chart ? { kind: 'lines', ...chart } : { kind: 'cells', sats },
        }),
    };
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
