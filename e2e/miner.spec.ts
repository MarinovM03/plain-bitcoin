import { expect, test } from '@playwright/test';
import { SAVED_HEADER } from '../src/data/header.ts';
import { MINER, TOOLS } from '../src/ui/copy.ts';
import { formatWhole } from '../src/util/format.ts';
import { fakeHeaderApi, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('the miner hashes a real header on the device and checks the real block', async ({ page }) => {
    const headers = await fakeHeaderApi(page);
    await page.goto('/?hero=still#/miner');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.miner.name);
    const run = page.locator('#miner-run');
    await expect(run).toBeEnabled();
    expect(headers).toHaveLength(1);
    await expect(page.locator('#header-nonce')).toHaveText(formatWhole(953641893));
    await expect(page.locator('#miner-needs')).toHaveText(MINER.needs('78'));

    await run.click();
    await expect(run).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#miner-best')).toHaveAttribute('data-roll', /^\d+$/);
    await expect(page.locator('#miner-hash .hash-text__zeros')).not.toBeEmpty();
    await expect(page.locator('#miner-rate')).toHaveText(/H\/s$/);
    await expect(page.locator('#miner-odds')).toHaveText(/years$/);
    await run.click();
    await expect(run).toHaveAttribute('aria-pressed', 'false');
    const count = await page.locator('#miner-count').textContent();
    await page.waitForTimeout(400);
    await expect(page.locator('#miner-count')).toHaveText(count ?? '');

    await page.locator('#miner-check').click();
    await expect(page.locator('#real-hash')).toHaveText(SAVED_HEADER.hash);
    await expect(page.locator('#real-verdict')).toHaveText(MINER.realOk('79', '78'));
    await expect(page.locator('.share-bar [data-share="print"]')).toBeEnabled();
});

test('with mempool.space out of reach the miner hashes the saved block and says so', async ({ page }) => {
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\//, (route) => route.abort());
    await page.goto('/?hero=still#/miner');
    await expect(page.locator('#miner-run')).toBeEnabled({ timeout: 10_000 });
    await expect(page.locator('#miner-kicker-text')).toHaveText(MINER.kickerSaved(formatWhole(SAVED_HEADER.height)));
    await expect(page.locator('#tool-source')).toContainText('saved');
});

test('the scene box is hidden from assistive tech and the canvas never takes a pointer', async ({ page }) => {
    await fakeHeaderApi(page);
    await page.goto('/#/miner');
    const stage = page.locator('.machine__stage');
    await expect(stage).toHaveAttribute('aria-hidden', 'true');
    await expect(stage.locator('a, button, [tabindex]')).toHaveCount(0);
    const canvas = page.locator('canvas.stage-canvas');
    if ((await canvas.count()) > 0) {
        await expect(canvas).toHaveCSS('position', 'fixed');
        await expect(canvas).toHaveCSS('pointer-events', 'none');
        await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    }
});
