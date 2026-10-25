import type { ToolId } from '../tools/index.ts';

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
} as const;

export const FIELDS = {
    amount: 'Amount',
    currency: 'Currency',
    pounds: '£ Pounds',
    dollars: '$ Dollars',
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
