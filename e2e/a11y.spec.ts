import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { TOOL_IDS } from '../src/tools/index.ts';
import { FOOTER, SITE_NAME, TOOLS } from '../src/ui/copy.ts';
import { fakeHeaderApi, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const ROUTES = ['', ...TOOL_IDS] as const;
const TILE_ORDER = ['miner', 'left', 'convert', 'power', 'dca', 'address'] as const;
const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const SIZES = [
    [360, 740],
    [360, 780],
    [390, 844],
    [844, 390],
    [720, 450],
    [1440, 900],
] as const;

async function open(page: Page, route: string) {
    await page.goto(`/?hero=still#/${route}`);
    if (route === 'address') await page.locator('#address-input').fill(TAPROOT);
    if (route === 'miner') {
        await page.locator('#miner-run').click();
        await expect(page.locator('#miner-best')).toHaveAttribute('data-roll', /^\d+$/);
        await page.locator('#miner-run').click();
    }
    if (route !== '' && route !== 'left') await expect(page.locator('[data-share="print"]')).toBeEnabled();
    if (route === 'left') await expect(page.locator('#left-note')).not.toBeEmpty();
    const live = route === '' || route === 'miner' || route === 'left' || route === 'convert';
    if (live) await expect(page.locator('#status')).toHaveAttribute('data-state', 'live');
    // The tiles fade in on entry; contrast is judged once they have settled.
    await page.waitForFunction(() =>
        document
            .getAnimations()
            .every(
                (animation) =>
                    !(animation instanceof CSSAnimation) ||
                    animation.animationName !== 'rise' ||
                    animation.playState === 'finished',
            ),
    );
}

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakeHeaderApi(page);
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
    const expected = [SITE_NAME, 'mempool.space', `${FOOTER.handle} ↗`, ...TILE_ORDER.map((id) => TOOLS[id].name)];
    for (let step = 0; step < expected.length; step++) {
        await page.keyboard.press('Tab');
        order.push(
            await page.evaluate(() => {
                const active = document.activeElement;
                const text = active?.querySelector('.tile__name')?.textContent ?? active?.textContent ?? '';
                return text.trim().replace(/ \d\d:\d\d UTC$/, '');
            }),
        );
    }
    expect(order).toEqual(expected);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOOLS[TILE_ORDER.at(-1) ?? 'address'].name);
});

test('reduced motion turns every transition off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '');
    expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration')),
    ).toMatch(/^0m?s$/);
});
