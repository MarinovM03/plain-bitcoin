import { TOOLS } from './copy.ts';

/** Postcard words, kept apart from copy.ts so they load with the share code, not with the first page. */
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
    today: {
        kicker: (day: string) => `Bitcoin today · ${day}`,
        number: (price: string) => `1 BTC = ${price}`,
        line: (height: string, fee: string | null, halving: string, left: string) =>
            `Block ${height}.${fee ? ` A payment in the next block costs about ${fee}.` : ''} ${halving} blocks to the halving. ${left} BTC left to mine.`,
        source: (stamp: string) => `Height, fees and price: mempool.space · ${stamp}`,
    },
    stack: {
        kicker: (day: string) => `${TOOLS.stack.name} · ${day}`,
        line: (amount: string, worth: string, yearAgo: string | null) =>
            `${amount} is worth ${worth} today.${yearAgo ? ` A year ago it was worth ${yearAgo}.` : ''}`,
        source: (price: string, day: string) => `Price: ${price} · Coin Metrics daily closes to ${day}`,
    },
    left: {
        kicker: (height: string) => `${TOOLS.left.name} · block ${height}`,
        line: (left: string) => `${left} BTC are still to be mined.`,
        source: (height: string, api: string, stamp: string) =>
            `Block ${height} · height via ${api} · ${stamp} · supply from the issuance schedule`,
        estimate: (height: string) =>
            `Block ${height} · estimated at one block every 10 minutes · supply from the issuance schedule`,
    },
    fees: {
        kicker: (height: string) => `${TOOLS.fees.name} · block ${height}`,
        line: (type: string, sats: string, money: string) =>
            `Sending bitcoin right now: a ${type} payment costs about ${sats} sats (${money}) to make the next block.`,
        source: (stamp: string) => `Fee rates and price: mempool.space · ${stamp} · estimates, not promises`,
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
        line: (amount: string, every: string, since: string, worth: string) =>
            `${amount} ${every} since ${since} is worth ${worth} today.`,
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
