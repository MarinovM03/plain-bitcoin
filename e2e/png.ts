import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface Png {
    width: number;
    height: number;
    /** RGBA, 8 bits a channel, row by row. */
    data: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes the 8-bit RGB or RGBA, non-interlaced PNGs that Chromium writes for screenshots and canvas exports. */
export function decodePng(bytes: Uint8Array): Png {
    const view = Buffer.from(bytes);
    let offset = 8;
    let width = 0;
    let height = 0;
    let channels = 4;
    const chunks: Buffer[] = [];
    while (offset < view.length) {
        const length = view.readUInt32BE(offset);
        const type = view.toString('ascii', offset + 4, offset + 8);
        const body = view.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            if (body[8] !== 8 || body[12] !== 0) throw new Error('Only 8-bit, non-interlaced PNGs are supported');
            channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
            if (channels === 0) throw new Error(`Unsupported colour type ${body[9]}`);
        }
        if (type === 'IDAT') chunks.push(body);
        if (type === 'IEND') break;
        offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const stride = width * channels;
    const pixels = new Uint8Array(width * height * channels);
    for (let y = 0; y < height; y += 1) {
        const filter = raw[y * (stride + 1)] ?? 0;
        for (let x = 0; x < stride; x += 1) {
            const value = raw[y * (stride + 1) + 1 + x] ?? 0;
            const left = x >= channels ? (pixels[y * stride + x - channels] ?? 0) : 0;
            const up = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
            const corner = y > 0 && x >= channels ? (pixels[(y - 1) * stride + x - channels] ?? 0) : 0;
            const predicted =
                filter === 1
                    ? left
                    : filter === 2
                      ? up
                      : filter === 3
                        ? (left + up) >> 1
                        : filter === 4
                          ? paeth(left, up, corner)
                          : 0;
            pixels[y * stride + x] = (value + predicted) & 255;
        }
    }
    if (channels === 4) return { width, height, data: pixels };
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
        data.set(pixels.subarray(i * 3, i * 3 + 3), i * 4);
        data[i * 4 + 3] = 255;
    }
    return { width, height, data };
}

export function readPng(path: string): Png {
    return decodePng(readFileSync(path));
}

export function pixel(png: Png, x: number, y: number): [number, number, number] {
    const i = (Math.round(y) * png.width + Math.round(x)) * 4;
    return [png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0];
}

export function hex(colour: string): [number, number, number] {
    const value = Number.parseInt(colour.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function near(a: readonly number[], b: readonly number[], tolerance = 6): boolean {
    return a.every((value, i) => Math.abs(value - (b[i] ?? 0)) <= tolerance);
}

export function postcardName(tool: string): RegExp {
    return new RegExp(String.raw`^plain-bitcoin-${tool}-\d{4}-\d{2}-\d{2}\.png$`);
}

/** WCAG relative luminance of an 8-bit RGB triple. */
export function luminance([r, g, b]: readonly number[]): number {
    const channel = (value = 0) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
