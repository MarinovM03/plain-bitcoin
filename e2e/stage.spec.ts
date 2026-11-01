import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { NAV } from '../src/ui/copy.ts';
import { realProblems } from './console.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const STAGE_CHUNK = /\/assets\/stage-[\w-]+\.js$/;

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

function problems(page: Page): string[] {
    const found: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') found.push(message.text());
    });
    page.on('pageerror', (error) => found.push(error.message));
    return found;
}

async function frames(page: Page): Promise<number> {
    return Number((await page.locator('#stage').getAttribute('data-frames')) ?? '0');
}

// Headless Chromium draws WebGL in software; its driver notes are about that renderer, not the page.
const real = (found: string[]) => realProblems(found).filter((text) => !text.includes('GL Driver Message'));

test('the stage loads only after first paint, and the tool answers and takes input before it', async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requestedAt = 0;
    await page.route(STAGE_CHUNK, async (route) => {
        requestedAt = await page.evaluate(() => performance.now()).catch(() => 0);
        await held;
        await route.continue();
    });
    await page.goto('/#/convert');
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33');
    await expect(page.locator('#scene-plot svg')).toHaveCount(1);
    await page.locator('#convert-sats').fill('2,000');
    await expect(page.locator('#tool-result')).toHaveText('2,000 sats = £1.15');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-tier', /./);

    await expect.poll(() => requestedAt).toBeGreaterThan(0);
    const firstPaint = await page.evaluate(
        () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Number.POSITIVE_INFINITY,
    );
    expect(firstPaint).toBeLessThan(requestedAt);
    release();
    await expect(page.locator('#stage')).toHaveAttribute('data-tier', /^(full|phone|plain)$/);
});

test('one WebGL context serves every route, and calculators still answer on top of it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Context count is checked once, on desktop');
    await page.addInitScript(() => {
        const created = { canvases: 0, contexts: 0 };
        (window as unknown as { created: typeof created }).created = created;
        const make = Document.prototype.createElement;
        Document.prototype.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
            if (tag.toLowerCase() === 'canvas') created.canvases += 1;
            return make.call(this, tag, options);
        } as typeof make;
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
            const context = original.call(this, type as '2d', options as CanvasRenderingContext2DSettings);
            if (context && /webgl/.test(type)) created.contexts += 1;
            return context;
        } as typeof original;
    });
    const found = problems(page);
    await page.goto('/?hero=phone');
    await expect(page.locator('#stage canvas.is-ready')).toHaveCount(1, { timeout: 20_000 });
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    for (const id of TOOL_IDS) {
        await nav.getByRole('link', { name: NAV.short[id], exact: true }).click();
        await expect(page.locator('.result__figure')).not.toHaveText('');
        await expect(page.locator('.scene[data-live]')).toHaveCount(1, { timeout: 10_000 });
    }
    // The stage draws in a worker through OffscreenCanvas when it can, so the page itself may hold no context at all.
    const created = await page.evaluate(
        () => (window as unknown as { created: { canvases: number; contexts: number } }).created,
    );
    expect(created.canvases).toBe(1);
    expect(created.contexts).toBeLessThanOrEqual(1);
    await expect(page.locator('#stage canvas')).toHaveCount(1);
    expect(real(found)).toEqual([]);
});

test('reduced motion draws still frames only, and nothing after the field has settled', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Frame counts are checked once, on desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?hero=phone#/power');
    await expect(page.locator('#stage canvas.is-ready')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(500);
    const settled = await frames(page);
    await page.waitForTimeout(2500);
    expect(await frames(page)).toBe(settled);
    expect(settled).toBeLessThanOrEqual(4);
});

test('with motion on, the field settles to zero frames once nothing is changing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Frame counts are checked once, on desktop');
    test.setTimeout(45_000);
    await page.goto('/?hero=phone#/power');
    await expect(page.locator('#stage canvas.is-ready')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(9_000);
    const settled = await frames(page);
    await page.waitForTimeout(2_500);
    expect(await frames(page)).toBe(settled);
    await page.locator('#power-amount').fill('5,000');
    await expect.poll(() => frames(page)).toBeGreaterThan(settled);
});

test('a real new block sends exactly one pulse and one status tick; no new block, no pulse', async ({
    page,
    browserName,
}) => {
    test.skip(browserName === 'webkit', 'Under the fake clock WebKit never renders; the bus is unit tested');
    const chain = await fakeHeightApi(page);
    await page.clock.install();
    await page.goto('/?hero=plain#/left');
    await page.clock.runFor(3_000);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
    await expect(page.locator('#stage')).toHaveAttribute('data-pulses', '0');

    await page.clock.runFor(46_000);
    await expect(page.locator('#stage')).toHaveAttribute('data-pulses', '0');
    await expect(page.locator('#status-block')).not.toHaveAttribute('data-ticks', /./);

    chain.height += 1;
    await page.clock.runFor(46_000);
    await expect(page.locator('#stage')).toHaveAttribute('data-pulses', '1');
    await expect(page.locator('#status-block')).toHaveAttribute('data-ticks', '1');

    await page.clock.runFor(46_000);
    await expect(page.locator('#stage')).toHaveAttribute('data-pulses', '1');
    await expect(page.locator('#status-block')).toHaveAttribute('data-ticks', '1');
});
