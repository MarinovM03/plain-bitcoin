import { expect, type Page, test } from '@playwright/test';
import { supplyAt } from '../src/model/supply.ts';
import { ADDRESS, NAV } from '../src/ui/copy.ts';
import { realProblems } from './console.ts';
import { FAKE_HEIGHT, fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';
import { frames, settled, waitForStage } from './stage-hooks.ts';

const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

test.beforeEach(async ({ page }) => {
    await fakeHeightApi(page);
    await fakePriceApi(page);
});

function watch(page: Page): string[] {
    const found: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') found.push(message.text());
    });
    page.on('pageerror', (error) => found.push(error.message));
    return found;
}

const real = (found: string[]) => realProblems(found).filter((text) => !text.includes('GL Driver Message'));

async function labels(page: Page, tone: 'btc' | 'cool' | 'ink'): Promise<string[]> {
    return page.locator(`#scene-plot .g-label--${tone}`).allTextContents();
}

async function burst(page: Page, selector: string, values: string[]): Promise<void> {
    for (const value of values) await page.locator(selector).fill(value);
}

// Every gauge, driven the way a person does, over the live body and on the plain tier: the answer, the newest
// payload and the drawing on the plate must end up agreeing.
for (const tier of ['phone', 'plain'] as const) {
    test.describe(`rapid input on the ${tier} tier`, () => {
        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile && tier === 'plain', 'The plain tier sweep runs on desktop');
        });

        test('converter: fast typing, deleting and nonsense land on the last amount', async ({ page }) => {
            const found = watch(page);
            await page.goto(`/?hero=${tier}#/convert`);
            if (tier !== 'plain') await waitForStage(page);
            const sats = page.locator('#convert-sats');
            await sats.fill('');
            await sats.pressSequentially('123456789', { delay: 5 });
            await burst(page, '#convert-sats', ['', '0', '9,999,999,999,999,999', '1', '']);
            await sats.pressSequentially('2000', { delay: 5 });
            await expect(page.locator('#tool-result')).toHaveText('2,000 sats = £1.15');
            const state = await settled(page);
            expect(state.scene).toBe('convert');
            expect(state.summary).toBe('sats=2000;perDot=10;lit=200');
            expect(await labels(page, 'btc')).toEqual(['1 cell = 10 sats']);
            await expect(page.locator('#scene-plot .g-cell--btc')).toHaveCount(200);
            for (const [value, label] of [
                ['1', '1 cell = 1 sat'],
                ['100,000,000', '1 cell = 0.001 BTC'],
                ['500', '1 cell = 1 sat'],
            ] as const) {
                await sats.fill(value);
                await settled(page);
                expect(await labels(page, 'btc')).toEqual([label]);
            }
            expect(real(found)).toEqual([]);
        });

        test('purchasing power: amounts and dates changed mid-tween land on the bars below', async ({ page }) => {
            const found = watch(page);
            await page.goto(`/?hero=${tier}#/power`);
            if (tier !== 'plain') await waitForStage(page);
            await burst(page, '#power-amount', ['1', '10', '100,000', '', '7']);
            await page.locator('#power-when-year').selectOption('2012');
            await page.locator('#power-when-year').selectOption('2021');
            await page.locator('#power-amount').fill('2,500');
            await expect(page.locator('#tool-result')).toHaveText(/^£2,500 in January 2021 is worth /);
            await settled(page);
            expect(await labels(page, 'btc')).toEqual([(await page.locator('#power-btc-value').textContent()) ?? '']);
            expect(await labels(page, 'cool')).toEqual([(await page.locator('#power-cash-value').textContent()) ?? '']);
            await page.locator('#power-amount').fill('');
            const empty = await settled(page);
            expect(empty.summary).toBe('cash=0;bitcoin=0;log=false');
            expect(real(found)).toEqual([]);
        });

        test('DCA: amount, cadence, currency and range changes leave no stale series', async ({ page }) => {
            const found = watch(page);
            await page.goto(`/?hero=${tier}#/dca`);
            if (tier !== 'plain') await waitForStage(page);
            await burst(page, '#dca-amount', ['5', '500', '', '9,999,999,999', '25']);
            await page.locator('label', { hasText: 'Monthly' }).click();
            await page.locator('label', { hasText: '$ USD' }).click();
            await page.locator('[data-preset="oneYear"]').click();
            await page.locator('#dca-amount').fill('40');
            await expect(page.locator('#tool-result')).toHaveText(/^\$40 a month since /);
            await page.evaluate(() => window.scrollTo(0, 0));
            const state = await settled(page);
            const figure = (await page.locator('#tool-result-figure').textContent()) ?? '';
            expect(state.summary).toMatch(new RegExp(`;worth=${figure.replace(/[$]/g, '\\$')}$`));
            await expect(page.locator('#scene-plot .g-end')).toHaveText(figure);
            const buys = Number(((await page.locator('#dca-buys').textContent()) ?? '').split(' ')[0]);
            expect(state.summary).toMatch(new RegExp(`^marks=(${buys}|${buys + 1});`));
            await expect(page.locator('#scene-plot .dca-chart__line--lump')).toHaveAttribute('points', /\d/);
            expect(real(found)).toEqual([]);
        });

        test('address: typing, pasting, breaking and clearing always land on the right state', async ({ page }) => {
            const found = watch(page);
            await page.goto(`/?hero=${tier}#/address`);
            if (tier !== 'plain') await waitForStage(page);
            const input = page.locator('#address-input');
            await input.pressSequentially(SEGWIT.slice(0, 20), { delay: 5 });
            await input.fill(`${SEGWIT.slice(0, -1)}5`);
            await input.fill('');
            await input.fill('1A0zzz');
            await input.fill(SEGWIT);
            await expect(page.locator('#tool-result-figure')).toHaveText(ADDRESS.figures.p2wpkh);
            const valid = await settled(page);
            expect(valid.summary).toBe('state=valid;chars=42');
            expect(await labels(page, 'btc')).toEqual([`${ADDRESS.figures.p2wpkh} · checksum valid`]);
            await expect(page.locator('#scene-plot .g-glyph')).toHaveCount(42);
            await input.fill('');
            expect((await settled(page)).summary).toBe('state=empty;chars=0');
            expect(real(found)).toEqual([]);
        });
    });
}

test('left: the column splits at the real issued amount, and a band reads out its era', async ({ page }) => {
    await page.goto('/?hero=phone#/left');
    const state = await settled(page);
    const supply = supplyAt(FAKE_HEIGHT);
    expect(state.summary).toBe(`issued=${supply.issued};max=2099999997690000;left=${supply.left}`);
    await page.locator('#scene-plot .g-band').first().click();
    await expect(page.locator('.scene__callout')).toHaveText(/^Era 1 · 3 Jan 2009 to 28 Nov 2012 · 50 BTC a block/);
    await page.locator('#scene-plot .g-band').first().click();
    await expect(page.locator('.scene__callout')).toBeHidden();
});

test('switching tools mid-tween shows the new scene at once, never the old one, and back and forward land right', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=phone#/left');
    await settled(page);
    const nav = page.getByRole('navigation', { name: NAV.label, exact: true });
    for (const id of ['dca', 'convert', 'power', 'left', 'address', 'dca'] as const) {
        await nav.getByRole('link', { name: NAV.short[id], exact: true }).click();
        // Until the tool mounts its window holds no scene at all; it never holds the previous route's.
        await expect
            .poll(async () => {
                const { page: on, scene } = await page.evaluate(() => ({
                    page: document.querySelector('.tool')?.className ?? '',
                    scene: document.querySelector<HTMLElement>('.scene')?.dataset.scene,
                }));
                if (!on.includes(`tool--${id}`)) return 'routing';
                if (scene !== undefined && scene !== id) throw new Error(`stale scene ${scene} on #/${id}`);
                return scene;
            })
            .toBe(id);
        await page.waitForTimeout(90);
    }
    expect((await settled(page)).scene).toBe('dca');
    await page.goBack();
    await expect(page.locator('.tool--address')).toHaveCount(1);
    expect((await settled(page)).scene).toBe('address');
    await page.goForward();
    expect((await settled(page)).scene).toBe('dca');
});

test('a tool takes input while its scene is still arriving', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=phone#/left');
    await page
        .getByRole('navigation', { name: NAV.label, exact: true })
        .getByRole('link', { name: NAV.short.convert })
        .click();
    const sats = page.locator('#convert-sats');
    await sats.fill('777');
    await expect(page.locator('#tool-result')).toHaveText(/^777 sats = /);
    expect((await settled(page)).summary).toBe('sats=777;perDot=1;lit=777');
});

test('resizing and rotating redraw the gauge at its window size', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewport sweep runs once, on desktop');
    await page.goto('/?hero=phone#/dca');
    for (const [width, height] of [
        [390, 844],
        [844, 390],
        [1440, 900],
        [360, 780],
    ] as const) {
        await page.setViewportSize({ width, height });
        await settled(page);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const plot = document.querySelector<HTMLElement>('#scene-plot');
                    const box = plot?.querySelector('svg')?.getAttribute('viewBox');
                    return plot ? `${box}` === `0 0 ${plot.clientWidth} ${plot.clientHeight}` : false;
                }),
            )
            .toBe(true);
    }
});

test('after the GPU context is lost and restored, the body draws again and the gauge never noticed', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    const found = watch(page);
    await page.goto('/?hero=phone#/convert');
    await waitForStage(page);
    await settled(page);
    await page.evaluate(() => (window as unknown as { __pbStage: { loseContext(): void } }).__pbStage.loseContext());
    await page.waitForTimeout(1_000);
    const before = await frames(page);
    await page.locator('#convert-sats').fill('777');
    await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(before + 5);
    expect((await settled(page)).summary).toBe('sats=777;perDot=1;lit=777');
    expect(real(found)).toEqual([]);
});

test('on the plain tier the diorama window shows the supply readout as solid-ink SVG at the real height', async ({
    page,
}) => {
    await page.goto('/?hero=plain');
    await expect(page.locator('.home__stage #scene-plot > svg.gauge-svg')).toHaveCount(1);
    await expect(page.locator('.home__stage .scene')).toHaveAttribute('data-scene', 'home');
    await expect(page.locator('.home__stage .scene')).toHaveAttribute('data-summary', /^issued=\d+/);
    await expect(page.locator('.home__stage .scene')).not.toHaveAttribute('data-gl', /.*/);
});

test('the plain-tier DCA chart is a real SVG whose end point and label match the answer', async ({ page }) => {
    await page.goto('/?hero=plain#/dca');
    await expect(page.locator('#tool-result-figure')).toHaveText(/^£[\d,]+$/);
    const figure = (await page.locator('#tool-result-figure').textContent()) ?? '';
    const chart = page.locator('#scene-plot .dca-chart');
    await expect(chart).toHaveAttribute('aria-label', /^Line chart\./);
    for (const line of ['lump', 'invested', 'value'])
        await expect(chart.locator(`polyline.dca-chart__line--${line}`)).toHaveAttribute(
            'points',
            /^[\d.]+,[\d.]+( [\d.]+,[\d.]+){50,}$/,
        );
    await expect(page.locator('#scene-plot .g-end')).toHaveText(figure);
    const years = await page.locator('#scene-plot .dca-chart__year').allTextContents();
    expect(years).toEqual(['2021', '2022', '2023', '2024', '2025', '2026']);
    const end = await page.evaluate(() => {
        const dot = document.querySelector<SVGCircleElement>('#scene-plot .g-dot--btc')?.getBoundingClientRect();
        const label = document.querySelector('#scene-plot .g-end')?.getBoundingClientRect();
        const plot = document.querySelector('#scene-plot')?.getBoundingClientRect();
        return dot && label && plot ? { dot, label, plot } : null;
    });
    expect(end).not.toBeNull();
    const centre = (end?.dot.left ?? 0) + (end?.dot.width ?? 0) / 2;
    expect(Math.abs((end?.label.right ?? 0) - centre)).toBeLessThan(3);
    expect(end?.label.bottom ?? 0).toBeLessThanOrEqual((end?.dot.top ?? 0) + 1);
    expect(end?.dot.right ?? 0).toBeLessThanOrEqual((end?.plot.right ?? 0) + 1);
});
