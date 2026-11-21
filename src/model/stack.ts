export interface Buy {
    /** `yyyy-mm-dd` or `yyyy-mm`. */
    day: string;
    sats: number;
}

export interface YearColumn {
    year: string;
    /** Each buy of the year in order, as a share of the biggest single buy of the whole plan. */
    coins: number[];
    sats: number;
}

/** One column per calendar year, so a year when bitcoin was cheap stands taller than one when it was dear. */
export function yearColumns(buys: readonly Buy[]): YearColumn[] {
    const good = buys.filter((buy) => Number.isFinite(buy.sats) && buy.sats > 0 && /^\d{4}-/.test(buy.day));
    const biggest = Math.max(0, ...good.map((buy) => buy.sats));
    const columns: YearColumn[] = [];
    for (const buy of good) {
        const year = buy.day.slice(0, 4);
        let column = columns.at(-1);
        if (column?.year !== year) {
            column = { year, coins: [], sats: 0 };
            columns.push(column);
        }
        column.coins.push(buy.sats / biggest);
        column.sats += buy.sats;
    }
    return columns;
}
