import { type Browser, expect, type Page, test } from '@playwright/test';
import { supplyAt } from '../src/model/supply.ts';
import { FAKE_HEIGHT, fakeHeightApi } from './height-api.ts';
import { type Png, readPng } from './png.ts';
import { fakePriceApi } from './price-api.ts';
import { settled, waitForStage } from './stage-hooks.ts';

/** One real part per scene, picked where nothing else stands in front of it. */
const PROBES = {
    '': 'convert',
    left: 'era-0',
    power: 'pan-btc',
    convert: 'focus',
    dca: 'buy-80',
    address: 'bow',
} as const;
type Route = keyof typeof PROBES;
/** For the centroid check a compact, unoccluded part, so its box centre is its visual centre. */
const COMPACT: Record<Route, string> = { ...PROBES, left: 'zoom-3' };
const ROUTES = Object.keys(PROBES) as Route[];
const SCENE_ID: Record<Route, string> = {
    '': 'home',
    left: 'left',
    power: 'power',
    convert: 'convert',
    dca: 'dca',
    address: 'address',
};

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Centre of the part's visible, projected area. */
    cx: number;
    cy: number;
}

type Probe = { partRect(id: string): Box | null; hovered(): string | null };

async function open(page: Page, route: Route, fake = true): Promise<void> {
    if (fake) {
        await fakeHeightApi(page);
        await fakePriceApi(page);
    }
    await page.goto(`/?hero=full#/${route}`);
    await waitForStage(page);
    await expect(page.locator(`.scene[data-gl][data-scene="${SCENE_ID[route]}"]`)).toHaveCount(1, { timeout: 20_000 });
    await settled(page);
}

/** A part's box once the page has stopped moving: the feeds landing can still shift the layout after first draw. */
async function partRect(page: Page, id: string): Promise<Box> {
    let box: Box | null = null;
    const seen: string[] = [];
    await expect
        .poll(
            async () => {
                box = await page.evaluate(
                    (part) => (window as unknown as { __pbStage: Probe }).__pbStage.partRect(part),
                    id,
                );
                const key = box ? [box.x, box.y, box.width, box.height].map((v) => v.toFixed(1)).join() : '';
                seen.push(key);
                const recent = seen.slice(-3);
                return (
                    key !== '' &&
                    recent.length === 3 &&
                    recent.every((k) => k === key) &&
                    (box?.width ?? 0) >= 1.5 &&
                    (box?.height ?? 0) >= 1.5
                );
            },
            { timeout: 10_000, intervals: [250] },
        )
        .toBe(true);
    return box as unknown as Box;
}

function centre(box: Box): { x: number; y: number } {
    return { x: box.cx, y: box.cy };
}

const host = (page: Page) => page.locator('[data-scene-window]').first();

/** Hovers the probe part's centre and checks the stage names exactly that part, then lets go of it. */
async function hoverProbe(page: Page, route: Route, where: string): Promise<void> {
    const id = PROBES[route];
    const at = centre(await partRect(page, id));
    await page.mouse.move(at.x, at.y, { steps: 3 });
    const seen = await page
        .waitForFunction(
            (part) => document.querySelector<HTMLElement>('[data-scene-window]')?.dataset.hoveredPart === part,
            id,
            {
                timeout: 5_000,
            },
        )
        .then(() => true)
        .catch(() => false);
    if (!seen) {
        const now = await page.evaluate((part) => {
            const probe = (window as unknown as { __pbStage: Probe }).__pbStage;
            const element = document.elementFromPoint(0, 0);
            return {
                hovered: probe.hovered(),
                rect: probe.partRect(part),
                window: document.querySelector('[data-scene-window]')?.getBoundingClientRect().toJSON(),
                scroll: window.scrollY,
                top: element?.className,
            };
        }, id);
        throw new Error(`${where} #/${route}: pointer at ${at.x},${at.y}; stage says ${JSON.stringify(now)}`);
    }
    await expect(page.locator('.scene__callout').first()).not.toBeHidden();
    await page.mouse.move(2, 2);
    await expect(host(page)).not.toHaveAttribute('data-hovered-part', /./, { timeout: 5_000 });
}

async function withContext(
    browser: Browser,
    size: { width: number; height: number },
    deviceScaleFactor: number,
    run: (page: Page) => Promise<void>,
): Promise<void> {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor });
    try {
        await run(await context.newPage());
    } finally {
        await context.close();
    }
}

for (const dpr of [1, 2]) {
    for (const size of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
    ]) {
        test(`the part under the pointer is the part highlighted, at DPR ${dpr}, ${size.width}x${size.height}, after scroll and resize`, async ({
            browser,
            isMobile,
        }) => {
            test.skip(isMobile, 'Drives its own desktop contexts at each size and pixel ratio');
            test.setTimeout(180_000);
            await withContext(browser, size, dpr, async (page) => {
                for (const route of ROUTES) {
                    await open(page, route);
                    await hoverProbe(page, route, 'as loaded');

                    // Scroll the page under a still scene window: the mapping reads the window where it is now.
                    const top = await host(page).evaluate((element) => element.getBoundingClientRect().top);
                    const by = Math.max(0, Math.min(200, top - 8));
                    await page.evaluate((y) => window.scrollTo(0, y), by);
                    await page.waitForTimeout(150);
                    await hoverProbe(page, route, `scrolled ${by}px`);
                    await page.evaluate(() => window.scrollTo(0, 0));

                    await page.setViewportSize({ width: size.width - 90, height: size.height - 40 });
                    await page.waitForTimeout(300);
                    await hoverProbe(page, route, 'resized');
                    await page.setViewportSize(size);
                }
            });
        });
    }
}

function diffCentroid(a: Png, b: Png, scale: number): { x: number; y: number; count: number } {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let y = 0; y < a.height; y += 1) {
        for (let x = 0; x < a.width; x += 1) {
            const i = (y * a.width + x) * 4;
            const d =
                Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) +
                Math.abs((a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0)) +
                Math.abs((a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0));
            if (d < 36) continue;
            sx += x;
            sy += y;
            count += 1;
        }
    }
    return { x: sx / Math.max(1, count) / scale, y: sy / Math.max(1, count) / scale, count };
}

test('the highlight is drawn under the pointer: its pixel centroid lands within 6 CSS px, for every scene', async ({
    browser,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, at DPR 2 on desktop');
    test.setTimeout(120_000);
    await withContext(browser, { width: 1440, height: 900 }, 2, async (page) => {
        for (const route of ROUTES) {
            await open(page, route);
            // In the full block a cell is boxed in by its neighbours; the one-layer tray of single sats is not.
            if (route === 'convert') {
                await page.locator('#convert-sats').fill('5');
                await settled(page);
            }
            const window = await host(page).boundingBox();
            if (!window) throw new Error('no scene window');
            const at = centre(await partRect(page, COMPACT[route]));
            const clip = { x: window.x, y: window.y, width: window.width, height: window.height };
            // Measure the drawn highlight alone: the engraved DOM tags over the window are set aside.
            await page.evaluate(() => {
                for (const tags of document.querySelectorAll<HTMLElement>('.scene__tags'))
                    tags.style.visibility = 'hidden';
            });
            await page.mouse.move(2, 2);
            await page.waitForTimeout(500);
            const before = test.info().outputPath(`hover-${route || 'home'}-off.png`);
            await page.screenshot({ path: before, clip });
            await page.mouse.move(at.x, at.y);
            await expect(host(page)).toHaveAttribute('data-hovered-part', COMPACT[route]);
            await page.waitForTimeout(500);
            const after = test.info().outputPath(`hover-${route || 'home'}-on.png`);
            await page.screenshot({ path: after, clip });
            const lit = diffCentroid(readPng(before), readPng(after), 2);
            expect(lit.count, `#/${route} highlight pixels`).toBeGreaterThan(20);
            const off = Math.hypot(window.x + lit.x - at.x, window.y + lit.y - at.y);
            expect(off, `#/${route} highlight centroid to pointer, CSS px`).toBeLessThanOrEqual(6);
        }
    });
});

test('dragging turns a scene within its limits, and it eases back home when let go', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse drag is checked on desktop; touch turns sideways only');
    for (const route of ROUTES) {
        await open(page, route);
        const box = await host(page).boundingBox();
        if (!box) throw new Error('no scene window');
        const scene = page.locator('.scene').first();
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.4 + 160, box.y + box.height * 0.5 + 30, { steps: 8 });
        await expect(scene, `#/${route} turned`).toHaveAttribute('data-turned', '');
        await page.mouse.up();
        await expect(scene, `#/${route} back home`).not.toHaveAttribute('data-turned', /./, { timeout: 4_000 });
    }
});

test('each scene agrees with its answer once settled, and only the route on screen loads its scene', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    test.setTimeout(90_000);
    const chunks: string[] = [];
    page.on('request', (request) => {
        const match = /\/assets\/scene-(\w+)-/.exec(request.url());
        if (match?.[1]) chunks.push(match[1]);
    });
    page.context().on('request', (request) => {
        const match = /\/assets\/scene-(\w+)-/.exec(request.url());
        if (match?.[1] && !chunks.includes(match[1])) chunks.push(match[1]);
    });

    await open(page, 'power');
    await expect.poll(() => [...new Set(chunks)]).toEqual(['power']);
    const ratio = Number(/ratio=([\d.]+)/.exec((await settled(page)).glSummary ?? '')?.[1]);
    const tilt = Number(/tilt=(-?[\d.]+)/.exec((await settled(page)).glSummary ?? '')?.[1]);
    expect(tilt).toBeCloseTo(Math.max(-3, Math.min(3, Math.log10(ratio))) * 8, 1);

    await open(page, 'convert', false);
    const sats = page.locator('#convert-sats');
    await sats.fill('');
    await sats.pressSequentially('987654', { delay: 5 });
    await sats.fill('2,000');
    await expect(page.locator('#tool-result')).toHaveText('2,000 sats = £1.15');
    expect((await settled(page)).glSummary).toBe('sats=2000;level=1;filled=20;whole=0');
    await sats.fill('250,000,000');
    expect((await settled(page)).glSummary).toBe('sats=250000000;level=0;filled=500;whole=2');

    await open(page, 'dca', false);
    const worth = (await page.locator('#tool-result-figure').textContent()) ?? '';
    expect((await settled(page)).glSummary).toMatch(new RegExp(`worth=${worth.replace(/[£$,]/g, '.')}$`));

    await open(page, 'address', false);
    await page.locator('#address-input').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect((await settled(page)).glSummary).toBe('teeth=42;state=valid;stuck=0;turned=true');
    await page.locator('#address-input').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3tO');
    expect((await settled(page)).glSummary).toMatch(/^teeth=42;state=invalid;stuck=[1-9]\d*;turned=false$/);

    await open(page, 'left', false);
    expect((await settled(page)).glSummary).toBe(`issued=${supplyAt(FAKE_HEIGHT).issued};era=4`);
    expect(new Set(chunks)).toEqual(new Set(['power', 'convert', 'dca', 'address', 'left']));
});

test('a block pulse reaches the scene too: the next 3.125 BTC drops onto the ingot', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await open(page, 'left');
    await page.evaluate(() =>
        (window as unknown as { __pbStage: { mock(minutes: number, pulse: boolean): void } }).__pbStage.mock(1, true),
    );
    await expect(page.locator('.scene__tag[data-tag="sliver"]')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.scene__tag[data-tag="sliver"]')).toHaveCount(0, { timeout: 8_000 });
});

test('the keyboard reaches every part of a scene, and each part names itself', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard path is checked on desktop');
    await open(page, 'power');
    const buttons = page.locator('.scene__parts .scene__part');
    await expect(buttons).toHaveCount(3);
    await buttons.nth(2).focus();
    await expect(host(page)).toHaveAttribute('data-active-part', 'beam');
    await expect(page.locator('.scene__callout')).toHaveText(/times the cash side|times less the cash side/);
});
