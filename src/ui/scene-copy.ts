import type { CharRole, SceneData } from '../gauges/types.ts';
import { HALVING_INTERVAL, issued, MAX_SUPPLY, TARGET_BLOCK_SECONDS } from '../model/supply.ts';
import { formatBtc, formatMoney, formatPercent, formatSats, formatShortDay, formatWhole } from '../util/format.ts';

/** The first block of each past era, from the chain itself. Later eras are estimated at ten minutes a block. */
const ERA_YEARS = [2009, 2012, 2016, 2020, 2024];

function eraYear(era: number, height: number, now = Date.now()): string {
    const known = ERA_YEARS[era];
    if (known !== undefined) return String(known);
    const blocks = era * HALVING_INTERVAL - height;
    return `about ${new Date(now + blocks * TARGET_BLOCK_SECONDS * 1000).getUTCFullYear()}`;
}

/** BTC with no trailing zeros, for callouts read at a glance: 50 BTC, 3.125 BTC, 10,500,000 BTC. */
export function plainBtc(sats: number): string {
    const exact = formatBtc(Math.max(0, Math.round(sats)));
    return exact.replace(/\.?0+ BTC$/, ' BTC');
}

function reward(era: number): string {
    return plainBtc(Math.floor(5_000_000_000 / 2 ** era));
}

export const LEFT_SCENE = {
    description:
        'All 21 million as one bar, a slab per halving era: bone is issued, orange still to mine. Front: the last 2 million, ×10.5.',
    zero: '0',
    max: '21,000,000',
    now: 'now',
    zoom: 'Last 2,000,000 · ×10.5',
    sliver: '+3.125 BTC · new block',
    partLabel(id: string): string {
        if (id === 'now') return 'Where issuance stands now';
        if (id === 'last') return 'Era 4 onward, full bar';
        if (id === 'zoom-tail') return 'Era 8 onward, close up';
        const era = Number(id.replace(/^\D+/, ''));
        return id.startsWith('zoom') ? `Era ${era}, close up` : `Era ${era}`;
    },
    nowCallout(issuedSats: number, height: number): string {
        return `Block ${formatWhole(height)} · ${plainBtc(issuedSats)} issued, ${plainBtc(MAX_SUPPLY - issuedSats)} still to mine`;
    },
    eraCallout(slab: { era: number; tail: boolean; from: number; to: number; issued: number; height: number }): string {
        const span = plainBtc(slab.to - slab.from);
        const share =
            slab.issued >= slab.to - slab.from
                ? 'all issued'
                : slab.issued > 0
                  ? `${plainBtc(slab.issued)} issued`
                  : 'not yet mined';
        if (slab.tail) return `Era ${slab.era} onward · from ${eraYear(slab.era, slab.height)} · ${span} · ${share}`;
        return `Era ${slab.era} · from ${eraYear(slab.era, slab.height)} · ${reward(slab.era)} a block · ${span} · ${share}`;
    },
} as const;

/** bitcoin ÷ cash in plain words: "12.4 times", or "2.0 times less" when the bitcoin side is lighter. */
export function formatRatio(ratio: number): string {
    if (!(ratio > 0) || !Number.isFinite(ratio)) return '—';
    if (ratio >= 1)
        return `${ratio >= 100 ? formatWhole(Math.round(ratio)) : ratio.toFixed(ratio >= 10 ? 0 : 1)} times`;
    return `${(1 / ratio).toFixed(1)} times less`;
}

export const POWER_SCENE = {
    description:
        'Cash kept in steel notes, the same money as bitcoin in orange coins. The beam reads the ratio: 8° per ×10.',
    parts: { cash: 'Cash pan', bitcoin: 'Bitcoin pan', beam: 'Beam and dial' },
    empty: 'The pans load once there is an answer.',
    cashCallout: (value: string, log: boolean) =>
        `Kept as cash · still ${value} in notes${log ? ' · stacks on a log scale' : ''}`,
    bitcoinCallout: (value: string, log: boolean) =>
        `Put into bitcoin · worth ${value} today${log ? ' · stacks on a log scale' : ''}`,
    beamCallout: (ratio: number, clamped: boolean) =>
        `Bitcoin side ${formatRatio(ratio)} the cash side · 8° per ×10${clamped ? ' · at its ×1000 end stop' : ''}`,
} as const;

const LEVEL_NAMES = ['1 BTC', '1 mBTC', '1 bit'] as const;
const CELL_NAMES = ['100,000 sats', '100 sats', '1 sat'] as const;

export const CONVERT_SCENE = {
    description: '1 BTC as one block of 100,000,000 sats. Orange is your amount. Tap the next cell to focus into it.',
    parts: {
        filled: 'Your amount',
        block: 'The whole block',
        zoomIn: 'Focus into the next cell',
        zoomOut: 'Focus back out',
    },
    levelTag: (level: number) => `${LEVEL_NAMES[level] ?? ''} =`,
    cellTag: (level: number) => `${level === 2 ? '100' : '1,000'} × ${CELL_NAMES[level] ?? ''}`,
    wholeTag: (whole: number) => `+${formatWhole(whole)} BTC`,
    callout(
        part: string,
        view: { level: number; filled: number; partial: number; cells: number; perCell: number; whole: number },
        sats: number,
    ): string {
        const cell = CELL_NAMES[view.level] ?? '';
        if (part === 'filled' || part === 'block')
            return `${formatSats(sats)} · ${formatWhole(view.filled)} of ${formatWhole(view.cells)} cells of ${cell} here`;
        if (part === 'focus')
            return view.partial > 0
                ? `Next cell ${formatPercent(view.partial)} full · tap to focus into it`
                : 'Next empty cell · tap to focus into it';
        if (part === 'empty') return `${formatWhole(view.cells - view.filled)} cells of ${cell} still empty`;
        if (part === 'whole') return `${formatWhole(view.whole)} whole bitcoin before this block`;
        if (part === 'out') return 'Back out to the larger block';
        return '';
    },
} as const;

export const DCA_SCENE = {
    description:
        'Each buy is a step. Orange: worth at each buy. White: money put in. Dashed steel: one lump sum. Drag for depth.',
    parts: { value: 'Worth at each buy', invested: 'Money put in', lump: 'Lump sum', today: 'Today' },
    buyCallout(data: Extract<SceneData, { id: 'dca' }>, index: number, last: boolean): string {
        const day = formatShortDay(data.t[index] ?? 0);
        const worth = formatMoney(data.value[index] ?? 0, data.fiat);
        const put = formatMoney(data.invested[index] ?? 0, data.fiat);
        return last ? `Today · worth ${data.worth} · put in ${put}` : `${day} · worth ${worth} · put in ${put}`;
    },
    seriesCallout(part: string, data: Extract<SceneData, { id: 'dca' }>, steps: number): string {
        const sampled =
            data.t.length > steps ? ` · ${formatWhole(steps)} of ${formatWhole(data.t.length)} buys drawn` : '';
        if (part === 'value') return `Worth at each buy, ending at ${data.worth}${sampled}`;
        if (part === 'invested') return `Money put in: ${formatMoney(data.invested.at(-1) ?? 0, data.fiat)} in all`;
        if (part === 'lump')
            return data.lump.length > 0
                ? `The same total on day one: worth ${formatMoney(data.lump.at(-1) ?? 0, data.fiat)} today`
                : '';
        return '';
    },
} as const;

const ROLE_NAMES: Record<CharRole, string> = {
    hrp: 'network prefix',
    prefix: 'version prefix',
    separator: 'separator',
    version: 'witness version',
    program: 'program',
    body: 'body',
    checksum: 'checksum',
    unknown: 'not yet read',
};

export const ADDRESS_SCENE = {
    description:
        'A key cut from what you typed, one tooth per character. A proven address seats every pin and turns the plug.',
    blank: 'BLANK',
    notYet: 'NOT YET',
    parts: {
        bow: 'Key bow and type',
        plug: 'Pins and plug',
        stuck: (position: number) => `Stuck pin at character ${position}`,
    },
    count: (total: number, shown: number) =>
        total > shown
            ? `first ${formatWhole(shown)} of ${formatWhole(total)} characters`
            : `${formatWhole(total)} characters`,
    bowCallout: (valid: boolean, kind: string, total: number) =>
        valid
            ? `${kind} address · ${formatWhole(total)} characters`
            : total > 0
              ? 'Not a valid address yet'
              : 'A blank, waiting for an address',
    plugCallout: (state: string, checksumBad: boolean) =>
        state === 'valid'
            ? 'Every pin seats at the line: the checksum proves it, and the plug turns'
            : checksumBad
              ? 'The checksum does not match, so the pins stop short and the plug stays put'
              : 'The pins stop short until the address proves valid',
    toothCallout: (position: number, char: string, role: CharRole, pin: string) =>
        `Character ${position} · '${char}' · ${ROLE_NAMES[role]}${pin === 'stuck' ? ' · cannot be in this address' : ''}`,
} as const;

export const HOME_SCENE = {
    description: 'The chain tip on the table, the five tools around it. Point at one to see its tile, tap to open it.',
    tip: (height: number) => `Block ${formatWhole(height)}`,
    parts: {
        stack: 'The chain tip',
        left: 'Bitcoin left',
        power: 'Purchasing power',
        convert: 'Sats converter',
        dca: 'DCA',
        address: 'Address check',
    } as Record<string, string>,
    stackCallout: (height: number) =>
        `Block ${formatWhole(height)} on top · ${formatPercent(issued(height) / MAX_SUPPLY)} of 21 million issued`,
    miniCallout: (id: string) => (id in HOME_SCENE_CALLOUTS ? (HOME_SCENE_CALLOUTS[id] ?? '') : ''),
};

const HOME_SCENE_CALLOUTS: Record<string, string> = {
    left: 'The 21 million ingot · open Bitcoin left',
    power: 'The balance · open Purchasing power',
    convert: 'The sat cube · open the converter',
    dca: 'The ridge · open DCA',
    address: 'The key · open Address check',
};
