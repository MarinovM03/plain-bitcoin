export const LOG_THRESHOLD = 10;

export interface BarScale {
    log: boolean;
    ratio: number;
    widths: number[];
    decade: number;
}

export function barScale(values: readonly number[]): BarScale {
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (!(min > 0)) throw new RangeError('Bar values must be positive');
    const ratio = max / min;
    if (ratio <= LOG_THRESHOLD) return { log: false, ratio, widths: values.map((value) => value / max), decade: 0 };
    const floor = min / LOG_THRESHOLD;
    const span = Math.log10(max / floor);
    return {
        log: true,
        ratio,
        widths: values.map((value) => Math.log10(value / floor) / span),
        decade: 1 / span,
    };
}

export interface Sparkline {
    points: string;
    baseY: number;
    log: boolean;
}

export function sparkline(values: readonly number[], base: number, width: number, height: number): Sparkline {
    const all = [...values, base];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const log = min > 0 && max / min > LOG_THRESHOLD;
    const at = (value: number) => (log ? Math.log10(value) : value);
    const low = at(min);
    const range = at(max) - low || 1;
    const y = (value: number) => round(height - ((at(value) - low) / range) * height);
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    const points = values.map((value, i) => `${round(i * step)},${y(value)}`).join(' ');
    return { points, baseY: y(base), log };
}

function round(value: number): number {
    return Math.round(value * 10) / 10;
}
