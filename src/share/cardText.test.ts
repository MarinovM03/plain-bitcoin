import { describe, expect, it } from 'vitest';
import type { PowerResult } from '../model/power.ts';
import { supplyAt } from '../model/supply.ts';
import { leftCard, powerText } from './cardText.ts';
import { siteAddress } from './index.ts';

const BASE: PowerResult = {
    amount: 1000,
    start: '2015-01',
    priceMonth: '2026-09',
    cpiMonth: '2026-09',
    equivalentNow: 1451.158,
    cashBuysNow: 689.105,
    btc: 6.9138,
    btcValueNow: 435_560.4,
    btcRealNow: 300_154.7,
    path: [
        { month: '2015-02', value: 900 },
        { month: '2015-03', value: 640.2 },
    ],
    maxDrawdown: 0.3598,
    fall: { peak: { month: '2015-01', value: 1000 }, trough: { month: '2015-03', value: 640.2 } },
    worst: { month: '2015-03', value: 640.2 },
    monthsBelow: 14,
};

describe('powerText', () => {
    it('builds the answer sentence with rounded pounds and a full month name', () => {
        const text = powerText(BASE, 'GBP', 'plainbitcoin.org');
        expect(text.headline).toBe('£1,000 in January 2015 is worth £1,451 today.');
        expect(text.bitcoin).toBe('As bitcoin, it would be £435,560 today (6.91380000 BTC).');
        expect(text.cashNote).toBe('Buys what £689 bought then.');
        expect(text.bitcoinNote).toBe('Buys what £300,155 bought then.');
        expect(text.asOf).toBe('today = close, September 2026');
    });

    it('uses dollar signs for USD and keeps pence on fractional amounts', () => {
        const text = powerText({ ...BASE, amount: 12.5, equivalentNow: 18.139, btcValueNow: 5444.5 }, 'USD', 'x');
        expect(text.headline).toBe('$12.50 in January 2015 is worth $18.14 today.');
        expect(text.card.detail).toBe('As bitcoin: $5,445 today, after a 36% fall on the way.');
    });

    it('describes the path: the worst fall with its own months, then time below the start', () => {
        expect(powerText(BASE, 'GBP', 'x').path).toBe(
            'Its worst fall on the way was 36%, from £1,000 in January 2015 to £640 in March 2015. It spent 14 months below £1,000, the lowest £640 in March 2015.',
        );
        expect(powerText({ ...BASE, monthsBelow: 1 }, 'GBP', 'x').path).toMatch(/It spent 1 month below £1,000,/);
        expect(powerText({ ...BASE, monthsBelow: 0 }, 'GBP', 'x').path).toMatch(
            /It never closed a month below £1,000\.$/,
        );
    });

    it('says so plainly when there was no fall or no path yet', () => {
        const noFall = powerText({ ...BASE, maxDrawdown: 0.004, monthsBelow: 0 }, 'GBP', 'x');
        expect(noFall.path).toBe(
            'It closed every month after the start at a new high. It never closed a month below £1,000.',
        );
        expect(noFall.card.detail).toBe('As bitcoin: £435,560 today.');
        const start = powerText(
            { ...BASE, path: [], fall: null, worst: null, maxDrawdown: 0, monthsBelow: 0 },
            'GBP',
            'x',
        );
        expect(start.path).toBe('No month has closed since the start yet, so there is no path to show.');
    });

    it('names millions and billions in words', () => {
        const text = powerText({ ...BASE, start: '2010-07', btcValueNow: 1_234_000_000 }, 'GBP', 'x');
        expect(text.bitcoinValue).toBe('£1.23 billion');
        expect(text.headline).toMatch(/^£1,000 in July 2010/);
    });

    it('builds the card: sentence, supporting line, short source months, copy text and alt', () => {
        const { card } = powerText({ ...BASE, cpiMonth: '2026-08' }, 'GBP', 'plainbitcoin.org');
        expect(card.headline).toBe('£1,000 in January 2015 is worth £1,451 today.');
        expect(card.source).toBe('CPI: ONS to Aug 2026 · Bitcoin: Coin Metrics close, Sept 2026');
        expect(card.alt).toBe(`${card.headline} ${card.detail}`);
        expect(card.copy).toBe(`${card.headline} ${card.detail}\nplainbitcoin.org`);
        expect(card.fileName).toBe('plain-bitcoin-1000-gbp-2015-01.png');
        expect(powerText({ ...BASE, amount: 12.5 }, 'USD', 'x').card.fileName).toBe(
            'plain-bitcoin-12-5-usd-2015-01.png',
        );
    });
});

describe('siteAddress', () => {
    it('drops the scheme and trailing slash', () => {
        expect(siteAddress('https://plainbitcoin.org/')).toBe('plainbitcoin.org');
    });
});

describe('leftCard', () => {
    it('states what is left and the block, with the source and when it was checked', () => {
        const card = leftCard(supplyAt(973_854), 'mempool.space', Date.UTC(2026, 9, 30, 18, 6), 'plainbitcoin.org');
        expect(card.headline).toBe('894,203.1019 BTC left to mine. Block 973,854.');
        expect(card.detail).toBe('20,105,796.875 BTC issued by the schedule. Next halving at block 1,050,000.');
        expect(card.source).toBe('Block height: mempool.space, 30 Oct 2026, 18:06 UTC · Supply: the issuance schedule');
        expect(card.copy).toBe(`${card.headline} ${card.detail}
plainbitcoin.org`);
        expect(card.fileName).toBe('plain-bitcoin-left-973854.png');
    });
});
