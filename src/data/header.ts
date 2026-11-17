import { type BlockHeader, parseHeader } from '../model/header.ts';

export const HEADER_API = { name: 'mempool.space', origin: 'https://mempool.space' } as const;

const TIMEOUT_MS = 6_000;

/** A real header kept in the bundle, so the miner works offline. */
export const SAVED_HEADER = {
    source: 'mempool.space',
    url: 'https://mempool.space/api/block/000000000000000000019a6464ea7b38d8560ec7361c8c571a65da4da01f1ed4/header',
    asOf: '2026-11-17',
    height: 976313,
    hash: '000000000000000000019a6464ea7b38d8560ec7361c8c571a65da4da01f1ed4',
    hex: '0000022012b59705ee276f1dcdf5b5ccbac768a01758e86a8556000000000000000000000fe586c3fd6d0ba5c043645ef2796a2c92d2d94269f0e4e31e2ecec8556a330507a7fc6a73160217a56bd738',
} as const;

export interface HeaderReading {
    header: BlockHeader;
    height: number;
    hash: string;
    /** Null when the reading is the saved one. */
    readAt: number | null;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function savedHeader(): HeaderReading {
    const header = parseHeader(SAVED_HEADER.hex);
    if (!header) throw new Error('Saved header is malformed');
    return { header, height: SAVED_HEADER.height, hash: SAVED_HEADER.hash, readAt: null };
}

/** The real 80-byte header of a block, exactly as it was mined. */
export async function fetchHeader(fetchImpl: Fetch, hash: string, height: number, now: number): Promise<HeaderReading> {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Not a block hash');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetchImpl(`${HEADER_API.origin}/api/block/${hash}/header`, {
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const header = parseHeader(await response.text());
        if (!header) throw new Error('Malformed header');
        return { header, height, hash, readAt: now };
    } finally {
        clearTimeout(timer);
    }
}
