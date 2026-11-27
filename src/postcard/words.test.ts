import { describe, expect, it } from 'vitest';
import { LAST_CLOSE, type PriceQuote } from '../data/price.ts';
import { analyseAddress } from '../model/address.ts';
import { convert } from '../model/convert.ts';
import type { DcaResult } from '../model/dca.ts';
import type { PowerResult } from '../model/power.ts';
import { supplyAt } from '../model/supply.ts';
import { siteAddress } from './site.ts';
import {
    addressText,
    COMPOSE_LIMIT,
    composeText,
    convertText,
    dcaText,
    feesText,
    leftPostcard,
    maskAddress,
    minerPostcard,
    postcardFileName,
    powerText,
    priceLabel,
    stackText,
    todayPostcard,
} from './words.ts';

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
        const text = powerText(BASE, 'GBP');
        expect(text.headline).toBe('£1,000 in January 2015 is worth £1,451 today.');
        expect(text.bitcoin).toBe('As bitcoin, it would be £435,560 today (6.91380000 BTC).');
        expect(text.cashNote).toBe('Buys what £689 bought then.');
        expect(text.bitcoinNote).toBe('Buys what £300,155 bought then.');
        expect(text.asOf).toBe('today = close, September 2026');
    });

    it('uses dollar signs for USD and keeps pence on fractional amounts', () => {
        const text = powerText({ ...BASE, amount: 12.5, equivalentNow: 18.139, btcValueNow: 5444.5 }, 'USD');
        expect(text.headline).toBe('$12.50 in January 2015 is worth $18.14 today.');
        expect(text.postcard.number).toBe('$18.14');
        expect(text.postcard.line).toBe('$12.50 in January 2015 is worth $18.14 today. As bitcoin, $5,445.');
    });

    it('describes the path: the worst fall with its own months, then time below the start', () => {
        expect(powerText(BASE, 'GBP').path).toBe(
            'Its worst fall on the way was 36%, from £1,000 in January 2015 to £640 in March 2015. It spent 14 months below £1,000, the lowest £640 in March 2015.',
        );
        expect(powerText({ ...BASE, monthsBelow: 1 }, 'GBP').path).toMatch(/It spent 1 month below £1,000,/);
        expect(powerText({ ...BASE, monthsBelow: 0 }, 'GBP').path).toMatch(/It never closed a month below £1,000\.$/);
    });

    it('says so plainly when there was no fall or no path yet', () => {
        const noFall = powerText({ ...BASE, maxDrawdown: 0.004, monthsBelow: 0 }, 'GBP');
        expect(noFall.path).toBe(
            'It closed every month after the start at a new high. It never closed a month below £1,000.',
        );
        const start = powerText({ ...BASE, path: [], fall: null, worst: null, maxDrawdown: 0, monthsBelow: 0 }, 'GBP');
        expect(start.path).toBe('No month has closed since the start yet, so there is no path to show.');
    });

    it('names millions and billions in words', () => {
        const text = powerText({ ...BASE, start: '2010-07', btcValueNow: 1_234_000_000 }, 'GBP');
        expect(text.bitcoinValue).toBe('£1.23 billion');
        expect(text.headline).toMatch(/^£1,000 in July 2010/);
    });

    it('prints the answer as a postcard: the page figure, one sentence and the honest source', () => {
        const { postcard } = powerText({ ...BASE, cpiMonth: '2026-08' }, 'GBP');
        expect(postcard.number).toBe('£1,451');
        expect(postcard.line).toBe('£1,000 in January 2015 is worth £1,451 today. As bitcoin, £435,560.');
        expect(postcard.source).toBe(
            'CPI: ONS to Aug 2026 · Bitcoin: Coin Metrics close, Sept 2026 · calculated in your browser',
        );
        expect(postcard.signature).toMatchObject({ kind: 'columns', cash: 1000, bitcoin: 435_560.4 });
        expect(postcard.route).toBe('power');
    });
});

describe('feesText', () => {
    const costs = [
        { speed: 'next', rate: 4, sats: 564, money: 0.4512 },
        { speed: 'halfHour', rate: 3, sats: 423, money: 0.3384 },
        { speed: 'hour', rate: 2.5, sats: 353, money: 0.2824 },
        { speed: 'noRush', rate: 0.1, sats: 15, money: 0.012 },
    ] as const;

    it('leads with the next block in dollars and says what waiting costs, on the page and the postcard', () => {
        const text = feesText({ type: 'segwit', vbytes: 141, costs: [...costs], height: 900_000, readAt: 0 });
        expect(text?.figure).toBe('$0.45');
        expect(text?.headline).toBe('A SegWit payment costs about 564 sats ($0.45) to make the next block.');
        expect(text?.detail).toBe('At 4 sat/vB for about 141 virtual bytes. No rush: about 15 sats ($0.01).');
        expect(text?.rows.map((row) => row.line)).toEqual([
            '4 sat/vB · $0.45 · 564 sats',
            '3 sat/vB · $0.34 · 423 sats',
            '2.5 sat/vB · $0.28 · 353 sats',
            '0.1 sat/vB · $0.01 · 15 sats',
        ]);
        expect(text?.postcard.number).toBe('$0.45');
        expect(text?.postcard.signature).toMatchObject({ kind: 'fees' });
        expect(text?.postcard.line).toContain('a SegWit payment costs about 564 sats ($0.45)');
    });

    it('falls back to sats with no price', () => {
        const unpriced = costs.map((cost) => ({ ...cost, money: null }));
        const text = feesText({ type: 'legacy', vbytes: 226, costs: unpriced, height: 1, readAt: 0 });
        expect(text?.figure).toBe('564 sats');
        expect(text?.headline).toBe('A Legacy payment costs about 564 sats to make the next block.');
    });

    it('says nothing without costs', () => {
        expect(feesText({ type: 'segwit', vbytes: 141, costs: [], height: 1, readAt: 0 })).toBeNull();
    });
});

describe('siteAddress', () => {
    it('drops the scheme and trailing slash', () => {
        expect(siteAddress('https://plainbitcoin.org/')).toBe('plainbitcoin.org');
    });
});

describe('leftPostcard', () => {
    it('prints what is left with the block, its source and when it was checked', () => {
        const card = leftPostcard({
            supply: supplyAt(973_854),
            api: 'mempool.space',
            checkedAt: Date.UTC(2026, 9, 30, 18, 6),
        });
        expect(card.number).toBe('894,203.1019 BTC');
        expect(card.line).toBe('894,203 BTC are still to be mined.');
        expect(card.kicker).toBe('Bitcoin left · block 973,854');
        expect(card.source).toBe(
            'Block 973,854 · height via mempool.space · 30 Oct 2026, 18:06 UTC · supply from the issuance schedule',
        );
    });

    it('says est. on an estimated height, and never claims a source it did not use', () => {
        const card = leftPostcard({ supply: supplyAt(973_854), api: null, checkedAt: 0 });
        expect(card.kicker).toBe('Bitcoin left · block 973,854 est.');
        expect(card.source).toMatch(/^Block 973,854 est\. · estimated at one block every 10 minutes/);
        expect(card.source).not.toContain('mempool');
    });

    it("prints the home strip as today's card, leaving out the fee until it has loaded", () => {
        const readAt = Date.UTC(2026, 10, 22, 14, 2);
        const card = todayPostcard({ height: 973_854, usd: 97_123.4, fee: '$0.09', readAt });
        expect(card.kicker).toBe('Bitcoin today · 22 Nov 2026');
        expect(card.number).toBe('1 BTC = $97,123');
        expect(card.line).toBe(
            'Block 973,854. A payment in the next block costs about $0.09. 76,146 blocks to the halving. 894,203 BTC left to mine.',
        );
        expect(card.source).toBe('Height, fees and price: mempool.space · 22 Nov 2026, 14:02 UTC');
        expect(card.route).toBe('');
        expect(todayPostcard({ height: 973_854, usd: 97_123.4, fee: null, readAt }).line).toBe(
            'Block 973,854. 76,146 blocks to the halving. 894,203 BTC left to mine.',
        );
    });
});

describe('composeText', () => {
    it('pairs the line with the gauge link and the handle, never over 200 characters', () => {
        const card = leftPostcard({ supply: supplyAt(973_854), api: 'mempool.space', checkedAt: 0 });
        const text = composeText(card, 'plainbitcoin.org');
        expect(text).toBe('894,203 BTC are still to be mined. plainbitcoin.org/left via @PlainBTC');
        const long = composeText({ line: `${'word '.repeat(80)}end.`, route: 'dca' }, 'plainbitcoin.org');
        expect(long.length).toBeLessThanOrEqual(COMPOSE_LIMIT);
        expect(long).toMatch(/… {1,2}plainbitcoin\.org\/dca via @PlainBTC$/);
    });

    it('names the file plain-bitcoin-<tool>-<yyyy-mm-dd>.png, dated in UTC', () => {
        expect(postcardFileName('convert', Date.UTC(2026, 10, 4, 23, 59))).toBe('plain-bitcoin-convert-2026-11-04.png');
    });
});

const LIVE: PriceQuote = {
    value: { gbp: 57_329, usd: 76_777, eur: 66_210 },
    source: 'mempool.space',
    asOf: Date.UTC(2026, 9, 30, 19, 20),
    stale: false,
};

describe('convertText', () => {
    it('states 100,000 sats in dollars with the price source and time on the card', () => {
        const text = convertText('sats', convert(100_000, LIVE.value), LIVE, 'usd');
        expect(text.headline).toBe('100,000 sats = $76.78');
        expect(text.detail).toBe('Also 0.001 BTC.');
        expect(text.postcard.number).toBe('$76.78');
        expect(text.postcard.line).toBe('100,000 sats = $76.78.');
        expect(text.postcard.source).toBe('Price: mempool.space, 30 Oct 2026, 19:20 UTC · 1 BTC = 100,000,000 sats');
        expect(text.postcard.signature).toEqual({ kind: 'cells', sats: 100_000 });
    });

    it('keeps tiny amounts visible and answers money in sats', () => {
        expect(convertText('sats', convert(1, LIVE.value), LIVE, 'gbp').headline).toBe('1 sat = £0.00057');
        expect(convertText('btc', convert(1_000_000, LIVE.value), LIVE, 'gbp').headline).toBe('0.01 BTC = £573.29');
        expect(convertText('btc', convert(1_000_000, LIVE.value), LIVE, 'gbp').detail).toBe('Also 1,000,000 sats.');
        const pounds = convertText('gbp', convert(87_216, LIVE.value), LIVE, 'gbp');
        expect(pounds.headline).toBe('£50.00 = 87,216 sats');
        expect(pounds.detail).toBe('Also 0.00087216 BTC.');
    });

    it('answers in euros when a euro price is known, and in dollars when it is not', () => {
        expect(convertText('sats', convert(100_000, LIVE.value), LIVE, 'eur').headline).toBe('100,000 sats = €66.21');
        const offline = convert(100_000, LAST_CLOSE.value);
        expect(convertText('sats', offline, LAST_CLOSE, 'eur').headline).toMatch(/^100,000 sats = \$[\d,.]+$/);
    });

    it('labels the offline price as the last close, and an old live price as not updating', () => {
        expect(priceLabel(LAST_CLOSE)).toMatch(/^last close, \d{1,2} \w{3,4} \d{4}$/);
        expect(convertText('sats', convert(100_000, LAST_CLOSE.value), LAST_CLOSE, 'usd').postcard.source).toBe(
            `Price: ${priceLabel(LAST_CLOSE)} · 1 BTC = 100,000,000 sats`,
        );
        expect(priceLabel({ ...LIVE, stale: true })).toBe('mempool.space, 30 Oct 2026, 19:20 UTC, not updating');
    });
});

const MARKS = { t: [0, 1], value: [1, 2], invested: [1, 2], lump: [1, 3] };

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
    it('writes the answer and the card as one sentence about the plan, the lump sum left to the table', () => {
        const text = dcaText(DCA_RESULT, 'GBP', MARKS);
        expect(text.headline).toBe('£50 a week since Jan 2020 is worth £72,175 today.');
        expect(text.postcard.number).toBe(text.rows.worth);
        expect(text.postcard.line).toBe('£50 a week since Jan 2020 is worth £72,175 today.');
        expect(text.rows.lump).toMatch(/^Worth £194,680 today/);
        expect(text.postcard.source).toBe(
            'Bitcoin: Coin Metrics daily closes to 29 Oct 2026 · fees not included · calculated in your browser',
        );
        expect(text.postcard.signature).toEqual({ kind: 'lines', ...MARKS });
        expect(text.asOf).toBe('today = close, 29 October 2026');
    });

    it('names the lump sum in the chart description only while its line is drawn', () => {
        expect(dcaText(DCA_RESULT, 'GBP', MARKS).chartAlt).toContain('One lump sum ends worth £194,680.');
        expect(dcaText(DCA_RESULT, 'GBP', { ...MARKS, lump: [] }).chartAlt).not.toContain('lump');
    });

    it('fills every row in plain words', () => {
        const { rows, detail, notes } = dcaText(DCA_RESULT, 'GBP', MARKS);
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
            MARKS,
        );
        expect(text.headline).toMatch(/^\$50 every two weeks since Jul 2010 is worth \$72,175 today/);
        expect(text.postcard.source).toBe(
            'Bitcoin: Coin Metrics daily closes to 29 Oct 2026 · 1.5% fee per buy · calculated in your browser',
        );
        expect(text.notes).toEqual([
            'Includes a 1.5% fee on each buy, $268 in total.',
            'Prices start on 18 July 2010, so the first buy is that day.',
            'One lump sum puts the same total in at once, on the first buy day.',
        ]);
        expect(text.rows.fall).toBe('None: it closed every day at a new high');
        expect(dcaText({ ...DCA_RESULT, frequency: 'monthly' }, 'GBP', MARKS).headline).toMatch(/^£50 a month since/);
    });
});

describe('addressText', () => {
    const taproot = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';

    async function taprootAddress() {
        const analysis = await analyseAddress(taproot);
        if (analysis.kind !== 'address') throw new Error('Expected an address');
        return analysis;
    }

    it('never prints a typed address in full: the type, the check and the first and last four only', async () => {
        const text = addressText(await taprootAddress(), false);
        expect(text.headline).toBe('This is a Taproot address (P2TR).');
        expect(text.detail).toBe('Bitcoin mainnet. The Bech32m checksum is valid.');
        expect(text.postcard.number).toBe('Taproot');
        expect(text.postcard.line).toBe('This is a Taproot address, typed right. Bitcoin mainnet.');
        expect(text.postcard.source).toBe('Checked in your browser, nothing sent · Bech32m, BIP 350');
        expect(text.postcard.signature).toMatchObject({ kind: 'stamp', shown: 'bc1p…5jj0' });
        const printed = JSON.stringify(text.postcard);
        expect(printed).not.toContain(taproot.slice(4, 20));
        expect(printed).not.toContain(taproot);
    });

    it('prints a sample address in full, since it belongs to nobody who typed it', async () => {
        const text = addressText(await taprootAddress(), true);
        expect(text.postcard.signature).toMatchObject({ kind: 'stamp', shown: taproot });
    });

    it('masks to the first and last four', () => {
        expect(maskAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('bc1q…f3t4');
        expect(maskAddress('short')).toBe('short');
    });
});

describe('minerPostcard', () => {
    it('prints the best hash as the number, with the tries and the target in the line', () => {
        const card = minerPostcard({
            height: 976_313,
            tries: 4_065_057,
            best: 26,
            needed: 78,
            readAt: Date.UTC(2026, 10, 17, 19, 35),
            savedOn: '17 Nov',
        });
        expect(card.route).toBe('miner');
        expect(card.number).toBe('26 zero bits');
        expect(card.line).toBe(
            'I hashed block 976,313 4,065,057 times on my own device. Best: 26 zero bits. A real block needs 78.',
        );
        expect(card.source).toContain('mempool.space');
        expect(card.signature).toEqual({ kind: 'well', best: 26, needed: 78 });
    });

    it('says when the header was the saved one', () => {
        const card = minerPostcard({ height: 1, tries: 1, best: 0, needed: 78, readAt: null, savedOn: '17 Nov' });
        expect(card.source).toContain('saved 17 Nov');
    });
});

describe('stackText', () => {
    const QUOTE: PriceQuote = {
        value: { usd: 100_000, gbp: 80_000, eur: null },
        source: 'mempool.space',
        asOf: Date.UTC(2026, 10, 22, 14, 2),
        stale: false,
    };
    const mark = (at: number, usd: number) => ({ at, usd, gbp: usd * 0.8 });
    const reading = { sats: 1_000_000, unit: 'btc' as const, fiat: 'USD' as const, quote: QUOTE, closesTo: null };

    it('says what the coins are worth now, and invites a keep when nothing is kept', () => {
        const text = stackText({ ...reading, series: null, holding: null });
        expect(text.figure).toBe('$1,000.00');
        expect(text.headline).toBe('0.01 BTC is worth $1,000.00 now.');
        expect(text.detail).toMatch(/^Keep it on this device/);
        expect(text.rows).toBeNull();
        expect(text.postcard.line).toBe('0.01 BTC is worth $1,000.00 today.');
    });

    it('measures the move from the last visit once there is one, and from the keep day before that', () => {
        const kept = { sats: 1_000_000, fiat: 'USD' as const, savedAt: Date.UTC(2026, 10, 1), previous: null };
        const first = stackText({ ...reading, series: null, holding: { ...kept, visit: mark(kept.savedAt, 80_000) } });
        expect(first.detail).toBe('That is up $200.00 (25%) since you kept it on 1 Nov 2026.');
        const back = stackText({
            ...reading,
            unit: 'sats',
            series: null,
            holding: { ...kept, visit: mark(QUOTE.asOf, 100_000), previous: mark(Date.UTC(2026, 10, 20), 102_000) },
        });
        expect(back.headline).toBe('1,000,000 sats is worth $1,000.00 now.');
        expect(back.detail).toBe('That is down $20.00 (2%) since your last visit on 20 Nov 2026.');
    });

    it('reads a year ago, the highest and the lowest close off the same line the chart draws', () => {
        const day = (n: number) => Date.UTC(2025, 10, 22) + n * 86_400_000;
        const series = { t: [day(0), day(1), day(2), QUOTE.asOf], value: [600, 1_200, 500, 1_000] };
        const text = stackText({ ...reading, series, closesTo: '21 Nov 2026', holding: null });
        expect(text.rows).toEqual({
            yearAgo: '$600.00 on 22 Nov 2025',
            high: '$1,200.00 on 23 Nov 2025',
            low: '$500.00 on 24 Nov 2025',
        });
        expect(text.chart?.value).toEqual(series.value);
        expect(text.postcard.line).toBe('0.01 BTC is worth $1,000.00 today. A year ago it was worth $600.00.');
        expect(text.postcard.signature.kind).toBe('lines');
    });
});
