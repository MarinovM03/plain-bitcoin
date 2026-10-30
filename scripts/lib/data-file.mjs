import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const FIRST_MONTH = '2010-01';

export async function download(url) {
    const response = await fetch(url, { headers: { 'user-agent': 'plain-bitcoin data update (manual run)' } });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.text();
}

export function today() {
    return new Date().toISOString().slice(0, 10);
}

export function lastDayOf(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return `${month}-${String(day).padStart(2, '0')}`;
}

function nextMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
}

export function reportGaps(name, months) {
    const keys = Object.keys(months);
    for (let i = 1; i < keys.length; i += 1) {
        if (nextMonth(keys[i - 1]) !== keys[i]) console.warn(`${name}: gap between ${keys[i - 1]} and ${keys[i]}`);
    }
}

export function nextDay(day) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

export async function writeJsonFile(path, data) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

export async function writeDailyFile(path, data) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.start)) throw new Error(`${path}: bad start ${data.start}`);
    for (const [i, value] of data.closes.entries()) {
        if (!Number.isFinite(value) || value <= 0) throw new Error(`${path}: bad value ${value} at day ${i}`);
    }
    await writeJsonFile(path, data);
    console.log(`${path}: ${data.closes.length} days from ${data.start}`);
}

export async function writeDataFile(path, data) {
    const months = Object.fromEntries(Object.entries(data.months).sort(([a], [b]) => a.localeCompare(b)));
    for (const [month, value] of Object.entries(months)) {
        if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(value) || value <= 0) {
            throw new Error(`${path}: bad value ${value} for ${month}`);
        }
    }
    reportGaps(path, months);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify({ ...data, months }, null, 4)}\n`, 'utf8');
    const keys = Object.keys(months);
    console.log(`${path}: ${keys.length} months, ${keys[0]} to ${keys.at(-1)}`);
}
