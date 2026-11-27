import { expect, type Page, test } from '@playwright/test';
import { HOME, STACK, TOOLS } from '../src/ui/copy.ts';
import { formatShortDay } from '../src/util/format.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi, LIVE_PRICE } from './price-api.ts';

const KEY = 'plain-bitcoin:my-stack';

function outside(page: Page) {
    const urls: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.hostname !== 'localhost') urls.push(request.url());
    });
    return urls;
}

const stored = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), KEY);

async function seed(page: Page, visitAgo: number, usd: number): Promise<number> {
    const at = Date.now() - visitAgo;
    const holding = {
        sats: 1_000_000,
        fiat: 'USD',
        savedAt: at,
        visit: { at, usd, gbp: usd * 0.75 },
        previous: null,
    };
    await page.addInitScript(
        ({ key, value }) => {
            if (window.sessionStorage.getItem('seeded')) return;
            window.sessionStorage.setItem('seeded', '1');
            window.localStorage.setItem(key, value);
        },
        { key: KEY, value: JSON.stringify(holding) },
    );
    return at;
}

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('keeps nothing until the tap, then keeps the amount in this browser only', async ({ page }) => {
    const urls = outside(page);
    await page.goto('/stack?hero=still');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.stack.name);
    await expect(page.locator('#tool-result-figure')).toHaveText('$767.77');
    await expect(page.locator('#tool-result')).toHaveText('0.01 BTC is worth $767.77 now.');
    await expect(page.locator('#picture-plot > svg.gauge-svg')).toHaveCount(1);
    await expect(page.locator('#stack-yearAgo')).toHaveText(/^\$[\d,.]+ on \d+ \w+ \d{4}$/);
    expect(await stored(page)).toBeNull();

    await page.locator('#stack-keep').click();
    await expect(page.locator('#stack-forget')).toBeFocused();
    await expect(page.locator('#stack-keep-note')).toHaveText(STACK.kept(formatShortDay(Date.now())));
    await page.locator('#stack-amount').fill('0.25');
    await expect(page.locator('#tool-result')).toHaveText('0.25 BTC is worth $19,194.25 now.');
    expect(JSON.parse((await stored(page)) ?? '{}')).toMatchObject({ sats: 25_000_000, fiat: 'USD' });

    await page.reload();
    await expect(page.locator('#stack-amount')).toHaveValue('0.25');
    await expect(page.locator('#stack-keep')).toBeHidden();
    expect(urls.every((url) => url.startsWith('https://mempool.space/'))).toBe(true);
    expect(urls.some((url) => url.includes('25000000') || url.includes('0.25'))).toBe(false);
});

test('a visit an hour or more after the last one says how far the stack moved, here and on home', async ({ page }) => {
    const at = await seed(page, 2 * 60 * 60 * 1000, 70_000);
    await page.goto('/?hero=still');
    await expect(page.locator('[data-now="stack"]')).toHaveAttribute('data-roll', '$768');
    await expect(page.locator('[data-now-unit="stack"]')).toHaveText(HOME.stack.moved('0.01 BTC', '+$67.77'));
    await page.locator('a[href="/stack"]').first().click();
    await expect(page.locator('#tool-result-detail')).toHaveText(
        STACK.sinceVisit('up $67.77 (9.7%)', formatShortDay(at)),
    );
    const kept = JSON.parse((await stored(page)) ?? '{}');
    expect(kept.previous.usd).toBe(70_000);
    expect(kept.visit.usd).toBe(LIVE_PRICE.usd);
});

test('a reload within the hour is the same visit; Forget removes everything', async ({ page }) => {
    const at = await seed(page, 5 * 60 * 1000, 80_000);
    await page.goto('/stack?hero=still');
    await expect(page.locator('#tool-result-detail')).toHaveText(
        STACK.sinceSaved('down $32.23 (4%)', formatShortDay(at)),
    );
    await page.locator('#stack-forget').click();
    await expect(page.locator('#stack-keep-note')).toHaveText(STACK.forgotten);
    await expect(page.locator('#stack-keep')).toBeFocused();
    await expect(page.locator('#tool-result-detail')).toHaveText(STACK.notKeptDetail);
    expect(await stored(page)).toBeNull();
    await page.goto('/?hero=still');
    await expect(page.locator('[data-now="stack"]')).toHaveAttribute('data-roll', HOME.stack.unset);
});

test('switching to sats keeps the same coins', async ({ page }) => {
    await page.goto('/stack?hero=still');
    await page.locator('label', { hasText: STACK.units.sats }).click();
    await expect(page.locator('#stack-amount')).toHaveValue('1,000,000');
    await expect(page.locator('#tool-result')).toHaveText('1,000,000 sats is worth $767.77 now.');
    await page.locator('#stack-amount').fill('abc');
    await expect(page.locator('#stack-keep')).toBeDisabled();
});

test("today's card prints the live strip from home", async ({ page }) => {
    await page.goto('/?hero=still');
    const button = page.locator('.now__print');
    await expect(button).toHaveText(HOME.today);
    await expect(button).toBeEnabled();
    await button.click();
    const href = new URL((await page.locator('.tray [data-tray="post"]').getAttribute('href')) ?? '');
    const compose = href.searchParams.get('text') ?? '';
    expect(compose).toMatch(/^Block [\d,]+\. /);
    expect(compose).toContain('blocks to the halving');
    expect(compose).toContain('@PlainBTC');
});
