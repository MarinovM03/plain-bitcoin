import type { Page } from '@playwright/test';

export const LIVE_PRICE = { gbp: 57_329, usd: 76_777 };

const PRICE_URL = /^https:\/\/(mempool\.space\/api\/v1\/prices|api\.coingecko\.com\/)/;

export interface FakePrices {
    calls: string[];
    down: boolean;
}

export async function fakePriceApi(page: Page, down = false): Promise<FakePrices> {
    const prices: FakePrices = { calls: [], down };
    await page.route(PRICE_URL, (route) => {
        const url = route.request().url();
        prices.calls.push(url);
        if (prices.down) return route.abort('internetdisconnected');
        const headers = { 'access-control-allow-origin': '*' };
        const time = Math.floor(Date.now() / 1000) - 30;
        if (url.includes('coingecko')) {
            return route.fulfill({
                json: { bitcoin: { ...LIVE_PRICE, last_updated_at: time } },
                headers,
            });
        }
        return route.fulfill({ json: { time, USD: LIVE_PRICE.usd, GBP: LIVE_PRICE.gbp }, headers });
    });
    return prices;
}
