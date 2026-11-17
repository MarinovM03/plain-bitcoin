import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { CONVERT, FIELDS, SHARE } from '../src/ui/copy.ts';
import { realProblems } from './console.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const latest = JSON.parse(readFileSync('src/data/prices/latest.json', 'utf8')) as { day: string; USD: number };

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

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
});

const fields = (page: Page) => ({
    sats: page.getByLabel(CONVERT.fields.sats, { exact: true }),
    btc: page.getByLabel(CONVERT.fields.btc, { exact: true }),
    fiat: page.locator('#convert-fiat'),
});

const fiatLabel = (page: Page) => page.locator('label[for="convert-fiat"]');
const pick = (page: Page, currency: string) => page.getByLabel(currency, { exact: true }).check({ force: true });

test('converts 100,000 sats at the live price, asking only the price API', async ({ page }) => {
    const prices = await fakePriceApi(page);
    const { problems, external } = watch(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = $76.78');
    await expect(page.locator('#tool-result-detail')).toHaveText('Also 0.001 BTC.');
    await expect(field.btc).toHaveValue('0.001');
    await expect(field.fiat).toHaveValue('76.78');
    await expect(fiatLabel(page)).toHaveText(CONVERT.fields.usd);
    await expect(page.getByLabel(FIELDS.dollars, { exact: true })).toBeChecked();
    await expect(page.locator('#status-usd')).toHaveText('$76,777');
    await expect(page.locator('#status')).not.toContainText('£');
    await expect(page.locator('#convert-point')).toHaveText(CONVERT.abacus);
    await expect(page.locator('[data-machine="sats"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#status-source')).toHaveText(/^mempool\.space \d\d:\d\d UTC$/);
    await expect(page.locator('#convert-ref-sat')).toHaveText('1 sat ≈ $0.00077');
    await expect(page.locator('#tool-result-label')).toHaveText(/live price, \d\d:\d\d UTC$/);
    await expect(page.locator('#tool-source')).toContainText('mempool.space, with CoinGecko');
    for (const kind of ['sats', 'btc', 'fiat'] as const) {
        await expect(field[kind]).toHaveAttribute('inputmode', kind === 'sats' ? 'numeric' : 'decimal');
    }
    expect(external.filter((url) => !url.includes('/blocks/'))).toEqual(['https://mempool.space/api/v1/prices']);
    expect(prices.calls).toHaveLength(1);
    expect(realProblems(problems)).toEqual([]);
});

test('the last-edited field drives the others, and the scrubber runs from 1 sat to 1 BTC', async ({ page }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = $76.78');

    await field.btc.fill('0.1');
    await expect(field.sats).toHaveValue('10,000,000');
    await expect(page.locator('#tool-result')).toHaveText('0.1 BTC = $7,677.70');

    await field.fiat.fill('50');
    await expect(field.sats).toHaveValue('65,124');
    await expect(field.btc).toHaveValue('0.00065124');
    await expect(page.locator('#tool-result')).toHaveText('$50.00 = 65,124 sats');

    const scrub = page.locator('#convert-scrub');
    await scrub.fill('0');
    await expect(page.locator('#tool-result')).toHaveText('1 sat = $0.00077');
    await expect(field.fiat).toHaveValue('0.00077');
    await scrub.fill('800');
    await expect(field.sats).toHaveValue('100,000,000');
    await expect(page.locator('#tool-result')).toHaveText('100,000,000 sats = $76,777.00');
});

test('the money switch offers dollars, euros and pounds and keeps the amount of bitcoin', async ({ page }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    const field = fields(page);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = $76.78');

    await pick(page, FIELDS.euros);
    await expect(fiatLabel(page)).toHaveText(CONVERT.fields.eur);
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = €66.21');
    await expect(field.fiat).toHaveValue('66.21');
    await expect(page.locator('#convert-ref-sat')).toHaveText('1 sat ≈ €0.00066');

    await field.fiat.fill('50');
    await expect(page.locator('#tool-result')).toHaveText('€50.00 = 75,517 sats');
    await pick(page, FIELDS.pounds);
    await expect(fiatLabel(page)).toHaveText(CONVERT.fields.gbp);
    await expect(field.sats).toHaveValue('75,517');
    await expect(page.locator('#tool-result')).toHaveText('75,517 sats = £43.29');
});

test('what is typed before the tool finishes loading still drives the answer', async ({ page }) => {
    await fakePriceApi(page);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route(/\/assets\/tool-convert-[^/]+\.js$/, async (route) => {
        await held;
        await route.continue();
    });
    await page.goto('/#/convert', { waitUntil: 'commit' });
    await fields(page).btc.fill('0.5');
    release();
    await expect(page.locator('#tool-result')).toHaveText(/^0\.5 BTC = \$[\d,]+\.\d{2}$/);
    await expect(fields(page).sats).toHaveValue('50,000,000');
});

test('refuses impossible amounts and pasted garbage calmly', async ({ page }) => {
    await fakePriceApi(page);
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = $76.78');
    const field = fields(page);
    await field.btc.fill('21000001');
    await expect(page.locator('#convert-note')).toHaveText(CONVERT.tooBig);
    await expect(field.sats).toHaveValue('');
    await expect(page.locator('[data-share="print"]')).toBeDisabled();

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
    await expect(page.locator('#status-source')).toHaveText(`last close ${day}`);
    await expect(page.locator('#tool-source')).toContainText('Coin Metrics');
    const dollars = ((100_000 * latest.USD) / 1e8).toFixed(2);
    await expect(page.locator('#tool-result')).toHaveText(`100,000 sats = $${dollars}`);
    await pick(page, FIELDS.euros);
    await expect(page.locator('#convert-note')).toHaveText(CONVERT.noEuro);
    await expect(page.locator('#tool-result')).toHaveText(`100,000 sats = $${dollars}`);
    await expect(fields(page).fiat).toHaveValue('');
    expect(realProblems(problems).filter((text) => !text.includes('net::ERR_INTERNET_DISCONNECTED'))).toEqual([]);
});

test('every field and the scrubber are reachable by keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard focus is checked on desktop');
    await fakePriceApi(page);
    await page.goto('/#/convert');
    await page.locator('h1').focus();
    const order: string[] = [];
    for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Tab');
        order.push(
            await page.evaluate(() => {
                const active = document.activeElement;
                return active?.id || active?.getAttribute('name') || active?.textContent || '';
            }),
        );
    }
    expect(order.slice(0, 5)).toEqual([
        'convert-sats',
        'convert-btc',
        'convert-fiat',
        'convert-currency',
        'convert-scrub',
    ]);
    expect(order.slice(5, 8)).toEqual([SHARE.print, SHARE.download, `${SHARE.post} ↗`]);
});
