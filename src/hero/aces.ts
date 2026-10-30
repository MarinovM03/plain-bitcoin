export type Rgb = readonly [number, number, number];

// The column-major matrices and curve of three.js ACESFilmicToneMapping (tonemapping_pars_fragment).
const INPUT: readonly Rgb[] = [
    [0.59719, 0.076, 0.0284],
    [0.35458, 0.90834, 0.13383],
    [0.04823, 0.01566, 0.83777],
];
const OUTPUT: readonly Rgb[] = [
    [1.60475, -0.10208, -0.00327],
    [-0.53108, 1.10813, -0.07276],
    [-0.07367, -0.00605, 1.07602],
];

function multiply(columns: readonly Rgb[], v: Rgb): Rgb {
    const [a, b, c] = columns as [Rgb, Rgb, Rgb];
    return [
        a[0] * v[0] + b[0] * v[1] + c[0] * v[2],
        a[1] * v[0] + b[1] * v[1] + c[1] * v[2],
        a[2] * v[0] + b[2] * v[1] + c[2] * v[2],
    ];
}

function fit(v: number): number {
    return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function aces(linear: Rgb, exposure = 1): Rgb {
    const scaled = linear.map((v) => (v * exposure) / 0.6) as unknown as Rgb;
    const curved = multiply(INPUT, scaled).map(fit) as unknown as Rgb;
    return multiply(OUTPUT, curved).map(clamp01) as unknown as Rgb;
}

export function srgbToLinear(v: number): number {
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToSrgb(hex: string): Rgb {
    const value = Number.parseInt(hex.replace('#', ''), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function invert(columns: readonly Rgb[]): Rgb[] {
    const [[a, d, g], [b, e, h], [c, f, i]] = columns as [Rgb, Rgb, Rgb];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    const rows = [
        [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
        [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
        [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
    return [0, 1, 2].map((col) => rows.map((row) => row[col] ?? 0) as unknown as Rgb);
}

function unfit(y: number): number {
    const a = 1 - 0.983729 * y;
    const b = 0.0245786 - 0.432951 * y;
    const c = -(0.000090537 + 0.238081 * y);
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

const INPUT_INVERSE = invert(INPUT);
const OUTPUT_INVERSE = invert(OUTPUT);

export function inverseAces(target: Rgb, exposure = 1): Rgb {
    const curved = multiply(OUTPUT_INVERSE, target).map(unfit) as unknown as Rgb;
    return multiply(INPUT_INVERSE, curved).map((v) => Math.max(0, (v * 0.6) / exposure)) as unknown as Rgb;
}
