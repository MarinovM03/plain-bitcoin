import type { Page } from '@playwright/test';
import { HEIGHT_ANCHOR } from '../src/data/height.ts';
import { supplyAt } from '../src/model/supply.ts';
import { formatBtcExact } from '../src/util/format.ts';

export const API_HOSTS = ['mempool.space', 'blockstream.info', 'api.coingecko.com'];

export interface FakeChain {
    height: number;
    calls: string[];
}

export const FAKE_HEIGHT = HEIGHT_ANCHOR.height;

export function leftFigure(height = FAKE_HEIGHT): string {
    return formatBtcExact(supplyAt(height).left);
}

export async function fakeHeightApi(page: Page, height = FAKE_HEIGHT): Promise<FakeChain> {
    const chain: FakeChain = { height, calls: [] };
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\/api\/blocks\//, (route) => {
        const url = route.request().url();
        chain.calls.push(url);
        const headers = { 'access-control-allow-origin': '*' };
        if (url.endsWith('/blocks/tip/height')) return route.fulfill({ body: String(chain.height), headers });
        const at = Number(url.split('/').at(-1));
        return route.fulfill({ json: [{ height: at, timestamp: Math.floor(Date.now() / 1000) - 252 }], headers });
    });
    return chain;
}

export function isApiRequest(url: string): boolean {
    return API_HOSTS.includes(new URL(url).hostname);
}
