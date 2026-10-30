import type { ToolId } from '../tools/index.ts';
import type { Fiat } from '../util/format.ts';

export const SITE_NAME = 'Plain Bitcoin';

export const SITE_DESCRIPTION = 'A few honest Bitcoin tools, fast and plain. Everything runs in your browser.';

export const HOME = {
    promise: 'Plain answers to Bitcoin questions, worked out in your browser.',
    toolsHeading: 'Tools',
} as const;

export const HERO = {
    heading: 'Bitcoin left to mine',
    figureEmpty: 'Counting',
    link: 'Issued so far and the next halving',
    sceneLabel:
        'A field of 21,000 tokens of 1,000 BTC each, one terrace per halving. Issued tokens are solid, the rest are outlines, and the token being filled now glows.',
    live: (height: string, reward: string) => `Block ${height}: ${reward} issued.`,
    liveMany: (first: string, last: string, reward: string) => `Blocks ${first} to ${last}: ${reward} issued.`,
    liveAgo: (height: string, reward: string, age: string) => `Block ${height}: ${reward} issued, ${age} ago.`,
    checking: (height: string) => `Estimated block ${height}. Checking the latest block.`,
    offline: (height: string) => `Estimated, offline: block ${height}, assuming a block every 10 minutes.`,
} as const;

export const TOOLS: Record<ToolId, { name: string; question: string; preview: string; privacy: string }> = {
    left: {
        name: 'Bitcoin left to mine',
        question: 'How much bitcoin is still to be mined?',
        preview: 'Counted from the latest block',
        privacy: 'Reads the latest block height from mempool.space, a public API. No tracking.',
    },
    power: {
        name: 'Purchasing power',
        question: 'What is an old amount of money worth today, and in bitcoin?',
        preview: '£1,000 in 2015, worth today',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    convert: {
        name: 'Converter',
        question: 'How much is this in sats, bitcoin, pounds or dollars?',
        preview: '1 BTC = 100,000,000 sats',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    dca: {
        name: 'Buying on a schedule',
        question: 'How does buying a little at a time (DCA) compare with one lump sum?',
        preview: '£50 a week or one lump sum',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    address: {
        name: 'Address lookup',
        question: 'What can anyone see about a bitcoin address?',
        preview: 'Public balance and history',
        privacy: 'Only asks mempool.space, a public API, after you tap Look up. Never asks for keys or seeds.',
    },
};

export const TOOL_PAGE = {
    back: 'All tools',
    pending: 'This tool opens in a later session.',
    inputsLabel: 'Your numbers',
    resultLabel: 'Answer',
    resultEmpty: 'Your answer shows here.',
    sourcePending: 'Source and as-of date show here with each answer.',
} as const;

export const SHARE = {
    label: 'Share',
    card: 'Share card',
    download: 'Download',
    copy: 'Copy text',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    failed: 'Could not make the card. Try Copy text instead.',
    downloaded: 'Card saved as a PNG.',
    handle: '@PlainBTC',
} as const;

export const FIELDS = {
    amount: 'Amount',
    currency: 'Currency',
    pounds: '£ GBP',
    dollars: '$ USD',
    when: 'When',
    eachBuy: 'Each buy',
    howOften: 'How often',
    starting: 'Starting',
    month: 'Month',
    year: 'Year',
    examples: { power: '1,000', dca: '50', address: 'bc1q…' },
    address: 'Bitcoin address',
    lookUp: 'Look up',
    lookUpNote: 'Look up asks mempool.space, a public API, about this address. Nothing is sent before you tap it.',
} as const;

const CPI_PLACE: Record<Fiat, string> = { GBP: 'UK', USD: 'US' };

function months(count: number): string {
    return `${count} ${count === 1 ? 'month' : 'months'}`;
}

export const POWER = {
    presetsLabel: 'Try a start',
    presets: { y2015: '2015', fiveYears: 'Five years ago', oneYear: 'A year ago', worst: 'The worst month to start' },
    empty: 'Type an amount to see the answer.',
    noPrice: (month: string) => `There is no bitcoin close for ${month}. Pick another month.`,
    noCpi: (month: string, currency: Fiat) =>
        `No ${CPI_PLACE[currency]} CPI was published for ${month}, so that month is a gap. Pick another month.`,
    headline: (amount: string, when: string, worth: string) => `${amount} in ${when} is worth ${worth} today.`,
    bitcoin: (value: string, btc: string) => `As bitcoin, it would be ${value} today (${btc}).`,
    asOf: (close: string) => `today = close, ${close}`,
    barsLabel: "In today's money",
    cash: 'Kept as cash',
    asBitcoin: 'As bitcoin',
    buysThen: (value: string) => `Buys what ${value} bought then.`,
    logScale: (times: string) =>
        `One bar is ${times} times the other, so the bars use a log scale: each tick is ten times more.`,
    pathFall: (fall: string, peak: string, peakMonth: string, trough: string, troughMonth: string) =>
        `Its worst fall on the way was ${fall}, from ${peak} in ${peakMonth} to ${trough} in ${troughMonth}.`,
    pathNoFall: 'It closed every month after the start at a new high.',
    pathNeverBelow: (amount: string) => `It never closed a month below ${amount}.`,
    pathBelow: (count: number, amount: string, low: string, month: string) =>
        `It spent ${months(count)} below ${amount}, the lowest ${low} in ${month}.`,
    noPath: 'No month has closed since the start yet, so there is no path to show.',
    pathLabel: 'Month-end value as bitcoin, with a dashed line at the starting amount.',
    formula: 'Worth today = amount × CPI now ÷ CPI then. As bitcoin = amount ÷ close then × close now.',
    caution: "Past results don't tell you what happens next.",
    cpiSource: {
        GBP: 'Office for National Statistics, CPI index D7BT',
        USD: 'US Bureau of Labor Statistics, CPI-U, via FRED',
    } satisfies Record<Fiat, string>,
    cpiShort: { GBP: 'ONS', USD: 'BLS' } satisfies Record<Fiat, string>,
    cpiLabel: 'CPI: ',
    cpiTo: (month: string) => `, to ${month}. `,
    priceLabel: 'Bitcoin: ',
    priceSource: 'Coin Metrics reference price',
    priceTo: (month: string) => `, month-end closes to ${month}.`,
    fxNote: "Pounds use the Federal Reserve's last USD/GBP rate of each month.",
    cardDetail: (value: string) => `As bitcoin: ${value} today.`,
    cardDetailFall: (value: string, fall: string) => `As bitcoin: ${value} today, after a ${fall} fall on the way.`,
    cardSource: (cpi: string, cpiMonth: string, closeMonth: string) =>
        `CPI: ${cpi} to ${cpiMonth} · Bitcoin: Coin Metrics close, ${closeMonth}`,
} as const;

export const CONVERT = {
    fields: { sats: 'Sats', btc: 'Bitcoin (BTC)', gbp: 'Pounds (GBP)', usd: 'Dollars (USD)' },
    presetsLabel: 'Try an amount',
    presets: {
        sat: '1 sat',
        thousand: '1,000 sats',
        hundredThousand: '100k sats',
        cent: '0.01 BTC',
        coin: '1 BTC',
        pizza: '10,000 BTC, Pizza Day',
    },
    labelLive: (clock: string) => `live price, ${clock}`,
    empty: 'Type an amount in any field.',
    tooBig: 'That is more than 21,000,000 BTC, the most there will ever be.',
    tooSmall: 'That is less than 1 sat, the smallest amount bitcoin can send.',
    invalid: 'Only plain numbers, like 100,000 or 0.01.',
    headline: (from: string, to: string) => `${from} = ${to}`,
    detail: (first: string, second: string) => `Also ${first} or ${second}.`,
    rate: (gbp: string, usd: string) => `1 BTC = ${gbp} = ${usd}`,
    live: (api: string, stamp: string) => `${api}, ${stamp}`,
    notUpdating: (api: string, stamp: string) => `${api}, ${stamp}, not updating`,
    lastClose: (day: string) => `last close, ${day}`,
    asOf: (price: string) => `price: ${price}`,
    sourceLabel: 'Price: ',
    sourceLive: (stamp: string) => `, checked ${stamp}. `,
    sourceFallback: 'mempool.space, with CoinGecko if it does not answer',
    sourceClose: (day: string) => ` daily close for ${day}, used until a live price answers. `,
    sourceUnits: '1 BTC = 100,000,000 sats.',
    cardSource: (price: string) => `Price: ${price}`,
} as const;

export const DCA = {
    frequencies: { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' },
    every: { weekly: 'a week', fortnightly: 'every two weeks', monthly: 'a month' },
    fee: 'Fee per buy (%)',
    presetsLabel: 'Try a start',
    presets: { y2020: 'January 2020', fiveYears: 'Five years ago', oneYear: 'A year ago' },
    empty: 'Type an amount for each buy to see the answer.',
    badFee: 'The fee must be less than 100%.',
    loadFailed: 'The price history did not load. Check the connection and try again.',
    afterData: (day: string) => `The prices end on ${day}. Pick an earlier start.`,
    headline: (amount: string, every: string, since: string, worth: string, lump: string) =>
        `${amount} ${every} since ${since} is worth ${worth} today (one lump sum: ${lump}).`,
    detail: (invested: string, buys: string, btc: string) => `${invested} put in over ${buys}, buying ${btc}.`,
    asOf: (day: string) => `today = close, ${day}`,
    rows: {
        invested: 'Put in',
        bought: 'Bitcoin bought',
        worth: 'Worth today',
        average: 'Average cost',
        buys: 'Buys',
        fall: 'Worst fall on the way',
        lump: 'One lump sum',
    },
    buys: (count: number) => `${count.toLocaleString('en-GB')} ${count === 1 ? 'buy' : 'buys'}`,
    buysRange: (buys: string, first: string, last: string) => `${buys}, ${first} to ${last}`,
    perBtc: (value: string) => `${value} per bitcoin`,
    fall: (fall: string, peak: string, peakDay: string, trough: string, troughDay: string) =>
        `${fall}, from ${peak} on ${peakDay} to ${trough} on ${troughDay}`,
    noFall: 'None: it closed every day at a new high',
    lump: (worth: string, btc: string, day: string) => `Worth ${worth} today: ${btc} bought on ${day}`,
    feesNone: 'Fees not included.',
    feesPaid: (percent: string, fees: string) => `Includes a ${percent} fee on each buy, ${fees} in total.`,
    clamped: (day: string) => `Prices start on ${day}, so the first buy is that day.`,
    lumpNote: 'One lump sum puts the same total in at once, on the first buy day.',
    chartLabel: 'Worth over time',
    chartAlt: (worth: string, invested: string, lump: string) =>
        `Line chart. Buying on a schedule ends worth ${worth} for ${invested} put in; one lump sum ends worth ${lump}.`,
    legend: { value: 'Buying on a schedule', invested: 'Put in', lump: 'One lump sum' },
    formula: "Each buy = amount ÷ that day's close. Worth = bitcoin held × close.",
    sourceLabel: 'Bitcoin: ',
    source: 'Coin Metrics reference price',
    sourceTo: (day: string) => `, daily closes to ${day}. All dates UTC.`,
    fxNote: "Pounds use the Federal Reserve's USD/GBP rate for each day.",
    cardDetail: (invested: string, buys: string, fall: string) =>
        `${invested} put in over ${buys}. Worst fall on the way: ${fall}.`,
    cardDetailNoFall: (invested: string, buys: string) => `${invested} put in over ${buys}.`,
    cardSource: (day: string, fees: string) => `Bitcoin: Coin Metrics daily closes to ${day} · ${fees}`,
    cardFees: (percent: string) => `${percent} fee per buy`,
    cardNoFees: 'fees not included',
} as const;

export const LEFT_PAGE = {
    numbersHeading: 'The numbers',
    left: 'Left to mine',
    issued: 'Issued by the schedule',
    share: 'Share issued',
    reward: 'Each block adds',
    height: 'Block height',
    lastBlock: 'Last block',
    nextHalving: 'Next halving',
    nextReward: 'Then each block adds',
    halvingDate: 'Estimated date',
    max: 'Most there will ever be',
    pending: 'Counting',
    ago: (age: string) => `${age} ago`,
    unknownTime: 'Time not known',
    estimatedTime: (age: string) => `About ${age} ago (estimated)`,
    halvingAt: (height: string, blocks: string) => `Block ${height}, in ${blocks} blocks`,
    halvingDay: (day: string) => `About ${day}, assuming 10-minute blocks`,
    steps: 'Supply grows in steps: once per block, never in between.',
    honesty:
        'This counts what the schedule has issued. Some coins were never claimed or can never be spent, and many are lost. Nobody can count lost coins precisely, so this tool does not try.',
    heightLabel: 'Block height: ',
    heightLive: (stamp: string) => `, checked ${stamp}. `,
    heightFallback: 'mempool.space, with blockstream.info if it does not answer',
    heightOffline: (height: string, stamp: string) =>
        `estimated offline from block ${height} (${stamp}) at one block every 10 minutes. `,
    supplyLabel: 'Supply: ',
    supplySource: "worked out from Bitcoin's issuance schedule, 50 BTC a block halving every 210,000 blocks.",
    shareOffline: 'Sharing waits for a live block height.',
    cardHeadline: (left: string, height: string) => `${left} left to mine. Block ${height}.`,
    cardDetail: (issued: string, halving: string) =>
        `${issued} issued by the schedule. Next halving at block ${halving}.`,
    cardSource: (api: string, stamp: string) => `Block height: ${api}, ${stamp} · Supply: the issuance schedule`,
} as const;

export const ROUTE = {
    notFound: 'That page does not exist, so here is the home page.',
} as const;

export const FOOTER = {
    privacy: 'Runs in your browser. No tracking. Never asks for keys or seeds.',
} as const;

export const NOSCRIPT = {
    needs: 'The tools work out every number in your browser, so they need JavaScript turned on.',
} as const;

export function pageTitle(page?: string): string {
    return page ? `${page} · ${SITE_NAME}` : SITE_NAME;
}
