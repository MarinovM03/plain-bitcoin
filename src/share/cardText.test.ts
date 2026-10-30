import { describe, expect, it } from 'vitest';
import { LAST_CLOSE, type PriceQuote } from '../data/price.ts';
import { convert } from '../model/convert.ts';
import type { DcaResult } from '../model/dca.ts';
import type { PowerResult } from '../model/power.ts';
import { supplyAt } from '../model/supply.ts';
import { convertText, dcaText, leftCard, powerText, priceLabel, rateLine } from './cardText.ts';
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

const LIVE: PriceQuote = {
    value: { gbp: 57_329, usd: 76_777 },
    source: 'mempool.space',
    asOf: Date.UTC(2026, 9, 30, 19, 20),
    stale: false,
};

describe('convertText', () => {
    it('states 100,000 sats in pounds with the price source and time on the card', () => {
        const text = convertText('sats', convert(100_000, LIVE.value), LIVE, 'plainbitcoin.org');
        expect(text.headline).toBe('100,000 sats = £57.33');
        expect(text.detail).toBe('Also 0.001 BTC or $76.78.');
        expect(text.card.source).toBe('Price: mempool.space, 30 Oct 2026, 19:20 UTC');
        expect(text.card.copy).toBe('100,000 sats = £57.33. Also 0.001 BTC or $76.78.\nplainbitcoin.org');
        expect(text.card.fileName).toBe('plain-bitcoin-100000-sats.png');
    });

    it('keeps tiny amounts visible and answers money in sats', () => {
        expect(convertText('sats', convert(1, LIVE.value), LIVE, 'x').headline).toBe('1 sat = £0.00057');
        expect(convertText('btc', convert(1_000_000, LIVE.value), LIVE, 'x').headline).toBe('0.01 BTC = £573.29');
        const pounds = convertText('gbp', convert(87_216, LIVE.value), LIVE, 'x');
        expect(pounds.headline).toBe('£50.00 = 87,216 sats');
        expect(pounds.detail).toBe('Also 0.00087216 BTC or $66.96.');
        expect(convertText('usd', convert(87_216, LIVE.value), LIVE, 'x').detail).toBe(
            'Also 0.00087216 BTC or £50.00.',
        );
    });

    it('labels the offline price as the last close, and an old live price as not updating', () => {
        expect(priceLabel(LAST_CLOSE)).toMatch(/^last close, \d{1,2} \w{3,4} \d{4}$/);
        expect(convertText('sats', convert(100_000, LAST_CLOSE.value), LAST_CLOSE, 'x').card.source).toBe(
            `Price: ${priceLabel(LAST_CLOSE)}`,
        );
        expect(priceLabel({ ...LIVE, stale: true })).toBe('mempool.space, 30 Oct 2026, 19:20 UTC, not updating');
        expect(rateLine(LIVE)).toBe('1 BTC = £57,329 = $76,777');
    });
});

const DCA_RESULT: DcaResult = {
    amount: 50,
    frequency: 'weekly',
    feePercent: 0,
    requestedStart: '2020-01-01',
    start: '2020-01-01',
    clamped: false,
    end: '2026-10-29',
    lastBuy: '2026-10-27',
    buys: 357,
    invested: 17_850,
    fees: 0,
    sats: 123_456_789,
    priceNow: 58_462.4,
    valueNow: 72_175.4,
    averageCost: 14_458.5,
    drawdown: 0.6012,
    fall: {
        peak: { day: '2021-11-08', value: 30_512.2 },
        trough: { day: '2022-11-21', value: 12_168.4 },
    },
    lumpSum: { sats: 333_000_000, price: 5_360.1, valueNow: 194_680 },
    points: [],
};

describe('dcaText', () => {
    it('writes the answer and the card as one sentence with the lump sum', () => {
        const text = dcaText(DCA_RESULT, 'GBP', 'plainbitcoin.org');
        expect(text.headline).toBe('£50 a week since Jan 2020 is worth £72,175 today (one lump sum: £194,680).');
        expect(text.card.headline).toBe(text.headline);
        expect(text.card.detail).toBe('£17,850 put in over 357 buys. Worst fall on the way: 60%.');
        expect(text.card.source).toBe('Bitcoin: Coin Metrics daily closes to 29 Oct 2026 · fees not included');
        expect(text.card.copy).toBe(`${text.headline} ${text.card.detail}
plainbitcoin.org`);
        expect(text.card.fileName).toBe('plain-bitcoin-dca-50-gbp-weekly-2020-01-01.png');
        expect(text.asOf).toBe('today = close, 29 October 2026');
    });

    it('fills every row in plain words', () => {
        const { rows, detail, notes } = dcaText(DCA_RESULT, 'GBP', 'x');
        expect(detail).toBe('£17,850 put in over 357 buys, buying 1.23456789 BTC.');
        expect(rows.average).toBe('£14,459 per bitcoin');
        expect(rows.buys).toBe('357 buys, 1 Jan 2020 to 27 Oct 2026');
        expect(rows.fall).toBe('60%, from £30,512 on 8 Nov 2021 to £12,168 on 21 Nov 2022');
        expect(rows.lump).toBe('Worth £194,680 today: 3.33 BTC bought on 1 Jan 2020');
        expect(notes[0]).toBe('Fees not included.');
    });

    it('names other cadences, fees, dollars, a clamped start and no fall', () => {
        const text = dcaText(
            {
                ...DCA_RESULT,
                frequency: 'fortnightly',
                feePercent: 1.5,
                fees: 267.75,
                clamped: true,
                start: '2010-07-18',
                drawdown: 0,
                fall: null,
                buys: 1,
            },
            'USD',
            'x',
        );
        expect(text.headline).toMatch(/^\$50 every two weeks since Jul 2010 is worth \$72,175 today/);
        expect(text.card.detail).toBe('$17,850 put in over 1 buy.');
        expect(text.card.source).toBe('Bitcoin: Coin Metrics daily closes to 29 Oct 2026 · 1.5% fee per buy');
        expect(text.notes).toEqual([
            'Includes a 1.5% fee on each buy, $268 in total.',
            'Prices start on 18 July 2010, so the first buy is that day.',
            'One lump sum puts the same total in at once, on the first buy day.',
        ]);
        expect(text.rows.fall).toBe('None: it closed every day at a new high');
        expect(dcaText({ ...DCA_RESULT, frequency: 'monthly' }, 'GBP', 'x').headline).toMatch(/^£50 a month since/);
    });
});
