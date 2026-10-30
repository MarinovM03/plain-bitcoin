import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { HERO, LEFT_PAGE, SHARE } from '../src/ui/copy.ts';
import { fakeHeightApi, isApiRequest } from './height-api.ts';

function watch(page: Page) {
    const problems: string[] = [];
    const scripts: string[] = [];
    const external: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        const url = request.url();
        if (request.resourceType() === 'script') scripts.push(new URL(url).pathname);
        if (new URL(url).hostname !== 'localhost') external.push(url);
    });
    return { problems, scripts, external };
}

function pngSize(path: string): [number, number] {
    const bytes = readFileSync(path);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('home counts down from the live height and links to every number', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    const { problems, external } = watch(page);
    await page.goto('/');

    await expect(page.locator('#hero-figure')).toHaveText('894,203.1019 BTC');
    await expect(page.locator('#hero-note')).toHaveText(/^Block 973,854: 3\.125 BTC issued, 4 min 1\d s ago\.$/);
    await expect(page.locator('#hero-stage')).toHaveAttribute('data-tier', /^(full|phone|plain)$/);
    await page.getByRole('link', { name: HERO.link }).click();
    await expect(page).toHaveURL(/#\/left$/);

    expect(external.every(isApiRequest)).toBe(true);
    expect(chain.calls[0]).toBe('https://mempool.space/api/blocks/tip/height');
    expect(problems).toEqual([]);
});

test('the numbers panel shows every figure for the live height', async ({ page }) => {
    await fakeHeightApi(page);
    const { problems } = watch(page);
    await page.goto('/#/left');

    const panel = page.locator('#numbers-panel');
    await expect(panel.locator('#left-height')).toHaveText('973,854');
    await expect(panel.locator('#left-left')).toHaveText('894,203.10190000 BTC');
    await expect(panel.locator('#left-issued')).toHaveText('20,105,796.87500000 BTC');
    await expect(panel.locator('#left-share')).toHaveText('95.7418%');
    await expect(panel.locator('#left-reward')).toHaveText('3.125 BTC');
    await expect(panel.locator('#left-halving')).toHaveText('Block 1,050,000, in 76,146 blocks');
    await expect(panel.locator('#left-next-reward')).toHaveText('1.5625 BTC');
    await expect(panel.locator('#left-halving-date')).toHaveText(
        /^About \d{1,2} \w+ 20\d\d, assuming 10-minute blocks$/,
    );
    await expect(panel.locator('#left-max')).toHaveText('20,999,999.9769 BTC');
    await expect(page.locator('#tool-source')).toContainText('mempool.space, checked');
    await expect(page.getByText(LEFT_PAGE.honesty)).toBeVisible();
    expect(problems).toEqual([]);
});

test('the share card downloads with the sentence and the block', async ({ page, isMobile }) => {
    await fakeHeightApi(page);
    await page.goto('/#/left');
    await expect(page.locator('[data-share="download"]')).toBeEnabled();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-share="download"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('plain-bitcoin-left-973854.png');
    const path = await download.path();
    expect(pngSize(path)).toEqual(isMobile ? [1080, 1350] : [1200, 675]);
    await expect(page.locator('#left-status')).toHaveText(SHARE.downloaded);
});

test('offline, it estimates the height from the anchor and says so', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false });
    });
    const { problems } = watch(page);
    await page.goto('/#/left');

    await expect(page.locator('#hero-note')).toHaveText(/^Estimated, offline: block [\d,]+, assuming a block/);
    await expect(page.locator('#tool-source')).toContainText('estimated offline from block 973,854');
    await expect(page.locator('[data-share="card"]')).toBeDisabled();
    await expect(page.locator('#left-status')).toHaveText(LEFT_PAGE.shareOffline);
    expect(chain.calls).toEqual([]);
    expect(problems).toEqual([]);
});

test('a new block is picked up on the next poll and announced once', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/');
    await expect(page.locator('#hero-figure')).toHaveText('894,203.1019 BTC');

    chain.height += 1;
    await page.clock.runFor(46_000);
    await expect(page.locator('#hero-figure')).toHaveText('894,199.9769 BTC');
    await expect(page.locator('#announcer')).toHaveText('Block 973,855: 3.125 BTC issued.');

    await page.clock.runFor(46_000);
    await expect(page.locator('#hero-figure')).toHaveText('894,199.9769 BTC');
    const heightCalls = chain.calls.filter((url) => url.endsWith('/tip/height'));
    const blockCalls = chain.calls.filter((url) => /\/blocks\/\d+$/.test(url));
    expect(heightCalls).toHaveLength(3);
    expect(blockCalls).toHaveLength(2);
});

test('calculator routes never load three.js or call the height API', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    const { scripts, external, problems } = watch(page);
    await page.goto('/#/convert');
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.goto('/#/power');
    await expect(page.locator('#power-detail')).toBeVisible();
    await page.waitForTimeout(1500);

    expect(scripts.filter((path) => /\/(three|scene|post|plain|worker)-/.test(path))).toEqual([]);
    expect(external).toEqual([]);
    expect(chain.calls).toEqual([]);
    expect(problems).toEqual([]);
});

test('the WebGL hero renders without errors when forced on', async ({ page }) => {
    await fakeHeightApi(page);
    const { problems, scripts } = watch(page);
    await page.goto('/?hero=phone');
    await expect(page.locator('#hero-stage canvas.is-ready')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('#hero-stage')).toHaveAttribute('data-tier', 'phone');
    expect(scripts.some((path) => /\/(three|worker)-/.test(path))).toBe(true);
    // Headless Chromium draws WebGL in software; its driver notes are about that renderer, not the page.
    expect(problems.filter((text) => !text.includes('GL Driver Message'))).toEqual([]);
});
