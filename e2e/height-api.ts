import type { Page } from '@playwright/test';

export const API_HOSTS = ['mempool.space', 'blockstream.info'];

export interface FakeChain {
    height: number;
    calls: string[];
}

export async function fakeHeightApi(page: Page, height = 973_854): Promise<FakeChain> {
    const chain: FakeChain = { height, calls: [] };
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\//, (route) => {
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
