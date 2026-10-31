import { expect, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, NAV, SITE_NAME } from '../src/ui/copy.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('the top bar links to every tool and to @PlainBTC on X', async ({ page }) => {
    await page.goto('/?hero=plain');
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    for (const id of TOOL_IDS) {
        await expect(nav.getByRole('link', { name: NAV.short[id], exact: true })).toHaveAttribute('href', `#/${id}`);
    }
    const follow = page.locator('.topbar').getByRole('link', { name: FOOTER.handle });
    await expect(follow).toBeVisible();
    await expect(follow).toHaveAttribute('href', FOOTER.followUrl);
    await expect(follow).toHaveAttribute('rel', 'noopener noreferrer');
});

test('the footer offers a follow link, every tool and the privacy line', async ({ page }) => {
    await page.goto('/?hero=plain');
    const footer = page.getByRole('contentinfo');
    const follow = footer.getByRole('link', { name: FOOTER.follow });
    await expect(follow).toHaveAttribute('href', FOOTER.followUrl);
    await expect(follow).toHaveAttribute('rel', 'noopener noreferrer');
    expect((await follow.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(footer.getByRole('listitem')).toHaveCount(TOOL_IDS.length);
    await expect(footer.getByText(FOOTER.privacy)).toBeVisible();
});

test('the current route is marked in the top bar', async ({ page }) => {
    await page.goto('/?hero=plain');
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('aria-current', 'page');
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    for (const id of TOOL_IDS) {
        await nav.getByRole('link', { name: NAV.short[id], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#/${id}$`));
        await expect(nav.locator('[aria-current="page"]')).toHaveText(NAV.short[id]);
        await expect(page.getByRole('link', { name: SITE_NAME })).not.toHaveAttribute('aria-current', 'page');
    }
});

test('on a phone the answer dock stays in view while the inputs are on screen', async ({ page }) => {
    const size = page.viewportSize();
    test.skip(!size || size.width >= 896 || size.height < 600, 'The dock only sticks on portrait phones');
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).not.toHaveText('');
    const dock = await page.locator('.tool__dock').boundingBox();
    expect(dock).not.toBeNull();
    expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBeLessThanOrEqual(size?.height ?? 0);
    expect(dock?.height ?? 0).toBeLessThan((size?.height ?? 0) * 0.4);
    await expect(page.locator('#convert-sats')).toBeInViewport();
});

test('in phone landscape nothing sticks, so the short screen never traps the page', async ({ page }) => {
    const size = page.viewportSize();
    test.skip(!size || size.height > 512 || size.width < size.height, 'Landscape phones only');
    await page.goto('/#/convert');
    for (const selector of ['.topbar', '.tool__dock']) {
        expect(await page.locator(selector).evaluate((element) => getComputedStyle(element).position)).toBe('static');
    }
});
