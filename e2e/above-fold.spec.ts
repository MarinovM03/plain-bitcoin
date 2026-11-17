import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS, type ToolId } from '../src/tools/index.ts';
import { TOOLS } from '../src/ui/copy.ts';
import { fakeHeaderApi, fakeHeightApi } from './height-api.ts';
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
    await fakeHeaderApi(page);
    await fakePriceApi(page);
});

async function ready(page: Page, id: ToolId): Promise<void> {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[id].name);
    if (id === 'miner') {
        await expect(page.locator('#miner-run')).toBeEnabled({ timeout: 10_000 });
        return;
    }
    if (id === 'address') await page.locator('#address-input').fill('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    const answer = id === 'left' ? '#left-figure' : '#tool-result-figure';
    await expect(page.locator(answer)).toHaveText(/\d|[A-Z][a-z]/);
    if (id !== 'convert') await expect(page.locator('#picture-plot > svg.gauge-svg')).toHaveCount(1);
}

const PARTS: Partial<Record<ToolId, { input: string; figure: string; answer: string }>> = {
    miner: { input: '#miner-run', figure: '#miner-best', answer: '#miner-needs' },
    convert: { input: '#convert-sats', figure: '#tool-result-figure', answer: '#tool-result' },
};

async function boxes(page: Page, id: ToolId) {
    return page.evaluate(
        ({ input, left, dca, own }) => {
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
                    title: box('h1'),
                    ...(left ? {} : { input: box(own?.input ?? input) }),
                    figure: box(own?.figure ?? (left ? '#left-figure' : '#tool-result-figure')),
                    answer: box(own?.answer ?? (left ? '#left-supply' : '#tool-result')),
                    ...(dca ? { graph: box('#picture-plot .dca-chart') } : {}),
                },
            };
        },
        { input: INPUT, left: id === 'left', dca: id === 'dca', own: PARTS[id] ?? null },
    );
}

test('on every viewport the plain name, the first input and the answer share the first screen, and so does the DCA graph', async ({
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
        await page
            .locator(id === 'convert' ? '#convert-sats' : '.tool__fields .field__input')
            .first()
            .focus();
        await page.waitForTimeout(300);
        for (const selector of ['#tool-result-figure', '#tool-result']) {
            const box = await page.locator(selector).boundingBox();
            expect(box?.y ?? -1, `${id} ${selector}`).toBeGreaterThanOrEqual(0);
            // A phone keyboard takes about 40% of the screen; the answer sits above where it would rise to.
            expect((box?.y ?? 0) + (box?.height ?? 0), `${id} ${selector}`).toBeLessThanOrEqual(844 * 0.62);
        }
    }
});
