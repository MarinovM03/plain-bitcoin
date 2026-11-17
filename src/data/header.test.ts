import { describe, expect, it, vi } from 'vitest';
import { checkHeader } from '../model/header.ts';
import { fetchHeader, SAVED_HEADER, savedHeader } from './header.ts';

describe('block header feed', () => {
    it('keeps a saved header that hashes to its own block hash', () => {
        const reading = savedHeader();
        expect(reading.readAt).toBeNull();
        expect(checkHeader(reading.header).hash).toBe(SAVED_HEADER.hash);
    });

    it('asks mempool.space for one header, without credentials or referrer', async () => {
        const fetch = vi.fn(async () => new Response(SAVED_HEADER.hex));
        const reading = await fetchHeader(fetch, SAVED_HEADER.hash, SAVED_HEADER.height, 1234);
        expect(fetch).toHaveBeenCalledOnce();
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`https://mempool.space/api/block/${SAVED_HEADER.hash}/header`);
        expect(init.credentials).toBe('omit');
        expect(init.referrerPolicy).toBe('no-referrer');
        expect(reading.readAt).toBe(1234);
        expect(reading.header.nonce).toBe(953641893);
    });

    it('never builds a URL from something that is not a block hash', async () => {
        const fetch = vi.fn(async () => new Response(SAVED_HEADER.hex));
        await expect(fetchHeader(fetch, '../../evil', 1, 0)).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects an error status or a malformed body', async () => {
        await expect(
            fetchHeader(async () => new Response('', { status: 500 }), SAVED_HEADER.hash, 1, 0),
        ).rejects.toThrow();
        await expect(fetchHeader(async () => new Response('nope'), SAVED_HEADER.hash, 1, 0)).rejects.toThrow();
    });
});
