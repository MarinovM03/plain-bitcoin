import { describe, expect, it } from 'vitest';
import { type Address, type Analysis, analyseAddress, decodeBech32, detectSecret, scriptPubKeyHex } from './address.ts';

function asAddress(analysis: Analysis): Address {
    if (analysis.kind !== 'address') throw new Error(`Expected an address, got ${analysis.kind}`);
    return analysis;
}

describe('Bech32 checksum (BIP173 vectors)', () => {
    const valid = [
        'A12UEL5L',
        'a12uel5l',
        'an83characterlonghumanreadablepartthatcontainsthenumber1andtheexcludedcharactersbio1tt5tgs',
        'abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw',
        '11qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqc8247j',
        'split1checkupstagehandshakeupstreamerranterredcaperred2y9e3w',
        '?1ezyfcl',
    ];
    it.each(valid)('accepts %s as Bech32', (text) => {
        const decoded = decodeBech32(text);
        expect(decoded.ok && decoded.encoding).toBe('bech32');
    });

    const invalid = [
        `${String.fromCharCode(0x20)}1nwldj5`,
        `${String.fromCharCode(0x7f)}1axkwrx`,
        `${String.fromCharCode(0x80)}1eym55h`,
        'an84characterslonghumanreadablepartthatcontainsthenumber1andtheexcludedcharactersbio1569pvx',
        'pzry9x0s0muk',
        '1pzry9x0s0muk',
        'x1b4n0q5v',
        'li1dgmt3',
        `de1lg7wt${String.fromCharCode(0xff)}`,
        'A1G7SGD8',
        '10a06t8',
        '1qzzfhee',
    ];
    it.each(invalid)('rejects %j', (text) => {
        expect(decodeBech32(text).ok).toBe(false);
    });
});

describe('Bech32m checksum (BIP350 vectors)', () => {
    const valid = [
        'A1LQFN3A',
        'a1lqfn3a',
        'an83characterlonghumanreadablepartthatcontainsthetheexcludedcharactersbioandnumber11sg7hg6',
        'abcdef1l7aum6echk45nj3s0wdvt2fg8x9yrzpqzd3ryx',
        '11llllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllludsr8',
        'split1checkupstagehandshakeupstreamerranterredcaperredlc445v',
        '?1v759aa',
    ];
    it.each(valid)('accepts %s as Bech32m and not Bech32', (text) => {
        const decoded = decodeBech32(text);
        expect(decoded.ok && decoded.encoding).toBe('bech32m');
    });

    const invalid = [
        `${String.fromCharCode(0x20)}1xj0phk`,
        `${String.fromCharCode(0x7f)}1g6xzxy`,
        `${String.fromCharCode(0x80)}1vctc34`,
        'an84characterslonghumanreadablepartthatcontainsthetheexcludedcharactersbioandnumber11d6pts4',
        'qyrz8wqd2c9m',
        '1qyrz8wqd2c9m',
        'y1b0jsk6g',
        'lt1igcx5c0',
        'in1muywd',
        'mm1crxm3i',
        'au1s5cgom',
        'M1VUXWEZ',
        '16plkw9',
        '1p2gdwpf',
    ];
    it.each(invalid)('rejects %j', (text) => {
        expect(decodeBech32(text).ok).toBe(false);
    });
});

describe('segwit addresses (BIP350 vectors)', () => {
    const valid: [string, string][] = [
        ['BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', '0014751e76e8199196d454941c45d1b3a323f1433bd6'],
        [
            'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
            '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262',
        ],
        [
            'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y',
            '5128751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd6',
        ],
        ['BC1SW50QGDZ25J', '6002751e'],
        ['bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs', '5210751e76e8199196d454941c45d1b3a323'],
        [
            'tb1qqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesrxh6hy',
            '0020000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433',
        ],
        [
            'tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c',
            '5120000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433',
        ],
        [
            'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
            '512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        ],
    ];
    it.each(valid)('decodes %s to its scriptPubKey', async (text, script) => {
        const address = asAddress(await analyseAddress(text));
        expect(scriptPubKeyHex(address)).toBe(script);
        expect(address.text).toBe(text.toLowerCase());
    });

    const invalid = [
        'tc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq5zuyut',
        'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd',
        'tb1z0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqglt7rf',
        'BC1S0XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ54WELL',
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh',
        'tb1q0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq24jc47',
        'bc1p38j9r5y49hruaue7wxjce0updqjuyyx0kh56v8s25huc6995vvpql3jow4',
        'BC130XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ7ZWS8R',
        'bc1pw5dgrnzv',
        'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v8n0nx0muaewav253zgeav',
        'BC1QR508D6QEJXTDG4Y5R3ZARVARYV98GJ9P',
        'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq47Zagq',
        'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v07qwwzcrf',
        'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vpggkg4j',
        'bc1gmk9yu',
    ];
    it.each(invalid)('rejects %s', async (text) => {
        expect((await analyseAddress(text)).kind).toBe('invalid');
    });

    it('gives each failure its reason', async () => {
        const reasons: string[] = [];
        for (const text of invalid) {
            const analysis = await analyseAddress(text);
            reasons.push(analysis.kind === 'invalid' ? analysis.reason : analysis.kind);
        }
        expect(reasons).toEqual([
            'other-coin',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'checksum',
            'characters',
            'version',
            'program',
            'program',
            'program',
            'mixed-case',
            'program',
            'program',
            'program',
        ]);
    });
});

describe('BIP173 segwit vectors after BIP350', () => {
    it.each([
        'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
        'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
        'tb1qqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesrxh6hy',
    ])('still accepts the v0 address %s', async (text) => {
        expect((await analyseAddress(text)).kind).toBe('address');
    });

    it.each([
        'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx',
        'BC1SW50QA3JX3S',
        'bc1zw508d6qejxtdg4y5r3zarvaryvg6kdaj',
    ])('rejects the v1+ address %s, which used Bech32 instead of Bech32m', async (text) => {
        expect((await analyseAddress(text)).kind).toBe('invalid');
    });

    it.each([
        'tc1qw508d6qejxtdg4y5r3zarvary0c5xw7kg3g4ty',
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
        'BC13W508D6QEJXTDG4Y5R3ZARVARY0C5XW7KN40WF2',
        'bc1rw5uspcuh',
        'bc10w508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kw5rljs90',
        'BC1QR508D6QEJXTDG4Y5R3ZARVARYV98GJ9P',
        'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sL5k7',
        'bc1zw508d6qejxtdg4y5r3zarvaryvqyzf3du',
        'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3pjxtptv',
        'bc1gmk9yu',
    ])('rejects %s', async (text) => {
        expect((await analyseAddress(text)).kind).toBe('invalid');
    });
});

describe('one real-format address of each type', () => {
    const cases = [
        ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'p2pkh', 'mainnet', 'base58check'],
        ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'p2sh', 'mainnet', 'base58check'],
        ['mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn', 'p2pkh', 'testnet', 'base58check'],
        ['2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc', 'p2sh', 'testnet', 'base58check'],
        ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'p2wpkh', 'mainnet', 'bech32'],
        ['bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'p2wsh', 'mainnet', 'bech32'],
        ['bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', 'p2tr', 'mainnet', 'bech32m'],
        ['bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080', 'p2wpkh', 'regtest', 'bech32'],
    ] as const;
    it.each(cases)('%s is %s on %s (%s)', async (text, type, network, encoding) => {
        const address = asAddress(await analyseAddress(text));
        expect([address.type, address.network, address.encoding]).toEqual([type, network, encoding]);
    });

    it('splits a Taproot address into its parts', async () => {
        const address = asAddress(
            await analyseAddress('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0'),
        );
        const pieces = address.parts.map((part) => [part.role, address.text.slice(part.start, part.end)]);
        expect(pieces).toEqual([
            ['hrp', 'bc'],
            ['separator', '1'],
            ['version', 'p'],
            ['program', '0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq'],
            ['checksum', 'zk5jj0'],
        ]);
        expect(address.programBytes).toBe(32);
    });

    it('decodes the bytes inside a Base58Check address', async () => {
        const address = asAddress(await analyseAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'));
        expect(address.bytes).toEqual({
            version: '00',
            hash: '62e907b15cbf27d5425399ebf6f0fb50ebb88f18',
            checksum: 'c29b7d93',
        });
    });

    it('reads a bitcoin: payment link and ignores its amount', async () => {
        const address = asAddress(
            await analyseAddress(' bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.01&label=x '),
        );
        expect(address.text).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    });
});

describe('typos', () => {
    const taproot = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';

    it('reports a one-character typo in every position of a Bech32m address as a checksum failure', async () => {
        for (let i = 3; i < taproot.length; i += 1) {
            const swapped = taproot[i] === 'q' ? 'p' : 'q';
            const typo = taproot.slice(0, i) + swapped + taproot.slice(i + 1);
            const analysis = await analyseAddress(typo);
            expect(analysis.kind === 'invalid' && [analysis.reason, analysis.suspect]).toEqual(['checksum', i]);
        }
    });

    it('reports a typo in a Base58Check address as a checksum failure and keeps the bytes', async () => {
        const analysis = await analyseAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb');
        expect(analysis.kind === 'invalid' && analysis.reason).toBe('checksum');
        expect(analysis.kind === 'invalid' && analysis.bytes?.version).toBe('00');
    });

    it('points at a character Base58 never uses', async () => {
        const analysis = await analyseAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7Div0Na');
        expect(analysis.kind === 'invalid' && [analysis.reason, analysis.suspect]).toEqual(['characters', 31]);
    });

    it('points at a character Bech32 never uses', async () => {
        const analysis = await analyseAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8fbt4');
        expect(analysis.kind === 'invalid' && [analysis.reason, analysis.suspect]).toEqual(['characters', 39]);
    });

    it('calls a half-typed address short, not broken', async () => {
        for (const text of ['bc1q', 'bc1qw508d6qejxtdg', '1A1zP1eP5QGefi2DM']) {
            const analysis = await analyseAddress(text);
            expect(analysis.kind === 'invalid' && analysis.reason).toBe('short');
        }
    });

    it('says when a valid checksum belongs to another coin', async () => {
        const litecoin = await analyseAddress('ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kgmn4n9');
        expect(litecoin.kind === 'invalid' && litecoin.reason).toBe('other-coin');
    });

    it('does not guess at text that is no address at all', async () => {
        for (const text of ['hello world', 'hello1world', 'https://example.com']) {
            const analysis = await analyseAddress(text);
            expect(analysis.kind === 'invalid' && analysis.reason).toBe('unknown');
        }
    });
});

describe('Lightning and keys', () => {
    it('recognises a Lightning invoice without decoding it', async () => {
        expect(
            (await analyseAddress('lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq')).kind,
        ).toBe('lightning');
        expect((await analyseAddress('LIGHTNING:LNTB1PVJLUEZ')).kind).toBe('lightning');
    });

    const madeUpExtended = (prefix: string) => `${prefix}${'A1b2C3d4E5'.repeat(11).slice(0, 107)}`;

    it.each([
        ['made up words for a plain test of the guard only here', 'seed'],
        ['1. made 2. up 3. words 4. for 5. a 6. plain 7. test 8. of 9. the 10. guard 11. only 12. here', 'seed'],
        [`5${'H'.repeat(50)}`, 'wif'],
        [`K${'x'.repeat(51)}`, 'wif'],
        [madeUpExtended('xprv'), 'extended-private'],
        [madeUpExtended('tprv'), 'extended-private'],
        [`wpkh([d34db33f/84h/0h/0h]${madeUpExtended('xprv')}/0/*)`, 'extended-private'],
        [`wpkh(L${'x'.repeat(51)})`, 'descriptor'],
    ])('treats %s as a secret (%s)', async (text, kind) => {
        expect(detectSecret(text)).toBe(kind);
        expect(await analyseAddress(text)).toEqual({ kind: 'secret', secret: kind });
    });

    it('does not treat eleven words or a real address as a secret', () => {
        expect(detectSecret('made up words for a plain test of the guard only')).toBeNull();
        expect(detectSecret('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0')).toBeNull();
        expect(detectSecret('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBeNull();
    });

    it.each(['xpub', 'ypub', 'zpub', 'tpub'])('refuses to look up an extended public key (%s)', async (prefix) => {
        expect((await analyseAddress(madeUpExtended(prefix))).kind).toBe('extended-public');
        expect((await analyseAddress(`wpkh(${madeUpExtended(prefix)}/0/*)`)).kind).toBe('extended-public');
    });
});
