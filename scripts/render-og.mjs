import { mkdir, writeFile } from 'node:fs/promises';
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
    await page.goto(`http://localhost:${PORT}/?hero=still`);
    await mkdir(new URL('../public/og/', import.meta.url), { recursive: true });
    const ids = await page.evaluate(async () => (await import('/src/tools/index.ts')).TOOL_IDS);
    for (const route of ['home', ...ids]) {
        const base64 = await page.evaluate(
            async ({ address, id }) => {
                const { renderOgImage } = await import('/src/postcard/og.ts');
                const bytes = new Uint8Array(await (await renderOgImage(address, id)).arrayBuffer());
                let binary = '';
                for (const byte of bytes) binary += String.fromCharCode(byte);
                return btoa(binary);
            },
            { address: site, id: route },
        );
        const file = route === 'home' ? '../public/og.png' : `../public/og/${route}.png`;
        await writeFile(new URL(file, import.meta.url), Buffer.from(base64, 'base64'));
        console.log(`${file.slice(3)} written for ${site}`);
    }
} finally {
    await browser.close();
    await server.close();
}
