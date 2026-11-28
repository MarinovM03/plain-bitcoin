import type { Page } from '@playwright/test';
import { SAVED_HEADER } from '../src/data/header.ts';
import { HEIGHT_ANCHOR } from '../src/data/height.ts';
import { supplyAt } from '../src/model/supply.ts';
import { formatBtcExact } from '../src/util/format.ts';

export const API_HOSTS = ['mempool.space', 'blockstream.info', 'api.coingecko.com'];

export interface FakeChain {
    height: number;
    calls: string[];
}

export const FAKE_HEIGHT = HEIGHT_ANCHOR.height;
export const FAKE_AGE_SECONDS = 252;

export function leftFigure(height = FAKE_HEIGHT): string {
    return formatBtcExact(supplyAt(height).left);
}

/** A made-up but well-formed hash for a height: twenty zeros of "work", then digits that differ per block. */
export function fakeHash(height: number): string {
    const tail = (BigInt(height) * 0x9e3779b97f4a7c15n).toString(16).padStart(16, '0').slice(-16);
    return `${'0'.repeat(20)}${tail.repeat(3).slice(0, 44)}`;
}

function fakeBlocks(tip: number, now: number) {
    return Array.from({ length: 10 }, (_, index) => ({
        id: fakeHash(tip - index),
        height: tip - index,
        timestamp: now - FAKE_AGE_SECONDS - index * 540,
        tx_count: 1200 + ((tip - index) % 7) * 550,
        size: 900_000 + ((tip - index) % 5) * 260_000,
        weight: 3_990_000,
    }));
}

export const FAKE_LINE = [
    { blockVSize: 997_975, nTx: 2834, feeRange: [4.2, 9, 90] },
    { blockVSize: 997_994, nTx: 2110, feeRange: [2.1, 3, 4] },
    { blockVSize: 640_000, nTx: 1500, feeRange: [1.01, 1.5, 2] },
];
/** Rates mempool.space recommends: a quiet mempool, 4 sat/vB for the next block down to 1 for no rush. */
export const FAKE_FEES = { fastestFee: 4, halfHourFee: 3, hourFee: 2, economyFee: 1, minimumFee: 1 };

export const FAKE_TXID = 'ab4a72238770e7711921162f8285759b0bb6365999235b12569de1b6f306dfc6';

/**
 * The waiting line, the recommended fee rates, the recent list and one waiting transaction paying 2.5 sat/vB: the
 * second projected block.
 */
export async function fakeMempoolApi(page: Page): Promise<string[]> {
    const calls: string[] = [];
    const headers = { 'access-control-allow-origin': '*' };
    await page.route(
        /^https:\/\/mempool\.space\/api\/(v1\/fees\/(mempool-blocks|recommended)|mempool\/recent|tx\/\w+)$/,
        (route) => {
            const url = route.request().url();
            calls.push(url);
            if (url.endsWith('/mempool-blocks')) return route.fulfill({ json: FAKE_LINE, headers });
            if (url.endsWith('/recommended')) return route.fulfill({ json: FAKE_FEES, headers });
            if (url.endsWith('/mempool/recent')) return route.fulfill({ json: [{ txid: FAKE_TXID }], headers });
            if (url.endsWith(`/tx/${FAKE_TXID}`)) {
                return route.fulfill({
                    json: { txid: FAKE_TXID, fee: 1000, weight: 1600, status: { confirmed: false } },
                    headers,
                });
            }
            return route.fulfill({ status: 404, body: 'Transaction not found', headers });
        },
    );
    return calls;
}

export async function fakeHeightApi(page: Page, height = FAKE_HEIGHT): Promise<FakeChain> {
    const chain: FakeChain = { height, calls: [] };
    await fakeMempoolApi(page);
    await fakeHeaderApi(page);
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\/api\/blocks\//, (route) => {
        const url = route.request().url();
        chain.calls.push(url);
        const headers = { 'access-control-allow-origin': '*' };
        if (url.endsWith('/blocks/tip/height')) return route.fulfill({ body: String(chain.height), headers });
        const at = Number(url.split('/').at(-1));
        return route.fulfill({ json: fakeBlocks(at, Math.floor(Date.now() / 1000)), headers });
    });
    return chain;
}

export function isApiRequest(url: string): boolean {
    return API_HOSTS.includes(new URL(url).hostname);
}

/** Every header request gets the saved real header, so the miner checks a real block whatever the fake tip says. */
export async function fakeHeaderApi(page: Page): Promise<string[]> {
    const calls: string[] = [];
    await page.route(/^https:\/\/mempool\.space\/api\/block\/[0-9a-f]{64}\/header$/, (route) => {
        calls.push(route.request().url());
        return route.fulfill({ body: SAVED_HEADER.hex, headers: { 'access-control-allow-origin': '*' } });
    });
    return calls;
}
