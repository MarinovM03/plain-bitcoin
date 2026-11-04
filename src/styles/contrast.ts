function channels(hex: string): number[] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
    const [r = 0, g = 0, b = 0] = channels(hex).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (light + 0.05) / (dark + 0.05);
}
