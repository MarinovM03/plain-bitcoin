import { expect, test } from '@playwright/test';
import { halvingClock } from '../src/model/halving.ts';
import { LEFT_PAGE, TOOLS, TX } from '../src/ui/copy.ts';
import { formatWhole } from '../src/util/format.ts';
import { FAKE_HEIGHT, FAKE_TXID, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('the halving clock counts down from the live height and lets you drag through the eras', async ({ page }) => {
    await page.goto('/halving?hero=still');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.halving.name);
    const clock = halvingClock(FAKE_HEIGHT, Date.now(), null);
    await expect(page.locator('#halving-blocks')).toHaveAttribute('data-roll', formatWhole(clock.blocks));
    await expect(page.locator('#halving-eras tr')).toHaveCount(9);
    await expect(page.locator('#halving-eras .era-table__now')).toHaveCount(1);
    await expect(page.locator('#halving-eras tr').first()).toContainText('2012');

    const scrub = page.locator('#halving-scrub');
    await scrub.fill('0');
    await expect(page.locator('#halving-scrub-line')).toContainText('Block 0: 50 BTC a block');
    await page.locator('#halving-now').click();
    await expect(page.locator('#halving-now')).toBeHidden();
    await expect(page.locator('.share-bar [data-share="print"]')).toBeEnabled();
});

test('following a transaction places it in the waiting line, and only after a tap', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => asked.push(request.url()));
    await page.goto('/tx?hero=still');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.tx.name);
    await expect(page.locator('#tx-line li')).toHaveCount(3);
    expect(asked.some((url) => url.includes('/api/tx/'))).toBe(false);

    await page.locator('#tx-id').fill('not a txid');
    await page.getByRole('button', { name: TX.follow }).click();
    await expect(page.locator('#tx-sentence')).toHaveText(TX.invalid);

    await page.getByRole('button', { name: TX.pick }).click();
    await expect(page.locator('#tx-id')).toHaveValue(FAKE_TXID);
    await expect(page.locator('#tx-rate')).toHaveAttribute('data-roll', '2.5');
    await expect(page.locator('#tx-sentence')).toHaveText(TX.away('2'));
    await expect(page.locator('#tx-line .line-list__mine')).toHaveCount(1);
    await expect(page.locator('.share-bar [data-share="print"]')).toBeEnabled();
});

test('a transaction mempool.space does not know says so plainly', async ({ page }) => {
    await page.goto('/tx?hero=still');
    await page.locator('#tx-id').fill('f'.repeat(64));
    await page.getByRole('button', { name: TX.follow }).click();
    await expect(page.locator('#tx-sentence')).toHaveText(TX.notFound);
});

test('Bitcoin left zooms the block from all 21 million to single coins', async ({ page }) => {
    await page.goto('/left?hero=still');
    const zoom = page.locator('#left-zoom');
    await zoom.fill('100');
    await expect(page.locator('#left-zoom-line')).toHaveText(LEFT_PAGE.zoomCoins);
    await zoom.fill('0');
    await expect(page.locator('#left-zoom-line')).toHaveText(LEFT_PAGE.zoomAll);
});
