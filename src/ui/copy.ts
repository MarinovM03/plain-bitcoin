import type { ToolId } from '../tools/index.ts';

export const SITE_NAME = 'Plain Bitcoin';

export const SITE_DESCRIPTION = 'A few honest Bitcoin tools, fast and plain. Everything runs in your browser.';

export const HOME = {
    promise: 'Plain answers to Bitcoin questions, worked out in your browser.',
    toolsHeading: 'Tools',
} as const;

export const HERO = {
    heading: 'Bitcoin left to mine',
    note: 'The live counter arrives in a later session.',
} as const;

export const TOOLS: Record<ToolId, { name: string; question: string }> = {
    left: {
        name: 'Bitcoin left to mine',
        question: 'How much bitcoin is still to be mined?',
    },
    power: {
        name: 'Purchasing power',
        question: 'What is an old amount of money worth today, and in bitcoin?',
    },
    convert: {
        name: 'Converter',
        question: 'How much is this in sats, bitcoin, pounds or dollars?',
    },
    dca: {
        name: 'Buying on a schedule',
        question: 'How does buying a little at a time (DCA) compare with one lump sum?',
    },
    address: {
        name: 'Address lookup',
        question: 'What can anyone see about a bitcoin address?',
    },
};

export const TOOL_PAGE = {
    back: 'All tools',
    pending: 'This tool opens in a later session.',
} as const;

export const FOOTER = {
    privacy: 'Runs in your browser. No tracking. Never asks for keys or seeds.',
} as const;

export const NOSCRIPT = {
    needs: 'The tools work out every number in your browser, so they need JavaScript turned on.',
} as const;

export function pageTitle(page?: string): string {
    return page ? `${page} · ${SITE_NAME}` : SITE_NAME;
}
