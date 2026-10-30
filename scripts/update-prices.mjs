import { download, lastDayOf, nextDay, today, writeDailyFile, writeDataFile, writeJsonFile } from './lib/data-file.mjs';

const PRICE_URL =
    'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&page_size=10000&paging_from=start&start_time=2010-01-01';
const FX_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSUK';

const PRICE_META = {
    source: 'Coin Metrics Community Data (PriceUSD, daily reference price)',
    url: 'https://docs.coinmetrics.io/api/v4/',
    licence: 'CC BY-NC 4.0, attribution to Coin Metrics',
};

async function dailyUsd() {
    const days = {};
    let url = PRICE_URL;
    while (url) {
        const page = JSON.parse(await download(url));
        for (const row of page.data) days[row.time.slice(0, 10)] = Number(row.PriceUSD);
        url = page.next_page_url;
    }
    return days;
}

async function dailyUsdPerGbp() {
    const days = {};
    for (const line of (await download(FX_URL)).trim().split(/\r?\n/).slice(1)) {
        const [date, raw] = line.split(',');
        const value = Number(raw);
        if (raw && raw !== '.' && Number.isFinite(value) && value > 0) days[date] = value;
    }
    return days;
}

function rounded(value) {
    return Number(value.toPrecision(8));
}

function monthEndRate(rates, month) {
    const end = lastDayOf(month);
    const inMonth = Object.keys(rates).filter((day) => day.startsWith(month) && day <= end);
    const last = inMonth.sort().at(-1);
    return last === undefined ? undefined : rates[last];
}

// Six significant figures keep every daily close within 0.001% and the DCA download small.
function daily(value) {
    return Number(value.toPrecision(6));
}

function dailySeries(usdDays, fx) {
    const days = Object.keys(usdDays).sort();
    const rateDays = Object.keys(fx).sort();
    const start = days[0];
    const usd = [];
    const gbp = [];
    let rateIndex = 0;
    let rate;
    for (let day = start; day <= days.at(-1); day = nextDay(day)) {
        const close = usdDays[day];
        if (close === undefined || !(close > 0)) throw new Error(`No USD close for ${day}`);
        while (rateIndex < rateDays.length && rateDays[rateIndex] <= day) rate = fx[rateDays[rateIndex++]];
        if (rate === undefined) throw new Error(`No USD per GBP rate on or before ${day}`);
        usd.push(daily(close));
        gbp.push(daily(close / rate));
    }
    return { start, end: days.at(-1), usd, gbp };
}

const usdDays = await dailyUsd();
const fx = await dailyUsdPerGbp();
const usd = {};
const gbp = {};
for (const month of new Set(Object.keys(usdDays).map((day) => day.slice(0, 7)))) {
    const close = usdDays[lastDayOf(month)];
    if (close === undefined || !(close > 0)) continue;
    usd[month] = rounded(close);
    const rate = monthEndRate(fx, month);
    if (rate !== undefined) gbp[month] = rounded(close / rate);
}

const asOf = today();
await writeDataFile('src/data/prices/usd.json', {
    series: 'BTC month-end close in US dollars: PriceUSD on the last day of each month',
    ...PRICE_META,
    asOf,
    months: usd,
});
await writeDataFile('src/data/prices/gbp.json', {
    series: 'BTC month-end close in pounds: PriceUSD on the last day of each month, divided by DEXUSUK (USD per GBP, last rate published in that month, Federal Reserve H.10 via FRED, public domain)',
    ...PRICE_META,
    asOf,
    months: gbp,
});

const days = dailySeries(usdDays, fx);
await writeDailyFile('src/data/prices/daily-usd.json', {
    series: 'BTC daily close in US dollars: PriceUSD for each UTC day',
    ...PRICE_META,
    asOf,
    start: days.start,
    closes: days.usd,
});
await writeDailyFile('src/data/prices/daily-gbp.json', {
    series: 'BTC daily close in pounds: PriceUSD for each UTC day, divided by DEXUSUK (USD per GBP, the last rate published on or before that day, Federal Reserve H.10 via FRED, public domain)',
    ...PRICE_META,
    asOf,
    start: days.start,
    closes: days.gbp,
});
await writeJsonFile('src/data/prices/latest.json', {
    series: 'Latest BTC daily close in pounds and US dollars, the offline fallback for live prices',
    ...PRICE_META,
    asOf,
    day: days.end,
    GBP: days.gbp.at(-1),
    USD: days.usd.at(-1),
});
