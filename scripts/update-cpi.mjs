import { download, FIRST_MONTH, today, writeDataFile } from './lib/data-file.mjs';

const MONTHS = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
};

function parseFred(csv) {
    const months = {};
    for (const line of csv.trim().split(/\r?\n/).slice(1)) {
        const [date, raw] = line.split(',');
        const value = Number(raw);
        if (raw && raw !== '.' && Number.isFinite(value)) months[date.slice(0, 7)] = value;
    }
    return months;
}

function parseOns(csv) {
    const months = {};
    for (const line of csv.trim().split(/\r?\n/)) {
        const match = /^"(\d{4}) ([A-Z]{3})","([\d.]+)"$/.exec(line.trim());
        if (match && MONTHS[match[2]]) months[`${match[1]}-${MONTHS[match[2]]}`] = Number(match[3]);
    }
    return months;
}

const SERIES = [
    {
        path: 'src/data/cpi/us.json',
        download: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS',
        parse: parseFred,
        meta: {
            series: 'CPIAUCNS: US CPI-U, all items, US city average, not seasonally adjusted (BLS CUUR0000SA0)',
            source: 'US Bureau of Labor Statistics, via FRED (Federal Reserve Bank of St. Louis)',
            url: 'https://fred.stlouisfed.org/series/CPIAUCNS',
            licence: 'Public domain (US government work)',
        },
    },
    {
        path: 'src/data/cpi/uk.json',
        download:
            'https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/d7bt/mm23',
        parse: parseOns,
        meta: {
            series: 'D7BT: UK CPI index, all items, 2015=100',
            source: 'Office for National Statistics',
            url: 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23',
            licence: 'Open Government Licence v3.0',
        },
    },
];

for (const { path, download: url, parse, meta } of SERIES) {
    const all = parse(await download(url));
    const months = Object.fromEntries(Object.entries(all).filter(([month]) => month >= FIRST_MONTH));
    if (Object.keys(months).length === 0) throw new Error(`${url}: no monthly rows found`);
    await writeDataFile(path, { ...meta, asOf: today(), months });
}
