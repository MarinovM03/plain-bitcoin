import { expect, type Page, test } from '@playwright/test';
import { ADDRESS_SAMPLES } from '../src/ui/address-view.ts';
import { ADDRESS } from '../src/ui/copy.ts';
import { realProblems } from './console.ts';

const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TYPO = `${TAPROOT.slice(0, 20)}q${TAPROOT.slice(21)}`;
const INVOICE = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq';
const MADE_UP_SEED = 'made up words for a plain test of the guard only here';
const madeUpExtended = (prefix: string) => `${prefix}${'A1b2C3d4E5'.repeat(11).slice(0, 107)}`;

const STATS = {
    address: TAPROOT,
    chain_stats: {
        funded_txo_count: 2,
        funded_txo_sum: 80_000,
        spent_txo_count: 1,
        spent_txo_sum: 30_000,
        tx_count: 3,
    },
    mempool_stats: { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0 },
};

function watch(page: Page) {
    const external: string[] = [];
    const problems: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).hostname !== 'localhost') external.push(request.url());
    });
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    return { external, problems };
}

async function fakeAddressApi(page: Page) {
    const calls: string[] = [];
    await page.route(/^https:\/\/mempool\.space\//, (route) => {
        calls.push(route.request().url());
        return route.fulfill({ json: STATS, headers: { 'access-control-allow-origin': '*' } });
    });
    return calls;
}

async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/#/address');
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.empty);
});

test('decodes offline and asks mempool.space only after the tap', async ({ page }) => {
    const calls = await fakeAddressApi(page);
    const { external, problems } = watch(page);
    const input = page.getByLabel(ADDRESS.field);

    await input.fill(TAPROOT);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types.p2tr));
    await expect(page.locator('#tool-result-detail')).toHaveText(ADDRESS.detail('Bitcoin mainnet', 'Bech32m'));
    await expect(page.locator('#address-text .part')).toHaveText([
        'bc',
        '1',
        'p',
        '0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq',
        'zk5jj0',
    ]);
    await expect(page.locator('#address-multisig')).toBeVisible();
    await expect(page.getByText(ADDRESS.apiNote)).toBeVisible();
    await expect(page.locator('#address-explorer')).toHaveAttribute('href', `https://mempool.space/address/${TAPROOT}`);

    await input.fill(SEGWIT);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types.p2wpkh));
    await page.waitForTimeout(1000);
    expect(external).toEqual([]);

    await page.getByRole('button', { name: ADDRESS.lookUp }).click();
    await expect(page.locator('#address-chain')).toContainText('0.0005 BTC (50,000 sats)');
    await expect(page.locator('#address-lookup-status')).toContainText('mempool.space, checked');
    expect(calls).toEqual([`https://mempool.space/api/address/${SEGWIT}`]);
    expect(external).toEqual(calls);

    await input.fill(TAPROOT);
    await expect(page.locator('#address-chain')).toBeHidden();
    expect(await horizontalOverflow(page)).toBe(0);
    expect(realProblems(problems)).toEqual([]);
});

test('each sample fills the field and is decoded as its type, with nothing sent', async ({ page }) => {
    const { external } = watch(page);
    for (const type of Object.keys(ADDRESS_SAMPLES) as (keyof typeof ADDRESS_SAMPLES)[]) {
        await page.getByRole('button', { name: ADDRESS.samples[type], exact: true }).click();
        await expect(page.getByLabel(ADDRESS.field)).toHaveValue(ADDRESS_SAMPLES[type]);
        await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types[type]));
    }
    expect(external).toEqual([]);
});

test('a one-character typo is a checksum failure with the character marked', async ({ page }) => {
    await page.getByLabel(ADDRESS.field).fill(TYPO);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.invalid.checksum);
    await expect(page.locator('#tool-result-detail')).toHaveText(ADDRESS.why.checksumAt(21));
    await expect(page.locator('#address-text .part--suspect')).toHaveText('q');
    await expect(page.locator('#address-text .part--checksum')).toHaveText('zk5jj0');
    await expect(page.getByRole('button', { name: ADDRESS.lookUp })).toBeDisabled();
    await expect(page.locator('.share-bar button').first()).toBeDisabled();
    expect(await horizontalOverflow(page)).toBe(0);
});

test('a Lightning invoice is named as one, not decoded', async ({ page }) => {
    await page.getByLabel(ADDRESS.field).fill(INVOICE);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.lightningHeadline);
    await expect(page.locator('#address-parts')).toBeHidden();
    await expect(page.getByRole('button', { name: ADDRESS.lookUp })).toBeDisabled();
});

test('the secrets guard clears a seed phrase or private key and sends nothing', async ({ page }) => {
    const { external, problems } = watch(page);
    const input = page.getByLabel(ADDRESS.field);
    for (const secret of [MADE_UP_SEED, madeUpExtended('xprv')]) {
        await input.fill(SEGWIT);
        await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types.p2wpkh));
        await input.fill(secret);
        await expect(page.locator('#address-guard')).toHaveText(ADDRESS.secret);
        await expect(input).toHaveValue('');
        await expect(page.locator('#tool-result')).toHaveText(ADDRESS.empty);
        await expect(page.locator('#address-parts')).toBeHidden();
        await expect(page.getByRole('button', { name: ADDRESS.lookUp })).toBeDisabled();
    }
    await page.waitForTimeout(500);
    expect(external).toEqual([]);
    expect(page.url()).toMatch(/\/#\/address$/);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    expect(realProblems(problems)).toEqual([]);
});

test('the guard sees through hidden characters, numbering and labels, and Enter submits nothing', async ({ page }) => {
    const { external, problems } = watch(page);
    const input = page.getByLabel(ADDRESS.field);
    const words = MADE_UP_SEED.split(' ');
    for (const secret of [
        words.join('​ '),
        words.map((word, i) => `${i + 1}.${word}`).join(' '),
        `my seed: ${MADE_UP_SEED}.`,
        JSON.stringify(words),
        `​${madeUpExtended('xprv')}`,
        `key: L${'x'.repeat(51)}`,
    ]) {
        await input.fill(secret);
        await expect(page.locator('#address-guard')).toHaveText(ADDRESS.secret);
        await expect(input).toHaveValue('');
        await input.press('Enter');
    }
    await input.fill(SEGWIT);
    await input.press('Enter');
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types.p2wpkh));
    await page.waitForTimeout(500);
    expect(external).toEqual([]);
    expect(page.url()).toMatch(/\/#\/address$/);
    const stored = await page.evaluate(async () => {
        const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
        return localStorage.length + sessionStorage.length + databases.length + document.cookie.length;
    });
    expect(stored).toBe(0);
    expect(realProblems(problems)).toEqual([]);
});

test('a huge paste is answered at once and never looked up', async ({ page }) => {
    const { external } = watch(page);
    const input = page.getByLabel(ADDRESS.field);
    await input.fill('2'.repeat(100_000));
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.invalid.long, { timeout: 3000 });
    await expect(page.getByRole('button', { name: ADDRESS.lookUp })).toBeDisabled();
    await input.fill(`<svg onload=alert(1)><script>alert(2)</script>javascript:alert(3)\u0000‮`);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.invalid.unknown);
    expect(await page.locator('svg[onload], #main script').count()).toBe(0);
    expect(external).toEqual([]);
});

test('an extended public key is not looked up', async ({ page }) => {
    await page.getByLabel(ADDRESS.field).fill(madeUpExtended('zpub'));
    await expect(page.locator('#address-guard')).toHaveText(ADDRESS.extendedPublic);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.extendedPublicHeadline);
    await expect(page.getByRole('button', { name: ADDRESS.lookUp })).toBeDisabled();
});

test('paste fills the field, and the card shows the type unless the address is switched on', async ({
    page,
    context,
    browserName,
}) => {
    test.skip(browserName !== 'chromium', 'Clipboard permission is Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate((text) => navigator.clipboard.writeText(text), TAPROOT);
    await page.getByRole('button', { name: ADDRESS.paste }).click();
    await expect(page.getByLabel(ADDRESS.field)).toHaveValue(TAPROOT);
    await expect(page.locator('#tool-result')).toHaveText(ADDRESS.headline(ADDRESS.types.p2tr));

    const copy = page.locator('[data-share="copy"]');
    await copy.click();
    await expect(copy).toHaveText('Copied');
    const typeOnly = await page.evaluate(() => navigator.clipboard.readText());
    expect(typeOnly).toContain(ADDRESS.headline(ADDRESS.types.p2tr));
    expect(typeOnly).not.toContain(TAPROOT);

    await page.getByLabel(ADDRESS.cardToggle).check();
    await expect(copy).toHaveText('Copy text');
    await copy.click();
    await expect(copy).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(TAPROOT);

    const download = page.waitForEvent('download');
    await page.locator('[data-share="download"]').click();
    expect((await download).suggestedFilename()).toMatch(/^plain-bitcoin-address-\d{4}-\d{2}-\d{2}\.png$/);
});
