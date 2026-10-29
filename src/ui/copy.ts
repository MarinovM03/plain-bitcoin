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
    figureEmpty: 'Not counted yet',
    note: 'The live counter arrives in a later session.',
    sceneLabel: 'A picture of the bitcoin still to be mined.',
} as const;

export const TOOLS: Record<ToolId, { name: string; question: string; preview: string; privacy: string }> = {
    left: {
        name: 'Bitcoin left to mine',
        question: 'How much bitcoin is still to be mined?',
        preview: '21 million BTC cap, counted live',
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
    unit: 'In',
    units: { sats: 'sats', btc: 'BTC', gbp: 'pounds (GBP)', usd: 'dollars (USD)' },
    eachBuy: 'Each buy',
    howOften: 'How often',
    weekly: 'Weekly',
    monthly: 'Monthly',
    starting: 'Starting',
    month: 'Month',
    year: 'Year',
    examples: { power: '1,000', convert: '100,000', dca: '50', address: 'bc1q…' },
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

export const LEFT_PAGE = {
    numbersHeading: 'The numbers',
    numbersEmpty: 'The numbers fill in here when the live counter is switched on.',
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
