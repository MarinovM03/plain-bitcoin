import { expect, type Page, test } from '@playwright/test';
import { SATS_PER_BTC, supplyAt } from '../src/model/supply.ts';
import { HOME, LEFT_PAGE, TOOLS } from '../src/ui/copy.ts';
import { formatBtc, formatPpm, formatWhole } from '../src/util/format.ts';
import { realProblems } from './console.ts';
import { FAKE_HEIGHT, fakeHeightApi, isApiRequest, leftFigure } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const SUPPLY = supplyAt(FAKE_HEIGHT);
const BLOCK = formatWhole(FAKE_HEIGHT);

test.beforeEach(async ({ page }) => {
    await fakePriceApi(page);
});

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

test('home shows the live amount left and the left page counts down from the live height', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    const { problems, external } = watch(page);
    await page.goto('/');

    const whole = formatWhole(Math.floor(SUPPLY.left / SATS_PER_BTC));
    await expect(page.locator('[data-tile-figure="left"]')).toHaveText(HOME.leftFigure(`${whole} BTC`));
    await page.locator('.tile', { hasText: TOOLS.left.name }).click();
    await expect(page).toHaveURL(/#\/left$/);

    await expect(page.locator('#left-figure')).toHaveText(leftFigure());
    await expect(page.locator('#left-note')).toHaveText(
        new RegExp(String.raw`^Block ${BLOCK}: 3\.125 BTC issued, 4 min 1\d s ago\.$`),
    );
    await expect(page.locator('#left-supply')).toHaveText(
        /^[\d,]+ of 21,000,000 BTC minedNext halving in [\d,]+ blocks$/,
    );
    await expect(page.locator('#stage')).toHaveAttribute('data-tier', /^(full|phone|plain)$/);
    expect(external.every(isApiRequest)).toBe(true);
    expect(chain.calls[0]).toBe('https://mempool.space/api/blocks/tip/height');
    expect(realProblems(problems)).toEqual([]);
});

test('the numbers panel shows every figure for the live height', async ({ page }) => {
    await fakeHeightApi(page);
    const { problems } = watch(page);
    await page.goto('/#/left');

    const panel = page.locator('#numbers-panel');
    await expect(panel.locator('#left-height')).toHaveText(BLOCK);
    await expect(panel.locator('#left-left')).toHaveText(formatBtc(SUPPLY.left));
    await expect(panel.locator('#left-issued')).toHaveText(formatBtc(SUPPLY.issued));
    await expect(panel.locator('#left-share')).toHaveText(formatPpm(SUPPLY.issuedPpm));
    await expect(panel.locator('#left-reward')).toHaveText('3.125 BTC');
    await expect(panel.locator('#left-halving')).toHaveText(
        `Block 1,050,000, in ${formatWhole(SUPPLY.blocksToHalving)} blocks`,
    );
    await expect(panel.locator('#left-next-reward')).toHaveText('1.5625 BTC');
    await expect(panel.locator('#left-halving-date')).toHaveText(
        /^About \d{1,2} \w+ 20\d\d, assuming 10-minute blocks$/,
    );
    await expect(panel.locator('#left-max')).toHaveText('20,999,999.9769 BTC');
    await expect(page.locator('#tool-source')).toContainText('mempool.space, checked');
    await expect(page.getByText(LEFT_PAGE.honesty)).toBeVisible();
    await expect(page.locator('#scene-caption')).toHaveText(/^Each dot is 10,000 BTC\./);
    expect(realProblems(problems)).toEqual([]);
});

test('offline, it estimates the height from the anchor and says so', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false });
    });
    const { problems } = watch(page);
    await page.goto('/#/left');

    await expect(page.locator('#left-note')).toHaveText(/^Estimated, offline: block [\d,]+, assuming a block/);
    await expect(page.locator('#tool-source')).toContainText(`estimated offline from block ${BLOCK}`);
    await expect(page.locator('[data-share="card"]')).toBeDisabled();
    await expect(page.locator('#left-status')).toHaveText(LEFT_PAGE.shareOffline);
    expect(chain.calls).toEqual([]);
    expect(realProblems(problems)).toEqual([]);
});

test('a new block is picked up on the next poll and announced once', async ({ page, browserName }) => {
    test.skip(
        browserName === 'webkit',
        'Under the fake clock the counter never renders in WebKit; polling is unit tested',
    );
    const chain = await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/#/left');
    await page.clock.runFor(500);
    await expect(page.locator('#left-figure')).toHaveText(leftFigure());

    chain.height += 1;
    await page.clock.runFor(46_000);
    await expect(page.locator('#left-figure')).toHaveText(leftFigure(FAKE_HEIGHT + 1));
    await expect(page.locator('#announcer')).toHaveText(`Block ${formatWhole(FAKE_HEIGHT + 1)}: 3.125 BTC issued.`);

    await page.clock.runFor(46_000);
    await expect(page.locator('#left-figure')).toHaveText(leftFigure(FAKE_HEIGHT + 1));
    const heightCalls = chain.calls.filter((url) => url.endsWith('/tip/height'));
    const blockCalls = chain.calls.filter((url) => /\/blocks\/\d+$/.test(url));
    expect(heightCalls).toHaveLength(3);
    expect(blockCalls).toHaveLength(2);
});

test('no route loads three.js, and only the converter asks for price and height', async ({ page }) => {
    const chain = await fakeHeightApi(page);
    const prices = await fakePriceApi(page);
    const { scripts, external, problems } = watch(page);
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).toHaveText(/^100,000 sats = £57\.33$/);
    await page.waitForTimeout(2500);
    const converter = [...external];
    await page.goto('/#/dca');
    await expect(page.locator('#dca-detail')).toBeVisible();
    await page.goto('/#/power');
    await expect(page.locator('#power-detail')).toBeVisible();
    await page.goto('/#/address');
    await page.getByLabel('Bitcoin address').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    await expect(page.locator('#address-parts')).toBeVisible();
    await page.waitForTimeout(1500);

    expect(scripts.filter((path) => /\/three-/.test(path))).toEqual([]);
    expect(external).toEqual(converter);
    expect(prices.calls).toEqual(['https://mempool.space/api/v1/prices']);
    expect(chain.calls.filter((url) => url.endsWith('/tip/height'))).toEqual([
        'https://mempool.space/api/blocks/tip/height',
    ]);
    expect(realProblems(problems)).toEqual([]);
});
