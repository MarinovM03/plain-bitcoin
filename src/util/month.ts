export interface Month {
    year: number;
    month: number;
}

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });

function index({ year, month }: Month): number {
    return year * 12 + (month - 1);
}

export function parseMonth(value: string): Month | null {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return null;
    const month = { year: Number(match[1]), month: Number(match[2]) };
    return month.month >= 1 && month.month <= 12 ? month : null;
}

export function monthValue({ year, month }: Month): string {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function clampMonth(value: Month, min: Month, max: Month): Month {
    if (index(value) < index(min)) return min;
    if (index(value) > index(max)) return max;
    return value;
}

export function yearsBetween(min: Month, max: Month): number[] {
    const years: number[] = [];
    for (let year = max.year; year >= min.year; year -= 1) years.push(year);
    return years;
}

export function monthsIn(year: number, min: Month, max: Month): number[] {
    const first = year === min.year ? min.month : 1;
    const last = year === max.year ? max.month : 12;
    const months: number[] = [];
    for (let month = first; month <= last; month += 1) months.push(month);
    return months;
}

export function monthLabel(month: number): string {
    return monthName.format(new Date(Date.UTC(2000, month - 1, 1)));
}
