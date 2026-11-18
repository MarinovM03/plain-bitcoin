export interface StackLines {
    /** What the buys are worth at each step, in money. */
    value: number[];
    /** The money put in by each step. */
    invested: number[];
}

/** The same amount put into bitcoin at each closing price in turn, oldest first. Bad prices are skipped. */
export function stackLines(closes: readonly number[], amount: number): StackLines {
    const prices = closes.filter((price) => Number.isFinite(price) && price > 0);
    const lines: StackLines = { value: [], invested: [] };
    if (prices.length === 0 || !(amount > 0)) return lines;
    let coins = 0;
    prices.forEach((price, step) => {
        coins += amount / price;
        lines.value.push(coins * price);
        lines.invested.push(amount * (step + 1));
    });
    return lines;
}

/** Scales both lines by the same largest number, so they share one axis from 0 to 1. */
export function scaleLines(lines: StackLines): StackLines {
    const top = Math.max(0, ...lines.value, ...lines.invested);
    const scale = (series: number[]) => (top > 0 ? series.map((value) => value / top) : []);
    return { value: scale(lines.value), invested: scale(lines.invested) };
}
