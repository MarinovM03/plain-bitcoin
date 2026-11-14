import { expect, test } from '@playwright/test';
import { hashBits } from '../src/chain/hash.ts';
import { TOKENS } from '../src/styles/tokens.ts';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER } from '../src/ui/copy.ts';
import { FAKE_HEIGHT, fakeHash, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const ROUTES = ['', ...TOOL_IDS];
const HOME_PANELS = ['.chain__legend', '.tool-row', '.chain-about', '.home__share', '.cautions'];
const TOOL_PANELS = ['.tool__screen', '.tool__below'];

const setBits = (hash: string) => String(hashBits(hash).reduce((count, bit) => count + bit, 0));

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

test('the world stands behind every page, out of the way of pointers and screen readers', async ({ page }) => {
    for (const route of ROUTES) {
        await page.goto(`/?hero=still#/${route}`);
        const world = page.locator('#chain');
        await expect(world, `#/${route}`).toHaveAttribute('data-bits', /^[1-9]\d*$/);
        await expect(world).toHaveAttribute('aria-hidden', 'true');
        await expect(world).toHaveCSS('position', 'fixed');
        await expect(world).toHaveCSS('pointer-events', 'none');
        await expect(world.locator('a, button, [tabindex], [role]')).toHaveCount(0);
        await expect(page.locator('#chain-still svg')).toBeVisible();
        await expect(page.locator('#chain-still path')).toHaveCount(8);
    }
});

test('each page sees the chain from its own place', async ({ page }) => {
    const pictures = new Set<string>();
    for (const route of ROUTES) {
        await page.goto(`/?hero=still#/${route}`);
        await expect(page.locator('#chain-still path')).toHaveCount(8);
        pictures.add(await page.locator('#chain-still svg polygon').first().getAttribute('points').then(String));
    }
    expect(pictures.size).toBe(ROUTES.length);
});

test('it is built from the newest blocks the page knows: the live tip, or a saved set where nothing is fetched', async ({
    page,
}) => {
    await page.goto('/?hero=still#/');
    await expect(page.locator('#chain')).toHaveAttribute('data-state', 'live');
    await expect(page.locator('#chain')).toHaveAttribute('data-bits', setBits(fakeHash(FAKE_HEIGHT)));

    const calls: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') calls.push(request.url());
    });
    await page.goto('/?hero=still#/power');
    await page.reload();
    await expect(page.locator('#chain')).toHaveAttribute('data-state', 'saved');
    await expect(page.locator('#chain')).toHaveAttribute('data-bits', /^[1-9]\d*$/);
    expect(calls).toEqual([]);
});

test('without the lit scene every block of text and every input sits on an opaque plate', async ({ page }) => {
    const opaque = (selector: string) =>
        expect(page.locator(selector).first(), selector).toHaveCSS('background-color', /^rgb\(/);
    await page.goto('/?hero=still#/');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'still');
    for (const selector of [...HOME_PANELS, '.topbar', '.footer']) await opaque(selector);
    for (const id of TOOL_IDS) {
        await page.goto(`/?hero=still#/${id}`);
        for (const selector of TOOL_PANELS) await opaque(selector);
    }
    await expect(page.getByText(FOOTER.motion)).toBeVisible();
});

test('with the lit scene running the panels turn to frosted glass with the tint the contrast check was made for', async ({
    page,
    browserName,
}) => {
    test.skip(browserName !== 'chromium', 'The forced scene is checked in Chromium');
    // The test browser has no GPU, so the forced scene is drawn in software: a small window keeps it responsive.
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 640, height: 480 });
    const [, red, green, blue, alpha] = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(TOKENS.glass) ?? [];
    const tint = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    await page.goto('/?hero=scene#/');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'scene');
    for (const selector of [...HOME_PANELS, '.topbar']) {
        await expect(page.locator(selector).first(), selector).toHaveCSS('background-color', tint);
        await expect(page.locator(selector).first(), selector).toHaveCSS('backdrop-filter', /blur\(/);
    }
    await page.locator('.tool-row[data-tool="convert"]').click();
    for (const selector of TOOL_PANELS)
        await expect(page.locator(selector), selector).toHaveCSS('background-color', tint);
    for (const selector of ['.field__control', '.picture']) {
        await expect(page.locator(selector).first(), selector).toHaveCSS('background-color', /^rgb\(/);
    }
});
