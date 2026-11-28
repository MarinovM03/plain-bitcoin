import type { ToolId } from '../tools/index.ts';

/** What each tool does, in a few short lines. Kept apart from copy.ts so it loads with the page, not the first one. */
export const INFO: Record<ToolId, readonly string[]> = {
    miner: [
        'This page reads the 80-byte header of the newest real block from mempool.space.',
        'Your device changes one number in it, the nonce, and runs the header through SHA-256 twice. A laptop does that up to about a million times a second, in the background.',
        'Each result is a 256-bit number. The more zero bits it starts with, the rarer it is: every extra zero is twice as hard to get.',
        'Every spark in the well is one of your hashes, dropped to the ring of its zero count. The orange ring is the depth a real block needs today.',
        'Check the real block runs the real winning nonce, so you can watch a real block clear the target.',
        'A block cannot be found this way: the odds above say why.',
    ],
    left: [
        'There will only ever be 21,000,000 bitcoin. New coins appear only as the reward for each new block.',
        'This page reads the newest block height from mempool.space and works out from the issuance schedule how many coins exist.',
        'Each cell of the block is one bitcoin. Orange cells are mined; on the top layer, the darker orange cells are still to come.',
        'Drag the zoom to go from all 21 million down to single coins.',
    ],
    halving: [
        'Every 210,000 blocks, about every four years, the new bitcoin paid for each block halves.',
        'This page reads the newest block height from mempool.space and counts the blocks to the next halving.',
        'The date is an estimate: it assumes blocks keep coming at their recent pace, about one every 10 minutes.',
        'Each ring is one era of the reward, half as thick as the one inside it.',
    ],
    tx: [
        'Miners fill each block with the transactions that pay the most per byte, so a transaction waits in line by its fee rate.',
        'This page reads the waiting line from mempool.space every 30 seconds while it is open.',
        'Paste a transaction id, or pick a live one, and see where it sits and roughly when it should be mined.',
        'The orange line under the top bar is the same clock: it fills over the ten minutes a block takes on average and empties when one is found.',
        'A transaction id is public on the chain. Nothing else about you is sent.',
    ],
    fees: [
        'Miners pick the transactions that pay the most per byte, so what you need to pay depends on how busy the network is right now.',
        "This page reads mempool.space's recommended fee rates, in sats per virtual byte, every 30 seconds and on every new block.",
        "Your payment's size depends on your wallet type, the coins it spends and the outputs. Fee = rate × size.",
        'When the network is busy, waiting longer costs less. When it is quiet, every wait costs the same.',
    ],
    stack: [
        'Type how much bitcoin you hold to see what it is worth at the live price.',
        "Tap Keep on this device and the amount is saved in this browser's own storage. Your next visit shows how far it moved since the last one.",
        'It never leaves your device. There is no account and no server that could see it. Forget it deletes it.',
        'The chart is your amount valued at each daily close of the last year.',
    ],
    convert: [
        '1 bitcoin is 100,000,000 sats. Sats are how small amounts are counted.',
        'Type in any box and the others follow, at the live price from mempool.space, with CoinGecko if it does not answer.',
        'Offline it uses the last daily close bundled with the site, and says so.',
    ],
    dca: [
        'Buying a fixed amount on a schedule, whatever the price, is called dollar-cost averaging, or DCA.',
        'This page replays your plan on real daily closes (Coin Metrics), from your start month to the latest close.',
        'Each buy gets more bitcoin when the price is low and less when it is high. The orange line is what it was all worth on each day.',
        'Fees are optional: add your exchange fee under More options to see what it costs over the years.',
    ],
    power: [
        'Prices rise over time, so the same cash buys less each year. That is inflation.',
        'This page uses the official consumer price index (US Bureau of Labor Statistics, or the UK Office for National Statistics), bundled with the site.',
        "The orange column is the same money put into bitcoin that month, at the month-end close, and valued at today's close.",
        'Drag back through the years and watch both columns change.',
    ],
    address: [
        'Every Bitcoin address carries a checksum, so most typos are caught before any money moves.',
        'This page checks the address in your browser: its type, its network and its checksum.',
        'Nothing is sent unless you tap Look up, which asks mempool.space for its balance.',
        'It never asks for keys or seeds. No honest tool does.',
    ],
};

export const PRIVATE = 'No accounts, no cookies, no analytics: the site collects nothing about you.';
