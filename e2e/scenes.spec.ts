import { expect, type Page, test } from '@playwright/test';
import { SATS_PER_BTC, supplyAt } from '../src/model/supply.ts';
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

async function labels(page: Page, tone: 'btc' | 'paper' | 'muted'): Promise<string[]> {
    return page.locator(`#scene-plot .guide-label--${tone}`).allTextContents();
}

async function burst(page: Page, selector: string, values: string[]): Promise<void> {
    for (const value of values) await page.locator(selector).fill(value);
}

// Every tool, driven the way a person does, on the WebGL stage: the answer, the newest payload and the picture
// on screen must end up agreeing.
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
            const state = await settled(page, tier !== 'plain');
            expect(state.scene).toBe('convert');
            expect(state.summary).toBe('sats=2000;perDot=10;lit=200');
            expect(await labels(page, 'btc')).toEqual(['1 dot = 10 sats']);
            for (const [value, label] of [
                ['1', '1 dot = 1 sat'],
                ['100,000,000', '1 dot = 0.001 BTC'],
                ['500', '1 dot = 1 sat'],
            ] as const) {
                await sats.fill(value);
                await settled(page, tier !== 'plain');
                expect(await labels(page, 'btc')).toEqual([label]);
            }
            expect(real(found)).toEqual([]);
        });

        test('purchasing power: amounts and dates changed mid-morph land on the bars below', async ({ page }) => {
            const found = watch(page);
            await page.goto(`/?hero=${tier}#/power`);
            if (tier !== 'plain') await waitForStage(page);
            await burst(page, '#power-amount', ['1', '10', '100,000', '', '7']);
            await page.locator('#power-when-year').selectOption('2012');
            await page.locator('#power-when-year').selectOption('2021');
            await page.locator('#power-amount').fill('2,500');
            await expect(page.locator('#tool-result')).toHaveText(/^£2,500 in January 2021 is worth /);
            await settled(page, tier !== 'plain');
            expect(await labels(page, 'btc')).toEqual([(await page.locator('#power-btc-value').textContent()) ?? '']);
            expect(await labels(page, 'paper')).toEqual([
                (await page.locator('#power-cash-value').textContent()) ?? '',
            ]);
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
            const state = await settled(page, tier !== 'plain');
            const figure = (await page.locator('#tool-result-figure').textContent()) ?? '';
            expect(state.summary).toMatch(new RegExp(`;worth=${figure.replace(/[$]/g, '\\$')}$`));
            expect(await labels(page, 'btc')).toEqual([figure]);
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
            const valid = await settled(page, tier !== 'plain');
            expect(valid.summary).toBe('state=valid;chars=42');
            expect(await labels(page, 'btc')).toEqual([ADDRESS.figures.p2wpkh]);
            await input.fill('');
            expect((await settled(page)).summary).toBe('state=empty;chars=0');
            expect(real(found)).toEqual([]);
        });
    });
}

test('left: the volume lights one dot per 10,000 BTC issued, and a band reads out its era', async ({ page }) => {
    await page.goto('/?hero=phone#/left');
    await waitForStage(page);
    const state = await settled(page, true);
    expect(state.summary).toBe(
        `issued=${supplyAt(FAKE_HEIGHT).issued};max=2099999997690000;lit=${Math.floor(supplyAt(FAKE_HEIGHT).issued / SATS_PER_BTC / 10_000)}`,
    );
    await page.locator('.guide-band').first().click();
    await expect(page.locator('.scene__callout')).toHaveText(/^Era 1 · 3 Jan 2009 to 28 Nov 2012 · 50 BTC a block/);
    await page.locator('.guide-band').first().click();
    await expect(page.locator('.scene__callout')).toBeHidden();
});

test('switching routes mid-morph shows the new scene, never the old one', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=phone#/left');
    await waitForStage(page);
    await settled(page, true);
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
        await page.waitForTimeout(120);
    }
    const last = await settled(page, true);
    expect(last.scene).toBe('dca');
    await expect(page.locator('.scene[data-live]')).toHaveCount(1);
});

test('resizing and rotating keep the points inside their window', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewport sweep runs once, on desktop');
    await page.goto('/?hero=phone#/dca');
    await waitForStage(page);
    for (const [width, height] of [
        [390, 844],
        [844, 390],
        [1440, 900],
        [360, 780],
    ] as const) {
        await page.setViewportSize({ width, height });
        await settled(page, true);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const plot = document.querySelector('#scene-plot')?.getBoundingClientRect();
                    const sent = (document.querySelector<HTMLElement>('#stage')?.dataset.plotRect ?? '').split(',');
                    if (!plot) return 'no plot';
                    const want = [plot.left, plot.top + window.scrollY, plot.width, plot.height].map(Math.round);
                    return want.every((value, i) => Math.abs(value - Number(sent[i])) <= 1)
                        ? 'aligned'
                        : `${want} vs ${sent}`;
                }),
            )
            .toBe('aligned');
    }
});

test('after the GPU context is lost and restored, the stage draws the right scene again', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'Checked once, on desktop');
    const found = watch(page);
    await page.goto('/?hero=phone#/convert');
    await waitForStage(page);
    await settled(page, true);
    await page.evaluate(() => (window as unknown as { __stage: { loseContext(): void } }).__stage.loseContext());
    await page.waitForTimeout(1_000);
    const before = await frames(page);
    await page.locator('#convert-sats').fill('777');
    await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(before + 5);
    const state = await settled(page, true);
    expect(state.summary).toBe('sats=777;perDot=1;lit=777');
    expect(real(found)).toEqual([]);
});

test('home previews take turns re-forming through the one stage', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, on desktop');
    await page.goto('/?hero=phone');
    await waitForStage(page);
    const live = () =>
        page.evaluate(() => document.querySelector<HTMLElement>('.tile__preview[data-live]')?.dataset.preview ?? '');
    await expect.poll(live, { timeout: 10_000 }).not.toBe('');
    const first = await live();
    await expect.poll(live, { timeout: 12_000 }).not.toBe(first);
    await expect(page.locator('.tile__preview[data-live]')).toHaveCount(1);
});

test('the plain-tier DCA chart is a real SVG whose end point and label match the answer', async ({ page }) => {
    await page.goto('/?hero=plain#/dca');
    await expect(page.locator('#tool-result-figure')).toHaveText(/^£[\d,]+$/);
    const figure = (await page.locator('#tool-result-figure').textContent()) ?? '';
    const chart = page.locator('#scene-plot .dca-chart');
    await expect(chart).toHaveAttribute('aria-label', /^Line chart\./);
    for (const line of ['lump', 'invested', 'value'])
        await expect(chart.locator(`.dca-chart__line--${line}`)).toHaveAttribute(
            'points',
            /^[\d.]+,[\d.]+( [\d.]+,[\d.]+){50,}$/,
        );
    await expect(page.locator('#scene-plot .guide-label--btc')).toHaveText(figure);
    const years = await page.locator('#scene-plot .guide-label--middle').allTextContents();
    expect(years).toEqual(['2021', '2022', '2023', '2024', '2025', '2026']);
    const end = await page.evaluate(() => {
        const line = document.querySelector<SVGPolylineElement>('.dca-chart__line--value');
        const svg = line?.ownerSVGElement;
        const last = line?.points.getItem(line.points.numberOfItems - 1);
        if (!line || !svg || !last) return null;
        const matrix = svg.getScreenCTM();
        const point = new DOMPoint(last.x, last.y).matrixTransform(matrix ?? undefined);
        const label = document.querySelector('.guide-label--btc')?.getBoundingClientRect();
        return { x: point.x, y: point.y, label: label ? { right: label.right, bottom: label.bottom } : null };
    });
    expect(end?.label).not.toBeNull();
    expect(Math.abs((end?.label?.right ?? 0) - (end?.x ?? 0))).toBeLessThan(2);
    expect((end?.label?.bottom ?? 0) <= (end?.y ?? 0)).toBe(true);
});
