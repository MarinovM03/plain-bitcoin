import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { realProblems } from './console.ts';
import { fakeHeightApi } from './height-api.ts';
import { fakePriceApi } from './price-api.ts';

const API_ORIGINS = ['https://mempool.space', 'https://blockstream.info', 'https://api.coingecko.com'];
const TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
};

function headerRules(): Map<string, string> {
    const text = readFileSync('dist/_headers', 'utf8');
    const block = text.split(/\n(?=\/)/)[0] ?? '';
    const rules = new Map<string, string>();
    for (const line of block.split('\n').slice(1)) {
        const at = line.indexOf(':');
        if (at > 0) rules.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
    }
    return rules;
}

// vite preview sends none of dist/_headers, so this serves dist the way the host will.
function serveWithHeaders(): Promise<{ server: Server; origin: string }> {
    const headers = Object.fromEntries(headerRules());
    const server = createServer((request, response) => {
        let path = join('dist', decodeURIComponent(new URL(request.url ?? '/', 'http://host').pathname));
        if (!existsSync(path) || statSync(path).isDirectory()) path = join('dist', 'index.html');
        response.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
        response.end(readFileSync(path));
    });
    return new Promise((resolve) =>
        server.listen(0, () =>
            resolve({ server, origin: `http://localhost:${(server.address() as AddressInfo).port}` }),
        ),
    );
}

test.beforeEach(() => {
    test.skip(test.info().project.name !== 'phone', 'Reads build files; one Chromium project is enough.');
});

test('the deploy headers carry the page CSP plus framing and the other locks', async ({ page }) => {
    await page.goto('/');
    const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    const rules = headerRules();
    expect(rules.get('Content-Security-Policy')).toBe(`${meta}; frame-ancestors 'none'`);
    expect(rules.get('X-Frame-Options')).toBe('DENY');
    expect(rules.get('X-Content-Type-Options')).toBe('nosniff');
    expect(rules.get('Referrer-Policy')).toBe('no-referrer');
    expect(rules.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(rules.get('Strict-Transport-Security')).toMatch(/^max-age=31536000/);
    const allowed = (rules.get('Permissions-Policy') ?? '').split(', ').filter((rule) => !rule.endsWith('=()'));
    expect(allowed).toEqual(['clipboard-read=(self)', 'clipboard-write=(self)']);
});

test('the CSP allows exactly the three keyless APIs and nothing inline', async ({ page }) => {
    await page.goto('/');
    const csp = (await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')) ?? '';
    const directives = new Map(csp.split('; ').map((rule) => [rule.split(' ')[0], rule.split(' ').slice(1)]));
    expect(directives.get('connect-src')).toEqual(["'self'", ...API_ORIGINS]);
    for (const name of ['default-src', 'script-src', 'style-src', 'font-src', 'worker-src']) {
        expect(directives.get(name)).toEqual(["'self'"]);
    }
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-src')).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-|\*|http:/);
});

test('served with its headers, every route runs clean and the site refuses to be framed', async ({ page }) => {
    const { server, origin } = await serveWithHeaders();
    try {
        await fakeHeightApi(page);
        await fakePriceApi(page);
        const problems: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
        });
        page.on('pageerror', (error) => problems.push(error.message));
        for (const route of ['?hero=full', '#/left', '#/power', '#/convert', '#/dca', '#/address']) {
            await page.goto(`${origin}/${route}`);
            await expect(page.locator('h1').first()).toBeVisible();
        }
        await page.waitForTimeout(500);
        expect(realProblems(problems)).toEqual([]);

        await page.setContent(`<iframe src="${origin}/" title="framed"></iframe>`);
        await page.waitForTimeout(1000);
        expect(await page.frames()[1]?.locator('h1').count()).toBe(0);
    } finally {
        server.close();
    }
});
