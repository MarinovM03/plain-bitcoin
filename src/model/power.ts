export type MonthlyValues = Readonly<Record<string, number>>;

export interface PowerData {
    cpi: MonthlyValues;
    closes: MonthlyValues;
}

export interface PathPoint {
    month: string;
    value: number;
}

export interface PowerResult {
    amount: number;
    start: string;
    priceMonth: string;
    cpiMonth: string;
    equivalentNow: number;
    cashBuysNow: number;
    btc: number;
    btcValueNow: number;
    btcRealNow: number;
    path: PathPoint[];
    maxDrawdown: number;
    fall: { peak: PathPoint; trough: PathPoint } | null;
    worst: PathPoint | null;
    monthsBelow: number;
}

export type PowerOutcome =
    | { ok: true; result: PowerResult }
    | { ok: false; reason: 'amount' | 'no-price' | 'no-cpi'; month: string };

export function sortedMonths(values: MonthlyValues): string[] {
    return Object.keys(values).sort();
}

export function latestMonth(values: MonthlyValues): string {
    const last = sortedMonths(values).at(-1);
    if (last === undefined) throw new RangeError('Series has no months');
    return last;
}

function cpiFor(month: string, cpi: MonthlyValues, cpiMonth: string): number | undefined {
    return month > cpiMonth ? cpi[cpiMonth] : cpi[month];
}

export function purchasingPower(amount: number, start: string, data: PowerData): PowerOutcome {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'amount', month: start };
    const priceMonth = latestMonth(data.closes);
    const cpiMonth = latestMonth(data.cpi);
    const startClose = data.closes[start];
    const latestClose = data.closes[priceMonth];
    if (startClose === undefined || latestClose === undefined || start > priceMonth) {
        return { ok: false, reason: 'no-price', month: start };
    }
    const cpiStart = cpiFor(start, data.cpi, cpiMonth);
    const cpiNow = data.cpi[cpiMonth];
    if (cpiStart === undefined || cpiNow === undefined) return { ok: false, reason: 'no-cpi', month: start };

    const btc = amount / startClose;
    const btcValueNow = btc * latestClose;
    const path: PathPoint[] = [];
    let peak: PathPoint = { month: start, value: amount };
    let maxDrawdown = 0;
    let fall: PowerResult['fall'] = null;
    let worst: PathPoint | null = null;
    let monthsBelow = 0;
    for (const month of sortedMonths(data.closes)) {
        const close = data.closes[month];
        if (month <= start || close === undefined) continue;
        const point = { month, value: btc * close };
        path.push(point);
        if (point.value >= peak.value) peak = point;
        const drawdown = 1 - point.value / peak.value;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            fall = { peak, trough: point };
        }
        if (worst === null || point.value < worst.value) worst = point;
        if (point.value < amount) monthsBelow += 1;
    }

    return {
        ok: true,
        result: {
            amount,
            start,
            priceMonth,
            cpiMonth,
            equivalentNow: (amount * cpiNow) / cpiStart,
            cashBuysNow: (amount * cpiStart) / cpiNow,
            btc,
            btcValueNow,
            btcRealNow: (btcValueNow * cpiStart) / cpiNow,
            path,
            maxDrawdown,
            fall,
            worst,
            monthsBelow,
        },
    };
}

export function worstStart(data: PowerData): string | null {
    const priceMonth = latestMonth(data.closes);
    const cpiMonth = latestMonth(data.cpi);
    const latestClose = data.closes[priceMonth];
    const cpiNow = data.cpi[cpiMonth];
    if (latestClose === undefined || cpiNow === undefined) return null;
    let worst: { month: string; real: number } | null = null;
    for (const month of sortedMonths(data.closes)) {
        const close = data.closes[month];
        const cpiStart = cpiFor(month, data.cpi, cpiMonth);
        if (month >= priceMonth || close === undefined || cpiStart === undefined) continue;
        const real = ((latestClose / close) * cpiStart) / cpiNow;
        if (worst === null || real < worst.real) worst = { month, real };
    }
    return worst?.month ?? null;
}
