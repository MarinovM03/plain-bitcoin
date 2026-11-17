import { expect, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, NAV, pageTitle, SITE_NAME, TOOLS } from '../src/ui/copy.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const BARE_LABELS = ['Left', 'Power', 'Convert', 'DCA', 'Address'];

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('home tiles, page titles and headings use the plain names, never a bare short label', async ({ page }) => {
    await page.goto('/?hero=still');
    for (const id of TOOL_IDS) {
        const tile = page.locator(`.tile__link[href="/${id}"]`);
        await expect(tile.locator('.tile__name')).toHaveText(TOOLS[id].name);
        await expect(tile.locator('.tile__line')).toHaveText(TOOLS[id].description);
    }
    const linkText = await page.locator('a').evaluateAll((links) => links.map((link) => link.textContent?.trim()));
    for (const label of BARE_LABELS) expect(linkText).not.toContain(label);
    for (const id of TOOL_IDS) {
        await page.goto(`/${id}?hero=still`);
        await expect(page).toHaveTitle(pageTitle(TOOLS[id].name));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[id].name);
    }
});

test('the bar marks home, and offers the way back to every machine on every other page', async ({ page }) => {
    await page.goto('/?hero=still');
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: NAV.all })).toBeHidden();
    for (const id of TOOL_IDS) {
        await page.locator(`.tile__link[href="/${id}"]`).click();
        await expect(page).toHaveURL(new RegExp(`/${id}$`));
        await expect(page.getByRole('link', { name: SITE_NAME })).not.toHaveAttribute('aria-current', 'page');
        await page.getByRole('link', { name: NAV.all }).click();
        await expect(page).toHaveURL(/:\d+\/$/);
    }
});

test('the footer offers a follow link, every tool by name and the privacy line', async ({ page }) => {
    await page.goto('/?hero=still');
    const footer = page.getByRole('contentinfo');
    const follow = footer.getByRole('link', { name: FOOTER.follow });
    await expect(follow).toHaveAttribute('href', FOOTER.followUrl);
    await expect(follow).toHaveAttribute('rel', 'noopener noreferrer');
    expect((await follow.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(footer.locator('.footer__link')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].name));
    await expect(footer.getByText(FOOTER.privacy)).toBeVisible();
});

test('only the bar, the canvas and a machine scene are pinned, so a short screen never traps the page', async ({
    page,
}) => {
    await page.goto('/convert');
    await expect(page.locator('#tool-result')).not.toHaveText('');
    const pinned = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
            .filter((element) => ['sticky', 'fixed'].includes(getComputedStyle(element).position))
            .map((element) => element.className.toString())
            .filter((name) => !/^(topbar|stage-canvas|machine__stage)/.test(name)),
    );
    expect(pinned).toEqual([]);
});
