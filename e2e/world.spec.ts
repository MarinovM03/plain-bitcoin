import { expect, test } from '@playwright/test';
import { hashBits } from '../src/chain/hash.ts';
import { TOKENS } from '../src/styles/tokens.ts';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, WORLD } from '../src/ui/copy.ts';
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
    }
});

test('home keeps the chain, and each tool stands in front of a picture of its own with a line that says what it is', async ({
    page,
}) => {
    await page.goto('/?hero=still#/');
    await expect(page.locator('#chain-still path')).toHaveCount(8);
    const pictures = new Set<string>();
    for (const id of TOOL_IDS) {
        await page.goto(`/?hero=still#/${id}`);
        const picture = page.locator(`#chain-still svg[data-backdrop="${id}"]`);
        await expect(picture).toBeVisible();
        await expect(picture.locator('path').first()).toBeAttached();
        await expect(page.locator('#chain-still polygon')).toHaveCount(0);
        pictures.add(await picture.locator('path').first().getAttribute('d').then(String));
        await expect(page.locator('#world-line')).toHaveText(/^Behind this page: /);
    }
    expect(pictures.size).toBe(TOOL_IDS.length);
    await page.getByRole('link', { name: 'Plain Bitcoin' }).first().click();
    await expect(page.locator('#chain-still path')).toHaveCount(8);
    await expect(page.locator('#chain-still svg[data-backdrop]')).toHaveCount(0);
});

test("a tool's picture is drawn from its own numbers and follows them as they change", async ({ page }) => {
    const lit = () => page.locator('#chain-still path[fill="#f7931a"]').first().getAttribute('d').then(String);
    await page.goto('/?hero=still#/convert');
    await expect(page.locator('#chain-still svg[data-backdrop="convert"]')).toBeVisible();
    await page.locator('#convert-sats').fill('250');
    await expect(page.locator('#world-line')).toHaveText(WORLD.convert('1 sat'));
    const small = await lit();
    expect(small.match(/M/g)).toHaveLength(250);
    await page.locator('#convert-sats').fill('5000000');
    await expect(page.locator('#world-line')).toHaveText(WORLD.convert('10,000 sats'));
    expect((await lit()).match(/M/g)).toHaveLength(500);
    await page.locator('#convert-sats').fill('');
    await expect(page.locator('#world-line')).toHaveText(WORLD.convertEmpty);
    await expect(page.locator('#chain-still path[fill="#f7931a"]')).toHaveCount(0);
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
