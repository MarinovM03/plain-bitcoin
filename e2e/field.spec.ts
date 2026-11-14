import { expect, type Page, test } from '@playwright/test';
import { hashBits } from '../src/chain/hash.ts';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER } from '../src/ui/copy.ts';
import { FAKE_HEIGHT, fakeHash, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const ROUTES = ['', ...TOOL_IDS];
const PLATES = ['.hero__intro', '.hero__stage', '.chain-about', '.home__share', '.cautions'];
const TOOL_PLATES = ['.tool__screen', '.tool__below'];

const setBits = (hash: string) => String(hashBits(hash).reduce((count, bit) => count + bit, 0));
const frames = (page: Page) => page.locator('#ground').evaluate((canvas) => Number(canvas.dataset.frames ?? 0));

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('the moving ground runs behind every page, out of the way of pointers and screen readers', async ({ page }) => {
    for (const route of ROUTES) {
        await page.goto(`/?hero=still#/${route}`);
        const field = page.locator('#ground');
        await expect(field).toHaveAttribute('data-state', 'moving');
        await expect(field).toHaveAttribute('aria-hidden', 'true');
        await expect(field).toHaveCSS('position', 'fixed');
        await expect(field).toHaveCSS('pointer-events', 'none');
        const before = await frames(page);
        await expect.poll(() => frames(page), { message: `#/${route}` }).toBeGreaterThan(before + 3);
        await expect(page.locator('canvas')).toHaveCount(1);
    }
});

test('it is drawn from the newest block the page knows: the live tip, or a saved block where nothing is fetched', async ({
    page,
}) => {
    await page.goto('/?hero=still#/');
    await expect(page.locator('#ground')).toHaveAttribute('data-bits', setBits(fakeHash(FAKE_HEIGHT)));

    const calls: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') calls.push(request.url());
    });
    await page.goto('/?hero=still#/power');
    await page.reload();
    await expect(page.locator('#ground')).toHaveAttribute('data-bits', /^[1-9]\d*$/);
    expect(calls).toEqual([]);
});

test('every block of text and every input sits on an opaque plate above it', async ({ page }) => {
    const opaque = (selector: string) =>
        expect(page.locator(selector).first(), selector).toHaveCSS('background-color', /^rgb\(/);
    await page.goto('/?hero=still#/');
    for (const selector of [...PLATES, '.topbar', '.footer']) await opaque(selector);
    for (const id of TOOL_IDS) {
        await page.goto(`/?hero=still#/${id}`);
        for (const selector of TOOL_PLATES) await opaque(selector);
    }
    await expect(page.getByText(FOOTER.motion)).toBeVisible();
});

test('with reduced motion it draws one still frame and stops', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?hero=still#/convert');
    const field = page.locator('#ground');
    await expect(field).toHaveAttribute('data-state', 'still');
    await expect.poll(() => frames(page)).toBeGreaterThan(0);
    const settled = await frames(page);
    await page.waitForTimeout(600);
    expect(await frames(page)).toBe(settled);
});
