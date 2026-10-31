import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export function pngSize(path: string): [number, number] {
    const bytes = readFileSync(path);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

export async function expectedCardSize(page: Page): Promise<[number, number]> {
    const tall = await page.evaluate(() => window.matchMedia('(max-width: 40rem) and (orientation: portrait)').matches);
    return tall ? [1080, 1350] : [1200, 675];
}

export function cardName(tool: string): RegExp {
    return new RegExp(String.raw`^plain-bitcoin-${tool}-\d{4}-\d{2}(-\d{2})?\.png$`);
}
