import { expect, type Page, test } from '@playwright/test';
import { POWER, SHARE } from '../src/ui/copy.ts';
import { cardName, expectedCardSize, pngSize } from './card-file.ts';
import { realProblems } from './console.ts';

async function openPower(page: Page) {
    const requests: string[] = [];
    const problems: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') requests.push(request.url());
        if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') requests.push(request.url());
    });
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/#/power');
    await expect(page.locator('#power-detail')).toBeVisible();
    return { requests, problems };
}

test('answers the default question at once, from bundled data only', async ({ page }) => {
    const { requests, problems } = await openPower(page);
    await expect(page.locator('#tool-result')).toHaveText(/^£1,000 in January 2015 is worth £[\d,]+ today\.$/);
    await expect(page.locator('#tool-result-detail')).toHaveText(
        /^As bitcoin, it would be £[\d,]+ today \([\d.]+ BTC\)\.$/,
    );
    await expect(page.locator('#tool-result-label')).toHaveText(/close, \w+ \d{4}$/);
    await expect(page.locator('#tool-source')).toContainText('Office for National Statistics');
    await expect(page.getByText(POWER.caution)).toHaveCount(1);
    await expect(page.locator('#tool-result-status')).toHaveText(/^£1,000 in January 2015/);
    expect(requests).toEqual([]);
    expect(realProblems(problems)).toEqual([]);
});

test('switching currency keeps the start month', async ({ page }) => {
    await openPower(page);
    await page.locator('[data-preset="fiveYears"]').click();
    const month = await page.locator('#power-when-month').inputValue();
    const year = await page.locator('#power-when-year').inputValue();
    await page.locator('label', { hasText: '$ USD' }).click();
    await expect(page.locator('#tool-result')).toHaveText(/^\$1,000 in /);
    await expect(page.locator('#power-when-month')).toHaveValue(month);
    await expect(page.locator('#power-when-year')).toHaveValue(year);
    await expect(page.locator('[data-preset="fiveYears"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the worst month to start shows bitcoin worth less than the cash put in', async ({ page }) => {
    await openPower(page);
    await page.locator('[data-preset="worst"]').click();
    await expect(page.locator('[data-preset="worst"]')).toHaveAttribute('aria-pressed', 'true');
    const value = await page.locator('#power-btc-value').textContent();
    expect(Number(value?.replace(/[^\d.]/g, ''))).toBeLessThan(1000);
    await expect(page.locator('#power-path')).toContainText('below £1,000');
});

test('an empty amount or a CPI gap clears the answer and disables sharing', async ({ page }) => {
    await openPower(page);
    await page.getByLabel('Amount', { exact: true }).fill('');
    await expect(page.locator('#tool-result')).toHaveText(POWER.empty);
    await expect(page.locator('[data-share="card"]')).toBeDisabled();
    await page.getByLabel('Amount', { exact: true }).fill('1000');
    await page.locator('label', { hasText: '$ USD' }).click();
    await page.locator('#power-when-year').selectOption('2025');
    await page.locator('#power-when-month').selectOption('10');
    await expect(page.locator('#tool-result')).toHaveText(POWER.noCpi('October 2025', 'USD'));
    await expect(page.locator('#power-detail')).toBeHidden();
});

test('Share card falls back to a PNG download when Web Share is missing', async ({ page }) => {
    await openPower(page);
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-share="card"]').click()]);
    expect(download.suggestedFilename()).toMatch(cardName('power'));
    const file = test.info().outputPath('card.png');
    await download.saveAs(file);
    expect(pngSize(file)).toEqual(await expectedCardSize(page));
    await expect(page.locator('#tool-result-status')).toHaveText(SHARE.downloaded);
});

test('Share card hands the PNG and the sentence to Web Share when it can', async ({ page }) => {
    await openPower(page);
    await page.evaluate(() => {
        const win = window as unknown as { shared: unknown };
        win.shared = null;
        navigator.canShare = (data?: ShareData) => Boolean(data?.files?.length);
        navigator.share = async (data?: ShareData) => {
            win.shared = { name: data?.files?.[0]?.name, type: data?.files?.[0]?.type, text: data?.text };
        };
    });
    await page.locator('[data-share="card"]').click();
    const shared = await page.waitForFunction(() => (window as unknown as { shared: unknown }).shared);
    expect(await shared.jsonValue()).toEqual({
        name: expect.stringMatching(cardName('power')),
        type: 'image/png',
        text: expect.stringMatching(/^£1,000 in January 2015 is worth .+\nplainbitcoin\.org$/),
    });
});

test('Copy text puts the sentence and the site address on the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permission is Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openPower(page);
    await page.locator('[data-share="copy"]').click();
    await expect(page.locator('[data-share="copy"]')).toHaveText(SHARE.copied);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^£1,000 in January 2015 is worth £[\d,]+ today\. As bitcoin: .+\r?\nplainbitcoin\.org$/);
});
