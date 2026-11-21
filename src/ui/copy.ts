import type { ToolId } from '../tools/index.ts';
import type { Fiat } from '../util/format.ts';

export const SITE_NAME = 'Plain Bitcoin';

export const PRODUCT =
    'Plain Bitcoin is a set of small machines that run on the real Bitcoin chain, right in your browser.';

export const SITE_DESCRIPTION =
    'Mine a real block on your phone, see every bitcoin that will ever exist, and more. Small machines on the real chain, in your browser.';

export const OG_IMAGE = {
    path: 'og.png',
    width: 1200,
    height: 628,
    kicker: 'Plain Bitcoin',
    number: '21,000,000',
    line: 'Small machines that run on the real Bitcoin chain. Mine a block on your own phone.',
    source: 'Runs in your browser. No tracking. Never asks for keys or seeds.',
    alt: 'Plain Bitcoin postcard: 21,000,000, small machines on the real Bitcoin chain, with the supply bar issued in bone and still to mine in orange.',
} as const;

/**
 * The preview card X shows for each page's link: a postcard drawn once, by hand, with `npm run og`. Numbers on
 * them are examples or fixed facts, never live readings that would go stale.
 */
export const OG_PAGES: Record<ToolId, { number: string; line: string; alt: string }> = {
    miner: {
        number: '79 zero bits',
        line: 'Mine a real Bitcoin block on your own phone. See how close you get.',
        alt: 'Plain Bitcoin postcard: Be a miner. A well of rings with the target depth in orange.',
    },
    left: {
        number: '21,000,000',
        line: 'Every bitcoin there will ever be, one cell each. See how many are left.',
        alt: 'Plain Bitcoin postcard: Bitcoin left. The supply bar, issued in bone and still to mine in orange.',
    },
    halving: {
        number: '210,000 blocks',
        line: 'The reward halves every 210,000 blocks. See when the next one lands.',
        alt: 'Plain Bitcoin postcard: Halving clock. The supply bar with a cut at every halving.',
    },
    tx: {
        number: 'sat/vB',
        line: 'Follow a transaction as it waits in line for a block.',
        alt: 'Plain Bitcoin postcard: Follow a transaction. Bars for the next blocks by lowest fee.',
    },
    power: {
        number: 'Inflation melt',
        line: 'Watch old cash shrink to inflation, and see what bitcoin did instead.',
        alt: 'Plain Bitcoin postcard: Inflation melt. Cash in blue beside bitcoin in orange.',
    },
    convert: {
        number: '100,000,000 sats',
        line: 'Sats to dollars, euros and pounds, and how far you are from one whole bitcoin.',
        alt: 'Plain Bitcoin postcard: Sats converter. A grid of sats.',
    },
    dca: {
        number: 'Stack weekly',
        line: 'What buying a little bitcoin every week since any date would be worth today.',
        alt: 'Plain Bitcoin postcard: Stack weekly. Lines for money put in and its value.',
    },
    address: {
        number: 'Address check',
        line: 'Is this Bitcoin address typed right? Checked in your browser.',
        alt: 'Plain Bitcoin postcard: Address check. An address with its checksum confirmed.',
    },
};

export const HOME = {
    headline: 'Bitcoin, running in your hand.',
    headlineAccent: 'in your hand.',
    lead: 'Small machines that run on the real chain, right here in your browser. Play with them, then post what you find.',
    promise: 'Small machines that run on the real Bitcoin chain.',
    galleryLabel: 'The machines',
    pending: '…',
    live: (height: string, age: string) => `Block ${height}, found ${age} ago`,
    liveUnknown: (height: string) => `Block ${height}`,
    fresh: 'New',
    hashed: 'real hashes tried on this page',
    hashedNone: 'Hashing in your browser',
    facts: {
        left: { unit: 'BTC still to mine' },
        halving: { unit: 'blocks to the next halving' },
        tx: { unit: 'sat/vB gets you into the next block' },
        power: { amount: 100, year: 2010, unit: (amount: string, year: string) => `of ${amount} from ${year} is left` },
        convert: { unit: 'sats for one dollar' },
        dca: { amount: 50, unit: (amount: string) => `sats for ${amount} this week` },
        address: { figure: '0 bytes', unit: 'sent until you tap Look up' },
    },
    sats: (count: string) => `${count} sats`,
    factsSource: 'Height and price: mempool.space. Inflation melt: US CPI, Bureau of Labor Statistics.',
    cautionsHeading: 'Good to know',
    cautions: [
        "The price moves a lot. Past results don't tell you what happens next.",
        'Never share a seed phrase or private key. No honest tool asks for one.',
    ],
    postcardLine: (issued: string) => `${issued} of 21,000,000 BTC issued so far.`,
} as const;

export const NAV = {
    all: 'All machines',
    home: 'Home',
} as const;

export const STATUS = {
    label: 'Bitcoin status',
    block: (height: string) => `Block ${height}`,
    estimated: ' est.',
    price: '1 BTC = ',
    live: (source: string, clock: string) => `${source} ${clock}`,
    stale: (source: string, clock: string) => `${source} ${clock}, not live`,
    lastClose: (day: string) => `last close ${day}`,
    since: (age: string) => `${age} since last block`,
    estimatedSince: (age: string) => `est. ${age} since last block`,
    unknownTime: 'block time unknown',
} as const;

/**
 * The five tools by the names people see: a short name that a stranger understands with the one line under it.
 * Route ids never change, so old links keep working; a route id on its own is never shown as a name.
 */
export const TOOLS: Record<ToolId, { name: string; description: string; privacy: string }> = {
    miner: {
        name: 'Be a miner',
        description: 'Hash a real block on your own device',
        privacy:
            'Reads the newest block header from mempool.space, a public API. Every hash is worked out on your device.',
    },
    halving: {
        name: 'Halving clock',
        description: 'When the bitcoin reward halves next',
        privacy: 'Reads the latest blocks from mempool.space, a public API. No tracking.',
    },
    tx: {
        name: 'Follow a transaction',
        description: 'Watch one wait in line for a block',
        privacy:
            'Reads the waiting line from mempool.space. A transaction id is only sent when you tap Follow or Pick one.',
    },
    left: {
        name: 'Bitcoin left',
        description: 'How much is still to be mined',
        privacy: 'Reads the latest block height from mempool.space, a public API. No tracking.',
    },
    power: {
        name: 'Inflation melt',
        description: 'What old cash buys today, next to bitcoin',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    convert: {
        name: 'Sats converter',
        description: 'Sats to dollars, euros or pounds',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    dca: {
        name: 'Stack weekly',
        description: 'If you had bought a little every week',
        privacy: 'Worked out in your browser. Nothing you type is sent anywhere.',
    },
    address: {
        name: 'Address check',
        description: 'Is this Bitcoin address typed right?',
        privacy: 'Checked in your browser. Nothing is sent unless you tap Look up. Never asks for keys or seeds.',
    },
};

export const TOOL_PAGE = {
    inputsLabel: 'Your numbers',
    addressLabel: 'Your address',
    resultLabel: 'Answer',
    resultEmpty: 'Your answer shows here.',
    sourcePending: 'Source and as-of date show here with each answer.',
} as const;

export const PICTURE = {
    power: (log: boolean) =>
        `Blue: the money kept as cash. Orange: the same money put into bitcoin. Each column is its value today${log ? ', on a log scale' : ''}.`,
    powerEmpty: 'Two columns compare cash and bitcoin once there is an answer.',
    dca: 'Each line runs from the first buy to today. The orange dot is your answer.',
    powerTitle: "Cash next to bitcoin, in today's money",
    dcaTitle: 'What your plan is worth, day by day',
    onCard: 'On your postcard',
    dcaEmpty: 'The chart draws once there is an answer.',
    address: 'Each cell is one character, coloured by its part once the checksum proves the type.',
    addressBad: 'Each cell is one character. The orange one cannot be part of this address.',
    addressLoose: 'Each cell is one character. The checksum cells do not lock into place.',
    addressEmpty: 'Each character will stand in its own cell once you paste an address.',
} as const;

export const GAUGE = {
    power: {
        cash: 'Kept as cash',
        bitcoin: 'As bitcoin',
        log: 'Log scale · ×10 a line',
    },
    convert: {
        yours: 'Yours',
    },
    address: {
        stamp: (kind: string, valid: boolean) => `${kind}${valid ? ' · checksum valid' : ''}`,
        count: (count: number) => `${count} characters`,
    },
} as const;

export const SHARE = {
    label: 'Share',
    print: 'Share postcard',
    download: 'Download',
    post: 'Post on X',
    title: 'Every answer is a postcard.',
    titleTag: 'Post it and tag @PlainBTC.',
    copyImage: 'Copy image',
    share: 'Share…',
    wide: 'Wide',
    square: 'Square',
    format: 'Postcard shape',
    close: 'Close',
    tray: 'Share tray',
    printing: 'Making the postcard…',
    printed: 'Your postcard is ready. Copy it, save it or post it.',
    copied: 'Image copied.',
    copyUnsupported: "Copy isn't supported here, use Download.",
    postCopied: 'Image copied. Paste it into your post.',
    postNoImage: 'Download the image first, then add it to your post.',
    downloaded: 'Postcard saved as a PNG.',
    failed: 'Could not make the postcard. Try again.',
    handle: '@PlainBTC',
    via: 'via @PlainBTC',
    madeHere: 'Made in your browser. Nothing is uploaded.',
} as const;

export const FIELDS = {
    amount: 'Amount',
    currency: 'Currency',
    pounds: '£ GBP',
    dollars: '$ USD',
    euros: '€ EUR',
    when: 'When',
    eachBuy: 'Each buy',
    howOften: 'How often',
    starting: 'Starting',
    month: 'Month',
    year: 'Year',
    more: 'More options',
    examples: { power: '1,000', dca: '50' },
} as const;

const CPI_PLACE: Record<Fiat, string> = { GBP: 'UK', USD: 'US' };

function months(count: number): string {
    return `${count} ${count === 1 ? 'month' : 'months'}`;
}

export const POWER = {
    drag: 'Drag back through the years and watch the cash shrink',
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
    pathHeading: 'On the way, as bitcoin',
    howHeading: 'How it is worked out',
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
} as const;

export const CONVERT = {
    fields: { sats: 'Sats', btc: 'Bitcoin (BTC)', usd: 'Dollars (USD)', eur: 'Euros (EUR)', gbp: 'Pounds (GBP)' },
    currencyLabel: 'Money',
    othersLabel: 'The same amount in other units',
    noEuro: 'There is no euro price offline. It shows once a live price answers.',
    scrub: 'Drag from 1 sat to 1 BTC',
    scrubLow: '1 sat',
    scrubHigh: '1 BTC',
    point: (perPoint: string) => `One point in the stack is ${perPoint}.`,
    pointRounded: (perPoint: string, points: string) =>
        `One point in the stack is ${perPoint}. ${points} points, rounded.`,
    pointEmpty: 'Type an amount and the counter rolls to it.',
    counter:
        'The top row is the amount in bitcoin, written out in full: whole coins on the orange drums, then the eight digits after the point, which are sats. The row under it is the same amount in money.',
    unitsLine: '1 BTC = 100,000,000 sats',
    perSat: (fiat: string) => `1 sat ≈ ${fiat}`,
    labelLive: (clock: string) => `live price, ${clock}`,
    empty: 'Type an amount, or drag the line.',
    tooBig: 'That is more than 21,000,000 BTC, the most there will ever be.',
    tooSmall: 'That is less than 1 sat, the smallest amount bitcoin can send.',
    invalid: 'Only plain numbers, like 100,000 or 0.01.',
    headline: (from: string, to: string) => `${from} = ${to}`,
    detail: (other: string) => `Also ${other}.`,
    live: (api: string, stamp: string) => `${api}, ${stamp}`,
    notUpdating: (api: string, stamp: string) => `${api}, ${stamp}, not updating`,
    lastClose: (day: string) => `last close, ${day}`,
    asOf: (price: string) => `price: ${price}`,
    sourceLabel: 'Price: ',
    sourceLive: (stamp: string) => `, checked ${stamp}. `,
    sourceFallback: 'mempool.space, with CoinGecko if it does not answer',
    sourceClose: (day: string) => ` daily close for ${day}, used until a live price answers. `,
    sourceUnits: '1 BTC = 100,000,000 sats.',
} as const;

export const DCA = {
    frequencies: { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' },
    every: { weekly: 'a week', fortnightly: 'every two weeks', monthly: 'a month' },
    fee: 'Fee per buy (%)',
    presetsLabel: 'Try a start',
    presets: { y2020: 'January 2020', fiveYears: 'Five years ago', oneYear: 'A year ago' },
    empty: 'Type an amount for each buy to see the answer.',
    badFee: 'The fee must be less than 100%.',
    tooBig: 'That would buy more bitcoin than will ever exist. Try a smaller amount.',
    loadFailed: 'The price history did not load. Check the connection and try again.',
    afterData: (day: string) => `The prices end on ${day}. Pick an earlier start.`,
    headline: (amount: string, every: string, since: string, worth: string, lump: string) =>
        `${amount} ${every} since ${since} is worth ${worth} today (one lump sum: ${lump}).`,
    detail: (invested: string, buys: string, btc: string) => `${invested} put in over ${buys}, buying ${btc}.`,
    asOf: (day: string) => `today = close, ${day}`,
    numbersHeading: 'The numbers',
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
        `Line chart. Buying a little at a time ends worth ${worth} for ${invested} put in; one lump sum ends worth ${lump}.`,
    key: {
        value: 'What your bitcoin is worth',
        invested: 'Cash you put in',
        lump: 'The same cash, all on day one',
    },
    cardKey: { value: 'your bitcoin', invested: 'cash put in', lump: 'all on day one' },
    formula: "Each buy = amount ÷ that day's close. Worth = bitcoin held × close.",
    sourceLabel: 'Bitcoin: ',
    source: 'Coin Metrics reference price',
    sourceTo: (day: string) => `, daily closes to ${day}. All dates UTC.`,
    fxNote: "Pounds use the Federal Reserve's USD/GBP rate for each day.",
} as const;

export const ADDRESS = {
    field: 'Bitcoin address',
    placeholder: 'bc1q…',
    paste: 'Paste',
    samplesLabel: 'Try a sample',
    samples: {
        p2tr: 'Taproot',
        p2wpkh: 'SegWit',
        p2pkh: 'Legacy',
        p2sh: 'Script',
    },
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
    figures: {
        p2pkh: 'Legacy',
        p2sh: 'Script',
        p2wpkh: 'SegWit',
        p2wsh: 'SegWit script',
        p2tr: 'Taproot',
        future: 'Future SegWit',
        invalid: 'Not valid',
        checksum: 'Typo',
        lightning: 'Lightning',
        extendedPublic: 'xpub',
    },
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
    cardSource: (spec: string) => `Checked in your browser, nothing sent · ${spec}`,
} as const;

export const LEFT_PAGE = {
    resultLabel: 'Left to mine',
    figureEmpty: 'Counting',
    unit: ' BTC',
    mined: (mined: string) => `${mined} of 21,000,000 BTC mined`,
    halving: (blocks: number) =>
        `Next halving in ${blocks.toLocaleString('en-GB')} ${blocks === 1 ? 'block' : 'blocks'}`,
    live: (height: string, reward: string) => `Block ${height}: ${reward} issued.`,
    liveMany: (first: string, last: string, reward: string) => `Blocks ${first} to ${last}: ${reward} issued.`,
    liveAgo: (height: string, reward: string, age: string) => `Block ${height}: ${reward} issued, ${age} ago.`,
    checking: (height: string) => `Estimated block ${height}. Checking the latest block.`,
    offline: (height: string) => `Estimated, offline: block ${height}, assuming a block every 10 minutes.`,
    numbersHeading: 'Every number',
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
    kicker: (height: string) => `Live on block ${height}`,
    kickerEstimate: (height: string) => `Estimated block ${height}`,
    zoom: 'Zoom from all 21 million to single coins',
    zoomAll: 'All 21,000,000 bitcoin, one cell each.',
    zoomCoins: 'Down at the layer being mined now. Each cell is one whole bitcoin.',
    explain:
        'Every bitcoin there will ever be is one cell of this block, stacked in 250 layers of 84,000. Issued coins are orange and fill it from the bottom. On the top layer, the one being mined now, the grey cells are the coins of that layer still to come; the empty frame above is every layer after it.',
} as const;

export const POSTCARD = {
    estimated: ' est.',
    halving: {
        kicker: (height: string) => `Halving clock · block ${height}`,
        number: (blocks: string) => `${blocks} blocks`,
        line: (blocks: string, from: string, to: string, date: string) =>
            `${blocks} blocks to the next halving. The reward drops from ${from} to ${to} around ${date}.`,
        source: (height: string, stamp: string) =>
            `Block ${height} via mempool.space · ${stamp} · date estimated from recent block times`,
        estimate: (height: string) => `Block ${height}, estimated at one block every 10 minutes`,
    },
    tx: {
        kicker: (txid: string) => `Follow a transaction · ${txid}`,
        number: (rate: string) => `${rate} sat/vB`,
        waiting: (rate: string, place: string) => `My transaction pays ${rate} sats per byte. ${place}`,
        confirmed: (height: string, count: string) =>
            `My transaction made it into block ${height}. ${count} confirmations.`,
        source: (stamp: string) => `Transaction and waiting line: mempool.space · ${stamp}`,
    },
    miner: {
        kicker: (height: string) => `Be a miner · block ${height}`,
        number: (best: string) => `${best} zero bits`,
        line: (tries: string, height: string, best: string, needed: string) =>
            `I hashed block ${height} ${tries} times on my own device. Best: ${best} zero bits. A real block needs ${needed}.`,
        source: (stamp: string) => `Header: mempool.space, ${stamp} · every hash worked out in the browser`,
        sourceSaved: (day: string) => `Header: mempool.space, saved ${day} · every hash worked out in the browser`,
    },
    home: { kicker: 'Plain Bitcoin · block height' },
    left: {
        kicker: (height: string) => `${TOOLS.left.name} · block ${height}`,
        line: (left: string) => `${left} BTC are still to be mined.`,
        source: (height: string, api: string, stamp: string) =>
            `Block ${height} · height via ${api} · ${stamp} · supply from the issuance schedule`,
        estimate: (height: string) =>
            `Block ${height} · estimated at one block every 10 minutes · supply from the issuance schedule`,
    },
    power: {
        kicker: (month: string) => `${TOOLS.power.name} · close ${month}`,
        line: (headline: string, bitcoin: string) => `${headline} As bitcoin, ${bitcoin}.`,
        source: (cpi: string, cpiMonth: string, closeMonth: string) =>
            `CPI: ${cpi} to ${cpiMonth} · Bitcoin: Coin Metrics close, ${closeMonth} · calculated in your browser`,
    },
    convert: {
        kicker: (amount: string) => `${TOOLS.convert.name} · ${amount}`,
        source: (price: string) => `Price: ${price} · 1 BTC = 100,000,000 sats`,
    },
    dca: {
        kicker: (day: string) => `${TOOLS.dca.name} · to ${day}`,
        line: (amount: string, every: string, since: string, worth: string, lump: string) =>
            `${amount} ${every} since ${since} is worth ${worth} today. One lump sum: ${lump}.`,
        source: (day: string, fees: string) =>
            `Bitcoin: Coin Metrics daily closes to ${day} · ${fees} · calculated in your browser`,
        fees: (percent: string) => `${percent} fee per buy`,
        noFees: 'fees not included',
    },
    address: {
        kicker: (encoding: string) => `${TOOLS.address.name} · ${encoding}`,
        line: (type: string, network: string) => `This is a ${type} address, typed right. ${network}.`,
    },
} as const;

export const ROUTE = {
    notFound: 'That page does not exist, so here is the home page.',
} as const;

export const FOOTER = {
    privacy: 'Runs in your browser. No tracking. Never asks for keys or seeds.',
    motion: 'Every scene is drawn from real numbers: block headers, block height, prices and price indexes. Nothing moving on this site is made up.',
    barcode: "The line under the top bar is the newest block's hash, one mark per bit.",
    toolsLabel: 'All machines',
    follow: 'Follow @PlainBTC on X',
    handle: '@PlainBTC',
    followUrl: 'https://x.com/PlainBTC',
} as const;

export const NOSCRIPT = {
    needs: 'The tools work out every number in your browser, so they need JavaScript turned on.',
} as const;

export const MINER = {
    kicker: (height: string) => `Live on block ${height}`,
    kickerSaved: (height: string) => `Saved block ${height}`,
    lead: 'Your device hashes the newest real block, exactly the way miners do. Every spark in the well is one of your hashes. The deeper it lands, the more zero bits it starts with.',
    resultLabel: 'Your best hash',
    zeroBits: 'zero bits',
    none: 'Press Start',
    needs: (needed: string) => `A block needs about ${needed}. Every extra zero bit is twice as hard.`,
    start: 'Start hashing',
    stop: 'Stop',
    check: 'Check the real block',
    checking: 'Checking…',
    stats: {
        count: 'Hashes tried',
        rate: 'Your speed',
        network: 'The whole network',
        odds: 'Alone at your speed, one block every',
    },
    years: (count: string) => `${count} years`,
    bestHash: 'Your best hash so far',
    realHash: (height: string) => `Block ${height} with its real nonce, hashed on your device`,
    realOk: (zeros: string, needed: string) =>
        `${zeros} zero bits. It beats the target of about ${needed}, so the block is valid.`,
    realBad: 'This hash does not beat the target.',
    sparks: 'Each spark is a real hash. At full speed one spark stands for many; every hash 12 zero bits or deeper gets its own.',
    loading: 'Reading the newest block header from mempool.space.',
    offline: (day: string) => `Couldn't reach mempool.space. Using a real block saved on ${day}.`,
    source: (api: string, clock: string) => `Header from ${api}, read at ${clock}. Hashed on your device.`,
    sourceSaved: (day: string) => `Header saved from mempool.space on ${day}. Hashed on your device.`,
    howHeading: 'How it works',
    steps: [
        {
            id: 'header',
            title: 'A block starts as 80 bytes',
            body: 'Every block has a short header: the version, the hash of the block before it, a fingerprint of all its transactions, the time, the difficulty and a number called the nonce. This is the real one your device is hashing.',
        },
        {
            id: 'hash',
            title: 'Hash it twice',
            body: 'Run the header through SHA-256, then run the result through SHA-256 again. Out comes a 256-bit number that looks random. Change one byte of the header and the whole number changes.',
        },
        {
            id: 'nonce',
            title: 'Change the nonce, try again',
            body: 'A miner cannot choose the hash, only the nonce. So it counts: nonce 1, nonce 2, nonce 3, hashing each time. That is all mining is, and it is what your device does when you press Start.',
        },
        {
            id: 'target',
            title: 'Hit the target',
            body: 'A block only counts if its hash is below a target, so it has to start with a long run of zero bits. Half of all hashes start with one zero bit, a quarter with two, and so on. The orange ring is the depth the network needs today.',
        },
        {
            id: 'network',
            title: 'Why nobody mines on a phone',
            body: 'The whole network tries that many hashes every second, on machines built only for this. Whoever finds a hash under the target first adds the next block and earns the reward. Every ten minutes or so, someone does.',
        },
    ],
    fields: {
        version: 'Version',
        previous: 'Previous block',
        merkle: 'Transactions fingerprint',
        time: 'Time',
        bits: 'Difficulty bits',
        nonce: 'Winning nonce',
    },
    hashLabel: 'Hash, newest byte first',
    info: {
        summary: 'How this works, in short',
        points: [
            'This page reads the 80-byte header of the newest real block from mempool.space.',
            'Your device changes one number in it, the nonce, and runs the header through SHA-256 twice. A laptop does that up to about a million times a second, in the background.',
            'Each result is a 256-bit number. The more zero bits it starts with, the rarer it is: every extra zero is twice as hard to get.',
            'Every spark in the well is one of your hashes, dropped to the ring of its zero count. The orange ring is the depth a real block needs today.',
            'Check the real block runs the real winning nonce, so you can watch a real block clear the target.',
            'The miner tile on the home page hashes too: 400 real tries every 0.15 seconds, only while it is on screen.',
            'Nothing you do here is sent anywhere, and a block cannot be found this way: the odds above say why.',
        ],
    },
} as const;

export const HALVING = {
    kicker: (height: string) => `Live on block ${height}`,
    kickerEstimate: (height: string) => `Estimated block ${height}`,
    resultLabel: 'Blocks to the next halving',
    unit: 'blocks',
    sentence: (from: string, to: string, at: string) => `The reward drops from ${from} to ${to} at block ${at}.`,
    when: (date: string, pace: string) => `About ${date}, at the recent pace of one block every ${pace}.`,
    whenTarget: (date: string) => `About ${date}, at the target pace of one block every 10 minutes.`,
    scrub: 'Drag through every halving',
    scrubNow: 'Back to now',
    scrubLine: (height: string, reward: string, issued: string) =>
        `Block ${height}: ${reward} a block, ${issued} of all bitcoin issued by then.`,
    erasHeading: 'Every era',
    tableLabel: 'Table of every era, scrolls sideways',
    columns: { era: 'Era', blocks: 'Blocks', reward: 'Reward', ends: 'Ends' },
    endsAbout: (year: string) => `about ${year}`,
    endsDone: (year: string) => year,
    eraNow: 'now',
    explain:
        'Every 210,000 blocks the new bitcoin paid to whoever finds a block halves. Each ring of the clock is one era, half as thick as the one inside it. The bead is the newest block.',
    source: (api: string, clock: string) =>
        `Height from ${api}, read at ${clock}. Dates are estimates from block times.`,
    sourceEstimate: 'Height estimated at one block every 10 minutes: mempool.space did not answer.',
} as const;

export const TX = {
    kicker: 'The waiting line, live from mempool.space',
    resultLabel: 'Fee rate',
    unit: 'sat/vB',
    empty: 'Paste an id, or pick a live one.',
    field: 'Transaction id',
    placeholder: '64 letters and numbers',
    follow: 'Follow',
    pick: 'Pick a live one',
    consent: 'Following asks mempool.space for this one transaction. Nothing else is sent.',
    looking: 'Asking mempool.space…',
    invalid: 'A transaction id is 64 letters and numbers, 0 to 9 and a to f.',
    notFound: 'mempool.space does not know this transaction. It may be too new, dropped, or mistyped.',
    failed: "Couldn't reach mempool.space. Try again in a moment.",
    next: 'Pays enough for the very next block.',
    away: (blocks: string) => `About ${blocks} blocks back in the line.`,
    behind: 'Pays less than everything in the next few blocks, so it may wait a long time.',
    confirmed: (height: string, count: string) => `Confirmed in block ${height}. ${count} confirmations so far.`,
    confirmedOne: (height: string) => `Confirmed in block ${height}, just now.`,
    detail: (fee: string, vsize: string) => `It pays ${fee} sats for ${vsize} virtual bytes.`,
    zoom: 'Zoom from the whole line to your block',
    zoomAll: 'The next blocks on the left, the newest mined blocks on the right.',
    zoomClose: (tx: boolean) =>
        tx ? 'Close up on the block your transaction is in.' : 'Close up on the next block to be mined.',
    lineHeading: 'The next blocks',
    lineLabel: (index: string, floor: string, count: string) =>
        `Block +${index}: from ${floor} sat/vB, ${count} transactions`,
    linePending: 'Reading the waiting line…',
    explain:
        'Miners fill each block with the transactions that pay the most per byte. Left of the orange line, each glass block is one the waiting line would fill right now, the nearest first, each dot about 25 transactions. Right of it are the real blocks just mined. Your transaction is the bright bead, placed by its fee rate.',
    source: (clock: string) =>
        `Waiting line from mempool.space, read at ${clock}. Updated every 30 seconds while this page is open.`,
} as const;

export function pageTitle(page?: string): string {
    return page ? `${page} · ${SITE_NAME}` : SITE_NAME;
}
