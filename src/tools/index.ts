export const TOOL_IDS = ['miner', 'left', 'halving', 'tx', 'power', 'convert', 'dca', 'address'] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(value: string): value is ToolId {
    return (TOOL_IDS as readonly string[]).includes(value);
}
