import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { CONVERT, SHARE } from '../src/ui/copy.ts';
import { fakePriceApi } from './price-api.ts';

const latest = JSON.parse(readFileSync('src/data/prices/latest.json', 'utf8')) as { day: string; GBP: number };

function watch(page: Page) {
    const problems: string[] = [];
    const external: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') external.push(request.url());
    });
    return { problems, external };
}

function pngSize(path: string): [number, number] {
    const bytes = readFileSync(path);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const fields = (page: Page) => ({
    sats: page.getByLabel(CONVERT.fields.sats, { exact: true }),
    btc: page.getByLabel(CONVERT.fields.btc, { exact: true }),
    gbp: page.getByLabel(CONVERT.fields.gbp, { exact: true }),
    usd: page.getByLabel(CONVERT.fields.usd, { exact: true }),
});

test('converts 100,000 sats at the live price, asking only the price API', async ({ page }) => {
    const prices = await fakePriceApi(page);
    const { problems, external } = watch(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33');
    await expect(page.locator('#tool-result-detail')).toHaveText('Also 0.001 BTC or $76.78.');
    await expect(field.btc).toHaveValue('0.001');
    await expect(field.gbp).toHaveValue('57.33');
    await expect(field.usd).toHaveValue('76.78');
    await expect(page.locator('#convert-price')).toHaveText(/^1 BTC = £57,329 = \$76,777 · mempool\.space, /);
    await expect(page.locator('#tool-result-label')).toHaveText(/live price, \d\d:\d\d UTC$/);
    await expect(page.locator('#tool-source')).toContainText('mempool.space, with CoinGecko');
    await expect(page.locator('[data-preset="hundredThousand"]')).toHaveAttribute('aria-pressed', 'true');
    for (const kind of ['sats', 'btc', 'gbp', 'usd'] as const) {
        await expect(field[kind]).toHaveAttribute('inputmode', kind === 'sats' ? 'numeric' : 'decimal');
    }
    expect(external).toEqual(['https://mempool.space/api/v1/prices']);
    expect(prices.calls).toHaveLength(1);
    expect(problems).toEqual([]);
});

test('the last-edited field drives the others, and presets fill one field', async ({ page }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33');

    await field.btc.fill('0.1');
    await expect(field.sats).toHaveValue('10,000,000');
    await expect(page.locator('#tool-result')).toHaveText('0.1 BTC = £5,732.90');

    await field.gbp.fill('50');
    await expect(field.sats).toHaveValue('87,216');
    await expect(field.btc).toHaveValue('0.00087216');
    await expect(page.locator('#tool-result')).toHaveText('£50.00 = 87,216 sats');

    await page.locator('[data-preset="sat"]').click();
    await expect(page.locator('#tool-result')).toHaveText('1 sat = £0.00057');
    await expect(field.gbp).toHaveValue('0.00057');
    await page.locator('[data-preset="coin"]').click();
    await expect(field.sats).toHaveValue('100,000,000');
    await expect(page.locator('[data-preset="coin"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-preset="pizza"]').click();
    await expect(page.locator('#tool-result')).toHaveText('10,000 BTC = £573,290,000.00');
});

test('refuses impossible amounts and pasted garbage calmly', async ({ page }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await field.btc.fill('21000001');
    await expect(page.locator('#convert-note')).toHaveText(CONVERT.tooBig);
    await expect(field.sats).toHaveValue('');
    await expect(page.locator('[data-share="card"]')).toBeDisabled();

    await field.btc.fill('');
    await expect(page.locator('#tool-result')).toHaveText(CONVERT.empty);
    await expect(page.locator('#convert-note')).toBeHidden();
    const blocked = await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('#convert-sats');
        const paste = new InputEvent('beforeinput', {
            inputType: 'insertFromPaste',
            data: '-5 sats',
            bubbles: true,
            cancelable: true,
        });
        input?.dispatchEvent(paste);
        return paste.defaultPrevented;
    });
    expect(blocked).toBe(true);
    await expect(page.locator('#convert-note')).toHaveText(CONVERT.invalid);
    await expect(field.sats).toHaveValue('');

    await field.sats.pressSequentially('-12a3');
    await expect(field.sats).toHaveValue('123');
    await expect(page.locator('#convert-note')).toBeHidden();
});

test('offline, it converts at the bundled last close and says so', async ({ page }) => {
    const prices = await fakePriceApi(page, true);
    const { problems } = watch(page);
    await page.goto('/#/convert');
    await expect.poll(() => prices.calls.length).toBe(2);
    const day = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(Date.parse(`${latest.day}T00:00:00Z`));
    await expect(page.locator('#tool-result-label')).toHaveText(`Answer · last close, ${day}`);
    await expect(page.locator('#convert-price')).toContainText(`last close, ${day}`);
    await expect(page.locator('#tool-source')).toContainText('Coin Metrics');
    const pounds = ((100_000 * latest.GBP) / 1e8).toFixed(2);
    await expect(page.locator('#tool-result')).toHaveText(`100,000 sats = £${pounds}`);
    expect(problems.filter((text) => !text.includes('net::ERR_INTERNET_DISCONNECTED'))).toEqual([]);
});

test('the card states the amount with the price source and time', async ({ page, isMobile }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33');
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-share="card"]').click()]);
    expect(download.suggestedFilename()).toBe('plain-bitcoin-100000-sats.png');
    const file = test.info().outputPath('card.png');
    await download.saveAs(file);
    expect(pngSize(file)).toEqual(isMobile ? [1080, 1350] : [1200, 675]);
    await expect(page.locator('#tool-result-status')).toHaveText(SHARE.downloaded);
});

test('every field and preset is reachable by keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard focus is checked on desktop');
    await fakePriceApi(page);
    await page.goto('/#/convert');
    await page.locator('h1').focus();
    const order: string[] = [];
    for (let i = 0; i < 10; i += 1) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent || ''));
    }
    expect(order.slice(0, 4)).toEqual(['convert-sats', 'convert-btc', 'convert-gbp', 'convert-usd']);
    expect(order.slice(4)).toEqual(Object.values(CONVERT.presets));
    await page.keyboard.press('Enter');
    await expect(page.locator('#tool-result')).toHaveText('10,000 BTC = £573,290,000.00');
});
