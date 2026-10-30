import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { DCA, SHARE } from '../src/ui/copy.ts';

async function openDca(page: Page) {
    const problems: string[] = [];
    const external: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') external.push(request.url());
    });
    await page.goto('/#/dca');
    await expect(page.locator('#dca-detail')).toBeVisible();
    return { problems, external };
}

function pngSize(path: string): [number, number] {
    const bytes = readFileSync(path);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const money = /£[\d,]+/.source;

test('answers £50 a week since January 2020 from bundled closes only, with the lump sum', async ({ page }) => {
    const { problems, external } = await openDca(page);
    await expect(page.locator('#tool-result')).toHaveText(
        new RegExp(`^£50 a week since Jan 2020 is worth ${money} today \\(one lump sum: ${money}\\)\\.$`),
    );
    await expect(page.locator('#tool-result-detail')).toHaveText(
        new RegExp(`^${money} put in over [\\d,]+ buys, buying [\\d.]+ BTC\\.$`),
    );
    await expect(page.locator('#tool-result-label')).toHaveText(/today = close, \d{1,2} \w+ \d{4}$/);
    await expect(page.locator('#dca-buys')).toHaveText(/^[\d,]+ buys, 1 Jan 2020 to \d{1,2} \w{3,4} \d{4}$/);
    await expect(page.locator('#dca-lump')).toHaveText(
        new RegExp(`^Worth ${money} today: [\\d.]+ BTC bought on 1 Jan 2020$`),
    );
    await expect(page.locator('#dca-notes')).toContainText(DCA.feesNone);
    await expect(page.locator('.dca-chart__line--lump')).toHaveAttribute('points', /^0,[\d.]+ /);
    await expect(page.locator('#dca-chart')).toHaveAttribute('aria-label', /^Line chart\./);
    await expect(page.locator('#tool-source')).toContainText('Coin Metrics reference price, daily closes to');
    await expect(page.locator('#tool-result-status')).toHaveText(/^£50 a week since Jan 2020/);
    expect(external).toEqual([]);
    expect(problems).toEqual([]);
});

test('presets, cadence and currency recompute, and the start month is kept', async ({ page }) => {
    await openDca(page);
    await page.locator('[data-preset="fiveYears"]').click();
    await expect(page.locator('[data-preset="fiveYears"]')).toHaveAttribute('aria-pressed', 'true');
    const month = await page.locator('#dca-start-month').inputValue();
    const year = await page.locator('#dca-start-year').inputValue();
    await page.locator('label', { hasText: DCA.frequencies.monthly }).click();
    await expect(page.locator('#tool-result')).toHaveText(/^£50 a month since /);
    await expect(page.locator('#dca-buys')).toHaveText(/^6[01] buys, /);
    await page.locator('label', { hasText: '$ USD' }).click();
    await expect(page.locator('#tool-result')).toHaveText(/^\$50 a month since /);
    await expect(page.locator('#dca-start-month')).toHaveValue(month);
    await expect(page.locator('#dca-start-year')).toHaveValue(year);
});

test('a fee comes off every buy, and an impossible fee says so', async ({ page }) => {
    await openDca(page);
    const before = await page.locator('#dca-bought').textContent();
    await page.getByLabel(DCA.fee).fill('1.5');
    await expect(page.locator('#dca-notes')).toContainText(/^Includes a 1\.5% fee on each buy, £[\d,]+ in total\./);
    expect(await page.locator('#dca-bought').textContent()).not.toBe(before);
    await page.getByLabel(DCA.fee).fill('100');
    await expect(page.locator('#tool-result')).toHaveText(DCA.badFee);
    await expect(page.locator('#dca-detail')).toBeHidden();
    await expect(page.locator('[data-share="card"]')).toBeDisabled();
});

test('a start before the prices begin moves to the first close and says so', async ({ page }) => {
    await openDca(page);
    await page.locator('#dca-start-year').selectOption('2010');
    await page.locator('#dca-start-month').selectOption('7');
    await expect(page.locator('#tool-result')).toHaveText(/ since Jul 2010 is worth /);
    await expect(page.locator('#dca-notes')).toContainText(
        'Prices start on 18 July 2010, so the first buy is that day.',
    );
    await expect(page.locator('#dca-buys')).toHaveText(/, 18 Jul 2010 to /);
});

test('the card carries the sentence and the lump sum', async ({ page, isMobile }) => {
    await openDca(page);
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-share="card"]').click()]);
    expect(download.suggestedFilename()).toBe('plain-bitcoin-dca-50-gbp-weekly-2020-01-01.png');
    const file = test.info().outputPath('card.png');
    await download.saveAs(file);
    expect(pngSize(file)).toEqual(isMobile ? [1080, 1350] : [1200, 675]);
    await expect(page.locator('#tool-result-status')).toHaveText(SHARE.downloaded);
});

test('recomputes within a frame', async ({ page }) => {
    await openDca(page);
    await page.locator('#dca-start-year').selectOption('2010');
    const ms = await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('#dca-amount');
        if (!input) return Number.POSITIVE_INFINITY;
        const start = performance.now();
        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return performance.now() - start;
    });
    await expect(page.locator('#tool-result')).toHaveText(/^£75 a week since /);
    expect(ms).toBeLessThan(16);
});
