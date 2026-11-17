import { describe, expect, it } from 'vitest';
import { blocksAway, confirmations, feeRate, isTxid, maskTxid, parseLine, parseRecent, parseTx } from './tx.ts';

const TXID = 'ab4a72238770e7711921162f8285759b0bb6365999235b12569de1b6f306dfc6';

describe('transactions', () => {
    it('reads a waiting and a confirmed transaction, and refuses anything else', () => {
        expect(parseTx({ txid: TXID, fee: 779, weight: 1476, status: { confirmed: false } })).toEqual({
            txid: TXID,
            fee: 779,
            vsize: 369,
            confirmed: false,
            blockHeight: null,
            blockTime: null,
        });
        const mined = parseTx({
            txid: TXID.toUpperCase(),
            fee: 1,
            weight: 400,
            status: { confirmed: true, block_height: 900, block_time: 1700000000 },
        });
        expect(mined?.blockHeight).toBe(900);
        expect(mined?.txid).toBe(TXID);
        expect(parseTx({ txid: TXID, fee: 1, weight: 400, status: { confirmed: true } })).toBeNull();
        expect(parseTx({ txid: 'nope', fee: 1, weight: 400, status: {} })).toBeNull();
        expect(parseTx(null)).toBeNull();
    });

    it('ranks by sats per virtual byte', () => {
        expect(feeRate({ fee: 779, vsize: 369 })).toBeCloseTo(2.111, 3);
        expect(feeRate({ fee: 5, vsize: 0 })).toBe(0);
    });

    it('reads the waiting line until the first entry that does not fit', () => {
        const line = parseLine([
            { blockVSize: 997_975.75, nTx: 2834, feeRange: [2.03, 89.6] },
            { blockVSize: 500_000, nTx: 1200, feeRange: [1.01, 2] },
            { blockVSize: 'big', nTx: 3, feeRange: [1] },
            { blockVSize: 1, nTx: 1, feeRange: [1] },
        ]);
        expect(line.floors).toEqual([2.03, 1.01]);
        expect(line.fills[0]).toBeCloseTo(0.998, 3);
        expect(line.fills[1]).toBe(0.5);
        expect(line.counts).toEqual([2834, 1200]);
        expect(parseLine('nope')).toEqual({ floors: [], fills: [], counts: [] });
    });

    it('places a fee rate in the first block it reaches, or nowhere', () => {
        const floors = [5, 3, 1.2];
        expect(blocksAway(8, floors)).toBe(1);
        expect(blocksAway(3, floors)).toBe(2);
        expect(blocksAway(1.5, floors)).toBe(3);
        expect(blocksAway(1, floors)).toBeNull();
        expect(blocksAway(0, floors)).toBeNull();
    });

    it('counts confirmations from the block that holds it', () => {
        expect(confirmations(900, 900)).toBe(1);
        expect(confirmations(905, 900)).toBe(6);
        expect(confirmations(905, null)).toBe(0);
    });

    it('accepts only well-formed ids and never prints one in full', () => {
        expect(isTxid(` ${TXID} `)).toBe(true);
        expect(isTxid(`${TXID}0`)).toBe(false);
        expect(parseRecent([{ txid: TXID }, { txid: 'x' }, 4])).toEqual([TXID]);
        expect(maskTxid(TXID)).toBe('ab4a7223…f306dfc6');
    });
});
