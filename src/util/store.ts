import { type Holding, parseHolding } from '../model/holding.ts';

/** The one thing the site keeps: My stack, and only after a tap. Nothing else is ever written. */
const KEY = 'plain-bitcoin:my-stack';

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readHolding(): Holding | null {
    try {
        const text = storage()?.getItem(KEY);
        return text ? parseHolding(JSON.parse(text)) : null;
    } catch {
        return null;
    }
}

export function writeHolding(holding: Holding): boolean {
    try {
        storage()?.setItem(KEY, JSON.stringify(holding));
        return storage() !== null;
    } catch {
        return false;
    }
}

export function forgetHolding(): void {
    try {
        storage()?.removeItem(KEY);
    } catch {}
}
