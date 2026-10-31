import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { HERO, SITE_NAME, TOOLS } from '../src/ui/copy.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const ROUTES = ['', ...TOOL_IDS] as const;
const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const SIZES = [
    [360, 740],
    [390, 844],
    [844, 390],
    [720, 450],
    [1440, 900],
] as const;

async function open(page: Page, route: string) {
    await page.goto(`/?hero=plain#/${route}`);
    if (route === 'address') await page.locator('#address-input').fill(TAPROOT);
    if (route !== '' && route !== 'left') await expect(page.locator('[data-share="copy"]')).toBeEnabled();
    if (route === '' || route === 'left') await expect(page.locator('#hero-note')).not.toBeEmpty();
}

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

for (const route of ROUTES) {
    test(`#/${route} passes axe (WCAG 2.2 AA)`, async ({ page }) => {
        await open(page, route);
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
            .analyze();
        expect(
            results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target).join(', ')}`),
        ).toEqual([]);
    });
}

test('no route scrolls sideways at phone, landscape, 200% zoom or desktop sizes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewport sweep runs once, on desktop');
    for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        for (const route of ROUTES) {
            await open(page, route);
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, `#/${route} at ${width}x${height}`).toBe(0);
        }
    }
});

test('the keyboard reaches every tool from home in reading order and lands on its heading', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Keyboard path is checked on desktop');
    await open(page, '');
    const order: string[] = [];
    for (let step = 0; step < 2 + TOOL_IDS.length; step++) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => document.activeElement?.textContent?.trim().split('\n')[0] ?? ''));
    }
    expect(order).toEqual([SITE_NAME, `${HERO.link} →`, ...TOOL_IDS.map((id) => TOOLS[id].name)]);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[TOOL_IDS.at(-1) ?? 'address'].name);
});

test('reduced motion turns every transition off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '');
    expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration')),
    ).toMatch(/^0m?s$/);
});
