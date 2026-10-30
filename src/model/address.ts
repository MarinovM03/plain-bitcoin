const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58 = '1-9A-HJ-NP-Za-km-z';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONSTANTS = { bech32: 1, bech32m: 0x2bc830a3 } as const;
const BECH32_MAX = 90;
const CHECKSUM_CHARS = 6;
const SHORTEST_SEGWIT = 42;

export type Bech32Encoding = keyof typeof BECH32_CONSTANTS;
export type Encoding = 'base58check' | Bech32Encoding;
export type Network = 'mainnet' | 'testnet' | 'regtest';
export type AddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'future';
export type PartRole = 'hrp' | 'separator' | 'version' | 'program' | 'checksum' | 'prefix' | 'body';
export type InvalidReason =
    | 'checksum'
    | 'characters'
    | 'mixed-case'
    | 'short'
    | 'long'
    | 'other-coin'
    | 'version'
    | 'program'
    | 'unknown';
export type SecretKind = 'seed' | 'wif' | 'extended-private' | 'descriptor';

export interface AddressPart {
    role: PartRole;
    start: number;
    end: number;
}

export interface Base58Bytes {
    version: string;
    hash: string;
    checksum: string;
}

export interface Address {
    kind: 'address';
    type: AddressType;
    network: Network;
    encoding: Encoding;
    text: string;
    parts: AddressPart[];
    witnessVersion: number | null;
    programBytes: number;
    bytes: Base58Bytes | null;
}

export interface InvalidAddress {
    kind: 'invalid';
    reason: InvalidReason;
    encoding: 'base58check' | 'bech32' | null;
    text: string;
    parts: AddressPart[];
    suspect: number | null;
    bytes: Base58Bytes | null;
}

export type Analysis =
    | { kind: 'empty' }
    | { kind: 'secret'; secret: SecretKind }
    | { kind: 'extended-public' }
    | { kind: 'lightning' }
    | Address
    | InvalidAddress;

type Bech32Failure = 'long' | 'characters' | 'mixed-case' | 'separator' | 'checksum';

export type Bech32Decoded =
    | { ok: true; hrp: string; data: number[]; encoding: Bech32Encoding }
    | { ok: false; reason: Bech32Failure; at: number | null };

function polymod(values: readonly number[]): number {
    let check = 1;
    for (const value of values) {
        const top = check >>> 25;
        check = ((check & 0x1ffffff) << 5) ^ value;
        for (let i = 0; i < 5; i += 1) if ((top >>> i) & 1) check ^= GENERATOR[i] ?? 0;
    }
    return check;
}

function hrpExpand(hrp: string): number[] {
    const codes = [...hrp].map((char) => char.charCodeAt(0));
    return [...codes.map((code) => code >> 5), 0, ...codes.map((code) => code & 31)];
}

export function decodeBech32(input: string): Bech32Decoded {
    if (input.length > BECH32_MAX) return { ok: false, reason: 'long', at: null };
    for (let i = 0; i < input.length; i += 1) {
        const code = input.charCodeAt(i);
        if (code < 33 || code > 126) return { ok: false, reason: 'characters', at: i };
    }
    const lower = input.toLowerCase();
    if (input !== lower && input !== input.toUpperCase()) return { ok: false, reason: 'mixed-case', at: null };
    const separator = lower.lastIndexOf('1');
    if (separator < 1 || separator + CHECKSUM_CHARS + 1 > lower.length) {
        return { ok: false, reason: 'separator', at: null };
    }
    const hrp = lower.slice(0, separator);
    const data: number[] = [];
    for (let i = separator + 1; i < lower.length; i += 1) {
        const value = CHARSET.indexOf(lower.charAt(i));
        if (value < 0) return { ok: false, reason: 'characters', at: i };
        data.push(value);
    }
    const check = polymod([...hrpExpand(hrp), ...data]);
    const encoding = (Object.keys(BECH32_CONSTANTS) as Bech32Encoding[]).find(
        (name) => BECH32_CONSTANTS[name] === check,
    );
    if (!encoding) return { ok: false, reason: 'checksum', at: null };
    return { ok: true, hrp, data: data.slice(0, -CHECKSUM_CHARS), encoding };
}

function convertBits(data: readonly number[], from: number, to: number): number[] | null {
    let acc = 0;
    let bits = 0;
    const out: number[] = [];
    const max = (1 << to) - 1;
    const maxAcc = (1 << (from + to - 1)) - 1;
    for (const value of data) {
        acc = ((acc << from) | value) & maxAcc;
        bits += from;
        while (bits >= to) {
            bits -= to;
            out.push((acc >> bits) & max);
        }
    }
    if (bits >= from || ((acc << (to - bits)) & max) !== 0) return null;
    return out;
}

const HRP_NETWORKS: Record<string, Network> = { bc: 'mainnet', tb: 'testnet', bcrt: 'regtest' };

export type SegwitDecoded =
    | { ok: true; network: Network; version: number; program: number[]; encoding: Bech32Encoding }
    | { ok: false; reason: InvalidReason; at: number | null; hrpKnown: boolean };

export function decodeSegwit(input: string): SegwitDecoded {
    const decoded = decodeBech32(input);
    const hrp = input.slice(0, Math.max(0, input.lastIndexOf('1'))).toLowerCase();
    const hrpKnown = hrp in HRP_NETWORKS;
    if (!decoded.ok) {
        const reason: InvalidReason =
            decoded.reason === 'separator' ? (hrpKnown ? 'short' : 'unknown') : decoded.reason;
        return { ok: false, reason, at: decoded.at, hrpKnown };
    }
    const network = HRP_NETWORKS[decoded.hrp];
    if (!network) return { ok: false, reason: 'other-coin', at: null, hrpKnown };
    const [version, ...rest] = decoded.data;
    if (version === undefined) return { ok: false, reason: 'program', at: null, hrpKnown };
    if (version > 16) return { ok: false, reason: 'version', at: null, hrpKnown };
    const program = convertBits(rest, 5, 8);
    if (!program || program.length < 2 || program.length > 40) {
        return { ok: false, reason: 'program', at: null, hrpKnown };
    }
    if (version === 0 && program.length !== 20 && program.length !== 32) {
        return { ok: false, reason: 'program', at: null, hrpKnown };
    }
    if ((version === 0) !== (decoded.encoding === 'bech32')) {
        return { ok: false, reason: 'checksum', at: null, hrpKnown };
    }
    return { ok: true, network, version, program, encoding: decoded.encoding };
}

function segwitType(version: number, length: number): AddressType {
    if (version === 0) return length === 20 ? 'p2wpkh' : 'p2wsh';
    return version === 1 && length === 32 ? 'p2tr' : 'future';
}

function bech32Parts(text: string): AddressPart[] {
    const separator = text.lastIndexOf('1');
    const checksum = text.length - CHECKSUM_CHARS;
    if (separator < 1 || checksum <= separator + 1) return [];
    const parts: AddressPart[] = [
        { role: 'hrp', start: 0, end: separator },
        { role: 'separator', start: separator, end: separator + 1 },
        { role: 'version', start: separator + 1, end: separator + 2 },
    ];
    if (checksum > separator + 2) parts.push({ role: 'program', start: separator + 2, end: checksum });
    parts.push({ role: 'checksum', start: checksum, end: text.length });
    return parts;
}

function findTypo(text: string): number | null {
    const separator = text.lastIndexOf('1');
    for (let i = separator + 1; i < text.length; i += 1) {
        for (const char of CHARSET) {
            if (char === text[i]) continue;
            if (decodeSegwit(text.slice(0, i) + char + text.slice(i + 1)).ok) return i;
        }
    }
    return null;
}

function analyseBech32(input: string): Address | InvalidAddress {
    const text = input === input.toUpperCase() ? input.toLowerCase() : input;
    const decoded = decodeSegwit(input);
    if (decoded.ok) {
        return {
            kind: 'address',
            type: segwitType(decoded.version, decoded.program.length),
            network: decoded.network,
            encoding: decoded.encoding,
            text,
            parts: bech32Parts(text),
            witnessVersion: decoded.version,
            programBytes: decoded.program.length,
            bytes: null,
        };
    }
    let reason = decoded.reason;
    let suspect = decoded.at;
    if (!decoded.hrpKnown && reason !== 'other-coin' && reason !== 'long') {
        reason = 'unknown';
        suspect = null;
    } else if (reason === 'checksum') {
        suspect = findTypo(text);
        if (suspect === null && text.length < SHORTEST_SEGWIT) reason = 'short';
    }
    return {
        kind: 'invalid',
        reason,
        encoding: 'bech32',
        text,
        parts: reason === 'mixed-case' ? [] : bech32Parts(text),
        suspect,
        bytes: null,
    };
}

function base58Decode(input: string): number[] | { at: number } {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i += 1) {
        let carry = BASE58.indexOf(input.charAt(i));
        if (carry < 0) return { at: i };
        for (let j = 0; j < bytes.length; j += 1) {
            carry += (bytes[j] ?? 0) * 58;
            bytes[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }
    for (let i = 0; i < input.length && input[i] === '1'; i += 1) bytes.push(0);
    return bytes.reverse();
}

async function doubleSha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
    const first = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', first));
}

function hex(bytes: readonly number[] | Uint8Array): string {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const BASE58_VERSIONS: Record<number, { type: AddressType; network: Network }> = {
    0: { type: 'p2pkh', network: 'mainnet' },
    5: { type: 'p2sh', network: 'mainnet' },
    111: { type: 'p2pkh', network: 'testnet' },
    196: { type: 'p2sh', network: 'testnet' },
};

const BASE58_LENGTH = 25;

async function analyseBase58(text: string): Promise<Address | InvalidAddress> {
    const parts: AddressPart[] = [
        { role: 'prefix', start: 0, end: 1 },
        { role: 'body', start: 1, end: text.length },
    ];
    const invalid = (reason: InvalidReason, bytes: Base58Bytes | null = null): InvalidAddress => ({
        kind: 'invalid',
        reason,
        encoding: 'base58check',
        text,
        parts: reason === 'short' || reason === 'long' ? [] : parts,
        suspect: null,
        bytes,
    });
    const decoded = base58Decode(text);
    if (!Array.isArray(decoded)) return { ...invalid('characters'), suspect: decoded.at };
    if (decoded.length < BASE58_LENGTH) return invalid('short');
    if (decoded.length > BASE58_LENGTH) return invalid('long');
    const payload = Uint8Array.from(decoded.slice(0, 21));
    const checksum = decoded.slice(21);
    const bytes = { version: hex(decoded.slice(0, 1)), hash: hex(decoded.slice(1, 21)), checksum: hex(checksum) };
    const expected = (await doubleSha256(payload)).slice(0, 4);
    if (hex(expected) !== bytes.checksum) return invalid('checksum', bytes);
    const known = BASE58_VERSIONS[decoded[0] ?? -1];
    if (!known) return invalid('other-coin', bytes);
    return {
        kind: 'address',
        type: known.type,
        network: known.network,
        encoding: 'base58check',
        text,
        parts,
        witnessVersion: null,
        programBytes: 20,
        bytes,
    };
}

const SEED_WORD = /^[a-z]+$/i;
const LIST_NUMBER = /^\d+[.):]?$/;
const WIF = new RegExp(`^(?:[59][${B58}]{50}|[KLc][${B58}]{51})$`);
const WIF_INSIDE = new RegExp(`(?:^|[^${B58}])(?:[59][${B58}]{50}|[KLc][${B58}]{51})(?:$|[^${B58}])`);
const KEY_BOUNDARY = `(?:^|[\\s(\\[\\]/,'"])`;
const EXTENDED_PRIVATE = new RegExp(`${KEY_BOUNDARY}[xyztuvYZUV]prv[${B58}]{100,108}`);
const EXTENDED_PUBLIC = new RegExp(`${KEY_BOUNDARY}[xyztuvYZUV]pub[${B58}]{100,108}`);
const DESCRIPTOR = /^(?:sh|wsh|wpkh|pkh|pk|tr|combo|multi|sortedmulti|multi_a|sortedmulti_a|rawtr)\(/i;

export function detectSecret(input: string): SecretKind | null {
    const words = input.split(/[\s,]+/).filter((word) => word !== '' && !LIST_NUMBER.test(word));
    if (words.length >= 12 && words.length <= 24 && words.every((word) => SEED_WORD.test(word))) return 'seed';
    if (WIF.test(input)) return 'wif';
    if (EXTENDED_PRIVATE.test(input)) return 'extended-private';
    if (DESCRIPTOR.test(input) && WIF_INSIDE.test(input)) return 'descriptor';
    return null;
}

const LIGHTNING = /^(?:lightning:)?ln(?:bc|tb|bcrt|tbs|sb)[0-9a-z]*1/i;
const BITCOIN_URI = /^bitcoin:/i;
const BECH32_PREFIX = /^(?:bc|tb|bcrt)1/i;
const BECH32_SHAPE = /^[a-z0-9]{1,83}1[a-z0-9]+$/i;
const BASE58_SHAPE = new RegExp(`^[${B58}]+$`);
const BASE58_TYPO = /^[123mn][0-9A-Za-z]{24,35}$/;

function stripUri(input: string): string {
    if (!BITCOIN_URI.test(input)) return input;
    return input.replace(BITCOIN_URI, '').replace(/[?#].*$/, '');
}

export async function analyseAddress(raw: string): Promise<Analysis> {
    const input = raw.trim();
    if (input === '') return { kind: 'empty' };
    const secret = detectSecret(input);
    if (secret) return { kind: 'secret', secret };
    if (EXTENDED_PUBLIC.test(input)) return { kind: 'extended-public' };
    if (LIGHTNING.test(input)) return { kind: 'lightning' };
    const text = stripUri(input);
    if (BECH32_PREFIX.test(text)) return analyseBech32(text);
    if (BASE58_SHAPE.test(text) || BASE58_TYPO.test(text)) return analyseBase58(text);
    if (BECH32_SHAPE.test(text)) return analyseBech32(text);
    return { kind: 'invalid', reason: 'unknown', encoding: null, text, parts: [], suspect: null, bytes: null };
}

export function scriptPubKeyHex(address: Address): string | null {
    if (address.witnessVersion === null) return null;
    const decoded = decodeSegwit(address.text);
    if (!decoded.ok) return null;
    const opcode = decoded.version === 0 ? 0 : 0x50 + decoded.version;
    return hex([opcode, decoded.program.length, ...decoded.program]);
}
