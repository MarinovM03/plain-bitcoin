import { expect, type Page, test } from '@playwright/test';
import { SHARE } from '../src/ui/copy.ts';
import { cardName, expectedCardSize, pngSize } from './card-file.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';

const TOOLS: { tool: string; route: string; answer: string; prepare?: (page: Page) => Promise<void> }[] = [
    { tool: 'left', route: 'left', answer: '#left-figure' },
    { tool: 'power', route: 'power', answer: '#tool-result' },
    {
        tool: 'converter',
        route: 'convert',
        answer: '#tool-result',
        prepare: (page) => expect(page.locator('#tool-result')).toHaveText('100,000 sats = £57.33'),
    },
    { tool: 'dca', route: 'dca', answer: '#tool-result' },
    {
        tool: 'address',
        route: 'address',
        answer: '#tool-result',
        prepare: (page) => page.locator('#address-input').fill(TAPROOT),
    },
];

for (const { tool, route, answer, prepare } of TOOLS) {
    test(`#/${route} makes a Plain Bitcoin card and the same words for X`, async ({ page }) => {
        await fakeHeightApi(page);
        await fakePriceApi(page);
        await page.goto(`/#/${route}`);
        await prepare?.(page);
        const download = page.locator('[data-share="download"]');
        await expect(download).toBeEnabled();
        const shown = (await page.locator(answer).textContent())?.trim() ?? '';
        expect(shown).not.toBe('');

        const post = page.locator('[data-share-post]');
        await expect(post).not.toHaveAttribute('aria-disabled', 'true');
        const href = new URL((await post.getAttribute('href')) ?? '');
        expect(`${href.origin}${href.pathname}`).toBe('https://x.com/intent/post');
        expect([...href.searchParams.keys()]).toEqual(['text']);
        const text = href.searchParams.get('text') ?? '';
        expect(text).toContain(shown.replace(/\.$/, ''));
        expect(text.endsWith('\nplainbitcoin.org')).toBe(true);

        const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
        expect(file.suggestedFilename()).toMatch(cardName(tool));
        const path = test.info().outputPath(file.suggestedFilename());
        await file.saveAs(path);
        expect(pngSize(path)).toEqual(await expectedCardSize(page));
        await expect(page.getByText(SHARE.downloaded)).toBeAttached();
    });
}
