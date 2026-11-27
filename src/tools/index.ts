export const TOOL_IDS = [
    'fees',
    'tx',
    'halving',
    'left',
    'miner',
    'stack',
    'convert',
    'dca',
    'power',
    'address',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export type GroupId = 'now' | 'yours';

/** The two ways in, used by the menu and the home gallery alike: what the chain is doing, and your own bitcoin. */
export const TOOL_GROUPS: readonly { id: GroupId; tools: readonly ToolId[] }[] = [
    { id: 'now', tools: ['fees', 'tx', 'halving', 'left', 'miner'] },
    { id: 'yours', tools: ['stack', 'convert', 'dca', 'power', 'address'] },
];

export function isToolId(value: string): value is ToolId {
    return (TOOL_IDS as readonly string[]).includes(value);
}
