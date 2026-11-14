import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, NAV, pageTitle, SITE_NAME, TOOLS } from '../src/ui/copy.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const BARE_LABELS = ['Left', 'Power', 'Convert', 'DCA', 'Address'];

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

async function openMenu(page: Page) {
    await page.locator('.menu__toggle').click();
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    await expect(nav).toBeVisible();
    return nav;
}

test('the Tools menu lists every tool by its full plain name, and never a bare short label', async ({ page }) => {
    await page.goto('/?hero=still');
    const nav = await openMenu(page);
    await expect(nav.locator('.menu__name')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].name));
    for (const id of TOOL_IDS) {
        await expect(nav.getByRole('link', { name: TOOLS[id].name })).toHaveAttribute('href', `#/${id}`);
        await expect(nav.getByText(TOOLS[id].description)).toBeVisible();
    }
    const linkText = await page.locator('a').evaluateAll((links) => links.map((link) => link.textContent?.trim()));
    for (const label of BARE_LABELS) expect(linkText).not.toContain(label);
    const box = await nav.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= width).toBe(true);
});

test('home rows, page titles and headings use the plain names', async ({ page }) => {
    await page.goto('/?hero=still');
    await expect(page.locator('.tool-row__name')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].name));
    await expect(page.locator('.tool-row__description')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].description));
    for (const id of TOOL_IDS) {
        await page.goto(`/?hero=still#/${id}`);
        await expect(page).toHaveTitle(pageTitle(TOOLS[id].name));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[id].name);
    }
});

test('the menu marks the current tool, closes when one is chosen, and closes on Escape', async ({ page }) => {
    await page.goto('/?hero=still');
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('aria-current', 'page');
    for (const id of TOOL_IDS) {
        const nav = await openMenu(page);
        await nav.getByRole('link', { name: TOOLS[id].name }).click();
        await expect(page).toHaveURL(new RegExp(`#/${id}$`));
        await expect(nav).toBeHidden();
        await expect(page.locator('.menu__link[aria-current="page"] .menu__name')).toHaveText(TOOLS[id].name);
        await expect(page.getByRole('link', { name: SITE_NAME })).not.toHaveAttribute('aria-current', 'page');
    }
    const nav = await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(page.locator('.menu__toggle')).toBeFocused();
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

test('nothing but the moving ground is pinned to the screen, so a short screen never traps the page', async ({
    page,
}) => {
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).not.toHaveText('');
    const pinned = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
            .filter((element) => element.id !== 'ground')
            .filter((element) => ['sticky', 'fixed'].includes(getComputedStyle(element).position))
            .map((element) => element.className),
    );
    expect(pinned).toEqual([]);
});
