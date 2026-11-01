import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS, type ToolId } from '../src/tools/index.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const SIZES = [
    [390, 844],
    [360, 780],
    [844, 390],
    [1440, 900],
] as const;

const INPUT = '.tool__fields .field__control, .tool__fields .segmented__track';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

async function ready(page: Page, id: ToolId): Promise<void> {
    if (id === 'address') await page.locator('#address-input').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    const answer = id === 'left' ? '#left-figure' : '#tool-result-figure';
    await expect(page.locator(answer)).toHaveText(/\d|[A-Z][a-z]/);
    await expect(page.locator('#scene-plot svg')).toHaveCount(1);
}

async function boxes(page: Page, id: ToolId) {
    return page.evaluate(
        ({ input, left, dca }) => {
            const box = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const { top, bottom, left: x, right } = element.getBoundingClientRect();
                return { top, bottom, left: x, right };
            };
            return {
                scrollY: window.scrollY,
                height: window.innerHeight,
                width: window.innerWidth,
                parts: {
                    status: box('#status'),
                    scene: box('.scene'),
                    graph: box(dca ? '#dca-chart' : '#scene-plot'),
                    input: left ? null : box(input),
                    figure: box(left ? '#left-figure' : '#tool-result-figure'),
                    answer: box(left ? '#left-supply' : '#tool-result'),
                },
            };
        },
        { input: INPUT, left: id === 'left', dca: id === 'dca' },
    );
}

test('on every viewport, status, scene, primary input and answer share the first screen', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'The viewport sweep runs once, on desktop');
    test.setTimeout(120_000);
    for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        for (const id of TOOL_IDS) {
            await page.goto(`/#/${id}`);
            await ready(page, id);
            const measured = await boxes(page, id);
            expect(measured.scrollY).toBe(0);
            for (const [part, box] of Object.entries(measured.parts)) {
                if (part === 'input' && id === 'left') continue;
                const where = `#/${id} ${part} at ${width}x${height}`;
                expect(box, where).not.toBeNull();
                expect(box?.top ?? -1, where).toBeGreaterThanOrEqual(0);
                expect(box?.bottom ?? Number.POSITIVE_INFINITY, where).toBeLessThanOrEqual(measured.height);
                expect(box?.right ?? Number.POSITIVE_INFINITY, where).toBeLessThanOrEqual(measured.width);
                expect((box?.bottom ?? 0) - (box?.top ?? 0), where).toBeGreaterThan(0);
            }
        }
    }
});

test('typing on a phone keeps the answer on screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Checked with a touch screen');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of ['power', 'convert', 'dca', 'address'] as const) {
        await page.goto(`/#/${id}`);
        await ready(page, id);
        await page.locator('.tool__fields .field__input').first().focus();
        await page.waitForTimeout(300);
        for (const selector of ['#tool-result-figure', '#tool-result']) {
            const box = await page.locator(selector).boundingBox();
            expect(box?.y ?? -1, `${id} ${selector}`).toBeGreaterThanOrEqual(0);
            expect((box?.y ?? 0) + (box?.height ?? 0), `${id} ${selector}`).toBeLessThanOrEqual(844);
        }
    }
});
