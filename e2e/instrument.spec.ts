import { expect, type Page, test } from '@playwright/test';
import { TOKENS } from '../src/styles/tokens.ts';
import { ADDRESS, NAV } from '../src/ui/copy.ts';
import { fakeHeightApi } from './height-api.ts';
import { hex, near, type Png, pixel, readPng } from './png.ts';
import { fakePriceApi } from './price-api.ts';
import { settled, waitForStage } from './stage-hooks.ts';

const ROUTES = ['', 'left', 'power', 'convert', 'dca', 'address'] as const;
const PLATE = hex(TOKENS.plate);

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

async function shot(page: Page, name: string): Promise<{ png: Png; scale: number }> {
    const path = test.info().outputPath(`${name}.png`);
    await page.screenshot({ path });
    const png = readPng(path);
    return { png, scale: png.width / (page.viewportSize()?.width ?? png.width) };
}

/**
 * Points inside every plate on screen where no readout ink is drawn: inset corners and edge midpoints, plus empty
 * spots in the gauge window that hit only the plate or the bare SVG. Each must be the plate's own colour.
 */
async function platePoints(page: Page): Promise<{ x: number; y: number; where: string }[]> {
    return page.evaluate(() => {
        const points: { x: number; y: number; where: string }[] = [];
        const height = window.innerHeight;
        for (const plate of document.querySelectorAll<HTMLElement>('[data-plate]')) {
            const surface = plate.querySelector<HTMLElement>(':scope > .gauge') ?? plate;
            const box = surface.getBoundingClientRect();
            if (box.width < 40 || box.height < 40) continue;
            const name = `${plate.className.split(' ')[0]}`;
            const candidates = [
                [box.left + 7, box.top + 7],
                [box.right - 7, box.top + 7],
                [box.left + 7, box.bottom - 7],
                [box.right - 7, box.bottom - 7],
                [box.left + box.width / 2, box.top + 3],
                [box.left + 3, box.top + box.height / 2],
                [box.right - 3, box.top + box.height / 2],
                [box.left + box.width / 2, box.bottom - 3],
            ];
            for (const [x = 0, y = 0] of candidates) {
                if (y < 0 || y >= height) continue;
                const hit = document.elementFromPoint(x, y);
                if (
                    hit &&
                    (hit === surface ||
                        hit === plate ||
                        hit.matches(
                            '.scene, .tool__panel, .tool__head, .overview, .tile, .cautions, .footer__inner, .bezel__inner, .home, .gauge',
                        ))
                )
                    points.push({ x, y, where: name });
            }
        }
        const plot = document.querySelector<HTMLElement>('#scene-plot');
        const area = plot?.getBoundingClientRect();
        if (plot && area) {
            // Only bare background counts: never a point inside, or within 3 px of, any drawn mark.
            const marks = [...plot.querySelectorAll('svg :not(g)')].map((mark) => mark.getBoundingClientRect());
            const onMark = (x: number, y: number) =>
                marks.some((box) => x >= box.left - 3 && x <= box.right + 3 && y >= box.top - 3 && y <= box.bottom + 3);
            for (let gx = 0.05; gx < 1; gx += 0.15) {
                for (let gy = 0.05; gy < 1; gy += 0.15) {
                    const x = area.left + area.width * gx;
                    const y = area.top + area.height * gy;
                    if (y >= height) continue;
                    const clear = [
                        [0, 0],
                        [4, 0],
                        [-4, 0],
                        [0, 4],
                        [0, -4],
                    ].every(([dx = 0, dy = 0]) => {
                        const hit = document.elementFromPoint(x + dx, y + dy);
                        return hit === plot || hit?.tagName.toLowerCase() === 'svg';
                    });
                    if (clear && !onMark(x, y)) points.push({ x, y, where: 'gauge window' });
                }
            }
        }
        return points;
    });
}

test('no plate ever shows the weather: at max tension and mid-pulse, every bare plate pixel is the plate', async ({
    page,
    isMobile,
}) => {
    test.setTimeout(120_000);
    for (const route of ROUTES) {
        await page.goto(`/?hero=phone#/${route}`);
        await waitForStage(page);
        if (route === 'address')
            await page.locator('#address-input').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
        if (route !== '') await settled(page);
        // Pin the mood at a 30-minute wait and send one pulse through: the brightest the body ever gets.
        await page.evaluate(() =>
            (window as unknown as { __stage: { mock(minutes: number, pulse: boolean): void } }).__stage.mock(30, true),
        );
        await expect(page.locator('#stage')).toHaveAttribute('data-pulsing', '', { timeout: 5_000 });
        await page.waitForTimeout(isMobile ? 500 : 900);
        const points = await platePoints(page);
        const { png, scale } = await shot(page, `plates-${route || 'home'}`);
        expect(points.length, `#/${route}`).toBeGreaterThanOrEqual(5);
        const bad = points
            .map((point) => ({ ...point, colour: pixel(png, point.x * scale, point.y * scale) }))
            .filter(({ colour }) => !near(colour, PLATE, 7));
        expect(bad, `#/${route}`).toEqual([]);
    }
});

test('the body visibly drifts in the gutters within two seconds, with nobody touching anything', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=phone#/dca');
    await waitForStage(page);
    await page.waitForTimeout(1_500);
    const gutter = { x: 0, y: 120, width: 72, height: 600 };
    const a = test.info().outputPath('drift-a.png');
    const b = test.info().outputPath('drift-b.png');
    await page.screenshot({ path: a, clip: gutter });
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: b, clip: gutter });
    const first = readPng(a);
    const second = readPng(b);
    let changed = 0;
    for (let i = 0; i < first.data.length; i += 4) {
        const diff =
            Math.abs((first.data[i] ?? 0) - (second.data[i] ?? 0)) +
            Math.abs((first.data[i + 2] ?? 0) - (second.data[i + 2] ?? 0));
        if (diff > 6) changed += 1;
    }
    expect(changed / (first.width * first.height)).toBeGreaterThan(0.02);
    // And it stays dim: nothing in the gutter outside a pulse is brighter than the isobar index line.
    const ceiling = hex(TOKENS.isobarIndex);
    for (let i = 0; i < second.data.length; i += 4) {
        const brightest = Math.max(second.data[i] ?? 0, second.data[i + 1] ?? 0, second.data[i + 2] ?? 0);
        expect(brightest).toBeLessThanOrEqual(Math.max(...ceiling) + 6);
    }
});

test('under reduced motion the body is one still frame', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?hero=phone#/dca');
    await waitForStage(page);
    await page.waitForTimeout(1_200);
    const gutter = { x: 0, y: 120, width: 72, height: 600 };
    const a = test.info().outputPath('still-a.png');
    const b = test.info().outputPath('still-b.png');
    await page.screenshot({ path: a, clip: gutter });
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: b, clip: gutter });
    expect(Buffer.compare(readPng(a).data, readPng(b).data)).toBe(0);
});

const SIZES = [
    [360, 780],
    [390, 844],
    [844, 390],
    [1440, 900],
] as const;

test('Paste sits flush inside the address field at the trailing end, a full tap target, at every size', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'The viewport sweep runs once, on desktop');
    for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await page.goto('/?hero=plain#/address');
        const button = page.locator('#address-paste');
        await expect(button).toBeVisible();
        const geometry = await page.evaluate(() => {
            const group = document.querySelector<HTMLElement>('.address-field');
            const paste = document.querySelector<HTMLElement>('#address-paste');
            const input = document.querySelector<HTMLInputElement>('#address-input');
            if (!group || !paste || !input) return null;
            const g = group.getBoundingClientRect();
            const b = paste.getBoundingClientRect();
            const border = Number.parseFloat(getComputedStyle(group).borderRightWidth);
            const padding = Number.parseFloat(getComputedStyle(input).paddingRight);
            return { g, b, border, padding, inputRight: input.getBoundingClientRect().right };
        });
        expect(geometry).not.toBeNull();
        const { g, b, border, padding } = geometry as NonNullable<typeof geometry>;
        const where = `${width}x${height}`;
        expect(Math.abs(g.right - border - b.right), where).toBeLessThanOrEqual(6);
        expect(Math.abs((g.top + g.bottom) / 2 - (b.top + b.bottom) / 2), where).toBeLessThanOrEqual(2);
        expect(b.left, where).toBeGreaterThan(g.left);
        expect(b.top, where).toBeGreaterThan(g.top);
        expect(b.bottom, where).toBeLessThan(g.bottom);
        expect(b.height, where).toBeGreaterThanOrEqual(44);
        expect(b.width, where).toBeGreaterThanOrEqual(44);
        // The typed text never runs under the button.
        expect(padding, where).toBeGreaterThanOrEqual(b.width);
    }
});

test('when the clipboard is blocked, Paste says how to paste by hand', async ({ page }) => {
    await page.goto('/?hero=plain#/address');
    await page.evaluate(() => {
        navigator.clipboard.readText = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    });
    await page.locator('#address-paste').click();
    await expect(page.locator('#address-guard')).toHaveText(ADDRESS.pasteBlocked);
});

test('changing mode flips the face in on its mount while the bezel knob slides, and reduced motion swaps at once', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=plain#/left');
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    await nav.getByRole('link', { name: NAV.short.dca, exact: true }).click();
    await expect(page.locator('main')).toHaveAttribute('data-flip', 'dca');
    const flipping = await page.evaluate(() => document.querySelector('.gauge')?.getAnimations().length ?? 0);
    expect(flipping).toBeGreaterThan(0);
    await expect(page.locator('main')).not.toHaveAttribute('data-flip', /./, { timeout: 3_000 });
    const knob = await page.evaluate(() => {
        const modes = document.querySelector<HTMLElement>('.modes');
        const current = modes?.querySelector<HTMLElement>('[aria-current="page"]');
        return { x: modes?.style.getPropertyValue('--knob-x'), left: `${current?.offsetLeft}px` };
    });
    expect(knob.x).toBe(knob.left);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nav.getByRole('link', { name: NAV.short.power, exact: true }).click();
    await expect(page.locator('.tool--power')).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector('.gauge')?.getAnimations().length ?? 0)).toBe(0);
});
