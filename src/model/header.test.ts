import { describe, expect, it } from 'vitest';
import { checkHeader, difficultyFromBits, parseHeader, targetFromBits, targetZeroBits } from './header.ts';

const BLOCK_976313 =
    '0000022012b59705ee276f1dcdf5b5ccbac768a01758e86a8556000000000000000000000fe586c3fd6d0ba5c043645ef2796a2c92d2d94269f0e4e31e2ecec8556a330507a7fc6a73160217a56bd738';
const GENESIS =
    '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c';

describe('block header', () => {
    it('reads every field of a real header', () => {
        const header = parseHeader(BLOCK_976313);
        expect(header).not.toBeNull();
        expect(header?.version).toBe(537001984);
        expect(header?.previous).toBe('0000000000000000000056856ae85817a068c7baccb5f5cd1d6f27ee0597b512');
        expect(header?.merkleRoot).toBe('05336a55c8ce2e1ee3e4f06942d9d2922c6a79f25e6443c0a50b6dfdc386e50f');
        expect(header?.time).toBe(1794942727);
        expect(header?.nonce).toBe(953641893);
    });

    it('rejects anything that is not 80 bytes of hex', () => {
        expect(parseHeader('00')).toBeNull();
        expect(parseHeader(`${GENESIS.slice(0, -2)}zz`)).toBeNull();
    });

    it('hashes a real header to its block hash, under its target', () => {
        const header = parseHeader(BLOCK_976313);
        if (!header) throw new Error('header');
        const check = checkHeader(header);
        expect(check.hash).toBe('000000000000000000019a6464ea7b38d8560ec7361c8c571a65da4da01f1ed4');
        expect(check.meetsTarget).toBe(true);
        expect(check.zeros).toBeGreaterThanOrEqual(targetZeroBits(header.bits));
    });

    it('fails the check when the nonce is wrong', () => {
        const header = parseHeader(BLOCK_976313);
        if (!header) throw new Error('header');
        expect(checkHeader({ ...header, nonce: header.nonce + 1 }).meetsTarget).toBe(false);
    });

    it('matches the genesis block', () => {
        const header = parseHeader(GENESIS);
        if (!header) throw new Error('header');
        expect(checkHeader(header).hash).toBe('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f');
        expect(difficultyFromBits(header.bits)).toBe(1);
        expect(targetZeroBits(header.bits)).toBe(32);
    });

    it('expands compact bits into the full target', () => {
        expect(targetFromBits(0x1d00ffff)).toBe(0xffffn << 208n);
        expect(targetFromBits(0x03123456)).toBe(0x123456n);
    });
});
