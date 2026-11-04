import { expect, type Page, test } from '@playwright/test';
import { TOKENS } from '../src/styles/tokens.ts';
import { SHARE } from '../src/ui/copy.ts';
import { formatWhole } from '../src/util/format.ts';
import { FAKE_HEIGHT, fakeHeightApi } from './height-api.ts';
import { hex, near, pixel, postcardName, readPng } from './png.ts';
import { fakePriceApi } from './price-api.ts';

const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const PLATE = hex(TOKENS.plate);

interface Case {
    tool: string;
    route: string;
    figure: (page: Page) => Promise<string>;
    prepare?: (page: Page) => Promise<void>;
}

const text = (selector: string) => async (page: Page) => ((await page.locator(selector).textContent()) ?? '').trim();

const CASES: Case[] = [
    { tool: 'home', route: '', figure: async () => formatWhole(FAKE_HEIGHT) },
    { tool: 'left', route: 'left', figure: text('#left-figure') },
    { tool: 'power', route: 'power', figure: text('#tool-result-figure') },
    {
        tool: 'convert',
        route: 'convert',
        figure: text('#tool-result-figure'),
        prepare: (page) => expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33'),
    },
    { tool: 'dca', route: 'dca', figure: text('#tool-result-figure') },
    {
        tool: 'address',
        route: 'address',
        figure: text('#tool-result-figure'),
        prepare: async (page) => {
            await page.locator('#address-input').fill(TAPROOT);
            await expect(page.locator('#tool-result-figure')).toHaveText('Taproot');
        },
    },
];

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

for (const { tool, route, figure, prepare } of CASES) {
    test(`#/${route} prints a postcard: 2400 x 1256, plate to the corners, the page's own number, nothing sent`, async ({
        page,
    }) => {
        await page.goto(`/?hero=plain#/${route}`);
        if (route === '' || route === 'left')
            await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
        await prepare?.(page);
        const print = page.locator('.share-bar [data-share="print"]').first();
        await expect(print).toBeEnabled();
        const shown = await figure(page);

        const sent: string[] = [];
        page.on('request', (request) => sent.push(request.url()));
        await print.click();
        const card = page.locator('.tray__card');
        await expect(card).toHaveAttribute('data-number', shown);
        await expect(page.locator('.tray__status')).toHaveText(SHARE.printed);

        const [file] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.tray [data-tray="download"]').click(),
        ]);
        expect(file.suggestedFilename()).toMatch(postcardName(tool));
        const path = test.info().outputPath(file.suggestedFilename());
        await file.saveAs(path);
        const png = readPng(path);
        expect([png.width, png.height]).toEqual([2400, 1256]);
        for (const [x, y] of [
            [0, 0],
            [png.width - 1, 0],
            [0, png.height - 1],
            [png.width - 1, png.height - 1],
            [20, png.height / 2],
            [png.width - 20, png.height / 2],
            [png.width / 2, 20],
            [png.width / 2, png.height - 20],
        ] as const)
            expect(pixel(png, x, y), `${tool} at ${x},${y}`).toEqual(PLATE);

        await page.locator('.tray input[value="square"]').check({ force: true });
        await expect(card).toHaveAttribute('data-format', 'square');
        const [square] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.tray [data-tray="download"]').click(),
        ]);
        const squarePath = test.info().outputPath(`square-${square.suggestedFilename()}`);
        await square.saveAs(squarePath);
        const squarePng = readPng(squarePath);
        expect([squarePng.width, squarePng.height]).toEqual([2160, 2160]);
        expect(near(pixel(squarePng, 1, 1), PLATE, 0)).toBe(true);

        const href = new URL((await page.locator('.tray [data-tray="post"]').getAttribute('href')) ?? '');
        expect(`${href.origin}${href.pathname}`).toBe('https://x.com/intent/post');
        const compose = href.searchParams.get('text') ?? '';
        expect(compose.length).toBeLessThanOrEqual(200);
        expect(compose).toContain(`plainbitcoin.org/#/${route}`);
        expect(compose).toContain('@PlainBTC');
        expect(compose).not.toContain('#bitcoin');
        if (tool === 'address') expect(compose).not.toContain(TAPROOT);
        expect(sent.filter((url) => !url.startsWith('http://localhost'))).toEqual([]);
    });
}

test('the printer loads only on a first sign of sharing, never with the page', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    const chunks: string[] = [];
    page.on('request', (request) => {
        if (/\/assets\/postcard-/.test(request.url())) chunks.push(request.url());
    });
    await page.goto('/?hero=plain#/convert');
    await expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33');
    await page.waitForTimeout(1_500);
    expect(chunks).toEqual([]);
    await page.locator('.share-bar').hover();
    await expect.poll(() => chunks.length).toBeGreaterThan(0);
});

test('Copy image says plainly when this browser cannot copy images', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'ClipboardItem', { value: undefined, configurable: true });
    });
    await page.goto('/?hero=plain#/convert');
    await page.locator('[data-share="print"]').click();
    await page.locator('.tray [data-tray="copy"]').click();
    await expect(page.locator('.tray__status')).toHaveText(SHARE.copyUnsupported);
});

test('the print feeds out of the slot, and appears at once under reduced motion', async ({ page }) => {
    await page.goto('/?hero=plain#/dca');
    await page.locator('[data-share="print"]').click();
    await expect(page.locator('.tray__paper')).toHaveClass(/is-feeding/);
    await page.locator('.tray [data-tray="close"]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-share="print"]').click();
    await expect(page.locator('.tray__status')).toHaveText(SHARE.printed);
    await expect(page.locator('.tray__paper')).not.toHaveClass(/is-feeding/);
});
