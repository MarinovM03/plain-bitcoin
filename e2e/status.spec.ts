import { expect, type Page, test } from '@playwright/test';
import { STATUS } from '../src/ui/copy.ts';
import { formatWhole } from '../src/util/format.ts';
import { FAKE_HEIGHT, fakeHeightApi, isApiRequest } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const LIVE_ROUTES = ['', 'left', 'convert'] as const;
const QUIET_ROUTES = ['power', 'dca', 'address'] as const;

function apiCalls(page: Page): string[] {
    const calls: string[] = [];
    page.on('request', (request) => {
        if (isApiRequest(request.url())) calls.push(request.url());
    });
    return calls;
}

const tipCalls = (calls: string[]) => calls.filter((url) => url.endsWith('/blocks/tip/height'));
const priceCalls = (calls: string[]) => calls.filter((url) => /\/v1\/prices$|coingecko/.test(url));

for (const route of LIVE_ROUTES) {
    test(`#/${route} shows the live block and price with a source`, async ({ page }) => {
        await fakeHeightApi(page);
        await fakePriceApi(page);
        await page.goto(`/?hero=plain#/${route}`);
        const status = page.getByRole('group', { name: STATUS.label });
        await expect(status.locator('#status-block')).toHaveText(STATUS.block(formatWhole(FAKE_HEIGHT)));
        await expect(status.locator('#status-gbp')).toHaveText('£57,329');
        await expect(status.locator('#status-source')).toHaveText(/^mempool\.space \d\d:\d\d UTC$/);
        await expect(status).toHaveAttribute('data-state', 'live');
        await expect(status).toHaveAttribute('aria-live', 'off');
    });
}

for (const route of ['left', 'convert'] as const) {
    test(`#/${route} runs one price poller and one height poller`, async ({ page }) => {
        await fakeHeightApi(page);
        await fakePriceApi(page);
        const calls = apiCalls(page);
        await page.goto(`/?hero=plain#/${route}`);
        await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
        await page.waitForTimeout(4000);
        expect(tipCalls(calls)).toHaveLength(1);
        expect(priceCalls(calls)).toHaveLength(1);
    });
}

for (const route of QUIET_ROUTES) {
    test(`#/${route} fetches nothing and labels the status as an estimate`, async ({ page }) => {
        const calls = apiCalls(page);
        await page.goto(`/#/${route}`);
        await expect(page.locator('#status-block')).toHaveText(new RegExp(`${STATUS.estimated.trim()}$`));
        await expect(page.locator('#status-source')).toHaveText(/^last close /);
        await expect(page.locator('#status')).toHaveAttribute('data-state', 'estimate');
        await page.waitForTimeout(3000);
        expect(calls).toEqual([]);
    });
}

test('leaving the live routes stops polling and keeps the last value with its time', async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
    const calls = apiCalls(page);
    await page.goto('/#/convert');
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
    await page.goto('/#/power');
    const before = calls.length;
    await page.waitForTimeout(3000);
    expect(calls).toHaveLength(before);
    await expect(page.locator('#status-gbp')).toHaveText('£57,329');
    await expect(page.locator('#status-source')).toHaveText(/^mempool\.space \d\d:\d\d UTC$/);
});

test('offline, the status falls back to the labelled estimate and last close', async ({ page }) => {
    await page.route(/^https:\/\//, (route) => route.abort('internetdisconnected'));
    await page.goto('/?hero=plain#/');
    await expect(page.locator('#status-block')).toHaveText(new RegExp(`${STATUS.estimated.trim()}$`));
    await expect(page.locator('#status-source')).toHaveText(/^last close /);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'estimate');
});

test('the status figures never wrap mid-number on a 360px phone', async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/?hero=plain#/');
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
    for (const id of ['#status-block', '#status-gbp', '#status-usd']) {
        const box = await page.locator(id).boundingBox();
        expect(box?.height ?? 0, id).toBeLessThan(24);
    }
});
