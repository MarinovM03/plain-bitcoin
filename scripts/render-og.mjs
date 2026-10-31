import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const PORT = 5176;
const site = (process.env.VITE_SITE_URL || 'https://plainbitcoin.org').replace(/^https?:\/\//, '').replace(/\/+$/, '');

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.goto(`http://localhost:${PORT}/?hero=plain`);
    const base64 = await page.evaluate(async (address) => {
        const { renderOgImage } = await import('/src/share/og.ts');
        const bytes = new Uint8Array(await (await renderOgImage(address)).arrayBuffer());
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    }, site);
    await writeFile(new URL('../public/og.png', import.meta.url), Buffer.from(base64, 'base64'));
    console.log(`public/og.png written for ${site}`);
} finally {
    await browser.close();
    await server.close();
}
