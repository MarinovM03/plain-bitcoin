import { expect, type Page, test } from '@playwright/test';
import { FEES, TOOLS } from '../src/ui/copy.ts';
import { FAKE_FEES, fakeHeightApi } from './height-api.ts';
import { fakePriceApi, LIVE_PRICE } from './price-api.ts';

function watch(page: Page) {
    const problems: string[] = [];
    const external: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.hostname !== 'localhost') external.push(`${url.hostname}${url.pathname}`);
    });
    return { problems, external };
}

const dollars = (sats: number) => `$${((sats / 1e8) * LIVE_PRICE.usd).toFixed(2)}`;

test('prices a usual SegWit payment at every wait from the live rates, asking only mempool.space', async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
    const { problems, external } = watch(page);
    await page.goto('/fees?hero=still');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.fees.name);
    const next = Math.ceil(FAKE_FEES.fastestFee * 141);
    await expect(page.locator('#tool-result-figure')).toHaveText(dollars(next));
    await expect(page.locator('#tool-result')).toHaveText(
        `A SegWit payment costs about ${next} sats (${dollars(next)}) to make the next block.`,
    );
    await expect(page.locator('#fees-noRush')).toHaveText(`1 sat/vB · ${dollars(141)} · 141 sats`);
    await expect(page.locator('#picture-plot > svg.gauge-svg')).toHaveCount(1);
    await expect(page.locator('.share-bar [data-share="print"]')).toBeEnabled();
    await expect(page.locator('#tool-source')).toContainText('Fee rates: mempool.space');
    expect(external.every((host) => host.startsWith('mempool.space/'))).toBe(true);
    expect(external).toContain('mempool.space/api/v1/fees/recommended');
    expect(problems).toEqual([]);
});

test('the wallet type, coins spent and outputs change the size and the cost', async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
    await page.goto('/fees?hero=still');
    await expect(page.locator('#tool-result-detail')).toContainText('about 141 virtual bytes');
    await page.locator('label', { hasText: FEES.types.legacy }).click();
    await expect(page.locator('#tool-result-detail')).toContainText('about 226 virtual bytes');
    await page.locator('label', { hasText: FEES.types.taproot }).click();
    await page.locator('#fees-inputs').fill('3');
    await expect(page.locator('#tool-result-detail')).toContainText('about 269 virtual bytes');
    await page.locator('#fees-outputs').fill('1');
    await expect(page.locator('#tool-result-detail')).toContainText('about 226 virtual bytes');
});

test('says so plainly when mempool.space cannot be reached, and shares nothing', async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
    await page.route(/\/api\/v1\/fees\/recommended$/, (route) => route.abort('internetdisconnected'));
    await page.goto('/fees?hero=still');
    await expect(page.locator('#tool-result')).toHaveText(FEES.failed);
    await expect(page.locator('#tool-result-figure')).toHaveText('—');
    await expect(page.locator('.share-bar [data-share="print"]')).toBeDisabled();
});
