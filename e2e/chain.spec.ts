import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { CHAIN, TOOLS } from '../src/ui/copy.ts';
import { formatWhole } from '../src/util/format.ts';
import { realProblems } from './console.ts';
import { FAKE_HEIGHT, fakeHash, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const chain = (page: Page) => page.locator('#chain');

// One poll interval: the clock jumps past it, then real time lets the mocked answer land.
async function step(page: Page): Promise<void> {
    await page.clock.fastForward(46_000);
    await page.waitForTimeout(400);
}

async function requested(page: Page, pattern: RegExp): Promise<string[]> {
    const urls: string[] = [];
    page.on('request', (request) => {
        if (pattern.test(request.url())) urls.push(request.url());
    });
    return urls;
}

test.beforeEach(async ({ page }) => {
    await fakePriceApi(page);
});

test('home draws the chain from the real blocks and says the same in words', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    await fakeHeightApi(page);
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT));
    await expect(chain(page)).toHaveAttribute('data-state', 'live');
    await expect(chain(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#chain-forming')).toHaveText(CHAIN.forming('4 min'));
    await expect(page.locator('#chain-newest')).toContainText(`block ${formatWhole(FAKE_HEIGHT)}`);
    await expect(page.locator('#chain-still polygon[stroke-dasharray]')).toHaveCount(3);
    await expect(page.locator('#chain-still path')).toHaveCount(8);

    await page.locator('.chain-about__summary').click();
    const rows = page.locator('#chain-rows tr');
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText(formatWhole(FAKE_HEIGHT));
    await expect(rows.first()).toContainText(fakeHash(FAKE_HEIGHT).slice(-12));
    await expect(page.locator('#barcode path')).toHaveAttribute('d', /^M\d+ 0h/);
    expect(realProblems(problems)).toEqual([]);
});

test('nothing in the picture is a link: clicks on it never change the route, and every tool opens by keyboard', async ({
    page,
    isMobile,
}) => {
    await fakeHeightApi(page);
    await page.goto('/');
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT));
    await expect(chain(page).locator('a, button, [tabindex], [role]')).toHaveCount(0);
    const box = await chain(page).boundingBox();
    if (!box) throw new Error('no chain');
    for (const [fx, fy] of [
        [0.15, 0.6],
        [0.3, 0.5],
        [0.5, 0.5],
        [0.7, 0.4],
        [0.85, 0.3],
        [0.5, 0.85],
    ] as const) {
        await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
        if (isMobile) await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
        expect(new URL(page.url()).hash.replace(/^#\/?$/, '')).toBe('');
    }

    test.skip(isMobile, 'Keyboard path is checked on desktop');
    for (const id of TOOL_IDS) {
        await page.goto('/');
        const row = page.locator(`.tool-row[data-tool="${id}"]`);
        for (let presses = 0; presses < 40 && !(await row.evaluate((el) => el === document.activeElement)); presses++)
            await page.keyboard.press('Tab');
        await expect(row).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`#/${id}$`));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[id].name);
    }
});

test('a real new block advances the chain exactly once; no new block, no advance', async ({ page }) => {
    const api = await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT));
    await expect(chain(page)).toHaveAttribute('data-advances', '0');

    await step(page);
    await expect(chain(page)).toHaveAttribute('data-advances', '0');

    api.height += 1;
    await step(page);
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT + 1));
    await expect(chain(page)).toHaveAttribute('data-advances', '1');
    await expect(page.locator('#announcer')).toHaveText(CHAIN.arrived(formatWhole(FAKE_HEIGHT + 1)));

    api.height += 5;
    await step(page);
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT + 6));
    await expect(chain(page)).toHaveAttribute('data-advances', '2');
});

test('the block list is fetched once on load and again only when the height changes', async ({ page }) => {
    const api = await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT));
    const lists = () => api.calls.filter((url) => !url.endsWith('/tip/height')).length;
    expect(lists()).toBe(1);
    await step(page);
    await step(page);
    expect(lists()).toBe(1);
    api.height += 1;
    await step(page);
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT + 1));
    expect(lists()).toBe(2);
});

test('with the feed down, the chain shows saved blocks and says so calmly', async ({ page }) => {
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\//, (route) => route.abort());
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-state', 'saved', { timeout: 20_000 });
    await expect(page.locator('#chain-forming')).toHaveText(
        /^Couldn't reach mempool\.space\. Showing blocks .+ saved on \d/,
    );
    await expect(page.locator('#chain-still path')).toHaveCount(8);
    await expect(page.locator('#chain-still polygon[stroke-dasharray]')).toHaveCount(0);
});

test('when the feed drops after a good answer, the last blocks stay with the time they were seen', async ({ page }) => {
    await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-state', 'live');
    await page.route(/^https:\/\/(mempool\.space|blockstream\.info)\//, (route) => route.abort());
    await step(page);
    await expect(chain(page)).toHaveAttribute('data-state', 'stale');
    await expect(page.locator('#chain-forming')).toHaveText(/showing the last blocks we saw at \d\d:\d\d UTC/i);
    await expect(page.locator('#chain-rows tr')).toHaveCount(8);
});

test('without the lit scene the drawn still stands in, on purpose, and loads no canvas', async ({ page }) => {
    await fakeHeightApi(page);
    await page.goto('/?hero=still');
    await expect(chain(page)).toHaveAttribute('data-hero', 'still');
    await expect(chain(page)).toHaveAttribute('data-tip', String(FAKE_HEIGHT));
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#chain-still svg')).toBeVisible();
    const box = await page.locator('#chain-still svg').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(150);
});

test('the lit scene uses one canvas for the whole visit, draws no frames under reduced motion, and loads on home only', async ({
    page,
    browserName,
}) => {
    test.skip(browserName !== 'chromium', 'The forced scene is checked in Chromium');
    await fakeHeightApi(page);
    const hero = await requested(page, /\/assets\/hero-/);
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).not.toHaveText('');
    await page.waitForTimeout(600);
    expect(hero).toEqual([]);
    expect(await page.locator('canvas').count()).toBe(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?hero=scene#/');
    await expect(chain(page)).toHaveAttribute('data-hero', 'scene');
    await expect(chain(page)).toHaveAttribute('data-frames', /\d+/);
    await page.waitForTimeout(400);
    const before = await chain(page).getAttribute('data-frames');
    await page.waitForTimeout(2000);
    expect(await chain(page).getAttribute('data-frames')).toBe(before);
    expect(hero).toHaveLength(1);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect
        .poll(async () => Number(await chain(page).getAttribute('data-frames')))
        .toBeGreaterThan(Number(before));

    for (const id of ['left', 'dca'] as const) {
        await page.locator('.menu__toggle').click();
        await page.locator(`.menu__link[data-nav="${id}"]`).click();
        await expect(page.locator('canvas')).toHaveCount(0);
        await page.getByRole('link', { name: 'Plain Bitcoin' }).first().click();
        await expect(page.locator('canvas.hero__canvas')).toHaveCount(1);
    }
    expect(hero).toHaveLength(1);
});
