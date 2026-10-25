import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, HERO, pageTitle, SITE_NAME, TOOL_PAGE, TOOLS } from '../src/ui/copy.ts';

function watchPage(page: Page) {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        const { hostname } = new URL(request.url());
        if (hostname !== 'localhost') problems.push(`external request: ${request.url()}`);
    });
    return problems;
}

async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('home shows the shell, the reserved hero and every tool', async ({ page }) => {
    const problems = watchPage(page);
    await page.goto('/');

    await expect(page).toHaveTitle(SITE_NAME);
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('href', '#/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HERO.heading);
    await expect(page.locator('#hero-canvas')).toHaveCount(1);
    await expect(page.locator('.tool-row')).toHaveCount(TOOL_IDS.length);
    await expect(page.getByText(FOOTER.privacy)).toBeVisible();

    for (const row of await page.locator('.tool-row').all()) {
        const box = await row.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const hero = await page.locator('.hero').boundingBox();
    await page.waitForTimeout(500);
    expect(await page.locator('.hero').boundingBox()).toEqual(hero);

    expect(await horizontalOverflow(page)).toBe(0);
    expect(problems).toEqual([]);
});

test('a tool route takes focus, announces itself and goes back', async ({ page }) => {
    const problems = watchPage(page);
    await page.goto('/');

    await page.locator('.tool-row', { hasText: TOOLS.convert.name }).click();
    await expect(page).toHaveURL(/#\/convert$/);
    await expect(page).toHaveTitle(pageTitle(TOOLS.convert.name));
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(TOOLS.convert.name);
    await expect(heading).toBeFocused();
    await expect(page.locator('#announcer')).toHaveText(pageTitle(TOOLS.convert.name));
    await expect(page.getByText(TOOLS.convert.question)).toBeVisible();
    await expect(page.getByText(TOOL_PAGE.pending)).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goBack();
    await expect(page).toHaveTitle(SITE_NAME);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HERO.heading);

    await page.goto('/#/nowhere');
    await expect(page).toHaveURL(/#\/$/);
    expect(problems).toEqual([]);
});

test('every link is reachable by keyboard with a visible focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard focus is checked on desktop');
    await page.goto('/');
    const links = await page.locator('a').count();
    for (let i = 0; i < links; i += 1) {
        await page.keyboard.press('Tab');
        const outline = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement;
            const style = getComputedStyle(active);
            return { tag: active.tagName, width: style.outlineWidth, style: style.outlineStyle };
        });
        expect(outline).toEqual({ tag: 'A', width: '2px', style: 'solid' });
    }
});
