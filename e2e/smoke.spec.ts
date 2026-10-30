import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, HERO, pageTitle, ROUTE, SITE_NAME, TOOLS } from '../src/ui/copy.ts';
import { fakeHeightApi, isApiRequest } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

function watchPage(page: Page) {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('request', (request) => {
        const { hostname } = new URL(request.url());
        if (hostname !== 'localhost' && !isApiRequest(request.url()))
            problems.push(`external request: ${request.url()}`);
    });
    return problems;
}

async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('home shows the shell, the live hero and every tool in order', async ({ page }) => {
    const problems = watchPage(page);
    await page.goto('/');

    await expect(page).toHaveTitle(SITE_NAME);
    await expect(page.getByRole('link', { name: SITE_NAME })).toHaveAttribute('href', '#/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HERO.heading);
    await expect(page.locator('#hero-figure')).toHaveText('894,203.1019 BTC');
    await expect(page.locator('.tool-row__name')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].name));
    await expect(page.locator('.tool-row__preview')).toHaveText(TOOL_IDS.map((id) => TOOLS[id].preview));
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

for (const id of TOOL_IDS) {
    test(`#/${id} loads its frame without overflow`, async ({ page }) => {
        const problems = watchPage(page);
        await page.goto(`/#/${id}`);

        await expect(page).toHaveTitle(pageTitle(TOOLS[id].name));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[id].name);
        await expect(page.getByText(TOOLS[id].question)).toBeVisible();
        await expect(page.getByText(TOOLS[id].privacy)).toBeVisible();
        await expect(page.locator('.share-bar button')).toHaveCount(3);
        for (const button of await page.locator('.share-bar button').all()) {
            if (id !== 'address') await expect(button).toBeEnabled();
            else await expect(button).toBeDisabled();
        }
        if (id === 'left') await expect(page.locator('#hero-stage')).toHaveCount(1);
        else await expect(page.locator('.result__figure')).toBeVisible();

        expect(await horizontalOverflow(page)).toBe(0);
        expect(problems).toEqual([]);
    });
}

test('tapping a row opens the tool, focuses and announces it; back and forward work', async ({ page }) => {
    const problems = watchPage(page);
    await page.goto('/');

    await page.locator('.tool-row', { hasText: TOOLS.convert.name }).click();
    await expect(page).toHaveURL(/#\/convert$/);
    await expect(page).toHaveTitle(pageTitle(TOOLS.convert.name));
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(TOOLS.convert.name);
    await expect(heading).toBeFocused();
    await expect(page.locator('#announcer')).toHaveText(pageTitle(TOOLS.convert.name));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page).toHaveTitle(SITE_NAME);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HERO.heading);

    await page.goForward();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.convert.name);

    await page.getByRole('link', { name: /All tools/ }).click();
    await expect(page).toHaveURL(/#\/$/);
    expect(problems).toEqual([]);
});

test('an unknown route goes home with one quiet note', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
        window.location.hash = '#/nowhere';
    });
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('main').getByText(ROUTE.notFound)).toHaveCount(1);
    await expect(page.locator('#announcer')).toHaveText(ROUTE.notFound);

    await page.locator('.tool-row').first().click();
    await expect(page.locator('main').getByText(ROUTE.notFound)).toHaveCount(0);

    await page.goto('/#/POWER');
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('main').getByText(ROUTE.notFound)).toBeVisible();
});

test('amount fields group thousands without moving the caret', async ({ page }) => {
    await page.goto('/#/power');
    const amount = page.getByLabel('Amount', { exact: true });
    await expect(amount).toHaveValue('1,000');

    await amount.fill('');
    await amount.pressSequentially('1234567.891');
    await expect(amount).toHaveValue('1,234,567.89');

    await amount.fill('');
    await amount.pressSequentially('1234');
    await amount.press('Home');
    await amount.press('ArrowRight');
    await amount.pressSequentially('9');
    await expect(amount).toHaveValue('19,234');
    expect(await amount.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(2);

    await amount.press('ArrowRight');
    await amount.press('Backspace');
    await expect(amount).toHaveValue('1,234');
});

test('every link is reachable by keyboard with a visible focus ring, and Enter opens a tool', async ({
    page,
    isMobile,
}) => {
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

    await page.locator('.tool-row').nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS.power.name);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Amount', { exact: true })).toBeFocused();
});
