import type { PowerResult } from '../model/power.ts';
import { POWER } from '../ui/copy.ts';
import { type Fiat, formatAmount, formatBtcAmount, formatMoney, formatPercent } from '../util/format.ts';
import { monthKeyLabel } from '../util/month.ts';
import type { ShareCard } from './index.ts';

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
    const fileAmount = String(result.amount).replace(/[^\d]/g, '-');
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
            fileName: `plain-bitcoin-${fileAmount}-${currency.toLowerCase()}-${result.start}.png`,
        },
    };
}
