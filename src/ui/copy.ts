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
        question: 'What kind of bitcoin address is this, and is it typed right?',
        preview: 'Type, typo check, public balance',
        privacy: 'Checked in your browser. Nothing is sent unless you tap Look up. Never asks for keys or seeds.',
    },
};

export const TOOL_PAGE = {
    back: 'All tools',
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
    examples: { power: '1,000', dca: '50' },
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

export const ADDRESS = {
    field: 'Bitcoin address',
    placeholder: 'bc1q…',
    paste: 'Paste',
    pasteBlocked: 'Paste was blocked. Press and hold the field, then choose Paste.',
    offline: 'The check runs in your browser. Nothing you paste leaves this page.',
    empty: 'Paste or type an address to check it.',
    resultLabel: 'Answer · checked in your browser',
    secret: 'That looks like a private key or seed. This site never needs it, and nobody honest will ask for it.',
    extendedPublic:
        'That is an extended public key. It reveals every address and the whole history of a wallet, so this page will not look it up.',
    extendedPublicHeadline: 'Extended public key, not looked up.',
    lightningHeadline: 'This is a Lightning invoice, not an address.',
    lightningDetail:
        'It asks for a payment on the Lightning Network. Pay it from a Lightning wallet; it has no balance to look up.',
    headline: (type: string) => `This is a ${type}.`,
    detail: (network: string, encoding: string) => `${network}. The ${encoding} checksum is valid.`,
    types: {
        p2pkh: 'Legacy address (P2PKH)',
        p2sh: 'script address (P2SH)',
        p2wpkh: 'Native SegWit address (P2WPKH)',
        p2wsh: 'SegWit script address (P2WSH)',
        p2tr: 'Taproot address (P2TR)',
        future: 'future SegWit version address',
    },
    about: {
        p2pkh: 'The original format, in use since 2009. Every wallet can send to it. Spending from it costs more in fees than from the newer types.',
        p2sh: 'Pays to a script, in use since 2012 (BIP 16). Often a SegWit address wrapped for older wallets, or a multisig wallet. The address alone does not say which.',
        p2wpkh: 'A single-key SegWit address, in use since 2017. Cheaper to spend from than Legacy, and its Bech32 checksum catches typos.',
        p2wsh: 'Pays to the hash of a script, in use since 2017. Often a multisig wallet, but the script stays hidden until the coins are spent.',
        p2tr: 'The newest type, in use since November 2021. One key or many can sit behind it, and a simple spend looks the same either way.',
        future: 'A valid format for a SegWit version that has no rules yet. Do not send coins to it.',
    },
    multisig:
        'A P2SH, P2WSH or P2TR address may or may not be multisig; the script is only revealed when the coins are spent.',
    networks: { mainnet: 'Bitcoin mainnet', testnet: 'Test network', regtest: 'Regtest, a local test network' },
    encodings: { base58check: 'Base58Check', bech32: 'Bech32', bech32m: 'Bech32m' },
    specs: { base58check: 'Base58Check', bech32: 'Bech32, BIP 173', bech32m: 'Bech32m, BIP 350' },
    invalid: {
        checksum: 'The checksum does not match.',
        characters: 'Not a valid address.',
        'mixed-case': 'Not a valid address.',
        short: 'Too short for an address.',
        long: 'Too long for an address.',
        'other-coin': 'Not a bitcoin address.',
        version: 'Not a valid address.',
        program: 'Not a valid address.',
        unknown: 'Not a bitcoin address.',
    },
    why: {
        checksumAt: (position: number) =>
            `So there is a typo, most likely the marked character (number ${position}). Do not send to it; copy the address again from whoever gave it.`,
        checksumBech32:
            'The last 6 characters are a checksum, and they do not match the rest. So there is a typo. Do not send to it.',
        checksumBase58:
            'In Base58 the 4 check bytes are mixed into every character, so the typo can be anywhere. Do not send to it.',
        characters: (position: number, encoding: 'base58check' | 'bech32' | null) =>
            encoding === 'bech32'
                ? `Character ${position} is never used after the 1 in a bc1 address (b, i, o and 1 are left out).`
                : `Character ${position} is never used in this kind of address (0, O, I and l are left out).`,
        'mixed-case': 'It mixes capital and small letters. A bc1 address is all one case.',
        short: 'Keep typing, or paste the whole address.',
        long: 'Check that only one address was pasted.',
        'other-coin': 'The checksum is valid, but the prefix is not bitcoin. It may belong to another coin.',
        version: 'The checksum is valid, but the SegWit version is out of range. No wallet should send to it.',
        program: 'The checksum is valid, but the length inside is wrong for its version. No wallet should send to it.',
        unknown: 'It does not match any bitcoin address format.',
    },
    partsHeading: 'The parts',
    parts: {
        hrp: (network: string) => `Network: ${network}`,
        hrpUnknown: 'Prefix',
        separator: 'Separator: always the last 1',
        version: (version: number) => `SegWit version ${version}`,
        versionUnknown: 'Version',
        program: (bytes: number, what: string) => `Program, ${bytes} bytes: ${what}`,
        programUnknown: 'Program',
        checksum: (encoding: string) => `Checksum, 6 characters, ${encoding}: valid`,
        checksumBad: 'Checksum: does not match',
        prefix: (type: string, network: string) => `Set by the version byte: ${type}, ${network}`,
        prefixUnknown: 'First character',
        body: 'The rest: the 20-byte hash and the 4-byte checksum, mixed together by Base58',
        bytesVersion: 'Version byte',
        bytesHash: (what: string) => `Hash of ${what}, 20 bytes`,
        bytesHashUnknown: 'Hash, 20 bytes',
        bytesChecksum: 'Checksum, 4 bytes: valid',
        bytesChecksumBad: 'Checksum, 4 bytes: does not match',
        suspect: (position: number) => `Character ${position}: likely typo`,
    },
    programs: {
        p2wpkh: 'the hash of one public key',
        p2wsh: 'the hash of a script',
        p2tr: 'the Taproot output key',
        future: 'not defined yet',
    },
    hashes: { p2pkh: 'one public key', p2sh: 'a script' },
    lookupHeading: 'On chain',
    apiNote: 'This asks a public API (mempool.space). It will see this address and your IP address.',
    lookUp: 'Look up balance',
    lookingUp: 'Asking mempool.space…',
    lookupFailed: 'mempool.space did not answer. Try again in a minute.',
    lookupMainnet: 'Only mainnet addresses can be looked up. Test network coins have no value.',
    lookupChecked: (stamp: string) => `mempool.space, checked ${stamp}. Anyone can see these numbers.`,
    explorer: 'Open this address on mempool.space',
    rows: {
        balance: 'Balance',
        received: 'Received in total',
        sent: 'Sent in total',
        txs: 'Transactions',
        pending: 'Waiting to confirm',
    },
    txs: (count: number) => `${count.toLocaleString('en-GB')} confirmed`,
    pending: (count: number, change: string) =>
        `${count.toLocaleString('en-GB')} ${count === 1 ? 'transaction' : 'transactions'}, ${change}`,
    source: (spec: string) => `Checked in your browser with the ${spec} checksum. Nothing was sent.`,
    sourceIdle: 'Decoded in your browser: Base58Check, Bech32 (BIP 173) and Bech32m (BIP 350).',
    cardToggle: 'Show the full address on the card',
    cardSource: (spec: string) => `Checked in the browser, nothing sent · ${spec}`,
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
